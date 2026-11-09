/* v3.10 · MERCADO HOJE · BRASIL (pedido do Lucas em 09/11/2026: "está faltando notícia macro do Brasil").
   O robô já coletava; faltava mostrar. Bloco no Hoje, logo depois do mapa de atenção, em todos os modos (inclusive Rápida):
   agenda do dia primeiro, depois juros, inflação, câmbio, bolsa, fiscal e atividade das últimas 18 horas, sem repetir o
   mesmo fato. A marcação (x.macro_br) é do robô (robo/analise.py: MACRO_BR), pela manchete; nada é inventado aqui.
   InfoMoney (Grupo XP) aparece com o aviso da fonte e nunca vai para pauta, fechamento ou comitê. */
(function (A, C, I) {
  'use strict';
  var h = A.h;
  var NOMES = {}; ((typeof TAXON !== 'undefined' && TAXON.macro_br) || []).forEach(function (o) { NOMES[o[0]] = o[1]; });
  var ORDEM = ((typeof TAXON !== 'undefined' && TAXON.macro_br) || []).map(function (o) { return o[0]; });
  var MAXP = {rapida: 5, briefing: 8, aprofundada: 15};
  var MH = {f: null, extra: 0};
  I.MACRO_NOMES = NOMES;
  function ts(x) { var p = I.pub(x); return Date.parse(p.length <= 10 ? p + 'T12:00:00-03:00' : p) || 0; }

  // as manchetes de macro do Brasil da janela: um item por fato, agenda do dia separada
  A.mercadoHoje = function (horas) {
    var itens = A.itens ? A.itens() : [], hs = horas || 18;
    var l = I.ultimas(itens, {horas: hs, filtro: 'macro'});
    if (l.length < 4 && !horas) { hs = 36; l = I.ultimas(itens, {horas: hs, filtro: 'macro'}); }
    l = I.agruparFatos(l, hs).map(function (g) { return g.x; }).sort(function (a, b) { return ts(b) - ts(a); });
    var hoje = I.hojeBRT();
    var agenda = l.filter(function (x) { return I.macroBR(x).indexOf('agenda') >= 0 && I.pub(x).slice(0, 10) === hoje && !I.desconhecido(x); }).slice(0, 2);
    var cont = {}; l.forEach(function (x) { I.macroBR(x).forEach(function (k) { cont[k] = (cont[k] || 0) + 1; }); });
    return {horas: hs, todos: l, agenda: agenda, cont: cont};
  };
  // o assunto de cada linha já aparece nas marcas de tema da própria linha; os botões do alto filtram por assunto
  function bloco(prof) {
    var d = A.mercadoHoje(), mx = (MAXP[prof] || 8) + MH.extra;
    if (MH.f && !d.cont[MH.f]) MH.f = null;
    var base = d.todos.filter(function (x) { return !MH.f || I.macroBR(x).indexOf(MH.f) >= 0; });
    var conhecidos = base.filter(function (x) { return !I.desconhecido(x) && d.agenda.indexOf(x) < 0; });
    var pouco = base.filter(function (x) { return I.desconhecido(x); });
    var chips = Object.keys(d.cont).length ? h('div', {class: 'sub filt mb-f', role: 'toolbar', 'aria-label': 'Assunto'}, ORDEM.filter(function (k) { return d.cont[k]; }).map(function (k) {
      return h('button', {'aria-pressed': MH.f === k ? 'true' : 'false', onclick: function () { MH.f = MH.f === k ? null : k; MH.extra = 0; A.rerender(); }}, NOMES[k] || k, h('small', null, String(d.cont[k])));
    })) : null;
    var corpo = d.todos.length ? h('div', null, chips,
      d.agenda.length && !MH.f ? [h('h3', {class: 'nr-h'}, 'Para começar o dia'), A.listaRows(d.agenda, {dias: false, agrupar: false})] : null,
      conhecidos.length ? [d.agenda.length && !MH.f ? h('h3', {class: 'nr-h'}, 'Mais recentes') : null, A.listaRows(conhecidos, {max: mx, dias: false, agrupar: false}),
        conhecidos.length > mx ? h('p', {class: 'mais'}, h('button', {class: 'btn sm', onclick: function () { MH.extra += 10; A.rerender(); }}, 'Mostrar mais ' + Math.min(10, conhecidos.length - mx))) : null]
        : (d.agenda.length && !MH.f ? null : h('p', {class: 'empty sm'}, 'Nada deste assunto nas ' + (d.horas >= 48 ? 'últimas ' + Math.round(d.horas / 24) + ' dias' : 'últimas ' + d.horas + ' h') + '.')),
      pouco.length ? A.more('Mostrar ' + pouco.length + ' de veículos pouco conhecidos', A.listaRows(pouco, {max: 15, dias: false, agrupar: false})) : null)
      : h('p', {class: 'empty sm'}, A.intel && A.intel.versao ? 'Nenhuma manchete de macro do Brasil nas últimas 36 h. Ela chega na próxima coleta.' : 'Buscando as notícias…');
    var dica = h('p', {class: 'hint sh mb-h'}, 'Juros, inflação, câmbio, bolsa, fiscal, atividade e a agenda do dia no Brasil, pela manchete. O mesmo fato em vários veículos aparece uma vez. O mundo continua em Mundo e Estratégia.');
    var cab = h('header', null, h('h2', {id: 'mercado-hoje-t'}, 'Mercado hoje · Brasil', A.qBtn ? A.qBtn(dica) : null), h('span', {class: 'ar-n'}, (d.horas >= 48 ? Math.round(d.horas / 24) + ' dias' : d.horas + ' h') + (d.todos.length ? ' · ' + d.todos.length : '')));
    var sec = h('section', {class: 'ar a-macro', id: 'mercado-hoje', 'aria-labelledby': 'mercado-hoje-t'}, cab, dica, h('div', {class: 'ar-b'}, corpo));
    return A.recolhivel ? A.recolhivel(sec, 'mercado-hoje', cab) : sec;
  }
  // InfoMoney (Grupo XP): marca escrita em toda linha de notícia, além do "!" da fonte sinalizada
  var row0 = A.itemRow;
  if (row0) A.itemRow = function (x) {
    var r = row0.apply(this, arguments);
    if (I.grupoXP && I.grupoXP(x)) { var bt = r.querySelector && r.querySelector('.nr-tt .nr-t'); if (bt) bt.insertAdjacentElement('afterend', h('span', {class: 'xp-b', title: (x.aviso_fonte || 'Grupo XP') + '. Fica fora da pauta da semana, do fechamento, das sugestões do comitê e do Telegram.'}, 'Grupo XP')); }
    return r;
  };
  // no celular, o bloco começa aberto (as outras áreas, além do Radar, começam fechadas)
  try { if (A.lsGet && A.lsGet('area-mercado-hoje', null) === null && A.lsSet) A.lsSet('area-mercado-hoje', true); } catch (e) {}

  var hoje0 = A.areas.hoje;
  A.areas.hoje = function () {
    var w = hoje0.apply(this, arguments);
    if (!w || !w.querySelector) return w;
    var b = bloco(A.prof ? A.prof() : 'briefing'), atn = w.querySelector('#atencao'), mesa = w.querySelector('.mesa');
    if (atn) atn.insertAdjacentElement('afterend', b); else if (mesa) mesa.insertAdjacentElement('beforebegin', b); else w.appendChild(b);
    var nav = w.querySelector('nav.sumario'), lab = nav && nav.querySelector('.muted');
    if (lab) lab.insertAdjacentElement('afterend', h('a', {href: '#mercado-hoje', onclick: function (ev) { var el = document.getElementById('mercado-hoje'); if (el) { ev.preventDefault(); el.scrollIntoView({behavior: 'smooth', block: 'start'}); } }}, 'Mercado hoje'));
    return w;
  };
})(APP, CORE, INTEL);
