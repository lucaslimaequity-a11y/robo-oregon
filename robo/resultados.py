# -*- coding: utf-8 -*-
"""Resultados trimestrais e anuais das companhias das carteiras, direto dos dados abertos da CVM.

Fonte: Portal Dados Abertos CVM (licença ODbL, crédito à CVM):
  - ITR (formulário trimestral): https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_AAAA.zip
  - DFP (demonstrações anuais):   https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS/dfp_cia_aberta_AAAA.zip
A CVM atualiza esses arquivos uma vez por semana (inclui reapresentações). O robô baixa no máximo uma vez a cada
`resultados.intervalo_dias` dias, só na rodada de fechamento ou manual.

O que sai, por empresa (CNPJ da configuração, conferido também pelo nome quando houver `cvm_nome`):
  - DRE consolidada, linhas do próprio formulário: receita (conta 3.01), resultado antes do resultado financeiro
    (3.05, quando existir com esse nome), lucro líquido consolidado e lucro atribuído aos controladores;
  - o nome da conta vai junto (bancos e seguradoras usam nomes diferentes para a 3.01);
  - trimestres: só a linha de três meses do exercício atual (ORDEM_EXERC "ÚLTIMO"); quarto trimestre não é
    calculado (o anual vem da DFP), para não publicar número derivado como se fosse informado;
  - versão mais recente de cada documento (reapresentações substituem a original).
Fundos imobiliários e BDRs não entregam ITR/DFP como companhia aberta brasileira: ficam fora, com o motivo.
"""
import csv
import datetime as dt
import io
import re
import zipfile

from util import ErroFonte, sem_acento

