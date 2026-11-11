# Arquitetura do Oregon Intelligence

## Robô (`robo/`, Python 3 sem dependências externas, GitHub Actions)

`intel.py` é o orquestrador. Cada rodada (4× por dia, 7 dias por semana, e à mão):

1. **Configuração e cadastro** — `config.py` valida `config.json` (bloco `intel`: janelas, IA, Telegram) e `intel.validar_fontes`
   valida `fontes.json` (método conhecido, URL http(s), API conhecida, canal do YouTube). Erro = rodada falha visivelmente,
   nada é publicado.
2. **Oregon** — `carregar_oregon` monta a lista de ativos a partir de `painel/src/data.json` (ativos das 15 carteiras, sem
   placeholders) + termos de busca de `config.json`; setores vêm dos grupos do painel. Nenhuma posição é presumida.
3. **Macro** (`coletar_macro`) — SGS (Selic, CDI, IPCA, PTAX), Focus, Tesouro (pré/IPCA+), Treasuries, agenda (IBGE,
   Copom, Fed, Focus) → `macro.json`. Falha mantém o último valor, marcado `reaproveitado`; nunca zero.
4. **Conteúdo** (`coletar_conteudo`) — para cada fonte ativa: `conteudo.coletar_fonte` (rss/atom/rdf, youtube via API,
   pagina, sitemap, arquivo_fixo, api), com `Robots` por host; rejeições contadas por motivo; `analise.classificar`
   (temas, regiões, ativos, setores, fatores, natureza, prioridade) e `analise.vinculos` (direto ou menção, por ativo) e `analise.analisar_regras` (leitura curta v2: base da leitura, números literais e perguntas do tema);
   `biblioteca.incorporar` deduplica por id (link normalizado) e por título (Jaccard ≥ 0,6, janela de 3 dias, nunca
   entre itens da mesma fonte) e grava por mês. Contadores em `coleta.json`.
   Desde a v3.4: fontes com `ler_item` têm a página de cada item novo lida (`conteudo.ler_pagina_item`: datas de
   publicação e atualização, autor e, nas casas com `casa`, recomendação, preço-alvo e horizonte quando escritos; o texto
   não é guardado); páginas sem data viram acervo pelas regras de `antigo_sem_data` (mês de referência antigo, lote sem
   data numa página já lida, link no fim da lista); `casas.sondar` procura o comentário de resultado do InvesTalk no
   endereço do trimestre (até 4 por rodada, uma vez por dia cada); `pesquisas.atualizar` refaz a pesquisa ativo × fator
   (Bing Notícias, até 6 por rodada, a cada 3 dias). Uma vez por versão: `migrar_acervo_v34` (cartas antigas sem data
   já guardadas) e `importar_sementes` (opiniões conferidas de 12 meses em `robo/sementes/`, por marca do arquivo).
   v3.5: itens com data futura na fonte (edição de revista) entram com a data de detecção e guardam `data_edicao`;
   fontes com `descartar_promocional`/`exigir_assunto` (Empiricus) só deixam passar empresa, setor ou estratégia;
   `casas.genial_paginas` lê a página de cada ação na Genial e abre os relatórios novos; `pesquisas` procura os ETFs pelo
   índice que acompanham e descarta páginas de cotação.
5. **IA opcional** (`ler_com_ia`) — só com `ANTHROPIC_API_KEY` e `intel.ia.ativo = true`; itens de prioridade alta/média
   sem análise profunda, até `max_itens_dia` e `max_tokens_dia`; a resposta é validada (rótulos FATO/FONTE/INFERÊNCIA) e
   combinada com as regras (`analise.combinar`); uso registrado em `estado.json` (`ia_uso`, `ia_historico`).
6. **Índice e recentes** — `biblioteca.reindexar` (`indice.json`), `publicar_recentes` (`recentes.json`, 10 dias),
   `publicar_opinioes` (`biblioteca/opinioes.json`, 12 meses) e `publicar_research` (`biblioteca/research.json`, 90 dias).
   Itens gravados por versões anteriores são reclassificados na publicação (`REGRAS_VERSAO`), sem reescrever o mês; os
   veículos de `fontes_bloqueadas` não são publicados nem do histórico.
7. **Briefing** — `semanal.briefing` → `hoje.json` (prioridades com variedade, macro, gestoras, vídeos, leitura
   recomendada rotativa, perguntas de estudo, agenda).
8. **Semanal** — sábado (ou modo `semanal`) → `semanal.json` (temas, teses, repetidos, assuntos para estudar;
   "mudanças de visão" só com IA).
9. **Resultados CVM** — na rodada da noite, a cada 3 dias, `resultados.coletar` (ITR/DFP) → `resultados.json`; desde a
   v3.5 com `entregue_em` (data de entrega da primeira versão, do arquivo índice do zip), usada como referência na Agenda.
