# -*- coding: utf-8 -*-
"""Leitura e validação de robo/config.json.

Tudo que muda com frequência fica na configuração: ativos e suas fontes, limites de alerta, alertas ligados ou
desligados, horários, buscas e veículos de notícias, séries do Banco Central e critérios de qualidade.
A página de administração (site/admin.html) usa as mesmas regras de validação antes de salvar.
Configuração inválida não roda: a rodada termina como CRÍTICA, com a lista de erros.
"""
import copy
import datetime as dt
import json
import os
import re

CLASSES = ('acao', 'fii', 'etf_rf', 'eua', 'cripto')
MERCADOS = ('B3', 'EUA', 'cripto')
PROVEDORES = ('brapi', 'yahoo', 'b3', 'tiingo', 'fred', 'coingecko', 'awesome', 'ptax', 'alphavantage')
DIAS = ('seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom')

PADRAO = {
    'agenda': {'dias': ['seg', 'ter', 'qua', 'qui', 'sex'], 'inicio': '08:00', 'fim': '19:30', 'intervalo_min': 30, 'fechamento': '21:00',
               'resumo_diario': '18:30', 'abertura_b3': '10:00', 'publicacao_b3': '21:00'},
    'alertas': {'fatores': True, 'ativos': True, 'indicadores': True, 'noticias': True, 'resumo_diario': True},
    'limites': {'fatores': {'selic': 0.01, 'pre': 0.15, 'real': 0.10, 'ust2': 0.10, 'ust10': 0.10, 'usd': 1.0, 'ibov': 1.5, 'sp': 1.5, 'em': 2.0, 'brent': 4.0, 'btc': 6.0},
                'ativos': {'acao': 4.0, 'fii': 2.5, 'etf_rf': 1.0, 'eua': 3.0, 'cripto': 6.0, 'outro': 3.0},
                'focus': {'IPCA': 0.10, 'Selic': 0.25, 'PIB Total': 0.10, 'Câmbio': 0.10}},
    'qualidade': {'completo_min_pct': 90, 'critico_abaixo_pct': 50, 'anomalia_pct': {'acao': 25, 'fii': 15, 'etf_rf': 8, 'eua': 15, 'cripto': 30, 'outro': 25},
                  'tolerancia_dias': {'fred': 2, 'tiingo': 1, 'ptax': 0, 'b3': 0}},
    'fontes_padrao': {'acao': ['yahoo', 'brapi'], 'fii': ['yahoo', 'brapi'], 'etf_rf': ['yahoo', 'brapi'], 'eua': ['yahoo', 'tiingo'], 'cripto': ['yahoo', 'tiingo']},
    'historico': {'anos': 2, 'horario': '21:00', 'min_pontos': 60, 'brapi_faixa': '3mo',
                  'fontes_padrao': {'acao': ['yahoo', 'brapi'], 'fii': ['yahoo', 'brapi'], 'etf_rf': ['yahoo', 'brapi'], 'eua': ['yahoo', 'tiingo'], 'cripto': ['yahoo', 'tiingo']},
                  'salto': {'acao': 35, 'fii': 25, 'etf_rf': 10, 'eua': 25, 'cripto': 40, 'outro': 30}},
    'b3_arquivos': {'ativo': False, 'anos': 2},
    'alphavantage': {'limite_dia': 20, 'so_fechamento': True},
    'noticias': {'intervalo_min': 60, 'por_tema': 6, 'maximo': 120, 'ibge': True, 'cvm': True, 'fontes_bloqueadas': [], 'veiculos_confiaveis': [], 'macro': [], 'ibge_temas': [],
                 'temas_macro': [], 'rss': [], 'etfs': []},
    'agenda_macro': {'dias': 14, 'ibge': True, 'ibge_produtos': [], 'copom': {}, 'fomc': {}},
    'resultados': {'ativo': True, 'intervalo_dias': 3, 'arquivos': 4},
    'intel': {'janela_dias': 10, 'janela_inicial_dias': 45, 'recentes_dias': 14, 'prazo_min': 12, 'telegram_digesto': True, 'telegram_hora': '07:30',
              'ia': {'ativo': False, 'max_itens_dia': 12, 'max_tokens_dia': 150000, 'max_tokens_item': 1200}},
    'prazo_rodada_min': 15,
    'feriados_b3': [],
}


