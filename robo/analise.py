# -*- coding: utf-8 -*-
"""Classificação, prioridade, vínculo com os ativos e leitura curta do Oregon Intelligence.

Tudo aqui funciona SEM chave de IA (regras determinísticas sobre título, resumo curto, fonte e tipo). Com a chave
da Anthropic configurada e `intel.ia.ativo` = true, a leitura por IA complementa os itens prioritários, dentro de
um teto diário de itens e de tokens (robo/config.json). Cada frase produzida leva um rótulo:
  FATO       — o que a fonte publicou (título, autor, data, tipo) e o que o texto público afirma literalmente;
  FONTE      — opinião ou tese da própria fonte;
  INFERÊNCIA — ligação feita pelo sistema (palavras-chave → tema, ativo, fator).
O sistema nunca conclui impacto, direção ou recomendação, e não preenche lacunas: com só a manchete, a leitura diz
isso e manda para a fonte original. Cada ativo citado recebe um vínculo: direto (o ativo é o assunto) ou menção
(citado de passagem, por exemplo numa lista de dividendos), e só o vínculo direto pesa na prioridade.
"""
import datetime as dt
import json
import re

from util import ErroFonte, sem_acento

# ------------------------------------------------------------------ taxonomia
TEMAS = {
    'juros': ['selic', 'copom', 'juros', 'taxa basica', 'fed funds', 'fomc', 'federal reserve', 'rate cut', 'rate hike', 'interest rate', 'monetary policy', 'politica monetaria', 'bce', 'ecb', 'boj', 'curva de juros', 'yield curve', 'treasuries', 'treasury yield', 'juro neutro', 'neutral rate'],
    'inflacao': ['inflacao', 'inflation', 'ipca', 'cpi', 'pce', 'precos ao consumidor', 'nucleo', 'core inflation', 'desinflacao', 'disinflation', 'expectativas de inflacao'],
    'fiscal': ['fiscal', 'arcabouco', 'deficit', 'divida publica', 'public debt', 'government debt', 'orcamento', 'budget', 'tesouro nacional', 'primario', 'gasto publico', 'spending', 'tax', 'imposto', 'reforma tributaria'],
    'cambio': ['cambio', 'dolar', 'real brasileiro', 'exchange rate', 'currency', 'dollar', 'ptax', 'fx ', 'moeda'],
    'atividade': ['pib', 'gdp', 'atividade economica', 'recessao', 'recession', 'desemprego', 'unemployment', 'payroll', 'emprego', 'pnad', 'producao industrial', 'industrial production', 'varejo', 'retail sales', 'servicos', 'pmi', 'ibc-br', 'soft landing', 'crescimento economico', 'economic growth'],
    'credito': ['credito', 'credit', 'inadimplencia', 'default', 'spread', 'high yield', 'investment grade', 'debenture', 'bond market', 'corporate bond', 'renda fixa', 'fixed income', 'cri ', 'cra ', 'fidc'],
    'bolsa': ['acoes', 'equities', 'equity', 'stocks', 'ibovespa', 's&p 500', 'nasdaq', 'bolsa', 'stock market', 'earnings', 'lucro', 'resultado trimestral', 'valuation', 'multiplo', 'price to earnings', 'dividendos', 'dividend', 'buyback', 'recompra'],
    'alocacao': ['asset allocation', 'alocacao', 'portfolio', 'portfolio construction', 'diversificacao', 'diversification', 'rebalance', 'rebalanceamento', '60/40', 'carteira', 'risk parity', 'multi-asset', 'multimercado', 'retorno esperado', 'expected return', 'capital market assumptions'],
    'fatores': ['value', 'momentum', 'quality', 'low volatility', 'small cap', 'small caps', 'factor', 'fator', 'smart beta', 'premio de risco', 'risk premium', 'equity premium'],
    'commodities': ['petroleo', 'oil', 'brent', 'minerio', 'iron ore', 'commodities', 'ouro', 'gold', 'soja', 'milho', 'agro', 'cobre', 'copper', 'gas natural', 'energy prices', 'opep', 'opec'],
    'geopolitica': ['geopolit', 'tarifa', 'tariff', 'trade war', 'guerra', 'war', 'sancoes', 'sanctions', 'eleicao', 'election', 'eleicoes', 'congresso', 'congress', 'white house', 'casa branca', 'governo'],
    'china': ['china', 'chinese', 'pboc', 'yuan', 'renminbi', 'xi jinping', 'beijing', 'pequim'],
    'europa': ['europa', 'europe', 'euro area', 'zona do euro', 'eurozone', 'alemanha', 'germany', 'reino unido', 'uk ', 'bank of england', 'bce', 'ecb'],
    'emergentes': ['emergentes', 'emerging markets', 'em debt', 'em equities', 'america latina', 'latin america', 'latam', 'mexico', 'india', 'frontier'],
    'tecnologia_ia': ['inteligencia artificial', 'artificial intelligence', ' ai ', 'ia ', 'semicondutores', 'semiconductor', 'nvidia', 'data center', 'tecnologia', 'technology', 'big tech', 'software'],
    'imobiliario': ['imobiliario', 'real estate', 'fii', 'fundos imobiliarios', 'reit', 'housing', 'mortgage', 'shopping', 'galpao', 'logistica'],
    'bancos': ['bancos', 'banks', 'banking', 'basileia', 'basel', 'itau', 'bradesco', 'banco do brasil', 'santander', 'nubank', 'inter', 'capital bancario', 'bank capital', 'liquidez bancaria'],
    'energia_utilities': ['energia eletrica', 'eletrica', 'utilities', 'transmissao', 'distribuidora', 'geracao', 'aneel', 'tarifa de energia', 'saneamento', 'power'],
    'regulacao': ['cvm', 'sec ', 'regulacao', 'regulation', 'regulator', 'norma', 'resolucao', 'supervisao', 'compliance', 'bis ', 'basileia', 'fsb', 'estabilidade financeira', 'financial stability'],
    'cripto': ['bitcoin', 'cripto', 'crypto', 'ethereum', 'stablecoin', 'etf de bitcoin', 'digital asset'],
    'carta_gestor': ['carta', 'letter', 'quarterly letter', 'carta trimestral', 'carta mensal', 'relatorio de gestao', 'investor letter', 'outlook', 'perspectivas', 'cenario', 'market commentary', 'comentario'],
    'metodo': ['behavioral', 'comportamental', 'vies', 'bias', 'processo de investimento', 'investment process', 'licoes', 'lessons', 'erro', 'mistake', 'margem de seguranca', 'margin of safety', 'longo prazo', 'long term', 'ciclo', 'cycle', 'historia', 'history', 'historico'],
}
TEMA_NOME = {'juros': 'Juros e política monetária', 'inflacao': 'Inflação', 'fiscal': 'Fiscal', 'cambio': 'Câmbio', 'atividade': 'Atividade e emprego', 'credito': 'Crédito e renda fixa',
             'bolsa': 'Bolsa e lucros', 'alocacao': 'Alocação de carteira', 'fatores': 'Fatores e prêmios de risco', 'commodities': 'Commodities', 'geopolitica': 'Geopolítica e política',
             'china': 'China', 'europa': 'Europa', 'emergentes': 'Emergentes', 'tecnologia_ia': 'Tecnologia e IA', 'imobiliario': 'Imobiliário', 'bancos': 'Bancos', 'energia_utilities': 'Energia e utilities',
             'regulacao': 'Regulação e estabilidade', 'cripto': 'Cripto', 'carta_gestor': 'Cartas e visões de gestores', 'metodo': 'Método e processo de investimento'}

REGIOES = {
    'brasil': ['brasil', 'brazil', 'brazilian', 'selic', 'copom', 'ipca', 'ibovespa', 'b3', 'bcb', 'banco central do brasil', 'tesouro nacional', 'ibge', 'focus', 'real brasileiro', 'lula', 'fiscal brasileiro'],
    'eua': ['eua', 'estados unidos', 'united states', 'u.s.', 'us ', 'american', 'fed ', 'federal reserve', 'fomc', 'treasury', 'treasuries', 's&p 500', 'nasdaq', 'wall street', 'dollar', 'dolar', 'payroll', 'trump', 'white house'],
    'europa': ['europa', 'europe', 'european', 'euro area', 'zona do euro', 'eurozone', 'ecb', 'bce', 'germany', 'alemanha', 'france', 'franca', 'uk ', 'reino unido', 'bank of england', 'italia', 'italy'],
    'china': ['china', 'chinese', 'pboc', 'yuan', 'renminbi', 'beijing', 'pequim', 'hong kong'],
    'japao': ['japao', 'japan', 'boj', 'bank of japan', 'yen', 'iene', 'nikkei'],
    'emergentes': ['emergentes', 'emerging markets', 'emerging-market', 'latam', 'america latina', 'latin america', 'mexico', 'india', 'indonesia', 'turquia', 'turkey', 'argentina', 'chile', 'colombia'],
    'global': ['global', 'mundial', 'world', 'worldwide', 'g20', 'g7', 'fmi', 'imf', 'bis ', 'international'],
}
REGIAO_NOME = {'brasil': 'Brasil', 'eua': 'EUA', 'europa': 'Europa', 'china': 'China', 'japao': 'Japão', 'emergentes': 'Emergentes', 'global': 'Global'}

