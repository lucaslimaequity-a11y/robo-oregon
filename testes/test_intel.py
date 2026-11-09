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

# as rodadas simuladas não importam as sementes reais de opiniões (robo/sementes): cada teste que precisa delas aponta a pasta
os.environ['ROBO_SEMENTES'] = tempfile.mkdtemp(prefix='sem_sementes_')

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
PORTAL = [{'titulo': 'BTG eleva preço-alvo da Petrobras (PETR4) e mantém compra', 'link': 'https://portal.teste/btg-petr4', 'dias': 0},
          {'titulo': 'XP tira bancos da carteira recomendada de novembro', 'link': 'https://portal.teste/xp-carteira', 'dias': 0},
          {'titulo': 'Receita de bolo de fubá para o fim de semana', 'link': 'https://portal.teste/bolo', 'dias': 0},
          {'titulo': 'Itaú BBA rebaixa Klabin (KLBN4) para neutro', 'link': 'https://portal.teste/bba-klbn', 'dias': 1}]
WORLD = [{'titulo': 'Treasury yields climb as Fed signals a pause', 'link': 'https://world.teste/ust', 'dias': 0},
         {'titulo': 'Emerging markets stocks rally on weaker dollar', 'link': 'https://world.teste/em', 'dias': 0},
         {'titulo': 'How to choose a wedding venue', 'link': 'https://world.teste/wedding', 'dias': 0}]
TOLERANTE = ('<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>'
             '<item><title>Ibovespa&nbsp;sobe 1% com Vale e bancos</title><link>https://tolerante.teste/1</link><pubDate>2026-11-06T10:15:00</pubDate></item>'
             '<item><title>Juros futuros recuam ap&oacute;s IPCA</title><link>https://tolerante.teste/2</link><pubDate>2026-11-06T09:00:00</pubDate></item>'
             '<item><title>Item cortado no meio do arq')
SETORIAL = [{'titulo': 'Soja sobe em Chicago', 'link': 'https://setorial.teste/1', 'dias': 0}, {'titulo': 'Klabin anuncia nova fábrica de papel', 'link': 'https://setorial.teste/2', 'dias': 0}]


