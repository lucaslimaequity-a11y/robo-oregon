# -*- coding: utf-8 -*-
"""Testes do robô v2 com a internet simulada (testes/simulador.py). Nenhum número aqui é dado real.
Rodar na pasta do projeto:  python -m unittest discover -s testes -v"""
import datetime as dt
import io
import json
import os
import shutil
import sys
import tempfile
import unittest
import urllib.request
from unittest import mock

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, '..', 'robo'))

import simulador as S  # noqa: E402
import b3  # noqa: E402
import calendario  # noqa: E402
import config  # noqa: E402
import coletar  # noqa: E402
import cotacoes  # noqa: E402
import historico  # noqa: E402
import noticias  # noqa: E402
import util  # noqa: E402

# Os testes usam uma cópia fixa da configuração (testes/config_teste.json): mudar robo/config.json não quebra os testes.
CONFIG_TESTE = os.path.join(AQUI, 'config_teste.json')
CONFIG_REAL = os.path.join(AQUI, '..', 'robo', 'config.json')
CFG = config.carregar(CONFIG_TESTE)
TICKERS_B3 = [a['id'] for a in CFG['ativos'] if a['mercado'] == 'B3']
SEGREDOS = {'TELEGRAM_TOKEN': '999:segredo-do-bot', 'TELEGRAM_CHAT_ID': '123'}


class Base(unittest.TestCase):
    agora = '2026-11-06T15:30:00-03:00'

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.saida = os.path.join(self.tmp, 'saida.txt')
        self.resumo = os.path.join(self.tmp, 'resumo.md')
        self.env = {'ROBO_DADOS': os.path.join(self.tmp, 'data'), 'ROBO_AGORA': self.agora, 'GITHUB_OUTPUT': self.saida, 'GITHUB_STEP_SUMMARY': self.resumo,
                    'ROBO_CONFIG': CONFIG_TESTE}
        self.p_env = mock.patch.dict(os.environ, self.env)
        self.p_env.start()
        for k in ('TELEGRAM_TOKEN', 'TELEGRAM_CHAT_ID', 'BRAPI_TOKEN', 'TIINGO_TOKEN', 'FRED_API_KEY', 'AWESOMEAPI_KEY', 'ANTHROPIC_API_KEY', 'ROBO_MODO', 'ROBO_MANUAL'):
            os.environ.pop(k, None)
        self.p_sleep = mock.patch.object(util.time, 'sleep', lambda s: None)
        self.p_sleep.start()

    def tearDown(self):
        mock.patch.stopall()
        shutil.rmtree(self.tmp)

    def rodar(self, mundo, **env):
        os.environ.update({k: str(v) for k, v in env.items()})
        mundo.tickers_b3 = mundo.tickers_b3 or TICKERS_B3
        buf = io.StringIO()
        with mock.patch.object(urllib.request, 'urlopen', mundo), mock.patch('sys.stdout', buf):
            self.assertEqual(coletar.main(), 0)
        self.log = buf.getvalue()
        return self.ler('mercado.json')

    def ler(self, nome):
        with open(os.path.join(self.tmp, 'data', nome), encoding='utf-8') as f:
            return json.load(f)

    def saidas(self):
        with open(self.saida, encoding='utf-8') as f:
            return dict(l.split('=', 1) for l in f.read().strip().splitlines())


class TestCenarioDoLog(Base):
    """Reproduz o cenário do log real: Yahoo recusando tudo, AwesomeAPI falhando, sem chave da brapi."""

    def test_yahoo_bloqueado_sem_brapi(self):
        m = S.Mundo(http={'yahoo': 429, 'awesome': 401})
        snap = self.rodar(m)
        cob = snap['cobertura']
        self.assertEqual(cob['total'], 54)
        # sem Yahoo e sem chave da brapi, o ETF fica indisponível com o motivo (nunca 0%, nunca valor inventado);
        # o arquivo da B3 não é baixado: os termos da B3 vedam coleta automatizada
        self.assertEqual(snap['ativos']['LFTB11']['status'], 'indisponivel')
        self.assertNotIn('var', snap['ativos']['LFTB11'])
        self.assertIn('limite de requisições', snap['ativos']['LFTB11']['motivo'])
        self.assertFalse(any('bmfbovespa' in u for u in m.chamadas))
        # ETFs americanos sem Yahoo e sem Tiingo: indisponíveis, nunca 0%
        self.assertEqual(snap['ativos']['VT']['status'], 'indisponivel')
        self.assertNotIn('var', snap['ativos']['VT'])
        self.assertIn('limite de requisições', snap['ativos']['VT']['motivo'])
        # Yahoo pausado depois de 3 falhas seguidas de limite, e isso aparece no relatório
        self.assertEqual(cob['por_fornecedor']['Yahoo']['pausada_por'], 'limite')
        self.assertIn('brapi', cob['fontes_sem_chave'])
        # dólar cai para a PTAX (fechamento oficial do Banco Central)
        self.assertEqual(snap['fatores']['usd']['fonte'], 'Banco Central · PTAX venda')
        self.assertFalse(snap['fatores']['sp']['ok'])
        self.assertIn(snap['status']['nivel'], ('parcial', 'critico'))
        self.assertNotEqual(snap['status']['nivel'], 'completo')
        self.assertEqual(self.saidas()['status'], snap['status']['nivel'])
        with open(self.resumo, encoding='utf-8') as f:
            md = f.read()
        self.assertIn('Cobertura das cotações', md)
        self.assertIn('Yahoo', md)

    def test_tudo_fora_e_critico(self):
        m = S.Mundo(fora={'yahoo', 'awesome', 'coingecko', 'b3', 'bcb', 'focus', 'tesouro', 'treasury', 'google', 'ibge', 'cvm'})
        snap = self.rodar(m)
        self.assertEqual(snap['status']['nivel'], 'critico')
        self.assertEqual(snap['cobertura']['atualizados'], 0)
        self.assertEqual(self.saidas()['status'], 'critico')
        self.assertEqual(snap['alertas'], [])
        for c in snap['ativos'].values():
            self.assertEqual(c['status'], 'indisponivel')
            self.assertNotIn('var', c)


