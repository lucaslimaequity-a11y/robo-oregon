# -*- coding: utf-8 -*-
"""Notícias que podem mudar a avaliação de uma empresa, de um setor ou da carteira.

Fontes (sem chave): Google Notícias (buscas por empresa e por tema), IBGE (releases oficiais) e CVM (documentos
oficiais das companhias: fato relevante, comunicado ao mercado, aviso aos acionistas; base aberta atualizada pela CVM
uma vez por semana). Opcional: leitura por IA com a chave da Anthropic.

Cada manchete passa por:
  1. desambiguação: precisa citar a empresa por um dos termos dela e não pode ter termos de exclusão
     (ex.: "Guiné Equatorial" não é a Equatorial Energia);
  2. deduplicação: títulos muito parecidos viram uma notícia só, com os outros veículos listados;
  3. classificação por regras: impacto (macro, setorial, empresa), categorias (resultado, proventos, corporativo,
     regulatório, operacional, rating), relação com os riscos da tese, natureza (estrutural ou ruído) e relevância;
  4. "por que importa": frase montada só com o que o título traz. Sem elemento material, diz que não há informação
     suficiente para avaliar impacto, em vez de inventar.
"""
import csv
import datetime as dt
import io
import json
import re
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile

from util import BRT, ErroFonte, sem_acento

CATEGORIAS = {
    'resultado': ['lucro', 'prejuizo', 'receita', 'ebitda', 'balanco', 'resultado', 'trimestre', '1t', '2t', '3t', '4t', 'guidance', 'margem', 'demonstracoes financeiras'],
    'proventos': ['dividendo', 'jcp', 'juros sobre capital', 'proventos', 'recompra', 'bonificacao', 'desdobramento', 'grupamento', 'rendimento mensal', 'distribuicao'],
    'corporativo': ['fato relevante', 'aquisicao', 'adquire', 'compra de', 'venda de', 'vende ', 'fusao', 'incorporacao', 'follow-on', 'oferta de acoes', 'ipo', 'emissao', 'debentures',
                    'controle', 'ceo', 'presidente', 'renuncia', 'conselho de administracao', 'reestruturacao', 'recuperacao judicial', 'privatizacao', 'cisao', 'joint venture'],
    'regulatorio': ['aneel', 'anp', 'ans ', 'susep', 'cvm', 'cade', 'regulacao', 'regulatorio', 'tarifa', 'reajuste tarifario', 'revisao tarifaria', 'concessao', 'leilao', 'stf', 'tcu',
                    'tributacao', 'imposto', 'iof', 'multa', 'investigacao', 'acao judicial', 'marco legal'],
    'operacional': ['producao', 'vendas', 'volume', 'parada', 'acidente', 'greve', 'capacidade', 'fabrica', 'planta', 'campo de', 'poco', 'contrato', 'vacancia', 'inadimplencia', 'ocupacao'],
    'rating': ['rating', 'rebaixa nota', 'eleva nota', "moody's", 'fitch', 's&p global ratings', 'grau de investimento'],
}
MACRO = ['copom', 'selic', 'ipca', 'inflacao', 'pib', 'fiscal', 'arcabouco', 'divida publica', 'federal reserve', 'fed ', 'treasury', 'juros futuros', 'curva de juros',
         'dolar', 'cambio', 'petroleo', 'brent', 'minerio', 'desemprego', 'pnad', 'producao industrial', 'varejo', 'payroll']
RUIDO = ['acoes para comprar', 'comprar ou vender', 'vale a pena', 'recomenda', 'recomendacao', 'carteira recomendada', 'preco-alvo', 'preco alvo', 'analise tecnica', 'suporte',
         'resistencia', 'melhores acoes', 'o que esperar', 'dicas', 'como investir', 'ranking', 'ao vivo', 'ibovespa hoje', 'fechamento do mercado', 'abertura do mercado',
         'agenda do dia', 'radar do mercado', 'top 10', 'top 5', 'para ficar de olho']
