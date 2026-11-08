# -*- coding: utf-8 -*-
"""Comentários de resultado do BB Investimentos (InvesTalk) no endereço do trimestre.

O InvesTalk publica um comentário por empresa e trimestre em /noticias/mercado/<código> (ex.: ALOS_3T26, "Allos (ALOS3)
3T26: …", com recomendação e preço-alvo no texto). As listas do site só trazem o destaque com link (o resto é montado por
JavaScript) e o sitemap parou em 23/09/2026, então a fonte de páginas do catálogo quase nunca alcança esses comentários.

Aqui o robô abre diretamente o endereço do trimestre de cada ação das carteiras, nas grafias que o próprio site usa
(ALOS_3T26, INBR3T25, VAMO-3T26): poucas tentativas por rodada (`max_por_rodada`), cada endereço no máximo uma vez a cada
`intervalo_horas`, sempre respeitando o robots.txt e parando quando acha. Uma página só vira item se o título citar a empresa.
Guardamos título, link, data, resumo da própria página e, quando escritos, recomendação, preço-alvo e horizonte. Nada de
texto integral."""
import datetime as dt
import re

import analise
import conteudo
from util import sem_acento

BASE = 'https://investalk.bb.com.br/noticias/mercado/'
GRAFIAS = ('{r}_{q}', '{r}{q}', '{r}-{q}')
_TITULO = [re.compile(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)', re.I), re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:title', re.I),
           re.compile(r'<title[^>]*>(.*?)</title>', re.I | re.S), re.compile(r'<h1[^>]*>(.*?)</h1>', re.I | re.S)]
FONTE = {'id': 'investalk-resultados', 'nome': 'InvesTalk (BB Investimentos) · comentários de resultado', 'organizacao': 'BB Investimentos', 'categoria': 'instituicao',
         'pais': 'Brasil', 'idioma': 'pt', 'tipo': 'research', 'casa': 'BB Investimentos', 'guardar_resumo': True, 'fuso': 'BRT'}


def trimestre(hoje):
    """Trimestre cujos resultados estão saindo (ou saíram por último): até 20 dias depois do fim do trimestre seguinte."""
    d = hoje - dt.timedelta(days=20)
    q = (d.month - 1) // 3
    return '4T%02d' % ((d.year - 1) % 100) if q == 0 else '%dT%02d' % (q, d.year % 100)


def raizes(oregon):
    out = {}
    for t, a in sorted((oregon.get('ativos') or {}).items()):
        if a.get('classe') == 'Ações' and re.match(r'^[A-Z]{4}\d{1,2}$', t) and a.get('moeda', 'BRL') != 'USD':
            out.setdefault(t[:4], t)
    return out


def titulo_da_pagina(txt):
    for rx in _TITULO:
        m = rx.search(txt)
        if m:
            t = conteudo.limpa_texto(re.sub(r'<[^>]+>', ' ', m.group(1)), 240)
            t = re.sub(r'\s*[|\-–]\s*(InvesTalk|Investalk|BB Investimentos).*$', '', t).strip()
            if t:
                return t
    return ''


def cita(titulo, raiz, t, a):
    tit = sem_acento(titulo).lower()
    nomes = [raiz.lower(), t.lower()] + [sem_acento(x.lstrip('=')).lower() for x in (a.get('termos') or []) if len(x.lstrip('=')) >= 4]
    return any(n and n in tit for n in nomes)


_ATUALIZADO = re.compile(r'Atualizad[oa] em\s*(\d{2})/(\d{2})/(\d{4})(?:\s*(?:às|as|-)?\s*(\d{1,2})[:h](\d{2}))?', re.I)


def data_atualizacao(txt):
    """O InvesTalk mostra só "Atualizado em 06/11/2026 às 15:09" (não há data de publicação separada)."""
    m = _ATUALIZADO.search(re.sub(r'<[^>]+>', ' ', txt))
    if not m:
        return None
    d, mo, a, hh, mi = m.groups()
    return '%s-%s-%sT%02d:%s-03:00' % (a, mo, d, int(hh), mi) if hh else '%s-%s-%s' % (a, mo, d)


def sondar(cfg, oregon, rede, robots, hoje, agora_, estado, log_=None):
    """Devolve os itens novos encontrados nesta rodada (já classificados)."""
    c = (cfg.get('intel') or {}).get('investalk') or {}
    if not c.get('ativo', True):
        return []
    maxr, intervalo = int(c.get('max_por_rodada', 4)), float(c.get('intervalo_horas', 24))
    E = estado.setdefault('investalk', {})
    q = c.get('trimestre') or trimestre(hoje)
    R = raizes(oregon)
    cand = []
    for r, t in R.items():
        if any((E.get(g.format(r=r, q=q)) or {}).get('achado') for g in GRAFIAS):
            continue
        for g in GRAFIAS:
            cod = g.format(r=r, q=q)
            ult = (E.get(cod) or {}).get('tentado_em')
            try:
                if ult and (agora_ - dt.datetime.fromisoformat(ult)).total_seconds() < intervalo * 3600:
                    continue
            except ValueError:
                pass
            cand.append((ult or '', cod, r, t))
            break  # uma grafia por empresa por rodada
    cand.sort()
    novos, tentados = [], 0
    for _u, cod, r, t in cand:
        if tentados >= maxr or (hasattr(rede, 'sem_tempo') and rede.sem_tempo()):
            break
        url = BASE + cod
        E[cod] = {'tentado_em': agora_.isoformat(timespec='minutes')}
        if robots is not None and not robots.permite(url):
            continue
        tentados += 1
        try:
            txt = rede.get(FONTE['nome'], url, timeout=20, tentativas=1).decode('utf-8', 'replace')
        except Exception:
            continue  # 404 ou fora do ar: tenta outra grafia numa próxima rodada
        a = oregon['ativos'][t]
        tit = titulo_da_pagina(txt)
        if not tit or not cita(tit, r, t, a):
            continue
        x = conteudo._novo_item(dict(FONTE), tit, url, None, agora_)
        if not x:
            continue
        x.pop('posicao_pagina', None)
        conteudo.ler_pagina_item(rede, None, x, FONTE, agora_, txt=txt)
        if not x.get('publicado_em'):
            da = data_atualizacao(txt)
            if da:  # a página só informa a atualização: é a data usada, e fica dito
                x['publicado_em'], x['atualizado_em'], x['data_e_atualizacao'], x['data_estimada'], x['data_da_pagina'] = da, da, True, False, True
                x.pop('referencia', None)
        x['ativos'] = [t]
        x['ativos_porque'] = {t: 'comentário de resultado do %s (%s)' % (q, cod)}
        x['casa_fonte'] = FONTE['casa']
        x['origem'] = 'InvesTalk · endereço do trimestre'
        analise.classificar(x, oregon, hoje)
        x['analise'] = analise.analisar_regras(x, oregon)
        E[cod]['achado'] = True
        novos.append(x)
    if log_ and tentados:
        log_('  InvesTalk %s: %d endereços consultados, %d comentários novos' % (q, tentados, len(novos)))
    return novos