class TestCotacoes(Base):
    def test_tudo_respondendo_completo(self):
        m = S.Mundo()
        snap = self.rodar(m, BRAPI_TOKEN='tk-brapi', TIINGO_TOKEN='tk-tiingo', FRED_API_KEY='k')
        cob = snap['cobertura']
        self.assertEqual(cob['atualizados'], 54, cob)
        self.assertEqual(snap['status']['nivel'], 'completo', snap['status'])
        self.assertEqual(snap['ativos']['PETR4']['fonte'], 'Yahoo Finance')  # Yahoo primeiro; a brapi (cota mensal) fica de reserva
        self.assertFalse(any('bmfbovespa' in u for u in m.chamadas))
        self.assertEqual(snap['ativos']['PETR4']['tipo_preco'], 'intradiario')
        self.assertEqual(snap['ativos']['VT']['fonte'], 'Yahoo Finance')
        self.assertEqual(snap['fatores']['ibov']['fonte'], 'brapi')

    def test_dado_velho_vira_desatualizado_e_tenta_proxima_fonte(self):
        m = S.Mundo(yahoo_velho={'VT'})
        snap = self.rodar(m, TIINGO_TOKEN='tk-tiingo')
        self.assertEqual(snap['ativos']['VT']['fonte'], 'Tiingo')  # Yahoo velho → Tiingo (fechamento de ontem) atualizado
        self.assertEqual(snap['ativos']['VT']['status'], 'atualizado')
        os.environ.pop('TIINGO_TOKEN')
        m = S.Mundo(yahoo_velho={'VT'})
        snap = self.rodar(m)
        self.assertEqual(snap['ativos']['VT']['status'], 'desatualizado')
        self.assertIn('esperado a partir de', snap['ativos']['VT']['motivo'])

    def test_variacao_anormal_suspeita(self):
        m = S.Mundo(anomalia={'VAMO3.SA': -40})
        snap = self.rodar(m, TELEGRAM_TOKEN='x', TELEGRAM_CHAT_ID='123')
        v = snap['ativos']['VAMO3']
        self.assertEqual(v['status'], 'suspeito')
        a = [x for x in snap['alertas'] if x.get('t') == 'VAMO3']
        self.assertTrue(a and a[0]['suspeito'] and 'conferir' in a[0]['texto'])
        self.assertIn('VAMO3', snap['cobertura']['lista_suspeitos'])

    def test_reaproveita_ultimo_valido_como_desatualizado(self):
        self.rodar(S.Mundo())
        os.environ['ROBO_AGORA'] = '2026-11-06T16:00:00-03:00'
        snap = self.rodar(S.Mundo(http={'yahoo': 403}))
        vt = snap['ativos']['VT']
        self.assertEqual(vt['status'], 'desatualizado')
        self.assertTrue(vt['reaproveitado'])
        self.assertIn('último valor válido', vt['motivo'])

    def test_yahoo_ticker_inexistente_nao_pausa_a_fonte(self):
        m = S.Mundo(yahoo_vazio={'LFTB11.SA', 'IRFM11.SA', '5PRE11.SA', 'IDKA11.SA', 'B5P211.SA'})
        snap = self.rodar(m)
        self.assertNotIn('pausada_por', snap['cobertura']['por_fornecedor']['Yahoo'])
        self.assertEqual(snap['ativos']['IMAB11']['fonte'], 'Yahoo Finance')  # o sexto da fila ainda é consultado
        self.assertEqual(snap['ativos']['LFTB11']['status'], 'indisponivel')  # sem brapi: fica sem cotação, com o motivo
        self.assertIn('Yahoo', snap['ativos']['LFTB11']['motivo'])

    def test_fora_da_agenda_nao_publica(self):
        os.environ['ROBO_AGORA'] = '2026-11-08T15:00:00-03:00'  # domingo
        m = S.Mundo()
        os.environ['ROBO_DADOS'] = os.path.join(self.tmp, 'data')
        with mock.patch.object(urllib.request, 'urlopen', m), mock.patch('sys.stdout', io.StringIO()):
            coletar.main()
        self.assertEqual(self.saidas()['pular'], 'true')
        self.assertEqual(m.chamadas, [])


class TestB3(unittest.TestCase):
    def test_leitura_do_layout_oficial(self):
        d = dt.date(2026, 11, 5)
        linhas = [S.linha_cotahist(d, 'PETR4', 38.25, nome='PETROBRAS', espec='PN N2', isin='BRPETRACNPR6'),
                  S.linha_cotahist(d, 'XYZW11', 1234.5, fat=1000),
                  S.linha_cotahist(d, 'PETR4', 2.0, tpmerc='070')]
        precos, info = b3.ler_linhas(linhas, ['PETR4', 'XYZW11'])
        self.assertEqual(precos['PETR4']['2026-11-05'][0], 38.25)
        self.assertAlmostEqual(precos['XYZW11']['2026-11-05'][0], 1234.5, 6)  # cotado por lote de 1.000 (FATCOT): convertido para preço por cota
        self.assertEqual(info['PETR4']['isin'], 'BRPETRACNPR6')
        self.assertEqual(info['PETR4']['nome'], 'PETROBRAS')

    def test_calendario_com_feriado(self):
        fer = set(CFG['feriados_b3'])
        segunda = dt.datetime(2026, 11, 23, 9, 0, tzinfo=util.BRT)
        self.assertEqual(calendario.ultima_sessao(segunda, fer).isoformat(), '2026-11-19')  # 20/11 é feriado
        self.assertEqual(calendario.ultima_sessao_fechada(dt.datetime(2026, 11, 6, 21, 30, tzinfo=util.BRT), fer, '21:00').isoformat(), '2026-11-06')


