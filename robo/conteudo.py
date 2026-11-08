# -*- coding: utf-8 -*-
"""Coletores de conteúdo público do Oregon Intelligence.

Cada fonte cadastrada em robo/fontes.json tem um `metodo`:
  - rss        : RSS 2.0 ou Atom (título, link, data, autor, resumo curto, anexos PDF);
  - youtube    : feed público de um canal (youtube.com/feeds/videos.xml?channel_id=...);
  - pagina     : página HTML pública; novos links que casem com um padrão (ex.: PDFs de cartas) viram itens.
                 Sem data no texto, o item recebe publicado_em = null e detectado_em = agora;
  - api        : APIs públicas já usadas pelo robô (IBGE notícias/releases).

Regras (docs/FONTES.md):
  - só conteúdo público e gratuito; nada de login, paywall ou contorno de bloqueio (403 encerra a fonte na rodada);
  - robots.txt é respeitado: um caminho vedado ao nosso agente é pulado e contado como rejeitado;
  - de veículos de imprensa guardamos só título, link, data e veículo (nunca o texto);
  - de gestoras e instituições guardamos um resumo curto (até 300 caracteres) do próprio feed, quando houver;
  - nenhuma data é inventada: feed sem data confiável usa a data de detecção, marcada como tal.
"""
import datetime as dt
import hashlib
import html
import re
import urllib.parse
import urllib.robotparser
import xml.etree.ElementTree as ET

from util import BRT, UA, ErroFonte, sem_acento

NS = {'atom': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015', 'media': 'http://search.yahoo.com/mrss/',
      'dc': 'http://purl.org/dc/elements/1.1/', 'content': 'http://purl.org/rss/1.0/modules/content/'}
RESUMO_MAX = 300
TITULO_MAX = 220


# ------------------------------------------------------------------ utilidades
def ident(link, titulo=''):
    """Identidade estável de um item: o link normalizado (sem utm, sem âncora); sem link, o título."""
    base = _normaliza_link(link) or sem_acento(titulo).lower().strip()
    return hashlib.sha1(base.encode('utf-8')).hexdigest()[:16]


def _normaliza_link(u):
    u = (u or '').strip()
    if not re.match(r'^https?://', u, re.I):
        return ''
    p = urllib.parse.urlsplit(u)
    q = [(k, v) for k, v in urllib.parse.parse_qsl(p.query, keep_blank_values=True) if not k.lower().startswith(('utm_', 'fbclid', 'gclid', 'mc_cid', 'mc_eid'))]
    host = p.netloc.lower()
    path = re.sub(r'/{2,}', '/', p.path).rstrip('/') or '/'
    return urllib.parse.urlunsplit((p.scheme.lower(), host, path, urllib.parse.urlencode(q), ''))


def link_seguro(u):
    u = (u or '').strip()
    return u if re.match(r'^https?://', u, re.I) else ''


def limpa_texto(s, maximo=RESUMO_MAX):
    s = html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))
    s = re.sub(r'\s+', ' ', s).strip()
    if len(s) > maximo:
        corte = s[:maximo].rsplit(' ', 1)[0]
        s = corte + '…'
    return s


def data_iso(txt):
    """Datas de RSS/Atom/ISO para ISO em Brasília (minutos). None quando não reconhece: nunca inventa."""
    txt = (txt or '').strip()
    if not txt:
        return None
    try:
        d = dt.datetime.fromisoformat(txt.replace('Z', '+00:00'))
        return (d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)).astimezone(BRT).isoformat(timespec='minutes')
    except ValueError:
        pass
    for f in ('%a, %d %b %Y %H:%M:%S %z', '%a, %d %b %Y %H:%M:%S %Z', '%d %b %Y %H:%M:%S %z', '%a, %d %b %Y %H:%M %z', '%Y-%m-%d'):
        try:
            d = dt.datetime.strptime(txt, f)
            if d.tzinfo is None:
                d = d.replace(tzinfo=dt.timezone.utc)
            return d.astimezone(BRT).isoformat(timespec='minutes')
        except ValueError:
            continue
    for rx, ordem in ((r'(\d{4})/(\d{2})/(\d{2})', (1, 2, 3)), (r'(\d{1,2})/(\d{1,2})/(\d{4})', (3, 2, 1)), (r'(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)', (1, 2, 3))):
        m = re.search(rx, txt)
        if m:
            try:
                return dt.datetime(int(m.group(ordem[0])), int(m.group(ordem[1])), int(m.group(ordem[2])), 12, 0, tzinfo=BRT).isoformat(timespec='minutes')
            except ValueError:
                return None
    return None


