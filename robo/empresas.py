# -*- coding: utf-8 -*-
"""v4.1 · "O que o mercado está falando" (tela Brasil): as empresas mais citadas nas manchetes e a macro do Brasil.

Empresas
  - Da carteira Oregon e da VG VIP: os mesmos termos e exclusões que o robô já usa para ligar a notícia ao ativo
    (robo/config.json, ativos[].noticias.termos / excluir; noticias.pertence).
  - As demais: aprendidas nas próprias manchetes. Quando a imprensa escreve "Embraer (EMBJ3)", o robô guarda o par
    código → nome e passa a reconhecer a empresa pelo código e pelo nome (maiúscula exata). Nada sai de lista feita de
    memória. Palavras comuns que também são nome de empresa (Vale, Porto, Vamos, Brava…) só valem pelo código, a não ser
    na carteira, onde há exclusões conferidas. BDRs de empresas de fora (final 34 e 35) e contratos futuros ficam fora.
  - Os pares aprendidos ficam no próprio arquivo publicado (`aprendidas`), com quantas vezes cada nome apareceu.
Macro do Brasil
  - A marcação que o robô já faz no Mercado hoje (x.macro_br): agenda, juros, inflação, câmbio, bolsa, fiscal, atividade.

Contagem e seta: a mesma regra dos Assuntos do momento (robo/assuntos.py): fatia do total no período contra a fatia no
período de comparação (24 h × 7 dias; 7 dias × 28; 30 dias × 60). Histórico diário no próprio arquivo; cada rodada
recalcula os últimos 10 dias; na primeira vez (ou quando a carteira muda) relê 95 dias.
Arquivo publicado: data/biblioteca/empresas.json (vai para o site com a biblioteca, sem mexer no robo.yml)."""
import collections
import datetime as dt
import hashlib
import json
import re

import assuntos
import noticias
from util import sem_acento

BRT = assuntos.BRT
DIAS_RECALC, DIAS_COMPLETO, DIAS_HIST = 10, 95, 120
TOP = 20
ULTIMOS = 15
MACRO = ('atividade', 'juros', 'inflacao', 'cambio', 'fiscal', 'bolsa', 'agenda')
PAR = re.compile(r"([A-ZÀ-Ý][\wÀ-ÿ&'.-]*(?:\s+(?:d[aeo]s?|&|[A-ZÀ-Ý0-9][\wÀ-ÿ&'.-]*)){0,3})\s*\(([A-Z]{4}\d{1,2})\)")
INICIO = re.compile(r'^(?:(?:lucro|lucros|acoes|acao|dividendos|jcp|scp|controlada|resultado|resultados|receita|entra|sai|papel|papeis|balanco|ebitda|oferta|venda|'
                    r'compra|ceo|presidente|fundador|acionistas|conselho|diretor|diretora|vendas|producao|caso)\s+(?:d[aeo]s?\s+)?)+')
COMUNS = {'porto', 'vamos', 'brava', 'tim', 'grupo', 'banco', 'brasil', 'vale', 'oi', 'via', 'rede', 'natura', 'ultra', 'mini indice', 'minidolar', 'mini dolar',
          'bolsa', 'ibovespa', 'mercado', 'governo', 'ouro', 'prata', 'cielo', 'alpargatas'}
CLASSES = re.compile(r'\s+(ON|PN|PNA|PNB|S\.A\.|SA|Unit|UNT)$')


def _fora(ticker):
    return bool(re.match(r'^(WIN|WDO|IND|DOL|BGI|CCM)', ticker) or re.search(r'3[45]$', ticker))


def da_carteira(cfg):
    """Ações e units da carteira e da VG VIP com termos de notícia (fundos imobiliários e ETFs ficam de fora)."""
    out = {}
    for a in cfg.get('ativos') or []:
        n = a.get('noticias') or {}
        t = a.get('id') or ''
        if not n.get('termos') or not re.match(r'^[A-Z]{4}\d{1,2}$', t) or (a.get('classe') or '') != 'acao':
            continue
        out[t] = {'nome': CLASSES.sub('', a.get('nome') or t), 'termos': list(n['termos']), 'excluir': list(n.get('excluir') or []), 'carteira': True}
    return out


def aprender(itens, anteriores=None):
    """Pares "Nome (TICK3)" das manchetes: {ticker: {grafia: vezes}}; soma com os que já estavam no arquivo."""
    out = collections.defaultdict(collections.Counter)
    for t, c in (anteriores or {}).items():
        for n, q in (c.get('nomes') or {}).items():
            out[t][n] += q
    for x in itens:
        for m in PAR.finditer(x.get('titulo') or ''):
            t = m.group(2)
            if _fora(t):
                continue
            nome = m.group(1).strip()
            limpo = INICIO.sub('', sem_acento(nome).lower()).strip()
            if len(limpo) < 3:
                continue
            out[t][' '.join(nome.split()[-len(limpo.split()):])] += 1
    return out


