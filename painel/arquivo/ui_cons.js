/* Construção de Portfólio — laboratório de propostas, antes × depois, dimensionamento, otimização, comparação, limites */
(function (A, C) {
  'use strict';
  var h = A.h, S = A.S;
  var W = A.W = {propId: null, pos: null, nome: '', caixa: false, movs: [], dirty: false, sel: null, pend: {}};

  function propAtual() { return S.ver.indexOf('prop:') === 0 ? STORE.get('propostas', S.ver.slice(5)) : null; }
  function carregarW(p) { W.propId = p.id; W.pos = C.clone(p.pos); W.nome = p.nome; W.caixa = !!p.caixaDeliberado; W.movs = C.clone(p.movs || []); W.dirty = false; W.pend = {}; W.origem = p.origem; }
  function versaoW() { return {kind: 'proposta', id: W.propId, cart: S.cart, rotulo: 'Proposta · ' + W.nome, pos: W.pos, alvo: null, bandas: C.estrategica(S.cart).bandas, caixaDeliberado: W.caixa}; }

  A.novaProposta = async function (pos, nome, origem, nota) {
    var p = await STORE.salvarProposta({cart: S.cart, nome: nome || 'Proposta ' + new Date().toLocaleDateString('pt-BR'), pos: C.clone(pos), origem: origem || 'manual', status: 'rascunho', base: A.versao('aprovada').id, nota: nota || ''});
    S.ver = 'prop:' + p.id; carregarW(p); A.go('cons', 'editor'); A.toast('Proposta criada. A carteira aprovada não muda.');
  };
  // Correção sugerida: só aplica a regra registrada no Para estudar (e1): P2 interno 50/20/30 (IRFM11/5PRE11/IDKA11), como no Crescimento Conservador.
  A.novaPropostaCorrecao = function () {
    var v = A.versao('aprovada'), pos = C.clone(v.pos), notas = [];
    var alvoP2 = (C.estrategica(S.cart).alvo || {}).P2;
    var p2 = pos.filter(function (x) { return x.p === 'P2'; }), split = {IRFM11: 0.5, '5PRE11': 0.2, IDKA11: 0.3};
    var interno = C.sum(p2, function (x) { return x.wp || 0; });
    if (alvoP2 && p2.length && !C.near(interno, 1) && p2.every(function (x) { return split[x.t] != null; })) {
      p2.forEach(function (x) { x.w = alvoP2 * split[x.t]; x.wp = split[x.t]; });
      notas.push('P2 com pesos internos 50/20/30 (IRFM11/5PRE11/IDKA11), regra do Crescimento Conservador citada no Para estudar e1.');
    }
    if (/^intl/.test(S.cart)) notas.push('P13 fica fora: o Comitê precisa definir os ativos e de quais pilares sai o peso (e2).');
    var ph = pos.filter(function (x) { return C.ATV[x.t] && C.ATV[x.t].status === 'placeholder'; });
    if (ph.length) notas.push('Os ' + ph.length + ' placeholders do P3 continuam marcados como lacuna: substitua por produtos aprovados antes de aprovar.');
    if (!notas.length) notas.push('Nenhuma regra de correção registrada se aplica; a proposta copia a aprovada para você ajustar.');
    A.novaProposta(pos, 'Correção · ' + C.MAND[S.cart].rotulo, 'correcao', 'Sugestão da ferramenta, não decidida pelo Comitê. ' + notas.join(' '));
  };

  A.areas.cons = function () {
    var wrap = h('div');
    var p = propAtual();
    if (p && W.propId !== p.id) carregarW(p);
    if (!p) { W.propId = null; }
    wrap.appendChild(A.subnav('cons', [['editor', 'Laboratório'], ['sizing', 'Dimensionamento'], ['otim', 'Otimização'], ['comparar', 'Comparar carteiras'], ['limites', 'Limites e retornos esperados']]));
    var sub = S.sub.cons;
    if (sub === 'editor') wrap.appendChild(editor(p));
    else if (sub === 'sizing') wrap.appendChild(sizing(p));
    else if (sub === 'otim') wrap.appendChild(otimizacao(p));
    else if (sub === 'comparar') wrap.appendChild(comparar());
    else wrap.appendChild(limites());
    return wrap;
  };

  /* ---------- barra da proposta ---------- */
  function barra(p) {
    var props = STORE.propostas(S.cart);
    var sel = h('select', {class: 'inp', 'aria-label': 'Proposta', onchange: function () { if (W.dirty && !confirm('Há mudanças não salvas. Descartar?')) { sel.value = p ? p.id : ''; return; } S.ver = sel.value ? 'prop:' + sel.value : 'aprovada'; A.render(); }},
      h('option', {value: ''}, '— ver a aprovada (somente leitura) —'), props.map(function (x) { return h('option', {value: x.id, selected: p && p.id === x.id || null}, x.nome + ' · ' + x.status); }));
    var ap = A.versao('aprovada');
    var out = h('div', {class: 'row', style: 'margin-bottom:12px'}, sel,
      h('button', {class: 'btn', onclick: function () { A.novaProposta(ap.pos); }}, 'Nova proposta a partir da aprovada'),
      A.valida(ap).status === 'invalida' ? h('button', {class: 'btn', onclick: A.novaPropostaCorrecao}, 'Proposta de correção (sugerida)') : null,
      p ? h('button', {class: 'btn', onclick: function () { A.novaProposta(W.pos, 'Cópia de ' + W.nome, 'manual'); }}, 'Duplicar') : null,
      p && p.status === 'rascunho' ? h('button', {class: 'btn danger', onclick: async function () { if (!confirm('Excluir o rascunho “' + p.nome + '”?')) return; await STORE.del('propostas', p.id); await STORE.audit('proposta excluída', p.nome, p.id); S.ver = 'aprovada'; A.render(); }}, 'Excluir rascunho') : null);
    return out;
  }

  /* ---------- editor ---------- */
  function editor(p) {
    var wrap = h('div');
    wrap.appendChild(barra(p));
    var ap = A.versao('aprovada');
    if (!p) {
      var val = A.valida(ap);
      wrap.appendChild(h('div', {class: 'alert'}, 'Você está vendo a carteira aprovada, que só muda com um registro de aprovação. Crie uma proposta para simular compras, vendas e trocas: o antes × depois aparece ao lado durante toda a simulação.'));
      if (val.status === 'invalida') wrap.appendChild(h('div', {class: 'alert bad'}, 'A aprovada desta carteira é inválida (' + A.pct(val.total) + '). Para analisar risco, crie a proposta de correção sugerida ou ajuste os pesos numa proposta.'));
      wrap.appendChild(A.sec('Composição aprovada', {flush: true}, tabelaLeitura(ap)));
      return wrap;
    }
    var g = h('div', {class: 'grid-lab'}), L = h('div'), R = h('div', {class: 'sticky'}); g.append(L, R); wrap.appendChild(g);
    var vW = versaoW(), val2 = A.valida(vW);
    // cabeçalho da proposta
    var nome = h('input', {class: 'inp', value: W.nome, 'aria-label': 'Nome da proposta', style: 'min-width:260px', oninput: function () { W.nome = nome.value; W.dirty = true; }});
    var st = p.status;
    L.appendChild(A.sec('Proposta', {badge: A.chip(st, st === 'aprovada' ? 'o-obs' : st === 'rejeitada' ? 'g-critica' : st === 'em_comite' ? 'g-media' : ''), right: [
      h('button', {class: 'btn pri', disabled: st === 'aprovada' || null, onclick: salvar}, 'Salvar versão'),
      h('button', {class: 'btn', disabled: st !== 'rascunho' || null, onclick: async function () { await salvar(); p = STORE.get('propostas', W.propId); p.status = 'em_comite'; p.notaVersao = 'enviada ao Comitê'; await STORE.salvarProposta(p); A.render(); }}, 'Enviar ao Comitê'),
      h('button', {class: 'btn', disabled: st === 'aprovada' || st === 'rejeitada' || null, onclick: function () { formAprovacao(p); }}, 'Registrar decisão'),
      h('button', {class: 'btn', onclick: function () { exportar(p); }}, 'Exportar CSV')
    ]}, [
      h('div', {class: 'row'}, nome, p.origem ? A.chip('origem: ' + p.origem, p.origem === 'ia' ? 'o-ia' : '') : null, h('span', {class: 'muted'}, 'criada ' + A.dataBR(p.criado))),
      p.nota ? h('div', {class: 'alert warn'}, p.nota) : null,
      W.dirty ? h('div', {class: 'alert'}, 'Mudanças não salvas.') : null
    ]));
    // tabela de edição
    L.appendChild(A.sec('Posições', {flush: true, mtd: 'financiamento', hint: 'Altere o peso proposto e diga de onde vem o dinheiro (ou para onde vai). O ajuste só é aplicado com a contrapartida escolhida; “sem contrapartida” deixa a soma aberta.'}, tabelaEdicao(ap)));
    // rodapé de soma
    var tot = C.sum(W.pos, function (x) { return x.w; });
    var fecha = C.near(tot, 1);
    L.appendChild(h('div', {class: 'alert ' + (fecha ? 'ok' : (W.caixa && tot < 1 ? 'warn' : 'bad'))},
      h('b', null, 'Soma da proposta: ' + A.pct(tot, 2) + '. '),
      fecha ? 'Fecha em 100%.' : tot < 1 ? h('span', null, 'Faltam ' + A.pp(1 - tot) + '. ', h('label', null, h('input', {type: 'checkbox', checked: W.caixa || null, onchange: function (e) { W.caixa = e.target.checked; W.dirty = true; A.render(); }}), ' Caixa residual deliberado (fica registrado na proposta)')) : 'Passa ' + A.pp(tot - 1) + ' de 100%: reduza alguma posição.'));
    L.appendChild(A.sec('Validação da proposta', {flush: false}, A.issuesList(val2.issues.filter(function (i) { return i.g !== 'info'; }))));
    // movimentos
    if (W.movs.length) L.appendChild(A.sec('Movimentos registrados', {flush: true}, A.table([
      {k: 't', t: 'Ativo'}, {k: 'de', t: 'De', r: 1, f: function (m) { return A.pct(m.antes, 2); }}, {k: 'para', t: 'Para', r: 1, f: function (m) { return A.pct(m.para, 2); }},
      {k: 'fonte', t: 'Financiamento / destino', f: function (m) { return fonteTxt(m); }}, {k: 'q', t: 'Quando', f: function (m) { return new Date(m.quando).toLocaleString('pt-BR'); }}
    ], W.movs.slice().reverse())));
    R.appendChild(antesDepois(ap, vW));
    return wrap;
  }
  function fonteTxt(m) { return m.fonte === 'reduzir' ? 'reduz ' + m.de : m.fonte === 'destino' ? 'vai para ' + m.de : m.fonte === 'prorata' ? 'pro rata do ' + m.pilar : m.fonte === 'aporte' ? 'aporte novo (' + A.pct(m.aporte || 0, 2) + ' do patrimônio)' : m.fonte === 'prorata_todas' ? 'pro rata das posições investíveis' : 'sem contrapartida'; }

  function tabelaLeitura(v) {
    return A.table([
      {k: 't', t: 'Ativo', f: function (x) { return h('span', null, h('b', null, x.t), ' ', h('span', {class: 'muted'}, C.ATV[x.t] ? C.ATV[x.t].nome : '')); }},
      {k: 'p', t: 'Pilar'}, {k: 'st', t: 'Status', f: function (x) { return C.ATV[x.t] ? A.stchip(C.ATV[x.t].status) : '—'; }},
      {k: 'wp', t: 'No pilar', r: 1, f: function (x) { return x.wp == null ? '—' : A.pct(x.wp, 0); }},
      {k: 'w', t: 'Peso', r: 1, f: function (x) { return A.pct(x.w, 2); }}
    ], v.pos, {sort: 'p', dir: 1, search: 'Filtrar'});
  }

  function tabelaEdicao(ap) {
    var mapA = {}; ap.pos.forEach(function (x) { mapA[x.t] = (mapA[x.t] || 0) + x.w; });
    var editavel = !(propAtual() && /aprovada|rejeitada/.test(propAtual().status));
    var tickers = W.pos.map(function (x) { return x.t; });
    var rows = W.pos.map(function (x) { return x; });
    var tbl = A.table([
      {k: 't', t: 'Ativo', f: function (x) { return h('span', null, A.tk(x.t), ' ', h('span', {class: 'muted'}, C.ATV[x.t] ? C.ATV[x.t].nome : '')); }},
      {k: 'p', t: 'Pilar'},
      {k: 'st', t: 'Status', f: function (x) { return C.ATV[x.t] ? A.stchip(mapA[x.t] == null ? 'proposta' : C.ATV[x.t].status) : '—'; }},
      {k: 'a', t: 'Aprovada', r: 1, f: function (x) { return A.pct(mapA[x.t] || 0, 2); }, s: function (x) { return mapA[x.t] || 0; }},
      {k: 'w', t: 'Proposta', r: 1, f: function (x) {
        if (!editavel) return A.pct(x.w, 2);
        var pend = W.pend[x.t];
        var inp = h('input', {class: 'inp n', type: 'number', step: '0.25', min: 0, max: 100, value: +(100 * (pend != null ? pend : x.w)).toFixed(4), 'aria-label': 'Peso proposto de ' + x.t + ' em %',
          onchange: function () { var v = Number(inp.value) / 100; if (!isFinite(v) || v < 0) return; if (Math.abs(v - x.w) < 1e-9) { delete W.pend[x.t]; } else W.pend[x.t] = v; A.render(); }});
        return inp;
      }, s: function (x) { return x.w; }},
      {k: 'd', t: 'Δ', r: 1, f: function (x) { var d = x.w - (mapA[x.t] || 0); return h('span', {class: A.cls(d)}, Math.abs(d) < 1e-9 ? '—' : A.pp(d)); }, s: function (x) { return x.w - (mapA[x.t] || 0); }},
      {k: 'f', t: 'Financiamento', s: false, cls: 'nw', f: function (x) {
        if (!editavel) return '';
        var pend = W.pend[x.t];
        if (pend == null) return h('span', {class: 'row', style: 'gap:4px'}, x.w > 0 ? h('button', {class: 'btn sm', onclick: function () { W.pend[x.t] = 0; A.render(); }}, 'Zerar') : null, h('button', {class: 'btn sm', onclick: function () { substituir(x); }}, 'Substituir'));
        var sobe = pend > x.w;
        var opts = [h('option', {value: ''}, sobe ? 'De onde vem o dinheiro?' : 'Para onde vai o dinheiro?')];
        if (sobe && tickers.indexOf('LFTB11') >= 0 && x.t !== 'LFTB11') opts.push(h('option', {value: 'reduzir:LFTB11'}, 'Caixa: reduzir LFTB11'));
        if (!sobe && x.t !== 'LFTB11') opts.push(h('option', {value: 'destino:LFTB11'}, 'Caixa: LFTB11'));
        opts.push(h('option', {value: 'prorata:' + x.p}, (sobe ? 'Reduzir' : 'Distribuir') + ' pro rata no ' + x.p));
        W.pos.filter(function (y) { return y.t !== x.t && (!sobe || y.w > 0); }).forEach(function (y) { opts.push(h('option', {value: (sobe ? 'reduzir:' : 'destino:') + y.t}, (sobe ? 'Reduzir ' : 'Aumentar ') + y.t + ' (' + A.pct(y.w, 1) + ')')); });
        if (sobe) opts.push(h('option', {value: 'aporte'}, 'Aporte novo'));
        opts.push(h('option', {value: 'livre'}, 'Sem contrapartida (fechar depois)'));
        var sel = h('select', {class: 'inp', style: 'max-width:230px;border-color:var(--warn)', 'aria-label': 'Financiamento de ' + x.t, onchange: function () { if (sel.value) aplicar(x.t, pend, sel.value); }}, opts);
        return h('span', {class: 'row', style: 'gap:4px'}, sel, h('button', {class: 'btn sm', onclick: function () { delete W.pend[x.t]; A.render(); }}, 'Cancelar'));
      }}
    ], rows, {sort: 'p', dir: 1, onRow: function (x) { W.sel = x.t; A.render(); }, rowClass: function (x) { return W.sel === x.t ? 'sel' : (W.pend[x.t] != null ? 'sel' : null); }});
    var cand = Object.keys(C.ATV).filter(function (t) { return C.ATV[t].status !== 'placeholder' && tickers.indexOf(t) < 0; }).sort();
    var addSel = h('select', {class: 'inp', 'aria-label': 'Adicionar ativo'}, h('option', {value: ''}, 'Adicionar ativo do cadastro…'), cand.map(function (t) { return h('option', {value: t}, t + ' · ' + C.ATV[t].nome + ' (' + C.ATV[t].pilar + ', ' + C.ATV[t].status + ')'); }));
    return h('div', null, tbl, editavel ? h('div', {class: 'row', style: 'padding:10px 16px'}, addSel, h('button', {class: 'btn', onclick: function () { if (!addSel.value) return; W.pos.push({t: addSel.value, p: C.ATV[addSel.value].pilar, w: 0}); W.sel = addSel.value; W.dirty = true; A.render(); }}, 'Adicionar')) : null);
  }
  function aplicar(t, para, fonte) {
    var antes = (W.pos.filter(function (x) { return x.t === t; })[0] || {}).w || 0;
    var mov = {t: t, para: para};
    var parts = fonte.split(':');
    if (parts[0] === 'reduzir' || parts[0] === 'destino') { mov.fonte = parts[0]; mov.de = parts[1]; }
    else if (parts[0] === 'prorata') { mov.fonte = 'prorata'; mov.pilar = parts[1]; }
    else mov.fonte = parts[0];
    var r = C.aplicarMovimento(W.pos, mov);
    if (!r.ok) { A.toast('Não foi possível: ' + r.motivo); return; }
    W.pos = r.pos.filter(function (x) { return x.w > 1e-12 || C.ATV[x.t] && x.t === t; });
    W.movs.push(Object.assign({antes: antes, quando: new Date().toISOString(), aporte: r.aporte}, mov));
    delete W.pend[t]; W.dirty = true; W.sel = t; A.render();
  }
  function substituir(x) {
    var cand = Object.keys(C.ATV).filter(function (t) { return C.ATV[t].status !== 'placeholder' && t !== x.t; }).sort();
    var sel = h('select', {class: 'inp w'}, cand.map(function (t) { return h('option', {value: t}, t + ' · ' + C.ATV[t].nome + ' (' + C.ATV[t].pilar + ')'); }));
    var d = A.drawer('Substituir ' + x.t, h('div', null, h('p', null, 'Todo o peso de ', h('b', null, x.t), ' (' + A.pct(x.w, 2) + ') passa para o ativo escolhido.'), sel,
      h('p', null, h('button', {class: 'btn pri', onclick: function () {
        var novo = sel.value, ja = W.pos.filter(function (y) { return y.t === novo; })[0], alvoW = (ja ? ja.w : 0) + x.w;
        d.remove(); aplicar(novo, alvoW, 'reduzir:' + x.t);
      }}, 'Substituir'))));
  }
  async function salvar() {
    var p = STORE.get('propostas', W.propId); if (!p) return;
    if (Object.keys(W.pend).length) { A.toast('Há mudanças sem financiamento definido. Escolha a contrapartida ou cancele.'); return; }
    p.pos = C.clone(W.pos); p.nome = W.nome; p.caixaDeliberado = W.caixa; p.movs = W.movs; p.notaVersao = 'versão salva (' + W.movs.length + ' movimentos)';
    try { await STORE.salvarProposta(p); W.dirty = false; A.toast('Proposta salva. A aprovada não mudou.'); A.render(); } catch (e) { A.toast(e.message || 'Falha ao salvar'); }
  }
  function exportar(p) {
    var ap = A.versao('aprovada'), mapA = {}; ap.pos.forEach(function (x) { mapA[x.t] = (mapA[x.t] || 0) + x.w; });
    var rows = [['carteira', 'proposta', 'status', 'ticker', 'pilar', 'peso_aprovada', 'peso_proposta', 'delta']];
    var ts = {}; ap.pos.concat(W.pos).forEach(function (x) { ts[x.t] = x.p; });
    Object.keys(ts).forEach(function (t) { var w = C.sum(W.pos.filter(function (x) { return x.t === t; }), function (x) { return x.w; }); rows.push([S.cart, W.nome, p.status, t, ts[t], (mapA[t] || 0).toFixed(6), w.toFixed(6), (w - (mapA[t] || 0)).toFixed(6)]); });
    A.download('proposta_' + S.cart + '_' + p.id + '.csv', A.csv(rows), 'text/csv;charset=utf-8');
  }

  /* ---------- registro de decisão (aprovação humana) ---------- */
  function formAprovacao(p) {
    var f = {};
    function campo(k, rot, tipo, ph) { var e = tipo === 'area' ? h('textarea', {class: 'inp w', placeholder: ph || ''}) : h('input', {class: 'inp w', type: tipo || 'text', placeholder: ph || ''}); f[k] = e; return h('label', {class: 'field'}, rot, e); }
    var ap = A.versao('aprovada'), dd = C.diff(ap, versaoW(), A.prem().sens);
    var resumo = dd.ativos.filter(function (r) { return Math.abs(r.d) > 1e-9; }).slice(0, 12).map(function (r) { return r.t + ' ' + A.pct(r.a, 2) + ' → ' + A.pct(r.b, 2); }).join('; ');
    var conf = h('input', {type: 'checkbox'});
    var body = h('div', null,
      h('p', null, 'A carteira oficial só muda com este registro. Ele guarda a composição anterior e cria a decisão no diário.'),
      p.origem === 'ia' ? h('div', {class: 'alert warn'}, 'Esta proposta nasceu de um parecer gerado por IA. Confirme que a decisão é do Comitê.') : null,
      h('p', {class: 'hint'}, 'Mudanças: ' + (resumo || 'nenhuma') + ' · giro ' + A.pct(dd.giro, 2)),
      h('div', {class: 'form'}, campo('responsavel', 'Responsável *', 'text', 'nome de quem aprova'), campo('data', 'Data da decisão *', 'date')),
      campo('tese', 'Tese', 'area'), campo('evidencia', 'Evidência', 'area'), campo('contra', 'Principal argumento contrário', 'area'), campo('alternativas', 'Alternativas consideradas', 'area'),
      campo('riscos', 'Riscos', 'area'), campo('revisao', 'Condições de revisão', 'area'),
      h('label', null, conf, ' Confirmo que esta decisão foi tomada por pessoas (Comitê/gestor), não pela IA.'),
      h('div', {class: 'row', style: 'margin-top:12px'},
        h('button', {class: 'btn pri', onclick: async function () {
          var reg = {responsavel: f.responsavel.value, data: f.data.value, confirmaHumano: conf.checked, registro: {tese: f.tese.value, evidencia: f.evidencia.value, contra: f.contra.value, alternativas: f.alternativas.value, riscos: f.riscos.value, revisao: f.revisao.value, pesos: dd.ativos.filter(function (r) { return Math.abs(r.d) > 1e-9; }), impacto: impactoTxt(ap, versaoW()), titulo: W.nome}};
          if (!conf.checked) { A.toast('Marque a confirmação de decisão humana.'); return; }
          try { await STORE.aprovarProposta(C, p, reg); d.remove(); S.ver = 'aprovada'; A.toast('Aprovação registrada. A versão anterior foi arquivada.'); A.render(); } catch (e) { A.toast(e.message || 'Falha'); }
        }}, 'Registrar aprovação'),
        h('button', {class: 'btn danger', onclick: async function () { await STORE.rejeitarProposta(p, {responsavel: f.responsavel.value, data: f.data.value, motivo: f.contra.value, registro: {tese: f.tese.value, contra: f.contra.value, titulo: W.nome}}); d.remove(); A.render(); }}, 'Registrar rejeição')));
    var d = A.drawer('Registrar decisão do Comitê', body);
  }
  function impactoTxt(a, b) {
    var ch = S.choques, out = [];
    var ra = C.choqueCarteira(a, ch, A.prem().sens, S.idio), rb = C.choqueCarteira(b, ch, A.prem().sens, S.idio);
    if (Object.keys(ch || {}).some(function (k) { return ch[k]; })) out.push('Cenário ativo: ' + A.spct(ra.total, 2) + ' → ' + A.spct(rb.total, 2));
    var mp = A.modeloPar(a, b);
    if (mp.ok && mp.S && mp.suficiente && mp.validB) out.push('Vol anualizada (mesma amostra): ' + (mp.validA ? A.pct(Q.annualizeVol(Q.portVol(mp.wa, mp.S), mp.ppy), 2) : 'n/d') + ' → ' + A.pct(Q.annualizeVol(Q.portVol(mp.wb, mp.S), mp.ppy), 2));
    return out.join('; ');
  }

  /* ---------- antes × depois ---------- */
  function antesDepois(a, b) {
    var P = A.prem(), ea = C.exposicoes(a, P.sens), eb = C.exposicoes(b, P.sens), va = A.valida(a), vb = A.valida(b);
    var rows = [];
    function row(lbl, x, y, fmt, nota) { rows.push({lbl: lbl, x: x, y: y, fmt: fmt || A.pct, nota: nota}); }
    var t = W.sel || (b.pos[0] && b.pos[0].t);
    var wa = C.sum(a.pos.filter(function (x) { return x.t === t; }), function (x) { return x.w; }), wb = C.sum(b.pos.filter(function (x) { return x.t === t; }), function (x) { return x.w; });
    row('Peso de ' + t, wa, wb);
    var dp = C.diff(a, b, A.prem().sens);
    dp.pilares.filter(function (r) { return Math.abs(r.d) > 1e-9; }).sort(function (x, y) { return Math.abs(y.d) - Math.abs(x.d); }).slice(0, 4).forEach(function (r) { row('Pilar ' + r.k, r.a, r.b); });
    dp.classes.forEach(function (r) { if (r.a || r.b) row(r.k, r.a, r.b); });
    var sa = ea.porSetor, sb = eb.porSetor; Object.keys(Object.assign({}, sa, sb)).filter(function (k) { return a.pos.concat(b.pos).some(function (x) { return C.ATV[x.t] && C.ATV[x.t].setor === k && /Ações|FIIs/.test(C.ATV[x.t].classe); }); }).filter(function (k) { return Math.abs((sb[k] || 0) - (sa[k] || 0)) > 1e-9; }).slice(0, 3).forEach(function (k) { row('Setor ' + k, sa[k] || 0, sb[k] || 0); });
    [['dur_pre', 'Duration pré'], ['dur_real', 'Duration real'], ['beta_ibov', 'Beta Ibovespa'], ['usd_direto', 'Dólar direto'], ['spread_dur', 'Spread duration']].forEach(function (k) { var x = ea.fatores[k[0]], y = eb.fatores[k[0]]; if (x || y) row(k[1] + ' (premissa)', x, y, k[0] === 'usd_direto' ? A.pct : function (v) { return A.num(v, 2); }); });
    row('Número efetivo (peso)', ea.effN, eb.effN, function (v) { return A.num(v, 1); });
    // risco estatístico: um único modelo (mesma amostra e mesma covariância) para antes e depois
    var mp = A.modeloPar(a, b), ann = function (x) { return mp.ppy ? Q.annualizeVol(x, mp.ppy) : null; };
    var falta = !mp.ok ? (mp.motivo || 'sem séries') : !mp.S ? (mp.motivoCov || 'amostra curta') : !mp.suficiente ? 'só ' + mp.n + ' observações (mínimo ' + mp.minObs + ')' : null;
    if (falta) {
      ['Volatilidade anualizada', 'Contribuição ao risco', 'Expected Shortfall', 'Tracking error vs aprovada'].forEach(function (l) { rows.push({lbl: l, na: falta}); });
    } else {
      var nota = 'mesma amostra: ' + mp.n + ' retornos ' + {D: 'diários', W: 'semanais', M: 'mensais'}[mp.freq] + ' · cobertura ' + A.pct(mp.cobA, 0) + ' → ' + A.pct(mp.cobB, 0);
      rows.push({lbl: 'Volatilidade anualizada', x: mp.validA ? ann(Q.portVol(mp.wa, mp.S)) : null, y: mp.validB ? ann(Q.portVol(mp.wb, mp.S)) : null, fmt: A.pct, na: mp.validB ? null : 'proposta inválida', naA: mp.validA ? null : 'aprovada inválida', nota: nota});
      var i = mp.ids.indexOf(t), rcA = Q.riskContrib(mp.wa, mp.S), rcB = Q.riskContrib(mp.wb, mp.S);
      rows.push({lbl: 'Contribuição de ' + t + ' ao risco', x: i >= 0 && mp.validA && mp.wa[i] > 0 ? rcA.pct[i] : null, y: i >= 0 && mp.validB ? rcB.pct[i] : null, fmt: A.pct, na: i < 0 ? 'sem série do ativo' : (mp.validB ? null : 'proposta inválida')});
      var esA = mp.validA ? Q.esHist(Q.portReturns(mp.R, mp.wa), 0.95) : null, esB = mp.validB ? Q.esHist(Q.portReturns(mp.R, mp.wb), 0.95) : null;
      rows.push({lbl: 'Expected Shortfall 95% (' + {D: 'diário', W: 'semanal', M: 'mensal'}[mp.freq] + ')', x: esA, y: esB, fmt: A.pct, na: esB == null ? (mp.validB ? 'menos de 30 observações' : 'proposta inválida') : null});
      var dv = mp.wb.map(function (x, k) { return x - mp.wa[k]; });
      rows.push({lbl: 'Tracking error vs aprovada', x: 0, y: mp.validA && mp.validB ? ann(Q.portVol(dv, mp.S)) : null, fmt: A.pct, na: mp.validA && mp.validB ? null : (mp.validA ? 'proposta inválida' : 'aprovada inválida'), nota: mp.foraA.length || mp.foraB.length ? 'só posições com série' : null});
    }
    // retorno esperado (premissa do gestor)
    function er(v) { var cob = 0, s = 0; v.pos.forEach(function (x) { var e = P.er[x.t]; if (e && isFinite(e.v)) { s += x.w * e.v; cob += x.w; } }); return {v: cob > 0 ? s : null, cob: cob}; }
    var era = er(a), erb = er(b);
    rows.push({lbl: 'Retorno esperado (premissas)', x: era.v, y: erb.v, fmt: A.pct, na: erb.v == null ? 'cadastre em Limites e retornos esperados' : null, nota: erb.v != null && erb.cob < 0.999 ? 'parcial: ' + A.pct(erb.cob, 0) + ' com premissa' : null});
    rows.push({lbl: 'Liquidez', na: A.TAB.liquidez ? 'informe o patrimônio em Dados' : 'volume diário não importado'});
    // cenário ativo
    var ch = S.choques, temCh = Object.keys(ch || {}).some(function (k) { return ch[k]; });
    if (temCh) { var ra = C.choqueCarteira(a, ch, P.sens, S.idio), rb = C.choqueCarteira(b, ch, P.sens, S.idio); rows.push({lbl: 'Cenário ativo (choque)', x: ra.total, y: rb.total, fmt: A.spct, nota: rb.parcial ? (rb.status === 'invalida' ? 'inválida' : 'parcial') : null}); }
    rows.push({lbl: 'Giro (Σ|Δ| ÷ 2)', x: 0, y: dp.giro, fmt: A.pct});
    var tb = h('table', {class: 't'}, h('thead', null, h('tr', null, h('th', null, 'Métrica'), h('th', {class: 'r'}, 'Antes'), h('th', {class: 'r'}, 'Depois'), h('th', {class: 'r'}, 'Variação'))),
      h('tbody', null, rows.map(function (r) {
        if (r.na && r.y == null) return h('tr', null, h('td', null, r.lbl), h('td', {colspan: 3}, A.na(r.na)));
        var d = (r.y != null && r.x != null) ? r.y - r.x : null;
        return h('tr', null, h('td', null, r.lbl, r.nota ? h('div', {class: 'muted', style: 'font-size:.78rem'}, r.nota) : null), h('td', {class: 'r num'}, r.x == null ? (r.naA ? h('span', {class: 'na', title: r.naA}, 'n/d') : '—') : r.fmt(r.x)), h('td', {class: 'r num'}, r.y == null ? '—' : r.fmt(r.y)),
          h('td', {class: 'r num dlt ' + A.cls(d)}, d == null || Math.abs(d) < 1e-12 ? '—' : (r.fmt === A.pct || r.fmt === A.spct ? A.pp(d) : A.snum(d, 2))));
      })));
    return A.sec('Antes × depois', {mtd: 'antesdepois', hint: 'Antes = aprovada vigente (' + {invalida: 'inválida', parcial: 'parcial', valida: 'válida'}[va.status] + '). Depois = esta proposta (' + {invalida: 'inválida', parcial: 'parcial', valida: 'válida'}[vb.status] + '). Clique numa linha da tabela para trocar o ativo em foco.', flush: true}, h('div', {class: 'ba'}, tb));
  }

  /* ---------- dimensionamento ---------- */
  function sizing(p) {
    var wrap = h('div'); wrap.appendChild(barra(p));
    var base = p ? versaoW() : A.versao('aprovada'), P = A.prem();
    var inv = base.pos.filter(function (x) { return C.ATV[x.t] && C.ATV[x.t].status !== 'placeholder'; });
    var t = W.sel && C.ATV[W.sel] ? W.sel : (inv.filter(function (x) { return C.ATV[x.t].classe === 'Ações'; })[0] || inv[0] || {}).t;
    var cur = C.sum(base.pos.filter(function (x) { return x.t === t; }), function (x) { return x.w; });
    var st = A.sizingState = A.sizingState || {};
    if (st.t !== t) { st.t = t; st.novo = cur + 0.01; st.fonte = base.pos.some(function (x) { return x.t === 'LFTB11'; }) ? 'LFTB11' : ''; st.cen = C.clone(P.cen[t] || [{nome: 'Otimista', p: 0.25, r: null}, {nome: 'Base', p: 0.5, r: null}, {nome: 'Pessimista', p: 0.25, r: null}]); st.perdaMax = 0.01; st.bps = 10; st.imp = 0; }
    var selA = h('select', {class: 'inp', onchange: function () { W.sel = selA.value; A.render(); }}, C.ATV[t] ? null : h('option', null, '—'), Object.keys(C.ATV).filter(function (k) { return C.ATV[k].status !== 'placeholder'; }).sort().map(function (k) { return h('option', {value: k, selected: k === t || null}, k + ' · ' + C.ATV[k].nome); }));
    var novo = h('input', {class: 'inp n', type: 'number', step: '0.25', value: +(st.novo * 100).toFixed(3), onchange: function () { st.novo = Number(novo.value) / 100; A.render(); }});
    var fonte = h('select', {class: 'inp', onchange: function () { st.fonte = fonte.value; A.render(); }}, h('option', {value: ''}, 'pro rata das outras posições investíveis'), base.pos.filter(function (x) { return x.t !== t && x.w > 0; }).map(function (x) { return h('option', {value: x.t, selected: x.t === st.fonte || null}, x.t + ' (' + A.pct(x.w, 1) + ')'); }));
    wrap.appendChild(A.sec('Pergunta', {mtd: 'sizing'}, [
      h('div', {class: 'row'}, 'Se ', selA, ' passar de ', h('b', {class: 'num'}, A.pct(cur, 2)), ' para ', novo, ' %, financiado por ', fonte, ', como muda o risco da carteira e qual o custo de oportunidade?'),
      h('p', {class: 'hint'}, 'Base: ' + base.rotulo + '. Nada é aplicado até você clicar em “Aplicar na proposta”.')
    ]));
    // nova carteira hipotética
    var dw = st.novo - cur, pos2 = C.clone(base.pos);
    // mesma regra de financiamento na análise e no “Aplicar na proposta”: reduzir a fonte escolhida, ou pro rata das posições investíveis
    var fonteMov = st.fonte ? 'reduzir:' + st.fonte : 'prorata_todas';
    var r = C.aplicarMovimento(pos2, st.fonte ? {t: t, para: st.novo, fonte: 'reduzir', de: st.fonte} : {t: t, para: st.novo, fonte: 'prorata_todas'});
    var g = h('div', {class: 'grid2'}), L = h('div'), R = h('div'); g.append(L, R); wrap.appendChild(g);
    if (!r.ok) { L.appendChild(h('div', {class: 'alert bad'}, r.motivo)); return wrap; }
    var v2 = Object.assign({}, base, {pos: r.pos, kind: 'proposta', rotulo: 'hipótese'});
    // risco: um modelo só (mesma amostra e mesma covariância) para antes e depois
    var mp = A.modeloPar(base, v2), riscoBody;
    if (mp.ok && mp.S && mp.suficiente && mp.validA) {
      var an = function (x) { return Q.annualizeVol(x, mp.ppy); };
      var s1 = an(Q.portVol(mp.wa, mp.S)), s2 = an(Q.portVol(mp.wb, mp.S));
      var rc1 = Q.riskContrib(mp.wa, mp.S), rc2 = Q.riskContrib(mp.wb, mp.S), ix = mp.ids.indexOf(t);
      var mrcA = ix >= 0 ? an(rc1.mrc[ix]) : null;
      var aprox = an(C.sum(mp.ids.map(function (_, k) { return (mp.wb[k] - mp.wa[k]) * rc1.mrc[k]; })));
      var orc = P.limites.orcamentoRisco;
      riscoBody = [h('dl', {class: 'kv'},
        h('dt', null, 'Volatilidade anualizada'), h('dd', {class: 'num'}, A.pct(s1, 2) + ' → ' + A.pct(s2, 2) + ' (' + A.pp(s2 - s1) + ')'),
        h('dt', null, 'Risco marginal de ' + t), h('dd', {class: 'num'}, mrcA == null ? A.na('sem série do ativo') : A.num(mrcA * 100, 2) + ' p.p. de vol por 100% de peso (∂σ/∂w)'),
        h('dt', null, 'Fatia do risco em ' + t), h('dd', {class: 'num'}, (ix >= 0 && mp.wa[ix] > 0 ? A.pct(rc1.pct[ix]) : '—') + ' → ' + (ix >= 0 ? A.pct(rc2.pct[ix]) : '—') + (orc && ix >= 0 ? ' · orçamento ' + A.pct(orc, 0) + (rc2.pct[ix] > orc ? ' (estourado)' : ' (dentro)') : '')),
        h('dt', null, 'Amostra'), h('dd', null, mp.n + ' retornos ' + {D: 'diários', W: 'semanais', M: 'mensais'}[mp.freq] + ', ' + A.dataBR(mp.dates[0]) + ' a ' + A.dataBR(mp.dates[mp.n - 1]) + ' · cobertura ' + A.pct(mp.cobA, 0) + ' → ' + A.pct(mp.cobB, 0))),
        h('p', {class: 'hint'}, 'Δσ exato: σ(w′) − σ(w) com a mesma amostra e a mesma covariância. Aproximação de primeira ordem, somando a compra e o financiamento: Σ Δwᵢ × ∂σ/∂wᵢ = ' + A.pp(aprox))];
    } else riscoBody = A.na(!mp.ok ? mp.motivo : !mp.validA ? 'a versão base é inválida' : (mp.motivoCov || ('só ' + mp.n + ' observações em comum (mínimo ' + mp.minObs + ')')), 'séries de preços das posições');
    L.appendChild(A.sec('Risco incremental', {mtd: 'risco'}, riscoBody));
    // cenários da tese
    var cenRows = st.cen.map(function (c, i) {
      var pi = h('input', {class: 'inp n', type: 'number', step: '5', value: c.p == null ? '' : +(c.p * 100).toFixed(2), onchange: function () { c.p = pi.value === '' ? null : Number(pi.value) / 100; A.render(); }});
      var ri = h('input', {class: 'inp n', type: 'number', step: '5', value: c.r == null ? '' : +(c.r * 100).toFixed(2), onchange: function () { c.r = ri.value === '' ? null : Number(ri.value) / 100; A.render(); }});
      return h('tr', null, h('td', null, c.nome), h('td', {class: 'r'}, pi, ' %'), h('td', {class: 'r'}, ri, ' %'));
    });
    var sz = C.sizing({w: cur, wNovo: st.novo, cenarios: st.cen.map(function (c) { return {nome: c.nome, p: c.p, r: c.r}; }), perdaMax: st.perdaMax});
    var pm = h('input', {class: 'inp n', type: 'number', step: '0.25', value: +(st.perdaMax * 100).toFixed(2), onchange: function () { st.perdaMax = Number(pm.value) / 100; A.render(); }});
    L.appendChild(A.sec('Cenários da tese (premissa do gestor)', {hint: 'Retorno total do ativo em 12 meses em cada cenário. As probabilidades precisam somar 100%.'}, [
      h('table', {class: 't'}, h('thead', null, h('tr', null, h('th', null, 'Cenário'), h('th', {class: 'r'}, 'Probabilidade'), h('th', {class: 'r'}, 'Retorno'))), h('tbody', null, cenRows)),
      h('div', {class: 'row', style: 'margin-top:8px'}, 'Perda máxima tolerada para a posição: ', pm, ' % da carteira',
        h('button', {class: 'btn sm right', onclick: async function () { var c = A.prem().cen; c[t] = st.cen; await A.salvarPrem({cen: c}, 'cenários da tese de ' + t); A.toast('Cenários de ' + t + ' salvos nas premissas.'); }}, 'Salvar como premissa')),
      sz.ok ? h('dl', {class: 'kv', style: 'margin-top:10px'},
        h('dt', null, 'Retorno esperado do ativo'), h('dd', {class: 'num'}, A.spct(sz.er)),
        h('dt', null, 'Contribuição esperada'), h('dd', {class: 'num'}, A.pp(sz.contribEsperada) + ' → ' + A.pp(sz.contribEsperadaNovo)),
        h('dt', null, 'Se o pior cenário acontecer'), h('dd', {class: 'num'}, A.pp(sz.perdaPior) + ' → ' + A.pp(sz.perdaPiorNovo) + ' (' + A.pct(st.novo, 2) + ' × ' + A.spct(sz.pior, 0) + ')'),
        h('dt', null, 'Peso máximo pela perda tolerada'), h('dd', {class: 'num'}, sz.wMaxPorPerda != null ? A.pct(sz.wMaxPorPerda, 2) + (st.novo > sz.wMaxPorPerda ? ' · o peso proposto passa do limite' : '') : '—'))
        : h('div', {class: 'alert warn'}, 'Cenários incompletos: ' + sz.motivo + '.')
    ]));
    // valuation e custo
    var a = C.ATV[t] || {};
    R.appendChild(A.sec('Referências de valor', {hint: 'Preço teto, preço justo e retorno esperado são coisas diferentes. Teto é o preço máximo para comprar com margem; não é alvo nem retorno.'}, h('dl', {class: 'kv'},
      h('dt', null, 'Cotação'), h('dd', null, a.cotacao ? 'R$ ' + A.num(a.cotacao) + ' · ' + a.data_preco + ' · ' + a.fonte_preco : A.na('sem cotação cadastrada')),
      h('dt', null, 'Preço teto'), h('dd', null, a.teto ? 'R$ ' + A.num(a.teto) + ' · metodologia: ' + (a.metodologia_teto || 'não informada nas Teses') : A.na()),
      h('dt', null, 'Preço justo'), h('dd', null, a.justo ? 'R$ ' + A.num(a.justo) : A.na('não informado')),
      h('dt', null, 'Margem até o teto'), h('dd', null, a.teto && a.cotacao ? A.spct(a.teto / a.cotacao - 1) : '—'),
      h('dt', null, 'Proventos 12 meses'), h('dd', null, a.dy_12m != null ? A.pct(a.dy_12m) + ' (observado, ' + (a.data_ret || '') + ')' : A.na()),
      h('dt', null, 'Recomendação'), h('dd', null, a.rec || '—'))));
    var erBuy = sz.ok ? sz.er : (P.er[t] ? P.er[t].v : null), fonteT = st.fonte, erF = fonteT ? (P.er[fonteT] ? P.er[fonteT].v : (P.cen[fonteT] && C.sizing({w: 0, cenarios: P.cen[fonteT]}).ok ? C.sizing({w: 0, cenarios: P.cen[fonteT]}).er : null)) : null;
    var bps = h('input', {class: 'inp n', type: 'number', step: '1', value: st.bps, onchange: function () { st.bps = Number(bps.value) || 0; A.render(); }});
    var imp = h('input', {class: 'inp n', type: 'number', step: '0.5', value: +(st.imp * 100).toFixed(2), onchange: function () { st.imp = Number(imp.value) / 100 || 0; A.render(); }});
    var co = C.custoOportunidade({dw: dw, erCompra: erBuy, erFonte: erF, custoBps: st.bps, impostoSobreVenda: st.imp});
    R.appendChild(A.sec('Custo de oportunidade do financiamento', {mtd: 'custo'}, [
      h('div', {class: 'row'}, 'Custo de transação ', bps, ' bps por lado · imposto estimado ', imp, ' % do valor vendido'),
      h('dl', {class: 'kv', style: 'margin-top:8px'},
        h('dt', null, 'E[r] de ' + t), h('dd', null, erBuy == null ? A.na('preencha os cenários ou o retorno esperado') : A.spct(erBuy)),
        h('dt', null, 'E[r] da fonte' + (fonteT ? ' (' + fonteT + ')' : '')), h('dd', null, !fonteT ? A.na('escolha uma posição como fonte') : erF == null ? A.na('sem retorno esperado de ' + fonteT, 'Limites e retornos esperados') : A.spct(erF)),
        h('dt', null, 'Resultado esperado da troca'), h('dd', {class: 'num'}, co.ok ? A.pp(co.bruto) + ' − custos ' + A.pp(-co.custo).replace('+', '') + ' − imposto ' + A.pp(-co.imposto).replace('+', '') + ' = ' + A.pp(co.liquido) + ' por ano' : A.na(co.motivo)))
    ]));
    if (p && !/aprovada|rejeitada/.test(p.status)) R.appendChild(h('button', {class: 'btn pri', onclick: function () { aplicar(t, st.novo, fonteMov); A.go('cons', 'editor'); }}, 'Aplicar na proposta'));
    else R.appendChild(h('p', {class: 'hint'}, 'Para aplicar, abra ou crie uma proposta no Laboratório.'));
    return wrap;
  }

  /* ---------- otimização ---------- */
  function otimizacao(p) {
    var wrap = h('div'); wrap.appendChild(barra(p));
    var base = p ? versaoW() : A.versao('aprovada');
    var st = A.otimState = A.otimState || {obj: 'minvar', max: 0.15, bandas: true, tau: 0, lw: true, gamma: 4, res: null};
    var m = A.modelo(base, {lw: st.lw});
    wrap.appendChild(h('div', {class: 'alert'}, 'A otimização não gera ordem de compra. O resultado vira, no máximo, uma proposta para o Comitê avaliar. Posições sem série ficam com o peso atual.'));
    if (!m.ok) { wrap.appendChild(A.sec('Otimização com restrições', {mtd: 'otim'}, A.na(m.motivo, m.bloqueado ? 'proposta que feche em 100%' : 'preços históricos (Dados → Preços)'))); return wrap; }
    if (!m.S || !m.suficiente) { wrap.appendChild(A.sec('Otimização com restrições', {mtd: 'otim'}, A.na(m.motivoCov || ('amostra de ' + m.n + ' retornos, mínimo ' + m.minObs), 'mais histórico'))); return wrap; }
    var n = m.ids.length, fixo = C.sum(m.fora, function (x) { return x.w; }), total = m.cobertura;
    var objSel = h('select', {class: 'inp', onchange: function () { st.obj = objSel.value; st.res = null; A.render(); }}, [['minvar', 'Mínima variância'], ['meanvar', 'Média-variância'], ['rp', 'Paridade de risco'], ['eq', 'Pesos iguais'], ['atual', 'Atual']].map(function (o) { return h('option', {value: o[0], selected: st.obj === o[0] || null}, o[1]); }));
    var mx = h('input', {class: 'inp n', type: 'number', step: '1', value: +(st.max * 100).toFixed(1), onchange: function () { st.max = Number(mx.value) / 100; st.res = null; }});
    var tau = h('input', {class: 'inp n', type: 'number', step: '0.1', value: st.tau, onchange: function () { st.tau = Number(tau.value) || 0; st.res = null; }});
    var gm = h('input', {class: 'inp n', type: 'number', step: '0.5', value: st.gamma, onchange: function () { st.gamma = Number(gm.value) || 4; st.res = null; }});
    var P = A.prem(), mu = m.ids.map(function (t) { var e = P.er[t]; return e && isFinite(e.v) ? Q.toPeriodic ? Q.toPeriodic(e.v, m.ppy) : Math.pow(1 + e.v, 1 / m.ppy) - 1 : null; });
    var semMu = m.ids.filter(function (t, i) { return mu[i] == null; });
    function grupos(w0) {
      if (!st.bandas) return [];
      var est = C.estrategica(S.cart), g = [];
      Object.keys(est.bandas).forEach(function (pl) {
        var b = est.bandas[pl]; if (!b || b.min == null) return;
        var idx = []; m.usar.forEach(function (u, i) { if (u.p === pl) idx.push(i); });
        if (!idx.length) return;
        var fixoP = C.sum(m.fora.filter(function (x) { return x.p === pl; }), function (x) { return x.w; });
        g.push({idx: idx, lo: Math.max(0, b.min - fixoP), hi: Math.max(0, b.max - fixoP), name: pl});
      });
      return g;
    }
    function rodar(Smat, muv) {
      var lb = m.ids.map(function () { return 0; }), ub = m.ids.map(function () { return Math.min(st.max, total); });
      if (st.obj === 'atual') return {ok: true, w: m.w.slice(), active: {lower: [], upper: [], groups: []}};
      if (st.obj === 'eq') return {ok: true, w: m.ids.map(function () { return total / n; }), active: {lower: [], upper: [], groups: []}};
      if (st.obj === 'rp') { var r = Q.riskParity(Smat); return r.ok ? {ok: true, w: r.w.map(function (x) { return x * total; }), active: {lower: [], upper: [], groups: []}, nota: 'Paridade de risco não impõe limites por posição nem bandas.'} : r; }
      return Q.optimize({S: Smat, mu: muv, w0: m.w, lb: lb, ub: ub, total: total, groups: grupos(), objective: st.obj, gamma: st.gamma, tau: st.tau, maxIter: 8000});
    }
    var run = h('button', {class: 'btn pri', onclick: function () {
      if (st.obj === 'meanvar' && semMu.length) { A.toast('Média-variância precisa de retorno esperado para: ' + semMu.join(', ')); return; }
      var res = rodar(m.S, mu);
      if (!res.ok) { st.res = {erro: res.reason || res.motivo || 'falhou'}; A.render(); return; }
      // sensibilidade: covariância amostral × encolhida; μ ± 1 p.p. ao ano
      var alt = [];
      var mS = A.modelo(base, {lw: !st.lw}); if (mS.ok && mS.S) { var r2 = rodar(mS.S, mu); if (r2.ok) alt.push(r2.w); }
      if (st.obj === 'meanvar') [-0.01, 0.01].forEach(function (dlt) { m.ids.forEach(function (_, k) { var mu2 = mu.slice(); mu2[k] = Math.pow(1 + (P.er[m.ids[k]].v + dlt), 1 / m.ppy) - 1; var r3 = rodar(m.S, mu2); if (r3.ok) alt.push(r3.w); }); });
      st.res = {w: res.w, active: res.active, nota: res.nota, converged: res.converged, alt: alt};
      A.render();
    }}, 'Rodar');
    wrap.appendChild(A.sec('Otimização com restrições', {mtd: 'otim'}, [
      h('div', {class: 'form'},
        h('label', {class: 'field'}, 'Objetivo', objSel), h('label', {class: 'field'}, 'Máximo por posição (%)', mx), h('label', {class: 'field'}, 'Penalidade de giro τ', tau),
        st.obj === 'meanvar' ? h('label', {class: 'field'}, 'Aversão a risco γ', gm) : null,
        h('label', {class: 'field'}, h('span', null, h('input', {type: 'checkbox', checked: st.bandas || null, onchange: function (e) { st.bandas = e.target.checked; st.res = null; }}), ' Respeitar bandas dos pilares')),
        h('label', {class: 'field'}, h('span', null, h('input', {type: 'checkbox', checked: st.lw || null, onchange: function (e) { st.lw = e.target.checked; st.res = null; A.render(); }}), ' Covariância encolhida (Ledoit-Wolf)'))),
      h('p', {class: 'hint'}, n + ' ativos com série · ' + m.n + ' retornos ' + {D: 'diários', W: 'semanais', M: 'mensais'}[m.freq] + ' · otimiza ' + A.pct(total, 1) + ' da carteira; ' + A.pct(fixo, 1) + ' fica fixo (sem série, placeholder ou lacuna)' + (st.lw && m.shrink != null ? ' · intensidade do encolhimento ' + A.num(m.shrink, 2) : '')),
      st.obj === 'meanvar' && semMu.length ? h('div', {class: 'alert warn'}, 'Sem retorno esperado para ' + semMu.join(', ') + '. Cadastre em “Limites e retornos esperados”.') : null,
      run
    ]));
    if (st.res && st.res.erro) wrap.appendChild(h('div', {class: 'alert bad'}, 'A otimização não convergiu ou é inviável: ' + st.res.erro + '. Afrouxe o máximo por posição ou as bandas.'));
    if (st.res && st.res.w) {
      var w1 = st.res.w, s0 = Q.annualizeVol(Q.portVol(m.w, m.S), m.ppy), s1 = Q.annualizeVol(Q.portVol(w1, m.S), m.ppy), rc0 = Q.riskContrib(m.w, m.S), rc1 = Q.riskContrib(w1, m.S);
      var rng = m.ids.map(function (_, i) { var vs = [w1[i]].concat(st.res.alt.map(function (a) { return a[i]; })); return [Math.min.apply(null, vs), Math.max.apply(null, vs)]; });
      var rows = m.ids.map(function (t, i) { return {t: t, a: m.w[i], b: w1[i], d: w1[i] - m.w[i], ra: rc0.pct[i], rb: rc1.pct[i], lo: rng[i][0], hi: rng[i][1], at: st.res.active.upper.indexOf(i) >= 0 ? 'máximo' : st.res.active.lower.indexOf(i) >= 0 ? 'zero' : ''}; });
      wrap.appendChild(A.sec('Resultado', {hint: 'Volatilidade anualizada das posições otimizadas: ' + A.pct(s0, 2) + ' → ' + A.pct(s1, 2) + '. ' + (st.res.nota || '') + (st.res.converged === false ? ' Atenção: atingiu o limite de iterações.' : ''), flush: true, right: [
        h('button', {class: 'btn', onclick: function () {
          var pos = C.clone(base.pos); m.ids.forEach(function (t, i) { var x = pos.filter(function (y) { return y.t === t; })[0]; if (x) x.w = w1[i]; });
          A.novaProposta(pos, 'Otimização · ' + objSel.options[objSel.selectedIndex].text, 'otimizacao', 'Gerada pelo otimizador (' + objSel.options[objSel.selectedIndex].text + ', máx ' + A.pct(st.max, 0) + ', τ ' + st.tau + '). Não é recomendação: avalie antes.');
        }}, 'Criar proposta com este resultado')]}, A.table([
        {k: 't', t: 'Ativo'}, {k: 'a', t: 'Atual', r: 1, f: function (r) { return A.pct(r.a, 2); }}, {k: 'b', t: 'Otimizado', r: 1, f: function (r) { return A.pct(r.b, 2); }},
        {k: 'd', t: 'Δ', r: 1, f: function (r) { return h('span', {class: A.cls(r.d)}, A.pp(r.d)); }},
        {k: 'ra', t: 'Risco atual', r: 1, f: function (r) { return A.pct(r.ra); }}, {k: 'rb', t: 'Risco otimizado', r: 1, f: function (r) { return A.pct(r.rb); }},
        {k: 'lo', t: 'Faixa na sensibilidade', r: 1, title: 'Mínimo e máximo do peso ao trocar a covariância (amostral × encolhida) e mover cada retorno esperado ±1 p.p.', f: function (r) { return A.pct(r.lo, 1) + ' – ' + A.pct(r.hi, 1); }},
        {k: 'at', t: 'Restrição ativa'}
      ], rows, {sort: 'd'}), A.more('Restrições ativas', h('div', null, st.res.active.groups.length ? st.res.active.groups.map(function (g) { return h('div', null, 'Banda do ' + g.name + ' no ' + (g.side === 'hi' ? 'máximo' : 'mínimo')); }) : h('p', null, 'Nenhuma banda de pilar ativa.'), h('p', null, st.res.active.upper.length + ' posição(ões) no máximo por posição, ' + st.res.active.lower.length + ' zerada(s).')))));
    }
    return wrap;
  }

  /* ---------- comparar ---------- */
  function comparar() {
    var st = A.cmpState = A.cmpState || {a: S.cart + '|aprovada', b: S.cart + '|hist:base-30-10'};
    var opts = [];
    C.CARTS.forEach(function (m) { A.versoes(m.id).forEach(function (o) { if (m.id === S.cart || o.id === 'aprovada') opts.push({v: m.id + '|' + o.id, l: m.rotulo + ' · ' + o.rotulo}); }); });
    function mk(k) { var s = h('select', {class: 'inp', style: 'max-width:420px', onchange: function () { st[k] = s.value; A.render(); }}, opts.map(function (o) { return h('option', {value: o.v, selected: st[k] === o.v || null}, o.l); })); return s; }
    function ver(key) { var i = key.indexOf('|'); return A.versao(key.slice(i + 1), key.slice(0, i)); }
    var a = ver(st.a), b = ver(st.b), wrap = h('div');
    wrap.appendChild(A.sec('Comparar carteiras', {hint: 'Compara qualquer versão desta carteira (aprovada, base 30/10, propostas, históricas) ou a aprovada de outra carteira.'}, h('div', {class: 'row'}, 'A: ', mk('a'), ' B: ', mk('b'))));
    if (!a || !b) return wrap;
    var d = C.diff(a, b, A.prem().sens), va = A.valida(a), vb = A.valida(b);
    var STT = {invalida: ['Inválida', 'g-critica'], parcial: ['Parcial', 'g-media'], valida: ['Válida', 'o-obs']};
    wrap.appendChild(h('p', null, 'A: ', A.chip(STT[va.status][0], STT[va.status][1]), ' soma ' + A.pct(va.total) + ' · B: ', A.chip(STT[vb.status][0], STT[vb.status][1]), ' soma ' + A.pct(vb.total) + ' · giro entre elas ' + A.pct(d.giro, 1)));
    var g = h('div', {class: 'grid2'});
    g.appendChild(A.sec('Ativos', {flush: true}, A.table([{k: 't', t: 'Ativo'}, {k: 'a', t: 'A', r: 1, f: function (r) { return A.pct(r.a, 2); }}, {k: 'b', t: 'B', r: 1, f: function (r) { return A.pct(r.b, 2); }}, {k: 'd', t: 'B − A', r: 1, f: function (r) { return h('span', {class: A.cls(r.d)}, A.pp(r.d)); }}], d.ativos, {sort: 'd', search: 'Filtrar'})));
    var dr = h('div');
    dr.appendChild(A.sec('Pilares', {flush: true}, A.table([{k: 'k', t: 'Pilar', s: function (r) { return +String(r.k).slice(1); }}, {k: 'a', t: 'A', r: 1, f: function (r) { return A.pct(r.a); }}, {k: 'b', t: 'B', r: 1, f: function (r) { return A.pct(r.b); }}, {k: 'd', t: 'B − A', r: 1, f: function (r) { return h('span', {class: A.cls(r.d)}, A.pp(r.d, 1)); }}], d.pilares, {sort: 'k', dir: 1})));
    var FL = {dur_pre: 'Duration pré (anos)', dur_real: 'Duration real (anos)', dur_selic: 'Duration Selic (anos)', dur_ust: 'Duration Treasuries (anos)', spread_dur: 'Spread duration (anos)', beta_ibov: 'Beta Ibovespa', juros_resid: 'Juros residual das ações', usd_direto: 'Dólar direto (peso em USD)', usd_indireto: 'Dólar indireto', brent: 'Brent', sp: 'S&P / desenvolvidos', em: 'Emergentes', btc: 'Bitcoin'};
    dr.appendChild(A.sec('Classes', {flush: true}, A.table([{k: 'k', t: 'Classe'}, {k: 'a', t: 'A', r: 1, f: function (r) { return A.pct(r.a); }}, {k: 'b', t: 'B', r: 1, f: function (r) { return A.pct(r.b); }}, {k: 'd', t: 'B − A', r: 1, f: function (r) { return A.pp(r.d, 1); }}], d.classes)));
    dr.appendChild(A.sec('Exposições a fatores (premissa)', {flush: true}, A.table([{k: 'k', t: 'Fator', f: function (r) { return FL[r.k] || r.k; }}, {k: 'a', t: 'A', r: 1, f: function (r) { return r.k === 'usd_direto' ? A.pct(r.a) : A.num(r.a, 2); }}, {k: 'b', t: 'B', r: 1, f: function (r) { return r.k === 'usd_direto' ? A.pct(r.b) : A.num(r.b, 2); }}, {k: 'd', t: 'B − A', r: 1, f: function (r) { return r.k === 'usd_direto' ? A.pp(r.d, 1) : A.snum(r.d, 2); }}], d.fatores.filter(function (r) { return r.a || r.b; }))));
    var ch = S.choques; if (Object.keys(ch || {}).some(function (k) { return ch[k]; })) { var P = A.prem(), ra = C.choqueCarteira(a, ch, P.sens, S.idio), rb = C.choqueCarteira(b, ch, P.sens, S.idio); dr.appendChild(A.sec('Cenário ativo', null, h('p', null, 'A ' + A.spct(ra.total, 2) + (ra.parcial ? ' (' + ra.status + ')' : '') + ' · B ' + A.spct(rb.total, 2) + (rb.parcial ? ' (' + rb.status + ')' : '')))); }
    g.appendChild(dr); wrap.appendChild(g);
    return wrap;
  }

  /* ---------- limites e retornos esperados ---------- */
  function limites() {
    var P = A.prem(), lim = C.clone(P.limites), er = C.clone(P.er);
    function inp(k, rot, hint) { var e = h('input', {class: 'inp n', type: 'number', step: '0.5', value: lim[k] != null ? +(lim[k] * 100).toFixed(2) : '', placeholder: 'não definido', onchange: function () { lim[k] = e.value === '' ? null : Number(e.value) / 100; }}); return h('label', {class: 'field'}, rot, h('span', null, e, ' %'), hint ? h('span', {style: 'font-size:.8rem'}, hint) : null); }
    var wrap = h('div');
    wrap.appendChild(A.sec('Limites do mandato', {hint: 'O simulador só traz bandas por pilar. Os limites abaixo não existem até você cadastrá-los; enquanto vazios, a validação avisa que não foram verificados.', right: h('button', {class: 'btn pri', onclick: async function () { await A.salvarPrem({limites: lim}, 'limites do mandato'); A.toast('Limites salvos (versão anterior arquivada).'); A.render(); }}, 'Salvar limites')}, h('div', {class: 'form'},
      inp('posicao', 'Máximo por ação (fora ETFs e FIIs)'), inp('emissor', 'Máximo por emissor/grupo'), inp('setor', 'Máximo por setor (ações)'), inp('orcamentoRisco', 'Orçamento de risco por posição', '% da volatilidade total'))));
    var ts = Object.keys(C.ATV).filter(function (t) { return C.ATV[t].status !== 'placeholder'; }).sort(function (a, b) { return (C.ATV[a].pilar.slice(1) - C.ATV[b].pilar.slice(1)) || (a < b ? -1 : 1); });
    var rows = ts.map(function (t) { return {t: t, p: C.ATV[t].pilar, nome: C.ATV[t].nome, er: er[t]}; });
    wrap.appendChild(A.sec('Retornos esperados (premissas do gestor)', {hint: 'Retorno total esperado em 12 meses, em reais. Usado no antes × depois, no custo de oportunidade e na média-variância. Sem preenchimento, essas análises mostram “Não disponível”. Nenhum valor é sugerido pela ferramenta.', right: h('button', {class: 'btn pri', onclick: async function () { await A.salvarPrem({er: er}, 'retornos esperados'); A.toast('Retornos esperados salvos.'); A.render(); }}, 'Salvar retornos'), flush: true}, A.table([
      {k: 't', t: 'Ativo', f: function (r) { return h('span', null, h('b', null, r.t), ' ', h('span', {class: 'muted'}, r.nome)); }}, {k: 'p', t: 'Pilar', s: function (r) { return +r.p.slice(1); }},
      {k: 'er', t: 'E[r] 12m', r: 1, s: function (r) { return r.er ? r.er.v : null; }, f: function (r) { var e = h('input', {class: 'inp n', type: 'number', step: '0.5', value: r.er ? +(r.er.v * 100).toFixed(2) : '', placeholder: '—', onchange: function () { if (e.value === '') delete er[r.t]; else er[r.t] = {v: Number(e.value) / 100, origem: 'gestor', data: new Date().toISOString().slice(0, 10)}; }}); return h('span', null, e, ' %'); }},
      {k: 'o', t: 'Origem', s: false, f: function (r) { return r.er ? h('span', null, A.ochip('gestor'), ' ', A.dataBR(r.er.data)) : ''; }}
    ], rows, {sort: 'p', dir: 1, search: 'Filtrar ativos'})));
    return wrap;
  }
})(APP, CORE);
