# -*- coding: utf-8 -*-
"""Testes da v3.8 (08/11/2026): fontes em pausa depois de falhas seguidas, cartas da SPX no Issuu e fluxo dos fundos.
Simulado = rede e arquivos de mentira; os formatos seguem o que foi conferido (CVM: informe diário e cadastro pós-175;
Issuu: links relativos e título "CARTA À EQUIPE - 10.26"). Nada aqui prova que o GitHub alcança os sites."""
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

import biblioteca  # noqa: E402
import intel  # noqa: E402
import json  # noqa: E402
import conteudo  # noqa: E402
import fluxo  # noqa: E402
import fundos  # noqa: E402
import util  # noqa: E402
from test_v36 import AGORA, HOJE, RedeJSON, cfg_real, zip_de  # noqa: E402

# cadastro pós-175: classe de ações, multimercado, um fundo de cotas de ações (fica de fora) e renda fixa
REG_CLASSES = {'registro_fundo.csv': 'ID_Registro_Fundo;CNPJ_Fundo;Gestor\n1;11.111.111/0001-11;Gestora Alfa\n',
               'registro_classe.csv': ('ID_Registro_Fundo;ID_Registro_Classe;CNPJ_Classe;Denominacao_Social;Classificacao;Classe_Cotas\n'
                                       '1;10;11.111.111/0001-11;ALFA FIA;Ações;N\n'
                                       '1;11;22.222.222/0001-22;BETA MULTI;Multimercado;N\n'
                                       '1;12;33.333.333/0001-33;GAMA FIC FIA;Ações;S\n'
                                       '1;13;44.444.444/0001-44;DELTA RF;Renda Fixa;N\n')}
CAB = 'TP_FUNDO_CLASSE;CNPJ_FUNDO_CLASSE;ID_SUBCLASSE;DT_COMPTC;VL_TOTAL;VL_QUOTA;VL_PATRIM_LIQ;CAPTC_DIA;RESG_DIA;NR_COTST\n'
INF_OUT = CAB + ('CLASSES - FIF;11.111.111/0001-11;;2026-10-30;0;1;1000000000.00;5000000.00;2000000.00;100\n'
                 'CLASSES - FIF;33.333.333/0001-33;;2026-10-30;0;1;900000000.00;4000000.00;0;80\n'      # FIC: fora
                 'CLASSES - FIF;44.444.444/0001-44;;2026-10-30;0;1;2000000000.00;1000000.00;9000000.00;50\n')
INF_NOV = CAB + ('CLASSES - FIF;11.111.111/0001-11;;2026-11-03;0;1;1001000000.00;1000000.00;4000000.00;100\n'
                 # multimercado só com subclasses (soma) e uma classe sem cadastro (Outros)
                 'CLASSES - FIF;22.222.222/0001-22;SUB1;2026-11-03;0;1;300000000.00;2000000.00;500000.00;10\n'
                 'CLASSES - FIF;22.222.222/0001-22;SUB2;2026-11-03;0;1;200000000.00;1000000.00;0;10\n'
                 'CLASSES - FIF;55.555.555/0001-55;;2026-11-03;0;1;50000000.00;0;300000.00;5\n'
                 # classe com a linha da classe E das subclasses: vale a da classe
                 'CLASSES - FIF;11.111.111/0001-11;;2026-11-04;0;1;1002000000.00;3000000.00;0;100\n'
                 'CLASSES - FIF;11.111.111/0001-11;A;2026-11-04;0;1;600000000.00;2000000.00;0;60\n'
                 'CLASSES - FIF;11.111.111/0001-11;B;2026-11-04;0;1;402000000.00;1000000.00;0;40\n')


def fonte(fid):
    with open(os.path.join(AQUI, '..', 'robo', 'fontes.json'), encoding='utf-8') as fh:
        return [x for x in json.load(fh)['fontes'] if x['id'] == fid][0]


def rede_fluxo():
    return RedeJSON({fundos.REGISTRO: zip_de(REG_CLASSES), fundos.INF.format(m='202610'): zip_de({'inf_diario_fi_202610.csv': INF_OUT}),
                     fundos.INF.format(m='202611'): zip_de({'inf_diario_fi_202611.csv': INF_NOV})})


