"""v3.10 · Mercado hoje (macro do Brasil) no briefing do Telegram.

Manchetes de macro do Brasil (analise.macro_br: agenda do dia, juros, inflação, câmbio, bolsa, fiscal, atividade) das
últimas horas, sem repetir o mesmo fato, com a agenda do dia primeiro. Veículo do Grupo XP (InfoMoney) não entra: ele
aparece só no painel, marcado, e nunca em material que possa ir para cliente.
"""
import datetime as dt
import html
import re

import analise
from util import sem_acento

FORA = ('promocional', 'recomendacao', 'sensacionalista')
_PARADA = {'para', 'com', 'que', 'dos', 'das', 'nos', 'nas', 'por', 'uma', 'sobre', 'apos', 'mais', 'mas', 'como', 'seu', 'sua',
           'veja', 'nesta', 'hoje', 'diz', 'the', 'and'}


def _quando(iso):
    try:
        d = dt.datetime.fromisoformat(str(iso).replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return None
    return d if d.tzinfo else d.replace(tzinfo=dt.timezone(dt.timedelta(hours=-3)))


def _fichas(t):
    return {w for w in re.sub(r'[^a-z0-9% ]', ' ', sem_acento(t or '').lower()).split() if len(w) > 2 and w not in _PARADA}


def grupo_xp(x):
    return bool(re.search(r'grupo xp|infomoney|xp investimentos|expert xp|conteudos xp|rico invest|clear corretora',
                          sem_acento(' '.join(str(x.get(k) or '') for k in ('aviso_fonte', 'organizacao', 'fonte'))).lower()))


def macro_de(x):
    if x.get('categoria') not in ('veiculo', 'instituicao'):
        return []
    return x.get('macro_br') or analise.macro_br(x.get('titulo'), x.get('idioma'))


def escolher(itens, agora_, horas=18, maximo=5):
    """As manchetes de macro do Brasil das últimas `horas`: agenda do dia primeiro, depois pela nota do robô e pela hora;
    o mesmo fato em vários veículos entra uma vez."""
    if agora_.tzinfo is None:
        agora_ = agora_.replace(tzinfo=dt.timezone(dt.timedelta(hours=-3)))
    cands = []
    for x in itens or []:
        if not x.get('titulo') or not x.get('link') or x.get('acervo') or x.get('agrupado_em') or x.get('natureza') in FORA or grupo_xp(x):
            continue
        mb = macro_de(x)
        if not mb:
            continue
        q = _quando(x.get('publicado_em'))
        if not q or q > agora_ + dt.timedelta(minutes=10) or agora_ - q > dt.timedelta(hours=horas):
            continue
        pontos = ((x.get('prioridade') or {}).get('pontos') or 0)
        cands.append(((1 if 'agenda' in mb else 0, pontos, q), x))
    cands.sort(key=lambda c: c[0], reverse=True)
    out, vistos = [], []
    for _k, x in cands:
        f = _fichas(x['titulo'])
        if any(f and v and len(f & v) / float(min(len(f), len(v))) >= 0.6 for v in vistos):
            continue
        vistos.append(f)
        out.append(x)
        if len(out) >= maximo:
            break
    return out


def linhas_telegram(itens, agora_, horas=18, maximo=5):
    """Seção "Mercado hoje · Brasil" do briefing (HTML do Telegram). Lista vazia quando não há manchete."""
    sel = escolher(itens, agora_, horas, maximo)
    if not sel:
        return []
    linhas = ['\n<b>Mercado hoje · Brasil</b>']
    for x in sel:
        fonte = x.get('organizacao') or x.get('fonte') or ''
        linhas.append('• <a href="%s">%s</a>%s' % (html.escape(x['link'], quote=True), html.escape(x['titulo']), (' — ' + html.escape(fonte)) if fonte else ''))
    return linhas