FATORES = {
    'selic': ['selic', 'copom', 'cdi', 'juros no brasil', 'taxa basica'],
    'pre': ['prefixado', 'curva de juros', 'di futuro', 'juros futuros', 'irf-m', 'ntn-f', 'ltn'],
    'real': ['juro real', 'ipca+', 'ntn-b', 'ima-b', 'real rate', 'real yield', 'tips', 'inflation-linked'],
    'ust': ['treasury', 'treasuries', 'fed funds', 'fomc', 'federal reserve', 'us yields', 'yield curve', '10-year', '2-year', '10 anos', '2 anos'],
    'usd': ['dolar', 'dollar', 'cambio', 'exchange rate', 'dxy', 'ptax', 'real brasileiro', 'currency'],
    'spread': ['spread', 'high yield', 'credit spread', 'inadimplencia', 'default', 'investment grade', 'cds'],
    'ibov': ['ibovespa', 'bolsa brasileira', 'acoes brasileiras', 'brazilian equities', 'b3'],
    'sp': ['s&p 500', 'nasdaq', 'us equities', 'wall street', 'acoes americanas', 'bolsa americana', 'earnings season'],
    'em': ['emerging markets', 'emergentes', 'em equities', 'em debt', 'msci em'],
    'brent': ['petroleo', 'oil', 'brent', 'wti', 'opep', 'opec'],
    'btc': ['bitcoin', 'cripto', 'crypto', 'btc'],
}
FATOR_NOME = {'selic': 'Selic / CDI', 'pre': 'Curva prefixada', 'real': 'Juro real (IPCA+)', 'ust': 'Treasuries (EUA)', 'usd': 'Dólar / câmbio', 'spread': 'Spread de crédito',
              'ibov': 'Bolsa Brasil', 'sp': 'Bolsa EUA', 'em': 'Emergentes', 'brent': 'Petróleo', 'btc': 'Bitcoin'}

PROMOCIONAL = ['webinar', 'inscreva', 'inscricoes', 'cadastre-se', 'cadastre', 'promocao', 'desconto', 'cupom', 'oferta especial', 'patrocinado', 'publieditorial', 'ganhe', 'gratis por tempo',
               'baixe o app', 'abra sua conta', 'assine ja', 'lancamento do produto', 'novo fundo', 'conheca nosso', 'nossos produtos', 'ebook gratuito', 'live especial', 'masterclass', 'sorteio']
SENSACIONAL = ['dispara', 'despenca', 'derrete', 'desaba', 'explode', 'imperdivel', 'voce precisa', 'chocante', 'bomba', 'alerta vermelho', 'colapso', 'caos', 'segredo', 'ninguem te contou',
               'o que ninguem', 'incrivel', 'urgente', 'a verdade sobre', 'vai quebrar', 'fim do', 'entenda por que voce']
MOVIMENTO = ['sobe', 'cai ', 'caem', 'sobem', 'salta', 'recua', 'avanca', 'tomba', 'lidera altas', 'lidera quedas', 'fecha em alta', 'fecha em queda', 'abre em alta', 'abre em queda', 'rallies', 'slumps', 'tumbles', 'surges', 'jumps', 'falls', 'rises']
FORA_NEGOCIO = (r'\b(orquestra|sinfonic\w*|concerto|cine[- ]?concerto|festival|teatro|espetaculo|museu|cinema|filme|musical|danca|bale|futebol|campeonato|'
                r'jogo entre|partida|sub-?\d{2}|copa (do|da|paulista|sul|libertadores)|volei|basquete|maratona|corrida de rua|olimpiad\w*|atleta|torcida|'
                r'premio de jornalismo|edital cultural|patrocinio cultural|natal|reveillon|carnaval)\b')
NEGOCIO = (r'\b(acoes|acao|acionist\w*|lucro|receita|dividend\w*|jcp|producao|contrato|investiment\w*|investe|leilao|concess\w*|preco|combustive\w*|petroleo|refin\w*|gasolina|'
           r'diesel|resultado|balanco|mercado|bolsa|tarifa|governanca|conselho|ceo|diretor\w*|divida|debentur\w*|emissao|aquisicao|venda\w*|faturament\w*|varejo|fusao|regulac\w*|aneel|anp|cvm|'
           r'guidance|capex|ebitda|margem|demiss\w*|greve|multa|processo|justica)\b')
DIDATICO = (r'^(o que (e|sao)|como (funciona|funcionam|investir|declarar|escolher|comecar)|entenda (o que|como)|guia (completo|para|do|de)|aprenda|passo a passo|'
            r'tudo (o que|sobre)|vale a pena investir em (fii|fundos|fiagro|etf))|\bo que (e|sao) (os |as |um |uma )?(fiis?|fundos? (imobiliarios?|de infraestrutura)|fiagros?|etfs?)\b')
RECOMENDACAO = ['acoes para comprar', 'comprar ou vender', 'vale a pena investir', 'melhores acoes', 'carteira recomendada', 'preco-alvo', 'preco alvo', 'recomendacao de compra', 'top picks', 'buy rating', 'stocks to buy', 'o que fazer com']

# Casas de análise: só valem quando o título traz também um verbo de opinião (recomenda, eleva, rebaixa, preço-alvo...).
# É a opinião da casa como a imprensa a publicou; o sistema não recomenda nada.
CASAS = [('BTG Pactual', r'\bBTG\b'), ('XP', r'\bXP\b'), ('Itaú BBA', r'\bIta[uú] ?BBA\b|\bBBA\b'), ('Bradesco BBI', r'\bBBI\b'), ('Safra', r'\bSafra\b'),
         ('Santander', r'\bSantander\b'), ('Goldman Sachs', r'\bGoldman\b'), ('J.P. Morgan', r'\bJ\.? ?P\.? ?Morgan\b|\bJPMorgan\b'), ('Morgan Stanley', r'\bMorgan Stanley\b'),
         ('UBS BB', r'\bUBS\b'), ('Citi', r'\bCiti(group|bank)?\b'), ('Bank of America', r'\bBank of America\b|\bBofA\b'), ('Genial', r'\bGenial\b'), ('Ágora', r'\b[ÁA]gora Investimentos\b'),
         ('BB Investimentos', r'\bBB Investimentos\b'), ('Inter Invest', r'\bInter Invest\b'), ('Warren', r'\bWarren (Investimentos|Rena)\b'), ('Eleven', r'\bEleven Financial\b'),
         ('Ativa', r'\bAtiva Investimentos\b'), ('Guide', r'\bGuide Investimentos\b'), ('Levante', r'\bLevante\b'), ('Nord', r'\bNord (Research|Investimentos)\b'),
         ('Suno Research', r'\bSuno Research\b'), ('Barclays', r'\bBarclays\b'), ('HSBC', r'\bHSBC\b'), ('Jefferies', r'\bJefferies\b'), ('Bernstein', r'\bBernstein\b'), ('Moody\'s', r"\bMoody'?s\b"),
         ('S&P Global', r'\bS&P Global\b'), ('Fitch', r'\bFitch\b')]
OPINIAO = ['recomenda', 'recomendacao', 'eleva', 'rebaixa', 'corta', 'preco-alvo', 'preco alvo', 'compra', 'venda', 'neutr', 'overweight', 'underweight', 'outperform', 'underperform',
           'carteira', 've ', 'veem', 'projeta', 'estima', 'preve', 'espera', 'aposta', 'inicia cobertura', 'upgrade', 'downgrade', 'target', 'rating', 'perspectiva', 'revisa', 'gosta',
           'prefere', 'favorit', 'top pick', 'ações para', 'acoes para', 'tira', 'inclui', 'reforca', 'sees', 'raises', 'cuts', 'lifts', 'expects', 'forecast',
           ' diz', 'avalia', 'segundo', 'alerta', 'sinaliza', 'muda o tom', 'says', 'warns']

# Posição de uma opinião publicada, lida SÓ do título/resumo público (nunca do relatório, que não é acessível).
# 'favoravel' = o título relata recomendação/visão positiva; 'contraria' = negativa; 'neutra'; 'mista' = sinais nos dois sentidos.
POS_FAVORAVEL = [r'eleva (a |sua )?recomendacao', r'eleva .{0,30}para compra', r'\bupgrade', r'recomenda(m|cao de)? compra', r'inicia cobertura .{0,40}compra', r'\boutperform',
                 r'\boverweight', r'sobreponderar', r'top pick', r'\bpreferida', r'eleva (o |seu )?preco[- ]alvo', r'raises? .{0,20}target', r'\bbuy\b', r'\botimis',
                 r've potencial', r'veem potencial', r'\bupside\b', r'esta barata', r'aposta em', r'inclui .{0,40}carteira', r'entra na carteira', r'sinalizam melhora', r've melhora', r'veem melhora']
POS_CONTRARIA = [r'rebaixa', r'corta (a |sua )?recomendacao', r'\bdowngrade', r'recomenda(m|cao de)? venda', r'para venda\b', r'\bunderperform', r'\bunderweight', r'subponderar',
                 r'(corta|reduz) (o |seu )?preco[- ]alvo', r'cuts? .{0,20}target', r'lowers? .{0,20}target', r'\bsell\b', r'\bpessimis', r'(ve|veem) riscos', r'\bcautela',
                 r'tira .{0,40}da carteira', r'retira .{0,40}da carteira', r'sai da carteira', r'baixa qualidade', r'acende alerta']
