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
# v3.5 · Estante: só as sementes conferidas (rede de teste sem acesso às listagens) e itens com ativos da VG VIP
import json  # noqa: E402
import conteudo  # noqa: E402
import estante  # noqa: E402
with open(os.path.join(RAIZ, 'robo', 'config.json'), encoding='utf-8') as f:
    cfg_real = json.load(f)
class _SemRede:
    def get(self, fonte, url, timeout=20, tentativas=1, **kw):
        raise util.ErroFonte(fonte, 'nao_encontrado', 'rede de teste')
_r = _SemRede()
with mock.patch('sys.stdout', io.StringIO()):
    est = estante.atualizar(cfg_real, _r, conteudo.Robots(_r), util.agora().date(), util.agora(), {}, {}, log_=lambda *a: None)
with open(os.path.join(dados, 'biblioteca', 'estante.json'), 'w', encoding='utf-8') as f:
    json.dump(est, f, ensure_ascii=False)
with open(os.path.join(dados, 'recentes.json'), encoding='utf-8') as f:
    rec = json.load(f)
vip_itens = [
    {'id': 'vip1', 'titulo': 'Vale tem lucro de US$ 2,4 bilhões no 3º trimestre e eleva dividendos', 'link': 'https://veiculo.teste/vale-3t26', 'fonte': 'Valor Econômico', 'organizacao': 'Valor Econômico', 'categoria': 'veiculo', 'pais': 'Brasil', 'idioma': 'pt', 'tipo': 'noticia',
     'publicado_em': '2026-11-06T19:10-03:00', 'detectado_em': '2026-11-06T19:30-03:00', 'ativos': [], 'ativos_vip': ['VALE3'], 'vinculos_vip': {'VALE3': {'tipo': 'direto', 'motivo': 'a manchete trata do resultado da empresa', 'evento': 'resultado'}}, 'natureza': 'noticia', 'temas': [], 'regras': 36},
    {'id': 'vip2', 'titulo': 'BTG eleva recomendação de Lojas Renner para compra; preço-alvo de R$ 18', 'link': 'https://veiculo.teste/renner-btg', 'fonte': 'Money Times', 'organizacao': 'Money Times', 'categoria': 'veiculo', 'pais': 'Brasil', 'idioma': 'pt', 'tipo': 'noticia',
     'publicado_em': '2026-11-07T10:05-03:00', 'detectado_em': '2026-11-07T10:20-03:00', 'ativos': [], 'ativos_vip': ['LREN3'], 'vinculos_vip': {'LREN3': {'tipo': 'direto', 'motivo': 'opinião de casa de análise sobre o ativo', 'evento': 'recomendacao'}},
     'natureza': 'opiniao_casa', 'casas': ['BTG Pactual'], 'posicao': 'favoravel', 'recomendacao': 'Compra', 'preco_alvo': 'R$ 18,00', 'temas': [], 'regras': 36},
    {'id': 'vip3', 'titulo': 'Sabesp conclui emissão de debêntures de R$ 3 bilhões', 'link': 'https://veiculo.teste/sabesp-deb', 'fonte': 'Brazil Journal', 'organizacao': 'Brazil Journal', 'categoria': 'veiculo', 'pais': 'Brasil', 'idioma': 'pt', 'tipo': 'noticia',
     'publicado_em': '2026-11-07T16:40-03:00', 'detectado_em': '2026-11-07T17:00-03:00', 'ativos': [], 'ativos_vip': ['SBSP3'], 'vinculos_vip': {'SBSP3': {'tipo': 'direto', 'motivo': 'a manchete trata do ativo', 'evento': None}}, 'natureza': 'noticia', 'temas': [], 'regras': 36},
]
rec['itens'] = vip_itens + rec['itens']
rec['n'] = len(rec['itens'])
with open(os.path.join(dados, 'recentes.json'), 'w', encoding='utf-8') as f:
    json.dump(rec, f, ensure_ascii=False)
os.remove(os.path.join(dados, 'estado.json'))  # o site nunca recebe o estado interno
shutil.copy(os.path.join(RAIZ, 'site', 'index.html'), os.path.join(saida, 'index.html'))
shutil.copy(T.FONTES_TESTE, os.path.join(dados, 'fontes.json'))
print('site de teste em', saida, '·', sorted(os.listdir(dados)))
