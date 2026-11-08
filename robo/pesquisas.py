# -*- coding: utf-8 -*-
"""Pesquisas sobre a relação entre cada ativo da carteira e o fator que mais o move (premissa interna de sensibilidade
de painel/src/data.json: LFTB11 × Selic, IMAB11 × juro real, PETR4 × petróleo…). O painel mostra o resultado na janela
de leitura ("O que se publica sobre isso"), com a data da pesquisa, e oferece a pesquisa pronta no Google.

Provedor: RSS do Bing Notícias, o único caminho de busca que o robots.txt do Bing permite (/news; /search é vedado).
Consultas curtas (ativo + termo do fator), ordenadas por relevância — perguntas inteiras trazem resultados sem relação.
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
ARQ = 'biblioteca/pesquisas.json'


def _nome(a, t):
    for x in a.get('termos') or []:
        x = x.lstrip('=')
        if not re.match(r'^[A-Z]{4}\d{1,2}$', x) and len(x) >= 3:
            return x
    return a.get('nome') if a.get('classe') in ('Ações', 'FIIs') else t


def pares(oregon):
    return sorted((t, a['fator']) for t, a in (oregon.get('ativos') or {}).items() if a.get('fator') in TERMOS)


def consultas(t, a, f):
    nome = _nome(a, t)
    qs = ['"%s" %s' % (t, TERMOS[f])]
    if nome and sem_acento(nome).lower() != t.lower():
        qs.append('"%s" %s' % (nome, TERMOS[f]))
    return qs


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
                if x.get('link') in vistos or not (t.lower() in tit or (nome and nome in tit)):  # só resultados que citam o ativo
                    continue
                vistos.add(x['link'])
                itens.append({'titulo': x['titulo'], 'link': x['link'], 'fonte': x.get('fonte') or x.get('organizacao'), 'publicado_em': x.get('publicado_em')})
        feitos += 1
        if not ok:  # buscador fora do ar: o par fica com o resultado anterior
            continue
        itens.sort(key=lambda y: y.get('publicado_em') or '', reverse=True)
        P[k] = {'ativo': t, 'fator': f, 'pergunta': pergunta(t, a, f), 'consulta': ' | '.join(qs), 'provedor': 'Bing Notícias', 'atualizado_em': agora_.isoformat(timespec='minutes'), 'itens': itens[:6]}
    gravar(ARQ, {'gerado_em': agora_.isoformat(timespec='minutes'), 'nota': 'Resultados de busca sobre a relação ativo × fator (premissa interna). Não verificados; abrem a fonte original.', 'pares': P})
    if log_:
        log_('  pesquisas: %d pares atualizados, %d no arquivo' % (feitos, len(P)))
    return feitos
