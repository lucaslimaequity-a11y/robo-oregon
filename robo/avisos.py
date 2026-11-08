# -*- coding: utf-8 -*-
"""Alertas e Telegram.

Alertas só nascem de dados confiáveis: cotação 'atualizado' (ou 'suspeito', marcado para conferir) e fator com data.
Dado desatualizado ou indisponível nunca gera alerta nem vira variação de 0%.

O Telegram devolve o motivo real de cada recusa (ex.: "Bad Request: chat not found"); o robô registra esse motivo
sem nunca escrever o token. No modo de teste, a rodada falha se a mensagem não for entregue.
"""
import datetime as dt
import html
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

from util import br_data, esc, num, sem_acento, sinal

FATOR_NOME = {'selic': 'Selic', 'pre': 'Curva prefixada', 'real': 'Juro real (IPCA+)', 'ust2': 'Treasury 2 anos', 'ust10': 'Treasury 10 anos',
              'usd': 'Dólar', 'ibov': 'Ibovespa', 'sp': 'S&P 500', 'em': 'Emergentes (EEM)', 'brent': 'Petróleo Brent', 'btc': 'Bitcoin'}


def detectar(snap, cfg, estado, hoje):
    L, A, out = cfg['limites'], cfg['alertas'], []
    if A.get('fatores', True):
        for k, f in snap['fatores'].items():
            lim = L['fatores'].get(k)
            if not f.get('ok') or lim is None or f.get('var') is None or f.get('status') not in (None, 'atualizado', 'suspeito'):
                continue
            v = f['var']
            if abs(v) + 1e-9 < lim:
                continue
            forte = abs(v) >= 2 * lim
            u = ' p.p.' if f['uvar'] == 'pp' else '%'
            nivel_txt = (num(f['nivel'], 2) + '%') if f['uvar'] == 'pp' else (('R$ ' if f['unid'] == 'R$' else 'US$ ' if f['unid'] == 'US$' else '') + num(f['nivel'], 0 if f['unid'] == 'pts' else 2))
            conferir = ' ⚠ conferir: ' + f['motivo'] if f.get('status') == 'suspeito' else ''
            out.append({'id': '%s:%s:%s:%s' % (k, f['data'], 'forte' if forte else 'atencao', '+' if v > 0 else '-'), 'tipo': 'fator', 'k': k, 'var': v, 'uvar': f['uvar'],
                        'limite': lim, 'nivel': 'forte' if forte else 'atenção', 'data': f['data'], 'suspeito': f.get('status') == 'suspeito',
                        'texto': '%s %s: %s (%s%s; limite %s%s; %s)%s' % ('▲' if v > 0 else '▼', f.get('detalhe') or f['nome'], nivel_txt, sinal(v, 2), u, num(lim, 2), u, f.get('fonte', ''), conferir)})
    if A.get('ativos', True):
        nomes = {a['id']: a for a in cfg['ativos']}
        for t, c in snap['ativos'].items():
            a = nomes.get(t) or {}
            if a.get('alertar') is False or c.get('status') not in ('atualizado', 'suspeito') or c.get('var') is None:
                continue
            lim = L['ativos'].get(a.get('classe'), L['ativos'].get('outro'))
            if lim is None or abs(c['var']) + 1e-9 < lim:
                continue
            forte = abs(c['var']) >= 2 * lim
            conferir = ' ⚠ conferir: ' + c['motivo'] if c.get('status') == 'suspeito' else ''
            out.append({'id': '%s:%s:%s:%s' % (t, c['data'], 'forte' if forte else 'atencao', '+' if c['var'] > 0 else '-'), 'tipo': 'ativo', 't': t, 'var': c['var'], 'uvar': '%',
                        'limite': lim, 'nivel': 'forte' if forte else 'atenção', 'data': c['data'], 'suspeito': c.get('status') == 'suspeito',
                        'texto': '%s %s (%s): %s %s (%s%%; limite %s%%; %s, %s)%s' % ('▲' if c['var'] > 0 else '▼', t, a.get('nome', ''), 'US$' if c.get('moeda') == 'USD' else 'R$',
                                                                                    num(c['preco'], 2), sinal(c['var'], 1), num(lim, 1), c.get('fonte', ''),
                                                                                    'intradiário' if c.get('tipo_preco') == 'intradiario' else 'fechamento', conferir)})
    ind = snap['indicadores']
    ip = ind.get('ipca_mes')
    if A.get('indicadores', True) and ip and estado.get('ipca_visto') and estado['ipca_visto'] != ip['data']:
        d = dt.date.fromisoformat(ip['data'])
        doze = ind.get('ipca_12m', {}).get('nivel')
        out.append({'id': 'ipca:' + ip['data'], 'tipo': 'indicador', 'k': 'ipca', 'nivel': 'atenção', 'data': hoje.isoformat(),
                    'texto': 'IPCA de %02d/%d divulgado: %s%% no mês%s (IBGE via Banco Central)' % (d.month, d.year, num(ip['nivel'], 2), ('; %s%% em 12 meses' % num(doze, 2)) if doze is not None else '')})
    if A.get('indicadores', True):
        for nome, it in (ind.get('focus') or {}).items():
            lim = L.get('focus', {}).get(nome)
            a = it['anos'].get(str(hoje.year))
            if lim is None or not a or a.get('var') is None or abs(a['var']) + 1e-9 < lim:
                continue
            u = ' R$' if nome == 'Câmbio' else ' p.p.'
            out.append({'id': 'focus:%s:%s:%s' % (nome, hoje.year, num(a['mediana'], 2)), 'tipo': 'indicador', 'k': 'focus', 'nivel': 'atenção', 'data': it['data'],
                        'texto': 'Focus de %s: %s %d em %s (%s%s na semana; Banco Central)' % (br_data(it['data']), nome, hoje.year, num(a['mediana'], 2), sinal(a['var'], 2), u)})
    if A.get('noticias', True):
        recente = (hoje - dt.timedelta(days=1)).isoformat()
        cont = 0
        for x in snap.get('noticias') or []:
            cl, ia = x.get('classe') or {}, x.get('ia') or {}
            if (cl.get('relevancia') == 'alta' or ia.get('relevancia') == 'alta') and (x.get('quando') or '')[:10] >= recente and cont < 5:
                cont += 1
                motivo = ia.get('resumo') and ('Leitura gerada por IA: ' + ia['resumo']) or cl.get('porque') or ''
                out.append({'id': 'noticia:' + sem_acento(x['titulo'])[:60], 'tipo': 'noticia', 'nivel': 'atenção', 'data': (x.get('quando') or '')[:10],
                            'texto': '%s: %s (%s). %s' % (x.get('tema') or 'Mercado', x['titulo'], x.get('fonte') or 'sem fonte', motivo)})
    return out


