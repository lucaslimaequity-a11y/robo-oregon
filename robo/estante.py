"""Estante (v3.5): acervo permanente de autores e séries clássicas, separado do Research de 90 dias.

Cada coleção (Mauboussin, CFA Institute Research Foundation, memos de Howard Marks, Damodaran, AQR, GMO) junta três origens:
  1. semente   — lista conferida à mão e guardada no repositório (robo/sementes/estante/<id>.json), para o que a internet não
                 lista mais num lugar só (os artigos do Mauboussin de 1995 a 2019, por exemplo);
  2. listagem  — a página pública da série ou da biblioteca do autor, lida pelo mesmo coletor de páginas do robô
                 (conteudo.pagina), com robots.txt respeitado; listagens paginadas são lidas aos poucos, algumas páginas por rodada;
  3. feed      — o feed público do blog (Blogger/Atom), lido em lotes (start-index) até o primeiro post.

Regras: só título, data, link e um resumo curto quando a própria página o declara (nada de texto integral nem PDF copiado);
nada é apagado — uma falha de leitura mantém o acervo publicado e só marca a coleção com o erro; o link aponta sempre para a
fonte original (ou, quando ela não existe mais num endereço público, para o índice do próprio autor, com o aviso).
Temas por palavra-chave do título, com a lista de palavras pública em TEMAS (não é classificação por IA)."""
import datetime as dt
import hashlib
import json
import os
import re
import unicodedata

import html
import urllib.parse

import conteudo
from conteudo import ErroFonte, limpa_texto, link_seguro

AQUI = os.path.dirname(os.path.abspath(__file__))
SEMENTES = os.path.join(AQUI, 'sementes', 'estante')

# Temas da Estante: palavra-chave no título (ou no resumo da própria página). Um item pode ter mais de um tema.
TEMAS = [
    ('valuation', 'Valuation e expectativas', r'valuation|\bdcf\b|discounted cash|intrinsic value|multiples?\b|expectations investing|market-expected|price.to|p/e\b|present value|growth opportunit|math of value|precifica'),
    ('criacao_valor', 'ROIC, vantagem competitiva e criação de valor', r'\broic\b|return on (invested )?capital|economic profit|value creation|wealth creation|moat|competitive advantage|competitive strategy|increasing returns|red queen|strategy|vantagem competitiva'),
    ('capital', 'Alocação de capital', r'capital allocation|buyback|repurchase|dividend|m&a\b|merger|acquisition|issuance|cash holdings|capital deployment|share count|equity issuance|aloca[cç][aã]o de capital|recompra|dividendo'),
    ('custo_capital', 'Custo de capital, juros e prêmio de risco', r'cost of capital|\bwacc\b|discount rate|risk premium|equity risk|interest rate|rates?\b.*(rise|fall|higher|lower)|yield curve|real rates?|juros|pr[eê]mio de risco'),
    ('decisao', 'Decisão, probabilidade e comportamento', r'behavio|bias|psycholog|decision|judg(e)?ment|confidence|probabilit|expected value|base rate|bayes|luck|skill|forecast|wisdom of crowds|pattern recognition|mental model|feedback|myth|variant perception|uncertainty|comportament|vi[eé]s'),
    ('mercados', 'Eficiência de mercado e gestão ativa', r'market efficien|inefficien|active (management|managers?|investing)|alpha|indexing|passive|other side|crowd|concentration|dispersion|stock picking|hedge fund|efficient market|gest[aã]o ativa'),
    ('risco_ciclos', 'Risco, ciclos e crises', r'\brisk|drawdown|cycle|volatil|recession|crisis|crash|bubble|tail|leverage|panic|bear market|bull market|uncertain|ciclo|crise|risco'),
    ('macro', 'Macro, inflação e moedas', r'inflation|monetary|central bank|\bfed\b|currency|dollar|\bfx\b|emerging markets?|geopolit|fiscal|debt|deficit|tariff|trade war|china|economy|macro|infla[cç][aã]o|c[aâ]mbio'),
    ('fatores', 'Fatores e investimento sistemático', r'factor|momentum|value premium|value investing|\bvalue\b.*(spread|growth)|quality|carry|low.?risk|low.?vol|trend.?follow|systematic|quant|smart beta|anomal'),
    ('longo_prazo', 'Retornos de longo prazo e alocação de ativos', r'long.run|long.term returns?|stocks for the long run|centur|historical returns?|expected returns?|asset allocation|portfolio construction|diversif|60/40|total portfolio|retirement|wealth'),
    ('privados', 'Mercados privados e crédito', r'private (equity|credit|markets?)|venture|alternatives?|illiquid|buyout|direct lending|high.yield|distressed|credit'),
    ('contabilidade', 'Contabilidade, intangíveis e fluxo de caixa', r'intangible|accounting|earnings|cash flow|stock.based compensation|free cash|categoriz|cash conversion|cont[aá]bil'),
    ('esg', 'Clima, energia e sustentabilidade', r'\besg\b|climate|sustainab|energy transition|carbon|renewable|electricity|energ'),
    ('ia_tecnologia', 'Tecnologia e inteligência artificial', r'\bai\b|artificial intelligence|machine learning|technolog|digital|software|internet|\.com\b|new economy|anthropic|openai|nvidia'),
]
_TEMAS_RX = [(k, n, re.compile(rx, re.I)) for k, n, rx in TEMAS]


