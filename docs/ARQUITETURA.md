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
9. **Resultados CVM** — na rodada da noite, a cada 3 dias, `resultados.coletar` (ITR/DFP) → `resultados.json`.
10. **Telegram** (opcional) — briefing uma vez por dia. **Saídas** — `status.json`, `versao.json`, `estado.json`, Summary.

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
- `painel/arquivo/` — módulos arquivados sem apagar: cotações/mercado ao vivo, Sala de Gestão, Comitê, laboratório de
  propostas, risco e cenários, importação de séries, Mundo e Estratégia, Research Brasil antigo.
- Endereços antigos (`#res/...`, `#cart/risco`, `#global`, `#sala/...`) são traduzidos para as cinco seções (`A.traduz`).

## Workflow (`.github/workflows/robo.yml` = `docs/workflow_robo.yml`)

Permissões zeradas por padrão; o job de coleta tem `contents: write` (ramo `dados`) e o de publicação `pages: write` +
`id-token: write`. Portão de testes antes de qualquer coisa; `data/` inteira restaurada do ramo `dados`; `git add -f data`
guarda tudo; o site recebe só os arquivos públicos (nunca `estado.json`). Crons `40 9,14,20 * * *` e `40 0 * * *` (UTC).
