// Tests for quant.js — run from the scratchpad dir: node testes/quant.test.js
// No framework: prints PASS/FAIL per test and exits non-zero on any failure.
'use strict';
const Q = require(require('path').join(__dirname, '..', 'painel', 'src', 'quant.js'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS ' + name); passed++; }
  catch (e) { console.log('FAIL ' + name + ' -- ' + (e && e.message ? e.message : e)); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function close(got, want, tol, msg) {
  if (typeof got !== 'number' || !isFinite(got) || Math.abs(got - want) > tol) {
    throw new Error((msg ? msg + ': ' : '') + 'expected ' + want + ', got ' + got + ' (tol ' + tol + ')');
  }
}
// Seeded PRNG (mulberry32) so every run uses the same "random" data.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function addDays(iso, k) {
  return new Date(Date.parse(iso + 'T00:00:00Z') + k * 86400000).toISOString().slice(0, 10);
}
function randMat(rng, r, c) {
  const A = [];
  for (let i = 0; i < r; i++) { const row = []; for (let j = 0; j < c; j++) row.push(rng() - 0.5); A.push(row); }
  return A;
}
function AtA(A) {
  const c = A[0].length, S = [];
  for (let i = 0; i < c; i++) {
    S.push([]);
    for (let j = 0; j < c; j++) { let s = 0; for (let t = 0; t < A.length; t++) s += A[t][i] * A[t][j]; S[i].push(s); }
  }
  return S;
}
// Independent Cholesky: returns L or null if a pivot is not strictly positive.
function cholesky(S) {
  const n = S.length, L = S.map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = S[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) { if (!(s > 0)) return null; L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
    }
  }
  return L;
}
const sum = (x) => x.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------

test('01 riskContrib: sum(ctr) = sigma and sum(pct) = 1 (random 5x5 PSD)', () => {
  const rng = mulberry32(42);
  const S = AtA(randMat(rng, 5, 5));
  const w = [0.3, 0.25, -0.1, 0.35, 0.2];
  const rc = Q.riskContrib(w, S);
  close(sum(rc.ctr), rc.sigma, 1e-12, 'sum ctr');
  close(sum(rc.pct), 1, 1e-12, 'sum pct');
  close(rc.sigma, Math.sqrt(Q.dot(w, Q.matVec(S, w))), 1e-14, 'sigma');
});

test('02 riskContrib: mrc equals finite-difference dSigma/dw (h=1e-6)', () => {
  const rng = mulberry32(42);
  const S = AtA(randMat(rng, 5, 5));
  const w = [0.3, 0.25, -0.1, 0.35, 0.2], h = 1e-6;
  const rc = Q.riskContrib(w, S);
  for (let i = 0; i < 5; i++) {
    const up = w.slice(), dn = w.slice();
    up[i] += h; dn[i] -= h;
    const fd = (Q.portVol(up, S) - Q.portVol(dn, S)) / (2 * h);
    close(rc.mrc[i], fd, 1e-6, 'mrc[' + i + ']');
  }
});

test('03 toBRL: local -10% and fx +10% gives -1%; fxDecompose reconciles', () => {
  const r = Q.toBRL([-0.1, 0.05], [0.1, 0]);
  close(r[0], -0.01, 1e-12, 'brl');
  close(r[1], 0.05, 1e-15, 'no fx');
  assert(Q.toBRL([0.1], [0.1, 0.2]) === null, 'length mismatch must be null');
  const d = Q.fxDecompose(-0.1, 0.1);
  close(d.total, -0.01, 1e-12, 'total');
  close(d.cross, -0.01, 1e-15, 'cross');
  close(d.local + d.fx + d.cross, d.total, 1e-15, 'local+fx+cross');
});

test('04 cov/pearson: hand example and perfectly correlated series', () => {
  const S = Q.cov([[1, 2], [2, 4], [3, 6]]);
  close(S[0][0], 1, 1e-15); close(S[0][1], 2, 1e-15); close(S[1][0], 2, 1e-15); close(S[1][1], 4, 1e-15);
  const x = [0.01, -0.02, 0.03, 0.005, -0.01];
  close(Q.pearson(x, x.map((v) => 2 * v + 1)), 1, 1e-12, 'pearson +1');
  close(Q.pearson(x, x.map((v) => -3 * v)), -1, 1e-12, 'pearson -1');
  assert(Q.pearson([1, 2], [3, 4]) === null, 'n<3 null');
  assert(Q.pearson([1, 1, 1], [1, 2, 3]) === null, 'zero variance null');
  const C = Q.corrFromCov(S);
  close(C[0][1], 1, 1e-12, 'corrFromCov');
});

test('05 spearman with ties equals hand-computed value', () => {
  // x ranks [1, 2.5, 2.5, 4, 5], y ranks [1, 3, 2, 4, 5]; deviations from 3:
  // Sdxdy = 9.5, Sdx2 = 9.5, Sdy2 = 10  ->  rho = 9.5 / sqrt(95)
  const x = [1, 2, 2, 3, 4], y = [1, 3, 2, 4, 5];
  assert(JSON.stringify(Q.rank(x)) === JSON.stringify([1, 2.5, 2.5, 4, 5]), 'average ranks');
  close(Q.spearman(x, y), 9.5 / Math.sqrt(95), 1e-14, 'spearman');
  assert(Q.spearman([1, 2], [2, 1]) === null, 'n<3 null');
});

test('06 pairwiseCorr: N for staggered series, null below minObs', () => {
  const rng = mulberry32(7), base = '2026-01-01', A = [], B = [], C = [];
  for (let i = 0; i < 30; i++) A.push([addDays(base, i), rng() - 0.5]);
  for (let i = 10; i < 40; i++) B.push([addDays(base, i), rng() - 0.5]);
  for (let i = 30; i < 60; i++) C.push([addDays(base, i), rng() - 0.5]);
  const out = Q.pairwiseCorr({ A, B, C }, ['A', 'B', 'C'], { method: 'pearson', minObs: 20 });
  assert(JSON.stringify(out.N) === JSON.stringify([[30, 20, 0], [20, 30, 10], [0, 10, 30]]), 'N ' + JSON.stringify(out.N));
  const want = Q.pearson(A.slice(10, 30).map((p) => p[1]), B.slice(0, 20).map((p) => p[1]));
  close(out.C[0][1], want, 1e-15, 'C[A][B] on overlap');
  assert(out.C[1][0] === out.C[0][1], 'symmetric');
  assert(out.C[0][2] === null && out.C[1][2] === null, 'nulls below minObs');
  assert(out.C[0][0] === 1 && out.C[2][2] === 1, 'diagonal 1');
  const loose = Q.pairwiseCorr({ A, B, C }, ['A', 'B', 'C'], { method: 'spearman', minObs: 5 });
  assert(typeof loose.C[1][2] === 'number', 'number when overlap >= minObs');
  assert(loose.C[0][2] === null, 'no overlap stays null');
});

test('07 alignPrices: month-end resampling, listwise intersection, missing counts, unknown id', () => {
  const A = [];
  let v = 100;
  for (let d = '2026-01-02'; d <= '2026-03-31'; d = addDays(d, 1)) {
    const wd = new Date(d + 'T00:00:00Z').getUTCDay();
    if (wd !== 0 && wd !== 6) A.push([d, v++]);
  }
  const aMar31 = A.find((p) => p[0] === '2026-03-31')[1];
  const aFeb27 = A.find((p) => p[0] === '2026-02-27')[1];
  const messy = A.slice().reverse();
  messy.push(['2026-01-30', 999]);       // duplicate date: last occurrence wins
  messy.push(['2026-01-31', NaN]);       // non-finite: dropped (otherwise it would be January's last obs)
  const rs = Q.resample(messy, 'M');
  assert(JSON.stringify(rs) === JSON.stringify([['2026-01-30', 999], ['2026-02-27', aFeb27], ['2026-03-31', aMar31]]),
    'resample M ' + JSON.stringify(rs));
  const B = [['2026-01-15', 50], ['2026-01-29', 51], ['2026-03-10', 52], ['2026-03-27', 53]]; // no February
  const al = Q.alignPrices({ A: messy, B }, ['A', 'B'], { freq: 'M' });
  assert(al.ok === true, 'ok');
  assert(JSON.stringify(al.dates) === JSON.stringify(['2026-01-30', '2026-03-31']), 'dates ' + JSON.stringify(al.dates));
  assert(JSON.stringify(al.P) === JSON.stringify([[999, 51], [aMar31, 53]]), 'P ' + JSON.stringify(al.P));
  assert(al.missing.A === 1 && al.missing.B === 0, 'missing ' + JSON.stringify(al.missing));
  assert(al.freq === 'M' && al.ppy === 12, 'freq');
  const auto = Q.alignPrices({ A: messy, B }, ['A', 'B']);
  assert(auto.ok && auto.freq === 'M', 'auto freq = coarsest (M), got ' + auto.freq);
  const d1 = Q.alignPrices({ X: [['2026-01-05', 1], ['2026-01-06', 2], ['2026-01-07', 3]], Y: [['2026-01-05', 10], ['2026-01-07', 30]] },
    ['X', 'Y'], { freq: 'D' });
  assert(JSON.stringify(d1.dates) === JSON.stringify(['2026-01-05', '2026-01-07']), 'daily listwise');
  assert(JSON.stringify(d1.P) === JSON.stringify([[1, 10], [3, 30]]), 'daily P');
  assert(d1.missing.X === 1 && d1.missing.Y === 0, 'daily missing');
  const bad = Q.alignPrices({ A }, ['A', 'ZZZ'], {});
  assert(bad.ok === false && bad.reason === 'sem série: ZZZ', 'unknown id -> ' + JSON.stringify(bad));
});

test('08 varHist/esHist on -50..49 / 1000 (type-7 quantile)', () => {
  const r = [];
  for (let i = -50; i <= 49; i++) r.push(i / 1000);
  // p = 0.05, h = 99*0.05 = 4.95 -> x(4) + 0.95*(x(5) - x(4)) = -0.046 + 0.95*0.001 = -0.04505
  close(Q.quantile(r, 0.05), -0.04505, 1e-12, 'quantile');
  close(Q.varHist(r, 0.95), 0.04505, 1e-12, 'VaR');
  // tail = {-0.050, ..., -0.046}, mean -0.048
  close(Q.esHist(r, 0.95), 0.048, 1e-12, 'ES');
  assert(Q.esHist(r, 0.95) >= Q.varHist(r, 0.95), 'ES >= VaR');
  assert(Q.varHist(r.slice(0, 29), 0.95) === null && Q.esHist(r.slice(0, 29), 0.95) === null, 'null for n<30');
});

test('09 varNormal/esNormal closed form (mu=0, sigma=0.01, alpha=0.95)', () => {
  const n = 40, c = 0.01 * Math.sqrt((n - 1) / n), r = [];
  for (let i = 0; i < n; i++) r.push(i % 2 ? -c : c); // mean 0, sample std 0.01
  close(Q.mean(r), 0, 1e-17, 'mean');
  close(Q.std(r), 0.01, 1e-15, 'std');
  close(Q.varNormal(r, 0.95), 0.0164485, 1e-6, 'VaR');
  close(Q.esNormal(r, 0.95), 0.0206271, 1e-6, 'ES');
});

test('10 drawdown on [0.1, -0.5, 0.2]', () => {
  const d = Q.drawdown([0.1, -0.5, 0.2]);
  close(d.mdd, -0.5, 1e-12, 'mdd');
  close(d.current, -0.4, 1e-12, 'current');
  assert(d.peak === 0 && d.trough === 1, 'peak/trough indices');
  close(d.wealth[2], 0.66, 1e-12, 'wealth');
  const first = Q.drawdown([-0.1, 0.05]);
  close(first.mdd, -0.1, 1e-15, 'initial capital counts as peak');
  assert(first.peak === -1, 'peak -1 = initial capital');
});

test('11 normInv(0.975), round trip, normCdf vs Simpson integration', () => {
  close(Q.normInv(0.975), 1.959963985, 1e-8, 'normInv(0.975)');
  [1e-8, 0.001, 0.02, 0.3, 0.5, 0.8, 0.975, 0.999].forEach((p) => {
    close(Q.normCdf(Q.normInv(p)), p, 1e-13, 'round trip p=' + p);
  });
  [-1.3, 0.7, 2.2].forEach((z) => {
    const m = 4000, h = z / m;
    let s = Q.normPdf(0) + Q.normPdf(z);
    for (let i = 1; i < m; i++) s += (i % 2 ? 4 : 2) * Q.normPdf(i * h);
    close(Q.normCdf(z), 0.5 + s * h / 3, 1e-13, 'Simpson z=' + z);
  });
  assert(Q.normInv(0) === null && Q.normInv(1) === null, 'null outside (0,1)');
});

test('12 projBudgetBox: sum, bounds, KKT form, infeasible -> null', () => {
  const v = [0.5, 0.3, -0.2, 0.9, 0.1];
  const w = Q.projBudgetBox(v, 0, 0.4, 1);
  close(sum(w), 1, 1e-12, 'sum');
  w.forEach((x) => assert(x >= -1e-15 && x <= 0.4 + 1e-15, 'bounds ' + x));
  // projection has the form clip(v - lambda): recover lambda from a free coordinate and check all
  const iFree = w.findIndex((x) => x > 1e-9 && x < 0.4 - 1e-9);
  const lam = v[iFree] - w[iFree];
  v.forEach((x, i) => close(w[i], Math.min(0.4, Math.max(0, x - lam)), 1e-12, 'KKT ' + i));
  assert(Q.projBudgetBox(v, 0.3, 1, 1) === null, 'sum lb > total');
  assert(Q.projBudgetBox(v, 0, 0.1, 1) === null, 'sum ub < total');
});

test('13 optimize minvar 2-asset diag: (0.2, 0.8); with ub=[1,0.6]: (0.4, 0.6), upper active', () => {
  const S = [[0.04, 0], [0, 0.01]];
  const a = Q.optimize({ S, lb: 0, ub: 1, total: 1, objective: 'minvar' });
  assert(a.ok && a.converged, 'ok/converged');
  close(a.w[0], 0.2, 1e-6); close(a.w[1], 0.8, 1e-6);
  assert(a.active.upper.length === 0, 'no upper active');
  const b = Q.optimize({ S, lb: 0, ub: [1, 0.6], total: 1, objective: 'minvar' });
  assert(b.ok, 'ok');
  close(b.w[0], 0.4, 1e-6); close(b.w[1], 0.6, 1e-6);
  assert(b.active.upper.length === 1 && b.active.upper[0] === 1, 'upper active for asset index 1: ' + JSON.stringify(b.active));
});

test('14 optimize with group constraint (assets 0+1 <= 0.5) respected and reported', () => {
  // unconstrained min-var would put 8/9 in assets 0+1; KKT solution with the cap: (0.25, 0.25, 0.5)
  const S = [[0.01, 0, 0], [0, 0.01, 0], [0, 0, 0.04]];
  const o = Q.optimize({ S, lb: 0, ub: 1, total: 1, objective: 'minvar', groups: [{ idx: [0, 1], hi: 0.5, name: 'AB' }] });
  assert(o.ok, 'ok ' + o.reason);
  assert(o.w[0] + o.w[1] <= 0.5 + 1e-9, 'group respected');
  close(o.w[0], 0.25, 1e-6); close(o.w[1], 0.25, 1e-6); close(o.w[2], 0.5, 1e-6);
  assert(o.active.groups.some((g) => g.name === 'AB' && g.side === 'hi'), 'group active ' + JSON.stringify(o.active));
});

test('15 optimize meanvar: ok:false without mu; closed form with mu', () => {
  const S = [[0.04, 0], [0, 0.01]];
  const r = Q.optimize({ S, lb: 0, ub: 1, objective: 'meanvar' });
  assert(r.ok === false && r.reason === 'sem retornos esperados', JSON.stringify(r));
  // interior solution: w_i = (mu_i - l)/(gamma*S_ii), sum 1 -> l = 0.028, w = (0.45, 0.55)
  const m = Q.optimize({ S, mu: [0.10, 0.05], gamma: 4, lb: 0, ub: 1, objective: 'meanvar' });
  assert(m.ok, 'ok');
  close(m.w[0], 0.45, 1e-6); close(m.w[1], 0.55, 1e-6);
});

test('16 riskParity on diagonal S: w proportional to 1/sigma, equal contributions', () => {
  const S = [[0.04, 0, 0], [0, 0.09, 0], [0, 0, 0.01]];
  const rp = Q.riskParity(S);
  assert(rp.ok && rp.converged, 'ok/converged');
  const inv = [1 / 0.2, 1 / 0.3, 1 / 0.1], tot = sum(inv);
  rp.w.forEach((x, i) => close(x, inv[i] / tot, 1e-10, 'w' + i));
  const rc = Q.riskContrib(rp.w, S);
  rc.pct.forEach((x) => close(x, 1 / 3, 1e-8, 'pct'));
  // correlated case: contributions still equal
  const rng = mulberry32(3);
  const S2 = AtA(randMat(rng, 8, 4));
  const rp2 = Q.riskParity(S2);
  Q.riskContrib(rp2.w, S2).pct.forEach((x) => close(x, 0.25, 1e-8, 'pct correlated'));
});

test('17 ledoitWolf: shrinkage in [0,1], symmetric PD (Cholesky), matches sklearn-style formula', () => {
  const rng = mulberry32(11), n = 12, p = 10, R = [];
  for (let t = 0; t < n; t++) {
    const f = rng() - 0.5, row = [];
    for (let j = 0; j < p; j++) row.push(0.02 * (0.8 * f + (rng() - 0.5)));
    R.push(row);
  }
  const lw = Q.ledoitWolf(R);
  assert(lw.shrinkage >= 0 && lw.shrinkage <= 1, 'shrinkage range ' + lw.shrinkage);
  for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) assert(lw.cov[i][j] === lw.cov[j][i], 'symmetric');
  assert(cholesky(lw.cov) !== null, 'positive definite');
  // independent route: the algebraic shortcut used by scikit-learn's ledoit_wolf_shrinkage
  const m = []; for (let j = 0; j < p; j++) m.push(sum(R.map((r) => r[j])) / n);
  const X = R.map((r) => r.map((v, j) => v - m[j]));
  const tr = []; for (let j = 0; j < p; j++) tr.push(sum(X.map((x) => x[j] * x[j])) / n);
  const mu = sum(tr) / p;
  const beta_ = sum(X.map((x) => Math.pow(sum(x.map((v) => v * v)), 2)));
  let delta_ = 0;
  for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) delta_ += Math.pow(sum(X.map((x) => x[i] * x[j])), 2);
  delta_ /= n * n;
  let b = (beta_ / n - delta_) / (p * n);
  const d = (delta_ - 2 * mu * sum(tr) + p * mu * mu) / p;
  b = Math.min(b, d);
  close(lw.shrinkage, b / d, 1e-10, 'shrinkage vs shortcut');
  // trace is preserved by the shrinkage, so trace(LW) = trace of the (n-1) sample covariance
  const S = Q.cov(R);
  let t1 = 0, t2 = 0;
  for (let i = 0; i < p; i++) { t1 += lw.cov[i][i]; t2 += S[i][i]; }
  close(t1, t2, 1e-15, 'trace preserved (n-1 scale)');
});

