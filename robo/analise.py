# -*- coding: utf-8 -*-
"""Classificação, prioridade e análise em sete pontos do Oregon Intelligence.

Tudo aqui funciona SEM chave de IA (regras determinísticas sobre título, resumo curto, fonte e tipo). Com a chave
da Anthropic configurada e `intel.ia.ativo` = true, a leitura por IA complementa os itens prioritários, dentro de
um teto diário de itens e de tokens (robo/config.json). Em todos os casos cada frase da análise leva um rótulo:
  FATO       — o que a fonte publicou (título, autor, data, tipo) e o que o texto público afirma literalmente;
  FONTE      — opinião ou tese da própria fonte;
  INFERÊNCIA — ligação feita pelo sistema (palavras-chave → tema, ativo, fator) ou roteiro de estudo.
O sistema nunca conclui impacto, direção ou recomendação. Onde a evidência não basta, diz "não avaliado".
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
RECOMENDACAO = ['acoes para comprar', 'comprar ou vender', 'vale a pena investir', 'melhores acoes', 'carteira recomendada', 'preco-alvo', 'preco alvo', 'recomendacao de compra', 'top picks', 'buy rating', 'stocks to buy', 'o que fazer com']

TIPO_PONTOS = {'carta': 30, 'research': 26, 'paper': 26, 'macro': 22, 'dado_oficial': 20, 'documento_oficial': 18, 'discurso': 20, 'relatorio': 20, 'blog': 12, 'podcast': 12, 'video': 12, 'noticia': 8}
CATEGORIA_PONTOS = {'gestora_internacional': 10, 'gestora_brasil': 10, 'instituicao': 10, 'academia': 8, 'oficial_empresa': 8, 'youtube': 2, 'veiculo': 0}
TIPO_NOME = {'carta': 'Carta de gestor', 'research': 'Research', 'paper': 'Paper', 'macro': 'Análise macro', 'dado_oficial': 'Dado oficial', 'documento_oficial': 'Documento oficial', 'discurso': 'Discurso',
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
    for t, a in (oregon.get('ativos') or {}).items():
        achou = _casa(txt, a.get('termos') or [])
        if achou:
            ativos.append(t)
            porque_at[t] = achou[0]
    for s in oregon.get('setores') or []:
        achou = _casa(txt, s.get('termos') or [])
        if achou or any(t in ativos for t in s.get('tickers') or []):
            setores.append(s['id'])
    if item.get('tipo') == 'carta' and 'carta_gestor' not in temas:
        temas.append('carta_gestor')
    natureza = 'original'
    if _casa(txt, PROMOCIONAL):
        natureza = 'promocional'
    elif _casa(txt, RECOMENDACAO):
        natureza = 'recomendacao'
    elif _casa(txt, SENSACIONAL):
        natureza = 'sensacionalista'
    elif item.get('categoria') == 'veiculo' and _casa(txt, MOVIMENTO) and not temas:
        natureza = 'movimento'
    elif item.get('categoria') == 'veiculo':
        natureza = 'noticia'
    item.update({'temas': temas[:6], 'regioes': regioes[:4], 'ativos': ativos[:8], 'setores': setores[:4], 'fatores': fatores[:4], 'natureza': natureza, 'ativos_porque': porque_at})
    item['prioridade'] = prioridade(item, hoje)
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
    if item.get('ativos'):
        p += 10
        porque.append('cita ativo da Oregon (+10)')
    elif item.get('setores'):
        p += 6
        porque.append('toca setor da carteira (+6)')
    elif item.get('fatores'):
        p += 4
        porque.append('toca fator de risco (+4)')
    if item.get('temas'):
        p += min(6, 2 * len(item['temas']))
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
        porque.append('recomendação de compra/venda (−15)')
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


# ------------------------------------------------------------------ análise em sete pontos (regras)
def _fato_publicacao(item):
    quem = item.get('organizacao') or item.get('fonte')
    tipo = TIPO_NOME.get(item.get('tipo'), 'Conteúdo').lower()
    quando = item.get('publicado_em')
    q = ('em %s' % _br(quando)) if quando else ('detectado em %s (a página não informa a data)' % _br(item.get('detectado_em')))
    s = '%s publicou %s %s: "%s".' % (quem, _artigo(tipo), q, item.get('titulo'))
    if item.get('autor'):
        s += ' Autor: %s.' % item['autor']
    if item.get('tambem_em'):
        s += ' O mesmo fato aparece em %s.' % ', '.join(t.get('fonte') or '?' for t in item['tambem_em'][:3])
    return s


def _artigo(tipo):
    return ('uma ' if tipo.split(' ')[0].endswith('a') else 'um ') + tipo


def _br(iso):
    try:
        d = dt.datetime.fromisoformat(iso)
        return d.strftime('%d/%m/%Y')
    except Exception:
        return iso or ''


def _numeros(item):
    txt = (item.get('titulo') or '') + ' ' + (item.get('resumo') or '')
    return re.findall(r'(?:R\$|US\$|\$|€)?\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?\s?(?:%|p\.p\.|bps|bi|mi|bilh[õo]es|milh[õo]es|trilh[õo]es|billion|million|trillion)?', txt)


def analisar_regras(item, oregon):
    """Sete pontos, cada um como lista de frases rotuladas {'r': FATO|FONTE|INFERÊNCIA, 't': texto}."""
    temas = item.get('temas') or []
    resumo = item.get('resumo') or ''
    A = {'modo': 'regras', 'profunda': False, 'aviso': 'Análise aprofundada (leitura do texto completo por IA) indisponível: estes pontos vêm de regras sobre título, resumo público e fonte.'}
    A['1_publicacao'] = [{'r': 'FATO', 't': _fato_publicacao(item)}]
    # 2. tese central: só o que a fonte diz (título/resumo); nunca deduzida
    tese = []
    if resumo:
        primeira = re.split(r'(?<=[.!?])\s', resumo, maxsplit=1)[0]
        tese.append({'r': 'FONTE', 't': 'Resumo da própria fonte: "%s"' % primeira.rstrip('…') + ('…' if len(primeira) < len(resumo) else '')})
    else:
        tese.append({'r': 'FONTE', 't': 'A fonte afirma, no título: "%s".' % item.get('titulo')})
    if item.get('categoria') == 'veiculo':
        tese.append({'r': 'INFERÊNCIA', 't': 'Veículo de imprensa: o título relata um fato ou declaração; a tese, se houver, é de quem foi citado, não do veículo.'})
    A['2_tese'] = tese
    # 3. evidências: só números e dados literalmente presentes
    # só números com unidade, moeda, percentual ou casa decimal: "Carta 41" ou "3T26" não são evidência
    nums = [n.strip() for n in _numeros(item) if re.search(r'(%|p\.p\.|bps|bi|mi|lh|R\$|US\$|\$|€|\d[.,]\d)', n)][:6]
    ev = []
    if nums:
        ev.append({'r': 'FATO', 't': 'Números citados no título ou resumo público: %s.' % ', '.join(nums)})
    if item.get('tipo') in ('dado_oficial', 'documento_oficial') or item.get('categoria') == 'instituicao':
        ev.append({'r': 'FATO', 't': 'Fonte primária oficial: o dado é o próprio documento, não uma interpretação.'})
    if not ev:
        ev.append({'r': 'INFERÊNCIA', 't': 'Não avaliado: sem leitura do texto completo não há como listar as evidências. Abra a fonte original.'})
    A['3_evidencias'] = ev
    # 4. contrários: roteiro de perguntas por tema
    contra = []
    for t in temas[:3]:
        for q in (ROTEIRO.get(t) or {}).get('contra', [])[:2]:
            contra.append({'r': 'INFERÊNCIA', 't': q})
    if not contra:
        contra.append({'r': 'INFERÊNCIA', 't': 'Pergunta geral: que premissa o texto assume, e que dado a invalidaria?'})
    A['4_contrarios'] = contra
    # 5. implicações por região: canais usuais de transmissão, nunca direção do impacto
    impl = []
    regs = item.get('regioes') or []
    if regs:
        impl.append({'r': 'FATO', 't': 'Regiões citadas: %s.' % ', '.join(REGIAO_NOME.get(r, r) for r in regs)})
    canais = []
    for t in temas[:3]:
        canais += (ROTEIRO.get(t) or {}).get('canais', [])[:1]
    for c in canais[:3]:
        impl.append({'r': 'INFERÊNCIA', 't': 'Canal habitual: ' + c})
    if 'brasil' not in regs and temas and temas[0] in ('juros', 'inflacao', 'cambio', 'commodities', 'emergentes', 'china'):
        impl.append({'r': 'INFERÊNCIA', 't': 'Para o Brasil, o tema costuma chegar por juros americanos, dólar e commodities; o impacto depende da reação local e não está avaliado aqui.'})
    if not impl:
        impl.append({'r': 'INFERÊNCIA', 't': 'Não avaliado: o título e o resumo não permitem ligar o conteúdo a uma região.'})
    A['5_regioes'] = impl
    # 6. Oregon: ligação por palavras-chave, explicitada
    ore = []
    at = item.get('ativos') or []
    if at:
        nomes = ['%s (%s)' % (t, (oregon.get('ativos') or {}).get(t, {}).get('nome') or t) for t in at[:6]]
        ore.append({'r': 'FATO', 't': 'Cita, pelo nome ou código, ativos das carteiras Oregon: %s.' % ', '.join(nomes)})
        ore.append({'r': 'INFERÊNCIA', 't': 'A ligação é por menção no texto público; se o ativo é citado como exemplo, o conteúdo pode não tratar dele. Posições e pesos são os aprovados na seção Oregon, não presumidos aqui.'})
    st = item.get('setores') or []
    if st:
        nomes = [next((s['nome'] for s in oregon.get('setores') or [] if s['id'] == x), x) for x in st]
        ore.append({'r': 'INFERÊNCIA', 't': 'Setores da carteira relacionados ao tema: %s.' % ', '.join(nomes)})
    ft = item.get('fatores') or []
    if ft:
        ore.append({'r': 'INFERÊNCIA', 't': 'Fatores de risco acompanhados: %s.' % ', '.join(FATOR_NOME.get(f, f) for f in ft)})
    if not ore:
        ore.append({'r': 'INFERÊNCIA', 't': 'Sem ligação direta identificada com ativos, setores ou fatores da Oregon. Pode ainda valer como formação.'})
    A['6_oregon'] = ore
    # 7. monitorar
    mon = []
    vistos = set()
    for t in temas[:3]:
        for m in (ROTEIRO.get(t) or {}).get('monitorar', [])[:3]:
            if m not in vistos:
                vistos.add(m)
                mon.append({'r': 'INFERÊNCIA', 't': m})
    if item.get('tipo') == 'carta':
        mon.append({'r': 'INFERÊNCIA', 't': 'Próxima carta da mesma gestora: a tese se manteve ou mudou?'})
    if not mon:
        mon.append({'r': 'INFERÊNCIA', 't': 'Definir, após a leitura, o dado que confirmaria ou invalidaria a tese.'})
    A['7_monitorar'] = mon[:5]
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
    sistema = ('Você apoia a formação de um gestor de carteiras profissional. Responda só com JSON válido, em português. '
               'Use apenas o texto recebido; não invente números, conclusões nem impactos. Quando o texto não bastar, escreva "não avaliado". '
               'Cada frase deve ter rótulo "r": FATO (o que o texto afirma literalmente), FONTE (opinião ou tese do autor) ou INFERÊNCIA (sua ligação). '
               'Nunca recomende comprar ou vender. Ativos acompanhados (ligue só se o texto tratar deles): ' + ativos + '.')
    pedido = ('Conteúdo público:\nFonte: %s (%s)\nTipo: %s\nTítulo: %s\nResumo do feed: %s\n\n'
              'Devolva {"tese": [{"r":..,"t":..}], "evidencias": [...], "contrarios": [...], "regioes": [...], "oregon": [...], "monitorar": [...], '
              '"temas": [até 4 palavras], "resumo_1_frase": "..."} com no máximo 3 frases por lista.'
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
    A = {'modo': 'ia', 'profunda': True, 'modelo': modelo, 'lido_em': None, '2_tese': lista('tese'), '3_evidencias': lista('evidencias'), '4_contrarios': lista('contrarios'),
         '5_regioes': lista('regioes'), '6_oregon': lista('oregon'), '7_monitorar': lista('monitorar'),
         'resumo': str(js.get('resumo_1_frase') or '')[:300], 'temas_ia': [str(t)[:40] for t in (js.get('temas') or []) if isinstance(t, str)][:4]}
    if not (A['2_tese'] or A['3_evidencias']):
        return None, 'IA devolveu resposta sem conteúdo utilizável'
    return A, {'entrada': int(uso.get('input_tokens') or 0), 'saida': int(uso.get('output_tokens') or 0)}


def combinar(regras, ia):
    """A IA complementa as regras: o ponto 1 (publicação) é sempre o fato das regras; os demais usam a IA quando existe."""
    if not ia:
        return regras
    out = dict(regras)
    out.update({k: v for k, v in ia.items() if v})
    out['modo'], out['profunda'] = 'ia', True
    out['aviso'] = 'Análise aprofundada por IA sobre título e resumo público (não sobre o texto completo). Confira sempre na fonte original.'
    out['1_publicacao'] = regras['1_publicacao']
    return out
