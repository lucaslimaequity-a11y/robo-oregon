# Como publicar esta versão e como voltar atrás

## Publicar (uma vez, pelo site do GitHub)

1. **Guarde a versão atual.** Você já tem o `robo-oregon-main.zip` que me mandou. Ele é o seu ponto de volta.
2. **Descompacte** o `robo-oregon-v2.zip` no computador.
3. **Envie os arquivos.**
   - No GitHub, abra o repositório `robo-oregon` → **Add file** → **Upload files**.
   - Arraste **todo o conteúdo** da pasta descompactada: `.github`, `docs`, `painel`, `robo`, `site`, `testes` e `README.md`.
   - No Mac, a pasta `.github` fica oculta. No Finder, aperte **Cmd + Shift + .** para que ela apareça.
   - Embaixo, escreva "Oregon Desk v2" e clique em **Commit changes**.
4. **Apague o arquivo antigo.** Abra `test_coletar.py`, que está na raiz do repositório e não é mais usado → menu **⋯** → **Delete file** → **Commit changes**.
5. **O que acontece sozinho.** O envio dispara o robô:
   - ele roda os testes;
   - monta o painel;
   - coleta os dados;
   - publica o site.

   Acompanhe em **Actions** → **Robô de mercado Oregon**. Em 3 a 6 minutos o site está no ar, no mesmo endereço.
6. **Teste o Telegram.** Actions → Robô de mercado Oregon → **Run workflow** → modo `teste_telegram` → **Run workflow**. Se falhar, o resumo da execução diz o motivo real (por exemplo, `chat not found`) e o que fazer.
7. **Rode o diagnóstico (recomendado).** O mesmo caminho, com o modo `diagnostico`. Ele mostra, ativo por ativo, o que cada fonte respondeu na rede do GitHub.

### Chaves opcionais

Em **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Nome | Para quê | Custo |
|---|---|---|
| `BRAPI_TOKEN` | Cotações da B3 quando o Yahoo bloquear. É o que resolve os ETFs de renda fixa. | grátis com limite; planos pagos em brapi.dev |
| `FRED_API_KEY` | Séries globais: dólar global, TIPS, minério, Alemanha. | grátis |
| `AWESOMEAPI_KEY` | Dólar ao vivo. | grátis |
| `ALPHAVANTAGE_KEY` | Fechamento dos ETFs de renda fixa quando Yahoo e brapi falham (no máximo 20 pedidos por dia). | grátis |
| `TIINGO_TOKEN` | Reserva para os ETFs americanos. | grátis com limite |
| `ANTHROPIC_API_KEY` | Leitura extra das manchetes por IA. | pago, por uso |

As chaves que você já tem (`TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`) continuam valendo.

## Voltar atrás (rollback)

**Tudo, código e painel**
1. Descompacte o seu `robo-oregon-main.zip`.
2. Envie os arquivos pelo mesmo caminho (Add file → Upload files) e faça o commit.
3. O robô antigo volta na próxima rodada.

As pastas novas (`painel`, `docs`, `testes`) podem ficar: não atrapalham. Para apagá-las, abra cada uma e use **⋯** → **Delete directory**.

**Só a configuração (`robo/config.json`)**
1. Abra o arquivo → **History**.
2. Clique na versão anterior → **⋯** → **View file** → copie o conteúdo.
3. Volte ao arquivo atual → lápis (editar) → cole → **Commit changes**.

**Dados.** O robô não apaga dado bom:
- Se uma fonte falha, o último valor válido fica, marcado como desatualizado.
- Se a configuração está inválida, a rodada é crítica, os dados anteriores ficam e você recebe um aviso no Telegram uma vez por dia.
- Se algum teste falha, nada é publicado e o site continua com a versão anterior.

## Mudar algo depois

Quase tudo muda em `robo/config.json`, sem mexer em código: ativos, horários, limites de alerta, fontes, notícias e qualidade. Veja o `README.md`.

**Para editar no GitHub:**
1. Abra o arquivo → lápis → altere → **Commit changes**.
2. O robô valida a configuração antes de usar. Se houver erro, a rodada sai crítica com a lista dos erros em português, e nada se perde.

O login do GitHub é a autenticação: nenhuma senha ou chave fica no site.
