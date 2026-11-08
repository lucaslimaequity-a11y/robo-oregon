"""Quem tem a ação (v3.6): carteira dos fundos brasileiros (CVM, dados abertos "CDA – Composição e Diversificação das
Aplicações") para cada ação das carteiras Oregon e VG VIP: quantos fundos têm, quanto têm, os maiores e quem entrou ou
saiu em relação ao mês anterior lido. Gestora pelo cadastro de fundos da CVM (registro_fundo_classe).

Cuidados que valem para a leitura:
- a CVM publica a carteira com defasagem e o fundo pode manter posições em sigilo por um período (elas ficam fora, só
  agregadas no arquivo CONFID); o mês lido é o último completo disponível (escolhido pelo tamanho dos arquivos);
- os nomes das colunas mudaram com a Resolução CVM 175 (CNPJ_FUNDO → CNPJ_FUNDO_CLASSE); o robô procura os dois e,
  se não achar o que precisa, registra o cabeçalho encontrado em vez de inventar;
- uma vez por mês, na rodada da noite: o arquivo do mês tem ~25 MB.
Nada é estimado: valores de mercado da posição no fim do mês, como o fundo informou."""
import csv
import datetime as dt
import io
import re
import time
import zipfile

BASE = 'https://dados.cvm.gov.br/dados/FI/DOC/CDA/DADOS/'
REGISTRO = 'https://dados.cvm.gov.br/dados/FI/CAD/DADOS/registro_fundo_classe.zip'
INF = 'https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/inf_diario_fi_{m}.zip'


def _col(cab, *nomes):
    low = {c.strip().lower(): c for c in cab}
    for n in nomes:
        if n.lower() in low:
            return low[n.lower()]
    return None


def _num(s):
    try:
        return float((s or '').replace(',', '.')) if s not in (None, '') else 0.0
    except ValueError:
        return 0.0


def meses_na_listagem(html_txt):
    """{'AAAAMM': tamanho em bytes aproximado} da listagem de diretório da CVM ("cda_fi_202609.zip … 15M")."""
    out = {}
    for m in re.finditer(r'cda_fi_(\d{6})\.zip</a>\s*[\d-]+\s+[\d:]+\s+([\d.]+)([KMG]?)', html_txt):
        mult = {'K': 1e3, 'M': 1e6, 'G': 1e9}.get(m.group(3), 1)
        out[m.group(1)] = float(m.group(2)) * mult
    if not out:  # listagem em outro formato: só os nomes
        for m in re.finditer(r'cda_fi_(\d{6})\.zip', html_txt):
            out.setdefault(m.group(1), 0.0)
    return out


def mes_completo(tamanhos, hoje=None):
    """O mês mais recente cujo arquivo já tem o tamanho típico (≥ 70% do maior dos últimos 12): os meses recentes
    chegam aos poucos (os fundos entregam ao longo de semanas)."""
    if not tamanhos:
        return None
    ult = sorted(tamanhos)[-12:]
    ref = max(tamanhos[m] for m in ult) or 0
    if not ref and hoje is not None:  # listagem sem tamanhos: o mês de ~4 meses atrás, que costuma estar completo
        lim = (hoje - dt.timedelta(days=120)).strftime('%Y%m')
        ok = [m for m in ult if m <= lim]
        return ok[-1] if ok else ult[0]
    for m in sorted(ult, reverse=True):
        if not ref or tamanhos[m] >= 0.7 * ref:
            return m
    return ult[-1]