class TestHistorico(Base):
    agora = '2026-11-06T21:10:00-03:00'

    def test_series_tipadas_e_fontes_registradas(self):
        snap = self.rodar(S.Mundo(), BRAPI_TOKEN='tk-brapi', TIINGO_TOKEN='tk-tiingo', FRED_API_KEY='k')
        h = self.ler('historico.json')['series']
        self.assertEqual(h['PETR4']['tipo'], 'ajustado')
        self.assertTrue(h['PETR4']['retorno_total'])
        self.assertIn('Yahoo', h['PETR4']['fonte'])
        self.assertEqual(h['DXY']['tipo'], 'nivel')  # dólar global do Fed (domínio público, via FRED com chave)
        self.assertNotIn('HYOAS', h)  # ICE BofA: reprodução proibida sem licença; não vai para o site público
        self.assertEqual(h['CDI']['tipo'], 'nivel')
        self.assertTrue(snap['historico']['disponivel'])

    def test_sem_yahoo_usa_brapi(self):
        self.rodar(S.Mundo(http={'yahoo': 429}), BRAPI_TOKEN='tk-brapi')
        h = self.ler('historico.json')['series']
        self.assertIn('brapi', h['LFTB11']['fonte'])
        self.assertIn(h['LFTB11']['tipo'], ('ajustado', 'preco'))
        if h['LFTB11']['tipo'] == 'preco':
            self.assertIsNone(h['LFTB11']['retorno_total'])  # distribuição não informada: não finge retorno total
        self.assertLessEqual(h['LFTB11']['n'], 70)  # plano gratuito da brapi: só 3 meses de histórico

    def test_preco_sem_ajuste_e_inicio_de_negociacao(self):
        pts = [('2024-10-%02d' % d, 100.0) for d in range(1, 31)] + [('2024-11-%02d' % d, 100.0 + d / 10) for d in range(5, 29)] + [('2024-12-%02d' % d, 103.0 + d / 10) for d in range(1, 29)]
        ctx = {'rede': util.Rede()}
        with mock.patch.object(historico, 'obter', lambda tok, item, ctx_, tb: (list(pts), 'preco', 'Teste')):
            s, _ = historico.montar('LFTB11', {'id': 'LFTB11', 'classe': 'etf_rf', 'inicio': '2024-11-05', 'distribui': None}, ['yahoo'], 'ajustado', 'BRL', ctx, CFG['historico'])
            a, _ = historico.montar('PETR4', {'id': 'PETR4', 'classe': 'acao', 'distribui': True}, ['yahoo'], 'ajustado', 'BRL', ctx, CFG['historico'])
        self.assertGreaterEqual(s['inicio'], '2024-11-05')  # nada antes do início de negociação
        self.assertIn('anteriores ao início', s['motivo'])
        self.assertIsNone(s['retorno_total'])  # distribuição não informada: não finge retorno total
        self.assertFalse(a['retorno_total'])  # ação distribui: preço sem ajuste não é retorno total

    def test_mantem_serie_anterior_quando_fonte_falha(self):
        self.rodar(S.Mundo())
        os.environ['ROBO_AGORA'] = '2026-11-09T21:10:00-03:00'
        self.rodar(S.Mundo(fora={'yahoo', 'b3'}, hoje=dt.date(2026, 11, 9)))
        h = self.ler('historico.json')['series']
        self.assertTrue(h['VT'].get('desatualizada'))
        self.assertIn('mantida a série anterior', h['VT']['motivo'])

    def test_salto_marca_suspeita(self):
        item = {'id': 'X', 'classe': 'acao'}
        pts = [['2026-01-%02d' % (i + 1), 10.0] for i in range(20)] + [['2026-01-21', 5.0]]
        s = historico.checar({'pts': pts, 'tipo': 'preco'}, item, CFG['historico'])
        self.assertEqual(s['qualidade'], 'suspeita')
        self.assertIn('desdobramento', s['motivo'])



class TestNoticias(unittest.TestCase):
    EMP = {'EQTL3': {'termos': ['Equatorial', 'EQTL3'], 'excluir': ['Guiné Equatorial'], 'riscos_tese': ['Juros e endividamento', 'Regulação']},
           'PRIO3': {'termos': ['=PRIO', 'PRIO3', 'PetroRio']}}

    def test_desambiguacao(self):
        self.assertTrue(noticias.pertence('Equatorial conclui aquisição de distribuidora', self.EMP['EQTL3']))
        self.assertFalse(noticias.pertence('Guiné Equatorial anuncia eleições', self.EMP['EQTL3']))
        self.assertTrue(noticias.pertence('PRIO compra fatia de campo', self.EMP['PRIO3']))
        self.assertFalse(noticias.pertence('Governo define prioridade para obras', self.EMP['PRIO3']))

    def test_classificacao(self):
        cfg_n = CFG['noticias']
        a = noticias.classificar({'titulo': 'Equatorial tem lucro de R$ 1 bi no 3T26 e eleva dívida', 'fonte': 'Valor Econômico', 'tema': 'EQTL3'}, cfg_n, self.EMP)['classe']
        self.assertEqual(a['impacto'], 'empresa')
        self.assertIn('resultado', a['categorias'])
        self.assertEqual(a['relevancia'], 'alta')
        b = noticias.classificar({'titulo': '5 ações para comprar em novembro, segundo analistas', 'fonte': 'Blog', 'tema': 'Bolsa'}, cfg_n, self.EMP)['classe']
        self.assertEqual(b['relevancia'], 'baixa')
        self.assertEqual(b['natureza'], 'ruido')
        c = noticias.classificar({'titulo': 'Ação da Equatorial sobe 3% no pregão', 'fonte': 'Site', 'tema': 'EQTL3'}, cfg_n, self.EMP)['classe']
        self.assertIn('Só descreve o movimento', c['porque'])
        d = noticias.classificar({'titulo': 'Equatorial participa de evento', 'fonte': 'Site', 'tema': 'EQTL3'}, cfg_n, self.EMP)['classe']
        self.assertIn('informação insuficiente', d['porque'])
        e = noticias.classificar({'titulo': 'ANEEL abre consulta sobre revisão tarifária da Equatorial', 'fonte': 'Agência Brasil', 'tema': 'EQTL3'}, cfg_n, self.EMP)['classe']
        self.assertIn('regulatorio', e['categorias'])
        self.assertTrue(e['tese'])  # toca no risco "Regulação" da tese

    def test_deduplicacao(self):
        itens = [{'titulo': 'Copom mantém Selic em 13,75% ao ano', 'fonte': 'A', 'classe': {'pontos': 3}},
                 {'titulo': 'Copom mantém a Selic em 13,75% ao ano, diz BC', 'fonte': 'B', 'classe': {'pontos': 5}},
                 {'titulo': 'Petrobras anuncia dividendos', 'fonte': 'C', 'classe': {'pontos': 4}}]
        out = noticias.deduplicar(itens)
        self.assertEqual(len(out), 2)
        principal = [x for x in out if 'Copom' in x['titulo']][0]
        self.assertEqual(principal['fonte'], 'B')
        self.assertEqual(principal['tambem_em'], ['A'])


