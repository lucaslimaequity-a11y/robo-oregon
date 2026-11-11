# -*- coding: utf-8 -*-
"""v4.2 · Pautas da semana, do mês e do ano (pedido do Lucas em 11/11/2026: "pauta da semana, pauta do mês e a pauta do
ano … para a gente começar a criar uma história").

O que entra (só o que importa; notícia comum continua na ficha do ativo):
  - Empresas, por escopo e sem misturar: Carteira Oregon (pilares Dividendos, Valor e FIIs, de painel/src/data.json) e
    carteiras VG VIP (Dividendos, Valor e Smallcaps, de painel/src/vip.json). Por empresa: fato relevante e documentos à CVM,
    resultado, mudança de recomendação e opinião de casa de análise (a casa é a que a fonte cita), evento corporativo
    (recompra, fusão, guidance, gestão, dívida, oferta), notícia do setor que mexe com a empresa e notícia de prioridade alta.
  - Macro do Brasil (a marcação x.macro_br: juros, inflação, fiscal, câmbio, atividade, bolsa) e macro do mundo (juros e
    bancos centrais, China, commodities, geopolítica, tecnologia, atividade e mercados), com fonte oficial na frente.
  - Só da Oregon: temas dos ETFs no exterior e notícias de resultado de empresas lá fora; alocação de ativos (cartas de
    gestoras, research sobre alocação, temas dos ETFs de renda fixa).
Regras:
  - Nada é escrito por máquina: cada linha é uma manchete coletada, com veículo, data e link. O mesmo fato em vários veículos
    vira uma linha (o veículo conhecido na frente) com a conta dos demais.
  - InfoMoney (Grupo XP), fontes bloqueadas, acervo e itens agrupados ficam fora: a pauta vai para material de cliente.
  - Semana = últimos 7 dias, refeita a cada rodada. Mês = mês do calendário: o corrente é refeito a cada rodada, o anterior
    também nos 10 primeiros dias do mês seguinte; os outros ficam guardados no arquivo, e nenhuma falha os apaga.
  - Ano: os meses guardados + o que tem fonte oficial desde janeiro, buscado pelo robô no máximo uma vez por dia:
      mediana do Focus da primeira divulgação do ano e a mais recente (Banco Central, Olinda);
      fatos relevantes do ano das empresas acompanhadas (CVM, base aberta IPE; CNPJ e nome conferidos).
    Valor já obtido nunca é apagado por falha de fonte: fica o anterior. Selic, IPCA, dólar e CDI do fim do ano anterior e de
    hoje o painel lê direto do Banco Central (SGS), como já faz no Mercado hoje: o robô continua sem chamar o SGS
    (intel.indicadores_macro = false), e uma falha dessas fontes nunca marca a rodada.
  - "O que a gente acha": quando a tese muda em painel/src/data.json (recomendação, preço-teto, preço justo, ponto, tese) ou
    em painel/src/vip.json (sugestão, teto, justo, alocação, risco), a versão nova é guardada com a data. A comparação do ano
    usa só essas versões; antes do primeiro registro não há o que comparar e o painel diz isso.
Arquivo publicado: data/biblioteca/pautas.json (vai para o site com a biblioteca, sem mexer no robo.yml)."""
import datetime as dt
import json
import os
import re
import urllib.parse

import analise
from util import ErroFonte, sem_acento

BRT = dt.timezone(dt.timedelta(hours=-3))
VERSAO = 1
SEMANA = 7
DIAS_MES_ANTERIOR = 10
ORDEM = ('fato', 'resultado', 'recomendacao', 'evento', 'opiniao', 'cvm', 'setor', 'noticia')
ROTULOS = {'fato': 'Fato relevante', 'resultado': 'Resultado', 'recomendacao': 'Mudança de recomendação', 'evento': 'Evento corporativo',
           'opiniao': 'Opinião de casa', 'cvm': 'Documento à CVM', 'setor': 'Setor e macro', 'noticia': 'Notícia de destaque', 'macro': 'Macro'}
TETO = {'semana': {'fato': 3, 'resultado': 3, 'recomendacao': 4, 'evento': 2, 'opiniao': 3, 'cvm': 2, 'setor': 2, 'noticia': 2},
        'mes': {'fato': 6, 'resultado': 4, 'recomendacao': 6, 'evento': 3, 'opiniao': 4, 'cvm': 3, 'setor': 3, 'noticia': 3}}
