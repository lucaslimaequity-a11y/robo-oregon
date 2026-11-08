# -*- coding: utf-8 -*-
"""Cotações: cada ativo tenta as fontes na ordem da configuração até uma responder com um preço válido.

Cada cotação sai com: fonte usada, data de referência, hora, tipo de preço (intradiário ou fechamento) e status:
  atualizado     o dado mais recente que aquele tipo de fonte pode ter
  desatualizado  o último valor válido conhecido, mas de uma data anterior à esperada (nunca vira retorno de 0%)
  suspeito       variação acima do limite de anomalia da classe: precisa ser conferida
  indisponivel   nenhuma fonte respondeu e não há valor anterior válido
"""
import datetime as dt
import urllib.parse

import b3
from calendario import dias_uteis_atras
from util import ErroFonte, finito

INTRADIARIAS = ('brapi', 'yahoo', 'awesome', 'coingecko')


def hora_de(ts):
    try:
        return dt.datetime.fromtimestamp(int(ts), dt.timezone(dt.timedelta(hours=-3))).strftime('%H:%M')
    except Exception:
        return None


def _valida(fonte, preco, anterior):
    p, a = finito(preco), finito(anterior)
    if p is None or a is None or p <= 0 or a <= 0:
        raise ErroFonte(fonte, 'invalido')
    return p, a


# ---------------------------------------------------------------- fontes
def yahoo_chart(rede, simbolo, faixa='5d', intervalo='1d'):
    url = ('https://query1.finance.yahoo.com/v8/finance/chart/%s?range=%s&interval=%s&includeAdjustedClose=true&events=div%%2Csplit'
           % (urllib.parse.quote(simbolo, safe=''), faixa, intervalo))
    js = rede.get_json('Yahoo', url, timeout=15, tentativas=2)
    ch = js.get('chart') or {}
    if ch.get('error'):
        raise rede.falha('Yahoo', 'nao_encontrado', str((ch.get('error') or {}).get('code') or simbolo))
    r = ch.get('result') or []
    if not r:
        raise rede.falha('Yahoo', 'vazio', simbolo)
    r = r[0]
    meta, ts = r.get('meta') or {}, r.get('timestamp') or []
    off = meta.get('gmtoffset') or 0
    q = ((r.get('indicators') or {}).get('quote') or [{}])[0]
    fe = q.get('close') or []
    aj = (((r.get('indicators') or {}).get('adjclose') or [{}])[0].get('adjclose')) or []
    pts, adj = {}, {}
    for i, t in enumerate(ts):
        d = dt.datetime.fromtimestamp(t + off, dt.timezone.utc).date().isoformat()
        v = finito(fe[i]) if i < len(fe) else None
        if v and v > 0:
            pts[d] = v
        v = finito(aj[i]) if i < len(aj) else None
        if v and v > 0:
            adj[d] = v
    return {'meta': meta, 'pts': sorted(pts.items()), 'adj': sorted(adj.items()), 'eventos': r.get('events') or {}}


def yahoo(rede, simbolo, fechamento='18:00'):
    y = yahoo_chart(rede, simbolo, '5d', '1d')
    pts, meta = y['pts'], y['meta']
    if not pts:
        raise rede.falha('Yahoo', 'vazio', simbolo)
    rt = meta.get('regularMarketTime')
    d_vivo = dt.datetime.fromtimestamp(int(rt) + (meta.get('gmtoffset') or 0), dt.timezone.utc).date().isoformat() if rt else None
    preco = finito(meta.get('regularMarketPrice'))
    if preco and d_vivo and d_vivo > pts[-1][0]:
        p, a, data = preco, pts[-1][1], d_vivo  # barra de hoje ainda sem fechamento
    else:
        if len(pts) < 2:
            raise rede.falha('Yahoo', 'vazio', simbolo + ' com um só fechamento')
        p, a, data = (preco or pts[-1][1]), pts[-2][1], pts[-1][0]
    p, a = _valida('Yahoo', p, a)
    hora = hora_de(rt)
    return {'preco': p, 'anterior': a, 'var': (p / a - 1) * 100, 'data': data, 'hora': hora, 'fonte': 'Yahoo Finance',
            'tipo_preco': 'intradiario' if hora and hora < fechamento else 'fechamento', 'moeda': meta.get('currency'),
            'identificacao': {'nome': meta.get('longName') or meta.get('shortName'), 'bolsa': meta.get('exchangeName'), 'tipo': meta.get('instrumentType'),
                              'inicio': dt.datetime.fromtimestamp(meta['firstTradeDate'], dt.timezone.utc).date().isoformat() if meta.get('firstTradeDate') else None}}


