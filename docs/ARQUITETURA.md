# Oregon Investment Desk: análise comparativa e arquitetura

## 1. Os dois projetos antes da integração

### HTML original ("Painel Carteira Oregon")

**O que ele tinha de melhor e foi preservado:**

- **Identidade visual.** Usa a IBM Plex em três papéis: Serif para títulos e números-chave, Sans para leitura e Mono para tabelas. O fundo é cinza-claro, com cartões brancos e cores funcionais.
- **Mapa visual das carteiras.**
  - Uma rosca por carteira, colorida por pilar, com o peso em renda variável no centro e um selo vermelho quando a carteira não fecha 100%.
  - Tabela de carteiras × pilares.
  - "O que mudou da base 30/10 para o decidido".
- **Carteira em camadas.** Um sol de três anéis (classe, pilar, ativo) e a visão "pilar a pilar", com bandas.
- **Separação por bloco.** Brasil, renda fixa, exterior e alternativos, com cores próprias, e o comparativo "Perfis: decidido × base" com a escada de risco.
- **Sala de Gestão.** Leva o fato à mesa e roda um simulador de choques e o radar.

**Limitações encontradas:**

- Os números do mercado eram fixos, tirados do deck do Comitê; o original não tinha dados vivos.
- Tinha oito abas planas, sem hierarquia entre "hoje", "carteiras" e "estudo".
- A IA da Sala só funcionava dentro do claude.ai.
- Detectava as carteiras que não fecham a soma, mas não oferecia validação nem versões de proposta e aprovação.

### Painel do GitHub (versão anterior desta plataforma)

**O que ele tinha de melhor e foi preservado:**

- **Motor de validação** (`core.js`). Aponta as 10 carteiras inválidas com regra, impacto e o que fazer, sem normalizar.
- **Laboratório de propostas.** Separa versão aprovada, propostas e registro de aprovação, com histórico e justificativa.
- **Modelos de risco** (`quant.js`). Volatilidade, beta, drawdown, correlação, número efetivo de posições, otimização e dimensionamento, com metodologia documentada.
- **Motor de cenários e premissas de sensibilidade.** Cada premissa tem origem marcada: hipótese, premissa do gestor ou estimada.
- **Fichas das 21 teses**, diário de decisões e performance.
- **Mercado ao vivo e notícias** vindos do robô.

**Problemas:**

- **Visual.** Cabeçalho escuro e pesado, tabelas azuis gritantes, excesso de caixas e de texto, e nenhum dos gráficos do original.
- **Navegação.** Quatro áreas com até nove subseções cada. A página inicial era o diagnóstico de uma carteira, não o mercado do dia.
- **Mercado.** Ficava escondido numa subaba.

### Robô de coleta (v1)

**O que ele tinha de melhor e foi preservado:** a infraestrutura (GitHub Actions, ramo `dados`, Pages, Telegram), as fontes oficiais (BCB, Focus, Tesouro, Treasury) e a classificação de alertas.

**Problemas** (ver `docs/DIAGNOSTICO.md`):

- O Yahoo bloqueava os pedidos e o disjuntor da v1 parava tudo.
- 1 de 54 cotações chegava, e mesmo assim a rodada aparecia como "saudável".
- O erro do Telegram vinha sem descrição.
- As notícias chegavam sem filtro de relevância.

## 2. Arquitetura de informação (revisão de 07/11/2026)

**Objetivo:** abrir o Oregon de manhã e, em cinco minutos, entender o mercado brasileiro, o que mudou nas empresas acompanhadas e qual assunto merece estudo no dia.

Quatro áreas no menu, nessa ordem: **Hoje**, **Research Brasil**, **Carteiras** e **Mundo e Estratégia**. A Sala de Gestão e o guia do Comitê saíram do menu e ficaram dentro de Carteiras, em "Comitê e Sala". Os endereços antigos continuam abrindo: são traduzidos para os novos. No topo ficam a busca rápida (tecla `/`) e a hora da última rodada do robô.

### Auditoria das telas que levou a esta versão

| Tela | Decisão | Por quê |
|---|---|---|
| Hoje: 15 barras de carteiras na primeira tela | **sai**: ficam as 2 de referência; as 15 abrem num botão | ruído para a leitura da manhã |
| Hoje: "O que merece atenção" com notícias misturadas aos alertas | **simplifica**: notícias ganham seção própria; alertas viram "Pendências", com 3 itens e o resto num botão | as notícias se perdiam |
| Hoje: indicadores com fonte, hora, estado e tendência | **mantém** | é a base da leitura |
| Hoje: o que mudou, agenda, conexão do dia, exercício | **entra** | pedidos do briefing |
| Sala de Gestão no menu | **sai do menu**, vai para Carteiras | uso eventual |
| Carteiras abrindo no mapa das 15 | **simplifica**: abre nas duas de referência, com seletor | uma experiência só |
| Construção, Decidido × base, Performance, mapa das 15 | **avançado** | ferramentas de comitê, não de rotina |
| Ficha da empresa com formulário de indicadores à mão | **sai**: resultados vêm da CVM; à mão só a opinião da casa | menos preenchimento manual |
| Ficha da empresa: valuation, tese, estrutural × conjuntural | **mantém e reorganiza** em seções | é o que mais funcionava |
| ETFs sem ficha | **entra** a ficha educativa dos 27 ETFs | pedido |
| Estratégia Global | **mantém**, renomeada Mundo e Estratégia, com links para os ETFs globais | — |

### O que cada área responde

