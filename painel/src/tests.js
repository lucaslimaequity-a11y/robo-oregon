/* TESTES — rodam no Node (app/test/run.js) e no navegador (Research → Histórico e auditoria → Rodar testes).
   Fixtures sintéticas existem só aqui dentro, para testar fórmulas; nunca aparecem como dado do painel. */
var TESTS = (function () {
  'use strict';
  function run(C, Q, DATA, APP) {
    var out = [];
    function t(nome, fn) { try { var r = fn(); out.push({nome: nome, ok: r !== false, det: typeof r === 'string' ? r : ''}); } catch (e) { out.push({nome: nome, ok: false, det: String(e && e.message || e)}); } }
    function eq(a, b, tol, msg) { if (Math.abs(a - b) > (tol == null ? 1e-9 : tol)) throw new Error((msg || '') + ' esperado ' + b + ', obtido ' + a); }
    function ok(c, msg) { if (!c) throw new Error(msg || 'condição falsa'); }
    C.init(DATA);
    var snap = JSON.stringify(DATA.aprovada.pos);
    var all = C.validateAll({});

    t('1. Nenhuma carteira inválida passa despercebida (10 de 15 com pesos que não fecham)', function () {
      var inv = Object.keys(all).filter(function (k) { return all[k].status === 'invalida'; }).sort();
      var esp = ['alt-sup', 'cresc-arr', 'cresc-def', 'cresc-mod', 'intl-arr', 'intl-cons', 'intl-mod', 'renda-arr', 'renda-def', 'renda-mod'];
      ok(JSON.stringify(inv) === JSON.stringify(esp), 'inválidas: ' + inv.join(','));
      ok(all['cresc-mod'].issues.some(function (i) { return i.regra === 'R1' && /P2 somam 160%/.test(i.titulo); }), 'P2 160% não detectado');
      ok(all['intl-mod'].issues.some(function (i) { return i.regra === 'R2' && /115/.test(i.titulo); }), 'pilares 115% não detectado');
      ok(all['alt-sup'].issues.some(function (i) { return /170/.test(i.titulo); }), '170% não detectado');
      ok(all['renda-def'].issues.some(function (i) { return i.regra === 'R9'; }), 'Renda Defensivo × composição não detectado');
      ok(all['cresc-mod'].issues.some(function (i) { return i.regra === 'R5' && /INBR32/.test(i.titulo); }), 'INBR32 não detectado');
      return 'inválidas: ' + inv.length;
    });
    t('Caso: carteira com ativos somando 106% não vira 100%', function () {
      var v = {cart: 'x', rotulo: 'teste', pos: [{t: 'ITSA4', p: 'P5', w: 0.56}, {t: 'LFTB11', p: 'P1', w: 0.5}]};
      var r = C.validate(v, {}); ok(r.status === 'invalida', 'status ' + r.status); eq(r.total, 1.06, 1e-12);
      var s = C.choqueCarteira(v, {ibov: -10}); eq(s.total, 0.56 * 0.8 * -0.10, 1e-12, 'sem normalizar');
    });
    t('2. Placeholder não entra em análise oficial (fundos de teste)', function () {
      ok(!C.retAtivo('Franchini FIDC1', {selic: 5}).ok, 'placeholder com retorno');
      var v = C.aprovadaOriginal('cresc-cons'), s = C.choqueCarteira(v, {selic: 1, pre: 1, real: 1});
      eq(C.sum(s.descobertos, function (x) { return x.w; }), 0.5, 1e-9, 'descoberto');
      ok(!s.itens.some(function (x) { return /Franchini/.test(x.t); }), 'Franchini nos itens');
      var ex = C.exposicoes(v); ok(ex.nTickers === 7, 'nTickers ' + ex.nTickers);
      ok(s.parcial && s.cobertura.placeholder > 0.49, 'não marcou como parcial');
    });
    t('Caso: fundo de teste não gera falsa estabilidade (não é risco zero nem caixa)', function () {
      var v = C.aprovadaOriginal('cresc-cons'), cob = C.cobertura(v);
      eq(cob.coberto, 0.5, 1e-9); eq(cob.placeholder, 0.5, 1e-9);
      ok(!C.retAtivo('CYPRESS', {usd: 10}).ok, 'fundo privado tratado como risco zero/cambial');
      ok(!C.retAtivo('LFIN11', {spread: 1}).ok, 'crédito sem sensibilidade tratado como risco zero');
    });
    t('3. Normalização não oculta erro de peso', function () {
      var v = C.aprovadaOriginal('cresc-mod'), ch = {ibov: -10, pre: 1, usd: 5};
      var s = C.choqueCarteira(v, ch), man = 0;
      v.pos.forEach(function (x) { var r = C.retAtivo(x.t, ch); if (r.ok && x.w > 0) man += x.w * r.total; });
      eq(s.total, man, 1e-12, 'total ≠ Σ w·r'); ok(s.status === 'invalida' && /106/.test(s.aviso), 'aviso ausente');
    });
    t('4. Contribuições reconciliam com o total', function () {
      var v = C.aprovadaOriginal('intl-mod'), s = C.choqueCarteira(v, {sp: -12, em: -8, usd: 7, ust10: 0.5, spread: 1});
      eq(C.sum(s.itens, function (x) { return x.ctb; }), s.total, 1e-12, 'itens');
      eq(C.sum(Object.keys(s.porFator), function (k) { return s.porFator[k]; }), s.total, 1e-12, 'fatores');
      eq(C.sum(Object.keys(s.porPilar), function (k) { return s.porPilar[k]; }), s.total, 1e-12, 'pilares');
    });
    t('Caso: posição de 3% que cai 40% contribui −1,2 p.p.', function () {
      var s = C.choqueCarteira({pos: [{t: 'VAMO3', p: 'P6', w: 0.03}]}, {}, null, {VAMO3: -40});
      eq(s.total, -0.012, 1e-12); eq(Q.contrib([0.03], [-0.4]).total, -0.012, 1e-12);
    });
    t('5. Contribuição ao risco é consistente (Σ = σ e derivada numérica)', function () {
      var S = [[0.04, 0.006, 0.002], [0.006, 0.09, 0.01], [0.002, 0.01, 0.0225]], w = [0.5, 0.2, 0.3], rc = Q.riskContrib(w, S);
      eq(C.sum(rc.ctr), rc.sigma, 1e-12); eq(C.sum(rc.pct), 1, 1e-12);
      for (var i = 0; i < 3; i++) { var w2 = w.slice(); w2[i] += 1e-6; eq((Q.portVol(w2, S) - rc.sigma) / 1e-6, rc.mrc[i], 1e-5, 'mrc ' + i); }
    });
    t('6. Covariância usa retornos alinhados nas mesmas datas', function () {
      var a = [['2026-01-02', 100], ['2026-01-05', 101], ['2026-01-06', 103], ['2026-01-07', 102], ['2026-01-08', 104]];
      var b = [['2026-01-02', 50], ['2026-01-05', 50.5], ['2026-01-07', 51], ['2026-01-08', 50.8]];
      var al = Q.alignPrices({A: a, B: b}, ['A', 'B'], {freq: 'D'});
      ok(al.ok && al.dates.join() === '2026-01-02,2026-01-05,2026-01-07,2026-01-08', 'datas ' + (al.dates || []).join());
      var R = Q.toReturns(al.P); eq(R[1][0], 102 / 101 - 1, 1e-12, 'retorno de A no salto');
      var S = Q.cov(R); eq(S[0][1], S[1][0], 1e-15);
    });
    t('7. Correlação sem histórico suficiente não é inventada', function () {
      var ra = [], rb = []; for (var i = 0; i < 10; i++) { var d = '2026-0' + (1 + Math.floor(i / 5)) + '-1' + (i % 5); ra.push([d, Math.sin(i)]); rb.push([d, Math.cos(i)]); }
      var pc = Q.pairwiseCorr({A: ra, B: rb}, ['A', 'B'], {minObs: 20}); ok(pc.C[0][1] === null, 'correlação com 10 observações');
      ok(Q.pearson([1, 2], [2, 1]) === null, 'pearson com n=2');
    });
    t('8. Conversão BRL/USD multiplicativa (−10% em dólar, dólar +10% ≈ −1%)', function () {
      var r = C.retAtivo('VHVE', {sp: -10, usd: 10}); eq(r.local, -0.10, 1e-12); eq(r.total, -0.01, 1e-12); eq(r.cross, -0.01, 1e-12);
      eq(Q.toBRL([-0.1], [0.1])[0], -0.01, 1e-12);
    });
    t('9. Duration linear; convexidade só quando cadastrada', function () {
      eq(C.retAtivo('IMAB11', {real: 1}).total, -0.06, 1e-12, 'linear');
      var sens = JSON.parse(JSON.stringify(DATA.sens)); sens.IMAB11.conv = 60;
      eq(C.retAtivo('IMAB11', {real: 1}, sens).total, -0.06 + 0.5 * 60 * 0.0001, 1e-12, 'com convexidade');
      ok(DATA.sens.IMAB11.conv === null, 'convexidade padrão deveria ser nula');
      eq(C.horizonteRF('IMAB11', {real: 1}, 3).relativoH, 0.01 * (3 - 6), 1e-12, 'horizonte');
    });
    t('10. Propostas não sobrescrevem a carteira aprovada', function () {
      var v = C.aprovadaOriginal('cresc-mod');
      var r = C.aplicarMovimento(v.pos, {t: 'ITSA4', para: 0.05, fonte: 'reduzir', de: 'LFTB11'});
      ok(r.ok, r.motivo); ok(JSON.stringify(DATA.aprovada.pos) === snap, 'dado original alterado');
      eq(C.sum(r.pos, function (x) { return x.w; }), C.sum(v.pos, function (x) { return x.w; }), 1e-12, 'soma mudou');
      var ap = C.aplicarMovimento([{t: 'A', p: 'P5', w: 0.02}, {t: 'B', p: 'P1', w: 0.98}], {t: 'A', para: 0.03, fonte: 'aporte'});
      eq(C.sum(ap.pos, function (x) { return x.w; }), 1, 1e-12, 'aporte não fecha'); eq(ap.pos[0].w, 0.03, 1e-12);
      var pr = C.aplicarMovimento(v.pos, {t: 'PETR4', para: 0.04, fonte: 'prorata', pilar: 'P5'}); ok(pr.ok, pr.motivo);
    });
    t('11. Probabilidades de cenários válidas', function () {
      ok(C.validaProbs([{p: 0.6, r: 0}, {p: 0.25, r: 0}, {p: 0.15, r: 0}]).ok, 'soma 1 rejeitada');
      ok(!C.validaProbs([{p: 0.6, r: 0}, {p: 0.3, r: 0}]).ok, 'soma 0,9 aceita');
      ok(!C.validaProbs([{p: 1.2, r: 0}, {p: -0.2, r: 0}]).ok, 'fora de [0,1] aceita');
      var s = C.sizing({w: 0.03, cenarios: [{p: 0.25, r: 0.4}, {p: 0.5, r: 0.1}, {p: 0.25, r: -0.4}], perdaMax: 0.01});
      eq(s.er, 0.05, 1e-12); eq(s.perdaPior, -0.012, 1e-12); eq(s.wMaxPorPerda, 0.025, 1e-12);
    });
    t('12. Ativos sem dados são identificados', function () {
      var r = all['cresc-mod'];
      ok(r.issues.some(function (i) { return i.regra === 'R10' && /sem série/.test(i.titulo); }), 'sem aviso de série');
      ok(all['alt-cons'].issues.some(function (i) { return i.regra === 'R10' && /CYPRESS/.test(i.titulo); }), 'CYPRESS sem sensibilidade não avisado');
      ok(r.issues.some(function (i) { return /Liquidez/.test(i.titulo); }), 'liquidez não avisada');
    });
    t('16. Premissas e fontes identificáveis', function () {
      Object.keys(DATA.ativos).forEach(function (k) { var a = DATA.ativos[k]; if (a.cotacao != null) ok(a.fonte_preco, 'cotação sem fonte: ' + k); if (a.ret_12m != null) ok(a.fonte_ret, 'retorno sem fonte: ' + k); });
      Object.keys(DATA.niveis).forEach(function (k) { ok(DATA.niveis[k].fonte && DATA.niveis[k].data, 'nível sem fonte: ' + k); });
    });
    t('20. Decisão gerada por IA exige aprovação humana', function () {
      if (typeof STORE === 'undefined') return 'STORE indisponível neste ambiente';
      var p = {cart: 'cresc-cons', nome: 'x', pos: C.aprovadaOriginal('cresc-cons').pos, origem: 'ia'};
      ok(STORE.checarAprovacao(C, p, {responsavel: 'A', data: '2026-11-07'}) !== null, 'aprovou sem confirmação humana');
      ok(STORE.checarAprovacao(C, p, {data: '2026-11-07', confirmaHumano: true}) !== null, 'aprovou sem responsável');
      ok(STORE.checarAprovacao(C, p, {responsavel: 'A', data: '2026-11-07', confirmaHumano: true}) === null, 'bloqueou aprovação válida');
      ok(STORE.checarAprovacao(C, {cart: 'cresc-mod', nome: 'y', pos: C.aprovadaOriginal('cresc-mod').pos}, {responsavel: 'A', data: '2026-11-07', confirmaHumano: true}) !== null, 'aprovou proposta que soma 106%');
    });
    t('Importação: números e datas brasileiros, linhas inválidas rejeitadas', function () {
      eq(C.parseNum('1.234,56'), 1234.56, 1e-12); eq(C.parseNum('12,5%'), 12.5, 1e-12); ok(isNaN(C.parseNum('abc')));
      ok(C.parseDate('31/10/2026') === '2026-10-31' && C.parseDate('2026-10-31') === '2026-10-31' && C.parseDate(46326) === '2026-10-31');
      var rows = C.parseCSV('data;ITSA4;VWRA\n31/10/2026;12,40;150\n01/11/2026;x;151\n02/11/2026;12,5;');
      var p = C.parsePriceTable(rows); ok(p.series.ITSA4.length === 2 && p.series.VWRA.length === 2, 'séries');
      ok(p.rejeitadas.length === 1, 'rejeitadas ' + p.rejeitadas.length);
      var l = C.parsePriceTable(C.parseCSV('data,ticker,preco\n2026-10-31,INBR32,20')); ok(l.series.INBR34 && l.formato === 'longo', 'alias no longo');
    });
    t('Atribuição: Brinson-Fachler concilia com Rp − Rb', function () {
      var b = Q.brinson({wp: {P1: 0.3, P5: 0.7}, wb: {P1: 0.5, P5: 0.5}, rp: {P1: 0.01, P5: 0.08}, rb: {P1: 0.01, P5: 0.05}});
      eq(b.totals.alloc + b.totals.select + b.totals.inter, b.Rp - b.Rb, 1e-12); eq(b.residual, 0, 1e-12);
    });
    t('Otimização respeita limites e reporta restrições ativas', function () {
      var r = Q.optimize({S: [[0.04, 0], [0, 0.01]], lb: [0, 0], ub: [1, 0.6], total: 1, objective: 'minvar'});
      eq(r.w[1], 0.6, 1e-6); ok(r.active.upper.indexOf(1) >= 0, 'limite não reportado');
    });
    t('Revisão independente: correções verificadas', function () {
      // horizonte da RF usa a mesma perna de preço do motor (inclui spread)
      var ch = {ust10: -1, spread: 3}, hz = C.horizonteRF('IHYA', ch, 1), ra = C.retAtivo('IHYA', ch);
      eq(hz.preco, ra.local, 1e-12, 'horizonte × motor'); ok(hz.preco < 0, 'spread ignorado no horizonte');
      // status do choque respeita as premissas do gestor
      var sens = JSON.parse(JSON.stringify(DATA.sens)); sens.ITSA4 = {m: 'nd'};
      var sc = C.choqueCarteira({cart: 'x', pos: [{t: 'ITSA4', p: 'P5', w: 0.5}, {t: 'LFTB11', p: 'P1', w: 0.5}]}, {ibov: -10}, sens);
      ok(sc.status === 'parcial' && sc.parcial, 'status ignorou a premissa: ' + sc.status);
      // milhar brasileiro
      eq(C.parseNum('130.000', true), 130000, 0); eq(C.parseNum('129.999,50', true), 129999.5, 1e-9);
      var pr = C.parsePriceTable(C.parseCSV('data;IBOV\n30/09/2026;129.999,50\n31/10/2026;130.000')); eq(pr.series.IBOV[1][1], 130000, 0, 'milhar no arquivo');
      // aporte com peso final de 100% ou mais é rejeitado
      ok(!C.aplicarMovimento([{t: 'A', p: 'P5', w: 0.5}, {t: 'B', p: 'P1', w: 0.5}], {t: 'A', para: 1, fonte: 'aporte'}).ok, 'aporte 100% aceito');
      // pro rata de todas as posições não mexe em placeholders
      var v = C.aprovadaOriginal('cresc-cons'), r = C.aplicarMovimento(v.pos, {t: 'LFTB11', para: 0.25, fonte: 'prorata_todas'});
      ok(r.ok, r.motivo); eq(C.sum(r.pos.filter(function (x) { return /Franchini/.test(x.t); }), function (x) { return x.w; }), 0.5, 1e-12, 'placeholder financiou');
      eq(C.sum(r.pos, function (x) { return x.w; }), 1, 1e-12, 'soma');
      // comparação usa as premissas vigentes
      var s2 = JSON.parse(JSON.stringify(DATA.sens)); s2.IMAB11.d = 12; var a2 = C.aprovadaOriginal('cresc-mod');
      ok(C.diff(a2, a2, s2).ea.fatores.dur_real > C.diff(a2, a2).ea.fatores.dur_real + 0.3, 'diff ignorou premissa');
    });
    t('Teses de 30/10: 21 teses completas e ligadas aos ativos da carteira', function () {
      var T = DATA.teses_pdf; ok(T && T.teses, 'sem teses'); var ks = Object.keys(T.teses); ok(ks.length === 21, ks.length + ' teses');
      ks.forEach(function (k) { var x = T.teses[k]; ok(x.resumo && x.papel && x.questao && x.fundamentos.length === 3 && x.riscos.length === 4 && x.criterios.length === 3 && x.fontes, 'tese incompleta: ' + k); });
      ['PETR4', 'KLBN4', 'BBSE3', 'ITSA4', 'CPLE3', 'AXIA3', 'EQTL3', 'PRIO3', 'ALOS3', 'INBR34', 'TTEN3', 'VAMO3', 'BTLG11', 'XPML11', 'TRXF11', 'KNCA11', 'CDII11', 'JURO11'].forEach(function (k) { ok(T.teses[k] && DATA.ativos[k], 'sem ligação: ' + k); });
      ok(T.equivalencias.BBDC3.tese === 'BBDC4', 'BBDC3 sem tese');
    });
    var MK = typeof MERCADO !== 'undefined' ? MERCADO : null;
    if (MK) t('Mercado ao vivo: fontes, sessão, alertas e carteira do dia (dados sintéticos de teste)', function () {
      var u = MK.urlRobo('fulano/robo-oregon'); ok(u && u.mercado === 'https://raw.githubusercontent.com/fulano/robo-oregon/dados/data/mercado.json', 'url ' + (u && u.mercado));
      ok(MK.urlRobo('https://github.com/fulano/robo-oregon').repo === 'fulano/robo-oregon', 'url do GitHub'); ok(MK.urlRobo('isso não é endereço') === null, 'url inválida aceita');
      var pts = MK.sgsPts([{data: '05/11/2026', valor: '14.25'}, {data: '06/11/2026', valor: '13,75'}, {data: '09/12/2026', valor: '13.75'}], '2026-11-06');
      ok(pts.length === 2 && pts[1][1] === 13.75, 'data futura da Selic entrou: ' + JSON.stringify(pts));
      var d = MK.normDireto({s432: [{data: '05/11/2026', valor: '14.25'}, {data: '06/11/2026', valor: '13.75'}], cambio: {USDBRL: {bid: '5.52', varBid: '0.076', pctChange: '1.40', create_date: '2026-11-06 15:29:58'}}}, '2026-11-06', '2026-11-06T18:30:00Z');
      eq(d.fatores.selic.var, -0.5, 1e-9); eq(d.fatores.usd.var, 1.4, 1e-9); ok(!d.fatores.ibov, 'inventou Ibovespa');
      var robo = {fatores: {usd: {k: 'usd', ok: true, var: 0.9, uvar: '%', data: '2026-11-06', hora: '15:00', nivel: 5.49, unid: 'R$', fonte: 'robô'}, ibov: {k: 'ibov', ok: true, var: -2, uvar: '%', data: '2026-11-06', hora: '15:00', nivel: 128000, unid: 'pts', fonte: 'robô'}}, indicadores: {},
        ativos: {VAMO3: {preco: 6.12, var: -5.8, data: '2026-11-06'}, KLBN4: {preco: 20, var: 0.5, data: '2026-11-06'}, VT: {preco: 120, var: 1.0, data: '2026-11-06'}, ITSA4: {preco: 10, var: -1, data: '2026-11-05'}}};
      var m = MK.mesclar(robo, d); eq(m.fatores.usd.var, 1.4, 1e-9, 'câmbio mais recente'); eq(m.fatores.ibov.var, -2, 1e-9);
      ok(MK.sessao(m) === '2026-11-06', 'sessão');
      var ids = MK.detectar(m, MK.LIM_PADRAO, C).map(function (a) { return a.id; });
      ok(ids.indexOf('usd:2026-11-06:atencao:+') >= 0 && ids.indexOf('ibov:2026-11-06:atencao:-') >= 0, ids.join(','));
      ok(ids.indexOf('selic:2026-11-06:forte:-') >= 0, 'Selic'); ok(ids.indexOf('VAMO3:2026-11-06:atencao:-') >= 0, 'VAMO3');
      ok(!ids.some(function (x) { return /^KLBN4|^VT:/.test(x); }), 'alerta abaixo do limite ou de ETF par');
      var ch = MK.choquesDoDia(m, '2026-11-06'); eq(ch.usd, 1.4, 1e-9); eq(ch.selic, -0.5, 1e-9);
      var v = {pos: [{t: 'VAMO3', p: 'P6', w: 0.10}, {t: 'ITSA4', p: 'P5', w: 0.20}, {t: 'VWRA', p: 'P12', w: 0.30}, {t: 'Franchini FIDC1', p: 'P3', w: 0.45}]};
      var r = MK.carteiraHoje(v, m, '2026-11-06', C);
      eq(r.total, 0.10 * -0.058 + 0.30 * (1.01 * 1.014 - 1), 1e-12, 'realizado'); eq(r.coberto, 0.40, 1e-12); eq(r.soma, 1.05, 1e-12);
      ok(r.fora.some(function (x) { return x.t === 'ITSA4' && /outra data/.test(x.motivo); }), 'cotação de outra data entrou');
      var id = MK.idioDoDia(m, '2026-11-06', C, DATA.sens, ch), rr = C.retAtivo('VAMO3', ch, DATA.sens, id);
      eq(rr.total, -0.058, 2e-4, 'motor + residual não reproduz o preço real');
    });
    if (MK) t('Robô v2: só cotação atualizada entra no cálculo do dia; suspeita e desatualizada ficam de fora, com o motivo', function () {
      var snap = {fatores: {usd: {k: 'usd', ok: true, status: 'atualizado', var: 1.0, uvar: '%', data: '2026-11-06', nivel: 5.5, unid: 'R$'}, ibov: {k: 'ibov', ok: true, status: 'atualizado', var: -1, uvar: '%', data: '2026-11-06', nivel: 129000, unid: 'pts'}}, indicadores: {},
        ativos: {VAMO3: {preco: 9, var: 31, data: '2026-11-06', status: 'suspeito'}, ITSA4: {preco: 10, var: -1, data: '2026-11-06', status: 'desatualizado', reaproveitado: true}, PRIO3: {preco: 40, var: -6, data: '2026-11-06', status: 'atualizado'}, KLBN4: {status: 'indisponivel', motivo: 'Yahoo: limite de requisições'}}};
      ok(MK.estado(snap.ativos.KLBN4) === 'indisponivel' && MK.estado({preco: 1}) === 'atualizado' && MK.estado(null) === 'indisponivel', 'estado');
      var v = {pos: [{t: 'VAMO3', p: 'P6', w: 0.1}, {t: 'ITSA4', p: 'P5', w: 0.2}, {t: 'PRIO3', p: 'P6', w: 0.1}, {t: 'KLBN4', p: 'P5', w: 0.1}]};
      var r = MK.carteiraHoje(v, snap, '2026-11-06', C);
      eq(r.total, 0.1 * -0.06, 1e-12, 'só PRIO3 entra'); eq(r.coberto, 0.1, 1e-12);
      ok(r.fora.some(function (x) { return x.t === 'VAMO3' && /anormal/.test(x.motivo); }), 'suspeita entrou no cálculo');
      ok(r.fora.some(function (x) { return x.t === 'ITSA4' && /desatualizado/.test(x.motivo); }), 'desatualizada entrou');
      ok(r.fora.some(function (x) { return x.t === 'KLBN4' && /limite de requisições/.test(x.motivo); }), 'indisponível sem motivo');
      var al = MK.detectar(snap, MK.LIM_PADRAO, C), va = al.filter(function (a) { return a.t === 'VAMO3'; })[0];
      ok(va && va.suspeito && va.nivel === 'conferir' && /conferir/.test(va.texto), 'suspeita sem aviso de conferência');
      ok(!al.some(function (a) { return a.t === 'ITSA4' || a.t === 'KLBN4'; }), 'alerta em cotação velha ou ausente');
      var ch = MK.choquesDoDia({fatores: {usd: {ok: true, status: 'desatualizado', var: 2, data: '2026-11-06'}}}, '2026-11-06'); ok(!('usd' in ch), 'fator desatualizado virou choque');
      var tr = MK.tendencia([['2026-01-02', 100], ['2026-10-01', 110], ['2026-11-06', 121]], 30); eq(tr.r, 0.1, 1e-12, 'tendência 1 mês'); ok(MK.tendencia([['2026-11-01', 1], ['2026-11-06', 2]], 365) === null, 'tendência sem base inventada');
    });
    if (MK) t('Revisão: fonte direta não troca dado em conferência, sem data não entra, sessão segue o Ibovespa', function () {
      var robo = {fatores: {usd: {k: 'usd', ok: true, status: 'suspeito', var: 9, uvar: '%', data: '2026-11-06', hora: '15:00', nivel: 6, unid: 'R$'}, ibov: {k: 'ibov', ok: true, status: 'atualizado', var: 1, uvar: '%', data: '2026-11-06', hora: '15:00', nivel: 1, unid: 'pts'}}, indicadores: {}, ativos: {}};
      var dir = MK.normDireto({cambio: {USDBRL: {bid: '5.6', varBid: '0.01', pctChange: '0.2', create_date: '2026-11-07 09:30:00'}}}, '2026-11-07', '2026-11-07T12:30:00Z');
      var m = MK.mesclar(robo, dir); ok(m.fatores.usd.status === 'suspeito' && m.fatores.usd.var === 9, 'direto trocou dado em conferência');
      ok(!('usd' in MK.choquesDoDia(m, '2026-11-06')), 'dado em conferência virou choque');
      var sem = MK.normDireto({cambio: {USDBRL: {bid: '5.6', varBid: '0.01', pctChange: '0.2'}}}, '2026-11-07', '2026-11-07T12:30:00Z'); ok(!sem.fatores.usd, 'câmbio sem data entrou com data de hoje');
      ok(MK.sessao({fatores: {ibov: {ok: true, status: 'atualizado', data: '2026-11-06'}, usd: {ok: true, status: 'atualizado', data: '2026-11-07'}}, ativos: {}}) === '2026-11-06', 'sessão saltou para a data do dólar');
    });
    if (MK) t('Briefing: filtros das notícias, seleção do dia sem ruído, o que mudou, conexão e exercício (dados sintéticos)', function () {
      var ATV = DATA.ativos;
      var c = function (n) { return MK.catNoticia(n, ATV); };
      ok(c({tema: 'PRIO3', titulo: 'PRIO conclui aquisição'}).tags.empresas && c({tema: 'PRIO3', titulo: 'x'}).tags.commodities && c({tema: 'PRIO3', titulo: 'x'}).tags.brasil, 'PRIO3: empresa, commodity e Brasil');
      ok(c({tema: 'Fiscal', titulo: 'Governo revisa meta fiscal'}).principal === 'juros' && c({tema: 'Fiscal', titulo: 'x'}).tags.brasil, 'fiscal → Juros e Fiscal');
      ok(c({tema: 'EUA', titulo: 'Fed mantém juros'}).tags.mundo && !c({tema: 'EUA', titulo: 'Fed mantém juros'}).tags.brasil, 'Fed → Mundo');
      ok(c({tema: 'Mercado', titulo: 'Petróleo recua e minério sobe na China'}).tags.commodities, 'commodity pelo título');
      var ix = c({tema: 'Juro real (IMA-B e NTN-B)', titulo: 'NTN-B sobem', etfs: ['IMAB11']}); ok(ix.tags.juros && ix.tags.brasil && !ix.tags.empresas, 'ETF de NTN-B virou empresa: ' + JSON.stringify(ix));
      ok(c({tema: 'Ações emergentes', titulo: 'x', etfs: ['EIMI']}).tags.mundo, 'ETF internacional → Mundo');
      ok(!c({tema: 'Juros', titulo: 'Tesouro Direto: taxas sobem'}).tags.commodities, '"ouro" dentro de "Tesouro" virou commodity');
      ok(!c({tema: 'Mercado', titulo: 'Banco Safra amplia crédito'}).tags.commodities && c({tema: 'Mercado', titulo: 'Banco Safra amplia crédito'}).tags.brasil, 'Banco Safra virou commodity');
      var pe = c({tema: 'PETR4', titulo: 'Petrobras emite debêntures', etfs: ['DEBB11']}); ok(pe.tags.empresas && pe.principal === 'empresas', 'notícia de empresa virou notícia de índice');
      var hoje = '2026-11-07', n = function (tit, tema, rel, quando, pontos, of) { return {titulo: tit, tema: tema, quando: quando, classe: {relevancia: rel, pontos: pontos, oficial: !!of}}; };
      var itens = [n('a', 'PRIO3', 'alta', '2026-11-07T10:00', 5), n('b', 'PRIO3', 'alta', '2026-11-07T09:00', 5), n('c', 'PRIO3', 'alta', '2026-11-07T08:00', 5), n('ruído', 'VAMO3', 'baixa', '2026-11-07T10:00', 0),
        n('velha', 'PETR4', 'alta', '2026-10-20T10:00', 9), n('fiscal', 'Fiscal', 'media', '2026-11-06T18:00', 2), n('cvm', 'BBSE3', 'alta', '2026-11-06T00:00', 6, true)];
      var ds = MK.destaques(itens, {hoje: hoje, held: {PRIO3: 1, BBSE3: 1}});
      ok(!ds.some(function (x) { return x.titulo === 'ruído'; }), 'baixa relevância entrou'); ok(!ds.some(function (x) { return x.titulo === 'velha'; }), 'notícia velha entrou');
      ok(ds.filter(function (x) { return x.tema === 'PRIO3'; }).length === 2, 'mais de duas da mesma empresa'); ok(ds.length === 4, 'deveria ter 4: ' + ds.length);
      ok(MK.destaques([n('só ruído', 'X', 'baixa', '2026-11-07T10:00', 0)], {hoje: hoje}).length === 0, 'completou com ruído');
      ok(!itens.some(function (x) { return '_score' in x; }), 'seleção alterou as notícias guardadas');
      var snap = {fatores: {real: {ok: true, status: 'atualizado', var: 0.21, uvar: 'pp', data: '2026-11-06', nivel: 7.46}, pre: {ok: true, status: 'atualizado', var: 0.05, uvar: 'pp', data: '2026-11-06', nivel: 13.4},
        usd: {ok: true, status: 'desatualizado', var: 3, uvar: '%', data: '2026-11-05', nivel: 5.4}, ust10: {ok: true, status: 'atualizado', var: 0.12, uvar: 'pp', data: '2026-11-06', nivel: 4.18}, ibov: {ok: true, status: 'atualizado', var: -1.1, uvar: '%', data: '2026-11-06', nivel: 148000},
        selic: {ok: true, status: 'atualizado', var: 0, uvar: 'pp', data: '2026-11-06', nivel: 13.75}}};
      var ms = MK.mudancas(snap, MK.LIM_PADRAO); ok(ms[0].k === 'real', 'maior movimento relativo ao limite: ' + ms[0].k); ok(!ms.some(function (m) { return m.k === 'usd'; }), 'dado desatualizado entrou no que mudou');
      var cx = MK.conexao(snap, MK.LIM_PADRAO); ok(cx && cx.k === 'ust10' && cx.br.some(function (b) { return b.k === 'real'; }) && !cx.br.some(function (b) { return b.k === 'usd'; }), 'conexão: ' + JSON.stringify(cx && cx.br));
      var fx = MK.fatoExercicio(snap, MK.LIM_PADRAO, '2026-11-06'); ok(fx && fx.k === 'real', 'exercício deveria usar o IPCA+: ' + (fx && fx.k));
      ok(MK.fatoExercicio({fatores: {}}, MK.LIM_PADRAO, '2026-11-06') === null, 'exercício sem fato real');
      var ag = MK.agendaProx({itens: [{data: '2026-11-05', evento: 'passado'}, {data: '2026-11-10', hora: '09:00', evento: 'IPCA'}, {data: '2026-11-09', evento: 'Focus'}, {data: '2026-12-30', evento: 'longe'}]}, hoje, 10);
      ok(ag.length === 2 && ag[0].evento === 'Focus', 'agenda: ' + JSON.stringify(ag));
    });
    t('ETFs: as 27 fichas têm fonte oficial e o cadastro divergente aparece, sem alterar o cadastro', function () {
      var E = DATA.etfs; if (!E) { ok(true); return; }
      var faltam = Object.keys(DATA.ativos).filter(function (t) { var a = DATA.ativos[t]; return /ETF/.test(a.tipo || '') && !E[t]; }); ok(!faltam.length, 'ETFs sem ficha: ' + faltam.join(','));
      Object.keys(E).forEach(function (t) { var e = E[t]; ok(e.indice && e.objetivo && (e.documentos || []).length && (e.fontes || []).every(function (u) { return /^https:\/\//.test(u); }) && e.consultado_em, 'ficha incompleta ou sem fonte: ' + t); });
      ok(/IRF-M P3/.test(E.IDKA11.indice) && E.IDKA11.aviso_cadastro, 'IDKA11: índice real e aviso'); ok(DATA.ativos.IDKA11.nome === 'ETF de prefixado (índice IDkA)', 'cadastro alterado');
      ok(E.LFTB11.aviso_cadastro && /NTN-B/.test(E.LFTB11.aviso_cadastro), 'LFTB11 sem aviso da NTN-B');
    });
    t('Consistência das carteiras aprovadas: 10 inválidas, pesos preservados como decididos (sem normalizar)', function () {
      var inval = C.CARTS.filter(function (m) { return C.validate(C.aprovadaOriginal(m.id), {sens: DATA.sens, irmaos: {}}).status === 'invalida'; }).map(function (m) { return m.id; });
      ok(inval.length === 10, inval.length + ' inválidas: ' + inval.join(','));
      eq(C.sum(C.aprovadaOriginal('cresc-mod').pos, function (x) { return x.w; }), 1.06, 1e-9, 'Crescimento Moderado deveria somar 106% como no simulador');
      eq(C.sum(C.aprovadaOriginal('alt-sup').pos, function (x) { return x.w; }), 1.7, 1e-9, 'Alternativo Super Arrojado');
      var pil = 0; Object.keys(C.estrategica('intl-mod').alvo).forEach(function (p) { pil += C.estrategica('intl-mod').alvo[p]; }); eq(pil, 1.15, 1e-9, 'pilares do Internacional Moderado');
    });
    if (APP && APP.salaTestes) t('Sala local: lê Selic a 16% e propaga sem tratar placeholder como risco', function () {
      var L = APP.salaTestes.lerLocal('Copom eleva a Selic para 16% e a curva abre'); ok(L.base.selic > 2 && L.base.pre > 0, JSON.stringify(L.base));
      var e1 = APP.salaTestes.analiseLocal('Dólar dispara 5% com ruído fiscal', 'cresc-cons'); var I = APP.salaTestes.impactos(e1, 'cresc-cons');
      ok(I.probs.ok, 'probabilidades'); ok(I.focoBase.descobertos.some(function (x) { return /Franchini/.test(x.t); }), 'placeholder não marcado como fora');
    });
    return out;
  }
  return {run: run};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = TESTS;
