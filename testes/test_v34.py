# -*- coding: utf-8 -*-
"""Testes da v3.4 (Research Command Center).

Dois tipos de prova, ditos em cada classe:
- REAL: usa o arquivo de opiniões conferidas uma a uma na web (robo/sementes/opinioes_12m.json) e trechos copiados das
  páginas reais do InvesTalk e da Genial. Prova que o robô classifica e publica esse conteúdo; não prova que o GitHub
  alcança os sites (isso só a rodada no Actions mostra).
- SIMULADO: rede de mentira dentro do teste. Prova a lógica (limites, robots.txt, idempotência), não a internet.
Rodar na pasta do projeto:  python -m unittest discover -s testes -v"""
import datetime as dt
import io
import json
import os
import shutil
import sys
import tempfile
import unittest
import urllib.error
import urllib.request
from unittest import mock

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, '..', 'robo'))

import analise  # noqa: E402
import biblioteca  # noqa: E402
import casas  # noqa: E402
import conteudo  # noqa: E402
import intel  # noqa: E402
import pesquisas  # noqa: E402
import util  # noqa: E402

CONFIG_REAL = os.path.join(AQUI, '..', 'robo', 'config.json')
DATA_PAINEL = os.path.join(AQUI, '..', 'painel', 'src', 'data.json')
SEMENTES = os.path.join(AQUI, '..', 'robo', 'sementes')
HOJE = dt.date(2026, 11, 8)
AGORA = dt.datetime(2026, 11, 8, 13, 0, tzinfo=util.BRT)
XP_GRUPO = ('infomoney', 'expertxp', 'expert xp', 'xpi.com', 'conteudos.xpi', 'rico.com.vc', 'clear.com.br')

# trechos copiados das páginas reais (08/11/2026); só o que importa para a leitura
INVESTALK_ALOS_3T26 = ('<html><head><title>Allos (ALOS3) 3T26: evolução de receitas impulsionada pelas linhas de mídia e desenvolvimento imobiliário | InvesTalk</title>'
                       '<meta name="description" content="Allos apresentou resultados do 3T26 com evolução de receitas."></head><body>'
                       '<p>Atualizado em 06/11/2026 às 15:09</p><p>Felipe Mesquita</p><p>Mantemos nossa recomendação de Compra e preço alvo de R$ 38,00 para final de 2027.</p></body></html>')
GENIAL_ALOS_3T26 = ('<html><head><meta property="og:title" content="ALLOS (ALOS3) | Resultado 3T26: Imobiliário Puxa o Número, Aluguel Resiliente">'
                    '<meta property="article:published_time" content="2026-11-05T23:58:00-03:00"></head><body><p>Publicado em 05/11/2026 às 23:58:00</p>'
                    '<div>Recomendação</div><div>Compra</div><div>Preço-alvo 12M R$ 39,00</div><div>Potencial 12,7%</div>'
                    '<p>Mantemos Compra e preço-alvo de R$ 37,00.</p></body></html>')


def oregon():
    with open(CONFIG_REAL, encoding='utf-8') as f:
        cfg = json.load(f)
    return intel.carregar_oregon(cfg, DATA_PAINEL)


class RedeFalsa:
    """SIMULADO: devolve o HTML cadastrado para cada endereço; o resto responde 404."""
    def __init__(self, paginas):
        self.paginas, self.chamadas = paginas, []

    def get(self, fonte, url, timeout=20, tentativas=1, **kw):
        self.chamadas.append(url)
        if url in self.paginas:
            return self.paginas[url].encode('utf-8')
        raise util.ErroFonte(fonte, 'nao_encontrado', '404') if hasattr(util, 'ErroFonte') else Exception('404')

    def sem_tempo(self):
        return False


class RobotsFalso:
    def __init__(self, vedados=()):
        self.vedados = vedados

    def permite(self, url):
        return not any(v in url for v in self.vedados)


