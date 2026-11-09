/* v3.7 · aprovado pelo Lucas em 08/11/2026 (só acréscimos):
   topo sem cortes (coleta num ponto com a hora; detalhes, tema e "Coletar agora" ao tocar), aviso ao atualizar, modo escuro,
   explicações recolhidas, faixa do dia, alertas das buscas salvas, fila de leitura, mudanças de recomendação,
   fechamento da semana, impressão. Nenhuma nota, score ou recomendação é criada: tudo é contagem ou texto publicado. */
(function (A, C, I) {
  'use strict';
  var h = A.h;
  var GH_ACTIONS = 'https://github.com/lucaslimaequity-a11y/robo-oregon/actions/workflows/robo.yml';
  A.GH_ACTIONS = GH_ACTIONS;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem('oregon-v37:' + k); localStorage.setItem('oregon-v37:' + k, v); } catch (e) { return null; } return null; }
  function E() { return A.intel; }
  function pad(n) { return ('0' + n).slice(-2); }

  /* ---------- tema (automático, claro, escuro) e explicações sempre visíveis ---------- */
  function aplicaTema(t) { var r = document.documentElement; if (t === 'claro') r.setAttribute('data-theme', 'light'); else if (t === 'escuro') r.setAttribute('data-theme', 'dark'); else r.removeAttribute('data-theme'); }
  A.tema = function () { return ls('tema') || 'auto'; };
  A.setTema = function (t) { ls('tema', t); aplicaTema(t); };
  aplicaTema(A.tema());
  A.explicaSempre = function (v) { if (v === undefined) return ls('explica') === '1'; ls('explica', v ? '1' : '0'); document.documentElement.classList.toggle('explica', !!v); return !!v; };
  document.documentElement.classList.toggle('explica', A.explicaSempre());

  /* ---------- agenda do robô no GitHub (horário de Brasília): 1h15, 4h15 e aos 7 e 37 minutos de cada hora, das 7h07 às 22h37 ---------- */
  var SLOTS = [75, 255]; for (var m0 = 427; m0 <= 1357; m0 += 30) SLOTS.push(m0);
  function minBRT(d) { var x = new Date((d ? d.getTime() : Date.now()) - 3 * 3600e3); return x.getUTCHours() * 60 + x.getUTCMinutes(); }
  A.proximaColeta = function () { var n = minBRT(), s = SLOTS.filter(function (x) { return x > n; })[0]; if (s == null) s = SLOTS[0]; return pad(Math.floor(s / 60)) + ':' + pad(s % 60); };
  function agoraHM() { var n = minBRT(); return pad(Math.floor(n / 60)) + ':' + pad(n % 60); }

  /* ---------- topo: ponto + hora da coleta; o resto abre ao tocar ---------- */
  var POP = null;
  function fecharPop() { if (POP) { POP.remove(); POP = null; document.removeEventListener('click', foraPop, true); document.removeEventListener('keydown', escPop, true); } }
  function foraPop(ev) { if (POP && !POP.contains(ev.target) && !(ev.target.closest && ev.target.closest('.dstat'))) fecharPop(); }
  function escPop(ev) { if (ev.key === 'Escape') fecharPop(); }
  function situacao() {
    var e = E(), v = e.versao;
    if (!v) return {abs: e.carregando ? 'buscando…' : 'sem dados', cls: e.erro ? 'critico' : 'parcial', atras: false, idade: null};
    var idade = (Date.now() - new Date(v.gerado_em).getTime()) / 60000;
    return {abs: I.horaAbs(v.gerado_em), rel: I.quando({publicado_em: v.gerado_em}), cls: idade > 120 ? 'parcial' : 'completo', atras: idade > 180, idade: idade};
  }
  function corpoPop() {
    var s = situacao(), e = E();
    var temas = h('div', {class: 'seg sm', role: 'radiogroup', 'aria-label': 'Aparência'}, [['auto', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']].map(function (t) {
      return h('button', {role: 'radio', 'aria-checked': A.tema() === t[0] ? 'true' : 'false', onclick: function () { A.setTema(t[0]); temas.querySelectorAll('button').forEach(function (b, i) { b.setAttribute('aria-checked', i === ['auto', 'claro', 'escuro'].indexOf(t[0]) ? 'true' : 'false'); }); }}, t[1]);
    }));
    var ck = h('input', {type: 'checkbox', checked: A.explicaSempre() || null, onchange: function () { A.explicaSempre(ck.checked); }});
    return h('div', null,
      h('p', {class: 'pop-l'}, h('i', {class: 'dot ' + s.cls}), ' Última coleta concluída: ', h('b', null, s.abs), s.rel ? h('span', {class: 'muted'}, ' (' + s.rel + ')') : null),
      s.atras ? h('p', {class: 'pop-l warn'}, 'O robô está atrasado: a última coleta tem mais de 3 horas.') : null,
      A.avisoAtraso ? A.avisoAtraso('pop') : null,  // v3.9.1 · qual coleta prevista não chegou
      h('p', {class: 'pop-l muted'}, 'Próxima coleta prevista às ' + A.proximaColeta() + '. O robô roda no GitHub aos 7 e aos 37 minutos de cada hora, das 5h07 às 22h37, também aos 22 e aos 52 das 9h22 às 18h52, e à 1h15, 2h07, 3h07 e 4h15. O GitHub pode atrasar ou pular rodadas; a rodada leva uns 10 minutos para publicar. Para coletar na hora, use "Coletar agora".'),
      h('p', {class: 'pop-l muted'}, 'Corrente de rodadas: cada rodada também dispara a seguinte, a cada 15 minutos das 6h às 23h e a cada 30 minutos de madrugada, sem depender do agendador do GitHub. Os horários acima ficam de reserva: se a corrente parar, o primeiro horário que rodar a religa.'),  // v3.11
      e.ultimoAviso ? h('p', {class: 'pop-l'}, e.ultimoAviso) : null,
      h('div', {class: 'pop-acts'},
        h('button', {class: 'btn sm', onclick: function () { fecharPop(); A.intelAtualizar(); }}, 'Atualizar agora'),
        h('button', {class: 'btn sm', onclick: function () { fecharPop(); A.go('bib', 'fontes'); }}, 'Coleta por fonte'),
        h('a', {class: 'btn sm pri', href: GH_ACTIONS, target: '_blank', rel: 'noopener', title: 'Abre a página do robô no GitHub: toque em "Run workflow". Usa o seu login do GitHub; nenhuma chave fica no site.'}, 'Coletar agora ↗')),
      h('p', {class: 'pop-k'}, 'Aparência'), temas,
      h('label', {class: 'pop-ck'}, ck, ' Sempre mostrar as explicações das telas (o "?" ao lado dos títulos)'));
  }
  A.dadosPill = function () {
    var s = situacao();
    var b = h('button', {class: 'dstat' + (s.atras ? ' atras' : ''), 'aria-haspopup': 'dialog', title: 'Última coleta concluída pelo robô' + (s.rel ? ' (' + s.rel + ')' : '') + (s.atras ? ' · robô atrasado' : '') + '. Toque para detalhes, aparência e "Coletar agora".',
      onclick: function (ev) {
        ev.stopPropagation();
        if (POP) { fecharPop(); return; }
        POP = h('div', {class: 'pop', role: 'dialog', 'aria-label': 'Coleta do robô e aparência'}, corpoPop());
        document.body.appendChild(POP);
        var r = b.getBoundingClientRect(), w = Math.min(360, window.innerWidth - 16);
        POP.style.width = w + 'px'; POP.style.top = Math.round(r.bottom + 8) + 'px'; POP.style.left = Math.round(Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))) + 'px';
        setTimeout(function () { document.addEventListener('click', foraPop, true); document.addEventListener('keydown', escPop, true); }, 0);
      }},
      h('i', {class: 'dot ' + s.cls}), h('span', {class: 'ds-l'}, E().versao ? 'Coleta ' : ''), h('b', null, s.abs), s.atras ? h('i', {class: 'ds-at', 'aria-label': 'robô atrasado'}) : null);
    return b;
  };

  /* ---------- aviso depois do Atualizar ---------- */
  function daColeta(iso) { var t = I.horaAbs(iso); return /^\d/.test(t) ? 'das ' + t : 'de ' + t; }  // "das 15:57", "de ontem 09:00"
  var at0 = A.intelAtualizar;
  A.intelAtualizar = async function () {
    var e = E(), antes = e.versao && e.versao.gerado_em;
    await at0();
    var dep = e.versao && e.versao.gerado_em, msg;
    if (e.erro) msg = 'Conferido às ' + agoraHM() + ': não consegui ler os dados do robô (' + e.erro + '). Tente de novo em alguns minutos.';
    else if (dep && dep !== antes) msg = 'Conferido às ' + agoraHM() + ': chegou a coleta ' + daColeta(dep) + '.';
    else msg = 'Conferido às ' + agoraHM() + ': nada novo desde a coleta ' + (dep ? daColeta(dep) : '—') + '. Próxima coleta prevista às ' + A.proximaColeta() + '; o GitHub costuma atrasar.';
    e.ultimoAviso = msg;
    if (A.toast) A.toast(msg, 8000);
    if (A.rerender) A.rerender();
    return msg;
  };

  /* ---------- impressão (Comitê, Pautas, Fechamento) ---------- */
  A.btnImprimir = function (rotulo) { return h('button', {class: 'btn sm no-print', title: 'Imprime ou salva em PDF pelo navegador (folha A4 limpa)', onclick: function () { window.print(); }}, rotulo || 'Imprimir'); };

  /* ---------- faixa do dia (Hoje) ---------- */
  function mesAtual() { return I.hojeBRT().slice(0, 7); }
  function ateSexta() { var d = new Date(I.hojeBRT() + 'T12:00:00Z'), w = d.getUTCDay(), add = w <= 5 ? 5 - w : 12 - w; return new Date(d.getTime() + add * 864e5).toISOString().slice(0, 10); }
  A.cartasDoMes = function () {
    var a = A.arquivo('biblioteca/cartas_mencoes.json'); if (!a.dados) return null;
    var m = (a.dados.meses || []).filter(function (x) { return x.mes === mesAtual(); })[0] || (a.dados.meses || [])[0];
    if (!m) return null;
    var ids = {};
    (m.empresas || []).forEach(function (e) { if (e.carteira) (e.cartas || []).forEach(function (c) { ids[c] = 1; }); });
    return {mes: m.mes, lidas: m.n_lidas || 0, citando: Object.keys(ids).length};
  };
  A.faixaDoDia = function (o) {
    var seg = [];
    function lk(n, txt, go) { seg.push(h('button', {class: 'btn link fxd-i', onclick: go}, h('b', null, String(n)), ' ' + txt)); }
    function ancora(id) { return function () { var el = document.getElementById(id); if (el) { el.classList.remove('fechada'); el.scrollIntoView({behavior: 'smooth', block: 'start'}); } }; }
    if (o.fatos) lk(o.fatos, o.fatos > 1 ? 'acontecimentos nas carteiras (72 h)' : 'acontecimento nas carteiras (72 h)', ancora('radar'));
    if (o.opinioes) lk(o.opinioes, o.opinioes > 1 ? 'opiniões de casas (7 dias)' : 'opinião de casa (7 dias)', ancora('debate'));
    var lim = ateSexta(), dc = (A.proventosProximos ? A.proventosProximos(10, false) : []).filter(function (e) { return e.k === 'data-com' && e.d <= lim; });
    var tks = {}; dc.forEach(function (e) { tks[e.t] = 1; });
    if (dc.length) lk(Object.keys(tks).length, (Object.keys(tks).length > 1 ? 'ativos com data-com até sexta' : 'ativo com data-com até sexta'), function () { A.go('brasil', 'proventos'); });
    var cm = A.cartasDoMes();
    if (cm && cm.citando) lk(cm.citando, cm.citando > 1 ? 'cartas do mês citam a carteira' : 'carta do mês cita a carteira', function () { A.go('brasil', 'cartas'); });
    var pauta = (typeof STORE !== 'undefined' ? STORE.list('comite') : []).filter(function (r) { return r.mes === mesAtual(); }).length;
    if (pauta) lk(pauta, pauta > 1 ? 'itens na pauta do comitê' : 'item na pauta do comitê', function () { A.go('cart', 'comite'); });
    var al = (A.buscasSalvas ? A.buscasSalvas() : []).reduce(function (s, b) { return s + (b.novos || 0); }, 0);
    if (al) lk(al, al > 1 ? 'novos nas suas buscas salvas' : 'novo nas suas buscas salvas', ancora('alertas'));
    return h('div', {class: 'fxd', role: 'navigation', 'aria-label': 'Faixa do dia'}, seg.length ? seg.reduce(function (acc, el, i) { if (i) acc.push(h('span', {class: 'fxd-s', 'aria-hidden': 'true'}, '·')); acc.push(el); return acc; }, [])
      : h('span', {class: 'muted'}, 'Dia calmo nas carteiras: nenhum acontecimento nas últimas 72 h.'));
  };

  /* ---------- alertas das buscas salvas e fila de leitura (Hoje) ---------- */
  A.alertasHoje = function () {
    var bs = A.buscasSalvas ? A.buscasSalvas() : [];
    var com = bs.filter(function (o) { return o.novos; });
    var corpo;
    if (!bs.length) corpo = h('p', {class: 'muted hx-vz'}, 'Salve uma busca na Biblioteca (ex.: recompra, ou evento:recompra ativo:PETR4) e ela vira alerta aqui.');
    else if (!com.length) corpo = h('p', {class: 'muted hx-vz'}, 'Nada novo nas ' + bs.length + (bs.length > 1 ? ' buscas salvas' : ' busca salva') + ' desde a sua última visita.');
    else corpo = h('ul', {class: 'hx-l'}, com.slice(0, 4).map(function (o) {
      return h('li', null, h('button', {class: 'btn link hx-b', onclick: function () { A.abrirBusca(o.b); }}, o.b.nome), h('span', {class: 'hx-n'}, o.novos + (o.novos > 1 ? ' novos' : ' novo')),
        (o.itensNovos || []).slice(0, 2).map(function (x) { return h('div', {class: 'hx-it'}, A.marcaEl(x), h('button', {class: 'nwl', onclick: function () { A.abrirItem(x); }}, x.titulo)); }));
    }));
    return h('section', {class: 'hx', id: 'alertas', 'aria-labelledby': 'hx-al'}, h('h2', {id: 'hx-al'}, 'Alertas das suas buscas', com.length ? h('span', {class: 'ar-n'}, ' ' + com.length + ' com novidade') : null), corpo);
  };
  A.filaHoje = function () {
    var l = A.salvos ? A.salvos() : [];
    var corpo = l.length ? h('ul', {class: 'hx-l'}, l.slice(0, 4).map(function (s0) {
      var x = A.itemPorId(s0.id) || s0.item || {id: s0.id, titulo: s0.titulo, link: s0.link};
      var abre = function () { if (x.col && A.link(x.link)) window.open(A.link(x.link), '_blank', 'noopener'); else A.abrirItem(x); };
      var li = h('li', null, h('div', {class: 'hx-it'}, x.col ? h('i', {class: 'mt mt-research', title: 'Estante'}, 'E') : A.marcaEl(x), h('button', {class: 'nwl', onclick: abre}, x.titulo || s0.titulo),
        h('button', {class: 'btn link hx-ok', title: 'Tirar da fila (já li)', onclick: async function () { await A.salvar(x, false); li.remove(); }}, 'já li')), h('small', {class: 'muted'}, s0.fonte || A.orgDe(x) || ''));
      return li;
    })) : h('p', {class: 'muted hx-vz'}, 'Fila vazia. Toque em "Ler depois" numa notícia, num research ou num item da Estante.');
    return h('section', {class: 'hx', id: 'fila', 'aria-labelledby': 'hx-fl'}, h('h2', {id: 'hx-fl'}, 'Sua fila de leitura', h('span', {class: 'ar-n'}, ' ' + l.length)),
      corpo, l.length > 4 ? h('button', {class: 'btn link', onclick: function () { A.go('bib', 'busca'); if (A.bibFiltro) A.bibFiltro({grupo: 'salvos'}); }}, 'Ver a fila inteira ↗') : null);
  };

  /* ---------- mudanças de recomendação: a mesma casa, o mesmo ativo, a visão anterior publicada ---------- */
  var REC_NORM = {'compra': 'Compra', 'buy': 'Compra', 'outperform': 'Compra', 'overweight': 'Compra', 'acima da media': 'Compra', 'neutro': 'Neutro', 'neutra': 'Neutro', 'neutral': 'Neutro', 'hold': 'Neutro', 'manter': 'Neutro', 'market perform': 'Neutro', 'equal weight': 'Neutro', 'venda': 'Venda', 'sell': 'Venda', 'underperform': 'Venda', 'underweight': 'Venda', 'abaixo da media': 'Venda'};
  function recN(r) { if (!r) return null; var k = I.norm(r).trim(); return REC_NORM[k] || r; }
  function alvoN(p) { if (!p) return null; var m = /([\d.]+,\d{1,2}|\d+(?:[.,]\d+)?)/.exec(String(p)); if (!m) return null; var v = parseFloat(m[1].indexOf(',') >= 0 ? m[1].replace(/\./g, '').replace(',', '.') : m[1]); return isFinite(v) ? v : null; }
  var TIT_MUD = /\b(eleva|rebaixa|corta|melhora|piora|reduz|aumenta|sobe|revisa|inicia cobertura|initiat|upgrade|downgrade|tira|retira|coloca|inclui)\b/;
  A.mudancasRecomendacao = function (de, ate) {
    var ops = (A.itensAtivo ? A.itensAtivo() : []).filter(function (x) { return x.natureza === 'opiniao_casa' && !x.agrupado_em; });
    var por = {};
    ops.forEach(function (x) {
      var at = I.diretos(x).concat(x.ativos_vip || []); if (!at.length || !(x.casas || []).length) return;
      at.forEach(function (t) { (x.casas || []).forEach(function (c) { (por[t + '|' + c] = por[t + '|' + c] || []).push(x); }); });
    });
    var out = [], vistos = {};
    Object.keys(por).forEach(function (k) {
      var l = por[k].sort(function (a, b) { return I.pub(a).localeCompare(I.pub(b)); }), t = k.split('|')[0], casa = k.split('|')[1];
      l.forEach(function (x, i) {
        var d = I.pub(x).slice(0, 10); if (d < de || d > ate) return;
        var ant = null; for (var j = i - 1; j >= 0; j--) { if (l[j].recomendacao || l[j].preco_alvo || l[j].posicao) { ant = l[j]; break; } }
        var r1 = recN(x.recomendacao), r0 = ant ? recN(ant.recomendacao) : null, p1 = alvoN(x.preco_alvo), p0 = ant ? alvoN(ant.preco_alvo) : null;
        var mudRec = r1 && r0 && r1 !== r0, mudAlvo = p1 != null && p0 != null && Math.abs(p1 - p0) > 0.005, mudSent = !mudRec && ant && x.posicao && ant.posicao && x.posicao !== ant.posicao;
        var titulo = !ant && TIT_MUD.test(I.norm(x.titulo || '')) && (r1 || p1 != null);
        if (!(mudRec || mudAlvo || mudSent || titulo)) return;
        var chave = x.id + '|' + t; if (vistos[chave]) return; vistos[chave] = 1;
        out.push({x: x, ant: ant, t: t, casa: casa, d: d, r0: r0, r1: r1, p0: p0, p1: p1, mudRec: mudRec, mudAlvo: mudAlvo, mudSent: mudSent, soTitulo: titulo,
          vip: (x.ativos_vip || []).indexOf(t) >= 0});
      });
    });
    return out.sort(function (a, b) { return b.d.localeCompare(a.d) || a.t.localeCompare(b.t); });
  };
  function seta(a, b) { return a != null && b != null ? (b > a ? '▲' : b < a ? '▼' : '') : ''; }
  function linhaMud(o) {
    var de = o.ant ? [o.r0, o.p0 != null ? 'R$ ' + A.num(o.p0, 2) : null].filter(Boolean).join(' · ') || (o.ant.posicao ? I.POSICAO[o.ant.posicao] : '—') : '—';
    var para = [o.r1, o.p1 != null ? 'R$ ' + A.num(o.p1, 2) : null].filter(Boolean).join(' · ') || (o.x.posicao ? I.POSICAO[o.x.posicao] : '—');
    if (o.mudSent) { de += ' · ' + I.POSICAO[o.ant.posicao]; para += ' · ' + I.POSICAO[o.x.posicao]; }  // só o sentido mudou: mostra o sentido dos dois lados
    return h('tr', null, h('td', {class: 'num'}, A.dataBR(o.d).slice(0, 5)), h('td', null, h('button', {class: 'tag tk', onclick: function () { A.abrirFicha(o.t); }}, o.t), o.vip ? h('span', {class: 'chip vip'}, 'VIP') : null),
      h('td', null, o.casa), h('td', {class: 'rm-de'}, de), h('td', {class: 'rm-para'}, h('b', null, para), ' ', h('span', {class: o.p1 > o.p0 ? 'up' : 'down'}, seta(o.p0, o.p1)),
        o.soTitulo ? h('small', {class: 'muted', title: 'Visão anterior desta casa não está no acervo; a mudança está escrita na manchete'}, ' (título)') : null),
      h('td', null, h('button', {class: 'nwl', onclick: function () { A.abrirItem(o.x); }}, o.x.titulo)));
  }
  function paginaRecomendacoes() {
    var hoje = I.hojeBRT(), P = A.REC = A.REC || {dias: 30};
    var de = new Date(Date.now() - P.dias * 864e5).toISOString().slice(0, 10), l = A.mudancasRecomendacao(de, hoje);
    var wrap = h('div', null, A.pageHead('Brasil', 'Mudanças de recomendação', 'Quando uma casa muda a recomendação, o preço-alvo ou o sentido da opinião sobre um ativo das carteiras (Oregon e VG VIP), comparado com a visão anterior da mesma casa no acervo de 12 meses. Recomendação e preço-alvo só como escritos; nenhuma média ou consenso é calculado.'));
    wrap.appendChild(h('div', {class: 'sub filt', role: 'toolbar', 'aria-label': 'Período'}, [[7, '7 dias'], [30, '30 dias'], [90, '90 dias']].map(function (o) { return h('button', {'aria-pressed': P.dias === o[0] ? 'true' : 'false', onclick: function () { P.dias = o[0]; A.rerender(); }}, o[1]); })));
    var rec = l.filter(function (o) { return o.mudRec; }).length, alv = l.filter(function (o) { return o.mudAlvo; }).length;
    wrap.appendChild(h('p', {class: 'muted'}, l.length ? l.length + (l.length > 1 ? ' mudanças' : ' mudança') + ' em ' + P.dias + ' dias · ' + rec + ' de recomendação · ' + alv + ' de preço-alvo' : 'Nenhuma mudança de recomendação, preço-alvo ou sentido nas opiniões coletadas nos últimos ' + P.dias + ' dias.'));
    if (l.length) wrap.appendChild(h('div', {class: 'tw'}, h('table', {class: 't rm-t'}, h('thead', null, h('tr', null, ['Data', 'Ativo', 'Casa', 'Antes', 'Agora', 'Publicação'].map(function (x) { return h('th', null, x); }))), h('tbody', null, l.slice(0, 150).map(linhaMud)))));
    wrap.appendChild(h('p', {class: 'hint'}, '"(título)": a casa não tem visão anterior no acervo, mas a manchete diz que ela mudou ("eleva para compra", "rebaixa"). Abra a publicação para conferir.'));
    return wrap;
  }

  /* ---------- fechamento da semana ---------- */
  function semanaDe(off) {
    var d = new Date(I.hojeBRT() + 'T12:00:00Z'), w = d.getUTCDay() || 7, seg = new Date(d.getTime() - (w - 1) * 864e5 - off * 7 * 864e5);
    return {de: seg.toISOString().slice(0, 10), ate: new Date(seg.getTime() + 6 * 864e5).toISOString().slice(0, 10)};
  }
  A.fechamentoSemana = function (off) {
    var s = semanaDe(off || 0), todos = (A.itensAtivo ? A.itensAtivo() : []).filter(function (x) { var d = I.pub(x).slice(0, 10); return !x.acervo && !x.agrupado_em && d >= s.de && d <= s.ate && !I.baixaRelevancia(x) && !(I.grupoXP && I.grupoXP(x)); });
    function ord(l) { return l.sort(function (a, b) { return I.pub(b).localeCompare(I.pub(a)); }); }
    var emp = function (x) { return I.diretos(x).length || (x.ativos_vip || []).length; };
    var fatos = ord(todos.filter(function (x) { var k = I.marca(x).k; return emp(x) && (k === 'fato' || k === 'resultado'); }));
    var eventos = ord(todos.filter(function (x) { return I.eventosDe(x).length; }));
    var ops = ord(todos.filter(function (x) { return x.natureza === 'opiniao_casa' && emp(x); }));
    var mud = A.mudancasRecomendacao(s.de, s.ate);
    var pv = A.arquivo('biblioteca/proventos.json'), anunc = [];
    if (pv.dados) Object.keys(pv.dados.ativos || {}).forEach(function (t) { (pv.dados.ativos[t].eventos || []).forEach(function (e) { if (e.aprovado && e.aprovado >= s.de && e.aprovado <= s.ate) anunc.push(Object.assign({t: t}, e)); }); });
    var ca = A.arquivo('biblioteca/cartas_mencoes.json'), cartas = [];
    if (ca.dados) (ca.dados.meses || []).forEach(function (m) { (m.cartas || []).forEach(function (c) { if (c.data && c.data >= s.de && c.data <= s.ate) { var cit = (m.empresas || []).filter(function (e) { return e.carteira && (e.cartas || []).indexOf(c.id) >= 0; }).map(function (e) { return e.t; }); cartas.push(Object.assign({cit: cit}, c)); } }); });
    var res = ord(todos.filter(function (x) { return I.marca(x).k === 'research' || I.marca(x).k === 'carta'; })).sort(function (a, b) { return ((b.tambem_em || []).length - (a.tambem_em || []).length) || I.pub(b).localeCompare(I.pub(a)); });
    var com = (typeof STORE !== 'undefined' ? STORE.list('comite') : []).filter(function (r) { var q = String(r.quando || '').slice(0, 10); return q >= s.de && q <= s.ate; });
    var fl = A.fluxoSemana ? A.fluxoSemana(s.de) : null;  // v3.8 · fluxo dos fundos na semana (CVM)
    return {s: s, fatos: fatos, eventos: eventos, ops: ops, mud: mud, anunc: anunc, cartas: cartas, res: res, com: com, fluxo: fl};
  };
  function textoFechamento(f) {
    var L = ['Fechamento da semana · ' + A.dataBR(f.s.de) + ' a ' + A.dataBR(f.s.ate), ''];
    function bloco(t, l, fn) { if (!l.length) return; L.push(t); l.forEach(function (o) { L.push('- ' + fn(o)); }); L.push(''); }
    bloco('Fatos e resultados das empresas', f.fatos.slice(0, 15), function (x) { return A.dataBR(I.pub(x)).slice(0, 5) + ' ' + (I.diretos(x).concat(x.ativos_vip || []).slice(0, 2).join(', ')) + ': ' + x.titulo + ' (' + A.orgDe(x) + ')'; });
    bloco('Eventos corporativos', f.eventos.slice(0, 12), function (x) { return I.eventosDe(x).map(I.eventoNome).join(', ') + ': ' + x.titulo; });
    bloco('Mudanças de recomendação', f.mud, function (o) { return o.t + ' · ' + o.casa + ': ' + [o.r0, o.p0 != null ? 'R$ ' + A.num(o.p0, 2) : null].filter(Boolean).join(' ') + ' → ' + [o.r1, o.p1 != null ? 'R$ ' + A.num(o.p1, 2) : null].filter(Boolean).join(' '); });
    bloco('Opiniões publicadas', f.ops.slice(0, 12), function (x) { return (x.casas || []).join(', ') + ': ' + x.titulo; });
    bloco('Proventos anunciados', f.anunc, function (e) { return e.t + ' · ' + (e.tipo || '') + ' R$ ' + A.num(e.valor, 4) + ' · data-com ' + A.dataBR(e.data_com) + ' · paga ' + A.dataBR(e.pagamento); });
    bloco('Cartas das gestoras', f.cartas, function (c) { return c.gestora + ' · ' + c.titulo + (c.cit.length ? ' · cita ' + c.cit.join(', ') : ''); });
    bloco('Fluxo dos fundos (CVM)', f.fluxo ? [f.fluxo] : [], function (o) { return A.fluxoLinha(o); });
    bloco('Research e estudos', f.res.slice(0, 8), function (x) { return x.titulo + ' (' + A.orgDe(x) + ')'; });
    bloco('Levado ao comitê', f.com, function (r) { return r.titulo + (r.nota ? ' · ' + r.nota : ''); });
    return L.join('\n');
  }
  function paginaFechamento() {
    var P = A.FS = A.FS || {off: 0}, f = A.fechamentoSemana(P.off);
    var wrap = h('div', {class: 'fs'}, A.pageHead('Carteiras', 'Fechamento da semana · ' + A.dataBR(f.s.de).slice(0, 5) + ' a ' + A.dataBR(f.s.ate),
      'O que aconteceu na semana com as empresas das carteiras (Oregon e VG VIP) e no research: fatos e resultados, eventos corporativos, mudanças de recomendação, opiniões, proventos anunciados, cartas das gestoras, fluxo dos fundos e o que foi levado ao comitê. Só o que foi publicado; nada de conclusão.',
      h('div', {class: 'row no-print', style: 'gap:6px;flex-wrap:wrap'},
        h('select', {class: 'inp', 'aria-label': 'Semana', onchange: function (ev) { P.off = +ev.target.value; A.rerender(); }}, [0, 1, 2, 3].map(function (o) { var s = semanaDe(o); return h('option', {value: o, selected: P.off === o || null}, (o ? '' : 'Esta semana · ') + A.dataBR(s.de).slice(0, 5) + ' a ' + A.dataBR(s.ate).slice(0, 5)); })),
        h('button', {class: 'btn sm', onclick: function () { var t = textoFechamento(f); try { navigator.clipboard.writeText(t).then(function () { A.toast('Fechamento copiado.'); }, function () { A.toast('Não consegui copiar; use Imprimir.'); }); } catch (e) { A.toast('Não consegui copiar; use Imprimir.'); } }}, 'Copiar'),
        A.btnImprimir())));
    function sec(t, n, corpo, vz) { wrap.appendChild(A.sec(t, {badge: h('span', {class: 'sec-n'}, String(n))}, n ? corpo : h('p', {class: 'muted hx-vz'}, vz))); }
    sec('Fatos e resultados das empresas', f.fatos.length, A.listaRows(f.fatos.slice(0, 20), {abrir: true}), 'Nenhum documento à CVM ou resultado das empresas das carteiras nesta semana.');
    sec('Eventos corporativos', f.eventos.length, A.listaRows(f.eventos.slice(0, 15), {abrir: true}), 'Nenhuma recompra, aquisição, guidance, troca na gestão, emissão de dívida ou oferta de ações nas manchetes da semana.');
    sec('Mudanças de recomendação', f.mud.length, h('div', {class: 'tw'}, h('table', {class: 't rm-t'}, h('thead', null, h('tr', null, ['Data', 'Ativo', 'Casa', 'Antes', 'Agora', 'Publicação'].map(function (x) { return h('th', null, x); }))), h('tbody', null, f.mud.map(linhaMud)))), 'Nenhuma mudança de recomendação ou preço-alvo nas opiniões coletadas.');
    var fav = f.ops.filter(function (x) { return x.posicao === 'favoravel'; }).length, con = f.ops.filter(function (x) { return x.posicao === 'contraria'; }).length;
    sec('Opiniões publicadas', f.ops.length, h('div', null, h('p', {class: 'deb-h'}, h('span', {class: 'pol p-favoravel'}, fav + ' a favor'), h('span', {class: 'pol p-contraria'}, con + ' contra'), h('span', {class: 'pol'}, (f.ops.length - fav - con) + ' neutras ou sem sentido no título')), A.listaRows(f.ops.slice(0, 15), {abrir: true})), 'Nenhuma opinião de casa sobre as empresas das carteiras.');
    sec('Proventos anunciados', f.anunc.length, h('ul', {class: 'lst'}, f.anunc.map(function (e) { return h('li', null, h('button', {class: 'tag tk', onclick: function () { A.abrirFicha(e.t); }}, e.t), ' ' + (e.tipo || '') + ' · R$ ' + A.num(e.valor, 4) + ' por ação · data-com ' + A.dataBR(e.data_com) + ' · paga ' + A.dataBR(e.pagamento)); })), 'Nenhum provento aprovado na semana pelas empresas acompanhadas (B3).');
    sec('Cartas das gestoras', f.cartas.length, h('ul', {class: 'lst'}, f.cartas.map(function (c) { return h('li', null, h('b', null, c.gestora), ' · ', c.link ? h('a', {href: c.link, target: '_blank', rel: 'noopener'}, c.titulo) : c.titulo, c.cit.length ? h('span', {class: 'muted'}, ' · cita ' + c.cit.join(', ')) : null); })), 'Nenhuma carta de gestora brasileira com data nesta semana.');
    sec('Fluxo dos fundos', f.fluxo ? 1 : 0, f.fluxo ? h('p', null, A.fluxoLinha(f.fluxo), ' ', h('button', {class: 'btn link no-print', onclick: function () { A.go('brasil', 'fluxo'); }}, 'Semana a semana ↗')) : null, 'Fluxo da semana ainda não lido da CVM (o robô lê o informe diário uma vez por dia).');
    sec('Research e estudos', f.res.length, A.listaRows(f.res.slice(0, 10), {abrir: true, dias: false}), 'Nada de research nesta semana.');
    sec('Levado ao comitê', f.com.length, h('ul', {class: 'lst'}, f.com.map(function (r) { return h('li', null, r.link ? h('a', {href: r.link, target: '_blank', rel: 'noopener'}, r.titulo) : h('b', null, r.titulo), r.nota ? h('span', {class: 'muted'}, ' · ' + r.nota) : null); })), 'Nada levado ao comitê nesta semana.');
    return wrap;
  }

  /* ---------- rotas novas ---------- */
  if (A.SUBS.brasil) A.SUBS.brasil.push(['recomendacoes', 'Mudanças de recomendação']);
  if (A.SUBS.cart) A.SUBS.cart.push(['semana', 'Fechamento da semana']);
  var brasil0 = A.areas.brasil, cart0 = A.areas.cart;
  A.areas.brasil = function () { if (A.S.sub.brasil === 'recomendacoes') return h('div', null, A.subnav('brasil', A.SUBS.brasil, 'recomendacoes'), paginaRecomendacoes()); return brasil0.apply(this, arguments); };
  A.areas.cart = function () {
    if (A.S.sub.cart !== 'semana') return cart0.apply(this, arguments);
    return h('div', null, h('div', {class: 'sub sub2', role: 'toolbar', 'aria-label': 'Carteiras'}, A.SUBS.cart.map(function (it) { return h('button', {'aria-pressed': it[0] === 'semana' ? 'true' : 'false', onclick: function () { A.go('cart', it[0]); }}, it[1]); })), paginaFechamento());
  };
  var ctx0 = A.mostraCtx; if (ctx0) A.mostraCtx = function () { return A.S.area === 'cart' && A.S.sub.cart === 'semana' ? false : ctx0.apply(this, arguments); };
})(APP, CORE, INTEL);
