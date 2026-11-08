# -*- coding: utf-8 -*-
"""Pesquisas sobre a relação entre cada ativo da carteira e o fator que mais o move (premissa interna de sensibilidade
de painel/src/data.json: LFTB11 × Selic, IMAB11 × juro real, PETR4 × petróleo…). O painel mostra o resultado na janela
de leitura ("O que se publica sobre isso"), com a data da pesquisa, e oferece a pesquisa pronta no Google.

Provedor: RSS do Bing Notícias, o único caminho de busca que o robots.txt do Bing permite (/news; /search é vedado).
Consultas curtas (ativo + termo do fator; nos ETFs, também o índice que acompanham, v3.5), ordenadas por relevância —
perguntas inteiras trazem resultados sem relação. Páginas de cotação ficam de fora.
Guardamos só título, link, veículo e data. Cada par é refeito a cada `validade_dias`, até `max_por_rodada` por rodada.
Arquivo: data/biblioteca/pesquisas.json (publicado com a pasta da biblioteca)."""
import datetime as dt
import re
import urllib.parse

import conteudo
from util import gravar, ler, sem_acento

TERMOS = {'selic': 'Selic', 'pre': 'juros prefixados', 'real': 'juro real', 'ust': 'Treasuries', 'usd': 'dólar', 'spread': 'spread de crédito',
          'ibov': 'Ibovespa', 'sp': 'S&P 500', 'em': 'mercados emergentes', 'brent': 'petróleo', 'btc': 'bitcoin'}
PERGUNTA = {'selic': 'Como a Selic e os juros de curto prazo afetam', 'pre': 'Como a curva de juros prefixada afeta', 'real': 'Como o juro real (IPCA+) afeta',
            'ust': 'Como os juros dos Treasuries afetam', 'usd': 'Como o dólar afeta', 'spread': 'Como o spread de crédito afeta', 'ibov': 'Como a bolsa brasileira afeta',
            'sp': 'Como a bolsa americana afeta', 'em': 'Como os mercados emergentes afetam', 'brent': 'Como o petróleo afeta', 'btc': 'Como o bitcoin afeta'}
URL = 'https://www.bing.com/news/search?q={q}&format=rss&mkt=pt-BR'
# ETFs quase nunca aparecem pelo código na imprensa: a pesquisa vai pelo índice ou título que o ETF acompanha (v3.5)
INDICE_ETF = {'LFTB11': 'Tesouro Selic', 'IMAB11': 'IMA-B', 'B5P211': 'IMA-B 5', 'IB5M11': 'IMA-B 5+', 'IRFM11': 'IRF-M', 'IDKA11': 'IRF-M', '5PRE11': 'Tesouro Prefixado'}
# página de cotação não é análise ("Encontre a cotação do B5P211 hoje", "veja a variação em tempo real"): fica de fora
COTACAO = re.compile(r'cota[cç][aã]o|varia[cç][aã]o (do|da|de) |tempo real|pre[cç]o (de |da |do )?(hoje|agora)|\bquote\b|stock price|gr[aá]fico (de|do|da) |\bhoje\b.*\b(sobe|cai|fecha)\b|est[aá] listad|negociad[oa] na (bolsa|b3)', re.I)
ARQ = 'biblioteca/pesquisas.json'


def _nome(a, t):
    for x in a.get('termos') or []:
        x = x.lstrip('=')
        if not re.match(r'^[A-Z]{4}\d{1,2}$', x) and len(x) >= 3:
            return x
    return a.get('nome') if a.get('classe') in ('Ações', 'FIIs') else t


def pares(oregon):
    return sorted((t, a['fator']) for t, a in (oregon.get('ativos') or {}).items() if a.get('fator') in TERMOS)


def indice(t, a):
    return a.get('indice_busca') or INDICE_ETF.get(t)


def consultas(t, a, f):
    nome = _nome(a, t)
    qs = ['"%s" %s' % (t, TERMOS[f])]
    if nome and sem_acento(nome).lower() != t.lower():
        qs.append('"%s" %s' % (nome, TERMOS[f]))
    ix = indice(t, a)
    if ix and sem_acento(ix).lower() not in sem_acento(TERMOS[f]).lower():
        qs.append('"%s" %s' % (ix, TERMOS[f]))
    elif ix:
        qs.append('"%s"' % ix)
    return qs