POS_NEUTRA = [r'\bneutr[oa]\b', r'\bmanutencao\b', r'equal ?weight', r'market perform', r'\bhold\b', r'mantem (a )?recomendacao']
SUJEITO_ANALISTA = r'\b(analistas?|bancos|casas? de analise|corretoras?|research|estrategistas?|gestores)\b'


def posicao_opiniao(item):
    """Sentido da opinião relatada no título/resumo. None quando o texto não traz recomendação ou visão explícita."""
    txt = ' ' + sem_acento((item.get('titulo') or '') + ' ' + (item.get('resumo') or '')).lower() + ' '
    fav = any(re.search(r, txt) for r in POS_FAVORAVEL)
    con = any(re.search(r, txt) for r in POS_CONTRARIA)
    neu = any(re.search(r, txt) for r in POS_NEUTRA)
    if neu and not (fav and con):
        return 'neutra'
    if fav and con:
        return 'mista'
    return 'favoravel' if fav else 'contraria' if con else None


# "mantém" só é opinião quando se refere à recomendação ("mantém compra"), não em "Itaú mantém a dianteira"
OPINIAO_RX = [r'\bmantem (a |sua |o |seu )?(recomendacao|indicacao|compra|venda|neutr|preco|classificacao|rating|outperform|overweight|underweight)']


# Verbos que, sozinhos, também descrevem fatos da própria empresa ("Itaú, Bradesco e Santander lucram… e veem fosso no ROE"):
# em manchete de resultado, só contam como opinião se houver um verbo de recomendação (rebaixa, eleva, preço-alvo, compra…).
OPINIAO_FRACA = ['ve ', 'veem', 'projeta', 'estima', 'preve', 'espera', 'aposta', 'perspectiva', 'revisa', 'gosta', 'prefere', 'favorit', ' diz', 'avalia',
                 'segundo', 'alerta', 'sinaliza', 'muda o tom', 'says', 'warns', 'sees', 'expects', 'forecast', 'tira', 'inclui', 'reforca', 'carteira']
RESULTADO_RX = r'\b(lucr\w*|prejuizo|resultado|balanco|receita|ebitda|[1-4]t\d{2}|trimestre)\b'


def casas_citadas(item):
    """Casas de análise citadas COM verbo de opinião no título ou resumo (lista de nomes)."""
    bruto = (item.get('titulo') or '') + ' ' + (item.get('resumo') or '')
    txt = ' ' + sem_acento(bruto).lower() + ' '
    fortes = [o for o in OPINIAO if o not in OPINIAO_FRACA and o in txt] + [r for r in OPINIAO_RX if re.search(r, txt)]
    fracas = [o for o in OPINIAO_FRACA if o in txt]
    if not fortes and not fracas:
        return []
    if not fortes and re.search(RESULTADO_RX, txt):
        return []
    return [nome for nome, rx in CASAS if re.search(rx, bruto)]


# Recomendação, preço-alvo e horizonte: só quando estão escritos no título, no resumo ou na página pública da casa.
REC_NOMES = {'compra': 'Compra', 'neutro': 'Neutro', 'neutra': 'Neutro', 'venda': 'Venda', 'manutencao': 'Manutenção', 'outperform': 'Outperform',
             'market perform': 'Market perform', 'underperform': 'Underperform', 'overweight': 'Overweight', 'underweight': 'Underweight', 'equal weight': 'Equal weight',
             'buy': 'Compra', 'sell': 'Venda', 'hold': 'Neutro'}
REC_POSICAO = {'Compra': 'favoravel', 'Outperform': 'favoravel', 'Overweight': 'favoravel', 'Venda': 'contraria', 'Underperform': 'contraria', 'Underweight': 'contraria',
               'Neutro': 'neutra', 'Manutenção': 'neutra', 'Market perform': 'neutra', 'Equal weight': 'neutra'}


def casas_unicas(casas):
    """Uma casa, um nome: 'Genial' e 'Genial Investimentos' (ou 'BTG' e 'BTG Pactual') ficam com o nome mais completo."""
    out = []
    for c in casas or []:
        k = sem_acento(c).lower()
        if any(k == sem_acento(o).lower() or sem_acento(o).lower().startswith(k + ' ') for o in out):
            continue
        out = [o for o in out if not k.startswith(sem_acento(o).lower() + ' ')] + [c]
    return out


def extrair_recomendacao(texto):
    """{'recomendacao', 'preco_alvo', 'horizonte'} lidos literalmente do texto; chaves ausentes quando não há."""
    t = ' ' + sem_acento(texto or '').lower() + ' '
    out = {}
    m = re.search(r'recomendacao(?: de| para| em)?[:\s]+(?:de\s+)?(compra|neutr[oa]|venda|manutencao|outperform|market perform|underperform|overweight|underweight|equal weight)\b', t) \
        or re.search(r'\b(?:rating|classificacao)[:\s]+(compra|neutr[oa]|venda|outperform|market perform|underperform|buy|sell|hold)\b', t) \
        or re.search(r'\b(?:para|em|reitera|reiteramos|mantem|mantemos|seguimos com|eleva(?: a recomendacao)? para|rebaixa(?: a recomendacao)? para|inicia cobertura com(?: recomendacao de)?)\s+(?:a recomendacao de\s+)?(compra|neutr[oa]|venda|outperform|market perform|underperform|overweight|underweight)\b', t)
    if m:
        out['recomendacao'] = REC_NOMES.get(m.group(1).replace('neutra', 'neutro'), m.group(1).capitalize())
    m = re.search(r'(?:preco[- ]alvo|preco justo|pa)\s*(?:\d{1,2} ?m(?:eses)?\s*)?(?:de|para|em|:)?\s*(?:de\s+)?(r\$|us\$)\s?(\d{1,4}(?:[.,]\d{2})?)', t)
    if not m:
        m = re.search(r'(?:preco[- ]alvo|target price).{0,40}?\b(?:para|to)\s+(r\$|us\$|\$)\s?(\d{1,4}(?:[.,]\d{2})?)', t)
    if m:
        out['preco_alvo'] = ('R$ ' if m.group(1) == 'r$' else 'US$ ') + m.group(2).replace('.', ',')
    m = re.search(r'(?:para|ate|no|ao)\s+(?:o\s+)?(?:final|fim) de\s+((?:19|20)\d{2})', t) or re.search(r'\b(?:em|para)\s+(?:12|doze) meses\b|preco[- ]alvo\s*12 ?m\b', t) or re.search(r'\bdez(?:embro)?[/ ](?:de )?((?:20)?\d{2})\b', t)
    if m and 'preco_alvo' in out:
        g = m.group(1) if m.lastindex else None
        out['horizonte'] = ('fim de ' + (g if len(g) == 4 else '20' + g)) if g else '12 meses'
    return out


TIPO_PONTOS = {'fato_relevante': 24, 'carta': 30, 'research': 26, 'paper': 26, 'macro': 22, 'dado_oficial': 20, 'documento_oficial': 18, 'discurso': 20, 'relatorio': 20, 'blog': 12, 'podcast': 12, 'video': 12, 'noticia': 8}
CATEGORIA_PONTOS = {'gestora_internacional': 10, 'gestora_brasil': 10, 'instituicao': 10, 'academia': 8, 'oficial_empresa': 8, 'youtube': 2, 'veiculo': 0}
TIPO_NOME = {'fato_relevante': 'Fato relevante (CVM)', 'carta': 'Carta de gestor', 'research': 'Research', 'paper': 'Paper', 'macro': 'Análise macro', 'dado_oficial': 'Dado oficial', 'documento_oficial': 'Documento oficial', 'discurso': 'Discurso',
             'relatorio': 'Relatório', 'blog': 'Artigo', 'podcast': 'Podcast', 'video': 'Vídeo', 'noticia': 'Notícia'}

