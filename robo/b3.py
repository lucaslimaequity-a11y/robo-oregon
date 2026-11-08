# -*- coding: utf-8 -*-
"""Cotações históricas oficiais da B3 (arquivos COTAHIST, públicos e gratuitos).

Cada linha do arquivo traz o fechamento do pregão de um código negociado, sem ajuste por proventos ou
desdobramentos: é o PREÇO DE MERCADO oficial. O robô guarda só os ativos da carteira (data/b3_cache.json):
uma carga inicial pelos arquivos anuais (e mensais do ano corrente, se o anual não existir) e, depois, um arquivo
diário por pregão, publicado pela B3 à noite.

Layout (posições do arquivo, 245 caracteres por linha, tipo de registro 01):
  DATA 3-10 · CODBDI 11-12 · CODNEG 13-24 · TPMERC 25-27 · NOMRES 28-39 · ESPECI 40-49 · PREULT 109-121 (2 decimais)
  TOTNEG 148-152 · FATCOT 211-217 · CODISI 231-242
"""
import datetime as dt
import io
import zipfile

from calendario import sessoes_entre
from util import ErroFonte

BASE = 'https://bvmf.bmfbovespa.com.br/InstDados/SerHist/'
FONTE = 'B3 (arquivo oficial)'


def ler_linhas(linhas, tickers):
    """Lê linhas COTAHIST e devolve {ticker: {data: (fechamento, negocios)}} e {ticker: identificação}."""
    alvo = set(tickers)
    precos, info = {}, {}
    for ln in linhas:
        if len(ln) < 245 or ln[:2] != '01':
            continue
        cod = ln[12:24].strip()
        if cod not in alvo or ln[24:27] != '010':  # 010 = mercado à vista
            continue
        try:
            d = dt.date(int(ln[2:6]), int(ln[6:8]), int(ln[8:10])).isoformat()
            fat = int(ln[210:217]) or 1
            preco = int(ln[108:121]) / 100.0 / fat
            neg = int(ln[147:152])
        except ValueError:
            continue
        if preco <= 0:
            continue
        precos.setdefault(cod, {})[d] = (round(preco, 6), neg)
        info[cod] = {'nome': ln[27:39].strip(), 'especificacao': ln[39:49].strip(), 'isin': ln[230:242].strip(), 'codbdi': ln[10:12]}
    return precos, info


def _linhas_zip(z):
    nomes = [n for n in z.namelist() if not n.endswith('/')]
    if not nomes:
        return
    with z.open(nomes[0]) as f:
        for ln in io.TextIOWrapper(f, encoding='latin-1', newline=''):
            yield ln.rstrip('\r\n')


def baixar(rede, nome, timeout=240):
    corpo = rede.get(FONTE, BASE + nome, timeout=timeout, tentativas=2)
    try:
        z = zipfile.ZipFile(io.BytesIO(corpo))
    except zipfile.BadZipFile:
        raise rede.falha(FONTE, 'formato', nome + ' não é um zip válido')
    return _linhas_zip(z)


def _mescla(cache, precos, info):
    for t, por_data in precos.items():
        atual = {p[0]: (p[1], p[2]) for p in cache['tickers'].get(t, [])}
        atual.update(por_data)
        cache['tickers'][t] = [[d, v[0], v[1]] for d, v in sorted(atual.items())]
    cache['info'].update(info)


def vazio():
    return {'versao': 1, 'tickers': {}, 'info': {}, 'anos_lidos': {}, 'dias_lidos': [], 'falhas': []}


def atualizar(rede, cache, tickers, hoje, ultima_fechada, feriados, anos=2, max_diarios=12, carga_anual=True, log=print):
    """Completa o cache. Carga anual só para ativos ainda não lidos naquele ano; depois, arquivos diários."""
    cache = cache or vazio()
    for k in ('tickers', 'info', 'anos_lidos', 'dias_lidos', 'falhas'):
        cache.setdefault(k, {} if k in ('tickers', 'info', 'anos_lidos') else [])
    cache['falhas'] = []
    anos_alvo = list(range(hoje.year - anos, hoje.year + 1))
    if carga_anual:
        for ano in anos_alvo:
            faltam = [t for t in tickers if ano not in cache['anos_lidos'].get(t, [])]
            if not faltam or rede.sem_tempo():
                continue
            nomes = ['COTAHIST_A%d.ZIP' % ano]
            if ano == hoje.year:
                nomes += ['COTAHIST_M%02d%d.ZIP' % (m, ano) for m in range(1, hoje.month + 1)]
            lidos_ano, algum = False, False
            for nome in nomes:
                if lidos_ano and nome.startswith('COTAHIST_M'):
                    break
                try:
                    precos, info = ler_linhas(baixar(rede, nome), faltam)
                    _mescla(cache, precos, info)
                    log('  B3: %s lido (%d ativos encontrados)' % (nome, len(precos)))
                    algum = True
                    if nome.startswith('COTAHIST_A'):
                        lidos_ano = True
                except ErroFonte as e:
                    cache['falhas'].append('%s: %s' % (nome, e))
                    if nome.startswith('COTAHIST_A') and ano < hoje.year:
                        break
            for t in faltam:
                cache['anos_lidos'].setdefault(t, [])
                if ano not in cache['anos_lidos'][t] and (lidos_ano or (ano == hoje.year and algum)):
                    cache['anos_lidos'][t].append(ano)
    # arquivos diários a partir do último pregão presente no cache
    datas = [p[0] for pts in cache['tickers'].values() for p in pts[-1:]]
    ultimo = max(datas) if datas else (ultima_fechada - dt.timedelta(days=10)).isoformat()
    pendentes = [d for d in sessoes_entre(dt.date.fromisoformat(ultimo), ultima_fechada, feriados) if d.isoformat() not in cache['dias_lidos']]
    for d in pendentes[-max_diarios:]:
        if rede.sem_tempo():
            break
        nome = 'COTAHIST_D%02d%02d%d.ZIP' % (d.day, d.month, d.year)
        try:
            precos, info = ler_linhas(baixar(rede, nome, timeout=60), tickers)
            _mescla(cache, precos, info)
            cache['dias_lidos'] = (cache['dias_lidos'] + [d.isoformat()])[-60:]
        except ErroFonte as e:
            cache['falhas'].append('%s: %s' % (nome, e))
            if e.tipo == 'nao_encontrado':
                break  # ainda não publicado
    # mantém só o necessário (anos + 1 de folga)
    corte = dt.date(hoje.year - anos - 1, 1, 1).isoformat()
    for t in list(cache['tickers']):
        cache['tickers'][t] = [p for p in cache['tickers'][t] if p[0] >= corte]
    return cache


def cotacao(cache, ticker):
    pts = (cache or {}).get('tickers', {}).get(ticker) or []
    if len(pts) < 2:
        raise ErroFonte(FONTE, 'nao_encontrado' if not pts else 'vazio', ticker)
    (d0, p0, _), (d1, p1, n1) = pts[-2], pts[-1]
    return {'preco': p1, 'anterior': p0, 'var': (p1 / p0 - 1) * 100, 'data': d1, 'hora': None, 'fonte': FONTE,
            'tipo_preco': 'fechamento', 'negocios': n1}