test('18 ols: recovers y = 1 + 2x1 - 3x2; null when underdetermined; simple-regression SE', () => {
  const rng = mulberry32(5), X = [], y = [];
  for (let i = 0; i < 10; i++) { const x1 = rng(), x2 = rng(); X.push([x1, x2]); y.push(1 + 2 * x1 - 3 * x2); }
  const o = Q.ols(y, X, { intercept: true });
  close(o.coef[0], 1, 1e-9); close(o.coef[1], 2, 1e-9); close(o.coef[2], -3, 1e-9);
  close(o.r2, 1, 1e-12, 'r2');
  assert(o.n === 10 && o.k === 2, 'n/k');
  assert(Q.ols(y.slice(0, 3), X.slice(0, 3)) === null, 'n <= k+1 -> null');
  assert(Q.ols([1, 2, 3, 4, 5], [[1, 2], [2, 4], [3, 6], [4, 8], [5, 10]]) === null, 'collinear -> null');
  // simple regression closed form: b = Sxy/Sxx, se(b) = sqrt(s2/Sxx), s2 = SSR/(n-2)
  const xs = [1, 2, 3, 4, 5], ys = [2.1, 3.9, 6.2, 7.8, 10.1];
  const mx = 3, my = sum(ys) / 5;
  const Sxx = sum(xs.map((x) => (x - mx) * (x - mx)));
  const bb = sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) / Sxx, aa = my - bb * mx;
  const ssr = sum(xs.map((x, i) => Math.pow(ys[i] - aa - bb * x, 2)));
  const s = Q.ols(ys, xs);
  close(s.coef[1], bb, 1e-12, 'slope');
  close(s.se[1], Math.sqrt(ssr / 3 / Sxx), 1e-12, 'se slope');
  close(s.t[1], bb / Math.sqrt(ssr / 3 / Sxx), 1e-9, 't slope');
});