class TestNoticiasNaRodada(Base):
    def test_fontes_oficiais_e_filtros(self):
        cvm = [['03.220.438/0001-73', 'EQUATORIAL S.A.', '1', '2026-11-05', 'Fato Relevante', '', '', 'Aquisição de participação', '2026-11-05', '', '1', '1', 'https://cvm.test/1'],
               ['03.220.438/0001-73', 'OUTRA EMPRESA S.A.', '2', '2026-11-05', 'Fato Relevante', '', '', 'Não é a Equatorial', '2026-11-05', '', '2', '1', 'https://cvm.test/2']]
        man = {'"Equatorial Energia" OR "EQTL3" OR "Equatorial"': [('Equatorial tem lucro recorde no 3T26', 'Valor Econômico'), ('Guiné Equatorial muda governo', 'Portal'),
                                                                   ('Equatorial tem lucro recorde no 3T26, diz empresa', 'Estadão')]}
        snap = self.rodar(S.Mundo(cvm_docs=cvm, manchetes=man), ROBO_MANUAL='1')
        tit = [n['titulo'] for n in snap['noticias']]
        self.assertFalse(any('Guiné' in t for t in tit))
        self.assertEqual(sum('lucro recorde' in t for t in tit), 1)
        self.assertTrue(any(t.startswith('Fato Relevante: Aquisição') for t in tit))
        self.assertFalse(any('Não é a Equatorial' in t for t in tit))  # CNPJ conferido também pelo nome
        self.assertTrue(any('IPCA de outubro' in t for t in tit))
        self.assertFalse(any('Censo agropecuário' in t for t in tit))


class TestRevisao(Base):
    """Defeitos apontados pela revisão independente (07/11/2026)."""

    def test_tesouro_reaproveitado_nao_herda_atualizado(self):
        self.rodar(S.Mundo())
        os.environ['ROBO_AGORA'] = '2026-11-12T11:00:00-03:00'
        snap = self.rodar(S.Mundo(fora={'tesouro'}, hoje=dt.date(2026, 11, 12)))
        pre = snap['fatores']['pre']
        self.assertEqual(pre['status'], 'desatualizado')
        self.assertTrue(pre.get('reaproveitado'))

    def test_config_invalida_nao_renova_dados(self):
        snap0 = self.rodar(S.Mundo())
        ruim = json.loads(json.dumps(CFG)); ruim['agenda']['inicio'] = '99:00'
        caminho = os.path.join(self.tmp, 'ruim.json')
        with open(caminho, 'w', encoding='utf-8') as f:
            json.dump(ruim, f)
        os.environ['ROBO_AGORA'] = '2026-11-10T11:00:00-03:00'
        snap = self.rodar(S.Mundo(hoje=dt.date(2026, 11, 10)), ROBO_CONFIG=caminho)
        self.assertEqual(snap['gerado_em'], snap0['gerado_em'])  # a data da última coleta válida não muda
        self.assertTrue(all(x['status'] != 'atualizado' for x in snap['ativos'].values()))
        self.assertIn('verificado_em', snap)

    def test_resposta_fora_do_formato_nao_derruba_a_rodada(self):
        m = S.Mundo(http={'yahoo': 429})
        orig = m._brapi
        m._brapi = lambda url, hdr, dados: S.Resp('[]') if '/quote/' in url else orig(url, hdr, dados)
        snap = self.rodar(m, BRAPI_TOKEN='tk-brapi')
        self.assertEqual(snap['ativos']['PETR4']['status'], 'indisponivel')
        self.assertIn('formato', snap['ativos']['PETR4']['motivo'])

    def test_rss_link_inseguro_atom_e_sem_data(self):
        atom = ('<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">'
                '<entry><title>Petrobras anuncia dividendos</title><link href="https://ex.test/a"/><published>2026-11-06T10:00:00Z</published></entry>'
                '<entry><title>Klabin compra fábrica</title><link href="javascript:alert(1)"/><updated>2026-11-06T11:00:00-03:00</updated></entry></feed>')
        rss = ('<?xml version="1.0"?><rss><channel><item><title>Prio fala de produção</title><link>https://ex.test/b</link></item></channel></rss>')
        m = S.Mundo()
        m._rss = lambda url, hdr, dados: S.Resp(atom if 'braziljournal' in url else rss)
        snap = self.rodar(m)
        bj = {x['titulo']: x for x in snap['noticias'] if x['fonte'] == 'Brazil Journal'}
        self.assertIn('Petrobras anuncia dividendos', bj)  # Atom lido
        self.assertEqual(bj['Klabin compra fábrica']['link'], '')  # link javascript: descartado
        self.assertFalse([x for x in snap['noticias'] if x['titulo'] == 'Prio fala de produção'])  # sem data: fora

    def test_sabado_nao_repete_fechamento_de_sexta(self):
        c, tz = json.loads(json.dumps(CFG)), util.BRT
        sab = dt.datetime(2026, 11, 7, 9, 30, tzinfo=tz)
        self.assertFalse(config.deve_rodar(sab, c, fechamento_feito='2026-11-06')[0])
        self.assertTrue(config.deve_rodar(sab, c, fechamento_feito='2026-11-05')[0])

    def test_validacao_das_regras_de_fonte(self):
        c = json.loads(json.dumps(CFG)); c['b3_arquivos']['ativo'] = 'false'; c['series_fatores']['SPX']['fontes'] = ['fred:SP500']
        erros = config.validar(c)
        self.assertTrue(any('b3_arquivos' in e for e in erros))
        self.assertTrue(any('fred:SP500' in e for e in erros))


