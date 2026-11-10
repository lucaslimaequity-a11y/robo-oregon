# -*- coding: utf-8 -*-
"""Testes da v4.0.1: Assuntos do momento (robo/assuntos.py, robo/assuntos.json, data/biblioteca/assuntos.json), a mesma
regra de palavras no painel (INTEL.assuntosDe, conferida rodando o JavaScript de verdade com o Node) e os ETFs de renda
fixa do Brasil (busca do tema de hora em hora no pregão, fora do teto, ata do Copom e riscos fiscais).
Simulado = itens e rodada de mentira dentro do teste; nada aqui prova o que o GitHub publica.
Rodar na pasta do projeto:  python -m unittest discover -s testes -v"""
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, '..', 'robo'))

import assuntos  # noqa: E402
import intel  # noqa: E402
from test_intel import Base, mundo  # noqa: E402

RAIZ = os.path.join(AQUI, '..')
BRT = dt.timezone(dt.timedelta(hours=-3))
AGORA = dt.datetime(2026, 11, 10, 9, 0, tzinfo=BRT)
DEFS = assuntos.carregar_definicoes()
COMP = assuntos.compilar(DEFS)

TITULOS = [
    'Petróleo cai após Trump sinalizar moderação em relação ao Irã', 'Petrobras irá pagar dividendos em dezembro',
    'IA generativa e a China', 'ia ficar para depois', 'AI trade buckles as Nvidia slides', 'Chinesa compra soja do Brasil',
    'Brazil Iron Ore Production Cuts Spread', 'Vale amplia mineração circular', 'Minério de ferro sobe em Dalian',
    'Dólar fecha estável, a R$ 5,50; Ibovespa sobe', 'Bitcoin Falls Below USD 74,500', 'China atinge superávit comercial recorde',
    'Governo promete superávit primário em 2027', 'Ata do Copom: BC vê economia perder força', 'Fed’s Waller backs December hike',
    'FedEx corta previsão', 'Eleições de meio de mandato nos EUA', 'Treasury yields rise as CPI data tests outlook',
    'Pré-sal bate recorde de produção', 'Combustíveis sobem nos postos', 'Data centers puxam consumo de energia', 'Star Wars ganha novo filme',
    'Inflação implícita sobe na curva', 'IGP-M desacelera em outubro', 'Safra de café deve crescer', 'OPEP+ mantém cortes', 'Rússia ataca Ucrânia',
    'Irã e EUA retomam conversas', 'IRÃ', 'Câmbio: real se valoriza', 'Copom mantém Selic em 15%', '', None,
]


def item(titulo, horas=1.0, **kw):
    t = AGORA - dt.timedelta(hours=horas)
    x = {'id': 'i%s' % abs(hash((titulo, horas))), 'titulo': titulo, 'link': 'https://x.teste/%d' % abs(hash((titulo, horas))), 'organizacao': 'Valor Econômico',
         'publicado_em': t.isoformat(timespec='minutes')}
    x.update(kw)
    return x


