/* v4.0 · NOVO VISUAL (aprovado pelo Lucas em 10/11/2026, "pode seguir", depois do modelo no quadro de design).
   Mesmas telas, mesmas funções e mesmos dados: muda a aparência e a organização. Nada é retirado.
   - moldura: no computador, menu lateral com as seções, as páginas da seção aberta, a busca e o cartão da coleta
     (quanto falta para a próxima rodada, Atualizar e Coletar agora); no celular, a barra de seções continua embaixo;
   - Hoje: "O dia até agora" (notícias por hora; ponto amarelo nas horas com manchete de macro do Brasil), Mercado hoje e
     Radar na coluna principal, carteira, agenda e alertas na lateral, Research e Debate lado a lado, Todas as notícias
     no fim; "Para começar o dia" e o Radar em cartões;
   - tipo de cada notícia por extenso (Notícia, Resultado, Opinião, Carta, Estudo, Documento à CVM) no lugar das letras;
   - o visual antigo continua a um toque ("Voltar ao visual antigo"); a escolha fica guardada neste navegador.
   As cores e as fontes estão em v4.css, que só vale com html.v4. */
(function (A, C, I) {
  'use strict';
  var h = A.h, S = A.S;

  /* ---------- visual novo × antigo ---------- */
  function ler() { try { return A.lsGet ? A.lsGet('visual', 'novo') : 'novo'; } catch (e) { return 'novo'; } }
  function aplicar(modo) { document.documentElement.classList.toggle('v4', modo !== 'antigo'); }
  aplicar(ler());
  A.v4 = function () { return document.documentElement.classList.contains('v4'); };
  A.setVisual = function (modo) {
    try { if (A.lsSet) A.lsSet('visual', modo); } catch (e) {}
    aplicar(modo); A.render(); window.scrollTo(0, 0);
    if (A.toast) A.toast(modo === 'antigo' ? 'Visual antigo. Para voltar ao novo, use "Usar o visual novo" no fim da página ou no topo.' : 'Visual novo.', 5000);
  };

  /* ---------- tipo da notícia por extenso ---------- */
  var PAL = {resultado: 'Resultado', opiniao: 'Opinião', carta: 'Carta', research: 'Estudo', noticia: 'Notícia'};
  var me0 = A.marcaEl;
  if (me0) A.marcaEl = function (x) {
    var el = me0.apply(this, arguments);
    if (!A.v4() || !el || !el.classList) return el;
    var m = I.marca(x);
    el.classList.add('v4mt'); el.setAttribute('data-w', m.k === 'fato' ? m.t : (PAL[m.k] || m.t));
    return el;
  };
  // nas linhas de notícia, o tipo vai para a linha de baixo, junto do veículo
  var row0 = A.itemRow;
  if (row0) A.itemRow = function () {
    var r = row0.apply(this, arguments);
    if (!A.v4() || !r || !r.querySelector) return r;
    var mt = r.querySelector('.nr-tt .nwl .mt'), src = null;
    for (var i = 0; i < r.children.length; i++) if (r.children[i].classList.contains('nw-src')) { src = r.children[i]; break; }
    if (mt && src) src.insertBefore(mt, src.firstChild);
    return r;
  };

  /* ---------- moldura: menu lateral, páginas da seção, cartão da coleta ---------- */
  var EX = null;
  function nomeArea(a) { var o = (A.AREAS || []).filter(function (x) { return x[0] === a; })[0]; return o ? o[1] : ''; }
  function pad(n) { return ('0' + n).slice(-2); }
  function hm(t) { var d = new Date(t - 3 * 3600e3); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); }
  function criarExtras(tin) {
    var ringW = h('span', {html: '<svg class="v4-ring" viewBox="0 0 64 64" role="img" aria-label="Tempo até a próxima coleta"><circle class="bg" cx="32" cy="32" r="26" fill="none" stroke-width="5"></circle><circle class="fg" cx="32" cy="32" r="26" fill="none" stroke-width="5" stroke-linecap="round" stroke-dasharray="163.4" stroke-dashoffset="163.4" transform="rotate(-90 32 32)"></circle><text x="32" y="37" text-anchor="middle">··</text></svg>'});
    var ring = ringW.firstChild;
    var vivo = h('span', {class: 'v4-live', 'aria-hidden': 'true'}), prox = h('span', null, 'calculando…');
    EX = {
      subs: h('div', {class: 'v4-subs', role: 'navigation', 'aria-label': 'Páginas desta seção'}),
      col: h('div', {class: 'v4-col', role: 'group', 'aria-label': 'Coleta automática'},
        h('div', {class: 'v4-col-t'}, ring, h('div', {class: 'v4-col-x'}, h('b', null, vivo, 'Coleta automática'), prox)),
        h('p', {class: 'v4-col-n'}, 'Uma rodada a cada 15 minutos das 6h às 23h e a cada 30 de madrugada; o GitHub pode atrasar.'),
        h('div', {class: 'v4-col-b'}, h('button', {type: 'button', title: 'Relê agora o que o robô já publicou no site (não manda o robô coletar)', onclick: function () { if (A.intelAtualizar) A.intelAtualizar(); }}, 'Atualizar'),
          A.GH_ACTIONS ? h('a', {href: A.GH_ACTIONS, target: '_blank', rel: 'noopener', title: 'Abre a página do robô no GitHub: toque em "Run workflow". Usa o seu login do GitHub; nenhuma chave fica no site.'}, 'Coletar agora') : null)),
      volta: h('button', {class: 'v4-volta', type: 'button', onclick: function () { A.setVisual('antigo'); }}, 'Voltar ao visual antigo'),
      ring: ring, vivo: vivo, prox: prox
    };
    tin.append(EX.subs, EX.col, EX.volta);
  }
  // próxima rodada: a da corrente (versao.json) ou o próximo horário do robo.yml, o que vier antes
  function proximaRodada() {
    var agora = Date.now(), v = (A.intel || {}).versao, c = [];
    var tc = I.proximaCorrente ? I.proximaCorrente(v, agora) : null; if (tc != null) c.push(tc);
    var s = I.coletasPrevistas ? I.coletasPrevistas(agora, agora + 2 * 864e5)[0] : null; if (s != null) c.push(s);
    return c.length ? Math.min.apply(null, c) : null;
  }
  A.v4ProximaRodada = proximaRodada;  // para os testes
  function tick() {
    if (!EX || !A.v4() || document.hidden) return;
    var t = proximaRodada(), agora = Date.now(), v = (A.intel || {}).versao;
    var min = (v && v.corrente && v.corrente.ativo && v.corrente.minutos) || 30;
    var fg = EX.ring.querySelector('.fg'), tx = EX.ring.querySelector('text');
    if (t == null) { tx.textContent = '··'; EX.prox.textContent = 'sem previsão'; return; }
    var r = Math.round((t - agora) / 1000);
    if (r <= 0) {
      tx.textContent = '···'; fg.setAttribute('stroke-dashoffset', '0'); EX.vivo.classList.add('off');
      EX.prox.textContent = 'a rodada das ' + hm(t) + ' deve estar rodando';
    } else {
      var f = Math.min(1, r / (min * 60));
      tx.textContent = r >= 3600 ? Math.floor(r / 3600) + 'h' + pad(Math.floor(r % 3600 / 60)) : pad(Math.floor(r / 60)) + ':' + pad(r % 60);
      fg.setAttribute('stroke-dashoffset', (163.4 * f).toFixed(1)); EX.vivo.classList.remove('off');
      EX.prox.textContent = 'próxima às ' + hm(t);
    }
  }
  setInterval(tick, 1000);
  var ROD = null;
  function moldura() {
    var tin = document.querySelector('.top .top-in'); if (!tin) return;
    if (!EX) criarExtras(tin);
    var area = S.area, subs = A.SUBS[area] || [], cur = S.sub[area] || (subs[0] && subs[0][0]);
    EX.subs.hidden = !subs.length;
    EX.subs.replaceChildren.apply(EX.subs, subs.length ? [h('p', {class: 'v4-subs-t'}, nomeArea(area))].concat(subs.map(function (s) {
      return h('button', {type: 'button', 'aria-current': s[0] === cur ? 'page' : null, onclick: function () { A.go(area, s[0]); }}, s[1]);
    })) : []);
    // a faixa de carteira e versão (Carteiras) fica no alto do conteúdo, não no menu
    var ctx = document.getElementById('ctx'), top = document.querySelector('.ov > .top'), mainEl = document.querySelector('.ov > main');
    if (ctx && top && mainEl) { if (A.v4()) { if (ctx.parentElement !== mainEl) mainEl.insertBefore(ctx, mainEl.firstChild); } else if (ctx.parentElement !== top) top.appendChild(ctx); }
    // marca: "oreg●n" no visual novo; "Oregon" no antigo (o nome continua lido como "Oregon")
    var bb = document.querySelector('.top .brand > b');
    if (bb) {
      if (A.v4() && !bb.querySelector('.v4-o')) bb.replaceChildren('oreg', h('span', {class: 'v4-o', role: 'img', 'aria-label': 'o'}), 'n');
      else if (!A.v4() && bb.querySelector('.v4-o')) bb.textContent = 'Oregon';
    }
    // rodapé com a troca de visual (no celular e no visual antigo)
    if (mainEl && !ROD) { ROD = h('p', {class: 'v4-rod no-print'}); mainEl.appendChild(ROD); }
    if (ROD) ROD.replaceChildren(h('button', {type: 'button', onclick: function () { A.setVisual(A.v4() ? 'antigo' : 'novo'); }}, A.v4() ? 'Voltar ao visual antigo' : 'Usar o visual novo'));
    tick();
  }
  // detalhe da coleta: no menu lateral, abre ao lado do menu (e não para baixo, fora da tela)
  var dp0 = A.dadosPill;
  if (dp0) A.dadosPill = function () {
    var b = dp0.apply(this, arguments);
    if (b && b.addEventListener) b.addEventListener('click', function () {
      if (!A.v4() || window.innerWidth < 1024) return;
      var pop = document.querySelector('body > .pop'), lado = document.querySelector('.ov > .top'); if (!pop || !lado) return;
      var r = b.getBoundingClientRect();
      pop.style.left = Math.round(lado.getBoundingClientRect().right + 12) + 'px';
      pop.style.maxHeight = (window.innerHeight - 16) + 'px'; pop.style.overflowY = 'auto';
      pop.style.top = Math.round(Math.max(8, Math.min(r.top, window.innerHeight - pop.offsetHeight - 8))) + 'px';
    });
    return b;
  };
  var rt0 = A.renderTop;
  A.renderTop = function () {
    rt0.apply(this, arguments);
    var tr = document.getElementById('top-r');
    if (tr && !A.v4()) tr.appendChild(h('span', {class: 'v4-ir-wrap'}, h('button', {class: 'btn sm v4-ir', type: 'button', title: 'Menu lateral, cores da Oregon e o dia em barras', onclick: function () { A.setVisual('novo'); }}, 'Visual novo')));
  };
  var r0 = A.render;
  A.render = function () { r0.apply(this, arguments); try { moldura(); } catch (e) { console.error(e); } };

  /* ---------- Hoje: "O dia até agora" ---------- */
  var HSEL = null;
  function brt(x) {
    var p = I.pub(x); if (!p || p.length <= 10) return null;
    var t = Date.parse(p); if (!t) return null;
    var d = new Date(t - 3 * 3600e3); return {dia: d.toISOString().slice(0, 10), h: d.getUTCHours(), t: t};
  }
  // contagem de notícias por hora de hoje e a manchete de macro do Brasil de cada hora (Grupo XP só se não houver outra)
  I.diaPorHora = function (itens, macro, hoje) {
    var cont = [], dest = {}, i;
    for (i = 0; i < 24; i++) cont.push(0);
    (itens || []).forEach(function (x) { var b = brt(x); if (b && b.dia === hoje) cont[b.h]++; });
    [false, true].forEach(function (aceitaXP) {
      (macro || []).forEach(function (x) { var b = brt(x); if (!b || b.dia !== hoje || dest[b.h]) return; if (!aceitaXP && I.grupoXP && I.grupoXP(x)) return; dest[b.h] = x; });
    });
    return {cont: cont, dest: dest};
  };
  function heroDia(fx) {
    var itens = A.itens ? A.itens() : []; if (!itens.length) return null;
    var hoje = I.hojeBRT(), agoraH = new Date(Date.now() - 3 * 3600e3).getUTCHours();
    var mh = A.mercadoHoje ? A.mercadoHoje() : {todos: [], agenda: []};
    var d = I.diaPorHora(itens, (mh.agenda || []).concat(mh.todos || []), hoje), cont = d.cont, dest = d.dest;
    var mx = 1; for (var i = 0; i <= agoraH; i++) mx = Math.max(mx, cont[i]);
    if (HSEL == null || HSEL > agoraH) { HSEL = agoraH; for (var j = agoraH; j >= 0; j--) if (dest[j]) { HSEL = j; break; } }
    var n24 = I.ultimas(itens, {horas: 24}).length;
    var det = h('div', {class: 'v4-det', 'aria-live': 'polite'});
    function detalhe() {
      var x = dest[HSEL], hora = pad(HSEL) + 'h', b = x ? brt(x) : null;
      det.replaceChildren(h('div', {class: 'v4-det-h'}, h('b', null, hora), h('span', null, cont[HSEL] + (cont[HSEL] === 1 ? ' notícia' : ' notícias') + (HSEL === agoraH ? ' até agora' : ''))),
        h('div', {class: 'v4-det-d'}, x ? [h('small', null, 'Macro do Brasil · ' + (x.organizacao || x.fonte || '') + ', ' + hm(b.t)), h('button', {type: 'button', onclick: function () { A.abrirItem(x); }}, x.titulo)]
          : h('p', null, 'Nenhuma manchete de macro do Brasil nesta hora. Os pontos amarelos marcam as horas que tiveram.')),
        h('span', {class: 'v4-det-a'}, 'Agora ' + hm(Date.now())));
    }
    var botoes = [], barras = h('div', {class: 'v4-bars', role: 'group', 'aria-label': 'Notícias por hora de hoje'});
    for (var k = 0; k < 24; k++) (function (hh) {
      var fut = hh > agoraH, alt = fut ? 3 : Math.max(5, Math.round(cont[hh] / mx * 92));
      var b = h('button', {type: 'button', disabled: fut ? true : null, 'aria-pressed': hh === HSEL ? 'true' : 'false', 'aria-label': pad(hh) + 'h: ' + (fut ? 'ainda não chegou' : cont[hh] + ' notícias' + (dest[hh] ? ', com manchete de macro do Brasil' : '')),
        onclick: function () { HSEL = hh; botoes.forEach(function (o, n) { o.setAttribute('aria-pressed', n === hh ? 'true' : 'false'); }); detalhe(); }},
        dest[hh] && !fut ? h('span', {class: 'v4-pin', 'aria-hidden': 'true'}) : null,
        h('span', {class: 'v4-b' + (fut ? ' fut' : hh === agoraH ? ' agora' : ''), style: 'height:' + alt + 'px;animation-delay:' + (hh * 35) + 'ms'}));
      botoes.push(b); barras.appendChild(b);
    })(k);
    var rot = h('div', {class: 'v4-hl', 'aria-hidden': 'true'});
    for (var m = 0; m < 24; m++) rot.appendChild(h('span', null, m % 3 === 0 ? pad(m) + 'h' : ''));
    detalhe();
    var st = h('div', {class: 'v4-st'}, h('span', null, h('b', null, String(n24)), 'notícias em 24 h'), fx || null);
    return h('section', {class: 'v4-dia', 'aria-labelledby': 'v4-dia-t'}, h('div', {class: 'v4-dia-h'}, h('h2', {id: 'v4-dia-t'}, 'O dia até agora'), st), barras, rot, det);
  }

  /* ---------- Hoje: nova organização da página ---------- */
  function montarHoje(w) {
    w.classList.add('v4-hoje');
    function q(s) { return w.querySelector(s); }
    var fx = q('.fxd-slot'), desde = q('.desde'), hx = q('.hx-g'), sum = q('nav.sumario'), atn = q('#atencao'), mh = q('#mercado-hoje'),
      radar = q('#radar'), ag = q('#agenda-decisiva'), res = q('#research'), deb = q('#debate'), ult = q('#ultimas'), mesa = q('.mesa');
    var hero = heroDia(fx ? fx.querySelector('.fxd') : null);
    if (fx) fx.remove();
    var ancora = desde || sum || null;
    if (hero) { if (ancora) w.insertBefore(hero, ancora); else w.appendChild(hero); }
    var main = h('div', {class: 'v4-main'}), side = h('aside', {class: 'v4-side', 'aria-label': 'Carteira, agenda e alertas'}), g = h('div', {class: 'v4-g'}, main, side);
    [mh, radar].forEach(function (el) { if (el) main.appendChild(el); });
    [atn, ag, hx].forEach(function (el) { if (el) side.appendChild(el); });
    var baixo = h('div', {class: 'v4-baixo'}); [res, deb].forEach(function (el) { if (el) baixo.appendChild(el); });
    var depois = sum || desde || hero;
    if (depois && depois.parentNode === w) { depois.after(g); } else w.appendChild(g);
    g.after(baixo);
    if (ult) baixo.after(ult);
    if (mesa && !mesa.querySelector('section')) mesa.remove();
    // "Para começar o dia" em cartões
    Array.prototype.forEach.call(w.querySelectorAll('#mercado-hoje h3.nr-h'), function (t) { if (/Para começar o dia/.test(t.textContent) && t.nextElementSibling) t.nextElementSibling.classList.add('v4-cards'); });
  }
  var hoje0 = A.areas.hoje;
  A.areas.hoje = function () {
    var w = hoje0.apply(this, arguments);
    if (!A.v4() || !w || !w.querySelector) return w;
    try { montarHoje(w); } catch (e) { console.error(e); }
    return w;
  };
})(APP, CORE, INTEL);
