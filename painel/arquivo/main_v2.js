/* Inicialização */
(function (A, C) {
  'use strict';
  C.init(DATA);
  var S = A.S;
  var m = location.hash.match(/^#(hoje|cart|res|global|sala|mesa|cons|risco)(?:\/(\w+))?/);
  if (m) { var tr = A.traduz(m[1], m[2] || null); S.area = tr[0]; if (tr[1]) S.sub[tr[0]] = tr[1]; }
  if (!C.MAND[S.cart]) S.cart = 'cresc-mod';
  if (S.ver && S.ver.indexOf('prop:') === 0) S.ver = 'aprovada'; // propostas carregam depois do banco
  window.addEventListener('unhandledrejection', function (e) { var r = e.reason || {}; A.toast('Não foi possível concluir: ' + (r.message || r.code || r)); });
  var nav = document.getElementById('nav');
  A.AREAS.forEach(function (a) { nav.appendChild(A.h('button', {role: 'tab', 'data-a': a[0], onclick: function () { A.go(a[0]); }}, a[2] ? A.h('i', {style: 'background:' + a[2]}) : null, a[1])); });
  if (typeof DATA !== 'undefined' && location.search.indexOf('simulado') >= 0) document.body.classList.add('sim');
  var host = document.getElementById('cg-host');
  var r0 = A.render;
  function topH() { var t = document.querySelector('.top'); if (t) document.documentElement.style.setProperty('--top-h', t.offsetHeight + 'px'); }
  window.addEventListener('resize', topH);
  A.render = function () { r0(); if (host) host.hidden = !(S.area === 'sala' && S.sub.sala === 'comite'); topH(); var sim = document.getElementById('sim'); var E = A.mercadoEstado; if (sim) sim.hidden = !(E && E.snap && E.snap.simulado); };
  A.render();
  var pend = false;
  function tryRender() {
    var ae = document.activeElement;
    if (ae && ae.closest && ae.closest('#main') && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) { if (!pend) { pend = true; ae.addEventListener('blur', function f() { ae.removeEventListener('blur', f); pend = false; setTimeout(tryRender, 50); }); } return; }
    if (document.querySelector('.drawer')) { setTimeout(tryRender, 800); return; }
    A.render();
  }
  var tm;
  (async function () {
    try { await A.carregarTabelas(); } catch (e) { console.warn(e); }
    var r = await STORE.init();
    if (location.hash.indexOf('#cons') === 0 && m && STORE.propostas(S.cart).length) { /* mantém aprovada; usuário escolhe a proposta */ }
    STORE.on(function () { clearTimeout(tm); tm = setTimeout(tryRender, 120); });
    if (A.mercadoIniciar) A.mercadoIniciar();
    A.render();
    if (r && r.mode === 'db' && STORE.canWrite === false) A.toast('Você está vendo um painel compartilhado sem permissão de escrita: propostas e decisões não serão salvas.', 6000);
  })();
})(APP, CORE);
