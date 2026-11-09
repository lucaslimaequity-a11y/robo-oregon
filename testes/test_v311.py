# -*- coding: utf-8 -*-
"""Testes da v3.11: corrente de rodadas (robo/corrente.py e a etapa "seguinte" do robo.yml) e a identidade do painel
(site/painel.json) que o Atualizar usa para trazer o painel novo. Simulado = API do GitHub de mentira dentro do teste.
Nada aqui prova que o GitHub dispara a próxima rodada; isso só se vê nas rodadas reais (aba Actions).
Rodar na pasta do projeto:  python -m unittest discover -s testes -v"""
import datetime as dt
import io
import json
import os
import re
import sys
import tempfile
import unittest
import urllib.error
from unittest import mock

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, '..', 'robo'))

import config  # noqa: E402
import corrente  # noqa: E402
from test_intel import Base, mundo  # noqa: E402

RAIZ = os.path.join(AQUI, '..')
UTC = dt.timezone.utc
BRT = corrente.BRT


def brt(h, m=0, dia=9):
    return dt.datetime(2026, 11, dia, h, m, tzinfo=BRT)


class TestRegras(unittest.TestCase):
    def test_intervalo_por_horario(self):
        c = corrente.ajustes({})
        self.assertEqual(corrente.intervalo_min(brt(5, 59), c), 30)
        self.assertEqual(corrente.intervalo_min(brt(6, 0), c), 15)
        self.assertEqual(corrente.intervalo_min(brt(14, 33), c), 15)
        self.assertEqual(corrente.intervalo_min(brt(22, 59), c), 15)
        self.assertEqual(corrente.intervalo_min(brt(23, 0), c), 30)
        self.assertEqual(corrente.intervalo_min(brt(2, 7), c), 30)
        self.assertEqual(corrente.intervalo_min(brt(14, 33), c, falhou=True), 60)
        # nunca mais de 60 min: a etapa "seguinte" tem 75 min de prazo no robo.yml
        self.assertEqual(corrente.intervalo_min(brt(2), corrente.ajustes({'intel': {'corrente': {'minutos_noite': 240}}})), 60)
        self.assertEqual(corrente.intervalo_min(brt(10), corrente.ajustes({'intel': {'corrente': {'minutos_dia': 1}}})), 5)
        # a hora vale em Brasília mesmo com a data em UTC (09:10 UTC = 06:10 em Brasília)
        self.assertEqual(corrente.intervalo_min(dt.datetime(2026, 11, 9, 9, 10, tzinfo=UTC), c), 15)
        c2 = corrente.ajustes({'intel': {'corrente': {'minutos_dia': 20, '_nota': 'x'}}})
        self.assertEqual(corrente.intervalo_min(brt(10), c2), 20)
        self.assertNotIn('_nota', c2)

    def test_espera(self):
        ini = brt(14, 0)
        self.assertEqual(corrente.espera_seg(ini, brt(14, 9), 15), 6 * 60)
        self.assertEqual(corrente.espera_seg(ini, brt(14, 20), 15), 0, 'rodada mais longa que o intervalo: dispara já')

    def test_resumo_para_o_painel(self):
        r = corrente.resumo({}, brt(14, 40))
        self.assertEqual(r, {'ativo': True, 'minutos': 15, 'proxima': '2026-11-09T14:55-03:00'})
        self.assertEqual(corrente.resumo({}, brt(23, 10))['proxima'], '2026-11-09T23:40-03:00')
        self.assertEqual(corrente.resumo({'intel': {'corrente': {'ativo': False}}}, brt(14)), {'ativo': False})

    def test_rodada_mais_nova(self):
        runs = [{'run_number': 41, 'status': 'queued', 'conclusion': None}, {'run_number': 40, 'status': 'in_progress', 'conclusion': None},
                {'run_number': 39, 'status': 'completed', 'conclusion': 'success'}]
        self.assertEqual(corrente.rodada_mais_nova(runs, 40)['run_number'], 41)
        self.assertIsNone(corrente.rodada_mais_nova(runs, 41), 'só rodadas mais velhas: esta segue a corrente')
        self.assertIsNone(corrente.rodada_mais_nova([{'run_number': 42, 'status': 'completed', 'conclusion': 'cancelled'}], 41), 'cancelada não conta')
        self.assertIsNone(corrente.rodada_mais_nova([], 1))
        self.assertIsNone(corrente.rodada_mais_nova([{'run_number': 42, 'head_branch': 'teste', 'status': 'queued', 'conclusion': None}], 41), 'rodada de outro ramo não conta')
        self.assertEqual(corrente.rodada_mais_nova([{'run_number': 42, 'head_branch': 'main', 'status': 'queued', 'conclusion': None}], 41)['run_number'], 42)

    def test_config(self):
        with open(os.path.join(RAIZ, 'robo', 'config.json'), encoding='utf-8') as f:
            cfg = json.load(f)
        cr = cfg['intel']['corrente']
        self.assertEqual((cr['ativo'], cr['minutos_dia'], cr['minutos_noite'], cr['minutos_apos_falha'], cr['dia_de'], cr['dia_ate']), (True, 15, 30, 60, 6, 23))
        self.assertEqual(config.validar(cfg), [])
        for k, v in (('ativo', 'sim'), ('minutos_dia', 2), ('minutos_noite', '30'), ('minutos_noite', 90), ('minutos_apos_falha', 120), ('dia_de', 23)):
            ruim = json.loads(json.dumps(cfg))
            ruim['intel']['corrente'][k] = v
            self.assertTrue(any('intel/corrente' in e for e in config.validar(ruim)), k)