test('19 twr with flows, irr, mwr without intermediate flows', () => {
  // r1 = (120 - 10)/100 - 1 = 0.10; r2 = 150/120 - 1 = 0.25; total = 1.1*1.25 - 1 = 0.375
  const t = Q.twr([100, 120, 150], [0, 10, 0]);
  close(t.periods[0], 0.10, 1e-15); close(t.periods[1], 0.25, 1e-15); close(t.total, 0.375, 1e-15);
  close(Q.irr([{ t: 0, cf: -100 }, { t: 1, cf: 110 }]), 0.10, 1e-10, 'irr');
  assert(Q.irr([{ t: 0, cf: 100 }, { t: 1, cf: 110 }]) === null, 'no sign change -> null');
  // 2024 is a leap year: 366 days -> t = 366/365.25
  close(Q.mwr(['2024-01-01', '2025-01-01'], [100, 110]), Math.pow(1.1, 365.25 / 366) - 1, 1e-10, 'mwr');
  // with a contribution, the result must zero the NPV of the implied cash flows
  const r = Q.mwr(['2025-01-01', '2025-07-01', '2026-01-01'], [100, 160, 170], [0, 50, 0]);
  const npv = -100 - 50 * Math.pow(1 + r, -181 / 365.25) + 170 * Math.pow(1 + r, -365 / 365.25);
  close(npv, 0, 1e-8, 'mwr npv');
});

