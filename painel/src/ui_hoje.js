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
      if (!ts0.length && !x.lente) ts0 = (x.setor_de || []).map(function (t) { return {t: t, k: 'setor'}; });  // a lente global (v3.6) fica só na ficha
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
    if (!res && !itens.some(function (x) { return x.categoria === 'oficial_empresa'; })) return h('p', {class: 'vz1'}, h('b', null, 'Temporada de resultados'), ': sem dados da CVM nesta visualização.');
    var linhas = acoes.map(function (t) {
      var r = res && res[t], tri0 = r && (r.trimestres || []).slice(-1)[0], cvmDoc = itens.filter(function (x) { return x.categoria === 'oficial_empresa' && (x.ativos || []).indexOf(t) >= 0 && rx.test(x.titulo); })[0];
      var ok = (tri0 && tri0.periodo === tri) || !!cvmDoc;
      return {t: t, ok: ok, doc: cvmDoc, itr: tri0 && tri0.periodo === tri, sem: !r && !cvmDoc};
    });
    var feitos = linhas.filter(function (l) { return l.ok; }).length;
    // v3.5 · quem falta: a data em que entregou o mesmo trimestre do ano passado (dados abertos da CVM), como referência
    var triAnt = tri.slice(0, 2) + String(+tri.slice(2) - 1).padStart(2, '0');
    var refs = linhas.filter(function (l) { return !l.ok; }).map(function (l) {
      var r = res && res[l.t], q = r && (r.trimestres || []).filter(function (x) { return x.periodo === triAnt && x.entregue_em; })[0];
      return q ? {t: l.t, d: q.entregue_em} : null;
    }).filter(Boolean).sort(function (a, b) { return a.d.slice(5).localeCompare(b.d.slice(5)); });
    var anunc = itens.filter(function (x) { return x.categoria === 'oficial_empresa' && /resultad|divulga|teleconfer|webcast|videoconfer/i.test(x.titulo) && /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/.test(x.titulo) && dentro(x, 60 * 24); });
    return h('div', {class: 'tmp'}, h('p', {class: 'tmp-h'}, h('b', null, feitos + ' de ' + linhas.length), ' ações da carteira já entregaram o ' + tri + ' à CVM'),
      h('div', {class: 'tmp-l'}, linhas.sort(function (a, b) { return (a.ok - b.ok) || a.t.localeCompare(b.t); }).map(function (l) {
        return h('button', {class: 'tmp-t' + (l.ok ? ' ok' : ''), title: l.ok ? (l.itr ? 'ITR do ' + tri + ' nos dados abertos da CVM' : 'Documento de resultado no IPE da CVM: ' + l.doc.titulo) : 'Ainda sem o ' + tri + ' nos dados da CVM lidos pelo robô', onclick: function () { if (l.doc) A.abrirItem(l.doc); else A.abrirFicha(l.t); }},
          h('i', {'aria-hidden': 'true'}), l.t);
      })),
      anunc.length ? h('div', null, h('p', {class: 'ar-k'}, 'Datas anunciadas pelas companhias'), h('ul', {class: 'ag-ref'}, anunc.slice(0, 6).map(function (x) { return h('li', null, h('button', {class: 'btn link', onclick: function () { A.abrirItem(x); }}, x.titulo)); }))) : null,
      refs.length ? h('div', null, h('p', {class: 'ar-k'}, 'Quem falta · quando entregou o ' + triAnt + ' (referência, não é data anunciada)'), h('ul', {class: 'ag-ref'}, refs.map(function (r) { var d = r.d; return h('li', null, h('b', null, r.t), ' ', d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4)); }))) : null,
      h('p', {class: 'tmp-n'}, 'Dados abertos da CVM (atualizados semanalmente) e documentos de resultado das companhias. Data anunciada só aparece quando o documento a traz no título; a referência é a data de entrega do mesmo trimestre do ano anterior.'));
  }

  // v3.5 · paper da semana: semana par, um paper brasileiro; ímpar, internacional (se faltar, o outro). Publicado nos últimos 21 dias.
  function semanaISO(d) { var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), dia = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dia); var a = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - a) / 864e5 + 1) / 7); }
  function paperDaSemana() {
    var L = (A.itensResearch ? A.itensResearch() : A.itens()).filter(function (x) { return (x.tipo === 'paper' || x.categoria === 'academia') && x.tipo !== 'video' && !x.acervo && !x.agrupado_em && dentro(x, 21 * 24); })
      .sort(function (a, b) { return ((b.prioridade || {}).pontos || 0) - ((a.prioridade || {}).pontos || 0) || ts(b) - ts(a); });
    if (!L.length) return null;
    var br = semanaISO(new Date()) % 2 === 0, esc = L.filter(function (x) { return (x.pais === 'Brasil') === br; })[0] || L[0];
    return h('div', {class: 'paper-sem'}, h('p', {class: 'ar-k'}, 'Paper da semana · ' + (esc.pais === 'Brasil' ? 'Brasil' : 'internacional')),
      h('button', {class: 'nwl', onclick: function () { A.abrirItem(esc); }}, esc.titulo),
      h('p', {class: 'muted'}, (esc.organizacao || esc.fonte) + ' · ' + I.quando(esc) + ' · ', h('button', {class: 'btn link', onclick: function () { A.drawer('Paper da semana', h('div', null, h('p', {class: 'tv-lead'}, esc.titulo), A.formAprendizado(esc))); }}, 'anotar o que aprendi')));
  }
  // v3.7 · no celular, as áreas abrem fechadas (menos o Radar), com a contagem no título; o aparelho lembra o que ficou aberto
  function celular() { return window.matchMedia && window.matchMedia('(max-width: 640px)').matches; }
  function abertaCel(id) { var v = A.lsGet ? A.lsGet('area-' + id, null) : null; return v == null ? id === 'radar' : !!v; }
  A.recolhivel = function (sec, id, cab) {
    if (!celular()) return sec;
    if (!abertaCel(id)) sec.classList.add('fechada');
    cab.classList.add('ar-tg'); cab.setAttribute('role', 'button'); cab.setAttribute('tabindex', '0'); cab.setAttribute('aria-expanded', sec.classList.contains('fechada') ? 'false' : 'true');
    function tg(ev) { if (ev.target.closest && ev.target.closest('button,a,select,input') && ev.target !== cab) return; var f = sec.classList.toggle('fechada'); cab.setAttribute('aria-expanded', f ? 'false' : 'true'); if (A.lsSet) A.lsSet('area-' + id, !f); }
    cab.addEventListener('click', tg); cab.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); tg(ev); } });
    return sec;
  };
  function area(id, cls, titulo, conta, corpo, mais) {
    var cab = h('header', null, h('h2', {id: id + '-t'}, titulo), conta != null ? h('span', {class: 'ar-n'}, conta) : null, mais || null);
    return A.recolhivel(h('section', {class: 'ar ' + cls, id: id, 'aria-labelledby': id + '-t'}, cab, h('div', {class: 'ar-b'}, corpo)), id, cab);
  }
  function vazio(txt) { return h('p', {class: 'empty sm'}, txt); }

  A.areas.hoje = function () {
    var e = E(), hj = e.hoje, itens = A.itens(), todos = A.itensAtivo(), prof = A.prof(), M = MAX[prof];
    var wrap = h('div', {class: 'hoje p-' + prof});
    var hoje = I.hojeBRT(), d = new Date(hoje + 'T12:00:00Z'), v = e.versao, u = e.coleta && e.coleta.ultima, n24 = I.ultimas(itens, {horas: 24}).length;
    var semDados = !v && !itens.length;

    // ---- topo da mesa
    var status = v ? h('p', {class: 'status-l', title: 'O robô lê as fontes aos 7 e aos 37 minutos de cada hora, das 7h às 22h37 (o GitHub pode atrasar); esta página se atualiza sozinha. A hora de cada notícia é a de publicação na fonte.'},
      'Última coleta concluída ', h('b', null, I.horaAbs(v.gerado_em)), h('span', {class: 'muted'}, ' (' + I.quando({publicado_em: v.gerado_em}) + ')'), ' · ', h('b', null, String(n24)), ' notícias nas últimas 24 h',
      u ? [' · ', u.fontes_erro ? h('button', {class: 'btn link', onclick: function () { A.go('bib', 'fontes'); }}, u.fontes_erro + (u.fontes_erro > 1 ? ' fontes com erro' : ' fonte com erro')) : 'nenhuma fonte com erro'] : null)
      : h('p', {class: 'status-l'}, e.carregando ? 'Buscando os dados do robô…' : 'Sem dados do robô nesta visualização.');
    var seg = h('div', {class: 'prof', role: 'radiogroup', 'aria-label': 'Profundidade de leitura'}, PROF.map(function (p) {
      return h('button', {role: 'radio', 'aria-checked': prof === p[0] ? 'true' : 'false', title: p[2], onclick: function () { A.setProf(p[0]); }}, p[1]);
    }));
    wrap.appendChild(h('div', {class: 'mesa-h'}, h('div', {class: 'grow'}, h('h1', null, DIAS[d.getUTCDay()].replace(/^./, function (c) { return c.toUpperCase(); }) + ', ' + d.getUTCDate() + ' de ' + MESES[d.getUTCMonth()]), status),
      h('div', {class: 'mesa-ctl'}, seg, h('button', {class: 'btn sm', title: 'Relê agora o que o robô já publicou no site (não manda o robô coletar)', onclick: function () { A.intelAtualizar(); }}, e.carregando ? 'Atualizando…' : 'Atualizar'),
        A.GH_ACTIONS ? h('a', {class: 'btn sm', href: A.GH_ACTIONS, target: '_blank', rel: 'noopener', title: 'Abre a página do robô no GitHub: toque em "Run workflow". Usa o seu login do GitHub; nenhuma chave fica no site. A rodada leva uns 10 minutos.'}, 'Coletar agora ↗') : null)));
    if (e.ultimoAviso) wrap.appendChild(h('p', {class: 'aviso-at', role: 'status'}, e.ultimoAviso));
    var fx = A.intelFaixa(); if (fx) wrap.appendChild(fx);
    var fxd = h('div', {class: 'fxd-slot'}); wrap.appendChild(fxd);  // v3.7 · faixa do dia (preenchida no fim, com as contagens das áreas)

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
      rec.length ? h('p', {class: 'rec'}, h('span', {class: 'muted'}, 'Vistos por último: '), rec.slice(0, 6).map(function (t) { return h('button', {class: 'tag tk', onclick: function () { A.abrirFicha(t); }}, t); })) : null,
      (function () { var bs = A.buscasSalvas ? A.buscasSalvas() : []; if (!bs.length) return null; return h('p', {class: 'rec'}, h('span', {class: 'muted'}, 'Buscas salvas: '), bs.slice(0, 6).map(function (o) { return h('button', {class: 'tag', title: o.total + ' itens', onclick: function () { A.abrirBusca(o.b); }}, o.b.nome + (o.novos ? ' · ' + o.novos + (o.novos > 1 ? ' novos' : ' novo') : '')); })); })());
    wrap.appendChild(faixa);
    if (A.alertasHoje && A.filaHoje) wrap.appendChild(h('div', {class: 'hx-g'}, A.alertasHoje(), A.filaHoje()));
    var sum = [['radar', 'Radar das teses'], ['agenda-decisiva', 'Agenda decisiva'], ['research', 'Research global'], ['debate', 'Debate de mercado']];
    if (M.ult) sum.push(['ultimas', 'Todas as notícias']);
    if (prof === 'aprofundada') sum.push(['estudo-dia', 'Estudo do dia']);
    sum.push(['alertas', 'Alertas e fila']);
    wrap.appendChild(h('nav', {class: 'sumario', 'aria-label': 'Nesta página'}, h('span', {class: 'muted'}, 'Nesta página:'), sum.map(function (s0) { return h('a', {href: '#' + s0[0], onclick: function () { var el = document.getElementById(s0[0]); if (el) el.classList.remove('fechada'); }}, s0[1]); })));

    // ---- mapa de atenção (7 dias)
    var ev7 = eventos(todos, 168), mapa = mapaAtencao(ev7);
    if (mapa) wrap.appendChild(h('section', {class: 'atencao', id: 'atencao', 'aria-labelledby': 'atn-t'}, h('header', null, h('h2', {id: 'atn-t'}, 'Mapa de atenção da carteira'), h('span', {class: 'ar-n'}, '7 dias'),
      h('span', {class: 'atn-leg'}, 'Acontecimentos em que o ativo é o assunto (resultado, documento à CVM, opinião, notícia). Quantidade não é risco nem oportunidade.')), mapa));

    // v3.7 · duas colunas independentes (Radar e Research | Agenda e Debate): sem buraco quando uma área é curta
    var mesaG = h('div', {class: 'mesa'}), colA = h('div', {class: 'mesa-col'}), colB = h('div', {class: 'mesa-col'}); mesaG.append(colA, colB); wrap.appendChild(mesaG);
    var mesa = {appendChild: function (el) { (/^(radar|research)$/.test(el.id) ? colA : colB).appendChild(el); return el; }};

    // ---- 1. Radar das teses (72 h)
    // peso por tipo de acontecimento; veículo pouco conhecido achado pela busca pesa menos (continua em "Todas as notícias")
    function peso(o) { return PESO[o.k] - (o.x.via && o.x.confiavel === false ? 1.5 : 0); }
    var ev72 = eventos(todos, 72), evBaixa = ev72.filter(function (o) { return I.baixaRelevancia(o.x); });
    var ev = ev72.filter(function (o) { return !I.baixaRelevancia(o.x); }).sort(function (a, b) { return (peso(b) - peso(a)) || (ts(b.x) - ts(a.x)); }).slice(0, M.radar).sort(function (a, b) { return ts(b.x) - ts(a.x); });
    var porId = {}; ev.concat(evBaixa).forEach(function (o) { porId[o.x.id] = o; });
    var extraRadar = function (x) { return porId[x.id] ? mecanismo(porId[x.id]) : null; };
    mesa.appendChild(area('radar', 'a-radar', 'Radar das teses', ev.length ? ev.length + ' acontecimentos · 72 h' : '72 h',
      h('div', null, ev.length ? A.listaRows(ev.map(function (o) { return o.x; }), {extra: extraRadar})
        : vazio(semDados ? 'Sem dados do robô.' : evBaixa.length ? 'Nenhum acontecimento de fonte conhecida nas últimas 72 h.' : 'Nenhuma empresa acompanhada foi assunto de notícia, documento ou opinião nas últimas 72 h.'),
        evBaixa.length ? A.more('Mostrar ' + evBaixa.length + ' de baixa relevância', h('div', null, h('p', {class: 'hint', style: 'margin:0 0 4px'}, 'Veículos pouco conhecidos achados pela busca, sem resultado, documento ou opinião de casa. Nada é apagado.'),
          A.listaRows(evBaixa.sort(function (a, b) { return ts(b.x) - ts(a.x); }).map(function (o) { return o.x; }), {extra: extraRadar, max: 20}))) : null),
      [h('button', {class: 'btn link ar-mais', title: 'Notícias da semana por empresa da Carteira Oregon, por pilar, para a reunião', onclick: function () { A.go('brasil', 'pauta'); }}, 'Pauta da semana ↗'), h('button', {class: 'btn link', onclick: function () { A.go('brasil', 'ativos'); }}, 'Ativos ↗')]));

    // ---- 2. Agenda decisiva: temporada de resultados, documentos das companhias (7 dias), agenda macro oficial
    var vistosDoc = {}, docs = todos.filter(function (x) { return x.categoria === 'oficial_empresa' && dentro(x, 168); }).sort(function (a, b) { return ts(b) - ts(a); })
      .filter(function (x) { var k = x.titulo + '|' + I.pub(x).slice(0, 10); if (vistosDoc[k]) return false; vistosDoc[k] = 1; return true; });
    var ag = A.agendaView(M.agenda);
    var pvp = A.proventosProximos ? A.proventosProximos(14, true) : [];
    mesa.appendChild(area('agenda-decisiva', 'a-agenda', 'Agenda decisiva', null, h('div', null,
      temporada(todos),
      pvp.length ? h('div', null, h('h3', {class: 'ar-sub'}, 'Proventos · próximos 14 dias'), h('ul', {class: 'ag-ref'}, pvp.slice(0, 6).map(function (e) {
        return h('li', null, h('button', {class: 'tag tk', onclick: function () { A.abrirFicha(e.t); }}, e.t), ' ' + (e.k === 'data-com' ? 'data-com ' : 'pagamento ') + e.d.slice(8, 10) + '/' + e.d.slice(5, 7) + ' · ' + e.tipo + ' R$ ' + A.num(e.valor, 4));
      })), h('button', {class: 'btn link', onclick: function () { A.go('brasil', 'proventos'); }}, 'Agenda de proventos ↗')) : null,
      docs.length ? [h('h3', {class: 'ar-sub'}, 'Documentos das companhias · 7 dias'), A.listaLinhas(docs, Math.max(3, M.agenda - 2))] : h('p', {class: 'vz1'}, h('b', null, 'Documentos das companhias · 7 dias'), semDados ? ': sem dados do robô.' : ': nenhum na CVM.'),
      h('h3', {class: 'ar-sub'}, 'Agenda macro oficial'), h('div', {id: 'agenda'}, ag))));

    // ---- 3. Research global: leituras do dia (cartas, research, documentos oficiais), leitura recomendada, estudo
    function ehResearch(x) { return x.categoria !== 'oficial_empresa' && x.categoria !== 'veiculo' && !x.acervo; }
    var prior = hj ? resolver(hj.prioridades).filter(ehResearch) : [];
    if (prior.length < M.research) prior = prior.concat(todos.filter(function (x) { return /^gestora_|^instituicao$|^academia$/.test(x.categoria || '') && dentro(x, 168) && prior.indexOf(x) < 0; }).sort(function (a, b) { return ts(b) - ts(a); }));
    if (!prior.length) prior = todos.filter(function (x) { return /^gestora_|^instituicao$|^academia$/.test(x.categoria || '') && dentro(x, 168); }).sort(function (a, b) { return ts(b) - ts(a); }).slice(0, M.research);
    var leit = hj && hj.leitura ? resolver([hj.leitura])[0] : null;
    var pap = prof !== 'rapida' ? paperDaSemana() : null;
    var cla = prof !== 'rapida' && A.classicoDaSemana ? A.classicoDaSemana() : null;  // v3.6 · clássico da Estante ligado ao tema em alta
    var resBody = h('div', null, pap, cla,
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
      // v3.7 · tipo de evento corporativo (pela manchete): recompra, M&A, guidance, gestão, dívida, oferta
      var evc = {}; ult.forEach(function (x) { I.eventosDe(x).forEach(function (k) { evc[k] = (evc[k] || 0) + 1; }); });
      if (F.evento && !evc[F.evento]) F.evento = null;
      var barraEv = Object.keys(evc).length ? h('div', {class: 'sub filt ev-f', role: 'toolbar', 'aria-label': 'Tipo de evento'}, h('span', {class: 'muted ev-fl'}, 'Evento:'), I.EVENTOS.filter(function (o) { return evc[o[0]]; }).map(function (o) {
        return h('button', {'aria-pressed': F.evento === o[0] ? 'true' : 'false', onclick: function () { F.evento = F.evento === o[0] ? null : o[0]; A.rerender(); }}, o[1], h('small', null, String(evc[o[0]])));
      })) : null;
      if (F.evento) ult = ult.filter(function (x) { return I.eventosDe(x).indexOf(F.evento) >= 0; });
      var mx = Math.max(F.max, M.ult), dest = I.destaques(ult, 5), resto = ult.filter(function (x) { return dest.indexOf(x) < 0; });
      var corpo = ult.length ? [h('h3', {class: 'nr-h'}, 'Em destaque'), A.listaRows(dest),
        resto.length ? [h('h3', {class: 'nr-h'}, 'Mais recentes'), A.listaRows(resto, {max: mx}),
          resto.length > mx ? h('p', {class: 'mais'}, h('button', {class: 'btn sm', onclick: function () { F.max = mx + 20; A.rerender(); }}, 'Mostrar mais ' + Math.min(20, resto.length - mx))) : null] : null]
        : h('p', {class: 'empty'}, e.carregando ? 'Buscando as notícias…' : (itens.length ? 'Nada com este filtro nos ' + janelaTxt(horas) + '.' : e.versao ? 'O robô ainda não publicou notícias.' : 'Sem dados do robô: as notícias aparecem quando os arquivos publicados puderem ser lidos.'));
      var secU = A.sec('Todas as notícias', {id: 'ultimas', cls: 'sec-ult', badge: h('span', {class: 'sec-n'}, janelaTxt(horas) + (ult.length ? ' · ' + ult.length : ''))}, h('div', null, barra, barraEv, A.legendaMarcas ? A.legendaMarcas() : null, corpo));
      wrap.appendChild(A.recolhivel(secU, 'ultimas', secU.querySelector('header')));
    }
    // v3.7 · faixa do dia, com as contagens já calculadas
    if (A.faixaDoDia) fxd.appendChild(A.faixaDoDia({fatos: ev.length, opinioes: ops.filter(function (x) { return dentro(x, 168); }).length}));
    return wrap;
  };
})(APP, CORE, INTEL);
