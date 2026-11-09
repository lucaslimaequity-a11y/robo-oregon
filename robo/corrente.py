"""v3.11 · corrente de rodadas (aprovada pelo Lucas em 09/11/2026).

Nesse dia o GitHub disparou só 2 das 28 rodadas agendadas desde a meia-noite (nenhuma entre 10:07 e 14:22): o agendador
dele ("schedule") atrasa e, com carga alta, descarta rodadas. O disparo feito pela própria rodada (workflow_dispatch com
a chave temporária da rodada) não passa por esse agendador; a documentação do GitHub diz que ele sempre cria a rodada.
O disparo é sempre no ramo main, e só contam como "mais novas" as rodadas do main.

Como funciona: no fim de cada rodada, a etapa "seguinte" do robo.yml roda este arquivo. Ele espera o intervalo contado
do início da rodada (15 min das 6h às 23h, 30 min de madrugada, 60 min depois de uma rodada com falha) e dispara a
próxima, a não ser que já exista uma rodada mais nova (sua, de horário ou de envio): essa mais nova é que segue a corrente.
Assim as correntes não se multiplicam: se por um instante houver duas, a mais velha vê a mais nova e para. A rodada da corrente funciona como a agendada (não é "manual"): cada fonte segue o próprio
intervalo. As fontes sem intervalo (feeds RSS e as buscas, que já eram lidos a cada rodada) passam a ser lidos a cada 15 min
também fora do pregão e a cada 30 min de madrugada. Os horários do robo.yml continuam como reserva: se a corrente parar, o
primeiro horário que o GitHub disparar (ou um "Coletar agora") a religa.

Desligar: em robo/config.json, intel → corrente → "ativo": false.
Só a biblioteca padrão do Python (roda sem instalar nada). Nenhuma chave nova: usa a GITHUB_TOKEN da própria rodada.
"""
import datetime as dt
import http.client
import json
import os
import sys
import time
import urllib.error
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
BRT = dt.timezone(dt.timedelta(hours=-3))
API = 'https://api.github.com'
RAMO = 'main'
PADRAO = {'ativo': True, 'minutos_dia': 15, 'minutos_noite': 30, 'minutos_apos_falha': 60, 'dia_de': 6, 'dia_ate': 23}
TETO_MIN = 60   # a etapa "seguinte" tem 75 minutos de prazo no robo.yml; um intervalo maior mataria a espera
ERROS_REDE = (urllib.error.URLError, http.client.HTTPException, OSError, ValueError)


def ajustes(cfg):
    """Os ajustes da corrente (intel → corrente no config.json), com os padrões para o que faltar."""
    c = dict(PADRAO)
    c.update({k: v for k, v in (((cfg or {}).get('intel') or {}).get('corrente') or {}).items() if not k.startswith('_')})
    return c


def intervalo_min(quando, c, falhou=False):
    """Minutos entre o início de uma rodada e o da seguinte."""
    if falhou:
        m = c['minutos_apos_falha']
    else:
        h = quando.astimezone(BRT).hour
        m = c['minutos_dia'] if int(c['dia_de']) <= h < int(c['dia_ate']) else c['minutos_noite']
    return max(5, min(TETO_MIN, int(m)))


def espera_seg(inicio, agora_, minutos):
    """Segundos até a próxima rodada (zero se esta já passou do intervalo)."""
    return max(0, int((inicio + dt.timedelta(minutes=minutos) - agora_).total_seconds()))


def resumo(cfg, inicio):
    """Para o versao.json: o painel mostra a próxima coleta prevista pela corrente."""
    c = ajustes(cfg)
    if not c.get('ativo'):
        return {'ativo': False}
    m = intervalo_min(inicio, c)
    return {'ativo': True, 'minutos': m, 'proxima': (inicio + dt.timedelta(minutes=m)).astimezone(BRT).isoformat(timespec='minutes')}


def rodada_mais_nova(runs, numero, ramo='main'):
    """A rodada mais nova que esta (número maior), se houver; cancelada e de outro ramo não contam."""
    novas = [r for r in runs or [] if int(r.get('run_number') or 0) > int(numero) and r.get('conclusion') != 'cancelled'
             and (r.get('head_branch') or ramo) == ramo]
    return max(novas, key=lambda r: int(r['run_number'])) if novas else None


def _data(s):
    return dt.datetime.fromisoformat(str(s).replace('Z', '+00:00'))


