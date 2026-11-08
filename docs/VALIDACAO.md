# Validação

## Testes automáticos (rodam no portão do workflow: se algum falha, nada é publicado)

`python -m unittest discover -s testes` — 66 testes do robô com internet simulada (`testes/simulador.py`), dos quais
**20 do Oregon Intelligence** (`testes/test_intel.py`):

- publicação de todos os arquivos e classificação (temas, regiões, ativos da Oregon, fatores, vínculo direto × menção, leitura curta sem "não avaliado",
  link original em todo item, veículo sem texto, sensacionalismo penalizado mas visível, XP descartada, mesmo fato
  agrupado com a fonte primária como principal, contadores por fonte, briefing com 5 a 8 prioridades, macro sem cotação);
- **falha de fonte** não apaga histórico e fica registrada (`ultima_ok`, `ultimo_erro`, status parcial);
- macro em falha reaproveita o último valor, nunca zero;
- **duplicação** por link (não vira novo) e por título (também em);
- **atualização**: PDF novo numa página e nova edição de documento de URL fixa (ETag) viram itens; edição igual, não;
- **persistência** por mês (meses anteriores preservados, índice e versão listam todos);
- item sem data usa a detecção, marcada;
- IA: sem chave continua útil; desligada na configuração não chama mesmo com chave; com chave respeita o teto diário e os
  rótulos, nunca envia pesos/carteiras; chave recusada não derruba;
- YouTube pela API oficial com chave; sem chave fica "aguardando"; `robots.txt` vedado não é contornado;
- resumo semanal (modo manual e sábado, sem duplicar);
- cadastro de fontes inválido é crítico e não publica; o cadastro real é válido, público e sem XP;
- Oregon usa os ativos das 15 carteiras (sem placeholders; códigos curtos só como palavra inteira);
- resultados da CVM na rodada manual e preservados quando a CVM falha;
- o workflow real: sete dias por semana, `intel.py`, chaves pelos Secrets, permissões zeradas, publica os arquivos
  públicos e nunca `estado.json`, igual à cópia visível em `docs/`.

Os 46 testes da v2 (cotações, histórico, alertas) continuam no repositório porque protegem os módulos reaproveitados
(`fontes_macro`, `agenda`, `resultados`, `util`); não exercitam a navegação do painel.

`node testes/painel.test.js` — 26 testes do painel: validação das 15 carteiras (10 inválidas, pesos preservados),
teses e fichas de ETF, e **Intelligence** (busca/filtros não escondem nada sem filtro, acentos e maiúsculas, taxonomia
injetada do robô, exportar/importar aprendizados descartando link `javascript:` e tipos inválidos).

`node painel/test/areas.js` — Playwright, computador (1440) e celular (390), com dados gerados pelo robô contra a
internet simulada (`painel/test/gera_dados_teste.py`): Hoje (5–8 prioridades, links originais, macro, agenda, estudo,
leitura), janela de leitura editorial (sem os sete pontos), linha de notícia que abre no lugar, volta ao ponto de leitura ao fechar, aprendizado salvo, todas as rotas das cinco seções e as antigas traduzidas,
busca e filtros da Biblioteca, prioridade baixa visível, mês anterior sob demanda, fontes e coleta, resumo semanal,
fichas de PETR4 e IMAB11 sem cotação, busca rápida, carteiras de referência sem simulador, menu com cinco seções, sem
erro de JavaScript e sem rolagem horizontal no celular. Resultado da última execução: **tudo ok**.

## O que foi validado ao vivo e o que só o GitHub mostra

- As URLs de `robo/fontes.json` foram lidas uma a uma em 07–08/11/2026 (formato, itens recentes, robots, termos), e a
  evidência de cada uma está no próprio cadastro (`evidencia`, `validado_em`).
- A rede deste ambiente de desenvolvimento não alcança os sites das fontes, então a coleta ao vivo foi exercitada com a
  internet simulada no formato exato de cada fonte (RSS 2.0, Atom, RDF/RSS 1.0, APIs WordPress/BC/FMI/IBGE, páginas com
  PDF, sitemap, HEAD de documento fixo, YouTube Data API). A primeira rodada no GitHub Actions é a validação real:
  o Summary e **Biblioteca → Fontes e coleta** mostram, por fonte, o que chegou. Uma fonte que falhe ali aparece com o
  motivo e não derruba as outras.
- GitHub Pages: o painel lê `data/` ao lado de `index.html`; `versao.json` é consultado a cada 10 minutos e a tela é
  redesenhada no mesmo ponto quando a versão muda (nunca enquanto você digita ou tem uma gaveta aberta).
