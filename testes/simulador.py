# -*- coding: utf-8 -*-
"""Internet simulada para os testes: responde no formato de cada fonte real, com números SINTÉTICOS.
Nada aqui é dado de mercado. Cada fonte pode ser ligada, desligada ou forçada a um erro HTTP."""
import datetime as dt
import email.message
import io
import json
import math
import os
import sys
import urllib.error
import zipfile

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '..', 'robo'))

FERIADOS = {'2026-11-02', '2026-11-20'}


def pregoes(ini, fim):
    out, d = [], ini
    while d <= fim:
        if d.weekday() < 5 and d.isoformat() not in FERIADOS:
            out.append(d)
        d += dt.timedelta(days=1)
    return out


def preco_sintetico(t, d):
    h = sum(ord(c) for c in t)
    x = (d - dt.date(2024, 1, 1)).days
    return round(10 + h % 50 + 3 * math.sin(x / 17.0 + h) + x * 0.002, 2)


def linha_cotahist(d, cod, preco, fat=1, tpmerc='010', nome='EMPRESA', espec='ON NM', isin='BRTESTACNOR0', neg=150):
    p = '%013d' % int(round(preco * 100 * fat))
    s = ('01' + d.strftime('%Y%m%d') + '02' + cod.ljust(12) + tpmerc + nome.ljust(12)[:12] + espec.ljust(10)[:10] + '   ' + '    '
         + p * 5 + p * 2 + '%05d' % neg + '%018d' % 1000 + '%018d' % 100000 + '0' * 13 + '0' + '99991231' + '%07d' % fat + '0' * 13 + isin.ljust(12)[:12] + '000')
    assert len(s) == 245
    return s


def zip_txt(nome, linhas):
    b = io.BytesIO()
    with zipfile.ZipFile(b, 'w') as z:
        z.writestr(nome.replace('.ZIP', '.TXT'), ('\r\n'.join(['00COTAHIST'] + linhas + ['99COTAHIST'])).encode('latin-1'))
    return b.getvalue()


class Resp:
    def __init__(self, corpo, headers=None):
        self.corpo = corpo if isinstance(corpo, bytes) else corpo.encode('utf-8')
        self.headers = headers or {}

    def read(self):
        return self.corpo

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def erro(url, code, corpo=b'', retry=None):
    h = email.message.Message()
    if retry:
        h['Retry-After'] = str(retry)
    return urllib.error.HTTPError(url, code, 'erro simulado', h, io.BytesIO(corpo))


