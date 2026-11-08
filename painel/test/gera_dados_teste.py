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
# v3.6 · indústria de wealth, regulação (CVM) e lente global do setor
vip_itens += [
    {'id': 'w1', 'titulo': 'CVM abre audiência pública sobre regras para consultores de valores mobiliários', 'link': 'https://www.gov.br/cvm/pt-br/assuntos/noticias/2026/cvm-audiencia-consultores', 'fonte': 'CVM · notícias', 'organizacao': 'CVM',
     'categoria': 'instituicao', 'pais': 'Brasil', 'idioma': 'pt', 'tipo': 'documento_oficial', 'publicado_em': '2026-11-06T15:00-03:00', 'detectado_em': '2026-11-06T15:30-03:00', 'ativos': [], 'industria': 'wealth', 'industria_secao': 'regulacao', 'temas': [], 'regras': 36},
    {'id': 'w2', 'titulo': 'RIA M&A hits record as advisors seek scale', 'link': 'https://www.investmentnews.com/ria-news/ria-ma-record/100', 'fonte': 'InvestmentNews', 'organizacao': 'InvestmentNews',
     'categoria': 'veiculo', 'pais': 'EUA', 'idioma': 'en', 'tipo': 'noticia', 'publicado_em': '2026-11-05T12:00-03:00', 'detectado_em': '2026-11-05T12:30-03:00', 'ativos': [], 'industria': 'wealth', 'temas': [], 'regras': 36},
    {'id': 'l1', 'titulo': 'Pulp prices rise in China as hardwood supply tightens', 'link': 'https://news.teste/pulp-china', 'fonte': 'Reuters', 'organizacao': 'Reuters', 'categoria': 'veiculo', 'pais': 'Global', 'idioma': 'en', 'tipo': 'noticia',
     'publicado_em': '2026-11-07T08:00-03:00', 'detectado_em': '2026-11-07T08:30-03:00', 'ativos': [], 'setor_de': ['KLBN4'], 'setor_nome': 'Celulose no mundo', 'lente': True, 'temas': [], 'regras': 36}]
# v3.7 · evento corporativo (recompra) e mudança de recomendação (a mesma casa, visão anterior no acervo)
_dir = lambda t, ev=None: {t: {'tipo': 'direto', 'motivo': 'a manchete trata do ativo', 'evento': ev}}
vip_itens += [
    {'id': 'e1', 'titulo': 'Itaúsa aprova programa de recompra de até 50 milhões de ações', 'link': 'https://veiculo.teste/itausa-recompra', 'fonte': 'Valor Econômico', 'organizacao': 'Valor Econômico', 'categoria': 'veiculo',
     'pais': 'Brasil', 'idioma': 'pt', 'tipo': 'noticia', 'publicado_em': '2026-11-07T18:00-03:00', 'detectado_em': '2026-11-07T18:20-03:00', 'ativos': ['ITSA4'], 'vinculos': _dir('ITSA4'), 'eventos': ['recompra'],
     'natureza': 'noticia', 'temas': [], 'regras': 37},
    {'id': 'op_old', 'titulo': 'Itaú BBA reitera compra para Klabin (KLBN4) com preço-alvo de R$ 25', 'link': 'https://veiculo.teste/klabin-itau-set', 'fonte': 'Money Times', 'organizacao': 'Money Times', 'categoria': 'veiculo',
     'pais': 'Brasil', 'idioma': 'pt', 'tipo': 'noticia', 'publicado_em': '2026-09-10T09:00-03:00', 'detectado_em': '2026-09-10T09:20-03:00', 'ativos': ['KLBN4'], 'vinculos': _dir('KLBN4', 'recomendacao'),
     'natureza': 'opiniao_casa', 'casas': ['Itaú BBA'], 'posicao': 'favoravel', 'recomendacao': 'Compra', 'preco_alvo': 'R$ 25,00', 'temas': [], 'regras': 37},
    {'id': 'op_new', 'titulo': 'Itaú BBA corta preço-alvo da Klabin (KLBN4) para R$ 22 e rebaixa para neutro', 'link': 'https://veiculo.teste/klabin-itau-nov', 'fonte': 'Money Times', 'organizacao': 'Money Times', 'categoria': 'veiculo',
     'pais': 'Brasil', 'idioma': 'pt', 'tipo': 'noticia', 'publicado_em': '2026-11-06T11:00-03:00', 'detectado_em': '2026-11-06T11:20-03:00', 'ativos': ['KLBN4'], 'vinculos': _dir('KLBN4', 'recomendacao'),
     'natureza': 'opiniao_casa', 'casas': ['Itaú BBA'], 'posicao': 'contraria', 'recomendacao': 'Neutro', 'preco_alvo': 'R$ 22,00', 'temas': [], 'regras': 37}]