def _novo_item(f, titulo, link, quando, agora_, resumo='', autor='', extra=None):
    titulo = limpa_texto(titulo, TITULO_MAX)
    link = link_seguro(link)
    if not titulo:
        return None
    guarda_resumo = f.get('guardar_resumo', f.get('categoria') != 'veiculo')
    x = {'id': ident(link, titulo), 'titulo': titulo, 'link': link, 'fonte_id': f['id'], 'fonte': f.get('nome') or f['id'], 'organizacao': f.get('organizacao') or f.get('nome'),
         'categoria': f.get('categoria') or 'veiculo', 'pais': f.get('pais') or '', 'idioma': f.get('idioma') or 'pt', 'tipo': f.get('tipo') or 'noticia',
         'publicado_em': quando, 'detectado_em': agora_.isoformat(timespec='minutes'), 'data_estimada': quando is None,
         'resumo': limpa_texto(resumo) if (guarda_resumo and resumo) else '', 'autor': limpa_texto(autor, 80) if autor else ''}
    if extra:
        x.update(extra)
    return x


# ------------------------------------------------------------------ robots.txt
class Robots:
    """Um robots.txt por host, lido uma vez por rodada. Falha ao baixar o robots.txt = permitido (regra usual)."""

    def __init__(self, rede):
        self.rede, self.cache = rede, {}

    def permite(self, url):
        p = urllib.parse.urlsplit(url)
        host = p.scheme + '://' + p.netloc
        rp = self.cache.get(host)
        if rp is None:
            rp = urllib.robotparser.RobotFileParser()
            try:
                corpo = self.rede.get('robots.txt', host + '/robots.txt', timeout=10, tentativas=1)
                rp.parse(corpo.decode('utf-8', 'replace').splitlines())
            except Exception:  # sem robots.txt (404) ou sem resposta: permitido, como manda a convenção
                rp = True
            self.cache[host] = rp
        if rp is True:
            return True
        try:
            return rp.can_fetch(UA.split('/')[0], url)
        except Exception:
            return True


# ------------------------------------------------------------------ coletores
def _local(tag):
    return tag.rsplit('}', 1)[-1] if '}' in tag else tag


def _filho(el, *nomes):
    """Primeiro filho cujo nome local (sem namespace) esteja em `nomes`. RSS 2.0, RSS 1.0/RDF e Atom sem distinção."""
    for c in el:
        if _local(c.tag) in nomes:
            return c
    return None


def _texto_filho(el, *nomes):
    c = _filho(el, *nomes)
    return (c.text or '').strip() if c is not None and c.text else ''


