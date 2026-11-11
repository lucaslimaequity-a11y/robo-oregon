# -*- coding: utf-8 -*-
"""Testes da v4.2: Pautas da semana, do mês e do ano (robo/pautas.py → data/biblioteca/pautas.json) e o painel montado
(ui_v42.js, v4.css). Simulado = manchetes de mentira e um Banco Central de mentira dentro do teste; nada aqui prova o que o
GitHub publica nem o que as fontes oficiais respondem. Rodar na pasta do projeto:  python -m unittest discover -s testes -v"""
import datetime as dt
import json
import os
import sys
import unittest
import urllib.parse
from unittest import mock

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, '..', 'robo'))

import pautas  # noqa: E402
from test_intel import Base, mundo  # noqa: E402
from util import ErroFonte  # noqa: E402

RAIZ = os.path.join(AQUI, '..')
BRT = dt.timezone(dt.timedelta(hours=-3))
AGORA = dt.datetime(2026, 11, 10, 9, 0, tzinfo=BRT)
with open(os.path.join(RAIZ, 'robo', 'config.json'), encoding='utf-8') as _f:
    CFG = json.load(_f)
CART = pautas.carregar_carteiras(CFG)


def item(i, titulo, horas=1.0, **kw):
    t = AGORA - dt.timedelta(hours=horas)
    x = {'id': i, 'titulo': titulo, 'link': 'https://x.teste/' + i, 'organizacao': 'Valor Econômico', 'fonte': 'Valor Econômico', 'categoria': 'veiculo', 'pais': 'Brasil',
         'idioma': 'pt', 'tipo': 'noticia', 'natureza': 'noticia', 'publicado_em': t.isoformat(timespec='minutes'), 'ativos': [], 'temas': [], 'regioes': ['brasil'],
         'prioridade': {'pontos': 20, 'nivel': 'media'}}
    x.update(kw)
    return x


def direto(t, evento=None):
    return {t: {'tipo': 'direto', 'motivo': 'teste', 'evento': evento}}


class RedeBC:
    """Banco Central de mentira: Olinda (Focus). Conta os pedidos."""
    def __init__(self, falhar=False):
        self.pedidos, self.falhar = [], falhar

    def falha(self, fonte, tipo, detalhe=''):
        return ErroFonte(fonte, tipo, detalhe)

    def get_json(self, fonte, url, **kw):
        self.pedidos.append(url)
        if self.falhar:
            raise ErroFonte(fonte, 'rede', 'teste')
        q = urllib.parse.unquote(url)
        if 'Data le' in q:  # primeira divulgação do ano
            return {'value': [{'Indicador': i, 'Data': '2026-01-05', 'DataReferencia': '2026', 'Mediana': m, 'baseCalculo': 0} for i, m in (('IPCA', 4.06), ('Selic', 12.25), ('PIB Total', 1.8), ('Câmbio', 5.5))]
                    + [{'Indicador': 'IPCA', 'Data': '2026-01-09', 'DataReferencia': '2026', 'Mediana': 4.1, 'baseCalculo': 0}]}
        return {'value': [{'Indicador': i, 'Data': d, 'DataReferencia': '2026', 'Mediana': m + (0.1 if d == '2026-11-06' else 0), 'baseCalculo': 0}
                          for d in ('2026-11-06', '2026-10-30') for i, m in (('IPCA', 5.2), ('Selic', 13.5), ('PIB Total', 1.76), ('Câmbio', 5.34))]}

    def get(self, fonte, url, **kw):
        raise ErroFonte(fonte, 'nao_encontrado', 'teste')


class ConteudoFalso:
    def __init__(self):
        self.chamadas = []

    def cvm_ipe(self, rede, f, agora_, desde):
        self.chamadas.append((f['url_coleta'], tuple(f['categorias']), desde))
        return [{'titulo': 'PETR4 — Fato Relevante: Aprovação do plano estratégico', 'link': 'https://www.rad.cvm.gov.br/a', 'publicado_em': '2026-02-27', 'ativos': ['PETR4']},
                {'titulo': 'VALE3 — Fato Relevante: Venda de participação', 'link': 'https://www.rad.cvm.gov.br/b', 'publicado_em': '2026-05-03', 'ativos': ['VALE3']}], 2


