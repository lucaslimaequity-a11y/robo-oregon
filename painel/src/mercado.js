/* MERCADO AO VIVO
   Lê dados de mercado de duas origens e junta as duas:
   1) o robô (GitHub Actions) que grava data/mercado.json num repositório público, com cotações, juros,
      Focus, notícias e, uma vez por dia, séries históricas para o modelo de risco;
   2) fontes públicas consultadas direto pelo navegador, sem chave (Banco Central e câmbio).
   Detecta movimentos acima dos limites, avisa, e leva a sessão do dia para a Sala de Gestão com os movimentos
   reais como cenário base. Nenhum número é inventado: fonte que não responde aparece como indisponível.
   Nenhuma chave fica no painel: as chaves ficam nos Secrets do GitHub, do lado do robô. */
var MERCADO = (function () {
  'use strict';
  var FK = ['selic', 'pre', 'real', 'ust2', 'ust10', 'usd', 'ibov', 'sp', 'em', 'brent', 'btc'];
  var PP = {selic: 1, pre: 1, real: 1, ust2: 1, ust10: 1};
  var NOME = {selic: 'Selic', pre: 'Curva prefixada', real: 'Juro real (IPCA+)', ust2: 'Treasury 2 anos', ust10: 'Treasury 10 anos', usd: 'Dólar', ibov: 'Ibovespa', sp: 'S&P 500', em: 'Emergentes (EEM)', brent: 'Petróleo Brent', btc: 'Bitcoin'};
  var LIM_PADRAO = {fatores: {selic: 0.01, pre: 0.15, real: 0.10, ust2: 0.10, ust10: 0.10, usd: 1.0, ibov: 1.5, sp: 1.5, em: 2.0, brent: 4.0, btc: 6.0}, ativos: {acao: 4.0, fii: 2.5, etf_rf: 1.0, cripto: 6.0, outro: 3.0}};
  var ROBO_PADRAO = 'lucaslimaequity-a11y/robo-oregon';
  var CFG_PADRAO = {robo: ROBO_PADRAO, diretas: true, intervalo: 5, autoSala: true, aplicarCenario: true, som: false, notificar: false, limites: LIM_PADRAO};

  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function cfgCompleta(c) {
    var o = Object.assign({}, CFG_PADRAO, c || {});
    o.limites = {fatores: Object.assign({}, LIM_PADRAO.fatores, ((c || {}).limites || {}).fatores || {}), ativos: Object.assign({}, LIM_PADRAO.ativos, ((c || {}).limites || {}).ativos || {})};
    o.intervalo = Math.max(1, Math.min(60, Number(o.intervalo) || 5));
    return o;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoLocal(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  // "Hoje" no horário de Brasília, qualquer que seja o fuso do computador (a Selic meta tem datas futuras no SGS)
  function hojeBRT(d) { d = d || new Date(); try { var s = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'}).format(d); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; } catch (e) {} return isoLocal(d); }
  function br(d) { return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); }

  // "usuario/repositorio", o endereço do GitHub ou o endereço direto do arquivo → endereços do mercado.json e do historico.json
  function urlRobo(s) {
    s = String(s || '').trim().replace(/\s+/g, ''); if (!s) return null;
    var m = s.match(/^https:\/\/raw\.githubusercontent\.com\/([\w.-]+)\/([\w.-]+)\/([\w.-]+)\/(?:data\/)?(?:mercado\.json)?$/i);
    if (m) { var b0 = 'https://raw.githubusercontent.com/' + m[1] + '/' + m[2] + '/' + m[3] + '/data/'; return {mercado: b0 + 'mercado.json', historico: b0 + 'historico.json', noticias: b0 + 'noticias.json', repo: m[1] + '/' + m[2]}; }
    m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/.*)?$/i) || s.match(/^([\w.-]+)\/([\w.-]+)$/);
    if (!m) return null;
    var base = 'https://raw.githubusercontent.com/' + m[1] + '/' + m[2] + '/dados/data/';
    return {mercado: base + 'mercado.json', historico: base + 'historico.json', noticias: base + 'noticias.json', repo: m[1] + '/' + m[2]};
  }

  // ---------- fontes diretas (navegador, sem chave) ----------
  function urlsDiretas(hoje) {
    var d = new Date(hoje + 'T12:00:00'), ini = function (dias) { var x = new Date(d); x.setDate(x.getDate() - dias); return br(x); };
    var sgs = function (c, dias) { return 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.' + c + '/dados?formato=json&dataInicial=' + ini(dias) + '&dataFinal=' + br(d); };
    return {s432: sgs(432, 40), s4389: sgs(4389, 15), s433: sgs(433, 430), s13522: sgs(13522, 430), s1: sgs(1, 15), cambio: 'https://economia.awesomeapi.com.br/json/last/USD-BRL'};
  }
  function sgsPts(arr, hoje) {
    if (!Array.isArray(arr)) return [];
    return arr.map(function (o) { var m = String(o.data || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/), v = Number(String(o.valor).replace(',', '.')); return m && isFinite(v) ? [m[3] + '-' + m[2] + '-' + m[1], v] : null; })
      .filter(function (p) { return p && p[0] <= hoje; }).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
  }
  // Monta um retrato no mesmo formato do robô a partir das respostas cruas das fontes diretas (cada uma pode faltar)
  function normDireto(r, hoje, quando) {
    var snap = {versao: 1, origem: 'direto', gerado_em: quando, fatores: {}, indicadores: {}, ativos: {}, fontes: {}};
    var s = sgsPts(r.s432, hoje);
    if (s.length >= 2) { var a = s[s.length - 2], b = s[s.length - 1]; snap.fatores.selic = {k: 'selic', nome: 'Selic', detalhe: 'Meta Selic (Copom)', ok: true, nivel: b[1], anterior: a[1], var: Math.round((b[1] - a[1]) * 1e4) / 1e4, uvar: 'pp', unid: '% a.a.', data: b[0], fonte: 'Banco Central · SGS 432 (direto)'}; }
    var c = sgsPts(r.s4389, hoje); if (c.length) snap.indicadores.cdi = {nome: 'CDI (anualizado, base 252)', nivel: c[c.length - 1][1], unid: '% a.a.', data: c[c.length - 1][0], fonte: 'Banco Central · SGS 4389 (direto)'};
    var i1 = sgsPts(r.s433, hoje); if (i1.length) snap.indicadores.ipca_mes = {nome: 'IPCA do mês', nivel: i1[i1.length - 1][1], unid: '%', data: i1[i1.length - 1][0], fonte: 'IBGE via Banco Central · SGS 433 (direto)'};
    var i2 = sgsPts(r.s13522, hoje); if (i2.length) snap.indicadores.ipca_12m = {nome: 'IPCA em 12 meses', nivel: i2[i2.length - 1][1], unid: '%', data: i2[i2.length - 1][0], fonte: 'IBGE via Banco Central · SGS 13522 (direto)'};
    var p = sgsPts(r.s1, hoje); if (p.length >= 2) snap.indicadores.ptax = {nome: 'Dólar PTAX (venda)', nivel: p[p.length - 1][1], anterior: p[p.length - 2][1], var: (p[p.length - 1][1] / p[p.length - 2][1] - 1) * 100, unid: 'R$', data: p[p.length - 1][0], fonte: 'Banco Central · SGS 1 (direto)'};
    var u = r.cambio && r.cambio.USDBRL, cd = u ? String(u.create_date || '') : '';
    if (u && isFinite(Number(u.bid)) && isFinite(Number(u.pctChange)) && /^\d{4}-\d{2}-\d{2}/.test(cd)) {  // sem data da fonte, não entra
      var bid = Number(u.bid), pv = Number(u.pctChange);
      snap.fatores.usd = {k: 'usd', nome: 'Dólar', ok: true, nivel: bid, anterior: bid - Number(u.varBid || 0), var: pv, uvar: '%', unid: 'R$', data: cd.slice(0, 10), hora: cd.slice(11, 16) || null, fonte: 'AwesomeAPI (direto)',
        status: Math.abs(pv) >= 8 ? 'suspeito' : cd.slice(0, 10) === hoje ? 'atualizado' : 'desatualizado', motivo: Math.abs(pv) >= 8 ? 'variação anormal: conferir' : ''};
    }
    return snap;
  }
  function carimbo(f) { return (f && (f.data || '') + ' ' + (f.hora || '00:00')) || ''; }
  // O robô é a base; uma fonte direta só substitui um fator quando é mais recente
  function mesclar(robo, direto) {
    if (!robo && !direto) return null;
    if (!robo) return direto; if (!direto) return robo;
    var out = clone(robo); out.origem = 'robo+direto';
    // a fonte direta só substitui o robô quando o dado do robô falta ou é mais velho, e nunca um dado em conferência (suspeito)
    Object.keys(direto.fatores).forEach(function (k) { var a = out.fatores[k], b = direto.fatores[k]; if (!b || !b.ok || estado(b) === 'suspeito') return; if (a && a.ok && estado(a) === 'suspeito') return; if (!a || !a.ok || carimbo(b) > carimbo(a)) out.fatores[k] = b; });
    Object.keys(direto.indicadores).forEach(function (k) { var a = out.indicadores[k], b = direto.indicadores[k]; if (b && (!a || (b.data || '') > (a.data || ''))) out.indicadores[k] = b; });
    return out;
  }

  // ---------- leitura ----------
  // Estado de um dado: o robô v2 marca atualizado / desatualizado / suspeito / indisponivel. Fontes diretas e o formato
  // antigo não marcam: valem como atualizados na data que trazem. Só "atualizado" entra em cálculo do dia.
  function estado(c) { if (!c) return 'indisponivel'; if (c.status) return c.status; if (c.ok === false) return 'indisponivel'; return (c.preco != null || c.nivel != null) ? 'atualizado' : 'indisponivel'; }
  function usavel(c) { return estado(c) === 'atualizado'; }
  var ESTADO_TXT = {atualizado: 'atualizado', desatualizado: 'desatualizado', suspeito: 'variação anormal em conferência', indisponivel: 'indisponível'};
  // Sessão de referência: a data mais recente do Ibovespa ou do dólar atualizados (ou, sem eles, das cotações)
  function sessao(snap) {
    if (!snap) return null;
    var ib = snap.fatores && snap.fatores.ibov; if (ib && ib.ok && usavel(ib) && ib.data) return ib.data;
    var ds = Object.keys(snap.ativos || {}).map(function (t) { var c = snap.ativos[t]; return usavel(c) ? c.data : null; }).filter(Boolean);
    if (!ds.length) { var us = snap.fatores && snap.fatores.usd; if (us && us.ok && usavel(us)) ds = [us.data]; }
    return ds.sort().pop() || null;
  }
  // Variação entre o último ponto e o ponto mais recente até N dias corridos antes (para tendência: 1 mês, 12 meses)
  function tendencia(pts, dias) {
    if (!pts || pts.length < 2) return null;
    var ult = pts[pts.length - 1], alvo = new Date(Date.parse(ult[0]) - dias * 864e5).toISOString().slice(0, 10), base = null;
    for (var i = pts.length - 2; i >= 0; i--) if (pts[i][0] <= alvo) { base = pts[i]; break; }
    if (!base || !(base[1] !== 0) || Date.parse(alvo) - Date.parse(base[0]) > 10 * 864e5) return null;
    return {de: base[0], ate: ult[0], v0: base[1], v1: ult[1], r: ult[1] / base[1] - 1, d: ult[1] - base[1]};
  }
  function classe(C, t) {
    if (t === 'IBIT') return 'cripto';
    var a = C && C.ATV[t]; if (!a) return null;
    return {'Ação': 'acao', 'Ação (BDR)': 'acao', 'FII': 'fii', 'ETF de renda fixa': 'etf_rf'}[a.tipo] || null;
  }
  function cotacao(snap, C, t) {
    if (!snap || !snap.ativos) return null;
    var al = C && C.D && C.D.aliases && C.D.aliases[t]; var tt = al && al.para ? al.para : t;
    if (snap.ativos[tt]) return {c: snap.ativos[tt], id: tt, proxy: false};
    var p = C && C.ATV[t] && C.ATV[t].proxy_us; if (p && snap.ativos[p]) return {c: snap.ativos[p], id: p, proxy: true};
    return null;
  }
  function fmtNivel(f) {
    if (!f || f.nivel == null) return '—';
    var n = function (v, d) { return Number(v).toLocaleString('pt-BR', {minimumFractionDigits: d, maximumFractionDigits: d}); };
    if (PP[f.k] || f.uvar === 'pp') return n(f.nivel, 2) + '%';
    if (f.unid === 'R$') return 'R$ ' + n(f.nivel, f.nivel < 20 ? 4 : 2);
    if (f.unid === 'pts') return n(f.nivel, 0) + ' pts';
    if (f.unid === 'US$') return 'US$ ' + n(f.nivel, f.nivel > 1000 ? 0 : 2);
    return n(f.nivel, 2);
  }
  function fmtVar(v, uvar) {
    if (v == null || !isFinite(v)) return '—';
    var s = Math.abs(v).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    return (v > 0 ? '+' : v < 0 ? '−' : '') + s + (uvar === 'pp' ? ' p.p.' : '%');
  }
  // Mesmas regras do robô: id estável por movimento, nível "forte" a partir de 2× o limite
  function detectar(snap, lim, C) {
    if (!snap) return [];
    lim = lim || LIM_PADRAO; var out = [];
    FK.forEach(function (k) {
      var f = snap.fatores[k], L = lim.fatores[k], st = estado(f); if (!f || !f.ok || (st !== 'atualizado' && st !== 'suspeito') || f.var == null || L == null || Math.abs(f.var) + 1e-9 < L) return;
      var forte = Math.abs(f.var) >= 2 * L, sus = st === 'suspeito';
      out.push({id: k + ':' + f.data + ':' + (forte ? 'forte' : 'atencao') + ':' + (f.var > 0 ? '+' : '-'), tipo: 'fator', k: k, var: f.var, uvar: f.uvar, limite: L, nivel: sus ? 'conferir' : forte ? 'forte' : 'atenção', suspeito: sus, data: f.data,
        texto: (f.var > 0 ? '▲ ' : '▼ ') + (f.detalhe || f.nome || NOME[k]) + ': ' + fmtNivel(f) + ' (' + fmtVar(f.var, f.uvar) + '; limite ' + fmtVar(L, f.uvar).replace('+', '') + ')' + (sus ? ' · variação anormal: conferir antes de usar' : '')});
    });
    Object.keys(snap.ativos || {}).forEach(function (t) {
      var c = snap.ativos[t], cl = classe(C, t), st = estado(c); if (!cl || (st !== 'atualizado' && st !== 'suspeito')) return;
      var L = lim.ativos[cl]; if (L == null || c.var == null || Math.abs(c.var) + 1e-9 < L) return;
      var forte = Math.abs(c.var) >= 2 * L, nome = C && C.ATV[t] ? C.ATV[t].nome : t, sus = st === 'suspeito';
      out.push({id: t + ':' + c.data + ':' + (forte ? 'forte' : 'atencao') + ':' + (c.var > 0 ? '+' : '-'), tipo: 'ativo', t: t, var: c.var, uvar: '%', limite: L, nivel: sus ? 'conferir' : forte ? 'forte' : 'atenção', suspeito: sus, data: c.data,
        texto: (c.var > 0 ? '▲ ' : '▼ ') + t + ' (' + nome + '): ' + (c.moeda === 'USD' ? 'US$ ' : 'R$ ') + Number(c.preco).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' (' + fmtVar(c.var, '%') + '; limite ' + fmtVar(L, '%').replace('+', '') + ')' + (sus ? ' · variação anormal: conferir antes de usar' : '')});
    });
    // indicadores (IPCA divulgado, Focus) e notícias de alta relevância vêm prontos do robô
    (snap.alertas || []).forEach(function (a) { if (a && (a.tipo === 'indicador' || a.tipo === 'noticia') && a.id) out.push(a); });
    return out;
  }
  // Movimentos reais da sessão, nas unidades do motor (p.p. para juros, % para preços)
  function choquesDoDia(snap, ses) {
    var ch = {}; if (!snap || !ses) return ch;
    FK.forEach(function (k) { var f = snap.fatores[k]; if (f && f.ok && usavel(f) && f.data === ses && f.var != null && isFinite(f.var) && Math.abs(f.var) > 1e-9) ch[k] = Math.round(f.var * 100) / 100; });
    return ch;
  }
  // Parte de cada ativo que o motor não explica com os fatores: realizado − motor. Assim o cenário base reproduz o dia.
  function idioDoDia(snap, ses, C, sens, ch) {
    var out = {}; if (!snap || !ses) return out;
    Object.keys(C.ATV).forEach(function (t) {
      var q = cotacao(snap, C, t); if (!q || !usavel(q.c) || q.c.data !== ses || q.c.var == null) return;
      var r = C.retAtivo(t, ch, sens); if (!r.ok) return;
      var id = Math.round((q.c.var / 100 - r.local) * 1e4) / 100;
      if (Math.abs(id) >= 0.05) out[t] = id;
    });
    return out;
  }
  // Retorno realizado da carteira na sessão, só com as posições que têm cotação do dia (sem normalizar)
  function carteiraHoje(v, snap, ses, C) {
    var usd = snap && snap.fatores.usd, fx = usd && usd.ok && usavel(usd) && usd.data === ses ? usd.var / 100 : null;
    var itens = [], fora = [], tot = 0, cob = 0, soma = 0;
    (v.pos || []).forEach(function (x) {
      if (!(x.w > 0)) return; soma += x.w;
      var q = cotacao(snap, C, x.t);
      var st = q ? estado(q.c) : 'indisponivel';
      if (!q || st !== 'atualizado' || q.c.data !== ses || q.c.var == null) { fora.push({t: x.t, w: x.w, motivo: !q ? 'sem cotação' : st === 'indisponivel' ? 'sem cotação' + (q.c.motivo ? ' (' + q.c.motivo + ')' : '') : st !== 'atualizado' ? ESTADO_TXT[st] : 'cotação de outra data'}); return; }
      var r = q.c.var / 100, usdA = C.ATV[x.t] && C.ATV[x.t].moeda === 'USD';
      if (usdA) { if (fx == null) { fora.push({t: x.t, w: x.w, motivo: 'sem dólar do dia'}); return; } r = (1 + r) * (1 + fx) - 1; }
      tot += x.w * r; cob += x.w;
      itens.push({t: x.t, p: x.p, w: x.w, r: r, ctb: x.w * r, proxy: q.proxy ? q.id : null, fonte: q.c.fonte});
    });
    return {itens: itens, fora: fora, total: tot, coberto: cob, soma: soma};
  }
  function idade(snap, agora) { if (!snap || !snap.gerado_em) return null; return Math.max(0, (agora - new Date(snap.gerado_em).getTime()) / 60000); }

  return {estado: estado, usavel: usavel, ESTADO_TXT: ESTADO_TXT, tendencia: tendencia, ROBO_PADRAO: ROBO_PADRAO, FK: FK, NOME: NOME, LIM_PADRAO: LIM_PADRAO, CFG_PADRAO: CFG_PADRAO, cfgCompleta: cfgCompleta, urlRobo: urlRobo, urlsDiretas: urlsDiretas, sgsPts: sgsPts, normDireto: normDireto, mesclar: mesclar,
    sessao: sessao, classe: classe, cotacao: cotacao, detectar: detectar, choquesDoDia: choquesDoDia, idioDoDia: idioDoDia, carteiraHoje: carteiraHoje, fmtNivel: fmtNivel, fmtVar: fmtVar, idade: idade, isoLocal: isoLocal, hojeBRT: hojeBRT};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MERCADO;

/* ---------- tela e ciclo de atualização (só no navegador) ---------- */
if (typeof APP !== 'undefined') (function (A, C, M) {
  'use strict';
  var h = A.h, S = A.S;
  var LS_SNAP = 'oregon-mercado-snap', LS_PROC = 'oregon-mercado-proc', LS_LOG = 'oregon-mercado-log', LS_CFG = 'oregon-mercado-cfg';
  var E = {snap: null, robo: null, direto: null, status: {}, carregando: false, timer: null, novos: 0, ultimo: null, hist: null};
  function lsGet(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  // configuração: no banco do painel (claude.ai) ou neste navegador; uma cópia local garante que o arquivo funcione sozinho
  function cfg() { return M.cfgCompleta(STORE.get('config', 'mercado') || lsGet(LS_CFG, null)); }
  async function salvarCfg(c) { lsSet(LS_CFG, c); try { await STORE.put('config', 'mercado', c); } catch (e) {} reagendar(); }
  var naoAcessa = function () { return STORE.mode === 'db' || !!(window.claude && window.claude.use); };
  // Publicado no GitHub Pages: os dados do robô estão no mesmo endereço do painel (pasta data/), sem configurar nada
  function siteBase() { try { if (/^https?:$/.test(location.protocol) && !naoAcessa()) return new URL('data/', location.href).href; } catch (e) {} return null; }
  function fonteRobo(c) { var b = siteBase(); if (b) return {mercado: b + 'mercado.json', historico: b + 'historico.json', noticias: b + 'noticias.json', site: true}; return M.urlRobo((c || cfg()).robo); }

  async function getJSON(url, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, t = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 10000);
    try { var r = await fetch(url, {signal: ctl ? ctl.signal : undefined, cache: 'no-store'}); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
    finally { clearTimeout(t); }
  }
  function motivo(e) { var m = String(e && (e.message || e) || ''); return /sem dados/.test(m) ? 'arquivo do robô sem dados (rodada incompleta); tenta de novo na próxima' : /HTTP 404/.test(m) ? 'não encontrado (confira o endereço ou se o robô já rodou)' : /HTTP/.test(m) ? m : /abort/i.test(m) ? 'sem resposta em 10 s' : 'bloqueado pelo navegador ou sem internet'; }

  async function atualizar(manual) {
    if (E.carregando) return; E.carregando = true; if (manual) A.render();
    try { await atualizarAgora(); } catch (e) { console.warn(e); E.status = Object.assign({}, E.status, {robo: {ok: false, msg: motivo(e)}}); }
    finally { E.carregando = false; A.render(); }
  }
  async function atualizarAgora() {
    var c = cfg(), agora = new Date(), hoje = M.hojeBRT(agora), st = {};
    var urls = fonteRobo(c), tarefas = [];
    if (urls) tarefas.push(getJSON(urls.mercado + '?t=' + Date.now()).then(function (j) { if (!j || !j.fatores) throw new Error('arquivo sem dados'); return j; }).then(function (j) { E.robo = j; st.robo = {ok: true, msg: 'gerado ' + new Date(j.gerado_em).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}; }, function (e) { st.robo = {ok: false, msg: motivo(e)}; }));
    else st.robo = {ok: null, msg: 'não configurado'};
    if (urls && urls.noticias && (!E.arquivoEm || Date.now() - E.arquivoEm > 30 * 60000)) tarefas.push(getJSON(urls.noticias + '?t=' + Date.now(), 30000).then(function (j) { if (j && Array.isArray(j.itens)) { E.arquivo = j; E.arquivoEm = Date.now(); } }, function () {}));
    var raw = {};
    if (c.diretas) {
      var U = M.urlsDiretas(hoje);
      tarefas = tarefas.concat(Object.keys(U).map(function (k) { return getJSON(U[k]).then(function (j) { raw[k] = j; }, function (e) { raw[k] = null; st[k === 'cambio' ? 'cambio' : 'bcb_' + k] = {ok: false, msg: motivo(e)}; }); }));
    }
    await Promise.all(tarefas);
    if (c.diretas) {
      var nb = ['s432', 's4389', 's433', 's13522', 's1'].filter(function (k) { return raw[k]; }).length;
      st.bcb = nb ? {ok: true, msg: nb + ' de 5 séries'} : {ok: false, msg: (st.bcb_s432 || {}).msg || 'sem resposta'};
      st.cambio = raw.cambio ? {ok: true, msg: 'dólar ao vivo'} : (st.cambio || {ok: false, msg: 'sem resposta'});
      ['s432', 's4389', 's433', 's13522', 's1'].forEach(function (k) { delete st['bcb_' + k]; });
      E.direto = nb || raw.cambio ? M.normDireto(raw, hoje, agora.toISOString()) : null;
    } else { st.bcb = {ok: null, msg: 'desligado'}; st.cambio = {ok: null, msg: 'desligado'}; E.direto = null; }
    // fonte direta bloqueada pelo navegador não é problema quando o robô responde: ele traz os mesmos dados
    if (st.robo && st.robo.ok) ['bcb', 'cambio'].forEach(function (k) { if (st[k] && st[k].ok === false) st[k] = {ok: null, msg: 'o navegador não deixou consultar direto; os dados vêm do robô'}; });
    var novo = M.mesclar(E.robo, E.direto);
    E.status = st; E.ultimo = agora.toISOString();
    if (novo) { E.snap = novo; lsSet(LS_SNAP, novo); await processar(novo, c); }
    if (E.robo && E.robo.historico && E.robo.historico.disponivel && urls && urls.historico) { try { await historicoAuto(urls, E.robo.historico.data_ref); } catch (e) { console.warn(e); } }
  }
  // Séries do robô: carregadas sozinhas uma vez por dia (tendências da página Hoje e modelo de risco).
  // Séries que você importou de outra fonte nunca são trocadas; séries marcadas como suspeitas pelo robô ficam de fora do modelo.
  var LS_HREF = 'oregon-hist-ref';
  async function historicoAuto(urls, ref) {
    if (E.histData && E.histData.data_ref === ref) return;
    var j = await getJSON(urls.historico + '?t=' + Date.now(), 60000); if (!j || !j.series) return;
    E.histData = j;
    if (lsGet(LS_HREF, null) === j.data_ref) return;
    var atuais = await STORE.series(), lote = [], fora = [], mantidas = [];
    Object.keys(j.series).forEach(function (id) {
      var x = j.series[id], old = atuais[id];
      if (old && old.origem !== 'robo') { mantidas.push(id); return; }
      if (x.qualidade === 'suspeita' || !Array.isArray(x.pts) || !x.pts.length) { fora.push(id); return; }
      lote.push({id: id, pts: x.pts, meta: {tipo: x.tipo, moeda: x.moeda, fonte: x.fonte, arquivo: 'robô · ' + (j.data_ref || ''), origem: 'robo', retorno_total: x.retorno_total, ajuste: x.ajuste, qualidade: x.qualidade}});
    });
    await STORE.saveSeriesLote(lote, fora.filter(function (id) { return atuais[id] && atuais[id].origem === 'robo'; }), 'referência ' + A.dataBR(j.data_ref));
    var novos = lote.length;
    lsSet(LS_HREF, j.data_ref);
    if (A.carregarTabelas) await A.carregarTabelas();
    E.hist = {ok: true, msg: novos + ' séries do robô de ' + A.dataBR(j.data_ref) + (fora.length ? '; fora do modelo por qualidade suspeita: ' + fora.join(', ') : '') + (mantidas.length ? '; mantidas as importadas por você: ' + mantidas.join(', ') : '') + '.'};
  }
  A.mercadoHist = function () { return E.histData || null; };
  A.mercadoCfg = function () { return cfg(); };
  A.mercadoBloqueado = function () { return naoAcessa(); };
  A.mercadoAtualizar = function () { return atualizar(true); };

  // Alertas novos da sessão → aviso + reunião automática na Sala
  async function processar(snap, c) {
    var ses = M.sessao(snap), al = M.detectar(snap, c.limites, C);
    var proc = lsGet(LS_PROC, {}), vistos = proc[ses] || [], todos = {};
    Object.keys(proc).forEach(function (k) { (proc[k] || []).forEach(function (id) { todos[id] = 1; }); });
    var novos = al.filter(function (a) { return !todos[a.id]; });
    if (!novos.length) return;
    var log = lsGet(LS_LOG, []), q = new Date().toISOString();
    novos.forEach(function (a) { log.unshift({quando: q, id: a.id, texto: a.texto, nivel: a.nivel, tipo: a.tipo}); });
    lsSet(LS_LOG, log.slice(0, 300));
    var pr = {}; Object.keys(proc).sort().slice(-10).forEach(function (k) { pr[k] = proc[k]; }); pr[ses] = vistos.concat(novos.map(function (a) { return a.id; }));
    lsSet(LS_PROC, pr);
    // primeira leitura neste aparelho: registra sem disparar aviso (não é novidade para quem acabou de abrir)
    if (!Object.keys(proc).length) return;
    E.novos += novos.length;
    avisar(novos);
    if (c.autoSala && A.salaAuto) { try { await reuniaoDoDia(snap, ses, al, c); } catch (e) { console.warn(e); } }
  }
  async function reuniaoDoDia(snap, ses, al, c) {
    var P = A.prem(), ch = M.choquesDoDia(snap, ses), id = M.idioDoDia(snap, ses, C, P.sens, ch);
    var mov = al.filter(function (a) { return (a.tipo === 'fator' || a.tipo === 'ativo') && a.data === ses && !a.suspeito; });
    if (!mov.length) return null;
    var fortes = mov.slice().sort(function (a, b) { return Math.abs(b.var) / b.limite - Math.abs(a.var) / a.limite; }).slice(0, 3);
    var titulo = 'Mercado de ' + A.dataBR(ses) + ': ' + fortes.map(function (a) { return (a.k ? M.NOME[a.k] : a.t) + ' ' + M.fmtVar(a.var, a.uvar); }).join(', ');
    var fatos = FKfatos(snap, ses);
    var held = {}; C.CARTS.forEach(function (m) { (STORE.aprovadaVigente(C, m.id).pos || []).forEach(function (x) { held[x.t] = 1; }); });
    var nots = (snap.noticias || []).filter(function (n) { return (n.quando || '').slice(0, 10) >= ses && (held[n.tema] || (n.ia && n.ia.relevancia === 'alta')); }).slice(0, 6);
    var texto = 'Sessão de ' + A.dataBR(ses) + ' (leitura das ' + new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) + '). Movimentos acima dos limites de alerta:\n' + mov.map(function (a) { return '- ' + a.texto; }).join('\n') +
      (nots.length ? '\n\nManchetes do dia ligadas à carteira:\n' + nots.map(function (n) { return '- ' + (n.tema ? n.tema + ': ' : '') + n.titulo + ' (' + (n.fonte || 'fonte não informada') + ')'; }).join('\n') : '');
    var atencao = mov.filter(function (a) { return a.tipo === 'ativo' && held[a.t]; }).map(function (a) { return {ticker: a.t, sinal: a.var > 0 ? 'beneficia' : 'atenção', motivo: 'Moveu ' + M.fmtVar(a.var, '%') + ' na sessão (limite ' + M.fmtVar(a.limite, '%').replace('+', '') + ').'}; });
    return A.salaAuto({ses: ses, titulo: titulo, texto: texto, fonte: fontesTxt(snap), choques: ch, idio: id, fatos: fatos, atencao: atencao, aplicar: c.aplicarCenario});
  }
  function FKfatos(snap, ses) {
    var out = [];
    M.FK.forEach(function (k) { var f = snap.fatores[k]; if (f && f.ok && M.usavel(f) && f.data === ses && f.var) out.push((f.detalhe || f.nome) + ': ' + M.fmtNivel(f) + ' (' + M.fmtVar(f.var, f.uvar) + ') · ' + f.fonte + (f.hora ? ', ' + f.hora : '')); });
    return out.length ? out : ['Sem fator com movimento datado na sessão.'];
  }
  function fontesTxt(snap) { var s = {}; M.FK.forEach(function (k) { var f = snap.fatores[k]; if (f && f.ok && f.fonte) s[f.fonte.replace(/ \(direto\)$/, '')] = 1; }); return Object.keys(s).join('; ') || 'robô de mercado'; }

  function avisar(novos) {
    var curto = function (a) { return a.tipo === 'fator' ? M.NOME[a.k] + ' ' + M.fmtVar(a.var, a.uvar) : a.tipo === 'ativo' ? a.t + ' ' + M.fmtVar(a.var, '%') : a.texto.slice(0, 70); };
    var c = cfg(), txt = novos.length === 1 ? novos[0].texto : novos.length + ' alertas de mercado: ' + novos.slice(0, 4).map(curto).join(' · ') + (novos.length > 4 ? ' e mais ' + (novos.length - 4) : '');
    A.toast(txt, 9000);
    try { document.title = '(' + E.novos + ') Painel Carteira Oregon'; } catch (e) {}
    if (c.som) { try { var ac = new (window.AudioContext || window.webkitAudioContext)(), o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; g.gain.value = 0.06; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.25); } catch (e) {} }
    if (c.notificar && window.Notification && Notification.permission === 'granted') { try { new Notification('Oregon · mercado', {body: txt.slice(0, 220)}); } catch (e) {} }
  }
  function reagendar() {
    if (E.timer) clearInterval(E.timer);
    if (naoAcessa()) return;
    var c = cfg(); if (!c.robo && !c.diretas && !siteBase()) return;
    E.timer = setInterval(function () { if (!document.hidden) atualizar(false); }, c.intervalo * 60000);
  }
  A.mercadoIniciar = function () {
    E.snap = lsGet(LS_SNAP, null);
    if (naoAcessa()) return;
    var c = cfg(); if (!c.robo && !c.diretas && !siteBase()) return;
    setTimeout(function () { atualizar(false); }, 1500); reagendar();
    document.addEventListener('visibilitychange', function () { if (!document.hidden && E.ultimo && (Date.now() - new Date(E.ultimo).getTime()) > cfg().intervalo * 60000) atualizar(false); });
  };
  A.mercadoVisto = function () { E.novos = 0; try { document.title = 'Painel Carteira Oregon'; } catch (e) {} };

  /* ---------- telas ---------- */
  function chipStatus(nome, s) { s = s || {ok: null, msg: '—'}; return A.chip((s.ok ? '✓ ' : s.ok === false ? '✕ ' : '· ') + nome, s.ok ? 'o-obs' : s.ok === false ? 'g-critica' : '', s.msg); }
  function hm(iso) { try { return new Date(iso).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}); } catch (e) { return '—'; } }

  /* ---------- qualidade dos dados ---------- */
  function nivelDados() {
    var snap = E.snap; if (!snap) return {nivel: null, txt: E.carregando ? 'buscando dados…' : 'sem dados'};
    var st = snap.status || {}, nv = st.nivel || (snap.origem === 'direto' ? 'parcial' : 'completo');
    var idade = M.idade(snap, Date.now()), velho = idade != null && idade > 26 * 60;
    return {nivel: nv, velho: velho, idade: idade, txt: 'Dados ' + (A.dataBR(snap.gerado_em).slice(0, 5)) + ' ' + hm(snap.gerado_em) + (nv && nv !== 'completo' ? ' · ' + nv : '')};
  }
  A.dadosPill = function () {
    var q = nivelDados();
    return h('button', {class: 'dstat', title: 'Qualidade e origem dos dados', onclick: function () { A.abrirQualidade(); }}, h('i', {class: 'dot ' + (q.nivel || 'indisponivel') + (q.velho ? ' desatualizado' : '')}), (E.carregando ? '… ' : '') + q.txt + (E.novos ? ' · ' + E.novos + ' novo' + (E.novos > 1 ? 's' : '') : ''));
  };
  A.qualidadeLinha = function () {
    var snap = E.snap, q = nivelDados(); if (!snap) return null;
    var cob = snap.cobertura || {}, H = E.histData;
    return h('div', {class: 'fq'},
      h('span', null, h('i', {class: 'dot ' + (q.nivel || 'indisponivel')}), 'Rodada ' + ({completo: 'completa', parcial: 'parcial', critico: 'crítica'}[q.nivel] || '—')),
      cob.total ? h('span', null, cob.atualizados + ' de ' + cob.total + ' cotações atualizadas' + (cob.desatualizados ? ' · ' + cob.desatualizados + ' desatualizada(s)' : '') + (cob.suspeitos ? ' · ' + cob.suspeitos + ' em conferência' : '') + (cob.indisponiveis ? ' · ' + cob.indisponiveis + ' sem cotação' : '')) : null,
      h('span', null, 'gerado ' + A.dataBR(snap.gerado_em) + ' ' + hm(snap.gerado_em) + (q.idade != null ? ' (há ' + (q.idade < 90 ? Math.round(q.idade) + ' min' : q.idade < 2880 ? Math.round(q.idade / 60) + ' h' : Math.round(q.idade / 1440) + ' dias') + ')' : '')),
      H ? h('span', null, 'séries históricas de ' + A.dataBR(H.data_ref)) : null,
      h('button', {class: 'btn link', onclick: function () { A.abrirQualidade(); }}, 'Detalhes'));
  };
  A.abrirQualidade = function () {
    var snap = E.snap, c = cfg(), body = h('div'), q = nivelDados();
    if (snap && snap.simulado) body.appendChild(h('div', {class: 'alert warn'}, 'Dados SIMULADOS de teste carregados neste aparelho. Nenhum número é real.'));
    body.appendChild(h('div', {class: 'row', style: 'margin-bottom:8px'}, h('i', {class: 'dot ' + (q.nivel || 'indisponivel')}), h('b', null, snap ? 'Última rodada do robô: ' + ({completo: 'COMPLETA', parcial: 'PARCIAL', critico: 'CRÍTICA'}[q.nivel] || '—') : 'Sem leitura do robô'),
      h('span', {class: 'grow'}), h('button', {class: 'btn sm', disabled: E.carregando || naoAcessa() || null, onclick: function () { d.remove(); atualizar(true); }}, E.carregando ? 'Buscando…' : 'Buscar agora')));
    if (naoAcessa()) body.appendChild(h('div', {class: 'alert warn'}, 'Nesta página do claude.ai o navegador não acessa a internet. Os dados ao vivo aparecem no site do painel (GitHub Pages) e no arquivo aberto no computador.'));
    if (snap) {
      var st = snap.status || {}, cob = snap.cobertura || {};
      if ((st.motivos || []).length) body.appendChild(h('ul', null, st.motivos.map(function (m) { return h('li', null, m); })));
      body.appendChild(h('dl', {class: 'kv', style: 'margin:10px 0'},
        h('dt', null, 'Gerado em'), h('dd', null, A.dataBR(snap.gerado_em) + ' ' + hm(snap.gerado_em) + (q.velho ? ' · mais de 26 horas: confira o robô no GitHub (aba Actions)' : '')),
        snap.referencias ? h('dt', null, 'Sessões de referência') : null, snap.referencias ? h('dd', null, 'B3 ' + A.dataBR(snap.referencias.sessao_b3) + ' (fechamento publicado: ' + A.dataBR(snap.referencias.fechada_b3) + ') · EUA ' + A.dataBR(snap.referencias.sessao_eua)) : null,
        cob.total ? h('dt', null, 'Cotações') : null, cob.total ? h('dd', null, cob.atualizados + ' de ' + cob.total + ' atualizadas (' + A.num(cob.taxa_sucesso, 0) + '%): ' + cob.intradiarios + ' intradiárias, ' + cob.fechamentos + ' de fechamento; ' + cob.desatualizados + ' desatualizadas, ' + cob.suspeitos + ' suspeitas, ' + cob.indisponiveis + ' sem cotação') : null,
        E.histData ? h('dt', null, 'Séries históricas') : null, E.histData ? h('dd', null, Object.keys(E.histData.series || {}).length + ' séries de ' + A.dataBR(E.histData.data_ref) + (E.hist ? ' · ' + E.hist.msg : '')) : null));
      var lista = function (rot, ids, f) { return ids && ids.length ? h('div', null, h('h3', null, rot + ' (' + ids.length + ')'), h('ul', {class: 'issues'}, ids.map(function (t) { var x = (snap.ativos || {})[t] || (snap.fatores || {})[t] || {}; return h('li', null, h('b', null, t), h('div', null, f(x))); }))) : null; };
      body.append(
        lista('Sem cotação', cob.lista_indisponiveis, function (x) { return x.motivo || 'sem motivo informado'; }),
        lista('Desatualizadas (último valor válido, marcado)', cob.lista_desatualizados, function (x) { return (x.motivo || '') + (x.fonte ? ' · ' + x.fonte : ''); }),
        lista('Variação anormal, em conferência', cob.lista_suspeitos, function (x) { return M.fmtVar(x.var, '%') + ' · ' + (x.fonte || '') + ' · fora dos cálculos até conferir'; }));
      if (cob.por_fornecedor && Object.keys(cob.por_fornecedor).length) body.appendChild(h('div', null, h('h3', null, 'Fornecedores nesta rodada'), A.table([{k: 'f', t: 'Fonte'}, {k: 't', t: 'Pedidos', r: 1}, {k: 'o', t: 'Acertos', r: 1}, {k: 'x', t: 'Falhas', s: false}],
        Object.keys(cob.por_fornecedor).map(function (k) { var s = cob.por_fornecedor[k]; return {f: k, t: s.tentativas, o: s.ok, x: Object.keys(s.falhas || {}).map(function (e) { return e + ': ' + s.falhas[e]; }).join(', ') + (s.pausada_por ? ' · pausada (' + s.pausada_por + ')' : '') || '—'}; }), {sort: null})));
      if ((cob.fontes_sem_chave || []).length) body.appendChild(h('p', {class: 'hint'}, 'Fontes opcionais sem chave configurada: ' + cob.fontes_sem_chave.join(', ') + '. Ver docs/FONTES.md no repositório.'));
      if (snap.fontes) body.appendChild(h('div', null, h('h3', null, 'Outras fontes'), h('div', {class: 'row', style: 'gap:6px;flex-wrap:wrap'}, Object.keys(snap.fontes).map(function (k) { var f = snap.fontes[k]; return chipStatus({bcb: 'Banco Central', focus: 'Focus', tesouro: 'Tesouro', treasury: 'Tesouro dos EUA', b3: 'B3 (arquivo oficial)', cotacoes: 'Cotações', noticias: 'Notícias', ia: 'Leitura por IA', telegram: 'Telegram', historico: 'Histórico'}[k] || k, {ok: f.ok, msg: (f.msg || '') + (f.quando ? ' · ' + hm(f.quando) : '')}); }))));
    }
    body.appendChild(h('div', null, h('h3', null, 'Neste navegador'), h('div', {class: 'row', style: 'gap:6px;flex-wrap:wrap'}, chipStatus(siteBase() ? 'Robô (este site)' : 'Robô', E.status.robo || {ok: null, msg: 'aguardando'}), chipStatus('Banco Central direto', E.status.bcb), chipStatus('Câmbio direto', E.status.cambio))));
    body.appendChild(h('div', {class: 'row', style: 'margin-top:14px'}, h('button', {class: 'btn', onclick: function () { d.remove(); var dd = A.drawer('Mercado: todos os números', A.mercadoTela()); dd.classList.add('wide'); }}, 'Todos os números'), h('button', {class: 'btn', onclick: function () { d.remove(); configurar(); }}, 'Configurar')));
    var d = A.drawer('Qualidade dos dados', body);
  };
  // Gaveta de um fator: nível, histórico, mecanismo e exposição das carteiras
  A.abrirFator = function (k) {
    var snap = E.snap, f = snap && snap.fatores[k], H = E.histData, sid = {ibov: 'IBOV', usd: 'USDBRL', pre: 'DI', real: 'NTNB', selic: 'SELIC', brent: 'BRENT', sp: 'SPX', ust10: 'UST10', ust2: 'UST2', em: 'EEM', btc: 'BTC'}[k];
    var s = H && H.series && sid ? H.series[sid] : null, mec = A.MEC && A.MEC[k], ex = A.exposicaoFator ? A.exposicaoFator(k) : [];
    var body = h('div');
    if (f && f.ok) body.appendChild(h('dl', {class: 'kv'}, h('dt', null, 'Nível'), h('dd', null, M.fmtNivel(f) + (f.var != null ? ' (' + M.fmtVar(f.var, f.uvar) + ')' : '')), h('dt', null, 'Estado'), h('dd', null, M.ESTADO_TXT[M.estado(f)] + (f.motivo ? ' · ' + f.motivo : '')), h('dt', null, 'Fonte'), h('dd', null, (f.detalhe ? f.detalhe + ' · ' : '') + f.fonte + ' · ' + A.dataBR(f.data) + (f.hora ? ' ' + f.hora : '') + (f.tipo_preco ? ' · ' + (f.tipo_preco === 'fechamento' ? 'fechamento' : 'intradiário') : ''))));
    else body.appendChild(h('div', {class: 'alert warn'}, 'Sem dado deste fator na última rodada' + (f && f.motivo ? ': ' + f.motivo : '') + '.'));
    if (s) body.appendChild(h('div', null, h('h3', null, 'Histórico (' + A.dataBR(s.inicio) + ' a ' + A.dataBR(s.fim) + ')'), A.lines([{name: M.NOME[k], pts: s.pts}], {fmt: function (v) { return s.tipo === 'taxa' ? A.num(v, 2) + '%' : A.num(v, v > 1000 ? 0 : 2); }, h: 200}), h('p', {class: 'hint'}, 'Série ' + ({taxa: 'de taxa (% a.a.)', nivel: 'de nível (índice ou preço)', ajustado: 'ajustada por proventos', preco: 'de preço sem ajuste'}[s.tipo] || s.tipo) + ' · ' + s.fonte + (s.qualidade && s.qualidade !== 'ok' ? ' · qualidade: ' + s.qualidade + (s.motivo ? ' (' + s.motivo + ')' : '') : ''))));
    if (mec) body.appendChild(h('div', null, h('h3', null, 'Como chega às carteiras'), h('p', null, mec.txt), h('p', {class: 'muted'}, 'Acompanhar: ' + mec.ver + '.')));
    if (ex.length) body.appendChild(h('div', null, h('h3', null, 'Peso exposto por carteira (versão aprovada)'), A.hbars(ex.map(function (x) { return {label: x.m.rotulo, v: x.w, color: A.FAMC[x.m.familia]}; }), {fmt: function (v) { return A.pct(v, 1); }}), h('p', {class: 'hint'}, 'Soma dos pesos nos pilares e ativos ligados a este fator. É exposição bruta, não sensibilidade estimada.')));
    A.drawer(M.NOME[k] || k, body);
  };

  // faixa compacta na Carteira: como a carteira escolhida andou na sessão
  A.mercadoFaixa = function () {
    var snap = E.snap, ses = M.sessao(snap);
    if (!snap || !ses) return null;
    var v = A.versao(), r = M.carteiraHoje(v, snap, ses, C), cob = r.soma > 0 ? r.coberto / r.soma : 0;
    var held = {}; (v.pos || []).forEach(function (x) { if (x.w > 0) held[x.t] = 1; });
    var al = M.detectar(snap, cfg().limites, C).filter(function (a) { return a.tipo === 'ativo' && a.data === ses && held[a.t]; });  // em conferência aparece marcado
    return h('div', {class: 'mkt-faixa', role: 'status'},
      h('span', {title: 'Contribuição, em p.p. da carteira, das posições com cotação atualizada. A parte sem cotação não entra e não vira zero: não é o retorno da carteira enquanto a cobertura for menor que 100%.'}, 'Sessão de ' + A.dataBR(ses) + ': contribuição das posições cotadas ', cob >= 0.5 ? h('b', {class: A.cls(r.total)}, A.pp(r.total, 2)) : h('span', {class: 'muted'}, '— (cobertura baixa)'), h('span', {class: 'muted'}, ' · ' + A.pct(cob, 0) + ' da carteira cotada')),
      al.length ? h('span', null, al.map(function (a) { return h('span', {style: 'margin-right:10px'}, A.tk(a.t), ' ', h('b', {class: a.suspeito ? 'muted' : A.cls(a.var)}, M.fmtVar(a.var, '%')), a.suspeito ? h('span', {class: 'muted', title: 'Variação anormal: fora dos cálculos até ser conferida.'}, ' (conferir)') : null); })) : h('span', {class: 'muted'}, 'nenhum ativo desta carteira acima do limite de alerta'),
      h('button', {class: 'btn sm', onclick: function () { A.go('hoje'); }}, 'Hoje'));
  };
  // indicador no topo
  A.mercadoPill = function () {
    var snap = E.snap; if (!snap && naoAcessa()) return null;
    var n = E.novos;
    return h('button', {class: 'tbtn', title: 'Mercado ao vivo', onclick: function () { A.go('mesa', 'mercado'); }}, (E.carregando ? '… ' : '') + 'Mercado' + (n ? ' · ' + n + ' novo' + (n > 1 ? 's' : '') : snap ? ' · ' + hm(snap.gerado_em) : ''));
  };

  A.mercadoTela = function () {
    A.mercadoVisto();
    var c = cfg(), snap = E.snap, ses = M.sessao(snap), wrap = h('div');
    var bloqueado = naoAcessa();
    // 1. estado das fontes
    var idade = M.idade(snap, Date.now());
    wrap.appendChild(A.sec('Mercado ao vivo', {mtd: 'mercado', hint: 'O painel busca os dados sozinho a cada ' + c.intervalo + ' min enquanto estiver aberto. O robô no GitHub roda a cada 30 min em dias úteis, avisa no Telegram e guarda notícias e séries. Valores sem fonte nunca aparecem.',
      right: h('div', {class: 'row'}, h('button', {class: 'btn sm pri', disabled: E.carregando || bloqueado || null, onclick: function () { atualizar(true); }}, E.carregando ? 'Buscando…' : 'Atualizar agora'), h('button', {class: 'btn sm', onclick: configurar}, 'Configurar'))}, [
      bloqueado ? h('div', {class: 'alert warn'}, h('b', null, 'Neste link do claude.ai a página não acessa a internet '), '(regra da plataforma para páginas publicadas). O acompanhamento ao vivo funciona no arquivo ', h('b', null, 'Painel_Carteira_Oregon.html'), ' aberto no Chrome do seu computador. Os avisos do robô chegam no Telegram de qualquer jeito.') : null,
      !bloqueado && !fonteRobo(c) ? h('div', {class: 'alert'}, h('b', null, 'Robô ainda não ligado. '), c.diretas ? 'Por enquanto o painel lê direto do Banco Central (Selic, CDI, IPCA, PTAX) e o dólar ao vivo. ' : '', 'Com o robô ligado entram juros do Tesouro, Treasuries, Ibovespa, S&P 500, Brent, bitcoin, as cotações de todos os ativos das carteiras, notícias, alertas no Telegram e as séries para o modelo de risco. Siga o guia de ativação e cole o endereço do repositório em “Configurar”.') : null,
      h('div', {class: 'row', style: 'gap:6px;flex-wrap:wrap'},
        snap ? h('span', null, 'Última leitura: ', h('b', null, A.dataBR(snap.gerado_em) + ' ' + hm(snap.gerado_em)), idade != null ? h('span', {class: 'muted'}, ' (há ' + (idade < 90 ? Math.round(idade) + ' min' : idade < 2880 ? Math.round(idade / 60) + ' h' : Math.round(idade / 1440) + ' dias') + ')') : null, ' · sessão de referência ', h('b', null, A.dataBR(ses))) : h('span', {class: 'muted'}, 'Ainda sem leitura.'),
        h('span', {class: 'grow'}),
        chipStatus(siteBase() ? 'Robô (este site)' : 'Robô', E.status.robo || (fonteRobo(c) ? {ok: null, msg: 'aguardando'} : {ok: null, msg: 'não configurado'})), chipStatus('Banco Central', E.status.bcb), chipStatus('Câmbio ao vivo', E.status.cambio)),
      snap && snap.fontes && Object.keys(snap.fontes).length ? A.more('Fontes do robô (' + Object.keys(snap.fontes).filter(function (k) { return snap.fontes[k].ok; }).length + ' de ' + Object.keys(snap.fontes).length + ' responderam na última rodada)', h('div', {class: 'row', style: 'gap:6px;flex-wrap:wrap'}, Object.keys(snap.fontes).map(function (k) { var f = snap.fontes[k]; return chipStatus({bcb: 'Banco Central', focus: 'Focus', tesouro: 'Tesouro Direto', treasury: 'Tesouro dos EUA', cotacoes: 'Cotações', noticias: 'Notícias', ia: 'Leitura por IA', telegram: 'Telegram'}[k] || k, {ok: f.ok, msg: (f.msg || '') + (f.quando ? ' · ' + hm(f.quando) : '')}); }))) : null
    ]));
    if (!snap) { wrap.appendChild(passos()); return wrap; }

    // 2. alertas
    var al = M.detectar(snap, c.limites, C), hojeAl = al.filter(function (a) { return a.data === ses || (a.tipo !== 'fator' && a.tipo !== 'ativo'); });
    var ev = STORE.get('reunioes', 'auto-' + ses);
    wrap.appendChild(A.sec('Alertas da sessão (' + hojeAl.length + ')', {hint: 'Movimentos acima dos limites (ajustáveis em Configurar). “Forte” = duas vezes o limite.', right: ev ? h('button', {class: 'btn sm pri', onclick: function () { A.salaAbrir && A.salaAbrir(ev.id); }}, 'Abrir a reunião automática') : null},
      hojeAl.length ? h('ul', {class: 'issues'}, hojeAl.map(function (a) { return h('li', null, A.chip(a.nivel, a.nivel === 'forte' ? 'g-critica' : 'g-alta'), h('div', null, a.t ? h('span', null, A.tk(a.t), ' ') : null, a.t ? a.texto.replace(/^[▲▼] \S+ /, '') : a.texto)); }))
        : h('p', {class: 'empty'}, 'Nenhum movimento acima dos limites nesta sessão.')));

    var g = h('div', {class: 'grid2'}), L = h('div'), R = h('div'); g.append(L, R); wrap.appendChild(g);
    // 3. fatores
    var lim = c.limites.fatores;
    L.appendChild(A.sec('Fatores de mercado', {flush: true, hint: 'Variação contra o fechamento anterior (juros em pontos percentuais). Cinza: dado de outra data, fora do cenário da sessão.'}, A.table([
      {k: 'n', t: 'Fator', f: function (r) { return h('div', null, h('b', null, r.n), r.det ? h('div', {class: 'muted', style: 'font-size:.82rem'}, r.det) : null); }},
      {k: 'nv', t: 'Nível', r: 1, s: false, f: function (r) { return r.ok ? M.fmtNivel(r.f) : A.na('sem fonte'); }},
      {k: 'v', t: 'Variação', r: 1, f: function (r) { return r.ok ? h('b', {class: r.ses ? A.cls(r.v) : 'muted'}, M.fmtVar(r.v, r.f.uvar)) : '—'; }},
      {k: 'l', t: 'Limite', r: 1, s: false, f: function (r) { return r.l != null ? M.fmtVar(r.l, r.f && r.f.uvar || (/selic|pre|real|ust/.test(r.k) ? 'pp' : '%')).replace('+', '') : '—'; }},
      {k: 'q', t: 'Data · fonte', s: false, f: function (r) { return r.ok ? h('span', {class: 'muted', style: 'font-size:.84rem'}, A.dataBR(r.f.data) + (r.f.hora ? ' ' + r.f.hora : '') + ' · ' + r.f.fonte) : ''; }}
    ], M.FK.map(function (k) { var f = snap.fatores[k] || {}; return {k: k, n: M.NOME[k], det: f.detalhe, ok: !!f.ok, f: f, v: f.var, l: lim[k], ses: f.data === ses}; }), {sort: null})));

    // 4. carteira hoje
    var v = A.versao(), mand = C.MAND[S.cart], ch = M.choquesDoDia(snap, ses), P = A.prem();
    var real = M.carteiraHoje(v, snap, ses, C), est = C.choqueCarteira(v, ch, P.sens, M.idioDoDia(snap, ses, C, P.sens, ch));
    var top = real.itens.slice().sort(function (a, b) { return a.ctb - b.ctb; });
    R.appendChild(A.sec(mand.rotulo + ' na sessão', {hint: 'Realizado: só as posições com cotação do dia, pesos como estão (sem normalizar). Motor: movimentos do dia aplicados às premissas, com o residual de cada ativo cotado.'}, [
      h('div', {class: 'kpis'},
        h('div', {class: 'kpi'}, h('small', null, 'Contribuição das posições cotadas (p.p.)'), h('b', {class: A.cls(real.total)}, A.pp(real.total, 2)), h('span', {class: 'muted'}, A.pct(real.coberto, 0) + ' da carteira com cotação do dia')),
        h('div', {class: 'kpi'}, h('small', null, 'Motor (cenário da sessão)'), h('b', {class: A.cls(est.total)}, A.spct(est.total, 2)), h('span', {class: 'muted'}, A.pct(est.cobertura.coberto, 0) + ' coberto pelo motor'))),
      top.length ? A.table([{k: 't', t: 'Ativo', f: function (x) { return h('span', null, A.tk(x.t), x.proxy ? h('span', {class: 'muted', style: 'font-size:.8rem'}, ' via ' + x.proxy) : null); }}, {k: 'w', t: 'Peso', r: 1, f: function (x) { return A.pct(x.w, 1); }}, {k: 'r', t: 'Dia', r: 1, f: function (x) { return h('span', {class: A.cls(x.r)}, A.spct(x.r, 2)); }}, {k: 'ctb', t: 'Contribuição', r: 1, f: function (x) { return h('span', {class: A.cls(x.ctb)}, A.pp(x.ctb)); }}], top.slice(0, 5).concat(top.length > 8 ? top.slice(-3) : top.slice(5)), {sort: 'ctb', dir: 1}) : h('p', {class: 'empty'}, 'Nenhuma posição desta carteira tem cotação da sessão.'),
      real.fora.length ? A.more('Sem cotação do dia (' + real.fora.length + ')', h('p', {class: 'muted'}, real.fora.map(function (x) { return x.t + ' (' + A.pct(x.w, 1) + ', ' + x.motivo + ')'; }).join('; '))) : null
    ]));
    // 5. todas as carteiras
    var rows = C.CARTS.map(function (m) { var vv = STORE.aprovadaVigente(C, m.id), rr = M.carteiraHoje(vv, snap, ses, C), ee = C.choqueCarteira(vv, ch, P.sens, M.idioDoDia(snap, ses, C, P.sens, ch)); return {label: m.rotulo, v: ee.total, tip: [m.rotulo, 'Motor ' + A.spct(ee.total, 2), 'Contribuição das posições cotadas ' + A.pp(rr.total, 2) + ' (' + A.pct(rr.coberto, 0) + ' cotado)']}; });
    R.appendChild(A.sec('Todas as carteiras na sessão (motor)', {hint: 'Carteiras inválidas somam as posições como estão. Passe o mouse para ver o realizado.'}, A.hbars(rows, {signed: true, fmt: function (x) { return A.spct(x, 2); }})));

    // 6. indicadores e Focus
    var I = snap.indicadores || {}, fo = I.focus || {}, ano = String(new Date().getFullYear());
    L.appendChild(A.sec('Indicadores e Focus', {flush: true}, h('div', null,
      A.table([{k: 'n', t: 'Indicador'}, {k: 'v', t: 'Valor', r: 1}, {k: 'd', t: 'Referência · fonte', s: false, f: function (r) { return h('span', {class: 'muted', style: 'font-size:.84rem'}, r.d); }}],
        ['cdi', 'ipca_mes', 'ipca_12m', 'ptax'].filter(function (k) { return I[k]; }).map(function (k) { var x = I[k]; return {n: x.nome, v: (x.unid === 'R$' ? 'R$ ' + A.num(x.nivel, 4) : A.num(x.nivel, 2) + (x.unid === '%' ? '%' : ' ' + x.unid)) + (x.var != null ? ' (' + M.fmtVar(x.var, '%') + ')' : ''), d: (k === 'ipca_mes' || k === 'ipca_12m' ? 'mês ' + x.data.slice(5, 7) + '/' + x.data.slice(0, 4) : A.dataBR(x.data)) + ' · ' + x.fonte}; }), {sort: null}),
      Object.keys(fo).length ? A.table([{k: 'n', t: 'Focus · mediana'}, {k: 'a', t: ano, r: 1}, {k: 'b', t: String(Number(ano) + 1), r: 1}, {k: 'd', t: 'Semana', s: false}],
        Object.keys(fo).map(function (k) { var it = fo[k], a = it.anos[ano], b = it.anos[String(Number(ano) + 1)], u = k === 'Câmbio' ? '' : '%'; var f = function (x) { return x ? A.num(x.mediana, 2) + u + (x.var ? ' (' + (x.var > 0 ? '+' : '−') + A.num(Math.abs(x.var), 2) + ')' : '') : '—'; }; return {n: k, a: f(a), b: f(b), d: A.dataBR(it.data)}; }), {sort: null}) : h('p', {class: 'muted', style: 'padding:0 12px'}, 'Focus: vem pelo robô (Banco Central, toda segunda-feira).')
    )));

    // 7. notícias: as mais recentes; a lista completa, com o teste em cada carteira, fica em Research → Notícias e impacto
    var nots = snap.noticias || [];
    R.appendChild(A.sec('Notícias recentes (' + nots.length + ')', {right: h('button', {class: 'btn sm', onclick: function () { A.go('res', 'noticias'); }}, 'Notícias e impacto')},
      nots.length ? h('div', null, nots.slice(0, 6).map(function (n) { return cartaoNoticia(n, {curto: true}); })) : h('p', {class: 'empty'}, fonteRobo(c) ? 'O robô ainda não trouxe notícias (busca a cada hora, em dias úteis).' : 'As notícias chegam pelo robô.')));

    // 8. séries para o modelo de risco
    wrap.appendChild(A.sec('Séries para o modelo de risco', {hint: 'Uma vez por dia, depois das 19h, o robô guarda até 2 anos de preços ajustados de todos os ativos (UCITS pelo ETF americano par), Ibovespa, S&P 500, Brent, bitcoin, PTAX, CDI, Selic, Tesouro e Treasuries. Séries que você importou de outra fonte (Economática, por exemplo) são mantidas.'},
      h('div', {class: 'row'}, snap.historico && snap.historico.disponivel ? h('span', null, 'Histórico do robô: referência ', h('b', null, A.dataBR(snap.historico.data_ref))) : h('span', {class: 'muted'}, 'O robô ainda não gerou o histórico.'),
        h('button', {class: 'btn', disabled: !(snap.historico && snap.historico.disponivel && fonteRobo(c)) || bloqueado || null, onclick: carregarHistorico}, 'Carregar séries do robô'), E.hist ? h('span', {class: E.hist.ok ? 'up' : 'down'}, E.hist.msg) : null)));

    // 9. diário
    var log = lsGet(LS_LOG, []);
    wrap.appendChild(A.more('Diário de alertas (' + log.length + ')', log.length ? h('ul', {class: 'issues'}, log.slice(0, 80).map(function (x) { return h('li', null, h('span', {class: 'muted', style: 'font-size:.84rem'}, A.dataBR(x.quando) + ' ' + hm(x.quando)), h('div', null, A.chip(x.nivel, x.nivel === 'forte' ? 'g-critica' : 'g-alta'), ' ', x.texto)); })) : h('p', {class: 'empty'}, 'Sem alertas registrados neste navegador.')));
    return wrap;
  };

  /* ---------- notícias e impacto ---------- */
  // Choque de teste por fator, quando só se sabe QUAL fator a notícia mexe (não é previsão: é o tamanho do teste)
  var TESTE_PADRAO = {selic: 0.5, pre: 0.5, real: 0.25, ust2: 0.25, ust10: 0.25, spread: 0.5, usd: 5, ibov: -10, sp: -10, em: -10, brent: -20, btc: -30};
  var NF = {filtro: 'todas', periodo: 7, teste: 10, q: '', baixa: false};
  function relev(n) { return (n.classe && n.classe.relevancia) || (n.ia && n.ia.relevancia) || 'baixa'; }
  var NAT = {estrutural: 'pode mudar a tese', pontual: 'fato pontual', ruido: 'tende a ser ruído', indefinido: null};
  function tickerDe(t) { t = String(t || '').toUpperCase(); if (!t) return null; if (C.ATV[t]) return t; var al = C.D.aliases || {}; for (var k in al) if (al[k].para === t && C.ATV[k]) return k; return null; }
  function tickersDe(n) { var out = []; [n.tema].concat((n.ia && n.ia.tickers) || []).forEach(function (t) { var k = tickerDe(t); if (k && out.indexOf(k) < 0) out.push(k); }); return out; }
  function pesoNa(v, t) { var al = C.D.aliases || {}; return C.sum((v.pos || []).filter(function (x) { return x.w > 0 && (x.t === t || (al[x.t] && al[x.t].para === t) || (al[t] && al[t].para === x.t)); }), function (x) { return x.w; }); }
  function fatoresDe(n) {
    if (n.ia && n.ia.fatores && n.ia.fatores.length) { var ch = {}; n.ia.fatores.forEach(function (k) { if (TESTE_PADRAO[k] != null) ch[k] = TESTE_PADRAO[k]; }); if (Object.keys(ch).length) return {ch: ch, rot: 'Teste com choque padrão (fatores apontados pela IA; não é previsão)'}; }
    if (A.salaTestes) { try { var L = A.salaTestes.lerLocal(n.titulo || ''); if (Object.keys(L.base).length) return {ch: L.base, rot: 'Teste com a leitura automática do título (não é previsão)'}; } catch (e) {} }
    return null;
  }
  function testeNoticia(n) {
    var v = A.versao(), P = A.prem(), mand = C.MAND[S.cart], X = NF.teste / 100, out = [];
    tickersDe(n).forEach(function (t) {
      var w = pesoNa(v, t);
      if (w > 0) { out.push(h('div', null, A.tk(t), ' pesa ', h('b', null, A.pct(w, 1)), ' na ' + mand.rotulo + '. Se cair ' + NF.teste + '%: ', h('b', {class: 'down'}, A.pp(-w * X)), '; se subir ' + NF.teste + '%: ', h('b', {class: 'up'}, A.pp(w * X)))); return; }
      var em = C.CARTS.map(function (m) { return {m: m, w: pesoNa(STORE.aprovadaVigente(C, m.id), t)}; }).filter(function (x) { return x.w > 0; }).sort(function (a, b) { return b.w - a.w; });
      out.push(h('div', null, A.tk(t), ' não está na ' + mand.rotulo + (em.length ? '; está em ' + em.length + ' carteira' + (em.length > 1 ? 's' : '') + ', com maior peso na ' + em[0].m.rotulo + ' (' + A.pct(em[0].w, 1) + ').' : '; não está em nenhuma carteira-modelo.')));
    });
    var F = fatoresDe(n);
    if (F) {
      var partes = Object.keys(F.ch).map(function (k) { var one = {}; one[k] = F.ch[k]; var f = C.FATORES.filter(function (x) { return x.k === k; })[0] || {n: k, u: '%'}; return f.n + ' ' + M.fmtVar(F.ch[k], f.u === 'pp' ? 'pp' : '%') + ' → ' + A.spct(C.choqueCarteira(v, one, P.sens).total, 2); });
      var tot = C.choqueCarteira(v, F.ch, P.sens);
      out.push(h('div', null, h('span', {class: 'muted'}, F.rot + ': '), partes.join(' · ') + (partes.length > 1 ? ' · juntos ' + A.spct(tot.total, 2) : '') + ' na ' + mand.rotulo + (tot.parcial ? ' (análise parcial: ' + A.pct(tot.cobertura.descoberto, 0) + ' sem cobertura)' : '') + '.'));
    }
    return out;
  }
  // Para estudar: como o ativo (ou o Ibovespa, nas notícias de macro) andou do fechamento anterior à notícia até a última data da série
  function reacao(n, t) {
    var sd = t ? (A.serieDe ? A.serieDe(t) : null) : (A.SER.IBOV ? {id: 'IBOV'} : null);
    if (!sd || !A.SER[sd.id] || !n.quando) return null;
    var d = n.quando.slice(0, 10), pts = A.SER[sd.id].pts, p0 = null, p1 = pts[pts.length - 1];
    for (var i = pts.length - 1; i >= 0; i--) if (pts[i][0] < d) { p0 = pts[i]; break; }
    if (!p0 || !p1 || p1[0] < d) return null;
    return {id: sd.id, proxy: sd.proxy, r: p1[1] / p0[1] - 1, de: p0[0], ate: p1[0], fonte: A.SER[sd.id].fonte};
  }
  function analisar(n) {
    var ts = tickersDe(n), quando = n.quando ? A.dataBR(n.quando) : '';
    var texto = (ts.length ? ts.join(', ') + ': ' : '') + n.titulo + (n.fonte || quando ? ' (' + [n.fonte, quando].filter(Boolean).join(', ') + ')' : '');
    if (A.salaRodar) A.salaRodar(texto, (n.fonte || 'Google Notícias') + (n.link ? ' · ' + n.link : ''), ts.length ? 'Resultado de empresa' : 'Outro', S.cart);
  }
  function cartaoNoticia(n, opt) {
    opt = opt || {}; var ia = n.ia, k = n.classe || null, ts = tickersDe(n), teste = testeNoticia(n), re = reacao(n, ts[0]), rl = relev(n);
    return h('div', {class: 'noticia'},
      h('div', {class: 'row', style: 'gap:6px;flex-wrap:wrap'}, ts.length ? ts.map(function (t) { return A.tk(t); }) : A.chip(n.tema || 'Mercado'),
        A.chip('relevância ' + rl, rl === 'alta' ? 'g-critica' : rl === 'media' ? 'g-media' : ''),
        k && NAT[k.natureza] ? A.chip(NAT[k.natureza], k.natureza === 'estrutural' ? 'o-q' : '') : null,
        k && k.oficial ? A.chip('fonte oficial', 'o-obs') : (k && k.confiavel === false ? A.chip('veículo fora da lista', '') : null),
        h('span', {class: 'muted', style: 'font-size:.82rem'}, (n.fonte || 'fonte não informada') + (n.quando ? ' · ' + A.dataBR(n.quando) + ' ' + n.quando.slice(11, 16) : '') + (n.tambem_em && n.tambem_em.length ? ' · também em ' + n.tambem_em.slice(0, 3).join(', ') : ''))),
      h('div', null, A.link(n.link) ? h('a', {href: A.link(n.link), target: '_blank', rel: 'noopener'}, n.titulo) : h('b', null, n.titulo)),
      k && k.porque ? h('div', {style: 'font-size:.9rem'}, h('span', {class: 'k', style: 'margin-right:6px'}, 'Por que importa'), k.porque, k.tese && k.tese.length ? h('span', null, ' Risco da tese: ', h('b', null, k.tese.join('; ')), '.') : null, h('span', {class: 'muted'}, ' (regras automáticas)')) : null,
      ia && ia.resumo ? h('div', {class: 'muted', style: 'font-size:.9rem'}, 'Leitura gerada por IA: ' + ia.resumo + (ia.direcao ? ' (' + ia.direcao + ')' : '')) : null,
      teste.length ? h('div', {class: 'teste'}, teste) : (opt.curto ? null : h('div', {class: 'muted', style: 'font-size:.88rem'}, 'Sem empresa da carteira nem fator de mercado reconhecido no título. Use “Analisar na Sala” para testar com o seu texto.')),
      re ? h('div', {style: 'font-size:.9rem'}, h('span', {class: 'muted'}, 'Desde a notícia: '), h('b', {class: A.cls(re.r)}, A.spct(re.r, 1)), ' em ' + re.id + (re.proxy ? ' (ETF par)' : '') + ', do fechamento de ' + A.dataBR(re.de) + ' a ' + A.dataBR(re.ate) + (re.fonte ? ' · ' + re.fonte : '') + '.') : null,
      h('div', null, h('button', {class: 'btn sm', onclick: function () { analisar(n); }}, 'Analisar na Sala')));
  }
  A.noticiasTela = function () {
    var c = cfg(), wrap = h('div'), bloqueado = naoAcessa(), u = fonteRobo(c);
    if (!E.arquivo && !bloqueado && u && u.noticias && !E.buscandoArq && (!E.arqFalhou || Date.now() - E.arqFalhou > 10 * 60000)) { E.buscandoArq = true; getJSON(u.noticias + '?t=' + Date.now(), 30000).then(function (j) { if (j && Array.isArray(j.itens)) { E.arquivo = j; E.arquivoEm = Date.now(); E.arqFalhou = null; } else E.arqFalhou = Date.now(); }, function () { E.arqFalhou = Date.now(); }).then(function () { E.buscandoArq = false; A.render(); }); }
    var todos = (E.arquivo && E.arquivo.itens) || (E.snap && E.snap.noticias) || [];
    var held = {}; C.CARTS.forEach(function (m) { (STORE.aprovadaVigente(C, m.id).pos || []).forEach(function (x) { if (x.w > 0) held[tickerDe(x.t) || x.t] = 1; }); });
    var v = A.versao(), mand = C.MAND[S.cart], hoje = M.hojeBRT(), lim = M.hojeBRT(new Date(Date.now() - (NF.periodo - 1) * 864e5));
    var classe = function (n) { var ts = tickersDe(n); return {emp: ts.some(function (t) { return held[t]; }), nesta: ts.some(function (t) { return pesoNa(v, t) > 0; }), macro: !ts.length, alta: relev(n) === 'alta'}; };
    var todosPer = todos.filter(function (n) { return (n.quando || n.visto_em || '').slice(0, 10) >= lim; }), nBaixa = todosPer.filter(function (n) { return relev(n) === 'baixa'; }).length;
    var noPeriodo = todosPer.filter(function (n) { return NF.baixa || relev(n) !== 'baixa'; });
    var cont = {todas: noPeriodo.length, nesta: 0, empresas: 0, macro: 0, alta: 0};
    noPeriodo.forEach(function (n) { var k = classe(n); if (k.nesta) cont.nesta++; if (k.emp) cont.empresas++; if (k.macro) cont.macro++; if (k.alta) cont.alta++; });
    var q = NF.q.trim().toLowerCase();
    var lista = noPeriodo.filter(function (n) { var k = classe(n); return (NF.filtro === 'todas' || (NF.filtro === 'nesta' && k.nesta) || (NF.filtro === 'empresas' && k.emp) || (NF.filtro === 'macro' && k.macro) || (NF.filtro === 'alta' && k.alta)) && (!q || (n.titulo + ' ' + (n.tema || '') + ' ' + (n.fonte || '')).toLowerCase().indexOf(q) >= 0); });
    var btn = function (k, t) { return h('button', {'aria-pressed': NF.filtro === k ? 'true' : 'false', onclick: function () { NF.filtro = k; A.render(); }}, t + ' (' + cont[k] + ')'); };
    var per = h('select', {class: 'inp', onchange: function () { NF.periodo = Number(per.value); A.render(); }}, [[1, 'Hoje'], [7, '7 dias'], [30, '30 dias'], [60, '60 dias']].map(function (x) { return h('option', {value: x[0], selected: NF.periodo === x[0] || null}, x[1]); }));
    var tst = h('select', {class: 'inp', onchange: function () { NF.teste = Number(tst.value); A.render(); }}, [5, 10, 20, 30].map(function (x) { return h('option', {value: x, selected: NF.teste === x || null}, '±' + x + '%'); }));
    var busca = h('input', {class: 'inp', type: 'search', placeholder: 'Buscar (ex.: Klabin, Copom)', value: NF.q, onchange: function () { NF.q = busca.value; A.render(); }});
    wrap.appendChild(A.sec('Acontecimentos e impacto', {mtd: 'mercado', hint: 'O robô busca a cada hora (Google Notícias por empresa e tema, releases do IBGE, documentos da CVM), separa a empresa certa (ex.: PRIO não é “prioridade”), junta repetidas e classifica por regras: fonte oficial, categoria do fato, risco da tese tocado, ruído. Por padrão, só média e alta relevância. Cada item já vem testado na ' + mand.rotulo + ': são testes de sensibilidade, não previsões.'}, [
      bloqueado ? h('div', {class: 'alert warn'}, 'Neste link do claude.ai a página não acessa a internet, então as notícias não chegam aqui. Use o site do painel no GitHub Pages ou o arquivo no computador.') : null,
      !bloqueado && !u ? h('div', {class: 'alert'}, 'As notícias chegam pelo robô. Siga o guia de ativação (ou, no arquivo do computador, informe o repositório em Mesa → Mercado ao vivo → Configurar).') : null,
      h('div', {class: 'sub', role: 'toolbar', style: 'margin:0 0 8px'}, btn('todas', 'Todas'), btn('nesta', 'Empresas desta carteira'), btn('empresas', 'Empresas das carteiras'), btn('macro', 'Macro e mercado'), btn('alta', 'Alta relevância')),
      h('label', {class: 'row', style: 'gap:6px;font-size:.88rem;margin:0 0 8px'}, h('input', {type: 'checkbox', checked: NF.baixa || null, onchange: function (e) { NF.baixa = e.target.checked; A.render(); }}), 'Mostrar também as de baixa relevância (' + nBaixa + ' no período: opinião, cobertura do pregão, menção sem fato novo)'),
      h('div', {class: 'row', style: 'gap:10px;flex-wrap:wrap'}, h('label', {class: 'field'}, 'Período', per), h('label', {class: 'field'}, 'Tamanho do teste nas empresas', tst), h('label', {class: 'field', style: 'flex:1;min-width:220px'}, 'Buscar', busca)),
      E.arquivo ? h('p', {class: 'muted', style: 'font-size:.85rem;margin:6px 0 0'}, 'Arquivo do robô atualizado em ' + A.dataBR(E.arquivo.gerado_em) + ' ' + hm(E.arquivo.gerado_em) + ' · ' + E.arquivo.itens.length + ' manchetes guardadas.') : (E.buscandoArq ? h('p', {class: 'muted'}, 'Carregando o arquivo de notícias…') : null)
    ]));
    if (!lista.length) { wrap.appendChild(h('p', {class: 'empty'}, todos.length ? 'Nenhuma notícia com esse filtro.' : 'Ainda sem notícias.')); return wrap; }
    var dias = {}; lista.slice(0, 200).forEach(function (n) { var d = (n.quando || n.visto_em || '').slice(0, 10); (dias[d] = dias[d] || []).push(n); });
    Object.keys(dias).sort().reverse().forEach(function (d) {
      wrap.appendChild(A.sec((d === hoje ? 'Hoje · ' : '') + A.dataBR(d) + ' (' + dias[d].length + ')', null, h('div', null, dias[d].map(function (n) { return cartaoNoticia(n); }))));
    });
    if (lista.length > 200) wrap.appendChild(h('p', {class: 'muted'}, 'Mostrando as 200 mais recentes de ' + lista.length + '. Use a busca ou um período menor.'));
    return wrap;
  };

  function passos() {
    return A.sec('Como ligar', null, h('ol', {style: 'line-height:1.7;font-size:1.02rem'},
      h('li', null, 'Abra o arquivo ', h('b', null, 'Painel_Carteira_Oregon.html'), ' no Chrome do computador (no link do claude.ai a página não acessa a internet).'),
      h('li', null, 'Em ', h('b', null, 'Configurar'), ', deixe “Fontes públicas diretas” ligado: Selic, CDI, IPCA, PTAX e dólar já começam a chegar.'),
      h('li', null, 'Crie o robô no GitHub e o robô do Telegram seguindo o guia de ativação; depois cole aqui o endereço do repositório (ex.: ', h('code', null, 'seu-usuario/robo-oregon'), ').'),
      h('li', null, 'Opcional: chave da brapi (reserva das cotações da B3) e chave da Anthropic (leitura das notícias por IA), sempre nos Secrets do GitHub, nunca no painel.')));
  }

  async function carregarHistorico() {
    var u = fonteRobo(); if (!u) return;
    E.hist = {ok: true, msg: 'Baixando…'}; A.render();
    try {
      var j = await getJSON(u.historico + '?t=' + Date.now(), 60000), S0 = j && j.series; if (!S0) throw new Error('arquivo sem séries');
      var atuais = await STORE.series(), novos = 0, mantidas = [];
      for (var id in S0) {
        var x = S0[id], old = atuais[id];
        if (old && old.origem !== 'robo') { mantidas.push(id); continue; }
        if (x.qualidade === 'suspeita') { if (old) await STORE.delSerie(id); continue; }
        var add = {}; add[id] = x.pts;
        if (old) await STORE.delSerie(id);
        await STORE.saveSeries(add, {tipo: x.tipo, moeda: x.moeda, fonte: x.fonte, arquivo: 'robô · ' + A.dataBR(j.data_ref), origem: 'robo'});
        novos++;
      }
      await A.carregarTabelas();
      E.hist = {ok: true, msg: novos + ' séries carregadas' + (mantidas.length ? '; mantidas as importadas por você: ' + mantidas.join(', ') : '') + '.'};
    } catch (e) { E.hist = {ok: false, msg: 'Falhou: ' + motivo(e)}; }
    A.render();
  }

  function configurar() {
    var c = cfg(), body = h('div');
    var robo = h('input', {class: 'inp w', value: c.robo || '', placeholder: 'seu-usuario/robo-oregon'});
    var res = h('div');
    var dir = h('input', {type: 'checkbox', checked: c.diretas || null}), aut = h('input', {type: 'checkbox', checked: c.autoSala || null}), apl = h('input', {type: 'checkbox', checked: c.aplicarCenario || null}), som = h('input', {type: 'checkbox', checked: c.som || null}), ntf = h('input', {type: 'checkbox', checked: c.notificar || null});
    var itv = h('input', {class: 'inp n', type: 'number', min: 1, max: 60, value: c.intervalo});
    var limF = {}, limA = {};
    body.append(
      h('h3', null, 'Robô no GitHub'),
      siteBase() ? h('div', {class: 'alert ok'}, 'Este é o site publicado pelo robô: os dados vêm do mesmo endereço, sem configurar nada. O campo abaixo só é usado no arquivo aberto no computador.') : null,
      h('label', {class: 'field'}, 'Repositório do robô (usuário/repositório)', robo),
      h('div', {class: 'row', style: 'margin:6px 0'}, h('button', {class: 'btn', onclick: async function () { var u = M.urlRobo(robo.value); if (!u) { res.replaceChildren(h('div', {class: 'alert bad'}, 'Endereço não reconhecido. Use o formato usuario/repositorio.')); return; } res.replaceChildren(h('p', {class: 'muted'}, 'Testando…')); try { var j = await getJSON(u.mercado + '?t=' + Date.now()); res.replaceChildren(h('div', {class: 'alert ok'}, 'Conectado: última rodada do robô em ' + A.dataBR(j.gerado_em) + ' ' + hm(j.gerado_em) + '.')); } catch (e) { res.replaceChildren(h('div', {class: 'alert bad'}, 'Não conectou: ' + motivo(e) + '. Confira se o repositório é público e se o robô já rodou pelo menos uma vez (aba Actions).')); } }}, 'Testar conexão')),
      res,
      h('h3', null, 'Funcionamento'),
      h('label', null, dir, ' Fontes públicas diretas (Banco Central e dólar ao vivo, sem chave)'), h('br'),
      h('label', {class: 'field', style: 'max-width:260px'}, 'Atualizar a cada (minutos)', itv),
      h('label', null, aut, ' Montar a reunião automática na Sala quando houver alerta'), h('br'),
      h('label', null, apl, ' Usar o cenário do dia como cenário ativo do painel'), h('br'),
      h('label', null, som, ' Tocar um som a cada alerta'), h('br'),
      h('label', null, ntf, ' Aviso do Windows (notificação do Chrome) '), h('button', {class: 'btn sm', onclick: function () { if (!window.Notification) { A.toast('Este navegador não oferece notificações aqui.'); return; } Notification.requestPermission().then(function (p) { A.toast(p === 'granted' ? 'Notificações liberadas.' : 'O navegador não liberou as notificações para este arquivo.'); }); }}, 'Pedir permissão'),
      h('h3', null, 'Limites de alerta'),
      h('div', {class: 'form'}, M.FK.map(function (k) { var e = h('input', {class: 'inp n', type: 'number', step: '0.05', value: c.limites.fatores[k]}); limF[k] = e; return h('label', {class: 'field'}, M.NOME[k] + (/selic|pre|real|ust/.test(k) ? ' (p.p.)' : ' (%)'), e); })),
      h('div', {class: 'form', style: 'margin-top:6px'}, [['acao', 'Ações (%)'], ['fii', 'FIIs (%)'], ['etf_rf', 'ETFs de renda fixa (%)'], ['cripto', 'Bitcoin (IBIT) (%)']].map(function (x) { var e = h('input', {class: 'inp n', type: 'number', step: '0.5', value: c.limites.ativos[x[0]]}); limA[x[0]] = e; return h('label', {class: 'field'}, x[1], e); })),
      h('p', {class: 'hint'}, 'Os limites do Telegram ficam no arquivo robo/config.json do repositório (mesmos valores por padrão).'),
      h('div', {class: 'row', style: 'margin-top:12px'}, h('button', {class: 'btn pri', onclick: async function () {
        if (robo.value.trim() && !M.urlRobo(robo.value)) { A.toast('Endereço do robô não reconhecido.'); return; }
        var n = {robo: robo.value.trim(), diretas: dir.checked, intervalo: Number(itv.value) || 5, autoSala: aut.checked, aplicarCenario: apl.checked, som: som.checked, notificar: ntf.checked, limites: {fatores: {}, ativos: {}}};
        Object.keys(limF).forEach(function (k) { var v = Number(limF[k].value); n.limites.fatores[k] = isFinite(v) && v > 0 ? v : M.LIM_PADRAO.fatores[k]; });
        Object.keys(limA).forEach(function (k) { var v = Number(limA[k].value); n.limites.ativos[k] = isFinite(v) && v > 0 ? v : M.LIM_PADRAO.ativos[k]; });
        n.limites.ativos.outro = M.LIM_PADRAO.ativos.outro;
        await salvarCfg(n); await STORE.audit('configuração do mercado ao vivo', (n.robo || 'sem robô') + ' · ' + n.intervalo + ' min');
        d.remove(); if (!naoAcessa()) atualizar(true); else A.render();
      }}, 'Salvar'))
    );
    var d = A.drawer('Configurar o mercado ao vivo', body);
  }
  A.mercadoEstado = E;
})(APP, CORE, MERCADO);
