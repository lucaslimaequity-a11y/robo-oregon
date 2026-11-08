# Resultados dos testes · v3 · 08/11/2026 08:40 (Brasília)

Ambiente: Python 3.13.18, Node v22.23.4, Chromium (Playwright). Internet simulada (testes/simulador.py): nenhum número é real.

## Robô · Oregon Intelligence (testes/test_intel.py)
```
test_chave_recusada_nao_derruba ... ok
test_com_chave_respeita_teto_e_rotulos ... ok
test_desligada_na_config_nao_chama_mesmo_com_chave ... ok
test_sem_chave_continua_util ... ok
test_detecta_publicacao_nova_e_edicao_atualizada ... ok
test_duplicados_por_link_nao_viram_novos ... ok
test_falha_de_fonte_nao_apaga_historico ... ok
test_macro_falha_reaproveita_sem_zerar ... ok
test_persistencia_por_mes ... ok
test_publica_todos_os_arquivos_e_classifica ... ok
test_sem_data_no_feed_usa_deteccao_marcada ... ok
test_cadastro_real_valido_e_publico ... ok
test_fontes_invalidas_sao_criticas ... ok
test_oregon_usa_ativos_das_carteiras ... ok
test_resultados_cvm_na_rodada_manual_e_preservados_em_falha ... ok
test_resumo_semanal ... ok
test_workflow_publica_dados_e_nao_expoe_estado ... ok
test_robots_veda_e_nao_contorna ... ok
test_youtube_chave_invalida_vira_erro_de_autenticacao ... ok
test_youtube_com_chave_oficial ... ok
Ran 20 tests in 1.262s
OK
```

## Robô · suíte completa (portão do workflow)
```
Ran 66 tests in 10.187s

OK
```

## Painel (Node)
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
PASS ETFs: as 27 fichas têm fonte oficial e o cadastro divergente aparece, sem alterar o cadastro
PASS Consistência das carteiras aprovadas: 10 inválidas, pesos preservados como decididos (sem normalizar)
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

26 de 26 testes do painel passaram; modelos quantitativos ok
```

## Percurso no navegador (computador 1440 e celular 390, dados de teste gerados pelo robô)
```
PASS 1440 Hoje mostra 5 a 8 prioridades (8)
PASS 1440 toda prioridade abre a fonte original
PASS 1440 macro e agenda presentes
PASS 1440 estudo do dia e leitura recomendada
PASS 1440 análise em sete pontos com rótulos e link original (ok)
PASS 1440 aprendizado salvo neste navegador (1)
PASS 1440 hoje → hoje/briefing
PASS 1440 bib/busca → bib/busca
PASS 1440 bib/semanal → bib/semanal
PASS 1440 bib/aprendizados → bib/aprendizados
PASS 1440 bib/fontes → bib/fontes
PASS 1440 oregon/ativos → oregon/ativos
PASS 1440 oregon/carteiras → oregon/carteiras
PASS 1440 oregon/setores → oregon/setores
PASS 1440 cart/ref → oregon/carteiras
PASS 1440 cart/mapa → oregon/carteiras
PASS 1440 cart/carteira → oregon/carteiras
PASS 1440 cart/perfis → oregon/carteiras
PASS 1440 res/empresas → oregon/ativos
PASS 1440 res/etfs → oregon/ativos
PASS 1440 res/eventos → bib/busca
PASS 1440 cart/risco → oregon/carteiras
PASS 1440 cart/construcao → oregon/carteiras
PASS 1440 global → bib/busca
PASS 1440 sala/reuniao → oregon/carteiras
PASS 1440 mesa/mercado → hoje/briefing
PASS 1440 cons/editor → oregon/carteiras
PASS 1440 busca e filtro da Biblioteca ({"total":13,"q":1,"t":2,"back":13})
PASS 1440 itens de prioridade baixa visíveis na Biblioteca (2)
PASS 1440 mês anterior da biblioteca carrega sob demanda (ok)
PASS 1440 fontes e coleta por fonte (ok)
PASS 1440 resumo semanal (ok)
PASS 1440 ficha PETR4 sem cotação, com conteúdo e tese ({"semPreco":true,"conteudo":true,"opiniao":true,"tese":true})
PASS 1440 ficha do ETF IMAB11 (ok)
PASS 1440 busca rápida abre a ficha de PRIO3
PASS 1440 carteiras de referência (cresc-arr|mostra inválida|sem simulador)
PASS 1440 menu com três seções (3|oregon)
PASS 390 Hoje mostra 5 a 8 prioridades (8)
PASS 390 toda prioridade abre a fonte original
PASS 390 macro e agenda presentes
PASS 390 estudo do dia e leitura recomendada
PASS 390 análise em sete pontos com rótulos e link original (ok)
PASS 390 aprendizado salvo neste navegador (1)
PASS 390 hoje → hoje/briefing
PASS 390 bib/busca → bib/busca
PASS 390 bib/semanal → bib/semanal
PASS 390 bib/aprendizados → bib/aprendizados
PASS 390 bib/fontes → bib/fontes
PASS 390 oregon/ativos → oregon/ativos
PASS 390 oregon/carteiras → oregon/carteiras
PASS 390 oregon/setores → oregon/setores
PASS 390 cart/ref → oregon/carteiras
PASS 390 cart/mapa → oregon/carteiras
PASS 390 cart/carteira → oregon/carteiras
PASS 390 cart/perfis → oregon/carteiras
PASS 390 res/empresas → oregon/ativos
PASS 390 res/etfs → oregon/ativos
PASS 390 res/eventos → bib/busca
PASS 390 cart/risco → oregon/carteiras
PASS 390 cart/construcao → oregon/carteiras
PASS 390 global → bib/busca
PASS 390 sala/reuniao → oregon/carteiras
PASS 390 mesa/mercado → hoje/briefing
PASS 390 cons/editor → oregon/carteiras
PASS 390 busca e filtro da Biblioteca ({"total":13,"q":1,"t":2,"back":13})
PASS 390 itens de prioridade baixa visíveis na Biblioteca (2)
PASS 390 mês anterior da biblioteca carrega sob demanda (ok)
PASS 390 fontes e coleta por fonte (ok)
PASS 390 resumo semanal (ok)
PASS 390 ficha PETR4 sem cotação, com conteúdo e tese ({"semPreco":true,"conteudo":true,"opiniao":true,"tese":true})
PASS 390 ficha do ETF IMAB11 (ok)
PASS 390 busca rápida abre a ficha de PRIO3
PASS 390 carteiras de referência (cresc-arr|mostra inválida|sem simulador)
PASS 390 menu com três seções (3|oregon)
tudo ok
```

## O que depende da primeira execução real no GitHub Actions

- Leitura ao vivo de cada fonte cadastrada (a rede do ambiente de desenvolvimento não alcança os sites): o Summary da rodada e Biblioteca → Fontes e coleta mostram, por fonte, recebidos/rejeitados/novos/erro.
- Publicação no GitHub Pages pelo workflow novo (o arquivo precisa ser colado em .github/workflows/robo.yml, ver docs/ATUALIZACAO.md).
- Telegram, YouTube (API) e IA, se as chaves forem cadastradas nos Secrets.