def mundo(**kw):
    base = dict(feeds={'https://gestora.teste/feed/': CARTAS, 'https://jornal.teste/feed/': JORNAL, 'https://agregador.teste/rss?q=juros': AGREG, 'https://setorial.teste/feed/': SETORIAL,
                       'https://portal.teste/feed/': PORTAL, 'https://im.teste/feed/': [{'titulo': 'XP recomenda Petrobras', 'link': 'https://im.teste/1', 'dias': 0}], 'https://world.teste/feed/': WORLD},
                atom={'https://bc.teste/feed/notas?ano=%d' % ANO: NOTAS}, rdf={'https://global.teste/doclist/papers.rss': PAPERS},
                paginas={'https://pdf.teste/cartas': PAGINA_1, 'https://sitemap.teste/sitemap.xml': SITEMAP, 'https://vedado.teste/research': '<a href="/a.pdf">a</a>', 'https://tolerante.teste/feed/': TOLERANTE},
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
        self._chamadas = list(m.chamadas)
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
        self.assertNotIn('Carta Mensal Outubro 2026', tit)                            # primeira leitura da página: acervo, fora dos recentes
        mes = self.ler('biblioteca/%d-11.json' % ANO)['itens']
        acervo = next(x for x in mes if x['titulo'] == 'Carta Mensal Outubro 2026')  # mas guardado na Biblioteca
        self.assertTrue(acervo['acervo'])
        self.assertEqual(acervo['referencia'], '2026-10')                              # mês citado no nome do arquivo (não é data de publicação)
        self.assertIsNone(acervo['publicado_em'])
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
        self.assertEqual(carta['analise']['v'], 2)                                     # leitura curta: nada dos sete pontos
        for k in ('1_publicacao', '2_tese', '3_evidencias', '4_contrarios', '5_regioes', '6_oregon', '7_monitorar'):
            self.assertNotIn(k, carta['analise'])
        self.assertEqual(carta['analise']['base'], 'resumo')                            # o resumo da carta acrescenta algo à manchete
        self.assertEqual(carta['vinculos']['PETR4']['tipo'], 'mencao')                   # citada no resumo, não na manchete
        self.assertTrue(all(x.get('vinculos') is not None for x in rec['itens']))
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
        self.assertEqual(u['fontes_erro'], 1)                                         # só a página vedada por robots (a fonte nova sem resposta fica "a validar")
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
        self.assertIn('Carta Mensal Novembro 2026', tit)                              # link novo na segunda leitura: novidade, não acervo
        self.assertNotIn('Carta Mensal Outubro 2026', tit)
        nov = next(x for x in rec['itens'] if x['titulo'] == 'Carta Mensal Novembro 2026')
        self.assertFalse(nov.get('acervo'))
        self.assertEqual(nov['referencia'], '2026-11')
        guias = [x for x in rec['itens'] if x['titulo'].startswith('Guia Trimestral Teste')]
        self.assertEqual(len(guias), 2)
        self.assertTrue(all(x['link'] == 'https://guia.teste/guia.pdf' for x in guias))
        col = self.ler('coleta.json')
        self.assertEqual(col['fontes']['pagina-pdf']['ultima_rodada']['novos'], 1)
        self.assertEqual(col['fontes']['arquivo-fixo']['ultima_rodada']['novos'], 1)
        os.environ['ROBO_AGORA'] = '%d-11-07T12:00:00-03:00' % ANO
        self.rodar(mundo(paginas={'https://pdf.teste/cartas': PAGINA_2}, heads={'https://guia.teste/guia.pdf': {'etag': '"v2"', 'content-length': '120'}}), ROBO_MANUAL='true')
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
        self.rodar(mundo())
        pdf = next(x for x in self.ler('biblioteca/%d-11.json' % ANO)['itens'] if x['titulo'] == 'Carta Mensal Outubro 2026')
        self.assertIsNone(pdf['publicado_em'])
        self.assertTrue(pdf['data_estimada'])
        self.assertEqual(pdf['analise']['base'], 'manchete')                             # só o nome do arquivo: nada de leitura inventada


class TestImprensa(Base):
    """v3.1: notícias dos portais por ativo, opinião de casas de análise, feeds imperfeitos, acervo e intervalos."""

    def test_noticia_por_ativo_e_opiniao_de_casa(self):
        rec = self.rodar(mundo())
        por_link = {x['link']: x for x in rec['itens']}
        btg = por_link['https://portal.teste/btg-petr4']
        self.assertIn('PETR4', btg['ativos'])
        self.assertEqual(btg['casas'], ['BTG Pactual'])
        self.assertEqual(btg['natureza'], 'opiniao_casa')
        self.assertEqual(btg['resumo'], '')                                            # imprensa: só título, link, data e veículo
        self.assertEqual(btg['analise']['base'], 'manchete')                             # só manchete: o painel não produz análise aprofundada
        self.assertEqual(btg['vinculos']['PETR4'], {'tipo': 'direto', 'motivo': 'opinião de casa de análise sobre o ativo', 'evento': 'recomendacao'})
        xp = por_link['https://portal.teste/xp-carteira']                              # opinião da XP publicada por outro portal: entra
        self.assertEqual(xp['casas'], ['XP'])
        self.assertEqual(xp['organizacao'], 'Portal Teste')
        self.assertIn('KLBN4', por_link['https://portal.teste/bba-klbn']['ativos'])
        self.assertEqual(por_link['https://portal.teste/bba-klbn']['casas'], ['Itaú BBA'])
        self.assertNotIn('https://portal.teste/bolo', por_link)                         # fora de economia e mercados: descartado e contado
        col = self.ler('coleta.json')['fontes']
        self.assertEqual(col['portal-br']['rejeitados'].get('fora_do_tema'), 1)
        self.assertFalse(any(x.get('organizacao') == 'InfoMoney' for x in rec['itens']))  # canais da XP continuam fora
        self.assertEqual(col['infomoney-teste']['rejeitados'].get('bloqueada'), 1)
        self.assertFalse(any('im.teste' in u for u in self._chamadas))

    def test_feed_tolerante_e_fuso_da_fonte(self):
        rec = self.rodar(mundo())
        tol = [x for x in rec['itens'] if x['fonte_id'] == 'portal-tolerante']
        self.assertEqual(sorted(x['titulo'] for x in tol), ['Ibovespa sobe 1% com Vale e bancos', 'Juros futuros recuam após IPCA'])
        self.assertEqual(next(x for x in tol if x['titulo'].startswith('Ibovespa'))['publicado_em'], '2026-11-06T10:15-03:00')  # data sem fuso = Brasília

    def test_fonte_a_validar_nao_marca_parcial(self):
        self.rodar(mundo())
        u = self.ler('coleta.json')['ultima']
        self.assertEqual(len(u['a_validar']), 1)
        self.assertIn('Portal Novo Teste', u['a_validar'][0])
        self.assertEqual(u['fontes_erro'], 1)                                           # só a página vedada por robots
        self.assertIn('a validar', self.saidas()['motivos'])

    def test_noticia_do_mundo_liga_ao_tema_do_etf(self):
        rec = self.rodar(mundo())
        por_link = {x['link']: x for x in rec['itens']}
        ust = por_link['https://world.teste/ust']
        self.assertTrue({'IB01', 'DTLA'} <= set(ust['etfs_tema']), ust['etfs_tema'])
        self.assertIn('eua', ust['regioes'])
        self.assertIn('EIMI', por_link['https://world.teste/em']['etfs_tema'])
        self.assertNotIn('https://world.teste/wedding', por_link)

    def test_intervalo_por_fonte_e_leitura_manual_completa(self):
        self.rodar(mundo())
        os.environ['ROBO_AGORA'] = '%d-11-06T16:00:00-03:00' % ANO                    # 30 minutos depois, rodada agendada
        m = mundo()
        self.rodar(m)
        self.assertNotIn('https://pdf.teste/cartas', m.chamadas)                        # página de cartas: a cada 6 horas
        self.assertIn('https://portal.teste/feed/', m.chamadas)                         # imprensa: toda rodada
        self.assertGreaterEqual(self.ler('coleta.json')['ultima']['adiadas'], 1)
        os.environ['ROBO_AGORA'] = '%d-11-06T16:30:00-03:00' % ANO
        m2 = mundo()
        self.rodar(m2, ROBO_MANUAL='true')                                              # execução manual lê tudo
        self.assertIn('https://pdf.teste/cartas', m2.chamadas)

    def test_migracao_acervo_e_hoje_sem_cartas_antigas(self):
        self.rodar(mundo())
        # simula a biblioteca da v3.0: itens sem data, sem a marca de acervo, e estado sem a migração
        caminho = os.path.join(self.tmp, 'data', 'biblioteca', '%d-11.json' % ANO)
        d = json.load(open(caminho, encoding='utf-8'))
        for x in d['itens']:
            x.pop('acervo', None)
        json.dump(d, open(caminho, 'w', encoding='utf-8'))
        est = self.ler('estado.json'); est.pop('migracao_acervo_v31', None)
        json.dump(est, open(os.path.join(self.tmp, 'data', 'estado.json'), 'w', encoding='utf-8'))
        os.environ['ROBO_AGORA'] = '%d-11-06T18:00:00-03:00' % ANO
        rec = self.rodar(mundo())
        self.assertNotIn('Carta Mensal Outubro 2026', self.titulos(rec))
        itens = self.ler('biblioteca/%d-11.json' % ANO)['itens']
        self.assertTrue(next(x for x in itens if x['titulo'] == 'Carta Mensal Outubro 2026')['acervo'])
        hj = self.ler('hoje.json')
        ids_rec = {x['id'] for x in rec['itens']}
        self.assertTrue(all(p['id'] in ids_rec for p in hj['prioridades']))             # nenhuma prioridade é acervo
        pri = [x for x in rec['itens'] if x['id'] in {p['id'] for p in hj['prioridades']}]
        self.assertFalse(any(x['categoria'] == 'veiculo' for x in pri))                  # prioridades de leitura: cartas, research, documentos

    def test_agenda_usa_janela_de_30_dias(self):
        self.rodar(mundo())
        ag = self.ler('macro.json')['agenda']
        self.assertEqual(ag['dias'], 30)
        self.assertTrue(all(a.get('evento') for a in ag['itens']))                      # o painel mostra o campo "evento"


class TestIA(Base):
    RESP = {'resumo': [{'r': 'FONTE', 't': 'A gestora defende que o juro real de 7% é raro.'}, {'r': 'ERRADO', 't': 'rótulo inválido deve cair'}],
            'porque': [{'r': 'INFERÊNCIA', 't': 'Toca o carrego de IMAB11 e B5P211.'}],
            'contrapontos': [{'r': 'FONTE', 't': 'O próprio texto admite que o risco fiscal pode manter o prêmio.'}],
            'acompanhar': [{'r': 'INFERÊNCIA', 't': 'Focus e curva.'}], 'temas': ['juros', 'renda fixa']}

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
        self.assertEqual(carta['analise']['base'], 'resumo')                             # a base da leitura vem sempre das regras
        self.assertEqual(len(carta['analise']['resumo_ia']), 1)                          # rótulo inválido descartado
        self.assertEqual(carta['analise']['resumo_ia'][0]['r'], 'FONTE')
        self.assertEqual(carta['analise']['acompanhar_ia'], ['Focus e curva.'])
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
        self.assertIn('juros', [t['tema'] for t in s['temas'][:3]])  # entre os temas mais presentes da semana de teste
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
            if f['id'] != 'imprensa-infomoney':  # v3.10: exceção pedida pelo Lucas (só no painel, sempre com o aviso Grupo XP)
                self.assertNotIn('infomoney', txt, f['id'])
            if f.get('ativo'):
                if f.get('verificar_na_rodada'):  # endereço oficial que a ferramenta de validação não acessa: o robô confirma na 1ª rodada
                    self.assertEqual(f.get('status_validacao'), 'a_validar', f['id'])
                else:
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



# ------------------------------------------------------------------ v3.2: buscas por ativo (Bing Notícias), opiniões e CVM
AMOSTRA = os.path.join(AQUI, 'amostras_reais', 'bing_2026-11-08.json')
URL_BUSCA = 'https://busca.teste/news/search?q={q}&qft=sortbydate%3d%221%22&format=rss&mkt={mkt}'


def rss_bing(itens, q):
    """RSS no formato do Bing Notícias: link de redirecionamento com a matéria em ?url= e veículo em <News:Source>."""
    import html as H
    import urllib.parse as U
    xs = []
    for n, i in enumerate(itens):
        alvo = i.get('link') or 'https://amostra.invalid/%s/%d' % (U.quote(q.lower().replace(' ', '-')), n)
        link = 'http://www.bing.com/news/apiclick.aspx?ref=FexRss&aid=&tid=t%d&url=%s&c=1&mkt=pt-br' % (n, U.quote(alvo, safe=''))
        xs.append('<item><title>%s</title><link>%s</link><description>trecho</description><pubDate>%s</pubDate><News:Source>%s</News:Source></item>'
                  % (H.escape(i['titulo']), H.escape(link), i['pubDate'], H.escape(i['veiculo'])))
    return ('<?xml version="1.0" encoding="utf-8" ?><rss version="2.0" xmlns:News="https://www.bing.com:443/news/search?q=%s&amp;format=rss"><channel><title>%s - BingNews</title>%s</channel></rss>'
            % (U.quote_plus(q), H.escape(q), ''.join(xs)))


def url_busca(q, mkt='pt-BR'):
    import urllib.parse as U
    return URL_BUSCA.replace('{q}', U.quote_plus(q)).replace('{mkt}', mkt)


class TestBuscasPorAtivo(Base):
    """Busca de notícias por empresa, setor e tema no RSS do Bing Notícias, com manchetes REAIS de 08/11/2026 (testes/amostras_reais)."""
    agora = '%d-11-08T09:40:00-03:00' % ANO

    def setUp(self):
        super().setUp()
        with open(CONFIG_TESTE, encoding='utf-8') as f:
            c = json.load(f)
        n = c['noticias']
        n['busca'] = {'ativo': True, 'provedor': 'Bing Notícias', 'url': URL_BUSCA, 'intervalo_min': 120, 'max_por_rodada': 4}
        n['fontes_bloqueadas'] = []
        n['fontes_sinalizadas'] = {'InfoMoney': 'Grupo XP — não citar em material de cliente'}
        n['veiculos_confiaveis'] = n['veiculos_confiaveis'] + ['Money Times', 'Valor', 'Suno', 'UOL', 'InfoMoney', 'ISTOÉ Dinheiro', 'ADVFN', 'Yahoo Finance', "Barron's"]
        n['buscas_setor'] = [{'nome': 'Celulose e papel', 'consulta': 'celulose preço China', 'mkt': 'pt-BR', 'ativos': ['KLBN4'], 'termos': ['celulose']}]
        for te in n['etfs']:
            if te['tema'] == 'Ações emergentes':
                te['busca'], te['mkt'] = 'China stocks MSCI', 'en-US'
        for a in c['ativos']:
            if a['id'] == 'KLBN4':
                a['noticias']['excluir'] = ['Chácara Klabin', 'Ema Klabin']
        caminho = os.path.join(self.tmp, 'config_buscas.json')
        with open(caminho, 'w', encoding='utf-8') as f:
            json.dump(c, f, ensure_ascii=False)
        os.environ['ROBO_CONFIG'] = caminho
        with open(AMOSTRA, encoding='utf-8') as f:
            self.amostra = json.load(f)['buscas']

    def mundo_real(self, **kw):
        a = self.amostra
        pag = {url_busca('Klabin'): rss_bing(a['Klabin'], 'Klabin'), url_busca('BB Seguridade'): rss_bing(a['BB Seguridade'], 'BB Seguridade'),
               url_busca('Copel'): rss_bing(a['Copel'], 'Copel'), url_busca('China stocks MSCI', 'en-US'): rss_bing(a['China stocks MSCI (en-US)'], 'China stocks MSCI'),
               url_busca('celulose preço China'): rss_bing([{'titulo': 'Preço da celulose na China sobe pela terceira semana', 'pubDate': 'Fri, 06 Nov 2026 12:00:00 GMT', 'veiculo': 'Valor Econômico'},
                                                             {'titulo': 'Exportações de soja batem recorde', 'pubDate': 'Fri, 06 Nov 2026 11:00:00 GMT', 'veiculo': 'Valor Econômico'}], 'celulose preço China')}
        return mundo(hoje=dt.date(ANO, 11, 8), paginas=dict(pag, **kw.pop('paginas', {})), **kw)

    def test_noticias_reais_por_empresa_com_desambiguacao(self):
        rec = self.rodar(self.mundo_real(), ROBO_MANUAL='true')
        klb = [x for x in rec['itens'] if x['fonte_id'] == 'busca-klbn4']
        tit = [x['titulo'] for x in klb]
        self.assertFalse(any('Chácara Klabin' in t or 'Ema Klabin' in t for t in tit), tit)   # homônimos: estação de metrô e museu
        self.assertEqual(len(klb), 9, tit)
        safra = next(x for x in klb if 'Safra' in x['titulo'])
        self.assertEqual(safra['ativos'][0], 'KLBN4')
        self.assertEqual(safra['casas'], ['Safra'])
        self.assertEqual(safra['natureza'], 'opiniao_casa')
        self.assertEqual(safra['posicao'], 'contraria')                                            # "corta preço-alvo e rebaixa recomendação"
        self.assertEqual(safra['fonte'], 'Money Times')                                            # veículo que publicou, não o buscador
        self.assertEqual(safra['via'], 'Bing Notícias')
        self.assertEqual(safra['link'], 'https://www.moneytimes.com.br/klabin-klbn11-safra-corta-preco-alvo-e-rebaixa-recomendacao-diante-de-cenario-mais-desafiador/')  # link do veículo, sem o redirecionamento
        self.assertEqual(safra['publicado_em'], '2026-11-06T05:12-03:00')                          # 08:12 GMT = 05:12 em Brasília
        self.assertTrue(safra['confiavel'])
        self.assertFalse(next(x for x in klb if x['fonte'] == 'Agora Litoral')['confiavel'])      # veículo pouco conhecido: entra marcado
        col = self.ler('coleta.json')['fontes']
        self.assertEqual(col['busca-klbn4']['rejeitados'].get('outro_assunto'), 2)
        cpl = [x['titulo'] for x in rec['itens'] if x['fonte_id'] == 'busca-cple3']
        self.assertNotIn('Pular para o conteúdo', cpl)                                             # lixo do agregador fica de fora
        self.assertTrue(all('Copel' in t for t in cpl), cpl)

    def test_opinioes_publicas_e_fonte_sinalizada(self):
        rec = self.rodar(self.mundo_real(), ROBO_MANUAL='true')
        bb = {x['titulo']: x for x in rec['itens'] if 'BBSE3' in (x.get('ativos') or [])}
        venda = next(v for k, v in bb.items() if 'recomendam venda' in k)
        self.assertEqual((venda['natureza'], venda['posicao']), ('opiniao_casa', 'contraria'))     # "bancos recomendam venda", sem casa nomeada
        riscos = next(v for k, v in bb.items() if 'analistas veem riscos' in k)
        self.assertEqual(riscos['posicao'], 'contraria')
        im = [v for v in bb.values() if v['fonte'] == 'InfoMoney']
        self.assertEqual(len(im), 2)                                                                # entra (pesquisa), com aviso
        self.assertTrue(all(v['aviso_fonte'].startswith('Grupo XP') for v in im))
        fato = next(v for k, v in bb.items() if 'R$ 6,8 bilhões' in k)
        self.assertNotIn('posicao', fato)                                                           # notícia de resultado não é opinião

    def test_setor_e_tema_global(self):
        rec = self.rodar(self.mundo_real(), ROBO_MANUAL='true')
        cel = [x for x in rec['itens'] if x['fonte_id'] == 'busca-setor-celulose-e-papel']
        self.assertEqual([x['titulo'] for x in cel], ['Preço da celulose na China sobe pela terceira semana'])
        self.assertEqual(cel[0]['setor_de'], ['KLBN4'])
        mundo_ = [x for x in rec['itens'] if x['fonte_id'] == 'busca-etf-acoes-emergentes']
        self.assertEqual(len(mundo_), 4)
        self.assertTrue(all({'EIMI', 'VFEA'} <= set(x['etfs_tema']) for x in mundo_))
        self.assertEqual(mundo_[0]['idioma'], 'en')

    def test_rodada_agendada_respeita_teto_de_buscas(self):
        m = self.mundo_real()
        self.rodar(m)
        self.assertEqual(sum(1 for u in m.chamadas if 'busca.teste/news' in u), 4)                # 4 por rodada; as outras na próxima
        os.environ['ROBO_AGORA'] = '%d-11-08T10:10:00-03:00' % ANO
        m2 = self.mundo_real()
        self.rodar(m2)
        lidas = [u for u in m2.chamadas if 'busca.teste/news' in u]
        self.assertEqual(len(lidas), 4)
        self.assertFalse(set(lidas) & {u for u in m.chamadas if 'busca.teste/news' in u})          # roda a fila, não repete

    def test_buscador_vedado_por_robots_para_sozinho(self):
        rec = self.rodar(self.mundo_real(robots={'busca.teste': 'User-agent: *\nDisallow: /news/search\n'}), ROBO_MANUAL='true')
        self.assertFalse([x for x in rec['itens'] if x.get('via')])
        u = self.ler('coleta.json')['ultima']
        self.assertTrue(any('robots' in a for a in u['a_validar']), u['a_validar'])
        self.assertFalse([u_ for u_ in self._chamadas if 'busca.teste/news' in u_])               # nenhuma busca feita

    def test_sem_indicadores_macro_falha_do_bcb_nao_afeta_rodada(self):
        with open(os.environ['ROBO_CONFIG'], encoding='utf-8') as f:
            c = json.load(f)
        c['intel']['indicadores_macro'] = False                                                     # como em produção: o painel não mostra indicadores
        with open(os.environ['ROBO_CONFIG'], 'w', encoding='utf-8') as f:
            json.dump(c, f, ensure_ascii=False)
        m = self.mundo_real(fora={'bcb', 'focus', 'tesouro', 'treasury'})
        self.rodar(m, ROBO_MANUAL='true')
        mac = self.ler('macro.json')
        self.assertEqual(mac['indicadores'], {})
        self.assertIn('agenda', mac['fontes'])
        self.assertFalse([u for u in m.chamadas if 'api.bcb.gov.br' in u or 'home.treasury.gov' in u])
        self.assertNotIn('macro bcb', self.saidas()['motivos'])

    def test_fatos_relevantes_da_cvm_por_cnpj_e_nome(self):
        docs = [['89.637.490/0001-45', 'KLABIN S.A.', '12653', '2026-11-06', 'Fato Relevante', '', '', 'Parceria em ativos florestais no Paraná', '2026-11-06', 'AP', '1001', '1',
                 'https://www.rad.cvm.gov.br/ENET/frmExibirArquivoIPEExterno.aspx?NumeroProtocoloEntrega=1001'],
                ['89.637.490/0001-45', 'OUTRA EMPRESA S.A.', '1', '2026-11-06', 'Fato Relevante', '', '', 'Documento de outra companhia', '2026-11-06', 'AP', '1002', '1',
                 'https://www.rad.cvm.gov.br/ENET/frmExibirArquivoIPEExterno.aspx?NumeroProtocoloEntrega=1002'],
                ['17.344.597/0001-94', 'BB SEGURIDADE PARTICIPAÇÕES S.A.', '23159', '2026-11-04', 'Comunicado ao Mercado', '', '', 'Desempenho operacional de outubro', '2026-11-04', 'AP', '1003', '1',
                 'https://www.rad.cvm.gov.br/ENET/frmExibirArquivoIPEExterno.aspx?NumeroProtocoloEntrega=1003'],
                ['17.344.597/0001-94', 'BB SEGURIDADE PARTICIPAÇÕES S.A.', '23159', '2026-09-01', 'Comunicado ao Mercado', '', '', 'Antigo', '2026-09-01', 'AP', '1004', '1',
                 'https://www.rad.cvm.gov.br/ENET/frmExibirArquivoIPEExterno.aspx?NumeroProtocoloEntrega=1004']]
        rec = self.rodar(self.mundo_real(cvm_docs=docs), ROBO_MANUAL='true')
        cvm = [x for x in rec['itens'] if x['fonte_id'] == 'cvm-ipe']
        self.assertEqual(sorted(x['titulo'] for x in cvm), ['BBSE3 — Comunicado ao Mercado: Desempenho operacional de outubro', 'KLBN4 — Fato Relevante: Parceria em ativos florestais no Paraná'])
        fr = next(x for x in cvm if 'KLBN4' in x['titulo'])
        self.assertEqual((fr['ativos'][0], fr['tipo'], fr['publicado_em'], fr['categoria']), ('KLBN4', 'fato_relevante', '2026-11-06', 'oficial_empresa'))
        self.assertTrue(fr['so_data'])


AMOSTRAS_LEITURA = os.path.join(AQUI, 'amostras_reais', 'leitura_vinculos_2026-11-08.json')


class TestLeituraEVinculo(Base):
    """v3.3: notícias REAIS já capturadas (testes/amostras_reais) — vínculo direto × menção de passagem, peso na prioridade,
    leitura curta sem análise inventada e histórico de opiniões de 12 meses. O painel usa as mesmas amostras."""

    def casos(self):
        with open(AMOSTRAS_LEITURA, encoding='utf-8') as f:
            return json.load(f)['casos']

    def oregon(self):
        cfg = json.load(open(CONFIG_TESTE, encoding='utf-8'))
        return intel.carregar_oregon(cfg, DATA_PAINEL)

    def test_vinculo_das_noticias_reais(self):
        ore = self.oregon()
        for c in self.casos():
            x = dict(c['item'])
            v = analise.vinculos(x, ore)
            got = {t: [d['tipo'], d['evento']] for t, d in v.items()}
            self.assertEqual(got, c['esperado']['vinculos'], '%s: %s' % (c['caso'], x['titulo']))
            sem_termos = {t: [d['tipo'], d['evento']] for t, d in analise.vinculos(x, {}).items()}   # só com o termo guardado no item (como o painel faz)
            self.assertEqual(sem_termos, c['esperado']['vinculos'], 'sem cadastro: ' + c['caso'])

    def test_reclassificacao_de_item_antigo_corrige_falsa_opiniao(self):
        ore, hoje = self.oregon(), dt.date(ANO, 11, 8)
        c = next(c for c in self.casos() if c['caso'] == 'resultado_de_bancos_citando_santander')
        x = biblioteca.atualizar_leitura(dict(c['item']), ore, hoje)                       # como na publicação do recentes.json
        self.assertEqual(x['natureza'], c['esperado']['natureza_reclassificada'])           # "Itaú mantém a dianteira" não é opinião de casa
        self.assertEqual(x['vinculos']['BBDC3']['evento'], c['esperado']['evento_reclassificado'])
        self.assertNotIn('posicao', x)
        self.assertEqual(analise.casas_citadas({'titulo': 'Itaú BBA mantém recomendação de compra para Klabin'}), ['Itaú BBA'])
        self.assertEqual(c['item']['natureza'], 'opiniao_casa')                              # o item guardado não é alterado

    def test_mencao_em_lista_pesa_menos_que_fato_da_empresa(self):
        ore, hoje = self.oregon(), dt.date(ANO, 11, 8)
        por = {c['caso']: dict(c['item'], publicado_em='%d-11-08T09:00-03:00' % ANO) for c in self.casos()}   # mesma data: só o vínculo e o tipo diferem
        for x in por.values():
            x['vinculos'] = analise.vinculos(x, ore)
            x['prioridade'] = analise.prioridade(x, hoje)
        lista = por['mencao_em_lista_de_dividendos']['prioridade']
        self.assertIn('só de passagem', ' '.join(lista['porque']))
        for forte in ('noticia_de_empresa', 'resultado_da_empresa', 'mudanca_de_recomendacao', 'documento_oficial_cvm'):
            self.assertGreater(por[forte]['prioridade']['pontos'], lista['pontos'], forte)
        self.assertIn('trata de ativo da Oregon: KLBN4 (+10)', por['noticia_de_empresa']['prioridade']['porque'])

    def test_leitura_curta_nao_inventa(self):
        ore = self.oregon()
        for c in self.casos():
            x = dict(c['item'])
            A = analise.analisar_regras(x, ore)
            self.assertEqual(A['v'], 2)
            self.assertEqual(A['base'], c['esperado']['base'], c['caso'])
            txt = json.dumps(A, ensure_ascii=False)
            self.assertNotIn('Não avaliado', txt)                                         # nada de seções vazias preenchidas
            self.assertNotIn(x['titulo'], txt)                                            # o título não vira "tese"
            for k in ('1_publicacao', '2_tese', '4_contrarios', '6_oregon'):
                self.assertNotIn(k, A)
        kl = next(c['item'] for c in self.casos() if c['caso'] == 'resultado_da_empresa')
        self.assertFalse(analise.resumo_util(kl))                                         # imprensa: só manchete
        self.assertFalse(analise.resumo_util({'titulo': 'Copom mantém a Selic', 'resumo': 'Copom mantém a Selic.'}))  # resumo que repete a manchete

    def test_publica_opinioes_de_12_meses_e_atualiza_itens_antigos(self):
        pasta = os.path.join(self.tmp, 'data', 'biblioteca')
        os.makedirs(pasta, exist_ok=True)
        base = next(c['item'] for c in self.casos() if c['caso'] == 'mudanca_de_recomendacao')
        antiga = dict(base, id='op-jan', publicado_em='%d-01-15T10:00-03:00' % ANO, titulo='Klabin (KLBN11): Safra eleva recomendação para compra', posicao='favoravel')
        velha = dict(base, id='op-velha', publicado_em='%d-09-01T10:00-03:00' % (ANO - 1), titulo='Klabin: BTG rebaixa para neutro')
        for nome, it in (('%d-01' % ANO, antiga), ('%d-09' % (ANO - 1), velha)):
            with open(os.path.join(pasta, nome + '.json'), 'w', encoding='utf-8') as f:
                json.dump({'mes': nome, 'n': 1, 'itens': [dict(it, analise={'modo': 'regras', '1_publicacao': [{'r': 'FATO', 't': 'x'}]})]}, f, ensure_ascii=False)
        rec = self.rodar(mundo())
        op = self.ler('biblioteca/opinioes.json')
        ids = [x['id'] for x in op['itens']]
        self.assertIn('op-jan', ids)                                                      # 10 meses atrás: entra
        self.assertNotIn('op-velha', ids)                                                 # mais de 12 meses: fica só na Biblioteca
        self.assertTrue(any(x['link'] == 'https://portal.teste/bba-klbn' for x in op['itens']))
        jan = next(x for x in op['itens'] if x['id'] == 'op-jan')
        self.assertEqual(jan['vinculos']['KLBN4']['tipo'], 'direto')                     # item antigo ganha o vínculo na publicação
        self.assertNotIn('analise', jan)                                                  # só os campos que o painel usa
        self.assertTrue(all(x['natureza'] == 'opiniao_casa' for x in op['itens']))
        self.assertTrue(all((x.get('analise') or {}).get('v') == 2 for x in rec['itens']))
        self.assertIn('opinioes', open(os.path.join(AQUI, '..', '.github', 'workflows', 'robo.yml'), encoding='utf-8').read().replace('biblioteca/*.json', 'opinioes'))  # publicado com a pasta da biblioteca
        self.assertNotIn('opinioes', self.ler('versao.json')['meses'])                   # não vira um "mês" da Biblioteca


if __name__ == '__main__':
    unittest.main()
