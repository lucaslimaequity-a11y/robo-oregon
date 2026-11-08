# -*- coding: utf-8 -*-
"""Utilidades comuns: horário de Brasília, formatação brasileira, arquivos e o acesso à rede.

A classe Rede concentra todas as chamadas HTTP do robô:
  - novas tentativas com espera crescente (1 s, 2 s, 4 s) e respeito ao Retry-After;
  - erro classificado (limite, bloqueio, chave, não encontrado, tempo, rede...), nunca uma mensagem com a URL
    (a URL pode conter chave);
  - disjuntor por fonte: só pausa uma fonte depois de 3 falhas seguidas que indiquem bloqueio ou limite;
    "ativo não encontrado" não pausa a fonte, porque é problema do ativo, não da fonte;
  - prazo total da rodada, para uma fonte travada não estourar o tempo do GitHub;
  - estatística por fonte (tentativas, acertos, falhas por tipo) para o relatório de cobertura.
"""
import datetime as dt
import html
import json
import os
import socket
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

BRT = dt.timezone(dt.timedelta(hours=-3))
UA = 'RoboOregon/2.0 (+https://github.com; coleta de dados publicos de mercado)'

TIPOS_ERRO = {
    'sem_chave': 'chave não configurada',
    'autenticacao': 'chave recusada (401)',
    'plano': 'ativo fora do plano da chave',
    'bloqueio': 'acesso bloqueado (403)',
    'limite': 'limite de requisições (429)',
    'nao_encontrado': 'ativo não encontrado na fonte (404)',
    'vazio': 'resposta sem dados',
    'formato': 'formato inesperado',
    'tempo': 'sem resposta (tempo esgotado)',
    'rede': 'falha de rede',
    'http': 'erro do servidor',
    'pausado': 'fonte pausada nesta rodada',
    'invalido': 'valor impossível (preço zero, negativo ou vazio)',
}
# Falhas que indicam problema da FONTE (e não do ativo): só estas contam para pausar a fonte.
FALHAS_DA_FONTE = ('limite', 'bloqueio', 'autenticacao', 'tempo', 'rede', 'http')


class ErroFonte(Exception):
    def __init__(self, fonte, tipo, detalhe=''):
        self.fonte, self.tipo, self.detalhe = fonte, tipo, str(detalhe or '')[:160]
        super().__init__('%s: %s%s' % (fonte, TIPOS_ERRO.get(tipo, tipo), (' · ' + self.detalhe) if self.detalhe else ''))


def agora():
    fixo = os.environ.get('ROBO_AGORA')  # usado nos testes
    return dt.datetime.fromisoformat(fixo).astimezone(BRT) if fixo else dt.datetime.now(BRT)


def log(*a):
    # uma linha por chamada: texto vindo de fora (manchetes, mensagens de erro) não pode abrir linha nova no log,
    # onde o GitHub interpretaria comandos do tipo "::comando::"
    print(' '.join(str(x) for x in a).replace('\r', ' ').replace('\n', ' '), flush=True)


def num(v, casas=2):
    """Formata no padrão brasileiro: 1.234,56."""
    if v is None:
        return '—'
    s = '{:,.{c}f}'.format(v, c=casas)
    return s.replace(',', 'X').replace('.', ',').replace('X', '.')


def sinal(v, casas=2, suf=''):
    if v is None:
        return '—'
    return ('+' if v > 0 else '−' if v < 0 else '') + num(abs(v), casas) + suf


def sem_acento(s):
    return ''.join(c for c in unicodedata.normalize('NFD', str(s or '')) if unicodedata.category(c) != 'Mn').lower().strip()


def br_data(iso):
    return '%s/%s/%s' % (iso[8:10], iso[5:7], iso[0:4]) if iso else '—'


def esc(s):
    return html.escape(str(s), quote=False)


def dados_dir():
    return os.environ.get('ROBO_DADOS') or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')


def ler(nome, padrao=None):
    try:
        with open(os.path.join(dados_dir(), nome), encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return padrao


def gravar(nome, obj):
    os.makedirs(dados_dir(), exist_ok=True)
    with open(os.path.join(dados_dir(), nome), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))


def finito(v):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    return v if v == v and v not in (float('inf'), float('-inf')) else None