def _api(metodo, caminho, token, corpo=None):
    req = urllib.request.Request(API + caminho, method=metodo, data=json.dumps(corpo).encode('utf-8') if corpo is not None else None, headers={
        'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'robo-oregon-corrente', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        txt = r.read().decode('utf-8') or '{}'
    return json.loads(txt) if txt.strip() else {}


def _tentar(f, *a):
    """Até 4 tentativas (esperas de 15, 30 e 60 s): uma falha passageira do GitHub não quebra a corrente. Se um disparo
    repetido criar uma rodada a mais, a mais velha das duas vê a mais nova e para (nunca ficam duas correntes)."""
    for espera in (15, 30, 60, None):
        try:
            return f(*a)
        except ERROS_REDE:
            if espera is None:
                raise
            time.sleep(espera)


def hm(d):
    return d.astimezone(BRT).strftime('%H:%M')


def main(env=None, agora=None, dormir=None, api=None):
    env = os.environ if env is None else env
    agora = agora or (lambda: dt.datetime.now(dt.timezone.utc))
    dormir = dormir or time.sleep
    api = api or _api
    try:
        with open(env.get('ROBO_CONFIG') or os.path.join(AQUI, 'config.json'), encoding='utf-8') as f:
            c = ajustes(json.load(f))
    except (OSError, ValueError) as e:
        print('Corrente: não li o config.json (%s); uso os padrões.' % e)
        c = dict(PADRAO)
    if not c.get('ativo'):
        print('Corrente desligada no config.json (intel → corrente → ativo). Ficam só os horários do robo.yml.')
        return 0
    # coleta cancelada: ou outra rodada mais nova tomou o lugar na fila (ela segue a corrente, e a conferência abaixo vê
    # isso), ou passou do prazo de 40 min; nos dois casos vale a espera de depois de falha
    resultado = env.get('COLETAR') or 'success'
    repo, run_id, token = env.get('GITHUB_REPOSITORY'), env.get('GITHUB_RUN_ID'), env.get('GH_TOKEN') or env.get('GITHUB_TOKEN')
    if not (repo and run_id and token):
        print('Corrente: fora do GitHub Actions (sem repositório, rodada ou chave da rodada); nada a disparar.')
        return 0
    try:
        run = _tentar(api, 'GET', '/repos/%s/actions/runs/%s' % (repo, run_id), token)
        inicio = _data(run.get('run_started_at') or run.get('created_at'))
        numero, wf = run['run_number'], run['workflow_id']
        falhou = resultado != 'success'
        minutos = intervalo_min(inicio, c, falhou)
        esp = espera_seg(inicio, agora(), minutos)
        situacao = {'success': '', 'cancelled': ' e a coleta foi cancelada', 'skipped': ' e a coleta não rodou'}.get(resultado, ' e terminou com falha')
        print('Rodada #%s começou às %s (Brasília)%s. Próxima às %s: %d min depois do início desta; espera de %d min.' % (
            numero, hm(inicio), situacao, hm(inicio + dt.timedelta(minutes=minutos)), minutos, esp // 60))
        if esp:
            dormir(esp)
        runs = _tentar(api, 'GET', '/repos/%s/actions/workflows/%s/runs?per_page=20' % (repo, wf), token).get('workflow_runs') or []
        nova = rodada_mais_nova(runs, numero, RAMO)
        if nova:
            print('Já existe a rodada #%s (%s, %s): ela segue a corrente.' % (nova['run_number'], nova.get('event'), nova.get('status')))
            return 0
        # sempre no ramo principal: uma rodada de teste em outro ramo não leva a corrente para lá
        _tentar(api, 'POST', '/repos/%s/actions/workflows/%s/dispatches' % (repo, wf), token, {'ref': RAMO, 'inputs': {'modo': 'normal', 'corrente': 'true'}})
        print('Próxima rodada disparada às %s (Brasília).' % hm(agora()))
        return 0
    except ERROS_REDE + (KeyError, TypeError) as e:
        # não deixa a rodada vermelha por isso: o próximo horário do robo.yml (ou um Coletar agora) religa a corrente
        print('::warning title=Corrente de rodadas::Não consegui disparar a próxima rodada (%s). O próximo horário do robo.yml religa a corrente.' % str(e)[:200])
        return 0


if __name__ == '__main__':
    sys.exit(main())
