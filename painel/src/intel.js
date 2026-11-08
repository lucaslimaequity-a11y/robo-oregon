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

  // Data usada para ordenar: a de publicação; sem ela, a de detecção; o acervo (o que já estava nas páginas na primeira
  // leitura) usa o mês de referência do documento ou vai para o fim — nunca aparece como novidade de hoje.
  function pub(x) {
    if (!x) return '';
    if (x.publicado_em) return x.publicado_em;
    if (x.acervo) return x.referencia ? x.referencia + '-01T00:00' : '0000';
    return x.detectado_em || '';
  }
  I.pub = pub;
  var MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function hm(iso) { var m = String(iso || '').match(/T(\d{2}):(\d{2})/); return m ? m[1] + ':' + m[2] : ''; }
  function dm(iso) { var m = String(iso || '').match(/^\d{4}-(\d{2})-(\d{2})/); return m ? m[2] + '/' + m[1] : ''; }
  // Quando foi publicado, dito como as pessoas dizem: "há 12 min", "há 3 h", "ontem 18:40", "06/11 14:35".
  // Item sem data diz "detectado em"; acervo diz o mês de referência. agora: Date (para testes).
  I.quando = function (x, agora) {
    if (!x) return '';
    if (!x.publicado_em) {
      if (x.acervo) return x.referencia ? 'acervo · ref. ' + MES[+x.referencia.slice(5, 7) - 1] + '/' + x.referencia.slice(0, 4) : 'acervo · sem data';
      return x.detectado_em ? 'detectado ' + dm(x.detectado_em) + ' ' + hm(x.detectado_em) + (x.referencia ? ' · ref. ' + MES[+x.referencia.slice(5, 7) - 1] + '/' + x.referencia.slice(0, 4) : '') : 'sem data';
    }
    var soData = x.publicado_em.length <= 10, t = Date.parse(x.publicado_em), n = (agora || new Date()).getTime(), min = Math.round((n - t) / 60000);
    if (soData) { var hj = I.hojeBRT(agora || new Date()), dd = x.publicado_em.slice(0, 10); return dd === hj ? 'hoje' : dd === I.menosDias(hj, 1) ? 'ontem' : dm(dd) + (dd.slice(0, 4) !== hj.slice(0, 4) ? '/' + dd.slice(0, 4) : ''); }
    if (isFinite(min) && min >= 0 && min < 60) return 'há ' + Math.max(1, min) + ' min';
    if (isFinite(min) && min >= 60 && min < 12 * 60) return 'há ' + Math.round(min / 60) + ' h';
    var hoje = I.hojeBRT(agora || new Date()), d = x.publicado_em.slice(0, 10);
    if (d === hoje) return 'hoje ' + hm(x.publicado_em);
    if (d === I.menosDias(hoje, 1)) return 'ontem ' + hm(x.publicado_em);
    return dm(x.publicado_em) + (d.slice(0, 4) !== hoje.slice(0, 4) ? '/' + d.slice(0, 4) : '') + ' ' + hm(x.publicado_em);
  };
  // Últimas notícias: só itens com data de publicação nas últimas `horas`, mais recentes primeiro (imprensa e documentos oficiais).
  // filtro: 'carteira' (cita ativo ou tema de ETF), 'brasil', 'mundo', 'casas' (opinião de casa de análise).
  I.ultimas = function (itens, opt) {
    opt = opt || {};
    var agora = (opt.agora || new Date()).getTime(), lim = (opt.horas || 48) * 3600 * 1000, f = opt.filtro || 'tudo';
    return itens.filter(function (x) {
      if (!x.publicado_em || x.acervo || x.agrupado_em) return false;
      if (opt.so_noticias !== false && !(x.categoria === 'veiculo' || x.categoria === 'instituicao' || x.categoria === 'oficial_empresa')) return false;
      if (x.via && x.confiavel === false && !opt.todosVeiculos) return false;
      if (x.categoria === 'veiculo' && !opt.todosVeiculos && !((x.temas || []).length || (x.ativos || []).length || (x.etfs_tema || []).length || (x.setor_de || []).length)) return false;
      var t = Date.parse(x.publicado_em.length <= 10 ? x.publicado_em + 'T12:00:00-03:00' : x.publicado_em); if (!isFinite(t) || agora - t > lim || t - agora > 6 * 3600 * 1000) return false;
      if (f === 'carteira') return (x.ativos || []).length > 0 || (x.etfs_tema || []).length > 0;
      if (f === 'brasil') return (x.regioes || []).indexOf('brasil') >= 0 || x.pais === 'Brasil';
      if (f === 'mundo') return x.pais !== 'Brasil' || (x.regioes || []).some(function (r) { return r !== 'brasil'; }) && (x.regioes || []).indexOf('brasil') < 0;
      if (f === 'casas') return x.natureza === 'opiniao_casa';
      if (f === 'oficial') return x.categoria === 'oficial_empresa' || x.categoria === 'instituicao';
      return true;
    }).sort(function (a, b) { return b.publicado_em.localeCompare(a.publicado_em); });
  };
  // Ativos com notícia recente: [{t, n, ultimo, itens}] ordenado pela notícia mais recente
  I.porAtivo = function (itens, opt) {
    opt = opt || {};
    var agora = (opt.agora || new Date()).getTime(), lim = (opt.horas || 72) * 3600 * 1000, m = {};
    itens.forEach(function (x) {
      if (!x.publicado_em || x.acervo || x.agrupado_em) return;
      var t = Date.parse(x.publicado_em); if (!isFinite(t) || agora - t > lim) return;
      (x.ativos || []).forEach(function (a) { (m[a] = m[a] || []).push(x); });
    });
    return Object.keys(m).map(function (a) { var l = m[a].sort(function (p, q) { return q.publicado_em.localeCompare(p.publicado_em); }); return {t: a, n: l.length, ultimo: l[0], itens: l, casas: l.filter(function (x) { return x.natureza === 'opiniao_casa'; }).length}; })
      .sort(function (p, q) { return q.ultimo.publicado_em.localeCompare(p.ultimo.publicado_em); });
  };
  // Notícias de um ativo (cita o ativo) e do tema do ETF (índice, estratégia), separadas; mais recentes primeiro
  I.doAtivo = function (itens, t) {
    var direto = [], tema = [], vis = {};
    itens.forEach(function (x) {
      if (x.acervo || x.agrupado_em || vis[x.id]) return; vis[x.id] = 1;
      if ((x.ativos || []).indexOf(t) >= 0) direto.push(x);
      else if ((x.etfs_tema || []).indexOf(t) >= 0 || (x.setor_de || []).indexOf(t) >= 0) tema.push(x);
    });
    var o = function (a, b) { return pub(b).localeCompare(pub(a)); };
    direto.sort(o); tema.sort(o);
    var op = direto.filter(function (x) { return x.natureza === 'opiniao_casa'; });
    return {direto: direto, tema: tema, oficiais: direto.filter(function (x) { return x.categoria === 'oficial_empresa'; }),
      noticias: direto.filter(function (x) { return x.categoria !== 'oficial_empresa'; }),
      opinioes: {favoravel: op.filter(function (x) { return x.posicao === 'favoravel'; }), contraria: op.filter(function (x) { return x.posicao === 'contraria'; }),
        outras: op.filter(function (x) { return x.posicao !== 'favoravel' && x.posicao !== 'contraria'; }), total: op.length}};
  };
  I.POSICAO = {favoravel: 'a favor', contraria: 'contra', neutra: 'neutra', mista: 'mista'};
  // Contraponto documentado: outra fonte concreta. Opinião com sentido → opiniões de sentido oposto sobre o mesmo ativo;
  // notícia de ativo → opiniões publicadas sobre ele; carta/research → outras fontes sobre o mesmo tema (divergência só lendo).
  I.contrapontos = function (itens, x) {
    var at = x.ativos || [], vis = {}, out = [], rot = '';
    function ok(y) { if (!y || y.id === x.id || y.acervo || y.agrupado_em || vis[y.id]) return false; vis[y.id] = 1; return true; }
    if (at.length && (x.posicao === 'favoravel' || x.posicao === 'contraria')) {
      var oposto = x.posicao === 'favoravel' ? 'contraria' : 'favoravel';
      out = itens.filter(function (y) { return ok(y) && y.natureza === 'opiniao_casa' && (y.posicao === oposto || y.posicao === 'mista') && (y.ativos || []).some(function (t) { return at.indexOf(t) >= 0; }); });
      rot = 'Opiniões em sentido ' + (oposto === 'contraria' ? 'contrário' : 'favorável') + ' sobre ' + at.join(', ') + ' publicadas por outras fontes:';
    } else if (at.length) {
      out = itens.filter(function (y) { return ok(y) && y.natureza === 'opiniao_casa' && y.posicao && (y.ativos || []).some(function (t) { return at.indexOf(t) >= 0; }); });
      rot = 'Opiniões publicadas sobre ' + at.join(', ') + ' (o sentido vem do título):';
    } else if ((x.temas || []).length && x.categoria !== 'veiculo') {
      var org = x.organizacao || x.fonte, lim = Date.parse(I.pub(x) || '') - 30 * 864e5;
      out = itens.filter(function (y) { return ok(y) && y.categoria !== 'veiculo' && (y.organizacao || y.fonte) !== org && (y.temas || []).some(function (t) { return t !== 'carta_gestor' && x.temas.indexOf(t) >= 0; }) && (!isFinite(lim) || Date.parse(I.pub(y) || '') >= lim); });
      rot = 'Outras fontes sobre o mesmo tema nos 30 dias anteriores (se divergem, só a leitura dos textos dirá):';
    }
    out.sort(function (a, b) { return I.pub(b).localeCompare(I.pub(a)); });
    return {itens: out.slice(0, 5), rotulo: rot};
  };
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
    E.timer = setInterval(function () { if (!document.hidden) atualizar(false); }, 2 * 60000);  // versao.json tem poucos bytes
    document.addEventListener('visibilitychange', function () { if (!document.hidden && E.ultimo && Date.now() - new Date(E.ultimo).getTime() > 2 * 60000) atualizar(false); });
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
  function quandoTxt(x) { return I.quando(x); }
  A.quandoTxt = quandoTxt;
  function chipsItem(x, opt) {
    opt = opt || {};
    var ch = [];
    if (x.categoria !== 'veiculo' && x.categoria !== 'oficial_empresa') ch.push(A.chip(I.tipoNome(x.tipo), 'tp ' + (TIPO_CLS[x.tipo] || '')));
    if (x.natureza === 'opiniao_casa') ch.push(A.chip('Opinião' + ((x.casas || []).length ? ' · ' + x.casas.join(', ') : ' de analistas') + (x.posicao ? ' · ' + I.POSICAO[x.posicao] : ''), 'casa' + (x.posicao ? ' p-' + x.posicao : ''), 'Opinião de terceiros, como relatada no título público. O sentido (a favor/contra) é lido do título, não do relatório. Não é recomendação do Oregon.'));
    if (x.aviso_fonte) ch.push(A.chip(x.aviso_fonte.split(' — ')[0], 'g-baixa', x.aviso_fonte));
    if (x.via && x.confiavel === false) ch.push(A.chip('veículo pouco conhecido', 'g-baixa', 'Achado pela busca do ' + x.via + '; confira na fonte antes de usar.'));
    if (x.categoria === 'oficial_empresa') ch.push(A.chip(x.categoria_cvm || 'CVM', 'tp c-oficial', 'Documento entregue pela companhia à CVM'));
    if (opt.comNivel && x.categoria !== 'veiculo') { var n = I.nivel(x); if (n === 'alta') ch.push(A.chip('prioridade alta', 'g-critica', (x.prioridade && x.prioridade.porque || []).join(' · '))); }
    if (x.analise && x.analise.profunda) ch.push(A.chip('análise IA', 'o-ia', 'Leitura por IA sobre o título e o resumo público'));
    if (x.natureza === 'promocional' || x.natureza === 'sensacionalista') ch.push(A.chip(x.natureza, 'g-baixa'));
    if (A.lido(x.id)) ch.push(A.chip('lido', 'o-obs'));
    return ch;
  }
  // Cartão de conteúdo: a hora vem primeiro; o título abre a análise (gaveta); ↗ abre a fonte original em nova aba
  A.itemCard = function (x, opt) {
    opt = opt || {};
    var org = x.categoria === 'oficial_empresa' ? 'CVM · ' + (x.organizacao || '') : x.via ? x.fonte : (x.organizacao || x.fonte), lk = A.link(x.link);
    var card = h('article', {class: 'nw ' + (TIPO_CLS[x.tipo] || '') + (A.lido(x.id) ? ' lido' : '') + (x.acervo ? ' acervo' : ''), 'data-id': x.id});
    card.appendChild(h('div', {class: 'nw-top'}, h('time', {class: 'nw-when' + (x.publicado_em ? '' : ' sem'), datetime: x.publicado_em || ''}, quandoTxt(x)), h('span', {class: 'nw-src'}, org), chipsItem(x, opt)));
    card.appendChild(h('h3', {class: 'nw-t'}, h('button', {class: 'nwl', onclick: function () { A.abrirItem(x); }}, x.titulo), lk ? h('a', {class: 'nw-ext', href: lk, target: '_blank', rel: 'noopener', title: 'Abrir a fonte original', 'aria-label': 'Abrir a fonte original'}, '↗') : null));
    if (x.resumo && !opt.semResumo) card.appendChild(h('p', {class: 'nw-r'}, x.resumo));
    var tags = (x.ativos || []).slice(0, 4).map(function (t) { return h('button', {class: 'tag tk', onclick: function () { A.abrirFicha(t); }}, t); })
      .concat((x.etfs_tema || []).filter(function (t) { return (x.ativos || []).indexOf(t) < 0; }).slice(0, 3).map(function (t) { return h('button', {class: 'tag tk tema', title: 'Notícia do índice ou do tema do ETF, não do fundo', onclick: function () { A.abrirFicha(t); }}, t + ' · tema'); }))
      .concat(opt.semTemas ? [] : (x.temas || []).slice(0, 2).map(function (t) { return h('button', {class: 'tag', onclick: function () { A.go('bib', 'busca'); if (A.bibFiltro) A.bibFiltro({tema: t}); }}, I.temaNome(t)); }));
    if (x.tambem_em && x.tambem_em.length) tags.push(h('span', {class: 'tag mu', title: x.tambem_em.map(function (t) { return t.fonte; }).join(', ')}, '+' + x.tambem_em.length + ' fonte(s)'));
    if (tags.length) card.appendChild(h('div', {class: 'nw-tags'}, tags));
    return card;
  };
  // Linha compacta (painel lateral de notícias): hora · veículo · título
  A.itemLinha = function (x) {
    var lk = A.link(x.link);
    return h('li', {class: 'nl' + (A.lido(x.id) ? ' lido' : '')}, h('time', {class: 'nw-when' + (x.publicado_em ? '' : ' sem')}, quandoTxt(x)),
      h('div', null, h('button', {class: 'nwl', onclick: function () { A.abrirItem(x); }}, x.titulo),
        h('div', {class: 'nl-src'}, x.categoria === 'oficial_empresa' ? 'CVM · ' + (x.categoria_cvm || 'documento') : (x.fonte && x.via ? x.fonte : x.organizacao || x.fonte),
          lk ? h('a', {class: 'nw-ext', href: lk, target: '_blank', rel: 'noopener', title: 'Abrir a matéria original', 'aria-label': 'Abrir a matéria original'}, '↗') : null,
          chipsItem(x).filter(function (c) { return !/\blido\b/.test(c.textContent); }))));
  };
  A.listaLinhas = function (itens, max, vazio) { if (!itens.length) return h('p', {class: 'empty'}, vazio || 'Sem notícias recentes.'); return h('ul', {class: 'nls'}, itens.slice(0, max || itens.length).map(A.itemLinha)); };
  A.listaItens = function (itens, opt) { opt = opt || {}; if (!itens.length) return h('p', {class: 'empty'}, opt.vazio || 'Nada aqui ainda.'); return h('div', {class: 'nwlist'}, itens.slice(0, opt.max || itens.length).map(function (x) { return A.itemCard(x, opt); })); };
  // Análise em sete pontos, com o rótulo de cada frase. Nada aqui vira recomendação.
  A.analiseView = function (x) {
    var an = x.analise;
    if (!an) return h('p', {class: 'muted'}, 'Este item ainda não tem análise (foi coletado por uma versão anterior do robô). Abra a fonte original.');
    var box = h('div', {class: 'an'});
    box.appendChild(h('div', {class: 'alert ' + (an.profunda ? 'ok' : 'warn'), style: 'margin-top:0;font-size:.86rem'}, h('b', null, an.profunda ? 'Análise aprofundada (IA). ' : 'Análise por regras. '), an.aviso || ''));
    box.appendChild(h('p', {class: 'an-leg'}, Object.keys(I.ROTULO).map(function (k) { return h('span', {class: 'rot r-' + k.toLowerCase().replace('ê', 'e')}, I.ROTULO[k]); })));
    var rt = (I.TX.roteiro || {}), temas = x.temas || [];
    function roteiro(campo, rot) { var out = []; temas.slice(0, 3).forEach(function (t) { ((rt[t] || {})[campo] || []).slice(0, 2).forEach(function (q) { out.push({r: 'INFERÊNCIA', t: rot ? rot + q : q}); }); }); return out; }
    an = Object.assign({}, an);
    var generico = [];
    if (!an.profunda) {
      // Ponto 4 só com contraponto DOCUMENTADO (outra fonte concreta). As perguntas genéricas do tema vão para um roteiro à parte.
      generico = (an['4_contrarios'] || []).filter(function (f) { return f.r === 'INFERÊNCIA'; }).map(function (f) { return f.t; });
      if (!generico.length) generico = roteiro('contra').map(function (f) { return f.t; });
      var ctp = I.contrapontos(A.itens ? A.itens() : [], x);
      an['4_contrarios'] = ctp.itens.length ? [{r: 'FATO', t: ctp.rotulo}].concat(ctp.itens.map(function (y) {
        return {r: 'FONTE', t: (y.posicao ? '[' + I.POSICAO[y.posicao] + '] ' : '') + ((y.casas || []).length ? y.casas.join(', ') + ' · ' : '') + (y.via ? y.fonte : y.organizacao || y.fonte) + ' · ' + I.quando(y) + ': ' + y.titulo, item: y};
      })) : [{r: 'FATO', t: 'Não há contraponto documentado nas fontes lidas' + ((x.ativos || []).length ? ' sobre ' + x.ativos.join(', ') : '') + '. Sem outra fonte concreta, o sistema não cria argumentos contrários.'}];
    }
    if (an.compacta) {  // manchete de imprensa: o roteiro do tema é o mesmo para todas, por isso não vem guardado em cada item
      if (!an['5_regioes']) an['5_regioes'] = [{r: 'FATO', t: 'Regiões citadas: ' + ((x.regioes || []).map(I.regiaoNome).join(', ') || 'nenhuma identificada') + '.'}];
      if (!an['7_monitorar']) an['7_monitorar'] = roteiro('monitorar', 'Roteiro do tema: ').slice(0, 4);
    }
    I.PONTOS.forEach(function (p, i) {
      var frases = an[p[0]] || [];
      box.appendChild(h('section', {class: 'an-p'}, h('h4', null, h('span', {class: 'an-n'}, String(i + 1)), p[1]), frases.length ? h('ul', null, frases.map(function (f) {
        var lk = f.item && A.link(f.item.link);
        return h('li', null, h('span', {class: 'rot r-' + String(f.r).toLowerCase().replace('ê', 'e'), title: I.ROTULO[f.r] || f.r}, I.ROTULO[f.r] || f.r), ' ', f.t, lk ? h('a', {class: 'nw-ext', href: lk, target: '_blank', rel: 'noopener', title: 'Abrir a fonte'}, ' ↗') : null); })) : h('p', {class: 'muted'}, 'Não avaliado.')));
    });
    if (generico.length) box.appendChild(A.more('Roteiro genérico do tema (perguntas para você verificar, não são argumentos de nenhuma fonte)', h('ul', {class: 'lst'}, generico.slice(0, 6).map(function (q) { return h('li', null, q); }))));
    if (x.prioridade) box.appendChild(h('p', {class: 'hint'}, 'Prioridade ' + x.prioridade.nivel + ' (' + x.prioridade.pontos + ' pontos): ' + (x.prioridade.porque || []).join('; ') + '. A prioridade só ordena; nenhum item é escondido.'));
    return box;
  };
  A.abrirItem = function (x) {
    var lk = A.link(x.link), body = h('div', {class: 'item-full'});
    body.appendChild(h('div', {class: 'nw-top'}, chipsItem(x), h('span', {class: 'muted nw-meta'}, (I.CATEGORIA[x.categoria] || x.categoria || '') + ' · ' + (x.via ? x.fonte : x.organizacao || x.fonte) + (x.pais ? ' · ' + x.pais : '') + (x.autor ? ' · ' + x.autor : '') + (quandoTxt(x) ? ' · ' + quandoTxt(x) : ''))));
    body.appendChild(h('div', {class: 'row', style: 'gap:8px;flex-wrap:wrap;margin:10px 0'},
      lk ? h('a', {class: 'btn pri', href: lk, target: '_blank', rel: 'noopener'}, 'Abrir a fonte original ↗') : h('span', {class: 'alert bad', style: 'margin:0'}, 'Item sem link válido.'),
      x.pdf && A.link(x.pdf) && x.pdf !== x.link ? h('a', {class: 'btn', href: A.link(x.pdf), target: '_blank', rel: 'noopener'}, 'PDF') : null,
      h('button', {class: 'btn', onclick: async function () { await A.marcarLido(x, !A.lido(x.id)); A.abrirItem(x); }}, A.lido(x.id) ? 'Desmarcar leitura' : 'Marcar como lido')));
    if (x.resumo) body.appendChild(h('p', {class: 'nw-r', style: 'font-size:.98rem'}, h('span', {class: 'rot r-fonte'}, 'Resumo da fonte'), ' ', x.resumo));
    if (x.natureza === 'opiniao_casa') body.appendChild(h('div', {class: 'alert', style: 'font-size:.9rem'}, h('b', null, 'Opinião publicada: '), ((x.casas || []).length ? x.casas.join(', ') : 'analistas não identificados no título') + (x.posicao ? ' · sentido ' + I.POSICAO[x.posicao] + ' (lido do título)' : ' · sem sentido explícito no título') + ', como relatada por ' + (x.via ? x.fonte : x.organizacao || x.fonte) + '. É a visão de terceiros reportada pela imprensa; o relatório original não é acessível e o Oregon não recomenda compra nem venda.'));
    if (x.aviso_fonte) body.appendChild(h('p', {class: 'hint'}, 'Fonte sinalizada: ' + x.aviso_fonte + '.'));
    if (x.via) body.appendChild(h('p', {class: 'hint'}, 'Achado pela busca do ' + x.via + (x.confiavel === false ? '; veículo fora da lista de veículos conhecidos — confira na fonte antes de usar.' : '.')));
    if (x.acervo) body.appendChild(h('p', {class: 'hint'}, 'Acervo: já estava publicado na página da gestora quando o robô a leu pela primeira vez. ' + (x.referencia ? 'O documento se refere a ' + x.referencia.slice(5, 7) + '/' + x.referencia.slice(0, 4) + ' (pelo nome do arquivo).' : 'A página não informa a data.')));
    else if (x.data_estimada) body.appendChild(h('p', {class: 'hint'}, 'A página não informa a data de publicação: a data mostrada é a de detecção pelo robô.'));
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

  /* ---------- agenda (calendários oficiais: IBGE, Copom, Fed, Focus) ---------- */
  A.agendaView = function (max) {
    var ag = E.macro && E.macro.agenda, hoje = I.hojeBRT();
    if (!ag || !ag.itens) return h('p', {class: 'muted'}, E.carregando ? 'Buscando a agenda…' : 'Agenda não publicada pelo robô.');
    var vistos = {}, prox = ag.itens.filter(function (a) { if (a.data < hoje) return false; var k = a.evento || a.titulo || a.produto; if (vistos[k]) return false; vistos[k] = 1; return true; }).slice(0, max || 8);
    if (!prox.length) return h('p', {class: 'muted'}, 'Nada agendado nos próximos ' + ag.dias + ' dias nas fontes oficiais.');
    var dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    return h('ul', {class: 'agenda'}, prox.map(function (a) {
      var nome = a.evento || a.titulo || a.produto || 'Evento', d = new Date(a.data + 'T12:00:00Z');
      return h('li', {class: (a.data === hoje ? 'hoje ' : '') + 'ag-' + (a.tipo || '')}, h('div', {class: 'ag-d'}, h('b', null, A.dataBR(a.data).slice(0, 5)), h('small', null, (a.data === hoje ? 'hoje' : dias[d.getUTCDay()]) + (a.hora ? ' ' + a.hora : ''))),
        h('div', null, A.link(a.link) ? h('a', {href: A.link(a.link), target: '_blank', rel: 'noopener'}, nome) : nome, h('small', {class: 'muted', style: 'display:block'}, (a.fonte || '') + (a.previsto ? ' · data prevista' : ''))));
    }));
  };
  function hm(iso) { try { return new Date(iso).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}); } catch (e) { return ''; } }
  A.hm = hm;
  // Estado dos dados no topo: hora da última rodada e situação
  A.dadosPill = function () {
    var v = E.versao, txt, cls;
    if (!v) { txt = E.carregando ? 'buscando…' : 'sem dados'; cls = E.erro ? 'critico' : 'parcial'; }
    else { var idade = (Date.now() - new Date(v.gerado_em).getTime()) / 60000; txt = 'Atualizado ' + I.quando({publicado_em: v.gerado_em}); cls = idade > 120 ? 'parcial' : 'completo'; if (idade > 180) txt += ' · robô atrasado'; }
    return h('button', {class: 'dstat', title: 'Hora da última rodada do robô. Ele lê os portais e as fontes a cada 30 minutos, das 7h às 22h30 (não é tempo real). Toque para ver a coleta por fonte.', onclick: function () { A.go('bib', 'fontes'); }}, h('i', {class: 'dot ' + cls}), txt);
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