# Roteiro de estudo por tema: perguntas para contrapor e o que acompanhar. São perguntas, não conclusões.
ROTEIRO = {
    'juros': {'contra': ['A inflação de serviços e as expectativas (Focus, breakevens) sustentam o movimento de juros defendido?', 'Que premissa sobre o fiscal e o câmbio a leitura dos juros carrega?'],
              'monitorar': ['Ata e comunicado do Copom / FOMC', 'Focus (Selic e IPCA)', 'Curva de juros (prefixado e IPCA+)', 'Treasuries de 2 e 10 anos'],
              'canais': ['Juros maiores pesam no valor presente de ativos longos (ações de crescimento, imóveis, prefixados) e favorecem o carrego do pós-fixado.', 'Diferencial de juros Brasil–EUA move o câmbio e o fluxo para emergentes.']},
    'inflacao': {'contra': ['O dado é núcleo ou cheio? Difusão e serviços confirmam a leitura?', 'Choques de oferta (alimentos, energia) explicam a surpresa, e são temporários?'],
                 'monitorar': ['IPCA e IPCA-15 (IBGE)', 'CPI/PCE (EUA)', 'Expectativas Focus', 'Preços de commodities e câmbio'],
                 'canais': ['Inflação acima do esperado tende a adiar cortes de juros e pressiona prefixados; títulos IPCA+ carregam a correção.']},
    'fiscal': {'contra': ['O número é fluxo (resultado primário) ou estoque (dívida/PIB)? Qual a trajetória implícita?', 'Receita extraordinária ou medida permanente?'],
               'monitorar': ['Resultado primário (Tesouro)', 'Dívida bruta/PIB (BCB)', 'Votações no Congresso', 'Prêmio da curva longa'],
               'canais': ['Risco fiscal aparece primeiro no prêmio dos juros longos e no câmbio, depois nas ações domésticas.']},
    'cambio': {'contra': ['O movimento é do real ou do dólar global (DXY)?', 'Fluxo comercial, financeiro ou posicionamento?'],
               'monitorar': ['PTAX e DXY', 'Diferencial de juros', 'Balança comercial e fluxo cambial (BCB)'],
               'canais': ['Câmbio afeta exportadoras e importadoras em sentidos opostos, a inflação importada e o retorno em reais dos ativos no exterior.']},
    'atividade': {'contra': ['Dado dessazonalizado? Revisões anteriores mudam a leitura?', 'Força da atividade é demanda interna ou externa?'],
                  'monitorar': ['PIB e IBC-Br', 'PNAD (desemprego)', 'Varejo, serviços e indústria (IBGE)', 'Payroll e PMIs (EUA)'],
                  'canais': ['Atividade forte sustenta lucros, mas pode adiar cortes de juros; atividade fraca faz o contrário.']},
    'credito': {'contra': ['Spreads apertados refletem risco baixo ou excesso de demanda por carrego?', 'A inadimplência medida é de pessoa física, empresa ou mercado de capitais?'],
                'monitorar': ['Spreads de debêntures e high yield', 'Inadimplência (BCB)', 'Emissões (ANBIMA)', 'Resgates em fundos de crédito'],
                'canais': ['Abertura de spreads encarece o refinanciamento das empresas e pesa em FIIs de papel e fundos de crédito.']},
    'bolsa': {'contra': ['Múltiplo barato por quê: lucro cíclico no pico, juros altos ou risco específico?', 'A revisão de lucros acompanha o movimento do preço?'],
              'monitorar': ['Revisões de lucro', 'Múltiplos versus histórico', 'Fluxo estrangeiro na B3', 'Temporada de resultados'],
              'canais': ['Lucro e taxa de desconto são os dois motores do preço; distinguir qual está em jogo evita confundir notícia com tese.']},
    'alocacao': {'contra': ['As premissas de retorno esperado são compatíveis com os preços atuais?', 'A correlação usada vale em cenários de estresse?'],
                 'monitorar': ['Retornos esperados das gestoras (capital market assumptions)', 'Correlação ações–renda fixa', 'Prêmio de risco implícito'],
                 'canais': ['Mudança no retorno esperado de uma classe altera o peso ótimo de todas as outras; a decisão é relativa.']},
    'fatores': {'contra': ['O prêmio sobrevive a custos e ao período fora da amostra?', 'O fator está caro ou barato versus a própria história?'],
                'monitorar': ['Spread de valuation entre value e growth', 'Desempenho de small caps versus large', 'Pesquisas acadêmicas recentes'],
                'canais': ['Fatores explicam parte do retorno de ETFs e carteiras; ajudam a separar habilidade de exposição.']},
    'commodities': {'contra': ['Movimento de oferta (OPEP, clima) ou de demanda (China, atividade)?', 'Preço à vista ou curva futura?'],
                    'monitorar': ['Brent e minério', 'Estoques e decisões da OPEP', 'Demanda chinesa', 'Câmbio'],
                    'canais': ['Petróleo e minério movem exportadoras brasileiras, a balança comercial e o câmbio; também a inflação.']},
    'geopolitica': {'contra': ['O evento muda fundamentos ou só a volatilidade de curto prazo?', 'Que cenário o mercado já precifica?'],
                    'monitorar': ['Tarifas e decisões comerciais', 'Calendário eleitoral', 'Preços de energia e frete'],
                    'canais': ['Choques geopolíticos chegam por commodities, câmbio e prêmio de risco; raramente mudam a tese de uma empresa isolada.']},
    'china': {'contra': ['Dado oficial ou indicador alternativo? Estímulo anunciado ou executado?'],
              'monitorar': ['PMIs e crédito na China', 'Preço do minério', 'Medidas do PBoC'],
              'canais': ['China é a demanda marginal de minério e soja: afeta exportadoras e o câmbio brasileiro.']},
    'europa': {'contra': ['O problema é cíclico (energia, juros) ou estrutural (produtividade, demografia)?'],
               'monitorar': ['Decisões do BCE', 'PMIs europeus', 'Preço do gás'],
               'canais': ['Europa pesa nos ETFs globais e em exportadoras com receita em euro.']},
    'emergentes': {'contra': ['Brasil se descola ou segue o bloco emergente neste tema?', 'Fluxo é por fundamentos ou por índice/passivo?'],
                   'monitorar': ['Fluxo para fundos de emergentes', 'Dólar global', 'Juros nos EUA'],
                   'canais': ['Fluxo para emergentes costuma seguir o dólar e os juros americanos; o Brasil ganha ou perde junto antes de ser avaliado sozinho.']},
    'tecnologia_ia': {'contra': ['O investimento em IA gera retorno sobre o capital ou é corrida por posição?', 'Quem captura o valor: fabricante de chips, nuvem ou usuário?'],
                      'monitorar': ['Capex das big techs', 'Resultados de semicondutores', 'Concentração do S&P 500'],
                      'canais': ['Concentração em poucas empresas eleva o risco específico de ETFs amplos de ações americanas e globais.']},
    'imobiliario': {'contra': ['Vacância e inadimplência confirmam o rendimento distribuído?', 'Rendimento recorrente ou não recorrente?'],
                    'monitorar': ['Vacância física e financeira', 'Juro real (IPCA+)', 'Relatórios gerenciais dos fundos'],
                    'canais': ['FIIs reagem ao juro real de longo prazo e ao ciclo de crédito; o preço do imóvel vem depois.']},
    'bancos': {'contra': ['Crescimento de crédito com qualidade (PDD) ou com risco adiado?', 'Resultado puxado por margem, serviços ou tesouraria?'],
               'monitorar': ['Inadimplência e PDD', 'Margem financeira', 'Capital principal (Basileia)', 'Regulação do BCB'],
               'canais': ['Bancos ligam ciclo de crédito, Selic e regulação; holdings e seguradoras do grupo seguem o banco controlador.']},
    'energia_utilities': {'contra': ['Receita regulada (previsível) ou mercado livre (exposta a preço)?', 'Revisão tarifária já incorporada?'],
                          'monitorar': ['Revisões tarifárias (ANEEL)', 'Hidrologia e preço de energia', 'Leilões de transmissão'],
                          'canais': ['Utilities são sensíveis ao juro real (fluxo longo e indexado) e a decisões regulatórias.']},
    'regulacao': {'contra': ['A norma muda incentivos de fato ou formaliza prática existente?'],
                  'monitorar': ['Consultas públicas (CVM, BCB)', 'Relatórios de estabilidade financeira'],
                  'canais': ['Regulação altera custo de capital e liquidez; o efeito costuma ser lento e setorial.']},
    'cripto': {'contra': ['Demanda estrutural (ETFs, tesourarias) ou alavancagem de curto prazo?'],
               'monitorar': ['Fluxo dos ETFs de bitcoin', 'Regulação nos EUA', 'Correlação com Nasdaq'],
               'canais': ['Bitcoin tem se comportado como ativo de risco de alta volatilidade; dimensionamento é a decisão principal.']},
    'carta_gestor': {'contra': ['Que premissa a carta assume e o que a invalidaria?', 'O argumento vale para o mandato da Oregon ou só para o do gestor?'],
                     'monitorar': ['Próxima carta do mesmo gestor', 'Dados que a carta cita'],
                     'canais': ['Cartas trazem a tese e o raciocínio; são o material mais valioso para aprender método, não para copiar posição.']},
    'metodo': {'contra': ['A lição depende do período analisado? Sobrevive a outros mercados?'],
               'monitorar': ['Aplicar o conceito a uma decisão recente da carteira'],
               'canais': ['Método e processo são o que se acumula; a notícia do dia, não.']},
}