def sem_acento(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s or '') if unicodedata.category(c) != 'Mn')


def chave_titulo(t):
    """Título normalizado para casar a mesma peça em origens diferentes (semente x listagem)."""
    t = sem_acento(t or '').lower().replace('’', "'").replace('“', '"').replace('”', '"').replace('&', ' and ')
    t = re.sub(r'\(updated\)|\bupdated\b|\b2\.0\b', lambda m: ' ' + m.group(0).strip('()') + ' ', t)
    return re.sub(r'[^a-z0-9]+', ' ', t).strip()


def chave_curta(t):
    """Antes dos dois-pontos ("Cost of Capital: A Practical Guide…" e "Cost of Capital" são a mesma peça)."""
    return chave_titulo((t or '').split(':')[0].split('?')[0] + ('?' if '?' in (t or '').split(':')[0] else ''))


def temas_de(titulo, resumo=''):
    txt = (titulo or '') + ' ' + (resumo or '')
    return [k for k, _n, rx in _TEMAS_RX if rx.search(txt)]


def ident(col, link, titulo, ano=None):
    base = (link or '') if link and '#' not in link else '%s|%s' % (chave_titulo(titulo), ano or '')
    return col + ':' + hashlib.sha1(base.encode('utf-8')).hexdigest()[:12]


def _data_txt(ano, md):
    """'2026' + '2/10' -> '2026-02-10'; sem dia/mês, só o ano."""
    try:
        m, d = [int(v) for v in str(md or '').split('/')[:2]]
        return dt.date(int(ano), m, d).isoformat()
    except Exception:
        return str(ano) if ano else None


def carregar_semente(col_id):
    p = os.path.join(SEMENTES, col_id + '.json')
    if not os.path.exists(p):
        return []
    with open(p, encoding='utf-8') as fh:
        js = json.load(fh)
    return js.get('itens') or []


def novo_item(col, titulo, link, data=None, origem='listagem', agora_=None, **extra):
    titulo = limpa_texto(titulo, 300)
    if not titulo:
        return None
    link = link_seguro(link) if link else ''
    ano = int(data[:4]) if data and re.match(r'^\d{4}', data) else extra.pop('ano', None)
    x = {'id': ident(col['id'], link, titulo, ano), 'col': col['id'], 'titulo': titulo, 'link': link, 'data': data, 'ano': ano, 'origem': origem}
    if agora_ is not None:
        x['detectado_em'] = agora_.isoformat(timespec='minutes')
    for k, v in extra.items():
        if v not in (None, '', [], {}):
            x[k] = v
    x['temas'] = temas_de(titulo, x.get('resumo'))
    return x


