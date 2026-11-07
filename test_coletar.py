# -*- coding: utf-8 -*-
"""Testes do robô com respostas simuladas das fontes (nada aqui é dado de mercado real).
Rodar: python -m unittest testes/test_coletar.py"""
import datetime as dt
import json
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'robo'))
import coletar as R  # noqa: E402

HOJE = dt.date(2026, 11, 6)  # sexta-feira


def dias_uteis(n, fim=HOJE):
    out, d = [], fim
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d)
        d -= dt.timedelta(days=1)
    return sorted(out)


def sgs_json(pts):
    return json.dumps([{'data': d.strftime('%d/%m/%Y'), 'valor': ('%.4f' % v)} for d, v in pts]).encode()


def yahoo_json(closes, preco=None, moeda='BRL', datas=None):
    datas = datas or dias_uteis(len(closes))
    ts = [int(dt.datetime(d.year, d.month, d.day, 13, 0, tzinfo=dt.timezone.utc).timestamp()) for d in datas]
    return json.dumps({'chart': {'result': [{'meta': {'regularMarketPrice': preco if preco is not None else closes[-1], 'currency': moeda, 'gmtoffset': -10800,
                                                      'regularMarketTime': ts[-1]},
                                             'timestamp': ts, 'indicators': {'quote': [{'close': closes}], 'adjclose': [{'adjclose': [c * 0.98 for c in closes]}]}}]}}).encode()


