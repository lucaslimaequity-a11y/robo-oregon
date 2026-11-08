# Resultados dos testes · v3.3 · 08/11/2026 (Brasília)

Saída literal das execuções desta versão. O contêiner onde os testes rodaram não tem saída para a internet; as provas
com conteúdo real usam o que o robô já tinha publicado no site (rodada real de 08/11 10:17, 686 itens recentes e a
biblioteca de novembro), dito pelo nome em cada seção.

## 1. Publicação v3.3 sobre os dados REAIS já capturados

A etapa de publicação nova (`biblioteca.publicar_recentes` e `biblioteca.publicar_opinioes`) rodou sobre os dados reais
publicados às 10:17. Nada foi coletado de novo; os itens foram reclassificados com as regras atuais.

- Vínculo com os ativos nos 686 itens recentes: **147 diretos** e **6 menções de passagem**. Exemplos de menção:
  "Allied paga R$ 0,63 por ação; Santander, Klabin, Lavvi e outros completam dividendos da semana" (Klabin);
  "Axia (AXIA3), Prio (PRIO3), SmartFit (SMFT3) e outros destaques desta quinta-feira" (Axia e Prio);
  "Entra Itaú (ITUB4) e Axia Energia (AXIA3): 5 ações para bater o Ibovespa na semana" (Axia).
- Falsa opinião corrigida: "Lucro dos bancões cresce no 3T26 … Santander perde força, Bradesco desacelera e Itaú mantém
  a dianteira" deixou de ser "opinião de casa" (era o verbo "mantém") e virou notícia de resultado de Bradesco.
- `recentes.json`: de 1.405.388 para 729.037 bytes (a análise em sete pontos não é mais guardada em cada item): o celular
  baixa metade.
- `biblioteca/opinioes.json`: 12 opiniões de casas nos últimos 12 meses (o robô passou a reconhecer opiniões em novembro;
  o histórico cresce a cada rodada).

## 2. Janela de leitura: altura total, antes e depois (mesmos itens reais)

Medida com o navegador (computador 1440 × 900, celular 390 × 844). A tela do celular tem 844 px.

| Item | Computador antes | depois | Celular antes | depois |
|---|---|---|---|---|
| Opinião (Safra rebaixa Klabin) | 1534 px | 626 px | 2147 px | 786 px |
| Menção em lista (dividendos da semana) | 1599 px | 546 px | 2229 px | 706 px |
| Documento à CVM (Klabin) | 1378 px | 598 px | 1892 px | 730 px |
| Carta de gestora (Kinea) | 1703 px | 554 px | 2575 px | 663 px |
| Notícia de empresa (Klabin, SPE) | 1421 px | 626 px | 2025 px | 758 px |

## 3. Testes automáticos (portão do workflow: se algum falha, nada é publicado)

Amostras reais usadas pelos dois lados (robô e painel precisam classificar igual):
`testes/amostras_reais/leitura_vinculos_2026-11-08.json` — notícia de empresa, resultado, mudança de recomendação, menção
em lista de dividendos, menção em destaques do dia, opinião sobre o setor, medida que afeta empresas citadas, documento
da CVM, notícia do setor sem citar a empresa, duas cartas de gestora e a falsa opinião corrigida.

### Robô · 85 testes, todos ok

