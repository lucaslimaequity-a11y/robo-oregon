# -*- coding: utf-8 -*-
"""Biblioteca persistente do Oregon Intelligence.

Arquivos em data/biblioteca/:
  AAAA-MM.json  — todos os itens do mês (pela data de publicação; sem data, pela de detecção). Nunca se apaga nada:
                  uma fonte que falha hoje não tira o que ela publicou ontem.
  indice.json   — meses disponíveis, contagens por fonte, tipo e tema; o painel carrega os meses sob demanda.
Em data/:
  recentes.json — itens dos últimos N dias (o que o painel abre primeiro).
  opinioes.json — opiniões de casas de análise dos últimos 12 meses (histórico de opiniões da ficha de cada ativo).
  coleta.json   — contadores por fonte: recebidos, rejeitados (por motivo), duplicados, novos, classificados,
                  publicados, erro e última leitura boa. Também as últimas rodadas.

Deduplicação: (1) pelo id (link normalizado); (2) por título: 60% ou mais de palavras em comum com um item
publicado até 3 dias antes ou depois vira o mesmo acontecimento — o item mais completo fica e o outro entra em
`tambem_em` (fonte e link), para o leitor abrir qualquer um dos originais.
"""
import datetime as dt
import os
import re
import urllib.parse

import analise
from util import dados_dir, gravar, ler, sem_acento

