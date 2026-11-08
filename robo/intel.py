#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Oregon Intelligence · robô de conteúdo (versão 3)

Roda no GitHub Actions (.github/workflows/robo.yml), sete dias por semana, e também à mão. Em cada rodada:
  1. macro oficial que explica as notícias: Selic/CDI, IPCA, Focus, Tesouro (pré e IPCA+), Treasuries, PTAX e a
     agenda de divulgações (Banco Central, IBGE, Tesouro, Tesouro dos EUA). Sem cotação de ação e sem câmbio ao vivo;
  2. conteúdo das fontes cadastradas em robo/fontes.json (gestoras, instituições, canais oficiais): RSS, APIs públicas,
     páginas e PDFs públicos, respeitando robots.txt e sem contornar bloqueios;
  3. classificação (temas, regiões, ativos e setores da Oregon, fatores), prioridade e análise em sete pontos por regras;
     com ANTHROPIC_API_KEY e intel.ia.ativo, leitura por IA dos itens prioritários dentro de um teto diário;
  4. biblioteca persistente por mês (nada é apagado), deduplicação, contadores por fonte e briefing do dia;
  5. aos sábados (ou em modo "semanal"), o resumo da semana.
Arquivos em data/: macro.json, recentes.json, hoje.json, coleta.json, semanal.json, versao.json, biblioteca/*.json
(publicados no site) e estado.json (interno, só no ramo "dados").

Modos (ROBO_MODO): normal | semanal | teste_telegram.
Chaves (Secrets do GitHub, nunca em arquivo): opcionais TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, ANTHROPIC_API_KEY, YOUTUBE_API_KEY.
"""
import datetime as dt
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import agenda  # noqa: E402
import analise  # noqa: E402
import avisos  # noqa: E402
import biblioteca  # noqa: E402
import calendario  # noqa: E402
import config  # noqa: E402
import conteudo  # noqa: E402
import fontes_macro  # noqa: E402
import resultados  # noqa: E402
import semanal  # noqa: E402
from util import ErroFonte, Rede, agora, gravar, ler, log, sem_acento  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
EXC = (ErroFonte, KeyError, TypeError, ValueError, AttributeError, IndexError)


# ------------------------------------------------------------------ carga
def carregar_fontes(caminho=None):
    caminho = caminho or os.environ.get('ROBO_FONTES') or os.path.join(AQUI, 'fontes.json')
    with open(caminho, encoding='utf-8') as f:
        js = json.load(f)
    return js if isinstance(js, list) else js.get('fontes', [])


def validar_fontes(fontes):
    erros, ids = [], set()
    for i, f in enumerate(fontes):
        if not f.get('id') or f['id'] in ids:
            erros.append('fonte %d: "id" ausente ou repetido' % (i + 1))
        ids.add(f.get('id'))
        if f.get('ativo', True):
            if f.get('metodo') not in conteudo.METODOS:
                erros.append('fonte %s: método "%s" desconhecido' % (f.get('id'), f.get('metodo')))
            if f.get('metodo') not in ('youtube', 'youtube_rss') and not (f.get('url_coleta') or '').startswith('http'):
                erros.append('fonte %s: url_coleta precisa começar com http(s)' % f.get('id'))
            if f.get('metodo') in ('youtube', 'youtube_rss') and not (f.get('canal_id') or 'channel_id=' in (f.get('url_coleta') or '')):
                erros.append('fonte %s: canal do YouTube sem canal_id' % f.get('id'))
            if f.get('metodo') == 'api' and f.get('api') not in conteudo.APIS:
                erros.append('fonte %s: api "%s" desconhecida' % (f.get('id'), f.get('api')))
    return erros


def carregar_oregon(cfg, caminho=None):
    """Ativos, setores e fatores da Oregon para ligar conteúdo à carteira. Fonte: painel/src/data.json (as 15 carteiras,
    com os pesos aprovados) + termos de busca de robo/config.json. Nenhuma posição é presumida: só o que está cadastrado."""
    caminho = caminho or os.environ.get('ROBO_OREGON') or os.path.join(AQUI, '..', 'painel', 'src', 'data.json')
    try:
        with open(caminho, encoding='utf-8') as f:
            d = json.load(f)
    except Exception:
        d = {}
    termos_cfg = {a['id']: a for a in cfg.get('ativos') or []}
    ativos = {}
    for t, a in (d.get('ativos') or {}).items():
        if a.get('status') == 'placeholder':
            continue
        c = termos_cfg.get(t) or {}
        termos = list((c.get('noticias') or {}).get('termos') or [])
        if len(t) >= 3 and t not in termos:
            termos.append(t)
        nome = a.get('nome') or c.get('nome') or t
        if c.get('classe') in ('acao', 'fii') and c.get('nome') and c['nome'] not in termos:
            termos.append(c['nome'])  # empresas e FIIs: o nome também identifica; ETFs só pelo código (não confundir índice com fundo)
        ativos[t] = {'nome': nome, 'termos': termos, 'setor': a.get('setor'), 'pilar': a.get('pilar'), 'classe': a.get('classe'), 'tipo': a.get('tipo'), 'pais': a.get('pais'), 'emissor': a.get('emissor')}
    setores = []
    for g in d.get('grupos') or []:
        termos = []
        for t in g.get('tickers') or []:
            termos += (termos_cfg.get(t) or {}).get('noticias', {}).get('setor') or []
        setores.append({'id': g['id'], 'nome': g.get('nome'), 'tickers': g.get('tickers') or [], 'termos': sorted(set(termos)), 'canal': g.get('canal')})
    carteiras = [{'id': m['id'], 'rotulo': m.get('rotulo'), 'familia': m.get('familia'), 'perfil': m.get('perfil')} for m in d.get('mandatos') or []]
    return {'ativos': ativos, 'setores': setores, 'carteiras': carteiras, 'fonte': 'painel/src/data.json (ativos das 15 carteiras) + robo/config.json (termos de busca)'}


# ------------------------------------------------------------------ macro
def coletar_macro(cfg, rede, hoje, agora_, estado, anterior):
    """Só o que explica notícias e cenários. Cada bloco traz fonte, data e status; falha vira 'indisponível', nunca zero."""
    marca = agora_.isoformat(timespec='minutes')
    ind, fontes, erros = {}, {}, []
    for s in cfg.get('bcb_series') or []:
        try:
            pts = fontes_macro.sgs(rede, s['codigo'], s.get('dias', 30), hoje)
            x = {'nome': s.get('nome', s['id']), 'nivel': pts[-1][1], 'unid': s.get('unid', ''), 'data': pts[-1][0], 'fonte': 'Banco Central · SGS %d' % s['codigo'], 'mensal': bool(s.get('mensal'))}
            if len(pts) >= 2:
                x['anterior'], x['data_anterior'] = pts[-2][1], pts[-2][0]
                x['var'] = round((pts[-1][1] / pts[-2][1] - 1) * 100, 4) if s.get('unid') == 'R$' and pts[-2][1] else round(pts[-1][1] - pts[-2][1], 4)
                x['uvar'] = '%' if s.get('unid') == 'R$' else 'pp'
            ind[s['id']] = x
        except EXC as e:
            erros.append('%s: %s' % (s['id'], e))
            ant = (anterior.get('indicadores') or {}).get(s['id'])
            if ant:
                ind[s['id']] = dict(ant, reaproveitado=True)
    frescas = [k for k, v in ind.items() if not v.get('reaproveitado')]
    fontes['bcb'] = {'ok': bool(frescas) and not erros, 'quando': marca, 'msg': '%d de %d séries' % (len(frescas), len(cfg.get('bcb_series') or [])) + ('; ' + '; '.join(erros[:3]) if erros else '')}
    focus = None
    try:
        focus = fontes_macro.focus(rede, hoje)
        fontes['focus'] = {'ok': True, 'quando': marca, 'msg': ''}
    except EXC as e:
        fontes['focus'] = {'ok': False, 'quando': marca, 'msg': str(e)}
        focus = anterior.get('focus')
        if focus:
            focus = dict(focus, reaproveitado=True)
    curva = {}
    ult = estado.get('tesouro_em')
    if not ult or (agora_ - dt.datetime.fromisoformat(ult)).total_seconds() > 3 * 3600 or not (anterior.get('curva') or {}).get('pre'):
        try:
            tz = fontes_macro.tesouro(rede, cfg['tesouro'], hoje - dt.timedelta(days=20))
            for k in ('pre', 'real'):
                if k in tz and len(tz[k]['pts']) >= 1:
                    pts = tz[k]['pts']
                    curva[k] = {'nome': tz[k]['nome'] + ' (taxa de compra)', 'nivel': pts[-1][1], 'data': pts[-1][0], 'anterior': pts[-2][1] if len(pts) > 1 else None,
                                'var': round(pts[-1][1] - pts[-2][1], 4) if len(pts) > 1 else None, 'unid': '% a.a.', 'fonte': 'Tesouro Transparente'}
            estado['tesouro_em'] = agora_.isoformat()
            fontes['tesouro'] = {'ok': True, 'quando': marca, 'msg': ''}
        except EXC as e:
            fontes['tesouro'] = {'ok': False, 'quando': marca, 'msg': str(e)}
    for k in ('pre', 'real'):
        if k not in curva and (anterior.get('curva') or {}).get(k):
            curva[k] = dict(anterior['curva'][k], reaproveitado=True)
            fontes.setdefault('tesouro', {'ok': True, 'quando': estado.get('tesouro_em'), 'msg': 'reaproveitado da leitura de até 3 horas atrás'})
    try:
        us = fontes_macro.treasury(rede, [hoje.year - 1, hoje.year] if hoje.month == 1 else [hoje.year])
        for k, col, nome in (('ust2', '2 Yr', 'Treasury 2 anos'), ('ust10', '10 Yr', 'Treasury 10 anos')):
            pts = us[col]
            curva[k] = {'nome': nome, 'nivel': pts[-1][1], 'data': pts[-1][0], 'anterior': pts[-2][1] if len(pts) > 1 else None, 'var': round(pts[-1][1] - pts[-2][1], 4) if len(pts) > 1 else None,
                        'unid': '% a.a.', 'fonte': 'Tesouro dos EUA'}
        fontes['treasury'] = {'ok': True, 'quando': marca, 'msg': ''}
    except EXC as e:
        fontes['treasury'] = {'ok': False, 'quando': marca, 'msg': str(e)}
        for k in ('ust2', 'ust10'):
            if (anterior.get('curva') or {}).get(k):
                curva[k] = dict(anterior['curva'][k], reaproveitado=True)
    try:
        ag = agenda.montar(rede, cfg, hoje, agora_, estado)
        fontes['agenda'] = {'ok': not ag['erros'], 'quando': marca, 'msg': '%d eventos nos próximos %d dias' % (len(ag['itens']), ag['dias']) + ('; ' + '; '.join(ag['erros']) if ag['erros'] else '')}
    except Exception as e:
        ag = anterior.get('agenda')
        fontes['agenda'] = {'ok': False, 'quando': marca, 'msg': 'agenda não montada: %s' % type(e).__name__}
    ref = calendario.anterior(hoje, set(cfg.get('feriados_b3') or [])).isoformat()
    for k, v in list(curva.items()):
        v['status'] = 'atualizado' if (v.get('data') or '') >= (ref if k in ('pre', 'real') else calendario.dias_uteis_atras(hoje, 2).isoformat()) else 'desatualizado'
    return {'versao': 3, 'gerado_em': agora_.isoformat(timespec='seconds'), 'indicadores': ind, 'focus': focus, 'curva': curva, 'agenda': ag, 'fontes': fontes, 'erros': erros,
            'nota': 'Indicadores oficiais de referência, atualizados algumas vezes por dia. Não são cotações em tempo real.'}


# ------------------------------------------------------------------ conteúdo
def coletar_conteudo(cfg, fontes_cfg, oregon, rede, hoje, agora_, estado, chaves, log_=log):
    ic = cfg.get('intel') or {}
    marca = agora_.isoformat(timespec='minutes')
    coleta = ler('coleta.json', {}) or {}
    cont = coleta.get('fontes') or {}
    primeira = not biblioteca.meses_disponiveis()
    janela = int(ic.get('janela_inicial_dias', 45)) if primeira else int(ic.get('janela_dias', 10))
    desde = (hoje - dt.timedelta(days=janela)).isoformat()
    bloqueio_nomes = list((cfg.get('noticias') or {}).get('fontes_bloqueadas') or [])
    bloqueio = [sem_acento(b).lower() for b in bloqueio_nomes]
    vistos = biblioteca.ids_vistos(biblioteca.carregar_recentes(hoje, 120))
    for m in biblioteca.meses_disponiveis()[-6:]:
        vistos |= biblioteca.ids_vistos(biblioteca.ler_mes(m).get('itens') or [])
    robots = conteudo.Robots(rede)
    novos, erros, ok, aguardando = [], [], [], []
    for f in fontes_cfg:
        if not f.get('ativo', True):
            continue
        nome = f.get('nome') or f['id']
        if rede.sem_tempo():
            erros.append('%s: prazo da rodada esgotado' % nome)
            biblioteca.registrar(cont, f['id'], nome, erro='prazo da rodada esgotado', marca=marca)
            continue
        if any(b in sem_acento(nome).lower() or b in sem_acento(f.get('organizacao') or '').lower() for b in bloqueio):
            biblioteca.registrar(cont, f['id'], nome, rejeitados={'bloqueada': 1}, marca=marca)
            continue
        try:
            itens, recebidos = conteudo.coletar_fonte(rede, f, agora_, desde, vistos, robots=robots, estado=estado, chaves=chaves, bloqueio=bloqueio_nomes)
        except ErroFonte as e:
            if e.tipo == 'sem_chave':  # fonte cadastrada, à espera de chave: não é falha da rodada
                aguardando.append('%s: %s' % (nome, e.detalhe))
                biblioteca.registrar(cont, f['id'], nome, marca=marca, aguardando=e.detalhe)
                continue
            erros.append(str(e))
            biblioteca.registrar(cont, f['id'], nome, erro=str(e), marca=marca)
            log_('  ! %s' % e)
            continue
        except EXC as e:
            erros.append('%s: %s' % (nome, e))
            biblioteca.registrar(cont, f['id'], nome, erro=str(e), marca=marca)
            log_('  ! %s: %s' % (nome, e))
            continue
        except Exception as e:  # uma fonte com formato inesperado nunca derruba a rodada
            erros.append('%s: erro inesperado (%s)' % (nome, type(e).__name__))
            biblioteca.registrar(cont, f['id'], nome, erro='erro inesperado: ' + type(e).__name__, marca=marca)
            continue
        rej = {}
        ok.append(nome)
        validos = []
        vistos_feed = set()
        for x in itens:
            if not x.get('link'):
                rej['sem_link'] = rej.get('sem_link', 0) + 1
                continue
            if x['id'] in vistos_feed:
                rej['repetido_no_feed'] = rej.get('repetido_no_feed', 0) + 1
                continue
            vistos_feed.add(x['id'])
            if f.get('filtro_titulo') and not re.search(f['filtro_titulo'], x['titulo'], re.I):
                rej['fora_do_filtro'] = rej.get('fora_do_filtro', 0) + 1
                continue
            validos.append(x)
        rej['antigo'] = max(0, recebidos - len(itens))
        ja = sum(1 for x in validos if x['id'] in vistos)
        ineditos = [x for x in validos if x['id'] not in vistos]
        for x in list(ineditos):
            analise.classificar(x, oregon, hoje)
            if f.get('so_oregon') and not x.get('ativos'):  # feed setorial: só manchetes que citem ativo das carteiras
                rej['sem_ativo_oregon'] = rej.get('sem_ativo_oregon', 0) + 1
                ineditos.remove(x)
                continue
            x['analise'] = analise.analisar_regras(x, oregon)
        novos += ineditos
        biblioteca.registrar(cont, f['id'], nome, recebidos=recebidos, rejeitados={k: v for k, v in rej.items() if v}, duplicados=ja, novos=len(ineditos), classificados=len(ineditos), marca=marca)
    res, gravados = biblioteca.incorporar(novos, hoje, agora_)
    for x in gravados:
        c = cont.get(x['fonte_id'])
        if c:
            c['publicados'] += 1
    for c in cont.values():
        c['publicados'] = min(c['publicados'], c['novos'])
    rodada = {'quando': marca, 'fontes_ok': len(ok), 'fontes_erro': len(erros), 'recebidos': sum((c.get('ultima_rodada') or {}).get('recebidos', 0) for c in cont.values()),
              'novos': len(novos), 'publicados': len(gravados), 'duplicados_titulo': res['duplicados_titulo'], 'duplicados_id': res['duplicados_id'], 'janela_dias': janela, 'erros': erros[:20], 'aguardando_chave': aguardando[:30]}
    hist = (coleta.get('rodadas') or [])[-29:] + [rodada]
    coleta = {'gerado_em': marca, 'fontes': cont, 'rodadas': hist, 'ultima': rodada,
              'legenda': {'recebidos': 'itens lidos da fonte na rodada', 'rejeitados': 'descartados e por quê (sem link, repetido no feed, fora do filtro, antigo, bloqueado, robots)',
                          'duplicados': 'já estavam na biblioteca (mesmo link) ou são o mesmo fato de outra fonte', 'novos': 'ineditos classificados', 'publicados': 'gravados na biblioteca e no site'}}
    gravar('coleta.json', coleta)
    return gravados, erros, ok, coleta


def ler_com_ia(cfg, rede, hoje, agora_, estado, chave, oregon, candidatos, log_=log):
    """Leitura por IA dos itens de maior prioridade, dentro do teto diário. Devolve (lidos, msg)."""
    ic = (cfg.get('intel') or {}).get('ia') or {}
    if not ic.get('ativo', False):
        return 0, 'leitura por IA desligada na configuração (intel.ia.ativo = false)'
    if not chave:
        return 0, 'sem ANTHROPIC_API_KEY (leitura por IA desligada; a análise por regras continua)'
    uso = estado.get('ia_uso') or {}
    if uso.get('dia') != hoje.isoformat():
        uso = {'dia': hoje.isoformat(), 'itens': 0, 'entrada': 0, 'saida': 0, 'falhas': 0}
    teto = int(ic.get('max_itens_dia', 12))
    teto_tokens = int(ic.get('max_tokens_dia', 150000))
    lidos, msgs = 0, []
    cand = sorted([x for x in candidatos if not (x.get('analise') or {}).get('profunda') and (x.get('prioridade') or {}).get('nivel') in ('alta', 'media')],
                  key=lambda x: -(x.get('prioridade') or {}).get('pontos', 0))
    for x in cand:
        if uso['itens'] >= teto or (uso['entrada'] + uso['saida']) >= teto_tokens or rede.sem_tempo():
            msgs.append('teto diário atingido (%d itens, %d tokens)' % (uso['itens'], uso['entrada'] + uso['saida']))
            break
        A, u = analise.analisar_ia(rede, x, ic, chave, oregon, cfg.get('ia_modelo', 'claude-haiku-5-5'), cfg.get('ia_versao_api', '2023-06-01'))
        if not A:
            uso['falhas'] += 1
            msgs.append(str(u))
            if 'autenticação' in str(u) or 'chave' in str(u) or uso['falhas'] >= 3:
                break
            continue
        A['lido_em'] = agora_.isoformat(timespec='minutes')
        x['analise'] = analise.combinar(x['analise'], A)
        if A.get('temas_ia'):
            x['temas_ia'] = A['temas_ia']
        biblioteca.atualizar_item(x)
        uso['itens'] += 1
        uso['entrada'] += u['entrada']
        uso['saida'] += u['saida']
        lidos += 1
    estado['ia_uso'] = uso
    hist = estado.get('ia_historico') or []
    if not hist or hist[-1].get('dia') != hoje.isoformat():
        hist.append(dict(uso))
    else:
        hist[-1] = dict(uso)
    estado['ia_historico'] = hist[-60:]
    return lidos, ('%d itens lidos hoje, %d tokens de entrada e %d de saída' % (uso['itens'], uso['entrada'], uso['saida'])) + ('; ' + '; '.join(dict.fromkeys(msgs)) if msgs else '')


# ------------------------------------------------------------------ rodada
def gravar_versao(agora_, macro, coleta, hoje_js, sem_js, estado):
    gravar('versao.json', {'versao': 3, 'produto': 'Oregon Intelligence', 'gerado_em': agora_.isoformat(timespec='seconds'), 'macro_em': (macro or {}).get('gerado_em'),
                           'coleta_em': (coleta or {}).get('gerado_em'), 'hoje_em': (hoje_js or {}).get('gerado_em'), 'semanal_em': (sem_js or {}).get('gerado_em'),
                           'meses': biblioteca.meses_disponiveis(), 'ia': bool((estado.get('ia_uso') or {}).get('itens'))})


def saidas_github(nivel, motivos, resumo_md, pular=False):
    caminho = os.environ.get('GITHUB_STEP_SUMMARY')
    if caminho:
        with open(caminho, 'a', encoding='utf-8') as f:
            f.write(resumo_md)
    saida = os.environ.get('GITHUB_OUTPUT')
    if saida:
        with open(saida, 'a', encoding='utf-8') as f:
            f.write('pular=%s\nstatus=%s\nmotivos=%s\n' % ('true' if pular else 'false', nivel, ' | '.join(motivos)[:900].replace('\n', ' ')))


def main():
    agora_ = agora()
    hoje = agora_.date()
    modo = os.environ.get('ROBO_MODO', 'normal')
    manual = os.environ.get('ROBO_MANUAL', 'false').lower() == 'true'
    log('Oregon Intelligence · %s · modo %s%s' % (agora_.strftime('%d/%m/%Y %H:%M'), modo, ' (manual)' if manual else ''))
    try:
        cfg = config.carregar(os.environ.get('ROBO_CONFIG') or os.path.join(AQUI, 'config.json'))
        erros_cfg = config.validar(cfg)
        fontes_cfg = carregar_fontes()
        erros_cfg += validar_fontes(fontes_cfg)
    except Exception as e:
        erros_cfg, cfg, fontes_cfg = ['não consegui ler a configuração: %s' % type(e).__name__], None, []
    if erros_cfg:
        for e in erros_cfg:
            log('  ! configuração: ' + e)
        saidas_github('critico', ['configuração inválida: ' + '; '.join(erros_cfg[:3])], '## ❌ Oregon Intelligence · configuração inválida\n\n' + '\n'.join('- ' + e for e in erros_cfg), pular=True)
        return 1  # a rodada falha visivelmente; nada é publicado e o site fica como estava
    chaves = dict(config.chaves(), youtube=os.environ.get('YOUTUBE_API_KEY') or None)
    estado = ler('estado.json', {}) or {}
    anterior = ler('macro.json', {}) or {}
    oregon = carregar_oregon(cfg)
    log('  Oregon: %d ativos, %d setores, %d carteiras' % (len(oregon['ativos']), len(oregon['setores']), len(oregon['carteiras'])))
    rede = Rede(prazo_seg=int(cfg.get('prazo_rodada_min', 15)) * 60)

    # 1. macro
    macro = coletar_macro(cfg, rede, hoje, agora_, estado, anterior)
    gravar('macro.json', macro)
    log('  macro: ' + ', '.join('%s %s' % (k, 'ok' if v.get('ok') else 'FALHOU') for k, v in macro['fontes'].items()))

    # 2. conteúdo
    rede_c = Rede(prazo_seg=int((cfg.get('intel') or {}).get('prazo_min', 12)) * 60)
    novos, erros_c, ok_c, coleta = coletar_conteudo(cfg, fontes_cfg, oregon, rede_c, hoje, agora_, estado, chaves)
    log('  conteúdo: %d fontes ok, %d com falha, %d itens novos' % (len(ok_c), len(erros_c), len(novos)))

    # 3. IA opcional
    recentes = [x for x in biblioteca.carregar_recentes(hoje, 14) if not x.get('agrupado_em')]
    n_ia, msg_ia = ler_com_ia(cfg, rede_c, hoje, agora_, estado, chaves.get('anthropic'), oregon, recentes)
    log('  IA: ' + msg_ia)
    if n_ia:
        recentes = [x for x in biblioteca.carregar_recentes(hoje, 14) if not x.get('agrupado_em')]

    # 4 e 5. índice, recentes, briefing e semanal: um erro aqui nunca impede a publicação do que já foi coletado
    hoje_js, sem_arq, idx = {}, ler('semanal.json', {}) or {}, {'total': 0, 'meses': []}
    try:
        # 4. índice, recentes, briefing
        idx = biblioteca.reindexar(agora_)
        recentes = biblioteca.publicar_recentes(hoje, agora_, dias=int((cfg.get('intel') or {}).get('recentes_dias', 14)))
        hoje_js = semanal.briefing(recentes, macro, hoje, agora_, estado)
        gravar('hoje.json', hoje_js)
        log('  briefing: %d prioridades (janela de %s), %d itens recentes, %d na biblioteca' % (len(hoje_js['prioridades']), hoje_js['janela'], len(recentes), idx['total']))

        # 5. semanal (sábado, modo manual "semanal", ou semana ainda sem resumo)
        sem_arq = ler('semanal.json', {}) or {}
        semanas = {s['semana']: s for s in sem_arq.get('semanas') or []}
        ref = hoje if (modo == 'semanal' or hoje.weekday() >= 5) else hoje - dt.timedelta(days=7)
        chave_sem = semanal.semana_iso(ref)
        if modo == 'semanal' or (hoje.weekday() == 5 and chave_sem not in semanas) or (chave_sem not in semanas and hoje.weekday() < 5):
            itens_sem = []
            for m in sorted({semanal.limites_semana(ref)[0].strftime('%Y-%m'), semanal.limites_semana(ref)[1].strftime('%Y-%m')}):
                itens_sem += biblioteca.ler_mes(m).get('itens') or []
            res_sem = semanal.resumo_semana(itens_sem, ref, agora_)
            if res_sem['n_itens'] or modo == 'semanal':
                semanas[chave_sem] = res_sem
                lista = sorted(semanas.values(), key=lambda s: s['semana'], reverse=True)[:26]
                sem_arq = {'gerado_em': agora_.isoformat(timespec='minutes'), 'semanas': lista}
                gravar('semanal.json', sem_arq)
                log('  semanal: %s com %d itens' % (chave_sem, res_sem['n_itens']))


    except Exception as e:  # pragma: no cover - proteção
        log('  ! briefing/semanal não montado: %s' % type(e).__name__)
        motivos_extra = ['briefing não montado: %s' % type(e).__name__]
    else:
        motivos_extra = []
    # 5b. resultados trimestrais (CVM, dados abertos) para as fichas da seção Oregon: na rodada da noite ou à mão, a cada N dias.
    # Um arquivo que falhar não apaga o que já estava lido.
    rc = cfg.get('resultados') or {}
    ult_r = estado.get('resultados_em') or ''
    res_msg = None
    if rc.get('ativo', True) and (manual or agora_.hour >= 21) and (manual or not ult_r or ult_r[:10] <= (hoje - dt.timedelta(days=int(rc.get('intervalo_dias', 3)))).isoformat()):
        try:
            rede_cvm = Rede(prazo_seg=int(rc.get('prazo_min', 8)) * 60)
            res, erros_r = resultados.coletar(rede_cvm, cfg, hoje, log=log)
            ant_r = ler('resultados.json') or {}
            emp = resultados.mesclar(ant_r.get('empresas'), res['empresas'])
            if emp:
                gravar('resultados.json', {'gerado_em': agora_.isoformat(timespec='minutes'), 'empresas': emp, 'fora': res['fora'], 'arquivos': res['arquivos'], 'erros': erros_r,
                                           'fonte': 'CVM · Portal Dados Abertos (ITR e DFP)', 'licenca': 'ODbL · crédito à CVM',
                                           'nota': 'Valores em reais, como informados no formulário (DRE consolidada, versão mais recente). Trimestre = linha de três meses; o quarto trimestre não é calculado.'})
            if not erros_r:
                estado['resultados_em'] = agora_.isoformat(timespec='minutes')
            res_msg = '%d empresas lidas' % len(res['empresas']) + ('; falhas: ' + '; '.join(erros_r[:2]) if erros_r else '')
        except Exception as e:
            res_msg = 'resultados não lidos: %s' % (e if isinstance(e, ErroFonte) else type(e).__name__)
        log('  resultados CVM: ' + res_msg)

    # 6. Telegram (opcional): digesto diário com as prioridades, uma vez por dia
    tem_tg = bool(os.environ.get('TELEGRAM_TOKEN'))
    tg = {'ok': None, 'msg': 'TELEGRAM_TOKEN não configurado'}
    ic = cfg.get('intel') or {}
    if tem_tg and (modo == 'teste_telegram' or (ic.get('telegram_digesto', True) and agora_.strftime('%H:%M') >= ic.get('telegram_hora', '07:30') and estado.get('digesto') != hoje.isoformat())):
        por_id = {x['id']: x for x in recentes}
        linhas = ['<b>Oregon Intelligence · briefing %s</b>' % agora_.strftime('%d/%m')]
        for p in (hoje_js.get('prioridades') or [])[:6]:
            x = por_id.get(p['id'])
            if x:
                linhas.append('• <a href="%s">%s</a> — %s' % (x.get('link'), html.escape(x.get('titulo') or ''), html.escape(x.get('organizacao') or x.get('fonte') or '')))
        if hoje_js.get('estudo'):
            linhas.append('<i>Estudo do dia:</i> ' + html.escape(hoje_js['estudo'][0]))
        okk, m = avisos.enviar('\n'.join(linhas))
        tg = {'ok': okk, 'msg': m or 'briefing enviado'}
        if okk and modo != 'teste_telegram':
            estado['digesto'] = hoje.isoformat()

    # 7. avaliação e gravação
    motivos, nivel = list(motivos_extra), 'parcial' if motivos_extra else 'completo'
    for k, v in macro['fontes'].items():
        if v.get('ok') is False:
            motivos.append('macro %s: %s' % (k, (v.get('msg') or '')[:120]))
            nivel = 'parcial'
    if erros_c:
        motivos.append('%d fonte(s) de conteúdo com falha: %s' % (len(erros_c), '; '.join(erros_c[:3])[:300]))
        nivel = 'parcial'
    if not ok_c and fontes_cfg and not idx['total']:
        motivos.append('nenhuma fonte de conteúdo respondeu e a biblioteca está vazia')
        nivel = 'critico'
    if modo == 'teste_telegram' and not tg['ok']:
        motivos.insert(0, 'teste do Telegram falhou: ' + tg['msg'])
        nivel = 'critico'
    gravar_versao(agora_, macro, coleta, hoje_js, sem_arq, estado)
    gravar('status.json', {'gerado_em': agora_.isoformat(timespec='seconds'), 'status': {'nivel': nivel, 'motivos': motivos}, 'macro': macro['fontes'], 'conteudo': coleta.get('ultima'),
                           'ia': {'ok': (n_ia > 0) if chaves.get('anthropic') else None, 'msg': msg_ia}, 'telegram': tg if tem_tg else None, 'resultados': res_msg, 'rede': rede_c.resumo()})
    gravar('estado.json', estado)
    md = ['## %s Oregon Intelligence · rodada %s' % ({'completo': '✅', 'parcial': '⚠️', 'critico': '❌'}[nivel], nivel.upper()), '', 'Gerado em %s.' % agora_.isoformat(timespec='minutes')]
    md += ['- ' + m for m in motivos]
    u = coleta.get('ultima') or {}
    md += ['', '### Conteúdo', '', '| Fontes ok | Com falha | Recebidos | Novos | Publicados | Mesmo fato (título) | Já na biblioteca |', '|---|---|---|---|---|---|---|',
           '| %s | %s | %s | %s | %s | %s | %s |' % (u.get('fontes_ok'), u.get('fontes_erro'), u.get('recebidos'), u.get('novos'), u.get('publicados'), u.get('duplicados_titulo'), u.get('duplicados_id')),
           '', 'Biblioteca: %d itens em %d mês(es). IA: %s.' % (idx['total'], len(idx['meses']), msg_ia), '']
    md += ['| Fonte | Recebidos | Rejeitados | Já vistos | Novos | Erro |', '|---|---|---|---|---|---|']
    for fid, c in sorted(coleta.get('fontes', {}).items(), key=lambda kv: kv[1].get('nome') or kv[0]):
        r = c.get('ultima_rodada') or {}
        md.append('| %s | %s | %s | %s | %s | %s |' % (c.get('nome'), r.get('recebidos', ''), r.get('rejeitados', ''), r.get('duplicados', ''), r.get('novos', ''), (r.get('erro') or '')[:80]))
    saidas_github(nivel, motivos, '\n'.join(md) + '\n')
    log('  rodada: %s%s' % (nivel.upper(), (' · ' + ' | '.join(motivos[:3])) if motivos else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
