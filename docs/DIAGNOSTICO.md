# Diagnóstico: auditoria de 08/11/2026 conferida contra o código

A auditoria independente da v3 ("Oregon Intelligence v3 — auditoria independente do ZIP publicado") foi conferida
item por item contra o código publicado (`robo-oregon-main`, igual ao repositório) e contra a última rodada real do robô
(ramo `dados`, 08/11/2026 08:58). Resultado: **todos os 12 fatos procedem**; o item 2 procede por desenho (os dados
ficam no ramo `dados`, não no código). A tabela diz o que foi feito na v3.2.

| # | Ponto da auditoria | Conferência | O que a v3.2 faz |
|---|---|---|---|
| 1 | Testes locais não validam fontes reais | **Procede.** Os testes usam internet simulada (`testes/simulador.py`). | Mantidos, e somados a: amostra REAL do Bing Notícias de 08/11 (`testes/amostras_reais/`) passando por leitura, desambiguação e classificação; rodada do robô novo sobre a biblioteca real publicada. A prova final é a primeira rodada no Actions (Fontes e coleta, por fonte). |
| 2 | ZIP sem `data/` | **Procede, por desenho.** Os dados ficam no ramo `dados` e no site. Conferido: rodada real 08/11 08:58 com 43 fontes ok, 320 itens recentes, 35 de imprensa. | Sem mudança. O topo do Hoje passa a mostrar a última coleta, as notícias de 24 h e as fontes com erro. |
| 3 | Não é tempo real (4 rodadas/dia; painel a cada 10 min) | **Procede** na v3 publicada. | Rodadas a cada 30 min das 7h às 22h30 (+01h15 e 04h15); painel consulta a cada 2 min e se atualiza sozinho. Continua não sendo tempo real, e a tela diz a hora da coleta. |
| 4 | Google Notícias insuficiente (8 buscas macro) | **Procede, e pior:** as 8 buscas falham em toda rodada porque o `robots.txt` do Google veda `/rss/search` a robôs (erro registrado na rodada real). | Busca **por ativo** no RSS público do Bing Notícias, que o `robots.txt` permite (testado hoje: Klabin, BB Seguridade, Copel, China). Link "Buscar agora no Google Notícias" na ficha (abre no seu navegador). As 8 buscas do Google ficam desligadas com o motivo. |
| 5 | Buscas por empresa existem, mas a v3 não executa | **Procede.** `ativos[].noticias` (busca, termos, exclusões) e `robo/noticias.py` (CVM, desambiguação) ficaram fora do `intel.py`. | Reaproveitados: termos e exclusões viram filtro de cada busca; a leitura de fatos relevantes da CVM (por CNPJ e nome) entrou na rotina. 23 buscas por empresa/FII, 9 por setor e cadeia, 12 por tema de ETF. |
| 6 | InfoMoney e XP bloqueados | **Procede** (`noticias.fontes_bloqueadas`). | Entram, com o selo "Grupo XP — não citar em material de cliente" (sua regra de materiais continua). Opiniões de XP, BTG, BBA, Safra etc. publicadas por outros portais já entravam e agora têm sentido (a favor/contra). Uma linha volta o bloqueio. |
| 7 | Home com macro e agenda mesmo sem dados | **Procede.** | Macro removido do painel e do robô (`intel.indicadores_macro: false`). Hoje abre com as últimas notícias (hora · veículo · título · ↗), filtros Na carteira / Brasil / Mundo / Opiniões / Oficiais. Agenda só com eventos oficiais, sem repetir o Focus semanal. |
| 8 | Ficha da empresa depende só da biblioteca | **Procede** (`A.itensDe` e "Conteúdo que cita a empresa"). | Painel de notícias ao lado da ficha: notícias da empresa (portais + busca + CVM), opiniões a favor e contra, documentos da CVM, setor e cadeia, links de busca imediata. |
| 9 | Sem "Mundo e Estratégia" | **Procede** (`A.AREAS` com três seções). | Cinco seções. Mundo e Estratégia: o que o mundo fala (por região e por tema de ETF), cartas e research (gestoras, bancos centrais, acadêmico), ETFs globais com notícias do tema. |
| 10 | Sete pontos viram roteiro de perguntas | **Procede** (ponto 4 = perguntas genéricas do tema, `robo/analise.py`). | Ponto 4 só com **contraponto documentado** (outra fonte concreta, com link); sem isso: "Não há contraponto documentado nas fontes lidas". As perguntas genéricas ficam num "roteiro do tema" recolhido e rotulado como tal. |
| 11 | Fontes cadastradas ≠ coleta efetiva | **Procede.** | Contadores por fonte e por busca em Fontes e coleta; topo do Hoje com fontes com erro. Canais do YouTube sem chave aparecem como "aguardando chave", não como fonte ativa. |
| 12 | Carteiras no site público | **Procede.** Você autorizou ("pode deixar tudo no site público"). | Mantido. |

## Causas prioritárias da auditoria

- **P0 Alimentação:** conferido no ramo `dados` (rodada real 08/11 08:58). A rodada só publica se os testes passam; se a
  coleta falha, o site fica com os últimos dados válidos e a falha aparece em Actions e no topo do Hoje.
- **P1 Cobertura:** buscas por empresa, cadeia e tema, em pt-BR e inglês, deduplicadas (o mesmo fato de vários veículos
  vira um item com "+N fontes") e limitadas (14 por rodada, cada uma a cada 2 h). Chinês não foi incluído: o Bing em
  chinês não foi testado e não há leitura de mandarim no painel.
- **P2 Interface:** feed por data com título, veículo, hora de publicação, ativo/setor e link; topo com última coleta,
  notícias de 24 h e fontes com erro; fichas com notícias, pares do setor, opiniões, fatos relevantes e links de busca.
- **P3 Mundo:** seção própria; notícia de mercado nunca vira recomendação de ativo (o tema do ETF é rotulado "notícia do
  índice ou do tema, não do fundo").
- **P4 Argumentos conflitantes:** a favor/contra só com fontes concretas; sem elas, a frase de ausência.

## Arquitetura

Mantida: Python + GitHub Actions + GitHub Pages, sem custo (repositório público). Um serviço de backend sob demanda
(Cloudflare Workers) ou um leitor RSS pronto (Inoreader) não são necessários para o que foi pedido agora; a ficha já
oferece a busca imediata no Google Notícias pelo navegador. Se, depois da prova de 7 dias, 30 minutos for pouco, o próximo
passo é avaliar um backend com cache, com custo e limites explicados antes.

## Prova de 7 dias recomendada

Klabin, Copel, Bradesco, Petrobras e BB Seguridade, mais celulose/China, bancos e crédito, juros. Todos já têm busca
própria. Conferir em Brasil → ficha de cada uma e em Biblioteca → Fontes e coleta (buscas `busca-klbn4`, `busca-cple3`,
`busca-bbdc3`, `busca-petr4`, `busca-bbse3`, `busca-setor-*`).

## Histórico: as 72 manchetes da v2

A v2 coletava manchetes que não apareciam na tela por um filtro de exibição. Isso foi corrigido na v3 (nada some em
silêncio: o que é coletado fica na Biblioteca, e o que é descartado na coleta é contado por motivo em Fontes e coleta).
