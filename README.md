# Oregon Intelligence

Central de research e formação continuada para quem gere carteiras. Reúne, organiza, interpreta e liga à carteira
Oregon o conteúdo público de gestoras, instituições e canais oficiais. **Não é** terminal de cotações, plataforma de
trading nem simulador: cotações, câmbio ao vivo, mini gráficos de preço, cenários e laboratório de propostas foram
arquivados (`painel/arquivo/`) e saíram da navegação.

Site público (GitHub Pages): `https://lucaslimaequity-a11y.github.io/robo-oregon/`

## As seis seções

| Seção | O que tem |
|---|---|
| **Hoje** | Data, última coleta e o que chegou desde a sua última visita. Mapa de atenção da carteira (acontecimentos por ativo em 7 dias). Quatro áreas: **Radar das teses** (empresas acompanhadas, separando fato da empresa, opinião publicada, notícia e hipótese de setor), **Agenda decisiva** (temporada de resultados na CVM, documentos das companhias, agenda oficial), **Research global** e **Debate de mercado**. Profundidade rápida, briefing ou aprofundada. Sem cotações, Tesouro, dólar ou IPCA. |
| **Brasil** | Ativos das 15 carteiras pela notícia direta mais recente. Na ficha, ao lado: notícias em que o ativo é o assunto, opiniões publicadas (12 meses, com recomendação e preço-alvo quando escritos), documentos à CVM, setor e cadeia e menções incidentais. No centro, em abas: Mudanças na tese, Eventos e RI, Fundamentos, Setor e pares e (v3.5) **Casas de análise**: o que cada casa diz hoje e o preço-alvo de cada uma ao longo de 12 meses, sem média nem consenso calculado. **Pauta da semana** (v3.5): notícias de cada empresa da Carteira Oregon por pilar (Dividendos e Valor), com "Copiar pauta" para o deck. |
| **Mundo e Estratégia** | Notícias (imprensa internacional e bancos centrais); Research (últimos 7 dias, 8 a 30, ainda relevante 31 a 90, mapa de temas de gestão, temas em alta na semana e origem Brasil ou mundo, com a academia brasileira de finanças); Debate de mercado (opiniões publicadas, análises de colaboradores e consultas externas a Reddit e X, sem coleta); ETFs globais. |
| **Carteiras** | As 15 carteiras com pesos aprovados e validação (sem normalizar), mapa e Decidido × base. |
| **Biblioteca** | Pesquisa em tudo o que já foi coletado, mês a mês; resumos semanais; meus aprendizados; fontes e coleta (por fonte e por busca). v3.5: Resumo do mês por tema de gestão, buscas salvas com contador do que chegou desde a última visita e a **Estante**: acervo permanente de Mauboussin (1995 em diante), CFA Research Foundation, memos de Howard Marks, Damodaran, AQR, GMO e Compounding Quality, com busca por tema e década. |
| **VG VIP** (v3.5) | Aba separada para as carteiras VG VIP (Dividendos, Valor e Smallcaps, 35 ativos). Hoje VIP (mapa de atenção, radar, agenda das companhias e debate), Ativos (todas as colunas do print e a ficha de cada ativo com notícias, opiniões e casas de análise) e Pauta da semana por carteira. Números do print enviado pelo Lucas (`painel/src/vip.json`); as notícias dos ativos que só estão na VIP ficam em `ativos_vip`, fora das telas da Oregon. |

## Como funciona

```
robo/fontes.json + buscas de robo/config.json ──► robo/intel.py (GitHub Actions, a cada 30 min das 7h às 22h30, 7 dias por semana)
                      ├─ agenda oficial IBGE/Copom/Fed/Focus → data/macro.json (indicadores de mercado desligados)
                      ├─ buscas por ativo, setor e tema (RSS do Bing Notícias) e fatos relevantes da CVM
                      ├─ conteúdo: RSS/Atom/RDF, APIs públicas, páginas com PDF, sitemap, documento de URL fixa, YouTube (API oficial)
                      │    → classificação (temas, regiões, ativos, setores, fatores), vínculo com cada ativo (direto ou menção),
                      │      prioridade e leitura curta por regras
                      │    → IA opcional (teto diário) → biblioteca mensal + recentes.json + opiniões de 12 meses + research de 90 dias + coleta.json
                      ├─ opiniões conferidas de 12 meses (robo/sementes) · comentários de resultado do InvesTalk no endereço do trimestre
                      ├─ pesquisa ativo × fator para a janela de leitura (Bing Notícias) → biblioteca/pesquisas.json
                      ├─ v3.5: relatórios da Genial pela página de cada ação · alerta imediato no Telegram (fato relevante, opinião nova)
                      ├─ v3.5: Estante (sementes conferidas + listagens, sitemaps e feeds das séries) → biblioteca/estante.json
                      ├─ v3.5: ativos das carteiras VG VIP (painel/src/vip.json) → vínculos à parte (ativos_vip)
                      ├─ briefing do dia → data/hoje.json · resumo da semana → data/semanal.json
                      └─ ramo "dados" (histórico completo) e site (arquivos públicos) ──► painel (painel/src → site/index.html)
```

