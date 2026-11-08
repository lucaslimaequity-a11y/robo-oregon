# -*- coding: utf-8 -*-
"""Fontes oficiais de juros, inflação e câmbio: Banco Central (SGS e Focus), Tesouro Direto (Tesouro Transparente),
Tesouro dos EUA e, com chave gratuita, FRED (Federal Reserve de St. Louis)."""
import csv
import datetime as dt
import io
import urllib.parse

from util import ErroFonte, sem_acento, finito

TESOURO_URL = ('https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/'
               'resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv')


def sgs(rede, cod, dias, hoje):
    """Série do SGS entre hoje-dias e hoje. Datas futuras (a meta Selic vem preenchida até o próximo Copom) ficam fora."""
    ini = (hoje - dt.timedelta(days=dias)).strftime('%d/%m/%Y')
    fim = hoje.strftime('%d/%m/%Y')
    url = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.%d/dados?formato=json&dataInicial=%s&dataFinal=%s' % (int(cod), ini, fim)
    js = rede.get_json('Banco Central', url, timeout=30)
    if not isinstance(js, list):
        raise rede.falha('Banco Central', 'formato', 'SGS %s' % cod)
    pts = []
    for o in js:
        try:
            d = dt.datetime.strptime(o['data'], '%d/%m/%Y').date()
            v = finito(str(o['valor']).replace(',', '.'))
        except Exception:
            continue
        if v is not None and d <= hoje:
            pts.append((d.isoformat(), v))
    pts.sort()
    if not pts:
        raise rede.falha('Banco Central', 'vazio', 'SGS %s' % cod)
    return pts


def focus(rede, hoje, inds=('IPCA', 'Selic', 'PIB Total', 'Câmbio')):
    """Mediana do Focus para o ano corrente e o seguinte, e a variação contra uma semana antes."""
    base = '(' + ' or '.join("Indicador eq '%s'" % i for i in inds) + ") and Data ge '%s'" % (hoje - dt.timedelta(days=21)).isoformat()
    linhas, ultimo = None, None
    for filtro in (base + ' and baseCalculo eq 0', base):
        q = urllib.parse.urlencode({'$filter': filtro, '$orderby': 'Data desc', '$top': '2000', '$format': 'json'}, quote_via=urllib.parse.quote)
        try:
            linhas = rede.get_json('Focus', 'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?' + q, timeout=40).get('value', [])
            break
        except ErroFonte as e:
            ultimo = e
    if linhas is None:
        raise ultimo or ErroFonte('Focus', 'vazio')
    linhas = [r for r in linhas if r.get('baseCalculo', 0) in (0, '0')]
    out = {}
    for ind in inds:
        rs = [r for r in linhas if r.get('Indicador') == ind and finito(r.get('Mediana')) is not None]
        if not rs:
            continue
        datas = sorted({r['Data'] for r in rs}, reverse=True)
        d0 = datas[0]
        limite = (dt.date.fromisoformat(d0) - dt.timedelta(days=6)).isoformat()
        d1 = next((d for d in datas if d <= limite), None)

        def med(data, ref):
            for r in rs:
                if r['Data'] == data and str(r.get('DataReferencia')) == ref:
                    return float(r['Mediana'])
            return None
        item = {'data': d0, 'data_anterior': d1, 'anos': {}}
        for a in (str(hoje.year), str(hoje.year + 1)):
            m0, m1 = med(d0, a), (med(d1, a) if d1 else None)
            if m0 is not None:
                item['anos'][a] = {'mediana': m0, 'anterior': m1, 'var': None if m1 is None else round(m0 - m1, 4)}
        out[ind] = item
    if not out:
        raise rede.falha('Focus', 'vazio', 'sem dados nas últimas 3 semanas')
    return out


