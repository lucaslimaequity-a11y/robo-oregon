# Fontes de dados: o que o robô usa, quanto custa e o que as regras de uso permitem

Revisado em 07/11/2026. Os preços e os termos mudam: confira o link de cada fonte antes de contratar.

## Regra geral

- O robô só lê fontes que oferecem acesso aberto e legível por máquina: API pública, arquivo para baixar ou RSS.
- Ele respeita os limites de cada fonte: espera e tenta de novo, e pausa a fonte quando ela recusa. Não contorna bloqueios e não lê página que exige login.
- Fonte com chave só funciona com a chave guardada nos Secrets do GitHub. A chave nunca fica no site, no código ou nos registros.
- Cada número publicado leva fonte, data de referência, hora da coleta e estado: atualizado, desatualizado, em conferência ou indisponível.

## O site é público: o que isso muda

Quase todo dado de mercado tem dono, e as regras de uso costumam limitar a republicação. Como o site está aberto na internet, três decisões foram tomadas:

1. **Arquivos de cotações da B3 desligados.** A página de cotações históricas da B3 diz: "é expressamente vedada a coleta automatizada, inclusive por meio de ferramentas de inteligência artificial", para quaisquer finalidades, comerciais ou não. Por isso o robô não baixa mais os arquivos COTAHIST, e o modo diagnóstico também não consulta a B3. O código de leitura continua no projeto (`robo/b3.py`), desligado em `config.json` (`b3_arquivos.ativo: false`). Só faz sentido ligar com uma licença de market data da B3.
2. **Séries com direitos reservados fora do site.** Algumas séries do FRED trazem a marca "Copyrighted: Pre-Approval Required": o S&P 500, o spread de high yield da ICE BofA (BAMLH0A0HYM2) e o VIX da Cboe. O aviso da ICE, por exemplo, diz que a reprodução "in any form is prohibited" sem autorização. Essas séries foram tiradas. Ficaram só as de domínio público ou de uso livre com crédito à fonte: Fed, FMI e OCDE.
3. **Notícias: só título, link, data e veículo.** Os termos dos veículos proíbem reproduzir o texto. O robô nunca guarda o corpo da notícia.