MOVIMENTO = ['sobe', 'cai ', 'caem', 'sobem', 'dispara', 'despenca', 'derrete', 'salta', 'recua', 'avanca', 'tomba', 'lidera altas', 'lidera quedas']
ESTRUTURAL = ['aquisicao', 'fusao', 'incorporacao', 'privatizacao', 'concessao', 'controle', 'reestruturacao', 'recuperacao judicial', 'marco legal', 'reforma', 'rating',
              'grau de investimento', 'politica de dividendos', 'ceo', 'presidente', 'cisao']


# Termos sem acento (usados na busca) → forma escrita, só para a explicação mostrada no painel
ACENTO = {'aquisicao': 'aquisição', 'producao': 'produção', 'balanco': 'balanço', 'prejuizo': 'prejuízo', 'bonificacao': 'bonificação', 'distribuicao': 'distribuição',
          'fusao': 'fusão', 'incorporacao': 'incorporação', 'emissao': 'emissão', 'debentures': 'debêntures', 'renuncia': 'renúncia', 'conselho de administracao': 'conselho de administração',
          'reestruturacao': 'reestruturação', 'recuperacao judicial': 'recuperação judicial', 'privatizacao': 'privatização', 'cisao': 'cisão', 'regulacao': 'regulação',
          'regulatorio': 'regulatório', 'concessao': 'concessão', 'leilao': 'leilão', 'tributacao': 'tributação', 'investigacao': 'investigação', 'acao judicial': 'ação judicial',
          'reajuste tarifario': 'reajuste tarifário', 'revisao tarifaria': 'revisão tarifária', 'vacancia': 'vacância', 'inadimplencia': 'inadimplência', 'ocupacao': 'ocupação',
          'fabrica': 'fábrica', 'poco': 'poço', 'demonstracoes financeiras': 'demonstrações financeiras', 'divida publica': 'dívida pública', 'arcabouco': 'arcabouço',
          'dolar': 'dólar', 'cambio': 'câmbio', 'petroleo': 'petróleo', 'minerio': 'minério', 'producao industrial': 'produção industrial', 'inflacao': 'inflação',
          'aneel': 'Aneel', 'anp': 'ANP', 'cvm': 'CVM', 'cade': 'Cade', 'stf': 'STF', 'tcu': 'TCU', 'iof': 'IOF', 'ipca': 'IPCA', 'pib': 'PIB', 'pnad': 'PNAD', 'copom': 'Copom',
          'selic': 'Selic', 'fed': 'Fed', 'brent': 'Brent', 'jcp': 'JCP', 'ebitda': 'Ebitda', 'ceo': 'CEO', 'ipo': 'IPO', 'susep': 'Susep', 'ans': 'ANS', 'opep': 'Opep'}


# Riscos da tese → palavras que, no título, indicam que a notícia toca naquele risco
SINONIMOS = {
    'regula': ['aneel', 'anp', 'ans ', 'susep', 'regulac', 'regulat', 'tarifa', 'concessao', 'cade'],
    'juros': ['juros', 'selic', 'copom'], 'endivid': ['divida', 'endivid', 'alavanc', 'debentur'], 'alavanc': ['divida', 'endivid', 'alavanc', 'debentur'],
    'petroleo': ['petroleo', 'brent', 'barril'], 'brent': ['petroleo', 'brent', 'barril'], 'cambio': ['dolar', 'cambio'],
    'credito': ['credito', 'inadimpl', 'pdd', 'calote'], 'inadimpl': ['inadimpl', 'calote', 'pdd'], 'celulose': ['celulose', 'papel'],
    'consumo': ['consumo', 'varejo', 'vendas'], 'energia': ['energia', 'hidrolog', 'chuva', 'reservatorio', 'pld'], 'hidrolog': ['hidrolog', 'chuva', 'reservatorio'],
    'dividend': ['dividendo', 'proventos', 'jcp'], 'inflacao': ['ipca', 'inflacao'], 'vacancia': ['vacancia', 'ocupacao', 'inquilino'],
    'producao': ['producao', 'campo', 'poco', 'parada'], 'sinistr': ['sinistr', 'seca', 'enchente', 'clima'], 'governanca': ['governanca', 'conselho', 'interferencia'],
    'controlador': ['governo', 'uniao', 'interferencia', 'conselho'], 'aquisic': ['aquisicao', 'adquire', 'compra de'], 'capital': ['recompra', 'aquisicao', 'investimento', 'capex'],
}


