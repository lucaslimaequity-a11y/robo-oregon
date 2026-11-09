/* v3.11 · aprovado pelo Lucas em 09/11/2026, dia em que o GitHub disparou só 2 das 28 rodadas agendadas:
   - corrente de rodadas (robo/corrente.py): cada rodada dispara a seguinte. A "próxima coleta prevista" passa a usar a
     hora que o robô gravou no versao.json (corrente.proxima) quando ela vem antes do próximo horário do robo.yml.
   - aviso de atraso: rodada que passou do tempo sem publicar ou que falhou não aparece mais como "rodando agora";
   - o Atualizar traz o painel novo: o painel publicado tem uma identidade (PAINEL_BUILD, gravada pelo painel/build.py
     também em painel.json). Quando o GitHub publica um painel diferente do que está aberto, o Atualizar avisa e recarrega
     a página; sem tocar em nada, uma faixa no rodapé oferece "Recarregar". Só no site (no claude.ai e no arquivo local,
     nada muda). Sem laço: a mesma versão só é tentada de novo depois de 5 minutos (depois da 3ª vez, de 30). */
(function (A, C, I) {
  'use strict';
  var h = A.h;
  function E() { return A.intel || {}; }
  function hm(t) { return new Date(t - 3 * 3600e3).toISOString().slice(11, 16); }  // Brasília
  function hmAbs(t) { var iso = new Date(t - 3 * 3600e3).toISOString().slice(0, 19) + '-03:00'; return I.horaAbs ? I.horaAbs(iso) : iso.slice(11, 16); }  // "09:53" ou "ontem 22:37"
  var BUILD = typeof PAINEL_BUILD !== 'undefined' ? PAINEL_BUILD : null;
  A.PAINEL_BUILD = BUILD;

  /* ---------- próxima coleta pela corrente ---------- */
  // ms da próxima rodada da corrente; null se a corrente está desligada ou parou (prevista há mais de 20 min)
  I.proximaCorrente = function (v, agora) {
    var c = v && v.corrente; if (!c || !c.ativo || !c.proxima) return null;
    var t = Date.parse(c.proxima); if (!t || t < agora - 20 * 60e3) return null;
    return t;
  };
  var pc0 = A.proximaColeta;
  A.proximaColeta = function () {
    var agora = Date.now(), s = pc0.apply(this, arguments), t = I.proximaCorrente(E().versao, agora);
    if (t == null) return s;
    var slot = I.coletasPrevistas ? I.coletasPrevistas(agora, agora + 2 * 864e5)[0] : null;
    if (slot != null && slot < t) return s;
    return hm(t) + (t <= agora ? ' (já deve estar rodando)' : '');
  };

  /* ---------- aviso de atraso com a corrente ----------
     Com a corrente, uma rodada cuja coleta falhou continua "em andamento" no GitHub por até 1 hora (a etapa "seguinte"
     espera para disparar a próxima). Sem isto, o aviso diria "está rodando, os dados chegam em uns 10 minutos" e
     esconderia o Coletar agora justamente quando ele é útil. */
  var ac0 = A.atrasoColeta;
  if (ac0) A.atrasoColeta = function () {
    var r = ac0.apply(this, arguments); if (!r) return r;
    var runs = (A._ghColeta && A._ghColeta.runs) || null, agora = Date.now();
    if (!runs) return r;
    if (r.gh === 'rodando' && r.inicio && agora - r.inicio > 25 * 60e3) r.gh = 'demorando';
    if (r.gh === 'nada' || r.gh === 'demorando') {
      var falha = runs.filter(function (x) { return Date.parse(x.created_at) > r.desde && x.status === 'completed' && (x.conclusion === 'failure' || x.conclusion === 'timed_out'); })[0];
      if (falha && (r.gh === 'nada' || Date.parse(falha.created_at) > r.inicio)) { r.gh = 'falhou'; r.inicio = Date.parse(falha.run_started_at || falha.created_at); }
    }
    return r;
  };
  var ta0 = I.textoAtraso;
  if (ta0) I.textoAtraso = function (a, semDesde) {
    if (!a || (a.gh !== 'demorando' && a.gh !== 'falhou')) return ta0.apply(this, arguments);
    var desde = semDesde ? '' : ' Nada novo desde a coleta das ' + hmAbs(a.desde) + '.', fim = ' Para não esperar, use Coletar agora.';
    if (a.gh === 'falhou') return 'Atraso do GitHub: a rodada das ' + hmAbs(a.inicio) + ' falhou.' + desde + ' A corrente tenta de novo em até 1 hora.' + fim;
    return 'Atraso do GitHub: a rodada que começou às ' + hmAbs(a.inicio) + ' passou do tempo normal (uns 10 minutos) sem publicar; a coleta pode ter falhado.' + desde + fim;
  };

  /* ---------- painel novo ---------- */
  var PN = {t: 0, remoto: null, faixa: null};
  A._painelNovo = PN;  // para os testes
  function noSite() {
    try { return /^https?:$/.test(location.protocol) && !(window.claude && window.claude.use) && !(typeof STORE !== 'undefined' && STORE.mode === 'db'); } catch (e) { return false; }
  }
  // o que fazer: null (nada), 'recarregar' ou 'aguardar' (o GitHub ainda publica; já tentamos esta versão há pouco)
  I.painelNovo = function (local, remoto, tent, agora) {
    if (!local || !remoto || remoto === local) return null;
    if (tent && tent.b === remoto && agora - tent.t < (tent.n >= 3 ? 30 : 5) * 60e3) return 'aguardar';
    return 'recarregar';
  };
  function tentativa() { try { return JSON.parse(sessionStorage.getItem('oi-painel-recarga') || 'null'); } catch (e) { return null; } }
  // o endereço sem o ?v= da recarga, mantendo os outros parâmetros (ex.: ?simulado)
  function semV(search) { return (search || '').replace(/^\?/, '').split('&').filter(function (p) { return p && !/^v=/.test(p); }); }
  A._recarregar = function (remoto) {
    var t0 = tentativa(), n = t0 && t0.b === remoto ? (t0.n || 0) + 1 : 1;
    try { sessionStorage.setItem('oi-painel-recarga', JSON.stringify({b: remoto, t: Date.now(), n: n})); } catch (e) {}
    location.replace(location.pathname + '?' + semV(location.search).concat(['v=' + encodeURIComponent(remoto) + (n > 1 ? '.' + n : '')]).join('&') + location.hash);
  };
  I.semV = semV;  // para os testes
  A.lerPainelPublicado = async function () {
    if (!BUILD || !noSite() || typeof fetch !== 'function') return null;
    try {
      var r = await fetch(new URL('painel.json', location.href).href.split('?')[0] + '?t=' + Date.now(), {cache: 'no-store'});
      if (!r.ok) return null;
      var js = await r.json(); PN.remoto = (js && js.build) || null; PN.t = Date.now(); return PN.remoto;
    } catch (e) { return null; }
  };
  function faixa(remoto) {
    if (PN.faixa || !document.body) return;
    var f = h('div', {class: 'painel-novo no-print', role: 'status'},
      h('span', null, 'O painel foi atualizado no GitHub. Recarregue para usar a versão nova.'),
      h('button', {class: 'btn sm pri', onclick: function () { A._recarregar(remoto); }}, 'Recarregar'),
      h('button', {class: 'btn sm', 'aria-label': 'Fechar este aviso', onclick: function () { f.remove(); PN.faixa = 'fechada'; }}, '×'));
    PN.faixa = f; document.body.appendChild(f);
  }
  async function conferirSozinho() {
    if (document.hidden || PN.faixa) return;
    var remoto = await A.lerPainelPublicado();
    if (I.painelNovo(BUILD, remoto, tentativa(), Date.now()) === 'recarregar') faixa(remoto);
  }
  A._conferirPainel = conferirSozinho;  // para os testes
  if (BUILD && noSite()) {
    // abriu já na versão nova: limpa a marca da recarga e o ?v= do endereço
    try { var t0 = tentativa(); if (t0 && t0.b === BUILD) sessionStorage.removeItem('oi-painel-recarga'); if (/[?&]v=/.test(location.search) && history.replaceState) { var q = semV(location.search); history.replaceState(null, '', location.pathname + (q.length ? '?' + q.join('&') : '') + location.hash); } } catch (e) {}
    setInterval(conferirSozinho, 10 * 60e3);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - PN.t > 10 * 60e3) conferirSozinho(); });
  }

  /* ---------- Atualizar: dados novos e, se houver, painel novo ---------- */
  var at0 = A.intelAtualizar;
  A.intelAtualizar = async function () {
    var msg = await at0.apply(this, arguments);
    var remoto = await A.lerPainelPublicado(), acao = I.painelNovo(BUILD, remoto, tentativa(), Date.now());
    if (acao === 'recarregar') {
      if (A.toast) A.toast('O GitHub publicou uma versão nova do painel: recarregando a página…', 5000);
      setTimeout(function () { A._recarregar(remoto); }, 1200);
    } else if (acao === 'aguardar' && A.toast) A.toast('Há uma versão nova do painel, mas o GitHub ainda está terminando de publicar. Toque em Atualizar de novo em alguns minutos.', 9000);
    return msg;
  };
})(APP, CORE, INTEL);
