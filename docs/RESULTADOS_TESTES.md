# Resultados dos testes · v3.8 · 08/11/2026 (Brasília)

Simulado = rede e arquivos de mentira; os formatos seguem o que foi conferido (metadado do informe diário da CVM,
cadastro pós-175, perfil da SPX no Issuu). O que vem dos dados reais está dito como tal.

## 1. Dados reais (rodada de 19:20 de 08/11, ramo `dados`)

Fontes cuja última tentativa falhou: Squadra, Safra, Santander e Itaú (403); IBGE, Genial (tempo esgotado);
SPX (formato); CNN Brasil (404, nunca funcionou). Sobre cada uma:
- **SPX:** o perfil `issuu.com/spx_capital` lista "CARTA À EQUIPE - 10.26" (08/10/2026) e "09.26" (16/09/2026). O padrão
  exigia "issuu.com" no link e o Issuu usa link relativo. Corrigido.
- **CNN Brasil:** a página de Economia não anuncia feed; o sitemap é numerado (`/sitemap/3673.xml`…), sem um sitemap de
  notícias estável. Desligada com o motivo registrado.
- **Squadra, Safra, Santander, Itaú:** bloqueiam robôs. Ficam em pausa (1 tentativa por dia), sem contornar.

## 2. Robô (Python)

```
python -m unittest discover -s testes -p "test_*.py"
Ran 153 tests in 11.725s
OK
```

Novos (`testes/test_v38.py`, 10):

```
test_cadastro ... ok                                    classe pelo cadastro pós-175; FIC marcado
test_cadastro_sem_coluna_vira_diagnostico ... ok
test_informe_diario ... ok                              FIC fora; subclasses somadas; linha da classe vale; sem cadastro → Outros
test_colunas_desconhecidas ... ok
test_rodada_semanas_meses_e_uma_vez_por_dia ... ok      CNPJ não publicado; CVM fora não apaga nada
test_semanas_antigas_ficam ... ok
test_contador_de_falhas_seguidas ... ok
test_rodada_pula_fonte_em_pausa_e_tenta_no_dia_seguinte ... ok
test_links_relativos_e_mes_pelo_titulo ... ok           SPX: só a carta em português, mês 10.26 → 2026-10
test_cnn_desligada_com_motivo ... ok
```

## 3. Painel e navegador

```
node testes/painel.test.js
60 de 60 testes do painel passaram; modelos quantitativos ok

node painel/test/areas.js http://localhost:8777/index.html
214 PASS · tudo ok
PASS 1440 fluxo dos fundos: semana a semana e mês a mês, com barras ({"sem":2,"meses":2,"barras":4,"res":true,"neg":true,"sw":true})
PASS 1440 fechamento da semana com as nove seções (com o fluxo dos fundos), copiar e imprimir
PASS 390 (as mesmas verificações no celular)
```

Na revisão das capturas, os valores quebravam em duas linhas no celular ("+R$ 3" / "mi"). Corrigido.

## 4. O que confirma no GitHub

- O informe diário da CVM a partir do GitHub: o arquivo do mês tem uns 11 MB.
- Os nomes `Classificacao` e `Classe_Cotas` no cadastro real. Se vierem diferentes, o log mostra as colunas e nada é
  publicado errado.
- A primeira leitura da SPX.

---

# Resultados dos testes · v3.7 · 08/11/2026 (Brasília)

Três tipos de prova, sempre ditos pelo nome: **dados reais já capturados** (o que o robô publicou às 16:10 de 08/11, na
rodada da v3.5, lido com o código da v3.7, sem coletar de novo), **conteúdo real conferido** (página Actions do
repositório, documentação do GitHub, páginas das cartas) e **simulado** (rede de mentira dentro do teste).

## 1. O que os dados reais mostraram