def toca_tese(t, risco):
    r = sem_acento(risco)
    for chave, sin in SINONIMOS.items():
        if chave in r and any(s in t for s in sin):
            return True
    return any(w in t for w in re.findall(r'[a-z]{6,}', r) if w not in ('alocacao', 'execucao', 'estrutura', 'persistente'))


def _tem(txt, termos):
    return [t for t in termos if t and t in txt]


def pertence(titulo, cfg_emp):
    """A manchete cita a empresa? Termos com maiúscula exata (ex.: 'PRIO') valem sem ignorar caixa."""
    termos = cfg_emp.get('termos') or []
    excluir = cfg_emp.get('excluir') or []
    t_norm = sem_acento(titulo)
    if any(sem_acento(x) in t_norm for x in excluir):
        return False
    if not termos:
        return True
    for x in termos:
        if x.startswith('='):  # comparação exata, sensível a maiúsculas
            if re.search(r'(?<![A-Za-z0-9])' + re.escape(x[1:]) + r'(?![a-z])', titulo):
                return True
        elif sem_acento(x) in t_norm:
            return True
    return False


def classificar(n, cfg_n, empresas):
    """Acrescenta n['classe'] com impacto, categorias, tese, natureza, relevância, pontos e explicação."""
    tit = n.get('titulo') or ''
    t = ' ' + sem_acento(tit) + ' '
    emp = empresas.get(n.get('tema')) if n.get('tema') else None
    cats = {k: _tem(t, [' ' + x if len(x) <= 3 else x for x in v]) for k, v in CATEGORIAS.items()}
    cats = {k: v for k, v in cats.items() if v}
    macro = _tem(t, MACRO)
    ruido = _tem(t, RUIDO)
    mov = _tem(t, MOVIMENTO)
    oficial = bool(n.get('oficial'))
    veic = sem_acento(n.get('fonte') or '')
    confiavel = oficial or any(sem_acento(v) in veic for v in (cfg_n.get('veiculos_confiaveis') or []))
    tese = []
    if emp:
        for risco in emp.get('riscos_tese') or []:
            if toca_tese(t, risco):
                tese.append(risco)
    setor = emp and _tem(t, [sem_acento(x) for x in (emp.get('setor') or [])])
    impacto = 'empresa' if emp else ('indice' if n.get('etfs') else ('macro' if macro or n.get('tema') in (cfg_n.get('temas_macro') or []) else 'setorial'))
    estrutural = _tem(t, ESTRUTURAL)
    natureza = 'estrutural' if estrutural else ('ruido' if (ruido or (mov and not cats)) else ('pontual' if cats else 'indefinido'))
    pontos = 0
    pontos += 3 if oficial else 0
    pontos += 2 * min(len(cats), 2)
    pontos += 2 if tese else 0
    pontos += 1 if confiavel else 0
    pontos += 1 if impacto == 'empresa' else 0
    pontos += 3 if impacto in ('macro', 'indice') and macro else 0
    pontos -= 3 if ruido else 0
    pontos -= 2 if (mov and not cats) else 0
    rel = 'alta' if pontos >= 4 else ('media' if pontos >= 2 else 'baixa')
    nomes = {'resultado': 'resultado (%s)', 'proventos': 'proventos (%s)', 'corporativo': 'evento corporativo (%s)', 'regulatorio': 'tema regulatório (%s)',
             'operacional': 'operação (%s)', 'rating': 'rating de crédito (%s)'}
    bonito = lambda xs: ', '.join(sorted({ACENTO.get(x.strip(), x.strip()) for x in xs})[:3])
    partes = []
    if cats:
        partes.append('Fato: ' + '; '.join(nomes[k] % bonito(v) for k, v in cats.items()) + '.')
    if tese:
        partes.append('Toca no risco da tese: ' + '; '.join(tese[:2]) + '.')
    if impacto in ('macro', 'indice') and macro:
        partes.append('Tema macro (%s), que entra nos cenários.' % bonito(macro))
    if oficial:
        partes.append('Documento ou divulgação oficial.')
    if ruido:
        partes.append('Título de opinião, recomendação ou cobertura do pregão: tende a ser ruído.')
    elif mov and not cats:
        partes.append('Só descreve o movimento do preço, sem fato novo.')
    explic = ' '.join(partes) if partes else 'Sem fato material identificado no título; informação insuficiente para avaliar impacto.'
    if impacto == 'indice':
        explic = 'Sobre o índice, a estratégia ou a exposição de %s, não sobre o fundo. ' % ', '.join(n['etfs'][:3]) + explic
    n['classe'] = {'impacto': impacto, 'categorias': sorted(cats), 'tese': tese[:3], 'setor': bool(setor), 'natureza': natureza, 'relevancia': rel,
                   'pontos': pontos, 'porque': explic, 'confiavel': confiavel, 'oficial': oficial}
    return n