def ler_cda(zbytes, tickers):
    """{ticker: {cnpj: (nome do fundo, valor)}} do bloco de ativos com código de negociação; e o diagnóstico."""
    z = zipfile.ZipFile(io.BytesIO(zbytes))
    nomes = [n for n in z.namelist() if re.search(r'BLC_4', n, re.I) and n.lower().endswith('.csv')]
    if not nomes:
        return {}, {'erro': 'bloco 4 não encontrado no zip', 'arquivos': z.namelist()[:12]}
    alvo = set(tickers)
    out, diag = {}, {'arquivo': nomes[0]}
    txt = z.read(nomes[0]).decode('latin-1')
    leitor = csv.reader(io.StringIO(txt), delimiter=';')
    cab = next(leitor, [])
    c_cnpj = _col(cab, 'CNPJ_FUNDO_CLASSE', 'CNPJ_FUNDO')
    c_nome = _col(cab, 'DENOM_SOCIAL', 'NM_FUNDO_CLASSE', 'DENOM_SOCIAL_FUNDO', 'NM_FUNDO_CLASSE_SUBCLASSE')
    c_cod = _col(cab, 'CD_ATIVO', 'CD_ATIVO_BV', 'CD_ATIVO_NEGOC')
    c_val = _col(cab, 'VL_MERC_POS_FINAL')
    c_apl = _col(cab, 'TP_APLIC')
    diag['colunas'] = cab[:40]
    if not (c_cnpj and c_cod and c_val):
        diag['erro'] = 'colunas esperadas ausentes (CNPJ, código do ativo, valor de mercado)'
        return {}, diag
    i_cnpj, i_cod, i_val = cab.index(c_cnpj), cab.index(c_cod), cab.index(c_val)
    i_nome = cab.index(c_nome) if c_nome else None
    i_apl = cab.index(c_apl) if c_apl else None
    n = 0
    for r in leitor:
        if len(r) <= max(i_cnpj, i_cod, i_val):
            continue
        cod = (r[i_cod] or '').strip().upper()
        if cod not in alvo:
            continue
        if i_apl is not None and r[i_apl] and not re.search(r'a[cç][oõ]es|acao|ação', r[i_apl], re.I):
            continue
        v = _num(r[i_val])
        if v <= 0:
            continue
        cnpj = re.sub(r'\D', '', r[i_cnpj] or '')
        d = out.setdefault(cod, {})
        nm = (r[i_nome] or '').strip() if i_nome is not None else ''
        nm0, v0 = d.get(cnpj, (nm, 0.0))
        d[cnpj] = (nm0 or nm, v0 + v)
        n += 1
    diag['linhas'] = n
    return out, diag


def ler_gestoras(zbytes):
    """{cnpj da classe ou do fundo: gestora} do cadastro registro_fundo_classe (pós-CVM 175)."""
    z = zipfile.ZipFile(io.BytesIO(zbytes))
    arq = {n.lower(): n for n in z.namelist()}

    def tab(sub):
        n = next((v for k, v in arq.items() if sub in k and k.endswith('.csv')), None)
        if not n:
            return [], []
        rd = csv.reader(io.StringIO(z.read(n).decode('latin-1')), delimiter=';')
        cab = next(rd, [])
        return cab, list(rd)
    cf, fundos = tab('registro_fundo')
    cc, classes = tab('registro_classe')
    g_id, g_cnpj, g_gest = _col(cf, 'ID_Registro_Fundo'), _col(cf, 'CNPJ_Fundo'), _col(cf, 'Gestor')
    out, por_id = {}, {}
    if g_id and g_gest:
        i_id, i_g = cf.index(g_id), cf.index(g_gest)
        i_c = cf.index(g_cnpj) if g_cnpj else None
        for r in fundos:
            if len(r) <= max(i_id, i_g):
                continue
            por_id[r[i_id]] = r[i_g].strip()
            if i_c is not None and len(r) > i_c:
                out[re.sub(r'\D', '', r[i_c])] = r[i_g].strip()
    k_id, k_cnpj = _col(cc, 'ID_Registro_Fundo'), _col(cc, 'CNPJ_Classe')
    if k_id and k_cnpj:
        i_id, i_c = cc.index(k_id), cc.index(k_cnpj)
        for r in classes:
            if len(r) > max(i_id, i_c) and r[i_id] in por_id:
                out[re.sub(r'\D', '', r[i_c])] = por_id[r[i_id]]
    return out


def resumo(pos, gest, anterior, nomes, top=10):
    """Por ticker: fundos, valor, maiores posições e quem entrou ou saiu frente ao mês anterior lido."""
    out = {}
    for t, d in pos.items():
        lista = sorted(((c, nm, v) for c, (nm, v) in d.items()), key=lambda x: -x[2])
        total = sum(v for _, _, v in lista)
        pg = {}
        for c, _nm, v in lista:
            g = gest.get(c) or 'gestora não informada'
            pg[g] = pg.get(g, 0.0) + v
        ant = set((anterior or {}).get(t) or [])
        atu = set(d)
        out[t] = {'nome': nomes.get(t) or t, 'n_fundos': len(lista), 'valor': round(total, 2),
                  'maiores': [{'fundo': nm or c, 'cnpj': c, 'gestora': gest.get(c), 'valor': round(v, 2)} for c, nm, v in lista[:top]],
                  'gestoras': [{'gestora': g, 'valor': round(v, 2)} for g, v in sorted(pg.items(), key=lambda x: -x[1])[:top]],
                  'entraram': len(atu - ant) if anterior is not None else None, 'sairam': len(ant - atu) if anterior is not None else None,
                  'novos': [d[c][0] or c for c in sorted(atu - ant, key=lambda c: -d[c][1])[:5]] if anterior is not None else []}
    return out


