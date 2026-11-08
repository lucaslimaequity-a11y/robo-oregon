/* HOJE — Mesa do Gestor. Responde, nesta ordem: o que aconteceu no Brasil, o que mudou nas expectativas, quais movimentos
   importam, quais carteiras foram afetadas e o que merece investigação ou decisão. Fato, interpretação e decisão ficam
   separados. Todo número mostra data, fonte e estado; dado que falta aparece como falta. Nada aqui é recomendação. */
(function (A, C, M) {
  'use strict';
  var h = A.h, S = A.S;

  // Transmissão de cada fator para as carteiras: pilares e grupos expostos (regra econômica geral, não estimativa)
  var MEC = {
    selic: {pil: ['P1', 'P3'], grupos: ['fin', 'jur'], txt: 'A Selic fixa o CDI: corte reduz o rendimento do caixa e do pós-fixado (P1, P3) e tende a favorecer prefixados e ações sensíveis a juros; alta faz o contrário.', ver: 'o comunicado do Copom e a reação da curva prefixada no mesmo dia'},
    pre: {pil: ['P2'], grupos: ['jur'], txt: 'Taxa prefixada longa em alta derruba o preço dos prefixados (P2) e eleva o custo de capital usado no valuation; ações alavancadas ou de prazo longo costumam sentir mais.', ver: 'se a alta veio de inflação, fiscal ou exterior (Treasuries, dólar) e se se repete na curva toda'},
    real: {pil: ['P4'], grupos: ['ele', 'jur'], txt: 'Juro real (IPCA+) em alta reduz o preço das NTN-B (P4), mais nos vencimentos longos, e pesa em ativos de longo prazo como elétricas e concessões.', ver: 'a inflação implícita (pré − IPCA+) e o fluxo estrangeiro na renda fixa'},
    usd: {pil: ['P9', 'P10', 'P11', 'P12', 'P13'], tickers: ['PETR4', 'PRIO3', 'KLBN4'], txt: 'Dólar em alta aumenta, em reais, as posições no exterior e a receita das exportadoras (petróleo, celulose); pressiona inflação e empresas com dívida em dólar.', ver: 'se o movimento é global (dólar contra emergentes) ou específico do Brasil (fiscal)'},
    ibov: {pil: ['P5', 'P6', 'P7'], txt: 'Movimento amplo da bolsa: atinge toda a parcela em ações e, em menor grau, os FIIs. Antes de concluir, separar o que foi setor ou empresa.', ver: 'quais setores puxaram o índice e se houve fluxo estrangeiro relevante'},
    brent: {tickers: ['PETR4', 'PRIO3'], txt: 'Petróleo move a receita de Petrobras e PRIO e, pelos combustíveis, a inflação e os juros.', ver: 'se o choque é de oferta (OPEP, geopolítica) ou de demanda (China, EUA)'},
    sp: {pil: ['P11'], txt: 'Bolsa americana: afeta as ações de países desenvolvidos (P11) e o apetite global a risco, que costuma chegar aos emergentes.', ver: 'se foi juros (Treasuries) ou lucros que moveram o índice'},
    em: {pil: ['P12'], txt: 'Emergentes: termômetro do fluxo para países como o Brasil; afeta o P12.', ver: 'dólar global e China'},
    ust10: {pil: ['P9', 'P10'], txt: 'Treasury de 10 anos em alta encarece o capital no mundo, pesa nos emergentes e costuma pressionar o dólar e a curva brasileira.', ver: 'o diferencial de juros Brasil − EUA e o prêmio de risco'},
    ust2: {pil: ['P9'], txt: 'Treasury de 2 anos acompanha a expectativa para os juros do Fed.', ver: 'falas do Fed e dados de emprego e inflação dos EUA'},
    btc: {tickers: ['IBIT'], txt: 'Bitcoin: afeta o IBIT nas carteiras alternativas.', ver: 'fluxo dos ETFs de bitcoin'}
  };
  A.MEC = MEC;
  var GR = null;
  function grupos() { if (!GR) { GR = {}; ((C.D && C.D.grupos) || []).forEach(function (g) { GR[g.id] = g; }); } return GR; }

  // Peso exposto de cada carteira (versão aprovada vigente) a um fator: soma dos pesos nos pilares e ativos ligados ao fator
  function exposicao(k) {
    var m = MEC[k]; if (!m) return [];
    var tk = {}; (m.tickers || []).forEach(function (t) { tk[t] = 1; }); (m.grupos || []).forEach(function (g) { var G = grupos(); (G[g] ? G[g].tickers : []).forEach(function (t) { tk[t] = 1; }); });
    return C.CARTS.map(function (c) {
      var v = STORE.aprovadaVigente(C, c.id), w = 0;
      (v.pos || []).forEach(function (x) { if (x.w > 0 && ((m.pil || []).indexOf(x.p) >= 0 || tk[x.t])) w += x.w; });
      return {m: c, w: w};
    }).filter(function (x) { return x.w > 0.0001; }).sort(function (a, b) { return b.w - a.w; });
  }
  A.exposicaoFator = exposicao;
  function pesosDoAtivo(t) {
    var al = C.D.aliases || {};
    return C.CARTS.map(function (c) { var v = STORE.aprovadaVigente(C, c.id); return {m: c, w: C.sum((v.pos || []).filter(function (x) { return x.w > 0 && (x.t === t || (al[x.t] && al[x.t].para === t)); }), function (x) { return x.w; })}; })
      .filter(function (x) { return x.w > 0; }).sort(function (a, b) { return b.w - a.w; });
  }
  A.pesosDoAtivo = pesosDoAtivo;
  function listaPesos(xs, n) {
    if (!xs.length) return h('span', {class: 'muted'}, 'não está em nenhuma carteira-modelo');
    return h('span', null, xs.slice(0, n || 3).map(function (x, i) { return h('span', null, i ? ' · ' : '', h('button', {class: 'btn link', onclick: function () { S.cart = x.m.id; S.ver = 'aprovada'; A.go('cart', 'carteira'); }}, x.m.rotulo), ' ' + A.pct(x.w, 1)); }), xs.length > (n || 3) ? h('span', {class: 'muted'}, ' e mais ' + (xs.length - (n || 3))) : null);
  }

  /* ---------- números do dia ---------- */
  var hm = function (iso) { try { return new Date(iso).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'}); } catch (e) { return ''; } };
  function serieHist(id) { var H = A.mercadoHist && A.mercadoHist(); return H && H.series && H.series[id] ? H.series[id] : null; }
  function tile(o) {
    var st = o.estado || 'indisponivel';
    var el = h('div', {class: 'tile' + (o.v == null ? ' na' : ''), 'data-click': o.on ? '1' : null, onclick: o.on || null, title: o.title || null},
      h('span', {class: 'lbl'}, h('i', {class: 'dot ' + st, title: M.ESTADO_TXT[st] || st}), o.lbl),
      h('span', {class: 'v'}, o.v == null ? 'sem dado' : o.v, o.u ? h('small', null, o.u) : null),
      o.d != null ? h('span', {class: 'd ' + (o.dcls || '')}, o.d) : h('span', {class: 'd muted'}, o.dtxt || ' '),
      o.tr ? h('span', {class: 't'}, o.tr) : null,
      o.spark || null,
      h('span', {class: 'meta', title: o.metaLong || null}, o.meta || ''));
    return el;
  }
  function trendTxt(id, pp) {
    var s = serieHist(id); if (!s) return null;
    var a = M.tendencia(s.pts, 30), b = M.tendencia(s.pts, 365), f = function (x) { return x ? (pp ? A.snum(x.d, 2) : A.spct(x.r, 1)) : '—'; };
    if (!a && !b) return null;
    return [h('span', null, '1m ', h('b', {class: A.cls(pp ? (a && a.d) : (a && a.r))}, f(a))), h('span', null, '12m ', h('b', {class: A.cls(pp ? (b && b.d) : (b && b.r))}, f(b)))];
  }
  function sparkDe(id) { var s = serieHist(id); if (!s || !s.pts || s.pts.length < 10) return null; var pts = s.pts.slice(-66); return A.spark(pts, 'var(--ink2)'); }
  function tileFator(snap, k, lbl, histId, opt) {
    opt = opt || {}; var f = snap && snap.fatores ? snap.fatores[k] : null, st = M.estado(f), pp = f && f.uvar === 'pp';
    if (!f || !f.ok) return tile({lbl: lbl, estado: 'indisponivel', meta: f && f.motivo ? f.motivo : 'sem fonte nesta rodada', metaLong: f && f.motivo});
    var nv = M.fmtNivel(f), u = null;
    if (/ pts$/.test(nv)) { nv = nv.replace(/ pts$/, ''); u = 'pts'; }
    return tile({lbl: lbl, estado: st, v: nv, u: u,
      d: f.var != null ? M.fmtVar(f.var, f.uvar) + (st !== 'atualizado' ? ' · ' + M.ESTADO_TXT[st] : '') : null, dcls: st === 'atualizado' ? A.cls(f.var) : 'muted',
      tr: histId ? trendTxt(histId, pp) : null, spark: histId ? sparkDe(histId) : null,
      meta: A.dataBR(f.data).slice(0, 5) + (f.hora ? ' ' + f.hora : '') + ' · ' + curta(f.fonte), metaLong: (f.fonte || '') + ' · ' + (f.detalhe ? f.detalhe + ' · ' : '') + (f.tipo_preco === 'fechamento' ? 'preço de fechamento' : f.tipo_preco === 'intradiario' ? 'intradiário' : '') + (f.motivo ? ' · ' + f.motivo : ''),
      on: opt.on});
  }
  function curta(fonte) { return String(fonte || '').replace(/ \(.*\)$/, '').replace('Banco Central · ', 'BC · ').replace('Tesouro Transparente', 'Tesouro').replace('Yahoo Finance', 'Yahoo').replace('Tesouro dos EUA', 'Tesouro EUA'); }
  function tileInd(I, k, lbl, fmt) {
    var x = I && I[k]; if (!x) return tile({lbl: lbl, estado: 'indisponivel', meta: 'sem leitura'});
    return tile({lbl: lbl, estado: 'atualizado', v: fmt ? fmt(x) : A.num(x.nivel, 2) + '%', d: x.var != null ? M.fmtVar(x.var, x.unid === 'R$' ? '%' : 'pp') : null, dcls: A.cls(x.var), dtxt: x.data ? (/ipca/.test(k) ? 'mês ' + x.data.slice(5, 7) + '/' + x.data.slice(0, 4) : '') : '',
      meta: (/ipca/.test(k) ? 'ref. ' + x.data.slice(5, 7) + '/' + x.data.slice(0, 4) : A.dataBR(x.data).slice(0, 5)) + ' · ' + curta(x.fonte).replace(/ · SGS \d+/, ''), metaLong: x.fonte});
  }
  function tileSpread(snap) {
    var a = snap && snap.fatores.pre, b = snap && snap.fatores.selic;
    if (!a || !a.ok || !b || !b.ok) return tile({lbl: 'Pré 2032 − Selic', estado: 'indisponivel', meta: 'falta a taxa prefixada ou a Selic'});
    var v = a.nivel - b.nivel, d = (a.var != null && b.var != null && a.data === b.data) ? a.var - b.var : null;
    return tile({lbl: 'Pré 2032 − Selic', estado: M.estado(a) === 'atualizado' && M.estado(b) === 'atualizado' ? 'atualizado' : 'desatualizado', v: A.snum(v, 2), u: 'p.p.', d: d != null ? A.snum(d, 2) + ' p.p.' : null, dcls: A.cls(d),
      meta: A.dataBR(a.data).slice(0, 5) + ' · cálculo', metaLong: 'Diferença entre a taxa do Tesouro Prefixado 2032 e a meta Selic. Positiva: o mercado cobra mais para emprestar a prazo longo (prêmio de prazo e expectativa de juros).'});
  }

  /* ---------- o que merece atenção ---------- */
  var PESO = {decidir: 0, investigar: 1, monitorar: 2, dados: 3};
  function eventos(snap, ses, c) {
    var out = [];
    if (snap) {
      var al = M.detectar(snap, c.limites, C);
      // fatores acima do limite na sessão
      al.filter(function (a) { return a.tipo === 'fator' && a.data === ses; }).forEach(function (a) {
        var f = snap.fatores[a.k], m = MEC[a.k] || {}, ex = exposicao(a.k);
        out.push({tipo: a.suspeito ? 'dados' : 'monitorar', ordem: -Math.abs(a.var) / a.limite, titulo: (f.detalhe || f.nome || M.NOME[a.k]) + ' ' + M.fmtVar(a.var, a.uvar) + (a.suspeito ? ' · conferir' : ''),
          fato: M.fmtNivel(f) + ' (' + M.fmtVar(a.var, a.uvar) + ' contra ' + A.dataBR(f.data_anterior || '') + (f.data_anterior ? '' : 'o fechamento anterior') + '; limite de alerta ' + M.fmtVar(a.limite, a.uvar).replace('+', '') + ').',
          mec: m.txt, afeta: ex.length ? listaPesos(ex.map(function (x) { return {m: x.m, w: x.w}; }), 3) : null, afetaRot: 'Mais expostas', ver: m.ver,
          src: [f.fonte, A.dataBR(f.data) + (f.hora ? ' ' + f.hora : ''), f.tipo_preco === 'fechamento' ? 'fechamento' : null].filter(Boolean).join(' · '),
          acts: [['Testar na Sala', function () { var ch = {}; ch[a.k] = a.var; S.choques = ch; S.cenEvento = 'Movimento de ' + A.dataBR(ses); A.go('cart', 'risco'); S.sub.risco = 'cenarios'; A.render(); }]]});
      });
      // ativos acima do limite na sessão (só os que estão em alguma carteira)
      al.filter(function (a) { return a.tipo === 'ativo' && a.data === ses; }).forEach(function (a) {
        var pw = pesosDoAtivo(a.t); if (!pw.length) return;
        var cq = snap.ativos[a.t], ns = (snap.noticias || []).filter(function (n) { return n.tema === a.t && (n.quando || '').slice(0, 10) >= ses; });
        var tese = A.teseDe && A.teseDe(a.t), T = tese && tese.tese;
        out.push({tipo: a.suspeito ? 'dados' : 'investigar', ordem: -Math.abs(a.var) / a.limite, titulo: a.t + ' ' + M.fmtVar(a.var, '%') + (a.suspeito ? ' · variação anormal, conferir' : ''), tk: a.t,
          fato: (C.ATV[a.t] ? C.ATV[a.t].nome + ': ' : '') + (cq.moeda === 'USD' ? 'US$ ' : 'R$ ') + A.num(cq.preco, 2) + ' (' + M.fmtVar(a.var, '%') + '; limite ' + M.fmtVar(a.limite, '%').replace('+', '') + ').' + (a.suspeito ? ' Fora dos cálculos do dia até ser conferida.' : ''),
          mec: ns.length ? 'Manchete do mesmo dia: “' + ns[0].titulo + '” (' + (ns[0].fonte || 'fonte não informada') + '). Relação não confirmada.' : 'Nenhuma manchete do robô sobre a empresa nesta sessão: o motivo do movimento não está identificado.',
          mecRot: ns.length ? 'Possível causa' : 'Causa', afeta: listaPesos(pw, 3), afetaRot: 'Peso nas carteiras', ver: T ? T.questao : null, verRot: T ? 'Questão da tese' : null,
          src: [cq.fonte, A.dataBR(cq.data) + (cq.hora ? ' ' + cq.hora : '')].filter(Boolean).join(' · '),
          acts: [['Abrir a tese', function () { A.abrirTese(a.t); }]]});
      });
      // notícias com relevância alta: empresa das carteiras ou macro oficial
      (snap.noticias || []).filter(function (n) { var k = n.classe || {}; return k.relevancia === 'alta' && (n.quando || '').slice(0, 10) >= M.hojeBRT(new Date(Date.now() - 3 * 864e5)); }).slice(0, 8).forEach(function (n) {
        var k = n.classe, emp = C.ATV[n.tema] ? n.tema : null, pw = emp ? pesosDoAtivo(emp) : [];
        if (emp && !pw.length) return;
        var T = emp && A.teseDe && A.teseDe(emp), crit = T && T.tese ? T.tese.criterios[0] : null;
        out.push({tipo: k.tese && k.tese.length ? 'investigar' : 'monitorar', ordem: -(k.pontos || 0) / 4, titulo: n.titulo, link: n.link, tk: emp,
          fato: (emp ? emp + ' · ' : (n.tema ? n.tema + ' · ' : '')) + (n.fonte || 'fonte não informada') + (k.oficial ? ' (documento oficial)' : k.confiavel ? '' : ' (veículo fora da lista de confiáveis)') + '.',
          mec: k.porque + (k.tese && k.tese.length ? ' Risco da tese tocado: ' + k.tese.join('; ') + '.' : ''), mecRot: 'Por que importa',
          afeta: emp ? listaPesos(pw, 3) : null, afetaRot: 'Peso nas carteiras', natureza: k.natureza,
          ver: crit, verRot: crit ? 'Critério da tese' : null,
          src: 'classificação automática por regras · ' + (n.quando ? A.dataBR(n.quando) + ' ' + n.quando.slice(11, 16) : ''),
          acts: [['Analisar na Sala', function () { A.salaRodar && A.salaRodar((emp ? emp + ': ' : '') + n.titulo + ' (' + (n.fonte || '') + ')', (n.fonte || '') + (n.link ? ' · ' + n.link : ''), emp ? 'Resultado de empresa' : 'Outro', S.cart); }]].concat(emp ? [['Abrir a tese', function () { A.abrirTese(emp); }]] : [])});
      });
      // Focus: mudança da mediana na semana
      var fo = (snap.indicadores || {}).focus || {}, ano = String(new Date().getFullYear()), mud = [];
      Object.keys(fo).forEach(function (nm) { var x = fo[nm].anos && fo[nm].anos[ano]; if (x && x.var) mud.push(nm + ' ' + ano + ': ' + A.num(x.anterior, 2) + ' → ' + A.num(x.mediana, 2) + (nm === 'Câmbio' ? '' : '%')); });
      if (mud.length) { var f0 = fo[Object.keys(fo)[0]]; out.push({tipo: 'monitorar', ordem: -1, titulo: 'Focus mudou: ' + mud.slice(0, 2).join(' · '), fato: 'Mediana do Relatório Focus de ' + A.dataBR(f0.data) + ' contra ' + A.dataBR(f0.data_anterior) + ': ' + mud.join(' · ') + '.', mec: 'Expectativas de inflação e de Selic mudam a curva de juros esperada e, com ela, o custo de capital e o valor dos ativos de prazo longo.', mecRot: 'Mecanismo', ver: 'se a revisão é isolada ou tendência de várias semanas', src: 'Banco Central · Focus'}); }
      // cotações suspeitas ou faltando
      var cob = snap.cobertura || {};
      if ((cob.lista_suspeitos || []).length) out.push({tipo: 'dados', ordem: 0, titulo: 'Conferir antes de usar: ' + cob.lista_suspeitos.join(', '), fato: 'Variação fora do normal para a classe do ativo. Essas cotações ficam fora dos cálculos do dia até serem conferidas.', mec: null, src: 'robô · regra de anomalia por classe (config.json)'});
      if ((cob.lista_indisponiveis || []).length) out.push({tipo: 'dados', ordem: 1, titulo: cob.lista_indisponiveis.length + ' ativo(s) sem cotação', fato: cob.lista_indisponiveis.join(', ') + '. Nenhum valor foi preenchido no lugar.', src: 'robô', acts: [['Ver qualidade dos dados', function () { A.abrirQualidade(); }]]});
    }
    // integridade das carteiras aprovadas (decisão do Comitê)
    var inval = C.CARTS.filter(function (m) { var v = STORE.aprovadaVigente(C, m.id); var val = C.validate(v, Object.assign(A.ctx(), {irmaos: A.irmaos()})); return val.status === 'invalida'; });
    if (inval.length) out.push({tipo: 'decidir', ordem: -inval.length, titulo: inval.length + ' de ' + C.CARTS.length + ' carteiras aprovadas não fecham 100%', fato: 'Pilares ou ativos passam do total em ' + (function () { var f = {}; inval.forEach(function (m) { f[m.familia] = (f[m.familia] || 0) + 1; }); return Object.keys(f).map(function (k) { return k + ' (' + f[k] + ')'; }).join(', '); })() + '. Os pesos não são ajustados automaticamente.', mec: 'Enquanto não forem corrigidas, risco, cenários e performance dessas carteiras aparecem como parciais.', mecRot: 'Consequência', ver: 'proposta de correção para o Comitê, com justificativa e registro da versão aprovada', verRot: 'Decisão pendente', src: 'motor de validação · versão aprovada vigente', acts: [['Ver no mapa', function () { A.go('cart', 'mapa'); }]]});
    return out.sort(function (a, b) { return (PESO[a.tipo] - PESO[b.tipo]) || (a.ordem - b.ordem); });
  }
  var ROT = {decidir: 'Decidir', investigar: 'Investigar', monitorar: 'Monitorar', dados: 'Qualidade dos dados'};
  function evNode(e) {
    var dl = h('dl', {class: 'why'});
    if (e.mec) dl.append(h('dt', null, e.mecRot || 'Mecanismo'), h('dd', null, e.mec));
    if (e.afeta) dl.append(h('dt', null, e.afetaRot || 'Afeta'), h('dd', null, e.afeta));
    if (e.natureza && e.natureza !== 'indefinido') dl.append(h('dt', null, 'Natureza'), h('dd', null, {estrutural: 'pode mudar a tese (estrutural)', pontual: 'fato pontual', ruido: 'tende a ser ruído de curto prazo'}[e.natureza] || e.natureza));
    if (e.ver) dl.append(h('dt', null, e.verRot || 'Acompanhar'), h('dd', null, e.ver));
    return h('div', {class: 'ev ' + e.tipo}, h('span', {class: 'bar'}),
      h('div', null,
        h('div', {class: 'row', style: 'gap:8px;margin-bottom:2px'}, A.chip(ROT[e.tipo], e.tipo === 'decidir' ? 'g-critica' : e.tipo === 'investigar' ? 'g-media' : e.tipo === 'monitorar' ? 'o-e' : '')),
        h('h4', null, A.link(e.link) ? h('a', {href: A.link(e.link), target: '_blank', rel: 'noopener', style: 'color:inherit'}, e.titulo) : e.titulo),
        h('div', {class: 'fact'}, h('span', {class: 'k', style: 'margin-right:6px'}, 'Fato'), e.fato),
        dl.childNodes.length ? dl : null,
        e.src ? h('div', {class: 'src'}, e.src) : null,
        e.acts && e.acts.length ? h('div', {class: 'acts'}, e.acts.map(function (x) { return h('button', {class: 'btn sm', onclick: x[1]}, x[0]); })) : null));
  }

  /* ---------- carteiras na sessão ---------- */
  function carteirasHoje(snap, ses) {
    if (!snap || !ses) return h('p', {class: 'empty'}, 'Sem sessão de referência com cotações atualizadas.');
    var wrap = h('div', {class: 'cbars'}), fam = null, rows = C.CARTS.map(function (m) { var v = STORE.aprovadaVigente(C, m.id), r = M.carteiraHoje(v, snap, ses, C); return {m: m, r: r}; });
    var mx = Math.max.apply(null, rows.map(function (x) { return Math.abs(x.r.total); }).concat([0.004]));
    rows.forEach(function (x) {
      if (x.m.familia !== fam) { fam = x.m.familia; wrap.appendChild(h('div', {class: 'fam-h'}, h('i', {style: 'background:' + (A.FAMC[fam] || 'var(--line2)')}), fam)); }
      var cob = x.r.soma > 0 ? x.r.coberto / x.r.soma : 0, baixa = cob < 0.5, t = x.r.total, wpct = Math.min(50, Math.abs(t) / mx * 50);
      wrap.appendChild(h('div', {class: 'cbar', title: 'Contribuição, em pontos percentuais da carteira, das posições com cotação atualizada (' + A.pct(x.r.coberto, 0) + ' da carteira). A parte sem cotação não entra na conta e não é tratada como zero: o número não é o retorno da carteira. Clique para abrir.', onclick: function () { S.cart = x.m.id; S.ver = 'aprovada'; A.go('cart', 'carteira'); }},
        h('span', null, x.m.perfil || x.m.rotulo, h('div', {class: 'cov'}, A.pct(cob, 0) + ' cotado' + (baixa ? ' · cobertura baixa' : ''))),
        h('span', {class: 'tr'}, h('b'), baixa ? null : h('i', {style: 'background:' + (t >= 0 ? 'var(--up-bar)' : 'var(--down)') + ';' + (t >= 0 ? 'left:50%;width:' + wpct + '%' : 'right:50%;width:' + wpct + '%')})),
        h('span', {class: 'n ' + (baixa ? 'muted' : A.cls(t)), title: baixa ? 'Menos de 50% da carteira com cotação atualizada: o número não é mostrado.' : null}, baixa ? '—' : A.pp(t, 2).replace(' p.p.', ''))));
    });
    return wrap;
  }

  function focusTab(snap) {
    var fo = snap && snap.indicadores && snap.indicadores.focus; if (!fo || !Object.keys(fo).length) return h('p', {class: 'muted', style: 'font-size:.9rem'}, 'Focus: sem leitura nesta rodada.');
    var ano = String(new Date().getFullYear()), prox = String(Number(ano) + 1), d0 = fo[Object.keys(fo)[0]];
    var f = function (x, u) { if (!x) return '—'; return h('span', null, A.num(x.mediana, 2) + u, x.var ? h('span', {class: 'muted', style: 'font-size:.8rem'}, ' (' + A.snum(x.var, 2) + ')') : null); };
    return h('div', null, A.table([{k: 'n', t: 'Mediana', s: false}, {k: 'a', t: ano, r: 1, s: false}, {k: 'b', t: prox, r: 1, s: false}],
      Object.keys(fo).map(function (k) { var it = fo[k], u = k === 'Câmbio' ? '' : '%'; return {n: k, a: f(it.anos[ano], u), b: f(it.anos[prox], u)}; }), {sort: null}),
      h('p', {class: 'hint', style: 'margin-top:6px'}, 'Relatório Focus de ' + A.dataBR(d0.data) + '; entre parênteses, a mudança contra ' + A.dataBR(d0.data_anterior) + '. Fonte: Banco Central.'));
  }

  function resumo(snap, ses, evs) {
    if (!snap) return 'Ainda sem leitura do robô neste aparelho.';
    var F = snap.fatores, partes = [];
    [['ibov', 'Ibovespa'], ['usd', 'dólar'], ['pre', 'prefixado 2032'], ['real', 'IPCA+ 2035']].forEach(function (x) { var f = F[x[0]]; if (f && f.ok && M.usavel(f) && f.data === ses && f.var != null) partes.push(x[1] + ' ' + M.fmtVar(f.var, f.uvar)); });
    var sel = F.selic; if (sel && sel.ok) partes.push('Selic ' + A.num(sel.nivel, 2) + '%');
    var n = evs.filter(function (e) { return e.tipo === 'investigar' || e.tipo === 'decidir'; }).length;
    return (partes.length ? 'Sessão de ' + A.dataBR(ses) + ': ' + partes.join(', ') + '. ' : 'Sem cotações atualizadas da sessão. ') + (n ? n + ' ponto' + (n > 1 ? 's' : '') + ' para investigar ou decidir.' : 'Nada pede decisão agora.');
  }

  A.areas.hoje = function () {
    var E = A.mercadoEstado || {}, snap = E.snap, c = A.mercadoCfg ? A.mercadoCfg() : M.CFG_PADRAO, ses = M.sessao(snap), I = (snap && snap.indicadores) || {};
    var evs = eventos(snap, ses, c), wrap = h('div');
    var agora = new Date(), dia = agora.toLocaleDateString('pt-BR', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo'});
    wrap.appendChild(h('div', {class: 'desk-h'}, h('div', null,
      h('p', {class: 'kick'}, dia + (ses ? ' · sessão de referência ' + A.dataBR(ses) : '')),
      h('h1', null, 'Hoje na mesa'),
      h('p', {class: 'sum'}, resumo(snap, ses, evs)))));
    if (!snap) {
      wrap.appendChild(A.sec('Sem dados de mercado neste aparelho', null, h('div', null,
        h('p', null, E.carregando ? 'Buscando a última rodada do robô…' : (A.mercadoBloqueado && A.mercadoBloqueado() ? 'Nesta página do claude.ai o navegador não pode buscar dados na internet. Abra o site do painel (GitHub Pages) para ver o mercado ao vivo.' : 'O robô publica os dados no site a cada 30 minutos em dias úteis. Se esta mensagem continuar, abra “Dados” no topo para ver o que falhou.')),
        h('div', {class: 'row'}, h('button', {class: 'btn', onclick: function () { A.mercadoAtualizar && A.mercadoAtualizar(); }}, 'Buscar agora'), h('button', {class: 'btn', onclick: function () { A.abrirQualidade(); }}, 'Qualidade dos dados')))));
    }

    // 1. Brasil
    var go = function (k) { return function () { A.abrirFator && A.abrirFator(k); }; };
    wrap.appendChild(h('div', {class: 'k', style: 'margin:0 0 6px'}, 'Brasil'));
    wrap.appendChild(h('div', {class: 'strip'},
      tileFator(snap, 'ibov', 'Ibovespa', 'IBOV', {on: go('ibov')}),
      tileFator(snap, 'usd', 'Dólar', 'USDBRL', {on: go('usd')}),
      tileFator(snap, 'pre', 'Pré 2032 (DI longo)', 'DI', {on: go('pre')}),
      tileFator(snap, 'real', 'IPCA+ 2035 (NTN-B)', 'NTNB', {on: go('real')}),
      tileFator(snap, 'selic', 'Selic meta', 'SELIC', {on: go('selic')}),
      tileInd(I, 'ipca_12m', 'IPCA 12 meses'),
      tileSpread(snap),
      tileFator(snap, 'brent', 'Petróleo Brent', 'BRENT', {on: go('brent')})));
    wrap.appendChild(h('div', {class: 'row', style: 'margin:-6px 0 8px'}, h('div', {class: 'k'}, 'Mundo'), h('button', {class: 'btn link', style: 'font-size:.84rem', onclick: function () { A.go('global'); }}, 'Estratégia Global →')));
    wrap.appendChild(h('div', {class: 'strip n5'},
      tileFator(snap, 'sp', 'S&P 500', 'SPX'), tileFator(snap, 'ust10', 'Treasury 10 anos', 'UST10'), tileFator(snap, 'ust2', 'Treasury 2 anos', 'UST2'), tileFator(snap, 'em', 'Emergentes (EEM)', 'EEM'), tileFator(snap, 'btc', 'Bitcoin', 'BTC')));

    // 2. atenção + carteiras
    var g = h('div', {class: 'grid2'}), L = h('div'), R = h('div'); g.append(L, R); wrap.appendChild(g);
    var mostrar = evs.slice(0, 7);
    L.appendChild(A.sec('O que merece atenção', {mtd: 'hoje', hint: 'Fato, mecanismo e o que acompanhar, separados. A ordem é: decidir, investigar, monitorar e qualidade dos dados. Nada aqui é recomendação: é o que pede o seu julgamento.'},
      mostrar.length ? h('div', null, mostrar.map(evNode), evs.length > mostrar.length ? h('button', {class: 'btn link', onclick: function () { A.drawer('Tudo o que pede atenção (' + evs.length + ')', h('div', null, evs.map(evNode))); }}, 'Ver todos (' + evs.length + ')') : null)
        : h('p', {class: 'empty'}, 'Nenhum movimento acima dos limites, nenhuma notícia de alta relevância e nenhuma carteira com problema.')));
    R.appendChild(A.sec('Carteiras na sessão', {mtd: 'hoje', hint: 'Contribuição do dia, em p.p. da carteira, só das posições com cotação atualizada (peso aprovado × variação). A parte sem cotação não entra e não vira zero; por isso o número não é o retorno da carteira até a cobertura chegar a 100%.'}, carteirasHoje(snap, ses)));
    R.appendChild(A.sec('Expectativas', null, focusTab(snap)));

    // 3. qualidade dos dados
    var ql = A.qualidadeLinha ? A.qualidadeLinha() : null; if (ql) wrap.appendChild(ql);
    return wrap;
  };

  A.MTD = A.MTD || {};
  A.MTD.hoje = function () {
    return h('div', null,
      h('p', null, h('b', null, 'De onde vêm os números. '), 'Do robô no GitHub (a cada 30 minutos em dias úteis) e, no navegador, direto do Banco Central e do câmbio. Cada número mostra data, hora, fonte e estado: ', h('i', {class: 'dot atualizado'}), ' atualizado, ', h('i', {class: 'dot desatualizado'}), ' desatualizado (último valor válido, marcado), ', h('i', {class: 'dot suspeito'}), ' variação anormal em conferência, ', h('i', {class: 'dot indisponivel'}), ' sem dado.'),
      h('p', null, h('b', null, 'Tendência. '), '1m e 12m comparam o último ponto com o ponto mais próximo de 30 e 365 dias corridos antes, nas séries históricas do robô. Juros em pontos percentuais; preços em %.'),
      h('p', null, h('b', null, 'Carteiras na sessão. '), 'Contribuição em pontos percentuais: soma de peso × variação do dia só das posições com cotação atualizada na sessão de referência. Posições no exterior convertidas pelo dólar do dia. Não é o retorno da carteira enquanto a cobertura for menor que 100%: a parte sem cotação não é tratada como zero, fica de fora, e a cobertura aparece ao lado. Abaixo de 50%, o número não é mostrado.'),
      h('p', null, h('b', null, 'O que merece atenção. '), 'Movimentos acima dos limites de alerta (config.json do robô); notícias classificadas pelo robô com relevância alta (regras: fonte oficial, categoria do fato, risco da tese tocado, ruído); mudanças do Focus; dados suspeitos ou faltando; carteiras aprovadas inválidas. O mecanismo descrito é a regra econômica geral de transmissão, não uma estimativa; “mais expostas” soma os pesos aprovados nos pilares e ativos ligados ao fator.'));
  };
})(APP, CORE, MERCADO);
