# Oregon Intelligence v4.0.1 · Assuntos do momento, Hoje mais fácil de achar e ETFs de renda fixa (10/11/2026)

O pacote `robo-oregon-v4.0.1-alterados.zip` vale sobre a v4.0 que já está no seu GitHub. **O `robo.yml` não muda: um
envio só.** Nenhuma chave nova, nenhuma API paga, nenhuma fonte nova (só a busca de notícias do Bing que o robô já usa).

## O que entra (pedidos de 10/11)

- **Assuntos do momento** no alto do Hoje, no lugar das barras por hora.
  - Barras com os assuntos mais falados: Petróleo, Minério de ferro, China, Copom e Selic, Fed e juros dos EUA, Dólar e
    câmbio, Inflação, Fiscal, Eleições, Guerra e Oriente Médio, Inteligência artificial e Agro.
  - Em cada assunto aparece quantas notícias saíram e uma seta de tendência. A seta compara a fatia do assunto no total
    de notícias com a fatia no período anterior:
    - ▲ quando a fatia é 1,5 vez a de antes ou mais;
    - ▼ quando é dois terços ou menos;
    - "estável" no resto.
  - Usa a fatia, e não o número de notícias, porque o robô coleta mais do que antes. Pelo número, tudo pareceria subir.
  - Botões 24 h | 7 dias | 30 dias. Cada um compara com um período anterior:
    - 24 h com os 7 dias anteriores;
    - 7 dias com as 4 semanas anteriores;
    - 30 dias com os 60 dias anteriores.
  - Enquanto o período anterior não tem notícias suficientes, aparece "—" no lugar da seta. Com a coleta que começou em
    outubro, é o caso dos 30 dias por enquanto.
  - **Tocar num assunto abre as notícias dele ali mesmo**, junto com:
    - a fatia de cada um dos últimos 14 dias;
    - as palavras procuradas;
    - "Filtrar o Hoje por …";
    - "Ver todas na Biblioteca".
  - **Como conta:** o assunto vale quando o título tem uma das palavras da lista `robo/assuntos.json`, que dá para
    conferir e editar. Alguns exemplos de como a regra lida com palavras parecidas:
    - "Irã" conta e "irá" não;
    - "IA" conta e "ia" não;
    - "Petrobras" sozinha não conta como petróleo, porque é empresa e entra pelo filtro de ativo.
  - Quem faz a conta é o robô a cada rodada (arquivo `biblioteca/assuntos.json`). Antes da primeira rodada depois do
    envio, o painel conta sozinho as últimas 24 h e espera a rodada para as setas.
- **Achar mais rápido no Hoje.**
  - **Filtrar o Hoje por um assunto:**
    - O Hoje inteiro mostra só o que fala do assunto: Mercado hoje, Radar, Research, Debate e Todas as notícias.
    - Uma faixa avisa "Mostrando só o que fala de …", e o filtro também aparece no "Nesta página", que fica preso no
      alto ao rolar.
    - Seções sem nada do assunto ficam fora da vista enquanto o filtro está ligado.
    - "Limpar filtro" volta tudo.
  - **Tocar num ativo do Mapa de atenção** filtra o Hoje pela empresa. A ficha dela fica a um toque, na faixa do filtro.
  - **A busca** (lupa ou tecla /) abre com os assuntos do momento, os ativos da carteira e as suas últimas buscas.
  - **"Nesta página"** mostra quantos itens tem cada seção.
  - **Na Biblioteca**, a busca aceita `assunto:petroleo` (ou china, inflacao…).
- **Títulos maiores.** Os títulos das seções passam para uns 24 px no computador.
  - Embaixo de cada um, uma linha diz o que tem ali.
  - Os links do cabeçalho (Pauta da semana, Ativos, Research, Debate) viram botões.
  - Nas outras telas, os títulos também crescem.
- **Rápida | Briefing | Aprofundada.** Embaixo dos botões, uma linha diz o que o modo escolhido mostra. Passando o mouse,
  aparecem os números de cada lista. Nada é apagado; o resto continua na Biblioteca.
- **ETFs de renda fixa do Brasil** (5PRE11, IRFM11, IDKA11, IMAB11, B5P211, LFTB11, DEBB11 e os demais dos pilares
  P1 a P4):
  - A coluna de notícias da ficha ganha o bloco **"Juros, inflação e fiscal no Brasil"**, com as notícias do Mercado
    hoje desses assuntos nas últimas 72 horas. Antes só entrava o que citava o índice ou a curva ("juros futuros",
    "DI futuro"), e por isso a lateral parecia parada.
  - A busca do tema passa a rodar **a cada hora no pregão** (dias úteis, das 9h às 19h). Fica fora do teto das buscas
    por empresa, então não atrasa as outras.
  - **Ata do Copom e riscos fiscais** passam a ligar a notícia ao tema dos ETFs de prefixado, IPCA+ e Selic, e entram
    na busca desses temas.

**O que saiu:** as barras por hora ("O dia até agora"), a seu pedido. Os números que ficavam ao lado delas continuam no
bloco dos assuntos.

## Como subir (um passo)

Em Add file › Upload files, arraste as pastas do pacote mantendo a estrutura (`docs/…`, `painel/…`, `robo/…`, `site/…`,
`testes/…`, `README.md`) e clique em Commit changes. A rodada desse envio fica verde. Ela publica o painel e o primeiro
`assuntos.json`, relendo 95 dias da biblioteca uma vez.

## Para mexer nos assuntos

Edite `robo/assuntos.json` pelo lápis do GitHub. Cada assunto tem:
- `palavras`, sem acento e em minúsculas, com `*` no fim para pegar o começo da palavra;
- `exatas`, como escritas.

Na rodada seguinte o robô refaz o histórico com a lista nova.

## Voltar atrás

Na lista de commits, abra o commit do envio e use Revert.

# Oregon Intelligence v4.0 · visual novo: moldura e Hoje (10/11/2026)

O pacote `robo-oregon-v4.0-alterados.zip` vale sobre a v3.11 que já está no seu GitHub. **Só o painel muda.** O robô,
as fontes, os horários e o `robo.yml` ficam como estão. Nenhuma chave nova e nenhuma API paga entram. **Um envio só.**

**O que você autorizou.** Mudar a aparência e a organização sem retirar nenhuma função, informação ou fonte, seguindo o
modelo aprovado no quadro de design. Esta é a primeira entrega: a moldura de todas as telas e a tela Hoje. A ficha da
empresa e Mundo e Estratégia vêm na v4.1.

## O que muda na tela

- **Menu lateral no computador** (telas a partir de 1024 px de largura):
  - a marca, a busca e as seis seções com ícones;
  - embaixo das seções, as páginas da seção aberta (em Brasil: Ativos brasileiros, Pauta da semana, Agenda de
    proventos…). É a mesma lista que antes ficava em botões no alto da página;
  - no pé, o cartão da coleta: a hora da última coleta (toque para o detalhe, a aparência e o "Coletar agora"), um anel
    com quanto falta para a próxima rodada, e os botões **Atualizar** e **Coletar agora**.
  - No celular e no tablet, a barra de seções continua como estava (embaixo no celular), agora com ícones.
- **Cores e letras da Oregon:** azul-marinho e verde-azulado das lâminas, títulos em Lexend Deca, texto em IBM Plex Sans.
  Tema escuro e claro continuam (detalhe da coleta › Aparência).
