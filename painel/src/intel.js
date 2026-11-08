/* INTEL — camada de dados do Oregon Intelligence e vistas compartilhadas de conteúdo.
   Lê os arquivos públicos gerados pelo robô (data/): versao.json (pequeno, consultado a cada 10 min), macro.json,
   recentes.json, hoje.json, coleta.json, semanal.json, fontes.json, resultados.json e biblioteca/AAAA-MM.json (sob demanda).
   Nada é inventado: arquivo que falta aparece como falta; nenhum número é estimado. Nenhuma chave existe aqui. */
var INTEL = (function () {
  'use strict';
  var I = {};
  var TX = (typeof TAXON !== 'undefined') ? TAXON : {temas: {}, regioes: {}, fatores: {}, tipos: {}};
  I.TX = TX;
  I.temaNome = function (t) { return TX.temas[t] || t; };
  I.regiaoNome = function (r) { return TX.regioes[r] || r; };
  I.fatorNome = function (k) { return TX.fatores[k] || k; };
  I.tipoNome = function (t) { return TX.tipos[t] || t || 'Conteúdo'; };
  I.CATEGORIA = {gestora_internacional: 'Gestora internacional', gestora_brasil: 'Gestora brasileira', instituicao: 'Instituição', academia: 'Academia', oficial_empresa: 'Empresa (oficial)', youtube: 'Canal oficial', veiculo: 'Imprensa'};
  I.ROTULO = {FATO: 'Fato', FONTE: 'Opinião da fonte', 'INFERÊNCIA': 'Inferência do sistema'};
  I.PONTOS = [['1_publicacao', 'O que foi publicado e quem é a fonte'], ['2_tese', 'Tese ou informação central'], ['3_evidencias', 'Evidências'], ['4_contrarios', 'Argumentos contrários'],
    ['5_regioes', 'O que pode representar para Brasil, EUA e outras regiões'], ['6_oregon', 'Ativos, setores e fatores da Oregon'], ['7_monitorar', 'O que acompanhar para validar ou invalidar']];

  function pub(x) { return (x && (x.publicado_em || x.detectado_em)) || ''; }
  I.pub = pub;
  I.pontos = function (x) { return (x && x.prioridade && x.prioridade.pontos) || 0; };
  I.nivel = function (x) { return (x && x.prioridade && x.prioridade.nivel) || 'baixa'; };
  I.hojeBRT = function (d) { d = d || new Date(); try { var s = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'}).format(d); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; } catch (e) {} return d.toISOString().slice(0, 10); };
  I.menosDias = function (iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  // Junta listas de itens sem repetir (o mesmo id pode estar em recentes e no arquivo do mês), mais recentes primeiro
  I.juntar = function (listas) {
    var vis = {}, out = [];
    listas.forEach(function (l) { (l || []).forEach(function (x) { if (!x || !x.id || vis[x.id] || x.agrupado_em) return; vis[x.id] = 1; out.push(x); }); });
    out.sort(function (a, b) { return pub(b).localeCompare(pub(a)); });
    return out;
  };
  // Busca e filtros da Biblioteca (funções puras, testadas no Node)
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  I.norm = norm;
  I.filtrar = function (itens, f) {
    f = f || {};
    var q = norm(f.q || '').trim(), de = f.de || '', ate = f.ate || '';
    return itens.filter(function (x) {
      if (f.tema && (x.temas || []).indexOf(f.tema) < 0) return false;
      if (f.regiao && (x.regioes || []).indexOf(f.regiao) < 0) return false;
      if (f.tipo && x.tipo !== f.tipo) return false;
      if (f.categoria && x.categoria !== f.categoria) return false;
      if (f.org && (x.organizacao || x.fonte) !== f.org) return false;
      if (f.ativo && (x.ativos || []).indexOf(f.ativo) < 0) return false;
      if (f.nivel && I.nivel(x) !== f.nivel) return false;
      var d = pub(x).slice(0, 10);
      if (de && d < de) return false;
      if (ate && d > ate) return false;
      if (q) { var alvo = norm([x.titulo, x.resumo, x.organizacao, x.fonte, x.autor, (x.temas || []).map(I.temaNome).join(' '), (x.ativos || []).join(' ')].join(' ')); if (q.split(/\s+/).some(function (w) { return alvo.indexOf(w) < 0; })) return false; }
      return true;
    });
  };
  I.contagens = function (itens, campo) { var o = {}; itens.forEach(function (x) { var v = x[campo]; (Array.isArray(v) ? v : [v]).forEach(function (k) { if (k) o[k] = (o[k] || 0) + 1; }); }); return o; };
  // Ordem para o briefing local, quando hoje.json não existe: pontos, depois data
  I.ordenar = function (itens) { return itens.slice().sort(function (a, b) { return (I.pontos(b) - I.pontos(a)) || pub(b).localeCompare(pub(a)); }); };
  // Pilar da Oregon → fator de risco acompanhado (para ligar conteúdo a ETFs sem inventar menção)
  I.FATOR_PILAR = {P1: 'selic', P2: 'pre', P3: 'spread', P4: 'real', P9: 'ust', P10: 'spread', P11: 'sp', P12: 'em', P13: 'btc'};
  I.exportarAprendizados = function (lista) { return JSON.stringify({produto: 'Oregon Intelligence', tipo: 'aprendizados', exportado_em: new Date().toISOString(), itens: lista}, null, 1); };
  I.lerImportacao = function (txt) {
    var j = JSON.parse(txt); var arr = Array.isArray(j) ? j : (j && Array.isArray(j.itens) ? j.itens : null);
    if (!arr) throw new Error('arquivo sem a lista de aprendizados');
    return arr.filter(function (a) { return a && typeof a === 'object' && a.id && (a.nota || a.titulo); }).map(function (a) { return {id: String(a.id), quando: a.quando || new Date().toISOString(), item_id: a.item_id || null, titulo: String(a.titulo || '').slice(0, 300), fonte: String(a.fonte || '').slice(0, 120), link: /^https?:\/\//i.test(a.link || '') ? a.link : null, temas: Array.isArray(a.temas) ? a.temas.slice(0, 6) : [], tipo: ['aprendizado', 'tese', 'duvida', 'mudanca'].indexOf(a.tipo) >= 0 ? a.tipo : 'aprendizado', nota: String(a.nota || '').slice(0, 4000)}; });
  };
  if (typeof module !== 'undefined') module.exports = I;
  return I;
})();

(function (A, C, I) {
  'use strict';
  if (typeof document === 'undefined' || !A) return;
  var h = A.h, S = A.S;
  var E = {versao: null, macro: null, recentes: null, hoje: null, coleta: null, semanal: null, fontes: null, res: null, meses: {}, carregando: false, erro: null, ultimo: null, timer: null, falhas: 0};
  A.intel = E;
  var SITE_PADRAO = 'https://lucaslimaequity-a11y.github.io/robo-oregon/';
  function noClaude() { return !!(window.claude && window.claude.use) || STORE.mode === 'db'; }
  function base() {
    try { if (/^https?:$/.test(location.protocol) && !noClaude()) return new URL('data/', location.href).href; } catch (e) {}
    return SITE_PADRAO + 'data/';  // no claude.ai e no arquivo local: tenta o site público; se não der, a tela diz
  }
  async function getJSON(url, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, t = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 12000);
    try { var r = await fetch(url, {signal: ctl ? ctl.signal : undefined, cache: 'no-store'}); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
    finally { clearTimeout(t); }
  }
  function marca() { return '?t=' + Date.now(); }
  function motivo(e) { var m = String(e && (e.message || e) || ''); return /HTTP 404/.test(m) ? 'arquivo ainda não publicado pelo robô' : /HTTP/.test(m) ? m : /abort/i.test(m) ? 'sem resposta' : /fetch|network|Failed/i.test(m) ? 'sem acesso ao endereço (rede ou bloqueio desta visualização)' : (m || 'falha'); }
  function renderSeguro() {
    var ae = document.activeElement;
    if (document.querySelector('.drawer') || document.querySelector('.cmdk-bg') || (ae && ae.closest && ae.closest('#main') && /INPUT|TEXTAREA|SELECT/.test(ae.tagName))) { clearTimeout(E.rsT); E.rsT = setTimeout(renderSeguro, 1500); return; }
    (A.rerender || A.render)();
  }
  async function carregarTudo() {
    var b = base(), st = {};
    async function um(nome, ms) { try { var j = await getJSON(b + nome + marca(), ms); st[nome] = {ok: true}; return j; } catch (e) { st[nome] = {ok: false, msg: motivo(e), ausente: /404/.test(String(e && e.message))}; return undefined; } }
    var r = await Promise.all([um('macro.json', 15000), um('recentes.json', 30000), um('hoje.json'), um('coleta.json', 20000), um('semanal.json', 15000)]);
    if (r[0] !== undefined) E.macro = r[0];
    if (r[1] !== undefined) E.recentes = r[1];
    if (r[2] !== undefined) E.hoje = r[2];
    if (r[3] !== undefined) E.coleta = r[3];
    if (r[4] !== undefined) E.semanal = r[4];
    E.status = st;
    E.ultimo = new Date().toISOString();
  }
  async function atualizar(manual) {
    if (E.carregando) return; E.carregando = true; E.erro = null;
    var mudou = true;
    try {
      var v = null;
      try { v = await getJSON(base() + 'versao.json' + marca(), 8000); E.falhas = 0; } catch (e) { E.falhas++; E.erro = motivo(e); }
      if (v && v.produto !== 'Oregon Intelligence') { E.versaoAntiga = v; }  // robô antigo ainda rodando: a tela avisa
      if (v && E.versao && v.gerado_em === E.versao.gerado_em && !manual) mudou = false;
      if (v) E.versao = v;
      if (mudou && (v || !E.recentes)) await carregarTudo();
    } finally { E.carregando = false; if (mudou || manual) renderSeguro(); else if (A.renderTop) A.renderTop(); }
  }
  A.intelAtualizar = function () { return atualizar(true); };
  A.intelIniciar = function () {
    setTimeout(function () { atualizar(false); }, 30);
    E.timer = setInterval(function () { if (!document.hidden) atualizar(false); }, 10 * 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && E.ultimo && Date.now() - new Date(E.ultimo).getTime() > 10 * 60000) atualizar(false); });
  };
  // Meses da biblioteca sob demanda (cada mês é um arquivo); devolve o que já está em memória e busca o resto
  A.carregarMes = function (mes) {
    if (E.meses[mes]) return E.meses[mes].promessa || Promise.resolve(E.meses[mes].itens);
    var p = getJSON(base() + 'biblioteca/' + mes + '.json' + marca(), 40000).then(function (j) { E.meses[mes] = {itens: (j && j.itens) || [], ok: true}; renderSeguro(); return E.meses[mes].itens; }, function (e) { E.meses[mes] = {itens: [], ok: false, msg: motivo(e)}; renderSeguro(); return []; });
    E.meses[mes] = {itens: [], promessa: p, carregando: true};
    return p;
  };
  A.mesesDisponiveis = function () { return (E.versao && E.versao.meses) || []; };
  A.carregarFontes = function () {
    if (E.fontes || E.fontesBuscando) return;
    E.fontesBuscando = true;
    getJSON(base() + 'fontes.json' + marca(), 20000).then(function (j) { E.fontes = j && j.fontes ? j.fontes : (Array.isArray(j) ? j : []); }, function () { E.fontes = []; E.fontesFalhou = true; }).then(function () { E.fontesBuscando = false; renderSeguro(); });
  };
  // Resultados da CVM (resultados.json): baixado quando uma ficha pede, uma vez por sessão (10 min de espera após falha)
  A.resultadosDe = function (t) {
    var vencido = E.resFalhou && Date.now() - E.resFalhou > 10 * 60000;
    if ((!E.resLido || vencido) && !E.resBuscando) {
      E.resBuscando = true;
      E.resPromise = getJSON(base() + 'resultados.json' + marca(), 30000)
        .then(function (j) { E.res = j && j.empresas ? j : null; E.resFalhou = null; E.resAusente = !E.res; }, function (e) { E.res = null; E.resFalhou = Date.now(); E.resAusente = /HTTP 404/.test(String(e && e.message)); })
        .then(function () { E.resBuscando = false; E.resLido = true; renderSeguro(); });
    }
    return {carregando: !!E.resBuscando, promessa: E.resPromise || null, falhou: !!E.resFalhou && !E.resAusente, dados: E.res || null, emp: E.res && E.res.empresas ? (E.res.empresas[t] || null) : null, fora: E.res && E.res.fora ? (E.res.fora[t] || null) : null};
  };
  // Todos os itens em memória (recentes + meses já carregados), sem repetição
  A.itens = function () { var L = [E.recentes && E.recentes.itens]; Object.keys(E.meses).sort().reverse().forEach(function (m) { L.push(E.meses[m].itens); }); return I.juntar(L); };
  A.itemPorId = function (id) { var t = A.itens(); for (var i = 0; i < t.length; i++) if (t[i].id === id) return t[i]; return null; };
  A.itensDe = function (t) { return A.itens().filter(function (x) { return (x.ativos || []).indexOf(t) >= 0; }); };
  A.itensSetor = function (sid) { return A.itens().filter(function (x) { return (x.setores || []).indexOf(sid) >= 0; }); };
  A.itensFator = function (k) { return A.itens().filter(function (x) { return (x.fatores || []).indexOf(k) >= 0; }); };
  A.itensTema = function (t) { return A.itens().filter(function (x) { return (x.temas || []).indexOf(t) >= 0; }); };

  /* ---------- leitura e aprendizados (neste navegador; no claude.ai, no banco do painel) ---------- */
  A.lido = function (id) { return !!STORE.get('leituras', id); };
  A.marcarLido = async function (x, lido) { if (lido === false) { await STORE.del('leituras', x.id); return; } await STORE.put('leituras', x.id, {quando: STORE.now(), titulo: x.titulo, fonte: x.organizacao || x.fonte, temas: x.temas || []}); };
  A.aprendizados = function () { return STORE.list('aprendizados').sort(function (a, b) { return String(b.quando).localeCompare(String(a.quando)); }); };
  A.salvarAprendizado = async function (reg) {
    var id = reg.id || STORE.newId('ap');
    await STORE.put('aprendizados', id, {quando: reg.quando || STORE.now(), item_id: reg.item_id || null, titulo: reg.titulo || '', fonte: reg.fonte || '', link: A.link(reg.link) || null, temas: reg.temas || [], tipo: reg.tipo || 'aprendizado', nota: String(reg.nota || '').trim()});
    return id;
  };

  /* ---------- vistas de conteúdo ---------- */
  var TIPO_CLS = {carta: 'c-carta', research: 'c-research', paper: 'c-research', macro: 'c-macro', dado_oficial: 'c-oficial', documento_oficial: 'c-oficial', discurso: 'c-oficial', relatorio: 'c-research', video: 'c-video', noticia: 'c-noticia', blog: 'c-research', podcast: 'c-video'};
  function quandoTxt(x) { return x.publicado_em ? A.dataBR(x.publicado_em) : (x.detectado_em ? 'detectado em ' + A.dataBR(x.detectado_em) : ''); }
  A.quandoTxt = quandoTxt;
  function chipsItem(x, opt) {
    opt = opt || {};
    var n = I.nivel(x), ch = [A.chip(I.tipoNome(x.tipo), 'tp ' + (TIPO_CLS[x.tipo] || ''))];
    if (!opt.semNivel) ch.push(A.chip(n === 'alta' ? 'prioridade alta' : n === 'media' ? 'prioridade média' : 'prioridade baixa', n === 'alta' ? 'g-critica' : n === 'media' ? 'g-media' : '', (x.prioridade && x.prioridade.porque || []).join(' · ')));
    if (x.analise && x.analise.profunda) ch.push(A.chip('análise IA', 'o-ia', 'Leitura por IA sobre o título e o resumo público'));
    if (x.natureza === 'promocional' || x.natureza === 'sensacionalista' || x.natureza === 'recomendacao') ch.push(A.chip(x.natureza === 'recomendacao' ? 'recomendação (fora do método)' : x.natureza, 'g-baixa'));
    if (A.lido(x.id)) ch.push(A.chip('lido', 'o-obs'));
    return ch;
  }
  // Cartão de conteúdo: título abre a análise (gaveta); o ícone ↗ abre a fonte original em nova aba
  A.itemCard = function (x, opt) {
    opt = opt || {};
    var org = x.organizacao || x.fonte, lk = A.link(x.link);
    var card = h('article', {class: 'nw ' + (TIPO_CLS[x.tipo] || '') + (A.lido(x.id) ? ' lido' : ''), 'data-id': x.id});
    card.appendChild(h('div', {class: 'nw-top'}, chipsItem(x, opt), h('span', {class: 'muted nw-meta'}, org + (x.autor ? ' · ' + x.autor : '') + (quandoTxt(x) ? ' · ' + quandoTxt(x) : ''))));
    card.appendChild(h('h3', {class: 'nw-t'}, h('button', {class: 'nwl', onclick: function () { A.abrirItem(x); }}, x.titulo), lk ? h('a', {class: 'nw-ext', href: lk, target: '_blank', rel: 'noopener', title: 'Abrir a fonte original', 'aria-label': 'Abrir a fonte original'}, '↗') : null));
    if (x.resumo && !opt.semResumo) card.appendChild(h('p', {class: 'nw-r'}, x.resumo));
    var tags = (x.temas || []).slice(0, 3).map(function (t) { return h('button', {class: 'tag', onclick: function () { A.go('bib', 'busca'); if (A.bibFiltro) A.bibFiltro({tema: t}); }}, I.temaNome(t)); })
      .concat((x.ativos || []).slice(0, 4).map(function (t) { return h('button', {class: 'tag tk', onclick: function () { A.abrirFicha(t); }}, t); }));
    if (x.tambem_em && x.tambem_em.length) tags.push(h('span', {class: 'tag mu', title: x.tambem_em.map(function (t) { return t.fonte; }).join(', ')}, '+' + x.tambem_em.length + ' fonte(s)'));
    if (tags.length) card.appendChild(h('div', {class: 'nw-tags'}, tags));
    return card;
  };
  A.listaItens = function (itens, opt) { opt = opt || {}; if (!itens.length) return h('p', {class: 'empty'}, opt.vazio || 'Nada aqui ainda.'); return h('div', {class: 'nwlist'}, itens.slice(0, opt.max || itens.length).map(function (x) { return A.itemCard(x, opt); })); };
  // Análise em sete pontos, com o rótulo de cada frase. Nada aqui vira recomendação.
  A.analiseView = function (x) {
    var an = x.analise;
    if (!an) return h('p', {class: 'muted'}, 'Este item ainda não tem análise (foi coletado por uma versão anterior do robô). Abra a fonte original.');
    var box = h('div', {class: 'an'});
    box.appendChild(h('div', {class: 'alert ' + (an.profunda ? 'ok' : 'warn'), style: 'margin-top:0;font-size:.86rem'}, h('b', null, an.profunda ? 'Análise aprofundada (IA). ' : 'Análise por regras. '), an.aviso || ''));
    box.appendChild(h('p', {class: 'an-leg'}, Object.keys(I.ROTULO).map(function (k) { return h('span', {class: 'rot r-' + k.toLowerCase().replace('ê', 'e')}, I.ROTULO[k]); })));
    I.PONTOS.forEach(function (p, i) {
      var frases = an[p[0]] || [];
      box.appendChild(h('section', {class: 'an-p'}, h('h4', null, h('span', {class: 'an-n'}, String(i + 1)), p[1]), frases.length ? h('ul', null, frases.map(function (f) { return h('li', null, h('span', {class: 'rot r-' + String(f.r).toLowerCase().replace('ê', 'e'), title: I.ROTULO[f.r] || f.r}, I.ROTULO[f.r] || f.r), ' ', f.t); })) : h('p', {class: 'muted'}, 'Não avaliado.')));
    });
    if (x.prioridade) box.appendChild(h('p', {class: 'hint'}, 'Prioridade ' + x.prioridade.nivel + ' (' + x.prioridade.pontos + ' pontos): ' + (x.prioridade.porque || []).join('; ') + '. A prioridade só ordena; nenhum item é escondido.'));
    return box;
  };
  A.abrirItem = function (x) {
    var lk = A.link(x.link), body = h('div', {class: 'item-full'});
    body.appendChild(h('div', {class: 'nw-top'}, chipsItem(x), h('span', {class: 'muted nw-meta'}, (I.CATEGORIA[x.categoria] || x.categoria || '') + ' · ' + (x.organizacao || x.fonte) + (x.pais ? ' · ' + x.pais : '') + (x.autor ? ' · ' + x.autor : '') + (quandoTxt(x) ? ' · ' + quandoTxt(x) : ''))));
    body.appendChild(h('div', {class: 'row', style: 'gap:8px;flex-wrap:wrap;margin:10px 0'},
      lk ? h('a', {class: 'btn pri', href: lk, target: '_blank', rel: 'noopener'}, 'Abrir a fonte original ↗') : h('span', {class: 'alert bad', style: 'margin:0'}, 'Item sem link válido.'),
      x.pdf && A.link(x.pdf) && x.pdf !== x.link ? h('a', {class: 'btn', href: A.link(x.pdf), target: '_blank', rel: 'noopener'}, 'PDF') : null,
      h('button', {class: 'btn', onclick: async function () { await A.marcarLido(x, !A.lido(x.id)); A.abrirItem(x); }}, A.lido(x.id) ? 'Desmarcar leitura' : 'Marcar como lido')));
    if (x.resumo) body.appendChild(h('p', {class: 'nw-r', style: 'font-size:.98rem'}, h('span', {class: 'rot r-fonte'}, 'Resumo da fonte'), ' ', x.resumo));
    if (x.data_estimada) body.appendChild(h('p', {class: 'hint'}, 'A página não informa a data de publicação: a data mostrada é a de detecção pelo robô.'));
    if (x.tambem_em && x.tambem_em.length) body.appendChild(h('p', {style: 'font-size:.9rem'}, h('b', null, 'O mesmo fato em: '), x.tambem_em.map(function (t, i) { return h('span', null, i ? ' · ' : '', A.link(t.link) ? h('a', {href: A.link(t.link), target: '_blank', rel: 'noopener'}, t.fonte) : t.fonte); })));
    var tags = (x.temas || []).map(function (t) { return A.chip(I.temaNome(t)); }).concat((x.regioes || []).map(function (r) { return A.chip(I.regiaoNome(r), 'o-q'); }), (x.fatores || []).map(function (f) { return A.chip(I.fatorNome(f), 'o-e'); }));
    if (tags.length) body.appendChild(h('div', {class: 'row', style: 'gap:6px;flex-wrap:wrap;margin:0 0 10px'}, tags));
    if (x.ativos && x.ativos.length) body.appendChild(h('p', {style: 'font-size:.92rem'}, h('b', null, 'Ativos da Oregon citados: '), x.ativos.map(function (t, i) { return h('span', null, i ? ', ' : '', h('button', {class: 'btn link', onclick: function () { d.remove(); A.abrirFicha(t); }}, t), x.ativos_porque && x.ativos_porque[t] && x.ativos_porque[t] !== t ? h('span', {class: 'muted'}, ' (“' + x.ativos_porque[t] + '”)') : null); }), h('span', {class: 'muted'}, ' · ligação por menção no texto público, não é posição presumida')));
    body.appendChild(h('h3', null, 'Análise em sete pontos'));
    body.appendChild(A.analiseView(x));
    body.appendChild(h('h3', null, 'Meu aprendizado'));
    body.appendChild(A.formAprendizado(x));
    var d = A.drawer(x.titulo, body); d.classList.add('wide');
    return d;
  };
  A.formAprendizado = function (x, existente) {
    var reg = existente || {tipo: 'aprendizado', nota: ''};
    var tipo = h('select', {class: 'inp'}, [['aprendizado', 'Aprendizado'], ['tese', 'Tese que quero acompanhar'], ['mudanca', 'Mudei de visão'], ['duvida', 'Dúvida para estudar']].map(function (o) { return h('option', {value: o[0], selected: reg.tipo === o[0] || null}, o[1]); }));
    var nota = h('textarea', {class: 'inp w', style: 'min-height:80px', placeholder: 'O que este conteúdo me ensinou, a premissa que ele assume, o que eu discordo…'}); nota.value = reg.nota || '';
    var onde = STORE.mode === 'db' ? 'no banco deste painel' : 'neste navegador (exporte em Biblioteca → Aprendizados para levar a outro aparelho)';
    return h('div', {class: 'form-ap'}, h('div', {class: 'row', style: 'gap:8px;flex-wrap:wrap'}, tipo, h('button', {class: 'btn pri', onclick: async function () {
      if (!nota.value.trim()) { A.toast('Escreva a nota antes de salvar.'); return; }
      await A.salvarAprendizado({id: reg.id, quando: reg.quando, item_id: x ? x.id : (reg.item_id || null), titulo: x ? x.titulo : reg.titulo, fonte: x ? (x.organizacao || x.fonte) : reg.fonte, link: x ? x.link : reg.link, temas: x ? x.temas : reg.temas, tipo: tipo.value, nota: nota.value});
      A.toast('Aprendizado salvo ' + onde + '.'); if (x) { try { await A.marcarLido(x, true); } catch (e) {} }
      var d = document.querySelector('.drawer'); if (d) d.remove(); A.render();
    }}, existente ? 'Salvar alteração' : 'Salvar no registro')), nota, h('p', {class: 'hint'}, 'Fica salvo ' + onde + '. O registro alimenta o resumo semanal pessoal.'));
  };

  /* ---------- macro (indicadores oficiais) ---------- */
  A.macroCards = function (compacto) {
    var m = E.macro; if (!m) return h('p', {class: 'muted'}, E.carregando ? 'Buscando os indicadores…' : 'Indicadores ainda não publicados pelo robô' + (E.erro ? ' (' + E.erro + ')' : '') + '.');
    var ind = m.indicadores || {}, cv = m.curva || {}, cards = [];
    function card(nome, nivel, unid, varr, uvar, data, fonte, extra) {
      var vtxt = varr == null ? '' : (uvar === 'pp' ? A.snum(varr * 100, 0) + ' bps' : A.snum(varr, 2) + '%');
      return h('div', {class: 'mc' + (extra && extra.reaproveitado ? ' velho' : '')}, h('span', {class: 'k'}, nome), h('b', null, nivel == null ? '—' : A.num(nivel, unid === 'R$' ? 2 : 2) + (unid === 'R$' ? '' : ' ' + unid)), h('small', null, (vtxt ? h('span', {class: A.cls(varr)}, vtxt) : null), (vtxt ? ' · ' : '') + (data ? A.dataBR(data) : '') + (extra && extra.reaproveitado ? ' · leitura anterior' : '') + (extra && extra.status === 'desatualizado' ? ' · desatualizado' : '')), compacto ? null : h('small', {class: 'muted'}, fonte || ''));
    }
    [['selic', 'Selic'], ['cdi', 'CDI'], ['ipca_12m', 'IPCA 12 meses'], ['ipca_mes', 'IPCA do mês'], ['ptax', 'Dólar PTAX']].forEach(function (k) { var x = ind[k[0]]; if (x) cards.push(card(k[1], x.nivel, x.unid, x.var, x.uvar, x.data, x.fonte, x)); });
    [['pre', 'Prefixado 2032'], ['real', 'IPCA+ 2035'], ['ust2', 'Treasury 2 anos'], ['ust10', 'Treasury 10 anos']].forEach(function (k) { var x = cv[k[0]]; if (x) cards.push(card(k[1], x.nivel, '% a.a.', x.var, 'pp', x.data, x.fonte, x)); });
    var f = m.focus;
    if (f && f.IPCA && f.IPCA.anos) { var anos = Object.keys(f.IPCA.anos).sort(); var a0 = f.IPCA.anos[anos[0]]; cards.push(card('Focus IPCA ' + anos[0], a0.mediana, '%', a0.var, 'pp', f.IPCA.data, 'Banco Central · Focus (mediana)', f)); if (f.Selic && f.Selic.anos && f.Selic.anos[anos[0]]) cards.push(card('Focus Selic ' + anos[0], f.Selic.anos[anos[0]].mediana, '% a.a.', f.Selic.anos[anos[0]].var, 'pp', f.Selic.data, 'Banco Central · Focus (mediana)', f)); }
    if (!cards.length) return h('p', {class: 'muted'}, 'Nenhum indicador disponível na última rodada (' + Object.keys(m.fontes || {}).filter(function (k) { return m.fontes[k].ok === false; }).map(function (k) { return k + ': ' + m.fontes[k].msg; }).join('; ') + ').');
    return h('div', null, h('div', {class: 'mcs'}, cards), h('p', {class: 'hint'}, (m.nota || '') + ' Gerado em ' + A.dataBR(m.gerado_em) + ' ' + hm(m.gerado_em) + '. Variações contra a leitura anterior; em pontos-base (bps) para taxas.'));
  };
  A.agendaView = function (max) {
    var ag = E.macro && E.macro.agenda, hoje = I.hojeBRT();
    if (!ag || !ag.itens) return h('p', {class: 'muted'}, 'Agenda não publicada pelo robô.');
    var prox = ag.itens.filter(function (a) { return a.data >= hoje; }).slice(0, max || 8);
    if (!prox.length) return h('p', {class: 'muted'}, 'Nada agendado nos próximos ' + ag.dias + ' dias nas fontes oficiais.');
    return h('ul', {class: 'agenda'}, prox.map(function (a) { return h('li', {class: a.data === hoje ? 'hoje' : null}, h('b', null, A.dataBR(a.data).slice(0, 5) + (a.hora ? ' ' + a.hora : '')), ' ', A.link(a.link) ? h('a', {href: A.link(a.link), target: '_blank', rel: 'noopener'}, a.titulo) : a.titulo, a.previsto ? h('span', {class: 'muted'}, ' · previsto') : null, h('small', {class: 'muted'}, ' · ' + (a.fonte || ''))); }));
  };
  function hm(iso) { try { return new Date(iso).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}); } catch (e) { return ''; } }
  A.hm = hm;
  // Estado dos dados no topo: hora da última rodada e situação
  A.dadosPill = function () {
    var v = E.versao, txt, cls;
    if (!v) { txt = E.carregando ? 'buscando…' : 'sem dados'; cls = E.erro ? 'critico' : 'parcial'; }
    else { txt = 'Robô ' + A.dataBR(v.gerado_em).slice(0, 5) + ' ' + hm(v.gerado_em); var velho = Date.now() - new Date(v.gerado_em).getTime() > 14 * 3600 * 1000; cls = velho ? 'parcial' : 'completo'; if (velho) txt += ' · parado?'; }
    return h('button', {class: 'dstat', title: 'Hora da última rodada do robô (quatro vezes por dia; não é tempo real). Toque para ver a coleta por fonte.', onclick: function () { A.go('bib', 'fontes'); }}, h('i', {class: 'dot ' + cls}), txt);
  };
  // Faixa de aviso quando o robô novo ainda não rodou ou os dados não chegam
  A.intelFaixa = function () {
    if (E.versao && E.versao.produto === 'Oregon Intelligence') return null;
    if (E.versaoAntiga) return h('div', {class: 'alert warn'}, h('b', null, 'O robô publicado ainda é a versão anterior (cotações). '), 'O site mostra o que existe. Para ligar a coleta de conteúdo, atualize o arquivo .github/workflows/robo.yml no GitHub com o conteúdo de docs/workflow_robo.yml e rode “Oregon Intelligence” em Actions (docs/ATUALIZACAO.md).');
    if (E.erro) return h('div', {class: 'alert warn'}, h('b', null, 'Sem acesso aos dados do robô agora: '), E.erro + '. ' + (noClaude() ? 'Nesta visualização (claude.ai) o navegador pode não alcançar o site público; abra o painel em ' + SITE_PADRAO + '.' : 'As carteiras, fichas e teses abaixo não dependem dele.'));
    if (!E.versao && !E.carregando) return h('div', {class: 'alert warn'}, 'O robô ainda não publicou dados (primeira rodada pendente). Em Actions → Oregon Intelligence → Run workflow.');
    return null;
  };
})(typeof APP !== 'undefined' ? APP : null, typeof CORE !== 'undefined' ? CORE : null, INTEL);
