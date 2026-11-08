# Atualizar para o Oregon Intelligence v3.3 e como voltar atrás

O ZIP `robo-oregon-v3.3.zip` atualiza a v3.2 que está no seu GitHub. Tudo é feito pelo site do GitHub, sem instalar
nada no computador. Nenhuma chave vai para arquivo: chaves ficam em Settings → Secrets. O workflow (`robo.yml`) não muda.

## O que muda na v3.3 (fase 1: estética, hierarquia, navegabilidade e leitura das notícias)

- **Topo:** busca sempre à vista, as cinco seções visíveis também no celular (sem rolagem escondida) e a hora da última
  coleta sempre visível, separada da hora de publicação de cada notícia.
- **Hoje:** cinco destaques e as demais notícias em linhas compactas (hora · veículo · título · ativo/tema · ↗), com
  separador por dia; o título abre um resumo no próprio lugar. Filtros: Na carteira, Brasil, Mundo, Gestoras e casas,
  RI e CVM. Ao lado, os ativos que foram assunto de notícia; a agenda oficial fica recolhida.
- **Janela da notícia:** sai a análise em sete pontos. Entra uma leitura curta: título, fonte e data; resumo da fonte quando
  existe; por que importa; relação com a carteira só quando há base; contrapontos só quando documentados; link original
  sempre à vista; "Aprofundar" recolhido. Com só a manchete, a janela diz isso. Ao fechar, a página volta ao ponto de leitura.
- **Relevância por empresa:** cada ativo citado tem vínculo **direto** (a empresa é o assunto: notícia, resultado,
  documento à CVM, mudança de recomendação) ou **menção de passagem** (lista de dividendos, destaques do dia, citado só no
  resumo). Contadores e prioridade usam só o vínculo direto; as menções ficam recolhidas na ficha. Itens já coletados
  são reclassificados na publicação, sem mexer no arquivo do mês.
- **Brasil:** na ficha, notícias e opiniões ao lado (opiniões dos últimos 12 meses, publicadas em
  `data/biblioteca/opinioes.json`); no centro, **Mudanças na tese** primeiro, depois Eventos e RI, Fundamentos e Setor e
  pares. No celular, o ativo e as notícias vêm antes da lista.
- **Biblioteca:** busca e atalhos por tipo de fonte à vista; os demais filtros ficam em "Mais filtros".
- **Fontes:** 37 entradas novas da sua lista do Notion (22 ativas, 15 desligadas com o motivo), nenhuma do Grupo XP.
  Detalhes em `docs/FONTES.md`.
- **Opinião de casa:** "Itaú mantém a dianteira" deixou de contar como opinião; "mantém compra" continua contando.

## 1. Suba os arquivos (um só envio)

1. Descompacte o `robo-oregon-v3.3.zip`.
2. No Mac, dentro da pasta descompactada, aperte **Cmd + Shift + . (ponto)** para aparecer a pasta oculta `.github`.
3. No GitHub, repositório `robo-oregon` → **Add file** → **Upload files**.
4. Arraste **todo o conteúdo** da pasta: `.github`, `docs`, `painel`, `robo`, `site`, `testes` e `README.md`.
5. Escreva "Oregon Intelligence v3.3" e **Commit changes**.

Se a pasta `.github` não for junto (o envio mostra a lista de arquivos; confira se aparece `.github/workflows/robo.yml`):
entre na pasta `.github/workflows` do repositório → **Add file** → **Upload files** → arraste o `robo.yml` enviado
junto com o ZIP → **Commit changes**. Entre um envio e outro, uma rodada pode falhar no teste que compara
`.github/workflows/robo.yml` com `docs/workflow_robo.yml`; isso é esperado, nada é publicado e o site fica como estava.
Não cole o arquivo no editor do GitHub: o editor acrescenta espaços no fim das linhas e o teste acusa diferença.

## 2. Primeira rodada e conferência

1. **Actions** → **Oregon Intelligence** → **Run workflow** → modo `normal` → **Run workflow**. A execução manual lê
   todas as fontes e todas as buscas de uma vez (as agendadas leem até 14 buscas por rodada).