- **Hoje:**
  - **"O dia até agora"** no alto: quantas notícias chegaram em cada hora de hoje, em barras. As horas com manchete de
    macro do Brasil têm um ponto amarelo. Toque numa barra para ver a hora e a manchete; toque na manchete para abrir.
    Os números de antes (acontecimentos nas carteiras, opiniões de casas) ficam ao lado e continuam abrindo as listas.
  - Duas colunas: **Mercado hoje** e **Radar das teses** na principal; **Mapa de atenção**, **Agenda decisiva**,
    **Alertas** e **Fila de leitura** na lateral. **Research global** e **Debate de mercado** lado a lado embaixo.
    **Todas as notícias** no fim, como antes.
  - "Para começar o dia" e o Radar das teses em cartões.
  - No celular e em telas estreitas fica tudo numa coluna, com o mapa da carteira primeiro (como antes).
- **Tipo de cada notícia por extenso** (Notícia, Resultado, Opinião, Carta, Estudo, Fato relevante ou Documento à
  CVM) no lugar das letras N, R, O, C, E, F. As cores de cada tipo continuam.
- **As outras telas** (Brasil, Mundo e Estratégia, Carteiras, Biblioteca, VG VIP) ganham a moldura, as cores e as letras
  novas, com o mesmo conteúdo e a mesma ordem. O redesenho delas vem nas próximas entregas.

**Nada foi retirado.** Todas as seções, listas, filtros, botões, links e fontes de antes estão na tela; os testes conferem
isso. O que mudou de lugar: os botões das páginas da seção (para o menu lateral, no computador) e os dois números da faixa
do topo (para dentro de "O dia até agora").

## Voltar ao visual antigo

- No computador: "Voltar ao visual antigo", no pé do menu lateral.
- No celular: o mesmo botão no fim de cada página.
- Para voltar ao novo: "Visual novo", no topo, ou "Usar o visual novo", no fim da página.
- A escolha fica guardada só neste navegador. O visual antigo é exatamente o de antes.

## Como subir (um passo)

Em Add file › Upload files, arraste as pastas do pacote mantendo a estrutura (`docs/…`, `painel/…`, `site/…`, `testes/…`,
`README.md`) e clique em Commit changes. O `robo.yml` não muda, então a rodada desse envio fica verde e publica o
painel novo. Quem estiver com a aba aberta recebe a faixa "O painel foi atualizado no GitHub" com o botão Recarregar.

## Voltar atrás

Na lista de commits, abra o commit do envio e use Revert. Para só usar o visual antigo, o botão acima basta.

# Oregon Intelligence v3.11 · corrente de rodadas e painel novo no Atualizar (09/11/2026)

O pacote `robo-oregon-v3.11-alterados.zip` vale sobre a v3.10 que já está no seu GitHub (commit d92a447). Nada foi
retirado, nenhuma chave nova entra e nenhuma API paga entra. **O `robo.yml` muda: são dois passos** (no fim desta seção).

**Por quê.** Em 09/11 a última rodada foi a das 09:53. Depois dela o GitHub não começou nenhuma das 18 rodadas agendadas
entre 10:07 e 14:22. Desde a meia-noite, das 28 agendadas, só 2 saíram. Nenhuma falhou: o agendador do GitHub atrasa e,
com carga alta, descarta rodadas (está na documentação dele). Pôr mais horários não resolve, porque ele descarta todos.

## O que entra

- **Corrente de rodadas.** Cada rodada, ao terminar, dispara a seguinte pelo próprio GitHub. Esse disparo não passa pelo
  agendador que descarta horários; a documentação do GitHub diz que ele sempre cria a rodada.
  - **Frequência:** a cada 15 minutos das 6h às 23h e a cada 30 minutos de madrugada, contados do início da rodada
    anterior. Depois de uma rodada com falha, espera 60 minutos (para não encher seu e-mail de avisos se algo quebrar).
  - **Cada fonte continua no próprio intervalo.** A rodada da corrente funciona como a agendada: páginas de gestoras,
    cartas, buscas de macro e as demais fontes com intervalo seguem o delas. Feeds RSS e buscas por empresa, que já eram
    lidos a cada rodada, passam a ser lidos a cada 15 minutos também fora do pregão (antes, a cada 30) e a cada 30 minutos
    de madrugada. Só o "Coletar agora" lê tudo, como antes.
  - **Nunca duas ao mesmo tempo.** Se já existir uma rodada mais nova (sua, de horário ou de envio), é ela que segue a
    corrente.
  - **Os horários continuam de reserva.** Se a corrente parar, o primeiro horário que o GitHub disparar, ou um "Coletar
    agora", a religa.
  - **Sem custo e sem chave nova.** Usa a chave temporária que o GitHub dá a cada rodada e que vale só enquanto ela roda.
    O repositório é público, então os minutos são gratuitos.
  - **O "Coletar agora" não fica esperando a corrente:** ele começa assim que a coleta anterior termina.
  - **Para desligar:** em `robo/config.json`, `intel` → `corrente` → troque `"ativo": true` para `false`. Ficam só os
    horários. Os intervalos também ficam ali (entre 5 e 60 minutos).
  - **Sempre no ramo main.** Uma rodada de teste em outro ramo não leva a corrente para lá.
- **O Atualizar traz o painel novo.** Quando o GitHub publica uma versão nova do painel e a sua aba está aberta com a
  antiga, o Atualizar avisa e recarrega a página. Sem tocar em nada, aparece no rodapé "O painel foi atualizado no GitHub"
  com o botão **Recarregar**. Foi o que aconteceu hoje: a aba aberta desde cedo não mostrava o aviso de atraso, que já
  estava no site.
- **Hora da próxima coleta:** no detalhe da coleta e no Atualizar, a hora prevista passa a ser a da corrente.
- **Aviso de atraso mais exato.** Quando a coleta de uma rodada falha, ela ainda aparece "em andamento" no GitHub por até
  1 hora, enquanto espera para disparar a próxima. O aviso não diz mais "está rodando, os dados chegam em uns 10 minutos"
  nesse caso. Ele diz que a rodada passou do tempo normal ou que falhou, e mostra o "Coletar agora".

**Limite.** Se o Actions inteiro do GitHub cair, nada roda, nem a corrente nem os horários. O aviso de atraso no topo do
Hoje continua avisando.

## Como subir (dois passos, porque o `robo.yml` muda)

1. **Primeiro o pacote.** Em Add file › Upload files, arraste as pastas do pacote mantendo a estrutura (`docs/…`,
   `painel/…`, `robo/…`, `site/…`, `testes/…`, `README.md`) e clique em Commit changes.
   - A rodada que esse envio dispara vai falhar no teste. É esperado: o teste exige o `robo.yml` novo, que só chega no
     passo 2. Nada se perde: os dados e o site ficam como estavam.
   - Se a pasta `.github` também entrar no arrastar, a rodada já fica verde e o passo 2 não é preciso.
2. **Depois o horário.** No GitHub, abra `.github/workflows/robo.yml` e clique no lápis (Edit). Apague tudo, cole o
   conteúdo inteiro do arquivo `robo.yml` que vai junto e clique em Commit changes. Essa rodada fica verde, publica e
   começa a corrente.

**Como conferir.** Na aba Actions, cada rodada passa a ter uma terceira etapa, **seguinte**. Ela termina com "Próxima rodada
disparada às …". Uns 15 minutos depois aparece uma rodada nova com o evento `workflow_dispatch`.

## Voltar atrás

Na lista de commits, abra o commit do envio e use Revert. Para só parar a corrente, basta o `"ativo": false` acima.