URL = {'ITR': 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_%d.zip',
       'DFP': 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS/dfp_cia_aberta_%d.zip'}
ESCALA = {'UNIDADE': 1, 'MIL': 1000, 'MILHAR': 1000, 'MILHAO': 1000000}


def _num(v):
    try:
        return float(str(v).replace(',', '.'))
    except (TypeError, ValueError):
        return None


def _data(v):
    try:
        return dt.date.fromisoformat(str(v)[:10])
    except (TypeError, ValueError):
        return None


def _meses(a, b):
    return (b.year - a.year) * 12 + (b.month - a.month)


def _ordem(cd):
    return tuple(int(x) if x.isdigit() else 0 for x in str(cd).split('.'))


def _classifica(cd, ds):
    """Qual linha da DRE é: receita, ebit, lucro ou lucro dos controladores (pelo código e pelo nome da conta)."""
    d = sem_acento(ds or '')
    if cd == '3.01':
        return 'receita'
    if cd == '3.05' and 'antes do resultado financeiro' in d:
        return 'ebit'
    if cd.count('.') == 1 and 'lucro' in d and 'periodo' in d:
        return 'lucro'
    if cd.count('.') == 2 and 'controladora' in d and ('atribuido' in d or 'socios' in d):
        return 'lucro_controladores'
    return None


def ler_dre(conteudo_zip, alvo, doc):
    """Lê a DRE consolidada de um zip da CVM. alvo: {cnpj_digitos: (ticker, nome_cvm_sem_acento)}.
    Devolve {ticker: {(dt_refer, versao): {...}}} e o nome do arquivo lido."""
    try:
        z = zipfile.ZipFile(io.BytesIO(conteudo_zip))
    except zipfile.BadZipFile:
        raise ErroFonte('CVM resultados', 'formato', '%s: arquivo não é zip' % doc)
    nomes = [n for n in z.namelist() if re.search(r'_DRE_con_\d{4}\.csv$', n, re.I)]
    if not nomes:
        raise ErroFonte('CVM resultados', 'formato', '%s: sem DRE consolidada no arquivo' % doc)
    # data de entrega de cada formulário (arquivo índice do zip, coluna DT_RECEB): a primeira versão entregue é a data em que
    # o resultado chegou ao mercado; serve de referência na Agenda (v3.5). Sem o índice, segue sem a data.
    receb = {}
    for n in z.namelist():
        if re.search(r'(itr|dfp)_cia_aberta_\d{4}\.csv$', n, re.I):
            bi = z.read(n)
            try:
                ti = bi.decode('utf-8')
            except UnicodeDecodeError:
                ti = bi.decode('latin-1')
            for r in csv.DictReader(io.StringIO(ti), delimiter=';'):
                cj, ref, d = re.sub(r'\D', '', r.get('CNPJ_CIA') or ''), r.get('DT_REFER') or '', _data(r.get('DT_RECEB'))
                if cj in alvo and ref and d and (ref not in receb.get(cj, {}) or d < receb[cj][ref]):
                    receb.setdefault(cj, {})[ref] = d
    bruto = z.read(nomes[0])
    try:
        txt = bruto.decode('utf-8')
    except UnicodeDecodeError:
        txt = bruto.decode('latin-1')
    leitor = csv.DictReader(io.StringIO(txt), delimiter=';')
    falta = [c for c in ('CNPJ_CIA', 'DT_REFER', 'VERSAO', 'ORDEM_EXERC', 'DT_INI_EXERC', 'DT_FIM_EXERC', 'CD_CONTA', 'DS_CONTA', 'VL_CONTA', 'ESCALA_MOEDA') if c not in (leitor.fieldnames or [])]
    if falta:
        raise ErroFonte('CVM resultados', 'formato', '%s: colunas ausentes: %s' % (doc, ', '.join(falta)))
    out = {}
    for r in leitor:
        cnpj = re.sub(r'\D', '', r.get('CNPJ_CIA') or '')
        if cnpj not in alvo:
            continue
        t, nome_ok = alvo[cnpj]
        if nome_ok and nome_ok not in sem_acento(r.get('DENOM_CIA') or ''):
            continue
        if sem_acento(r.get('ORDEM_EXERC') or '') != 'ultimo':
            continue
        ini, fim = _data(r.get('DT_INI_EXERC')), _data(r.get('DT_FIM_EXERC'))
        if not ini or not fim:
            continue
        m = _meses(ini, fim)
        if doc == 'ITR' and m != 2:
            continue  # só a linha de 3 meses; a acumulada no ano fica de fora
        if doc == 'DFP' and m != 11:
            continue
        k = _classifica((r.get('CD_CONTA') or '').strip(), r.get('DS_CONTA'))
        if not k:
            continue
        v = _num(r.get('VL_CONTA'))
        if v is None:
            continue
        esc = ESCALA.get(sem_acento(r.get('ESCALA_MOEDA') or '').strip().upper())
        if esc is None:  # escala desconhecida: nunca supor unidade (o número sairia mil vezes menor)
            raise ErroFonte('CVM resultados', 'formato', '%s: escala "%s" desconhecida' % (doc, r.get('ESCALA_MOEDA')))
        versao = int(_num(r.get('VERSAO')) or 1)
        chave = (r.get('DT_REFER') or fim.isoformat(), versao)
        reg = out.setdefault(t, {}).setdefault(chave, {'ini': ini.isoformat(), 'fim': fim.isoformat(), 'versao': versao, 'doc': doc, 'contas': {}})
        d_receb = (receb.get(cnpj) or {}).get(r.get('DT_REFER') or '')
        if d_receb:
            reg['entregue_em'] = d_receb.isoformat()
        cd = (r.get('CD_CONTA') or '').strip()
        # se houver mais de uma linha de lucro no primeiro nível, vale a última (o lucro do período, depois das operações descontinuadas)
        if k not in reg['contas'] or (k == 'lucro' and _ordem(cd) > _ordem(reg['contas'][k]['cd'])):
            reg['contas'][k] = {'cd': cd, 'ds': (r.get('DS_CONTA') or '').strip(), 'v': v * esc}
    return out, nomes[0]


def _periodo(fim, doc):
    d = dt.date.fromisoformat(fim)
    return '%dT%s' % ((d.month - 1) // 3 + 1, str(d.year)[2:]) if doc == 'ITR' else str(d.year)


def consolidar(lidos):
    """Junta as leituras (ITR e DFP de vários anos), fica com a versão mais recente de cada documento."""
    emp = {}
    for parte in lidos:
        for t, docs in parte.items():
            for (ref, versao), reg in docs.items():
                chave = (reg['doc'], reg['fim'])
                atual = emp.setdefault(t, {}).get(chave)
                if atual is None or versao > atual['versao']:
                    emp[t][chave] = reg
    saida = {}
    for t, regs in emp.items():
        tri, ano = [], []
        for (doc, fim), reg in sorted(regs.items(), key=lambda kv: kv[0][1]):
            c = reg['contas']
            linha = {'periodo': _periodo(fim, doc), 'inicio': reg['ini'], 'fim': fim, 'documento': doc, 'versao': reg['versao']}
            if reg.get('entregue_em'):
                linha['entregue_em'] = reg['entregue_em']
            for k in ('receita', 'ebit', 'lucro', 'lucro_controladores'):
                if k in c:
                    linha[k] = round(c[k]['v'], 2)
                    linha[k + '_conta'] = '%s %s' % (c[k]['cd'], c[k]['ds'])
            (tri if doc == 'ITR' else ano).append(linha)
        saida[t] = {'trimestres': tri[-8:], 'anuais': ano[-3:]}
    return saida


def mesclar(anterior, novo):
    """Junta a leitura nova com o arquivo anterior: um arquivo da CVM que falhou nesta rodada não apaga o que já estava lido."""
    out = {}
    for t in set((anterior or {}).keys()) | set((novo or {}).keys()):
        a, n = (anterior or {}).get(t) or {}, (novo or {}).get(t) or {}
        reg = {}
        for k in ('trimestres', 'anuais'):
            por = {x['periodo']: x for x in a.get(k) or []}
            for x in n.get(k) or []:
                velho = por.get(x['periodo']) or {}
                if velho.get('entregue_em') and not x.get('entregue_em'):
                    x = dict(x, entregue_em=velho['entregue_em'])
                por[x['periodo']] = x
            reg[k] = sorted(por.values(), key=lambda x: x['fim'])[-8 if k == 'trimestres' else -3:]
        out[t] = reg
    return out


def coletar(rede, cfg, hoje, log=print):
    """Baixa ITR do ano atual e do anterior e DFP dos dois últimos exercícios. Devolve (dados, erros)."""
    rc = cfg.get('resultados') or {}
    alvo, fora = {}, {}
    for a in cfg['ativos']:
        if not a.get('ativo', True):
            continue
        cnpj = re.sub(r'\D', '', a.get('cnpj') or '')
        cl = a.get('classe') or ''
        if cl == 'fii':
            fora[a['id']] = 'fundo imobiliário: entrega informes mensais à CVM, não ITR/DFP de companhia aberta'
            continue
        if cl != 'acao':
            continue
        if not cnpj:
            fora[a['id']] = 'sem CNPJ na configuração (BDR de emissor estrangeiro não entrega ITR/DFP de companhia aberta brasileira)'
            continue
        alvo[cnpj] = (a['id'], sem_acento(a.get('cvm_nome') or ''))
    lidos, erros, arquivos = [], [], []
    pedidos = [('ITR', hoje.year), ('ITR', hoje.year - 1), ('DFP', hoje.year - 1), ('DFP', hoje.year - 2)][: int(rc.get('arquivos', 4))]
    for doc, ano in pedidos:
        if rede.sem_tempo():
            erros.append('%s %d: prazo da rodada esgotado' % (doc, ano))
            break
        try:
            corpo = rede.get('CVM resultados', URL[doc] % ano, timeout=180, tentativas=2)
            parte, nome = ler_dre(corpo, alvo, doc)
            lidos.append(parte)
            arquivos.append(nome)
            log('  resultados CVM: %s %d lido (%d empresas)' % (doc, ano, len(parte)))
        except ErroFonte as e:
            erros.append('%s %d: %s' % (doc, ano, e))
    dados = consolidar(lidos)
    sem = {t: 'sem DRE no arquivo da CVM (confira o CNPJ em config.json)' for (t, _) in alvo.values() if t not in dados}
    sem.update(fora)
    return {'empresas': dados, 'fora': sem, 'arquivos': arquivos}, erros
