/* Dados (importação) e Metodologia */
(function (A, C) {
  'use strict';
  var h = A.h, S = A.S;
  var XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  var TIPOS = [
    ['precos', 'Preços de ativos', 'data; TICKER1; TICKER2… (largo) ou data; ticker; preco (longo). Use preço ajustado por proventos quando tiver.'],
    ['fatores', 'Fatores e benchmarks', 'Mesmo formato. IDs: IBOV, CDI (índice acumulado), USDBRL, SPX, EEM, BRENT, BTC, SELIC, DI, NTNB, UST2, UST10 e HYOAS (estes últimos em nível, % a.a.).'],
    ['efetiva', 'Carteira efetiva', 'carteira; ticker; peso (em % ou fração). carteira = id (ex.: cresc-mod). Fica só neste navegador e nunca é enviada ao Claude.'],
    ['fluxos', 'Patrimônio e fluxos', 'data; patrimonio; fluxo (aportes positivos, resgates negativos). Para TWR e MWR.'],
    ['liquidez', 'Liquidez', 'ticker; adtv (volume médio diário em R$).'],
    ['composicao', 'Composição de ETFs e fundos', 'etf; ativo; peso; pais; setor (peso em % ou fração).']
  ];
  var FATOR_IDS = ['IBOV', 'CDI', 'USDBRL', 'SPX', 'EEM', 'BRENT', 'BTC', 'SELIC', 'DI', 'NTNB', 'UST2', 'UST10', 'HYOAS'];

  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = XLSX_URL; s.onload = function () { res(window.XLSX); }; s.onerror = function () { rej(new Error('Não consegui carregar o leitor de Excel (sem internet?). Salve a planilha como CSV.')); }; document.head.appendChild(s); });
  }
  async function lerArquivo(file) {
    var nome = file.name.toLowerCase();
    if (/\.(xlsx|xls)$/.test(nome)) { var X = await loadXLSX(); var wb = X.read(await file.arrayBuffer(), {type: 'array', cellDates: false}); var ws = wb.Sheets[wb.SheetNames[0]]; return {rows: X.utils.sheet_to_json(ws, {header: 1, raw: true, defval: ''})}; }
    var txt = await file.text();
    if (/\.json$/.test(nome)) { var j = JSON.parse(txt); return {json: j}; }
    return {rows: C.parseCSV(txt)};
  }
  function jsonParaSeries(j) {
    if (j && j.series && typeof j.series === 'object') { var out = {}; Object.keys(j.series).forEach(function (k) { var v = j.series[k]; out[k] = Array.isArray(v) ? v : (v && v.pts) || []; }); return {ok: true, series: out, rejeitadas: []}; }
    if (Array.isArray(j)) { var rows = [Object.keys(j[0] || {})]; j.forEach(function (o) { rows.push(rows[0].map(function (k) { return o[k]; })); }); return C.parsePriceTable(rows); }
    return {ok: false, motivo: 'JSON sem o campo "series" nem lista de linhas'};
  }
  // valida séries: datas e números finitos, ordena, remove duplicadas (fica a última)
  function limpar(series) {
    var out = {}, rej = [];
    Object.keys(series).forEach(function (id) {
      var m = {}; (series[id] || []).forEach(function (p) { var d = C.parseDate(p[0]), v = C.parseNum(p[1]); if (!d || !isFinite(v)) { rej.push({linha: id, motivo: 'ponto inválido'}); return; } m[d] = v; });
      var pts = Object.keys(m).sort().map(function (d) { return [d, m[d]]; }); if (pts.length) out[id] = pts;
    });
    return {series: out, rej: rej};
  }

  A.carregarTabelas = async function () {
    A.SER = {}; var s = await STORE.series(); Object.keys(s).forEach(function (k) { A.SER[k] = s[k]; });
    for (var i = 0; i < TIPOS.length; i++) { var t = TIPOS[i][0]; if (t === 'precos' || t === 'fatores') continue; A.TAB[t] = await STORE.tabela(t); }
  };

  A.abrirDados = function () {
    var body = h('div');
    var d = A.drawer('Dados e importação', body);
    function draw() {
      body.replaceChildren();
      body.appendChild(h('p', null, 'Importe CSV, XLSX ou JSON. Nada é executado a partir dos arquivos: cada linha é lida como texto, validada e as inválidas são listadas. ', STORE.mode === 'db' ? 'Séries e tabelas ficam neste navegador; propostas, decisões e premissas ficam no banco do painel.' : 'Tudo fica neste navegador; use o pacote de dados para levar a outro computador.'));
      var tipo = h('select', {class: 'inp w'}, TIPOS.map(function (t) { return h('option', {value: t[0]}, t[1]); }));
      var ajust = h('select', {class: 'inp'}, h('option', {value: 'ajustado'}, 'Preço ajustado (retorno total)'), h('option', {value: 'preco'}, 'Só preço (sem proventos)'), h('option', {value: 'nivel'}, 'Nível / taxa'));
      var fonte = h('input', {class: 'inp w', placeholder: 'Fonte (ex.: Economatica, B3, Tesouro, Bloomberg)'});
      var ajuda = h('p', {class: 'hint'}, TIPOS[0][2]);
      tipo.addEventListener('change', function () { ajuda.textContent = TIPOS.filter(function (t) { return t[0] === tipo.value; })[0][2]; ajust.parentNode.hidden = !/precos|fatores/.test(tipo.value); });
      var file = h('input', {type: 'file', accept: '.csv,.txt,.json,.xlsx,.xls', class: 'inp w'});
      var rel = h('div');
      var go = h('button', {class: 'btn pri', onclick: async function () {
        if (!file.files[0]) { A.toast('Escolha um arquivo.'); return; }
        rel.replaceChildren(h('p', null, 'Lendo…'));
        try { var r = await importar(tipo.value, file.files[0], {tipo: ajust.value, fonte: fonte.value, arquivo: file.files[0].name}); rel.replaceChildren(r); await A.carregarTabelas(); A.render(); draw2(); }
        catch (e) { rel.replaceChildren(h('div', {class: 'alert bad'}, 'Falhou: ' + (e.message || e))); }
      }}, 'Importar');
      body.append(h('div', {class: 'form', style: 'grid-template-columns:1fr'}, h('label', {class: 'field'}, 'Tipo', tipo), ajuda, h('label', {class: 'field'}, 'Natureza da série', ajust), h('label', {class: 'field'}, 'Fonte', fonte), h('label', {class: 'field'}, 'Arquivo', file)), h('div', {class: 'row', style: 'margin:10px 0'}, go, h('button', {class: 'btn', onclick: modelos}, 'Baixar modelos CSV')), rel);
      var inv = h('div'); body.appendChild(inv);
      function draw2() {
        inv.replaceChildren(h('h3', null, 'Séries neste navegador (' + Object.keys(A.SER).length + ')'));
        var rows = Object.keys(A.SER).sort().map(function (k) { var s = A.SER[k], p = s.pts; return {id: k, n: p.length, ini: p[0] && p[0][0], fim: p.length && p[p.length - 1][0], tipo: s.tipo, fonte: s.fonte, arq: s.arquivo, imp: s.importado, freq: p.length > 2 ? Q.inferFreq(p.map(function (x) { return x[0]; })).freq : '—', conhecido: C.ATV[k] ? 'ativo' : FATOR_IDS.indexOf(k) >= 0 ? 'fator' : Object.keys(C.ATV).some(function (t) { return C.ATV[t].proxy_us === k; }) ? 'proxy' : 'não reconhecido'}; });
        inv.appendChild(rows.length ? A.table([{k: 'id', t: 'ID'}, {k: 'conhecido', t: 'Uso'}, {k: 'n', t: 'Pontos', r: 1}, {k: 'ini', t: 'Início', f: function (r) { return A.dataBR(r.ini); }}, {k: 'fim', t: 'Fim', f: function (r) { return A.dataBR(r.fim); }}, {k: 'freq', t: 'Freq.'}, {k: 'tipo', t: 'Natureza'}, {k: 'fonte', t: 'Fonte', f: function (r) { return (r.fonte || '—') + (r.arq ? ' · ' + r.arq : ''); }}, {k: 'x', t: '', s: false, f: function (r) { return h('button', {class: 'btn sm danger', onclick: async function () { if (!confirm('Apagar a série ' + r.id + '?')) return; await STORE.delSerie(r.id); await A.carregarTabelas(); A.render(); draw2(); }}, 'Apagar'); }}], rows, {sort: 'id', dir: 1}) : h('p', {class: 'empty'}, 'Nenhuma série importada. Sem séries, volatilidade, correlação, VaR, ES, otimização, cenários históricos e atribuição de performance aparecem como “Não disponível”.'));
        inv.appendChild(h('h3', null, 'Tabelas'));
        inv.appendChild(h('ul', null, TIPOS.slice(2).map(function (t) { var v = A.TAB[t[0]]; return h('li', null, t[1] + ': ' + (v ? 'importada' : 'não importada'), v ? h('button', {class: 'btn sm', style: 'margin-left:8px', onclick: async function () { await STORE.saveTabela(t[0], null); await A.carregarTabelas(); A.render(); draw2(); }}, 'Apagar') : null); })));
        inv.appendChild(h('h3', null, 'Pacote de dados'));
        inv.appendChild(h('div', {class: 'row'}, h('button', {class: 'btn', onclick: exportarPacote}, 'Exportar pacote (JSON)'), h('label', {class: 'btn'}, 'Importar pacote', h('input', {type: 'file', accept: '.json', hidden: true, onchange: async function (e) { var f = e.target.files[0]; if (!f) return; try { await importarPacote(JSON.parse(await f.text())); await A.carregarTabelas(); A.render(); draw2(); A.toast('Pacote importado.'); } catch (er) { A.toast('Pacote inválido: ' + (er.message || er)); } }}))));
      }
      draw2();
    }
    draw();
  };

  async function importar(tipo, file, meta) {
    var lido = await lerArquivo(file);
    if (tipo === 'precos' || tipo === 'fatores') {
      var pr = lido.json ? jsonParaSeries(lido.json) : C.parsePriceTable(lido.rows);
      if (!pr.ok) throw new Error(pr.motivo);
      var lim = limpar(pr.series), ids = Object.keys(lim.series);
      if (!ids.length) throw new Error('nenhuma série válida encontrada');
      var desconhecidos = ids.filter(function (k) { return !C.ATV[k] && FATOR_IDS.indexOf(k) < 0 && !Object.keys(C.ATV).some(function (t) { return C.ATV[t].proxy_us === k; }); });
      var porId = {}; ids.forEach(function (k) { porId[k] = lim.series[k]; });
      var metaS = {tipo: meta.tipo, fonte: meta.fonte || null, arquivo: meta.arquivo, moeda: null};
      await STORE.saveSeries(porId, metaS);
      var rej = (pr.rejeitadas || []).concat(lim.rej);
      return h('div', {class: 'alert ok'}, h('b', null, ids.length + ' séries importadas'), ' (formato ' + (pr.formato || 'json') + '). ', rej.length ? rej.length + ' linhas rejeitadas: ' + rej.slice(0, 6).map(function (r) { return 'linha ' + r.linha + ' (' + r.motivo + ')'; }).join('; ') + (rej.length > 6 ? '…' : '') + '. ' : '', desconhecidos.length ? 'Não reconhecidos (ficam guardados, mas não entram em cálculos): ' + desconhecidos.join(', ') + '.' : '', meta.tipo === 'preco' ? ' Atenção: série só de preço; retornos não incluem proventos.' : '');
    }
    var objs = lido.json ? (Array.isArray(lido.json) ? lido.json.map(function (o) { var r = {}; Object.keys(o).forEach(function (k) { r[k.toLowerCase()] = String(o[k]); }); return r; }) : []) : C.parseObjects(lido.rows);
    if (!objs.length) throw new Error('arquivo sem linhas');
    var rej = [];
    if (tipo === 'efetiva') {
      var by = {};
      objs.forEach(function (o, i) { var c = o.carteira, t = C.resolveTicker(String(o.ticker || '').toUpperCase()), w = C.parseNum(o.peso); if (!C.MAND[c] || !t || !isFinite(w)) { rej.push(i + 2); return; } (by[c] = by[c] || []).push({t: t, p: C.ATV[t] ? C.ATV[t].pilar : '?', w: w}); });
      Object.keys(by).forEach(function (c) { var pct = by[c].some(function (x) { return x.w > 1; }); if (pct) by[c].forEach(function (x) { x.w /= 100; }); by[c] = {pos: by[c], data: new Date().toISOString().slice(0, 10), arquivo: meta.arquivo}; });
      var old = A.TAB.efetiva || {}; await STORE.saveTabela('efetiva', Object.assign(old, by));
      return h('div', {class: 'alert ok'}, 'Carteira efetiva de ' + Object.keys(by).join(', ') + ' importada. Selecione “Efetiva” em Versão. ' + (rej.length ? 'Linhas rejeitadas: ' + rej.join(', ') + '.' : ''));
    }
    if (tipo === 'fluxos') {
      var rows = []; objs.forEach(function (o, i) { var d = C.parseDate(o.data), v = C.parseNum(o.patrimonio), f = C.parseNum(o.fluxo || 0); if (!d || !isFinite(v)) { rej.push(i + 2); return; } rows.push({data: d, valor: v, fluxo: isFinite(f) ? f : 0}); });
      rows.sort(function (a, b) { return a.data < b.data ? -1 : 1; });
      await STORE.saveTabela('fluxos', {rows: rows, arquivo: meta.arquivo});
      return h('div', {class: 'alert ok'}, rows.length + ' datas de patrimônio importadas. ' + (rej.length ? 'Rejeitadas: ' + rej.join(', ') : ''));
    }
    if (tipo === 'liquidez') {
      var lq = {}; objs.forEach(function (o, i) { var t = C.resolveTicker(String(o.ticker || '').toUpperCase()), v = C.parseNum(o.adtv); if (!t || !isFinite(v) || v <= 0) { rej.push(i + 2); return; } lq[t] = v; });
      await STORE.saveTabela('liquidez', lq);
      return h('div', {class: 'alert ok'}, Object.keys(lq).length + ' ativos com volume diário. ' + (rej.length ? 'Rejeitadas: ' + rej.join(', ') : ''));
    }
    if (tipo === 'composicao') {
      var cp = {}; objs.forEach(function (o, i) { var e = String(o.etf || '').toUpperCase(), a = o.ativo, w = C.parseNum(o.peso); if (!e || !a || !isFinite(w)) { rej.push(i + 2); return; } (cp[e] = cp[e] || []).push({ativo: a, peso: w, pais: o.pais || null, setor: o.setor || null}); });
      Object.keys(cp).forEach(function (e) { var pct = cp[e].some(function (x) { return x.peso > 1; }); if (pct) cp[e].forEach(function (x) { x.peso /= 100; }); });
      await STORE.saveTabela('composicao', cp);
      return h('div', {class: 'alert ok'}, 'Composição de ' + Object.keys(cp).join(', ') + ' importada. ' + (rej.length ? 'Rejeitadas: ' + rej.join(', ') : ''));
    }
    throw new Error('tipo desconhecido');
  }
  function modelos() {
    var t = [
      ['precos_largo.csv', 'data;LFTB11;ITSA4;VWRA\n2026-09-30;;;\n2026-10-31;;;\n'],
      ['precos_longo.csv', 'data;ticker;preco\n2026-10-31;ITSA4;\n'],
      ['fatores.csv', 'data;IBOV;CDI;USDBRL;DI;NTNB;UST10;BRENT;SPX;EEM\n2026-10-31;;;;;;;;;\n'],
      ['carteira_efetiva.csv', 'carteira;ticker;peso\ncresc-mod;LFTB11;\n'],
      ['fluxos.csv', 'data;patrimonio;fluxo\n2026-10-31;;0\n'],
      ['liquidez.csv', 'ticker;adtv\nITSA4;\n'],
      ['composicao.csv', 'etf;ativo;peso;pais;setor\nVWRA;;;;\n']
    ];
    if (STORE.downloads) { A.download('modelos_importacao.txt', t.map(function (x) { return '=== ' + x[0] + ' ===\n' + x[1]; }).join('\n'), 'text/plain'); return; }
    t.forEach(function (x, i) { setTimeout(function () { A.download(x[0], x[1], 'text/csv;charset=utf-8'); }, i * 250); });
  }
  async function exportarPacote() {
    var s = await STORE.series(), tabs = {};
    for (var i = 2; i < TIPOS.length; i++) tabs[TIPOS[i][0]] = await STORE.tabela(TIPOS[i][0]);
    var col = {}; ['propostas', 'aprovadas', 'versoes', 'decisoes', 'teses', 'config', 'reunioes', 'auditoria'].forEach(function (c) { col[c] = STORE.list(c); });
    A.download('oregon_pacote_' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({formato: 'oregon-pm-v2', gerado: new Date().toISOString(), series: s, tabelas: tabs, colecoes: col}), 'application/json');
  }
  async function importarPacote(j) {
    if (!j || j.formato !== 'oregon-pm-v2') throw new Error('formato desconhecido');
    var add = {}; Object.keys(j.series || {}).forEach(function (k) { add[k] = (j.series[k].pts || []).filter(function (p) { return C.parseDate(p[0]) && isFinite(Number(p[1])); }); });
    if (Object.keys(add).length) await STORE.saveSeries(add, {fonte: 'pacote', arquivo: 'pacote ' + (j.gerado || '')});
    for (var k in (j.tabelas || {})) if (j.tabelas[k]) await STORE.saveTabela(k, j.tabelas[k]);
    var cols = j.colecoes || {};
    for (var c in cols) { if (['propostas', 'versoes', 'decisoes', 'teses', 'reunioes'].indexOf(c) < 0) continue; for (var i = 0; i < cols[c].length; i++) { var o = cols[c][i]; if (o && o.id && !STORE.get(c, o.id)) await STORE.put(c, o.id, o); } }
    await STORE.audit('pacote importado', (j.gerado || ''));
  }

  /* ---------- metodologia ---------- */
  function p() { return h.apply(null, ['p', null].concat(Array.prototype.slice.call(arguments))); }
  var M = A.MTD;
  M.validacao = function () { return h('div', null, h('h3', null, 'Motor de validação'), p('Verifica, em cada versão de carteira: soma dos ativos (R3), soma dos pilares (R2), soma interna e por pilar (R1), lacunas de implementação, bandas (R7), cadastro (R4), tickers históricos (R5), duplicações e sobreposições (R6), limites por posição, emissor e setor (R7), placeholders (R8), perfil × composição (R9) e dados, sensibilidade e liquidez (R10).'), p('Tolerância de arredondamento: 0,05 p.p. Gravidade: crítico bloqueia análises estatísticas; alto e médio marcam a análise como parcial ou registram desvio; info avisa o que não pôde ser verificado.'), p('Nenhuma carteira é normalizada para 100%. Os cenários somam as contribuições das posições como estão e dizem quanto ficou fora.')); };
  M.concentracao = function () { return h('div', null, h('h3', null, 'Concentração'), p('HHI = Σ sᵢ², com sᵢ = peso da posição ÷ soma das posições investíveis. Número efetivo = 1 ÷ HHI.'), p('Número efetivo por risco = 1 ÷ Σ cᵢ², em que cᵢ é a fatia da volatilidade de cada posição (contribuição ao risco). Precisa de séries.'), p('Placeholders e lacunas não entram: não são instrumentos.')); };
  M.fatores = function () { return h('div', null, h('h3', null, 'Exposições a fatores'), p('Agregado = Σ peso × sensibilidade. Renda fixa: duration modificada por curva (Selic, pré, real, Treasuries) e spread duration. Ações: β ao Ibovespa e sensibilidades residuais a juros, dólar e Brent. FIIs: β e duration de juro real. Exterior: cargas em S&P, emergentes e bitcoin, mais exposição cambial.'), p('Origem: “Hipótese IA” são os valores iniciais escritos pela IA; “Premissa do gestor” são os editados e salvos; “Estimada” vem de regressão mensal (MQO) em séries importadas, com t, n e R².')); };
  M.financiamento = function () { return h('div', null, h('h3', null, 'Financiamento das mudanças'), p('Reduzir um ativo: o aumento sai daquele ativo. Pro rata: sai das outras posições do pilar na proporção dos pesos (placeholders não financiam). Aporte novo de Δ: pesos viram wᵢ ÷ (1 + Δ) e o ativo comprado (w + Δ) ÷ (1 + Δ), com Δ = (alvo − w) ÷ (1 − alvo). Sem contrapartida: a soma fica aberta até você fechar.'), p('Cada movimento fica registrado na proposta com a origem do dinheiro.')); };
  M.antesdepois = function () { return h('div', null, h('h3', null, 'Antes × depois'), p('Antes é a aprovada vigente; depois, a proposta. Exposições e pilares vêm dos pesos. Volatilidade, contribuição ao risco, Expected Shortfall e tracking error vêm das séries importadas e só aparecem quando há dado suficiente. Tracking error = √((w_p − w_a)′Σ(w_p − w_a)) anualizado.'), p('Retorno esperado = Σ peso × retorno esperado cadastrado pelo gestor; mostra a cobertura quando falta premissa.')); };
  M.sizing = function () { return h('div', null, h('h3', null, 'Dimensionamento'), p('Δσ exato = σ(w′) − σ(w) com a mesma covariância. Risco marginal ∂σ/∂wᵢ = (Σw)ᵢ ÷ σ. Fatia do risco = wᵢ(Σw)ᵢ ÷ σ².'), p('Cenários da tese: E[r] = Σ pₖ rₖ, com Σ pₖ = 100%. Perda no pior cenário = peso × pior retorno (ex.: 3% × −40% = −1,2 p.p.). Peso máximo pela perda tolerada = perda tolerada ÷ |pior retorno|.'), p('Preço teto, preço justo, valor intrínseco, retorno esperado e margem de segurança são tratados separadamente; o upside até o teto não dimensiona posição sozinho.')); };
  M.custo = function () { return h('div', null, h('h3', null, 'Custo de oportunidade'), p('Resultado esperado da troca = Δw × (E[r] comprado − E[r] vendido) − custos de transação (compra e venda, em bps) − imposto estimado sobre o valor vendido. Só aparece com retornos esperados informados.')); };
  M.risco = function () { return h('div', null, h('h3', null, 'Modelo de risco'), p('Retornos simples na frequência comum às séries (diária, semanal ou mensal, pela série mais espaçada), com amostra listwise (todas as séries na mesma data). Ativos em dólar viram reais por (1 + r)(1 + Δcâmbio) − 1 com a série USDBRL. UCITS sem série podem usar a série do ETF americano par (marcado “proxy”): a aproximação ignora diferença de domicílio, tributação, custo e moeda de negociação.'), p('Covariância amostral (n − 1) ou encolhida de Ledoit-Wolf para a identidade escalada. σ = √(w′Σw); contribuição CTRᵢ = wᵢ(Σw)ᵢ ÷ σ, que soma σ.'), p('VaR histórico = −quantil (tipo 7) dos retornos da carteira; ES histórico = média dos retornos abaixo desse quantil, calculado sobre perdas da carteira. Horizonte = frequência dos dados; não há escala por √t. Paramétricos assumem normalidade e subestimam caudas. Mínimo de 30 observações para VaR/ES histórico.'), p('Limitações: correlações e volatilidades mudam no estresse; ativos ilíquidos ou marcados na curva parecem menos voláteis do que são; pesos constantes (rebalanceados todo período).')); };
  M.otim = function () { return h('div', null, h('h3', null, 'Otimização'), p('Mínima variância: min w′Σw + τ‖w − w₀‖². Média-variância: max μ′w − (γ/2)w′Σw − τ‖w − w₀‖². Restrições: soma igual à parte otimizada, 0 ≤ w ≤ máximo, bandas de pilar (descontado o peso fixo). Gradiente projetado com passo 1/L e projeção de Dykstra.'), p('Paridade de risco: contribuições iguais, sem limites. Pesos iguais e atual servem de comparação.'), p('Sensibilidade: refaz com covariância amostral × encolhida e com cada retorno esperado ±1 p.p.; a faixa mostra quanto o peso depende das estimativas. O resultado nunca vira ordem: no máximo uma proposta.')); };
  M.choques = function () { return h('div', null, h('h3', null, 'Motor de choques (instantâneo)'), p('Renda fixa: ΔP/P ≈ −D × Δy (1ª ordem). O termo ½·C·Δy² só entra se a convexidade C estiver cadastrada; o motor nunca usa D² como convexidade. Spread: −SD × Δs.'), p('Ações: β × Ibovespa + j × ΔDI + u × Δdólar + b × ΔBrent, em que j, u e b são sensibilidades residuais (além do β). Assim, um cenário que mexe em bolsa e juros juntos não conta o juro duas vezes.'), p('FIIs: β × Ibovespa − D_real × Δjuro real. Exterior: cargas em S&P, emergentes e bitcoin, em dólar.'), p('Câmbio: r_BRL = (1 + r_local)(1 + r_dólar) − 1. Exemplo: −10% em dólar com dólar +10% = −1%.'), p('Unidades: juros em p.p. (1 = 100 bps); preços em %. Contribuição = peso × retorno, sem normalizar. Placeholders, fundos sem marcação e ativos sem sensibilidade ficam fora e aparecem como descobertos, não como risco zero.'), p('O choque instantâneo é separado de carrego, proventos, valor fundamental, custos e impostos.')); };
  M.horizonte = function () { return h('div', null, h('h3', null, 'Reação imediata × horizonte'), p('O preço muda hoje pelo motor de choques (−D × Δy, menos a spread duration × Δspread; convexidade só se cadastrada). Daí em diante o título rende Δy a mais por ano (mais Δspread, nos que têm spread). Em relação a não ter o choque, a diferença no horizonte H é ≈ preço de hoje + carrego extra × H, e a perda é recuperada em ≈ |preço| ÷ carrego extra (cerca de D anos quando só a curva se move).')); };
  M.historico = function () { return h('div', null, h('h3', null, 'Cenários históricos'), p('Retorno = preço no último dia útil até o fim ÷ preço no primeiro dia útil a partir do início − 1, por ativo, com as séries importadas. Ativos em dólar convertidos pelo USDBRL do mesmo período. Se a série começa mais de 7 dias depois do início ou termina mais de 7 dias antes do fim, o ativo fica fora.')); };
  M.correl = function () { return h('div', null, h('h3', null, 'Correlações'), p('Pearson sobre retornos (nunca sobre retornos acumulados de 12 meses). Spearman sobre postos, menos sensível a outliers. Cada par usa as datas que os dois têm; com menos de 20 observações o par fica em branco. Retornos em reais.'), p('Janelas de 3 a 60 meses conforme o histórico. Com dados mensais, 3 e 12 meses não atingem o mínimo e aparecem vazias por desenho.')); };
  M.estresse = function () { return h('div', null, h('h3', null, 'Diversificação no estresse'), p('Seleciona os 10% piores períodos da carteira (posições com série, ponderadas pelos pesos da versão) e compara a correlação média entre pares nesses períodos com a de todos os períodos.')); };
  M.perf = function () { return h('div', null, h('h3', null, 'Atribuição de performance'), p('Contribuição de cada ativo = peso no início × retorno no período (buy-and-hold); a soma é o retorno da carteira no período, conciliado na tabela.'), p('Brinson-Fachler por pilar contra o benchmark (base 30/10 ou estratégica): alocação = (wp − wb)(rb_pilar − Rb), seleção = wb(rp_pilar − rb_pilar), interação = (wp − wb)(rp_pilar − rb_pilar). A soma é igual a Rp − Rb.'), p('Câmbio: r_BRL = r_local + r_câmbio + r_local × r_câmbio. Proventos = retorno da série ajustada − retorno da série só de preço, quando as duas existem.'), p('TWR encadeia subperíodos e elimina o efeito dos fluxos; MWR é a TIR dos fluxos do investidor.')); };
  M.mercado = function () { return h('div', null, h('h3', null, 'Mercado ao vivo'),
    p('Duas origens. (1) O robô no GitHub, que roda a cada 30 minutos em dias úteis e grava um arquivo público com: Selic, CDI, IPCA e PTAX (Banco Central), Focus (Banco Central), taxas do Tesouro Direto (Tesouro Transparente), Treasuries de 2 e 10 anos (Tesouro dos EUA), dólar (AwesomeAPI), Ibovespa, S&P 500, EEM, Brent, bitcoin e as cotações dos ativos (Yahoo Finance, com brapi e CoinGecko como reserva) e as manchetes do Google Notícias. (2) Consultas diretas do navegador ao Banco Central e ao câmbio, sem chave. Quando as duas têm o mesmo dado, vale o mais recente.'),
    p('Variação: contra o fechamento anterior. Juros em pontos percentuais (taxa de hoje − taxa anterior), preços em %. A curva prefixada usa o Tesouro Prefixado 2032 e o juro real, o Tesouro IPCA+ 2035 (taxas de compra), como aproximação do DI e da NTN-B. Cotações do Yahoo têm atraso de cerca de 15 minutos; o bitcoin pela CoinGecko é variação de 24 horas.'),
    p('Alerta: variação em módulo maior ou igual ao limite; “forte” a partir de duas vezes o limite. Cada movimento gera um aviso só, repetido apenas se ficar mais forte ou mudar de sinal.'),
    p('Carteira na sessão. Realizado = soma de peso × variação do dia só nas posições com cotação datada na sessão, sem normalizar; ativos em dólar viram reais por (1 + r)(1 + Δdólar) − 1; UCITS usam o ETF americano par. Motor = os movimentos do dia aplicados às premissas, com a diferença entre o preço real e o motor como choque específico de cada ativo cotado.'),
    p('Reunião automática: quando surge alerta de fator ou de ativo, o painel monta na Sala a reunião do dia com o cenário base igual aos movimentos reais (estresse = 80% a mais ou o contrário, o que for pior; alívio = devolução de 60%) e, se ligado, usa esse cenário como cenário ativo. É leitura por regras, não decisão do Comitê.'),
    p('Limites da plataforma: no link do claude.ai a página não acessa a internet; os dados ao vivo funcionam no arquivo aberto no computador. Nenhuma chave fica no painel.')); };
  M.sala = function () { return h('div', null, h('h3', null, 'Sala de Gestão'), p('Dez passos: fato e fonte; confirmado × interpretação; fatores afetados; cenário de referência; hipóteses de revisão (três cenários com probabilidades que somam 100%); impactos pelo motor; posições mais sensíveis; antes × depois; proposta de ação ou monitoramento; registro de aprovação ou rejeição.'), p('Research, Risk Officer, Portfolio Manager e Consultoria são estruturas de análise executadas pela IA, não especialistas independentes. O parecer da IA nunca muda a carteira: só uma proposta aprovada por pessoas muda.'), p('Os números de impacto são do motor de choques desta página, com as premissas vigentes. A IA não recebe a carteira efetiva importada.')); };

  A.abrirMetodologia = function () {
    var keys = [['validacao', 'Validação'], ['choques', 'Motor de choques'], ['horizonte', 'Horizonte da renda fixa'], ['risco', 'Modelo de risco'], ['correl', 'Correlações'], ['estresse', 'Diversificação no estresse'], ['concentracao', 'Concentração'], ['fatores', 'Fatores'], ['sizing', 'Dimensionamento'], ['custo', 'Custo de oportunidade'], ['otim', 'Otimização'], ['historico', 'Cenários históricos'], ['perf', 'Performance'], ['sala', 'Sala de Gestão'], ['financiamento', 'Financiamento']];
    A.drawer('Metodologia', h('div', null, h('p', null, 'Fórmulas e premissas de cada número. Origem dos dados: ', A.ochip('obs'), ' observado com fonte e data · ', A.ochip('e'), ' estimado em séries · ', A.ochip('gestor'), ' premissa do gestor · ', A.ochip('ia'), ' hipótese gerada por IA.'), keys.map(function (k) { return A.more(k[1], M[k[0]]()); })));
  };
})(APP, CORE);