TETO_TEMA = {'semana': 4, 'mes': 6}
PILARES_OREGON = (('P5', 'dividendos', 'Pilar Dividendos'), ('P6', 'valor', 'Pilar Valor'), ('P7', 'fiis', 'FIIs'))
MACRO_BR = (('juros', 'Juros'), ('inflacao', 'Inflação'), ('fiscal', 'Fiscal'), ('cambio', 'Câmbio'), ('atividade', 'Atividade'), ('bolsa', 'Bolsa'))
MUNDO = (('juros', 'Juros e bancos centrais', {'juros', 'inflacao'}), ('china', 'China', {'china'}), ('commodities', 'Commodities e petróleo', {'commodities'}),
         ('geopolitica', 'Geopolítica', {'geopolitica'}), ('tecnologia', 'Tecnologia e IA', {'tecnologia_ia'}),
         ('atividade', 'Atividade e mercados', {'atividade', 'bolsa', 'emergentes', 'europa', 'credito', 'cambio', 'fiscal'}))
FORA = {'eua', 'europa', 'china', 'global', 'japao', 'emergentes'}
OFICIAL_TIPOS = {'macro', 'documento_oficial', 'discurso', 'dado_oficial'}
# Mudança de recomendação: verbo de revisão na manchete de opinião de casa ("Itaú BBA rebaixa VALE3", "eleva preço-alvo")
RX_MUDANCA = re.compile(r'\b(eleva|elevou|elevam|rebaix|corta|cortou|reduz|reduziu|aumenta|aumentou|revis|melhora|piora|inicia|iniciou|retoma|'
                        r'upgrad|downgrad|initiat|raises?|lowers?|cuts?)\w*|\bagora e (compra|venda|neutr)|\bpassa(m)? a (recomendar|compra|venda|neutr)')
# decisão ou dado oficial de juros, inflação e atividade (Copom, IBGE, Fed, BCE…), em português e em inglês
RX_DECISAO = re.compile(r'\b(copom|selic|ata|ipca|ipca-15|pib|caged|pnad|ibc-br|inflacao|taxa de juros|fomc|monetary policy|policy rate|interest rates?|rate decision|'
                        r'federal funds|minutes|inflation|cpi|pce|gdp|payrolls?|employment situation|unemployment|retail sales)\b')
RX_RESULTADO_FORA = re.compile(r'\b(earnings|quarterly|quarter|guidance|revenue|profit|resultado|lucro|receita|balanco|trimestre)\b')
FOCUS = ('IPCA', 'Selic', 'PIB Total', 'Câmbio')
CAMPOS_OREGON = ('rec', 'teto', 'justo', 'ponto', 'tese')
CAMPOS_VIP = ('sugestao', 'teto', 'justo', 'alocacao', 'risco')
PARADA = {'para', 'com', 'que', 'dos', 'das', 'nos', 'nas', 'por', 'uma', 'sobre', 'apos', 'mais', 'mas', 'como', 'seu', 'sua', 'the', 'and', 'veja'}
AQUI = os.path.dirname(os.path.abspath(__file__))


# ------------------------------------------------------------------ carteiras
def carregar_carteiras(cfg, caminho=None):
    """Grupos de empresas de cada escopo e os temas de ETF (exterior, renda fixa). Fonte: painel/src/data.json e vip.json."""
    caminho = caminho or os.environ.get('ROBO_OREGON') or os.path.join(AQUI, '..', 'painel', 'src', 'data.json')
    try:
        with open(caminho, encoding='utf-8') as f:
            dados = json.load(f)
    except Exception:
        dados = {}
    try:
        with open(os.path.join(os.path.dirname(caminho), 'vip.json'), encoding='utf-8') as f:
            vip = json.load(f)
    except Exception:
        vip = {}
    at = dados.get('ativos') or {}
    oregon = []
    for pilar, gid, nome in PILARES_OREGON:
        ts = sorted(t for t, a in at.items() if a.get('pilar') == pilar and a.get('status') != 'placeholder')
        if ts:
            oregon.append({'id': gid, 'nome': nome, 'tickers': ts})
    vips = []
    for c in vip.get('carteiras') or []:
        ts = []
        for a in c.get('ativos') or []:
            t = a.get('noticias_de') or a.get('ticker')
            if t and t not in ts:
                ts.append(t)
        if ts:
            vips.append({'id': c.get('id'), 'nome': c.get('nome') or c.get('id'), 'tickers': ts})
    nomes = {t: a.get('nome') or t for t, a in at.items()}
    for c in vip.get('carteiras') or []:
        for a in c.get('ativos') or []:
            t = a.get('noticias_de') or a.get('ticker')
            if t and t not in nomes:
                nomes[t] = a.get('empresa') or t
    exterior, renda_fixa = set(), set()
    for e in (cfg.get('noticias') or {}).get('etfs') or []:
        ps = {(at.get(t) or {}).get('pilar') for t in e.get('etfs') or []}
        if ps & {'P9', 'P10', 'P11', 'P12', 'P13'}:
            exterior.add(e.get('tema'))
        elif ps & {'P1', 'P2', 'P3', 'P4'}:
            renda_fixa.add(e.get('tema'))
    return {'oregon': oregon, 'vip': vips, 'nomes': nomes, 'exterior': exterior, 'renda_fixa': renda_fixa, 'dados': dados, 'vip_js': vip}