def rss(rede, f, agora_, desde_iso, bloqueio=()):
    """RSS 2.0, RSS 1.0 (RDF, usado pelo BIS) ou Atom. Devolve (itens, recebidos).
    Em feeds agregadores (Google Notícias) o <source> vira a organização e veículos bloqueados são descartados."""
    nome = f.get('nome') or f['id']
    corpo = rede.get(nome, f['url_coleta'], timeout=25, tentativas=2)
    try:
        raiz = ET.fromstring(corpo)
    except ET.ParseError:
        raise rede.falha(nome, 'formato', 'feed inválido (não é XML)')
    brutos = []
    for el in raiz.iter():
        loc = _local(el.tag)
        if loc == 'item':
            lk = _texto_filho(el, 'link') or el.get('{http://www.w3.org/1999/02/22-rdf-syntax-ns#}about') or _texto_filho(el, 'guid')
            enc = next((c for c in el if _local(c.tag) == 'enclosure' and ('pdf' in (c.get('type') or '').lower() or (c.get('url') or '').lower().endswith('.pdf'))), None)
            src = _filho(el, 'source')
            brutos.append({'titulo': _texto_filho(el, 'title'), 'link': lk, 'data': _texto_filho(el, 'pubDate', 'date', 'published', 'updated'),
                           'resumo': _texto_filho(el, 'description', 'encoded', 'summary'), 'autor': _texto_filho(el, 'author', 'creator'),
                           'pdf': enc.get('url') if enc is not None else None, 'veiculo': (src.text or '').strip() if src is not None and src.text else ''})
        elif loc == 'entry':
            links = [c for c in el if _local(c.tag) == 'link']
            lk = next((l.get('href') for l in links if l.get('rel') in (None, 'alternate')), None) or (links[0].get('href') if links else '')
            pdf = next((l.get('href') for l in links if 'pdf' in (l.get('type') or '').lower()), None)
            au = _filho(el, 'author')
            brutos.append({'titulo': _texto_filho(el, 'title'), 'link': lk, 'data': _texto_filho(el, 'published', 'updated'),
                           'resumo': _texto_filho(el, 'summary', 'content'), 'autor': _texto_filho(au, 'name') if au is not None else '', 'pdf': pdf, 'veiculo': ''})
    out = []
    for b in brutos:
        quando = data_iso(b['data'])
        if quando and quando[:10] < desde_iso:
            continue
        tit, extra = b['titulo'], {}
        if b['veiculo']:
            if any(sem_acento(x).lower() in sem_acento(b['veiculo']).lower() for x in bloqueio if x):
                continue
            if tit.endswith(' - ' + b['veiculo']):
                tit = tit[: -len(' - ' + b['veiculo'])]
            extra['organizacao'] = b['veiculo']
        if b['pdf']:
            extra['pdf'] = link_seguro(b['pdf'])
        x = _novo_item(f, tit, b['link'], quando, agora_, b['resumo'], b['autor'], extra or None)
        if x:
            out.append(x)
    if brutos and not out and not any(data_iso(b['data']) for b in brutos):
        # feed sem nenhuma data reconhecível: entram como detectados hoje (data_estimada), para não perder conteúdo
        for b in brutos[: int(f.get('maximo', 30))]:
            x = _novo_item(f, b['titulo'], b['link'], None, agora_, b['resumo'], b['autor'])
            if x:
                out.append(x)
    return out[: int(f.get('maximo', 40))], len(brutos)


