/* CORE — base canônica, validação, exposições, motor de choques e dimensionamento.
   Puro (sem DOM). Roda no navegador e no Node (testes). Retornos em decimais (0,01 = 1%).
   Choques de juros em pontos percentuais (1 = 100 bps); choques de preço em % (−8 = −8%). */
var CORE = (function () {
  'use strict';
  var TOL = 0.0005; // 0,05 p.p.: tolerância de arredondamento para somas de pesos

  var FATORES = [
    {k: 'selic', n: 'Selic', u: 'pp', grupo: 'Juros Brasil'},
    {k: 'pre', n: 'Curva prefixada (DI longo)', u: 'pp', grupo: 'Juros Brasil'},
    {k: 'real', n: 'Juro real (NTN-B)', u: 'pp', grupo: 'Juros Brasil'},
    {k: 'ust2', n: 'Treasury 2 anos', u: 'pp', grupo: 'Juros EUA'},
    {k: 'ust10', n: 'Treasury 10 anos', u: 'pp', grupo: 'Juros EUA'},
    {k: 'spread', n: 'Spread de crédito (HY e EM)', u: 'pp', grupo: 'Crédito'},
    {k: 'usd', n: 'Dólar contra o real', u: '%', grupo: 'Câmbio'},
    {k: 'ibov', n: 'Ibovespa', u: '%', grupo: 'Bolsas'},
    {k: 'sp', n: 'S&P 500 / desenvolvidos', u: '%', grupo: 'Bolsas'},
    {k: 'em', n: 'Emergentes', u: '%', grupo: 'Bolsas'},
    {k: 'brent', n: 'Brent', u: '%', grupo: 'Commodities'},
    {k: 'btc', n: 'Bitcoin', u: '%', grupo: 'Alternativos'}
  ];
  var FK = FATORES.map(function (f) { return f.k; });
  var ORDEM_PERFIL = {'Defensivo': 0, 'Conservador': 1, 'Moderado': 2, 'Arrojado': 3, 'Super Arrojado': 4};
  var GRAV = {critica: 0, alta: 1, media: 2, baixa: 3, info: 4};

  var D = null, ATV = {}, PIL = {}, MAND = {}, CARTS = [];

  function init(data) {
    D = data; ATV = data.ativos; PIL = {}; MAND = {}; CARTS = data.mandatos.slice().sort(function (a, b) { return a.ordem - b.ordem; });
    data.pilares.forEach(function (p) { PIL[p.pilar] = p; });
    CARTS.forEach(function (m) { MAND[m.id] = m; });
    return api;
  }

  /* ---------- utilidades ---------- */
  function sum(a, f) { var s = 0; for (var i = 0; i < a.length; i++) s += f ? f(a[i]) : a[i]; return s; }
  function near(a, b, tol) { return Math.abs(a - b) <= (tol == null ? TOL : tol); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function pct(v, d) { if (v == null || !isFinite(v)) return '—'; return (v * 100).toLocaleString('pt-BR', {minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d}) + '%'; }
  function resolveTicker(t) { return D.aliases[t] ? D.aliases[t].para : t; }
  function classeDe(t) { var a = ATV[t]; return a ? a.classe : null; }
  function riscoPilar(p) { return PIL[p] ? PIL[p].risco : null; }

  /* ---------- versões de carteira ----------
     Uma versão é {kind, id, cart, rotulo, data, fonte, pos:[{t,p,w,wp?,rot?}], alvo:{P:peso}|null,
     bandas:{P:{min,max}}|null, caixaDeliberado:bool}. Nada aqui altera pesos. */
  function estrategica(cart) {
    var e = D.estrategica[cart] || {}, alvo = {}, bandas = {};
    Object.keys(e).forEach(function (p) { alvo[p] = e[p].alvo; bandas[p] = {min: e[p].min, max: e[p].max}; });
    return {alvo: alvo, bandas: bandas};
  }
  function aprovadaOriginal(cart) {
    var e = estrategica(cart);
    return {kind: 'aprovada', id: D.aprovada.id, cart: cart, rotulo: D.aprovada.rotulo, data: D.aprovada.data, fonte: D.aprovada.fonte,
      pos: clone(D.aprovada.pos[cart] || []), alvo: e.alvo, bandas: e.bandas, checaInterno: true, caixaDeliberado: false};
  }
  function historica(id, cart) {
    var h = D.historicas.filter(function (x) { return x.id === id; })[0];
    if (!h) return null;
    return {kind: 'historica', id: h.id, cart: cart, rotulo: h.rotulo, data: h.data, fonte: h.fonte,
      pos: clone(h.pos[cart] || []), alvo: clone(h.pilares[cart] || {}), bandas: null, checaInterno: true, caixaDeliberado: false};
  }
  function pesosPorPilar(pos) { var o = {}; pos.forEach(function (x) { o[x.p] = (o[x.p] || 0) + x.w; }); return o; }

  /* ---------- motor de validação ---------- */
  function issue(g, regra, titulo, detalhe, impacto, procedimento, ref) {
    return {g: g, regra: regra, titulo: titulo, detalhe: detalhe || '', impacto: impacto || '', procedimento: procedimento || '', ref: ref || null};
  }
  // ctx: {series:{ticker:true}, limites:{posicao, emissor, setor}, sens:{...}, irmaos:{cart: versão}} — tudo opcional
  function validate(v, ctx) {
    ctx = ctx || {};
    var sens = ctx.sens || D.sens, issues = [], pos = v.pos || [], cart = v.cart, m = MAND[cart] || {};
    var total = sum(pos, function (x) { return x.w; });
    var porPil = pesosPorPilar(pos), interno = {};
    pos.forEach(function (x) { if (x.wp != null) interno[x.p] = (interno[x.p] || 0) + x.wp; });

    // R3 — soma total dos ativos
    if (!near(total, 1) && !(v.caixaDeliberado && total < 1)) {
      issues.push(issue('critica', 'R3', 'Ativos somam ' + pct(total) + ' (deveriam somar 100%)',
        'Soma dos pesos finais das ' + pos.length + ' linhas da versão “' + v.rotulo + '”.',
        'Uma carteira que não fecha em 100% não representa um portfólio investível. O motor antigo dividia os pesos por essa soma e mostrava a carteira como se estivesse correta; aqui risco, otimização e totais ficam bloqueados ou marcados como parciais.',
        'Corrigir os pesos no Comitê. Use “Proposta de correção” no Laboratório: a versão aprovada continua intacta até a aprovação.'));
    }
    // R2 — soma dos pilares
    if (v.alvo && Object.keys(v.alvo).length) {
      var sp = sum(Object.keys(v.alvo), function (p) { return v.alvo[p] || 0; });
      if (!near(sp, 1)) issues.push(issue('critica', 'R2', 'Pilares somam ' + pct(sp),
        'Pesos de pilar definidos para a carteira: ' + Object.keys(v.alvo).filter(function (p) { return v.alvo[p]; }).map(function (p) { return p + ' ' + pct(v.alvo[p], 0); }).join(', ') + '.',
        'Os pilares passam de 100%: algum pilar entrou sem que outro fosse reduzido.',
        'Decidir no Comitê quais pilares cedem peso.', cart && cart.indexOf('intl') === 0 ? 'e2' : null));
      // R1 — soma dos ativos por pilar contra o alvo do pilar; lacunas
      Object.keys(v.alvo).forEach(function (p) {
        var a = v.alvo[p] || 0, s = porPil[p] || 0;
        if (a > 0 && !pos.some(function (x) { return x.p === p && x.w > 0; })) {
          issues.push(issue('alta', 'R1', 'Lacuna de implementação no ' + p + ' (' + pct(a, 0) + ' sem ativo)',
            'O pilar ' + p + ' tem peso decidido de ' + pct(a) + ', mas nenhum ativo cadastrado nesta carteira.',
            'A lacuna não é caixa nem retorno zero: é uma parte da carteira sem instrumento definido. Fica fora de risco e cenários e é mostrada como descoberta.',
            'Definir os ativos do pilar ou retirar o pilar da carteira.'));
        } else if (v.checaInterno && a > 0 && !near(s, a)) {
          issues.push(issue('alta', 'R1', 'Ativos do ' + p + ' somam ' + pct(s) + ' contra ' + pct(a) + ' decididos no pilar',
            'Diferença de ' + pct(s - a) + ' dentro do pilar.', 'O peso efetivo do pilar difere do decidido.', 'Ajustar os pesos dos ativos do pilar.'));
        }
      });
    }
    // R1 — peso interno do pilar (aba Ativos, parte 1)
    if (v.checaInterno) Object.keys(interno).forEach(function (p) {
      if (interno[p] > 0 && !near(interno[p], 1)) {
        var nomes = pos.filter(function (x) { return x.p === p; }).map(function (x) { return x.t + ' ' + pct(x.wp, 0); }).join(', ');
        issues.push(issue('critica', 'R1', 'Ativos do ' + p + ' somam ' + pct(interno[p], 0) + ' por dentro do pilar',
          nomes + '.', 'O pilar fica com mais (ou menos) peso que o decidido e a carteira não fecha em 100%.',
          'Definir pesos internos que somem 100% no pilar' + (p === 'P2' ? ' (o 50/20/30 do Crescimento Conservador é um caminho apontado no Para estudar, e1)' : '') + '.', p === 'P2' ? 'e1' : (p === 'P13' ? 'e5' : null)));
      }
    });
    // R2b — bandas
    if (v.bandas) Object.keys(v.bandas).forEach(function (p) {
      var b = v.bandas[p], w = v.kind === 'aprovada' && v.alvo ? (v.alvo[p] || 0) : (porPil[p] || 0);
      if (b && b.min != null && b.max != null && (w < b.min - TOL || w > b.max + TOL))
        issues.push(issue('media', 'R7', p + ' em ' + pct(w) + ', fora da banda ' + pct(b.min, 0) + '–' + pct(b.max, 0),
          'Banda do pilar definida no simulador.', 'Desvio do mandato.', 'Rebalancear o pilar para dentro da banda ou registrar a exceção no Comitê.'));
    });
    // R4, R5, R6, R8 — cadastro, tickers, duplicação, placeholders
    var vistos = {}, ph = 0, phN = 0;
    pos.forEach(function (x) {
      var a = ATV[x.t];
      if (!a) issues.push(issue('alta', 'R4', x.t + ' sem cadastro', 'O ativo não existe na base de ativos.', 'Sem cadastro não há classe, moeda nem sensibilidade.', 'Cadastrar o ativo (Dados → Cadastro).'));
      var raw = x.rot ? String(x.rot).split(' (')[0].trim() : x.t;
      if (D.aliases[raw]) issues.push(issue('media', 'R5', 'Ticker histórico: ' + raw + ' → ' + D.aliases[raw].para, D.aliases[raw].nota,
        'Posição pode ser registrada com código encerrado.', 'Trocar o ticker nas abas Lista e Ativos do simulador.', 'e6'));
      if (vistos[x.t]) issues.push(issue('media', 'R6', x.t + ' aparece em ' + vistos[x.t] + ' e ' + x.p, 'Mesmo ativo em dois pilares da mesma carteira.', 'Duplicação esconde o peso real do ativo.', 'Consolidar o ativo em um pilar ou justificar.', x.t === 'DTLA' ? 'e10' : null));
      vistos[x.t] = x.p;
      if (a && a.status === 'placeholder' && x.w > 0) { ph += x.w; phN++; }
    });
    if (ph > 0) issues.push(issue('critica', 'R8', pct(ph, 0) + ' da carteira em ' + phN + ' fundos de teste (placeholders)',
      'Franchini FIDC e Fundo pós CP Franchini estão marcados como “Exemplo de teste, não é recomendação real”.',
      'Placeholders não entram em risco, cenários, performance nem alocação recomendada; essa fatia aparece como lacuna, não como caixa ou risco zero.',
      'Aprovar produtos reais para o Pilar 3 (ligado à Votação 6) e registrar em proposta.', 'e4'));
    // pares quase idênticos (observação qualitativa do Consultor F)
    (D.pares || []).forEach(function (pr) {
      if (vistos[pr.a] && vistos[pr.b]) issues.push(issue('baixa', 'R6', 'Sobreposição: ' + pr.a + ' e ' + pr.b,
        'Observação qualitativa do Consultor F: ' + pr.leitura + ' (correlação informada ' + String(pr.correlacao).replace('.', ',') + ', não calculada).',
        'Dois ETFs muito parecidos aumentam o número de tickers sem aumentar a diversificação.', 'Confirmar com séries de preços (Risco → Correlações).'));
    });
    // R7 — limites por posição/emissor/setor
    var lim = ctx.limites || {};
    if (lim.posicao) pos.forEach(function (x) { if (x.w > lim.posicao + TOL && !(ATV[x.t] && /ETF|FII/.test(ATV[x.t].tipo))) issues.push(issue('alta', 'R7', x.t + ' com ' + pct(x.w) + ' acima do limite de ' + pct(lim.posicao) + ' por posição', '', 'Concentração acima do mandato.', 'Reduzir ou registrar exceção.')); });
    if (lim.emissor) { var em = {}; pos.forEach(function (x) { var e = ATV[x.t] && ATV[x.t].emissor; if (e && !/Tesouro/.test(e)) em[e] = (em[e] || 0) + x.w; }); Object.keys(em).forEach(function (e) { if (em[e] > lim.emissor + TOL) issues.push(issue('alta', 'R7', 'Emissor ' + e + ' com ' + pct(em[e]), 'Limite ' + pct(lim.emissor), 'Concentração por emissor.', 'Reduzir.')); }); }
    if (lim.setor) { var se = {}; pos.forEach(function (x) { var a = ATV[x.t]; if (a && a.classe === 'Ações') se[a.setor] = (se[a.setor] || 0) + x.w; }); Object.keys(se).forEach(function (s) { if (se[s] > lim.setor + TOL) issues.push(issue('media', 'R7', 'Setor ' + s + ' com ' + pct(se[s]), 'Limite ' + pct(lim.setor), 'Concentração setorial.', 'Reduzir.')); }); }
    // R9 — perfil × composição
    var risky = sum(pos.filter(function (x) { var r = riscoPilar(x.p); return r === 'RV' || r === 'ALT'; }), function (x) { return x.w; });
    if (ctx.irmaos && m.familia && ORDEM_PERFIL[m.perfil] != null) {
      var acima = [];
      CARTS.forEach(function (o) {
        if (o.id === cart || o.familia !== m.familia || ORDEM_PERFIL[o.perfil] == null || !ctx.irmaos[o.id]) return;
        var r2 = sum(ctx.irmaos[o.id].pos.filter(function (x) { var r = riscoPilar(x.p); return r === 'RV' || r === 'ALT'; }), function (x) { return x.w; });
        if (ORDEM_PERFIL[m.perfil] < ORDEM_PERFIL[o.perfil] && risky > r2 + TOL) acima.push(o.rotulo + ' ' + pct(r2, 0));
      });
      if (acima.length) issues.push(issue('alta', 'R9', 'Perfil ' + m.perfil + ' com ' + pct(risky, 0) + ' em renda variável e alternativos, mais que perfis de risco maior',
        'Comparação na mesma família: ' + acima.join(' · ') + '.' + (m.rotulo_base && m.rotulo_base !== m.rotulo ? ' O rótulo mudou de “' + m.rotulo_base + '” (base 30/10) para “' + m.rotulo + '”.' : ''),
        'A classificação de risco não corresponde à composição.', 'Confirmar se a carteira deve seguir o perfil do rótulo ou se o rótulo está errado.', cart === 'renda-def' ? 'e3' : null));
    }
    if (m.status && m.status !== 'ativa') issues.push(issue('media', 'R9', 'Carteira com status “' + m.status + '”', m.nota || '', 'Não deve ser apresentada como recomendação até a confirmação.', 'Confirmar o cancelamento no Comitê.', 'e5'));
    // R10 — dados, sensibilidade e liquidez
    var semSens = [], semSerie = [];
    pos.forEach(function (x) {
      var a = ATV[x.t]; if (!a || a.status === 'placeholder' || !(x.w > 0)) return;
      var s = sens[x.t]; if (!s || s.m === 'nd') semSens.push(x.t);
      if (!(ctx.series && ctx.series[x.t])) semSerie.push(x.t);
    });
    if (semSens.length) issues.push(issue('alta', 'R10', semSens.length + ' posição(ões) sem sensibilidade cadastrada: ' + semSens.join(', '),
      semSens.map(function (t) { return (sens[t] && sens[t].nota) || t; }).join(' '),
      'Não é risco zero: essas posições ficam fora dos cenários e aparecem como descobertas.', 'Cadastrar a sensibilidade em Risco → Premissas, ou importar série para estimar.'));
    if (semSerie.length) issues.push(issue('info', 'R10', semSerie.length + ' posição(ões) sem série histórica importada',
      semSerie.slice(0, 12).join(', ') + (semSerie.length > 12 ? '…' : ''),
      'Volatilidade, correlação, VaR, Expected Shortfall e otimização não podem ser calculados para elas.', 'Importar preços ajustados (Dados → Preços).'));
    if (!ctx.liquidez) issues.push(issue('info', 'R10', 'Liquidez não cadastrada', 'Não há volume médio diário dos ativos na base.', 'Liquidez por horizonte indisponível.', 'Importar volume médio diário (Dados → Liquidez).'));
    if (!lim.posicao && !lim.emissor && !lim.setor) issues.push(issue('info', 'R7', 'Limites por posição, emissor e setor não cadastrados', 'O simulador só traz bandas por pilar.', 'Limites de concentração não são verificados.', 'Cadastrar os limites do mandato (Construção → Limites).'));

    issues.sort(function (a, b) { return GRAV[a.g] - GRAV[b.g]; });
    var cob = cobertura(v, sens);
    var invalida = issues.some(function (i) { return i.g === 'critica' && (i.regra === 'R3' || i.regra === 'R2' || (i.regra === 'R1')); });
    var status = invalida ? 'invalida' : (cob.descoberto > TOL ? 'parcial' : 'valida');
    return {status: status, issues: issues, total: total, porPilar: porPil, interno: interno, cobertura: cob, risky: risky,
      contagem: issues.reduce(function (o, i) { o[i.g] = (o[i.g] || 0) + 1; return o; }, {})};
  }

  // Cobertura: parte da carteira com instrumento investível e sensibilidade cadastrada.
  function cobertura(v, sens) {
    sens = sens || D.sens;
    var tot = 0, cob = 0, ph = 0, nd = 0, sc = 0;
    (v.pos || []).forEach(function (x) {
      tot += x.w; var a = ATV[x.t];
      if (!a) { sc += x.w; return; }
      if (a.status === 'placeholder') { ph += x.w; return; }
      var s = sens[x.t]; if (!s || s.m === 'nd') { nd += x.w; return; }
      cob += x.w;
    });
    var lac = 0;
    if (v.alvo) Object.keys(v.alvo).forEach(function (p) { if ((v.alvo[p] || 0) > 0 && !(v.pos || []).some(function (x) { return x.p === p && x.w > 0; })) lac += v.alvo[p]; });
    return {total: tot, coberto: cob, placeholder: ph, semSens: nd, semCadastro: sc, lacuna: lac, descoberto: ph + nd + sc + lac};
  }

  function validateAll(ctx, versoes) {
    ctx = ctx || {};
    var irm = {}; CARTS.forEach(function (m) { irm[m.id] = versoes && versoes[m.id] || aprovadaOriginal(m.id); });
    var out = {};
    CARTS.forEach(function (m) { out[m.id] = validate(irm[m.id], Object.assign({}, ctx, {irmaos: irm})); });
    return out;
  }

  /* ---------- exposições ---------- */
  function agg(pos, key) { var o = {}; pos.forEach(function (x) { var k = key(x); if (k == null) k = 'Não cadastrado'; o[k] = (o[k] || 0) + x.w; }); return o; }
  // Exposição a fatores = Σ w_i × sensibilidade_i (premissa qualitativa, não estimada).
  function exposicoes(v, sens) {
    sens = sens || D.sens;
    var pos = (v.pos || []).filter(function (x) { return x.w > 0; });
    var inv = pos.filter(function (x) { return ATV[x.t] && ATV[x.t].status !== 'placeholder'; });
    var f = {dur_pre: 0, dur_real: 0, dur_selic: 0, dur_ust: 0, spread_dur: 0, beta_ibov: 0, juros_resid: 0, usd_direto: 0, usd_indireto: 0, brent: 0, sp: 0, em: 0, btc: 0};
    inv.forEach(function (x) {
      var s = sens[x.t]; if (!s) return;
      if (s.x) f.usd_direto += x.w;
      if (s.m === 'rf') { if (s.f === 'pre') f.dur_pre += x.w * s.d; else if (s.f === 'real') f.dur_real += x.w * s.d; else if (s.f === 'selic') f.dur_selic += x.w * s.d; else f.dur_ust += x.w * s.d; f.spread_dur += x.w * (s.s || 0); }
      if (s.m === 'acao') { f.beta_ibov += x.w * s.beta; f.juros_resid += x.w * s.j; f.usd_indireto += x.w * s.u; f.brent += x.w * s.b; }
      if (s.m === 'fii') { f.beta_ibov += x.w * s.beta; f.dur_real += x.w * s.d; }
      if (s.m === 'rv') { f.sp += x.w * s.sp; f.em += x.w * s.em; f.btc += x.w * s.btc; }
    });
    var w = inv.map(function (x) { return x.w; }), s = sum(w);
    var hhi = s > 0 ? sum(w, function (x) { return (x / s) * (x / s); }) : null;
    return {
      porPilar: agg(pos, function (x) { return x.p; }), porClasse: agg(pos, function (x) { return classeDe(x.t); }),
      porMoeda: agg(pos, function (x) { return ATV[x.t] && ATV[x.t].moeda; }), porPais: agg(inv, function (x) { return ATV[x.t] && ATV[x.t].pais; }),
      porSetor: agg(inv, function (x) { return ATV[x.t] && ATV[x.t].setor; }), porEmissor: agg(inv, function (x) { return ATV[x.t] && (ATV[x.t].grupo_economico || ATV[x.t].emissor); }),
      porRisco: agg(pos, function (x) { return riscoPilar(x.p); }), porStatus: agg(pos, function (x) { return ATV[x.t] ? ATV[x.t].status : 'sem cadastro'; }),
      fatores: f, hhi: hhi, effN: hhi ? 1 / hhi : null, nTickers: inv.length, maior: inv.slice().sort(function (a, b) { return b.w - a.w; })[0] || null,
      top5: sum(inv.slice().sort(function (a, b) { return b.w - a.w; }).slice(0, 5), function (x) { return x.w; })
    };
  }

  /* ---------- motor de choques (instantâneo) ----------
     Renda fixa: retorno de preço = −D·Δy (aproximação linear de 1ª ordem). Só soma ½·C·Δy² se a convexidade
       C estiver cadastrada; nunca usa D² no lugar da convexidade. Spread: −SD·Δs.
     Ações: β·Ibov + j·ΔDI + u·Δdólar + b·ΔBrent, em que j, u, b são sensibilidades RESIDUAIS (o que a ação
       anda além do que o β já explica). Assim um choque conjunto de Ibovespa e juros não conta o juro duas vezes.
     FIIs: β·Ibov − D_real·Δjuro real.  RV exterior: cargas em S&P, emergentes e bitcoin (em dólar).
     Câmbio: ativo em dólar → retorno em reais = (1 + r_local)(1 + r_câmbio) − 1 (composição multiplicativa).
     Choque idiossincrático por ativo (resultado da empresa) soma ao retorno local. */
  function retAtivo(t, c, sens, idio) {
    sens = sens || D.sens; c = c || {};
    var a = ATV[t];
    if (!a) return {ok: false, motivo: 'sem cadastro'};
    if (a.status === 'placeholder') return {ok: false, motivo: 'placeholder de teste (lacuna)'};
    var s = sens[t];
    if (!s || s.m === 'nd') return {ok: false, motivo: (s && s.nota) || 'sem sensibilidade cadastrada'};
    var partes = {}, local = 0, n = function (k) { var v = Number(c[k]); return isFinite(v) ? v : 0; };
    function add(k, v) { if (v) { partes[k] = (partes[k] || 0) + v; local += v; } }
    if (s.m === 'rf') {
      var dy = n(s.f) / 100;
      add(s.f, -(s.d || 0) * dy);
      if (s.conv != null && dy) add(s.f, 0.5 * s.conv * dy * dy);
      add('spread', -(s.s || 0) * n('spread') / 100);
    } else if (s.m === 'acao') {
      add('ibov', (s.beta || 0) * n('ibov') / 100); add('pre', (s.j || 0) * n('pre') / 100);
      add('usd', (s.u || 0) * n('usd') / 100); add('brent', (s.b || 0) * n('brent') / 100);
    } else if (s.m === 'fii') {
      add('ibov', (s.beta || 0) * n('ibov') / 100); add('real', -(s.d || 0) * n('real') / 100);
    } else if (s.m === 'rv') {
      add('sp', (s.sp || 0) * n('sp') / 100); add('em', (s.em || 0) * n('em') / 100); add('btc', (s.btc || 0) * n('btc') / 100);
    }
    var id = idio && isFinite(Number(idio[t])) ? Number(idio[t]) / 100 : 0;
    if (id) add('idio', id);
    var fx = s.x ? n('usd') / 100 : 0;
    var total = (1 + local) * (1 + fx) - 1;
    return {ok: true, local: local, fx: fx, cross: local * fx, total: total, partes: partes, moeda: s.x ? 'USD' : 'BRL'};
  }
  // Contribuição = peso × retorno, SEM normalizar. Posições sem cobertura ficam listadas à parte.
  function choqueCarteira(v, c, sens, idio) {
    var itens = [], desc = [], tot = 0, porFator = {}, porPilar = {};
    (v.pos || []).forEach(function (x) {
      if (!(x.w > 0)) return;
      var r = retAtivo(x.t, c, sens, idio);
      if (!r.ok) { desc.push({t: x.t, p: x.p, w: x.w, motivo: r.motivo}); return; }
      var ctb = x.w * r.total; tot += ctb;
      Object.keys(r.partes).forEach(function (k) { porFator[k] = (porFator[k] || 0) + x.w * r.partes[k]; });
      if (r.fx) { porFator.usd_conv = (porFator.usd_conv || 0) + x.w * (r.fx + r.cross); }
      porPilar[x.p] = (porPilar[x.p] || 0) + ctb;
      itens.push({t: x.t, p: x.p, w: x.w, r: r, ctb: ctb});
    });
    var val = validate(v, {sens: sens || D.sens});
    var cob = cobertura(v, sens);
    return {itens: itens, descobertos: desc, total: tot, porFator: porFator, porPilar: porPilar, cobertura: cob,
      somaPesos: val.total, status: val.status,
      parcial: val.status !== 'valida', aviso: val.status === 'invalida' ? 'Inválida: pesos somam ' + pct(val.total) + '. O total é a soma das contribuições das posições como estão, sem normalizar.' :
        (cob.descoberto > TOL ? 'Parcial: ' + pct(cob.descoberto) + ' da carteira sem instrumento ou sensibilidade (não entra no total).' : '')};
  }
  // Horizonte da renda fixa: em relação a não ter o choque, o preço muda hoje pelo motor (−D·Δy − SD·Δs, + convexidade só se
  // cadastrada) e o carrego passa a render Δy (+ Δs nos títulos com spread) a mais por ano. Relativo no horizonte H ≈ preço + carrego·H;
  // a perda é recuperada em ≈ |preço| ÷ carrego anos (≈ D quando só a curva se move).
  function horizonteRF(t, c, H, sens) {
    sens = sens || D.sens; var s = sens[t]; if (!s || s.m !== 'rf') return null;
    var r = retAtivo(t, c, sens); if (!r.ok) return null;
    var preco = r.local - (r.partes.idio || 0);
    var carrego = (Number(c[s.f]) || 0) / 100 + (s.s ? (Number(c.spread) || 0) / 100 : 0);
    var rec = preco < 0 && carrego > 0 ? -preco / carrego : null;
    return {preco: preco, carregoExtraAno: carrego, recuperacaoAnos: rec, relativoH: preco + carrego * (H || 1)};
  }

  /* ---------- dimensionamento de posição ---------- */
  // Cenários da tese: [{nome, p, r}] com Σp = 1. E[r] = Σ p·r. Perda no pior cenário = w·min(r).
  function validaProbs(cen) {
    if (!cen || !cen.length) return {ok: false, motivo: 'sem cenários'};
    for (var i = 0; i < cen.length; i++) { var p = cen[i].p == null || cen[i].p === '' ? NaN : Number(cen[i].p); if (!isFinite(p) || p < 0 || p > 1) return {ok: false, motivo: 'probabilidade fora de [0, 1] em ' + (cen[i].nome || 'cenário ' + (i + 1))}; if (cen[i].r == null || cen[i].r === '' || !isFinite(Number(cen[i].r))) return {ok: false, motivo: 'retorno ausente em ' + (cen[i].nome || 'cenário ' + (i + 1))}; }
    var s = sum(cen, function (x) { return Number(x.p); });
    if (Math.abs(s - 1) > 1e-6) return {ok: false, motivo: 'probabilidades somam ' + pct(s) + ', não 100%'};
    return {ok: true};
  }
  function sizing(o) {
    var vp = validaProbs(o.cenarios); if (!vp.ok) return vp;
    var er = sum(o.cenarios, function (x) { return x.p * x.r; });
    var pior = Math.min.apply(null, o.cenarios.map(function (x) { return x.r; }));
    var out = {ok: true, er: er, contribEsperada: o.w * er, perdaPior: o.w * pior, pior: pior};
    if (o.perdaMax != null && pior < 0) out.wMaxPorPerda = o.perdaMax / -pior;
    if (o.wNovo != null) { out.contribEsperadaNovo = o.wNovo * er; out.perdaPiorNovo = o.wNovo * pior; }
    return out;
  }
  // Custo de oportunidade de financiar a compra: Δw·(E[r_compra] − E[r_fonte]) − custos − impostos (decimais da carteira)
  function custoOportunidade(o) {
    if (o.erCompra == null || o.erFonte == null) return {ok: false, motivo: 'retorno esperado não informado para ' + (o.erCompra == null ? 'o ativo comprado' : 'a fonte de recursos')};
    var custo = (Math.abs(o.dw) * 2) * (o.custoBps || 0) / 10000; // compra + venda
    var imp = Math.abs(o.dw) * (o.impostoSobreVenda || 0);
    var bruto = o.dw * (o.erCompra - o.erFonte);
    return {ok: true, bruto: bruto, custo: custo, imposto: imp, liquido: bruto - custo - imp};
  }

  /* ---------- operações de proposta ---------- */
  // Aplica uma mudança de peso com financiamento explícito. Retorna nova lista (não altera a original).
  function aplicarMovimento(pos, mov) {
    var out = clone(pos), find = function (t) { return out.filter(function (x) { return x.t === t; })[0]; };
    var alvo = find(mov.t);
    if (!alvo) { alvo = {t: mov.t, p: (ATV[mov.t] && ATV[mov.t].pilar) || mov.p || '?', w: 0}; out.push(alvo); }
    var dw = mov.para - alvo.w;
    if (Math.abs(dw) < 1e-12) return {ok: true, pos: out};
    if (mov.fonte === 'aporte') {
      if (dw < 0) return {ok: false, motivo: 'aporte só financia aumento'};
      if (!(mov.para < 1)) return {ok: false, motivo: 'com aporte, o peso final precisa ser menor que 100%'};
      // aporte de Δ (fração do patrimônio atual) investido no ativo: w_i' = w_i/(1+Δ); w_alvo' = (w_alvo+Δ)/(1+Δ)
      var D_ = (mov.para - alvo.w) / (1 - mov.para); // resolve (w+Δ)/(1+Δ) = para
      out.forEach(function (x) { x.w = x === alvo ? (x.w + D_) / (1 + D_) : x.w / (1 + D_); });
      return {ok: true, pos: out, aporte: D_};
    }
    alvo.w = mov.para;
    if (mov.fonte === 'reduzir' || mov.fonte === 'destino') {
      var f = find(mov.de); if (!f) { if (dw > 0) return {ok: false, motivo: 'fonte ' + mov.de + ' não está na carteira'}; f = {t: mov.de, p: (ATV[mov.de] && ATV[mov.de].pilar) || '?', w: 0}; out.push(f); }
      if (f.w - dw < -1e-12) return {ok: false, motivo: mov.de + ' tem só ' + pct(f.w) + ' para financiar ' + pct(dw)};
      f.w = f.w - dw;
    } else if (mov.fonte === 'prorata') {
      var grp = out.filter(function (x) { return x !== alvo && x.p === mov.pilar && x.w > 0 && !(ATV[x.t] && ATV[x.t].status === 'placeholder'); });
      var s = sum(grp, function (x) { return x.w; });
      if (dw > 0 && s < dw - 1e-12) return {ok: false, motivo: 'o ' + mov.pilar + ' tem só ' + pct(s) + ' para financiar'};
      if (!grp.length) return {ok: false, motivo: 'sem posições no ' + mov.pilar};
      grp.forEach(function (x) { x.w = x.w - dw * (x.w / s); });
    } else if (mov.fonte === 'prorata_todas') {
      var gr2 = out.filter(function (x) { return x !== alvo && x.w > 0 && !(ATV[x.t] && ATV[x.t].status === 'placeholder'); });
      var s2 = sum(gr2, function (x) { return x.w; });
      if (!gr2.length || (dw > 0 && s2 < dw - 1e-12)) return {ok: false, motivo: 'posições investíveis insuficientes para financiar'};
      gr2.forEach(function (x) { x.w = x.w - dw * (x.w / s2); });
    } // 'livre': sem contrapartida; a soma precisa ser fechada depois
    out.forEach(function (x) { if (Math.abs(x.w) < 1e-12) x.w = 0; });
    return {ok: true, pos: out};
  }

  /* ---------- comparação entre versões ---------- */
  function diff(a, b, sens) {
    var mapA = {}, mapB = {}, ts = [];
    (a.pos || []).forEach(function (x) { mapA[x.t] = (mapA[x.t] || 0) + x.w; if (ts.indexOf(x.t) < 0) ts.push(x.t); });
    (b.pos || []).forEach(function (x) { mapB[x.t] = (mapB[x.t] || 0) + x.w; if (ts.indexOf(x.t) < 0) ts.push(x.t); });
    var linhas = ts.map(function (t) { return {t: t, a: mapA[t] || 0, b: mapB[t] || 0, d: (mapB[t] || 0) - (mapA[t] || 0)}; })
      .filter(function (r) { return r.a || r.b; }).sort(function (x, y) { return Math.abs(y.d) - Math.abs(x.d); });
    var ea = exposicoes(a, sens), eb = exposicoes(b, sens);
    function dmap(oa, ob) { var ks = Object.keys(Object.assign({}, oa, ob)); return ks.map(function (k) { return {k: k, a: oa[k] || 0, b: ob[k] || 0, d: (ob[k] || 0) - (oa[k] || 0)}; }); }
    return {ativos: linhas, pilares: dmap(ea.porPilar, eb.porPilar), classes: dmap(ea.porClasse, eb.porClasse),
      fatores: dmap(ea.fatores, eb.fatores), moedas: dmap(ea.porMoeda, eb.porMoeda), setores: dmap(ea.porSetor, eb.porSetor), ea: ea, eb: eb,
      giro: sum(linhas, function (r) { return Math.abs(r.d); }) / 2};
  }

  /* ---------- importação de dados (sem eval; validação linha a linha) ---------- */
  // br = arquivo em formato brasileiro (vírgula decimal): '130.000' vira 130000, não 130.
  function parseNum(s, br) {
    if (s == null) return NaN; if (typeof s === 'number') return s;
    var t = String(s).trim().replace(/\s/g, '').replace(/%$/, '');
    if (!t) return NaN;
    if (br && /^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    if (/^-?[\d.]+,\d+$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); // 1.234,56
    else if (/^-?\d+,\d+$/.test(t)) t = t.replace(',', '.');
    else t = t.replace(/,/g, '');
    var v = Number(t); return isFinite(v) ? v : NaN;
  }
  function parseDate(s) {
    if (s == null) return null;
    if (typeof s === 'number' && s > 20000 && s < 80000) { var d0 = new Date(Date.UTC(1899, 11, 30) + s * 86400000); return d0.toISOString().slice(0, 10); } // serial do Excel
    var t = String(s).trim(), m;
    if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return null;
  }
  function parseCSV(text) {
    var lines = String(text).replace(/^﻿/, '').split(/\r?\n/).filter(function (l) { return l.trim().length; });
    if (!lines.length) return [];
    var head = lines[0], delim = (head.split(';').length > head.split(',').length) ? ';' : (head.indexOf('\t') >= 0 ? '\t' : ',');
    return lines.map(function (l) {
      var out = [], cur = '', q = false;
      for (var i = 0; i < l.length; i++) { var ch = l[i]; if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (ch === delim && !q) { out.push(cur); cur = ''; } else cur += ch; }
      out.push(cur); return out.map(function (x) { return x.trim(); });
    });
  }
  // Tabela de preços: formato largo (data, T1, T2, ...) ou longo (data, ticker, preço). Retorna {series:{id:[[data, v]]}, rejeitadas:[...], formato}
  function parsePriceTable(rows) {
    if (!rows || rows.length < 2) return {ok: false, motivo: 'arquivo vazio'};
    var h = rows[0].map(function (x) { return String(x).trim(); }), low = h.map(function (x) { return x.toLowerCase(); });
    var iD = low.findIndex(function (x) { return /^(data|date|dt)$/.test(x); }); if (iD < 0) iD = 0;
    var iT = low.findIndex(function (x) { return /^(ticker|ativo|codigo|código|id|serie|série)$/.test(x); });
    var iV = low.findIndex(function (x) { return /^(preco|preço|price|close|fechamento|valor|value|adj ?close|ajustado)$/.test(x); });
    var series = {}, rej = [];
    var br = rows.slice(1, 400).some(function (r) { return r.some(function (c) { return /^-?[\d.]*\d,\d+%?$/.test(String(c).trim()); }); });
    function put(id, d, v, ln) { if (!id) return; id = resolveTicker(String(id).trim().toUpperCase().replace(/\s+/g, ' ')); if (!d) { rej.push({linha: ln, motivo: 'data inválida'}); return; } if (!isFinite(v)) { rej.push({linha: ln, motivo: 'valor inválido em ' + id}); return; } if (v <= 0 && !/^(DI|CDI|SELIC|UST|NTNB|PRE|REAL)/.test(id)) { rej.push({linha: ln, motivo: 'preço não positivo em ' + id}); return; } (series[id] = series[id] || []).push([d, v]); }
    if (iT >= 0 && iV >= 0) {
      for (var r = 1; r < rows.length; r++) put(rows[r][iT], parseDate(rows[r][iD]), parseNum(rows[r][iV], br), r + 1);
      return {ok: true, series: series, rejeitadas: rej, formato: 'longo'};
    }
    for (var r2 = 1; r2 < rows.length; r2++) { var d = parseDate(rows[r2][iD]); for (var c = 0; c < h.length; c++) { if (c === iD || !h[c]) continue; var raw = rows[r2][c]; if (raw === '' || raw == null) continue; put(h[c], d, parseNum(raw, br), r2 + 1); } }
    return {ok: true, series: series, rejeitadas: rej, formato: 'largo'};
  }
  // Tabela genérica com cabeçalho → objetos, sem interpretar fórmulas nem scripts
  function parseObjects(rows) {
    if (!rows || rows.length < 2) return [];
    var h = rows[0].map(function (x) { return String(x).trim().toLowerCase(); });
    return rows.slice(1).map(function (r) { var o = {}; h.forEach(function (k, i) { o[k] = r[i] == null ? '' : String(r[i]).trim(); }); return o; });
  }

  var api = {
    init: init, FATORES: FATORES, FK: FK, TOL: TOL, GRAV: GRAV, ORDEM_PERFIL: ORDEM_PERFIL,
    get D() { return D; }, get ATV() { return ATV; }, get PIL() { return PIL; }, get MAND() { return MAND; }, get CARTS() { return CARTS; },
    sum: sum, near: near, clone: clone, pct: pct, resolveTicker: resolveTicker,
    estrategica: estrategica, aprovadaOriginal: aprovadaOriginal, historica: historica, pesosPorPilar: pesosPorPilar,
    validate: validate, validateAll: validateAll, cobertura: cobertura, exposicoes: exposicoes,
    retAtivo: retAtivo, choqueCarteira: choqueCarteira, horizonteRF: horizonteRF,
    validaProbs: validaProbs, sizing: sizing, custoOportunidade: custoOportunidade, aplicarMovimento: aplicarMovimento, diff: diff,
    parseNum: parseNum, parseDate: parseDate, parseCSV: parseCSV, parsePriceTable: parsePriceTable, parseObjects: parseObjects
  };
  return api;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = CORE;