class TestPalavras(unittest.TestCase):
    def ach(self, t):
        return assuntos.assuntos_de(t, COMP)

    def test_lista_conferivel(self):
        self.assertEqual(len(DEFS), 12)
        self.assertEqual(len({a['id'] for a in DEFS}), 12)
        nomes = [a['nome'] for a in DEFS]
        for n in ('Petróleo', 'Minério de ferro', 'China', 'Copom e Selic', 'Inflação', 'Fiscal', 'Eleições', 'Agro'):
            self.assertIn(n, nomes)

    def test_normalizar(self):
        self.assertEqual(assuntos.normalizar('Pré-sal: Petróleo & Câmbio!'), 'pre sal petroleo cambio')
        self.assertEqual(assuntos.normalizar(None), '')

    def test_casos(self):
        self.assertEqual(self.ach('Petróleo cai após Trump sinalizar moderação em relação ao Irã'), ['petroleo', 'guerra'])
        self.assertEqual(self.ach('Petrobras irá pagar dividendos em dezembro'), [], '"irá" não é o Irã; Petrobras não é petróleo')
        self.assertEqual(self.ach('IA generativa e a China'), ['china', 'ia'])
        self.assertEqual(self.ach('ia ficar para depois'), [], '"ia" minúsculo é verbo')
        self.assertEqual(self.ach('Chinesa compra soja do Brasil'), ['china', 'agro'], 'chin* pega chinesa')
        self.assertEqual(self.ach('Minério de ferro sobe em Dalian'), ['minerio'])
        self.assertEqual(self.ach('Bitcoin Falls Below USD 74,500'), [], 'USD sozinho não é o assunto dólar')
        self.assertEqual(self.ach('China atinge superávit comercial recorde'), ['china'], 'superávit comercial não é fiscal')
        self.assertEqual(self.ach('Governo promete superávit primário em 2027'), ['fiscal'])
        self.assertEqual(self.ach('FedEx corta previsão'), [], 'FedEx não é o Fed')
        self.assertEqual(self.ach('Star Wars ganha novo filme'), ['guerra'], 'limite conhecido: palavra inteira "wars"')
        self.assertEqual(self.ach('Pré-sal bate recorde de produção'), ['petroleo'])
        self.assertEqual(self.ach('Copom mantém Selic em 15%'), ['copom'])

    def test_paridade_com_o_painel(self):
        """O mesmo título dá os mesmos assuntos no robô (Python) e no painel (JavaScript, painel/src/intel.js)."""
        if not shutil.which('node'):
            self.skipTest('node não instalado')
        js = ("const I=require(%s);const d=%s;const c=I.compilarAssuntos(d);const t=%s;"
              "process.stdout.write(JSON.stringify(t.map(x=>I.assuntosDe(x,c))));") % (
            json.dumps(os.path.join(RAIZ, 'painel', 'src', 'intel.js')), json.dumps(DEFS, ensure_ascii=False), json.dumps(TITULOS, ensure_ascii=False))
        out = subprocess.run(['node', '-e', js], capture_output=True, text=True, timeout=60)
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertEqual(json.loads(out.stdout), [assuntos.assuntos_de(t, COMP) for t in TITULOS])
        # amostras reais guardadas nos testes, quando existirem
        amostras = []
        pasta = os.path.join(AQUI, 'amostras_reais')
        for raiz, _d, arqs in os.walk(pasta):
            for a in arqs:
                if a.endswith('.json'):
                    try:
                        with open(os.path.join(raiz, a), encoding='utf-8') as f:
                            j = json.load(f)
                    except (ValueError, OSError):
                        continue
                    for x in (j if isinstance(j, list) else j.get('itens') or []) if isinstance(j, (list, dict)) else []:
                        if isinstance(x, dict) and x.get('titulo'):
                            amostras.append(x['titulo'])
        if amostras:
            js2 = js.replace(json.dumps(TITULOS, ensure_ascii=False), json.dumps(amostras[:400], ensure_ascii=False))
            out2 = subprocess.run(['node', '-e', js2], capture_output=True, text=True, timeout=60)
            self.assertEqual(json.loads(out2.stdout), [assuntos.assuntos_de(t, COMP) for t in amostras[:400]])


