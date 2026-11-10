/* v4.1 · melhorias visuais aprovadas pelo Lucas em 10/11/2026 ("as melhorias está bom sim … pode seguir. autorizado").
   Cada bloco traz o número da proposta [P3]…[P14]. Nada é retirado: só aparência e organização; o tema claro fica como está.
   Vale só no visual novo (html.v4); no visual antigo o painel é o de antes. */
(function (A, C, I) {
  'use strict';
  if (typeof document === 'undefined' || !A || !A.v4) return;
  var h = A.h, S = A.S;
  function num(v, c) { return Number(v).toLocaleString('pt-BR', {minimumFractionDigits: c, maximumFractionDigits: c}); }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
  function cada(sel, raiz, fn) { Array.prototype.forEach.call((raiz || document).querySelectorAll(sel), fn); }

  /* ---------- [P3] carregamento: blocos cinza no formato das seções ---------- */
  function esqueleto() {
    function barras(n) { var l = []; for (var i = 0; i < n; i++) l.push(h('i', {class: 'v4-sk-b', style: 'width:' + (92 - i * 11) + '%'})); return l; }
    function card(n) { return h('div', {class: 'v4-sk-c'}, h('i', {class: 'v4-sk-t'}), barras(n)); }
    var linhas = []; for (var i = 0; i < 6; i++) linhas.push(h('div', {class: 'v4-sk-r'}, h('i'), h('i', {style: 'width:' + (80 - i * 9) + '%'})));
    return h('div', {class: 'v4-sk', 'aria-busy': 'true', 'aria-label': 'Buscando os dados do robô'},
      h('div', {class: 'v4-sk-hero'}, h('i', {class: 'v4-sk-t'}), h('div', {class: 'v4-sk-rs'}, linhas)),
      h('div', {class: 'v4-sk-g'}, h('div', null, card(5), card(4)), h('div', null, card(3), card(4))));
  }
  A.v4Esqueleto = esqueleto;

  /* ---------- [P5] Radar em grade contínua: o dia vai para dentro do cartão ---------- */
  function radarGrade(w) {
    cada('#radar .nrl', w, function (l) {
      var dia = null;
      Array.prototype.forEach.call(l.children, function (el) {
        if (el.classList.contains('nr-day')) { dia = el.textContent.split('·')[0].trim(); return; }
        var t = el.matches && el.matches('article.nr') ? el.querySelector('.nw-when') : null;
        if (dia && t && !t.querySelector('.v4-dd')) t.insertBefore(h('span', {class: 'v4-dd'}, dia + ' '), t.firstChild);
      });
      l.classList.add('v4-grade');
    });
  }

  /* ---------- [P6] temporada de resultados: barra de progresso e dois grupos ---------- */
  function temporada(w) {
    var t = w.querySelector('#agenda-decisiva .tmp'); if (!t || t.querySelector('.v4-tmp-bar')) return;
    var lista = t.querySelector('.tmp-l'), hd = t.querySelector('.tmp-h'); if (!lista || !hd) return;
    var bs = Array.prototype.slice.call(lista.querySelectorAll('.tmp-t')); if (!bs.length) return;
    var ok = bs.filter(function (b) { return b.classList.contains('ok'); }), falta = bs.filter(function (b) { return !b.classList.contains('ok'); });
    hd.after(h('div', {class: 'v4-tmp-bar', role: 'img', 'aria-label': ok.length + ' de ' + bs.length + ' já entregaram'}, h('i', {style: 'width:' + Math.round(100 * ok.length / bs.length) + '%'})));
    lista.replaceWith(h('div', {class: 'v4-tmp-gs'},
      h('div', {class: 'v4-tmp-g'}, h('p', {class: 'v4-tmp-k'}, 'Entregaram · ' + ok.length), h('div', {class: 'tmp-l'}, ok)),
      h('div', {class: 'v4-tmp-g'}, h('p', {class: 'v4-tmp-k'}, 'Faltam · ' + falta.length), h('div', {class: 'tmp-l'}, falta))));
  }

  var hj = A.areas.hoje;
  A.areas.hoje = function () {
    var w = hj.apply(this, arguments);
    if (!A.v4() || !w || !w.querySelector) return w;
    var e = A.intel || {};
    if (e.carregando && !(A.itens && A.itens().length)) { var mh = w.querySelector('.mesa-h'); w.replaceChildren(); if (mh) w.appendChild(mh); w.appendChild(esqueleto()); return w; }  // [P3]
    try { radarGrade(w); temporada(w); } catch (er) { console.error(er); }
    return w;
  };

  /* ---------- [P8] coluna de notícias da ficha: índice no alto, blocos com título e contagem ---------- */
  var np0 = A.noticiasPainel;
  if (np0) A.noticiasPainel = function (t) {
    var box = np0.apply(this, arguments);
    if (!A.v4() || !box || !box.querySelector) return box;
    try {
      var blocos = [], n = 0;
      function marca(el, nome) { if (!el) return; var id = 'np-b-' + (++n); el.id = id; el.classList.add('v4-npb'); blocos.push([id, nome, el.querySelectorAll('[data-id]').length]); }
      var kids = Array.prototype.slice.call(box.children);
      var listaPrinc = kids.filter(function (k) { return k.matches('div') && k.querySelector(':scope > ul.nls') && !k.querySelector('h4'); })[0];
      marca(listaPrinc || box.querySelector('.np > .empty, :scope > .empty'), 'Notícias');
      marca(box.querySelector('.np-op'), 'Opiniões');
      kids.forEach(function (k) { var t4 = k.querySelector(':scope > h4.np-sub'); if (!t4 || k.classList.contains('np-op')) return;
        var tx = t4.textContent; marca(k, /CVM/.test(tx) ? 'CVM' : /Índice e tema/.test(tx) ? 'Tema do ETF' : /Setor e cadeia/.test(tx) ? 'Setor' : /Juros, inflação/.test(tx) ? 'Juros e inflação' : /mundo|global/i.test(tx) ? 'Mundo' : tx.split('·')[0].trim()); });
      kids.forEach(function (k) { if (k.matches('details') && /Menções incidentais/.test(k.textContent)) marca(k, 'Menções'); });
      if (blocos.length > 1) {
        var idx = h('nav', {class: 'v4-np-idx', 'aria-label': 'Blocos desta coluna'}, blocos.map(function (b) {
          return h('button', {type: 'button', onclick: function () { var el = document.getElementById(b[0]); if (el) el.scrollIntoView({block: 'start', behavior: 'smooth'}); }}, b[1], b[2] ? h('small', null, String(b[2])) : null);
        }));
        var ap = box.querySelector('.np-cont') || box.querySelector('.np-h'); if (ap) ap.after(idx); else box.insertBefore(idx, box.firstChild);
      }
    } catch (er) { console.error(er); }
    return box;
  };

  /* ---------- [P7] lista de ativos sem coluna cortada · [P10] tabelas com números alinhados, alta e queda ---------- */
  function tabelas(raiz) {
    cada('table.t td.num, table.t td.r', raiz, function (td) {
      if (td.classList.contains('v4-sg')) return; td.classList.add('v4-sg');
      var tx = td.textContent.trim();
      if (/^\+\s?R?\$?\s?\d/.test(tx) || /^\+\d/.test(tx)) td.classList.add('v4-up'); else if (/^[−-]\s?R?\$?\s?\d/.test(tx)) td.classList.add('v4-down');
    });
  }

  /* ---------- [P11] Brasil: "O que o mercado está falando" (conta do robô: biblioteca/empresas.json, robo/empresas.py) ---------- */
  var EMP = {js: null, feito: false, sel: null, jan: '24h'};
  function baseDados() {
    try { if (/^https?:$/.test(location.protocol) && !(window.claude && window.claude.use)) return new URL('data/', location.href).href; } catch (e) {}
    return 'https://lucaslimaequity-a11y.github.io/robo-oregon/data/';
  }
  function carregarEmp() {
    if (EMP.feito) return; EMP.feito = true;
    fetch(baseDados() + 'biblioteca/empresas.json?t=' + Date.now(), {cache: 'no-store'}).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { EMP.js = j; if (S.area === 'brasil') A.rerender(); }).catch(function () {});
  }
  var MNOME = {atividade: 'Atividade', juros: 'Juros', inflacao: 'Inflação', cambio: 'Câmbio', fiscal: 'Fiscal', bolsa: 'Bolsa', agenda: 'Agenda do dia'};
  var TEND = {sobe: '▲', cai: '▼'};
  function chip(l) { var k = l.tendencia; return h('span', {class: 'v4-as-t t-' + k}, k === 'sobe' || k === 'cai' ? TEND[k] + ' ' + num(l.razao, 1) + '×' : k === 'novo' ? 'novo' : k === 'estavel' ? 'estável' : '—'); }
  function linhas(obj, nomes, max) {
    return Object.keys(obj || {}).map(function (k) { return Object.assign({id: k, nome: nomes(k)}, obj[k]); }).filter(function (l) { return l.n > 0; }).sort(function (a, b) { return b.n - a.n; }).slice(0, max);
  }
  function lista(titulo, ls, tipo, j) {
    var mx = 1; ls.forEach(function (l) { mx = Math.max(mx, l.n); });
    return h('div', {class: 'v4-mf-col'}, h('h3', null, titulo), ls.length ? h('div', {class: 'v4-mf-l'}, ls.map(function (l) {
      var sel = EMP.sel && EMP.sel.k === tipo && EMP.sel.id === l.id, cart = tipo === 'e' && EMP.js.empresas[l.id] && EMP.js.empresas[l.id].carteira;
      return h('button', {type: 'button', class: 'v4-as-r' + (sel ? ' sel' : ''), 'aria-expanded': sel ? 'true' : 'false', title: l.nome + ': ' + plural(l.n, 'notícia', 'notícias') + ' ' + j.rotulo + '; ' + num(l.fatia, 1) + '% do total, contra ' + num(l.fatia_c, 1) + '% nos ' + j.comparacao_rotulo + '.',
        onclick: function () { EMP.sel = sel ? null : {k: tipo, id: l.id, nome: l.nome}; A.rerender(); }},
        h('span', {class: 'v4-as-nm'}, l.nome, tipo === 'e' ? h('small', {class: 'v4-mf-tk' + (cart ? ' cart' : '')}, l.id) : null),
        h('span', {class: 'v4-as-tr'}, h('span', {class: 'v4-as-b', style: 'width:' + Math.max(3, Math.round(100 * l.n / mx)) + '%'}), h('b', {class: 'v4-as-n'}, String(l.n))),
        chip(l));
    })) : h('p', {class: 'v4-as-vz'}, 'Nada no período.'));
  }
  function detalheMF(j) {
    var s = EMP.sel; if (!s) return null;
    var itens;
    if (s.k === 'e') itens = ((EMP.js.ultimos || {})[s.id] || []).map(function (u) { return (A.itemPorId && A.itemPorId(u.id)) || null; }).filter(Boolean);
    else itens = I.ultimas(A.itens ? A.itens() : [], {horas: {'24h': 24, '7d': 168, '30d': 720}[EMP.jan] || 24, filtro: 'macro'}).filter(function (x) { return I.macroBR(x).indexOf(s.id) >= 0; });
    var ult = s.k === 'e' ? ((EMP.js.ultimos || {})[s.id] || []) : [];
    var cart = s.k === 'e' && EMP.js.empresas[s.id] && EMP.js.empresas[s.id].carteira;
    return h('div', {class: 'v4-as-det'},
      h('div', {class: 'v4-as-dh'}, h('div', {class: 'v4-as-dt'}, h('h3', null, s.nome + (s.k === 'e' ? ' · ' + s.id : ''))),
        h('div', {class: 'v4-as-db'}, cart && A.abrirFicha ? h('button', {type: 'button', class: 'v4-as-bf', onclick: function () { A.abrirFicha(s.id); }}, 'Ficha de ' + s.id) : null,
          h('button', {type: 'button', onclick: function () { A.go('bib', 'busca'); if (A.bibFiltro) A.bibFiltro({q: s.k === 'e' ? s.id : ''}); }}, 'Ver na Biblioteca'),
          h('button', {type: 'button', class: 'v4-as-x', 'aria-label': 'Fechar', onclick: function () { EMP.sel = null; A.rerender(); }}, '✕'))),
      itens.length ? h('div', {class: 'v4-as-lista'}, A.listaRows(itens.slice(0, 8), {})) :
        ult.length ? h('ul', {class: 'v4-as-ult'}, ult.slice(0, 8).map(function (u) { return h('li', null, h('time', null, (u.publicado_em || '').slice(8, 10) + '/' + (u.publicado_em || '').slice(5, 7) + ' ' + (u.publicado_em || '').slice(11, 16)), h('span', {class: 'v4-as-org'}, u.organizacao || ''), h('a', {href: u.link, target: '_blank', rel: 'noopener'}, u.titulo + ' ↗')); })) :
          h('p', {class: 'v4-as-vz'}, 'Nenhuma notícia no período.'));
  }
  function mercadoFala() {
    carregarEmp();
    if (!EMP.js) return null;
    var j = EMP.js.janelas[EMP.jan]; if (!j) return null;
    var seg = h('div', {class: 'v4-as-seg', role: 'radiogroup', 'aria-label': 'Período'}, [['24h', '24 h'], ['7d', '7 dias'], ['30d', '30 dias']].map(function (o) {
      return h('button', {type: 'button', role: 'radio', 'aria-checked': EMP.jan === o[0] ? 'true' : 'false', onclick: function () { EMP.jan = o[0]; A.rerender(); }}, o[1]);
    }));
    var emp = linhas(j.empresas, function (k) { return (EMP.js.empresas[k] || {}).nome || k; }, 10), mac = linhas(j.macro, function (k) { return MNOME[k] || k; }, 7);
    return h('section', {class: 'v4-dia v4-ass v4-mf', 'aria-labelledby': 'v4-mf-t'},
      h('div', {class: 'v4-dia-h'}, h('h2', {id: 'v4-mf-t'}, 'O que o mercado está falando'), h('p', {class: 'v4-mf-sub'}, plural(j.total, 'notícia', 'notícias') + ' ' + j.rotulo)),
      h('div', {class: 'v4-as-ctl'}, seg),
      h('div', {class: 'v4-mf-g'}, lista('Empresas mais citadas', emp, 'e', j), lista('Macro do Brasil', mac, 'm', j)),
      detalheMF(j),
      h('p', {class: 'v4-as-nota'}, 'Empresas: pelo código na manchete ("Embraer (EMBJ3)") e pelo nome; os nomes vêm da carteira e das próprias manchetes. Macro: a marcação do Mercado hoje. A seta compara a fatia com a dos ' + j.comparacao_rotulo + '. Código em verde: empresa das carteiras.'));
  }
  var br0 = A.areas.brasil;
  A.areas.brasil = function () {
    var w = br0.apply(this, arguments);
    if (!A.v4() || !w || !w.querySelector) return w;
    try {
      if ((S.sub.brasil || 'ativos') === 'ativos') { var mf = mercadoFala(); var ph = w.querySelector('.page-h'); if (mf) { if (ph) ph.after(mf); else w.insertBefore(mf, w.firstChild); } }
      tabelas(w);
    } catch (er) { console.error(er); }
    return w;
  };

  /* ---------- [P9] cabeçalho da ficha: monograma, selos, pesos em chips, números em quadros iguais ---------- */
  function fichaCab(raiz) {
    cada('.ficha-head', raiz, function (fh) {
      if (fh.__v4) return; fh.__v4 = true;
      var tv = fh.querySelector('.tv'); if (!tv) return;
      var tk = ((tv.querySelector('.tv-tk') || {}).textContent || '').replace(/[^A-Z0-9]/g, '');
      if (tk) { var fw = h('div', {class: 'v4-fh'}); tv.parentNode.insertBefore(fw, tv); fw.append(h('span', {class: 'v4-mono', 'aria-hidden': 'true'}, tk.slice(0, 2)), tv); }
      var cr = tv.querySelector('.tv-crumb');
      if (cr && !cr.querySelector('.v4-cc')) { var partes = cr.textContent.split('·').map(function (x) { return x.trim(); }).filter(Boolean); cr.replaceChildren.apply(cr, partes.map(function (x) { return h('span', {class: 'v4-cc'}, x); })); }
      cada('p', fh, function (p) {
        var k = p.querySelector(':scope > span.k'); if (!k || !/Nas carteiras/.test(k.textContent)) return;
        p.classList.add('v4-pesos'); p.removeAttribute('style');
        Array.prototype.forEach.call(p.children, function (sp) { if (sp === k) return; var f = sp.firstChild; if (f && f.nodeType === 3) f.textContent = f.textContent.replace(/^\s*·\s*/, ''); sp.classList.add('v4-pc'); });
      });
      if (fh.parentNode && !fh.parentNode.querySelector(':scope > .ficha-kpi')) fh.classList.add('so');
    });
  }

  /* ---------- [P13] Mundo e Estratégia: "De onde vêm as notícias" ao lado das últimas; opiniões em barra ---------- */
  function mundoRegioes(w) {
    var sec = w.querySelector('#mundo-ultimas'); if (!sec || (sec.parentNode && sec.parentNode.classList.contains('v4-mw'))) return;
    var bts = Array.prototype.slice.call(sec.querySelectorAll('.sub.filt[aria-label="Filtrar por região"] button')); if (bts.length < 2) return;
    var dados = bts.map(function (b) { var m = /^(.*?)(?:\s*·\s*(\d+))?$/.exec(b.textContent.trim()); return m ? {b: b, nome: m[1], n: m[2] ? +m[2] : 0} : null; }).filter(Boolean);  // sem número = nenhuma notícia da região
    var tudo = dados.filter(function (d) { return d.nome === 'Tudo'; })[0], reg = dados.filter(function (d) { return d.nome !== 'Tudo'; });
    if (!reg.length) return;
    var mx = Math.max.apply(null, reg.map(function (d) { return d.n; })) || 1;
    var jan = (sec.querySelector('.sec-n') || {}).textContent || '';
    var aside = h('aside', {class: 'sec v4-rg', 'aria-label': 'De onde vêm as notícias'}, h('header', null, h('h2', null, 'De onde vêm as notícias')),
      h('div', {class: 'body'}, h('div', {class: 'v4-rg-l'}, reg.map(function (d) {
        var ativo = d.b.getAttribute('aria-pressed') === 'true';
        return h('button', {type: 'button', class: 'v4-rg-r', 'aria-pressed': ativo ? 'true' : 'false', onclick: function () { (ativo && tudo ? tudo.b : d.b).click(); }},
          h('span', null, d.nome), h('b', null, String(d.n)), h('i', {style: 'width:' + Math.max(3, Math.round(100 * d.n / mx)) + '%'}));
      })), h('p', {class: 'hint'}, (tudo ? tudo.n + ' notícias' : 'Notícias') + (jan ? ' nas ' + jan.replace(/^últimas\s*/, 'últimas ') : '') + '. Toque numa região para filtrar a lista; toque de novo para voltar a Tudo.')));
    var grade = h('div', {class: 'v4-mw'}); sec.parentNode.insertBefore(grade, sec); grade.append(sec, aside);
  }
  function barraOp(depois, v) {
    var tot = v.f + v.c + v.n; if (!tot || (depois.nextElementSibling && depois.nextElementSibling.classList.contains('v4-op-bar'))) return;
    depois.after(h('div', {class: 'v4-op-bar', role: 'img', 'aria-label': v.f + ' a favor, ' + v.c + ' contra, ' + v.n + ' neutras ou sem sentido no título'},
      v.f ? h('i', {class: 'f', style: 'width:' + (100 * v.f / tot) + '%'}) : null, v.c ? h('i', {class: 'c', style: 'width:' + (100 * v.c / tot) + '%'}) : null, v.n ? h('i', {class: 'n', style: 'width:' + (100 * v.n / tot) + '%'}) : null));
  }
  function opBarra(w) {
    // Mundo e Estratégia › Debate: os botões "A favor 11 · Contra 9 · Neutras 35" dão a barra
    cada('#db-op .sub.filt', w, function (sf) {
      var v = {f: 0, c: 0, n: 0};
      cada('button', sf, function (b) { var t = b.textContent, m = /(\d+)\s*$/.exec(t.trim()); if (!m) return; if (/A favor/i.test(t)) v.f = +m[1]; else if (/Contra/i.test(t)) v.c = +m[1]; else if (/Neutras/i.test(t)) v.n = +m[1]; });
      barraOp(sf, v);
    });
    cada('.deb-h', w, function (dh) {
      if (dh.nextElementSibling && dh.nextElementSibling.classList.contains('v4-op-bar')) return;
      var v = {f: 0, c: 0, n: 0};
      cada('.pol', dh, function (p) { var m = /(\d+)/.exec(p.textContent); if (!m) return; var t = p.textContent; v[/favor/.test(t) ? 'f' : /contra/.test(t) ? 'c' : 'n'] += +m[1]; });
      var tot = v.f + v.c + v.n; if (!tot) return;
      dh.after(h('div', {class: 'v4-op-bar', role: 'img', 'aria-label': v.f + ' a favor, ' + v.c + ' contra, ' + v.n + ' neutras ou sem sentido no título'},
        v.f ? h('i', {class: 'f', style: 'width:' + (100 * v.f / tot) + '%'}) : null, v.c ? h('i', {class: 'c', style: 'width:' + (100 * v.c / tot) + '%'}) : null, v.n ? h('i', {class: 'n', style: 'width:' + (100 * v.n / tot) + '%'}) : null));
    });
  }
  var mu0 = A.areas.mundo;
  if (mu0) A.areas.mundo = function () {
    var w = mu0.apply(this, arguments);
    if (!A.v4() || !w || !w.querySelector) return w;
    try { mundoRegioes(w); opBarra(w); tabelas(w); } catch (er) { console.error(er); }
    return w;
  };

  /* ---------- [P14] cores de Carteiras na paleta da Oregon (mesmos dados) ---------- */
  var PC0 = Object.assign({}, A.PC), CC0 = Object.assign({}, A.CC);
  var PC4 = {P1: '#A8D8D3', P2: '#5FB7B0', P3: '#2E8A87', P4: '#1F646C', P5: '#1C3548', P6: '#5C7D96', P7: '#E0B04F', P8: '#A9B4BE', P9: '#7D6FB0', P10: '#B7AED8', P11: '#3E8FB0', P12: '#93C9DD', P13: '#C47E8E'};
  var CC4 = {'Renda fixa Brasil': '#1F646C', 'Ações Brasil': '#1C3548', 'FIIs': '#E0B04F', 'Renda fixa internacional': '#7D6FB0', 'Ações internacionais': '#3E8FB0', 'Alternativos': '#C47E8E'};
  function cores() { var v = A.v4(); Object.assign(A.PC, v ? PC4 : PC0); Object.assign(A.CC, v ? CC4 : CC0); }
  var r0 = A.render;
  A.render = function () { cores(); var r = r0.apply(this, arguments); try { if (A.v4()) { var m = document.getElementById('main'); tabelas(m); fichaCab(m); opBarra(m); } } catch (e) { console.error(e); } return r; };
})(APP, CORE, INTEL);