# ------------------------------------------------------------------ itens
def _norm(s):
    return sem_acento(s or '').lower()


def _xp(x):
    return bool(re.search(r'\binfomoney\b|grupo xp', _norm(' '.join([x.get('organizacao') or '', x.get('fonte') or '', x.get('aviso_fonte') or '']))))


def _desconhecido(x):
    return bool(x.get('via')) and x.get('confiavel') is False


def _quando(x):
    p = x.get('publicado_em') or x.get('detectado_em') or ''
    try:
        if len(p) <= 10:
            return dt.datetime.fromisoformat(p[:10] + 'T12:00:00-03:00')
        q = dt.datetime.fromisoformat(p)
        return q if q.tzinfo else q.replace(tzinfo=BRT)
    except ValueError:
        return None


def _ts(x):
    q = _quando(x)
    return q.timestamp() if q else 0


def utilizavel(x, agora_, bloqueado=None):
    """Item que pode ir para a pauta: data conhecida e não futura, fora do acervo e dos agrupados, sem Grupo XP nem fonte bloqueada."""
    if x.get('acervo') or x.get('agrupado_em') or _xp(x) or (bloqueado and bloqueado(x)):
        return False
    q = _quando(x)
    return bool(q) and q <= agora_ + dt.timedelta(hours=6)


def _tickers(x, escopo, alvo):
    ts = list(x.get('ativos') or [])
    if escopo == 'vip':
        ts += [t for t in x.get('ativos_vip') or [] if t not in ts]
    return [t for t in ts if t in alvo]


def _vinculo(x, t, escopo):
    v = None
    if escopo == 'vip' and t in (x.get('ativos_vip') or []):
        v = (x.get('vinculos_vip') or {}).get(t)
    if v is None:
        v = (x.get('vinculos') or {}).get(t)
    return v or analise.vinculo(x, t)


def _setor_de(x, escopo, alvo):
    ts = list(x.get('setor_de') or [])
    if escopo == 'vip':
        ts += [t for t in x.get('setor_de_vip') or [] if t not in ts]
    return [t for t in ts if t in alvo]


def tipo(x, v):
    """Tipo do item para a empresa (ou None quando é notícia comum, que fica só na ficha)."""
    if x.get('categoria') == 'oficial_empresa':
        return 'fato' if (x.get('tipo') == 'fato_relevante' or x.get('categoria_cvm') == 'Fato Relevante') else 'cvm'
    if x.get('natureza') == 'opiniao_casa':
        return 'recomendacao' if RX_MUDANCA.search(_norm(x.get('titulo'))) else 'opiniao'
    if (v or {}).get('evento') == 'resultado':
        return 'resultado'
    if analise.eventos_de(x.get('titulo')):
        return 'evento'
    if (x.get('prioridade') or {}).get('nivel') == 'alta':
        return 'noticia'
    return None


def _fichas(t):
    s = re.sub(r'[^a-z0-9%,. ]', ' ', _norm(t))
    return [w for w in (p.rstrip('.,') for p in s.split()) if len(w) > 2 and w not in PARADA]


def agrupar(itens, horas=48):
    """O mesmo fato em vários veículos (na ordem recebida, o primeiro de cada grupo é o principal). Devolve [(item, n_outros)]."""
    gs = []
    for x in itens:
        tk = set(_fichas(x.get('titulo')))
        nums = {w for w in tk if re.search(r'\d', w) and not re.match(r'^[1-4]t\d{2}$', w) and not re.match(r'^20\d\d$', w)}
        q = _quando(x)
        alvo = None
        casas = set(x.get('casas') or [])
        for g in gs:
            if not q or not g['q'] or abs((g['q'] - q).total_seconds()) > horas * 3600:
                continue
            if casas and g['casas'] and not casas & g['casas']:
                continue  # duas casas diferentes falando da mesma empresa são dois fatos
            inter = len(tk & g['tk'])
            uni = len(tk | g['tk']) or 1
            if inter / uni >= 0.34 or (inter >= 2 and nums & g['nums']):
                alvo = g
                break
        if alvo:
            alvo['outros'] += 1
        else:
            gs.append({'x': x, 'tk': tk, 'nums': nums, 'q': q, 'outros': 0, 'casas': casas})
    return [(g['x'], g['outros']) for g in gs]