class TestContagem(unittest.TestCase):
    def base(self):
        # 7 dias anteriores: 400 itens, 20 de petróleo (5%), 40 de China (10%), 10 de eleições (2,5%)
        out = []
        for k in range(400):
            h = 30 + k * 0.4  # de 30 h a 190 h atrás (dentro dos 7 × 24 h antes das últimas 24 h)
            t = 'Petróleo sobe' if k < 20 else 'China cresce' if k < 60 else 'Eleição no Chile' if k < 70 else 'Bolsa fecha estável'
            out.append(item(t, h))
        return out

    def test_janela_24h_e_setas(self):
        it = self.base()
        # últimas 24 h: 100 itens; petróleo 15 (15%: sobe), China 4 (4%: cai), eleições 3 (3%: estável), Agro 6 sem nada antes (novo)
        for k in range(100):
            t = 'Petróleo despenca' if k < 15 else 'China desacelera' if k < 19 else 'Eleições no Chile' if k < 22 else 'Safra recorde' if k < 28 else 'Ibovespa sobe'
            it.append(item(t, 0.2 + k * 0.2))
        js = assuntos.calcular(it, AGORA, DEFS)
        j = js['janelas']['24h']
        self.assertEqual(j['total'], 100)
        self.assertEqual(j['comparacao']['total'], 400)
        a = j['assuntos']
        self.assertEqual((a['petroleo']['n'], a['petroleo']['tendencia']), (15, 'sobe'))
        self.assertAlmostEqual(a['petroleo']['razao'], 3.0)
        self.assertEqual((a['china']['n'], a['china']['tendencia']), (4, 'cai'))
        self.assertEqual(a['eleicoes']['tendencia'], 'estavel')
        self.assertEqual((a['agro']['n'], a['agro']['tendencia']), (6, 'novo'))
        self.assertEqual(a['minerio']['tendencia'], 'estavel', 'nada antes e nada agora')
        self.assertEqual(a['petroleo']['fatia'], 15.0)
        self.assertEqual(a['petroleo']['fatia_c'], 5.0)

    def test_sem_base(self):
        js = assuntos.calcular([item('Petróleo sobe', 1)] * 3 + [item('China', 30)] * 20, AGORA, DEFS)
        self.assertEqual(js['janelas']['24h']['assuntos']['petroleo']['tendencia'], 'sem_base')

    def test_poucos_itens_nao_viram_seta(self):
        it = self.base() + [item('Minério de ferro sobe', 1), item('Ibovespa', 2), item('Ibovespa', 3)]
        a = assuntos.calcular(it, AGORA, DEFS)['janelas']['24h']['assuntos']['minerio']
        self.assertEqual((a['n'], a['tendencia']), (1, 'novo' if a['n'] >= assuntos.N_MIN else 'estavel'))

    def test_datas(self):
        it = [item('Petróleo sobe', 1), {'titulo': 'Petróleo só com data', 'publicado_em': '2026-11-10'}, {'titulo': 'Petróleo no futuro', 'publicado_em': '2026-11-11T09:00-03:00'},
              {'titulo': 'Petróleo sem data'}]
        js = assuntos.calcular(it, AGORA, DEFS)
        # só com data = meio-dia de Brasília; até 6 h à frente conta (como no painel); o de amanhã e o sem data ficam fora
        self.assertEqual(js['dias']['2026-11-10']['n'].get('petroleo'), 2)
        self.assertEqual(js['janelas']['24h']['assuntos']['petroleo']['n'], 2)
        self.assertNotIn('2026-11-11', js['dias'])

    def test_historico_incremental(self):
        ant = assuntos.calcular([item('Petróleo sobe', 24 * 20)], AGORA - dt.timedelta(days=1), DEFS, dias_recalc=95)
        self.assertIn((AGORA - dt.timedelta(days=20)).date().isoformat(), ant['dias'])
        novo = assuntos.calcular([item('China cresce', 2)], AGORA, DEFS, anterior=ant)
        d20 = (AGORA - dt.timedelta(days=20)).date().isoformat()
        self.assertEqual(novo['dias'][d20]['n'].get('petroleo'), 1, 'dia antigo vem do arquivo anterior')
        self.assertEqual(novo['dias']['2026-11-10']['n'].get('china'), 1)
        self.assertEqual(novo['janelas']['30d']['assuntos']['petroleo']['n'], 1)
        # lista de palavras diferente: o histórico anterior não vale
        outro = [dict(a) for a in DEFS]
        outro[0] = dict(outro[0], palavras=outro[0]['palavras'] + ['oleo'])
        sem = assuntos.calcular([item('China cresce', 2)], AGORA, outro, anterior=ant)
        self.assertNotIn(d20, sem['dias'])

    def test_publicar_rele_95_dias_na_primeira_vez(self):
        pedidos = []

        def carregar(d):
            pedidos.append(d)
            return [item('Petróleo sobe', 3)]
        js = assuntos.publicar(AGORA, None, carregar, DEFS)
        self.assertEqual(pedidos, [95])
        self.assertTrue(js['historico_completo'])
        assuntos.publicar(AGORA + dt.timedelta(minutes=15), js, carregar, DEFS)
        self.assertEqual(pedidos, [95, 10])
        self.assertIn('Petróleo 1', assuntos.resumo(js))

    def test_ultimos(self):
        it = [item('Petróleo %d' % k, k * 0.1, resumo='não vai', ativos=['PETR4']) for k in range(30)]
        u = assuntos.calcular(it, AGORA, DEFS)['ultimos']['petroleo']
        self.assertEqual(len(u), assuntos.ULTIMOS)
        self.assertEqual(u[0]['titulo'], 'Petróleo 0')
        self.assertTrue(set(u[0]) <= set(assuntos.CAMPOS_ULT))


class TestRodadaPublicaAssuntos(Base):
    def test_rodada(self):
        m = mundo(feeds={'https://jornal.teste/feed/': [{'titulo': 'Petróleo dispara com tensão no Oriente Médio', 'link': 'https://jornal.teste/petroleo', 'dias': 0},
                                                         {'titulo': 'Ibovespa fecha em alta de 1,2% puxado por bancos', 'link': 'https://jornal.teste/ibov', 'dias': 0}]})
        self.rodar(m)
        js = self.ler('biblioteca/assuntos.json')
        self.assertEqual(js['marca'], assuntos.marca_definicoes(DEFS))
        self.assertEqual(set(js['janelas']), {'24h', '7d', '30d'})
        self.assertIn('assuntos do momento:', self.log)
        # o site copia data/biblioteca/*.json: o arquivo chega ao painel sem mexer no robo.yml
        with open(os.path.join(RAIZ, '.github', 'workflows', 'robo.yml'), encoding='utf-8') as f:
            self.assertIn('cp data/biblioteca/*.json _site/data/biblioteca/', f.read())

    def test_falha_nao_derruba_a_rodada(self):
        from unittest import mock
        with mock.patch.object(assuntos, 'publicar', side_effect=RuntimeError('x')):
            self.rodar(mundo())
        self.assertIn('assuntos do momento não publicados', self.log)


