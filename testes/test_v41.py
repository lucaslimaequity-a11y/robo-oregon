# -*- coding: utf-8 -*-
"""Testes da v4.1: "O que o mercado está falando" (robo/empresas.py → data/biblioteca/empresas.json) e o painel montado
com as melhorias visuais (ui_v41.js, v4.css). Simulado = manchetes de mentira dentro do teste; nada aqui prova o que o
GitHub publica. Rodar na pasta do projeto:  python -m unittest discover -s testes -v"""
import datetime as dt
import json
import os
import sys
import unittest
from unittest import mock

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, '..', 'robo'))

import empresas  # noqa: E402
from test_intel import Base, mundo  # noqa: E402

RAIZ = os.path.join(AQUI, '..')
BRT = dt.timezone(dt.timedelta(hours=-3))
AGORA = dt.datetime(2026, 11, 10, 9, 0, tzinfo=BRT)
with open(os.path.join(RAIZ, 'robo', 'config.json'), encoding='utf-8') as _f:
    CFG = json.load(_f)


def item(titulo, horas=1.0, **kw):
    t = AGORA - dt.timedelta(hours=horas)
    x = {'id': 'e%d' % abs(hash((titulo, horas))), 'titulo': titulo, 'link': 'https://x.teste/%d' % abs(hash((titulo, horas))), 'organizacao': 'Valor Econômico',
         'publicado_em': t.isoformat(timespec='minutes')}
    x.update(kw)
    return x


class TestNomes(unittest.TestCase):
    def test_carteira_usa_os_termos_do_robo(self):
        c = empresas.da_carteira(CFG)
        self.assertIn('PETR4', c)
        self.assertIn('VALE3', c)
        self.assertTrue(c['PETR4']['carteira'])
        self.assertEqual(c['BBDC3']['nome'], 'Bradesco', 'sem o "ON" no nome')
        self.assertNotIn('BTLG11', c, 'fundo imobiliário fica de fora')
        self.assertNotIn('LFTB11', c, 'ETF fica de fora')

    def test_aprende_pelo_codigo_na_manchete(self):
        it = [item('Embraer (EMBJ3) entrega 30 jatos no trimestre'), item('Lucro da Embraer (EMBJ3) sobe 20%', 2), item('CEO da Nvidia (NVDC34) fala de IA', 3),
              item('Mini-índice (WINZ26) abre em alta', 4), item('Santander (SANB11) tem lucro', 5), item('Santander (SANB3) anuncia JCP', 6),
              item('Porto (PSSA3) cresce', 7), item('Vamos (VAMO3) aluga caminhões', 8), item('Brava (BRAV3) produz mais', 9)]
        ap = empresas.aprender(it)
        self.assertEqual(ap['EMBJ3']['Embraer'], 2, '"Lucro da" sai do começo')
        self.assertNotIn('NVDC34', ap, 'BDR de empresa de fora fica de fora')
        self.assertNotIn('WINZ26', ap, 'contrato futuro fica de fora')
        d = empresas.definicoes(CFG, ap)
        self.assertEqual(d['EMBJ3']['termos'], ['=EMBJ3', '=Embraer'])
        self.assertIn('SANB11', d)
        self.assertNotIn('SANB3', d, 'mesma empresa com outro código: uma linha só')
        self.assertIn('=SANB3', d['SANB11']['termos'])
        self.assertEqual(d['BRAV3']['termos'], ['=BRAV3'], '"Brava" é palavra comum: só pelo código')
        self.assertTrue(d['PSSA3']['carteira'], 'Porto Seguro é da carteira VIP: vale a regra da carteira, não o nome aprendido')

    def test_quem_e_citado(self):
        ap = empresas.aprender([item('Embraer (EMBJ3) entrega jatos')])
        d = empresas.definicoes(CFG, ap)
        self.assertEqual(empresas.empresas_de('Embraer fecha contrato com a FAB', d), ['EMBJ3'])
        self.assertEqual(empresas.empresas_de('embraer em minúsculas não conta', d), [])
        self.assertIn('BBDC3', empresas.empresas_de('Bradesco tem lucro de R$ 6 bilhões', d))
        self.assertNotIn('BBDC3', empresas.empresas_de('Reeleição de Lula reforça apetite chinês, diz Bradesco BBI', d), 'a área de análise do banco não é notícia do banco')
        self.assertNotIn('BBAS3', empresas.empresas_de('Centro Cultural Banco do Brasil abre exposição', d), 'exclusão conferida da carteira')
        self.assertIn('VALE3', empresas.empresas_de('Vale (VALE3) tem lucro de US$ 2 bilhões', d))
        self.assertNotIn('VALE3', empresas.empresas_de('Vale a pena investir em CDB?', d))


