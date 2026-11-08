# Auditoria do robô: causas comprovadas e correções da versão 2

## O que o log mostrava e por quê

| Sintoma no log | Causa comprovada | Correção na v2 |
|---|---|---|
| LFTB11, IRFM11, 5PRE11, IDKA11 e B5P211 falham; "disjuntor" após 4 falhas | O Yahoo responde **429** (limite de pedidos) para os servidores do GitHub. Na v1, o disjuntor era global: depois de 4 falhas seguidas o Yahoo era desligado para a rodada inteira. Os 5 ETFs eram simplesmente os primeiros da lista. Não havia ticker errado. | O erro de cada pedido é tipado: limite, bloqueio, autenticação, não encontrado, vazio, formato, tempo. A espera cresce (1, 2, 4 s) e respeita o `Retry-After`. A fonte só pausa depois de 3 falhas da própria fonte; "ativo não encontrado" não pausa nada. Cada ativo tenta as fontes na ordem da configuração (Yahoo, depois brapi) e registra a fonte efetivamente usada. |
| 1 de 54 cotações, e a rodada aparece como saudável | A v1 não media cobertura. | Relatório de cobertura: total, atualizadas, desatualizadas, suspeitas, indisponíveis e falhas por fornecedor. A rodada termina **completa** (90% ou mais), **parcial** ou **crítica** (abaixo de 50%, configuração inválida, ou Banco Central fora com cotações incompletas). A crítica falha a execução no GitHub, que manda e-mail ao dono, e aparece no painel. |
| Só 7 séries históricas | As séries vinham só do Yahoo, que estava bloqueado. | Cada série vem de uma única fonte, escolhida pela ordem da configuração. O tipo fica registrado: ajustado (retorno total), preço sem ajuste, nível ou taxa. Saltos fora do normal são marcados, e os pontos anteriores ao início de negociação são descartados. Se a fonte falha, a série anterior é mantida e marcada como desatualizada. |
| Falhas na AwesomeAPI | A AwesomeAPI passou a exigir chave (cabeçalho `x-api-key`; grátis com cadastro). | Chave opcional `AWESOMEAPI_KEY`. Sem ela, o dólar cai para o Yahoo e depois para a PTAX do Banco Central, marcada como fechamento. |
| Telegram HTTP 400 | O robô descartava a descrição do erro. Em 400, o motivo típico é `chat not found`: TELEGRAM_CHAT_ID errado, ou o robô ainda sem conversa iniciada. | Antes de enviar, o robô confere o token (getMe) e registra a descrição real do Telegram com a dica de correção, sem nunca mostrar o token. Há o modo `teste_telegram` (Actions → Run workflow), que falha a execução se a mensagem não chegar. |
| 73 manchetes, várias irrelevantes | A busca era só por palavra, sem filtro: "PRIO" também pegava "prioridade". | Desambiguação por termos e exclusões. Releases do IBGE e documentos da CVM (cruzando CNPJ e nome). RSS dos veículos. Duplicatas juntadas. Classificação por regras: fonte oficial, categoria do fato, risco da tese tocado, ruído e "só preço". O painel mostra média e alta relevância por padrão. |
| Sem ANTHROPIC_API_KEY | A chave é opcional. | Nada depende de IA paga. A leitura por IA é um extra com a chave nos Secrets. |

## Confirmação independente dos 5 ETFs (Mais Retorno, 07/11/2026)

Consultei a Mais Retorno pelo conector do Claude. Os cinco códigos existem, estão "em negociação" e têm fechamento em todos os pregões de 27/10 a 06/11/2026. Isso confirma que a falha do log era bloqueio do Yahoo, e não ticker errado ou trocado.

| Ticker | Nome registrado | Início | Fechamento em 06/11/2026 (sem ajuste) |
|---|---|---|---|
| LFTB11 | Investo ETF MarketVector Brazil Treasury 760 Day Target Duration (ISIN BRLFTBCTF002) | 05/11/2024 | R$ 128,66 |
| IRFM11 | It Now IRF-M P2 | — | R$ 105,00 |
| 5PRE11 | It Now Teva ITBR Pré 5 Anos | — | R$ 51,13 |
| IDKA11 | It Now IRF-M P3 (ISIN BRIDKACTF004) | 30/10/2024 | R$ 61,57 |
| B5P211 | It Now IMA-B5 P2 | — | R$ 114,31 |

**Dois nomes para conferir (não alterei nada):**
- **LFTB11.** O painel chama de "ETF de Tesouro Selic", e o nome registrado é um índice de títulos públicos com duration-alvo de 760 dias. O código sugere LFT (Tesouro Selic). Confirme o índice no regulamento antes de manter o ETF no P1 Liquidez.
- **IDKA11.** O painel diz "índice IDkA", e o registro é IRF-M P3. A exposição é parecida (prefixado de cerca de 3 anos), mas o índice é outro.

As datas de início batem com o campo `inicio` de `robo/config.json`.

## Revisão durante a integração (07/11/2026)