def _pontos(x):
    return (x.get('prioridade') or {}).get('pontos') or 0


def _peso_macro(x):
    """Decisão e dado oficial na frente (Copom, IBGE, Fed); discurso pesa pouco; veículo pouco conhecido perde."""
    p = _pontos(x)
    if x.get('categoria') == 'instituicao':
        if x.get('tipo') in ('documento_oficial', 'macro', 'dado_oficial') and RX_DECISAO.search(_norm(x.get('titulo'))):
            p += 30
        elif x.get('tipo') != 'discurso':
            p -= 5  # documento administrativo de banco central (nomeações, dados de supervisão) não passa na frente da notícia
    if _desconhecido(x):
        p -= 15
    return p


def _noticia_macro(x):
    """Manchete que serve para a macro: veículo ou instituição; sem blog, estudo acadêmico, carta nem research (vão para a Biblioteca)."""
    cat, tp = x.get('categoria') or '', x.get('tipo') or ''
    if cat not in ('veiculo', 'instituicao') or tp in ('blog', 'paper', 'carta', 'research'):
        return False
    if tp == 'relatorio' and cat != 'instituicao':
        return False
    return x.get('natureza') in ('noticia', 'original', 'opiniao_casa')


def _ordem_data(l):
    return sorted(l, key=lambda x: (1 if _desconhecido(x) else 0, -_ts(x)))


def _ordem_peso(l, peso):
    return sorted(l, key=lambda x: (-peso(x), -_ts(x)))


def empresas(itens, escopo, grupos, teto):
    """{ticker: {'n': {tipo: quantos fatos}, 'i': [[id, tipo, outros veículos], ...]}} só das empresas com algo no período."""
    alvo = {t for g in grupos for t in g['tickers']}
    por = {}
    for x in itens:
        diretos = []
        for t in _tickers(x, escopo, alvo):
            v = _vinculo(x, t, escopo)
            if (v or {}).get('tipo') != 'direto':
                continue
            k = tipo(x, v)
            if not k:
                continue
            if k in ('evento', 'opiniao', 'noticia') and _desconhecido(x) and x.get('categoria') == 'veiculo':
                continue  # veículo pouco conhecido sem fato da empresa: fica recolhido na ficha, como na pauta da semana
            por.setdefault(t, {}).setdefault(k, []).append(x)
            diretos.append(t)
        if x.get('natureza') in ('noticia', 'original') and x.get('categoria') in ('veiculo', 'instituicao') and not _desconhecido(x):
            for t in _setor_de(x, escopo, alvo):
                if t not in diretos:
                    por.setdefault(t, {}).setdefault('setor', []).append(x)
    out = {}
    for t, ks in por.items():
        linhas, cont = [], {}
        for k in ORDEM:
            l = ks.get(k) or []
            if not l:
                continue
            gs = agrupar(_ordem_peso(l, _peso_macro) if k == 'setor' else _ordem_data(l))
            cont[k] = len(gs)
            gs = gs[:teto[k]]
            if k != 'setor':
                gs.sort(key=lambda g: -_ts(g[0]))
            linhas += [[g[0]['id'], k, g[1]] for g in gs]
        if linhas:
            out[t] = {'n': cont, 'i': linhas}
    return out


def _temas(por, ordem, teto):
    out = {}
    for k in ordem:
        l = por.get(k) or []
        if not l:
            continue
        gs = agrupar(_ordem_peso(l, _peso_macro))
        out[k] = {'n': len(gs), 'i': [[g[0]['id'], 'macro', g[1]] for g in gs[:teto]]}
    return out