def youtube(rede, f, agora_, desde_iso, chave=None):
    """Vídeos de um canal oficial. Caminho preferido: YouTube Data API v3 (chave gratuita em YOUTUBE_API_KEY), que lê a
    playlist de uploads do canal por 1 unidade de cota. Sem chave, tenta o feed público videos.xml — mas só se o robots.txt
    do YouTube permitir (hoje ele veda /feeds/videos.xml para robôs genéricos; nesse caso a fonte fica aguardando chave)."""
    nome = f.get('nome') or f['id']
    canal = f.get('canal_id') or ''
    if not canal and 'channel_id=' in (f.get('url_coleta') or ''):
        canal = urllib.parse.parse_qs(urllib.parse.urlsplit(f['url_coleta']).query).get('channel_id', [''])[0]
    if not re.match(r'^UC[A-Za-z0-9_-]{20,}$', canal):
        raise ErroFonte(nome, 'formato', 'canal_id inválido')
    if chave:
        playlist = 'UU' + canal[2:]
        url = ('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=%d&playlistId=%s&key=%s'
               % (min(int(f.get('maximo', 10)), 50), playlist, urllib.parse.quote(chave)))
        js = rede.get_json(nome, url, timeout=25, tentativas=2, tipo_403='autenticacao')
        out, n = [], 0
        for it in js.get('items') or []:
            n += 1
            sn = it.get('snippet') or {}
            vid = ((sn.get('resourceId') or {}).get('videoId')) or ''
            quando = data_iso(sn.get('publishedAt'))
            if quando and quando[:10] < desde_iso:
                continue
            lk = 'https://www.youtube.com/watch?v=' + vid if re.match(r'^[A-Za-z0-9_-]{6,20}$', vid) else ''
            x = _novo_item(dict(f, tipo='video'), sn.get('title'), lk, quando, agora_, sn.get('description') or '', sn.get('channelTitle') or '', {'video_id': vid} if vid else None)
            if x:
                out.append(x)
        return out, n
    url = f.get('url_coleta') or ('https://www.youtube.com/feeds/videos.xml?channel_id=' + canal)
    corpo = rede.get(nome, url, timeout=25, tentativas=2)
    try:
        raiz = ET.fromstring(corpo)
    except ET.ParseError:
        raise rede.falha(nome, 'formato', 'feed do YouTube inválido')
    out, n = [], 0
    for en in raiz.iter('{%s}entry' % NS['atom']):
        n += 1
        vid = en.findtext('{%s}videoId' % NS['yt']) or ''
        tit = en.findtext('{%s}title' % NS['atom'])
        quando = data_iso(en.findtext('{%s}published' % NS['atom']))
        if quando and quando[:10] < desde_iso:
            continue
        desc = en.findtext('{%s}group/{%s}description' % (NS['media'], NS['media'])) or ''
        au = en.find('{%s}author/{%s}name' % (NS['atom'], NS['atom']))
        lk = ('https://www.youtube.com/watch?v=' + vid) if re.match(r'^[A-Za-z0-9_-]{6,20}$', vid) else next((l.get('href') for l in en.findall('{%s}link' % NS['atom'])), '')
        x = _novo_item(dict(f, tipo='video'), tit, lk, quando, agora_, desc, au.text if au is not None else '', {'video_id': vid} if vid else None)
        if x:
            out.append(x)
    return out[: int(f.get('maximo', 15))], n


def pagina(rede, f, agora_, vistos):
    """Página HTML pública: links que casem com `padrao` (regex sobre o href) viram itens; só os nunca vistos.
    Título = texto do link (ou o nome do arquivo). Data: só se `padrao_data` encontrar uma no texto do link; senão null."""
    nome = f.get('nome') or f['id']
    corpo = rede.get(nome, f['url_coleta'], timeout=30, tentativas=2)
    txt = corpo.decode('utf-8', 'replace')
    padrao = re.compile(f.get('padrao') or r'\.pdf(\?|$)', re.I)
    base = f['url_coleta']
    out, n, achados = [], 0, set()
    for m in re.finditer(r'<a\b[^>]*href\s*=\s*["\']([^"\']+)["\'][^>]*>(.*?)</a>', txt, re.I | re.S):
        href, rotulo = m.group(1).strip(), limpa_texto(m.group(2), TITULO_MAX)
        if not padrao.search(href):
            continue
        n += 1
        link = link_seguro(urllib.parse.urljoin(base, html.unescape(href)))
        if not link or link in achados:
            continue
        achados.add(link)
        titulo = rotulo or urllib.parse.unquote(link.rsplit('/', 1)[-1]).replace('_', ' ').replace('-', ' ').rsplit('.', 1)[0]
        if ident(link, titulo) in vistos:
            continue
        quando = None
        if f.get('padrao_data'):
            md = re.search(f['padrao_data'], rotulo + ' ' + href)
            if md:
                quando = data_iso(md.group(0))
        x = _novo_item(f, titulo, link, quando, agora_, '', '', {'pdf': link} if link.lower().split('?')[0].endswith('.pdf') else None)
        if x:
            out.append(x)
    if n == 0 and f.get('exige_links', True):
        raise rede.falha(nome, 'formato', 'a página não tem links no padrão esperado (mudou de layout?)')
    return out[: int(f.get('maximo', 20))], n