class TestContagem(unittest.TestCase):
    def test_janelas_e_macro(self):
        base = [item('Petrobras investe no pré-sal', 30 + k * 0.4, macro_br=['juros'] if k % 2 else []) for k in range(400)]  # 400 itens nos 7 dias anteriores
        agora = [item('Petrobras (PETR4) bate recorde', 1 + k * 0.1) for k in range(30)] + [item('Ibovespa sobe', 1, macro_br=['bolsa', 'juros'])] * 5
        d = empresas.definicoes(CFG, empresas.aprender(base + agora))
        js = empresas.calcular(base + agora, AGORA, d)
        j = js['janelas']['24h']
        self.assertEqual(j['total'], 35)
        self.assertEqual(j['empresas']['PETR4']['n'], 30)
        self.assertEqual(j['macro']['bolsa']['n'], 5)
        self.assertEqual(j['macro']['bolsa']['tendencia'], 'novo')
        self.assertEqual(j['macro']['juros']['n'], 5)
        self.assertEqual(js['empresas']['PETR4'], {'nome': 'Petrobras', 'carteira': True})
        self.assertEqual(len(js['ultimos']['PETR4']), empresas.ULTIMOS)
        self.assertEqual(set(js['janelas']), {'24h', '7d', '30d'})

    def test_publicar_e_historico(self):
        pedidos = []

        def carregar(dias):
            pedidos.append(dias)
            return [item('Embraer (EMBJ3) entrega jatos', 2), item('Petrobras sobe', 24 * 20)]
        js = empresas.publicar(AGORA, None, carregar, CFG)
        self.assertEqual(pedidos, [95])
        self.assertEqual(js['aprendidas']['EMBJ3']['nomes'], {'Embraer': 1})
        d20 = (AGORA - dt.timedelta(days=20)).date().isoformat()
        self.assertEqual(js['dias'][d20]['e'].get('PETR4'), 1)
        js2 = empresas.publicar(AGORA + dt.timedelta(minutes=15), js, lambda d: pedidos.append(d) or [item('Embraer anuncia avião', 1)], CFG)
        self.assertEqual(pedidos[-1], 10, 'rodada seguinte: só 10 dias')
        self.assertEqual(js2['dias'][d20]['e'].get('PETR4'), 1, 'dia antigo vem do arquivo anterior')
        self.assertEqual(js2['janelas']['24h']['empresas']['EMBJ3']['n'], 1, 'nome aprendido antes continua valendo')
        self.assertIn('Embraer', empresas.resumo(js2))


class TestRodada(Base):
    def test_rodada_publica_empresas(self):
        m = mundo(feeds={'https://jornal.teste/feed/': [{'titulo': 'Embraer (EMBJ3) entrega 30 jatos e ações sobem', 'link': 'https://jornal.teste/embraer', 'dias': 0},
                                                         {'titulo': 'Ibovespa fecha em alta de 1,2% puxado por bancos', 'link': 'https://jornal.teste/ibov', 'dias': 0}]})
        self.rodar(m)
        js = self.ler('biblioteca/empresas.json')
        self.assertEqual(set(js['janelas']), {'24h', '7d', '30d'})
        self.assertIn('o que o mercado está falando:', self.log)

    def test_falha_nao_derruba(self):
        with mock.patch.object(empresas, 'publicar', side_effect=RuntimeError('x')):
            self.rodar(mundo())
        self.assertIn('o que o mercado está falando não publicado', self.log)


class TestPainel(unittest.TestCase):
    def test_build_e_site(self):
        with open(os.path.join(RAIZ, 'painel', 'build.py'), encoding='utf-8') as f:
            self.assertIn("'ui_v4.js', 'ui_v401.js', 'ui_v41.js', 'ui_v42.js', 'main.js'", f.read())
        with open(os.path.join(RAIZ, 'site', 'index.html'), encoding='utf-8') as f:
            html = f.read()
        for t in ('O que o mercado está falando', 'De onde vêm as notícias', 'v4-mono', 'v4-np-idx', 'v4-tmp-bar', 'v4-sk'):
            self.assertIn(t, html)

    def test_cores_so_no_visual_novo(self):
        with open(os.path.join(RAIZ, 'painel', 'src', 'ui_v41.js'), encoding='utf-8') as f:
            js = f.read()
        self.assertIn('Object.assign(A.PC, v ? PC4 : PC0)', js)
        self.assertIn("if (!A.v4() || !w || !w.querySelector) return w;", js)


if __name__ == '__main__':
    unittest.main()