def tesouro(rede, alvos, desde):
    """Taxas de compra do Tesouro Direto. Escolhe o título pedido ou o de vencimento mais próximo do mesmo tipo.
    Linhas com taxa 0,00 (título fora de venda) não são taxa de mercado e ficam fora."""
    raw = rede.get('Tesouro Direto', TESOURO_URL, timeout=180, tentativas=2)
    try:
        txt = raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        txt = raw.decode('latin-1')
    rd = csv.reader(io.StringIO(txt), delimiter=';')
    try:
        cab = [sem_acento(c) for c in next(rd)]
    except StopIteration:
        raise rede.falha('Tesouro Direto', 'vazio')

    def col(nome):
        for i, c in enumerate(cab):
            if c == nome:
                return i
        raise rede.falha('Tesouro Direto', 'formato', 'coluna "%s" não encontrada' % nome)
    it, iv, ib, itx = col('tipo titulo'), col('data vencimento'), col('data base'), col('taxa compra manha')
    series = {}
    for r in rd:
        try:
            tipo = r[it].strip()
            venc = dt.datetime.strptime(r[iv].strip(), '%d/%m/%Y').date()
            base = dt.datetime.strptime(r[ib].strip(), '%d/%m/%Y').date()
            tx = float(r[itx].replace('.', '').replace(',', '.'))
        except Exception:
            continue
        if not tx > 0 or base < desde:
            continue
        series.setdefault((sem_acento(tipo), venc), []).append((base.isoformat(), tx))
    out = {}
    for k, a in alvos.items():
        alvo_t, alvo_v = sem_acento(a['tipo']), dt.date.fromisoformat(a['vencimento'])
        cands = [key for key in series if key[0] == alvo_t]
        if not cands:
            continue
        key = min(cands, key=lambda kk: abs((kk[1] - alvo_v).days))
        out[k] = {'nome': '%s %d' % (a['tipo'], key[1].year), 'vencimento': key[1].isoformat(), 'pts': sorted(set(series[key])),
                  'exato': key[1] == alvo_v}
    if not out:
        raise rede.falha('Tesouro Direto', 'vazio', 'nenhum título pedido no arquivo')
    return out


def treasury(rede, anos):
    """Curva do Tesouro dos EUA (2 e 10 anos)."""
    out = {'2 Yr': [], '10 Yr': []}
    for ano in anos:
        url = ('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/%d/all'
               '?type=daily_treasury_yield_curve&field_tdr_date_value=%d&page&_format=csv' % (ano, ano))
        try:
            txt = rede.get('Tesouro dos EUA', url, timeout=60).decode('utf-8-sig')
        except ErroFonte:
            if ano == anos[-1]:
                raise
            continue
        for r in csv.DictReader(io.StringIO(txt)):
            try:
                d = dt.datetime.strptime(r['Date'], '%m/%d/%Y').date().isoformat()
            except Exception:
                continue
            for c in out:
                v = finito(r.get(c))
                if v is not None:
                    out[c].append((d, v))
    for c in out:
        out[c] = sorted(set(out[c]))
    if not out['10 Yr']:
        raise rede.falha('Tesouro dos EUA', 'vazio')
    return out


def fred(rede, serie, chave, inicio):
    """Série do FRED (requer chave gratuita). Valores '.' (sem dado no dia) ficam fora."""
    if not chave:
        raise ErroFonte('FRED', 'sem_chave', 'FRED_API_KEY')
    url = ('https://api.stlouisfed.org/fred/series/observations?series_id=%s&api_key=%s&file_type=json&observation_start=%s'
           % (urllib.parse.quote(serie), urllib.parse.quote(chave), inicio))
    js = rede.get_json('FRED', url, timeout=30, tipo_403='autenticacao')
    pts = []
    for o in js.get('observations') or []:
        v = finito(o.get('value'))
        if v is not None and o.get('date'):
            pts.append((o['date'], v))
    if not pts:
        raise rede.falha('FRED', 'vazio', serie)
    return sorted(pts)