PERGUNTAS_ESTUDO = {
    'juros': 'Qual o juro real neutro implícito na curva de hoje, e como ele se compara ao que o Copom comunica?',
    'inflacao': 'O que diferencia núcleo, difusão e serviços no IPCA, e qual deles o Copom mais acompanha?',
    'fiscal': 'Como uma mudança de 1 ponto no primário se traduz na trajetória da dívida/PIB com os juros atuais?',
    'cambio': 'Que parcela do movimento do real nesta semana foi do dólar global e que parcela foi específica do Brasil?',
    'atividade': 'Como PIB, IBC-Br e PNAD se relacionam, e qual deles antecipa os outros?',
    'credito': 'Como se decompõe o retorno de um fundo de crédito entre carrego, marcação e inadimplência?',
    'bolsa': 'Quanto da variação do Ibovespa no ano veio de lucro e quanto de múltiplo?',
    'alocacao': 'Como as premissas de retorno esperado desta gestora mudariam os pesos de uma carteira 60/40?',
    'fatores': 'O prêmio de value ou small caps é compensação por risco ou ineficiência? Que evidência sustenta cada visão?',
    'commodities': 'Que ativos da Oregon têm receita ligada a Brent e minério, e por qual canal (preço, volume, câmbio)?',
    'geopolitica': 'Que cenário tarifário o mercado já precifica, e o que mudaria de fato os lucros das exportadoras?',
    'china': 'Como a demanda chinesa chega ao Brasil: minério, soja, câmbio ou fluxo de capitais?',
    'europa': 'Qual a exposição dos ETFs globais da Oregon à Europa, e o que a move?',
    'emergentes': 'O Brasil se descola do bloco emergente em quais momentos históricos, e por quê?',
    'tecnologia_ia': 'Quanto da capitalização do S&P 500 está em dez empresas, e o que isso faz com a diversificação de um ETF amplo?',
    'imobiliario': 'Como o juro real de longo prazo entra no preço de um FII de tijolo e de um de papel?',
    'bancos': 'Como se lê a PDD de um banco: provisão prudente ou piora de crédito?',
    'energia_utilities': 'O que uma revisão tarifária muda no fluxo de caixa de uma distribuidora, e quando ela ocorre?',
    'regulacao': 'Que norma recente mudou o custo de capital de algum setor da carteira?',
    'cripto': 'Que tamanho de posição em bitcoin a carteira suporta sem mudar o perfil de risco?',
    'carta_gestor': 'Qual é a tese central desta carta, que premissa ela assume e o que a invalidaria?',
    'metodo': 'Que decisão recente da carteira esta lição ajudaria a revisar?',
}


# ------------------------------------------------------------------ classificação
def _texto(item):
    return ' ' + sem_acento((item.get('titulo') or '') + ' ' + (item.get('resumo') or '')).lower() + ' '


def _casa(txt, termos):
    """Termos curtos (códigos como PETR4, VWRA) só casam como palavra inteira; os demais, como trecho."""
    out = []
    for t in termos:
        k = sem_acento(t).lower().strip()
        if len(k) < 3:
            continue
        if len(k) <= 6 and re.match(r'^[a-z0-9]+$', k):
            if re.search(r'(?<![a-z0-9])' + re.escape(k) + r'(?![a-z0-9])', txt):
                out.append(t)
        elif k in txt:
            out.append(t)
    return out


# v3.7 · tipo de evento corporativo, pela manchete (sem acento, minúsculas). Só para itens de empresa (com ativo ligado ou
# documento à CVM): "Focus eleva projeção" ou "Treasury bonds" não viram evento. Mesma tabela no painel (TAXON.eventos).
EVENTOS = [
    ('recompra', 'Recompra', r'\brecompra|\bbuy ?back|\bshare repurchase|\brepurchase (program|plan)|\bprograma de recompra'),
    ('fusao', 'Fusões e aquisições', r'\baquisic|\badquir|\bfusao\b|\bfusoes\b|\bcompra (o )?controle|\bcompra (a |uma )?(fatia|participacao)|\bvend(e|er|a) (sua |a )?(fatia|participacao|controle|subsidiaria)|\bvenda (de|da|do) (fatia|participacao|controle|subsidiaria|unidade|ativos?)\b|\bdesinvest|\bmerger\b|\bacquisition|\bacquires?\b|\btakeover\b|\bm&a\b|\boferta publica de aquisicao|\bopa\b|\bjoint venture'),
    ('guidance', 'Guidance e projeções', r'\bguidance\b|\b(eleva|reduz|revisa|reafirma|mantem|corta|divulga) (o |a |as |os |seu |sua |suas )?(guidance|projec|metas)|\bprojec(ao|oes) (de|para) (producao|vendas|capex|investimentos?|ebitda|lucro|receita)|\bplano estrategico|\bplano de negocios|\bcapex (de|para) (r\$ ?)?20\d\d|\b(raises|cuts|lowers|reaffirms) (its |full.year )?(guidance|outlook|forecast)'),
    ('gestao', 'Troca na gestão', r'\b(novo|nova) (ceo|cfo|presidente|diretor|diretora|conselheir)|\brenunci|\bdeixa (o cargo|a presidencia|o comando|a empresa|a diretoria)|\bassume (a |o )?(presidencia|comando|cargo)|\bnomead[oa]|\bnomeia\b|\bsucessao\b|\btroca (de|no|na) (comando|ceo|cfo|presidente|presidencia|diretoria)|\bnames (new )?(ceo|cfo|chief)|\b(ceo|cfo) (to )?steps? down|\bresign'),
    ('divida', 'Emissão de dívida', r'\bdebentur|\bemissao de (divida|notas|bonds?|titulos|cri|cra|debentures)|\bnotas comerciais|\bnotas promissorias|\bbonds?\b|\bcapta (r\$|us\$)|\bcaptac(ao|oes) de (r\$|us\$|divida)|\bnotes offering|\bdebt offering|\bsenior notes|\brefinanci'),
    ('oferta', 'Oferta de ações', r'\bfollow.?on\b|\bipo\b|\bre.?ipo\b|\boferta (publica )?(primaria|secundaria|subsequente|inicial)|\boferta (restrita )?de acoes|\baumento de capital|\bsubscricao de acoes|\bblock ?trade|\bshare offering'),
]
# o que parece evento mas não é: projeção de PIB/inflação feita por banco; aviso de participação relevante (art. 12)
EVENTOS_FORA = {
    'guidance': r'projec\w* (do |da |de |para o |para a )?(pib|ipca|inflacao|selic|juros?|cambio|dolar|crescimento economico|economia)',
    'fusao': r'participacao acionaria|art\.? ?12 da instr|participacao relevante',
}
_EVENTOS_RE = [(k, re.compile(rx), re.compile(EVENTOS_FORA[k]) if k in EVENTOS_FORA else None) for k, _n, rx in EVENTOS]

# v3.10 · macro do Brasil (pedido do Lucas em 09/11/2026): manchetes de agenda do dia, juros, inflação, câmbio, bolsa,
# fiscal e atividade. Só pela manchete, sem acento; vale para veículo e instituição, em português ou em inglês citando o
# Brasil. Manchete só do exterior (Fed, Wall Street, China...) sem nada do Brasil fica de fora: o mundo já tem a sua área.
MACRO_BR = [
    ('agenda', 'Agenda do dia', r'\bagenda (d[oa]s? |desta |dessa |de hoje|economica|do dia|da semana|do mercado)|\bo que (move|mexe com|esperar|acompanhar|vai mexer)|\bcalendario (economico|da semana)|\bindicadores (da semana|desta semana|que movimentam)|\bradar do mercado|\bmercados? (hoje|agora|nesta|digere|reage|acompanha|aguarda|espera|repercute|monitora)\b|\babertura de mercado|\bfechamento de mercado'),
    ('juros', 'Juros', r'\bcopom\b|\bselic\b|\bjuros futuros|\bdi futuro|\bcurva de juros|\btaxa (basica|de juros)|\bjuros (no brasil|altos|reais|sobem|caem|recuam|avancam|longos|curtos)|\bbanco central\b|\bbc (eleva|corta|mantem|sinaliza|deve)|\bgalipolo\b|\bata do copom|\bpolitica monetaria'),
    ('inflacao', 'Inflação', r'\bipca\b|\bipca-15\b|\bigp-?m\b|\binpc\b|\binflacao\b|\bboletim focus\b|\bfocus\b|\bexpectativas? de inflacao|\bdeflacao\b'),
    ('cambio', 'Câmbio', r'\bdolar\b|\bcambio\b|\breal (se )?(valoriza|desvaloriza|sobe|cai|recua|avanca|ganha|perde)|\bmoeda brasileira'),
    ('bolsa', 'Bolsa', r'\bibovespa\b|\bibov\b|\bbolsa brasileira\b|\bbolsa (sobe|cai|fecha|abre|renova|bate|opera)|\bsmall caps\b|\bestrangeiros? na bolsa|\bfluxo estrangeiro|\bcapital estrangeiro'),
    ('fiscal', 'Fiscal', r'\bfiscal\b|\barcabouco\b|\bdivida publica\b|\borcamento (de 20\d\d|federal|da uniao|do governo|publico)|\blei orcamentaria|\bmeta (fiscal|de primario)|\bdeficit (primario|fiscal|nominal|publico|do governo|das contas)|\bsuperavit (primario|fiscal)|\bhaddad\b|\btesouro nacional\b|\bcontas publicas\b|\bgastos? public|\breforma tributaria\b|\bisencao (do|de) (ir|imposto de renda)'),
    ('atividade', 'Atividade', r'\bpib\b|\bcaged\b|\bdesemprego\b|\bpnad\b|\bibc-?br\b|\bproducao industrial\b|\bvendas no varejo\b|\bvolume de servicos\b|\bmassa salarial\b|\bconfianca (do consumidor|da industria|empresarial)|\bbalanca comercial|\b(superavit|deficit) comercial|\bdeficit em conta corrente|\bconta corrente\b'),
]
MACRO_BR_FORA = {
    'fiscal': r'conselho fiscal|notas? fisca|cupom fiscal|ano fiscal|paraiso fiscal|beneficio fiscal da empresa',
    'bolsa': r'bolsa (familia|de estudos|de valores de (nova york|londres|toquio))',
    'juros': r'juros (do cartao|do rotativo|do cheque especial)|banco central (europeu|americano|dos eua|da china|do japao)',
    'cambio': r'cambio (automatico|manual|cvt)',
}
MACRO_BR_EN = [  # notícia em inglês que cita o Brasil
    ('juros', r'\bcentral bank\b|\bselic\b|\binterest rates?\b|\brate (cut|hike)s?\b|\bcopom\b'),
    ('inflacao', r'\binflation\b|\bipca\b'),
    ('cambio', r'\breal\b|\bcurrency\b|\bfx\b'),
    ('bolsa', r'\bbovespa\b|\bstocks?\b|\bequities\b|\bstock market\b'),
    ('fiscal', r'\bfiscal\b|\bbudget\b|\bpublic debt\b|\bhaddad\b'),
    ('atividade', r'\bgdp\b|\bunemployment\b|\bretail sales\b|\bindustrial output\b'),
]
MACRO_NOMES = {k: n for k, n, _ in MACRO_BR}
_MACRO_RE = [(k, re.compile(rx), re.compile(MACRO_BR_FORA[k]) if k in MACRO_BR_FORA else None) for k, _n, rx in MACRO_BR]
_MACRO_EN_RE = [(k, re.compile(rx)) for k, rx in MACRO_BR_EN]
_SO_FORA = re.compile(r'\b(eua|estados unidos|fed|federal reserve|wall street|s&p|nasdaq|dow jones|china|chines[ae]?s?|europa|europeias?|bce|japao|asia|asiatic[oa]s|trump|treasur\w*|payroll|argentina|milei|reino unido|alemanha|nvidia|paraguai|mexic\w*|chile|colombia|peru|uruguai|india|russia|ucrania|israel|oriente medio|canada|franca|italia|espanha)\b')
_BRASIL = re.compile(r'\b(brasil|brasileir\w*|ibovespa|copom|selic|ipca|haddad|lula|galipolo|b3|focus|caged|ibge|tesouro nacional|real|governo)\b')