| Área | Responde | Conteúdo |
|---|---|---|
| **Hoje** (página inicial) | O que aconteceu, o que mudou, o que ler, quem foi afetado, o que estudar | Indicadores do Brasil e do mundo, com nível, variação, tendência, data, fonte e estado. **Notícias do dia**: 5 a 10, de média ou alta relevância nas últimas 48 horas (até 4 dias se faltar), no máximo duas por empresa ou tema, com filtros Brasil, Empresas, Juros e Fiscal, Commodities e Mundo, e "por que importa" com o peso nas carteiras de referência. **O que mudou desde o último pregão**, em ordem de tamanho relativo ao limite de alerta, mais o Focus, documentos da CVM e releases do IBGE. **Carteiras de referência na sessão.** **Agenda** dos próximos 10 dias. **Empresas das carteiras hoje**: primeiro as com fato novo. **Conexão do dia**: o maior movimento externo, o mecanismo, como o Brasil andou no mesmo pregão e o peso exposto. **Exercício do dia**: pergunta com o maior fato real da sessão; a explicação técnica (fato, mecanismo, efeito pelo motor nas duas referências, ativos mais sensíveis, construção de carteira, perguntas para a reunião) só abre depois de pensar. Pendências, Focus e qualidade dos dados. |
| **Research Brasil** | Entender cada empresa e cada ETF | **Empresas**: preço do robô × preço-teto das Teses e o teto da casa; últimas atualizações (CVM e notícias desambiguadas); fundamentos (tese estrutural, modelo de negócio, drivers, riscos, perguntas a responder) separados da conjuntura (preço, resultados da CVM, setor e pares); exposição a juros, câmbio, regulação e commodities; **opinião da casa** (preço-teto, convicção, premissas, conclusões), o único campo manual. **ETFs**: nome completo, gestora, ISIN ou CNPJ, índice e metodologia, objetivo, países, setores e principais posições com data, taxa, distribuição, riscos dos documentos oficiais, comparação com semelhantes, papel na carteira, documentos com link e notícias do índice (nunca como fato do fundo). Macro → empresas. Acontecimentos (arquivo completo). |
| **Carteiras** | Construção e risco | **Referência** (modo simples): Conservador e Arrojado da família Brasil Crescimento, versão aprovada, com a validade no topo (a Arrojado não fecha: 106%; a Conservador tem 50% em fundos de teste), camadas, pilar a pilar, cenários das duas lado a lado, comparação de exposições, risco (bloqueado na inválida, parcial na Conservador) e maiores posições. **Risco e cenários** completo. **Comitê e Sala.** **Todas as carteiras · avançado**: mapa das 15, carteira, construção, decidido × base, performance. |
| **Mundo e Estratégia** | Entender o mundo e ligar ao Brasil | Indicadores globais, cinco transmissões para o Brasil, juros do Brasil e dos EUA, exterior por carteira e os ETFs globais com link para a ficha. |

**Divulgação progressiva.** Tocar numa notícia leva ao ativo, ao setor ou ao fator. Tocar numa empresa abre as últimas atualizações. Tocar num fator abre o mecanismo e o efeito do movimento de hoje nas carteiras de referência. A metodologia fica no botão "i".

**Atualização.** O robô publica a cada 30 minutos em dias úteis. O site consulta um arquivo de poucos bytes (`data/versao.json`) a cada 5 minutos e só baixa os arquivos grandes quando há rodada nova; a área aberta é redesenhada no mesmo ponto de leitura, nunca enquanto você digita ou com uma gaveta aberta. A tela diz a hora da rodada e que não é tempo real.

## 3. O que funciona no GitHub Pages e o que não funciona

| Recurso | GitHub Pages / arquivo no computador | claude.ai (artefato privado) |
|---|---|---|
| Dados ao vivo do robô | sim | não (a página não acessa a internet) |
| Validação, risco, cenários, laboratório | sim | sim |
| Propostas, decisões e premissas salvas | neste navegador (exporte o pacote em "Dados" para levar a outro aparelho) | no banco do artefato |
| Debate com IA na Sala | não: a Sala roda em modo local, com leitura por regras e o motor de cenários. O botão “Abrir a versão online” copia o fato e abre o painel no claude.ai | sim, pela sua conta do claude.ai, sem chave no navegador |

Não há chave de API no navegador. A leitura por IA das notícias, se você quiser, roda no robô, com a chave nos Secrets e sem dados de carteira.

**Integração segura da IA no site.** O motor de cenários é independente do texto da IA. Para ter debate com IA no próprio site, seria preciso um servidor intermediário com a chave guardada no servidor e login, por exemplo uma função na nuvem. Isso tem custo e manutenção, por isso não foi feito: o artefato privado do claude.ai já cobre esse uso sem expor nada.

## 4. Público × privado

Você autorizou deixar tudo no site público. O site está marcado para não aparecer em buscadores, mas é acessível a quem tiver o link, e o repositório também é público.

Para fechar:

1. Torne o repositório privado. O GitHub Pages exige o plano GitHub Pro, de US$ 4 por mês.
2. Ou mantenha só o painel no claude.ai (privado) e desligue o Pages.

Os dados do robô não incluem pesos nem textos do comitê. Esse conteúdo está no painel (`painel/src/data.json`).

## 5. Fluxo de dados

```
GitHub Actions (a cada 30 min, agenda em robo/config.json)
  testes → coleta (fontes com prioridade e reserva) → status completo/parcial/crítico
  → ramo "dados" (histórico interno) → site (index.html + data/mercado, historico, noticias, resultados, status, diagnostico, versao)
Painel (navegador) consulta data/versao.json e, quando muda, lê data/*.json do mesmo endereço; no arquivo local, lê do ramo "dados" do repositório.
resultados.json (CVM) só é baixado quando uma ficha de empresa é aberta.
Telegram recebe alertas e o resumo do fim do dia.
```
