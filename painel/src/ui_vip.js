/* VG VIP — aba separada para as carteiras VG VIP (Dividendos, Valor e Smallcaps). A mesma ideia da Oregon, só com os ativos
   VIP: Hoje VIP (mapa de atenção, radar das teses, agenda e debate), Ativos (todas as colunas do print e a ficha de cada
   ativo com notícias, opiniões e casas de análise) e Pauta da semana por carteira.
   Os números vêm do print enviado pelo Lucas (painel/src/vip.json): preço e variação do dia ficam congelados na data do
   print; nada é recalculado nem inventado. As notícias dos ativos que só existem na VIP chegam do robô em ativos_vip, à
   parte da Oregon: nada desta aba entra nas telas da Oregon, e vice-versa. */
(function (A, C, I) {
  'use strict';
  var h = A.h, S = A.S;
  var VD = typeof VIP_DATA !== 'undefined' && VIP_DATA ? VIP_DATA : {carteiras: []};
  var CARTS = VD.carteiras || [];
  // identidade de cada carteira (ordem fixa da paleta validada); o nome vem sempre escrito ao lado
  var COR_CART = ['#2a78d6', '#eb6834', '#1baf7a'];
  function corCart(id) { var i = CARTS.map(function (c) { return c.id; }).indexOf(id); return COR_CART[i] || '#888'; }
  var ATV = {}, ORDEM = [];
  CARTS.forEach(function (c) { (c.ativos || []).forEach(function (a) { var o = Object.assign({cart: c.id, cartNome: c.curto || c.nome}, a); ATV[a.ticker] = o; ORDEM.push(a.ticker); }); });
  function tkN(t) { var a = ATV[t]; return (a && a.noticias_de) || t; }  // INBR32 lê as notícias de INBR34 (a mesma Inter&Co)
  function nome(t) { var a = ATV[t]; return a ? a.empresa : t; }
  function E() { return A.intel; }
  function itens() { return A.todosItensAtivo ? A.todosItensAtivo() : A.itensAtivo(); }
  var CACHE = {k: null, m: {}};
  function conteudo(t) {
    var k = (E().versao && E().versao.gerado_em) + '|' + Object.keys(E().meses || {}).length + '|' + A.opinioes12m().length + '|' + A.itens().length;
    if (CACHE.k !== k) { CACHE.k = k; CACHE.m = {}; }
    return CACHE.m[t] || (CACHE.m[t] = I.doAtivoVip(itens(), tkN(t)));
  }
  var SEM_DADOS = 'Sem dados do robô nesta visualização.';
  function semDados() { return !E().versao && !A.itens().length; }
  function ts(x) { var p = I.pub(x); return Date.parse(p.length <= 10 ? p + 'T12:00:00-03:00' : p) || 0; }
  function dentro(x, horas) { if (!x.publicado_em || x.acervo || x.agrupado_em) return false; var t = ts(x), n = Date.now(); return n - t <= horas * 3600e3 && t - n < 6 * 3600e3; }
  function rs(v) { return v == null ? '—' : 'R$ ' + A.num(v, 2); }
  function pc(v, sinal) { return v == null ? '—' : (sinal ? A.snum(v, 2) : A.num(v, 2)) + '%'; }
  function printBR() { var d = VD.print_em || ''; return d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : 's/ data'; }
  function riscoChip(r) { return h('span', {class: 'vip-risco r-' + String(r || '').toLowerCase(), title: 'Risco (classificação da plataforma VG)'}, r || '—'); }
  function sugChip(s) { return h('span', {class: 'vip-sug s-' + String(s || '').toLowerCase()}, s || '—'); }
  function cartChip(id) { var c = CARTS.filter(function (x) { return x.id === id; })[0] || {}; return h('span', {class: 'vip-cart'}, h('i', {style: 'background:' + corCart(id), 'aria-hidden': 'true'}), c.curto || c.nome || id); }
  function tkBtn(t) { return h('button', {class: 'tag tk', onclick: function (e) { e.stopPropagation(); abrir(t); }}, t); }
  function vazio(txt) { return h('p', {class: 'empty sm'}, txt); }

  // Acontecimentos de ativos VIP numa janela: fato da empresa (CVM, resultado), opinião publicada ou notícia da empresa
  var TIPOS = {cvm: ['Documento à CVM', 'fato'], resultado: ['Resultado', 'fato'], opiniao: ['Opinião publicada', 'opiniao'], noticia: ['Notícia da empresa', 'noticia']};
  var PESO = {cvm: 3, resultado: 3, opiniao: 3, noticia: 2};
  function tipoEv(x, t) { if (x.categoria === 'oficial_empresa') return 'cvm'; if (x.natureza === 'opiniao_casa') return 'opiniao'; return I.vinculoVip(x, t).evento === 'resultado' ? 'resultado' : 'noticia'; }
  function eventos(horas) {
    var out = [], vis = {};
    itens().forEach(function (x) {
      if (vis[x.id] || !dentro(x, horas)) return; vis[x.id] = 1;
      var l = ORDEM.filter(function (t) { var n = tkN(t); return I.temVip(x, n) && I.vinculoVip(x, n).tipo === 'direto'; }).map(function (t) { return {t: t, k: tipoEv(x, tkN(t))}; });
      if (l.length) out.push({x: x, ts: l, k: l[0].k});
    });
    return out;
  }
  function mecanismo(ev) {
    var x = ev.x, k = ev.k, tk = ev.ts.map(function (r) { return r.t; });
    var txt = k === 'cvm' ? 'Fato da empresa: ' + (x.tipo === 'fato_relevante' ? 'fato relevante' : (x.categoria_cvm || 'documento').toLowerCase()) + ' entregue à CVM'
      : k === 'resultado' ? 'Fato da empresa: resultado, pela manchete'
      : k === 'opiniao' ? 'Opinião publicada' + ((x.casas || []).length ? ' por ' + x.casas.join(', ') : '') + (x.posicao ? ', ' + I.POSICAO[x.posicao] : '')
      : 'Notícia em que ' + tk.map(nome).join(', ') + (tk.length > 1 ? ' são' : ' é') + ' o assunto';
    return h('span', {class: 'nr-mec m-' + TIPOS[k][1]}, txt);
  }
  // na aba VIP, os códigos da linha abrem a ficha VIP (nunca a da Oregon); o mecanismo fica abaixo do título
  function extraEv(porId) { return function (x) { var ev = porId[x.id]; return ev ? mecanismo(ev) : null; }; }
  function alvoEv(porId) { return function (x) { var ev = porId[x.id]; if (!ev) return null; var l = ev.ts.slice(0, 2).map(function (r) { return tkBtn(r.t); }); if (ev.ts.length > 2) l.push(h('span', {class: 'nr-mais'}, '+' + (ev.ts.length - 2))); return l; }; }

  // Mapa de atenção VIP: todos os ativos das três carteiras, inclusive os sem acontecimento (o silêncio também é informação)
  function mapa(ev7) {
    var por = {};
    ev7.forEach(function (ev) { ev.ts.forEach(function (r) { var o = por[r.t] = por[r.t] || {n: 0, k: {}}; o.n++; o.k[r.k] = (o.k[r.k] || 0) + 1; }); });
    var mx = Math.max.apply(null, [1].concat(Object.keys(por).map(function (t) { return por[t].n; })));
    function cur(k, n) { return n + ' ' + ({resultado: n > 1 ? 'resultados' : 'resultado', cvm: 'CVM', opiniao: n > 1 ? 'opiniões' : 'opinião', noticia: n > 1 ? 'notícias' : 'notícia'})[k]; }
    return h('div', {class: 'vip-mapa'}, CARTS.map(function (c) {
      var l = (c.ativos || []).map(function (a) { return a.ticker; }).sort(function (a, b) { return ((por[b] || {}).n || 0) - ((por[a] || {}).n || 0) || a.localeCompare(b); });
      return h('div', {class: 'vip-mapa-c'}, h('p', {class: 'vip-mapa-h'}, cartChip(c.id), h('span', {class: 'muted'}, ' · ' + l.filter(function (t) { return por[t]; }).length + ' de ' + l.length + ' com acontecimentos')),
        // v3.7 · mapa enxuto: quadrado só para quem teve acontecimento; os demais numa linha, cada código abre a ficha
        (function () { var com = l.filter(function (t) { return por[t]; }), sem = l.filter(function (t) { return !por[t]; });
          return [com.length ? h('div', {class: 'atn', role: 'list'}, com.map(function (t) {
            var o = por[t], nivel = Math.min(4, Math.ceil(4 * o.n / mx)), det = ['resultado', 'cvm', 'opiniao', 'noticia'].filter(function (k) { return o.k[k]; }).slice(0, 2).map(function (k) { return cur(k, o.k[k]); });
            return h('button', {class: 'atn-t n' + nivel, role: 'listitem', title: nome(t) + ': ' + det.join(', ') + '. Toque para a ficha.', onclick: function () { abrir(t); }},
              h('b', null, t), h('span', {class: 'atn-n'}, String(o.n)), h('small', null, det.join(' · ')));
          })) : null,
          sem.length ? h('p', {class: 'atn-zero'}, h('span', {class: 'muted'}, 'sem notícias: '), sem.map(function (t) { return h('button', {class: 'atn-z', title: nome(t) + ': nada nos últimos 7 dias. Toque para a ficha.', onclick: function () { abrir(t); }}, t); })) : null]; })());
    }));
  }

  // Temporada de resultados dos ativos VIP (dados abertos da CVM lidos pelo robô e documentos de resultado no IPE)
  function trimestreAtual() { var d = new Date(Date.now() - 20 * 864e5), q = Math.floor(d.getUTCMonth() / 3); if (q === 0) return '4T' + String(d.getUTCFullYear() - 1).slice(2); return q + 'T' + String(d.getUTCFullYear()).slice(2); }
  function temporada() {
    var res = E().res && E().res.empresas, tri = trimestreAtual(), rx = new RegExp('resultad[^:]*' + tri + '|' + tri + '.{0,40}resultad|release.{0,30}' + tri + '|' + tri + '.{0,20}(itr|dfp)', 'i');
    var todosIt = itens();
    if (!res && !todosIt.some(function (x) { return x.categoria === 'oficial_empresa'; })) return vazio('Temporada de resultados: sem dados da CVM nesta visualização.');
    var linhas = ORDEM.map(function (t) {
      var n = tkN(t), r = res && res[n], tri0 = r && (r.trimestres || []).slice(-1)[0];
      var doc = todosIt.filter(function (x) { return x.categoria === 'oficial_empresa' && I.temVip(x, n) && rx.test(x.titulo); })[0];
      return {t: t, ok: (tri0 && tri0.periodo === tri) || !!doc, doc: doc, itr: tri0 && tri0.periodo === tri};
    });
    var feitos = linhas.filter(function (l) { return l.ok; }).length;
    return h('div', {class: 'tmp'}, h('p', {class: 'ar-k'}, 'Temporada do ' + tri + ' · ' + feitos + ' de ' + linhas.length + ' entregaram à CVM'),
      h('div', {class: 'tmp-l'}, linhas.sort(function (a, b) { return (a.ok - b.ok) || a.t.localeCompare(b.t); }).map(function (l) {
        return h('button', {class: 'tmp-t' + (l.ok ? ' ok' : ''), title: l.ok ? (l.itr ? 'ITR do ' + tri + ' nos dados abertos da CVM' : 'Documento de resultado no IPE da CVM: ' + l.doc.titulo) : 'Ainda sem o ' + tri + ' nos dados da CVM lidos pelo robô', onclick: function () { if (l.doc) A.abrirItem(l.doc); else abrir(l.t); }}, h('i', {'aria-hidden': 'true'}), l.t);
      })),
      h('p', {class: 'tmp-n'}, 'Dados abertos da CVM (ITR e DFP) e documentos de resultado das companhias, pelo CNPJ de cada empresa.'));
  }
  function area(id, cls, titulo, conta, corpo, mais) {
    return h('section', {class: 'ar ' + cls, id: id, 'aria-labelledby': id + '-t'}, h('header', null, h('h2', {id: id + '-t'}, titulo), conta != null ? h('span', {class: 'ar-n'}, conta) : null, mais || null), h('div', {class: 'ar-b'}, corpo));
  }
  function avisoPrint() {
    return h('p', {class: 'vip-print'}, 'Números do print de ' + printBR() + ' (preço e variação do dia congelados nessa data). Para atualizar, mande o print novo das três carteiras.');
  }

  /* ---------- Hoje VIP ---------- */
  function hoje() {
    var wrap = h('div', {class: 'hoje vip'}), n = ORDEM.length;
    wrap.appendChild(A.pageHead('VG VIP', 'Hoje nas carteiras VIP', n + ' ativos em ' + CARTS.length + ' carteiras (' + CARTS.map(function (c) { return (c.curto || c.nome) + ' ' + (c.ativos || []).length; }).join(', ') + '). Só os ativos VIP: nada aqui entra nas telas da Oregon.'));
    wrap.appendChild(avisoPrint());
    var fx = A.intelFaixa && A.intelFaixa(); if (fx) wrap.appendChild(fx);
    var ev7 = eventos(168);
    wrap.appendChild(h('section', {class: 'atencao', id: 'vip-atencao', 'aria-labelledby': 'vip-atn-t'}, h('header', null, h('h2', {id: 'vip-atn-t'}, 'Mapa de atenção das carteiras VIP'), h('span', {class: 'ar-n'}, '7 dias'),
      h('span', {class: 'atn-leg'}, 'Acontecimentos em que o ativo é o assunto (resultado, documento à CVM, opinião, notícia). Quantidade não é risco nem oportunidade.')), mapa(ev7)));
    var mesa = h('div', {class: 'mesa'}); wrap.appendChild(mesa);
    // Radar (72 h): veículo pouco conhecido sem fato da empresa fica recolhido
    var ev72 = eventos(72), baixa = ev72.filter(function (o) { return I.baixaRelevancia(o.x); }), ev = ev72.filter(function (o) { return !I.baixaRelevancia(o.x); })
      .sort(function (a, b) { return (PESO[b.k] - PESO[a.k]) || (ts(b.x) - ts(a.x)); }).slice(0, 14).sort(function (a, b) { return ts(b.x) - ts(a.x); });
    var porId = {}; ev.concat(baixa).forEach(function (o) { porId[o.x.id] = o; });
    mesa.appendChild(area('vip-radar', 'a-radar', 'Radar das teses VIP', ev.length ? ev.length + ' acontecimentos · 72 h' : '72 h', h('div', null,
      ev.length ? A.listaRows(ev.map(function (o) { return o.x; }), {extra: extraEv(porId), alvo: alvoEv(porId)}) : vazio(semDados() ? SEM_DADOS : 'Nenhum ativo VIP foi assunto de notícia, documento ou opinião de fonte conhecida nas últimas 72 h.'),
      baixa.length ? A.more('Mostrar ' + baixa.length + ' de baixa relevância', A.listaRows(baixa.map(function (o) { return o.x; }), {extra: extraEv(porId), alvo: alvoEv(porId), max: 20})) : null),
      h('button', {class: 'btn link ar-mais', onclick: function () { A.go('vip', 'pauta'); }}, 'Pauta da semana ↗')));
    // Agenda: temporada e documentos à CVM (7 dias)
    var vis = {}, docs = itens().filter(function (x) { return x.categoria === 'oficial_empresa' && dentro(x, 168) && ORDEM.some(function (t) { return I.temVip(x, tkN(t)); }); }).sort(function (a, b) { return ts(b) - ts(a); })
      .filter(function (x) { var k = x.titulo + '|' + I.pub(x).slice(0, 10); if (vis[k]) return false; vis[k] = 1; return true; });
    mesa.appendChild(area('vip-agenda', 'a-agenda', 'Agenda das companhias VIP', null, h('div', null, temporada(),
      h('h3', {class: 'ar-sub'}, 'Documentos das companhias · 7 dias'), docs.length ? A.listaLinhas(docs, 8) : vazio(semDados() ? SEM_DADOS : 'Nenhum documento das companhias VIP na CVM nos últimos 7 dias.'))));
    // Debate: opiniões publicadas sobre ativos VIP (14 dias)
    var ops = itens().filter(function (x) { return x.natureza === 'opiniao_casa' && dentro(x, 336) && ORDEM.some(function (t) { var n0 = tkN(t); return I.temVip(x, n0) && I.vinculoVip(x, n0).tipo === 'direto'; }); }).sort(function (a, b) { return ts(b) - ts(a); });
    var fav = ops.filter(function (x) { return x.posicao === 'favoravel'; }).length, con = ops.filter(function (x) { return x.posicao === 'contraria'; }).length;
    var porOp = {}; eventos(336).forEach(function (o) { porOp[o.x.id] = o; });
    mesa.appendChild(area('vip-debate', 'a-debate', 'Debate sobre os ativos VIP', ops.length ? ops.length + ' opiniões · 14 dias' : null, h('div', null,
      ops.length ? h('p', {class: 'deb-h'}, h('span', {class: 'pol p-favoravel'}, fav + ' a favor'), h('span', {class: 'pol p-contraria'}, con + ' contra'), h('span', {class: 'pol'}, (ops.length - fav - con) + ' neutras ou sem sentido no título')) : null,
      ops.length ? A.listaRows(ops.slice(0, 10), {abrir: true, dias: false, extra: extraEv(porOp), alvo: alvoEv(porOp)}) : vazio(semDados() ? SEM_DADOS : 'Nenhuma opinião de casa sobre os ativos VIP nas manchetes dos últimos 14 dias.'))));
    return wrap;
  }

  /* ---------- Ativos: todas as colunas do print, por carteira ---------- */
  var AT = {cart: '', t: null};
  function colunas(cart) {
    var c = [
      {k: 'rank', t: '#', r: 1, title: 'Posição na carteira (ranking do print)'},
      {k: 'ticker', t: 'Ativo', f: function (r) { return h('span', {class: 'vip-tk'}, h('b', null, r.ticker), h('small', null, r.empresa)); }},
      {k: 'setor', t: 'Setor'},
      {k: 'preco', t: 'Preço', r: 1, title: 'Preço do print', f: function (r) { return r.preco == null ? h('span', {class: 'muted', title: r.preco_nota || ''}, 'sem cotação') : rs(r.preco); }},
      {k: 'var_dia', t: 'Var. dia', r: 1, title: 'Variação do dia no print', f: function (r) { return r.var_dia == null ? '—' : h('span', {class: A.cls(r.var_dia)}, pc(r.var_dia, true)); }},
      {k: 'teto', t: 'Teto', r: 1, f: function (r) { return rs(r.teto); }},
      {k: 'justo', t: 'Justo', r: 1, f: function (r) { return rs(r.justo); }},
      {k: 'alocacao', t: 'Alocação', r: 1, f: function (r) { return pc(r.alocacao); }},
      {k: 'risco', t: 'Risco', f: function (r) { return riscoChip(r.risco); }, s: function (r) { return {AAA: 3, A: 2, B: 1}[r.risco] || 0; }},
      {k: 'dy', t: 'DY', r: 1, f: function (r) { return pc(r.dy); }}
    ];
    if (!cart || cart === 'dividendos') c.push({k: 'dy_pago_2026', t: 'DY pago 2026', r: 1, f: function (r) { return r.dy_pago_2026 == null ? (r.cart === 'dividendos' ? '—' : '') : pc(r.dy_pago_2026); }});
    return c.concat([
      {k: 'entrada', t: 'Entrada', f: function (r) { return r.entrada || '—'; }, s: function (r) { var m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(r.entrada || ''); return m ? m[3] + m[2] + m[1] : null; }},
      {k: 'preco_entrada', t: 'Preço ent. ajust.', r: 1, f: function (r) { return rs(r.preco_entrada); }},
      {k: 'retorno', t: 'Retorno total', r: 1, f: function (r) { return r.retorno == null ? '—' : h('span', {class: A.cls(r.retorno)}, pc(r.retorno, true)); }},
      {k: 'sugestao', t: 'Sugestão', f: function (r) { return sugChip(r.sugestao); }},
      {k: 'desc_teto', t: 'Desc. p/ teto', r: 1, f: function (r) { return r.desc_teto == null ? '—' : h('span', {class: A.cls(r.desc_teto)}, pc(r.desc_teto, true)); }},
      {k: 'pot_val', t: 'Pot. val.', r: 1, f: function (r) { return r.pot_val == null ? '—' : h('span', {class: A.cls(r.pot_val)}, pc(r.pot_val, true)); }},
      {k: 'n7', t: 'Notícias 7d', r: 1, title: 'Acontecimentos em que o ativo é o assunto, 7 dias (robô)'}
    ]);
  }
  function linhas(cart) {
    var n7 = {}; eventos(168).forEach(function (ev) { ev.ts.forEach(function (r) { n7[r.t] = (n7[r.t] || 0) + 1; }); });
    return ORDEM.filter(function (t) { return !cart || ATV[t].cart === cart; }).map(function (t) { return Object.assign({n7: n7[t] || 0}, ATV[t]); });
  }
  function ativos() {
    if (AT.t && ATV[AT.t]) return ficha(AT.t);
    var wrap = h('div');
    wrap.appendChild(A.pageHead('VG VIP', 'Ativos das carteiras VIP', 'Todas as colunas do print, por carteira. Toque num ativo para a ficha com notícias, opiniões e casas de análise.'));
    wrap.appendChild(avisoPrint());
    wrap.appendChild(h('div', {class: 'sub filt', role: 'toolbar', 'aria-label': 'Carteira'}, [['', 'Todas']].concat(CARTS.map(function (c) { return [c.id, c.curto || c.nome]; })).map(function (o) {
      return h('button', {'aria-pressed': AT.cart === o[0] ? 'true' : 'false', onclick: function () { AT.cart = o[0]; A.rerender(); }}, o[0] ? h('i', {class: 'vip-dot', style: 'background:' + corCart(o[0]), 'aria-hidden': 'true'}) : null, o[1]);
    })));
    var cs = AT.cart ? CARTS.filter(function (c) { return c.id === AT.cart; }) : CARTS;
    cs.forEach(function (c) {
      var soma = c.soma_alocacao != null ? c.soma_alocacao : null;
      wrap.appendChild(A.sec(c.nome, {badge: h('span', {class: 'sec-n'}, (c.ativos || []).length + ' ativos' + (soma != null ? ' · alocação somada ' + A.num(soma, 0) + '%' : '') + (c.reserva_liquidez ? ' · reserva de liquidez ' + A.num(c.reserva_liquidez, 0) + '%' : '')), flush: true, cls: 'vip-sec'},
        h('div', {class: 'vip-tw'}, A.table(colunas(c.id), linhas(c.id), {sort: 'rank', dir: 1, onRow: function (r) { abrir(r.ticker); }, rowClass: function (r) { return 'vip-row c-' + r.cart; }}))));
    });
    wrap.appendChild(h('p', {class: 'hint'}, 'Retorno, desconto para o teto e potencial são os números do print, como a plataforma mostra (não recalculados aqui). Risco, sugestão e alocação são da VG Research.'));
    return wrap;
  }

  /* ---------- Ficha do ativo VIP ---------- */
  var NP = {};
  function listaG(t, chave, l, max) {
    var k = t + ':' + chave, n = NP[k] || max, g = A.linhasAgrupadas(l, tkN(t), n);
    return h('div', null, g.ul, g.n > n ? h('button', {class: 'btn link', onclick: function () { NP[k] = n + 12; A.rerender(); }}, 'Mostrar mais ' + Math.min(12, g.n - n)) : null);
  }
  function linksBusca(t) {
    var q = (I.TX.buscas || {})[tkN(t)] || (I.TX.buscas || {})[t] || ('"' + nome(t) + '" OR ' + t);
    var g = 'https://news.google.com/search?q=' + encodeURIComponent(q + ' when:7d') + '&hl=pt-BR&gl=BR&ceid=BR:pt-419';
    var b = 'https://www.bing.com/news/search?q=' + encodeURIComponent(q.replace(/"/g, '').split(' OR ')[0]) + '&qft=sortbydate%3d%221%22';
    return h('p', {class: 'np-links'}, 'Buscar agora: ', h('a', {href: g, target: '_blank', rel: 'noopener'}, 'Google Notícias ↗'), ' · ', h('a', {href: b, target: '_blank', rel: 'noopener'}, 'Bing Notícias ↗'),
      ' · ', h('a', {href: 'https://www.rad.cvm.gov.br/ENET/frmConsultaExternaCVM.aspx', target: '_blank', rel: 'noopener', title: 'Consulta de documentos das companhias na CVM'}, 'CVM ↗'));
  }
  function painelNoticias(t) {
    var c = conteudo(t), box = h('div', {class: 'np'}), v = E().versao;
    var todasN = c.noticias.filter(function (x) { return x.natureza !== 'opiniao_casa'; }), rel = todasN.filter(function (x) { return !I.baixaRelevancia(x); }), baixas = todasN.filter(I.baixaRelevancia);
    var n7 = c.direto.filter(function (x) { return dentro(x, 168); }).length;
    box.appendChild(h('div', {class: 'np-h'}, h('h3', null, 'Notícias de ' + t), h('span', {class: 'muted'}, v ? 'coleta ' + I.horaAbs(v.gerado_em) : '')));
    box.appendChild(h('p', {class: 'np-cont'}, h('b', null, String(n7)), ' diretamente sobre o ativo em 7 dias', c.mencoes.length ? ' · ' + c.mencoes.length + (c.mencoes.length > 1 ? ' menções incidentais' : ' menção incidental') : ''));
    box.appendChild(linksBusca(t));
    box.appendChild(rel.length ? listaG(t, 'n', rel, 8) : h('p', {class: 'empty'}, E().carregando ? 'Buscando as notícias…' : semDados() ? SEM_DADOS : 'Nenhuma notícia de veículo conhecido tem ' + nome(t) + ' como assunto nos últimos dias' + (c.opinioes.total ? ' (as opiniões publicadas estão logo abaixo)' : '') + '. Use os links acima para buscar agora.'));
    if (baixas.length) box.appendChild(A.more('Baixa relevância (' + baixas.length + ')', h('div', null, h('p', {class: 'hint', style: 'margin:0 0 4px'}, 'Veículos pouco conhecidos achados pela busca, sem resultado, documento ou opinião de casa.'), listaG(t, 'nb', baixas, 6))));
    var o = c.opinioes, op = h('div', {class: 'np-op'}, h('h4', {class: 'np-sub'}, 'Opiniões publicadas · 12 meses' + (o.total ? ' · ' + o.total : '')));
    if (!o.total) op.appendChild(h('p', {class: 'muted np-vz'}, semDados() ? SEM_DADOS : 'Nenhuma opinião de casa de análise sobre o ativo nas manchetes dos últimos 12 meses.'));
    else {
      op.appendChild(h('div', {class: 'op-grid'}, [['favoravel', 'A favor'], ['contraria', 'Contra']].map(function (p) { var l = o[p[0]]; return h('div', {class: 'op-col op-' + p[0]}, h('b', null, p[1] + ' · ' + l.length), l.length ? listaG(t, 'op' + p[0], l, 5) : h('p', {class: 'muted'}, 'Nenhuma no período.')); })));
      if (o.outras.length) op.appendChild(A.more('Neutras ou sem sentido explícito no título (' + o.outras.length + ')', listaG(t, 'opo', o.outras, 10)));
      op.appendChild(h('p', {class: 'hint'}, 'Sentido lido do título público; o relatório da casa não é acessível. Opinião de terceiros, para pesquisa — não citar em material de cliente.'));
    }
    box.appendChild(op);
    if (c.oficiais.length) box.appendChild(h('div', null, h('h4', {class: 'np-sub'}, 'Documentos à CVM · ' + c.oficiais.length), listaG(t, 'cvm', c.oficiais, 4)));
    // v3.6 · proventos anunciados e quem tem a ação (fundos)
    var pvf = A.proventosNaFicha ? A.proventosNaFicha(t) : null; if (pvf) box.appendChild(pvf);
    var fdf = A.fundosNaFicha ? A.fundosNaFicha(t) : null; if (fdf) box.appendChild(fdf);
    // v3.6 · lente global do setor (pares e o setor no mundo)
    var n = tkN(t), vis = {}, lente = itens().filter(function (x) { if (!x.lente || vis[x.id] || x.acervo) return false; vis[x.id] = 1; return (x.setor_de || []).concat(x.setor_de_vip || []).indexOf(n) >= 0; }).sort(function (a, b) { return I.pub(b).localeCompare(I.pub(a)); });
    var lg = A.lenteGlobal ? A.lenteGlobal(n, lente, function (l, k, m) { return listaG(t, k, l, m); }) : null; if (lg) box.appendChild(lg);
    if (c.mencoes.length) box.appendChild(A.more('Menções incidentais (' + c.mencoes.length + ')', listaG(t, 'men', c.mencoes, 8)));
    return box;
  }
  function numeros(a) {
    var L = [['Preço (print)', a.preco == null ? (a.preco_nota || 'sem cotação') : rs(a.preco)], ['Variação do dia (print)', a.var_dia == null ? '—' : pc(a.var_dia, true)], ['Preço teto', rs(a.teto)], ['Preço justo', rs(a.justo)],
      ['Alocação sugerida', pc(a.alocacao)], ['Risco', riscoChip(a.risco)], ['DY', pc(a.dy)]];
    if (a.cart === 'dividendos') L.push(['DY pago 2026', pc(a.dy_pago_2026)]);
    L = L.concat([['Data de entrada', a.entrada || '—'], ['Preço de entrada ajustado', rs(a.preco_entrada)], ['Retorno total', a.retorno == null ? '—' : h('span', {class: A.cls(a.retorno)}, pc(a.retorno, true))],
      ['Sugestão', sugChip(a.sugestao)], ['Desconto para o teto', a.desc_teto == null ? '—' : h('span', {class: A.cls(a.desc_teto)}, pc(a.desc_teto, true))], ['Potencial de valorização', a.pot_val == null ? '—' : h('span', {class: A.cls(a.pot_val)}, pc(a.pot_val, true))]]);
    return h('dl', {class: 'vip-dl'}, L.map(function (p) { return h('div', null, h('dt', null, p[0]), h('dd', null, p[1])); }));
  }
  function ficha(t) {
    var a = ATV[t], wrap = h('div', {class: 'vip-ficha'});
    A.registrarAtivo && A.registrarAtivo(t);
    wrap.appendChild(h('p', null, h('button', {class: 'btn link', onclick: function () { AT.t = null; A.rerender(); }}, '← Ativos VIP')));
    wrap.appendChild(h('div', {class: 'vip-fh'}, h('div', null, h('h1', null, t, h('span', null, a.empresa)), h('p', {class: 'muted'}, cartChip(a.cart), ' · ' + a.setor + ' · posição ' + a.rank + ' na carteira')), h('div', {class: 'vip-fh-r'}, sugChip(a.sugestao), riscoChip(a.risco))));
    if (a.noticias_de) wrap.appendChild(h('p', {class: 'hint'}, 'Notícias e opiniões lidas pelo código ' + a.noticias_de + ' (a mesma companhia).'));
    // v3.6 · ponte com a Oregon: só o aviso e o link, sem trazer os pesos da Oregon para cá
    var ao = C.ATV[tkN(t)];
    if (ao && ao.status !== 'placeholder') wrap.appendChild(h('p', {class: 'ponte-vip'}, 'Também na Carteira Oregon · ', h('button', {class: 'btn link', onclick: function () { A.abrirFicha(tkN(t)); }}, (ao.pilar && C.PIL && C.PIL[ao.pilar] ? 'pilar ' + C.PIL[ao.pilar].nome : 'ficha Oregon') + (tkN(t) !== t ? ' (' + tkN(t) + ')' : ''))));
    var g = h('div', {class: 'grid2 vip-g'});
    g.appendChild(h('div', null, A.sec('Números do print · ' + printBR(), {flush: false}, numeros(a)), A.casasTab ? A.casasTab(tkN(t), true) : null));
    g.appendChild(painelNoticias(t));
    wrap.appendChild(g);
    return wrap;
  }
  function abrir(t) { if (!ATV[t]) return; AT.t = t; A.go('vip', 'ativos'); }
  A.abrirFichaVip = abrir;

  /* ---------- Pauta da semana por carteira ---------- */
  var PT = {dias: 7};
  var ROT = {resultado: 'Resultado', cvm: 'CVM', opiniao: 'Opinião', noticia: 'Notícia'}, TETO = {resultado: 2, cvm: 2, opiniao: 3, noticia: 2};
  function selecionar(its, t) {
    var cont = {}, sel = [], resto = [];
    its.slice().sort(function (a, b) { return (I.desconhecido(a) ? 1 : 0) - (I.desconhecido(b) ? 1 : 0); }).forEach(function (x) { var k = tipoEv(x, t); cont[k] = (cont[k] || 0) + 1; (cont[k] <= TETO[k] ? sel : resto).push(x); });
    var ordem = {resultado: 0, cvm: 1, opiniao: 2, noticia: 3};
    sel.sort(function (a, b) { return (ordem[tipoEv(a, t)] - ordem[tipoEv(b, t)]) || I.pub(b).localeCompare(I.pub(a)); });
    return sel.concat(resto);
  }
  function pautaDados() {
    var lim = Date.now() - PT.dias * 864e5;
    return CARTS.map(function (c) {
      var ls = (c.ativos || []).map(function (a) {
        var t = a.ticker, n = tkN(t), vis = {};
        var its = conteudo(t).direto.filter(function (x) { var q = ts(x); if (!q || q < lim || q > Date.now() + 6 * 3600e3 || x.acervo || (I.grupoXP && I.grupoXP(x))) return false; var k = x.titulo.toLowerCase().slice(0, 60); if (vis[k]) return false; vis[k] = 1; return true; });
        var rel = its.filter(function (x) { return !I.baixaRelevancia(x); });
        return {t: t, nome: a.empresa, itens: selecionar(I.agruparFatos(rel).map(function (g) { return g.x; }), n), baixas: its.filter(I.baixaRelevancia), n: n};
      });
      return {c: c, com: ls.filter(function (l) { return l.itens.length; }), sem: ls.filter(function (l) { return !l.itens.length; })};
    });
  }
  function dataCurta(x) { var p = I.pub(x); return p ? p.slice(8, 10) + '/' + p.slice(5, 7) : ''; }
  function textoPauta(P) {
    var fim = new Date(), ini = new Date(Date.now() - (PT.dias - 1) * 864e5), f = function (d) { return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2); };
    var L = ['Carteiras VG VIP · notícias de ' + f(ini) + ' a ' + f(fim)];
    P.forEach(function (g) {
      L.push('', g.c.nome);
      g.com.forEach(function (l) { L.push('• ' + l.t + ' (' + l.nome + ')'); l.itens.slice(0, 5).forEach(function (x) { L.push('   – [' + ROT[tipoEv(x, l.n)] + '] ' + x.titulo + ' (' + (x.organizacao || x.fonte || '') + ', ' + dataCurta(x) + ')' + (A.link(x.link) ? ' ' + A.link(x.link) : '')); }); });
      if (g.sem.length) L.push('Sem notícias no período: ' + g.sem.map(function (l) { return l.t; }).join(', '));
    });
    return L.join('\n');
  }
  function pauta() {
    var wrap = h('div'), P = pautaDados();
    wrap.appendChild(A.pageHead('VG VIP', 'Pauta da semana · carteiras VIP', 'Notícias de cada empresa das carteiras Dividendos, Valor e Smallcaps no período: resultados, documentos à CVM, opiniões publicadas e notícias em que a empresa é o assunto.',
      h('div', {class: 'row', style: 'gap:6px'}, h('div', {class: 'sub filt', role: 'toolbar', 'aria-label': 'Período', style: 'margin:0'}, [[7, '7 dias'], [14, '14 dias']].map(function (o) { return h('button', {'aria-pressed': PT.dias === o[0] ? 'true' : 'false', onclick: function () { PT.dias = o[0]; A.rerender(); }}, o[1]); })),
        A.btnImprimir ? A.btnImprimir() : null,
        h('button', {class: 'btn pri', onclick: function () { var txt = textoPauta(P); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { A.toast('Pauta VIP copiada: cole no material ou nas notas.'); }, function () { A.drawer('Pauta da semana VIP (texto)', h('textarea', {class: 'inp', style: 'min-height:60vh;width:100%', readonly: true}, txt)); }); }}, 'Copiar pauta'))));
    var fx = A.intelFaixa && A.intelFaixa(); if (fx) wrap.appendChild(fx);
    P.forEach(function (g) {
      var corpo = h('div', {class: 'pauta'});
      if (!g.com.length) corpo.appendChild(vazio(semDados() ? SEM_DADOS : 'Nenhuma empresa da carteira foi assunto de notícia no período.'));
      g.com.forEach(function (l) {
        corpo.appendChild(h('div', {class: 'pt-emp'}, h('div', {class: 'pt-h'}, tkBtn(l.t), h('b', null, l.nome), h('span', {class: 'muted'}, l.itens.length + (l.itens.length > 1 ? ' itens' : ' item'))),
          h('ul', {class: 'pt-l'}, l.itens.slice(0, 5).map(function (x) {
            var k = tipoEv(x, l.n);
            return h('li', null, h('span', {class: 'pt-k k-' + k}, ROT[k]), ' ', h('button', {class: 'nwl', onclick: function () { A.abrirItem(x); }}, x.titulo), h('span', {class: 'muted'}, ' · ' + (x.organizacao || x.fonte || '') + ' · ' + dataCurta(x)),
              x.natureza === 'opiniao_casa' && (x.recomendacao || x.preco_alvo) ? h('span', {class: 'muted'}, ' · ' + [x.recomendacao, x.preco_alvo ? 'alvo ' + x.preco_alvo : null].filter(Boolean).join(' · ')) : null);
          })), l.itens.length > 5 ? h('p', {class: 'muted', style: 'font-size:.8rem;margin:2px 0 0'}, '+ ' + (l.itens.length - 5) + ' na ficha do ativo') : null,
          l.baixas.length ? A.more(l.baixas.length + ' de baixa relevância', h('ul', {class: 'pt-l'}, l.baixas.slice(0, 8).map(function (x) { return h('li', null, h('button', {class: 'nwl', onclick: function () { A.abrirItem(x); }}, x.titulo), h('span', {class: 'muted'}, ' · ' + (x.fonte || x.organizacao || '') + ' · ' + dataCurta(x))); }))) : null));
      });
      if (g.sem.length) corpo.appendChild(h('p', {class: 'muted pt-sem'}, 'Sem notícias no período: ', g.sem.map(function (l, i) { return h('span', null, i ? ', ' : '', h('button', {class: 'btn link', onclick: function () { abrir(l.t); }}, l.t + (l.baixas.length ? ' (' + l.baixas.length + ' de baixa relevância)' : ''))); })));
      wrap.appendChild(A.sec(g.c.nome, {badge: h('span', {class: 'sec-n'}, g.com.length + ' de ' + (g.com.length + g.sem.length) + ' empresas com notícias')}, corpo));
    });
    wrap.appendChild(h('p', {class: 'hint'}, '"Copiar pauta" copia o texto com títulos, veículos, datas e links. Preços e retornos do print não entram aqui.'));
    return wrap;
  }

  /* ---------- área ---------- */
  if (!CARTS.length) return;
  A.AREAS.push(['vip', 'VG VIP', 'var(--vip)', 'VIP']);
  A.SUBS.vip = [['hoje', 'Hoje VIP'], ['ativos', 'Ativos'], ['pauta', 'Pauta da semana']];
  A.areas.vip = function () {
    var wrap = h('div', {class: 'area-vip'}), s = S.sub.vip;
    if (!A.SUBS.vip.some(function (x) { return x[0] === s; })) s = S.sub.vip = 'hoje';
    if (s !== 'ativos') AT.t = null;
    wrap.appendChild(A.subnav('vip', A.SUBS.vip));
    wrap.appendChild(s === 'ativos' ? ativos() : s === 'pauta' ? pauta() : hoje());
    return wrap;
  };
  A.VIP = {ativos: ATV, ordem: ORDEM, carteiras: CARTS, eventos: eventos, conteudo: conteudo, print_em: VD.print_em ? VD.print_em.slice(8, 10) + '/' + VD.print_em.slice(5, 7) + '/' + VD.print_em.slice(0, 4) : ''};
})(APP, CORE, INTEL);