def macro_brasil(itens, teto):
    por = {}
    for x in itens:
        if not _noticia_macro(x):
            continue
        tags = list(x.get('macro_br') or [])
        if not tags and x.get('categoria') == 'instituicao' and x.get('pais') == 'Brasil' and RX_DECISAO.search(_norm(x.get('titulo'))):
            tags = analise.macro_br(x.get('titulo'), x.get('idioma') or 'pt')  # Copom, IBGE: decisão e dado oficial (liquidação de banco, consulta pública… ficam fora)
        tags = [m for m in tags if m != 'agenda']
        if tags:
            por.setdefault(tags[0], []).append(x)
    return _temas(por, [k for k, _n in MACRO_BR], teto)


def macro_mundo(itens, teto):
    por = {}
    for x in itens:
        if not _noticia_macro(x) or x.get('natureza') == 'opiniao_casa' or x.get('macro_br') or x.get('ativos') or x.get('ativos_vip'):
            continue
        if (x.get('categoria') == 'instituicao' and x.get('pais') == 'Brasil') or analise.macro_br(x.get('titulo'), x.get('idioma') or 'pt'):
            continue  # é macro do Brasil
        if x.get('categoria') == 'instituicao' and not RX_DECISAO.search(_norm(x.get('titulo'))):
            continue  # discurso e documento de banco central sem decisão nem dado ficam na Biblioteca
        reg = set(x.get('regioes') or [])
        if not reg & FORA:
            continue
        temas = set(x.get('temas') or [])
        g = next((k for k, _n, ts in MUNDO if temas & ts or (k == 'china' and 'china' in reg)), None)
        if g:
            por.setdefault(g, []).append(x)
    return _temas(por, [k for k, _n, _t in MUNDO], teto)


def exterior(itens, temas_exterior, teto):
    """Temas dos ETFs no exterior da Oregon e resultados de empresas lá fora (manchete de resultado, região fora do Brasil)."""
    por = {}
    for x in itens:
        if not _noticia_macro(x) or x.get('natureza') == 'opiniao_casa' or x.get('macro_br') or _desconhecido(x):
            continue
        reg = set(x.get('regioes') or [])
        if not reg & FORA:
            continue  # tema de ETF lá fora, mas a manchete é do Brasil
        te = [t for t in x.get('temas_etf') or [] if t in temas_exterior]
        if te and x.get('temas'):  # sem nenhum tema de mercado a manchete só casou a palavra da busca (ex.: "tips")
            por.setdefault(te[0], []).append(x)
            continue
        if (x.get('categoria') == 'veiculo' and x.get('natureza') in ('noticia', 'original') and reg & FORA and 'brasil' not in reg
                and not x.get('ativos') and RX_RESULTADO_FORA.search(_norm(x.get('titulo')))):
            por.setdefault('Resultados de empresas lá fora', []).append(x)
    ordem = sorted(k for k in por if k != 'Resultados de empresas lá fora') + ['Resultados de empresas lá fora']
    return _temas(por, ordem, teto)


def alocacao(itens, temas_rf, teto):
    """Cartas e research de gestoras (uma por gestora), estudos sobre alocação e os temas dos ETFs de renda fixa."""
    por, gestoras = {}, set()
    for x in _ordem_data(itens):
        cat, tp = x.get('categoria') or '', x.get('tipo') or ''
        if cat.startswith('gestora_') and tp in ('carta', 'research', 'relatorio'):
            org = x.get('organizacao') or x.get('fonte')
            if org in gestoras:
                continue
            gestoras.add(org)
            por.setdefault('cartas', []).append(x)
            continue
        if 'alocacao' in (x.get('temas') or []) and cat in ('instituicao', 'gestora_brasil', 'gestora_internacional') and tp not in ('blog', 'paper'):
            por.setdefault('alocacao', []).append(x)
            continue
        te = [t for t in x.get('temas_etf') or [] if t in temas_rf]
        if te and _noticia_macro(x) and x.get('natureza') != 'opiniao_casa' and not _desconhecido(x):
            por.setdefault('renda_fixa', []).append(x)
    out = {}
    for k in ('cartas', 'alocacao', 'renda_fixa'):
        l = por.get(k) or []
        if not l:
            continue
        gs = agrupar(_ordem_data(l) if k == 'cartas' else _ordem_peso(l, _peso_macro))
        out[k] = {'n': len(gs), 'i': [[g[0]['id'], 'macro', g[1]] for g in gs[:teto * (2 if k == 'cartas' else 1)]]}
    return out