Yahoo Finance e brapi também têm regras de uso. O Yahoo não tem API oficial: o endereço que o robô usa é o mesmo do site, sem contrato, e pode bloquear a qualquer momento (foi a causa das falhas do seu log). Para uso pessoal, o risco é baixo. Se o site for compartilhado com outras pessoas, o caminho certo é contratar uma fonte licenciada (plano pago da brapi, ou Economatica, abaixo) ou **tornar o repositório privado**. O GitHub Pages em repositório privado exige o plano GitHub Pro, de US$ 4 por mês ([preços do GitHub](https://github.com/pricing)).

## Fontes em uso

| Fonte | O que traz | Acesso | Custo | Observação |
|---|---|---|---|---|
| Banco Central · SGS | Selic, CDI, IPCA (mês e 12 meses), PTAX | API aberta | grátis | oficial |
| Banco Central · Focus | expectativas (IPCA, Selic, PIB, câmbio) | API aberta (Olinda) | grátis | oficial, semanal |
| Tesouro Transparente | taxas do Tesouro Direto (pré 2032, IPCA+ 2035) | arquivo aberto | grátis | substitui o DI futuro, que não tem fonte aberta |
| Tesouro dos EUA | Treasuries de 2 e 10 anos | arquivo aberto | grátis | oficial |
| IBGE | releases (IPCA, PIB etc.) | API aberta | grátis | fonte oficial |
| CVM · dados abertos (IPE) | fatos relevantes, comunicados, avisos aos acionistas | arquivo aberto (licença ODbL) | grátis | atualizado semanalmente pela CVM; o robô cruza CNPJ e nome |
| Google Notícias (RSS) | manchetes por empresa e por tema | RSS | grátis | só título, link, data e veículo |
| Brazil Journal (RSS) | manchetes | `braziljournal.com/feed/` | grátis | os termos proíbem reproduzir o texto: o robô guarda só título e link |
| The News (RSS) | manchetes | `rss.beehiiv.com/feeds/j9teVW9Qmi.xml` | grátis | só título e link |
| Agrofy News (RSS) | agro | `news.agrofy.com.br/rss.xml` | grátis | entra só quando cita empresa das carteiras (TTEN3, KNCA11); o feed parecia pouco atualizado na revisão |
| Yahoo Finance | cotações e séries ajustadas (B3 e EUA), Ibovespa, S&P 500, Brent, EEM | endereço não oficial | grátis | sem contrato; bloqueia com frequência (erro 429) |
| brapi | cotações e séries da B3 (reserva do Yahoo) | API com chave (`BRAPI_TOKEN`) | grátis com limite; planos pagos | ver abaixo |
| AwesomeAPI | dólar ao vivo | API com chave (`AWESOMEAPI_KEY`) | grátis com chave | sem chave, cai para Yahoo e depois para a PTAX |
| CoinGecko | bitcoin | API aberta | grátis | — |
| Alpha Vantage | fechamento dos ETFs de renda fixa da B3 (reserva) | API com chave (`ALPHAVANTAGE_KEY`) | grátis: 25 pedidos/dia; pago a partir de US$ 49,99/mês | o robô usa no máximo 20 por dia e só na rodada de fechamento ou manual |
| Tiingo | ETFs americanos (reserva do Yahoo) | API com chave (`TIINGO_TOKEN`) | grátis com limite | uso pessoal no plano gratuito |
| FRED | dólar global do Fed, TIPS 10 anos, minério (FMI), juro de 10 anos da Alemanha (OCDE) | API com chave (`FRED_API_KEY`) | grátis | só séries sem restrição de republicação |

### Chaves opcionais: o que cada uma acrescenta

- **BRAPI_TOKEN** ([brapi.dev](https://brapi.dev/pricing)). O plano gratuito serve para testes, com cota mensal de pedidos, 1 ativo por pedido e só 3 meses de histórico. Por isso o robô usa a brapi apenas quando o Yahoo falha. Os planos pagos (na revisão, a partir de cerca de R$ 100 por mês no anual) liberam mais pedidos, histórico longo e proventos. Contrate só se o Yahoo continuar bloqueando os ETFs.
- **ALPHAVANTAGE_KEY** ([alphavantage.co](https://www.alphavantage.co/support/#api-key)). É grátis. Serve de reserva de fechamento para os 9 ETFs de renda fixa quando Yahoo e brapi falham. O plano gratuito tem 25 pedidos por dia ([preços](https://www.alphavantage.co/premium/)): o robô controla a cota e não passa de `alphavantage.limite_dia` (20).
- **TIINGO_TOKEN** ([tiingo.com](https://www.tiingo.com/about/pricing)): reserva gratuita para os ETFs americanos.
- **FRED_API_KEY** ([fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html)): grátis. Liga as séries globais da Estratégia Global.
- **AWESOMEAPI_KEY** ([awesomeapi.com.br](https://docs.awesomeapi.com.br/)): grátis. Dólar ao vivo durante o pregão.
- **ANTHROPIC_API_KEY** (Claude Console): pago, por uso. Liga uma leitura extra das manchetes por IA. A classificação por regras funciona sem ela, e o painel nunca depende dela.

## Economatica

A Economatica vende o terminal e, como produtos separados, APIs e Data Feed:

- **APIs:** fundamentos e mercado, fundos (universo da CVM), renda fixa (debêntures, CRI/CRA, curva) e notícias. Usam chave por API, ambiente de teste com dados sintéticos e termos comerciais negociados ([página das APIs](https://www.economatica.com/en/apis/)).
- **Data Feed:** entrega contínua para bancos de dados ([data feed](https://www.economatica.com/data-feed-en)).

Não há preço público. A própria página separa o terminal das APIs, então **não dá para supor que a sua assinatura do terminal inclui API**. O robô não usa a Economatica e não deve automatizar o acesso pelo navegador, porque isso seria raspagem de área com login.

**Caminhos:**

1. **Agora, sem custo.** Exporte do terminal, à mão, as séries que quiser, como CSV ou Excel. Depois importe no painel em Carteiras → Construção → Dados → Importar séries. As séries importadas por você têm prioridade: o robô nunca as substitui.
2. **Se quiser automatizar.** Peça à Economatica, por escrito, quatro respostas:
   - (a) se a sua assinatura inclui API;
   - (b) o preço da API de Fundamentals and Market Data;
   - (c) se o uso é "interno";
   - (d) se pode exibir os dados num site pessoal.

   Com a chave e os termos em mãos, a integração é uma fonte nova no robô, com a chave guardada como Secret.

## Links avaliados (enviados em 07/11/2026)

| Link | Veredito | Motivo |
|---|---|---|
| dadosdemercado.com.br/fluxo | só documentado | Tem API (`/v1/investors`, com token) e dados desde 2010, mas não publica preço, limites nem termos de republicação. O dado original é da B3, que veda coleta automatizada. Com token e autorização por escrito, entra como fonte. |
| reddit.com/r/EconomyCharts | evitar | O RSS do Reddit deixa de funcionar em 13/11/2026 e a API pública fecha em 2027. Os gráficos são reposts, com origem variável. |
| ratodemercado.com.br (proventos) | evitar | Os termos proíbem coleta automatizada e em massa. Alternativas: avisos aos acionistas na CVM (já no robô) ou proventos da brapi (só nos planos pagos). |
| braziljournal.com | **em uso** | RSS oficial; só título e link. |
| NYT Morning Briefing | só documentado | É newsletter por e-mail. Os RSS do NYT são para uso pessoal e não comercial; o uso profissional pede autorização. Os links do NYT já aparecem no Google Notícias. |
| morningbrew.com | evitar | Sem RSS; os termos proíbem robôs. Leia por e-mail. |
| thenewscc.beehiiv.com | **em uso** | O próprio editor publica um RSS; só título e link. |
| finviz.com | evitar | A exportação só existe no plano Elite (na revisão, US$ 39,50 por mês ou US$ 299,50 por ano), e o robots.txt bloqueia a exportação. Para setores americanos, a alternativa é a Tiingo com os ETFs setoriais. |
| news.agrofy.com.br | **em uso, com filtro** | RSS oficial; entra só quando cita empresa das carteiras. |
| alphavantage.co | **em uso, como reserva** | API oficial com chave grátis (25 pedidos por dia): só para os ETFs de renda fixa, na rodada de fechamento. |
| Mais Retorno (MCP) | conector do Claude; robô só com autorização | O endereço `data.maisretorno.com/mr-data/v4/mcp/oauth` liga a Mais Retorno ao Claude, com login OAuth: Configurações → Conectores → Adicionar conector personalizado. O plano grátis tem 500 créditos por mês, 1 ano de histórico e dados do dia anterior ([maisretorno.com/mcp](https://maisretorno.com/mcp)). No robô, só depois de duas coisas: a documentação da API e uma confirmação de que pode exibir os dados num site público. A chave, se usada, vai como Secret `MAISRETORNO_KEY`. |
| jonasesteves.com/panorama | evitar | Produto pago, com login; os termos proíbem robôs. As séries equivalentes vêm de BC, Tesouro e FRED (já no robô). |

## O que ainda não tem fonte aberta

Estes itens aparecem como falta no painel, nunca como estimativa:

- curva de DI futuro;
- CDS do Brasil;
- fluxo estrangeiro na B3;
- proventos e datas-com;
- probabilidades do FedWatch;
- PMI e crédito da China;
- preço da celulose;
- lucro esperado do S&P 500.
