/* BRASIL · v3.6 — Termômetro das cartas, Quem tem a ação (fundos de ações, CVM) e Agenda de proventos.
   Tudo a partir de arquivos que o robô publica (biblioteca/cartas_mencoes.json, biblioteca/fundos_acoes.json,
   biblioteca/proventos.json). Sem cotação e sem opinião atribuída: contagens e dados oficiais, com a fonte ao lado. */
(function (A, C, I) {
  'use strict';
  var h = A.h, S = A.S;
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function nomeMes(m) { return m ? MESES[+m.slice(5, 7) - 1] + ' de ' + m.slice(0, 4) : ''; }
  function vip() { return A.VIP || {ativos: {}}; }
  function naVip(t) { var V = vip().ativos; return Object.keys(V).some(function (k) { return V[k].ticker === t || V[k].noticias_de === t; }); }
  function abrir(t) { if (C.ATV[t]) A.abrirFicha(t); else if (vip().ativos[t]) A.abrirFichaVip(t); }
  function chips(t) {
    var o = !!C.ATV[t] && C.ATV[t].status !== 'placeholder', v = naVip(t);
    return [o ? h('span', {class: 'br-chip c-or', title: 'Na Carteira Oregon'}, 'Oregon') : null, v ? h('span', {class: 'br-chip c-vip', title: 'Numa carteira VG VIP'}, 'VIP') : null];
  }
  function estado(a, rotulo) {
    if (!a || a.carregando) return h('p', {class: 'empty'}, 'Abrindo ' + rotulo + '…');
    if (a.ausente) return h('p', {class: 'empty'}, 'O robô ainda não publicou ' + rotulo + '. Aparece depois da primeira rodada com a v3.6.');
    return h('p', {class: 'empty'}, 'Não consegui abrir ' + rotulo + ': ' + a.erro + '.');
  }

  /* ---------- Termômetro das cartas ---------- */
  var TC = {mes: null, todas: false, ver: 'mes'};
  function termometro() {
    var wrap = h('div');
    wrap.appendChild(A.pageHead('Brasil', 'Termômetro das cartas', 'Quais empresas brasileiras as cartas mensais das gestoras citaram, mês a mês. O robô lê cada carta pública (o PDF ou a página da carta) e conta as citações (código de negociação ou nome das empresas das carteiras). É contagem: não diz se a gestora gosta ou não da empresa.'));
    var a = A.arquivo('biblioteca/cartas_mencoes.json'); if (!a.dados) { wrap.appendChild(estado(a, 'o termômetro das cartas')); return wrap; }
    var ms = (a.dados.meses || []).filter(function (m) { return m.cartas.length; });
    if (!ms.length) { wrap.appendChild(h('p', {class: 'empty'}, 'Nenhuma carta de gestora brasileira com mês identificado nos últimos meses.')); return wrap; }
    if (!TC.mes || !ms.some(function (m) { return m.mes === TC.mes; })) TC.mes = ms[0].mes;
    // v3.7 · visão "ao longo dos meses": grade empresa × mês (quantas cartas citaram), para ver quem passou a ser mais ou menos citado
    wrap.appendChild(h('div', {class: 'sub filt', role: 'toolbar', 'aria-label': 'Visão'}, [['mes', 'Um mês'], ['grade', 'Ao longo dos meses']].map(function (o) { return h('button', {'aria-pressed': TC.ver === o[0] ? 'true' : 'false', onclick: function () { TC.ver = o[0]; A.rerender(); }}, o[1]); })));
    if (TC.ver === 'grade') { wrap.appendChild(gradeCartas(ms)); return wrap; }
    var M = ms.filter(function (m) { return m.mes === TC.mes; })[0];
    wrap.appendChild(h('div', {class: 'sub filt', role: 'toolbar', 'aria-label': 'Mês'}, ms.map(function (m) { return h('button', {'aria-pressed': m.mes === TC.mes ? 'true' : 'false', onclick: function () { TC.mes = m.mes; A.rerender(); }}, nomeMes(m.mes), h('small', null, String(m.n_lidas))); })));
    wrap.appendChild(h('p', {class: 'lead'}, h('b', null, M.n_lidas + (M.n_lidas === 1 ? ' carta lida' : ' cartas lidas')), ' de ' + M.cartas.length + ' publicadas em ' + nomeMes(M.mes) + ' · ' + M.empresas.length + ' empresas citadas.'));
    var emp = M.empresas.filter(function (e) { return TC.todas || C.ATV[e.t] || naVip(e.t) || e.carteira; }), mx = Math.max.apply(null, [1].concat(M.empresas.map(function (e) { return e.n_cartas; })));
    var porId = {}; M.cartas.forEach(function (c) { porId[c.id] = c; });
    wrap.appendChild(h('div', {class: 'row', style: 'gap:8px;margin:4px 0 8px'}, h('div', {class: 'sub filt', role: 'toolbar', style: 'margin:0'},
      h('button', {'aria-pressed': !TC.todas ? 'true' : 'false', onclick: function () { TC.todas = false; A.rerender(); }}, 'Empresas das carteiras'),
      h('button', {'aria-pressed': TC.todas ? 'true' : 'false', onclick: function () { TC.todas = true; A.rerender(); }}, 'Todas as citadas'))));
    wrap.appendChild(emp.length ? h('ol', {class: 'tc-l'}, emp.slice(0, 40).map(function (e) {
      var tr = e.trechos || [];
      var det = h('details', {class: 'tc-d'}, h('summary', null, e.gestoras.length + (e.gestoras.length === 1 ? ' gestora' : ' gestoras') + (tr.length ? ' · ' + tr.length + (tr.length === 1 ? ' trecho' : ' trechos') : '')),
        h('ul', null, e.cartas.map(function (id) {
          var c = porId[id]; if (!c) return null;
          var ts = tr.filter(function (t) { return t.carta === id; });
          return h('li', null, h('b', null, c.gestora), ' · ', A.link(c.link) ? h('a', {href: A.link(c.link), target: '_blank', rel: 'noopener'}, c.titulo + ' ↗') : c.titulo,
            ts.map(function (t) { return h('blockquote', {class: 'tc-tr'}, '“' + t.texto + '”'); }));
        })));
      return h('li', {class: 'tc-i'}, h('button', {class: 'tag tk', onclick: function () { abrir(e.t); }, title: 'Abrir a ficha'}, e.t), h('span', {class: 'tc-n'}, e.nome !== e.t ? e.nome : ''), chips(e.t),
        h('span', {class: 'tc-bar', 'aria-hidden': 'true'}, h('i', {style: 'width:' + Math.round(100 * e.n_cartas / mx) + '%'})),
        h('b', {class: 'tc-c'}, e.n_cartas + (e.n_cartas === 1 ? ' carta' : ' cartas')), det);
    })) : h('p', {class: 'empty sm'}, 'Nenhuma empresa das carteiras citada nas cartas lidas deste mês.'));
    var nao = M.cartas.filter(function (c) { return !c.lida; });
    wrap.appendChild(A.more('Cartas do mês (' + M.cartas.length + ')', h('ul', {class: 'lst'}, M.cartas.map(function (c) {
      return h('li', null, h('b', null, c.gestora), ' · ', A.link(c.link) ? h('a', {href: A.link(c.link), target: '_blank', rel: 'noopener'}, c.titulo) : c.titulo,
        h('span', {class: 'muted'}, c.lida ? ' · ' + c.n_empresas + (c.n_empresas === 1 ? ' empresa citada' : ' empresas citadas') : ' · ' + (c.motivo === 'na fila' ? 'na fila de leitura' : (c.motivo === 'sem PDF' || c.motivo === 'vídeo ou sem texto') ? 'vídeo ou link sem texto' : (c.motivo === 'PDF sem texto' || c.motivo === 'sem texto legível') ? 'sem texto legível (PDF de imagem)' : c.motivo === 'robots' ? 'o site não permite leitura automática' : 'não lida (' + c.motivo + ')')));
    }))));
    if (nao.length) wrap.appendChild(h('p', {class: 'hint'}, nao.length + ' carta(s) ainda não lida(s): o robô abre até 6 cartas por rodada; PDF de imagem e vídeo não têm texto para contar.'));
    wrap.appendChild(h('p', {class: 'hint'}, 'Mês da carta: data de publicação na fonte ou, sem ela, o mês escrito no título ou no nome do arquivo. O código e o nome da mesma empresa contam uma vez por carta. Do texto das cartas só ficam até duas frases literais por empresa, com o link para a carta; nada de opinião atribuída.'));
    return wrap;
  }
  function gradeCartas(ms) {
    var meses = ms.slice().reverse(), emp = {};
    meses.forEach(function (m) { (m.empresas || []).forEach(function (e) {
      if (!TC.todas && !(C.ATV[e.t] || naVip(e.t) || e.carteira)) return;
      var o = emp[e.t] = emp[e.t] || {t: e.t, nome: e.nome, por: {}, tot: 0}; o.por[m.mes] = e.n_cartas; o.tot += e.n_cartas; });
    });
    var l = Object.keys(emp).map(function (k) { return emp[k]; }).sort(function (a, b) { return b.tot - a.tot || a.t.localeCompare(b.t); });
    var mx = Math.max.apply(null, [1].concat(l.map(function (o) { return Math.max.apply(null, [0].concat(Object.keys(o.por).map(function (k) { return o.por[k]; }))); })));
    var w = h('div');
    w.appendChild(h('div', {class: 'sub filt', role: 'toolbar', style: 'margin:4px 0 8px'},
      h('button', {'aria-pressed': !TC.todas ? 'true' : 'false', onclick: function () { TC.todas = false; A.rerender(); }}, 'Empresas das carteiras'),
      h('button', {'aria-pressed': TC.todas ? 'true' : 'false', onclick: function () { TC.todas = true; A.rerender(); }}, 'Todas as citadas')));
    if (!l.length) { w.appendChild(h('p', {class: 'empty sm'}, 'Nenhuma empresa citada nas cartas lidas destes meses.')); return w; }
    w.appendChild(h('div', {class: 'tw'}, h('table', {class: 't tc-g'}, h('thead', null, h('tr', null, h('th', null, 'Empresa'), meses.map(function (m) { return h('th', {class: 'r', title: m.n_lidas + ' cartas lidas de ' + m.cartas.length}, nomeMes(m.mes).replace(/ de 20(\d\d)$/, '/$1'), h('small', {class: 'muted', style: 'display:block;font-weight:400'}, m.n_lidas + ' lidas')); }), h('th', {class: 'r'}, 'Total'))),
      h('tbody', null, l.slice(0, 60).map(function (o) {
        return h('tr', null, h('td', null, h('button', {class: 'tag tk', onclick: function () { abrir(o.t); }}, o.t), ' ', h('span', {class: 'muted'}, o.nome !== o.t ? o.nome : ''), chips(o.t)),
          meses.map(function (m) { var n = o.por[m.mes] || 0; return h('td', {class: 'r tc-cel' + (n ? '' : ' z'), style: n ? '--a:' + (0.15 + 0.85 * n / mx).toFixed(2) : null, title: n + (n === 1 ? ' carta citou ' : ' cartas citaram ') + o.t + ' em ' + nomeMes(m.mes)}, n ? String(n) : '·'); }),
          h('td', {class: 'r'}, h('b', null, String(o.tot))));
      })))));
    w.appendChild(h('p', {class: 'hint'}, 'Quantas cartas citaram cada empresa em cada mês. Meses com poucas cartas lidas pesam pouco: compare com a linha "lidas" do cabeçalho. Contagem, não opinião.'));
    return w;
  }

  /* ---------- Quem tem a ação (CVM, carteira dos fundos) ---------- */
  function brl(v) { if (v == null || !isFinite(v)) return '—'; var a = Math.abs(v); return 'R$ ' + (a >= 1e9 ? A.num(a / 1e9, 2) + ' bi' : a >= 1e6 ? A.num(a / 1e6, 1) + ' mi' : A.num(a, 0)); }
  var QF = {ver: 'carteiras'};
  function fundos() {
    var wrap = h('div');
    wrap.appendChild(A.pageHead('Brasil', 'Quem tem a ação', 'Fundos brasileiros que têm cada ação das carteiras Oregon e VG VIP, pela carteira mensal que os fundos entregam à CVM (dados abertos). Mostra quantos fundos, quanto têm, os maiores e quem entrou ou saiu frente ao mês anterior lido.'));
    var a = A.arquivo('biblioteca/fundos_acoes.json'); if (!a.dados) { wrap.appendChild(estado(a, 'a carteira dos fundos')); return wrap; }
    var d = a.dados;
    if (d.erro) wrap.appendChild(h('div', {class: 'alert'}, 'A última leitura da CVM não achou as colunas esperadas (' + d.erro + '). O robô guardou o cabeçalho para ajuste; o que aparece abaixo é a leitura anterior.'));
    wrap.appendChild(h('p', {class: 'vip-print'}, 'Carteiras de ' + nomeMes(d.mes) + (d.mes_anterior ? ', comparadas com ' + nomeMes(d.mes_anterior) : ' (a comparação com o mês anterior começa na próxima leitura)') + '. A CVM publica com defasagem e o fundo pode deixar posições em sigilo por um tempo: elas ficam fora.'));
    var rows = Object.keys(d.ativos || {}).map(function (t) { var o = d.ativos[t]; return Object.assign({t: t}, o); })
      .filter(function (r) { return QF.ver === 'todas' || r.carteira === 'oregon' || r.carteira === 'vip'; });
    var tab = A.table([
      {k: 't', t: 'Ativo', f: function (r) { return h('span', {class: 'vip-tk'}, h('b', null, r.t), h('small', null, r.nome)); }},
      {k: 'c', t: 'Carteira', f: function (r) { return h('span', null, chips(r.t)); }, s: false},
      {k: 'n_fundos', t: 'Fundos', r: 1},
      {k: 'valor', t: 'Valor nos fundos', r: 1, f: function (r) { return brl(r.valor); }},
      {k: 'entraram', t: 'Entraram', r: 1, f: function (r) { return r.entraram == null ? '—' : String(r.entraram); }},
      {k: 'sairam', t: 'Saíram', r: 1, f: function (r) { return r.sairam == null ? '—' : String(r.sairam); }},
      {k: 'g', t: 'Maior gestora', f: function (r) { var g = (r.gestoras || [])[0]; return g ? g.gestora : '—'; }, s: false}
    ], rows, {sort: 'valor', search: 'Filtrar ativos', onRow: function (r) { QF.det = r.t; A.rerender(); }});
    wrap.appendChild(A.sec('Ações das carteiras', {flush: true, badge: h('span', {class: 'sec-n'}, rows.length + ' ações'), hint: 'Toque numa linha para ver os maiores fundos e gestoras.'}, tab));
    if (QF.det && d.ativos[QF.det]) wrap.appendChild(detalheFundos(QF.det, d.ativos[QF.det], d));
    wrap.appendChild(h('p', {class: 'hint'}, 'Fonte: ' + (d.fonte || 'CVM') + '. Valor de mercado da posição no fim do mês, como o fundo informou; gestora pelo cadastro de fundos da CVM. Não é recomendação de ninguém: fundo de índice também aparece.'));
    return wrap;
  }
  function detalheFundos(t, o, d) {
    return A.sec(t + ' · ' + (o.nome || ''), {badge: h('span', {class: 'sec-n'}, o.n_fundos + ' fundos · ' + brl(o.valor)), right: h('button', {class: 'btn link', onclick: function () { abrir(t); }}, 'Ficha ↗')},
      h('div', {class: 'grid2'}, h('div', null, h('h4', null, 'Maiores fundos'), h('ol', {class: 'lst'}, (o.maiores || []).map(function (m) { return h('li', null, m.fundo, h('span', {class: 'muted'}, ' · ' + (m.gestora || 'gestora não informada') + ' · ' + brl(m.valor))); }))),
        h('div', null, h('h4', null, 'Maiores gestoras'), h('ol', {class: 'lst'}, (o.gestoras || []).map(function (g) { return h('li', null, g.gestora, h('span', {class: 'muted'}, ' · ' + brl(g.valor))); })),
          (o.novos || []).length ? [h('h4', null, 'Fundos que entraram'), h('ul', {class: 'lst'}, o.novos.map(function (n) { return h('li', null, n); }))] : null)));
  }
  // bloco curto na ficha (Oregon e VIP)
  A.fundosNaFicha = function (t) {
    var a = A.arquivo('biblioteca/fundos_acoes.json'), o = a.dados && a.dados.ativos && a.dados.ativos[t];
    if (!o) return null;
    return h('div', {class: 'br-ficha'}, h('h4', {class: 'np-sub'}, 'Quem tem a ação · fundos (' + nomeMes(a.dados.mes) + ')'),
      h('p', null, h('b', null, o.n_fundos + ' fundos'), ' · ' + brl(o.valor) + (o.entraram != null ? ' · ' + o.entraram + ' entraram, ' + o.sairam + ' saíram' : '')),
      (o.gestoras || []).length ? h('p', {class: 'muted', style: 'font-size:.84rem;margin:0'}, 'Maiores gestoras: ' + o.gestoras.slice(0, 3).map(function (g) { return g.gestora; }).join(', ')) : null,
      h('button', {class: 'btn link', onclick: function () { QF.det = t; A.go('brasil', 'fundos'); }}, 'Ver fundos ↗'));
  };

  /* ---------- Agenda de proventos (B3) ---------- */
  var PV = {ver: 'proximos'};
  function precoRef(t) {
    var V = vip().ativos, v = Object.keys(V).map(function (k) { return V[k]; }).filter(function (x) { return x.ticker === t && x.preco != null; })[0];
    if (v) return {p: v.preco, f: 'print VIP ' + ((A.VIP && A.VIP.print_em) || '')};
    var o = C.ATV[t]; if (o && o.cotacao) return {p: o.cotacao, f: 'Teses ' + (o.data_preco || '')};
    return null;
  }
  function dataBR(d) { return d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '—'; }
  function proventos() {
    var wrap = h('div'), hoje = I.hojeBRT();
    wrap.appendChild(A.pageHead('Brasil', 'Agenda de proventos', 'Dividendos, JCP e rendimentos anunciados pelas empresas das carteiras Oregon e VG VIP, como a B3 publica: data de aprovação, data-com (último dia para ter direito), pagamento e valor bruto por ação.'));
    var a = A.arquivo('biblioteca/proventos.json'); if (!a.dados) { wrap.appendChild(estado(a, 'a agenda de proventos')); return wrap; }
    var d = a.dados, at = d.ativos || {}, ev = [];
    Object.keys(at).forEach(function (t) { (at[t].eventos || []).forEach(function (e) { ev.push(Object.assign({t: t}, e)); }); });
    wrap.appendChild(h('div', {class: 'sub filt', role: 'toolbar', 'aria-label': 'Visão'}, [['proximos', 'Próximas datas'], ['ano', 'Anunciado no ano'], ['todos', 'Todos os anúncios']].map(function (o) { return h('button', {'aria-pressed': PV.ver === o[0] ? 'true' : 'false', onclick: function () { PV.ver = o[0]; A.rerender(); }}, o[1]); })));
    if (PV.ver === 'ano') {
      var ano = hoje.slice(0, 4), rows = Object.keys(at).map(function (t) { var r = at[t].resumo || {}, pr = precoRef(t); return {t: t, nome: at[t].nome, total: r.total_ano || 0, n: r.n_ano || 0, dy: pr && r.total_ano ? r.total_ano / pr.p : null, pf: pr ? pr.f : null, ult: r.ultimo_anuncio}; }).filter(function (r) { return r.n; });
      wrap.appendChild(A.sec('Proventos com data-com em ' + ano, {flush: true, hint: 'Soma do valor bruto por ação anunciado com data-com no ano. O DY usa o preço de referência indicado (print da VIP ou Teses da Oregon), não a cotação do dia.'},
        A.table([{k: 't', t: 'Ativo', f: function (r) { return h('span', {class: 'vip-tk'}, h('b', null, r.t), h('small', null, r.nome)); }}, {k: 'c', t: 'Carteira', s: false, f: function (r) { return h('span', null, chips(r.t)); }},
          {k: 'total', t: 'R$ por ação', r: 1, f: function (r) { return 'R$ ' + A.num(r.total, 4); }}, {k: 'n', t: 'Anúncios', r: 1},
          {k: 'dy', t: 'DY ' + ano + ' (ref.)', r: 1, f: function (r) { return r.dy == null ? '—' : h('span', {title: 'Preço de referência: ' + r.pf}, A.num(100 * r.dy, 2) + '%'); }},
          {k: 'ult', t: 'Último anúncio', f: function (r) { return dataBR(r.ult); }}], rows, {sort: 'dy', onRow: function (r) { abrir(r.t); }})));
    } else {
      var tabela = function (l, vazio) {
        return l.length ? h('div', {class: 'tw'}, h('table', {class: 't pv-t'}, h('thead', null, h('tr', null, ['Ativo', 'Tipo', 'Data-com', 'Pagamento', 'R$ por ação', 'Referente a', 'Aprovado em'].map(function (x, i) { return h('th', {class: i === 4 ? 'r' : null}, x); }))),
          h('tbody', null, l.slice(0, 120).map(function (e) {
            var futCom = e.data_com && e.data_com >= hoje, futPag = e.pagamento && e.pagamento >= hoje;
            return h('tr', {class: futCom ? 'pv-fut' : null, onclick: function () { abrir(e.t); }, style: 'cursor:pointer'}, h('td', null, h('b', null, e.t), ' ', chips(e.t)), h('td', null, e.tipo), h('td', null, dataBR(e.data_com), futCom ? h('span', {class: 'pv-tag'}, 'a vir') : null),
              h('td', null, dataBR(e.pagamento), !futCom && futPag && PV.ver === 'proximos' ? h('span', {class: 'pv-tag'}, 'a receber') : null),
              h('td', {class: 'r num'}, e.valor == null ? '—' : A.num(e.valor, 4)), h('td', null, e.referente || '—'), h('td', null, dataBR(e.aprovado)));
          })))) : h('p', {class: 'empty'}, vazio);
      };
      if (PV.ver === 'proximos') {
        // v3.6 · duas listas: o que ainda dá direito (data-com à frente) e o que já tem direito e falta pagar
        var dc = ev.filter(function (e) { return e.data_com && e.data_com >= hoje; }).sort(function (x, y) { return x.data_com.localeCompare(y.data_com); });
        var pg = ev.filter(function (e) { return !(e.data_com && e.data_com >= hoje) && e.pagamento && e.pagamento >= hoje; }).sort(function (x, y) { return x.pagamento.localeCompare(y.pagamento); });
        wrap.appendChild(A.sec('Data-com à frente', {flush: true, hint: 'Último dia para ter direito ainda não passou.'}, tabela(dc, 'Nenhuma data-com à frente nos anúncios lidos.')));
        wrap.appendChild(A.sec('Pagamentos a receber', {flush: true, hint: 'A data-com já passou; o pagamento ainda vai cair. Ordenado pela data de pagamento.'}, tabela(pg, 'Nenhum pagamento à frente nos anúncios lidos.')));
      } else {
        var l = ev.slice().sort(function (x, y) { return String(y.data_com || '').localeCompare(String(x.data_com || '')); });
        wrap.appendChild(tabela(l, 'Nenhum anúncio lido.'));
      }
    }
    wrap.appendChild(h('p', {class: 'hint'}, 'Fonte: ' + (d.fonte || 'B3') + ', lida uma vez por dia. Valor bruto (JCP antes do imposto). Para units, o valor é o da unit. ' + ((d.erros || []).length ? 'Não lidas na última rodada: ' + d.erros.slice(0, 6).join(', ') + '.' : '')));
    return wrap;
  }
  A.proventosNaFicha = function (t) {
    var a = A.arquivo('biblioteca/proventos.json'), o = a.dados && a.dados.ativos && a.dados.ativos[t];
    if (!o || !(o.eventos || []).length) return null;
    var r = o.resumo || {}, pr = precoRef(t), hoje = I.hojeBRT();
    return h('div', {class: 'br-ficha'}, h('h4', {class: 'np-sub'}, 'Proventos anunciados (B3)'),
      h('p', null, h('b', null, 'R$ ' + A.num(r.total_ano || 0, 4) + ' por ação'), ' com data-com em ' + r.ano + ' (' + (r.n_ano || 0) + ' anúncios)' + (pr && r.total_ano ? ' · DY ' + A.num(100 * r.total_ano / pr.p, 2) + '% pelo preço de ' + pr.f : '')),
      h('ul', {class: 'lst'}, o.eventos.slice(0, 4).map(function (e) { return h('li', {class: e.data_com && e.data_com >= hoje ? 'pv-fut' : null}, e.tipo + ' · R$ ' + A.num(e.valor, 4) + ' · data-com ' + dataBR(e.data_com) + ' · paga ' + dataBR(e.pagamento)); })),
      h('button', {class: 'btn link', onclick: function () { PV.ver = 'todos'; A.go('brasil', 'proventos'); }}, 'Agenda completa ↗'));
  };
  // Hoje: datas-com e pagamentos dos próximos 14 dias (Oregon), para a Agenda decisiva
  A.proventosProximos = function (dias, soOregon) {
    var a = A.arquivo('biblioteca/proventos.json'); if (!a.dados) return [];
    var hoje = I.hojeBRT(), lim = new Date(Date.now() + (dias || 14) * 864e5).toISOString().slice(0, 10), out = [];
    Object.keys(a.dados.ativos || {}).forEach(function (t) {
      if (soOregon && !C.ATV[t]) return;
      (a.dados.ativos[t].eventos || []).forEach(function (e) { if (e.data_com && e.data_com >= hoje && e.data_com <= lim) out.push(Object.assign({t: t, k: 'data-com', d: e.data_com}, e)); else if (e.pagamento && e.pagamento >= hoje && e.pagamento <= lim) out.push(Object.assign({t: t, k: 'pagamento', d: e.pagamento}, e)); });
    });
    return out.sort(function (x, y) { return x.d.localeCompare(y.d); });
  };

  /* ---------- rotas ---------- */
  A.BR36 = {termometro: termometro, rotas: {fundos: fundos, proventos: proventos}};
  A.SUBS.brasil.push(['proventos', 'Agenda de proventos'], ['fundos', 'Quem tem a ação'], ['cartas', 'Termômetro das cartas']);
  var orig = A.areas.brasil;
  A.areas.brasil = function () {
    var s = S.sub.brasil, f = s === 'cartas' ? termometro : (A.BR36.rotas || {})[s];
    if (!f) return orig();
    var w = h('div'); w.appendChild(A.subnav('brasil', A.SUBS.brasil)); w.appendChild(f()); return w;
  };
})(APP, CORE, INTEL);
