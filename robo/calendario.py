# -*- coding: utf-8 -*-
"""Calendário de negociação: dias de pregão da B3 (feriados em config.json) e dias úteis dos EUA (aproximação:
segunda a sexta). Serve para saber qual é a última sessão esperada e se um dado está desatualizado."""
import datetime as dt


def eh_pregao(d, feriados):
    return d.weekday() < 5 and d.isoformat() not in feriados


def anterior(d, feriados):
    d = d - dt.timedelta(days=1)
    while not eh_pregao(d, feriados):
        d -= dt.timedelta(days=1)
    return d


def ultima_sessao(agora_, feriados, abertura='10:00'):
    """Sessão de referência para preços do dia: hoje, se já abriu o pregão; senão, a sessão anterior."""
    d = agora_.date()
    if eh_pregao(d, feriados) and agora_.strftime('%H:%M') >= abertura:
        return d
    return anterior(d, feriados)


def ultima_sessao_fechada(agora_, feriados, publicacao='21:30'):
    """Última sessão cujo fechamento oficial já deve estar publicado (arquivo diário da B3 sai à noite)."""
    d = agora_.date()
    if eh_pregao(d, feriados) and agora_.strftime('%H:%M') >= publicacao:
        return d
    return anterior(d, feriados)


def sessoes_entre(ini, fim, feriados):
    """Pregões em (ini, fim]."""
    out, d = [], ini + dt.timedelta(days=1)
    while d <= fim:
        if eh_pregao(d, feriados):
            out.append(d)
        d += dt.timedelta(days=1)
    return out


def dias_uteis_atras(d, n):
    """n dias úteis (segunda a sexta) antes de d."""
    while n > 0:
        d -= dt.timedelta(days=1)
        if d.weekday() < 5:
            n -= 1
    return d


def cobre_ano(ano, feriados):
    return any(str(f).startswith(str(ano)) for f in feriados)
