/* STORE — persistência e governança.
   No claude.ai: banco compartilhado do artefato (db). Fora dele: localStorage deste navegador.
   Séries históricas e tabelas importadas: IndexedDB deste navegador (podem ser grandes).
   Nenhuma função aqui altera a carteira aprovada sem um registro de aprovação humana. */
var STORE = (function () {
  'use strict';
  var COLS = ['propostas', 'aprovadas', 'versoes', 'decisoes', 'teses', 'auditoria', 'reunioes', 'config', 'aprendizados', 'leituras', 'salvos'];  // aprendizados, leituras e "ler depois": Oregon Intelligence
  var LS = 'oregon-pm-v2:';
  var mode = 'local', db = null, user = null, sample = null, downloads = null, canWrite = null, uid = null;
  var cache = {}, subs = [], ready = false;
  COLS.forEach(function (c) { cache[c] = {}; });

  function emit(col) { subs.forEach(function (f) { try { f(col); } catch (e) { console.error(e); } }); }
  function on(f) { subs.push(f); }
  function now() { return new Date().toISOString(); }
  function newId(prefix) { return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }

  function lsLoad(col) { try { var o = JSON.parse(localStorage.getItem(LS + col) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function lsSave(col) { try { localStorage.setItem(LS + col, JSON.stringify(cache[col])); return true; } catch (e) { return false; } }

  function withTimeout(p, ms) { return Promise.race([p, new Promise(function (r) { setTimeout(function () { r(null); }, ms); })]); }

  async function init() {
    COLS.forEach(function (c) { cache[c] = lsLoad(c); });
    // Reuniões salvas pela versão anterior da Sala (modo local) continuam visíveis
    try { var old = JSON.parse(localStorage.getItem('oregon-sala-reunioes-v1') || '[]'); if (Array.isArray(old)) old.forEach(function (m) { if (m && m.id && !cache.reunioes[m.id]) cache.reunioes[m.id] = m; }); } catch (e) {}
    var cl = (typeof window !== 'undefined') && window.claude && window.claude.use ? window.claude : null;
    if (cl) {
      var r = await Promise.all([withTimeout(cl.use('db').catch(function () { return null; }), 10000), withTimeout(cl.use('sample').catch(function () { return null; }), 10000), withTimeout(cl.use('user').catch(function () { return null; }), 10000)]);
      db = r[0]; sample = r[1]; user = r[2];
      downloads = await withTimeout(cl.use('downloads').catch(function () { return null; }), 10000);
      if (user && user.can) { try { var c = await user.can('data.write'); canWrite = c; } catch (e) {} }
      if (user && user.id) { try { uid = await user.id(); } catch (e) {} }
    }
    if (db) {
      mode = 'db';
      COLS.forEach(function (col) {
        cache[col] = {};
        db.collection(col).limit(500).onSnapshot(function (snap) {
          var o = {}; snap.docs.forEach(function (d) { o[d.id] = Object.assign({id: d.id}, clone(d.data())); });
          cache[col] = o; emit(col);
        }, function () { emit(col); });
      });
    }
    ready = true; emit('*');
    return {mode: mode, sample: !!sample};
  }

  function list(col) { return Object.keys(cache[col] || {}).map(function (k) { return cache[col][k]; }); }
  function get(col, id) { return (cache[col] || {})[id] || null; }
  async function put(col, id, obj) {
    var body = clone(obj); body.id = id; body.atualizado = now();
    cache[col][id] = body; emit(col);
    if (mode === 'db') {
      if (canWrite === false) throw {code: 'not_writer', message: 'Você pode ver, mas não salvar, neste painel compartilhado.'};
      await db.collection(col).doc(id).set(body);
    } else if (!lsSave(col)) throw {code: 'quota', message: 'O navegador não deixou salvar (armazenamento cheio ou bloqueado).'};
    return body;
  }
  async function del(col, id) {
    delete cache[col][id]; emit(col);
    if (mode === 'db') await db.collection(col).doc(id).delete(); else lsSave(col);
  }

  /* ---------- auditoria ---------- */
  async function audit(acao, detalhe, ref) {
    var id = newId('a');
    try { await put('auditoria', id, {quando: now(), por: uid || 'local', acao: acao, detalhe: detalhe || '', ref: ref || null}); } catch (e) {}
  }

  /* ---------- carteiras: aprovada vigente, propostas, aprovação ---------- */
  // A aprovada vigente é a última aprovação registrada; sem registro, vale a versão original do simulador.
  function aprovadaVigente(CORE, cart) {
    var a = get('aprovadas', cart);
    if (!a) return CORE.aprovadaOriginal(cart);
    var e = CORE.estrategica(cart);
    return {kind: 'aprovada', id: a.versao, cart: cart, rotulo: 'Aprovada · ' + (a.rotulo || a.versao), data: a.aprovado_em, fonte: 'Aprovação registrada por ' + (a.responsavel || '—'),
      pos: clone(a.pos), alvo: null, bandas: e.bandas, checaInterno: false, caixaDeliberado: !!a.caixaDeliberado, decisao: a.decisao};
  }
  function propostas(cart) { return list('propostas').filter(function (p) { return !cart || p.cart === cart; }).sort(function (a, b) { return a.criado < b.criado ? 1 : -1; }); }
  async function salvarProposta(p) {
    var novo = !p.id; if (novo) { p.id = newId('prop'); p.criado = now(); p.por = uid || 'local'; p.status = p.status || 'rascunho'; p.hist = []; }
    p.hist = (p.hist || []).concat([{quando: now(), status: p.status, nota: p.notaVersao || (novo ? 'criada' : 'salva')}]).slice(-50);
    delete p.notaVersao;
    var b = await put('propostas', p.id, p);
    await audit(novo ? 'proposta criada' : 'proposta salva', p.nome + ' · ' + p.cart, p.id);
    return b;
  }
  // Registro de aprovação: exige responsável, data e decisão. Guarda a composição anterior em 'versoes'.
  // Regras para uma proposta virar carteira oficial (puro, testável): responsável, data, confirmação humana e proposta que feche.
  function checarAprovacao(CORE, p, reg) {
    if (!reg || !reg.responsavel || !String(reg.responsavel).trim()) return 'Informe o responsável pela aprovação.';
    if (!reg.data) return 'Informe a data da decisão do Comitê.';
    if (!reg.confirmaHumano) return 'A aprovação exige a confirmação de que a decisão foi tomada por pessoas.';
    var v = CORE.validate({pos: p.pos, cart: p.cart, rotulo: p.nome, caixaDeliberado: p.caixaDeliberado}, {});
    if (v.status === 'invalida') return 'A proposta não fecha: ' + v.issues.filter(function (i) { return i.g === 'critica'; }).map(function (i) { return i.titulo; }).join('; ');
    return null;
  }
  async function aprovarProposta(CORE, p, reg) {
    var err = checarAprovacao(CORE, p, reg);
    if (err) throw {code: 'invalid', message: err};
    var anterior = aprovadaVigente(CORE, p.cart);
    var vid = newId('v');
    await put('versoes', vid, {cart: p.cart, rotulo: anterior.rotulo, pos: anterior.pos, vigente_ate: reg.data, substituida_por: p.id, fonte: anterior.fonte, origem: anterior.id});
    var decId = newId('dec');
    await put('aprovadas', p.cart, {cart: p.cart, versao: p.id, rotulo: p.nome + ' (' + reg.data + ')', pos: clone(p.pos), aprovado_em: reg.data, responsavel: reg.responsavel, decisao: decId, anterior: vid, caixaDeliberado: !!p.caixaDeliberado, por: uid || 'local'});
    p.status = 'aprovada'; p.notaVersao = 'aprovada por ' + reg.responsavel + ' em ' + reg.data; await salvarProposta(p);
    await put('decisoes', decId, Object.assign({tipo: 'rebalanceamento', cart: p.cart, proposta: p.id, status: 'aprovada', criado: now(), data: reg.data, responsavel: reg.responsavel}, reg.registro || {}));
    await audit('aprovação registrada', p.nome + ' substitui ' + anterior.rotulo, p.id);
    return {versaoAnterior: vid, decisao: decId};
  }
  async function rejeitarProposta(p, reg) {
    p.status = 'rejeitada'; p.notaVersao = 'rejeitada' + (reg && reg.responsavel ? ' por ' + reg.responsavel : '') + (reg && reg.motivo ? ': ' + reg.motivo : '');
    await salvarProposta(p);
    var decId = newId('dec');
    await put('decisoes', decId, Object.assign({tipo: 'rebalanceamento', cart: p.cart, proposta: p.id, status: 'rejeitada', criado: now(), data: (reg && reg.data) || now().slice(0, 10), responsavel: (reg && reg.responsavel) || ''}, (reg && reg.registro) || {}));
    await audit('proposta rejeitada', p.nome, p.id);
  }
  // Reverter = criar uma proposta a partir de uma versão arquivada (nunca sobrescreve a vigente).
  async function reverterComoProposta(vid) {
    var v = get('versoes', vid); if (!v) return null;
    return salvarProposta({cart: v.cart, nome: 'Reversão para ' + v.rotulo, pos: clone(v.pos), origem: 'reversao', status: 'rascunho', base: vid});
  }
  async function voltarAoOriginal(cart, reg) {
    var a = get('aprovadas', cart); if (!a) return;
    var vid = newId('v');
    await put('versoes', vid, {cart: cart, rotulo: 'Aprovada · ' + a.rotulo, pos: a.pos, vigente_ate: now().slice(0, 10), substituida_por: 'original', fonte: 'aprovação registrada'});
    await del('aprovadas', cart);
    await audit('aprovação revertida para o simulador original', cart + (reg && reg.responsavel ? ' · ' + reg.responsavel : ''), vid);
  }

  /* ---------- IndexedDB (séries e tabelas importadas) ---------- */
  var idbP = null;
  function idb() {
    if (idbP) return idbP;
    idbP = new Promise(function (res) {
      try {
        var rq = indexedDB.open('oregon-pm', 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('kv'); };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
    return idbP;
  }
  var mem = {}; // fallback em memória quando IndexedDB não existe
  async function kvGet(k) { var d = await idb(); if (!d) return mem[k]; return new Promise(function (res) { try { var rq = d.transaction('kv').objectStore('kv').get(k); rq.onsuccess = function () { res(rq.result); }; rq.onerror = function () { res(undefined); }; } catch (e) { res(mem[k]); } }); }
  async function kvSet(k, v) { mem[k] = v; var d = await idb(); if (!d) return false; return new Promise(function (res) { try { var tx = d.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = function () { res(true); }; tx.onerror = function () { res(false); }; } catch (e) { res(false); } }); }
  async function kvDel(k) { delete mem[k]; var d = await idb(); if (!d) return; return new Promise(function (res) { try { var tx = d.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = function () { res(true); }; tx.onerror = function () { res(false); }; } catch (e) { res(false); } }); }

  // Séries: um único objeto {id: {pts:[[data, v]], tipo:'ajustado'|'preco'|'nivel'|'taxa', moeda, fonte, importado, arquivo}}
  var SER = null;
  async function series() { if (SER) return SER; SER = (await kvGet('series')) || {}; return SER; }
  async function saveSeries(add, meta) {
    var s = await series();
    Object.keys(add).forEach(function (id) {
      var old = s[id];
      var m = {}; (old ? old.pts : []).forEach(function (p) { m[p[0]] = p[1]; });
      add[id].forEach(function (p) { m[p[0]] = p[1]; });
      var pts = Object.keys(m).sort().map(function (d) { return [d, m[d]]; });
      s[id] = Object.assign({}, old || {}, meta || {}, {pts: pts, importado: now(), versoes: ((old && old.versoes) || []).concat([{quando: now(), n: add[id].length, arquivo: meta && meta.arquivo}]).slice(-20)});
    });
    SER = s; await kvSet('series', s); await audit('séries importadas', Object.keys(add).length + ' séries' + (meta && meta.arquivo ? ' · ' + meta.arquivo : ''));
    emit('series');
    return s;
  }
  // Troca de uma vez as séries do robô (cada uma com seu tipo e fonte): uma gravação e um registro de auditoria
  async function saveSeriesLote(lista, remover, nota) {
    var s = await series(), q = now();
    (remover || []).forEach(function (id) { delete s[id]; });
    lista.forEach(function (x) { s[x.id] = Object.assign({}, x.meta || {}, {pts: x.pts.slice(), importado: q, versoes: [{quando: q, n: x.pts.length, arquivo: x.meta && x.meta.arquivo}]}); });
    SER = s; await kvSet('series', s); await audit('séries do robô', lista.length + ' séries' + (nota ? ' · ' + nota : ''));
    emit('series');
    return s;
  }
  async function delSerie(id) { var s = await series(); delete s[id]; await kvSet('series', s); emit('series'); }
  async function tabela(nome) { return (await kvGet('tab:' + nome)) || null; }
  async function saveTabela(nome, v) { await kvSet('tab:' + nome, v); await audit('tabela importada', nome); emit('tab:' + nome); }

  function quem() { return uid; }
  return {
    init: init, on: on, list: list, get: get, put: put, del: del, newId: newId, now: now, audit: audit,
    aprovadaVigente: aprovadaVigente, propostas: propostas, salvarProposta: salvarProposta, aprovarProposta: aprovarProposta, checarAprovacao: checarAprovacao,
    rejeitarProposta: rejeitarProposta, reverterComoProposta: reverterComoProposta, voltarAoOriginal: voltarAoOriginal,
    series: series, saveSeries: saveSeries, saveSeriesLote: saveSeriesLote, delSerie: delSerie, tabela: tabela, saveTabela: saveTabela, kvGet: kvGet, kvSet: kvSet,
    get mode() { return mode; }, get sample() { return sample; }, get downloads() { return downloads; }, get user() { return user; }, get canWrite() { return canWrite; }, get ready() { return ready; }, quem: quem
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = STORE;
