# -*- coding: utf-8 -*-
"""Testes da v3.7 (robô): trechos literais das cartas e as duas seções novas do briefing do Telegram.
Simulado = rede e arquivos de mentira dentro do teste. Nada aqui prova que o GitHub alcança os sites.
Rodar na pasta do projeto:  python -m unittest discover -s testes -v"""
import datetime as dt
import os
import shutil
import sys
import tempfile
import unittest
from unittest import mock

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, '..', 'robo'))

import analise  # noqa: E402
import cartas  # noqa: E402
import intel  # noqa: E402
import util  # noqa: E402
from test_v36 import AGORA, HOJE, cfg_real, pdf_simples  # noqa: E402

CARTA = ('Comentário do mês sobre a economia e os juros. Seguimos com Petrobras na carteira; a empresa segue gerando caixa. '
         'Também temos PETR3 em outro fundo. A Vale do Silício segue animada e quanto vale a bolsa ninguém sabe. '
         'Aumentamos ALOS3 após o resultado do trimestre. Em ALOS3, a ocupação subiu de novo! A Petrobras pagou dividendos. '
         'Petrobras terceira frase não deve entrar.')


class TestTrechos(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.oregon = intel.carregar_oregon(cfg_real())

    def test_frases_literais_por_empresa(self):
        men = cartas.citacoes(CARTA, self.oregon)
        tr = cartas.trechos(CARTA, self.oregon, men)
        self.assertEqual(set(tr), set(men), 'cada empresa contada tem trecho')
        self.assertEqual(tr['PETR4'][0], 'Seguimos com Petrobras na carteira;')
        self.assertEqual(len(tr['PETR4']), 2, 'no máximo 2 frases por empresa e carta')
        self.assertTrue(any('PETR3' in f for f in tr['PETR4']) or any('Petrobras' in f for f in tr['PETR4']))
        self.assertNotIn('PETR3', tr, 'PETR3 vai para o código que a contagem usou (PETR4)')
        self.assertNotIn('VALE3', tr, '"Vale do Silício" e "quanto vale" não são a Vale')
        self.assertEqual(tr['ALOS3'], ['Aumentamos ALOS3 após o resultado do trimestre.', 'Em ALOS3, a ocupação subiu de novo!'])
        for fs in tr.values():
            for f in fs:
                self.assertEqual(f, ' '.join(f.split()), 'espaços colapsados')
                self.assertIn(f.rstrip('…'), CARTA.replace('\n', ' '), 'frase literal da carta')

    def test_frase_longa_corta_com_a_citacao_dentro(self):
        longa = ('Palavra ' * 80) + 'e por isso compramos ALOS3 nesta janela ' + ('depois ' * 40) + 'fim.'
        tr = cartas.trechos(longa, self.oregon, {'ALOS3': 1})
        f = tr['ALOS3'][0]
        self.assertLessEqual(len(f), cartas.TRECHO_MAX)
        self.assertIn('ALOS3', f)
        self.assertTrue(f.startswith('…') and f.endswith('…'))

    def test_quebra_de_linha_do_pdf_nao_corta_a_frase(self):
        # o leitor de PDF põe \n no fim de cada linha; parágrafo (linha em branco) separa frases
        txt = 'Aumentamos a posição em\nALOS3 depois do resultado.\n\nNovo parágrafo sem empresa.'
        tr = cartas.trechos(txt, self.oregon, {'ALOS3': 1})
        self.assertEqual(tr['ALOS3'], ['Aumentamos a posição em ALOS3 depois do resultado.'])

    def test_sem_mencao_sem_trecho(self):
        self.assertEqual(cartas.trechos('Texto sem empresa nenhuma.', self.oregon, {}), {})


class BaseDados(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, True)
        p = mock.patch.dict(os.environ, {'ROBO_DADOS': os.path.join(self.tmp, 'data')})
        p.start()
        self.addCleanup(p.stop)
        os.makedirs(os.path.join(self.tmp, 'data', 'biblioteca'))


class TestTermometroComTrechos(BaseDados):
    def setUp(self):
        super().setUp()
        base = {'categoria': 'gestora_brasil', 'data_estimada': False}
        self.itens = [dict(base, id='velha', titulo='Carta de outubro', organizacao='Legacy Capital', publicado_em='2026-10-25T10:00-03:00',
                           link='https://www.legacycapital.com.br/wp-content/uploads/202610_Carta.pdf'),
                      dict(base, id='nova', titulo='Carta de novembro', organizacao='Dynamo', publicado_em='2026-11-05T10:00-03:00',
                           link='https://www.dynamo.com.br/wp-content/uploads/2026/11/Carta-131.pdf'),
                      dict(base, id='junho', titulo='Carta de junho', organizacao='Kinea', publicado_em='2026-06-10T10:00-03:00',
                           link='https://www.kinea.com.br/carta-junho.pdf')]
        for m in ('2026-06', '2026-10', '2026-11'):
            util.gravar('biblioteca/%s.json' % m, {'mes': m, 'itens': [x for x in self.itens if x['publicado_em'].startswith(m)]})
        self.paginas = {self.itens[0]['link']: pdf_simples('Comentario do mes sobre os mercados. ' * 6 + 'Seguimos com PETR4 na carteira.'),
                        self.itens[1]['link']: pdf_simples('O tempo e o juro composto na carteira de longo prazo. ' * 6 + 'Compramos ALOS3 no mes.'),
                        self.itens[2]['link']: pdf_simples('Texto de junho sobre a economia brasileira. ' * 6 + 'Gostamos de ALOS3.')}
        self.pedidos = []
        self.cair = set()
        teste = self

        class Rede:
            pausadas = set()

            def get(self, fonte, url, **k):
                teste.pedidos.append(url)
                if url in teste.cair or url not in teste.paginas:
                    raise util.ErroFonte(fonte, 'http', '404')
                return teste.paginas[url]
        self.rede = Rede()
        self.oregon = intel.carregar_oregon(cfg_real())

    def rodar(self, est, maximo=6):
        cfg = cfg_real()
        cfg['intel']['cartas_termometro']['max_por_rodada'] = maximo
        return cartas.atualizar(cfg, self.oregon, self.rede, None, HOJE, AGORA, est, log_=lambda *a: None)

    def test_janela_de_seis_meses_e_trechos_publicados(self):
        self.assertEqual(cfg_real()['intel']['cartas_termometro']['meses'], 6)
        est = {}
        r = self.rodar(est)
        self.assertEqual([m['mes'] for m in r['meses']], ['2026-11', '2026-10', '2026-09', '2026-08', '2026-07', '2026-06'])
        lidas = est['cartas_lidas']
        self.assertEqual(lidas['nova']['v'], 2)
        self.assertEqual(lidas['nova']['trechos'], {'ALOS3': ['Compramos ALOS3 no mes.']})
        self.assertIn('junho', lidas, 'junho entra com a janela de 6 meses')
        nov = next(m for m in r['meses'] if m['mes'] == '2026-11')
        e = nov['empresas'][0]
        self.assertEqual(e['t'], 'ALOS3')
        self.assertEqual(e['trechos'], [{'carta': 'nova', 'gestora': 'Dynamo', 'link': self.itens[1]['link'], 'data': '2026-11-05', 'texto': 'Compramos ALOS3 no mes.'}])

    def test_carta_lida_antes_e_reaberta_uma_vez_depois_das_novas(self):
        # estado como a v3.6 deixou: contagem sem trechos
        est = {'cartas_lidas': {'velha': {'mes': '2026-10', 'mencoes': {'PETR4': 1}, 'caracteres': 300, 'origem': 'PDF', 'em': '2026-10-26T09:00-03:00'},
                                'junho': {'mes': '2026-06', 'mencoes': {}, 'caracteres': 300, 'origem': 'PDF', 'em': '2026-10-26T09:00-03:00'}}}
        self.rodar(est, maximo=1)
        self.assertEqual(self.pedidos, [self.itens[1]['link']], 'com uma vaga, a carta nova vem antes da releitura')
        self.assertNotIn('v', est['cartas_lidas']['velha'])
        self.assertEqual(est['cartas_lidas']['junho']['v'], 2, 'sem empresa citada não há trecho a buscar: não reabre')
        self.pedidos.clear()
        r = self.rodar(est, maximo=6)
        self.assertEqual(self.pedidos, [self.itens[0]['link']])
        velha = est['cartas_lidas']['velha']
        self.assertEqual(velha['v'], 2)
        self.assertEqual(velha['trechos'], {'PETR4': ['Seguimos com PETR4 na carteira.']})
        self.assertEqual(velha['em'], '2026-10-26T09:00-03:00', 'releitura não vira carta nova no Telegram')
        out = next(m for m in r['meses'] if m['mes'] == '2026-10')
        self.assertEqual(out['empresas'][0]['trechos'][0]['texto'], 'Seguimos com PETR4 na carteira.')
        self.pedidos.clear()
        self.rodar(est)
        self.assertEqual(self.pedidos, [], 'reaberta uma vez só')

    def test_releitura_que_falha_nao_apaga_a_contagem(self):
        est = {'cartas_lidas': {'velha': {'mes': '2026-10', 'mencoes': {'PETR4': 1}, 'caracteres': 300, 'origem': 'PDF', 'em': '2026-10-26T09:00-03:00'},
                                'nova': {'mes': '2026-11', 'mencoes': {'ALOS3': 1}, 'trechos': {}, 'v': 2, 'em': '2026-11-05T12:00-03:00'},
                                'junho': {'mes': '2026-06', 'mencoes': {}, 'v': 2, 'em': '2026-10-26T09:00-03:00'}}}
        self.cair.add(self.itens[0]['link'])
        r = self.rodar(est)
        velha = est['cartas_lidas']['velha']
        self.assertEqual(velha['mencoes'], {'PETR4': 1})
        self.assertEqual(velha['v'], 2)
        self.assertEqual(velha['erro_releitura'], 'ErroFonte')
        out = next(m for m in r['meses'] if m['mes'] == '2026-10')
        self.assertEqual(out['n_lidas'], 1)
        self.assertEqual(out['empresas'][0]['trechos'], [])


class TestBriefingTelegram(BaseDados):
    def setUp(self):
        super().setUp()
        self.oregon = intel.carregar_oregon(cfg_real())
        util.gravar('biblioteca/proventos.json', {'ativos': {
            'PETR4': {'eventos': [{'tipo': 'Dividendo', 'valor': 0.47156696, 'data_com': '2026-11-09', 'pagamento': '2026-12-21'},
                                  {'tipo': 'Dividendo', 'valor': 0.47156696, 'data_com': '2026-11-09', 'pagamento': '2026-12-21'},
                                  {'tipo': 'JCP', 'valor': 0.3, 'data_com': '2026-11-20', 'pagamento': '2026-12-30'}]},
            'ZZZZ3': {'eventos': [{'tipo': 'Dividendo', 'valor': 1.0, 'data_com': '2026-11-09', 'pagamento': None}]}}})
        util.gravar('biblioteca/cartas_mencoes.json', {'meses': [{'mes': '2026-11', 'cartas': [
            {'id': 'c130', 'titulo': 'Carta 130 – O Tácito do Tempo', 'gestora': 'Dynamo', 'link': 'https://www.dynamo.com.br/c130.pdf'},
            {'id': 'velha', 'titulo': 'Carta antiga', 'gestora': 'JGP', 'link': 'https://www.jgp.com.br/x.pdf'}]}]})
        self.estado = {'cartas_lidas': {
            'c130': {'mes': '2026-11', 'mencoes': {'PETR4': 1, 'ALOS3': 3, 'WEGE3': 2}, 'em': '2026-11-08T20:00-03:00'},
            'velha': {'mes': '2026-11', 'mencoes': {'PETR4': 1}, 'em': '2026-11-07T08:00-03:00'},
            'sem': {'mes': '2026-11', 'mencoes': {'WEGE3': 1}, 'em': '2026-11-08T21:00-03:00'}}}

    def test_data_com_amanha_e_cartas_novas(self):
        ln = intel.extras_digesto(self.oregon, self.estado, AGORA, HOJE)
        txt = '\n'.join(ln)
        self.assertIn('<b>Data-com amanhã (09/11)</b>', txt)
        self.assertIn('• PETR4 · Dividendo R$ 0,4716 · paga 21/12', txt)
        self.assertEqual(txt.count('PETR4 · Dividendo'), 1, 'o mesmo anúncio aparece uma vez')
        self.assertNotIn('JCP', txt, 'data-com de outro dia fica de fora')
        self.assertNotIn('ZZZZ3', txt, 'empresa fora das carteiras fica de fora')
        self.assertIn('<b>Cartas novas que citam a carteira</b>', txt)
        self.assertIn('• Dynamo · <a href="https://www.dynamo.com.br/c130.pdf">Carta 130 – O Tácito do Tempo</a>: ALOS3, PETR4', txt)
        self.assertNotIn('WEGE3', txt, 'código fora das carteiras não entra no aviso')
        self.assertNotIn('Carta antiga', txt, 'lida há mais de 24 h')

    def test_sem_nada_nao_acrescenta_secao(self):
        self.assertEqual(intel.extras_digesto(self.oregon, {}, AGORA, HOJE + dt.timedelta(days=30)), [])




class TestTipoDeEvento(unittest.TestCase):
    """Manchetes reais do site (08/11/2026) e casos típicos. Só item de empresa recebe evento."""
    def test_manchetes(self):
        casos = {
            'Lucro da Porto Seguro cai 14% e empresa reduz projeção de receita': ['guidance'],
            'Renner retira projeções de receita até 2030 citando consumo fraco e concorrência estrangeira': ['guidance'],
            'Rede D’Or e Fleury negam negociações para fusão, apesar de rumores no mercado': ['fusao'],
            'AXIA3 — Comunicado ao Mercado: 14ª Emissão de Debêntures - AXIA Energia': ['divida'],
            'Itaúsa aprova programa de recompra de até 50 milhões de ações': ['recompra'],
            'Vale anuncia novo CEO': ['gestao'],
            'Petrobras conclui follow-on de R$ 5 bi': ['oferta'],
            # não são evento da empresa
            'Bradesco reduz projeção do PIB de 2027 para 0,4%': [],
            'ALOS3 — Comunicado ao Mercado: Aquisição/Alienação de Participação Acionária (art. 12 da Instr. CVM nº 358)': [],
        }
        for t, esperado in casos.items():
            self.assertEqual(analise.eventos_de(t), esperado, t)

    def test_so_item_de_empresa(self):
        oregon = intel.carregar_oregon(cfg_real())
        x = analise.classificar({'titulo': 'Itaúsa aprova programa de recompra de ações', 'categoria': 'veiculo', 'tipo': 'noticia', 'fonte': 'Teste',
                                 'publicado_em': '2026-11-08T10:00-03:00'}, oregon, HOJE)
        self.assertEqual(x.get('eventos'), ['recompra'])
        y = analise.classificar({'titulo': 'Treasury bonds rally as Fed signals a pause', 'categoria': 'veiculo', 'tipo': 'noticia', 'fonte': 'Teste',
                                 'publicado_em': '2026-11-08T10:00-03:00'}, oregon, HOJE)
        self.assertNotIn('eventos', y, 'sem empresa ligada não há evento')



class TestEstanteSemFila(unittest.TestCase):
    """Rodada real de 08/11: a GMO e o Compounding Quality ficaram sem vez (o orçamento de páginas acabou nas primeiras
    coleções) e a GMO apareceu como "completo" com 0 itens. Agora quem nunca foi lido vai primeiro e só fica "completo"
    depois de lido. Simulado: rede de mentira que falha."""
    def test_quem_nunca_foi_lido_vai_primeiro(self):
        import estante
        cfg = cfg_real()
        x = '2026-11-08T15:57-03:00'
        estado = {'estante': {'mauboussin': {'lido_em': x}, 'cfa-rf': {'lido_em': x, 'lst0_prox': 3}, 'howard-marks': {'lido_em': x}, 'damodaran': {'lido_em': x},
                              'aqr': {'lido_em': x}, 'gmo': {}, 'compounding-quality': {}}}
        ordem_log = []

        class Rede:
            pausadas = set()

            def get(self, fonte, *a, **k):
                raise util.ErroFonte(fonte, 'rede', 'sem rede no teste')
            get_json = get
        tmp = tempfile.mkdtemp(); self.addCleanup(shutil.rmtree, tmp, True)
        with mock.patch.dict(os.environ, {'ROBO_DADOS': tmp}):
            pub = estante.atualizar(cfg, Rede(), None, HOJE, AGORA, estado, {'colecoes': [{'id': 'gmo', 'total': 0, 'status': 'completo'}], 'itens': []},
                                    log_=lambda m: ordem_log.append(m.split()[1].rstrip(':')))
        self.assertLess(ordem_log.index('gmo'), ordem_log.index('cfa-rf'), ordem_log)
        self.assertLess(ordem_log.index('compounding-quality'), ordem_log.index('mauboussin'), ordem_log)
        gmo = [c for c in pub['colecoes'] if c['id'] == 'gmo'][0]
        self.assertNotEqual(gmo['status'], 'completo', 'nunca lida não é "completo"')
        self.assertEqual([c['id'] for c in pub['colecoes']], [c['id'] for c in cfg['estante']['colecoes'] if c.get('ativo') is not False], 'a ordem publicada é a do config')

if __name__ == '__main__':
    unittest.main()