class TestAlphaVantage(Base):
    agora = '2026-11-06T21:10:00-03:00'  # rodada de fechamento

    def test_reserva_dos_etfs_no_fechamento_com_cota(self):
        cfg = json.loads(json.dumps(CFG)); cfg['alphavantage']['limite_dia'] = 5
        caminho = os.path.join(self.tmp, 'cfg.json')
        with open(caminho, 'w', encoding='utf-8') as f:
            json.dump(cfg, f)
        m = S.Mundo(http={'yahoo': 429})
        snap = self.rodar(m, ROBO_CONFIG=caminho, ALPHAVANTAGE_KEY='tk-av')
        etfs = [a['id'] for a in cfg['ativos'] if a['classe'] == 'etf_rf']
        via_av = [t for t in etfs if snap['ativos'][t].get('fonte') == 'Alpha Vantage']
        self.assertEqual(len(via_av), 5)  # nunca passa da cota configurada
        x = snap['ativos'][via_av[0]]
        self.assertEqual(x['tipo_preco'], 'fechamento')
        self.assertEqual(x['status'], 'atualizado')
        resto = [t for t in etfs if t not in via_av]
        self.assertTrue(all(snap['ativos'][t]['status'] == 'indisponivel' and 'cota diária' in snap['ativos'][t]['motivo'] for t in resto))
        self.assertFalse(any('apikey' in json.dumps(snap, ensure_ascii=False) for _ in [0]))  # a chave não vai para os dados
        self.assertNotIn('tk-av', self.log)
        # segunda rodada no mesmo dia: a cota já foi usada, nenhum pedido novo
        m2 = S.Mundo(http={'yahoo': 429})
        self.rodar(m2, ROBO_CONFIG=caminho, ALPHAVANTAGE_KEY='tk-av', ROBO_MANUAL='1')
        self.assertFalse(any('alphavantage' in u for u in m2.chamadas))

    def test_fora_do_fechamento_nao_gasta_cota(self):
        os.environ['ROBO_AGORA'] = '2026-11-06T15:30:00-03:00'
        m = S.Mundo(http={'yahoo': 429})
        snap = self.rodar(m, ALPHAVANTAGE_KEY='tk-av')
        self.assertFalse(any('alphavantage' in u for u in m.chamadas))
        self.assertIn('rodada de fechamento', snap['ativos']['LFTB11']['motivo'])


class TestRSS(Base):
    def test_rss_dos_veiculos(self):
        m = S.Mundo(rss={'braziljournal.com': [('Petrobras aprova novo plano de investimentos', 0), ('Restaurante abre filial em Pinheiros', 0), ('Copom: Selic deve cair em dezembro, dizem economistas', 0), ('Klabin anuncia aquisição', 5)],
                         'news.agrofy.com.br': [('Safra de soja bate recorde', 0)]})
        snap = self.rodar(m)
        nots = snap['noticias']
        bj = [x for x in nots if x['fonte'] == 'Brazil Journal']
        titulos = [x['titulo'] for x in bj]
        self.assertIn('Petrobras aprova novo plano de investimentos', titulos)
        self.assertEqual([x for x in bj if x['titulo'].startswith('Petrobras')][0]['tema'], 'PETR4')  # ligada à empresa certa
        self.assertNotIn('Restaurante abre filial em Pinheiros', titulos)  # sem empresa e sem relevância: fora
        self.assertNotIn('Klabin anuncia aquisição', titulos)  # mais velha que 2 dias
        self.assertFalse([x for x in nots if x['fonte'] == 'Agrofy News'])  # Agrofy só entra quando cita empresa das carteiras
        self.assertFalse(any('texto completo' in json.dumps(x, ensure_ascii=False) for x in nots))  # nunca guarda o texto


class TestTelegram(Base):
    def test_teste_entregue_e_sem_vazar_token(self):
        m = S.Mundo()
        snap = self.rodar(m, ROBO_MODO='teste_telegram', **SEGREDOS)
        self.assertTrue(any('teste do robô' in x for x in m.enviadas))
        self.assertTrue(snap['fontes']['telegram']['ok'])
        self.assertIn('@robo_teste_bot', snap['fontes']['telegram']['msg'])
        for nome in os.listdir(os.path.join(self.tmp, 'data')):
            with open(os.path.join(self.tmp, 'data', nome), encoding='utf-8') as f:
                self.assertNotIn('segredo-do-bot', f.read(), nome)
        self.assertNotIn('segredo-do-bot', self.log)

    def test_chat_errado_mostra_motivo_e_falha_o_teste(self):
        m = S.Mundo(telegram_chat='456')
        snap = self.rodar(m, ROBO_MODO='teste_telegram', **SEGREDOS)
        msg = snap['fontes']['telegram']['msg']
        self.assertIn('chat not found', msg)
        self.assertIn('TELEGRAM_CHAT_ID', msg)
        self.assertEqual(snap['status']['nivel'], 'critico')
        self.assertNotIn('segredo-do-bot', msg)

    def test_alerta_nao_repete(self):
        m = S.Mundo()
        self.rodar(m, **SEGREDOS)
        n = len(m.enviadas)
        os.environ['ROBO_AGORA'] = '2026-11-06T16:00:00-03:00'
        self.rodar(m, **SEGREDOS)
        self.assertEqual(len(m.enviadas), n)
        self.assertGreater(n, 0)


