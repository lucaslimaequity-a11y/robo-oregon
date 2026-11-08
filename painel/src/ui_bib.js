/* BIBLIOTECA — pesquisa por assunto, autor/gestora, país, período e tipo; resumos semanais; registro de aprendizados;
   fontes e coleta (o que chegou, foi rejeitado, deduplicado e publicado, por fonte). O histórico nunca é apagado. */
(function (A, C, I) {
  'use strict';
  var h = A.h, S = A.S;
  var F = {q: '', tema: '', regiao: '', tipo: '', categoria: '', org: '', ativo: '', nivel: '', de: '', ate: '', meses: 1, lidos: 'todos', grupo: ''};
  A.bibFiltro = function (patch) { Object.assign(F, {q: '', tema: '', regiao: '', tipo: '', categoria: '', org: '', ativo: '', nivel: '', grupo: ''}, patch || {}); A.render(); };
  // Atalhos visíveis por tipo de fonte; os demais filtros ficam recolhidos em "Mais filtros"
  var GRUPOS = [['', 'Tudo'], ['noticias', 'Notícias', function (x) { return x.categoria === 'veiculo' && x.natureza !== 'opiniao_casa'; }], ['opinioes', 'Opiniões', function (x) { return x.natureza === 'opiniao_casa'; }],
    ['cartas', 'Cartas e research', function (x) { return /^gestora_|^academia$|^youtube$/.test(x.categoria || ''); }], ['oficiais', 'CVM e instituições', function (x) { return x.categoria === 'oficial_empresa' || x.categoria === 'instituicao'; }],
    ['salvos', 'Salvos para ler']];
  // Lista curta de leitura: o que foi marcado com "Ler depois" (fica neste navegador ou no banco do painel)
  function salvos() { return A.salvos().map(function (s0) { return A.itemPorId(s0.id) || s0.item; }).filter(Boolean); }
  var AVANC = ['tema', 'org', 'regiao', 'tipo', 'categoria', 'ativo', 'nivel', 'de', 'ate'];
  function E() { return A.intel; }
  /* v3.5 · buscas salvas: filtros guardados neste navegador, com quantos itens chegaram desde a sua última visita */
  var CHAVES_BUSCA = ['q', 'tema', 'regiao', 'tipo', 'categoria', 'org', 'ativo', 'nivel', 'grupo'];
  function buscas() { var l = A.lsGet ? A.lsGet('buscas', []) : []; return Array.isArray(l) ? l : []; }
  function nomeBusca(f) {
    var p = [];
    if (f.q) p.push('"' + f.q + '"');
    if (f.ativo) p.push(f.ativo);
    if (f.tema) p.push(I.temaNome(f.tema));
    if (f.org) p.push(f.org);
    if (f.regiao) p.push(I.regiaoNome(f.regiao));
    if (f.tipo) p.push(I.tipoNome(f.tipo));
    if (f.grupo) p.push(({noticias: 'Notícias', opinioes: 'Opiniões', cartas: 'Cartas e research', oficiais: 'CVM e instituições', salvos: 'Salvos'})[f.grupo] || f.grupo);
    return p.join(' · ') || 'Tudo';
  }
  function aplicaBusca(itens, f) {
    var l = I.filtrar(itens, Object.assign({q: '', tema: '', regiao: '', tipo: '', categoria: '', org: '', ativo: '', nivel: '', de: '', ate: '', lidos: 'todos'}, f));
    var gr = GRUPOS.filter(function (g) { return g[0] === f.grupo; })[0];
    return gr && gr[2] ? l.filter(gr[2]) : l;
  }
  // Para o Hoje e para a Biblioteca: cada busca salva com quantos itens novos (detectados depois da sua visita anterior)
  A.buscasSalvas = function () {
    var itens = A.itensAtivo ? A.itensAtivo() : A.itens();
    return buscas().map(function (b) { var l = aplicaBusca(itens, b.f), nv = A.visitaAnterior && A.visitaAnterior() ? l.filter(function (x) { return A.novoParaVoce(x); }) : [];
      return {b: b, total: l.length, novos: nv.length, itensNovos: nv.sort(function (x, y) { return I.pub(y).localeCompare(I.pub(x)); }).slice(0, 3)}; });
  };
  A.abrirBusca = function (b) { A.go('bib', 'busca'); A.bibFiltro(Object.assign({}, b.f)); };
  function salvarBusca() {
    var f = {}; CHAVES_BUSCA.forEach(function (k) { if (F[k]) f[k] = F[k]; });
    if (!Object.keys(f).length) { A.toast('Escreva um assunto ou escolha um filtro antes de salvar.'); return; }
    var l = buscas(), nome = nomeBusca(f);
    if (l.some(function (b) { return b.nome === nome; })) { A.toast('Essa busca já está salva.'); return; }
    l.push({nome: nome, f: f, criada: new Date().toISOString()}); A.lsSet('buscas', l.slice(-20)); A.toast('Busca salva: ' + nome); A.rerender();
  }
  function buscasView() {
    var L = A.buscasSalvas(); if (!L.length) return null;
    return h('div', {class: 'bs', 'aria-label': 'Buscas salvas'}, h('span', {class: 'muted'}, 'Buscas salvas:'), L.map(function (o, i) {
      return h('span', {class: 'bs-c'}, h('button', {title: o.total + ' itens nos meses carregados' + (o.novos ? '; ' + o.novos + ' desde a sua última visita' : ''), onclick: function () { A.bibFiltro(Object.assign({}, o.b.f)); }}, o.b.nome, o.novos ? h('b', null, ' · ' + o.novos + (o.novos > 1 ? ' novos' : ' novo')) : h('span', {class: 'muted'}, ' · ' + o.total)),
        h('button', {class: 'bs-x', title: 'Apagar esta busca salva', 'aria-label': 'Apagar a busca ' + o.b.nome, onclick: function () { var l = buscas(); l.splice(i, 1); A.lsSet('buscas', l); A.rerender(); }}, '×'));
    }));
  }
  function mesesPedidos() {
    // os N meses mais recentes disponíveis; o período escolhido força os meses que ele cobre
    var disp = A.mesesDisponiveis().slice().sort().reverse(), n = Math.max(1, F.meses | 0), out = disp.slice(0, n);
    if (F.de) disp.forEach(function (m) { if (m >= F.de.slice(0, 7) && (!F.ate || m <= F.ate.slice(0, 7)) && out.indexOf(m) < 0) out.push(m); });
    return out;
  }
  function garantirMeses() { var pend = false; mesesPedidos().forEach(function (m) { if (!E().meses[m]) { pend = true; A.carregarMes(m); } else if (E().meses[m].carregando) pend = true; }); return pend; }

  /* ---------- busca ---------- */
  function sel(label, chave, opcoes, fmt) {
    var s = h('select', {class: 'inp', 'aria-label': label, onchange: function () { F[chave] = s.value; A.rerender(); }}, h('option', {value: ''}, label), opcoes.map(function (o) { return h('option', {value: o[0], selected: F[chave] === o[0] || null}, (fmt ? fmt(o[0]) : o[0]) + (o[1] != null ? ' (' + o[1] + ')' : '')); }));
    return s;
  }
  function ordenado(cont, fmt) { return Object.keys(cont).sort(function (a, b) { return cont[b] - cont[a] || String(fmt ? fmt(a) : a).localeCompare(String(fmt ? fmt(b) : b)); }).map(function (k) { return [k, cont[k]]; }); }
  function busca() {
    var e = E(), wrap = h('div'), pend = garantirMeses();
    var todos = A.itens(), base = todos.filter(function (x) { return mesesPedidos().indexOf(I.pub(x).slice(0, 7)) >= 0 || (e.recentes && e.recentes.itens.indexOf(x) >= 0); });
    var lista = F.grupo === 'salvos' ? I.filtrar(salvos(), F) : I.filtrar(base, F);
    var gr = GRUPOS.filter(function (g) { return g[0] === F.grupo; })[0];
    if (gr && gr[2]) lista = lista.filter(gr[2]);
    if (F.lidos === 'nao') lista = lista.filter(function (x) { return !A.lido(x.id); });
    if (F.lidos === 'sim') lista = lista.filter(function (x) { return A.lido(x.id); });
    var ordem = F.ordem || 'data';
    lista = ordem === 'prioridade' ? I.ordenar(lista) : lista;
    var q = h('input', {class: 'inp search', type: 'search', value: F.q, placeholder: 'Assunto, autor, ativo ou filtros (ex.: "juro real" fonte:Valor desde:10/2026)', 'aria-label': 'Buscar', oninput: function () { F.q = q.value; clearTimeout(q.t); q.t = setTimeout(function () { A.rerender(); }, 250); }});
    var de = h('input', {class: 'inp', type: 'date', value: F.de, 'aria-label': 'De', onchange: function () { F.de = de.value; A.rerender(); }}), ate = h('input', {class: 'inp', type: 'date', value: F.ate, 'aria-label': 'Até', onchange: function () { F.ate = ate.value; A.rerender(); }});
    var nAv = AVANC.filter(function (k) { return F[k]; }).length + (F.lidos !== 'todos' ? 1 : 0);
    var grupos = h('div', {class: 'sub filt', role: 'toolbar', 'aria-label': 'Tipo de fonte'}, GRUPOS.map(function (g) {
      var n = g[0] === 'salvos' ? A.salvos().length : g[2] ? base.filter(g[2]).length : base.length;
      return h('button', {'aria-pressed': F.grupo === g[0] ? 'true' : 'false', onclick: function () { F.grupo = g[0]; A.rerender(); }}, g[1], h('small', null, String(n)));
    }));
    var filtros = h('div', {class: 'filtros'},
      h('select', {class: 'inp', 'aria-label': 'Meses carregados', onchange: function (ev) { F.meses = +ev.target.value; A.rerender(); }}, [1, 3, 6, 12, 36].map(function (n) { return h('option', {value: n, selected: F.meses === n || null}, 'últimos ' + n + ' mês' + (n > 1 ? 'es' : '')); })),
      h('select', {class: 'inp', 'aria-label': 'Ordem', onchange: function (ev) { F.ordem = ev.target.value; A.rerender(); }}, [['data', 'mais recentes'], ['prioridade', 'maior prioridade']].map(function (o) { return h('option', {value: o[0], selected: ordem === o[0] || null}, o[1]); })),
      nAv || F.q || F.grupo ? h('button', {class: 'btn sm', onclick: function () { F.de = F.ate = ''; F.lidos = 'todos'; A.bibFiltro({}); }}, 'Limpar') : null,
      (F.q || F.grupo || CHAVES_BUSCA.some(function (k) { return F[k]; })) && F.grupo !== 'salvos' ? h('button', {class: 'btn sm', title: 'Guarda esta busca neste navegador e mostra quantos itens novos chegaram desde a sua última visita', onclick: salvarBusca}, 'Salvar busca') : null);
    var avanc = h('details', {class: 'mais-f', open: nAv ? true : null}, h('summary', null, 'Mais filtros' + (nAv ? ' · ' + nAv + ' ativo' + (nAv > 1 ? 's' : '') : '')), h('div', {class: 'filtros'},
      sel('Assunto', 'tema', ordenado(I.contagens(base, 'temas'), I.temaNome), I.temaNome),
      sel('Autor ou gestora', 'org', ordenado(I.contagens(base, 'organizacao'))),
      sel('Ativo da Oregon', 'ativo', ordenado(I.contagens(base, 'ativos'))),
      sel('País ou região', 'regiao', ordenado(I.contagens(base, 'regioes'), I.regiaoNome), I.regiaoNome),
      sel('Tipo', 'tipo', ordenado(I.contagens(base, 'tipo'), I.tipoNome), I.tipoNome),
      sel('Origem', 'categoria', ordenado(I.contagens(base, 'categoria'), function (k) { return I.CATEGORIA[k] || k; }), function (k) { return I.CATEGORIA[k] || k; }),
      sel('Prioridade', 'nivel', [['alta', null], ['media', null], ['baixa', null]], function (k) { return {alta: 'Alta', media: 'Média', baixa: 'Baixa'}[k]; }),
      h('span', {class: 'row', style: 'gap:4px'}, de, h('span', {class: 'muted'}, 'a'), ate),
      h('select', {class: 'inp', 'aria-label': 'Leitura', onchange: function (ev) { F.lidos = ev.target.value; A.rerender(); }}, [['todos', 'lidos e não lidos'], ['nao', 'só não lidos'], ['sim', 'só lidos']].map(function (o) { return h('option', {value: o[0], selected: F.lidos === o[0] || null}, o[1]); }))));
    wrap.appendChild(A.pageHead('Biblioteca', 'Pesquisa', 'Tudo o que o robô coletou, mês a mês, sem apagar nada.' + (e.versao ? ' ' + A.mesesDisponiveis().length + ' meses disponíveis.' : '')));
    var fx = A.intelFaixa(); if (fx) wrap.appendChild(fx);
    // v3.7 · como escrever os filtros na busca
    var ajuda = h('details', {class: 'mais-f bq-aj'}, h('summary', null, 'Como filtrar pela busca'), h('ul', {class: 'bq-l'},
      [['"frase exata"', 'as palavras nessa ordem'], ['fonte:Valor', 'veículo, gestora ou instituição'], ['desde:10/2026 · até:15/11/2026', 'período (dia, mês ou ano)'], ['ativo:PETR4', 'ativo das carteiras (Oregon ou VIP)'],
        ['evento:recompra', 'recompra, M&A, guidance, gestão (CEO, CFO), dívida, oferta'], ['tipo:carta', 'fato, resultado, opiniao, carta, research, noticia'], ['-palavra', 'deixa de fora']].map(function (o) { return h('li', null, h('code', null, o[0]), ' ', h('span', {class: 'muted'}, o[1])); })),
      A.legendaMarcas ? A.legendaMarcas() : null);
    wrap.appendChild(h('div', {class: 'busca-box'}, q, h('div', {class: 'busca-l'}, grupos, filtros), avanc, ajuda));
    var bv = buscasView(); if (bv) wrap.appendChild(bv);
    if (F.grupo === 'salvos') wrap.appendChild(h('p', {class: 'hint'}, 'Itens marcados com “Ler depois” na janela de leitura ou na linha da notícia. Para tirar da lista, abra o item e toque em “Salvo para ler”.'));
    wrap.appendChild(h('p', {class: 'muted', style: 'font-size:.88rem'}, lista.length + ' de ' + (F.grupo === 'salvos' ? A.salvos().length : base.length) + ' itens' + (pend ? ' · carregando meses…' : '') + (F.tema ? ' · assunto: ' + I.temaNome(F.tema) : '') + (F.ativo ? ' · ativo: ' + F.ativo : '')));
    var MAX = F.max || 60;
    wrap.appendChild(A.listaItens(lista, {max: MAX, vazio: F.grupo === 'salvos' ? 'Nada salvo para ler. Use “Ler depois” em qualquer notícia.' : base.length ? 'Nenhum item com estes filtros.' : (pend ? 'Carregando…' : 'A biblioteca ainda não tem itens publicados.')}));
    if (lista.length > MAX) wrap.appendChild(h('p', {style: 'text-align:center'}, h('button', {class: 'btn', onclick: function () { F.max = MAX + 60; A.rerender(); }}, 'Mostrar mais ' + Math.min(60, lista.length - MAX))));
    return wrap;
  }

  /* ---------- v3.5 · resumo do mês por tema de gestão: o que foi coletado, sem resumo inventado ---------- */
  var RM = {mes: null};
  var MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function resumoMes() {
    var wrap = h('div'), itens = (A.itensResearch ? A.itensResearch() : A.itens()).filter(function (x) { return x.publicado_em && !x.acervo && !x.agrupado_em && /^gestora_|^instituicao$|^academia$|^youtube$/.test(x.categoria || ''); });
    var meses = []; itens.forEach(function (x) { var m = x.publicado_em.slice(0, 7); if (meses.indexOf(m) < 0 && m <= I.hojeBRT().slice(0, 7)) meses.push(m); }); meses.sort().reverse(); meses = meses.slice(0, 3);
    if (!RM.mes || meses.indexOf(RM.mes) < 0) RM.mes = meses[0] || I.hojeBRT().slice(0, 7);
    var doMes = itens.filter(function (x) { return x.publicado_em.slice(0, 7) === RM.mes; });
    var nomeMes = MESES_PT[+RM.mes.slice(5, 7) - 1] + ' de ' + RM.mes.slice(0, 4), parcial = RM.mes === I.hojeBRT().slice(0, 7);
    wrap.appendChild(A.pageHead('Biblioteca', 'Resumo do mês', 'Cartas, research e publicações acadêmicas e de instituições do mês, por tema de gestão: quantas foram, quem publicou e os documentos mais repercutidos. Só o que o robô coletou; nenhum texto é resumido por máquina.'));
    wrap.appendChild(h('div', {class: 'sub filt', role: 'toolbar', 'aria-label': 'Mês'}, meses.map(function (m) { return h('button', {'aria-pressed': RM.mes === m ? 'true' : 'false', onclick: function () { RM.mes = m; A.rerender(); }}, MESES_PT[+m.slice(5, 7) - 1] + '/' + m.slice(2, 4)); })));
    if (!doMes.length) { wrap.appendChild(h('p', {class: 'empty'}, E().versao ? 'Nenhuma publicação com data neste mês nos arquivos carregados.' : 'Sem dados do robô nesta visualização.')); return wrap; }
    var orgs = {}; doMes.forEach(function (x) { var o = x.organizacao || x.fonte; orgs[o] = (orgs[o] || 0) + 1; });
    var br = doMes.filter(function (x) { return x.pais === 'Brasil'; }).length;
    wrap.appendChild(h('p', {class: 'lead'}, h('b', null, doMes.length + ' publicações'), ' em ' + nomeMes + (parcial ? ' (mês em andamento)' : '') + ', de ' + Object.keys(orgs).length + ' organizações · ' + br + ' do Brasil e ' + (doMes.length - br) + ' de fora.'));
    function rank(x) { return ((x.tambem_em || []).length * 100) + ((x.prioridade || {}).pontos || 0); }
    var cards = (A.TEMAS_GESTAO ? A.TEMAS_GESTAO() : []).map(function (t) {
      var l = doMes.filter(function (x) { return A.temaGestao(x, t); });
      return {t: t, l: l};
    }).filter(function (o) { return o.l.length; }).sort(function (a, b) { return b.l.length - a.l.length; });
    wrap.appendChild(h('div', {class: 'mes-t'}, cards.map(function (o) {
      var top = o.l.slice().sort(function (a, b) { return rank(b) - rank(a) || I.pub(b).localeCompare(I.pub(a)); }).slice(0, 3);
      var og = {}; o.l.forEach(function (x) { var k = x.organizacao || x.fonte; og[k] = (og[k] || 0) + 1; });
      var topo = Object.keys(og).sort(function (a, b) { return og[b] - og[a]; }).slice(0, 3);
      return h('div', {class: 'mes-c'}, h('h3', null, o.t[1], h('small', null, o.l.length + (o.l.length > 1 ? ' publicações' : ' publicação'))),
        h('ul', null, top.map(function (x) { return h('li', null, h('button', {class: 'nwl', onclick: function () { A.abrirItem(x); }}, x.titulo), h('span', {class: 'org'}, ' · ' + (x.organizacao || x.fonte) + ' · ' + I.quando(x) + ((x.tambem_em || []).length ? ' · em mais ' + x.tambem_em.length + (x.tambem_em.length > 1 ? ' fontes' : ' fonte') : ''))); })),
        h('p', {class: 'org'}, 'Quem mais publicou: ' + topo.map(function (k) { return k + ' (' + og[k] + ')'; }).join(', ')),
        h('button', {class: 'btn link', onclick: function () { A.go('bib', 'busca'); A.bibFiltro({grupo: 'cartas', tema: (o.t[2] || [])[0] || '', de: RM.mes + '-01', ate: RM.mes + '-31'}); }}, 'Abrir o tema na Biblioteca'));
    })));
    wrap.appendChild(h('p', {class: 'hint'}, 'Ordem dentro do tema: documentos que saíram em mais de uma fonte primeiro, depois a prioridade do robô. A Biblioteca guarda os meses anteriores.'));
    return wrap;
  }

  /* ---------- resumos semanais ---------- */
  function semanal() {
    var e = E(), wrap = h('div'), sm = e.semanal;
    wrap.appendChild(A.pageHead('Biblioteca', 'Resumos semanais', 'Temas mais presentes, teses publicadas, o que se repetiu entre fontes e o que merece estudo.'));
    if (!sm || !(sm.semanas || []).length) { wrap.appendChild(h('p', {class: 'muted'}, 'Nenhum resumo semanal publicado ainda (o robô fecha a semana aos sábados; em Actions, o modo “semanal” gera o da semana atual).')); return wrap; }
    var meus = A.aprendizados();
    sm.semanas.forEach(function (s, i) {
      var ap = meus.filter(function (a) { return a.quando.slice(0, 10) >= s.inicio && a.quando.slice(0, 10) <= s.fim; });
      var body = h('div');
      body.appendChild(h('div', {class: 'row', style: 'gap:6px;flex-wrap:wrap;margin-bottom:8px'}, (s.temas || []).map(function (t) { return h('button', {class: 'tag', title: t.fontes_primarias + ' de fonte primária', onclick: function () { A.go('bib', 'busca'); A.bibFiltro({tema: t.tema, de: s.inicio, ate: s.fim}); }}, t.nome + ' · ' + t.n); })));
      var g = h('div', {class: 'grid2'}), L = h('div'), R = h('div'); g.append(L, R); body.appendChild(g);
      L.appendChild(h('h4', null, 'Principais teses publicadas'));
      L.appendChild((s.teses || []).length ? h('ul', {class: 'lst'}, s.teses.map(function (t) { return h('li', null, A.link(t.link) ? h('a', {href: A.link(t.link), target: '_blank', rel: 'noopener'}, t.titulo) : t.titulo, h('span', {class: 'muted'}, ' · ' + t.fonte + ' · ' + I.tipoNome(t.tipo))); })) : h('p', {class: 'muted'}, 'Nenhuma carta ou pesquisa original na semana.'));
      if ((s.mais_repetidos || []).length) { L.appendChild(h('h4', null, 'O que mais se repetiu entre fontes')); L.appendChild(h('ul', {class: 'lst'}, s.mais_repetidos.map(function (t) { return h('li', null, A.link(t.link) ? h('a', {href: A.link(t.link), target: '_blank', rel: 'noopener'}, t.titulo) : t.titulo, h('span', {class: 'muted'}, ' · ' + t.em + ' fontes')); }))); }
      R.appendChild(h('h4', null, 'Mudanças de visão'));
      R.appendChild(s.mudancas_visao && s.mudancas_visao.length ? h('ul', {class: 'lst'}, s.mudancas_visao.map(function (m) { return h('li', null, typeof m === 'string' ? m : m.t || JSON.stringify(m)); })) : h('p', {class: 'muted'}, s.mudancas_visao_nota || 'Não disponível.'));
      if (ap.length) { R.appendChild(h('h4', null, 'Meus registros da semana (' + ap.length + ')')); R.appendChild(h('ul', {class: 'lst'}, ap.slice(0, 8).map(function (a) { return h('li', null, h('b', null, {aprendizado: 'Aprendizado', tese: 'Tese', mudanca: 'Mudei de visão', duvida: 'Dúvida'}[a.tipo] || a.tipo), ': ', a.nota.slice(0, 160) + (a.nota.length > 160 ? '…' : '')); }))); }
      R.appendChild(h('h4', null, 'Assuntos para estudar'));
      R.appendChild((s.estudar || []).length || (s.perguntas || []).length ? h('div', null, (s.estudar || []).length ? h('ul', {class: 'lst'}, s.estudar.map(function (t) { return h('li', null, h('b', null, t.nome), ' — ' + t.porque); })) : null, (s.perguntas || []).length ? h('ol', {class: 'estudo'}, s.perguntas.map(function (q) { return h('li', null, q); })) : null) : h('p', {class: 'muted'}, 'Nada apontado.'));
      body.appendChild(h('p', {class: 'hint'}, s.n_itens + ' itens na semana · fontes mais ativas: ' + (s.fontes_mais_ativas || []).slice(0, 5).map(function (f) { return f[0] + ' (' + f[1] + ')'; }).join(', ') + (s.ativos_citados && s.ativos_citados.length ? ' · ativos citados: ' + s.ativos_citados.slice(0, 6).map(function (a) { return a[0] + ' ×' + a[1]; }).join(', ') : '') + '. Gerado em ' + A.dataBR(s.gerado_em) + '.'));
      wrap.appendChild(A.sec('Semana ' + s.semana.replace('-S', ' · nº ') + ' · ' + A.dataBR(s.inicio).slice(0, 5) + ' a ' + A.dataBR(s.fim).slice(0, 5), {id: i ? null : 'semana-atual'}, body));
    });
    return wrap;
  }

  /* ---------- aprendizados ---------- */
  function aprendizados() {
    var wrap = h('div'), lista = A.aprendizados(), lidos = STORE.list('leituras');
    var onde = STORE.mode === 'db' ? 'no banco deste painel no claude.ai' : 'neste navegador';
    wrap.appendChild(A.pageHead('Biblioteca', 'Meus aprendizados', 'Registro simples do que cada leitura ensinou: aprendizados, teses a acompanhar, mudanças de visão e dúvidas. Fica salvo ' + onde + '; exporte para guardar ou levar a outro aparelho.',
      h('div', {class: 'row', style: 'gap:6px'}, h('button', {class: 'btn', onclick: function () { A.download('oregon-aprendizados-' + I.hojeBRT() + '.json', I.exportarAprendizados(lista), 'application/json'); }}, 'Exportar'), importar())));
    var tipos = {aprendizado: 0, tese: 0, mudanca: 0, duvida: 0}; lista.forEach(function (a) { tipos[a.tipo] = (tipos[a.tipo] || 0) + 1; });
    wrap.appendChild(h('div', {class: 'mcs'}, [['Registros', lista.length], ['Teses acompanhadas', tipos.tese], ['Mudanças de visão', tipos.mudanca], ['Dúvidas em aberto', tipos.duvida], ['Leituras marcadas', lidos.length]].map(function (k) { return h('div', {class: 'mc'}, h('span', {class: 'k'}, k[0]), h('b', null, String(k[1]))); })));
    wrap.appendChild(A.sec('Novo registro sem conteúdo associado', null, A.formAprendizado(null, {tipo: 'aprendizado', titulo: 'Registro livre', fonte: '', temas: []})));
    if (!lista.length) { wrap.appendChild(h('p', {class: 'empty'}, 'Nenhum registro ainda. Abra um conteúdo e use “Meu aprendizado”.')); return wrap; }
    var fil = {tipo: ''};
    var box = h('div');
    function draw() {
      var L = lista.filter(function (a) { return !fil.tipo || a.tipo === fil.tipo; });
      box.replaceChildren(h('div', {class: 'sub', style: 'margin:0 0 8px'}, [['', 'Todos'], ['aprendizado', 'Aprendizados'], ['tese', 'Teses'], ['mudanca', 'Mudanças de visão'], ['duvida', 'Dúvidas']].map(function (o) { return h('button', {'aria-pressed': fil.tipo === o[0] ? 'true' : 'false', onclick: function () { fil.tipo = o[0]; draw(); }}, o[1]); })),
        h('div', {class: 'nwlist'}, L.map(function (a) {
          return h('article', {class: 'nw ap-' + a.tipo}, h('div', {class: 'nw-top'}, A.chip({aprendizado: 'Aprendizado', tese: 'Tese', mudanca: 'Mudei de visão', duvida: 'Dúvida'}[a.tipo] || a.tipo, 'tp'), h('span', {class: 'muted nw-meta'}, A.dataBR(a.quando) + (a.fonte ? ' · ' + a.fonte : ''))),
            h('h3', {class: 'nw-t'}, a.titulo || '(sem título)', A.link(a.link) ? h('a', {class: 'nw-ext', href: A.link(a.link), target: '_blank', rel: 'noopener', title: 'Abrir a fonte'}, '↗') : null),
            h('p', {class: 'nw-r', style: 'white-space:pre-wrap'}, a.nota),
            h('div', {class: 'row', style: 'gap:6px'}, h('button', {class: 'btn sm', onclick: function () { A.drawer('Editar registro', A.formAprendizado(null, a)); }}, 'Editar'), h('button', {class: 'btn sm', onclick: async function () { if (!confirm('Apagar este registro?')) return; await STORE.del('aprendizados', a.id); A.render(); }}, 'Apagar'), a.item_id ? h('button', {class: 'btn sm', onclick: function () { var x = A.itemPorId(a.item_id); if (x) A.abrirItem(x); else A.toast('O conteúdo não está carregado; use a busca pelo título.'); }}, 'Ver conteúdo') : null));
        })));
    }
    draw(); wrap.appendChild(box);
    return wrap;
  }
  function importar() {
    var inp = h('input', {type: 'file', accept: '.json,application/json', style: 'display:none', onchange: function () {
      var f = inp.files && inp.files[0]; if (!f) return; var r = new FileReader();
      r.onload = async function () { try { var L = I.lerImportacao(String(r.result)); var n = 0; for (var i = 0; i < L.length; i++) { if (!STORE.get('aprendizados', L[i].id)) { await A.salvarAprendizado(L[i]); n++; } } A.toast(n + ' registro(s) importado(s); ' + (L.length - n) + ' já existiam.'); A.render(); } catch (e) { A.toast('Arquivo inválido: ' + (e.message || e)); } };
      r.readAsText(f);
    }});
    return h('span', null, inp, h('button', {class: 'btn', onclick: function () { inp.click(); }}, 'Importar'));
  }

  /* ---------- fontes e coleta ---------- */
  function fontes() {
    var e = E(), wrap = h('div'); A.carregarFontes();
    var col = e.coleta, cont = (col && col.fontes) || {}, u = col && col.ultima;
    wrap.appendChild(A.pageHead('Biblioteca', 'Fontes e coleta', 'O que cada fonte entregou: recebidos, rejeitados (e por quê), já vistos, novos e publicados. Uma fonte que falha não apaga o que publicou antes.'));
    var fx = A.intelFaixa(); if (fx) wrap.appendChild(fx);
    if (u) {
      wrap.appendChild(h('div', {class: 'mcs'}, [['Fontes ok', u.fontes_ok], ['Com falha', u.fontes_erro], ['Recebidos', u.recebidos], ['Novos', u.novos], ['Publicados', u.publicados], ['Mesmo fato (título)', u.duplicados_titulo], ['Já na biblioteca', u.duplicados_id]].map(function (k) { return h('div', {class: 'mc'}, h('span', {class: 'k'}, k[0]), h('b', null, k[1] == null ? '—' : String(k[1]))); })));
      wrap.appendChild(h('p', {class: 'hint'}, 'Última rodada ' + A.dataBR(u.quando) + ' ' + A.hm(u.quando) + ' · janela de ' + u.janela_dias + ' dias.' + (u.aguardando_chave && u.aguardando_chave.length ? ' ' + u.aguardando_chave.length + ' fonte(s) aguardam chave (YOUTUBE_API_KEY nos Secrets).' : '')));
      if (u.erros && u.erros.length) wrap.appendChild(A.more('Falhas da última rodada (' + u.erros.length + ')', h('ul', {class: 'lst'}, u.erros.map(function (x) { return h('li', null, x); }))));
    } else wrap.appendChild(h('p', {class: 'muted'}, e.carregando ? 'Buscando os contadores…' : 'Contadores de coleta ainda não publicados (coleta.json).'));
    var fl = e.fontes || [], porId = {}; fl.forEach(function (f) { porId[f.id] = f; });
    var ids = {}; fl.forEach(function (f) { ids[f.id] = 1; }); Object.keys(cont).forEach(function (k) { ids[k] = 1; });
    var rows = Object.keys(ids).map(function (id) { var f = porId[id] || {}, c = cont[id] || {}, r = c.ultima_rodada || {}; var rej = Object.keys(c.rejeitados || {}).map(function (k) { return k + ' ' + c.rejeitados[k]; }).join(', ');
      var up = c.ultimo_publicado || null, dias = up ? Math.floor((Date.now() - Date.parse(up.length <= 10 ? up + 'T12:00:00-03:00' : up)) / 864e5) : null;
      return {id: id, nome: f.nome || c.nome || id, cat: I.CATEGORIA[f.categoria] || f.categoria || '', metodo: f.metodo || '', ativo: f.ativo, motivo: f.motivo_desligada, aguardando: c.aguardando, pais: f.pais || '', recebidos: c.recebidos, rejeitados: rej, novos: c.novos, publicados: c.publicados, erros: c.erros, ok: c.ultima_ok, erro: c.ultimo_erro, erroEm: c.ultimo_erro_em, tent: r.quando || null, tentErro: r.erro || null, pausa: !!c.pausa || (c.seguidas || 0) >= 3, up: up, dias: dias, rnovos: r.novos, url: f.url_fonte, status: f.status_validacao}; });
    var paradas = rows.filter(function (r) { return r.ativo !== false && r.dias != null && r.dias > 90; }).length, semConteudo = rows.filter(function (r) { return r.ativo !== false && r.tent && r.up == null; }).length;
    if (paradas || semConteudo) wrap.appendChild(h('p', {class: 'hint'}, (paradas ? paradas + ' fonte(s) ativas sem conteúdo novo há mais de 90 dias' : '') + (paradas && semConteudo ? '; ' : '') + (semConteudo ? semConteudo + ' sem data de publicação lida até agora' : '') + '. Conteúdo antigo dessas fontes não aparece como notícia.'));
    var tabela = A.table([
      {k: 'nome', t: 'Fonte', f: function (r) { return h('span', null, A.link(r.url) ? h('a', {href: A.link(r.url), target: '_blank', rel: 'noopener'}, r.nome) : r.nome, h('div', {class: 'muted', style: 'font-size:.78rem'}, [r.cat, r.pais, r.metodo].filter(Boolean).join(' · ') + (r.ativo === false ? ' · desligada: ' + (r.motivo || '') : r.aguardando ? ' · aguardando chave' : ''))); }},
      {k: 'tent', t: 'Última tentativa', f: function (r) { return r.tent ? h('span', {class: r.tentErro ? 'down' : null, title: r.tentErro ? 'Falhou: ' + r.tentErro : 'Leitura ok'}, A.dataBR(r.tent).slice(0, 5) + ' ' + A.hm(r.tent) + (r.tentErro ? ' · falhou' : ''), r.pausa && r.tentErro ? h('small', {class: 'muted', style: 'display:block', title: 'Falhou várias vezes seguidas (bloqueio, tempo esgotado ou endereço sumido): o robô tenta uma vez por dia, sem contornar nada.'}, 'em pausa · 1 tentativa por dia') : null) : (r.ativo === false ? '—' : 'ainda não'); }},
      {k: 'dias', t: 'Último conteúdo', f: function (r) { return r.up ? h('span', {class: r.dias > 90 ? 'down' : r.dias > 30 ? 'muted' : null, title: 'Data de publicação do item mais recente que a fonte oferece'}, A.dataBR(r.up) + ' · ' + (r.dias <= 0 ? 'hoje' : 'há ' + r.dias + ' d')) : h('span', {class: 'muted'}, '—'); }},
      {k: 'erros', t: 'Falha', r: 1, f: function (r) { return r.erros ? h('span', {class: 'down', title: (r.erroEm ? A.dataBR(r.erroEm) + ' ' + A.hm(r.erroEm) + ': ' : '') + (r.erro || '')}, r.erros + (r.erro ? ' · ' + String(r.erro).slice(0, 28) : '')) : (r.aguardando ? h('span', {class: 'muted', title: r.aguardando}, 'chave') : '0'); }},
      {k: 'publicados', t: 'Publicados', r: 1}, {k: 'novos', t: 'Novos', r: 1}, {k: 'recebidos', t: 'Recebidos', r: 1}, {k: 'rejeitados', t: 'Rejeitados', f: function (r) { return r.rejeitados || '—'; }, s: false}
    ], rows, {sort: 'novos', search: 'Filtrar fontes', empty: e.fontesBuscando ? 'Carregando o cadastro…' : 'Sem cadastro de fontes publicado.'});
    wrap.appendChild(A.sec('Fontes cadastradas (' + rows.filter(function (r) { return r.ativo !== false; }).length + ' ativas de ' + rows.length + ')', {flush: true, hint: 'Só conteúdo público e gratuito; robots.txt respeitado; nenhum paywall contornado. O cadastro fica em robo/fontes.json (docs/FONTES.md explica como validar e ligar uma fonte).'}, tabela));
    if (col && col.rodadas && col.rodadas.length > 1) wrap.appendChild(A.sec('Rodadas recentes', {flush: true}, A.table([{k: 'quando', t: 'Quando', f: function (r) { return A.dataBR(r.quando) + ' ' + A.hm(r.quando); }}, {k: 'fontes_ok', t: 'Ok', r: 1}, {k: 'fontes_erro', t: 'Falha', r: 1}, {k: 'recebidos', t: 'Recebidos', r: 1}, {k: 'novos', t: 'Novos', r: 1}, {k: 'publicados', t: 'Publicados', r: 1}], col.rodadas.slice().reverse(), {sort: null})));
    return wrap;
  }

  /* ---------- v3.5 · Estante: acervo permanente (Mauboussin, CFA Research Foundation, Howard Marks, Damodaran, AQR, GMO) ---------- */
  var ES = {col: '', q: '', tema: '', dec: '', ordem: 'rec', max: 60};
  var COR_EST = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6'];  // ordem fixa das coleções (identidade, não valor)
  function corCol(cols, id) { var i = cols.map(function (c) { return c.id; }).indexOf(id); return COR_EST[i] || 'var(--muted)'; }  // da 7ª coleção em diante: cinza (não repete cor)
  function nrm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function dataEst(x) { var d = x.data || ''; return d.length === 10 ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : d.length === 7 ? d.slice(5, 7) + '/' + d.slice(0, 4) : String(x.ano || d || 's/ data'); }
  function estante() {
    var wrap = h('div'), e = E(), est = e.estante;
    wrap.appendChild(A.pageHead('Biblioteca', 'Estante', 'Acervo permanente de autores e séries clássicas, do primeiro texto ao mais recente. O robô acrescenta o que sai de novo; nada sai daqui. Cada título abre a fonte original.'));
    if (!est) { A.carregarEstante(); wrap.appendChild(h('p', {class: 'empty'}, 'Abrindo a estante…')); return wrap; }
    var cols = est.colecoes || [], todos = est.itens || [], temas = est.temas || [];
    if (!todos.length) { wrap.appendChild(h('p', {class: 'empty'}, est.erro && /ainda não publicado/.test(est.erro) ? 'A Estante aparece depois da próxima rodada do robô (ela monta o acervo aos poucos, algumas páginas por rodada).' : est.erro ? 'Não consegui abrir a Estante: ' + est.erro + '.' : 'A Estante ainda está vazia.')); return wrap; }
    var nomeTema = {}; temas.forEach(function (t) { nomeTema[t[0]] = t[1]; });
    // prateleira: uma lombada por coleção, na ordem fixa do cadastro
    wrap.appendChild(h('div', {class: 'est-shelf', role: 'toolbar', 'aria-label': 'Coleções'}, cols.map(function (c) {
      var on = ES.col === c.id;
      return h('button', {class: 'est-spine' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', style: '--sp:' + corCol(cols, c.id), title: c.nome + (c.autor ? ' · ' + c.autor : '') + '. ' + (c.descricao || '') + (c.status === 'enchendo' ? ' · o robô ainda está completando o acervo' : c.status === 'erro' ? ' · última leitura falhou: ' + (c.erro || '') : ''),
        onclick: function () { ES.col = on ? '' : c.id; ES.max = 60; A.rerender(); }},
        h('span', {class: 'est-sp-n'}, c.nome),
        h('span', {class: 'est-sp-c'}, h('b', null, String(c.total || 0)), c.de ? h('small', null, c.de + (c.ate && c.ate !== c.de ? '–' + String(c.ate).slice(2) : '')) : null),
        c.status === 'enchendo' ? h('span', {class: 'est-sp-s'}, 'completando') : c.status === 'erro' ? h('span', {class: 'est-sp-s err', title: 'A última leitura da listagem falhou; o acervo já publicado continua aqui'}, 'falhou') : null);
    })));
    var col = cols.filter(function (c) { return c.id === ES.col; })[0];
    if (col) wrap.appendChild(h('p', {class: 'est-desc'}, col.descricao || '', col.site ? [' ', h('a', {href: col.site, target: '_blank', rel: 'noopener'}, 'Site do autor ↗')] : null, col.nota_links ? h('span', {class: 'muted'}, ' ' + col.nota_links) : null));
    // filtros: texto, tema, década, ordem
    var base0 = todos.filter(function (x) { return !ES.col || x.col === ES.col; });
    var qn = nrm(ES.q).trim();
    var l = base0.filter(function (x) {
      if (ES.tema && (x.temas || []).indexOf(ES.tema) < 0) return false;
      if (ES.dec && String(x.ano || '').slice(0, 3) !== ES.dec) return false;
      if (qn) { var t = nrm(x.titulo + ' ' + (x.resumo || '') + ' ' + (x.instituicao || '') + ' ' + (x.autor || '')); if (qn.split(/\s+/).some(function (w) { return w && t.indexOf(w) < 0; })) return false; }
      return true;
    });
    var chave = function (x) { return x.data || String(x.ano || ''); };
    l.sort(function (a, b) { return ES.ordem === 'ant' ? chave(a).localeCompare(chave(b)) : chave(b).localeCompare(chave(a)); });
    var contT = {}; base0.forEach(function (x) { (x.temas || []).forEach(function (t) { contT[t] = (contT[t] || 0) + 1; }); });
    var decs = {}; base0.forEach(function (x) { if (x.ano) decs[String(x.ano).slice(0, 3)] = 1; });
    var inp = h('input', {class: 'inp est-q', type: 'search', placeholder: 'Buscar no título, autor ou resumo', value: ES.q, 'aria-label': 'Buscar na estante', onkeydown: function (ev) { if (ev.key === 'Enter') { ES.q = ev.target.value; ES.max = 60; A.rerender(); } }, onchange: function (ev) { ES.q = ev.target.value; ES.max = 60; A.rerender(); }});
    wrap.appendChild(h('div', {class: 'est-tools'}, inp,
      h('select', {class: 'inp', 'aria-label': 'Década', onchange: function (ev) { ES.dec = ev.target.value; ES.max = 60; A.rerender(); }}, [h('option', {value: ''}, 'Todas as décadas')].concat(Object.keys(decs).sort().reverse().map(function (d) { return h('option', {value: d, selected: ES.dec === d ? true : null}, 'Anos ' + d + '0'); }))),
      h('select', {class: 'inp', 'aria-label': 'Ordem', onchange: function (ev) { ES.ordem = ev.target.value; A.rerender(); }}, h('option', {value: 'rec', selected: ES.ordem === 'rec' ? true : null}, 'Mais recentes primeiro'), h('option', {value: 'ant', selected: ES.ordem === 'ant' ? true : null}, 'Mais antigos primeiro'))));
    wrap.appendChild(h('div', {class: 'est-temas', role: 'toolbar', 'aria-label': 'Temas'}, temas.filter(function (t) { return contT[t[0]]; }).map(function (t) {
      var on = ES.tema === t[0];
      return h('button', {class: 'tag' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: function () { ES.tema = on ? '' : t[0]; ES.max = 60; A.rerender(); }}, t[1] + ' · ' + contT[t[0]]);
    })));
    wrap.appendChild(h('p', {class: 'muted est-n'}, l.length === base0.length ? l.length + ' itens' : l.length + ' de ' + base0.length + ' itens', ES.q || ES.tema || ES.dec ? [' · ', h('button', {class: 'btn link', onclick: function () { ES.q = ''; ES.tema = ''; ES.dec = ''; A.rerender(); }}, 'limpar filtros')] : null));
    if (!l.length) { wrap.appendChild(h('p', {class: 'empty'}, 'Nada na estante com esses filtros.')); return wrap; }
    var lista = h('div', {class: 'est-list'}), anoAtual = null;
    l.slice(0, ES.max).forEach(function (x) {
      if (x.ano !== anoAtual) { anoAtual = x.ano; lista.appendChild(h('div', {class: 'est-ano'}, anoAtual ? String(anoAtual) : 'Sem data')); }
      var c0 = cols.filter(function (c) { return c.id === x.col; })[0] || {}, lk = A.link(x.link), indice = x.link_tipo === 'indice_autor';
      lista.appendChild(h('article', {class: 'est-it'}, h('span', {class: 'est-dot', style: 'background:' + corCol(cols, x.col), title: c0.nome || ''}),
        h('div', {class: 'est-b'},
          h('h3', {class: 'est-t'}, lk ? h('a', {href: lk, target: '_blank', rel: 'noopener', title: indice ? (x.link_nota || 'Abre o índice do próprio autor') : 'Abrir na fonte original'}, x.titulo) : x.titulo),
          h('p', {class: 'est-m'}, [c0.nome && !ES.col ? c0.nome : null, x.instituicao && x.instituicao !== c0.nome ? x.instituicao : null, x.autor && x.autor !== c0.autor ? x.autor : null, dataEst(x)].filter(Boolean).join(' · '),
            indice ? h('span', {class: 'est-idx', title: x.link_nota || ''}, ' · índice do autor ↗') : lk ? h('span', {class: 'muted'}, ' ↗') : null),
          x.resumo ? h('p', {class: 'est-r'}, x.resumo.length > 260 ? x.resumo.slice(0, 257) + '…' : x.resumo) : null,
          h('div', {class: 'est-f'}, (x.anexos || []).map(function (a) { return h('a', {class: 'chip', href: A.link(a.url), target: '_blank', rel: 'noopener'}, a.rotulo + ' ↗'); }),
            (x.temas || []).slice(0, 3).map(function (t) { return h('button', {class: 'tag sm', onclick: function () { ES.tema = t; ES.max = 60; A.rerender(); }}, nomeTema[t] || t); }),
            A.botaoComite ? A.botaoComite(x) : null,
            (function () { var y = Object.assign({}, x, {fonte: c0.nome || x.instituicao || ''}), bl = h('button', {class: 'btn sm', title: 'Põe na sua fila de leitura (aparece no Hoje)', onclick: async function () { await A.salvar(y, !A.salvo(x.id)); bl.textContent = A.salvo(x.id) ? 'Na fila' : 'Ler depois'; }}, A.salvo(x.id) ? 'Na fila' : 'Ler depois'); return bl; })(),
            h('button', {class: 'btn link sm', onclick: function () { A.drawer('Anotar o que aprendi', A.formAprendizado(null, {tipo: 'aprendizado', titulo: x.titulo, fonte: (c0.nome || '') + (x.ano ? ' · ' + x.ano : ''), link: x.link, temas: []})); }}, 'anotar o que aprendi')))));
    });
    wrap.appendChild(lista);
    if (l.length > ES.max) wrap.appendChild(h('p', {class: 'mais'}, h('button', {class: 'btn sm', onclick: function () { ES.max += 120; A.rerender(); }}, 'Mostrar mais ' + Math.min(120, l.length - ES.max))));
    wrap.appendChild(h('p', {class: 'hint'}, 'Temas por palavra-chave do título (a lista de palavras está em robo/estante.py). Só título, data, link e o resumo que a própria página declara; o texto fica na fonte. ' +
      'Os artigos do Mauboussin anteriores a 2020 (CS First Boston, Legg Mason, Credit Suisse, BlueMountain) não têm mais endereço da editora: o link abre o índice do próprio autor.'));
    return wrap;
  }

  A.abrirEstante = function (col) { ES.col = col || ''; ES.max = 60; A.go('bib', 'estante'); };
  A.SUBS.bib = [['busca', 'Pesquisa'], ['estante', 'Estante'], ['mes', 'Resumo do mês'], ['semanal', 'Resumos semanais'], ['aprendizados', 'Meus aprendizados'], ['fontes', 'Fontes e coleta']];
  A.areas.bib = function () {
    var wrap = h('div'), s = S.sub.bib;
    if (!A.SUBS.bib.some(function (x) { return x[0] === s; })) s = S.sub.bib = 'busca';
    wrap.appendChild(A.subnav('bib', A.SUBS.bib));
    wrap.appendChild(s === 'semanal' ? semanal() : s === 'aprendizados' ? aprendizados() : s === 'fontes' ? fontes() : s === 'mes' ? resumoMes() : s === 'estante' ? estante() : busca());
    return wrap;
  };
})(APP, CORE, INTEL);