def _tokens(t):
    return {w for w in re.findall(r'[a-z0-9]{3,}', sem_acento(t)) if w not in ('para', 'com', 'que', 'dos', 'das', 'nos', 'nas', 'uma', 'por', 'mais', 'apos', 'sobre')}


def deduplicar(itens, limiar=0.6):
    """Títulos com 60% ou mais de palavras em comum viram um item só; o mais oficial/confiável fica como principal."""
    out = []
    for n in sorted(itens, key=lambda x: (-(x.get('classe', {}).get('pontos', 0)), x.get('quando') or '')):
        tk = _tokens(n.get('titulo', ''))
        dup = None
        for m in out:
            a = m['_tk']
            if tk and a and len(tk & a) / float(len(tk | a)) >= limiar:
                dup = m
                break
        if dup:
            v = n.get('fonte')
            if v and v != dup.get('fonte') and v not in dup.setdefault('tambem_em', []):
                dup['tambem_em'].append(v)
            if n.get('tema') and n.get('tema') != dup.get('tema') and n['tema'] not in dup.setdefault('temas', [dup.get('tema')]):
                dup['temas'].append(n['tema'])
            # notícia de empresa nunca vira notícia de índice de ETF (regra: não confundir empresa investida com o fundo)
            if n.get('etfs') and (dup.get('classe') or {}).get('impacto') != 'empresa':
                dup['etfs'] = list(dup.get('etfs') or [])
                for e in n['etfs']:
                    if e not in dup['etfs']:
                        dup['etfs'].append(e)
            continue
        n['_tk'] = tk
        out.append(n)
    for n in out:
        n.pop('_tk', None)
    return out


# ---------------------------------------------------------------- fontes
def google(rede, consulta, tema, bloqueio):
    url = 'https://news.google.com/rss/search?q=%s&hl=pt-BR&gl=BR&ceid=BR:pt-419' % urllib.parse.quote(consulta + ' when:2d')
    corpo = rede.get('Google Notícias', url, timeout=15, tentativas=2)
    try:
        raiz = ET.fromstring(corpo)
    except ET.ParseError:
        raise rede.falha('Google Notícias', 'formato', 'RSS inválido')
    out = []
    for it in raiz.iter('item'):
        tit = (it.findtext('title') or '').strip()
        fonte = (it.findtext('source') or '').strip()
        if fonte and tit.endswith(' - ' + fonte):
            tit = tit[: -len(' - ' + fonte)]
        if not tit or any(b and sem_acento(b) in sem_acento(fonte) for b in bloqueio):
            continue
        quando = None
        try:
            quando = dt.datetime.strptime(it.findtext('pubDate') or '', '%a, %d %b %Y %H:%M:%S %Z').replace(tzinfo=dt.timezone.utc).astimezone(BRT).isoformat(timespec='minutes')
        except Exception:
            pass
        out.append({'titulo': tit, 'fonte': fonte, 'link': link_seguro(it.findtext('link')), 'quando': quando, 'tema': tema, 'origem': 'Google Notícias'})
    return out