def compacto(x):
    o = {'t': (x.get('titulo') or '')[:240], 'l': x.get('link') or '', 'o': (x.get('organizacao') or x.get('fonte') or '')[:80], 'd': (x.get('publicado_em') or '')[:16]}
    for k, c in (('casas', 'c'), ('recomendacao', 'r'), ('preco_alvo', 'a'), ('analista', 'an'), ('categoria_cvm', 'cv'), ('posicao', 'p')):
        v = x.get(k)
        if v:
            o[c] = v[:3] if isinstance(v, list) else str(v)[:120]
    if x.get('categoria') in ('instituicao', 'oficial_empresa') or x.get('tipo') in OFICIAL_TIPOS:
        o['of'] = 1
    if _desconhecido(x):
        o['u'] = 1
    return o


def periodo(itens, cart, tipo_periodo):
    """Pauta de um período: empresas por escopo + macro + (Oregon) exterior e alocação."""
    teto = TETO[tipo_periodo]
    tt = TETO_TEMA[tipo_periodo]
    return {'oregon': {'empresas': empresas(itens, 'oregon', cart['oregon'], teto)},
            'vip': {'empresas': empresas(itens, 'vip', cart['vip'], teto)},
            'macro_br': macro_brasil(itens, tt), 'mundo': macro_mundo(itens, tt),
            'exterior': exterior(itens, cart['exterior'], tt), 'alocacao': alocacao(itens, cart['renda_fixa'], tt)}


def _ids(p):
    out = set()

    def lin(d):
        for v in (d or {}).values():
            for l in v.get('i') or []:
                out.add(l[0])
    for e in ('oregon', 'vip'):
        lin((p.get(e) or {}).get('empresas'))
    for k in ('macro_br', 'mundo', 'exterior', 'alocacao'):
        lin(p.get(k))
    return out


def contagem(p):
    """Números do resumo, por escopo: quantos fatos de cada tipo nas empresas e quantas manchetes de macro."""
    out = {}
    for e in ('oregon', 'vip'):
        c = {}
        for v in ((p.get(e) or {}).get('empresas') or {}).values():
            for k, n in (v.get('n') or {}).items():
                c[k] = c.get(k, 0) + n
        c['empresas'] = len((p.get(e) or {}).get('empresas') or {})
        out[e] = c
    out['macro_br'] = sum(v['n'] for v in (p.get('macro_br') or {}).values())
    out['mundo'] = sum(v['n'] for v in (p.get('mundo') or {}).values())
    return out


# ------------------------------------------------------------------ ano: Focus e fatos relevantes
def focus_inicio(rede, ano):
    """Mediana da primeira divulgação do Focus no ano, para o próprio ano (IPCA, Selic, PIB, câmbio)."""
    filtro = '(' + ' or '.join("Indicador eq '%s'" % i for i in FOCUS) + ") and Data ge '%d-01-01' and Data le '%d-01-20'" % (ano, ano)
    q = urllib.parse.urlencode({'$filter': filtro, '$orderby': 'Data asc', '$top': '3000', '$format': 'json'}, quote_via=urllib.parse.quote)
    linhas = rede.get_json('Focus', 'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?' + q, timeout=40).get('value', [])
    out = {}
    for ind in FOCUS:
        rs = [r for r in linhas if r.get('Indicador') == ind and str(r.get('DataReferencia')) == str(ano) and r.get('baseCalculo', 0) in (0, '0')
              and isinstance(r.get('Mediana'), (int, float))]
        if rs:
            d0 = min(r['Data'] for r in rs)
            r = next(r for r in rs if r['Data'] == d0)
            out[ind] = {'mediana': float(r['Mediana']), 'data': d0}
    if not out:
        raise ErroFonte('Focus', 'vazio', 'sem divulgação do Focus em janeiro de %d' % ano)
    return out


def focus_ano(rede, fontes_macro, ano, hoje, anterior):
    ant = anterior or {}
    out, erros = {}, []
    ini = {k: v.get('inicio') for k, v in ant.items() if v.get('inicio')}
    if len(ini) < len(FOCUS):
        try:
            ini.update({k: v for k, v in focus_inicio(rede, ano).items() if k not in ini})
        except Exception as e:
            erros.append('Focus de janeiro: %s' % type(e).__name__)
    agora_f = {}
    try:
        f = fontes_macro.focus(rede, hoje)
        for k in FOCUS:
            a = ((f.get(k) or {}).get('anos') or {}).get(str(ano))
            if a and a.get('mediana') is not None:
                agora_f[k] = {'mediana': a['mediana'], 'data': f[k].get('data')}
    except Exception as e:
        erros.append('Focus recente: %s' % type(e).__name__)
    for k in FOCUS:
        x = {}
        if ini.get(k):
            x['inicio'] = ini[k]
        if agora_f.get(k) or (ant.get(k) or {}).get('agora'):
            x['agora'] = agora_f.get(k) or ant[k]['agora']
        if x:
            out[k] = x
    return out, erros


