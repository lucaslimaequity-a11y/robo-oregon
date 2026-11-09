# -*- coding: utf-8 -*-
"""Testes da v3.9 (robô): glossário do mercado em inglês e a frase do dia no briefing do Telegram.
Simulado = manchetes de mentira dentro do teste. Nada aqui prova que o GitHub alcança os sites ou o Telegram.
Rodar na pasta do projeto:  python -m unittest discover -s testes -v"""
import datetime as dt
import json
import os
import sys
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, '..', 'robo'))

import config  # noqa: E402
import ingles  # noqa: E402
import util  # noqa: E402

AGORA = dt.datetime(2026, 11, 8, 22, 0, tzinfo=util.BRT)


def item(titulo, horas=2, idioma='en', **kw):
    d = dict(id='x-%d' % (abs(hash(titulo)) % 10 ** 8), titulo=titulo, idioma=idioma, link='https://exemplo.com/a?b=1&c=2', fonte='Veículo Teste',
             publicado_em=(AGORA - dt.timedelta(hours=horas)).isoformat(timespec='minutes'), categoria='veiculo')
    d.update(kw)
    return d


class TestGlossario(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.g = ingles.glossario()

    def test_estrutura(self):
        with open(os.path.join(AQUI, '..', 'robo', 'glossario_en.json'), encoding='utf-8') as f:
            bruto = json.load(f)
        self.assertGreaterEqual(len(self.g), 150)
        nomes = [t['t'] for t in self.g]
        self.assertEqual(len(nomes), len(set(nomes)), 'cada termo aparece uma vez')
        for t in self.g:
            for k in ('g', 't', 'f', 'pt', 'exp', 'ex', 'ex_pt'):
                self.assertTrue(t.get(k), '%s sem %s' % (t.get('t'), k))
            self.assertIn(t['g'], bruto['grupos'], t['t'])

    def test_cada_exemplo_contem_o_proprio_termo(self):
        for t in self.g:
            achados = [a['termo']['t'] for a in ingles.termos_em(t['ex'], self.g)]
            self.assertIn(t['t'], achados, t['ex'])

    def test_forma_mais_longa_vence(self):
        ts = [a['termo']['t'] for a in ingles.termos_em('The stock offers a high dividend yield', self.g)]
        self.assertIn('dividend yield', ts)
        self.assertNotIn('dividend', ts)
        self.assertNotIn('yield', ts)

    def test_maiuscula_so_na_grafia_exata(self):
        self.assertIn('Fed', [a['termo']['t'] for a in ingles.termos_em('Fed holds rates steady', self.g)])
        self.assertNotIn('Fed', [a['termo']['t'] for a in ingles.termos_em('Investors are fed up with delays', self.g)])
        self.assertIn('AI', [a['termo']['t'] for a in ingles.termos_em('AI spending keeps growing', self.g)])
        self.assertEqual([a['termo']['t'] for a in ingles.termos_em('Thai baht', self.g)], [])

    def test_formas_ambiguas_ficam_de_fora(self):
        for frase in ('BP shares rise', 'Prices are fine', 'Ahead of the curve', 'On board the ship'):
            ts = [a['termo']['t'] for a in ingles.termos_em(frase, self.g)]
            self.assertNotIn('basis point', ts, frase)
            self.assertNotIn('fine', ts, frase)
            self.assertNotIn('yield curve', ts, frase)
            self.assertNotIn('board', ts, frase)


class TestFraseDoDia(unittest.TestCase):
    def test_escolhe_a_manchete_com_mais_termos(self):
        itens = [item('Stocks rise in a quiet session for Wall Street', horas=1),
                 item('Gold Holds Decline as US Jobs Data Fan December Rate Hike Bets', horas=3, fonte='Bloomberg'),
                 item('Ações sobem com alta de juros e dividendos recordes nos bancos', idioma='pt', horas=1)]
        f = ingles.escolher_frase(itens, ingles.glossario(), AGORA)
        self.assertEqual(f['item']['titulo'], 'Gold Holds Decline as US Jobs Data Fan December Rate Hike Bets')
        self.assertEqual([t['t'] for t in f['termos']][:3], ['gold', 'jobs report', 'rate hike'])

    def test_filtra_ruido_idade_e_tamanho(self):
        itens = [item('DHT Holdings Q3 2026 Earnings Preview with dividend and buyback', horas=1),
                 item('Banks raise dividend and approve new buyback after record profit', horas=40),
                 item('Buyback', horas=1),
                 item('Banks raise dividend and approve new buyback after record profit', horas=1, link='')]
        self.assertIsNone(ingles.escolher_frase(itens, ingles.glossario(), AGORA))

    def test_linhas_do_telegram(self):
        itens = [item('Bank <raises> dividend & approves buyback after strong quarter', horas=2, organizacao='Banco & Cia')]
        ln = ingles.linhas_telegram(itens, AGORA, site='https://site.exemplo/oregon/')
        txt = '\n'.join(ln)
        self.assertIn('<b>Inglês do dia</b>', txt)
        self.assertIn('Bank &lt;raises&gt; dividend &amp; approves buyback after strong quarter', txt)
        self.assertIn('href="https://exemplo.com/a?b=1&amp;c=2"', txt)
        self.assertIn('— Banco &amp; Cia', txt)
        self.assertIn('• <b>buyback</b>: recompra de ações', txt)
        self.assertIn('https://translate.google.com/?sl=en&amp;tl=pt&amp;text=Bank%20%3Craises%3E', txt)
        self.assertIn('href="https://site.exemplo/oregon/#bib/ingles"', txt)
        self.assertLessEqual(sum(1 for x in ln if x.startswith('• ')), 3, 'no máximo 3 termos')

    def test_sem_manchete_sem_secao(self):
        self.assertEqual(ingles.linhas_telegram([item('Ações sobem', idioma='pt')], AGORA), [])
        self.assertEqual(ingles.linhas_telegram([], AGORA), [])

    def test_configuracao(self):
        with open(os.path.join(AQUI, '..', 'robo', 'config.json'), encoding='utf-8') as f:
            cfg = json.load(f)
        self.assertTrue(cfg['intel']['ingles']['telegram'])
        self.assertEqual(config.validar(cfg), [])
        cfg['intel']['ingles']['telegram'] = 'sim'
        self.assertTrue(any('intel/ingles' in e for e in config.validar(cfg)))



from test_intel import Base, mundo  # noqa: E402


class TestBriefingComIngles(Base):
    """Rodada inteira simulada com o Telegram ligado: o briefing do dia traz a seção "Inglês do dia"."""
    def test_briefing_traz_o_ingles_do_dia(self):
        m = mundo(feeds={'https://world.teste/feed/': [{'titulo': 'Banks raise dividend and approve new buyback after record profit', 'link': 'https://world.teste/bancos', 'dias': 0}]})
        self.rodar(m, TELEGRAM_TOKEN='x', TELEGRAM_CHAT_ID='123')
        briefing = [t for t in m.enviadas if 'briefing' in t]
        self.assertEqual(len(briefing), 1, m.enviadas)
        self.assertIn('<b>Inglês do dia</b>', briefing[0])
        self.assertIn('Banks raise dividend and approve new buyback after record profit', briefing[0])
        self.assertIn('• <b>buyback</b>: recompra de ações', briefing[0])
        self.assertIn('#bib/ingles', briefing[0])

    def test_desligado_na_configuracao(self):
        import json as _j
        with open(os.environ['ROBO_CONFIG'], encoding='utf-8') as f:
            cfg = _j.load(f)
        cfg.setdefault('intel', {})['ingles'] = {'telegram': False}
        p = os.path.join(self.tmp, 'config.json')
        with open(p, 'w', encoding='utf-8') as f:
            _j.dump(cfg, f)
        os.environ['ROBO_CONFIG'] = p
        m = mundo(feeds={'https://world.teste/feed/': [{'titulo': 'Banks raise dividend and approve new buyback after record profit', 'link': 'https://world.teste/bancos', 'dias': 0}]})
        self.rodar(m, TELEGRAM_TOKEN='x', TELEGRAM_CHAT_ID='123')
        briefing = [t for t in m.enviadas if 'briefing' in t]
        self.assertEqual(len(briefing), 1)
        self.assertNotIn('Inglês do dia', briefing[0])


if __name__ == '__main__':
    unittest.main()