class TestConfig(Base):
    def test_config_invalida_e_critica_sem_apagar_dados(self):
        self.rodar(S.Mundo())
        ruim = json.loads(json.dumps(CFG))
        ruim['ativos'][0]['classe'] = 'cripto-moeda'
        ruim['ativos'].append(dict(ruim['ativos'][1]))
        ruim['agenda']['inicio'] = '25:00'
        caminho = os.path.join(self.tmp, 'config.json')
        with open(caminho, 'w', encoding='utf-8') as f:
            json.dump(ruim, f)
        m0 = S.Mundo()
        snap = self.rodar(m0, ROBO_CONFIG=caminho, **SEGREDOS)
        self.assertTrue(any('configuração' in x for x in m0.enviadas))  # avisa no Telegram
        self.assertEqual(snap['status']['nivel'], 'critico')
        self.assertTrue(any('classe' in e for e in snap['erros_config']))
        self.assertTrue(any('repetido' in e for e in snap['erros_config']))
        self.assertTrue(any('HH:MM' in e for e in snap['erros_config']))
        self.assertIn('PETR4', snap['ativos'])  # dados anteriores preservados
        m = S.Mundo()
        self.rodar(m, ROBO_CONFIG=caminho, **SEGREDOS)  # segunda rodada no mesmo dia: não repete o aviso
        self.assertFalse(m.enviadas)

    @unittest.skipIf(os.environ.get('ROBO_PORTAO'), 'na rodada automática, a própria coleta trata configuração inválida')
    def test_config_do_repositorio_valida(self):
        self.assertEqual(config.validar(config.carregar(CONFIG_REAL)), [])

    def test_config_atual_valida_e_migracao(self):
        self.assertEqual(config.validar(CFG), [])
        antigo = {'ativos_b3': [{'id': 'PETR4', 'yahoo': 'PETR4.SA', 'nome': 'Petrobras', 'classe': 'acao', 'busca': '"Petrobras"'}],
                  'ativos_eua': [{'id': 'IBIT', 'yahoo': 'IBIT', 'nome': 'IBIT', 'classe': 'cripto'}]}
        novo = config.migrar(antigo)
        self.assertEqual([a['id'] for a in novo['ativos']], ['PETR4', 'IBIT'])
        self.assertEqual(novo['ativos'][0]['noticias']['busca'], '"Petrobras"')

    def test_agenda(self):
        c = json.loads(json.dumps(CFG))
        tz = util.BRT
        self.assertTrue(config.deve_rodar(dt.datetime(2026, 11, 6, 10, 0, tzinfo=tz), c)[0])
        self.assertFalse(config.deve_rodar(dt.datetime(2026, 11, 6, 7, 30, tzinfo=tz), c)[0])
        self.assertTrue(config.deve_rodar(dt.datetime(2026, 11, 6, 21, 0, tzinfo=tz), c)[0])  # rodada de fechamento
        self.assertTrue(config.deve_rodar(dt.datetime(2026, 11, 6, 22, 40, tzinfo=tz), c, fechamento_feito='2026-11-05')[0])  # GitHub atrasou
        self.assertFalse(config.deve_rodar(dt.datetime(2026, 11, 6, 22, 40, tzinfo=tz), c, fechamento_feito='2026-11-06')[0])  # já feito
        c['agenda']['intervalo_min'] = 60
        self.assertFalse(config.deve_rodar(dt.datetime(2026, 11, 6, 10, 30, tzinfo=tz), c)[0])
        self.assertTrue(config.deve_rodar(dt.datetime(2026, 11, 6, 11, 0, tzinfo=tz), c)[0])
        self.assertTrue(config.deve_rodar(dt.datetime(2026, 11, 8, 3, 0, tzinfo=tz), c, manual=True)[0])


