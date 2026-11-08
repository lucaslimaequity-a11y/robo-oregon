"""Fluxo dos fundos (v3.8): o dinheiro está entrando ou saindo dos fundos brasileiros, por classe (Ações, Multimercado,
Renda Fixa, Cambial), dia a dia, semana a semana e mês a mês.

De onde vem: CVM, Dados Abertos, "Informe Diário" de cada fundo (inf_diario_fi_AAAAMM.zip: captação e resgate do dia e
patrimônio líquido) e o cadastro de fundos pós-Resolução 175 (registro_fundo_classe.zip: a classificação de cada classe
de cotas e se ela é um fundo de cotas). Pasta /dados/ liberada no robots.txt da CVM; o robô respeita o Crawl-Delay
de 10 segundos entre um arquivo e outro.

Cuidados:
- fundos de cotas (FIC) ficam de fora: o dinheiro que entra num FIC entra de novo no fundo que ele compra; contar os dois
  dobraria o fluxo;
- linha da classe e linhas das subclasses: vale a da classe; sem ela, soma das subclasses;
- a CVM reapresenta os dias recentes: o mês corrente e o anterior são relidos uma vez por dia;
- classe que não está no cadastro pós-175 entra em "Outros".
Nada é estimado: captação menos resgate, como os fundos informaram."""
import csv
import datetime as dt
import io
import re
import time
import zipfile

import fundos
from util import sem_acento

CLASSES = [('acoes', 'Ações'), ('multimercado', 'Multimercado'), ('renda_fixa', 'Renda Fixa'), ('cambial', 'Cambial'), ('outros', 'Outros')]
_COD = {'acoes': 'A', 'multimercado': 'M', 'renda_fixa': 'R', 'cambial': 'C', 'outros': 'O'}
_DE_COD = {v: k for k, v in _COD.items()}


def classe_de(txt):
    t = sem_acento(txt or '').lower()
    if t.startswith('acoes') or 'de acoes' in t:
        return 'acoes'
    if 'multimercado' in t:
        return 'multimercado'
    if 'renda fixa' in t:
        return 'renda_fixa'
    if 'cambial' in t:
        return 'cambial'
    return 'outros'


def _sim(v):
    return sem_acento(v or '').strip().lower() in ('s', 'sim', 'true', '1', 'y')


def mapa_classes(zbytes):
    """{cnpj (14 dígitos): código} do cadastro: letra da classe (A, M, R, C, O) e 'f' quando é fundo de cotas."""
    z = zipfile.ZipFile(io.BytesIO(zbytes))
    n = next((v for v in z.namelist() if 'registro_classe' in v.lower() and v.lower().endswith('.csv')), None)
    if not n:
        return {}, {'erro': 'registro_classe.csv não está no arquivo', 'colunas': z.namelist()[:10]}
    rd = csv.reader(io.StringIO(z.read(n).decode('latin-1')), delimiter=';')
    cab = next(rd, [])
    c_cnpj, c_cls, c_fic = fundos._col(cab, 'CNPJ_Classe'), fundos._col(cab, 'Classificacao', 'Classificação'), fundos._col(cab, 'Classe_Cotas')
    if not c_cnpj or not c_cls:
        return {}, {'erro': 'colunas do cadastro não encontradas', 'colunas': cab[:30]}
    i_c, i_k, i_f = cab.index(c_cnpj), cab.index(c_cls), cab.index(c_fic) if c_fic else None
    out = {}
    for r in rd:
        if len(r) <= max(i_c, i_k):
            continue
        cnpj = re.sub(r'\D', '', r[i_c])
        if not cnpj:
            continue
        out[cnpj] = _COD[classe_de(r[i_k])] + ('f' if i_f is not None and len(r) > i_f and _sim(r[i_f]) else '')
    return out, {'linhas': len(out)}