class TestFluxoDosFundos(unittest.TestCase):
    def test_cadastro(self):
        m, dg = fluxo.mapa_classes(zip_de(REG_CLASSES))
        self.assertEqual(m['11111111000111'], 'A')
        self.assertEqual(m['22222222000122'], 'M')
        self.assertEqual(m['33333333000133'], 'Af', 'fundo de cotas marcado')
        self.assertEqual(m['44444444000144'], 'R')

    def test_cadastro_sem_coluna_vira_diagnostico(self):
        m, dg = fluxo.mapa_classes(zip_de({'registro_classe.csv': 'CNPJ_Classe;Outra\n1;2\n'}))
        self.assertEqual(m, {})
        self.assertIn('colunas', dg)

    def test_informe_diario(self):
        m, _ = fluxo.mapa_classes(zip_de(REG_CLASSES))
        dias, dg = fluxo.ler_inf(zip_de({'x.csv': INF_NOV}), m)
        self.assertEqual(dias['2026-11-03']['multimercado'][:2], [3000000.0, 500000.0], 'subclasses somadas')
        self.assertEqual(dias['2026-11-03']['outros'][1], 300000.0, 'sem cadastro vai para Outros')
        self.assertEqual(dias['2026-11-04']['acoes'][0], 3000000.0, 'linha da classe vale; subclasses não somam de novo')
        dias2, dg2 = fluxo.ler_inf(zip_de({'x.csv': INF_OUT}), m)
        self.assertEqual(dias2['2026-10-30']['acoes'][:2], [5000000.0, 2000000.0], 'FIC de ações fica de fora')
        self.assertEqual(dg2['fic_fora'], 1)

    def test_colunas_desconhecidas(self):
        dias, dg = fluxo.ler_inf(zip_de({'x.csv': 'A;B\n1;2\n'}), {})
        self.assertEqual(dias, {})
        self.assertIn('erro', dg)

    def test_rodada_semanas_meses_e_uma_vez_por_dia(self):
        tmp = tempfile.mkdtemp(); self.addCleanup(shutil.rmtree, tmp, True)
        with mock.patch.dict(os.environ, {'ROBO_DADOS': tmp}):
            est, r = {}, rede_fluxo()
            out = fluxo.atualizar(cfg_real(), r, HOJE, AGORA, est, {}, log_=lambda *a: None, dormir=lambda s: None)
            self.assertEqual(out['lido']['meses'], ['2026-10', '2026-11'])
            sem = {s['de']: s for s in out['semanas']}
            self.assertAlmostEqual(sem['2026-11-02']['c']['acoes'], -3000000.0 + 3000000.0)  # 03/11: −3 mi; 04/11: +3 mi
            self.assertAlmostEqual(sem['2026-10-26']['c']['renda_fixa'], -8000000.0)
            mes = {x['mes']: x for x in out['meses']}
            self.assertAlmostEqual(mes['2026-10']['c']['acoes'], 3000000.0)
            self.assertNotIn('11111111000111', str(out), 'CNPJ e cadastro não são publicados')
            # mesma data: não baixa de novo
            r.chamadas.clear()
            self.assertIsNone(fluxo.atualizar(cfg_real(), r, HOJE, AGORA + dt.timedelta(hours=2), est, out, log_=lambda *a: None, dormir=lambda s: None))
            self.assertEqual(r.chamadas, [])
            # CVM fora no dia seguinte: nada é publicado por cima do que já existe
            r2 = RedeJSON({})
            self.assertIsNone(fluxo.atualizar(cfg_real(), r2, HOJE + dt.timedelta(days=1), AGORA + dt.timedelta(days=1), est, out, log_=lambda *a: None, dormir=lambda s: None))

    def test_semanas_antigas_ficam(self):
        pub = {'semanas': [{'de': '2025-01-06', 'ate': '2025-01-12', 'c': {'acoes': -1.0}, 'dias': 5}], 'meses': [{'mes': '2025-01', 'c': {'acoes': -1.0}, 'pl': {}, 'dias': 20}], 'dias': []}
        tmp = tempfile.mkdtemp(); self.addCleanup(shutil.rmtree, tmp, True)
        with mock.patch.dict(os.environ, {'ROBO_DADOS': tmp}):
            out = fluxo.atualizar(cfg_real(), rede_fluxo(), HOJE, AGORA, {}, pub, manual=True, log_=lambda *a: None, dormir=lambda s: None)
        self.assertEqual(out['semanas'][0]['de'], '2025-01-06')
        self.assertEqual(out['meses'][0]['mes'], '2025-01')