# Oregon Intelligence v3.10 · macro do Brasil (09/11/2026)

O pacote `robo-oregon-v3.10-alterados.zip` vale sobre a v3.9.1 que já está no seu GitHub (commit 71ae922, com o
`robo.yml` novo). **Desta vez o `robo.yml` não muda: é um envio só.** Nada do que existia sobre empresas foi retirado ou
mudou de nota.

## O que entra

- **Mercado hoje · Brasil**, no Hoje, logo depois do mapa de atenção, em todos os modos (inclusive Rápida).
  - **"Para começar o dia":** as matérias de agenda do dia.
  - **Depois:** juros, inflação, câmbio, bolsa, fiscal e atividade das últimas 18 horas, sem repetir o mesmo fato.
  - **Filtro:** botões por assunto no alto do bloco.
  - **Atalho:** "Mercado hoje" em "Nesta página".
- **Filtro "Macro Brasil"** em Todas as notícias.
- **O robô marca a macro do Brasil** pela manchete.
  - A notícia de macro pura ganha +8 na nota, com o motivo escrito ("macro do Brasil: …"). Notícia que cita empresa da
    carteira fica com a nota de antes.
  - Notícia de macro passa no filtro de tema da imprensa.
  - Manchete só do exterior não conta: o mundo continua em Mundo e Estratégia.
- **Mais fontes de macro:**
  - **InfoMoney**, como exceção (ver abaixo).
  - **IstoÉ Dinheiro**, a validar na primeira rodada.
  - **Seis buscas de macro do Brasil** (juros, inflação, Ibovespa, dólar, fiscal, agenda do dia). Trazem Valor, CNN,
    Estadão, Poder360 e outros que não têm feed aberto, e não diminuem as buscas das empresas.
- **Telegram:** o resumo da manhã ganha **"Mercado hoje · Brasil"**, com até 5 manchetes das últimas 18 horas e a agenda
  do dia primeiro. Para tirar a seção, troque `"telegram": true` para `false` em `intel.mercado_hoje`, no
  `robo/config.json`.
- **InfoMoney (Grupo XP), exceção que você pediu:**
  - Entra só como notícia no painel, com o selo **"Grupo XP"** em toda linha.
  - Fica fora da pauta da semana (Oregon e VIP), do fechamento da semana, das sugestões do comitê e do Telegram.
  - Os demais veículos do Grupo XP continuam bloqueados.

**Quando aparece.** A marcação vale também para o que já foi coletado: a próxima rodada reclassifica tudo (regras 38).
Na primeira rodada depois do envio, o bloco já aparece com as notícias de macro dos últimos dias.

## Como subir

1. Em Add file › Upload files, arraste as pastas do pacote mantendo a estrutura (`robo/…`, `painel/…`, `site/…`,
   `testes/…`, `docs/…`, `README.md`).
2. Clique em Commit changes.
3. A rodada que dispara testa e publica sozinha.

## Voltar atrás

Na lista de commits, abra o commit do envio e use Revert.

# Atualização pequena v3.9.1 · menos buracos na coleta (09/11/2026)

O pacote `robo-oregon-v3.9.1-alterados.zip` vale sobre a v3.9 que já está no seu GitHub (commit 630c68c, com o inglês).

**Por quê.** Na noite de 08 para 09/11, o GitHub disparou só 2 das 6 coletas agendadas, às 23:56 e às 03:10, com até
2 horas de atraso. A das 04:15 e a das 07:07 não vieram. A documentação do GitHub avisa que o disparo agendado "pode atrasar
em períodos de muita carga" e que execuções na fila "podem ser descartadas". O robô em si não falhou.

**O que entra.**
- **Mais rodadas:** às 02:07, 03:07, 05:07, 05:37, 06:07 e 06:37 (a manhã chega pronta antes das 7h). Também aos 22 e aos
  52 minutos das 09:22 às 18:52: se o GitHub pular uma rodada, a seguinte vem em 15 minutos. Vale para todos os dias, como
  a coleta já era.
  - Nenhuma rodada saiu. Não há custo, porque o repositório é público.
  - Cada fonte continua respeitando o próprio intervalo, então os sites não são lidos com mais frequência.
- **Aviso de atraso no topo do Hoje e no detalhe da coleta** (o ponto com a hora, lá em cima). Quando uma coleta prevista
  passa 25 minutos da hora sem chegar, o painel diz qual foi e destaca o "Coletar agora". Exemplo: "Atraso do GitHub: ele
  não disparou a coleta prevista das 04:15; nada novo desde a coleta das 03:11."
  - O painel confere a situação na página pública de execuções do GitHub, sem chave, só quando há atraso. Se uma coleta
    estiver rodando, o aviso diz "está rodando agora (começou às 07:15)" e não pede para você coletar.
- **Hora da próxima coleta:** no detalhe da coleta e no "Atualizar", a hora prevista já considera os horários novos.

**Você não precisa clicar em nada no dia a dia.** O robô roda sozinho; o "Coletar agora" é só para quando o aviso
aparecer e você não quiser esperar.

**Como subir (dois passos, porque o `robo.yml` muda nesta versão).**
1. **Primeiro o horário.** No GitHub, abra `.github/workflows/robo.yml` e clique no lápis (Edit). Apague tudo, cole o
   conteúdo inteiro do arquivo `robo.yml` que vai junto e clique em Commit changes.
   - A rodada que esse envio dispara vai falhar no teste. É esperado: o teste exige que o `robo.yml` fique igual ao
     `docs/workflow_robo.yml`, que só chega no passo 2.
   - Nada se perde: os dados e o site ficam como estavam.
2. **Depois o pacote.** Em Add file › Upload files, arraste as pastas do pacote mantendo a estrutura (`docs/…`,
   `painel/…`, `site/…`, `testes/…`) e clique em Commit changes. Essa rodada fica verde e publica.
   - Se a pasta `.github` também entrar no arrastar, não tem problema: o conteúdo é o mesmo do passo 1.

**Voltar atrás.** Na lista de commits, abra o commit do envio e use Revert.

# Oregon Intelligence v3.9 · inglês do mercado (08/11/2026)

O pacote `robo-oregon-v3.9-alterados.zip` vale sobre a v3.8.2 que já está no seu GitHub (commit 679c852, com o research
das casas). Nada foi retirado, nenhuma chave vai para arquivo e nenhuma API paga entra. O horário do robô (`robo.yml`) não
muda.

## O que entra

**Biblioteca › Inglês**, uma página nova com cinco partes:
- **Inglês do dia**, de 15 a 20 minutos. São 5 manchetes reais em inglês que o robô coletou nas últimas 48 horas, de veículos
  diferentes sempre que possível, escolhidas pelos termos de mercado que trazem.
  - Primeiro você **ouve sem ler**. Depois mostra o texto, toca nos termos marcados para ver a explicação, traduz e
    **repete em voz alta**: o navegador marca as palavras que entendeu.
  - Depois vêm 3 frases para você **falar**. Duas são sobre ações da Carteira Oregon, montadas só com o nome, o setor e
    o pilar do painel. A terceira usa um termo do glossário.
  - As manchetes do dia ficam as mesmas até a meia-noite. A página conta os dias seguidos de estudo.
- **Revisar vocabulário**, em cartões: acertou, o cartão volta em 1, 3, 7, 14 e 30 dias; errou, volta na mesma sessão.
- **Meu vocabulário**: frases e termos salvos com um toque, nas notícias, no Inglês do dia ou no glossário.
  - **Exportar para o Anki**: arquivo de texto que abre em Arquivo › Importar, no Anki 2.1.55 ou mais novo.
  - **Exportar e Importar (JSON)**: leva o vocabulário para outro aparelho.
