# Oregon Intelligence

Central de research e formação continuada para quem gere carteiras. Reúne, organiza, interpreta e liga à carteira
Oregon o conteúdo público de gestoras, instituições e canais oficiais. **Não é** terminal de cotações, plataforma de
trading nem simulador: cotações, câmbio ao vivo, mini gráficos de preço, cenários e laboratório de propostas foram
arquivados (`painel/arquivo/`) e saíram da navegação.

Site público (GitHub Pages): `https://lucaslimaequity-a11y.github.io/robo-oregon/`

## As três seções

| Seção | O que tem | Arquivos que lê |
|---|---|---|
| **Hoje** | 5 a 8 conteúdos prioritários (no máximo 2 por fonte e 3 por tema), cada um com análise em sete pontos; macro oficial que explica o dia; agenda; notícias e documentos macro; publicações de gestoras; vídeos; uma leitura recomendada (rotativa, 30 dias); estudo do dia (perguntas para responder por escrito). | `hoje.json`, `recentes.json`, `macro.json` |
| **Biblioteca** | Pesquisa por assunto, autor/gestora, país/região, período, tipo, origem, ativo e prioridade, mês a mês (nada é apagado); resumos semanais; meus aprendizados (registro com exportar/importar); fontes e coleta (recebidos, rejeitados, duplicados, novos, publicados, por fonte). | `biblioteca/AAAA-MM.json`, `indice.json`, `semanal.json`, `coleta.json`, `fontes.json` |
| **Oregon** | Ativos das 15 carteiras aprovadas com o conteúdo que os cita, tese, documentos oficiais, resultados da CVM e opinião da casa (sem cotação); as 15 carteiras com pesos aprovados e validação (sem normalizar); setores e fatores de risco com nível oficial e conteúdo ligado. | `painel/src/data.json`, `etfs.json`, `resultados.json` |

## Como funciona

```
robo/fontes.json ──► robo/intel.py (GitHub Actions, 4× por dia, 7 dias por semana)
                      ├─ macro oficial: BCB (SGS, Focus), Tesouro, Tesouro dos EUA, agenda IBGE/Copom/Fed → data/macro.json
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
- `painel/src/` — `intel.js` (dados e vistas de conteúdo), `ui_hoje.js`, `ui_bib.js`, `ui_oregon.js`, `ui_mapa.js` (carteiras),
  `ui_mesa.js` (validação), `ui_teses.js`, `core.js`, `store.js`, `data.json`, `etfs.json`. `painel/arquivo/` guarda o que saiu.
- `testes/` — robô (internet simulada) e painel (Node). `painel/test/areas.js` percorre as três seções no navegador.
- `docs/` — `ATUALIZACAO.md` (instalar e voltar atrás), `FONTES.md`, `ARQUITETURA.md`, `DIAGNOSTICO.md` (as 72 manchetes),
  `VALIDACAO.md`, `RESULTADOS_TESTES.md` (saída da última execução), `IA.md`, `workflow_robo.yml` (cópia visível do workflow).

## Rodar localmente

```
python -m unittest discover -s testes -v      # robô, com internet simulada
node testes/painel.test.js                   # painel
python painel/build.py                       # monta site/index.html
python painel/test/gera_dados_teste.py /tmp/site_teste && (cd /tmp/site_teste && python -m http.server 8777) &
node painel/test/areas.js http://localhost:8777/index.html   # percorre as três seções (computador e celular)
```
