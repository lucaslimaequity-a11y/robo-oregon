# Diagnóstico: por que 72 manchetes não viraram notícia visível

## O que foi encontrado (código ao vivo em 08/11/2026)

1. **O robô publicado era o da v1.** `main` tinha o código da v2.1 (robô, painel e testes), mas
   `.github/workflows/robo.yml` nunca foi substituído: a pasta `.github` é oculta no Mac e não subiu. O GitHub Actions
   continuou rodando o fluxo antigo (segunda a sexta, só cotações, sem portão de testes, sem publicar `versao.json`).
2. **As manchetes estavam lá, sem classificação.** O ramo `dados` tinha `noticias.json` com 79 itens (gerado em
   07/11/2026 20:21) no formato da v1: sem o bloco `classe` (relevância, categorias, pontos). `mercado.json` era `versao: 1`.
3. **O painel v2.1 escondeu tudo.** A tela Hoje e a seção Acontecimentos tratavam item sem `classe` como relevância
   "baixa" e filtravam as baixas por padrão. Resultado: 72 manchetes coletadas, zero visíveis, sem aviso.

Três falhas somadas: implantação incompleta (workflow), formato antigo nos dados e um filtro que escondia em silêncio.

## O que mudou para isso não acontecer de novo

- **Nada é escondido por filtro.** A prioridade só ordena. Itens de prioridade baixa continuam na Biblioteca (há teste de
  navegador que confere isso) e o briefing diz quantos itens avaliou e quantos ficaram.
- **Item sem análise ainda aparece.** Se um item vier sem `analise` (versão antiga), a gaveta diz isso e abre a fonte.
- **Contadores por fonte** em `coleta.json`: recebidos, rejeitados por motivo (`sem_link`, `repetido_no_feed`,
  `fora_do_filtro`, `antigo`, `bloqueada`, `robots`, `sem_ativo_oregon`), já vistos (duplicados), novos, publicados,
  `ultima_ok`, `ultimo_erro`. Aparecem no Summary da execução e em **Biblioteca → Fontes e coleta**.
- **Workflow visível** em `docs/workflow_robo.yml`, com teste que obriga igualdade com o arquivo real, e instrução de
  colar pelo editor do GitHub (`docs/ATUALIZACAO.md`).
- **O painel avisa** quando o robô publicado ainda é o antigo (`versao.json` sem `produto: Oregon Intelligence`) ou
  quando não há dados, em vez de mostrar uma tela vazia.
- **Histórico nunca é apagado:** biblioteca por mês, `git add -f data` do ramo inteiro, fonte que falha mantém o que já
  publicou.

## Como ler a coleta de uma rodada

Actions → execução → Summary: tabela por fonte. Interpretação:
- `recebidos` alto e `novos` zero: a fonte não publicou nada novo (normal para cartas mensais);
- `rejeitados: antigo` conta itens fora da janela (`intel.janela_dias`, 10 dias; a primeira rodada usa 45);
- `erro` com "formato": o site mudou de layout ou o feed quebrou — nada foi inventado; a fonte continua tentando;
- `erro` com "bloqueado (403)" ou "robots": a fonte não é acessível a robôs; não contornamos — desligue-a ou troque a URL;
- `aguardando chave`: canal do YouTube sem `YOUTUBE_API_KEY`.
