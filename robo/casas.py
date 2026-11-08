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


# ------------------------------------------------------------------ Genial Analisa · página de cada ação (v3.5)
# O sitemap de relatórios da Genial não respondeu a partir do GitHub. A página de cada ação (/acoes/<TICKER>/) lista os
# relatórios; o robô aproveita o que a página entrega sem JavaScript: links /acoes/<TICKER>/<slug>/ no HTML ou nos dados
# embutidos da página e, quando só o título aparece, monta o endereço pelo título (regra observada: sem acentos e sem
# ( ) : , — "ALLOS (ALOS3) | Resultado 3T26: Imobiliário…" → ALLOS-ALOS3--Resultado-3T26-Imobiliario-…). Cada endereço
# candidato só vira item depois de aberto e conferido (o título precisa citar o ativo).
import html as _html  # noqa: E402
import unicodedata  # noqa: E402

GENIAL_BASE = 'https://analisa.genialinvestimentos.com.br'
FONTE_GENIAL = {'id': 'genial-paginas-acoes', 'nome': 'Genial Analisa · relatórios pela página da ação', 'organizacao': 'Genial Investimentos', 'categoria': 'instituicao',
                'pais': 'Brasil', 'idioma': 'pt', 'tipo': 'research', 'casa': 'Genial', 'guardar_resumo': True, 'fuso': 'BRT'}
# código que a Genial usa quando difere do da carteira (config intel.genial.tickers sobrepõe)
TICKERS_GENIAL = {'KLBN4': 'KLBN11', 'BBDC3': 'BBDC4', 'CPLE3': 'CPLE6', 'INBR34': 'INBR32'}
# sem cobertura da Genial em 08/11/2026 (página "Sem Cobertura" ou inexistente): conferidas só uma vez por semana
SEM_COBERTURA_GENIAL = ['CPLE3', 'AXIA3', 'EQTL3', 'TTEN3', 'VAMO3', 'INBR34']
_MESES = {'janeiro': 1, 'fevereiro': 2, 'marco': 3, 'abril': 4, 'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8, 'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12}
_PUBLICADO_EXT = re.compile(r'Publicad[oa] em:?\s*(\d{1,2}) de ([A-Za-zçÇ]+) de (\d{4})(?:\s*(?:às|as)\s*(\d{1,2}):(\d{2}))?', re.I)
_H1 = re.compile(r'<h1[^>]*>(.*?)</h1>', re.I | re.S)
_CANONICAL = re.compile(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)', re.I)
_PUBLICADO = re.compile(r'Publicad[oa] em:?\s*(\d{2})/(\d{2})/(\d{4})(?:\s*(?:às|as|-)?\s*(\d{1,2})[:h](\d{2}))?', re.I)


def _sem_acento_mantem_caixa(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s or '') if unicodedata.category(c) != 'Mn')


def slug_genial(titulo):
    t = _sem_acento_mantem_caixa(titulo or '').strip()
    t = re.sub(r'[()\[\]:,;!?."“”\'’‘%&/+*#]', '', t).replace('|', '')
    return re.sub(r'\s', '-', t)


def candidatos_genial(html_txt, tk):
    """Relatórios do ativo na página da Genial: [(endereços a tentar em ordem, título ou None)]. Links e dados embutidos
    primeiro; depois os títulos, com o endereço montado pelo título (e a variante "-2", que a Genial usa em títulos repetidos)."""
    out, vis = [], set()
    for m in re.finditer(r'/acoes/%s/([A-Za-z0-9][A-Za-z0-9\-]{8,240})/?' % re.escape(tk), html_txt):
        u = '%s/acoes/%s/%s/' % (GENIAL_BASE, tk, m.group(1))
        if u not in vis:
            vis.add(u)
            out.append(([u], None))
    texto = _html.unescape(re.sub(r'<[^>]+>', '\n', html_txt))
    for m in re.finditer(r'([^\n<>]{2,80}\(%s\)\s*\|[^\n<>]{5,220})' % re.escape(tk), texto):
        tit = conteudo.limpa_texto(m.group(1), 240)
        if re.match(r'\s*Protegido', tit, re.I):  # post com senha: não é público
            continue
        base = '%s/acoes/%s/%s/' % (GENIAL_BASE, tk, slug_genial(tit))
        if base not in vis:
            vis.add(base)
            out.append(([base, base[:-1] + '-2/'], tit))
    return out


def data_publicada(txt):
    """'Publicado em 23/10/2026 às 16:22' ou 'Publicado em 05 de Novembro de 2026 às 23:58:56' (página do relatório)."""
    limpo = re.sub(r'<[^>]+>', ' ', txt)
    m = _PUBLICADO.search(limpo)
    if m:
        d, mo, a, hh, mi = m.groups()
        return '%s-%s-%sT%02d:%s-03:00' % (a, mo, d, int(hh), mi) if hh else '%s-%s-%s' % (a, mo, d)
    m = _PUBLICADO_EXT.search(limpo)
    if m:
        d, mes, a, hh, mi = m.groups()
        mo = _MESES.get(sem_acento(mes))
        if mo:
            return '%s-%02d-%02dT%02d:%s-03:00' % (a, mo, int(d), int(hh), mi) if hh else '%s-%02d-%02d' % (a, mo, int(d))
    return None