10. **Alerta imediato** (v3.5, opcional) — `alertas_imediatos`: fato relevante de empresa das carteiras ou opinião de casa
   com vínculo direto, publicados nas últimas 48 h, até 5 por rodada, nunca repetidos (`estado.alertados`).
11. **Estante** (v3.5) — `estante.atualizar`: por coleção, semente conferida (`robo/sementes/estante/<id>.json`) +
   listagem pública (página, sitemap paginado ou feed em lotes), lida aos poucos (`max_paginas_por_rodada`, `ler_item_total`)
   e depois só a cada `intervalo_horas`. A página de cada item (`ler_item`) dá título real, data declarada, resumo e PDFs
   de resumo (briefs). A mesma peça em duas origens vira um item (título normalizado e data até 3 dias). Nada é apagado;
   falha marca a coleção. Saída: `biblioteca/estante.json`, carregado pelo painel só ao abrir Biblioteca › Estante.
12. **VG VIP** (v3.5) — `carregar_oregon` lê também `painel/src/vip.json`. Ativo que só está na VIP entra com `so_vip`;
   `analise.separar_vip` move o vínculo para `ativos_vip` / `vinculos_vip` / `ativos_porque_vip`. A seção Oregon lê só
   `ativos` e `vinculos` (prioridade, radar, pauta, temporada), então nada da VIP aparece lá. CNPJ dos ativos VIP em
   `robo/config.json` (documentos à CVM e resultados).
13. **Termômetro das cartas** (v3.6) — `cartas.atualizar`: cartas das gestoras brasileiras dos últimos 6 meses (4 na v3.6; mês a mês,
   pela data de publicação ou pelo mês escrito no título). Até 6 por rodada: PDF (`pdftexto.texto`, leitor próprio em
   Python puro: objetos, FlateDecode, ObjStm e mapas ToUnicode) ou página (miolo sem menu e rodapé; página curta → PDF da
   carta no mesmo site). `citacoes` conta códigos de negociação e nomes das empresas das carteiras (mesmos termos e
   exclusões das notícias; código e nome da mesma empresa somam). Estado em `estado.cartas_lidas`; saída
   `biblioteca/cartas_mencoes.json`. O texto não é guardado; desde a v3.7 ficam até duas frases literais por empresa e carta
   (`trechos`, até 280 caracteres, com o link), e as cartas lidas antes são reabertas uma vez (`v: 2`) depois das novas.
14. **Proventos** (v3.6) — `proventos.atualizar`: uma vez por dia, uma consulta por empresa na página Empresas listadas
   da B3; classe pelo ISIN; resumo por ativo (soma do ano pela data-com, próxima data-com, próximo pagamento). Falha mantém
   o que foi publicado. Saída `biblioteca/proventos.json`.
15. **Quem tem a ação** (v3.6) — `fundos.atualizar`: na rodada da noite, escolhe o mês completo mais novo da CDA pela
   listagem da CVM (tamanho dos arquivos), lê o bloco 4 (ações) só para os códigos das carteiras e o cadastro das
   gestoras; compara com o mês anterior (`estado.fundos_cda`). Mês já publicado sem erro não é relido. Saída
   `biblioteca/fundos_acoes.json`.
16. **Clássico da semana** (v3.6) — `estante.destaque_semana`: tema da Estante mais frequente nos títulos de research
   dos últimos 7 dias; um item por semana ISO, determinístico, sem repetir as últimas 26 escolhas. Saída
   `biblioteca/estante_destaque.json`. Também na v3.6: buscas com `lente` (setor no mundo, `mkt` en-US, pares globais,
   guardadas em `setor_de`/`setor_de_vip` com `lente: true`) e com `industria` (wealth), e fontes com `industria`/
   `secao_industria`.
17. **Tipo de evento** (v3.7) — `analise.eventos_de` pela manchete (sem acento): recompra, fusão e aquisição, guidance,
   troca na gestão, emissão de dívida, oferta de ações, com exclusões (`EVENTOS_FORA`: projeção de PIB/inflação, aviso de
   participação acionária). Só em item de empresa (ativo ligado ou documento à CVM) → campo `eventos`. `REGRAS_VERSAO` 37.
   Estante: a coleção nunca lida é processada primeiro e só vira "completo" depois de lida.
18. **Fluxo dos fundos** (v3.8) — `fluxo.atualizar`: uma vez por dia a partir das 9h, cadastro (`mapa_classes`, renovado a
   cada 7 dias no estado interno) e informe diário do mês corrente e do anterior (`ler_inf`: FIC fora; linha da classe ou
   soma das subclasses), 10 s entre arquivos. `montar` gera dias, semanas (seg–dom) e meses; semanas e meses antigos
   publicados nunca saem. Saída `biblioteca/fluxo_fundos.json`. Também na v3.8: `biblioteca.falhas_seguidas` e a pausa
   de fonte (3 falhas seguidas → 1 tentativa por dia; `rodada.em_pausa`).