def fatos_do_ano(rede, conteudo, fonte_cvm, ano, agora_, anterior):
    """Fatos relevantes do ano (CVM, IPE) por empresa: [{'d': data, 'a': assunto, 'l': link}]. Falha mantém o anterior."""
    f = dict(fonte_cvm, url_coleta=(fonte_cvm.get('url_coleta') or '').replace('{ano}', str(ano)), categorias=['Fato Relevante'], maximo=5000)
    itens, _n = conteudo.cvm_ipe(rede, f, agora_, '%d-01-01' % ano)
    out = {}
    for x in itens:
        for t in x.get('ativos') or []:
            assunto = (x.get('titulo') or '').split(': ', 1)[-1]
            out.setdefault(t, []).append({'d': (x.get('publicado_em') or '')[:10], 'a': assunto[:200], 'l': x.get('link') or ''})
    for t in out:
        vis, l = set(), []
        for o in sorted(out[t], key=lambda o: o['d'], reverse=True):
            if (o['d'], o['a']) not in vis:
                vis.add((o['d'], o['a']))
                l.append(o)
        out[t] = l
    if not out and anterior:
        return anterior
    return out


# ------------------------------------------------------------------ "o que a gente acha": versões das teses
def teses(anterior, cart, hoje):
    """Guarda uma versão nova da tese quando algum campo muda. Nunca apaga versão antiga."""
    out = {'oregon': dict((anterior or {}).get('oregon') or {}), 'vip': {k: dict(v) for k, v in ((anterior or {}).get('vip') or {}).items()}}
    dados = cart.get('dados') or {}
    for g in cart.get('oregon') or []:
        for t in g['tickers']:
            a = (dados.get('ativos') or {}).get(t) or {}
            v = {k: a.get(k) for k in CAMPOS_OREGON}
            if not any(v.get(k) is not None for k in ('rec', 'teto', 'justo')):
                continue
            hist = list(out['oregon'].get(t) or [])
            if not hist or {k: hist[-1].get(k) for k in CAMPOS_OREGON} != v:
                hist.append(dict(v, data=a.get('data_preco'), fonte=a.get('fonte_preco'), registrado_em=hoje.isoformat()))
            out['oregon'][t] = hist
    vip = cart.get('vip_js') or {}
    for c in vip.get('carteiras') or []:
        cid = c.get('id')
        dest = out['vip'].setdefault(cid, {})
        for a in c.get('ativos') or []:
            t = a.get('ticker')
            if not t:
                continue
            v = {k: a.get(k) for k in CAMPOS_VIP}
            hist = list(dest.get(t) or [])
            if not hist or {k: hist[-1].get(k) for k in CAMPOS_VIP} != v:
                hist.append(dict(v, data=vip.get('print_em'), registrado_em=hoje.isoformat()))
            dest[t] = hist
    return out


# ------------------------------------------------------------------ montagem
def _meses_do_ano(hoje):
    return ['%d-%02d' % (hoje.year, m) for m in range(1, hoje.month + 1)]


