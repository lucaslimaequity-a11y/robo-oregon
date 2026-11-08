# Resultados dos testes · v3.2 · 08/11/2026 (Brasília)

Saída literal das execuções desta versão. O contêiner onde os testes rodaram não tem saída para a internet; por isso há
três níveis de prova, cada um dito pelo nome.

## 1. Notícias reais: amostra do Bing Notícias lida hoje

Lida em 08/11/2026 entre 09:20 e 09:45 pela ferramenta de leitura web (que respeita robots.txt: o Google Notícias foi
recusado por robots; o Bing foi lido). Arquivo: `testes/amostras_reais/bing_2026-11-08.json` (títulos, datas, veículos e,
para Klabin e BB Seguridade, os links das matérias, como vieram).

| Busca | Lidas | Entraram | Descartadas (motivo) | Exemplos que entraram |
|---|---|---|---|---|
| Klabin | 11 | 9 | 2 homônimos ("estação Chácara Klabin", "Casa Museu Ema Klabin") | Valor: parceria florestal de R$ 1,2 bi; Money Times: **Safra corta preço-alvo e rebaixa** (opinião · contra) |
| BB Seguridade | 10 | 10 | — | O Petróleo: **bancos recomendam venda** (opinião · contra); Suno: **analistas veem riscos** (contra); InfoMoney com selo Grupo XP |
| Copel | 8 | 3 | 5 sem o nome da empresa (temporais no Paraná, "Pular para o conteúdo") | aRede, CGN, GMC Online |
| China stocks MSCI (en) | 4 | 4 | — | Barron's, Yahoo Finance, ZAWYA |

## 2. Rodada do robô novo sobre a biblioteca REAL publicada

O robô v3.2 rodou sobre o ramo `dados` do seu GitHub (rodada real de 08/11 08:58, 484 itens) mais as buscas reais acima.
As demais fontes responderam "sem internet" e apareceram como falha ou "a validar", como aconteceria com uma fonte fora do ar.

- Migração única: 168 itens sem data da primeira leitura viraram acervo (saíram do Hoje; continuam na Biblioteca).
- 22 notícias novas por ativo publicadas: KLBN4 9, BBSE3 10, CPLE3 3; a desambiguação descartou 7.
- Painel percorrido com esses dados (capturas em anexo): Hoje com a situação da coleta no topo; Brasil → Klabin com 9
  notícias ao lado, "Contra · 1" (Safra) e "Não há contraponto documentado"; BB Seguridade com 10 notícias, 2 opiniões
  contra e 2 itens com selo Grupo XP; ponto 4 da análise sem perguntas genéricas; celular sem rolagem horizontal; nenhum
  erro de JavaScript.

## 3. Testes automáticos (portão do workflow: se algum falha, nada é publicado)

### Robô · 80 testes, todos ok