def sitemap(rede, f, agora_, desde_iso):
    """Sitemap XML oficial (loc + lastmod). Entram URLs que casem `padrao`, com lastmod a partir de `desde`.
    O título vem do final da URL (humanizado) e fica marcado como provisório — o leitor abre o original."""
    nome = f.get('nome') or f['id']
    corpo = rede.get(nome, f['url_coleta'], timeout=40, tentativas=2)
    try:
        raiz = ET.fromstring(corpo)
    except ET.ParseError:
        raise rede.falha(nome, 'formato', 'sitemap inválido')
    padrao = re.compile(f.get('padrao') or '.', re.I)
    out, n = [], 0
    for u in raiz.iter():
        if not u.tag.endswith('}url') and u.tag != 'url':
            continue
        loc = next((c.text for c in u if c.tag.endswith('loc')), None)
        mod = next((c.text for c in u if c.tag.endswith('lastmod')), None)
        if not loc or not padrao.search(loc):
            continue
        n += 1
        quando = data_iso(mod)
        if quando and quando[:10] < desde_iso:
            continue
        slug = urllib.parse.unquote(loc.rstrip('/').rsplit('/', 1)[-1]).replace('-', ' ').replace('_', ' ')
        x = _novo_item(f, slug[:1].upper() + slug[1:], loc, quando, agora_, '', '', {'titulo_provisorio': True})
        if x:
            out.append(x)
    out.sort(key=lambda x: x.get('publicado_em') or '', reverse=True)
    return out[: int(f.get('maximo', 15))], n


def arquivo_fixo(rede, f, agora_, estado):
    """Documento publicado sempre na mesma URL (sobrescrito a cada edição). Só os cabeçalhos são lidos (HEAD); uma mudança
    de ETag, Last-Modified ou tamanho vira um item "edição atualizada". Nada do arquivo é baixado."""
    nome = f.get('nome') or f['id']
    cab = {}
    rede.get(nome, f['url_coleta'], timeout=25, tentativas=2, metodo='HEAD', cabecalhos=cab)
    marca = cab.get('etag') or cab.get('last-modified') or cab.get('content-length')
    if not marca:
        raise rede.falha(nome, 'formato', 'o servidor não informa ETag, Last-Modified nem tamanho: não dá para detectar edição nova')
    chave = 'arquivo_fixo:' + f['id']
    ant = estado.get(chave)
    estado[chave] = {'marca': marca, 'visto_em': agora_.isoformat(timespec='minutes')}
    if ant and ant.get('marca') == marca:
        return [], 1
    quando = data_iso(cab.get('last-modified'))
    titulo = f.get('titulo_item') or (f.get('nome') or f['id'])
    if ant is None and not f.get('primeira_leitura_conta', True):
        return [], 1
    x = _novo_item(f, '%s (edição de %s)' % (titulo, (quando or agora_.isoformat())[:10]), f['url_coleta'], quando, agora_, '', '', {'pdf': f['url_coleta'], 'edicao_atualizada': True, 'edicao': marca})
    if x:
        x['id'] = ident(f['url_coleta'] + '?edicao=' + hashlib.sha1(marca.encode()).hexdigest()[:12])  # cada edição é um item; o link que o leitor abre é o documento
    return ([x] if x else []), 1


# ------------------------------------------------------------------ APIs públicas (JSON)
def _wp_titulo(t):
    return limpa_texto(t.get('rendered') if isinstance(t, dict) else t, TITULO_MAX)


