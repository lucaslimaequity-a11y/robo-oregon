# Oregon Intelligence

Central de research e formação continuada para quem gere carteiras. Reúne, organiza, interpreta e liga à carteira
Oregon o conteúdo público de gestoras, instituições e canais oficiais. **Não é** terminal de cotações, plataforma de
trading nem simulador: cotações, câmbio ao vivo, mini gráficos de preço, cenários e laboratório de propostas foram
arquivados (`painel/arquivo/`) e saíram da navegação.

Site público (GitHub Pages): `https://lucaslimaequity-a11y.github.io/robo-oregon/`

## As cinco seções

| Seção | O que tem |
|---|---|
| **Hoje** | No topo: última coleta, notícias das últimas 24 h e fontes com erro. Últimas notícias (hora · veículo · título · ↗), com filtros Na carteira, Brasil, Mundo, Opiniões e Oficiais; ativos das carteiras citados nas últimas 72 h; agenda oficial; leituras do dia (cartas, research, documentos) com análise em sete pontos; estudo do dia. |
| **Brasil** | Ativos brasileiros das 15 carteiras, os com notícia mais recente primeiro. Na ficha, ao lado: notícias da empresa (portais, busca por ativo, CVM), opiniões a favor e contra, documentos à CVM, setor e cadeia, links "buscar agora" (Google Notícias, Bing Notícias, CVM). Tese, resultados da CVM e pesos aprovados. |
| **Mundo e Estratégia** | O que o mundo fala (imprensa internacional e bancos centrais, por região, e temas dos ETFs globais); cartas, research e conteúdo educacional dos últimos 30 dias; ETFs globais com notícias do índice e do tema. |
| **Carteiras** | As 15 carteiras com pesos aprovados e validação (sem normalizar), mapa e Decidido × base. |
| **Biblioteca** | Pesquisa em tudo o que já foi coletado, mês a mês; resumos semanais; meus aprendizados; fontes e coleta (por fonte e por busca). |

## Como funciona

```
robo/fontes.json + buscas de robo/config.json ──► robo/intel.py (GitHub Actions, a cada 30 min das 7h às 22h30, 7 dias por semana)
                      ├─ agenda oficial IBGE/Copom/Fed/Focus → data/macro.json (indicadores de mercado desligados)
                      ├─ buscas por ativo, setor e tema (RSS do Bing Notícias) e fatos relevantes da CVM
                      ├─ conteúdo: RSS/Atom/RDF, APIs públicas, páginas com PDF, sitemap, documento de URL fixa, YouTube (API oficial)
                      │    → classificação (temas, regiões, ativos, setores, fatores), prioridade, análise em 7 pontos por regras
                      │    → IA opcional (teto diário) → biblioteca mensal + recentes.json + coleta.json (contadores por fonte)
                      ├─ briefing do dia → data/hoje.json · resumo da semana → data/semanal.json
                      └─ ramo "dados" (histórico completo) e site (arquivos públicos) ──► painel (painel/src → site/index.html)
```

- **Fontes**: só conteúdo público e gratuito; `robots.txt` respeitado; nenhum paywall ou bloqueio contornado. O cadastro
  e as limitações de cada fonte estão em `robo/fontes.json` e `docs/FONTES.md`.
- **Análise**: cada frase leva um rótulo — **FATO** (o que a fonte publicou), **OPINIÃO DA FONTE** (tese do autor) ou
  **INFERÊNCIA DO SISTEMA** (ligação por palavras-chave ou roteiro de estudo). Sem IA, os sete pontos vêm de regras sobre
  título, resumo público e fonte, e a tela diz isso. Nunca há conclusão de impacto nem recomendação de compra ou venda.
- **Sem IA continua útil**: a chave da Anthropic é opcional (`docs/IA.md`), desligada por padrão, com teto diário.
- **Nada some em silêncio**: itens sem prioridade continuam na Biblioteca; fonte que falha não apaga o que publicou;
  cada rodada registra por fonte o que chegou, foi rejeitado (e por quê), já estava na biblioteca, era novo e foi publicado.
- **Segurança**: nenhuma chave no site ou no código; chaves só em GitHub Secrets; o workflow não tem permissão por padrão.

## Pastas

- `robo/` — `intel.py` (orquestrador), `conteudo.py` (coletores), `biblioteca.py` (persistência, deduplicação, contadores),
  `analise.py` (taxonomia, prioridade, sete pontos, IA opcional), `semanal.py` (briefing e resumo semanal), `fontes.json`,
  `config.json`; reaproveitados da v2: `fontes_macro.py`, `agenda.py`, `avisos.py`, `util.py`, `config.py`, `calendario.py`.
  `coletar.py` e os módulos de cotação continuam no repositório, mas não são agendados.
- `painel/src/` — `intel.js` (dados e vistas de conteúdo), `ui_hoje.js`, `ui_bib.js`, `ui_oregon.js` (Brasil e Mundo e Estratégia), `ui_mapa.js` (carteiras),
  `ui_mesa.js` (validação), `ui_teses.js`, `core.js`, `store.js`, `data.json`, `etfs.json`. `painel/arquivo/` guarda o que saiu.
- `testes/` — robô (internet simulada) e painel (Node). `painel/test/areas.js` percorre as cinco seções no navegador. `testes/amostras_reais/` guarda a amostra real do Bing usada nos testes.
- `docs/` — `ATUALIZACAO.md` (instalar e voltar atrás), `FONTES.md`, `ARQUITETURA.md`, `DIAGNOSTICO.md` (as 72 manchetes),
  `VALIDACAO.md`, `RESULTADOS_TESTES.md` (saída da última execução), `IA.md`, `workflow_robo.yml` (cópia visível do workflow).

## Rodar localmente

```
python -m unittest discover -s testes -v      # robô, com internet simulada
node testes/painel.test.js                   # painel
python painel/build.py                       # monta site/index.html
python painel/test/gera_dados_teste.py /tmp/site_teste && (cd /tmp/site_teste && python -m http.server 8777) &
node painel/test/areas.js http://localhost:8777/index.html   # percorre as cinco seções (computador e celular)
```
