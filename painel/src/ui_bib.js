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
    var q = h('input', {class: 'inp search', type: 'search', value: F.q, placeholder: 'Assunto, autor, gestora, ativo… (ex.: juro real, Oaktree, PETR4)', 'aria-label': 'Buscar', oninput: function () { F.q = q.value; clearTimeout(q.t); q.t = setTimeout(function () { A.rerender(); }, 250); }});
    var de = h('input', {class: 'inp', type: 'date', value: F.de, 'aria-label': 'De', onchange: function () { F.de = de.value; A.rerender(); }}), ate = h('input', {class: 'inp', type: 'date', value: F.ate, 'aria-label': 'Até', onchange: function () { F.ate = ate.value; A.rerender(); }});
    var nAv = AVANC.filter(function (k) { return F[k]; }).length + (F.lidos !== 'todos' ? 1 : 0);
    var grupos = h('div', {class: 'sub filt', role: 'toolbar', 'aria-label': 'Tipo de fonte'}, GRUPOS.map(function (g) {
      var n = g[0] === 'salvos' ? A.salvos().length : g[2] ? base.filter(g[2]).length : base.length;
      return h('button', {'aria-pressed': F.grupo === g[0] ? 'true' : 'false', onclick: function () { F.grupo = g[0]; A.rerender(); }}, g[1], h('small', null, String(n)));
    }));
    var filtros = h('div', {class: 'filtros'},
      h('select', {class: 'inp', 'aria-label': 'Meses carregados', onchange: function (ev) { F.meses = +ev.target.value; A.rerender(); }}, [1, 3, 6, 12, 36].map(function (n) { return h('option', {value: n, selected: F.meses === n || null}, 'últimos ' + n + ' mês' + (n > 1 ? 'es' : '')); })),
      h('select', {class: 'inp', 'aria-label': 'Ordem', onchange: function (ev) { F.ordem = ev.target.value; A.rerender(); }}, [['data', 'mais recentes'], ['prioridade', 'maior prioridade']].map(function (o) { return h('option', {value: o[0], selected: ordem === o[0] || null}, o[1]); })),
      nAv || F.q || F.grupo ? h('button', {class: 'btn sm', onclick: function () { F.de = F.ate = ''; F.lidos = 'todos'; A.bibFiltro({}); }}, 'Limpar') : null);
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
    wrap.appendChild(h('div', {class: 'busca-box'}, q, h('div', {class: 'busca-l'}, grupos, filtros), avanc));
    if (F.grupo === 'salvos') wrap.appendChild(h('p', {class: 'hint'}, 'Itens marcados com “Ler depois” na janela de leitura ou na linha da notícia. Para tirar da lista, abra o item e toque em “Salvo para ler”.'));
    wrap.appendChild(h('p', {class: 'muted', style: 'font-size:.88rem'}, lista.length + ' de ' + (F.grupo === 'salvos' ? A.salvos().length : base.length) + ' itens' + (pend ? ' · carregando meses…' : '') + (F.tema ? ' · assunto: ' + I.temaNome(F.tema) : '') + (F.ativo ? ' · ativo: ' + F.ativo : '')));
    var MAX = F.max || 60;
    wrap.appendChild(A.listaItens(lista, {max: MAX, vazio: F.grupo === 'salvos' ? 'Nada salvo para ler. Use “Ler depois” em qualquer notícia.' : base.length ? 'Nenhum item com estes filtros.' : (pend ? 'Carregando…' : 'A biblioteca ainda não tem itens publicados.')}));
    if (lista.length > MAX) wrap.appendChild(h('p', {style: 'text-align:center'}, h('button', {class: 'btn', onclick: function () { F.max = MAX + 60; A.rerender(); }}, 'Mostrar mais ' + Math.min(60, lista.length - MAX))));
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
      return {id: id, nome: f.nome || c.nome || id, cat: I.CATEGORIA[f.categoria] || f.categoria || '', metodo: f.metodo || '', ativo: f.ativo, motivo: f.motivo_desligada, aguardando: c.aguardando, pais: f.pais || '', recebidos: c.recebidos, rejeitados: rej, novos: c.novos, publicados: c.publicados, erros: c.erros, ok: c.ultima_ok, erro: c.ultimo_erro, erroEm: c.ultimo_erro_em, tent: r.quando || null, tentErro: r.erro || null, up: up, dias: dias, rnovos: r.novos, url: f.url_fonte, status: f.status_validacao}; });
    var paradas = rows.filter(function (r) { return r.ativo !== false && r.dias != null && r.dias > 90; }).length, semConteudo = rows.filter(function (r) { return r.ativo !== false && r.tent && r.up == null; }).length;
    if (paradas || semConteudo) wrap.appendChild(h('p', {class: 'hint'}, (paradas ? paradas + ' fonte(s) ativas sem conteúdo novo há mais de 90 dias' : '') + (paradas && semConteudo ? '; ' : '') + (semConteudo ? semConteudo + ' sem data de publicação lida até agora' : '') + '. Conteúdo antigo dessas fontes não aparece como notícia.'));
    var tabela = A.table([
      {k: 'nome', t: 'Fonte', f: function (r) { return h('span', null, A.link(r.url) ? h('a', {href: A.link(r.url), target: '_blank', rel: 'noopener'}, r.nome) : r.nome, h('div', {class: 'muted', style: 'font-size:.78rem'}, [r.cat, r.pais, r.metodo].filter(Boolean).join(' · ') + (r.ativo === false ? ' · desligada: ' + (r.motivo || '') : r.aguardando ? ' · aguardando chave' : ''))); }},
      {k: 'tent', t: 'Última tentativa', f: function (r) { return r.tent ? h('span', {class: r.tentErro ? 'down' : null, title: r.tentErro ? 'Falhou: ' + r.tentErro : 'Leitura ok'}, A.dataBR(r.tent).slice(0, 5) + ' ' + A.hm(r.tent) + (r.tentErro ? ' · falhou' : '')) : (r.ativo === false ? '—' : 'ainda não'); }},
      {k: 'dias', t: 'Último conteúdo', f: function (r) { return r.up ? h('span', {class: r.dias > 90 ? 'down' : r.dias > 30 ? 'muted' : null, title: 'Data de publicação do item mais recente que a fonte oferece'}, A.dataBR(r.up) + ' · ' + (r.dias <= 0 ? 'hoje' : 'há ' + r.dias + ' d')) : h('span', {class: 'muted'}, '—'); }},
      {k: 'erros', t: 'Falha', r: 1, f: function (r) { return r.erros ? h('span', {class: 'down', title: (r.erroEm ? A.dataBR(r.erroEm) + ' ' + A.hm(r.erroEm) + ': ' : '') + (r.erro || '')}, r.erros + (r.erro ? ' · ' + String(r.erro).slice(0, 28) : '')) : (r.aguardando ? h('span', {class: 'muted', title: r.aguardando}, 'chave') : '0'); }},
      {k: 'publicados', t: 'Publicados', r: 1}, {k: 'novos', t: 'Novos', r: 1}, {k: 'recebidos', t: 'Recebidos', r: 1}, {k: 'rejeitados', t: 'Rejeitados', f: function (r) { return r.rejeitados || '—'; }, s: false}
    ], rows, {sort: 'novos', search: 'Filtrar fontes', empty: e.fontesBuscando ? 'Carregando o cadastro…' : 'Sem cadastro de fontes publicado.'});
    wrap.appendChild(A.sec('Fontes cadastradas (' + rows.filter(function (r) { return r.ativo !== false; }).length + ' ativas de ' + rows.length + ')', {flush: true, hint: 'Só conteúdo público e gratuito; robots.txt respeitado; nenhum paywall contornado. O cadastro fica em robo/fontes.json (docs/FONTES.md explica como validar e ligar uma fonte).'}, tabela));
    if (col && col.rodadas && col.rodadas.length > 1) wrap.appendChild(A.sec('Rodadas recentes', {flush: true}, A.table([{k: 'quando', t: 'Quando', f: function (r) { return A.dataBR(r.quando) + ' ' + A.hm(r.quando); }}, {k: 'fontes_ok', t: 'Ok', r: 1}, {k: 'fontes_erro', t: 'Falha', r: 1}, {k: 'recebidos', t: 'Recebidos', r: 1}, {k: 'novos', t: 'Novos', r: 1}, {k: 'publicados', t: 'Publicados', r: 1}], col.rodadas.slice().reverse(), {sort: null})));
    return wrap;
  }

  A.SUBS.bib = [['busca', 'Pesquisa'], ['semanal', 'Resumos semanais'], ['aprendizados', 'Meus aprendizados'], ['fontes', 'Fontes e coleta']];
  A.areas.bib = function () {
    var wrap = h('div'), s = S.sub.bib;
    if (!A.SUBS.bib.some(function (x) { return x[0] === s; })) s = S.sub.bib = 'busca';
    wrap.appendChild(A.subnav('bib', A.SUBS.bib));
    wrap.appendChild(s === 'semanal' ? semanal() : s === 'aprendizados' ? aprendizados() : s === 'fontes' ? fontes() : busca());
    return wrap;
  };
})(APP, CORE, INTEL);
