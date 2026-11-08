# Análise por IA (opcional)

Desligada por padrão. O sistema é útil sem ela: os sete pontos vêm de regras e a tela diz "Análise por regras".

## Como ligar

1. Crie uma chave no console da Anthropic e cadastre em **Settings → Secrets → `ANTHROPIC_API_KEY`**.
2. Em `robo/config.json`, bloco `intel.ia`, troque `"ativo": false` por `true`.
3. Ajuste os tetos: `max_itens_dia` (padrão 12), `max_tokens_dia` (150.000), `max_tokens_item` (1.200). O modelo é
   `ia_modelo` (`claude-haiku-5-5`), API `anthropic-version` `2023-06-01`.

## O que a IA recebe e devolve

Recebe **só conteúdo público**: fonte, tipo, título e o resumo curto do feed. Nunca pesos, carteiras, posições ou dados
de clientes (há teste para isso). Devolve JSON com os pontos 2 a 7, cada frase rotulada FATO / FONTE / INFERÊNCIA; rótulo
inválido é descartado; o ponto 1 (o que foi publicado) vem sempre das regras. A IA é instruída a escrever "não avaliado"
quando o texto não basta e a nunca recomendar compra ou venda. O item fica marcado `análise IA` e a gaveta avisa que a
leitura é sobre título e resumo, não sobre o texto completo.

## Custo e controle

- Um pedido por item prioritário, só itens ainda sem análise profunda, até o teto diário; o contador zera por dia e
  continua valendo entre as rodadas do mesmo dia (`estado.json` → `ia_uso`, com histórico de 60 dias em `ia_historico`).
- Volume típico com 12 itens/dia: cerca de 700 a 1.000 tokens de entrada e 300 a 500 de saída por item, ou seja,
  **da ordem de 15 a 20 mil tokens por dia**. Multiplique pelo preço por milhão de tokens do modelo na página de preços da
  Anthropic (não copiamos o preço aqui porque ele muda). Chave recusada ou falha de rede: a rodada segue com as regras e
  o motivo aparece em `status.json` → `ia`.
- "Mudanças de visão" no resumo semanal exigem IA (comparar textos entre semanas); sem ela o campo diz isso.

## O que a IA não faz

Não escolhe prioridades (isso é por regras, auditável), não altera carteiras, não produz recomendação, não lê páginas
inteiras nem PDFs (só o que o feed público traz), não roda no navegador (nenhuma chave no site).
