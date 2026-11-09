# -*- coding: utf-8 -*-
"""Testes da v3.10 (robô): macro do Brasil (marcação e nota), buscas de macro, Mercado hoje no Telegram e a exceção do
InfoMoney (entra no painel com o aviso Grupo XP; fica fora do Telegram). Simulado = feeds de mentira dentro do teste.
Nada aqui prova que o GitHub alcança os sites ou o Telegram.
Rodar na pasta do projeto:  python -m unittest discover -s testes -v"""
import datetime as dt
import json
import os
import sys
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, '..', 'robo'))

import analise  # noqa: E402
import config  # noqa: E402
import intel  # noqa: E402
import mercado_hoje  # noqa: E402
import util  # noqa: E402
from test_intel import Base, mundo  # noqa: E402

AGORA = dt.datetime(2026, 11, 9, 7, 30, tzinfo=util.BRT)
RAIZ = os.path.join(AQUI, '..')


def item(titulo, horas=2, **kw):
    d = dict(id='m-%d' % (abs(hash(titulo)) % 10 ** 8), titulo=titulo, idioma='pt', link='https://exemplo.com/' + str(abs(hash(titulo)) % 1000), fonte='Veículo Teste',
             organizacao='Veículo Teste', categoria='veiculo', natureza='noticia', publicado_em=(AGORA - dt.timedelta(hours=horas)).isoformat(timespec='minutes'))
    d.update(kw)
    return d


class TestMacroBR(unittest.TestCase):
    def test_manchetes_reais_de_macro(self):
        casos = {
            'Mercado digere discurso de Lula enquanto espera inflação; Ibovespa em dólar sobe nesta segunda': ['agenda', 'inflacao', 'cambio', 'bolsa'],
            'Agenda desta segunda-feira (9): mercado acompanha Focus, inflação e discurso do presidente do BC': ['agenda', 'inflacao'],
            'Tempo real: Ibovespa reage a pronunciamento de Lula e primeiro Boletim Focus pós-Copom': ['juros', 'inflacao', 'bolsa'],
            'Investigação na Nvidia, discurso de Lula e Focus: o que move os mercados nesta segunda': ['agenda', 'inflacao'],
            'Dólar fecha em queda a R$ 5,30 com fluxo estrangeiro': ['cambio', 'bolsa'],
            'Governo cumpre meta fiscal e déficit primário cai': ['fiscal'],
            'Petróleo e acordo com UE sustentam maior superávit comercial brasileiro em quase 40 anos': ['atividade'],
        }
        for t, esperado in casos.items():
            self.assertEqual(analise.macro_br(t), esperado, t)

    def test_fora_da_macro_do_brasil(self):
        for t in ('Fed corta juros e dólar cai no mundo', 'Bolsas da Ásia fecham sem direção única', 'Conselho fiscal da Petrobras aprova contas',
                  'MP do Paraguai estima prejuízo de US$ 810 bilhões, mais de 1% do PIB', 'Sustentabilidade esbarra no orçamento das empresas',
                  'Bolsa Família paga parcela de novembro', 'Câmbio automático ou manual: qual carro comprar'):
            self.assertEqual(analise.macro_br(t), [], t)
        self.assertEqual(analise.macro_br('Stocks rally on weaker dollar', 'en'), [])
        self.assertEqual(analise.macro_br("Brazil's central bank holds Selic at 13.75%", 'en'), ['juros'])

    def test_nota_e_movimento(self):
        x = item('Ibovespa fecha em alta de 1,2% puxado por bancos')
        analise.classificar(x, {}, AGORA.date())
        self.assertEqual(x['macro_br'], ['bolsa'])
        self.assertNotEqual(x['natureza'], 'movimento', 'Ibovespa andando é notícia de mercado')
        self.assertIn('macro do Brasil: bolsa (+8)', x['prioridade']['porque'])
        y = item('Receita de bolo de fubá para o fim de semana')
        analise.classificar(y, {}, AGORA.date())
        self.assertNotIn('macro_br', y)
        self.assertEqual(analise.REGRAS_VERSAO, 38)

    def test_noticia_de_empresa_nao_muda(self):
        # pedido do Lucas: nada do que já existia sobre empresas muda; a nota extra vale só para macro pura
        emp = {'tipo': 'noticia', 'categoria': 'veiculo', 'ativos': ['PETR4'], 'vinculos': {'PETR4': {'tipo': 'direto'}}, 'macro_br': ['bolsa'],
               'publicado_em': '2026-11-09T07:00-03:00', 'natureza': 'noticia', 'temas': ['bolsa']}
        sem = {k: v for k, v in emp.items() if k != 'macro_br'}
        self.assertEqual(analise.prioridade(emp, AGORA.date()), analise.prioridade(sem, AGORA.date()))
        vip = dict(emp, ativos=[], ativos_vip=['VALE3'])
        self.assertEqual(analise.prioridade(vip, AGORA.date()), analise.prioridade({k: v for k, v in vip.items() if k != 'macro_br'}, AGORA.date()))