19. **Telegram** (opcional) — briefing uma vez por dia; desde a v3.7 com "Data-com amanhã" (proventos.json) e "Cartas novas
   que citam a carteira" (`intel.extras_digesto`); desde a v3.9 com "Inglês do dia" (`ingles.linhas_telegram`: manchete em
   inglês das últimas 36 h com mais termos de `robo/glossario_en.json`, até 3 termos, link do Google Tradutor e de
   Biblioteca › Inglês; desliga com `intel.ingles.telegram: false`). **Saídas** — `status.json`, `versao.json`, `estado.json`, Summary.

Reaproveitados da v2 sem mudança de função: `fontes_macro.py`, `agenda.py`, `resultados.py`, `avisos.py`, `util.py`
(`Rede` com backoff, disjuntor e prazo; agora com HEAD e cabeçalhos), `calendario.py`, `config.py`. `coletar.py`,
`cotacoes.py`, `historico.py`, `b3.py`, `qualidade.py`, `diagnostico.py` ficam no repositório, sem agendamento.

### Arquivos de dados

| Arquivo | Conteúdo | Publicado no site |
|---|---|---|
| `data/biblioteca/AAAA-MM.json` | todos os itens do mês (`{mes, n, itens}`) | sim |
| `data/biblioteca/indice.json` | meses, totais, contagens por fonte/tipo/tema/região | sim |
| `data/recentes.json` | últimos 14 dias (até 400 itens) | sim |
| `data/hoje.json` | briefing do dia (referências `{id, mes}`) | sim |
| `data/coleta.json` | contadores por fonte e últimas 30 rodadas | sim |
| `data/semanal.json` | até 26 semanas | sim |
| `data/macro.json`, `data/resultados.json`, `data/status.json`, `data/versao.json` | macro, CVM, situação, versão | sim |
| `data/biblioteca/opinioes.json` | opiniões de casas dos últimos 12 meses (casa, sentido, recomendação, preço-alvo, horizonte, analista quando escritos) | sim |
| `data/biblioteca/research.json` | cartas, research e instituições com data nos últimos 90 dias | sim |
| `data/biblioteca/pesquisas.json` | pesquisa ativo × fator da janela de leitura (título, link, veículo, data) | sim |
| `data/fontes.json` | cópia de `robo/fontes.json` | sim |
| `data/biblioteca/estante.json` | Estante (v3.5): coleções e itens | sim |
| `data/biblioteca/estante_destaque.json` | clássico da semana (v3.6) | sim |
| `data/biblioteca/cartas_mencoes.json` | termômetro das cartas por mês: cartas, lidas, empresas citadas e por quem (v3.6) | sim |
| `data/biblioteca/proventos.json` | proventos anunciados por ativo, com resumo do ano (v3.6) | sim |
| `data/biblioteca/fundos_acoes.json` | fundos e gestoras com cada ação no mês da CDA, entradas e saídas (v3.6) | sim |
| `data/biblioteca/fluxo_fundos.json` | fluxo dos fundos por classe: dias, semanas e meses (v3.8) | sim |
| `data/estado.json` | controle interno (IA, caches, digesto, marca das sementes, endereços do InvesTalk já tentados) | **não** |

Item (`biblioteca`): `id, titulo, link, pdf?, fonte_id, fonte, organizacao, categoria, pais, idioma, tipo, publicado_em,
detectado_em, data_estimada, resumo, autor, temas[], regioes[], ativos[], ativos_porque{}, setores[], fatores[], natureza,
prioridade{pontos, nivel, porque[]}, analise{modo, profunda, aviso, 1_publicacao..7_monitorar: [{r, t}]}, tambem_em[],
visto_em`. Itens absorvidos como "também em" recebem `agrupado_em` e saem das listas (o link continua no principal).

## Painel (`painel/src`, JavaScript sem dependências, um HTML)

- `intel.js` — módulo `INTEL` (funções puras: juntar, filtrar, ordenar, contagens, importação de aprendizados; taxonomia
  injetada pelo build a partir de `robo/analise.py`) e a camada de dados: `versao.json` a cada 10 minutos, demais
  arquivos quando a versão muda, meses sob demanda (`A.carregarMes`), `resultados.json` quando uma ficha pede; vistas
  `A.itemRow`/`A.listaRows` (linhas de notícia com separador por dia, abrem no lugar), `A.itemCard`, `A.abrirItem` (janela de leitura editorial: fonte e data, resumo, por que importa, relação com a Oregon, contrapontos documentados, aprofundar recolhido; ao fechar, volta ao ponto de leitura), `I.vinculo` (mesma regra do robô, para itens antigos), `A.macroCards`, `A.agendaView`.
