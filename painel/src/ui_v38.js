/* v3.8 · Brasil › Fluxo dos fundos: captação menos resgate dos fundos brasileiros por classe (CVM, informe diário),
   semana a semana e mês a mês. Fundos de cotas ficam de fora (contariam duas vezes). Só o que os fundos informaram. */
(function (A, C, I) {
  'use strict';
  var h = A.h;
  var NOMES = {acoes: 'Ações', multimercado: 'Multimercado', renda_fixa: 'Renda Fixa', cambial: 'Cambial', outros: 'Outros'};
  var ORD = ['acoes', 'multimercado', 'renda_fixa', 'cambial'];
  function brl(v) {
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v), s = v < 0 ? '−' : v > 0 ? '+' : '';
    return s + 'R$ ' + (a >= 1e9 ? A.num(a / 1e9, 2) + ' bi' : a >= 1e6 ? A.num(a / 1e6, 0) + ' mi' : A.num(a, 0));
  }
  A.fluxoBRL = brl;
  function dm(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—'; }
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function nomeMes(m) { return MESES[+m.slice(5, 7) - 1] + '/' + m.slice(2, 4); }
  A.fluxoSemana = function (de) {
    var a = A.arquivo('biblioteca/fluxo_fundos.json'); if (!a.dados) return null;
    return (a.dados.semanas || []).filter(function (s) { return s.de === de; })[0] || null;
  };
  A.fluxoLinha = function (s) {
    if (!s) return null;
    return ORD.filter(function (k) { return s.c[k] != null; }).map(function (k) { return NOMES[k] + ' ' + brl(s.c[k]); }).join(' · ');
  };
  // barra divergente: zero no meio; comprimento pelo maior valor absoluto da tabela
  function barra(v, mx) {
    var w = mx ? Math.min(50, 50 * Math.abs(v) / mx) : 0;
    return h('span', {class: 'fx-bar', 'aria-hidden': 'true'}, h('i', {class: v < 0 ? 'neg' : 'pos', style: (v < 0 ? 'right:50%;' : 'left:50%;') + 'width:' + w.toFixed(1) + '%'}));
  }
  function tabela(linhas, rotulo, chaveAcoes) {
    var mx = Math.max.apply(null, [1].concat(linhas.map(function (o) { return Math.abs(o.c.acoes || 0); })));
    return h('div', {class: 'tw'}, h('table', {class: 't fx-t'},
      h('thead', null, h('tr', null, h('th', null, rotulo), h('th', {class: 'fx-ac'}, 'Ações'), ORD.slice(1).map(function (k) { return h('th', {class: 'r'}, NOMES[k]); }))),
      h('tbody', null, linhas.map(function (o) {
        var v = o.c.acoes || 0;
        return h('tr', null, h('td', {class: 'num'}, chaveAcoes(o)),
          h('td', {class: 'fx-ac'}, h('span', {class: 'fx-v num'}, brl(o.c.acoes)), barra(v, mx)),
          ORD.slice(1).map(function (k) { return h('td', {class: 'r num'}, brl(o.c[k])); }));
      }))));
  }
  function pagina() {
    var wrap = h('div', null, A.pageHead('Brasil', 'Fluxo dos fundos', 'Dinheiro entrando ou saindo dos fundos brasileiros, por classe: captação menos resgate que cada fundo informa à CVM todo dia (informe diário). Fundos de cotas ficam de fora para não contar duas vezes o mesmo dinheiro. É fluxo informado, não previsão.'));
    var a = A.arquivo('biblioteca/fluxo_fundos.json');
    if (!a.dados) { wrap.appendChild(h('p', {class: 'empty'}, a.carregando ? 'Carregando o fluxo dos fundos…' : a.ausente ? 'O robô ainda não publicou o fluxo dos fundos: ele lê a CVM uma vez por dia, a partir das 9h.' : 'Não consegui ler o fluxo dos fundos agora (' + (a.erro || '') + ').')); return wrap; }
    var d = a.dados, sem = (d.semanas || []).slice(-12).reverse(), mes = (d.meses || []).slice(-12).reverse();
    if (!sem.length) { wrap.appendChild(h('p', {class: 'empty'}, 'Sem dias lidos ainda.')); return wrap; }
    var ult = (d.dias || []).slice(-1)[0], s0 = sem[0], m0 = mes[0];
    wrap.appendChild(h('div', {class: 'fx-res'},
      h('p', null, h('b', null, 'Semana de ' + dm(s0.de) + ' a ' + dm(s0.ate)), s0.dias < 5 ? h('span', {class: 'muted'}, ' (' + s0.dias + (s0.dias > 1 ? ' dias informados' : ' dia informado') + ')') : null, ': ', A.fluxoLinha(s0)),
      m0 ? h('p', null, h('b', null, 'No mês de ' + nomeMes(m0.mes) + (ult && ult.d.slice(0, 7) === m0.mes ? ' até ' + dm(ult.d) : '')), ': ', A.fluxoLinha(m0)) : null));
    wrap.appendChild(A.sec('Semana a semana', {flush: true, badge: h('span', {class: 'sec-n'}, 'últimas ' + sem.length), hint: 'Segunda a domingo. A barra mostra o fluxo dos fundos de ações: para a direita, entrou dinheiro; para a esquerda, saiu.'},
      tabela(sem, 'Semana', function (o) { return dm(o.de) + ' a ' + dm(o.ate); })));
    if (mes.length) wrap.appendChild(A.sec('Mês a mês', {flush: true, badge: h('span', {class: 'sec-n'}, 'últimos ' + mes.length)}, tabela(mes, 'Mês', function (o) { return nomeMes(o.mes); })));
    var lido = d.lido || {};
    wrap.appendChild(h('p', {class: 'hint'}, 'Fonte: ' + (d.fonte || 'CVM') + '. Última leitura: ' + (lido.meses || []).join(' e ') + (lido.linhas ? ' · ' + A.num(lido.linhas, 0) + ' linhas · ' + A.num(lido.fic_fora || 0, 0) + ' de fundos de cotas fora · ' + A.num(lido.sem_classe || 0, 0) + ' sem classe no cadastro (em "Outros")' : '') + '. ' + (d.nota || '')));
    return wrap;
  }
  /* v3.8.2 · research das casas (pedido do Lucas): só links para a página de estudos e publicações de cada casa, abertos no
     navegador dele. O Oregon não coleta, não guarda e não confere esse conteúdo; relatórios podem pedir login de cliente.
     Nenhum veículo do Grupo XP. Endereços conferidos em 08/11/2026. */
  // {grupo, casa, links: [[rótulo, endereço, o que é, relatórios pedem login]], nota}
  var CASAS = [
    {grupo: 'brasil', casa: 'BTG Pactual', links: [['Research', 'https://content.btgpactual.com/research/home', 'Últimos relatórios, indicadores e projeções, alocação sugerida, estratégia e carteiras recomendadas do BTG', true]]},
    {grupo: 'brasil', casa: 'Itaú', links: [['Análises', 'https://www.itau.com.br/investimentos/analises/', 'Itaú BBA e Itaú Investimentos: macro, Copom, estratégia, internacional e prévias de resultados', false],
      ['Análises econômicas (Itaú BBA)', 'https://www.itau.com.br/itaubba-pt/analises-economicas', 'Relatórios econômicos, revisão de cenário, projeções e apresentação mensal', false]],
      nota: 'Consenso de Mercado, Cockpit do Copom, Carta do Gestor e Radar de Preferências saem em Análises; não têm página própria'},
    {grupo: 'brasil', casa: 'Genial', links: [['Genial Analisa', 'https://analisa.genialinvestimentos.com.br/', 'Ações, FIIs, renda fixa, macro, carteiras recomendadas e análise técnica', false],
      ['Análises e resultados', 'https://analisa.genialinvestimentos.com.br/analises-e-resultados', 'Análises de empresas e comentários de resultados', false]]},
    {grupo: 'brasil', casa: 'BB Investimentos', links: [['Relatórios e análises', 'https://investalk.bb.com.br/relatorios-e-analises', 'InvesTalk: relatórios setoriais, renda fixa e análises (relatórios e análises ficam na mesma página)', false]]},
    {grupo: 'brasil', casa: 'Safra', links: [['Análises Safra', 'https://oespecialista.safra.com.br/analises-safra/', 'O Especialista: análises de ações do Safra', false], ['O Especialista', 'https://oespecialista.safra.com.br/', 'Portal com economia, investimentos e carteiras recomendadas', false]]},
    {grupo: 'brasil', casa: 'Santander', links: [['Análise econômica', 'https://www.santander.com.br/investimentos/analise-economica/', 'Macro: projeções, destaques semanais, cenário, chartbook e estudos', false]]},
    {grupo: 'brasil', casa: 'Suno', links: [['Suno Research', 'https://www.suno.com.br/research/', 'Relatórios e carteiras por assinatura', true]]},
    {grupo: 'brasil', casa: 'Ágora', links: [['Ágora Insights', 'https://insights.agorainvestimentos.com.br/', 'Estratégia em Ação, carteiras recomendadas, análise de empresas, economia, renda fixa e FIIs', false]]},
    {grupo: 'global', casa: 'Goldman Sachs', links: [['Insights', 'https://www.goldmansachs.com/insights', 'Top of Mind, outlooks, macro e mercados; o research completo é para clientes', true]]},
    {grupo: 'global', casa: 'J.P. Morgan', links: [['Global Research', 'https://www.jpmorgan.com/insights/global-research', 'Temas em destaque, research mais recente, outlooks, mercados e economia', false]]},
    {grupo: 'global', casa: 'Morgan Stanley', links: [['Insights', 'https://www.morganstanley.com/insights', 'Artigos de research por tema e região, e o podcast Thoughts on the Market', false]]},
    {grupo: 'global', casa: 'BofA', links: [['Global Research', 'https://business.bofa.com/en-us/content/market-strategies-insights.html', 'Must Read Research e destaques; relatórios completos no portal de clientes', true]]},
    {grupo: 'global', casa: 'Citi', links: [['Insights (Citi GPS)', 'https://www.citigroup.com/global/insights', 'Citi Global Perspectives & Solutions, a série Must C da Citi Research e podcasts', false]]},
    {grupo: 'global', casa: 'UBS', links: [['Global Research', 'https://www.ubs.com/global/en/investment-bank/insights-and-data/global-research.html', 'UBS Global Research (banco de investimento), com temas em foco', true]]},
    {grupo: 'global', casa: 'Barclays', links: [['Research', 'https://www.ib.barclays/research.html', 'Áreas de research (ações, crédito, macro, temático, quantitativo) e insights; relatórios no Barclays Live, para clientes', true]]},
    {grupo: 'global', casa: 'Deutsche Bank', links: [['DB Research', 'https://www.dbresearch.com/', 'Publicações de macro, Alemanha, tecnologia e geopolítica, e Charts of the Day', false]]},
    {grupo: 'global', casa: 'HSBC', links: [['Global Research', 'https://www.business.hsbc.com/en-gb/products/global-investment-research', 'Página do HSBC Global Research com os artigos recentes; relatórios para clientes', true], ['Insights', 'https://www.business.hsbc.com/en-gb/insights', 'Lista de artigos e estudos do HSBC', false]]},
    {grupo: 'global', casa: 'Jefferies', links: [['Insights', 'https://www.jefferies.com/insights/', 'Mercados, política e entrevistas; o research de ações é para clientes', true]]},
    {grupo: 'global', casa: 'Nomura', links: [['Nomura Connects', 'https://www.nomuraconnects.com/', 'Economia, bancos centrais, juros, emergentes, Japão e outlook anual', false]]},
    {grupo: 'global', casa: 'Société Générale', links: [['Cross Asset Research', 'https://wholesale.banking.societegenerale.com/en/insights/news-press-room/news-details/news/cross-asset-research-delivering-content-with-impact', 'Apresentação do research da SG; não há lista pública de publicações', true]],
      nota: 'relatórios só na plataforma de clientes'},
    {grupo: 'global', casa: 'BNP Paribas', links: [['Markets 360', 'https://globalmarkets.cib.bnpparibas/markets-360/', 'Mercados e tendências, panorama econômico e Markets Pulse; relatórios completos com login', true]]},
    {grupo: 'global', casa: 'RBC Capital Markets', links: [['Insights', 'https://www.rbccm.com/en/insights', 'Thought leadership da RBC', false], ['Research', 'https://www.rbccm.com/en/insights/rbc-research', 'Research da RBC; o portal RBC Insight pede login', true],
      ['Estratégia e economia', 'https://www.rbccm.com/en/insights/strategy-economics', 'Análises da equipe de estratégia e economia', false]]},
    {grupo: 'global', casa: 'Wells Fargo', links: [['Economics', 'https://www.wellsfargo.com/cib/insights/economics/', 'Comentário semanal, outlook mensal e projeções da economia dos EUA', false]]}
  ];
  A.CASAS_RESEARCH = CASAS;
  function itemCasa(c) {
    return h('li', null, h('b', null, c.casa), ' · ', c.links.map(function (l, i) {
      return [i ? ' · ' : null, h('a', {href: l[1], target: '_blank', rel: 'noopener', title: l[2] + (l[3] ? ' (relatórios completos pedem login de cliente)' : '')}, l[0] + ' ↗'), l[3] ? h('small', {class: 'muted'}, ' login') : null];
    }), c.nota ? h('span', {class: 'rc-n muted'}, c.nota) : null);
  }
  A.researchCasas = function (compacto) {
    if (!CASAS.length) return null;
    var br = CASAS.filter(function (c) { return c.grupo === 'brasil'; }), gl = CASAS.filter(function (c) { return c.grupo === 'global'; });
    if (compacto) return h('div', {class: 'ext-g'}, h('h3', null, 'Research das casas'), h('p', {class: 'ext-l'}, h('span', {class: 'ext-k'}, 'Brasil'), br.map(function (c) { return h('a', {href: c.links[0][1], target: '_blank', rel: 'noopener'}, c.casa); })),
      h('p', {class: 'ext-l'}, h('span', {class: 'ext-k'}, 'Global'), gl.map(function (c) { return h('a', {href: c.links[0][1], target: '_blank', rel: 'noopener'}, c.casa); })));
    return A.sec('Research das casas · consulta externa', {id: 'rs-casas', hint: 'Abre a página de estudos e publicações de cada casa no seu navegador. O Oregon não coleta nem confere esse conteúdo; relatórios completos podem pedir login de cliente.'},
      h('div', {class: 'rc-g'}, h('div', null, h('h3', {class: 'np-sub'}, 'Brasil'), h('ul', {class: 'rc-l'}, br.map(itemCasa))), h('div', null, h('h3', {class: 'np-sub'}, 'Global'), h('ul', {class: 'rc-l'}, gl.map(itemCasa)))));
  };

  A.SUBS.brasil.push(['fluxo', 'Fluxo dos fundos']);
  var orig = A.areas.brasil;
  A.areas.brasil = function () {
    if (A.S.sub.brasil !== 'fluxo') return orig.apply(this, arguments);
    return h('div', null, A.subnav('brasil', A.SUBS.brasil, 'fluxo'), pagina());
  };
})(APP, CORE, INTEL);
