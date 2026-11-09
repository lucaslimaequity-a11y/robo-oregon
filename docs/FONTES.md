# Fontes do Oregon Intelligence

Cadastro: `robo/fontes.json`. Regras que valem para todas: só conteúdo público e gratuito; `robots.txt` respeitado (um caminho vedado é pulado e contado como rejeitado); nada de login, paywall ou contorno de bloqueio (403 encerra a fonte na rodada); de imprensa guardamos só título, link, data e veículo; de gestoras e instituições, um resumo curto do próprio feed (até 300 caracteres) e o link para o original. Nenhuma data é inventada: item sem data recebe a data de detecção, marcada como tal.

Validação feita em 07–08/11/2026 (217 fontes no cadastro, 152 ativas, depois da v3.4 e do acréscimo da academia brasileira) lendo cada endereço (`status_validacao`: **ok** = formato e itens recentes confirmados; **parcial** = acessível, com a limitação anotada; demais = desligada, com o motivo). A leitura ao vivo pelo robô acontece no GitHub Actions: a primeira rodada mostra, em **Biblioteca → Fontes e coleta**, o que cada fonte entregou de fato. **Nenhum veículo do Grupo XP entra, em nenhuma hipótese** (v3.4: `noticias.fontes_bloqueadas` = InfoMoney, XP Investimentos, Expert XP, Conteúdos XP, Rico Investimentos, Clear Corretora; descarta também manchetes agregadas desses veículos e não publica o que foi gravado antes do bloqueio). Opinião da XP noticiada por outro veículo continua, com a casa "XP".

## Campos do cadastro

`id`, `nome`, `organizacao`, `categoria` (instituicao · gestora_internacional · gestora_brasil · academia · youtube · veiculo), `pais`, `idioma`, `tipo` (carta · research · paper · macro · relatorio · discurso · documento_oficial · dado_oficial · blog · video · noticia), `metodo`, `url_fonte` (página humana), `url_coleta` (`{ano}` vira o ano corrente), `ativo`. Por método: `padrao` (regex sobre os links da página ou do sitemap), `padrao_data` (regex de data no link), `api` (wp_posts · imf_blog_json · bcb_copom · ibge_releases), `filtro_titulo`/`filtro_link` (regex), `campo_link`, `canal_id` (YouTube), `titulo_item` (documento fixo), `guardar_resumo`, `so_oregon` (feed setorial: só manchetes que citem ativo das carteiras), `maximo`. Desde a v3.4: `casa` (a fonte é a página de research da própria casa: o que ela publica sobre um ativo das carteiras é opinião dela, salvo quando o texto relata outra casa), `ler_item` (o robô abre a página de cada item novo, até `ler_item_max` por rodada, para ler data de publicação, data de atualização, autor e, nas casas, recomendação, preço-alvo e horizonte quando escritos; o texto não é guardado) e `debate` (análise de colaboradores, como o Seeking Alpha: vai para Debate de mercado, separada de notícia e de research de banco).

Para **ligar uma fonte nova**: abra a URL no navegador, confirme que é pública e que o formato bate com o método, acrescente a entrada com `"ativo": true` e rode o workflow à mão; o Summary da rodada mostra recebidos/novos/erro daquela fonte. Para **desligar**: `"ativo": false`.

## v3.8 (08/11/2026): fluxo dos fundos e fontes que falhavam

- **Fluxo dos fundos · CVM** (`robo/fluxo.py`). Fontes:
  - Informe diário: `dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/inf_diario_fi_AAAAMM.zip`, colunas `CNPJ_FUNDO_CLASSE`,
    `DT_COMPTC`, `CAPTC_DIA`, `RESG_DIA`, `VL_PATRIM_LIQ` e `ID_SUBCLASSE`, conferidas no metadado da CVM.
  - Cadastro pós-175: `registro_fundo_classe.zip`, com `Classificacao` e `Classe_Cotas` em `registro_classe.csv`.

  Regras:
  - Os fundos de cotas ficam de fora.
  - Vale a linha da classe; sem ela, a soma das subclasses.
  - A classe que não está no cadastro vai para "Outros".
  - A pasta `/dados/` é liberada no robots.txt; o robô espera 10 segundos entre arquivos (Crawl-Delay da CVM).
  - O cadastro fica no estado interno, renovado a cada 7 dias, e não é publicado.
- **Pausa de fontes**: com 3 falhas seguidas, a fonte é tentada uma vez por dia (`intel.pausa_falhas`, `pausa_horas`).
  O contador `seguidas` fica em `coleta.json`. Na rodada real de 08/11, falhavam seguidamente:
  - com bloqueio 403: Squadra (5 vezes), Safra O Especialista (5), Santander Análise Econômica (3) e Itaú Análises (3);
  - com tempo esgotado: IBGE releases (7) e os dois sitemaps da Genial Analisa (2 cada).

  A Genial continua lida pela página de cada ação (v3.5). Uma rodada disparada pelo envio de arquivos ou por "Run
  workflow" tenta todas as fontes, inclusive as em pausa.
- **SPX Capital (Issuu)**: o padrão passa a ser `/spx_capital/docs/carta_equipe` (o Issuu usa link relativo), com
  `ref_mes_ponto_ano`. Conferido em 08/11: o perfil traz "CARTA À EQUIPE - 10.26" (08/10/2026) e "09.26" (16/09/2026).
- **CNN Brasil · Economia**: desligada com o motivo registrado. A página de Economia não anuncia feed, o `/economia/feed/`
  devolve 404 e o sitemap é numerado, sem um sitemap de notícias estável.

## v3.7 (08/11/2026): trechos das cartas, tipo de evento e horário do robô

- **Termômetro das cartas**: além da contagem, o robô guarda até **duas frases literais** por empresa em cada carta (até
  280 caracteres cada, com o link para a carta), e a janela passou de 4 para 6 meses. O texto integral continua não
  sendo guardado. Nenhum sentido ou opinião é atribuído à gestora: a frase é a dela, com o link para conferir.
- **Tipo de evento** (recompra, fusões e aquisições, guidance, troca na gestão, emissão de dívida, oferta de ações): regra
  pela manchete, só para notícia de empresa. Conferido nas 390 manchetes de empresa do site em 08/11. Duas exclusões
  saíram dessa conferência: "Bradesco reduz projeção do PIB" (projeção macro de banco) e os avisos de "Aquisição/Alienação
  de Participação Acionária" (art. 12), que são participação relevante, não M&A.
- **Horário do robô**: na página Actions, em 08/11 só houve uma rodada agendada; as demais vieram de envios de arquivos.
  A documentação do GitHub diz: "The schedule event can be delayed during periods of high loads of GitHub Actions
  workflow runs. High load times include the start of every hour. If the load is sufficiently high enough, some queued
  jobs may be dropped. To decrease the chance of delay, schedule your workflow to run at a different time of the hour."
  O robô passa a rodar aos 7 e aos 37 minutos de cada hora.
- **Estante**: a coleção que nunca foi lida vai primeiro na rodada (GMO e Compounding Quality ficaram sem vez em 08/11).

## v3.6 (08/11/2026): wealth, Estante de alocação, proventos, fundos e cartas

Conferido em 08/11/2026 lendo cada endereço; nenhum veículo do Grupo XP. As fontes novas entram com `"status":
"a_validar"` e `verificar_na_rodada`: a primeira rodada no GitHub confirma o que cada uma entrega.

**Indústria de wealth e consultorias** (`industria: "wealth"`, aparecem em Mundo e Estratégia › Wealth e consultorias):

| Fonte | Como é lida | Observação |
|---|---|---|
| Kitces · Nerd's Eye View (`wealth-kitces`) | RSS `feeds.kitces.com/KitcesNerdsEyeView` | O feed vem com HTML cru dentro de `content:encoded`, que quebra o XML; o robô tira esse bloco antes de ler (`limpar_xml`). Os links são os do FeedPress, guardados como estão. |
| InvestmentNews (`wealth-investmentnews`) | RSS `investmentnews.com/rss` | Título, link, data e resumo do feed. |
| WealthManagement.com (`wealth-wealthmanagement`) | RSS `wealthmanagement.com/rss.xml` | O site veta por nome alguns robôs de IA; o robô do Oregon usa nome próprio e respeita o robots.txt. |
| Financial Planning (`wealth-financial-planning`) | Sitemap de notícias `news-sitemap-1.xml` (só `/news/` e `/opinion/`) | Título e data vêm do próprio sitemap (`news:title`); a matéria pode pedir cadastro no site. |
| Thinking Ahead Institute (`wealth-thinking-ahead`) | Página de notícias, com leitura da página de cada item | Instituto da WTW sobre gestão de patrimônio de fundos de pensão e soberanos. |
| CVM · notícias (`cvm-noticias`) | Página de notícias da CVM | Vai para o filtro Regulação (`secao_industria: "regulacao"`). |

Mais seis pesquisas em português no Bing Notícias (`noticias.buscas_setor` com `industria: "wealth"`, a cada 6 horas):
consultorias de investimento na CVM, assessorias (fusões e aquisições), family offices, private banking (ANBIMA), wealth
management no Brasil e planejamento financeiro/CFP.

Não entraram: ThinkAdvisor e Citywire (recusam leitura automática; artigos com cadastro), ANBIMA e Valor Investe (o site
recusa o robô), Planejar (sem feed nem lista legível de notícias), McKinsey e BCG (não conferidos).

**Estante de alocação e wealth** (Biblioteca › Estante, mesma regra da v3.5: título, data, link e resumo declarado):

