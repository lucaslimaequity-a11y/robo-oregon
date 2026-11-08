/* HOJE — a mesa de research do dia. Topo: data, última coleta, o que chegou desde a sua última visita e a profundidade
   de leitura (rápida, briefing, aprofundada). Mapa de atenção da carteira (acontecimentos por ativo e tipo, 7 dias).
   Quatro áreas: Radar das teses (o que aconteceu com as empresas acompanhadas, separando fato da empresa e hipótese de
   setor), Agenda decisiva (temporada de resultados na CVM, documentos das companhias, agenda macro oficial), Research
   global (cartas, research e instituições) e Debate de mercado (opiniões publicadas, análises de colaboradores e
   consultas externas). Abaixo, todas as notícias com filtros. Sem cotações. */
(function (A, C, I) {
  'use strict';
  var h = A.h;
  var F = {filtro: 'tudo', max: 10};
  function E() { return A.intel; }
  function resolver(refs) {
    var out = [], faltam = {};
    (refs || []).forEach(function (r) { var x = A.itemPorId(r.id); if (x) out.push(x); else if (r.mes) faltam[r.mes] = 1; });
    Object.keys(faltam).forEach(function (m) { if (!E().meses[m]) A.carregarMes(m); });
    return out;
  }
  var FILTROS = [['tudo', 'Tudo', 36], ['carteira', 'Na carteira', 72], ['brasil', 'Brasil', 36], ['mundo', 'Mundo', 36], ['gestoras', 'Gestoras e casas', 168], ['ri', 'RI e CVM', 168]];
  var DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var PROF = [['rapida', 'Rápida', 'Só o que mudou na carteira e o que vem pela frente'], ['briefing', 'Briefing', 'As quatro áreas da mesa e as notícias do dia'], ['aprofundada', 'Aprofundada', 'Tudo, com listas completas e o estudo do dia']];
  var MAX = {rapida: {radar: 5, research: 3, debate: 3, agenda: 4, ult: 0}, briefing: {radar: 8, research: 8, debate: 5, agenda: 6, ult: 10}, aprofundada: {radar: 16, research: 12, debate: 10, agenda: 10, ult: 30}};
  function janelaTxt(hs) { return hs >= 48 ? 'últimos ' + Math.round(hs / 24) + ' dias' : 'últimas ' + hs + ' h'; }
  function ts(x) { var p = I.pub(x); return Date.parse(p.length <= 10 ? p + 'T12:00:00-03:00' : p) || 0; }
  function dentro(x, horas) { if (!x.publicado_em || x.acervo || x.agrupado_em) return false; var t = ts(x), n = Date.now(); return n - t <= horas * 3600e3 && t - n < 6 * 3600e3; }
  function nomeAtivo(t) { var a = C.ATV[t]; return a && a.nome ? a.nome : t; }

  // Tipo de acontecimento de um item para um ativo: fato da empresa (CVM, resultado), opinião publicada, notícia, setor
  var TIPOS = {cvm: ['Documento à CVM', 'fato'], resultado: ['Resultado', 'fato'], opiniao: ['Opinião publicada', 'opiniao'], noticia: ['Notícia da empresa', 'noticia'], setor: ['Setor e cadeia', 'hipotese']};
  function tipoEvento(x, t) {
    if ((x.setor_de || []).indexOf(t) >= 0 && (x.ativos || []).indexOf(t) < 0) return 'setor';
    if (x.categoria === 'oficial_empresa') return 'cvm';
    if (x.natureza === 'opiniao_casa') return 'opiniao';
    return I.vinculo(x, t).evento === 'resultado' ? 'resultado' : 'noticia';
  }
  var PESO = {cvm: 3, resultado: 3, opiniao: 3, noticia: 2, setor: 1};
  function eventos(itens, horas) {
    var out = [], vis = {};
    itens.forEach(function (x) {
      if (vis[x.id] || !dentro(x, horas)) return; vis[x.id] = 1;
      var ts0 = I.diretos(x).map(function (t) { return {t: t, k: tipoEvento(x, t)}; });
      if (!ts0.length) ts0 = (x.setor_de || []).map(function (t) { return {t: t, k: 'setor'}; });
      if (ts0.length) out.push({x: x, ts: ts0, k: ts0[0].k});
    });
    return out;
  }
  // Linha explicando o mecanismo: fato da empresa × hipótese de setor
  function mecanismo(ev) {
    var x = ev.x, k = ev.k, tk = ev.ts.map(function (r) { return r.t; });
    var txt = k === 'cvm' ? 'Fato da empresa: ' + (x.tipo === 'fato_relevante' ? 'fato relevante' : (x.categoria_cvm || 'documento').toLowerCase()) + ' entregue à CVM'
      : k === 'resultado' ? 'Fato da empresa: resultado, pela manchete'
      : k === 'opiniao' ? 'Opinião publicada' + ((x.casas || []).length ? ' por ' + x.casas.join(', ') : '') + (x.posicao ? ', ' + I.POSICAO[x.posicao] : '')
      : k === 'setor' ? 'Hipótese: notícia do setor' + (x.setor_nome ? ' (' + x.setor_nome + ')' : '') + '; não cita ' + tk.map(nomeAtivo).join(', ')
      : 'Notícia em que ' + tk.map(nomeAtivo).join(', ') + (tk.length > 1 ? ' são' : ' é') + ' o assunto';
    return h('span', {class: 'nr-mec m-' + TIPOS[k][1]}, txt);
  }

  // Mapa de atenção: acontecimentos dos últimos 7 dias por ativo, separados por tipo. Quantidade não é risco nem oportunidade.
  function mapaAtencao(evs) {
    var por = {};
    evs.forEach(function (ev) { ev.ts.forEach(function (r) { var o = por[r.t] = por[r.t] || {t: r.t, n: 0, k: {}, ult: 0}; if (r.k !== 'setor') o.n++; o.k[r.k] = (o.k[r.k] || 0) + 1; o.ult = Math.max(o.ult, ts(ev.x)); }); });
    var l = Object.keys(por).map(function (k) { return por[k]; }).filter(function (o) { return o.n > 0; }).sort(function (a, b) { return (b.n - a.n) || (b.ult - a.ult); });
    if (!l.length) return null;
    var mx = l[0].n, ordem = ['resultado', 'cvm', 'opiniao', 'noticia', 'setor'];
    function cur(k, n) { return n + ' ' + ({resultado: n > 1 ? 'resultados' : 'resultado', cvm: 'CVM', opiniao: n > 1 ? 'opiniões' : 'opinião', noticia: n > 1 ? 'notícias' : 'notícia', setor: 'setor'})[k]; }
    return h('div', {class: 'atn', role: 'list'}, l.slice(0, 18).map(function (o) {
      var nivel = Math.min(4, Math.ceil(4 * o.n / mx)), det = ordem.filter(function (k) { return o.k[k] && k !== 'setor'; }).slice(0, 2).map(function (k) { return cur(k, o.k[k]); });
      return h('button', {class: 'atn-t n' + nivel, role: 'listitem', title: nomeAtivo(o.t) + ': ' + ordem.filter(function (k) { return o.k[k]; }).map(function (k) { return o.k[k] + ' ' + TIPOS[k][0].toLowerCase(); }).join(', ') + '. Toque para as notícias.', onclick: function () { A.abrirFicha(o.t); }},
        h('b', null, o.t), h('span', {class: 'atn-n'}, String(o.n)), h('small', null, det.join(' · ')));
    }));
  }

  // Temporada de resultados: quem já entregou o trimestre à CVM (dados abertos ITR/DFP ou documento de resultado no IPE)
  function trimestreAtual() { var d = new Date(Date.now() - 20 * 864e5), q = Math.floor(d.getUTCMonth() / 3); if (q === 0) return '4T' + String(d.getUTCFullYear() - 1).slice(2); return q + 'T' + String(d.getUTCFullYear()).slice(2); }
  function temporada(itens) {
    var res = E().res && E().res.empresas, tri = trimestreAtual(), rx = new RegExp('resultad[^:]*' + tri + '|' + tri + '.{0,40}resultad|release.{0,30}' + tri + '|' + tri + '.{0,20}(itr|dfp)', 'i');
    var acoes = Object.keys(C.ATV).filter(function (t) { var a = C.ATV[t]; return a.status !== 'placeholder' && a.classe === 'Ações' && a.moeda !== 'USD'; });
    if (!acoes.length) return null;
    // sem os dados da CVM nem documentos das companhias, "0 de 13" seria afirmar o que não se sabe
    if (!res && !itens.some(function (x) { return x.categoria === 'oficial_empresa'; })) return h('p', {class: 'empty sm'}, 'Temporada de resultados: sem dados da CVM nesta visualização.');
    var linhas = acoes.map(function (t) {
      var r = res && res[t], tri0 = r && (r.trimestres || []).slice(-1)[0], cvmDoc = itens.filter(function (x) { return x.categoria === 'oficial_empresa' && (x.ativos || []).indexOf(t) >= 0 && rx.test(x.titulo); })[0];
      var ok = (tri0 && tri0.periodo === tri) || !!cvmDoc;
      return {t: t, ok: ok, doc: cvmDoc, itr: tri0 && tri0.periodo === tri, sem: !r && !cvmDoc};
    });
    var feitos = linhas.filter(function (l) { return l.ok; }).length;
    return h('div', {class: 'tmp'}, h('p', {class: 'tmp-h'}, h('b', null, feitos + ' de ' + linhas.length), ' ações da carteira já entregaram o ' + tri + ' à CVM'),
      h('div', {class: 'tmp-l'}, linhas.sort(function (a, b) { return (a.ok - b.ok) || a.t.localeCompare(b.t); }).map(function (l) {
        return h('button', {class: 'tmp-t' + (l.ok ? ' ok' : ''), title: l.ok ? (l.itr ? 'ITR do ' + tri + ' nos dados abertos da CVM' : 'Documento de resultado no IPE da CVM: ' + l.doc.titulo) : 'Ainda sem o ' + tri + ' nos dados da CVM lidos pelo robô', onclick: function () { if (l.doc) A.abrirItem(l.doc); else A.abrirFicha(l.t); }},
          h('i', {'aria-hidden': 'true'}), l.t);
      })), h('p', {class: 'tmp-n'}, 'Dados abertos da CVM (atualizados semanalmente) e documentos de resultado das companhias. Datas futuras de divulgação ainda não são coletadas.'));
  }

  function area(id, cls, titulo, conta, corpo, mais) {
    return h('section', {class: 'ar ' + cls, id: id, 'aria-labelledby': id + '-t'}, h('header', null, h('h2', {id: id + '-t'}, titulo), conta != null ? h('span', {class: 'ar-n'}, conta) : null, mais || null), h('div', {class: 'ar-b'}, corpo));
  }
  function vazio(txt) { return h('p', {class: 'empty sm'}, txt); }

  A.areas.hoje = function () {
    var e = E(), hj = e.hoje, itens = A.itens(), todos = A.itensAtivo(), prof = A.prof(), M = MAX[prof];
    var wrap = h('div', {class: 'hoje p-' + prof});
    var hoje = I.hojeBRT(), d = new Date(hoje + 'T12:00:00Z'), v = e.versao, u = e.coleta && e.coleta.ultima, n24 = I.ultimas(itens, {horas: 24}).length;
    var semDados = !v && !itens.length;

    // ---- topo da mesa
    var status = v ? h('p', {class: 'status-l', title: 'O robô lê as fontes a cada 30 minutos, das 7h às 22h30; esta página se atualiza sozinha. A hora de cada notícia é a de publicação na fonte.'},
      'Última coleta concluída ', h('b', null, I.horaAbs(v.gerado_em)), h('span', {class: 'muted'}, ' (' + I.quando({publicado_em: v.gerado_em}) + ')'), ' · ', h('b', null, String(n24)), ' notícias nas últimas 24 h',
      u ? [' · ', u.fontes_erro ? h('button', {class: 'btn link', onclick: function () { A.go('bib', 'fontes'); }}, u.fontes_erro + (u.fontes_erro > 1 ? ' fontes com erro' : ' fonte com erro')) : 'nenhuma fonte com erro'] : null)
      : h('p', {class: 'status-l'}, e.carregando ? 'Buscando os dados do robô…' : 'Sem dados do robô nesta visualização.');
    var seg = h('div', {class: 'prof', role: 'radiogroup', 'aria-label': 'Profundidade de leitura'}, PROF.map(function (p) {
      return h('button', {role: 'radio', 'aria-checked': prof === p[0] ? 'true' : 'false', title: p[2], onclick: function () { A.setProf(p[0]); }}, p[1]);
    }));
    wrap.appendChild(h('div', {class: 'mesa-h'}, h('div', {class: 'grow'}, h('h1', null, DIAS[d.getUTCDay()].replace(/^./, function (c) { return c.toUpperCase(); }) + ', ' + d.getUTCDate() + ' de ' + MESES[d.getUTCMonth()]), status),
      h('div', {class: 'mesa-ctl'}, seg, h('button', {class: 'btn sm', title: 'Busca agora o que o robô já publicou', onclick: function () { A.intelAtualizar(); }}, e.carregando ? 'Atualizando…' : 'Atualizar'))));
    var fx = A.intelFaixa(); if (fx) wrap.appendChild(fx);

    // ---- desde a sua última visita, ativos vistos por último e sumário da página
    var ref = A.visitaAnterior(), novos = ref ? todos.filter(function (x) { return !x.acervo && !x.agrupado_em && A.novoParaVoce(x); }) : [];
    var nn = {carteira: novos.filter(function (x) { return I.diretos(x).length; }).length, op: novos.filter(function (x) { return x.natureza === 'opiniao_casa'; }).length,
      cvm: novos.filter(function (x) { return x.categoria === 'oficial_empresa'; }).length, res: novos.filter(function (x) { return /^gestora_|^instituicao$|^academia$/.test(x.categoria || ''); }).length};
    var rec = A.ativosRecentes().filter(function (t) { return C.ATV[t]; });
    var faixa = h('div', {class: 'desde'},
      ref ? h('p', null, h('b', null, 'Desde a sua última visita'), h('span', {class: 'muted'}, ' (' + I.horaAbs(ref) + ')'), ': ',
        novos.length ? [h('b', null, String(novos.length)), ' itens novos', nn.carteira ? [' · ', h('a', {href: '#radar'}, nn.carteira + ' na carteira')] : null, nn.op ? [' · ', h('a', {href: '#debate'}, nn.op + (nn.op > 1 ? ' opiniões' : ' opinião'))] : null,
          nn.cvm ? [' · ', h('a', {href: '#agenda-decisiva'}, nn.cvm + (nn.cvm > 1 ? ' documentos à CVM' : ' documento à CVM'))] : null, nn.res ? [' · ', h('a', {href: '#research'}, nn.res + ' de research')] : null, '. Os novos têm um ponto azul.'] : 'nada novo.')
        : h('p', {class: 'muted'}, 'Primeira visita neste navegador: a partir da próxima, aqui aparece só o que chegou desde então.'),
      rec.length ? h('p', {class: 'rec'}, h('span', {class: 'muted'}, 'Vistos por último: '), rec.slice(0, 6).map(function (t) { return h('button', {class: 'tag tk', onclick: function () { A.abrirFicha(t); }}, t); })) : null);
    wrap.appendChild(faixa);
    var sum = [['radar', 'Radar das teses'], ['agenda-decisiva', 'Agenda decisiva'], ['research', 'Research global'], ['debate', 'Debate de mercado']];
    if (M.ult) sum.push(['ultimas', 'Todas as notícias']);
    if (prof === 'aprofundada') sum.push(['estudo-dia', 'Estudo do dia']);
    wrap.appendChild(h('nav', {class: 'sumario', 'aria-label': 'Nesta página'}, h('span', {class: 'muted'}, 'Nesta página:'), sum.map(function (s0) { return h('a', {href: '#' + s0[0]}, s0[1]); })));

    // ---- mapa de atenção (7 dias)
    var ev7 = eventos(todos, 168), mapa = mapaAtencao(ev7);
    if (mapa) wrap.appendChild(h('section', {class: 'atencao', id: 'atencao', 'aria-labelledby': 'atn-t'}, h('header', null, h('h2', {id: 'atn-t'}, 'Mapa de atenção da carteira'), h('span', {class: 'ar-n'}, '7 dias'),
      h('span', {class: 'atn-leg'}, 'Acontecimentos em que o ativo é o assunto (resultado, documento à CVM, opinião, notícia). Quantidade não é risco nem oportunidade.')), mapa));

    var mesa = h('div', {class: 'mesa'}); wrap.appendChild(mesa);

    // ---- 1. Radar das teses (72 h)
    // peso por tipo de acontecimento; veículo pouco conhecido achado pela busca pesa menos (continua em "Todas as notícias")
    function peso(o) { return PESO[o.k] - (o.x.via && o.x.confiavel === false ? 1.5 : 0); }
    var ev = eventos(todos, 72).sort(function (a, b) { return (peso(b) - peso(a)) || (ts(b.x) - ts(a.x)); }).slice(0, M.radar).sort(function (a, b) { return ts(b.x) - ts(a.x); });
    var porId = {}; ev.forEach(function (o) { porId[o.x.id] = o; });
    mesa.appendChild(area('radar', 'a-radar', 'Radar das teses', ev.length ? ev.length + ' acontecimentos · 72 h' : '72 h',
      ev.length ? A.listaRows(ev.map(function (o) { return o.x; }), {extra: function (x) { return porId[x.id] ? mecanismo(porId[x.id]) : null; }})
        : vazio(semDados ? 'Sem dados do robô.' : 'Nenhuma empresa acompanhada foi assunto de notícia, documento ou opinião nas últimas 72 h.'),
      h('button', {class: 'btn link ar-mais', onclick: function () { A.go('brasil', 'ativos'); }}, 'Ativos ↗')));

    // ---- 2. Agenda decisiva: temporada de resultados, documentos das companhias (7 dias), agenda macro oficial
    var vistosDoc = {}, docs = todos.filter(function (x) { return x.categoria === 'oficial_empresa' && dentro(x, 168); }).sort(function (a, b) { return ts(b) - ts(a); })
      .filter(function (x) { var k = x.titulo + '|' + I.pub(x).slice(0, 10); if (vistosDoc[k]) return false; vistosDoc[k] = 1; return true; });
    var ag = A.agendaView(M.agenda);
    mesa.appendChild(area('agenda-decisiva', 'a-agenda', 'Agenda decisiva', null, h('div', null,
      temporada(todos),
      h('h3', {class: 'ar-sub'}, 'Documentos das companhias · 7 dias'), docs.length ? A.listaLinhas(docs, Math.max(3, M.agenda - 2)) : vazio(semDados ? 'Sem dados do robô.' : 'Nenhum documento das companhias acompanhadas na CVM nos últimos 7 dias.'),
      h('h3', {class: 'ar-sub'}, 'Agenda macro oficial'), h('div', {id: 'agenda'}, ag))));

    // ---- 3. Research global: leituras do dia (cartas, research, documentos oficiais), leitura recomendada, estudo
    function ehResearch(x) { return x.categoria !== 'oficial_empresa' && x.categoria !== 'veiculo' && !x.acervo; }
    var prior = hj ? resolver(hj.prioridades).filter(ehResearch) : [];
    if (prior.length < M.research) prior = prior.concat(todos.filter(function (x) { return /^gestora_|^instituicao$|^academia$/.test(x.categoria || '') && dentro(x, 168) && prior.indexOf(x) < 0; }).sort(function (a, b) { return ts(b) - ts(a); }));
    if (!prior.length) prior = todos.filter(function (x) { return /^gestora_|^instituicao$|^academia$/.test(x.categoria || '') && dentro(x, 168); }).sort(function (a, b) { return ts(b) - ts(a); }).slice(0, M.research);
    var leit = hj && hj.leitura ? resolver([hj.leitura])[0] : null;
    var resBody = h('div', null,
      leit && prof !== 'rapida' ? h('div', {id: 'leitura', class: 'destaque-leit'}, h('p', {class: 'ar-k'}, 'Leitura recomendada'), A.itemCard(leit)) : null,
      prior.length ? h('div', {id: 'prioridades'}, A.listaRows(prior.slice(0, M.research), {abrir: true, dias: false})) : vazio(semDados ? 'Sem dados do robô.' : 'Nada novo de gestoras, bancos e instituições nos últimos 7 dias.'));
    if (hj && (hj.estudo || []).length && prof !== 'rapida') resBody.appendChild(h('details', {class: 'estudo-d', id: 'estudo-dia', open: prof === 'aprofundada' ? true : null}, h('summary', null, 'Estudo do dia · ' + hj.estudo.length + ' perguntas'),
      h('ol', {class: 'estudo', id: 'estudo'}, hj.estudo.map(function (q) { return h('li', null, q, ' ', h('button', {class: 'btn link', onclick: function () { A.drawer('Estudo do dia', h('div', null, h('p', {class: 'tv-lead'}, q), A.formAprendizado(null, {tipo: 'duvida', titulo: q, fonte: 'Estudo do dia', temas: hj.temas || []}))); }}, 'responder')); }))));
    mesa.appendChild(area('research', 'a-research', 'Research global', prior.length ? Math.min(prior.length, M.research) + ' de ' + prior.length + ' leituras · 7 dias' : null, resBody,
      h('button', {class: 'btn link ar-mais', onclick: function () { A.go('mundo', 'cartas'); }}, 'Research ↗')));

    // ---- 4. Debate de mercado: opiniões publicadas (14 dias), análises de colaboradores e consultas externas
    var ops = todos.filter(function (x) { return x.natureza === 'opiniao_casa' && dentro(x, 336); }).sort(function (a, b) { return ts(b) - ts(a); });
    var colab = todos.filter(function (x) { return A.ehDebate && A.ehDebate(x) && dentro(x, 168); }).sort(function (a, b) { return ts(b) - ts(a); });
    var fav = ops.filter(function (x) { return x.posicao === 'favoravel'; }).length, con = ops.filter(function (x) { return x.posicao === 'contraria'; }).length;
    mesa.appendChild(area('debate', 'a-debate', 'Debate de mercado', ops.length ? ops.length + ' opiniões · 14 dias' : null, h('div', null,
      ops.length ? h('p', {class: 'deb-h'}, h('span', {class: 'pol p-favoravel'}, fav + ' a favor'), h('span', {class: 'pol p-contraria'}, con + ' contra'), h('span', {class: 'pol'}, (ops.length - fav - con) + ' neutras ou sem sentido no título')) : null,
      ops.length ? A.listaRows(ops.slice(0, M.debate), {abrir: true, dias: false}) : vazio(semDados ? 'Sem dados do robô.' : 'Nenhuma opinião de casa publicada nas manchetes dos últimos 14 dias.'),
      colab.length ? [h('h3', {class: 'ar-sub'}, 'Análises de colaboradores · 7 dias'), A.listaRows(colab.slice(0, Math.max(2, M.debate - 2)), {abrir: true, dias: false})] : null,
      A.consultasExternas ? A.consultasExternas(ev7, true) : null),
      h('button', {class: 'btn link ar-mais', onclick: function () { A.go('mundo', 'debate'); }}, 'Debate ↗')));

    // ---- todas as notícias (briefing e aprofundada): destaques e as demais, com filtros
    if (M.ult) {
      var f = FILTROS.filter(function (x) { return x[0] === F.filtro; })[0] || FILTROS[0], horas = f[2];
      var ult = I.ultimas(itens, {horas: horas, filtro: f[0]});
      if (ult.length < 8 && f[0] === 'tudo' && itens.length) { horas = 96; ult = I.ultimas(itens, {horas: horas, filtro: 'tudo'}); }
      var cont = {}; FILTROS.forEach(function (x) { cont[x[0]] = I.ultimas(itens, {horas: x[0] === 'tudo' ? horas : x[2], filtro: x[0]}).length; });
      var barra = h('div', {class: 'sub filt', role: 'toolbar', 'aria-label': 'Filtrar notícias'}, FILTROS.map(function (x) {
        return h('button', {'aria-pressed': F.filtro === x[0] ? 'true' : 'false', disabled: !cont[x[0]] && x[0] !== 'tudo' ? true : null, title: x[0] === 'carteira' ? 'Notícias em que um ativo das carteiras é o assunto (menções incidentais ficam de fora)' : null,
          onclick: function () { F.filtro = x[0]; F.max = M.ult; A.rerender(); }}, x[1], cont[x[0]] ? h('small', null, String(cont[x[0]])) : null);
      }));
      var mx = Math.max(F.max, M.ult), dest = I.destaques(ult, 5), resto = ult.filter(function (x) { return dest.indexOf(x) < 0; });
      var corpo = ult.length ? [h('h3', {class: 'nr-h'}, 'Em destaque'), A.listaRows(dest),
        resto.length ? [h('h3', {class: 'nr-h'}, 'Mais recentes'), A.listaRows(resto, {max: mx}),
          resto.length > mx ? h('p', {class: 'mais'}, h('button', {class: 'btn sm', onclick: function () { F.max = mx + 20; A.rerender(); }}, 'Mostrar mais ' + Math.min(20, resto.length - mx))) : null] : null]
        : h('p', {class: 'empty'}, e.carregando ? 'Buscando as notícias…' : (itens.length ? 'Nada com este filtro nos ' + janelaTxt(horas) + '.' : e.versao ? 'O robô ainda não publicou notícias.' : 'Sem dados do robô: as notícias aparecem quando os arquivos publicados puderem ser lidos.'));
      wrap.appendChild(A.sec('Todas as notícias', {id: 'ultimas', cls: 'sec-ult', badge: h('span', {class: 'sec-n'}, janelaTxt(horas))}, h('div', null, barra, corpo)));
    }
    return wrap;
  };
})(APP, CORE, INTEL);