```
test_intel · TestBuscasPorAtivo · test_buscador_vedado_por_robots_para_sozinho
test_intel · TestBuscasPorAtivo · test_fatos_relevantes_da_cvm_por_cnpj_e_nome
test_intel · TestBuscasPorAtivo · test_noticias_reais_por_empresa_com_desambiguacao
test_intel · TestBuscasPorAtivo · test_opinioes_publicas_e_fonte_sinalizada
test_intel · TestBuscasPorAtivo · test_rodada_agendada_respeita_teto_de_buscas
test_intel · TestBuscasPorAtivo · test_sem_indicadores_macro_falha_do_bcb_nao_afeta_rodada
test_intel · TestBuscasPorAtivo · test_setor_e_tema_global
test_intel · TestIA · test_chave_recusada_nao_derruba
test_intel · TestIA · test_com_chave_respeita_teto_e_rotulos
test_intel · TestIA · test_desligada_na_config_nao_chama_mesmo_com_chave
test_intel · TestIA · test_sem_chave_continua_util
test_intel · TestImprensa · test_agenda_usa_janela_de_30_dias
test_intel · TestImprensa · test_feed_tolerante_e_fuso_da_fonte
test_intel · TestImprensa · test_fonte_a_validar_nao_marca_parcial
test_intel · TestImprensa · test_intervalo_por_fonte_e_leitura_manual_completa
test_intel · TestImprensa · test_migracao_acervo_e_hoje_sem_cartas_antigas
test_intel · TestImprensa · test_noticia_do_mundo_liga_ao_tema_do_etf
test_intel · TestImprensa · test_noticia_por_ativo_e_opiniao_de_casa
test_intel · TestRodada · test_detecta_publicacao_nova_e_edicao_atualizada
test_intel · TestRodada · test_duplicados_por_link_nao_viram_novos
test_intel · TestRodada · test_falha_de_fonte_nao_apaga_historico
test_intel · TestRodada · test_macro_falha_reaproveita_sem_zerar
test_intel · TestRodada · test_persistencia_por_mes
test_intel · TestRodada · test_publica_todos_os_arquivos_e_classifica
test_intel · TestRodada · test_sem_data_no_feed_usa_deteccao_marcada
test_intel · TestSemanalEConfig · test_cadastro_real_valido_e_publico
test_intel · TestSemanalEConfig · test_fontes_invalidas_sao_criticas
test_intel · TestSemanalEConfig · test_oregon_usa_ativos_das_carteiras
test_intel · TestSemanalEConfig · test_resultados_cvm_na_rodada_manual_e_preservados_em_falha
test_intel · TestSemanalEConfig · test_resumo_semanal
test_intel · TestSemanalEConfig · test_workflow_publica_dados_e_nao_expoe_estado
test_intel · TestYouTubeRobots · test_robots_veda_e_nao_contorna
test_intel · TestYouTubeRobots · test_youtube_chave_invalida_vira_erro_de_autenticacao
test_intel · TestYouTubeRobots · test_youtube_com_chave_oficial
test_robo · TestAlphaVantage · test_fora_do_fechamento_nao_gasta_cota
test_robo · TestAlphaVantage · test_reserva_dos_etfs_no_fechamento_com_cota
test_robo · TestB3 · test_calendario_com_feriado
test_robo · TestB3 · test_leitura_do_layout_oficial
test_robo · TestBriefing · test_agenda_falha_do_ibge_nao_derruba
test_robo · TestBriefing · test_agenda_ibge_copom_fed_e_focus
test_robo · TestBriefing · test_etf_nao_contamina_outras_manchetes_nem_empresa
test_robo · TestBriefing · test_noticias_de_indice_dos_etfs
test_robo · TestBriefing · test_resultados_da_cvm
test_robo · TestBriefing · test_resultados_escala_desconhecida_e_falha_parcial
test_robo · TestBriefing · test_resultados_so_no_fechamento
test_robo · TestBriefing · test_validacao_dos_blocos_novos
test_robo · TestBriefing · test_versao_para_o_site
test_robo · TestCenarioDoLog · test_tudo_fora_e_critico
test_robo · TestCenarioDoLog · test_yahoo_bloqueado_sem_brapi
test_robo · TestConfig · test_agenda
test_robo · TestConfig · test_config_atual_valida_e_migracao
test_robo · TestConfig · test_config_do_repositorio_valida
test_robo · TestConfig · test_config_invalida_e_critica_sem_apagar_dados
test_robo · TestCotacoes · test_dado_velho_vira_desatualizado_e_tenta_proxima_fonte
test_robo · TestCotacoes · test_fora_da_agenda_nao_publica
test_robo · TestCotacoes · test_reaproveita_ultimo_valido_como_desatualizado
test_robo · TestCotacoes · test_tudo_respondendo_completo
test_robo · TestCotacoes · test_variacao_anormal_suspeita
test_robo · TestCotacoes · test_yahoo_ticker_inexistente_nao_pausa_a_fonte
test_robo · TestDiagnostico · test_diagnostico_por_ativo
test_robo · TestHistorico · test_mantem_serie_anterior_quando_fonte_falha
test_robo · TestHistorico · test_preco_sem_ajuste_e_inicio_de_negociacao
test_robo · TestHistorico · test_salto_marca_suspeita
test_robo · TestHistorico · test_sem_yahoo_usa_brapi
test_robo · TestHistorico · test_series_tipadas_e_fontes_registradas
test_robo · TestNoticias · test_classificacao
test_robo · TestNoticias · test_deduplicacao
test_robo · TestNoticias · test_desambiguacao
test_robo · TestNoticiasNaRodada · test_fontes_oficiais_e_filtros
test_robo · TestRSS · test_rss_dos_veiculos
test_robo · TestRede · test_erros_classificados_e_sem_url
test_robo · TestRevisao · test_config_invalida_nao_renova_dados
test_robo · TestRevisao · test_resposta_fora_do_formato_nao_derruba_a_rodada
test_robo · TestRevisao · test_rss_link_inseguro_atom_e_sem_data
test_robo · TestRevisao · test_sabado_nao_repete_fechamento_de_sexta
test_robo · TestRevisao · test_tesouro_reaproveitado_nao_herda_atualizado
test_robo · TestRevisao · test_validacao_das_regras_de_fonte
test_robo · TestTelegram · test_alerta_nao_repete
test_robo · TestTelegram · test_chat_errado_mostra_motivo_e_falha_o_teste
test_robo · TestTelegram · test_teste_entregue_e_sem_vazar_token
```