| Coleção | De onde vem |
|---|---|
| Thinking Ahead Institute (`tai`) | Sitemap `research-papers-sitemap.xml` |
| NBIM · Norges Bank Investment Management (`nbim`) | Página de publicações |
| CAIA Association (`caia`) | Blog da CAIA |
| Vanguard (`vanguard`) | Sitemap `en.sitemap.xml`, só `/corp/articles/` |

Ficaram de fora por enquanto: J.P. Morgan AM, BlackRock e Cambridge Associates (listagem só parcial na conferência),
Research Affiliates (o research mudou para Syzygy/VettaFi) e Morningstar (não conferida).

**Lente global por setor**: 16 pesquisas em inglês no Bing Notícias (`mkt: en-US`, `lente: true`, a cada 6 horas), uma
por setor das carteiras (bancos, seguradoras, celulose, petróleo, minério, energia elétrica, saneamento, shoppings/REITs,
agronegócio, locação de pesados, varejo de moda e joias, saúde, incorporadoras, academias, educação superior, banda
larga), com os pares globais de cada um. A manchete só fica se citar um termo do setor.

**Agenda de proventos · B3** (`robo/proventos.py`): a página pública "Empresas listadas" da B3 consulta os proventos em
dinheiro de cada empresa (`listedCompaniesProxy/CompanyCall/GetListedSupplementCompany/<código em base64>`). Campos lidos:
tipo (dividendo, JCP, rendimento), valor por ação, data de aprovação, data-com (`lastDatePrior`), pagamento e "referente
a". A classe (ON, PN, unit) vem do ISIN. Cobre cerca de 12 meses. Uma consulta por empresa, uma vez por dia, com pausa de
1 s. É a API interna da página, sem documentação: se a B3 mudar o formato ou recusar o GitHub, o que já foi publicado
fica e a falha aparece no log e na tela ("não lidas na última rodada").

**Quem tem a ação · CVM** (`robo/fundos.py`): dados abertos da CVM (`dados.cvm.gov.br/dados/FI/DOC/CDA/DADOS/`,
liberado no robots.txt), carteira mensal dos fundos (CDA, bloco 4: ações), e o cadastro `registro_fundo_classe.zip` para
o nome da gestora. A CVM publica os meses com atraso (cerca de 4 meses até o mês ficar completo); o robô escolhe o mês
completo pelo tamanho do arquivo. As colunas da CDA depois da Resolução CVM 175 (`CNPJ_FUNDO_CLASSE`,
`VL_MERC_POS_FINAL`) foram conferidas; `CD_ATIVO`, `TP_APLIC` e `DENOM_SOCIAL` são lidas por nome flexível e, se a
CVM usar outro nome, a rodada registra as colunas encontradas e mantém o mês anterior.

