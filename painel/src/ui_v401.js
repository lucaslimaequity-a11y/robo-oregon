/* v4.0.1 · pedidos do Lucas de 10/11/2026 ("pode fazer"), só no visual novo:
   1. "Assuntos do momento" no lugar das barras por hora: quantas notícias de cada assunto (Petróleo, China, Minério…) e a
      seta de tendência (fatia do assunto comparada com a de antes), com 24 h | 7 dias | 30 dias. Tocar num assunto abre
      as notícias dele ali mesmo; dali dá para filtrar o Hoje inteiro ou ver todas na Biblioteca. A conta vem do robô
      (data/biblioteca/assuntos.json, robo/assuntos.py); antes da primeira rodada, o painel conta as últimas 24 h sozinho.
   2. Títulos das seções maiores, com uma linha dizendo o que tem ali; os links do cabeçalho viram botões (v4.css).
   3. Achar mais rápido: (a) assunto ou ativo do mapa da carteira filtra o Hoje inteiro, com a faixa "Mostrando: …";
      (b) a busca abre com os assuntos do momento, os ativos e as últimas buscas; (c) "Nesta página" com a contagem.
   Também: uma linha embaixo de Rápida | Briefing | Aprofundada dizendo o que o modo escolhido mostra.
   Nada é retirado: o filtro só esconde o que não é do assunto enquanto está ligado e some no "Limpar". */