def _pseudo_fonte(col, lst, url, metodo='pagina'):
    f = {'id': 'estante-' + col['id'], 'nome': 'Estante · ' + col['nome'], 'organizacao': col.get('organizacao') or col['nome'], 'categoria': col.get('categoria', 'gestora_internacional'),
         'tipo': 'research', 'idioma': col.get('idioma', 'en'), 'pais': col.get('pais', ''), 'metodo': metodo, 'url_coleta': url, 'maximo': int(lst.get('maximo', 400)),
         'padrao': lst.get('padrao'), 'padrao_data': lst.get('padrao_data'), 'guardar_resumo': True, 'exige_links': True, 'fuso': lst.get('fuso')}
    return f


def ler_listagem(rede, robots, col, lst, n, agora_):
    """Página n (1, 2, …) de uma listagem. Devolve (itens, links_no_padrao)."""
    url = lst['url']
    if n > 1:
        if not lst.get('paginas'):
            return [], 0
        url = lst['url'] + lst['paginas'].replace('{n}', str(n - 1 + int(lst.get('primeira_pagina', 1))))
    elif lst.get('paginas') and lst.get('pagina1_com_parametro'):
        url = lst['url'] + lst['paginas'].replace('{n}', str(int(lst.get('primeira_pagina', 1))))
    metodo = lst.get('metodo', 'pagina')
    f = _pseudo_fonte(col, lst, url, metodo=metodo)
    brutos, n_links = conteudo.coletar_fonte(rede, f, agora_, '1900-01-01', set(), robots=robots)
    out = []
    excl = re.compile(lst['excluir'], re.I) if lst.get('excluir') else None
    for i, b in enumerate(brutos):
        if excl and (excl.search(b.get('link') or '') or excl.search(b.get('titulo') or '')):
            continue
        # no sitemap, a data é a da última alteração da página (não a de publicação): fica só o ano do endereço, se houver
        data = None if metodo == 'sitemap' else ((b.get('publicado_em') or '')[:10] or None)
        ano = None
        if lst.get('ano_link'):
            ma = re.search(lst['ano_link'], b.get('link') or '')
            if ma:
                ano = int(ma.group(1))
        tipo = lst.get('tipo')
        if lst.get('tipo_link'):
            mt = re.search(lst['tipo_link'], b.get('link') or '', re.I)
            if mt:
                tipo = (lst.get('tipos') or {}).get(mt.group(1).lower(), mt.group(1).replace('-', ' '))
        x = novo_item(col, b.get('titulo'), b.get('link'), data, 'listagem', agora_, ano=ano,
                      instituicao=lst.get('instituicao') or col.get('organizacao'), tipo=tipo, pdf=b.get('pdf'), posicao=b.get('posicao_pagina') or (i + 1),
                      titulo_provisorio=True if (b.get('titulo_provisorio') or metodo == 'sitemap') else None)
        if x:
            out.append(x)
    return out, n_links


def ler_feed(rede, robots, col, fd, inicio, agora_):
    """Lote do feed Atom/RSS do blog a partir de `inicio` (Blogger: start-index, até 150 por vez)."""
    url = fd['url'].replace('{i}', str(inicio))
    f = _pseudo_fonte(col, fd, url, metodo='rss')
    f['maximo'] = int(fd.get('lote', 150))
    brutos, n = conteudo.coletar_fonte(rede, f, agora_, '1900-01-01', set(), robots=robots)
    out = []
    for b in brutos:
        x = novo_item(col, b.get('titulo'), b.get('link'), (b.get('publicado_em') or '')[:10] or None, 'feed', agora_,
                      instituicao=fd.get('instituicao') or col.get('organizacao'), tipo=fd.get('tipo', 'post'))
        if x:
            out.append(x)
    return out, n


