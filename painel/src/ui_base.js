/* APP — estado, utilidades de interface, gráficos e modelo de risco compartilhado. */
var APP = (function () {
  'use strict';
  var A = {};
  var C = CORE;

  /* ---------- DOM ---------- */
  function h(tag, a) {
    var e = document.createElement(tag), kids = Array.prototype.slice.call(arguments, 2);
    if (a) Object.keys(a).forEach(function (k) {
      var v = a[k]; if (v == null || v === false) return;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'style') e.style.cssText = v; else if (k === 'html') e.innerHTML = v; // só para HTML gerado aqui, nunca para conteúdo importado
      else if (v === true) e.setAttribute(k, ''); else e.setAttribute(k, v);
    });
    kids.forEach(function (k) { add(e, k); });
    return e;
  }
  function add(e, k) { if (k == null || k === false) return; if (Array.isArray(k)) { k.forEach(function (x) { add(e, x); }); return; } e.appendChild(typeof k === 'object' ? k : document.createTextNode(String(k))); }
  A.h = h;
  // Só links http(s) viram endereço clicável (um "javascript:" vindo de um feed nunca chega a um href)
  A.link = function (u) { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : null; };
  A.$ = function (s, r) { return (r || document).querySelector(s); };

  /* ---------- formatação ---------- */
  var L = 'pt-BR';
  A.pct = function (v, d) { if (v == null || !isFinite(v)) return '—'; d = d == null ? 1 : d; return (v * 100).toLocaleString(L, {minimumFractionDigits: d, maximumFractionDigits: d}) + '%'; };
  A.spct = function (v, d) { if (v == null || !isFinite(v)) return '—'; var s = A.pct(Math.abs(v), d); return (v > 5e-7 ? '+' : v < -5e-7 ? '−' : '') + s; };
  A.pp = function (v, d) { if (v == null || !isFinite(v)) return '—'; d = d == null ? 2 : d; var s = Math.abs(v * 100).toLocaleString(L, {minimumFractionDigits: d, maximumFractionDigits: d}); return (v > 5e-9 ? '+' : v < -5e-9 ? '−' : '') + s + ' p.p.'; };
  A.num = function (v, d) { if (v == null || !isFinite(v)) return '—'; d = d == null ? 2 : d; return v.toLocaleString(L, {minimumFractionDigits: d, maximumFractionDigits: d}); };
  A.snum = function (v, d) { if (v == null || !isFinite(v)) return '—'; return (v > 0 ? '+' : v < 0 ? '−' : '') + A.num(Math.abs(v), d); };
  A.dataBR = function (iso) { if (!iso) return '—'; var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso); };
  A.cls = function (v) { return v > 5e-7 ? 'up' : v < -5e-7 ? 'down' : ''; };
  A.na = function (motivo, falta) { return h('span', {class: 'na'}, 'Não disponível', motivo ? ' · ' + motivo : '', falta ? h('span', null, ' · ', h('b', null, 'falta: '), falta) : null); };
  A.chip = function (txt, cls, title) { return h('span', {class: 'chip ' + (cls || ''), title: title || null}, txt); };
  A.gchip = function (g) { var n = {critica: 'Crítico', alta: 'Alto', media: 'Médio', baixa: 'Baixo', info: 'Info'}[g] || g; return A.chip(n, 'g-' + g); };
  A.stchip = function (s) { var n = {placeholder: 'Placeholder de teste', aprovado: 'Aprovada', em_analise: 'Em análise', descontinuado: 'Descontinuada', proposta: 'Proposta'}[s] || s; return A.chip(n, 'st-' + s); };
  A.ochip = function (o) { var m = {q: ['Premissa', 'o-q', 'Sensibilidade qualitativa (premissa), não estimada estatisticamente'], e: ['Estimada', 'o-e', 'Estimada por regressão em séries importadas'], ia: ['Hipótese IA', 'o-ia', 'Valor inicial gerado por IA; revisar e aprovar'], obs: ['Observado', 'o-obs', 'Dado observado com fonte e data'], gestor: ['Premissa do gestor', 'o-gestor', 'Definida pelo gestor']}[o] || [o, '', '']; return A.chip(m[0], m[1], m[2]); };
  A.toast = function (msg, ms) { document.querySelectorAll('.toast').forEach(function (x) { x.remove(); }); var t = h('div', {class: 'toast', role: 'status'}, msg); document.body.appendChild(t); setTimeout(function () { t.remove(); }, ms || 3200); };
  // No claude.ai, arquivos passam pela confirmação do visualizador (capacidade downloads); no arquivo local, link direto.
  A.download = function (nome, conteudo, tipo) {
    if (STORE.downloads) { return STORE.downloads.save({filename: nome, data: conteudo}).then(function () {}, function (e) { if (e && e.code !== 'declined') A.toast(e.code === 'rate_limited' ? 'Já há um arquivo aguardando confirmação.' : 'Não foi possível oferecer o arquivo aqui.'); }); }
    if (window.claude && window.claude.use && STORE.mode === 'db') { A.toast('Baixar arquivos não está disponível nesta visualização.'); return; }
    var b = new Blob([conteudo], {type: tipo || 'text/plain;charset=utf-8'}); var u = URL.createObjectURL(b); var a = h('a', {href: u, download: nome}); document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 500);
  };
  A.csv = function (rows) { return rows.map(function (r) { return r.map(function (c) { var s = c == null ? '' : String(c); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';'); }).join('\n'); };

  /* ---------- tabela ordenável e pesquisável ---------- */
  // cols: [{k, t, r(bool right), f(row)→node|string, s(row)→sortValue}], rows: array
  A.table = function (cols, rows, opt) {
    opt = opt || {};
    var state = {k: opt.sort || null, dir: opt.dir || -1, q: ''};
    var wrap = h('div', {class: 'tw'}), tb = h('tbody'), search = null;
    if (opt.search) { search = h('input', {class: 'inp search', type: 'search', placeholder: opt.search, 'aria-label': opt.search, oninput: function () { state.q = search.value.toLowerCase(); draw(); }}); }
    var thead = h('thead', null, h('tr', null, cols.map(function (c) {
      var th = h('th', {class: (c.r ? 'r ' : '') + (c.s !== false ? 's' : ''), scope: 'col', title: c.title || null}, c.t);
      if (c.s !== false) th.addEventListener('click', function () { state.dir = state.k === c.k ? -state.dir : -1; state.k = c.k; draw(); });
      return th;
    })));
    var table = h('table', {class: 't'}, thead, tb);
    if (opt.foot) table.appendChild(h('tfoot', null, opt.foot));
    function sv(c, r) { return c.s ? c.s(r) : r[c.k]; }
    function draw() {
      var rs = rows.slice();
      if (state.q) rs = rs.filter(function (r) { return JSON.stringify(r).toLowerCase().indexOf(state.q) >= 0; });
      if (state.k) { var c = cols.filter(function (x) { return x.k === state.k; })[0] || {k: state.k}; rs.sort(function (a, b) { var x = sv(c, a), y = sv(c, b); if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * state.dir; }); }
      tb.replaceChildren.apply(tb, rs.map(function (r) {
        if (r.__grp) return h('tr', {class: 'grp'}, h('td', {colspan: cols.length}, r.__grp));
        var tr = h('tr', {class: opt.rowClass ? opt.rowClass(r) : null}, cols.map(function (c) { var v = c.f ? c.f(r) : r[c.k]; return h('td', {class: (c.r ? 'r num' : '') + (c.cls ? ' ' + c.cls : '')}, v == null ? '—' : v); }));
        if (opt.onRow) { tr.style.cursor = 'pointer'; tr.addEventListener('click', function (ev) { if (ev.target.closest('input,select,button,a')) return; opt.onRow(r, tr); }); }
        return tr;
      }));
      if (!rs.length) tb.appendChild(h('tr', null, h('td', {colspan: cols.length, class: 'empty'}, opt.empty || 'Nada para mostrar.')));
    }
    draw();
    if (search) wrap.appendChild(search);
    wrap.appendChild(table);
    wrap.redraw = draw;
    return wrap;
  };

  /* ---------- seção ---------- */
  A.sec = function (titulo, opts, body) {
    opts = opts || {};
    var hd = h('header', null, h('h2', null, titulo), opts.badge || null, opts.mtd ? A.ibtn(opts.mtd) : null, opts.right ? h('div', {class: 'right row'}, opts.right) : null);
    return h('section', {class: 'sec', id: opts.id || null}, hd, opts.hint ? h('div', {class: 'body', style: 'padding-bottom:0'}, h('p', {class: 'hint'}, opts.hint)) : null, h('div', {class: 'body' + (opts.flush ? ' flush' : '')}, body), opts.more || null);
  };
  A.more = function (label, body, open) { return h('details', {class: 'x', open: open || null}, h('summary', null, label), h('div', {class: 'body'}, body)); };

  /* ---------- gráficos SVG ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  function s(tag, at, p) { var e = document.createElementNS(NS, tag); for (var k in at) if (at[k] != null) e.setAttribute(k, at[k]); if (p) p.appendChild(e); return e; }
  A.svg = s;
  function measure(svg, arr, cls) { var t = s('text', {class: cls, x: -999, y: -999}, svg), w = 0; arr.forEach(function (x) { t.textContent = x; w = Math.max(w, t.getComputedTextLength() || String(x).length * 7); }); t.remove(); return Math.ceil(w); }
  function tip(host) { var tp = host.querySelector('.tip'); if (!tp) { tp = h('div', {class: 'tip'}); host.appendChild(tp); } return {show: function (ev, lines) { tp.replaceChildren.apply(tp, lines.filter(Boolean).map(function (l, i) { return h(i ? 'div' : 'b', null, l); })); tp.style.opacity = 1; var b = host.getBoundingClientRect(); var x = ev.clientX - b.left + 12, y = ev.clientY - b.top + 12; if (x + tp.offsetWidth > host.clientWidth) x = Math.max(0, x - tp.offsetWidth - 24); tp.style.left = x + 'px'; tp.style.top = y + 'px'; }, hide: function () { tp.style.opacity = 0; }}; }
  // Barras horizontais. rows [{label, v, sub?, color?, tip?:[...] }], opt {fmt, signed, rh}
  A.hbars = function (rows, opt) {
    opt = opt || {}; if (!rows || !rows.length) return h('p', {class: 'empty'}, opt.vazio || 'Nada nesta versão.'); var host = h('div', {class: 'chart'});
    function draw() {
      host.replaceChildren();
      var W = Math.max(280, host.clientWidth || 560), rh = opt.rh || 26, H = rows.length * rh + 6;
      var svg = s('svg', {viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opt.aria || 'gráfico de barras'}); host.appendChild(svg);
      var fmt = opt.fmt || A.pct, lw = Math.min(W * 0.42, measure(svg, rows.map(function (r) { return r.label; }), 'lab') + 10), vw = measure(svg, rows.map(function (r) { return fmt(r.v); }), 'val') + 8;
      var vals = rows.map(function (r) { return r.v || 0; }).concat(rows.filter(function (r) { return r.ghost != null && isFinite(r.ghost); }).map(function (r) { return r.ghost; })), lo = Math.min(0, Math.min.apply(null, vals.concat([0]))), hi = Math.max(0, Math.max.apply(null, vals.concat([1e-9])));
      if (opt.max != null) hi = Math.max(hi, opt.max);
      var x0 = lw + (lo < 0 ? vw : 0), x1 = W - vw - 2, sc = function (v) { return x0 + (v - lo) / ((hi - lo) || 1) * (x1 - x0); };
      var tp = tip(host);
      rows.forEach(function (r, i) {
        var g = s('g', {transform: 'translate(0,' + (i * rh + 3) + ')'}, svg);
        s('rect', {x: 0, y: 0, width: W, height: rh, fill: 'transparent'}, g);
        var lt = s('text', {class: 'lab', x: 0, y: rh / 2, dy: '.35em'}, g); lt.textContent = r.label;
        var v = r.v || 0, a = sc(Math.min(0, v)), b = sc(Math.max(0, v));
        var bar = s('rect', {x: a, y: rh / 2 - 7, width: Math.max(1.5, b - a), height: 14, rx: 2}, g);
        bar.style.fill = r.color || (opt.signed ? (v >= 0 ? 'var(--up)' : 'var(--down)') : 'var(--blue)');
        if (r.ghost != null) { var gx = sc(r.ghost); var ln = s('line', {x1: gx, x2: gx, y1: 3, y2: rh - 3, 'stroke-width': 2}, g); ln.style.stroke = 'var(--ink)'; }
        var vt = s('text', {class: 'val', x: v < 0 ? a - 5 : b + 5, y: rh / 2, dy: '.35em', 'text-anchor': v < 0 ? 'end' : 'start'}, g); vt.textContent = fmt(r.v);
        if (r.tip) { g.addEventListener('pointermove', function (ev) { tp.show(ev, r.tip); }); g.addEventListener('pointerleave', tp.hide); }
      });
      if (lo < 0) s('line', {class: 'ax', x1: sc(0), x2: sc(0), y1: 0, y2: H}, svg);
    }
    A.later(host, draw); return host;
  };
  // Mapa de calor: m[i][j] (null = sem dado), opt {fmt, diverging, lo, hi, rowLabels, colLabels, tip(i,j)}
  A.heat = function (m, rl, cl, opt) {
    opt = opt || {}; var host = h('div', {class: 'chart'});
    function color(v) {
      if (v == null || !isFinite(v)) return 'var(--row)';
      if (opt.diverging) { var t = Math.max(-1, Math.min(1, v / (opt.hi || 1))); return t >= 0 ? 'color-mix(in srgb, var(--down) ' + Math.round(t * 85) + '%, var(--panel))' : 'color-mix(in srgb, var(--blue) ' + Math.round(-t * 85) + '%, var(--panel))'; }
      var u = Math.max(0, Math.min(1, (v - (opt.lo || 0)) / ((opt.hi || 1) - (opt.lo || 0)))); return 'color-mix(in srgb, var(--blue) ' + Math.round(u * 90) + '%, var(--panel))';
    }
    function draw() {
      host.replaceChildren();
      var W = Math.max(320, host.clientWidth || 700), svg0 = s('svg', {}); host.appendChild(svg0);
      var lw = measure(svg0, rl, 'lab') + 10, th = Math.min(120, measure(svg0, cl, 'lab') * 0.75 + 16); svg0.remove();
      var cw = Math.max(26, Math.min(64, (W - lw) / cl.length)), ch = opt.ch || 24, H = th + rl.length * ch + 4, WW = lw + cw * cl.length;
      var svg = s('svg', {viewBox: '0 0 ' + Math.max(WW, W) + ' ' + H, role: 'img', 'aria-label': opt.aria || 'mapa de calor'}); host.appendChild(svg);
      var tp = tip(host);
      cl.forEach(function (c, j) { var t = s('text', {class: 'lab', x: 0, y: 0, transform: 'translate(' + (lw + j * cw + cw / 2 + 4) + ',' + (th - 4) + ') rotate(-50)'}, svg); t.textContent = c; });
      rl.forEach(function (r, i) {
        var t = s('text', {class: 'lab', x: lw - 6, y: th + i * ch + ch / 2, dy: '.35em', 'text-anchor': 'end'}, svg); t.textContent = r;
        cl.forEach(function (c, j) {
          var v = m[i][j], g = s('g', null, svg);
          var rc = s('rect', {x: lw + j * cw + 1, y: th + i * ch + 1, width: cw - 2, height: ch - 2, rx: 2}, g); rc.style.fill = color(v);
          if (opt.fmt && cw >= 34) { var vt = s('text', {class: 'val', x: lw + j * cw + cw / 2, y: th + i * ch + ch / 2, dy: '.35em', 'text-anchor': 'middle'}, g); vt.textContent = v == null ? '' : opt.fmt(v); vt.style.fontSize = '11px'; if (v != null && Math.abs(v) > (opt.hi || 1) * 0.6) vt.style.fill = '#fff'; }
          g.addEventListener('pointermove', function (ev) { tp.show(ev, opt.tip ? opt.tip(i, j) : [r + ' × ' + c, v == null ? 'sem dado' : (opt.fmt || A.num)(v)]); });
          g.addEventListener('pointerleave', tp.hide);
        });
      });
    }
    A.later(host, draw); return host;
  };
  // Linhas no tempo: series [{name, pts:[[isoDate, y]], color}], opt {fmt, zero}
  A.lines = function (series, opt) {
    opt = opt || {}; var host = h('div', {class: 'chart'});
    var COLS = ['var(--blue)', 'var(--down)', 'var(--up)', '#7A5AF8', '#B7791F', '#5B6470'];
    function draw() {
      host.replaceChildren();
      var W = Math.max(300, host.clientWidth || 640), H = opt.h || 220, pl = 54, pr = 10, pt = 10, pb = 26;
      var all = []; series.forEach(function (se) { se.pts.forEach(function (p) { if (p[1] != null && isFinite(p[1])) all.push(p); }); });
      if (!all.length) { host.appendChild(h('div', {class: 'empty'}, 'Sem dados para o gráfico.')); return; }
      var t = function (d) { return Date.parse(d); }, xs = all.map(function (p) { return t(p[0]); }), ys = all.map(function (p) { return p[1]; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys.concat(opt.zero ? [0] : [])), y1 = Math.max.apply(null, ys.concat(opt.zero ? [0] : []));
      if (y1 === y0) { y1 += 1e-6; y0 -= 1e-6; }
      var sx = function (v) { return pl + (v - x0) / ((x1 - x0) || 1) * (W - pl - pr); }, sy = function (v) { return pt + (1 - (v - y0) / (y1 - y0)) * (H - pt - pb); };
      var svg = s('svg', {viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opt.aria || 'gráfico de linhas'}); host.appendChild(svg);
      for (var k = 0; k <= 4; k++) { var yv = y0 + (y1 - y0) * k / 4; s('line', {class: 'grid', x1: pl, x2: W - pr, y1: sy(yv), y2: sy(yv)}, svg); var tt = s('text', {x: pl - 6, y: sy(yv), dy: '.35em', 'text-anchor': 'end'}, svg); tt.textContent = (opt.fmt || A.pct)(yv); }
      var d0 = new Date(x0), d1 = new Date(x1); [[x0, d0], [x1, d1]].forEach(function (q, i) { var tx = s('text', {x: sx(q[0]), y: H - 8, 'text-anchor': i ? 'end' : 'start'}, svg); tx.textContent = A.dataBR(q[1].toISOString().slice(0, 10)); });
      if (y0 < 0 && y1 > 0) s('line', {class: 'ax', x1: pl, x2: W - pr, y1: sy(0), y2: sy(0)}, svg);
      series.forEach(function (se, i) {
        var d = '', pen = false; se.pts.forEach(function (p) { if (p[1] == null || !isFinite(p[1])) { pen = false; return; } d += (pen ? 'L' : 'M') + sx(t(p[0])).toFixed(1) + ',' + sy(p[1]).toFixed(1); pen = true; });
        var path = s('path', {d: d, fill: 'none', 'stroke-width': 1.8}, svg); path.style.stroke = se.color || COLS[i % COLS.length];
      });
      var tp = tip(host), ov = s('rect', {x: pl, y: pt, width: W - pl - pr, height: H - pt - pb, fill: 'transparent'}, svg);
      ov.addEventListener('pointermove', function (ev) { var b = svg.getBoundingClientRect(); var xv = x0 + ((ev.clientX - b.left) * W / b.width - pl) / (W - pl - pr) * (x1 - x0); var lines = []; series.forEach(function (se) { var best = null, bd = Infinity; se.pts.forEach(function (p) { var dd = Math.abs(t(p[0]) - xv); if (dd < bd) { bd = dd; best = p; } }); if (best) { if (!lines.length) lines.push(A.dataBR(best[0])); lines.push(se.name + ': ' + (opt.fmt || A.pct)(best[1])); } }); tp.show(ev, lines); });
      ov.addEventListener('pointerleave', tp.hide);
    }
    var lg = series.length > 1 ? h('div', {class: 'legend'}, series.map(function (se, i) { return h('span', null, h('i', {style: 'background:' + (se.color || COLS[i % COLS.length])}), se.name); })) : null;
    A.later(host, draw); return h('div', null, lg, host);
  };
  /* ---------- cores do painel original ---------- */
  A.PC = {P1: '#8DB8FA', P2: '#4E93F7', P3: '#0D6EFD', P4: '#0A4FB8', P5: '#1D8C0F', P6: '#73C35A', P7: '#FFB22B', P8: '#ADB5BD', P9: '#6F42C1', P10: '#B095E3', P11: '#0B9AB8', P12: '#6DD3E8', P13: '#D63384'};
  A.CC = {'Renda fixa Brasil': '#0D6EFD', 'Ações Brasil': '#1D8C0F', 'FIIs': '#FFB22B', 'Renda fixa internacional': '#6F42C1', 'Ações internacionais': '#0B9AB8', 'Alternativos': '#D63384'};
  A.FAMC = {'Brasil Crescimento': '#1D8C0F', 'Brasil Renda': '#FFB22B', 'Internacional': '#0B9AB8', 'Alternativo': '#D63384'};
  A.corPilar = function (p) { return A.PC[p] || '#ADB5BD'; };

  // setor anular (ângulos em voltas: 0 = topo, 1 = volta completa)
  function arco(cx, cy, r0, r1, a0, a1) {
    if (a1 - a0 >= 0.9999) a1 = a0 + 0.9999;
    var p = function (r, a) { var t = 2 * Math.PI * a - Math.PI / 2; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; }, big = a1 - a0 > 0.5 ? 1 : 0;
    var A0 = p(r1, a0), A1 = p(r1, a1), B1 = p(r0, a1), B0 = p(r0, a0);
    return 'M' + A0[0].toFixed(2) + ',' + A0[1].toFixed(2) + 'A' + r1 + ',' + r1 + ' 0 ' + big + ' 1 ' + A1[0].toFixed(2) + ',' + A1[1].toFixed(2) +
      'L' + B1[0].toFixed(2) + ',' + B1[1].toFixed(2) + 'A' + r0 + ',' + r0 + ' 0 ' + big + ' 0 ' + B0[0].toFixed(2) + ',' + B0[1].toFixed(2) + 'Z';
  }
  A.arco = arco;
  // Rosca de uma carteira: segs [{v (fração da carteira), cor, rot}]. Nunca normaliza: o que passa de 100% vai para um
  // anel externo vermelho; o que falta para 100% fica em cinza.
  A.rosca = function (segs, centro, sub) {
    var svg = s('svg', {viewBox: '0 0 80 80', role: 'img', 'aria-label': (centro || '') + ' ' + (sub || '')}), acc = 0;
    s('circle', {cx: 40, cy: 40, r: 30.5, fill: 'none', 'stroke-width': 11}, svg).style.stroke = 'var(--row)';
    segs.forEach(function (g) {
      var v = Math.max(0, g.v || 0); if (!v) return;
      var a0 = acc, a1 = acc + v; acc = a1;
      if (a0 < 1) { var e = s('path', {d: arco(40, 40, 25, 36, a0, Math.min(1, a1))}, svg); e.style.fill = g.cor; e.style.stroke = 'var(--panel)'; e.style.strokeWidth = '0.6'; s('title', {}, e).textContent = (g.rot || '') + ' ' + A.pct(v, 1); }
      if (a1 > 1) { var o = s('path', {d: arco(40, 40, 37, 40, Math.max(0, a0 - 1), a1 - 1)}, svg); o.style.fill = 'var(--down)'; s('title', {}, o).textContent = 'Acima de 100%: ' + (g.rot || '') + ' ' + A.pct(a1 - Math.max(1, a0), 1); }
    });
    if (centro != null) { var t = s('text', {x: 40, y: sub ? 41 : 45, 'text-anchor': 'middle'}, svg); t.textContent = centro; }
    if (sub) { var t2 = s('text', {x: 40, y: 51, 'text-anchor': 'middle', class: 's'}, svg); t2.textContent = sub; }
    return svg;
  };
  // Sol de camadas (classe → pilar → ativo). nodes: [{rot, v, cor, filhos:[...]}]. Os ângulos usam o peso sobre 100%;
  // se a carteira passa de 100%, o centro diz quanto e a escala é a soma (o desenho mostra a composição, o número mostra o erro).
  A.sunburst = function (nodes, opt) {
    opt = opt || {}; var host = h('div', {class: 'chart sb'});
    function draw() {
      host.replaceChildren();
      var svg = s('svg', {viewBox: '0 0 300 300', role: 'img', 'aria-label': opt.aria || 'composição em camadas'}); host.appendChild(svg);
      var tot = 0; nodes.forEach(function (n) { tot += n.v || 0; }); var esc = Math.max(1, tot), tp = tip(host);
      var R = [[46, 86], [88, 118], [120, 148]];
      function ring(list, nivel, a0) {
        var acc = a0;
        list.forEach(function (n) {
          var f = (n.v || 0) / esc; if (f <= 0) return;
          var e = s('path', {d: arco(150, 150, R[nivel][0], R[nivel][1], acc, acc + f)}, svg); e.style.fill = n.cor || 'var(--line2)';
          if (nivel === 2) e.style.opacity = '.85';
          e.addEventListener('pointermove', function (ev) { tp.show(ev, [n.rot, A.pct(n.v, 1) + ' da carteira'].concat(n.extra || [])); });
          e.addEventListener('pointerleave', tp.hide);
          if (n.on) e.addEventListener('click', function () { n.on(); });
          if (f > (nivel === 2 ? 0.035 : 0.05)) {
            var mid = acc + f / 2, t = 2 * Math.PI * mid - Math.PI / 2, rr = (R[nivel][0] + R[nivel][1]) / 2, deg = mid * 360 - 90, flip = mid > 0.5;
            var tx = s('text', {x: 0, y: 0, 'text-anchor': 'middle', dy: '.35em', transform: 'translate(' + (150 + rr * Math.cos(t)).toFixed(1) + ',' + (150 + rr * Math.sin(t)).toFixed(1) + ') rotate(' + (nivel === 0 ? 0 : (flip ? deg + 180 : deg)).toFixed(1) + ')'}, svg);
            tx.textContent = n.curto || n.rot;
          }
          if (n.filhos) ring(n.filhos, nivel + 1, acc);
          acc += f;
        });
      }
      ring(nodes, 0, 0);
      var c = s('text', {x: 150, y: 150, 'text-anchor': 'middle', class: 'c'}, svg); c.textContent = A.pct(tot, 0);
      var cs = s('text', {x: 150, y: 166, 'text-anchor': 'middle', class: 'cs'}, svg); cs.textContent = opt.centro || 'da carteira';
      if (tot > 1.0005) c.style.fill = 'var(--down)';
    }
    A.later(host, draw); return host;
  };
  // Minigráfico de linha (tendência) sem eixos
  A.spark = function (pts, cor) {
    if (!pts || pts.length < 3) return null;
    var svg = s('svg', {class: 'spark', viewBox: '0 0 100 26', preserveAspectRatio: 'none', 'aria-hidden': 'true'});
    var ys = pts.map(function (p) { return p[1]; }), lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys); if (hi === lo) { hi += 1e-9; lo -= 1e-9; }
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + (i / (pts.length - 1) * 100).toFixed(2) + ',' + (2 + (1 - (p[1] - lo) / (hi - lo)) * 22).toFixed(2); }).join('');
    var e = s('path', {d: d, fill: 'none', 'stroke-width': 1.4, 'vector-effect': 'non-scaling-stroke'}, svg); e.style.stroke = cor || 'var(--ink2)';
    return svg;
  };

  /* ---------- busca rápida ( / ou Ctrl+K ) ---------- */
  A.busca = function () {
    if (document.querySelector('.cmdk-bg')) return;
    var itens = [];
    A.AREAS.forEach(function (a) { itens.push({t: a[1], d: 'seção', go: function () { A.go(a[0]); }}); (A.SUBS[a[0]] || []).forEach(function (x) { itens.push({t: a[1] + ' › ' + x[1], d: 'seção', go: function () { A.go(a[0], x[0]); }}); }); });
    (A.SUBS.cart || []).forEach(function (x) { itens.push({t: 'Oregon › Carteiras › ' + x[1], d: 'seção', go: function () { A.go('cart', x[0]); }}); });
    var refIds = A.REF.map(function (r) { return r[0]; });
    C.CARTS.forEach(function (m) { var ref = refIds.indexOf(m.id) >= 0; itens.push({t: m.rotulo, d: 'carteira · ' + m.familia + (ref ? ' · referência' : ''), go: function () { S.cart = m.id; S.ver = 'aprovada'; A.go('cart', ref ? 'ref' : 'carteira'); }}); });
    Object.keys(C.ATV).forEach(function (t) { var a = C.ATV[t]; if (a.status === 'placeholder') return; var etf = A.ehETF && A.ehETF(t); itens.push({t: t + ' · ' + (a.nome || ''), d: (a.tipo || '') + (etf ? ' · ficha do ETF' : A.temTese && A.temTese(t) ? ' · tese' : ''), go: function () { A.abrirFicha ? A.abrirFicha(t) : A.abrirTese(t); }}); });
    if (A.itens) A.itens().slice(0, 400).forEach(function (x) { itens.push({t: x.titulo, d: 'conteúdo · ' + (x.organizacao || x.fonte || '') + (x.publicado_em ? ' · ' + A.dataBR(x.publicado_em) : ''), go: function () { A.abrirItem(x); }}); });
    if (typeof INTEL !== 'undefined') Object.keys(INTEL.TX.temas || {}).forEach(function (k) { itens.push({t: INTEL.temaNome(k), d: 'assunto', go: function () { A.go('bib', 'busca'); A.bibFiltro({tema: k}); }}); });
    var inp = h('input', {type: 'search', placeholder: 'Conteúdo, assunto, ativo, carteira ou seção (ex.: juro real, Oaktree, PRIO3, Arrojado)', 'aria-label': 'Buscar'}), ul = h('ul', {role: 'listbox'}), sel = 0, vis = [];
    var bg = h('div', {class: 'cmdk-bg', onclick: function (e) { if (e.target === bg) fechar(); }}, h('div', {class: 'cmdk', role: 'dialog', 'aria-label': 'Busca rápida'}, inp, ul));
    function norm(x) { return String(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function draw() {
      var q = norm(inp.value.trim()); vis = (q ? itens.filter(function (it) { return norm(it.t + ' ' + it.d).indexOf(q) >= 0; }) : itens.filter(function (it) { return it.d === 'seção' || it.d.indexOf('carteira') === 0; })).slice(0, 40);
      sel = Math.min(sel, Math.max(0, vis.length - 1));
      ul.replaceChildren.apply(ul, vis.length ? vis.map(function (it, i) { return h('li', {role: 'option', 'aria-selected': i === sel ? 'true' : 'false', onclick: function () { fechar(); it.go(); }}, h('span', null, it.t), h('small', null, it.d)); }) : [h('li', null, h('span', {class: 'muted'}, 'Nada encontrado.'))]);
    }
    function fechar() { bg.remove(); }
    inp.addEventListener('input', function () { sel = 0; draw(); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { sel = Math.min(vis.length - 1, sel + 1); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
      else if (e.key === 'Enter' && vis[sel]) { e.preventDefault(); var it = vis[sel]; fechar(); setTimeout(function () { it.go(); }, 0); }
      else if (e.key === 'Escape') fechar();
    });
    document.body.appendChild(bg); draw(); inp.focus();
  };
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag) && !(e.target && e.target.isContentEditable))) { e.preventDefault(); A.busca(); }
  });

  var pend = [];
  A.later = function (host, draw) { pend.push([host, draw]); host.__draw = draw; };
  A.flush = function () { var p = pend; pend = []; requestAnimationFrame(function () { p.forEach(function (x) { if (x[0].isConnected) x[1](); }); }); };
  var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { document.querySelectorAll('.chart').forEach(function (c) { if (c.__draw) c.__draw(); }); }, 150); });

  /* ---------- estado ---------- */
  var SK = 'oregon-intel-v3:ui';
  var SUB0 = {hoje: 'briefing', brasil: 'ativos', mundo: 'agora', cart: 'ref', bib: 'busca'};
  // Carteiras de referência do modo simples: versões aprovadas da família Brasil Crescimento (uma linha para trocar)
  A.REF = [['cresc-cons', 'Conservador'], ['cresc-arr', 'Arrojado']];
  var S = {area: 'hoje', sub: Object.assign({}, SUB0), cart: A.REF[0][0], ver: 'aprovada', choques: {}, idio: {}, janela: 36, metodo: 'pearson'};
  try {
    var saved = JSON.parse(localStorage.getItem(SK) || '{}'); Object.assign(S, saved); S.sub = Object.assign({}, SUB0, saved.sub || {});
    if (['hoje', 'brasil', 'mundo', 'cart', 'bib'].indexOf(S.area) < 0) S.area = 'hoje';
  } catch (e) {}
  A.S = S;
  A.save = function () { try { localStorage.setItem(SK, JSON.stringify({area: S.area, sub: S.sub, cart: S.cart, ver: S.ver, janela: S.janela, metodo: S.metodo, choques: S.choques, idio: S.idio, cenEvento: S.cenEvento})); } catch (e) {} };

  /* ---------- premissas (sensibilidades, retornos esperados, cenários de tese, limites) ---------- */
  A.prem = function () {
    var cfg = STORE.get('config', 'premissas') || {};
    var sens = C.clone(C.D.sens), org = {};
    Object.keys(sens).forEach(function (t) { org[t] = 'ia'; });
    // Premissas salvas pela Sala anterior (formato {prem}): só valem as que diferem da hipótese inicial e nunca
    // reabrem risco zero para ativos sem sensibilidade (fundos privados, crédito sem cadastro, placeholders).
    if (cfg.prem && !cfg.sens) Object.keys(cfg.prem).forEach(function (t) {
      var o = cfg.prem[t], d = C.D.sens[t]; if (!o || typeof o !== 'object' || !d || d.m === 'nd' || !C.ATV[t] || C.ATV[t].status === 'placeholder') return;
      var dif = ['m', 'f', 'd', 's', 'x', 'beta', 'j', 'u', 'b', 'sp', 'em', 'btc'].some(function (k) { return o[k] != null && Number(o[k]) !== Number(d[k]) && String(o[k]) !== String(d[k]); });
      if (dif) { sens[t] = Object.assign({}, d, o, {conv: d.conv}); org[t] = 'gestor'; }
    });
    Object.keys(cfg.sens || {}).forEach(function (t) { sens[t] = cfg.sens[t]; org[t] = 'gestor'; });
    var est = cfg.estimadas || {}, niv = C.clone(C.D.niveis);
    Object.keys(cfg.niveis || {}).forEach(function (k) { var n = cfg.niveis[k]; if (niv[k] && n && isFinite(Number(n.v))) niv[k] = Object.assign({}, niv[k], {v: Number(n.v)}, n.fonte ? {fonte: n.fonte} : {}, n.data ? {data: n.data} : {}); });
    return {sens: sens, origem: org, er: cfg.er || {}, cen: cfg.cen || {}, limites: cfg.limites || {}, niveis: niv, estimadas: est, salvo: cfg.salvo || null};
  };
  A.salvarPrem = async function (patch, nota) {
    var cfg = C.clone(STORE.get('config', 'premissas') || {});
    var anterior = C.clone(cfg); Object.assign(cfg, patch); cfg.salvo = STORE.now();
    await STORE.put('versoes', STORE.newId('vp'), {tipo: 'premissas', quando: STORE.now(), conteudo: anterior, nota: nota || ''});
    await STORE.put('config', 'premissas', cfg);
    await STORE.audit('premissas salvas', nota || Object.keys(patch).join(', '));
  };

  /* ---------- séries e contexto ---------- */
  A.SER = {};
  A.ctx = function () {
    var ser = {}; Object.keys(A.SER).forEach(function (k) { ser[k] = true; });
    Object.keys(C.ATV).forEach(function (t) { var p = C.ATV[t].proxy_us; if (!ser[t] && p && A.SER[p]) ser[t] = true; });
    var P = A.prem();
    return {series: ser, limites: P.limites, sens: P.sens, liquidez: !!A.TAB.liquidez};
  };
  A.TAB = {};

  /* ---------- versões ---------- */
  A.versoes = function (cart) {
    var out = [{id: 'aprovada', rotulo: STORE.get('aprovadas', cart) ? 'Aprovada (última aprovação registrada)' : 'Aprovada · Comitê 05/11/2026'}];
    C.D.historicas.forEach(function (hh) { out.push({id: 'hist:' + hh.id, rotulo: 'Histórica · ' + hh.rotulo}); });
    STORE.list('versoes').filter(function (v) { return v.cart === cart && v.pos; }).forEach(function (v) { out.push({id: 'arq:' + v.id, rotulo: 'Histórica · ' + v.rotulo + ' (até ' + A.dataBR(v.vigente_ate) + ')'}); });
    STORE.propostas(cart).forEach(function (p) { out.push({id: 'prop:' + p.id, rotulo: 'Proposta · ' + p.nome + ' (' + p.status + ')'}); });
    if (A.TAB.efetiva && A.TAB.efetiva[cart]) out.push({id: 'efetiva', rotulo: 'Efetiva (importada)'});
    return out;
  };
  A.versao = function (id, cart) {
    cart = cart || S.cart; id = id || S.ver;
    if (id === 'aprovada') return STORE.aprovadaVigente(C, cart);
    if (id.indexOf('hist:') === 0) return C.historica(id.slice(5), cart);
    if (id.indexOf('arq:') === 0) { var v = STORE.get('versoes', id.slice(4)); return v ? {kind: 'historica', id: v.id, cart: cart, rotulo: v.rotulo, data: v.vigente_ate, fonte: v.fonte, pos: C.clone(v.pos), alvo: null, bandas: C.estrategica(cart).bandas} : null; }
    if (id.indexOf('prop:') === 0) { var p = STORE.get('propostas', id.slice(5)); return p ? A.propVersao(p) : null; }
    if (id === 'efetiva') { var e = A.TAB.efetiva && A.TAB.efetiva[cart]; return e ? {kind: 'efetiva', id: 'efetiva', cart: cart, rotulo: 'Efetiva · ' + (e.data || 'importada'), data: e.data, fonte: e.arquivo, pos: C.clone(e.pos), alvo: null, bandas: C.estrategica(cart).bandas, caixaDeliberado: false} : null; }
    return STORE.aprovadaVigente(C, cart);
  };
  A.propVersao = function (p) { return {kind: 'proposta', id: p.id, cart: p.cart, rotulo: 'Proposta · ' + p.nome, data: p.criado, fonte: 'proposta ' + p.status, pos: C.clone(p.pos), alvo: null, bandas: C.estrategica(p.cart).bandas, caixaDeliberado: !!p.caixaDeliberado, prop: p}; };
  A.irmaos = function () { var o = {}; C.CARTS.forEach(function (m) { o[m.id] = STORE.aprovadaVigente(C, m.id); }); return o; };
  A.valida = function (v) { var ctx = A.ctx(); ctx.irmaos = A.irmaos(); return C.validate(v, ctx); };

  /* ---------- modelo de risco estatístico (usa séries importadas) ----------
     Retornos simples na frequência comum; ativos em USD convertidos para BRL com a série USDBRL:
     r_BRL = (1 + r_USD)(1 + r_câmbio) − 1. Amostra listwise (todas as séries na mesma data).
     Pesos como estão (sem normalizar). Ativos sem série ficam fora e são listados. */
  A.serieDe = function (t) { if (A.SER[t]) return {id: t, proxy: false}; var p = C.ATV[t] && C.ATV[t].proxy_us; if (p && A.SER[p]) return {id: p, proxy: true}; return null; };
  // Chave do período (mesma lógica do alinhamento: mês civil, semana ISO ou dia)
  A.chave = function (d, f) {
    if (f === 'M') return d.slice(0, 7);
    if (f === 'W') { var dt = new Date(d + 'T00:00:00Z'), day = (dt.getUTCDay() + 6) % 7; dt.setUTCDate(dt.getUTCDate() - day + 3); var y = dt.getUTCFullYear(), j1 = new Date(Date.UTC(y, 0, 4)); return y + '-W' + Math.round(((dt - j1) / 864e5 - 3 + ((j1.getUTCDay() + 6) % 7)) / 7 + 1); }
    return d;
  };
  // Retornos de uma série externa (benchmark, CDI) nos mesmos intervalos do modelo; null onde faltar dado.
  // Não entra no alinhamento comum, para não encurtar a amostra da carteira.
  A.retExtra = function (id, dates0, freq) {
    if (!A.SER[id]) return null;
    var m = {}; Q.resample(A.SER[id].pts, freq).forEach(function (p) { m[A.chave(p[0], freq)] = p[1]; });
    var out = []; for (var t = 1; t < dates0.length; t++) { var a = m[A.chave(dates0[t - 1], freq)], b = m[A.chave(dates0[t], freq)]; out.push(a != null && b != null && a !== 0 ? b / a - 1 : null); }
    return out;
  };
  A.pares = function (x, y) { var a = [], b = []; for (var i = 0; i < x.length; i++) if (x[i] != null && y[i] != null && isFinite(x[i]) && isFinite(y[i])) { a.push(x[i]); b.push(y[i]); } return [a, b]; };
  A.modelo = function (v, opt) {
    opt = opt || {};
    var val = A.valida(v);
    if (val.status === 'invalida' && !opt.forcar) return {ok: false, bloqueado: true, motivo: 'Versão inválida (' + val.issues.filter(function (i) { return i.g === 'critica'; }).map(function (i) { return i.titulo; }).join('; ') + '). Risco estatístico bloqueado para não tratar uma carteira que não fecha como se fechasse. Analise uma proposta de correção.'};
    var pos = (v.pos || []).filter(function (x) { return x.w > 0 || opt.forcar; }), usar = [], fora = [], porT = {};
    pos.forEach(function (x) {
      var a = C.ATV[x.t];
      if (!a || a.status === 'placeholder') { fora.push({t: x.t, p: x.p, w: x.w, motivo: a ? 'placeholder' : 'sem cadastro'}); return; }
      var sd = A.serieDe(x.t); if (!sd) { fora.push({t: x.t, p: x.p, w: x.w, motivo: 'sem série'}); return; }
      if (a.moeda === 'USD' && !A.SER.USDBRL) { fora.push({t: x.t, p: x.p, w: x.w, motivo: 'sem série USDBRL para converter'}); return; }
      // um ativo em dois pilares vira uma coluna só; o peso por pilar fica guardado em pils
      if (porT[x.t]) { porT[x.t].w += x.w; porT[x.t].pils[x.p] = (porT[x.t].pils[x.p] || 0) + x.w; return; }
      var u = {t: x.t, p: x.p, w: x.w, pils: {}, sid: sd.id, proxy: sd.proxy, usd: a.moeda === 'USD'}; u.pils[x.p] = x.w;
      porT[x.t] = u; usar.push(u);
    });
    if (usar.length < 1) return {ok: false, motivo: 'Nenhuma posição com série histórica importada.', fora: fora};
    var sbi = {}; usar.forEach(function (u) { sbi[u.sid] = A.SER[u.sid].pts; }); if (usar.some(function (u) { return u.usd; })) sbi.USDBRL = A.SER.USDBRL.pts;
    var ids = Object.keys(sbi);
    var start = null; if (opt.meses) { var last = ids.map(function (id) { var p = sbi[id]; return p[p.length - 1][0]; }).sort()[0]; var d = new Date(last); d.setMonth(d.getMonth() - opt.meses); start = d.toISOString().slice(0, 10); }
    var al = Q.alignPrices(sbi, ids, {freq: opt.freq, start: start || undefined});
    if (!al || al.ok === false) return {ok: false, motivo: al ? al.reason : 'falha no alinhamento', fora: fora};
    if (al.dates.length < 3) return {ok: false, motivo: 'Datas comuns insuficientes (' + al.dates.length + ').', fora: fora};
    var Rall = Q.toReturns(al.P), col = {}; al.ids.forEach(function (id, j) { col[id] = Rall.map(function (r) { return r[j]; }); });
    var R = Rall.map(function (_, t) { return usar.map(function (u) { var r = col[u.sid][t]; return u.usd ? (1 + r) * (1 + col.USDBRL[t]) - 1 : r; }); });
    var w = usar.map(function (u) { return u.w; });
    var n = R.length, minObs = opt.minObs || 24;
    var extras = {}; (opt.extra || []).forEach(function (id) { var e = A.retExtra(id, al.dates, al.freq); if (e) extras[id] = e; });
    var out = {ok: true, ids: usar.map(function (u) { return u.t; }), usar: usar, w: w, R: R, dates: al.dates.slice(1), dates0: al.dates, freq: al.freq, ppy: al.ppy, n: n, fora: fora,
      cobertura: C.sum(w), val: val, extras: extras, suficiente: n >= minObs, minObs: minObs};
    if (n >= Math.max(3, usar.length + 1)) {
      var S0 = Q.cov(R); out.Ssample = S0;
      if (opt.lw) { var lw = Q.ledoitWolf(R); out.S = lw.cov; out.shrink = lw.shrinkage; } else out.S = S0;
      out.port = Q.portReturns(R, w);
    } else out.motivoCov = 'Observações (' + n + ') insuficientes para estimar a covariância de ' + usar.length + ' ativos.';
    return out;
  };
  // Um único modelo para comparar duas versões (antes × depois, carteira × benchmark): mesma amostra e mesma covariância.
  // Devolve os vetores de peso das duas versões nas colunas do modelo e o que de cada uma ficou fora.
  A.modeloPar = function (va, vb, opt) {
    opt = opt || {};
    var vis = {}, pos = [];
    (va.pos || []).concat(vb.pos || []).forEach(function (x) { if (!(x.w > 0) || vis[x.t]) return; vis[x.t] = 1; pos.push({t: x.t, p: x.p, w: 1}); });
    var m = A.modelo({pos: pos, cart: vb.cart || va.cart, rotulo: 'união'}, Object.assign({}, opt, {forcar: true}));
    if (!m.ok) return m;
    function vec(v) { var mp = {}; (v.pos || []).forEach(function (x) { mp[x.t] = (mp[x.t] || 0) + x.w; }); return m.ids.map(function (t) { return mp[t] || 0; }); }
    function fora(v) { return (v.pos || []).filter(function (x) { return x.w > 0 && m.ids.indexOf(x.t) < 0; }); }
    m.wa = vec(va); m.wb = vec(vb); m.foraA = fora(va); m.foraB = fora(vb);
    m.cobA = C.sum(m.wa); m.cobB = C.sum(m.wb);
    m.validA = A.valida(va).status !== 'invalida'; m.validB = A.valida(vb).status !== 'invalida';
    return m;
  };

  /* ---------- metodologia contextual ---------- */
  A.MTD = {};
  A.ibtn = function (key) { return h('button', {class: 'ibtn', title: 'Metodologia', 'aria-label': 'Metodologia', onclick: function () { A.drawer('Metodologia', A.MTD[key] ? A.MTD[key]() : h('p', null, 'Sem nota.')); }}, 'i'); };
  A.drawer = function (titulo, body) {
    var old = document.querySelector('.drawer'); if (old) old.remove();
    var d = h('aside', {class: 'drawer', role: 'dialog', 'aria-label': titulo}, h('header', null, h('h2', null, titulo), h('button', {class: 'x', onclick: function () { d.remove(); }}, 'Fechar')), h('div', {class: 'body mtd'}, body));
    document.body.appendChild(d); A.flush();
    var close = d.querySelector('.x'); if (close) close.focus();
    return d;
  };

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var d = document.querySelector('.drawer'); if (d) d.remove(); } });

  /* ---------- áreas ---------- */
  A.areas = {};
  // Cinco seções: Hoje (o que saiu agora), Brasil (cada ativo brasileiro com as notícias ao lado), Mundo e Estratégia
  // (o que o mundo fala, cartas e research, ETFs globais), Carteiras (as 15 aprovadas) e Biblioteca (busca, semanal, fontes).
  A.AREAS = [['hoje', 'Hoje', null], ['brasil', 'Brasil', 'var(--br)'], ['mundo', 'Mundo e Estratégia', 'var(--intl)'], ['cart', 'Carteiras', 'var(--rf)'], ['bib', 'Biblioteca', null]];
  A.SUBS = {};  // preenchido por cada módulo (ui_bib.js, ui_oregon.js, ui_mapa.js)
  // A faixa de carteira e versão aparece onde qualquer das 15 pode ser escolhida (Carteiras, fora da referência)
  A.mostraCtx = function () { return S.area === 'cart' && S.sub.cart !== 'ref'; };
  A.navAtiva = function () { return S.area; };
  A.render = function () {
    var main = document.getElementById('main'); if (!main) return;
    if (!A.areas[S.area]) S.area = 'hoje';
    var na = A.navAtiva();
    document.querySelectorAll('.nav button').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.a === na ? 'true' : 'false'); });
    var ctx = document.getElementById('ctx'); if (ctx) ctx.hidden = !A.mostraCtx();
    A.renderTop();
    main.replaceChildren();
    try { main.appendChild(A.areas[S.area]()); } catch (e) { console.error(e); main.appendChild(h('div', {class: 'alert bad'}, 'Erro ao montar esta área: ' + (e && e.message || e))); }
    A.flush(); A.save();
    try { history.replaceState(null, '', '#' + S.area + '/' + (S.sub[S.area] || '')); } catch (e) {}
  };
  // Atualiza a área atual com dados novos sem perder a posição de leitura
  A.rerender = function () { var y = window.scrollY; A.render(); if (y) requestAnimationFrame(function () { window.scrollTo(0, y); }); };
  // Cabeçalho de página: título em serifa, frase de contexto e subnavegação
  A.pageHead = function (kick, titulo, frase, right) {
    return h('div', {class: 'page-h'}, h('div', {class: 'grow'}, kick ? h('p', {class: 'kick'}, kick) : null, h('h1', null, titulo), frase ? h('p', null, frase) : null), right || null);
  };
  A.subnav = function (area, items, ativo) {
    var cur = ativo || S.sub[area];
    return h('div', {class: 'sub', role: 'toolbar', 'aria-label': 'Seções'}, items.map(function (it) {
      return h('button', {'aria-pressed': cur === it[0] ? 'true' : 'false', onclick: function () { A.go(area, it[0]); }}, it[1]);
    }));
  };
  // Endereços das versões anteriores continuam funcionando: são traduzidos para as cinco seções
  A.traduz = function (area, sub) {
    if (area === 'cart') { if (sub && (A.SUBS.cart || []).some(function (x) { return x[0] === sub; })) return ['cart', sub]; if (sub === 'todas') return ['cart', 'mapa']; return ['cart', S.sub.cart || 'ref']; }
    if (area === 'oregon') return sub === 'carteiras' ? ['cart', S.sub.cart || 'ref'] : ['brasil', 'ativos'];
    if (area === 'mesa') return sub === 'mercado' ? ['hoje', null] : ['cart', null];
    if (area === 'cons' || area === 'risco' || area === 'sala') return ['cart', null];
    if (area === 'res') { if (sub === 'eventos' || sub === 'noticias') return ['hoje', null]; return ['brasil', 'ativos']; }
    if (area === 'global') return ['mundo', 'agora'];
    if (area === 'hoje') return ['hoje', null];
    if (area === 'mundo' && sub && !(A.SUBS.mundo || []).some(function (x) { return x[0] === sub; })) return ['mundo', 'agora'];
    return [area, sub];
  };
  A.go = function (area, sub) { var t = A.traduz(area, sub); area = t[0]; sub = t[1]; S.area = area; if (sub) S.sub[area] = sub; A.render(); window.scrollTo(0, 0); };

  return A;
})();