class Rede:
    def __init__(self, prazo_seg=900, pausa_apos=3):
        self.fim = time.monotonic() + prazo_seg
        self.pausa_apos = pausa_apos
        self.stats = {}
        self.seguidas = {}
        self.pausadas = {}
        self.dormir = time.sleep

    def sem_tempo(self):
        return time.monotonic() > self.fim

    def _st(self, fonte):
        return self.stats.setdefault(fonte, {'tentativas': 0, 'ok': 0, 'falhas': {}})

    def acerto(self, fonte):
        self._st(fonte)['ok'] += 1
        self.seguidas[fonte] = 0

    def falha(self, fonte, tipo, detalhe=''):
        """Registra a falha e devolve o erro (para `raise rede.falha(...)`)."""
        st = self._st(fonte)
        st['falhas'][tipo] = st['falhas'].get(tipo, 0) + 1
        if tipo in FALHAS_DA_FONTE:
            self.seguidas[fonte] = self.seguidas.get(fonte, 0) + 1
            if self.seguidas[fonte] >= self.pausa_apos and fonte not in self.pausadas:
                self.pausadas[fonte] = tipo
        return ErroFonte(fonte, tipo, detalhe)

    def get(self, fonte, url, timeout=20, tentativas=3, cab=None, dados=None, tipo_403='bloqueio', bruto_erro=False):
        """Baixa `url`. Erros saem como ErroFonte classificado; a URL nunca aparece na mensagem."""
        if fonte in self.pausadas:
            st = self._st(fonte)
            st['falhas']['pausado'] = st['falhas'].get('pausado', 0) + 1
            raise ErroFonte(fonte, 'pausado', 'depois de falhas seguidas por ' + TIPOS_ERRO.get(self.pausadas[fonte], ''))
        if self.sem_tempo():
            raise self.falha(fonte, 'tempo', 'prazo da rodada esgotado')
        tipo, detalhe = 'rede', ''
        for i in range(tentativas):
            self._st(fonte)['tentativas'] += 1
            espera = 2 ** i
            try:
                h = {'User-Agent': UA, 'Accept': '*/*'}
                h.update(cab or {})
                rq = urllib.request.Request(url, headers=h, data=dados)
                with urllib.request.urlopen(rq, timeout=timeout) as r:
                    corpo = r.read()
                self.acerto(fonte)
                return corpo
            except urllib.error.HTTPError as e:
                code = e.code
                detalhe = 'HTTP %s' % code
                if bruto_erro:
                    try:
                        detalhe = 'HTTP %s · %s' % (code, e.read()[:200].decode('utf-8', 'replace'))
                    except Exception:
                        pass
                if code == 429:
                    tipo = 'limite'
                    try:
                        espera = max(espera, min(10, int(e.headers.get('Retry-After') or 0)))
                    except (TypeError, ValueError):
                        pass
                elif code == 401:
                    tipo = 'autenticacao'
                    break
                elif code == 402:
                    tipo = 'plano'
                    break
                elif code == 403:
                    tipo = tipo_403
                    break
                elif code == 404:
                    tipo = 'nao_encontrado'
                    break
                elif code >= 500:
                    tipo = 'http'
                else:
                    tipo = 'http'
                    break
            except (socket.timeout, TimeoutError):
                tipo, detalhe = 'tempo', ''
            except urllib.error.URLError as e:
                tipo, detalhe = ('tempo', '') if isinstance(getattr(e, 'reason', None), socket.timeout) else ('rede', type(e.reason).__name__ if getattr(e, 'reason', None) else '')
            except Exception as e:  # conexão interrompida etc.
                tipo, detalhe = 'rede', type(e).__name__
            if i < tentativas - 1 and not self.sem_tempo():
                self.dormir(min(espera, 10))
        raise self.falha(fonte, tipo, detalhe)

    def get_json(self, fonte, url, **kw):
        corpo = self.get(fonte, url, **kw)
        try:
            return json.loads(corpo.decode('utf-8'))
        except Exception:
            raise self.falha(fonte, 'formato', 'resposta não é JSON')

    def resumo(self):
        out = {}
        for f, st in sorted(self.stats.items()):
            out[f] = dict(st)
            out[f]['falhas'] = dict(st['falhas'])
            if f in self.pausadas:
                out[f]['pausada_por'] = self.pausadas[f]
        return out