def atualizar(cfg, oregon, rede, hoje, agora_, estado, publicado, manual=False, log_=print, dormir=time.sleep):
    fc = (cfg.get('intel') or {}).get('fundos_cda') or {}
    if fc.get('ativo') is False:
        return None
    st = estado.setdefault('fundos_cda', {})
    if not manual and agora_.hour < int(fc.get('hora_min', 21)) and publicado:
        return None
    if st.get('verificado_em', '')[:10] == hoje.isoformat() and publicado and not manual:
        return None
    st['verificado_em'] = agora_.isoformat(timespec='minutes')
    lista = rede.get('CVM · carteiras dos fundos', BASE, timeout=30, tentativas=2).decode('utf-8', 'replace')
    mes = mes_completo(meses_na_listagem(lista), hoje)
    if not mes:
        raise RuntimeError('listagem da CVM sem arquivos de carteira')
    if mes == st.get('mes') and publicado and not publicado.get('erro'):
        return None  # nada novo (a rodada manual também não baixa de novo o mesmo mês)
    at = (oregon or {}).get('ativos') or {}
    tickers = sorted(t for t, a in at.items() if re.match(r'^[A-Z]{4}(3|4|5|6|11)$', t) and (a.get('classe') in ('Ações', 'acao') or a.get('so_vip')))
    pausa = float(fc.get('pausa_seg', 10))  # v3.8 · Crawl-Delay de 10 s do robots.txt da CVM entre um arquivo e outro
    dormir(pausa)
    zb = rede.get('CVM · carteiras dos fundos', BASE + 'cda_fi_%s.zip' % mes, timeout=int(fc.get('timeout', 240)), tentativas=2)
    pos, diag = ler_cda(zb, tickers)
    if diag.get('erro'):
        log_('  fundos (CVM): %s; colunas: %s' % (diag['erro'], ', '.join(diag.get('colunas') or [])[:300]))
        return {'gerado_em': agora_.isoformat(timespec='minutes'), 'mes': mes, 'erro': diag['erro'], 'colunas': diag.get('colunas'), 'ativos': (publicado or {}).get('ativos') or {}}
    try:
        dormir(pausa)
        gest = ler_gestoras(rede.get('CVM · cadastro de fundos', REGISTRO, timeout=120, tentativas=2))
    except Exception as e:
        gest = {}
        log_('  fundos (CVM): cadastro de gestoras não lido (%s)' % type(e).__name__)
    anterior = st.get('cnpjs') if st.get('mes') else None
    res = resumo(pos, gest, anterior, {t: (at.get(t) or {}).get('nome') for t in tickers})
    for t in tickers:
        if t not in res:
            res[t] = {'nome': (at.get(t) or {}).get('nome') or t, 'n_fundos': 0, 'valor': 0.0, 'maiores': [], 'gestoras': [], 'entraram': None, 'sairam': None, 'novos': []}
        res[t]['carteira'] = 'vip' if (at.get(t) or {}).get('so_vip') else 'oregon'
        res[t]['vip_tambem'] = bool((at.get(t) or {}).get('carteiras_vip'))
    st['cnpjs'] = {t: sorted(d) for t, d in pos.items()}
    st['mes_anterior'], st['mes'] = st.get('mes'), mes
    log_('  fundos (CVM): carteiras de %s, %d posições em %d ações' % (mes, diag.get('linhas', 0), len(pos)))
    return {'gerado_em': agora_.isoformat(timespec='minutes'), 'mes': mes[:4] + '-' + mes[4:], 'mes_anterior': (st.get('mes_anterior') or '')[:4] + ('-' + st['mes_anterior'][4:] if st.get('mes_anterior') else ''),
            'fonte': 'CVM · Dados Abertos · CDA (carteira dos fundos) e cadastro de fundos', 'ativos': res,
            'nota': 'Posição no fim do mês, valor de mercado informado pelo fundo. Posições em sigilo ficam de fora. Gestora pelo cadastro da CVM.'}
