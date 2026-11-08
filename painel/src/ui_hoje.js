/* HOJE — o que saiu agora: últimas notícias com hora (portais brasileiros, imprensa internacional, bancos centrais),
   o que tocou os ativos da carteira, opiniões de casas de análise, agenda, leituras do dia (cartas e research) e estudo. */
(function (A, C, I) {
  'use strict';
  var h = A.h;
  var F = {filtro: 'tudo', max: 15};
  function E() { return A.intel; }
  function resolver(refs) {
    var out = [], faltam = {};
    (refs || []).forEach(function (r) { var x = A.itemPorId(r.id); if (x) out.push(x); else if (r.mes) faltam[r.mes] = 1; });
    Object.keys(faltam).forEach(function (m) { if (!E().meses[m]) A.carregarMes(m); });
    return out;
  }
  var FILTROS = [['tudo', 'Tudo'], ['carteira', 'Na carteira'], ['brasil', 'Brasil'], ['mundo', 'Mundo'], ['casas', 'Opiniões'], ['oficial', 'Oficiais (CVM, BCs)']];

  A.areas.hoje = function () {
    var e = E(), wrap = h('div'), hj = e.hoje, itens = A.itens();
    var hoje = I.hojeBRT(), d = new Date(hoje + 'T12:00:00Z'), dia = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d.getUTCDay()];
    var v = e.versao, u = e.coleta && e.coleta.ultima, n24 = I.ultimas(itens, {horas: 24}).length;
    wrap.appendChild(A.pageHead('Oregon Intelligence', 'Hoje, ' + dia + ' ' + A.dataBR(hoje).slice(0, 5),
      v ? h('span', {class: 'status-l'}, 'Última coleta concluída ', h('b', null, I.quando({publicado_em: v.gerado_em})), ' · ', h('b', null, String(n24)), ' notícias nas últimas 24 h',
        u ? [' · ', u.fontes_erro ? h('button', {class: 'btn link', onclick: function () { A.go('bib', 'fontes'); }}, u.fontes_erro + (u.fontes_erro > 1 ? ' fontes com erro' : ' fonte com erro')) : 'nenhuma fonte com erro'] : null,
        '. O robô lê a cada 30 minutos (7h às 22h30); esta página se atualiza sozinha.') : 'Buscando os dados do robô…',
      h('button', {class: 'btn', onclick: function () { A.intelAtualizar(); }}, e.carregando ? 'Atualizando…' : 'Atualizar agora')));
    var fx = A.intelFaixa(); if (fx) wrap.appendChild(fx);

    var g = h('div', {class: 'hoje-grid'}), L = h('div', {class: 'hoje-main'}), R = h('div', {class: 'hoje-side'}); g.append(L, R); wrap.appendChild(g);

    // 1. Últimas notícias
    var horas = 36, ult = I.ultimas(itens, {horas: horas, filtro: F.filtro});
    if (ult.length < 8 && F.filtro === 'tudo') { horas = 96; ult = I.ultimas(itens, {horas: horas, filtro: F.filtro}); }
    var cont = {}; FILTROS.forEach(function (f) { cont[f[0]] = I.ultimas(itens, {horas: horas, filtro: f[0]}).length; });
    var barra = h('div', {class: 'sub filt', role: 'toolbar', 'aria-label': 'Filtrar notícias'}, FILTROS.map(function (f) {
      return h('button', {'aria-pressed': F.filtro === f[0] ? 'true' : 'false', disabled: !cont[f[0]] && f[0] !== 'tudo' ? true : null, onclick: function () { F.filtro = f[0]; F.max = 15; A.rerender(); }}, f[1] + (cont[f[0]] ? ' · ' + cont[f[0]] : ''));
    }));
    L.appendChild(A.sec('Últimas notícias', {id: 'ultimas', hint: 'Portais brasileiros e internacionais e bancos centrais, nas últimas ' + horas + ' horas, da mais nova para a mais antiga. Toque no título para a análise; ↗ abre a matéria original.'},
      h('div', null, barra, ult.length ? h('div', null, A.listaItens(ult, {max: F.max, semResumo: true}), ult.length > F.max ? h('p', {style: 'text-align:center;margin:8px 0 0'}, h('button', {class: 'btn', onclick: function () { F.max += 20; A.rerender(); }}, 'Mostrar mais ' + Math.min(20, ult.length - F.max))) : null)
        : h('p', {class: 'empty'}, e.carregando ? 'Buscando as notícias…' : (itens.length ? 'Nada com este filtro nas últimas ' + horas + ' horas.' : 'O robô ainda não publicou notícias.')))));

    // 2. Leituras do dia (cartas, research, documentos oficiais) com análise em sete pontos
    var prior = hj ? resolver(hj.prioridades) : [];
    if (prior.length) L.appendChild(A.sec('Leituras do dia', {id: 'prioridades', hint: 'Cartas de gestores, research e documentos oficiais publicados nos últimos dias, no máximo dois por fonte. Para ler com calma, não para reagir.'}, A.listaItens(prior, {semResumo: false, comNivel: true})));
    var leit = hj && hj.leitura ? resolver([hj.leitura])[0] : null;
    if (leit) L.appendChild(A.sec('Leitura recomendada', {id: 'leitura', hint: 'Uma carta ou pesquisa original dos últimos 30 dias, sem repetir a recomendação anterior.'}, A.itemCard(leit)));

    // Coluna lateral: carteira, agenda e estudo
    var pa = I.porAtivo(itens, {horas: 72});
    if (pa.length) R.appendChild(A.sec('Na carteira', {id: 'na-carteira', hint: 'Ativos das carteiras citados em notícias nas últimas 72 horas. Toque para a ficha.'},
      h('ul', {class: 'pa'}, pa.slice(0, 14).map(function (r) {
        var a = C.ATV[r.t] || {};
        return h('li', null, h('button', {class: 'pa-b', onclick: function () { A.abrirFicha(r.t); }}, h('b', {class: 'tk'}, r.t), h('span', {class: 'pa-n'}, r.n + (r.n > 1 ? ' notícias' : ' notícia') + (r.casas ? ' · ' + r.casas + ' opinião' + (r.casas > 1 ? 'ões' : '') : '')),
          h('span', {class: 'pa-u'}, I.quando(r.ultimo) + ' · ' + (r.ultimo.titulo.length > 70 ? r.ultimo.titulo.slice(0, 68) + '…' : r.ultimo.titulo)), a.nome ? h('span', {class: 'muted pa-nome'}, a.nome) : null));
      }))));
    R.appendChild(A.sec('Agenda', {id: 'agenda', hint: 'Divulgações oficiais dos próximos 30 dias (IBGE, Copom, Fed, Focus).'}, A.agendaView(8)));
    if (hj && (hj.estudo || []).length) R.appendChild(A.sec('Estudo do dia', {id: 'estudo', hint: 'Perguntas ligadas aos temas das leituras do dia. Responder por escrito fixa o aprendizado.'},
      h('ol', {class: 'estudo'}, hj.estudo.map(function (q) { return h('li', null, q, ' ', h('button', {class: 'btn link', onclick: function () { A.drawer('Estudo do dia', h('div', null, h('p', {class: 'tv-lead'}, q), A.formAprendizado(null, {tipo: 'duvida', titulo: q, fonte: 'Estudo do dia', temas: hj.temas || []}))); }}, 'responder')); }))));
    return wrap;
  };
})(APP, CORE, INTEL);