class ApiFalsa:
    """A API do GitHub de mentira: a rodada atual, a lista de rodadas e o disparo."""
    def __init__(self, inicio, runs=None, falhar=None, erro=None, vezes=99):
        self.inicio, self.runs, self.falhar, self.chamadas, self.disparos = inicio, runs or [], falhar, [], []
        self.erro, self.vezes = erro or urllib.error.URLError('sem rede'), vezes

    def __call__(self, metodo, caminho, token, corpo=None):
        self.chamadas.append((metodo, caminho))
        if self.falhar and self.falhar in caminho and self.vezes > 0:
            self.vezes -= 1
            raise self.erro
        if metodo == 'GET' and caminho.endswith('/actions/runs/777'):
            return {'id': 777, 'run_number': 40, 'workflow_id': 99, 'run_started_at': self.inicio, 'created_at': self.inicio}
        if metodo == 'GET' and '/actions/workflows/99/runs' in caminho:
            return {'workflow_runs': self.runs}
        if metodo == 'POST' and caminho.endswith('/actions/workflows/99/dispatches'):
            self.disparos.append(corpo)
            return {}
        raise AssertionError(caminho)


class TestMain(unittest.TestCase):
    ENV = {'GITHUB_REPOSITORY': 'lucaslimaequity-a11y/robo-oregon', 'GITHUB_RUN_ID': '777', 'GH_TOKEN': 'tk-rodada', 'GITHUB_REF_NAME': 'main', 'COLETAR': 'success',
           'ROBO_CONFIG': os.path.join(RAIZ, 'robo', 'config.json')}

    def rodar(self, api, agora, **env):
        e = dict(self.ENV, **env)
        dormiu = []
        buf = io.StringIO()
        with mock.patch('sys.stdout', buf), mock.patch.object(corrente.time, 'sleep', lambda s: None):
            r = corrente.main(env=e, agora=lambda: agora, dormir=dormiu.append, api=api)
        self.assertEqual(r, 0, 'a corrente nunca deixa a rodada vermelha')
        return dormiu, buf.getvalue()

    def test_dispara_a_proxima_depois_do_intervalo(self):
        api = ApiFalsa('2026-11-09T17:30:00Z', runs=[{'run_number': 40, 'status': 'in_progress', 'conclusion': None}, {'run_number': 39, 'status': 'completed', 'conclusion': 'success'}])
        dormiu, log = self.rodar(api, dt.datetime(2026, 11, 9, 17, 39, tzinfo=UTC))   # começou 14:30, terminou 14:39
        self.assertEqual(dormiu, [6 * 60])
        self.assertEqual(api.disparos, [{'ref': 'main', 'inputs': {'modo': 'normal', 'corrente': 'true'}}])
        self.assertIn('Próxima às 14:45', log)

    def test_nao_dispara_se_ja_ha_rodada_mais_nova(self):
        api = ApiFalsa('2026-11-09T17:30:00Z', runs=[{'run_number': 41, 'event': 'schedule', 'status': 'queued', 'conclusion': None}])
        _d, log = self.rodar(api, dt.datetime(2026, 11, 9, 17, 50, tzinfo=UTC))
        self.assertEqual(api.disparos, [])
        self.assertIn('#41', log)

    def test_depois_de_falha_espera_uma_hora(self):
        api = ApiFalsa('2026-11-09T17:30:00Z')
        dormiu, _log = self.rodar(api, dt.datetime(2026, 11, 9, 17, 40, tzinfo=UTC), COLETAR='failure')
        self.assertEqual(dormiu, [50 * 60])
        self.assertEqual(len(api.disparos), 1)

    def test_madrugada_meia_hora(self):
        api = ApiFalsa('2026-11-09T05:07:00Z')   # 02:07 em Brasília
        dormiu, _log = self.rodar(api, dt.datetime(2026, 11, 9, 5, 15, tzinfo=UTC))
        self.assertEqual(dormiu, [22 * 60])

    def test_coleta_cancelada(self):
        # outra rodada tomou o lugar na fila: ela é mais nova e segue a corrente
        api = ApiFalsa('2026-11-09T17:30:00Z', runs=[{'run_number': 41, 'head_branch': 'main', 'status': 'in_progress', 'conclusion': None}])
        self.rodar(api, dt.datetime(2026, 11, 9, 18, 10, tzinfo=UTC), COLETAR='cancelled')
        self.assertEqual(api.disparos, [])
        # passou do prazo de 40 min e não há rodada mais nova: espera a hora de depois de falha e dispara
        api = ApiFalsa('2026-11-09T17:30:00Z', runs=[{'run_number': 40, 'head_branch': 'main', 'status': 'in_progress', 'conclusion': None}])
        dormiu, log = self.rodar(api, dt.datetime(2026, 11, 9, 18, 11, tzinfo=UTC), COLETAR='cancelled')
        self.assertEqual(dormiu, [19 * 60])
        self.assertEqual(len(api.disparos), 1)
        self.assertIn('a coleta foi cancelada', log)

    def test_dispara_sempre_no_main(self):
        api = ApiFalsa('2026-11-09T17:30:00Z')
        self.rodar(api, dt.datetime(2026, 11, 9, 17, 50, tzinfo=UTC), GITHUB_REF_NAME='teste')
        self.assertEqual(api.disparos[0]['ref'], 'main')

    def test_corrente_desligada_nao_chama_a_api(self):
        api = ApiFalsa('2026-11-09T17:30:00Z')
        fd, p = tempfile.mkstemp(suffix='.json')
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                json.dump({'intel': {'corrente': {'ativo': False}}}, f)
            _d, log = self.rodar(api, dt.datetime(2026, 11, 9, 17, 40, tzinfo=UTC), ROBO_CONFIG=p)
        finally:
            os.remove(p)
        self.assertEqual(api.chamadas, [])
        self.assertIn('desligada', log)

    def test_falha_da_api_vira_aviso_sem_rodada_vermelha(self):
        api = ApiFalsa('2026-11-09T17:30:00Z', falhar='/dispatches')
        _d, log = self.rodar(api, dt.datetime(2026, 11, 9, 17, 50, tzinfo=UTC))
        self.assertIn('::warning title=Corrente de rodadas::', log)
        self.assertEqual(sum(1 for c in api.chamadas if c[0] == 'POST'), 4, 'quatro tentativas antes de desistir')
        # resposta cortada no meio (http.client.IncompleteRead) também vira aviso, não traceback
        import http.client
        api = ApiFalsa('2026-11-09T17:30:00Z', falhar='/actions/runs/777', erro=http.client.IncompleteRead(b'{'))
        _d, log = self.rodar(api, dt.datetime(2026, 11, 9, 17, 50, tzinfo=UTC))
        self.assertIn('::warning title=Corrente de rodadas::', log)
        # falha passageira: a terceira tentativa passa e a rodada é disparada
        api = ApiFalsa('2026-11-09T17:30:00Z', falhar='/dispatches', vezes=2)
        self.rodar(api, dt.datetime(2026, 11, 9, 17, 50, tzinfo=UTC))
        self.assertEqual(len(api.disparos), 1)

    def test_fora_do_github_nao_faz_nada(self):
        api = ApiFalsa('2026-11-09T17:30:00Z')
        _d, log = self.rodar(api, dt.datetime(2026, 11, 9, 17, 40, tzinfo=UTC), GITHUB_RUN_ID='', GH_TOKEN='')
        self.assertEqual(api.chamadas, [])


