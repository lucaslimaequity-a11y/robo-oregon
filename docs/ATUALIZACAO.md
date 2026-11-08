# Instalar o Oregon Intelligence (v3) e como voltar atrás

O ZIP `robo-oregon-v3-intelligence.zip` substitui a versão anterior inteira. Tudo é feito pelo site do GitHub, sem
instalar nada no computador. Nenhuma chave vai para arquivo: as chaves ficam em Settings → Secrets.

## 1. Guarde o ponto de volta

Você já tem `robo-oregon-v2.zip` e `robo-oregon-v2.1.zip`. Qualquer um deles é o rollback (seção 5).

## 2. Suba os arquivos

1. Descompacte o `robo-oregon-v3-intelligence.zip`.
2. No GitHub, repositório `robo-oregon` → **Add file** → **Upload files**.
3. Arraste **todo o conteúdo** da pasta descompactada: `docs`, `painel`, `robo`, `site`, `testes` e `README.md`.
   A pasta `.github` também está no ZIP, mas o GitHub costuma ignorá-la no envio por arrastar; o passo 3 cuida dela.
4. Embaixo, escreva "Oregon Intelligence v3" e **Commit changes**.
5. Apague `test_coletar.py`, que está na raiz e não é mais usado: abra o arquivo → **⋯** → **Delete file** → **Commit changes**.

## 3. Troque o workflow (é isto que liga a coleta nova)

O robô que roda hoje no seu repositório é o da v1 (`.github/workflows/robo.yml` nunca foi atualizado porque a pasta
é oculta no Mac). Faça pelo editor do GitHub:

1. Abra `docs/workflow_robo.yml` no repositório → botão **Raw** → selecione tudo → copie.
2. Abra `.github/workflows/robo.yml` → lápis (**Edit**) → apague o conteúdo → cole → **Commit changes**.
3. Se existir `.github/workflows/testes.yml`, pode ficar.

Os testes conferem que `docs/workflow_robo.yml` e `.github/workflows/robo.yml` são iguais, então a cópia visível
nunca fica diferente da real.

## 4. Primeira rodada e conferência

1. **Actions** → **Oregon Intelligence** → **Run workflow** → modo `normal` → **Run workflow**.
2. Em 4 a 8 minutos a rodada termina. Abra a execução → **Summary**: a tabela diz, fonte por fonte, quantos itens
   chegaram, foram rejeitados, já estavam na biblioteca e eram novos, e o erro de quem falhou.
3. Abra o site. No topo, à direita, aparece a hora da última rodada. Em **Biblioteca → Fontes e coleta** está o mesmo
   relatório. Em **Hoje**, as prioridades do dia.
4. Para gerar já o resumo da semana atual: **Run workflow** com o modo `semanal`.
5. Para testar o Telegram: modo `teste_telegram` (manda o briefing de teste).

Agendamento: 06:40, 11:40, 17:40 e 21:40 (Brasília), todos os dias. O GitHub às vezes atrasa alguns minutos.

### Chaves (todas opcionais)

Settings → Secrets and variables → Actions → **New repository secret**:

| Nome | Para quê | Custo | Sem ela |
|---|---|---|---|
| `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID` | briefing diário no Telegram (07:30) | grátis | nada é enviado; o site funciona igual |
| `YOUTUBE_API_KEY` | vídeos dos 17 canais oficiais cadastrados, pela API oficial do YouTube (Data API v3) | grátis (cota diária de 10.000 unidades; cada canal gasta 1 por rodada) | as fontes de vídeo ficam "aguardando chave" (não contam como falha) |
| `ANTHROPIC_API_KEY` | análise aprofundada dos itens prioritários | pago por uso, com teto diário (`docs/IA.md`) | análise por regras, sinalizada na tela |

Como criar a chave do YouTube: Google Cloud Console → novo projeto → APIs e serviços → Biblioteca → "YouTube Data API v3"
→ Ativar → Credenciais → Criar credencial → Chave de API. Restrinja a chave à YouTube Data API.

Para ligar a IA, além da chave, troque `"ativo": false` para `true` em `intel.ia` no `robo/config.json`.

## 5. Voltar atrás (rollback)

- **Para a v2.1 (Oregon Investment Desk):** descompacte `robo-oregon-v2.1.zip`, envie os arquivos pelo mesmo caminho e
  troque o conteúdo de `.github/workflows/robo.yml` pelo `docs/workflow_robo.yml` daquele ZIP. Os arquivos novos
  (`robo/intel.py`, `conteudo.py`, `biblioteca.py`, `analise.py`, `semanal.py`, `fontes.json`, `painel/arquivo/`) podem ficar.
- **Dados:** o ramo `dados` guarda tudo o que o robô já coletou (biblioteca por mês). Nenhuma versão apaga esse ramo; a
  v3 só acrescenta arquivos. Os arquivos da v1/v2 (`mercado.json`, `historico.json`, `noticias.json`) continuam lá.
- **Configuração:** `robo/config.json` → **History** → versão anterior → copiar → colar → **Commit changes**.

## 6. Mudar algo depois

- **Fontes:** `robo/fontes.json` (`docs/FONTES.md` explica os campos). Desligar: `"ativo": false`. Ligar uma fonte
  desligada: validar a URL antes e apagar `motivo_desligada`.
- **Janelas, IA e Telegram:** bloco `intel` do `robo/config.json`.
- **Lista de ativos e carteiras da seção Oregon:** `painel/src/data.json` (as 15 carteiras aprovadas) e os termos de busca
  de cada empresa em `robo/config.json` (`ativos[].noticias.termos`).
- **Carteiras de referência do modo simples:** linha `A.REF` em `painel/src/ui_base.js`.

O robô valida a configuração e o cadastro de fontes antes de rodar. Com erro, a rodada falha visivelmente em Actions,
com a lista dos erros em português, e nada é publicado: o site e a biblioteca ficam como estavam.