def link_seguro(u):
    """Só http(s): um link 'javascript:' vindo de um feed nunca chega ao painel."""
    u = (u or '').strip()
    return u if re.match(r'^https?://', u, re.I) else ''


def _data_rss(txt):
    txt = (txt or '').strip()
    try:  # Atom e ISO 8601 (2026-11-06T12:00:00Z, 2026-11-06T12:00:00-03:00)
        d = dt.datetime.fromisoformat(txt.replace('Z', '+00:00'))
        return (d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)).astimezone(BRT).isoformat(timespec='minutes')
    except ValueError:
        pass
    for f in ('%a, %d %b %Y %H:%M:%S %z', '%a, %d %b %Y %H:%M:%S %Z', '%d %b %Y %H:%M:%S %z'):
        try:
            d = dt.datetime.strptime(txt, f)
            if d.tzinfo is None:
                d = d.replace(tzinfo=dt.timezone.utc)
            return d.astimezone(BRT).isoformat(timespec='minutes')
        except ValueError:
            continue
    return None


def feed(rede, f, desde):
    """RSS público de um veículo (configurado em noticias.rss). Guarda só título, link, data e veículo; nunca o texto."""
    nome = f.get('nome') or 'RSS'
    corpo = rede.get(nome, f['url'], timeout=15, tentativas=2)
    try:
        raiz = ET.fromstring(corpo)
    except ET.ParseError:
        raise rede.falha(nome, 'formato', 'RSS inválido')
    out = []
    atom = '{http://www.w3.org/2005/Atom}'
    itens = [(it.findtext('title'), it.findtext('link'), it.findtext('pubDate')) for it in raiz.iter('item')]
    for en in raiz.iter(atom + 'entry'):  # feeds Atom
        lk = next((l.get('href') for l in en.findall(atom + 'link') if l.get('rel') in (None, 'alternate')), None)
        itens.append((en.findtext(atom + 'title'), lk, en.findtext(atom + 'published') or en.findtext(atom + 'updated')))
    for tit, lk, data in itens:
        tit = re.sub(r'\s+', ' ', (tit or '')).strip()
        quando = _data_rss(data)
        if not tit or not quando or quando[:10] < desde:  # sem data confiável não entra (não vira notícia de hoje)
            continue
        out.append({'titulo': tit, 'fonte': nome, 'link': link_seguro(lk), 'quando': quando, 'tema': f.get('tema') or 'Mercado', 'origem': 'RSS · ' + nome})
    if itens and not out and not any(_data_rss(x[2]) for x in itens):
        raise rede.falha(nome, 'formato', 'itens sem data reconhecível')
    return out[: int(f.get('maximo', 30))]


def tema_de(titulo, empresas):
    """Primeira empresa das carteiras citada no título (pelos termos de cada uma), ou None."""
    for t, e in empresas.items():
        if e.get('termos') and pertence(titulo, e):
            return t
    return None