- `ui_hoje.js` — Hoje em quatro áreas (Radar das teses, Agenda decisiva, Research global, Debate de mercado), mapa de
  atenção, desde a última visita e profundidade de leitura (guardadas neste navegador, chaves `oregon-intel-v3:`).
  `ui_oregon.js` — Brasil e Mundo e Estratégia (Notícias, Research por recência e temas de gestão, Debate de mercado com
  consultas externas, ETFs globais). `ui_bib.js` — Biblioteca (com Salvos para ler e o diagnóstico das fontes). `ui_mapa.js` + `ui_mesa.js` — as 15 carteiras (pesos como
  aprovados, validação, exposições agregadas). `ui_teses.js`, `core.js`, `store.js` (coleções `aprendizados`, `leituras` e `salvos`
  neste navegador; no claude.ai, no banco do artefato), `quant.js` (só o que a validação usa).
- v3.6: `ui_comite.js` — Comitê do mês (coleção `comite` no `store.js`, ids `AAAA-MM:item`; `A.botaoComite` aparece nas
  linhas de notícia, na janela de leitura e na Estante). `ui_br36.js` — Brasil › Agenda de proventos, Quem tem a ação e
  Termômetro das cartas, e os blocos da ficha (`A.proventosNaFicha`, `A.fundosNaFicha`). `ui_estudo36.js` — Mundo e
  Estratégia › Wealth e consultorias, Biblioteca › Trilha de estudo (CFP e CFA III por palavras-chave) e o clássico da
  semana. `A.arquivo(nome)` (em `intel.js`) carrega esses arquivos do robô só quando a tela pede. `A.lenteGlobal` e a
  ponte Oregon e VIP ficam em `ui_oregon.js` e `ui_vip.js`.
- v3.7: `ui_v37.js` — topo com o ponto da coleta e o quadro (próxima coleta, "Coletar agora" para a página do workflow no
  GitHub, tema automático/claro/escuro, explicações sempre visíveis), aviso depois do Atualizar, faixa do dia, alertas das
  buscas salvas, fila de leitura, Brasil › Mudanças de recomendação (`A.mudancasRecomendacao`: mesma casa e ativo contra a
  visão anterior no acervo), Carteiras › Fechamento da semana (`A.fechamentoSemana`) e `A.btnImprimir`. Em `intel.js`:
  `I.parseBusca` (operadores da busca dentro de `I.filtrar`), `I.eventosDe` (usa `x.eventos` ou a tabela `TAXON.eventos`
  injetada pelo build), `I.marca`/`A.marcaEl` (letra e cor por tipo: F, R, O, C, E, N). Em `ui_base.js`: o "?" de
  `A.pageHead` e `A.sec` (`A.qBtn`). Em `ui_hoje.js`: duas colunas independentes e `A.recolhivel` (áreas fechadas no
  celular, estado em `oregon-intel-v3:area-<id>`).
- `painel/arquivo/` — módulos arquivados sem apagar: cotações/mercado ao vivo, Sala de Gestão, Comitê, laboratório de
  propostas, risco e cenários, importação de séries, Mundo e Estratégia, Research Brasil antigo.
- Endereços antigos (`#res/...`, `#cart/risco`, `#global`, `#sala/...`) são traduzidos para as cinco seções (`A.traduz`).

## Workflow (`.github/workflows/robo.yml` = `docs/workflow_robo.yml`)

Permissões zeradas por padrão; o job de coleta tem `contents: write` (ramo `dados`) e o de publicação `pages: write` +
`id-token: write`. Portão de testes antes de qualquer coisa; `data/` inteira restaurada do ramo `dados`; `git add -f data`
guarda tudo; o site recebe só os arquivos públicos (nunca `estado.json`). Crons (UTC) `7,37 10-23 * * *`, `7,37 0,1 * * *` e `15 4,7 * * *` (v3.7: fora da hora cheia e da meia hora, que o GitHub
trata como pico e onde atrasa ou descarta rodadas agendadas). Envio de arquivos (push) e "Run workflow" também rodam. v3.9.1:
mais `7 5,6 * * *`, `7,37 8,9 * * *` e `22,52 12-21 * * *` (02:07, 03:07, 05:07 a 06:37 e aos 22 e 52 das 09:22 às 18:52 em
Brasília), depois de uma noite em que o GitHub disparou só 2 de 6 rodadas. A agenda do painel (`ui_v391.js`, `A.SLOTS_COLETA`)
é conferida contra o `robo.yml` pelo `testes/painel.test.js`. O aviso de atraso (`A.atrasoColeta`) compara a última
`versao.gerado_em` com os horários previstos até 25 minutos atrás e, só quando há atraso, consulta a API pública de execuções
do GitHub (sem chave, no máximo a cada 3 minutos) para dizer se a coleta está rodando, terminou ou não foi disparada.