def macro_br(titulo, idioma='pt'):
    """Subtemas de macro do Brasil na manchete (chaves de MACRO_BR, na ordem da tabela). Lista vazia quando não é macro do
    Brasil ou quando a manchete é só do exterior."""
    t = sem_acento(titulo or '').lower()
    if idioma == 'en':
        if 'brazil' not in t:
            return []
        return [k for k, rx in _MACRO_EN_RE if rx.search(t)]
    if idioma not in ('pt', None, ''):
        return []
    out = [k for k, rx, fora in _MACRO_RE if rx.search(t) and not (fora and fora.search(t))]
    if out and _SO_FORA.search(t) and not _BRASIL.search(t):
        return []
    return out


def eventos_de(titulo):
    """Tipos de evento corporativo citados na manchete (lista de chaves de EVENTOS, na ordem da tabela)."""
    t = sem_acento(titulo or '').lower()
    return [k for k, rx, fora in _EVENTOS_RE if rx.search(t) and not (fora and fora.search(t))]


def classificar(item, oregon, hoje):
    """Preenche temas, regioes, ativos, setores, fatores, natureza e prioridade. Não remove nenhum item."""
    txt = _texto(item)
    temas = [k for k, termos in TEMAS.items() if _casa(txt, termos)]
    regioes = [k for k, termos in REGIOES.items() if _casa(txt, termos)]
    if item.get('pais') == 'Brasil' and 'brasil' not in regioes and (item.get('categoria') in ('gestora_brasil', 'oficial_empresa') or item.get('idioma') == 'pt'):
        regioes.append('brasil')
    if item.get('pais') in ('EUA', 'Estados Unidos') and 'eua' not in regioes and item.get('categoria') == 'instituicao':
        regioes.append('eua')
    fatores = [k for k, termos in FATORES.items() if _casa(txt, termos)]
    ativos, setores, porque_at = [], [], {}
    def sem_excluidos(a):  # expressões que contêm o nome mas não são a empresa ("Margem Equatorial", "Inter de Milão")
        t0 = txt
        for ex in a.get('excluir') or []:
            t0 = t0.replace(sem_acento(ex).lower(), ' ')
        return t0
    for t, a in (oregon.get('ativos') or {}).items():
        achou = _casa(sem_excluidos(a), a.get('termos') or [])
        if achou:
            ativos.append(t)
            porque_at[t] = achou[0]
    for s in oregon.get('setores') or []:
        achou = _casa(txt, s.get('termos') or [])
        if achou or any(t in ativos for t in s.get('tickers') or []):
            setores.append(s['id'])
    if item.get('tipo') == 'carta' and 'carta_gestor' not in temas:
        temas.append('carta_gestor')
    if item.get('categoria') == 'veiculo' and 'carta_gestor' in temas:
        temas.remove('carta_gestor')  # na imprensa, "cenário" e "perspectivas" não fazem de uma notícia uma carta de gestor
    temas_etf, etfs_tema = [], []
    for te in oregon.get('temas_etf') or []:
        if _casa(txt, te.get('termos') or []):
            temas_etf.append(te['tema'])
            etfs_tema += [e for e in te.get('etfs') or [] if e not in etfs_tema]
    texto_casa = item.pop('_texto_casa', '') or ''  # texto visível da página da casa: só para ler recomendação; nunca guardado
    casas = casas_citadas(item)
    casa_fonte = item.get('casa_fonte')  # fonte de research da própria casa (InvesTalk, Genial Analisa…): o texto é a opinião dela
    for t in (item.get('ativos') or []) + (item.get('ativos_vip') or []):  # ativo já ligado pelo coletor (busca específica, documento da CVM): fica
        a0 = (oregon.get('ativos') or {}).get(t) or {}
        if t not in ativos and a0.get('excluir') and _casa(txt, a0['excluir']) and not _casa(sem_excluidos(a0), a0.get('termos') or []):
            continue  # a busca trouxe o nome dentro de outra expressão ("Margem Equatorial" na busca por Equatorial)
        if t not in ativos:
            ativos.insert(0, t)
            porque_at[t] = porque_at.get(t) or 'busca específica do ativo'
    etfs_tema = list(dict.fromkeys((item.get('etfs_tema') or []) + etfs_tema))
    posicao = posicao_opiniao(item)
    analistas = bool(re.search(SUJEITO_ANALISTA, sem_acento(item.get('titulo') or '').lower()))
    if not regioes:  # sem região no texto: a do veículo ou da instituição (fato da fonte)
        r0 = {'Brasil': 'brasil', 'EUA': 'eua', 'Estados Unidos': 'eua', 'Europa': 'europa', 'Global': 'global'}.get(item.get('pais'))
        if r0:
            regioes.append(r0)
    if item.get('categoria') not in (None, 'veiculo') and not casa_fonte:
        # documento à CVM, carta de gestora ou publicação de instituição: citar uma casa ou agência ("Fitch eleva o rating")
        # não faz do documento a opinião dela; opinião de casa vem da imprensa ou da página de research da própria casa
        casas, analistas = [], False
    # v3.5 · relevância: patrocínio cultural ou esportivo cita a empresa, mas não é notícia dela ("Orquestra Petrobras
    # Sinfônica", "jogo Ferroviária x Paulista Sub-20 Petrobras"); conteúdo didático genérico ("O que são fundos
    # imobiliários") não é ligado aos fundos nem aos temas dos ETFs. O item continua na Biblioteca.
    tit_n = sem_acento(item.get('titulo') or '').lower()
    if re.search(FORA_NEGOCIO, tit_n) and not re.search(NEGOCIO, tit_n) and item.get('categoria') != 'oficial_empresa':
        ativos, porque_at, setores = [], {}, []
        item['fora_do_negocio'] = True
    else:
        item.pop('fora_do_negocio', None)
    if re.search(DIDATICO, tit_n):
        etfs_tema = []
        item.pop('setor_de', None)
        item.pop('setor_de_vip', None)
        item['didatico'] = True
    verif = item.get('opiniao_verificada')  # opinião conferida na página (pesquisa de 12 meses): casas e sentido lidos ali
    if verif:
        casas = list(dict.fromkeys(list(verif.get('casas') or []) + casas))
        posicao = verif.get('posicao') or posicao
    natureza = 'original'
    if verif:
        natureza = 'opiniao_casa'
    elif _casa(txt, PROMOCIONAL):
        natureza = 'promocional'
    elif casas or (posicao and analistas) or (casa_fonte and ativos and item.get('categoria') != 'veiculo'):
        natureza = 'opiniao_casa'
    elif _casa(txt, RECOMENDACAO):
        natureza = 'recomendacao'
    elif _casa(txt, SENSACIONAL):
        natureza = 'sensacionalista'
    elif item.get('categoria') == 'veiculo' and _casa(txt, MOVIMENTO) and not temas and (ativos or not macro_br(item.get('titulo'), item.get('idioma'))):
        natureza = 'movimento'  # v3.10: Ibovespa, dólar e juros andando (sem empresa da carteira) são notícia de mercado; manchete de empresa segue a regra de antes
    elif item.get('categoria') == 'veiculo':
        natureza = 'noticia'
    item.update({'temas': temas[:6], 'regioes': regioes[:4], 'ativos': ativos[:14], 'setores': setores[:4], 'fatores': fatores[:4], 'natureza': natureza, 'ativos_porque': porque_at,
                 'casas': casas[:4], 'temas_etf': temas_etf[:3], 'etfs_tema': etfs_tema[:8]})
    if natureza == 'opiniao_casa':
        # página da própria casa: a opinião é dela, salvo quando o texto relata outra casa (Nord e Empiricus fazem isso)
        if casa_fonte and casa_fonte not in item['casas'] and not item['casas']:
            item['casas'] = [casa_fonte]
        item['casas'] = casas_unicas(item['casas'])
        rec = extrair_recomendacao((item.get('titulo') or '') + ' ' + (item.get('resumo') or '') + ' ' + texto_casa)
        for k in ('recomendacao', 'preco_alvo', 'horizonte'):
            if k in rec and not item.get(k):
                item[k] = rec[k]
        if not posicao and item.get('recomendacao'):
            posicao = REC_POSICAO.get(item['recomendacao'])
        item['posicao'] = posicao  # None = opinião sem sentido explícito no título
    else:
        item.pop('posicao', None)
    item['regras'] = REGRAS_VERSAO
    item['vinculos'] = vinculos(item, oregon)
    separar_vip(item, oregon)
    item['ativos'] = item['ativos'][:8]
    ev = eventos_de(item.get('titulo')) if (item['ativos'] or item.get('ativos_vip') or item.get('categoria') == 'oficial_empresa') else []
    if ev:
        item['eventos'] = ev
    else:
        item.pop('eventos', None)
    mb = macro_br(item.get('titulo'), item.get('idioma')) if item.get('categoria') in ('veiculo', 'instituicao') else []
    if mb:
        item['macro_br'] = mb  # v3.10 · macro do Brasil
    else:
        item.pop('macro_br', None)
    item['prioridade'] = prioridade(item, hoje)
    return item