def brapi(rede, ticker, token, fechamento='18:00'):
    if not token:
        raise ErroFonte('brapi', 'sem_chave', 'BRAPI_TOKEN')
    url = 'https://brapi.dev/api/quote/%s' % urllib.parse.quote(ticker, safe='')
    js = rede.get_json('brapi', url, timeout=15, tentativas=2, cab={'Authorization': 'Bearer ' + token}, tipo_403='plano')
    rs = js.get('results') or []
    if not rs:
        raise rede.falha('brapi', 'vazio', ticker)
    r = rs[0]
    p, a = _valida('brapi', r.get('regularMarketPrice'), r.get('regularMarketPreviousClose'))
    t = str(r.get('regularMarketTime') or '')
    data, hora = None, None
    try:
        tt = dt.datetime.fromisoformat(t.replace('Z', '+00:00')).astimezone(dt.timezone(dt.timedelta(hours=-3)))
        data, hora = tt.date().isoformat(), tt.strftime('%H:%M')
    except Exception:
        pass
    if not data:
        raise rede.falha('brapi', 'formato', 'sem data da cotação')
    return {'preco': p, 'anterior': a, 'var': (p / a - 1) * 100, 'data': data, 'hora': hora, 'fonte': 'brapi',
            'tipo_preco': 'intradiario' if hora and hora < fechamento else 'fechamento', 'moeda': r.get('currency') or 'BRL',
            'identificacao': {'nome': r.get('longName') or r.get('shortName')}}


def tiingo(rede, simbolo, token, hoje):
    if not token:
        raise ErroFonte('Tiingo', 'sem_chave', 'TIINGO_TOKEN')
    url = 'https://api.tiingo.com/tiingo/daily/%s/prices?startDate=%s' % (urllib.parse.quote(simbolo.lower()), (hoje - dt.timedelta(days=12)).isoformat())
    js = rede.get_json('Tiingo', url, timeout=20, cab={'Authorization': 'Token ' + token, 'Content-Type': 'application/json'}, tipo_403='autenticacao')
    pts = [(str(o.get('date'))[:10], finito(o.get('close'))) for o in (js if isinstance(js, list) else []) if finito(o.get('close'))]
    if len(pts) < 2:
        raise rede.falha('Tiingo', 'vazio', simbolo)
    (d0, a), (d1, p) = pts[-2], pts[-1]
    p, a = _valida('Tiingo', p, a)
    return {'preco': p, 'anterior': a, 'var': (p / a - 1) * 100, 'data': d1, 'hora': None, 'fonte': 'Tiingo', 'tipo_preco': 'fechamento', 'moeda': 'USD'}


def alphavantage(rede, simbolo, chave, cota=None):
    """Alpha Vantage (chave gratuita; plano gratuito com 25 pedidos por dia). Último fechamento disponível.
    A cota do dia é controlada pelo robô (config: alphavantage.limite_dia) para nunca estourar o plano."""
    if not chave:
        raise ErroFonte('Alpha Vantage', 'sem_chave', 'ALPHAVANTAGE_KEY')
    if cota is not None and cota['usados'] >= cota['limite']:
        raise ErroFonte('Alpha Vantage', 'limite', 'cota diária do plano gratuito já usada (%d de %d pedidos hoje)' % (cota['usados'], cota['limite']))
    url = 'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=%s&apikey=%s' % (urllib.parse.quote(simbolo), urllib.parse.quote(chave))
    if cota is not None:
        cota['usados'] += 1
    js = rede.get_json('Alpha Vantage', url, timeout=20, tentativas=1)
    if not isinstance(js, dict):
        raise rede.falha('Alpha Vantage', 'formato', simbolo)
    if js.get('Information') or js.get('Note'):  # o plano gratuito avisa o limite com HTTP 200
        if cota is not None:
            cota['usados'] = cota['limite']
        raise rede.falha('Alpha Vantage', 'limite', 'limite do plano gratuito atingido')
    if js.get('Error Message'):
        raise rede.falha('Alpha Vantage', 'nao_encontrado', simbolo)
    q = js.get('Global Quote') or {}
    p, a, d = finito(q.get('05. price')), finito(q.get('08. previous close')), q.get('07. latest trading day')
    if not p or not d:
        raise rede.falha('Alpha Vantage', 'vazio', simbolo)
    p, a = _valida('Alpha Vantage', p, a)
    return {'preco': p, 'anterior': a, 'var': (p / a - 1) * 100, 'data': str(d)[:10], 'hora': None, 'fonte': 'Alpha Vantage', 'tipo_preco': 'fechamento',
            'moeda': 'BRL' if simbolo.endswith('.SAO') else 'USD'}