rec['itens'] = vip_itens + rec['itens']
rec['n'] = len(rec['itens'])
with open(os.path.join(dados, 'recentes.json'), 'w', encoding='utf-8') as f:
    json.dump(rec, f, ensure_ascii=False)
# v3.6 · proventos, fundos, termômetro das cartas e clássico da semana, pelas funções do robô com arquivos de teste
import test_v36 as T6  # noqa: E402
import fundos as _fundos, proventos as _prov, cartas as _cartas  # noqa: E402
_or = intel.carregar_oregon(cfg_real)
_cfgp = json.loads(json.dumps(cfg_real)); _cfgp['intel']['proventos']['pausa_seg'] = 0
_b3 = {}
for _raiz in {t[:4] for t in _or['ativos'] if len(t) in (5, 6)}:
    _b3[_prov.url_empresa(_raiz)] = [{'cashDividends': [dict(e, isinCode=e['isinCode'].replace('PETR', _raiz), assetIssued=e['assetIssued'].replace('PETR', _raiz)) for e in T6.B3_PETR[0]['cashDividends']]
                                     + [dict(e, isinCode=e['isinCode'].replace('PETRACNPR', _raiz + 'CDAM').replace('PETRACNOR', _raiz + 'XXXXX'), assetIssued='') for e in T6.B3_PETR[0]['cashDividends'][1:3]]}]
with mock.patch('sys.stdout', io.StringIO()):
    _pv = _prov.atualizar(_cfgp, _or, T6.RedeJSON(_b3), None, util.agora().date(), util.agora(), {}, {}, log_=lambda *a: None)
    _cda = T6.CDA.replace('VALE3', 'ALOS3') + 'CLASSES - FIF;55.555.555/0001-55;DELTA FIA;2026-07-31;Ações;Ação ordinária;LREN3;450000\n'
    _fd = _fundos.atualizar(cfg_real, _or, T6.RedeJSON({_fundos.BASE: T6.LISTAGEM.encode(), _fundos.BASE + 'cda_fi_202607.zip': T6.zip_de({'cda_fi_BLC_4_202607.csv': _cda}), _fundos.REGISTRO: T6.zip_de(T6.REG)}),
                            util.agora().date(), util.agora(), {}, {}, manual=True, log_=lambda *a: None, dormir=lambda s: None)
# v3.8 · fluxo dos fundos pelas funções do robô, com o informe diário e o cadastro de teste
import test_v38 as T8  # noqa: E402
import fluxo as _fluxo  # noqa: E402
_fx = _fluxo.atualizar(cfg_real, T8.rede_fluxo(), util.agora().date(), util.agora(), {}, {}, manual=True, log_=lambda *a: None, dormir=lambda s: None)
with open(os.path.join(dados, 'biblioteca', 'fluxo_fundos.json'), 'w', encoding='utf-8') as f:
    json.dump(_fx, f, ensure_ascii=False)
with open(os.path.join(dados, 'biblioteca', 'proventos.json'), 'w', encoding='utf-8') as f:
    json.dump(_pv, f, ensure_ascii=False)