```
test_buscador_vedado_por_robots_para_sozinho (test_intel.TestBuscasPorAtivo.test_buscador_vedado_por_robots_para_sozinho) ... ok
test_fatos_relevantes_da_cvm_por_cnpj_e_nome (test_intel.TestBuscasPorAtivo.test_fatos_relevantes_da_cvm_por_cnpj_e_nome) ... ok
test_noticias_reais_por_empresa_com_desambiguacao (test_intel.TestBuscasPorAtivo.test_noticias_reais_por_empresa_com_desambiguacao) ... ok
test_opinioes_publicas_e_fonte_sinalizada (test_intel.TestBuscasPorAtivo.test_opinioes_publicas_e_fonte_sinalizada) ... ok
test_rodada_agendada_respeita_teto_de_buscas (test_intel.TestBuscasPorAtivo.test_rodada_agendada_respeita_teto_de_buscas) ... ok
test_sem_indicadores_macro_falha_do_bcb_nao_afeta_rodada (test_intel.TestBuscasPorAtivo.test_sem_indicadores_macro_falha_do_bcb_nao_afeta_rodada) ... ok
test_setor_e_tema_global (test_intel.TestBuscasPorAtivo.test_setor_e_tema_global) ... ok
test_agenda_usa_janela_de_30_dias (test_intel.TestImprensa.test_agenda_usa_janela_de_30_dias) ... ok
test_feed_tolerante_e_fuso_da_fonte (test_intel.TestImprensa.test_feed_tolerante_e_fuso_da_fonte) ... ok
test_fonte_a_validar_nao_marca_parcial (test_intel.TestImprensa.test_fonte_a_validar_nao_marca_parcial) ... ok
test_intervalo_por_fonte_e_leitura_manual_completa (test_intel.TestImprensa.test_intervalo_por_fonte_e_leitura_manual_completa) ... ok
test_noticia_do_mundo_liga_ao_tema_do_etf (test_intel.TestImprensa.test_noticia_do_mundo_liga_ao_tema_do_etf) ... ok
test_noticia_por_ativo_e_opiniao_de_casa (test_intel.TestImprensa.test_noticia_por_ativo_e_opiniao_de_casa) ... ok
test_mencao_em_lista_pesa_menos_que_fato_da_empresa (test_intel.TestLeituraEVinculo.test_mencao_em_lista_pesa_menos_que_fato_da_empresa) ... ok
test_reclassificacao_de_item_antigo_corrige_falsa_opiniao (test_intel.TestLeituraEVinculo.test_reclassificacao_de_item_antigo_corrige_falsa_opiniao) ... ok
test_vinculo_das_noticias_reais (test_intel.TestLeituraEVinculo.test_vinculo_das_noticias_reais) ... ok
test_detecta_publicacao_nova_e_edicao_atualizada (test_intel.TestRodada.test_detecta_publicacao_nova_e_edicao_atualizada) ... ok
test_duplicados_por_link_nao_viram_novos (test_intel.TestRodada.test_duplicados_por_link_nao_viram_novos) ... ok
test_falha_de_fonte_nao_apaga_historico (test_intel.TestRodada.test_falha_de_fonte_nao_apaga_historico) ... ok
test_macro_falha_reaproveita_sem_zerar (test_intel.TestRodada.test_macro_falha_reaproveita_sem_zerar) ... ok
test_persistencia_por_mes (test_intel.TestRodada.test_persistencia_por_mes) ... ok
test_publica_todos_os_arquivos_e_classifica (test_intel.TestRodada.test_publica_todos_os_arquivos_e_classifica) ... ok
test_sem_data_no_feed_usa_deteccao_marcada (test_intel.TestRodada.test_sem_data_no_feed_usa_deteccao_marcada) ... ok
test_cadastro_real_valido_e_publico (test_intel.TestSemanalEConfig.test_cadastro_real_valido_e_publico) ... ok
test_oregon_usa_ativos_das_carteiras (test_intel.TestSemanalEConfig.test_oregon_usa_ativos_das_carteiras) ... ok
test_resultados_cvm_na_rodada_manual_e_preservados_em_falha (test_intel.TestSemanalEConfig.test_resultados_cvm_na_rodada_manual_e_preservados_em_falha) ... ok
test_resumo_semanal (test_intel.TestSemanalEConfig.test_resumo_semanal) ... ok
test_robots_veda_e_nao_contorna (test_intel.TestYouTubeRobots.test_robots_veda_e_nao_contorna) ... ok
test_youtube_chave_invalida_vira_erro_de_autenticacao (test_intel.TestYouTubeRobots.test_youtube_chave_invalida_vira_erro_de_autenticacao) ... ok
test_youtube_com_chave_oficial (test_intel.TestYouTubeRobots.test_youtube_com_chave_oficial) ... ok
test_fora_do_fechamento_nao_gasta_cota (test_robo.TestAlphaVantage.test_fora_do_fechamento_nao_gasta_cota) ... ok
test_reserva_dos_etfs_no_fechamento_com_cota (test_robo.TestAlphaVantage.test_reserva_dos_etfs_no_fechamento_com_cota) ... ok
test_calendario_com_feriado (test_robo.TestB3.test_calendario_com_feriado) ... ok
test_leitura_do_layout_oficial (test_robo.TestB3.test_leitura_do_layout_oficial) ... ok
test_agenda_falha_do_ibge_nao_derruba (test_robo.TestBriefing.test_agenda_falha_do_ibge_nao_derruba) ... ok
test_agenda_ibge_copom_fed_e_focus (test_robo.TestBriefing.test_agenda_ibge_copom_fed_e_focus) ... ok
test_etf_nao_contamina_outras_manchetes_nem_empresa (test_robo.TestBriefing.test_etf_nao_contamina_outras_manchetes_nem_empresa) ... ok
test_noticias_de_indice_dos_etfs (test_robo.TestBriefing.test_noticias_de_indice_dos_etfs) ... ok
test_resultados_da_cvm (test_robo.TestBriefing.test_resultados_da_cvm) ... ok
test_resultados_escala_desconhecida_e_falha_parcial (test_robo.TestBriefing.test_resultados_escala_desconhecida_e_falha_parcial) ... ok
test_resultados_so_no_fechamento (test_robo.TestBriefing.test_resultados_so_no_fechamento) ... ok
test_validacao_dos_blocos_novos (test_robo.TestBriefing.test_validacao_dos_blocos_novos) ... ok
test_versao_para_o_site (test_robo.TestBriefing.test_versao_para_o_site) ... ok
test_tudo_fora_e_critico (test_robo.TestCenarioDoLog.test_tudo_fora_e_critico) ... ok
test_yahoo_bloqueado_sem_brapi (test_robo.TestCenarioDoLog.test_yahoo_bloqueado_sem_brapi) ... ok
test_agenda (test_robo.TestConfig.test_agenda) ... ok
test_config_atual_valida_e_migracao (test_robo.TestConfig.test_config_atual_valida_e_migracao) ... ok
test_config_do_repositorio_valida (test_robo.TestConfig.test_config_do_repositorio_valida) ... ok
test_config_invalida_e_critica_sem_apagar_dados (test_robo.TestConfig.test_config_invalida_e_critica_sem_apagar_dados) ... ok
test_dado_velho_vira_desatualizado_e_tenta_proxima_fonte (test_robo.TestCotacoes.test_dado_velho_vira_desatualizado_e_tenta_proxima_fonte) ... ok
test_fora_da_agenda_nao_publica (test_robo.TestCotacoes.test_fora_da_agenda_nao_publica) ... ok
test_reaproveita_ultimo_valido_como_desatualizado (test_robo.TestCotacoes.test_reaproveita_ultimo_valido_como_desatualizado) ... ok
test_tudo_respondendo_completo (test_robo.TestCotacoes.test_tudo_respondendo_completo) ... ok
test_variacao_anormal_suspeita (test_robo.TestCotacoes.test_variacao_anormal_suspeita) ... ok
test_yahoo_ticker_inexistente_nao_pausa_a_fonte (test_robo.TestCotacoes.test_yahoo_ticker_inexistente_nao_pausa_a_fonte) ... ok
test_diagnostico_por_ativo (test_robo.TestDiagnostico.test_diagnostico_por_ativo) ... ok
test_mantem_serie_anterior_quando_fonte_falha (test_robo.TestHistorico.test_mantem_serie_anterior_quando_fonte_falha) ... ok
test_preco_sem_ajuste_e_inicio_de_negociacao (test_robo.TestHistorico.test_preco_sem_ajuste_e_inicio_de_negociacao) ... ok
test_salto_marca_suspeita (test_robo.TestHistorico.test_salto_marca_suspeita) ... ok
test_sem_yahoo_usa_brapi (test_robo.TestHistorico.test_sem_yahoo_usa_brapi) ... ok
test_series_tipadas_e_fontes_registradas (test_robo.TestHistorico.test_series_tipadas_e_fontes_registradas) ... ok
test_classificacao (test_robo.TestNoticias.test_classificacao) ... ok
test_deduplicacao (test_robo.TestNoticias.test_deduplicacao) ... ok
test_desambiguacao (test_robo.TestNoticias.test_desambiguacao) ... ok
test_fontes_oficiais_e_filtros (test_robo.TestNoticiasNaRodada.test_fontes_oficiais_e_filtros) ... ok
test_rss_dos_veiculos (test_robo.TestRSS.test_rss_dos_veiculos) ... ok
test_erros_classificados_e_sem_url (test_robo.TestRede.test_erros_classificados_e_sem_url) ... ok
test_config_invalida_nao_renova_dados (test_robo.TestRevisao.test_config_invalida_nao_renova_dados) ... ok
test_resposta_fora_do_formato_nao_derruba_a_rodada (test_robo.TestRevisao.test_resposta_fora_do_formato_nao_derruba_a_rodada) ... ok
test_rss_link_inseguro_atom_e_sem_data (test_robo.TestRevisao.test_rss_link_inseguro_atom_e_sem_data) ... ok
test_sabado_nao_repete_fechamento_de_sexta (test_robo.TestRevisao.test_sabado_nao_repete_fechamento_de_sexta) ... ok
test_tesouro_reaproveitado_nao_herda_atualizado (test_robo.TestRevisao.test_tesouro_reaproveitado_nao_herda_atualizado) ... ok
test_validacao_das_regras_de_fonte (test_robo.TestRevisao.test_validacao_das_regras_de_fonte) ... ok
test_alerta_nao_repete (test_robo.TestTelegram.test_alerta_nao_repete) ... ok
test_chat_errado_mostra_motivo_e_falha_o_teste (test_robo.TestTelegram.test_chat_errado_mostra_motivo_e_falha_o_teste) ... ok
test_teste_entregue_e_sem_vazar_token (test_robo.TestTelegram.test_teste_entregue_e_sem_vazar_token) ... ok
Ran 85 tests in 8.904s
OK
```