def _mescla(base, extra):
    out = copy.deepcopy(base)
    for k, v in (extra or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _mescla(out[k], v)
        else:
            out[k] = v
    return out


def migrar(c):
    """Aceita a configuração antiga (ativos_b3 / ativos_eua) e converte para a lista única 'ativos'."""
    if 'ativos' in c:
        return c
    c = dict(c)
    ativos = []
    for a in c.pop('ativos_b3', []):
        b = {k: v for k, v in a.items() if k != 'busca'}
        b['mercado'] = 'B3'
        if a.get('busca'):
            b['noticias'] = {'busca': a['busca']}
        ativos.append(b)
    for a in c.pop('ativos_eua', []):
        b = dict(a)
        b['mercado'] = 'cripto' if a.get('classe') == 'cripto' else 'EUA'
        b['classe'] = 'cripto' if a.get('classe') == 'cripto' else 'eua'
        ativos.append(b)
    c['ativos'] = ativos
    return c


def carregar(caminho):
    with open(caminho, encoding='utf-8') as f:
        bruto = json.load(f)
    cfg = _mescla(PADRAO, migrar(bruto))
    for a in cfg.get('ativos', []):
        a.setdefault('mercado', 'B3' if a.get('classe') in ('acao', 'fii', 'etf_rf') else ('cripto' if a.get('classe') == 'cripto' else 'EUA'))
        a.setdefault('ativo', True)
        a.setdefault('fontes', list(cfg['fontes_padrao'].get(a.get('classe'), [])))
    return cfg


def _hora(s):
    return isinstance(s, str) and re.match(r'^([01]\d|2[0-3]):[0-5]\d$', s)


def validar(cfg):
    """Lista de erros em português (vazia = configuração válida)."""
    erros = []
    ids = set()
    if not isinstance(cfg.get('ativos'), list) or not cfg['ativos']:
        erros.append('"ativos" precisa ser uma lista com pelo menos um ativo')
    for i, a in enumerate(cfg.get('ativos') or []):
        rot = 'ativo %d (%s)' % (i + 1, a.get('id') or 'sem id')
        if not isinstance(a.get('id'), str) or not re.match(r'^[A-Z0-9][A-Z0-9.\-^=]{1,15}$', a['id']):
            erros.append('%s: código inválido (use letras maiúsculas e números, ex.: PETR4)' % rot)
        elif a['id'] in ids:
            erros.append('%s: código repetido' % rot)
        ids.add(a.get('id'))
        if a.get('classe') not in CLASSES:
            erros.append('%s: classe "%s" inválida (use %s)' % (rot, a.get('classe'), ', '.join(CLASSES)))
        if a.get('mercado') not in MERCADOS:
            erros.append('%s: mercado "%s" inválido (use %s)' % (rot, a.get('mercado'), ', '.join(MERCADOS)))
        for f in a.get('fontes') or []:
            if f.split(':')[0] not in PROVEDORES:
                erros.append('%s: fonte "%s" desconhecida (use %s)' % (rot, f, ', '.join(PROVEDORES)))
        if a.get('inicio'):
            try:
                dt.date.fromisoformat(a['inicio'])
            except (TypeError, ValueError):
                erros.append('%s: início "%s" não é uma data AAAA-MM-DD' % (rot, a['inicio']))
        if a.get('distribui') not in (True, False, None):
            erros.append('%s: "distribui" deve ser true, false ou null' % rot)
        if not a.get('nome'):
            erros.append('%s: falta o nome' % rot)
    L = cfg.get('limites') or {}
    for grupo in ('fatores', 'ativos', 'focus'):
        for k, v in (L.get(grupo) or {}).items():
            if not isinstance(v, (int, float)) or v <= 0:
                erros.append('limite %s/%s precisa ser um número maior que zero' % (grupo, k))
    ag = cfg.get('agenda') or {}
    for k in ('inicio', 'fim', 'fechamento', 'resumo_diario', 'abertura_b3', 'publicacao_b3'):
        if not _hora(ag.get(k)):
            erros.append('agenda/%s precisa estar no formato HH:MM' % k)
    if _hora(ag.get('inicio')) and _hora(ag.get('fim')) and ag['inicio'] >= ag['fim']:
        erros.append('agenda: o início precisa ser antes do fim')
    if ag.get('intervalo_min') not in (30, 60, 120):
        erros.append('agenda/intervalo_min precisa ser 30, 60 ou 120')
    if not set(ag.get('dias') or []) <= set(DIAS) or not ag.get('dias'):
        erros.append('agenda/dias precisa listar dias entre %s' % ', '.join(DIAS))
    for i, m in enumerate((cfg.get('noticias') or {}).get('macro') or []):
        if not m.get('consulta') or not m.get('tema'):
            erros.append('notícias/macro %d: precisa de "consulta" e "tema"' % (i + 1))
    if not isinstance((cfg.get('b3_arquivos') or {}).get('ativo', False), bool):
        erros.append('b3_arquivos/ativo precisa ser true ou false (sem aspas)')
    PROIBIDAS = ('fred:SP500', 'fred:BAMLH0A0HYM2', 'fred:VIXCLS')
    usadas = [f for a in cfg.get('ativos') or [] for f in (a.get('fontes') or [])]
    usadas += [f for x in (cfg.get('fatores_cotacao') or {}).values() for f in (x.get('fontes') or [])]
    usadas += [f for x in (cfg.get('series_fatores') or {}).values() for f in (x.get('fontes') or [])]
    for f in sorted(set(usadas) & set(PROIBIDAS)):
        erros.append('fonte "%s": série com direitos reservados no FRED, não pode ir para o site público (docs/FONTES.md)' % f)
    for i, f in enumerate((cfg.get('noticias') or {}).get('rss') or []):
        if not isinstance(f, dict) or not str(f.get('url', '')).startswith('https://') or not f.get('nome'):
            erros.append('notícias/rss %d: precisa de "nome" e de "url" começando com https://' % (i + 1))
    for i, e in enumerate((cfg.get('noticias') or {}).get('etfs') or []):
        if not isinstance(e, dict) or not e.get('consulta') or not e.get('tema') or not e.get('etfs'):
            erros.append('notícias/etfs %d: precisa de "tema", "consulta" e da lista "etfs"' % (i + 1))
    am = cfg.get('agenda_macro') or {}
    for k in ('copom', 'fomc'):
        c = am.get(k) or {}
        if c and c.get('link') and not str(c['link']).startswith('https://'):
            erros.append('agenda_macro/%s: o link da fonte oficial precisa começar com https://' % k)
        for par in c.get('reunioes') or []:
            try:
                assert isinstance(par, list) and par
                for d in par:
                    dt.date.fromisoformat(d)
            except (AssertionError, TypeError, ValueError):
                erros.append('agenda_macro/%s: reunião %s precisa ser uma lista de datas AAAA-MM-DD' % (k, par))
    r = cfg.get('resultados') or {}
    if not isinstance(r.get('ativo', True), bool):
        erros.append('resultados: "ativo" precisa ser true ou false, sem aspas')
    it = cfg.get('intel') or {}
    if not isinstance((it.get('ia') or {}).get('ativo', False), bool):
        erros.append('intel/ia: "ativo" precisa ser true ou false, sem aspas')
    for k in ('janela_dias', 'janela_inicial_dias', 'recentes_dias', 'prazo_min'):
        if not isinstance(it.get(k, 1), int) or it.get(k, 1) < 1:
            erros.append('intel: "%s" precisa ser um número inteiro de dias maior que zero' % k)
    if not isinstance((it.get('mercado_hoje') or {}).get('telegram', True), bool):
        erros.append('intel/mercado_hoje: "telegram" precisa ser true ou false, sem aspas')
    if not isinstance((it.get('ingles') or {}).get('telegram', True), bool):
        erros.append('intel/ingles: "telegram" precisa ser true ou false, sem aspas')
    cr = it.get('corrente') or {}  # v3.11 · corrente de rodadas (robo/corrente.py)
    if not isinstance(cr.get('ativo', True), bool):
        erros.append('intel/corrente: "ativo" precisa ser true ou false, sem aspas')
    # até 60 min: a etapa "seguinte" do robo.yml tem 75 min de prazo para esperar e disparar
    for k, lim in (('minutos_dia', (5, 60)), ('minutos_noite', (5, 60)), ('minutos_apos_falha', (5, 60)), ('dia_de', (0, 23)), ('dia_ate', (1, 24))):
        v = cr.get(k, lim[0])
        if not isinstance(v, int) or isinstance(v, bool) or not lim[0] <= v <= lim[1]:
            erros.append('intel/corrente: "%s" precisa ser um número inteiro entre %d e %d' % (k, lim[0], lim[1]))
    if isinstance(cr.get('dia_de', 6), int) and isinstance(cr.get('dia_ate', 23), int) and cr.get('dia_de', 6) >= cr.get('dia_ate', 23):
        erros.append('intel/corrente: "dia_de" precisa ser menor que "dia_ate"')
    for k in ('max_itens_dia', 'max_tokens_dia', 'max_tokens_item'):
        if not isinstance((it.get('ia') or {}).get(k, 1), int) or (it.get('ia') or {}).get(k, 1) < 0:
            erros.append('intel/ia: "%s" precisa ser um número inteiro' % k)
    for i, s in enumerate(cfg.get('bcb_series') or []):
        if not isinstance(s.get('codigo'), int) or not s.get('id'):
            erros.append('séries do Banco Central %d: precisa de "id" e "codigo" (número do SGS)' % (i + 1))
    q = cfg.get('qualidade') or {}
    if not (0 < q.get('critico_abaixo_pct', 0) < q.get('completo_min_pct', 0) <= 100):
        erros.append('qualidade: critico_abaixo_pct precisa ser menor que completo_min_pct (entre 0 e 100)')
    for f in cfg.get('feriados_b3') or []:
        try:
            dt.date.fromisoformat(f)
        except (TypeError, ValueError):
            erros.append('feriado "%s" não é uma data AAAA-MM-DD' % f)
    return erros


def deve_rodar(agora_, cfg, manual=False, fechamento_feito=None):
    """Decide pela agenda da configuração (o GitHub dispara a cada 30 minutos, às vezes com atraso; o robô escolhe
    quando trabalhar). A rodada de fechamento acontece uma vez por dia, na primeira execução depois do horário
    configurado, mesmo que o GitHub atrase o disparo."""
    if manual:
        return True, 'execução manual'
    ag = cfg['agenda']
    dia = DIAS[agora_.weekday()]
    hm = agora_.strftime('%H:%M')
    fech = ag.get('fechamento')
    if fech and hm >= fech and dia in ag['dias']:
        if fechamento_feito != agora_.date().isoformat():
            return True, 'rodada de fechamento'
        return False, 'fechamento de hoje já feito'
    if dia == 'sab' and 'sab' not in ag['dias'] and 9 <= agora_.hour < 13:
        sexta = (agora_.date() - dt.timedelta(days=1)).isoformat()
        if fechamento_feito not in (agora_.date().isoformat(), sexta):
            return True, 'recuperação do fechamento da semana'
        return False, 'fechamento da semana já feito'
    if dia not in ag['dias']:
        return False, 'dia fora da agenda (%s)' % dia
    if not (ag['inicio'] <= hm <= ag['fim']):
        return False, 'fora do horário configurado (%s a %s)' % (ag['inicio'], ag['fim'])
    passo = int(ag.get('intervalo_min', 30))
    minutos = agora_.hour * 60 + agora_.minute - (int(ag['inicio'][:2]) * 60 + int(ag['inicio'][3:]))
    if passo > 30 and (minutos % passo) >= 30:
        return False, 'intervalo configurado de %d minutos' % passo
    return True, 'dentro da agenda'


def chaves():
    return {'brapi': os.environ.get('BRAPI_TOKEN') or None, 'tiingo': os.environ.get('TIINGO_TOKEN') or None, 'fred': os.environ.get('FRED_API_KEY') or None,
            'awesome': os.environ.get('AWESOMEAPI_KEY') or None, 'anthropic': os.environ.get('ANTHROPIC_API_KEY') or None,
            'alphavantage': os.environ.get('ALPHAVANTAGE_KEY') or None}
