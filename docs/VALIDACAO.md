# Consistência das carteiras aprovadas (Comitê 05/11/2026)

Gerado pelo motor de validação do painel (`painel/src/core.js`) sobre a versão aprovada de cada carteira, que vem do Simulador V2, aba Ativos, peso final. Nenhum peso foi alterado: as correções dependem do Comitê e entram no Laboratório como proposta, com justificativa e registro da aprovação.

| Carteira | Família | Soma dos pilares decididos | Soma dos ativos | Situação | Fundos de teste (placeholders) | Problemas críticos |
|---|---|---|---|---|---|---|
| Crescimento Conservador | Brasil Crescimento | 100% | 100% | parcial | 50% | — |
| Crescimento Moderado | Brasil Crescimento | 100% | 106% | **inválida** | 30% | Ativos somam 106,0% (deveriam somar 100%); Ativos do P2 somam 160% por dentro do pilar |
| Crescimento Arrojado | Brasil Crescimento | 100% | 106% | **inválida** | 25% | Ativos somam 106,0% (deveriam somar 100%); Ativos do P2 somam 160% por dentro do pilar |
| Crescimento Defensivo | Brasil Crescimento | 100% | 106% | **inválida** | 50% | Ativos somam 106,0% (deveriam somar 100%); Ativos do P2 somam 160% por dentro do pilar |
| Renda Conservador | Brasil Renda | 100% | 100% | parcial | 45% | — |
| Renda Moderado | Brasil Renda | 100% | 103% | **inválida** | 25% | Ativos somam 103,0% (deveriam somar 100%); Ativos do P2 somam 160% por dentro do pilar |
| Renda Arrojado | Brasil Renda | 100% | 103% | **inválida** | 25% | Ativos somam 103,0% (deveriam somar 100%); Ativos do P2 somam 160% por dentro do pilar |
| Renda Defensivo | Brasil Renda | 100% | 106% | **inválida** | 10% | Ativos somam 106,0% (deveriam somar 100%); Ativos do P2 somam 160% por dentro do pilar |
| Internacional Conservador | Internacional | 110% | 100% | **inválida** | — | Pilares somam 110,0% |
| Internacional Moderado | Internacional | 115% | 100% | **inválida** | — | Pilares somam 115,0% |
| Internacional Arrojado | Internacional | 120% | 100% | **inválida** | — | Pilares somam 120,0% |
| Alternativo Conservador | Alternativo | 100% | 100% | parcial | — | — |
| Alternativo Moderado | Alternativo | 100% | 100% | parcial | — | — |
| Alternativo Arrojado | Alternativo | 100% | 100% | parcial | — | — |
| Alternativo Super Arrojado | Alternativo | 100% | 170% | **inválida** | — | Ativos somam 170,0% (deveriam somar 100%); Ativos do P13 somam 170% por dentro do pilar |

## Leitura

- **10 de 15 carteiras não fecham 100%.** O número bate com o que o HTML original já apontava.
  - Em 7 carteiras Brasil, o problema está no Pilar 2: o IRFM11 ficou com 100% dentro do pilar e o 5PRE11 e o IDKA11 entraram por cima. Só o Crescimento Conservador foi ajustado (50/20/30). Ver "Para estudar e1".
  - Nas 3 carteiras Internacional, os pilares somam 110%, 115% e 120%, porque o P13 entrou sem tirar peso de outro pilar (e2).
  - No Alternativo Super Arrojado, os ativos do P13 somam 170%.
- **Fundos de teste.** "Franchini FIDC" e "Fundo pós CP Franchini" estão marcados como exemplo de teste. Eles ocupam de 10% a 50% das carteiras Brasil e não entram em risco, cenários nem performance: aparecem como lacuna, nunca como caixa ou risco zero.
- **"Parcial"** quer dizer que os pesos fecham, mas parte da carteira não tem instrumento investível ou sensibilidade cadastrada.

## Cadastro dos ativos: nomes a conferir

Conferido na Mais Retorno em 07/11/2026 (ver `docs/DIAGNOSTICO.md`). Nada foi alterado.
- **LFTB11.** Está cadastrado como "ETF de Tesouro Selic" no P1. O nome registrado é "MarketVector Brazil Treasury 760 Day Target Duration".
- **IDKA11.** Está cadastrado como "índice IDkA". O registro é IRF-M P3.

## Como corrigir sem perder o histórico

Carteiras → Construção → "Proposta de correção (sugerida)". A proposta nasce da aprovada e mostra o antes × depois. Ela só vira versão aprovada com um registro de aprovação: data, ata e justificativa. A versão anterior fica guardada no histórico.

Fontes do motor: regras R1 (soma da carteira), R2 (soma por pilar contra o decidido), R3 (soma interna do pilar) e as demais descritas em Metodologia, no painel.

## Carteiras de referência do modo simples (revisão de 07/11/2026)

O modo simples de Carteiras mostra duas carteiras: **Crescimento Conservador** e **Crescimento Arrojado**, as duas na versão aprovada do Comitê de 05/11/2026 e sem nenhum peso alterado. Para trocar a família, mude a linha `A.REF` em `painel/src/ui_base.js`.

As duas aparecem como são:

- **Conservador:** parcial. Os pesos fecham em 100%, mas 50% estão em fundos de teste (placeholders). Essa metade fica fora de risco e cenários, como lacuna, nunca como caixa. Os números de risco dizem que cobrem só a parte com instrumento.
- **Arrojado:** inválida. Os ativos somam 106%, porque o IRFM11 tem 100% do P2 e o 5PRE11 e o IDKA11 entram por cima. Ela também tem 25% em fundos de teste. O topo da tela avisa, o risco estatístico fica bloqueado e os cenários aparecem com asterisco (parciais). A correção é uma proposta ao Comitê, pelo botão "Criar proposta de correção".
