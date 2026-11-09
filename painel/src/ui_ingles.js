/* v3.9 · INGLÊS DO MERCADO (Biblioteca › Inglês), pedido do Lucas em 08/11/2026: estudar inglês com o que o robô coleta.
   Tudo no próprio navegador, sem chave e sem API paga:
   - Ouvir: voz do navegador (speechSynthesis), 0,75× ou 1×.
   - Repetir e conferir: reconhecimento de fala do navegador (Chrome no computador e no Android, Safari no iPhone);
     no Chrome o áudio é processado pelo serviço de voz do Google. O Oregon não grava nada.
   - Traduzir: tradução do próprio Chrome, feita no aparelho, quando existe (Translator); se não, abre o Google Tradutor.
   - Glossário do mercado (robo/glossario_en.json, escrito à mão; a mesma fonte da frase do dia no Telegram).
   - Meu vocabulário: guardado como as outras anotações (STORE 'vocab'), revisão em cartões e exportação para o Anki.
   Nada aqui altera carteira, coleta ou classificação. */
(function (A, C, I) {
  'use strict';
  var h = A.h, S = A.S;
  var GL = typeof GLOSSARIO_EN !== 'undefined' ? GLOSSARIO_EN : {grupos: {}, termos: []};
  var TERMOS = GL.termos || [], GRUPOS = GL.grupos || {};
  var PLAY = '▶︎';

  /* ---------- glossário: marcação dos termos num texto em inglês ---------- */
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  var PADS = [];
  TERMOS.forEach(function (t, i) {
    (t.f || []).forEach(function (fm) {
      // forma toda em minúsculas: ignora maiúsculas; forma com maiúscula (Fed, AI, SEC): só a grafia exata
      PADS.push({i: i, rx: new RegExp('(^|[^A-Za-z0-9])(' + esc(fm) + ')(?![A-Za-z0-9])', fm === fm.toLowerCase() ? 'gi' : 'g')});
    });
  });
  I.termosEN = function (txt) {
    txt = String(txt || '');
    var ach = [];
    PADS.forEach(function (p) {
      p.rx.lastIndex = 0; var m;
      while ((m = p.rx.exec(txt))) { var ini = m.index + m[1].length; ach.push({ini: ini, fim: ini + m[2].length, i: p.i}); p.rx.lastIndex = ini + m[2].length; }
    });
    ach.sort(function (a, b) { return (b.fim - b.ini) - (a.fim - a.ini) || a.ini - b.ini; });
    var ok = [];
    ach.forEach(function (a) { if (!ok.some(function (b) { return a.ini < b.fim && b.ini < a.fim; })) ok.push(a); });
    return ok.sort(function (a, b) { return a.ini - b.ini; }).map(function (a) { return {ini: a.ini, fim: a.fim, termo: TERMOS[a.i]}; });
  };
  I.termosUnicos = function (txt) { var vis = {}, out = []; I.termosEN(txt).forEach(function (a) { if (!vis[a.termo.t]) { vis[a.termo.t] = 1; out.push(a.termo); } }); return out; };
  // Texto com os termos do glossário em botões; o toque mostra a explicação em `def`
  A.textoMarcado = function (txt, def) {
    txt = String(txt || ''); var out = [], pos = 0;
    I.termosEN(txt).forEach(function (a) {
      if (a.ini > pos) out.push(txt.slice(pos, a.ini));
      out.push(h('button', {class: 'gl-t', type: 'button', title: a.termo.pt, onclick: function (ev) { ev.stopPropagation(); if (def) mostrarTermo(a.termo, def); }}, txt.slice(a.ini, a.fim)));
      pos = a.fim;
    });
    if (pos < txt.length) out.push(txt.slice(pos));
    return out;
  };
  function mostrarTermo(t, def) {
    def.replaceChildren(h('div', {class: 'gl-def'}, h('p', null, h('b', null, t.t), ' · ', t.pt, ' ', A.btnOuvir(t.t, {rot: PLAY, cls: 'ic', titulo: 'Ouvir a pronúncia'})),
      h('p', {class: 'muted'}, t.exp), h('p', {class: 'gl-ex'}, h('i', null, t.ex), ' ', A.btnOuvir(t.ex, {rot: PLAY, cls: 'ic', titulo: 'Ouvir o exemplo'}), h('br'), h('small', {class: 'muted'}, t.ex_pt)),
      h('p', null, A.btnSalvarVocab({en: t.t, pt: t.pt, exp: t.exp, ex: t.ex, tipo: 'termo'}))));
  }

  /* ---------- ouvir: voz do navegador ---------- */
  function vel() { var v = +A.lsGet('ing-vel', 0.75); return v > 0 && v <= 1.5 ? v : 0.75; }
  var vozes = [];
  function carregarVozes() { try { vozes = window.speechSynthesis.getVoices() || []; } catch (e) { vozes = []; } }
  A.temVoz = function () { return typeof window !== 'undefined' && !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance !== 'undefined'; };
  if (A.temVoz()) { carregarVozes(); try { window.speechSynthesis.addEventListener('voiceschanged', carregarVozes); } catch (e) { window.speechSynthesis.onvoiceschanged = carregarVozes; } }
  function vozesEN() { return vozes.filter(function (v) { return /^en([-_]|$)/i.test(v.lang || ''); }); }
  function vozEN() {
    var en = vozesEN(), pref = A.lsGet('ing-voz', '');
    if (pref) { var p = en.filter(function (v) { return v.name === pref; })[0]; if (p) return p; }
    var us = en.filter(function (v) { return /en[-_]US/i.test(v.lang); }), base = us.length ? us : en;
    return base.filter(function (v) { return /Google|Samantha|Aria|Jenny|Natural|Premium|Enhanced/i.test(v.name); })[0] || base[0] || null;
  }
  A.ouvirEN = function (txt, rate) {
    if (!A.temVoz()) { A.toast('Este navegador não lê em voz alta. No Chrome e no Safari funciona.'); return false; }
    try {
      window.speechSynthesis.cancel();
      var u = new window.SpeechSynthesisUtterance(String(txt || '')), v = vozEN();
      u.lang = v ? v.lang : 'en-US'; if (v) u.voice = v; u.rate = rate || vel();
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) { A.toast('Não consegui ler em voz alta agora.'); return false; }
  };
  A.btnOuvir = function (txt, opt) {
    opt = opt || {};
    return h('button', {class: 'btn sm en-ouvir' + (opt.cls ? ' ' + opt.cls : ''), type: 'button', title: opt.titulo || 'Ouvir em inglês', 'aria-label': opt.titulo || 'Ouvir em inglês',
      onclick: function (ev) { ev.stopPropagation(); A.ouvirEN(typeof txt === 'function' ? txt() : txt, opt.rate); }}, opt.rot || PLAY + ' Ouvir');
  };

  /* ---------- repetir e conferir: reconhecimento de fala do navegador ---------- */
  function SR() { return typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition || null) : null; }
  A.temMicrofone = function () { return !!SR(); };
  var NUM = {zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12', twenty: '20', thirty: '30', forty: '40', fifty: '50', hundred: '100'};
  function normal(s) {
    return String(s || '').toLowerCase().replace(/[‘’`]/g, "'").replace(/%/g, ' percent ').replace(/&/g, ' and ').replace(/\$/g, ' ')
      .replace(/(\d)[.,](\d)/g, '$1 point $2').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function palavras(s) { return normal(s).split(' ').filter(Boolean).map(function (w) { w = w.replace(/^'+|'+$/g, ''); return NUM[w] || w; }).filter(Boolean); }
  // Quais palavras da frase-alvo apareceram na fala, na ordem (maior subsequência comum); vale a melhor das alternativas
  I.conferirFala = function (alvo, falas) {
    var a = palavras(alvo), melhor = null;
    (Array.isArray(falas) ? falas : [falas]).forEach(function (f) {
      var b = palavras(f), n = a.length, m = b.length, L = [], i, j;
      for (i = 0; i <= n; i++) { L.push([]); for (j = 0; j <= m; j++) L[i].push(0); }
      for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      var ok = a.map(function () { return false; }); i = 0; j = 0;
      while (i < n && j < m) { if (a[i] === b[j]) { ok[i] = true; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
      var ac = ok.filter(Boolean).length, r = {fala: String(f || ''), ok: ok, acertos: ac, total: n, pct: n ? Math.round(100 * ac / n) : 0};
      if (!melhor || r.acertos > melhor.acertos) melhor = r;
    });
    melhor = melhor || {fala: '', ok: a.map(function () { return false; }), acertos: 0, total: a.length, pct: 0};
    melhor.palavras = a;
    return melhor;
  };
  // A frase-alvo com cada palavra marcada (certa ou faltou), na grafia original
  function frasConferida(alvo, r) {
    var k = 0;
    return String(alvo).split(/\s+/).filter(Boolean).map(function (tok) {
      var n = palavras(tok).length, ok = true;
      for (var q = 0; q < n; q++) { if (!r.ok[k + q]) ok = false; }
      k += n;
      return [h('span', {class: n && !ok ? 'cf-x' : 'cf-ok'}, tok), ' '];
    });
  }
  var ERRO_MIC = {'not-allowed': 'O microfone está bloqueado para este site. Libere o microfone nas configurações do navegador e tente de novo.',
    'service-not-allowed': 'O navegador não liberou o reconhecimento de fala. No iPhone, o Ditado precisa estar ligado em Ajustes › Geral › Teclado.',
    'no-speech': 'Não ouvi nada. Toque e fale de novo, mais perto do microfone.', 'audio-capture': 'Não achei microfone neste aparelho.',
    'network': 'O reconhecimento de fala precisa de internet.', 'aborted': 'Parou antes de ouvir. Toque e fale de novo.'};
  A.btnFalar = function (alvo, out, opt) {
    opt = opt || {};
    var rot = opt.rot || 'Repetir e conferir';
    var b = h('button', {class: 'btn sm en-mic', type: 'button', title: 'Fale a frase em inglês; o navegador marca as palavras que entendeu', onclick: function (ev) {
      ev.stopPropagation();
      var Rec = SR();
      if (!Rec) { out.replaceChildren(h('p', {class: 'muted en-fb'}, 'Este navegador não reconhece fala. Funciona no Chrome (computador e Android) e no Safari do iPhone.')); return; }
      var r;
      try { r = new Rec(); } catch (e) { out.replaceChildren(h('p', {class: 'muted en-fb'}, 'O reconhecimento de fala não abriu neste navegador.')); return; }
      r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 3; r.continuous = false;
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
      b.disabled = true; b.textContent = 'Ouvindo… fale agora';
      out.replaceChildren(h('p', {class: 'muted en-fb'}, 'Fale a frase inteira em inglês.'));
      var fim = function () { b.disabled = false; b.textContent = rot; };
      r.onresult = function (e) {
        var alts = [], res = e.results && e.results[0];
        for (var k = 0; res && k < res.length; k++) alts.push(res[k].transcript);
        var c = I.conferirFala(alvo, alts);
        out.replaceChildren(h('div', {class: 'en-conf'}, h('p', {class: 'cf-f'}, frasConferida(alvo, c)),
          h('p', {class: 'muted'}, 'O navegador entendeu: “' + (c.fala || '—') + '”'),
          h('p', {class: 'cf-n ' + (c.pct >= 85 ? 'bom' : c.pct >= 60 ? 'medio' : 'fraco')}, c.pct + '% das palavras · ' + (c.pct >= 85 ? 'Ótimo.' : c.pct >= 60 ? 'Bom, falta pouco: ouça de novo as palavras sublinhadas.' : 'Ouça mais devagar e repita.'))));
        if (opt.aoConferir) opt.aoConferir(c);
      };
      r.onerror = function (e) { out.replaceChildren(h('p', {class: 'muted en-fb'}, ERRO_MIC[e.error] || 'Não deu para ouvir agora (' + e.error + ').')); fim(); };
      r.onend = fim;
      try { r.start(); } catch (e) { fim(); }
    }}, rot);
    return b;
  };

  /* ---------- traduzir ---------- */
  function urlTradutor(t) { return 'https://translate.google.com/?sl=en&tl=pt&text=' + encodeURIComponent(t) + '&op=translate'; }
  A.urlTradutor = urlTradutor;
  A.btnTraduzir = function (txt, out) {
    return h('a', {class: 'btn sm en-trad', href: urlTradutor(txt), target: '_blank', rel: 'noopener', title: 'Tradução do Chrome no aparelho, quando existe; se não, abre o Google Tradutor', onclick: function (ev) {
      ev.stopPropagation();
      if (typeof window.Translator === 'undefined' || !out) return;  // sem tradução no navegador: segue o link do Google Tradutor
      ev.preventDefault();
      out.replaceChildren(h('p', {class: 'muted en-tr'}, 'Traduzindo no seu navegador…'));
      window.Translator.availability({sourceLanguage: 'en', targetLanguage: 'pt'}).then(function (av) {
        if (av === 'unavailable') throw new Error('indisponível');
        return window.Translator.create({sourceLanguage: 'en', targetLanguage: 'pt'});
      }).then(function (tr) { return tr.translate(txt); }).then(function (r) {
        out.replaceChildren(h('p', {class: 'en-tr'}, h('b', null, 'Em português: '), r, h('small', {class: 'muted'}, ' · tradução automática do Chrome, feita no aparelho')));
      }).catch(function () {
        out.replaceChildren(h('p', {class: 'muted en-tr'}, 'O Chrome não traduziu agora. ', h('a', {href: urlTradutor(txt), target: '_blank', rel: 'noopener'}, 'Abrir no Google Tradutor ↗')));
      });
    }}, 'Traduzir');
  };

  /* ---------- meu vocabulário: STORE 'vocab', revisão espaçada simples ---------- */
  var INTERVALO = [0, 1, 3, 7, 14, 30];  // dias até a próxima revisão, por caixa
  function hoje() { return I.hojeBRT(); }
  function maisDias(d, n) { var x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function hashCurto(s) { var x = 0; s = String(s); for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0; return x.toString(36); }
  function idVoc(en) { return 'v-' + normal(en).replace(/'/g, '').replace(/ /g, '-').slice(0, 48) + '-' + hashCurto(normal(en)); }
  function vocab() { return STORE.list('vocab').filter(function (v) { return v && v.en; }); }
  A.vocab = vocab;
  A.noVocab = function (en) { return !!STORE.get('vocab', idVoc(en)); };
  A.salvarVocab = async function (o) {
    var id = idVoc(o.en);
    if (STORE.get('vocab', id)) return STORE.get('vocab', id);
    return STORE.put('vocab', id, {en: o.en, pt: o.pt || '', exp: o.exp || '', ex: o.ex || '', tipo: o.tipo || 'frase', origem: o.origem || null,
      quando: new Date().toISOString(), caixa: 0, prox: hoje(), acertos: 0, erros: 0});
  };
  A.btnSalvarVocab = function (o) {
    var b = h('button', {class: 'btn sm en-salvar' + (A.noVocab(o.en) ? ' on' : ''), type: 'button', title: 'Guardar em Meu vocabulário para revisar depois', onclick: async function (ev) {
      ev.stopPropagation();
      if (A.noVocab(o.en)) { A.toast('Já está em Meu vocabulário.'); return; }
      try { await A.salvarVocab(o); b.textContent = 'No vocabulário'; b.classList.add('on'); A.toast('Salvo em Meu vocabulário (Biblioteca › Inglês).'); }
      catch (e) { A.toast('Não consegui salvar: ' + (e.message || e.code || e)); }
    }}, A.noVocab(o.en) ? 'No vocabulário' : (o.tipo === 'termo' ? 'Salvar termo' : 'Salvar frase'));
    return b;
  };
  function devidos() { var d = hoje(); return vocab().filter(function (v) { return (v.prox || d) <= d; }).sort(function (a, b) { return String(a.prox || '').localeCompare(String(b.prox || '')) || String(a.quando || '').localeCompare(String(b.quando || '')); }); }
  I.proximaRevisao = function (v, acertou, dia) {
    var c = acertou ? Math.min(5, (v.caixa || 0) + 1) : 0;
    return {caixa: c, prox: acertou ? maisDias(dia, INTERVALO[c]) : dia};
  };
  async function responder(v, acertou) {
    var o = Object.assign({}, v, I.proximaRevisao(v, acertou, hoje()), {acertos: (v.acertos || 0) + (acertou ? 1 : 0), erros: (v.erros || 0) + (acertou ? 0 : 1), revisto: new Date().toISOString()});
    delete o.id; delete o.atualizado;
    await STORE.put('vocab', v.id, o);
  }
  function baixar(nome, txt, tipo) {
    try { var a = h('a', {href: URL.createObjectURL(new Blob([txt], {type: tipo})), download: nome}); document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
    catch (e) { A.drawer('Exportar', h('textarea', {class: 'inp', style: 'min-height:60vh;width:100%', readonly: true}, txt)); }
  }
  function escHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function campo(s) { return String(s || '').replace(/[\t\r\n]+/g, ' ').trim(); }
  // Anki: arquivo de texto separado por tabulação, com cabeçalho (Anki 2.1.55 ou mais novo: Arquivo › Importar)
  I.textoAnki = function (lista) {
    var L = ['#separator:tab', '#html:true', '#columns:Frente\tVerso\tTags', '#tags column:3'];
    (lista || []).forEach(function (v) {
      var verso = [v.pt ? escHtml(campo(v.pt)) : '', v.exp ? escHtml(campo(v.exp)) : '', v.ex ? '<i>' + escHtml(campo(v.ex)) + '</i>' : '', v.origem && v.origem.fonte ? 'Fonte: ' + escHtml(campo(v.origem.fonte)) : ''].filter(Boolean).join('<br>');
      L.push([escHtml(campo(v.en)), verso || '(sem tradução salva)', 'oregon ' + (v.tipo === 'termo' ? 'termo' : 'frase')].join('\t'));
    });
    return L.join('\n') + '\n';
  };
  function importar(arq) {
    var r = new FileReader();
    r.onload = async function () {
      try {
        var js = JSON.parse(r.result), l = Array.isArray(js) ? js : js.itens || [], n = 0;
        for (var i = 0; i < l.length; i++) { var v = l[i]; if (!v || !v.en) continue; var id = idVoc(v.en); if (STORE.get('vocab', id)) continue; var o = Object.assign({}, v); delete o.id; delete o.atualizado; await STORE.put('vocab', id, o); n++; }
        A.toast(n + (n === 1 ? ' item importado.' : ' itens importados.')); A.rerender();
      } catch (e) { A.toast('Arquivo inválido: use o JSON exportado aqui.'); }
    };
    r.readAsText(arq);
  }

  /* ---------- barra de inglês nas notícias (lista e leitura) ---------- */
  function ehIngles(x) { return !!x && x.idioma === 'en' && !!x.titulo; }
  A.ehIngles = ehIngles;
  var origRow = A.itemRow;
  if (origRow) A.itemRow = function (x, opt) {
    var row = origRow.apply(this, arguments);
    if (ehIngles(x)) {
      var tt = row.querySelector('.nr-tt'), bt = tt && tt.querySelector('.nr-t');
      if (bt) bt.insertAdjacentElement('afterend', h('button', {class: 'en-row', type: 'button', title: 'Ouvir a manchete em inglês', 'aria-label': 'Ouvir a manchete em inglês', onclick: function (ev) { ev.stopPropagation(); A.ouvirEN(x.titulo); }}, PLAY + ' EN'));
    }
    return row;
  };
  function barraIngles(x) {
    var tx = x.titulo, out = h('div', {class: 'en-out'}), def = h('div', {class: 'en-def'}), termos = I.termosUnicos(tx + ' ' + (x.resumo || '').slice(0, 600));
    return h('div', {class: 'en-bar'},
      h('div', {class: 'row en-acts'}, h('span', {class: 'en-k'}, 'Inglês'), A.btnOuvir(tx), A.btnOuvir(tx, {rot: 'Mais devagar', rate: 0.6}), x.resumo ? A.btnOuvir(tx + '. ' + x.resumo, {rot: 'Ouvir com o resumo'}) : null,
        A.btnTraduzir(tx, out), A.btnFalar(tx, out), A.btnSalvarVocab({en: tx, tipo: 'frase', origem: {titulo: tx, link: x.link, fonte: A.orgDe ? A.orgDe(x) : x.fonte, data: I.pub(x)}})),
      termos.length ? h('p', {class: 'en-ts'}, h('span', {class: 'muted'}, 'Termos do glossário: '), termos.slice(0, 8).map(function (t) { return h('button', {class: 'gl-t', type: 'button', onclick: function () { mostrarTermo(t, def); }}, t.t); })) : null,
      def, out);
  }
  var origLeitura = A.leituraView;
  if (origLeitura) {
    A.leituraView = function (x) {
      var v = origLeitura.apply(this, arguments);
      if (ehIngles(x)) { var t = v.querySelector('.lr-t'); if (t) t.insertAdjacentElement('afterend', barraIngles(x)); }
      return v;
    };
    A.analiseView = A.leituraView;
  }

  /* ---------- inglês do dia: 5 manchetes reais + 3 frases sobre a carteira ---------- */
  var RUIDO = /earnings (preview|call)|transcript|^latest .* news|podcast|webinar|live updates?|^watch:|^video:|\bq[1-4] \d{4} earnings\b|\|/i;
  I.escolherManchetes = function (itens, agoraMs, max) {
    max = max || 5;
    function cands(horas) {
      var out = [], vis = {};
      (itens || []).forEach(function (x) {
        var t = String(x.titulo || '').trim();
        if (x.idioma !== 'en' || !t || RUIDO.test(t)) return;
        var n = t.split(/\s+/).length; if (n < 6 || n > 18) return;
        var p = Date.parse(I.pub(x)); if (!p || agoraMs - p > horas * 36e5 || p - agoraMs > 6e5) return;
        var k = t.toLowerCase().replace(/\W+/g, ' ').trim(); if (vis[k]) return; vis[k] = 1;
        var nt = I.termosUnicos(t).length; if (!nt) return;
        out.push({x: x, s: Math.min(nt, 4) * 2 + ((x.ativos || []).length || (x.ativos_vip || []).length ? 2 : 0) + (/gestora_internacional|instituicao/.test(x.categoria || '') ? 1 : 0) - (I.desconhecido && I.desconhecido(x) ? 3 : 0), p: p, org: (A.orgDe ? A.orgDe(x) : x.organizacao || x.fonte) || ''});
      });
      return out;
    }
    var c = cands(48); if (c.length < 3) c = cands(24 * 7);
    c.sort(function (a, b) { return b.s - a.s || b.p - a.p; });
    var out = [], org = {};
    c.forEach(function (o) { if (out.length < max && !org[o.org]) { org[o.org] = 1; out.push(o.x); } });
    c.forEach(function (o) { if (out.length < max && out.indexOf(o.x) < 0) out.push(o.x); });
    return out;
  };
  function manchetesDoDia() {
    var d = hoje(), salvo = A.lsGet('ing-dia', null), itens = A.itens ? A.itens() : [], por = {};
    itens.forEach(function (x) { por[x.id] = x; });
    if (salvo && salvo.data === d && (salvo.ids || []).length) { var l = salvo.ids.map(function (id) { return por[id]; }).filter(Boolean); if (l.length === salvo.ids.length) return l; }
    var out = I.escolherManchetes(itens, Date.now(), 5);
    if (out.length) A.lsSet('ing-dia', {data: d, ids: out.map(function (x) { return x.id; })});
    return out;
  }
  var SETOR = {'Petróleo': ['an oil and gas company', 'uma empresa de petróleo e gás'], 'Papel e celulose': ['a pulp and paper company', 'uma empresa de papel e celulose'],
    'Seguros': ['an insurance company', 'uma empresa de seguros'], 'Bancos': ['a bank', 'um banco'], 'Holding (Itaú)': ['a holding company with a stake in Itaú Unibanco', 'uma holding com participação no Itaú Unibanco'],
    'Energia elétrica': ['an electric utility', 'uma empresa de energia elétrica'], 'Energia e saneamento': ['an energy and sanitation company', 'uma empresa de energia e saneamento'],
    'Shoppings': ['a shopping mall company', 'uma empresa de shoppings'], 'Bancos digitais': ['a digital bank', 'um banco digital'], 'Agronegócio': ['an agribusiness company', 'uma empresa do agronegócio'],
    'Locação de pesados': ['a truck and heavy equipment rental company', 'uma empresa de locação de caminhões e máquinas']};
  var PILAR = {P5: ['Dividends', 'Dividendos'], P6: ['Value', 'Valor']};
  function nomeCurto(a) { return String(a.nome || a.ticker).replace(/ (ON|PN|UNT)$/, ''); }
  // Frases-modelo só com dados verificados do painel: nome, setor e pilar das ações aprovadas da Carteira Oregon
  I.frasesCarteira = function (ativos, dia) {
    var es = Object.keys(ativos || {}).map(function (t) { return ativos[t]; }).filter(function (a) { return a && a.classe === 'Ações' && a.status === 'aprovado' && PILAR[a.pilar] && SETOR[a.setor]; })
      .sort(function (a, b) { return a.ticker.localeCompare(b.ticker); });
    var dn = Math.floor(Date.parse(dia + 'T12:00:00Z') / 864e5), out = [];
    if (es.length) {
      var a1 = es[(dn * 2) % es.length], a2 = es[(dn * 2 + 1) % es.length];
      out.push({pt: nomeCurto(a1) + ' é ' + SETOR[a1.setor][1] + ' do nosso pilar de ' + PILAR[a1.pilar][1] + '.', en: nomeCurto(a1) + ' is ' + SETOR[a1.setor][0] + ' in our ' + PILAR[a1.pilar][0] + ' pillar.', t: a1.ticker});
      if (a2 !== a1) out.push({pt: 'Temos ' + nomeCurto(a2) + ' no pilar de ' + PILAR[a2.pilar][1] + ' da carteira Oregon.', en: 'We hold ' + nomeCurto(a2) + ' in the ' + PILAR[a2.pilar][0] + ' pillar of the Oregon portfolio.', t: a2.ticker});
    }
    if (TERMOS.length) { var g = TERMOS[(dn * 7) % TERMOS.length]; out.push({pt: g.ex_pt, en: g.ex, termo: g}); }
    return out;
  };
  function feitos() { var l = A.lsGet('ing-feitos', []); return Array.isArray(l) ? l : []; }
  function seguidos() {
    var f = {}, d = hoje(), n = 0; feitos().forEach(function (x) { f[x] = 1; });
    if (!f[d]) d = maisDias(d, -1);
    while (f[d]) { n++; d = maisDias(d, -1); }
    return n;
  }
  var ING = {data: null, passo: 0, rev: {}};
  function estado() {
    var d = hoje();
    if (ING.data !== d) { var s = A.lsGet('ing-passo', null); ING = {data: d, passo: s && s.data === d ? s.passo || 0 : 0, rev: {}}; }
    return ING;
  }
  function irPara(p, box) { estado().passo = p; A.lsSet('ing-passo', {data: ING.data, passo: p}); renderSessao(box); try { box.scrollIntoView({block: 'start', behavior: 'smooth'}); } catch (e) {} }
  function renderSessao(box) {
    var st = estado(), mh = manchetesDoDia(), fr = I.frasesCarteira(C.ATV, st.data), total = mh.length + fr.length;
    if (!mh.length) { box.replaceChildren(h('p', {class: 'empty'}, A.intel && A.intel.versao ? 'Ainda não há manchetes em inglês das últimas 48 horas com termos do glossário. Volte depois da próxima coleta.' : 'Carregando as manchetes coletadas pelo robô…')); return; }
    var p = Math.min(st.passo, total), corpo;
    var pontos = h('div', {class: 'en-pontos', 'aria-hidden': 'true'}, Array.from({length: total}, function (_, i) { return h('i', {class: i < p ? 'ok' : i === p ? 'at' : ''}); }));
    if (p >= total) {
      var f = feitos(); if (f.indexOf(st.data) < 0) { f.push(st.data); A.lsSet('ing-feitos', f.slice(-120)); }
      var dv = devidos().length, sq = seguidos();
      corpo = h('div', {class: 'en-card en-fim'}, h('h3', null, 'Pronto por hoje'), h('p', null, sq > 1 ? sq + ' dias seguidos estudando.' : 'Primeiro dia da sequência. Amanhã tem manchetes novas.'),
        h('p', {class: 'row', style: 'gap:6px;flex-wrap:wrap'}, dv ? h('a', {class: 'btn pri', href: '#en-rev'}, 'Revisar o vocabulário (' + dv + ')') : null, h('button', {class: 'btn', type: 'button', onclick: function () { irPara(0, box); }}, 'Refazer a sessão')));
    } else if (p < mh.length) {
      var x = mh[p], tx = x.titulo, rev = !!st.rev[p], out = h('div', {class: 'en-out'}), def = h('div', {class: 'en-def'});
      corpo = h('div', {class: 'en-card'}, h('p', {class: 'en-step'}, 'Manchete ' + (p + 1) + ' de ' + mh.length, h('span', {class: 'muted'}, ' · ouvir, entender, repetir')),
        h('p', {class: 'en-dica'}, rev ? 'Toque nos termos marcados para ver a explicação. Depois repita a frase em voz alta.' : 'Ouça sem ler. Tente pegar o assunto e duas ou três palavras.'),
        h('div', {class: 'row en-acts'}, A.btnOuvir(tx, {cls: 'pri'}), A.btnOuvir(tx, {rot: 'Mais devagar', rate: 0.6}),
          rev ? null : h('button', {class: 'btn sm', type: 'button', onclick: function () { st.rev[p] = true; renderSessao(box); }}, 'Mostrar o texto')),
        rev ? h('div', null, h('p', {class: 'en-frase', lang: 'en'}, A.textoMarcado(tx, def)), def,
          h('p', {class: 'en-src muted'}, (A.orgDe ? A.orgDe(x) : x.fonte) + ' · ' + A.dataBR(I.pub(x)) + ' · ', A.link(x.link) ? h('a', {href: A.link(x.link), target: '_blank', rel: 'noopener'}, 'abrir a fonte ↗') : null),
          h('div', {class: 'row en-acts'}, A.btnTraduzir(tx, out), A.btnFalar(tx, out), A.btnSalvarVocab({en: tx, tipo: 'frase', origem: {titulo: tx, link: x.link, fonte: A.orgDe ? A.orgDe(x) : x.fonte, data: I.pub(x)}})), out) : null);
    } else {
      var k = p - mh.length, q = fr[k], out2 = h('div', {class: 'en-out'}), mod = h('div', {class: 'en-mod', hidden: true}, h('p', {class: 'en-frase', lang: 'en'}, q.en, ' ', A.btnOuvir(q.en, {rot: PLAY, cls: 'ic', titulo: 'Ouvir o modelo'})));
      corpo = h('div', {class: 'en-card'}, h('p', {class: 'en-step'}, 'Fale você · ' + (k + 1) + ' de ' + fr.length, h('span', {class: 'muted'}, q.termo ? ' · use “' + q.termo.t + '”' : ' · sobre a carteira')),
        h('p', {class: 'en-dica'}, 'Diga em inglês:'), h('p', {class: 'en-pt'}, q.pt),
        h('div', {class: 'row en-acts'}, A.btnFalar(q.en, out2, {rot: 'Falar e conferir'}), h('button', {class: 'btn sm', type: 'button', onclick: function () { mod.hidden = !mod.hidden; }}, 'Mostrar o modelo'), A.btnSalvarVocab({en: q.en, pt: q.pt, tipo: 'frase'})),
        mod, out2, q.t ? h('p', {class: 'muted en-src'}, 'Frase montada com o nome, o setor e o pilar de ' + q.t + ' no painel.') : null);
    }
    var nav = h('div', {class: 'row en-nav'}, p > 0 ? h('button', {class: 'btn sm', type: 'button', onclick: function () { irPara(p - 1, box); }}, '‹ Voltar') : h('span'),
      p < total ? h('button', {class: 'btn sm pri', type: 'button', onclick: function () { irPara(p + 1, box); }}, p === total - 1 ? 'Concluir' : 'Próxima ›') : null);
    box.replaceChildren(pontos, corpo, nav);
  }

  /* ---------- revisão em cartões ---------- */
  var REV = {fila: null, i: 0, mostra: false, repetidos: {}};
  function renderRevisao(box) {
    var lista = vocab();
    if (!lista.length) { box.replaceChildren(h('p', {class: 'empty sm'}, 'Seu vocabulário está vazio. Toque em "Salvar frase" numa manchete ou em "Salvar termo" no glossário.')); return; }
    if (!REV.fila) { REV.fila = devidos().map(function (v) { return v.id; }); REV.i = 0; REV.mostra = false; REV.repetidos = {}; }
    var v = REV.i < REV.fila.length ? STORE.get('vocab', REV.fila[REV.i]) : null;
    if (!v) {
      var prox = lista.map(function (o) { return o.prox; }).filter(function (d) { return d && d > hoje(); }).sort()[0];
      box.replaceChildren(h('div', null, h('p', {class: 'empty sm'}, REV.fila.length ? 'Revisão de hoje concluída.' : 'Nada para revisar hoje.', prox ? ' Próxima revisão: ' + A.dataBR(prox) + '.' : ''),
        REV.fila.length ? h('button', {class: 'btn sm', type: 'button', onclick: function () { REV.fila = null; renderRevisao(box); }}, 'Conferir de novo') : null));
      return;
    }
    var out = h('div', {class: 'en-out'});
    box.replaceChildren(h('p', {class: 'en-step'}, 'Cartão ' + (REV.i + 1) + ' de ' + REV.fila.length),
      h('div', {class: 'en-card en-cartao'}, h('p', {class: 'en-frase', lang: 'en'}, v.en), h('div', {class: 'row en-acts'}, A.btnOuvir(v.en), A.btnFalar(v.en, out)), out,
        REV.mostra ? h('div', {class: 'en-verso'}, v.pt ? h('p', null, h('b', null, v.pt)) : h('p', {class: 'muted'}, 'Sem tradução salva. ', A.btnTraduzir(v.en, out)), v.exp ? h('p', {class: 'muted'}, v.exp) : null,
          v.ex && v.ex !== v.en ? h('p', {class: 'gl-ex'}, h('i', null, v.ex), ' ', A.btnOuvir(v.ex, {rot: PLAY, cls: 'ic', titulo: 'Ouvir o exemplo'})) : null,
          v.origem && v.origem.fonte ? h('p', {class: 'muted en-src'}, v.origem.fonte, v.origem.link && A.link(v.origem.link) ? [' · ', h('a', {href: A.link(v.origem.link), target: '_blank', rel: 'noopener'}, 'fonte ↗')] : null) : null) : null),
      h('div', {class: 'row en-nav'}, REV.mostra ? [h('button', {class: 'btn sm', type: 'button', onclick: async function () { await responder(v, false); if (!REV.repetidos[v.id]) { REV.repetidos[v.id] = 1; REV.fila.push(v.id); } REV.i++; REV.mostra = false; renderRevisao(box); }}, 'Errei · ver de novo'),
        h('button', {class: 'btn sm pri', type: 'button', onclick: async function () { await responder(v, true); REV.i++; REV.mostra = false; renderRevisao(box); }}, 'Acertei')]
        : h('button', {class: 'btn sm pri', type: 'button', onclick: function () { REV.mostra = true; renderRevisao(box); }}, 'Mostrar a resposta')));
  }

  /* ---------- podcasts curtos (só links oficiais, conferidos em 08/11/2026) ---------- */
  var PODCASTS = [
    ['Thoughts on the Market', 'Morgan Stanley', 'https://www.morganstanley.com/insights/podcasts/thoughts-on-the-market', 'Episódios curtos de research, quase diários; cada episódio tem a transcrição na página.'],
    ['Markets in Motion', 'RBC Capital Markets', 'https://www.rbccm.com/en/insights/podcasts/markets-in-motion', 'Estratégia de ações dos EUA, de 4 a 9 minutos.'],
    ['The Indicator from Planet Money', 'NPR', 'https://www.npr.org/podcasts/510325/the-indicator-from-planet-money', 'Economia explicada em 10 minutos ou menos, de segunda a sexta; vários episódios têm transcrição.'],
    ['Marketplace Morning Report', 'Marketplace', 'https://www.marketplace.org/shows/marketplace-morning-report/', 'Resumo curto das notícias de economia e mercado da manhã nos EUA.']];

  /* ---------- página ---------- */
  var GLB = {q: ''};
  function linhaTermo(t) {
    var def = h('div', {class: 'en-def'});
    return h('li', {class: 'gl-li'}, h('div', {class: 'gl-l1'}, h('b', {lang: 'en'}, t.t), h('span', {class: 'gl-pt'}, t.pt), A.btnOuvir(t.t, {rot: PLAY, cls: 'ic', titulo: 'Ouvir a pronúncia de ' + t.t}), A.btnSalvarVocab({en: t.t, pt: t.pt, exp: t.exp, ex: t.ex, tipo: 'termo'})),
      h('p', {class: 'muted gl-exp'}, t.exp), h('p', {class: 'gl-ex'}, h('i', {lang: 'en'}, t.ex), ' ', A.btnOuvir(t.ex, {rot: PLAY, cls: 'ic', titulo: 'Ouvir o exemplo'}), ' ', h('small', {class: 'muted'}, t.ex_pt)), def);
  }
  function glossarioView() {
    var lista = h('div', {class: 'gl-lista'});
    function desenhar() {
      var q = GLB.q.trim().toLowerCase();
      if (q) {
        var l = TERMOS.filter(function (t) { return (t.t + ' ' + t.pt + ' ' + (t.f || []).join(' ')).toLowerCase().indexOf(q) >= 0; });
        lista.replaceChildren(l.length ? h('ul', {class: 'gl-ul'}, l.map(linhaTermo)) : h('p', {class: 'empty sm'}, 'Nenhum termo com "' + GLB.q + '".'));
        return;
      }
      lista.replaceChildren.apply(lista, Object.keys(GRUPOS).map(function (g) {
        var l = TERMOS.filter(function (t) { return t.g === g; });
        return h('details', {class: 'gl-g'}, h('summary', null, GRUPOS[g], h('small', {class: 'muted'}, ' · ' + l.length)), h('ul', {class: 'gl-ul'}, l.map(linhaTermo)));
      }));
    }
    var inp = h('input', {class: 'inp', type: 'search', placeholder: 'Procurar termo em inglês ou português', 'aria-label': 'Procurar no glossário', value: GLB.q, oninput: function () { GLB.q = inp.value; desenhar(); }});
    desenhar();
    return h('div', null, inp, lista);
  }
  function vocabView() {
    var l = vocab().sort(function (a, b) { return String(b.quando || '').localeCompare(String(a.quando || '')); });
    var acoes = h('div', {class: 'row', style: 'gap:6px;flex-wrap:wrap;margin-bottom:8px'},
      h('button', {class: 'btn sm', type: 'button', disabled: !l.length || null, onclick: function () { baixar('oregon_vocabulario_anki.txt', I.textoAnki(vocab()), 'text/plain'); }}, 'Exportar para o Anki'),
      h('button', {class: 'btn sm', type: 'button', disabled: !l.length || null, onclick: function () { baixar('oregon_vocabulario.json', JSON.stringify({itens: vocab()}, null, 1), 'application/json'); }}, 'Exportar (JSON)'),
      h('label', {class: 'btn sm'}, 'Importar (JSON)', h('input', {type: 'file', accept: '.json,application/json', style: 'display:none', onchange: function (ev) { if (ev.target.files[0]) importar(ev.target.files[0]); }})));
    if (!l.length) return h('div', null, acoes, h('p', {class: 'empty sm'}, 'Nada salvo ainda.'));
    return h('div', null, acoes, h('ul', {class: 'vc-ul'}, l.slice(0, 200).map(function (v) {
      return h('li', null, h('div', {class: 'vc-l1'}, h('span', {lang: 'en'}, v.en), A.btnOuvir(v.en, {rot: PLAY, cls: 'ic'}),
        h('button', {class: 'btn sm link', type: 'button', title: 'Tirar do vocabulário', onclick: async function () { await STORE.del('vocab', v.id); REV.fila = null; A.rerender(); }}, 'tirar')),
        h('small', {class: 'muted'}, [v.pt, 'caixa ' + (v.caixa || 0) + ' de 5', v.prox ? 'revisar ' + (v.prox <= hoje() ? 'hoje' : 'em ' + A.dataBR(v.prox)) : ''].filter(Boolean).join(' · ')));
    })), l.length > 200 ? h('p', {class: 'muted'}, 'Mostrando os 200 mais recentes de ' + l.length + '. A exportação leva todos.') : null);
  }
  function velocidade() {
    return h('div', {class: 'sub filt en-vel', role: 'toolbar', 'aria-label': 'Velocidade da voz'}, h('span', {class: 'muted'}, 'Velocidade da voz:'),
      [[0.75, '0,75×'], [1, '1×']].map(function (o) { return h('button', {type: 'button', 'aria-pressed': vel() === o[0] ? 'true' : 'false', onclick: function () { A.lsSet('ing-vel', o[0]); A.rerender(); }}, o[1]); }));
  }
  function pagina() {
    var wrap = h('div', {class: 'en-pag'});
    wrap.appendChild(A.pageHead('Biblioteca', 'Inglês do mercado', 'Inglês com o que o robô coletou: ouvir a manchete, entender os termos, repetir em voz alta e guardar o vocabulário. De 15 a 20 minutos por dia.'));
    var v = vozEN(), dv = devidos().length, sq = seguidos();
    wrap.appendChild(h('div', {class: 'en-topo'}, velocidade(),
      h('p', {class: 'muted en-st'}, A.temVoz() ? (v ? 'Voz: ' + v.name + ' (' + v.lang + ')' : 'Sem voz em inglês instalada neste aparelho') : 'Este navegador não lê em voz alta', ' · ',
        A.temMicrofone() ? 'Microfone: disponível' : 'Microfone: este navegador não reconhece fala', sq ? ' · ' + sq + (sq > 1 ? ' dias seguidos' : ' dia') : '')));
    wrap.appendChild(h('nav', {class: 'sumario', 'aria-label': 'Nesta página'}, h('span', {class: 'muted'}, 'Nesta página:'), h('a', {href: '#en-dia'}, 'Inglês do dia'), h('a', {href: '#en-rev'}, 'Revisar' + (dv ? ' (' + dv + ')' : '')),
      h('a', {href: '#en-voc'}, 'Meu vocabulário'), h('a', {href: '#en-gl'}, 'Glossário (' + TERMOS.length + ')'), h('a', {href: '#en-pod'}, 'Podcasts')));
    var ses = h('div', {class: 'en-ses'}); renderSessao(ses);
    wrap.appendChild(A.sec('Inglês do dia · ' + A.dataBR(hoje()).slice(0, 5), {id: 'en-dia', hint: 'Cinco manchetes em inglês que o robô coletou nas últimas 48 horas, escolhidas pelos termos do glossário (veículos pouco conhecidos ficam por último), e três frases para você falar: duas sobre ações da Carteira Oregon (nome, setor e pilar do painel) e uma com um termo do glossário. As manchetes do dia ficam as mesmas até a meia-noite.'}, ses));
    var rv = h('div'); REV.fila = null; renderRevisao(rv);
    wrap.appendChild(A.sec('Revisar vocabulário', {id: 'en-rev', badge: h('span', {class: 'sec-n'}, dv + (dv === 1 ? ' para hoje' : ' para hoje')), hint: 'Revisão em cartões: acertou, o cartão volta em 1, 3, 7, 14 e depois 30 dias; errou, volta na mesma sessão e no dia seguinte começa de novo.'}, rv));
    wrap.appendChild(A.sec('Meu vocabulário', {id: 'en-voc', badge: h('span', {class: 'sec-n'}, String(vocab().length)), hint: 'Frases e termos que você salvou nas notícias, no Inglês do dia e no glossário. Fica ' + (STORE.mode === 'db' ? 'no banco deste painel.' : 'neste navegador: para usar em outro aparelho, exporte aqui e importe lá.') + ' O arquivo para o Anki abre em Arquivo › Importar (Anki 2.1.55 ou mais novo).'}, vocabView()));
    wrap.appendChild(A.sec('Glossário do mercado', {id: 'en-gl', badge: h('span', {class: 'sec-n'}, TERMOS.length + ' termos'), hint: 'Termos de mercado em inglês com a tradução, uma explicação curta e um exemplo genérico. São os mesmos termos marcados nas manchetes e usados na frase do dia do Telegram.'}, glossarioView()));
    wrap.appendChild(A.sec('Podcasts curtos em inglês', {id: 'en-pod', badge: h('span', {class: 'sec-n'}, 'consulta externa'), hint: 'Links oficiais, abertos no seu navegador. O Oregon não coleta nem guarda os episódios.'},
      h('ul', {class: 'rc-l'}, PODCASTS.map(function (p) { return h('li', null, h('a', {href: p[2], target: '_blank', rel: 'noopener'}, p[0] + ' ↗'), h('span', {class: 'muted'}, ' · ' + p[1] + ' · ' + p[3])); }))));
    wrap.appendChild(h('p', {class: 'hint'}, 'Como funciona: a voz e o reconhecimento de fala são do seu navegador, sem custo e sem chave. No Chrome, o áudio do microfone é processado pelo serviço de voz do Google; o Oregon não grava nada. ',
      'A tradução usa a do próprio Chrome no computador, quando existe; nos outros casos abre o Google Tradutor. Manchetes e resumos são das fontes coletadas, sem o texto completo das matérias.'));
    return wrap;
  }
  A.SUBS.bib.push(['ingles', 'Inglês']);
  var origBib = A.areas.bib;
  A.areas.bib = function () {
    if (S.sub.bib !== 'ingles') return origBib.apply(this, arguments);
    var w = h('div'); w.appendChild(A.subnav('bib', A.SUBS.bib)); w.appendChild(pagina()); return w;
  };
})(APP, CORE, INTEL);
