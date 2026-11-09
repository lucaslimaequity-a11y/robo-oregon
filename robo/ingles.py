"""v3.9 · Inglês do mercado: glossário em inglês e a frase do dia no Telegram.

O glossário (robo/glossario_en.json) é escrito à mão e é a mesma fonte do painel (Biblioteca › Inglês).
A frase do dia é uma manchete em inglês coletada pelo robô nas últimas 36 horas, com os termos do glossário que
aparecem nela. Não há tradução automática no robô (nenhuma API paga): a mensagem leva um link para o Google
Tradutor, que abre no navegador de quem lê, e outro para praticar no painel.
"""
import datetime as dt
import html
import json
import os
import re
import urllib.parse

AQUI = os.path.dirname(os.path.abspath(__file__))
SITE = 'https://lucaslimaequity-a11y.github.io/robo-oregon/'
# títulos que não servem para estudo: agendas, transcrições e listas automáticas
RUIDO = re.compile(r'earnings (preview|call)|transcript|^latest .* news|podcast|webinar|live updates?|^watch:|^video:|\bq[1-4] \d{4} earnings\b|\|', re.I)
_CACHE = {}


def glossario(caminho=None):
    """Carrega o glossário uma vez. Sem arquivo, devolve lista vazia (a frase do dia simplesmente não sai)."""
    p = caminho or os.path.join(AQUI, 'glossario_en.json')
    if p not in _CACHE:
        try:
            with open(p, encoding='utf-8') as f:
                _CACHE[p] = (json.load(f) or {}).get('termos') or []
        except (OSError, ValueError):
            _CACHE[p] = []
    return _CACHE[p]


def _padroes(glos):
    chave = id(glos)
    if chave in _CACHE:
        return _CACHE[chave]
    out = []
    for i, t in enumerate(glos):
        for fm in t.get('f') or []:
            # forma toda em minúsculas: ignora maiúsculas; forma com maiúscula (Fed, AI, SEC): só a grafia exata
            flags = re.I if fm == fm.lower() else 0
            out.append((i, re.compile(r'(?<![A-Za-z0-9])' + re.escape(fm) + r'(?![A-Za-z0-9])', flags)))
    _CACHE[chave] = out
    return out


def termos_em(texto, glos):
    """Termos do glossário presentes no texto, sem sobreposição (a forma mais longa vence), na ordem do texto."""
    achados = []
    for i, rx in _padroes(glos):
        for m in rx.finditer(texto or ''):
            achados.append((m.start(), m.end(), i))
    achados.sort(key=lambda a: (-(a[1] - a[0]), a[0]))
    usados, ok = [], []
    for a in achados:
        if any(a[0] < b[1] and b[0] < a[1] for b in usados):
            continue
        usados.append(a)
        ok.append(a)
    ok.sort()
    return [{'ini': a[0], 'fim': a[1], 'termo': glos[a[2]]} for a in ok]


def _quando(iso):
    try:
        d = dt.datetime.fromisoformat(str(iso).replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return None
    return d if d.tzinfo else d.replace(tzinfo=dt.timezone(dt.timedelta(hours=-3)))


def escolher_frase(itens, glos, agora_, horas=36):
    """A manchete em inglês das últimas `horas` com mais termos do glossário (2 ou mais; se não houver, 1).
    Empate: empresa das carteiras, depois research e instituições, depois a mais recente."""
    if agora_.tzinfo is None:
        agora_ = agora_.replace(tzinfo=dt.timezone(dt.timedelta(hours=-3)))
    cands = []
    vistos = set()
    for x in itens or []:
        tit = (x.get('titulo') or '').strip()
        if x.get('idioma') != 'en' or not tit or not x.get('link') or RUIDO.search(tit):
            continue
        n = len(tit.split())
        if n < 6 or n > 18:
            continue
        q = _quando(x.get('publicado_em'))
        if not q or q > agora_ + dt.timedelta(minutes=10) or agora_ - q > dt.timedelta(hours=horas):
            continue
        k = re.sub(r'\W+', ' ', tit.lower()).strip()
        if k in vistos:
            continue
        vistos.add(k)
        ts = termos_em(tit, glos)
        unicos = []
        for t in ts:
            if t['termo']['t'] not in [u['t'] for u in unicos]:
                unicos.append(t['termo'])
        if not unicos:
            continue
        carteira = 1 if (x.get('ativos') or x.get('ativos_vip')) else 0
        casa = 1 if x.get('categoria') in ('gestora_internacional', 'instituicao') else 0
        cands.append(((min(len(unicos), 4), carteira, casa, q), x, unicos))
    if not cands:
        return None
    melhor = max(cands, key=lambda c: c[0])
    if melhor[0][0] < 2:
        dois = [c for c in cands if c[0][0] >= 2]
        if dois:
            melhor = max(dois, key=lambda c: c[0])
    return {'item': melhor[1], 'termos': melhor[2]}


def linhas_telegram(itens, agora_, site=None, glos=None, maximo_termos=3):
    """Seção "Inglês do dia" do briefing do Telegram (HTML do Telegram). Lista vazia quando não há manchete boa."""
    glos = glossario() if glos is None else glos
    if not glos:
        return []
    f = escolher_frase(itens, glos, agora_)
    if not f:
        return []
    x = f['item']
    tit = x.get('titulo') or ''
    fonte = x.get('organizacao') or x.get('fonte') or ''
    trad = 'https://translate.google.com/?sl=en&tl=pt&text=' + urllib.parse.quote(tit) + '&op=translate'
    praticar = (site or SITE).rstrip('/') + '/#bib/ingles'
    linhas = ['\n<b>Inglês do dia</b>',
              '<a href="%s">%s</a>%s' % (html.escape(x['link'], quote=True), html.escape(tit), (' — ' + html.escape(fonte)) if fonte else '')]
    for t in f['termos'][:maximo_termos]:
        linhas.append('• <b>%s</b>: %s' % (html.escape(t['t']), html.escape(t['pt'])))
    linhas.append('<a href="%s">Traduzir a frase</a> · <a href="%s">Ouvir e praticar no Oregon</a>' % (html.escape(trad, quote=True), html.escape(praticar, quote=True)))
    return linhas