class TestHttpDeVerdade(unittest.TestCase):
    """O mesmo fluxo por HTTP de verdade (servidor local no papel da API do GitHub): cabeçalhos, corpo do disparo e a
    resposta 204 sem corpo que o GitHub dá ao disparo."""
    def test_fluxo_http(self):
        import http.server
        import threading
        visto = []

        class H(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _json(self, obj):
                b = json.dumps(obj).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(b)))
                self.end_headers()
                self.wfile.write(b)

            def do_GET(self):
                visto.append(('GET', self.path, self.headers.get('Authorization'), self.headers.get('X-GitHub-Api-Version')))
                if self.path.endswith('/actions/runs/777'):
                    self._json({'run_number': 40, 'workflow_id': 99, 'run_started_at': '2026-11-09T17:30:00Z'})
                else:
                    self._json({'workflow_runs': [{'run_number': 40, 'status': 'in_progress', 'conclusion': None}]})

            def do_POST(self):
                n = int(self.headers.get('Content-Length') or 0)
                visto.append(('POST', self.path, self.headers.get('Authorization'), json.loads(self.rfile.read(n).decode('utf-8'))))
                self.send_response(204)
                self.end_headers()

        srv = http.server.HTTPServer(('127.0.0.1', 0), H)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        try:
            env = dict(TestMain.ENV)
            buf = io.StringIO()
            with mock.patch.object(corrente, 'API', 'http://127.0.0.1:%d' % srv.server_address[1]), mock.patch('sys.stdout', buf), \
                    mock.patch.dict(os.environ, {'no_proxy': '127.0.0.1,localhost', 'NO_PROXY': '127.0.0.1,localhost'}):
                r = corrente.main(env=env, agora=lambda: dt.datetime(2026, 11, 9, 17, 50, tzinfo=UTC), dormir=lambda s: None)
        finally:
            srv.shutdown()
            srv.server_close()
        self.assertEqual(r, 0)
        self.assertEqual([v[0] for v in visto], ['GET', 'GET', 'POST'], buf.getvalue())
        self.assertEqual(visto[0][1], '/repos/lucaslimaequity-a11y/robo-oregon/actions/runs/777')
        self.assertTrue(visto[1][1].startswith('/repos/lucaslimaequity-a11y/robo-oregon/actions/workflows/99/runs'))
        self.assertEqual(visto[2][1], '/repos/lucaslimaequity-a11y/robo-oregon/actions/workflows/99/dispatches')
        self.assertEqual(visto[0][2], 'Bearer tk-rodada')
        self.assertEqual(visto[0][3], '2022-11-28')
        self.assertEqual(visto[2][3], {'ref': 'main', 'inputs': {'modo': 'normal', 'corrente': 'true'}})
        self.assertIn('Próxima rodada disparada', buf.getvalue())