2. Em 5 a 10 minutos termina. Abra a execução → **Summary**: fonte por fonte, quantos itens chegaram, foram rejeitados
   (e por quê), já estavam na biblioteca, eram novos e foram publicados.
3. Abra o site. O topo do **Hoje** diz: "Última coleta concluída há N min · X notícias nas últimas 24 h · M fontes com erro".
   Toque em "fontes com erro" para ver quais e por quê.
4. Em **Brasil**, toque em Klabin: à direita, as notícias em que a empresa é o assunto, as opiniões a favor e contra
   (12 meses) e os documentos da CVM; no centro, a aba Mudanças na tese. Toque numa notícia: a janela é curta e tem o
   link original no topo.

Na primeira rodada, as buscas e as fontes novas aparecem como "a validar" se falharem: isso não marca a rodada como
parcial. A partir da segunda leitura, falha conta como erro, com o motivo.

## 3. Chaves (todas opcionais)

Settings → Secrets and variables → Actions → **New repository secret**:

| Nome | Para quê | Custo | Sem ela |
|---|---|---|---|
| `YOUTUBE_API_KEY` | vídeos dos 17 canais oficiais cadastrados (instituições e gestoras) pela API oficial do YouTube | grátis (cota diária de 10.000 unidades; cada canal gasta 1 por leitura) | os canais ficam "aguardando chave" e não aparecem; o resto funciona |
| `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID` | briefing diário no Telegram (07:30) | grátis | nada é enviado |
| `ANTHROPIC_API_KEY` | leitura aprofundada dos itens prioritários | pago por uso, com teto diário (`docs/IA.md`) | análise por regras, sinalizada na tela |

Chave do YouTube: Google Cloud Console → novo projeto → APIs e serviços → Biblioteca → "YouTube Data API v3" → Ativar →
Credenciais → Criar credencial → Chave de API → restrinja à YouTube Data API.

Custo do GitHub: o repositório é público, então os minutos do GitHub Actions são gratuitos; cada rodada leva poucos minutos.

## 4. Voltar atrás

- **Para a v3.2:** envie de novo os arquivos do pacote da v3.2 (mesmo caminho). Os dados não se perdem; o arquivo
  `data/biblioteca/opinioes.json` fica sem uso.
- **Para a v3:** envie de novo os arquivos do `robo-oregon-v3-intelligence.zip` (mesmo caminho) e o `robo.yml` daquele
  pacote.
- **Dados:** o ramo `dados` guarda tudo o que o robô já coletou (biblioteca por mês). Nenhuma versão apaga esse ramo.
  Na primeira rodada da v3.2, as cartas antigas sem data, lidas pela primeira vez na v3, passam a "acervo" (saem do Hoje
  e continuam na Biblioteca). É uma migração única, registrada no estado do robô.
- **Configuração:** `robo/config.json` → **History** → versão anterior → copiar → colar → **Commit changes**.

## 5. Ajustes que você pode querer

Tudo em `robo/config.json`, bloco `noticias`:

- **Buscas por empresa:** `ativos[].noticias.buscas` (o que é buscado) e `termos`/`excluir` (o que confirma que a manchete
  é da empresa). Ex.: Klabin exclui "Chácara Klabin" e "Ema Klabin".
- **Buscas por setor e cadeia:** `buscas_setor` (consulta, mercado pt-BR ou en-US, ativos ligados, termos exigidos).
- **Temas dos ETFs:** `etfs[].busca` e `mkt`.
- **Ritmo das buscas:** `busca.intervalo_min` (120) e `busca.max_por_rodada` (14).
- **InfoMoney e canais da XP:** entram com o selo "Grupo XP — não citar em material de cliente" (`fontes_sinalizadas`).
  Para voltar a bloquear: copie os nomes para `fontes_bloqueadas`.
- **Veículos conhecidos:** `veiculos_confiaveis`. Os demais entram marcados "veículo pouco conhecido" e só aparecem na
  ficha do ativo.
- **Indicadores de mercado:** `intel.indicadores_macro` (desligado). A agenda oficial continua.

O robô valida a configuração antes de rodar. Com erro, a rodada falha visivelmente em Actions, com a lista em português,
e nada é publicado.
