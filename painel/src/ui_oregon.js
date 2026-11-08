/* OREGON — liga o conteúdo coletado aos ativos, setores e fatores de risco das 15 carteiras (pesos aprovados, nunca presumidos).
   Fichas de empresas e ETFs sem cotação: tese, documentos oficiais, resultados da CVM, conteúdo relacionado e a opinião da casa. */
(function (A, C, I) {
  'use strict';
  var h = A.h, S = A.S;
  var EMP = {t: null, f: 'Todos', setor: null};

  /* ---------- utilidades da carteira ---------- */
  function pesosDoAtivo(t, ids) {
    var al = C.D.aliases || {};
    return C.CARTS.filter(function (c) { return !ids || ids.indexOf(c.id) >= 0; }).map(function (c) { var v = STORE.aprovadaVigente(C, c.id); return {m: c, w: C.sum((v.pos || []).filter(function (x) { return x.w > 0 && (x.t === t || (al[x.t] && al[x.t].para === t)); }), function (x) { return x.w; })}; })
      .filter(function (x) { return x.w > 0; }).sort(function (a, b) { return b.w - a.w; });
  }
  A.pesosDoAtivo = pesosDoAtivo;
  A.ehETF = function (t) { var a = C.ATV[t]; return !!a && (/ETF/.test(a.tipo || '') || t === 'CYPRESS'); };
  function ativosDasCarteiras() { return Object.keys(C.ATV).filter(function (t) { return C.ATV[t].status !== 'placeholder'; }); }
  function conteudoDe(t) { return I.doAtivo(A.itens(), t); }
  function ehGlobal(t) { var a = C.ATV[t] || {}; return /^P(9|1[0-3])$/.test(a.pilar || '') || a.moeda === 'USD'; }
  A.ehGlobal = ehGlobal;
  // Painel de notícias ao lado da ficha: notícias do ativo (portais + busca específica), opiniões a favor e contra,
  // documentos oficiais da CVM e o que se fala do setor/tema. Tudo com data, hora e veículo; ↗ abre a matéria original.
  var NP = {};
  function buscaDe(t) { var b = (I.TX.buscas || {})[t], a = C.ATV[t] || {}; return b || ('"' + (a.nome || t) + '" OR ' + t); }
  function linksBusca(t) {
    var q = buscaDe(t), a = C.ATV[t] || {};
    var g = 'https://news.google.com/search?q=' + encodeURIComponent(q + ' when:7d') + '&hl=pt-BR&gl=BR&ceid=BR:pt-419';
    var b = 'https://www.bing.com/news/search?q=' + encodeURIComponent(q.replace(/"/g, '').split(' OR ')[0]) + '&qft=sortbydate%3d%221%22';
    return h('p', {class: 'np-links'}, 'Buscar agora: ', h('a', {href: g, target: '_blank', rel: 'noopener'}, 'Google Notícias ↗'), ' · ', h('a', {href: b, target: '_blank', rel: 'noopener'}, 'Bing Notícias ↗'),
      (I.TX.cvm || {})[t] ? [' · ', h('a', {href: 'https://www.rad.cvm.gov.br/ENET/frmConsultaExternaCVM.aspx', target: '_blank', rel: 'noopener', title: 'Consulta de documentos das companhias na CVM'}, 'CVM ↗')] : null);
  }
  function lista(t, chave, l, max) {
    var k = t + ':' + chave, n = NP[k] || max;
    return h('div', null, h('ul', {class: 'nls'}, l.slice(0, n).map(A.itemLinha)),
      l.length > n ? h('button', {class: 'btn link', onclick: function () { NP[k] = n + 12; A.rerender(); }}, 'Mostrar mais ' + Math.min(12, l.length - n)) : null);
  }
  function opinioesBox(t, c) {
    var o = c.opinioes, box = h('div', {class: 'np-op'});
    box.appendChild(h('h4', {class: 'np-sub'}, 'Opiniões publicadas' + (o.total ? ' · ' + o.total : '')));
    if (!o.total) { box.appendChild(h('p', {class: 'muted'}, 'Nenhuma opinião de casa de análise ou de analistas nas manchetes lidas nos últimos dias.')); return box; }
    function col(k, tit) {
      var l = o[k];
      return h('div', {class: 'op-col op-' + k}, h('b', null, tit + ' · ' + l.length), l.length ? h('ul', {class: 'nls'}, l.slice(0, 5).map(A.itemLinha)) : h('p', {class: 'muted'}, 'Nenhuma no período.'));
    }
    box.appendChild(h('div', {class: 'op-grid'}, col('favoravel', 'A favor'), col('contraria', 'Contra')));
    if (o.favoravel.length + o.contraria.length && (!o.favoravel.length || !o.contraria.length)) box.appendChild(h('p', {class: 'hint op-sem'}, 'Não há contraponto documentado: nas fontes lidas só há opiniões ' + (o.favoravel.length ? 'a favor' : 'contra') + '.'));
    if (o.outras.length) box.appendChild(A.more('Neutras ou sem sentido explícito no título (' + o.outras.length + ')', h('ul', {class: 'nls'}, o.outras.slice(0, 8).map(A.itemLinha))));
    box.appendChild(h('p', {class: 'hint'}, 'O sentido é lido do título público; o relatório da casa não é acessível. Opinião de terceiros, para pesquisa — não citar em material de cliente.'));
    return box;
  }
  function noticiasPainel(t) {
    var c = conteudoDe(t), a = C.ATV[t] || {}, etf = A.ehETF(t), box = h('div', {class: 'np'});
    var noticias = c.noticias.filter(function (x) { return x.natureza !== 'opiniao_casa'; });
    var v = A.intel.versao;
    box.appendChild(h('div', {class: 'np-h'}, h('h3', null, 'Notícias de ' + t), h('span', {class: 'muted'}, v ? 'robô leu ' + I.quando({publicado_em: v.gerado_em}) : '')));
    box.appendChild(linksBusca(t));
    if (noticias.length) box.appendChild(lista(t, 'n', noticias, 10));
    else box.appendChild(h('p', {class: 'empty'}, A.intel.carregando ? 'Buscando as notícias…' : 'Nenhuma notícia sobre ' + (etf ? 'o fundo' : (a.nome || t)) + ' nos portais e na busca dos últimos dias. Use os links acima para buscar agora.'));
    box.appendChild(opinioesBox(t, c));
    if (c.oficiais.length) box.appendChild(h('div', null, h('h4', {class: 'np-sub'}, 'Documentos à CVM · ' + c.oficiais.length), lista(t, 'cvm', c.oficiais, 5)));
    if (c.tema.length) box.appendChild(h('div', null, h('h4', {class: 'np-sub'}, etf ? 'Índice e tema do ETF' : 'Setor e cadeia'),
      h('p', {class: 'hint', style: 'margin:0 0 4px'}, etf ? 'Notícias sobre o mercado que o ETF acompanha, não sobre o fundo.' : 'Notícias do setor e da cadeia que movem a empresa; não citam a empresa.'), lista(t, 'tema', c.tema, 6)));
    box.appendChild(h('p', {class: 'hint', style: 'margin-top:10px'}, 'Fontes: portais brasileiros e internacionais (RSS próprios), busca por ativo no Bing Notícias e documentos da CVM. O robô lê a cada 30 minutos; esta página se atualiza sozinha. ',
      h('button', {class: 'btn link', onclick: function () { A.go('bib', 'busca'); A.bibFiltro({ativo: t}); }}, 'Histórico na Biblioteca')));
    return box;
  }
  A.noticiasPainel = noticiasPainel;
  function brl(v) { if (v == null || !isFinite(v)) return '—'; var a = Math.abs(v); return (v < 0 ? '−' : '') + 'R$ ' + (a >= 1e9 ? A.num(a / 1e9, 1) + ' bi' : a >= 1e6 ? A.num(a / 1e6, 0) + ' mi' : A.num(a, 0)); }
  function pesosRef(t) {
    var pw = pesosDoAtivo(t), ref = A.REF.map(function (r) { return r[0]; });
    return h('p', {style: 'font-size:.92rem;margin:6px 0 12px'}, h('span', {class: 'k', style: 'margin-right:8px'}, 'Nas carteiras aprovadas'), pw.length ? pw.map(function (x, i) { var eh = ref.indexOf(x.m.id) >= 0; return h('span', null, i ? ' · ' : '', eh ? h('b', null, A.REF.filter(function (r) { return r[0] === x.m.id; })[0][1]) : x.m.rotulo, ' ', h('b', null, A.pct(x.w, 1))); }) : h('span', {class: 'muted'}, 'em nenhuma carteira aprovada'));
  }
  /* ---------- resultados da CVM (automático) ---------- */
  function lucroDe(x) { return x.lucro_controladores != null ? {v: x.lucro_controladores, rot: 'controladores'} : x.lucro != null ? {v: x.lucro, rot: 'consolidado'} : null; }
  function receitaDeVendas(x) { return /receita de venda/i.test(x && x.receita_conta || ''); }
  function resultadosBox(t, a) {
    if (a.classe === 'FIIs') return h('p', {class: 'muted'}, 'Fundos imobiliários entregam à CVM informes mensais, não ITR/DFP de companhia aberta: o robô ainda não coleta esses informes.');
    var R = A.resultadosDe ? A.resultadosDe(t === 'BBDC4' ? 'BBDC3' : t) : null;
    if (!R) return h('p', {class: 'muted'}, 'Os resultados chegam pelo robô (CVM, dados abertos).');
    if (R.carregando) return h('p', {class: 'muted'}, 'Carregando os resultados da CVM…');
    if (R.falhou) return h('p', {class: 'muted'}, 'Não foi possível baixar o arquivo de resultados agora; nova tentativa em alguns minutos. Nenhum número foi preenchido no lugar.');
    if (!R.dados) return h('p', {class: 'muted'}, 'Arquivo de resultados ainda não publicado pelo robô (a leitura da CVM é feita pelo robô de mercado da versão anterior; o arquivo existente continua publicado).');
    if (!R.emp) return h('p', {class: 'muted'}, 'Sem DRE desta empresa no arquivo da CVM' + (R.fora ? ': ' + R.fora : '') + '.');
    var tri = R.emp.trimestres || [], ano = R.emp.anuais || [], linhas = tri.slice(-5), todas = linhas.concat(ano.slice(-1));
    var ref = tri[tri.length - 1] || ano[ano.length - 1] || {}, nomeConta = ref.receita_conta || '3.01 Receita', vendas = receitaDeVendas(ref);
    var rotL = todas.some(function (x) { return x.lucro_controladores != null; }) ? 'Lucro (controladores)' : 'Lucro consolidado';
    var tb = h('table', {class: 't'}, h('thead', null, h('tr', null, h('th', null, 'Período'), h('th', {class: 'r', title: nomeConta}, 'Receita'), h('th', {class: 'r'}, rotL), vendas ? h('th', {class: 'r', title: 'lucro ÷ receita de vendas (cálculo)'}, 'Margem') : null)),
      h('tbody', null, todas.map(function (x) { var L = lucroDe(x); return h('tr', null, h('td', null, x.periodo + (x.documento === 'DFP' ? ' (ano)' : '') + (x.versao > 1 ? '*' : '')), h('td', {class: 'r num', title: x.receita === 0 ? 'A conta ' + (x.receita_conta || '3.01') + ' veio zerada no formulário' : null}, x.receita === 0 && !receitaDeVendas(x) ? '—' : brl(x.receita)), h('td', {class: 'r num'}, L ? brl(L.v) + (L.rot !== 'controladores' && rotL === 'Lucro (controladores)' ? '†' : '') : '—'), vendas ? h('td', {class: 'r num'}, receitaDeVendas(x) && x.receita > 0 && L ? A.pct(L.v / x.receita, 1) : '—') : null); })));
    var ult = tri[tri.length - 1], ant = ult ? tri.filter(function (x) { return x.periodo.slice(0, 2) === ult.periodo.slice(0, 2) && x.periodo !== ult.periodo; }).pop() : null;
    var Lu = ult && lucroDe(ult), La = ant && lucroDe(ant), comp = Lu && La && Lu.rot === La.rot ? (Lu.v > 0 && La.v > 0 ? h('span', null, h('b', {class: A.cls(Lu.v / La.v - 1)}, A.spct(Lu.v / La.v - 1, 1)), ' (cálculo com os dois valores informados)') : 'variação percentual não calculada: um dos dois trimestres teve prejuízo (' + brl(La.v) + ' → ' + brl(Lu.v) + ')') : null;
    return h('div', null, tb,
      comp ? h('p', {style: 'font-size:.9rem;margin:6px 0 0'}, 'Lucro do ' + ult.periodo + ' contra o ' + ant.periodo + ': ', comp, '.') : null,
      linhas.some(function (x) { return x.versao > 1; }) ? h('p', {class: 'hint'}, '* reapresentado pela empresa: vale a versão mais recente.') : null,
      todas.some(function (x) { return x.receita === 0 && !receitaDeVendas(x); }) ? h('p', {class: 'hint'}, '— Receita: a conta ' + (nomeConta || '3.01') + ' veio zerada no formulário (comum em holdings, cujo resultado vem de participações). É o que a empresa informou, não falha de coleta.') : null,
      todas.some(function (x) { var L = lucroDe(x); return L && L.rot !== 'controladores'; }) && rotL === 'Lucro (controladores)' ? h('p', {class: 'hint'}, '† sem a linha dos controladores no formulário: mostrado o lucro consolidado.') : null,
      h('p', {class: 'hint'}, 'DRE consolidada informada à CVM (ITR trimestral, DFP anual), versão mais recente. Fonte: ' + (R.dados.fonte || 'CVM') + ' · ' + (R.dados.licenca || '') + ' · lido em ' + A.dataBR(R.dados.gerado_em) + '.'));
  }

  /* ---------- exposição a fatores (premissas qualitativas das teses) ---------- */
  var REGULADOS = {'Energia elétrica': 'ANEEL: tarifa, revisão tarifária e renovação de concessões', 'Energia e saneamento': 'ANEEL e agências de saneamento: tarifa e concessões', 'Seguros': 'SUSEP: regras de capital e produtos', 'Bancos': 'Banco Central: capital (Basileia), compulsório e crédito', 'Bancos digitais': 'Banco Central: capital e meios de pagamento', 'Holding (Itaú)': 'Banco Central, pelo Itaú', 'Petróleo': 'ANP e política de preços de combustíveis'};
  function nivelTxt(v, lim) { if (v == null || !isFinite(v) || Math.abs(v) < 1e-9) return null; var x = Math.abs(v); return x >= lim[0] ? 'alta' : x >= lim[1] ? 'média' : 'baixa'; }
  function exposicaoBox(t, a, sen) {
    var s = sen && sen.m === 'acao' ? sen : null, f = sen && sen.m === 'fii' ? sen : null, G = {}; ((C.D && C.D.grupos) || []).forEach(function (g) { if ((g.tickers || []).indexOf(t) >= 0) G[g.id] = g; });
    var cel = function (rot, nivel, txt, k) { return h('div', {class: 'fxc'}, h('span', {class: 'k'}, rot), h('b', {class: 'lv-' + (nivel || 'nd')}, nivel || 'sem premissa'), h('div', {style: 'font-size:.86rem'}, txt), k ? h('div', {style: 'margin-top:4px'}, h('button', {class: 'btn link', style: 'font-size:.8rem', onclick: function () { A.go('bib', 'busca'); A.bibFiltro({tema: k}); }}, 'conteúdo sobre ' + I.temaNome(k).toLowerCase())) : null); };
    var j = s ? s.j : null, u = s ? s.u : null, b = s ? s.b : null;
    var jur = s ? cel('Juros', nivelTxt(j, [4, 2]), j ? (j < 0 ? 'Cai ' : 'Sobe ') + A.num(Math.abs(j), 1) + '% para cada +1 p.p. na curva prefixada, além do que o beta explica.' : 'Sem sensibilidade residual a juros nas premissas.' + (G.jur ? ' Está no grupo de ações sensíveis a juros: ' + G.jur.canal + '.' : ''), 'juros')
      : f ? cel('Juros', nivelTxt(f.d, [6, 3]), 'Duration de juro real de ' + A.num(f.d, 1) + ' anos: +1 p.p. no IPCA+ ≈ −' + A.num(f.d, 1) + '% no valor.', 'juros') : cel('Juros', null, 'Sem sensibilidade cadastrada.', 'juros');
    var cam = cel('Câmbio', nivelTxt(u, [0.4, 0.15]), u ? (u > 0 ? 'Ganha ' : 'Perde ') + A.num(Math.abs(u), 2) + '% para cada +1% no dólar (receita ou custo em dólar).' : 'Sem sensibilidade cadastrada ao dólar.', 'cambio');
    var reg = cel('Regulação', REGULADOS[a.setor] || (a.tags || []).indexOf('Regulatório') >= 0 ? 'alta' : null, REGULADOS[a.setor] || ((a.tags || []).indexOf('Regulatório') >= 0 ? 'Marcada como regulatória nas Teses.' : 'Sem regulador setorial específico relevante nas fontes do painel.'), 'regulacao');
    var com = cel('Commodities', nivelTxt(b, [0.3, 0.1]) || (a.setor === 'Papel e celulose' || a.setor === 'Agronegócio' ? 'média' : null), b ? 'Brent: ' + (b > 0 ? '+' : '−') + A.num(Math.abs(b), 2) + '% para cada +1% no petróleo.' : a.setor === 'Papel e celulose' ? 'Celulose: preço em dólar; sem elasticidade cadastrada.' : a.setor === 'Agronegócio' ? 'Grãos e insumos; sem elasticidade cadastrada.' : 'Sem exposição direta a commodities nas premissas.', 'commodities');
    return h('div', null, h('div', {class: 'fx-grid'}, jur, cam, reg, com), h('p', {class: 'hint'}, 'Alta, média ou baixa pelo tamanho da sensibilidade registrada nas premissas das teses (hipóteses qualitativas, não medições). Servem para saber que conteúdo macro ler com atenção para este ativo.'));
  }
  function setorBox(t, a) {
    var pares = Object.keys(C.ATV).filter(function (x) { var b = C.ATV[x]; return x !== t && b.status !== 'placeholder' && !A.ehETF(x) && b.setor && (b.setor === a.setor || (a.grupo_economico && b.grupo_economico === a.grupo_economico)); });
    var gr = ((C.D && C.D.grupos) || []).filter(function (g) { return (g.tickers || []).indexOf(t) >= 0; });
    gr.forEach(function (g) { (g.tickers || []).forEach(function (x) { if (x !== t && C.ATV[x] && C.ATV[x].status !== 'placeholder' && pares.indexOf(x) < 0 && !A.ehETF(x)) pares.push(x); }); });
    if (!pares.length) return h('p', {class: 'muted'}, 'Nenhuma outra empresa do mesmo setor ou canal macro nas teses.');
    return h('div', null, gr.length ? h('p', {style: 'font-size:.88rem;margin:0 0 6px'}, gr.map(function (g) { return h('span', {class: 'tag', title: g.canal}, g.nome || g.id); })) : null,
      A.table([{k: 't', t: 'Empresa', f: function (r) { return h('span', null, A.tk(r.t), ' ', h('span', {class: 'muted', style: 'font-size:.84rem'}, C.ATV[r.t].setor)); }},
        {k: 'n', t: 'Conteúdo (30 d)', r: 1}],
        pares.map(function (x) { return {t: x, n: A.itensDe(x).length}; }), {sort: 'n', onRow: function (r) { EMP.t = r.t; A.rerender(); }}));
  }

  /* ---------- opinião da casa (único preenchimento manual) ---------- */
  var RASC = {};
  function opiniaoBox(t, a) {
    var doc = STORE.get('teses', t) || {}, op = doc.opiniao || {};
    var novo = RASC[t] || (RASC[t] = {teto: op.teto || '', conviccao: op.conviccao || '', premissas: op.premissas || '', conclusao: op.conclusao || ''});
    var teto = h('input', {class: 'inp', type: 'number', step: '0.01', min: '0', value: novo.teto, placeholder: a.teto ? 'Teses: ' + A.num(a.teto, 2) : 'R$', oninput: function () { novo.teto = teto.value; }});
    var conv = h('select', {class: 'inp', onchange: function () { novo.conviccao = conv.value; }}, [['', '—'], ['alta', 'Alta'], ['media', 'Média'], ['baixa', 'Baixa']].map(function (o) { return h('option', {value: o[0], selected: novo.conviccao === o[0] || null}, o[1]); }));
    var prem = h('textarea', {class: 'inp w', style: 'min-height:70px', placeholder: 'Premissas próprias: crescimento, margens, custo de capital, cenário de juros…', oninput: function () { novo.premissas = prem.value; }}); prem.value = novo.premissas;
    var conc = h('textarea', {class: 'inp w', style: 'min-height:70px', placeholder: 'Conclusão da casa e decisão do comitê (com a data da reunião)', oninput: function () { novo.conclusao = conc.value; }}); conc.value = novo.conclusao;
    var mudou = ['teto', 'conviccao', 'premissas', 'conclusao'].some(function (k) { return String(novo[k] || '') !== String(op[k] || ''); });
    var onde = STORE.mode === 'db' ? 'no banco deste painel no claude.ai' : 'neste navegador';
    var hist = doc.opinioes || [];
    return A.sec('Opinião da casa', {hint: 'O único campo preenchido à mão. Fica salvo ' + onde + '; cada gravação guarda a anterior no histórico. Não muda carteira.', right: h('button', {class: 'btn pri', onclick: async function () {
      var reg = {teto: novo.teto === '' ? null : Number(novo.teto), conviccao: novo.conviccao || null, premissas: String(novo.premissas || '').trim(), conclusao: String(novo.conclusao || '').trim(), quando: STORE.now()};
      if (reg.teto != null && !(reg.teto > 0)) { A.toast('Preço-teto precisa ser um número positivo.'); return; }
      var d2 = C.clone(STORE.get('teses', t) || {}); if (d2.opiniao) d2.opinioes = (d2.opinioes || []).concat([d2.opiniao]).slice(-30); d2.opiniao = reg;
      await STORE.put('teses', t, d2); await STORE.audit('opinião da casa salva', t); delete RASC[t]; A.toast('Opinião da casa sobre ' + t + ' salva.'); A.render();
    }}, 'Salvar')}, [
      mudou ? h('div', {class: 'alert warn', style: 'margin-top:0;font-size:.86rem'}, 'Há alterações ainda não salvas nesta ficha.') : null,
      op.quando ? h('div', {class: 'alert ok', style: 'margin-top:0'}, h('b', null, 'Registrada em ' + A.dataBR(op.quando) + ': '), [op.teto ? 'teto da casa R$ ' + A.num(op.teto, 2) : null, op.conviccao ? 'convicção ' + {alta: 'alta', media: 'média', baixa: 'baixa'}[op.conviccao] : null].filter(Boolean).join(' · ') || 'sem teto nem convicção', op.conclusao ? h('div', {style: 'margin-top:4px'}, op.conclusao) : null) : null,
      h('div', {class: 'form', style: 'grid-template-columns:repeat(2,minmax(0,1fr))'}, h('label', {class: 'field'}, 'Preço-teto da casa (R$)', teto), h('label', {class: 'field'}, 'Convicção', conv)),
      h('label', {class: 'field'}, 'Premissas próprias', prem), h('label', {class: 'field'}, 'Conclusões e decisões do comitê', conc),
      a.teto ? h('p', {class: 'hint'}, 'Referência oficial: preço-teto das Teses de 04/11/2026, R$ ' + A.num(a.teto, 2) + (a.metodologia_teto ? ' (' + a.metodologia_teto + ')' : ' (metodologia não informada)') + '.') : null,
      hist.length ? A.more('Histórico (' + hist.length + ')', h('ul', null, hist.slice().reverse().map(function (o) { return h('li', null, A.dataBR(o.quando) + ': ' + [o.teto ? 'teto R$ ' + A.num(o.teto, 2) : null, o.conviccao ? 'convicção ' + o.conviccao : null, o.conclusao].filter(Boolean).join(' · ')); }))) : null]);
  }

  /* ---------- fichas ---------- */
  function blocoTxt(tit, conteudo) { return conteudo ? h('div', {class: 'fbloco'}, h('h3', null, tit), conteudo) : null; }
  function cabecalho(t, a, nm) {
    return h('div', {class: 'tv'}, h('p', {class: 'tv-crumb'}, (a.pilar ? a.pilar + ' · ' + (C.PIL[a.pilar] ? C.PIL[a.pilar].nome : '') + ' · ' : '') + (a.setor || a.tipo || '')), h('h2', {class: 'tv-nome', style: (nm || '').length > 60 ? 'font-size:1.45rem' : null}, nm || a.nome, h('span', {class: 'tv-tk'}, t), A.stchip(a.status), a.rec ? h('span', {class: 'tv-peso'}, a.rec) : null));
  }
  // Ficha com o painel de notícias ao lado (no celular, as notícias vêm primeiro)
  function comNoticias(t, corpo) { return h('div', {class: 'ficha-grid'}, h('aside', {class: 'ficha-news'}, noticiasPainel(t)), h('div', {class: 'ficha-main'}, corpo)); }
  function empresa(t) {
    var a = C.ATV[t]; if (!a) return h('div');
    var box = h('div'), tx = A.teseDe(t), T = tx && tx.tese, P = A.prem(), sen = P.sens[t];
    var op = (STORE.get('teses', t) || {}).opiniao;
    box.appendChild(cabecalho(t, a));
    box.appendChild(h('div', {class: 'vbox'},
      h('div', null, h('span', {class: 'k'}, 'Preço-teto (Teses)'), h('b', null, a.teto ? 'R$ ' + A.num(a.teto, 2) : '—'), h('small', null, a.teto ? (a.fonte_preco || 'Teses') + (a.metodologia_teto ? ' · ' + a.metodologia_teto : ' · metodologia não informada') : 'não informado')),
      h('div', null, h('span', {class: 'k'}, 'Teto da casa'), h('b', null, op && op.teto ? 'R$ ' + A.num(op.teto, 2) : '—'), h('small', null, op && op.teto ? 'opinião registrada em ' + A.dataBR(op.quando) : 'não registrado (Opinião da casa, abaixo)')),
      h('div', null, h('span', {class: 'k'}, 'Proventos 12 meses'), h('b', null, a.dy_12m != null ? A.pct(a.dy_12m, 1) : '—'), h('small', null, a.dy_12m != null ? 'dividend yield · ' + (a.fonte_ret || 'deck') : 'não informado')),
      h('div', null, h('span', {class: 'k'}, 'Retorno 12m (' + (a.data_ret || 'data no deck') + ')'), h('b', {class: A.cls(a.ret_12m)}, a.ret_12m != null ? A.spct(a.ret_12m, 1) : '—'), h('small', null, a.ret_12m != null ? (a.fonte_ret || '') + ' · dado do deck, não ao vivo' : 'não informado'))));
    if (a.ponto) box.appendChild(h('p', {class: 'tv-lead', style: 'margin:0 0 10px'}, h('b', null, (a.ponto_t || 'Leitura de valuation') + ': '), a.ponto));
    box.appendChild(pesosRef(t));
    var g = h('div', {class: 'grid2'}), L = h('div'), R = h('div'); g.append(L, R); box.appendChild(g);
    L.appendChild(h('div', {class: 'k', style: 'margin:4px 0 8px'}, 'Fundamentos · estrutural'));
    var fund = h('div', {class: 'tv'});
    if (T) {
      fund.append(
        blocoTxt('Tese estrutural', h('div', null, h('p', null, T.resumo), T.papel_titulo ? h('p', null, h('b', null, T.papel_titulo + '. '), T.papel) : null)),
        blocoTxt('Modelo de negócio', h('div', null, a.tese ? h('p', null, a.tese) : null, (T.fundamentos || []).length ? h('ul', null, T.fundamentos.map(function (x) { return h('li', null, h('b', null, x.titulo + ': '), x.texto); })) : null)),
        blocoTxt('Drivers', h('div', null, a.motores ? h('ul', null, a.motores.split(' · ').map(function (x) { return h('li', null, x); })) : null, (T.numeros || []).length ? h('p', {class: 'muted', style: 'font-size:.9rem'}, T.numeros.join(' ')) : null)),
        blocoTxt('Riscos', (T.riscos || []).length ? h('ul', null, T.riscos.map(function (x) { return h('li', null, h('b', null, x.titulo + ': '), x.texto); })) : (a.riscos ? h('p', null, a.riscos) : null)),
        blocoTxt('Perguntas a responder', h('div', null, T.questao ? h('p', {class: 'tv-lead'}, T.questao) : null, (T.criterios || []).length ? h('div', null, h('b', null, 'O que mudaria a tese'), h('ul', null, T.criterios.map(function (x) { return h('li', null, x); }))) : null,
          (T.indicadores || []).length || a.acompanhamos ? h('div', null, h('b', null, 'O que acompanhar'), h('ul', null, (T.indicadores || []).map(function (x) { return h('li', null, x); }).concat(a.acompanhamos ? [h('li', null, a.acompanhamos)] : []))) : null)));
      fund.appendChild(h('p', {class: 'hint'}, (T.fontes || '') + ' Texto das Teses de 30/10/2026, sem alteração. ', h('button', {class: 'btn link', onclick: function () { A.abrirTese(t); }}, 'Tese em tela cheia')));
    } else {
      fund.append(tx && tx.nota ? h('div', {class: 'alert warn'}, tx.nota) : h('p', {class: 'muted'}, 'Sem tese no documento de 30/10/2026.'),
        blocoTxt('Tese', a.tese ? h('p', null, a.tese) : null), blocoTxt('Drivers', a.motores ? h('p', null, a.motores) : null), blocoTxt('Riscos', a.riscos ? h('p', null, a.riscos) : null), blocoTxt('O que acompanhar', a.acompanhamos ? h('p', null, a.acompanhamos) : null));
    }
    L.appendChild(A.sec('A tese', null, fund));
    L.appendChild(A.sec('Exposição a juros, câmbio, regulação e commodities', null, exposicaoBox(t, a, sen)));
    R.appendChild(h('div', {class: 'k', style: 'margin:4px 0 8px'}, 'Conjuntura · o que mudou'));
    R.appendChild(A.sec('Resultados', {hint: 'Automático: dados abertos da CVM.'}, resultadosBox(t, a)));
    R.appendChild(A.sec('Setor e pares', {hint: 'Empresas do mesmo setor, grupo econômico ou canal macro nas teses, com o conteúdo coletado de cada uma.'}, setorBox(t, a)));
    box.appendChild(opiniaoBox(t, a));
    return comNoticias(t, box);
  }
  function etfInfo(t) { return (C.D && C.D.etfs && C.D.etfs[t]) || null; }
  function partes(s) {
    if (s == null || s === '') return [null, null];
    s = String(s); var m = s.match(/^R\$ ([\d.]+),(\d+)$/);
    if (m) return [brl(Number(m[1].replace(/\./g, '') + '.' + m[2])), null];
    var k = s.search(/ \(|; /); if (k > 0) return [s.slice(0, k), s.slice(k).replace(/^ \(|^; /, '').replace(/\)/g, '').replace(/\(/g, '· ')];
    return [s, null];
  }
  function barrasPct(lst) { return A.hbars((lst || []).map(function (x) { return {label: x[0], v: x[1] / 100}; }), {fmt: function (v) { return A.pct(v, 1); }, rh: 22}); }
  function fichaETF(t) {
    var a = C.ATV[t], e = etfInfo(t), box = h('div');
    box.appendChild(cabecalho(t, a, e && e.nome_completo || a.nome));
    if (!e) {
      box.appendChild(h('div', {class: 'alert warn'}, h('b', null, 'Ficha não verificada. '), 'Não encontrei os documentos oficiais deste ' + (t === 'CYPRESS' ? 'fundo' : 'ETF') + ' nas fontes públicas consultadas. Abaixo, só o que está no cadastro do painel; nada foi completado por estimativa.'));
      box.appendChild(h('dl', {class: 'kv'}, h('dt', null, 'Nome no cadastro'), h('dd', null, a.nome), h('dt', null, 'Emissor'), h('dd', null, a.emissor || '—'), a.obs ? h('dt', null, 'Observação') : null, a.obs ? h('dd', null, a.obs) : null));
      box.appendChild(pesosRef(t));
      return comNoticias(t, box);
    }
    box.appendChild(h('div', {class: 'row', style: 'gap:6px;flex-wrap:wrap;margin:-2px 0 10px'}, [e.gestora, e.ticker_bolsa, e.domicilio ? 'domicílio: ' + e.domicilio : null, e.classe_distribuicao ? (e.classe_distribuicao === 'acumula' ? 'acumula os rendimentos' : 'distribui os rendimentos') : null, e.isin ? 'ISIN ' + e.isin : null, e.cnpj ? 'CNPJ ' + e.cnpj : null].filter(Boolean).map(function (x) { return A.chip(x); })));
    if (e.aviso_cadastro) box.appendChild(h('div', {class: 'alert warn'}, h('b', null, 'Diferença entre o cadastro do painel e o fundo real. '), e.aviso_cadastro, ' O cadastro não foi alterado: a correção é decisão da mesa.'));
    var dur = e.duration && e.duration.valor != null ? e.duration : null, tx0 = partes(e.taxa_adm), pt = partes(e.patrimonio && e.patrimonio.valor != null ? String(e.patrimonio.valor) : null), du = partes(dur ? String(dur.valor) : null);
    var dtx = function (x) { return x ? (/^\d{4}-\d{2}-\d{2}$/.test(x) ? A.dataBR(x) : x) : ''; };
    box.appendChild(h('div', {class: 'vbox'},
      h('div', null, h('span', {class: 'k'}, 'Taxa total'), h('b', null, tx0[0] || '—'), h('small', null, tx0[1] || (e.taxa_adm ? 'documento da gestora' : 'não verificada'))),
      h('div', null, h('span', {class: 'k'}, 'Patrimônio'), h('b', {style: 'font-size:1.05rem'}, pt[0] || '—'), h('small', null, (pt[1] ? pt[1] + ' · ' : '') + (e.patrimonio && e.patrimonio.data ? 'em ' + dtx(e.patrimonio.data) : 'não verificado'))),
      h('div', null, h('span', {class: 'k'}, dur ? 'Duration' : 'Posições'), h('b', {style: dur ? 'font-size:1.05rem' : null}, dur ? du[0] : e.n_posicoes && e.n_posicoes.valor != null ? String(e.n_posicoes.valor) : '—'), h('small', null, dur ? (du[1] ? du[1] + ' · ' : '') + dtx(dur.data) : e.n_posicoes && e.n_posicoes.data ? 'em ' + dtx(e.n_posicoes.data) : (/Renda fixa/.test(a.classe || '') ? 'duration não publicada em fonte oficial' : 'não verificado'))),
      h('div', null, h('span', {class: 'k'}, 'Moeda'), h('b', null, e.moeda || a.moeda || '—'), h('small', null, a.moeda === 'USD' ? 'em reais, o câmbio entra por inteiro' : ''))));
    box.appendChild(pesosRef(t));
    var g = h('div', {class: 'grid2'}), L = h('div'), R = h('div'); g.append(L, R); box.appendChild(g);
    L.appendChild(h('div', {class: 'k', style: 'margin:4px 0 8px'}, 'O que é · estrutural'));
    var ed = h('div', {class: 'tv'});
    ed.append(blocoTxt('Objetivo', e.objetivo ? h('p', null, e.objetivo) : null),
      blocoTxt('Índice e metodologia', h('div', null, h('p', null, h('b', null, e.indice || 'Índice não verificado')), e.indice_metodologia ? h('p', null, e.indice_metodologia) : null, e.metodologia ? h('p', null, e.metodologia) : null)),
      blocoTxt('Papel na carteira', h('div', null, e.papel_na_carteira ? h('p', {class: 'tv-lead'}, e.papel_na_carteira) : null, C.PIL[a.pilar] && C.PIL[a.pilar].papel ? h('p', {class: 'muted', style: 'font-size:.9rem'}, 'Papel do ' + a.pilar + ' na política: ' + C.PIL[a.pilar].papel) : null)),
      blocoTxt('Fatores de risco e retorno', (e.fatores || []).length ? h('div', {class: 'row', style: 'gap:6px;flex-wrap:wrap'}, e.fatores.map(function (x) { return A.chip(x); })) : null),
      blocoTxt('Riscos (documentos oficiais)', (e.riscos || []).length ? h('ul', null, e.riscos.map(function (x) { return h('li', null, x); })) : null),
      e.distribuicao_texto ? blocoTxt('Rendimentos', h('p', null, e.distribuicao_texto)) : null,
      e.tributacao ? blocoTxt('Tributação', h('p', null, typeof e.tributacao === 'string' ? e.tributacao : (e.tributacao.texto || '') + (e.tributacao.fonte ? ' (fonte: ' + e.tributacao.fonte + ')' : ''))) : null);
    L.appendChild(A.sec('Ficha', null, ed));
    var sem = (e.semelhantes || []).filter(function (x) { return x && x.ticker; });
    if (sem.length) L.appendChild(A.sec('Comparação com semelhantes', {flush: true}, A.table([{k: 'ticker', t: 'ETF', f: function (r) { return C.ATV[r.ticker] ? h('button', {class: 'btn link', onclick: function () { A.abrirEmpresa(r.ticker); }}, r.ticker) : r.ticker; }}, {k: 'diferenca', t: 'Diferença', s: false}], sem, {sort: null})));
    R.appendChild(h('div', {class: 'k', style: 'margin:4px 0 8px'}, 'Exposições · com data'));
    var ex = e.exposicao, pp = e.principais_posicoes;
    if (ex && ((ex.paises || []).length || (ex.setores || []).length)) R.appendChild(A.sec('Países e setores', {hint: (ex.fonte || '') + (ex.data ? ' · ' + (/^\d{4}-/.test(ex.data) ? A.dataBR(ex.data) : ex.data) : '')}, h('div', null, (ex.paises || []).length ? h('div', null, h('h3', {style: 'margin-top:0'}, 'Países'), barrasPct(ex.paises)) : null, (ex.setores || []).length ? h('div', null, h('h3', null, /Quebra por tipo|tipo de emissor|tipo de ativo/.test(ex.fonte || '') ? 'Tipo de ativo' : 'Setores'), barrasPct(ex.setores)) : null)));
    else R.appendChild(A.sec('Países e setores', null, h('p', {class: 'muted'}, 'Não publicado em texto nos documentos consultados.')));
    if (pp && (pp.itens || []).length) { var top5 = C.sum(pp.itens.slice(0, 5), function (x) { return x[1]; }); R.appendChild(A.sec('Principais posições', {hint: 'Em ' + (pp.data ? A.dataBR(pp.data) : 'data não informada') + '. As 5 maiores somam ' + A.num(top5, 1) + '%.'}, barrasPct(pp.itens))); }
    R.appendChild(A.sec('Documentos oficiais', null, h('div', null,
      (e.documentos || []).filter(function (d) { return A.link(d.url); }).length ? h('ul', {class: 'docs'}, e.documentos.filter(function (d) { return A.link(d.url); }).map(function (d) { return h('li', null, h('a', {href: A.link(d.url), target: '_blank', rel: 'noopener'}, d.titulo || d.url)); })) : h('p', {class: 'muted'}, 'Sem link verificado.'),
      h('p', {class: 'hint'}, 'Consultado em ' + A.dataBR(e.consultado_em) + '. Cada número traz a data do documento de origem.'),
      e.notas ? A.more('Notas de verificação', h('p', {style: 'font-size:.9rem'}, e.notas)) : null)));
    return comNoticias(t, box);
  }
  var GLB = {t: null, f: 'Todos'};
  A.abrirEmpresa = function (t) {
    if (t === 'BBDC4' && !C.ATV.BBDC4) t = 'BBDC3';
    if (!C.ATV[t]) return;
    if (ehGlobal(t)) { GLB.t = t; GLB.f = 'Todos'; A.go('mundo', 'etfs'); } else { EMP.t = t; EMP.f = 'Todos'; EMP.setor = null; A.go('brasil', 'ativos'); }
  };
  A.abrirSetor = function (setor) { EMP.setor = setor; EMP.f = 'Todos'; EMP.t = null; A.go('brasil', 'ativos'); };
  // Ficha rápida (gaveta): últimas notícias, opiniões, resultado da CVM e a tese em uma frase — sem sair da tela
  A.abrirFicha = function (t) {
    if (t === 'BBDC4' && !C.ATV.BBDC4) t = 'BBDC3';
    var a = C.ATV[t]; if (!a) return;
    var e = etfInfo(t), tx = A.teseDe(t), T = tx && tx.tese, c = conteudoDe(t), body = h('div');
    body.appendChild(h('p', {class: 'tv-crumb'}, (a.pilar ? a.pilar + ' · ' : '') + (a.setor || a.tipo)));
    body.appendChild(h('h3', null, 'Últimas notícias'));
    body.appendChild(linksBusca(t));
    body.appendChild(A.listaLinhas(c.direto, 8, 'Nenhuma notícia recente cita ' + (A.ehETF(t) ? 'o fundo' : 'a empresa') + '.'));
    if (c.opinioes.total) body.appendChild(h('p', {class: 'muted', style: 'font-size:.88rem'}, 'Opiniões publicadas: ' + c.opinioes.favoravel.length + ' a favor · ' + c.opinioes.contraria.length + ' contra · ' + c.opinioes.outras.length + ' neutras/sem sentido explícito.'));
    if (A.ehETF(t) && c.tema.length) { body.appendChild(h('h3', null, 'Índice e tema')); body.appendChild(A.listaLinhas(c.tema, 4)); }
    if (!A.ehETF(t) && a.classe === 'Ações') {
      var slot = h('p', {style: 'font-size:.92rem'});
      var poe = function () { var R = A.resultadosDe ? A.resultadosDe(t) : null, ul = R && R.emp && (R.emp.trimestres || []).slice(-1)[0], L = ul && lucroDe(ul);
        slot.replaceChildren(R && R.carregando ? h('span', {class: 'muted'}, 'Carregando o último resultado da CVM…') : ul ? h('span', null, h('b', null, 'Último resultado na CVM (' + ul.periodo + '): '), 'receita ' + brl(ul.receita) + (L ? ', lucro ' + (L.rot === 'controladores' ? 'dos controladores ' : 'consolidado ') + brl(L.v) : '') + '.') : h('span', {class: 'muted'}, R && R.falhou ? 'Resultados da CVM indisponíveis agora.' : 'Sem resultado da CVM no arquivo do robô.'));
        return R; };
      var R0 = poe(); if (R0 && R0.carregando && R0.promessa) R0.promessa.then(poe);
      body.appendChild(slot);
    }
    body.appendChild(h('h3', null, A.ehETF(t) ? 'O que é' : 'A tese em uma frase'));
    body.appendChild(h('p', null, A.ehETF(t) ? (e ? e.objetivo : 'Ficha não verificada.') : (T ? T.resumo : a.tese || 'Sem tese no documento.')));
    body.appendChild(pesosRef(t));
    body.appendChild(h('div', {class: 'row', style: 'margin-top:12px'}, h('button', {class: 'btn pri', onclick: function () { d.remove(); A.abrirEmpresa(t); }}, 'Ficha completa com notícias'), T ? h('button', {class: 'btn', onclick: function () { d.remove(); A.abrirTese(t); }}, 'Tese completa') : null));
    var d = A.drawer(t + ' · ' + (e && e.nome_completo || a.nome), body);
    return d;
  };

  /* ---------- lista de ativos + ficha (Brasil e ETFs globais) ---------- */
  var SEM = 7 * 24 * 3600 * 1000;
  function recente(x) { var p = x.publicado_em; if (!p) return false; var t = Date.parse(p.length <= 10 ? p + 'T12:00:00-03:00' : p); return isFinite(t) && Date.now() - t <= SEM; }
  function listaComFicha(st, grupos, base, cab) {
    var wrap = h('div');
    wrap.appendChild(cab);
    var fx = A.intelFaixa(); if (fx) wrap.appendChild(fx);
    var gf = grupos.filter(function (x) { return x[0] === st.f; })[0] || grupos[0];
    var lista = base.filter(function (t) { var a = C.ATV[t]; return (!gf[1] || gf[1](a, t)) && (!st.setor || a.setor === st.setor); });
    var rows = lista.map(function (t) {
      var a = C.ATV[t], c = conteudoDe(t), ult = c.direto[0];
      return {t: t, nome: a.nome, setor: a.setor, p: a.pilar, n7: c.direto.filter(recente).length, op: c.opinioes.total, ult: ult ? I.pub(ult) : '', ultX: ult, nt: c.tema.filter(recente).length};
    });
    rows.sort(function (x, y) { return (y.ult || '').localeCompare(x.ult || '') || x.t.localeCompare(y.t); });
    if (!st.t || lista.indexOf(st.t) < 0) st.t = rows.length ? rows[0].t : null;
    var fsel = h('div', {class: 'sub', style: 'margin:0 0 8px'}, grupos.map(function (x) { return h('button', {'aria-pressed': st.f === x[0] && !st.setor ? 'true' : 'false', onclick: function () { st.f = x[0]; st.setor = null; st.t = null; A.render(); }}, x[0]); }),
      st.setor ? h('button', {'aria-pressed': 'true', title: 'Tirar o filtro de setor', onclick: function () { st.setor = null; A.render(); }}, 'Setor: ' + st.setor + ' ✕') : null);
    var g = h('div', {class: 'grid-emp'}), L = h('div', {class: 'sticky'}), R = h('div'); g.append(L, R); wrap.appendChild(g);
    L.appendChild(A.sec('Ativos · notícias dos últimos 7 dias', {flush: true}, [h('div', {style: 'padding:0 18px'}, fsel), A.table([
      {k: 't', t: 'Ativo', f: function (r) { return h('span', null, h('b', null, r.t), h('div', {class: 'muted', style: 'font-size:.8rem'}, (r.p ? r.p + ' · ' : '') + (r.setor || r.nome) + (r.op ? ' · ' + r.op + (r.op > 1 ? ' opiniões' : ' opinião') : ''))); }, s: function (r) { return +(r.p || 'P99').slice(1) * 1000 + r.t.charCodeAt(0); }},
      {k: 'n7', t: 'Notícias', r: 1, title: 'Notícias que citam o ativo nos últimos 7 dias (entre parênteses: do setor ou do tema)', f: function (r) { return r.n7 ? h('b', null, String(r.n7)) : h('span', {class: 'muted', title: r.nt ? r.nt + ' sobre o setor ou o tema' : null}, r.nt ? '0 (+' + r.nt + ')' : '0'); }},
      {k: 'ult', t: 'Última', f: function (r) { return r.ultX ? h('span', {class: 'nw-when'}, I.quando(r.ultX)) : h('span', {class: 'muted'}, '—'); }}
    ], rows, {sort: null, search: 'Filtrar', onRow: function (r) { st.t = r.t; A.rerender(); }, rowClass: function (r) { return r.t === st.t ? 'sel' : null; }})]));
    R.appendChild(st.t ? (A.ehETF(st.t) ? fichaETF(st.t) : empresa(st.t)) : h('p', {class: 'empty'}, 'Nenhum ativo neste filtro.'));
    return wrap;
  }

  /* ---------- Brasil ---------- */
  var GRUPOS_BR = [['Todos', null], ['Ações', function (a) { return a.classe === 'Ações'; }], ['FIIs', function (a) { return a.classe === 'FIIs'; }], ['ETFs renda fixa', function (a, t) { return A.ehETF(t); }]];
  A.SUBS.brasil = [['ativos', 'Ativos brasileiros']];
  A.areas.brasil = function () {
    var base = ativosDasCarteiras().filter(function (t) { return !ehGlobal(t); });
    return listaComFicha(EMP, GRUPOS_BR, base, A.pageHead('Brasil · ativos das 15 carteiras', 'Brasil', 'Cada ativo com as últimas notícias ao lado (portais, busca específica e CVM), opiniões a favor e contra, a tese e os documentos. Os ativos com notícia mais recente aparecem primeiro.',
      h('button', {class: 'btn', onclick: function () { var d = A.drawer('Teses da Carteira Oregon · visão geral', A.tesesOregon()); d.classList.add('wide'); }}, 'Visão geral das teses')));
  };

  /* ---------- Mundo e Estratégia ---------- */
  var MUN = {reg: 'tudo', max: 20, cat: 'todas', cmax: 20};
  var REGS = [['tudo', 'Tudo'], ['eua', 'EUA'], ['china', 'China'], ['europa', 'Europa'], ['emergentes', 'Emergentes'], ['japao', 'Japão']];
  var CATS = [['todas', 'Tudo', ['gestora_internacional', 'gestora_brasil', 'instituicao', 'academia', 'youtube']], ['gestora_internacional', 'Gestoras internacionais', ['gestora_internacional']], ['gestora_brasil', 'Gestoras brasileiras', ['gestora_brasil']],
    ['instituicao', 'Bancos centrais e instituições', ['instituicao']], ['academia', 'Acadêmico e educacional', ['academia', 'youtube']]];
  function mundoAgora() {
    var wrap = h('div'), itens = A.itens();
    wrap.appendChild(A.pageHead('Mundo e Estratégia', 'O que o mundo está falando', 'Imprensa internacional, bancos centrais e as buscas por tema dos ETFs globais, da mais nova para a mais antiga. Atualiza a cada 30 minutos.'));
    var fx = A.intelFaixa(); if (fx) wrap.appendChild(fx);
    var mundo = I.ultimas(itens, {horas: 96, filtro: 'mundo'});
    // temas dos ETFs globais com notícia recente
    var globais = ativosDasCarteiras().filter(function (t) { return ehGlobal(t) && A.ehETF(t); }), temas = {};
    mundo.forEach(function (x) {
      var et = (x.etfs_tema || []).filter(function (t) { return globais.indexOf(t) >= 0; }); if (!et.length) return;
      var nm = x.tema_etf || (x.temas_etf || [])[0] || et[0];
      var g = temas[nm] = temas[nm] || {nome: nm, itens: [], etfs: {}}; g.itens.push(x); et.forEach(function (t) { g.etfs[t] = 1; });
    });
    var tl = Object.keys(temas).map(function (k) { return temas[k]; }).sort(function (a, b) { return b.itens.length - a.itens.length; });
    if (tl.length) wrap.appendChild(A.sec('Temas dos ETFs globais', {hint: 'Notícias sobre o índice e o mercado de cada ETF global das carteiras (não são fatos do fundo). Toque na manchete para a análise.'},
      h('div', {class: 'tt-grid'}, tl.map(function (g) { var x = g.itens[0];
        return h('div', {class: 'tt'}, h('div', {class: 'tt-h'}, h('b', null, g.nome), h('span', {class: 'muted'}, g.itens.length + (g.itens.length > 1 ? ' notícias' : ' notícia'))),
          h('p', null, h('time', {class: 'nw-when'}, I.quando(x)), ' ', h('button', {class: 'nwl', onclick: function () { A.abrirItem(x); }}, x.titulo), h('span', {class: 'muted'}, ' · ' + (x.via ? x.fonte : x.organizacao || x.fonte))),
          h('div', {class: 'nw-tags'}, Object.keys(g.etfs).slice(0, 4).map(function (t) { return h('button', {class: 'tag tk', onclick: function () { A.abrirFicha(t); }}, t); })));
      }))));
    var cont = {}; REGS.forEach(function (r) { cont[r[0]] = r[0] === 'tudo' ? mundo.length : mundo.filter(function (x) { return (x.regioes || []).indexOf(r[0]) >= 0; }).length; });
    var lst = MUN.reg === 'tudo' ? mundo : mundo.filter(function (x) { return (x.regioes || []).indexOf(MUN.reg) >= 0; });
    var barra = h('div', {class: 'sub filt', role: 'toolbar', 'aria-label': 'Filtrar por região'}, REGS.map(function (r) { return h('button', {'aria-pressed': MUN.reg === r[0] ? 'true' : 'false', disabled: !cont[r[0]] && r[0] !== 'tudo' ? true : null, onclick: function () { MUN.reg = r[0]; MUN.max = 20; A.rerender(); }}, r[1] + (cont[r[0]] ? ' · ' + cont[r[0]] : '')); }));
    wrap.appendChild(A.sec('Últimas do mundo', {id: 'mundo-ultimas', hint: 'Últimas 96 horas. ↗ abre a matéria original.'}, h('div', null, barra,
      lst.length ? h('div', null, A.listaItens(lst, {max: MUN.max, semResumo: true}), lst.length > MUN.max ? h('p', {style: 'text-align:center'}, h('button', {class: 'btn', onclick: function () { MUN.max += 20; A.rerender(); }}, 'Mostrar mais')) : null)
        : h('p', {class: 'empty'}, A.intel.carregando ? 'Buscando…' : 'Nada desta região nas últimas 96 horas.'))));
    return wrap;
  }
  function mundoCartas() {
    var wrap = h('div'), itens = A.itens();
    wrap.appendChild(A.pageHead('Mundo e Estratégia', 'Cartas, research e conteúdo educacional', 'O que gestoras, bancos centrais e instituições publicaram nos últimos 30 dias, do mais novo para o mais antigo. Cartas antigas sem data ficam no acervo da Biblioteca.'));
    var lim = Date.now() - 30 * 24 * 3600 * 1000;
    var base = itens.filter(function (x) { if (x.acervo || x.agrupado_em) return false; var p = I.pub(x); return p && Date.parse(p.length <= 10 ? p + 'T12:00:00-03:00' : p) >= lim; });
    var cont = {}; CATS.forEach(function (c) { cont[c[0]] = base.filter(function (x) { return c[2].indexOf(x.categoria) >= 0; }).length; });
    var cat = CATS.filter(function (c) { return c[0] === MUN.cat; })[0] || CATS[0];
    var lst = base.filter(function (x) { return cat[2].indexOf(x.categoria) >= 0; }).sort(function (a, b) { return I.pub(b).localeCompare(I.pub(a)); });
    var barra = h('div', {class: 'sub filt', role: 'toolbar', 'aria-label': 'Filtrar por tipo de fonte'}, CATS.map(function (c) { return h('button', {'aria-pressed': MUN.cat === c[0] ? 'true' : 'false', disabled: !cont[c[0]] && c[0] !== 'todas' ? true : null, onclick: function () { MUN.cat = c[0]; MUN.cmax = 20; A.rerender(); }}, c[1] + (cont[c[0]] ? ' · ' + cont[c[0]] : '')); }));
    wrap.appendChild(A.sec('Publicações recentes', {id: 'cartas', hint: 'Toque no título para a análise em sete pontos (fato, fonte e inferência separados). ↗ abre o documento original.'}, h('div', null, barra,
      lst.length ? h('div', null, A.listaItens(lst, {max: MUN.cmax, comNivel: true}), lst.length > MUN.cmax ? h('p', {style: 'text-align:center'}, h('button', {class: 'btn', onclick: function () { MUN.cmax += 20; A.rerender(); }}, 'Mostrar mais')) : null)
        : h('p', {class: 'empty'}, A.intel.carregando ? 'Buscando…' : 'Nada publicado nos últimos 30 dias por este tipo de fonte.'))));
    return wrap;
  }
  var GRUPOS_GL = [['Todos', null], ['Renda fixa', function (a) { return /Renda fixa/.test(a.classe || ''); }], ['Ações e outros', function (a) { return !/Renda fixa/.test(a.classe || ''); }]];
  function mundoEtfs() {
    var base = ativosDasCarteiras().filter(function (t) { return ehGlobal(t); });
    return listaComFicha(GLB, GRUPOS_GL, base, A.pageHead('Mundo e Estratégia', 'ETFs globais', 'Cada ETF global das carteiras com a ficha verificada e, ao lado, o que se fala do índice e do tema. Notícia de tema não é fato do fundo.'));
  }
  A.SUBS.mundo = [['agora', 'O que o mundo fala'], ['cartas', 'Cartas e research'], ['etfs', 'ETFs globais']];
  A.areas.mundo = function () {
    var wrap = h('div'), s = S.sub.mundo;
    if (!A.SUBS.mundo.some(function (x) { return x[0] === s; })) s = S.sub.mundo = 'agora';
    wrap.appendChild(A.subnav('mundo', A.SUBS.mundo));
    wrap.appendChild(s === 'cartas' ? mundoCartas() : s === 'etfs' ? mundoEtfs() : mundoAgora());
    return wrap;
  };
})(APP, CORE, INTEL);