def publicar(agora_, anterior, carregar_mes, itens_semana, cfg, cart, rede=None, fontes_macro=None, conteudo=None, fonte_cvm=None, bloqueado=None):
    """Monta o pautas.json. carregar_mes(m) → itens do mês 'AAAA-MM'; itens_semana() → itens dos últimos 7 dias.
    A rede (Focus e fatos relevantes do ano) é usada no máximo uma vez por dia; sem rede, fica o que já estava no arquivo."""
    anterior = anterior or {}
    hoje = agora_.astimezone(BRT).date()
    ano = hoje.year
    refazer = anterior.get('versao') != VERSAO
    meses_ant = {} if refazer else dict(anterior.get('meses') or {})
    itens_ant = {} if refazer else dict(anterior.get('itens') or {})
    ok = lambda x: utilizavel(x, agora_, bloqueado)  # noqa: E731

    meses = {}
    m_atual = hoje.strftime('%Y-%m')
    m_ant = (hoje.replace(day=1) - dt.timedelta(days=1)).strftime('%Y-%m')
    alvo_meses = sorted(set(_meses_do_ano(hoje)) | {m for m in meses_ant if m >= '%d-01' % (ano - 1)})
    itens = {}
    for m in alvo_meses:
        guardado = meses_ant.get(m)
        if guardado and m != m_atual and not (m == m_ant and hoje.day <= DIAS_MES_ANTERIOR):
            meses[m] = guardado
            for i in _ids(guardado):
                if i in itens_ant:
                    itens[i] = itens_ant[i]
            continue
        try:
            lista = [x for x in carregar_mes(m) if ok(x) and (x.get('publicado_em') or '')[:7] == m]
        except Exception:
            if guardado:
                meses[m] = guardado
                for i in _ids(guardado):
                    if i in itens_ant:
                        itens[i] = itens_ant[i]
            continue
        p = periodo(lista, cart, 'mes')
        p['de'] = m + '-01'
        p['ate'] = min(hoje, (dt.date(int(m[:4]), int(m[5:]), 28) + dt.timedelta(days=4)).replace(day=1) - dt.timedelta(days=1)).isoformat()
        p['parcial'] = m == m_atual
        p['n_itens'] = len(lista)
        p['contagem'] = contagem(p)
        por_id = {x['id']: x for x in lista}
        for i in _ids(p):
            if i in por_id:
                itens[i] = compacto(por_id[i])
        meses[m] = p
    sem = [x for x in itens_semana() if ok(x) and _quando(x) >= agora_ - dt.timedelta(days=SEMANA)]
    semana = periodo(sem, cart, 'semana')
    semana['de'] = (hoje - dt.timedelta(days=SEMANA - 1)).isoformat()
    semana['ate'] = hoje.isoformat()
    semana['n_itens'] = len(sem)
    semana['contagem'] = contagem(semana)
    por_id = {x['id']: x for x in sem}
    for i in _ids(semana):
        if i in por_id:
            itens[i] = compacto(por_id[i])
        elif i in itens_ant:
            itens[i] = itens_ant[i]

    # ano: rede no máximo uma vez por dia
    anos = dict(anterior.get('anos') or {})
    a_ant = dict(anos.get(str(ano)) or {})
    erros = []
    if rede is not None and a_ant.get('rede_em') != hoje.isoformat():
        if fontes_macro is not None:
            foc, e2 = focus_ano(rede, fontes_macro, ano, hoje, a_ant.get('focus'))
            a_ant['focus'] = foc or a_ant.get('focus') or {}
            erros += e2
        if conteudo is not None and fonte_cvm:
            try:
                a_ant['fatos'] = fatos_do_ano(rede, conteudo, fonte_cvm, ano, agora_, a_ant.get('fatos'))
            except Exception as e:
                erros.append('fatos relevantes do ano: %s' % type(e).__name__)
        a_ant['rede_em'] = hoje.isoformat()
        a_ant['erros'] = erros
    anos[str(ano)] = a_ant

    return {'versao': VERSAO, 'gerado_em': agora_.isoformat(timespec='minutes'),
            'metodo': 'Só manchetes coletadas (veículo, data e link); nenhum texto escrito por máquina. Empresas: fato relevante e documentos à CVM, '
                      'resultado, mudança de recomendação e opinião de casa (a casa é a citada pela fonte), evento corporativo, notícia do setor e notícia '
                      'de prioridade alta. Macro com fonte oficial na frente. O mesmo fato em vários veículos vira uma linha. InfoMoney (Grupo XP) fica fora.',
            'rotulos': ROTULOS, 'macro_nomes': dict(MACRO_BR), 'mundo_nomes': {k: n for k, n, _t in MUNDO},
            'grupos': {'oregon': cart['oregon'], 'vip': cart['vip']}, 'nomes': {t: cart['nomes'].get(t, t) for g in cart['oregon'] + cart['vip'] for t in g['tickers']},
            'semana': semana, 'meses': meses, 'anos': anos, 'teses': teses(anterior.get('teses'), cart, hoje), 'itens': itens}


def resumo(js):
    s = (js.get('semana') or {}).get('contagem') or {}
    m = sorted((js.get('meses') or {}).keys())
    anos = js.get('anos') or {}
    a = anos[max(anos)] if anos else {}
    return 'semana: Oregon %d empresas, VIP %d; %d meses; %d itens; ano: %d no Focus, fatos relevantes de %d empresas%s' % (
        (s.get('oregon') or {}).get('empresas', 0), (s.get('vip') or {}).get('empresas', 0), len(m), len(js.get('itens') or {}),
        len(a.get('focus') or {}), len(a.get('fatos') or {}), ('; ' + '; '.join(a['erros'][:3])) if a.get('erros') else '')