- **B3.** A primeira versão da v2 usava os arquivos de cotações históricas da B3 (COTAHIST) como reserva oficial. A página da B3 informa que "é expressamente vedada a coleta automatizada" para quaisquer finalidades. O download automático foi **desligado**, e o modo diagnóstico também não consulta a B3. Consequência honesta: sem o Yahoo e sem a chave da brapi, os ETFs de renda fixa ficam **indisponíveis**, com o motivo, e nunca aparecem com valor inventado. Para ter cobertura quando o Yahoo bloquear, configure a `BRAPI_TOKEN` e a `ALPHAVANTAGE_KEY`, que é grátis e serve de reserva de fechamento dos ETFs (ver `docs/FONTES.md`).
- **FRED.** As séries com direitos reservados (S&P 500, ICE BofA, VIX) foram retiradas, porque o site é público.

## Revisão independente do código (07/11/2026)

Um revisor que não escreveu o código procurou defeitos contra as regras do projeto. O que ele encontrou foi corrigido e ganhou teste:

- **Dados velhos marcados como atualizados.**
  - Taxas do Tesouro reaproveitadas de rodadas anteriores herdavam "atualizado". Agora o estado é recalculado.
  - Com a configuração inválida, os dados antigos eram republicados com data nova. Agora mantêm a data da última coleta válida e ficam marcados como desatualizados.
- **"Carteiras na sessão".** O número era mostrado como variação da carteira mesmo sem cotação de parte dela. Agora aparece como contribuição em pontos percentuais das posições cotadas, com a cobertura ao lado.
- **Dólar ao vivo no navegador.** Podia substituir um dado do robô em conferência e, sem data, recebia a data de hoje. Agora não substitui e não inventa data.
- **Link de notícia.** Um link que não começasse por http(s) poderia virar endereço clicável. Agora só http(s) passa, no robô e no painel.
- **Publicação.** Uma falha momentânea ao buscar o ramo `dados` era tratada como primeira rodada, e os dados guardados seriam apagados. Agora a rodada para com erro e nada é sobrescrito.
- **Respostas fora do formato.** Uma resposta inesperada de uma fonte derrubava a rodada inteira. Agora vira "formato" naquela fonte, e o resto segue.
- **Outros.**
  - O painel deixou de buscar notícias em laço quando o arquivo falta.
  - A sessão de referência segue o Ibovespa.
  - Série histórica mantida respeita o início de negociação.
  - RSS em formato Atom é lido.
  - Item sem data não vira notícia de hoje.
  - O sábado não repete o fechamento de sexta.
  - O diagnóstico cabe no tempo do job.
  - A validação recusa séries com direitos reservados e `"ativo": "false"` entre aspas.

**Ficou como está, por decisão consciente:**
- `estado.json` (controle de alertas enviados) fica no ramo `dados`, que é público junto com o repositório. Não há dado sensível nele.
- O S&P 500 continua vindo do Yahoo. Vale a ressalva geral sobre o Yahoo em `docs/FONTES.md`.

## Revisão independente da revisão de UX (07/11/2026)

Outro revisor, que não escreveu o código, procurou defeitos contra as regras do projeto. Tudo o que ele achou foi corrigido. O que mexia com dado ganhou teste.

**Regras de dado**
- **Notícia de ETF espalhada.** Uma manchete de um tema de ETF podia levar os ETFs de outro tema na deduplicação. Agora cada manchete tem a sua lista.
- **Notícia de empresa marcada como "do índice".** Uma notícia de empresa podia virar notícia do índice de um ETF. Agora a empresa vem sempre primeiro, e notícia de empresa nunca recebe ETF.
- **Lucro e margem da CVM.**
  - O lucro mostrado é o atribuído aos controladores. Sem essa linha, aparece o consolidado, com o nome escrito.
  - A variação contra o ano anterior não é calculada quando um dos trimestres teve prejuízo.
  - A margem só aparece quando a conta 3.01 é receita de vendas. Bancos, seguradoras e holdings ficam sem margem.
- **Escala.** Um arquivo da CVM com escala desconhecida é recusado, sem publicar número mil vezes menor.
- **Falha parcial da CVM.** Ela não apaga o que já estava lido. A ficha avisa que pode faltar o trimestre mais recente, e o robô tenta de novo na próxima rodada de fechamento.
- **Rótulo da versão.** O nome da versão na tela de referência vem da versão vigente, e não de um texto fixo.

**Defeitos**
- **Atualização automática.** O que você digitou e ainda não salvou na opinião da casa não se perde quando a tela é atualizada. A tela também avisa que há alterações não salvas.
- **Exercício.** A resposta é gravada enquanto você digita.
- **Resultado na ficha rápida.** Ele aparece sem precisar reabrir a ficha.
- **Classificação de notícias.** "Tesouro" deixou de cair em Commodities, e "Banco Safra" também. A seleção do dia não altera mais as notícias guardadas.
- **CVM e rodada de fechamento.** A leitura da CVM foi para o fim da rodada de fechamento, com prazo próprio, e não atrasa mais alertas, Telegram e histórico.
- **Datas provisórias.** As datas de 2027 do Fed aparecem como previstas, porque o próprio Fed as chama de provisórias.

## Diagnóstico por ativo (para confirmar no GitHub)