class Fontes:
    """Responde às URLs como as fontes reais responderiam (formato), com números sintéticos."""

    def __init__(self, falhar=(), yahoo_quebrado=False):
        self.falhar, self.yahoo_quebrado, self.chamadas = set(falhar), yahoo_quebrado, []
        self.ia_pedidos = 0

    def __call__(self, url, timeout=40, tentativas=3, cab=None, dados=None):
        self.chamadas.append(url)
        for f in self.falhar:
            if f in url:
                raise RuntimeError('%s: HTTP 503' % f)
        if 'bcdata.sgs.432' in url:
            ds = dias_uteis(12)
            pts = [(d, 14.25 if d < HOJE else 13.75) for d in ds] + [(HOJE + dt.timedelta(days=10), 13.75)]  # data futura deve sair
            return sgs_json(pts)
        if 'bcdata.sgs.4389' in url:
            return sgs_json([(d, 13.65) for d in dias_uteis(5)])
        if 'bcdata.sgs.433' in url:
            return sgs_json([(dt.date(2026, m, 1), 0.3 + m / 100) for m in range(1, 11)])
        if 'bcdata.sgs.13522' in url:
            return sgs_json([(dt.date(2026, m, 1), 4.5) for m in range(1, 11)])
        if 'bcdata.sgs.1/' in url or 'bcdata.sgs.1?' in url:
            ds = dias_uteis(600 if 'dataInicial' in url and int(url.split('dataInicial=')[1][6:10]) < 2026 else 8)
            return sgs_json([(d, 5.40 + i * 0.001) for i, d in enumerate(ds)])
        if 'bcdata.sgs.12/' in url or 'bcdata.sgs.12?' in url:
            return sgs_json([(d, 0.05) for d in dias_uteis(500)])
        if 'olinda.bcb.gov.br' in url:
            v = []
            for data, ipca in (('2026-11-02', 4.60), ('2026-10-26', 4.45), ('2026-10-19', 4.44)):
                for ind, m in (('IPCA', ipca), ('Selic', 13.50), ('PIB Total', 2.0), ('Câmbio', 5.45)):
                    for ref in ('2026', '2027'):
                        v.append({'Indicador': ind, 'Data': data, 'DataReferencia': ref, 'Mediana': m, 'baseCalculo': 0})
                        v.append({'Indicador': ind, 'Data': data, 'DataReferencia': ref, 'Mediana': m + 9, 'baseCalculo': 1})
            return json.dumps({'value': v}).encode()
        if 'tesourotransparente' in url:
            linhas = ['Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha']
            for i, d in enumerate(dias_uteis(30)):
                pre = 13.10 if d < HOJE else 13.42
                linhas.append('Tesouro Prefixado;01/01/2032;%s;%s;%s;600,00;601,00;600,50' % (d.strftime('%d/%m/%Y'), ('%.2f' % pre).replace('.', ','), ('%.2f' % (pre + 0.12)).replace('.', ',')))
                linhas.append('Tesouro IPCA+;15/05/2035;%s;7,88;8,00;2000,00;2010,00;2005,00' % d.strftime('%d/%m/%Y'))
                linhas.append('Tesouro Selic;01/03/2031;%s;0,05;0,06;17000,00;17010,00;17005,00' % d.strftime('%d/%m/%Y'))
            return '\n'.join(linhas).encode('latin-1')
        if 'home.treasury.gov' in url:
            linhas = ['Date,"1 Mo","2 Yr","10 Yr","30 Yr"']
            for i, d in enumerate(reversed(dias_uteis(20))):
                linhas.append('%s,4.10,%.2f,%.2f,5.00' % (d.strftime('%m/%d/%Y'), 4.20, 4.84 if i else 4.95))
            return '\n'.join(linhas).encode()
        if 'awesomeapi' in url:
            return json.dumps({'USDBRL': {'bid': '5.5200', 'varBid': '0.0760', 'pctChange': '1.40', 'create_date': '2026-11-06 15:29:58'}}).encode()
        if 'finance.yahoo.com' in url:
            if self.yahoo_quebrado:
                raise RuntimeError('yahoo: HTTP 429')
            if 'range=2y' in url:
                return yahoo_json([10 + i * 0.01 for i in range(480)], datas=dias_uteis(480))
            sym = url.split('/chart/')[1].split('?')[0]
            if sym == 'VAMO3.SA':
                return yahoo_json([6.5, 6.5, 6.5, 6.5, 6.12], preco=6.12)
            if sym == '%5EBVSP':
                return yahoo_json([131000, 131000, 131000, 131000, 128430], preco=128430)
            return yahoo_json([20, 20, 20, 20, 20.1])
        if 'brapi.dev' in url:
            t = url.split('/quote/')[1].split('?')[0]
            return json.dumps({'results': [{'symbol': t, 'regularMarketPrice': 30.0, 'regularMarketPreviousClose': 31.0, 'regularMarketChangePercent': -3.2258,
                                            'regularMarketTime': '2026-11-06T18:20:00.000Z'}]}).encode()
        if 'coingecko' in url:
            return json.dumps({'bitcoin': {'usd': 70000, 'usd_24h_change': 2.0, 'last_updated_at': 1794000000}}).encode()
        if 'news.google.com' in url:
            itens = ''.join('<item><title>Manchete %d sobre o tema &amp; mercado - %s</title><link>https://news.google.com/x%d</link>'
                            '<pubDate>Fri, 06 Nov 2026 17:%02d:00 GMT</pubDate><source url="https://f.com">%s</source></item>' % (i, f, i, i, f)
                            for i, f in enumerate(['Valor Econômico', 'InfoMoney', 'Estadão']))
            return ('<?xml version="1.0"?><rss><channel>%s</channel></rss>' % itens).encode()
        if 'api.anthropic.com' in url:
            self.ia_pedidos += 1
            corpo = json.loads(dados.decode())
            assert cab['x-api-key'] == 'chave-teste'
            n = corpo['messages'][0]['content'].count('\n') - 1
            itens = [{'i': 0, 'relevancia': 'alta', 'tickers': ['KLBN4'], 'fatores': ['usd', 'inventado'], 'direcao': 'positivo', 'resumo': 'Resumo de teste.'}]
            return json.dumps({'content': [{'type': 'text', 'text': json.dumps({'itens': itens})}]}).encode()
        raise RuntimeError('URL não simulada: ' + url)