class TestBriefing(Base):
    """Agenda macro, resultados da CVM, notícias de índice dos ETFs e o arquivo de versão para o site."""
    PETRO = '33.000.167/0001-01'

    def dre_petro(self):
        L = S.linha_dre
        return {
            ('ITR', 2026): [
                # 3º trimestre: linha de 3 meses (entra) e acumulada do ano (fica de fora)
                L(self.PETRO, 'PETROLEO BRASILEIRO S.A. PETROBRAS', '2026-09-30', '2026-07-01', '2026-09-30', '3.01', 'Receita de Venda de Bens e/ou Serviços', 120000000),
                L(self.PETRO, 'PETROLEO BRASILEIRO S.A. PETROBRAS', '2026-09-30', '2026-01-01', '2026-09-30', '3.01', 'Receita de Venda de Bens e/ou Serviços', 350000000),
                L(self.PETRO, 'PETROLEO BRASILEIRO S.A. PETROBRAS', '2026-09-30', '2026-07-01', '2026-09-30', '3.05', 'Resultado Antes do Resultado Financeiro e dos Tributos', 40000000),
                L(self.PETRO, 'PETROLEO BRASILEIRO S.A. PETROBRAS', '2026-09-30', '2026-07-01', '2026-09-30', '3.11', 'Lucro/Prejuízo Consolidado do Período', 30000000),
                L(self.PETRO, 'PETROLEO BRASILEIRO S.A. PETROBRAS', '2026-09-30', '2026-07-01', '2026-09-30', '3.11.01', 'Atribuído a Sócios da Empresa Controladora', 29500000),
                # mesmo trimestre do ano anterior (PENÚLTIMO): fica de fora
                L(self.PETRO, 'PETROLEO BRASILEIRO S.A. PETROBRAS', '2026-09-30', '2025-07-01', '2025-09-30', '3.01', 'Receita de Venda de Bens e/ou Serviços', 110000000, ordem='PENÚLTIMO'),
                # 2º trimestre reapresentado: a versão 2 substitui a 1
                L(self.PETRO, 'PETROLEO BRASILEIRO S.A. PETROBRAS', '2026-06-30', '2026-04-01', '2026-06-30', '3.11', 'Lucro/Prejuízo Consolidado do Período', 25000000, versao='1'),
                L(self.PETRO, 'PETROLEO BRASILEIRO S.A. PETROBRAS', '2026-06-30', '2026-04-01', '2026-06-30', '3.11', 'Lucro/Prejuízo Consolidado do Período', 26000000, versao='2'),
                # CNPJ certo com nome de outra empresa: não entra
                L(self.PETRO, 'OUTRA EMPRESA S.A.', '2026-03-31', '2026-01-01', '2026-03-31', '3.01', 'Receita', 1),
            ],
            ('DFP', 2025): [
                L(self.PETRO, 'PETROLEO BRASILEIRO S.A. PETROBRAS', '2025-12-31', '2025-01-01', '2025-12-31', '3.01', 'Receita de Venda de Bens e/ou Serviços', 480000000),
                L(self.PETRO, 'PETROLEO BRASILEIRO S.A. PETROBRAS', '2025-12-31', '2025-01-01', '2025-12-31', '3.11', 'Lucro/Prejuízo Consolidado do Período', 110000000),
            ],
        }

    def test_resultados_da_cvm(self):
        m = S.Mundo(dre=self.dre_petro())
        snap = self.rodar(m, ROBO_MANUAL='1')
        r = self.ler('resultados.json')
        p = r['empresas']['PETR4']
        t3 = [x for x in p['trimestres'] if x['periodo'] == '3T26'][0]
        self.assertEqual(t3['receita'], 120000000 * 1000)  # escala MIL convertida para reais; acumulado do ano fica de fora
        self.assertEqual(t3['lucro'], 30000000 * 1000)
        self.assertEqual(t3['lucro_controladores'], 29500000 * 1000)
        self.assertIn('Antes do Resultado Financeiro', t3['ebit_conta'])
        t2 = [x for x in p['trimestres'] if x['periodo'] == '2T26'][0]
        self.assertEqual(t2['lucro'], 26000000 * 1000)  # versão reapresentada
        self.assertEqual(t2['versao'], 2)
        self.assertFalse(any(x['periodo'] == '1T26' for x in p['trimestres']))  # nome não conferiu
        self.assertEqual(p['anuais'][0]['periodo'], '2025')
        self.assertIn('fundo imobiliário', r['fora']['BTLG11'])
        self.assertIn('BDR', r['fora']['INBR34'])
        self.assertIn('ODbL', r['licenca'])
        self.assertTrue(snap['fontes']['resultados']['ok'] is False)  # ITR 2025 e DFP 2024 não existem no simulador: falha relatada
        self.assertEqual(snap['status']['nivel'] in ('completo', 'parcial'), True)  # resultados nunca derrubam a rodada

    def test_resultados_so_no_fechamento(self):
        m = S.Mundo(dre=self.dre_petro())
        self.rodar(m)  # rodada comum das 15h30
        self.assertFalse(any('/ITR/' in u or '/DFP/' in u for u in m.chamadas))
        self.assertFalse(os.path.exists(os.path.join(self.tmp, 'data', 'resultados.json')))

    def test_agenda_ibge_copom_fed_e_focus(self):
        snap = self.rodar(S.Mundo())
        ag = snap['agenda']
        evs = [x['evento'] for x in ag['itens']]
        self.assertTrue(any('IPCA' in e for e in evs))
        self.assertFalse(any('Censo' in e for e in evs))  # produto fora da lista
        foc = [x for x in ag['itens'] if x['tipo'] == 'focus']
        self.assertTrue(foc and all(x['previsto'] for x in foc))
        self.assertTrue(all(x['data'] >= '2026-11-06' for x in ag['itens']))
        self.assertFalse(any(x['tipo'] in ('copom', 'fomc') for x in ag['itens']))  # próximas reuniões passam de 14 dias
        import agenda
        cal = {'copom': {'fonte': 'BC', 'link': 'https://www.bcb.gov.br/x', 'reunioes': [['2026-12-08', '2026-12-09']]},
               'fomc': {'fonte': 'Fed', 'link': 'https://www.federalreserve.gov/x', 'reunioes': [['2026-12-08', '2026-12-09']]}}
        of = agenda.oficiais(cal, dt.date(2026, 12, 1), 14)
        dec = [x for x in of if x['data'] == '2026-12-09']
        self.assertEqual({x['tipo'] for x in dec}, {'copom', 'fomc'})
        fed = [x for x in dec if x['tipo'] == 'fomc'][0]
        self.assertEqual(fed['hora'], '16:00')  # 14h em Nova York (horário padrão) = 16h em Brasília
        self.assertEqual(agenda.data_ibge('10/11/2026 09:00:00'), ('2026-11-10', '09:00'))
        self.assertEqual(agenda.data_ibge('2026-11-10T00:00:00'), ('2026-11-10', None))
        self.assertEqual(agenda.data_ibge('sem data'), (None, None))

    def test_agenda_falha_do_ibge_nao_derruba(self):
        with mock.patch.object(S.Mundo, '_ibge', side_effect=lambda *a: (_ for _ in ()).throw(S.erro('https://servicodados.ibge.gov.br/api/v3/calendario', 503))):
            snap = self.rodar(S.Mundo())
        self.assertFalse(snap['fontes']['agenda']['ok'])
        self.assertTrue(any(x['tipo'] == 'focus' for x in snap['agenda']['itens']))
        # item sem data válida não entra (nada de data inventada); o IBGE é consultado uma vez por dia
        os.remove(os.path.join(self.tmp, 'data', 'estado.json'))
        snap = self.rodar(S.Mundo(agenda_ibge=[{'titulo': 'IPCA', 'data_inicio': 'data quebrada'}]))
        self.assertEqual([x for x in snap['agenda']['itens'] if x['tipo'] == 'ibge'], [])
        m = S.Mundo()
        self.rodar(m)
        self.assertFalse(any('/calendario' in u for u in m.chamadas))

    def test_noticias_de_indice_dos_etfs(self):
        cfgp = os.path.join(self.tmp, 'cfg.json')
        c = json.loads(json.dumps(CFG))
        c['noticias']['etfs'] = [{'tema': 'Juro real (IMA-B)', 'consulta': '"IMA-B" OR "NTN-B"', 'etfs': ['IMAB11', 'B5P211']}]
        with open(cfgp, 'w', encoding='utf-8') as f:
            json.dump(c, f, ensure_ascii=False)
        m = S.Mundo(manchetes={'"IMA-B" OR "NTN-B"': [('Taxas das NTN-B longas sobem com risco fiscal', 'Valor Econômico')]})
        snap = self.rodar(m, ROBO_CONFIG=cfgp)
        n = [x for x in snap['noticias'] if 'NTN-B longas' in x['titulo']][0]
        self.assertEqual(n['etfs'], ['IMAB11', 'B5P211'])
        self.assertEqual(n['classe']['impacto'], 'indice')
        self.assertIn('não sobre o fundo', n['classe']['porque'])

    def test_etf_nao_contamina_outras_manchetes_nem_empresa(self):
        # revisão independente: a mesma lista era compartilhada e a deduplicação espalhava ETFs; notícia de empresa virava "do índice"
        itens = [{'titulo': 'IMA-B acumula queda no mês com abertura das NTN-B', 'tema': 'Juro real', 'etfs': ['IMAB11'], 'quando': '2026-11-06T10:00'},
                 {'titulo': 'Tesouro IPCA+ paga mais de 7% ao ano', 'tema': 'Juro real', 'etfs': ['IMAB11'], 'quando': '2026-11-06T10:00'},
                 {'titulo': 'IMA-B acumula queda no mês com abertura das NTN-B longas', 'tema': 'Crédito', 'etfs': ['DEBB11'], 'quando': '2026-11-06T10:00'},
                 {'titulo': 'Petrobras emite debêntures de R$ 3 bilhões', 'tema': 'PETR4', 'quando': '2026-11-06T09:00'},
                 {'titulo': 'Petrobras emite debêntures de R$ 3 bilhões hoje', 'tema': 'Crédito', 'etfs': ['DEBB11'], 'quando': '2026-11-06T09:00'}]
        emp = {'PETR4': {'termos': ['Petrobras']}}
        for x in itens:
            noticias.classificar(x, CFG['noticias'], emp)
        out = noticias.deduplicar(itens)
        tes = [x for x in out if x['titulo'].startswith('Tesouro IPCA+')][0]
        self.assertEqual(tes['etfs'], ['IMAB11'])  # não pegou o DEBB11 de outra manchete
        petro = [x for x in out if x['titulo'].startswith('Petrobras')][0]
        self.assertEqual(petro['classe']['impacto'], 'empresa')
        self.assertFalse(petro.get('etfs'))

    def test_resultados_escala_desconhecida_e_falha_parcial(self):
        dres = self.dre_petro()
        dres[('ITR', 2026)] = [r[:7] + ['BILHAO'] + r[8:] for r in dres[('ITR', 2026)]]
        m = S.Mundo(dre=dres)
        snap = self.rodar(m, ROBO_MANUAL='1')
        r = self.ler('resultados.json')
        self.assertFalse(any(x['periodo'].endswith('T26') for x in r['empresas']['PETR4']['trimestres']))  # escala desconhecida: nada publicado
        self.assertTrue(any('escala' in e for e in r['erros']))
        self.assertIsNone(self.ler('estado.json').get('resultados_em'))  # falhou: tenta de novo na próxima rodada de fechamento
        # rodada seguinte com o ITR bom: o anual lido antes continua, e os trimestres entram
        self.rodar(S.Mundo(dre=self.dre_petro()), ROBO_MANUAL='1')
        r2 = self.ler('resultados.json')
        self.assertTrue(any(x['periodo'] == '3T26' for x in r2['empresas']['PETR4']['trimestres']))
        self.assertTrue(r2['empresas']['PETR4']['anuais'])
        # se o ITR do ano falhar depois, o que já estava lido não some
        m3 = S.Mundo(dre={('DFP', 2025): self.dre_petro()[('DFP', 2025)]})
        self.rodar(m3, ROBO_MANUAL='1')
        r3 = self.ler('resultados.json')
        self.assertTrue(any(x['periodo'] == '3T26' for x in r3['empresas']['PETR4']['trimestres']))

    def test_versao_para_o_site(self):
        snap = self.rodar(S.Mundo())
        v = self.ler('versao.json')
        self.assertEqual(v['gerado_em'], snap['gerado_em'])
        self.assertLess(len(json.dumps(v)), 400)

    def test_validacao_dos_blocos_novos(self):
        c = json.loads(json.dumps(CFG))
        c['agenda_macro']['copom']['reunioes'] = [['2026-13-40']]
        c['agenda_macro']['fomc']['link'] = 'http://inseguro'
        c['noticias']['etfs'] = [{'tema': 'x'}]
        c['resultados']['ativo'] = 'true'
        e = ' | '.join(config.validar(c))
        for trecho in ('agenda_macro/copom', 'agenda_macro/fomc', 'notícias/etfs 1', 'resultados'):
            self.assertIn(trecho, e)


