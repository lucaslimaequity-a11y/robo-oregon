# Oregon Investment Desk

Mesa de análise, risco e estratégia da Carteira Oregon. Um robô coleta os dados de mercado; um site mostra o painel.

- **Site:** https://lucaslimaequity-a11y.github.io/robo-oregon/ (público, fora dos buscadores).
- **Robô:** GitHub Actions. Roda a cada 30 minutos em dias úteis, das 8h às 20h30, com rodada de fechamento depois das 21h e recuperação no sábado de manhã. Guarda os dados no ramo `dados` e publica o site. Os dados são periódicos, não cotação em tempo real.
- **Avisos:** Telegram (alertas e resumo do dia).

## O que tem no painel

O menu tem quatro áreas, na ordem do dia de trabalho:

| Área | Para quê |
|---|---|
| **Hoje** | Briefing de cinco minutos: indicadores com fonte e hora, 5 a 10 notícias que importam (filtros Brasil, Empresas, Juros e Fiscal, Commodities, Mundo), o que mudou desde o último pregão, as carteiras de referência na sessão, a agenda (IBGE, Copom, Fed, Focus), as empresas das carteiras, a conexão do dia (exterior → Brasil) e um exercício de gestão de carteiras com fato real. |
| **Research Brasil** | O centro da análise. Ficha de cada empresa: fundamentos (tese, modelo de negócio, drivers, riscos, perguntas) separados da conjuntura (preço, resultados da CVM, fatos e notícias, setor e pares), exposição a juros, câmbio, regulação e commodities, e a opinião da casa. Ficha de cada um dos 27 ETFs com os documentos oficiais. Macro → empresas e o arquivo de acontecimentos. |
| **Carteiras** | Modo simples: as duas carteiras de referência (Conservador e Arrojado, versão aprovada), com camadas, pilar a pilar, risco, cenários e a comparação entre as duas. Risco e cenários completo. Comitê e Sala (reunião, guia do Comitê, decisões, pauta, textos, histórico). Modo avançado: as 15 carteiras, construção, decidido × base, performance. |
| **Mundo e Estratégia** | Fed, EUA, China, commodities e ETFs globais, e o caminho de cada um até as carteiras. |

Busca rápida: tecla **/** (empresa, ETF, carteira ou seção). Tocar numa notícia leva ao ativo, ao setor ou ao fator; tocar num fator mostra o mecanismo e o efeito nas carteiras de referência.

## Onde fica cada coisa

| Pasta | O que é |
|---|---|
| `robo/config.json` | **O que muda com frequência**: ativos, horários, alertas, limites, fontes, notícias e critérios de qualidade. |
| `robo/` | O robô (Python, sem bibliotecas extras). |
| `painel/src/` | O painel (HTML, CSS e JavaScript em módulos). O site é montado a partir daqui a cada rodada. |
| `painel/src/data.json` | Carteiras, pilares, ativos, teses e textos do Comitê. |
| `painel/src/etfs.json` | Fichas dos ETFs, montadas com os documentos oficiais das gestoras (com links e data de consulta). |
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
- **Notícias:** `noticias.macro` (buscas), `noticias.etfs` (temas dos índices dos ETFs), `noticias.rss` (veículos com RSS), `noticias.veiculos_confiaveis`, `noticias.fontes_bloqueadas`.
- **Agenda:** `agenda_macro` (produtos do IBGE e as reuniões do Copom e do Fed; quando sair o calendário do ano seguinte, acrescente as datas).
- **Resultados da CVM:** `resultados` (liga, desliga e de quantos em quantos dias lê).
- **Carteiras de referência do modo simples:** `A.REF` em `painel/src/ui_base.js` (uma linha).
- **Feriados da B3:** `feriados_b3`. Inclua os de 2027 antes de janeiro.

## Chaves

Ficam só em **Settings → Secrets and variables → Actions**, nunca em arquivo ou no site.

- **Obrigatórias:** `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`.
- **Opcionais:** `BRAPI_TOKEN`, `ALPHAVANTAGE_KEY`, `FRED_API_KEY`, `AWESOMEAPI_KEY`, `TIINGO_TOKEN`, `ANTHROPIC_API_KEY`.

Custos e regras de uso estão em `docs/FONTES.md`.

## Testes

```
python -m unittest discover -s testes     # robô: 46 testes, internet simulada
node testes/painel.test.js                # painel: 28 testes (carteiras, cenários, modelos, mercado, briefing, ETFs)
node painel/test/areas.js <endereço>      # passeio pelas telas no computador e no celular (Playwright)
```

Os testes rodam sozinhos antes de cada publicação: se algum falhar, o site fica como estava. Para rodar só os testes, use Actions → **Testes completos** → Run workflow.

## Publicar uma versão nova e voltar atrás

Ver `docs/ATUALIZACAO.md`.
