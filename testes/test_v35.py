# -*- coding: utf-8 -*-
"""Testes da v3.5 (só acréscimos aprovados em 08/11/2026). Simulado = rede de mentira dentro do teste; os títulos usados
como exemplo são reais (coletados pelo robô em 08/11). Nada aqui prova que o GitHub alcança os sites.
Rodar na pasta do projeto:  python -m unittest discover -s testes -v"""
import datetime as dt
import io
import json
import os
import re
import shutil
import sys
import tempfile
import unittest
import zipfile
from unittest import mock

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, '..', 'robo'))

import biblioteca  # noqa: E402
import casas  # noqa: E402
import intel  # noqa: E402
import pesquisas  # noqa: E402
import resultados  # noqa: E402
import util  # noqa: E402

HOJE = dt.date(2026, 11, 8)
AGORA = dt.datetime(2026, 11, 8, 14, 0, tzinfo=util.BRT)
FONTES = os.path.join(AQUI, '..', 'robo', 'fontes.json')


def fonte(fid):
    with open(FONTES, encoding='utf-8') as f:
        return [x for x in json.load(f)['fontes'] if x['id'] == fid][0]


class Pasta(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        mock.patch.dict(os.environ, {'ROBO_DADOS': os.path.join(self.tmp, 'data')}).start()
        mock.patch('sys.stdout', io.StringIO()).start()
        os.makedirs(os.path.join(self.tmp, 'data', 'biblioteca'))
        biblioteca.FONTES_BLOQUEADAS, biblioteca.FILTROS_TITULO = [], {}

    def tearDown(self):
        mock.patch.stopall()
        shutil.rmtree(self.tmp)
        biblioteca.FONTES_BLOQUEADAS, biblioteca.FILTROS_TITULO = [], {}


class TestAjustes(Pasta):
    def test_data_futura_aparece_com_a_deteccao(self):
        # CFA Institute publicou com data de edição 18/11 (visto na rodada real de 08/11)
        x = {'titulo': 'Conversations with Frank Fabozzi, CFA', 'publicado_em': '2026-11-18T09:00-03:00', 'detectado_em': '2026-11-08T14:03-03:00'}
        self.assertTrue(biblioteca.corrigir_data_futura(x, HOJE))
        self.assertEqual((x['publicado_em'], x['data_edicao'], x['data_futura']), ('2026-11-08T14:03-03:00', '2026-11-18T09:00-03:00', True))
        y = {'titulo': 'Hoje', 'publicado_em': '2026-11-08T10:00-03:00', 'detectado_em': '2026-11-08T14:03-03:00'}
        self.assertFalse(biblioteca.corrigir_data_futura(y, HOJE))
        z = biblioteca.atualizar_leitura({'titulo': 'Futuro', 'link': 'https://x.teste/a', 'publicado_em': '2026-12-01', 'detectado_em': '2026-11-08T11:00-03:00', 'regras': 0}, None, HOJE)
        self.assertEqual(z['publicado_em'], '2026-12-01')  # sem cadastro (oregon None) não mexe

    def test_empiricus_so_empresa_e_estrategia(self):
        ft = fonte('empiricus-artigos')['filtro_titulo']
        fica = ['Wall Street ainda não chegou a um consenso sobre a inteligência artificial', 'Onde investir no governo Lula 4? Estrategista da Empiricus responde']
        sai = ['Você venderia sua empresa para o Google por US$ 32 bilhões?', 'Mercado em pânico: ainda dá para ganhar dinheiro depois das quedas?',
               'Ibovespa hoje: Governo faz pausa no ajuste fiscal, payroll e resultado das midterms']
        for t in fica:
            self.assertTrue(re.search(ft, t, re.I), t)
        for t in sai:
            self.assertFalse(re.search(ft, t, re.I), t)
        self.assertTrue(fonte('empiricus-artigos').get('descartar_promocional'))

    def test_research_reaplica_filtro_e_tira_promocional(self):
        d = (HOJE - dt.timedelta(days=2)).isoformat() + 'T10:00-03:00'
        itens = [{'id': 'a', 'titulo': 'Ibovespa hoje: Copom mantém a Selic', 'link': 'https://x.teste/a', 'fonte_id': 'empiricus-artigos', 'organizacao': 'Empiricus', 'categoria': 'instituicao', 'publicado_em': d},
                 {'id': 'b', 'titulo': 'Onde investir no governo Lula 4?', 'link': 'https://x.teste/b', 'fonte_id': 'empiricus-artigos', 'organizacao': 'Empiricus', 'categoria': 'instituicao', 'publicado_em': d},
                 {'id': 'c', 'titulo': 'Webinar gratuito: inscreva-se', 'link': 'https://x.teste/c', 'fonte_id': 'g', 'organizacao': 'G', 'categoria': 'gestora_brasil', 'publicado_em': d}]
        biblioteca.gravar_mes('2026-11', itens)
        biblioteca.FILTROS_TITULO = {'empiricus-artigos': fonte('empiricus-artigos')['filtro_titulo']}
        cfg = json.load(open(os.path.join(AQUI, '..', 'robo', 'config.json'), encoding='utf-8'))
        rs = biblioteca.publicar_research(HOJE, AGORA, oregon=intel.carregar_oregon(cfg, os.path.join(AQUI, '..', 'painel', 'src', 'data.json')))
        self.assertEqual([x['id'] for x in rs], ['b'])
        self.assertEqual(len(biblioteca.ler_mes('2026-11')['itens']), 3)  # nada apagado da biblioteca

    def test_pesquisa_etf_pelo_indice_e_sem_cotacao(self):
        self.assertIn('"IMA-B" juro real', pesquisas.consultas('IMAB11', {}, 'real'))
        self.assertIn('"Tesouro Selic" Selic', pesquisas.consultas('LFTB11', {}, 'selic'))
        self.assertFalse(pesquisas.util_resultado('Encontre a cotação do B5P211 hoje e veja a varição do ETF em tempo real'))  # visto em 08/11
        self.assertFalse(pesquisas.util_resultado('O ETF 5PRE11 está listado e é negociado na bolsa de valores B3'))
        self.assertTrue(pesquisas.util_resultado('IMA-B sobe com queda dos juros reais'))


class RedeFalsa:
    def __init__(self, paginas):
        self.paginas, self.chamadas = paginas, []

    def get(self, fonte, url, timeout=20, tentativas=1, **kw):
        self.chamadas.append(url)
        if url in self.paginas:
            return self.paginas[url].encode('utf-8')
        raise util.ErroFonte(fonte, 'nao_encontrado', '404')

    def sem_tempo(self):
        return False


class TestGenialPaginaDaAcao(Pasta):
    """SIMULADO (rede): a página da ação traz só os títulos; o endereço é montado pelo título (com a variante -2 quando
    a Genial repete o título). Trechos de texto copiados das páginas reais de 08/11."""
    def test_monta_endereco_pelo_titulo_e_le_recomendacao(self):
        cfg = json.load(open(os.path.join(AQUI, '..', 'robo', 'config.json'), encoding='utf-8'))
        ore = intel.carregar_oregon(cfg, os.path.join(AQUI, '..', 'painel', 'src', 'data.json'))
        base = casas.GENIAL_BASE + '/acoes/ALOS3/'
        pagina_acao = '<html><body><h3>ALLOS (ALOS3) | Flash: KAML11 Começa Menor para Vender Melhor Depois</h3><p>23/10/2026</p></body></html>'
        rel = ('<html><head><meta property="og:title" content="ALLOS (ALOS3) | Flash: KAML11 Começa Menor para Vender Melhor Depois"></head><body>'
               '<p>Publicado em 23/10/2026 às 16:22:00</p><div>Recomendação</div><div>Compra</div><div>Preço-alvo 12M R$ 39,00</div></body></html>')
        rede = RedeFalsa({base: pagina_acao, base + 'ALLOS-ALOS3--Flash-KAML11-Comeca-Menor-para-Vender-Melhor-Depois-2/': rel})
        cfg_g = {'intel': {'genial': {'max_paginas_por_rodada': 20, 'max_relatorios_por_rodada': 4}}}
        estado = {}
        novos = casas.genial_paginas(cfg_g, ore, rede, None, HOJE, AGORA, estado)
        self.assertEqual(len(novos), 1)
        x = novos[0]
        self.assertTrue(x['link'].endswith('Depois-2/'))
        self.assertEqual((x['publicado_em'], x['natureza'], x['casas'], x['recomendacao'], x['preco_alvo']), ('2026-10-23T16:22-03:00', 'opiniao_casa', ['Genial'], 'Compra', 'R$ 39,00'))
        self.assertEqual(x['ativos'][0], 'ALOS3')
        n = len(rede.chamadas)
        self.assertEqual(casas.genial_paginas(cfg_g, ore, rede, None, HOJE, AGORA + dt.timedelta(days=1), estado), [])  # já visto: não abre de novo
        self.assertFalse(any('Depois' in u for u in rede.chamadas[n:]))
        self.assertIn('/acoes/KLBN11/', ' '.join(rede.chamadas))  # código que a Genial usa para Klabin


class TestAlertas(unittest.TestCase):
    def item(self, **kw):
        x = {'id': kw.pop('id', 'x'), 'titulo': 'T', 'link': 'https://x.teste/t', 'publicado_em': '2026-11-08T12:00-03:00', 'organizacao': 'Org'}
        x.update(kw)
        return x

    def test_so_fato_relevante_e_opiniao_direta_uma_vez(self):
        fato = self.item(id='f', categoria='oficial_empresa', tipo='fato_relevante', titulo='ALOS3 — Fato Relevante: Projeção de dividendos', vinculos={'ALOS3': {'tipo': 'direto'}})
        op = self.item(id='o', natureza='opiniao_casa', casas=['BB Investimentos'], posicao='favoravel', recomendacao='Compra', preco_alvo='R$ 38,00', vinculos={'ALOS3': {'tipo': 'direto'}})
        men = self.item(id='m', natureza='opiniao_casa', casas=['Safra'], vinculos={'KLBN4': {'tipo': 'mencao'}})
        velho = self.item(id='v', categoria='oficial_empresa', tipo='fato_relevante', publicado_em='2026-11-01T10:00-03:00', vinculos={'PETR4': {'tipo': 'direto'}})
        noticia = self.item(id='n', natureza='noticia', vinculos={'ALOS3': {'tipo': 'direto'}})
        al = intel.alertas_imediatos([op, men, velho, noticia, fato], {}, AGORA)
        self.assertEqual([x['id'] for x in al], ['f', 'o'])                       # fato relevante primeiro; menção, antigo e notícia ficam de fora
        self.assertEqual(intel.alertas_imediatos([fato, op], {'alertados': ['f', 'o']}, AGORA), [])
        txt = intel.texto_alertas(al, AGORA)
        self.assertIn('ALOS3 · fato relevante', txt)
        self.assertIn('ALOS3 · opinião de BB Investimentos ▲ · Compra · alvo R$ 38,00', txt)
        self.assertEqual(len(intel.alertas_imediatos([self.item(id=str(i), categoria='oficial_empresa', tipo='fato_relevante', vinculos={'ALOS3': {'tipo': 'direto'}}) for i in range(9)], {}, AGORA)), 5)


class TestDataDeEntregaCVM(unittest.TestCase):
    def zip_itr(self, com_indice=True):
        b = io.BytesIO()
        with zipfile.ZipFile(b, 'w') as z:
            cab = 'CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;GRUPO_DFP;MOEDA;ESCALA_MOEDA;ORDEM_EXERC;DT_INI_EXERC;DT_FIM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA;ST_CONTA_FIXA'
            z.writestr('itr_cia_aberta_DRE_con_2025.csv', cab + '\n12.345.678/0001-90;2025-09-30;2;ALLOS S.A.;1;DF;REAL;MIL;ÚLTIMO;2025-07-01;2025-09-30;3.01;Receita;100;S')
            if com_indice:
                z.writestr('itr_cia_aberta_2025.csv', 'CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;CATEG_DOC;ID_DOC;DT_RECEB;LINK_DOC\n'
                           '12.345.678/0001-90;2025-09-30;1;ALLOS S.A.;1;ITR;1;2025-11-06;x\n12.345.678/0001-90;2025-09-30;2;ALLOS S.A.;1;ITR;2;2025-12-01;x')
        return b.getvalue()

    def test_primeira_entrega_e_mantida(self):
        lido, _ = resultados.ler_dre(self.zip_itr(), {'12345678000190': ('ALOS3', '')}, 'ITR')
        d = resultados.consolidar([lido])
        self.assertEqual(d['ALOS3']['trimestres'][0]['entregue_em'], '2025-11-06')  # a 1ª versão é a data em que o resultado chegou ao mercado
        sem, _ = resultados.ler_dre(self.zip_itr(False), {'12345678000190': ('ALOS3', '')}, 'ITR')
        d2 = resultados.consolidar([sem])
        self.assertNotIn('entregue_em', d2['ALOS3']['trimestres'][0])
        m = resultados.mesclar(d, d2)                                                     # leitura nova sem o índice não apaga a data
        self.assertEqual(m['ALOS3']['trimestres'][0]['entregue_em'], '2025-11-06')


if __name__ == '__main__':
    unittest.main()


# ------------------------------------------------------------------ Estante (acervo permanente) — rede simulada
import analise  # noqa: E402
import conteudo  # noqa: E402
import estante  # noqa: E402

LISTA_MS = '''<html><body><ul>
<li><a href="/im/en-us/financial-advisor/insights/consilient-observer/drawdowns-and-recoveries.html">Drawdowns and Recoveries: Base Rates for Bottoms and Bounces</a> 20 May 2025</li>
<li><a href="/im/en-us/financial-advisor/insights/consilient-observer/to-free-or-not-to-free.html">To Free or Not to Free (Cash Flow)</a> 17 Sep 2026</li>
</ul></body></html>'''
ARTIGO_MS = '''<html><head><meta property="og:title" content="Drawdowns and Recoveries"><meta name="description" content="Base rates for drawdowns and recoveries of stocks.">
<script type="application/ld+json">{"datePublished": "2025-05-21"}</script></head><body>
<a href="/content/dam/im/assets/publication/thought-leadership/consilient-observer/article_drawdownsandrecoveries.pdf">Download PDF</a></body></html>'''
SITEMAP_CFA = '''<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://rpc.cfainstitute.org/research/foundation/2026/exponential-wealth-centuries-stocks-bond-returns</loc><lastmod>2026-11-03T10:00:00+00:00</lastmod></url>
<url><loc>https://rpc.cfainstitute.org/research/foundation/2011/price-to-earnings-ratios-growth-and-discount-rates</loc><lastmod>2023-12-12T11:11:03+00:00</lastmod></url>
<url><loc>https://rpc.cfainstitute.org/research/foundation/2011/price-to-earnings-ratios-growth-and-discount-rates-errata</loc></url>
<url><loc>https://rpc.cfainstitute.org/policy/comment-letters/2026/x</loc></url>
</urlset>'''
LIVRO_CFA = '''<html><head><title>Exponential Wealth: Centuries of Stock and Bond Returns | CFA Institute</title>
<meta property="og:title" content="Exponential Wealth: Centuries of Stock and Bond Returns | CFA Institute"><meta property="article:published_time" content="2026-09-21">
<meta property="og:description" content="How stock and bond markets have built long-term wealth."></head><body>
<a href="/sites/default/files/docs/research-reports/rf_ibbotson_2026_exponentialwealth_monograph_online.pdf">View PDF</a>
<a href="/sites/default/files/docs/support/rf_2026_exponential-wealth_investor-brief_online.pdf">Investor Brief</a></body></html>'''


def cfg_estante():
    with open(os.path.join(AQUI, '..', 'robo', 'config.json'), encoding='utf-8') as f:
        c = json.load(f)
    ec = c['estante']
    ec['colecoes'] = [x for x in ec['colecoes'] if x['id'] in ('mauboussin', 'cfa-rf')]
    ec['colecoes'][0]['ler_item_max'], ec['ler_item_total'] = 100, 200  # no teste, todas as páginas de item numa rodada
    return c


class TestEstante(unittest.TestCase):
    def rede(self):
        return RedeFalsa({
            'https://www.morganstanley.com/im/en-us/financial-advisor/insights/series/consilient-observer.html': LISTA_MS,
            'https://www.morganstanley.com/im/en-us/financial-advisor/insights/consilient-observer/drawdowns-and-recoveries.html': ARTIGO_MS,
            'https://rpc.cfainstitute.org/sitemap.xml?page=1': SITEMAP_CFA,
            'https://rpc.cfainstitute.org/research/foundation/2026/exponential-wealth-centuries-stocks-bond-returns': LIVRO_CFA})

    def test_acervo_semente_listagem_e_pagina_do_item(self):
        cfg, estado, r = cfg_estante(), {}, self.rede()
        est = estante.atualizar(cfg, r, conteudo.Robots(r), HOJE, AGORA, estado, {}, log_=lambda *a: None)
        it = est['itens']
        mb = [x for x in it if x['col'] == 'mauboussin']
        self.assertGreaterEqual(len(mb), 230)  # 177 do índice + 52 outros escritos + 6 de 2026 do Morgan Stanley
        dd = [x for x in mb if x['titulo'].startswith('Drawdowns and Recoveries')]
        self.assertEqual(len(dd), 1, 'a mesma peça (semente e listagem) virou um item só')
        self.assertEqual(dd[0]['link_tipo'], 'original')
        self.assertEqual(dd[0]['data'], '2025-05-21', 'a data da página do artigo vale mais que a da listagem')
        self.assertTrue(any('drawdownsandrecoveries.pdf' in a['url'] for a in dd[0].get('anexos') or []))
        velho = [x for x in mb if x.get('ano') == 1997 and 'Competitive Advantage Period' in x['titulo']][0]
        self.assertEqual(velho['link_tipo'], 'indice_autor')
        self.assertIn('michaelmauboussin.com', velho['link'])
        self.assertIn('criacao_valor', velho['temas'])
        cfa = [x for x in it if x['col'] == 'cfa-rf']
        self.assertEqual(len(cfa), 2, 'errata e cartas de política ficam de fora')
        ew = [x for x in cfa if 'exponential' in x['link']][0]
        self.assertEqual(ew['titulo'], 'Exponential Wealth: Centuries of Stock and Bond Returns')
        self.assertEqual((ew['ano'], ew['data']), (2026, '2026-09-21'))
        self.assertTrue(any(a['rotulo'] == 'Resumo para investidores' for a in ew['anexos']))
        pe = [x for x in cfa if 'price-to-earnings' in x['link']][0]
        self.assertEqual(pe['ano'], 2011)
        self.assertTrue(pe.get('titulo_provisorio'), 'sem ler a página, o título do endereço fica marcado como provisório')
        self.assertIsNone(pe.get('data'), 'lastmod do sitemap não é data de publicação')
        # segunda rodada sem rede: nada é apagado e a coleção fica marcada
        estado['estante']['cfa-rf']['lido_em'] = '2026-10-01T10:00-03:00'
        r2 = RedeFalsa({})
        est2 = estante.atualizar(cfg, r2, conteudo.Robots(r2), HOJE, AGORA, estado, est, log_=lambda *a: None)
        self.assertEqual(len(est2['itens']), len(est['itens']))
        c2 = [c for c in est2['colecoes'] if c['id'] == 'cfa-rf'][0]
        self.assertEqual(c2['status'], 'erro')
        self.assertEqual([x for x in est2['itens'] if x['id'] == dd[0]['id']][0]['link_tipo'], 'original', 'o link da editora não volta a ser o do índice')

    def test_temas_por_palavra_chave(self):
        self.assertIn('custo_capital', estante.temas_de('Cost of Capital: A Practical Guide to Measuring Opportunity Cost'))
        self.assertIn('decisao', estante.temas_de('Bayes and Base Rates: How History Can Guide Our Assessment of the Future'))
        self.assertEqual(estante.chave_titulo('Dispersion & Alpha Conversion'), estante.chave_titulo('Dispersion and Alpha Conversion'))


# ------------------------------------------------------------------ VG VIP: ativos só da VIP ficam à parte da Oregon
class TestVIP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(AQUI, '..', 'robo', 'config.json'), encoding='utf-8') as f:
            cls.cfg = json.load(f)
        cls.oregon = intel.carregar_oregon(cls.cfg)

    def cl(self, titulo):
        return analise.classificar({'titulo': titulo, 'resumo': '', 'categoria': 'veiculo', 'idioma': 'pt', 'pais': 'Brasil', 'publicado_em': '2026-11-08T10:00:00-03:00'}, self.oregon, HOJE)

    def test_universo(self):
        at = self.oregon['ativos']
        self.assertTrue(at['VALE3'].get('so_vip'))
        self.assertIn('dividendos', at['PETR4'].get('carteiras_vip') or [])
        self.assertFalse(at['PETR4'].get('so_vip'))
        self.assertIn('smallcaps', at['INBR34'].get('carteiras_vip') or [], 'INBR32 da VIP usa as notícias de INBR34')

    def test_separacao(self):
        x = self.cl('Vale tem lucro de US$ 2,4 bilhões no terceiro trimestre')
        self.assertEqual(x['ativos'], [])
        self.assertEqual(x.get('ativos_vip'), ['VALE3'])
        self.assertIn('VALE3', x.get('vinculos_vip') or {})
        y = self.cl('Petrobras e Vale anunciam parceria em descarbonização')
        self.assertIn('PETR4', y['ativos'])
        self.assertIn('VALE3', y.get('ativos_vip') or [])
        self.assertNotIn('VALE3', y['vinculos'])

    def test_nomes_ambiguos(self):
        for t in ('Quanto vale a Petrobras depois do resultado?', 'Startups do Vale do Silício captam US$ 2 bi', 'Vale a pena investir em CDB?',
                  'Porto Seguro (BA) recebe festival de verão', 'Jeremy Renner volta às filmagens'):
            x = self.cl(t)
            self.assertFalse(set(x.get('ativos_vip') or []) & {'VALE3', 'PSSA3', 'LREN3'}, t)