# ---------------------------------------------------------------- Telegram
def partes(texto, limite=3800):
    """Quebra a mensagem em linhas inteiras (o Telegram aceita até 4.096 caracteres e recusa HTML cortado)."""
    out, cur = [], ''
    for ln in texto.split('\n'):
        if len(ln) > limite:
            ln = html.escape(html.unescape(re.sub(r'<[^>]+>', '', ln)), quote=False)[:limite]
        if cur and len(cur) + 1 + len(ln) > limite:
            out.append(cur)
            cur = ln
        else:
            cur = ln if not cur else cur + '\n' + ln
    if cur:
        out.append(cur)
    return out


def _descricao(e):
    try:
        js = json.loads(e.read().decode('utf-8'))
        return str(js.get('description') or '')[:200]
    except Exception:
        return ''


def _post(metodo, dados=None, timeout=30):
    tok = os.environ.get('TELEGRAM_TOKEN')
    url = 'https://api.telegram.org/bot%s/%s' % (tok, metodo)
    rq = urllib.request.Request(url, data=urllib.parse.urlencode(dados).encode() if dados else None)
    with urllib.request.urlopen(rq, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8'))


def verificar():
    """Confere a chave do robô sem enviar nada (getMe). Devolve (ok, texto) e nunca o token."""
    if not os.environ.get('TELEGRAM_TOKEN'):
        return False, 'TELEGRAM_TOKEN não configurado'
    try:
        r = _post('getMe')
        u = (r.get('result') or {}).get('username')
        return True, 'robô @%s reconhecido' % u if u else 'robô reconhecido'
    except urllib.error.HTTPError as e:
        return False, 'TELEGRAM_TOKEN recusado pelo Telegram (HTTP %s%s)' % (e.code, ': ' + _descricao(e) if e.code != 404 else ': token inválido')
    except Exception as e:
        return False, 'Telegram sem resposta (%s)' % type(e).__name__


def enviar(texto):
    """Envia em partes. Se a formatação for recusada, reenvia a mesma parte em texto simples.
    Devolve (ok, detalhe): o detalhe traz o motivo informado pelo próprio Telegram."""
    tok, chat = os.environ.get('TELEGRAM_TOKEN'), os.environ.get('TELEGRAM_CHAT_ID')
    if not tok:
        return False, 'TELEGRAM_TOKEN não configurado'
    if not chat:
        return False, 'TELEGRAM_CHAT_ID não configurado (Passo 1 do guia)'
    for parte in partes(texto):
        for modo in ('HTML', None):
            dados = {'chat_id': chat, 'text': parte if modo else html.unescape(re.sub(r'<[^>]+>', '', parte)), 'disable_web_page_preview': 'true'}
            if modo:
                dados['parse_mode'] = modo
            try:
                _post('sendMessage', dados)
                break
            except urllib.error.HTTPError as e:
                desc = _descricao(e)
                if e.code == 400 and modo and 'chat not found' not in desc.lower():
                    continue
                dica = ''
                d = desc.lower()
                if 'chat not found' in d:
                    dica = ': o TELEGRAM_CHAT_ID não corresponde a uma conversa com este robô (mande um "oi" ao robô e confira o número)'
                elif 'bot was blocked' in d:
                    dica = ': o robô foi bloqueado nesta conversa'
                elif e.code in (401, 404):
                    dica = ': TELEGRAM_TOKEN inválido'
                return False, 'Telegram recusou (HTTP %s%s%s)' % (e.code, ' · ' + desc if desc else '', dica)
            except Exception as e:
                return False, 'Telegram sem resposta (%s)' % type(e).__name__
    return True, ''


def msg_alertas(novos, agora_, status):
    linhas = ['<b>Oregon · alerta de mercado</b> (%s)' % agora_.strftime('%d/%m %H:%M')]
    for a in novos:
        linhas.append(('‼️ ' if a['nivel'] == 'forte' else '') + esc(a['texto']))
    if status and status.get('nivel') != 'completo':
        linhas.append('\nQualidade dos dados: %s (%s).' % (status['nivel'], esc('; '.join(status.get('motivos', [])[:2]))))
    linhas.append('\nNo painel: Mesa do Gestor → Mercado ao vivo mostra o impacto nas carteiras.')
    return '\n'.join(linhas)


def msg_resumo(snap, cfg, hoje, titulo='fechamento'):
    F, I, A = snap['fatores'], snap['indicadores'], snap['ativos']

    def f(k):
        x = F.get(k) or {}
        if not x.get('ok'):
            return '%s indisponível' % FATOR_NOME.get(k, k)
        sufixo = '' if x.get('status') in (None, 'atualizado') else ' [%s]' % x['status']
        if x['uvar'] == 'pp':
            return '%s %s%% (%s)%s' % (x.get('detalhe') or x['nome'], num(x['nivel'], 2), sinal(x['var'], 2, ' p.p.'), sufixo)
        pre = 'R$ ' if x['unid'] == 'R$' else 'US$ ' if x['unid'] == 'US$' else ''
        return '%s %s%s (%s)%s' % (x['nome'], pre, num(x['nivel'], 0 if x['unid'] == 'pts' else 2), sinal(x['var'], 1, '%'), sufixo)
    L = ['<b>Oregon · %s de %s</b>' % (titulo, br_data(hoje.isoformat()))]
    st, cob = snap.get('status') or {}, snap.get('cobertura') or {}
    if st:
        L.append('<b>Qualidade</b>: %s · %s de %s cotações atualizadas (%s%%)' % (st.get('nivel'), cob.get('atualizados'), cob.get('total'), num(cob.get('taxa_sucesso'), 0)))
    L.append('<b>Juros</b>: ' + esc(' · '.join([f('selic'), f('pre'), f('real')])))
    L.append('<b>EUA</b>: ' + esc(' · '.join([f('ust10'), f('sp')])))
    L.append('<b>Bolsa e câmbio</b>: ' + esc(' · '.join([f('ibov'), f('usd')])))
    L.append('<b>Commodities e cripto</b>: ' + esc(' · '.join([f('brent'), f('btc')])))
    cls = {a['id']: a['classe'] for a in cfg['ativos']}
    acoes = [(t, c) for t, c in A.items() if cls.get(t) in ('acao', 'fii') and c.get('status') == 'atualizado' and c.get('var') is not None]
    ult = max([c.get('data') or '' for t, c in acoes] or [''])
    acoes = sorted([(t, c) for t, c in acoes if c.get('data') == ult], key=lambda x: x[1]['var'])
    alta = [x for x in reversed(acoes) if x[1]['var'] > 0][:3]
    baixa = [x for x in acoes if x[1]['var'] < 0][:3]
    if alta:
        L.append('<b>Carteira, maiores altas</b>: ' + esc(', '.join('%s %s%%' % (t, sinal(c['var'], 1)) for t, c in alta)))
    if baixa:
        L.append('<b>Carteira, maiores quedas</b>: ' + esc(', '.join('%s %s%%' % (t, sinal(c['var'], 1)) for t, c in baixa)))
    fo = I.get('focus') or {}
    if fo:
        pt = []
        for nome in ('IPCA', 'Selic', 'PIB Total', 'Câmbio'):
            a = (fo.get(nome) or {}).get('anos', {}).get(str(hoje.year))
            if a:
                pt.append('%s %s' % (nome, num(a['mediana'], 2)))
        L.append('<b>Focus %d</b> (%s): %s' % (hoje.year, br_data(next(iter(fo.values()))['data']), esc(' · '.join(pt))))
    rel = [x for x in snap.get('noticias') or [] if (x.get('classe') or {}).get('relevancia') in ('alta', 'media')]
    if rel:
        L.append('<b>Notícias relevantes</b>:')
        for x in rel[:6]:
            L.append('• %s: <a href="%s">%s</a> (%s)' % (esc(x.get('tema') or ''), esc(x.get('link') or ''), esc(x['titulo'][:140]), esc(x.get('fonte') or '')))
    if cob.get('lista_indisponiveis'):
        L.append('Sem cotação: ' + esc(', '.join(cob['lista_indisponiveis'][:15])) + ('…' if len(cob['lista_indisponiveis']) > 15 else ''))
    return '\n'.join(L)
