# Oregon Intelligence

Central de research e formação continuada para quem gere carteiras. Reúne, organiza, interpreta e liga à carteira
Oregon o conteúdo público de gestoras, instituições e canais oficiais. **Não é** terminal de cotações, plataforma de
trading nem simulador: cotações, câmbio ao vivo, mini gráficos de preço, cenários e laboratório de propostas foram
arquivados (`painel/arquivo/`) e saíram da navegação.

Site público (GitHub Pages): `https://lucaslimaequity-a11y.github.io/robo-oregon/`

## As seis seções

| Seção | O que tem |
|---|---|
| **Hoje** | Data, última coleta e o que chegou desde a sua última visita. v3.7: faixa do dia, alertas das buscas salvas, fila de leitura, áreas em duas colunas (no celular, recolhíveis), marca por tipo de notícia (F, R, O, C, E, N) e filtro por tipo de evento (recompra, M&A, guidance, gestão, dívida, oferta). Mapa de atenção da carteira (acontecimentos por ativo em 7 dias). Quatro áreas: **Radar das teses** (empresas acompanhadas, separando fato da empresa, opinião publicada, notícia e hipótese de setor), **Agenda decisiva** (temporada de resultados na CVM, documentos das companhias, agenda oficial), **Research global** e **Debate de mercado**. Profundidade rápida, briefing ou aprofundada. Sem cotações, Tesouro, dólar ou IPCA.  v3.10: **Mercado hoje · Brasil** (agenda do dia, juros, inflação, câmbio, bolsa, fiscal e atividade das últimas 18 h, em todos os modos) e filtro "Macro Brasil". |
| **Brasil** | Ativos das 15 carteiras pela notícia direta mais recente. Na ficha, ao lado: notícias em que o ativo é o assunto, opiniões publicadas (12 meses, com recomendação e preço-alvo quando escritos), documentos à CVM, setor e cadeia e menções incidentais. No centro, em abas: Mudanças na tese, Eventos e RI, Fundamentos, Setor e pares e (v3.5) **Casas de análise**: o que cada casa diz hoje e o preço-alvo de cada uma ao longo de 12 meses, sem média nem consenso calculado. **Pauta da semana** (v3.5): notícias de cada empresa da Carteira Oregon por pilar (Dividendos e Valor), com "Copiar pauta" para o deck. v3.6: **Agenda de proventos** (B3: data-com à frente, pagamentos a receber e DY do ano pelo preço de referência), **Quem tem a ação** (fundos e gestoras pela carteira mensal entregue à CVM), **Termômetro das cartas** (empresas citadas nas cartas das gestoras, mês a mês) e, na ficha, **Lente global** do setor com os pares no mundo e a ponte Oregon e VIP. v3.7: **Mudanças de recomendação** (a mesma casa contra a visão anterior) e trechos literais das cartas com a grade empresa × mês. v3.8: **Fluxo dos fundos** (captação menos resgate por classe, CVM, semana a semana). |
| **Mundo e Estratégia** | Notícias (imprensa internacional e bancos centrais); Research (últimos 7 dias, 8 a 30, ainda relevante 31 a 90, mapa de temas de gestão, temas em alta na semana e origem Brasil ou mundo, com a academia brasileira de finanças); Debate de mercado (opiniões publicadas, análises de colaboradores e consultas externas a Reddit e X, sem coleta); ETFs globais; (v3.6) **Wealth e consultorias**: indústria de wealth, consultoria e planejamento financeiro, com a regulação da CVM. |
| **Carteiras** | As 15 carteiras com pesos aprovados e validação (sem normalizar), mapa e Decidido × base. v3.6: **Comitê do mês**: pauta por seção (macro, Dividendos, Valor, fundos, global, riscos, estudos) com "Levar ao comitê" em qualquer notícia, sugestões do robô, item à mão e "Copiar pauta". v3.7: **Fechamento da semana** (oito blocos, Copiar e Imprimir). |
| **Biblioteca** | Pesquisa em tudo o que já foi coletado, mês a mês; resumos semanais; meus aprendizados; fontes e coleta (por fonte e por busca). v3.5: Resumo do mês por tema de gestão, buscas salvas com contador do que chegou desde a última visita e a **Estante**: acervo permanente de Mauboussin (1995 em diante), CFA Research Foundation, memos de Howard Marks, Damodaran, AQR, GMO e Compounding Quality, com busca por tema e década. v3.6: **Trilha de estudo** (CFP e CFA nível III, módulo a módulo) e quatro acervos de alocação e wealth na Estante (Thinking Ahead Institute, NBIM, CAIA, Vanguard); no Hoje, o **clássico da semana**. v3.9: **Inglês** (Inglês do dia com manchetes coletadas, ouvir e repetir em voz alta, glossário do mercado, Meu vocabulário com revisão e exportação para o Anki, podcasts curtos). |
| **VG VIP** (v3.5) | Aba separada para as carteiras VG VIP (Dividendos, Valor e Smallcaps, 35 ativos). Hoje VIP (mapa de atenção, radar, agenda das companhias e debate), Ativos (todas as colunas do print e a ficha de cada ativo com notícias, opiniões e casas de análise) e Pauta da semana por carteira. Números do print enviado pelo Lucas (`painel/src/vip.json`); as notícias dos ativos que só estão na VIP ficam em `ativos_vip`, fora das telas da Oregon. |

