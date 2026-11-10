# -*- coding: utf-8 -*-
"""v4.0.1 · Assuntos do momento (Hoje do painel).

Conta, por assunto, os itens publicados (notícias, opiniões, cartas, estudos, documentos) cujo TÍTULO tem uma das palavras
da lista conferível em robo/assuntos.json, e compara a fatia de cada assunto com a de um período de comparação:
  - últimas 24 h  × as 7 × 24 h anteriores;
  - últimos 7 dias × os 28 dias anteriores;
  - últimos 30 dias × os 60 dias anteriores.
Usa fatia (assunto ÷ total do período), e não a contagem, porque o volume coletado muda (mais fontes, rodadas mais
frequentes): pela contagem pura, tudo pareceria subir.

Regra da seta (sem nota nem pontuação):
  - sem_base: o período de comparação tem menos de BASE_MIN itens;
  - sobe: fatia pelo menos 1,5 vez a da comparação e pelo menos N_MIN itens no período;
  - cai: fatia no máximo 2/3 da comparação e pelo menos N_MIN itens esperados (fatia anterior × total do período);
  - novo: nenhum item na comparação e pelo menos N_MIN agora;
  - estavel: o resto.

A mesma forma de achar as palavras está no painel (painel/src/ui_v401.js, assuntosDe): sem acento, minúsculas, só letras e
números, palavra inteira; '*' pega o começo da palavra; 'exatas' valem como escritas (IA, AI, Irã). O teste
testes/test_v401.py confere que Python e JavaScript acham as mesmas palavras nos mesmos títulos.

Arquivo publicado: data/biblioteca/assuntos.json (vai para o site junto com a biblioteca, sem mexer no robo.yml).
O histórico diário fica no próprio arquivo; cada rodada recalcula só os últimos 10 dias. Se a lista de palavras mudar, o
robô relê 95 dias da biblioteca e refaz o histórico na rodada seguinte."""
import datetime as dt
import hashlib
import json
import os
import re
import unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
ARQ_DEF = os.path.join(AQUI, 'assuntos.json')
BRT = dt.timezone(dt.timedelta(hours=-3))
BASE_MIN = 300
N_MIN = 5
SOBE, CAI = 1.5, 2.0 / 3.0
DIAS_RECALC = 10
DIAS_COMPLETO = 95
DIAS_HIST = 120
ULTIMOS = 20
JANELAS = (('24h', 'últimas 24 h', '7 dias anteriores'), ('7d', 'últimos 7 dias', '28 dias anteriores'), ('30d', 'últimos 30 dias', '60 dias anteriores'))
CAMPOS_ULT = ('id', 'titulo', 'link', 'organizacao', 'fonte', 'publicado_em', 'categoria', 'natureza', 'idioma')
_COMB = re.compile('[̀-ͯ]')
_NAO_AN = re.compile('[^a-z0-9]+')
_TOKEN = re.compile('[^0-9A-Za-zÀ-ÖØ-öø-ɏ]+')


def carregar_definicoes(caminho=None):
    with open(caminho or ARQ_DEF, encoding='utf-8') as f:
        js = json.load(f)
    lista = js.get('assuntos') if isinstance(js, dict) else js
    out, vistos = [], set()
    for a in lista or []:
        if not a.get('id') or not a.get('nome') or a['id'] in vistos or not (a.get('palavras') or a.get('exatas')):
            continue
        vistos.add(a['id'])
        out.append({'id': a['id'], 'nome': a['nome'], 'palavras': list(a.get('palavras') or []), 'exatas': list(a.get('exatas') or [])})
    return out


def marca_definicoes(defs):
    return hashlib.sha1(json.dumps(defs, ensure_ascii=False, sort_keys=True).encode('utf-8')).hexdigest()[:12]


def normalizar(txt):
    """Minúsculas, sem acento (só os acentos combinantes U+0300–U+036F, como no painel), só letras e números."""
    s = unicodedata.normalize('NFD', str(txt or '').lower())
    s = _COMB.sub('', s)
    return _NAO_AN.sub(' ', s).strip()


