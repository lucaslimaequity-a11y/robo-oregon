# Atualizar para o Oregon Intelligence v3.4 e como voltar atrás

O pacote `robo-oregon-v3.4-alterados.zip` atualiza a v3.3 que está no seu GitHub (commit "Add files via upload" de
08/11, 11:47). Tudo é feito pelo site do GitHub, sem instalar nada. Nenhuma chave vai para arquivo. O workflow
(`robo.yml`) **não muda**.

## O que muda na v3.4 (Research Command Center)

- **Visual:** faixa superior escura com marca, seções, busca e hora da coleta; fundo cinza-azulado; cada área do Hoje
  com uma cor própria na borda (radar azul, agenda âmbar, research azul-petróleo, debate violeta); menos maiúsculas.
- **Hoje em quatro áreas:** Radar das teses (o que aconteceu com as empresas acompanhadas, com uma linha dizendo se é
  fato da empresa, opinião publicada, notícia ou hipótese de setor), Agenda decisiva (quantas ações já entregaram o
  trimestre à CVM, documentos das companhias, agenda oficial), Research global e Debate de mercado. Em cima: mapa de
  atenção da carteira (acontecimentos por ativo em 7 dias, toque para as notícias), "desde a sua última visita" com os
  itens novos marcados por um ponto azul, ativos vistos por último e sumário da página. Três profundidades: rápida,
  briefing e aprofundada.
- **Mundo e Estratégia:** Notícias · Research (últimos 7 dias, 8 a 30, ainda relevante 31 a 90, mapa de temas de gestão
  com toque para filtrar, fontes sem publicação recente) · Debate de mercado (opiniões publicadas com filtro a favor/contra,
  análises de colaboradores do Seeking Alpha, comunidades do Reddit e buscas do X como consultas externas) · ETFs globais.
- **Opiniões:** os três relatórios de ALOS3 (InvesTalk 06/11, Genial 05/11 e 23/10) e mais 162 opiniões dos últimos
  12 meses, conferidas na página original, entram na biblioteca. Recomendação, preço-alvo, horizonte e analista aparecem
  quando escritos; a janela mostra a visão anterior da mesma casa. Comentários de resultado do InvesTalk passam a ser
  procurados no endereço do trimestre. "Opinião da casa" saiu da ficha; o filtro Opiniões da Biblioteca ficou.
