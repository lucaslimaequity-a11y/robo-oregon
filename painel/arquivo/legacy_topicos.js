function semAc(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
const RX_UP = /\b(sob\w*|subi\w*|alta\w*|aument\w*|elev\w*|dispar\w*|aceler\w*|acima|surpreend\w*|hawk\w*|abre|abriu|abrem|abriram|pression\w*|salt\w*|estour\w*|avanc\w*|valoriz\w*|ganh\w*|estimul\w*|escal\w*)\b/g;
const RX_DN = /\b(cai|caiu|caem|cair\w*|caindo|queda\w*|recu\w*|reduz\w*|cort\w*|baix\w*|frac\w*|abaixo|desaceler\w*|dovish|fecha|fechou|fecham|fecharam|alivi\w*|despenc\w*|tomb\w*|desvaloriz\w*|perd\w*|esfri\w*|desab\w*)\b/g;
function dirNear(c, idx) {
  let best = 0, dist = Infinity;
  for (const m of c.matchAll(RX_UP)) { const d = Math.abs(m.index - idx); if (d < dist) { dist = d; best = 1; } }
  for (const m of c.matchAll(RX_DN)) { const d = Math.abs(m.index - idx); if (d < dist) { dist = d; best = -1; } }
  // sem verbo de direção: adjetivos (“payroll forte”, “dado fraco”) decidem; “forte” sozinho não vira alta quando há verbo de queda
  if (!best) { if (/\b(fort\w*|robust\w*|aquecid\w*)\b/.test(c)) best = 1; else if (/\b(frac\w*|fri\w*|desaquec\w*)\b/.test(c)) best = -1; }
  return best;
}
const numBR = (s) => Number(String(s).replace(',', '.'));
function ppIn(c) { let m = c.match(/(\d+(?:[.,]\d+)?)\s*(?:p\.?\s?p\b|pontos? percentua)/); if (m) return numBR(m[1]); m = c.match(/(\d+)\s*(?:bps|bp|pontos?[- ]base|pb)\b/); if (m) return numBR(m[1]) / 100; return null; }
function levelIn(c, lo, hi) { const re = /(?:\ba|\bpara|\bem|\bde|\bate)\s+(\d{1,2}(?:[.,]\d{1,2})?)\s*%/g; let m, v = null; while ((m = re.exec(c))) { const x = numBR(m[1]); if (x >= lo && x <= hi) v = x; } return v; }
function pctIn(c) { const m = c.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*%/); return m ? numBR(m[1]) : null; }
const scaleO = (o, k) => { const r = {}; for (const f in o) r[f] = o[f] * k; return r; };
const TOPICOS = [
  {rx: /\b(selic|copom)\b/, fx(c, d) {
    const lvl = levelIn(c, 2, 30);
    if (lvl != null) { const dl = lvl - NIV.selic.v; return {o: {selic: dl, pre: 0.7 * dl, real: 0.3 * dl, ibov: -4 * dl}, x: ['selic'], t: 'Selic a ' + nf2.format(lvl) + '% (' + fpp(dl) + ')'}; }
    if (/\b(mant\w*|pausa\w*|interromp\w*|estavel)\b/.test(c)) return {o: {pre: 0.25, real: 0.1, ibov: -1}, t: 'Selic parada: juro alto por mais tempo'};
    if (!d) return null;
    const pp = ppIn(c) || 0.5;
    return {o: {selic: d * pp, pre: 0.7 * d * pp, real: 0.3 * d * pp, ibov: -4 * d * pp}, x: ['selic'], t: 'Selic ' + (d > 0 ? 'subindo ' : 'caindo ') + fpp(d * pp)};
  }},
  {rx: /\b(fiscal|arcabouco|gastos? public\w*|divida publica|deficit|precatorios?|meta fiscal)\b/, fx(c) {
    const bom = /(melhor\w*|superavit|ajuste|corte de gastos|cumpr\w*|credib\w*)/.test(c);
    const k = bom ? -0.6 : 1;
    return {o: scaleO({pre: 0.75, real: 0.4, usd: 4, ibov: -5, selic: 0.25}, k), t: bom ? 'fiscal melhorando' : 'ruído fiscal'};
  }},
  {rx: /\b(ipca|inflacao)\b/, fx(c, d) {
    if (/(eua|americana|cpi|pce)/.test(c) || !d) return null;
    return {o: scaleO({pre: 0.3, real: 0.1, selic: 0.25, ibov: -1.5}, d), t: 'inflação no Brasil ' + (d > 0 ? 'acima do esperado' : 'abaixo do esperado')};
  }},
  {rx: /\b(dolar|cambio|ptax)\b|real se (des)?valoriz/, fx(c, d) {
    let dd = d;
    if (/real se desvaloriz/.test(c)) dd = 1; else if (/real se valoriz/.test(c)) dd = -1;
    const lv = c.match(/r\$\s*(\d+(?:[.,]\d{1,2})?)/);
    if (lv) { const pct = (numBR(lv[1]) / NIV.usd.v - 1) * 100; return {o: {usd: pct}, x: ['usd'], t: 'dólar a R$ ' + nf2.format(numBR(lv[1])) + ' (' + fp(pct) + ')'}; }
    if (!dd) return null;
    const pct = pctIn(c) || 4;
    return {o: {usd: dd * pct}, x: ['usd'], t: 'dólar ' + (dd > 0 ? 'subindo ' : 'caindo ') + fp(dd * pct)};
  }},
  {rx: /\b(ibovespa|ibov|bolsa|b3)\b/, fx(c, d) { if (/(americana|eua|wall street|nasdaq|s&p)/.test(c) || !d) return null; const p = pctIn(c) || 4; return {o: {ibov: d * p}, x: ['ibov'], t: 'Ibovespa ' + fp(d * p)}; }},
  {rx: /\b(curva de juros|curva|juros futuros|di futuro|taxas? de juros|prefixad\w*)\b/, fx(c, d) { if (/(americana|eua|treasur)/.test(c) || !d) return null; const pp = ppIn(c) || 0.5; return {o: {pre: d * pp, real: 0.5 * d * pp}, x: ['pre'], t: 'curva prefixada ' + fpp(d * pp)}; }},
  {rx: /\b(ntn-?b|tesouro ipca|juro real)\b/, fx(c, d) { const lvl = levelIn(c, 2, 15); let dl; if (lvl != null) dl = lvl - NIV.real.v; else { if (!d) return null; dl = d * (ppIn(c) || 0.3); } return {o: {real: dl}, x: ['real'], t: 'juro real ' + fpp(dl)}; }},
  {rx: /\b(payroll|emprego|vagas|desemprego|mercado de trabalho)\b/, fx(c, d) {
    let dd = d; if (/desemprego/.test(c) && !/payroll|vagas/.test(c)) dd = -d;
    if (!dd) return null;
    return {o: scaleO({ust2: 0.15, ust10: 0.12, usd: 1.5, sp: -2, em: -3, ibov: -1.5}, dd), t: 'emprego nos EUA ' + (dd > 0 ? 'forte' : 'fraco')};
  }},
  {rx: /\b(cpi|pce|inflacao (nos )?eua|inflacao americana)\b/, fx(c, d) { if (!d) return null; return {o: scaleO({ust2: 0.15, ust10: 0.12, usd: 1, sp: -2, em: -2, ibov: -1}, d), t: 'inflação nos EUA ' + (d > 0 ? 'acima' : 'abaixo')}; }},
  {rx: /\b(fed|fomc|powell|federal reserve)\b/, fx(c, d) {
    if (/\b(mant\w*|pausa\w*)\b/.test(c) && !d) return {o: {}, t: 'Fed parado'};
    if (!d) return null;
    const pp = ppIn(c) || 0.25;
    return {o: scaleO({ust2: 1, ust10: 0.6, usd: 6, sp: -10, em: -14, ibov: -8}, d * pp), x: ['ust2'], t: 'Fed ' + (d > 0 ? 'mais duro' : 'cortando juros') + ' (' + fpp(d * pp) + ')'};
  }},
  {rx: /\b(treasur\w*|t-?notes?|juros? (americanos|nos eua|dos eua)|yields?)\b/, fx(c, d) {
    const lvl = levelIn(c, 0.5, 10);
    let dl;
    if (lvl != null) dl = lvl - NIV.ust10.v; else { if (!d) return null; dl = d * (ppIn(c) || 0.2); }
    return {o: {ust10: dl, ust2: 0.6 * dl, sp: -6 * dl, em: -6 * dl, usd: 3 * dl, ibov: -4 * dl}, x: ['ust10'], t: 'Treasury de 10 anos ' + fpp(dl)};
  }},
  {rx: /\b(brent|petroleo|opep\+?|wti)\b/, fx(c, d) { if (!d) return null; const p = pctIn(c) || 10; return {o: {brent: d * p, ibov: 0.05 * d * p}, x: ['brent'], t: 'Brent ' + fp(d * p)}; }},
  {rx: /\b(china|chines\w*|pequim)\b/, fx(c, d) { if (!d) return null; return {o: scaleO({em: 3, brent: 4, ibov: 1.5}, d), t: 'China ' + (d > 0 ? 'mais forte' : 'mais fraca')}; }},
  {rx: /\b(recessao|crise|panico|colapso|quebra|default|calote)\b/, fx() { return {o: {sp: -8, em: -8, ibov: -8, spread: 1, ust10: -0.4, ust2: -0.5, brent: -15, usd: 5, btc: -20}, t: 'aversão a risco'}; }},
  {rx: /\b(spread|high yield|credito privado|inadimpl\w*)\b/, fx(c, d) { if (!d) return null; return {o: scaleO({spread: 0.5, ibov: -1}, d), t: 'crédito ' + (d > 0 ? 'mais caro' : 'mais barato')}; }},
  {rx: /\b(bitcoin|btc|cripto\w*)\b/, fx(c, d) { if (!d) return null; const p = pctIn(c) || 15; return {o: {btc: d * p}, x: ['btc'], t: 'bitcoin ' + fp(d * p)}; }},
  {rx: /(s&p|sp ?500|nasdaq|wall street|bolsas? americanas?|big techs?)/, fx(c, d) { if (!d) return null; const p = pctIn(c) || 4; return {o: {sp: d * p, em: 0.6 * d * p, ibov: 0.4 * d * p}, x: ['sp'], t: 'bolsa americana ' + fp(d * p)}; }},
];
const fimPonto = (s) => (/\.$/.test(s) ? s : s + '.');