PASTA = 'biblioteca'
PARADAS = {'para', 'com', 'que', 'dos', 'das', 'nos', 'nas', 'uma', 'por', 'mais', 'apos', 'sobre', 'the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'how', 'why', 'what', 'into', 'its'}


def tokens(t):
    return {w for w in re.findall(r'[a-z0-9]{3,}', sem_acento(t or '').lower()) if w not in PARADAS}


def jaccard(a, b):
    return len(a & b) / float(len(a | b)) if a and b else 0.0


def mes_de(item):
    return ((item.get('publicado_em') or item.get('detectado_em') or '')[:7]) or 'sem-data'


def data_de(item):
    return (item.get('publicado_em') or item.get('detectado_em') or '')[:10]


def _caminho(nome):
    return os.path.join(PASTA, nome)


def ler_mes(mes):
    return ler(_caminho(mes + '.json'), {}) or {}


def gravar_mes(mes, itens):
    os.makedirs(os.path.join(dados_dir(), PASTA), exist_ok=True)
    itens = sorted(itens, key=lambda x: (x.get('publicado_em') or x.get('detectado_em') or ''), reverse=True)
    gravar(_caminho(mes + '.json'), {'mes': mes, 'n': len(itens), 'itens': itens})


def ler_indice():
    return ler(_caminho('indice.json'), {}) or {}


def meses_disponiveis():
    pasta = os.path.join(dados_dir(), PASTA)
    if not os.path.isdir(pasta):
        return []
    return sorted(f[:-5] for f in os.listdir(pasta) if re.match(r'^\d{4}-\d{2}\.json$', f))


def ids_vistos(itens):
    """Ids já conhecidos: os próprios itens e os que foram absorvidos como 'também em'."""
    out = set()
    for x in itens:
        out.add(x['id'])
        for t in x.get('tambem_em') or []:
            if t.get('id'):
                out.add(t['id'])
    return out


def carregar_recentes(hoje, dias=10):
    """Itens dos últimos `dias` (para deduplicar e montar o recentes.json), lendo só os meses necessários."""
    ini = hoje - dt.timedelta(days=dias)
    meses = sorted({ini.strftime('%Y-%m'), hoje.strftime('%Y-%m')})
    out = []
    for m in meses:
        out += [x for x in (ler_mes(m).get('itens') or []) if data_de(x) >= ini.isoformat()]
    return out


def _mais_completo(a, b):
    """Entre dois itens do mesmo acontecimento, fica o mais original e informativo."""
    def nota(x):
        return ((x.get('prioridade') or {}).get('pontos', 0), len(x.get('resumo') or ''), 1 if x.get('publicado_em') else 0)
    return (a, b) if nota(a) >= nota(b) else (b, a)


def incorporar(novos, hoje, agora_, janela_dias=3, limiar=0.6):
    """Guarda os itens novos na biblioteca. Devolve (resumo, itens_novos_gravados).
    resumo = {'novos': n, 'duplicados_id': n, 'duplicados_titulo': n, 'atualizados': n, 'meses': [...]}"""
    marca = agora_.isoformat(timespec='minutes')
    recentes = carregar_recentes(hoje, dias=janela_dias + 7)
    por_id = {x['id']: x for x in recentes}
    tk = {x['id']: tokens(x.get('titulo')) for x in recentes}
    res = {'novos': 0, 'duplicados_id': 0, 'duplicados_titulo': 0, 'atualizados': 0, 'meses': set()}
    gravados, alterados = [], {}  # alterados: id -> item (para regravar o mês do principal)
    for n in sorted(novos, key=lambda x: -((x.get('prioridade') or {}).get('pontos', 0))):
        ja = por_id.get(n['id'])
        if ja:  # mesmo link: não é novo; melhora o registro se o novo trouxer resumo/data que faltavam
            res['duplicados_id'] += 1
            mudou = False
            for k in ('resumo', 'autor', 'publicado_em', 'pdf'):
                if n.get(k) and not ja.get(k):
                    ja[k] = n[k]
                    mudou = True
            if mudou:
                ja['data_estimada'] = ja.get('publicado_em') is None
                res['atualizados'] += 1
                alterados[ja['id']] = ja
            continue
        tn = tokens(n.get('titulo'))
        d_n = data_de(n)
        dup = None
        for x in recentes:
            d_x = data_de(x)
            if d_x and d_n and abs((dt.date.fromisoformat(d_x) - dt.date.fromisoformat(d_n)).days) > janela_dias:
                continue
            if x.get('fonte_id') == n.get('fonte_id'):
                continue  # a mesma fonte não publica o mesmo fato duas vezes com links diferentes (cartas mensais parecidas são itens distintos)
            if jaccard(tn, tk.get(x['id'], set())) >= limiar:
                dup = x
                break
        if dup:
            res['duplicados_titulo'] += 1
            principal, outro = _mais_completo(dup, n)
            if principal is dup:
                te = dup.setdefault('tambem_em', [])
                if not any(t.get('link') == n.get('link') for t in te) and n.get('fonte') != dup.get('fonte'):
                    te.append({'id': n['id'], 'fonte': n.get('organizacao') or n.get('fonte'), 'link': n.get('link'), 'publicado_em': n.get('publicado_em')})
                    alterados[dup['id']] = dup
            else:  # o novo é mais completo: ele fica como principal e o antigo vira "também em"
                n['tambem_em'] = list(dup.get('tambem_em') or []) + [{'id': dup['id'], 'fonte': dup.get('organizacao') or dup.get('fonte'), 'link': dup.get('link'), 'publicado_em': dup.get('publicado_em')}]
                n['substitui'] = dup['id']
                dup['agrupado_em'] = n['id']
                alterados[dup['id']] = dup
                n['visto_em'] = marca
                gravados.append(n)
                recentes.append(n)
                por_id[n['id']] = n
                tk[n['id']] = tn
            continue
        n['visto_em'] = marca
        gravados.append(n)
        recentes.append(n)
        por_id[n['id']] = n
        tk[n['id']] = tn
        res['novos'] += 1
    # grava por mês (lê o mês, junta, regrava): nada é removido
    por_mes = {}
    for x in gravados:
        por_mes.setdefault(mes_de(x), []).append(x)
    for x in alterados.values():
        por_mes.setdefault(mes_de(x), [])
    for mes, lista in por_mes.items():
        atual = ler_mes(mes).get('itens') or []
        idx = {x['id']: i for i, x in enumerate(atual)}
        for x in lista:
            if x['id'] in idx:
                atual[idx[x['id']]] = x
            else:
                atual.append(x)
                idx[x['id']] = len(atual) - 1
        for x in alterados.values():
            if mes_de(x) == mes and x['id'] in idx:
                atual[idx[x['id']]] = x
        gravar_mes(mes, atual)
        res['meses'].add(mes)
    res['meses'] = sorted(res['meses'])
    return res, gravados


def atualizar_item(item):
    """Regrava um item já existente (por exemplo, depois da leitura por IA)."""
    mes = mes_de(item)
    atual = ler_mes(mes).get('itens') or []
    for i, x in enumerate(atual):
        if x['id'] == item['id']:
            atual[i] = item
            gravar_mes(mes, atual)
            return True
    return False


def reindexar(agora_):
    """indice.json: meses, totais e contagens por fonte, tipo, tema e região (para os filtros da Biblioteca)."""
    meses, fontes, tipos, temas, regioes, orgs, total = [], {}, {}, {}, {}, {}, 0
    for m in meses_disponiveis():
        itens = ler_mes(m).get('itens') or []
        meses.append({'mes': m, 'n': len(itens)})
        total += len(itens)
        for x in itens:
            if x.get('agrupado_em'):
                continue
            fontes[x.get('fonte_id') or '?'] = fontes.get(x.get('fonte_id') or '?', 0) + 1
            tipos[x.get('tipo') or '?'] = tipos.get(x.get('tipo') or '?', 0) + 1
            orgs[x.get('organizacao') or x.get('fonte') or '?'] = orgs.get(x.get('organizacao') or x.get('fonte') or '?', 0) + 1
            for t in x.get('temas') or []:
                temas[t] = temas.get(t, 0) + 1
            for r in x.get('regioes') or []:
                regioes[r] = regioes.get(r, 0) + 1
    idx = {'gerado_em': agora_.isoformat(timespec='minutes'), 'total': total, 'meses': meses, 'fontes': fontes, 'tipos': tipos, 'temas': temas, 'regioes': regioes, 'organizacoes': orgs}
    os.makedirs(os.path.join(dados_dir(), PASTA), exist_ok=True)
    gravar(_caminho('indice.json'), idx)
    return idx


def corrigir_data_futura(x, hoje):
    """Fonte que data o item no futuro (revista com a data da edição, ex.: CFA Institute em 18/11): o item aparece já,
    com a data de detecção, e a data da edição fica guardada e dita na tela. Devolve True se corrigiu."""
    p = x.get('publicado_em')
    if not p or p[:10] <= (hoje + dt.timedelta(days=1)).isoformat():
        return False
    x['data_edicao'] = p
    x['publicado_em'] = x.get('detectado_em') or hoje.isoformat()
    x['data_estimada'], x['data_futura'] = True, True
    return True


FONTES_BLOQUEADAS = []  # preenchido pela rodada com noticias.fontes_bloqueadas: nem o histórico desses veículos é publicado
FILTROS_TITULO = {}  # fonte_id → filtro_titulo do cadastro: um filtro novo vale também para o que foi gravado antes dele (research.json)


def bloqueado(x):
    org = sem_acento(' '.join([x.get('organizacao') or '', x.get('fonte') or '', x.get('via_veiculo') or ''])).lower()
    return any(b and sem_acento(b).lower() in org for b in FONTES_BLOQUEADAS)


def atualizar_leitura(x, oregon, hoje):
    """Item gravado por uma versão anterior do robô: é reclassificado com as regras atuais (vínculo com cada ativo,
    opinião de casa, prioridade) e ganha a leitura curta (v2) na publicação. O que foi coletado (título, link, datas,
    resumo, fonte, ativos ligados pelo coletor) não muda; a leitura por IA, se houver, é preservada. O arquivo do mês
    não é reescrito: a reclassificação vale para o que é publicado."""
    if oregon is None:
        return x
    import conteudo  # rótulo genérico de versões anteriores ("Read article"): o título vem do endereço, marcado como provisório
    if x.get('publicado_em') and x['publicado_em'][:10] > (hoje + dt.timedelta(days=1)).isoformat():
        x = dict(x)
        corrigir_data_futura(x, hoje)
    if conteudo.ROTULO_GENERICO.match(x.get('titulo') or '') and x.get('link'):
        x = dict(x)
        slug = urllib.parse.unquote(x['link'].rstrip('/').rsplit('/', 1)[-1]).rsplit('.', 1)[0]
        x['titulo'] = re.sub(r'[-_]+', ' ', slug).strip().capitalize() or x['titulo']
        x['titulo_provisorio'] = True
    an = x.get('analise') or {}
    if x.get('regras') != analise.REGRAS_VERSAO:
        x = dict(x)
        analise.classificar(x, oregon, hoje)
    if an.get('v') != 2 and not an.get('profunda'):
        x = dict(x)
        x['analise'] = analise.analisar_regras(x, oregon)
    return x


def publicar_recentes(hoje, agora_, dias=10, maximo=1500, oregon=None):
    # acervo (o que já estava nas páginas na primeira leitura) fica só na Biblioteca, por mês: não é novidade
    itens = [atualizar_leitura(x, oregon, hoje) for x in carregar_recentes(hoje, dias) if not x.get('agrupado_em') and not x.get('acervo') and not bloqueado(x)]
    itens.sort(key=lambda x: (x.get('publicado_em') or x.get('detectado_em') or ''), reverse=True)
    gravar('recentes.json', {'gerado_em': agora_.isoformat(timespec='minutes'), 'dias': dias, 'n': len(itens), 'itens': itens[:maximo]})
    return itens[:maximo]


CAMPOS_OPINIAO = ('id', 'titulo', 'link', 'fonte', 'fonte_id', 'organizacao', 'categoria', 'pais', 'tipo', 'publicado_em', 'detectado_em', 'data_estimada', 'resumo', 'autor',
                  'ativos', 'ativos_porque', 'vinculos', 'casas', 'posicao', 'natureza', 'via', 'confiavel', 'aviso_fonte', 'temas', 'regioes', 'tambem_em', 'prioridade',
                  'recomendacao', 'preco_alvo', 'horizonte', 'analista', 'casa_fonte', 'verificacao', 'nota_pesquisa', 'atualizado_em', 'data_e_atualizacao', 'origem', 'debate', 'setor_de', 'pagina_lida_em',
                  'data_edicao', 'data_futura', 'tipo', 'fatores', 'ativos_vip', 'vinculos_vip', 'ativos_porque_vip', 'setor_de_vip', 'lente', 'setor_nome', 'industria', 'industria_secao')


def publicar_opinioes(hoje, agora_, dias=365, oregon=None):
    """biblioteca/opinioes.json: opiniões de casas de análise publicadas nos últimos `dias` (12 meses), só os campos que o
    painel usa. Assim a ficha de cada ativo mostra o histórico de opiniões sem baixar a biblioteca inteira."""
    ini = (hoje - dt.timedelta(days=dias)).isoformat()
    out = []
    for m in meses_disponiveis():
        if m < ini[:7]:
            continue
        for x in ler_mes(m).get('itens') or []:
            if x.get('agrupado_em') or x.get('acervo') or data_de(x) < ini or bloqueado(x):
                continue
            x = atualizar_leitura(x, oregon, hoje)
            if x.get('natureza') != 'opiniao_casa':
                continue
            out.append({k: x[k] for k in CAMPOS_OPINIAO if k in x})
    out.sort(key=lambda x: (x.get('publicado_em') or x.get('detectado_em') or ''), reverse=True)
    os.makedirs(os.path.join(dados_dir(), PASTA), exist_ok=True)
    gravar(_caminho('opinioes.json'), {'gerado_em': agora_.isoformat(timespec='minutes'), 'dias': dias, 'n': len(out), 'itens': out})
    return out


CATEGORIAS_RESEARCH = ('gestora_internacional', 'gestora_brasil', 'instituicao', 'academia', 'youtube')


def publicar_research(hoje, agora_, dias=90, oregon=None):
    """biblioteca/research.json: cartas, research e publicações de instituições com data de publicação nos últimos `dias`
    (90), para a página Research do Mundo e Estratégia separar 7 dias, 8 a 30 e 31 a 90 sem baixar meses inteiros.
    Itens sem data na fonte e o acervo ficam de fora (estão na Biblioteca)."""
    ini = (hoje - dt.timedelta(days=dias)).isoformat()
    out = []
    for m in meses_disponiveis():
        if m < ini[:7]:
            continue
        for x in ler_mes(m).get('itens') or []:
            if x.get('agrupado_em') or x.get('acervo') or not x.get('publicado_em') or x['publicado_em'][:10] < ini or x.get('categoria') not in CATEGORIAS_RESEARCH or bloqueado(x):
                continue
            ft = FILTROS_TITULO.get(x.get('fonte_id'))
            if ft and not re.search(ft, x.get('titulo') or '', re.I):
                continue
            x = atualizar_leitura(x, oregon, hoje)
            if x.get('natureza') in ('promocional', 'sensacionalista'):  # o Research é para leitura de gestão, não texto de venda
                continue
            y = {k: x[k] for k in CAMPOS_OPINIAO if k in x}
            for k in ('pdf', 'titulo_provisorio', 'fatores', 'etfs_tema'):
                if x.get(k):
                    y[k] = x[k]
            out.append(y)
    out.sort(key=lambda x: x.get('publicado_em') or '', reverse=True)
    os.makedirs(os.path.join(dados_dir(), PASTA), exist_ok=True)
    gravar(_caminho('research.json'), {'gerado_em': agora_.isoformat(timespec='minutes'), 'dias': dias, 'n': len(out), 'itens': out})
    return out


# ------------------------------------------------------------------ contadores por fonte
MOTIVOS = ('sem_titulo', 'sem_link', 'antigo', 'bloqueada', 'robots', 'promocional', 'repetido_no_feed')


def contadores_iniciais(fontes):
    return {f['id']: {'nome': f.get('nome') or f['id'], 'recebidos': 0, 'rejeitados': {}, 'duplicados': 0, 'novos': 0, 'classificados': 0, 'publicados': 0,
                      'erros': 0, 'ultima_ok': None, 'ultimo_erro': None, 'ultimo_erro_em': None, 'ultima_rodada': None} for f in fontes}


def registrar(coleta, fid, nome, recebidos=0, rejeitados=None, duplicados=0, novos=0, classificados=0, publicados=0, erro=None, marca=None, aguardando=None):
    c = coleta.setdefault(fid, {'nome': nome, 'recebidos': 0, 'rejeitados': {}, 'duplicados': 0, 'novos': 0, 'classificados': 0, 'publicados': 0, 'erros': 0,
                                 'ultima_ok': None, 'ultimo_erro': None, 'ultimo_erro_em': None, 'ultima_rodada': None})
    c['nome'] = nome
    c['recebidos'] += recebidos
    for k, v in (rejeitados or {}).items():
        c['rejeitados'][k] = c['rejeitados'].get(k, 0) + v
    c['duplicados'] += duplicados
    c['novos'] += novos
    c['classificados'] += classificados
    c['publicados'] += publicados
    c['ultima_rodada'] = {'quando': marca, 'recebidos': recebidos, 'rejeitados': sum((rejeitados or {}).values()), 'duplicados': duplicados, 'novos': novos, 'erro': erro, 'aguardando': aguardando}
    c['aguardando'] = aguardando
    if aguardando:
        return c
    if erro:
        c['erros'] += 1
        c['ultimo_erro'], c['ultimo_erro_em'] = str(erro)[:200], marca
        c['seguidas'] = falhas_seguidas(c) + 1 if c.get('seguidas') is not None else falhas_seguidas(c)
    else:
        c['ultima_ok'] = marca
        c['seguidas'] = 0
        c.pop('pausa', None)
    return c


def falhas_seguidas(c):
    """Falhas desde o último sucesso (v3.8). Para fontes registradas antes do contador, estima pelo histórico:
    sem sucesso depois do último erro → o total de erros."""
    if c.get('seguidas') is not None:
        return int(c['seguidas'])
    if c.get('ultimo_erro_em') and (not c.get('ultima_ok') or c['ultimo_erro_em'] > c['ultima_ok']):
        return int(c.get('erros') or 0)
    return 0