def ler_detalhe(rede, robots, col, x, agora_):
    """Abre a página do item (só nas coleções com ler_item): data e resumo declarados pela página e anexos (resumos em PDF)."""
    if not x.get('link') or (robots is not None and not robots.permite(x['link'])):
        return False
    txt = rede.get('Estante · ' + col['nome'], x['link'], timeout=20, tentativas=1).decode('utf-8', 'replace')
    y = {'titulo': x['titulo'], 'link': x['link'], 'publicado_em': None}
    # fuso BRT: uma data sem hora ("2025-05-21") é aquele dia, não a meia-noite UTC (que em Brasília cairia no dia anterior)
    conteudo.ler_pagina_item(rede, robots, y, {'id': 'estante-' + col['id'], 'guardar_resumo': True, 'categoria': 'instituicao', 'fuso': 'BRT'}, agora_, txt=txt)
    if y.get('publicado_em'):  # a data declarada pela própria página vale mais que a da listagem ou da semente
        x['data'], x['ano'] = y['publicado_em'][:10], int(y['publicado_em'][:4])
    if x.get('titulo_provisorio'):  # título do endereço (sitemap): troca pelo da página
        t = titulo_da_pagina(txt, col.get('sufixo_titulo'))
        if t:
            x['titulo'] = t
            x.pop('titulo_provisorio', None)
    if y.get('resumo') and not x.get('resumo'):
        x['resumo'] = limpa_texto(y['resumo'], 400)
    if y.get('autor') and not x.get('autor'):
        x['autor'] = y['autor']
    if col.get('anexos'):
        vistos, anexos = set(), []
        for m in re.finditer(r'<a\b[^>]*href\s*=\s*["\']([^"\']+)["\'][^>]*>(.*?)</a>', txt, re.I | re.S):
            href = m.group(1)
            if not re.search(col['anexos'], href, re.I):
                continue
            u = link_seguro(urllib.parse.urljoin(x["link"], html.unescape(href)))
            if not u or u in vistos:
                continue
            vistos.add(u)
            rot = rotulo_anexo(u)  # rótulo em português pelo nome do arquivo (resumo para investidores, livro completo…)
            if rot == 'PDF':
                txt_l = limpa_texto(m.group(2), 80)
                if txt_l and not conteudo.ROTULO_GENERICO.match(txt_l) and not re.match(r'(?i)^(view|download)\s*(pdf)?$', txt_l):
                    rot = txt_l
            anexos.append({'rotulo': rot, 'url': u})
        if anexos:
            x['anexos'] = anexos[:6]
    x['temas'] = temas_de(x['titulo'], x.get('resumo'))
    x['pagina_lida_em'] = agora_.isoformat(timespec='minutes')
    return True