class BaseRobo(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        os.environ['ROBO_DADOS'] = R.DADOS = self.tmp
        os.environ['ROBO_AGORA'] = '2026-11-06T15:30:00-03:00'
        for k in ('TELEGRAM_TOKEN', 'TELEGRAM_CHAT_ID', 'BRAPI_TOKEN', 'ANTHROPIC_API_KEY', 'ROBO_TESTE'):
            os.environ.pop(k, None)
        self.enviadas = []
        self._tg = R.telegram
        R.telegram = lambda texto: (self.enviadas.append(texto) or (True, ''))
        self._bx = R.baixar
        R.time.sleep = lambda s: None

    def tearDown(self):
        R.telegram, R.baixar = self._tg, self._bx
        shutil.rmtree(self.tmp)

    def rodar(self, fontes):
        R.baixar = fontes
        self.assertEqual(R.main(), 0)
        with open(os.path.join(self.tmp, 'mercado.json'), encoding='utf-8') as f:
            return json.load(f)


class TestRobo(BaseRobo):
    def test_fatores_e_alertas(self):
        os.environ['TELEGRAM_TOKEN'] = 'x'
        m = self.rodar(Fontes())
        F = m['fatores']
        self.assertAlmostEqual(F['selic']['nivel'], 13.75)
        self.assertAlmostEqual(F['selic']['var'], -0.5)  # data futura do SGS ficou fora
        self.assertEqual(F['selic']['data'], HOJE.isoformat())
        self.assertAlmostEqual(F['pre']['var'], 0.32, places=6)
        self.assertIn('Prefixado 2032', F['pre']['detalhe'])
        self.assertAlmostEqual(F['usd']['var'], 1.40)
        self.assertAlmostEqual(F['ust10']['var'], 0.11, places=6)
        self.assertAlmostEqual(F['ibov']['var'], (128430 / 131000 - 1) * 100, places=6)
        ids = {a['id'].split(':')[0]: a for a in m['alertas']}
        for k in ('selic', 'pre', 'usd', 'ibov', 'ust10', 'VAMO3', 'focus'):
            self.assertIn(k, ids, k)
        self.assertEqual(ids['pre']['nivel'], 'forte')            # 0,32 ≥ 2 × 0,15
        self.assertEqual(ids['usd']['nivel'], 'atenção')
        self.assertNotIn('KLBN4', ids)                            # +0,5% fica abaixo do limite
        self.assertNotIn('VT', ids)                               # par americano não gera alerta próprio
        self.assertEqual(len(self.enviadas), 1)
        self.assertIn('Oregon · alerta de mercado', self.enviadas[0])
        self.assertIn('&amp;', R.msg_alertas([{'nivel': 'atenção', 'texto': 'A & B <c>'}], R.agora()))
        fo = m['indicadores']['focus']['IPCA']['anos']['2026']
        self.assertAlmostEqual(fo['mediana'], 4.60)              # baseCalculo 1 ignorado
        self.assertAlmostEqual(fo['var'], 0.15, places=6)

    def test_nao_repete_alerta(self):
        os.environ['TELEGRAM_TOKEN'] = 'x'
        self.rodar(Fontes())
        os.environ['ROBO_AGORA'] = '2026-11-06T16:00:00-03:00'
        self.rodar(Fontes())
        self.assertEqual(len(self.enviadas), 1, 'o mesmo alerta foi enviado duas vezes')

    def test_resumo_do_fim_do_dia_uma_vez(self):
        os.environ['TELEGRAM_TOKEN'] = 'x'
        os.environ['ROBO_AGORA'] = '2026-11-06T18:40:00-03:00'
        self.rodar(Fontes())
        os.environ['ROBO_AGORA'] = '2026-11-06T19:10:00-03:00'
        self.rodar(Fontes())
        resumos = [t for t in self.enviadas if 'fechamento de 06/11/2026' in t]
        self.assertEqual(len(resumos), 1)
        self.assertIn('VAMO3', resumos[0])
        self.assertIn('Focus 2026', resumos[0])

    def test_fonte_bloqueada_e_noticias(self):
        m = self.rodar(Fontes())
        fontes = {x['fonte'] for x in m['noticias']}
        self.assertNotIn('InfoMoney', fontes)
        self.assertIn('Valor Econômico', fontes)
        self.assertFalse(any(x['titulo'].endswith(' - Valor Econômico') for x in m['noticias']))
        self.assertFalse(m['fontes']['ia']['ok'] is False and 'ANTHROPIC' not in m['fontes']['ia']['msg'])

    def test_ia_opcional(self):
        os.environ['ANTHROPIC_API_KEY'] = 'chave-teste'
        os.environ['TELEGRAM_TOKEN'] = 'x'
        f = Fontes()
        m = self.rodar(f)
        lidas = [x for x in m['noticias'] if x.get('ia')]
        self.assertEqual(len(lidas), 1)
        self.assertEqual(lidas[0]['ia']['fatores'], ['usd'])     # fator inventado pela IA é descartado
        self.assertTrue(any(a['tipo'] == 'noticia' for a in m['alertas']))
        # rodada seguinte, dentro da mesma hora: não busca nem lê de novo
        os.environ['ROBO_AGORA'] = '2026-11-06T15:45:00-03:00'
        n0 = f.ia_pedidos
        self.rodar(f)
        self.assertEqual(f.ia_pedidos, n0)

    def test_arquivo_de_noticias(self):
        self.rodar(Fontes())
        with open(os.path.join(self.tmp, 'noticias.json'), encoding='utf-8') as f:
            a1 = json.load(f)
        self.assertTrue(a1['itens'] and all(x.get('visto_em') for x in a1['itens']))
        os.environ['ROBO_AGORA'] = '2026-11-06T17:00:00-03:00'
        self.rodar(Fontes())
        with open(os.path.join(self.tmp, 'noticias.json'), encoding='utf-8') as f:
            a2 = json.load(f)
        self.assertEqual(len(a2['itens']), len(a1['itens']))            # sem repetir
        self.assertEqual(a2['itens'][0]['visto_em'], a1['itens'][0]['visto_em'])  # guarda quando apareceu
        velho = R.arquivar([], {'itens': [{'titulo': 'antiga', 'quando': '2026-08-01T10:00'}]}, R.agora())
        self.assertEqual(velho['itens'], [])                            # mais de 60 dias sai

    def test_reserva_brapi_quando_yahoo_cai(self):
        os.environ['BRAPI_TOKEN'] = 'tk'
        m = self.rodar(Fontes(yahoo_quebrado=True))
        self.assertEqual(m['ativos']['KLBN4']['fonte'], 'brapi')
        self.assertTrue(m['fatores']['ibov']['ok'])
        self.assertEqual(m['fatores']['btc']['fonte'], 'CoinGecko (24 horas)')
        self.assertFalse(m['fatores']['sp']['ok'])                # sem reserva para o S&P: fica indisponível, nunca inventado
        self.assertNotIn('tk', json.dumps(m))                     # token não vaza para o arquivo público

    def test_tudo_fora_do_ar(self):
        m = self.rodar(Fontes(falhar=('bcb.gov.br', 'tesouro', 'treasury', 'yahoo', 'awesomeapi', 'coingecko', 'news.google')))
        self.assertFalse(m['fontes']['bcb']['ok'])
        self.assertFalse(m['fontes']['cotacoes']['ok'])
        self.assertFalse(any(f.get('ok') for f in m['fatores'].values()))
        self.assertEqual(m['alertas'], [])

    def test_historico(self):
        os.environ['ROBO_AGORA'] = '2026-11-06T19:30:00-03:00'
        self.rodar(Fontes())
        with open(os.path.join(self.tmp, 'historico.json'), encoding='utf-8') as f:
            h = json.load(f)
        S = h['series']
        for sid in ('PETR4', 'VT', 'IBIT', 'IBOV', 'USDBRL', 'CDI', 'SELIC', 'DI', 'NTNB', 'UST10'):
            self.assertIn(sid, S, sid)
        self.assertEqual(S['PETR4']['tipo'], 'ajustado')
        self.assertEqual(S['VT']['moeda'], 'USD')
        cdi = [p[1] for p in S['CDI']['pts']]
        self.assertTrue(all(b > a for a, b in zip(cdi, cdi[1:])))
        self.assertIn('aproximação do DI longo', S['DI']['fonte'])



class TestRevisao(unittest.TestCase):
    """Casos levantados na revisão independente (respostas simuladas)."""

    def setUp(self):
        self._bx = R.baixar
        R.time.sleep = lambda s: None
        R.FALHAS.clear()

    def tearDown(self):
        R.baixar = self._bx

    def test_yahoo_sem_barra_de_hoje(self):
        datas = [dt.date(2026, 11, 4), dt.date(2026, 11, 5)]
        ts = [int(dt.datetime(d.year, d.month, d.day, 13, 0, tzinfo=dt.timezone.utc).timestamp()) for d in datas]
        vivo = int(dt.datetime(2026, 11, 6, 17, 0, tzinfo=dt.timezone.utc).timestamp())
        corpo = json.dumps({'chart': {'result': [{'meta': {'regularMarketPrice': 111, 'regularMarketTime': vivo, 'gmtoffset': -10800},
                                                  'timestamp': ts + [vivo], 'indicators': {'quote': [{'close': [102, 110, None]}]}}]}}).encode()
        R.baixar = lambda url, **kw: corpo
        c = R.cotacao_yahoo('X')
        self.assertEqual(c['data'], '2026-11-06')
        self.assertAlmostEqual(c['var'], (111 / 110 - 1) * 100)

    def test_tesouro_taxa_zerada_fica_fora(self):
        csv_ = ('Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha\n'
                'Tesouro Prefixado;01/01/2032;05/11/2026;13,10;13,22;600,00;601,00;600,50\n'
                'Tesouro Prefixado;01/01/2032;06/11/2026;0,00;13,40;0,00;601,00;600,50\n').encode('latin-1')
        R.baixar = lambda url, **kw: csv_
        tz = R.tesouro({'pre': {'tipo': 'Tesouro Prefixado', 'vencimento': '2032-01-01'}}, dt.date(2026, 10, 1))
        self.assertEqual(tz['pre']['pts'], [('2026-11-05', 13.10)])

    def test_mensagem_longa_nao_corta_html(self):
        linhas = ['<b>Resumo</b>'] + ['• KLBN4: <a href="https://news.google.com/%s">Manchete &amp; teste %d</a> (Valor)' % ('x' * 300, i) for i in range(30)]
        ps = R.partes('\n'.join(linhas))
        self.assertGreater(len(ps), 1)
        for p in ps:
            self.assertLessEqual(len(p), 3800)
            self.assertEqual(p.count('<a '), p.count('</a>'))
        self.assertEqual(sum(p.count('<a ') for p in ps), 30)

    def test_ia_com_saida_malformada_nao_derruba(self):
        os.environ['ANTHROPIC_API_KEY'] = 'chave-teste'
        try:
            itens = [{'i': 0, 'tickers': 5, 'fatores': [['usd']], 'relevancia': 'alta'}, {'i': 'x'}, {'i': 1, 'tickers': ['KLBN4'], 'fatores': ['usd'], 'relevancia': 'enorme'}]
            R.baixar = lambda url, **kw: json.dumps({'stop_reason': 'end_turn', 'content': [{'type': 'text', 'text': json.dumps({'itens': itens})}]}).encode()
            nots = [{'titulo': 'A'}, {'titulo': 'B'}]
            n, msg = R.ler_com_ia(nots, {'ativos_b3': []})
            self.assertEqual(n, 2)
            self.assertEqual(nots[0]['ia']['tickers'], [])
            self.assertEqual(nots[0]['ia']['fatores'], [])
            self.assertIsNone(nots[1]['ia']['relevancia'])
            R.baixar = lambda url, **kw: json.dumps({'stop_reason': 'max_tokens', 'content': []}).encode()
            n, msg = R.ler_com_ia([{'titulo': 'C'}], {'ativos_b3': []})
            self.assertIsNone(n)
        finally:
            os.environ.pop('ANTHROPIC_API_KEY', None)

    def test_focus_mesmo_movimento_mesmo_id(self):
        cfg = {'limites': {'fatores': {}, 'ativos': {}, 'focus': {'IPCA': 0.10}}, 'ativos_b3': [], 'ativos_eua': []}
        ids = set()
        for d in ('2026-11-03', '2026-11-04', '2026-11-05'):
            snap = {'fatores': {}, 'ativos': {}, 'indicadores': {'focus': {'IPCA': {'data': d, 'anos': {'2026': {'mediana': 4.60, 'var': 0.15}}}}}}
            ids |= {a['id'] for a in R.detectar(snap, cfg, {}, dt.date(2026, 11, 6))}
        self.assertEqual(len(ids), 1)


class TestRevisaoFluxo(BaseRobo):
    def test_ipca_nao_se_perde_se_telegram_falhar(self):
        os.environ['TELEGRAM_TOKEN'] = 'x'
        self.rodar(Fontes())                                        # registra o IPCA de outubro
        with open(os.path.join(self.tmp, 'estado.json'), encoding='utf-8') as f:
            est = json.load(f)
        est['ipca_visto'] = '2026-09-01'                            # simula: saiu um IPCA novo
        with open(os.path.join(self.tmp, 'estado.json'), 'w', encoding='utf-8') as f:
            json.dump(est, f)
        R.telegram = lambda t: (False, 'fora do ar')
        os.environ['ROBO_AGORA'] = '2026-11-06T16:00:00-03:00'
        self.rodar(Fontes())
        R.telegram = lambda t: (self.enviadas.append(t) or (True, ''))
        os.environ['ROBO_AGORA'] = '2026-11-06T16:30:00-03:00'
        self.rodar(Fontes())
        self.assertTrue(any('IPCA de 10/2026' in t for t in self.enviadas), 'alerta do IPCA perdido')

    def test_alerta_velho_nao_volta(self):
        os.environ['TELEGRAM_TOKEN'] = 'x'
        self.rodar(Fontes())
        n0 = len(self.enviadas)
        os.environ['ROBO_AGORA'] = '2026-11-13T15:30:00-03:00'      # uma semana depois, mesmos dados (fontes paradas)
        self.rodar(Fontes())
        self.assertEqual(len(self.enviadas), n0, 'reenviou alerta de dias atrás')

if __name__ == '__main__':
    unittest.main()
