# -*- coding: utf-8 -*-
"""Séries históricas para o modelo de risco do painel.

Regras:
- uma série vem de UMA fonte só (nunca emenda fontes com bases diferentes);
- o tipo fica registrado: 'ajustado' (preço ajustado por proventos e desdobramentos pelo fornecedor = retorno total),
  'preco' (preço de mercado sem ajuste), 'nivel' (índice), 'taxa' (juros em % a.a.);
- preço sem ajuste só conta como retorno total quando o ativo comprovadamente não distribui (campo "distribui": false);
- nenhuma série começa antes do início de negociação; se a fonte trouxer dado anterior ao início informado, a série é
  marcada como suspeita;
- saltos diários fora do normal são marcados (possível desdobramento, grupamento ou provento não ajustado);
- se uma fonte falhar hoje, a série anterior é mantida e marcada como desatualizada, em vez de sumir.
"""
import datetime as dt
import urllib.parse

import b3
import cotacoes
import fontes_macro
from util import ErroFonte, finito


def _yahoo(rede, simbolo, anos, ajustado):
    y = cotacoes.yahoo_chart(rede, simbolo, '%dy' % anos, '1d')
    pts = y['adj'] if ajustado and y['adj'] else y['pts']
    tipo = 'ajustado' if ajustado and y['adj'] else None
    return pts, tipo, 'Yahoo Finance'


def _brapi(rede, ticker, token, faixa, ajustado):
    if not token:
        raise ErroFonte('brapi', 'sem_chave', 'BRAPI_TOKEN')
    url = 'https://brapi.dev/api/quote/%s?range=%s&interval=1d' % (urllib.parse.quote(ticker, safe=''), faixa)
    js = rede.get_json('brapi', url, timeout=25, tentativas=2, cab={'Authorization': 'Bearer ' + token}, tipo_403='plano')
    r = (js.get('results') or [{}])[0]
    hist = r.get('historicalDataPrice') or []
    tem_aj = ajustado and any(finito(h.get('adjustedClose')) for h in hist)
    pts = {}
    for h in hist:
        v = finito(h.get('adjustedClose') if tem_aj else h.get('close'))
        try:
            d = dt.datetime.fromtimestamp(int(h['date']), dt.timezone.utc).date().isoformat()
        except Exception:
            continue
        if v and v > 0:
            pts[d] = v
    if not pts:
        raise rede.falha('brapi', 'vazio', ticker + ' sem histórico')
    return sorted(pts.items()), ('ajustado' if tem_aj else None), 'brapi'


def _tiingo(rede, simbolo, token, inicio, ajustado):
    if not token:
        raise ErroFonte('Tiingo', 'sem_chave', 'TIINGO_TOKEN')
    url = 'https://api.tiingo.com/tiingo/daily/%s/prices?startDate=%s' % (urllib.parse.quote(simbolo.lower()), inicio)
    js = rede.get_json('Tiingo', url, timeout=30, cab={'Authorization': 'Token ' + token, 'Content-Type': 'application/json'}, tipo_403='autenticacao')
    campo = 'adjClose' if ajustado else 'close'
    pts = [(str(o.get('date'))[:10], finito(o.get(campo))) for o in (js if isinstance(js, list) else [])]
    pts = [(d, v) for d, v in pts if v and v > 0]
    if not pts:
        raise rede.falha('Tiingo', 'vazio', simbolo)
    return pts, ('ajustado' if ajustado else None), 'Tiingo'


def _b3(cache, ticker):
    pts = [(p[0], p[1]) for p in ((cache or {}).get('tickers', {}).get(ticker) or [])]
    if not pts:
        raise ErroFonte(b3.FONTE, 'nao_encontrado', ticker)
    return pts, None, b3.FONTE


