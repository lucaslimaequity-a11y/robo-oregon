# -*- coding: utf-8 -*-
"""Agenda macro dos próximos dias, para o briefing do painel.

Fontes:
  - IBGE: API pública de calendário de divulgações (servicodados.ibge.gov.br/api/v3/calendario), filtrada pelos
    produtos que interessam às carteiras (IPCA, PIB, PNAD, indústria, comércio, serviços);
  - Copom e Fed (FOMC): calendários oficiais, publicados pelo Banco Central e pelo Federal Reserve uma vez por ano,
    guardados em config.json (agenda_macro) com o link da página oficial;
  - Relatório Focus: publicado pelo Banco Central às segundas-feiras; a data aparece como "prevista" porque um
    feriado pode mudar o dia.
Nada é estimado: um evento sem data oficial não entra. Se a API do IBGE falhar, a agenda segue com os calendários
oficiais e a falha aparece no relatório da rodada.
"""
import datetime as dt
import re

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None

from util import ErroFonte, sem_acento

URL_IBGE = 'https://servicodados.ibge.gov.br/api/v3/calendario/?de=%s&ate=%s&tipo=1&qtd=100'
PAGINA_IBGE = 'https://www.ibge.gov.br/calendario.html'


def _link(u):
    u = str(u or '').strip()
    return u if re.match(r'^https?://', u, re.I) else None


def data_ibge(txt):
    """'dd/mm/aaaa HH:MM:SS' ou ISO → ('aaaa-mm-dd', 'HH:MM' ou None)."""
    txt = str(txt or '').strip()
    m = re.match(r'^(\d{2})/(\d{2})/(\d{4})(?:\s+(\d{2}):(\d{2}))?', txt)
    if m:
        hora = '%s:%s' % (m.group(4), m.group(5)) if m.group(4) and (m.group(4), m.group(5)) != ('00', '00') else None
        return '%s-%s-%s' % (m.group(3), m.group(2), m.group(1)), hora
    m = re.match(r'^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?', txt)
    if m:
        hora = '%s:%s' % (m.group(2), m.group(3)) if m.group(2) and (m.group(2), m.group(3)) != ('00', '00') else None
        return m.group(1), hora
    return None, None


def ibge(rede, hoje, dias, produtos):
    de = hoje.strftime('%m-%d-%Y')
    ate = (hoje + dt.timedelta(days=dias)).strftime('%m-%d-%Y')
    j = rede.get_json('IBGE agenda', URL_IBGE % (de, ate), timeout=60, tentativas=3)  # a API do IBGE às vezes demora mais de 30 s
    itens = j.get('items') if isinstance(j, dict) else j
    if not isinstance(itens, list):
        raise ErroFonte('IBGE agenda', 'formato', 'sem lista de itens')
    alvos = [sem_acento(p) for p in (produtos or [])]
    out, vistos = [], set()
    for it in itens:
        if not isinstance(it, dict):
            continue
        tit = str(it.get('titulo') or '').strip()
        prod = it.get('produto')
        if isinstance(prod, dict):
            prod = prod.get('nome') or prod.get('titulo') or ''
        prod = str(prod or '').strip()
        txt = sem_acento(tit + ' ' + prod)
        if alvos and not any(a in txt for a in alvos):
            continue
        d, hora = data_ibge(it.get('data_inicio') or it.get('data_divulgacao') or it.get('data') or '')
        if not d:
            continue
        chave = (d, sem_acento(tit or prod))
        if chave in vistos:
            continue
        vistos.add(chave)
        out.append({'data': d, 'hora': hora, 'evento': tit or prod, 'fonte': 'IBGE · calendário de divulgações', 'link': _link(it.get('link')) or PAGINA_IBGE, 'tipo': 'ibge'})
    return out


def _hora_fed(dia):
    """Comunicado do FOMC: 14h de Nova York, convertido para Brasília (muda com o horário de verão americano)."""
    if ZoneInfo is None:
        return None
    try:
        ny = dt.datetime.combine(dia, dt.time(14, 0), tzinfo=ZoneInfo('America/New_York'))
        return ny.astimezone(ZoneInfo('America/Sao_Paulo')).strftime('%H:%M')
    except Exception:
        return None


