/* Teses da Carteira Oregon (documento de 30/10/2026) — texto reproduzido sem alteração */
(function (A, C) {
  'use strict';
  var h = A.h, S = A.S;

  A.teseDe = function (t) {
    var T = C.D.teses_pdf; if (!T) return null;
    if (T.teses[t]) return {tese: T.teses[t], nota: null};
    var eq = T.equivalencias[t]; if (eq && T.teses[eq.tese]) return {tese: T.teses[eq.tese], nota: eq.nota};
    return T.sem_tese[t] ? {tese: null, nota: T.sem_tese[t]} : null;
  };
  A.temTese = function (t) { var x = A.teseDe(t); return !!(x && x.tese); };

  // Ticker clicável: abre a tese (ou a ficha resumida, se não houver tese no documento)
  A.tk = function (t, extra) {
    var tem = A.temTese(t);
    return h('button', {class: 'tk' + (tem ? ' tem' : ''), title: tem ? 'Abrir a tese de ' + t : 'Ver a ficha de ' + t, onclick: function (e) { e.stopPropagation(); A.abrirTese(t); }}, t, extra || null);
  };

  function posNaCarteira(t) {
    var v = A.versao(); if (!v) return null;
    var tt = t === 'BBDC4' ? 'BBDC3' : t;
    var x = (v.pos || []).filter(function (p) { return p.t === tt; })[0];
    if (!x) return null;
    var pil = C.sum((v.pos || []).filter(function (p) { return p.p === x.p; }), function (p) { return p.w; });
    return {w: x.w, p: x.p, noPilar: pil > 0 ? x.w / pil : null, rot: v.rotulo};
  }

  A.teseView = function (t, opt) {
    opt = opt || {};
    var x = A.teseDe(t), a = C.ATV[t] || C.ATV[t === 'BBDC4' ? 'BBDC3' : ''] || null;
    var wrap = h('article', {class: 'tv'});
    if (!x || !x.tese) {
      wrap.appendChild(h('p', {class: 'tv-crumb'}, a ? a.pilar + ' · ' + (a.setor || '') : ''));
      wrap.appendChild(h('h2', {class: 'tv-nome'}, a ? a.nome : t, h('span', {class: 'tv-tk'}, t)));
      wrap.appendChild(h('div', {class: 'alert warn'}, x && x.nota ? x.nota : 'Este ativo não tem tese no documento “Carteira Oregon · Teses de Investimento” de 30/10/2026.'));
      if (a && a.tese) wrap.appendChild(h('div', null, h('h3', null, 'Resumo das Teses de 04/11/2026'), h('p', null, a.tese)));
      return wrap;
    }
    var T = x.tese, pc = posNaCarteira(T.ticker);
    wrap.appendChild(h('p', {class: 'tv-crumb'}, T.pilar_crumb));
    wrap.appendChild(h('h2', {class: 'tv-nome'}, T.nome, h('span', {class: 'tv-tk'}, T.ticker), h('span', {class: 'tv-peso'}, T.peso)));
    if (x.nota) wrap.appendChild(h('div', {class: 'alert warn'}, x.nota));
    if (pc) wrap.appendChild(h('p', {class: 'tv-ctx'}, 'No painel (' + C.MAND[S.cart].rotulo + ', ' + pc.rot + '): ' + A.pct(pc.w, 2) + ' da carteira' + (pc.noPilar != null ? ', ' + A.pct(pc.noPilar, 1) + ' do ' + pc.p : '') + '. O peso no título acima é o do documento de 30/10.'));
    wrap.appendChild(h('p', {class: 'tv-lead'}, T.resumo));
    wrap.appendChild(h('div', {class: 'tv-2'},
      h('div', {class: 'tv-box tv-papel'}, h('div', {class: 'tv-k'}, 'Papel na carteira'), h('h3', null, T.papel_titulo), h('p', null, T.papel)),
      h('div', {class: 'tv-box tv-q'}, h('div', {class: 'tv-k'}, 'Questão central'), h('p', null, T.questao))));
    wrap.appendChild(h('div', {class: 'tv-k tv-sec'}, 'Fundamentos da tese'));
    wrap.appendChild(h('div', {class: 'tv-3'}, T.fundamentos.map(function (f, i) { return h('div', {class: 'tv-f'}, h('div', {class: 'tv-n'}, ('0' + (i + 1)).slice(-2)), h('h3', null, f.titulo), h('p', null, f.texto)); })));
    wrap.appendChild(h('div', {class: 'tv-2'},
      h('div', null, h('div', {class: 'tv-k tv-sec'}, 'A tese em números'), T.numeros.map(function (n) { return h('div', {class: 'tv-num'}, n); })),
      h('div', null, h('div', {class: 'tv-k tv-sec'}, 'Indicadores-chave'), h('ul', {class: 'tv-ind'}, T.indicadores.map(function (n) { return h('li', null, n); })))));
    wrap.appendChild(h('div', {class: 'tv-k tv-sec'}, 'Principais riscos'));
    wrap.appendChild(h('div', {class: 'tv-r'}, T.riscos.map(function (r) { return h('div', {class: 'tv-risco'}, h('h3', null, r.titulo), h('p', null, r.texto)); })));
    wrap.appendChild(h('div', {class: 'tv-crit'}, h('div', {class: 'tv-k'}, 'Critérios para reavaliação da posição'), h('ul', null, T.criterios.map(function (c) { return h('li', null, c); }))));
    wrap.appendChild(h('p', {class: 'tv-fontes'}, T.fontes));
    if (a && (a.cotacao || a.ret_12m != null)) wrap.appendChild(h('p', {class: 'tv-fontes'}, (a.cotacao ? 'Cotação R$ ' + A.num(a.cotacao) + (a.teto ? ' · preço teto R$ ' + A.num(a.teto) : '') + (a.rec ? ' · ' + a.rec : '') + ' (' + a.fonte_preco + '). ' : '') + (a.ret_12m != null ? 'Retorno em 12 meses ' + A.spct(a.ret_12m) + ' (' + (a.fonte_ret || '') + ').' : '')));
    wrap.appendChild(h('p', {class: 'tv-fontes'}, C.D.teses_pdf.fonte + ' Página ' + T.pagina + ' do documento.'));
    return wrap;
  };

  A.abrirTese = function (t) {
    var d = A.drawer('Tese · ' + t, h('div', null,
      A.teseView(t),
      h('div', {class: 'row', style: 'margin-top:12px'},
        h('button', {class: 'btn', onclick: function () { d.remove(); A.abrirEmpresa(t); }}, 'Abrir a ficha completa'),
        C.ATV[t] && C.ATV[t].status !== 'placeholder' ? h('button', {class: 'btn', onclick: function () { d.remove(); W0(t); }}, 'Dimensionar a posição') : null)));
    d.classList.add('wide');
    return d;
  };
  function W0(t) { A.W.sel = t; A.go('cons', 'sizing'); }

  // Visão geral das teses: filosofia, papel dos pilares, critérios e as teses por pilar
  A.tesesOregon = function () {
    var T = C.D.teses_pdf, I = T.intro, wrap = h('div');
    wrap.appendChild(A.sec('Carteira Oregon · Teses de Investimento', {hint: T.fonte + ' Texto reproduzido do documento, sem alteração.'}, h('div', {class: 'tv'},
      h('h3', {style: 'margin-top:0'}, I.filosofia.titulo), h('p', {class: 'tv-lead'}, I.filosofia.texto),
      h('div', {class: 'tv-k tv-sec'}, 'O papel dos três pilares'),
      h('div', {class: 'tv-3'}, I.pilares.map(function (p) { return h('div', {class: 'tv-f'}, h('h3', null, p.titulo), h('p', null, p.texto)); })),
      h('p', {class: 'tv-nota'}, I.pilares_nota),
      A.more('Critérios que orientam a gestão', h('div', {class: 'tv-r'}, I.criterios.map(function (c) { return h('div', {class: 'tv-risco tv-neutro'}, h('h3', null, c.titulo), h('p', null, c.texto)); }))))));
    [['P5', 'Pilar 5 · Dividendos'], ['P6', 'Pilar 6 · Valor e crescimento'], ['P7', 'Pilar 7 · Fundos listados']].forEach(function (pp) {
      var al = I[pp[0]], lista = Object.keys(T.teses).map(function (k) { return T.teses[k]; }).filter(function (t) { return t.pilar_crumb.indexOf('PILAR ' + pp[0].slice(1) + ' ') === 0; });
      var corpo = h('div', {class: 'tv'});
      if (pp[0] === 'P7' && I.P7_intro) {
        corpo.appendChild(h('p', {class: 'tv-lead'}, I.P7_intro.texto));
        I.P7_intro.secoes.forEach(function (sc) { corpo.appendChild(A.more(sc.titulo.charAt(0) + sc.titulo.slice(1).toLowerCase(), h('div', null, h('div', {class: 'tv-r'}, sc.caixas.map(function (c) { return h('div', {class: 'tv-risco tv-neutro'}, h('h3', null, c.titulo), h('p', null, c.texto)); })), sc.nota ? h('p', {class: 'tv-nota'}, sc.nota) : null))); });
      }
      corpo.appendChild(h('p', null, h('b', null, al.titulo), ' · ', al.subtitulo));
      if (al.caixas && al.caixas.length) corpo.appendChild(h('div', {class: 'tv-3'}, al.caixas.map(function (c) { return h('div', {class: 'tv-f'}, h('h3', null, c.titulo), h('p', null, c.texto)); })));
      if (al.nota) corpo.appendChild(h('p', {class: 'tv-nota'}, al.nota));
      corpo.appendChild(h('div', {class: 'tv-cards'}, lista.map(function (t) {
        return h('button', {class: 'tv-card', onclick: function () { A.abrirTese(t.ticker); }},
          h('div', {class: 'row', style: 'gap:8px'}, h('b', null, t.nome), h('span', {class: 'tv-tk'}, t.ticker), h('span', {class: 'tv-peso'}, t.peso)),
          h('div', {class: 'muted', style: 'font-size:.8rem;margin:2px 0 4px'}, t.pilar_crumb.split(' / ')[1] || ''),
          h('div', {class: 'tv-cq'}, t.papel_titulo));
      })));
      corpo.appendChild(h('p', {class: 'tv-fontes'}, al.fontes));
      wrap.appendChild(A.sec(pp[1], {flush: false}, corpo));
    });
    return wrap;
  };
})(APP, CORE);