## Como funciona

```
robo/fontes.json + buscas de robo/config.json ──► robo/intel.py (GitHub Actions, aos 7 e 37 min de cada hora das 7h às 22h37, 7 dias por semana)
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
                      ├─ v3.6: cartas das gestoras (PDF ou página) → biblioteca/cartas_mencoes.json · proventos da B3 → biblioteca/proventos.json
                      ├─ v3.6: carteira mensal dos fundos (CVM, CDA) → biblioteca/fundos_acoes.json · clássico da semana → biblioteca/estante_destaque.json
                      ├─ v3.8: informe diário da CVM → biblioteca/fluxo_fundos.json · fonte que falha 3 vezes seguidas: 1 tentativa por dia
                      ├─ v3.9: frase do dia em inglês no Telegram (manchete coletada + robo/glossario_en.json); no painel, Biblioteca › Inglês
                      ├─ v3.6: lente global por setor (16 pesquisas em inglês) e indústria de wealth (fontes e pesquisas)
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
  `estante.py` (v3.5), `cartas.py` + `pdftexto.py` (v3.6: termômetro das cartas e leitor de PDF próprio), `proventos.py` (v3.6, B3), `fundos.py` (v3.6, CVM), `fluxo.py` (v3.8, CVM), `ingles.py` + `glossario_en.json` (v3.9, glossário e frase do dia),
  `config.json`; reaproveitados da v2: `fontes_macro.py`, `agenda.py`, `avisos.py`, `util.py`, `config.py`, `calendario.py`.
  `coletar.py` e os módulos de cotação continuam no repositório, mas não são agendados.
  v4.1: `empresas.py` (O que o mercado está falando: empresas mais citadas, pelo código e pelo nome, e macro do Brasil; publica `biblioteca/empresas.json`).
  v4.0.1: `assuntos.py` + `assuntos.json` (Assuntos do momento: contagem por palavras no título, lista conferível; publica `biblioteca/assuntos.json`).
  v3.11: `corrente.py` (corrente de rodadas: cada rodada dispara a seguinte, 15 min de dia e 30 min de madrugada, porque o agendador do GitHub descarta horários; desligável em `intel.corrente`).
- `painel/src/` — `intel.js` (dados e vistas de conteúdo), `ui_hoje.js`, `ui_bib.js`, `ui_oregon.js` (Brasil e Mundo e Estratégia), `ui_mapa.js` (carteiras),
  `ui_mesa.js` (validação), `ui_teses.js`, `core.js`, `store.js`, `data.json`, `etfs.json`; `ui_vip.js` (v3.5); v3.6: `ui_comite.js` (Comitê do mês),
  `ui_br36.js` (proventos, quem tem a ação, termômetro das cartas), `ui_estudo36.js` (wealth, trilha, clássico da semana), `ui_v37.js` e `ui_v38.js` (fluxo dos fundos); v3.11: `ui_v311.js` (próxima coleta pela corrente e o Atualizar trazendo o painel novo, comparando com `site/painel.json`). v4.0: `ui_v4.js` + `v4.css` (visual novo: menu lateral, cores e letras da Oregon; "Voltar ao visual antigo" a um toque). v4.0.1: `ui_v401.js` (Assuntos do momento no Hoje, filtro do Hoje por assunto ou ativo, busca com atalhos, juros/inflação/fiscal na ficha dos ETFs de renda fixa). v4.1: `ui_v41.js` (O que o mercado está falando em Brasil, cabeçalho e índice da ficha, tabelas, Mundo com regiões, cores da Oregon em Carteiras, carregamento). `painel/arquivo/` guarda o que saiu.
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
