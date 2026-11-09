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
    // Oregon Intelligence: funções puras da camada de conteúdo (busca, filtros, ordem, importação do registro de aprendizados)
    var IN = typeof INTEL !== 'undefined' ? INTEL : null;
    if (IN) t('Intelligence: busca e filtros da Biblioteca não escondem nada sem filtro; acentos e maiúsculas não importam', function () {
      var it = function (id, titulo, extra) { return Object.assign({id: id, titulo: titulo, link: 'https://x.test/' + id, publicado_em: '2026-11-0' + (1 + (id % 7)) + 'T10:00', temas: [], regioes: [], ativos: [], fatores: [], tipo: 'noticia', categoria: 'veiculo', organizacao: 'Jornal', prioridade: {pontos: 10 + id, nivel: 'baixa'}}, extra || {}); };
      var L = [it(1, 'Copom mantém a Selic', {temas: ['juros'], regioes: ['brasil'], tipo: 'documento_oficial', categoria: 'instituicao', organizacao: 'BC', prioridade: {pontos: 50, nivel: 'alta'}}),
        it(2, 'Petrobras anuncia dividendos', {ativos: ['PETR4'], temas: ['bolsa']}), it(3, 'Oaktree memo: crédito privado', {temas: ['credito'], tipo: 'carta', categoria: 'gestora_internacional', organizacao: 'Oaktree', regioes: ['eua'], publicado_em: '2026-10-02T10:00'}),
        it(4, 'Item agrupado', {agrupado_em: 'x'}), it(5, 'Inflação de serviços', {temas: ['inflacao']})];
      var todos = IN.juntar([L, L.slice(0, 2)]); ok(todos.length === 4, 'juntar repetiu ou manteve agrupado: ' + todos.length);
      ok(IN.filtrar(todos, {}).length === 4, 'sem filtro escondeu item');
      ok(IN.filtrar(todos, {q: 'SELIC'}).length === 1 && IN.filtrar(todos, {q: 'inflacao'}).length === 1, 'busca sem acento/maiúscula');
      ok(IN.filtrar(todos, {tema: 'juros'})[0].id === 1 && IN.filtrar(todos, {ativo: 'PETR4'})[0].id === 2 && IN.filtrar(todos, {org: 'Oaktree'}).length === 1, 'filtros por tema, ativo e gestora');
      ok(IN.filtrar(todos, {de: '2026-11-01'}).length === 3 && IN.filtrar(todos, {tipo: 'carta'}).length === 1 && IN.filtrar(todos, {regiao: 'eua'}).length === 1 && IN.filtrar(todos, {nivel: 'alta'}).length === 1, 'período, tipo, região e prioridade');
      ok(IN.ordenar(todos)[0].id === 1, 'ordem por prioridade');
      var c = IN.contagens(todos, 'temas'); ok(c.juros === 1 && c.credito === 1, 'contagens por tema');
      ok(IN.temaNome('juros') === 'Juros e política monetária' && IN.tipoNome('carta') === 'Carta de gestor', 'taxonomia injetada do robô');
    });
    if (IN) t('Intelligence: exportar e importar aprendizados preserva o registro e descarta lixo', function () {
      var reg = [{id: 'ap-1', quando: '2026-11-06T10:00:00Z', item_id: 'x1', titulo: 'Carta 41', fonte: 'Gestora', link: 'https://g.test/c41', temas: ['juros'], tipo: 'tese', nota: 'Premissa: juro real alto por muito tempo.'}];
      var txt = IN.exportarAprendizados(reg), back = IN.lerImportacao(txt);
      ok(back.length === 1 && back[0].id === 'ap-1' && back[0].tipo === 'tese' && back[0].nota === reg[0].nota && back[0].link === reg[0].link, 'ida e volta mudou o registro');
      var sujo = IN.lerImportacao(JSON.stringify({itens: [{id: 'a', nota: 'ok', tipo: 'qualquer', link: 'javascript:alert(1)'}, {sem_id: true}, 'texto', {id: 'b', titulo: 'só título'}]}));
      ok(sujo.length === 2 && sujo[0].tipo === 'aprendizado' && sujo[0].link === null, 'importação aceitou tipo ou link inválido: ' + JSON.stringify(sujo));
      var erro = false; try { IN.lerImportacao('{"nada": 1}'); } catch (e) { erro = true; } ok(erro, 'arquivo sem lista deveria falhar');
    });
    if (IN) t('Notícias: hora relativa, últimas com filtros, notícias por ativo e opiniões a favor e contra', function () {
      var ag = new Date('2026-11-08T12:40:00Z');  // 09:40 em Brasília
      ok(IN.quando({publicado_em: '2026-11-08T09:28-03:00'}, ag) === 'há 12 min', 'minutos: ' + IN.quando({publicado_em: '2026-11-08T09:28-03:00'}, ag));
      ok(IN.quando({publicado_em: '2026-11-08T06:40-03:00'}, ag) === 'há 3 h', 'horas');
      ok(IN.quando({publicado_em: '2026-11-07T18:40-03:00'}, ag) === 'ontem 18:40', 'ontem');
      ok(IN.quando({publicado_em: '2026-11-06'}, ag) === '06/11', 'documento com data e sem hora não ganha hora: ' + IN.quando({publicado_em: '2026-11-06'}, ag));
      ok(IN.quando({acervo: true, referencia: '2025-03'}, ag) === 'acervo · ref. mar/2025', 'acervo');
      var n = function (id, h, extra) { return Object.assign({id: 'n' + id, titulo: 'N' + id, link: 'https://x.test/' + id, publicado_em: h, categoria: 'veiculo', pais: 'Brasil', regioes: ['brasil'], ativos: [], natureza: 'noticia'}, extra || {}); };
      var kl = {ativos: ['KLBN4'], ativos_porque: {KLBN4: 'Klabin'}};
      var L = [n(1, '2026-11-08T09:00-03:00', Object.assign({titulo: 'Safra rebaixa Klabin para neutro', natureza: 'opiniao_casa', casas: ['Safra'], posicao: 'contraria'}, kl)),
        n(2, '2026-11-08T08:00-03:00', Object.assign({titulo: 'BTG eleva Klabin para compra', natureza: 'opiniao_casa', casas: ['BTG Pactual'], posicao: 'favoravel'}, kl)),
        n(3, '2026-11-07T20:00-03:00', Object.assign({titulo: 'Klabin amplia fábrica em Ortigueira', via: 'Bing Notícias', confiavel: false, fonte: 'Agora Litoral'}, kl)),
        n(4, '2026-11-06', {ativos: ['KLBN4'], titulo: 'KLBN4 — Fato Relevante', categoria: 'oficial_empresa', tipo: 'fato_relevante'}),
        n(5, '2026-11-08T07:00-03:00', {setor_de: ['KLBN4'], titulo: 'Celulose na China'}),
        n(6, '2026-11-08T05:00-03:00', {pais: 'EUA', regioes: ['eua'], etfs_tema: ['IB01']}),
        n(7, '2026-11-01T09:00-03:00', Object.assign({titulo: 'Klabin conclui projeto Puma II'}, kl)), n(8, '2026-11-08T09:10-03:00', {acervo: true}), n(9, '2026-11-08T09:20-03:00', {categoria: 'gestora_brasil', tipo: 'carta'}),
        n(10, '2026-11-08T06:00-03:00', Object.assign({titulo: 'Allied paga R$ 0,63; Santander, Klabin, Lavvi e outros completam dividendos da semana'}, kl))];
      var u = IN.ultimas(L, {horas: 48, agora: ag}).map(function (x) { return x.id; });
      ok(u.join() === 'n1,n2,n5,n10,n6,n4', 'últimas: ordem, janela, sem acervo/carta e sem veículo pouco conhecido: ' + u.join());
      ok(IN.ultimas(L, {horas: 48, agora: ag, todosVeiculos: true}).length === 7, 'na ficha entram os veículos pouco conhecidos');
      ok(IN.ultimas(L, {horas: 48, agora: ag, filtro: 'casas'}).length === 2 && IN.ultimas(L, {horas: 48, agora: ag, filtro: 'oficial'})[0].id === 'n4' && IN.ultimas(L, {horas: 48, agora: ag, filtro: 'mundo'})[0].id === 'n6', 'filtros opiniões, oficiais e mundo');
      ok(IN.ultimas(L, {horas: 48, agora: ag, filtro: 'gestoras'}).map(function (x) { return x.id; }).join() === 'n9,n1,n2', 'gestoras e casas: carta + opiniões');
      ok(IN.ultimas(L, {horas: 48, agora: ag, filtro: 'ri'}).map(function (x) { return x.id; }).join() === 'n4', 'RI e CVM: só documentos da companhia');
      ok(IN.ultimas(L, {horas: 48, agora: ag, filtro: 'carteira'}).map(function (x) { return x.id; }).indexOf('n10') < 0, 'Na carteira não inclui a menção na lista de dividendos');
      var c = IN.doAtivo(L, 'KLBN4');
      ok(c.direto.length === 5 && c.mencoes.length === 1 && c.mencoes[0].id === 'n10' && c.tema.length === 1 && c.tema[0].id === 'n5', 'diretas, menções e setor: ' + c.direto.length + '/' + c.mencoes.length + '/' + c.tema.length);
      ok(c.oficiais.length === 1 && c.noticias.length === 4, 'documentos da CVM separados');
      ok(c.opinioes.total === 2 && c.opinioes.favoravel[0].id === 'n2' && c.opinioes.contraria[0].id === 'n1', 'opiniões a favor e contra');
      var ct = IN.contrapontos(L, L[0]); ok(ct.itens.length === 1 && ct.itens[0].id === 'n2', 'contraponto da opinião contrária é a favorável');
      ok(IN.contrapontos(L, n(10, '2026-11-08T09:00-03:00', {ativos: ['ITSA4']})).itens.length === 0, 'sem fonte concreta não há contraponto');
      var pa = IN.porAtivo(L, {horas: 72, agora: ag}); ok(pa[0].t === 'KLBN4' && pa[0].casas === 2 && pa[0].m === 1, 'ativos com notícia: ' + JSON.stringify(pa.map(function (r) { return [r.t, r.n, r.m, r.casas]; })));
    });
    if (IN) t('Linhas de notícia: hora de publicação, separador de dia, data estimada e destaques sem sensacionalismo', function () {
      var ag = new Date('2026-11-08T12:40:00Z');
      ok(IN.hora({publicado_em: '2026-11-08T09:28-03:00'}).txt === '09:28' && !IN.hora({publicado_em: '2026-11-08T09:28-03:00'}).sem, 'hora de publicação');
      var so = IN.hora({publicado_em: '2026-11-06'}); ok(so.txt === '—' && so.sem && so.dia === '2026-11-06', 'só data: sem hora inventada');
      var det = IN.hora({detectado_em: '2026-11-08T10:17-03:00'}); ok(det.est && det.txt === '≈10:17' && /detectou/.test(det.tip), 'sem data de publicação: hora de detecção marcada');
      ok(IN.horaAbs('2026-11-08T10:17:14-03:00', ag) === '10:17' && IN.horaAbs('2026-11-07T22:30-03:00', ag) === 'ontem 22:30' && IN.horaAbs('2026-11-05T08:00-03:00', ag) === '05/11 08:00', 'hora absoluta da coleta');
      ok(IN.rotuloDia('2026-11-08', ag) === 'Hoje · dom 08/11' && IN.rotuloDia('2026-11-07', ag) === 'Ontem · sáb 07/11' && IN.rotuloDia('2026-11-06', ag) === 'sex 06/11', 'separador de dia');
      var p = function (id, pts, h, extra) { return Object.assign({id: id, titulo: id, publicado_em: '2026-11-08T' + h + '-03:00', prioridade: {pontos: pts}}, extra || {}); };
      var D = IN.destaques([p('a', 10, '09:00'), p('b', 40, '08:00'), p('c', 60, '07:00', {natureza: 'sensacionalista'}), p('d', 35, '10:00'), p('e', 32, '06:00'), p('f', 20, '05:00'), p('g', 5, '11:00')], 3);
      ok(D.map(function (x) { return x.id; }).join() === 'd,b,e', 'destaques por relevância, exibidos por hora: ' + D.map(function (x) { return x.id; }).join());
    });
    if (IN && typeof AMOSTRAS_LEITURA !== 'undefined') t('Vínculo com o ativo nas notícias reais capturadas (mesma regra do robô): direto × menção de passagem', function () {
      AMOSTRAS_LEITURA.casos.forEach(function (c) {
        var got = {}; (c.item.ativos || []).forEach(function (tk) { var v = IN.vinculo(c.item, tk); got[tk] = [v.tipo, v.evento]; });
        ok(JSON.stringify(got) === JSON.stringify(c.esperado.vinculos), c.caso + ': ' + JSON.stringify(got));
      });
      var men = AMOSTRAS_LEITURA.casos.filter(function (c) { return c.caso === 'mencao_em_lista_de_dividendos'; })[0].item;
      ok(IN.relevancia(men) < IN.pontos(men), 'item antigo só com menção perde o bônus do ativo');
      var tem = AMOSTRAS_LEITURA.casos.filter(function (c) { return c.caso === 'noticia_do_setor_sem_citar_a_empresa'; })[0].item;
      var c = IN.doAtivo([tem], 'BBDC3'); ok(c.tema.length === 1 && c.direto.length === 0 && IN.vinculoTema(tem, 'BBDC3') === 'setorial', 'notícia do setor fica em Setor e cadeia');
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
    t('v3.4: Grupo XP fora de tudo; opiniões da XP em outros veículos continuam; resultado exige período ou valor', function () {
      var IN = typeof INTEL !== 'undefined' ? INTEL : null; if (!IN) { ok(true); return; }
      // v3.10 · exceção pedida pelo Lucas: InfoMoney entra no painel marcado como Grupo XP; os demais do grupo continuam bloqueados
      ok(!IN.bloqueado({organizacao: 'InfoMoney'}) && IN.grupoXP({organizacao: 'InfoMoney'}) && IN.grupoXP({fonte: 'x', aviso_fonte: 'Grupo XP — não citar em material de cliente'}), 'InfoMoney deveria entrar marcado como Grupo XP');
      ok(IN.bloqueado({organizacao: 'XP Investimentos'}) && IN.bloqueado({fonte: 'Expert XP'}), 'XP Investimentos e Expert XP deveriam continuar bloqueados');
      ok(!IN.bloqueado({organizacao: 'Money Times', titulo: 'XP revela suas 11 ações favoritas'}), 'opinião da XP em outro veículo foi bloqueada');
      var L = IN.juntar([[{id: 'a', organizacao: 'XP Investimentos', publicado_em: '2026-11-07'}, {id: 'b', organizacao: 'Money Times', publicado_em: '2026-11-07'}]]);
      ok(L.length === 1 && L[0].id === 'b', 'juntar não removeu o veículo bloqueado');
      var R = new RegExp(TAXON.vinculo.resultado, 'i');
      ok(R.test('lucro dos bancoes cresce no 3t26') && R.test('klabin tem lucro 20% maior'), 'resultado não reconhecido');
      ok(!R.test('homem tem a conta do bradesco invadida e sofre prejuizo de r$ 5 mil') && !R.test('copel divulga novo balanco sobre imoveis sem energia'), 'falso resultado');
    });
    t('v3.5: preço-alvo por casa só quando escrito em reais (outra classe da ação e ADR ficam de fora)', function () {
      var IN = typeof INTEL !== 'undefined' ? INTEL : null; if (!IN) { ok(true); return; }
      var a = IN.alvosDe({preco_alvo: 'R$ 21,00 (Itaú BBA); R$ 19,00 (J.P. Morgan); R$ 18,50 (Goldman Sachs)', casas: ['Itaú BBA', 'J.P. Morgan', 'Goldman Sachs']}, 'KLBN4');
      ok(a.length === 3 && a[0].casa === 'Itaú BBA' && a[0].v === 21 && a[2].v === 18.5, JSON.stringify(a));
      var p = IN.alvosDe({preco_alvo: 'R$ 33,20 (PETR4); R$ 35,50 (PETR3)', casas: ['Goldman Sachs']}, 'PETR4');
      ok(p.length === 1 && p[0].v === 33.2, 'PETR3 entrou no alvo de PETR4: ' + JSON.stringify(p));
      ok(IN.alvosDe({preco_alvo: 'US$ 4,75 (ADR BBD)', casas: ['Morgan Stanley']}, 'BBDC3').length === 0, 'alvo em dólar entrou');
      ok(IN.alvosDe({preco_alvo: '', casas: ['Safra']}, 'KLBN4').length === 0 && IN.alvosDe({recomendacao: 'Compra', casas: ['Safra']}, 'KLBN4').length === 0, 'alvo inventado');
    });
    t('v3.5: o mesmo fato em vários veículos vira um item (+N); veículo pouco conhecido sem fato da empresa fica recolhido', function () {
      var IN = typeof INTEL !== 'undefined' ? INTEL : null; if (!IN || !IN.agruparFatos) { ok(true); return; }
      var d = {PRIO3: {tipo: 'direto', motivo: 'x', evento: 'resultado'}}, n = {PRIO3: {tipo: 'direto', motivo: 'x', evento: null}};
      var a = {id: 'a', titulo: 'PRIO tem lucro de R$ 1,2 bilhão no 3T26, alta de 468%', ativos: ['PRIO3'], vinculos: d, publicado_em: '2026-11-06T19:10:00-03:00', categoria: 'veiculo', via: 'Bing', confiavel: false, fonte: 'Portal X'};
      var b = {id: 'b', titulo: 'PRIO lucra R$ 1,2 bilhão no terceiro trimestre; alta de 468%', ativos: ['PRIO3'], vinculos: d, publicado_em: '2026-11-06T20:00:00-03:00', categoria: 'veiculo', organizacao: 'Valor Econômico'};
      var c = {id: 'c', titulo: 'PRIO anuncia nova campanha de perfuração em Peregrino', ativos: ['PRIO3'], vinculos: n, publicado_em: '2026-11-06T21:00:00-03:00', categoria: 'veiculo', organizacao: 'Brazil Journal'};
      var g = IN.agruparFatos([a, b, c]);
      ok(g.length === 2, 'grupos: ' + g.length);
      var g1 = g.filter(function (x) { return x.outros.length; })[0];
      ok(g1 && g1.x.id === 'b' && g1.outros[0].id === 'a', 'o principal deveria ser o veículo conhecido: ' + JSON.stringify(g1 && {x: g1.x.id, o: g1.outros.map(function (y) { return y.id; })}));
      var z = {id: 'z', titulo: 'PRIO3: veja como está a ação hoje', ativos: ['PRIO3'], vinculos: n, publicado_em: '2026-11-06T22:00:00-03:00', categoria: 'veiculo', via: 'Bing', confiavel: false};
      ok(IN.baixaRelevancia(z) && !IN.baixaRelevancia(a) && !IN.baixaRelevancia(c), 'baixa relevância errada');
      ok(!IN.baixaRelevancia({id: 'o', titulo: 'BTG eleva PRIO para compra', ativos: ['PRIO3'], natureza: 'opiniao_casa', categoria: 'veiculo', via: 'Bing', confiavel: false}), 'opinião de casa foi recolhida');
      var o = IN.ordenarConfiaveis([z, c]); ok(o[0].id === 'c', 'veículo conhecido deveria vir antes no mesmo dia');
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