def fred(rede, serie, chave, hoje):
    import fontes_macro
    pts = fontes_macro.fred(rede, serie, chave, (hoje - dt.timedelta(days=20)).isoformat())
    if len(pts) < 2:
        raise rede.falha('FRED', 'vazio', serie)
    (d0, a), (d1, p) = pts[-2], pts[-1]
    p, a = _valida('FRED', p, a)
    return {'preco': p, 'anterior': a, 'var': (p / a - 1) * 100, 'data': d1, 'hora': None, 'fonte': 'FRED · ' + serie, 'tipo_preco': 'fechamento'}


def coingecko(rede):
    js = rede.get_json('CoinGecko', 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true', timeout=15)
    b = js.get('bitcoin') or {}
    p, v = finito(b.get('usd')), finito(b.get('usd_24h_change'))
    if not p or v is None:
        raise rede.falha('CoinGecko', 'vazio')
    t = b.get('last_updated_at')
    return {'preco': p, 'anterior': p / (1 + v / 100), 'var': v, 'data': dt.datetime.fromtimestamp(int(t), dt.timezone(dt.timedelta(hours=-3))).date().isoformat() if t else None,
            'hora': hora_de(t), 'fonte': 'CoinGecko (variação de 24 horas)', 'tipo_preco': 'intradiario'}


def awesome(rede, chave):
    cab = {'x-api-key': chave} if chave else {}
    o = (rede.get_json('AwesomeAPI', 'https://economia.awesomeapi.com.br/json/last/USD-BRL', timeout=15, cab=cab, tipo_403='autenticacao') or {}).get('USDBRL') or {}
    p, vb, pct = finito(o.get('bid')), finito(o.get('varBid')), finito(o.get('pctChange'))
    if not p or vb is None or pct is None:
        raise rede.falha('AwesomeAPI', 'vazio')
    p, a = _valida('AwesomeAPI', p, p - vb)
    cd = str(o.get('create_date') or '')
    return {'preco': p, 'anterior': a, 'var': pct, 'data': cd[:10] or None, 'hora': cd[11:16] or None, 'fonte': 'AwesomeAPI', 'tipo_preco': 'intradiario'}


def ptax(indicadores):
    x = (indicadores or {}).get('ptax')
    if not x or x.get('anterior') is None:
        raise ErroFonte('PTAX (Banco Central)', 'vazio')
    return {'preco': x['nivel'], 'anterior': x['anterior'], 'var': x['var'], 'data': x['data'], 'hora': '13:00', 'fonte': 'Banco Central · PTAX venda',
            'tipo_preco': 'fechamento'}


# ---------------------------------------------------------------- execução
def chamar(fonte_token, item, ctx):
    """'brapi', 'yahoo:^BVSP', 'fred:SP500'... → cotação padronizada ou ErroFonte."""
    prov, _, simb = fonte_token.partition(':')
    rede, ch = ctx['rede'], ctx['chaves']
    if prov == 'brapi':
        return brapi(rede, simb or item.get('brapi') or item['id'], ch.get('brapi'))
    if prov == 'yahoo':
        return yahoo(rede, simb or item.get('yahoo') or (item['id'] + ('.SA' if item.get('mercado', 'B3') == 'B3' else '')))
    if prov == 'b3':
        return b3.cotacao(ctx.get('b3_cache'), simb or item.get('b3') or item['id'])
    if prov == 'tiingo':
        return tiingo(rede, simb or item.get('tiingo') or item['id'], ch.get('tiingo'), ctx['hoje'])
    if prov == 'fred':
        return fred(rede, simb, ch.get('fred'), ctx['hoje'])
    if prov == 'alphavantage':
        if ctx.get('av_so_fechamento', True) and not ctx.get('fechamento'):
            raise ErroFonte('Alpha Vantage', 'pausado', 'usada só na rodada de fechamento, para poupar a cota diária do plano gratuito')
        return alphavantage(rede, simb or item.get('alphavantage') or (item['id'] + ('.SAO' if item.get('mercado', 'B3') == 'B3' else '')), ch.get('alphavantage'), ctx.get('av_cota'))
    if prov == 'coingecko':
        return coingecko(rede)
    if prov == 'awesome':
        return awesome(rede, ch.get('awesome'))
    if prov == 'ptax':
        return ptax(ctx.get('indicadores'))
    raise ErroFonte(prov, 'formato', 'fonte desconhecida na configuração')


def referencia(item, c, ctx):
    """Data que o dado precisa ter para contar como atualizado. Fontes intradiárias (brapi, Yahoo, câmbio, cripto) são
    cobradas pela sessão corrente; fontes de fechamento (B3, Tiingo, FRED, PTAX), pela última sessão já publicada,
    com tolerância própria em dias úteis (o FRED publica com atraso)."""
    mercado = item.get('mercado', 'B3')
    if mercado == 'cripto':
        return (ctx['hoje'] - dt.timedelta(days=1)).isoformat()
    intr, fech = (ctx['sessao_eua'], ctx['fechada_eua']) if mercado == 'EUA' else (ctx['sessao_b3'], ctx['fechada_b3'])
    if c.get('provedor') in INTRADIARIAS:
        return intr
    tol = int(ctx['tolerancia'].get(c.get('provedor'), 0))
    return dias_uteis_atras(dt.date.fromisoformat(fech), tol).isoformat() if tol else fech


def classifica(item, c, ctx):
    ref = referencia(item, c, ctx)
    st, motivo = ('atualizado', '') if (c.get('data') or '') >= ref else ('desatualizado', 'dado de %s; esperado a partir de %s' % (c.get('data'), ref))
    lim = ctx['anomalia'].get(item.get('classe'), ctx['anomalia'].get('outro', 25))
    if st == 'atualizado' and c.get('var') is not None and abs(c['var']) >= lim:
        st, motivo = 'suspeito', 'variação de %.1f%% acima do limite de anomalia (%.0f%%): conferir' % (c['var'], lim)
    return st, motivo


def cotar(item, ctx, anterior=None):
    """Tenta as fontes em ordem. Devolve a cotação com status; nunca inventa valor."""
    tentativas = []
    for f in item['fontes']:
        if ctx['rede'].sem_tempo():
            tentativas.append({'fonte': f, 'erro': 'tempo', 'msg': 'prazo da rodada esgotado'})
            break
        try:
            c = chamar(f, item, ctx)
        except ErroFonte as e:
            tentativas.append({'fonte': f, 'erro': e.tipo, 'msg': str(e)})
            continue
        except (KeyError, TypeError, ValueError, AttributeError, IndexError) as e:  # resposta fora do formato esperado
            tentativas.append({'fonte': f, 'erro': 'formato', 'msg': '%s: resposta fora do formato esperado (%s)' % (f.split(':')[0], type(e).__name__)})
            continue
        c['provedor'] = f.split(':')[0]
        c['status'], c['motivo'] = classifica(item, c, ctx)
        if c['status'] == 'desatualizado' and f != item['fontes'][-1]:
            # dado velho nesta fonte: tenta a próxima, mas guarda este como reserva
            tentativas.append({'fonte': f, 'erro': 'desatualizado', 'msg': c['motivo'], '_cot': c})
            continue
        c['tentativas'] = [{k: v for k, v in t.items() if k != '_cot'} for t in tentativas]
        return c
    reserva = [t['_cot'] for t in tentativas if t.get('_cot')]
    limpo = [{k: v for k, v in t.items() if k != '_cot'} for t in tentativas]
    if reserva:
        c = max(reserva, key=lambda x: x.get('data') or '')
        c['tentativas'] = limpo
        return c
    if anterior and anterior.get('status') in ('atualizado', 'desatualizado', 'suspeito') and anterior.get('preco'):
        c = {k: anterior[k] for k in ('preco', 'anterior', 'var', 'data', 'hora', 'fonte', 'tipo_preco', 'moeda', 'provedor') if k in anterior}
        c.update({'status': 'desatualizado', 'motivo': 'nenhuma fonte respondeu nesta rodada; último valor válido (%s)' % (anterior.get('data') or '?'), 'tentativas': limpo, 'reaproveitado': True})
        return c
    return {'status': 'indisponivel', 'motivo': '; '.join(t['msg'] for t in limpo) or 'sem fonte configurada', 'tentativas': limpo}


def cobertura(itens, rede_resumo, sem_chave):
    cont = {'atualizado': 0, 'desatualizado': 0, 'suspeito': 0, 'indisponivel': 0}
    intr = fech = 0
    for c in itens.values():
        cont[c['status']] = cont.get(c['status'], 0) + 1
        if c['status'] == 'atualizado':
            intr += c.get('tipo_preco') == 'intradiario'
            fech += c.get('tipo_preco') != 'intradiario'
    total = len(itens)
    return {'total': total, 'atualizados': cont['atualizado'], 'intradiarios': intr, 'fechamentos': fech, 'desatualizados': cont['desatualizado'],
            'suspeitos': cont['suspeito'], 'indisponiveis': cont['indisponivel'],
            'taxa_sucesso': round(100.0 * cont['atualizado'] / total, 1) if total else 0.0,
            'por_fornecedor': rede_resumo, 'fontes_sem_chave': sorted(sem_chave),
            'lista_indisponiveis': sorted(k for k, c in itens.items() if c['status'] == 'indisponivel'),
            'lista_desatualizados': sorted(k for k, c in itens.items() if c['status'] == 'desatualizado'),
            'lista_suspeitos': sorted(k for k, c in itens.items() if c['status'] == 'suspeito')}