def h1_da_pagina(txt):
    m = _H1.search(txt or '')
    return conteudo.limpa_texto(_html.unescape(re.sub(r'<[^>]+>', ' ', m.group(1))), 240) if m else ''


def genial_paginas(cfg, oregon, rede, robots, hoje, agora_, estado, log_=None):
    """Relatórios novos da Genial sobre as ações das carteiras. Devolve os itens novos (já classificados)."""
    c = (cfg.get('intel') or {}).get('genial') or {}
    if not c.get('ativo', True):
        return []
    max_pag, max_rel, intervalo = int(c.get('max_paginas_por_rodada', 3)), int(c.get('max_relatorios_por_rodada', 4)), float(c.get('intervalo_horas', 12))
    mapa = dict(TICKERS_GENIAL, **(c.get('tickers') or {}))
    E = estado.setdefault('genial', {'paginas': {}, 'vistos': []})
    vistos = set(E.get('vistos') or [])
    acoes = [t for t, a in sorted((oregon.get('ativos') or {}).items()) if a.get('classe') == 'Ações' and re.match(r'^[A-Z]{4}\d{1,2}$', t)]
    fila = []
    sem_cob = set(c.get('sem_cobertura') or SEM_COBERTURA_GENIAL)
    for t in acoes:
        ult = (E['paginas'].get(t) or {}).get('lida_em')
        try:
            if ult and (agora_ - dt.datetime.fromisoformat(ult)).total_seconds() < (168 if t in sem_cob else intervalo) * 3600:
                continue
        except ValueError:
            pass
        fila.append((ult or '', t))
    fila.sort()
    novos, abertos = [], 0
    for _u, t in fila[:max_pag]:
        if hasattr(rede, 'sem_tempo') and rede.sem_tempo():
            break
        tk = mapa.get(t, t)
        url = '%s/acoes/%s/' % (GENIAL_BASE, tk)
        E['paginas'][t] = {'lida_em': agora_.isoformat(timespec='minutes')}
        if robots is not None and not robots.permite(url):
            continue
        try:
            pagina = rede.get(FONTE_GENIAL['nome'], url, timeout=25, tentativas=1).decode('utf-8', 'replace')
        except Exception:
            E['paginas'][t]['erro'] = True
            continue
        cands = [(us, tit) for us, tit in candidatos_genial(pagina, tk) if us[0] not in vistos]
        E['paginas'][t]['candidatos'] = len(cands)
        for us, tit in cands:
            if abertos >= max_rel or (hasattr(rede, 'sem_tempo') and rede.sem_tempo()):
                break
            vistos.add(us[0])
            txt, u = None, None
            for alt in us:  # endereço montado pelo título: tenta a variante "-2" só se o primeiro não existir
                if robots is not None and not robots.permite(alt):
                    continue
                abertos += 1
                try:
                    txt, u = rede.get(FONTE_GENIAL['nome'], alt, timeout=20, tentativas=1).decode('utf-8', 'replace'), alt
                    break
                except Exception:
                    continue
            if txt is None:
                continue
            # endereço errado devolve a home sem erro: vale o h1 (o og:title às vezes difere) e o endereço canônico do relatório
            titulo = h1_da_pagina(txt) or titulo_da_pagina(txt) or tit or ''
            can = _CANONICAL.search(txt)
            if can and '/acoes/' not in can.group(1):
                continue
            if not titulo or not cita(titulo, t[:4], t, (oregon['ativos'].get(t) or {})) and tk.lower() not in sem_acento(titulo):
                continue
            x = conteudo._novo_item(dict(FONTE_GENIAL), titulo, u, None, agora_)
            if not x:
                continue
            x.pop('posicao_pagina', None)
            conteudo.ler_pagina_item(rede, None, x, FONTE_GENIAL, agora_, txt=txt)
            if not x.get('publicado_em'):
                dp = data_publicada(txt)
                if dp:
                    x['publicado_em'], x['data_estimada'], x['data_da_pagina'] = dp, False, True
                    x.pop('referencia', None)
            x['ativos'] = [t]
            x['ativos_porque'] = {t: 'relatório da Genial na página de %s' % tk}
            x['casa_fonte'] = FONTE_GENIAL['casa']
            x['origem'] = 'Genial Analisa · página da ação'
            analise.classificar(x, oregon, hoje)
            x['analise'] = analise.analisar_regras(x, oregon)
            novos.append(x)
    E['vistos'] = sorted(vistos)[-1500:]
    if log_ and (abertos or fila):
        log_('  Genial: %d páginas de ação lidas, %d relatórios abertos, %d novos' % (min(len(fila), max_pag), abertos, len(novos)))
    return novos