v3.11 · **corrente de rodadas.** Terceiro job, `seguinte` (`needs: [coletar, publicar]`, `if: !cancelled()`, permissões
`actions: write` e `contents: read`, nenhum Secret), roda `robo/corrente.py` com a `GITHUB_TOKEN` da rodada. Ele lê o início
da rodada na API, espera o intervalo (`intel.corrente`: 15 min das 6h às 23h, 30 min de madrugada, 60 min depois de falha
ou cancelamento da coleta; sempre entre 5 e 60, porque o job tem 75 min de prazo), confere se já existe rodada mais nova
no `main` (número maior, cancelada não conta) e, se não existe, dispara `workflow_dispatch` no `main` com
`corrente: true`. Até 4 tentativas por chamada (15, 30 e 60 s); se um disparo repetido criar uma rodada a mais, a mais
velha vê a mais nova e para. Disparo pela `GITHUB_TOKEN` cria rodada só nesse caso (e no `repository_dispatch`),
segundo a documentação do GitHub. Com `corrente: true`, `ROBO_MANUAL` fica `false`: a rodada respeita o intervalo de cada
fonte, como a agendada. A fila deixou de valer para a rodada inteira e passou para os jobs: `coletar` no grupo
`robo-oregon` e `publicar` no grupo `robo-oregon-site`, ambos sem cancelar o que está rodando. Assim a espera do `seguinte`
não segura um "Run workflow". Os crons continuam como reserva. O robô grava em `versao.json` → `corrente` a próxima rodada
prevista (`{ativo, minutos, proxima}`); o painel usa essa hora em "Próxima coleta prevista" quando ela vem antes do próximo
horário (`ui_v311.js`, `I.proximaCorrente`).


## Painel · v3.9 (Biblioteca › Inglês)
- `painel/src/ui_ingles.js`: página Biblioteca › Inglês e os botões de inglês nas notícias. Embrulha `A.itemRow` (botão
  "▶ EN" nas manchetes com `idioma: en`) e `A.leituraView` (barra Ouvir · Mais devagar · Traduzir · Repetir e conferir ·
  Salvar frase e termos do glossário). Funções puras em `INTEL`: `termosEN`, `termosUnicos`, `conferirFala` (maior
  subsequência comum entre a frase e a fala), `escolherManchetes`, `frasesCarteira`, `proximaRevisao`, `textoAnki`.
- Voz: `speechSynthesis` do navegador (0,75× ou 1×, `ing-vel`). Fala: `SpeechRecognition`/`webkitSpeechRecognition`
  (Chrome e Safari). Tradução: `Translator` do Chrome, no aparelho, quando existe; senão, link do Google Tradutor.
- `GLOSSARIO_EN` é injetado pelo `build.py` a partir de `robo/glossario_en.json` (a mesma fonte do robô, `robo/ingles.py`).
- Vocabulário: coleção `vocab` do `STORE` (localStorage ou banco do painel), revisão espaçada 1, 3, 7, 14 e 30 dias.
  Estado do dia em `lsGet`: `ing-dia` (manchetes do dia), `ing-passo`, `ing-feitos` (dias concluídos).


## v3.10 · macro do Brasil
- **Robô, `analise.py`:**
  - `MACRO_BR` (sete subtemas), `MACRO_BR_FORA`, `MACRO_BR_EN` e `macro_br(titulo, idioma)`.
  - `classificar` grava `item['macro_br']` (só veículo e instituição).
  - `prioridade` soma +8 só quando não há ativo da Oregon nem da VIP.
  - Manchete de índice e câmbio sem empresa da carteira deixa de ser "só movimento de preço".
  - `REGRAS_VERSAO` 38: o que já está publicado é reclassificado na próxima rodada.
- **Robô, `intel.py`:**
  - `fontes_de_busca` cria `busca-macro-*` a partir de `noticias.buscas_macro`, com `exigir_macro`, `busca_macro` e
    intervalo de 60 min.
  - As buscas de macro vêm primeiro e não contam no teto das buscas por empresa.
  - O filtro de tema da imprensa aceita `macro_br`.
  - O briefing ganha `mercado_hoje.linhas_telegram`, de `robo/mercado_hoje.py`: até 5 manchetes das últimas 18 h, agenda
    do dia primeiro, sem repetir o fato e sem Grupo XP.
