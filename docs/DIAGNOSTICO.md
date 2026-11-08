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

## Diagnóstico por ativo (para confirmar no GitHub)

Actions → Robô de mercado Oregon → Run workflow → modo **diagnostico**. Para cada ativo, o robô testa o Yahoo com e sem `.SA`, a brapi (se houver chave) e a Tiingo, uma por uma, sem pausa. O resultado aparece no resumo da execução e em `data/diagnostico.json`. É assim que se confirma, com a rede do GitHub, se algum ticker mudou ou só está bloqueado.

## Testes

- `python -m unittest discover -s testes`: 37 testes do robô, com a internet simulada (`testes/simulador.py`). Nenhum número dos testes é real. Cobrem:
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
  - classificação de erros de rede.
- `node testes/painel.test.js`: 26 testes do painel. Cobrem a validação das 15 carteiras, o motor de cenários, os modelos quantitativos, o mercado ao vivo no formato v2 (só cotação atualizada entra no cálculo do dia) e as teses.
- `node painel/test/areas.js <endereço>` (precisa do Playwright): percorre as 5 áreas e 27 endereços, no computador e no celular, procurando erros de JavaScript e rolagem horizontal.

## O que não pôde ser validado aqui (depende de credenciais ou da rede do GitHub)

- **Respostas reais das fontes.** Yahoo, brapi, AwesomeAPI, Alpha Vantage, Tiingo, FRED, Telegram e os RSS foram testados só com respostas simuladas no formato documentado. A rede de onde o trabalho foi feito bloqueia esses endereços. A primeira rodada no GitHub e o modo diagnóstico são a validação real.
- **Cobertura de ETFs na brapi.** Se o plano gratuito cobre ETFs (LFTB11, IRFM11 etc.) e o índice ^BVSP, só se confirma com a sua chave.
- **CVM.** O cruzamento por CNPJ e nome usa os CNPJs da configuração. O nome CVM da AXIA3 está vazio: confira em `robo/config.json`.
- **Agendamento do GitHub.** Os disparos do cron podem atrasar. A rodada de fechamento foi feita para tolerar atraso até 23h30.
- **Publicação no Pages.** O YAML foi conferido em sintaxe e lógica, mas a execução real só acontece no seu repositório.
