/* ESTRATÉGIA GLOBAL — entender o mundo e ligar ao Brasil. Cada transmissão mostra o dado de hoje (com fonte e data),
   o mecanismo econômico em passos e o que nas carteiras está exposto. Onde falta dado aberto, a falta aparece. */
(function (A, C, M) {
  'use strict';
  var h = A.h, S = A.S;

  function E() { return A.mercadoEstado || {}; }
  function fator(k) { var s = E().snap; return s && s.fatores ? s.fatores[k] : null; }
  function serie(id) { var H = A.mercadoHist && A.mercadoHist(); return H && H.series ? H.series[id] : null; }
  function ultimo(id) { var s = serie(id); return s && s.pts.length ? {v: s.pts[s.pts.length - 1][1], d: s.pts[s.pts.length - 1][0], s: s} : null; }
  function var1m(id, pp) { var s = serie(id); if (!s) return null; var t = M.tendencia(s.pts, 30); return t ? (pp ? t.d : t.r) : null; }
  function nivelTxt(k) { var f = fator(k); return f && f.ok ? M.fmtNivel(f) : null; }
  function peso(pred) {
    return C.CARTS.map(function (m) { var v = STORE.aprovadaVigente(C, m.id); return {m: m, w: C.sum((v.pos || []).filter(function (x) { return x.w > 0 && pred(x); }), function (x) { return x.w; })}; })
      .filter(function (x) { return x.w > 0.0001; }).sort(function (a, b) { return b.w - a.w; });
  }
  function invalida(id) { var x = A.integCarteira ? A.integCarteira(id) : null; return x && (!x.okPil || !x.okAtv); }
  function expTxt(lista) { return lista.length ? h('span', null, lista.slice(0, 3).map(function (x, i) { return h('span', null, i ? ' · ' : '', x.m.rotulo + ' ', h('b', null, A.pct(x.w, 0)), invalida(x.m.id) ? h('span', {class: 'muted', title: 'Carteira aprovada que não fecha 100%: o peso aparece como está, sem ajuste.'}, ' (inválida)') : null); })) : h('span', {class: 'muted'}, 'nenhuma carteira aprovada exposta'); }
  function falta(txt) { return h('span', {class: 'na'}, 'falta: ' + txt); }
  function drv(rot, val, sub) { return h('div', {class: 'drv'}, h('b', null, rot), val != null ? h('span', {class: 'v'}, val) : falta('sem dado nesta rodada'), sub ? h('div', {class: 'muted', style: 'font-size:.8rem'}, sub) : null); }
  function meta(f) { return f && f.ok ? A.dataBR(f.data) + ' · ' + f.fonte : ''; }

  function transmissoes() {
    var rows = [], pre = fator('pre'), ust = fator('ust10'), u2 = fator('ust2');
    // 1. Treasuries → prêmio de risco Brasil
    var dif = pre && pre.ok && ust && ust.ok ? pre.nivel - ust.nivel : null;
    rows.push({d: drv('Treasury 10 anos', nivelTxt('ust10'), (var1m('UST10', true) != null ? '1 mês ' + A.snum(var1m('UST10', true), 2) + ' p.p. · ' : '') + meta(ust)),
      mec: ['O juro livre de risco global sobe.', 'Para o mesmo juro no Brasil, o diferencial cai e o carry do real fica menos atraente.', 'Capital sai ou exige mais prêmio: o dólar tende a subir e a curva brasileira (pré e IPCA+) tende a abrir.', 'Ativos de prazo longo e empresas alavancadas sentem pelo desconto maior.'],
      q: 'Como uma abertura das Treasuries altera o prêmio de risco brasileiro?', extra: dif != null ? 'Diferencial hoje: prefixado 2032 − Treasury 10 anos = ' + A.num(dif, 2) + ' p.p. (cálculo com as duas taxas da rodada; não é o prêmio de risco puro, que exigiria CDS ou NTN-B contra TIPS).' : null,
      exp: peso(function (x) { return x.p === 'P2' || x.p === 'P4' || ['VAMO3', 'ALOS3', 'EQTL3', 'TTEN3', 'INBR34'].indexOf(x.t) >= 0; }), expRot: 'P2, P4 e ações sensíveis a juros'});
    // 2. China → commodities → empresas
    var mi = ultimo('MINERIO'), br = fator('brent');
    rows.push({d: h('div', null, drv('Brent', nivelTxt('brent'), (var1m('BRENT') != null ? '1 mês ' + A.spct(var1m('BRENT'), 1) + ' · ' : '') + meta(br)), h('div', {style: 'margin-top:6px'}, drv('Minério de ferro', mi ? 'US$ ' + A.num(mi.v, 0) : null, mi ? 'média de ' + mi.d.slice(5, 7) + '/' + mi.d.slice(0, 4) + ' · FMI via FRED' : 'série mensal do FMI via FRED (precisa da chave gratuita FRED_API_KEY)'))),
      mec: ['A China é a maior compradora de minério, de celulose de fibra curta e uma das maiores de petróleo.', 'Crescimento chinês mais fraco reduz a demanda e o preço dessas commodities.', 'Exportadoras brasileiras recebem menos em dólar; o efeito em reais depende do câmbio.'],
      q: 'Como a China afeta minério, celulose, petróleo e empresas brasileiras?', extra: 'Celulose: sem série aberta de preço no robô; acompanhar pelos releases da Klabin e pelos preços anunciados pelos produtores.',
      exp: peso(function (x) { return ['PETR4', 'PRIO3', 'KLBN4'].indexOf(x.t) >= 0; }), expRot: 'PETR4, PRIO3, KLBN4 (não há mineradora nas carteiras)'});
    // 3. Dólar global → exportadoras e endividadas
    var dx = ultimo('DXY');
    rows.push({d: h('div', null, drv('Dólar contra o real', nivelTxt('usd'), meta(fator('usd'))), h('div', {style: 'margin-top:6px'}, drv('Dólar global (índice amplo do Fed)', dx ? A.num(dx.v, 1) : null, dx ? A.dataBR(dx.d) + ' · Fed via FRED' + (var1m('DXY') != null ? ' · 1 mês ' + A.spct(var1m('DXY'), 1) : '') : 'precisa da chave gratuita FRED_API_KEY'))),
      mec: ['Dólar forte no mundo costuma vir com aperto financeiro global.', 'Em reais, exportadoras faturam mais; empresas com dívida em dólar sem hedge pagam mais.', 'Posições no exterior das carteiras sobem em reais: o câmbio é parte do retorno delas.'],
      q: 'Como o dólar global afeta exportadoras e companhias endividadas?', extra: 'Endividamento em dólar por empresa: sem fonte aberta no robô; vem dos releases (nota de dívida).',
      exp: peso(function (x) { return /^P(9|10|11|12|13)$/.test(x.p) || ['PETR4', 'PRIO3', 'KLBN4'].indexOf(x.t) >= 0; }), expRot: 'exterior (P9 a P13) e exportadoras'});
    // 4. Renda fixa americana × ações
    var tips = ultimo('TIPS10'), sp = fator('sp');
    rows.push({d: h('div', null, drv('Juro real dos EUA (TIPS 10 anos)', tips ? A.num(tips.v, 2) + '%' : null, tips ? A.dataBR(tips.d) + ' · Fed via FRED' : 'precisa da chave gratuita FRED_API_KEY'), h('div', {style: 'margin-top:6px'}, drv('S&P 500', nivelTxt('sp'), meta(sp)))),
      mec: ['O título americano indexado paga juro real garantido pelo Tesouro dos EUA.', 'Quanto maior esse juro, mais a bolsa precisa render acima da inflação para compensar o risco.', 'A comparação justa é o juro real contra o retorno esperado das ações (lucro sobre preço ajustado pelo crescimento).'],
      q: 'Quando a renda fixa americana tem melhor assimetria do que as ações?', extra: 'O lucro esperado do S&P 500 não tem fonte aberta no robô: a pergunta fica com o dado de juros e sem o veredito.',
      exp: peso(function (x) { return x.p === 'P9' || x.p === 'P10' || x.p === 'P11'; }), expRot: 'P9, P10 (renda fixa) e P11 (ações desenvolvidas)'});
    // 5. Fed → dólar → Brasil
    rows.push({d: drv('Treasury 2 anos', nivelTxt('ust2'), meta(u2)),
      mec: ['O título de 2 anos acompanha o que o mercado espera dos juros do Fed.', 'Fed mais duro sustenta o dólar e drena liquidez dos emergentes.', 'No Brasil, isso aperta o espaço para cortes da Selic.'],
      q: 'O que o mercado espera do Fed?', extra: 'Probabilidades de decisão do Fed (FedWatch, da CME) não têm acesso aberto: fora do robô.',
      exp: peso(function (x) { return x.p === 'P1' || x.p === 'P3'; }), expRot: 'P1 e P3 (CDI), pela Selic'});
    return rows;
  }

  function linhaTx(r) {
    return h('div', {class: 'tx'}, r.d,
      h('div', {class: 'mec'}, h('div', {class: 'k'}, r.q), h('ol', null, r.mec.map(function (x) { return h('li', null, x); })), r.extra ? h('p', {class: 'muted', style: 'font-size:.86rem;margin:6px 0 0'}, r.extra) : null),
      h('div', {class: 'exp'}, h('div', {class: 'k'}, 'Exposto nas carteiras'), h('div', {class: 'muted', style: 'font-size:.8rem'}, r.expRot), expTxt(r.exp)));
  }

  function exterior() {
    var rows = C.CARTS.map(function (m) { var v = STORE.aprovadaVigente(C, m.id), pp = C.pesosPorPilar((v.pos || []).filter(function (x) { return x.w > 0; })), o = {}; ['P9', 'P10', 'P11', 'P12', 'P13'].forEach(function (p) { if (pp[p]) o[p] = pp[p]; }); return {m: m, o: o, t: C.sum(Object.keys(o).map(function (p) { return o[p]; }))}; }).filter(function (x) { return x.t > 0; });
    if (!rows.length) return h('p', {class: 'empty'}, 'Nenhuma carteira com exterior.');
    return h('div', {class: 'cbars'}, rows.map(function (x) {
      return h('div', {class: 'cbar', style: 'grid-template-columns:minmax(150px,1fr) minmax(120px,2.2fr) 54px', onclick: function () { S.cart = x.m.id; S.ver = 'aprovada'; A.go('cart', 'carteira'); }},
        h('span', null, x.m.rotulo), h('span', {class: 'tr', style: 'display:flex;overflow:hidden'}, Object.keys(x.o).map(function (p) { return h('i', {style: 'position:static;display:block;height:100%;width:' + (x.o[p] * 100) + '%;background:' + A.corPilar(p), title: p + ' ' + C.PIL[p].nome + ' ' + A.pct(x.o[p], 1)}); })),
        h('span', {class: 'n'}, A.pct(x.t, 0)));
    }));
  }

  function juros() {
    var ds = [['DI', 'Prefixado 2032 (Brasil)', '#1D8C0F'], ['NTNB', 'IPCA+ 2035 (Brasil, real)', '#73C35A'], ['UST10', 'Treasury 10 anos', '#0B9AB8'], ['TIPS10', 'TIPS 10 anos (EUA, real)', '#6DD3E8']].map(function (x) { var s = serie(x[0]); return s ? {name: x[1], pts: s.pts, color: x[2]} : null; }).filter(Boolean);
    if (!ds.length) return h('p', {class: 'empty'}, 'As séries de juros chegam com o histórico do robô (uma vez por dia, à noite).');
    return h('div', null, A.lines(ds, {fmt: function (v) { return A.num(v, 1) + '%'; }, h: 230}), h('p', {class: 'hint'}, 'Taxas de compra do Tesouro Direto (Tesouro Transparente) e do Tesouro dos EUA; TIPS pelo Fed (FRED). A distância entre as linhas brasileiras e americanas é o diferencial de juros nominal e real.'));
  }

  A.areas.global = function () {
    var wrap = h('div'), snap = E().snap;
    wrap.appendChild(A.pageHead('Estratégia global', 'Entender o mundo, pensar no Brasil', 'Juros globais, dólar, China e commodities, crédito e política monetária, sempre com a pergunta: o que isso faz com as carteiras brasileiras? Os mecanismos são regras econômicas gerais, não previsões.'));
    var go = function (k) { return function () { A.abrirFator && A.abrirFator(k); }; };
    var tileF = function (k, rot) { var f = fator(k), st = M.estado(f); return h('div', {class: 'tile' + (f && f.ok ? '' : ' na'), 'data-click': '1', onclick: go(k)}, h('span', {class: 'lbl'}, h('i', {class: 'dot ' + st}), rot), h('span', {class: 'v'}, f && f.ok ? M.fmtNivel(f).replace(/ pts$/, '') : 'sem dado'), h('span', {class: 'd ' + (st === 'atualizado' ? A.cls(f.var) : 'muted')}, f && f.ok && f.var != null ? M.fmtVar(f.var, f.uvar) : ' '), h('span', {class: 'meta'}, f && f.ok ? A.dataBR(f.data) + ' · ' + f.fonte : (f && f.motivo) || '')); };
    var tileS = function (id, rot, fmt, fonte) { var u = ultimo(id), t = var1m(id, /TIPS|BUND/.test(id)), st = !u ? 'indisponivel' : (u.s.desatualizada ? 'desatualizado' : u.s.qualidade === 'suspeita' ? 'suspeito' : 'atualizado'); return h('div', {class: 'tile' + (u ? '' : ' na'), title: u && u.s.motivo ? u.s.motivo : null}, h('span', {class: 'lbl'}, h('i', {class: 'dot ' + st, title: MERCADO.ESTADO_TXT[st]}), rot), h('span', {class: 'v'}, u ? fmt(u.v) : 'sem dado'), h('span', {class: 'd muted'}, t != null ? '1 mês ' + (/TIPS|BUND/.test(id) ? A.snum(t, 2) + ' p.p.' : A.spct(t, 1)) : ' '), h('span', {class: 'meta'}, u ? A.dataBR(u.d) + ' · ' + fonte : 'precisa da chave gratuita do FRED')); };
    var u2 = fator('ust2'), u10 = fator('ust10'), incl = u2 && u2.ok && u10 && u10.ok ? u10.nivel - u2.nivel : null;
    wrap.appendChild(h('div', {class: 'strip n11'},
      tileF('sp', 'S&P 500'), tileF('ust10', 'Treasury 10 anos'), tileF('ust2', 'Treasury 2 anos'),
      h('div', {class: 'tile' + (incl == null ? ' na' : '')}, h('span', {class: 'lbl'}, h('i', {class: 'dot ' + (incl == null ? 'indisponivel' : 'atualizado')}), 'Curva dos EUA: 10a − 2a'), h('span', {class: 'v'}, incl == null ? 'sem dado' : A.snum(incl, 2), incl == null ? null : h('small', null, 'p.p.')), h('span', {class: 'd muted'}, incl == null ? ' ' : incl < 0 ? 'invertida' : 'positiva'), h('span', {class: 'meta'}, incl == null ? '' : 'cálculo · Tesouro dos EUA')),
      tileS('TIPS10', 'Juro real EUA (TIPS 10a)', function (v) { return A.num(v, 2) + '%'; }, 'Fed via FRED'),
      tileS('DXY', 'Dólar global (Fed)', function (v) { return A.num(v, 1); }, 'Fed via FRED'),
      tileF('em', 'Emergentes (EEM)'), tileF('brent', 'Brent'), tileS('MINERIO', 'Minério de ferro', function (v) { return 'US$ ' + A.num(v, 0); }, 'FMI via FRED'),
      tileS('BUND10', 'Alemanha 10 anos', function (v) { return A.num(v, 2) + '%'; }, 'OCDE via FRED'), tileF('btc', 'Bitcoin'),
      h('div', {class: 'tile'}, h('span', {class: 'lbl'}, 'Sem fonte aberta'), h('span', {class: 'meta', style: 'white-space:normal;line-height:1.35'}, 'China (PMI, crédito), CDS Brasil, spreads de crédito ICE e S&P: licença ou acesso pago. Ver docs/FONTES.md.'))));
    wrap.appendChild(A.sec('Do mundo para o Brasil', {mtd: 'global', hint: 'Cinco transmissões que mais pesam nas carteiras. À esquerda, o dado de hoje; no meio, o mecanismo em passos; à direita, quanto de cada carteira está no caminho (peso aprovado, não sensibilidade estimada).'}, h('div', null, transmissoes().map(linhaTx))));
    var g = h('div', {class: 'grid2'}), L = h('div'), R = h('div'); g.append(L, R); wrap.appendChild(g);
    L.appendChild(A.sec('Juros: Brasil e EUA', null, juros()));
    R.appendChild(A.sec('Quanto de cada carteira está fora do Brasil', {hint: 'Pilares 9 a 13 na versão aprovada, por cor de pilar. O câmbio entra por inteiro nessa parcela.'}, exterior()));
    if (!snap) wrap.insertBefore(h('div', {class: 'alert warn'}, 'Sem leitura do robô neste aparelho: os dados de hoje aparecem quando o site buscar a última rodada.'), wrap.children[1]);
    return wrap;
  };
  A.MTD = A.MTD || {};
  A.MTD.global = function () {
    return h('div', null, h('p', null, 'Os mecanismos descrevem canais econômicos conhecidos (diferencial de juros, termos de troca, dólar global, juro real), não estimativas nem previsões. O tamanho do efeito em cada ativo, quando existe, está nas premissas de sensibilidade (Research Brasil → Macro → empresas).'),
      h('p', null, 'Exposição = soma dos pesos da versão aprovada nos pilares e ativos ligados ao canal.'),
      h('p', null, 'Fontes: Tesouro Transparente, Tesouro dos EUA, Banco Central, Yahoo Finance e FRED (Fed, FMI, OCDE). Séries do FRED com direitos reservados (S&P 500, ICE BofA, Cboe) ficam de fora porque o site é público.'));
  };
})(APP, CORE, MERCADO);
