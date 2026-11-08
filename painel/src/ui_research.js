/* Research e Comitê */
(function (A, C) {
  'use strict';
  var h = A.h, S = A.S;

  // RESEARCH BRASIL: empresas, macro → empresas e acontecimentos
  A.areas.res = function () {
    var wrap = h('div'), s = S.sub.res;
    if (['empresas', 'macro', 'eventos'].indexOf(s) < 0) s = S.sub.res = 'empresas';
    wrap.appendChild(A.subnav('res', A.SUBS.res));
    wrap.appendChild(s === 'macro' ? macroEmpresas() : s === 'eventos' && A.noticiasTela ? h('div', null, A.pageHead('Research Brasil', 'Acontecimentos', 'Fatos selecionados pela relevância para as carteiras e as teses, não um feed. Cada item diz a fonte, por que importa e o que testar.'), A.noticiasTela()) : empresas());
    return wrap;
  };
  // SALA DE GESTÃO E COMITÊ
  A.areas.sala = function () {
    var wrap = h('div'), s = S.sub.sala, host = document.getElementById('cg-host');
    if (!A.SUBS.sala.some(function (x) { return x[0] === s; })) s = S.sub.sala = 'reuniao';
    if (host) host.hidden = s !== 'comite';
    wrap.appendChild(A.subnav('sala', A.SUBS.sala));
    if (s === 'comite') { wrap.appendChild(h('p', {class: 'hint'}, 'Guia do Comitê de Investimentos de 05 e 06/11/2026 (Research Brasil), preservado sem alterações. A− e A+ mudam o tamanho do texto.')); setTimeout(function () { window.dispatchEvent(new CustomEvent('ov:show', {detail: 'comite'})); }, 0); return wrap; }
    wrap.appendChild(s === 'reuniao' ? A.sala() : s === 'decisoes' ? decisoes() : s === 'textos' ? textos() : s === 'pauta' ? pauta() : historico());
    return wrap;
  };
  A.resPerf = function () { return perf(); };

  /* ---------- Empresas: ficha objetiva ---------- */
  var EMP = {t: null, f: 'Ações'};
  A.abrirEmpresa = function (t) { if (t === 'BBDC4') t = 'BBDC3'; if (C.ATV[t]) { EMP.t = t; EMP.f = C.ATV[t].classe || 'Todos'; } A.go('res', 'empresas'); };
  function precoVivo(t) {
    var E = A.mercadoEstado || {}, snap = E.snap; if (!snap || !snap.ativos) return null;
    var c = snap.ativos[t] || (t === 'BBDC4' ? snap.ativos.BBDC3 : null); if (!c || c.preco == null) return c ? {st: MERCADO.estado(c), motivo: c.motivo} : null;
    return {p: c.preco, var: c.var, data: c.data, hora: c.hora, fonte: c.fonte, st: MERCADO.estado(c), moeda: c.moeda};
  }
  function empresas() {
    var wrap = h('div');
    wrap.appendChild(A.pageHead('Research Brasil · inteligência fundamentalista', 'Empresas', 'Ficha objetiva de cada ativo: o que é estrutural na tese separado do que é conjuntural, valuation com o preço do robô e o peso em cada carteira.',
      h('button', {class: 'btn', onclick: function () { var d = A.drawer('Teses da Carteira Oregon · visão geral', A.tesesOregon()); d.classList.add('wide'); }}, 'Visão geral das teses')));
    var lista = Object.keys(C.ATV).filter(function (t) { var a = C.ATV[t]; return a.status !== 'placeholder' && (EMP.f === 'Todos' || a.classe === EMP.f); });
    if (!EMP.t || lista.indexOf(EMP.t) < 0) EMP.t = lista[0];
    var fsel = h('div', {class: 'sub', style: 'margin:0 0 8px'}, ['Ações', 'FIIs', 'Renda fixa', 'Alternativos', 'Todos'].map(function (x) { return h('button', {'aria-pressed': EMP.f === x ? 'true' : 'false', onclick: function () { EMP.f = x; EMP.t = null; A.render(); }}, x); }));
    var rows = lista.map(function (t) { var a = C.ATV[t], pv = precoVivo(t), px = pv && pv.p != null ? pv.p : null, ok = pv && pv.st === 'atualizado'; return {t: t, nome: a.nome, setor: a.setor, rec: a.rec, px: px, st: pv ? pv.st : 'indisponivel', var: pv ? pv.var : null, up: a.teto && px && ok ? a.teto / px - 1 : null, w: (A.pesosDoAtivo ? A.pesosDoAtivo(t) : []).length}; });
    var g = h('div', {class: 'grid-emp'}), L = h('div', {class: 'sticky'}), R = h('div'); g.append(L, R); wrap.appendChild(g);
    L.appendChild(A.sec('Ativos', {flush: true}, [h('div', {style: 'padding:0 18px'}, fsel), A.table([
      {k: 't', t: 'Ativo', f: function (r) { return h('span', null, h('b', null, r.t), h('div', {class: 'muted', style: 'font-size:.8rem'}, r.setor || r.nome)); }},
      {k: 'var', t: 'Dia', r: 1, f: function (r) { return r.var == null ? h('span', {class: 'muted'}, '—') : h('span', {class: r.st === 'atualizado' ? A.cls(r.var) : 'muted', title: MERCADO.ESTADO_TXT[r.st]}, MERCADO.fmtVar(r.var, '%')); }},
      {k: 'up', t: 'Até o teto', r: 1, f: function (r) { return r.up == null ? '—' : h('span', {class: A.cls(r.up)}, A.spct(r.up, 0)); }}
    ], rows, {sort: 't', dir: 1, search: 'Filtrar', onRow: function (r) { EMP.t = r.t; A.render(); }, rowClass: function (r) { return r.t === EMP.t ? 'sel' : null; }})]));
    R.appendChild(empresa(EMP.t));
    return wrap;
  }
  function empresa(t) {
    var a = C.ATV[t]; if (!a) return h('div');
    var box = h('div'), pv = precoVivo(t), tx = A.teseDe(t), T = tx && tx.tese, P = A.prem(), sen = P.sens[t], org = P.origem[t] || (P.estimadas[t] ? 'e' : null);
    box.appendChild(h('div', {class: 'tv'}, h('p', {class: 'tv-crumb'}, (a.pilar ? a.pilar + ' · ' + (C.PIL[a.pilar] ? C.PIL[a.pilar].nome : '') + ' · ' : '') + (a.setor || a.tipo)), h('h2', {class: 'tv-nome'}, a.nome, h('span', {class: 'tv-tk'}, t), A.stchip(a.status))));
    // valuation: preço do robô × preço-teto das Teses; o que não existe aparece como não informado
    var px = pv && pv.p != null ? pv.p : null, up = a.teto && px && pv.st === 'atualizado' ? a.teto / px - 1 : null, mo = pv && pv.moeda === 'USD' ? 'US$ ' : 'R$ ';
    box.appendChild(h('div', {class: 'vbox'},
      h('div', null, h('span', {class: 'k'}, 'Preço atual'), h('b', null, px != null ? mo + A.num(px, 2) : '—'), h('small', null, pv ? (px != null ? MERCADO.ESTADO_TXT[pv.st] + ' · ' + A.dataBR(pv.data) + (pv.hora ? ' ' + pv.hora : '') + ' · ' + pv.fonte : 'sem cotação' + (pv.motivo ? ': ' + pv.motivo : '')) : 'sem leitura do robô')),
      h('div', null, h('span', {class: 'k'}, 'Preço-teto'), h('b', null, a.teto ? 'R$ ' + A.num(a.teto, 2) : '—'), h('small', null, a.teto ? (a.fonte_preco || 'Teses') + (a.metodologia_teto ? ' · ' + a.metodologia_teto : ' · metodologia não informada') : 'não informado')),
      h('div', null, h('span', {class: 'k'}, 'Até o teto'), h('b', {class: A.cls(up)}, up != null ? A.spct(up, 1) : '—'), h('small', null, up != null ? 'teto ÷ preço atual − 1 (cálculo)' : px != null && a.teto ? 'preço ' + MERCADO.ESTADO_TXT[pv.st] + ': cálculo suspenso' : 'falta preço ou teto')),
      h('div', null, h('span', {class: 'k'}, 'Valor justo'), h('b', null, a.justo ? 'R$ ' + A.num(a.justo, 2) : '—'), h('small', null, a.justo ? 'Teses' : 'não informado')),
      h('div', null, h('span', {class: 'k'}, 'Recomendação'), h('b', {style: 'font-size:1.05rem;font-family:var(--sans);font-weight:600'}, a.rec || '—'), h('small', null, a.rec ? 'Teses de 04/11/2026' : 'não informada')),
      h('div', null, h('span', {class: 'k'}, 'Retorno 12m'), h('b', {class: A.cls(a.ret_12m)}, a.ret_12m != null ? A.spct(a.ret_12m, 1) : '—'), h('small', null, a.ret_12m != null ? (a.fonte_ret || '') : 'não informado'))));
    box.appendChild(h('p', {class: 'hint'}, 'Retorno esperado e convicção: não informados nas fontes do painel; não são estimados aqui.'));
    var pw = A.pesosDoAtivo ? A.pesosDoAtivo(t) : [];
    box.appendChild(h('p', {style: 'font-size:.92rem'}, h('span', {class: 'k', style: 'margin-right:8px'}, 'Nas carteiras'), pw.length ? pw.map(function (x, i) { return h('span', null, i ? ' · ' : '', x.m.rotulo + ' ', h('b', null, A.pct(x.w, 1))); }) : h('span', {class: 'muted'}, 'em nenhuma carteira aprovada')));
    var g = h('div', {class: 'grid2'}), L = h('div'), R = h('div'); g.append(L, R); box.appendChild(g);
    // ESTRUTURAL
    L.appendChild(h('div', {class: 'k', style: 'margin:4px 0 8px'}, 'Estrutural · a tese'));
    if (T) L.appendChild(A.sec('Tese · documento de 30/10/2026', {right: h('button', {class: 'btn sm', onclick: function () { A.abrirTese(t); }}, 'Tela cheia')}, A.teseView(t)));
    else L.appendChild(A.sec('Tese', null, h('div', null, tx && tx.nota ? h('div', {class: 'alert warn'}, tx.nota) : h('p', {class: 'muted'}, 'Sem tese no documento de 30/10/2026.'), a.tese ? h('p', null, a.tese) : null, a.motores ? h('p', null, h('b', null, 'Motores: '), a.motores) : null, a.riscos ? h('p', null, h('b', null, 'Riscos: '), a.riscos) : null)));
    // CONJUNTURAL
    R.appendChild(h('div', {class: 'k', style: 'margin:4px 0 8px'}, 'Conjuntural · o que mudou'));
    var H = A.mercadoHist ? A.mercadoHist() : null, se = H && H.series ? (H.series[t] || (t === 'BBDC4' ? H.series.BBDC3 : null)) : null;
    if (se) {
      var t1 = MERCADO.tendencia(se.pts, 30), t12 = MERCADO.tendencia(se.pts, 365);
      R.appendChild(A.sec('Preço', {hint: (se.tipo === 'ajustado' ? 'Série ajustada por proventos (retorno total) · ' : se.tipo === 'preco' ? 'Preço sem ajuste de proventos · ' : '') + se.fonte + (se.qualidade && se.qualidade !== 'ok' ? ' · qualidade: ' + se.qualidade : '')},
        h('div', null, h('div', {class: 'row', style: 'gap:18px;font-size:.92rem'}, h('span', null, '1 mês ', h('b', {class: A.cls(t1 && t1.r)}, t1 ? A.spct(t1.r, 1) : '—')), h('span', null, '12 meses ', h('b', {class: A.cls(t12 && t12.r)}, t12 ? A.spct(t12.r, 1) : '—'))),
          A.lines([{name: t, pts: se.pts.slice(-260)}], {fmt: function (v) { return A.num(v, 2); }, h: 170}))));
    }
    var E = A.mercadoEstado || {}, nots = ((E.arquivo && E.arquivo.itens) || (E.snap && E.snap.noticias) || []).filter(function (n) { return n.tema === t || (t === 'BBDC3' && n.tema === 'BBDC4') || (n.temas || []).indexOf(t) >= 0; }).slice(0, 8);
    R.appendChild(A.sec('Fatos recentes', {hint: 'Do robô: documentos da CVM e manchetes que mencionam a empresa certa, com a classificação por regras. Média e alta relevância primeiro.'}, nots.length ? h('div', null, nots.sort(function (x, y) { var r = {alta: 0, media: 1, baixa: 2}; return (r[(x.classe || {}).relevancia] || 2) - (r[(y.classe || {}).relevancia] || 2) || (y.quando || '').localeCompare(x.quando || ''); }).map(function (n) {
      var k = n.classe || {};
      return h('div', {class: 'noticia'}, h('div', {class: 'row', style: 'gap:6px'}, A.chip(k.relevancia || '—', k.relevancia === 'alta' ? 'g-critica' : k.relevancia === 'media' ? 'g-media' : ''), k.oficial ? A.chip('oficial', 'o-obs') : null, h('span', {class: 'muted', style: 'font-size:.8rem'}, (n.fonte || '') + (n.quando ? ' · ' + A.dataBR(n.quando) : ''))),
        A.link(n.link) ? h('a', {href: A.link(n.link), target: '_blank', rel: 'noopener'}, n.titulo) : h('b', null, n.titulo), k.porque ? h('div', {class: 'muted', style: 'font-size:.86rem'}, k.porque) : null);
    })) : h('p', {class: 'empty'}, 'Nenhum fato recente da empresa no arquivo do robô.')));
    if (sen && sen.m !== 'nd') {
      var lin = sen.m === 'acao' ? [['Beta ao Ibovespa', sen.beta], ['Juros (curva +1 p.p. → %)', sen.j], ['Dólar (+1% → %)', sen.u], ['Brent (+1% → %)', sen.b]] : sen.m === 'fii' ? [['Beta ao Ibovespa', sen.beta], ['Duration de juro real (anos)', sen.d]] : sen.m === 'rf' ? [['Fator', sen.f], ['Duration (anos)', sen.d]] : [];
      R.appendChild(A.sec('Sensibilidades usadas nos cenários', {badge: A.ochip(org || 'ia'), hint: 'Premissas, não medições: hipótese inicial a revisar, premissa do gestor ou estimada por regressão (Carteiras → Risco e cenários → Premissas).'}, h('dl', {class: 'kv'}, lin.map(function (x) { return [h('dt', null, x[0]), h('dd', {class: 'num'}, x[1] == null ? '—' : typeof x[1] === 'number' ? A.num(x[1], 2) : String(x[1]))]; }))));
    }
    box.appendChild(h('div', {class: 'k', style: 'margin:14px 0 8px'}, 'Acompanhamento e resultados'));
    box.appendChild(fichaForms(t));
    return box;
  }

  /* ---------- Macro → empresas ---------- */
  var CHOQ = [['pre', 1, 'Curva prefixada +1 p.p.'], ['real', 0.5, 'Juro real +0,5 p.p.'], ['usd', -10, 'Real valoriza 10%'], ['brent', -20, 'Brent −20%'], ['ibov', -10, 'Ibovespa −10%']];
  function canal(sen, k) {
    if (!sen || sen.m === 'nd') return false;
    if (sen.m === 'acao') return ({pre: sen.j, usd: sen.u, brent: sen.b, ibov: sen.beta})[k] ? true : false;
    if (sen.m === 'fii') return ({ibov: sen.beta, real: sen.d})[k] ? true : false;
    if (sen.m === 'rf') return sen.f === k && !!sen.d;
    return false;
  }
  function macroEmpresas() {
    var wrap = h('div'), P = A.prem();
    wrap.appendChild(A.pageHead('Research Brasil · macro → empresas', 'Como uma variável macro afeta cada empresa', 'Mesmo choque, efeitos diferentes. Os números vêm das premissas de sensibilidade de cada ativo, que são hipóteses internas (não elasticidades medidas). A origem de cada linha está indicada; ajuste em Carteiras → Risco e cenários → Premissas.'));
    var ts = Object.keys(C.ATV).filter(function (t) { var a = C.ATV[t]; return a.status !== 'placeholder' && (a.classe === 'Ações' || a.classe === 'FIIs' || a.classe === 'Renda fixa') && a.moeda !== 'USD'; });
    var ordem = {'Ações': 0, 'FIIs': 1, 'Renda fixa': 2};
    ts.sort(function (x, y) { return (ordem[C.ATV[x].classe] - ordem[C.ATV[y].classe]) || (C.ATV[x].setor || '').localeCompare(C.ATV[y].setor || '') || x.localeCompare(y); });
    var t = h('table', {class: 'sens'}), tb = h('tbody');
    t.appendChild(h('thead', null, h('tr', null, h('th', {class: 'l'}, 'Ativo'), h('th', null, 'Origem'), CHOQ.map(function (c) { return h('th', null, c[2]); }))));
    var cls0 = null;
    ts.forEach(function (tk) {
      var a = C.ATV[tk], sen = P.sens[tk], org = P.origem[tk] || 'ia';
      if (a.classe !== cls0) { cls0 = a.classe; tb.appendChild(h('tr', null, h('th', {class: 'l', colspan: CHOQ.length + 2, style: 'padding-top:12px;color:var(--muted);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase'}, cls0))); }
      tb.appendChild(h('tr', null, h('th', {class: 'l'}, A.tk(tk), h('span', {class: 'muted', style: 'font-size:.78rem'}, ' ' + (a.setor || ''))), h('td', null, sen && sen.m !== 'nd' ? A.ochip(org) : A.chip('sem premissa')),
        CHOQ.map(function (c) {
          if (!canal(sen, c[0])) return h('td', {class: 'z', title: 'Sem canal cadastrado para este fator nas premissas: não quer dizer efeito zero.'}, '·');
          var one = {}; one[c[0]] = c[1]; var r = C.retAtivo(tk, one, P.sens); if (!r.ok) return h('td', {class: 'z'}, '·');
          return h('td', {class: r.total > 0.0005 ? 'p' : r.total < -0.0005 ? 'n' : 'z', title: tk + ' · ' + c[2] + ': ' + A.spct(r.total, 1) + ' (premissa ' + org + ')'}, A.spct(r.total, 1));
        })));
    });
    t.appendChild(tb);
    wrap.appendChild(A.sec('Efeito de cada choque, ativo por ativo', {hint: '“·” quer dizer que não há canal cadastrado para aquele fator no modelo do ativo (por exemplo, Selic e inadimplência não entram no modelo das ações): não é efeito zero.'}, h('div', {class: 'tw'}, t)));
    // canais sem elasticidade: leitura qualitativa
    var Q = [['Revisão tarifária no setor elétrico', 'ele'], ['Deterioração da inadimplência bancária', 'fin'], ['Crédito privado: spread e inadimplência', 'cred'], ['Ações sensíveis a juros', 'jur']];
    var GR = {}; (C.D.grupos || []).forEach(function (g) { GR[g.id] = g; });
    wrap.appendChild(A.sec('Canais sem elasticidade cadastrada', {hint: 'Leitura qualitativa do canal de transmissão, com o peso exposto em cada carteira. Nenhum número de efeito é estimado aqui.'}, h('div', {class: 'tv-cards'}, Q.filter(function (q) { return GR[q[1]]; }).map(function (q) {
      var g = GR[q[1]], exp = C.CARTS.map(function (m) { var v = STORE.aprovadaVigente(C, m.id); return {m: m, w: C.sum((v.pos || []).filter(function (x) { return x.w > 0 && g.tickers.indexOf(x.t) >= 0; }), function (x) { return x.w; })}; }).filter(function (x) { return x.w > 0; }).sort(function (a, b) { return b.w - a.w; });
      return h('div', {class: 'tv-card', style: 'cursor:default'}, h('b', null, q[0]), h('span', {class: 'tv-cq'}, g.canal), h('span', null, g.tickers.map(function (x) { return C.ATV[x] && C.ATV[x].status !== 'placeholder' ? A.tk(x) : null; }).filter(Boolean).reduce(function (acc, el, i) { if (i) acc.push(' '); acc.push(el); return acc; }, [])), h('span', {class: 'muted', style: 'font-size:.82rem'}, exp.length ? 'Mais exposta: ' + exp[0].m.rotulo + ' (' + A.pct(exp[0].w, 1) + ')' : 'sem peso nas carteiras aprovadas'));
    }))));
    return wrap;
  }

  /* ---------- teses ---------- */
  var KPI = {
    'Bancos': ['Índice de Basileia', 'Capital principal (CET1)', 'Inadimplência acima de 90 dias', 'Custo do crédito', 'ROE', 'Índice de eficiência', 'Crescimento da carteira de crédito'],
    'Holding (Itaú)': ['Desconto de holding', 'ROE do Itaú', 'Índice de Basileia do Itaú', 'Inadimplência acima de 90 dias', 'Dividendos recebidos'],
    'Bancos digitais': ['Clientes ativos', 'Receita por cliente ativo', 'ROE', 'Índice de eficiência', 'Inadimplência acima de 90 dias', 'Índice de Basileia'],
    'Seguros': ['Sinistralidade', 'Índice combinado', 'Crescimento dos prêmios', 'Resultado financeiro', 'ROE', 'Payout'],
    'Energia elétrica': ['Base de remuneração regulatória', 'WACC regulatório', 'Próxima revisão tarifária', 'Perdas de energia', 'Dívida líquida / EBITDA', 'Capex'],
    'Energia e saneamento': ['Base de remuneração regulatória', 'WACC regulatório', 'Perdas', 'Inadimplência', 'Dívida líquida / EBITDA', 'Capex'],
    'Petróleo': ['Produção (mil boe/dia)', 'Lifting cost (US$/boe)', 'Breakeven do Brent', 'Reservas provadas (anos)', 'Dívida líquida / EBITDA', 'Dividendos / fluxo de caixa livre'],
    'Papel e celulose': ['Preço da celulose', 'Cash cost', 'Volume vendido', 'Dívida líquida / EBITDA', 'Câmbio médio do trimestre'],
    'Shoppings': ['Vendas mesmas lojas', 'Aluguel mesmas lojas', 'Taxa de ocupação', 'NOI', 'Dívida líquida / EBITDA'],
    'Locação de pesados': ['Taxa de utilização da frota', 'ROIC', 'Custo da dívida', 'Dívida líquida / EBITDA', 'Capex'],
    'Agronegócio': ['Volume de grãos', 'Margem bruta', 'Dívida líquida / EBITDA', 'Capital de giro'],
    'FII': ['Vacância física', 'Vacância financeira', 'Cap rate', 'P/VP', 'Dividend yield', 'Inadimplência / LTV'],
    'ETF': ['Duration', 'Yield / taxa', 'Taxa de administração', 'Tracking difference']
  };
  var GERAIS = ['Tese central', 'Motores de geração de valor', 'Preço teto e metodologia', 'Valor justo', 'ROIC', 'Custo de capital', 'ROE', 'Margens', 'Crescimento', 'Geração de caixa', 'Endividamento e vencimentos', 'Dividendos e recompras', 'Riscos específicos', 'Catalisadores', 'Condições de invalidação'];
  function kpis(t) { var a = C.ATV[t]; if (!a) return []; if (KPI[a.setor]) return KPI[a.setor]; if (a.tipo === 'FII') return KPI.FII; if (/ETF/.test(a.tipo)) return KPI.ETF; return ['Receita', 'Margem EBITDA', 'Lucro líquido', 'ROIC', 'ROE', 'Dívida líquida / EBITDA']; }

  function teses() {
    var st = A.tesState = A.tesState || {t: 'ITSA4', f: 'Ações', modo: 'oregon'};
    if (!st.modo) st.modo = 'fichas';
    var tog = h('div', {class: 'sub', role: 'toolbar', 'aria-label': 'Modo'}, [['oregon', 'Teses da Carteira Oregon (30/10)'], ['fichas', 'Fichas e acompanhamento']].map(function (m) { return h('button', {'aria-pressed': st.modo === m[0] ? 'true' : 'false', onclick: function () { st.modo = m[0]; A.render(); }}, m[1]); }));
    if (st.modo === 'oregon') return h('div', null, tog, A.tesesOregon());
    return h('div', null, tog, fichas(st));
  }
  function fichas(st) {
    var wrap = h('div'), g = h('div', {class: 'grid2'}), L = h('div'), R = h('div');
    wrap.appendChild(A.sec('Os 13 pilares', {flush: true, hint: 'Papel de cada pilar e retorno do benchmark como apresentado no deck do Comitê (fechamento de 30/10/2026). Pilar 5 é o core da renda variável Brasil; Pilar 6 é satélite.'}, A.table([
      {k: 'pilar', t: 'Pilar', s: function (p) { return p.ordem; }, f: function (p) { return h('b', null, p.pilar + ' · ' + p.nome); }},
      {k: 'papel', t: 'Papel', f: function (p) { return h('div', null, p.papel, p.desempenho ? h('div', {class: 'muted', style: 'font-size:.84rem'}, p.desempenho) : null); }},
      {k: 'benchmark', t: 'Benchmark', f: function (p) { return p.benchmark || '—'; }},
      {k: 'bench_ano', t: 'No ano', r: 1, f: function (p) { return p.bench_ano == null ? '—' : h('span', {class: A.cls(p.bench_ano)}, A.spct(p.bench_ano)); }},
      {k: 'bench_12m', t: '12 meses', r: 1, f: function (p) { return p.bench_12m == null ? '—' : h('span', {class: A.cls(p.bench_12m)}, A.spct(p.bench_12m)); }}
    ], C.D.pilares, {sort: 'pilar', dir: 1})));
    g.append(L, R); wrap.appendChild(g);
    var fsel = h('select', {class: 'inp', onchange: function () { st.f = fsel.value; A.render(); }}, ['Todos', 'Ações', 'FIIs', 'Renda fixa', 'Alternativos'].map(function (x) { return h('option', {selected: st.f === x || null}, x); }));
    var rows = Object.keys(C.ATV).filter(function (t) { var a = C.ATV[t]; return a.status !== 'placeholder' && (st.f === 'Todos' || a.classe === st.f); }).map(function (t) { var a = C.ATV[t]; return {t: t, nome: a.nome, setor: a.setor, p: a.pilar, rec: a.rec, up: a.teto && a.cotacao ? a.teto / a.cotacao - 1 : null, st: a.status, ed: !!STORE.get('teses', t)}; });
    L.appendChild(A.sec('Ativos', {right: fsel, flush: true}, A.table([
      {k: 't', t: 'Ativo', f: function (r) { return h('span', null, h('b', null, r.t), ' ', h('span', {class: 'muted'}, r.nome)); }}, {k: 'setor', t: 'Setor'}, {k: 'rec', t: 'Rec.'},
      {k: 'up', t: 'Até o teto', r: 1, f: function (r) { return r.up == null ? '—' : h('span', {class: A.cls(r.up)}, A.spct(r.up, 0)); }},
      {k: 'ed', t: 'Ficha', f: function (r) { return r.ed ? A.chip('atualizada', 'o-gestor') : ''; }}
    ], rows, {sort: 't', dir: 1, search: 'Filtrar', onRow: function (r) { st.t = r.t; A.render(); }, rowClass: function (r) { return r.t === st.t ? 'sel' : null; }})));
    R.appendChild(ficha(st.t));
    return wrap;
  }
  function fichaForms(t) { return ficha(t, true); }
  function ficha(t, soForms) {
    var a = C.ATV[t]; if (!a) return h('div');
    var doc = STORE.get('teses', t) || {campos: {}, kpi: {}, resultados: []}, ed = C.clone(doc.campos || {});
    var base = {'Tese central': a.tese, 'Motores de geração de valor': a.motores, 'Riscos específicos': a.riscos, 'Preço teto e metodologia': a.teto ? 'R$ ' + A.num(a.teto) + ' · metodologia não informada nas Teses' : null, 'Valor justo': a.justo ? 'R$ ' + A.num(a.justo) : null};
    var box = h('div');
    var tx = A.teseDe(t);
    if (!soForms && tx && (tx.tese || tx.nota)) box.appendChild(A.sec('Tese · documento de 30/10/2026', {right: h('button', {class: 'btn sm', onclick: function () { A.abrirTese(t); }}, 'Abrir em tela cheia')}, A.teseView(t)));
    if (!soForms) box.appendChild(A.sec(t + ' · ' + a.nome, {badge: A.stchip(a.status)}, [
      h('dl', {class: 'kv'}, h('dt', null, 'Pilar · setor'), h('dd', null, a.pilar + ' · ' + a.setor + ' · ' + a.tipo), h('dt', null, 'Recomendação'), h('dd', null, a.rec || '—'), a.proxy_us ? h('dt', null, 'Par nos EUA') : null, a.proxy_us ? h('dd', null, a.proxy_us + ' (usado só como aproximação quando não há série do UCITS)') : null,
        a.ret_ano != null ? h('dt', null, 'Retorno no ano') : null, a.ret_ano != null ? h('dd', null, A.spct(a.ret_ano) + ' · ' + (a.fonte_ret || '')) : null,
        h('dt', null, 'Cotação · teto'), h('dd', null, a.cotacao ? 'R$ ' + A.num(a.cotacao) + ' · R$ ' + A.num(a.teto) + ' (' + a.fonte_preco + ')' : '—'),
        h('dt', null, 'Retorno 12 meses'), h('dd', null, a.ret_12m != null ? A.spct(a.ret_12m) + ' · ' + (a.fonte_ret || '') : '—'), h('dt', null, 'Proventos 12 meses'), h('dd', null, a.dy_12m != null ? A.pct(a.dy_12m) : '—'),
        a.acompanhamos ? h('dt', null, 'O que acompanhamos') : null, a.acompanhamos ? h('dd', null, a.acompanhamos) : null, a.ponto ? h('dt', null, a.ponto_t || 'Ponto') : null, a.ponto ? h('dd', null, a.ponto) : null,
        a.obs ? h('dt', null, 'Observação') : null, a.obs ? h('dd', null, a.obs) : null, a.status_nota ? h('dt', null, 'Status') : null, a.status_nota ? h('dd', null, a.status_nota) : null),
      h('p', {class: 'hint'}, 'Textos das Teses de Investimento de 04/11/2026, reproduzidos sem alteração.')
    ]));
    var form = h('div', {class: 'form', style: 'grid-template-columns:1fr'}, GERAIS.map(function (k) {
      var e = h('textarea', {class: 'inp w', style: 'min-height:54px', placeholder: base[k] ? '' : 'Não disponível', onchange: function () { ed[k] = e.value; }}); e.value = ed[k] != null ? ed[k] : (base[k] || '');
      return h('label', {class: 'field'}, k + (ed[k] != null ? ' · editado' : base[k] ? ' · das Teses' : ''), e);
    }));
    var kv = C.clone(doc.kpi || {}), lk = kpis(t);
    var kform = h('table', {class: 't'}, h('thead', null, h('tr', null, h('th', null, 'Indicador do setor'), h('th', null, 'Valor atual'), h('th', null, 'Fonte e data'))), h('tbody', null, lk.map(function (k) { var o = kv[k] || {}; var v = h('input', {class: 'inp', value: o.v || '', placeholder: 'Não disponível', onchange: function () { kv[k] = Object.assign(kv[k] || {}, {v: v.value}); }}), f = h('input', {class: 'inp', value: o.f || '', placeholder: 'ex.: release 3T26', onchange: function () { kv[k] = Object.assign(kv[k] || {}, {f: f.value}); }}); return h('tr', null, h('td', null, k), h('td', null, v), h('td', null, f)); })));
    box.appendChild(A.sec('Acompanhamento da empresa', {hint: 'Campos vazios ficam “Não disponível”. Ao salvar, a versão anterior da ficha fica guardada.', right: h('button', {class: 'btn pri', onclick: async function () { var novo = {campos: ed, kpi: kv, resultados: doc.resultados || [], hist: (doc.hist || []).concat(doc.campos ? [{quando: doc.atualizado || STORE.now(), campos: doc.campos, kpi: doc.kpi}] : []).slice(-20)}; await STORE.put('teses', t, novo); await STORE.audit('ficha atualizada', t); A.toast('Ficha de ' + t + ' salva.'); A.render(); }}, 'Salvar ficha')}, [form, h('h3', null, 'Indicadores do setor (' + (a.setor || a.tipo) + ')'), kform]));
    box.appendChild(resultado(t, doc, lk));
    return box;
  }
  function resultado(t, doc, lk) {
    var res = doc.resultados || [], ult = res[res.length - 1];
    var per = h('input', {class: 'inp', placeholder: 'Período (ex.: 3T26)'}), vals = {};
    var tb = h('table', {class: 't'}, h('thead', null, h('tr', null, h('th', null, 'Indicador'), h('th', null, 'Anterior'), h('th', null, 'Novo'))), h('tbody', null, lk.map(function (k) { var prev = ult ? (ult.kpi || {})[k] : (doc.kpi && doc.kpi[k] ? doc.kpi[k].v : null); var e = h('input', {class: 'inp', onchange: function () { vals[k] = e.value; }}); return h('tr', null, h('td', null, k), h('td', null, prev || '—'), h('td', null, e)); })));
    var perguntas = [['valor', 'Mudou o valor intrínseco?'], ['prob', 'Mudou a probabilidade dos cenários?'], ['risco', 'Mudou o risco da tese?'], ['percepcao', 'Ou mudou só a percepção do mercado?']];
    var resp = {};
    var qs = perguntas.map(function (q) { var s = h('select', {class: 'inp', onchange: function () { resp[q[0]] = s.value; }}, ['—', 'Sim', 'Não', 'Incerto'].map(function (o) { return h('option', null, o); })); return h('label', {class: 'field'}, q[1], s); });
    var just = h('textarea', {class: 'inp w', placeholder: 'Por quê? Se a informação não justifica mudar a carteira, explique.'});
    var iaBox = h('div');
    var btnIA = STORE.sample ? h('button', {class: 'btn', onclick: async function () {
      iaBox.replaceChildren(h('p', {class: 'muted'}, 'Pedindo leitura à IA…'));
      var prompt = 'Você é analista de ações de uma consultoria brasileira. Com base só nos dados abaixo, responda em JSON {"valor":"sim|não|incerto + por quê","probabilidades":"…","risco":"…","percepcao":"…","conclusao":"…","mudar_carteira":false,"porque":"…"}. Não invente números; não cite casas de research.\n\nEMPRESA: ' + t + ' · ' + C.ATV[t].nome + '\nTESE: ' + (C.ATV[t].tese || '') + '\nFICHA: ' + JSON.stringify(doc.campos || {}) + '\nINDICADORES ANTERIORES: ' + JSON.stringify(ult ? ult.kpi : doc.kpi || {}) + '\nNOVOS (' + per.value + '): ' + JSON.stringify(vals) + '\nNOTA DO ANALISTA: ' + just.value;
      try { var r = await STORE.sample.json(prompt, {modelTier: 'complex', cache: false}); iaBox.replaceChildren(h('div', {class: 'alert'}, h('span', {class: 'badge-ia'}, 'parecer gerado por IA'), h('p', null, h('b', null, 'Valor intrínseco: '), String(r.valor || '')), h('p', null, h('b', null, 'Probabilidades: '), String(r.probabilidades || '')), h('p', null, h('b', null, 'Risco: '), String(r.risco || '')), h('p', null, h('b', null, 'Percepção: '), String(r.percepcao || '')), h('p', null, h('b', null, 'Conclusão: '), String(r.conclusao || '') + (r.mudar_carteira ? ' · sugere rever a posição' : ' · não sugere mudar a carteira') + ' — ' + String(r.porque || '')))); iaBox.dataset.ia = JSON.stringify(r); }
      catch (e) { iaBox.replaceChildren(h('p', {class: 'down'}, 'Não consegui a leitura da IA agora.')); }
    }}, 'Pedir leitura à IA') : h('span', {class: 'muted'}, 'Leitura por IA disponível no claude.ai.');
    return A.sec('Novo resultado trimestral', {hint: 'Compare com as premissas anteriores e diga o que mudou de verdade.'}, [per, tb, h('div', {class: 'form', style: 'margin-top:8px'}, qs), just, h('div', {class: 'row', style: 'margin-top:8px'}, btnIA, h('button', {class: 'btn pri', onclick: async function () {
      if (!per.value.trim()) { A.toast('Informe o período.'); return; }
      var reg = {periodo: per.value.trim(), kpi: vals, respostas: resp, justificativa: just.value, ia: iaBox.dataset.ia ? JSON.parse(iaBox.dataset.ia) : null, quando: STORE.now()};
      var d2 = STORE.get('teses', t) || {campos: {}, kpi: {}, resultados: []}; d2 = C.clone(d2); d2.resultados = (d2.resultados || []).concat([reg]);
      await STORE.put('teses', t, d2);
      await STORE.put('decisoes', STORE.newId('dec'), {tipo: 'resultado', ticker: t, status: 'registrada', criado: STORE.now(), data: new Date().toISOString().slice(0, 10), titulo: t + ' · resultado ' + reg.periodo, tese: C.ATV[t].tese, evidencia: JSON.stringify(vals), contra: '', nota: just.value, respostas: resp});
      await STORE.audit('resultado registrado', t + ' ' + reg.periodo); A.toast('Resultado registrado no diário.'); A.render();
    }}, 'Registrar resultado')), iaBox,
    res.length ? A.more('Resultados anteriores (' + res.length + ')', res.slice().reverse().map(function (r) { return h('div', {style: 'border-bottom:1px solid var(--line);padding:6px 0'}, h('b', null, r.periodo), ' · ' + A.dataBR(r.quando) + ' · valor: ' + (r.respostas.valor || '—') + ', cenários: ' + (r.respostas.prob || '—') + ', risco: ' + (r.respostas.risco || '—') + ', percepção: ' + (r.respostas.percepcao || '—'), r.justificativa ? h('div', {class: 'muted'}, r.justificativa) : null); })) : null]);
  }

  /* ---------- decisões e diário ---------- */
  function decisoes() {
    var st = A.decState = A.decState || {q: '', cart: '', tipo: '', de: '', ate: '', fator: ''};
    var all = STORE.list('decisoes').sort(function (a, b) { return (a.data || a.criado) < (b.data || b.criado) ? 1 : -1; });
    var f = all.filter(function (d) {
      if (st.cart && d.cart !== st.cart) return false; if (st.tipo && d.tipo !== st.tipo) return false;
      if (st.de && (d.data || '') < st.de) return false; if (st.ate && (d.data || '') > st.ate) return false;
      if (st.fator && !(d.fatores || []).some(function (x) { return x === st.fator; })) return false;
      if (st.q && JSON.stringify(d).toLowerCase().indexOf(st.q.toLowerCase()) < 0) return false; return true;
    });
    var wrap = h('div');
    var q = h('input', {class: 'inp', placeholder: 'Empresa ou palavra', value: st.q, onchange: function () { st.q = q.value; A.render(); }});
    var cs = h('select', {class: 'inp', onchange: function () { st.cart = cs.value; A.render(); }}, h('option', {value: ''}, 'Todas as carteiras'), C.CARTS.map(function (m) { return h('option', {value: m.id, selected: st.cart === m.id || null}, m.rotulo); }));
    var ts = h('select', {class: 'inp', onchange: function () { st.tipo = ts.value; A.render(); }}, ['', 'rebalanceamento', 'evento macro', 'resultado', 'tese'].map(function (x) { return h('option', {value: x, selected: st.tipo === x || null}, x || 'Todos os tipos'); }));
    var fs = h('select', {class: 'inp', onchange: function () { st.fator = fs.value; A.render(); }}, h('option', {value: ''}, 'Todos os fatores'), C.FATORES.map(function (x) { return h('option', {value: x.k, selected: st.fator === x.k || null}, x.n); }));
    var de = h('input', {class: 'inp', type: 'date', value: st.de, onchange: function () { st.de = de.value; A.render(); }}), ate = h('input', {class: 'inp', type: 'date', value: st.ate, onchange: function () { st.ate = ate.value; A.render(); }});
    wrap.appendChild(A.sec('Diário de decisões', {hint: 'Toda decisão aprovada ou rejeitada no Laboratório, na Sala ou nas fichas cai aqui. Decisões geradas por IA ficam marcadas e só mudam a carteira com aprovação humana.', right: [h('button', {class: 'btn', onclick: novaDecisao}, 'Nova decisão'), h('button', {class: 'btn', onclick: function () { A.download('decisoes.json', JSON.stringify(f, null, 1), 'application/json'); }}, 'Exportar')]}, h('div', {class: 'row'}, q, cs, ts, fs, 'de ', de, ' até ', ate)));
    wrap.appendChild(A.sec('Registros (' + f.length + ')', {flush: true}, A.table([
      {k: 'data', t: 'Data', f: function (d) { return A.dataBR(d.data || d.criado); }}, {k: 'tipo', t: 'Tipo'}, {k: 'cart', t: 'Carteira', f: function (d) { return d.cart ? (C.MAND[d.cart] || {}).rotulo : (d.ticker || '—'); }},
      {k: 'titulo', t: 'Decisão', f: function (d) { return h('span', null, d.titulo || d.tese || '—', d.origem_ia ? ' ' : null, d.origem_ia ? h('span', {class: 'badge-ia'}, 'IA') : null); }},
      {k: 'status', t: 'Status', f: function (d) { return A.chip(d.status, d.status === 'aprovada' ? 'o-obs' : d.status === 'rejeitada' ? 'g-critica' : ''); }},
      {k: 'responsavel', t: 'Responsável'}, {k: 'pos', t: 'Pós-avaliação', f: function (d) { return d.pos_avaliacao ? 'feita' : (d.status === 'aprovada' ? A.chip('pendente', 'g-media') : '—'); }, s: function (d) { return !!d.pos_avaliacao; }}
    ], f, {onRow: function (d) { detalhe(d); }, empty: 'Nenhuma decisão registrada ainda.'})));
    return wrap;
  }
  function novaDecisao() {
    var f = {}, campos = [['titulo', 'Título'], ['tese', 'Tese'], ['evidencia', 'Evidência'], ['contra', 'Principal argumento contrário'], ['alternativas', 'Alternativas consideradas'], ['impacto', 'Impacto quantitativo'], ['riscos', 'Riscos'], ['revisao', 'Condições de revisão']];
    var cart = h('select', {class: 'inp w'}, h('option', {value: ''}, '—'), C.CARTS.map(function (m) { return h('option', {value: m.id}, m.rotulo); }));
    var tipo = h('select', {class: 'inp w'}, ['tese', 'rebalanceamento', 'evento macro', 'resultado'].map(function (x) { return h('option', null, x); }));
    var resp = h('input', {class: 'inp w'}), data = h('input', {class: 'inp w', type: 'date'}), st = h('select', {class: 'inp w'}, ['proposta', 'aprovada', 'rejeitada'].map(function (x) { return h('option', null, x); }));
    var body = h('div', null, h('div', {class: 'form'}, h('label', {class: 'field'}, 'Tipo', tipo), h('label', {class: 'field'}, 'Carteira', cart), h('label', {class: 'field'}, 'Responsável *', resp), h('label', {class: 'field'}, 'Data *', data), h('label', {class: 'field'}, 'Status', st)),
      campos.map(function (c) { var e = h('textarea', {class: 'inp w', style: 'min-height:54px'}); f[c[0]] = e; return h('label', {class: 'field'}, c[1], e); }),
      h('p', {class: 'hint'}, 'Mudança de peso da carteira oficial só por proposta aprovada no Laboratório.'),
      h('button', {class: 'btn pri', onclick: async function () { if (!resp.value.trim() || !data.value) { A.toast('Responsável e data são obrigatórios.'); return; } var o = {tipo: tipo.value, cart: cart.value || null, responsavel: resp.value, data: data.value, status: st.value, criado: STORE.now()}; Object.keys(f).forEach(function (k) { o[k] = f[k].value; }); await STORE.put('decisoes', STORE.newId('dec'), o); await STORE.audit('decisão registrada', o.titulo); d.remove(); A.render(); }}, 'Registrar'));
    var d = A.drawer('Nova decisão', body);
  }
  function detalhe(dc) {
    var pa = dc.pos_avaliacao || {};
    var campos = [['tese', 'Tese'], ['evidencia', 'Evidência'], ['contra', 'Principal argumento contrário'], ['alternativas', 'Alternativas'], ['impacto', 'Impacto quantitativo'], ['riscos', 'Riscos'], ['revisao', 'Condições de revisão'], ['nota', 'Nota']];
    var real = efeitoRealizado(dc);
    var aconteceu = h('textarea', {class: 'inp w'}), correta = h('select', {class: 'inp'}, ['—', 'Sim, pelas informações da época', 'Não', 'Parcialmente'].map(function (o) { return h('option', {selected: pa.correta === o || null}, o); })), origem = h('select', {class: 'inp'}, ['—', 'Habilidade (tese se confirmou pelos motivos previstos)', 'Exposição a fatores (mercado ou juros explicam)', 'Acaso', 'Indeterminado'].map(function (o) { return h('option', {selected: pa.origem === o || null}, o); })), apr = h('textarea', {class: 'inp w'});
    aconteceu.value = pa.aconteceu || ''; apr.value = pa.aprendizado || '';
    var body = h('div', null,
      h('p', null, A.chip(dc.tipo), ' ', A.chip(dc.status), ' · ', A.dataBR(dc.data), ' · ', dc.responsavel || '—', dc.origem_ia ? h('span', {class: 'badge-ia', style: 'margin-left:6px'}, 'parecer de IA na origem') : null),
      h('dl', {class: 'kv'}, campos.filter(function (c) { return dc[c[0]]; }).map(function (c) { return [h('dt', null, c[1]), h('dd', {style: 'white-space:pre-wrap'}, dc[c[0]])]; })),
      dc.pesos ? A.table([{k: 't', t: 'Ativo'}, {k: 'a', t: 'Antes', r: 1, f: function (r) { return A.pct(r.a, 2); }}, {k: 'b', t: 'Depois', r: 1, f: function (r) { return A.pct(r.b, 2); }}], dc.pesos) : null,
      h('h3', null, 'O que aconteceu depois'), real,
      h('h3', null, 'Pós-avaliação'), h('p', {class: 'hint'}, 'O retorno posterior não é o único critério: uma boa decisão pode dar errado por acaso e uma ruim pode dar certo.'),
      h('label', {class: 'field'}, 'O que aconteceu', aconteceu), h('label', {class: 'field'}, 'A decisão foi correta pelas informações da época?', correta), h('label', {class: 'field'}, 'O resultado veio de', origem), h('label', {class: 'field'}, 'Aprendizado para o processo', apr),
      h('button', {class: 'btn pri', style: 'margin-top:10px', onclick: async function () { var o = C.clone(dc); o.pos_avaliacao = {aconteceu: aconteceu.value, correta: correta.value, origem: origem.value, aprendizado: apr.value, quando: STORE.now()}; await STORE.put('decisoes', dc.id, o); await STORE.audit('pós-avaliação', dc.titulo || dc.id); d.remove(); A.render(); }}, 'Salvar pós-avaliação'));
    var d = A.drawer(dc.titulo || 'Decisão', body);
  }
  // Efeito realizado de uma mudança de pesos = Σ Δwᵢ × rᵢ (em reais) desde a data da decisão, com as séries importadas.
  function efeitoRealizado(dc) {
    if (!dc.pesos || !dc.data) return h('p', {class: 'muted'}, 'Sem mudança de pesos registrada para medir.');
    var hoje = new Date().toISOString().slice(0, 10), tot = 0, cob = 0, falt = [], itens = [];
    dc.pesos.forEach(function (r) {
      var dw = r.b - r.a; if (Math.abs(dw) < 1e-9) return;
      var sd = A.serieDe(r.t); if (!sd) { falt.push(r.t); return; }
      var c = Q.cumReturn(A.SER[sd.id].pts, dc.data, hoje); if (!c.ok) { falt.push(r.t); return; }
      var x = c.r; if (C.ATV[r.t] && C.ATV[r.t].moeda === 'USD') { var fx = A.SER.USDBRL ? Q.cumReturn(A.SER.USDBRL.pts, dc.data, hoje) : null; if (!fx || !fx.ok) { falt.push(r.t); return; } x = (1 + x) * (1 + fx.r) - 1; }
      tot += dw * x; cob += Math.abs(dw); itens.push(r.t + ' ' + A.pp(dw * x));
    });
    // toda perna da troca precisa de série: sem o lado que financiou, o número seria só o retorno da compra
    if (falt.length) return A.na('sem série para ' + falt.join(', ') + ' desde ' + A.dataBR(dc.data) + '; o efeito da troca precisa das duas pontas', 'preços dessas posições');
    if (!cob) return A.na('sem mudanças de peso para medir');
    return h('p', null, 'Efeito das mudanças de peso desde ' + A.dataBR(dc.data) + ': ', h('b', {class: A.cls(tot)}, A.pp(tot)), ' (Σ Δw × retorno em reais: ' + itens.join('; ') + ').');
  }

  /* ---------- performance ---------- */
  function perf() {
    var v = A.versao(), st = A.perfState = A.perfState || {ini: '', fim: ''}, wrap = h('div');
    var ult = Object.keys(A.SER).map(function (k) { var p = A.SER[k].pts; return p[p.length - 1][0]; }).sort().pop();
    if (!st.fim && ult) { st.fim = ult; var d0 = new Date(ult); d0.setFullYear(d0.getFullYear() - 1); st.ini = d0.toISOString().slice(0, 10); }
    var ini = h('input', {class: 'inp', type: 'date', value: st.ini, onchange: function () { st.ini = ini.value; A.render(); }}), fim = h('input', {class: 'inp', type: 'date', value: st.fim, onchange: function () { st.fim = fim.value; A.render(); }});
    wrap.appendChild(A.sec('Período', {mtd: 'perf', hint: 'Pesos da versão selecionada no início do período, mantidos (buy-and-hold). Retornos das séries importadas, em reais.'}, h('div', {class: 'row'}, ini, ' → ', fim, h('span', {class: 'muted'}, v.rotulo))));
    if (!Object.keys(A.SER).length) { wrap.appendChild(A.sec('Atribuição de performance', null, A.na('nenhuma série importada', 'preços ajustados dos ativos e USDBRL (Dados)'))); wrap.appendChild(twrMwr()); return wrap; }
    var val = A.valida(v);
    if (val.status === 'invalida') wrap.appendChild(h('div', {class: 'alert bad'}, 'Versão inválida (' + A.pct(val.total) + '): as contribuições abaixo são das posições como estão, e o total não representa uma carteira de 100%.'));
    var itens = [], tot = 0, cob = 0, fora = [];
    (v.pos || []).forEach(function (x) {
      if (!(x.w > 0)) return; var a = C.ATV[x.t];
      if (!a || a.status === 'placeholder') { fora.push({t: x.t, w: x.w, m: 'placeholder'}); return; }
      var sd = A.serieDe(x.t); if (!sd) { fora.push({t: x.t, w: x.w, m: 'sem série'}); return; }
      var c = Q.cumReturn(A.SER[sd.id].pts, st.ini, st.fim); if (!c.ok) { fora.push({t: x.t, w: x.w, m: c.reason || 'não cobre o período'}); return; }
      var it = {t: x.t, p: x.p, w: x.w, local: c.r, fx: 0, cross: 0, r: c.r, proxy: sd.proxy};
      if (a.moeda === 'USD') { var fx = A.SER.USDBRL ? Q.cumReturn(A.SER.USDBRL.pts, st.ini, st.fim) : null; if (!fx || !fx.ok) { fora.push({t: x.t, w: x.w, m: 'sem dólar no período'}); return; } var dc = Q.fxDecompose(c.r, fx.r); it.fx = dc.fx; it.cross = dc.cross; it.r = dc.total; }
      var pr = A.SER[x.t + '.P']; if (pr) { var cp = Q.cumReturn(pr.pts, st.ini, st.fim); if (cp.ok) it.prov = c.r - cp.r; }
      it.ctb = x.w * it.r; tot += it.ctb; cob += x.w; itens.push(it);
    });
    wrap.appendChild(A.sec('Contribuição por ativo', {flush: true, hint: 'Retorno das posições com série: ' + A.pp(tot) + ' (soma das contribuições, conciliada) sobre ' + A.pct(cob, 1) + ' da carteira. ' + (fora.length ? 'Fora: ' + resumoFora(fora) + '. ' : '') + 'Proventos aparecem quando há a série só de preço com sufixo .P (ex.: ITSA4.P).'}, A.table([
      {k: 't', t: 'Ativo', f: function (x) { return h('span', null, x.t, x.proxy ? ' ' : null, x.proxy ? A.chip('proxy', 'g-media') : null); }}, {k: 'p', t: 'Pilar'}, {k: 'w', t: 'Peso', r: 1, f: function (x) { return A.pct(x.w, 2); }},
      {k: 'local', t: 'Retorno local', r: 1, f: function (x) { return A.spct(x.local); }}, {k: 'fx', t: 'Câmbio', r: 1, f: function (x) { return x.fx ? A.spct(x.fx) : '—'; }}, {k: 'cross', t: 'Cruzado', r: 1, f: function (x) { return x.cross ? A.spct(x.cross, 2) : '—'; }},
      {k: 'prov', t: 'Proventos', r: 1, f: function (x) { return x.prov == null ? '—' : A.spct(x.prov); }},
      {k: 'r', t: 'Em reais', r: 1, f: function (x) { return h('span', {class: A.cls(x.r)}, A.spct(x.r)); }}, {k: 'ctb', t: 'Contribuição', r: 1, f: function (x) { return h('span', {class: A.cls(x.ctb)}, A.pp(x.ctb)); }}
    ], itens, {sort: 'ctb', foot: h('tr', null, h('td', {colspan: 8}, 'Total conciliado'), h('td', {class: 'r num'}, A.pp(tot)))})));
    // Brinson-Fachler por pilar contra a base 30/10
    var b = C.historica('base-30-10', S.cart), wp = {}, wb = {}, rpN = {}, rbN = {};
    var ret = {}; itens.forEach(function (x) { ret[x.t] = x.r; });
    (v.pos || []).forEach(function (x) { if (ret[x.t] != null) { wp[x.p] = (wp[x.p] || 0) + x.w; rpN[x.p] = (rpN[x.p] || 0) + x.w * ret[x.t]; } });
    var bFora = [];
    (b ? b.pos : []).forEach(function (x) { if (!(x.w > 0)) return; var r = ret[x.t]; if (r == null) { var sd = A.serieDe(x.t); if (sd) { var c = Q.cumReturn(A.SER[sd.id].pts, st.ini, st.fim); if (c.ok) { r = c.r; if (C.ATV[x.t].moeda === 'USD') { var fx = A.SER.USDBRL ? Q.cumReturn(A.SER.USDBRL.pts, st.ini, st.fim) : null; r = fx && fx.ok ? (1 + r) * (1 + fx.r) - 1 : null; } } } } if (r == null) { bFora.push(x.t); return; } wb[x.p] = (wb[x.p] || 0) + x.w; rbN[x.p] = (rbN[x.p] || 0) + x.w * r; });
    var rp = {}, rb = {}; Object.keys(wp).forEach(function (g) { rp[g] = rpN[g] / wp[g]; }); Object.keys(wb).forEach(function (g) { rb[g] = rbN[g] / wb[g]; });
    Object.keys(wp).forEach(function (g) { if (rb[g] == null) rb[g] = rp[g]; });
    var sp = C.sum(Object.keys(wp), function (g) { return wp[g]; }), sb = C.sum(Object.keys(wb), function (g) { return wb[g]; });
    if (sp > 0 && sb > 0) {
      // reescala os pesos cobertos para 100% dentro de cada lado só para a decomposição (explicitado na nota)
      var wpN = {}, wbN = {}; Object.keys(wp).forEach(function (g) { wpN[g] = wp[g] / sp; }); Object.keys(wb).forEach(function (g) { wbN[g] = wb[g] / sb; });
      var br = Q.brinson({wp: wpN, wb: wbN, rp: rp, rb: rb});
      if (br && br.ok !== false) {
        var gs = Object.keys(Object.assign({}, wpN, wbN)).sort(function (a, c) { return +a.slice(1) - +c.slice(1); });
        wrap.appendChild(A.sec('Alocação × seleção por pilar (Brinson-Fachler) contra a base 30/10', {mtd: 'perf', flush: true, hint: 'Só posições com série nos dois lados (carteira ' + A.pct(sp, 0) + ', base ' + A.pct(sb, 0) + '), reescaladas para 100% em cada lado apenas para esta decomposição. Pilar sem posição na base usa o próprio retorno como referência. Soma dos efeitos = Rp − Rb; resíduo ' + A.num(br.residual * 1e4, 3) + ' bps.' + (bFora.length ? ' Base sem série: ' + bFora.join(', ') + '.' : '')}, A.table([
          {k: 'g', t: 'Pilar', s: function (g) { return +g.slice(1); }, f: function (g) { return g + ' ' + C.PIL[g].nome; }},
          {k: 'wp', t: 'Peso carteira', r: 1, f: function (g) { return A.pct(wpN[g] || 0); }}, {k: 'wb', t: 'Peso base', r: 1, f: function (g) { return A.pct(wbN[g] || 0); }},
          {k: 'a', t: 'Alocação', r: 1, f: function (g) { return A.pp(br.alloc[g] || 0); }}, {k: 's', t: 'Seleção', r: 1, f: function (g) { return A.pp(br.select[g] || 0); }}, {k: 'i', t: 'Interação', r: 1, f: function (g) { return A.pp(br.inter[g] || 0); }}
        ], gs, {foot: h('tr', null, h('td', null, 'Total'), h('td', {class: 'r num'}, A.spct(br.Rp)), h('td', {class: 'r num'}, A.spct(br.Rb)), h('td', {class: 'r num'}, A.pp(br.totals.alloc)), h('td', {class: 'r num'}, A.pp(br.totals.select)), h('td', {class: 'r num'}, A.pp(br.totals.inter)))})));
      }
    }
    wrap.appendChild(twrMwr());
    wrap.appendChild(A.sec('Custos e impostos', null, A.na('não informados', 'custos de corretagem, taxas e impostos por período')));
    return wrap;
  }
  function resumoFora(fora) { var ph = fora.filter(function (x) { return x.m === 'placeholder'; }), out = fora.filter(function (x) { return x.m !== 'placeholder'; }).map(function (x) { return x.t + ' (' + x.m + ')'; }); if (ph.length) out.unshift(ph.length + ' placeholders (' + A.pct(C.sum(ph, function (x) { return x.w; }), 0) + ')'); return out.slice(0, 8).join(', ') + (out.length > 8 ? '…' : ''); }
  function twrMwr() {
    var f = A.TAB.fluxos;
    if (!f || !f.rows || f.rows.length < 2) return A.sec('TWR e MWR', null, A.na('patrimônio e fluxos não importados', 'Dados → Patrimônio e fluxos'));
    var rows = f.rows, vals = rows.map(function (r) { return r.valor; }), fl = rows.map(function (r) { return r.fluxo; });
    var i0 = vals.findIndex(function (x) { return x > 0; });
    if (i0 < 0 || rows.length - i0 < 2) return A.sec('TWR e MWR', null, A.na('patrimônio zerado ou negativo em todas as datas'));
    rows = rows.slice(i0); vals = vals.slice(i0); fl = fl.slice(i0);
    var t = Q.twr(vals, fl), m = Q.mwr(rows.map(function (r) { return r.data; }), vals, fl);
    if (!t || t.total == null) return A.sec('TWR e MWR', null, A.na('há data com patrimônio zero ou negativo no meio da série; o TWR não pode ser encadeado'));
    var anos = (Date.parse(rows[rows.length - 1].data) - Date.parse(rows[0].data)) / (365.25 * 864e5);
    return A.sec('TWR e MWR', {mtd: 'perf'}, h('dl', {class: 'kv'}, h('dt', null, 'Período'), h('dd', null, A.dataBR(rows[0].data) + ' a ' + A.dataBR(rows[rows.length - 1].data) + ' (' + rows.length + ' datas)'),
      h('dt', null, 'TWR acumulado'), h('dd', {class: 'num'}, A.spct(t.total, 2) + (anos > 1 ? ' · ' + A.spct(Math.pow(1 + t.total, 1 / anos) - 1, 2) + ' a.a.' : '')),
      h('dt', null, 'MWR (TIR) ao ano'), h('dd', {class: 'num'}, m == null ? A.na('sem troca de sinal nos fluxos') : A.spct(m, 2)),
      h('dt', null, 'Leitura'), h('dd', null, 'TWR mede a gestão sem o efeito dos aportes e resgates; MWR mede a experiência do investidor, que depende de quando ele aportou.')));
  }

  /* ---------- textos ---------- */
  function textos() {
    var wrap = h('div');
    wrap.appendChild(A.sec('Textos autorais', {hint: 'Reproduzidos exatamente como foram escritos.'}, (C.D.textos || []).map(function (t) { return A.more(t.titulo + ' · ' + t.bloco, h('div', {style: 'white-space:pre-wrap'}, t.texto)); })));
    wrap.appendChild(A.sec('Contribuições dos consultores', {hint: 'Respostas ao questionário do Comitê, sem edição.'}, (C.D.falas || []).map(function (f) { return A.more(f.autor + ' · ' + f.bloco + (f.slide ? ' · slide ' + f.slide : ''), h('div', {style: 'white-space:pre-wrap'}, f.texto)); })));
    return wrap;
  }

  /* ---------- pauta ---------- */
  function pauta() {
    var cfg = C.clone(STORE.get('config', 'estudo') || {});
    var rows = (C.D.estudo || []).map(function (e) { return Object.assign({}, e, {st: (cfg[e.id] || {}).status || 'aberto', nota: (cfg[e.id] || {}).nota || ''}); });
    var wrap = h('div');
    wrap.appendChild(A.sec('Pauta de estudo do Comitê 05/11', {flush: true, hint: 'Itens do “Para estudar”. Marque o andamento; a nota fica registrada com data.', right: h('button', {class: 'btn pri', onclick: async function () { await STORE.put('config', 'estudo', cfg); await STORE.audit('pauta atualizada', ''); A.toast('Pauta salva.'); A.render(); }}, 'Salvar pauta')}, A.table([
      {k: 'id', t: '#'}, {k: 'tipo', t: 'Tipo'}, {k: 'bloco', t: 'Bloco'}, {k: 'prioridade', t: 'Prioridade', f: function (e) { return A.chip(e.prioridade, e.prioridade === 'Alta' ? 'g-alta' : e.prioridade === 'Média' ? 'g-media' : ''); }},
      {k: 'titulo', t: 'Item', f: function (e) { return h('div', null, h('b', null, e.titulo), h('div', {class: 'muted', style: 'font-size:.84rem'}, e.detalhe), h('div', {style: 'font-size:.84rem'}, h('b', null, 'Ação: '), e.acao)); }},
      {k: 'st', t: 'Andamento', f: function (e) { var s = h('select', {class: 'inp', onchange: function () { cfg[e.id] = Object.assign(cfg[e.id] || {}, {status: s.value, quando: STORE.now()}); }}, ['aberto', 'em andamento', 'resolvido'].map(function (o) { return h('option', {selected: e.st === o || null}, o); })); var n = h('input', {class: 'inp', placeholder: 'nota', value: e.nota, onchange: function () { cfg[e.id] = Object.assign(cfg[e.id] || {}, {nota: n.value, quando: STORE.now()}); }}); return h('div', null, s, n); }}
    ], rows, {sort: 'ordem', dir: 1})));
    return wrap;
  }

  /* ---------- histórico, auditoria e testes ---------- */
  function historico() {
    var wrap = h('div');
    var aud = STORE.list('auditoria').sort(function (a, b) { return a.quando < b.quando ? 1 : -1; });
    wrap.appendChild(A.sec('Testes do modelo', {hint: 'Roda neste navegador os testes automáticos dos cálculos (validação, normalização, contribuições, risco, câmbio, duration, probabilidades, governança).'}, testes()));
    var vers = STORE.list('versoes').filter(function (v) { return v.pos; }).sort(function (a, b) { return a.atualizado < b.atualizado ? 1 : -1; });
    wrap.appendChild(A.sec('Versões arquivadas de carteiras', {flush: true, hint: 'Toda aprovação guarda a composição anterior. Reverter cria uma proposta; nada sobrescreve a aprovada sem novo registro.'}, A.table([
      {k: 'cart', t: 'Carteira', f: function (v) { return (C.MAND[v.cart] || {}).rotulo; }}, {k: 'rotulo', t: 'Versão'}, {k: 'vigente_ate', t: 'Vigente até', f: function (v) { return A.dataBR(v.vigente_ate); }},
      {k: 'x', t: '', s: false, f: function (v) { return h('button', {class: 'btn sm', onclick: async function () { var p = await STORE.reverterComoProposta(v.id); S.cart = v.cart; S.ver = 'prop:' + p.id; A.go('cons', 'editor'); }}, 'Criar proposta de reversão'); }}
    ], vers, {empty: 'Nenhuma aprovação registrada ainda: vale a versão do simulador do Comitê 05/11.'}), STORE.list('aprovadas').length ? A.more('Aprovações vigentes (' + STORE.list('aprovadas').length + ')', STORE.list('aprovadas').map(function (a) { return h('div', {class: 'row', style: 'padding:4px 0'}, h('b', null, (C.MAND[a.cart] || {}).rotulo), ' · ' + a.rotulo + ' · ' + a.responsavel, h('button', {class: 'btn sm danger', onclick: async function () { if (!confirm('Voltar ' + a.cart + ' para a versão original do simulador? A atual fica arquivada.')) return; await STORE.voltarAoOriginal(a.cart, {}); A.render(); }}, 'Voltar ao original')); })) : null));
    var vp = STORE.list('versoes').filter(function (v) { return v.tipo === 'premissas'; }).sort(function (a, b) { return a.quando < b.quando ? 1 : -1; });
    wrap.appendChild(A.sec('Versões de premissas', {flush: true}, A.table([{k: 'quando', t: 'Substituída em', f: function (v) { return new Date(v.quando).toLocaleString('pt-BR'); }}, {k: 'nota', t: 'Mudança que a substituiu'}, {k: 'x', t: '', s: false, f: function (v) { return h('button', {class: 'btn sm', onclick: async function () { if (!confirm('Restaurar estas premissas? As atuais ficam arquivadas.')) return; await A.salvarPrem(v.conteudo || {}, 'restauração de versão'); A.render(); }}, 'Restaurar'); }}], vp, {empty: 'Premissas ainda nas hipóteses iniciais.'})));
    var nSer = Object.keys(A.SER);
    wrap.appendChild(A.sec('Fontes', null, h('ul', null,
      h('li', null, 'Carteiras, pilares, bandas e base 30/10: ' + C.D.meta.fonte + '.'), h('li', null, 'Teses, cotações e preços teto: ' + C.D.meta.teses + '.'),
      h('li', null, 'Retornos de 12 meses e proventos: deck do Comitê (fonte por ativo na ficha).'), h('li', null, 'Cenário de referência: indicadores com data e fonte na Mesa.'),
      h('li', null, 'Sensibilidades iniciais: hipóteses geradas por IA, editáveis (Risco → Premissas).'),
      h('li', null, 'Séries importadas: ' + (nSer.length ? nSer.length + ' (' + nSer.slice(0, 12).join(', ') + (nSer.length > 12 ? '…' : '') + ')' : 'nenhuma') + '.'))));
    wrap.appendChild(A.sec('Limitações do modelo', null, h('ul', null, [
      'Motor de choques linear de 1ª ordem; sem convexidade a menos que cadastrada.', 'Sensibilidades iniciais não são estimadas; até serem revistas, os cenários refletem hipóteses.',
      'Volatilidade e correlação históricas mudam no estresse; ativos marcados na curva ou ilíquidos parecem menos arriscados.', 'VaR e ES históricos dependem da janela; com menos de 30 observações não são calculados.',
      'ETFs americanos usados como proxy de UCITS ignoram diferenças de domicílio, tributação e custo.', 'A otimização é sensível às estimativas: a faixa de sensibilidade mostra quanto.',
      'Séries e tabelas importadas ficam no navegador em que foram importadas.', 'A IA pode errar a leitura de um fato; por isso todo parecer exige aprovação humana para mudar a carteira.'
    ].map(function (x) { return h('li', null, x); }))));
    wrap.appendChild(A.sec('Auditoria (' + aud.length + ')', {flush: true}, A.table([{k: 'quando', t: 'Quando', f: function (a) { return new Date(a.quando).toLocaleString('pt-BR'); }}, {k: 'acao', t: 'Ação'}, {k: 'detalhe', t: 'Detalhe'}], aud.slice(0, 300), {search: 'Filtrar', empty: 'Sem registros ainda.'})));
    return wrap;
  }
  function testes() {
    var out = h('div');
    out.appendChild(h('button', {class: 'btn pri', onclick: function () {
      var res = TESTS.run(CORE, Q, CORE.D, APP);
      var ok = res.filter(function (r) { return r.ok; }).length;
      out.replaceChildren(h('p', null, h('b', {class: ok === res.length ? 'up' : 'down'}, ok + ' de ' + res.length + ' testes passaram'), ' · ' + new Date().toLocaleString('pt-BR')), h('ol', {class: 'tests'}, res.map(function (r) { return h('li', null, h('span', {class: r.ok ? 'up' : 'down'}, r.ok ? 'OK ' : 'FALHOU '), r.nome, r.det ? h('span', {class: 'muted'}, ' · ' + r.det) : null); })));
    }}, 'Rodar testes'));
    return out;
  }
})(APP, CORE);