**Termômetro das cartas** (`robo/cartas.py` + `robo/pdftexto.py`): as cartas das gestoras brasileiras já cadastradas
(categoria `gestora_brasil`). O robô abre a carta pública (o PDF, ou a página da carta; quando a página só traz "Leia
aqui", como na Dynamo e na JGP, o PDF do mesmo site), respeitando o robots.txt, até 6 por rodada e no máximo 12 MB. O
texto do PDF é extraído por um leitor próprio, sem biblioteca externa. Conta código de negociação e nome das empresas das
carteiras; guarda só a contagem. PDF que é só imagem não tem texto para contar e aparece como tal. Vídeo fica de fora.

## v3.4 (08/11/2026): opiniões das casas, research global e debate

**Os três relatórios de ALOS3 que faltavam estão no site.** InvesTalk (BB Investimentos) "Allos (ALOS3) 3T26" de 06/11
(Compra, R$ 38,00 para o fim de 2027), Genial "Resultado 3T26" de 05/11 (Compra, R$ 37,00) e Genial "Flash KAML11" de
23/10 (Compra, R$ 39,00 em 12 meses). Por que não entravam: as duas casas publicam a recomendação em texto aberto, mas as
listas dos sites não trazem o link no HTML (os cards são montados por JavaScript); o padrão do InvesTalk no cadastro já
aceitava `ALOS_3T26` (o robô usa busca sem âncora), então o problema não era o padrão. O sitemap do InvesTalk parou em
23/09 e o de relatórios da Genial deu erro de servidor nas quatro tentativas desta validação.

O que a v3.4 faz para cada caminho:

| Caminho | O que é | Como fica |
|---|---|---|
| Opiniões conferidas de 12 meses (`robo/sementes/opinioes_12m.json`) | 165 opiniões publicadas entre 08/11/2025 e 08/11/2026 sobre 18 ativos das carteiras, cada uma aberta e conferida na página original (link, veículo, data, casa, sentido; recomendação, preço-alvo, horizonte e analista só quando escritos). Veículos: Money Times, BP Money, Eu Quero Investir, InvesTalk, Guia do Investidor, Safra O Especialista, Suno, Seu Dinheiro, Investidor10, Genial Analisa, Nord, TradeMap, Bloomberg Línea. Nenhum do Grupo XP. | Entram uma vez na biblioteca (o robô guarda a marca do arquivo; uma versão nova do arquivo entra de novo, sem duplicar). Casas e sentido conferidos ficam guardados no item e não mudam numa reclassificação futura. XPML11, HGCR11, KNCA11 e JURO11: nenhuma opinião específica no período. |
| InvesTalk · endereço do trimestre (`robo/casas.py`) | O InvesTalk publica um comentário por empresa e trimestre em `/noticias/mercado/<código>` (grafias vistas: `ALOS_3T26`, `INBR3T25`, `VAMO-3T26`). | O robô abre direto o endereço do trimestre de cada ação das carteiras: no máximo 4 endereços por rodada, cada um no máximo uma vez por dia, robots.txt respeitado, e para quando acha. A página só vira item se o título citar a empresa. A data é a de "Atualizado em" (o InvesTalk não mostra outra), dita assim na tela. `intel.investalk` no `config.json`. |
| Genial · relatórios por empresa (`genial-relatorios-acoes`) | Sitemap de relatórios filtrado pelos tickers das carteiras (inclui os códigos da Genial: KLBN11, BBDC4, CPLE6, AXIA3/ELET3, INBR32). | A validar: confirma-se na primeira rodada no GitHub. Com `casa` e `ler_item`, cada relatório traz recomendação e preço-alvo do próprio relatório, com a data dele (a página do ativo na Genial às vezes mostra outro número). |
| Busca de opiniões por ativo (Bing Notícias) | Uma busca por ação e FII das carteiras com recomendação, preço-alvo, rebaixa, elevação, início de cobertura. | A cada 6 horas por ativo (`noticias.busca.consulta_opiniao`). O Bing não indexa InvesTalk nem Genial Analisa como notícia; pega a imprensa que repercute as casas. |
| Safra O Especialista (`safra-o-especialista`) | Análises da própria casa, com data. | `casa` = Safra e `ler_item`. Atenção: na primeira leitura a partir do GitHub recebeu 403; a falha não apaga nada. |

**Fontes novas** (43; 25 ligadas, 18 desligadas com o motivo; correções em `bb-investalk-analises`, `genial-analisa` e `btg-research`):

| Grupo | Ligadas | Desligadas (motivo) |
|---|---|---|
| Casas brasileiras | Genial relatórios por empresa (a validar), Nord blog (parcial), Empiricus (parcial). Genial Analisa estratégia volta como parcial. | BTG Pactual (research é app de página única, sem relatórios no sitemap), Ativa (não respondeu), Inter Research (PDFs avulsos sem lista), Órama e Levante (robots.txt veda), Eleven (não respondeu; pago), Guide (não respondeu), Warren (erro de servidor), Toro (só day trade). Ágora continua desligada. |
| Imprensa internacional | NYT Business, Economy, DealBook e Your Money, Bloomberg Opinion, CNBC Economy (todas a validar), Yicai Global (parcial). | Reuters (RSS público encerrado em 2020; manchetes chegam pelo Bing), AP, Axios (robots.txt veda), Yahoo Finance (feed parado), Barron's, Morningstar, Business Insider, Caixin (sem feed; pago). WSJ, MarketWatch, CNBC Markets, FT, Economist e Bloomberg Markets já estavam. |
| Estratégia e research global | Seeking Alpha Market Outlook, ETFs & Portfolio Strategy e Dividend Ideas; Seeking Alpha por ativo (PBR, BBD, INTR, EWZ, sem transcrições e anúncios de dividendo); Project Syndicate; CEPR VoxEU; PIIE Realtime Economics (parcial); Apollo Daily Spark (parcial); Wolf Street; Real Investment Advice; CFA Institute (Enterprising Investor, Financial Analysts Journal, Research Foundation); NBER working papers (parcial, sem data na fonte). | Brookings (feed devolve HTML), Calculated Risk (encerrado em jan/2026). Fidelity, PIMCO, AQR, GMO, BlackRock BII, Vanguard e J.P. Morgan AM já estavam. |

Seeking Alpha: os feeds de análise têm `debate: "colaboradores"` e aparecem em **Debate de mercado**, separados de notícia
e de research de banco. Nos feeds por ativo, as notícias curtas compartilham um único link genérico; só a primeira entra
(as análises têm link próprio e entram normalmente).

**Reddit e X (consulta feita em 08/11/2026):** o robots.txt do Reddit veda robôs (`Disallow: /`), o `.json` sem login
devolve 403, o RSS acaba em 13/11/2026, o cadastro da Data API está fechado e a API pública fecha em março de 2027. A API
do X é paga por post lido (US$ 0,005), sem plano gratuito. Por isso não há coleta: o Debate de mercado traz links para
comunidades do Reddit e buscas do X, abertos no navegador de quem usa, identificados como consultas externas, sem
contagem de sentimento.

**Pesquisa "Relação com a Oregon" (`robo/pesquisas.py`):** para cada ativo com premissa interna de sensibilidade (LFTB11 ×
Selic, IMAB11 × juro real, PETR4 × petróleo…), uma busca curta no RSS do Bing Notícias, refeita a cada 3 dias, até 6 por
rodada; ficam só os resultados que citam o ativo (`data/biblioteca/pesquisas.json`). O próprio feed do Bing traz o aviso
"uso pessoal e não comercial": serve para pesquisa interna, não para material de cliente. A janela de leitura também
oferece a mesma pergunta pronta no Google e no Bing, abertos fora do Oregon.

**Itaú, Safra e Santander** responderam 403 ao robô a partir do GitHub (Itaú Análises, Safra O Especialista, Santander
Análise Econômica). Continuam ligadas: se a casa liberar, voltam sozinhas; enquanto isso a falha aparece em Fontes e
coleta, sem apagar nada.

## Acréscimo de 08/11/2026: academia brasileira de finanças e economia

25 fontes novas, todas públicas e gratuitas (22 ligadas, 3 desligadas com o motivo). Aparecem em **Mundo e Estratégia ›
Research** (Acadêmico e educacional; Bancos centrais e instituições) e na **Biblioteca**, como as do NBER, CEPR e CFA.

| Grupo | Ligadas | Observação |
|---|---|---|
| Revistas acadêmicas | SBFin · Brazilian Review of Finance (ok), FGV EPGE · Revista Brasileira de Economia (ok), FEA-USP · Revista Contabilidade & Finanças (ok), FEA-USP · Estudos Econômicos (ok), FUCAPE · Brazilian Business Review (ok, filtro de finanças e governança), Tesouro · Cadernos de Finanças Públicas (ok), FEA-RP/USP · Economia Aplicada (parcial, filtro), FGV EAESP · RAE (parcial, pelo SciELO, filtro de finanças), Revista de Economia Política (parcial), UFMG · Nova Economia (parcial), IE-UFRJ · Revista de Economia Contemporânea (parcial) | Revistas saem por número: poucos itens por mês. No SciELO a data é a da carga do número; nos feeds da USP, a da última atualização. |
| Working papers e textos para discussão | Banco Central · Working Papers (parcial, pela série no IDEAS/RePEc), FGV EPGE · Ensaios Econômicos, FGV EESP · Textos para Discussão, FEA-USP · Working Papers (todas parciais, pelo IDEAS), IPEA · Textos para Discussão (ok, filtro), BNDES · Textos para Discussão (parcial), PUC-Rio · Textos para Discussão (parcial), RePEc NEP América Latina (parcial, filtro Brasil e América Latina) | IDEAS, PUC-Rio e NEP só informam o ano: o item entra com a data de detecção, marcada. Na primeira leitura, o que já estava na lista vai para o acervo. |
| Centros e órgãos | NEFIN-USP · Insights (ok), CVM · Boletim Econômico (parcial, trimestral), CVM · Estudos (parcial: análises de impacto regulatório e de resultado, estudos da assessoria econômica) | O NEFIN é a referência de fatores de risco brasileiros; as páginas de dados não viram itens. |

Desligadas: Tesouro · Textos para Discussão (série parada em 2022), Insper · Working Papers (último de 2025, sem foco em
finanças), CEMEC-FIPE (o robots.txt barrou a leitura). Não avaliadas nesta rodada: RAC e BAR (ANPAD), Cadernos EBAPE,
Revista do BNDES, EconomiA (ANPEC), Informações FIPE, estudos da B3. As fontes parciais por página (CVM, IDEAS, PUC-Rio)
se confirmam na primeira rodada no GitHub; uma falha aparece em Fontes e coleta e não apaga nada.

## Instituições

| Fonte | Método | Status | Limitação / observação |
|---|---|---|---|
| [Federal Reserve Board - Speeches](https://www.federalreserve.gov/newsevents/speeches.htm) | RSS/Atom | ativa · ok | RSS 2.0 verificado. Ha feeds por membro (s_t_powell.xml, s_t_waller.xml etc.) e testimony.xml listados em https://www.federalreserve.gov/feeds/feeds.htm. |
| [Federal Reserve — FOMC e política monetária](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm) | RSS/Atom | ativa · ok | RSS 2.0 verificado. Cobre statements, minutes e discount-rate minutes. |
| [Federal Reserve - FEDS Notes](https://www.federalreserve.gov/econres/notes/feds-notes/default.htm) | RSS/Atom | ativa · ok | RSS 2.0 verificado. |
| [Federal Reserve - Working Papers (FEDS + IFDP)](https://www.federalreserve.gov/econres/feds/index.htm) | RSS/Atom | ativa · ok | Volume alto e academico; considerar filtro por palavras-chave. url_fonte nao foi aberta nesta rodada (inferida do padrao /econres/feds/). |
| [Liberty Street Economics (NY Fed blog)](https://libertystreeteconomics.newyorkfed.org/) | RSS/Atom | ativa · ok | RSS 2.0 (WordPress) verificado, com autor por item. Fed regional opcional. |
| [IMF Blog](https://www.imf.org/en/blogs) | API pública | ativa · parcial | Nenhum RSS oficial localizado: /en/rss-list, /en/Blogs/rss, /en/News/RSS e /external/rss/feeds.aspx retornaram erro. O index.json (generatedAtUtc 2026-09-17) e a pagina HTML mostravam o mesmo post de 17/09/2026 como mais recent… |
| [IMF World Economic Outlook](https://www.imf.org/en/publications/weo) | página (links/PDF) | ativa · parcial | A listagem /en/publications/weo mostrava julho/2026 como mais recente, mas a edicao de outubro/2026 (13/10) existe e foi aberta diretamente - listagem parece servida de cache. Publicacao semestral + updates; alternativa e checa… |
| [IMF Global Financial Stability Report](https://www.imf.org/en/publications/gfsr) | página (links/PDF) | ativa · parcial | Mesmo problema de cache: listagem mostrava abril/2026 como ultima edicao; a URL de outubro/2026 foi localizada por busca (titulo da pagina ainda 'Coming Soon/Launch'), nao aberta diretamente. |
| [IMF Working Papers](https://www.imf.org/en/publications/wp) | indisponivel | desligada | listagem só via JavaScript; sem feed público localizado |
| [BIS - Central bankers' speeches](https://www.bis.org/cbspeeches/index.htm) | RSS/Atom | ativa · ok | RSS 1.0 (RDF) - parser precisa tratar rdf:RDF/dc:date, nao <rss>. Volume alto (discursos de todos os BCs). |
| [BIS - Management speeches](https://www.bis.org/speeches/index.htm) | RSS/Atom | ativa · ok | RSS 1.0 (RDF). url_fonte inferida, nao aberta. |
| [BIS - Research papers (Working Papers e BIS Bulletins)](https://www.bis.org/publications/index.htm) | RSS/Atom | ativa · ok | RSS 1.0 (RDF). Feed oficial rotulado 'Research papers' em https://www.bis.org/rss/index.htm; inclui Working Papers e Bulletins. Quarterly Review NAO aparecia nos itens recentes. |
| [BIS Quarterly Review](https://www.bis.org/quarterlyreviews/index.htm) | página (links/PDF) | ativa · ok | Sem RSS proprio na pagina (so email alerts). Proxima edicao esperada em dezembro/2026. |
| [BIS - Media releases](https://www.bis.org/press/index.htm) | RSS/Atom | ativa · parcial | Feed oficial existe e responde RSS 1.0 valido, mas veio com lista de itens VAZIA em 08/11/2026. Baixa prioridade; manter so se voltar a popular. |
| [ECB - Press releases, speeches, interviews](https://www.ecb.europa.eu/press/html/index.en.html) | RSS/Atom | ativa · ok | RSS 2.0 verificado. Links no feed vem com barra dupla (ecb.europa.eu//press/...) - normalizar. Lista oficial de feeds: https://www.ecb.europa.eu/home/html/rss.en.html. |
| [The ECB Blog](https://www.ecb.europa.eu/press/blog/html/index.en.html) | RSS/Atom | ativa · ok | RSS 2.0 verificado. |
| [ECB - Publications (todas)](https://www.ecb.europa.eu/press/pubbydate/html/index.en.html) | RSS/Atom | ativa · ok | RSS 2.0 verificado; mistura cartas, working papers e relatorios (muitos itens sao PDF). O feed especifico de Working Papers https://www.ecb.europa.eu/rss/wppub.html tambem responde, mas em 08/11 seu item mais novo era de 31/08/… |
| [OECD Newsroom / Economic Outlook](https://www.oecd.org/en/about/newsroom.html) | página (links/PDF) | desligada | não verificado (a página devolveu só navegação) |
| [Banco Central do Brasil — Notas à Imprensa (feed oficial)](https://www.bcb.gov.br/acessoinformacao/rss) | RSS/Atom | ativa · ok | Feed Atom (título 'RSS - Feeds do BC'); usar <updated> como data. O parâmetro ano= precisa ser atualizado a cada virada de ano. Cobre comunicados do Copom, estatísticas fiscais/monetárias/de crédito, Focus e demais notas. A pág… |
| [Banco Central do Brasil — Notícias (feed oficial)](https://www.bcb.gov.br/) | RSS/Atom | ativa · ok | Feed Atom. Mistura notícias institucionais (estágios, regulação); filtrar por palavras-chave se o hub quiser só macro. Outros feeds do mesmo padrão citados pelo feeder.co mas não testados: /api/feed/app/normativos/normativos?an… |
| [Banco Central do Brasil — Comunicados do Copom (API)](https://www.bcb.gov.br/controleinflacao/copom) | API pública | ativa · ok | Lista não traz URL de página; a URL de evidência é o endpoint de detalhes (verificado para atas; para comunicados o endpoint consta na documentação do dataset mas não foi aberto). Documentação: https://www.bcb.gov.br/conteudo/d… |
| [Banco Central do Brasil — Atas do Copom (API)](https://www.bcb.gov.br/publicacoes/atascopom/cronologicos) | API pública | ativa · ok | Ata da 282ª reunião (04/11/2026) ainda não publicada em 08/11 (sai 6 dias úteis depois). A página HTML /publicacoes/atascopom/cronologicos exige JavaScript — usar a API. |
| [Banco Central do Brasil — Relatório de Política Monetária (RPM)](https://www.bcb.gov.br/publicacoes/rpm) | página (links/PDF) | desligada | coberto pelo feed oficial de Notas à Imprensa do BC (a publicação do RPM sai lá) |
| [Banco Central do Brasil — Focus Relatório de Mercado](https://www.bcb.gov.br/publicacoes/focus) | página (links/PDF) | desligada | o Focus entra em macro.json pela API Olinda (dados estruturados); a publicação também sai no feed de Notas à Imprensa |
| [Banco Central do Brasil — Discursos e apresentações](https://www.bcb.gov.br/conheca/discursos) | indisponivel | desligada | não verificado nesta rodada (página exige JavaScript) |
| [IBGE — Agência de Notícias / Releases (API v3)](https://agenciadenoticias.ibge.gov.br/) | API pública | ativa · ok | A URL base foi fornecida pelo pedido; nem os parâmetros nem a resposta foram confirmados porque o fetch foi bloqueado. Testar diretamente do GitHub Actions com urllib e User-Agent identificado; revisar robots.txt antes de autom… |
| [Tesouro Nacional — Notícias e relatórios](https://www.gov.br/tesouronacional/pt-br/noticias) | indisponivel | desligada | não verificado nesta rodada |
| [IPEA — Carta de Conjuntura](https://www.ipea.gov.br/cartadeconjuntura/) | indisponivel | desligada | não verificado nesta rodada |
| [FGV IBRE — Blog do IBRE / Boletim Macro](https://blogdoibre.fgv.br/) | indisponivel | desligada | não verificado nesta rodada |
| [ANBIMA — Imprensa / Notícias (fundos, índices)](https://www.anbima.com.br/pt_br/imprensa/) | indisponivel | desligada | não verificado nesta rodada |

## Gestoras internacionais

| Fonte | Método | Status | Limitação / observação |
|---|---|---|---|
| [BlackRock Investment Institute (Weekly Commentary, Outlook, Bulletins)](https://www.blackrock.com/corporate/insights/blackrock-investment-institute) | página (links/PDF) | ativa · ok | A URL antiga .../weekly-commentary deu erro; a atual e .../global-weekly-commentary. Pagina do semanal e sobrescrita a cada edicao (mesma URL) - usar o PDF datado como chave. |
| [Vanguard - Economic and market outlook (VEMO) e insights](https://corporate.vanguard.com/content/corporatesite/us/en/corp/vemo/vanguard-economic-market-outlook.html) | página (links/PDF) | ativa · ok | Listagem legivel sem JS, com 10+ itens datados. |
| [Fidelity Institutional - Market commentary (AART: Quarterly Market Update, Business Cycle Update)](https://institutional.fidelity.com/advisors/insights/topics/market-commentary) | página (links/PDF) | ativa · parcial | Listagem sem datas e parcialmente destinada a advisors; tratar itens que exijam login como restritos. Q4 2026 QMU provavelmente ja publicado (o botao de PDF do Q3 referenciava 'Fourth Quarter 2026'), nao confirmado. |
| [PIMCO Insights (Cyclical/Secular Outlook, Economic and Market Commentary)](https://www.pimco.com/us/en/insights) | sitemap XML | ativa · parcial | A pagina /us/en/insights so expoe 2 destaques sem data (resto via JS) e /us/en/insights/economic-and-market-commentary deu erro. O trecho lido do sitemap tinha lastmod mais recente 2026-08-14, anterior ao Cyclical Outlook de 06… |
| [J.P. Morgan AM - Guide to the Markets (U.S.)](https://am.jpmorgan.com/us/en/asset-management/adv/insights/market-insights/guide-to-the-markets/) | documento de URL fixa (HEAD) | ativa · ok | PDF confirmado (capa '4Q 2026', dados de 30/09/2026). Sem RSS. |
| [J.P. Morgan - Eye on the Market (Michael Cembalest)](https://privatebank.jpmorgan.com/nam/en/insights/markets-and-investing/eotm) | página (links/PDF) | ativa · ok | Hospedado no Private Bank, nao na Asset Management. Sem RSS. |
| [AQR - Insights / Research](https://www.aqr.com/Insights/Research) | página (links/PDF) | ativa · ok | Sem RSS. Alguns papers de AQR sao links para SSRN/journals (externos). |
| [GMO - Research Library (Quarterly Letter, Insights)](https://www.gmo.com/americas/research-library/) | página (links/PDF) | ativa · ok | Sem RSS. |
| [Oaktree - Memos from Howard Marks](https://www.oaktreecapital.com/insights/memos) | página (links/PDF) | ativa · ok | Sem RSS. Frequencia baixa (poucos memos por ano). |
| [Bridgewater - Research & Insights](https://www.bridgewater.com/research-and-insights) | restrito | desligada | conteúdo atrás de cadastro (registration wall): não é público; o robô não contorna |
| [Schroders - Insights](https://www.schroders.com/en-gb/uk/individual/insights/) | indisponivel | desligada | página só renderiza com JavaScript ofuscado; sem feed público localizado |
| [Robeco - Insights](https://www.robeco.com/en-int/insights) | restrito | desligada | exige declaração de investidor profissional (gate): não é público |
| [Amundi Investment Institute - Research Center](https://research-center.amundi.com/) | RSS/Atom | ativa · ok | RSS 2.0 verificado - unica gestora grande com feed oficial encontrado. |
| [Goldman Sachs Asset Management - Insights](https://am.gs.com/en-us/advisors/insights) | indisponivel | desligada | listagem só via JavaScript; sem feed público localizado |

## Gestoras brasileiras

| Fonte | Método | Status | Limitação / observação |
|---|---|---|---|
| [Dynamo — Cartas Dynamo](https://www.dynamo.com.br/pt/cartas-dynamo) | RSS/Atom | ativa · ok | Feed RSS 2.0 válido (WordPress). Alternativas verificadas: API WP https://www.dynamo.com.br/wp-json/wp/v2/posts?per_page=4 e página de listagem com PDFs em https://www.dynamo.com.br/wp-content/uploads/AAAA/MM/Carta-Dynamo-NNN.p… |
| [Verde Asset Management — Cartas](https://www.verdeasset.com.br/) | indisponivel | desligada | o site não publica as cartas em página pública (só cópias de terceiros, que não usamos) |
| [SPX Capital — Carta à Equipe (Issuu)](https://issuu.com/spx_capital) | página (links/PDF) | ativa · parcial | O site oficial (spxcapital.com.br) não lista cartas; só tem 'ASSINE NOSSA CARTA MENSAL' (e-mail) e notícias de mídia em https://www.spxcapital.com.br/noticias/. A conta Issuu 'spx_capital' publica mensalmente a Carta à Equipe e… |
| [Kapitalo — Cartas do Gestor (K10 e demais fundos)](https://www.kapitalo.com.br/cartas-do-gestor) | página (links/PDF) | ativa · ok | A página mostra só mês (sem dia). Outras páginas por fundo existem mas não foram abertas individualmente: /carta-do-gestor/kapa-e-zeta, /carta-do-gestor/nexus-global, /carta-do-gestor/nw3, /carta-do-gestor/tarkus. Cartas Temáti… |
| [IP Capital Partners — Relatórios de Gestão](https://ip-capitalpartners.com/relatorios/) | página (links/PDF) | ativa · ok | Baixa frequência (cerca de 1 relatório por ano). www.ipcapitalpartners.com redireciona (302) para ip-capitalpartners.com. /feed/ retornou erro. Seção /insights/ está parada desde 2023. 'Informe Mensal' só por e-mail (não listad… |
| [JGP — Relatórios de Gestão e Cartas](https://www.jgp.com.br/comunicacoes/relatorios/) | RSS/Atom | ativa · ok | Usar /comunicacao/feed/ (feed do post type 'comunicacao', título 'Arquivo Comunicação - JGP'); o /feed/ principal só tem 1 item de 2025. Cada mês gera 3 posts com o mesmo título (Multimercado, Ações, Imobiliário) — a página do … |
| [Squadra Investimentos — Cartas aos Cotistas](https://www.squadrainvest.com.br/cartas/) | página (links/PDF) | ativa · ok | Publicação anual (1º semestre, em agosto). Datas inferidas do caminho de upload. |
| [Legacy Capital — Cartas Mensais](https://www.legacycapital.com.br/cartas-e-calls-mensais/) | API pública | ativa · ok | A busca por 'carta' na API de mídia também pode trazer re-uploads antigos (ex.: 202601_Carta-Mensal-2.pdf em 2026-09-25) — deduplicar pelo prefixo AAAAMM. Também há Cartas de Crédito em https://www.legacycapital.com.br/cartas-e… |
| [Kinea — Carta do Gestor e Kinea Insights](https://www.kinea.com.br/blog/) | API pública | ativa · ok | /blog/feed/ e /kinea-insights/ retornaram erro; /wp-json/wp/v2/categories?slug=... retornou []. A API de posts funciona. Kinea é ligada ao Itaú (não é XP). |
| [Alaska Asset Management — Cartas Mensais](https://www.alaska-asset.com.br/cartas/) | página (links/PDF) | ativa · ok | Página mostra só o mês (sem dia). Também existe Informativo Diário em URL fixa https://www.alaska-asset.com.br/pdf/informativo-diario.pdf (sobrescrito). |
| [Genoa Capital — Carta Mensal](https://www.genoacapital.com.br/relatorios.html) | página (links/PDF) | ativa · ok | Site HTML estático simples, ideal para monitoramento. Data só por mês. |
| [Atmos Capital — Cartas](https://www.atmoscapital.com.br/cartas.php) | página (links/PDF) | ativa · ok | Semestral; a mais recente listada é 1H25 (não há 2H25 ainda na página). Datas = período de referência, não data de publicação. Fundos fechados para captação; cartas seguem públicas. Há também relatório mensal em http://www.atmo… |
| [Itaú Asset Management — Insights Economia (Por Dentro do Cenário, Copom em Foco, Projeções)](https://www.itauassetmanagement.com.br/insights/economia/) | página (links/PDF) | ativa · parcial | A página lista poucos itens (3) e sem data explícita em alguns; parte dos PDFs é sobrescrita em URL fixa. Páginas /insights/estudos/ e /noticias/ não foram verificadas. Sem RSS visível. |
| [Encore Asset Management — Comentário Mensal](https://www.encore.am/) | página (links/PDF) | desligada | não verificado nesta rodada |
| [Constellation Investimentos — Biblioteca / Documentos](https://www.constellation.com.br/) | indisponivel | desligada | cartas só por mailing (não públicas) |
| [Ibiuna Investimentos — Cartas](https://www.ibiunainvest.com.br/) | indisponivel | desligada | o site recusa robôs (robots.txt); não contornamos |
| [Absolute Investimentos — Cartas](https://www.absoluteinvest.com.br/) | indisponivel | desligada | o site recusa robôs (robots.txt); não contornamos |
| [Truxt Investimentos — Cartas](https://www.truxt.com.br/) | indisponivel | desligada | o site recusa robôs (robots.txt); não contornamos |

## Academia

| Fonte | Método | Status | Limitação / observação |
|---|---|---|---|
| [Aswath Damodaran - Musings on Markets](https://aswathdamodaran.blogspot.com/) | RSS/Atom | ativa · ok | Atom verificado (entrada de 03/11/2026); variante RSS: ?alt=rss. No trecho lido do feed o link alternate do item nao apareceu - usar <link rel='alternate'> de cada <entry> e, se ausente, cair para a homepage. Permalinks acima c… |

## Canais oficiais no YouTube

| Fonte | Método | Status | Limitação / observação |
|---|---|---|---|
| [Federal Reserve (YouTube)](https://www.youtube.com/@federalreserve) | YouTube Data API | ativa · parcial · requer YOUTUBE_API_KEY | Channel ID confirmado em duas vias: campo channel_id no link RSS da pagina do handle e round-trip youtube.com/channel/<ID> devolvendo o mesmo titulo/handle. O conteudo do feed videos.xml NAO foi baixado (bloqueio robots no ambi… |
| [IMF (YouTube)](https://www.youtube.com/@IMF) | YouTube Data API | ativa · parcial · requer YOUTUBE_API_KEY | Channel ID confirmado em duas vias: campo channel_id no link RSS da pagina do handle e round-trip youtube.com/channel/<ID> devolvendo o mesmo titulo/handle. O conteudo do feed videos.xml NAO foi baixado (bloqueio robots no ambi… |
| [European Central Bank (YouTube)](https://www.youtube.com/@ecbeuro) | YouTube Data API | ativa · parcial · requer YOUTUBE_API_KEY | Channel ID confirmado em duas vias: campo channel_id no link RSS da pagina do handle e round-trip youtube.com/channel/<ID> devolvendo o mesmo titulo/handle. O conteudo do feed videos.xml NAO foi baixado (bloqueio robots no ambi… |
| [Bank for International Settlements (YouTube)](https://www.youtube.com/@bisbribiz) | YouTube Data API | ativa · parcial · requer YOUTUBE_API_KEY | Channel ID confirmado em duas vias: campo channel_id no link RSS da pagina do handle e round-trip youtube.com/channel/<ID> devolvendo o mesmo titulo/handle. O conteudo do feed videos.xml NAO foi baixado (bloqueio robots no ambi… |
| [Federal Reserve Bank of St. Louis (YouTube)](https://www.youtube.com/@stlouisfed) | YouTube Data API | ativa · parcial · requer YOUTUBE_API_KEY | Channel ID confirmado em duas vias: campo channel_id no link RSS da pagina do handle e round-trip youtube.com/channel/<ID> devolvendo o mesmo titulo/handle. O conteudo do feed videos.xml NAO foi baixado (bloqueio robots no ambi… |
| [BlackRock (YouTube)](https://www.youtube.com/@BlackRock) | YouTube Data API | ativa · parcial · requer YOUTUBE_API_KEY | Channel ID confirmado em duas vias: campo channel_id no link RSS da pagina do handle e round-trip youtube.com/channel/<ID> devolvendo o mesmo titulo/handle. O conteudo do feed videos.xml NAO foi baixado (bloqueio robots no ambi… |
| [Vanguard (YouTube)](https://www.youtube.com/@Vanguard) | YouTube Data API | ativa · parcial · requer YOUTUBE_API_KEY | Channel ID confirmado em duas vias: campo channel_id no link RSS da pagina do handle e round-trip youtube.com/channel/<ID> devolvendo o mesmo titulo/handle. O conteudo do feed videos.xml NAO foi baixado (bloqueio robots no ambi… |
| [PIMCO U.S. (YouTube)](https://www.youtube.com/@PIMCO) | YouTube Data API | ativa · parcial · requer YOUTUBE_API_KEY | Channel ID confirmado em duas vias: campo channel_id no link RSS da pagina do handle e round-trip youtube.com/channel/<ID> devolvendo o mesmo titulo/handle. O conteudo do feed videos.xml NAO foi baixado (bloqueio robots no ambi… |
| [Fidelity Institutional (YouTube)](https://www.youtube.com/@FidelityInstitutional) | YouTube Data API | ativa · parcial · requer YOUTUBE_API_KEY | Channel ID confirmado em duas vias: campo channel_id no link RSS da pagina do handle e round-trip youtube.com/channel/<ID> devolvendo o mesmo titulo/handle. O conteudo do feed videos.xml NAO foi baixado (bloqueio robots no ambi… |
| [J.P. Morgan Asset Management (YouTube)](https://www.youtube.com/@jpmorganassetmanagement) | YouTube Data API | ativa · parcial · requer YOUTUBE_API_KEY | Channel ID confirmado em duas vias: campo channel_id no link RSS da pagina do handle e round-trip youtube.com/channel/<ID> devolvendo o mesmo titulo/handle. O conteudo do feed videos.xml NAO foi baixado (bloqueio robots no ambi… |
| [AQR (YouTube)](https://www.youtube.com/@AQRcapital) | YouTube Data API | ativa · parcial · requer YOUTUBE_API_KEY | Channel ID confirmado em duas vias: campo channel_id no link RSS da pagina do handle e round-trip youtube.com/channel/<ID> devolvendo o mesmo titulo/handle. O conteudo do feed videos.xml NAO foi baixado (bloqueio robots no ambi… |
| [Oaktree (YouTube)](https://www.youtube.com/@OaktreeCapital) | YouTube Data API | ativa · parcial · requer YOUTUBE_API_KEY | Channel ID confirmado em duas vias: campo channel_id no link RSS da pagina do handle e round-trip youtube.com/channel/<ID> devolvendo o mesmo titulo/handle. O conteudo do feed videos.xml NAO foi baixado (bloqueio robots no ambi… |
| [Bridgewater Associates (YouTube)](https://www.youtube.com/@Bridgewater) | YouTube Data API | ativa · parcial · requer YOUTUBE_API_KEY | Channel ID confirmado em duas vias: campo channel_id no link RSS da pagina do handle e round-trip youtube.com/channel/<ID> devolvendo o mesmo titulo/handle. O conteudo do feed videos.xml NAO foi baixado (bloqueio robots no ambi… |
| [Principles by Ray Dalio (YouTube)](https://www.youtube.com/@principlesbyraydalio) | YouTube Data API | ativa · parcial · requer YOUTUBE_API_KEY | Channel ID confirmado em duas vias: campo channel_id no link RSS da pagina do handle e round-trip youtube.com/channel/<ID> devolvendo o mesmo titulo/handle. O conteudo do feed videos.xml NAO foi baixado (bloqueio robots no ambi… |
| [Goldman Sachs (YouTube)](https://www.youtube.com/@GoldmanSachs) | YouTube Data API | ativa · parcial · requer YOUTUBE_API_KEY | Channel ID confirmado em duas vias: campo channel_id no link RSS da pagina do handle e round-trip youtube.com/channel/<ID> devolvendo o mesmo titulo/handle. O conteudo do feed videos.xml NAO foi baixado (bloqueio robots no ambi… |
| [Schroders (YouTube)](https://www.youtube.com/@Schroders) | YouTube Data API | ativa · parcial · requer YOUTUBE_API_KEY | Channel ID confirmado em duas vias: campo channel_id no link RSS da pagina do handle e round-trip youtube.com/channel/<ID> devolvendo o mesmo titulo/handle. O conteudo do feed videos.xml NAO foi baixado (bloqueio robots no ambi… |
| [Aswath Damodaran (YouTube)](https://www.youtube.com/@AswathDamodaranonValuation) | YouTube Data API | ativa · parcial · requer YOUTUBE_API_KEY | Channel ID confirmado em duas vias: campo channel_id no link RSS da pagina do handle e round-trip youtube.com/channel/<ID> devolvendo o mesmo titulo/handle. O conteudo do feed videos.xml NAO foi baixado (bloqueio robots no ambi… |
| [IBGE — canal oficial no YouTube](https://www.youtube.com/channel/UC83oOOF9lg-g1XMT_UK1tUw) | YouTube Data API | desligada | canal_id veio de ranking de terceiros, não confirmado no YouTube |
| [Kinea Investimentos — canal oficial no YouTube](https://www.youtube.com/@KineaInvestimentos) | YouTube Data API | desligada | canal_id não confirmado |
| [Banco Central do Brasil — canal oficial no YouTube]() | YouTube Data API | desligada | canal_id não confirmado |

## Imprensa: RSS próprio de cada veículo (só título, link, data e veículo)

| Fonte | País | Status | Observação |
|---|---|---|---|
| [Brazil Journal](https://braziljournal.com) | Brasil | ativa · ok | só manchetes de economia, mercados ou ativos das carteiras |
| [The News](https://rss.beehiiv.com) | Brasil | ativa · ok | só manchetes de economia, mercados ou ativos das carteiras |
| [Agrofy News](https://news.agrofy.com.br/rss.xml) | Brasil | ativa · ok | só manchetes que citem ativo das carteiras |
| [Google Notícias · Juros](https://news.google.com/) | Brasil | desligada | o robots.txt do Google Notícias veda a busca (/rss/search) a robôs (confirmado na rodada real de 08/11/2026); substituída pelos feeds dos próprios portais |
| [Google Notícias · Juros](https://news.google.com/) | Brasil | desligada | o robots.txt do Google Notícias veda a busca (/rss/search) a robôs (confirmado na rodada real de 08/11/2026); substituída pelos feeds dos próprios portais |
| [Google Notícias · Inflação](https://news.google.com/) | Brasil | desligada | o robots.txt do Google Notícias veda a busca (/rss/search) a robôs (confirmado na rodada real de 08/11/2026); substituída pelos feeds dos próprios portais |
| [Google Notícias · Bolsa](https://news.google.com/) | Brasil | desligada | o robots.txt do Google Notícias veda a busca (/rss/search) a robôs (confirmado na rodada real de 08/11/2026); substituída pelos feeds dos próprios portais |
| [Google Notícias · Câmbio](https://news.google.com/) | Brasil | desligada | o robots.txt do Google Notícias veda a busca (/rss/search) a robôs (confirmado na rodada real de 08/11/2026); substituída pelos feeds dos próprios portais |
| [Google Notícias · EUA](https://news.google.com/) | Brasil | desligada | o robots.txt do Google Notícias veda a busca (/rss/search) a robôs (confirmado na rodada real de 08/11/2026); substituída pelos feeds dos próprios portais |
| [Google Notícias · Fiscal](https://news.google.com/) | Brasil | desligada | o robots.txt do Google Notícias veda a busca (/rss/search) a robôs (confirmado na rodada real de 08/11/2026); substituída pelos feeds dos próprios portais |
| [Google Notícias · Commodities](https://news.google.com/) | Brasil | desligada | o robots.txt do Google Notícias veda a busca (/rss/search) a robôs (confirmado na rodada real de 08/11/2026); substituída pelos feeds dos próprios portais |
| [Money Times](https://www.moneytimes.com.br) | Brasil | ativa · ok | só manchetes de economia, mercados ou ativos das carteiras |
| [InvestNews](https://investnews.com.br) | Brasil | ativa · ok | só manchetes de economia, mercados ou ativos das carteiras |
| [Seu Dinheiro](https://www.seudinheiro.com) | Brasil | ativa · ok | só manchetes de economia, mercados ou ativos das carteiras |
| [Exame](https://exame.com) | Brasil | ativa · ok | só manchetes de economia, mercados ou ativos das carteiras |
| [Bloomberg Línea Brasil](https://www.bloomberglinea.com.br) | Brasil | ativa · ok | só manchetes de economia, mercados ou ativos das carteiras |
| [NeoFeed](https://neofeed.com.br) | Brasil | ativa · ok | só manchetes de economia, mercados ou ativos das carteiras |
| [Suno Notícias](https://www.suno.com.br/noticias) | Brasil | ativa · ok | só manchetes de economia, mercados ou ativos das carteiras |
| [Times Brasil (CNBC)](https://www.timesbrasil.com.br) | Brasil | ativa · ok | só manchetes de economia, mercados ou ativos das carteiras |
| [Agência Brasil · Economia](https://agenciabrasil.ebc.com.br) | Brasil | ativa · parcial | só manchetes de economia, mercados ou ativos das carteiras |
| [Folha de S.Paulo · Mercado](https:/) | Brasil | ativa · a validar na 1ª rodada | só manchetes de economia, mercados ou ativos das carteiras |
| [g1 · Economia](https://g1.globo.com) | Brasil | ativa · a validar na 1ª rodada | só manchetes de economia, mercados ou ativos das carteiras |
| [Estadão · Economia](https://www.estadao.com.br) | Brasil | ativa · a validar na 1ª rodada | só manchetes de economia, mercados ou ativos das carteiras |
| [E-Investidor (Estadão)](https://einvestidor.estadao.com.br) | Brasil | ativa · a validar na 1ª rodada | só manchetes de economia, mercados ou ativos das carteiras |
| [CNN Brasil · Economia](https://www.cnnbrasil.com.br/economia) | Brasil | ativa · a validar na 1ª rodada | só manchetes de economia, mercados ou ativos das carteiras |
| [The Wall Street Journal · Markets](https:/) | EUA | ativa · ok | só manchetes de economia, mercados ou ativos das carteiras |
| [MarketWatch · Top stories](https:/) | EUA | ativa · ok | só manchetes de economia, mercados ou ativos das carteiras |
| [Seeking Alpha · Market Currents](https://seekingalpha.com/market_currents.xml) | EUA | ativa · ok | só manchetes de economia, mercados ou ativos das carteiras |
| [CNBC · Markets](https://www.cnbc.com/id/15839069/device) | EUA | ativa · a validar na 1ª rodada | só manchetes de economia, mercados ou ativos das carteiras |

## Fontes acrescentadas na v3.3 (lista do Notion, validada em 08/11/2026)

37 entradas novas no cadastro: 22 ativas e 15 desligadas com o motivo (`motivo_desligada`). Nenhuma do Grupo XP. As de imprensa internacional marcadas **a validar** não puderam ser abertas pela ferramenta de validação (bloqueio a robôs de leitura ou acesso só pelo navegador); o endereço do feed vem da lista pública de feeds do próprio veículo, e a primeira rodada no GitHub mostra, em **Biblioteca → Fontes e coleta**, se o feed responde. Se o `robots.txt` do veículo vedar o robô, a fonte é pulada e contada como rejeitada — nada é contornado. Itens pagos (Commodity Context, research de bancos) entram só com título, link, data e o subtítulo público.

### Bancos e research globais

| Fonte | Entrou? | Método | Por quê |
|---|---|---|---|
| Goldman Sachs · Insights | ativa (ok) | página | Artigos datados no HTML; robots libera /insights. |
| Morgan Stanley · Insights | ativa (parcial) | página | Só os destaques (sem data) estão no HTML; o resto vem por JavaScript. |
| J.P. Morgan · Global Research | ativa (parcial) | sitemap | Listagem só por JavaScript; o sitemap US/en tem lastmod, mas no trecho lido não apareciam itens recentes. |
| Bank of America Institute | ativa (ok) | página | Lista em HTML (mês/ano); robots libera. |
| Citi Institute / Citi GPS | desligada | — | Lista só por JavaScript; citivelocity não respondeu. |
| UBS CIO · House View Daily | ativa (parcial) | página | Os itens datados são áudios (MP3) diários; os artigos ficam em URL fixa. |
| Barclays | desligada | — | Insights do IB só por JavaScript; o Private Bank só tem podcast. |
| Deutsche Bank Research | ativa (parcial) | página | O RSS oficial veio sem itens; a home lista relatórios datados. |
| HSBC | desligada | — | Sem listagem pública nem feed. |
| Jefferies · Insights | ativa (ok) | RSS | Feed WordPress; posts "Protected:" são descartados. |
| Nomura Connects | ativa (ok) | página | Lista em HTML (mês/ano). |
| Société Générale | desligada | — | A página não expõe as edições; sem feed. |
| BNP Paribas · Eco Week | ativa (ok) | RSS | Feed oficial; marcadores "Article coming soon" descartados. |
| RBC Economics | ativa (ok) | página | US Analysis com textos datados; thoughtleadership.rbc.com está parado. |
| Wells Fargo Economics | ativa (parcial) | página | 3 links sem data (cada edição nova vira um item). |

### Imprensa internacional (só título, link e data)

| Fonte | Entrou? | Método | Por quê |
|---|---|---|---|
| Bloomberg · Markets | ativa (a validar) | RSS | Feed oficial; a ferramenta foi recusada pelo robots da Bloomberg — o robô confere na 1ª rodada. |
| Financial Times · Markets | ativa (a validar) | RSS | Feed oficial (?format=rss); a ferramenta não acessa o FT. |
| Financial Times · Global Economy | ativa (a validar) | RSS | Mesmo caso. |
| The Economist · Finance and economics | ativa (a validar) | RSS | Feed oficial; a ferramenta não acessa o site. |
| The Guardian · Business | ativa (a validar) | RSS | Feed oficial; a ferramenta não acessa o site. |
| El País · Economía | ativa (a validar) | RSS | Feed oficial; em espanhol, o filtro de tema casa só parte das manchetes. |
| CNN · World | desligada | RSS | O RSS oficial está parado desde 2023. |

### Analista independente

| Fonte | Entrou? | Método | Por quê |
|---|---|---|---|
| Commodity Context (Rory Johnston) | ativa (ok) | RSS | Feed do Substack; a maior parte é paga, então entram só título, link, data e subtítulo. |

### Bancos e corretoras brasileiras

| Fonte | Entrou? | Método | Por quê |
|---|---|---|---|
| BTG Pactual Research | desligada | — | Lista só por JavaScript; relatório completo pede conta. |
| Itaú · Análises | ativa (ok) | sitemap | Sitemap próprio com lastmod (06/11). Cockpit do Copom sim; Consenso, Carta do Gestor e Radar não aparecem nessa seção. |
| Genial Analisa | desligada (a validar) | sitemap | Sem RSS; o sitemap da seção deu erro de servidor. |
| BB Investimentos (Investalk) | ativa (parcial) | página | O padrão do link foi inferido de um único card. |
| Safra · O Especialista | ativa (ok) | RSS | Feed WordPress. |
| Santander · Análise Econômica | ativa (parcial) | página | PDFs com data no nome do arquivo; boletins semanais ficam em URL fixa. |
| Ágora Investimentos | desligada | — | Sem página pública de research; só cópias de terceiros. |
| Suno Research | desligada | — | Pago; as manchetes já entram por Suno Notícias. |

### Imprensa brasileira

| Fonte | Entrou? | Método | Por quê |
|---|---|---|---|
| Correio Braziliense | desligada | RSS | O feed /feed estava parado desde fev/2024; não há feed de Economia. |
| MKT News | desligada | — | Não identificada com segurança: o site só abre com JavaScript e sem feed. |
| CNN Brasil · Internacional/Geral | não cadastrada | — | Economia já está no cadastro; o resto quase não passaria no filtro de tema. |

### Ferramentas e dados

| Fonte | Entrou? | Método | Por quê |
|---|---|---|---|
| Finviz | desligada | — | Ferramenta de dados; as notícias são de outros veículos. |
| Trading Economics | desligada | — | Sem RSS; notícias só pela API paga; licença pessoal. |
| Mapa de calor de ações | desligada | — | Ferramenta visual; site não especificado. |
| Fundos com posição em SOJA3 | desligada | — | Página não especificada; consulta de dados, sem feed. |

## Buscas por ativo, setor e tema (geradas de `robo/config.json`, não ficam em `fontes.json`)

O Google Notícias veda a busca a robôs no `robots.txt` (`/rss/search`), e o robô respeita: as 8 buscas da v3 ficam desligadas. As buscas usam o RSS público do **Bing Notícias** (`/news/search?…&format=rss`), que o `robots.txt` do Bing permite. Testado em 08/11/2026 com Klabin, BB Seguridade, Copel e "China stocks MSCI": 10 a 11 manchetes recentes por busca, com veículo e data (amostra em `testes/amostras_reais/`). Cada busca roda a cada 2 horas, no máximo 14 por rodada (as demais na rodada seguinte); a execução manual roda todas. Se um dia o Bing vedar a busca, o robô para sozinho e registra "robots" em Fontes e coleta.

| Busca | Consulta | Mercado | Liga a |
|---|---|---|---|
| Busca · Petrobras (PETR4) | `Petrobras` | pt-BR | PETR4 |
| Busca · Klabin (KLBN4) | `Klabin` | pt-BR | KLBN4 |
| Busca · BB Seguridade (BBSE3) | `BB Seguridade` | pt-BR | BBSE3 |
| Busca · Bradesco (BBDC3) | `Bradesco` | pt-BR | BBDC3 |
| Busca · Itaúsa (ITSA4) | `Itaúsa` | pt-BR | ITSA4 |
| Busca · Copel (CPLE3) | `Copel` | pt-BR | CPLE3 |
| Busca · Axia Energia (AXIA3) | `Axia Energia` | pt-BR | AXIA3 |
| Busca · Eletrobras (AXIA3) | `Eletrobras` | pt-BR | AXIA3 |
| Busca · Equatorial Energia (EQTL3) | `Equatorial Energia` | pt-BR | EQTL3 |
| Busca · PRIO3 (PRIO3) | `PRIO3` | pt-BR | PRIO3 |
| Busca · Prio petróleo (PRIO3) | `Prio petróleo` | pt-BR | PRIO3 |
| Busca · Allos shopping (ALOS3) | `Allos shopping` | pt-BR | ALOS3 |
| Busca · Banco Inter (INBR34) | `Banco Inter` | pt-BR | INBR34 |
| Busca · 3tentos (TTEN3) | `3tentos` | pt-BR | TTEN3 |
| Busca · VAMO3 (VAMO3) | `VAMO3` | pt-BR | VAMO3 |
| Busca · BTLG11 (BTLG11) | `BTLG11` | pt-BR | BTLG11 |
| Busca · XPML11 (XPML11) | `XPML11` | pt-BR | XPML11 |
| Busca · TRXF11 (TRXF11) | `TRXF11` | pt-BR | TRXF11 |
| Busca · KNHF11 (KNHF11) | `KNHF11` | pt-BR | KNHF11 |
| Busca · HGCR11 (HGCR11) | `HGCR11` | pt-BR | HGCR11 |
| Busca · KNCA11 (KNCA11) | `KNCA11` | pt-BR | KNCA11 |
| Busca · CDII11 (CDII11) | `CDII11` | pt-BR | CDII11 |
| Busca · JURO11 (JURO11) | `JURO11` | pt-BR | JURO11 |
| Busca setorial · Celulose e papel | `celulose preço China` | pt-BR | KLBN4 |
| Busca setorial · Pulp and paper (global) | `pulp prices China` | en-US | KLBN4 |
| Busca setorial · Bancos e crédito | `bancos crédito inadimplência` | pt-BR | BBDC3, ITSA4, INBR34 |
| Busca setorial · Seguros e previdência | `seguradoras Susep` | pt-BR | BBSE3 |
| Busca setorial · Setor elétrico | `setor elétrico Aneel` | pt-BR | CPLE3, AXIA3, EQTL3 |
| Busca setorial · Petróleo | `petróleo Brent` | pt-BR | PETR4, PRIO3 |
| Busca setorial · Shoppings e varejo | `shoppings vendas varejo` | pt-BR | ALOS3, XPML11 |
| Busca setorial · Agronegócio e biodiesel | `agronegócio soja biodiesel` | pt-BR | TTEN3, KNCA11 |
| Busca setorial · Fundos imobiliários | `fundos imobiliários IFIX` | pt-BR | BTLG11, XPML11, TRXF11, KNHF11, HGCR11, KNCA11, CDII11, JURO11 |
| Busca do tema · Juro real (IMA-B e NTN-B) | `NTN-B juro real` | pt-BR | IMAB11, B5P211, IB5M11 |
| Busca do tema · Prefixados (IRF-M) | `DI futuro juros` | pt-BR | IRFM11, 5PRE11, IDKA11 |
| Busca do tema · Tesouro Selic | `Tesouro Selic` | pt-BR | LFTB11 |
| Busca do tema · Crédito privado no Brasil | `debêntures crédito privado` | pt-BR | DEBB11, GICP11, LFIN11 |
| Busca do tema · Treasuries | `Treasury yields` | en-US | IB01, DTLA, IUAA |
| Busca do tema · Inflação americana (TIPS) | `TIPS inflation-protected Treasury` | en-US | IDTP |
| Busca do tema · High yield nos EUA | `high yield bonds` | en-US | IHYA, SDHA |
| Busca do tema · Dívida emergente | `emerging market debt` | en-US | JPEA, EMCA |
| Busca do tema · Ações globais e desenvolvidos | `global stocks MSCI World` | en-US | VWRA, VHVE, EXUS |
| Busca do tema · Small caps e valor | `small caps Russell 2000` | en-US | USSC, WSML, IUVL |
| Busca do tema · Ações emergentes | `emerging markets stocks` | en-US | EIMI, VFEA |
| Busca do tema · Bitcoin | `bitcoin ETF` | en-US | IBIT |

**Desambiguação**: a manchete só entra se citar a empresa pelos termos dela e não tiver termo de exclusão (ex.: "Chácara Klabin", "Ema Klabin", "Guiné Equatorial"). Nas buscas de setor e de tema, a manchete precisa ter um dos termos do setor. **Veículos**: o veículo que publicou vira a fonte; os que não estão em `noticias.veiculos_confiaveis` entram marcados "veículo pouco conhecido", aparecem na ficha do ativo e ficam fora da lista do Hoje. InfoMoney e canais da XP entram com o selo "Grupo XP — não citar em material de cliente" (`noticias.fontes_sinalizadas`); para voltar a bloquear, copie os nomes para `noticias.fontes_bloqueadas`.

## Estante (v3.5): acervos completos, conferidos em 08/11/2026

| Coleção | De onde vem | Observações |
|---|---|---|
| Michael Mauboussin | Semente: índice público "Michael Mauboussin Index" (Kevin Gee, Google Sheets; 177 de research + 52 outros escritos) e a série Consilient Observer no Morgan Stanley (45 itens, mar/2020 a set/2026). Listagem: página da série no Morgan Stanley. | Os artigos de 1995 a 2019 (CS First Boston, Legg Mason, Credit Suisse, BlueMountain) não têm mais endereço da editora: o link abre o índice no site do autor (michaelmauboussin.com). O robô não lê esse site (ele declara `ai-train=no` e veta robôs de IA). A data da página do artigo prevalece (a listagem do Morgan Stanley costuma mostrar um dia antes). |
| CFA Institute Research Foundation | Sitemap do Research and Policy Center (`/sitemap.xml?page=1..7`), endereços `/research/foundation/AAAA/...` | A página de publicações é montada por JavaScript (sem itens no HTML). Errata, "-full-pdf" e edições resumidas ficam de fora. Título, data, resumo e PDFs (livro e briefs) vêm da página de cada publicação, alguns por rodada. |
| Howard Marks · memos | Semente: os 166 memos da página da Oaktree (out/1990 a set/2026). Listagem: a mesma página. | 36 memos têm página própria; os outros abrem a lista da Oaktree e trazem o link da coleção completa em PDF publicada pela Oaktree. |
| Aswath Damodaran | Semente: 58 papers da página de papers (NYU Stern: PDF no site do autor ou SSRN). Feed do blog Musings on Markets (Blogger, `/feeds/posts/summary`, lotes de 150; 686 posts desde 2008). | Os rótulos da página de papers ("2011 Edition") ganharam o nome da série. Ano só quando está no título. |
| AQR | Sitemap (`/insights/research/<tipo>/...`): artigos acadêmicos, white papers, working papers, Alternative Thinking, livros | A biblioteca mostra só 11 itens no HTML; o resto vem por JavaScript. O sitemap não tem datas: a data vem da página do item. |
| GMO | Sitemap (`/research-library/<slug>_<tipo>/`): cartas trimestrais, white papers, Insights, Viewpoints, previsão de 7 anos | Eventos, vídeos e "in the news" ficam de fora. |
| Compounding Quality | Sitemap do Substack (cerca de 550 posts desde 2023) e feed RSS | Parte dos posts é para assinantes pagos: só título, data e resumo público. Os posts novos também entram no Research (fonte `compounding-quality`, Debate › colaboradores). |

robots.txt conferido para todos os caminhos usados (Morgan Stanley libera a pasta de PDFs com um `Allow` explícito). A
primeira carga é lenta de propósito: até 8 listagens e 30 páginas de item por rodada, somando as coleções.

## Contas no X

O X só mostra os posts para quem está logado e a leitura automática é pela API paga. Conta do X que o Lucas mandar entra
como "acesso restrito" (só link) e o robô procura os canais abertos do mesmo autor (site, blog, Substack, YouTube).
Usar a API do X depende de autorização dele.

## Documentos das empresas (CVM)

Fatos relevantes, comunicados ao mercado e avisos aos acionistas das empresas das carteiras, lidos da base aberta da CVM (`dados.cvm.gov.br`, IPE) a cada 3 horas, conferidos por CNPJ **e** nome da companhia. A CVM informa só a data de entrega (sem hora). FIIs e ativos sem CNPJ cadastrado ficam de fora.

## Limitações conhecidas

- **YouTube**: o `robots.txt` do YouTube veda o feed `videos.xml` a robôs genéricos; por isso o robô só lê vídeos pela API oficial (chave gratuita em `YOUTUBE_API_KEY`). Sem a chave, os canais ficam "aguardando chave" e não contam como falha.
- **Páginas que listam PDFs** (Kapitalo, Alaska, Genoa, Atmos, Squadra, IP Capital, BlackRock, Oaktree, AQR, GMO, Vanguard, Eye on the Market, FMI, BIS Quarterly Review): o robô detecta links novos; a data vem do link quando existe (`padrao_data`) e, se não, o item recebe a data de detecção, marcada. Mudança de layout do site aparece como erro de formato na coleta, nunca como item inventado.
- **Documentos de URL fixa** (Guide to the Markets): só os cabeçalhos são lidos (HEAD); uma mudança de ETag/Last-Modified vira o item "edição de <data>". O arquivo não é baixado.
- **Sitemap** (PIMCO): título provisório humanizado a partir da URL até o leitor abrir o original; o sitemap pode estar defasado em relação ao site.
- **FMI**: sem RSS; o `index.json` do blog e as listagens de WEO/GFSR pareciam servidos de cache na validação (podem atrasar dias). Working papers só via JavaScript: desligado.
- **Cache e JavaScript**: sites que só montam a lista com JavaScript (Schroders, GSAM, Verde, Constellation) ou que exigem cadastro/declaração de investidor (Bridgewater, Robeco) ficam desligados, com o motivo no cadastro. Não contornamos.
- **Google Notícias**: o `robots.txt` veda a busca (`/rss/search`) a robôs; o robô não lê. Na ficha de cada ativo há o link "Buscar agora no Google Notícias", que abre a busca no seu navegador.
- **Bing Notícias**: RSS público de busca, sem chave e sem custo; não é uma API contratada, pode mudar sem aviso (vira erro visível em Fontes e coleta, nunca item inventado). A ordem é por data, mas o Bing devolve no máximo cerca de 10 manchetes por busca; guardamos só título, link, veículo e data. Portais com assinatura (Valor, Estadão, O Globo) aparecem pela manchete; a matéria abre no site do veículo.
- **Opiniões de casas**: o sentido (a favor, contra, neutra, mista) vem do título público ou, nas páginas da própria casa e nas opiniões conferidas de 12 meses, da página. Recomendação, preço-alvo, horizonte e analista só aparecem quando estão escritos; nada é deduzido. Documento à CVM ou carta que cita uma agência ou casa ("Fitch eleva o rating") não vira opinião dela. Texto que relata outra casa (comum em Nord e Empiricus) é atribuído à casa citada.
- **Reddit e X**: sem coleta (ver a seção v3.4). Só links de consulta, abertos fora do Oregon. Comunidades do Reddit na lista (v3.8): investing, stocks, ValueInvesting, SecurityAnalysis, Bogleheads, Economics, dividends, investimentos, finance, wallstreetbets, EconomyCharts, AskEconomics e oil (mais votados da semana).
- **Inglês do mercado (v3.9)**: não há fonte nova. A página Biblioteca › Inglês usa as manchetes em inglês que o robô
  já coleta: título, link, data e o resumo público quando a fonte publica, nunca o texto completo.
  - **Glossário:** `robo/glossario_en.json`, com 187 termos escritos à mão. Os exemplos são genéricos, sem fato atribuído a
    empresa ou casa.
  - **Podcasts:** só links oficiais, conferidos em 08/11/2026: Thoughts on the Market (Morgan Stanley, com transcrição),
    Markets in Motion (RBC), The Indicator (NPR) e Marketplace Morning Report.
  - **Ficaram de fora porque não deu para conferir a página:** BBC 6 Minute English (bloqueada à leitura automática),
    Goldman Sachs Exchanges (a página não lista episódios), BlackRock The Bid (não abriu) e J.P. Morgan Research Recap
    (o endereço leva a outro programa).
  - **Voz, fala e tradução:** são do navegador de quem usa, sem chave e sem custo. No Chrome, o reconhecimento de fala
    usa o serviço de voz do Google. A tradução no aparelho é a do próprio Chrome; nos outros casos abre o Google Tradutor
    no navegador.
  - **Telegram:** a frase do dia no briefing leva o link de tradução, não um texto traduzido pelo robô.
- **Research das casas (v3.8.2)**: só links de consulta externa para a página de estudos e publicações de cada casa, sem
  coleta. Ficam em Mundo e Estratégia › Research global (seção no fim da página) e no Debate de mercado. São 8 casas do
  Brasil (BTG Pactual, Itaú, Genial, BB Investimentos, Safra, Santander, Suno e Ágora) e 15 globais (Goldman Sachs,
  J.P. Morgan, Morgan Stanley, BofA, Citi, UBS, Barclays, Deutsche Bank, HSBC, Jefferies, Nomura, Société Générale,
  BNP Paribas, RBC Capital Markets e Wells Fargo).
  - **Conferência em 08/11/2026:** os endereços foram abertos, com três exceções.
  - **Não abertos:** os links "Insights" do HSBC e "Estratégia e economia" da RBC saíram das próprias páginas dessas
    casas e não foram abertos. A Société Générale barra leitura automática (Incapsula); o link é a página de
    apresentação do research, achada em busca, porque a SG não tem lista pública de publicações.
  - **Itaú:** Consenso de Mercado, Cockpit do Copom, Carta do Gestor e Radar de Preferências não têm página própria;
    saem em Análises.
  - **Login:** "login" marca as casas cujos relatórios completos pedem conta de cliente.
  - **Grupo XP:** nenhum veículo do grupo entra, por regra do Lucas.
- **Datas**: o painel distingue data de publicação (da fonte), data de atualização (da fonte) e data de detecção (do robô). Quando a fonte só mostra a atualização (InvesTalk), a tela diz isso. Página sem data entra com a data de detecção, marcada; cartas antigas de páginas de arquivo vão para o acervo (Biblioteca), fora das novidades.
- **Dados macro**: os indicadores (Selic, IPCA, dólar, curvas, Treasuries) foram desligados (`intel.indicadores_macro: false`) e saíram do painel. Fica só a agenda oficial (IBGE, Copom, Fed, Focus). Para religar, troque para `true`.
- **Resultados da CVM** (`resultados.json`): lidos dos dados abertos da CVM (ITR/DFP) na rodada da noite, a cada 3 dias (ou em execução manual), para as fichas das empresas na seção Oregon. FIIs e empresas sem CNPJ cadastrado ficam em `fora`. Um arquivo que falha não apaga o que já estava lido.