Actions → Robô de mercado Oregon → Run workflow → modo **diagnostico**. Para cada ativo, o robô testa o Yahoo com e sem `.SA`, a brapi (se houver chave) e a Tiingo, uma por uma, sem pausa. O resultado aparece no resumo da execução e em `data/diagnostico.json`. É assim que se confirma, com a rede do GitHub, se algum ticker mudou ou só está bloqueado.

## Testes

- `python -m unittest discover -s testes`: 46 testes do robô, com a internet simulada (`testes/simulador.py`). Nenhum número dos testes é real. Cobrem:
  - o cenário do seu log (Yahoo 429, sem brapi, AwesomeAPI 401);
  - tudo fora (resultado crítico);
  - tudo ok (resultado completo);
  - dado velho, que tenta a próxima fonte;
  - anomalia, que vira cotação suspeita;
  - reaproveitamento do último valor válido, marcado;
  - ticker inexistente, que não pausa a fonte;
  - agenda (fechamento tolerante a atraso, sábado);
  - arquivo da B3 (só leitura do formato);
  - séries tipadas e início de negociação;
  - notícias (desambiguação, deduplicação, CVM, RSS sem texto);
  - Alpha Vantage como reserva (respeita a cota diária, só no fechamento, sem vazar a chave);
  - Telegram (entrega, chat errado, sem vazar o token, sem repetir alerta);
  - configuração inválida (crítica, sem apagar dados, avisa no Telegram uma vez por dia);
  - modo diagnóstico;
  - classificação de erros de rede;
  - resultados da CVM: só a linha de 3 meses, escala em milhares convertida, versão reapresentada substitui a original, nome conferido junto com o CNPJ, fundos imobiliários e BDRs fora, só na rodada de fechamento;
  - agenda: produto fora da lista não entra, data quebrada não vira data, IBGE uma vez por dia, falha do IBGE não derruba a rodada, horário do Fed convertido para Brasília;
  - notícias de índice dos ETFs marcadas como "não sobre o fundo";
  - arquivo de versão pequeno para o site;
  - validação dos blocos novos da configuração.
- `node testes/painel.test.js`: 28 testes do painel. Cobrem a validação das 15 carteiras, o motor de cenários, os modelos quantitativos, o mercado no formato v2 (só cotação atualizada entra no cálculo do dia), as teses, o briefing (filtros das notícias, seleção sem ruído, o que mudou, conexão do dia, fato do exercício, agenda) e as fichas dos ETFs (todas com fonte oficial; cadastro divergente avisado e não alterado).
- `node painel/test/areas.js <endereço>` (precisa do Playwright): percorre 31 endereços, novos e antigos, no computador e no celular. Confere o destino de cada endereço antigo, erros de JavaScript e rolagem horizontal. Também testa:
  - a busca abrindo a ficha de uma empresa e de um ETF;
  - a notícia levando ao ativo;
  - o filtro de notícias;
  - o exercício com explicação;
  - o seletor Conservador/Arrojado mostrando a carteira inválida;
  - o menu com quatro áreas.

  Também confere que a ficha rápida completa o resultado da CVM sem reabrir. São 78 verificações.

## O que não pôde ser validado aqui (depende de credenciais ou da rede do GitHub)

- **Respostas reais das fontes.** Yahoo, brapi, AwesomeAPI, Alpha Vantage, Tiingo, FRED, Telegram e os RSS foram testados só com respostas simuladas no formato documentado. A rede de onde o trabalho foi feito bloqueia esses endereços. A primeira rodada no GitHub e o modo diagnóstico são a validação real.
- **Cobertura de ETFs na brapi.** Se o plano gratuito cobre ETFs (LFTB11, IRFM11 etc.) e o índice ^BVSP, só se confirma com a sua chave.
- **CVM.** O cruzamento por CNPJ e nome usa os CNPJs da configuração. O nome CVM da AXIA3 está vazio: confira em `robo/config.json`.
- **Agendamento do GitHub.** Os disparos do cron podem atrasar. A rodada de fechamento foi feita para tolerar atraso até 23h30.
- **Resultados da CVM.** O leitor segue o formato dos arquivos abertos da CVM (`*_DRE_con_AAAA.csv`, colunas `CNPJ_CIA`, `DT_REFER`, `VERSAO`, `ORDEM_EXERC`, `DT_INI_EXERC`, `DT_FIM_EXERC`, `CD_CONTA`, `DS_CONTA`, `VL_CONTA`, `ESCALA_MOEDA`) e foi testado com arquivos sintéticos nesse formato. Os bancos e as seguradoras usam outro nome na conta 3.01: o painel mostra o nome da conta ao lado do número. Confira na primeira rodada de fechamento (Actions → resumo da execução → fonte "resultados").
- **Agenda do IBGE.** A API de calendário foi testada com resposta simulada no formato descrito na documentação pública. Se o formato real for outro, a falha aparece na fonte "agenda", e a agenda segue só com Copom, Fed e Focus.
- **Publicação no Pages.** O YAML foi conferido em sintaxe e lógica, mas a execução real só acontece no seu repositório.