def separar_vip(item, oregon):
    """v3.5 · ativos que só existem nas carteiras VG VIP vão para ativos_vip / vinculos_vip / ativos_porque_vip. O que a seção
    Oregon lê (ativos, vinculos, prioridade) fica só com a Oregon; a aba VG VIP lê os dois conjuntos."""
    at = (oregon or {}).get('ativos') or {}
    vip = [t for t in item.get('ativos') or [] if (at.get(t) or {}).get('so_vip')]
    for k in ('ativos_vip', 'vinculos_vip', 'ativos_porque_vip'):
        item.pop(k, None)
    if not vip:
        return item
    vin, por = item.get('vinculos') or {}, item.get('ativos_porque') or {}
    item['ativos_vip'] = vip[:8]
    item['vinculos_vip'] = {t: vin.pop(t) for t in vip if t in vin}
    item['ativos_porque_vip'] = {t: por.pop(t) for t in vip if t in por}
    item['ativos'] = [t for t in item['ativos'] if t not in vip]
    return item


def prioridade(item, hoje):
    """Pontos e nível (alta, media, baixa) com o porquê. Nada é escondido pelo nível: ele só ordena."""
    p, porque = 0, []
    tp = TIPO_PONTOS.get(item.get('tipo'), 8)
    p += tp
    porque.append('%s (%+d)' % (TIPO_NOME.get(item.get('tipo'), item.get('tipo') or 'conteúdo'), tp))
    cp = CATEGORIA_PONTOS.get(item.get('categoria'), 0)
    if cp:
        p += cp
        porque.append('fonte primária (%+d)' % cp)
    vin = item.get('vinculos') or {}
    diretos = [t for t in item.get('ativos') or [] if (vin.get(t) or {}).get('tipo', 'direto') == 'direto']
    if diretos:
        p += 10
        porque.append('trata de ativo da Oregon: %s (+10)' % ', '.join(diretos[:3]))
    elif item.get('ativos'):
        p += 2
        porque.append('cita ativo da Oregon só de passagem: %s (+2)' % ', '.join(item['ativos'][:3]))
    elif item.get('setores'):
        p += 6
        porque.append('toca setor da carteira (+6)')
    elif item.get('etfs_tema'):
        p += 5
        porque.append('toca o índice ou o tema de ETF da carteira (+5)')
    elif item.get('fatores'):
        p += 4
        porque.append('toca fator de risco (+4)')
    if item.get('temas'):
        p += min(6, 2 * len(item['temas']))
    if item.get('macro_br') and not item.get('ativos') and not item.get('ativos_vip'):  # v3.10: só macro pura; a nota das notícias de empresa não muda
        p += 8
        porque.append('macro do Brasil: %s (+8)' % ', '.join(MACRO_NOMES.get(k, k).lower() for k in item['macro_br'][:3]))
    q = item.get('publicado_em')
    if q:
        try:
            idade = (hoje - dt.date.fromisoformat(q[:10])).days
        except ValueError:
            idade = 0
        if idade <= 1:
            p += 8
        elif idade <= 3:
            p += 4
        elif idade > 10:
            p -= 5
            porque.append('publicado há %d dias (−5)' % idade)
    else:
        porque.append('sem data de publicação (data de detecção)')
    nat = item.get('natureza')
    if nat == 'promocional':
        p -= 20
        porque.append('conteúdo promocional (−20)')
    elif nat == 'recomendacao':
        p -= 15
        porque.append('lista de “ações para comprar” sem casa identificada (−15)')
    elif nat == 'opiniao_casa':
        p += 4
        porque.append('opinião de casa de análise: %s (+4)' % ', '.join(item.get('casas') or []))
    elif nat == 'sensacionalista':
        p -= 10
        porque.append('título sensacionalista (−10)')
    elif nat == 'movimento':
        p -= 6
        porque.append('só descreve movimento de preço (−6)')
    n_tb = len(item.get('tambem_em') or [])
    if n_tb:
        p += min(6, 2 * n_tb)
        porque.append('mesmo fato em %d outra(s) fonte(s)' % n_tb)
    nivel = 'alta' if p >= 44 else ('media' if p >= 28 else 'baixa')
    return {'pontos': p, 'nivel': nivel, 'porque': porque}


REGRAS_VERSAO = 38  # v3.10: macro do Brasil · itens classificados por regras anteriores são reclassificados na publicação (biblioteca.atualizar_leitura)


# ------------------------------------------------------------------ vínculo do item com cada ativo citado
# Manchete que enumera empresas (dividendos da semana, destaques do dia, "e outros"): quem aparece nela foi citado de
# passagem. As mesmas expressões vão para o painel (TAXON.vinculo), que classifica itens antigos com a mesma regra.
VINCULO = {
    'lista': [r'\be outr[oa]s\b', r'\be mais\b', r'\bentre outr[oa]s\b', r'\bcompletam\b', r'\bdividendos da semana\b', r'\bproventos da semana\b',
              r'\bagenda de (dividendos|proventos)\b', r'\bdata[- ]com\b', r'\bmaiores (altas|baixas|quedas)\b', r'\bcarteira (recomendada|semanal|mensal|de dividendos)\b',
              r'\bacoes para (comprar|investir|ficar|o mes|novembro|dezembro|janeiro|2026|2027)\b', r'\b\d+ acoes\b', r'\btop \d+\b', r'\branking\b', r'\bveja (a lista|quem|quais)\b',
              r'\bdestaques (do dia|da semana|desta|deste|das empresas|do pregao|corporativos)\b', r'\bao vivo\b', r'\bminuto a minuto\b', r'\bresumo do (dia|mercado)\b',
              r'\bo que (mexe|move) (com )?o mercado\b'],
    # resultado da empresa: período (3T26, trimestre, semestre, anual) ou lucro/receita com valor em milhões, bilhões ou %;
    # "balanço" ou "prejuízo" soltos não bastam ("prejuízo de R$ 5 mil" de um cliente, "balanço sobre imóveis sem energia")
    'resultado': r'\b(?:[1-4]t\d{2}\b|[1-4]o tri|trimestr|semestr|guidance\b|ebitda\b|resultados? (?:anua|do ano|de 20\d\d)|balanco (?:anual|trimestral|de 20\d\d)|(?:lucro|prejuizo|receita|faturamento)\b[^.]{0,40}?(?:bilh|milh|\bbi\b|\bmi\b|\d ?%))',
    'codigo': r'\b[A-Z]{4}\d{1,2}\b',
}
VINCULO_NOME = {'direto': 'trata do ativo', 'mencao': 'citado de passagem', 'setorial': 'notícia do setor', 'tematico': 'tema do índice'}


def _no_titulo(titulo, termos, t=None):
    tn = ' ' + sem_acento(titulo or '').lower() + ' '
    if _casa(tn, [x.lstrip('=') for x in termos if x]):
        return True
    m = re.match(r'^([A-Z]{4})\d', t or '')  # outra classe do mesmo papel (KLBN11 para KLBN4)
    return bool(m and re.search(r'(?<![a-z0-9])' + m.group(1).lower() + r'\d{1,2}(?![a-z0-9])', tn))