class TestRendaFixa(unittest.TestCase):
    def test_config(self):
        with open(os.path.join(RAIZ, 'robo', 'config.json'), encoding='utf-8') as f:
            cfg = json.load(f)
        por = {e['tema']: e for e in cfg['noticias']['etfs']}
        for tema in ('Juro real (IMA-B e NTN-B)', 'Prefixados (IRF-M)', 'Tesouro Selic', 'Crédito privado no Brasil'):
            self.assertEqual(por[tema].get('intervalo_pregao_min'), 60, tema)
            self.assertTrue(por[tema].get('fora_do_teto'), tema)
        for tema in ('Juro real (IMA-B e NTN-B)', 'Prefixados (IRF-M)'):
            self.assertIn('ata do Copom', por[tema]['termos'])
            self.assertIn('risco fiscal', por[tema]['termos'])
            self.assertIn('"ata do Copom"', por[tema]['busca'])
        self.assertIn('ata do Copom', por['Tesouro Selic']['termos'])
        for tema in ('Treasuries', 'Bitcoin'):
            self.assertNotIn('intervalo_pregao_min', por[tema])

    def test_fontes_de_busca(self):
        with open(os.path.join(RAIZ, 'robo', 'config.json'), encoding='utf-8') as f:
            cfg = json.load(f)
        fs = {f['id']: f for f in intel.fontes_de_busca(cfg)}
        pre = fs['busca-etf-prefixados-irf-m']
        self.assertEqual((pre['intervalo_min'], pre['intervalo_pregao_min'], pre['fora_do_teto']), (120, 60, True))
        tr = fs['busca-etf-treasuries']
        self.assertEqual((tr['intervalo_pregao_min'], tr['fora_do_teto']), (None, False))

    def test_no_pregao(self):
        self.assertTrue(intel.no_pregao(dt.datetime(2026, 11, 10, 10, 0, tzinfo=BRT)))
        self.assertTrue(intel.no_pregao(dt.datetime(2026, 11, 10, 13, 0, tzinfo=dt.timezone.utc)), '13h UTC = 10h em Brasília')
        self.assertFalse(intel.no_pregao(dt.datetime(2026, 11, 10, 19, 0, tzinfo=BRT)))
        self.assertFalse(intel.no_pregao(dt.datetime(2026, 11, 10, 8, 59, tzinfo=BRT)))
        self.assertFalse(intel.no_pregao(dt.datetime(2026, 11, 14, 11, 0, tzinfo=BRT)), 'sábado')

    def test_painel_usa_a_coluna_pela_propriedade(self):
        with open(os.path.join(RAIZ, 'painel', 'src', 'ui_oregon.js'), encoding='utf-8') as f:
            self.assertIn("h('aside', {class: 'ficha-news'}, A.noticiasPainel(t))", f.read())
        with open(os.path.join(RAIZ, 'painel', 'src', 'ui_v401.js'), encoding='utf-8') as f:
            js = f.read()
        self.assertIn("var MACRO_RF = ['juros', 'inflacao', 'fiscal']", js)
        self.assertIn('/^P[1-4]$/', js)


class TestPainel(unittest.TestCase):
    def test_build(self):
        with open(os.path.join(RAIZ, 'painel', 'build.py'), encoding='utf-8') as f:
            b = f.read()
        self.assertIn("'ui_v4.js', 'ui_v401.js', 'ui_v41.js', 'main.js'", b)
        self.assertIn("taxon['assuntos'] = _assuntos.carregar_definicoes()", b)
        with open(os.path.join(RAIZ, 'site', 'index.html'), encoding='utf-8') as f:
            html = f.read()
        self.assertIn('Assuntos do momento', html)
        self.assertIn('"assuntos":[{"id":"petroleo"', html)

    def test_barras_por_hora_sairam(self):
        with open(os.path.join(RAIZ, 'painel', 'src', 'ui_v4.js'), encoding='utf-8') as f:
            js = f.read()
        self.assertNotIn('diaPorHora', js)
        self.assertIn('(A.v4Hero || heroPadrao)', js)


if __name__ == '__main__':
    unittest.main()