**A agenda do robô quase não roda.** Na página Actions (lida em 08/11, ~17h30), as 10 últimas rodadas são 9 de envio de
arquivos (push) e **1 agendada** (#14). A documentação do GitHub: "High load times include the start of every hour. If the
load is sufficiently high enough, some queued jobs may be dropped. To decrease the chance of delay, schedule your
workflow to run at a different time of the hour." O horário passou para os minutos 7 e 37.

**Estante na rodada real da v3.5** (`biblioteca/estante.json`, 15:57):

```
estante gerado 2026-11-08T15:57-03:00 itens 1341
{'damodaran': 105, 'howard-marks': 166, 'mauboussin': 235, 'cfa-rf': 282, 'aqr': 553}
  mauboussin erro · acesso bloqueado (403)    (as 235 da semente continuam)
  cfa-rf enchendo · howard-marks completo · damodaran completo · aqr completo
  gmo completo (0 itens)  ← errado: nunca foi lida
  compounding-quality enchendo (0 itens)
```

Causa: o limite de 8 páginas por rodada acabou nas primeiras coleções; a GMO tem uma listagem só e era marcada "completo"
sem ter sido lida. Corrigido (a nunca lida vai primeiro; "completo" só depois de lida) e testado com o estado real.

**Tipo de evento nas manchetes reais** (1.966 itens; 390 de empresa):

```
guidance 7  ex.: Lucro da Porto Seguro cai 14% e empresa reduz projeção de receita
            ex.: Renner retira projeções de receita até 2030 citando consumo fraco e concorrência estrangeira
fusao    8  ex.: Rede D'Or e Fleury negam negociações para fusão, apesar de rumores no mercado
divida   1  ex.: AXIA3 — Comunicado ao Mercado: 14ª Emissão de Debêntures - AXIA Energia
```

Duas manchetes erradas na primeira versão e retiradas por regra: "Bradesco reduz projeção do PIB de 2027 para 0,4%"
(guidance) e seis avisos "Aquisição/Alienação de Participação Acionária (art. 12 da Instr. CVM nº 358)" (M&A).

**Termômetro com a janela de 6 meses** sobre as cartas reais: 2026-11 3 cartas, 10 8, 09 2, 08/07/06 0. Sem rede aqui,
as 6 primeiras ficam marcadas como tentadas e nada se perde.

## 2. Robô (Python)

```
python -m unittest discover -s testes -p "test_*.py"
Ran 143 tests in 12.611s
OK
```

Novos da v3.7 (`testes/test_v37.py`, 12, simulados):

```
test_frases_literais_por_empresa ... ok
test_frase_longa_corta_com_a_citacao_dentro ... ok
test_quebra_de_linha_do_pdf_nao_corta_a_frase ... ok
test_sem_mencao_sem_trecho ... ok
test_janela_de_seis_meses_e_trechos_publicados ... ok
test_carta_lida_antes_e_reaberta_uma_vez_depois_das_novas ... ok
test_releitura_que_falha_nao_apaga_a_contagem ... ok
test_data_com_amanha_e_cartas_novas ... ok          (Telegram)
test_sem_nada_nao_acrescenta_secao ... ok
test_manchetes ... ok                               (tipo de evento: manchetes reais acima)
test_so_item_de_empresa ... ok
test_quem_nunca_foi_lido_vai_primeiro ... ok        (Estante, com o estado real de 08/11)
```

## 3. Painel

```
node testes/painel.test.js
59 de 59 testes do painel passaram; modelos quantitativos ok
```

## 4. Navegador (Chromium, 1440 px e 390 px, site de teste, com as fontes IBM Plex que o site usa)

```
node painel/test/areas.js http://localhost:8777/index.html
210 PASS · tudo ok
PASS 1440 topo: ponto + hora; detalhes, tema escuro e "Coletar agora" no toque
PASS 1440 aviso depois do Atualizar e "Coletar agora" no Hoje
PASS 1440 Hoje: duas colunas, faixa do dia, alertas e fila, vazios em uma linha, atalhos fixos, marcas e eventos
PASS 1440 explicação recolhida no "?" e aberta ao tocar ({"antes":"none","depois":"block"})
PASS 1440 mudanças de recomendação: a mesma casa contra a visão anterior (Itaú BBA, KLBN4: Compra · R$ 25,00 → Neutro)
PASS 1440 fechamento da semana com as oito seções, copiar e imprimir
PASS 1440 busca com filtros: evento, fonte, frase, exclusão, período e tipo
PASS 1440 termômetro: trecho literal da carta e grade empresa × mês
PASS 1440 ficha mais larga: a lista recolhe e volta ({"larg":1352})
PASS 1440 comitê: botão Imprimir e folha limpa na impressão
PASS 1440 Hoje VIP: mapa enxuto com os 35 ativos (6 quadrados, 29 na linha "sem notícias")
PASS 390 celular: seções embaixo, áreas recolhíveis e notícias em duas linhas ({"navBaixo":true,"clamp":"2","alt":2})
PASS 1440 nenhuma tela escreve "null", "undefined" ou "NaN" ()      (17 telas; o mesmo no celular)
```

Na revisão das capturas: o "O" da opinião ficava sozinho numa linha (a marca agora vai dentro do título); a etiqueta do
evento aparecia cortada (conflito com uma classe antiga `.ev`, renomeada); uma classe `tp` já existia no registro de
aprendizados (renomeada para `mt`); e o cabeçalho das páginas sem botão à direita escrevia "null" no canto (achado na
captura do Termômetro; agora há uma verificação em 17 telas). As quatro ficaram corrigidas antes de fechar o pacote.

## 5. O que funciona, o que depende de autorização e o que não está disponível

- **Funciona (conferido aqui):** todas as telas novas, tema escuro, impressão, busca com filtros, regras de evento sobre
  manchetes reais, correção da Estante com o estado real.
- **Confirma no GitHub:** as rodadas agendadas aos :07 e :37 (o GitHub não garante horário), a releitura das cartas para os
  trechos, a mensagem nova do Telegram.
- **Depende de autorização:** resumo automático de estudos, cartas e notícias (chave paga da Anthropic); disparar o robô
  por um serviço externo de agenda (exigiria um token do GitHub fora dos Secrets).
- **Não disponível:** captação e resgate dos fundos; cartas que são só imagem.

---

# Resultados dos testes · v3.6 · 08/11/2026 (Brasília)

O contêiner onde os testes rodaram não alcança a maior parte da internet. Três tipos de prova, sempre ditos pelo nome:

- **Dados reais já capturados**: o que o robô publicou às 14:13 de 08/11 (ramo `dados`, última rodada antes da v3.5
  subir), lido com o código da v3.6. Nada foi coletado de novo.
- **Conteúdo real conferido**: endereços e formatos lidos nas páginas públicas em 08/11 (B3, CVM, feeds de wealth,
  Estante, páginas de carta da Dynamo e da JGP).
- **Simulado**: rede de mentira dentro do teste. Prova a lógica, não a internet. B3, CVM, cartas e fontes novas só se
  confirmam na primeira rodada no GitHub.

## 1. Termômetro das cartas sobre os dados REAIS (cartas das gestoras brasileiras no histórico)

```
2026-11  3 cartas  JGP Gestão de Recursos
2026-10  8 cartas  Dynamo, JGP, Kinea, Legacy Capital
2026-09  2 cartas  Kinea, Legacy Capital
2026-08  0 cartas
formato do link: 2 PDF · 11 página
```

Dois problemas achados aqui e corrigidos antes de fechar o pacote:

- A janela de meses era contada de 31 em 31 dias e pulava setembro (nov, out, **ago**, jul). Agora é mês a mês.
- 11 das 13 cartas são páginas, não PDF. Na primeira versão elas ficariam de fora. Abrindo as páginas reais (08/11): a
  da Dynamo ("Carta 130 – O Tácito do Tempo") e a da JGP ("Relatório de setembro") só têm o título e o "Leia aqui"; o
  texto está no PDF do mesmo site (`/wp-content/uploads/2026/10/Carta-Dynamo-130.pdf`,
  `/wp-content/uploads/2026/10/JGP_Relatorio-de-Gestao_Fundos-de-Multimercados_Set26.pdf`). O robô agora lê a página e,
  se ela for curta, abre o PDF da carta no mesmo site (o que tem "carta" ou "relatório" no nome ou palavras do título;
  política, regulamento e formulário ficam de fora). As cartas da Kinea são texto na página. Vídeo é pulado.

## 2. Clássico da semana com as sementes reais e os títulos reais de research

```
estante (só sementes, sem rede): itens 459
research com data de 01 a 08/11: 126
temas da Estante nos títulos: macro 18, ia_tecnologia 13, risco_ciclos 7, decisao 5, privados 3, mercados 2
semana 2026-W45 · tema "Macro, inflação e moedas" · Damodaran, "Valuing emerging market companies"
mesma semana, mesmo item: True
semana seguinte (2026-W46): outro item (Howard Marks), sem repetir
```

## 3. Robô (Python)

```
python -m unittest discover -s testes -p "test_*.py"
Ran 131 tests in 9.599s
OK
```

Novos da v3.6 (`testes/test_v36.py`, 17, simulados com formatos conferidos):

```
test_literal_e_cid ... ok                      leitor de PDF: texto simples e fonte com mapa ToUnicode (Word/LibreOffice)
test_pdf_quebrado_nao_derruba ... ok
test_codigo_e_nome_somam_na_mesma_empresa ... ok   PETR3 soma em PETR4; "Vale do Silício" e "quanto vale" não são a Vale
test_mes_da_carta ... ok
test_janela_de_meses_nao_pula_setembro ... ok
test_carta_publicada_como_pagina ... ok        miolo da página sem menu, script e rodapé; PDF da carta, não o da política
test_tres_formas_de_carta ... ok               PDF, página curta com PDF, texto na página e vídeo; segunda rodada não reabre
test_classe_pelo_isin_e_soma_do_ano ... ok     B3: ON/PN/unit pelo ISIN, valor "0,47156696000", datas DD/MM/AAAA
test_falha_mantem_o_publicado ... ok           B3 fora do ar: o publicado fica
test_mes_completo_pelo_tamanho ... ok          CVM: mês completo pelo tamanho do arquivo
test_leitura_gestoras_e_comparacao ... ok      quem entrou e quem saiu em relação ao mês anterior
test_colunas_desconhecidas_viram_diagnostico ... ok
test_fluxo_completo_e_sem_repetir_o_mes ... ok
test_tema_em_alta_e_estavel_na_semana ... ok
test_buscas_geradas ... ok                     lente global (en-US, pares) e wealth (pt-BR)
test_feed_com_html_cru ... ok                  feed do Kitces com HTML cru
test_sitemap_de_noticias_com_titulo ... ok     Financial Planning: título do sitemap
```

## 4. Painel

```
node testes/painel.test.js
58 de 58 testes do painel passaram; modelos quantitativos ok
```

Novo: confere a sintaxe de todos os arquivos de `painel/src` (um erro de digitação numa expressão regular chegou a travar
o painel inteiro durante o desenvolvimento; agora esse tipo de erro para o teste).

## 5. Navegador (Chromium, 1440 px e 390 px, site de teste)

```
node painel/test/areas.js http://localhost:8777/index.html
184 PASS · tudo ok
PASS 1440 comitê do mês: sugestão levada e item à mão na pauta (1|2|true)
PASS 1440 "Levar ao comitê" numa notícia liga e desliga (Na pauta do comitê→Levar ao comitê→Na pauta do comitê)
PASS 1440 agenda de proventos: data-com à frente e pagamentos a receber separados ({"tabelas":2,"linhas":45,"vir":true,"receber":true,"dcFut":true})
PASS 1440 quem tem a ação: mês da CVM e gestora
PASS 1440 termômetro das cartas, só empresas das carteiras por padrão ({"emp":2,"petr":true})
PASS 1440 Wealth e consultorias com CVM e imprensa especializada
PASS 1440 trilha CFP (8) e CFA III (8) ({"mods":16,"cfp":true})
PASS 1440 clássico da semana no Research do Hoje
PASS 1440 ponte Oregon → VIP na ficha
PASS 390 (as mesmas verificações no celular)
```

Todas as telas novas sem rolagem lateral e sem erro de JavaScript em 1440 e 390 px. Na revisão das capturas: a lista de
proventos misturava data-com à frente com pagamentos de data-com já passada (no celular a coluna de pagamento fica fora
da tela); agora são duas listas. As sugestões do comitê ganharam a fonte e a data em linha menor.

## 6. O que funciona, o que depende de autorização e o que não está disponível

- **Funciona (conferido aqui):** comitê do mês, telas novas, leitor de PDF, contagem nas cartas sobre o histórico real,
  clássico da semana com as sementes reais.
- **Confirma na primeira rodada no GitHub:** consulta de proventos da B3 (API interna da página, pode recusar endereços
  de nuvem), carteira dos fundos na CVM (nomes de três colunas), leitura das cartas, fontes de wealth, pesquisas da lente
  global, coleções novas da Estante.
- **Depende de autorização:** resumo automático de estudos, cartas e notícias (precisa da chave paga da Anthropic,
  `docs/IA.md`); posts do X (API paga).
- **Não disponível:** captação e resgate dos fundos (informe diário da CVM; não entrou nesta versão); cartas que são só
  imagem (sem texto para contar); ThinkAdvisor, Citywire, ANBIMA, Valor Investe e Planejar (recusam leitura automática ou
  não têm lista legível).

---

# Resultados dos testes · v3.5 · 08/11/2026 (Brasília)

O contêiner onde os testes rodaram não alcança a maior parte da internet. Três tipos de prova, sempre ditos pelo nome:

- **Dados reais já capturados**: o que o robô publicou às 14:03 de 08/11 (ramo `dados`, primeira rodada da v3.4),
  reprocessado com as regras da v3.5. Nada foi coletado de novo.
- **Conteúdo real conferido**: listas lidas nas páginas públicas em 08/11 (índice do Mauboussin, série do Morgan Stanley,
  memos da Oaktree, papers do Damodaran, CNPJs na B3 e na CVM, feed do Compounding Quality) e os três prints da VG VIP.
- **Simulado**: rede de mentira dentro do teste. Prova a lógica, não a internet. A leitura das listagens da Estante (CFA,
  AQR, GMO, Compounding Quality, blog do Damodaran) só se confirma na primeira rodada no GitHub.

## 1. Regras v3.5 sobre os dados REAIS já capturados (1.113 itens: 935 recentes + 178 opiniões de 12 meses)

```
itens com ativo só da VIP: 17 vínculos; 9 ativos
  BBAS3       5  ex.: Banco do Brasil (BBAS3) sobe quase 4%, mas dividendos de 2027 ainda geram dúvidas
  BRBI11      2  ex.: BR Partners (BRBI11) perde selo de compra no Itaú BBA: o que fez o banco ficar mais cautel
  VALE3       2  ex.: Ibovespa vira o jogo na sexta, sobe 1,39% e encerra três semanas de perdas; Vale (VALE3) a
  SMFT3       2  ex.: Brasil — Axia (AXIA3), Prio (PRIO3), SmartFit (SMFT3) e outros destaques desta quinta-feir
  RECV3       2  ex.: Goldman vê forte crescimento e eleva PRIO3 para compra; RECV3 e BRAV3 ficam em venda
  JHSF3       1  ex.: JHSF (JHSF3) e Copasa (CSMG3): Veja quem paga dividendos na semana
  VIVA3       1  ex.: Vivara retoma compra de ouro e prevê margem estável e caixa sólido em 2027, diz CFO
  RDOR3       1  ex.: Ibovespa a 246 mil? Itaú BBA cita EQTL3 e RDOR3 entre ações que ainda podem correr atrás d
  SBSP3       1  ex.: Dona da Sabesp, Equatorial supera estimativas
fora do negócio (não liga à empresa):
  - Orquestra Petrobras Sinfônica apresenta cine concerto de 'Cidade de Deus' no Rio de Janeiro
  - TV Brasil transmite jogo entre Ferroviária e Paulista Sub-20 Petrobras
  - Escola de Severiano Melo ganha 43 medalhas e põe cidade à frente de Mossoró em olimpíada do Tesouro
didático (não liga aos fundos nem aos temas dos ETFs):
  - O que são fundos imobiliários e como funcionam os investimentos
  - Entenda o que é a Margem Equatorial e por que o Amapá está no centro das buscas por petróleo
```

Esses 17 vínculos vieram de buscas que existiam antes; a partir da rodada da v3.5 o robô passa a buscar os 22 ativos
novos da VIP pelo nome. "Shoppings do Grande Recife apostam em experiências para ampliar vendas no Natal" chegou a ser
marcada como fora do negócio por causa de "Natal"; corrigido ("vendas" conta como negócio) antes de fechar o pacote.

## 2. Estante: sementes conferidas (sem rede)

```
mauboussin 235 itens, 1995–2026 · howard-marks 166, 1990–2026 · damodaran 58 papers, 2008–2020
cfa-rf, aqr, gmo, compounding-quality: 0 até a primeira rodada no GitHub (listagens)
```

Mauboussin: 44 itens com o endereço do Morgan Stanley, os demais com o índice do autor. "Dispersion & Alpha Conversion" e
"Dispersion and Alpha Conversion" viraram uma peça só; edições anuais com o mesmo título (ex.: "Capital Allocation Outside
the US", 2015 e 2016) continuam separadas.

## 3. Robô (Python)

```
python -m unittest discover -s testes -p "test_*.py"
Ran 114 tests in 9.440s
OK
```

Novos da v3.5 (`testes/test_v35.py`, simulados): data futura, filtro do Empiricus, pesquisa de ETF pelo índice e sem
cotação, Genial pela página da ação, alerta imediato, data de entrega da CVM, Estante (semente + listagem + página do
item; errata fora; data da página prevalece; segunda rodada sem rede não apaga nada; link da editora não volta a ser o do
índice), temas por palavra-chave, VG VIP (universo, separação `ativos_vip`, nomes ambíguos: "Quanto vale a Petrobras",
"Vale do Silício", "Vale a pena", "Porto Seguro (BA)", "Jeremy Renner" não ligam).

## 4. Painel

```
node testes/painel.test.js
32 de 32 testes do painel passaram; modelos quantitativos ok
```

Novos: mesmo fato em vários veículos vira um item com o veículo conhecido como principal; baixa relevância (veículo pouco
conhecido sem fato da empresa) e opinião de casa nunca recolhida; veículo conhecido antes no mesmo dia.

## 5. Navegador (Chromium, 1440 px e 390 px, site de teste)

```
node painel/test/areas.js http://localhost:8777/index.html
154 PASS · tudo ok
PASS 1440 menu com seis seções, a sexta é a VG VIP (6|cart)
PASS 1440 Estante com coleções e acervo ({"lomb":7,"itens":60,"maub":true,"indice":true})
PASS 1440 Hoje VIP: mapa com os 35 ativos, radar e debate ({"mapa":35,"radar":true,"debate":true,"vale":true})
PASS 1440 Ativos VIP: três carteiras, 35 linhas, todas as colunas, sem rolagem lateral da página ({"tabelas":3,"linhas":35,"dy26":true,"sw":true})
PASS 1440 ficha VIP com números do print, casas de análise e notícias
PASS 1440 Hoje da Oregon sem os ativos só da VIP
PASS 1440 Pauta VIP por carteira ({"secs":3,"copiar":true})
PASS 390 (as mesmas verificações no celular)
```

Com a sexta aba, o topo passava da largura da tela entre 1280 e 1440 px; o status da coleta agora encolhe com
reticências (medido: largura da página igual à da tela em 1280, 1360, 1440 e 1600 px).

## 6. O que funciona, o que depende de autorização e o que não está disponível

- **Funciona (conferido aqui):** regras novas sobre os dados reais; sementes da Estante; aba VG VIP com os números do
  print; separação Oregon × VIP.
- **Confirma na primeira rodada no GitHub:** listagens da Estante (CFA, AQR, GMO, Compounding Quality, blog do
  Damodaran), páginas de item, notícias dos 22 ativos novos da VIP, documentos à CVM pelos CNPJs novos.
- **Depende de autorização:** posts do X (API paga); hoje cada conta entra só como link.
- **Não disponível:** endereço da editora para os artigos do Mauboussin de 1995 a 2019 (o link abre o índice do autor);
  texto dos posts pagos do Compounding Quality (só título, data e resumo público).

---

# Resultados dos testes · v3.4 · 08/11/2026 (Brasília)

Saída literal das execuções desta versão. O contêiner onde os testes rodaram não tem saída para a internet. Por isso há
três tipos de prova, sempre ditos pelo nome:

- **Dados reais já capturados**: o que o robô publicou no site às 11:48 de 08/11 (ramo `dados`, depois da v3.3), reprocessado
  com as regras da v3.4. Nada foi coletado de novo.
- **Conteúdo real conferido**: as 165 opiniões de 12 meses, cada uma aberta na página original em 08/11, e trechos copiados
  das páginas do InvesTalk e da Genial.
- **Simulado**: rede de mentira dentro do teste. Prova a lógica (limites, robots.txt, idempotência), não a internet.

## 1. Publicação v3.4 sobre os dados REAIS já capturados

`migrar_acervo_v34`, `importar_sementes`, reclassificação (`REGRAS_VERSAO` 34), `publicar_recentes`, `publicar_opinioes`,
`publicar_research` e briefing, sobre a cópia do ramo `dados`:

```
acervo: 145 cartas antigas sem data deixaram as novidades (mês de referência antigo ou lote do arquivo da página)
  sementes: opinioes_12m.json → 162 opiniões novas na biblioteca (0 já estavam)
research 90 dias: 240
acervo migrado: 145 | sementes novas: 162 | recentes: 699 | opiniões 12m: 172
opiniões por ativo: [('PETR4', 18), ('BBDC3', 16), ('ALOS3', 15), ('TTEN3', 15), ('KLBN4', 14), ('BBSE3', 13), ('EQTL3', 13), ('INBR34', 12), ('VAMO3', 10), ('CPLE3', 10), ('PRIO3', 9), ('AXIA3', 8), ('ITSA4', 8), ('BTLG11', 3), ('TRXF11', 2), ('KNHF11', 1), ('CDII11', 1)]
com recomendação: 101 | com preço-alvo: 92 | sentido: Counter({'favoravel': 92, 'contraria': 30, 'mista': 22, 'neutra': 15, None: 13})
  ALOS3 2026-11-06T15:09 InvesTalk (BB Investimentos) | Allos (ALOS3) 3T26: evolução de receitas impulsionada pelas linhas de  | Compra R$ 38,00 ['BB Investimentos'] favoravel
  ALOS3 2026-11-05T23:58 Genial Analisa | ALLOS (ALOS3) | Resultado 3T26: Imobiliário Puxa o Número, Aluguel Res | Compra R$ 37,00 ['Genial Investimentos'] favoravel
  ALOS3 2026-11-04T18:27 Genial Analisa | ALLOS (ALOS3) | Prévia 3T26: Receitas Fora do Aluguel Puxam o Crescime | Compra R$ 37,00 ['Genial Investimentos'] mista
  ALOS3 2026-10-23T16:22 Genial Analisa | ALLOS (ALOS3) | Flash: KAML11 Começa Menor para Vender Melhor Depois | Compra R$ 39,00 ['Genial Investimentos'] favoravel
```

- **Cartas antigas:** 145 itens sem data de páginas de arquivo (Kapitalo, Alaska, Genoa, Oaktree, Atmos…) saem das
  novidades e continuam na Biblioteca.
- **ALOS3:** os três relatórios pedidos estão em `biblioteca/opinioes.json`, ligados diretamente a ALOS3, com casa,
  recomendação e preço-alvo como escritos na página (linhas "ALOS3" acima).
- **Opiniões de 12 meses:** 172 (eram 12 na v3.3). Com recomendação escrita: 101; com preço-alvo: 92.
- **Research de 90 dias:** 240 publicações com data (cartas, research e instituições), base da página Research.
- **Correções vistas nos dados reais:** "Governo debaterá destino de receitas da Margem Equatorial" deixou de ser
  Equatorial Energia; "Homem de 69 anos tem a conta do Bradesco invadida e sofre prejuízo de R$ 5 mil" e "Copel divulga
  novo balanço sobre imóveis que ainda estão sem energia" deixaram de ser "resultado" da empresa; "PETR4 — Comunicado ao
  Mercado: Fitch eleva o Perfil de Crédito" deixou de ser "opinião da Fitch"; o item do InfoMoney que estava em
  Opiniões não é mais publicado (Grupo XP bloqueado).

## 2. Altura das páginas, antes (v3.3) e depois (v3.4), mesmos dados reais

Medida no navegador (computador 1440 px de largura, celular 390 px). Capturas em `capturas_antes_depois_v3.4.zip`.

| Página | Computador antes | depois | Celular antes | depois |
|---|---|---|---|---|
| Hoje | 3.348 px | 3.231 px | 6.875 px | 6.600 px |
| Brasil · ALOS3 | 4.701 px | 1.831 px | 8.400 px | 7.331 px |
| Mundo · Debate (v3.3: não existia; a rota abria "O que o mundo fala") | 3.026 px | 2.771 px | 4.881 px | 4.904 px |
| Mundo · Research (v3.3: 30 dias; v3.4: 90 dias em três faixas e mapa de temas) | 2.552 px | 3.691 px | 3.295 px | 5.180 px |

O Hoje passou a ter quatro áreas e o mapa de atenção na mesma altura de antes. A página Research ficou mais longa porque
agora cobre 90 dias em vez de 30; as listas começam curtas (8 cartões e 15 linhas por faixa) com "Mostrar mais".

## 3. Testes automáticos (portão do workflow: se algum falha, nada é publicado)

### Robô · 102 testes, todos ok

`testes/test_v34.py` (17 testes novos) usa o arquivo real de opiniões conferidas e trechos reais das páginas das casas; os
demais usam a internet simulada.

```
test_buscador_vedado_por_robots_para_sozinho (test_intel.TestBuscasPorAtivo.test_buscador_vedado_por_robots_para_sozinho) ... ok
test_fatos_relevantes_da_cvm_por_cnpj_e_nome (test_intel.TestBuscasPorAtivo.test_fatos_relevantes_da_cvm_por_cnpj_e_nome) ... ok
test_noticias_reais_por_empresa_com_desambiguacao (test_intel.TestBuscasPorAtivo.test_noticias_reais_por_empresa_com_desambiguacao) ... ok
test_opinioes_publicas_e_fonte_sinalizada (test_intel.TestBuscasPorAtivo.test_opinioes_publicas_e_fonte_sinalizada) ... ok
test_rodada_agendada_respeita_teto_de_buscas (test_intel.TestBuscasPorAtivo.test_rodada_agendada_respeita_teto_de_buscas) ... ok
test_sem_indicadores_macro_falha_do_bcb_nao_afeta_rodada (test_intel.TestBuscasPorAtivo.test_sem_indicadores_macro_falha_do_bcb_nao_afeta_rodada) ... ok
test_setor_e_tema_global (test_intel.TestBuscasPorAtivo.test_setor_e_tema_global) ... ok
test_chave_recusada_nao_derruba (test_intel.TestIA.test_chave_recusada_nao_derruba) ... ok
test_com_chave_respeita_teto_e_rotulos (test_intel.TestIA.test_com_chave_respeita_teto_e_rotulos) ... ok
test_desligada_na_config_nao_chama_mesmo_com_chave (test_intel.TestIA.test_desligada_na_config_nao_chama_mesmo_com_chave) ... ok
test_sem_chave_continua_util (test_intel.TestIA.test_sem_chave_continua_util) ... ok
test_agenda_usa_janela_de_30_dias (test_intel.TestImprensa.test_agenda_usa_janela_de_30_dias) ... ok
test_feed_tolerante_e_fuso_da_fonte (test_intel.TestImprensa.test_feed_tolerante_e_fuso_da_fonte) ... ok
test_fonte_a_validar_nao_marca_parcial (test_intel.TestImprensa.test_fonte_a_validar_nao_marca_parcial) ... ok
test_intervalo_por_fonte_e_leitura_manual_completa (test_intel.TestImprensa.test_intervalo_por_fonte_e_leitura_manual_completa) ... ok
test_migracao_acervo_e_hoje_sem_cartas_antigas (test_intel.TestImprensa.test_migracao_acervo_e_hoje_sem_cartas_antigas) ... ok
test_noticia_do_mundo_liga_ao_tema_do_etf (test_intel.TestImprensa.test_noticia_do_mundo_liga_ao_tema_do_etf) ... ok
test_noticia_por_ativo_e_opiniao_de_casa (test_intel.TestImprensa.test_noticia_por_ativo_e_opiniao_de_casa) ... ok
test_leitura_curta_nao_inventa (test_intel.TestLeituraEVinculo.test_leitura_curta_nao_inventa) ... ok
test_mencao_em_lista_pesa_menos_que_fato_da_empresa (test_intel.TestLeituraEVinculo.test_mencao_em_lista_pesa_menos_que_fato_da_empresa) ... ok
test_publica_opinioes_de_12_meses_e_atualiza_itens_antigos (test_intel.TestLeituraEVinculo.test_publica_opinioes_de_12_meses_e_atualiza_itens_antigos) ... ok
test_reclassificacao_de_item_antigo_corrige_falsa_opiniao (test_intel.TestLeituraEVinculo.test_reclassificacao_de_item_antigo_corrige_falsa_opiniao) ... ok
test_vinculo_das_noticias_reais (test_intel.TestLeituraEVinculo.test_vinculo_das_noticias_reais) ... ok
test_detecta_publicacao_nova_e_edicao_atualizada (test_intel.TestRodada.test_detecta_publicacao_nova_e_edicao_atualizada) ... ok
test_duplicados_por_link_nao_viram_novos (test_intel.TestRodada.test_duplicados_por_link_nao_viram_novos) ... ok
test_falha_de_fonte_nao_apaga_historico (test_intel.TestRodada.test_falha_de_fonte_nao_apaga_historico) ... ok
test_macro_falha_reaproveita_sem_zerar (test_intel.TestRodada.test_macro_falha_reaproveita_sem_zerar) ... ok
test_persistencia_por_mes (test_intel.TestRodada.test_persistencia_por_mes) ... ok
test_publica_todos_os_arquivos_e_classifica (test_intel.TestRodada.test_publica_todos_os_arquivos_e_classifica) ... ok
test_sem_data_no_feed_usa_deteccao_marcada (test_intel.TestRodada.test_sem_data_no_feed_usa_deteccao_marcada) ... ok
test_cadastro_real_valido_e_publico (test_intel.TestSemanalEConfig.test_cadastro_real_valido_e_publico) ... ok
test_fontes_invalidas_sao_criticas (test_intel.TestSemanalEConfig.test_fontes_invalidas_sao_criticas) ... ok
test_oregon_usa_ativos_das_carteiras (test_intel.TestSemanalEConfig.test_oregon_usa_ativos_das_carteiras) ... ok
test_resultados_cvm_na_rodada_manual_e_preservados_em_falha (test_intel.TestSemanalEConfig.test_resultados_cvm_na_rodada_manual_e_preservados_em_falha) ... ok
test_resumo_semanal (test_intel.TestSemanalEConfig.test_resumo_semanal) ... ok
test_workflow_publica_dados_e_nao_expoe_estado (test_intel.TestSemanalEConfig.test_workflow_publica_dados_e_nao_expoe_estado) ... ok
test_robots_veda_e_nao_contorna (test_intel.TestYouTubeRobots.test_robots_veda_e_nao_contorna) ... ok
test_youtube_chave_invalida_vira_erro_de_autenticacao (test_intel.TestYouTubeRobots.test_youtube_chave_invalida_vira_erro_de_autenticacao) ... ok
test_youtube_com_chave_oficial (test_intel.TestYouTubeRobots.test_youtube_com_chave_oficial) ... ok
test_fora_do_fechamento_nao_gasta_cota (test_robo.TestAlphaVantage.test_fora_do_fechamento_nao_gasta_cota) ... ok
test_reserva_dos_etfs_no_fechamento_com_cota (test_robo.TestAlphaVantage.test_reserva_dos_etfs_no_fechamento_com_cota) ... ok
test_calendario_com_feriado (test_robo.TestB3.test_calendario_com_feriado) ... ok
test_leitura_do_layout_oficial (test_robo.TestB3.test_leitura_do_layout_oficial) ... ok
test_agenda_falha_do_ibge_nao_derruba (test_robo.TestBriefing.test_agenda_falha_do_ibge_nao_derruba) ... ok
test_agenda_ibge_copom_fed_e_focus (test_robo.TestBriefing.test_agenda_ibge_copom_fed_e_focus) ... ok
test_etf_nao_contamina_outras_manchetes_nem_empresa (test_robo.TestBriefing.test_etf_nao_contamina_outras_manchetes_nem_empresa) ... ok
test_noticias_de_indice_dos_etfs (test_robo.TestBriefing.test_noticias_de_indice_dos_etfs) ... ok
test_resultados_da_cvm (test_robo.TestBriefing.test_resultados_da_cvm) ... ok
test_resultados_escala_desconhecida_e_falha_parcial (test_robo.TestBriefing.test_resultados_escala_desconhecida_e_falha_parcial) ... ok
test_resultados_so_no_fechamento (test_robo.TestBriefing.test_resultados_so_no_fechamento) ... ok
test_validacao_dos_blocos_novos (test_robo.TestBriefing.test_validacao_dos_blocos_novos) ... ok
test_versao_para_o_site (test_robo.TestBriefing.test_versao_para_o_site) ... ok
test_tudo_fora_e_critico (test_robo.TestCenarioDoLog.test_tudo_fora_e_critico) ... ok
test_yahoo_bloqueado_sem_brapi (test_robo.TestCenarioDoLog.test_yahoo_bloqueado_sem_brapi) ... ok
test_agenda (test_robo.TestConfig.test_agenda) ... ok
test_config_atual_valida_e_migracao (test_robo.TestConfig.test_config_atual_valida_e_migracao) ... ok
test_config_do_repositorio_valida (test_robo.TestConfig.test_config_do_repositorio_valida) ... ok
test_config_invalida_e_critica_sem_apagar_dados (test_robo.TestConfig.test_config_invalida_e_critica_sem_apagar_dados) ... ok
test_dado_velho_vira_desatualizado_e_tenta_proxima_fonte (test_robo.TestCotacoes.test_dado_velho_vira_desatualizado_e_tenta_proxima_fonte) ... ok
test_fora_da_agenda_nao_publica (test_robo.TestCotacoes.test_fora_da_agenda_nao_publica) ... ok
test_reaproveita_ultimo_valido_como_desatualizado (test_robo.TestCotacoes.test_reaproveita_ultimo_valido_como_desatualizado) ... ok
test_tudo_respondendo_completo (test_robo.TestCotacoes.test_tudo_respondendo_completo) ... ok
test_variacao_anormal_suspeita (test_robo.TestCotacoes.test_variacao_anormal_suspeita) ... ok
test_yahoo_ticker_inexistente_nao_pausa_a_fonte (test_robo.TestCotacoes.test_yahoo_ticker_inexistente_nao_pausa_a_fonte) ... ok
test_diagnostico_por_ativo (test_robo.TestDiagnostico.test_diagnostico_por_ativo) ... ok
test_mantem_serie_anterior_quando_fonte_falha (test_robo.TestHistorico.test_mantem_serie_anterior_quando_fonte_falha) ... ok
test_preco_sem_ajuste_e_inicio_de_negociacao (test_robo.TestHistorico.test_preco_sem_ajuste_e_inicio_de_negociacao) ... ok
test_salto_marca_suspeita (test_robo.TestHistorico.test_salto_marca_suspeita) ... ok
test_sem_yahoo_usa_brapi (test_robo.TestHistorico.test_sem_yahoo_usa_brapi) ... ok
test_series_tipadas_e_fontes_registradas (test_robo.TestHistorico.test_series_tipadas_e_fontes_registradas) ... ok
test_classificacao (test_robo.TestNoticias.test_classificacao) ... ok
test_deduplicacao (test_robo.TestNoticias.test_deduplicacao) ... ok
test_desambiguacao (test_robo.TestNoticias.test_desambiguacao) ... ok
test_fontes_oficiais_e_filtros (test_robo.TestNoticiasNaRodada.test_fontes_oficiais_e_filtros) ... ok
test_rss_dos_veiculos (test_robo.TestRSS.test_rss_dos_veiculos) ... ok
test_erros_classificados_e_sem_url (test_robo.TestRede.test_erros_classificados_e_sem_url) ... ok
test_config_invalida_nao_renova_dados (test_robo.TestRevisao.test_config_invalida_nao_renova_dados) ... ok
test_resposta_fora_do_formato_nao_derruba_a_rodada (test_robo.TestRevisao.test_resposta_fora_do_formato_nao_derruba_a_rodada) ... ok
test_rss_link_inseguro_atom_e_sem_data (test_robo.TestRevisao.test_rss_link_inseguro_atom_e_sem_data) ... ok
test_sabado_nao_repete_fechamento_de_sexta (test_robo.TestRevisao.test_sabado_nao_repete_fechamento_de_sexta) ... ok
test_tesouro_reaproveitado_nao_herda_atualizado (test_robo.TestRevisao.test_tesouro_reaproveitado_nao_herda_atualizado) ... ok
test_validacao_das_regras_de_fonte (test_robo.TestRevisao.test_validacao_das_regras_de_fonte) ... ok
test_alerta_nao_repete (test_robo.TestTelegram.test_alerta_nao_repete) ... ok
test_chat_errado_mostra_motivo_e_falha_o_teste (test_robo.TestTelegram.test_chat_errado_mostra_motivo_e_falha_o_teste) ... ok
test_teste_entregue_e_sem_vazar_token (test_robo.TestTelegram.test_teste_entregue_e_sem_vazar_token) ... ok
test_cartas_antigas_sem_data_viram_acervo (test_v34.TestArquivoEPublicacao.test_cartas_antigas_sem_data_viram_acervo) ... ok
test_research_90_dias_e_grupo_xp_bloqueado (test_v34.TestArquivoEPublicacao.test_research_90_dias_e_grupo_xp_bloqueado) ... ok
test_rotulo_generico_vira_titulo_do_endereco (test_v34.TestArquivoEPublicacao.test_rotulo_generico_vira_titulo_do_endereco) ... ok
test_documento_e_newsletter_citando_agencia_nao_viram_opiniao (test_v34.TestClassificacaoV34.test_documento_e_newsletter_citando_agencia_nao_viram_opiniao) ... ok
test_falsas_opinioes (test_v34.TestClassificacaoV34.test_falsas_opinioes) ... ok
test_margem_equatorial_nao_e_a_equatorial_energia (test_v34.TestClassificacaoV34.test_margem_equatorial_nao_e_a_equatorial_energia) ... ok
test_resultado_exige_periodo_ou_valor (test_v34.TestClassificacaoV34.test_resultado_exige_periodo_ou_valor) ... ok
test_arquivo_sem_xp_e_dentro_de_12_meses (test_v34.TestOpinioesConferidas.test_arquivo_sem_xp_e_dentro_de_12_meses) ... ok
test_casos_alos3_entram_ligados_com_recomendacao_e_alvo (test_v34.TestOpinioesConferidas.test_casos_alos3_entram_ligados_com_recomendacao_e_alvo) ... ok
test_reclassificacao_mantem_opiniao_conferida (test_v34.TestOpinioesConferidas.test_reclassificacao_mantem_opiniao_conferida) ... ok
test_ticker_da_pesquisa_vira_o_da_carteira (test_v34.TestOpinioesConferidas.test_ticker_da_pesquisa_vira_o_da_carteira) ... ok
test_extracao_so_do_que_esta_escrito (test_v34.TestPaginasDasCasas.test_extracao_so_do_que_esta_escrito) ... ok
test_genial_pagina_da_casa (test_v34.TestPaginasDasCasas.test_genial_pagina_da_casa) ... ok
test_investalk_endereco_do_trimestre (test_v34.TestPaginasDasCasas.test_investalk_endereco_do_trimestre) ... ok
test_investalk_limites_robots_e_titulo (test_v34.TestPaginasDasCasas.test_investalk_limites_robots_e_titulo) ... ok
test_trimestre_da_temporada (test_v34.TestPaginasDasCasas.test_trimestre_da_temporada) ... ok
test_pesquisa_ativo_fator (test_v34.TestPesquisasRelacao.test_pesquisa_ativo_fator) ... ok
Ran 102 tests in 8.391s
OK
```

### Painel (Node) · 30 testes + 25 dos modelos quantitativos

```
PASS 1. Nenhuma carteira inválida passa despercebida (10 de 15 com pesos que não fecham) · inválidas: 10
PASS Caso: carteira com ativos somando 106% não vira 100%
PASS 2. Placeholder não entra em análise oficial (fundos de teste)
PASS Caso: fundo de teste não gera falsa estabilidade (não é risco zero nem caixa)
PASS 3. Normalização não oculta erro de peso
PASS 4. Contribuições reconciliam com o total
PASS Caso: posição de 3% que cai 40% contribui −1,2 p.p.
PASS 5. Contribuição ao risco é consistente (Σ = σ e derivada numérica)
PASS 6. Covariância usa retornos alinhados nas mesmas datas
PASS 7. Correlação sem histórico suficiente não é inventada
PASS 8. Conversão BRL/USD multiplicativa (−10% em dólar, dólar +10% ≈ −1%)
PASS 9. Duration linear; convexidade só quando cadastrada
PASS 10. Propostas não sobrescrevem a carteira aprovada
PASS 11. Probabilidades de cenários válidas
PASS 12. Ativos sem dados são identificados
PASS 16. Premissas e fontes identificáveis
PASS 20. Decisão gerada por IA exige aprovação humana
PASS Importação: números e datas brasileiros, linhas inválidas rejeitadas
PASS Atribuição: Brinson-Fachler concilia com Rp − Rb
PASS Otimização respeita limites e reporta restrições ativas
PASS Revisão independente: correções verificadas
PASS Teses de 30/10: 21 teses completas e ligadas aos ativos da carteira
PASS Intelligence: busca e filtros da Biblioteca não escondem nada sem filtro; acentos e maiúsculas não importam
PASS Intelligence: exportar e importar aprendizados preserva o registro e descarta lixo
PASS Notícias: hora relativa, últimas com filtros, notícias por ativo e opiniões a favor e contra
PASS Linhas de notícia: hora de publicação, separador de dia, data estimada e destaques sem sensacionalismo
PASS Vínculo com o ativo nas notícias reais capturadas (mesma regra do robô): direto × menção de passagem
PASS ETFs: as 27 fichas têm fonte oficial e o cadastro divergente aparece, sem alterar o cadastro
PASS Consistência das carteiras aprovadas: 10 inválidas, pesos preservados como decididos (sem normalizar)
PASS v3.4: Grupo XP fora de tudo; opiniões da XP em outros veículos continuam; resultado exige período ou valor
PASS 01 riskContrib: sum(ctr) = sigma and sum(pct) = 1 (random 5x5 PSD)
PASS 02 riskContrib: mrc equals finite-difference dSigma/dw (h=1e-6)
PASS 03 toBRL: local -10% and fx +10% gives -1%; fxDecompose reconciles
PASS 04 cov/pearson: hand example and perfectly correlated series
PASS 05 spearman with ties equals hand-computed value
PASS 06 pairwiseCorr: N for staggered series, null below minObs
PASS 07 alignPrices: month-end resampling, listwise intersection, missing counts, unknown id
PASS 08 varHist/esHist on -50..49 / 1000 (type-7 quantile)
PASS 09 varNormal/esNormal closed form (mu=0, sigma=0.01, alpha=0.95)
PASS 10 drawdown on [0.1, -0.5, 0.2]
PASS 11 normInv(0.975), round trip, normCdf vs Simpson integration
PASS 12 projBudgetBox: sum, bounds, KKT form, infeasible -> null
PASS 13 optimize minvar 2-asset diag: (0.2, 0.8); with ub=[1,0.6]: (0.4, 0.6), upper active
PASS 14 optimize with group constraint (assets 0+1 <= 0.5) respected and reported
PASS 15 optimize meanvar: ok:false without mu; closed form with mu
PASS 16 riskParity on diagonal S: w proportional to 1/sigma, equal contributions
PASS 17 ledoitWolf: shrinkage in [0,1], symmetric PD (Cholesky), matches sklearn-style formula
PASS 18 ols: recovers y = 1 + 2x1 - 3x2; null when underdetermined; simple-regression SE
PASS 19 twr with flows, irr, mwr without intermediate flows
PASS 20 brinson: residual ~0, active = Rp - Rb; ok:false when weighted group lacks return
PASS 21 contrib: a 3% position that falls 40% contributes -1.2 p.p.
PASS 22 conditionalShock: Sf=[[1,.5],[.5,1]], f0=2 -> f1=1
PASS 23 cumReturn: ok:false when series starts after window start + 7 days; ok otherwise
PASS 24 inferFreq and ISO-week resampling across a year boundary
PASS 25 misc: hhi/effN, sortino downside over all obs, rolling, beta, divRatio

25 passed, 0 failed

30 de 30 testes do painel passaram; modelos quantitativos ok
```

### Percurso no navegador (computador 1440 e celular 390, dados de teste gerados pelo robô) · 118 verificações

```
PASS 1440 Hoje abre com as últimas notícias, cada uma com hora e veículo (12)
PASS 1440 topo mostra a última coleta e as notícias de 24 h
PASS 1440 Hoje mostra 5 a 8 leituras do dia (8)
PASS 1440 toda leitura abre a fonte original
PASS 1440 sem caixas de macro; agenda presente
PASS 1440 estudo do dia e leitura recomendada
PASS 1440 linha de notícia abre e fecha no lugar (ok)
PASS 1440 janela de leitura editorial, curta e com a fonte original (ok)
PASS 1440 aprendizado salvo neste navegador (1)
PASS 1440 fechar a janela volta ao ponto de leitura ({"dy":0,"foco":true})
PASS 1440 lista de dividendos é menção de passagem (mencao)
PASS 1440 hoje → hoje/briefing
PASS 1440 brasil/ativos → brasil/ativos
PASS 1440 mundo/agora → mundo/agora
PASS 1440 mundo/cartas → mundo/cartas
PASS 1440 mundo/debate → mundo/debate
PASS 1440 mundo/etfs → mundo/etfs
PASS 1440 cart/ref → cart/ref
PASS 1440 cart/mapa → cart/mapa
PASS 1440 cart/carteira → cart/carteira
PASS 1440 cart/perfis → cart/perfis
PASS 1440 bib/busca → bib/busca
PASS 1440 bib/semanal → bib/semanal
PASS 1440 bib/aprendizados → bib/aprendizados
PASS 1440 bib/fontes → bib/fontes
PASS 1440 oregon/ativos → brasil/ativos
PASS 1440 oregon/carteiras → cart/perfis
PASS 1440 oregon/setores → brasil/ativos
PASS 1440 res/empresas → brasil/ativos
PASS 1440 res/etfs → brasil/ativos
PASS 1440 res/eventos → hoje/briefing
PASS 1440 cart/risco → cart/perfis
PASS 1440 cart/construcao → cart/perfis
PASS 1440 global → mundo/agora
PASS 1440 sala/reuniao → cart/perfis
PASS 1440 mesa/mercado → hoje/briefing
PASS 1440 cons/editor → cart/perfis
PASS 1440 busca e filtro da Biblioteca ({"total":19,"q":1,"t":4,"back":19})
PASS 1440 itens de prioridade baixa visíveis na Biblioteca (6)
PASS 1440 mês anterior da biblioteca carrega sob demanda (ok)
PASS 1440 fontes e coleta por fonte (ok)
PASS 1440 resumo semanal (ok)
PASS 1440 ficha PETR4: notícias ao lado, opiniões de 12 meses, sem "Opinião da casa", mudanças na tese primeiro ({"area":"brasil","semPreco":true,"painel":true,"aFavor":true,"doze":true,"busca":true,"aba":"tese","opiniaoCasa":false,"mudou":true,"velho":false})
PASS 1440 aba Fundamentos com a tese e o painel de notícias mantido
PASS 1440 ficha do ETF IMAB11 com painel de notícias (ok)
PASS 1440 Mundo e Estratégia mostra o que o mundo fala (3)
PASS 1440 ETF global abre em Mundo › ETFs globais com notícias do tema (mundo/etfs|true)
PASS 1440 busca rápida abre a ficha de PRIO3
PASS 1440 carteiras de referência (cresc-arr|mostra inválida|sem simulador)
PASS 1440 menu com cinco seções (5|cart)
PASS 1440 topo: cinco seções, busca e hora da coleta à vista ({"nav":true,"busca":true,"hora":true})
PASS 1440 Hoje: quatro áreas, sumário, desde a última visita, profundidade e consultas externas ({"areas":4,"sumario":5,"desde":true,"prof":3,"ext":true})
PASS 1440 profundidade de leitura muda o que aparece (Rápida:sem notícias,Aprofundada:notícias,Briefing:notícias)
PASS 1440 "Ler depois" aparece em Salvos para ler (1)
PASS 1440 Research: 7 dias, 8 a 30, 31 a 90 e biblioteca histórica ({"faixas":3,"hist":true})
PASS 1440 Debate de mercado com consultas externas identificadas ({"op":true,"colab":true,"x":true,"porque":true})
PASS 1440 diagnóstico das fontes na ordem pedida (Fonte|Última tentativa|Último conteúdo|Falha|Publicados)
PASS 1440 busca vazia começa pelos ativos vistos por último (PRIO3 · PRIO visto por último · notícias e ficha)
PASS 1440 Biblioteca com filtros avançados recolhidos
PASS 390 Hoje abre com as últimas notícias, cada uma com hora e veículo (12)
PASS 390 topo mostra a última coleta e as notícias de 24 h
PASS 390 Hoje mostra 5 a 8 leituras do dia (8)
PASS 390 toda leitura abre a fonte original
PASS 390 sem caixas de macro; agenda presente
PASS 390 estudo do dia e leitura recomendada
PASS 390 linha de notícia abre e fecha no lugar (ok)
PASS 390 janela de leitura editorial, curta e com a fonte original (ok)
PASS 390 aprendizado salvo neste navegador (1)
PASS 390 fechar a janela volta ao ponto de leitura ({"dy":0,"foco":true})
PASS 390 lista de dividendos é menção de passagem (mencao)
PASS 390 hoje → hoje/briefing
PASS 390 brasil/ativos → brasil/ativos
PASS 390 mundo/agora → mundo/agora
PASS 390 mundo/cartas → mundo/cartas
PASS 390 mundo/debate → mundo/debate
PASS 390 mundo/etfs → mundo/etfs
PASS 390 cart/ref → cart/ref
PASS 390 cart/mapa → cart/mapa
PASS 390 cart/carteira → cart/carteira
PASS 390 cart/perfis → cart/perfis
PASS 390 bib/busca → bib/busca
PASS 390 bib/semanal → bib/semanal
PASS 390 bib/aprendizados → bib/aprendizados
PASS 390 bib/fontes → bib/fontes
PASS 390 oregon/ativos → brasil/ativos
PASS 390 oregon/carteiras → cart/perfis
PASS 390 oregon/setores → brasil/ativos
PASS 390 res/empresas → brasil/ativos
PASS 390 res/etfs → brasil/ativos
PASS 390 res/eventos → hoje/briefing
PASS 390 cart/risco → cart/perfis
PASS 390 cart/construcao → cart/perfis
PASS 390 global → mundo/agora
PASS 390 sala/reuniao → cart/perfis
PASS 390 mesa/mercado → hoje/briefing
PASS 390 cons/editor → cart/perfis
PASS 390 busca e filtro da Biblioteca ({"total":19,"q":1,"t":4,"back":19})
PASS 390 itens de prioridade baixa visíveis na Biblioteca (6)
PASS 390 mês anterior da biblioteca carrega sob demanda (ok)
PASS 390 fontes e coleta por fonte (ok)
PASS 390 resumo semanal (ok)
PASS 390 ficha PETR4: notícias ao lado, opiniões de 12 meses, sem "Opinião da casa", mudanças na tese primeiro ({"area":"brasil","semPreco":true,"painel":true,"aFavor":true,"doze":true,"busca":true,"aba":"tese","opiniaoCasa":false,"mudou":true,"velho":false})
PASS 390 aba Fundamentos com a tese e o painel de notícias mantido
PASS 390 ficha do ETF IMAB11 com painel de notícias (ok)
PASS 390 Mundo e Estratégia mostra o que o mundo fala (3)
PASS 390 ETF global abre em Mundo › ETFs globais com notícias do tema (mundo/etfs|true)
PASS 390 busca rápida abre a ficha de PRIO3
PASS 390 carteiras de referência (cresc-arr|mostra inválida|sem simulador)
PASS 390 menu com cinco seções (5|cart)
PASS 390 topo: cinco seções, busca e hora da coleta à vista ({"nav":true,"busca":true,"hora":true})
PASS 390 Hoje: quatro áreas, sumário, desde a última visita, profundidade e consultas externas ({"areas":4,"sumario":5,"desde":true,"prof":3,"ext":true})
PASS 390 profundidade de leitura muda o que aparece (Rápida:sem notícias,Aprofundada:notícias,Briefing:notícias)
PASS 390 "Ler depois" aparece em Salvos para ler (1)
PASS 390 Research: 7 dias, 8 a 30, 31 a 90 e biblioteca histórica ({"faixas":3,"hist":true})
PASS 390 Debate de mercado com consultas externas identificadas ({"op":true,"colab":true,"x":true,"porque":true})
PASS 390 diagnóstico das fontes na ordem pedida (Fonte|Última tentativa|Último conteúdo|Falha|Publicados)
PASS 390 busca vazia começa pelos ativos vistos por último (PRIO3 · PRIO visto por último · notícias e ficha)
PASS 390 Biblioteca com filtros avançados recolhidos
tudo ok
```

## 4. O que funciona, o que depende de autorização e o que não está disponível

### Funciona (provado aqui, com dados reais já capturados ou conteúdo real conferido)

- Hoje em quatro áreas, mapa de atenção, desde a última visita, três profundidades, sumário da página.
- Opiniões dos últimos 12 meses com casa, sentido, recomendação, preço-alvo, horizonte e analista quando escritos; visão
  anterior da mesma casa na janela; os três relatórios de ALOS3.
- Research por recência (7, 30 e 90 dias), mapa de temas de gestão com os documentos de cada tema, cartas antigas fora das
  novidades, data de publicação × atualização × detecção.
- Debate de mercado com opiniões publicadas e consultas externas a Reddit e X identificadas como tais.
- "Ler depois" e Salvos para ler; busca com ativos vistos por último; diagnóstico das fontes na ordem pedida.
- Grupo XP bloqueado em coleta e publicação; nenhum veículo XP nas opiniões conferidas.
- Funciona sem IA paga: nada nesta versão usa a chave da Anthropic.

### Só a primeira rodada no GitHub Actions prova

- Que o GitHub alcança as fontes novas marcadas "a validar" (NYT ×4, Bloomberg Opinion, CNBC Economy, Genial relatórios
  por empresa). Onde conferir: Biblioteca › Fontes e coleta.
- Que o InvesTalk responde ao endereço do trimestre a partir do GitHub (testado aqui com a página real copiada e a rede
  simulada) e quais grafias cada empresa usa.
- Que a pesquisa "Relação com a Oregon" (Bing Notícias) traz resultados para cada par ativo × fator: o arquivo
  `pesquisas.json` só existe depois dessa rodada; até lá, a janela mostra a pergunta, o papel do ativo e os botões de
  pesquisa no Google e no Bing.
- Análises de colaboradores do Seeking Alpha: os feeds foram validados em 08/11, mas os itens só chegam na rodada.

### Depende de autorização ou de decisão sua

- **X (Twitter):** API paga por post lido (US$ 0,005), sem plano gratuito. Sem autorização de gasto, só links de busca.
- **Bing Notícias:** o feed traz o aviso "uso pessoal e não comercial". Serve para pesquisa interna; não use os resultados
  em material de cliente.
- **Itaú Análises, Safra O Especialista, Santander Análise Econômica:** responderam 403 ao robô no GitHub. Só a própria
  casa pode liberar; as fontes continuam ligadas e a falha aparece em Fontes e coleta.
- **BB e Genial por API:** as páginas das duas casas montam a lista de relatórios com uma chamada interna. Usar essa chamada
  exigiria confirmar com as casas que o uso é permitido; não foi feito.

### Não disponível

- **Reddit:** robots.txt veda robôs, o JSON sem login devolve 403, o RSS acaba em 13/11/2026, o cadastro da Data API está
  fechado e a API pública fecha em março de 2027. Só links para as comunidades.
- **Reuters** (RSS público encerrado em 2020), **Caixin** (pago, sem feed), **BTG Pactual research** (app de página única,
  sem relatórios no sitemap), **Órama e Levante** (robots.txt veda), **Brookings** (feed quebrado), **Calculated Risk**
  (encerrado).
- **Opiniões específicas de XPML11, HGCR11, KNCA11 e JURO11** nos últimos 12 meses: nenhuma encontrada que trate só do fundo.
- **Notas de risco, convicção ou impacto:** não existem no painel, por não haver metodologia verificável. O mapa de atenção
  conta acontecimentos e diz que quantidade não é risco nem oportunidade.