- **InfoMoney:** sai de `noticias.fontes_bloqueadas` e mantém o aviso de `fontes_sinalizadas`.
- **Painel, `intel.js`:**
  - `I.bloqueado` não inclui mais o InfoMoney.
  - `I.grupoXP` marca o InfoMoney, e esses itens ficam fora de pauta da semana (Oregon e VIP), fechamento da semana e
    sugestões do comitê.
  - Novos `I.macroBR` e filtro `macro` em `I.ultimas`.
- **Painel, `ui_v310.js`:**
  - Bloco "Mercado hoje · Brasil" logo depois do mapa de atenção, em todos os modos, com atalho em "Nesta página".
  - Filtro "Macro Brasil" em Todas as notícias.
  - Selo "Grupo XP" nas linhas do InfoMoney.
  - `TAXON.macro_br` traz os nomes dos subtemas, injetados pelo `build.py`.


## v3.11 · corrente de rodadas e painel novo
- **Robô:** `robo/corrente.py` (só biblioteca padrão; funções puras `ajustes`, `intervalo_min`, `espera_seg`, `resumo`,
  `rodada_mais_nova`, e `main` com a API injetável nos testes). Nunca deixa a rodada vermelha: erro de rede ou HTTP
  (inclusive resposta cortada, `http.client.HTTPException`) vira `::warning` e o próximo horário religa a corrente. `config.py` valida `intel.corrente`. `intel.gravar_versao` grava
  `corrente` no `versao.json`.
- **Identidade do painel:** `painel/build.py` calcula `PAINEL_BUILD` (12 caracteres do SHA-256 do JavaScript e do CSS
  montados, sem data e hora, então só muda quando o painel muda), injeta no HTML e grava `site/painel.json`.
- **Painel, `ui_v311.js`:**
  - Embrulha `A.intelAtualizar`: depois dos dados, lê `painel.json` (sem cache). Se for diferente do `PAINEL_BUILD`
    aberto, avisa e recarrega com `?v=<build>`.
  - A mesma versão só é tentada de novo depois de 5 minutos (depois da 3ª vez, de 30), anotado no `sessionStorage`,
    para não entrar em laço enquanto o GitHub publica.
  - A cada 10 minutos, e quando a aba volta a ficar visível, confere sozinho e mostra a faixa `.painel-novo` com
    "Recarregar".
  - Só no site: no claude.ai e no arquivo local, nada muda. A recarga mantém os outros parâmetros do endereço.
  - Embrulha `A.atrasoColeta` e `I.textoAtraso`: rodada "em andamento" há mais de 25 min vira `demorando` (a coleta
    falhou e a etapa `seguinte` espera) e rodada concluída com falha vira `falhou`. Nos dois casos o aviso mostra o
    "Coletar agora".


## v4.0 · visual novo (moldura e Hoje)
- **Camada, não reescrita.** `painel/src/v4.css` (somado ao `app.css` pelo `build.py`) e `painel/src/ui_v4.js` (antes do
  `main.js`). Toda regra do CSS começa por `html.v4`, `html:not(.v4)` ou uma classe `.v4-*`; `testes/test_v4.py`
  confere. Sem a classe `v4` no `<html>`, o painel é o da v3.11.
- **Troca:** `A.setVisual('novo'|'antigo')`, guardada em `localStorage` (`A.lsSet('visual')`); padrão `novo`.
- **Moldura (`moldura()`, depois de cada `A.render`):**
  - a ≥1024 px, `.ov` vira grade de 252 px + conteúdo e `.top` vira o menu lateral (fixo, 100vh);
  - `ui_v4.js` acrescenta `.v4-subs` (as páginas de `A.SUBS[área]`, que no conteúdo ficam escondidas a ≥1024 px),
    `.v4-col` (anel da próxima rodada: o menor entre `I.proximaCorrente` e `I.coletasPrevistas`, atualizado a cada
    segundo; Atualizar = `A.intelAtualizar`; Coletar agora = página do robô no GitHub) e `.v4-volta`;
  - `#ctx` vai para o alto do conteúdo e o rodapé `.v4-rod` traz a troca de visual;
  - `A.dadosPill` é embrulhado para abrir o detalhe da coleta ao lado do menu.
- **Hoje (`A.areas.hoje` embrulhado):** só reorganiza o DOM que `ui_hoje.js` já monta.
  - `.v4-dia` ("O dia até agora") recebe a `.fxd` da faixa do topo e usa `I.diaPorHora(itens, macro, hoje)`: contagem
    por hora de Brasília e a manchete de macro do Brasil de cada hora, sem Grupo XP primeiro.
  - `.v4-g` = `.v4-main` (`#mercado-hoje`, `#radar`) + `.v4-side` (`#atencao`, `#agenda-decisiva`, `.hx-g`).
  - `.v4-baixo` = `#research` + `#debate`; `#ultimas` no fim.
  - Abaixo de 1100 px, `display:contents` e `order` refazem a coluna única com o mapa primeiro.
