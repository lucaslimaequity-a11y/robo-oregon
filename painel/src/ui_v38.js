/* v3.8 · Brasil › Fluxo dos fundos: captação menos resgate dos fundos brasileiros por classe (CVM, informe diário),
   semana a semana e mês a mês. Fundos de cotas ficam de fora (contariam duas vezes). Só o que os fundos informaram. */
(function (A, C, I) {
  'use strict';
  var h = A.h;
  var NOMES = {acoes: 'Ações', multimercado: 'Multimercado', renda_fixa: 'Renda Fixa', cambial: 'Cambial', outros: 'Outros'};
  var ORD = ['acoes', 'multimercado', 'renda_fixa', 'cambial'];
  function brl(v) {
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v), s = v < 0 ? '−' : v > 0 ? '+' : '';
    return s + 'R$ ' + (a >= 1e9 ? A.num(a / 1e9, 2) + ' bi' : a >= 1e6 ? A.num(a / 1e6, 0) + ' mi' : A.num(a, 0));
  }
  A.fluxoBRL = brl;
  function dm(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—'; }
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function nomeMes(m) { return MESES[+m.slice(5, 7) - 1] + '/' + m.slice(2, 4); }
  A.fluxoSemana = function (de) {
    var a = A.arquivo('biblioteca/fluxo_fundos.json'); if (!a.dados) return null;
    return (a.dados.semanas || []).filter(function (s) { return s.de === de; })[0] || null;
  };
  A.fluxoLinha = function (s) {
    if (!s) return null;
    return ORD.filter(function (k) { return s.c[k] != null; }).map(function (k) { return NOMES[k] + ' ' + brl(s.c[k]); }).join(' · ');
  };
  // barra divergente: zero no meio; comprimento pelo maior valor absoluto da tabela
  function barra(v, mx) {
    var w = mx ? Math.min(50, 50 * Math.abs(v) / mx) : 0;
    return h('span', {class: 'fx-bar', 'aria-hidden': 'true'}, h('i', {class: v < 0 ? 'neg' : 'pos', style: (v < 0 ? 'right:50%;' : 'left:50%;') + 'width:' + w.toFixed(1) + '%'}));
  }
  function tabela(linhas, rotulo, chaveAcoes) {
    var mx = Math.max.apply(null, [1].concat(linhas.map(function (o) { return Math.abs(o.c.acoes || 0); })));
    return h('div', {class: 'tw'}, h('table', {class: 't fx-t'},
      h('thead', null, h('tr', null, h('th', null, rotulo), h('th', {class: 'fx-ac'}, 'Ações'), ORD.slice(1).map(function (k) { return h('th', {class: 'r'}, NOMES[k]); }))),
      h('tbody', null, linhas.map(function (o) {
        var v = o.c.acoes || 0;
        return h('tr', null, h('td', {class: 'num'}, chaveAcoes(o)),
          h('td', {class: 'fx-ac'}, h('span', {class: 'fx-v num'}, brl(o.c.acoes)), barra(v, mx)),
          ORD.slice(1).map(function (k) { return h('td', {class: 'r num'}, brl(o.c[k])); }));
      }))));
  }
  function pagina() {
    var wrap = h('div', null, A.pageHead('Brasil', 'Fluxo dos fundos', 'Dinheiro entrando ou saindo dos fundos brasileiros, por classe: captação menos resgate que cada fundo informa à CVM todo dia (informe diário). Fundos de cotas ficam de fora para não contar duas vezes o mesmo dinheiro. É fluxo informado, não previsão.'));
    var a = A.arquivo('biblioteca/fluxo_fundos.json');
    if (!a.dados) { wrap.appendChild(h('p', {class: 'empty'}, a.carregando ? 'Carregando o fluxo dos fundos…' : a.ausente ? 'O robô ainda não publicou o fluxo dos fundos: ele lê a CVM uma vez por dia, a partir das 9h.' : 'Não consegui ler o fluxo dos fundos agora (' + (a.erro || '') + ').')); return wrap; }
    var d = a.dados, sem = (d.semanas || []).slice(-12).reverse(), mes = (d.meses || []).slice(-12).reverse();
    if (!sem.length) { wrap.appendChild(h('p', {class: 'empty'}, 'Sem dias lidos ainda.')); return wrap; }
    var ult = (d.dias || []).slice(-1)[0], s0 = sem[0], m0 = mes[0];
    wrap.appendChild(h('div', {class: 'fx-res'},
      h('p', null, h('b', null, 'Semana de ' + dm(s0.de) + ' a ' + dm(s0.ate)), s0.dias < 5 ? h('span', {class: 'muted'}, ' (' + s0.dias + (s0.dias > 1 ? ' dias informados' : ' dia informado') + ')') : null, ': ', A.fluxoLinha(s0)),
      m0 ? h('p', null, h('b', null, 'No mês de ' + nomeMes(m0.mes) + (ult && ult.d.slice(0, 7) === m0.mes ? ' até ' + dm(ult.d) : '')), ': ', A.fluxoLinha(m0)) : null));
    wrap.appendChild(A.sec('Semana a semana', {flush: true, badge: h('span', {class: 'sec-n'}, 'últimas ' + sem.length), hint: 'Segunda a domingo. A barra mostra o fluxo dos fundos de ações: para a direita, entrou dinheiro; para a esquerda, saiu.'},
      tabela(sem, 'Semana', function (o) { return dm(o.de) + ' a ' + dm(o.ate); })));
    if (mes.length) wrap.appendChild(A.sec('Mês a mês', {flush: true, badge: h('span', {class: 'sec-n'}, 'últimos ' + mes.length)}, tabela(mes, 'Mês', function (o) { return nomeMes(o.mes); })));
    var lido = d.lido || {};
    wrap.appendChild(h('p', {class: 'hint'}, 'Fonte: ' + (d.fonte || 'CVM') + '. Última leitura: ' + (lido.meses || []).join(' e ') + (lido.linhas ? ' · ' + A.num(lido.linhas, 0) + ' linhas · ' + A.num(lido.fic_fora || 0, 0) + ' de fundos de cotas fora · ' + A.num(lido.sem_classe || 0, 0) + ' sem classe no cadastro (em "Outros")' : '') + '. ' + (d.nota || '')));
    return wrap;
  }
  A.SUBS.brasil.push(['fluxo', 'Fluxo dos fundos']);
  var orig = A.areas.brasil;
  A.areas.brasil = function () {
    if (A.S.sub.brasil !== 'fluxo') return orig.apply(this, arguments);
    return h('div', null, A.subnav('brasil', A.SUBS.brasil, 'fluxo'), pagina());
  };
})(APP, CORE, INTEL);
