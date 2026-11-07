# Painel Carteira Oregon · robô de mercado

Este repositório publica o painel da Carteira Oregon na internet (GitHub Pages) e mantém um robô que,
em dias úteis, a cada 30 minutos (8h às 19h30, horário de Brasília):

- busca juros, inflação, câmbio, Focus, Tesouro Direto, Treasuries, Ibovespa, S&P 500, Brent, bitcoin
  e as cotações dos ativos das carteiras;
- busca as notícias das empresas e de macro (a cada hora) e guarda 60 dias para estudo;
- avisa no Telegram quando algo passa dos limites de `robo/config.json` e manda um resumo às 18h30;
- uma vez por dia, guarda até 2 anos de séries para o modelo de risco do painel.

| Pasta | O que é |
|---|---|
| `site/index.html` | o painel (troque este arquivo quando receber uma versão nova) |
| `robo/coletar.py` | o robô (Python, sem bibliotecas extras) |
| `robo/config.json` | ativos acompanhados, buscas de notícias, limites de alerta e veículos bloqueados |
| `.github/workflows/robo.yml` | quando o robô roda e como o site é publicado |
| `testes/` | testes do robô com respostas simuladas (`python -m unittest testes/test_coletar.py`) |

Chaves ficam em **Settings → Secrets and variables → Actions**, nunca nos arquivos:
`TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`, `BRAPI_TOKEN` (opcional), `ANTHROPIC_API_KEY` (opcional).

O repositório e o site são públicos: qualquer pessoa com o endereço vê o painel. Não coloque aqui
dados de clientes.