Novos nesta versão (`TestBuscasPorAtivo`): notícias reais por empresa com desambiguação; opiniões públicas e fonte
sinalizada; setor e tema global; teto de buscas por rodada (roda a fila sem repetir); buscador vedado por robots para
sozinho, sem nenhuma requisição; fatos relevantes da CVM conferidos por CNPJ e nome; sem indicadores macro, a falha do
BCB não afeta a rodada.

### Painel (Node)

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
PASS Notícias: hora relativa, últimas com filtros, notícias por ativo e opiniões a favor e contra
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

27 de 27 testes do painel passaram; modelos quantitativos ok
```

### Percurso no navegador (computador 1440 e celular 390, dados de teste gerados pelo robô)

```
PASS 1440 Hoje abre com as últimas notícias, cada uma com hora e veículo (12)
PASS 1440 topo mostra a última coleta e as notícias de 24 h
PASS 1440 Hoje mostra 5 a 8 leituras do dia (6)
PASS 1440 toda leitura abre a fonte original
PASS 1440 sem caixas de macro; agenda presente
PASS 1440 estudo do dia e leitura recomendada
PASS 1440 análise em sete pontos com rótulos e link original (ok)
PASS 1440 aprendizado salvo neste navegador (1)
PASS 1440 hoje → hoje/briefing
PASS 1440 brasil/ativos → brasil/ativos
PASS 1440 mundo/agora → mundo/agora
PASS 1440 mundo/cartas → mundo/cartas
PASS 1440 mundo/etfs → mundo/etfs
PASS 1440 cart/ref → cart/ref
PASS 1440 cart/mapa → cart/mapa
PASS 1440 cart/carteira → cart/carteira
PASS 1440 cart/perfis → cart/perfis
PASS 1440 bib/busca → bib/busca
PASS 1440 bib/semanal → bib/semanal
PASS 1440 bib/aprendizados → bib/aprendizados
PASS 1440 bib/fontes → bib/fontes
PASS 1440 oregon/ativos → brasil/ativos
PASS 1440 oregon/carteiras → cart/perfis
PASS 1440 oregon/setores → brasil/ativos
PASS 1440 res/empresas → brasil/ativos
PASS 1440 res/etfs → brasil/ativos
PASS 1440 res/eventos → hoje/briefing
PASS 1440 cart/risco → cart/perfis
PASS 1440 cart/construcao → cart/perfis
PASS 1440 global → mundo/agora
PASS 1440 sala/reuniao → cart/perfis
PASS 1440 mesa/mercado → hoje/briefing
PASS 1440 cons/editor → cart/perfis
PASS 1440 busca e filtro da Biblioteca ({"total":19,"q":1,"t":4,"back":19})
PASS 1440 itens de prioridade baixa visíveis na Biblioteca (6)
PASS 1440 mês anterior da biblioteca carrega sob demanda (ok)
PASS 1440 fontes e coleta por fonte (ok)
PASS 1440 resumo semanal (ok)
PASS 1440 ficha PETR4 com notícias ao lado, opinião a favor, busca e tese ({"area":"brasil","semPreco":true,"painel":true,"aFavor":true,"busca":true,"opiniaoCasa":true,"tese":true,"velho":false})
PASS 1440 ficha do ETF IMAB11 com painel de notícias (ok)
PASS 1440 Mundo e Estratégia mostra o que o mundo fala (3)
PASS 1440 ETF global abre em Mundo › ETFs globais com notícias do tema (mundo/etfs|true)
PASS 1440 busca rápida abre a ficha de PRIO3
PASS 1440 carteiras de referência (cresc-arr|mostra inválida|sem simulador)
PASS 1440 menu com cinco seções (5|cart)
PASS 390 Hoje abre com as últimas notícias, cada uma com hora e veículo (12)
PASS 390 topo mostra a última coleta e as notícias de 24 h
PASS 390 Hoje mostra 5 a 8 leituras do dia (6)
PASS 390 toda leitura abre a fonte original
PASS 390 sem caixas de macro; agenda presente
PASS 390 estudo do dia e leitura recomendada
PASS 390 análise em sete pontos com rótulos e link original (ok)
PASS 390 aprendizado salvo neste navegador (1)
PASS 390 hoje → hoje/briefing
PASS 390 brasil/ativos → brasil/ativos
PASS 390 mundo/agora → mundo/agora
PASS 390 mundo/cartas → mundo/cartas
PASS 390 mundo/etfs → mundo/etfs
PASS 390 cart/ref → cart/ref
PASS 390 cart/mapa → cart/mapa
PASS 390 cart/carteira → cart/carteira
PASS 390 cart/perfis → cart/perfis
PASS 390 bib/busca → bib/busca
PASS 390 bib/semanal → bib/semanal
PASS 390 bib/aprendizados → bib/aprendizados
PASS 390 bib/fontes → bib/fontes
PASS 390 oregon/ativos → brasil/ativos
PASS 390 oregon/carteiras → cart/perfis
PASS 390 oregon/setores → brasil/ativos
PASS 390 res/empresas → brasil/ativos
PASS 390 res/etfs → brasil/ativos
PASS 390 res/eventos → hoje/briefing
PASS 390 cart/risco → cart/perfis
PASS 390 cart/construcao → cart/perfis
PASS 390 global → mundo/agora
PASS 390 sala/reuniao → cart/perfis
PASS 390 mesa/mercado → hoje/briefing
PASS 390 cons/editor → cart/perfis
PASS 390 busca e filtro da Biblioteca ({"total":19,"q":1,"t":4,"back":19})
PASS 390 itens de prioridade baixa visíveis na Biblioteca (6)
PASS 390 mês anterior da biblioteca carrega sob demanda (ok)
PASS 390 fontes e coleta por fonte (ok)
PASS 390 resumo semanal (ok)
PASS 390 ficha PETR4 com notícias ao lado, opinião a favor, busca e tese ({"area":"brasil","semPreco":true,"painel":true,"aFavor":true,"busca":true,"opiniaoCasa":true,"tese":true,"velho":false})
PASS 390 ficha do ETF IMAB11 com painel de notícias (ok)
PASS 390 Mundo e Estratégia mostra o que o mundo fala (3)
PASS 390 ETF global abre em Mundo › ETFs globais com notícias do tema (mundo/etfs|true)
PASS 390 busca rápida abre a ficha de PRIO3
PASS 390 carteiras de referência (cresc-arr|mostra inválida|sem simulador)
PASS 390 menu com cinco seções (5|cart)
tudo ok
```

## O que só a primeira rodada no GitHub Actions prova

- Que o Bing responde às buscas a partir dos servidores do GitHub (no teste de hoje respondeu à ferramenta de leitura web).
- Que os portais "a validar" (Folha, g1, Estadão, E-Investidor, CNN Brasil, CNBC) respondem; até lá, falha não marca a rodada.
- Que o arquivo IPE da CVM baixa no tempo da rodada.
- O número real de notícias por ativo por dia. Onde conferir: Biblioteca → Fontes e coleta (por fonte e por busca) e o
  topo do Hoje.