def ler_inf(zbytes, mapa):
    """Agrega o informe diário por data e classe: {data: {classe: [captação, resgate, patrimônio]}} e um diagnóstico."""
    z = zipfile.ZipFile(io.BytesIO(zbytes))
    nomes = [v for v in z.namelist() if v.lower().endswith('.csv')]
    if not nomes:
        return {}, {'erro': 'arquivo sem CSV'}
    rd = csv.reader(io.StringIO(z.read(nomes[0]).decode('latin-1')), delimiter=';')
    cab = next(rd, [])
    col = {k: fundos._col(cab, *n) for k, n in {'cnpj': ('CNPJ_FUNDO_CLASSE', 'CNPJ_FUNDO'), 'data': ('DT_COMPTC',), 'cap': ('CAPTC_DIA',), 'resg': ('RESG_DIA',),
                                                 'pl': ('VL_PATRIM_LIQ',), 'sub': ('ID_SUBCLASSE',)}.items()}
    falta = [k for k in ('cnpj', 'data', 'cap', 'resg') if not col[k]]
    if falta:
        return {}, {'erro': 'colunas do informe diário não encontradas: ' + ', '.join(falta), 'colunas': cab[:30]}
    ix = {k: (cab.index(v) if v else None) for k, v in col.items()}
    classe_linha, subs = {}, {}
    linhas = fic = sem = 0
    req = max(ix[k] for k in ('cnpj', 'data', 'cap', 'resg'))
    for r in rd:
        if len(r) <= req:
            continue
        linhas += 1
        cnpj = re.sub(r'\D', '', r[ix['cnpj']])
        cod = mapa.get(cnpj)
        if cod and cod.endswith('f'):
            fic += 1
            continue
        if not cod:
            sem += 1
        k = (cnpj, r[ix['data']][:10])
        v = [fundos._num(r[ix['cap']]), fundos._num(r[ix['resg']]), fundos._num(r[ix['pl']]) if ix['pl'] is not None and len(r) > ix['pl'] else 0.0]
        sub = r[ix['sub']].strip() if ix['sub'] is not None and len(r) > ix['sub'] else ''
        if sub:
            a = subs.setdefault(k, [0.0, 0.0, 0.0])
            for i in range(3):
                a[i] += v[i]
        else:
            classe_linha[k] = v
    for k, v in subs.items():
        classe_linha.setdefault(k, v)
    dias = {}
    for (cnpj, d), v in classe_linha.items():
        cls = _DE_COD.get((mapa.get(cnpj) or 'O')[0], 'outros')
        a = dias.setdefault(d, {}).setdefault(cls, [0.0, 0.0, 0.0])
        for i in range(3):
            a[i] += v[i]
    return dias, {'linhas': linhas, 'fic_fora': fic, 'sem_classe': sem, 'dias': len(dias)}


def _semana(d):
    x = dt.date.fromisoformat(d)
    seg = x - dt.timedelta(days=x.weekday())
    return seg.isoformat(), (seg + dt.timedelta(days=6)).isoformat()


def montar(dias):
    """Dias (lista ordenada), semanas e meses com a captação líquida (captação − resgate) por classe."""
    lst = [{'d': d, 'c': {k: [round(v[0], 2), round(v[1], 2), round(v[2], 2)] for k, v in sorted(c.items())}} for d, c in sorted(dias.items())]
    sem, mes = {}, {}
    for o in lst:
        de, ate = _semana(o['d'])
        s = sem.setdefault(de, {'de': de, 'ate': ate, 'c': {}, 'dias': 0})
        m = mes.setdefault(o['d'][:7], {'mes': o['d'][:7], 'c': {}, 'pl': {}, 'dias': 0})
        s['dias'] += 1
        m['dias'] += 1
        for k, v in o['c'].items():
            s['c'][k] = round(s['c'].get(k, 0.0) + v[0] - v[1], 2)
            m['c'][k] = round(m['c'].get(k, 0.0) + v[0] - v[1], 2)
            m['pl'][k] = v[2]  # patrimônio do último dia lido do mês
    return lst, [sem[k] for k in sorted(sem)], [mes[k] for k in sorted(mes)]


def _dias_publicados(pub):
    out = {}
    for o in (pub or {}).get('dias') or []:
        out[o['d']] = {k: list(v) for k, v in (o.get('c') or {}).items()}
    return out


