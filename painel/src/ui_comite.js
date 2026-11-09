/* COMITÊ DO MÊS (v3.6) — pauta do comitê de investimentos, no formato do "Processo de Alocação e Cenário — Oregon":
   macro e cenário, renda variável (Dividendos como core, Valor como satellite), FIIs e fundos, global e alocação, riscos
   e regulação, estudos e leituras. Três jeitos de pôr um assunto na pauta: "Levar ao comitê" em qualquer notícia, artigo
   ou item da Estante; as sugestões do robô (o que mais pesou no mês para a carteira); e o item escrito à mão.
   A pauta fica neste navegador (ou no banco do painel, quando configurado), com exportação para levar a outro aparelho. */
(function (A, C, I) {
  'use strict';
  var h = A.h, S = A.S;
  var SECOES = [['macro', 'Macro e cenário'], ['dividendos', 'Renda variável · Dividendos (core)'], ['valor', 'Renda variável · Valor (satellite)'], ['fundos', 'FIIs e fundos'],
    ['global', 'Global e alocação'], ['riscos', 'Riscos, regulação e tributação'], ['estudos', 'Estudos e leituras']];
  var NOME_SEC = {}; SECOES.forEach(function (s) { NOME_SEC[s[0]] = s[1]; });
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function mesAtual() { return I.hojeBRT().slice(0, 7); }
  function nomeMes(m) { return MESES[+m.slice(5, 7) - 1] + ' de ' + m.slice(0, 4); }
  var CM = {mes: null, form: false};
  function entradas(mes) { return STORE.list('comite').filter(function (e) { return e.mes === mes; }); }
  function chave(mes, x) { return mes + ':' + x.id; }

  // Seção sugerida pelo que o item é; você troca na pauta
  function secaoSugerida(x) {
    var at = (x.ativos || []).map(function (t) { return C.ATV[t]; }).filter(Boolean);
    if (at.some(function (a) { return a.pilar === 'P5'; })) return 'dividendos';
    if (at.some(function (a) { return a.pilar === 'P6'; })) return 'valor';
    if (at.some(function (a) { return a.classe === 'Ações'; }) || (x.ativos_vip || []).length) return 'dividendos';
    if (at.some(function (a) { return /FII|ETF|Fundo/i.test((a.tipo || '') + ' ' + (a.classe || '')); })) return 'fundos';
    if (at.length) return 'global';
    var tx = ((x.titulo || '') + ' ' + (x.temas || []).join(' ')).toLowerCase();
    if (/cvm|receita federal|tribut|imposto|regula|anbima|lei |resolu/.test(tx)) return 'riscos';
    if (x.col || /^academia$|^gestora_/.test(x.categoria || '') || x.tipo === 'paper' || x.tipo === 'research') return 'estudos';
    if (/juro|selic|copom|infla|fiscal|focus|pib|câmbio|cambio|fed|bcb|banco central/.test(tx) || x.categoria === 'instituicao') return 'macro';
    return 'macro';
  }
  A.naPauta = function (id, mes) { return !!STORE.get('comite', (mes || mesAtual()) + ':' + id); };
  A.levarAoComite = async function (x, opt) {
    opt = opt || {};
    var mes = opt.mes || mesAtual(), id = x.id ? chave(mes, x) : mes + ':' + STORE.newId('m');
    await STORE.put('comite', id, {mes: mes, quando: STORE.now(), secao: opt.secao || secaoSugerida(x), nota: opt.nota || '', origem: opt.origem || 'favorito',
      titulo: x.titulo, link: A.link(x.link) || null, fonte: A.orgDe ? (x.col ? (x.instituicao || x.col) : A.orgDe(x)) : (x.organizacao || x.fonte || ''), data: x.publicado_em || x.data || null,
      item_id: x.id || null, ativos: (x.ativos || []).concat(x.ativos_vip || []).slice(0, 6)});
  };
  A.botaoComite = function (x) {
    if (!x || !x.id) return null;
    var b = h('button', {class: 'btn sm cm-b' + (A.naPauta(x.id) ? ' on' : ''), title: 'Leva este item para a pauta do comitê de ' + nomeMes(mesAtual()), onclick: async function (ev) {
      ev.stopPropagation();
      try {
        if (A.naPauta(x.id)) await STORE.del('comite', chave(mesAtual(), x));
        else { await A.levarAoComite(x); A.toast('Na pauta do comitê de ' + nomeMes(mesAtual()) + '.'); }
      } catch (e) { A.toast(e && e.message || 'Não consegui salvar a pauta neste navegador.'); }
      var on = A.naPauta(x.id); b.textContent = on ? 'Na pauta do comitê' : 'Levar ao comitê'; b.classList.toggle('on', on);
    }}, A.naPauta(x.id) ? 'Na pauta do comitê' : 'Levar ao comitê');
    return b;
  };

  // Sugestões do robô para o mês: fatos e opiniões sobre a carteira, documentos à CVM, macro oficial e research mais repercutido
  function sugestoes(mes, ja) {
    var itens = (A.todosItensAtivo ? A.todosItensAtivo() : A.itensAtivo()).concat(A.itensResearch ? A.itensResearch() : []);
    var vis = {}, por = {macro: [], dividendos: [], valor: [], fundos: [], global: [], riscos: [], estudos: []};
    itens.forEach(function (x) {
      if (vis[x.id] || ja[x.id] || x.acervo || x.agrupado_em || !x.publicado_em || I.pub(x).slice(0, 7) !== mes || (I.baixaRelevancia && I.baixaRelevancia(x)) || (I.grupoXP && I.grupoXP(x))) return; vis[x.id] = 1;
      var d = I.diretos(x).filter(function (t) { return C.ATV[t]; }), pts = (x.prioridade || {}).pontos || 0;
      if (d.length && (x.categoria === 'oficial_empresa' || x.natureza === 'opiniao_casa' || d.some(function (t) { return I.vinculo(x, t).evento === 'resultado'; }))) pts += 4;
      if ((x.tambem_em || []).length) pts += x.tambem_em.length;
      var s = secaoSugerida(x);
      if (!d.length && (s === 'dividendos' || s === 'valor')) return;
      por[s].push({x: x, p: pts});
    });
    var out = [];
    SECOES.forEach(function (s) { por[s[0]].sort(function (a, b) { return b.p - a.p || I.pub(b.x).localeCompare(I.pub(a.x)); }).slice(0, s[0] === 'dividendos' || s[0] === 'valor' ? 4 : 3).forEach(function (o) { out.push({x: o.x, s: s[0]}); }); });
    return out;
  }

  function texto(mes, l) {
    var L = ['Comitê de investimentos · pauta de ' + nomeMes(mes)];
    SECOES.forEach(function (s) {
      var es = l.filter(function (e) { return e.secao === s[0]; });
      if (!es.length) return;
      L.push('', s[1]);
      es.forEach(function (e) { L.push('• ' + e.titulo + (e.fonte ? ' (' + e.fonte + (e.data ? ', ' + A.dataBR(e.data) : '') + ')' : '') + (e.link ? ' ' + e.link : '')); if (e.nota) L.push('   ' + e.nota); });
    });
    return L.join('\n');
  }
  function baixar(nome, txt, tipo) {
    try { var a = h('a', {href: URL.createObjectURL(new Blob([txt], {type: tipo})), download: nome}); document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
    catch (e) { A.drawer('Exportar pauta', h('textarea', {class: 'inp', style: 'min-height:60vh;width:100%', readonly: true}, txt)); }
  }
  function importar(arq) {
    var r = new FileReader();
    r.onload = async function () {
      try {
        var js = JSON.parse(r.result), l = Array.isArray(js) ? js : js.itens || [], n = 0;
        for (var i = 0; i < l.length; i++) { var e = l[i]; if (!e || !e.titulo || !e.mes) continue; var id = e.id || (e.mes + ':' + STORE.newId('i')); var c = Object.assign({}, e); delete c.id; await STORE.put('comite', id, c); n++; }
        A.toast(n + (n === 1 ? ' item importado.' : ' itens importados.')); A.rerender();
      } catch (e) { A.toast('Arquivo inválido: use o JSON exportado por esta tela.'); }
    };
    r.readAsText(arq);
  }

  function formManual(mes) {
    var tit = h('input', {class: 'inp w', placeholder: 'Assunto (ex.: Revisar peso de Klabin no Dividendos)', 'aria-label': 'Assunto'});
    var sec = h('select', {class: 'inp', 'aria-label': 'Seção'}, SECOES.map(function (s) { return h('option', {value: s[0]}, s[1]); }));
    var lk = h('input', {class: 'inp w', placeholder: 'Link (opcional)', 'aria-label': 'Link'});
    var nota = h('textarea', {class: 'inp w', style: 'min-height:70px', placeholder: 'Nota para o comitê: o que decidir, a premissa, o que levar de dado', 'aria-label': 'Nota'});
    return h('div', {class: 'cm-form'}, tit, h('div', {class: 'row', style: 'gap:8px;flex-wrap:wrap'}, sec, lk), nota,
      h('div', {class: 'row', style: 'gap:8px'}, h('button', {class: 'btn pri', onclick: async function () {
        if (!tit.value.trim()) { A.toast('Escreva o assunto.'); return; }
        try { await A.levarAoComite({titulo: tit.value.trim(), link: lk.value.trim()}, {mes: mes, secao: sec.value, nota: nota.value.trim(), origem: 'manual'}); CM.form = false; A.rerender(); }
        catch (e) { A.toast(e && e.message || 'Não consegui salvar.'); }
      }}, 'Pôr na pauta'), h('button', {class: 'btn', onclick: function () { CM.form = false; A.rerender(); }}, 'Cancelar')));
  }

  function linhaEntrada(e) {
    var lk = A.link(e.link), x = e.item_id && A.itemPorId ? A.itemPorId(e.item_id) : null;
    var nota = h('textarea', {class: 'inp w cm-nota', placeholder: 'Nota para o comitê', 'aria-label': 'Nota de ' + e.titulo}); nota.value = e.nota || '';
    nota.addEventListener('change', async function () { await STORE.put('comite', e.id, Object.assign({}, e, {nota: nota.value})); });
    var sec = h('select', {class: 'inp cm-sec', 'aria-label': 'Seção', onchange: async function () { await STORE.put('comite', e.id, Object.assign({}, e, {secao: sec.value})); A.rerender(); }},
      SECOES.map(function (s) { return h('option', {value: s[0], selected: e.secao === s[0] ? true : null}, s[1]); }));
    return h('li', {class: 'cm-it'},
      h('div', {class: 'cm-it-h'}, h('span', {class: 'cm-or o-' + e.origem, title: e.origem === 'manual' ? 'Escrito por você' : e.origem === 'sugestao' ? 'Sugestão do robô aceita' : 'Levado por você de uma notícia ou leitura'}, e.origem === 'manual' ? 'seu' : e.origem === 'sugestao' ? 'robô' : 'favorito'),
        x ? h('button', {class: 'nwl', onclick: function () { A.abrirItem(x); }}, e.titulo) : lk ? h('a', {href: lk, target: '_blank', rel: 'noopener'}, e.titulo) : h('b', null, e.titulo),
        lk ? h('a', {class: 'nw-ext', href: lk, target: '_blank', rel: 'noopener', 'aria-label': 'Abrir a fonte'}, '↗') : null,
        h('button', {class: 'btn link cm-x', title: 'Tirar da pauta', 'aria-label': 'Tirar da pauta', onclick: async function () { await STORE.del('comite', e.id); A.rerender(); }}, '×')),
      h('p', {class: 'cm-m'}, [e.fonte, e.data ? A.dataBR(e.data) : null, (e.ativos || []).join(', ') || null].filter(Boolean).join(' · ')),
      h('div', {class: 'cm-ed'}, sec, nota));
  }

  function comite() {
    var meses = {}; STORE.list('comite').forEach(function (e) { meses[e.mes] = 1; }); meses[mesAtual()] = 1;
    var lm = Object.keys(meses).sort().reverse();
    if (!CM.mes || !meses[CM.mes]) CM.mes = mesAtual();
    var mes = CM.mes, l = entradas(mes).sort(function (a, b) { return String(a.quando).localeCompare(String(b.quando)); }), ja = {};
    l.forEach(function (e) { if (e.item_id) ja[e.item_id] = 1; });
    var wrap = h('div', {class: 'comite'});
    wrap.appendChild(A.pageHead('Carteiras', 'Comitê do mês · ' + nomeMes(mes), 'Pauta do comitê de investimentos no formato do Processo de Alocação e Cenário: macro, Dividendos (core), Valor (satellite), fundos, global, riscos e estudos. Leve assuntos com "Levar ao comitê" em qualquer notícia, artigo ou item da Estante, aceite as sugestões do robô ou escreva à mão.',
      h('div', {class: 'row', style: 'gap:6px;flex-wrap:wrap'},
        h('select', {class: 'inp', 'aria-label': 'Mês', onchange: function (ev) { CM.mes = ev.target.value; A.rerender(); }}, lm.map(function (m) { return h('option', {value: m, selected: m === mes ? true : null}, nomeMes(m)); })),
        h('button', {class: 'btn', onclick: function () { CM.form = !CM.form; A.rerender(); }}, '+ Item à mão'),
        A.btnImprimir ? A.btnImprimir() : null,
        h('button', {class: 'btn pri', onclick: function () { var t = texto(mes, l); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { A.toast('Pauta copiada.'); }, function () { A.drawer('Pauta do comitê (texto)', h('textarea', {class: 'inp', style: 'min-height:60vh;width:100%', readonly: true}, t)); }); }}, 'Copiar pauta'))));
    if (CM.form) wrap.appendChild(A.sec('Novo item na pauta', {}, formManual(mes)));
    var g = h('div', {class: 'grid2 cm-g'}), esq = h('div'), dir = h('div', {class: 'no-print'});
    g.append(esq, dir); wrap.appendChild(g);
    if (!l.length) esq.appendChild(h('p', {class: 'empty'}, 'A pauta de ' + nomeMes(mes) + ' está vazia. Toque em "Levar ao comitê" numa notícia ou leitura, aceite uma sugestão ao lado ou escreva um item à mão.'));
    SECOES.forEach(function (s) {
      var es = l.filter(function (e) { return e.secao === s[0]; });
      if (!es.length) return;
      esq.appendChild(A.sec(s[1], {badge: h('span', {class: 'sec-n'}, String(es.length)), cls: 'cm-s'}, h('ul', {class: 'cm-l'}, es.map(linhaEntrada))));
    });
    if (mes === mesAtual()) {
      var sg = sugestoes(mes, ja);
      dir.appendChild(A.sec('Sugestões do robô · ' + nomeMes(mes), {hint: 'O que mais pesou no mês: fatos e opiniões sobre empresas da carteira, documentos à CVM, macro oficial e research que saiu em mais de uma fonte. Veículo pouco conhecido fica de fora.'},
        sg.length ? h('ul', {class: 'cm-sug'}, sg.map(function (o) {
          return h('li', null, h('div', {class: 'cm-sug-t'}, h('span', {class: 'cm-sec-t'}, NOME_SEC[o.s]), h('button', {class: 'nwl', onclick: function () { A.abrirItem(o.x); }}, o.x.titulo)),
            h('span', {class: 'cm-sug-m muted'}, (A.orgDe ? A.orgDe(o.x) : o.x.fonte) + ' · ' + A.dataBR(I.pub(o.x))),
            h('button', {class: 'btn sm', onclick: async function () { await A.levarAoComite(o.x, {secao: o.s, origem: 'sugestao'}); A.rerender(); }}, 'Levar'));
        })) : h('p', {class: 'empty sm'}, A.intel.versao ? 'Sem sugestões novas para o mês.' : 'Sem dados do robô nesta visualização.')));
    }
    dir.appendChild(A.sec('Guardar e levar', {hint: 'A pauta fica ' + (STORE.mode === 'db' ? 'no banco deste painel.' : 'neste navegador. Para usar em outro aparelho, exporte aqui e importe lá.')},
      h('div', {class: 'row', style: 'gap:6px;flex-wrap:wrap'},
        h('button', {class: 'btn sm', onclick: function () { baixar('pauta_comite_' + mes + '.json', JSON.stringify({mes: mes, itens: l}, null, 1), 'application/json'); }}, 'Exportar (JSON)'),
        h('button', {class: 'btn sm', onclick: function () { baixar('pauta_comite_' + mes + '.txt', texto(mes, l), 'text/plain'); }}, 'Baixar texto'),
        h('label', {class: 'btn sm'}, 'Importar', h('input', {type: 'file', accept: '.json,application/json', style: 'display:none', onchange: function (ev) { if (ev.target.files[0]) importar(ev.target.files[0]); }})))));
    return wrap;
  }

  /* ---------- rota: Carteiras › Comitê do mês ---------- */
  A.SUBS.cart.push(['comite', 'Comitê do mês']);
  var orig = A.areas.cart;
  A.areas.cart = function () {
    if (S.sub.cart !== 'comite') return orig();
    var wrap = h('div');
    wrap.appendChild(h('div', {class: 'sub sub2', role: 'toolbar', 'aria-label': 'Carteiras'}, A.SUBS.cart.map(function (it) { return h('button', {'aria-pressed': it[0] === 'comite' ? 'true' : 'false', onclick: function () { A.go('cart', it[0]); }}, it[1]); })));
    wrap.appendChild(comite());
    return wrap;
  };
  var mc = A.mostraCtx;  // o seletor de carteira do topo não serve para a pauta do comitê
  A.mostraCtx = function () { return S.area === 'cart' && S.sub.cart === 'comite' ? false : mc(); };
  A.comiteTexto = function (mes) { return texto(mes || mesAtual(), entradas(mes || mesAtual())); };
})(APP, CORE, INTEL);