def ibge(rede, temas, qtd=20):
    js = rede.get_json('IBGE', 'https://servicodados.ibge.gov.br/api/v3/noticias/?tipo=release&qtd=%d' % qtd, timeout=20)
    out = []
    for it in js.get('items') or []:
        tit = (it.get('titulo') or '').strip()
        if not tit or not any(sem_acento(x) in sem_acento(tit + ' ' + (it.get('introducao') or '')) for x in temas):
            continue
        quando = None
        try:
            quando = dt.datetime.strptime(it.get('data_publicacao') or '', '%d/%m/%Y %H:%M:%S').replace(tzinfo=BRT).isoformat(timespec='minutes')
        except Exception:
            pass
        out.append({'titulo': tit, 'fonte': 'IBGE (release oficial)', 'link': link_seguro(it.get('link')), 'quando': quando, 'tema': 'Inflação e atividade', 'oficial': True,
                    'resumo': (it.get('introducao') or '')[:300], 'origem': 'IBGE'})
    return out


def cvm(rede, empresas, hoje, dias=21, categorias=('Fato Relevante', 'Comunicado ao Mercado', 'Aviso aos Acionistas', 'Dados Econômico-Financeiros')):
    """Documentos oficiais entregues à CVM (base aberta, atualizada pela CVM semanalmente). Confere CNPJ E nome."""
    alvo = {}
    for t, e in empresas.items():
        cnpj = re.sub(r'\D', '', e.get('cnpj') or '')
        if cnpj:
            alvo[cnpj] = (t, sem_acento(e.get('cvm_nome') or ''))
    if not alvo:
        return []
    corpo = rede.get('CVM', 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS/ipe_cia_aberta_%d.zip' % hoje.year, timeout=120, tentativas=2)
    try:
        z = zipfile.ZipFile(io.BytesIO(corpo))
        nome = [n for n in z.namelist() if n.endswith('.csv')][0]
        txt = z.read(nome).decode('latin-1')
    except Exception:
        raise rede.falha('CVM', 'formato', 'arquivo IPE inesperado')
    lim = (hoje - dt.timedelta(days=dias)).isoformat()
    out = []
    for r in csv.DictReader(io.StringIO(txt), delimiter=';'):
        cnpj = re.sub(r'\D', '', r.get('CNPJ_Companhia') or '')
        if cnpj not in alvo or (r.get('Categoria') or '') not in categorias:
            continue
        t, nome_ok = alvo[cnpj]
        if nome_ok and nome_ok not in sem_acento(r.get('Nome_Companhia') or ''):
            continue  # CNPJ conferido também pelo nome: evita atribuir documento à empresa errada
        d = (r.get('Data_Entrega') or '')[:10]
        if d < lim:
            continue
        assunto = (r.get('Assunto') or r.get('Tipo') or r.get('Especie') or '').strip()
        out.append({'titulo': '%s: %s' % (r.get('Categoria'), assunto or 'sem assunto informado'), 'fonte': 'CVM (documento oficial)', 'link': link_seguro(r.get('Link_Download')),
                    'quando': d + 'T00:00', 'tema': t, 'oficial': True, 'origem': 'CVM', 'categoria_cvm': r.get('Categoria')})
    return out


def coletar(rede, cfg, anteriores, hoje, estado, agora_):
    """Junta as fontes, desambigua, classifica e deduplica. Devolve (itens, erros, fontes_ok)."""
    n = cfg['noticias']
    empresas = {a['id']: dict(a.get('noticias') or {}, **{'cnpj': a.get('cnpj'), 'cvm_nome': a.get('cvm_nome')}) for a in cfg['ativos'] if a.get('ativo', True)}
    bloqueio = n.get('fontes_bloqueadas') or []
    brutos, erros, ok = [], [], {}
    consultas = [(c['consulta'], c['tema'], None) for c in n.get('macro', [])]
    consultas += [(e['busca'], t, None) for t, e in empresas.items() if e.get('busca')]
    # temas dos ETFs: notícias sobre o índice, a estratégia e as exposições, marcadas com os ETFs ligados ao tema
    consultas += [(e['consulta'], e['tema'], list(e['etfs'])) for e in (n.get('etfs') or []) if e.get('ativo', True) and e.get('consulta')]
    for consulta, tema, etfs in consultas:
        if rede.sem_tempo():
            erros.append('%s: prazo da rodada esgotado' % tema)
            break
        try:
            achou = google(rede, consulta, tema, bloqueio)
            ok['Google Notícias'] = True
        except (ErroFonte, KeyError, TypeError, ValueError, AttributeError, IndexError) as e:
            erros.append('%s: %s' % (tema, e))
            continue
        emp = empresas.get(tema)
        if emp:
            achou = [x for x in achou if pertence(x['titulo'], emp)]
        if etfs:
            for x in achou:
                x['etfs'] = list(etfs)  # uma lista por manchete: a deduplicação não pode espalhar ETFs entre manchetes
        brutos += achou[: n.get('por_tema_etf', 3) if etfs else n.get('por_tema', 6)]
    desde = (hoje - dt.timedelta(days=2)).isoformat()
    for f in n.get('rss') or []:
        if not f.get('ativo', True) or not f.get('url') or rede.sem_tempo():
            continue
        if any(b and sem_acento(b) in sem_acento(f.get('nome') or '') for b in bloqueio):
            continue
        try:
            achou = feed(rede, f, desde)
            ok[f.get('nome') or 'RSS'] = True
        except (ErroFonte, KeyError, TypeError, ValueError, AttributeError, IndexError) as e:
            erros.append('%s: %s' % (f.get('nome') or 'RSS', e))
            continue
        for x in achou:
            t = tema_de(x['titulo'], empresas)
            if t:
                x['tema'] = t
            elif f.get('so_empresas'):
                continue
            x['_feed'] = True
            brutos.append(x)
    if n.get('ibge', True):
        try:
            brutos += ibge(rede, n.get('ibge_temas') or [])
            ok['IBGE'] = True
        except (ErroFonte, KeyError, TypeError, ValueError, AttributeError, IndexError) as e:
            erros.append('IBGE: %s' % e)
    if n.get('cvm', True) and estado.get('cvm_em', '')[:10] != hoje.isoformat():
        try:
            docs = cvm(rede, empresas, hoje)
            estado['cvm_docs'] = docs
            estado['cvm_em'] = agora_.isoformat(timespec='minutes')
            ok['CVM'] = True
        except (ErroFonte, KeyError, TypeError, ValueError, AttributeError, IndexError) as e:
            erros.append('CVM: %s' % e)
    brutos += estado.get('cvm_docs') or []
    # leitura por IA de rodadas anteriores vale para a mesma manchete
    lidas = {sem_acento(x.get('titulo', ''))[:90]: x.get('ia') for x in (anteriores or []) if x.get('ia')}
    for x in brutos:
        k = sem_acento(x['titulo'])[:90]
        if k in lidas:
            x['ia'] = lidas[k]
        classificar(x, n, empresas)
    # dos RSS gerais ficam só os itens ligados a uma empresa das carteiras ou com relevância média/alta
    brutos = [x for x in brutos if not x.pop('_feed', False) or x['classe']['impacto'] == 'empresa' or x['classe']['relevancia'] != 'baixa']
    itens = deduplicar(brutos)
    itens.sort(key=lambda x: (x.get('quando') or ''), reverse=True)
    return itens[: n.get('maximo', 120)], erros, ok


def ler_com_ia(rede, noticias, cfg, chave):
    """Opcional (chave da Anthropic): a IA lê as manchetes novas de relevância média ou alta. Não manda dados de carteira."""
    if not chave:
        return None, 'sem ANTHROPIC_API_KEY (leitura por IA desligada; a classificação por regras continua)'
    novas = [x for x in noticias if 'ia' not in x and x.get('classe', {}).get('relevancia') in ('alta', 'media')][:25]
    if not novas:
        return 0, ''
    ativos = ', '.join('%s (%s)' % (a['id'], a['nome']) for a in cfg['ativos'] if a.get('classe') in ('acao', 'fii'))
    sistema = ('Você ajuda a mesa de gestão de uma consultoria de investimentos brasileira. Responda só com JSON válido. '
               'Use apenas as manchetes recebidas; não invente números nem conclusões; se o título não basta, diga "informação insuficiente". '
               'Não cite projeções de bancos ou corretoras. Fatores possíveis: selic, pre, real, ust2, ust10, spread, usd, ibov, sp, em, brent, btc. '
               'Ativos acompanhados: ' + ativos + '.')
    pedido = ('Para cada manchete, devolva {"i": índice, "relevancia": "alta"|"media"|"baixa", "tickers": [...], "fatores": [...], '
              '"direcao": "positivo"|"negativo"|"neutro"|"incerto", "resumo": uma frase curta sobre por que importa}. Formato: {"itens": [...]}.\n\n'
              + '\n'.join('%d. %s (%s)' % (i, x['titulo'], x.get('fonte') or 'fonte não informada') for i, x in enumerate(novas)))
    corpo = json.dumps({'model': cfg.get('ia_modelo', 'claude-haiku-5-5'), 'max_tokens': 8000, 'system': sistema,
                        'messages': [{'role': 'user', 'content': pedido}]}).encode()
    try:
        r = json.loads(rede.get('Anthropic', 'https://api.anthropic.com/v1/messages', timeout=120, tentativas=2, dados=corpo, tipo_403='autenticacao',
                                cab={'x-api-key': chave, 'anthropic-version': cfg.get('ia_versao_api', '2023-06-01'), 'content-type': 'application/json'}).decode('utf-8'))
        if r.get('stop_reason') == 'max_tokens':
            return None, 'leitura por IA cortada pelo limite de tamanho; tenta de novo na próxima hora'
        txt = ''.join(b.get('text', '') for b in r.get('content', []) if isinstance(b, dict) and b.get('type') == 'text')
        m = re.search(r'\{.*\}', txt, re.S)
        itens = json.loads(m.group(0)).get('itens', []) if m else []
        if not isinstance(itens, list):
            itens = []
    except ErroFonte as e:
        return None, 'leitura por IA falhou: %s' % e
    except Exception as e:
        return None, 'leitura por IA falhou: %s' % type(e).__name__
    validos = ('selic', 'pre', 'real', 'ust2', 'ust10', 'spread', 'usd', 'ibov', 'sp', 'em', 'brent', 'btc')
    k = 0
    for it in itens:
        try:
            x = novas[int(it['i'])]
            tk = it.get('tickers') if isinstance(it.get('tickers'), list) else []
            fa = it.get('fatores') if isinstance(it.get('fatores'), list) else []
            x['ia'] = {'relevancia': it.get('relevancia') if it.get('relevancia') in ('alta', 'media', 'baixa') else None,
                       'tickers': [t for t in tk if isinstance(t, str)][:5], 'fatores': [f for f in fa if isinstance(f, str) and f in validos][:4],
                       'direcao': it.get('direcao') if it.get('direcao') in ('positivo', 'negativo', 'neutro', 'incerto') else None,
                       'resumo': str(it.get('resumo') or '')[:280]}
            k += 1
        except Exception:
            continue
    return k, ''


def arquivar(nots, arq, agora_, dias=60, maximo=3000):
    itens = {}
    for x in (arq or {}).get('itens', []):
        itens[sem_acento(x.get('titulo', ''))[:90]] = x
    marca = agora_.isoformat(timespec='minutes')
    for x in nots:
        k = sem_acento(x['titulo'])[:90]
        old = itens.get(k) or {}
        y = dict(x)
        y['visto_em'] = old.get('visto_em') or marca
        if old.get('ia') and not y.get('ia'):
            y['ia'] = old['ia']
        itens[k] = y
    lim = (agora_ - dt.timedelta(days=dias)).date().isoformat()
    out = [x for x in itens.values() if (x.get('quando') or x.get('visto_em') or '')[:10] >= lim]
    out.sort(key=lambda x: x.get('quando') or x.get('visto_em') or '', reverse=True)
    return {'versao': 2, 'gerado_em': agora_.isoformat(timespec='seconds'), 'itens': out[:maximo]}
