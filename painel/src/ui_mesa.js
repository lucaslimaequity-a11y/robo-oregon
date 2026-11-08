/* Topo e Mesa do Gestor */
(function (A, C) {
  'use strict';
  var h = A.h, S = A.S;

  A.renderTop = function () {
    var tr = document.getElementById('top-r');
    if (tr) tr.replaceChildren(
      h('button', {class: 'kbtn qbox', type: 'button', title: 'Buscar notícia, empresa, carteira, assunto ou seção (tecla / ou Ctrl+K)', 'aria-label': 'Buscar', onclick: function () { A.busca(); }},
        h('span', {class: 'qi', 'aria-hidden': 'true', html: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="4.8"/><path d="M10.6 10.6 14 14" stroke-linecap="round"/></svg>'}),
        h('span', {class: 'qp qp-l'}, 'Buscar notícia, empresa, carteira…'), h('span', {class: 'qp qp-s'}, 'Buscar'), h('kbd', null, '/')),
      A.dadosPill ? A.dadosPill() : null);
    // faixa de contexto: só em Oregon › Carteiras fora da referência (qualquer das 15 pode ser escolhida)
    var ctx = document.getElementById('ctx'); if (ctx) ctx.hidden = !A.mostraCtx();
    var top = document.getElementById('top-ctl'); if (!top || !A.mostraCtx()) return;
    var v = A.versao(); if (!v) { S.ver = 'aprovada'; v = A.versao(); }
    var val = A.valida(v);
    var sel = h('select', {id: 'sel-cart', 'aria-label': 'Carteira', onchange: function () { S.cart = sel.value; S.ver = 'aprovada'; A.render(); }});
    var fam = null, og = null;
    C.CARTS.forEach(function (m) { if (m.familia !== fam) { fam = m.familia; og = h('optgroup', {label: fam}); sel.appendChild(og); } og.appendChild(h('option', {value: m.id, selected: m.id === S.cart || null}, m.rotulo + (m.status !== 'ativa' ? ' · ' + m.status : ''))); });
    var vs = h('select', {id: 'sel-ver', 'aria-label': 'Versão', onchange: function () { S.ver = vs.value; A.render(); }}, A.versoes(S.cart).map(function (o) { return h('option', {value: o.id, selected: o.id === S.ver || null}, o.rotulo); }));
    var st = {invalida: 'Inválida', parcial: 'Parcial', valida: 'Válida'}[val.status];
    var pill = h('button', {class: 'pill ' + val.status, style: 'border:0;cursor:pointer', title: 'Ver os problemas da versão', onclick: function () { A.go('cart', 'carteira'); setTimeout(function () { var e = document.getElementById('integridade'); if (e) e.scrollIntoView({behavior: 'smooth', block: 'start'}); }, 50); }},
      st + (val.contagem.critica ? ' · ' + val.contagem.critica + ' crítico(s)' : '') + (val.contagem.alta ? ' · ' + val.contagem.alta + ' alto(s)' : ''));
    top.replaceChildren(h('span', null, h('label', {for: 'sel-cart'}, 'Carteira'), sel), h('span', null, h('label', {for: 'sel-ver'}, 'Versão'), vs), pill, h('span', {class: 'grow'}),
      h('span', {class: 'pill modo', title: 'Pesos como aprovados; nada é normalizado nem simulado.'}, 'pesos aprovados'));
  };

  /* ---------- Mesa ---------- */
  A.mesaPainel = function () { return mesaPainel(); };
  function mesaPainel() {
    var v = A.versao(), val = A.valida(v), P = A.prem(), ex = C.exposicoes(v, P.sens), m = C.MAND[S.cart];
    var wrap = h('div');
    // o cabeçalho e a faixa do dia ficam na página Carteira (Carteiras → Carteira)
    var g = h('div', {class: 'grid2'}), L = h('div'), R = h('div'); g.append(L, R); wrap.appendChild(g);

    // 1. Integridade
    var crit = val.issues.filter(function (i) { return i.g !== 'info'; }), info = val.issues.filter(function (i) { return i.g === 'info'; });
    var motivoInv = val.issues.filter(function (i) { return i.g === 'critica' && /R1|R2|R3/.test(i.regra); }).map(function (i) { return i.titulo; });
    var resumo = val.status === 'invalida' ? h('div', {class: 'alert bad'}, h('b', null, 'Carteira inválida: '), motivoInv.join('; ') + '. ', 'Os pesos aparecem como estão, sem normalizar. A correção depende do Comitê.')
      : val.status === 'parcial' ? h('div', {class: 'alert warn'}, h('b', null, 'Análise parcial. '), A.pct(val.cobertura.descoberto, 0) + ' da carteira não tem instrumento investível ou sensibilidade cadastrada (placeholders, lacunas, fundos sem marcação). Essa parte não entra nos números e não é tratada como caixa.')
      : h('div', {class: 'alert ok'}, 'Pesos fecham em 100% e todas as posições têm cadastro e sensibilidade.');
    L.appendChild(A.sec('Situação da carteira', {id: 'integridade', mtd: 'validacao', badge: A.chip({invalida: 'Inválida', parcial: 'Parcial', valida: 'Válida'}[val.status], 'g-' + (val.status === 'invalida' ? 'critica' : val.status === 'parcial' ? 'media' : 'baixa'))}, [
      resumo, issuesList(crit.slice(0, 6)),
      crit.length > 6 ? A.more('Ver os outros ' + (crit.length - 6) + ' problemas', issuesList(crit.slice(6))) : null,
      info.length ? A.more('Dados ausentes e verificações não realizadas (' + info.length + ')', issuesList(info)) : null,
      A.more('Auditoria das 15 carteiras', auditoriaTodas()),
      h('div', {class: 'row', style: 'margin-top:8px'}, val.status === 'invalida' && v.kind === 'aprovada' ? h('button', {class: 'btn', onclick: function () { A.novaPropostaCorrecao(); }}, 'Criar proposta de correção') : null)
    ]));

    // 2. Alocação
    var est = C.estrategica(S.cart), base = C.historica('base-30-10', S.cart), bp = C.pesosPorPilar(base ? base.pos : []), pp = C.pesosPorPilar(v.pos);
    var pils = Object.keys(Object.assign({}, est.alvo, pp, bp)).sort(function (a, b) { return +a.slice(1) - +b.slice(1); });
    var rows = pils.map(function (p) { var b = est.bandas[p] || {}; return {p: p, nome: C.PIL[p] ? C.PIL[p].nome : p, alvo: est.alvo[p], min: b.min, max: b.max, atv: pp[p] || 0, base: bp[p] || 0, fora: b.min != null && ((pp[p] || 0) < b.min - C.TOL || (pp[p] || 0) > b.max + C.TOL)}; }).filter(function (r) { return r.alvo || r.atv || r.base; });
    L.appendChild(A.sec('Alocação por pilar', {hint: 'Decidido = peso do pilar no simulador do Comitê. Ativos = soma das posições da versão selecionada. Base 30/10 = composição anterior, para comparação.', flush: true}, A.table([
      {k: 'p', t: 'Pilar', f: function (r) { return r.p + ' · ' + r.nome; }, s: function (r) { return +r.p.slice(1); }},
      {k: 'alvo', t: 'Decidido', r: 1, f: function (r) { return A.pct(r.alvo); }},
      {k: 'min', t: 'Banda', r: 1, f: function (r) { return r.min == null ? '—' : A.pct(r.min, 0) + '–' + A.pct(r.max, 0); }, s: false},
      {k: 'atv', t: 'Ativos', r: 1, f: function (r) { var d = r.alvo != null && !C.near(r.atv, r.alvo); return h('span', {class: d || r.fora ? 'down' : ''}, h('span', {class: 'bar', style: 'width:' + Math.min(80, r.atv * 160) + 'px'}), A.pct(r.atv)); }},
      {k: 'base', t: 'Base 30/10', r: 1, f: function (r) { return A.pct(r.base); }},
      {k: 'd', t: 'Δ vs base', r: 1, f: function (r) { var d = r.atv - r.base; return h('span', {class: A.cls(d)}, A.pp(d, 1)); }, s: function (r) { return r.atv - r.base; }}
    ], rows, {sort: 'p', dir: 1, foot: h('tr', null, h('td', null, 'Total'), h('td', {class: 'r num'}, A.pct(C.sum(rows, function (r) { return r.alvo || 0; }))), h('td'), h('td', {class: 'r num'}, A.pct(val.total)), h('td', {class: 'r num'}, A.pct(C.sum(rows, function (r) { return r.base; }))), h('td'))})));
    var porPil = {}; (v.pos || []).filter(function (x) { return x.w > 0; }).forEach(function (x) { (porPil[x.p] = porPil[x.p] || []).push(x); });
    L.appendChild(A.sec('Ativos por pilar', {hint: 'Clique no ativo para abrir a tese (documento Carteira Oregon de 30/10/2026). Ativos em azul têm tese; os demais abrem a ficha resumida.'}, h('div', null, Object.keys(porPil).sort(function (a, b) { return +a.slice(1) - +b.slice(1); }).map(function (p) {
      var xs = porPil[p].slice().sort(function (a, b) { return b.w - a.w; });
      var ph = xs.filter(function (x) { return C.ATV[x.t] && C.ATV[x.t].status === 'placeholder'; });
      var reais = xs.filter(function (x) { return ph.indexOf(x) < 0; });
      return h('div', {style: 'padding:6px 0;border-bottom:1px solid var(--line)'}, h('div', {class: 'pilchips'}, h('b', {style: 'min-width:190px'}, p + ' · ' + (C.PIL[p] ? C.PIL[p].nome : '')),
        reais.map(function (x) { return h('span', null, A.tk(x.t), h('span', {class: 'muted', style: 'font-size:.84rem'}, ' ' + A.pct(x.w, 1))); }),
        ph.length ? h('span', {class: 'chip st-placeholder'}, ph.length + ' placeholders · ' + A.pct(C.sum(ph, function (x) { return x.w; }), 0)) : null));
    }))));
    var cl = ex.porClasse, mo = ex.porMoeda;
    L.appendChild(A.sec('Classe, moeda e país', {flush: false}, h('div', {class: 'grid2', style: 'gap:10px'},
      h('div', null, h('h3', {style: 'margin-top:0'}, 'Classe'), A.hbars(Object.keys(cl).sort(function (a, b) { return cl[b] - cl[a]; }).map(function (k) { return {label: k, v: cl[k]}; }))),
      h('div', null, h('h3', {style: 'margin-top:0'}, 'Moeda e país'), A.hbars(Object.keys(mo).map(function (k) { return {label: k, v: mo[k]}; }).concat(Object.keys(ex.porPais).filter(function (k) { return k !== 'Brasil'; }).map(function (k) { return {label: '  ' + k, v: ex.porPais[k], color: 'var(--line2)'}; })))))));

    // 3. Principais posições
    var top = (v.pos || []).filter(function (x) { return x.w > 0; }).slice().sort(function (a, b) { return b.w - a.w; });
    L.appendChild(A.sec('Principais posições', {flush: true, hint: 'Cotação e preço teto das Teses de 04/11/2026. Retorno de 12 meses com a fonte do deck. Preço teto não é preço justo nem retorno esperado.'}, A.table([
      {k: 't', t: 'Ativo', f: function (x) { return h('span', null, A.tk(x.t), ' ', h('span', {class: 'muted'}, C.ATV[x.t] ? C.ATV[x.t].nome : '')); }},
      {k: 'p', t: 'Pilar'},
      {k: 'st', t: 'Status', f: function (x) { return C.ATV[x.t] ? A.stchip(C.ATV[x.t].status) : A.chip('sem cadastro', 'g-alta'); }, s: function (x) { return C.ATV[x.t] && C.ATV[x.t].status; }},
      {k: 'w', t: 'Peso', r: 1, f: function (x) { return A.pct(x.w); }},
      {k: 'rec', t: 'Rec.', f: function (x) { var a = C.ATV[x.t]; return a && a.rec ? a.rec : '—'; }, s: function (x) { return C.ATV[x.t] && C.ATV[x.t].rec; }},
      {k: 'up', t: 'Até o teto', r: 1, title: 'teto ÷ cotação − 1, com a cotação de 04/11/2026', f: function (x) { var a = C.ATV[x.t]; if (!a || !a.teto || !a.cotacao) return '—'; var u = a.teto / a.cotacao - 1; return h('span', {class: A.cls(u), title: 'Cotação R$ ' + A.num(a.cotacao) + ' · teto R$ ' + A.num(a.teto) + ' · ' + a.fonte_preco}, A.spct(u, 0)); }, s: function (x) { var a = C.ATV[x.t]; return a && a.teto && a.cotacao ? a.teto / a.cotacao - 1 : null; }},
      {k: 'r12', t: '12 meses', r: 1, f: function (x) { var a = C.ATV[x.t]; return a && a.ret_12m != null ? h('span', {class: A.cls(a.ret_12m), title: a.fonte_ret || ''}, A.spct(a.ret_12m)) : '—'; }, s: function (x) { return C.ATV[x.t] && C.ATV[x.t].ret_12m; }}
    ], top.slice(0, 12), {sort: 'w'}), top.length > 12 ? A.more('Todas as ' + top.length + ' posições', A.table([
      {k: 't', t: 'Ativo'}, {k: 'p', t: 'Pilar'}, {k: 'w', t: 'Peso', r: 1, f: function (x) { return A.pct(x.w, 2); }}, {k: 'st', t: 'Status', f: function (x) { return C.ATV[x.t] ? A.stchip(C.ATV[x.t].status) : '—'; }}
    ], top, {sort: 'w', search: 'Filtrar posições'})) : null));

    // Direita
    // 4. Concentração
    var mdl = A.modelo(v), riskN = null;
    if (mdl.ok && mdl.S && mdl.suficiente) { var rc = Q.riskContrib(mdl.w, mdl.S); riskN = 1 / C.sum(rc.pct, function (p) { return p * p; }); }
    var setores = ex.porSetor, emis = ex.porEmissor;
    R.appendChild(A.sec('Concentração', {mtd: 'concentracao'}, [
      h('dl', {class: 'kv'},
        h('dt', null, 'Posições investíveis'), h('dd', {class: 'num'}, ex.nTickers),
        h('dt', null, 'Número efetivo (por peso)'), h('dd', {class: 'num'}, ex.effN ? A.num(ex.effN, 1) : '—'),
        h('dt', null, 'Número efetivo (por risco)'), h('dd', null, riskN ? h('span', {class: 'num'}, A.num(riskN, 1)) : A.na(mdl.bloqueado ? 'carteira inválida' : 'sem séries', mdl.bloqueado ? 'proposta corrigida' : 'preços históricos')),
        h('dt', null, 'Maior posição'), h('dd', {class: 'num'}, ex.maior ? ex.maior.t + ' ' + A.pct(ex.maior.w) : '—'),
        h('dt', null, '5 maiores'), h('dd', {class: 'num'}, A.pct(ex.top5))),
      h('p', {class: 'hint'}, 'Número efetivo = 1 ÷ Σ(peso²), sobre as posições investíveis. Quantidade de tickers não é diversificação: ETFs quase idênticos e ações que respondem ao mesmo fator contam como uma aposta só.'),
      h('h3', null, 'Setores (renda variável e FIIs)'),
      A.hbars(Object.keys(setores).filter(function (k) { var t = (v.pos || []).filter(function (x) { return C.ATV[x.t] && C.ATV[x.t].setor === k; })[0]; return t && /Ações|FIIs/.test(C.ATV[t.t].classe); }).sort(function (a, b) { return setores[b] - setores[a]; }).slice(0, 8).map(function (k) { return {label: k, v: setores[k]}; })),
      A.more('Por emissor e grupo econômico', A.hbars(Object.keys(emis).sort(function (a, b) { return emis[b] - emis[a]; }).slice(0, 10).map(function (k) { return {label: k, v: emis[k]}; })))
    ]));
    // 5. Exposições macro
    var f = ex.fatores;
    var fr = [
      ['Duration prefixada (anos)', f.dur_pre, 'Σ peso × duration dos ETFs prefixados'], ['Duration de juro real (anos)', f.dur_real, 'ETFs de inflação + duration real dos FIIs'],
      ['Duration de Treasuries (anos)', f.dur_ust, 'renda fixa internacional'], ['Spread duration (anos)', f.spread_dur, 'high yield e emergentes'],
      ['Beta Ibovespa (ações + FIIs)', f.beta_ibov, 'Σ peso × β'], ['Juros residual das ações (% por p.p.)', f.juros_resid, 'além do β'],
      ['Dólar direto (peso em USD)', f.usd_direto, ''], ['Dólar indireto (ações exportadoras)', f.usd_indireto, '% por 1% de dólar'],
      ['Brent', f.brent, '% por 1% de Brent'], ['S&P / desenvolvidos', f.sp, 'carga em USD'], ['Emergentes', f.em, 'carga em USD'], ['Bitcoin', f.btc, '']
    ].filter(function (r) { return Math.abs(r[1]) > 1e-9; });
    R.appendChild(A.sec('Exposições macro', {mtd: 'fatores', hint: 'Agregado das sensibilidades cadastradas. Os valores iniciais são hipóteses geradas por IA a revisar; as editadas viram premissa do gestor.'}, fr.length ? h('table', {class: 't'}, h('tbody', null, fr.map(function (r) { var pctLike = /Dólar direto/.test(r[0]); return h('tr', null, h('td', null, r[0], r[2] ? h('div', {class: 'muted', style: 'font-size:.8rem'}, r[2]) : null), h('td', {class: 'r num'}, pctLike ? A.pct(r[1]) : A.num(r[1], 2)), h('td', null, A.ochip('q'))); }))) : h('p', {class: 'empty'}, 'Sem sensibilidades nas posições investíveis.')));
    // 6. Desvios do mandato
    var desv = val.issues.filter(function (i) { return i.regra === 'R7' || i.regra === 'R9'; });
    R.appendChild(A.sec('Desvios do mandato', null, desv.length ? issuesList(desv) : h('p', {class: 'empty'}, 'Nenhum desvio de banda, perfil ou limite nesta versão.')));
    // 7. Alertas de dados
    var hoje = new Date(), dias = function (br) { var m = String(br || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? Math.round((hoje - new Date(m[3] + '-' + m[2] + '-' + m[1])) / 864e5) : null; };
    var nSer = Object.keys(A.SER).length, ultima = nSer ? Object.keys(A.SER).map(function (k) { var p = A.SER[k].pts; return p.length ? p[p.length - 1][0] : ''; }).sort().pop() : null;
    var al = [
      ['Cotações e preços teto', '04/11/2026 (Teses)', dias('04/11/2026')], ['Retornos de 12 meses', '30/10/2026 (deck)', dias('30/10/2026')], ['Pesos aprovados', A.dataBR(v.data), dias(A.dataBR(v.data))],
      ['Séries históricas importadas', nSer ? nSer + ' séries, última data ' + A.dataBR(ultima) : 'nenhuma', ultima ? dias(A.dataBR(ultima)) : null]
    ];
    R.appendChild(A.sec('Alertas de dados', null, h('table', {class: 't'}, h('tbody', null, al.map(function (r) { var velho = r[2] != null && r[2] > 7; return h('tr', null, h('td', null, r[0]), h('td', null, r[1]), h('td', {class: 'r'}, r[2] == null ? (nSer ? '' : A.chip('importar', 'g-media')) : A.chip(r[2] + ' dias', velho ? 'g-media' : 'g-baixa'))); })))));
    // 8. Pauta do Comitê 05/11 ainda em aberto (registro histórico; a Sala de Gestão foi arquivada)
    var est2 = (C.D.estudo || []).filter(function (e) { var st = (STORE.get('config', 'estudo') || {})[e.id]; return !(st && st.status === 'resolvido') && (e.tipo === 'Votação' || e.tipo === 'Erro no simulador'); });
    if (est2.length) R.appendChild(A.sec('Pendências do Comitê 05/11', {hint: 'Itens do comitê que dependem de decisão humana. A Sala de Gestão e o laboratório de propostas estão em painel/arquivo.'},
      h('ul', {class: 'issues'}, est2.slice(0, 7).map(function (e) { return h('li', null, A.chip(e.prioridade, e.prioridade === 'Alta' ? 'g-alta' : 'g-media'), h('span', null, h('b', null, e.tipo + ': '), e.titulo)); }))));
    // 9. Cenário de referência
    R.appendChild(A.sec('Cenário de referência', {hint: 'Níveis e variações observados com a data e a fonte. Focus é a pesquisa do Banco Central.'}, h('table', {class: 't'}, h('tbody', null, (C.D.cenario || []).map(function (c) {
      var vtxt = c.tipo === 'variação' ? A.spct(c.valor) : A.pct(c.valor, 2);
      return h('tr', null, h('td', null, c.indicador, h('div', {class: 'muted', style: 'font-size:.8rem'}, c.leitura)), h('td', {class: 'r num'}, vtxt), h('td', {class: 'muted', style: 'white-space:nowrap'}, c.data, ' ', A.chip(c.tipo === 'projeção' ? 'Projeção Focus' : 'Observado', c.tipo === 'projeção' ? '' : 'o-obs')));
    })))));
    // 10. Mapa
    // o mapa das 15 carteiras fica em Carteiras → Mapa das carteiras
    return wrap;
  };

  function issuesList(list) {
    if (!list.length) return h('p', {class: 'empty'}, 'Nenhum problema.');
    return h('ul', {class: 'issues'}, list.map(function (i) {
      return h('li', null, A.gchip(i.g), h('div', null, h('b', null, i.titulo), i.ref ? h('span', {class: 'muted'}, ' · Para estudar ' + i.ref) : null),
        h('div', {class: 'd'}, i.detalhe ? h('div', null, i.detalhe) : null, i.impacto ? h('div', null, h('b', null, 'Impacto: '), i.impacto) : null, i.procedimento ? h('div', null, h('b', null, 'O que fazer: '), i.procedimento) : null));
    }));
  }
  A.issuesList = issuesList;

  function auditoriaTodas() {
    var ctx = A.ctx(), all = C.validateAll(ctx, A.irmaos());
    var rows = C.CARTS.map(function (m) { var r = all[m.id], est = C.estrategica(m.id); return {id: m.id, rot: m.rotulo, st: r.status, tot: r.total, pil: C.sum(Object.keys(est.alvo), function (p) { return est.alvo[p] || 0; }), ph: r.cobertura.placeholder, desc: r.cobertura.descoberto, crit: r.contagem.critica || 0, alta: r.contagem.alta || 0}; });
    var nInv = rows.filter(function (r) { return r.st === 'invalida'; }).length;
    return h('div', null, h('p', {class: 'hint'}, nInv + ' de 15 carteiras com pesos que não fecham. Nenhuma é normalizada para 100%.'), A.table([
      {k: 'rot', t: 'Carteira', f: function (r) { return h('a', {href: '#', onclick: function (e) { e.preventDefault(); S.cart = r.id; S.ver = 'aprovada'; A.render(); }}, r.rot); }},
      {k: 'st', t: 'Status', f: function (r) { return A.chip({invalida: 'Inválida', parcial: 'Parcial', valida: 'Válida'}[r.st], 'g-' + (r.st === 'invalida' ? 'critica' : r.st === 'parcial' ? 'media' : 'baixa')); }},
      {k: 'tot', t: 'Ativos', r: 1, f: function (r) { return h('span', {class: C.near(r.tot, 1) ? '' : 'down'}, A.pct(r.tot)); }},
      {k: 'pil', t: 'Pilares', r: 1, f: function (r) { return h('span', {class: C.near(r.pil, 1) ? '' : 'down'}, A.pct(r.pil)); }},
      {k: 'ph', t: 'Placeholders', r: 1, f: function (r) { return r.ph ? A.pct(r.ph, 0) : '—'; }},
      {k: 'desc', t: 'Descoberto', r: 1, f: function (r) { return r.desc > C.TOL ? A.pct(r.desc, 0) : '—'; }},
      {k: 'crit', t: 'Críticos', r: 1}, {k: 'alta', t: 'Altos', r: 1}
    ], rows));
  }

  function mapa() {
    var pils = C.D.pilares.map(function (p) { return p.pilar; });
    var all = C.validateAll(A.ctx(), A.irmaos());
    var m = C.CARTS.map(function (c) { var e = C.estrategica(c.id).alvo; return pils.map(function (p) { return e[p] || null; }); });
    var rl = C.CARTS.map(function (c) { return c.rotulo + ' · ' + {invalida: 'inválida', parcial: 'parcial', valida: 'válida'}[all[c.id].status]; });
    return A.heat(m, rl, pils.map(function (p) { return p + ' ' + C.PIL[p].nome.split(' ')[0]; }), {fmt: function (v) { return Math.round(v * 100) + ''; }, lo: 0, hi: 0.6, tip: function (i, j) { var v = m[i][j]; return [C.CARTS[i].rotulo, pils[j] + ' ' + C.PIL[pils[j]].nome, v == null ? 'sem peso' : A.pct(v)]; }});
  }
})(APP, CORE);