def oficiais(cal, hoje, dias):
    """Reuniões do Copom e do FOMC dentro da janela, a partir dos calendários oficiais da configuração."""
    out, ate = [], hoje + dt.timedelta(days=dias)
    for chave, rot, tipo in (('copom', 'Copom', 'copom'), ('fomc', 'Fed (FOMC)', 'fomc')):
        c = (cal or {}).get(chave) or {}
        for par in c.get('reunioes') or []:
            try:
                d1, d2 = dt.date.fromisoformat(par[0]), dt.date.fromisoformat(par[-1])
            except (ValueError, TypeError, IndexError):
                continue
            if not (hoje <= d2 <= ate):
                continue
            dias_txt = '%02d e %02d/%02d' % (d1.day, d2.day, d2.month) if d1 != d2 else '%02d/%02d' % (d2.day, d2.month)
            if tipo == 'copom':
                ev = 'Copom: decisão da Selic, depois do fechamento do mercado (reunião de %s)' % dias_txt
                hora = None
            else:
                ev = 'Fed: decisão de juros, comunicado às 14h de Nova York (reunião de %s)' % dias_txt
                hora = _hora_fed(d2)
            item = {'data': d2.isoformat(), 'hora': hora, 'evento': ev, 'fonte': c.get('fonte') or rot, 'link': _link(c.get('link')), 'tipo': tipo}
            if d2.year in (c.get('anos_provisorios') or []):
                item['previsto'] = True  # data provisória no próprio calendário oficial
            out.append(item)
            if d1 != d2 and hoje <= d1 <= ate:
                out.append({'data': d1.isoformat(), 'hora': None, 'evento': '%s: começa a reunião (decisão no dia seguinte)' % rot, 'fonte': c.get('fonte') or rot, 'link': _link(c.get('link')), 'tipo': tipo})
    return out


def focus(hoje, dias, feriados):
    """Próximas segundas-feiras (relatório Focus). Marcado como previsto: feriado muda o dia."""
    out, d, ate = [], hoje, hoje + dt.timedelta(days=dias)
    while d <= ate:
        if d.weekday() == 0:
            dd = d
            while dd.isoformat() in (feriados or []) or dd.weekday() >= 5:
                dd += dt.timedelta(days=1)
            out.append({'data': dd.isoformat(), 'hora': None, 'evento': 'Relatório Focus (expectativas do mercado)', 'fonte': 'Banco Central · publicação semanal', 'link': 'https://www.bcb.gov.br/publicacoes/focus', 'tipo': 'focus', 'previsto': True})
        d += dt.timedelta(days=1)
    return out


def montar(rede, cfg, hoje, agora_, estado):
    """Agenda dos próximos dias. O IBGE é consultado uma vez por dia (guardado em estado['agenda_ibge'])."""
    ac = cfg.get('agenda_macro') or {}
    dias = int(ac.get('dias', 14))
    erros, ibge_itens = [], None
    cache = estado.get('agenda_ibge') or {}
    if cache.get('dia') == hoje.isoformat():
        ibge_itens = cache.get('itens') or []
    elif ac.get('ibge', True):
        try:
            ibge_itens = ibge(rede, hoje, dias, ac.get('ibge_produtos'))
            estado['agenda_ibge'] = {'dia': hoje.isoformat(), 'itens': ibge_itens}
        except (ErroFonte, KeyError, TypeError, ValueError, AttributeError, IndexError) as e:
            erros.append('IBGE: %s' % e)
            ibge_itens = [x for x in (cache.get('itens') or []) if x.get('data', '') >= hoje.isoformat()]
    itens = (ibge_itens or []) + oficiais(ac, hoje, dias) + focus(hoje, dias, cfg.get('feriados_b3'))
    itens.sort(key=lambda x: (x['data'], x.get('hora') or '99'))
    fontes = {k: {'fonte': (ac.get(k) or {}).get('fonte'), 'link': (ac.get(k) or {}).get('link'), 'conferido_em': (ac.get(k) or {}).get('conferido_em')} for k in ('copom', 'fomc')}
    return {'gerado_em': agora_.isoformat(timespec='minutes'), 'dias': dias, 'itens': itens, 'fontes': fontes, 'erros': erros}