def _alternativa(p):
    estrela = p.endswith('*')
    base = normalizar(p[:-1] if estrela else p)
    if not base:
        return None
    return re.escape(base).replace('\\ ', ' ') + ('[a-z0-9]*' if estrela else '')


def compilar(defs):
    out = []
    for a in defs:
        alts = [x for x in (_alternativa(p) for p in a.get('palavras') or []) if x]
        rx = re.compile(' (?:' + '|'.join(alts) + ')(?= )') if alts else None
        out.append((a['id'], rx, set(a.get('exatas') or [])))
    return out


def assuntos_de(titulo, comp):
    """Ids dos assuntos cujas palavras aparecem no título."""
    alvo = ' ' + normalizar(titulo) + ' '
    tokens = set(t for t in _TOKEN.split(str(titulo or '')) if t)
    return [i for i, rx, ex in comp if (rx is not None and rx.search(alvo)) or (ex and tokens & ex)]


def momento(x):
    """Data e hora de publicação (só a data: meio-dia em Brasília, como no painel). Sem publicação: None."""
    p = x.get('publicado_em') or ''
    if not p:
        return None
    if len(p) <= 10:
        p = p[:10] + 'T12:00:00-03:00'
    try:
        t = dt.datetime.fromisoformat(p)
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=BRT)


def tendencia(n, total, n_c, total_c):
    if total_c < BASE_MIN or total <= 0:
        return 'sem_base', None
    if n_c == 0:
        return ('novo' if n >= N_MIN else 'estavel'), None
    razao = (n / total) / (n_c / total_c)
    if razao >= SOBE and n >= N_MIN:
        return 'sobe', razao
    if razao <= CAI and (n_c / total_c) * total >= N_MIN:
        return 'cai', razao
    return 'estavel', razao


def _janela(rot, rot_c, n, total, n_c, total_c, ids):
    out = {'rotulo': rot, 'total': total, 'comparacao': {'rotulo': rot_c, 'total': total_c}, 'assuntos': {}}
    for i in ids:
        a, b = n.get(i, 0), n_c.get(i, 0)
        tend, razao = tendencia(a, total, b, total_c)
        out['assuntos'][i] = {'n': a, 'fatia': round(100.0 * a / total, 2) if total else 0.0, 'n_c': b,
                              'fatia_c': round(100.0 * b / total_c, 2) if total_c else 0.0, 'razao': round(razao, 2) if razao is not None else None, 'tendencia': tend}
    return out