- **Glossário do mercado**: 187 termos em inglês e português, com explicação curta, exemplo e pronúncia. Tem busca nas
  duas línguas.
- **Podcasts curtos em inglês**: só links oficiais conferidos: Thoughts on the Market, Markets in Motion, The Indicator e
  Marketplace Morning Report.

**Nas outras telas:**
- Toda manchete em inglês ganha o botão **▶ EN**, que lê a manchete em voz alta.
- Ao abrir uma notícia em inglês, aparece a barra com Ouvir, Mais devagar, Ouvir com o resumo, Traduzir, Repetir e
  conferir, Salvar frase e os termos do glossário.

**Telegram:** o briefing da manhã ganha a seção **Inglês do dia**. Ela traz uma manchete em inglês das últimas 36 horas,
até 3 termos com a tradução, um link para traduzir a frase e outro para praticar no painel. Para tirar a seção, troque
`"telegram": true` para `false` em `intel.ingles`, no `robo/config.json`.

**Como funcionam a voz, o microfone e a tradução:**
- **Voz e microfone:** são do seu navegador, sem custo e sem chave. Funcionam no Chrome (computador e Android) e no Safari
  do iPhone; no Firefox não há reconhecimento de fala.
- **Na primeira vez:** o navegador pede licença para usar o microfone.
- **No iPhone:** o Ditado precisa estar ligado em Ajustes › Geral › Teclado.
- **No Chrome:** o áudio do microfone é processado pelo serviço de voz do Google. O Oregon não grava nada.
- **Tradução:** no Chrome do computador, sai a tradução do próprio Chrome, feita no aparelho, quando ela existe. Nos
  outros casos, abre o Google Tradutor com a frase.
- **Velocidade da voz:** 0,75× (o padrão) ou 1×, no topo da página. A voz vem do aparelho; se a página disser "sem voz em
  inglês", instale uma voz em inglês nas configurações do sistema.

## 1. Suba os arquivos (um só envio)

1. Em Add file › Upload files, arraste as pastas do pacote mantendo a estrutura (`robo/…`, `painel/…`, `site/…`,
   `testes/…`, `docs/…`, `README.md`).
2. Clique em Commit changes.
3. A rodada que dispara testa e publica sozinha.

## 2. Conferência (3 minutos)

1. Abra Biblioteca › Inglês, toque em ▶ Ouvir e em Mostrar o texto.
2. Toque em Repetir e conferir. O navegador pede o microfone; libere e fale a frase.
3. A seção do Telegram aparece no briefing do dia seguinte, às 7h30.

## 3. Voltar atrás

Na lista de commits, abra o commit do envio e use Revert. O vocabulário salvo fica no navegador e não se perde.

# Atualização pequena v3.8.2 · research das casas (08/11/2026)

O pacote `robo-oregon-v3.8.2-alterados.zip` vale sobre a v3.8.1 que já está no seu GitHub (commit c5c79fe, com as
comunidades do Reddit). Só o painel muda. O robô, o horário e os segredos ficam como estão.

**O que entra.**
- **Mundo e Estratégia › Research global** ganhou, no fim da página, a seção **Research das casas · consulta externa**.
  São 23 casas: 8 do Brasil e 15 globais. Cada link leva à página de estudos e publicações da casa e abre no seu
  navegador. O sumário "Nesta página" tem o atalho para ela.
- **Mundo e Estratégia › Debate de mercado**: em "Onde o mercado discute", uma linha curta com um link por casa.
- **Brasil:** BTG Pactual, Itaú (Análises e Análises econômicas do Itaú BBA), Genial, BB Investimentos, Safra,
  Santander, Suno e Ágora.
- **Global:** Goldman Sachs, J.P. Morgan, Morgan Stanley, BofA, Citi, UBS, Barclays, Deutsche Bank, HSBC, Jefferies,
  Nomura, Société Générale, BNP Paribas, RBC Capital Markets e Wells Fargo.
- **Itaú:** Consenso de Mercado, Cockpit do Copom, Carta do Gestor e Radar de Preferências não têm página própria. Saem
  dentro de Análises, e a tela avisa isso.
- **Login:** a marca "login" indica que os relatórios completos pedem conta de cliente. A página pública abre
  normalmente.
- **Grupo XP:** nenhum veículo do grupo entra (XP Conteúdos, InfoMoney, Rico, Clear).
- **Sem coleta:** o Oregon não coleta, não guarda e não confere esse conteúdo. São só links, como os do Reddit.

**Como subir.**
1. Em Add file › Upload files, arraste as pastas do pacote mantendo a estrutura (`painel/…`, `docs/…`).
2. Clique em Commit changes.
3. A rodada que dispara testa e publica sozinha. Em uns 5 minutos, abra Mundo e Estratégia › Research global e role até
   o fim.

**Voltar atrás.** Na lista de commits, abra o commit do envio e use Revert. Ou suba de novo os arquivos da v3.8.1.

# Atualizar para o Oregon Intelligence v3.8 e como voltar atrás

