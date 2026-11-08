/* Risco e Cenários */
(function (A, C) {
  'use strict';
  var h = A.h, S = A.S;
  var FREQ = {D: 'diários', W: 'semanais', M: 'mensais'};

  // Séries de fatores (IDs que o usuário importa). Juros em nível (% a.a.) → variação em p.p.; preços → variação em %.
  A.FSER = {ibov: 'IBOV', usd: 'USDBRL', sp: 'SPX', em: 'EEM', brent: 'BRENT', btc: 'BTC', selic: 'SELIC', pre: 'DI', real: 'NTNB', ust2: 'UST2', ust10: 'UST10', spread: 'HYOAS'};
  var NIVEL = {selic: 1, pre: 1, real: 1, ust2: 1, ust10: 1, spread: 1};

  A.PRESETS = [
    {n: 'Selic a 16%', c: {selic: 2.25, pre: 1.5, real: 0.6, usd: 4, ibov: -8}},
    {n: 'Abertura da curva (+150 bps)', c: {pre: 1.5, real: 0.75, selic: 0.5, usd: 4, ibov: -8}},
    {n: 'Crise fiscal brasileira', c: {selic: 1, pre: 2, real: 1, usd: 12, ibov: -15}},
    {n: 'Desvalorização do real (+20%)', c: {usd: 20, pre: 1, real: 0.5, ibov: -8}},
    {n: 'Payroll forte', c: {ust2: 0.2, ust10: 0.25, usd: 2, sp: -3, em: -4, ibov: -2, spread: 0.2}},
    {n: 'Treasury 10 anos a 5,5%', c: {ust10: 0.66, ust2: 0.3, sp: -6, em: -5, usd: 3, spread: 0.4, ibov: -4}},
    {n: 'Recessão americana', c: {sp: -20, em: -18, ust10: -1, ust2: -1.5, spread: 3, usd: 8, ibov: -15, brent: -30, btc: -40}},
    {n: 'Estresse de crédito', c: {spread: 2.5, sp: -8, em: -10, ibov: -8, usd: 5}},
    {n: 'Queda brusca do Brent (−35%)', c: {brent: -35, ibov: -4, usd: 3, em: -3}},
    {n: 'Correção de tecnologia', c: {sp: -15, em: -8, btc: -25, ibov: -4}},
    {n: 'Desaceleração chinesa', c: {em: -12, brent: -15, ibov: -8, usd: 5}},
    {n: 'Corte de juros global', c: {selic: -0.5, pre: -0.75, real: -0.4, ust2: -0.4, ust10: -0.3, usd: -4, ibov: 6, sp: 3, em: 4}}
  ];
  A.HIST = [
    {id: 'gfc', n: 'Crise financeira global (Lehman)', ini: '2008-09-12', fim: '2009-03-09'},
    {id: 'covid', n: 'Covid-19', ini: '2020-02-19', fim: '2020-03-23'},
    {id: 'juros22', n: 'Choque de juros global de 2022', ini: '2022-01-03', fim: '2022-10-12'},
    {id: 'fiscal24', n: 'Estresse fiscal no Brasil (pacote de gastos)', ini: '2024-11-27', fim: '2024-12-18'},
    {id: 'real20', n: 'Desvalorização do real em 2020', ini: '2020-01-02', fim: '2020-05-13'},
    {id: 'brent14', n: 'Queda do petróleo 2014–2016', ini: '2014-06-19', fim: '2016-01-20'},
    {id: 'credito23', n: 'Estresse de crédito privado (caso Americanas)', ini: '2023-01-11', fim: '2023-03-31'},
    {id: 'tech22', n: 'Correção de tecnologia (Nasdaq)', ini: '2021-11-19', fim: '2022-12-28'},
    {id: 'china15', n: 'Desaceleração chinesa (Xangai)', ini: '2015-06-12', fim: '2015-08-26'}
  ];

  A.areas.risco = function () {
    var wrap = h('div');
    wrap.appendChild(A.subnav('risco', [['cenarios', 'Cenários e stress'], ['estat', 'Risco estatístico'], ['corr', 'Correlações'], ['fatores', 'Diversificação e fatores'], ['conc', 'Concentração'], ['prem', 'Premissas de sensibilidade']]));
    var s = S.sub.risco;
    wrap.appendChild(s === 'cenarios' ? cenarios() : s === 'estat' ? estat() : s === 'corr' ? correl() : s === 'fatores' ? fatores() : s === 'conc' ? concentracao() : premissas());
    return wrap;
  };

  /* ---------- cenários ---------- */
  function cenarios() {
    var v = A.versao(), P = A.prem(), ch = S.choques = S.choques || {}, idio = S.idio = S.idio || {};
    var wrap = h('div'), g = h('div', {class: 'grid2'}), L = h('div'), R = h('div'); g.append(L, R);
    // entrada
    var inputs = C.FATORES.map(function (f) {
      var e = h('input', {class: 'inp n', type: 'number', step: f.u === 'pp' ? '0.25' : '1', value: ch[f.k] || '', placeholder: '0', 'aria-label': f.n, onchange: function () { var x = Number(e.value); if (isFinite(x) && x) ch[f.k] = x; else delete ch[f.k]; S.cenEvento = null; A.render(); }});
      return h('label', {class: 'field'}, f.n, h('span', null, e, ' ', f.u === 'pp' ? 'p.p.' : '%'));
    });
    var pre = h('select', {class: 'inp', onchange: function () { var p = A.PRESETS[+pre.value]; if (p) { S.choques = Object.assign({}, p.c); S.idio = {}; S.cenEvento = null; A.render(); } }}, h('option', {value: ''}, 'Carregar cenário hipotético…'), A.PRESETS.map(function (p, i) { return h('option', {value: i}, p.n); }));
    var idRows = Object.keys(idio).map(function (t) { return h('div', {class: 'row'}, h('b', null, t), ' ' + A.snum(idio[t], 1) + '% ', h('button', {class: 'btn sm', onclick: function () { delete idio[t]; A.render(); }}, 'remover')); });
    var it = h('select', {class: 'inp'}, (v.pos || []).filter(function (x) { return x.w > 0 && C.ATV[x.t] && C.ATV[x.t].status !== 'placeholder'; }).map(function (x) { return h('option', {value: x.t}, x.t); }));
    var iv = h('input', {class: 'inp n', type: 'number', step: '5', placeholder: '−40'});
    var prop = propagacao(ch);
    L.appendChild(A.sec('Choques do cenário', {mtd: 'choques', hint: 'Juros em pontos percentuais (+1 = +100 bps). Preços em %. Os cenários prontos são hipóteses de co-movimento geradas por IA: revise cada choque antes de usar.', right: [pre, h('button', {class: 'btn', onclick: function () { S.choques = {}; S.idio = {}; S.cenEvento = null; A.render(); }}, 'Zerar')]}, [
      S.cenEvento ? h('div', {class: 'alert'}, 'Cenário carregado do evento da Sala de Gestão: “' + S.cenEvento + '”. Mudar qualquer choque desfaz o vínculo.') : null,
      h('div', {class: 'form'}, inputs),
      h('h3', null, 'Choque específico de empresa (resultado, evento)'),
      h('div', {class: 'row'}, it, iv, ' %', h('button', {class: 'btn', onclick: function () { var x = Number(iv.value); if (isFinite(x) && x) { idio[it.value] = x; A.render(); } }}, 'Adicionar')), idRows,
      prop
    ]));
    // resultado
    var r = C.choqueCarteira(v, ch, P.sens, idio), temCh = Object.keys(ch).length || Object.keys(idio).length;
    if (!temCh) { R.appendChild(A.sec('Resultado', null, h('p', {class: 'empty'}, 'Defina pelo menos um choque ou carregue um cenário.'))); wrap.appendChild(g); wrap.appendChild(historicos(v)); return wrap; }
    var soma = C.sum(Object.keys(r.porFator), function (k) { return r.porFator[k]; });
    R.appendChild(A.sec('Impacto instantâneo · ' + C.MAND[S.cart].rotulo, {mtd: 'choques'}, [
      h('div', {style: 'font-size:2rem;font-weight:600', class: 'num ' + A.cls(r.total)}, A.spct(r.total, 2)),
      r.aviso ? h('div', {class: 'alert ' + (r.status === 'invalida' ? 'bad' : 'warn')}, r.aviso) : null,
      r.descobertos.length ? A.more('Fora do cálculo (' + A.pct(C.sum(r.descobertos, function (x) { return x.w; }), 1) + ')', h('ul', null, r.descobertos.map(function (x) { return h('li', null, x.t + ' ' + A.pct(x.w, 2) + ' · ' + x.motivo); }))) : null,
      h('h3', null, 'Por fator'), A.hbars(Object.keys(r.porFator).map(function (k) { var f = C.FATORES.filter(function (x) { return x.k === k; })[0]; return {label: f ? f.n : k === 'usd_conv' ? 'Conversão cambial (ativos em USD)' : k === 'idio' ? 'Específico de empresa' : k, v: r.porFator[k]}; }).sort(function (a, b) { return a.v - b.v; }), {signed: true, fmt: function (x) { return A.pp(x); }}),
      h('p', {class: 'hint'}, 'Soma dos fatores ' + A.pp(soma) + ' = total ' + A.pp(r.total) + ' (reconciliação).'),
      h('h3', null, 'Por pilar'), A.hbars(Object.keys(r.porPilar).sort(function (a, b) { return +a.slice(1) - +b.slice(1); }).map(function (k) { return {label: k + ' ' + (C.PIL[k] ? C.PIL[k].nome : ''), v: r.porPilar[k]}; }), {signed: true, fmt: function (x) { return A.pp(x); }})
    ]));
    L.appendChild(A.sec('Por ativo', {flush: true, hint: 'Contribuição = peso × retorno em reais. Nos ativos em dólar: (1 + retorno local)(1 + dólar) − 1.'}, A.table([
      {k: 't', t: 'Ativo', f: function (x) { return A.tk(x.t); }}, {k: 'w', t: 'Peso', r: 1, f: function (x) { return A.pct(x.w, 2); }},
      {k: 'l', t: 'Local', r: 1, f: function (x) { return A.spct(x.r.local); }, s: function (x) { return x.r.local; }},
      {k: 'fx', t: 'Câmbio', r: 1, f: function (x) { return x.r.moeda === 'USD' ? A.spct(x.r.fx) : '—'; }, s: function (x) { return x.r.fx; }},
      {k: 'tot', t: 'Em reais', r: 1, f: function (x) { return h('span', {class: A.cls(x.r.total)}, A.spct(x.r.total)); }, s: function (x) { return x.r.total; }},
      {k: 'ctb', t: 'Contribuição', r: 1, f: function (x) { return h('span', {class: A.cls(x.ctb)}, A.pp(x.ctb)); }},
      {k: 'o', t: 'Base', s: false, f: function (x) { return A.ochip(P.origem[x.t] === 'gestor' ? 'gestor' : 'ia'); }}
    ], r.itens, {sort: 'ctb', dir: 1})));
    // horizonte da renda fixa
    var rf = (v.pos || []).filter(function (x) { var q = P.sens[x.t]; return x.w > 0 && q && q.m === 'rf' && (ch[q.f] || (q.s && ch.spread)); });
    if (rf.length) R.appendChild(A.sec('Reação imediata × horizonte (renda fixa)', {mtd: 'horizonte', hint: 'Uma alta de juros ou de spread derruba o preço hoje e aumenta o carrego daqui para frente. A perda de preço usa o mesmo cálculo do motor (curva, spread e convexidade cadastrada).'}, A.table([
      {k: 't', t: 'Ativo'}, {k: 'pr', t: 'Preço hoje', r: 1, f: function (x) { var o = C.horizonteRF(x.t, ch, 1, P.sens); return o ? A.spct(o.preco) : '—'; }},
      {k: 'c', t: 'Carrego extra/ano', r: 1, f: function (x) { var o = C.horizonteRF(x.t, ch, 1, P.sens); return o ? A.spct(o.carregoExtraAno) : '—'; }},
      {k: 'rec', t: 'Recupera em', r: 1, f: function (x) { var o = C.horizonteRF(x.t, ch, 1, P.sens); return o && o.recuperacaoAnos != null ? A.num(o.recuperacaoAnos, 1) + ' anos' : '—'; }},
      {k: 'h3', t: 'Relativo em 3 anos', r: 1, f: function (x) { var o = C.horizonteRF(x.t, ch, 3, P.sens); return o ? h('span', {class: A.cls(o.relativoH)}, A.spct(o.relativoH)) : '—'; }}
    ], rf)));
    // todas as carteiras
    var all = C.CARTS.map(function (m) { var vv = STORE.aprovadaVigente(C, m.id), rr = C.choqueCarteira(vv, ch, P.sens, idio); return {label: m.rotulo + (rr.status === 'invalida' ? ' · inválida' : rr.status === 'parcial' ? ' · parcial' : ''), v: rr.total, tip: [m.rotulo, 'Impacto ' + A.spct(rr.total, 2), rr.aviso || 'carteira válida', 'Descoberto ' + A.pct(rr.cobertura.descoberto, 0)]}; });
    R.appendChild(A.sec('As 15 carteiras aprovadas', {hint: 'Inválidas e parciais mostram a soma das contribuições das posições como estão, sem normalizar.'}, A.hbars(all, {signed: true, fmt: function (x) { return A.spct(x, 2); }})));
    wrap.appendChild(g); wrap.appendChild(historicos(v));
    return wrap;
  }

  // Propagação de choques pelas covariâncias históricas dos fatores (evita tratar fatores como independentes)
  A.fatoresHist = function (meses) {
    var have = Object.keys(A.FSER).filter(function (k) { return A.SER[A.FSER[k]]; });
    if (have.length < 2) return {ok: false, motivo: 'importe pelo menos duas séries de fatores (' + Object.keys(A.FSER).map(function (k) { return A.FSER[k]; }).join(', ') + ')', have: have};
    var sbi = {}; have.forEach(function (k) { sbi[A.FSER[k]] = A.SER[A.FSER[k]].pts; });
    var start; if (meses) { var d = new Date(); d.setMonth(d.getMonth() - meses); start = d.toISOString().slice(0, 10); }
    var al = Q.alignPrices(sbi, have.map(function (k) { return A.FSER[k]; }), {freq: 'M', start: start});
    if (!al || !al.ok) return {ok: false, motivo: al ? al.reason : 'falha', have: have};
    var X = []; for (var t = 1; t < al.P.length; t++) X.push(have.map(function (k, j) { var a = al.P[t - 1][j], b = al.P[t][j]; return NIVEL[k] ? b - a : (b / a - 1) * 100; }));
    return {ok: X.length >= 24, motivo: X.length < 24 ? 'só ' + X.length + ' meses em comum (mínimo 24)' : null, have: have, X: X, dates: al.dates.slice(1), n: X.length};
  };
  function propagacao(ch) {
    var fh = A.fatoresHist(60);
    var box = h('div', {style: 'margin-top:12px'});
    box.appendChild(h('h3', null, 'Propagar pelos co-movimentos históricos'));
    if (!fh.ok) { box.appendChild(h('p', {class: 'hint'}, 'Não disponível: ' + fh.motivo + '. Com as séries, a ferramenta preenche os demais fatores por E[f | choques fixados] = Σ_UK Σ_KK⁻¹ s_K (regressão nos últimos 60 meses).')); return box; }
    var fixos = fh.have.filter(function (k) { return ch[k]; });
    box.appendChild(h('p', {class: 'hint'}, 'Fatores com série: ' + fh.have.join(', ') + ' · ' + fh.n + ' meses. Fixados por você: ' + (fixos.join(', ') || 'nenhum') + '. Os outros com série serão preenchidos pela média condicional.'));
    box.appendChild(h('button', {class: 'btn', disabled: !fixos.length || null, onclick: function () {
      var Sf = Q.cov(fh.X), idx = fixos.map(function (k) { return fh.have.indexOf(k); }), s = fixos.map(function (k) { return ch[k]; });
      var r = Q.conditionalShock(Sf, idx, s);
      if (!r) { A.toast('Matriz singular; não foi possível propagar.'); return; }
      fh.have.forEach(function (k, j) { if (!ch[k]) S.choques[k] = Math.round(r[j] * 100) / 100; });
      A.toast('Fatores preenchidos pela média condicional histórica (' + fh.n + ' meses).'); A.render();
    }}, 'Propagar'));
    return box;
  }

  function historicos(v) {
    var st = A.histState = A.histState || {};
    var wrap = A.sec('Cenários históricos', {mtd: 'historico', hint: 'Retornos realmente observados nas séries importadas, entre as datas do período. Períodos definidos pela ferramenta; ajuste se o Comitê usar outra referência. Ativos sem série no período ficam fora e aparecem como descobertos.', flush: true}, A.table([
      {k: 'n', t: 'Cenário'},
      {k: 'p', t: 'Período', s: false, f: function (x) { var a = h('input', {class: 'inp', type: 'date', value: (st[x.id] || x).ini, onchange: function () { st[x.id] = Object.assign({}, st[x.id] || x, {ini: a.value}); A.render(); }}); var b = h('input', {class: 'inp', type: 'date', value: (st[x.id] || x).fim, onchange: function () { st[x.id] = Object.assign({}, st[x.id] || x, {fim: b.value}); A.render(); }}); return h('span', {class: 'row', style: 'gap:4px'}, a, '→', b); }},
      {k: 'r', t: 'Carteira', r: 1, f: function (x) { var o = histCalc(v, st[x.id] || x); return o.cob > 0 ? h('span', {class: A.cls(o.tot)}, A.pp(o.tot)) : A.na('sem séries no período'); }, s: function (x) { return histCalc(v, st[x.id] || x).tot; }},
      {k: 'c', t: 'Cobertura', r: 1, f: function (x) { return A.pct(histCalc(v, st[x.id] || x).cob, 0); }, s: false},
      {k: 'f', t: 'Ibovespa · dólar', r: 1, s: false, f: function (x) { var p = st[x.id] || x; var a = A.SER.IBOV ? Q.cumReturn(A.SER.IBOV.pts, p.ini, p.fim) : null, b = A.SER.USDBRL ? Q.cumReturn(A.SER.USDBRL.pts, p.ini, p.fim) : null; return (a && a.ok ? A.spct(a.r, 0) : '—') + ' · ' + (b && b.ok ? A.spct(b.r, 0) : '—'); }},
      {k: 'd', t: '', s: false, f: function (x) { return h('button', {class: 'btn sm', onclick: function () { var p = st[x.id] || x, o = histCalc(v, p); A.drawer(x.n, h('div', null, h('p', null, A.dataBR(p.ini) + ' a ' + A.dataBR(p.fim) + ' · cobertura ' + A.pct(o.cob, 0)), A.table([{k: 't', t: 'Ativo'}, {k: 'w', t: 'Peso', r: 1, f: function (y) { return A.pct(y.w, 2); }}, {k: 'r', t: 'Retorno em reais', r: 1, f: function (y) { return y.r == null ? A.na(y.motivo) : A.spct(y.r); }}, {k: 'c', t: 'Contribuição', r: 1, f: function (y) { return y.r == null ? '—' : A.pp(y.w * y.r); }}], o.itens, {sort: 'c'}))); }}, 'Detalhe'); }}
    ], A.HIST));
    return wrap;
  }
  function histCalc(v, p) {
    var itens = [], tot = 0, cob = 0;
    (v.pos || []).forEach(function (x) {
      if (!(x.w > 0)) return; var a = C.ATV[x.t];
      if (!a || a.status === 'placeholder') { itens.push({t: x.t, w: x.w, r: null, motivo: 'placeholder'}); return; }
      var sd = A.serieDe(x.t); if (!sd) { itens.push({t: x.t, w: x.w, r: null, motivo: 'sem série'}); return; }
      var c = Q.cumReturn(A.SER[sd.id].pts, p.ini, p.fim); if (!c.ok) { itens.push({t: x.t, w: x.w, r: null, motivo: c.reason || 'série não cobre o período'}); return; }
      var r = c.r;
      if (a.moeda === 'USD') { var fx = A.SER.USDBRL ? Q.cumReturn(A.SER.USDBRL.pts, p.ini, p.fim) : null; if (!fx || !fx.ok) { itens.push({t: x.t, w: x.w, r: null, motivo: 'sem dólar no período'}); return; } r = (1 + r) * (1 + fx.r) - 1; }
      itens.push({t: x.t, w: x.w, r: r, proxy: sd.proxy}); tot += x.w * r; cob += x.w;
    });
    return {itens: itens, tot: tot, cob: cob};
  }

  /* ---------- risco estatístico ---------- */
  function controles() {
    var st = A.riskState = A.riskState || {meses: 36, lw: false, bench: 'base'};
    var mes = h('select', {class: 'inp', onchange: function () { st.meses = +mes.value; A.render(); }}, [[12, '12 meses'], [24, '24 meses'], [36, '36 meses'], [60, '60 meses'], [0, 'todo o histórico']].map(function (o) { return h('option', {value: o[0], selected: st.meses === o[0] || null}, o[1]); }));
    return {st: st, el: h('div', {class: 'row'}, 'Janela ', mes, h('label', null, h('input', {type: 'checkbox', checked: st.lw || null, onchange: function (e) { st.lw = e.target.checked; A.render(); }}), ' Covariância encolhida (Ledoit-Wolf)'))};
  }
  function semModelo(m) { return A.sec('Risco estatístico', {mtd: 'risco'}, [A.na(m.motivo || m.motivoCov, m.bloqueado ? 'uma proposta que feche em 100% (selecione-a em Versão)' : 'preços históricos ajustados (Dados → Preços)'), m.fora && m.fora.length ? A.more('Posições fora do modelo (' + m.fora.length + ')', h('ul', null, m.fora.map(function (x) { return h('li', null, x.t + ' ' + A.pct(x.w, 2) + ' · ' + x.motivo); }))) : null]); }
  function estat() {
    var v = A.versao(), k = controles(), st = k.st, wrap = h('div');
    wrap.appendChild(A.sec('Parâmetros', null, k.el));
    var m = A.modelo(v, {meses: st.meses || null, lw: st.lw, extra: ['IBOV', 'CDI']});
    if (!m.ok || !m.S) { wrap.appendChild(semModelo(m.ok ? {motivoCov: m.motivoCov, fora: m.fora} : m)); return wrap; }
    var r = m.port, ann = function (x) { return Q.annualizeVol(x, m.ppy); }, sig = Q.portVol(m.w, m.S);
    var dd = Q.drawdown(r), rc = Q.riskContrib(m.w, m.S);
    var ib = m.extras.IBOV, cdi = m.extras.CDI;
    var info = 'Amostra: ' + m.n + ' retornos ' + FREQ[m.freq] + ' de ' + A.dataBR(m.dates[0]) + ' a ' + A.dataBR(m.dates[m.n - 1]) + ' · cobertura ' + A.pct(m.cobertura, 1) + ' da carteira (pesos sem normalizar) · ' + (st.lw ? 'covariância encolhida (intensidade ' + A.num(m.shrink, 2) + ')' : 'covariância amostral') + '.';
    if (!m.suficiente) wrap.appendChild(h('div', {class: 'alert warn'}, 'Amostra curta (' + m.n + ' < ' + m.minObs + '): os números abaixo são frágeis.'));
    var horiz = {D: '1 dia', W: '1 semana', M: '1 mês'}[m.freq];
    // Comparações com índices de 100% só fazem sentido com a carteira inteira coberta; senão a escala não bate.
    var cheia = m.cobertura >= 1 - C.TOL, naCob = 'cobertura de ' + A.pct(m.cobertura, 0) + ': comparar com um índice de 100% distorceria';
    function vsIdx(x, fn) { if (!x) return null; var pr = A.pares(r, x); return pr[0].length >= 3 ? fn(pr[0], pr[1]) : null; }
    var teTxt = null, teNota = 'contra o benchmark escolhido';
    var bsel = h('select', {class: 'inp', onchange: function () { st.bench = bsel.value; A.render(); }}, [['base', 'Base 30/10 (mesmas séries)'], ['ibov', 'Ibovespa (série IBOV)'], ['cdi', 'CDI (série CDI)']].map(function (o) { return h('option', {value: o[0], selected: st.bench === o[0] || null}, o[1]); }));
    if (st.bench === 'base') {
      // benchmark Base 30/10: um modelo só com os ativos das duas versões (nada da base é descartado em silêncio)
      var bv = C.historica('base-30-10', S.cart), mb2 = bv ? A.modeloPar(bv, v, {meses: st.meses || null, lw: st.lw}) : {ok: false, motivo: 'sem base 30/10'};
      if (mb2.ok && mb2.S && mb2.suficiente) {
        var dv = mb2.wb.map(function (x, k) { return x - mb2.wa[k]; }), te = Q.annualizeVol(Q.portVol(dv, mb2.S), mb2.ppy), act = Q.portReturns(mb2.R, dv);
        teTxt = A.pct(te, 2) + ' · ' + (te > 0 ? A.num(Q.mean(act) * mb2.ppy / te, 2) : '—');
        var fb = C.sum(mb2.foraA, function (x) { return x.w; }), fv = C.sum(mb2.foraB, function (x) { return x.w; });
        teNota = 'contra a Base 30/10 na mesma amostra (' + mb2.n + ' retornos)' + (fb > C.TOL || fv > C.TOL ? '; parcial: sem série ' + A.pct(fb, 0) + ' da base e ' + A.pct(fv, 0) + ' da versão' : '');
      } else teTxt = A.na(mb2.motivo || mb2.motivoCov || 'amostra insuficiente');
    } else {
      var bx = st.bench === 'ibov' ? ib : cdi;
      if (!bx) teTxt = A.na('sem série ' + (st.bench === 'ibov' ? 'IBOV' : 'CDI'));
      else if (!cheia) teTxt = A.na(naCob);
      else { var pr = A.pares(r, bx); teTxt = A.pct(Q.trackingError(pr[0], pr[1], m.ppy), 2) + ' · ' + A.num(Q.infoRatio(pr[0], pr[1], m.ppy), 2); teNota = 'contra ' + (st.bench === 'ibov' ? 'o Ibovespa' : 'o CDI') + ', ' + pr[0].length + ' períodos com os dois'; }
    }
    var rf = cdi ? cdi : null;
    var rows = [
      ['Volatilidade anualizada', A.pct(ann(sig), 2), 'σ = √(w′Σw) × √' + m.ppy],
      ['Retorno médio anualizado', A.spct(Q.annualizeReturn(Q.mean(r), m.ppy), 2), 'geométrico sobre a média do período'],
      ['Drawdown máximo', A.spct(dd.mdd, 2), dd.trough != null ? 'fundo em ' + A.dataBR(m.dates[dd.trough]) : ''],
      ['Drawdown atual', A.spct(dd.current, 2), ''],
      ['VaR histórico 95% (' + horiz + ')', Q.varHist(r, 0.95) == null ? A.na('menos de 30 observações') : A.pct(Q.varHist(r, 0.95), 2), 'quantil 5% das perdas'],
      ['Expected Shortfall 95% (' + horiz + ')', Q.esHist(r, 0.95) == null ? A.na('menos de 30 observações') : A.pct(Q.esHist(r, 0.95), 2), 'média das perdas além do VaR (carteira, não inferido da vol)'],
      ['VaR 99% · ES 99% (' + horiz + ')', Q.varHist(r, 0.99) == null ? A.na('menos de 30 observações') : A.pct(Q.varHist(r, 0.99), 2) + ' · ' + A.pct(Q.esHist(r, 0.99), 2), 'com poucas observações na cauda; leia com cuidado'],
      ['VaR · ES paramétricos 95%', A.pct(Q.varNormal(r, 0.95), 2) + ' · ' + A.pct(Q.esNormal(r, 0.95), 2), 'normal; subestima caudas gordas'],
      ['Beta contra o Ibovespa', ib ? (vsIdx(ib, Q.beta) == null ? A.na('poucos períodos em comum') : A.num(vsIdx(ib, Q.beta), 2)) : A.na('sem série IBOV'), cheia ? '' : 'contribuição das posições cobertas (' + A.pct(m.cobertura, 0) + ')'],
      ['Sharpe · Sortino', !rf ? A.na('sem série CDI') : !cheia ? A.na(naCob) : (function () { var pr = A.pares(r, rf); return A.num(Q.sharpe(pr[0], pr[1], m.ppy), 2) + ' · ' + A.num(Q.sortino(pr[0], pr[1], m.ppy), 2); })(), 'excesso sobre o CDI, média aritmética anualizada'],
      ['Tracking error · Information ratio', teTxt, teNota],
      ['Índice de diversificação', A.num(Q.divRatio(m.w, m.S), 2), 'Σ wᵢσᵢ ÷ σ da carteira; 1 = nenhuma diversificação']
    ];
    var P = A.prem(), ex = C.exposicoes(v, P.sens);
    rows.push(['Exposição cambial direta', A.pct(ex.porMoeda.USD || 0, 1), 'peso em ativos em dólar']);
    rows.push(['Duration (pré · real · Treasuries)', A.num(ex.fatores.dur_pre, 2) + ' · ' + A.num(ex.fatores.dur_real, 2) + ' · ' + A.num(ex.fatores.dur_ust, 2) + ' anos', 'premissa; DV01 por R$ 1 milhão ≈ R$ ' + A.num((ex.fatores.dur_pre + ex.fatores.dur_real + ex.fatores.dur_ust) * 100, 0)]);
    rows.push(['Sensibilidade a spread', A.num(ex.fatores.spread_dur, 2) + ' anos', 'premissa; −' + A.num(ex.fatores.spread_dur, 2) + '% por +1 p.p.']);
    wrap.appendChild(A.sec('Métricas da carteira', {mtd: 'risco', hint: info, right: h('span', null, 'Benchmark ', bsel)}, h('table', {class: 't'}, h('tbody', null, rows.map(function (x) { return h('tr', null, h('td', null, x[0]), h('td', {class: 'r num'}, x[1]), h('td', {class: 'muted', style: 'font-size:.84rem'}, x[2])); })))));
    var g = h('div', {class: 'grid2'});
    var win = m.freq === 'D' ? 63 : m.freq === 'W' ? 26 : 12;
    var rv = Q.rolling(r, win, function (a) { return Q.annualizeVol(Q.std(a), m.ppy); });
    g.appendChild(A.sec('Drawdown e volatilidade móvel', null, [A.lines([{name: 'Drawdown', pts: m.dates.map(function (d, i) { return [d, dd.dd[i]]; })}], {zero: true, h: 180}), h('h3', null, 'Volatilidade móvel (' + win + ' períodos)'), A.lines([{name: 'Vol', pts: m.dates.map(function (d, i) { return [d, rv[i]]; })}], {h: 160})]));
    var rowsRC = m.ids.map(function (t, i) { return {t: t, p: m.usar[i].p, pils: m.usar[i].pils, w: m.w[i], vol: ann(Math.sqrt(m.S[i][i])), mrc: ann(rc.mrc[i]), ctr: ann(rc.ctr[i]), pct: rc.pct[i], proxy: m.usar[i].proxy}; });
    g.appendChild(A.sec('Contribuição ao risco', {mtd: 'risco', flush: true, hint: 'CTRᵢ = wᵢ (Σw)ᵢ / σ; soma = σ da carteira (' + A.pct(ann(sig), 2) + '). Contribuição negativa = posição que reduz o risco.'}, A.table([
      {k: 't', t: 'Ativo', f: function (x) { return h('span', null, x.t, x.proxy ? A.chip('proxy ' + C.ATV[x.t].proxy_us, 'g-media', 'Série do ETF americano usada como aproximação do UCITS') : null); }},
      {k: 'w', t: 'Peso', r: 1, f: function (x) { return A.pct(x.w, 2); }}, {k: 'vol', t: 'Vol própria', r: 1, f: function (x) { return A.pct(x.vol, 1); }},
      {k: 'mrc', t: 'Risco marginal', r: 1, f: function (x) { return A.pct(x.mrc, 1); }}, {k: 'ctr', t: 'Contribuição', r: 1, f: function (x) { return A.pp(x.ctr); }},
      {k: 'pct', t: '% do risco', r: 1, f: function (x) { return h('span', null, h('span', {class: 'bar' + (x.pct < 0 ? ' neg' : ''), style: 'width:' + Math.min(70, Math.abs(x.pct) * 140) + 'px'}), A.pct(x.pct, 1)); }}
    ], rowsRC, {sort: 'pct'})));
    wrap.appendChild(g);
    var porP = {}, wP = {}; rowsRC.forEach(function (x) { Object.keys(x.pils).forEach(function (p) { porP[p] = (porP[p] || 0) + x.pct * x.pils[p] / x.w; wP[p] = (wP[p] || 0) + x.pils[p]; }); });
    wrap.appendChild(A.sec('Risco por pilar', {hint: 'Fatia da volatilidade por pilar contra o peso do pilar. Pilares com fatia de risco muito acima do peso concentram o risco.'}, A.hbars(Object.keys(porP).sort(function (a, b) { return +a.slice(1) - +b.slice(1); }).map(function (p) { var wp = wP[p] || 0; return {label: p + ' ' + C.PIL[p].nome, v: porP[p], ghost: wp, tip: [p, 'Fatia do risco ' + A.pct(porP[p]), 'Peso ' + A.pct(wp)]}; }))));
    wrap.appendChild(liquidez(v));
    if (m.fora.length) wrap.appendChild(A.sec('Fora do modelo', null, h('ul', null, m.fora.map(function (x) { return h('li', null, x.t + ' ' + A.pct(x.w, 2) + ' · ' + x.motivo); }))));
    return wrap;
  }
  function liquidez(v) {
    var tab = A.TAB.liquidez, st = A.liqState = A.liqState || {pl: null, part: 0.2};
    if (!tab) return A.sec('Liquidez por horizonte', null, A.na('volume médio diário não importado', 'Dados → Liquidez (ticker; volume médio diário em R$)'));
    var pl = h('input', {class: 'inp n', type: 'number', step: '1000000', value: st.pl || '', placeholder: 'R$', style: 'width:140px', onchange: function () { st.pl = Number(pl.value) || null; A.render(); }});
    var part = h('input', {class: 'inp n', type: 'number', step: '5', value: st.part * 100, onchange: function () { st.part = Number(part.value) / 100 || 0.2; A.render(); }});
    var body = [h('div', {class: 'row'}, 'Patrimônio da carteira ', pl, ' · participação máxima no volume diário ', part, ' %')];
    if (st.pl) {
      var rows = (v.pos || []).filter(function (x) { return x.w > 0; }).map(function (x) { var adtv = tab[x.t]; var dias = adtv ? (x.w * st.pl) / (st.part * adtv) : null; return {t: x.t, w: x.w, adtv: adtv, dias: dias}; });
      var hz = [1, 5, 20].map(function (d) { return [d, C.sum(rows.filter(function (r) { return r.dias != null; }), function (r) { return r.w * Math.min(1, d / Math.max(r.dias, 1e-9)); })]; });
      var semDado = C.sum(rows.filter(function (r) { return r.dias == null; }), function (r) { return r.w; });
      body.push(h('p', null, hz.map(function (x) { return 'Em ' + x[0] + ' dia(s): ' + A.pct(x[1], 0); }).join(' · ') + (semDado ? ' · sem volume cadastrado: ' + A.pct(semDado, 0) : '')));
      body.push(A.table([{k: 't', t: 'Ativo'}, {k: 'w', t: 'Peso', r: 1, f: function (r) { return A.pct(r.w, 2); }}, {k: 'adtv', t: 'Volume diário (R$)', r: 1, f: function (r) { return r.adtv ? A.num(r.adtv, 0) : A.na(); }}, {k: 'dias', t: 'Dias para zerar', r: 1, f: function (r) { return r.dias == null ? '—' : A.num(r.dias, 1); }}], rows, {sort: 'dias'}));
    }
    return A.sec('Liquidez por horizonte', {hint: 'Dias para zerar = peso × patrimônio ÷ (participação × volume médio diário).'}, body);
  }

  /* ---------- correlações ---------- */
  function correl() {
    var v = A.versao(), st = A.corrState = A.corrState || {meses: 36, metodo: 'pearson', par: null};
    var wrap = h('div');
    var mes = h('select', {class: 'inp', onchange: function () { st.meses = +mes.value; A.render(); }}, [[3, '3 meses'], [12, '12 meses'], [24, '24 meses'], [36, '36 meses'], [60, '60 meses']].map(function (o) { return h('option', {value: o[0], selected: st.meses === o[0] || null}, o[1]); }));
    var met = h('select', {class: 'inp', onchange: function () { st.metodo = met.value; A.render(); }}, [['pearson', 'Pearson'], ['spearman', 'Spearman (postos)']].map(function (o) { return h('option', {value: o[0], selected: st.metodo === o[0] || null}, o[1]); }));
    wrap.appendChild(A.sec('Parâmetros', {mtd: 'correl'}, h('div', {class: 'row'}, 'Janela ', mes, ' Método ', met, h('span', {class: 'muted'}, 'Retornos em reais, mínimo de 20 observações por par. Pares com menos ficam em branco.'))));
    // retornos por ativo (pares, sem exigir datas comuns a todos)
    var pos = (v.pos || []).filter(function (x) { return x.w > 0 && C.ATV[x.t] && C.ATV[x.t].status !== 'placeholder' && A.serieDe(x.t); });
    var vistos = {}; pos = pos.filter(function (x) { if (vistos[x.t]) return false; vistos[x.t] = 1; return true; });
    if (pos.length < 2) { wrap.appendChild(A.sec('Matriz de correlação', null, A.na('menos de duas posições com série', 'preços históricos'))); wrap.appendChild(paresF()); return wrap; }
    var d0 = new Date(); d0.setMonth(d0.getMonth() - st.meses); var start = d0.toISOString().slice(0, 10);
    var rb = retornosBRL(pos.map(function (x) { return x.t; }), start);
    var ids = Object.keys(rb.r);
    if (ids.length < 2) { wrap.appendChild(A.sec('Matriz de correlação', null, A.na('menos de duas posições com histórico suficiente' + (rb.curtas.length ? ' (séries curtas: ' + rb.curtas.join(', ') + ')' : ''), 'preços históricos'))); wrap.appendChild(paresF()); return wrap; }
    var pc = Q.pairwiseCorr(rb.r, ids, {method: st.metodo, minObs: 20});
    wrap.appendChild(A.sec('Matriz de correlação', {mtd: 'correl', hint: 'Frequência ' + FREQ[rb.freq] + ' · desde ' + A.dataBR(start) + '. Passe o mouse para ver o número de observações de cada par.' + (rb.semFx.length ? ' Sem USDBRL para converter: ' + rb.semFx.join(', ') + '.' : '') + (rb.curtas.length ? ' Séries com menos de 3 pontos, fora: ' + rb.curtas.join(', ') + '.' : '')}, A.heat(pc.C, ids, ids, {diverging: true, hi: 1, fmt: function (x) { return A.num(x, 2); }, tip: function (i, j) { return [ids[i] + ' × ' + ids[j], pc.C[i][j] == null ? 'sem dado suficiente' : 'ρ = ' + A.num(pc.C[i][j], 2), 'n = ' + pc.N[i][j]]; }})));
    // par móvel
    var par = st.par || [ids[0], ids[1]];
    var sa = h('select', {class: 'inp', onchange: function () { st.par = [sa.value, sb.value]; A.render(); }}, ids.map(function (t) { return h('option', {selected: t === par[0] || null}, t); }));
    var sb = h('select', {class: 'inp', onchange: function () { st.par = [sa.value, sb.value]; A.render(); }}, ids.map(function (t) { return h('option', {selected: t === par[1] || null}, t); }));
    var full = retornosBRL(par, null);
    var al = alinhar(full.r[par[0]] || [], full.r[par[1]] || []), win = full.freq === 'D' ? 63 : full.freq === 'W' ? 26 : 12;
    var rol = al.d.map(function (d, i) { return i + 1 < win ? [d, null] : [d, Q.pearson(al.a.slice(i + 1 - win, i + 1), al.b.slice(i + 1 - win, i + 1))]; });
    var g = h('div', {class: 'grid2'});
    g.appendChild(A.sec('Correlação móvel', {hint: 'Janela de ' + win + ' períodos, todo o histórico disponível.'}, [h('div', {class: 'row'}, sa, ' × ', sb), al.d.length > win ? A.lines([{name: par.join(' × '), pts: rol}], {fmt: function (x) { return A.num(x, 2); }, h: 200}) : A.na('histórico curto')]));
    // estresse
    var pesos = {}; pos.forEach(function (x) { pesos[x.t] = (pesos[x.t] || 0) + x.w; });
    var str = estresse(rb, ids, pesos);
    g.appendChild(A.sec('Quando a diversificação falha', {mtd: 'estresse', hint: 'Correlação média entre os pares nos 10% piores períodos da carteira contra todos os períodos. Se sobe muito, a diversificação some justamente quando é necessária.'}, str));
    wrap.appendChild(g);
    wrap.appendChild(paresF());
    return wrap;
  }
  function retornosBRL(tickers, start) {
    var out = {}, semFx = [], freq = null;
    var fx = A.SER.USDBRL ? A.SER.USDBRL.pts : null;
    var curtas = [];
    tickers = tickers.filter(function (t) { var n = A.SER[A.serieDe(t).id].pts.length; if (n < 3) { curtas.push(t); return false; } return true; });
    var fr = tickers.map(function (t) { var f = Q.inferFreq(A.SER[A.serieDe(t).id].pts.map(function (x) { return x[0]; })); return f ? f.freq : 'D'; });
    freq = fr.indexOf('M') >= 0 ? 'M' : fr.indexOf('W') >= 0 ? 'W' : 'D';
    // câmbio no MESMO intervalo do retorno do ativo: nível do dólar na chave do ponto final ÷ nível na chave do ponto inicial
    var fxL = null; if (fx) { fxL = {}; Q.resample(fx, freq).forEach(function (p) { fxL[key(p[0], freq)] = p[1]; }); }
    tickers.forEach(function (t) {
      var pts = Q.resample(A.SER[A.serieDe(t).id].pts, freq).filter(function (p) { return !start || p[0] >= start; }), usd = C.ATV[t].moeda === 'USD', r = [];
      if (usd && !fxL) { semFx.push(t); return; }
      for (var i = 1; i < pts.length; i++) { var x = pts[i][1] / pts[i - 1][1] - 1; if (usd) { var a0 = fxL[key(pts[i - 1][0], freq)], a1 = fxL[key(pts[i][0], freq)]; if (a0 == null || a1 == null) continue; x = (1 + x) * (a1 / a0) - 1; } r.push([key(pts[i][0], freq), x]); }
      out[t] = r;
    });
    return {r: out, freq: freq, semFx: semFx, curtas: curtas};
  }
  function key(d, f) { if (f === 'M') return d.slice(0, 7) + '-28'; if (f === 'W') { var dt = new Date(d + 'T00:00:00Z'), day = (dt.getUTCDay() + 6) % 7; dt.setUTCDate(dt.getUTCDate() - day + 4); return dt.toISOString().slice(0, 10); } return d; }
  function alinhar(a, b) { var mb = {}; b.forEach(function (p) { mb[p[0]] = p[1]; }); var d = [], x = [], y = []; a.forEach(function (p) { if (mb[p[0]] != null) { d.push(p[0]); x.push(p[1]); y.push(mb[p[0]]); } }); return {d: d, a: x, b: y}; }
  function estresse(rb, ids, pesos) {
    var datas = {}; ids.forEach(function (t) { rb.r[t].forEach(function (p) { datas[p[0]] = (datas[p[0]] || 0) + 1; }); });
    var comuns = Object.keys(datas).filter(function (d) { return datas[d] === ids.length; }).sort();
    if (comuns.length < 40) return A.na('menos de 40 períodos com todas as séries');
    var mp = {}; ids.forEach(function (t) { mp[t] = {}; rb.r[t].forEach(function (p) { mp[t][p[0]] = p[1]; }); });
    var sw = C.sum(ids, function (t) { return pesos[t] || 0; }) || 1;
    var port = comuns.map(function (d) { return C.sum(ids, function (t) { return (pesos[t] || 0) * mp[t][d]; }) / sw; });
    var cut = Q.quantile(port, 0.1), ruins = comuns.filter(function (d, i) { return port[i] <= cut; });
    function media(ds) { var s = 0, n = 0; for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) { var c = Q.pearson(ds.map(function (d) { return mp[ids[i]][d]; }), ds.map(function (d) { return mp[ids[j]][d]; })); if (c != null) { s += c; n++; } } return n ? s / n : null; }
    var a = media(comuns), b = media(ruins);
    return h('dl', {class: 'kv'}, h('dt', null, 'Todos os períodos'), h('dd', {class: 'num'}, A.num(a, 2) + ' (' + comuns.length + ' períodos)'), h('dt', null, '10% piores'), h('dd', {class: 'num'}, (b == null ? '—' : A.num(b, 2)) + ' (' + ruins.length + ' períodos)'),
      h('dt', null, 'Leitura'), h('dd', null, b == null ? '—' : b > a + 0.15 ? 'A correlação sobe bastante no estresse: a diversificação entre essas posições é menor do que parece.' : 'A correlação não sobe muito no estresse nesta amostra.'));
  }
  function paresF() {
    return A.sec('Observações qualitativas do Consultor F', {hint: 'Correlações informadas por um consultor no Comitê. Não foram calculadas aqui e não entram em nenhum modelo.'}, A.table([{k: 'par', t: 'Par'}, {k: 'pilar', t: 'Pilar'}, {k: 'correlacao', t: 'Correlação informada', r: 1, f: function (p) { return A.num(p.correlacao, 2); }}, {k: 'leitura', t: 'Comentário'}], C.D.pares || []));
  }

  /* ---------- diversificação e fatores ---------- */
  function fatores() {
    var v = A.versao(), P = A.prem(), wrap = h('div');
    var pos = (v.pos || []).filter(function (x) { return x.w > 0 && C.ATV[x.t] && C.ATV[x.t].status !== 'placeholder'; });
    // matriz de exposições qualitativas
    var cols = [['beta', 'β Ibov'], ['j', 'Juros resid.'], ['u', 'Dólar'], ['b', 'Brent'], ['d', 'Duration'], ['s', 'Spread dur.'], ['sp', 'S&P'], ['em', 'Emerg.'], ['btc', 'BTC'], ['x', 'Em USD']];
    var est = P.estimadas || {};
    wrap.appendChild(A.sec('Exposições por ativo', {mtd: 'fatores', flush: true, hint: 'Premissa = sensibilidade cadastrada (qualitativa). Estimada = regressão em séries importadas (Premissas → Estimar). Nenhuma empresa é forçada ao mesmo modelo: renda fixa usa duration, ações usam β e sensibilidades residuais, FIIs usam β e juro real.'}, A.table([
      {k: 't', t: 'Ativo', f: function (x) { return h('span', null, h('b', null, x.t), ' ', h('span', {class: 'muted'}, C.ATV[x.t].setor)); }}, {k: 'w', t: 'Peso', r: 1, f: function (x) { return A.pct(x.w, 1); }}
    ].concat(cols.map(function (c) { return {k: c[0], t: c[1], r: 1, s: false, f: function (x) { var s = P.sens[x.t] || {}; var val = c[0] === 'd' ? (s.m === 'rf' || s.m === 'fii' ? s.d : null) : s[c[0]]; if (c[0] === 'x') return s.x ? 'sim' : ''; if (val == null || val === 0) return ''; var e = est[x.t] && est[x.t][c[0]]; return e ? h('span', {title: 'Estimado: t = ' + A.num(e.t, 1) + ', n = ' + e.n + ', R² = ' + A.num(e.r2, 2)}, A.num(e.v, 2), ' ', A.chip('E', 'o-e')) : A.num(val, 2); }}; })).concat([{k: 'o', t: 'Base', s: false, f: function (x) { return A.ochip(est[x.t] ? 'e' : (P.origem[x.t] === 'gestor' ? 'gestor' : 'ia')); }}]), pos, {sort: 'w'})));
    // grupos de exposição compartilhada
    var ch = S.choques || {};
    var gr = (C.D.grupos || []).map(function (g) {
      var inC = pos.filter(function (x) { return g.tickers.indexOf(x.t) >= 0; });
      var w = C.sum(inC, function (x) { return x.w; });
      var r = Object.keys(ch).length ? C.choqueCarteira({pos: inC, cart: v.cart}, ch, P.sens, S.idio).total : null;
      return {g: g, inC: inC, w: w, r: r};
    });
    wrap.appendChild(A.sec('Riscos que se repetem em ativos diferentes', {hint: 'Grupos pedidos pelo Comitê. O canal comum é uma leitura qualitativa escrita pela IA, para revisar. Correlação estatística entre os membros aparece em Correlações quando há séries.'}, h('div', null, gr.map(function (x) {
      return h('div', {style: 'padding:8px 0;border-bottom:1px solid var(--line)'}, h('div', {class: 'row'}, h('b', null, x.g.nome), A.chip(A.pct(x.w, 1) + ' da carteira'), x.r != null ? A.chip('cenário ativo ' + A.pp(x.r), x.r < 0 ? 'g-critica' : 'o-obs') : null, A.ochip('ia')),
        h('div', {class: 'muted', style: 'font-size:.88rem'}, x.g.canal), h('div', {style: 'font-size:.88rem'}, x.inC.length ? x.inC.map(function (y) { return y.t + ' ' + A.pct(y.w, 1); }).join(' · ') : 'nenhum membro nesta carteira'));
    }))));
    // look-through
    var comp = A.TAB.composicao;
    if (!comp) wrap.appendChild(A.sec('Look-through de ETFs e fundos', null, A.na('composição interna não importada', 'Dados → Composição (etf; ativo; peso; país; setor)')));
    else {
      var agg = {}, etfs = pos.filter(function (x) { return comp[x.t]; });
      etfs.forEach(function (x) { comp[x.t].forEach(function (hh) { agg[hh.ativo] = (agg[hh.ativo] || 0) + x.w * hh.peso; }); });
      var top = Object.keys(agg).sort(function (a, b) { return agg[b] - agg[a]; }).slice(0, 15);
      var ov = etfs.map(function (a) { return etfs.map(function (b) { var ma = {}; comp[a.t].forEach(function (hh) { ma[hh.ativo] = hh.peso; }); return C.sum(comp[b.t], function (hh) { return Math.min(ma[hh.ativo] || 0, hh.peso); }); }); });
      wrap.appendChild(A.sec('Look-through de ETFs e fundos', {hint: 'Exposição indireta = peso do ETF × peso do ativo dentro dele. Sobreposição entre dois ETFs = Σ min(peso no A, peso no B).'}, h('div', {class: 'grid2'}, A.hbars(top.map(function (k) { return {label: k, v: agg[k]}; })), etfs.length > 1 ? A.heat(ov, etfs.map(function (x) { return x.t; }), etfs.map(function (x) { return x.t; }), {lo: 0, hi: 1, fmt: function (x) { return Math.round(x * 100) + ''; }}) : h('p', {class: 'hint'}, 'Importe a composição de pelo menos dois ETFs da carteira para ver a sobreposição.'))));
    }
    // mapa de fatores pedidos
    var fl = [['Juros nominais brasileiros', 'pre', 'DI'], ['Juros reais brasileiros', 'real', 'NTNB'], ['Inclinação da curva', null, 'DI curto e longo'], ['Crédito (spread)', 'spread', 'HYOAS'], ['Inflação', null, 'IPCA'], ['Dólar/real', 'usd', 'USDBRL'], ['Atividade doméstica', null, 'IBC-Br'], ['Brent', 'brent', 'BRENT'], ['Minério de ferro e China', null, 'MINERIO'], ['Bolsa brasileira', 'ibov', 'IBOV'], ['Bolsa americana', 'sp', 'SPX'], ['Emergentes', 'em', 'EEM'], ['Size, Value, Quality, Momentum', null, 'carteiras de fatores'], ['Regulatório', null, 'qualitativo'], ['Liquidez', null, 'volume diário']];
    wrap.appendChild(A.sec('Cobertura dos fatores', {hint: 'O que está mensurável hoje. “No motor” = entra nos cenários. “Série” = há dado importado para estimar.'}, A.table([{k: 'n', t: 'Fator', f: function (r) { return r[0]; }}, {k: 'm', t: 'No motor', f: function (r) { return r[1] ? 'sim' : h('span', {class: 'muted'}, r[0] === 'Regulatório' ? 'marcação qualitativa no cadastro' : r[0].indexOf('Size') === 0 ? 'marcação qualitativa (IUVL, USSC, WSML)' : 'não'); }, s: false}, {k: 's', t: 'Série', s: false, f: function (r) { return r[2] && A.SER[r[2]] ? A.chip('importada', 'o-obs') : A.na(null, r[2]); }}], fl)));
    return wrap;
  }

  /* ---------- concentração ---------- */
  function concentracao() {
    var v = A.versao(), P = A.prem(), ex = C.exposicoes(v, P.sens), wrap = h('div');
    var m = A.modelo(v);
    var rN = null; if (m.ok && m.S && m.suficiente) { var rc = Q.riskContrib(m.w, m.S); rN = 1 / C.sum(rc.pct, function (p) { return p * p; }); }
    wrap.appendChild(A.sec('Resumo', {mtd: 'concentracao'}, h('dl', {class: 'kv'},
      h('dt', null, 'Tickers investíveis'), h('dd', {class: 'num'}, ex.nTickers), h('dt', null, 'Número efetivo por peso'), h('dd', {class: 'num'}, ex.effN ? A.num(ex.effN, 1) : '—'),
      h('dt', null, 'HHI por peso'), h('dd', {class: 'num'}, ex.hhi ? A.num(ex.hhi, 3) : '—'), h('dt', null, 'Número efetivo por risco'), h('dd', null, rN ? A.num(rN, 1) : A.na(m.bloqueado ? 'versão inválida' : 'sem séries')))));
    var g = h('div', {class: 'grid2'});
    function bloco(t, o) { return A.sec(t, null, A.hbars(Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }).slice(0, 12).map(function (k) { return {label: k, v: o[k]}; }))); }
    var porAtivo = {}; (v.pos || []).forEach(function (x) { if (x.w > 0) porAtivo[x.t] = (porAtivo[x.t] || 0) + x.w; });
    g.append(bloco('Por ativo', porAtivo), bloco('Por setor', ex.porSetor), bloco('Por emissor ou grupo', ex.porEmissor), bloco('Por país', ex.porPais), bloco('Por status do instrumento', ex.porStatus), bloco('Por classe de risco', ex.porRisco));
    wrap.appendChild(g);
    return wrap;
  }

  /* ---------- premissas de sensibilidade ---------- */
  function premissas() {
    var P = A.prem(), sens = C.clone(P.sens), edit = {}, wrap = h('div');
    var ts = Object.keys(C.ATV).filter(function (t) { return C.ATV[t].status !== 'placeholder'; }).sort(function (a, b) { return (+C.ATV[a].pilar.slice(1) - +C.ATV[b].pilar.slice(1)) || (a < b ? -1 : 1); });
    var campos = {rf: [['f', 'Curva'], ['d', 'Duration'], ['conv', 'Convexidade'], ['s', 'Spread dur.']], acao: [['beta', 'β'], ['j', 'Juros resid.'], ['u', 'Dólar'], ['b', 'Brent']], fii: [['beta', 'β'], ['d', 'Dur. real']], rv: [['sp', 'S&P'], ['em', 'Emerg.'], ['btc', 'BTC']], nd: []};
    function linha(t) {
      var s = sens[t] || {m: 'nd'};
      var msel = h('select', {class: 'inp', onchange: function () { s = sens[t] = {m: msel.value, x: s.x}; if (msel.value === 'rf') Object.assign(s, {f: 'selic', d: 0, conv: null, s: 0}); edit[t] = 1; tb.redraw(); }}, [['rf', 'Renda fixa'], ['acao', 'Ação'], ['fii', 'FII'], ['rv', 'RV exterior'], ['nd', 'Sem sensibilidade']].map(function (o) { return h('option', {value: o[0], selected: s.m === o[0] || null}, o[1]); }));
      var cs = (campos[s.m] || []).map(function (c) {
        if (c[0] === 'f') { var fs = h('select', {class: 'inp', onchange: function () { s.f = fs.value; edit[t] = 1; }}, ['selic', 'pre', 'real', 'ust2', 'ust10'].map(function (k) { return h('option', {value: k, selected: s.f === k || null}, k); })); return h('label', {class: 'field'}, c[1], fs); }
        var e = h('input', {class: 'inp n', type: 'number', step: '0.1', value: s[c[0]] == null ? '' : s[c[0]], placeholder: c[0] === 'conv' ? '—' : '0', title: c[0] === 'conv' ? 'Convexidade não cadastrada: o motor usa só a duration (1ª ordem)' : null, onchange: function () { s[c[0]] = e.value === '' ? (c[0] === 'conv' ? null : 0) : Number(e.value); edit[t] = 1; }});
        return h('label', {class: 'field'}, c[1], e);
      });
      var xc = h('label', {class: 'field'}, 'Em USD', h('input', {type: 'checkbox', checked: s.x ? true : null, onchange: function (ev) { s.x = ev.target.checked ? 1 : 0; edit[t] = 1; }}));
      return h('div', {class: 'row', style: 'gap:8px'}, msel, cs, xc);
    }
    var rows = ts.map(function (t) { return {t: t, p: C.ATV[t].pilar}; });
    var tb = A.table([
      {k: 't', t: 'Ativo', f: function (r) { return h('span', null, h('b', null, r.t), h('div', {class: 'muted', style: 'font-size:.8rem'}, C.ATV[r.t].nome)); }}, {k: 'p', t: 'Pilar', s: function (r) { return +r.p.slice(1); }},
      {k: 's', t: 'Sensibilidade', s: false, f: function (r) { return linha(r.t); }},
      {k: 'o', t: 'Origem', s: false, f: function (r) { return A.ochip(P.origem[r.t] === 'gestor' ? 'gestor' : 'ia'); }}
    ], rows, {sort: 'p', dir: 1, search: 'Filtrar ativos'});
    wrap.appendChild(A.sec('Premissas de sensibilidade', {mtd: 'choques', hint: 'Valores iniciais são hipóteses geradas por IA, não estimativas estatísticas. Ao salvar, os ativos editados passam a “premissa do gestor” e a versão anterior fica arquivada. Duration é modificada (anos); juros residual, dólar e Brent das ações são % por p.p. ou por 1% além do β.',
      right: [h('button', {class: 'btn', onclick: estimar}, 'Estimar com séries'), h('button', {class: 'btn pri', onclick: async function () { var mud = {}; Object.keys(edit).forEach(function (t) { mud[t] = sens[t]; }); if (!Object.keys(mud).length) { A.toast('Nada mudou.'); return; } var cfg = STORE.get('config', 'premissas') || {}; await A.salvarPrem({sens: Object.assign({}, cfg.sens || {}, mud)}, 'sensibilidades: ' + Object.keys(mud).join(', ')); A.toast('Premissas salvas.'); A.render(); }}, 'Salvar premissas')], flush: true}, tb));
    return wrap;
  }
  // Estimação: MQO dos retornos mensais em reais das ações sobre Ibovespa, Δ DI (p.p.), dólar e Brent. Só grava como “estimada” com n ≥ 24.
  async function estimar() {
    var need = ['IBOV', 'DI', 'USDBRL', 'BRENT'].filter(function (k) { return !A.SER[k]; });
    if (need.length) { A.toast('Para estimar faltam as séries: ' + need.join(', ')); return; }
    var acoes = Object.keys(C.ATV).filter(function (t) { return C.ATV[t].classe === 'Ações' && C.ATV[t].moeda === 'BRL' && A.SER[t]; });
    var out = {}, rel = [];
    acoes.forEach(function (t) {
      var al = Q.alignPrices({T: A.SER[t].pts, IBOV: A.SER.IBOV.pts, DI: A.SER.DI.pts, USDBRL: A.SER.USDBRL.pts, BRENT: A.SER.BRENT.pts}, ['T', 'IBOV', 'DI', 'USDBRL', 'BRENT'], {freq: 'M'});
      if (!al || !al.ok) return;
      var y = [], X = [];
      for (var i = 1; i < al.P.length; i++) { var p0 = al.P[i - 1], p1 = al.P[i]; y.push((p1[0] / p0[0] - 1) * 100); X.push([(p1[1] / p0[1] - 1) * 100, p1[2] - p0[2], (p1[3] / p0[3] - 1) * 100, (p1[4] / p0[4] - 1) * 100]); }
      if (y.length < 24) { rel.push(t + ': ' + y.length + ' meses'); return; }
      var o = Q.ols(y, X, {intercept: true}); if (!o) return;
      out[t] = {beta: {v: o.coef[1], t: o.t[1], n: o.n, r2: o.r2}, j: {v: o.coef[2], t: o.t[2], n: o.n, r2: o.r2}, u: {v: o.coef[3], t: o.t[3], n: o.n, r2: o.r2}, b: {v: o.coef[4], t: o.t[4], n: o.n, r2: o.r2}};
    });
    if (!Object.keys(out).length) { A.toast('Nenhuma ação com 24 meses ou mais em comum com os fatores.'); return; }
    await A.salvarPrem({estimadas: out}, 'estimativas por regressão: ' + Object.keys(out).join(', '));
    A.toast('Estimadas ' + Object.keys(out).length + ' ações. As premissas usadas no motor não mudam sozinhas: revise e copie se fizer sentido.' + (rel.length ? ' Amostra curta: ' + rel.join('; ') : ''), 6000);
    A.render();
  }
})(APP, CORE);