with open(os.path.join(dados, 'biblioteca', 'fundos_acoes.json'), 'w', encoding='utf-8') as f:
    json.dump(_fd, f, ensure_ascii=False)
_mes = util.agora().strftime('%Y-%m')
_tc = {'gerado_em': util.agora().isoformat(timespec='minutes'), 'meses': [{'mes': _mes, 'n_lidas': 2, 'cartas': [
    {'id': 'c1', 'titulo': 'Carta Mensal de teste', 'gestora': 'Gestora Teste A', 'link': 'https://gestora.teste/carta-a.pdf', 'data': '2026-11-05', 'lida': True, 'motivo': None, 'n_empresas': 3},
    {'id': 'c2', 'titulo': 'Carta Trimestral de teste', 'gestora': 'Gestora Teste B', 'link': 'https://gestora.teste/carta-b.pdf', 'data': None, 'lida': True, 'motivo': None, 'n_empresas': 2},
    {'id': 'c3', 'titulo': 'Carta em imagem', 'gestora': 'Gestora Teste C', 'link': 'https://gestora.teste/carta-c.pdf', 'data': None, 'lida': False, 'motivo': 'PDF sem texto', 'n_empresas': 0}],
    'empresas': [{'t': 'PETR4', 'nome': 'Petrobras', 'carteira': 'oregon', 'vip_tambem': True, 'n_cartas': 2, 'mencoes': 5, 'gestoras': ['Gestora Teste A', 'Gestora Teste B'], 'cartas': ['c1', 'c2'],
                  'trechos': [{'carta': 'c1', 'gestora': 'Gestora Teste A', 'link': 'https://gestora.teste/carta-a.pdf', 'data': '2026-11-05', 'texto': 'Aumentamos a posição em Petrobras (PETR4), que segue pagando dividendos acima do custo de capital.'}]},
                 {'t': 'VALE3', 'nome': 'Vale', 'carteira': 'vip', 'vip_tambem': False, 'n_cartas': 1, 'mencoes': 2, 'gestoras': ['Gestora Teste A'], 'cartas': ['c1']},
                 {'t': 'WEGE3', 'nome': 'WEGE3', 'carteira': None, 'vip_tambem': False, 'n_cartas': 1, 'mencoes': 1, 'gestoras': ['Gestora Teste B'], 'cartas': ['c2']}]},
    {'mes': '2026-10', 'n_lidas': 1, 'cartas': [{'id': 'c4', 'titulo': 'Carta de outubro de teste', 'gestora': 'Gestora Teste A', 'link': 'https://gestora.teste/carta-out.pdf', 'data': '2026-10-08', 'lida': True, 'motivo': None, 'n_empresas': 1}],
     'empresas': [{'t': 'PETR4', 'nome': 'Petrobras', 'carteira': 'oregon', 'vip_tambem': True, 'n_cartas': 1, 'mencoes': 1, 'gestoras': ['Gestora Teste A'], 'cartas': ['c4'], 'trechos': []}]}], 'nota': 'dados de teste'}
with open(os.path.join(dados, 'biblioteca', 'cartas_mencoes.json'), 'w', encoding='utf-8') as f:
    json.dump(_tc, f, ensure_ascii=False)
_dq = estante.destaque_semana(est, ['Cost of capital and discount rates', 'Equity risk premium today'], util.agora().date(), {})
if _dq:
    with open(os.path.join(dados, 'biblioteca', 'estante_destaque.json'), 'w', encoding='utf-8') as f:
        json.dump(_dq, f, ensure_ascii=False)
os.remove(os.path.join(dados, 'estado.json'))  # o site nunca recebe o estado interno
shutil.copy(os.path.join(RAIZ, 'site', 'index.html'), os.path.join(saida, 'index.html'))
shutil.copy(T.FONTES_TESTE, os.path.join(dados, 'fontes.json'))
print('site de teste em', saida, '·', sorted(os.listdir(dados)))
