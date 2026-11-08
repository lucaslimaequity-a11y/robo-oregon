/* CARTEIRAS — Construção e Risco. Recupera o mapa visual do painel original (roscas por família, carteiras × pilares,
   o que mudou da base para o decidido, carteira em camadas, pilar a pilar, escada de risco) e liga cada carteira à
   validação, ao risco, aos cenários e ao laboratório de propostas. Nenhum peso é ajustado para "fechar" 100%. */
(function (A, C) {
  'use strict';
  var h = A.h, S = A.S;

  function ordP(a, b) { return +a.slice(1) - +b.slice(1); }
  function aprov(id) { return STORE.aprovadaVigente(C, id); }
  function porPilar(pos) { return C.pesosPorPilar((pos || []).filter(function (x) { return x.w > 0; })); }
  function riscoDe(p) { return C.PIL[p] ? C.PIL[p].risco : null; }
  function rv(pp) { var s = 0; Object.keys(pp).forEach(function (p) { if (riscoDe(p) === 'RV') s += pp[p]; }); return s; }
  function alt(pp) { var s = 0; Object.keys(pp).forEach(function (p) { if (riscoDe(p) === 'ALT') s += pp[p]; }); return s; }
  function soma(o) { var s = 0; Object.keys(o || {}).forEach(function (k) { s += o[k] || 0; }); return s; }
  function familias() { var f = [], seen = {}; C.CARTS.forEach(function (m) { if (!seen[m.familia]) { seen[m.familia] = []; f.push(m.familia); } seen[m.familia].push(m); }); return f.map(function (n) { return {nome: n, carts: seen[n]}; }); }
  function abrir(id, sub) { S.cart = id; S.ver = 'aprovada'; A.go('cart', sub || 'carteira'); }
  function pilares() { return Object.keys(C.PIL).sort(ordP); }

  // Resumo da integridade de uma carteira aprovada: soma dos pilares decididos e dos ativos, e pilares cujo peso interno não fecha
  function integ(id) {
    var est = C.estrategica(id), v = aprov(id), pp = porPilar(v.pos), sp = soma(est.alvo), sa = soma(pp), fora = {};
    Object.keys(est.alvo).forEach(function (p) { if (Math.abs((pp[p] || 0) - (est.alvo[p] || 0)) > C.TOL) fora[p] = true; });
    return {est: est, v: v, pp: pp, somaPil: sp, somaAtv: sa, fora: fora, okPil: Math.abs(sp - 1) <= C.TOL, okAtv: Math.abs(sa - 1) <= C.TOL};
  }

  /* ---------- Mapa ---------- */
  function mapa() {
    var wrap = h('div'), F = familias(), nos = {};
    C.CARTS.forEach(function (m) { (aprov(m.id).pos || []).forEach(function (x) { if (x.w > 0 && C.ATV[x.t] && C.ATV[x.t].status !== 'placeholder') nos[x.t] = 1; }); });
    var nAtv = Object.keys(nos).length;
    var info = {}; C.CARTS.forEach(function (m) { info[m.id] = integ(m.id); });
    var ruins = C.CARTS.filter(function (m) { return !info[m.id].okPil || !info[m.id].okAtv; });
    wrap.appendChild(A.pageHead('Carteiras · construção e risco', 'Mapa das carteiras',
      h('span', null, h('b', null, C.CARTS.length), ' carteiras-modelo, ', h('b', null, Object.keys(C.PIL).length), ' pilares e ', h('b', null, nAtv), ' ativos nas versões aprovadas (sem contar os fundos de teste). ',
        ruins.length ? h('span', {style: 'color:var(--down)'}, h('b', null, ruins.length), ' não fecham a soma') : 'Todas fecham a soma', ruins.length ? ': os pilares ou os ativos passam do total. Nada é ajustado aqui; a correção vai como proposta ao Comitê.' : '.')));

    // legenda dos pilares
    wrap.appendChild(h('div', {class: 'plegend'}, pilares().map(function (p) { return h('span', null, h('i', {style: 'background:' + A.corPilar(p)}), p + ' ' + C.PIL[p].nome); })));

    // roscas por família
    var fams = h('div', {class: 'fams'});
    F.forEach(function (f) {
      var isAlt = /Altern/.test(f.nome);
      fams.appendChild(h('div', {class: 'fam'},
        h('h3', {style: 'border-bottom-color:' + (A.FAMC[f.nome] || 'var(--line)')}, f.nome),
        h('div', {class: 'roscas'}, f.carts.map(function (m) {
          var x = info[m.id], segs = Object.keys(x.pp).sort(ordP).map(function (p) { return {v: x.pp[p], cor: A.corPilar(p), rot: p + ' ' + C.PIL[p].nome}; });
          var centro = A.pct(isAlt ? alt(x.pp) : rv(x.pp), 0), sub = isAlt ? 'alternativo' : 'renda variável';
          var err = !x.okPil ? 'pilares ' + A.pct(x.somaPil, 0) : !x.okAtv ? 'ativos ' + A.pct(x.somaAtv, 0) : null;
          return h('button', {class: 'rosca', 'aria-current': m.id === S.cart ? 'true' : null, title: m.rotulo + (err ? ' · ' + err : ' · fecha em 100%'), onclick: function () { abrir(m.id); }},
            A.rosca(segs, centro, sub), h('b', null, m.perfil || m.rotulo), err ? h('span', {class: 'err'}, err) : h('small', null, 'fecha em 100%'));
        }))));
    });
    wrap.appendChild(A.sec('Todas as carteiras', {hint: 'Cada rosca é a carteira aprovada vigente, colorida por pilar (soma dos ativos). No centro, o peso em renda variável (no bloco Alternativo, em alternativos). Se passa de 100%, o excesso aparece num anel vermelho; se falta, fica cinza. Toque para abrir.'}, fams));

    var g = h('div', {class: 'grid2'}), L = h('div'), R = h('div'); g.append(L, R); wrap.appendChild(g);
    L.appendChild(A.sec('Carteiras × pilares', {hint: 'Peso decidido de cada pilar. Ponto vermelho: os ativos do pilar não somam o peso do pilar. Toque numa linha para abrir a carteira.'}, heat(F, info)));
    R.appendChild(A.sec('O que mudou da base 30/10 para o decidido', {hint: 'Só os pilares que mudaram de peso.'}, mudancas(F)));
    return wrap;
  }
  function heat(F, info) {
    var P = pilares(), t = h('table', {class: 'hm'}), thead = h('tr', null, h('th', {class: 'l'}, 'Carteira'), P.map(function (p) { return h('th', {title: C.PIL[p].nome, style: 'border-bottom:3px solid ' + A.corPilar(p)}, p); }));
    t.appendChild(h('thead', null, thead)); var tb = h('tbody'); t.appendChild(tb);
    F.forEach(function (f) {
      tb.appendChild(h('tr', {class: 'g'}, h('th', {colspan: P.length + 1}, f.nome)));
      f.carts.forEach(function (m) {
        var x = info[m.id];
        tb.appendChild(h('tr', {class: 'r', onclick: function () { abrir(m.id); }}, h('th', {class: 'l'}, m.perfil || m.rotulo), P.map(function (p) {
          var w = x.est.alvo[p] || 0;
          if (!w) return h('td', {class: 'z'}, '·');
          var c = A.corPilar(p), forte = w >= 0.25;
          return h('td', {style: 'background:color-mix(in srgb,' + c + ' ' + Math.round(18 + Math.min(1, w / 0.5) * 70) + '%, var(--panel));color:' + (forte ? '#fff' : 'var(--ink)'), title: m.rotulo + ' · ' + p + ' ' + C.PIL[p].nome + ': ' + A.pct(w, 1) + (x.fora[p] ? ' · ativos somam ' + A.pct(x.pp[p] || 0, 1) : '')}, A.pct(w, 0), x.fora[p] ? h('i') : null);
        })));
      });
    });
    return h('div', {class: 'tw'}, t);
  }
  function mudancas(F) {
    var box = h('div', {class: 'chg'}), n = 0;
    F.forEach(function (f) { f.carts.forEach(function (m) {
      var est = C.estrategica(m.id), base = C.historica('base-30-10', m.id); if (!base) return;
      var bp = porPilar(base.pos), ps = Object.keys(Object.assign({}, est.alvo, bp)).sort(ordP).filter(function (p) { return Math.abs((est.alvo[p] || 0) - (bp[p] || 0)) > 0.0005; });
      if (!ps.length) return; n++;
      box.appendChild(h('h4', null, h('button', {class: 'btn link', style: 'font-weight:600;color:var(--ink)', onclick: function () { abrir(m.id, 'perfis'); }}, m.rotulo)));
      ps.forEach(function (p) { var d = (est.alvo[p] || 0) - (bp[p] || 0); box.append(h('span', {class: 'p'}, h('i', {style: 'background:' + A.corPilar(p)}), p + ' ' + C.PIL[p].nome), h('span', {class: 'w'}, A.pct(bp[p] || 0, 0) + ' → ' + A.pct(est.alvo[p] || 0, 0)), A.chip(A.pp(d, 0), d > 0 ? 'o-e' : 'g-critica')); });
    }); });
    return n ? box : h('p', {class: 'empty'}, 'Nenhum pilar mudou de peso.');
  }

  /* ---------- Carteira ---------- */
  function carteira() {
    var m = C.MAND[S.cart], v = A.versao(), x = integ(S.cart), wrap = h('div');
    wrap.appendChild(A.pageHead(m.familia + ' · ' + (m.perfil || ''), m.rotulo, h('span', null, v.rotulo + (v.data ? ' · ' + A.dataBR(v.data) : '') + ' · ' + A.pct(rv(porPilar(v.pos)), 0) + ' em renda variável · ', h('span', {class: 'muted'}, 'fonte: ' + (v.fonte || '—')))));
    if (A.mercadoFaixa) { var fx = A.mercadoFaixa(); if (fx) wrap.appendChild(fx); }
    var g = h('div', {class: 'sb-wrap'});
    g.appendChild(A.sec('A carteira em camadas', {hint: 'Anel de dentro: classe. Do meio: pilar. De fora: ativo. Toque num ativo para abrir a ficha.'}, sunburst(v)));
    g.appendChild(A.sec('Pilar a pilar', {hint: 'Barra: soma dos ativos. Faixa clara: banda do decidido. Traço escuro: peso decidido. Círculo: base 30/10. Vermelho: ativos fora da banda.'}, pilarAPilar(v)));
    wrap.appendChild(g);
    wrap.appendChild(h('div', {class: 'k', style: 'margin:8px 0 10px'}, 'Validação, alocação, concentração e exposições'));
    wrap.appendChild(A.mesaPainel());
    return wrap;
  }
  function sunburst(v) {
    var pos = (v.pos || []).filter(function (x) { return x.w > 0; }), cls = {};
    pos.forEach(function (x) { var p = x.p, c = C.PIL[p] ? C.PIL[p].classe : 'Outros'; cls[c] = cls[c] || {}; (cls[c][p] = cls[c][p] || []).push(x); });
    var ordemC = ['Renda fixa Brasil', 'Ações Brasil', 'FIIs', 'Renda fixa internacional', 'Ações internacionais', 'Alternativos'];
    var nodes = Object.keys(cls).sort(function (a, b) { return ordemC.indexOf(a) - ordemC.indexOf(b); }).map(function (c) {
      var ps = Object.keys(cls[c]).sort(ordP);
      return {rot: c, curto: {'Renda fixa Brasil': 'RF', 'Ações Brasil': 'Ações', 'FIIs': 'FIIs', 'Renda fixa internacional': 'RF ext.', 'Ações internacionais': 'Ações ext.', 'Alternativos': 'Alt.'}[c] || c, cor: A.CC[c] || 'var(--line2)', v: C.sum(ps.map(function (p) { return C.sum(cls[c][p], function (x) { return x.w; }); })),
        filhos: ps.map(function (p) { var it = cls[c][p].slice().sort(function (a, b) { return b.w - a.w; }); return {rot: p + ' ' + (C.PIL[p] ? C.PIL[p].nome : ''), curto: p, cor: A.corPilar(p), v: C.sum(it, function (x) { return x.w; }),
          filhos: it.map(function (x) { var a = C.ATV[x.t] || {}; return {rot: x.rot || x.t, curto: (x.rot || x.t).replace(/^Fundo pós CP |^Franchini /, '').slice(0, 9), cor: a.status === 'placeholder' ? 'var(--line2)' : A.corPilar(p), v: x.w, extra: [a.nome || '', a.status === 'placeholder' ? 'placeholder de teste (não é recomendação)' : ''], on: a.status === 'placeholder' ? null : function () { A.abrirTese(x.t); }}; })}; })};
    });
    return A.sunburst(nodes, {centro: 'da carteira'});
  }
  function pilarAPilar(v) {
    var est = C.estrategica(S.cart), base = C.historica('base-30-10', S.cart), bp = porPilar(base ? base.pos : []), pp = porPilar(v.pos);
    var ps = Object.keys(Object.assign({}, est.alvo, pp)).sort(ordP).filter(function (p) { return (est.alvo[p] || 0) > 0 || (pp[p] || 0) > 0; });
    var mx = Math.max.apply(null, ps.map(function (p) { var b = est.bandas[p] || {}; return Math.max(pp[p] || 0, est.alvo[p] || 0, b.max || 0, bp[p] || 0); }).concat([0.1])) * 1.08;
    var sc = function (w) { return (Math.min(w, mx) / mx * 100).toFixed(2) + '%'; };
    return h('div', {class: 'pbars'}, ps.map(function (p) {
      var b = est.bandas[p] || {}, w = pp[p] || 0, alvo = est.alvo[p] || 0, fora = b.min != null && (w < b.min - C.TOL || w > b.max + C.TOL);
      return h('div', {class: 'pbar' + (fora ? ' out' : '')},
        h('div', {class: 'hd'}, h('i', {style: 'background:' + A.corPilar(p)}), h('b', null, p), h('span', null, C.PIL[p] ? C.PIL[p].nome : ''), h('span', {class: 'w'}, A.pct(w, 1) + (Math.abs(w - alvo) > C.TOL ? ' · decidido ' + A.pct(alvo, 0) : ''))),
        h('div', {class: 'trk'}, b.min != null ? h('span', {class: 'band', style: 'left:' + sc(b.min) + ';width:calc(' + sc(b.max) + ' - ' + sc(b.min) + ')'}) : null,
          h('span', {class: 'fill', style: 'width:' + sc(w) + ';background:' + (fora ? 'var(--down)' : A.corPilar(p))}),
          alvo ? h('span', {class: 'tgt', style: 'left:' + sc(alvo)}) : null,
          base ? h('span', {class: 'base', style: 'left:' + sc(bp[p] || 0), title: 'Base 30/10: ' + A.pct(bp[p] || 0, 0)}) : null),
        h('div', {class: 'sm'}, (C.PIL[p] && C.PIL[p].papel ? C.PIL[p].papel + ' ' : '') + (b.min != null ? 'Banda ' + A.pct(b.min, 0) + ' a ' + A.pct(b.max, 0) + '. ' : '') + (base ? 'Base 30/10: ' + A.pct(bp[p] || 0, 0) + '.' : '')));
    }));
  }

  /* ---------- Decidido × base ---------- */
  function perfis() {
    var m = C.MAND[S.cart], est = C.estrategica(S.cart), base = C.historica('base-30-10', S.cart), wrap = h('div');
    wrap.appendChild(A.pageHead('Perfis · decidido × base 30/10', m.rotulo, base ? 'Renda variável: ' + A.pct(rv(porPilar(base.pos)), 0) + ' na base, ' + A.pct(rv(est.alvo), 0) + ' no decidido.' + (m.rotulo_base && m.rotulo_base !== m.rotulo ? ' Na base, esta coluna se chamava ' + m.rotulo_base + '.' : '') : 'Sem base 30/10 para esta carteira.'));
    if (!base) return wrap;
    var bp = porPilar(base.pos), ps = Object.keys(Object.assign({}, est.alvo, bp)).sort(ordP).filter(function (p) { return (est.alvo[p] || 0) || (bp[p] || 0); });
    var mx = Math.max.apply(null, ps.map(function (p) { return Math.max(est.alvo[p] || 0, bp[p] || 0, (est.bandas[p] || {}).max || 0); }).concat([0.1])) * 1.08, sc = function (w) { return (w / mx * 100).toFixed(2) + '%'; };
    var g = h('div', {class: 'grid2'}), L = h('div'), R = h('div'); g.append(L, R); wrap.appendChild(g);
    L.appendChild(A.sec('Pilar a pilar', {hint: 'Círculo vazio: base 30/10. Cheio: decidido. Faixa clara: banda do decidido.'}, h('div', {class: 'pbars'}, ps.map(function (p) {
      var a = bp[p] || 0, d = est.alvo[p] || 0, b = est.bandas[p] || {}, lo = Math.min(a, d), hi = Math.max(a, d);
      return h('div', {class: 'pbar'}, h('div', {class: 'hd'}, h('i', {style: 'background:' + A.corPilar(p)}), h('b', null, p), h('span', null, C.PIL[p].nome), h('span', {class: 'w'}, A.pct(a, 0) + ' → ' + A.pct(d, 0))),
        h('div', {class: 'trk', style: 'background:transparent;border-bottom:1px solid var(--line)'}, b.min != null ? h('span', {class: 'band', style: 'left:' + sc(b.min) + ';width:calc(' + sc(b.max) + ' - ' + sc(b.min) + ')'}) : null,
          h('span', {class: 'fill', style: 'left:' + sc(lo) + ';width:calc(' + sc(hi) + ' - ' + sc(lo) + ');top:5px;bottom:5px;background:' + (d < a ? 'var(--down)' : 'var(--blue)')}),
          h('span', {class: 'base', style: 'left:' + sc(a)}), h('span', {class: 'base', style: 'left:' + sc(d) + ';background:' + A.corPilar(p) + ';border-color:' + A.corPilar(p)})));
    }))));
    var bmap = {}, dmap = {}; (base.pos || []).forEach(function (x) { bmap[x.t] = (bmap[x.t] || 0) + x.w; }); (A.versao().pos || []).forEach(function (x) { dmap[x.t] = (dmap[x.t] || 0) + x.w; });
    var rows = Object.keys(Object.assign({}, bmap, dmap)).map(function (t) { return {t: t, p: ((C.ATV[t] || {}).pilar) || '', b: bmap[t] || 0, d: dmap[t] || 0, dif: (dmap[t] || 0) - (bmap[t] || 0)}; }).filter(function (r) { return Math.abs(r.dif) > 0.0001; });
    R.appendChild(A.sec('Ativos que mudaram de peso', {flush: true}, A.table([{k: 't', t: 'Ativo', f: function (r) { return C.ATV[r.t] && C.ATV[r.t].status !== 'placeholder' ? A.tk(r.t) : r.t; }}, {k: 'p', t: 'Pilar'}, {k: 'b', t: 'Base', r: 1, f: function (r) { return A.pct(r.b, 2); }}, {k: 'd', t: 'Decidido', r: 1, f: function (r) { return A.pct(r.d, 2); }}, {k: 'dif', t: 'Diferença', r: 1, s: function (r) { return Math.abs(r.dif); }, f: function (r) { return h('b', {class: A.cls(r.dif)}, A.pp(r.dif, 2)); }}], rows, {sort: 'dif', dir: -1, empty: 'Nenhum ativo mudou de peso.'})));
    wrap.appendChild(A.sec('A escada de risco', {hint: 'Peso em renda variável (ações e FIIs) em cada perfil da família. Linha cheia: decidido. Tracejada: base 30/10.'}, escada()));
    return wrap;
  }
  function escada() {
    var box = h('div', {class: 'grid3'});
    familias().filter(function (f) { return !/Altern/.test(f.nome); }).forEach(function (f) {
      var pts = f.carts.map(function (m) { var b = C.historica('base-30-10', m.id); return {rot: m.perfil, d: rv(C.estrategica(m.id).alvo), b: b ? rv(porPilar(b.pos)) : null}; });
      var W = 320, H = 150, pl = 34, pr = 10, pt = 14, pb = 28, mx = Math.max(0.8, Math.max.apply(null, pts.map(function (x) { return Math.max(x.d, x.b || 0); })));
      var sx = function (i) { return pl + (pts.length === 1 ? 0.5 : i / (pts.length - 1)) * (W - pl - pr); }, sy = function (v) { return pt + (1 - v / mx) * (H - pt - pb); };
      var svg = A.svg('svg', {viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'escada de risco ' + f.nome});
      [0, 0.2, 0.4, 0.6, 0.8].filter(function (v) { return v <= mx; }).forEach(function (v) { A.svg('line', {x1: pl, x2: W - pr, y1: sy(v), y2: sy(v), class: 'grid'}, svg); var t = A.svg('text', {x: pl - 5, y: sy(v), dy: '.35em', 'text-anchor': 'end'}, svg); t.textContent = A.pct(v, 0); });
      var path = function (key, dash) { var d = ''; pts.forEach(function (x, i) { if (x[key] == null) return; d += (d ? 'L' : 'M') + sx(i).toFixed(1) + ',' + sy(x[key]).toFixed(1); }); var e = A.svg('path', {d: d, fill: 'none', 'stroke-width': 2, 'stroke-dasharray': dash || null}, svg); e.style.stroke = dash ? 'var(--muted)' : (A.FAMC[f.nome] || 'var(--blue)'); };
      path('b', '4 3'); path('d');
      pts.forEach(function (x, i) { var c = A.svg('circle', {cx: sx(i), cy: sy(x.d), r: 4}, svg); c.style.fill = A.FAMC[f.nome] || 'var(--blue)'; var t = A.svg('text', {x: sx(i), y: sy(x.d) - 8, 'text-anchor': 'middle', class: 'val'}, svg); t.textContent = A.pct(x.d, 0); var l = A.svg('text', {x: sx(i), y: H - 8, 'text-anchor': 'middle'}, svg); l.textContent = x.rot; l.style.fontSize = '11px'; });
      box.appendChild(h('div', null, h('h3', {style: 'margin-top:0'}, f.nome), h('div', {class: 'chart'}, svg)));
    });
    return box;
  }

  /* ---------- Referência: modo simples, Conservador e Arrojado ----------
     Mostra a versão aprovada como ela é. Se não fecha 100%, a tela diz isso no topo e os números de risco ficam
     bloqueados ou parciais; nada é normalizado. */
  var CEN_REF = ['Abertura da curva (+150 bps)', 'Crise fiscal brasileira', 'Desvalorização do real (+20%)', 'Recessão americana', 'Queda brusca do Brent (−35%)', 'Corte de juros global'];
  function refIds() { return A.REF.map(function (r) { return r[0]; }); }
  function estadoRef(id) {
    var v = aprov(id), val = A.valida(v), x = integ(id), P = A.prem(), ex = C.exposicoes(v, P.sens), pp = porPilar(v.pos);
    return {id: id, v: v, val: val, x: x, ex: ex, pp: pp, rv: rv(pp), P: P};
  }
  function seletorRef() {
    return h('div', {class: 'seg', role: 'tablist', 'aria-label': 'Carteira de referência'}, A.REF.map(function (r) {
      return h('button', {role: 'tab', 'aria-selected': S.cart === r[0] ? 'true' : 'false', onclick: function () { S.cart = r[0]; S.ver = 'aprovada'; A.render(); }}, r[1]);
    }));
  }
  function bannerRef(e) {
    var val = e.val, crit = val.issues.filter(function (i) { return i.g === 'critica'; }), ph = C.sum((e.v.pos || []).filter(function (x) { return x.w > 0 && C.ATV[x.t] && C.ATV[x.t].status === 'placeholder'; }), function (x) { return x.w; });
    var linhas = [];
    if (val.status === 'invalida') linhas.push(h('div', null, h('b', null, 'Versão aprovada inválida. '), 'Pilares somam ' + A.pct(e.x.somaPil, 1) + ' e ativos somam ' + A.pct(e.x.somaAtv, 1) + '. ' + crit.map(function (i) { return i.titulo; }).slice(0, 2).join('; ') + '. Os pesos aparecem como estão: nada foi ajustado para fechar 100%. Risco estatístico bloqueado; cenários parciais.'));
    if (ph > C.TOL) linhas.push(h('div', null, h('b', null, 'Fundos de teste: '), A.pct(ph, 0) + ' da carteira está em placeholders (não são recomendação). Essa parte fica fora de risco e cenários, como lacuna, nunca como caixa.'));
    if (val.status === 'parcial' && ph <= C.TOL) linhas.push(h('div', null, h('b', null, 'Análise parcial: '), A.pct(val.cobertura.descoberto, 0) + ' da carteira sem instrumento investível ou sensibilidade cadastrada. Essa parte não entra nos números e não é tratada como caixa.'));
    if (!linhas.length) linhas.push(h('div', null, 'Pesos fecham em 100% e todas as posições têm cadastro e sensibilidade.'));
    return h('div', {class: 'alert ' + (val.status === 'invalida' ? 'bad' : val.status === 'parcial' ? 'warn' : 'ok')}, linhas,
      val.status !== 'valida' ? h('div', {class: 'row', style: 'margin-top:6px;gap:8px'}, h('button', {class: 'btn sm', onclick: function () { A.drawer('Problemas da versão aprovada · ' + C.MAND[e.id].rotulo, A.issuesList(val.issues.filter(function (i) { return i.g !== 'info'; }))); }}, 'Ver os problemas'), val.status === 'invalida' ? h('button', {class: 'btn sm', onclick: function () { A.novaPropostaCorrecao && A.novaPropostaCorrecao(); }}, 'Criar proposta de correção') : null) : null);
  }
  function riscoResumo(e) {
    var m = A.modelo(e.v, {meses: 36, lw: true});
    if (!m.ok || !m.S) return h('div', null, A.na(m.bloqueado ? 'versão inválida: risco estatístico bloqueado' : (m.motivo || m.motivoCov || 'sem séries'), m.bloqueado ? 'proposta corrigida aprovada pelo Comitê' : 'séries históricas do robô (carregam sozinhas uma vez por dia)'),
      m.fora && m.fora.length ? h('p', {class: 'hint'}, 'Fora do modelo: ' + A.pct(C.sum(m.fora, function (x) { return x.w; }), 0) + ' da carteira (placeholders, crédito sem cadastro ou sem série).') : null);
    var sig = Q.annualizeVol(Q.portVol(m.w, m.S), m.ppy), dd = Q.drawdown(m.port), vr = Q.varHist(m.port, 0.95);
    return h('div', null, h('dl', {class: 'kv'},
      h('dt', null, 'Volatilidade anualizada'), h('dd', {class: 'num'}, A.pct(sig, 2)),
      h('dt', null, 'Drawdown máximo'), h('dd', {class: 'num down'}, A.spct(dd.mdd, 2)),
      h('dt', null, 'VaR histórico 95%'), h('dd', null, vr == null ? A.na('menos de 30 observações') : h('span', {class: 'num'}, A.pct(vr, 2) + ' por ' + ({D: 'dia', W: 'semana', M: 'mês'}[m.freq] || 'período'))),
      h('dt', null, 'Cobertura do modelo'), h('dd', {class: 'num'}, A.pct(m.cobertura, 0))),
      m.cobertura < 0.995 ? h('div', {class: 'alert warn', style: 'font-size:.86rem'}, 'Os números cobrem só ' + A.pct(m.cobertura, 0) + ' da carteira, com os pesos como estão: não são o risco da carteira inteira. O resto (placeholders, crédito sem cadastro, ativos sem série) fica de fora e não vira caixa.') : null,
      h('p', {class: 'hint'}, m.n + ' retornos de ' + A.dataBR(m.dates[0]) + ' a ' + A.dataBR(m.dates[m.n - 1]) + '; pesos como estão, sem normalizar. ' + (m.suficiente ? '' : 'Amostra curta: números frágeis. ') + 'Correlação, drawdown por período e VaR completo em Risco e cenários.'));
  }
  function comparativo(es) {
    var lin = [
      ['Renda variável', function (e) { return A.pct(e.rv, 0); }],
      ['Exterior (P9 a P13)', function (e) { return A.pct(C.sum(['P9', 'P10', 'P11', 'P12', 'P13'].map(function (p) { return e.pp[p] || 0; })), 0); }],
      ['Duration prefixada', function (e) { var f = e.ex.fatores.dur_pre; return f ? A.num(f, 2) + ' anos' : '—'; }],
      ['Duration de juro real', function (e) { var f = e.ex.fatores.dur_real; return f ? A.num(f, 2) + ' anos' : '—'; }],
      ['Beta ao Ibovespa', function (e) { var f = e.ex.fatores.beta_ibov; return f ? A.num(f, 2) : '—'; }],
      ['Dólar direto', function (e) { var f = e.ex.fatores.usd_direto; return f ? A.pct(f, 0) : '—'; }],
      ['Número efetivo de posições', function (e) { return e.ex.effN ? A.num(e.ex.effN, 1) : '—'; }],
      ['Soma dos pesos', function (e) { return h('span', {class: e.val.status === 'invalida' ? 'down' : ''}, A.pct(e.x.somaAtv, 1)); }]
    ];
    var t = h('table', {class: 't cmp'}, h('thead', null, h('tr', null, h('th', null, ''), es.map(function (e) { return h('th', {class: 'r' + (e.id === S.cart ? ' sel' : '')}, A.REF.filter(function (r) { return r[0] === e.id; })[0][1]); }))),
      h('tbody', null, lin.map(function (l) { return h('tr', null, h('td', null, l[0]), es.map(function (e) { return h('td', {class: 'r num' + (e.id === S.cart ? ' sel' : '')}, l[1](e)); })); })));
    return h('div', null, t, h('p', {class: 'hint'}, 'Exposições agregadas das sensibilidades cadastradas (premissas) e dos pesos aprovados, como estão.'));
  }
  function cenariosRef(es) {
    var pres = (A.PRESETS || []).filter(function (p) { return CEN_REF.indexOf(p.n) >= 0; });
    var t = h('table', {class: 't cmp'}, h('thead', null, h('tr', null, h('th', null, 'Cenário'), es.map(function (e) { return h('th', {class: 'r' + (e.id === S.cart ? ' sel' : '')}, A.REF.filter(function (r) { return r[0] === e.id; })[0][1]); }))),
      h('tbody', null, pres.map(function (p) {
        return h('tr', {title: Object.keys(p.c).map(function (k) { var f = C.FATORES.filter(function (x) { return x.k === k; })[0]; return (f ? f.n : k) + ' ' + MERCADO.fmtVar(p.c[k], f && f.u === 'pp' ? 'pp' : '%'); }).join(' · ')},
          h('td', null, p.n), es.map(function (e) { var r = C.choqueCarteira(e.v, p.c, e.P.sens); return h('td', {class: 'r num ' + A.cls(r.total) + (e.id === S.cart ? ' sel' : '')}, A.spct(r.total, 1), r.parcial ? h('sup', {title: r.aviso}, '*') : null); }));
      })));
    return h('div', null, t, h('p', {class: 'hint'}, 'Impacto instantâneo pelo motor de choques, com as sensibilidades cadastradas (premissas). * parcial: carteira inválida ou com parte sem cobertura, que não entra e não vira zero. Passe o mouse sobre o cenário para ver os choques. Para montar o seu: Risco e cenários.'));
  }
  A.cartRef = function () {
    if (refIds().indexOf(S.cart) < 0) S.cart = refIds()[0];
    S.ver = 'aprovada';
    var m = C.MAND[S.cart], e = estadoRef(S.cart), es = refIds().map(estadoRef), wrap = h('div');
    wrap.appendChild(A.pageHead('Carteiras de referência · ' + m.familia + ' · ' + (e.v.rotulo || 'versão aprovada') + (e.v.data && !/\d{2}\/\d{2}\/\d{4}/.test(e.v.rotulo || '') ? ' · ' + A.dataBR(e.v.data) : ''), m.perfil || m.rotulo,
      h('span', null, A.pct(e.rv, 0) + ' em renda variável · ' + (e.ex.nTickers || 0) + ' posições investíveis · fonte: ' + (e.v.fonte || '—')), seletorRef()));
    wrap.appendChild(bannerRef(e));
    if (A.mercadoFaixa) { var fx = A.mercadoFaixa(); if (fx) wrap.appendChild(fx); }
    var g = h('div', {class: 'sb-wrap'});
    g.appendChild(A.sec('A carteira em camadas', {hint: 'Anel de dentro: classe. Do meio: pilar. De fora: ativo. Toque num ativo para abrir a tese.'}, sunburst(e.v)));
    g.appendChild(A.sec('Pilar a pilar', {hint: 'Barra: soma dos ativos. Faixa clara: banda. Traço escuro: peso decidido. Círculo: base 30/10. Vermelho: fora da banda.'}, pilarAPilar(e.v)));
    wrap.appendChild(g);
    var g2 = h('div', {class: 'grid2'}), L = h('div'), R = h('div'); g2.append(L, R); wrap.appendChild(g2);
    L.appendChild(A.sec('Cenários', {mtd: 'choques', right: h('button', {class: 'btn sm', onclick: function () { A.go('cart', 'risco'); }}, 'Risco e cenários')}, cenariosRef(es)));
    L.appendChild(A.sec('Conservador × Arrojado', {hint: 'A mesma régua para as duas versões aprovadas.'}, comparativo(es)));
    R.appendChild(A.sec('Risco', {mtd: 'risco'}, riscoResumo(e)));
    var top = (e.v.pos || []).filter(function (x) { return x.w > 0; }).slice().sort(function (a, b) { return b.w - a.w; }).slice(0, 10);
    R.appendChild(A.sec('Maiores posições', {flush: true}, A.table([
      {k: 't', t: 'Ativo', f: function (x) { var a = C.ATV[x.t]; return a && a.status !== 'placeholder' ? h('span', null, A.tk(x.t), ' ', h('span', {class: 'muted', style: 'font-size:.84rem'}, a.nome)) : h('span', {class: 'muted'}, (x.rot || x.t) + ' · placeholder'); }},
      {k: 'p', t: 'Pilar'}, {k: 'w', t: 'Peso', r: 1, f: function (x) { return A.pct(x.w, 1); }}], top, {sort: 'w'})));
    wrap.appendChild(h('p', {class: 'muted', style: 'font-size:.86rem'}, 'As outras 13 carteiras, o laboratório de propostas, Decidido × base e Performance estão em ', h('button', {class: 'btn link', onclick: function () { A.go('cart', 'mapa'); }}, 'Todas as carteiras · avançado'), '. A escolha das referências fica em uma linha (A.REF, ui_base.js).'));
    return wrap;
  };

  A.areas.cart = function () {
    var sub = S.sub.cart, wrap = h('div');
    if (sub !== 'ref' && sub !== 'risco' && !A.ehAvancado(sub)) sub = S.sub.cart = 'ref';
    var av = A.ehAvancado(sub);
    wrap.appendChild(A.subnav('cart', A.SUBS.cart, av ? 'mapa' : sub));
    if (av) wrap.appendChild(h('div', {class: 'sub sub2', role: 'toolbar', 'aria-label': 'Modo avançado'}, h('span', {class: 'k', style: 'align-self:center;margin-right:4px'}, 'Avançado'), A.SUBS_AV.map(function (it) { return h('button', {'aria-pressed': sub === it[0] ? 'true' : 'false', onclick: function () { A.go('cart', it[0]); }}, it[1]); })));
    var corpo = sub === 'ref' ? (A.cartRef ? A.cartRef() : mapa()) : sub === 'carteira' ? carteira() : sub === 'risco' ? A.areas.risco() : sub === 'construcao' ? A.areas.cons() : sub === 'perfis' ? perfis() : sub === 'perf' && A.resPerf ? A.resPerf() : mapa();
    wrap.appendChild(corpo);
    return wrap;
  };
  A.cartSunburst = function (v) { return sunburst(v); };
  A.cartPilarAPilar = function (v) { return pilarAPilar(v); };
  A.integCarteira = integ;
})(APP, CORE);
