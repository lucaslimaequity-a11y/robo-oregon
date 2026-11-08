/* HOJE — briefing diário. Em cinco minutos: os números do Brasil, as notícias que merecem leitura, o que mudou desde o
   último pregão, o que aconteceu com as empresas das carteiras, a conexão do exterior com o Brasil e um exercício curto.
   Todo número mostra data, fonte e estado; dado que falta aparece como falta. Nada aqui é recomendação nem cotação em
   tempo real: o robô publica a cada 30 minutos em dias úteis. */
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
  function refIds() { return A.REF.map(function (r) { return r[0]; }); }
  function refRot(id) { var r = A.REF.filter(function (x) { return x[0] === id; })[0]; return r ? r[1] : (C.MAND[id] || {}).rotulo; }

  // Peso exposto de cada carteira (versão aprovada vigente) a um fator: soma dos pesos nos pilares e ativos ligados ao fator
  function exposicao(k, ids) {
    var m = MEC[k]; if (!m) return [];
    var tk = {}; (m.tickers || []).forEach(function (t) { tk[t] = 1; }); (m.grupos || []).forEach(function (g) { var G = grupos(); (G[g] ? G[g].tickers : []).forEach(function (t) { tk[t] = 1; }); });
    return C.CARTS.filter(function (c) { return !ids || ids.indexOf(c.id) >= 0; }).map(function (c) {
      var v = STORE.aprovadaVigente(C, c.id), w = 0;
      (v.pos || []).forEach(function (x) { if (x.w > 0 && ((m.pil || []).indexOf(x.p) >= 0 || tk[x.t])) w += x.w; });
      return {m: c, w: w};
    }).filter(function (x) { return ids || x.w > 0.0001; }).sort(function (a, b) { return b.w - a.w; });
  }
  A.exposicaoFator = exposicao;
  function pesosDoAtivo(t, ids) {
    var al = C.D.aliases || {};
    return C.CARTS.filter(function (c) { return !ids || ids.indexOf(c.id) >= 0; }).map(function (c) { var v = STORE.aprovadaVigente(C, c.id); return {m: c, w: C.sum((v.pos || []).filter(function (x) { return x.w > 0 && (x.t === t || (al[x.t] && al[x.t].para === t)); }), function (x) { return x.w; })}; })
      .filter(function (x) { return x.w > 0; }).sort(function (a, b) { return b.w - a.w; });
  }
  A.pesosDoAtivo = pesosDoAtivo;
  function listaPesos(xs, n) {
    if (!xs.length) return h('span', {class: 'muted'}, 'não está em nenhuma carteira-modelo');
    return h('span', null, xs.slice(0, n || 3).map(function (x, i) { return h('span', null, i ? ' · ' : '', h('button', {class: 'btn link', onclick: function () { S.cart = x.m.id; S.ver = 'aprovada'; A.go('cart', refIds().indexOf(x.m.id) >= 0 ? 'ref' : 'carteira'); }}, refIds().indexOf(x.m.id) >= 0 ? refRot(x.m.id) : x.m.rotulo), ' ' + A.pct(x.w, 1)); }), xs.length > (n || 3) ? h('span', {class: 'muted'}, ' e mais ' + (xs.length - (n || 3))) : null);
  }

  /* ---------- números do dia ---------- */
  var hm = function (iso) { try { return new Date(iso).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'}); } catch (e) { return ''; } };
  function serieHist(id) { var H = A.mercadoHist && A.mercadoHist(); return H && H.series && H.series[id] ? H.series[id] : null; }
  function tile(o) {
    var st = o.estado || 'indisponivel';
    return h('div', {class: 'tile' + (o.v == null ? ' na' : ''), 'data-click': o.on ? '1' : null, onclick: o.on || null, title: o.title || null, role: o.on ? 'button' : null, tabindex: o.on ? '0' : null, onkeydown: o.on ? function (e) { if (e.key === 'Enter') o.on(); } : null},
      h('span', {class: 'lbl'}, h('i', {class: 'dot ' + st, title: M.ESTADO_TXT[st] || st}), o.lbl),
      h('span', {class: 'v'}, o.v == null ? 'sem dado' : o.v, o.u ? h('small', null, o.u) : null),
      o.d != null ? h('span', {class: 'd ' + (o.dcls || '')}, o.d) : h('span', {class: 'd muted'}, o.dtxt || ' '),
      o.tr ? h('span', {class: 't'}, o.tr) : null,
      o.spark || null,
      h('span', {class: 'meta', title: o.metaLong || null}, o.meta || ''));
  }
  function trendTxt(id, pp) {
    var s = serieHist(id); if (!s) return null;
    var a = M.tendencia(s.pts, 30), b = M.tendencia(s.pts, 365), f = function (x) { return x ? (pp ? A.snum(x.d, 2) : A.spct(x.r, 1)) : '—'; };
    if (!a && !b) return null;
    return [h('span', null, '1m ', h('b', {class: A.cls(pp ? (a && a.d) : (a && a.r))}, f(a))), h('span', null, '12m ', h('b', {class: A.cls(pp ? (b && b.d) : (b && b.r))}, f(b)))];
  }
  function sparkDe(id) { var s = serieHist(id); if (!s || !s.pts || s.pts.length < 10) return null; return A.spark(s.pts.slice(-66), 'var(--ink2)'); }
  function curta(fonte) { return String(fonte || '').replace(/ \(.*\)$/, '').replace('Banco Central · ', 'BC · ').replace('Tesouro Transparente', 'Tesouro').replace('Yahoo Finance', 'Yahoo').replace('Tesouro dos EUA', 'Tesouro EUA'); }
  function tileFator(snap, k, lbl, histId, opt) {
    opt = opt || {}; var f = snap && snap.fatores ? snap.fatores[k] : null, st = M.estado(f), pp = f && f.uvar === 'pp';
    if (!f || !f.ok) return tile({lbl: lbl, estado: 'indisponivel', meta: f && f.motivo ? f.motivo : 'sem fonte nesta rodada', metaLong: f && f.motivo, on: opt.on});
    var nv = M.fmtNivel(f), u = null;
    if (/ pts$/.test(nv)) { nv = nv.replace(/ pts$/, ''); u = 'pts'; }
    return tile({lbl: lbl, estado: st, v: nv, u: u,
      d: f.var != null ? M.fmtVar(f.var, f.uvar) + (st !== 'atualizado' ? ' · ' + M.ESTADO_TXT[st] : '') : null, dcls: st === 'atualizado' ? A.cls(f.var) : 'muted',
      tr: histId ? trendTxt(histId, pp) : null, spark: histId ? sparkDe(histId) : null,
      meta: A.dataBR(f.data).slice(0, 5) + (f.hora ? ' ' + f.hora : '') + ' · ' + curta(f.fonte), metaLong: (f.fonte || '') + ' · ' + (f.detalhe ? f.detalhe + ' · ' : '') + (f.tipo_preco === 'fechamento' ? 'preço de fechamento' : f.tipo_preco === 'intradiario' ? 'intradiário (atraso do fornecedor; não é tempo real)' : '') + (f.motivo ? ' · ' + f.motivo : ''),
      on: opt.on});
  }
  function tileInd(I, k, lbl) {
    var x = I && I[k]; if (!x) return tile({lbl: lbl, estado: 'indisponivel', meta: 'sem leitura'});
    return tile({lbl: lbl, estado: 'atualizado', v: A.num(x.nivel, 2) + '%', d: x.var != null ? M.fmtVar(x.var, x.unid === 'R$' ? '%' : 'pp') : null, dcls: A.cls(x.var), dtxt: x.data ? (/ipca/.test(k) ? 'mês ' + x.data.slice(5, 7) + '/' + x.data.slice(0, 4) : '') : '',
      meta: (/ipca/.test(k) ? 'ref. ' + x.data.slice(5, 7) + '/' + x.data.slice(0, 4) : A.dataBR(x.data).slice(0, 5)) + ' · ' + curta(x.fonte).replace(/ · SGS \d+/, ''), metaLong: x.fonte});
  }
  function tileSpread(snap) {
    var a = snap && snap.fatores.pre, b = snap && snap.fatores.selic;
    if (!a || !a.ok || !b || !b.ok) return tile({lbl: 'Pré 2032 − Selic', estado: 'indisponivel', meta: 'falta a taxa prefixada ou a Selic'});
    var v = a.nivel - b.nivel, d = (a.var != null && b.var != null && a.data === b.data) ? a.var - b.var : null;
    return tile({lbl: 'Pré 2032 − Selic', estado: M.estado(a) === 'atualizado' && M.estado(b) === 'atualizado' ? 'atualizado' : 'desatualizado', v: A.snum(v, 2), u: 'p.p.', d: d != null ? A.snum(d, 2) + ' p.p.' : null, dcls: A.cls(d),
      meta: A.dataBR(a.data).slice(0, 5) + ' · cálculo', metaLong: 'Diferença entre a taxa do Tesouro Prefixado 2032 e a meta Selic. Positiva: o mercado cobra mais para emprestar a prazo longo (prêmio de prazo e expectativa de juros).'});
  }

  /* ---------- notícias do dia ---------- */
  var CAT = [['todas', 'Todas'], ['brasil', 'Brasil'], ['empresas', 'Empresas'], ['juros', 'Juros e Fiscal'], ['commodities', 'Commodities'], ['mundo', 'Mundo']];
  var CAT_ROT = {brasil: 'Brasil', empresas: 'Empresas', juros: 'Juros e Fiscal', commodities: 'Commodities', mundo: 'Mundo'};
  var HF = {filtro: 'todas'};
  function heldRef() { var o = {}; refIds().forEach(function (id) { (STORE.aprovadaVigente(C, id).pos || []).forEach(function (x) { if (x.w > 0) o[x.t] = 1; }); }); if (o.BBDC3) o.BBDC4 = 1; return o; }
  function heldTodas() { var o = {}; C.CARTS.forEach(function (m) { (STORE.aprovadaVigente(C, m.id).pos || []).forEach(function (x) { if (x.w > 0) o[x.t] = 1; }); }); if (o.BBDC3) o.BBDC4 = 1; return o; }
  function noticiasTodas() { var E = A.mercadoEstado || {}; return (E.arquivo && E.arquivo.itens) || (E.snap && E.snap.noticias) || []; }
  // Fator de mercado ligado a uma notícia de macro (para abrir a gaveta com o mecanismo e a exposição)
  function fatorDe(n) {
    var t = ' ' + String(n.titulo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + ' ';
    if (/copom|selic/.test(t)) return 'selic';
    if (/ipca|inflacao|ntn-b|juro real|ima-b/.test(t)) return 'real';
    if (/juros futuros|di futuro|curva|prefixad|fiscal|arcabouco|divida publica/.test(t)) return 'pre';
    if (/dolar|cambio/.test(t)) return 'usd';
    if (/petroleo|brent|opep/.test(t)) return 'brent';
    if (/treasur|fed |federal reserve|payroll/.test(t)) return 'ust10';
    if (/ibovespa/.test(t)) return 'ibov';
    if (/bitcoin|cripto/.test(t)) return 'btc';
    return null;
  }
  function tkTema(n) { var t = n.tema; if (t === 'BBDC4' && !C.ATV.BBDC4) t = 'BBDC3'; return C.ATV[t] ? t : null; }
  function nwCard(n, held) {
    var k = n.classe || {}, cat = M.catNoticia(n, C.ATV), tk = tkTema(n), fk = tk ? null : fatorDe(n), rl = M.relevN(n);
    var pw = tk ? pesosDoAtivo(tk, refIds()) : [];
    var links = [];
    if (tk) links.push(h('button', {class: 'nwl tkl', title: 'Abrir a ficha de ' + tk, onclick: function () { A.abrirFicha(tk); }}, tk, h('small', null, ' ficha')));
    (n.etfs || []).forEach(function (e) { if (C.ATV[e]) links.push(h('button', {class: 'nwl tkl', title: 'Abrir a ficha do ETF ' + e, onclick: function () { A.abrirFicha(e); }}, e, h('small', null, ' índice'))); });
    if (tk && C.ATV[tk].setor) links.push(h('button', {class: 'nwl', title: 'Ver as empresas do setor em Research', onclick: function () { A.abrirSetor && A.abrirSetor(C.ATV[tk].setor); }}, 'setor: ' + C.ATV[tk].setor));
    if (fk) links.push(h('button', {class: 'nwl', title: 'Como esse fator chega às carteiras', onclick: function () { A.abrirFator(fk); }}, M.NOME[fk], h('small', null, ' → carteiras')));
    var quando = n.quando ? A.dataBR(n.quando).slice(0, 5) + (n.quando.slice(11, 16) && n.quando.slice(11, 16) !== '00:00' ? ' ' + n.quando.slice(11, 16) : '') : '';
    return h('article', {class: 'nw c-' + cat.principal},
      h('div', {class: 'nw-meta'}, h('span', {class: 'nw-cat'}, CAT_ROT[cat.principal]), h('span', null, (n.fonte || 'fonte não informada') + (quando ? ' · ' + quando : '')),
        rl === 'alta' ? h('span', {class: 'chip g-critica'}, 'alta relevância') : null, k.oficial ? h('span', {class: 'chip o-obs'}, 'documento oficial') : null,
        n.etfs && n.etfs.length ? h('span', {class: 'chip', title: 'Notícia sobre o índice ou a estratégia do ETF, não sobre o fundo'}, 'sobre o índice') : null),
      h('h3', null, A.link(n.link) ? h('a', {href: A.link(n.link), target: '_blank', rel: 'noopener'}, n.titulo) : n.titulo),
      h('p', {class: 'nw-why'}, h('b', null, 'Por que importa: '), (k.porque || 'classificação automática indisponível') + (pw.length ? ' Peso nas carteiras de referência: ' + pw.map(function (x) { return refRot(x.m.id) + ' ' + A.pct(x.w, 1); }).join(', ') + '.' : '')),
      links.length ? h('div', {class: 'nw-links'}, links) : null);
  }
  function noticiasSec() {
    var held = heldTodas(), todas = noticiasTodas(), ds = M.destaques(todas, {hoje: M.hojeBRT(), held: held, max: 10, min: 5});
    var cont = {todas: ds.length}; CAT.slice(1).forEach(function (c) { cont[c[0]] = 0; });
    var cats = ds.map(function (n) { var c = M.catNoticia(n, C.ATV); Object.keys(c.tags).forEach(function (k) { if (c.tags[k]) cont[k]++; }); return c; });
    var body = h('div'), filtros = h('div', {class: 'sub filt', role: 'toolbar', 'aria-label': 'Filtrar notícias'});
    function draw() {
      filtros.replaceChildren.apply(filtros, CAT.map(function (c) { return h('button', {'aria-pressed': HF.filtro === c[0] ? 'true' : 'false', disabled: c[0] !== 'todas' && !cont[c[0]] ? true : null, onclick: function () { HF.filtro = c[0]; draw(); }}, c[1] + ' ' + cont[c[0]]); }));
      var lista = ds.filter(function (n, i) { return HF.filtro === 'todas' || cats[i].tags[HF.filtro]; });
      body.replaceChildren.apply(body, lista.length ? lista.map(function (n) { return nwCard(n, held); }) : [h('p', {class: 'empty'}, todas.length ? 'Nenhuma notícia de média ou alta relevância neste filtro nos últimos dias.' : (A.mercadoBloqueado && A.mercadoBloqueado() ? 'Nesta página do claude.ai o navegador não acessa a internet: as notícias aparecem no site do painel.' : 'Ainda sem notícias do robô neste aparelho.'))]);
    }
    draw();
    var E = A.mercadoEstado || {}, arq = E.arquivo;
    return A.sec('Notícias do dia', {id: 'noticias', hint: 'As que mais importam para as carteiras e as teses, não um feed: média ou alta relevância nas últimas 48 horas (até 4 dias, se faltar), no máximo duas por empresa ou tema. A relevância é calculada por regras (fonte oficial, tipo de fato, risco da tese tocado, ruído), sem IA.',
      right: h('button', {class: 'btn sm', onclick: function () { A.go('res', 'eventos'); }}, 'Arquivo completo')},
      [filtros, body, arq ? h('p', {class: 'muted', style: 'font-size:.8rem;margin:8px 0 0'}, 'Arquivo de notícias do robô: ' + A.dataBR(arq.gerado_em) + ' ' + hm(arq.gerado_em) + ' · ' + (arq.itens || []).length + ' manchetes guardadas (só título, link, data e veículo).') : null]);
  }

  /* ---------- o que mudou desde o último pregão ---------- */
  function mudouSec(snap, c) {
    if (!snap) return A.sec('O que mudou desde o último pregão', null, h('p', {class: 'empty'}, 'Sem leitura do robô.'));
    var ms = M.mudancas(snap, c.limites), lista = h('div', {class: 'mud'});
    ms.slice(0, 7).forEach(function (m) {
      var f = m.f, acima = m.ratio >= 1;
      lista.appendChild(h('button', {class: 'mud-r' + (acima ? ' forte' : ''), title: 'Como isso chega às carteiras', onclick: function () { A.abrirFator(m.k); }},
        h('span', {class: 'n'}, f.detalhe ? M.NOME[m.k] : (f.nome || M.NOME[m.k])), h('span', {class: 'lv'}, M.fmtNivel(f)),
        h('b', {class: 'vv ' + A.cls(m.var)}, M.fmtVar(m.var, m.uvar)),
        h('span', {class: 'rr'}, h('i', {style: 'width:' + Math.min(100, m.ratio * 50) + '%'})),
        h('span', {class: 'src'}, acima ? h('em', null, 'acima do limite · ') : null, (m.de ? 'vs ' + A.dataBR(m.de).slice(0, 5) + ' · ' : '') + A.dataBR(f.data).slice(0, 5) + (f.hora ? ' ' + f.hora : '') + ' · ' + curta(f.fonte))));
    });
    if (!ms.length) lista.appendChild(h('p', {class: 'empty'}, 'Nenhum fator com variação atualizada nesta rodada.'));
    var extra = [], fo = (snap.indicadores || {}).focus || {}, ano = String(new Date().getFullYear()), mud = [];
    Object.keys(fo).forEach(function (nm) { var x = fo[nm].anos && fo[nm].anos[ano]; if (x && x.var) mud.push(nm + ' ' + ano + ' ' + A.num(x.anterior, 2) + ' → ' + A.num(x.mediana, 2) + (nm === 'Câmbio' ? '' : '%')); });
    if (mud.length) { var f0 = fo[Object.keys(fo)[0]]; extra.push(h('li', null, h('b', null, 'Focus de ' + A.dataBR(f0.data) + ': '), mud.join(' · '), h('span', {class: 'muted'}, ' (Banco Central)'))); }
    var ses = M.sessao(snap), antes = ses ? M.menosDias(ses, 1) : null, nots = noticiasTodas();
    var cvm = nots.filter(function (n) { return n.origem === 'CVM' && (n.quando || '').slice(0, 10) >= (antes || ''); }), ibge = nots.filter(function (n) { return n.origem === 'IBGE' && (n.quando || '').slice(0, 10) >= (antes || ''); });
    if (cvm.length) extra.push(h('li', null, h('b', null, cvm.length + ' documento(s) na CVM: '), cvm.slice(0, 4).map(function (n, i) { return h('span', null, i ? ' · ' : '', tkTema(n) ? h('button', {class: 'btn link', onclick: function () { A.abrirFicha(tkTema(n)); }}, n.tema) : n.tema, ' ' + String(n.categoria_cvm || '').toLowerCase()); })));
    if (ibge.length) extra.push(h('li', null, h('b', null, 'IBGE: '), ibge.slice(0, 2).map(function (n, i) { return h('span', null, i ? ' · ' : '', A.link(n.link) ? h('a', {href: A.link(n.link), target: '_blank', rel: 'noopener'}, n.titulo) : n.titulo); })));
    (snap.alertas || []).filter(function (a) { return a && a.tipo === 'indicador' && (a.data || '') >= (antes || ''); }).slice(0, 2).forEach(function (a) { extra.push(h('li', null, a.texto)); });
    return A.sec('O que mudou desde o último pregão', {hint: 'Variação contra o fechamento anterior, só com dado atualizado. A barra compara com o limite de alerta do fator. Toque numa linha para ver o mecanismo e quanto de cada carteira está exposto.'},
      [lista, extra.length ? h('ul', {class: 'mud-x'}, extra) : null]);
  }

  /* ---------- carteiras de referência na sessão ---------- */
  function barra(m, r) {
    var cob = r.soma > 0 ? r.coberto / r.soma : 0, baixa = cob < 0.5, t = r.total, wpct = Math.min(50, Math.abs(t) / 0.01 * 50);
    return h('div', {class: 'cbar', title: 'Contribuição, em pontos percentuais da carteira, das posições com cotação atualizada (' + A.pct(r.coberto, 0) + ' da carteira). A parte sem cotação não entra na conta e não é tratada como zero: o número não é o retorno da carteira. Clique para abrir.', onclick: function () { S.cart = m.id; S.ver = 'aprovada'; A.go('cart', refIds().indexOf(m.id) >= 0 ? 'ref' : 'carteira'); }},
      h('span', null, refIds().indexOf(m.id) >= 0 ? refRot(m.id) : (m.perfil || m.rotulo), h('div', {class: 'cov'}, A.pct(cob, 0) + ' cotado' + (baixa ? ' · cobertura baixa' : ''))),
      h('span', {class: 'tr'}, h('b'), baixa ? null : h('i', {style: 'background:' + (t >= 0 ? 'var(--up-bar)' : 'var(--down)') + ';' + (t >= 0 ? 'left:50%;width:' + wpct + '%' : 'right:50%;width:' + wpct + '%')})),
      h('span', {class: 'n ' + (baixa ? 'muted' : A.cls(t)), title: baixa ? 'Menos de 50% da carteira com cotação atualizada: o número não é mostrado.' : null}, baixa ? '—' : A.pp(t, 2).replace(' p.p.', '')));
  }
  function carteirasTodas(snap, ses) {
    var wrap = h('div', {class: 'cbars'}), fam = null;
    C.CARTS.forEach(function (m) {
      if (m.familia !== fam) { fam = m.familia; wrap.appendChild(h('div', {class: 'fam-h'}, h('i', {style: 'background:' + (A.FAMC[fam] || 'var(--line2)')}), fam)); }
      wrap.appendChild(barra(m, M.carteiraHoje(STORE.aprovadaVigente(C, m.id), snap, ses, C)));
    });
    return wrap;
  }
  function refSec(snap, ses) {
    var body;
    if (!snap || !ses) body = h('p', {class: 'empty'}, 'Sem sessão de referência com cotações atualizadas.');
    else body = h('div', {class: 'cbars'}, refIds().map(function (id) {
      var v = STORE.aprovadaVigente(C, id), val = A.valida(v), r = M.carteiraHoje(v, snap, ses, C);
      return h('div', null, barra(C.MAND[id], r), val.status !== 'valida' ? h('div', {class: 'ref-st ' + val.status}, val.status === 'invalida' ? 'Versão aprovada inválida (pesos somam ' + A.pct(val.total, 1) + '): contribuição das posições como estão, sem ajuste.' : 'Análise parcial: ' + A.pct(val.cobertura.descoberto, 0) + ' sem instrumento ou sensibilidade (fundos de teste).') : null);
    }));
    return A.sec('Carteiras de referência na sessão', {hint: 'Contribuição do dia, em p.p., das posições com cotação atualizada (peso aprovado × variação). Não é o retorno da carteira até a cobertura chegar a 100%.',
      right: snap && ses ? h('button', {class: 'btn sm', onclick: function () { A.drawer('As 15 carteiras na sessão de ' + A.dataBR(ses), carteirasTodas(snap, ses)); }}, 'As 15') : null}, body);
  }

  /* ---------- agenda ---------- */
  var DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  function agendaSec(snap) {
    var ag = snap && snap.agenda, itens = M.agendaProx(ag, M.hojeBRT(), 10);
    var body = !ag ? h('p', {class: 'empty'}, 'A agenda chega pelo robô: divulgações do IBGE (API oficial) e calendários oficiais do Copom e do Fed.')
      : !itens.length ? h('p', {class: 'empty'}, 'Nenhum evento da agenda nos próximos 10 dias.')
      : h('ul', {class: 'agenda'}, itens.slice(0, 8).map(function (x) {
        var d = new Date(x.data + 'T12:00:00Z');
        return h('li', {class: 'ag-' + (x.tipo || 'outro')}, h('span', {class: 'ag-d'}, h('b', null, A.dataBR(x.data).slice(0, 5)), h('small', null, DIAS[d.getUTCDay()] + (x.hora ? ' ' + x.hora : ''))),
          h('span', null, A.link(x.link) ? h('a', {href: A.link(x.link), target: '_blank', rel: 'noopener'}, x.evento) : x.evento, h('small', {class: 'muted'}, ' · ' + x.fonte + (x.previsto ? ' · data prevista' : ''))));
      }));
    return A.sec('Agenda', {hint: ag && ag.gerado_em ? 'Montada pelo robô em ' + A.dataBR(ag.gerado_em) + '. Copom e Fed pelos calendários oficiais; IBGE pela API de calendário.' : null}, body);
  }

  /* ---------- empresas das carteiras hoje ---------- */
  function empresasSec(snap, ses) {
    var held = heldTodas(), nots = noticiasTodas(), lim = ses ? M.menosDias(ses, 2) : M.menosDias(M.hojeBRT(), 3);
    var lista = Object.keys(C.ATV).filter(function (t) { var a = C.ATV[t]; return held[t] && a.status !== 'placeholder' && (a.classe === 'Ações' || a.classe === 'FIIs') && !(A.ehETF && A.ehETF(t)); }).map(function (t) {
      var q = snap ? M.cotacao(snap, C, t) : null, st = q ? M.estado(q.c) : 'indisponivel', ok = q && st === 'atualizado' && q.c.data === ses && q.c.var != null;
      var ns = nots.filter(function (n) { return (n.tema === t || (t === 'BBDC3' && n.tema === 'BBDC4')) && (n.quando || '').slice(0, 10) >= lim && M.relevN(n) !== 'baixa'; });
      return {t: t, a: C.ATV[t], var: ok ? q.c.var : null, st: st, q: q, n: ns[0] || null, nn: ns.length};
    });
    lista.sort(function (x, y) { return ((y.n ? 1 : 0) - (x.n ? 1 : 0)) || (Math.abs(y.var || 0) - Math.abs(x.var || 0)); });
    var mostrar = lista.filter(function (x) { return x.n || (x.var != null && Math.abs(x.var) >= 1); }).slice(0, 8);
    if (mostrar.length < 4) mostrar = lista.slice(0, 6);
    var body = !lista.length ? h('p', {class: 'empty'}, 'Nenhuma empresa nas carteiras aprovadas.') : h('div', {class: 'emp-hoje'}, mostrar.map(function (x) {
      var pw = pesosDoAtivo(x.t, refIds());
      return h('div', {class: 'eh'}, h('button', {class: 'eh-tk', onclick: function () { A.abrirFicha(x.t); }, title: 'Últimas atualizações de ' + x.t}, x.t),
        h('div', {class: 'eh-b'}, h('div', {class: 'eh-l'}, h('span', null, x.a.nome), x.var != null ? h('b', {class: A.cls(x.var)}, M.fmtVar(x.var, '%')) : h('span', {class: 'muted', title: x.q && x.q.c.motivo || null}, x.st === 'atualizado' ? 'sem pregão hoje' : M.ESTADO_TXT[x.st]), pw.length ? h('small', {class: 'muted'}, pw.map(function (p) { return refRot(p.m.id) + ' ' + A.pct(p.w, 1); }).join(' · ')) : null),
          x.n ? h('div', {class: 'eh-n'}, A.link(x.n.link) ? h('a', {href: A.link(x.n.link), target: '_blank', rel: 'noopener'}, x.n.titulo) : x.n.titulo, h('small', {class: 'muted'}, ' · ' + (x.n.fonte || '') + ' · ' + A.dataBR(x.n.quando).slice(0, 5) + (x.nn > 1 ? ' · +' + (x.nn - 1) : ''))) : h('div', {class: 'eh-n muted'}, x.var != null && Math.abs(x.var) >= 2 ? 'Movimento sem manchete do robô: motivo não identificado.' : 'Sem fato novo de média ou alta relevância.')));
    }));
    return A.sec('Empresas das carteiras hoje', {hint: 'Primeiro as que têm fato novo (CVM ou manchete relevante), depois as que mais andaram. Variação só com cotação atualizada da sessão. Toque no código para ver as últimas atualizações e a tese.',
      right: h('button', {class: 'btn sm', onclick: function () { A.go('res', 'empresas'); }}, 'Todas em Research')}, body);
  }

  /* ---------- conexão do dia: exterior → Brasil ---------- */
  var CONEX = {
    ust10: ['O juro longo americano é a taxa livre de risco do mundo: quando sobe, todo ativo de risco precisa render mais.', 'O diferencial de juros do Brasil diminui e o investidor cobra mais prêmio para ficar em reais.', 'Canal típico: dólar sobe contra o real e a curva brasileira (prefixada e IPCA+) abre.', 'Nas carteiras: P2 e P4 (preço dos títulos) e ações de prazo longo pelo desconto maior; o exterior ganha em reais se o dólar subir.'],
    ust2: ['O título de 2 anos acompanha o que o mercado espera dos juros do Fed.', 'Fed mais duro sustenta o dólar e drena liquidez dos emergentes.', 'No Brasil, reduz o espaço para cortes da Selic e pressiona a parte curta da curva.'],
    sp: ['A bolsa americana resume o apetite global a risco.', 'Apetite maior costuma levar fluxo para emergentes; menor, tirar.', 'Nas carteiras: P11 direto (em dólar) e, pelo fluxo, a parcela em ações brasileiras.'],
    em: ['O ETF de emergentes mede o fluxo para países como o Brasil.', 'Quando emergentes sobem juntos, o movimento é global, não brasileiro.', 'Nas carteiras: P12 direto e, por tabela, Ibovespa e real.'],
    brent: ['O petróleo é receita para Petrobras e PRIO.', 'Pelos combustíveis, chega à inflação e às expectativas de juros.', 'Como o Brasil exporta petróleo, preço mais alto melhora os termos de troca e costuma ajudar o real.'],
    btc: ['O bitcoin afeta o IBIT nas carteiras alternativas.', 'A ligação com os ativos brasileiros é fraca: é um termômetro de apetite a risco e de liquidez global.']
  };
  // Por onde o movimento externo chega à parte brasileira das carteiras (canal econômico geral, não estimativa)
  var CANAL_BR = {ust10: 'pre', ust2: 'selic', sp: 'ibov', em: 'ibov', brent: 'brent'};
  function conexaoSec(snap, c) {
    var cx = snap ? M.conexao(snap, c.limites) : null;
    if (!cx) return A.sec('Conexão do dia · exterior → Brasil', null, h('p', {class: 'empty'}, 'Sem movimento externo atualizado nesta rodada.'));
    var f = cx.f, sobe = cx.var > 0, ids = refIds(), ex = exposicao(cx.k, ids);
    var reacao = cx.br.length ? cx.br.map(function (b) { return h('span', {class: 'cx-b'}, M.NOME[b.k] + ' ', h('b', {class: A.cls(b.var)}, M.fmtVar(b.var, b.uvar))); }) : [h('span', {class: 'muted'}, 'sem cotação brasileira da mesma data')];
    return A.sec('Conexão do dia · exterior → Brasil', {right: h('button', {class: 'btn sm', onclick: function () { A.go('global'); }}, 'Mundo e Estratégia')}, h('div', {class: 'cx'},
      h('p', {class: 'cx-f'}, h('b', null, (f.detalhe ? M.NOME[cx.k] : f.nome || M.NOME[cx.k]) + ' ' + M.fmtVar(cx.var, cx.uvar)), ' para ' + M.fmtNivel(f) + ' (' + A.dataBR(f.data) + ' · ' + curta(f.fonte) + '). ' + (cx.ratio >= 1 ? 'Acima do limite de alerta.' : 'O maior movimento externo da rodada, ainda abaixo do limite de alerta.')),
      h('ol', {class: 'cx-m'}, (CONEX[cx.k] || []).map(function (x) { return h('li', null, x); })),
      sobe ? null : h('p', {class: 'muted', style: 'font-size:.86rem;margin:2px 0 8px'}, 'Hoje o movimento foi de queda: o canal funciona no sentido inverso.'),
      h('div', {class: 'cx-r'}, h('span', {class: 'k'}, 'Brasil no mesmo pregão'), reacao),
      h('p', {class: 'hint', style: 'margin:6px 0 0'}, 'Comparar a direção dos movimentos não prova causa: o mesmo dia tem outros fatos. Use como pista para investigar.'),
      h('div', {class: 'cx-r'}, h('span', {class: 'k'}, 'Peso exposto nas referências'),
        h('span', {class: 'muted', style: 'font-size:.84rem'}, 'Direto (' + ((MEC[cx.k] || {}).pil || (MEC[cx.k] || {}).tickers || []).join(', ') + '):'), ex.map(function (x) { return h('span', {class: 'cx-b'}, refRot(x.m.id) + ' ', h('b', null, A.pct(x.w, 0))); })),
      CANAL_BR[cx.k] ? h('div', {class: 'cx-r'}, h('span', {class: 'muted', style: 'font-size:.84rem'}, 'Pelo canal brasileiro (' + M.NOME[CANAL_BR[cx.k]] + ', ' + ((MEC[CANAL_BR[cx.k]] || {}).pil || (MEC[CANAL_BR[cx.k]] || {}).tickers || []).join(', ') + '):'), exposicao(CANAL_BR[cx.k], ids).map(function (x) { return h('span', {class: 'cx-b'}, refRot(x.m.id) + ' ', h('b', null, A.pct(x.w, 0))); })) : null));
  }

  /* ---------- exercício do dia (gestão de carteiras) ---------- */
  var LS_EX = 'oregon-exercicio';
  function bp(v) { return Math.round(Math.abs(v) * 100); }
  var EXE = {
    real: {q: function (f, v) { return 'O IPCA+ 2035 (NTN-B longa) ' + (v > 0 ? 'abriu' : 'fechou') + ' ' + bp(v) + ' pontos-base, para ' + M.fmtNivel(f) + '. O que isso significa para as carteiras Conservador e Arrojado, e quais ativos são mais sensíveis?'; },
      mec: ['Preço de título prefixado ou indexado ≈ −duration × variação da taxa. Quanto mais longo o título, maior a perda (ou o ganho) por ponto-base.', 'O juro real é a taxa de desconto real dos ativos de prazo longo: elétricas, concessões, saneamento e FIIs de tijolo perdem valor presente quando ele sobe.', 'Separar o juro real da inflação implícita: inflação implícita ≈ prefixado − IPCA+. Se o prefixado subiu menos que o IPCA+, o mercado reduziu a inflação esperada; se subiu mais, aumentou.'],
      cons: ['Duration é a alavanca: a exposição da carteira ao juro real é a soma de peso × duration das posições em IPCA+ (P4) e dos FIIs com contratos corrigidos pela inflação.', 'Num choque de juros, renda fixa longa e ações de prazo longo caem juntas: a diversificação entre classes falha justamente aí. É para isso que existem as bandas do P4 e o limite de duration.', 'Um dia não é tendência. Antes de pensar em mexer, compare com a variação de 1 e 12 meses do IPCA+ (gaveta do indicador) e com o nível histórico da taxa.'],
      pensar: ['A abertura veio de inflação, de fiscal ou do exterior (Treasuries no mesmo dia)?', 'Por que a Arrojado e a Conservador reagem diferente a esse choque?', 'Em que condição valeria aumentar duration em vez de reduzir?']},
    pre: {q: function (f, v) { return 'A taxa do Tesouro Prefixado 2032 ' + (v > 0 ? 'subiu' : 'caiu') + ' ' + bp(v) + ' pontos-base, para ' + M.fmtNivel(f) + '. O que isso faz com as carteiras Conservador e Arrojado, e quais empresas são mais sensíveis?'; },
      mec: ['Prefixados (P2) perdem preço quando a taxa sobe: ≈ −duration × variação.', 'A curva prefixada é a base do custo de capital no valuation: ações de crescimento, alavancadas ou de prazo longo (varejo, locação, utilities) sentem mais.', 'A inclinação (prefixado longo − Selic) mostra se o mercado espera mais juros à frente ou cobra prêmio por risco fiscal.'],
      cons: ['A Conservador concentra o risco de juros na renda fixa (P2 e P4); a Arrojado o espalha também nas ações sensíveis à curva. O mesmo choque chega por canais diferentes.', 'Ações sensíveis a juros e prefixados longos tendem a andar juntos no choque: somar as duas exposições, não olhar só a renda fixa.', 'Decidir sobre tendência, não sobre um dia: comparar com 1 e 12 meses e com a inclinação da curva.'],
      pensar: ['O movimento foi de nível (curva toda) ou de inclinação (só a ponta longa)?', 'Quanto da perda estimada vem da renda fixa e quanto das ações?', 'O que mudaria na sua leitura se o dólar tivesse subido junto?']},
    selic: {q: function (f, v) { return 'A meta Selic ' + (v > 0 ? 'subiu' : 'caiu') + ' ' + bp(v) + ' pontos-base, para ' + M.fmtNivel(f) + '. O que muda para o caixa, a renda fixa e as ações das carteiras de referência?'; },
      mec: ['A Selic fixa o CDI: muda na hora o rendimento do caixa e do pós-fixado (P1 e P3).', 'O efeito em prefixados e ações depende do que já estava no preço: a curva antecipa o Copom. O que move preço é a surpresa e a sinalização.', 'Juro mais baixo reduz o custo de capital e o custo da dívida das empresas; ajuda mais as alavancadas e as de prazo longo.'],
      cons: ['Compare a decisão com o Focus e com a curva da véspera para medir a surpresa.', 'Caixa e pós-fixado protegem no aperto; prefixados e ações de prazo longo ganham no afrouxamento: a mistura entre P1/P3 e P2/P4 é a decisão de duration da carteira.', 'Um corte esperado e já precificado não pede mudança; uma mudança de sinalização pode pedir.'],
      pensar: ['A decisão surpreendeu o Focus e a curva?', 'O comunicado mudou o ritmo esperado das próximas reuniões?', 'Qual pilar da Conservador mais muda de rendimento esperado?']},
    usd: {q: function (f, v) { return 'O dólar ' + (v > 0 ? 'subiu' : 'caiu') + ' ' + A.num(Math.abs(v), 2) + '% contra o real, para ' + M.fmtNivel(f) + '. O que isso significa para as carteiras de referência e quais empresas ganham ou perdem?'; },
      mec: ['Posições no exterior (P9 a P13) sobem em reais quando o dólar sobe: o câmbio é parte do retorno delas.', 'Exportadoras (petróleo, celulose, agro) faturam mais em reais; empresas com dívida em dólar sem proteção pagam mais.', 'Dólar mais alto encarece importados e pressiona a inflação; por esse caminho, chega aos juros.'],
      cons: ['O exterior funciona como proteção natural da carteira brasileira: em estresse no Brasil, o real costuma cair e o exterior compensa em parte.', 'Na parte brasileira, exportadoras também são proteção cambial, mas não pura: o preço delas depende da commodity e do próprio negócio.', 'Separar o dólar global do risco Brasil: se emergentes e o índice do dólar também se moveram, o movimento é global.'],
      pensar: ['O real andou sozinho ou junto com outras moedas emergentes?', 'Quanto da Arrojado ganha com o dólar em alta e quanto perde?', 'Faz sentido proteger o câmbio do exterior nessas carteiras? Com que custo?']},
    ibov: {q: function (f, v) { return 'O Ibovespa ' + (v > 0 ? 'subiu' : 'caiu') + ' ' + A.num(Math.abs(v), 2) + '%, para ' + M.fmtNivel(f) + '. Quanto disso chega às carteiras de referência, e o que foi mercado e o que foi empresa?'; },
      mec: ['O beta mede quanto um ativo anda com o índice: beta 1,5 anda, em média, 1,5 vez o Ibovespa.', 'Num dia de índice forte, o movimento comum explica a maior parte; o resto é da empresa (resultado, notícia).', 'FIIs têm beta baixo, mas não zero.'],
      cons: ['A Conservador tem pouca renda variável: o mesmo dia pesa muito menos nela.', 'Comparar a variação de cada ação com o beta × índice mostra o que foi idiossincrático: é ali que a tese pode ter mudado.', 'Concentração setorial amplia o efeito: ver quanto da parcela em ações está em poucos setores.'],
      pensar: ['Quais ações das carteiras andaram muito diferente do índice?', 'O movimento foi fluxo estrangeiro, juros ou um setor?', 'A carteira está tomando o risco de mercado que pretende tomar?']},
    brent: {q: function (f, v) { return 'O Brent ' + (v > 0 ? 'subiu' : 'caiu') + ' ' + A.num(Math.abs(v), 2) + '%, para ' + M.fmtNivel(f) + '. O que isso faz com Petrobras, PRIO, com a inflação e com as carteiras de referência?'; },
      mec: ['Petróleo é receita direta para Petrobras e PRIO; a PRIO, sem refino, é mais sensível ao preço do barril.', 'Pelos combustíveis, chega à inflação e às expectativas de juros (efeito de segunda ordem).', 'Como o Brasil exporta petróleo, preço maior melhora os termos de troca e costuma ajudar o real.'],
      cons: ['Petróleo nas carteiras é exposição concentrada em poucas ações: o peso de PETR4 e PRIO3 define o risco.', 'A política de preços da Petrobras pode amortecer o repasse: o efeito no lucro não é linear.', 'Separar choque de oferta (OPEP, guerra) de choque de demanda (China, EUA): o segundo costuma vir com queda de outras commodities e das bolsas.'],
      pensar: ['O choque é de oferta ou de demanda?', 'Quanto da carteira está exposto ao petróleo direta e indiretamente?', 'O movimento muda a tese de PETR4 ou PRIO3, ou só o preço?']},
    ust10: {q: function (f, v) { return 'A Treasury de 10 anos ' + (v > 0 ? 'subiu' : 'caiu') + ' ' + bp(v) + ' pontos-base, para ' + M.fmtNivel(f) + '. Como isso chega ao Brasil e às carteiras de referência?'; },
      mec: CONEX.ust10.slice(0, 3),
      cons: ['O exterior em renda fixa (P9 e P10) perde preço com a alta: a duration de cada ETF define o tamanho.', 'No Brasil, o canal é o prêmio: se a curva brasileira abriu junto, o choque foi importado.', 'Juro americano alto por muito tempo é o pano de fundo: muda o custo de oportunidade de todo ativo de risco.'],
      pensar: ['A curva brasileira acompanhou?', 'O dólar subiu junto contra outras moedas?', 'Qual carteira de referência tem mais renda fixa no exterior?']},
    sp: {q: function (f, v) { return 'O S&P 500 ' + (v > 0 ? 'subiu' : 'caiu') + ' ' + A.num(Math.abs(v), 2) + '%. O que isso significa para o exterior das carteiras e para a bolsa brasileira?'; },
      mec: CONEX.sp,
      cons: ['Ações no exterior somam o movimento da bolsa e o do câmbio.', 'Quando o S&P cai e o dólar sobe, o efeito em reais se compensa em parte: a correlação entre os dois importa.', 'Se a queda veio de juros (Treasuries), o canal chega também à renda fixa.'],
      pensar: ['Foi juros ou lucro?', 'O dólar compensou o movimento em reais?', 'O Ibovespa acompanhou?']}
  };
  function sensiveis(k, var_, P) {
    var vis = {}, lista = [];
    refIds().forEach(function (id) { (STORE.aprovadaVigente(C, id).pos || []).forEach(function (x) { if (x.w > 0) vis[x.t] = 1; }); });
    Object.keys(C.D.teses_pdf ? C.D.teses_pdf.teses : {}).forEach(function (t) { vis[t === 'BBDC4' ? 'BBDC3' : t] = 1; });
    var ch = {}; ch[k] = var_;
    Object.keys(vis).forEach(function (t) { var r = C.retAtivo(t, ch, P.sens); if (r.ok && Math.abs(r.total) > 1e-6) lista.push({t: t, r: r.total, org: P.origem[t]}); });
    lista.sort(function (a, b) { return Math.abs(b.r) - Math.abs(a.r); });
    return lista;
  }
  function exercicioSec(snap, c, ses) {
    var fx = snap ? M.fatoExercicio(snap, c.limites, ses) : null;
    if (!fx || !EXE[fx.k]) return A.sec('Exercício do dia', null, h('p', {class: 'empty'}, 'O exercício precisa de um fato real da sessão. Sem leitura atualizada do robô, não há exercício hoje.'));
    var E0 = EXE[fx.k], f = fx.f, P = A.prem(), ch = {}; ch[fx.k] = Math.round(fx.var * 10000) / 10000;
    var chave = (ses || f.data) + ':' + fx.k, salvo = {}; try { salvo = JSON.parse(localStorage.getItem(LS_EX) || '{}'); } catch (e) {}
    var nota = h('textarea', {class: 'inp w ex-nota', placeholder: 'Pense antes de abrir: escreva aqui a sua leitura (fica guardada só neste navegador).', 'aria-label': 'Sua resposta'});
    nota.value = salvo.chave === chave ? (salvo.txt || '') : '';
    var tg = null, grava = function () { try { localStorage.setItem(LS_EX, JSON.stringify({chave: chave, txt: nota.value})); } catch (e) {} };
    nota.addEventListener('input', function () { clearTimeout(tg); tg = setTimeout(grava, 400); });
    nota.addEventListener('change', grava);
    // resposta técnica com os números do dia
    var resp = h('div', {class: 'ex-r'});
    resp.appendChild(h('h4', null, '1. O fato'));
    resp.appendChild(h('p', null, (f.detalhe || f.nome || M.NOME[fx.k]) + ': ' + M.fmtNivel(f) + ' (' + M.fmtVar(fx.var, fx.uvar) + (fx.de ? ' contra ' + A.dataBR(fx.de) : '') + '). ' + curta(f.fonte) + ', ' + A.dataBR(f.data) + (f.hora ? ' ' + f.hora : '') + '. ' + (fx.ratio >= 1 ? 'Movimento acima do limite de alerta.' : 'Movimento abaixo do limite de alerta: ' + A.num(fx.ratio * 100, 0) + '% dele.')));
    if (fx.k === 'real' && snap.fatores.pre && snap.fatores.pre.ok && snap.fatores.pre.var != null && snap.fatores.pre.data === f.data && M.usavel(snap.fatores.pre)) {
      var di = snap.fatores.pre.var - fx.var;
      resp.appendChild(h('p', null, 'No mesmo dia, o prefixado 2032 andou ' + M.fmtVar(snap.fatores.pre.var, 'pp') + ' Variação da inflação implícita no dia (prefixado − IPCA+, prazos diferentes, aproximação): ' + A.snum(di * 100, 0) + ' pontos-base.'));
    }
    resp.appendChild(h('h4', null, '2. O mecanismo'));
    resp.appendChild(h('ul', null, E0.mec.map(function (x) { return h('li', null, x); })));
    resp.appendChild(h('h4', null, '3. Nas carteiras de referência'));
    var tb = h('table', {class: 't ex-t'}, h('thead', null, h('tr', null, h('th', null, 'Carteira'), h('th', {class: 'r'}, 'Peso exposto'), h('th', {class: 'r'}, 'Efeito pelo motor'), h('th', null, 'Situação'))));
    var tbody = h('tbody'); tb.appendChild(tbody);
    refIds().forEach(function (id) {
      var v = STORE.aprovadaVigente(C, id), ex = exposicao(fx.k, [id])[0], r = C.choqueCarteira(v, ch, P.sens), val = A.valida(v);
      tbody.appendChild(h('tr', null, h('td', null, refRot(id)), h('td', {class: 'r num'}, ex ? A.pct(ex.w, 1) : '—'), h('td', {class: 'r num ' + A.cls(r.total)}, A.spct(r.total, 2)),
        h('td', {style: 'font-size:.84rem'}, val.status === 'invalida' ? 'inválida: soma ' + A.pct(val.total, 1) + ', sem ajuste' : r.parcial ? 'parcial: ' + A.pct(r.cobertura.descoberto, 0) + ' sem cobertura' : 'válida')));
    });
    resp.appendChild(tb);
    resp.appendChild(h('p', {class: 'hint'}, 'Peso exposto: soma dos pesos aprovados nos pilares e ativos ligados ao fator (regra geral, não estimativa). Efeito pelo motor: o choque de hoje aplicado com as sensibilidades cadastradas, que são premissas a revisar, não medições. Posições sem sensibilidade ficam fora e não viram zero.'));
    var sv = sensiveis(fx.k, ch[fx.k], P);
    resp.appendChild(h('h4', null, '4. Mais sensíveis a esse choque'));
    resp.appendChild(sv.length ? h('div', {class: 'ex-sv'}, sv.slice(0, 6).map(function (x) { return h('span', null, A.tk(x.t), ' ', h('b', {class: A.cls(x.r)}, A.spct(x.r, 2)), x.org === 'gestor' ? h('small', {class: 'muted'}, ' gestor') : null); })) : h('p', {class: 'muted'}, 'Nenhum ativo das referências ou das teses tem sensibilidade cadastrada a este fator.'));
    if (fx.k === 'real' || fx.k === 'selic') {
      var sj = sensiveis('pre', ch[fx.k], P).filter(function (x) { return C.ATV[x.t] && C.ATV[x.t].classe === 'Ações'; });
      if (sj.length) resp.appendChild(h('p', {style: 'font-size:.9rem'}, h('span', {class: 'muted'}, 'O motor liga as ações à curva prefixada, não ao juro real. Se a curva prefixada andasse o mesmo tanto, as ações mais sensíveis seriam: '), sj.slice(0, 5).map(function (x, i) { return h('span', null, i ? ' · ' : '', x.t + ' ', h('b', {class: A.cls(x.r)}, A.spct(x.r, 2))); })));
    }
    resp.appendChild(h('h4', null, '5. Construção de carteira'));
    resp.appendChild(h('ul', null, E0.cons.map(function (x) { return h('li', null, x); })));
    resp.appendChild(h('h4', null, '6. Para levar à reunião'));
    resp.appendChild(h('ul', null, E0.pensar.map(function (x) { return h('li', null, x); })));
    return h('section', {class: 'sec ex', id: 'exercicio'},
      h('header', null, h('h2', null, 'Exercício do dia'), h('span', {class: 'chip'}, 'gestão de carteiras · 5 minutos')),
      h('div', {class: 'body'},
        h('p', {class: 'ex-q'}, E0.q(f, fx.var)),
        h('p', {class: 'muted', style: 'font-size:.86rem;margin:0 0 8px'}, 'Fato real da sessão: ' + curta(f.fonte) + ', ' + A.dataBR(f.data) + '. Pense primeiro; a explicação abaixo usa os números de hoje.'),
        nota,
        h('details', {class: 'ex-d'}, h('summary', null, 'Abrir a explicação técnica'), resp)));
  }

  /* ---------- alertas e decisões pendentes (compacto) ---------- */
  var PESO = {decidir: 0, investigar: 1, monitorar: 2, dados: 3};
  function eventos(snap, ses, c) {
    var out = [];
    if (snap) {
      var al = M.detectar(snap, c.limites, C);
      al.filter(function (a) { return a.tipo === 'ativo' && a.data === ses; }).forEach(function (a) {
        var pw = pesosDoAtivo(a.t); if (!pw.length) return;
        var cq = snap.ativos[a.t];
        out.push({tipo: a.suspeito ? 'dados' : 'investigar', ordem: -Math.abs(a.var) / a.limite, titulo: a.t + ' ' + M.fmtVar(a.var, '%') + (a.suspeito ? ' · variação anormal, conferir' : ''), tk: a.t,
          fato: (C.ATV[a.t] ? C.ATV[a.t].nome + ': ' : '') + (cq.moeda === 'USD' ? 'US$ ' : 'R$ ') + A.num(cq.preco, 2) + ' (limite ' + M.fmtVar(a.limite, '%').replace('+', '') + ').' + (a.suspeito ? ' Fora dos cálculos do dia até ser conferida.' : ''),
          afeta: listaPesos(pw, 3), src: [cq.fonte, A.dataBR(cq.data) + (cq.hora ? ' ' + cq.hora : '')].filter(Boolean).join(' · '), acts: [['Últimas atualizações', function () { A.abrirFicha(a.t); }]]});
      });
      var cob = snap.cobertura || {};
      if ((cob.lista_suspeitos || []).length) out.push({tipo: 'dados', ordem: 0, titulo: 'Conferir antes de usar: ' + cob.lista_suspeitos.join(', '), fato: 'Variação fora do normal para a classe do ativo. Fora dos cálculos do dia até serem conferidas.', src: 'robô · regra de anomalia por classe (config.json)'});
      if ((cob.lista_indisponiveis || []).length) out.push({tipo: 'dados', ordem: 1, titulo: cob.lista_indisponiveis.length + ' ativo(s) sem cotação', fato: cob.lista_indisponiveis.join(', ') + '. Nenhum valor foi preenchido no lugar.', src: 'robô', acts: [['Qualidade dos dados', function () { A.abrirQualidade(); }]]});
    }
    var inval = C.CARTS.filter(function (m) { return A.valida(STORE.aprovadaVigente(C, m.id)).status === 'invalida'; });
    if (inval.length) out.push({tipo: 'decidir', ordem: -inval.length, titulo: inval.length + ' de ' + C.CARTS.length + ' carteiras aprovadas não fecham 100%', fato: 'Pilares ou ativos passam do total' + (inval.some(function (m) { return refIds().indexOf(m.id) >= 0; }) ? ', inclusive em carteira de referência' : '') + '. Os pesos não são ajustados automaticamente.', src: 'motor de validação · versão aprovada vigente', acts: [['Ver o mapa', function () { A.go('cart', 'mapa'); }]]});
    return out.sort(function (a, b) { return (PESO[a.tipo] - PESO[b.tipo]) || (a.ordem - b.ordem); });
  }
  var ROT = {decidir: 'Decidir', investigar: 'Investigar', monitorar: 'Monitorar', dados: 'Dados'};
  function evNode(e) {
    var dl = h('dl', {class: 'why'});
    if (e.afeta) dl.append(h('dt', null, 'Peso'), h('dd', null, e.afeta));
    return h('div', {class: 'ev ' + e.tipo}, h('span', {class: 'bar'}),
      h('div', null, h('h4', null, A.chip(ROT[e.tipo], e.tipo === 'decidir' ? 'g-critica' : e.tipo === 'investigar' ? 'g-media' : ''), ' ', e.titulo),
        h('div', {class: 'fact'}, e.fato), dl.childNodes.length ? dl : null, e.src ? h('div', {class: 'src'}, e.src) : null,
        e.acts && e.acts.length ? h('div', {class: 'acts'}, e.acts.map(function (x) { return h('button', {class: 'btn sm', onclick: x[1]}, x[0]); })) : null));
  }
  function focusTab(snap) {
    var fo = snap && snap.indicadores && snap.indicadores.focus; if (!fo || !Object.keys(fo).length) return h('p', {class: 'muted', style: 'font-size:.9rem'}, 'Focus: sem leitura nesta rodada.');
    var ano = String(new Date().getFullYear()), prox = String(Number(ano) + 1), d0 = fo[Object.keys(fo)[0]];
    var f = function (x, u) { if (!x) return '—'; return h('span', null, A.num(x.mediana, 2) + u, x.var ? h('span', {class: 'muted', style: 'font-size:.8rem'}, ' (' + A.snum(x.var, 2) + ')') : null); };
    return h('div', null, A.table([{k: 'n', t: 'Mediana', s: false}, {k: 'a', t: ano, r: 1, s: false}, {k: 'b', t: prox, r: 1, s: false}],
      Object.keys(fo).map(function (k) { var it = fo[k], u = k === 'Câmbio' ? '' : '%'; return {n: k, a: f(it.anos[ano], u), b: f(it.anos[prox], u)}; }), {sort: null}),
      h('p', {class: 'hint', style: 'margin-top:6px'}, 'Relatório Focus de ' + A.dataBR(d0.data) + '; entre parênteses, a mudança contra ' + A.dataBR(d0.data_anterior) + '. Fonte: Banco Central.'));
  }

  function resumo(snap, ses) {
    if (!snap) return 'Ainda sem leitura do robô neste aparelho.';
    var F = snap.fatores, partes = [];
    [['ibov', 'Ibovespa'], ['usd', 'dólar'], ['pre', 'prefixado 2032'], ['real', 'IPCA+ 2035']].forEach(function (x) { var f = F[x[0]]; if (f && f.ok && M.usavel(f) && f.data === ses && f.var != null) partes.push(x[1] + ' ' + M.fmtVar(f.var, f.uvar)); });
    var sel = F.selic; if (sel && sel.ok) partes.push('Selic ' + A.num(sel.nivel, 2) + '%');
    return partes.length ? 'Sessão de ' + A.dataBR(ses) + ': ' + partes.join(', ') + '.' : 'Sem cotações atualizadas da sessão.';
  }
  // Situação da atualização: quando o robô publicou e quando deve publicar de novo. Nunca é tempo real.
  function atualizacao(snap) {
    var E = A.mercadoEstado || {};
    if (!snap) return null;
    var idade = M.idade(snap, Date.now()), txt = idade == null ? '' : idade < 90 ? 'há ' + Math.round(idade) + ' min' : idade < 2880 ? 'há ' + Math.round(idade / 60) + ' h' : 'há ' + Math.round(idade / 1440) + ' dias';
    return h('div', {class: 'upd'},
      h('span', null, h('i', {class: 'dot ' + ((snap.status && snap.status.nivel) || 'completo') + (idade != null && idade > 26 * 60 ? ' desatualizado' : ''), style: 'margin-right:6px'}), 'Dados do robô de ' + A.dataBR(snap.gerado_em).slice(0, 5) + ' ' + hm(snap.gerado_em) + (txt ? ' (' + txt + ')' : '') + '. Atualização periódica, a cada 30 minutos em dias úteis: não é cotação em tempo real.'),
      E.ultimo ? h('span', {class: 'muted'}, 'Verificado ' + hm(E.ultimo) + '.') : null,
      A.mercadoBloqueado && A.mercadoBloqueado() ? null : h('button', {class: 'btn link', disabled: E.carregando || null, onclick: function () { A.mercadoAtualizar(); }}, E.carregando ? 'verificando…' : 'Verificar agora'));
  }

  A.areas.hoje = function () {
    var E = A.mercadoEstado || {}, snap = E.snap, c = A.mercadoCfg ? A.mercadoCfg() : M.CFG_PADRAO, ses = M.sessao(snap), I = (snap && snap.indicadores) || {};
    var wrap = h('div', {class: 'brief'});
    var agora = new Date(), dia = agora.toLocaleDateString('pt-BR', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo'});
    wrap.appendChild(h('div', {class: 'desk-h'}, h('div', null,
      h('p', {class: 'kick'}, dia + (ses ? ' · sessão de referência ' + A.dataBR(ses) : '')),
      h('h1', null, 'Briefing'),
      h('p', {class: 'sum'}, resumo(snap, ses)), atualizacao(snap))));
    if (!snap) {
      wrap.appendChild(A.sec('Sem dados de mercado neste aparelho', null, h('div', null,
        h('p', null, E.carregando ? 'Buscando a última rodada do robô…' : (A.mercadoBloqueado && A.mercadoBloqueado() ? 'Nesta página do claude.ai o navegador não pode buscar dados na internet. Abra o site do painel (GitHub Pages) para ver o mercado.' : 'O robô publica os dados no site a cada 30 minutos em dias úteis. Se esta mensagem continuar, abra “Dados” no topo para ver o que falhou.')),
        h('div', {class: 'row'}, h('button', {class: 'btn', onclick: function () { A.mercadoAtualizar && A.mercadoAtualizar(); }}, 'Buscar agora'), h('button', {class: 'btn', onclick: function () { A.abrirQualidade(); }}, 'Qualidade dos dados')))));
    }
    // 1. números
    var go = function (k) { return function () { A.abrirFator && A.abrirFator(k); }; };
    wrap.appendChild(h('div', {class: 'strip'},
      tileFator(snap, 'ibov', 'Ibovespa', 'IBOV', {on: go('ibov')}),
      tileFator(snap, 'usd', 'Dólar', 'USDBRL', {on: go('usd')}),
      tileFator(snap, 'pre', 'Pré 2032 (DI longo)', 'DI', {on: go('pre')}),
      tileFator(snap, 'real', 'IPCA+ 2035 (NTN-B)', 'NTNB', {on: go('real')}),
      tileFator(snap, 'selic', 'Selic meta', 'SELIC', {on: go('selic')}),
      tileInd(I, 'ipca_12m', 'IPCA 12 meses'),
      tileSpread(snap),
      tileFator(snap, 'brent', 'Petróleo Brent', 'BRENT', {on: go('brent')})));
    wrap.appendChild(h('div', {class: 'strip n5 mini'},
      tileFator(snap, 'sp', 'S&P 500', null, {on: go('sp')}), tileFator(snap, 'ust10', 'Treasury 10 anos', null, {on: go('ust10')}), tileFator(snap, 'ust2', 'Treasury 2 anos', null, {on: go('ust2')}), tileFator(snap, 'em', 'Emergentes (EEM)', null, {on: go('em')}), tileFator(snap, 'btc', 'Bitcoin', null, {on: go('btc')})));
    // 2. notícias | o que mudou, referências, agenda
    var g = h('div', {class: 'grid2'}), L = h('div'), R = h('div'); g.append(L, R); wrap.appendChild(g);
    L.appendChild(noticiasSec());
    R.appendChild(mudouSec(snap, c));
    R.appendChild(refSec(snap, ses));
    R.appendChild(agendaSec(snap));
    // 3. empresas | conexão
    var g2 = h('div', {class: 'grid2'}), L2 = h('div'), R2 = h('div'); g2.append(L2, R2); wrap.appendChild(g2);
    L2.appendChild(empresasSec(snap, ses));
    R2.appendChild(conexaoSec(snap, c));
    // 4. exercício
    wrap.appendChild(exercicioSec(snap, c, ses));
    // 5. pendências, expectativas e qualidade, recolhidos
    var evs = eventos(snap, ses, c);
    wrap.appendChild(h('div', {class: 'grid2'},
      h('div', null, A.sec('Pendências e alertas', {hint: 'Ativos acima do limite de alerta, dados a conferir e carteiras aprovadas que não fecham.'}, evs.length ? h('div', null, evs.slice(0, 3).map(evNode), evs.length > 3 ? h('button', {class: 'btn link', onclick: function () { A.drawer('Pendências e alertas (' + evs.length + ')', h('div', null, evs.map(evNode))); }}, 'Ver todos (' + evs.length + ')') : null) : h('p', {class: 'empty'}, 'Nada pendente.'))),
      h('div', null, A.sec('Expectativas (Focus)', null, focusTab(snap)))));
    var ql = A.qualidadeLinha ? A.qualidadeLinha() : null; if (ql) wrap.appendChild(ql);
    return wrap;
  };

  A.MTD = A.MTD || {};
  A.MTD.hoje = function () {
    return h('div', null,
      h('p', null, h('b', null, 'De onde vêm os números. '), 'Do robô no GitHub (a cada 30 minutos em dias úteis) e, no navegador, direto do Banco Central e do câmbio. Não é cotação em tempo real. Cada número mostra data, hora, fonte e estado: ', h('i', {class: 'dot atualizado'}), ' atualizado, ', h('i', {class: 'dot desatualizado'}), ' desatualizado (último valor válido, marcado), ', h('i', {class: 'dot suspeito'}), ' variação anormal em conferência, ', h('i', {class: 'dot indisponivel'}), ' sem dado.'),
      h('p', null, h('b', null, 'Notícias do dia. '), 'Do arquivo do robô (Google Notícias por empresa e tema, RSS dos veículos, IBGE e CVM). Ficam as de média e alta relevância das últimas 48 horas (até 4 dias se faltar), no máximo duas por empresa ou tema, ordenadas por pontos da classificação, peso nas carteiras, fonte oficial, risco da tese e data. Nenhuma notícia de baixa relevância completa a lista.'),
      h('p', null, h('b', null, 'Carteiras na sessão. '), 'Contribuição em pontos percentuais: soma de peso × variação do dia só das posições com cotação atualizada. Não é o retorno da carteira enquanto a cobertura for menor que 100%. Abaixo de 50%, o número não é mostrado.'),
      h('p', null, h('b', null, 'Exercício. '), 'Usa o maior movimento real da sessão (relativo ao limite de alerta do fator). Os efeitos são do motor de cenários com as sensibilidades cadastradas, que são premissas, não medições.'));
  };
})(APP, CORE, MERCADO);