def obter(token, item, ctx, tipo_base):
    """Uma fonte → (pts, tipo, fonte). tipo_base: 'ajustado' para ativos; 'nivel'/'preco'/'taxa' para fatores."""
    prov, _, simb = token.partition(':')
    rede, ch, anos = ctx['rede'], ctx['chaves'], ctx['anos']
    inicio = (ctx['hoje'] - dt.timedelta(days=int(365.25 * anos) + 5)).isoformat()
    aj = tipo_base == 'ajustado'
    if prov == 'yahoo':
        pts, tipo, fonte = _yahoo(rede, simb or item.get('yahoo') or (item['id'] + ('.SA' if item.get('mercado', 'B3') == 'B3' else '')), anos, aj)
    elif prov == 'brapi':
        pts, tipo, fonte = _brapi(rede, simb or item.get('brapi') or item['id'], ch.get('brapi'), ctx['brapi_faixa'], aj)
    elif prov == 'tiingo':
        pts, tipo, fonte = _tiingo(rede, simb or item.get('tiingo') or item['id'], ch.get('tiingo'), inicio, aj)
    elif prov == 'b3':
        pts, tipo, fonte = _b3(ctx.get('b3_cache'), simb or item.get('b3') or item['id'])
    elif prov == 'fred':
        pts, tipo, fonte = fontes_macro.fred(rede, simb, ch.get('fred'), inicio), None, 'FRED · ' + simb
    else:
        raise ErroFonte(prov, 'formato', 'fonte desconhecida')
    pts = [(d, v) for d, v in pts if d >= inicio]
    return pts, (tipo or ('preco' if aj else tipo_base)), fonte


def checar(serie, item, cfg):
    """Marca qualidade: curta, saltos fora do normal. Pontos antes do início de negociação já foram descartados."""
    pts, motivos = serie['pts'], list(serie.pop('_avisos', []))
    if len(pts) < cfg['min_pontos']:
        motivos.append('curta: %d pontos (mínimo %d)' % (len(pts), cfg['min_pontos']))
    lim = cfg['salto'].get(item.get('classe'), cfg['salto'].get('outro', 30)) if serie['tipo'] in ('ajustado', 'preco') else None
    if lim:
        for (d0, v0), (d1, v1) in zip(pts, pts[1:]):
            r = (v1 / v0 - 1) * 100
            if abs(r) >= lim:
                motivos.append('salto de %+.1f%% em %s: possível desdobramento, grupamento ou provento não ajustado' % (r, d1))
                break
    graves = [m for m in motivos if not m.startswith('curta') and not m.startswith('descartados')]
    serie['qualidade'] = 'suspeita' if graves else ('curta' if any(m.startswith('curta') for m in motivos) else 'ok')
    serie['motivo'] = '; '.join(motivos)
    return serie


def montar(id_, item, tokens, tipo_base, moeda, ctx, cfg_hist):
    tentativas, melhor = [], None
    for tok in tokens:
        if ctx['rede'].sem_tempo():
            tentativas.append('%s: prazo da rodada esgotado' % tok)
            break
        try:
            pts, tipo, fonte = obter(tok, item, ctx, tipo_base)
        except ErroFonte as e:
            tentativas.append(str(e))
            continue
        except (KeyError, TypeError, ValueError, AttributeError, IndexError) as e:  # resposta fora do formato esperado
            tentativas.append('%s: resposta fora do formato esperado (%s)' % (tok.split(':')[0], type(e).__name__))
            continue
        if len(pts) < 3:
            tentativas.append('%s: só %d pontos' % (tok, len(pts)))
            continue
        cand = (pts, tipo, fonte, tok.split(':')[0])
        if len(pts) >= cfg_hist['min_pontos']:
            melhor = cand
            break
        if not melhor or len(pts) > len(melhor[0]):
            melhor = cand
    if not melhor:
        return None, tentativas
    pts, tipo, fonte, prov = melhor
    avisos = []
    if item.get('inicio'):
        antes = [p for p in pts if p[0] < item['inicio']]
        if antes:
            pts = [p for p in pts if p[0] >= item['inicio']]
            avisos.append('descartados %d pontos anteriores ao início de negociação (%s): a fonte pode ter usado outro ativo com o mesmo código' % (len(antes), item['inicio']))
        if len(pts) < 3:
            return None, tentativas + ['série some depois de descartar os pontos anteriores ao início (%s)' % item['inicio']]
    dist = item.get('distribui')
    if tipo == 'ajustado':
        ajuste, rt = 'proventos e desdobramentos, pelo fornecedor (%s)' % fonte, True
    elif tipo == 'preco':
        ajuste = 'nenhum (preço de mercado)'
        rt = True if dist is False else (False if dist is True else None)
    else:
        ajuste, rt = 'não se aplica', None
    s = {'pts': [[d, round(v, 6)] for d, v in pts], 'tipo': tipo, 'moeda': moeda, 'fonte': fonte + (' (via robô)' if 'robô' not in fonte else ''),
         'provedor': prov, 'ajuste': ajuste, 'retorno_total': rt, 'distribui': dist, 'inicio': pts[0][0], 'fim': pts[-1][0], 'n': len(pts), '_avisos': avisos}
    return checar(s, item, cfg_hist), tentativas


