#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Robô de mercado · Carteira Oregon

Roda sozinho no GitHub Actions (ver .github/workflows/robo.yml), em dias úteis, a cada 30 minutos.
A cada rodada:
  1. busca dados de mercado em fontes públicas (Banco Central, Focus, Tesouro, Tesouro dos EUA,
     cotações) e as notícias do dia;
  2. compara com os limites de alerta de robo/config.json;
  3. avisa no Telegram o que passou do limite e, no fim do dia, manda um resumo;
  4. grava data/mercado.json (o painel lê esse arquivo) e, uma vez por dia, data/historico.json
     (séries para o modelo de risco).

Só usa a biblioteca padrão do Python. Chaves e senhas ficam nos "Secrets" do GitHub, nunca aqui:
  TELEGRAM_TOKEN, TELEGRAM_CHAT_ID  avisos no Telegram
  BRAPI_TOKEN                       (opcional) cotação de reserva das ações da B3
  ANTHROPIC_API_KEY                 (opcional) leitura das notícias por IA

Nenhum número é inventado: se uma fonte falha, o campo fica marcado como indisponível.
"""
import csv
import datetime as dt
import html
import io
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
DADOS = os.environ.get('ROBO_DADOS') or os.path.join(RAIZ, 'data')
BRT = dt.timezone(dt.timedelta(hours=-3))
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
TESOURO_URL = ('https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/'
               'resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv')
FATOR_NOME = {
    'selic': 'Selic', 'pre': 'Curva prefixada', 'real': 'Juro real (IPCA+)', 'ust2': 'Treasury 2 anos',
    'ust10': 'Treasury 10 anos', 'usd': 'Dólar', 'ibov': 'Ibovespa', 'sp': 'S&P 500', 'em': 'Emergentes (EEM)',
    'brent': 'Petróleo Brent', 'btc': 'Bitcoin',
}
UVAR = {'selic': 'pp', 'pre': 'pp', 'real': 'pp', 'ust2': 'pp', 'ust10': 'pp'}  # o resto varia em %


# ---------------------------------------------------------------- utilidades
def agora():
    fixo = os.environ.get('ROBO_AGORA')  # usado nos testes
    return dt.datetime.fromisoformat(fixo).astimezone(BRT) if fixo else dt.datetime.now(BRT)


def log(*a):
    print(*a, flush=True)


# Prazo da rodada e disjuntor por fonte: uma fonte travada não pode estourar o tempo do GitHub e derrubar o resto.
PRAZO = {'fim': None}
FALHAS = {}


def sem_tempo():
    return PRAZO['fim'] is not None and time.monotonic() > PRAZO['fim']


def disjuntor(fonte, limite):
    if FALHAS.get(fonte, 0) >= limite:
        raise RuntimeError('%s: pausado nesta rodada depois de %d falhas seguidas' % (fonte, limite))


def registra(fonte, deu_certo):
    FALHAS[fonte] = 0 if deu_certo else FALHAS.get(fonte, 0) + 1


def baixar(url, timeout=40, tentativas=3, cab=None, dados=None):
    """GET (ou POST se `dados`) com novas tentativas. Mensagens de erro nunca mostram a query (onde vão tokens)."""
    ultimo = None
    for i in range(tentativas):
        try:
            h = {'User-Agent': UA, 'Accept': '*/*'}
            h.update(cab or {})
            rq = urllib.request.Request(url, headers=h, data=dados)
            with urllib.request.urlopen(rq, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            ultimo = 'HTTP %s' % e.code
            if e.code in (400, 401, 403, 404):
                break
        except Exception as e:  # rede, timeout
            ultimo = type(e).__name__
        if i < tentativas - 1:
            time.sleep(1.5 * (i + 1))
    raise RuntimeError('%s: %s' % (url.split('?')[0], ultimo))


def baixar_json(url, **kw):
    return json.loads(baixar(url, **kw).decode('utf-8'))


def num(v, casas=2):
    """Formata no padrão brasileiro: 1.234,56."""
    if v is None:
        return '—'
    s = '{:,.{c}f}'.format(v, c=casas)
    return s.replace(',', 'X').replace('.', ',').replace('X', '.')


def sinal(v, casas=2, suf=''):
    if v is None:
        return '—'
    return ('+' if v > 0 else '−' if v < 0 else '') + num(abs(v), casas) + suf


def sem_acento(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower().strip()


def ler(nome, padrao=None):
    p = os.path.join(DADOS, nome)
    try:
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return padrao


def gravar(nome, obj):
    os.makedirs(DADOS, exist_ok=True)
    with open(os.path.join(DADOS, nome), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))


def br_data(iso):
    return '%s/%s/%s' % (iso[8:10], iso[5:7], iso[0:4]) if iso else '—'


# ---------------------------------------------------------------- fontes: Banco Central
def sgs(cod, dias, hoje):
    """Série do SGS (Banco Central) entre hoje-dias e hoje. Datas futuras (a Selic meta vem preenchida até o próximo Copom) ficam fora."""
    ini = (hoje - dt.timedelta(days=dias)).strftime('%d/%m/%Y')
    fim = hoje.strftime('%d/%m/%Y')
    url = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.%d/dados?formato=json&dataInicial=%s&dataFinal=%s' % (cod, ini, fim)
    pts = []
    for o in baixar_json(url):
        try:
            d = dt.datetime.strptime(o['data'], '%d/%m/%Y').date()
            v = float(str(o['valor']).replace(',', '.'))
        except Exception:
            continue
        if d <= hoje:
            pts.append((d.isoformat(), v))
    pts.sort()
    return pts


def focus(hoje):
    """Mediana do Focus (Banco Central) para o ano corrente e o seguinte, com a variação em relação a uma semana antes."""
    inds = ['IPCA', 'Selic', 'PIB Total', 'Câmbio']
    base = '(' + ' or '.join("Indicador eq '%s'" % i for i in inds) + ") and Data ge '%s'" % (hoje - dt.timedelta(days=21)).isoformat()
    linhas = None
    for filtro in (base + ' and baseCalculo eq 0', base):
        q = urllib.parse.urlencode({'$filter': filtro, '$orderby': 'Data desc', '$top': '2000', '$format': 'json'}, quote_via=urllib.parse.quote)
        try:
            linhas = baixar_json('https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?' + q).get('value', [])
            break
        except RuntimeError:
            continue
    if linhas is None:
        raise RuntimeError('Focus indisponível')
    linhas = [r for r in linhas if r.get('baseCalculo', 0) in (0, '0')]
    out = {}
    for ind in inds:
        rs = [r for r in linhas if r.get('Indicador') == ind and r.get('Mediana') is not None]
        if not rs:
            continue
        datas = sorted({r['Data'] for r in rs}, reverse=True)
        d0 = datas[0]
        limite = (dt.date.fromisoformat(d0) - dt.timedelta(days=6)).isoformat()
        d1 = next((d for d in datas if d <= limite), None)

        def med(data, ref):
            for r in rs:
                if r['Data'] == data and str(r.get('DataReferencia')) == ref:
                    return float(r['Mediana'])
            return None
        anos = [str(hoje.year), str(hoje.year + 1)]
        item = {'data': d0, 'data_anterior': d1, 'anos': {}}
        for a in anos:
            m0, m1 = med(d0, a), (med(d1, a) if d1 else None)
            if m0 is not None:
                item['anos'][a] = {'mediana': m0, 'anterior': m1, 'var': None if m1 is None else round(m0 - m1, 4)}
        out[ind] = item
    if not out:
        raise RuntimeError('Focus sem dados nas últimas 3 semanas')
    return out


# ---------------------------------------------------------------- fontes: Tesouro (Brasil e EUA)
def tesouro(alvos, desde):
    """Taxas de compra do Tesouro Direto (Tesouro Transparente). Escolhe o título pedido ou o de vencimento mais próximo."""
    raw = baixar(TESOURO_URL, timeout=180)
    try:
        txt = raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        txt = raw.decode('latin-1')
    rd = csv.reader(io.StringIO(txt), delimiter=';')
    cab = [sem_acento(c) for c in next(rd)]

    def col(nome):
        for i, c in enumerate(cab):
            if c == nome:
                return i
        raise RuntimeError('coluna "%s" não encontrada no arquivo do Tesouro' % nome)
    it, iv, ib, itx = col('tipo titulo'), col('data vencimento'), col('data base'), col('taxa compra manha')
    series = {}
    for r in rd:
        try:
            tipo = r[it].strip()
            venc = dt.datetime.strptime(r[iv].strip(), '%d/%m/%Y').date()
            base = dt.datetime.strptime(r[ib].strip(), '%d/%m/%Y').date()
            tx = float(r[itx].replace('.', '').replace(',', '.'))
        except Exception:
            continue
        if not tx > 0:  # 0,00 = título fora de venda naquele dia: não é taxa de mercado
            continue
        if base < desde:
            continue
        series.setdefault((sem_acento(tipo), venc), []).append((base.isoformat(), tx))
    out = {}
    for k, a in alvos.items():
        alvo_t, alvo_v = sem_acento(a['tipo']), dt.date.fromisoformat(a['vencimento'])
        cands = [key for key in series if key[0] == alvo_t]
        if not cands:
            continue
        key = min(cands, key=lambda kk: abs((kk[1] - alvo_v).days))
        pts = sorted(set(series[key]))
        out[k] = {'nome': '%s %d' % (a['tipo'], key[1].year), 'vencimento': key[1].isoformat(), 'pts': pts,
                  'exato': key[1] == alvo_v}
    return out


def treasury(anos):
    """Curva de juros do Tesouro dos EUA (2 e 10 anos)."""
    out = {'2 Yr': [], '10 Yr': []}
    for ano in anos:
        url = ('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/%d/all'
               '?type=daily_treasury_yield_curve&field_tdr_date_value=%d&page&_format=csv' % (ano, ano))
        try:
            txt = baixar(url, timeout=60).decode('utf-8-sig')
        except RuntimeError:
            if ano == anos[-1]:
                raise
            continue
        rd = csv.DictReader(io.StringIO(txt))
        for r in rd:
            try:
                d = dt.datetime.strptime(r['Date'], '%m/%d/%Y').date().isoformat()
            except Exception:
                continue
            for c in out:
                try:
                    out[c].append((d, float(r[c])))
                except Exception:
                    pass
    for c in out:
        out[c] = sorted(set(out[c]))
    if not out['10 Yr']:
        raise RuntimeError('curva dos EUA sem dados')
    return out


# ---------------------------------------------------------------- fontes: cotações
def yahoo(simbolo, faixa='5d', intervalo='1d'):
    url = ('https://query1.finance.yahoo.com/v8/finance/chart/%s?range=%s&interval=%s&includeAdjustedClose=true&events=div%%2Csplit'
           % (urllib.parse.quote(simbolo, safe=''), faixa, intervalo))
    disjuntor('Yahoo', 4)
    try:
        js = baixar_json(url, tentativas=2, timeout=15)
        registra('Yahoo', True)
    except Exception:
        registra('Yahoo', False)
        raise
    r = (js.get('chart') or {}).get('result') or []
    if not r:
        raise RuntimeError('%s: sem resultado' % simbolo)
    r = r[0]
    meta, ts = r.get('meta') or {}, r.get('timestamp') or []
    off = meta.get('gmtoffset') or 0
    q = ((r.get('indicators') or {}).get('quote') or [{}])[0]
    fe = q.get('close') or []
    aj = (((r.get('indicators') or {}).get('adjclose') or [{}])[0].get('adjclose')) or fe
    pts, adj = [], []
    for i, t in enumerate(ts):
        d = dt.datetime.fromtimestamp(t + off, dt.timezone.utc).date().isoformat()
        if i < len(fe) and fe[i] is not None:
            pts.append((d, float(fe[i])))
        if i < len(aj) and aj[i] is not None:
            adj.append((d, float(aj[i])))
    return {'meta': meta, 'pts': dedup(pts), 'adj': dedup(adj)}


def dedup(pts):
    m = {}
    for d, v in pts:
        m[d] = v
    return sorted(m.items())


def hora_de(ts):
    try:
        return dt.datetime.fromtimestamp(int(ts), BRT).strftime('%H:%M')
    except Exception:
        return None


def cotacao_yahoo(simbolo):
    y = yahoo(simbolo, '5d', '1d')
    pts, meta = y['pts'], y['meta']
    if not pts:
        raise RuntimeError('%s: sem fechamentos' % simbolo)
    preco = meta.get('regularMarketPrice')
    rt = meta.get('regularMarketTime')
    d_vivo = None
    if rt:
        d_vivo = dt.datetime.fromtimestamp(int(rt) + (meta.get('gmtoffset') or 0), dt.timezone.utc).date().isoformat()
    if preco and d_vivo and d_vivo > pts[-1][0]:
        # a barra de hoje ainda não veio (ou veio sem fechamento): o anterior é o último fechamento da série
        preco, ant, data = float(preco), pts[-1][1], d_vivo
    else:
        if len(pts) < 2:
            raise RuntimeError('%s: histórico curto' % simbolo)
        preco, ant, data = (float(preco) if preco else pts[-1][1]), pts[-2][1], pts[-1][0]
    return {'preco': preco, 'anterior': ant, 'var': (preco / ant - 1) * 100, 'data': data,
            'hora': hora_de(rt), 'fonte': 'Yahoo Finance', 'moeda': meta.get('currency')}


def cotacao_brapi(ticker, token):
    url = 'https://brapi.dev/api/quote/%s?token=%s' % (urllib.parse.quote(ticker, safe=''), urllib.parse.quote(token, safe=''))
    r = baixar_json(url, tentativas=2, timeout=15)['results'][0]
    preco, ant = float(r['regularMarketPrice']), r.get('regularMarketPreviousClose')
    var = r.get('regularMarketChangePercent')
    if var is None and ant:
        var = (preco / float(ant) - 1) * 100
    t = str(r.get('regularMarketTime') or '')
    data, hora = None, None
    try:
        tt = dt.datetime.fromisoformat(t.replace('Z', '+00:00')).astimezone(BRT)
        data, hora = tt.date().isoformat(), tt.strftime('%H:%M')
    except Exception:
        pass
    return {'preco': preco, 'anterior': float(ant) if ant else None, 'var': float(var), 'data': data, 'hora': hora,
            'fonte': 'brapi', 'moeda': 'BRL'}


def dolar_awesome():
    o = baixar_json('https://economia.awesomeapi.com.br/json/last/USD-BRL', tentativas=2)['USDBRL']
    bid, vb = float(o['bid']), float(o.get('varBid') or 0)
    cd = str(o.get('create_date') or '')
    return {'preco': bid, 'anterior': bid - vb, 'var': float(o['pctChange']), 'data': cd[:10] or None, 'hora': cd[11:16] or None,
            'fonte': 'AwesomeAPI'}


def btc_coingecko():
    b = baixar_json('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true')['bitcoin']
    p, v = float(b['usd']), float(b['usd_24h_change'])
    t = b.get('last_updated_at')
    return {'preco': p, 'anterior': p / (1 + v / 100), 'var': v, 'data': dt.datetime.fromtimestamp(int(t), BRT).date().isoformat() if t else None,
            'hora': hora_de(t), 'fonte': 'CoinGecko (24 horas)'}


def primeira(fns):
    """Tenta as fontes em ordem; devolve a primeira que responder e a lista de falhas."""
    erros = []
    for nome, fn in fns:
        try:
            return fn(), erros
        except Exception as e:
            erros.append('%s: %s' % (nome, e))
    return None, erros


# ---------------------------------------------------------------- notícias
def noticias_google(consulta, rotulo, bloqueio):
    q = urllib.parse.quote(consulta + ' when:1d')
    url = 'https://news.google.com/rss/search?q=%s&hl=pt-BR&gl=BR&ceid=BR:pt-419' % q
    disjuntor('Google Notícias', 3)
    try:
        raiz = ET.fromstring(baixar(url, tentativas=2, timeout=15))
        registra('Google Notícias', True)
    except Exception:
        registra('Google Notícias', False)
        raise
    out = []
    for it in raiz.iter('item'):
        tit = (it.findtext('title') or '').strip()
        fonte = (it.findtext('source') or '').strip()
        if fonte and tit.endswith(' - ' + fonte):
            tit = tit[: -len(' - ' + fonte)]
        if any(b and b.lower() in fonte.lower() for b in bloqueio):
            continue
        quando = None
        try:
            quando = dt.datetime.strptime(it.findtext('pubDate') or '', '%a, %d %b %Y %H:%M:%S %Z').replace(tzinfo=dt.timezone.utc).astimezone(BRT).isoformat(timespec='minutes')
        except Exception:
            pass
        out.append({'titulo': tit, 'fonte': fonte, 'link': (it.findtext('link') or '').strip(), 'quando': quando, 'tema': rotulo})
    return out


def coletar_noticias(cfg, anterior):
    n = cfg.get('noticias') or {}
    bloqueio = n.get('fontes_bloqueadas') or []
    vistos, out, erros = set(), [], []
    consultas = [(c['consulta'], c['tema']) for c in n.get('macro', [])]
    for a in cfg['ativos_b3']:
        if a.get('busca'):
            consultas.append((a['busca'], a['id']))
    for consulta, tema in consultas:
        if sem_tempo():
            erros.append('%s: sem tempo nesta rodada' % tema)
            continue
        try:
            for x in noticias_google(consulta, tema, bloqueio)[: n.get('por_tema', 5)]:
                k = sem_acento(x['titulo'])[:90]
                if k in vistos:
                    continue
                vistos.add(k)
                out.append(x)
        except Exception as e:
            erros.append('%s: %s' % (tema, e))
    # a leitura por IA de rodadas anteriores continua valendo para a mesma manchete
    lidas = {sem_acento(x['titulo'])[:90]: x.get('ia') for x in (anterior or []) if x.get('ia')}
    for x in out:
        k = sem_acento(x['titulo'])[:90]
        if k in lidas:
            x['ia'] = lidas[k]
    out.sort(key=lambda x: x.get('quando') or '', reverse=True)
    return out[: n.get('maximo', 80)], erros


def ler_com_ia(noticias, cfg):
    """Opcional: com ANTHROPIC_API_KEY, a IA classifica as manchetes novas (fator, empresa, direção, relevância)."""
    chave = os.environ.get('ANTHROPIC_API_KEY')
    if not chave:
        return None, 'sem ANTHROPIC_API_KEY (leitura por IA desligada)'
    novas = [x for x in noticias if 'ia' not in x][:25]
    if not novas:
        return 0, ''
    ativos = ', '.join('%s (%s)' % (a['id'], a['nome']) for a in cfg['ativos_b3'] if a['classe'] in ('acao', 'fii'))
    sistema = ('Você ajuda a mesa de gestão de uma consultoria de investimentos brasileira. Responda só com JSON válido. '
               'Use apenas as manchetes recebidas; não invente números, não cite projeções de bancos ou corretoras. '
               'Fatores possíveis: selic, pre, real, ust2, ust10, spread, usd, ibov, sp, em, brent, btc. '
               'Ativos acompanhados: ' + ativos + '.')
    pedido = ('Para cada manchete, devolva {"i": índice, "relevancia": "alta"|"media"|"baixa", "tickers": [...], "fatores": [...], '
              '"direcao": "positivo"|"negativo"|"neutro"|"incerto" (para os ativos citados ou, se nenhum, para a bolsa brasileira), '
              '"resumo": uma frase curta}. Formato: {"itens": [...]}.\n\n'
              + '\n'.join('%d. %s (%s)' % (i, x['titulo'], x.get('fonte') or 'fonte não informada') for i, x in enumerate(novas)))
    corpo = json.dumps({'model': cfg.get('ia_modelo', 'claude-haiku-5-5'), 'max_tokens': 8000, 'system': sistema,
                        'messages': [{'role': 'user', 'content': pedido}]}).encode()
    try:
        r = json.loads(baixar('https://api.anthropic.com/v1/messages', timeout=120, tentativas=2, dados=corpo,
                              cab={'x-api-key': chave, 'anthropic-version': cfg.get('ia_versao_api', '2023-06-01'), 'content-type': 'application/json'}).decode('utf-8'))
        if r.get('stop_reason') == 'max_tokens':
            return None, 'leitura por IA cortada pelo limite de tamanho; tenta de novo na próxima hora'
        txt = ''.join(b.get('text', '') for b in r.get('content', []) if isinstance(b, dict) and b.get('type') == 'text')
        m = re.search(r'\{.*\}', txt, re.S)
        itens = json.loads(m.group(0)).get('itens', []) if m else []
        if not isinstance(itens, list):
            itens = []
    except Exception as e:
        return None, 'leitura por IA falhou: %s' % type(e).__name__
    n = 0
    for it in itens:
        try:
            x = novas[int(it['i'])]
            tk = it.get('tickers') if isinstance(it.get('tickers'), list) else []
            fa = it.get('fatores') if isinstance(it.get('fatores'), list) else []
            rel = it.get('relevancia') if it.get('relevancia') in ('alta', 'media', 'baixa') else None
            dire = it.get('direcao') if it.get('direcao') in ('positivo', 'negativo', 'neutro', 'incerto') else None
            x['ia'] = {'relevancia': rel, 'tickers': [t for t in tk if isinstance(t, str)][:5],
                       'fatores': [f for f in fa if isinstance(f, str) and (f in FATOR_NOME or f == 'spread')][:4],
                       'direcao': dire, 'resumo': str(it.get('resumo') or '')[:280]}
            n += 1
        except Exception:
            continue
    return n, ''


def arquivar(nots, arq, agora_, dias=60, maximo=3000):
    """Arquivo de notícias para estudo: junta as novas às anteriores (sem repetir), guarda quando cada uma apareceu e mantém 60 dias."""
    itens = {}
    for x in (arq or {}).get('itens', []):
        itens[sem_acento(x.get('titulo', ''))[:90]] = x
    marca = agora_.isoformat(timespec='minutes')
    for x in nots:
        k = sem_acento(x['titulo'])[:90]
        old = itens.get(k) or {}
        y = dict(x)
        y['visto_em'] = old.get('visto_em') or marca
        if old.get('ia') and not y.get('ia'):
            y['ia'] = old['ia']
        itens[k] = y
    lim = (agora_ - dt.timedelta(days=dias)).date().isoformat()
    out = [x for x in itens.values() if (x.get('quando') or x.get('visto_em') or '')[:10] >= lim]
    out.sort(key=lambda x: x.get('quando') or x.get('visto_em') or '', reverse=True)
    return {'versao': 1, 'gerado_em': agora_.isoformat(timespec='seconds'), 'itens': out[:maximo]}


# ---------------------------------------------------------------- montagem
def fator_de_cotacao(k, c, unid):
    if not c:
        return {'k': k, 'nome': FATOR_NOME[k], 'ok': False}
    return {'k': k, 'nome': FATOR_NOME[k], 'ok': True, 'nivel': c['preco'], 'anterior': c['anterior'], 'var': c['var'], 'uvar': '%',
            'unid': unid, 'data': c['data'], 'hora': c.get('hora'), 'fonte': c['fonte']}


def fator_de_serie(k, pts, nome, fonte, unid='% a.a.'):
    if not pts or len(pts) < 2:
        return {'k': k, 'nome': FATOR_NOME[k], 'ok': False}
    (d0, v0), (d1, v1) = pts[-2], pts[-1]
    return {'k': k, 'nome': FATOR_NOME[k], 'detalhe': nome, 'ok': True, 'nivel': v1, 'anterior': v0, 'var': round(v1 - v0, 4), 'uvar': 'pp',
            'unid': unid, 'data': d1, 'data_anterior': d0, 'fonte': fonte}


def coletar(cfg, estado, anterior, hoje, agora_):
    fontes, fat, ind, ativos = {}, {}, {}, {}
    marca = agora_.isoformat(timespec='minutes')

    def ok(nome, msg=''):
        fontes[nome] = {'ok': True, 'quando': marca, 'msg': msg}

    def falhou(nome, e):
        fontes[nome] = {'ok': False, 'quando': marca, 'msg': str(e)[:300]}
        log('  ! %s: %s' % (nome, e))

    # Banco Central
    try:
        selic = sgs(432, 40, hoje)
        fat['selic'] = fator_de_serie('selic', selic, 'Meta Selic (Copom)', 'Banco Central · SGS 432')
        cdi = sgs(4389, 15, hoje)
        if cdi:
            ind['cdi'] = {'nome': 'CDI (anualizado, base 252)', 'nivel': cdi[-1][1], 'unid': '% a.a.', 'data': cdi[-1][0], 'fonte': 'Banco Central · SGS 4389'}
        ip = sgs(433, 430, hoje)
        if ip:
            ind['ipca_mes'] = {'nome': 'IPCA do mês', 'nivel': ip[-1][1], 'unid': '%', 'data': ip[-1][0], 'fonte': 'IBGE via Banco Central · SGS 433'}
        ip12 = sgs(13522, 430, hoje)
        if ip12:
            ind['ipca_12m'] = {'nome': 'IPCA em 12 meses', 'nivel': ip12[-1][1], 'unid': '%', 'data': ip12[-1][0], 'fonte': 'IBGE via Banco Central · SGS 13522'}
        px = sgs(1, 15, hoje)
        if len(px) >= 2:
            ind['ptax'] = {'nome': 'Dólar PTAX (venda)', 'nivel': px[-1][1], 'anterior': px[-2][1], 'var': (px[-1][1] / px[-2][1] - 1) * 100,
                           'unid': 'R$', 'data': px[-1][0], 'fonte': 'Banco Central · SGS 1'}
        ok('bcb')
    except Exception as e:
        falhou('bcb', e)
    try:
        ind['focus'] = focus(hoje)
        ok('focus')
    except Exception as e:
        falhou('focus', e)

    # Tesouro Direto: o arquivo é grande; baixa no máximo a cada 3 horas e reaproveita no meio-tempo
    ult = estado.get('tesouro_em')
    velho = not ult or (agora_ - dt.datetime.fromisoformat(ult)).total_seconds() > 3 * 3600
    if velho or not (anterior.get('fatores') or {}).get('pre', {}).get('ok'):
        try:
            tz = tesouro(cfg['tesouro'], hoje - dt.timedelta(days=20))
            for k in ('pre', 'real'):
                if k in tz:
                    fat[k] = fator_de_serie(k, tz[k]['pts'], tz[k]['nome'] + ' (taxa de compra)', 'Tesouro Transparente')
            estado['tesouro_em'] = agora_.isoformat()
            ok('tesouro')
        except Exception as e:
            falhou('tesouro', e)
    for k in ('pre', 'real'):
        if k not in fat and (anterior.get('fatores') or {}).get(k, {}).get('ok'):
            fat[k] = anterior['fatores'][k]
            fontes.setdefault('tesouro', {'ok': True, 'quando': estado.get('tesouro_em'), 'msg': 'reaproveitado da última leitura'})

    try:
        us = treasury([hoje.year - 1, hoje.year] if hoje.month == 1 else [hoje.year])
        fat['ust2'] = fator_de_serie('ust2', us['2 Yr'], 'Treasury 2 anos', 'Tesouro dos EUA')
        fat['ust10'] = fator_de_serie('ust10', us['10 Yr'], 'Treasury 10 anos', 'Tesouro dos EUA')
        ok('treasury')
    except Exception as e:
        falhou('treasury', e)

    # Cotações de mercado
    brapi = os.environ.get('BRAPI_TOKEN')
    c, er = primeira([('AwesomeAPI', dolar_awesome), ('Yahoo', lambda: cotacao_yahoo('BRL=X'))])
    fat['usd'] = fator_de_cotacao('usd', c, 'R$')
    c, er2 = primeira([('Yahoo', lambda: cotacao_yahoo('^BVSP'))] + ([('brapi', lambda: cotacao_brapi('^BVSP', brapi))] if brapi else []))
    fat['ibov'] = fator_de_cotacao('ibov', c, 'pts')
    for k, sim, u in (('sp', '^GSPC', 'pts'), ('em', 'EEM', 'US$'), ('brent', 'BZ=F', 'US$')):
        c, e3 = primeira([('Yahoo', lambda s=sim: cotacao_yahoo(s))])
        fat[k] = fator_de_cotacao(k, c, u)
        er2 += e3
    c, e4 = primeira([('Yahoo', lambda: cotacao_yahoo('BTC-USD')), ('CoinGecko', btc_coingecko)])
    fat['btc'] = fator_de_cotacao('btc', c, 'US$')
    falhas_cot = er + er2 + e4
    for a in cfg['ativos_b3'] + cfg['ativos_eua']:
        if sem_tempo():
            falhas_cot.append('%s: sem tempo nesta rodada' % a['id'])
            continue
        fns = [('Yahoo', lambda s=a['yahoo']: cotacao_yahoo(s))]
        if brapi and a in cfg['ativos_b3']:
            fns.append(('brapi', lambda t=a['id']: cotacao_brapi(t, brapi)))
        c, e5 = primeira(fns)
        if c:
            c['moeda'] = 'BRL' if a in cfg['ativos_b3'] else 'USD'
            ativos[a['id']] = c
        else:
            falhas_cot += e5
    n_ok = sum(1 for k in ('usd', 'ibov', 'sp', 'em', 'brent', 'btc') if fat[k]['ok']) + len(ativos)
    n_tot = 6 + len(cfg['ativos_b3']) + len(cfg['ativos_eua'])
    msg = '%d de %d cotações' % (n_ok, n_tot)
    if n_ok == 0:
        falhou('cotacoes', msg + '. ' + '; '.join(falhas_cot[:5]))
    else:
        ok('cotacoes', msg + ('' if n_ok == n_tot else ' · sem: ' + ', '.join(sorted(set(x.split(':')[0] for x in falhas_cot)))[:200]))
    return fat, ind, ativos, fontes


# ---------------------------------------------------------------- alertas
def detectar(snap, cfg, estado, hoje):
    """Lista os alertas da rodada. Cada alerta tem um id estável: só é enviado uma vez (ou de novo se ficar mais forte)."""
    L, out = cfg['limites'], []
    for k, f in snap['fatores'].items():
        lim = L['fatores'].get(k)
        if not f.get('ok') or lim is None or f.get('var') is None:
            continue
        v = f['var']
        if abs(v) + 1e-9 < lim:
            continue
        forte = abs(v) >= 2 * lim
        u = ' p.p.' if f['uvar'] == 'pp' else '%'
        nivel_txt = (num(f['nivel'], 2) + '%') if f['uvar'] == 'pp' else ((('R$ ' if f['unid'] == 'R$' else 'US$ ' if f['unid'] == 'US$' else '') + num(f['nivel'], 0 if f['unid'] == 'pts' else 2)))
        out.append({'id': '%s:%s:%s:%s' % (k, f['data'], 'forte' if forte else 'atencao', '+' if v > 0 else '-'), 'tipo': 'fator', 'k': k,
                    'var': v, 'uvar': f['uvar'], 'limite': lim, 'nivel': 'forte' if forte else 'atenção', 'data': f['data'],
                    'texto': '%s %s: %s (%s%s; limite %s%s)' % ('▲' if v > 0 else '▼', f.get('detalhe') or f['nome'], nivel_txt, sinal(v, 2), u, num(lim, 2), u)})
    nomes = {a['id']: a for a in cfg['ativos_b3'] + cfg['ativos_eua']}
    for t, c in snap['ativos'].items():
        a = nomes.get(t) or {}
        if a.get('alertar') is False:
            continue
        lim = L['ativos'].get(a.get('classe'), L['ativos'].get('outro'))
        if lim is None or c.get('var') is None or abs(c['var']) + 1e-9 < lim:
            continue
        forte = abs(c['var']) >= 2 * lim
        out.append({'id': '%s:%s:%s:%s' % (t, c['data'], 'forte' if forte else 'atencao', '+' if c['var'] > 0 else '-'), 'tipo': 'ativo', 't': t,
                    'var': c['var'], 'uvar': '%', 'limite': lim, 'nivel': 'forte' if forte else 'atenção', 'data': c['data'],
                    'texto': '%s %s (%s): %s %s (%s%%; limite %s%%)' % ('▲' if c['var'] > 0 else '▼', t, a.get('nome', ''), 'R$' if c.get('moeda') == 'BRL' else 'US$',
                                                                        num(c['preco'], 2), sinal(c['var'], 1), num(lim, 1))})
    ind = snap['indicadores']
    ip = ind.get('ipca_mes')
    if ip and estado.get('ipca_visto') and estado['ipca_visto'] != ip['data']:
        d = dt.date.fromisoformat(ip['data'])
        doze = ind.get('ipca_12m', {}).get('nivel')
        out.append({'id': 'ipca:' + ip['data'], 'tipo': 'indicador', 'k': 'ipca', 'nivel': 'atenção', 'data': hoje.isoformat(),
                    'texto': 'IPCA de %02d/%d divulgado: %s%% no mês%s' % (d.month, d.year, num(ip['nivel'], 2), ('; %s%% em 12 meses' % num(doze, 2)) if doze is not None else '')})
    fo = ind.get('focus') or {}
    for nome, it in fo.items():
        lim = L.get('focus', {}).get(nome)
        a = it['anos'].get(str(hoje.year))
        if lim is None or not a or a.get('var') is None or abs(a['var']) + 1e-9 < lim:
            continue
        u = ' R$' if nome == 'Câmbio' else ' p.p.'
        out.append({'id': 'focus:%s:%s:%s' % (nome, hoje.year, num(a['mediana'], 2)), 'tipo': 'indicador', 'k': 'focus', 'nivel': 'atenção', 'data': it['data'],
                    'texto': 'Focus de %s: %s %d em %s (%s%s na semana)' % (br_data(it['data']), nome, hoje.year, num(a['mediana'], 2), sinal(a['var'], 2), u)})
    for x in snap.get('noticias') or []:
        ia = x.get('ia') or {}
        if ia.get('relevancia') == 'alta' and (x.get('quando') or '')[:10] >= (hoje - dt.timedelta(days=1)).isoformat():
            out.append({'id': 'noticia:' + sem_acento(x['titulo'])[:60], 'tipo': 'noticia', 'nivel': 'atenção', 'data': (x.get('quando') or '')[:10],
                        'texto': '%s: %s (%s). Leitura por IA: %s' % (', '.join(ia.get('tickers') or []) or 'Mercado', x['titulo'], x.get('fonte') or 's/ fonte', ia.get('resumo') or '—')})
    return out


# ---------------------------------------------------------------- Telegram
def partes(texto, limite=3800):
    """Quebra a mensagem em linhas inteiras (o Telegram aceita até 4.096 caracteres e não aceita HTML cortado)."""
    out, cur = [], ''
    for ln in texto.split('\n'):
        if len(ln) > limite:
            ln = html.escape(html.unescape(re.sub(r'<[^>]+>', '', ln)), quote=False)[:limite]
        if cur and len(cur) + 1 + len(ln) > limite:
            out.append(cur)
            cur = ln
        else:
            cur = ln if not cur else cur + '\n' + ln
    if cur:
        out.append(cur)
    return out


def telegram(texto):
    tok, chat = os.environ.get('TELEGRAM_TOKEN'), os.environ.get('TELEGRAM_CHAT_ID')
    if not tok:
        return False, 'sem TELEGRAM_TOKEN'
    if not chat:
        return False, 'sem TELEGRAM_CHAT_ID (veja o Passo 1 do guia)'
    url = 'https://api.telegram.org/bot%s/sendMessage' % tok
    for parte in partes(texto):
        for modo in ('HTML', None):
            dados = {'chat_id': chat, 'text': parte if modo else html.unescape(re.sub(r'<[^>]+>', '', parte)), 'disable_web_page_preview': 'true'}
            if modo:
                dados['parse_mode'] = modo
            try:
                with urllib.request.urlopen(urllib.request.Request(url, data=urllib.parse.urlencode(dados).encode()), timeout=30) as r:
                    r.read()
                break
            except urllib.error.HTTPError as e:
                if e.code == 400 and modo:
                    continue  # formatação recusada: manda a mesma parte em texto simples
                return False, 'Telegram recusou (HTTP %s): confira TELEGRAM_TOKEN e TELEGRAM_CHAT_ID' % e.code
            except Exception as e:
                return False, 'Telegram sem resposta (%s)' % type(e).__name__
    return True, ''


def esc(s):
    return html.escape(str(s), quote=False)


def msg_alertas(novos, agora_):
    linhas = ['<b>Oregon · alerta de mercado</b> (%s)' % agora_.strftime('%d/%m %H:%M')]
    for a in novos:
        linhas.append(('‼️ ' if a['nivel'] == 'forte' else '') + esc(a['texto']))
    linhas.append('\nNo painel: Mesa do Gestor → Mercado ao vivo mostra o impacto nas carteiras e a reunião automática da Sala.')
    return '\n'.join(linhas)


def msg_resumo(snap, cfg, hoje, titulo='fechamento'):
    F, I, A = snap['fatores'], snap['indicadores'], snap['ativos']

    def f(k, casas=2):
        x = F.get(k) or {}
        if not x.get('ok'):
            return '%s indisponível' % FATOR_NOME[k]
        if x['uvar'] == 'pp':
            return '%s %s%% (%s)' % (x.get('detalhe') or x['nome'], num(x['nivel'], 2), sinal(x['var'], 2, ' p.p.'))
        pre = 'R$ ' if x['unid'] == 'R$' else 'US$ ' if x['unid'] == 'US$' else ''
        return '%s %s%s (%s)' % (x['nome'], pre, num(x['nivel'], 0 if x['unid'] == 'pts' else casas), sinal(x['var'], 1, '%'))
    L = ['<b>Oregon · %s de %s</b>' % (titulo, br_data(hoje.isoformat()))]
    L.append('<b>Juros</b>: ' + esc(' · '.join([f('selic'), f('pre'), f('real')])))
    L.append('<b>EUA</b>: ' + esc(' · '.join([f('ust10'), f('sp')])))
    L.append('<b>Bolsa e câmbio</b>: ' + esc(' · '.join([f('ibov'), f('usd')])))
    L.append('<b>Commodities e cripto</b>: ' + esc(' · '.join([f('brent'), f('btc')])))
    cls = {a['id']: a['classe'] for a in cfg['ativos_b3']}
    acoes = [(t, c) for t, c in A.items() if cls.get(t) in ('acao', 'fii') and c.get('var') is not None]
    ult = max([c.get('data') or '' for t, c in acoes] or [''])
    acoes = [(t, c) for t, c in acoes if c.get('data') == ult]
    if acoes:
        acoes.sort(key=lambda x: x[1]['var'])
        alta = [x for x in reversed(acoes) if x[1]['var'] > 0][:3]
        baixa = [x for x in acoes if x[1]['var'] < 0][:3]
        if alta:
            L.append('<b>Carteira, maiores altas</b>: ' + esc(', '.join('%s %s%%' % (t, sinal(c['var'], 1)) for t, c in alta)))
        if baixa:
            L.append('<b>Carteira, maiores quedas</b>: ' + esc(', '.join('%s %s%%' % (t, sinal(c['var'], 1)) for t, c in baixa)))
    fo = I.get('focus') or {}
    if fo:
        partes = []
        for nome in ('IPCA', 'Selic', 'PIB Total', 'Câmbio'):
            a = (fo.get(nome) or {}).get('anos', {}).get(str(hoje.year))
            if a:
                partes.append('%s %s' % (nome, num(a['mediana'], 2)))
        L.append('<b>Focus %d</b> (%s): %s' % (hoje.year, br_data(next(iter(fo.values()))['data']), esc(' · '.join(partes))))
    ids = [a['id'] for a in cfg['ativos_b3']]
    todas = snap.get('noticias') or []
    for rot, nots in (('Notícias das empresas', [x for x in todas if x.get('tema') in ids][:6]), ('Notícias de mercado', [x for x in todas if x.get('tema') not in ids][:4])):
        if nots:
            L.append('<b>%s</b>:' % rot)
            for x in nots:
                L.append('• %s: <a href="%s">%s</a> (%s)' % (esc(x['tema']), esc(x['link']), esc(x['titulo'][:140]), esc(x.get('fonte') or '')))
    fontes_ok = [k for k, v in snap['fontes'].items() if v.get('ok')]
    falhas = [k for k, v in snap['fontes'].items() if not v.get('ok')]
    L.append('\nFontes: ' + ', '.join(fontes_ok) + ('. Sem resposta: ' + ', '.join(falhas) if falhas else '.'))
    return '\n'.join(L)


# ---------------------------------------------------------------- histórico (modelo de risco do painel)
def historico(cfg, hoje, tz_pts):
    anos = cfg.get('historico_anos', 2)
    desde = hoje - dt.timedelta(days=int(365.25 * anos) + 5)
    S, falhas = {}, []
    faixa = '%dy' % anos

    def add(sid, pts, tipo, moeda, fonte):
        pts = [[d, round(v, 6)] for d, v in pts if d >= desde.isoformat()]
        if len(pts) >= 3:
            S[sid] = {'pts': pts, 'tipo': tipo, 'moeda': moeda, 'fonte': fonte}
    for a in cfg['ativos_b3'] + cfg['ativos_eua']:
        if sem_tempo():
            falhas.append('%s: sem tempo nesta rodada' % a['id'])
            continue
        try:
            y = yahoo(a['yahoo'], faixa, '1d')
            add(a['id'], y['adj'], 'ajustado', 'BRL' if a in cfg['ativos_b3'] else 'USD', 'Yahoo Finance (via robô)')
        except Exception as e:
            falhas.append('%s: %s' % (a['id'], e))
    for sid, sim, tipo, moeda in (('IBOV', '^BVSP', 'nivel', 'BRL'), ('SPX', '^GSPC', 'nivel', 'USD'), ('EEM', 'EEM', 'ajustado', 'USD'),
                                  ('BRENT', 'BZ=F', 'preco', 'USD'), ('BTC', 'BTC-USD', 'preco', 'USD')):
        try:
            y = yahoo(sim, faixa, '1d')
            add(sid, y['adj'] if tipo == 'ajustado' else y['pts'], tipo, moeda, 'Yahoo Finance (via robô)')
        except Exception as e:
            falhas.append('%s: %s' % (sid, e))
    dias = (hoje - desde).days
    try:
        add('USDBRL', sgs(1, dias, hoje), 'nivel', 'BRL', 'Banco Central · PTAX venda (SGS 1)')
    except Exception as e:
        falhas.append('USDBRL: %s' % e)
    try:
        cdi, idx, pts = sgs(12, dias, hoje), 1000.0, []
        for d, v in cdi:
            idx *= 1 + v / 100
            pts.append((d, idx))
        add('CDI', pts, 'nivel', 'BRL', 'Banco Central · CDI diário acumulado (SGS 12), base 1.000')
    except Exception as e:
        falhas.append('CDI: %s' % e)
    try:
        add('SELIC', sgs(432, dias, hoje), 'taxa', 'BRL', 'Banco Central · meta Selic (SGS 432)')
    except Exception as e:
        falhas.append('SELIC: %s' % e)
    for k, sid in (('pre', 'DI'), ('real', 'NTNB')):
        if k in tz_pts:
            add(sid, tz_pts[k]['pts'], 'taxa', 'BRL', 'Tesouro Transparente · %s (taxa de compra%s)' % (tz_pts[k]['nome'], ', aproximação do DI longo' if k == 'pre' else ''))
    try:
        us = treasury(list(range(desde.year, hoje.year + 1)))
        add('UST2', us['2 Yr'], 'taxa', 'USD', 'Tesouro dos EUA')
        add('UST10', us['10 Yr'], 'taxa', 'USD', 'Tesouro dos EUA')
    except Exception as e:
        falhas.append('UST: %s' % e)
    return S, falhas


# ---------------------------------------------------------------- principal
def main():
    with open(os.path.join(AQUI, 'config.json'), encoding='utf-8') as f:
        cfg = json.load(f)
    agora_ = agora()
    hoje = agora_.date()
    PRAZO['fim'] = time.monotonic() + float(os.environ.get('ROBO_PRAZO_MIN', '15')) * 60
    FALHAS.clear()
    teste = os.environ.get('ROBO_TESTE') in ('1', 'true', 'True')
    estado = ler('estado.json', {}) or {}
    anterior = ler('mercado.json', {}) or {}
    log('Robô Oregon · %s%s' % (agora_.strftime('%d/%m/%Y %H:%M'), ' · teste' if teste else ''))

    fat, ind, ativos, fontes = coletar(cfg, estado, anterior, hoje, agora_)
    snap = {'versao': 1, 'gerado_em': agora_.isoformat(timespec='seconds'), 'fatores': fat, 'indicadores': ind, 'ativos': ativos,
            'fontes': fontes, 'limites': cfg['limites']}

    # notícias: no máximo uma busca por hora; a leitura por IA é opcional
    ult_n = estado.get('noticias_em')
    if teste or not ult_n or (agora_ - dt.datetime.fromisoformat(ult_n)).total_seconds() > 55 * 60:
        arq = ler('noticias.json', {}) or {}
        nots, erros = coletar_noticias(cfg, (anterior.get('noticias') or []) + arq.get('itens', []))
        if nots:
            fontes['noticias'] = {'ok': True, 'quando': agora_.isoformat(timespec='minutes'), 'msg': '%d manchetes' % len(nots) + (' · sem: ' + ', '.join(e.split(':')[0] for e in erros) if erros else '')}
            estado['noticias_em'] = agora_.isoformat()
        else:
            fontes['noticias'] = {'ok': False, 'quando': agora_.isoformat(timespec='minutes'), 'msg': '; '.join(erros[:3]) or 'nenhuma manchete'}
        n, msg = ler_com_ia(nots, cfg)
        fontes['ia'] = {'ok': (n is not None) if os.environ.get('ANTHROPIC_API_KEY') else None, 'quando': agora_.isoformat(timespec='minutes'), 'msg': msg or ('%d manchetes lidas' % n)}
        snap['noticias'] = nots
        if nots:
            gravar('noticias.json', arquivar(nots, arq, agora_))
    else:
        snap['noticias'] = anterior.get('noticias') or []
        for k in ('noticias', 'ia'):
            if k in (anterior.get('fontes') or {}):
                fontes[k] = anterior['fontes'][k]

    ip = snap['indicadores'].get('ipca_mes')
    if ip and not estado.get('ipca_visto'):
        estado['ipca_visto'] = ip['data']  # primeira rodada: só registra o IPCA atual, sem alerta
    alertas = detectar(snap, cfg, estado, hoje)
    snap['alertas'] = alertas
    enviados = estado.get('enviados') or {}
    ja = set(x for v in enviados.values() for x in v)
    recente = (hoje - dt.timedelta(days=3)).isoformat()
    novos = [a for a in alertas if a['id'] not in ja and (a.get('data') or hoje.isoformat()) >= recente]
    tg = {'ok': None, 'msg': ''}
    if novos:
        okk, m = telegram(msg_alertas(novos, agora_))
        tg = {'ok': okk, 'msg': m or '%d alerta(s) enviado(s)' % len(novos)}
        if okk or not os.environ.get('TELEGRAM_TOKEN'):
            enviados.setdefault(hoje.isoformat(), []).extend(a['id'] for a in novos)
            ja.update(a['id'] for a in novos)
    if ip and ('ipca:' + ip['data']) in ja:
        estado['ipca_visto'] = ip['data']
    hh, mm = (int(x) for x in cfg.get('resumo_diario', '18:30').split(':'))
    if teste or (agora_.weekday() < 5 and (agora_.hour, agora_.minute) >= (hh, mm) and estado.get('resumo') != hoje.isoformat()):
        okk, m = telegram(msg_resumo(snap, cfg, hoje, 'teste do robô' if teste else 'fechamento'))
        tg = {'ok': okk, 'msg': m or 'resumo enviado'}
        if okk and not teste:
            estado['resumo'] = hoje.isoformat()
    fontes['telegram'] = {'ok': tg['ok'], 'quando': agora_.isoformat(timespec='minutes'), 'msg': tg['msg'] or 'nada novo para avisar'}
    estado['enviados'] = {k: v for k, v in enviados.items() if k >= (hoje - dt.timedelta(days=10)).isoformat()}

    # histórico: uma vez por dia, depois das 19h (ou se ainda não existe)
    hist = ler('historico.json')
    if teste or hist is None or (agora_.hour >= 19 and (hist.get('data_ref') or '') < hoje.isoformat()):
        tz_pts = {}
        try:
            tz_pts = tesouro(cfg['tesouro'], hoje - dt.timedelta(days=int(365.25 * cfg.get('historico_anos', 2)) + 5))
        except Exception as e:
            log('  ! histórico do Tesouro: %s' % e)
        S, falhas = historico(cfg, hoje, tz_pts)
        if S:
            gravar('historico.json', {'versao': 1, 'gerado_em': agora_.isoformat(timespec='seconds'), 'data_ref': hoje.isoformat(), 'series': S, 'falhas': falhas})
        log('  histórico: %d séries%s' % (len(S), (' · falhas: ' + '; '.join(falhas[:5])) if falhas else ''))
    snap['historico'] = {'disponivel': bool(ler('historico.json')), 'data_ref': (ler('historico.json') or {}).get('data_ref')}

    gravar('mercado.json', snap)
    gravar('estado.json', estado)
    for k, v in fontes.items():
        log('  %-9s %s %s' % (k, 'ok ' if v.get('ok') else ('—  ' if v.get('ok') is None else 'FALHOU'), v.get('msg') or ''))
    log('  alertas: %d (novos: %d)' % (len(alertas), len(novos)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