class TestBuscasEConfig(unittest.TestCase):
    def test_buscas_de_macro(self):
        with open(os.path.join(RAIZ, 'robo', 'config.json'), encoding='utf-8') as f:
            cfg = json.load(f)
        bs = [f for f in intel.fontes_de_busca(cfg) if f.get('busca_macro')]
        self.assertEqual(len(bs), 6)
        for f in bs:
            self.assertTrue(f['exigir_macro'] and f['busca'] and f['intervalo_min'] == 60 and f['idioma'] == 'pt', f['id'])
            self.assertIn('bing.com/news/search', f['url_coleta'])
        self.assertEqual(intel.validar_fontes(bs), [])

    def test_infomoney_so_no_painel(self):
        with open(os.path.join(RAIZ, 'robo', 'config.json'), encoding='utf-8') as f:
            cfg = json.load(f)
        n = cfg['noticias']
        self.assertNotIn('InfoMoney', n['fontes_bloqueadas'])
        for v in ('XP Investimentos', 'Expert XP', 'Conteúdos XP', 'Rico Investimentos', 'Clear Corretora'):
            self.assertIn(v, n['fontes_bloqueadas'])
        self.assertIn('Grupo XP', n['fontes_sinalizadas']['InfoMoney'])
        with open(os.path.join(RAIZ, 'robo', 'fontes.json'), encoding='utf-8') as f:
            fontes = {x['id']: x for x in json.load(f)['fontes']}
        im = fontes['imprensa-infomoney']
        self.assertTrue(im['ativo'] and im['filtro_tema'] and im['url_coleta'] == 'https://www.infomoney.com.br/feed/')
        self.assertEqual(fontes['imprensa-istoe-dinheiro']['status_validacao'], 'a_validar')
        self.assertEqual(config.validar(cfg), [])
        cfg['intel']['mercado_hoje']['telegram'] = 'sim'
        self.assertTrue(any('intel/mercado_hoje' in e for e in config.validar(cfg)))


