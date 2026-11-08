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
  // Conteúdo do ativo: itens recentes e meses carregados + opiniões dos últimos 12 meses (biblioteca/opinioes.json)
  var CACHE = {k: null, todos: null};
  function todosItens() { var k = (A.intel.versao && A.intel.versao.gerado_em) + '|' + Object.keys(A.intel.meses || {}).length + '|' + A.opinioes12m().length + '|' + (A.itens().length); if (CACHE.k !== k) { CACHE.k = k; CACHE.todos = A.itensAtivo(); } return CACHE.todos; }
  function conteudoDe(t) { return I.doAtivo(todosItens(), t); }
  // Sem os arquivos do robô, a ausência de notícia não é informação: a tela diz que não há dados
  var SEM_DADOS = 'Sem dados do robô nesta visualização.';
  function semDados() { return !A.intel.versao && !A.itens().length; }
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
    return h('div', null, h('ul', {class: 'nls'}, l.slice(0, n).map(function (x) { return A.itemLinha(x, t); })),
      l.length > n ? h('button', {class: 'btn link', onclick: function () { NP[k] = n + 12; A.rerender(); }}, 'Mostrar mais ' + Math.min(12, l.length - n)) : null);
  }
  function opinioesBox(t, c) {
    var o = c.opinioes, box = h('div', {class: 'np-op'});
    box.appendChild(h('h4', {class: 'np-sub'}, 'Opiniões publicadas · 12 meses' + (o.total ? ' · ' + o.total : '')));
    if (!o.total) { box.appendChild(h('p', {class: 'muted np-vz'}, semDados() ? SEM_DADOS : A.intel.opinioes ? 'Nenhuma opinião de casa de análise sobre o ativo nas manchetes dos últimos 12 meses.' : 'Nenhuma opinião nas manchetes recentes. O histórico de 12 meses aparece depois da próxima rodada do robô.')); return box; }
    function col(k, tit) {
      var l = o[k], kk = 'op-' + k, n = NP[t + ':' + kk] || 5;
      return h('div', {class: 'op-col op-' + k}, h('b', null, tit + ' · ' + l.length), l.length ? h('div', null, h('ul', {class: 'nls'}, l.slice(0, n).map(function (x) { return A.itemLinha(x, t); })),
        l.length > n ? h('button', {class: 'btn link', onclick: function () { NP[t + ':' + kk] = n + 10; A.rerender(); }}, 'Mais ' + Math.min(10, l.length - n)) : null) : h('p', {class: 'muted'}, 'Nenhuma no período.'));
    }
    box.appendChild(h('div', {class: 'op-grid'}, col('favoravel', 'A favor'), col('contraria', 'Contra')));
    if (o.favoravel.length + o.contraria.length && (!o.favoravel.length || !o.contraria.length)) box.appendChild(h('p', {class: 'hint op-sem'}, 'Não há contraponto documentado: nas fontes lidas só há opiniões ' + (o.favoravel.length ? 'a favor' : 'contra') + '.'));
    if (o.outras.length) box.appendChild(A.more('Neutras ou sem sentido explícito no título (' + o.outras.length + ')', h('ul', {class: 'nls'}, o.outras.slice(0, 10).map(function (x) { return A.itemLinha(x, t); }))));
    box.appendChild(h('p', {class: 'hint'}, 'Sentido lido do título público; o relatório da casa não é acessível. Opinião de terceiros, para pesquisa — não citar em material de cliente.'));
    return box;
  }
  var SEM7 = 7 * 24 * 3600 * 1000;
  function nos7(x) { var p = x.publicado_em; if (!p) return false; var q = Date.parse(p.length <= 10 ? p + 'T12:00:00-03:00' : p); return isFinite(q) && Date.now() - q <= SEM7; }
  // Painel à direita da ficha: notícias em que o ativo é o assunto, opiniões publicadas (12 meses), documentos à CVM,
  // setor e cadeia (ou índice e tema do ETF) e, recolhidas, as menções de passagem. Hora, veículo e ↗ em todas as linhas.
  function noticiasPainel(t) {
    var c = conteudoDe(t), a = C.ATV[t] || {}, etf = A.ehETF(t), box = h('div', {class: 'np'});
    var noticias = c.noticias.filter(function (x) { return x.natureza !== 'opiniao_casa'; });
    var v = A.intel.versao, n7 = c.direto.filter(nos7).length;
    box.appendChild(h('div', {class: 'np-h'}, h('h3', null, 'Notícias de ' + t), h('span', {class: 'muted', title: 'Última coleta do robô'}, v ? 'coleta ' + I.horaAbs(v.gerado_em) : '')));
    box.appendChild(h('p', {class: 'np-cont', title: 'Empresa diretamente afetada: o ativo é o assunto. Setor e cadeia: não cita o ativo. Menção incidental: citado numa lista ou só no resumo.'}, h('b', null, String(n7)), (n7 === 1 ? ' diretamente sobre o ativo' : ' diretamente sobre o ativo') + ' em 7 dias', c.tema.length ? ' · ' + c.tema.length + (etf ? ' do tema geral' : ' de setor e cadeia') : '', c.mencoes.length ? ' · ' + c.mencoes.length + (c.mencoes.length > 1 ? ' menções incidentais' : ' menção incidental') : ''));
    box.appendChild(linksBusca(t));
    if (noticias.length) box.appendChild(lista(t, 'n', noticias, 8));
    else box.appendChild(h('p', {class: 'empty'}, A.intel.carregando ? 'Buscando as notícias…' : semDados() ? SEM_DADOS : 'Nenhuma notícia tem ' + (etf ? 'o fundo' : (a.nome || t)) + ' como assunto nos portais e na busca dos últimos dias. Use os links acima para buscar agora.'));
    box.appendChild(opinioesBox(t, c));
    if (c.oficiais.length) box.appendChild(h('div', null, h('h4', {class: 'np-sub'}, 'Documentos à CVM · ' + c.oficiais.length), lista(t, 'cvm', c.oficiais, 4)));
    if (c.tema.length) box.appendChild(h('div', null, h('h4', {class: 'np-sub'}, etf ? 'Índice e tema do ETF' : 'Setor e cadeia'),
      h('p', {class: 'hint', style: 'margin:0 0 4px'}, etf ? 'Sobre o mercado que o ETF acompanha, não sobre o fundo.' : 'Notícias do setor e da cadeia que movem a empresa; não citam a empresa.'), lista(t, 'tema', c.tema, 6)));
    if (c.mencoes.length) box.appendChild(A.more('Menções incidentais (' + c.mencoes.length + ')', h('div', null, h('p', {class: 'hint', style: 'margin:0 0 4px'}, 'Manchetes que citam ' + t + ' numa lista (dividendos da semana, destaques do dia) ou só no resumo. Não entram nos contadores.'), lista(t, 'men', c.mencoes, 8))));
    box.appendChild(h('p', {class: 'hint np-pe'}, 'Portais, busca por ativo e CVM. ', h('button', {class: 'btn link', onclick: function () { A.go('bib', 'busca'); A.bibFiltro({ativo: t}); }}, 'Histórico na Biblioteca')));
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
        {k: 'n', t: 'Diretas (7 d)', r: 1, title: 'Notícias em que a empresa é o assunto nos últimos 7 dias (menções de passagem não contam)'}],
        pares.map(function (x) { return {t: x, n: conteudoDe(x).direto.filter(nos7).length}; }), {sort: 'n', onRow: function (r) { EMP.t = r.t; A.rerender(); }}));
  }

  /* ---------- opinião da casa (único preenchimento manual) ---------- */
  var RASC = {};
  function blocoTxt(tit, conteudo) { return conteudo ? h('div', {class: 'fbloco'}, h('h3', null, tit), conteudo) : null; }
  function cabecalho(t, a, nm) {
    return h('div', {class: 'tv'}, h('p', {class: 'tv-crumb'}, (a.pilar ? a.pilar + ' · ' + (C.PIL[a.pilar] ? C.PIL[a.pilar].nome : '') + ' · ' : '') + (a.setor || a.tipo || '')), h('h2', {class: 'tv-nome', style: (nm || '').length > 60 ? 'font-size:1.45rem' : null}, nm || a.nome, h('span', {class: 'tv-tk'}, t), A.stchip(a.status), a.rec ? h('span', {class: 'tv-peso'}, a.rec) : null));
  }
  // Ficha: cabeçalho curto, painel de notícias ao lado (no celular, logo abaixo do cabeçalho) e subvisões em abas.
  // O que muda (fatos recentes, critérios da tese, opinião da casa) vem primeiro; o texto estático das Teses fica em Fundamentos.
  var FV = {v: null};
  A.fichaVista = function (v) { FV.v = v; A.rerender(); };
  function fichaLayout(t, cab, vistas, padrao, kpi) {
    var ids = vistas.map(function (x) { return x[0]; }), v = ids.indexOf(FV.v) >= 0 ? FV.v : padrao;
    var corpo = vistas.filter(function (x) { return x[0] === v; })[0][3]();
    var abas = vistas.length > 1 ? h('div', {class: 'fv', role: 'tablist', 'aria-label': 'Ficha de ' + t}, vistas.map(function (x) {
      return h('button', {role: 'tab', 'aria-selected': v === x[0] ? 'true' : 'false', 'data-v': x[0], onclick: function () { FV.v = x[0]; A.rerender(); }}, x[1], x[2] ? h('small', null, String(x[2])) : null);
    })) : null;
    return h('div', {class: 'ficha-grid'}, h('div', {class: 'ficha-head'}, cab), h('aside', {class: 'ficha-news'}, noticiasPainel(t)), kpi ? h('div', {class: 'ficha-kpi'}, kpi) : null,
      h('div', {class: 'ficha-main'}, abas, h('div', {class: 'fv-body', role: abas ? 'tabpanel' : null}, corpo)));
  }
  function li(x) { return h('li', null, x); }
  var MES30 = 30 * 24 * 3600 * 1000;
  function empresa(t) {
    var a = C.ATV[t]; if (!a) return h('div');
    var tx = A.teseDe(t), T = tx && tx.tese, P = A.prem(), sen = P.sens[t], c = conteudoDe(t);
    var cab = h('div', null, cabecalho(t, a), pesosRef(t)), kpi = h('div', null, h('div', {class: 'vbox'},
      h('div', null, h('span', {class: 'k'}, 'Preço-teto (Teses)'), h('b', null, a.teto ? 'R$ ' + A.num(a.teto, 2) : '—'), h('small', null, a.teto ? (a.fonte_preco || 'Teses') + (a.metodologia_teto ? ' · ' + a.metodologia_teto : ' · metodologia não informada') : 'não informado')),
      h('div', null, h('span', {class: 'k'}, 'Proventos 12 meses'), h('b', null, a.dy_12m != null ? A.pct(a.dy_12m, 1) : '—'), h('small', null, a.dy_12m != null ? 'dividend yield · ' + (a.fonte_ret || 'deck') : 'não informado')),
      h('div', null, h('span', {class: 'k'}, 'Retorno 12m (' + (a.data_ret || 'data no deck') + ')'), h('b', {class: A.cls(a.ret_12m)}, a.ret_12m != null ? A.spct(a.ret_12m, 1) : '—'), h('small', null, a.ret_12m != null ? (a.fonte_ret || '') + ' · dado do deck, não ao vivo' : 'não informado'))),
      a.ponto ? h('p', {class: 'tv-lead', style: 'margin:0 0 8px'}, h('b', null, (a.ponto_t || 'Leitura de valuation') + ': '), a.ponto) : null);
    function mudancas() {
      var box = h('div'), lim = Date.now() - MES30;
      var fortes = c.direto.filter(function (x) { var ev = I.vinculo(x, t).evento, p = I.pub(x), q = Date.parse(p.length <= 10 ? p + 'T12:00:00-03:00' : p); return ev && isFinite(q) && q >= lim; });
      box.appendChild(A.sec('Fatos que pedem revisão da tese', {id: 'fatos-tese', hint: 'Últimos 30 dias: resultados, documentos à CVM e mudanças de recomendação em que ' + t + ' é o assunto. Confronte com os critérios abaixo; o sistema não conclui se a tese mudou.'},
        fortes.length ? A.listaLinhas(fortes, 10, null, t) : h('p', {class: 'empty sm'}, semDados() ? SEM_DADOS : 'Nenhum resultado, documento à CVM ou mudança de recomendação sobre ' + t + ' nos últimos 30 dias.')));
      if (T) box.appendChild(A.sec('O que mudaria a tese', {hint: 'Critérios e indicadores das Teses de 30/10/2026, sem alteração.', right: h('button', {class: 'btn link', onclick: function () { A.abrirTese(t); }}, 'Tese em tela cheia')},
        h('div', {class: 'tv'}, T.questao ? h('p', {class: 'tv-lead'}, T.questao) : null, (T.criterios || []).length ? h('ul', null, T.criterios.map(li)) : null,
          (T.indicadores || []).length || a.acompanhamos ? h('div', null, h('h3', null, 'O que acompanhar'), h('ul', null, (T.indicadores || []).map(li).concat(a.acompanhamos ? [li(a.acompanhamos)] : []))) : null)));
      else box.appendChild(A.sec('O que mudaria a tese', null, h('div', null, tx && tx.nota ? h('div', {class: 'alert warn slim'}, tx.nota) : h('p', {class: 'muted'}, 'Sem tese no documento de 30/10/2026.'), a.acompanhamos ? h('p', null, h('b', null, 'O que acompanhar: '), a.acompanhamos) : null)));
      return box;
    }
    function eventos() {
      return h('div', null, A.sec('Resultados', {hint: 'Automático: dados abertos da CVM (ITR e DFP).'}, resultadosBox(t, a)),
        A.sec('Documentos à CVM', {hint: 'Fatos relevantes e comunicados entregues pela companhia.', right: h('a', {class: 'btn link', href: 'https://www.rad.cvm.gov.br/ENET/frmConsultaExternaCVM.aspx', target: '_blank', rel: 'noopener'}, 'Consulta na CVM ↗')},
          c.oficiais.length ? A.listaLinhas(c.oficiais, 30, null, t) : h('p', {class: 'empty sm'}, semDados() ? SEM_DADOS : 'Nenhum documento da companhia à CVM no período coletado pelo robô.')));
    }
    function fundamentos() {
      var fund = h('div', {class: 'tv'});
      if (T) {
        fund.append(
          blocoTxt('Tese estrutural', h('div', null, h('p', null, T.resumo), T.papel_titulo ? h('p', null, h('b', null, T.papel_titulo + '. '), T.papel) : null)),
          blocoTxt('Modelo de negócio', h('div', null, a.tese ? h('p', null, a.tese) : null, (T.fundamentos || []).length ? h('ul', null, T.fundamentos.map(function (x) { return h('li', null, h('b', null, x.titulo + ': '), x.texto); })) : null)),
          blocoTxt('Drivers', h('div', null, a.motores ? h('ul', null, a.motores.split(' · ').map(li)) : null, (T.numeros || []).length ? h('p', {class: 'muted', style: 'font-size:.9rem'}, T.numeros.join(' ')) : null)),
          blocoTxt('Riscos', (T.riscos || []).length ? h('ul', null, T.riscos.map(function (x) { return h('li', null, h('b', null, x.titulo + ': '), x.texto); })) : (a.riscos ? h('p', null, a.riscos) : null)));
        fund.appendChild(h('p', {class: 'hint'}, (T.fontes || '') + ' Texto das Teses de 30/10/2026, sem alteração. ', h('button', {class: 'btn link', onclick: function () { A.abrirTese(t); }}, 'Tese em tela cheia')));
      } else {
        fund.append(tx && tx.nota ? h('div', {class: 'alert warn slim'}, tx.nota) : h('p', {class: 'muted'}, 'Sem tese no documento de 30/10/2026.'),
          blocoTxt('Tese', a.tese ? h('p', null, a.tese) : null), blocoTxt('Drivers', a.motores ? h('p', null, a.motores) : null), blocoTxt('Riscos', a.riscos ? h('p', null, a.riscos) : null), blocoTxt('O que acompanhar', a.acompanhamos ? h('p', null, a.acompanhamos) : null));
      }
      return h('div', null, A.sec('A tese', null, fund), A.sec('Exposição a juros, câmbio, regulação e commodities', null, exposicaoBox(t, a, sen)));
    }
    function setor() { return A.sec('Setor e pares', {hint: 'Mesmo setor, grupo econômico ou canal macro nas Teses, com as notícias diretas de cada um.'}, setorBox(t, a)); }
    return fichaLayout(t, cab, [['tese', 'Mudanças na tese', null, mudancas], ['eventos', 'Eventos e RI', c.oficiais.length || null, eventos], ['fundamentos', 'Fundamentos', null, fundamentos], ['setor', 'Setor e pares', null, setor]], 'tese', kpi);
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
    var a = C.ATV[t], e = etfInfo(t), cab = h('div');
    cab.appendChild(cabecalho(t, a, e && e.nome_completo || a.nome));
    if (!e) {
      cab.appendChild(h('div', {class: 'alert warn slim'}, h('b', null, 'Ficha não verificada. '), 'Os documentos oficiais deste ' + (t === 'CYPRESS' ? 'fundo' : 'ETF') + ' não foram encontrados nas fontes públicas consultadas; abaixo, só o cadastro do painel, sem estimativas.'));
      cab.appendChild(h('dl', {class: 'kv'}, h('dt', null, 'Nome no cadastro'), h('dd', null, a.nome), h('dt', null, 'Emissor'), h('dd', null, a.emissor || '—'), a.obs ? h('dt', null, 'Observação') : null, a.obs ? h('dd', null, a.obs) : null));
      cab.appendChild(pesosRef(t));
      return fichaLayout(t, cab, [['ficha', 'Ficha', null, function () { return h('p', {class: 'empty sm'}, 'Sem ficha verificada.'); }]], 'ficha');
    }
    cab.appendChild(h('div', {class: 'row', style: 'gap:6px;flex-wrap:wrap;margin:-2px 0 10px'}, [e.gestora, e.ticker_bolsa, e.domicilio ? 'domicílio: ' + e.domicilio : null, e.classe_distribuicao ? (e.classe_distribuicao === 'acumula' ? 'acumula os rendimentos' : 'distribui os rendimentos') : null, e.isin ? 'ISIN ' + e.isin : null, e.cnpj ? 'CNPJ ' + e.cnpj : null].filter(Boolean).map(function (x) { return A.chip(x); })));
    if (e.aviso_cadastro) cab.appendChild(h('div', {class: 'alert warn slim'}, h('b', null, 'Cadastro do painel diferente do fundo real. '), e.aviso_cadastro, ' O cadastro não foi alterado: a correção é decisão da mesa.'));
    var dur = e.duration && e.duration.valor != null ? e.duration : null, tx0 = partes(e.taxa_adm), pt = partes(e.patrimonio && e.patrimonio.valor != null ? String(e.patrimonio.valor) : null), du = partes(dur ? String(dur.valor) : null);
    var dtx = function (x) { return x ? (/^\d{4}-\d{2}-\d{2}$/.test(x) ? A.dataBR(x) : x) : ''; };
    var kpi = h('div', {class: 'vbox'},
      h('div', null, h('span', {class: 'k'}, 'Taxa total'), h('b', null, tx0[0] || '—'), h('small', null, tx0[1] || (e.taxa_adm ? 'documento da gestora' : 'não verificada'))),
      h('div', null, h('span', {class: 'k'}, 'Patrimônio'), h('b', {style: 'font-size:1.05rem'}, pt[0] || '—'), h('small', null, (pt[1] ? pt[1] + ' · ' : '') + (e.patrimonio && e.patrimonio.data ? 'em ' + dtx(e.patrimonio.data) : 'não verificado'))),
      h('div', null, h('span', {class: 'k'}, dur ? 'Duration' : 'Posições'), h('b', {style: dur ? 'font-size:1.05rem' : null}, dur ? du[0] : e.n_posicoes && e.n_posicoes.valor != null ? String(e.n_posicoes.valor) : '—'), h('small', null, dur ? (du[1] ? du[1] + ' · ' : '') + dtx(dur.data) : e.n_posicoes && e.n_posicoes.data ? 'em ' + dtx(e.n_posicoes.data) : (/Renda fixa/.test(a.classe || '') ? 'duration não publicada em fonte oficial' : 'não verificado'))),
      h('div', null, h('span', {class: 'k'}, 'Moeda'), h('b', null, e.moeda || a.moeda || '—'), h('small', null, a.moeda === 'USD' ? 'em reais, o câmbio entra por inteiro' : '')));
    cab.appendChild(pesosRef(t));
    function ficha() {
      var box = h('div'), ed = h('div', {class: 'tv'});
      ed.append(blocoTxt('Objetivo', e.objetivo ? h('p', null, e.objetivo) : null),
        blocoTxt('Índice e metodologia', h('div', null, h('p', null, h('b', null, e.indice || 'Índice não verificado')), e.indice_metodologia ? h('p', null, e.indice_metodologia) : null, e.metodologia ? h('p', null, e.metodologia) : null)),
        blocoTxt('Papel na carteira', h('div', null, e.papel_na_carteira ? h('p', {class: 'tv-lead'}, e.papel_na_carteira) : null, C.PIL[a.pilar] && C.PIL[a.pilar].papel ? h('p', {class: 'muted', style: 'font-size:.9rem'}, 'Papel do ' + a.pilar + ' na política: ' + C.PIL[a.pilar].papel) : null)),
        blocoTxt('Fatores de risco e retorno', (e.fatores || []).length ? h('div', {class: 'row', style: 'gap:6px;flex-wrap:wrap'}, e.fatores.map(function (x) { return A.chip(x); })) : null),
        blocoTxt('Riscos (documentos oficiais)', (e.riscos || []).length ? h('ul', null, e.riscos.map(li)) : null),
        e.distribuicao_texto ? blocoTxt('Rendimentos', h('p', null, e.distribuicao_texto)) : null,
        e.tributacao ? blocoTxt('Tributação', h('p', null, typeof e.tributacao === 'string' ? e.tributacao : (e.tributacao.texto || '') + (e.tributacao.fonte ? ' (fonte: ' + e.tributacao.fonte + ')' : ''))) : null);
      box.appendChild(A.sec('Ficha', null, ed));
      var sem = (e.semelhantes || []).filter(function (x) { return x && x.ticker; });
      if (sem.length) box.appendChild(A.sec('Comparação com semelhantes', {flush: true}, A.table([{k: 'ticker', t: 'ETF', f: function (r) { return C.ATV[r.ticker] ? h('button', {class: 'btn link', onclick: function () { A.abrirEmpresa(r.ticker); }}, r.ticker) : r.ticker; }}, {k: 'diferenca', t: 'Diferença', s: false}], sem, {sort: null})));
      return box;
    }
    function exposicoes() {
      var box = h('div'), ex = e.exposicao, pp = e.principais_posicoes;
      if (ex && ((ex.paises || []).length || (ex.setores || []).length)) box.appendChild(A.sec('Países e setores', {hint: (ex.fonte || '') + (ex.data ? ' · ' + (/^\d{4}-/.test(ex.data) ? A.dataBR(ex.data) : ex.data) : '')}, h('div', null, (ex.paises || []).length ? h('div', null, h('h3', {style: 'margin-top:0'}, 'Países'), barrasPct(ex.paises)) : null, (ex.setores || []).length ? h('div', null, h('h3', null, /Quebra por tipo|tipo de emissor|tipo de ativo/.test(ex.fonte || '') ? 'Tipo de ativo' : 'Setores'), barrasPct(ex.setores)) : null)));
      else box.appendChild(A.sec('Países e setores', null, h('p', {class: 'muted'}, 'Não publicado em texto nos documentos consultados.')));
      if (pp && (pp.itens || []).length) { var top5 = C.sum(pp.itens.slice(0, 5), function (x) { return x[1]; }); box.appendChild(A.sec('Principais posições', {hint: 'Em ' + (pp.data ? A.dataBR(pp.data) : 'data não informada') + '. As 5 maiores somam ' + A.num(top5, 1) + '%.'}, barrasPct(pp.itens))); }
      return box;
    }
    function documentos() {
      return A.sec('Documentos oficiais', null, h('div', null,
        (e.documentos || []).filter(function (d) { return A.link(d.url); }).length ? h('ul', {class: 'docs'}, e.documentos.filter(function (d) { return A.link(d.url); }).map(function (d) { return h('li', null, h('a', {href: A.link(d.url), target: '_blank', rel: 'noopener'}, d.titulo || d.url)); })) : h('p', {class: 'muted'}, 'Sem link verificado.'),
        h('p', {class: 'hint'}, 'Consultado em ' + A.dataBR(e.consultado_em) + '. Cada número traz a data do documento de origem.'),
        e.notas ? A.more('Notas de verificação', h('p', {style: 'font-size:.9rem'}, e.notas)) : null));
    }
    return fichaLayout(t, cab, [['ficha', 'Ficha', null, ficha], ['exposicoes', 'Exposições', null, exposicoes], ['documentos', 'Documentos', (e.documentos || []).length || null, documentos]], 'ficha', kpi);
  }
  var GLB = {t: null, f: 'Todos'};
  A.abrirEmpresa = function (t) {
    if (t === 'BBDC4' && !C.ATV.BBDC4) t = 'BBDC3';
    if (!C.ATV[t]) return;
    A.registrarAtivo(t);
    if (ehGlobal(t)) { GLB.t = t; GLB.f = 'Todos'; A.go('mundo', 'etfs'); } else { EMP.t = t; EMP.f = 'Todos'; EMP.setor = null; A.go('brasil', 'ativos'); }
  };
  A.abrirSetor = function (setor) { EMP.setor = setor; EMP.f = 'Todos'; EMP.t = null; A.go('brasil', 'ativos'); };
  // Ficha rápida (gaveta): últimas notícias, opiniões, resultado da CVM e a tese em uma frase — sem sair da tela
  A.abrirFicha = function (t) {
    if (t === 'BBDC4' && !C.ATV.BBDC4) t = 'BBDC3';
    var a = C.ATV[t]; if (!a) return;
    A.registrarAtivo(t);
    var e = etfInfo(t), tx = A.teseDe(t), T = tx && tx.tese, c = conteudoDe(t), body = h('div');
    body.appendChild(h('p', {class: 'tv-crumb'}, (a.pilar ? a.pilar + ' · ' : '') + (a.setor || a.tipo)));
    body.appendChild(h('h3', null, 'Últimas notícias'));
    body.appendChild(linksBusca(t));
    body.appendChild(A.listaLinhas(c.direto.filter(function (x) { return x.natureza !== 'opiniao_casa' || nos7(x); }), 8, 'Nenhuma notícia recente tem ' + (A.ehETF(t) ? 'o fundo' : 'a empresa') + ' como assunto.', t));
    if (c.mencoes.length) body.appendChild(h('p', {class: 'muted', style: 'font-size:.84rem'}, c.mencoes.length + (c.mencoes.length > 1 ? ' menções' : ' menção') + ' de passagem (listas, destaques do dia) fora da contagem.'));
    if (c.opinioes.total) body.appendChild(h('p', {class: 'muted', style: 'font-size:.88rem'}, 'Opiniões publicadas em 12 meses: ' + c.opinioes.favoravel.length + ' a favor · ' + c.opinioes.contraria.length + ' contra · ' + c.opinioes.outras.length + ' neutras/sem sentido explícito.'));
    if (A.ehETF(t) && c.tema.length) { body.appendChild(h('h3', null, 'Índice e tema')); body.appendChild(A.listaLinhas(c.tema, 4, null, t)); }
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
      return {t: t, nome: a.nome, setor: a.setor, p: a.pilar, n7: c.direto.filter(recente).length, m7: c.mencoes.filter(recente).length, op: c.opinioes.total, ult: ult ? I.pub(ult) : '', ultX: ult, nt: c.tema.filter(recente).length};
    });
    rows.sort(function (x, y) { return (y.ult || '').localeCompare(x.ult || '') || x.t.localeCompare(y.t); });
    if (!st.t || lista.indexOf(st.t) < 0) st.t = rows.length ? rows[0].t : null;
    var fsel = h('div', {class: 'sub', style: 'margin:0 0 8px'}, grupos.map(function (x) { return h('button', {'aria-pressed': st.f === x[0] && !st.setor ? 'true' : 'false', onclick: function () { st.f = x[0]; st.setor = null; st.t = null; A.render(); }}, x[0]); }),
      st.setor ? h('button', {'aria-pressed': 'true', title: 'Tirar o filtro de setor', onclick: function () { st.setor = null; A.render(); }}, 'Setor: ' + st.setor + ' ✕') : null);
    var g = h('div', {class: 'grid-emp'}), L = h('div', {class: 'sticky lista-at'}), R = h('div', {class: 'ficha-at'}); g.append(L, R); wrap.appendChild(g);
    L.appendChild(A.sec('Ativos', {flush: true, badge: h('span', {class: 'sec-n'}, 'pela notícia direta mais recente')}, [h('div', {style: 'padding:0 14px'}, fsel), A.table([
      {k: 't', t: 'Ativo', f: function (r) { return h('span', null, h('b', null, r.t), h('div', {class: 'muted', style: 'font-size:.78rem'}, (r.p ? r.p + ' · ' : '') + (r.setor || r.nome) + (r.op ? ' · ' + r.op + (r.op > 1 ? ' opiniões' : ' opinião') : ''))); }, s: function (r) { return +(r.p || 'P99').slice(1) * 1000 + r.t.charCodeAt(0); }},
      {k: 'n7', t: '7 d', r: 1, title: 'Notícias em que o ativo é o assunto nos últimos 7 dias. Menções de passagem (listas de dividendos, destaques do dia) e notícias do setor não contam.', f: function (r) { var tip = [r.m7 ? r.m7 + ' menção(ões) de passagem' : null, r.nt ? r.nt + ' do setor ou do tema' : null].filter(Boolean).join(' · ') || null; return r.n7 ? h('b', {title: tip}, String(r.n7)) : h('span', {class: 'muted', title: tip}, '0'); }},
      {k: 'ult', t: 'Última', f: function (r) { return r.ultX ? h('span', {class: 'nw-when'}, I.quando(r.ultX)) : h('span', {class: 'muted'}, '—'); }}
    ], rows, {sort: null, search: 'Filtrar', onRow: function (r) { st.t = r.t; A.rerender(); }, rowClass: function (r) { return r.t === st.t ? 'sel' : null; }})]));
    // celular: a ficha vem antes da lista; esta faixa troca de ativo sem descer até a lista
    R.appendChild(h('div', {class: 'tk-strip', role: 'toolbar', 'aria-label': 'Trocar de ativo'}, rows.slice(0, 60).map(function (r) {
      return h('button', {'aria-pressed': r.t === st.t ? 'true' : 'false', onclick: function () { st.t = r.t; A.rerender(); }}, r.t, r.n7 ? h('small', null, String(r.n7)) : null);
    })));
    R.appendChild(st.t ? (A.ehETF(st.t) ? fichaETF(st.t) : empresa(st.t)) : h('p', {class: 'empty'}, 'Nenhum ativo neste filtro.'));
    return wrap;
  }

  /* ---------- Brasil ---------- */
  var GRUPOS_BR = [['Todos', null], ['Ações', function (a) { return a.classe === 'Ações'; }], ['FIIs', function (a) { return a.classe === 'FIIs'; }], ['ETFs renda fixa', function (a, t) { return A.ehETF(t); }]];
  A.SUBS.brasil = [['ativos', 'Ativos brasileiros']];
  A.areas.brasil = function () {
    var base = ativosDasCarteiras().filter(function (t) { return !ehGlobal(t); });
    return listaComFicha(EMP, GRUPOS_BR, base, A.pageHead('Ativos das 15 carteiras', 'Brasil', 'Notícias em que o ativo é o assunto, opiniões e o que pode mudar a tese.',
      h('button', {class: 'btn', onclick: function () { var d = A.drawer('Teses da Carteira Oregon · visão geral', A.tesesOregon()); d.classList.add('wide'); }}, 'Visão geral das teses')));
  };

  /* ---------- Mundo e Estratégia ---------- */
  var MUN = {reg: 'tudo', max: 20, cat: 'todas', cmax: 20};
  var REGS = [['tudo', 'Tudo'], ['eua', 'EUA'], ['china', 'China'], ['europa', 'Europa'], ['emergentes', 'Emergentes'], ['japao', 'Japão']];
  var CATS = [['todas', 'Tudo', ['gestora_internacional', 'gestora_brasil', 'instituicao', 'academia', 'youtube']], ['gestora_internacional', 'Gestoras internacionais', ['gestora_internacional']], ['gestora_brasil', 'Gestoras brasileiras', ['gestora_brasil']],
    ['instituicao', 'Bancos centrais e instituições', ['instituicao']], ['academia', 'Acadêmico e educacional', ['academia', 'youtube']]];
  function mundoAgora() {
    var wrap = h('div'), itens = A.itens();
    wrap.appendChild(A.pageHead('Mundo e Estratégia', 'O que o mundo está falando', 'Imprensa internacional, bancos centrais e temas dos ETFs globais, por hora de publicação. Análises e cartas estão em Research; opiniões em Debate.'));
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
    if (tl.length) wrap.appendChild(A.sec('Temas dos ETFs globais', {hint: 'Sobre o índice e o mercado de cada ETF global das carteiras; não são fatos do fundo.'},
      h('div', {class: 'tt-grid'}, tl.map(function (g) { var x = g.itens[0];
        return h('div', {class: 'tt'}, h('div', {class: 'tt-h'}, h('b', null, g.nome), h('span', {class: 'muted'}, g.itens.length + (g.itens.length > 1 ? ' notícias' : ' notícia'))),
          h('p', null, h('time', {class: 'nw-when'}, I.quando(x)), ' ', h('button', {class: 'nwl', onclick: function () { A.abrirItem(x); }}, x.titulo), h('span', {class: 'muted'}, ' · ' + (x.via ? x.fonte : x.organizacao || x.fonte))),
          h('div', {class: 'nw-tags'}, Object.keys(g.etfs).slice(0, 4).map(function (t) { return h('button', {class: 'tag tk', onclick: function () { A.abrirFicha(t); }}, t); })));
      }))));
    var cont = {}; REGS.forEach(function (r) { cont[r[0]] = r[0] === 'tudo' ? mundo.length : mundo.filter(function (x) { return (x.regioes || []).indexOf(r[0]) >= 0; }).length; });
    var lst = MUN.reg === 'tudo' ? mundo : mundo.filter(function (x) { return (x.regioes || []).indexOf(MUN.reg) >= 0; });
    var barra = h('div', {class: 'sub filt', role: 'toolbar', 'aria-label': 'Filtrar por região'}, REGS.map(function (r) { return h('button', {'aria-pressed': MUN.reg === r[0] ? 'true' : 'false', disabled: !cont[r[0]] && r[0] !== 'tudo' ? true : null, onclick: function () { MUN.reg = r[0]; MUN.max = 20; A.rerender(); }}, r[1] + (cont[r[0]] ? ' · ' + cont[r[0]] : '')); }));
    wrap.appendChild(A.sec('Últimas do mundo', {id: 'mundo-ultimas', badge: h('span', {class: 'sec-n'}, 'últimas 96 h')}, h('div', null, barra,
      lst.length ? h('div', null, A.listaRows(lst, {max: MUN.max}), lst.length > MUN.max ? h('p', {style: 'text-align:center'}, h('button', {class: 'btn', onclick: function () { MUN.max += 20; A.rerender(); }}, 'Mostrar mais')) : null)
        : h('p', {class: 'empty'}, A.intel.carregando ? 'Buscando…' : semDados() ? SEM_DADOS : 'Nada desta região nas últimas 96 horas.'))));
    return wrap;
  }
  // Research global por recência: últimos 7 dias, 8 a 30, 31 a 90 ("ainda relevante"); o histórico fica na Biblioteca.
  // Só entram itens com data de publicação; o que a fonte não data aparece à parte, recolhido, com a data de detecção.
  var TEMAS_GESTAO = [['ciclo', 'Ciclo econômico', ['atividade', 'inflacao', 'fiscal']], ['lucros', 'Lucros e valuation', ['bolsa']], ['juros', 'Juros', ['juros']], ['credito', 'Crédito', ['credito']],
    ['alocacao', 'Alocação global', ['alocacao', 'emergentes', 'europa', 'china']], ['fatores', 'Fatores', ['fatores']], ['commodities', 'Commodities e energia', ['commodities', 'energia_utilities']],
    ['cambio', 'Câmbio', ['cambio']], ['portfolio', 'Construção de portfólios', ['metodo']], ['geopolitica', 'Geopolítica', ['geopolitica']], ['tecnologia', 'Tecnologia e IA', ['tecnologia_ia']], ['etfs', 'ETFs', []]];
  function temaGestao(x, g) { return g[0] === 'etfs' ? (x.etfs_tema || []).length > 0 : (x.temas || []).some(function (t) { return g[2].indexOf(t) >= 0; }); }
  var RS = {cat: 'todas', tema: null, max: 8, mx: {}};
  function idadeDias(x) { var p = x.publicado_em; if (!p) return null; return (Date.now() - Date.parse(p.length <= 10 ? p + 'T12:00:00-03:00' : p)) / 864e5; }
  function mundoCartas() {
    var wrap = h('div'), itens = A.itensResearch ? A.itensResearch() : A.itens();
    wrap.appendChild(A.pageHead('Mundo e Estratégia', 'Research global', 'Gestoras, bancos, casas de análise e instituições, das publicações mais recentes às ainda relevantes. Cartas antigas ficam na Biblioteca.'));
    var fx = A.intelFaixa(); if (fx) wrap.appendChild(fx);
    var cat = CATS.filter(function (c) { return c[0] === RS.cat; })[0] || CATS[0];
    var dup = {}, base = itens.filter(function (x) {  // o mesmo documento em vários arquivos (ex.: relatório mensal de cada fundo) aparece uma vez
      if (x.acervo || x.agrupado_em || cat[2].indexOf(x.categoria) < 0) return false;
      var k = (x.organizacao || x.fonte) + '|' + x.titulo + '|' + I.pub(x).slice(0, 10); if (dup[k]) return false; dup[k] = 1; return true;
    });
    var datados = base.filter(function (x) { var d = idadeDias(x); return d != null && d <= 90 && d > -1; });
    var semData = base.filter(function (x) { return !x.publicado_em && x.detectado_em && Date.now() - Date.parse(x.detectado_em) <= 7 * 864e5; });
    var g = TEMAS_GESTAO.filter(function (t) { return t[0] === RS.tema; })[0];
    var lst = (g ? datados.filter(function (x) { return temaGestao(x, g); }) : datados).sort(function (a, b) { return I.pub(b).localeCompare(I.pub(a)); });
    var f7 = lst.filter(function (x) { return idadeDias(x) <= 7; }), f30 = lst.filter(function (x) { var d = idadeDias(x); return d > 7 && d <= 30; }), f90 = lst.filter(function (x) { return idadeDias(x) > 30; });
    // sumário da página e filtros
    wrap.appendChild(h('nav', {class: 'sumario', 'aria-label': 'Nesta página'}, h('span', {class: 'muted'}, 'Nesta página:'), h('a', {href: '#rs-7'}, 'Últimos 7 dias (' + f7.length + ')'), h('a', {href: '#rs-30'}, '8 a 30 dias (' + f30.length + ')'),
      h('a', {href: '#rs-90'}, 'Ainda relevante, 31 a 90 dias (' + f90.length + ')'), semData.length ? h('a', {href: '#rs-sem'}, 'Sem data na fonte (' + semData.length + ')') : null, h('button', {class: 'btn link', onclick: function () { A.go('bib', 'busca'); A.bibFiltro({grupo: 'cartas'}); }}, 'Biblioteca histórica ↗')));
    var cont = {}; CATS.forEach(function (c) { cont[c[0]] = itens.filter(function (x) { var d = idadeDias(x); return !x.acervo && !x.agrupado_em && c[2].indexOf(x.categoria) >= 0 && d != null && d <= 90; }).length; });
    wrap.appendChild(h('div', {class: 'sub filt', role: 'toolbar', 'aria-label': 'Tipo de fonte'}, CATS.map(function (c) { return h('button', {'aria-pressed': RS.cat === c[0] ? 'true' : 'false', disabled: !cont[c[0]] && c[0] !== 'todas' ? true : null, onclick: function () { RS.cat = c[0]; RS.max = 8; RS.mx = {}; A.rerender(); }}, c[1], cont[c[0]] ? h('small', null, String(cont[c[0]])) : null); })));
    // mapa de temas: assuntos dominantes nos últimos 90 dias, com os documentos que justificam cada um (toque filtra)
    var tm = TEMAS_GESTAO.map(function (t) { return {t: t, n: datados.filter(function (x) { return temaGestao(x, t); }).length}; }).filter(function (o) { return o.n; }).sort(function (a, b) { return b.n - a.n; });
    if (tm.length) {
      var mx = tm[0].n;
      wrap.appendChild(A.sec('Mapa de temas', {id: 'rs-temas', badge: h('span', {class: 'sec-n'}, '90 dias · toque para filtrar'), cls: 'sec-temas'}, h('div', {class: 'tbar', role: 'list'}, tm.map(function (o) {
        var on = RS.tema === o.t[0];
        return h('button', {class: 'tbar-r' + (on ? ' on' : ''), role: 'listitem', 'aria-pressed': on ? 'true' : 'false', title: o.n + ' publicações sobre ' + o.t[1].toLowerCase() + ' nos últimos 90 dias', onclick: function () { RS.tema = on ? null : o.t[0]; A.rerender(); }},
          h('span', {class: 'tbar-l'}, o.t[1]), h('span', {class: 'tbar-b'}, h('i', {style: 'width:' + Math.max(4, Math.round(100 * o.n / mx)) + '%'})), h('span', {class: 'tbar-n'}, String(o.n)));
      }), RS.tema ? h('p', {class: 'tbar-f'}, 'Filtrando: ' + g[1] + ' · ', h('button', {class: 'btn link', onclick: function () { RS.tema = null; A.rerender(); }}, 'mostrar todos os temas')) : null)));
    }
    function bloco(id, tit, l, cards) {
      return A.sec(tit, {id: id, cls: 'sec-rs', badge: h('span', {class: 'sec-n'}, l.length + (l.length === 1 ? ' publicação' : ' publicações'))},
        l.length ? (cards ? h('div', null, A.listaItens(l, {max: RS.max, comNivel: true}), l.length > RS.max ? h('p', {class: 'mais'}, h('button', {class: 'btn sm', onclick: function () { RS.max += 20; A.rerender(); }}, 'Mostrar mais ' + Math.min(20, l.length - RS.max))) : null)
          : h('div', null, A.listaRows(l, {abrir: true, max: RS.mx[id] || 15}), l.length > (RS.mx[id] || 15) ? h('p', {class: 'mais'}, h('button', {class: 'btn sm', onclick: function () { RS.mx[id] = (RS.mx[id] || 15) + 30; A.rerender(); }}, 'Mostrar mais ' + Math.min(30, l.length - (RS.mx[id] || 15)))) : null))
          : h('p', {class: 'empty sm'}, semDados() ? SEM_DADOS : 'Nada publicado neste período' + (g ? ' sobre ' + g[1].toLowerCase() : '') + ' pelas fontes deste filtro.'));
    }
    var col = h('div', {id: 'cartas'}); wrap.appendChild(col);
    col.appendChild(bloco('rs-7', 'Últimos 7 dias', f7, true));
    col.appendChild(bloco('rs-30', '8 a 30 dias', f30, false));
    col.appendChild(bloco('rs-90', 'Ainda relevante · 31 a 90 dias', f90, false));
    if (semData.length) col.appendChild(h('details', {class: 'sec sec-d', id: 'rs-sem'}, h('summary', null, h('h2', null, 'Sem data de publicação na fonte'), h('span', {class: 'sec-n'}, semData.length + ' detectados nos últimos 7 dias')),
      h('div', {class: 'body'}, h('p', {class: 'hint'}, 'A página da fonte não informa quando publicou; a hora mostrada é a da detecção pelo robô.'), A.listaRows(semData, {abrir: true}))));
    var co = A.intel.coleta && A.intel.coleta.fontes, paradas = 0;
    if (co) Object.keys(co).forEach(function (k) { var u = co[k].ultimo_publicado; if (u && Date.now() - Date.parse(u) > 90 * 864e5) paradas++; });
    if (paradas) col.appendChild(h('p', {class: 'muted rs-paradas'}, paradas + (paradas > 1 ? ' fontes estão' : ' fonte está') + ' sem publicação nova há mais de 90 dias: nada delas é reciclado aqui. ', h('button', {class: 'btn link', onclick: function () { A.go('bib', 'fontes'); }}, 'Ver diagnóstico das fontes')));
    return wrap;
  }

  /* ---------- Debate de mercado ---------- */
  // Análise de colaboradores (Seeking Alpha): opinião individual, separada de notícia e de research de banco
  A.ehDebate = function (x) { return !!x && (!!x.debate || (/seeking-?alpha/i.test(x.fonte_id || '') && !/currents|news|noticias/i.test(x.fonte_id || ''))); };
  var REDDIT = [['investing', 'Investimentos em geral, EUA'], ['stocks', 'Ações, EUA'], ['ValueInvesting', 'Value investing'], ['SecurityAnalysis', 'Análise fundamentalista'], ['Bogleheads', 'Alocação passiva e longo prazo'],
    ['Economics', 'Macroeconomia'], ['dividends', 'Dividendos'], ['investimentos', 'Investimentos, Brasil']];
  function xBusca(q) { return 'https://x.com/search?q=' + encodeURIComponent(q) + '&f=live'; }
  function nomeBusca(t) { var a = C.ATV[t] || {}; return a.nome && a.nome !== t ? '"' + a.nome.replace(/ ON$| PN$/, '') + '"' : ''; }
  // Consultas externas: abrem o Reddit e o X no navegador de quem usa. O Oregon não coleta nem verifica esse conteúdo.
  A.consultasExternas = function (evs, compacto) {
    var tks = []; (evs || []).forEach(function (ev) { ev.ts.forEach(function (r) { if (r.k !== 'setor' && tks.indexOf(r.t) < 0 && !A.ehETF(r.t)) tks.push(r.t); }); });
    tks = tks.slice(0, compacto ? 4 : 10);
    var xs = tks.map(function (t) { return [t, xBusca('"' + t + '"' + (nomeBusca(t) ? ' OR ' + nomeBusca(t) : '') + ' lang:pt')]; }).concat([['Ibovespa', xBusca('Ibovespa lang:pt')], ['Copom', xBusca('Copom OR Selic lang:pt')], ['Fed', xBusca('Fed rates OR FOMC lang:en')]]);
    if (compacto) return h('div', {class: 'ext ext-c'}, h('p', null, h('b', null, 'Discussões fora do Oregon'), h('span', {class: 'muted'}, ' · abrem no seu navegador, sem coleta nem verificação')),
      h('p', {class: 'ext-l'}, h('span', {class: 'ext-k'}, 'Reddit'), REDDIT.slice(0, 4).concat([REDDIT[7]]).map(function (r) { return h('a', {href: 'https://www.reddit.com/r/' + r[0] + '/top/?t=week', target: '_blank', rel: 'noopener'}, 'r/' + r[0]); })),
      h('p', {class: 'ext-l'}, h('span', {class: 'ext-k'}, 'X'), xs.slice(0, 6).map(function (x0) { return h('a', {href: x0[1], target: '_blank', rel: 'noopener'}, x0[0]); })));
    return h('div', {class: 'ext'},
      h('div', {class: 'ext-g'}, h('h3', null, 'Reddit · comunidades'), h('ul', {class: 'ext-ul'}, REDDIT.map(function (r) { return h('li', null, h('a', {href: 'https://www.reddit.com/r/' + r[0] + '/top/?t=week', target: '_blank', rel: 'noopener'}, 'r/' + r[0]), h('span', {class: 'muted'}, ' · ' + r[1] + ' · mais votados da semana')); })),
        tks.length ? h('p', {class: 'ext-l'}, h('span', {class: 'ext-k'}, 'Buscar no Reddit'), tks.map(function (t) { return h('a', {href: 'https://www.reddit.com/search/?q=' + encodeURIComponent(t) + '&sort=new', target: '_blank', rel: 'noopener'}, t); })) : null),
      h('div', {class: 'ext-g'}, h('h3', null, 'X · buscas em tempo real'), h('ul', {class: 'ext-ul'}, xs.map(function (x0) { return h('li', null, h('a', {href: x0[1], target: '_blank', rel: 'noopener'}, x0[0])); }))),
      h('p', {class: 'hint'}, 'Por que não há coleta automática: o Reddit veda robôs no robots.txt, encerra o RSS em 13/11/2026 e passou a exigir acordo para a API; a API do X é paga por post lido. Discussões são percepções de participantes, não fatos nem consenso.'));
  };
  var DB = {pos: 'todas'};
  function mundoDebate() {
    var wrap = h('div'), todos = A.itensAtivo();
    wrap.appendChild(A.pageHead('Mundo e Estratégia', 'Debate de mercado', 'Opiniões publicadas, análises de colaboradores e onde o mercado discute. São percepções de participantes, não fatos nem consenso.'));
    var fx = A.intelFaixa(); if (fx) wrap.appendChild(fx);
    var ops = todos.filter(function (x) { var d = idadeDias(x); return x.natureza === 'opiniao_casa' && !x.agrupado_em && d != null && d <= 30; }).sort(function (a, b) { return I.pub(b).localeCompare(I.pub(a)); });
    var colab = todos.filter(function (x) { var d = idadeDias(x); return A.ehDebate(x) && d != null && d <= 14; }).sort(function (a, b) { return I.pub(b).localeCompare(I.pub(a)); });
    wrap.appendChild(h('nav', {class: 'sumario', 'aria-label': 'Nesta página'}, h('span', {class: 'muted'}, 'Nesta página:'), h('a', {href: '#db-op'}, 'Opiniões publicadas (' + ops.length + ')'), h('a', {href: '#db-colab'}, 'Análises de colaboradores (' + colab.length + ')'), h('a', {href: '#db-ext'}, 'Onde o mercado discute')));
    var POS = [['todas', 'Todas'], ['favoravel', 'A favor'], ['contraria', 'Contra'], ['outras', 'Neutras ou sem sentido']];
    var cnt = {todas: ops.length, favoravel: 0, contraria: 0, outras: 0}; ops.forEach(function (x) { cnt[x.posicao === 'favoravel' || x.posicao === 'contraria' ? x.posicao : 'outras']++; });
    var l = DB.pos === 'todas' ? ops : ops.filter(function (x) { return DB.pos === 'outras' ? x.posicao !== 'favoravel' && x.posicao !== 'contraria' : x.posicao === DB.pos; });
    wrap.appendChild(A.sec('Opiniões publicadas', {id: 'db-op', cls: 'sec-rs', badge: h('span', {class: 'sec-n'}, '30 dias'), hint: 'Casas de análise e bancos sobre empresas e fundos, como publicados. O sentido vem do título ou da página da casa; recomendação e preço-alvo só quando escritos.'},
      h('div', null, h('div', {class: 'sub filt', role: 'toolbar', 'aria-label': 'Sentido'}, POS.map(function (p) { return h('button', {'aria-pressed': DB.pos === p[0] ? 'true' : 'false', disabled: !cnt[p[0]] && p[0] !== 'todas' ? true : null, onclick: function () { DB.pos = p[0]; A.rerender(); }}, p[1], h('small', null, String(cnt[p[0]]))); })),
        l.length ? A.listaRows(l, {abrir: true, max: 60}) : h('p', {class: 'empty sm'}, semDados() ? SEM_DADOS : 'Nenhuma opinião neste filtro nos últimos 30 dias.'))));
    wrap.appendChild(A.sec('Análises de colaboradores', {id: 'db-colab', cls: 'sec-rs', badge: h('span', {class: 'sec-n'}, '14 dias'), hint: 'Artigos assinados por colaboradores independentes (Seeking Alpha). Popularidade não é qualidade da tese; confira os números na fonte.'},
      colab.length ? A.listaRows(colab, {abrir: true, max: 40}) : h('p', {class: 'empty sm'}, semDados() ? SEM_DADOS : 'Nenhuma análise de colaboradores coletada nos últimos 14 dias.')));
    wrap.appendChild(A.sec('Onde o mercado discute', {id: 'db-ext', badge: h('span', {class: 'sec-n'}, 'consultas externas')}, A.consultasExternas(colab.concat(ops).map(function (x) { return {ts: I.diretos(x).map(function (t) { return {t: t, k: 'noticia'}; })}; }), false)));
    return wrap;
  }
  var GRUPOS_GL = [['Todos', null], ['Renda fixa', function (a) { return /Renda fixa/.test(a.classe || ''); }], ['Ações e outros', function (a) { return !/Renda fixa/.test(a.classe || ''); }]];
  function mundoEtfs() {
    var base = ativosDasCarteiras().filter(function (t) { return ehGlobal(t); });
    return listaComFicha(GLB, GRUPOS_GL, base, A.pageHead('Mundo e Estratégia', 'ETFs globais', 'Ficha verificada de cada ETF global e, ao lado, o que se fala do índice e do tema (não é fato do fundo).'));
  }
  A.SUBS.mundo = [['agora', 'Notícias'], ['cartas', 'Research'], ['debate', 'Debate de mercado'], ['etfs', 'ETFs globais']];
  A.areas.mundo = function () {
    var wrap = h('div'), s = S.sub.mundo;
    if (!A.SUBS.mundo.some(function (x) { return x[0] === s; })) s = S.sub.mundo = 'agora';
    wrap.appendChild(A.subnav('mundo', A.SUBS.mundo));
    wrap.appendChild(s === 'cartas' ? mundoCartas() : s === 'debate' ? mundoDebate() : s === 'etfs' ? mundoEtfs() : mundoAgora());
    return wrap;
  };
})(APP, CORE, INTEL);
