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
   (temas, regiões, ativos, setores, fatores, natureza, prioridade) e `analise.analisar_regras` (sete pontos rotulados);
   `biblioteca.incorporar` deduplica por id (link normalizado) e por título (Jaccard ≥ 0,6, janela de 3 dias, nunca
   entre itens da mesma fonte) e grava por mês. Contadores em `coleta.json`.
5. **IA opcional** (`ler_com_ia`) — só com `ANTHROPIC_API_KEY` e `intel.ia.ativo = true`; itens de prioridade alta/média
   sem análise profunda, até `max_itens_dia` e `max_tokens_dia`; a resposta é validada (rótulos FATO/FONTE/INFERÊNCIA) e
   combinada com as regras (`analise.combinar`); uso registrado em `estado.json` (`ia_uso`, `ia_historico`).
6. **Índice e recentes** — `biblioteca.reindexar` (`indice.json`) e `publicar_recentes` (`recentes.json`, 14 dias).
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
| `data/fontes.json` | cópia de `robo/fontes.json` | sim |
| `data/estado.json` | controle interno (IA, caches, digesto) | **não** |

Item (`biblioteca`): `id, titulo, link, pdf?, fonte_id, fonte, organizacao, categoria, pais, idioma, tipo, publicado_em,
detectado_em, data_estimada, resumo, autor, temas[], regioes[], ativos[], ativos_porque{}, setores[], fatores[], natureza,
prioridade{pontos, nivel, porque[]}, analise{modo, profunda, aviso, 1_publicacao..7_monitorar: [{r, t}]}, tambem_em[],
visto_em`. Itens absorvidos como "também em" recebem `agrupado_em` e saem das listas (o link continua no principal).

## Painel (`painel/src`, JavaScript sem dependências, um HTML)

- `intel.js` — módulo `INTEL` (funções puras: juntar, filtrar, ordenar, contagens, importação de aprendizados; taxonomia
  injetada pelo build a partir de `robo/analise.py`) e a camada de dados: `versao.json` a cada 10 minutos, demais
  arquivos quando a versão muda, meses sob demanda (`A.carregarMes`), `resultados.json` quando uma ficha pede; vistas
  `A.itemCard`, `A.abrirItem` (gaveta com sete pontos, fonte original, leitura e aprendizado), `A.macroCards`, `A.agendaView`.
- `ui_hoje.js`, `ui_bib.js`, `ui_oregon.js` — as três seções. `ui_mapa.js` + `ui_mesa.js` — as 15 carteiras (pesos como
  aprovados, validação, exposições agregadas). `ui_teses.js`, `core.js`, `store.js` (coleções `aprendizados` e `leituras`
  neste navegador; no claude.ai, no banco do artefato), `quant.js` (só o que a validação usa).
- `painel/arquivo/` — módulos arquivados sem apagar: cotações/mercado ao vivo, Sala de Gestão, Comitê, laboratório de
  propostas, risco e cenários, importação de séries, Mundo e Estratégia, Research Brasil antigo.
- Endereços antigos (`#res/...`, `#cart/risco`, `#global`, `#sala/...`) são traduzidos para as três seções (`A.traduz`).

## Workflow (`.github/workflows/robo.yml` = `docs/workflow_robo.yml`)

Permissões zeradas por padrão; o job de coleta tem `contents: write` (ramo `dados`) e o de publicação `pages: write` +
`id-token: write`. Portão de testes antes de qualquer coisa; `data/` inteira restaurada do ramo `dados`; `git add -f data`
guarda tudo; o site recebe só os arquivos públicos (nunca `estado.json`). Crons `40 9,14,20 * * *` e `40 0 * * *` (UTC).