class TestWorkflow(unittest.TestCase):
    def setUp(self):
        with open(os.path.join(RAIZ, '.github', 'workflows', 'robo.yml'), encoding='utf-8') as f:
            self.wf = f.read()

    def test_etapa_seguinte(self):
        wf = self.wf
        seg = wf[wf.index('\n  seguinte:'):]
        for t in ('needs: [coletar, publicar]', 'if: ${{ !cancelled() }}', 'actions: write', 'contents: read', 'python3 robo/corrente.py',
                  'COLETAR: ${{ needs.coletar.result }}', 'GH_TOKEN: ${{ github.token }}', 'sparse-checkout: robo'):
            self.assertIn(t, seg, t)
        self.assertNotIn('secrets.', seg, 'a corrente não recebe nenhuma chave do Secrets')
        self.assertNotIn('contents: write', seg)

    def test_rodada_da_corrente_nao_e_manual(self):
        wf = self.wf
        self.assertIn("ROBO_MANUAL: ${{ github.event_name != 'schedule' && !(github.event_name == 'workflow_dispatch' && inputs.corrente) }}", wf)
        self.assertRegex(wf, r"corrente:\n\s+description: '[^']+'\n\s+type: boolean\n\s+default: false")

    def test_fila_na_coleta_e_na_publicacao(self):
        wf = self.wf
        self.assertNotIn('\nconcurrency:', wf, 'a fila não vale mais para a rodada inteira (a espera da corrente não segura o Coletar agora)')
        col = wf[wf.index('\n  coletar:'):wf.index('\n  publicar:')]
        pub = wf[wf.index('\n  publicar:'):wf.index('\n  seguinte:')]
        self.assertIn('group: robo-oregon\n', col)
        self.assertIn('group: robo-oregon-site\n', pub)
        self.assertEqual(re.findall(r'cancel-in-progress: (\w+)', wf), ['false', 'false'])


class TestIdentidadeDoPainel(unittest.TestCase):
    def test_painel_json_bate_com_o_painel(self):
        with open(os.path.join(RAIZ, 'site', 'painel.json'), encoding='utf-8') as f:
            pj = json.load(f)
        with open(os.path.join(RAIZ, 'site', 'index.html'), encoding='utf-8') as f:
            html = f.read()
        m = re.search(r'var PAINEL_BUILD = "([0-9a-f]{12})";', html)
        self.assertIsNotNone(m)
        self.assertEqual(pj['build'], m.group(1))
        with open(os.path.join(RAIZ, 'painel', 'build.py'), encoding='utf-8') as f:
            b = f.read()
        self.assertIn("'painel.json'", b)
        self.assertNotIn('datetime', b, 'a identidade não pode mudar a cada rodada (nada de data e hora no painel)')


class TestVersaoComCorrente(Base):
    def test_versao_json_traz_a_proxima(self):
        self.rodar(mundo())
        v = self.ler('versao.json')
        self.assertEqual(v['corrente']['ativo'], True)
        self.assertEqual(v['corrente']['minutos'], 15)   # 15:30 em Brasília: horário do dia
        self.assertEqual(v['corrente']['proxima'][:16], self.agora[:11] + '15:45')


if __name__ == '__main__':
    unittest.main()