class TestDiagnostico(Base):
    def test_diagnostico_por_ativo(self):
        m = S.Mundo(http={'yahoo': 429})
        self.rodar(m, ROBO_MODO='diagnostico')
        dg = self.ler('diagnostico.json')
        lin = [x for x in dg['linhas'] if x['ativo'] == 'LFTB11']
        fontes = [x['fonte'] for x in lin]
        self.assertIn('Yahoo LFTB11.SA', fontes)
        self.assertIn('Yahoo LFTB11', fontes)  # testa com e sem .SA
        b3l = [x for x in dg['linhas'] if x['ativo'] == 'B3'][0]
        self.assertIsNone(b3l['ok'])
        self.assertIn('veda coleta automatizada', b3l['detalhe'])
        self.assertFalse(any('bmfbovespa' in u for u in m.chamadas))
        self.assertTrue(all('limite de requisições' in x['detalhe'] for x in lin if x['fonte'].startswith('Yahoo')))
        with open(self.resumo, encoding='utf-8') as f:
            self.assertIn('Diagnóstico por ativo e fonte', f.read())


class TestRede(unittest.TestCase):
    def test_erros_classificados_e_sem_url(self):
        r = util.Rede()
        r.dormir = lambda s: None
        url = 'https://brapi.dev/api/quote/X?token=SEGREDO'
        with mock.patch.object(urllib.request, 'urlopen', lambda rq, timeout=None: (_ for _ in ()).throw(S.erro(url, 429))):
            with self.assertRaises(util.ErroFonte) as e:
                r.get('brapi', url)
        self.assertEqual(e.exception.tipo, 'limite')
        self.assertNotIn('SEGREDO', str(e.exception))
        self.assertEqual(r.stats['brapi']['tentativas'], 3)  # novas tentativas com espera crescente
        with mock.patch.object(urllib.request, 'urlopen', lambda rq, timeout=None: (_ for _ in ()).throw(S.erro(url, 404))):
            for _ in range(5):
                with self.assertRaises(util.ErroFonte):
                    r.get('Yahoo', url)
        self.assertNotIn('Yahoo', r.pausadas)  # ativo inexistente não pausa a fonte


if __name__ == '__main__':
    unittest.main()
