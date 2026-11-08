/* HOJE — briefing diário do Oregon Intelligence: 5 a 8 conteúdos prioritários com análise, macro que explica o dia,
   publicações de gestoras, vídeos, uma leitura recomendada e o estudo do dia. Dez a quinze minutos, sem excesso. */
(function (A, C, I) {
  'use strict';
  var h = A.h;
  function E() { return A.intel; }
  // Resolve as referências do hoje.json ({id, mes}) para os itens em memória; pede o mês quando o item está fora dos recentes
  function resolver(refs) {
    var out = [], faltam = {};
    (refs || []).forEach(function (r) { var x = A.itemPorId(r.id); if (x) out.push(x); else if (r.mes) faltam[r.mes] = 1; });
    Object.keys(faltam).forEach(function (m) { if (!E().meses[m]) A.carregarMes(m); });
    return out;
  }
  // Sem hoje.json (robô antigo ou primeira rodada): monta a lista localmente com as mesmas regras de variedade
  function localmente(itens, n) {
    var hoje = I.hojeBRT(), rec = itens.filter(function (x) { return I.pub(x).slice(0, 10) >= I.menosDias(hoje, 2); });
    var base = I.ordenar((rec.length >= 5 ? rec : itens).filter(function (x) { return x.natureza !== 'promocional' && x.natureza !== 'recomendacao'; }));
    var out = [], pf = {}, pt = {};
    base.forEach(function (x) { var f = x.fonte_id, t = (x.temas || ['-'])[0]; if (out.length >= n || (pf[f] || 0) >= 2 || (pt[t] || 0) >= 3) return; out.push(x); pf[f] = (pf[f] || 0) + 1; pt[t] = (pt[t] || 0) + 1; });
    return out;
  }
  function secao(tit, itens, opt) { opt = opt || {}; return A.sec(tit, {hint: opt.hint, id: opt.id, right: opt.right}, A.listaItens(itens, {vazio: opt.vazio || 'Nada nesta janela.', max: opt.max, semResumo: opt.semResumo})); }

  A.areas.hoje = function () {
    var e = E(), wrap = h('div'), hj = e.hoje, itens = A.itens();
    var data = hj && hj.data ? A.dataBR(hj.data) : A.dataBR(I.hojeBRT());
    wrap.appendChild(A.pageHead('Oregon Intelligence · briefing', 'Hoje, ' + data, 'As leituras que mais importam para quem gere carteiras, com análise em sete pontos. ' + (hj ? 'Janela de ' + hj.janela + ', ' + hj.n_itens_janela + ' itens avaliados; aqui ficam ' + hj.prioridades.length + '.' : 'Dez a quinze minutos, sem excesso.'),
      h('button', {class: 'btn', onclick: function () { A.intelAtualizar(); }}, e.carregando ? 'Atualizando…' : 'Atualizar')));
    var fx = A.intelFaixa(); if (fx) wrap.appendChild(fx);
    if (hj && hj.aviso) wrap.appendChild(h('p', {class: 'hint', style: 'margin-top:0'}, hj.aviso));
    var prior = hj ? resolver(hj.prioridades) : localmente(itens, 8);
    if (hj && prior.length < hj.prioridades.length && !e.carregando) prior = prior.concat(localmente(itens.filter(function (x) { return prior.indexOf(x) < 0; }), hj.prioridades.length - prior.length));
    wrap.appendChild(secao('Prioridades do dia', prior, {id: 'prioridades', hint: 'Cinco a oito conteúdos, no máximo dois por fonte e três por tema. Toque no título para a análise; ↗ abre a fonte original.', vazio: itens.length ? 'Sem itens recentes com prioridade; veja a Biblioteca.' : (e.carregando ? 'Buscando os dados do robô…' : 'A biblioteca ainda está vazia: o robô publica os primeiros itens na primeira rodada.')}));
    var g = h('div', {class: 'grid2'}), L = h('div'), R = h('div'); g.append(L, R); wrap.appendChild(g);
    L.appendChild(A.sec('Macro que explica o dia', {hint: 'Indicadores oficiais de referência (Banco Central, Tesouro, Tesouro dos EUA). Não há cotações de ações nem câmbio ao vivo: este não é um terminal.', id: 'macro'}, A.macroCards(true)));
    R.appendChild(A.sec('Agenda', {hint: 'Divulgações oficiais dos próximos dias (IBGE, Copom, Fed, Focus).', id: 'agenda'}, A.agendaView(7)));
    if (hj) {
      var macro = resolver(hj.macro), gest = resolver(hj.gestoras), vids = resolver(hj.videos);
      if (macro.length) wrap.appendChild(secao('Notícias e documentos macro', macro, {id: 'macro-itens', hint: 'Instituições oficiais: Banco Central, Fed, BCE, BIS, FMI, IBGE.', semResumo: true}));
      if (gest.length) wrap.appendChild(secao('Publicações de gestoras', gest, {id: 'gestoras', hint: 'Cartas, research e comentários das gestoras cadastradas. O material mais valioso para aprender método.'}));
      if (vids.length) wrap.appendChild(secao('Vídeos', vids, {id: 'videos', hint: 'Canais oficiais, pela API do YouTube. Só título, link e descrição curta.', semResumo: true}));
      var leit = hj.leitura ? resolver([hj.leitura])[0] : null;
      var g2 = h('div', {class: 'grid2'}), L2 = h('div'), R2 = h('div'); g2.append(L2, R2); wrap.appendChild(g2);
      L2.appendChild(A.sec('Leitura recomendada', {id: 'leitura', hint: 'Uma carta ou pesquisa original dos últimos 30 dias, sem repetir a recomendação anterior.'}, leit ? A.itemCard(leit) : h('p', {class: 'muted'}, hj.leitura ? 'Carregando a leitura (está no arquivo de ' + hj.leitura.mes + ')…' : 'Nenhuma carta ou pesquisa original na janela.')));
      R2.appendChild(A.sec('Estudo do dia', {id: 'estudo', hint: 'Perguntas ligadas aos temas das prioridades. Responder por escrito é o que fixa o aprendizado.'}, (hj.estudo || []).length ? h('ol', {class: 'estudo'}, hj.estudo.map(function (q) { return h('li', null, q, ' ', h('button', {class: 'btn link', onclick: function () { A.drawer('Estudo do dia', h('div', null, h('p', {class: 'tv-lead'}, q), A.formAprendizado(null, {tipo: 'duvida', titulo: q, fonte: 'Estudo do dia', temas: hj.temas || []}))); }}, 'responder')); })) : h('p', {class: 'muted'}, 'Sem perguntas hoje.')));
    } else if (itens.length) {
      wrap.appendChild(secao('Mais recentes', I.ordenar(itens).slice(0, 12), {hint: 'O briefing completo (macro, gestoras, vídeos, leitura e estudo do dia) aparece quando o robô publicar hoje.json.'}));
    }
    wrap.appendChild(h('p', {class: 'muted', style: 'font-size:.88rem'}, 'Tudo o que foi coletado, com busca e filtros, está na ', h('button', {class: 'btn link', onclick: function () { A.go('bib', 'busca'); }}, 'Biblioteca'), '. O que isso toca na carteira está em ', h('button', {class: 'btn link', onclick: function () { A.go('oregon', 'ativos'); }}, 'Oregon'), '.'));
    return wrap;
  };
})(APP, CORE, INTEL);