class TestSelecao(unittest.TestCase):
    def test_tipos(self):
        self.assertEqual(pautas.tipo(item('a', 'PETR4 — Fato Relevante: x', categoria='oficial_empresa', tipo='fato_relevante'), None), 'fato')
        self.assertEqual(pautas.tipo(item('a', 'PETR4 — Comunicado ao Mercado: x', categoria='oficial_empresa', tipo='documento_oficial'), None), 'cvm')
        self.assertEqual(pautas.tipo(item('a', 'Itaú BBA rebaixa VALE3 para neutro', natureza='opiniao_casa'), None), 'recomendacao')
        self.assertEqual(pautas.tipo(item('a', 'BB Seguridade (BBSE3) agora é venda para o Safra', natureza='opiniao_casa'), None), 'recomendacao')
        self.assertEqual(pautas.tipo(item('a', 'BTG elege Prio como favorita do setor', natureza='opiniao_casa'), None), 'opiniao')
        self.assertEqual(pautas.tipo(item('a', 'Petrobras lucra R$ 30 bi no 3T26'), {'evento': 'resultado'}), 'resultado')
        self.assertEqual(pautas.tipo(item('a', 'Petrobras aprova programa de recompra de ações'), {}), 'evento')
        self.assertEqual(pautas.tipo(item('a', 'Petrobras amplia produção', prioridade={'pontos': 60, 'nivel': 'alta'}), {}), 'noticia')
        self.assertIsNone(pautas.tipo(item('a', 'Petrobras patrocina festival'), {}), 'notícia comum fica só na ficha')

    def test_fora_da_pauta(self):
        ok = lambda x: pautas.utilizavel(x, AGORA)  # noqa: E731
        self.assertFalse(ok(item('a', 'x', organizacao='InfoMoney')), 'Grupo XP nunca vai para material de cliente')
        self.assertFalse(ok(item('a', 'x', aviso_fonte='Grupo XP — não citar em material de cliente')))
        self.assertFalse(ok(item('a', 'x', acervo=True)))
        self.assertFalse(ok(item('a', 'x', agrupado_em='b')))
        self.assertFalse(ok(item('a', 'x', horas=-30)), 'data no futuro')
        self.assertTrue(ok(item('a', 'x')))

    def test_oregon_e_vip_separadas(self):
        its = [item('p1', 'Petrobras lucra R$ 30 bi no 3T26', ativos=['PETR4'], vinculos=direto('PETR4', 'resultado')),
               item('v1', 'Vale lucra US$ 2 bi no 3T26', ativos_vip=['VALE3'], vinculos_vip=direto('VALE3', 'resultado')),
               item('m1', 'Dividendos: Petrobras, Itaúsa, BB Seguridade e Copel pagam esta semana', ativos=['PETR4'], vinculos={'PETR4': {'tipo': 'mencao', 'evento': None}}),
               item('s1', 'Petróleo cai 3% após decisão da Opep', setor_de=['PETR4'], prioridade={'pontos': 30, 'nivel': 'media'})]
        o = pautas.empresas(its, 'oregon', CART['oregon'], pautas.TETO['semana'])
        v = pautas.empresas(its, 'vip', CART['vip'], pautas.TETO['semana'])
        self.assertIn('PETR4', o)
        self.assertNotIn('VALE3', o, 'empresa só da VIP não entra na Oregon')
        self.assertIn('VALE3', v)
        self.assertIn('PETR4', v, 'empresa que está nas duas aparece nas duas')
        self.assertEqual([l[1] for l in o['PETR4']['i']], ['resultado', 'setor'], 'menção numa lista fica de fora; notícia do setor entra como setor')

    def test_mesmo_fato_vira_uma_linha_e_teto(self):
        its = [item('r%d' % k, 'Itaúsa tem lucro de R$ 4,1 bilhões no 3T26, alta de %d%%' % (20 + k), horas=k + 1, ativos=['ITSA4'], vinculos=direto('ITSA4', 'resultado')) for k in range(3)]
        its += [item('d1', 'Itaúsa lucra R$ 4,1 bilhões no 3T26', horas=0.5, ativos=['ITSA4'], vinculos=direto('ITSA4', 'resultado'), via='Bing', confiavel=False)]
        its += [item('o%d' % k, 'Casa %d eleva recomendação de Itaúsa para compra' % k, horas=30 + k * 20, ativos=['ITSA4'], natureza='opiniao_casa', casas=['Casa %d' % k],
                     vinculos=direto('ITSA4', 'recomendacao')) for k in range(6)]
        e = pautas.empresas(its, 'oregon', CART['oregon'], pautas.TETO['semana'])['ITSA4']
        res = [l for l in e['i'] if l[1] == 'resultado']
        self.assertEqual(len(res), 1, 'o mesmo resultado em vários veículos vira uma linha')
        self.assertEqual(res[0][0], 'r0', 'veículo conhecido na frente do pouco conhecido')
        self.assertEqual(res[0][2], 3)
        self.assertEqual(e['n']['recomendacao'], 6)
        self.assertEqual(len([l for l in e['i'] if l[1] == 'recomendacao']), pautas.TETO['semana']['recomendacao'])

    def test_macro_brasil_e_mundo(self):
        its = [item('c1', 'Copom mantém a taxa Selic em 13,75% a.a.', categoria='instituicao', organizacao='Banco Central do Brasil', tipo='documento_oficial', natureza='original', horas=20),
               item('c2', 'Ata do Copom reforça juros altos por mais tempo', macro_br=['juros']),
               item('b1', 'Bolsa caindo vender ou comprar acoes', macro_br=['bolsa'], tipo='blog'),
               item('f1', 'Fed mantém juros e sinaliza corte em dezembro', regioes=['eua'], temas=['juros']),
               item('f2', 'FEDS Note: Gold reserve relocations', regioes=['eua'], temas=['juros'], categoria='instituicao', tipo='research', natureza='original'),
               item('f3', 'BIS appointments to the Consultative Council', regioes=['global'], temas=['geopolitica'], categoria='instituicao', tipo='documento_oficial', natureza='original'),
               item('f4', 'Dólar sobe com fala do Fed e Ibovespa cai', regioes=['brasil', 'eua'], temas=['cambio'])]
        mb = pautas.macro_brasil(its, 4)
        self.assertEqual(mb['juros']['i'][0][0], 'c1', 'decisão oficial do Copom na frente')
        self.assertNotIn('bolsa', mb, 'blog fica de fora')
        mm = pautas.macro_mundo(its, 4)
        ids = [l[0] for v in mm.values() for l in v['i']]
        self.assertEqual(ids, ['f1'], 'estudo e documento administrativo de banco central ficam na Biblioteca; manchete do Brasil fica na macro do Brasil')

    def test_exterior_e_alocacao(self):
        its = [item('e1', 'Treasury yields fall ahead of CPI', regioes=['eua'], temas=['juros'], temas_etf=['Treasuries']),
               item('e2', 'Vitória de Lula muda perspectivas para small caps', regioes=['brasil'], temas=['bolsa'], temas_etf=['Small caps e valor']),
               item('e3', 'Passing the CFP retake: tips', regioes=['eua'], temas=[], temas_etf=['Inflação americana (TIPS)']),
               item('g1', 'Carta mensal de outubro', categoria='gestora_brasil', tipo='carta', organizacao='Gestora A', natureza='original'),
               item('g2', 'Carta do trimestre', categoria='gestora_brasil', tipo='carta', organizacao='Gestora A', natureza='original', horas=5),
               item('r1', 'Tesouro IPCA+ 2035 volta a pagar 7,5%', temas=['juros'], temas_etf=['Juro real (IMA-B e NTN-B)'])]
        ex = pautas.exterior(its, CART['exterior'], 4)
        self.assertEqual(list(ex), ['Treasuries'], 'manchete do Brasil e a que só casou a palavra da busca ficam fora')
        al = pautas.alocacao(its, CART['renda_fixa'], 4)
        self.assertEqual([l[0] for l in al['cartas']['i']], ['g1'], 'uma carta por gestora')
        self.assertEqual([l[0] for l in al['renda_fixa']['i']], ['r1'])


