/* v3.9.1 · aprovado pelo Lucas em 09/11/2026, depois de uma noite em que o GitHub rodou só 2 de 6 coletas agendadas:
   - agenda do robô com as rodadas extras (02:07, 03:07, 05:07 a 06:37 e aos 22 e 52 minutos das 09:22 às 18:52);
   - aviso de atraso no topo do Hoje, no detalhe da coleta e no "Atualizar": quando uma coleta prevista passa da hora sem
     chegar, o painel diz qual foi e destaca o "Coletar agora".
   A situação da rodada vem da API pública do GitHub (repositório público, sem chave), no máximo uma consulta a cada
   3 minutos e só quando há atraso. Sem resposta da API, o aviso diz apenas que a coleta ainda não chegou. */
(function (A, C, I) {
  'use strict';
  var h = A.h;
  var REPO_API = 'https://api.github.com/repos/lucaslimaequity-a11y/robo-oregon/actions/runs?per_page=6';
  var MARGEM = 25 * 60e3;  // a rodada leva uns 10 minutos e o GitHub atrasa um pouco quase sempre
  function pad(n) { return ('0' + n).slice(-2); }
  function E() { return A.intel || {}; }

  /* ---------- agenda (horário de Brasília), igual ao .github/workflows/robo.yml ---------- */
  var SL = [75, 127, 187, 255, 307, 337, 367, 397], m;
  for (m = 427; m <= 1357; m += 30) SL.push(m);   // 07:07 a 22:37, aos 7 e aos 37
  for (m = 562; m <= 1132; m += 30) SL.push(m);   // 09:22 a 18:52, aos 22 e aos 52
  SL = SL.filter(function (x, i) { return SL.indexOf(x) === i; }).sort(function (a, b) { return a - b; });
  A.SLOTS_COLETA = SL;
  function maisDias(d, n) { var x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function ms(dia, min) { return Date.parse(dia + 'T' + pad(Math.floor(min / 60)) + ':' + pad(min % 60) + ':00-03:00'); }
  function isoBRT(t) { return new Date(t - 3 * 3600e3).toISOString().slice(0, 19) + '-03:00'; }  // a API do GitHub dá UTC; o painel mostra Brasília
  function hm(t) { return I.horaAbs(isoBRT(t)); }
  // horários previstos (em ms) no intervalo (de, ate]
  I.coletasPrevistas = function (de, ate) {
    var out = [], d0 = I.hojeBRT();
    [maisDias(d0, -2), maisDias(d0, -1), d0].forEach(function (d) { SL.forEach(function (x) { var t = ms(d, x); if (t > de && t <= ate) out.push(t); }); });
    return out.sort(function (a, b) { return a - b; });
  };
  A.proximaColeta = function () {
    var agora = Date.now(), d0 = I.hojeBRT();
    for (var k = 0; k < 2; k++) { var d = maisDias(d0, k); for (var i = 0; i < SL.length; i++) if (ms(d, SL[i]) > agora) return pad(Math.floor(SL[i] / 60)) + ':' + pad(SL[i] % 60); }
    return '01:15';
  };

  /* ---------- situação real no GitHub (API pública), só quando há atraso ---------- */
  var GH = {t: 0, runs: null, erro: null, buscando: false};
  function checarGitHub() {
    if (GH.buscando || Date.now() - GH.t < 3 * 60e3 || typeof fetch !== 'function') return;
    GH.buscando = true;
    fetch(REPO_API, {headers: {Accept: 'application/vnd.github+json'}, cache: 'no-store'}).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (js) { GH.runs = (js && js.workflow_runs) || []; GH.erro = null; }).catch(function (e) { GH.runs = null; GH.erro = e.message || String(e); })
      .then(function () { GH.t = Date.now(); GH.buscando = false; if (A.rerender && A.S && A.S.area === 'hoje') A.rerender(); });
  }
  A._ghColeta = GH;  // para os testes

  // null quando não há atraso; senão {perdidas, desde, gh: 'rodando' | 'terminou' | 'nada' | null, inicio}
  A.atrasoColeta = function () {
    var v = E().versao; if (!v || !v.gerado_em) return null;
    var ger = Date.parse(v.gerado_em), agora = Date.now();
    if (!ger) return null;
    var perdidas = I.coletasPrevistas(ger, agora - MARGEM);
    if (!perdidas.length) return null;
    var r = {perdidas: perdidas, desde: ger, gh: null, inicio: null};
    checarGitHub();
    if (GH.runs) {
      var depois = GH.runs.filter(function (x) { return Date.parse(x.created_at) > ger; });
      var vivo = depois.filter(function (x) { return x.status === 'in_progress' || x.status === 'queued' || x.status === 'waiting' || x.status === 'pending'; })[0];
      var feito = depois.filter(function (x) { return x.status === 'completed' && x.conclusion === 'success'; })[0];
      if (vivo) { r.gh = 'rodando'; r.inicio = Date.parse(vivo.run_started_at || vivo.created_at); }
      else if (feito) { r.gh = 'terminou'; r.inicio = Date.parse(feito.updated_at || feito.created_at); }
      else r.gh = 'nada';
    }
    return r;
  };
  I.textoAtraso = function (a, semDesde) {
    if (!a) return '';
    var p = a.perdidas, desde = semDesde ? '' : 'nada novo desde a coleta das ' + hm(a.desde) + '.';
    var lista = p.length === 1 ? 'a coleta prevista das ' + hm(p[0]) : p.length === 2 ? 'as coletas previstas das ' + hm(p[0]) + ' e das ' + hm(p[1]) : p.length + ' coletas previstas desde as ' + hm(a.desde);
    if (a.gh === 'rodando') return 'Atraso do GitHub: ' + (desde ? desde + ' ' : '') + 'Uma coleta está rodando agora (começou às ' + hm(a.inicio) + '); os dados chegam em uns 10 minutos.';
    if (a.gh === 'terminou') return 'A coleta terminou no GitHub às ' + hm(a.inicio) + ' e o site publica em poucos minutos: toque em Atualizar.';
    var fim = ' Para não esperar a próxima, use Coletar agora.';
    if (p.length > 2) return 'Atraso do GitHub: desde a coleta das ' + hm(a.desde) + ', ' + (a.gh === 'nada' ? 'ele não disparou as ' + p.length + ' coletas previstas.' : 'as ' + p.length + ' coletas previstas ainda não chegaram.') + fim;
    if (a.gh === 'nada') return 'Atraso do GitHub: ele não disparou ' + lista + (desde ? '; ' + desde : '.') + fim;
    return 'Atraso do GitHub: ' + lista + ' ainda não ' + (p.length > 1 ? 'chegaram' : 'chegou') + (desde ? '; ' + desde : '.') + fim;
  };
  A.avisoAtraso = function (ctx, semDesde) {
    var a = A.atrasoColeta(); if (!a) return null;
    var txt = I.textoAtraso(a, semDesde);
    if (ctx === 'pop') return h('p', {class: 'pop-l warn'}, txt);
    return h('div', {class: 'aviso-gh', role: 'status'}, h('span', null, txt),
      a.gh === 'rodando' || a.gh === 'terminou' ? null : h('a', {class: 'btn sm pri', href: A.GH_ACTIONS, target: '_blank', rel: 'noopener', title: 'Abre a página do robô no GitHub: toque em "Run workflow". Usa o seu login do GitHub; nenhuma chave fica no site.'}, 'Coletar agora ↗'));
  };

  /* ---------- topo do Hoje: aviso logo abaixo do título e "Coletar agora" destacado ---------- */
  var hoje0 = A.areas.hoje;
  A.areas.hoje = function () {
    var w = hoje0.apply(this, arguments), at = w && w.querySelector ? w.querySelector('.aviso-at') : null;
    // com o "Conferido às…: nada novo desde…" do Atualizar já na tela, o aviso não repete essa frase
    var av = A.avisoAtraso(null, !!(at && /nada novo/.test(at.textContent)));
    if (av && w && w.querySelector) {
      var cab = w.querySelector('.mesa-h');
      if (cab) cab.insertAdjacentElement('afterend', av); else w.insertBefore(av, w.firstChild);
      var bt = w.querySelector('.mesa-ctl a[href="' + A.GH_ACTIONS + '"]'); if (bt) bt.classList.add('pri');
    }
    return w;
  };

  /* ---------- "Atualizar": quando nada chegou e há atraso, o aviso rápido diz qual coleta faltou ---------- */
  var at0 = A.intelAtualizar;
  A.intelAtualizar = async function () {
    var msg = await at0.apply(this, arguments), a = A.atrasoColeta();
    if (a && /nada novo/.test(msg || '') && A.toast) A.toast(I.textoAtraso(a), 9000);
    return msg;
  };
})(APP, CORE, INTEL);