def wp_posts(rede, f, agora_, desde_iso):
    """API REST pública do WordPress (/wp-json/wp/v2/posts ou outro post type)."""
    nome = f.get('nome') or f['id']
    js = rede.get_json(nome, f['url_coleta'], timeout=30, tentativas=2)
    if not isinstance(js, list):
        raise rede.falha(nome, 'formato', 'a API não devolveu uma lista')
    filtro = re.compile(f['filtro_link'], re.I) if f.get('filtro_link') else None
    out, n = [], 0
    for it in js:
        n += 1
        lk = (it.get(f['campo_link']) if f.get('campo_link') else None) or it.get('link') or it.get('source_url') or ''
        if filtro and not filtro.search(lk + ' ' + _wp_titulo(it.get('title') or '')):
            continue
        quando = data_iso(it.get('date_gmt')) or data_iso(it.get('date'))
        if quando and quando[:10] < desde_iso:
            continue
        ex = it.get('excerpt') if isinstance(it.get('excerpt'), dict) else (it.get('caption') if isinstance(it.get('caption'), dict) else {})
        resumo = (ex or {}).get('rendered') or ''
        extra = {'pdf': lk} if lk.lower().split('?')[0].endswith('.pdf') else None
        x = _novo_item(f, _wp_titulo(it.get('title') or ''), lk, quando, agora_, resumo or '', '', extra)
        if x:
            out.append(x)
    return out, n


def imf_blog_json(rede, f, agora_, desde_iso):
    nome = f.get('nome') or f['id']
    js = rede.get_json(nome, f['url_coleta'], timeout=30, tentativas=2)
    out, n = [], 0
    for it in js.get('items') or []:
        n += 1
        tit = it.get('title') or it.get('titulo')
        lk = it.get('url') or it.get('link') or ''
        if lk.startswith('/'):
            lk = 'https://www.imf.org' + lk
        quando = data_iso(it.get('date') or it.get('publishedDate') or it.get('data') or '')
        if not quando:
            m = re.search(r'/(\d{4})/(\d{2})/(\d{2})/', lk)
            quando = data_iso('%s-%s-%s' % m.groups()) if m else None
        if quando and quando[:10] < desde_iso:
            continue
        x = _novo_item(f, tit, lk, quando, agora_, it.get('description') or it.get('summary') or '', it.get('author') or '')
        if x:
            out.append(x)
    return out, n


def bcb_copom(rede, f, agora_, desde_iso):
    """Comunicados e atas do Copom pela API pública do site do BC (JSON)."""
    nome = f.get('nome') or f['id']
    js = rede.get_json(nome, f['url_coleta'], timeout=30, tentativas=2)
    lista = js if isinstance(js, list) else (js.get('conteudo') or js.get('itens') or [])
    if not isinstance(lista, list):
        raise rede.falha(nome, 'formato', 'a API não devolveu uma lista')
    ata = 'atas' in f['url_coleta']
    out, n = [], 0
    for it in lista:
        n += 1
        nro = it.get('nro_reuniao') or it.get('nroReuniao') or it.get('numeroReuniao')
        if not nro:
            continue
        quando = data_iso(str(it.get('dataPublicacao') or it.get('dataReferencia') or '')[:19])
        if quando and quando[:10] < desde_iso:
            continue
        tit = it.get('titulo') or ('%sª reunião do Copom — %s' % (nro, 'ata' if ata else 'comunicado'))
        lk = f.get('link_item', 'https://www.bcb.gov.br/api/servico/sitebcb/copom/%s_detalhes?nro_reuniao=%s') % (('atas' if ata else 'comunicados'), nro)
        pdf = it.get('urlPdfAta') or it.get('urlPdf')
        if isinstance(pdf, str) and pdf.startswith('/'):
            pdf = 'https://www.bcb.gov.br' + pdf
        x = _novo_item(dict(f, tipo='documento_oficial'), tit, lk, quando, agora_, '', '', {'pdf': link_seguro(pdf), 'reuniao': nro} if pdf else {'reuniao': nro})
        if x:
            out.append(x)
    return out, n