class Mundo:
    def __init__(self, hoje=dt.date(2026, 11, 6), **kw):
        self.hoje = hoje
        self.fora = set(kw.get('fora', ()))          # fontes desligadas (erro 503)
        self.http = dict(kw.get('http', {}))          # fonte -> código HTTP forçado
        self.yahoo_vazio = set(kw.get('yahoo_vazio', ()))
        self.yahoo_velho = set(kw.get('yahoo_velho', ()))  # símbolos com cotação de dias atrás
        self.anomalia = dict(kw.get('anomalia', {}))  # símbolo -> variação % do dia
        self.telegram_chat = kw.get('telegram_chat', '123')
        self.chamadas = []
        self.enviadas = []
        self.b3_ultimo = kw.get('b3_ultimo', dt.date(2026, 11, 5))
        self.cvm_docs = kw.get('cvm_docs', [])
        self.manchetes = kw.get('manchetes', {})
        self.rss = kw.get('rss', {})  # host -> [(título, dias atrás)]
        self.tickers_b3 = kw.get('tickers_b3', [])

    # --- respostas por fonte
    def __call__(self, req, timeout=None):
        url = req.full_url if hasattr(req, 'full_url') else req
        hdr = {k.lower(): v for k, v in (req.header_items() if hasattr(req, 'header_items') else [])}
        dados = getattr(req, 'data', None)
        self.chamadas.append(url)
        fonte = self._fonte(url)
        if fonte in self.fora:
            raise erro(url, 503)
        if fonte in self.http:
            raise erro(url, self.http[fonte], retry=1)
        return getattr(self, '_' + fonte)(url, hdr, dados)

    def _fonte(self, url):
        for chave, f in (('api.bcb.gov.br', 'bcb'), ('olinda.bcb.gov.br', 'focus'), ('tesourotransparente', 'tesouro'), ('home.treasury.gov', 'treasury'),
                         ('finance.yahoo.com', 'yahoo'), ('brapi.dev', 'brapi'), ('bvmf.bmfbovespa.com.br', 'b3'), ('awesomeapi', 'awesome'),
                         ('coingecko', 'coingecko'), ('tiingo.com', 'tiingo'), ('stlouisfed.org', 'fred'), ('news.google.com', 'google'),
                         ('servicodados.ibge.gov.br', 'ibge'), ('dados.cvm.gov.br', 'cvm'), ('api.telegram.org', 'telegram'), ('api.anthropic.com', 'anthropic'),
                         ('alphavantage.co', 'alphavantage'), ('braziljournal.com', 'rss'), ('rss.beehiiv.com', 'rss'), ('news.agrofy.com.br', 'rss')):
            if chave in url:
                return f
        raise AssertionError('URL não simulada: ' + url)

    def _bcb(self, url, hdr, dados):
        cod = int(url.split('bcdata.sgs.')[1].split('/')[0])
        if cod in (433, 13522):
            pts = [(dt.date(2026, m, 1), 0.30 + m / 100 if cod == 433 else 4.5) for m in range(1, 11)]
        elif cod == 432:
            ds = pregoes(self.hoje - dt.timedelta(days=60), self.hoje)
            pts = [(d, 14.25 if d < self.hoje else 13.75) for d in ds] + [(self.hoje + dt.timedelta(days=12), 13.75)]
        elif cod == 12:
            pts = [(d, 0.05) for d in pregoes(self.hoje - dt.timedelta(days=760), self.hoje)]
        elif cod == 1:
            pts = [(d, 5.40 + i * 0.0005) for i, d in enumerate(pregoes(self.hoje - dt.timedelta(days=760), self.hoje))]
        else:
            pts = [(d, 13.65) for d in pregoes(self.hoje - dt.timedelta(days=10), self.hoje)]
        return Resp(json.dumps([{'data': d.strftime('%d/%m/%Y'), 'valor': '%.4f' % v} for d, v in pts]))

    def _focus(self, url, hdr, dados):
        v = []
        for data, ipca in (('2026-11-02', 4.60), ('2026-10-26', 4.45), ('2026-10-19', 4.44)):
            for ind, m in (('IPCA', ipca), ('Selic', 13.50), ('PIB Total', 2.0), ('Câmbio', 5.45)):
                for ref in ('2026', '2027'):
                    v.append({'Indicador': ind, 'Data': data, 'DataReferencia': ref, 'Mediana': m, 'baseCalculo': 0})
        return Resp(json.dumps({'value': v}))

    def _tesouro(self, url, hdr, dados):
        L = ['Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha']
        for d in pregoes(self.hoje - dt.timedelta(days=760), self.hoje):
            pre = 13.10 if d < self.hoje else 13.42
            L.append('Tesouro Prefixado;01/01/2032;%s;%s;0;0;0;0' % (d.strftime('%d/%m/%Y'), ('%.2f' % pre).replace('.', ',')))
            L.append('Tesouro IPCA+;15/05/2035;%s;7,88;0;0;0;0' % d.strftime('%d/%m/%Y'))
        return Resp('\n'.join(L).encode('latin-1'))

    def _treasury(self, url, hdr, dados):
        L = ['Date,"2 Yr","10 Yr"']
        for i, d in enumerate(reversed(pregoes(self.hoje - dt.timedelta(days=400), self.hoje))):
            L.append('%s,4.20,%.2f' % (d.strftime('%m/%d/%Y'), 4.84 if i else 4.95))
        return Resp('\n'.join(L))

    def _yahoo(self, url, hdr, dados):
        sym = url.split('/chart/')[1].split('?')[0].replace('%5E', '^').replace('%3D', '=')
        if sym in self.yahoo_vazio:
            return Resp(json.dumps({'chart': {'result': None, 'error': {'code': 'Not Found', 'description': 'No data found'}}}))
        longo = 'range=2y' in url
        fim = self.hoje - dt.timedelta(days=5) if sym in self.yahoo_velho else self.hoje
        ds = pregoes(fim - dt.timedelta(days=740 if longo else 8), fim)
        t = sym.replace('.SA', '')
        closes = [preco_sintetico(t, d) for d in ds]
        if sym in self.anomalia:
            closes[-1] = round(closes[-2] * (1 + self.anomalia[sym] / 100), 2)
        ts = [int(dt.datetime(d.year, d.month, d.day, 13, 0, tzinfo=dt.timezone.utc).timestamp()) for d in ds]
        rt = int(dt.datetime(fim.year, fim.month, fim.day, 18, 25, tzinfo=dt.timezone.utc).timestamp())
        meta = {'regularMarketPrice': closes[-1], 'regularMarketTime': rt, 'gmtoffset': -10800, 'currency': 'USD' if '.SA' not in sym and sym[0] != '^' else 'BRL',
                'longName': 'Nome de teste ' + t, 'exchangeName': 'SAO' if '.SA' in sym else 'NYQ', 'firstTradeDate': 1600000000}
        return Resp(json.dumps({'chart': {'result': [{'meta': meta, 'timestamp': ts, 'indicators': {'quote': [{'close': closes}], 'adjclose': [{'adjclose': [c * 0.97 for c in closes]}]}}]}}))

    def _brapi(self, url, hdr, dados):
        if hdr.get('authorization') != 'Bearer tk-brapi':
            raise erro(url, 401)
        t = url.split('/quote/')[1].split('?')[0].replace('%5E', '^')
        if 'range=' in url:
            ds = pregoes(self.hoje - dt.timedelta(days=95), self.hoje)
            hist = [{'date': int(dt.datetime(d.year, d.month, d.day, 13, tzinfo=dt.timezone.utc).timestamp()), 'close': preco_sintetico(t, d), 'adjustedClose': preco_sintetico(t, d) * 0.98} for d in ds]
            return Resp(json.dumps({'results': [{'symbol': t, 'historicalDataPrice': hist}]}))
        p0, p1 = preco_sintetico(t, self.hoje - dt.timedelta(days=1)), preco_sintetico(t, self.hoje)
        return Resp(json.dumps({'results': [{'symbol': t, 'regularMarketPrice': p1, 'regularMarketPreviousClose': p0, 'regularMarketChangePercent': (p1 / p0 - 1) * 100,
                                             'regularMarketTime': '%sT17:20:00.000Z' % self.hoje.isoformat(), 'longName': 'Nome brapi ' + t}]}))

    def _b3(self, url, hdr, dados):
        nome = url.rsplit('/', 1)[1]
        tk = self.tickers_b3
        if nome.startswith('COTAHIST_A'):
            ano = int(nome[10:14])
            if ano >= self.hoje.year:
                raise erro(url, 404)
            ds = pregoes(dt.date(ano, 1, 1), dt.date(ano, 12, 31))
        elif nome.startswith('COTAHIST_M'):
            mes, ano = int(nome[10:12]), int(nome[12:16])
            ini = dt.date(ano, mes, 1)
            fim = (dt.date(ano + (mes == 12), mes % 12 + 1, 1) - dt.timedelta(days=1))
            ds = [d for d in pregoes(ini, min(fim, self.b3_ultimo))]
            if not ds:
                raise erro(url, 404)
        else:
            d = dt.date(int(nome[14:18]), int(nome[12:14]), int(nome[10:12]))
            if d > self.b3_ultimo or d.weekday() >= 5 or d.isoformat() in FERIADOS:
                raise erro(url, 404)
            ds = [d]
        linhas = []
        for d in ds:
            for t in tk:
                linhas.append(linha_cotahist(d, t, preco_sintetico(t, d), nome='NOME ' + t[:4], isin='BR' + t[:4] + 'CTF000'))
                linhas.append(linha_cotahist(d, t, 1.0, tpmerc='070', nome='OPCAO'))  # outro mercado: deve ser ignorado
        return Resp(zip_txt(nome, linhas))

    def _awesome(self, url, hdr, dados):
        return Resp(json.dumps({'USDBRL': {'bid': '5.5200', 'varBid': '0.0760', 'pctChange': '1.40', 'create_date': '%s 15:29:58' % self.hoje.isoformat()}}))

    def _coingecko(self, url, hdr, dados):
        t = int(dt.datetime(self.hoje.year, self.hoje.month, self.hoje.day, 17, tzinfo=dt.timezone.utc).timestamp())
        return Resp(json.dumps({'bitcoin': {'usd': 70000, 'usd_24h_change': 2.0, 'last_updated_at': t}}))

    def _alphavantage(self, url, hdr, dados):
        import urllib.parse
        q = urllib.parse.parse_qs(url.split('?', 1)[1])
        if q.get('apikey') != ['tk-av']:
            return Resp(json.dumps({'Error Message': 'Invalid API call. Please retry or visit the documentation.'}))
        self.av_pedidos = getattr(self, 'av_pedidos', 0) + 1
        if self.av_pedidos > 25:
            return Resp(json.dumps({'Information': 'We have detected your API key and our standard API rate limit is 25 requests per day.'}))
        sym = q['symbol'][0]
        t = sym.replace('.SAO', '')
        d1 = self.hoje  # fechamento do dia, publicado depois do pregão
        p1, p0 = preco_sintetico(t, d1), preco_sintetico(t, d1 - dt.timedelta(days=1))
        return Resp(json.dumps({'Global Quote': {'01. symbol': sym, '05. price': '%.4f' % p1, '07. latest trading day': d1.isoformat(), '08. previous close': '%.4f' % p0}}))

    def _tiingo(self, url, hdr, dados):
        if hdr.get('authorization') != 'Token tk-tiingo':
            raise erro(url, 401)
        sym = url.split('/daily/')[1].split('/')[0].upper()
        ini = dt.date.fromisoformat(url.split('startDate=')[1][:10])
        ds = pregoes(ini, self.hoje - dt.timedelta(days=1))
        return Resp(json.dumps([{'date': d.isoformat() + 'T00:00:00.000Z', 'close': preco_sintetico(sym, d), 'adjClose': preco_sintetico(sym, d) * 0.95} for d in ds]))

    def _fred(self, url, hdr, dados):
        ini = dt.date.fromisoformat(url.split('observation_start=')[1][:10])
        ds = pregoes(ini, self.hoje - dt.timedelta(days=1))
        return Resp(json.dumps({'observations': [{'date': d.isoformat(), 'value': '%.2f' % (5000 + i)} for i, d in enumerate(ds)] + [{'date': self.hoje.isoformat(), 'value': '.'}]}))

    def _google(self, url, hdr, dados):
        import urllib.parse
        q = urllib.parse.unquote(url.split('q=')[1].split('&')[0])
        itens = self.manchetes.get(q.replace(' when:2d', ''), [])
        xml = ''.join('<item><title>%s - %s</title><link>https://exemplo.test/%d</link><pubDate>%s</pubDate><source url="https://f.test">%s</source></item>'
                      % (t.replace('&', '&amp;'), f, i, dt.datetime(self.hoje.year, self.hoje.month, self.hoje.day, 14, i % 60).strftime('%a, %d %b %Y %H:%M:%S GMT'), f)
                      for i, (t, f) in enumerate(itens))
        return Resp('<?xml version="1.0"?><rss><channel>%s</channel></rss>' % xml)

    def _rss(self, url, hdr, dados):
        itens = self.rss.get(url.split('/')[2], [])
        dia = dt.datetime(self.hoje.year, self.hoje.month, self.hoje.day, 12, 0)
        xml = ''.join('<item><title>%s</title><link>https://%s/%d</link><pubDate>%s</pubDate><description>texto completo que não deve ser guardado</description></item>'
                      % (t.replace('&', '&amp;'), url.split('/')[2], i, (dia - dt.timedelta(days=d)).strftime('%a, %d %b %Y %H:%M:%S +0000')) for i, (t, d) in enumerate(itens))
        return Resp('<?xml version="1.0"?><rss><channel>%s</channel></rss>' % xml)

    def _ibge(self, url, hdr, dados):
        return Resp(json.dumps({'items': [
            {'titulo': 'IPCA de outubro fica em 0,40% (teste)', 'introducao': 'Índice de preços ao consumidor', 'data_publicacao': self.hoje.strftime('%d/%m/%Y') + ' 09:00:00', 'link': 'https://ibge.test/1'},
            {'titulo': 'Censo agropecuário divulga mapa de solos (teste)', 'introducao': 'cartografia', 'data_publicacao': self.hoje.strftime('%d/%m/%Y') + ' 10:00:00', 'link': 'https://ibge.test/2'}]}))

    def _cvm(self, url, hdr, dados):
        cab = 'CNPJ_Companhia;Nome_Companhia;Codigo_CVM;Data_Referencia;Categoria;Tipo;Especie;Assunto;Data_Entrega;Tipo_Apresentacao;Protocolo_Entrega;Versao;Link_Download'
        linhas = [cab] + [';'.join(r) for r in self.cvm_docs]
        b = io.BytesIO()
        with zipfile.ZipFile(b, 'w') as z:
            z.writestr('ipe_cia_aberta_%d.csv' % self.hoje.year, '\n'.join(linhas).encode('latin-1'))
        return Resp(b.getvalue())

    def _telegram(self, url, hdr, dados):
        if url.endswith('/getMe'):
            return Resp(json.dumps({'ok': True, 'result': {'username': 'robo_teste_bot'}}))
        import urllib.parse
        d = dict(urllib.parse.parse_qsl(dados.decode()))
        if d.get('chat_id') != self.telegram_chat:
            raise erro(url, 400, json.dumps({'ok': False, 'error_code': 400, 'description': 'Bad Request: chat not found'}).encode())
        self.enviadas.append(d['text'])
        return Resp(json.dumps({'ok': True}))

    def _anthropic(self, url, hdr, dados):
        corpo = json.loads(dados.decode())
        itens = [{'i': 0, 'relevancia': 'alta', 'tickers': ['KLBN4'], 'fatores': ['usd', 'inventado'], 'direcao': 'positivo', 'resumo': 'Resumo de teste.'}]
        return Resp(json.dumps({'stop_reason': 'end_turn', 'content': [{'type': 'text', 'text': json.dumps({'itens': itens})}]}))