- **Tipos:** `A.marcaEl` embrulhado põe `data-w` com o nome por extenso; `A.itemRow` leva a marca para a linha do
  veículo. As letras continuam no DOM (e no visual antigo).


## v4.0.1 · Assuntos do momento, filtro do Hoje, ETFs de renda fixa
- **Robô, `robo/assuntos.py` + `robo/assuntos.json`.**
  - **Lista conferível:** `palavras` sem acento, palavra inteira, `*` = prefixo; `exatas` com caixa e acento.
  - **Contagem por título:** `calcular` conta por janela.
    - 24 h, pela hora de publicação, contra as 7 × 24 h anteriores;
    - 7 e 30 dias, pelos dias de Brasília, contra 28 e 60 dias.
  - **Seta, pela razão das fatias:** sobe ≥ 1,5 com 5 itens; cai ≤ 2/3 com 5 esperados; sem base com menos de 300
    itens na comparação.
  - **Histórico diário dentro do próprio arquivo:** cada rodada recalcula os últimos 10 dias. Se a `marca` (hash da
    lista) muda ou é a primeira vez, relê 95 dias.
  - **Os 20 mais recentes por assunto** vão em `ultimos`, com os campos mínimos.
  - **Publicação:** `intel.py` grava `biblioteca/assuntos.json` depois do research de 90 dias; uma falha só registra
    no log e mantém o arquivo anterior. O site já copia `data/biblioteca/*.json`, então o `robo.yml` não muda.
- **Painel.**
  - **Mesma regra de palavras em `intel.js`:** `I.compilarAssuntos`, `I.assuntosDe` e `I.assuntosDefs`. A lista vem
    de `TAXON.assuntos`, que o `build.py` lê do robô, ou do arquivo publicado. `testes/test_v401.py` roda o JavaScript
    no Node e compara com o Python.
  - **Busca:** `I.parseBusca`/`I.filtrar` aceitam `assunto:id`.
  - **`ui_v401.js`:**
    - **`A.v4Hero`:** o bloco do alto, que o `ui_v4.js` chama no lugar das barras por hora, que saíram.
    - **Carga do arquivo:** lê `biblioteca/assuntos.json` a cada versão nova e depois do Atualizar.
    - **Filtro do Hoje:** embrulha `A.itens`, `A.itensAtivo` e `A.itensResearch`, que filtram só durante a montagem do
      Hoje (`DENTRO`). O estado é `A.v4Filtrar` e `A.v4Filtro`; sai do filtro ao trocar de seção.
    - **Mapa de atenção:** um clique em captura no quadrado filtra o Hoje pelo ativo.
    - **`posHoje`:** monta a faixa do filtro, a linha de cada seção, as contagens do "Nesta página" e a linha do modo
      de leitura.
    - **Busca:** `A.busca` embrulhado; as últimas buscas ficam em `localStorage` (`buscas-recentes`).
    - **ETFs de renda fixa:** `A.noticiasPainel` embrulhado nos ETFs dos pilares P1 a P4 com o bloco `.np-rf` (Mercado
      hoje: juros, inflação, fiscal; 72 h). O `ui_oregon.js` passou a chamar `A.noticiasPainel(t)` pela propriedade.
- **Buscas de tema de ETF.**
  - `fontes_de_busca` passa `intervalo_min`, `intervalo_pregao_min` e `fora_do_teto`.
  - `intel.no_pregao` (dias úteis, 9h às 19h de Brasília) troca o intervalo.
  - `fora_do_teto` ordena junto das buscas de macro e não gasta o teto das buscas por empresa.


## v4.1 · melhorias visuais e "O que o mercado está falando"
- **Robô, `robo/empresas.py`.**
  - **Empresas da carteira e da VIP:** `da_carteira` usa as ações (`classe: acao`) com `noticias.termos` e `excluir`
    de `robo/config.json` e conta com `noticias.pertence`.
  - **As demais:** `aprender` lê pares "Nome (CÓDIGO)" nas manchetes (tira "Lucro da", "Ações da", "CEO da"…; deixa
    de fora BDRs 34/35 e contratos futuros). `definicoes` junta os códigos da mesma raiz (SANB3/SANB11). O nome conta
    com maiúscula exata, menos as palavras comuns de `COMUNS`, que contam só pelo código.
  - **Bancos como fonte da opinião:** `CASAS` tira "Bradesco BBI", "Itaú BBA"… antes de procurar o banco.
  - **Contagem e seta:** `calcular` usa a regra de `assuntos.py` (24 h × 7 dias; 7 × 28; 30 × 60) para empresas (top
    20) e macro (`x.macro_br`).
  - **Histórico:** fica no arquivo e cada rodada recalcula 10 dias. A `marca` olha só a carteira: nome novo aprendido
    não refaz o histórico, carteira nova refaz (95 dias).
  - **Publicação:** `intel.py` grava `biblioteca/assuntos.json` e depois `biblioteca/empresas.json`, cada um no seu
    `try`. O site já copia a pasta.
