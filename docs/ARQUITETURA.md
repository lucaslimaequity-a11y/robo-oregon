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

## 2. Nova arquitetura de informação

Cinco entradas no topo: **Hoje**, **Carteiras**, **Research Brasil**, **Estratégia Global** e **Sala de Gestão**. Também no topo ficam a busca rápida (tecla `/`) e o estado dos dados. A carteira e a versão escolhidas só aparecem onde importam (Carteiras e Sala), e o último contexto fica guardado neste navegador.

| Área | Responde | Conteúdo |
|---|---|---|
| **Hoje** (página inicial) | O que aconteceu? O que mudou nas expectativas? O que importa? Quem foi afetado? O que pede decisão? | Faixa do Brasil: Ibovespa, dólar, pré 2032, IPCA+ 2035, Selic, IPCA, inclinação e Brent, com nível, variação do dia, tendência de 1 e 12 meses, data, fonte e estado. Faixa do mundo. "O que merece atenção", em ordem: decidir, investigar, monitorar e qualidade dos dados, cada item com fato, mecanismo, quem é afetado e o que acompanhar. As 15 carteiras na sessão, com a cobertura. Expectativas do Focus. Linha de qualidade dos dados. |
| **Carteiras** | Construção e risco | Mapa (roscas, carteiras × pilares, mudanças); Carteira (sol de camadas, pilar a pilar, validação, alocação, concentração, exposições); Risco e cenários (estresse com premissas editáveis, risco estatístico, correlações, fatores, concentração, premissas); Construção (laboratório, dimensionamento, otimização, comparação aprovada × proposta); Decidido × base (escada de risco); Performance. |
| **Research Brasil** | Inteligência fundamentalista | Ficha por empresa: valuation com o preço do robô e preço-teto, peso nas carteiras, o estrutural (a tese) separado do conjuntural (preço, fatos recentes, sensibilidades) e acompanhamento de resultados. Macro → empresas: o mesmo choque com efeitos diferentes, a partir de premissas com origem marcada; onde não há canal cadastrado aparece "·", não zero. Acontecimentos: notícias classificadas, não um feed. |
| **Estratégia Global** | Entender o mundo e ligar ao Brasil | Indicadores globais com fonte. Cinco transmissões do mundo para o Brasil (Treasuries → prêmio, China → commodities, dólar global, renda fixa americana × ações, Fed), cada uma com o dado de hoje, o mecanismo em passos e a exposição das carteiras. Juros do Brasil e dos EUA. Parcela de cada carteira no exterior. |
| **Sala de Gestão** | Discussão e decisão | Reunião (fato, hipóteses, cálculo, interpretação e decisão separados), guia do Comitê 05/11, decisões e diário, pauta de estudo, textos e consultores, histórico e auditoria. |

**Divulgação progressiva.** Cada número abre uma gaveta com histórico, mecanismo e exposição. A metodologia fica no botão "i". Os detalhes técnicos do mercado ficam em "Dados" → "Todos os números".

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
  → ramo "dados" (histórico interno) → site (index.html + data/mercado, historico, noticias, status, diagnostico)
Painel (navegador) lê data/*.json do mesmo endereço; no arquivo local, lê do ramo "dados" do repositório.
Telegram recebe alertas e o resumo do fim do dia.
```
