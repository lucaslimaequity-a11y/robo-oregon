/* HOJE — primeira dobra: data, hora da última coleta, busca (no topo) e os destaques com filtros (Na carteira, Brasil,
   Mundo, Gestoras e casas, RI e CVM). Ao lado: ativos das carteiras com notícia direta e a agenda oficial (recolhida).
   Abaixo da dobra: as demais notícias, as leituras do dia (cartas e research), a leitura recomendada e o estudo do dia. */
(function (A, C, I) {
  'use strict';
  var h = A.h;
  var F = {filtro: 'tudo', max: 12};
  function E() { return A.intel; }
  function resolver(refs) {
    var out = [], faltam = {};
    (refs || []).forEach(function (r) { var x = A.itemPorId(r.id); if (x) out.push(x); else if (r.mes) faltam[r.mes] = 1; });
    Object.keys(faltam).forEach(function (m) { if (!E().meses[m]) A.carregarMes(m); });
    return out;
  }
  // [id, rótulo, janela em horas]. Cartas, research e documentos da CVM saem com menos frequência: janela de 7 dias.
  var FILTROS = [['tudo', 'Tudo', 36], ['carteira', 'Na carteira', 72], ['brasil', 'Brasil', 36], ['mundo', 'Mundo', 36], ['gestoras', 'Gestoras e casas', 168], ['ri', 'RI e CVM', 168]];
  var DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  function janelaTxt(hs) { return hs >= 48 ? 'últimos ' + Math.round(hs / 24) + ' dias' : 'últimas ' + hs + ' h'; }

  A.areas.hoje = function () {
    var e = E(), wrap = h('div', {class: 'hoje'}), hj = e.hoje, itens = A.itens();
    var hoje = I.hojeBRT(), d = new Date(hoje + 'T12:00:00Z'), dia = DIAS[d.getUTCDay()];
    var v = e.versao, u = e.coleta && e.coleta.ultima, n24 = I.ultimas(itens, {horas: 24}).length;
    var status = v ? h('p', {class: 'status-l', title: 'O robô lê as fontes a cada 30 minutos, das 7h às 22h30; esta página se atualiza sozinha. A hora de cada notícia é a de publicação na fonte.'},
      'Última coleta concluída ', h('b', null, I.horaAbs(v.gerado_em)), h('span', {class: 'muted'}, ' (' + I.quando({publicado_em: v.gerado_em}) + ')'), ' · ', h('b', null, String(n24)), ' notícias nas últimas 24 h',
      u ? [' · ', u.fontes_erro ? h('button', {class: 'btn link', onclick: function () { A.go('bib', 'fontes'); }}, u.fontes_erro + (u.fontes_erro > 1 ? ' fontes com erro' : ' fonte com erro')) : 'nenhuma fonte com erro'] : null)
      : h('p', {class: 'status-l'}, e.carregando ? 'Buscando os dados do robô…' : 'Sem dados do robô nesta visualização.');
    wrap.appendChild(h('div', {class: 'page-h hoje-h'}, h('div', {class: 'grow'}, h('h1', null, 'Hoje, ' + dia + ' ' + A.dataBR(hoje).slice(0, 5)), status),
      h('button', {class: 'btn sm', title: 'Busca agora o que o robô já publicou', onclick: function () { A.intelAtualizar(); }}, e.carregando ? 'Atualizando…' : 'Atualizar')));
    var fx = A.intelFaixa(); if (fx) wrap.appendChild(fx);

    var g = h('div', {class: 'hoje-grid'}), feed = h('div', {class: 'hoje-feed'}), side = h('aside', {class: 'hoje-side'}), below = h('div', {class: 'hoje-below'});
    g.append(feed, side, below); wrap.appendChild(g);

    // 1. Notícias: cinco destaques (prioridade do robô) e, abaixo, as demais em ordem de publicação
    var f = FILTROS.filter(function (x) { return x[0] === F.filtro; })[0] || FILTROS[0], horas = f[2];
    var ult = I.ultimas(itens, {horas: horas, filtro: f[0]});
    if (ult.length < 8 && f[0] === 'tudo' && itens.length) { horas = 96; ult = I.ultimas(itens, {horas: horas, filtro: 'tudo'}); }
    var cont = {}; FILTROS.forEach(function (x) { cont[x[0]] = I.ultimas(itens, {horas: x[0] === 'tudo' ? horas : x[2], filtro: x[0]}).length; });
    var barra = h('div', {class: 'sub filt', role: 'toolbar', 'aria-label': 'Filtrar notícias'}, FILTROS.map(function (x) {
      return h('button', {'aria-pressed': F.filtro === x[0] ? 'true' : 'false', disabled: !cont[x[0]] && x[0] !== 'tudo' ? true : null, title: x[0] === 'carteira' ? 'Notícias em que um ativo das carteiras é o assunto (menções de passagem ficam de fora)' : null,
        onclick: function () { F.filtro = x[0]; F.max = 12; A.rerender(); }}, x[1], cont[x[0]] ? h('small', null, String(cont[x[0]])) : null);
    }));
    var dest = I.destaques(ult, 5), resto = ult.filter(function (x) { return dest.indexOf(x) < 0; });
    var corpo = ult.length ? [h('h3', {class: 'nr-h'}, 'Em destaque'), A.listaRows(dest),
      resto.length ? [h('h3', {class: 'nr-h'}, 'Mais recentes'), A.listaRows(resto, {max: F.max}),
        resto.length > F.max ? h('p', {class: 'mais'}, h('button', {class: 'btn sm', onclick: function () { F.max += 20; A.rerender(); }}, 'Mostrar mais ' + Math.min(20, resto.length - F.max))) : null] : null]
      : h('p', {class: 'empty'}, e.carregando ? 'Buscando as notícias…' : (itens.length ? 'Nada com este filtro nos ' + janelaTxt(horas) + '.' : e.versao ? 'O robô ainda não publicou notícias.' : 'Sem dados do robô: as notícias aparecem quando os arquivos publicados puderem ser lidos.'));
    feed.appendChild(A.sec('Últimas notícias', {id: 'ultimas', badge: h('span', {class: 'sec-n'}, janelaTxt(horas))}, h('div', null, barra, corpo)));

    // 2. Coluna lateral: ativos das carteiras com notícia direta (menção de passagem não conta) e agenda oficial recolhida
    var pa = I.porAtivo(itens, {horas: 72});
    side.appendChild(A.sec('Na carteira', {id: 'na-carteira', badge: h('span', {class: 'sec-n'}, '72 h')}, pa.length ? h('div', null, h('ul', {class: 'pa'}, pa.slice(0, 12).map(function (r) {
      var a = C.ATV[r.t] || {};
      return h('li', null, h('button', {class: 'pa-b', onclick: function () { A.abrirFicha(r.t); }}, h('b', {class: 'tk'}, r.t), h('span', {class: 'pa-n'}, r.n + (r.n > 1 ? ' diretas' : ' direta') + (r.casas ? ' · ' + r.casas + ' opinião' + (r.casas > 1 ? 'ões' : '') : '') + ' · ' + I.quando(r.ultimo)),
        h('span', {class: 'pa-u'}, r.ultimo.titulo.length > 92 ? r.ultimo.titulo.slice(0, 90) + '…' : r.ultimo.titulo), a.nome ? h('span', {class: 'muted pa-nome'}, a.nome) : null));
    })), pa.soMencao.length ? h('p', {class: 'pa-men', title: 'Citados em manchetes que enumeram várias empresas (dividendos da semana, destaques do dia) ou só no resumo'}, 'Só de passagem: ', pa.soMencao.map(function (r, i) { return h('span', null, i ? ', ' : '', h('button', {class: 'btn link', onclick: function () { A.abrirFicha(r.t); }}, r.t)); })) : null)
      : h('p', {class: 'empty sm'}, e.carregando ? 'Buscando…' : itens.length ? 'Nenhum ativo das carteiras foi assunto de notícia nas últimas 72 h.' : 'Sem dados do robô.')));
    var ag = A.agendaView(8), nAg = ag.querySelectorAll ? ag.querySelectorAll('li').length : 0;
    side.appendChild(h('details', {class: 'sec sec-d', id: 'agenda'}, h('summary', null, h('h2', null, 'Agenda oficial'), h('span', {class: 'sec-n'}, nAg ? nAg + ' nos próximos 30 dias' : '30 dias')), h('div', {class: 'body'}, ag)));

    // 3. Abaixo da dobra: leituras do dia (cartas, research, documentos oficiais), leitura recomendada e estudo
    var prior = hj ? resolver(hj.prioridades) : [];
    if (prior.length) below.appendChild(A.sec('Leituras do dia', {id: 'prioridades', hint: 'Cartas de gestoras, research e documentos oficiais recentes; até dois por fonte.'}, A.listaItens(prior, {semResumo: false, comNivel: true})));
    var leit = hj && hj.leitura ? resolver([hj.leitura])[0] : null;
    if (leit) below.appendChild(A.sec('Leitura recomendada', {id: 'leitura', hint: 'Uma carta ou pesquisa original dos últimos 30 dias.'}, A.itemCard(leit)));
    if (hj && (hj.estudo || []).length) below.appendChild(A.sec('Estudo do dia', {id: 'estudo'},
      h('ol', {class: 'estudo'}, hj.estudo.map(function (q) { return h('li', null, q, ' ', h('button', {class: 'btn link', onclick: function () { A.drawer('Estudo do dia', h('div', null, h('p', {class: 'tv-lead'}, q), A.formAprendizado(null, {tipo: 'duvida', titulo: q, fonte: 'Estudo do dia', temas: hj.temas || []}))); }}, 'responder')); }))));
    return wrap;
  };
})(APP, CORE, INTEL);
