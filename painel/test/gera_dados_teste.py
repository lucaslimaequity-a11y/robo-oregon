# -*- coding: utf-8 -*-
"""Gera uma pasta de site de teste (index.html + data/) rodando o robô Oregon Intelligence contra a internet simulada
dos testes (testes/simulador.py). Nada aqui é conteúdo real: serve para percorrer o painel com arquivos no formato exato
que o robô publica. Uso: python painel/test/gera_dados_teste.py <pasta_saida>"""
import io
import os
import shutil
import sys
import urllib.request
from unittest import mock

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.join(AQUI, '..', '..')
sys.path.insert(0, os.path.join(RAIZ, 'testes'))
sys.path.insert(0, os.path.join(RAIZ, 'robo'))
import test_intel as T  # noqa: E402
import intel  # noqa: E402
import util  # noqa: E402

saida = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'painel', 'dist', 'site_teste'))
dados = os.path.join(saida, 'data')
if os.path.isdir(saida):
    shutil.rmtree(saida)
os.makedirs(dados)
os.environ.update({'ROBO_DADOS': dados, 'ROBO_CONFIG': T.CONFIG_TESTE, 'ROBO_FONTES': T.FONTES_TESTE, 'ROBO_OREGON': T.DATA_PAINEL})
for k in ('TELEGRAM_TOKEN', 'ANTHROPIC_API_KEY', 'YOUTUBE_API_KEY', 'ROBO_MODO'):
    os.environ.pop(k, None)
# duas rodadas: a primeira monta a biblioteca (com um item do mês anterior), a segunda detecta publicação nova e fecha a semana
antiga = [{'titulo': 'Carta 40 — O ciclo anterior e a disciplina de preço', 'link': 'https://gestora.teste/carta-40', 'dias': 40, 'resumo': 'Carta do trimestre anterior sobre valuation e paciência.'}]
for agora, kw in (('2026-11-06T15:30:00-03:00', dict(feeds={'https://gestora.teste/feed/': T.CARTAS + antiga})), ('2026-11-07T09:00:00-03:00', dict(paginas={'https://pdf.teste/cartas': T.PAGINA_2}))):
    os.environ['ROBO_AGORA'] = agora
    m = T.mundo(**kw)
    buf = io.StringIO()
    with mock.patch.object(urllib.request, 'urlopen', m), mock.patch.object(util.time, 'sleep', lambda s: None), mock.patch('sys.stdout', buf):
        assert intel.main() == 0, buf.getvalue()
os.remove(os.path.join(dados, 'estado.json'))  # o site nunca recebe o estado interno
shutil.copy(os.path.join(RAIZ, 'site', 'index.html'), os.path.join(saida, 'index.html'))
shutil.copy(T.FONTES_TESTE, os.path.join(dados, 'fontes.json'))
print('site de teste em', saida, '·', sorted(os.listdir(dados)))