- **Fontes**: só conteúdo público e gratuito; `robots.txt` respeitado; nenhum paywall ou bloqueio contornado. O cadastro
  e as limitações de cada fonte estão em `robo/fontes.json` e `docs/FONTES.md`.
- **Opiniões** (v3.4): casa, analista, recomendação, preço-alvo e horizonte só quando escritos; sentido do título ou da
  página da casa; a janela mostra a visão anterior da mesma casa. Nenhum veículo do Grupo XP; opinião da XP noticiada por
  outro veículo aparece com a casa "XP". Nenhuma nota de risco, convicção ou impacto.
- **Leitura de uma notícia** (v3.3): título, fonte e data de publicação em destaque; o resumo da fonte quando existe; por
  que importa (só sinais verificáveis: documento à CVM, opinião publicada, resultado, outras fontes); relação com a
  carteira só quando há base, com o vínculo e os pesos aprovados; contrapontos só quando documentados (opinião de sentido
  oposto de outra casa); link original sempre à vista; "Aprofundar" recolhido. Com só a manchete, a janela diz isso e
  manda para a fonte — sem análise inventada. Rótulos: **Fonte** (texto publicado), **Verificado** (coleta, CVM,
  carteiras), **Sistema** (classificação automática). Nunca há conclusão de impacto nem recomendação de compra ou venda.
- **Vínculo com o ativo**: direto (o ativo é o assunto: notícia da empresa, resultado, documento à CVM, mudança de
  recomendação) ou menção de passagem (lista de dividendos, destaques do dia, citado só no resumo). Só o vínculo direto
  conta nos contadores e pesa na prioridade.
- **Sem IA continua útil**: a chave da Anthropic é opcional (`docs/IA.md`), desligada por padrão, com teto diário.
- **Nada some em silêncio**: itens sem prioridade continuam na Biblioteca; fonte que falha não apaga o que publicou;
  cada rodada registra por fonte o que chegou, foi rejeitado (e por quê), já estava na biblioteca, era novo e foi publicado.
- **Segurança**: nenhuma chave no site ou no código; chaves só em GitHub Secrets; o workflow não tem permissão por padrão.

## Pastas

- `robo/` — `intel.py` (orquestrador), `conteudo.py` (coletores), `biblioteca.py` (persistência, deduplicação, contadores),
  `analise.py` (taxonomia, vínculo com o ativo, opinião de casa, prioridade, leitura curta, IA opcional), `semanal.py` (briefing e resumo semanal),
  `casas.py` (comentários de resultado do InvesTalk), `pesquisas.py` (pesquisa ativo × fator), `sementes/` (opiniões conferidas de 12 meses), `fontes.json`,
  `config.json`; reaproveitados da v2: `fontes_macro.py`, `agenda.py`, `avisos.py`, `util.py`, `config.py`, `calendario.py`.
  `coletar.py` e os módulos de cotação continuam no repositório, mas não são agendados.
- `painel/src/` — `intel.js` (dados e vistas de conteúdo), `ui_hoje.js`, `ui_bib.js`, `ui_oregon.js` (Brasil e Mundo e Estratégia), `ui_mapa.js` (carteiras),
  `ui_mesa.js` (validação), `ui_teses.js`, `core.js`, `store.js`, `data.json`, `etfs.json`. `painel/arquivo/` guarda o que saiu.
- `testes/` — robô (internet simulada; `test_v34.py` também usa as opiniões reais conferidas e trechos reais das páginas das casas) e painel (Node). `painel/test/areas.js` percorre as cinco seções no navegador. `testes/amostras_reais/` guarda amostras reais (busca do Bing; notícias capturadas de empresa, menção em lista, documento da CVM e carta de gestora) usadas nos testes do robô e do painel.
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
