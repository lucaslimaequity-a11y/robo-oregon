/* v4.2 · Pautas da semana, do mês e do ano (pedido do Lucas em 11/11/2026, aprovado: "pode seguir assim").
   Lê data/biblioteca/pautas.json, montado pelo robô (robo/pautas.py). Carteira Oregon e VG VIP ficam separadas: cada uma
   com as suas empresas; a macro do Brasil e do mundo é a mesma para as duas. Só manchetes coletadas, com veículo, data e
   link: nada é escrito por máquina, nenhuma recomendação ou número é deduzido. Nada é retirado: a Pauta da semana de Brasil
   e a do VIP continuam como estão. O item novo do menu aparece nos dois visuais. */
(function (A, C, I) {
  'use strict';
  if (typeof document === 'undefined' || !A || !A.AREAS) return;
  var h = A.h, S = A.S;
  // logo depois de Hoje, nos dois visuais (o menu é montado em main.js a partir de A.AREAS)
  if (!A.AREAS.some(function (a) { return a[0] === 'pautas'; })) A.AREAS.splice(1, 0, ['pautas', 'Pautas', '#2E8A87', 'Pautas']);

  var P = {js: null, feito: false, erro: false, ass: null, flu: null, esc: 'oregon', per: 'semana', mes: null, abertos: {}};
  var ESC = [['oregon', 'Carteira Oregon'], ['vip', 'VG VIP']];
  var PER = [['semana', 'Semana'], ['mes', 'Mês'], ['ano', 'Ano']];
  var TIPOS = ['fato', 'resultado', 'recomendacao', 'evento', 'opiniao', 'cvm', 'setor', 'noticia'];
  var ROT = {fato: 'Fato relevante', resultado: 'Resultado', recomendacao: 'Mudança de recomendação', evento: 'Evento corporativo', opiniao: 'Opinião de casa',
    cvm: 'Documento à CVM', setor: 'Setor e macro', noticia: 'Notícia de destaque', macro: 'Macro'};
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var ALOC = {cartas: 'Cartas e research de gestoras', alocacao: 'Estudos sobre alocação', renda_fixa: 'Renda fixa (temas dos ETFs)'};
  var FLUXO = [['acoes', 'Ações'], ['multimercado', 'Multimercado'], ['renda_fixa', 'Renda fixa'], ['cambial', 'Cambial']];

  function baseDados() {
    try { if (/^https?:$/.test(location.protocol) && !(window.claude && window.claude.use) && !(typeof STORE !== 'undefined' && STORE.mode === 'db')) return new URL('data/', location.href).href; } catch (e) {}
    return 'https://lucaslimaequity-a11y.github.io/robo-oregon/data/';
  }
  function buscar(nome, chave) {
    return fetch(baseDados() + 'biblioteca/' + nome + '?t=' + Date.now(), {cache: 'no-store'}).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { P[chave] = j; if (S.area === 'pautas') A.rerender(); });
  }
  function carregar() {
    if (P.feito) return; P.feito = true;
    buscar('pautas.json', 'js').catch(function () { P.erro = true; if (S.area === 'pautas') A.rerender(); });
    buscar('assuntos.json', 'ass').catch(function () {});
    buscar('fluxo_fundos.json', 'flu').catch(function () {});
  }
  A.v42Pautas = function () { return P; };

  /* ---------- utilidades ---------- */
  function dm(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] : ''; }
  function dmy(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  function nomeMes(m, longo) { var i = +m.slice(5, 7) - 1; return (longo ? ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][i] : MESES[i]) + (longo ? ' de ' + m.slice(0, 4) : '/' + m.slice(2, 4)); }
  function plural(n, um, varios) { return n.toLocaleString('pt-BR') + ' ' + (n === 1 ? um : varios); }
  function num(v, c) { return Number(v).toLocaleString('pt-BR', {minimumFractionDigits: c, maximumFractionDigits: c}); }
  function it(id) { return (P.js && P.js.itens && P.js.itens[id]) || null; }
  function nome(t) { return (P.js && P.js.nomes && P.js.nomes[t]) || (C.ATV && C.ATV[t] && C.ATV[t].nome) || t; }
  function seg(rotulo, ops, atual, fn) {
    return h('div', {class: 'v4-pt-seg', role: 'radiogroup', 'aria-label': rotulo}, ops.map(function (o) {
      return h('button', {type: 'button', role: 'radio', 'aria-checked': atual === o[0] ? 'true' : 'false', onclick: function () { fn(o[0]); }}, o[1]);
    }));
  }
  function periodoAtual() {
    if (!P.js) return null;
    if (P.per === 'semana') return P.js.semana || null;
    if (P.per === 'mes') { var ms = Object.keys(P.js.meses || {}).sort(); if (!P.mes || !P.js.meses[P.mes]) P.mes = ms[ms.length - 1]; return P.mes ? P.js.meses[P.mes] : null; }
    return null;
  }
  function abrirAtivo(t) {
    if (C.ATV && C.ATV[t] && A.abrirFicha) { A.abrirFicha(t); return; }
    A.go('vip', 'ativos');
  }

  /* ---------- uma linha da pauta: tipo, manchete (abre a leitura quando o item está carregado; senão, a fonte) ---------- */
  function linha(l, mostraTipo) {
    var x = it(l[0]); if (!x) return null;
    var k = l[1], extra = [];
    if (x.c && x.c.length && (k === 'recomendacao' || k === 'opiniao')) extra.push(x.c.join(', '));
    if (x.r) extra.push(x.r);
    if (x.a) extra.push('alvo ' + x.a);
    var u = A.link(x.l);
    var tit = h(u ? 'a' : 'span', {class: 'v4-pt-tit', href: u || null, target: u ? '_blank' : null, rel: u ? 'noopener' : null, onclick: function (ev) {
      var cheio = A.itemPorId ? A.itemPorId(l[0]) : null;
      if (cheio && A.abrirItem) { ev.preventDefault(); A.abrirItem(cheio); }
    }}, x.t);
    return h('li', {class: 'v4-pt-l'},
      mostraTipo !== false ? h('span', {class: 'v4-pt-k k-' + k, title: ROT[k] || k}, ROT[k] || k) : null,
      h('div', {class: 'v4-pt-lc'}, tit,
        h('span', {class: 'v4-pt-m'}, [x.o, dm(x.d), l[2] ? '+' + plural(l[2], 'veículo', 'veículos') : null, x.of ? 'fonte oficial' : null].concat(extra).filter(Boolean).join(' · '))));
  }

  /* ---------- resumo do período ---------- */
  function resumo(p) {
    var c = (p.contagem || {})[P.esc] || {}, grupos = (P.js.grupos || {})[P.esc] || [], un = {}, tot = 0;
    grupos.forEach(function (g) { g.tickers.forEach(function (t) { if (!un[t]) { un[t] = 1; tot++; } }); });  // empresa em duas carteiras conta uma vez
    var tiles = [['resultado', 'Resultados'], ['fato', 'Fatos relevantes'], ['recomendacao', 'Mudanças de recomendação'], ['opiniao', 'Opiniões de casas'], ['evento', 'Eventos corporativos']]
      .map(function (o) { return h('div', {class: 'v4-pt-tile k-' + o[0]}, h('b', null, (c[o[0]] || 0).toLocaleString('pt-BR')), h('span', null, o[1])); });
    tiles.push(h('div', {class: 'v4-pt-tile'}, h('b', null, (c.empresas || 0) + ' de ' + tot), h('span', null, 'empresas com algo na pauta')));
    tiles.push(h('div', {class: 'v4-pt-tile'}, h('b', null, ((p.contagem || {}).macro_br || 0).toLocaleString('pt-BR')), h('span', null, 'fatos da macro do Brasil')));
    tiles.push(h('div', {class: 'v4-pt-tile'}, h('b', null, ((p.contagem || {}).mundo || 0).toLocaleString('pt-BR')), h('span', null, 'fatos da macro do mundo')));
    var ass = assuntosEmAlta(p);
    return h('div', {class: 'v4-pt-res'}, h('div', {class: 'v4-pt-tiles'}, tiles), ass);
  }
  function assuntosEmAlta(p) {
    var j = P.ass && P.ass.janelas, jan = P.per === 'semana' ? '7d' : (P.per === 'mes' && p.parcial ? '30d' : null);
    if (!j || !jan || !j[jan]) return null;
    var nomes = {}; (P.ass.assuntos || []).forEach(function (a) { nomes[a.id] = a.nome; });
    var l = Object.keys(j[jan].assuntos || {}).map(function (k) { return {k: k, v: j[jan].assuntos[k]}; })
      .filter(function (o) { return o.v.tendencia === 'sobe' || o.v.tendencia === 'novo'; }).sort(function (a, b) { return (b.v.razao || 99) - (a.v.razao || 99) || b.v.n - a.v.n; }).slice(0, 6);
    if (!l.length) return null;
    return h('p', {class: 'v4-pt-alta'}, h('span', {class: 'muted'}, 'Assuntos acima do normal (' + j[jan].rotulo + '): '), l.map(function (o) {
      return h('span', {class: 'v4-pt-ch'}, nomes[o.k] || o.k, ' ', h('small', null, o.v.tendencia === 'novo' ? 'novo' : '▲ ' + num(o.v.razao, 1) + '×'));
    }));
  }

  /* ---------- empresas por grupo (pilares da Oregon, carteiras da VIP) ---------- */
  function empresas(p) {
    var grupos = (P.js.grupos || {})[P.esc] || [], E = ((p[P.esc] || {}).empresas) || {};
    return grupos.map(function (g) {
      var com = g.tickers.filter(function (t) { return E[t]; }), sem = g.tickers.filter(function (t) { return !E[t]; });
      var corpo = h('div', {class: 'v4-pt-emps'}, com.map(function (t) {
        var e = E[t], n = 0; Object.keys(e.n || {}).forEach(function (k) { n += e.n[k]; });
        var marcas = TIPOS.filter(function (k) { return e.n && e.n[k]; }).map(function (k) { return h('span', {class: 'v4-pt-mk k-' + k, title: ROT[k]}, e.n[k] + ' ' + (ROT[k] || k).toLowerCase()); });
        return h('article', {class: 'v4-pt-emp'},
          h('header', null, h('button', {type: 'button', class: 'v4-pt-tk', title: 'Abrir a ficha', onclick: function () { abrirAtivo(t); }}, t), h('b', null, nome(t)), h('span', {class: 'v4-pt-mks'}, marcas)),
          h('ul', {class: 'v4-pt-ls'}, e.i.map(function (l) { return linha(l); })));
      }));
      if (!com.length) corpo.appendChild(h('p', {class: 'muted'}, 'Nenhuma empresa deste grupo teve fato importante no período.'));
      if (sem.length && com.length) corpo.appendChild(h('p', {class: 'v4-pt-sem muted'}, 'Sem fato importante no período: ', sem.map(function (t, i) { return h('span', null, i ? ', ' : '', h('button', {type: 'button', class: 'btn link', onclick: function () { abrirAtivo(t); }}, t)); })));
      return A.sec(g.nome, {cls: 'v4-pt-sec', badge: h('span', {class: 'sec-n'}, com.length + ' de ' + g.tickers.length + ' com algo na pauta')}, corpo);
    });
  }

  /* ---------- blocos por tema (macro do Brasil, mundo, exterior, alocação) ---------- */
  function temas(titulo, dados, nomes, hint, extra) {
    var ks = Object.keys(dados || {});
    if (!ks.length && !extra) return null;
    var grade = h('div', {class: 'v4-pt-temas'}, ks.map(function (k) {
      var d = dados[k];
      return h('div', {class: 'v4-pt-tema'}, h('h3', null, (nomes && nomes[k]) || k, h('small', null, plural(d.n, 'fato', 'fatos'))), h('ul', {class: 'v4-pt-ls'}, d.i.map(function (l) { return linha(l, false); })));
    }));
    return A.sec(titulo, {cls: 'v4-pt-sec', hint: hint}, h('div', null, extra || null, ks.length ? grade : null));
  }
  function fluxoBloco(p) {
    var F = P.flu; if (!F) return null;
    var c = null, rot = '';
    if (P.per === 'semana') { var s = (F.semanas || []).slice(-1)[0]; if (s) { c = s.c; rot = 'semana de ' + dm(s.de) + ' a ' + dm(s.ate) + (s.dias < 5 ? ' (' + s.dias + ' dias informados)' : ''); } }
    else if (P.per === 'mes') { var m = (F.meses || []).filter(function (x) { return x.mes === P.mes; })[0]; if (m) { c = m.c; rot = nomeMes(P.mes, true) + ' (' + m.dias + ' dias informados)'; } }
    else { var ano = String(new Date().getFullYear()), ms = (F.meses || []).filter(function (x) { return x.mes.slice(0, 4) === ano; }); if (ms.length) { c = {}; ms.forEach(function (x) { Object.keys(x.c).forEach(function (k) { c[k] = (c[k] || 0) + x.c[k]; }); }); rot = 'soma de ' + ms.map(function (x) { return nomeMes(x.mes); }).join(', ') + ' (meses que o robô já leu)'; } }
    if (!c) return null;
    return h('div', {class: 'v4-pt-flu'}, h('p', {class: 'v4-pt-flu-h'}, h('b', null, 'Fluxo dos fundos'), h('span', {class: 'muted'}, ' · captação menos resgate, ' + rot + ' · CVM, informe diário')),
      h('div', {class: 'v4-pt-flu-g'}, FLUXO.map(function (o) {
        var v = c[o[0]]; if (v == null) return null;
        return h('div', {class: 'v4-pt-flu-c'}, h('span', null, o[1]), h('b', {class: v > 0 ? 'v4-up' : v < 0 ? 'v4-down' : ''}, (v > 0 ? '+' : v < 0 ? '−' : '') + 'R$ ' + (Math.abs(v) >= 1e9 ? num(Math.abs(v) / 1e9, 1) + ' bi' : num(Math.abs(v) / 1e6, 0) + ' mi')));
      })));
  }

  /* ---------- semana e mês ---------- */
  function vistaPeriodo(p) {
    var wrap = h('div');
    var faixa = P.per === 'semana' ? 'Últimos 7 dias: de ' + dm(p.de) + ' a ' + dm(p.ate) : nomeMes(P.mes, true) + (p.parcial ? ', até ' + dm(p.ate) + ' (mês em andamento)' : '');
    wrap.appendChild(h('p', {class: 'v4-pt-faixa'}, h('b', null, faixa), h('span', {class: 'muted'}, ' · ' + plural(p.n_itens || 0, 'manchete lida', 'manchetes lidas') + ' pelo robô no período')));
    if (P.per === 'mes' && P.mes < '2026-10') wrap.appendChild(h('p', {class: 'v4-pt-aviso'}, 'Antes de outubro de 2026 o arquivo do robô guarda só as opiniões de casas de análise dos últimos 12 meses e alguns estudos: notícias, resultados e documentos à CVM entram a partir de outubro. Os fatos relevantes do ano inteiro estão na pauta do Ano.'));
    wrap.appendChild(resumo(p));
    empresas(p).forEach(function (s) { wrap.appendChild(s); });
    var mb = temas('Macro do Brasil', p.macro_br, P.js.macro_nomes, 'Juros, inflação, fiscal, câmbio, atividade e bolsa. Decisão e dado oficial (Copom, IBGE, Tesouro) aparecem na frente; o mesmo fato em vários veículos vira uma linha.');
    var mm = temas('Macro do mundo', p.mundo, P.js.mundo_nomes, 'Juros e bancos centrais, China, commodities, geopolítica, tecnologia, atividade e mercados. Só notícia e decisão oficial; estudos e discursos ficam na Biblioteca.');
    if (mb) wrap.appendChild(mb);
    if (mm) wrap.appendChild(mm);
    if (P.esc === 'oregon') {
      var ex = temas('Empresas e ETFs no exterior', p.exterior, null, 'Notícias dos temas dos ETFs da Oregon lá fora (Treasuries, high yield, ações globais e emergentes, bitcoin) e de resultados de empresas no exterior.');
      var al = temas('Alocação de ativos', p.alocacao, ALOC, 'Cartas e research de gestoras (uma por gestora), estudos sobre alocação e as notícias dos temas dos ETFs de renda fixa. O fluxo dos fundos é o da CVM.', fluxoBloco(p));
      if (ex) wrap.appendChild(ex);
      if (al) wrap.appendChild(al);
    } else {
      wrap.appendChild(h('p', {class: 'hint'}, 'As carteiras VG VIP são só de ações brasileiras: os temas de ETFs no exterior e a alocação de ativos aparecem na pauta da Carteira Oregon.'));
    }
    return wrap;
  }

  /* ---------- ano: a história ---------- */
  function variacao(ini, ag, unid) {
    if (ini == null || ag == null) return null;
    if (unid === 'R$') { var r = ag / ini - 1; return {txt: (r > 0 ? '+' : r < 0 ? '−' : '') + num(Math.abs(r) * 100, 1) + '%', d: r}; }
    var d = ag - ini; return {txt: (d > 0 ? '+' : d < 0 ? '−' : '') + num(Math.abs(d), 2) + ' p.p.', d: d};
  }
  function fmtVal(v, unid) { return unid === 'R$' ? 'R$ ' + num(v, 2) : num(v, 2) + (unid ? ' ' + unid.replace('% a.a.', '% a.a.') : ''); }
  // Selic, IPCA, dólar e CDI: lidos direto do Banco Central (SGS) pelo navegador, como no Mercado hoje; o robô não chama o SGS.
  var IND = [['selic', 432, 'Selic (meta do Copom)', '% a.a.', false], ['ipca_12m', 13522, 'IPCA em 12 meses', '%', true], ['ptax', 1, 'Dólar (PTAX, venda)', 'R$', false], ['cdi', 4389, 'CDI (anualizado)', '% a.a.', false]];
  function brD(d) { return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }
  function isoD(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function sgsUrl(c, ini, fim) { return 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.' + c + '/dados?formato=json&dataInicial=' + ini + '&dataFinal=' + fim; }
  function sgsUltimo(arr, ate) {
    if (!Array.isArray(arr)) return null;
    var pts = arr.map(function (o) { var m = String(o.data || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/), v = Number(String(o.valor).replace(',', '.')); return m && isFinite(v) ? {data: m[3] + '-' + m[2] + '-' + m[1], valor: v} : null; })
      .filter(function (p) { return p && p.data <= ate; }).sort(function (a, b) { return a.data < b.data ? -1 : 1; });
    return pts.length ? pts[pts.length - 1] : null;
  }
  function lerIndicadores(ano) {
    if (P.indAno === ano) return;
    P.indAno = ano; P.ind = {};
    var y = +ano, hoje = new Date();
    IND.forEach(function (s) {
      var ini0 = (s[4] ? '01/10/' : '01/12/') + (y - 1), fim0 = '31/12/' + (y - 1), d1 = new Date(hoje); d1.setDate(d1.getDate() - (s[4] ? 150 : 25));
      var get = function (u) { return fetch(u, {cache: 'no-store'}).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
      Promise.all([get(sgsUrl(s[1], ini0, fim0)).catch(function () { return null; }), get(sgsUrl(s[1], brD(d1), brD(hoje))).catch(function () { return null; })]).then(function (r) {
        var i0 = sgsUltimo(r[0], (y - 1) + '-12-31'), ag = sgsUltimo(r[1], isoD(hoje));
        if (s[4] && i0 && i0.data.slice(5, 7) !== '12') i0 = null;  // série mensal: só vale o dado de dezembro
        P.ind[s[0]] = {nome: s[2], unid: s[3], mensal: s[4], cod: s[1], inicio: i0, agora: ag};
        if (S.area === 'pautas' && P.per === 'ano') A.rerender();
      });
    });
  }
  function indicadoresAno(ano) {
    lerIndicadores(ano);
    var ks = IND.map(function (s) { return s[0]; }).filter(function (k) { return P.ind && P.ind[k]; });
    if (!ks.length) return h('p', {class: 'muted'}, 'Lendo Selic, IPCA, dólar e CDI no Banco Central…');
    if (!ks.some(function (k) { return P.ind[k].inicio || P.ind[k].agora; })) return h('p', {class: 'muted'}, 'O Banco Central não respondeu agora. Os números voltam quando a página for aberta de novo; nada é preenchido no lugar.');
    return h('div', {class: 'v4-pt-ind'}, ks.map(function (k) {
      var x = P.ind[k], i0 = x.inicio, ag = x.agora, v = variacao(i0 && i0.valor, ag && ag.valor, x.unid);
      return h('div', {class: 'v4-pt-ic'}, h('span', {class: 'v4-pt-ic-n'}, x.nome),
        h('div', {class: 'v4-pt-ic-v'}, h('div', null, h('small', null, i0 ? (x.mensal ? 'dez/' + i0.data.slice(2, 4) : dmy(i0.data)) : 'fim de ' + (+ano - 1)), h('b', null, i0 ? fmtVal(i0.valor, x.unid) : '—')),
          h('i', {'aria-hidden': 'true'}, '→'), h('div', null, h('small', null, ag ? (x.mensal ? nomeMes(ag.data.slice(0, 7)) : dmy(ag.data)) : 'agora'), h('b', null, ag ? fmtVal(ag.valor, x.unid) : '—'))),
        v ? h('span', {class: 'v4-pt-ic-d'}, (v.d > 0 ? '▲ ' : v.d < 0 ? '▼ ' : '') + v.txt + ' no ano') : null);
    }), h('p', {class: 'v4-pt-fonte'}, 'Banco Central · SGS (Selic 432, IPCA 13522, PTAX 1, CDI 4389), lido agora por esta página. Início = último dado de ' + (+ano - 1) + '.'));
  }
  function focusAno(a, ano) {
    var f = a.focus || {}, ks = ['IPCA', 'Selic', 'PIB Total', 'Câmbio'].filter(function (k) { return f[k]; });
    if (!ks.length) return h('p', {class: 'muted'}, 'A mediana do Focus de janeiro e a mais recente aparecem depois da primeira busca do robô no Banco Central.');
    var rot = {IPCA: 'IPCA ' + ano + ' (%)', Selic: 'Selic no fim de ' + ano + ' (%)', 'PIB Total': 'PIB ' + ano + ' (%)', 'Câmbio': 'Dólar no fim de ' + ano + ' (R$)'};
    return h('div', {class: 'v4-pt-ind'}, ks.map(function (k) {
      var x = f[k], i0 = x.inicio, ag = x.agora, un = k === 'Câmbio' ? 'R$' : '', v = variacao(i0 && i0.mediana, ag && ag.mediana, un === 'R$' ? 'R$' : '');
      return h('div', {class: 'v4-pt-ic'}, h('span', {class: 'v4-pt-ic-n'}, rot[k]),
        h('div', {class: 'v4-pt-ic-v'}, h('div', null, h('small', null, i0 ? 'Focus de ' + dmy(i0.data) : 'janeiro'), h('b', null, i0 ? num(i0.mediana, 2) : '—')),
          h('i', {'aria-hidden': 'true'}, '→'), h('div', null, h('small', null, ag ? 'Focus de ' + dmy(ag.data) : 'agora'), h('b', null, ag ? num(ag.mediana, 2) : '—'))),
        v ? h('span', {class: 'v4-pt-ic-d'}, (v.d > 0 ? '▲ ' : v.d < 0 ? '▼ ' : '') + v.txt) : null);
    }), h('p', {class: 'v4-pt-fonte'}, 'Banco Central · Focus (mediana das projeções do mercado para ' + ano + '). É o que o mercado esperava, não a nossa visão.'));
  }
  function mesAMes(ano, a) {
    var ms = Object.keys(P.js.meses || {}).filter(function (m) { return m.slice(0, 4) === ano; }).sort();
    if (!ms.length) return null;
    var fatos = {}, alvo = {};
    ((P.js.grupos || {})[P.esc] || []).forEach(function (g) { g.tickers.forEach(function (t) { alvo[t] = 1; }); });
    Object.keys(a.fatos || {}).forEach(function (t) { if (!alvo[t]) return; a.fatos[t].forEach(function (f) { var m = f.d.slice(0, 7); fatos[m] = (fatos[m] || 0) + 1; }); });
    var linhas = ms.map(function (m) {
      var c = ((P.js.meses[m].contagem || {})[P.esc]) || {};
      return {m: m, v: [['fato', fatos[m] || 0], ['resultado', c.resultado || 0], ['recomendacao', c.recomendacao || 0], ['opiniao', c.opiniao || 0]]};
    });
    var max = 1; linhas.forEach(function (l) { l.v.forEach(function (o) { if (o[1] > max) max = o[1]; }); });
    return h('div', {class: 'v4-pt-mm'}, linhas.map(function (l) {
      return h('button', {type: 'button', class: 'v4-pt-mm-c', title: 'Abrir a pauta de ' + nomeMes(l.m, true), onclick: function () { P.per = 'mes'; P.mes = l.m; A.rerender(); window.scrollTo(0, 0); }},
        h('span', {class: 'v4-pt-mm-b'}, l.v.map(function (o) { return h('i', {class: 'k-' + o[0], style: 'height:' + Math.max(o[1] ? 6 : 0, Math.round(o[1] / max * 64)) + 'px', title: ROT[o[0]] + ': ' + o[1]}); })),
        h('b', null, nomeMes(l.m)), h('small', null, l.v.map(function (o) { return o[1]; }).join(' · ')));
    }), h('p', {class: 'v4-pt-fonte'}, h('span', {class: 'v4-pt-mk k-fato'}, 'fatos relevantes (CVM, ano todo)'), ' ', h('span', {class: 'v4-pt-mk k-resultado'}, 'resultados'), ' ',
      h('span', {class: 'v4-pt-mk k-recomendacao'}, 'mudanças de recomendação'), ' ', h('span', {class: 'v4-pt-mk k-opiniao'}, 'opiniões'), ' · Até setembro, só opiniões de 12 meses no arquivo; notícias e resultados desde outubro. Toque num mês para abrir a pauta dele.'));
  }
  function lucro(x) { return x.lucro_controladores != null ? {v: x.lucro_controladores, r: 'c'} : x.lucro != null ? {v: x.lucro, r: 'k'} : null; }
  function resultadosAno(t, ano) {
    if (!A.resultadosDe || (C.ATV[t] && C.ATV[t].classe === 'FIIs')) return null;
    var R = A.resultadosDe(t === 'BBDC4' ? 'BBDC3' : t);
    if (!R || R.carregando) return h('span', {class: 'muted'}, 'resultados da CVM: carregando…');
    if (!R.emp) return null;
    var tri = R.emp.trimestres || [], aa = ano.slice(2), out = [];
    tri.filter(function (x) { return x.periodo.slice(2) === aa; }).forEach(function (x) {
      var ant = tri.filter(function (y) { return y.periodo === x.periodo.slice(0, 2) + String(+aa - 1); })[0], L = lucro(x), La = ant && lucro(ant);
      var d = L && La && L.r === La.r && L.v > 0 && La.v > 0 ? L.v / La.v - 1 : null;
      out.push(h('span', {class: 'v4-pt-q' + (d == null ? '' : d >= 0 ? ' v4-up' : ' v4-down'), title: 'Lucro do ' + x.periodo + (ant ? ' contra o ' + ant.periodo : '') + ' (CVM, ITR)' + (d == null ? ': sem comparação com os dois valores positivos' : '')},
        x.periodo, ' ', d == null ? '—' : (d >= 0 ? '▲ ' : '▼ ') + num(Math.abs(d) * 100, Math.abs(d) < 0.1 ? 1 : 0) + '%'));
    });
    return out.length ? h('span', {class: 'v4-pt-qs'}, out) : null;
  }
  function leitura(t, ano) {
    var T = P.js.teses || {};
    if (P.esc === 'oregon') {
      var hst = (T.oregon || {})[t] || [], ag = hst[hst.length - 1];
      if (!ag) return null;
      var f = function (v) { return [v.rec, v.teto != null ? 'teto R$ ' + num(v.teto, 2) : null, v.justo != null ? 'justo R$ ' + num(v.justo, 2) : null].filter(Boolean).join(' · '); };
      var ini = hst.filter(function (v) { return (v.registrado_em || '').slice(0, 4) === ano; })[0] || hst[0];
      return h('p', {class: 'v4-pt-nossa'}, h('b', null, 'Nossa leitura: '), f(ag), ag.data ? h('span', {class: 'muted'}, ' (teses de ' + ag.data + ')') : null,
        hst.length > 1 && ini !== ag ? h('span', null, ' · antes, em ' + (ini.data || dmy(ini.registrado_em)) + ': ' + f(ini)) : h('span', {class: 'muted'}, ' · primeiro registro em ' + dmy(ag.registrado_em) + '; a comparação aparece quando a tese mudar'));
    }
    var out = [];
    Object.keys(T.vip || {}).forEach(function (cid) {
      var hst = (T.vip[cid] || {})[t]; if (!hst || !hst.length) return;
      var ag = hst[hst.length - 1], ini = hst[0], g = (((P.js.grupos || {}).vip) || []).filter(function (x) { return x.id === cid; })[0];
      var f = function (v) { return [v.sugestao, v.teto != null ? 'teto R$ ' + num(v.teto, 2) : null, v.alocacao != null ? num(v.alocacao, 1) + '% da carteira' : null].filter(Boolean).join(' · '); };
      out.push(h('span', null, h('b', null, (g ? g.nome.replace('Carteira ', '') : cid) + ': '), f(ag), hst.length > 1 ? ' · antes (' + (ini.data ? dmy(ini.data) : dmy(ini.registrado_em)) + '): ' + f(ini) : ''));
    });
    return out.length ? h('p', {class: 'v4-pt-nossa'}, h('b', null, 'Nossa leitura: '), out.map(function (s, i) { return h('span', null, i ? ' | ' : '', s); }), h('span', {class: 'muted'}, ' · do print das carteiras; a comparação aparece quando o print mudar')) : null;
  }
  function itensDoAno(t, ano) {
    var out = [], vis = {};
    Object.keys(P.js.meses || {}).filter(function (m) { return m.slice(0, 4) === ano; }).sort().reverse().forEach(function (m) {
      var e = (((P.js.meses[m] || {})[P.esc] || {}).empresas || {})[t]; if (!e) return;
      e.i.forEach(function (l) { if (!vis[l[0]] && l[1] !== 'setor') { vis[l[0]] = 1; out.push(l); } });
    });
    return out;
  }
  function empresasAno(ano, a) {
    var grupos = (P.js.grupos || {})[P.esc] || [];
    return grupos.map(function (g) {
      var linhas = g.tickers.map(function (t) {
        var c = {}, fatos = (a.fatos || {})[t] || [];
        Object.keys(P.js.meses || {}).forEach(function (m) { if (m.slice(0, 4) !== ano) return; var e = (((P.js.meses[m] || {})[P.esc] || {}).empresas || {})[t]; if (!e) return; Object.keys(e.n || {}).forEach(function (k) { c[k] = (c[k] || 0) + e.n[k]; }); });
        var atv = C.ATV && C.ATV[t], ret = P.esc === 'oregon' && atv && atv.ret_ano != null ? h('span', {class: 'v4-pt-ret ' + (atv.ret_ano >= 0 ? 'v4-up' : 'v4-down'), title: atv.fonte_ret || ''}, 'no ano ' + A.spct(atv.ret_ano, 1) + (atv.data_ret ? ' até ' + atv.data_ret.slice(0, 5) : '')) : null;
        var aberto = !!P.abertos[P.esc + t];
        var conta = [fatos.length ? plural(fatos.length, 'fato relevante', 'fatos relevantes') : null, c.resultado ? plural(c.resultado, 'resultado', 'resultados') : null,
          c.recomendacao ? plural(c.recomendacao, 'mudança de recomendação', 'mudanças de recomendação') : null, c.opiniao ? plural(c.opiniao, 'opinião', 'opiniões') : null, c.evento ? plural(c.evento, 'evento', 'eventos') : null].filter(Boolean);
        var det = null;
        if (aberto) {
          var ls = itensDoAno(t, ano);
          det = h('div', {class: 'v4-pt-det'},
            ls.length ? h('ul', {class: 'v4-pt-ls'}, ls.slice(0, 40).map(function (l) { return linha(l); })) : h('p', {class: 'muted'}, 'Nenhuma notícia importante no arquivo do robô neste ano.'),
            fatos.length ? h('div', null, h('h4', null, 'Fatos relevantes do ano (CVM)'), h('ul', {class: 'v4-pt-ls'}, fatos.map(function (f) {
              var u = A.link(f.l);
              return h('li', {class: 'v4-pt-l'}, h('span', {class: 'v4-pt-k k-fato'}, dm(f.d)), h('div', {class: 'v4-pt-lc'}, h(u ? 'a' : 'span', {class: 'v4-pt-tit', href: u || null, target: u ? '_blank' : null, rel: u ? 'noopener' : null}, f.a)));
            }))) : null);
        }
        return h('article', {class: 'v4-pt-ano' + (aberto ? ' aberto' : '')},
          h('header', null, h('button', {type: 'button', class: 'v4-pt-tk', onclick: function () { abrirAtivo(t); }}, t), h('b', null, nome(t)), ret,
            h('button', {type: 'button', class: 'btn sm v4-pt-abre', 'aria-expanded': aberto ? 'true' : 'false', onclick: function () { P.abertos[P.esc + t] = !aberto; A.rerender(); }}, aberto ? 'Fechar' : 'Ver o ano')),
          h('p', {class: 'v4-pt-conta'}, conta.length ? conta.join(' · ') : h('span', {class: 'muted'}, 'nada importante no arquivo do robô neste ano'), ' ', resultadosAno(t, ano)),
          leitura(t, ano), det);
      });
      return A.sec(g.nome + ' no ano', {cls: 'v4-pt-sec'}, h('div', {class: 'v4-pt-anos'}, linhas));
    });
  }
  function macroAno(ano) {
    var ms = Object.keys(P.js.meses || {}).filter(function (m) { return m.slice(0, 4) === ano; }).sort().reverse();
    var blocos = ms.map(function (m) {
      var p = P.js.meses[m], ls = [];
      Object.keys(p.macro_br || {}).forEach(function (k) { var l = (p.macro_br[k].i || [])[0]; if (l) ls.push([l, (P.js.macro_nomes || {})[k] || k, 'Brasil']); });
      Object.keys(p.mundo || {}).forEach(function (k) { var l = (p.mundo[k].i || [])[0]; if (l) ls.push([l, (P.js.mundo_nomes || {})[k] || k, 'Mundo']); });
      if (!ls.length) return null;
      return h('div', {class: 'v4-pt-mac'}, h('h3', null, nomeMes(m, true)), h('ul', {class: 'v4-pt-ls'}, ls.slice(0, 8).map(function (o) {
        var li = linha(o[0], false); if (li) li.insertBefore(h('span', {class: 'v4-pt-k k-macro'}, o[2] + ' · ' + o[1]), li.firstChild); return li;
      })));
    }).filter(Boolean);
    return blocos.length ? A.sec('A macro, mês a mês', {cls: 'v4-pt-sec', hint: 'O fato principal de cada tema da macro do Brasil e do mundo em cada mês (decisão e dado oficial na frente).'}, h('div', {class: 'v4-pt-macs'}, blocos)) : null;
  }
  function vistaAno() {
    var anos = P.js.anos || {}, ano = Object.keys(anos).sort().pop() || String(new Date().getFullYear()), a = anos[ano] || {};
    var wrap = h('div');
    wrap.appendChild(h('p', {class: 'v4-pt-faixa'}, h('b', null, 'Ano de ' + ano + ', até hoje'), h('span', {class: 'muted'}, ' · como o ano começou, como está agora e o que mudou no caminho')));
    wrap.appendChild(A.sec('Como o ano começou × como está', {cls: 'v4-pt-sec'}, indicadoresAno(ano)));
    wrap.appendChild(A.sec('O que o mercado esperava em janeiro × o que espera agora', {cls: 'v4-pt-sec'}, focusAno(a, ano)));
    var mm = mesAMes(ano, a); if (mm) wrap.appendChild(A.sec('Mês a mês', {cls: 'v4-pt-sec'}, mm));
    empresasAno(ano, a).forEach(function (s) { wrap.appendChild(s); });
    var mc = macroAno(ano); if (mc) wrap.appendChild(mc);
    if (P.esc === 'oregon') { var fl = fluxoBloco(null); if (fl) wrap.appendChild(A.sec('Alocação de ativos no ano', {cls: 'v4-pt-sec'}, fl)); }
    if (a.erros && a.erros.length) wrap.appendChild(h('p', {class: 'hint'}, 'Na última busca do dia, algumas fontes oficiais não responderam (' + a.erros.join('; ') + '); ficaram os números anteriores.'));
    return wrap;
  }

  /* ---------- texto para copiar (deck semanal, carta mensal, material do ano) ---------- */
  function textoLinha(l) { var x = it(l[0]); if (!x) return null; return '   – [' + (ROT[l[1]] || 'Macro') + '] ' + x.t + ' (' + [x.o, dm(x.d)].filter(Boolean).join(', ') + ')' + (x.c && x.c.length && (l[1] === 'recomendacao' || l[1] === 'opiniao') ? ' · ' + x.c.join(', ') : '') + (A.link(x.l) ? ' ' + x.l : ''); }
  function texto() {
    var L = [], esc = P.esc === 'oregon' ? 'Carteira Oregon' : 'Carteiras VG VIP';
    if (P.per === 'ano') {
      var anos = P.js.anos || {}, ano = Object.keys(anos).sort().pop(), a = anos[ano] || {};
      L.push(esc + ' · pauta do ano de ' + ano);
      var ind = P.ind || {};
      if (Object.keys(ind).length) { L.push('', 'Como o ano começou × como está (Banco Central, SGS)'); ['selic', 'ipca_12m', 'ptax', 'cdi'].forEach(function (k) { var x = ind[k]; if (x && x.inicio && x.agora) L.push('• ' + x.nome + ': ' + fmtVal(x.inicio.valor, x.unid) + ' → ' + fmtVal(x.agora.valor, x.unid) + ' (' + dmy(x.agora.data) + ')'); }); }
      var f = a.focus || {};
      if (Object.keys(f).length) { L.push('', 'Focus: janeiro × agora (mediana para ' + ano + ')'); ['IPCA', 'Selic', 'PIB Total', 'Câmbio'].forEach(function (k) { var x = f[k]; if (x && x.inicio && x.agora) L.push('• ' + k + ': ' + num(x.inicio.mediana, 2) + ' → ' + num(x.agora.mediana, 2)); }); }
      ((P.js.grupos || {})[P.esc] || []).forEach(function (g) {
        L.push('', g.nome);
        g.tickers.forEach(function (t) { var ls = itensDoAno(t, ano).filter(function (l) { return l[1] === 'fato' || l[1] === 'resultado' || l[1] === 'recomendacao'; }); var fa = (a.fatos || {})[t] || []; if (!ls.length && !fa.length) return; L.push('• ' + t + ' (' + nome(t) + ')' + (fa.length ? ' · ' + plural(fa.length, 'fato relevante', 'fatos relevantes') + ' no ano (CVM)' : '')); ls.slice(0, 6).forEach(function (l) { var s = textoLinha(l); if (s) L.push(s); }); });
      });
      return L.join('\n');
    }
    var p = periodoAtual(); if (!p) return '';
    L.push(esc + ' · ' + (P.per === 'semana' ? 'pauta da semana, de ' + dm(p.de) + ' a ' + dm(p.ate) : 'pauta de ' + nomeMes(P.mes, true) + (p.parcial ? ' (até ' + dm(p.ate) + ')' : '')));
    ((P.js.grupos || {})[P.esc] || []).forEach(function (g) {
      var E = (p[P.esc] || {}).empresas || {}, com = g.tickers.filter(function (t) { return E[t]; });
      L.push('', g.nome);
      com.forEach(function (t) { L.push('• ' + t + ' (' + nome(t) + ')'); E[t].i.forEach(function (l) { var s = textoLinha(l); if (s) L.push(s); }); });
      var sem = g.tickers.filter(function (t) { return !E[t]; }); if (sem.length) L.push('Sem fato importante: ' + sem.join(', '));
    });
    [['Macro do Brasil', p.macro_br, P.js.macro_nomes], ['Macro do mundo', p.mundo, P.js.mundo_nomes]].concat(P.esc === 'oregon' ? [['Empresas e ETFs no exterior', p.exterior, null], ['Alocação de ativos', p.alocacao, ALOC]] : []).forEach(function (b) {
      var ks = Object.keys(b[1] || {}); if (!ks.length) return;
      L.push('', b[0]); ks.forEach(function (k) { L.push('• ' + ((b[2] || {})[k] || k)); b[1][k].i.forEach(function (l) { var s = textoLinha(l); if (s) L.push(s.replace('[Macro] ', '')); }); });
    });
    return L.join('\n');
  }
  function copiar() {
    var txt = texto(); if (!txt) return;
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { A.toast('Pauta copiada: cole no deck, na carta ou nas notas.'); },
      function () { A.drawer('Pauta (texto)', h('textarea', {class: 'inp', style: 'min-height:60vh;width:100%', readonly: true}, txt)); });
  }
  A.v42Texto = texto;

  /* ---------- a página ---------- */
  A.areas.pautas = function () {
    carregar();
    var wrap = h('div', {class: 'v4-pt'});
    var dir = h('div', {class: 'row v4-pt-acoes'}, A.btnImprimir ? A.btnImprimir() : null, h('button', {class: 'btn pri', type: 'button', onclick: copiar, disabled: P.js ? null : true}, 'Copiar pauta'));
    wrap.appendChild(A.pageHead('Resumo', 'Pautas', 'O que importou na semana, no mês e no ano, para a Carteira Oregon e, à parte, para as carteiras VG VIP: resultados, fatos relevantes, mudanças de recomendação, opiniões de casas, eventos, notícias do setor e a macro do Brasil e do mundo. Só manchetes coletadas pelo robô, com veículo, data e link.', dir));
    var ctl = h('div', {class: 'v4-pt-ctl'},
      seg('Carteira', ESC, P.esc, function (v) { P.esc = v; A.rerender(); }),
      seg('Período', PER, P.per, function (v) { P.per = v; A.rerender(); }));
    wrap.appendChild(ctl);
    if (P.js && P.per === 'mes') {
      var ms = Object.keys(P.js.meses || {}).sort().reverse(); periodoAtual();
      ctl.appendChild(h('div', {class: 'v4-pt-meses', role: 'radiogroup', 'aria-label': 'Mês'}, ms.map(function (m) {
        return h('button', {type: 'button', role: 'radio', 'aria-checked': P.mes === m ? 'true' : 'false', onclick: function () { P.mes = m; A.rerender(); }}, nomeMes(m));
      })));
    }
    wrap.appendChild(h('p', {class: 'v4-pt-esc'}, P.esc === 'oregon' ? 'Carteira Oregon: pilares Dividendos e Valor e os FIIs. As carteiras VG VIP ficam à parte.' : 'Carteiras VG VIP: Dividendos, Valor e Smallcaps. A Carteira Oregon fica à parte; uma empresa que está nas duas aparece nas duas.'));
    if (!P.js) {
      wrap.appendChild(P.erro ? h('div', {class: 'alert warn'}, 'As pautas ainda não foram publicadas pelo robô. Elas aparecem depois da primeira rodada com a versão 4.2.') : (A.v4Esqueleto ? A.v4Esqueleto() : h('p', {class: 'muted'}, 'Buscando as pautas…')));
      return wrap;
    }
    if (P.per === 'ano') wrap.appendChild(vistaAno());
    else { var p = periodoAtual(); wrap.appendChild(p ? vistaPeriodo(p) : h('p', {class: 'muted'}, 'Sem pauta para este período.')); }
    wrap.appendChild(h('p', {class: 'hint'}, (P.js.metodo || '') + ' Montado pelo robô em ' + (P.js.gerado_em ? dmy(P.js.gerado_em) + ' às ' + P.js.gerado_em.slice(11, 16) : '—') + '.'));
    return wrap;
  };
})(APP, CORE, INTEL);