def atualizar(cfg, rede, hoje, agora_, estado, publicado, manual=False, log_=print, dormir=time.sleep):
    fc = (cfg.get('intel') or {}).get('fluxo_fundos') or {}
    if fc.get('ativo') is False:
        return None
    st = estado.setdefault('fluxo_fundos', {})
    if not manual and publicado and agora_.hour < int(fc.get('hora_min', 9)):
        return None
    if not manual and publicado and st.get('lido_em', '')[:10] == hoje.isoformat():
        return None
    pausa = float(fc.get('pausa_seg', 10))  # Crawl-Delay da CVM
    # cadastro: renovado a cada 7 dias (fica no estado interno, não é publicado)
    mapa = st.get('mapa') or {}
    if not mapa or not st.get('mapa_em') or (hoje - dt.date.fromisoformat(st['mapa_em'][:10])).days >= int(fc.get('cadastro_dias', 7)):
        novo, dg = mapa_classes(rede.get('CVM · cadastro de fundos', fundos.REGISTRO, timeout=int(fc.get('timeout', 240)), tentativas=2))
        if novo:
            mapa, st['mapa'], st['mapa_em'] = novo, novo, agora_.isoformat(timespec='minutes')
        else:
            log_('  fluxo dos fundos: cadastro sem classificação (%s); colunas: %s' % (dg.get('erro'), ', '.join(dg.get('colunas') or [])[:300]))
            if not mapa:
                return dict(publicado or {}, erro=dg.get('erro'), colunas=dg.get('colunas'), gerado_em=agora_.isoformat(timespec='minutes')) if publicado else None
        dormir(pausa)
    dias = _dias_publicados(publicado)
    primeiro = hoje.replace(day=1)
    meses = [(primeiro - dt.timedelta(days=1)).strftime('%Y%m'), primeiro.strftime('%Y%m')]
    lidos, diag_total = [], {'linhas': 0, 'fic_fora': 0, 'sem_classe': 0}
    for i, m in enumerate(meses):
        if i:
            dormir(pausa)
        try:
            zb = rede.get('CVM · informe diário dos fundos', fundos.INF.format(m=m), timeout=int(fc.get('timeout', 240)), tentativas=2)
        except Exception as e:  # mês ainda sem arquivo (dia 1) ou CVM fora: o que já foi publicado fica
            log_('  fluxo dos fundos: %s não lido (%s)' % (m, type(e).__name__))
            continue
        novos, dg = ler_inf(zb, mapa)
        if dg.get('erro'):
            log_('  fluxo dos fundos: %s; colunas: %s' % (dg['erro'], ', '.join(dg.get('colunas') or [])[:300]))
            continue
        for d, c in novos.items():
            dias[d] = c  # a CVM reapresenta dias recentes: vale a leitura mais nova
        lidos.append(m[:4] + '-' + m[4:])
        for k in diag_total:
            diag_total[k] += dg.get(k, 0)
    if not lidos:
        return None
    st['lido_em'] = agora_.isoformat(timespec='minutes')
    lst, semanas, meses_l = montar(dias)
    # meses e semanas antigos que já não estão nos dias guardados continuam (nada é apagado)
    ja = {s['de'] for s in semanas}
    semanas = [s for s in (publicado or {}).get('semanas') or [] if s['de'] not in ja] + semanas
    jam = {x['mes'] for x in meses_l}
    meses_l = [x for x in (publicado or {}).get('meses') or [] if x['mes'] not in jam] + meses_l
    semanas.sort(key=lambda s: s['de'])
    meses_l.sort(key=lambda x: x['mes'])
    log_('  fluxo dos fundos: %s lidos, %d linhas (%d de FIC fora, %d sem classe no cadastro)' % (', '.join(lidos), diag_total['linhas'], diag_total['fic_fora'], diag_total['sem_classe']))
    return {'gerado_em': agora_.isoformat(timespec='minutes'), 'fonte': 'CVM · Dados Abertos · Informe Diário dos fundos e cadastro (Resolução 175)',
            'classes': [list(c) for c in CLASSES], 'dias': lst[-int(fc.get('dias_guardados', 400)):], 'semanas': semanas, 'meses': meses_l,
            'lido': {'meses': lidos, 'linhas': diag_total['linhas'], 'fic_fora': diag_total['fic_fora'], 'sem_classe': diag_total['sem_classe']},
            'nota': 'Captação menos resgate informados pelos fundos à CVM (informe diário). Fundos de cotas ficam de fora para não contar duas vezes o mesmo dinheiro. A CVM pode reapresentar os dias mais recentes.'}