test('20 brinson: residual ~0, active = Rp - Rb; ok:false when weighted group lacks return', () => {
  const inp = {
    wp: { A: 0.5, B: 0.3, C: 0.2 }, wb: { A: 0.4, B: 0.4, C: 0.2 },
    rp: { A: 0.05, B: 0.02, C: -0.01 }, rb: { A: 0.04, B: 0.03, C: 0.00 }
  };
  const b = Q.brinson(inp);
  assert(b.ok, 'ok');
  close(b.Rp, 0.029, 1e-15); close(b.Rb, 0.028, 1e-15);
  close(b.totals.active, b.Rp - b.Rb, 1e-15, 'active');
  close(b.residual, 0, 1e-15, 'residual');
  close(b.alloc.A, 0.1 * (0.04 - 0.028), 1e-15, 'alloc A');
  close(b.select.B, 0.4 * (0.02 - 0.03), 1e-15, 'select B');
  close(b.inter.A, 0.1 * (0.05 - 0.04), 1e-15, 'inter A');
  const bad = Q.brinson({ wp: { A: 0.9, D: 0.1 }, wb: { A: 1 }, rp: { A: 0.01 }, rb: { A: 0.01, D: 0.02 } });
  assert(bad.ok === false && /D/.test(bad.reason), JSON.stringify(bad));
});