(function (A, C, I) {
  'use strict';
  if (typeof document === 'undefined' || !A || !A.v4) return;
  var h = A.h, S = A.S;
  function pad(n) { return ('0' + n).slice(-2); }
  function num(v, c) { return Number(v).toLocaleString('pt-BR', {minimumFractionDigits: c, maximumFractionDigits: c}); }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }

  /* ---------- dados do robô: biblioteca/assuntos.json ---------- */
  var ASS = {js: null, para: null, feito: false, carregando: false, erro: null};
  function baseDados() {
    try { if (/^https?:$/.test(location.protocol) && !(window.claude && window.claude.use) && !(typeof STORE !== 'undefined' && STORE.mode === 'db')) return new URL('data/', location.href).href; } catch (e) {}
    return 'https://lucaslimaequity-a11y.github.io/robo-oregon/data/';
  }
  function chaveVersao() { var v = (A.intel || {}).versao; return v ? v.gerado_em : null; }
  function redesenhar() {
    if (S.area !== 'hoje' || document.querySelector('.drawer') || document.querySelector('.cmdk-bg')) return;
    var ae = document.activeElement; if (ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) return;
    (A.rerender || A.render)();
  }
  function carregarAssuntos(forcar) {
    var k = chaveVersao();
    if (ASS.carregando || (!forcar && ASS.feito && ASS.para === k)) return;
    ASS.carregando = true;
    fetch(baseDados() + 'biblioteca/assuntos.json?t=' + Date.now(), {cache: 'no-store'})
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { if (j && j.janelas) { ASS.js = j; if (j.assuntos && j.assuntos.length) I.ASSUNTOS_DEF = j.assuntos; } ASS.erro = null; })
      .catch(function (e) { ASS.erro = String((e && e.message) || e); })
      .then(function () { var mudou = !ASS.feito || ASS.para !== k || forcar; ASS.carregando = false; ASS.feito = true; ASS.para = k; if (mudou) redesenhar(); });
  }
  A.v4Assuntos = function () { return ASS; };  // para os testes
  var at0 = A.intelAtualizar;
  if (at0) A.intelAtualizar = function () { var r = at0.apply(this, arguments); Promise.resolve(r).then(function () { carregarAssuntos(true); }); return r; };

  /* ---------- filtro do Hoje (assunto ou ativo) ---------- */
  var FILTRO = null, DENTRO = false, SEL = null;
  function passa(x) {
    if (!FILTRO || !x) return true;
    if (FILTRO.k === 'ativo') return (x.ativos || []).indexOf(FILTRO.t) >= 0 || (x.ativos_vip || []).indexOf(FILTRO.t) >= 0;
    return I.assuntosDe(x.titulo).indexOf(FILTRO.id) >= 0;
  }
  ['itens', 'itensAtivo', 'itensResearch'].forEach(function (k) {
    var f0 = A[k]; if (!f0) return;
    A[k] = function () { var r = f0.apply(this, arguments); return FILTRO && DENTRO && Array.isArray(r) ? r.filter(passa) : r; };
  });
  function semFiltro(fn) { var d0 = DENTRO; DENTRO = false; try { return fn(); } finally { DENTRO = d0; } }
  A.v4Filtro = function () { return FILTRO; };
  A.v4Filtrar = function (f) {
    FILTRO = f || null; SEL = null;
    if (S.area !== 'hoje') A.go('hoje'); else A.render();
    requestAnimationFrame(function () { var el = document.querySelector(FILTRO ? '.v4-filtro' : '.v4-ass'); if (el) el.scrollIntoView({block: 'start', behavior: 'smooth'}); });
  };
  var go0 = A.go;
  A.go = function (area) { if (area !== 'hoje') FILTRO = null; return go0.apply(this, arguments); };
  function nomeFiltro(f) { return f.k === 'ativo' ? f.t : f.nome; }

  /* ---------- modelo dos assuntos: do robô; sem o arquivo, as últimas 24 h contadas aqui ---------- */
  var JAN = [['24h', '24 h', 'nas últimas 24 h'], ['7d', '7 dias', 'nos últimos 7 dias'], ['30d', '30 dias', 'nos últimos 30 dias']];
  function janelaAtual() { var j = A.lsGet ? A.lsGet('assuntos-janela', '24h') : '24h'; return JAN.some(function (o) { return o[0] === j; }) ? j : '24h'; }
  function tsPub(x) { var p = x && x.publicado_em; if (!p) return null; var t = Date.parse(p.length <= 10 ? p + 'T12:00:00-03:00' : p); return isFinite(t) ? t : null; }
  function modelo(jan) {
    var defs = (ASS.js && ASS.js.assuntos) || I.assuntosDefs(), nomes = {};
    defs.forEach(function (a) { nomes[a.id] = a.nome; });
    var j = ASS.js && ASS.js.janelas && ASS.js.janelas[jan];
    if (j) {
      var linhas = defs.map(function (a) { var o = (j.assuntos || {})[a.id] || {n: 0, fatia: 0, n_c: 0, fatia_c: 0, razao: null, tendencia: 'estavel'}; return Object.assign({id: a.id, nome: a.nome}, o); });
      return {fonte: 'robo', total: j.total, rotulo: j.rotulo, comp: j.comparacao || {}, linhas: ordenar(linhas)};
    }
    if (jan !== '24h') return null;
    var agora = Date.now(), cont = {}, tot = 0;
    semFiltro(function () { return A.itens ? A.itens() : []; }).forEach(function (x) {
      if (x.acervo || x.agrupado_em) return; var t = tsPub(x); if (t == null || agora - t > 864e5 || t - agora > 6 * 3600e3) return;
      tot++; I.assuntosDe(x.titulo).forEach(function (id) { cont[id] = (cont[id] || 0) + 1; });
    });
    return {fonte: 'painel', total: tot, rotulo: 'últimas 24 h', comp: {}, linhas: ordenar(defs.map(function (a) { return {id: a.id, nome: a.nome, n: cont[a.id] || 0, fatia: tot ? 100 * (cont[a.id] || 0) / tot : 0, tendencia: 'sem_base', razao: null}; }))};
  }
  function ordenar(l) { return l.slice().sort(function (a, b) { return (b.n - a.n) || a.nome.localeCompare(b.nome); }); }
  A.v4ModeloAssuntos = modelo;  // para os testes
  var TEND = {sobe: ['▲', 'acima do normal'], cai: ['▼', 'abaixo do normal'], novo: ['●', 'apareceu agora'], estavel: ['', 'no ritmo de sempre'], sem_base: ['', 'sem base de comparação ainda']};
  function chipTend(l) {
    var k = l.tendencia || 'estavel', t = TEND[k] || TEND.estavel;
    var txt = k === 'sobe' || k === 'cai' ? t[0] + ' ' + num(l.razao, 1) + '×' : k === 'novo' ? 'novo' : k === 'estavel' ? 'estável' : '—';
    return h('span', {class: 'v4-as-t t-' + k}, txt);
  }
  function explicaTend(l, m, janTxt) {
    if (l.tendencia === 'sem_base' || !m.comp.total) return m.fonte === 'painel' ? 'A comparação com os dias anteriores chega com a próxima rodada do robô.' : 'Ainda não há notícias suficientes para comparar (' + (m.comp.rotulo || 'período anterior') + ').';
    return 'É ' + num(l.fatia, 1) + '% das notícias ' + (janTxt || m.rotulo) + ', contra ' + num(l.fatia_c, 1) + '% nos ' + (m.comp.rotulo || 'dias anteriores') + ': ' + TEND[l.tendencia][1] + '.';
  }

  /* ---------- Hoje: "Assuntos do momento" ---------- */
  function itensDoAssunto(id, jan) {
    var lim = {'24h': 864e5, '7d': 7 * 864e5, '30d': 30 * 864e5}[jan] || 864e5, agora = Date.now();
    return semFiltro(function () { return A.itens ? A.itens() : []; }).filter(function (x) {
      if (x.acervo || x.agrupado_em) return false; var t = tsPub(x); if (t == null || agora - t > lim || t - agora > 6 * 3600e3) return false;
      return I.assuntosDe(x.titulo).indexOf(id) >= 0;
    }).sort(function (a, b) { return (tsPub(b) || 0) - (tsPub(a) || 0); });
  }
  function porDia(id) {
    var d = ASS.js && ASS.js.dias; if (!d) return null;
    var hoje = I.hojeBRT(), out = [];
    for (var k = 13; k >= 0; k--) { var dd = new Date(Date.parse(hoje + 'T12:00:00Z') - k * 864e5).toISOString().slice(0, 10), v = d[dd] || {t: 0, n: {}}; out.push({d: dd, n: (v.n || {})[id] || 0, t: v.t || 0}); }
    return out;
  }
  function detalhe(l, m, jan) {
    var defs = (ASS.js && ASS.js.assuntos) || I.assuntosDefs(), def = defs.filter(function (a) { return a.id === l.id; })[0] || {};
    var lista = itensDoAssunto(l.id, jan), janTxt = (JAN.filter(function (o) { return o[0] === jan; })[0] || JAN[0])[2];
    var corpo;
    if (lista.length) {
      corpo = h('div', {class: 'v4-as-lista'}, A.listaRows(lista.slice(0, 8), {}),
        lista.length > 8 ? A.more('Mostrar mais ' + Math.min(lista.length - 8, 40), A.listaRows(lista.slice(8, 48), {})) : null);
    } else {
      var ult = ((ASS.js && ASS.js.ultimos) || {})[l.id] || [];
      corpo = ult.length ? h('div', {class: 'v4-as-lista'}, h('p', {class: 'v4-as-sub'}, 'Mais recentes (de dias anteriores, ainda fora da memória desta aba):'),
        h('ul', {class: 'v4-as-ult'}, ult.slice(0, 10).map(function (u) {
          var x = A.itemPorId ? semFiltro(function () { return A.itemPorId(u.id); }) : null;
          return h('li', null, h('time', null, u.publicado_em ? A.dataBR(u.publicado_em).slice(0, 5) + (u.publicado_em.length > 10 ? ' ' + u.publicado_em.slice(11, 16) : '') : ''), h('span', {class: 'v4-as-org'}, u.organizacao || u.fonte || ''),
            x ? h('button', {type: 'button', onclick: function () { A.abrirItem(x); }}, u.titulo) : h('a', {href: u.link, target: '_blank', rel: 'noopener'}, u.titulo + ' ↗'));
        }))) : h('p', {class: 'v4-as-vz'}, 'Nenhuma notícia de ' + l.nome + ' ' + janTxt + '.');
    }
    var dias = porDia(l.id), mx = 0; (dias || []).forEach(function (o) { o.f = o.t ? o.n / o.t : 0; mx = Math.max(mx, o.f); }); mx = mx || 1;
    var sp = dias ? h('div', {class: 'v4-as-sp', role: 'img', 'aria-label': 'Fatia das notícias de cada dia que fala de ' + l.nome + ', últimos 14 dias: ' + dias.map(function (o) { return o.d.slice(8, 10) + '/' + o.d.slice(5, 7) + ' ' + num(100 * o.f, 1) + '%'; }).join(', ')},
      h('div', {class: 'v4-as-sp-b'}, dias.map(function (o) { return h('span', {title: o.d.slice(8, 10) + '/' + o.d.slice(5, 7) + ': ' + plural(o.n, 'notícia', 'notícias') + (o.t ? ' (' + num(100 * o.n / o.t, 1) + '% do dia)' : '')}, h('i', {style: 'height:' + Math.max(2, Math.round(o.f / mx * 46)) + 'px'})); })),
      h('div', {class: 'v4-as-sp-l'}, h('span', null, dias[0].d.slice(8, 10) + '/' + dias[0].d.slice(5, 7)), h('span', null, 'fatia das notícias de cada dia · 14 dias'), h('span', null, 'hoje'))) : null;
    return h('div', {class: 'v4-as-det', id: 'v4-as-det'},
      h('div', {class: 'v4-as-dh'},
        h('div', {class: 'v4-as-dt'}, h('h3', null, l.nome), h('p', null, h('b', null, plural(l.n, 'notícia', 'notícias')), ' ' + janTxt + '. ', explicaTend(l, m, janTxt))),
        h('div', {class: 'v4-as-db'},
          h('button', {type: 'button', class: 'v4-as-bf', onclick: function () { A.v4Filtrar({k: 'assunto', id: l.id, nome: l.nome}); }}, 'Filtrar o Hoje por ' + l.nome),
          h('button', {type: 'button', onclick: function () { A.go('bib', 'busca'); if (A.bibFiltro) A.bibFiltro({q: 'assunto:' + l.id}); }}, 'Ver todas na Biblioteca'),
          h('button', {type: 'button', class: 'v4-as-x', 'aria-label': 'Fechar as notícias de ' + l.nome, onclick: function () { SEL = null; A.rerender(); }}, '✕'))),
      sp, corpo,
      h('p', {class: 'v4-as-pal'}, 'Palavras procuradas no título: ' + (def.palavras || []).map(function (p) { return p.replace(/\*$/, '…'); }).concat(def.exatas || []).join(', ') + '.'));
  }
  A.v4Hero = function (fx) {
    return semFiltro(function () {
      var itens = A.itens ? A.itens() : [];
      var jan = janelaAtual(), m = modelo(jan), jt = (JAN.filter(function (o) { return o[0] === jan; })[0] || JAN[0])[2];
      if (!itens.length && !m) return null;
      var n24 = I.ultimas(itens, {horas: 24}).length;
      var seg = h('div', {class: 'v4-as-seg', role: 'radiogroup', 'aria-label': 'Período'}, JAN.map(function (o) {
        var ok = o[0] === '24h' || !!(ASS.js && ASS.js.janelas && ASS.js.janelas[o[0]]);
        return h('button', {type: 'button', role: 'radio', 'aria-checked': o[0] === jan ? 'true' : 'false', disabled: ok ? null : true, title: ok ? null : 'Chega com a próxima rodada do robô',
          onclick: function () { if (A.lsSet) A.lsSet('assuntos-janela', o[0]); A.rerender(); }}, o[1]);
      }));
      var alta = m ? m.linhas.filter(function (l) { return l.tendencia === 'sobe' || l.tendencia === 'novo'; }).sort(function (a, b) { return (b.razao || 99) - (a.razao || 99); }).slice(0, 3) : [];
      var cab = h('div', {class: 'v4-dia-h'}, h('h2', {id: 'v4-as-t'}, 'Assuntos do momento'),
        h('div', {class: 'v4-st'}, h('span', null, h('b', null, String(n24)), 'notícias em 24 h'), fx || null));
      var ctl = h('div', {class: 'v4-as-ctl'}, seg,
        alta.length ? h('p', {class: 'v4-as-alta'}, h('span', null, 'Acima do normal: '), alta.map(function (l, i) { return [i ? ' · ' : '', h('button', {type: 'button', onclick: function () { SEL = l.id; A.rerender(); }}, l.nome + (l.razao ? ' ' + num(l.razao, 1) + '×' : ''))]; })) : null);
      if (!m) return h('section', {class: 'v4-dia v4-ass', 'aria-labelledby': 'v4-as-t'}, cab, ctl, h('p', {class: 'v4-as-vz'}, 'Este período chega com a próxima rodada do robô.'));
      var mx = 1; m.linhas.forEach(function (l) { mx = Math.max(mx, l.n); });
      if (SEL && !m.linhas.some(function (l) { return l.id === SEL; })) SEL = null;
      var lst = h('div', {class: 'v4-as-l', role: 'list'}, m.linhas.map(function (l) {
        var pct = Math.round(100 * l.n / mx);
        return h('div', {role: 'listitem'}, h('button', {type: 'button', class: 'v4-as-r' + (l.n ? '' : ' zero') + (SEL === l.id ? ' sel' : ''), 'aria-expanded': SEL === l.id ? 'true' : 'false', 'aria-controls': 'v4-as-det',
          title: l.nome + ': ' + plural(l.n, 'notícia', 'notícias') + ' ' + m.rotulo + '. ' + (l.tendencia && l.tendencia !== 'sem_base' ? explicaTend(l, m, jt) : ''),
          onclick: function () { SEL = SEL === l.id ? null : l.id; A.rerender(); if (SEL) requestAnimationFrame(function () { var d = document.getElementById('v4-as-det'); if (d && d.getBoundingClientRect().top > innerHeight - 120) d.scrollIntoView({block: 'nearest', behavior: 'smooth'}); }); }},
          h('span', {class: 'v4-as-nm'}, l.nome),
          h('span', {class: 'v4-as-tr'}, h('span', {class: 'v4-as-b', style: 'width:' + Math.max(l.n ? 3 : 0, pct) + '%'}), h('b', {class: 'v4-as-n'}, String(l.n))),
          chipTend(l)));
      }));
      var selL = SEL ? m.linhas.filter(function (l) { return l.id === SEL; })[0] : null;
      var nota = h('p', {class: 'v4-as-nota'}, m.fonte === 'robo'
        ? 'Conta notícias, opiniões e estudos com as palavras do assunto no título, nas ' + m.rotulo + ' até a última coleta. A seta compara a fatia do assunto com a dos ' + (m.comp.rotulo || 'dias anteriores') + ' (▲ 1,5 vez ou mais; ▼ dois terços ou menos). Toque num assunto para ver as notícias.'
        : 'Contado neste navegador com as notícias das últimas 24 h; a comparação com os dias anteriores e os períodos de 7 e 30 dias chegam com a próxima rodada do robô. Toque num assunto para ver as notícias.');
      return h('section', {class: 'v4-dia v4-ass', 'aria-labelledby': 'v4-as-t'}, cab, ctl, lst, selL ? detalhe(selL, m, jan) : null, nota);
    });
  };

  /* ---------- Hoje: filtro, mapa, títulos, contagens, modo de leitura ---------- */
  var DESC = {
    'mercado-hoje': 'Macro do Brasil das últimas 18 horas: agenda do dia, juros, inflação, câmbio, bolsa e fiscal.',
    'radar': 'O que aconteceu com as empresas da carteira nas últimas 72 horas: resultados, documentos, opiniões e notícias.',
    'agenda-decisiva': 'Temporada de resultados, documentos das companhias, proventos e a agenda oficial de juros.',
    'research': 'Estudos, cartas e papers de gestoras, bancos centrais e instituições.',
    'debate': 'Opiniões de casas de análise e colaboradores, a favor e contra, e onde mais se discute.',
    'ultimas': 'Tudo o que o robô coletou, com filtros por carteira, Brasil, mundo e tipo de fonte.'
  };
  var CONTA = {'mercado-hoje': /·\s*(\d+)\s*$/, 'radar': /^(\d+)\s+acontec/, 'research': /^(\d+)/, 'debate': /^(\d+)\s+opini/, 'ultimas': /·\s*(\d+)\s*$/, 'agenda-decisiva': /^(\d+)/};
  var PROF_D = {rapida: 'Rápida: uma olhada no que mudou na carteira e no que vem pela frente, em listas curtas e sem Todas as notícias.',
    briefing: 'Briefing: a leitura do dia, com as quatro áreas da mesa, o paper da semana e as notícias do dia.',
    aprofundada: 'Aprofundada: tudo, com as listas mais longas e o estudo do dia aberto.'};
  var PROF_T = {rapida: 'Rápida: Radar 5, Mercado hoje 5, Agenda 4, Research 3, Debate 3; sem Todas as notícias.', briefing: 'Briefing: Radar 8, Mercado hoje 8, Agenda 6, Research 8, Debate 5, Todas as notícias 10.',
    aprofundada: 'Aprofundada: Radar 16, Mercado hoje 15, Agenda 10, Research 12, Debate 10, Todas as notícias 30 e o estudo do dia aberto.'};
  function posHoje(w) {
    var hero = w.querySelector('.v4-ass');
    // a. faixa do filtro
    if (FILTRO) {
      var n = (function () { DENTRO = true; try { return (A.itensAtivo ? A.itensAtivo() : A.itens()).length; } finally { DENTRO = false; } })();
      var fx = h('div', {class: 'v4-filtro', role: 'status'},
        h('p', null, 'Mostrando só o que fala de ', h('b', null, nomeFiltro(FILTRO)), ' · ' + plural(n, 'item', 'itens') + ' nas seções abaixo.'),
        h('div', {class: 'v4-filtro-b'}, FILTRO.k === 'ativo' && A.abrirFicha ? h('button', {type: 'button', class: 'btn sm', onclick: function () { A.abrirFicha(FILTRO.t); }}, 'Ficha de ' + FILTRO.t) : null,
          h('button', {type: 'button', class: 'btn sm pri', onclick: function () { A.v4Filtrar(null); }}, 'Limpar filtro ✕')));
      if (hero && hero.parentNode === w) hero.after(fx); else w.insertBefore(fx, w.firstChild.nextSibling);
      w.classList.add('v4-filtrando');
      // seções sem nenhuma notícia do filtro ficam fora da vista enquanto ele está ligado (voltam no "Limpar")
      var vazias = [];
      [['mercado-hoje', 'Mercado hoje'], ['radar', 'Radar das teses'], ['research', 'Research global'], ['debate', 'Debate de mercado'], ['ultimas', 'Todas as notícias']].forEach(function (o) {
        var sec = w.querySelector('#' + o[0]); if (!sec || sec.querySelector('[data-id]')) return;
        sec.classList.add('v4-sem-filtro'); vazias.push(o[1]);
      });
      if (vazias.length) fx.firstChild.appendChild(h('span', {class: 'v4-filtro-v'}, ' Sem nada de ' + nomeFiltro(FILTRO) + ' em: ' + vazias.join(', ') + '.'));
      // a linha da coleta continua contando todas as notícias das últimas 24 h, não só as do filtro
      var st = w.querySelectorAll('.mesa-h .status-l > b'); if (st[1]) st[1].textContent = String(I.ultimas(A.itens ? A.itens() : [], {horas: 24}).length);
      // o "Nesta página" fica preso no alto ao rolar: o filtro aparece ali também, para não ser esquecido
      var sm = w.querySelector('nav.sumario');
      if (sm) { var sf = h('button', {type: 'button', class: 'v4-sf', title: 'Limpar o filtro', onclick: function () { A.v4Filtrar(null); }}, 'Filtro: ' + nomeFiltro(FILTRO) + ' ✕'); var lab = sm.querySelector('.muted'); if (lab) lab.after(sf); else sm.insertBefore(sf, sm.firstChild); }
    }
    // a. mapa da carteira: o quadrado filtra o Hoje pelo ativo (a ficha fica na faixa do filtro)
    Array.prototype.forEach.call(w.querySelectorAll('#atencao .atn-t'), function (b) {
      var t = (b.querySelector('b') || {}).textContent; if (!t) return;
      b.title = (b.title || '').replace(/\s*Toque para as notícias\.?$/, '') + ' Toque para ver só o que fala de ' + t + ' no Hoje.';
      b.setAttribute('aria-pressed', FILTRO && FILTRO.k === 'ativo' && FILTRO.t === t ? 'true' : 'false');
    });
    if (!w.__v4Mapa) {
      w.__v4Mapa = true;
      w.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('#atencao .atn-t') : null; if (!b || !A.v4()) return;
        var t = (b.querySelector('b') || {}).textContent; if (!t) return;
        ev.stopPropagation(); ev.preventDefault();
        A.v4Filtrar(FILTRO && FILTRO.k === 'ativo' && FILTRO.t === t ? null : {k: 'ativo', t: t});
      }, true);
    }
    // 2. linha do que tem em cada seção
    Object.keys(DESC).forEach(function (id) {
      var cab = w.querySelector('#' + id + ' > header'); if (!cab || cab.querySelector('.v4-desc')) return;
      cab.appendChild(h('p', {class: 'v4-desc'}, DESC[id]));
    });
    // c. "Nesta página" com a contagem
    Array.prototype.forEach.call(w.querySelectorAll('nav.sumario a[href^="#"]'), function (a) {
      var id = a.getAttribute('href').slice(1), rx = CONTA[id], ar = w.querySelector('#' + id + ' > header .ar-n'), v = null;
      if (w.querySelector('#' + id + '.v4-sem-filtro')) { a.hidden = true; return; }
      if (rx && ar) { var mm = rx.exec(ar.textContent.trim()); if (mm) v = mm[1]; }
      if (id === 'alertas') { var fl = w.querySelector('#fila h2, #fila h3'); var mf = fl && /(\d+)\s*$/.exec(fl.textContent.trim()); if (mf) v = mf[1]; }
      if (v != null && !a.querySelector('.v4-sn')) a.appendChild(h('span', {class: 'v4-sn'}, v));
    });
    // modo de leitura: o que o escolhido mostra
    var pr = A.prof ? A.prof() : 'briefing', ctl = w.querySelector('.mesa-h');
    Array.prototype.forEach.call(w.querySelectorAll('.prof button'), function (b) { var k = {'Rápida': 'rapida', 'Briefing': 'briefing', 'Aprofundada': 'aprofundada'}[b.textContent.trim()]; if (k) b.title = PROF_T[k]; });
    if (ctl && PROF_D[pr] && !ctl.querySelector('.v4-prof-d')) ctl.appendChild(h('p', {class: 'v4-prof-d'}, PROF_D[pr]));
  }
  var hj0 = A.areas.hoje;
  A.areas.hoje = function () {
    if (!A.v4()) return hj0.apply(this, arguments);
    carregarAssuntos(false);
    DENTRO = !!FILTRO;
    var w;
    try { w = hj0.apply(this, arguments); } finally { DENTRO = false; }
    if (w && w.querySelector) { try { posHoje(w); } catch (e) { console.error(e); } }
    return w;
  };

  /* ---------- ETFs de renda fixa do Brasil (pilares P1 a P4): juros, inflação e fiscal na coluna de notícias ----------
     Pedido do Lucas em 10/11/2026: a lateral do 5PRE11 parecia parada porque só entra o que cita o índice ou a curva
     ("juros futuros", "DI futuro"). Agora vem também o que move a curva: as notícias de juros, inflação e fiscal do
     Mercado hoje (marcação do robô, x.macro_br), das últimas 72 horas. Vale nos dois visuais. */
  var MACRO_RF = ['juros', 'inflacao', 'fiscal'], NPX = {};
  function rfBR(t) { var a = C.ATV[t]; return !!(a && A.ehETF && A.ehETF(t) && /^P[1-4]$/.test(a.pilar || '')); }
  A.v4RendaFixaBR = rfBR;
  var np0 = A.noticiasPainel;
  if (np0) A.noticiasPainel = function (t) {
    var box = np0.apply(this, arguments);
    if (!box || !box.querySelector || !rfBR(t)) return box;
    try {
      var l = I.ultimas(A.itens ? A.itens() : [], {horas: 72, filtro: 'macro'}).filter(function (x) { return !I.desconhecido(x) && I.macroBR(x).some(function (k) { return MACRO_RF.indexOf(k) >= 0; }); });
      l = I.agruparFatos(l, 72).map(function (g) { return g.x; });
      var n = NPX[t] || 6;
      var bloco = h('div', {class: 'np-rf'}, h('h4', {class: 'np-sub'}, 'Juros, inflação e fiscal no Brasil' + (l.length ? ' · ' + l.length : '')),
        h('p', {class: 'hint', style: 'margin:0 0 4px'}, 'Do Mercado hoje, últimas 72 horas: o que move a curva de juros e, por ela, os ETFs de renda fixa. Não cita o fundo.'),
        l.length ? h('ul', {class: 'nls'}, l.slice(0, n).map(function (x) { return A.itemLinha(x, t); })) : h('p', {class: 'muted np-vz'}, 'Nenhuma notícia de juros, inflação ou fiscal do Brasil nas últimas 72 horas.'),
        l.length > n ? h('button', {class: 'btn link', onclick: function () { NPX[t] = n + 10; A.rerender(); }}, 'Mostrar mais ' + Math.min(10, l.length - n)) : null);
      var alvo = null;
      Array.prototype.forEach.call(box.querySelectorAll('h4.np-sub'), function (t4) { if (/Índice e tema do ETF/.test(t4.textContent)) alvo = t4.parentNode; });
      if (!alvo) alvo = box.querySelector('.np-op');
      if (alvo && alvo.parentNode === box) alvo.after(bloco); else box.appendChild(bloco);
    } catch (e) { console.error(e); }
    return box;
  };

  /* ---------- busca: assuntos do momento, ativos e últimas buscas ---------- */
  function recentes() { var l = A.lsGet ? A.lsGet('buscas-recentes', []) : []; return Array.isArray(l) ? l.filter(function (x) { return typeof x === 'string'; }) : []; }
  var bu0 = A.busca;
  A.busca = function () {
    var ja = document.querySelector('.cmdk-bg'), r = bu0.apply(this, arguments);
    if (ja || !A.v4()) return r;
    var bg = document.querySelector('.cmdk-bg'), box = bg && bg.querySelector('.cmdk'), inp = box && box.querySelector('input'), ul = box && box.querySelector('ul');
    if (!ul || !inp) return r;
    function fechar() { bg.remove(); }
    var m = modelo('24h'), top = m ? m.linhas.filter(function (l) { return l.n > 0; }).slice(0, 8) : [];
    var ats = Array.prototype.map.call(document.querySelectorAll('#atencao .atn-t b'), function (b) { return b.textContent.trim(); });
    if (!ats.length && A.ativosRecentes) ats = A.ativosRecentes();
    ats = ats.filter(function (t, i, l) { return C.ATV[t] && l.indexOf(t) === i; }).slice(0, 10);
    var rec = recentes();
    var blocos = [];
    if (top.length) blocos.push(h('div', {class: 'v4-ck-g'}, h('p', {class: 'v4-ck-t'}, 'Assuntos do momento · 24 h'), h('div', {class: 'v4-ck-l'}, top.map(function (l) {
      return h('button', {type: 'button', title: 'Mostra no Hoje só o que fala de ' + l.nome, onclick: function () { fechar(); A.v4Filtrar({k: 'assunto', id: l.id, nome: l.nome}); }}, l.nome, h('small', null, String(l.n)));
    }))));
    if (ats.length) blocos.push(h('div', {class: 'v4-ck-g'}, h('p', {class: 'v4-ck-t'}, 'Ativos da carteira'), h('div', {class: 'v4-ck-l'}, ats.map(function (t) {
      return h('button', {type: 'button', class: 'tk', title: 'Mostra no Hoje só o que fala de ' + t + ' (a ficha abre pela faixa do filtro)', onclick: function () { fechar(); A.v4Filtrar({k: 'ativo', t: t}); }}, t);
    }))));
    if (rec.length) blocos.push(h('div', {class: 'v4-ck-g'}, h('p', {class: 'v4-ck-t'}, 'Últimas buscas'), h('div', {class: 'v4-ck-l'}, rec.map(function (q) {
      return h('button', {type: 'button', onclick: function () { inp.value = q; inp.dispatchEvent(new Event('input')); inp.focus(); }}, q);
    }))));
    if (!blocos.length) return r;
    var at = h('div', {class: 'v4-ck'}, blocos);
    box.insertBefore(at, ul);
    function mostra() { at.hidden = !!inp.value.trim(); }
    inp.addEventListener('input', mostra); mostra();
    function grava() { var q = inp.value.trim(); if (q.length < 2 || !A.lsSet) return; var l = recentes().filter(function (x) { return x !== q; }); l.unshift(q); A.lsSet('buscas-recentes', l.slice(0, 6)); }
    ul.addEventListener('click', grava, true);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') grava(); }, true);
    return r;
  };
})(APP, CORE, INTEL);