def definicoes(cfg, aprendidas):
    defs = da_carteira(cfg)
    raizes = {t[:4] for t in defs}
    # a mesma empresa com mais de um código (SANB3, SANB4, SANB11): uma linha só, no código mais citado
    grupos = collections.defaultdict(list)
    for t, c in aprendidas.items():
        if t in defs or t[:4] in raizes or _fora(t) or not c:
            continue
        grupos[t[:4]].append((sum(c.values()), t, c))
    for _raiz, l in grupos.items():
        l.sort(key=lambda o: (-o[0], o[1]))
        t = l[0][1]
        por, graf = collections.Counter(), {}
        for _q, _t, c in l:
            for n, q in c.items():
                k = sem_acento(n).lower()
                por[k] += q
                graf.setdefault(k, n)
        k = por.most_common(1)[0][0]
        termos = ['=' + o[1] for o in l]
        if k not in COMUNS and len(k) >= 3:
            termos.append('=' + graf[k])
        defs[t] = {'nome': graf[k], 'termos': termos, 'excluir': [], 'carteira': False}
    return defs


def marca(defs):
    """Identidade das empresas da carteira (termos e exclusões). Nome aprendido nas manchetes não refaz o histórico: entra
    nos 10 dias recalculados a cada rodada; a carteira mudar, sim."""
    return hashlib.sha1(json.dumps({t: [d['termos'], d['excluir']] for t, d in sorted(defs.items()) if d.get('carteira')}, ensure_ascii=False).encode('utf-8')).hexdigest()[:12]


# as áreas de análise e gestão dos bancos citadas como fonte da opinião não são notícia do banco
CASAS = re.compile(r'(Bradesco|Itaú|Itau|Santander|Safra|BTG Pactual|BB|Caixa)\s+(BBI|BBA|Asset|Corretora|Research|Investimentos|Investment Bank|Securities)\b')


def empresas_de(titulo, defs):
    tit = CASAS.sub(' ', titulo or '')
    return [t for t, d in defs.items() if noticias.pertence(tit, {'termos': d['termos'], 'excluir': d['excluir']})]


def _linhas(n, n_c, tot, tot_c, ids):
    out = {}
    for i in ids:
        a, b = n.get(i, 0), n_c.get(i, 0)
        tend, raz = assuntos.tendencia(a, tot, b, tot_c)
        out[i] = {'n': a, 'fatia': round(100.0 * a / tot, 2) if tot else 0.0, 'n_c': b, 'fatia_c': round(100.0 * b / tot_c, 2) if tot_c else 0.0,
                  'razao': round(raz, 2) if raz is not None else None, 'tendencia': tend}
    return out