- **Painel, `ui_v41.js` + `v4.css`** (só com `html.v4`; cada bloco marcado [P3]…[P14]):
  - **[P3] carregamento:** `A.v4Esqueleto` no lugar do Hoje vazio enquanto `intel.carregando`.
  - **Hoje, depois da montagem:** [P5] dia dentro do cartão do Radar (`.v4-dd`); [P6] barra e grupos da temporada
    (move os botões existentes).
  - **[P8] coluna de notícias da ficha:** `A.noticiasPainel` embrulhado com o índice `.v4-np-idx` e âncoras
    `.v4-npb`.
  - **[P9] cabeçalho da ficha:** `fichaCab`, depois de cada `A.render`: monograma, selos `.v4-cc`, chips `.v4-pc`.
  - **[P10] tabelas:** `td.num/.r` com sinal ganham `.v4-up/.v4-down`.
  - **[P11] "O que o mercado está falando":** `A.areas.brasil` embrulhado (Ativos brasileiros), lendo
    `biblioteca/empresas.json`.
  - **[P13] Mundo:** `A.areas.mundo` embrulhado; `mundoRegioes` monta o quadro de regiões a partir dos botões do
    filtro (tocar = clicar no botão); `opBarra` monta a barra de opiniões a partir dos botões ou dos selos.
  - **[P14] cores:** `A.PC`/`A.CC` trocam para a paleta da Oregon no visual novo e voltam no antigo.
  - **[P4], [P7], [P12] e o resto:** só CSS.


## v4.2 · Pautas da semana, do mês e do ano
- **Robô, `robo/pautas.py`** (chamado por `intel.py` depois de `empresas.py`, no seu próprio `try`): publica
  `biblioteca/pautas.json`.
  - **Escopos:** `carregar_carteiras` lê `painel/src/data.json` (P5 Dividendos, P6 Valor, P7 FIIs) e `vip.json`
    (Dividendos, Valor, Smallcaps). Os temas de ETF exterior/renda fixa vêm de `noticias.etfs` + o pilar dos ETFs.
  - **Seleção, só com marcações que o robô já faz:**
    - `tipo` usa `vinculos` / `vinculos_vip`, `categoria` oficial_empresa, `natureza` opiniao_casa (+ `RX_MUDANCA`),
      `analise.eventos_de`, `prioridade`;
    - setor por `setor_de` / `setor_de_vip`;
    - macro por `macro_br`, `temas`, `regioes`, `temas_etf`.
  - **Fora da pauta:** acervo, agrupados, Grupo XP, fonte bloqueada e data futura.
  - **Agrupamento e limites:** `agrupar` junta o mesmo fato (regra de `I.agruparFatos`; casas diferentes nunca se juntam).
    Os limites por tipo estão em `TETO`.
  - **Períodos:**
    - semana = 7 dias, refeita a cada rodada;
    - meses do ano: o corrente refeito, o anterior também até o dia 10, os outros guardados;
    - `VERSAO` refaz tudo quando o método mudar.
  - **Itens:** `itens` guarda a forma curta de cada manchete usada (título, link, veículo, data, casas, recomendação, alvo).
  - **Ano, rede no máximo uma vez por dia (`rede_em`), com uma falha mantendo o anterior:**
    - `focus_ano` traz a primeira divulgação do Focus no ano (Olinda, guardada para sempre) e a mais recente
      (`fontes_macro.focus`);
    - `fatos_do_ano` traz os fatos relevantes desde 1º de janeiro (`conteudo.cvm_ipe` com a fonte `cvm-ipe`).
    - O robô não chama o SGS (`intel.indicadores_macro = false` continua valendo).
  - **Teses:** `teses` guarda uma versão nova quando a tese muda (Oregon: rec, teto, justo, ponto, tese; VIP: sugestão,
    teto, justo, alocação, risco).
- **Painel, `ui_v42.js` + `v4.css`** (peças `.v4-pt-*`, nos dois visuais):
  - **Menu:** entra em `A.AREAS` logo depois de Hoje; a rota `#pautas` vai em `main.js`.
  - **Dados:** lê `pautas.json`, `assuntos.json` (assuntos acima do normal) e `fluxo_fundos.json`.
  - **Ano:** Selic, IPCA, PTAX e CDI vêm direto do SGS no navegador (como em `mercado.js`). O lucro por trimestre
    contra o ano anterior vem de `A.resultadosDe` (CVM, ITR) e o retorno no ano de `C.ATV[t].ret_ano`.
  - **Texto para copiar:** `A.v42Texto`.