class Pasta(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        mock.patch.dict(os.environ, {'ROBO_DADOS': os.path.join(self.tmp, 'data')}).start()
        mock.patch('sys.stdout', io.StringIO()).start()                                  # o log do robô não se mistura à saída dos testes
        os.makedirs(os.path.join(self.tmp, 'data', 'biblioteca'))
        biblioteca.FONTES_BLOQUEADAS = []

    def tearDown(self):
        mock.patch.stopall()
        shutil.rmtree(self.tmp)
        biblioteca.FONTES_BLOQUEADAS = []


class TestOpinioesConferidas(Pasta):
    """REAL: 165 opiniões dos últimos 12 meses, cada uma conferida na página original (link, veículo e data)."""

    def test_arquivo_sem_xp_e_dentro_de_12_meses(self):
        with open(os.path.join(SEMENTES, 'opinioes_12m.json'), encoding='utf-8') as f:
            doc = json.load(f)
        itens = doc['itens']
        self.assertGreaterEqual(len(itens), 150)
        for y in itens:
            self.assertFalse(any(k in (y['link'] + ' ' + (y.get('veiculo') or '')).lower() for k in XP_GRUPO), y['link'])
            self.assertTrue('2025-11-08' <= y['publicado_em'][:10] <= '2026-11-08', y['link'])
            self.assertEqual(y.get('verificacao'), 'pagina')
            self.assertIn(y.get('posicao'), (None, 'favoravel', 'contraria', 'neutra', 'mista'))

    def test_casos_alos3_entram_ligados_com_recomendacao_e_alvo(self):
        ore, estado = oregon(), {}
        n = intel.importar_sementes(ore, HOJE, AGORA, estado, pasta=SEMENTES)
        self.assertGreaterEqual(n, 150)
        self.assertEqual(intel.importar_sementes(ore, HOJE, AGORA, estado, pasta=SEMENTES), 0)   # mesma versão do arquivo: não reimporta
        ops = biblioteca.publicar_opinioes(HOJE, AGORA, oregon=ore)
        por_link = {x['link']: x for x in ops}
        casos = {'https://investalk.bb.com.br/noticias/mercado/ALOS_3T26': ('BB Investimentos', 'Compra', 'R$ 38,00'),
                 'https://analisa.genialinvestimentos.com.br/acoes/ALOS3/ALLOS-ALOS3--Resultado-3T26-Imobiliario-Puxa-o-Numero-Aluguel-Resiliente/': ('Genial Investimentos', 'Compra', 'R$ 37,00'),
                 'https://analisa.genialinvestimentos.com.br/acoes/ALOS3/ALLOS-ALOS3--Flash-KAML11-Comeca-Menor-para-Vender-Melhor-Depois-2/': ('Genial Investimentos', 'Compra', 'R$ 39,00')}
        for link, (casa, rec, alvo) in casos.items():
            x = por_link.get(link)
            self.assertIsNotNone(x, link)
            self.assertEqual(x['natureza'], 'opiniao_casa')
            self.assertEqual(x['ativos'][:1], ['ALOS3'])
            self.assertEqual(x['vinculos']['ALOS3']['tipo'], 'direto')
            self.assertIn(casa, x['casas'])
            self.assertEqual((x.get('recomendacao'), x.get('preco_alvo')), (rec, alvo))
        it = por_link['https://investalk.bb.com.br/noticias/mercado/ALOS_3T26']
        self.assertTrue(it.get('data_e_atualizacao'))                                  # a página só mostra "Atualizado em"
        self.assertEqual(it['publicado_em'][:16], '2026-11-06T15:09')

    def test_ticker_da_pesquisa_vira_o_da_carteira(self):
        ore = oregon()
        self.assertEqual([intel.ticker_da_carteira(t, ore) for t in ('KLBN11', 'BBDC4', 'CPLE6', 'ALOS3', 'XYZW3')], ['KLBN4', 'BBDC3', 'CPLE3', 'ALOS3', None])

    def test_reclassificacao_mantem_opiniao_conferida(self):
        ore = oregon()
        x = {'titulo': 'Esta ação pode subir 33% na bolsa e pagar dividendos de 11,5%', 'link': 'https://exemplo.br/a', 'categoria': 'veiculo', 'fonte_id': 'pesquisa-opinioes',
             'ativos': ['ALOS3'], 'opiniao_verificada': {'casas': ['Genial'], 'posicao': 'favoravel'}}
        analise.classificar(x, ore, HOJE)
        self.assertEqual((x['natureza'], x['casas'], x['posicao']), ('opiniao_casa', ['Genial'], 'favoravel'))
        x['regras'] = 0
        y = biblioteca.atualizar_leitura(x, ore, HOJE)                                  # versão futura das regras: continua opinião
        self.assertEqual((y['natureza'], y['posicao']), ('opiniao_casa', 'favoravel'))


class TestPaginasDasCasas(Pasta):
    """REAL (trechos das páginas) + SIMULADO (rede): leitura de recomendação, preço-alvo, horizonte e datas."""

    def test_genial_pagina_da_casa(self):
        ore = oregon()
        f = {'id': 'genial-relatorios-acoes', 'nome': 'Genial Analisa', 'casa': 'Genial', 'categoria': 'instituicao', 'fuso': 'BRT'}
        x = conteudo._novo_item(f, 'ALLOS (ALOS3) | Resultado 3T26: Imobiliário Puxa o Número, Aluguel Resiliente', 'https://analisa.genialinvestimentos.com.br/acoes/ALOS3/x/', None, AGORA)
        x['casa_fonte'] = 'Genial'
        conteudo.ler_pagina_item(None, None, x, f, AGORA, txt=GENIAL_ALOS_3T26)
        self.assertEqual(x['publicado_em'][:16], '2026-11-05T23:58')
        analise.classificar(x, ore, HOJE)
        self.assertNotIn('_texto_casa', x)                                               # o texto da página não é guardado
        self.assertEqual((x['natureza'], x['casas'], x['recomendacao'], x['preco_alvo'], x['horizonte']), ('opiniao_casa', ['Genial'], 'Compra', 'R$ 39,00', '12 meses'))
        self.assertEqual(x['vinculos']['ALOS3']['tipo'], 'direto')

    def test_extracao_so_do_que_esta_escrito(self):
        e = analise.extrair_recomendacao
        self.assertEqual(e('mantemos nossa recomendação de Compra e preço alvo de R$ 38,00 para final de 2027'), {'recomendacao': 'Compra', 'preco_alvo': 'R$ 38,00', 'horizonte': 'fim de 2027'})
        self.assertEqual(e('Mantemos Compra e preço-alvo de R$ 37,00'), {'recomendacao': 'Compra', 'preco_alvo': 'R$ 37,00'})
        self.assertEqual(e('Safra rebaixa Klabin para neutro e corta preço-alvo para R$ 19'), {'recomendacao': 'Neutro', 'preco_alvo': 'R$ 19'})
        self.assertEqual(e('Klabin divulga resultado do 3T26'), {})                    # nada escrito: nada inventado

    def test_investalk_endereco_do_trimestre(self):
        ore, estado = oregon(), {}
        url = casas.BASE + 'ALOS_3T26'
        rede = RedeFalsa({url: INVESTALK_ALOS_3T26})
        cfg = {'intel': {'investalk': {'max_por_rodada': 40}}}
        novos = casas.sondar(cfg, ore, rede, RobotsFalso(), HOJE, AGORA, estado)
        self.assertEqual(len(novos), 1)
        x = novos[0]
        self.assertEqual((x['link'], x['ativos'], x['casas']), (url, ['ALOS3'], ['BB Investimentos']))
        self.assertEqual((x['natureza'], x['recomendacao'], x['preco_alvo'], x['horizonte']), ('opiniao_casa', 'Compra', 'R$ 38,00', 'fim de 2027'))
        self.assertEqual(x['publicado_em'], '2026-11-06T15:09-03:00')
        self.assertTrue(x['data_e_atualizacao'])
        self.assertTrue(estado['investalk']['ALOS_3T26']['achado'])
        # uma grafia por empresa por rodada, e quem já foi achado não é consultado de novo
        self.assertEqual(sum(1 for u in rede.chamadas if '/ALOS' in u), 1)
        n0 = len(rede.chamadas)
        self.assertEqual(casas.sondar(cfg, ore, rede, RobotsFalso(), HOJE, AGORA + dt.timedelta(days=2), estado), [])
        self.assertFalse(any('/ALOS' in u for u in rede.chamadas[n0:]))

    def test_investalk_limites_robots_e_titulo(self):
        ore, estado = oregon(), {}
        rede = RedeFalsa({casas.BASE + 'KLBN_3T26': '<title>Página não encontrada</title>'})
        cfg = {'intel': {'investalk': {'max_por_rodada': 3}}}
        self.assertEqual(casas.sondar(cfg, ore, rede, RobotsFalso(vedados=('PETR',)), HOJE, AGORA, estado), [])
        self.assertLessEqual(len(rede.chamadas), 3)                                       # teto por rodada
        self.assertFalse(any('PETR' in u for u in rede.chamadas))                        # robots.txt respeitado
        # no mesmo dia, o mesmo endereço não é consultado de novo
        antes = set(rede.chamadas)
        casas.sondar(cfg, ore, rede, RobotsFalso(), HOJE, AGORA + dt.timedelta(hours=1), estado)
        self.assertFalse(antes & set(rede.chamadas[len(antes):]))

    def test_trimestre_da_temporada(self):
        self.assertEqual([casas.trimestre(d) for d in (dt.date(2026, 11, 8), dt.date(2027, 1, 15), dt.date(2027, 2, 25))], ['3T26', '3T26', '4T26'])


class TestClassificacaoV34(unittest.TestCase):
    """REAL: manchetes publicadas em 06 e 07/11/2026 que a v3.3 classificava errado."""

    def setUp(self):
        self.ore = oregon()

    def cl(self, titulo, **kw):
        x = dict({'titulo': titulo, 'link': 'https://exemplo.br/' + str(abs(hash(titulo))), 'categoria': 'veiculo', 'fonte_id': 'x'}, **kw)
        analise.classificar(x, self.ore, HOJE)
        return x

    def test_margem_equatorial_nao_e_a_equatorial_energia(self):
        self.assertNotIn('EQTL3', self.cl('Governo debaterá destino de receitas da Margem Equatorial')['ativos'])
        self.assertNotIn('EQTL3', self.cl('Margem Equatorial: estudo relaciona petróleo, energia e Defesa Nacional', fonte_id='busca-eqtl3', ativos=['EQTL3'])['ativos'])
        self.assertIn('EQTL3', self.cl('Equatorial (EQTL3) conclui emissão de debêntures')['ativos'])

    def test_resultado_exige_periodo_ou_valor(self):
        r = analise.VINCULO['resultado']
        import re
        sim = ['Lucro dos bancões cresce no 3T26, mas a conta dos juros chega', 'Lucro de Itaú, Bradesco e Santander soma R$ 22,61 bilhões no terceiro trimestre', 'Klabin tem lucro 20% maior']
        nao = ['Homem de 69 anos tem a conta do Bradesco invadida e sofre prejuízo de R$ 5 mil', 'Copel divulga novo balanço sobre imóveis que ainda estão sem energia em Maringá']
        for t in sim:
            self.assertTrue(re.search(r, util.sem_acento(t).lower()), t)
        for t in nao:
            self.assertFalse(re.search(r, util.sem_acento(t).lower()), t)

    def test_documento_e_newsletter_citando_agencia_nao_viram_opiniao(self):
        x = self.cl('PETR4 — Comunicado ao Mercado: Fitch eleva o Perfil de Crédito Individual da Petrobras', categoria='oficial_empresa', ativos=['PETR4'])
        self.assertNotEqual(x['natureza'], 'opiniao_casa')
        y = self.cl('EcoNews of 2 November 2026', categoria='instituicao', resumo='Fitch affirms ratings; Moody\'s sees risks.')
        self.assertNotEqual(y['natureza'], 'opiniao_casa')
        z = self.cl('Safra rebaixa Klabin (KLBN11) para neutro')                         # na imprensa continua opinião
        self.assertEqual(z['natureza'], 'opiniao_casa')

    def test_falsas_opinioes(self):
        self.assertEqual(analise.casas_citadas({'titulo': 'Itaú, Bradesco e Santander lucram R$ 22 bi no 3T26 e veem fosso aumentar'}), [])
        self.assertEqual(analise.casas_unicas(['Genial', 'Genial Investimentos', 'BTG', 'BTG Pactual']), ['Genial Investimentos', 'BTG Pactual'])


class TestArquivoEPublicacao(Pasta):
    """SIMULADO: biblioteca de teste em pasta temporária."""

    def item(self, i, **kw):
        x = {'id': 'i%d' % i, 'titulo': 'Item %d' % i, 'link': 'https://exemplo.teste/%d' % i, 'fonte_id': 'f', 'fonte': 'F', 'organizacao': 'F', 'categoria': 'gestora_brasil',
             'detectado_em': '2026-11-08T10:00-03:00', 'publicado_em': None}
        x.update(kw)
        return x

    def test_cartas_antigas_sem_data_viram_acervo(self):
        a = intel.antigo_sem_data
        self.assertEqual(a({'titulo': 'Carta K10 junho 2023', 'link': 'https://kapitalo.teste/Carta-K10_junho-2023.pdf'}, HOJE), 'mês de referência 06/2023')
        self.assertIsNotNone(a({'titulo': 'Carta', 'link': 'https://x.teste/c.pdf'}, HOJE, lote_arquivo=True))
        self.assertIsNotNone(a({'titulo': 'Carta', 'link': 'https://x.teste/c.pdf', 'posicao_pagina': 9}, HOJE))
        self.assertIsNone(a({'titulo': 'Carta de outubro 2026', 'link': 'https://x.teste/out26.pdf', 'posicao_pagina': 1}, HOJE))
        # migração: cinco cartas sem data detectadas no mesmo minuto (lote do arquivo da página)
        itens = [self.item(i) for i in range(5)] + [self.item(9, titulo='Carta outubro 2026', detectado_em='2026-11-08T11:00-03:00')]
        biblioteca.gravar_mes('2026-11', itens)
        estado = {}
        self.assertEqual(intel.migrar_acervo_v34(estado, HOJE), 5)
        self.assertEqual(intel.migrar_acervo_v34(estado, HOJE), 0)                     # uma vez só
        guardados = {x['id']: x for x in biblioteca.ler_mes('2026-11')['itens']}
        self.assertEqual(len(guardados), 6)                                              # nada apagado
        self.assertTrue(all(guardados['i%d' % i].get('acervo') for i in range(5)))
        self.assertFalse(guardados['i9'].get('acervo'))

    def test_research_90_dias_e_grupo_xp_bloqueado(self):
        d = lambda n: (HOJE - dt.timedelta(days=n)).isoformat() + 'T10:00-03:00'  # noqa: E731
        itens = [self.item(1, publicado_em=d(3)), self.item(2, publicado_em=d(45)), self.item(3, publicado_em=d(100)), self.item(4),
                 self.item(5, publicado_em=d(2), categoria='veiculo'), self.item(6, publicado_em=d(2), categoria='oficial_empresa')]
        for x in itens:
            biblioteca.gravar_mes(x['publicado_em'][:7] if x['publicado_em'] else '2026-11', [y for y in itens if (y['publicado_em'] or '2026-11')[:7] == (x['publicado_em'] or '2026-11')[:7]])
        rs = biblioteca.publicar_research(HOJE, AGORA, oregon=oregon())
        self.assertEqual(sorted(x['id'] for x in rs), ['i1', 'i2'])                       # 90 dias, com data, só research
        # Grupo XP: nem o histórico gravado antes do bloqueio é publicado
        biblioteca.gravar_mes('2026-11', [self.item(7, publicado_em=d(1), categoria='veiculo', organizacao='InfoMoney', titulo='Bradesco BBI rebaixa B3', natureza='opiniao_casa', casas=['Bradesco BBI']),
                                          self.item(8, publicado_em=d(1), categoria='veiculo', organizacao='Money Times', titulo='XP revela suas 11 ações favoritas para o mês')])
        biblioteca.FONTES_BLOQUEADAS = ['InfoMoney', 'XP Investimentos']
        ops = biblioteca.publicar_opinioes(HOJE, AGORA, oregon=oregon())
        orgs = {x['organizacao'] for x in ops}
        self.assertNotIn('InfoMoney', orgs)
        self.assertIn('Money Times', orgs)                                                # opinião da XP noticiada por outro veículo continua
        rec = biblioteca.publicar_recentes(HOJE, AGORA, oregon=oregon())
        self.assertFalse(any(x['organizacao'] == 'InfoMoney' for x in rec))

    def test_rotulo_generico_vira_titulo_do_endereco(self):
        self.assertTrue(conteudo.ROTULO_GENERICO.match('Read article'))
        self.assertFalse(conteudo.ROTULO_GENERICO.match('Oil Context Weekly (W45)'))
        x = biblioteca.atualizar_leitura(self.item(1, titulo='Read article', link='https://vanguard.teste/insights/article/fed-cuts-and-bond-markets'), oregon(), HOJE)
        self.assertEqual((x['titulo'], x['titulo_provisorio']), ('Fed cuts and bond markets', True))


class TestPesquisasRelacao(Pasta):
    """SIMULADO: feed do Bing Notícias de mentira. Prova a montagem da pesquisa ativo × fator, não o Bing."""

    def test_pesquisa_ativo_fator(self):
        rss = ('<?xml version="1.0"?><rss version="2.0"><channel><title>Bing</title>'
               '<item><title>LFTB11: como a Selic alta afeta o ETF de Tesouro Selic</title><link>https://exemplo.teste/lftb11-selic</link><pubDate>Fri, 06 Nov 2026 12:00:00 GMT</pubDate></item>'
               '<item><title>Selic deve cair em 2027, dizem economistas</title><link>https://exemplo.teste/selic</link><pubDate>Fri, 06 Nov 2026 12:00:00 GMT</pubDate></item>'
               '</channel></rss>')

        def abrir(req, timeout=None):
            url = req.full_url if hasattr(req, 'full_url') else req
            if 'bing.com/news/search' in url:
                return io.BytesIO(rss.encode('utf-8'))
            raise urllib.error.HTTPError(url, 404, 'x', {}, io.BytesIO(b''))
        ore = {'ativos': {'LFTB11': {'nome': 'ETF de Tesouro Selic', 'termos': ['LFTB11'], 'fator': 'selic', 'classe': 'ETFs'}}}
        with mock.patch.object(urllib.request, 'urlopen', abrir), mock.patch.object(util.time, 'sleep', lambda s: None):
            n = pesquisas.atualizar({}, ore, util.Rede(prazo_seg=60), None, HOJE, AGORA)
        self.assertEqual(n, 1)
        par = util.ler(pesquisas.ARQ)['pares']['LFTB11|selic']
        self.assertEqual(par['pergunta'], 'Como a Selic e os juros de curto prazo afetam LFTB11?')   # ETF: pelo código (o painel acrescenta o nome)
        self.assertEqual([y['link'] for y in par['itens']], ['https://exemplo.teste/lftb11-selic'])   # só o que cita o ativo


if __name__ == '__main__':
    unittest.main()