- **Relação com a Oregon:** a janela mostra a pergunta (ex.: "Como a Selic e os juros de curto prazo afetam ETF de Tesouro
  Selic (LFTB11)?"), o papel do ativo pela ficha verificada ou pela tese interna, a premissa de sensibilidade, o que se
  publicou sobre isso (pesquisa do robô no Bing Notícias, a partir da primeira rodada) e botões para a mesma pesquisa no
  Google e no Bing.
- **Recência:** cartas antigas sem data deixam as novidades (145 no seu histórico, na primeira rodada; continuam na
  Biblioteca). A tela separa data de publicação, de atualização e de detecção.
- **Ergonomia:** "Ler depois" em qualquer notícia, com a lista em Biblioteca › Salvos para ler; busca (tecla / ou Ctrl+K)
  começa pelos ativos vistos por último; diagnóstico das fontes na ordem fonte → última tentativa → último conteúdo →
  falha → publicados.
- **Correções:** "Margem Equatorial" não é mais Equatorial Energia; "prejuízo de R$ 5 mil" de um cliente ou "balanço sobre
  imóveis" não são mais resultado da empresa; documento à CVM que cita a Fitch não é opinião; nomes repetidos de casa
  ("Genial" e "Genial Investimentos") viram um só; títulos "Read article" ganham o título do endereço.
- **Grupo XP:** bloqueado de vez (antes entrava com aviso).

## 1. Suba os arquivos (um só envio)

1. Descompacte o `robo-oregon-v3.4-alterados.zip`. Ele tem só os 28 arquivos que mudaram, nas pastas certas.
2. No GitHub, repositório `robo-oregon` → **Add file** → **Upload files**.
3. Arraste **as pastas** de dentro do ZIP (`docs`, `painel`, `robo`, `site`, `testes`) e o `README.md` de uma vez.
4. Escreva "Oregon Intelligence v3.4" e **Commit changes**.

Arquivos do pacote (novos marcados com ★):

```
README.md
docs/ARQUITETURA.md  docs/ATUALIZACAO.md  docs/FONTES.md  docs/RESULTADOS_TESTES.md
painel/dist/Oregon_Intelligence.html  painel/dist/painel_artifact.html
painel/src/app.css  painel/src/intel.js  painel/src/store.js  painel/src/tests.js
painel/src/ui_base.js  painel/src/ui_bib.js  painel/src/ui_hoje.js  painel/src/ui_oregon.js
painel/test/areas.js
robo/analise.py  robo/biblioteca.py  robo/casas.py ★  robo/config.json  robo/conteudo.py
robo/fontes.json  robo/intel.py  robo/pesquisas.py ★  robo/sementes/opinioes_12m.json ★
site/index.html
testes/test_intel.py  testes/test_v34.py ★
```

O pacote completo (`robo-oregon-v3.4.zip`) tem o repositório inteiro, para guardar ou para começar do zero.

## 2. Primeira rodada

**Actions** → **Oregon Intelligence** → **Run workflow** → modo `normal` → **Run workflow**. Leva 5 a 10 minutos. Nessa
rodada o robô, uma única vez: tira das novidades as cartas antigas sem data, importa as 165 opiniões conferidas e passa a
publicar `research.json` (90 dias) e `pesquisas.json`.

## 3. Conferência (5 minutos)

1. **Hoje:** o topo mostra a coleta; abaixo, o mapa de atenção e as quatro áreas. Troque Rápida / Briefing / Aprofundada.
2. **Brasil › ALOS3:** à direita, nas opiniões de 12 meses, InvesTalk 06/11 (Compra, R$ 38,00) e Genial 05/11 (R$ 37,00)
   e 23/10 (R$ 39,00). Toque no InvesTalk: a janela mostra casa, analista, recomendação, preço-alvo, a visão anterior e
   diz que a página só informa a data de atualização.
3. **Mundo e Estratégia › Research:** últimos 7 dias, 8 a 30 e 31 a 90; nenhuma carta de 2023 como novidade.
4. **Uma notícia de LFTB11** (ou de Selic): em "Relação com a Oregon", a pergunta, o papel do ETF e, depois da rodada, "O
   que se publica sobre isso"; os botões abrem a mesma pesquisa no Google e no Bing.
5. **Biblioteca › Fontes e coleta:** as fontes novas aparecem com última tentativa, último conteúdo e falha. As marcadas
   "a validar" (NYT, Bloomberg Opinion, CNBC Economy, Genial relatórios) se confirmam ou não nesta rodada, sem marcar a
   rodada como parcial.

Se algo der errado, o site continua como estava: os testes rodam antes de publicar e, se um falha, nada é publicado.

## 4. Chaves (todas opcionais)

Settings → Secrets and variables → Actions → **New repository secret**:

| Nome | Para quê | Custo | Sem ela |
|---|---|---|---|
| `YOUTUBE_API_KEY` | vídeos dos 17 canais oficiais cadastrados (instituições e gestoras) pela API oficial do YouTube | grátis (cota diária de 10.000 unidades; cada canal gasta 1 por leitura) | os canais ficam "aguardando chave" e não aparecem; o resto funciona |
| `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID` | briefing diário no Telegram (07:30) | grátis | nada é enviado |
| `ANTHROPIC_API_KEY` | leitura aprofundada dos itens prioritários | pago por uso, com teto diário (`docs/IA.md`) | análise por regras, sinalizada na tela |

Chave do YouTube: Google Cloud Console → novo projeto → APIs e serviços → Biblioteca → "YouTube Data API v3" → Ativar →
Credenciais → Criar credencial → Chave de API → restrinja à YouTube Data API.

Custo do GitHub: o repositório é público, então os minutos do GitHub Actions são gratuitos; cada rodada leva poucos minutos.

## 5. Voltar atrás

- **Para a v3.3:** envie de novo os arquivos do pacote `robo-oregon-v3.3-alterados.zip` (mesmo caminho). Os dados não se
  perdem; `data/biblioteca/research.json` e `pesquisas.json` ficam sem uso e as opiniões conferidas continuam na biblioteca.
- **Para a v3.2:** envie de novo os arquivos do pacote da v3.2 (mesmo caminho). Os dados não se perdem; o arquivo
  `data/biblioteca/opinioes.json` fica sem uso.
- **Para a v3:** envie de novo os arquivos do `robo-oregon-v3-intelligence.zip` (mesmo caminho) e o `robo.yml` daquele
  pacote.
- **Dados:** o ramo `dados` guarda tudo o que o robô já coletou (biblioteca por mês). Nenhuma versão apaga esse ramo.
  Na primeira rodada da v3.2, as cartas antigas sem data, lidas pela primeira vez na v3, passam a "acervo" (saem do Hoje
  e continuam na Biblioteca). É uma migração única, registrada no estado do robô.
- **Configuração:** `robo/config.json` → **History** → versão anterior → copiar → colar → **Commit changes**.

## 6. Ajustes que você pode querer

Tudo em `robo/config.json`, bloco `noticias`:

- **Buscas por empresa:** `ativos[].noticias.buscas` (o que é buscado) e `termos`/`excluir` (o que confirma que a manchete
  é da empresa). Ex.: Klabin exclui "Chácara Klabin" e "Ema Klabin".
- **Buscas por setor e cadeia:** `buscas_setor` (consulta, mercado pt-BR ou en-US, ativos ligados, termos exigidos).
- **Temas dos ETFs:** `etfs[].busca` e `mkt`.
- **Ritmo das buscas:** `busca.intervalo_min` (120) e `busca.max_por_rodada` (14).
- **Grupo XP:** bloqueado desde a v3.4 (`fontes_bloqueadas`: InfoMoney, XP Investimentos, Expert XP, Conteúdos XP, Rico
  Investimentos, Clear Corretora). O que foi gravado antes também deixa de ser publicado. Opinião da XP noticiada por
  outro veículo continua, com a casa "XP".
- **Comentários de resultado do InvesTalk:** `intel.investalk` (`max_por_rodada` 4, `intervalo_horas` 24; `"ativo": false`
  desliga; `"trimestre": "3T26"` fixa o trimestre).
- **Pesquisa da janela de leitura:** `intel.pesquisas` (`validade_dias` 3, `max_por_rodada` 6; `"ativo": false` desliga).
- **Expressões que não são a empresa:** `ativos[].noticias.excluir` também vale para a classificação desde a v3.4 (ex.:
  "Margem Equatorial" não é a Equatorial Energia).
- **Veículos conhecidos:** `veiculos_confiaveis`. Os demais entram marcados "veículo pouco conhecido" e só aparecem na
  ficha do ativo.
- **Indicadores de mercado:** `intel.indicadores_macro` (desligado). A agenda oficial continua.

O robô valida a configuração antes de rodar. Com erro, a rodada falha visivelmente em Actions, com a lista em português,
e nada é publicado.