def vinculo(item, t, termos=None):
    """Vínculo do item com o ativo t. Devolve {'tipo': 'direto'|'mencao', 'motivo': texto, 'evento': None|'oficial'|'recomendacao'|'resultado'}.
    direto  = o ativo é assunto da manchete (ou documento da própria companhia);
    mencao  = citado só no resumo, ou numa manchete que enumera várias empresas (lista de dividendos, destaques do dia).
    Notícias do setor (setor_de) e do tema de ETF (etfs_tema) não citam o ativo e são tratadas à parte."""
    if item.get('categoria') == 'oficial_empresa':
        return {'tipo': 'direto', 'motivo': 'documento da companhia à CVM', 'evento': 'oficial'}
    tit = item.get('titulo') or ''
    tn = ' ' + sem_acento(tit).lower() + ' '
    porque = (item.get('ativos_porque') or {}).get(t)
    if termos is None:
        termos = [porque] if porque and porque != 'busca específica do ativo' else []
    termos = list(termos) + [t]
    if porque != 'busca específica do ativo' and not _no_titulo(tit, termos, t):  # a busca por ativo já exige o nome no título
        return {'tipo': 'mencao', 'motivo': 'citado só no resumo, não na manchete', 'evento': None}
    n_codigos = len(set(re.findall(VINCULO['codigo'], tit)))
    if n_codigos >= 4 or any(re.search(p, tn) for p in VINCULO['lista']):
        return {'tipo': 'mencao', 'motivo': 'aparece numa manchete que enumera várias empresas', 'evento': None}
    if item.get('natureza') == 'opiniao_casa':
        if item.get('casa_fonte') and item.get('categoria') != 'veiculo':
            return {'tipo': 'direto', 'motivo': 'análise publicada pela própria casa (%s)' % item['casa_fonte'], 'evento': 'recomendacao'}
        return {'tipo': 'direto', 'motivo': 'opinião de casa de análise sobre o ativo', 'evento': 'recomendacao'}
    if re.search(VINCULO['resultado'], tn):
        return {'tipo': 'direto', 'motivo': 'a manchete trata do resultado da empresa', 'evento': 'resultado'}
    return {'tipo': 'direto', 'motivo': 'a manchete trata do ativo', 'evento': None}


def vinculos(item, oregon):
    at = (oregon or {}).get('ativos') or {}
    return {t: vinculo(item, t, (at.get(t) or {}).get('termos')) for t in item.get('ativos') or []}


# ------------------------------------------------------------------ leitura curta (regras)
def _br(iso):
    try:
        d = dt.datetime.fromisoformat(iso)
        return d.strftime('%d/%m/%Y')
    except Exception:
        return iso or ''


def _numeros(item):
    txt = (item.get('titulo') or '') + ' ' + (item.get('resumo') or '')
    return re.findall(r'(?:R\$|US\$|\$|€)?\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?\s?(?:%|p\.p\.|bps|bi|mi|bilh[õo]es|milh[õo]es|trilh[õo]es|billion|million|trillion)?', txt)


def resumo_util(item):
    """O resumo público acrescenta algo à manchete? (não vazio, não é a própria manchete repetida, nem fragmento)."""
    r = re.sub(r'\s+', ' ', item.get('resumo') or '').strip()
    if len(r) < 40:
        return False
    a, b = sem_acento(r).lower(), sem_acento(item.get('titulo') or '').lower().strip(' .')
    return not (b and (a.startswith(b) and len(a) < len(b) + 25 or a in b))


def analisar_regras(item, oregon):
    """Leitura curta (v2), sem análise inventada: o que a fonte permite verificar. O painel monta o texto a partir dos
    campos do item (fonte, datas, vínculos, opinião, outras fontes); aqui ficam só a base da leitura, os números literais
    e as perguntas do tema para quem quiser aprofundar (perguntas, nunca argumentos)."""
    A = {'modo': 'regras', 'profunda': False, 'v': 2, 'base': 'resumo' if resumo_util(item) else 'manchete'}
    # só números com unidade, moeda, percentual ou casa decimal: "Carta 41" ou "3T26" não são número citado
    nums = [n.strip() for n in _numeros(item) if re.search(r'(%|p\.p\.|bps|bi|mi|lh|R\$|US\$|\$|€|\d[.,]\d)', n)]
    if nums:
        A['numeros'] = list(dict.fromkeys(nums))[:6]
    perg = []
    for t in (item.get('temas') or [])[:2]:
        for m in (ROTEIRO.get(t) or {}).get('monitorar', [])[:2]:
            if m not in perg:
                perg.append(m)
    if perg:
        A['acompanhar'] = perg[:4]
    return A


def perguntas_estudo(temas, n=3):
    out = []
    for t in temas:
        q = PERGUNTAS_ESTUDO.get(t)
        if q and q not in out:
            out.append(q)
        if len(out) >= n:
            break
    return out


# ------------------------------------------------------------------ IA opcional
ROTULOS = ('FATO', 'FONTE', 'INFERÊNCIA')


def analisar_ia(rede, item, cfg_ia, chave, oregon, modelo, versao_api):
    """Leitura por IA de UM item, com o texto público disponível (título, resumo do feed, fonte). Devolve (analise, uso)
    ou (None, motivo). A IA recebe só conteúdo público; nunca posições, pesos ou dados de clientes."""
    if not chave:
        return None, 'sem chave'
    ativos = ', '.join('%s (%s)' % (t, a.get('nome') or t) for t, a in sorted((oregon.get('ativos') or {}).items()))[:3000]
    sistema = ('Você apoia um gestor de carteiras profissional. Responda só com JSON válido, em português, curto e factual. '
               'Use apenas o texto recebido; não invente números, conclusões, impactos nem contrapontos. Não repita o título como tese. '
               'Se o texto for só uma manchete, devolva listas vazias em vez de preencher. '
               'Cada frase deve ter rótulo "r": FATO (o que o texto afirma literalmente), FONTE (opinião ou tese do autor) ou INFERÊNCIA (sua ligação). '
               'Nunca recomende comprar ou vender. Ativos acompanhados (ligue só se o texto tratar deles): ' + ativos + '.')
    pedido = ('Conteúdo público:\nFonte: %s (%s)\nTipo: %s\nTítulo: %s\nResumo do feed: %s\n\n'
              'Devolva {"resumo": [até 2 frases FATO/FONTE com o que o texto diz além do título], "porque": [até 2 frases: por que merece atenção], '
              '"contrapontos": [só argumentos contrários presentes no próprio texto], "acompanhar": [até 3 dados ou eventos para verificar], '
              '"temas": [até 4 palavras]}.'
              % (item.get('organizacao') or item.get('fonte'), item.get('categoria'), item.get('tipo'), item.get('titulo'), item.get('resumo') or '(sem resumo)'))
    corpo = json.dumps({'model': modelo, 'max_tokens': int(cfg_ia.get('max_tokens_item', 1200)), 'system': sistema, 'messages': [{'role': 'user', 'content': pedido}]}).encode()
    try:
        r = json.loads(rede.get('Anthropic', 'https://api.anthropic.com/v1/messages', timeout=120, tentativas=2, dados=corpo, tipo_403='autenticacao',
                                cab={'x-api-key': chave, 'anthropic-version': versao_api, 'content-type': 'application/json'}).decode('utf-8'))
        txt = ''.join(b.get('text', '') for b in r.get('content', []) if isinstance(b, dict) and b.get('type') == 'text')
        m = re.search(r'\{.*\}', txt, re.S)
        js = json.loads(m.group(0)) if m else {}
        uso = r.get('usage') or {}
    except ErroFonte as e:
        return None, 'IA falhou: %s' % e
    except Exception as e:
        return None, 'IA falhou: %s' % type(e).__name__

    def lista(k):
        out = []
        for x in js.get(k) or []:
            if isinstance(x, dict) and x.get('r') in ROTULOS and isinstance(x.get('t'), str) and x['t'].strip():
                out.append({'r': x['r'], 't': x['t'].strip()[:400]})
        return out[:3]
    A = {'modo': 'ia', 'profunda': True, 'v': 2, 'modelo': modelo, 'lido_em': None, 'resumo_ia': lista('resumo')[:2], 'porque': lista('porque')[:2],
         'contra_texto': lista('contrapontos'), 'acompanhar_ia': [f['t'] for f in lista('acompanhar')],
         'temas_ia': [str(t)[:40] for t in (js.get('temas') or []) if isinstance(t, str)][:4]}
    if not (A['resumo_ia'] or A['porque']):
        return None, 'IA devolveu resposta sem conteúdo utilizável'
    return A, {'entrada': int(uso.get('input_tokens') or 0), 'saida': int(uso.get('output_tokens') or 0)}


def combinar(regras, ia):
    """A IA complementa as regras: base da leitura e números literais vêm sempre das regras."""
    if not ia:
        return regras
    out = dict(regras)
    out.update({k: v for k, v in ia.items() if v})
    out['modo'], out['profunda'], out['v'] = 'ia', True, 2
    out['aviso'] = 'Leitura por IA sobre título e resumo público (não sobre o texto completo). Confira na fonte original.'
    return out