O pacote `robo-oregon-v3.8-alterados.zip` atualiza o que está hoje no seu GitHub, a **v3.5** (commit "Add files via
upload" de 08/11, 15:56). Ele já traz a **v3.6 e a v3.7 inteiras** (ver os guias abaixo); basta subir este pacote, sem
os anteriores. Nada foi retirado, nenhuma chave vai para arquivo e nenhuma API paga entra.

## O que entra na v3.8

**Brasil › Fluxo dos fundos.** Mostra se o dinheiro está entrando ou saindo dos fundos brasileiros, por classe (Ações,
Multimercado, Renda Fixa, Cambial), semana a semana e mês a mês. Uma barra mostra o fluxo dos fundos de ações.
- Fonte: o informe diário que cada fundo entrega à CVM (captação e resgate do dia), nos dados abertos, com a classe
  tirada do cadastro da CVM.
- Fundos de cotas ficam de fora, porque o mesmo dinheiro contaria duas vezes.
- O robô lê uma vez por dia, a partir das 9h: o mês corrente e o anterior, que a CVM ainda reapresenta. O histórico
  publicado nunca é apagado.
- O **Fechamento da semana** ganhou a linha do fluxo.

**Fontes que falhavam na rodada real de 08/11.**
- **Pausa automática:** a fonte que falha 3 vezes seguidas passa a ser tentada só uma vez por dia. Isso vale para
  bloqueio 403 (Squadra, Safra, Santander, Itaú), tempo esgotado (IBGE, Genial) e endereço que sumiu. Ela deixa de gastar
  o prazo da rodada e de aparecer como falha a cada 30 minutos. Em Fontes e coleta aparece como "em pausa · 1 tentativa
  por dia". Nada é contornado; quando a fonte volta a responder, sai da pausa sozinha.
- **SPX Capital:** as cartas voltam a ser lidas. O Issuu passou a usar links relativos e o padrão antigo exigia
  "issuu.com" no link. Entra só a versão em português, com o mês tirado do título ("CARTA À EQUIPE - 10.26" = outubro).
- **CNN Brasil · Economia** foi desligada, com o motivo registrado: o site não tem mais feed RSS. As manchetes da CNN
  continuam chegando pela busca.
- **Quem tem a ação:** o robô agora espera 10 segundos entre um arquivo e outro da CVM, como pede o robots.txt dela
  (Crawl-Delay).

## 1. Suba os arquivos (um só envio)

1. Descompacte o `robo-oregon-v3.8-alterados.zip`. Ele tem os 42 arquivos que mudaram desde a v3.5.
2. No GitHub, repositório `robo-oregon` → **Add file** → **Upload files**.
3. Arraste **as pastas** `docs`, `painel`, `robo`, `site` e `testes` e o `README.md` de uma vez.
4. Escreva "Oregon Intelligence v3.8" e **Commit changes**.

## 2. Mude o horário do robô (se ainda não mudou)

O teste do robô confere se `.github/workflows/robo.yml` é **idêntico** à cópia `docs/workflow_robo.yml`. Por isso, troque o
conteúdo inteiro do arquivo, não só as duas linhas de `cron`. Se os dois forem diferentes, a rodada para no teste e nada
é publicado.

1. No GitHub, abra `docs/workflow_robo.yml` (já subiu com o pacote) e toque em **Copy raw file**, o ícone de copiar no
   alto do arquivo.
2. Abra `https://github.com/lucaslimaequity-a11y/robo-oregon/edit/main/.github/workflows/robo.yml`, selecione tudo
   (Ctrl+A), cole (Ctrl+V) e toque em **Commit changes**.

O commit dispara uma rodada; em Actions ela deve aparecer verde.

## 3. Primeira rodada e conferência

- O envio já dispara uma rodada.
- **Fluxo dos fundos:** aparece na primeira rodada depois das 9h. Se você subir antes das 9h, use **Coletar agora**
  depois desse horário.
- **Para conferir:**
  1. **Brasil › Fluxo dos fundos**: semana a semana e mês a mês.
  2. **Carteiras › Fechamento da semana**: a linha "Fluxo dos fundos".
  3. **Biblioteca › Fontes e coleta**: as fontes em pausa e a SPX com a primeira leitura.
- Se o fluxo não aparecer, o log da rodada (Actions › rodada › "Coleta") traz a linha `fluxo dos fundos:` com as colunas
  que a CVM usou. Mande para mim que eu ajusto.

## 4. Voltar atrás

No GitHub, abra o commit "Oregon Intelligence v3.8" → **Revert**. O `biblioteca/fluxo_fundos.json` fica no ramo `dados`
e só para de ser atualizado.

---

# Guia da v3.7 (histórico)

O pacote `robo-oregon-v3.7-alterados.zip` atualiza o que está hoje no seu GitHub, que é a **v3.5** (commit "Add files via
upload" de 08/11, 15:56). Por isso ele já traz a **v3.6 inteira** (Comitê do mês, proventos, quem tem a ação, termômetro
das cartas, wealth, trilha, lente global): basta subir este pacote, sem o da v3.6. Tudo pelo site do GitHub, sem
instalar nada. Nenhuma chave vai para arquivo e nenhuma API paga entra. Nada foi retirado: a v3.7 só acrescenta.

## O que entra na v3.7

**Coleta e botão Atualizar**
- O robô passa a rodar aos **7 e aos 37 minutos** de cada hora (das 7h às 22h37, e à 1h15 e às 4h15), na mesma
  frequência de antes. Motivo: na página Actions, hoje só houve **uma** rodada agendada; as outras vieram dos seus envios.
  A documentação do GitHub avisa que a hora cheia é horário de pico, quando as rodadas atrasam ou são descartadas, e
  recomenda outro minuto. É a única mudança no workflow (passo 2 abaixo).
- No topo, a coleta virou um ponto com a hora (não corta mais). Ao tocar, abre um quadro com:
  - a última coleta e a próxima prevista;
  - "Atualizar agora", "Coleta por fonte" e **Coletar agora** (abre a página do robô no GitHub para você tocar em
    "Run workflow", com o seu login; nenhuma chave fica no site);
  - aparência: automático, claro ou escuro;
  - "sempre mostrar as explicações".
- Depois de **Atualizar** aparece uma de duas mensagens: "Conferido às 17:40: nada novo desde a coleta das 15:57.
  Próxima coleta prevista às 18:07" ou "chegou a coleta das…".

**Hoje**
- **Faixa do dia** logo abaixo da data. Ela mostra quantos acontecimentos houve nas carteiras e quantas opiniões de casas
  saíram, os ativos com data-com até sexta, as cartas do mês que citam a carteira, os itens na pauta do comitê e as
  novidades das buscas salvas. Cada trecho leva à lista.
- **Alertas das suas buscas** (as buscas salvas, com as manchetes novas) e **Sua fila de leitura** ("Ler depois", agora
  também nos itens da Estante, com "já li").
- As quatro áreas ficam em duas colunas independentes, sem buraco embaixo do Radar ou do Debate.
- Blocos vazios ocupam uma linha. A barra "Nesta página" fica presa no topo ao rolar.
- Em "Todas as notícias": filtro por **tipo de evento** e legenda das marcas.

**Achar o que importa**
- **Marca por tipo** em toda linha de notícia, sempre com a mesma letra e cor:
  - F: fato relevante ou CVM
  - R: resultado
  - O: opinião de casa
  - C: carta
  - E: estudo ou research
  - N: notícia
- **Tipo de evento** pela manchete, só em notícia de empresa: recompra, fusões e aquisições, guidance, troca na gestão,
  emissão de dívida e oferta de ações. "Bradesco reduz projeção do PIB" e os avisos de participação acionária (art. 12)
  não contam.
- **Brasil › Mudanças de recomendação**: quando uma casa muda a recomendação, o preço-alvo ou o sentido sobre um ativo
  (Oregon e VIP), lado a lado com a visão anterior da mesma casa. Períodos de 7, 30 ou 90 dias. Sem média nem consenso.
- **Termômetro das cartas**: além da contagem, até duas frases literais da carta por empresa, com o link. Há também a
  visão **Ao longo dos meses**, uma grade empresa × mês que agora cobre 6 meses.
- **Busca com filtros**, na Pesquisa e na busca do topo:
  - `"frase exata"`
  - `fonte:Valor`
  - `desde:10/2026` e `até:15/11/2026`
  - `ativo:PETR4`
  - `evento:recompra`
  - `tipo:carta`
  - `-palavra` para deixar de fora

**Consolidar**
- **Carteiras › Fechamento da semana**: a semana em oito blocos, com Copiar e Imprimir, para esta semana e as três
  anteriores. Os blocos são fatos e resultados, eventos corporativos, mudanças de recomendação, opiniões, proventos
  anunciados, cartas, research e o que foi levado ao comitê.
- **Imprimir** no Comitê do mês, nas Pautas da semana (Oregon e VIP) e no Fechamento: a folha sai em A4 limpa, e o
  navegador também salva em PDF.
- **Telegram**: o resumo diário ganha "Data-com amanhã" e "Cartas novas que citam a carteira".

**Visual e celular**
- **Modo escuro**: segue o aparelho ou é escolhido no quadro do topo.
- As explicações cinza de cada tela ficam num **"?"** ao lado do título. O texto continua lá; marque "sempre mostrar" se
  preferir.
- **Mapa de atenção da VIP enxuto**: só ganha quadrado quem teve acontecimento; os demais aparecem numa linha
  "sem notícias: …".
- **Ficha mais larga**: a lista de ativos da aba Brasil recolhe num botão e a ficha ocupa a largura toda. Os nomes da
  lista não quebram mais em três linhas.
- **No celular**:
  - as seções ficam numa barra embaixo, ao alcance do polegar;
  - as áreas do Hoje abrem fechadas, com a contagem (só o Radar abre aberto), e o celular lembra o que você abriu;
  - cada notícia ocupa duas linhas de título mais uma linha com hora, veículo e ativo.
  - Com os dados de teste, o Hoje no celular caiu de cerca de 5.000 px para menos de 2.000 px de altura.
- **Títulos**: o site já usa a IBM Plex Serif, a fonte da identidade da Oregon. A Times que aparecia nas minhas capturas
  anteriores era só do meu ambiente de teste, que não baixa fontes. Por isso a tipografia ficou como está. O que mudou
  foram os números alinhados nas tabelas.

**Correção na Estante.** Na rodada real de 08/11, a GMO apareceu como "completa" com 0 itens, e o Compounding Quality
ficou sem vez: o limite de páginas da rodada acabou nas primeiras coleções. Agora a coleção que nunca foi lida vai
primeiro, e só fica "completa" depois de lida.

## 1. Suba os arquivos (um só envio)

1. Descompacte o `robo-oregon-v3.7-alterados.zip`. Ele tem os 39 arquivos que mudaram desde a v3.5, nas pastas certas.
2. No GitHub, repositório `robo-oregon` → **Add file** → **Upload files**.
3. Arraste **as pastas** `docs`, `painel`, `robo`, `site` e `testes` e o `README.md` de uma vez.
4. Escreva "Oregon Intelligence v3.7" e **Commit changes**.

## 2. Mude o horário do robô (um minuto, no próprio GitHub)

A pasta `.github` costuma ficar escondida no computador, então o jeito mais simples é editar no site:

1. Abra `https://github.com/lucaslimaequity-a11y/robo-oregon/blob/main/.github/workflows/robo.yml` e toque no lápis
   (**Edit this file**).
2. Troque as duas linhas:
   ```
       - cron: '*/30 10-23 * * *'
       - cron: '*/30 0,1 * * *'
   ```
   por:
   ```
       - cron: '7,37 10-23 * * *'
       - cron: '7,37 0,1 * * *'
   ```
3. **Commit changes**. O arquivo completo também está no pacote, em `.github/workflows/robo.yml`, e a cópia visível fica em
   `docs/workflow_robo.yml`.

Arquivos do pacote (novos desde a v3.5 marcados com ★):

```
.github/workflows/robo.yml  README.md
docs/ARQUITETURA.md  docs/ATUALIZACAO.md  docs/FONTES.md  docs/RESULTADOS_TESTES.md  docs/workflow_robo.yml
painel/build.py  painel/dist/Oregon_Intelligence.html  painel/dist/painel_artifact.html
painel/src/app.css  painel/src/intel.js  painel/src/store.js  painel/src/ui_base.js  painel/src/ui_bib.js
painel/src/ui_hoje.js  painel/src/ui_oregon.js  painel/src/ui_vip.js
painel/src/ui_br36.js ★  painel/src/ui_comite.js ★  painel/src/ui_estudo36.js ★  painel/src/ui_v37.js ★
painel/test/areas.js  painel/test/gera_dados_teste.py
robo/analise.py  robo/biblioteca.py  robo/config.json  robo/conteudo.py  robo/estante.py  robo/fontes.json  robo/intel.py
robo/cartas.py ★  robo/fundos.py ★  robo/pdftexto.py ★  robo/proventos.py ★
site/index.html
testes/painel.test.js  testes/test_v36.py ★  testes/test_v37.py ★
```

O pacote completo (`robo-oregon-v3.7.zip`) tem o repositório inteiro, para guardar ou começar do zero.

## 3. Primeira rodada

Depois do envio, o GitHub já roda o robô sozinho (o envio dispara uma rodada). Se quiser, rode à mão: **Actions** →
**Oregon Intelligence** → **Run workflow** → `normal`. O que acontece:

- **Histórico**: é reclassificado com as regras novas (versão 37), e os itens de empresa ganham o tipo de evento. Nada é
  apagado.
- **Cartas**: até 6 por rodada. As novas vêm primeiro; depois as já lidas são reabertas uma vez, para tirar os trechos.
- **Proventos e Lente global**: entram já na primeira rodada.
- **Quem tem a ação**: só na rodada da noite (a partir das 21h).
- **Estante**: GMO e Compounding Quality são lidos nas próximas rodadas.
- **Resumo do Telegram**: sai na primeira rodada depois das 7h30.

## 4. Conferência (5 minutos)

1. **Hoje**: faixa do dia, Alertas e Fila, áreas em duas colunas, letras coloridas nas notícias. Toque no ponto da coleta
   no topo e confira o quadro com "Coletar agora" e a aparência.
2. **Brasil › Mudanças de recomendação** e **Carteiras › Fechamento da semana**.
3. **Brasil › Termômetro das cartas**: trechos dentro de "N gestoras" e a visão "Ao longo dos meses".
4. **Biblioteca › Pesquisa**: teste `evento:recompra` ou `fonte:"Money Times" ativo:KLBN4`.
5. **No celular**: as seções na barra de baixo, as áreas do Hoje fechadas e abrindo ao toque.
6. **Nas próximas horas**: em Actions, rodadas "schedule" aos :07 e :37.

## 5. Voltar atrás

No GitHub, abra o commit "Oregon Intelligence v3.7" → **Revert**. Para o horário, edite o `robo.yml` de volta para
`*/30`. Nada do que o robô publicou no ramo `dados` é apagado. O tema, a fila e as buscas salvas ficam no seu navegador.

---

# Guia da v3.6 (histórico)

O pacote `robo-oregon-v3.6-alterados.zip` atualiza a v3.5 que está no seu GitHub (commit "Add files via upload" de
08/11, 15:56; conferi que ele é idêntico à v3.5 que preparei). Tudo pelo site do GitHub, sem instalar nada. Nenhuma
chave vai para arquivo, nenhuma API paga entra e o workflow (`robo.yml`) **não muda**. Nada foi retirado: a v3.6 só
acrescenta.

## O que entra na v3.6

**Comitê do mês (Carteiras › Comitê do mês)**
- Pauta mensal nas seções do comitê: Macro e cenário, Dividendos (core), Valor (satellite), Fundos, Global, Riscos e
  Estudos.
- Botão **Levar ao comitê** em toda notícia, na janela de leitura e nos itens da Estante (toque de novo para tirar).
- **Sugestões do robô** do mês: fatos e opiniões sobre empresas das carteiras, documentos à CVM, macro oficial e research
  que saiu em mais de uma fonte. Veículo pouco conhecido fica de fora.
- **+ Item à mão** para o que não veio do robô (uma ideia, um link, um ponto da reunião), com seção e nota.
- **Copiar pauta**, baixar em texto, exportar e importar (JSON). A pauta fica neste navegador; para usar em outro aparelho,
  exporte num e importe no outro.

**Brasil**
- **Agenda de proventos**: dividendos, JCP e rendimentos anunciados (B3), em três visões. "Próximas datas" separa o que
  ainda dá direito (data-com à frente) dos pagamentos a receber. "Anunciado no ano" traz o DY 2026 pelo preço de referência
  (print da VIP ou Teses da Oregon, nunca a cotação do dia). "Todos os anúncios" lista tudo.
  Os próximos 14 dias aparecem também na Agenda decisiva do Hoje e na ficha de cada ação.
- **Quem tem a ação**: fundos e gestoras com a ação na carteira mensal entregue à CVM (CDA), quem entrou e quem saiu em
  relação ao mês anterior. Aparece também na ficha.
- **Termômetro das cartas**: quais empresas as cartas mensais das gestoras brasileiras citaram, mês a mês, e quais
  gestoras citaram. É contagem, não opinião. O robô lê o PDF da carta ou a página da carta; quando a página só traz "Leia
  aqui" (Dynamo, JGP), ele abre o PDF do mesmo site. O texto não é guardado.
- **Lente global** na ficha (Oregon e VIP): o que acontece com o setor no mundo, com os pares globais (ex.: Klabin →
  Suzano, UPM, Stora Enso). São 16 setores, pesquisados em inglês a cada 6 horas.
- **Ponte Oregon e VIP**: na ficha de um ativo que está nas duas, "Também na VG VIP · Carteira X" (e o caminho inverso).

**Mundo e Estratégia › Wealth e consultorias**: indústria de wealth, consultoria e planejamento financeiro. Entram
Kitces, InvestmentNews, WealthManagement.com, Financial Planning, Thinking Ahead Institute, notícias da CVM (regulação) e
seis pesquisas em português (consultorias CVM, assessorias, family offices, private banking, wealth no Brasil,
planejamento financeiro e CFP). Filtros: Brasil, Mundo, Regulação e Estudos.

**Biblioteca**
- **Trilha de estudo**: CFP (os 8 módulos do exame da Planejar) e CFA nível III (8 blocos). Para cada módulo, o que
  saiu no Research e na Estante sobre o tema.
- **Estante**: quatro acervos novos de alocação e wealth: Thinking Ahead Institute, NBIM (fundo soberano da Noruega),
  CAIA e Vanguard (research).
- **Hoje › Research › Clássico da semana**: um texto da Estante ligado ao tema que mais apareceu no research dos últimos 7
  dias. Muda toda semana e não repete as últimas 26 escolhas.

## 1. Suba os arquivos (um só envio)

1. Descompacte o `robo-oregon-v3.6-alterados.zip`. Ele tem só os 34 arquivos que mudaram, nas pastas certas.
2. No GitHub, repositório `robo-oregon` → **Add file** → **Upload files**.
3. Arraste **as pastas** de dentro do ZIP (`docs`, `painel`, `robo`, `site`, `testes`) e o `README.md` de uma vez.
4. Escreva "Oregon Intelligence v3.6" e **Commit changes**.

Arquivos do pacote (novos marcados com ★):

```
README.md
docs/ARQUITETURA.md  docs/ATUALIZACAO.md  docs/FONTES.md  docs/RESULTADOS_TESTES.md
painel/build.py  painel/dist/Oregon_Intelligence.html  painel/dist/painel_artifact.html
painel/src/app.css  painel/src/intel.js  painel/src/store.js  painel/src/ui_bib.js  painel/src/ui_hoje.js
painel/src/ui_oregon.js  painel/src/ui_vip.js
painel/src/ui_br36.js ★  painel/src/ui_comite.js ★  painel/src/ui_estudo36.js ★
painel/test/areas.js  painel/test/gera_dados_teste.py
robo/analise.py  robo/biblioteca.py  robo/config.json  robo/conteudo.py  robo/estante.py  robo/fontes.json  robo/intel.py
robo/cartas.py ★  robo/fundos.py ★  robo/pdftexto.py ★  robo/proventos.py ★
site/index.html
testes/painel.test.js  testes/test_v36.py ★
```

O pacote completo (`robo-oregon-v3.6.zip`) tem o repositório inteiro, para guardar ou para começar do zero.

## 2. Primeira rodada

**Actions** → **Oregon Intelligence** → **Run workflow** → modo `normal` → **Run workflow**. O que acontece:

- **Agenda de proventos**: lida na primeira rodada do dia (uma consulta por empresa, com pausa de 1 s). Aparece já na
  primeira rodada.
- **Termômetro das cartas**: até 6 cartas por rodada, das mais novas para as mais antigas (últimos 4 meses). Hoje há 13
  cartas no histórico (set–nov); em três rodadas todas estão lidas.
- **Quem tem a ação**: só na rodada da noite (a partir das 21 h), quando a CVM tem um mês completo novo. O arquivo da CVM
  tem uns 25 MB; a leitura leva poucos minutos.
- **Lente global e Wealth**: as pesquisas entram na primeira rodada; as fontes novas aparecem como "a validar" e passam a
  "ativa" quando respondem.
- **Estante**: as quatro coleções novas se completam aos poucos, como as da v3.5.
- As regras de classificação não mudaram de versão: nada é reclassificado.

## 3. Conferência (5 minutos)

1. **Carteiras › Comitê do mês**: sugestões à direita. Toque em **Levar** numa delas e em **+ Item à mão**. Numa notícia
   do Hoje, abra a linha e toque em **Levar ao comitê**.
2. **Brasil › Agenda de proventos**: data-com à frente e pagamentos a receber. Em **Anunciado no ano**, o DY 2026.
3. **Brasil › Termômetro das cartas**: o mês corrente com "N cartas lidas de M".
4. **Brasil › Quem tem a ação**: depois da primeira rodada da noite.
5. **Mundo e Estratégia › Wealth e consultorias** e **Biblioteca › Trilha de estudo**.
6. Ficha da Klabin (Brasil › Ativos): "Também na VG VIP", **Lente global · Celulose**, proventos e (à noite) fundos.
7. **Biblioteca › Fontes e coleta**: `wealth-kitces`, `wealth-investmentnews`, `wealth-wealthmanagement`,
   `wealth-financial-planning`, `wealth-thinking-ahead` e `cvm-noticias` com a primeira leitura.

Se "Quem tem a ação" não aparecer depois da rodada da noite, o log da rodada (Actions › rodada › "Coleta") traz a linha
`quem tem a ação:` com as colunas que a CVM usou. Mande para mim e eu ajusto. Os dados anteriores nunca são apagados.

## 4. Voltar atrás

No GitHub, abra o commit "Oregon Intelligence v3.6" → **Revert**. Os arquivos novos do ramo `dados`
(`biblioteca/proventos.json`, `fundos_acoes.json`, `cartas_mencoes.json`, `estante_destaque.json`) ficam lá, só param de
ser atualizados. A pauta do comitê fica no seu navegador e não é afetada.

---

# Guia da v3.5 (histórico)

O pacote `robo-oregon-v3.5-alterados.zip` atualiza a v3.4 que está no seu GitHub (commit "Add files via upload" de
08/11, 14:02). Tudo pelo site do GitHub, sem instalar nada. Nenhuma chave vai para arquivo e o workflow (`robo.yml`)
**não muda**. Nada do que já existia foi retirado: a v3.5 só acrescenta. O acréscimo da academia brasileira (fontes
novas da tarde de 08/11) já está dentro deste pacote.

## O que entra na v3.5

**Ajustes**
- Pesquisas do robô sem páginas de cotação; ETFs de índice (IMA-B, IRF-M, Tesouro) pesquisados também pelo índice.
- Genial lida pela página de cada ação (o sitemap de relatórios não respondia ao GitHub).
- Nord pelo sitemap do blog; Empiricus sem texto de venda.
- Artigo com data no futuro (ex.: CFA de 18/11) entra com a data em que foi detectado e o aviso da data da edição.

**Painéis**
- Ficha da ação: aba "Casas de análise", com o que cada casa diz hoje e o preço-alvo de cada uma ao longo de 12 meses.
- Brasil › Pauta da semana: notícias de cada empresa da Carteira Oregon por pilar, com "Copiar pauta".
- Research: filtro Brasil e mundo / Brasil / Mundo e "Temas em alta" (7 dias contra a média das 4 semanas).
- Biblioteca: buscas salvas, "Resumo do mês" por tema e a **Estante** (abaixo).
- Hoje: paper da semana; datas de resultado (anunciadas pelas companhias e, como referência, quando cada uma entregou o
  mesmo trimestre do ano passado).
- Telegram: alerta imediato de fato relevante ou opinião nova sobre empresa da carteira (até 5 por rodada).

**Fundos e relevância**
- Fundos (JURO11, CDII11, HGCR11, KNCA11, KNHF11, BTLG11, TRXF11, XPML11): notícias do segmento (FI-Infra, FII de papel,
  Fiagro, fundos de fundos, logística, renda urbana) e do macro que move o fundo (crédito privado, juro real, Selic).
  Textos didáticos genéricos ("O que são fundos imobiliários") não ficam mais ligados aos fundos.
- Patrocínio cultural e esportivo não liga mais à empresa ("Orquestra Petrobras Sinfônica", jogo Sub-20 Petrobras).
- O mesmo fato em vários veículos vira uma linha só, com "+N veículos" para abrir os outros.
- Veículo pouco conhecido, sem fato da empresa, fica recolhido em "baixa relevância" no Radar, na ficha e na pauta.
  Nada é apagado. No mesmo dia, veículo conhecido vem antes.

**Estante (Biblioteca › Estante)** — acervo permanente, que não sai da tela depois de 90 dias:
- Michael Mauboussin: os 235 textos de 1995 a set/2026 (índice público do Kevin Gee + série Consilient Observer do Morgan
  Stanley). Os anteriores a 2020 abrem o índice no site do próprio autor, porque a editora não os publica mais.
- CFA Institute Research Foundation: livros e monografias desde 1975 (como o "Exponential Wealth" do Ibbotson), com os
  resumos para investidores, profissionais e acadêmicos.
- Howard Marks: os 166 memos, de 1990 a set/2026.
- Damodaran: 58 papers e os posts do blog desde 2008.
- AQR e GMO: as bibliotecas de research completas.
- Compounding Quality (Pieter Slegers): o arquivo da newsletter desde 2023 (os posts novos também entram no Research).
- Busca por título, tema e década; "anotar o que aprendi" em cada item. Só título, data, link e o resumo que a página
  declara; o texto fica na fonte.

**VG VIP (aba nova, separada da Oregon)**
- Hoje VIP (mapa de atenção dos 35 ativos, radar, agenda das companhias e debate), Ativos (todas as colunas do print,
  por carteira, e a ficha de cada ativo com notícias, opiniões e casas de análise) e Pauta da semana por carteira.
- Os números são os do print de 08/11/2026; preço e variação do dia ficam congelados nessa data. Para atualizar, mande
  o print novo: eu refaço o `painel/src/vip.json` e mando o pacote.
- O robô guarda as notícias dos 22 ativos que só existem na VIP num campo à parte (`ativos_vip`). As telas da Oregon não
  leem esse campo, então as carteiras não se misturam. Os CNPJs desses 22 foram conferidos na B3 (e 12 também na CVM)
  para os documentos à CVM e os resultados.

## 1. Suba os arquivos (um só envio)

1. Descompacte o `robo-oregon-v3.5-alterados.zip`. Ele tem só os 32 arquivos que mudaram, nas pastas certas.
2. No GitHub, repositório `robo-oregon` → **Add file** → **Upload files**.
3. Arraste **as pastas** de dentro do ZIP (`docs`, `painel`, `robo`, `site`, `testes`) e o `README.md` de uma vez.
4. Escreva "Oregon Intelligence v3.5" e **Commit changes**.

Arquivos do pacote (novos marcados com ★):

```
README.md
docs/ARQUITETURA.md  docs/ATUALIZACAO.md  docs/FONTES.md  docs/RESULTADOS_TESTES.md
painel/build.py  painel/dist/Oregon_Intelligence.html  painel/dist/painel_artifact.html
painel/src/app.css  painel/src/intel.js  painel/src/tests.js  painel/src/ui_bib.js  painel/src/ui_hoje.js
painel/src/ui_oregon.js  painel/src/ui_vip.js ★  painel/src/vip.json ★
painel/test/areas.js  painel/test/gera_dados_teste.py
robo/analise.py  robo/biblioteca.py  robo/casas.py  robo/config.json  robo/estante.py ★  robo/fontes.json
robo/intel.py  robo/pesquisas.py  robo/resultados.py
robo/sementes/estante/mauboussin.json ★  robo/sementes/estante/howard-marks.json ★  robo/sementes/estante/damodaran.json ★
site/index.html
testes/test_v35.py ★
```

O pacote completo (`robo-oregon-v3.5.zip`) tem o repositório inteiro, para guardar ou para começar do zero.

## 2. Primeira rodada

**Actions** → **Oregon Intelligence** → **Run workflow** → modo `normal` → **Run workflow**. Nessa rodada o robô:
reclassifica o histórico com as regras novas (versão 36: ativos VIP, patrocínio, didático); publica a Estante com as
sementes (Mauboussin, Howard Marks, Damodaran) e começa a ler as listagens (CFA, AQR, GMO, Compounding Quality e o blog
do Damodaran), algumas páginas por rodada; e passa a buscar notícias dos 22 ativos novos da VIP. A Estante se completa
em um a três dias de rodadas normais; enquanto isso, a lombada mostra "completando".

## 3. Conferência (5 minutos)

1. **VG VIP** aparece como sexta seção no topo. Hoje VIP mostra os 35 ativos no mapa; Ativos mostra as três carteiras.
2. **Hoje** da Oregon não mostra VALE3, LREN3 nem outro ativo que só está na VIP.
3. **Biblioteca › Estante**: sete lombadas; Mauboussin com cerca de 235 itens e Howard Marks com 166.
4. Uma ficha de ação da Oregon tem a aba **Casas de análise**.
5. **Biblioteca › Fontes e coleta**: `compounding-quality`, `genial-paginas-acoes` e `nord-blog` com a primeira leitura.

## 4. Voltar atrás

No GitHub, abra o commit "Oregon Intelligence v3.5" → **Revert**. O histórico publicado no ramo `dados` não é apagado;
a Estante e as notícias VIP só deixam de ser atualizadas.

---

# Guia da v3.4 (histórico)


O pacote `robo-oregon-v3.4-alterados.zip` atualiza a v3.3 que está no seu GitHub (commit "Add files via upload" de
08/11, 11:47). Tudo é feito pelo site do GitHub, sem instalar nada. Nenhuma chave vai para arquivo. O workflow
(`robo.yml`) **não muda**.

## Acréscimo de 08/11 à tarde: academia brasileira (só fontes novas)

Nada foi alterado nem retirado: só entraram 25 fontes acadêmicas brasileiras em `robo/fontes.json` (revistas da SBFin,
FGV, USP, FUCAPE e Tesouro; working papers do Banco Central, FGV, FEA-USP, IPEA, BNDES e PUC-Rio; NEFIN-USP e estudos da
CVM). Para subir: descompacte `robo-oregon-v3.4.1-academia-br.zip` e envie as pastas `robo` e `docs` em **Add file →
Upload files** → **Commit changes**. Na rodada seguinte elas aparecem em Mundo e Estratégia › Research e na Biblioteca.
Detalhes em `docs/FONTES.md`.

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