def calcular(itens, agora, defs, anterior=None, dias_recalc=DIAS_RECALC):
    """itens: os itens publicados dos últimos `dias_recalc` dias (sem agrupados, acervo e fontes bloqueadas)."""
    comp = compilar(defs)
    ids = [a['id'] for a in defs]
    agora = agora if agora.tzinfo else agora.replace(tzinfo=BRT)
    hoje = agora.astimezone(BRT).date()
    ini_recalc = hoje - dt.timedelta(days=dias_recalc - 1)
    marcados, por_dia = [], {}
    for k in range(dias_recalc):
        por_dia[(ini_recalc + dt.timedelta(days=k)).isoformat()] = {'t': 0, 'n': {}}
    for x in itens:
        t = momento(x)
        if t is None or t > agora + dt.timedelta(hours=6):
            continue
        acha = assuntos_de(x.get('titulo'), comp)
        marcados.append((t, x, acha))
        d = t.astimezone(BRT).date().isoformat()
        if d in por_dia:
            por_dia[d]['t'] += 1
            for i in acha:
                por_dia[d]['n'][i] = por_dia[d]['n'].get(i, 0) + 1
    # histórico: dias antigos do arquivo anterior (mesma lista de palavras) + os dias recalculados agora
    dias = {}
    if anterior and anterior.get('marca') == marca_definicoes(defs):
        for d, v in (anterior.get('dias') or {}).items():
            if d < ini_recalc.isoformat():
                dias[d] = v
    dias.update(por_dia)
    corte = (hoje - dt.timedelta(days=DIAS_HIST - 1)).isoformat()
    dias = {d: dias[d] for d in sorted(dias) if corte <= d <= hoje.isoformat()}
    janelas = {}
    # 24 h: pela hora de publicação; comparação com as 7 × 24 h anteriores
    lim24, lim8 = agora - dt.timedelta(hours=24), agora - dt.timedelta(days=8)
    n, n_c, tot, tot_c = {}, {}, 0, 0
    for t, x, acha in marcados:
        if lim24 < t <= agora + dt.timedelta(hours=6):
            tot += 1
            for i in acha:
                n[i] = n.get(i, 0) + 1
        elif lim8 < t <= lim24:
            tot_c += 1
            for i in acha:
                n_c[i] = n_c.get(i, 0) + 1
    janelas['24h'] = _janela(JANELAS[0][1], JANELAS[0][2], n, tot, n_c, tot_c, ids)
    # 7 e 30 dias: por dia (hoje entra até agora)
    for chave, rot, rot_c, tam, tam_c in (('7d', JANELAS[1][1], JANELAS[1][2], 7, 28), ('30d', JANELAS[2][1], JANELAS[2][2], 30, 60)):
        ini = hoje - dt.timedelta(days=tam - 1)
        ini_c = ini - dt.timedelta(days=tam_c)
        n, n_c, tot, tot_c = {}, {}, 0, 0
        for d, v in dias.items():
            if d >= ini.isoformat():
                alvo_n, soma = n, 1
            elif d >= ini_c.isoformat():
                alvo_n, soma = n_c, 0
            else:
                continue
            if soma:
                tot += v.get('t', 0)
            else:
                tot_c += v.get('t', 0)
            for i, q in (v.get('n') or {}).items():
                alvo_n[i] = alvo_n.get(i, 0) + q
        janelas[chave] = _janela(rot, rot_c, n, tot, n_c, tot_c, ids)
    ultimos = {}
    for t, x, acha in sorted(marcados, key=lambda o: o[0], reverse=True):
        if t > agora + dt.timedelta(hours=6):
            continue
        for i in acha:
            lst = ultimos.setdefault(i, [])
            if len(lst) < ULTIMOS:
                lst.append({k: x[k] for k in CAMPOS_ULT if x.get(k)})
    return {'gerado_em': agora.isoformat(timespec='minutes'), 'marca': marca_definicoes(defs),
            'metodo': 'Itens publicados (notícias, opiniões, cartas, estudos e documentos) com uma das palavras do assunto no título '
                      '(robo/assuntos.json). Seta: fatia do assunto no período comparada com a fatia no período de comparação; '
                      'sobe com pelo menos 1,5 vez e %d itens; cai com no máximo 2/3; sem base com menos de %d itens na comparação.' % (N_MIN, BASE_MIN),
            'assuntos': defs, 'janelas': janelas, 'dias': dias, 'ultimos': ultimos}


def publicar(agora, anterior, carregar, defs=None):
    """carregar(dias) devolve os itens dos últimos `dias` dias. Primeira vez, ou lista de palavras nova: relê 95 dias."""
    defs = defs or carregar_definicoes()
    completo = not anterior or anterior.get('marca') != marca_definicoes(defs) or not anterior.get('historico_completo')
    dias = DIAS_COMPLETO if completo else DIAS_RECALC
    out = calcular(carregar(dias), agora, defs, anterior=None if completo else anterior, dias_recalc=dias)
    out['historico_completo'] = True
    return out


def resumo(js):
    j = (js.get('janelas') or {}).get('24h') or {}
    top = sorted((j.get('assuntos') or {}).items(), key=lambda kv: -kv[1]['n'])[:3]
    nomes = {a['id']: a['nome'] for a in js.get('assuntos') or []}
    return '%d itens em 24 h; mais falados: %s' % (j.get('total', 0), ', '.join('%s %d' % (nomes.get(i, i), v['n']) for i, v in top) or 'nenhum')