class TestPublicar(unittest.TestCase):
    def setUp(self):
        self.pedidos = []
        self.meses = {'2026-01': [item('o1', 'BTG rebaixa Petrobras (PETR4) para neutro', horas=24 * 300, ativos=['PETR4'], natureza='opiniao_casa', casas=['BTG Pactual'],
                                       vinculos=direto('PETR4', 'recomendacao'))],
                      '2026-11': [item('p1', 'Petrobras lucra R$ 30 bi no 3T26', horas=30, ativos=['PETR4'], vinculos=direto('PETR4', 'resultado')),
                                  item('mb', 'IPCA de outubro desacelera', macro_br=['inflacao'], horas=20)]}

    def carregar(self, m):
        self.pedidos.append(m)
        return [x for x in self.meses.get(m, []) if x['publicado_em'][:7] == m]

    def test_meses_semana_e_ano(self):
        rede, cont = RedeBC(), ConteudoFalso()
        js = pautas.publicar(AGORA, None, self.carregar, lambda: self.meses['2026-11'], CFG, CART, rede=rede, fontes_macro=__import__('fontes_macro'), conteudo=cont,
                             fonte_cvm={'id': 'cvm-ipe', 'url_coleta': 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS/ipe_cia_aberta_{ano}.zip', 'empresas': {}})
        self.assertEqual(sorted(js['meses']), ['2026-%02d' % m for m in range(1, 12)], 'primeira vez: todos os meses do ano')
        self.assertEqual(js['meses']['2026-01']['oregon']['empresas']['PETR4']['i'][0][1], 'recomendacao')
        self.assertTrue(js['meses']['2026-11']['parcial'])
        self.assertIn('PETR4', js['semana']['oregon']['empresas'])
        self.assertEqual(js['semana']['contagem']['oregon']['resultado'], 1)
        self.assertEqual(js['itens']['p1']['o'], 'Valor Econômico')
        a = js['anos']['2026']
        self.assertEqual(a['focus']['IPCA']['inicio'], {'mediana': 4.06, 'data': '2026-01-05'}, 'primeira divulgação do ano')
        self.assertAlmostEqual(a['focus']['IPCA']['agora']['mediana'], 5.3)
        self.assertEqual(a['fatos']['PETR4'][0]['a'], 'Aprovação do plano estratégico')
        self.assertEqual(cont.chamadas[0], ('https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS/ipe_cia_aberta_2026.zip', ('Fato Relevante',), '2026-01-01'))
        self.assertNotIn('indicadores', a, 'o robô não chama o SGS: o painel lê Selic, IPCA, dólar e CDI direto do Banco Central')
        self.assertFalse([u for u in rede.pedidos if 'api.bcb.gov.br' in u])
        # rodada seguinte, no mesmo dia: meses passados guardados, mês corrente refeito, sem rede
        self.pedidos.clear()
        js2 = pautas.publicar(AGORA + dt.timedelta(minutes=15), js, self.carregar, lambda: self.meses['2026-11'], CFG, CART, rede=rede, fontes_macro=__import__('fontes_macro'), conteudo=cont, fonte_cvm={'url_coleta': 'x'})
        self.assertEqual(self.pedidos, ['2026-10', '2026-11'], 'só o mês corrente e, nos 10 primeiros dias, o anterior')
        self.assertEqual(len(cont.chamadas), 1, 'fatos do ano: uma busca por dia')
        self.assertEqual(js2['meses']['2026-01'], js['meses']['2026-01'])
        self.assertIn('o1', js2['itens'], 'o item do mês guardado continua no arquivo')
        self.assertEqual(js2['anos']['2026']['focus'], a['focus'])

    def test_falha_mantem_o_anterior(self):
        js = pautas.publicar(AGORA, None, self.carregar, lambda: [], CFG, CART, rede=RedeBC(), fontes_macro=__import__('fontes_macro'))
        amanha = AGORA + dt.timedelta(days=1)

        def quebra(m):
            raise OSError('disco')
        js2 = pautas.publicar(amanha, js, quebra, lambda: [], CFG, CART, rede=RedeBC(falhar=True), fontes_macro=__import__('fontes_macro'))
        self.assertEqual(js2['meses']['2026-11']['oregon'], js['meses']['2026-11']['oregon'], 'mês que não pôde ser lido fica como estava')
        self.assertEqual(js2['anos']['2026']['focus']['IPCA']['inicio'], js['anos']['2026']['focus']['IPCA']['inicio'], 'Focus de janeiro nunca é apagado')
        self.assertEqual(js2['anos']['2026']['focus']['IPCA']['agora'], js['anos']['2026']['focus']['IPCA']['agora'], 'falha mantém o último valor')
        self.assertTrue(js2['anos']['2026']['erros'])

    def test_versoes_das_teses(self):
        js = pautas.publicar(AGORA, None, self.carregar, lambda: [], CFG, CART)
        h0 = js['teses']['oregon']['PETR4']
        self.assertEqual(len(h0), 1)
        self.assertEqual(h0[0]['teto'], CART['dados']['ativos']['PETR4']['teto'])
        js2 = pautas.publicar(AGORA + dt.timedelta(days=3), js, self.carregar, lambda: [], CFG, CART)
        self.assertEqual(len(js2['teses']['oregon']['PETR4']), 1, 'tese igual: nenhuma versão nova')
        cart = dict(CART, dados=json.loads(json.dumps(CART['dados'])))
        cart['dados']['ativos']['PETR4']['teto'] = 51.0
        js3 = pautas.publicar(AGORA + dt.timedelta(days=40), js2, self.carregar, lambda: [], CFG, cart)
        h = js3['teses']['oregon']['PETR4']
        self.assertEqual([v['teto'] for v in h], [CART['dados']['ativos']['PETR4']['teto'], 51.0], 'versão nova guardada, a antiga fica')
        self.assertTrue(js3['teses']['vip']['dividendos'])


class TestRodada(Base):
    def test_rodada_publica_pautas(self):
        m = mundo(feeds={'https://jornal.teste/feed/': [{'titulo': 'Petrobras (PETR4) tem lucro de R$ 30 bilhões no terceiro trimestre', 'link': 'https://jornal.teste/petr', 'dias': 0}]})
        self.rodar(m)
        js = self.ler('biblioteca/pautas.json')
        self.assertEqual(set(js['grupos']), {'oregon', 'vip'})
        self.assertIn('semana', js)
        self.assertIn('pautas:', self.log)

    def test_falha_nao_derruba(self):
        with mock.patch.object(pautas, 'publicar', side_effect=RuntimeError('x')):
            self.rodar(mundo())
        self.assertIn('pautas não publicadas', self.log)


class TestPainel(unittest.TestCase):
    def ler(self, *p):
        with open(os.path.join(RAIZ, *p), encoding='utf-8') as f:
            return f.read()

    def test_build_e_site(self):
        self.assertIn("'ui_v4.js', 'ui_v401.js', 'ui_v41.js', 'ui_v42.js', 'main.js'", self.ler('painel', 'build.py'))
        html = self.ler('site', 'index.html')
        for t in ('v4-pt-', 'Pautas', 'O que o mercado esperava em janeiro', 'biblioteca/pautas.json', 'Copiar pauta'):
            self.assertIn(t, html)

    def test_menu_e_endereco(self):
        js = self.ler('painel', 'src', 'ui_v42.js')
        self.assertIn("A.AREAS.splice(1, 0, ['pautas', 'Pautas'", js)
        self.assertIn('#(hoje|pautas|brasil', self.ler('painel', 'src', 'main.js'))
        self.assertIn('data-a="pautas"', self.ler('painel', 'src', 'v4.css'))

    def test_pauta_existente_continua(self):
        self.assertIn("['pauta', 'Pauta da semana']", self.ler('painel', 'src', 'ui_oregon.js'))
        self.assertIn("['pauta', 'Pauta da semana']", self.ler('painel', 'src', 'ui_vip.js'))


if __name__ == '__main__':
    unittest.main()
