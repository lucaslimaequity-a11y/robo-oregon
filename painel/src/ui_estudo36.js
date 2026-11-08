/* ESTUDO E INDÚSTRIA · v3.6 — Wealth e consultorias (Mundo e Estratégia), Trilha de estudo CFP e CFA nível III
   (Biblioteca) e o Clássico da semana (Hoje). Tudo a partir do que o robô já coleta e da Estante; as relações de tema são
   por palavra-chave, com a lista à mostra neste arquivo. */
(function (A, C, I) {
  'use strict';
  var h = A.h, S = A.S;
  function nrm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  /* ---------- Mundo e Estratégia › Wealth e consultorias ---------- */
  var WF = {f: 'tudo', max: 30};
  var FILTROS = [['tudo', 'Tudo'], ['brasil', 'Brasil'], ['mundo', 'Mundo'], ['regulacao', 'Regulação'], ['estudos', 'Estudos']];
  function itensWealth() {
    var vis = {}, out = [];
    [A.itens(), A.itensResearch ? A.itensResearch() : []].forEach(function (l) { (l || []).forEach(function (x) { if (x.industria === 'wealth' && !vis[x.id] && !x.acervo && !x.agrupado_em) { vis[x.id] = 1; out.push(x); } }); });
    Object.keys(A.intel.meses || {}).forEach(function (m) { ((A.intel.meses[m] || {}).itens || []).forEach(function (x) { if (x.industria === 'wealth' && !vis[x.id] && !x.acervo && !x.agrupado_em) { vis[x.id] = 1; out.push(x); } }); });
    return out.sort(function (a, b) { return I.pub(b).localeCompare(I.pub(a)); });
  }
  function passa(x, f) {
    if (f === 'brasil') return x.pais === 'Brasil';
    if (f === 'mundo') return x.pais !== 'Brasil';
    if (f === 'regulacao') return x.industria_secao === 'regulacao';
    if (f === 'estudos') return x.categoria === 'instituicao' && x.industria_secao !== 'regulacao';
    return true;
  }
  function wealth() {
    var wrap = h('div'), l = itensWealth(), cont = {};
    FILTROS.forEach(function (f) { cont[f[0]] = l.filter(function (x) { return passa(x, f[0]); }).length; });
    wrap.appendChild(A.pageHead('Mundo e Estratégia', 'Wealth e consultorias', 'A indústria em que a consultoria trabalha: regulação da CVM, consultorias, assessorias, family offices e private banking no Brasil; a prática de advisory e os estudos de gestão de patrimônio lá fora. Nada do Grupo XP.'));
    wrap.appendChild(h('div', {class: 'sub filt', role: 'toolbar', 'aria-label': 'Filtro'}, FILTROS.map(function (f) { return h('button', {'aria-pressed': WF.f === f[0] ? 'true' : 'false', disabled: !cont[f[0]] && f[0] !== 'tudo' ? true : null, onclick: function () { WF.f = f[0]; WF.max = 30; A.rerender(); }}, f[1], cont[f[0]] ? h('small', null, String(cont[f[0]])) : null); })));
    var sel = l.filter(function (x) { return passa(x, WF.f); });
    wrap.appendChild(sel.length ? h('div', null, A.listaRows(sel, {max: WF.max}), sel.length > WF.max ? h('p', {class: 'mais'}, h('button', {class: 'btn sm', onclick: function () { WF.max += 30; A.rerender(); }}, 'Mostrar mais')) : null)
      : h('p', {class: 'empty'}, A.intel.versao ? 'As fontes da indústria de wealth entram a partir da primeira rodada do robô com a v3.6 (Kitces, InvestmentNews, WealthManagement.com, Financial Planning, Thinking Ahead Institute, notícias da CVM e buscas em português).' : 'Sem dados do robô nesta visualização.'));
    wrap.appendChild(A.sec('Estante de alocação e gestão de patrimônio', {hint: 'Acervo permanente: estudos completos, não notícias.'}, h('div', {class: 'row', style: 'gap:6px;flex-wrap:wrap'},
      [['vanguard', 'Vanguard'], ['tai', 'Thinking Ahead Institute'], ['nbim', 'Fundo soberano norueguês'], ['caia', 'CAIA'], ['cfa-rf', 'CFA Research Foundation'], ['gmo', 'GMO'], ['aqr', 'AQR']].map(function (c) {
        return h('button', {class: 'tag', onclick: function () { if (A.abrirEstante) A.abrirEstante(c[0]); }}, c[1]);
      }))));
    wrap.appendChild(h('p', {class: 'hint'}, 'Fontes: imprensa especializada dos EUA (só título, link e data; artigos de assinante não são abertos), Thinking Ahead Institute, notícias oficiais da CVM e buscas do Bing Notícias em português. O site da ANBIMA não pode ser lido por robôs; o que sai dela chega pela imprensa e pelas buscas.'));
    return wrap;
  }
  A.SUBS.mundo.push(['wealth', 'Wealth e consultorias']);
  var origM = A.areas.mundo;
  A.areas.mundo = function () {
    if (S.sub.mundo !== 'wealth') return origM();
    var w = h('div'); w.appendChild(A.subnav('mundo', A.SUBS.mundo)); w.appendChild(wealth()); return w;
  };

  /* ---------- Biblioteca › Trilha de estudo (CFP e CFA nível III) ---------- */
  // Módulos como publicados: CFP pela Planejar (8 módulos a partir do 52º exame, abril/2026); CFA nível III pelo CFA Institute.
  var TRILHAS = [
    {id: 'cfp', nome: 'CFP · Planejar (8 módulos)', fonte: 'https://www.planejar.org.br/conheca-o-exame', mods: [
      ['I · Planejamento Financeiro', /planejamento financeiro|financial plan|planner|metas financeiras|financial goals|household financ|financas pessoais|personal financ/],
      ['II · Gestão Financeira', /orcamento|budget|fluxo de caixa pessoal|household|endividamento|personal debt|reserva de emergencia|emergency fund|credito pessoal/],
      ['III · Planejamento de Investimentos e Gestão de Ativos', /asset allocation|alocacao|portfolio|carteira|diversif|risk premium|premio de risco|valuation|expected return|retorno esperado|factor/],
      ['IV · Planejamento de Aposentadoria', /retirement|aposentadoria|previdencia|pension|decumulation|withdrawal rate|safe withdrawal|annuit/],
      ['V · Planejamento de Seguros e Gestão de Riscos', /insurance|insurer|seguro|seguradora|annuit|anuidade|longevity risk|risco de longevidade/],
      ['VI · Planejamento Tributário', /\btax(es|ation)?\b|\btribut(o|os|ario|aria|acao)\b|\bimposto|tax.aware|tax.loss|\bjcp\b/],
      ['VII · Planejamento Patrimonial e Sucessório', /estate plan|sucess|heranca|inheritance|\btrust\b|holding familiar|family office|wealth transfer|transferencia de patrimonio/],
      ['VIII · Psicologia no Planejamento Financeiro', /behavio|comportament|\bbias|vies|psycholog|psicolog|emotion|regret|loss aversion|aversao a perda|decision/]]},
    {id: 'cfa3', nome: 'CFA nível III', fonte: 'https://www.cfainstitute.org/programs/cfa/exam/level-iii', mods: [
      ['Asset Allocation', /asset allocation|alocacao de ativos|strategic allocation|tactical|capital market (expectations|assumptions)|liabilit|total portfolio|60\/40/],
      ['Portfolio Construction', /portfolio construction|construcao de carteira|factor (investing|premi)|smart beta|index fund|indexing|index investing|passive invest|rebalanc|equity portfolio|fixed income portfolio/],
      ['Performance Measurement', /performance (attribution|measurement|evaluation)|benchmark|\balpha\b|\bsharpe\b|attribution analysis|\bgips\b|track record/],
      ['Derivatives and Risk Management', /derivativ|option|hedg|currency|cambio|risk management|tail risk|drawdown|volatil/],
      ['Ethical and Professional Standards', /ethic|etica|fiduciar|conflict of interest|conflito de interesse|standards of practice|compliance|suitability/],
      ['Pathway · Portfolio Management', /active manag|manager selection|portfolio manager|gestor de carteira|equity strateg|stock picking|market efficien/],
      ['Pathway · Private Markets', /private equity|private credit|venture|infrastructure|infraestrutura|real estate|illiquid|alternative/],
      ['Pathway · Private Wealth', /private wealth|wealth manag|high.net.worth|family office|financial advi|advisor|assessor|consultor/]]}
  ];
  var TR = {aberto: {}};
  function leituras() {
    var est = (A.intel.estante && A.intel.estante.itens) || [], vis = {}, out = [];
    est.forEach(function (x) { if (!x.titulo_provisorio) out.push({t: x.titulo, x: x, est: true, ano: x.ano, col: x.col, link: x.link}); });
    (A.itensResearch ? A.itensResearch() : []).forEach(function (x) { if (!vis[x.id] && !x.acervo && /^gestora_|^instituicao$|^academia$/.test(x.categoria || '')) { vis[x.id] = 1; out.push({t: x.titulo, x: x, est: false}); } });
    return out;
  }
  function trilha() {
    var wrap = h('div');
    if (!A.intel.estante && A.carregarEstante) A.carregarEstante();
    wrap.appendChild(A.pageHead('Biblioteca', 'Trilha de estudo', 'A Estante e o Research organizados pelos módulos do CFP (Planejar) e do CFA nível III. Cada módulo mostra as leituras que tratam dele (por palavra-chave do título) e quantas anotações suas já existem sobre o tema.'));
    var L = leituras(), notas = A.aprendizados ? A.aprendizados() : [];
    var g = h('div', {class: 'grid2 tr-g'});
    TRILHAS.forEach(function (tr) {
      var col = h('div');
      col.appendChild(h('h2', {class: 'tr-h'}, tr.nome, ' ', h('a', {href: tr.fonte, target: '_blank', rel: 'noopener', class: 'tr-f'}, 'programa oficial ↗')));
      tr.mods.forEach(function (m, i) {
        var rx = m[1], ls = L.filter(function (o) { return rx.test(nrm(o.t)); }), est = ls.filter(function (o) { return o.est; });
        var an = notas.filter(function (a) { return rx.test(nrm((a.titulo || '') + ' ' + (a.nota || '') + ' ' + (a.temas || []).join(' '))); }).length;
        var k = tr.id + i, ab = !!TR.aberto[k];
        var top = est.slice().sort(function (a, b) { return (b.ano || 0) - (a.ano || 0); }).slice(0, ab ? 20 : 3).concat(ab ? ls.filter(function (o) { return !o.est; }).slice(0, 10) : []);
        col.appendChild(h('div', {class: 'tr-m'},
          h('div', {class: 'tr-mh'}, h('b', null, m[0]), h('span', {class: 'muted'}, ls.length + ' leituras · ', h('span', {class: an ? 'tr-ok' : null}, an + (an === 1 ? ' anotação sua' : ' anotações suas')))),
          top.length ? h('ul', {class: 'tr-l'}, top.map(function (o) {
            var lk = A.link(o.link || (o.x && o.x.link));
            return h('li', null, o.est ? (lk ? h('a', {href: lk, target: '_blank', rel: 'noopener'}, o.t) : o.t) : h('button', {class: 'nwl', onclick: function () { A.abrirItem(o.x); }}, o.t),
              h('span', {class: 'muted'}, o.est ? ' · Estante' + (o.ano ? ' · ' + o.ano : '') : ' · ' + (o.x.organizacao || o.x.fonte || '') + ' · ' + I.quando(o.x)),
              ' ', h('button', {class: 'btn link sm', onclick: function () { A.drawer('Anotar o que aprendi', A.formAprendizado(o.est ? null : o.x, o.est ? {tipo: 'aprendizado', titulo: o.t, fonte: 'Estante', link: o.link, temas: [m[0]]} : undefined)); }}, 'anotar'));
          })) : h('p', {class: 'muted tr-vz'}, A.intel.estante ? 'Nenhuma leitura com esse tema ainda.' : 'Abrindo a Estante…'),
          ls.length > 3 ? h('button', {class: 'btn link sm', onclick: function () { TR.aberto[k] = !ab; A.rerender(); }}, ab ? 'menos' : 'ver mais') : null));
      });
      g.appendChild(col);
    });
    wrap.appendChild(g);
    wrap.appendChild(h('p', {class: 'hint'}, 'Módulos do CFP conforme a Planejar a partir do 52º exame (abril/2026); tópicos e caminhos (pathways) do CFA nível III conforme o CFA Institute. A relação leitura × módulo é por palavra-chave do título: é um mapa de estudo, não a bibliografia oficial.'));
    return wrap;
  }
  A.SUBS.bib.splice(2, 0, ['trilha', 'Trilha de estudo']);
  var origB = A.areas.bib;
  A.areas.bib = function () {
    if (S.sub.bib !== 'trilha') return origB();
    var w = h('div'); w.appendChild(A.subnav('bib', A.SUBS.bib)); w.appendChild(trilha()); return w;
  };

  /* ---------- Hoje › Clássico da semana ---------- */
  A.classicoDaSemana = function () {
    var a = A.arquivo('biblioteca/estante_destaque.json'), d = a.dados;
    if (!d || !d.item) return null;
    var x = d.item, lk = A.link(x.link);
    return h('div', {class: 'paper-sem classico'}, h('p', {class: 'ar-k'}, 'Clássico da semana' + (d.tema_nome ? ' · tema em alta: ' + d.tema_nome + (d.n_tema ? ' (' + d.n_tema + (d.n_tema === 1 ? ' leitura' : ' leituras') + ' na semana)' : '') : '')),
      lk ? h('a', {class: 'nwl', href: lk, target: '_blank', rel: 'noopener', title: x.link_tipo === 'indice_autor' ? (x.link_nota || 'Abre o índice do autor') : 'Abrir na fonte original'}, x.titulo + ' ↗') : h('b', null, x.titulo),
      h('p', {class: 'muted'}, [d.colecao, x.instituicao && x.instituicao !== d.colecao ? x.instituicao : null, x.ano].filter(Boolean).join(' · ') + ' · ',
        h('button', {class: 'btn link', onclick: function () { A.drawer('Clássico da semana', h('div', null, h('p', {class: 'tv-lead'}, x.titulo), A.formAprendizado(null, {tipo: 'aprendizado', titulo: x.titulo, fonte: d.colecao, link: x.link, temas: []}))); }}, 'anotar o que aprendi'),
        A.botaoComite ? [' · ', A.botaoComite(x)] : null));
  };
})(APP, CORE, INTEL);