def ibge_releases(rede, f, agora_, desde_iso):
    """Releases oficiais do IBGE pela API pública de notícias (reaproveita o formato já usado pelo robô)."""
    nome = f.get('nome') or 'IBGE'
    js = rede.get_json(nome, 'https://servicodados.ibge.gov.br/api/v3/noticias/?tipo=release&qtd=%d' % int(f.get('maximo', 20)), timeout=20)
    out, n = [], 0
    for it in js.get('items') or []:
        n += 1
        quando = None
        try:
            quando = dt.datetime.strptime(it.get('data_publicacao') or '', '%d/%m/%Y %H:%M:%S').replace(tzinfo=BRT).isoformat(timespec='minutes')
        except Exception:
            pass
        if quando and quando[:10] < desde_iso:
            continue
        x = _novo_item(dict(f, tipo='dado_oficial'), it.get('titulo'), it.get('link'), quando, agora_, it.get('introducao') or '')
        if x:
            out.append(x)
    return out, n


APIS = {'ibge_releases': ibge_releases, 'wp_posts': wp_posts, 'imf_blog_json': imf_blog_json, 'bcb_copom': bcb_copom}
METODOS = ('rss', 'atom', 'youtube', 'youtube_rss', 'pagina', 'pagina_html', 'pagina_pdf', 'sitemap', 'arquivo_fixo', 'api')


def url_da_fonte(f, hoje):
    """URL de coleta com o ano corrente no lugar de {ano} (feeds do BC pedem ?ano=AAAA)."""
    return (f.get('url_coleta') or '').replace('{ano}', str(hoje.year))


def coletar_fonte(rede, f, agora_, desde_iso, vistos, robots=None, estado=None, chaves=None, bloqueio=()):
    """Roda o coletor da fonte. Devolve (itens, recebidos). Lança ErroFonte em falha (inclusive 'robots' e 'sem_chave')."""
    nome = f.get('nome') or f['id']
    metodo = f.get('metodo')
    f = dict(f, url_coleta=url_da_fonte(f, agora_.date()))
    url = f.get('url_coleta') or ''
    chave_yt = (chaves or {}).get('youtube')
    if metodo in ('youtube', 'youtube_rss'):
        if chave_yt:
            return youtube(rede, f, agora_, desde_iso, chave_yt)
        url = url or ('https://www.youtube.com/feeds/videos.xml?channel_id=' + (f.get('canal_id') or ''))
        if robots is not None and not robots.permite(url):
            raise ErroFonte(nome, 'sem_chave', 'o robots.txt do YouTube veda o feed para robôs; configure YOUTUBE_API_KEY (API oficial, gratuita)')
        return youtube(rede, f, agora_, desde_iso, None)
    if robots is not None and url and metodo != 'api' and not robots.permite(url):
        raise ErroFonte(nome, 'robots', 'o robots.txt do site veda este caminho')
    if metodo == 'api':
        fn = APIS.get(f.get('api'))
        if not fn:
            raise ErroFonte(nome, 'formato', 'api desconhecida: %s' % f.get('api'))
        return fn(rede, f, agora_, desde_iso)
    if metodo in ('rss', 'atom'):
        return rss(rede, f, agora_, desde_iso, bloqueio)
    if metodo in ('pagina', 'pagina_html', 'pagina_pdf'):
        return pagina(rede, f, agora_, vistos)
    if metodo == 'sitemap':
        return sitemap(rede, f, agora_, desde_iso)
    if metodo == 'arquivo_fixo':
        return arquivo_fixo(rede, f, agora_, estado if estado is not None else {})
    raise ErroFonte(nome, 'formato', 'método desconhecido: %s' % metodo)