class TestFontesEmPausa(unittest.TestCase):
    def test_contador_de_falhas_seguidas(self):
        col = {}
        for i in range(3):
            biblioteca.registrar(col, 'x', 'X', erro='HTTP 403', marca='2026-11-08T1%d:00-03:00' % i)
        self.assertEqual(col['x']['seguidas'], 3)
        biblioteca.registrar(col, 'x', 'X', marca='2026-11-09T10:00-03:00')
        self.assertEqual(col['x']['seguidas'], 0)
        # registro de versão anterior (sem contador): estima pelo histórico
        self.assertEqual(biblioteca.falhas_seguidas({'erros': 5, 'ultimo_erro_em': '2026-11-08T19:20-03:00', 'ultima_ok': None}), 5)
        self.assertEqual(biblioteca.falhas_seguidas({'erros': 5, 'ultimo_erro_em': '2026-11-08T10:00-03:00', 'ultima_ok': '2026-11-08T12:00-03:00'}), 0)


    def test_rodada_pula_fonte_em_pausa_e_tenta_no_dia_seguinte(self):
        tmp = tempfile.mkdtemp(); self.addCleanup(shutil.rmtree, tmp, True)
        f = {'id': 'squadra-teste', 'nome': 'Squadra teste', 'metodo': 'rss', 'url_coleta': 'https://squadra.teste/feed/', 'categoria': 'gestora_brasil', 'ativo': True}
        pedidos = []

        class Rede:
            pausadas = set()

            def get(self, fonte, url, **k):
                pedidos.append(url)
                raise util.ErroFonte(fonte, 'bloqueio', 'HTTP 403')

            def sem_tempo(self):
                return False

            def falha(self, nome, tipo, det):
                return util.ErroFonte(nome, tipo, det)
        with mock.patch.dict(os.environ, {'ROBO_DADOS': tmp}):
            os.makedirs(os.path.join(tmp, 'biblioteca'))
            col = {}
            for h in (6, 5, 4, 3, 2):
                biblioteca.registrar(col, 'squadra-teste', 'Squadra teste', erro='Squadra teste: acesso bloqueado (403)', marca=(AGORA - dt.timedelta(hours=h)).isoformat(timespec='minutes'))
            util.gravar('coleta.json', {'fontes': col})
            _, erros, ok, coleta = intel.coletar_conteudo(cfg_real(), [f], {'ativos': {}}, Rede(), HOJE, AGORA, {}, {}, log_=lambda *a: None)
            self.assertEqual(pedidos, [], 'em pausa: nem tenta')
            self.assertIn('Squadra teste', coleta['rodadas'][-1]['em_pausa'])
            self.assertEqual(erros, [])
            _, erros, ok, coleta = intel.coletar_conteudo(cfg_real(), [f], {'ativos': {}}, Rede(), HOJE + dt.timedelta(days=1), AGORA + dt.timedelta(days=1), {}, {}, log_=lambda *a: None)
            self.assertTrue(pedidos, 'passadas 24 h, a fonte é tentada de novo')
            self.assertEqual(len(erros), 1)


class TestSpxNoIssuu(unittest.TestCase):
    def test_links_relativos_e_mes_pelo_titulo(self):
        f = fonte('spx-capital-carta-equipe')
        html = ('<a href="/spx_capital/docs/carta_equipe_-_10.26_88cb3c6ecc0822">CARTA À EQUIPE - 10.26</a>'
                '<a href="/spx_capital/docs/letter_to_the_team_-_10.26_ef85455b935e51">LETTER TO THE TEAM - 10.26</a>'
                '<a href="/spx_capital/docs/carta_equipe_-_09.26">CARTA À EQUIPE - 09.26</a>')

        class R:
            pausadas = set()

            def get(self, fonte, url, **k):
                return html.encode('utf-8')

            def falha(self, nome, tipo, det):
                return util.ErroFonte(nome, tipo, det)
        itens, n = conteudo.pagina(R(), f, AGORA, set())
        tit = {x['titulo']: x for x in itens}
        self.assertEqual(sorted(tit), ['CARTA À EQUIPE - 09.26', 'CARTA À EQUIPE - 10.26'], 'só a versão em português')
        self.assertEqual(tit['CARTA À EQUIPE - 10.26']['referencia'], '2026-10')
        self.assertTrue(tit['CARTA À EQUIPE - 10.26']['link'].startswith('https://issuu.com/spx_capital/docs/'))

    def test_cnn_desligada_com_motivo(self):
        f = fonte('imprensa-cnn-brasil-economia')
        self.assertFalse(f['ativo'])
        self.assertIn('404', f['motivo_desligada'])


if __name__ == '__main__':
    unittest.main()
