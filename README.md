# Oregon Investment Desk

Mesa de análise, risco e estratégia da Carteira Oregon. Um robô coleta os dados de mercado; um site mostra o painel.

- **Site:** https://lucaslimaequity-a11y.github.io/robo-oregon/ (público, fora dos buscadores).
- **Robô:** GitHub Actions. Roda a cada 30 minutos em dias úteis, das 8h às 20h30, com rodada de fechamento depois das 21h e recuperação no sábado de manhã. Guarda os dados no ramo `dados` e publica o site.
- **Avisos:** Telegram (alertas e resumo do dia).

## O que tem no painel

| Área | Para quê |
|---|---|
| **Hoje** | O que aconteceu no Brasil e no mundo, o que mudou nas expectativas, o que merece atenção e como as 15 carteiras andaram. Cada número com data, fonte e estado. |
| **Carteiras** | Mapa das carteiras, carteira em camadas, pilar a pilar, validação, risco e cenários, construção, decidido × base, performance. |
| **Research Brasil** | Ficha de cada empresa (valuation, estrutural × conjuntural, fatos recentes), macro → empresas, acontecimentos. |
| **Estratégia Global** | Juros globais, dólar, China e commodities e o caminho de cada um até as carteiras. |
| **Sala de Gestão** | Reunião, guia do Comitê, decisões, pauta, textos e consultores, histórico. |

## Onde fica cada coisa

| Pasta | O que é |
|---|---|
| `robo/config.json` | **O que muda com frequência**: ativos, horários, alertas, limites, fontes, notícias e critérios de qualidade. |
| `robo/` | O robô (Python, sem bibliotecas extras). |
| `painel/src/` | O painel (HTML, CSS e JavaScript em módulos). O site é montado a partir daqui a cada rodada. |
| `painel/src/data.json` | Carteiras, pilares, ativos, teses e textos do Comitê. |
| `site/index.html` | O painel já montado (gerado por `painel/build.py`; não precisa editar). |
| `testes/` | Testes do robô (internet simulada) e do painel. |
| `docs/` | Publicação e rollback, fontes e licenças, auditoria do robô, arquitetura, consistência das carteiras. |
| `.github/workflows/` | Quando o robô roda e como o site é publicado. |

## Mudanças comuns, só em `robo/config.json`

Edite no GitHub: abra o arquivo, clique no lápis e depois em **Commit changes**. O robô confere a configuração antes de usar.

- **Novo ativo.** Copie um bloco de `ativos` parecido e troque:
  - `id`, `nome` e `classe` (acao, fii, etf_rf, eua ou cripto);
  - `mercado` (B3, EUA ou cripto);
  - `yahoo` (ex.: `XXXX3.SA`);
  - `distribui` (true, false ou null);
  - `inicio` (data de início de negociação, se for recente);
  - `noticias.termos` e `noticias.excluir`, para evitar homônimos: um termo começado por `=` exige maiúsculas exatas, como em `=PRIO`.
- **Tirar um ativo sem apagar:** `"ativo": false`.
- **Horários:** `agenda` (dias, início, fim, intervalo de 30, 60 ou 120 minutos, fechamento, resumo diário).
- **Alertas ligados ou desligados:** `alertas` (fatores, ativos, indicadores, notícias, resumo diário).
- **Limites de alerta:** `limites` (juros em p.p.; preços em %).
- **Qualidade:** `qualidade` (a partir de quantos % a rodada é completa ou crítica; anomalia por classe).
- **Fontes de cada classe:** `fontes_padrao` (ordem de prioridade). Por ativo, use o campo `fontes`.
- **Notícias:** `noticias.macro` (buscas), `noticias.rss` (veículos com RSS), `noticias.veiculos_confiaveis`, `noticias.fontes_bloqueadas`.
- **Feriados da B3:** `feriados_b3`. Inclua os de 2027 antes de janeiro.

## Chaves

Ficam só em **Settings → Secrets and variables → Actions**, nunca em arquivo ou no site.

- **Obrigatórias:** `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`.
- **Opcionais:** `BRAPI_TOKEN`, `ALPHAVANTAGE_KEY`, `FRED_API_KEY`, `AWESOMEAPI_KEY`, `TIINGO_TOKEN`, `ANTHROPIC_API_KEY`.

Custos e regras de uso estão em `docs/FONTES.md`.

## Testes

```
python -m unittest discover -s testes     # robô: 37 testes, internet simulada
node testes/painel.test.js                # painel: 26 testes (carteiras, cenários, modelos, mercado)
```

Os testes rodam sozinhos antes de cada publicação: se algum falhar, o site fica como estava. Para rodar só os testes, use Actions → **Testes completos** → Run workflow.

## Publicar uma versão nova e voltar atrás

Ver `docs/ATUALIZACAO.md`.
