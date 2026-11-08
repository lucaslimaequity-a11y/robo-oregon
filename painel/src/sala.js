/* Sala de Gestão — motor de análise de eventos (Research, Risk Officer, Portfolio Manager, Consultoria) */
(function (A, C) {
  'use strict';
  var h = A.h, S = A.S;
  var NIV = {};
  var nf1 = new Intl.NumberFormat('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1});
  var nf2 = new Intl.NumberFormat('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  var nf0 = new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 1});
  var sgn = function (v) { return v > 0 ? '+' : v < 0 ? '−' : ''; };
  var fp = function (v) { return sgn(v) + nf1.format(Math.abs(v)) + '%'; };
  var fpp = function (v) { return sgn(v) + nf2.format(Math.abs(v)) + ' p.p.'; };
  var LIM = {selic: [-4, 6], pre: [-4, 6], real: [-3, 4], ust2: [-2, 2], ust10: [-2, 2], spread: [-2, 5], usd: [-25, 40], ibov: [-40, 30], sp: [-40, 30], em: [-40, 30], brent: [-50, 60], btc: [-70, 100]};

  /*__LEGACY_TOPICOS__*/

  // Tópicos adicionais da leitura local. Co-movimentos são hipóteses de trabalho (marcadas como tal na ata).
  TOPICOS.push(
    {rx: /\b(juros?|di1?|taxas? basicas?)\b/, fx: function (c, d) {
      // “juros subiu no Brasil”, “alta de juros”, “o DI longo abriu 40 bps”. Fica de fora quando outro tópico já trata a frase.
      if (/(curva|juros futuros|di futuro|taxas? de juros|prefixad|selic|copom|ntn|juro real|tesouro ipca)/.test(c) || /(eua|americ|\bfed\b|fomc|treasur|t-?note)/.test(c)) return null;
      if (!d) return null;
      var pp = ppIn(c) || 0.5, curto = /\b(di curto|curto|vencimentos curtos)\b/.test(c);
      return {o: {pre: d * pp, real: 0.5 * d * pp, selic: curto ? 0.5 * d * pp : 0, ibov: -4 * d * pp}, x: ['pre'], t: 'juros no Brasil ' + (d > 0 ? 'subindo ' : 'caindo ') + fpp(d * pp)};
    }},
    {rx: /\b(minerio|minerio de ferro|vale3?)\b/, fx: function (c, d) {
      if (!d) return null; var p = pctIn(c) || 8;
      return {o: {ibov: 0.2 * d * p, em: 0.2 * d * p, usd: -0.1 * d * p}, t: 'minério ' + fp(d * p) + ' (sem fator próprio: efeito via Ibovespa e emergentes)'};
    }}
  );

  /* ---------- leitura local (sem IA) ---------- */
  function lerLocal(texto) {
    var nv0 = A.prem().niveis; Object.keys(nv0).forEach(function (k) { NIV[k] = nv0[k]; });
    var t = semAc(texto), clauses = t.split(/[;!?\n]+|\.(?=\s|$)/).map(function (s) { return s.trim(); }).filter(Boolean);
    var imp = {}, exp = {}, lidos = [];
    clauses.forEach(function (c) {
      TOPICOS.forEach(function (tp) {
        var m = tp.rx.exec(c); if (!m) return;
        var r = tp.fx(c, dirNear(c, m.index)); if (!r) return;
        var xs = r.x || [];
        Object.keys(r.o).forEach(function (f) { if (xs.indexOf(f) >= 0) exp[f] = (exp[f] || 0) + r.o[f]; else imp[f] = (imp[f] || 0) + r.o[f]; });
        if (lidos.indexOf(r.t) < 0) lidos.push(r.t);
      });
    });
    var base = {};
    C.FK.forEach(function (k) { var v = Object.prototype.hasOwnProperty.call(exp, k) ? exp[k] : (imp[k] || 0); v = Math.max(LIM[k][0], Math.min(LIM[k][1], Math.round(v * 100) / 100)); if (v) base[k] = v; });
    var citados = [], up = String(texto).toUpperCase();
    Object.keys(C.ATV).forEach(function (k) { if (C.ATV[k].status === 'placeholder') return; if (new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(up)) citados.push(k); });
    return {base: base, lidos: lidos, citados: citados, explicitos: Object.keys(exp)};
  }
  function escala(o, k) { var r = {}; Object.keys(o).forEach(function (f) { var v = Math.max(LIM[f][0], Math.min(LIM[f][1], Math.round(o[f] * k * 100) / 100)); if (v) r[f] = v; }); return r; }
  function analiseLocal(texto, foco) {
    var L = lerLocal(texto), P = A.prem(), v = STORE.aprovadaVigente(C, foco);
    var a = escala(L.base, 1.8), b = escala(L.base, -0.6);
    var ra = C.choqueCarteira(v, a, P.sens).total, rb = C.choqueCarteira(v, b, P.sens).total;
    var est = ra <= rb ? a : b, ali = ra <= rb ? b : a;
    var reconheceu = Object.keys(L.base).length > 0;
    return {
      titulo: String(texto).split(/[.;\n]/)[0].trim().slice(0, 80) || 'Evento', local: true, confianca: 'baixa (leitura automática por palavras-chave)',
      resumo: reconheceu ? 'Leitura automática: ' + fimPonto(L.lidos.join('; ')) : 'Não reconheci no texto um fator de mercado. A leitura automática entende frases como “juros subiram 0,5 p.p.”, “Copom elevou a Selic para 14,25%”, “dólar subiu 3%”, “payroll forte”, “petróleo caiu 10%”. Reescreva assim ou ajuste os choques.',
      fato: {confirmado: ['Texto trazido pelo Research (não verificado pela ferramenta).'], interpretacao: L.lidos.map(function (x) { return 'Leitura por palavras-chave: ' + x + '.'; })},
      fatores: Object.keys(L.base).map(function (k) { return {k: k, porque: L.explicitos.indexOf(k) >= 0 ? 'citado no texto' : 'co-movimento assumido pela heurística (hipótese)'}; }),
      cenarios: [
        {nome: 'Base', probabilidade: 0.6, narrativa: 'A reação que o texto sugere.', choques: L.base, idio: {}},
        {nome: 'Estresse', probabilidade: 0.25, narrativa: 'A mesma reação 80% mais forte, ou a contrária, a que for pior para a carteira em foco.', choques: est, idio: {}},
        {nome: 'Alívio', probabilidade: 0.15, narrativa: 'O outro lado.', choques: ali, idio: {}}
      ],
      imediato: 'Choques instantâneos de preço calculados pelo motor.', longo_prazo: 'A leitura automática não avalia impacto econômico de longo prazo; use a análise com o Claude ou registre a sua.',
      atencao: L.citados.map(function (t) { return {ticker: t, sinal: 'atenção', motivo: 'Citado no fato.'}; })
    };
  }

  /* ---------- números do motor ---------- */
  function impactos(e1, foco) {
    var P = A.prem(), vp = C.validaProbs(e1.cenarios.map(function (c) { return {nome: c.nome, p: c.probabilidade, r: 0}; }));
    var cart = C.CARTS.map(function (m) {
      var v = STORE.aprovadaVigente(C, m.id);
      var rs = e1.cenarios.map(function (c) { return C.choqueCarteira(v, c.choques, P.sens, c.idio); });
      return {id: m.id, rot: m.rotulo, r: rs.map(function (x) { return x.total; }), status: rs[0].status, desc: rs[0].cobertura.descoberto, esperado: vp.ok ? e1.cenarios.reduce(function (acc, c, i) { return acc + c.probabilidade * rs[i].total; }, 0) : null};
    });
    var v = STORE.aprovadaVigente(C, foco), base = C.choqueCarteira(v, e1.cenarios[0].choques, P.sens, e1.cenarios[0].idio), est = C.choqueCarteira(v, (e1.cenarios[1] || e1.cenarios[0]).choques, P.sens, (e1.cenarios[1] || e1.cenarios[0]).idio);
    var sens = base.itens.map(function (x) { var y = est.itens.filter(function (z) { return z.t === x.t; })[0]; return {t: x.t, w: x.w, rb: x.r.total, cb: x.ctb, re: y ? y.r.total : null, ce: y ? y.ctb : null}; }).sort(function (a, b) { return Math.min(a.cb, a.ce || 0) - Math.min(b.cb, b.ce || 0); });
    return {probs: vp, cart: cart, foco: foco, focoBase: base, focoEst: est, sensiveis: sens};
  }
  function numerosTxt(m) {
    var I = m.imp, out = [];
    out.push('PROBABILIDADES: ' + (I.probs.ok ? 'válidas' : 'INVÁLIDAS (' + I.probs.motivo + ')'));
    I.cart.forEach(function (c) { out.push(c.rot + ' [' + c.status + (c.desc > 0.0005 ? ', ' + A.pct(c.desc, 0) + ' descoberto' : '') + ']: ' + m.e1.cenarios.map(function (s, i) { return s.nome + ' ' + A.spct(c.r[i], 2); }).join(', ') + (c.esperado != null ? ', esperado ' + A.spct(c.esperado, 2) : '')); });
    out.push('POSIÇÕES MAIS SENSÍVEIS EM ' + C.MAND[I.foco].rotulo + ' (peso; retorno base/estresse; contribuição base/estresse): ' + I.sensiveis.slice(0, 10).map(function (x) { return x.t + ' ' + A.pct(x.w, 1) + '; ' + A.spct(x.rb) + '/' + A.spct(x.re) + '; ' + A.pp(x.cb) + '/' + A.pp(x.ce); }).join(' | '));
    if (I.focoBase.descobertos.length) out.push('FORA DO CÁLCULO NA CARTEIRA EM FOCO: ' + I.focoBase.descobertos.map(function (x) { return x.t + ' ' + A.pct(x.w, 1) + ' (' + x.motivo + ')'; }).join('; '));
    return out.join('\n');
  }

  /* ---------- prompts ---------- */
  var REGRAS = 'Você trabalha na mesa de gestão de uma consultoria de investimentos brasileira. Escreva em português do Brasil, direto, sem emojis. Use só o fato trazido, os dados das carteiras-modelo e as sensibilidades abaixo. Não invente números de mercado, não cite projeções de bancos, corretoras ou casas de research (nunca XP). Separe o que é dado confirmado do que é interpretação. Pilar 5 (dividendos) é o core da renda variável Brasil; Pilar 6 é satélite. Não proponha misturas 50/50. Fundos “Franchini” são placeholders de teste e não são investimentos. Algumas carteiras-modelo têm pesos que não fecham em 100%: trate-as como inválidas, não as normalize. Seu texto é um parecer gerado por IA e não é decisão do Comitê.';
  var FATOR_TXT = 'Fatores do motor (choques instantâneos): selic, pre (curva prefixada/DI longo), real (juro real NTN-B), ust2, ust10, spread (crédito high yield e emergente) em pontos percentuais (+0.25 = +25 bps); usd (dólar contra o real), ibov, sp (S&P/desenvolvidos), em (emergentes), brent, btc em % (−5 = queda de 5%). Choques específicos de empresa em idio, em %, por ticker.';
  function resumoCarteiras() {
    var P = A.prem(), all = C.validateAll(A.ctx(), A.irmaos()), linhas = [];
    C.CARTS.forEach(function (m) { var v = STORE.aprovadaVigente(C, m.id), pp = C.pesosPorPilar(v.pos); linhas.push(m.rotulo + ' (' + m.id + ', ' + all[m.id].status + ', ativos somam ' + A.pct(all[m.id].total) + '): ' + Object.keys(pp).sort(function (a, b) { return +a.slice(1) - +b.slice(1); }).map(function (p) { return p + ' ' + nf0.format(pp[p] * 100) + '%'; }).join(', ')); });
    var at = [];
    Object.keys(C.ATV).forEach(function (t) {
      var a = C.ATV[t]; if (a.status === 'placeholder') return;
      var s = P.sens[t] || {m: 'nd'};
      var sx = s.m === 'rf' ? 'RF curva ' + s.f + ' duration ' + s.d + (s.s ? ' spread ' + s.s : '') : s.m === 'acao' ? 'β ' + s.beta + ', juros resid ' + s.j + '%/pp, dólar ' + s.u + ', Brent ' + s.b : s.m === 'fii' ? 'β ' + s.beta + ', duration real ' + s.d : s.m === 'rv' ? 'S&P ' + s.sp + ', EM ' + s.em + ', BTC ' + s.btc : 'sem sensibilidade cadastrada';
      at.push('- ' + t + ' · ' + a.nome + ' · ' + a.pilar + ' · ' + a.status + (a.rec ? ' · rec ' + a.rec : '') + (a.cotacao && a.teto ? ' · cotação ' + a.cotacao + ' / teto ' + a.teto + ' (04/11/2026)' : '') + (a.tese ? ' · tese: ' + a.tese : '') + ' · sensibilidade (' + (P.origem[t] === 'gestor' ? 'premissa do gestor' : 'hipótese') + '): ' + sx + (s.x ? ' (em dólar)' : ''));
    });
    var niv = Object.keys(P.niveis).map(function (k) { var n = P.niveis[k]; return n.n + ' ' + n.v + n.u + ' (' + n.fonte + ', ' + n.data + ')'; }).join('; ');
    return 'CARTEIRAS-MODELO APROVADAS (peso por pilar, status da validação):\n' + linhas.join('\n') + '\n\nATIVOS:\n' + at.join('\n') + '\n\nCENÁRIO DE REFERÊNCIA (observado): ' + niv + '.';
  }
  function historico(exc) { return STORE.list('reunioes').filter(function (m) { return m.id !== exc && m.e1; }).sort(function (a, b) { return a.criado < b.criado ? 1 : -1; }).slice(0, 5).map(function (m) { return '- ' + A.dataBR(m.criado) + ': ' + (m.e1.titulo || '') + ' — ' + (m.e1.resumo || ''); }).join('\n') || '(nenhuma)'; }
  function p1(m) {
    return REGRAS + '\n\n' + FATOR_TXT + '\n\n' + resumoCarteiras() + '\n\nEVENTOS RECENTES:\n' + historico(m.id) + '\n\nFATO TRAZIDO PELO RESEARCH (tipo: ' + m.tipo + (m.regioes.length ? '; regiões: ' + m.regioes.join(', ') : '') + (m.fonte ? '; fonte: ' + m.fonte : '; fonte não informada') + '):\n"""' + m.texto + '"""\n\n' +
      'Tarefa (papel: Research): 1) identifique o fato e a fonte; 2) separe dado confirmado de interpretação; 3) liste os fatores afetados e o canal; 4) diga qual era o cenário de referência; 5) proponha três hipóteses de revisão (Base, Estresse, Alívio) com probabilidades que somem exatamente 1 e o vetor de choques de cada uma; 6) diferencie reação imediata de mercado e impacto econômico de longo prazo (ex.: alta de juros derruba o preço do título hoje e melhora o retorno prospectivo); 7) marque até 10 ativos que merecem atenção ou se beneficiam.\n\n' +
      'Responda só com JSON:\n{"titulo":"até 80 caracteres","resumo":"uma frase","fonte":"fonte identificada ou \\"não informada\\"","fato":{"confirmado":["..."],"interpretacao":["..."]},"fatores":[{"k":"pre","porque":"..."}],"referencia":"cenário de referência antes do fato","cenarios":[{"nome":"Base","probabilidade":0.6,"narrativa":"...","choques":{"selic":0,"pre":0,"real":0,"ust2":0,"ust10":0,"spread":0,"usd":0,"ibov":0,"sp":0,"em":0,"brent":0,"btc":0},"idio":{}},{"nome":"Estresse","probabilidade":0.25,"narrativa":"...","choques":{},"idio":{}},{"nome":"Alívio","probabilidade":0.15,"narrativa":"...","choques":{},"idio":{}}],"imediato":"reação imediata de mercado","longo_prazo":"impacto econômico de longo prazo","atencao":[{"ticker":"VAMO3","sinal":"atenção|beneficia|neutro","motivo":"..."}],"confianca":"baixa|média|alta"}';
  }
  function p2(m) {
    return REGRAS + '\n\n' + resumoCarteiras() + '\n\nFATO:\n"""' + m.texto + '"""\n\nLEITURA DO RESEARCH:\n' + JSON.stringify(m.e1) + '\n\nNÚMEROS DO MOTOR DE CHOQUES DESTA PÁGINA (estimativas instantâneas em reais com as premissas vigentes; carteiras inválidas somam as posições como estão):\n' + numerosTxt(m) + '\n\nCARTEIRA EM FOCO: ' + C.MAND[m.cart].rotulo + '.\n\n' +
      'Tarefa: escreva o processo de decisão estruturado. research: o fato, a evidência e as premissas. risk_officer: questione riscos, concentrações, incertezas, liquidez, posições fora do cálculo e efeitos adversos. portfolio_manager: olhe a carteira consolidada, custo de oportunidade, alternativas e limites, e diga se age ou só monitora. consultoria: explique ao cliente em linguagem simples por que a diversificação segura. contraditorio: 3 a 6 falas curtas entre esses papéis com discordância real. proposta: se houver ação, diga ativo, carteira, peso de/para (em %) e de onde vem o dinheiro; se não houver, explique por quê. Inclua condições de revisão.\n\n' +
      'Responda só com JSON:\n{"research":"...","risk_officer":"...","portfolio_manager":"...","consultoria":"...","contraditorio":[{"quem":"Risk Officer","fala":"..."}],"proposta":{"tipo":"monitorar|ajustar|manter","acoes":[{"acao":"Aumentar|Reduzir|Manter|Monitorar|Substituir","ticker":"","carteira":"' + m.cart + '","de":null,"para":null,"financiamento":"","motivo":""}],"revisao":["condição que faria rever"]},"monitorar":["..."],"perguntas":[{"pergunta":"...","resposta":"..."}]}';
  }
  function normE1(o) {
    if (!o || typeof o !== 'object' || !Array.isArray(o.cenarios) || !o.cenarios.length) throw {code: 'invalid_json'};
    var cen = o.cenarios.slice(0, 3).map(function (s) {
      var ch = {}; C.FK.forEach(function (k) { var v = Number((s.choques || {})[k]); if (isFinite(v) && v) ch[k] = Math.max(LIM[k][0], Math.min(LIM[k][1], v)); });
      var id = {}; Object.keys(s.idio || {}).forEach(function (t) { var v = Number(s.idio[t]); if (C.ATV[t] && isFinite(v) && v) id[t] = Math.max(-90, Math.min(200, v)); });
      return {nome: String(s.nome || 'Cenário'), probabilidade: Number(s.probabilidade), narrativa: String(s.narrativa || ''), choques: ch, idio: id};
    });
    var arr = function (x) { return Array.isArray(x) ? x.map(String).slice(0, 10) : []; };
    return {titulo: String(o.titulo || 'Evento'), resumo: String(o.resumo || ''), fonte: String(o.fonte || ''), fato: {confirmado: arr((o.fato || {}).confirmado), interpretacao: arr((o.fato || {}).interpretacao)},
      fatores: (Array.isArray(o.fatores) ? o.fatores : []).filter(function (f) { return f && C.FK.indexOf(f.k) >= 0; }).map(function (f) { return {k: f.k, porque: String(f.porque || '')}; }),
      referencia: String(o.referencia || ''), cenarios: cen, imediato: String(o.imediato || ''), longo_prazo: String(o.longo_prazo || ''), confianca: String(o.confianca || ''),
      atencao: (Array.isArray(o.atencao) ? o.atencao : []).filter(function (a) { return a && C.ATV[String(a.ticker)]; }).slice(0, 12).map(function (a) { return {ticker: String(a.ticker), sinal: String(a.sinal || 'neutro'), motivo: String(a.motivo || '')}; })};
  }
  function normE2(o) {
    if (!o || typeof o !== 'object') throw {code: 'invalid_json'};
    var pr = o.proposta || {};
    return {research: String(o.research || ''), risk_officer: String(o.risk_officer || ''), portfolio_manager: String(o.portfolio_manager || ''), consultoria: String(o.consultoria || ''),
      contraditorio: (Array.isArray(o.contraditorio) ? o.contraditorio : []).slice(0, 10).map(function (f) { return {quem: String(f.quem || ''), fala: String(f.fala || '')}; }),
      proposta: {tipo: String(pr.tipo || 'monitorar'), acoes: (Array.isArray(pr.acoes) ? pr.acoes : []).slice(0, 8).map(function (a) { return {acao: String(a.acao || ''), ticker: String(a.ticker || ''), carteira: String(a.carteira || ''), de: a.de == null ? null : Number(a.de), para: a.para == null ? null : Number(a.para), financiamento: String(a.financiamento || ''), motivo: String(a.motivo || '')}; }), revisao: (Array.isArray(pr.revisao) ? pr.revisao : []).map(String).slice(0, 8)},
      monitorar: (Array.isArray(o.monitorar) ? o.monitorar : []).map(String).slice(0, 10), perguntas: (Array.isArray(o.perguntas) ? o.perguntas : []).slice(0, 8).map(function (q) { return {pergunta: String(q.pergunta || ''), resposta: String(q.resposta || '')}; })};
  }
  var CANAL = {
    selic: ['Selic mais alta aumenta o rendimento do pós-fixado (LFTB11) e encarece o crédito para empresas e famílias.', 'Selic mais baixa reduz o rendimento do pós-fixado e barateia o crédito.'],
    pre: ['A curva prefixada mais alta derruba na hora o preço dos prefixados (IRFM11, IDKA11, 5PRE11) e pesa nas empresas mais endividadas ou com valor concentrado no longo prazo.', 'A curva prefixada mais baixa valoriza os prefixados e alivia as empresas mais sensíveis a juros.'],
    real: ['Juro real mais alto derruba o preço dos títulos IPCA+ (B5P211, IMAB11, IB5M11) e dos FIIs de tijolo.', 'Juro real mais baixo valoriza os títulos IPCA+ e os FIIs de tijolo.'],
    usd: ['Dólar mais alto aumenta o valor em reais dos ativos no exterior e ajuda exportadoras como Petrobras, PRIO e Klabin.', 'Dólar mais baixo reduz o valor em reais dos ativos no exterior.'],
    ibov: ['A bolsa brasileira sobe junto; cada ação anda conforme o seu beta.', 'A bolsa brasileira cai junto; cada ação anda conforme o seu beta.'],
    ust2: ['Treasuries curtos mais altos reprecificam a renda fixa internacional curta.', 'Treasuries curtos mais baixos ajudam a renda fixa internacional curta.'],
    ust10: ['Treasury de 10 anos mais alto derruba a renda fixa internacional longa (DTLA, IUAA) e costuma pressionar bolsas.', 'Treasury de 10 anos mais baixo valoriza a renda fixa internacional longa.'],
    spread: ['Spread de crédito mais alto derruba high yield e dívida emergente (IHYA, SDHA, EMCA, JPEA).', 'Spread de crédito mais baixo valoriza high yield e dívida emergente.'],
    sp: ['Bolsas desenvolvidas em alta ajudam os ETFs internacionais de ações.', 'Bolsas desenvolvidas em queda puxam os ETFs internacionais de ações.'],
    em: ['Emergentes em alta ajudam EIMI, VFEA e a parte emergente do VWRA.', 'Emergentes em queda pesam em EIMI, VFEA e na parte emergente do VWRA.'],
    brent: ['Petróleo mais caro ajuda Petrobras e PRIO.', 'Petróleo mais barato pesa em Petrobras e PRIO.'],
    btc: ['Bitcoin em alta valoriza o IBIT.', 'Bitcoin em queda derruba o IBIT.']
  };
  var CHAVE_RISCO = {selic: /juro|selic|custo de capital|financiamento|alavanc|crédito/i, pre: /juro|custo de capital|financiamento|alavanc|desconto/i, real: /juro|infla|custo de capital|IPCA/i,
    usd: /dólar|câmbio|cambial/i, brent: /petróleo|brent|commodit/i, spread: /crédito|inadimpl|spread/i, em: /emergente|china|global/i, sp: /global|externo/i, ust10: /juro|global/i, ust2: /juro/i};
  // Debate gerado por regras a partir dos números do motor e do texto das teses (sem IA). As falas dizem que são automáticas.
  function debateLocal(m) {
    var I = m.imp, nomeC = C.MAND[m.cart].rotulo, f = I.cart.filter(function (c) { return c.id === m.cart; })[0];
    var base = m.e1.cenarios[0].choques, rb = f.r[0], re = f.r[1] != null ? f.r[1] : f.r[0];
    var sens = I.sensiveis, perd = sens.filter(function (x) { return Math.min(x.cb, x.ce || 0) < -1e-5; }).slice(0, 3), ganh = sens.slice().reverse().filter(function (x) { return x.cb > 1e-5; }).slice(0, 3);
    var desc = I.focoBase.descobertos, pDesc = C.sum(desc, function (x) { return x.w; });
    var fat = Object.keys(base).filter(function (k) { return base[k]; }).sort(function (a, b) { return Math.abs(I.focoBase.porFator[b] || 0) - Math.abs(I.focoBase.porFator[a] || 0); });
    var dom = fat[0];
    var canais = fat.map(function (k) { return CANAL[k] ? CANAL[k][base[k] > 0 ? 0 : 1] : null; }).filter(Boolean);
    // trecho da tese (texto exato do documento de 30/10) do ativo mais afetado, ligado ao fator dominante
    var citacoes = [];
    perd.forEach(function (x) {
      var tx = A.teseDe ? A.teseDe(x.t) : null; if (!tx || !tx.tese) return;
      var r = null;
      fat.some(function (k) { if (!CHAVE_RISCO[k]) return false; r = tx.tese.riscos.filter(function (q) { return CHAVE_RISCO[k].test(q.titulo + ' ' + q.texto); })[0] || null; return !!r; });
      if (r && citacoes.length < 2) citacoes.push({t: x.t, nome: tx.tese.nome, r: r, tese: tx.tese});
    });
    var perdTot = C.sum(perd, function (x) { return Math.min(0, x.ce != null ? x.ce : x.cb); }), estTot = I.focoEst.total;
    var conc = estTot < 0 && perdTot < 0 ? Math.min(1, perdTot / estTot) : null;
    // grupos de risco compartilhado mais atingidos no cenário base
    var grupos = (C.D.grupos || []).map(function (g) { var it = I.focoBase.itens.filter(function (x) { return g.tickers.indexOf(x.t) >= 0; }); return {g: g, ctb: C.sum(it, function (x) { return x.ctb; }), n: it.length}; }).filter(function (x) { return x.n > 0; }).sort(function (a, b) { return a.ctb - b.ctb; });
    var gPior = grupos[0] && grupos[0].ctb < 0 ? grupos[0] : null;
    var relevante = re < -0.02 || rb < -0.01;
    var acao = relevante ? 'avaliar no Laboratório uma proposta com menos exposição a ' + (gPior ? gPior.g.nome.toLowerCase() : 'o fator mais afetado') : 'manter as posições e monitorar';
    // horizonte da renda fixa quando o choque é de juros
    var rfH = [];
    if (base.pre || base.real || base.selic || base.ust10 || base.spread) {
      I.focoBase.itens.filter(function (x) { var q = A.prem().sens[x.t]; return q && q.m === 'rf' && x.r.local < -1e-5; }).slice(0, 3).forEach(function (x) { var o = C.horizonteRF(x.t, base, 1, A.prem().sens); if (o && o.recuperacaoAnos) rfH.push(x.t + ' recupera em cerca de ' + A.num(o.recuperacaoAnos, 1) + ' anos'); });
    }
    var pos = base.selic > 0 && I.focoBase.itens.some(function (x) { return x.t === 'LFTB11'; });
    var R = [];
    R.push(m.e1.resumo + ' Fonte: ' + (m.fonte || 'não informada') + '.');
    if (canais.length) R.push('Como isso chega na carteira: ' + canais.join(' '));
    var RO = 'No cenário base a ' + nomeC + ' anda ' + A.spct(rb, 2) + '; no estresse, ' + A.spct(re, 2) + '.';
    if (perd.length) RO += ' As posições que mais perdem: ' + perd.map(function (x) { return x.t + (x.ce != null && x.ce <= x.cb ? ' (' + A.pp(x.ce) + ' no estresse)' : ' (' + A.pp(x.cb) + ' no cenário base)'); }).join(', ') + (conc != null ? ', juntas ' + A.pct(conc, 0) + ' da perda do estresse.' : '.');
    if (gPior) RO += ' O grupo “' + gPior.g.nome + '” responde por ' + A.pp(gPior.ctb) + ' no cenário base.';
    if (pDesc > 0.0005) RO += ' Atenção: ' + A.pct(pDesc, 0) + ' da carteira ficou fora do cálculo (fundos de teste ou ativos sem sensibilidade), então o número real pode ser diferente.';
    if (f.status === 'invalida') RO += ' A aprovada desta carteira é inválida: os números somam as posições como estão.';
    citacoes.forEach(function (c) { RO += ' Na tese de ' + c.nome + ' (30/10), o risco “' + c.r.titulo + '”: ' + c.r.texto; });
    var PM = 'Regra automática: ' + (relevante ? 'a perda no estresse (' + A.spct(re, 2) + ') é relevante para a carteira. Sugestão: ' + acao + '.' : 'o efeito estimado é pequeno (' + A.spct(rb, 2) + ' no base, ' + A.spct(re, 2) + ' no estresse). Sugestão: ' + acao + '.');
    if (ganh.length) PM += ' O que compensa: ' + ganh.map(function (x) { return x.t + ' (' + A.pp(x.cb) + ')'; }).join(', ') + '.';
    if (pos) PM += ' Com a Selic mais alta, o pós-fixado passa a render mais desde já.';
    if (rfH.length) PM += ' Na renda fixa, a perda de preço é recuperada pelo carrego maior: ' + rfH.join('; ') + '.';
    PM += ' Nada muda na carteira sem decisão do Comitê.';
    var CO = 'Para o cliente: ' + (m.e1.titulo || 'o fato') + '. Na carteira ' + nomeC + ', a estimativa é de ' + A.spct(rb, 2) + ' no cenário mais provável' + (ganh.length ? '; ' + ganh.map(function (x) { return x.t; }).join(', ') + ' ajudam a compensar' : '') + (perd.length ? ', enquanto ' + perd.map(function (x) { return x.t; }).join(', ') + ' sentem mais' : '') + '. A carteira combina classes que reagem de forma diferente ao mesmo fato, e é isso que reduz a oscilação do conjunto.';
    var mon = fat.map(function (k) { return (C.FATORES.filter(function (x) { return x.k === k; })[0] || {}).n; }).filter(Boolean);
    citacoes.forEach(function (c) { (c.tese.indicadores || []).slice(0, 2).forEach(function (ind) { if (mon.indexOf(ind) < 0) mon.push(c.tese.ticker + ': ' + ind); }); });
    var rev = []; citacoes.slice(0, 1).forEach(function (c) { (c.tese.criterios || []).forEach(function (k) { rev.push(c.tese.ticker + ' (critério da tese): ' + k); }); });
    return {local: true, research: R.join(' '), risk_officer: RO, portfolio_manager: PM, consultoria: CO,
      contraditorio: [
        {quem: 'Risk Officer', fala: 'Se o estresse se confirmar, a ' + nomeC + ' vai a ' + A.spct(re, 2) + '.' + (perd[0] ? ' O primeiro ponto de atenção é ' + perd[0].t + '.' : '')},
        {quem: 'Portfolio Manager', fala: relevante ? 'Vale abrir uma proposta e testar o antes × depois antes de qualquer mudança.' : 'O efeito é pequeno para mexer agora; seguimos monitorando.'},
        {quem: 'Research', fala: 'O que mudaria a leitura: ' + (mon.slice(0, 3).join('; ') || 'novos dados do fato') + '.'}
      ],
      proposta: {tipo: relevante ? 'avaliar' : 'monitorar', acoes: [], revisao: rev}, monitorar: mon.slice(0, 8),
      perguntas: [
        {pergunta: 'Devo vender por causa disso?', resposta: 'A estimativa para a carteira é ' + A.spct(rb, 2) + ' no cenário base e ' + A.spct(re, 2) + ' no estresse. Mudanças na carteira-modelo passam pelo Comitê; a sugestão automática agora é ' + acao + '.'},
        ganh.length ? {pergunta: 'Tem alguma parte da carteira que ganha?', resposta: ganh.map(function (x) { return x.t + ' (' + A.pp(x.cb) + ')'; }).join(', ') + '.'} : null
      ].filter(Boolean)};
  }

  /* ---------- fluxo ---------- */
  var ERRS = {not_granted: 'A página precisa da sua permissão para usar o Claude. Libere no aviso e tente de novo.', sampling_disabled: 'O Claude não está disponível para esta conta aqui.', rate_limited: 'Muitas análises seguidas. Espere um pouco.', invalid_json: 'A resposta veio fora do formato. Tente de novo.', refused: 'O Claude não quis analisar este texto. Reescreva o fato.', prompt_too_large: 'Texto grande demais. Cole só o trecho principal.', upstream_error: 'A conexão com o Claude caiu. Tente de novo.'};
  var estado = {cur: null, busy: false, msg: '', ctl: null};
  var LINK_ONLINE = 'https://claude.ai/artifact/T7C17ui65qGyChogjHRL4w';
  async function salvar(m) { try { await STORE.put('reunioes', m.id, m); } catch (e) { A.toast(e.message || 'Não salvou.'); } }
  async function rodar(texto, fonte, tipo, regioes, cart) {
    estado.rascunho = null;
    var m = {id: STORE.newId('ev'), criado: STORE.now(), texto: texto, fonte: fonte, tipo: tipo, regioes: regioes, cart: cart, origem: STORE.sample ? 'ia' : 'local', avaliacao: {status: 'pendente'}, premissas: A.prem().salvo || 'padrão'};
    NIV = {}; var nv = A.prem().niveis; Object.keys(nv).forEach(function (k) { NIV[k] = nv[k]; });
    estado.busy = true; estado.msg = STORE.sample ? 'Research lendo o fato…' : ''; A.render();
    try {
      if (STORE.sample) {
        estado.ctl = new AbortController();
        m.e1 = normE1(await STORE.sample.json(p1(m), {modelTier: 'complex', signal: estado.ctl.signal, cache: false}));
        m.imp = impactos(m.e1, cart); estado.cur = m; estado.msg = 'Risk Officer, Portfolio Manager e Consultoria discutindo…'; await salvar(m); A.render();
        m.e2 = normE2(await STORE.sample.json(p2(m), {modelTier: 'complex', signal: estado.ctl.signal, cache: false}));
      } else {
        m.e1 = analiseLocal(texto, cart); m.imp = impactos(m.e1, cart); m.e2 = debateLocal(m);
      }
      estado.cur = m; await salvar(m); await STORE.audit('evento analisado', m.e1.titulo + ' (' + m.origem + ')', m.id);
      usarComoCenario(m);
    } catch (e) {
      if (e && (e.code === 'not_granted' || e.code === 'sampling_disabled') && !m.e1) {
        // sem permissão para o Claude: segue com a leitura automática, marcada como tal
        m.origem = 'local'; m.e1 = analiseLocal(texto, cart); m.imp = impactos(m.e1, cart); m.e2 = debateLocal(m);
        estado.cur = m; await salvar(m); usarComoCenario(m); estado.busy = false; estado.msg = ERRS[e.code] + ' Fiz a leitura automática no lugar.'; A.render(); return;
      }
      if (e && e.name === 'AbortError') estado.msg = 'Interrompido.'; else estado.msg = ERRS[e && e.code] || ('Falhou: ' + (e && e.message || e));
      if (m.e1) { estado.cur = m; await salvar(m); }
      estado.busy = false; A.render(); return;
    }
    estado.busy = false; estado.msg = ''; A.render();
  }
  // O cenário base do evento passa a ser o cenário ativo do painel (Risco e Cenários, antes × depois, comparação).
  function usarComoCenario(m) { if (!m || !m.e1 || !m.e1.cenarios || !m.e1.cenarios[0]) return; S.choques = Object.assign({}, m.e1.cenarios[0].choques); S.idio = Object.assign({}, m.e1.cenarios[0].idio || {}); S.cenEvento = m.e1.titulo; A.save(); }
  A.usarComoCenario = usarComoCenario;

  /* ---------- reunião automática do mercado (movimentos reais da sessão, vindos do Mercado ao vivo) ---------- */
  function escalaIdio(o, k) { var r = {}; Object.keys(o || {}).forEach(function (t) { var v = Math.max(-90, Math.min(200, Math.round(o[t] * k * 100) / 100)); if (v) r[t] = v; }); return r; }
  A.salaAuto = async function (o) {
    var cart = S.cart, P = A.prem(), base = {};
    Object.keys(o.choques || {}).forEach(function (k) { if (LIM[k]) base[k] = Math.max(LIM[k][0], Math.min(LIM[k][1], o.choques[k])); });
    if (!Object.keys(base).length && !Object.keys(o.idio || {}).length) return null;
    var v = STORE.aprovadaVigente(C, cart), a = escala(base, 1.8), b = escala(base, -0.6), ia = escalaIdio(o.idio, 1.8), ib = escalaIdio(o.idio, -0.6);
    var ra = C.choqueCarteira(v, a, P.sens, ia).total, rb = C.choqueCarteira(v, b, P.sens, ib).total;
    var est = ra <= rb ? [a, ia] : [b, ib], ali = ra <= rb ? [b, ib] : [a, ia];
    var id = 'auto-' + o.ses, old = STORE.get('reunioes', id);
    var un = function (k) { var f = C.FATORES.filter(function (x) { return x.k === k; })[0]; return f && f.u === 'pp' ? ' p.p.' : '%'; };
    var m = {id: id, criado: (old && old.criado) || STORE.now(), texto: o.texto, fonte: o.fonte, tipo: 'Mercado do dia (automático)', regioes: [], cart: cart, origem: 'auto', avaliacao: (old && old.avaliacao) || {status: 'pendente'}, premissas: P.salvo || 'padrão'};
    m.e1 = {titulo: o.titulo, local: true, confianca: 'dados reais da sessão; leitura por regras',
      resumo: 'Reunião montada sozinha pelo painel com os movimentos reais da sessão de ' + A.dataBR(o.ses) + '. O cenário base é o que o mercado já fez; o estresse testa o movimento continuar (ou virar contra a carteira) e o alívio, devolver parte.',
      fato: {confirmado: o.fatos || [], interpretacao: ['O efeito em cada carteira é do motor desta página com as premissas vigentes. Nos ativos com cotação do dia, a diferença entre o preço real e o motor entra como choque específico, para o cenário base reproduzir o dia.']},
      fatores: Object.keys(base).map(function (k) { return {k: k, porque: 'movimento real na sessão (' + (base[k] > 0 ? '+' : '−') + String(Math.abs(base[k])).replace('.', ',') + un(k) + ')'}; }),
      cenarios: [
        {nome: 'Realizado na sessão', probabilidade: 0.6, narrativa: 'Os movimentos de hoje, como aconteceram.', choques: base, idio: o.idio || {}},
        {nome: 'Estresse', probabilidade: 0.25, narrativa: 'O movimento continua (80% a mais) ou se inverte, o que for pior para a carteira em foco.', choques: est[0], idio: est[1]},
        {nome: 'Alívio', probabilidade: 0.15, narrativa: 'O outro lado.', choques: ali[0], idio: ali[1]}
      ],
      imediato: 'Variação de preço da sessão, com dados reais.', longo_prazo: 'A leitura automática não avalia efeito econômico de longo prazo. Para isso, leve a notícia à Sala com o Claude ou registre a sua leitura.',
      atencao: o.atencao || []};
    m.imp = impactos(m.e1, cart); m.e2 = debateLocal(m);
    await salvar(m);
    if (!old) await STORE.audit('reunião automática do mercado', o.titulo, id);
    if (o.aplicar) usarComoCenario(m);
    if (!estado.busy && (!estado.cur || String(estado.cur.id).indexOf('auto-') === 0)) estado.cur = m;
    return m;
  };
  // Usado por Notícias e impacto: leva o texto à Sala e já roda a análise (com o Claude no claude.ai; por regras fora dele)
  A.salaRodar = function (texto, fonte, tipo, cart) { estado.rascunho = {texto: texto, fonte: fonte, tipo: tipo}; A.go('sala', 'reuniao'); return rodar(texto, fonte, tipo, [], cart || S.cart); };
  A.salaAbrir = function (id) { var m = STORE.get('reunioes', id); if (m) estado.cur = m; A.go('sala', 'reuniao'); };
  async function rediscutir(m) {
    m.imp = impactos(m.e1, m.cart);
    if (STORE.sample) { estado.busy = true; estado.msg = 'Rediscutindo com os novos choques…'; A.render(); try { m.e2 = normE2(await STORE.sample.json(p2(m), {modelTier: 'complex', cache: false})); } catch (e) { estado.msg = ERRS[e && e.code] || 'Falhou.'; } estado.busy = false; }
    else m.e2 = debateLocal(m);
    m.editado = true; await salvar(m); usarComoCenario(m); estado.msg = ''; A.render();
  }

  /* ---------- tela ---------- */
  A.sala = function () {
    var wrap = h('div'), lista = STORE.list('reunioes').filter(function (m) { return m && m.e1; }).sort(function (a, b) { return a.criado < b.criado ? 1 : -1; });
    if (!estado.cur && lista.length) estado.cur = lista[0];
    if (estado.cur) { var fresh = STORE.get('reunioes', estado.cur.id); if (fresh && !estado.busy) estado.cur = fresh; }
    if (A.salaPrefill) { estado.rascunho = A.salaPrefill; A.salaPrefill = null; }
    var rz = estado.rascunho || {};
    var txt = h('textarea', {class: 'inp w', id: 'sala-texto', oninput: function () { estado.rascunho = Object.assign({}, estado.rascunho || {}, {texto: txt.value}); }, placeholder: 'Cole a notícia, o dado ou o resultado. Ex.: “Copom eleva a Selic para 14,25%…”, “Payroll de 320 mil, acima do esperado…”, “PRIO3 divulga produção 15% abaixo…”', style: 'min-height:110px'});
    var fonte = h('input', {class: 'inp w', placeholder: 'Fonte (ex.: comunicado do Copom, BLS, release da empresa)', value: rz.fonte || '', oninput: function () { estado.rascunho = Object.assign({}, estado.rascunho || {}, {fonte: fonte.value}); }});
    if (rz.texto) txt.value = rz.texto;
    var tipo = h('select', {class: 'inp'}, ['Copom', 'Payroll', 'IPCA', 'Curva de juros', 'Fiscal', 'Fed / Treasury', 'Resultado de empresa', 'Commodities', 'Outro'].map(function (t) { return h('option', {selected: rz.tipo === t || null}, t); }));
    var regs = ['Brasil', 'EUA', 'Mundo'].map(function (r) { return h('label', null, h('input', {type: 'checkbox', value: r}), ' ' + r); });
    var cart = h('select', {class: 'inp'}, C.CARTS.map(function (m) { return h('option', {value: m.id, selected: m.id === S.cart || null}, m.rotulo); }));
    var go = h('button', {class: 'btn pri', disabled: estado.busy || null, onclick: function () { var t = txt.value.trim(); if (t.length < 15) { A.toast('Escreva o fato com um pouco mais de detalhe.'); return; } rodar(t, fonte.value.trim(), tipo.value, regs.filter(function (l) { return l.firstChild.checked; }).map(function (l) { return l.firstChild.value; }), cart.value); }}, STORE.sample ? 'Levar à Sala' : 'Analisar no modo local');
    wrap.appendChild(A.sec('Novo evento', {mtd: 'sala', hint: STORE.sample ? 'A IA faz a leitura (Research) e o contraditório (Risk Officer, Portfolio Manager, Consultoria); os impactos são do motor desta página. Nada muda na carteira sem aprovação humana. A carteira efetiva importada não é enviada ao Claude.' : 'Fora do claude.ai (arquivo no computador ou site no GitHub): a análise é automática, por regras. A página lê o fato, monta os cenários, calcula o impacto em todas as carteiras, escreve Research, Risk Officer, Portfolio Manager e Consultoria com os números e com trechos das suas teses, e o cenário passa a valer no resto do painel. A leitura com o Claude, que entende qualquer texto, roda no link do claude.ai.'}, [
      txt, h('div', {class: 'form', style: 'margin-top:8px'}, h('label', {class: 'field'}, 'Fonte', fonte), h('label', {class: 'field'}, 'Tipo', tipo), h('label', {class: 'field'}, 'Carteira em foco', cart), h('div', {class: 'field'}, 'Regiões', h('div', {class: 'row'}, regs))),
      h('div', {class: 'row', style: 'margin-top:10px'}, go,
      !STORE.sample ? h('button', {class: 'btn', onclick: function () { var t = txt.value.trim(); var abrir = function () { window.open(LINK_ONLINE, '_blank', 'noopener'); }; if (t && navigator.clipboard) navigator.clipboard.writeText(t).then(function () { A.toast('Fato copiado: cole na Sala da versão online.'); abrir(); }, abrir); else abrir(); }}, 'Abrir a versão online (com o Claude)') : null, estado.busy && estado.ctl ? h('button', {class: 'btn', onclick: function () { estado.ctl.abort(); }}, 'Interromper') : null, estado.msg ? h('span', {class: estado.busy ? 'muted' : 'down', role: 'status'}, estado.msg) : null)
    ]));
    var g = h('div', {class: 'grid-lab'}), L = h('div'), R = h('div');
    g.append(L, R); wrap.appendChild(g);
    L.appendChild(estado.cur ? ata(estado.cur) : h('div', {class: 'empty'}, 'Nenhum evento analisado ainda.'));
    R.appendChild(A.sec('Eventos (' + lista.length + ')', {flush: true}, lista.length ? h('ul', {class: 'issues', style: 'padding:0 12px'}, lista.slice(0, 40).map(function (m) {
      var st = (m.avaliacao || {}).status || (m.e2 && m.e2.debate ? 'legado' : 'pendente');
      return h('li', {style: 'cursor:pointer;grid-template-columns:1fr', onclick: function () { estado.cur = m; A.render(); }}, h('div', null, h('b', {style: estado.cur && estado.cur.id === m.id ? 'color:var(--blue)' : ''}, m.e1.titulo), h('div', {class: 'muted', style: 'font-size:.82rem'}, A.dataBR(m.criado) + ' · ' + (m.origem === 'auto' ? 'automático · mercado' : m.origem === 'local' || m.e1.local ? 'modo local' : m.origem === 'exemplo' ? 'exemplo' : 'IA') + ' · ' + st)));
    })) : h('p', {class: 'empty'}, 'Sem eventos.')));
    return wrap;
  };

  function passo(n, titulo, corpo, ia) { return h('div', {class: 'passo'}, h('div', {class: 'n'}, String(n)), h('div', null, h('h4', null, titulo, ia ? ' ' : null, ia ? h('span', {class: 'badge-ia'}, ia) : null), corpo)); }
  function ata(m) {
    var e1 = m.e1, e2 = m.e2 || {}, legado = !!(e2 && e2.debate) || !m.imp;
    if (!m.imp) { try { m.imp = impactos(e1, m.cart || S.cart); m.cart = m.cart || S.cart; } catch (er) { return h('div', {class: 'alert bad'}, 'Não consegui recalcular este evento.'); } }
    var I = m.imp, ia = m.origem === 'local' || e1.local ? 'leitura automática' : 'parecer gerado por IA';
    var box = h('div', {class: 'sec'});
    var hd = h('header', null, h('h2', null, e1.titulo), h('span', {class: 'badge-ia'}, ia), A.chip('confiança ' + (e1.confianca || '—')), h('span', {class: 'right muted', style: 'font-size:.85rem'}, A.dataBR(m.criado)));
    box.appendChild(hd);
    var b = h('div', {class: 'body'}); box.appendChild(b);
    b.appendChild(h('p', {class: 'lead'}, e1.resumo));
    // 1 fato e fonte
    b.appendChild(passo(1, 'Fato e fonte', h('div', null, h('p', {style: 'white-space:pre-wrap;margin:0 0 6px'}, m.texto), h('div', {class: 'muted'}, 'Fonte: ' + (m.fonte || e1.fonte || 'não informada') + ' · tipo: ' + (m.tipo || '—') + (m.regioes && m.regioes.length ? ' · ' + m.regioes.join(', ') : '')))));
    // 2 confirmado × interpretação
    var fz = e1.fato || {confirmado: [], interpretacao: e1.leitura ? [e1.leitura] : []};
    b.appendChild(passo(2, 'Dado confirmado × interpretação', h('div', {class: 'grid2', style: 'gap:10px'}, h('div', null, h('b', null, 'Confirmado'), h('ul', null, (fz.confirmado.length ? fz.confirmado : ['—']).map(function (x) { return h('li', null, x); }))), h('div', null, h('b', null, 'Interpretação'), h('ul', null, (fz.interpretacao.length ? fz.interpretacao : ['—']).map(function (x) { return h('li', null, x); })))), ia));
    // 3 fatores
    b.appendChild(passo(3, 'Fatores afetados', (e1.fatores || []).length ? h('ul', null, e1.fatores.map(function (f) { var ff = C.FATORES.filter(function (x) { return x.k === f.k; })[0]; return h('li', null, h('b', null, ff ? ff.n : f.k), ': ' + f.porque); })) : h('p', {class: 'muted'}, 'Ver choques nos cenários.'), ia));
    // 4 referência
    var nv = A.prem().niveis;
    b.appendChild(passo(4, 'Cenário de referência anterior', h('div', null, e1.referencia ? h('p', null, e1.referencia) : null, h('p', {class: 'muted', style: 'font-size:.88rem'}, Object.keys(nv).map(function (k) { return nv[k].n + ' ' + String(nv[k].v).replace('.', ',') + (nv[k].u === '%' ? '%' : ' ' + nv[k].u) + ' (' + nv[k].data + ')'; }).join(' · ')))));
    // 5 hipóteses
    var probs = I.probs;
    b.appendChild(passo(5, 'Hipóteses de revisão', h('div', null, !probs.ok ? h('div', {class: 'alert bad'}, 'Probabilidades inválidas: ' + probs.motivo + '. O impacto esperado não é calculado.') : null,
      e1.cenarios.map(function (s, i) { return h('div', {style: 'padding:6px 0;border-bottom:1px dashed var(--line)'}, h('b', null, s.nome + ' · ' + A.pct(s.probabilidade, 0)), ' ', s.narrativa, h('div', {class: 'muted', style: 'font-size:.85rem'}, Object.keys(s.choques).map(function (k) { var f = C.FATORES.filter(function (x) { return x.k === k; })[0]; return f.n + ' ' + (f.u === 'pp' ? fpp(s.choques[k]) : fp(s.choques[k])); }).concat(Object.keys(s.idio || {}).map(function (t) { return t + ' ' + fp(s.idio[t]); })).join(' · ') || 'sem choques')); }),
      h('button', {class: 'btn sm', style: 'margin-top:6px', onclick: function () { editarChoques(m); }}, 'Ajustar choques e rediscutir'),
      e1.imediato || e1.longo_prazo ? h('div', {class: 'grid2', style: 'gap:10px;margin-top:8px'}, h('div', null, h('b', null, 'Reação imediata'), h('p', {style: 'margin:2px 0'}, e1.imediato || '—')), h('div', null, h('b', null, 'Longo prazo'), h('p', {style: 'margin:2px 0'}, e1.longo_prazo || '—'))) : null), ia));
    // 6 impactos
    var rows = I.cart.map(function (c) { return {label: c.rot + (c.status !== 'valida' ? ' · ' + (c.status === 'invalida' ? 'inválida' : 'parcial') : ''), v: c.r[0], tip: [c.rot].concat(e1.cenarios.map(function (s, i) { return s.nome + ' ' + A.spct(c.r[i], 2); })).concat([c.esperado != null ? 'Esperado ' + A.spct(c.esperado, 2) : '']), ghost: c.r[1]}; });
    b.appendChild(passo(6, 'Impactos estimados (motor desta página, cenário base; traço = estresse)', h('div', null, A.hbars(rows, {signed: true, fmt: function (x) { return A.spct(x, 2); }}), h('p', {class: 'hint'}, 'Choque instantâneo em reais com as premissas vigentes. Inválidas e parciais somam as posições como estão; placeholders e ativos sem sensibilidade ficam fora.'))));
    // 7 sensíveis
    b.appendChild(passo(7, 'Posições mais sensíveis · ' + C.MAND[m.cart].rotulo, h('div', null, A.table([{k: 't', t: 'Ativo', f: function (x) { return A.tk(x.t); }}, {k: 'w', t: 'Peso', r: 1, f: function (x) { return A.pct(x.w, 1); }}, {k: 'rb', t: 'Base', r: 1, f: function (x) { return A.spct(x.rb); }}, {k: 're', t: 'Estresse', r: 1, f: function (x) { return A.spct(x.re); }}, {k: 'cb', t: 'Contrib. base', r: 1, f: function (x) { return h('span', {class: A.cls(x.cb)}, A.pp(x.cb)); }}, {k: 'ce', t: 'Contrib. estresse', r: 1, f: function (x) { return h('span', {class: A.cls(x.ce)}, A.pp(x.ce)); }}], I.sensiveis.slice(0, 8).concat(I.sensiveis.length > 8 ? I.sensiveis.slice(-3) : []), {sort: 'cb', dir: 1}),
      (e1.atencao || []).length ? h('ul', null, e1.atencao.map(function (a) { return h('li', null, A.chip(a.sinal, a.sinal === 'beneficia' ? 'o-obs' : a.sinal === 'atenção' ? 'g-alta' : ''), ' ', A.tk(a.ticker), ' ' + a.motivo); })) : null)));
    // 8 papéis e contraditório
    if (legado && e2.debate) {
      b.appendChild(passo(8, 'Reunião (formato anterior)', h('div', null, e2.debate.map(function (f) { return h('div', {class: 'fala'}, h('b', null, f.quem), h('div', null, f.fala)); }), e2.decisao ? h('p', null, h('b', null, 'Síntese: '), e2.decisao.sintese) : null), ia));
    } else {
      var papeis = [['Research', e2.research], ['Risk Officer', e2.risk_officer], ['Portfolio Manager', e2.portfolio_manager], ['Consultoria', e2.consultoria]];
      b.appendChild(passo(8, 'Research · Risk Officer · Portfolio Manager · Consultoria', h('div', null, h('p', {class: 'hint'}, e2.local ? 'Falas geradas por regras a partir dos números do motor e do texto das teses de 30/10 (sem IA). Não são especialistas independentes.' : 'Papéis analíticos executados pela IA, não especialistas independentes.'), papeis.map(function (p) { return h('div', {class: 'fala'}, h('b', null, p[0]), h('div', null, p[1] || '—')); }), (e2.contraditorio || []).length ? A.more('Contraditório (' + e2.contraditorio.length + ' falas)', e2.contraditorio.map(function (f) { return h('div', {class: 'fala'}, h('b', null, f.quem), h('div', null, f.fala)); }), true) : null), ia));
    }
    // 9 proposta
    var pr = e2.proposta || (e2.decisao ? {tipo: 'legado', acoes: (e2.decisao.acoes || []).map(function (a) { return {acao: a.acao, ticker: a.alvo, motivo: a.motivo}; }), revisao: []} : {acoes: []});
    b.appendChild(passo(9, 'Proposta de ação ou monitoramento', h('div', null, h('p', null, h('b', null, 'Encaminhamento: '), pr.tipo || '—'),
      (pr.acoes || []).length ? h('ul', null, pr.acoes.map(function (a) { return h('li', null, h('b', null, a.acao + ' ' + (a.ticker || '')), a.carteira ? ' · ' + a.carteira : '', a.de != null || a.para != null ? ' · ' + (a.de != null ? a.de + '%' : '?') + ' → ' + (a.para != null ? a.para + '%' : '?') : '', a.financiamento ? ' · financiado por ' + a.financiamento : '', ' — ' + a.motivo); })) : null,
      (pr.revisao || []).length ? h('p', null, h('b', null, 'Condições de revisão: '), pr.revisao.join('; ')) : null,
      (e2.monitorar || []).length ? h('p', null, h('b', null, 'Monitorar: '), e2.monitorar.join('; ')) : null,
      (e2.perguntas || []).length ? A.more('Perguntas do cliente', e2.perguntas.map(function (q) { return h('div', {style: 'margin-bottom:8px'}, h('b', null, q.pergunta), h('div', null, q.resposta)); })) : null,
      h('div', {class: 'row'}, h('button', {class: 'btn', onclick: function () { criarProposta(m, pr); }}, 'Criar proposta a partir da sugestão'), m.proposta ? h('span', {class: 'muted'}, 'proposta criada') : null)), ia));
    // 10 registro
    var av = m.avaliacao || {status: 'pendente'};
    var resp = h('input', {class: 'inp', placeholder: 'Responsável', value: av.responsavel || ''}), nota = h('input', {class: 'inp', style: 'flex:1', placeholder: 'Nota da decisão (por que aprovou ou rejeitou o encaminhamento)', value: av.nota || ''});
    b.appendChild(passo(10, 'Registro da avaliação', h('div', null,
      h('p', null, 'Status: ', A.chip(av.status, av.status === 'aprovada' ? 'o-obs' : av.status === 'rejeitada' ? 'g-critica' : 'g-media'), av.responsavel ? ' · ' + av.responsavel + ' em ' + A.dataBR(av.data) : ''),
      h('p', {class: 'hint'}, 'Aprovar aqui registra o encaminhamento (ex.: monitorar). Mudança de peso só acontece aprovando uma proposta no Laboratório.'),
      h('div', {class: 'row'}, resp, nota, h('button', {class: 'btn pri', onclick: function () { registrar(m, 'aprovada', resp.value, nota.value); }}, 'Aprovar'), h('button', {class: 'btn danger', onclick: function () { registrar(m, 'rejeitada', resp.value, nota.value); }}, 'Rejeitar')))));
    // pergunte à mesa
    if (STORE.sample) b.appendChild(chat(m));
    b.appendChild(h('div', {class: 'row', style: 'margin-top:10px'}, h('button', {class: 'btn', onclick: function () { A.download('ata_' + m.id + '.txt', ataTexto(m)); }}, 'Exportar ata'), !STORE.sample ? h('button', {class: 'btn', onclick: function () { navigator.clipboard.writeText(p1(m)).then(function () { A.toast('Pedido copiado. Cole numa conversa com o Claude.'); }, function () { A.toast('Não consegui copiar.'); }); }}, 'Copiar pedido para o Claude') : null,
      h('button', {class: 'btn', onclick: function () { usarComoCenario(m); A.toast('Cenário do evento ativo no painel (Risco e Cenários, antes × depois).'); }}, 'Usar como cenário do painel'),
      h('button', {class: 'btn danger right', onclick: async function () { if (!confirm('Apagar este evento?')) return; await STORE.del('reunioes', m.id); estado.cur = null; A.render(); }}, 'Apagar')));
    return box;
  }
  function editarChoques(m) {
    var body = h('div'), ed = C.clone(m.e1.cenarios);
    ed.forEach(function (s, i) {
      body.appendChild(h('h3', null, s.nome));
      var pi = h('input', {class: 'inp n', type: 'number', step: '5', value: +(s.probabilidade * 100).toFixed(1), onchange: function () { s.probabilidade = Number(pi.value) / 100; }});
      body.appendChild(h('label', {class: 'field'}, 'Probabilidade (%)', pi));
      body.appendChild(h('div', {class: 'form'}, C.FATORES.map(function (f) { var e = h('input', {class: 'inp n', type: 'number', step: f.u === 'pp' ? '0.25' : '1', value: s.choques[f.k] || '', onchange: function () { var v = Number(e.value); if (isFinite(v) && v) s.choques[f.k] = v; else delete s.choques[f.k]; }}); return h('label', {class: 'field'}, f.n + (f.u === 'pp' ? ' (p.p.)' : ' (%)'), e); })));
    });
    body.appendChild(h('button', {class: 'btn pri', style: 'margin-top:12px', onclick: function () { m.e1.cenarios = ed; d.remove(); rediscutir(m); }}, 'Recalcular e rediscutir'));
    var d = A.drawer('Ajustar choques', body);
  }
  async function criarProposta(m, pr) {
    var cart = m.cart || S.cart, v = STORE.aprovadaVigente(C, cart), pos = C.clone(v.pos), notas = [];
    // Uma troca costuma vir em duas ações (reduz A, aumenta B financiado por A): a redução já está na ação que a usa como fonte.
    var fontes = (pr.acoes || []).map(function (a) { return a.financiamento; }).filter(function (t) { return C.ATV[t]; });
    var ordem = (pr.acoes || []).slice().sort(function (a, b) { return (C.ATV[b.financiamento] ? 1 : 0) - (C.ATV[a.financiamento] ? 1 : 0); });
    ordem.forEach(function (a) {
      if (!a.ticker || !C.ATV[a.ticker] || a.para == null || !isFinite(a.para)) return;
      if (fontes.indexOf(a.ticker) >= 0 && !C.ATV[a.financiamento]) {
        // a outra ação já tirou peso daqui; se a redução pedida for maior, o resto sai sem contrapartida (fica registrado)
        var atual = C.sum(pos.filter(function (x) { return x.t === a.ticker; }), function (x) { return x.w; });
        if (atual - a.para / 100 > 1e-9) { var rr = C.aplicarMovimento(pos, {t: a.ticker, para: a.para / 100, fonte: 'livre'}); if (rr.ok) { pos = rr.pos; notas.push(a.ticker + ' → ' + a.para + '% (parte sem contrapartida definida)'); } }
        else notas.push(a.ticker + ': redução coberta pela ação que usa o ativo como fonte');
        return;
      }
      var fonte = C.ATV[a.financiamento] ? a.financiamento : null;
      var r = C.aplicarMovimento(pos, {t: a.ticker, para: a.para / 100, fonte: fonte ? 'reduzir' : 'livre', de: fonte});
      if (r.ok) { pos = r.pos; notas.push(a.ticker + ' → ' + a.para + '%' + (fonte ? ' (de ' + fonte + ')' : ' (sem contrapartida definida)')); } else notas.push(a.ticker + ': ' + r.motivo);
    });
    S.cart = cart;
    var p = await STORE.salvarProposta({cart: cart, nome: 'Evento · ' + m.e1.titulo.slice(0, 50), pos: pos, origem: 'ia', status: 'rascunho', base: v.id, evento: m.id, nota: 'Criada a partir de um parecer gerado por IA. ' + (notas.length ? 'Movimentos aplicados: ' + notas.join('; ') + '.' : 'Nenhum movimento com peso numérico; ajuste manualmente.') + ' Só vale depois de aprovada por pessoas.'});
    m.proposta = p.id; await salvar(m);
    S.ver = 'prop:' + p.id; A.go('cons', 'editor');
  }
  async function registrar(m, status, resp, nota) {
    if (!resp.trim()) { A.toast('Informe o responsável.'); return; }
    m.avaliacao = {status: status, responsavel: resp.trim(), nota: nota, data: new Date().toISOString().slice(0, 10)};
    await salvar(m);
    await STORE.put('decisoes', STORE.newId('dec'), {tipo: 'evento macro', cart: m.cart, evento: m.id, status: status, criado: STORE.now(), data: m.avaliacao.data, responsavel: m.avaliacao.responsavel, titulo: m.e1.titulo, tese: m.e1.resumo, evidencia: m.texto.slice(0, 600), contra: (m.e2 && m.e2.risk_officer) || '', riscos: (m.e2 && m.e2.risk_officer) || '', revisao: ((m.e2 && m.e2.proposta && m.e2.proposta.revisao) || []).join('; '), impacto: m.imp.cart.filter(function (c) { return c.id === m.cart; }).map(function (c) { return 'base ' + A.spct(c.r[0], 2) + ', estresse ' + A.spct(c.r[1], 2); }).join(''), fatores: (m.e1.fatores || []).map(function (f) { return f.k; }), nota: nota, origem_ia: m.origem === 'ia'});
    await STORE.audit('avaliação de evento ' + status, m.e1.titulo + ' · ' + resp, m.id);
    A.toast('Registrado no diário de decisões.'); A.render();
  }
  function chat(m) {
    var log = h('div'), inp = h('input', {class: 'inp', style: 'flex:1', placeholder: 'Pergunte à mesa sobre este evento'});
    (m.chat || []).forEach(function (t) { log.appendChild(h('div', {class: 'fala'}, h('b', null, t.role === 'user' ? 'Você' : 'Mesa (IA)'), h('div', {style: 'white-space:pre-wrap'}, t.content))); });
    var btn = h('button', {class: 'btn', onclick: async function () {
      var q = inp.value.trim(); if (!q) return; inp.value = '';
      m.chat = (m.chat || []).concat([{role: 'user', content: q}]);
      var live = h('div', {style: 'white-space:pre-wrap'}, '…'); log.append(h('div', {class: 'fala'}, h('b', null, 'Você'), h('div', null, q)), h('div', {class: 'fala'}, h('b', null, 'Mesa (IA)'), live));
      var ctx = REGRAS + '\n\nEVENTO: ' + m.texto + '\n\nLEITURA: ' + JSON.stringify(m.e1) + '\n\nNÚMEROS:\n' + numerosTxt(m) + '\n\nResponda à pergunta do gestor em até 8 frases, citando os números do motor quando úteis.';
      var turns = [{role: 'user', content: ctx + '\n\nPERGUNTA: ' + m.chat[0].content}];
      for (var i = 1; i < m.chat.length; i++) turns.push({role: m.chat[i].role, content: m.chat[i].content});
      try { var r = await STORE.sample(turns, {modelTier: 'default', cache: false, onText: function (x) { live.textContent = x.text; }}); m.chat.push({role: 'assistant', content: r.text}); await salvar(m); }
      catch (e) { live.textContent = ERRS[e && e.code] || 'Falhou.'; m.chat.pop(); }
    }}, 'Perguntar');
    return h('div', {style: 'margin-top:12px'}, h('h3', null, 'Pergunte à mesa'), log, h('div', {class: 'row'}, inp, btn));
  }
  function ataTexto(m) {
    var e1 = m.e1, e2 = m.e2 || {}, out = [];
    out.push('EVENTO: ' + e1.titulo + ' (' + A.dataBR(m.criado) + ')', 'Origem: ' + (m.origem === 'ia' ? 'parecer gerado por IA' : 'leitura automática'), 'Fato: ' + m.texto, 'Fonte: ' + (m.fonte || 'não informada'), '');
    out.push('Cenários:'); e1.cenarios.forEach(function (s) { out.push('- ' + s.nome + ' (' + A.pct(s.probabilidade, 0) + '): ' + s.narrativa + ' | ' + JSON.stringify(s.choques)); });
    out.push('', 'Impactos (motor):', numerosTxt(m), '');
    ['research', 'risk_officer', 'portfolio_manager', 'consultoria'].forEach(function (k) { if (e2[k]) out.push(k + ': ' + e2[k]); });
    out.push('', 'Avaliação: ' + ((m.avaliacao || {}).status || 'pendente') + ((m.avaliacao || {}).responsavel ? ' por ' + m.avaliacao.responsavel : ''));
    return out.join('\n');
  }
  A.salaTestes = {lerLocal: lerLocal, analiseLocal: analiseLocal, impactos: impactos, normE1: normE1};
})(APP, CORE);