def construir(cfg, ctx, anterior=None, tz_pts=None, sgs=None, treasury_pts=None):
    """Monta todas as séries. Devolve (series, relatorio)."""
    hc = cfg['historico']
    S, relat = {}, {}
    for item in cfg['ativos']:
        if not item.get('ativo', True):
            continue
        tokens = item.get('historico') or hc['fontes_padrao'].get(item['classe']) or []
        moeda = 'USD' if item.get('mercado') == 'EUA' else 'BRL'
        s, tent = montar(item['id'], item, tokens, 'ajustado', moeda, ctx, hc)
        if s:
            S[item['id']] = s
        relat[item['id']] = {'fonte': s and s['fonte'], 'tipo': s and s['tipo'], 'n': s and s['n'], 'qualidade': s and s['qualidade'], 'tentativas': tent}
    for sid, f in (cfg.get('series_fatores') or {}).items():
        s, tent = montar(sid, {'id': sid, 'classe': f.get('classe', 'indice')}, f['fontes'], f['tipo'], f['moeda'], ctx, hc)
        if s:
            S[sid] = s
        relat[sid] = {'fonte': s and s['fonte'], 'tipo': s and s['tipo'], 'n': s and s['n'], 'qualidade': s and s['qualidade'], 'tentativas': tent}

    def add(sid, pts, tipo, moeda, fonte):
        if pts and len(pts) >= 3:
            S[sid] = {'pts': [[d, round(v, 6)] for d, v in pts], 'tipo': tipo, 'moeda': moeda, 'fonte': fonte, 'provedor': 'oficial', 'ajuste': 'não se aplica',
                      'retorno_total': None, 'distribui': None, 'inicio': pts[0][0], 'fim': pts[-1][0], 'n': len(pts), 'qualidade': 'ok', 'motivo': ''}
            relat[sid] = {'fonte': fonte, 'tipo': tipo, 'n': len(pts), 'qualidade': 'ok', 'tentativas': []}
    sgs = sgs or {}
    if sgs.get('ptax'):
        add('USDBRL', sgs['ptax'], 'nivel', 'BRL', 'Banco Central · PTAX venda (SGS 1)')
    if sgs.get('cdi_diario'):
        idx, pts = 1000.0, []
        for d, v in sgs['cdi_diario']:
            idx *= 1 + v / 100
            pts.append((d, idx))
        add('CDI', pts, 'nivel', 'BRL', 'Banco Central · CDI diário acumulado (SGS 12), base 1.000')
    if sgs.get('selic'):
        add('SELIC', sgs['selic'], 'taxa', 'BRL', 'Banco Central · meta Selic (SGS 432)')
    for k, sid in (('pre', 'DI'), ('real', 'NTNB')):
        if tz_pts and k in tz_pts:
            add(sid, tz_pts[k]['pts'], 'taxa', 'BRL', 'Tesouro Transparente · %s (taxa de compra%s)' % (tz_pts[k]['nome'], '; aproximação do DI longo' if k == 'pre' else ''))
    if treasury_pts:
        add('UST2', treasury_pts.get('2 Yr'), 'taxa', 'USD', 'Tesouro dos EUA')
        add('UST10', treasury_pts.get('10 Yr'), 'taxa', 'USD', 'Tesouro dos EUA')
    # o que falhou hoje e existia antes continua, marcado como desatualizado
    for sid, s in ((anterior or {}).get('series') or {}).items():
        if sid not in S and isinstance(s, dict) and s.get('pts'):
            s = dict(s)
            ini = next((a.get('inicio') for a in cfg['ativos'] if a['id'] == sid and a.get('inicio')), None)
            if ini:
                s['pts'] = [p for p in s['pts'] if p[0] >= ini]
                if len(s['pts']) < 3:
                    continue
                s['inicio'], s['n'] = s['pts'][0][0], len(s['pts'])
            s['desatualizada'] = True
            s['motivo'] = ((s.get('motivo') or '') + '; ' if s.get('motivo') else '') + 'fonte falhou nesta atualização; mantida a série anterior (até %s)' % s['pts'][-1][0]
            S[sid] = s
            relat.setdefault(sid, {})['mantida_anterior'] = True
    return S, relat
