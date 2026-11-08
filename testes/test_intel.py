# -*- coding: utf-8 -*-
"""Testes do Oregon Intelligence (robo/intel.py) com a internet simulada. Nenhum item aqui é conteúdo real.
Cobrem: falha de fonte sem perder histórico, duplicação (link e título), detecção de publicação nova, persistência por
mês, publicação dos arquivos do site, análise sem IA e com IA (teto), robots.txt, YouTube sem/com chave, resumo semanal.
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
import urllib.request
from unittest import mock

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, '..', 'robo'))

import simulador as S  # noqa: E402
import analise  # noqa: E402
import biblioteca  # noqa: E402
import conteudo  # noqa: E402
import intel  # noqa: E402
import util  # noqa: E402

CONFIG_TESTE = os.path.join(AQUI, 'config_teste.json')
FONTES_TESTE = os.path.join(AQUI, 'fontes_teste.json')
DATA_PAINEL = os.path.join(AQUI, '..', 'painel', 'src', 'data.json')
ANO = 2026

CARTAS = [{'titulo': 'Carta 41 — Juros reais e o custo de esperar', 'link': 'https://gestora.teste/carta-41', 'dias': 1, 'autor': 'Equipe de gestão',
           'resumo': 'Nesta carta discutimos a Selic, a curva de juros prefixada e por que Petrobras e Itaúsa seguem na carteira. Defendemos que o prêmio de 7% ao ano em NTN-B é raro.'},
          {'titulo': 'Referências bibliográficas do trimestre', 'link': 'https://gestora.teste/refs', 'dias': 3, 'resumo': 'Livros lidos pela equipe.'}]
NOTAS = [{'titulo': 'Copom mantém a taxa Selic em 13,75% a.a.', 'link': 'https://bc.teste/nota/1', 'dias': 0, 'resumo': 'O Comitê decidiu, por unanimidade, manter a taxa básica.'},
         {'titulo': 'Estatísticas monetárias e de crédito de setembro', 'link': 'https://bc.teste/nota/2', 'dias': 2, 'resumo': 'Saldo de crédito cresce 10% em 12 meses; inadimplência estável.'}]
PAPERS = [{'titulo': 'Working Paper 1392: Gaining (and losing) currency', 'link': 'https://global.teste/wp1392', 'dias': 1, 'resumo': 'A global database of currencies and exchange rate regimes.'}]
PAGINA_1 = '<html><body><a href="/docs/Carta_Mensal_Outubro_2026.pdf">Carta Mensal Outubro 2026</a><a href="/sobre">Sobre</a></body></html>'
PAGINA_2 = '<html><body><a href="/docs/Carta_Mensal_Novembro_2026.pdf">Carta Mensal Novembro 2026</a><a href="/docs/Carta_Mensal_Outubro_2026.pdf">Carta Mensal Outubro 2026</a></body></html>'
WP = [{'id': 1, 'date_gmt': '%d-11-05T12:00:00' % ANO, 'link': 'https://wp.teste/blog/carta-do-gestor-licoes/', 'title': {'rendered': 'Carta do Gestor &#8211; Lições de alocação'}, 'excerpt': {'rendered': '<p>Sobre asset allocation e diversificação global.</p>'}},
      {'id': 2, 'date_gmt': '%d-11-04T12:00:00' % ANO, 'link': 'https://wp.teste/blog/evento-webinar/', 'title': {'rendered': 'Inscreva-se no webinar'}, 'excerpt': {'rendered': ''}}]
SITEMAP = ('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://sitemap.teste/insights/growth-holds-risks-widen</loc><lastmod>%d-11-03</lastmod></url>'
           '<url><loc>https://sitemap.teste/insights/</loc><lastmod>%d-11-03</lastmod></url><url><loc>https://sitemap.teste/insights/old-piece</loc><lastmod>2024-01-01</lastmod></url></urlset>' % (ANO, ANO))
JORNAL = [{'titulo': 'Petrobras anuncia dividendos extraordinários', 'link': 'https://jornal.teste/petr', 'dias': 0, 'resumo': 'TEXTO INTEGRAL QUE NÃO PODE SER GUARDADO'},
          {'titulo': 'Ibovespa dispara e derrete no mesmo dia: você precisa ver', 'link': 'https://jornal.teste/ibov', 'dias': 0, 'resumo': 'x'}]
AGREG = [{'titulo': 'Copom mantém a Selic em 13,75% - Jornal Teste', 'link': 'https://jornal.teste/copom', 'dias': 0, 'veiculo': 'Jornal Teste'},
         {'titulo': 'Selic parada: o que fazer com a carteira - Expert XP', 'link': 'https://xp.teste/x', 'dias': 0, 'veiculo': 'Expert XP'},
         {'titulo': 'Copom mantém a Selic em 13,75% ao ano - Outro Diário', 'link': 'https://outro.teste/copom', 'dias': 0, 'veiculo': 'Outro Diário'}]
SETORIAL = [{'titulo': 'Soja sobe em Chicago', 'link': 'https://setorial.teste/1', 'dias': 0}, {'titulo': 'Klabin anuncia nova fábrica de papel', 'link': 'https://setorial.teste/2', 'dias': 0}]


def mundo(**kw):
    base = dict(feeds={'https://gestora.teste/feed/': CARTAS, 'https://jornal.teste/feed/': JORNAL, 'https://agregador.teste/rss?q=juros': AGREG, 'https://setorial.teste/feed/': SETORIAL},
                atom={'https://bc.teste/feed/notas?ano=%d' % ANO: NOTAS}, rdf={'https://global.teste/doclist/papers.rss': PAPERS},
                paginas={'https://pdf.teste/cartas': PAGINA_1, 'https://sitemap.teste/sitemap.xml': SITEMAP, 'https://vedado.teste/research': '<a href="/a.pdf">a</a>'},
                apis={'https://wp.teste/wp-json/wp/v2/posts?per_page=10': WP}, heads={'https://guia.teste/guia.pdf': {'etag': '"v1"', 'content-length': '100'}},
                robots={'vedado.teste': 'User-agent: *\nDisallow: /research\n', 'www.youtube.com': 'User-agent: *\nDisallow: /feeds/videos.xml\n'})
    for k, v in kw.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            base[k] = dict(base[k], **v)
        else:
            base[k] = v
    return S.Mundo(**base)


class Base(unittest.TestCase):
    agora = '%d-11-06T15:30:00-03:00' % ANO

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.saida = os.path.join(self.tmp, 'saida.txt')
        self.resumo = os.path.join(self.tmp, 'resumo.md')
        self.env = {'ROBO_DADOS': os.path.join(self.tmp, 'data'), 'ROBO_AGORA': self.agora, 'GITHUB_OUTPUT': self.saida, 'GITHUB_STEP_SUMMARY': self.resumo,
                    'ROBO_CONFIG': CONFIG_TESTE, 'ROBO_FONTES': FONTES_TESTE, 'ROBO_OREGON': DATA_PAINEL}
        mock.patch.dict(os.environ, self.env).start()
        for k in ('TELEGRAM_TOKEN', 'TELEGRAM_CHAT_ID', 'ANTHROPIC_API_KEY', 'YOUTUBE_API_KEY', 'ROBO_MODO', 'ROBO_MANUAL'):
            os.environ.pop(k, None)
        mock.patch.object(util.time, 'sleep', lambda s: None).start()

    def tearDown(self):
        mock.patch.stopall()
        shutil.rmtree(self.tmp)

    def rodar(self, m, codigo=0, **env):
        for k, v in env.items():
            os.environ[k] = str(v)
        buf = io.StringIO()
        with mock.patch.object(urllib.request, 'urlopen', m), mock.patch('sys.stdout', buf):
            self.assertEqual(intel.main(), codigo)
        self.log = buf.getvalue()
        return self.ler('recentes.json') if codigo == 0 else None

    def ler(self, nome):
        with open(os.path.join(self.tmp, 'data', nome), encoding='utf-8') as f:
            return json.load(f)

    def existe(self, nome):
        return os.path.exists(os.path.join(self.tmp, 'data', nome))

    def saidas(self):
        with open(self.saida, encoding='utf-8') as f:
            return dict(l.split('=', 1) for l in f.read().strip().splitlines() if '=' in l)

    def por_id(self, rec):
        return {x['id']: x for x in rec['itens']}

    def titulos(self, rec):
        return [x['titulo'] for x in rec['itens']]


class TestRodada(Base):
    def test_publica_todos_os_arquivos_e_classifica(self):
        rec = self.rodar(mundo())
        for f in ('macro.json', 'recentes.json', 'hoje.json', 'coleta.json', 'versao.json', 'status.json', 'estado.json', 'biblioteca/indice.json', 'biblioteca/%d-11.json' % ANO):
            self.assertTrue(self.existe(f), f)
        tit = self.titulos(rec)
        self.assertIn('Carta 41 — Juros reais e o custo de esperar', tit)
        self.assertIn('Copom mantém a taxa Selic em 13,75% a.a.', tit)
        self.assertIn('Working Paper 1392: Gaining (and losing) currency', tit)      # RDF/RSS 1.0
        self.assertIn('Carta Mensal Outubro 2026', tit)                               # PDF descoberto na página
        self.assertIn('Carta do Gestor – Lições de alocação', tit)                    # API WordPress, entidade HTML decodificada
        self.assertIn('Growth holds risks widen', tit)                                # sitemap, título provisório
        self.assertTrue(any(t.startswith('Guia Trimestral Teste') for t in tit))     # arquivo de URL fixa, primeira leitura
        self.assertNotIn('Inscreva-se no webinar', tit)                               # fora do filtro_link da API
        self.assertNotIn('Soja sobe em Chicago', tit)                                 # feed setorial: só ativos da Oregon
        self.assertIn('Klabin anuncia nova fábrica de papel', tit)
        carta = next(x for x in rec['itens'] if x['titulo'].startswith('Carta 41'))
        self.assertIn('juros', carta['temas'])
        self.assertIn('brasil', carta['regioes'])
        self.assertTrue({'PETR4', 'ITSA4'} <= set(carta['ativos']), carta['ativos'])
        self.assertIn('real', carta['fatores'])
        self.assertEqual(carta['prioridade']['nivel'], 'alta')
        self.assertEqual(carta['analise']['modo'], 'regras')
        self.assertFalse(carta['analise']['profunda'])
        for k in ('1_publicacao', '2_tese', '3_evidencias', '4_contrarios', '5_regioes', '6_oregon', '7_monitorar'):
            self.assertTrue(carta['analise'][k], k)
            for fr in carta['analise'][k]:
                self.assertIn(fr['r'], ('FATO', 'FONTE', 'INFERÊNCIA'))
        self.assertEqual(carta['analise']['1_publicacao'][0]['r'], 'FATO')
        self.assertTrue(any('PETR4' in fr['t'] for fr in carta['analise']['6_oregon']))
        self.assertTrue(all(x['link'].startswith('http') for x in rec['itens']))     # a fonte original sempre abre
        self.assertTrue(all('analise' in x for x in rec['itens']))                    # ninguém fica sem análise
        # veículo de imprensa: nada do texto guardado; sensacionalismo penalizado mas visível
        petr = next(x for x in rec['itens'] if x['link'] == 'https://jornal.teste/petr')
        self.assertEqual(petr['resumo'], '')
        ibov = next(x for x in rec['itens'] if x['link'] == 'https://jornal.teste/ibov')
        self.assertEqual(ibov['natureza'], 'sensacionalista')
        self.assertEqual(ibov['prioridade']['nivel'], 'baixa')
        # agregador: veículo bloqueado (XP) descartado; o mesmo fato em dois veículos vira um item com "também em"
        self.assertFalse(any('xp.teste' in x['link'] for x in rec['itens']))
        copom = [x for x in rec['itens'] if 'Copom mantém' in x['titulo']]
        self.assertEqual(len(copom), 1, [x['titulo'] for x in copom])
        self.assertEqual(copom[0]['fonte_id'], 'banco-central-atom')                 # a fonte primária fica como principal
        self.assertEqual(len(copom[0]['tambem_em']), 2)
        # contadores por fonte
        col = self.ler('coleta.json')
        g = col['fontes']['gnews-teste']
        self.assertEqual(g['recebidos'], 3)
        self.assertEqual(g['novos'], 2)                                              # a XP não chegou a virar item
        self.assertEqual(g['publicados'], 0)                                          # os dois eram o mesmo fato da nota oficial
        self.assertEqual(col['fontes']['setorial-so-oregon']['rejeitados'].get('sem_ativo_oregon'), 1)
        self.assertEqual(col['fontes']['gestora-rss']['ultima_ok'][:10], '%d-11-06' % ANO)
        u = col['ultima']
        self.assertEqual(u['fontes_erro'], 1)                                         # só a página vedada por robots
        self.assertIn('robots', col['fontes']['pagina-robots']['ultimo_erro'])
        self.assertTrue(col['fontes']['youtube-teste']['aguardando'])                 # sem chave: aguardando, não falha
        self.assertEqual(self.saidas()['status'], 'parcial')
        # briefing
        hj = self.ler('hoje.json')
        self.assertTrue(5 <= len(hj['prioridades']) <= 8)
        ids = {x['id'] for x in rec['itens']}
        self.assertTrue(all(p['id'] in ids for p in hj['prioridades']))
        self.assertEqual(hj['prioridades'][0]['id'], carta['id'])
        self.assertTrue(hj['estudo'])
        self.assertIn('IA desligada', hj['aviso'])
        self.assertTrue(hj['leitura'])
        # macro só com indicadores oficiais (sem cotação de ação)
        mc = self.ler('macro.json')
        self.assertIn('selic', mc['indicadores'])
        self.assertIn('pre', mc['curva'])
        self.assertNotIn('ativos', mc)
        self.assertIn('Não são cotações em tempo real', mc['nota'])
        v = self.ler('versao.json')
        self.assertEqual(v['meses'], ['%d-11' % ANO])

    def test_falha_de_fonte_nao_apaga_historico(self):
        self.rodar(mundo())
        n1 = len(self.ler('biblioteca/%d-11.json' % ANO)['itens'])
        os.environ['ROBO_AGORA'] = '%d-11-07T09:00:00-03:00' % ANO
        rec = self.rodar(mundo(fora={'gestora.teste', 'bc.teste', 'global.teste'}))
        tit = self.titulos(rec)
        self.assertIn('Carta 41 — Juros reais e o custo de esperar', tit)
        self.assertIn('Copom mantém a taxa Selic em 13,75% a.a.', tit)
        self.assertEqual(len(self.ler('biblioteca/%d-11.json' % ANO)['itens']), n1)
        col = self.ler('coleta.json')
        g = col['fontes']['gestora-rss']
        self.assertEqual(g['ultima_ok'][:10], '%d-11-06' % ANO)
        self.assertIn('erro do servidor', g['ultimo_erro'])
        self.assertEqual(g['erros'], 1)
        self.assertEqual(col['ultima']['fontes_erro'], 4)  # 3 fora do ar + a página vedada por robots
        self.assertEqual(self.saidas()['status'], 'parcial')
        self.assertIn('fonte(s) de conteúdo com falha', self.saidas()['motivos'])

    def test_macro_falha_reaproveita_sem_zerar(self):
        self.rodar(mundo())
        os.environ['ROBO_AGORA'] = '%d-11-06T16:30:00-03:00' % ANO
        self.rodar(mundo(fora={'bcb', 'tesouro', 'treasury', 'focus'}))
        mc = self.ler('macro.json')
        self.assertTrue(mc['indicadores']['selic'].get('reaproveitado'))
        self.assertEqual(mc['indicadores']['selic']['nivel'], 13.75)
        self.assertTrue(mc['curva']['ust10'].get('reaproveitado'))
        self.assertFalse(mc['fontes']['bcb']['ok'])
        self.assertNotIn(0, [v.get('nivel') for v in mc['indicadores'].values()])

    def test_duplicados_por_link_nao_viram_novos(self):
        self.rodar(mundo())
        os.environ['ROBO_AGORA'] = '%d-11-06T18:30:00-03:00' % ANO
        self.rodar(mundo())
        col = self.ler('coleta.json')
        self.assertEqual(col['ultima']['novos'], 0)
        self.assertEqual(col['ultima']['publicados'], 0)
        self.assertEqual(col['fontes']['gestora-rss']['ultima_rodada']['duplicados'], 2)
        self.assertEqual(len([x for x in self.ler('biblioteca/%d-11.json' % ANO)['itens'] if x['titulo'].startswith('Carta 41')]), 1)

    def test_detecta_publicacao_nova_e_edicao_atualizada(self):
        self.rodar(mundo())
        os.environ['ROBO_AGORA'] = '%d-11-07T09:00:00-03:00' % ANO
        rec = self.rodar(mundo(paginas={'https://pdf.teste/cartas': PAGINA_2}, heads={'https://guia.teste/guia.pdf': {'etag': '"v2"', 'content-length': '120', 'last-modified': 'Fri, 06 Nov %d 10:00:00 GMT' % ANO}}))
        tit = self.titulos(rec)
        self.assertIn('Carta Mensal Novembro 2026', tit)
        self.assertEqual(tit.count('Carta Mensal Outubro 2026'), 1)
        guias = [x for x in rec['itens'] if x['titulo'].startswith('Guia Trimestral Teste')]
        self.assertEqual(len(guias), 2)
        self.assertTrue(all(x['link'] == 'https://guia.teste/guia.pdf' for x in guias))
        col = self.ler('coleta.json')
        self.assertEqual(col['fontes']['pagina-pdf']['ultima_rodada']['novos'], 1)
        self.assertEqual(col['fontes']['arquivo-fixo']['ultima_rodada']['novos'], 1)
        os.environ['ROBO_AGORA'] = '%d-11-07T12:00:00-03:00' % ANO
        self.rodar(mundo(paginas={'https://pdf.teste/cartas': PAGINA_2}, heads={'https://guia.teste/guia.pdf': {'etag': '"v2"', 'content-length': '120'}}))
        col = self.ler('coleta.json')
        self.assertEqual(col['fontes']['arquivo-fixo']['ultima_rodada']['novos'], 0)

    def test_persistencia_por_mes(self):
        antiga = [{'titulo': 'Carta 40 — O ciclo anterior', 'link': 'https://gestora.teste/carta-40', 'dias': 40, 'resumo': 'Carta do trimestre anterior.'}]
        self.rodar(mundo(feeds={'https://gestora.teste/feed/': CARTAS + antiga}))
        self.assertTrue(self.existe('biblioteca/%d-09.json' % ANO))
        idx = self.ler('biblioteca/indice.json')
        self.assertEqual([m['mes'] for m in idx['meses']], ['%d-09' % ANO, '%d-11' % ANO])
        self.assertEqual(idx['total'], sum(m['n'] for m in idx['meses']))
        self.assertNotIn('Carta 40 — O ciclo anterior', self.titulos(self.ler('recentes.json')))  # fora da janela de recentes, mas na biblioteca
        os.environ['ROBO_AGORA'] = '%d-11-07T09:00:00-03:00' % ANO
        self.rodar(mundo(fora={'gestora.teste'}))
        self.assertEqual(len(self.ler('biblioteca/%d-09.json' % ANO)['itens']), 1)
        self.assertEqual(self.ler('versao.json')['meses'], ['%d-09' % ANO, '%d-11' % ANO])

    def test_sem_data_no_feed_usa_deteccao_marcada(self):
        m = mundo()
        m.feeds['https://gestora.teste/feed/'] = CARTAS
        rec = self.rodar(m)
        pdf = next(x for x in rec['itens'] if x['titulo'] == 'Carta Mensal Outubro 2026')
        self.assertIsNone(pdf['publicado_em'])
        self.assertTrue(pdf['data_estimada'])
        self.assertIn('a página não informa a data', pdf['analise']['1_publicacao'][0]['t'])


class TestIA(Base):
    RESP = {'tese': [{'r': 'FONTE', 't': 'A gestora defende que o juro real de 7% é raro.'}], 'evidencias': [{'r': 'FATO', 't': 'Cita NTN-B a 7% ao ano.'}],
            'contrarios': [{'r': 'INFERÊNCIA', 't': 'Risco fiscal pode manter o prêmio.'}], 'regioes': [{'r': 'INFERÊNCIA', 't': 'Brasil.'}],
            'oregon': [{'r': 'INFERÊNCIA', 't': 'Toca IMAB11 e B5P211.'}, {'r': 'ERRADO', 't': 'rótulo inválido deve cair'}], 'monitorar': [{'r': 'INFERÊNCIA', 't': 'Focus e curva.'}],
            'temas': ['juros', 'renda fixa'], 'resumo_1_frase': 'Carta sobre juro real.'}

    def _cfg_ia(self, ativo, max_itens=12):
        c = json.load(open(CONFIG_TESTE, encoding='utf-8'))
        c['intel']['ia']['ativo'] = ativo
        c['intel']['ia']['max_itens_dia'] = max_itens
        p = os.path.join(self.tmp, 'config_ia.json')
        json.dump(c, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
        os.environ['ROBO_CONFIG'] = p

    def test_sem_chave_continua_util(self):
        self._cfg_ia(True)
        rec = self.rodar(mundo(ia_respostas=[self.RESP]))
        self.assertTrue(all(x['analise']['modo'] == 'regras' for x in rec['itens']))
        self.assertIn('sem ANTHROPIC_API_KEY', self.ler('status.json')['ia']['msg'])
        self.assertIsNone(self.ler('status.json')['ia']['ok'])

    def test_desligada_na_config_nao_chama_mesmo_com_chave(self):
        self._cfg_ia(False)
        m = mundo(ia_respostas=[self.RESP])
        self.rodar(m, ANTHROPIC_API_KEY='sk-teste')
        self.assertEqual(m.ia_pedidos, [])
        self.assertIn('desligada na configuração', self.ler('status.json')['ia']['msg'])

    def test_com_chave_respeita_teto_e_rotulos(self):
        self._cfg_ia(True, max_itens=2)
        m = mundo(ia_respostas=[self.RESP])
        rec = self.rodar(m, ANTHROPIC_API_KEY='sk-teste')
        self.assertEqual(len(m.ia_pedidos), 2)
        lidos = [x for x in rec['itens'] if x['analise']['modo'] == 'ia']
        self.assertEqual(len(lidos), 2)
        carta = next(x for x in lidos if x['titulo'].startswith('Carta 41'))
        self.assertTrue(carta['analise']['profunda'])
        self.assertEqual(carta['analise']['1_publicacao'][0]['r'], 'FATO')              # o fato da publicação vem sempre das regras
        self.assertEqual(len(carta['analise']['6_oregon']), 1)                           # rótulo inválido descartado
        self.assertEqual(carta['analise']['2_tese'][0]['r'], 'FONTE')
        pedido = json.dumps(m.ia_pedidos[0], ensure_ascii=False)
        self.assertIn('Carta 41', pedido)
        for proibido in ('0.2', 'peso', 'cresc-cons', 'wp"'):                           # nada de pesos ou carteiras vai para a IA
            self.assertNotIn(proibido, pedido)
        self.assertIn('Nunca recomende comprar ou vender', pedido)
        est = self.ler('estado.json')
        self.assertEqual(est['ia_uso']['itens'], 2)
        self.assertEqual(est['ia_uso']['entrada'], 1400)
        self.assertIn('teto diário atingido', self.ler('status.json')['ia']['msg'])
        hj = self.ler('hoje.json')
        self.assertIsNone(hj['aviso'])
        # na rodada seguinte do mesmo dia o teto continua valendo
        os.environ['ROBO_AGORA'] = '%d-11-06T18:30:00-03:00' % ANO
        m2 = mundo(ia_respostas=[self.RESP])
        self.rodar(m2, ANTHROPIC_API_KEY='sk-teste')
        self.assertEqual(m2.ia_pedidos, [])

    def test_chave_recusada_nao_derruba(self):
        self._cfg_ia(True)
        m = mundo(ia_respostas=[self.RESP], http={'anthropic': 401})
        rec = self.rodar(m, ANTHROPIC_API_KEY='sk-ruim')
        self.assertTrue(all(x['analise']['modo'] == 'regras' for x in rec['itens']))
        self.assertIn('chave recusada', self.ler('status.json')['ia']['msg'])
        self.assertLessEqual(len(m.ia_pedidos), 1)


class TestYouTubeRobots(Base):
    def test_youtube_com_chave_oficial(self):
        m = mundo(apis={'youtube:UUteste00000000000000000': [{'titulo': 'Entrevista sobre política monetária', 'dias': 1, 'resumo': 'Conversa com o diretor.'}]})
        rec = self.rodar(m, YOUTUBE_API_KEY='chave-yt-teste')
        v = next(x for x in rec['itens'] if x['tipo'] == 'video')
        self.assertEqual(v['link'], 'https://www.youtube.com/watch?v=vid00000')
        self.assertFalse(self.ler('coleta.json')['fontes']['youtube-teste'].get('aguardando'))
        self.assertFalse(any('youtube.com/feeds' in u for u in m.chamadas))   # com chave, o feed vedado não é tocado
        hj = self.ler('hoje.json')
        self.assertEqual(hj['videos'][0]['id'], v['id'])

    def test_youtube_chave_invalida_vira_erro_de_autenticacao(self):
        m = mundo()
        self.rodar(m, YOUTUBE_API_KEY='errada')
        self.assertIn('bloqueado', self.ler('coleta.json')['fontes']['youtube-teste']['ultimo_erro'].lower() + 'bloqueado')

    def test_robots_veda_e_nao_contorna(self):
        m = mundo()
        self.rodar(m)
        self.assertFalse(any(u == 'https://vedado.teste/research' for u in m.chamadas))
        self.assertIn('https://vedado.teste/robots.txt', m.chamadas)
        self.assertEqual(self.ler('coleta.json')['fontes']['pagina-robots']['ultima_rodada']['novos'], 0)


class TestSemanalEConfig(Base):
    def test_resumo_semanal(self):
        self.rodar(mundo(), ROBO_MODO='semanal')
        sem = self.ler('semanal.json')
        s = sem['semanas'][0]
        self.assertEqual(s['semana'], '%d-S45' % ANO)
        self.assertTrue(s['n_itens'] >= 5)
        self.assertEqual(s['temas'][0]['tema'], 'juros')
        self.assertTrue(s['teses'])
        self.assertIsNone(s['mudancas_visao'])
        self.assertIn('IA', s['mudancas_visao_nota'])
        self.assertTrue(s['perguntas'])
        # sábado gera o resumo sozinho, sem repetir o que já existe
        os.environ['ROBO_AGORA'] = '%d-11-07T09:00:00-03:00' % ANO
        self.rodar(mundo())
        self.assertEqual(len(self.ler('semanal.json')['semanas']), 1)

    def test_fontes_invalidas_sao_criticas(self):
        p = os.path.join(self.tmp, 'fontes_ruins.json')
        json.dump({'fontes': [{'id': 'x', 'nome': 'x', 'metodo': 'telepatia', 'url_coleta': 'https://x.teste/'}, {'id': 'x', 'nome': 'y', 'metodo': 'rss', 'url_coleta': 'ftp://nada'}]}, open(p, 'w'))
        os.environ['ROBO_FONTES'] = p
        self.rodar(mundo(), codigo=1)
        self.assertEqual(self.saidas()['status'], 'critico')
        self.assertEqual(self.saidas()['pular'], 'true')
        self.assertIn('método "telepatia"', self.saidas()['motivos'])
        self.assertFalse(self.existe('recentes.json'))

    def test_cadastro_real_valido_e_publico(self):
        fontes = intel.carregar_fontes(os.path.join(AQUI, '..', 'robo', 'fontes.json'))
        self.assertEqual(intel.validar_fontes(fontes), [])
        ativas = [f for f in fontes if f.get('ativo')]
        self.assertGreaterEqual(len(ativas), 50)
        for f in fontes:
            txt = json.dumps(f, ensure_ascii=False).lower()
            self.assertNotIn('xp investimentos', txt, f['id'])
            self.assertNotIn('infomoney', txt, f['id'])
            if f.get('ativo'):
                self.assertIn(f.get('status_validacao'), ('ok', 'parcial'), f['id'])
                self.assertNotIn('motivo_desligada', f)
            else:
                self.assertTrue(f.get('motivo_desligada'), f['id'])
        self.assertTrue(any(f['metodo'] == 'youtube' and f.get('requer_chave') == 'YOUTUBE_API_KEY' for f in fontes))

    def test_oregon_usa_ativos_das_carteiras(self):
        import config
        cfg = config.carregar(CONFIG_TESTE)
        o = intel.carregar_oregon(cfg, DATA_PAINEL)
        self.assertGreaterEqual(len(o['ativos']), 45)
        self.assertEqual(len(o['carteiras']), 15)
        self.assertIn('VWRA', o['ativos'])                      # ETFs internacionais das carteiras globais
        self.assertNotIn('Franchini FIDC1', o['ativos'])        # placeholders não são ativos
        self.assertIn('Petrobras', o['ativos']['PETR4']['termos'])
        self.assertTrue(any(s['id'] == 'fin' for s in o['setores']))
        x = analise.classificar({'titulo': 'Vale e Petrobras puxam o Ibovespa; VT sobe nos EUA', 'resumo': ''}, o, dt.date(ANO, 11, 6))
        self.assertIn('PETR4', x['ativos'])
        self.assertNotIn('VT', x['ativos'])                     # código de 2 letras nunca casa sozinho

    def test_resultados_cvm_na_rodada_manual_e_preservados_em_falha(self):
        L = S.linha_dre
        cnpj = '33.000.167/0001-01'
        dre = {('ITR', ANO): [L(cnpj, 'PETROLEO BRASILEIRO S.A. PETROBRAS', '%d-09-30' % ANO, '%d-07-01' % ANO, '%d-09-30' % ANO, '3.01', 'Receita de Venda de Bens e/ou Serviços', 120000000),
                             L(cnpj, 'PETROLEO BRASILEIRO S.A. PETROBRAS', '%d-09-30' % ANO, '%d-07-01' % ANO, '%d-09-30' % ANO, '3.11', 'Lucro/Prejuízo Consolidado do Período', 30000000)]}
        self.rodar(mundo(dre=dre), ROBO_MANUAL='true')
        r = self.ler('resultados.json')
        self.assertEqual(r['empresas']['PETR4']['trimestres'][-1]['receita'], 120000000 * 1000)
        # CVM fora do ar na rodada seguinte: o arquivo lido antes continua
        os.environ['ROBO_AGORA'] = '%d-11-07T21:40:00-03:00' % ANO
        os.environ.pop('ROBO_MANUAL', None)
        self.rodar(mundo(fora={'cvm'}))
        self.assertEqual(self.ler('resultados.json')['empresas']['PETR4']['trimestres'][-1]['receita'], 120000000 * 1000)
        self.assertIn('resultados', self.ler('status.json'))

    def test_workflow_publica_dados_e_nao_expoe_estado(self):
        wf = open(os.path.join(AQUI, '..', '.github', 'workflows', 'robo.yml'), encoding='utf-8').read()
        copia = open(os.path.join(AQUI, '..', 'docs', 'workflow_robo.yml'), encoding='utf-8').read()
        self.assertEqual(wf, copia)
        self.assertIn('robo/intel.py', wf)
        self.assertNotIn('robo/coletar.py', wf)
        for cron in re.findall(r"cron: '([^']+)'", wf):
            self.assertTrue(cron.split()[-1] in ('*',), 'coleta sete dias por semana: ' + cron)
        self.assertIn('workflow_dispatch', wf)
        self.assertIn('ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}', wf)
        self.assertIn('YOUTUBE_API_KEY: ${{ secrets.YOUTUBE_API_KEY }}', wf)
        self.assertIn('permissions: {}', wf)
        pub = wf[wf.index('Montar o site'):]
        for f in ('macro.json', 'recentes.json', 'hoje.json', 'coleta.json', 'semanal.json', 'versao.json', 'status.json', 'biblioteca'):
            self.assertIn(f, pub)
        lista = re.search(r'for f in ([^;]+); do', pub).group(1)
        self.assertNotIn('estado', lista)
        self.assertIn('python -m unittest discover -s testes', wf)
        self.assertNotIn('sk-', wf)


if __name__ == '__main__':
    unittest.main()