def util_resultado(titulo):
    return not COTACAO.search(titulo or '')


def pergunta(t, a, f):
    nome = _nome(a, t)
    return '%s %s?' % (PERGUNTA[f], '%s (%s)' % (nome, t) if nome and nome != t else t)


def atualizar(cfg, oregon, rede, robots, hoje, agora_, bloqueio=(), log_=None):
    """Refaz os pares mais antigos (até `max_por_rodada`). Uma falha de busca mantém o resultado anterior do par."""
    pc = (cfg.get('intel') or {}).get('pesquisas') or {}
    if not pc.get('ativo', True):
        return 0
    arq = ler(ARQ, {}) or {}
    P = dict(arq.get('pares') or {})
    validade, maxr, url = int(pc.get('validade_dias', 3)), int(pc.get('max_por_rodada', 6)), pc.get('url') or URL
    desde = (hoje - dt.timedelta(days=int(pc.get('janela_dias', 365)))).isoformat()
    lista = sorted(pares(oregon), key=lambda p: (P.get('%s|%s' % p) or {}).get('atualizado_em') or '')
    feitos = 0
    for t, f in lista:
        k = '%s|%s' % (t, f)
        ant = P.get(k) or {}
        try:
            if ant.get('atualizado_em') and (agora_ - dt.datetime.fromisoformat(ant['atualizado_em'])).days < validade:
                continue
        except ValueError:
            pass
        if feitos >= maxr or rede.sem_tempo():
            break
        a = oregon['ativos'][t]
        qs, itens, vistos, ok = consultas(t, a, f), [], set(), False
        nome = sem_acento(_nome(a, t) or '').lower()
        ix = sem_acento(indice(t, a) or '').lower()
        for q in qs:
            fonte = {'id': 'pesquisa-' + t.lower(), 'nome': 'Pesquisa · ' + q, 'metodo': 'rss', 'categoria': 'veiculo', 'tipo': 'noticia', 'agregador': True, 'via': 'Bing Notícias',
                     'organizacao': 'Bing Notícias', 'guardar_resumo': False, 'maximo': 10, 'url_coleta': url.replace('{q}', urllib.parse.quote_plus(q))}
            try:
                recebidos, _n = conteudo.coletar_fonte(rede, fonte, agora_, desde, set(), robots=robots, bloqueio=bloqueio)
                ok = True
            except Exception:
                continue
            for x in recebidos:
                tit = sem_acento(x.get('titulo') or '').lower()
                cita = 'ativo' if (t.lower() in tit or (nome and nome != t.lower() and nome in tit)) else 'indice' if (ix and ix in tit) else None
                if x.get('link') in vistos or not cita or not util_resultado(x.get('titulo')):  # só o que cita o ativo ou o índice dele; cotação fica de fora
                    continue
                vistos.add(x['link'])
                itens.append({'titulo': x['titulo'], 'link': x['link'], 'fonte': x.get('fonte') or x.get('organizacao'), 'publicado_em': x.get('publicado_em'), 'cita': cita})
        feitos += 1
        if not ok:  # buscador fora do ar: o par fica com o resultado anterior
            continue
        itens.sort(key=lambda y: y.get('publicado_em') or '', reverse=True)
        P[k] = {'ativo': t, 'fator': f, 'pergunta': pergunta(t, a, f), 'consulta': ' | '.join(qs), 'provedor': 'Bing Notícias', 'atualizado_em': agora_.isoformat(timespec='minutes'), 'itens': itens[:6]}
    for par in P.values():  # resultados gravados antes do filtro de cotação também saem
        par['itens'] = [y for y in par.get('itens') or [] if util_resultado(y.get('titulo'))]
    gravar(ARQ, {'gerado_em': agora_.isoformat(timespec='minutes'), 'nota': 'Resultados de busca sobre a relação ativo × fator (premissa interna). Não verificados; abrem a fonte original.', 'pares': P})
    if log_:
        log_('  pesquisas: %d pares atualizados, %d no arquivo' % (feitos, len(P)))
    return feitos