def titulo_da_pagina(txt, sufixo=None):
    """og:title, depois o primeiro <h1>, depois <title>; sem o nome do site no fim ("… | CFA Institute")."""
    for rx in (r'<meta[^>]+property=["\']og:title["\'][^>]*content=["\']([^"\']+)', r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*property=["\']og:title["\']',
               r'<h1[^>]*>(.*?)</h1>', r'<title[^>]*>(.*?)</title>'):
        m = re.search(rx, txt, re.I | re.S)
        if m:
            t = limpa_texto(html.unescape(re.sub(r'<[^>]+>', ' ', m.group(1))), 300)
            t = re.sub(r'\s*[|–—-]\s*(CFA Institute.*|AQR.*|GMO.*|Oaktree.*|Morgan Stanley.*)$', '', t, flags=re.I)
            if sufixo:
                t = re.sub(sufixo, '', t, flags=re.I).strip()
            if len(t) >= 4:
                return t
    return None


def rotulo_anexo(u):
    n = u.rsplit('/', 1)[-1].lower()
    for k, r in (('academic-brief', 'Resumo acadêmico'), ('practitioner-brief', 'Resumo para profissionais'), ('investor-brief', 'Resumo para investidores'), ('brief', 'Resumo'),
                 ('monograph', 'Livro completo (PDF)'), ('book', 'Livro completo (PDF)'), ('literature-review', 'Revisão (PDF)')):
        if k in n:
            return r
    return 'PDF'


def casar_links(itens, fontes_link):
    """Itens da semente sem link ganham o link da listagem oficial quando o título casa (mesma peça)."""
    por_tit, por_curto = {}, {}
    for y in fontes_link:
        por_tit.setdefault(chave_titulo(y['titulo']), y)
        por_curto.setdefault(chave_curta(y['titulo']), y)
    for x in itens:
        if x.get('link') and x.get('link_tipo') != 'indice_autor':
            continue
        y = por_tit.get(chave_titulo(x['titulo'])) or por_curto.get(chave_curta(x['titulo']))
        if y and (not x.get('data') or not y.get('data') or abs(int(x['data'][:4]) - int(y['data'][:4])) <= 1):
            x['link'], x['link_tipo'] = y['link'], 'original'
            x.pop('link_nota', None)
            if y.get('data') and len(y['data']) == 10 and len(x.get('data') or '') < 10:
                x['data'] = y['data']
            x['_casou'] = y['id']
    return itens


def mesma_epoca(x, y):
    """Mesma peça? Com as duas datas completas, até 3 dias de diferença (listagens costumam errar um dia); sem isso, até um
    ano. Edições anuais com o mesmo título (ex.: "Capital Allocation Outside the US", 2015 e 2016) continuam separadas."""
    a, b = str(x.get('data') or ''), str(y.get('data') or '')
    if len(a) == 10 and len(b) == 10:
        try:
            return abs((dt.date.fromisoformat(a) - dt.date.fromisoformat(b)).days) <= 3
        except ValueError:
            return False
    if not x.get('ano') or not y.get('ano'):
        return True
    return abs(int(x['ano']) - int(y['ano'])) <= 1


def _mesclar(ant, novo):
    """Junta duas versões do mesmo item sem perder o que já se sabia."""
    real = not ant.get('titulo_provisorio')
    for k, v in novo.items():
        if k in ('id', 'origem', 'detectado_em', 'posicao', 'pagina_lida_em') or (real and k in ('titulo', 'titulo_provisorio')):
            continue
        if k == 'data' and len(str(ant.get('data') or '')) == 10:
            continue
        if k in ('link', 'link_tipo', 'link_nota') and ant.get('link_tipo') == 'original' and novo.get('link_tipo') == 'indice_autor':
            continue  # o link da editora, já achado, não volta a ser o do índice do autor numa rodada sem leitura da listagem
        if v not in (None, '', [], {}) and (ant.get(k) in (None, '', [], {}) or k in ('link', 'link_tipo', 'anexos', 'temas') or (k == 'data' and len(str(v)) > len(str(ant.get('data') or '')))):
            ant[k] = v
    if ant.get('link_tipo') == 'original':
        ant.pop('link_nota', None)
    return ant


def _quando(iso, agora_):
    try:
        d = dt.datetime.fromisoformat(iso)
        return d if d.tzinfo else d.replace(tzinfo=agora_.tzinfo)
    except Exception:
        return agora_ - dt.timedelta(days=3650)


def atualizar(cfg, rede, robots, hoje, agora_, estado, publicado, log_=print):
    """Monta biblioteca/estante.json. `publicado` é o arquivo anterior (nada dele é apagado)."""
    ec = cfg.get('estante') or {}
    if not ec.get('ativo', True):
        return None
    st = estado.setdefault('estante', {})
    ant = {x['id']: x for x in (publicado or {}).get('itens') or []}
    cols_ant = {c['id']: c for c in (publicado or {}).get('colecoes') or []}
    orcamento = int(ec.get('max_paginas_por_rodada', 8))
    ler_max = int(ec.get('ler_item_max', 6))
    ler_total = int(ec.get('ler_item_total', 30))  # páginas de item por rodada, somando as coleções
    intervalo = dt.timedelta(hours=float(ec.get('intervalo_horas', 168)))
    colecoes, itens = [], dict(ant)
    for col in ec.get('colecoes') or []:
        if col.get('ativo') is False:
            continue
        s = st.setdefault(col['id'], {})
        info = dict(cols_ant.get(col['id']) or {})
        info.update({k: col.get(k) for k in ('id', 'nome', 'autor', 'organizacao', 'descricao', 'site', 'idioma', 'nota_links') if col.get(k)})
        erros, lidos = [], 0
        # 1. semente (sempre: é a lista conferida)
        sem = []
        for y in carregar_semente(col['id']):
            x = novo_item(col, y.get('titulo'), y.get('link'), y.get('data') or _data_txt(y.get('ano'), y.get('md')), 'semente', None,
                          ano=y.get('ano'), instituicao=y.get('instituicao'), tipo=y.get('tipo'), resumo=y.get('resumo'), autor=y.get('autor'), serie=y.get('serie'))
            if not x:
                continue
            if not x.get('link') and col.get('indice_autor'):
                x['link'], x['link_tipo'], x['link_nota'] = col['indice_autor'], 'indice_autor', col.get('nota_links') or 'Sem endereço público da editora; abre o índice do próprio autor.'
                if col.get('anexo_indice'):  # ex.: coleção completa dos memos em PDF, publicada pela própria Oaktree
                    x['anexos'] = [dict(col['anexo_indice'])]
            elif x.get('link'):
                x['link_tipo'] = y.get('link_tipo') or 'original'
            sem.append(x)
        # 2. listagens (página 1 a cada intervalo; as demais aos poucos até o fim)
        pagos = []
        vence = not s.get('lido_em') or agora_ - _quando(s['lido_em'], agora_) >= intervalo
        for i, lst in enumerate(col.get('listagens') or []):
            k = 'lst%d' % i
            if vence and s.get(k + '_fim') and lst.get('reler_todas'):  # sitemap em várias páginas: a releitura semanal passa por todas
                s[k + '_fim'], s[k + '_prox'] = False, 2
            prox = int(s.get(k + '_prox', 1))
            fim = s.get(k + '_fim', False)
            paginas = [1] if vence else []
            if not fim and lst.get('paginas'):
                paginas += [p for p in range(max(2, prox), max(2, prox) + 3)]
            for p in paginas:
                if orcamento <= 0:
                    break
                orcamento -= 1
                try:
                    novos_l, n_links = ler_listagem(rede, robots, col, lst, p, agora_)
                except ErroFonte as e:
                    if p == 1:
                        erros.append(str(e))
                    else:  # página além do fim (404) encerra a paginação
                        s[k + '_fim'] = True
                    break
                except Exception as e:  # pragma: no cover - proteção
                    erros.append(type(e).__name__)
                    break
                lidos += 1
                pagos += novos_l
                if p > 1:
                    s[k + '_prox'] = p + 1
                    if p >= int(lst.get('max_paginas', 40)) or (not lst.get('continuar_sem_itens') and (not n_links or not novos_l)):
                        s[k + '_fim'] = True
                        break
        # 3. feed em lotes (start-index), até o primeiro post
        for i, fd in enumerate(col.get('feeds') or []):
            k = 'feed%d' % i
            if s.get(k + '_fim') and not vence:
                continue
            inicio = int(s.get(k + '_prox', 1)) if not s.get(k + '_fim') else 1
            for _ in range(int(fd.get('lotes_por_rodada', 2))):
                if orcamento <= 0:
                    break
                orcamento -= 1
                try:
                    novos_f, n = ler_feed(rede, robots, col, fd, inicio, agora_)
                except ErroFonte as e:
                    erros.append(str(e))
                    break
                lidos += 1
                pagos += novos_f
                if s.get(k + '_fim'):
                    break  # já completo: só o lote mais recente
                inicio += int(fd.get('lote', 150))
                s[k + '_prox'] = inicio
                if n < int(fd.get('lote', 150)):
                    s[k + '_fim'] = True
                    break
        if vence and lidos and not erros:
            s['lido_em'] = agora_.isoformat(timespec='minutes')
        # 4. junta: semente + listagem; a mesma peça (mesmo título) vira um item só, com o link oficial
        casar_links(sem, pagos)
        casados = {x.pop('_casou') for x in sem if x.get('_casou')}
        for x in sem + [y for y in pagos if y['id'] not in casados]:
            x.pop('_casou', None)
            if x['id'] in itens:
                _mesclar(itens[x['id']], x)
            else:
                # mesma peça já publicada com outro id (o link mudou, ou a semente ganhou link): fica a antiga, atualizada
                dup = next((y for y in itens.values() if y['col'] == col['id'] and chave_titulo(y['titulo']) == chave_titulo(x['titulo']) and mesma_epoca(x, y)), None)
                if dup:
                    _mesclar(dup, x)
                else:
                    itens[x['id']] = x
        # 5. página de cada item (data, resumo e anexos), poucos por rodada
        if col.get('ler_item'):
            padrao_item = re.compile(col['ler_item_padrao'], re.I) if col.get('ler_item_padrao') else None
            pend = [x for x in itens.values() if x['col'] == col['id'] and x.get('link') and x.get('link_tipo', 'original') == 'original' and not x.get('pagina_lida_em')
                    and (not padrao_item or padrao_item.search(x['link']))]
            pend.sort(key=lambda x: (0 if x.get('titulo_provisorio') else 1, -(int(x.get('ano') or 0)), x.get('posicao') or 999))
            n_ler = min(int(col.get('ler_item_max', ler_max)), max(0, ler_total))
            ler_total -= n_ler
            for x in pend[:n_ler]:
                try:
                    ler_detalhe(rede, robots, col, x, agora_)
                except Exception:
                    x['pagina_lida_em'] = agora_.isoformat(timespec='minutes')  # não insiste na mesma página toda rodada
        mine = [x for x in itens.values() if x['col'] == col['id']]
        anos = sorted(int(x['ano']) for x in mine if x.get('ano'))
        info.update({'total': len(mine), 'de': anos[0] if anos else None, 'ate': anos[-1] if anos else None,
                     'verificado_em': agora_.isoformat(timespec='minutes') if lidos else info.get('verificado_em'),
                     'status': 'erro' if erros and not lidos else 'completo' if all(s.get('lst%d_fim' % i, not l.get('paginas')) for i, l in enumerate(col.get('listagens') or [])) and all(s.get('feed%d_fim' % i) for i in range(len(col.get('feeds') or []))) else 'enchendo',
                     'erro': '; '.join(erros)[:200] if erros else None})
        colecoes.append({k: v for k, v in info.items() if v is not None})
        log_('  estante %s: %d itens (%d páginas lidas%s)' % (col['id'], len(mine), lidos, '; falha: ' + '; '.join(erros)[:120] if erros else ''))
    out = sorted(itens.values(), key=lambda x: (x.get('data') or str(x.get('ano') or '')), reverse=True)
    for x in out:
        x.pop('posicao', None)
    return {'gerado_em': agora_.isoformat(timespec='minutes'), 'colecoes': colecoes, 'temas': [[k, n] for k, n, _ in TEMAS], 'n': len(out), 'itens': out,
            'nota': 'Acervo permanente: título, data e link para a fonte original. Nenhum texto integral é copiado.'}