test('21 contrib: a 3% position that falls 40% contributes -1.2 p.p.', () => {
  const c = Q.contrib([0.03, 0.97], [-0.4, 0]);
  close(c.items[0], -0.012, 1e-15); close(c.total, -0.012, 1e-15);
  const o = Q.contrib({ X: 0.03 }, { X: -0.4 });
  close(o.items.X, -0.012, 1e-15);
});

test('22 conditionalShock: Sf=[[1,.5],[.5,1]], f0=2 -> f1=1', () => {
  const f = Q.conditionalShock([[1, 0.5], [0.5, 1]], [0], [2]);
  close(f[0], 2, 0); close(f[1], 1, 1e-15);
  assert(Q.conditionalShock([[1, 1], [1, 1]], [0, 1], [1, 1]) === null, 'singular -> null');
});

test('23 cumReturn: ok:false when series starts after window start + 7 days; ok otherwise', () => {
  const pts = [['2026-01-12', 100], ['2026-02-02', 105], ['2026-03-02', 110]];
  const bad = Q.cumReturn(pts, '2026-01-01', '2026-03-02');
  assert(bad.ok === false, JSON.stringify(bad));
  const good = Q.cumReturn(pts, '2026-01-06', '2026-03-05');
  assert(good.ok && good.d0 === '2026-01-12' && good.d1 === '2026-03-02', JSON.stringify(good));
  close(good.r, 0.1, 1e-15);
  assert(Q.cumReturn(pts, '2026-01-12', '2026-03-31').ok === false, 'ends > 7 days before end');
});

