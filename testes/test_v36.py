# -*- coding: utf-8 -*-
"""Testes da v3.6 (acréscimos aprovados em 08/11/2026). Simulado = rede e arquivos de mentira dentro do teste; os formatos
seguem o que foi conferido nas fontes oficiais (B3, CVM). Nada aqui prova que o GitHub alcança os sites.
Rodar na pasta do projeto:  python -m unittest discover -s testes -v"""
import datetime as dt
import io
import json
import os
import shutil
import sys
import tempfile
import unittest
import zipfile
import zlib
from unittest import mock

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, '..', 'robo'))

import analise  # noqa: E402
import biblioteca  # noqa: E402
import cartas  # noqa: E402
import conteudo  # noqa: E402
import estante  # noqa: E402
import fundos  # noqa: E402
import intel  # noqa: E402
import pdftexto  # noqa: E402
import proventos  # noqa: E402
import util  # noqa: E402

HOJE = dt.date(2026, 11, 8)
AGORA = dt.datetime(2026, 11, 8, 22, 0, tzinfo=util.BRT)


def cfg_real():
    with open(os.path.join(AQUI, '..', 'robo', 'config.json'), encoding='utf-8') as f:
        return json.load(f)


def pdf_simples(texto, cid=False):
    """PDF de uma página. cid=True: fonte com códigos de 2 bytes e mapa ToUnicode (como o Word e o LibreOffice fazem)."""
    objs = []
    if cid:
        chars = sorted(set(texto))
        cod = {c: i + 1 for i, c in enumerate(chars)}
        hexs = ''.join('%04X' % cod[c] for c in texto)
        conteudo_pg = ('BT /F1 11 Tf 72 720 Td <%s> Tj ET' % hexs).encode()
        cmap = ('/CIDInit /ProcSet findresource begin 12 dict begin begincmap 1 begincodespacerange <0000> <FFFF> endcodespacerange %d beginbfchar\n' % len(chars)
                + '\n'.join('<%04X> <%04X>' % (cod[c], ord(c)) for c in chars) + '\nendbfchar endcmap end end').encode()
    else:
        conteudo_pg = ('BT /F1 11 Tf 72 720 Td (%s) Tj ET' % texto.replace('(', '\\(').replace(')', '\\)')).encode('latin-1')
    z = zlib.compress(conteudo_pg)
    objs.append(b'<< /Type /Catalog /Pages 2 0 R >>')
    objs.append(b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
    objs.append(b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>')
    objs.append(b'<< /Length %d /Filter /FlateDecode >>\nstream\n' % len(z) + z + b'\nendstream')
    if cid:
        objs.append(b'<< /Type /Font /Subtype /Type0 /BaseFont /ABC+Calibri /Encoding /Identity-H /ToUnicode 6 0 R >>')
        objs.append(b'<< /Length %d >>\nstream\n' % len(cmap) + cmap + b'\nendstream')
    else:
        objs.append(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
    out = b'%PDF-1.4\n'
    for i, o in enumerate(objs, 1):
        out += b'%d 0 obj\n' % i + o + b'\nendobj\n'
    return out + b'trailer << /Root 1 0 R >>\n%%EOF'


class TestPdfTexto(unittest.TestCase):
    def test_literal_e_cid(self):
        t = 'Aumentamos ITSA4 e Equatorial; reduzimos Petrobras (PETR4).'
        self.assertIn('ITSA4', pdftexto.texto(pdf_simples(t)))
        u = 'Itaúsa (ITSA4), Sabesp e Rede D’Or no mês.'
        self.assertIn('Itaúsa (ITSA4), Sabesp e Rede D’Or', pdftexto.texto(pdf_simples(u, cid=True)))

    def test_pdf_quebrado_nao_derruba(self):
        self.assertEqual(pdftexto.texto(b'nao e pdf'), '')


class TestCitacoesNasCartas(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.oregon = intel.carregar_oregon(cfg_real())

    def test_codigo_e_nome_somam_na_mesma_empresa(self):
        txt = 'Seguimos com Petrobras (PETR4) e PETR3. Itaúsa segue no portfólio. A Vale do Silício e quanto vale a bolsa. Também WEGE3.'
        c = cartas.citacoes(txt, self.oregon)
        self.assertIn('PETR4', c)
        self.assertNotIn('PETR3', c, 'PETR3 deveria somar em PETR4 (mesma empresa)')
        self.assertIn('ITSA4', c)
        self.assertNotIn('VALE3', c, '"Vale do Silício" e "quanto vale" não são a Vale')
        self.assertIn('WEGE3', c, 'código fora das carteiras também conta')

    def test_mes_da_carta(self):
        self.assertEqual(cartas.mes_da_carta({'publicado_em': '2026-10-05T10:00-03:00', 'data_estimada': False}), '2026-10')
        self.assertEqual(cartas.mes_da_carta({'publicado_em': '2026-11-02T10:00-03:00', 'data_estimada': True, 'referencia': '2026-10'}), '2026-10')

    def test_janela_de_meses_nao_pula_setembro(self):
        # encontrado nos dados reais: a conta por 31 dias pulava setembro (nov, out, ago, jul)
        self.assertEqual(cartas.meses_janela(dt.date(2026, 11, 8), 4), ['2026-08', '2026-09', '2026-10', '2026-11'])
        self.assertEqual(cartas.meses_janela(dt.date(2027, 2, 28), 3), ['2026-12', '2027-01', '2027-02'])

    def test_carta_publicada_como_pagina(self):
        # Dynamo, Kinea e JGP publicam a carta como página, não como PDF (11 de 13 cartas reais de set–nov/2026)
        pag = ('<html><head><script>var PETR4=1</script></head><body><nav>Menu VALE3</nav><article><h1>Carta 130</h1><p>'
               + 'Texto longo da carta. ' * 30 + 'Aumentamos Itaúsa e seguimos com ALOS3 e ALOS3.</p></article>'
               + '<footer>WEGE3</footer></body></html>').encode('utf-8')
        t = cartas.texto_html(pag)
        self.assertIn('ALOS3', t)
        self.assertNotIn('PETR4', t, 'script não é texto da carta')
        self.assertNotIn('VALE3', t, 'menu não é texto da carta')
        self.assertNotIn('WEGE3', t, 'rodapé não é texto da carta')
        c = cartas.citacoes(t, self.oregon)
        self.assertEqual(c.get('ALOS3'), 2)
        self.assertIn('ITSA4', c)
        # página que só traz o botão de baixar: o PDF do mesmo site é usado; PDF de outro site não
        cur = b'<p>Baixe</p><a href="/wp-content/uploads/carta-out.pdf">PDF</a><a href="https://outro.com/x.pdf">x</a>'
        self.assertEqual(cartas.pdf_da_pagina(cur, 'https://www.jgp.com.br/comunicacao/relatorio/'), 'https://www.jgp.com.br/wp-content/uploads/carta-out.pdf')
        self.assertIsNone(cartas.pdf_da_pagina(b'<a href="https://outro.com/x.pdf">x</a>', 'https://www.jgp.com.br/a/'))
        # como a página real da Dynamo e da JGP (out/2026): rodapé com política em PDF; vale o PDF da carta
        real = (b'<header><a href="/wp-content/uploads/Politica-de-Voto.pdf">Pol\xc3\xadtica</a></header><h1>Carta 130 - O T\xc3\xa1cito do Tempo</h1>'
                b'<a href="/wp-content/uploads/2026/10/Carta-Dynamo-130.pdf">Leia aqui</a><footer><a href="/Formulario-de-Referencia.pdf">FR</a></footer>')
        self.assertEqual(cartas.pdf_da_pagina(real, 'https://www.dynamo.com.br/carta-130-o-tacito-do-tempo/', 'Carta 130 – O Tácito do Tempo'),
                         'https://www.dynamo.com.br/wp-content/uploads/2026/10/Carta-Dynamo-130.pdf')
        self.assertIsNone(cartas.pdf_da_pagina(b'<a href="/Regulamento-do-Fundo.pdf">R</a>', 'https://www.jgp.com.br/a/'))



class TestTermometroPonta(unittest.TestCase):
    """Rodada do termômetro com as três formas reais de carta: PDF (Legacy), página curta com o PDF (Dynamo, JGP) e texto
    na própria página (Kinea). Simulado: a rede é de mentira."""
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, True)
        p = mock.patch.dict(os.environ, {'ROBO_DADOS': os.path.join(self.tmp, 'data')})
        p.start()
        self.addCleanup(p.stop)
        os.makedirs(os.path.join(self.tmp, 'data', 'biblioteca'))
        base = {'categoria': 'gestora_brasil', 'data_estimada': False}
        itens = [dict(base, id='a', titulo='202609_Carta Mensal', organizacao='Legacy Capital', publicado_em='2026-09-25T10:00-03:00',
                      link='https://www.legacycapital.com.br/wp-content/uploads/202609_Carta-Mensal.pdf'),
                 dict(base, id='b', titulo='Carta 130 – O Tácito do Tempo', organizacao='Dynamo', publicado_em='2026-10-30T10:00-03:00',
                      link='https://www.dynamo.com.br/carta-130-o-tacito-do-tempo/'),
                 dict(base, id='c', titulo='As Lições de Hemingway', organizacao='Kinea', publicado_em='2026-10-30T10:00-03:00',
                      link='https://www.kinea.com.br/blog/carta-do-gestor-as-licoes-de-hemingway/'),
                 dict(base, id='d', titulo='Live da gestora', organizacao='Kinea', publicado_em='2026-10-20T10:00-03:00',
                      link='https://www.youtube.com/watch?v=abc')]
        for m in ('2026-09', '2026-10'):
            util.gravar('biblioteca/%s.json' % m, {'mes': m, 'itens': [x for x in itens if x['publicado_em'].startswith(m)]})
        self.paginas = {
            itens[0]['link']: pdf_simples('Comentario do mes sobre a economia e os mercados. ' * 6 + 'Seguimos com PETR4 e Itausa.'),
            itens[1]['link']: b'<html><nav>WEGE3</nav><h1>Carta 130</h1><a href="/wp-content/uploads/2026/10/Carta-Dynamo-130.pdf">Leia aqui</a></html>',
            'https://www.dynamo.com.br/wp-content/uploads/2026/10/Carta-Dynamo-130.pdf': pdf_simples('O tempo e o juro composto na carteira de longo prazo. ' * 6 + 'Aumentamos ALOS3. ALOS3 segue barata.'),
            itens[2]['link']: ('<article>' + '<p>Texto da carta do gestor.</p>' * 40 + '<p>Compramos Petrobras.</p></article>').encode('utf-8')}
        self.pedidos = []

    def test_tres_formas_de_carta(self):
        teste = self

        class Rede:
            pausadas = set()

            def get(self, fonte, url, **k):
                teste.pedidos.append(url)
                if url not in teste.paginas:
                    raise util.ErroFonte(fonte, 'http', '404')
                return teste.paginas[url]
        oregon = intel.carregar_oregon(cfg_real())
        est = {}
        r = cartas.atualizar(cfg_real(), oregon, Rede(), None, HOJE, AGORA, est, log_=lambda *a: None)
        self.assertNotIn('https://www.youtube.com/watch?v=abc', self.pedidos, 'vídeo não é aberto')
        lidas = est['cartas_lidas']
        self.assertEqual(lidas['a']['origem'], 'PDF')
        self.assertEqual(lidas['b']['origem'], 'PDF da página')
        self.assertEqual(lidas['b']['mencoes'], {'ALOS3': 2})
        self.assertNotIn('WEGE3', lidas['b']['mencoes'], 'menu da página não conta')
        self.assertEqual(lidas['c']['origem'], 'página')
        self.assertIn('PETR4', lidas['c']['mencoes'])
        self.assertTrue(lidas['d'].get('sem_pdf'))
        meses = {m['mes']: m for m in r['meses']}
        self.assertEqual(sorted(meses), cartas.meses_janela(HOJE, cfg_real()['intel']['cartas_termometro']['meses']))  # v3.7: 6 meses
        out = meses['2026-10']
        self.assertEqual(out['n_lidas'], 2)
        self.assertEqual({e['t'] for e in out['empresas']}, {'ALOS3', 'PETR4'})
        self.assertEqual({e['t'] for e in meses['2026-09']['empresas']}, {'PETR4', 'ITSA4'})
        # segunda rodada sem rede: nada se perde e nada é reaberto
        self.pedidos.clear()
        r2 = cartas.atualizar(cfg_real(), oregon, Rede(), None, HOJE, AGORA, est, log_=lambda *a: None)
        self.assertEqual(self.pedidos, [])
        self.assertEqual({m['mes']: m['n_lidas'] for m in r2['meses']}, {m['mes']: m['n_lidas'] for m in r['meses']})

B3_PETR = [{'tradingName': 'PETROBRAS', 'cashDividends': [
    {'assetIssued': 'BRPETRACNOR9', 'paymentDate': '21/12/2026', 'rate': '0,47156696000', 'relatedTo': 'Anual/2026', 'approvedOn': '06/08/2026', 'isinCode': 'BRPETRACNOR9', 'label': 'DIVIDENDO', 'lastDatePrior': '21/08/2026', 'remarks': ''},
    {'assetIssued': 'BRPETRACNPR6', 'paymentDate': '21/12/2026', 'rate': '0,47156696000', 'relatedTo': 'Anual/2026', 'approvedOn': '06/08/2026', 'isinCode': 'BRPETRACNPR6', 'label': 'DIVIDENDO', 'lastDatePrior': '21/08/2026', 'remarks': ''},
    {'assetIssued': 'BRPETRACNPR6', 'paymentDate': '23/11/2026', 'rate': '0,67407131000', 'relatedTo': 'Anual/2026', 'approvedOn': '06/08/2026', 'isinCode': 'BRPETRACNPR6', 'label': 'JRS CAP PROPRIO', 'lastDatePrior': '21/08/2026', 'remarks': ''},
    {'assetIssued': 'BRPETRACNPR6', 'paymentDate': '20/02/2027', 'rate': '0,30000000000', 'relatedTo': '3º Trimestre/2026', 'approvedOn': '06/11/2026', 'isinCode': 'BRPETRACNPR6', 'label': 'DIVIDENDO', 'lastDatePrior': '19/11/2026', 'remarks': ''},
    {'assetIssued': 'BRPETRACNPR6', 'paymentDate': '20/02/2026', 'rate': '0,50000000000', 'relatedTo': '3º Trimestre/2025', 'approvedOn': '06/11/2025', 'isinCode': 'BRPETRACNPR6', 'label': 'DIVIDENDO', 'lastDatePrior': '19/11/2025', 'remarks': ''}],
    'stockDividends': [], 'subscriptions': []}]


class RedeJSON:
    def __init__(self, por_url):
        self.por_url, self.chamadas = por_url, []

    def get_json(self, fonte, url, **kw):
        self.chamadas.append(url)
        if url in self.por_url:
            return self.por_url[url]
        raise util.ErroFonte(fonte, 'nao_encontrado', '404')

    def get(self, fonte, url, **kw):
        self.chamadas.append(url)
        v = self.por_url.get(url)
        if v is None:
            raise util.ErroFonte(fonte, 'nao_encontrado', '404')
        return v


class TestProventos(unittest.TestCase):
    def test_classe_pelo_isin_e_soma_do_ano(self):
        ev = proventos.eventos(B3_PETR, 'PETR4')
        self.assertEqual(len(ev), 4, 'PETR4 lê só os ISIN de PN')
        self.assertTrue(all('ACNPR' in e['isin'] for e in ev))
        jcp = [e for e in ev if e['tipo'] == 'JCP'][0]
        self.assertEqual((jcp['data_com'], jcp['pagamento'], jcp['valor']), ('2026-08-21', '2026-11-23', 0.67407131))
        r = proventos.resumo(ev, HOJE)
        self.assertAlmostEqual(r['total_ano'], 0.47156696 + 0.67407131 + 0.30, places=6)
        self.assertEqual(r['n_ano'], 3, 'data-com de 2025 não entra no ano')
        self.assertEqual(r['proxima_data_com'], '2026-11-19')
        self.assertEqual(len(proventos.eventos(B3_PETR, 'PETR3')), 1)
        self.assertTrue(proventos.da_classe('ENGI11', 'BRENGICDAM16') and not proventos.da_classe('ENGI11', 'BRENGIACNOR1'))

    def test_falha_mantem_o_publicado(self):
        cfg = cfg_real()
        cfg['intel']['proventos']['pausa_seg'] = 0
        oregon = {'ativos': {'PETR4': {'classe': 'Ações', 'nome': 'Petrobras', 'pais': 'Brasil'}, 'VALE3': {'classe': 'Ações', 'nome': 'Vale', 'so_vip': True, 'pais': 'Brasil'}}}
        r = RedeJSON({proventos.url_empresa('PETR'): B3_PETR})
        out = proventos.atualizar(cfg, oregon, r, None, HOJE, AGORA, {}, {'ativos': {'VALE3': {'eventos': [{'tipo': 'Dividendo'}], 'resumo': {}}}}, log_=lambda *a: None)
        self.assertIn('PETR4', out['ativos'])
        self.assertIn('VALE3', out['ativos'], 'a falha na Vale não apagou o que já estava publicado')
        self.assertTrue(any('VALE' in e for e in out['erros']))


def zip_de(arquivos):
    b = io.BytesIO()
    with zipfile.ZipFile(b, 'w') as z:
        for n, t in arquivos.items():
            z.writestr(n, t.encode('latin-1'))
    return b.getvalue()


CDA = ('TP_FUNDO_CLASSE;CNPJ_FUNDO_CLASSE;DENOM_SOCIAL;DT_COMPTC;TP_APLIC;TP_ATIVO;CD_ATIVO;VL_MERC_POS_FINAL\n'
       'CLASSES - FIF;11.111.111/0001-11;ALFA FIA;2026-07-31;Ações;Ação ordinária;PETR4;1500000,50\n'
       'CLASSES - FIF;22.222.222/0001-22;BETA FIA;2026-07-31;Ações;Ação preferencial;PETR4;300000\n'
       'CLASSES - FIF;22.222.222/0001-22;BETA FIA;2026-07-31;Ações;Ação ordinária;VALE3;800000\n'
       'CLASSES - FIF;33.333.333/0001-33;GAMA FIM;2026-07-31;Debêntures;Debênture;PETR4;999\n')
REG = {'registro_fundo.csv': 'ID_Registro_Fundo;CNPJ_Fundo;Denominacao_Social;Gestor\n1;11.111.111/0001-11;ALFA FIA;Gestora Alfa\n2;99.999.999/0001-99;BETA FUNDO;Gestora Beta\n',
       'registro_classe.csv': 'ID_Registro_Classe;ID_Registro_Fundo;CNPJ_Classe;Denominacao_Social\n10;2;22.222.222/0001-22;BETA FIA CLASSE\n'}
LISTAGEM = ('<a href="cda_fi_202606.zip">cda_fi_202606.zip</a>  2026-10-01 08:00  25M\n'
            '<a href="cda_fi_202607.zip">cda_fi_202607.zip</a>  2026-11-03 08:00  24M\n'
            '<a href="cda_fi_202608.zip">cda_fi_202608.zip</a>  2026-11-08 08:00  15M\n')


class TestFundos(unittest.TestCase):
    def test_mes_completo_pelo_tamanho(self):
        self.assertEqual(fundos.mes_completo(fundos.meses_na_listagem(LISTAGEM)), '202607')

    def test_leitura_gestoras_e_comparacao(self):
        pos, diag = fundos.ler_cda(zip_de({'cda_fi_BLC_4_202607.csv': CDA}), ['PETR4', 'VALE3'])
        self.assertEqual(diag.get('linhas'), 3, 'a debênture com código parecido fica de fora (TP_APLIC)')
        self.assertAlmostEqual(pos['PETR4']['11111111000111'][1], 1500000.5)
        g = fundos.ler_gestoras(zip_de(REG))
        self.assertEqual(g['11111111000111'], 'Gestora Alfa')
        self.assertEqual(g['22222222000122'], 'Gestora Beta', 'classe ligada ao fundo pelo ID_Registro_Fundo')
        r = fundos.resumo(pos, g, {'PETR4': ['11111111000111', '44444444000144']}, {'PETR4': 'Petrobras'})
        self.assertEqual((r['PETR4']['n_fundos'], r['PETR4']['entraram'], r['PETR4']['sairam']), (2, 1, 1))
        self.assertEqual(r['PETR4']['gestoras'][0]['gestora'], 'Gestora Alfa')

    def test_colunas_desconhecidas_viram_diagnostico(self):
        pos, diag = fundos.ler_cda(zip_de({'cda_fi_BLC_4_202607.csv': 'A;B;C\n1;2;3\n'}), ['PETR4'])
        self.assertEqual(pos, {})
        self.assertIn('colunas esperadas ausentes', diag['erro'])
        self.assertEqual(diag['colunas'], ['A', 'B', 'C'])

    def test_fluxo_completo_e_sem_repetir_o_mes(self):
        r = RedeJSON({fundos.BASE: LISTAGEM.encode(), fundos.BASE + 'cda_fi_202607.zip': zip_de({'cda_fi_BLC_4_202607.csv': CDA}), fundos.REGISTRO: zip_de(REG)})
        est, ore = {}, {'ativos': {'PETR4': {'classe': 'Ações', 'nome': 'Petrobras'}, 'VALE3': {'classe': 'Ações', 'nome': 'Vale', 'so_vip': True}}}
        out = fundos.atualizar(cfg_real(), ore, r, HOJE, AGORA, est, {}, log_=lambda *a: None, dormir=lambda s: None)
        self.assertEqual(out['mes'], '2026-07')
        self.assertEqual(out['ativos']['VALE3']['carteira'], 'vip')
        self.assertIsNone(fundos.atualizar(cfg_real(), ore, r, HOJE + dt.timedelta(days=1), AGORA + dt.timedelta(days=1), est, out, log_=lambda *a: None, dormir=lambda s: None), 'mesmo mês: não baixa de novo')


class TestClassicoDaSemana(unittest.TestCase):
    def test_tema_em_alta_e_estavel_na_semana(self):
        est = {'colecoes': [{'id': 'mauboussin', 'nome': 'Michael Mauboussin'}], 'itens': [
            {'id': 'a', 'col': 'mauboussin', 'titulo': 'Cost of Capital: A Practical Guide', 'link': 'https://x/a', 'temas': ['custo_capital'], 'ano': 2023},
            {'id': 'b', 'col': 'mauboussin', 'titulo': 'Bayes and Base Rates', 'link': 'https://x/b', 'temas': ['decisao'], 'ano': 2026},
            {'id': 'c', 'col': 'compounding-quality', 'titulo': 'Cost of capital explained', 'link': 'https://x/c', 'temas': ['custo_capital'], 'ano': 2025}]}
        st = {}
        d = estante.destaque_semana(est, ['Rising discount rates and the equity risk premium', 'Cost of capital in emerging markets', 'Fed rates'], HOJE, st)
        self.assertEqual(d['tema'], 'custo_capital')
        self.assertEqual(d['item']['id'], 'a', 'newsletter não entra como clássico')
        d2 = estante.destaque_semana(est, [], HOJE, st)
        self.assertEqual(d2['item']['id'], 'a', 'a escolha da semana não muda no meio da semana')


class TestLenteEIndustria(unittest.TestCase):
    def test_buscas_geradas(self):
        fs = intel.fontes_de_busca(cfg_real())
        lentes = [f for f in fs if f.get('lente')]
        self.assertGreaterEqual(len(lentes), 15)
        self.assertTrue(all(f['idioma'] == 'en' and f['intervalo_min'] == 360 for f in lentes))
        self.assertTrue(any(f.get('industria') == 'wealth' and f['idioma'] == 'pt' for f in fs))

    def test_sitemap_de_noticias_com_titulo(self):
        xml = ('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">'
               '<url><loc>https://www.financial-planning.com/news/advisors-move</loc><news:news><news:publication_date>2026-11-06T10:00:00Z</news:publication_date>'
               '<news:title>Advisors move to RIAs &amp; independents</news:title></news:news></url></urlset>')
        r = RedeJSON({'https://fp.teste/s.xml': xml.encode()})
        f = {'id': 'fp', 'nome': 'FP', 'url_coleta': 'https://fp.teste/s.xml', 'padrao': '/news/', 'categoria': 'veiculo', 'maximo': 10}
        out, n = conteudo.sitemap(r, f, AGORA, '2026-01-01')
        self.assertEqual(out[0]['titulo'], 'Advisors move to RIAs & independents')
        self.assertFalse(out[0].get('titulo_provisorio'))
        self.assertEqual(out[0]['publicado_em'][:10], '2026-11-06')

    def test_feed_com_html_cru(self):
        xml = ('<rss><channel><item><title>Kitces: fees &amp; value</title><link>https://feeds.kitces.com/~/1/0/kitcesnerdseyeview~x</link><pubDate>Fri, 06 Nov 2026 10:00:00 GMT</pubDate>'
               '<description>Resumo curto</description><content:encoded><p>html <b>cru & solto</p></content:encoded></item></channel></rss>')
        r = RedeJSON({'https://k.teste/feed': xml.encode()})
        f = {'id': 'k', 'nome': 'K', 'url_coleta': 'https://k.teste/feed', 'categoria': 'veiculo', 'limpar_xml': ['content:encoded']}
        out, n = conteudo.rss(r, f, AGORA, '2026-01-01')
        self.assertEqual(out[0]['titulo'], 'Kitces: fees & value')
