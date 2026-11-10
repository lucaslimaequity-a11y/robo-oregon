#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Oregon Intelligence · robô de conteúdo (versão 3)

Roda no GitHub Actions (.github/workflows/robo.yml), sete dias por semana, e também à mão. Em cada rodada:
  1. macro oficial que explica as notícias: Selic/CDI, IPCA, Focus, Tesouro (pré e IPCA+), Treasuries, PTAX e a
     agenda de divulgações (Banco Central, IBGE, Tesouro, Tesouro dos EUA). Sem cotação de ação e sem câmbio ao vivo;
  2. conteúdo das fontes cadastradas em robo/fontes.json (gestoras, instituições, canais oficiais): RSS, APIs públicas,
     páginas e PDFs públicos, respeitando robots.txt e sem contornar bloqueios;
  3. classificação (temas, regiões, ativos e setores da Oregon, fatores), vínculo com cada ativo (direto ou menção), prioridade e leitura curta por regras;
     com ANTHROPIC_API_KEY e intel.ia.ativo, leitura por IA dos itens prioritários dentro de um teto diário;
  4. biblioteca persistente por mês (nada é apagado), deduplicação, contadores por fonte e briefing do dia;
  5. aos sábados (ou em modo "semanal"), o resumo da semana.
Arquivos em data/: macro.json, recentes.json, hoje.json, coleta.json, semanal.json, versao.json, biblioteca/*.json (meses, índice, opinioes.json e, desde a v4.0.1, assuntos.json)
(publicados no site) e estado.json (interno, só no ramo "dados").

Modos (ROBO_MODO): normal | semanal | teste_telegram.
Chaves (Secrets do GitHub, nunca em arquivo): opcionais TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, ANTHROPIC_API_KEY, YOUTUBE_API_KEY.
"""
import datetime as dt
import html
import hashlib
import json
import os
import re
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import agenda  # noqa: E402
import analise  # noqa: E402
import avisos  # noqa: E402
import biblioteca  # noqa: E402
import calendario  # noqa: E402
import config  # noqa: E402
import conteudo  # noqa: E402
import fontes_macro  # noqa: E402
import noticias  # noqa: E402  (desambiguação por empresa, reaproveitada da v2)
import casas  # noqa: E402
import estante  # noqa: E402  (v3.5 · acervo permanente)
import cartas  # noqa: E402  (v3.6 · termômetro das cartas)
import fundos  # noqa: E402  (v3.6 · quem tem a ação)
import fluxo  # noqa: E402  (v3.8 · fluxo dos fundos)
import ingles  # noqa: E402  (v3.9 · inglês do mercado: frase do dia no Telegram)
import mercado_hoje  # noqa: E402  (v3.10 · macro do Brasil no Telegram)
import corrente  # noqa: E402  (v3.11 · corrente de rodadas: a próxima coleta prevista vai no versao.json)
import proventos  # noqa: E402  (v3.6 · agenda de proventos)
import pesquisas  # noqa: E402
import resultados  # noqa: E402
import semanal  # noqa: E402
import assuntos  # noqa: E402  (v4.0.1 · assuntos do momento no Hoje)
from util import ErroFonte, Rede, agora, dados_dir, gravar, ler, log, sem_acento  # noqa: E402
from util import num as util_num  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
# minutos entre leituras de uma mesma fonte (0 = toda rodada). Imprensa e instituições mudam ao longo do dia;
# páginas de cartas e sitemaps mudam pouco e não precisam ser lidas a cada 30 minutos.
INTERVALO_PADRAO = {'rss': 0, 'atom': 0, 'api': 0, 'pagina': 360, 'pagina_html': 360, 'pagina_pdf': 360, 'sitemap': 360, 'arquivo_fixo': 720, 'youtube': 180, 'youtube_rss': 180}
EXC = (ErroFonte, KeyError, TypeError, ValueError, AttributeError, IndexError)


# ------------------------------------------------------------------ carga
def _slug(t):
    return re.sub(r'[^a-z0-9]+', '-', sem_acento(t).lower()).strip('-')[:40]


def antigo_sem_data(x, hoje, primeira_leitura=False, lote_arquivo=False):
    """Item de página sem data de publicação que é acervo (consultável na Biblioteca, fora do feed de novidades), e por quê.
    - primeira leitura da página: tudo o que já estava lá;
    - mês de referência no título ou no link ("Carta-K10_junho-2023.pdf", "/2023/julho23.pdf") anterior aos últimos 60 dias;
    - lote: mais de 3 itens sem data numa fonte já lida, ou link no fim da listagem (posição > 5), típico de arquivo antigo."""
    if primeira_leitura:
        return 'primeira leitura da página'
    ref = x.get('referencia') or conteudo.referencia(x.get('titulo') or '') or conteudo.referencia((x.get('link') or '').rsplit('/', 1)[-1]) or conteudo.referencia(x.get('link') or '')
    if ref:
        x['referencia'] = ref
        if ref < (hoje - dt.timedelta(days=60)).isoformat()[:7]:
            return 'mês de referência %s/%s' % (ref[5:7], ref[:4])
    if lote_arquivo:
        return 'chegou em lote, sem data, numa página já lida'
    if (x.get('posicao_pagina') or 0) > 5:
        return 'link no fim da listagem da página, sem data'
    return None


def no_pregao(quando):
    """v4.0.1 · horário do pregão de juros e ações na B3 (dias úteis, 9h às 19h de Brasília), para as buscas que ficam mais
    frequentes nesse horário. Feriado conta como dia útil: no máximo algumas buscas a mais."""
    q = quando.astimezone(dt.timezone(dt.timedelta(hours=-3))) if quando.tzinfo else quando
    return q.weekday() < 5 and 9 <= q.hour < 19


def fontes_de_busca(cfg):
    """Buscas de notícias geradas da configuração (não ficam em fontes.json):
    - uma por empresa/FII das carteiras (termos de noticias.buscas, ou o primeiro termo do ativo);
    - uma por setor/cadeia ligada às empresas (noticias.buscas_setor);
    - uma por tema de ETF (noticias.etfs[].busca), em inglês para os ETFs globais;
    - documentos oficiais das companhias na CVM (fato relevante, comunicado ao mercado), por CNPJ.
    O buscador é o RSS público do Bing Notícias, que o robots.txt permite. O do Google Notícias é vedado a robôs."""
    n = cfg.get('noticias') or {}
    b = n.get('busca') or {}
    out = []
    if b.get('ativo', True) and b.get('url'):
        base = {'categoria': 'veiculo', 'tipo': 'noticia', 'metodo': 'rss', 'guardar_resumo': False, 'agregador': True, 'filtro_tema': False,
                'via': b.get('provedor') or 'Bing Notícias', 'organizacao': b.get('provedor') or 'Bing Notícias', 'intervalo_min': int(b.get('intervalo_min', 120)),
                'busca': True, 'maximo': int(b.get('por_busca', 15)), 'verificar_na_rodada': True}

        def url(q, mkt):
            return b['url'].replace('{q}', urllib.parse.quote_plus(q)).replace('{mkt}', mkt)
        for a in cfg.get('ativos') or []:
            e = a.get('noticias') or {}
            if not a.get('ativo', True) or not e.get('termos'):
                continue
            consultas = e.get('buscas') or [e['termos'][0].lstrip('=')]
            for i, q in enumerate(consultas):
                out.append(dict(base, id='busca-%s%s' % (a['id'].lower(), '-%d' % (i + 1) if i else ''), nome='Busca · %s (%s)' % (q, a['id']), pais='Brasil', idioma='pt',
                                url_fonte=url(q, 'pt-BR').replace('&format=rss', ''), url_coleta=url(q, 'pt-BR'), busca_ativo=a['id'], consulta=q))
            # opiniões de casas sobre o ativo (recomendação, preço-alvo, cobertura): consulta própria, que a busca geral nem sempre traz
            modelo = b.get('consulta_opiniao')
            if modelo and a.get('classe') in ('acao', 'fii') and e.get('opinioes', True):
                nome_q = e.get('nome_busca') or next((t.lstrip('=') for t in e['termos'] if not re.match(r'^=?[A-Z]{4}\d{1,2}$', t)), a['id'])
                q = modelo.replace('{nome}', nome_q).replace('{ticker}', a['id'])
                out.append(dict(base, id='busca-%s-opiniao' % a['id'].lower(), nome='Busca de opiniões · %s (%s)' % (nome_q, a['id']), pais='Brasil', idioma='pt',
                                url_fonte=url(q, 'pt-BR').replace('&format=rss', ''), url_coleta=url(q, 'pt-BR'), busca_ativo=a['id'], consulta=q,
                                intervalo_min=int(b.get('intervalo_opiniao_min', 360))))
        for st in n.get('buscas_setor') or []:
            if not st.get('ativo', True):
                continue
            mkt = st.get('mkt', 'pt-BR')
            out.append(dict(base, id='busca-setor-' + _slug(st['nome']), nome=('Lente global · ' if st.get('lente') else 'Busca setorial · ') + st['nome'], pais='Brasil' if mkt == 'pt-BR' else 'Global', idioma='pt' if mkt == 'pt-BR' else 'en',
                            url_fonte=url(st['consulta'], mkt).replace('&format=rss', ''), url_coleta=url(st['consulta'], mkt), setor_de=list(st.get('ativos') or []),
                            termos_exigidos=list(st.get('termos') or []), consulta=st['consulta'], setor_nome=st['nome'], lente=bool(st.get('lente')),
                            industria=st.get('industria'), intervalo_min=int(st.get('intervalo_min', base['intervalo_min']))))
        for te in n.get('etfs') or []:
            if not te.get('ativo', True) or not te.get('busca'):
                continue
            mkt = te.get('mkt', 'pt-BR')
            out.append(dict(base, id='busca-etf-' + _slug(te['tema']), nome='Busca do tema · ' + te['tema'], pais='Brasil' if mkt == 'pt-BR' else 'Global', idioma='pt' if mkt == 'pt-BR' else 'en',
                            url_fonte=url(te['busca'], mkt).replace('&format=rss', ''), url_coleta=url(te['busca'], mkt), etfs=list(te.get('etfs') or []),
                            termos_exigidos=list(te.get('termos_busca') or []), consulta=te['busca'], tema_etf=te['tema'],
                            # v4.0.1 · ETFs de renda fixa do Brasil: intervalo próprio no pregão e fora do teto das buscas por empresa
                            intervalo_min=int(te.get('intervalo_min') or base['intervalo_min']), intervalo_pregao_min=te.get('intervalo_pregao_min'),
                            fora_do_teto=bool(te.get('fora_do_teto'))))
        # v3.10 · macro do Brasil: Ibovespa, dólar, juros, inflação, fiscal e agenda do dia (traz Valor, CNN, Estadão e outros
        # que não têm feed aberto); só entra o que o robô reconhece como macro do Brasil (exigir_macro)
        for mc in n.get('buscas_macro') or []:
            if not mc.get('ativo', True) or not mc.get('consulta'):
                continue
            out.append(dict(base, id='busca-macro-' + _slug(mc['tema']), nome='Busca macro Brasil · ' + mc['tema'], pais='Brasil', idioma='pt',
                            url_fonte=url(mc['consulta'], 'pt-BR').replace('&format=rss', ''), url_coleta=url(mc['consulta'], 'pt-BR'), consulta=mc['consulta'],
                            busca_macro=True, exigir_macro=True, intervalo_min=int(mc.get('intervalo_min', 60))))
    cv = n.get('cvm_ipe') or {}
    if n.get('cvm') and cv.get('ativo', True):
        emp = {a['cnpj']: [a['id'], a.get('cvm_nome') or ''] for a in cfg.get('ativos') or [] if a.get('ativo', True) and a.get('cnpj')}
        if emp:
            out.append({'id': 'cvm-ipe', 'nome': 'CVM — fatos relevantes e comunicados das empresas', 'organizacao': 'CVM (documentos entregues pelas companhias)',
                        'categoria': 'oficial_empresa', 'pais': 'Brasil', 'idioma': 'pt', 'tipo': 'documento_oficial', 'metodo': 'api', 'api': 'cvm_ipe',
                        'url_fonte': 'https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe', 'url_coleta': 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS/ipe_cia_aberta_{ano}.zip',
                        'empresas': emp, 'intervalo_min': int(cv.get('intervalo_min', 180)), 'verificar_na_rodada': True, 'guardar_resumo': False})
    return out


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
        ativos[t] = {'nome': nome, 'termos': termos, 'excluir': list((c.get('noticias') or {}).get('excluir') or []), 'setor': a.get('setor'), 'pilar': a.get('pilar'), 'classe': a.get('classe'), 'tipo': a.get('tipo'), 'pais': a.get('pais'), 'emissor': a.get('emissor'),
                     'fator': ((d.get('sens') or {}).get(t) or {}).get('f')}  # fator da premissa interna de sensibilidade (pesquisas ativo × fator)
    # v3.5 · carteiras VG VIP (painel/src/vip.json). Ativo que já é da Oregon só ganha a marca das carteiras VIP; o que é só
    # da VIP entra com `so_vip` e o item guarda esse vínculo à parte (ativos_vip), para a seção Oregon nunca misturar as duas.
    try:
        with open(os.path.join(os.path.dirname(caminho), 'vip.json'), encoding='utf-8') as f:
            vip = json.load(f)
    except Exception:
        vip = {}
    for cart in vip.get('carteiras') or []:
        for a in cart.get('ativos') or []:
            t = a.get('noticias_de') or a.get('ticker')
            if not t:
                continue
            if t in ativos:
                if cart['id'] not in ativos[t].setdefault('carteiras_vip', []):
                    ativos[t]['carteiras_vip'].append(cart['id'])
                continue
            c = termos_cfg.get(t) or {}
            termos = list((c.get('noticias') or {}).get('termos') or [])
            if len(t) >= 3 and t not in termos:
                termos.append(t)
            if c.get('classe') in ('acao', 'fii') and c.get('nome') and c['nome'] not in termos:
                termos.append(c['nome'])
            ativos[t] = {'nome': a.get('empresa') or c.get('nome') or t, 'termos': termos, 'excluir': list((c.get('noticias') or {}).get('excluir') or []), 'setor': a.get('setor'),
                         'pilar': None, 'classe': 'Ações', 'tipo': 'Ação', 'pais': 'Brasil', 'emissor': a.get('empresa'), 'fator': None, 'so_vip': True, 'carteiras_vip': [cart['id']]}
    setores = []
    for g in d.get('grupos') or []:
        termos = []
        for t in g.get('tickers') or []:
            termos += (termos_cfg.get(t) or {}).get('noticias', {}).get('setor') or []
        setores.append({'id': g['id'], 'nome': g.get('nome'), 'tickers': g.get('tickers') or [], 'termos': sorted(set(termos)), 'canal': g.get('canal')})
    carteiras = [{'id': m['id'], 'rotulo': m.get('rotulo'), 'familia': m.get('familia'), 'perfil': m.get('perfil')} for m in d.get('mandatos') or []]
    # temas dos ETFs (índice, estratégia, exposição): termos explícitos de robo/config.json (noticias.etfs[].termos)
    temas_etf = []
    for e in (cfg.get('noticias') or {}).get('etfs') or []:
        if not e.get('ativo', True):
            continue
        termos = list(e.get('termos') or re.findall(r'"([^"]+)"', e.get('consulta') or ''))
        etfs = [t for t in e.get('etfs') or [] if t in ativos]
        if termos and etfs:
            temas_etf.append({'tema': e.get('tema'), 'termos': termos, 'etfs': etfs})
    return {'ativos': ativos, 'setores': setores, 'carteiras': carteiras, 'temas_etf': temas_etf, 'fonte': 'painel/src/data.json (ativos das 15 carteiras) + painel/src/vip.json (carteiras VG VIP) + robo/config.json (termos de busca)'}


# ------------------------------------------------------------------ macro
def coletar_macro(cfg, rede, hoje, agora_, estado, anterior):
    """Só o que explica notícias e cenários. Cada bloco traz fonte, data e status; falha vira 'indisponível', nunca zero."""
    marca = agora_.isoformat(timespec='minutes')
    ind, fontes, erros = {}, {}, []
    focus, curva = None, {}
    if not (cfg.get('intel') or {}).get('indicadores_macro', False):
        # indicadores (Selic, IPCA, dólar, curvas, Treasuries) desligados: o painel não os mostra e a falha deles não pode marcar a rodada
        try:
            ag = agenda.montar(rede, cfg, hoje, agora_, estado)
            fontes['agenda'] = {'ok': not ag['erros'], 'quando': marca, 'msg': '%d eventos nos próximos %d dias' % (len(ag['itens']), ag['dias']) + ('; ' + '; '.join(ag['erros']) if ag['erros'] else '')}
        except Exception as e:
            ag = anterior.get('agenda')
            fontes['agenda'] = {'ok': False, 'quando': marca, 'msg': 'agenda não montada: %s' % type(e).__name__}
        return {'versao': 3, 'gerado_em': agora_.isoformat(timespec='seconds'), 'indicadores': {}, 'focus': None, 'curva': {}, 'agenda': ag, 'fontes': fontes, 'erros': [],
                'nota': 'Só a agenda de divulgações oficiais. Indicadores de mercado desligados (intel.indicadores_macro = false).'}
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
    novos, erros, ok, aguardando, a_validar, adiadas, pausadas = [], [], [], [], [], [], []
    leituras = estado.setdefault('ultima_leitura', {})
    lidas_antes = estado.setdefault('fontes_lidas', {})
    n_cfg = cfg.get('noticias') or {}
    manual = bool(os.environ.get('ROBO_TUDO') or os.environ.get('ROBO_MANUAL', '').lower() == 'true')
    # buscas: as mais atrasadas primeiro, no máximo N por rodada (as demais ficam para a próxima, meia hora depois)
    buscas = sorted([f for f in fontes_cfg if f.get('busca')], key=lambda f: (0 if (f.get('busca_macro') or f.get('fora_do_teto')) else 1, leituras.get(f['id']) or ''))  # v3.10: macro do Brasil primeiro (v4.0.1: e os temas de renda fixa)
    fontes_cfg = [f for f in fontes_cfg if not f.get('busca')] + buscas
    teto_busca, n_busca = int((n_cfg.get('busca') or {}).get('max_por_rodada', 14)), 0
    empresas = {a['id']: (a.get('noticias') or {}) for a in cfg.get('ativos') or []}
    confiaveis = [sem_acento(v).lower() for v in n_cfg.get('veiculos_confiaveis') or []]
    sinalizadas = {sem_acento(k).lower(): v for k, v in (n_cfg.get('fontes_sinalizadas') or {}).items()}
    for f in fontes_cfg:
        if not f.get('ativo', True):
            continue
        nome = f.get('nome') or f['id']
        # intervalo por fonte: imprensa e instituições a cada rodada; páginas de gestoras e canais, com mais espaço
        intervalo = int(f.get('intervalo_min', INTERVALO_PADRAO.get(f.get('metodo'), 0)))
        if f.get('intervalo_pregao_min') and no_pregao(agora_):  # v4.0.1 · ex.: tema dos ETFs de renda fixa a cada hora no pregão
            intervalo = int(f['intervalo_pregao_min'])
        ult = leituras.get(f['id'])
        if intervalo and ult and not manual:  # execução manual lê tudo
            try:
                if (agora_ - dt.datetime.fromisoformat(ult)).total_seconds() < (intervalo - 5) * 60:
                    adiadas.append(f['id'])
                    continue
            except ValueError:
                pass
        # v3.8 · fonte que falhou várias vezes seguidas (bloqueio 403, tempo esgotado, endereço sumido) entra em pausa:
        # uma tentativa por dia, sem gastar o prazo da rodada nem aparecer como falha a cada 30 minutos. Nada é contornado.
        c0 = cont.get(f['id']) or {}
        if not manual and biblioteca.falhas_seguidas(c0) >= int(ic.get('pausa_falhas', 3)) and c0.get('ultimo_erro_em'):
            try:
                if (agora_ - dt.datetime.fromisoformat(c0['ultimo_erro_em'])).total_seconds() < float(ic.get('pausa_horas', 24)) * 3600:
                    c0['pausa'] = True
                    adiadas.append(f['id'])
                    pausadas.append(nome)
                    continue
            except ValueError:
                pass
        if f.get('busca') and not f.get('busca_macro') and not f.get('fora_do_teto') and not manual:  # v3.10: as poucas buscas de macro (v4.0.1: e de renda fixa) não gastam o teto das buscas por empresa
            if n_busca >= teto_busca:
                adiadas.append(f['id'])
                continue
            n_busca += 1
        if rede.sem_tempo():
            erros.append('%s: prazo da rodada esgotado' % nome)
            biblioteca.registrar(cont, f['id'], nome, erro='prazo da rodada esgotado', marca=marca)
            continue
        if not f.get('agregador') and any(b in sem_acento(nome).lower() or b in sem_acento(f.get('organizacao') or '').lower() for b in bloqueio):
            biblioteca.registrar(cont, f['id'], nome, rejeitados={'bloqueada': 1}, marca=marca)
            continue
        try:
            itens, recebidos = conteudo.coletar_fonte(rede, f, agora_, desde, vistos, robots=robots, estado=estado, chaves=chaves, bloqueio=bloqueio_nomes)
        except ErroFonte as e:
            if e.tipo == 'sem_chave':  # fonte cadastrada, à espera de chave: não é falha da rodada
                aguardando.append('%s: %s' % (nome, e.detalhe))
                biblioteca.registrar(cont, f['id'], nome, marca=marca, aguardando=e.detalhe)
                continue
            leituras[f['id']] = marca
            if f.get('verificar_na_rodada') and not lidas_antes.get(f['id']):
                # fonte nova, ainda não confirmada no ar: a falha aparece como "a validar", sem marcar a rodada como parcial
                a_validar.append(str(e))
                biblioteca.registrar(cont, f['id'], nome, erro=str(e), marca=marca)
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
        leituras[f['id']] = marca
        primeira_leitura = not lidas_antes.get(f['id'])
        lidas_antes[f['id']] = lidas_antes.get(f['id']) or marca
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
            if f.get('busca_ativo'):
                # a busca devolve homônimos (estação Chácara Klabin, Guiné Equatorial): a manchete precisa citar a empresa pelos termos dela
                if not noticias.pertence(x['titulo'], empresas.get(f['busca_ativo']) or {}):
                    rej['outro_assunto'] = rej.get('outro_assunto', 0) + 1
                    continue
                x['ativos'] = [f['busca_ativo']]
            if f.get('termos_exigidos') and not any(sem_acento(t).lower() in sem_acento(x['titulo']).lower() for t in f['termos_exigidos']):
                rej['outro_assunto'] = rej.get('outro_assunto', 0) + 1
                continue
            if f.get('etfs'):
                x['etfs_tema'] = list(f['etfs'])
                x['tema_etf'] = f.get('tema_etf')
            if f.get('industria'):
                x['industria'] = f['industria']  # v3.6 · indústria de wealth e consultorias (aba própria em Mundo e Estratégia)
                if f.get('secao_industria'):
                    x['industria_secao'] = f['secao_industria']
            if f.get('setor_de'):
                # v3.6 · ativo só da VG VIP fica em setor_de_vip, para a seção Oregon nunca mostrar o setor de um ativo VIP
                at_or = (oregon or {}).get('ativos') or {}
                x['setor_de'] = [t for t in f['setor_de'] if not (at_or.get(t) or {}).get('so_vip')]
                vip_s = [t for t in f['setor_de'] if (at_or.get(t) or {}).get('so_vip')]
                if vip_s:
                    x['setor_de_vip'] = vip_s
                if not x['setor_de']:
                    x.pop('setor_de')
                x['setor_nome'] = f.get('setor_nome')
                if f.get('lente'):
                    x['lente'] = True  # lente global do setor (v3.6): pares e leitura internacional
            org = sem_acento(x.get('organizacao') or '').lower()
            if f.get('agregador'):
                x['confiavel'] = any(v and (v in org or org in v) for v in confiaveis) if org else False
            for k, v in sinalizadas.items():
                if k and k in org:
                    x['aviso_fonte'] = v
            validos.append(x)
        rej['antigo'] = max(0, recebidos - len(itens))
        ja = sum(1 for x in validos if x['id'] in vistos)
        ineditos = [x for x in validos if x['id'] not in vistos]
        if f.get('casa'):
            for x in ineditos:
                x['casa_fonte'] = f['casa']
        if f.get('debate'):  # análise de colaboradores (Seeking Alpha): opinião individual, separada de notícia e de banco
            for x in ineditos:
                x['debate'] = f['debate']
        if f.get('ler_item'):  # research da casa: a página do item traz data, resumo e, às vezes, recomendação e preço-alvo
            for x in ineditos[: int(f.get('ler_item_max', 6))]:
                if rede.sem_tempo():
                    break
                conteudo.ler_pagina_item(rede, robots, x, f, agora_)
        for x in ineditos:
            biblioteca.corrigir_data_futura(x, hoje)
        sem_data = [x for x in ineditos if not x.get('publicado_em')]
        lote_arquivo = not primeira_leitura and len(sem_data) > 3  # muitos itens sem data de uma vez numa fonte já lida: é o arquivo da página
        for x in list(ineditos):
            analise.classificar(x, oregon, hoje)
            if f.get('descartar_promocional') and x.get('natureza') in ('promocional', 'sensacionalista'):
                rej['promocional'] = rej.get('promocional', 0) + 1  # casa com muito texto de venda (Empiricus): fica só empresa e estratégia
                ineditos.remove(x)
                continue
            if f.get('exigir_assunto') and not (x.get('ativos') or x.get('temas') or x.get('etfs_tema')):
                rej['fora_do_tema'] = rej.get('fora_do_tema', 0) + 1
                ineditos.remove(x)
                continue
            if f.get('so_oregon') and not x.get('ativos'):  # feed setorial: só manchetes que citem ativo das carteiras
                rej['sem_ativo_oregon'] = rej.get('sem_ativo_oregon', 0) + 1
                ineditos.remove(x)
                continue
            if f.get('exigir_macro') and not x.get('macro_br'):  # v3.10 · busca de macro do Brasil: só o que é macro do Brasil
                rej['fora_do_tema'] = rej.get('fora_do_tema', 0) + 1
                ineditos.remove(x)
                continue
            if f.get('categoria') == 'veiculo' and f.get('filtro_tema', True) and not (x.get('temas') or x.get('ativos') or x.get('etfs_tema') or x.get('macro_br')):
                # imprensa geral: só entra o que trata de economia, mercados ou de um ativo das carteiras (o resto é contado)
                rej['fora_do_tema'] = rej.get('fora_do_tema', 0) + 1
                ineditos.remove(x)
                continue
            if f.get('metodo') in ('pagina', 'pagina_html', 'pagina_pdf', 'sitemap') and not x.get('publicado_em'):
                motivo = antigo_sem_data(x, hoje, primeira_leitura, lote_arquivo)
                if motivo:  # o que já estava na página (ou é de um mês antigo) é acervo, não novidade de hoje
                    x['acervo'], x['acervo_motivo'] = True, motivo
            x['analise'] = analise.analisar_regras(x, oregon)
        novos += ineditos
        biblioteca.registrar(cont, f['id'], nome, recebidos=recebidos, rejeitados={k: v for k, v in rej.items() if v}, duplicados=ja, novos=len(ineditos), classificados=len(ineditos), marca=marca)
        # diagnóstico: data do conteúdo mais recente que a fonte oferece (mesmo já visto); sem data, fica a anterior
        datas = [x.get('publicado_em') for x in itens if x.get('publicado_em') and not x.get('acervo')]
        if datas:
            cont[f['id']]['ultimo_publicado'] = max(datas)
    try:  # comentários de resultado do InvesTalk no endereço do trimestre (as listas do site não trazem os links)
        achados = casas.sondar(cfg, oregon, rede, robots, hoje, agora_, estado, log_=log_)
        biblioteca.registrar(cont, casas.FONTE['id'], casas.FONTE['nome'], recebidos=len(achados), novos=len(achados), classificados=len(achados), marca=marca)
        if achados:
            cont[casas.FONTE['id']]['ultimo_publicado'] = max([x['publicado_em'] for x in achados if x.get('publicado_em')] or [None]) or cont[casas.FONTE['id']].get('ultimo_publicado')
        novos += achados
    except Exception as e:
        log_('  InvesTalk não consultado: %s' % type(e).__name__)
    try:  # v3.5 · relatórios da Genial pela página de cada ação (o sitemap de relatórios não respondeu a partir do GitHub)
        gen = casas.genial_paginas(cfg, oregon, rede, robots, hoje, agora_, estado, log_=log_)
        fg = casas.FONTE_GENIAL
        biblioteca.registrar(cont, fg['id'], fg['nome'], recebidos=len(gen), novos=len(gen), classificados=len(gen), marca=marca)
        datas_g = [x['publicado_em'] for x in gen if x.get('publicado_em')]
        if datas_g:
            cont[fg['id']]['ultimo_publicado'] = max(datas_g)
        novos += gen
    except Exception as e:
        log_('  Genial (página da ação) não consultada: %s' % type(e).__name__)
    res, gravados = biblioteca.incorporar(novos, hoje, agora_)
    for x in gravados:
        c = cont.get(x['fonte_id'])
        if c:
            c['publicados'] += 1
    for c in cont.values():
        c['publicados'] = min(c['publicados'], c['novos'])
    rodada = {'quando': marca, 'fontes_ok': len(ok), 'fontes_erro': len(erros), 'a_validar': a_validar[:20], 'adiadas': len(adiadas), 'em_pausa': pausadas[:30], 'recebidos': sum((c.get('ultima_rodada') or {}).get('recebidos', 0) for c in cont.values()),
              'novos': len(novos), 'publicados': len(gravados), 'duplicados_titulo': res['duplicados_titulo'], 'duplicados_id': res['duplicados_id'], 'janela_dias': janela, 'erros': erros[:20], 'aguardando_chave': aguardando[:30]}
    hist = (coleta.get('rodadas') or [])[-29:] + [rodada]
    coleta = {'gerado_em': marca, 'fontes': cont, 'rodadas': hist, 'ultima': rodada,
              'legenda': {'recebidos': 'itens lidos da fonte na rodada', 'rejeitados': 'descartados e por quê (sem link, repetido no feed, fora do filtro, fora do tema, antigo, bloqueado, robots)',
                          'duplicados': 'já estavam na biblioteca (mesmo link) ou são o mesmo fato de outra fonte', 'novos': 'ineditos classificados', 'publicados': 'gravados na biblioteca e no site'}}
    gravar('coleta.json', coleta)
    try:  # pesquisas ativo × fator (janela de leitura): acessório; uma falha aqui nunca derruba a rodada
        pesquisas.atualizar(cfg, oregon, rede, robots, hoje, agora_, bloqueio=bloqueio_nomes, log_=log_)
    except Exception as e:
        log_('  pesquisas não atualizadas: %s' % type(e).__name__)
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


def migrar_acervo(estado, fontes_cfg):
    """Uma vez (v3.1): itens sem data de publicação gravados até aqui vieram da primeira leitura das páginas de gestoras
    e são acervo, não novidade; as fontes que já responderam ficam marcadas como lidas."""
    if estado.get('migracao_acervo_v31'):
        return 0
    n = 0
    for mes in biblioteca.meses_disponiveis():
        itens = biblioteca.ler_mes(mes).get('itens') or []
        mudou = False
        for x in itens:
            if not x.get('publicado_em') and not x.get('acervo') and x.get('categoria') != 'veiculo':
                x['acervo'] = True
                mudou = True
                n += 1
        if mudou:
            biblioteca.gravar_mes(mes, itens)
    cont = (ler('coleta.json', {}) or {}).get('fontes') or {}
    lidas = estado.setdefault('fontes_lidas', {})
    for f in fontes_cfg:
        c = cont.get(f['id']) or {}
        if c.get('ultima_ok') and f['id'] not in lidas:
            lidas[f['id']] = c['ultima_ok']
    estado['migracao_acervo_v31'] = True
    if n:
        log('  acervo: %d itens sem data da primeira leitura marcados como acervo (fora do Hoje)' % n)
    return n


def migrar_acervo_v34(estado, hoje):
    """Uma vez (v3.4): páginas de gestoras que listam o arquivo inteiro sem data (Kapitalo, Alaska, Genoa, Oaktree, Atmos…)
    vinham soltando, a cada rodada, cartas de 2020–2023 como "detectadas agora". Os itens já guardados nessa situação viram
    acervo pelas mesmas regras da coleta (mês de referência antigo no título ou no link, ou chegada em lote sem data).
    Nada é apagado: continuam na Biblioteca, fora das novidades."""
    if estado.get('migracao_acervo_v34'):
        return 0
    n = 0
    for mes in biblioteca.meses_disponiveis():
        itens = biblioteca.ler_mes(mes).get('itens') or []
        cand = [x for x in itens if not x.get('publicado_em') and not x.get('acervo') and x.get('categoria') != 'veiculo']
        lotes = {}
        for x in cand:
            k = (x.get('fonte_id'), (x.get('detectado_em') or '')[:16])
            lotes[k] = lotes.get(k, 0) + 1
        mudou = False
        for x in cand:
            motivo = antigo_sem_data(x, hoje, False, lotes[(x.get('fonte_id'), (x.get('detectado_em') or '')[:16])] > 3)
            if motivo:
                x['acervo'], x['acervo_motivo'] = True, motivo
                mudou = True
                n += 1
        if mudou:
            biblioteca.gravar_mes(mes, itens)
    estado['migracao_acervo_v34'] = True
    if n:
        log('  acervo: %d cartas antigas sem data deixaram as novidades (mês de referência antigo ou lote do arquivo da página)' % n)
    return n


def alertas_imediatos(novos, estado, agora_, maximo=5):
    """Itens novos desta rodada que merecem aviso na hora: fato relevante de empresa das carteiras ou opinião de casa
    em que o ativo é o assunto. Só o que foi publicado nas últimas 48 h, nunca o mesmo item duas vezes, no máximo `maximo`."""
    ja = set(estado.get('alertados') or [])
    lim = (agora_ - dt.timedelta(hours=48)).isoformat(timespec='minutes')
    out = []
    for x in novos or []:
        if x['id'] in ja or x.get('acervo') or x.get('agrupado_em') or not x.get('publicado_em') or x['publicado_em'] < lim:
            continue
        diretos = [t for t, v in (x.get('vinculos') or {}).items() if (v or {}).get('tipo') == 'direto']
        fato = x.get('categoria') == 'oficial_empresa' and x.get('tipo') == 'fato_relevante'
        opiniao = x.get('natureza') == 'opiniao_casa' and diretos
        if fato or opiniao:
            out.append(x)
    out.sort(key=lambda y: (0 if y.get('tipo') == 'fato_relevante' else 1, y.get('publicado_em') or ''))
    return out[:maximo]


def _quando(iso, ref):
    try:
        d = dt.datetime.fromisoformat(iso)
    except (TypeError, ValueError):
        return None
    if (d.tzinfo is None) != (ref.tzinfo is None):
        d = d.replace(tzinfo=ref.tzinfo) if d.tzinfo is None else d.replace(tzinfo=None)
    return d


def extras_digesto(oregon, estado, agora_, hoje, maximo=8):
    """v3.7 · duas seções do briefing diário do Telegram, só quando há o que dizer:
    data-com amanhã (proventos anunciados na B3, empresas das carteiras) e cartas lidas nas últimas 24 h que citam
    empresas das carteiras Oregon ou VG VIP (só a contagem: nada de opinião atribuída à gestora)."""
    at = (oregon or {}).get('ativos') or {}
    linhas = []
    amanha = (hoje + dt.timedelta(days=1)).isoformat()
    pv = ler('biblioteca/proventos.json') or {}
    dc, vistos = [], set()
    for t, o in sorted(((pv.get('ativos') or {}).items())):
        if t not in at:
            continue
        for e in o.get('eventos') or []:
            if e.get('data_com') != amanha:
                continue
            ch = (t, e.get('tipo'), e.get('valor'))
            if ch in vistos:
                continue
            vistos.add(ch)
            ln = '%s · %s%s' % (t, e.get('tipo') or 'Provento', (' R$ ' + util_num(e['valor'], 4)) if e.get('valor') is not None else '')
            if e.get('pagamento'):
                ln += ' · paga %s/%s' % (e['pagamento'][8:10], e['pagamento'][5:7])
            dc.append(ln)
    if dc:
        linhas.append('\n<b>Data-com amanhã (%s/%s)</b>' % (amanha[8:10], amanha[5:7]))
        linhas += ['• ' + html.escape(x) for x in dc[:maximo]]
        if len(dc) > maximo:
            linhas.append('• e mais %d' % (len(dc) - maximo))
    pub = ler('biblioteca/cartas_mencoes.json') or {}
    info = {}
    for m in pub.get('meses') or []:
        for c in m.get('cartas') or []:
            info[c.get('id')] = c
    novas = []
    for xid, s in ((estado or {}).get('cartas_lidas') or {}).items():
        quando = _quando(s.get('em'), agora_)
        if not quando or not s.get('mencoes') or agora_ - quando > dt.timedelta(hours=24) or quando > agora_ + dt.timedelta(minutes=5):
            continue
        tks = sorted((t for t in s['mencoes'] if t in at), key=lambda t: (-s['mencoes'][t], t))
        if not tks:
            continue
        c = info.get(xid) or {}
        novas.append((quando, c.get('gestora') or '', c.get('titulo') or 'carta', c.get('link'), tks))
    if novas:
        novas.sort(key=lambda r: r[0], reverse=True)
        linhas.append('\n<b>Cartas novas que citam a carteira</b>')
        for _, g, tit, lk, tks in novas[:maximo]:
            nome = '<a href="%s">%s</a>' % (html.escape(lk, quote=True), html.escape(tit)) if lk else html.escape(tit)
            linhas.append('• %s%s: %s' % ((html.escape(g) + ' · ') if g else '', nome, ', '.join(tks[:6]) + (' e mais %d' % (len(tks) - 6) if len(tks) > 6 else '')))
        if len(novas) > maximo:
            linhas.append('• e mais %d cartas' % (len(novas) - maximo))
    return linhas


def texto_alertas(itens, agora_):
    seta = {'favoravel': ' ▲', 'contraria': ' ▼'}
    linhas = ['<b>Oregon Intelligence · agora</b> (%s)' % agora_.strftime('%d/%m %H:%M')]
    for x in itens:
        tk = ', '.join(t for t, v in (x.get('vinculos') or {}).items() if (v or {}).get('tipo') == 'direto') or ', '.join(x.get('ativos') or [])
        if x.get('tipo') == 'fato_relevante':
            cab = '‼️ %s · fato relevante' % tk
        else:
            cab = '%s · opinião de %s%s' % (tk, ', '.join(x.get('casas') or []) or 'casa de análise', seta.get(x.get('posicao'), ''))
            extra = ' · '.join(v for v in (x.get('recomendacao'), ('alvo ' + x['preco_alvo']) if x.get('preco_alvo') else None) if v)
            if extra:
                cab += ' · ' + extra
        quando = (x.get('publicado_em') or '')[11:16]
        linhas.append('\n<b>%s</b>\n<a href="%s">%s</a> — %s%s' % (html.escape(cab), html.escape(x.get('link') or '', quote=True), html.escape(x.get('titulo') or ''),
                                                                 html.escape(x.get('organizacao') or x.get('fonte') or ''), (' · ' + quando) if quando else ''))
    return '\n'.join(linhas)


SEMENTES = os.path.join(AQUI, 'sementes')


def ticker_da_carteira(t, oregon):
    """Ticker da pesquisa → ticker das carteiras: igual, ou outra classe da mesma empresa (KLBN11 → KLBN4, BBDC4 → BBDC3)."""
    ativos = oregon.get('ativos') or {}
    t = (t or '').upper().strip()
    if t in ativos:
        return t
    raiz = re.match(r'^([A-Z]{4})\d{1,2}$', t)
    if raiz:
        for k in sorted(ativos):
            if k[:4] == raiz.group(1) and re.match(r'^[A-Z]{4}\d{1,2}$', k):
                return k
    return None


def importar_sementes(oregon, hoje, agora_, estado, pasta=None):
    """Opiniões publicadas nos últimos 12 meses, levantadas em pesquisa e conferidas uma a uma (link original, veículo e data
    de publicação), entram na biblioteca uma vez por versão do arquivo (robo/sementes/*.json). Cada item guarda como foi
    conferido (`verificacao`: página aberta ou resultado de busca com data). Recomendação, preço-alvo e horizonte só quando
    estavam escritos na página. A coleta contínua (buscas de opinião por ativo e research das casas) segue a partir daí."""
    pasta = pasta or os.environ.get('ROBO_SEMENTES') or SEMENTES
    if not os.path.isdir(pasta):
        return 0
    feitos = estado.setdefault('sementes', {})
    total = 0
    for nome in sorted(os.listdir(pasta)):
        if not nome.endswith('.json'):
            continue
        with open(os.path.join(pasta, nome), 'rb') as fh:
            corpo = fh.read()
        marca_arq = hashlib.sha1(corpo).hexdigest()[:12]
        if feitos.get(nome) == marca_arq:
            continue
        js = json.loads(corpo.decode('utf-8'))
        itens, por_link = [], {}
        for s0 in (js.get('itens') if isinstance(js, dict) else js) or []:
            if not (s0.get('titulo') and s0.get('link') and s0.get('publicado_em') and s0.get('ativo')):
                continue
            tk = ticker_da_carteira(s0['ativo'], oregon)
            if not tk:  # ativo fora das carteiras: não entra
                continue
            if s0['link'] in por_link:  # a mesma matéria sobre duas empresas (ex.: JPMorgan corta alvos de Axia e Copel): um item, dois ativos
                y0 = por_link[s0['link']]
                if tk not in y0['ativos']:
                    y0['ativos'].append(tk)
                    y0['ativos_porque'][tk] = 'busca específica do ativo'
                    analise.classificar(y0, oregon, hoje)
                continue
            casa_pag = s0.get('casa_pagina')  # página publicada pela própria casa (InvesTalk, Genial Analisa…)
            f = {'id': 'pesquisa-opinioes', 'nome': s0.get('veiculo') or 'Pesquisa de opiniões', 'organizacao': s0.get('veiculo') or '', 'categoria': 'instituicao' if casa_pag else 'veiculo',
                 'pais': 'Brasil', 'idioma': 'pt', 'tipo': 'research' if casa_pag else 'noticia', 'guardar_resumo': False}
            p0 = s0['publicado_em']
            quando = p0 if re.match(r'^\d{4}-\d{2}-\d{2}$', p0) else conteudo.data_iso(p0, 'BRT')
            x = conteudo._novo_item(f, s0['titulo'], s0['link'], quando, agora_)
            if not x or not x.get('link'):
                continue
            x.pop('posicao_pagina', None)
            x['ativos'] = [tk]
            x['ativos_porque'] = {tk: 'busca específica do ativo' + (' (%s)' % s0['ativo'] if tk != s0['ativo'] else '')}
            if casa_pag:
                x['casa_fonte'] = casa_pag
            x['origem'] = 'pesquisa de opiniões de 12 meses (v3.4)'
            x['verificacao'] = s0.get('verificacao') or 'busca'
            for k in ('recomendacao', 'preco_alvo', 'horizonte', 'analista'):
                if s0.get(k):
                    x[k] = s0[k]
            if s0.get('data_tipo') == 'atualizacao':  # a página só informa quando foi atualizada (InvesTalk): fica dito
                x['data_e_atualizacao'], x['atualizado_em'] = True, x.get('publicado_em')
            if s0.get('nota'):  # observação de quem conferiu (ex.: "alvo cortado de R$ 42 para R$ 40")
                x['nota_pesquisa'] = str(s0['nota'])[:240]
            # a pesquisa abriu a página e confirmou que é opinião sobre o ativo (o título nem sempre nomeia a casa):
            # fica marcado no item, e a reclassificação de versões futuras mantém casas e sentido conferidos
            x['opiniao_verificada'] = {'casas': list(s0.get('casas') or [])[:4], 'posicao': s0.get('posicao')}
            analise.classificar(x, oregon, hoje)
            x['analise'] = analise.analisar_regras(x, oregon)
            por_link[s0['link']] = x
            itens.append(x)
        res, gravados = biblioteca.incorporar(itens, hoje, agora_)
        feitos[nome] = marca_arq
        total += len(gravados)
        log('  sementes: %s → %d opiniões novas na biblioteca (%d já estavam)' % (nome, len(gravados), res['duplicados_id'] + res['duplicados_titulo']))
    return total


# ------------------------------------------------------------------ rodada
def gravar_versao(agora_, macro, coleta, hoje_js, sem_js, estado, cfg=None):
    v = {'versao': 3, 'produto': 'Oregon Intelligence', 'gerado_em': agora_.isoformat(timespec='seconds'), 'macro_em': (macro or {}).get('gerado_em'),
         'coleta_em': (coleta or {}).get('gerado_em'), 'hoje_em': (hoje_js or {}).get('gerado_em'), 'semanal_em': (sem_js or {}).get('gerado_em'),
         'meses': biblioteca.meses_disponiveis(), 'ia': bool((estado.get('ia_uso') or {}).get('itens'))}
    if cfg is not None:
        v['corrente'] = corrente.resumo(cfg, agora_)  # v3.11 · o painel mostra a próxima coleta prevista pela corrente
    gravar('versao.json', v)


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
        fontes_cfg += fontes_de_busca(cfg)
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
    migrar_acervo(estado, fontes_cfg)
    migrar_acervo_v34(estado, hoje)
    importar_sementes(oregon, hoje, agora_, estado)

    # 1. macro
    macro = coletar_macro(cfg, rede, hoje, agora_, estado, anterior)
    gravar('macro.json', macro)
    log('  macro: ' + ', '.join('%s %s' % (k, 'ok' if v.get('ok') else 'FALHOU') for k, v in macro['fontes'].items()))

    # 2. conteúdo
    rede_c = Rede(prazo_seg=int((cfg.get('intel') or {}).get('prazo_min', 12)) * 60)
    novos, erros_c, ok_c, coleta = coletar_conteudo(cfg, fontes_cfg, oregon, rede_c, hoje, agora_, estado, chaves)
    log('  conteúdo: %d fontes ok, %d com falha, %d itens novos' % (len(ok_c), len(erros_c), len(novos)))

    # 3. IA opcional
    recentes = [x for x in biblioteca.carregar_recentes(hoje, 14) if not x.get('agrupado_em') and not x.get('acervo')]
    n_ia, msg_ia = ler_com_ia(cfg, rede_c, hoje, agora_, estado, chaves.get('anthropic'), oregon, recentes)
    log('  IA: ' + msg_ia)
    if n_ia:
        recentes = [x for x in biblioteca.carregar_recentes(hoje, 14) if not x.get('agrupado_em') and not x.get('acervo')]

    # 4 e 5. índice, recentes, briefing e semanal: um erro aqui nunca impede a publicação do que já foi coletado
    hoje_js, sem_arq, idx = {}, ler('semanal.json', {}) or {}, {'total': 0, 'meses': []}
    research_90 = []
    try:
        # 4. índice, recentes, briefing
        biblioteca.FONTES_BLOQUEADAS = list((cfg.get('noticias') or {}).get('fontes_bloqueadas') or [])
        biblioteca.FILTROS_TITULO = {f['id']: f['filtro_titulo'] for f in fontes_cfg if f.get('filtro_titulo')}
        idx = biblioteca.reindexar(agora_)
        recentes = biblioteca.publicar_recentes(hoje, agora_, dias=int((cfg.get('intel') or {}).get('recentes_dias', 10)), oregon=oregon)
        try:
            biblioteca.publicar_opinioes(hoje, agora_, oregon=oregon)
        except Exception as e:  # o histórico de opiniões é acessório: nunca impede o resto da publicação
            log('  opiniões de 12 meses não publicadas: %s' % e)
        try:
            research_90 = biblioteca.publicar_research(hoje, agora_, oregon=oregon)
        except Exception as e:  # idem para o research de 90 dias
            log('  research de 90 dias não publicado: %s' % e)
        try:  # v4.0.1 · assuntos do momento (biblioteca/assuntos.json): acessório; uma falha mantém o arquivo anterior
            def _itens_dias(dias):
                return [x for x in biblioteca.carregar_recentes(hoje, dias) if not x.get('agrupado_em') and not x.get('acervo') and not biblioteca.bloqueado(x)]
            ass = assuntos.publicar(agora_, ler('biblioteca/assuntos.json', {}) or {}, _itens_dias)
            gravar('biblioteca/assuntos.json', ass)
            log('  assuntos do momento: ' + assuntos.resumo(ass))
        except Exception as e:
            log('  assuntos do momento não publicados: %s' % type(e).__name__)
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

    # 5c. Estante (v3.5): acervo permanente de autores e séries clássicas. Algumas páginas por rodada; uma falha mantém o
    # acervo publicado (nada é apagado) e só marca a coleção com o erro.
    try:
        rede_e = Rede(prazo_seg=int((cfg.get('estante') or {}).get('prazo_min', 4)) * 60)
        est = estante.atualizar(cfg, rede_e, conteudo.Robots(rede_e), hoje, agora_, estado, ler('biblioteca/estante.json') or {}, log_=log)
        if est and est.get('itens'):
            os.makedirs(os.path.join(dados_dir(), 'biblioteca'), exist_ok=True)
            gravar('biblioteca/estante.json', est)
            # v3.6 · clássico da semana (arquivo pequeno, lido pelo Hoje)
            lim7 = (hoje - dt.timedelta(days=7)).isoformat()
            tit7 = [x.get('titulo') or '' for x in (research_90 or []) if (x.get('publicado_em') or '')[:10] >= lim7]
            dq = estante.destaque_semana(est, tit7, hoje, estado)
            if dq:
                gravar('biblioteca/estante_destaque.json', dict(dq, gerado_em=agora_.isoformat(timespec='minutes')))
    except Exception as e:  # pragma: no cover - proteção
        log('  estante não atualizada: %s' % type(e).__name__)

    # 5d. Termômetro das cartas (v3.6): empresas citadas nas cartas das gestoras brasileiras, alguns PDFs por rodada
    try:
        rede_k = Rede(prazo_seg=int(((cfg.get('intel') or {}).get('cartas_termometro') or {}).get('prazo_min', 3)) * 60)
        tc = cartas.atualizar(cfg, oregon, rede_k, conteudo.Robots(rede_k), hoje, agora_, estado, log_=log)
        if tc:
            os.makedirs(os.path.join(dados_dir(), 'biblioteca'), exist_ok=True)
            gravar('biblioteca/cartas_mencoes.json', tc)
    except Exception as e:  # pragma: no cover - proteção
        log('  termômetro das cartas não atualizado: %s' % type(e).__name__)

    # 5e. Agenda de proventos (v3.6): B3, uma vez por dia; uma falha mantém o publicado
    try:
        rede_p = Rede(prazo_seg=int(((cfg.get('intel') or {}).get('proventos') or {}).get('prazo_min', 3)) * 60)
        pv_ant = ler('biblioteca/proventos.json') or {}
        pv = proventos.atualizar(cfg, oregon, rede_p, conteudo.Robots(rede_p), hoje, agora_, estado, pv_ant, log_=log)
        if pv:
            os.makedirs(os.path.join(dados_dir(), 'biblioteca'), exist_ok=True)
            gravar('biblioteca/proventos.json', pv)
    except Exception as e:  # pragma: no cover - proteção
        log('  proventos não atualizados: %s' % type(e).__name__)
    # 5f. Quem tem a ação (v3.6): carteira dos fundos (CVM, CDA), na rodada da noite, quando sai um mês novo completo
    try:
        rede_f = Rede(prazo_seg=int(((cfg.get('intel') or {}).get('fundos_cda') or {}).get('prazo_min', 8)) * 60)
        fd_ant = ler('biblioteca/fundos_acoes.json') or {}
        fd = fundos.atualizar(cfg, oregon, rede_f, hoje, agora_, estado, fd_ant, manual=manual, log_=log)
        if fd:
            os.makedirs(os.path.join(dados_dir(), 'biblioteca'), exist_ok=True)
            gravar('biblioteca/fundos_acoes.json', fd)
    except Exception as e:  # pragma: no cover - proteção
        log('  fundos (CVM) não atualizados: %s' % (e if isinstance(e, (ErroFonte, RuntimeError)) else type(e).__name__))
    # 5g. Fluxo dos fundos (v3.8): captação líquida por classe (CVM, informe diário), uma vez por dia a partir das 9h
    try:
        rede_x = Rede(prazo_seg=int(((cfg.get('intel') or {}).get('fluxo_fundos') or {}).get('prazo_min', 6)) * 60)
        fx_ant = ler('biblioteca/fluxo_fundos.json') or {}
        fx = fluxo.atualizar(cfg, rede_x, hoje, agora_, estado, fx_ant, manual=manual, log_=log)
        if fx:
            os.makedirs(os.path.join(dados_dir(), 'biblioteca'), exist_ok=True)
            gravar('biblioteca/fluxo_fundos.json', fx)
    except Exception as e:  # pragma: no cover - proteção
        log('  fluxo dos fundos não atualizado: %s' % (e if isinstance(e, (ErroFonte, RuntimeError)) else type(e).__name__))

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
        try:
            linhas += extras_digesto(oregon, estado, agora_, hoje)  # v3.7 · data-com amanhã e cartas novas
        except Exception as e:  # pragma: no cover - proteção: o briefing sai mesmo sem as seções novas
            log('  briefing: seções de proventos e cartas fora (%s)' % type(e).__name__)
        mh = ic.get('mercado_hoje') or {}
        if mh.get('telegram', True):
            try:
                linhas += mercado_hoje.linhas_telegram(recentes, agora_, horas=float(mh.get('horas', 18)), maximo=int(mh.get('maximo', 5)))  # v3.10
            except Exception as e:  # pragma: no cover - proteção: o briefing sai mesmo sem a macro
                log('  briefing: mercado hoje fora (%s)' % type(e).__name__)
        ig = ic.get('ingles') or {}
        if ig.get('telegram', True):
            try:
                linhas += ingles.linhas_telegram(recentes, agora_, site=ig.get('site'))  # v3.9 · inglês do dia
            except Exception as e:  # pragma: no cover - proteção: o briefing sai mesmo sem o inglês
                log('  briefing: inglês do dia fora (%s)' % type(e).__name__)
        okk, m = avisos.enviar('\n'.join(linhas))
        tg = {'ok': okk, 'msg': m or 'briefing enviado'}
        if okk and modo != 'teste_telegram':
            estado['digesto'] = hoje.isoformat()

    # 6b. Alerta imediato (v3.5, opcional): fato relevante ou opinião nova de empresa das carteiras, na rodada em que chega
    if tem_tg and ic.get('telegram_alertas', True) and modo != 'teste_telegram':
        al = alertas_imediatos(novos, estado, agora_, int(ic.get('telegram_alertas_max', 5)))
        if al:
            okk, m = avisos.enviar(texto_alertas(al, agora_))
            if okk:
                estado['alertados'] = ((estado.get('alertados') or []) + [x['id'] for x in al])[-400:]
            log('  alerta imediato: %d item(ns) %s' % (len(al), 'enviados' if okk else 'não enviados: ' + (m or '')))

    # 7. avaliação e gravação
    motivos, nivel = list(motivos_extra), 'parcial' if motivos_extra else 'completo'
    for k, v in macro['fontes'].items():
        if v.get('ok') is False:
            motivos.append('macro %s: %s' % (k, (v.get('msg') or '')[:120]))
            nivel = 'parcial'
    if erros_c:
        motivos.append('%d fonte(s) de conteúdo com falha: %s' % (len(erros_c), '; '.join(erros_c[:3])[:300]))
        nivel = 'parcial' if nivel == 'completo' else nivel
    av = (coleta.get('ultima') or {}).get('a_validar') or []
    if av:
        motivos.append('%d fonte(s) nova(s) ainda não confirmada(s) no ar (aparecem em Fontes e coleta como "a validar")' % len(av))
    if not ok_c and fontes_cfg and not idx['total']:
        motivos.append('nenhuma fonte de conteúdo respondeu e a biblioteca está vazia')
        nivel = 'critico'
    if modo == 'teste_telegram' and not tg['ok']:
        motivos.insert(0, 'teste do Telegram falhou: ' + tg['msg'])
        nivel = 'critico'
    gravar_versao(agora_, macro, coleta, hoje_js, sem_arq, estado, cfg)
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