### Painel (Node) · 29 testes + 25 dos modelos quantitativos

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
PASS Linhas de notícia: hora de publicação, separador de dia, data estimada e destaques sem sensacionalismo
PASS Vínculo com o ativo nas notícias reais capturadas (mesma regra do robô): direto × menção de passagem
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

29 de 29 testes do painel passaram; modelos quantitativos ok
```

### Percurso no navegador (computador 1440 e celular 390, dados de teste gerados pelo robô) · 102 verificações

```
PASS 1440 Hoje abre com as últimas notícias, cada uma com hora e veículo (12)
PASS 1440 topo mostra a última coleta e as notícias de 24 h
PASS 1440 Hoje mostra 5 a 8 leituras do dia (6)
PASS 1440 toda leitura abre a fonte original
PASS 1440 sem caixas de macro; agenda presente
PASS 1440 estudo do dia e leitura recomendada
PASS 1440 linha de notícia abre e fecha no lugar (ok)
PASS 1440 janela de leitura editorial, curta e com a fonte original (ok)
PASS 1440 aprendizado salvo neste navegador (1)
PASS 1440 fechar a janela volta ao ponto de leitura ({"dy":0,"foco":true})
PASS 1440 lista de dividendos é menção de passagem (mencao)
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
PASS 1440 ficha PETR4: notícias ao lado, opiniões de 12 meses, mudanças na tese primeiro ({"area":"brasil","semPreco":true,"painel":true,"aFavor":true,"doze":true,"busca":true,"aba":"tese","opiniaoCasa":true,"mudou":true,"velho":false})
PASS 1440 aba Fundamentos com a tese e o painel de notícias mantido
PASS 1440 ficha do ETF IMAB11 com painel de notícias (ok)
PASS 1440 Mundo e Estratégia mostra o que o mundo fala (3)
PASS 1440 ETF global abre em Mundo › ETFs globais com notícias do tema (mundo/etfs|true)
PASS 1440 busca rápida abre a ficha de PRIO3
PASS 1440 carteiras de referência (cresc-arr|mostra inválida|sem simulador)
PASS 1440 menu com cinco seções (5|cart)
PASS 1440 topo: cinco seções, busca e hora da coleta à vista ({"nav":true,"busca":true,"hora":true})
PASS 1440 Biblioteca com filtros avançados recolhidos
PASS 390 Hoje abre com as últimas notícias, cada uma com hora e veículo (12)
PASS 390 topo mostra a última coleta e as notícias de 24 h
PASS 390 Hoje mostra 5 a 8 leituras do dia (6)
PASS 390 toda leitura abre a fonte original
PASS 390 sem caixas de macro; agenda presente
PASS 390 estudo do dia e leitura recomendada
PASS 390 linha de notícia abre e fecha no lugar (ok)
PASS 390 janela de leitura editorial, curta e com a fonte original (ok)
PASS 390 aprendizado salvo neste navegador (1)
PASS 390 fechar a janela volta ao ponto de leitura ({"dy":0,"foco":true})
PASS 390 lista de dividendos é menção de passagem (mencao)
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
PASS 390 ficha PETR4: notícias ao lado, opiniões de 12 meses, mudanças na tese primeiro ({"area":"brasil","semPreco":true,"painel":true,"aFavor":true,"doze":true,"busca":true,"aba":"tese","opiniaoCasa":true,"mudou":true,"velho":false})
PASS 390 aba Fundamentos com a tese e o painel de notícias mantido
PASS 390 ficha do ETF IMAB11 com painel de notícias (ok)
PASS 390 Mundo e Estratégia mostra o que o mundo fala (3)
PASS 390 ETF global abre em Mundo › ETFs globais com notícias do tema (mundo/etfs|true)
PASS 390 busca rápida abre a ficha de PRIO3
PASS 390 carteiras de referência (cresc-arr|mostra inválida|sem simulador)
PASS 390 menu com cinco seções (5|cart)
PASS 390 topo: cinco seções, busca e hora da coleta à vista ({"nav":true,"busca":true,"hora":true})
PASS 390 Biblioteca com filtros avançados recolhidos
tudo ok
```

## O que só a primeira rodada no GitHub Actions prova

- Que as fontes novas "a validar" (Bloomberg, FT, The Economist, The Guardian, El País) respondem a partir dos servidores
  do GitHub; até lá, falha não marca a rodada. Onde conferir: Biblioteca → Fontes e coleta.
- Que `data/biblioteca/opinioes.json` é publicado (a pasta `biblioteca` já é copiada inteira pelo workflow).
- O número real de notícias diretas e menções por ativo por dia: topo do Hoje, coluna "7 d" do Brasil e o painel de cada ficha.