test('24 inferFreq and ISO-week resampling across a year boundary', () => {
  assert(Q.inferFreq(['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08']).freq === 'D', 'D');
  assert(Q.inferFreq(['2026-01-02', '2026-01-09', '2026-01-16']).ppy === 52, 'W');
  assert(Q.inferFreq(['2026-01-30', '2026-02-27', '2026-03-31']).freq === 'M', 'M');
  // 2025-12-29 (Mon) and 2026-01-02 (Fri) are both ISO week 1 of 2026; 2025-12-26 is week 52 of 2025
  const w = Q.resample([['2026-01-02', 3], ['2025-12-26', 1], ['2025-12-29', 2]], 'W');
  assert(JSON.stringify(w) === JSON.stringify([['2025-12-26', 1], ['2026-01-02', 3]]), JSON.stringify(w));
});

test('25 misc: hhi/effN, sortino downside over all obs, rolling, beta, divRatio', () => {
  close(Q.hhi([0.2, 0.2]), 0.5, 1e-15, 'hhi renormalised'); close(Q.effN([1, 1, 1, 1]), 4, 1e-12);
  const r = [0.02, -0.01, 0.03, -0.02];
  // DD = sqrt((0.01^2 + 0.02^2)/4), mean 0.005
  close(Q.sortino(r, 0, 12), 0.005 * 12 / (Math.sqrt(0.0005 / 4) * Math.sqrt(12)), 1e-12, 'sortino');
  const ro = Q.rolling([1, 2, 3, 4], 3, Q.mean);
  assert(ro[0] === null && ro[1] === null && ro[2] === 2 && ro[3] === 3, JSON.stringify(ro));
  close(Q.beta([0.02, 0.04, -0.02, 0.01], [0.01, 0.02, -0.01, 0.005]), 2, 1e-12, 'beta');
  close(Q.divRatio([0.5, 0.5], [[0.04, 0], [0, 0.04]]), Math.sqrt(2), 1e-12, 'divRatio');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