def calcular(itens, agora, defs, anterior=None, dias_recalc=DIAS_RECALC):
    agora = agora if agora.tzinfo else agora.replace(tzinfo=BRT)
    hoje = agora.astimezone(BRT).date()
    ini = hoje - dt.timedelta(days=dias_recalc - 1)
    por_dia = {(ini + dt.timedelta(days=k)).isoformat(): {'t': 0, 'e': {}, 'm': {}} for k in range(dias_recalc)}
    marc = []
    for x in itens:
        t = assuntos.momento(x)
        if t is None or t > agora + dt.timedelta(hours=6):
            continue
        es, ms = empresas_de(x.get('titulo'), defs), [k for k in (x.get('macro_br') or []) if k in MACRO]
        marc.append((t, x, es, ms))
        d = t.astimezone(BRT).date().isoformat()
        if d in por_dia:
            v = por_dia[d]
            v['t'] += 1
            for e in es:
                v['e'][e] = v['e'].get(e, 0) + 1
            for k in ms:
                v['m'][k] = v['m'].get(k, 0) + 1
    dias = {}
    if anterior and anterior.get('marca') == marca(defs):
        dias = {d: v for d, v in (anterior.get('dias') or {}).items() if d < ini.isoformat()}
    dias.update(por_dia)
    corte = (hoje - dt.timedelta(days=DIAS_HIST - 1)).isoformat()
    dias = {d: dias[d] for d in sorted(dias) if corte <= d <= hoje.isoformat()}
    janelas = {}
    # 24 h pela hora de publicação × as 7 × 24 h anteriores
    lim24, lim8 = agora - dt.timedelta(hours=24), agora - dt.timedelta(days=8)
    ne, nec, nm, nmc, tot, tot_c = collections.Counter(), collections.Counter(), collections.Counter(), collections.Counter(), 0, 0
    for t, x, es, ms in marc:
        if t > lim24:
            tot += 1; ne.update(es); nm.update(ms)
        elif t > lim8:
            tot_c += 1; nec.update(es); nmc.update(ms)
    janelas['24h'] = (ne, nec, nm, nmc, tot, tot_c, 'últimas 24 h', '7 dias anteriores')
    for chave, tam, tam_c, rot, rot_c in (('7d', 7, 28, 'últimos 7 dias', '28 dias anteriores'), ('30d', 30, 60, 'últimos 30 dias', '60 dias anteriores')):
        i0 = (hoje - dt.timedelta(days=tam - 1)).isoformat()
        i1 = (hoje - dt.timedelta(days=tam - 1 + tam_c)).isoformat()
        ne, nec, nm, nmc, tot, tot_c = collections.Counter(), collections.Counter(), collections.Counter(), collections.Counter(), 0, 0
        for d, v in dias.items():
            if d >= i0:
                tot += v.get('t', 0); ne.update(v.get('e') or {}); nm.update(v.get('m') or {})
            elif d >= i1:
                tot_c += v.get('t', 0); nec.update(v.get('e') or {}); nmc.update(v.get('m') or {})
        janelas[chave] = (ne, nec, nm, nmc, tot, tot_c, rot, rot_c)
    out_j, usados = {}, set()
    for k, (ne, nec, nm, nmc, tot, tot_c, rot, rot_c) in janelas.items():
        top = [t for t, _ in sorted(ne.items(), key=lambda kv: (-kv[1], kv[0]))[:TOP]]
        usados.update(top)
        out_j[k] = {'rotulo': rot, 'comparacao_rotulo': rot_c, 'total': tot, 'comparacao': {'total': tot_c},
                    'empresas': _linhas(ne, nec, tot, tot_c, top), 'macro': _linhas(nm, nmc, tot, tot_c, list(MACRO))}
    ultimos = {}
    for t, x, es, ms in sorted(marc, key=lambda o: o[0], reverse=True):
        for e in es:
            if e in usados:
                l = ultimos.setdefault(e, [])
                if len(l) < ULTIMOS:
                    l.append({k: x[k] for k in ('id', 'titulo', 'link', 'organizacao', 'publicado_em') if x.get(k)})
    return {'gerado_em': agora.isoformat(timespec='minutes'), 'marca': marca(defs),
            'metodo': 'Empresas: código na manchete ou nome (carteira: termos do robô; demais: pares "Nome (CÓDIGO)" vistos nas manchetes). '
                      'Macro: marcação do Mercado hoje. Seta: fatia no período contra a do período de comparação (a regra dos Assuntos do momento).',
            'empresas': {t: {'nome': defs[t]['nome'], 'carteira': defs[t]['carteira']} for t in sorted(usados)},
            'janelas': out_j, 'dias': dias, 'ultimos': ultimos}


def publicar(agora, anterior, carregar, cfg):
    """carregar(dias) devolve os itens publicados dos últimos `dias` dias (sem agrupados, acervo e fontes bloqueadas)."""
    anterior = anterior or {}
    completo = not anterior.get('historico_completo')
    itens = carregar(DIAS_COMPLETO if completo else DIAS_RECALC)
    aprendidas = aprender(itens, None if completo else anterior.get('aprendidas'))
    defs = definicoes(cfg, aprendidas)
    if not completo and anterior.get('marca') != marca(defs):  # a carteira mudou: refaz o histórico
        itens = carregar(DIAS_COMPLETO)
        completo = True
    out = calcular(itens, agora, defs, anterior=None if completo else anterior, dias_recalc=DIAS_COMPLETO if completo else DIAS_RECALC)
    out['aprendidas'] = {t: {'nomes': dict(c.most_common(5))} for t, c in sorted(aprendidas.items()) if t in defs and not defs[t]['carteira']}
    out['historico_completo'] = True
    return out


def resumo(js):
    j = (js.get('janelas') or {}).get('24h') or {}
    top = sorted((j.get('empresas') or {}).items(), key=lambda kv: -kv[1]['n'])[:3]
    nomes = js.get('empresas') or {}
    return '%d itens em 24 h; empresas mais citadas: %s' % (j.get('total', 0), ', '.join('%s %d' % ((nomes.get(t) or {}).get('nome', t), v['n']) for t, v in top) or 'nenhuma')
