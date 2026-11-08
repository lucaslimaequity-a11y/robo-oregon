"""Agenda de proventos (v3.6): dividendos, JCP e rendimentos anunciados pelas empresas das carteiras Oregon e VG VIP.

Fonte: a página "Empresas listadas" da B3 (proventos em dinheiro dos últimos ~12 meses, com data de aprovação, data-com,
data de pagamento e valor por ação, como a B3 publica). A classe da ação sai do código ISIN: ACNOR = ON (final 3),
ACNPR/ACNPA/ACNPB = PN (4/5/6), CDAM = unit (11). Nada é estimado: o valor é o bruto anunciado (JCP antes do IR).
É uma consulta por empresa, uma vez por dia, com pausa entre as chamadas. Uma falha mantém o que já estava publicado."""
import base64
import datetime as dt
import json
import re
import time

URL = 'https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/GetListedSupplementCompany/'
ISIN_CLASSE = {'3': ('ACNOR',), '4': ('ACNPR', 'ACNPA'), '5': ('ACNPA',), '6': ('ACNPB',), '11': ('CDAM', 'UNT')}
TIPO = {'DIVIDENDO': 'Dividendo', 'JRS CAP PROPRIO': 'JCP', 'RENDIMENTO': 'Rendimento', 'RESTITUICAO CAPITAL': 'Restituição de capital'}


def _data(s):
    m = re.match(r'^(\d{2})/(\d{2})/(\d{4})$', (s or '').strip())
    if not m:
        return None
    try:
        return dt.date(int(m.group(3)), int(m.group(2)), int(m.group(1))).isoformat()
    except ValueError:
        return None


def _valor(s):
    try:
        return float((s or '').replace('.', '').replace(',', '.'))
    except ValueError:
        return None


def url_empresa(raiz):
    q = json.dumps({'issuingCompany': raiz, 'language': 'pt-br'}, separators=(',', ':'))
    return URL + base64.b64encode(q.encode()).decode()


def da_classe(ticker, isin):
    """O evento é desta classe de ação? (PETR4 lê os ISIN 'ACNPR'; ENGI11 lê o da unit 'CDAM')."""
    m = re.match(r'^[A-Z]{4}(\d{1,2})$', ticker or '')
    if not m:
        return False
    return any(k in (isin or '') for k in ISIN_CLASSE.get(m.group(1), ()))


def eventos(js, ticker):
    obj = (js[0] if isinstance(js, list) and js else js) or {}
    out = []
    for e in obj.get('cashDividends') or []:
        isin = e.get('isinCode') or e.get('assetIssued') or ''
        if not da_classe(ticker, isin):
            continue
        out.append({'tipo': TIPO.get((e.get('label') or '').strip().upper(), (e.get('label') or '').strip().title()), 'aprovado': _data(e.get('approvedOn')),
                    'data_com': _data(e.get('lastDatePrior')), 'pagamento': _data(e.get('paymentDate')), 'valor': _valor(e.get('rate')),
                    'referente': (e.get('relatedTo') or '').strip() or None, 'isin': isin})
    out.sort(key=lambda e: (e['data_com'] or e['aprovado'] or ''), reverse=True)
    return out


def resumo(evs, hoje):
    ano = str(hoje.year)
    do_ano = [e for e in evs if (e.get('data_com') or '').startswith(ano) and e.get('valor') is not None]
    prox_com = sorted([e for e in evs if e.get('data_com') and e['data_com'] >= hoje.isoformat()], key=lambda e: e['data_com'])
    prox_pag = sorted([e for e in evs if e.get('pagamento') and e['pagamento'] >= hoje.isoformat()], key=lambda e: e['pagamento'])
    return {'total_ano': round(sum(e['valor'] for e in do_ano), 8) if do_ano else 0.0, 'n_ano': len(do_ano), 'ano': int(ano),
            'proxima_data_com': prox_com[0]['data_com'] if prox_com else None, 'proximo_pagamento': prox_pag[0]['pagamento'] if prox_pag else None,
            'ultimo_anuncio': max([e['aprovado'] for e in evs if e.get('aprovado')] or [None]) if evs else None}


def atualizar(cfg, oregon, rede, robots, hoje, agora_, estado, publicado, log_=print):
    pc = (cfg.get('intel') or {}).get('proventos') or {}
    if pc.get('ativo') is False:
        return None
    st = estado.setdefault('proventos', {})
    ult = st.get('lido_em') or ''
    if ult and ult[:10] == hoje.isoformat() and publicado:
        return None  # uma vez por dia
    at = (oregon or {}).get('ativos') or {}
    tickers = sorted(t for t, a in at.items() if (a.get('classe') in ('Ações', 'acao') or a.get('so_vip')) and re.match(r'^[A-Z]{4}(3|4|5|6|11)$', t) and a.get('pais', 'Brasil') == 'Brasil')
    por_raiz = {}
    for t in tickers:
        por_raiz.setdefault(t[:4], []).append(t)
    ativos = dict((publicado or {}).get('ativos') or {})
    erros, ok = [], 0
    for raiz, ts in sorted(por_raiz.items()):
        u = url_empresa(raiz)
        if robots is not None and not robots.permite(u):
            erros.append(raiz + ': robots')
            continue
        try:
            js = rede.get_json('B3 · proventos', u, timeout=20, tentativas=2)
        except Exception as e:
            erros.append('%s: %s' % (raiz, type(e).__name__))
            continue
        ok += 1
        for t in ts:
            evs = eventos(js, t)
            ativos[t] = {'eventos': evs[:40], 'resumo': resumo(evs, hoje), 'lido_em': agora_.isoformat(timespec='minutes'), 'nome': (at.get(t) or {}).get('nome') or t,
                         'carteira': 'vip' if (at.get(t) or {}).get('so_vip') else 'oregon', 'vip_tambem': bool((at.get(t) or {}).get('carteiras_vip'))}
        time.sleep(float(pc.get('pausa_seg', 1.0)))
    if ok:
        st['lido_em'] = agora_.isoformat(timespec='minutes')
    log_('  proventos (B3): %d empresas lidas%s' % (ok, '; falhas: ' + ', '.join(erros[:5]) if erros else ''))
    if not ativos:
        return None
    return {'gerado_em': agora_.isoformat(timespec='minutes'), 'fonte': 'B3 · Empresas listadas (proventos em dinheiro, últimos ~12 meses)', 'ativos': ativos,
            'erros': erros[:20], 'nota': 'Valor bruto por ação como anunciado (JCP antes do imposto). Data-com = último dia para ter direito. Ano = ano da data-com.'}