class TestMercadoHoje(unittest.TestCase):
    def test_escolha(self):
        itens = [item('Dólar fecha em queda a R$ 5,30 com fluxo estrangeiro', 2, prioridade={'pontos': 30}),
                 item('Dólar fecha em queda a R$ 5,30 e Ibovespa sobe com fluxo estrangeiro', 1, fonte='Outro', prioridade={'pontos': 20}),
                 item('Agenda desta segunda-feira: mercado acompanha Focus e inflação', 3),
                 item('Haddad promete cumprir a meta fiscal', 1, organizacao='InfoMoney', aviso_fonte='Grupo XP — não citar em material de cliente'),
                 item('IPCA de outubro desacelera', 30),
                 item('Fed corta juros', 1),
                 item('5 ações para bater o Ibovespa na semana', 1, natureza='recomendacao')]
        sel = mercado_hoje.escolher(itens, AGORA)
        tits = [x['titulo'] for x in sel]
        self.assertEqual(tits[0], 'Agenda desta segunda-feira: mercado acompanha Focus e inflação', 'agenda do dia primeiro')
        self.assertEqual(sum(1 for t in tits if t.startswith('Dólar fecha')), 1, 'o mesmo fato entra uma vez')
        self.assertNotIn('Haddad promete cumprir a meta fiscal', tits, 'Grupo XP fica fora do Telegram')
        self.assertNotIn('IPCA de outubro desacelera', tits, 'fora da janela de 18 h')
        self.assertNotIn('Fed corta juros', tits)
        self.assertNotIn('5 ações para bater o Ibovespa na semana', tits)
        ln = mercado_hoje.linhas_telegram(itens, AGORA)
        self.assertEqual(ln[0], '\n<b>Mercado hoje · Brasil</b>')
        self.assertTrue(all(x.startswith('• <a href="https://') for x in ln[1:]))
        self.assertEqual(mercado_hoje.linhas_telegram([item('Receita de bolo', 1)], AGORA), [])


class TestRodadaComMacro(Base):
    """Rodada inteira simulada: a manchete de macro do Brasil passa no filtro da imprensa, o InfoMoney entra com o aviso
    do Grupo XP, e o briefing do Telegram traz "Mercado hoje · Brasil" sem o InfoMoney."""
    def test_rodada(self):
        with open(os.environ['ROBO_CONFIG'], encoding='utf-8') as f:
            cfg = json.load(f)
        n = cfg.setdefault('noticias', {})
        n['fontes_bloqueadas'] = [v for v in n.get('fontes_bloqueadas') or [] if v != 'InfoMoney']
        n['fontes_sinalizadas'] = {'InfoMoney': 'Grupo XP — não citar em material de cliente'}
        p = os.path.join(self.tmp, 'config.json')
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(cfg, f)
        os.environ['ROBO_CONFIG'] = p
        m = mundo(feeds={'https://jornal.teste/feed/': [{'titulo': 'Mercado digere discurso de Lula enquanto espera inflação; Ibovespa sobe', 'link': 'https://jornal.teste/mercado', 'dias': 0},
                                                         {'titulo': 'Ibovespa fecha em alta de 1,2% puxado por bancos', 'link': 'https://jornal.teste/ibov-alta', 'dias': 0}],
                         'https://im.teste/feed/': [{'titulo': 'Haddad promete cumprir a meta fiscal e detalhar corte de gastos', 'link': 'https://im.teste/fiscal', 'dias': 0}]})
        self.rodar(m, TELEGRAM_TOKEN='x', TELEGRAM_CHAT_ID='123')
        rec = self.ler('recentes.json')['itens']
        por = {x['link']: x for x in rec}
        self.assertIn('https://jornal.teste/ibov-alta', por, 'macro do Brasil sem tema antigo passa no filtro da imprensa')
        self.assertEqual(por['https://jornal.teste/ibov-alta']['macro_br'], ['bolsa'])
        im = por.get('https://im.teste/fiscal')
        self.assertIsNotNone(im, 'InfoMoney entra no painel')
        self.assertIn('Grupo XP', im.get('aviso_fonte') or '')
        self.assertEqual(im['macro_br'], ['fiscal'])
        briefing = [t for t in m.enviadas if 'briefing' in t]
        self.assertEqual(len(briefing), 1, m.enviadas)
        self.assertIn('<b>Mercado hoje · Brasil</b>', briefing[0])
        self.assertIn('Mercado digere discurso de Lula', briefing[0])
        self.assertNotIn('Haddad promete cumprir a meta fiscal', briefing[0], 'Grupo XP fica fora do Telegram')


if __name__ == '__main__':
    unittest.main()
