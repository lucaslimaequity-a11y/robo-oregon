/*
 * quant.js — portfolio analytics for the portfolio-management page. No dependencies, no network, ES2019.
 *
 * Conventions (the methodology comments above each function are the audit trail):
 *  - Returns are decimals (0.01 = 1%). Dates are ISO strings 'YYYY-MM-DD'. Matrices are arrays of rows.
 *  - Nothing is imputed. Numeric inputs containing null/NaN/±Infinity make a function return null.
 *    Only the dated-series helpers (resample, alignPrices, cumReturn, pairwiseCorr) drop bad points, and they say so.
 *  - Functions that can fail for a reason the user should see return {ok:false, reason:'...'} (reasons in Portuguese).
 */
var Q = (function () {
  'use strict';

  var PPY = { D: 252, W: 52, M: 12 };
  var FREQ_RANK = { D: 0, W: 1, M: 2 };

  // ======================================================================
  // Internal helpers
  // ======================================================================

  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  function isNumArray(x) {
    if (!Array.isArray(x)) return false;
    for (var i = 0; i < x.length; i++) if (!isNum(x[i])) return false;
    return true;
  }

  // Non-empty rectangular matrix with finite entries.
  function isNumMatrix(A) {
    if (!Array.isArray(A) || A.length === 0 || !Array.isArray(A[0]) || A[0].length === 0) return false;
    var c = A[0].length;
    for (var i = 0; i < A.length; i++) {
      if (!Array.isArray(A[i]) || A[i].length !== c || !isNumArray(A[i])) return false;
    }
    return true;
  }

  function isSquare(S) { return isNumMatrix(S) && S.length === S[0].length; }

  function zeros(n) { var a = new Array(n); for (var i = 0; i < n; i++) a[i] = 0; return a; }

  function zeroMat(r, c) { var A = new Array(r); for (var i = 0; i < r; i++) A[i] = zeros(c); return A; }

  function sumArr(x) { var s = 0; for (var i = 0; i < x.length; i++) s += x[i]; return s; }

  function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }

  function isConstant(x) {
    for (var i = 1; i < x.length; i++) if (x[i] !== x[0]) return false;
    return true;
  }

  function maxAbsDiff(a, b) {
    var m = 0;
    for (var i = 0; i < a.length; i++) { var d = Math.abs(a[i] - b[i]); if (d > m) m = d; }
    return m;
  }

  function quadForm(w, S) {
    var q = 0;
    for (var i = 0; i < w.length; i++) {
      var s = 0;
      for (var j = 0; j < w.length; j++) s += S[i][j] * w[j];
      q += w[i] * s;
    }
    return q;
  }

  function sameLengthNum(x, y) {
    return isNumArray(x) && isNumArray(y) && x.length === y.length;
  }

  // Scalar or array bound → array of length n (dflt when undefined/null). null if malformed.
  function boundArray(b, n, dflt) {
    if (b === undefined || b === null) b = dflt;
    var a = [], i;
    if (typeof b === 'number') {
      if (isNaN(b)) return null;
      for (i = 0; i < n; i++) a.push(b);
      return a;
    }
    if (!Array.isArray(b) || b.length !== n) return null;
    for (i = 0; i < n; i++) {
      if (typeof b[i] !== 'number' || isNaN(b[i])) return null;
      a.push(b[i]);
    }
    return a;
  }

  // ISO date → integer day number since 1970-01-01 (UTC). null if not a real calendar date.
  function dayNum(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
    var t = Date.UTC(y, m - 1, d);
    var back = new Date(t);
    if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
    return Math.round(t / 86400000);
  }

  // Period key used by resampling/alignment: the date itself (D), the Thursday of its ISO week (W), or 'YYYY-MM' (M).
  function periodKey(date, freq) {
    if (freq === 'M') return date.slice(0, 7);
    if (freq === 'W') {
      var dn = dayNum(date);
      var wd = ((dn + 3) % 7 + 7) % 7; // Monday = 0 (1970-01-01 was a Thursday)
      return 'W' + (dn - wd + 3);      // Thursday of the ISO week identifies the week (and its ISO year)
    }
    return date;
  }

  // Keeps [date, value] pairs with a valid ISO date and a finite value; then, among repeated dates,
  // the LAST occurrence in input order wins; output sorted by date.
  function cleanPoints(points) {
    if (!Array.isArray(points)) return [];
    var map = new Map();
    for (var i = 0; i < points.length; i++) {
      var pt = points[i];
      if (!Array.isArray(pt) || pt.length < 2) continue;
      if (dayNum(pt[0]) === null || !isNum(pt[1])) continue;
      map.set(pt[0], pt[1]);
    }
    return Array.from(map.keys()).sort().map(function (d) { return [d, map.get(d)]; });
  }

  // Gaussian elimination with partial pivoting on [A | B]; A n×n, B n×m. null if a pivot is ≤ 1e-12·max|A_ij|.
  function gaussSolve(A, B) {
    var n = A.length, m = B[0].length, i, j, k, scale = 0;
    var M = new Array(n);
    for (i = 0; i < n; i++) {
      M[i] = A[i].concat(B[i]);
      for (j = 0; j < n; j++) scale = Math.max(scale, Math.abs(A[i][j]));
    }
    if (!(scale > 0)) return null;
    var tol = scale * 1e-12;
    for (var c = 0; c < n; c++) {
      var piv = c, best = Math.abs(M[c][c]);
      for (var r = c + 1; r < n; r++) {
        if (Math.abs(M[r][c]) > best) { best = Math.abs(M[r][c]); piv = r; }
      }
      if (best <= tol) return null;
      if (piv !== c) { var tmp = M[c]; M[c] = M[piv]; M[piv] = tmp; }
      for (r = c + 1; r < n; r++) {
        var f = M[r][c] / M[c][c];
        if (f !== 0) for (k = c; k < n + m; k++) M[r][k] -= f * M[c][k];
      }
    }
    var X = zeroMat(n, m);
    for (var col = 0; col < m; col++) {
      for (i = n - 1; i >= 0; i--) {
        var s = M[i][n + col];
        for (k = i + 1; k < n; k++) s -= M[i][k] * X[k][col];
        X[i][col] = s / M[i][i];
      }
    }
    return X;
  }

  function invert(A) {
    var n = A.length, I = zeroMat(n, n);
    for (var i = 0; i < n; i++) I[i][i] = 1;
    return gaussSolve(A, I);
  }

  // Largest eigenvalue of a symmetric PSD matrix: power iteration with Rayleigh quotient, deterministic start vector.
  function powerIterMax(S) {
    var p = S.length, v = [], i, nv = 0;
    for (i = 0; i < p; i++) { v.push(1 + i / p); nv += v[i] * v[i]; }
    nv = Math.sqrt(nv);
    for (i = 0; i < p; i++) v[i] /= nv;
    var lam = 0;
    for (var k = 0; k < 2000; k++) {
      var y = matVec(S, v);
      var ny = Math.sqrt(dot(y, y));
      if (ny === 0) return 0;
      var lamNew = dot(v, y);
      for (i = 0; i < p; i++) v[i] = y[i] / ny;
      if (k > 0 && Math.abs(lamNew - lam) <= 1e-14 * Math.abs(lamNew)) { lam = lamNew; break; }
      lam = lamNew;
    }
    return lam;
  }

  // ======================================================================
  // Statistics
  // ======================================================================

  // mean(x) = Σx_i / n (computed as x_0 + Σ(x_i − x_0)/n, exact for constant series). null if empty.
  function mean(x) {
    if (!isNumArray(x) || x.length === 0) return null;
    var x0 = x[0], s = 0;
    for (var i = 0; i < x.length; i++) s += x[i] - x0;
    return x0 + s / x.length;
  }

  // variance(x) = Σ(x_i − x̄)² / (n − 1)  (sample variance). null if n < 2.
  function variance(x) {
    if (!isNumArray(x) || x.length < 2) return null;
    if (isConstant(x)) return 0;
    var m = mean(x), s = 0;
    for (var i = 0; i < x.length; i++) { var d = x[i] - m; s += d * d; }
    return s / (x.length - 1);
  }

  // std(x) = sqrt(sample variance), n − 1 convention. null if n < 2.
  function std(x) {
    var v = variance(x);
    return v === null ? null : Math.sqrt(v);
  }

  // cov(R): S_ij = Σ_t (R_ti − m_i)(R_tj − m_j) / (n − 1); R rows = periods, cols = assets. null if n < 2.
  function cov(R) {
    if (!isNumMatrix(R) || R.length < 2) return null;
    var n = R.length, p = R[0].length, i, j, t;
    var m = [];
    for (j = 0; j < p; j++) {
      var col = [];
      for (t = 0; t < n; t++) col.push(R[t][j]);
      m.push(mean(col));
    }
    var S = zeroMat(p, p);
    for (t = 0; t < n; t++) {
      for (i = 0; i < p; i++) {
        var di = R[t][i] - m[i];
        if (di === 0) continue;
        for (j = i; j < p; j++) S[i][j] += di * (R[t][j] - m[j]);
      }
    }
    for (i = 0; i < p; i++) {
      for (j = i; j < p; j++) { S[i][j] /= (n - 1); S[j][i] = S[i][j]; }
    }
    return S;
  }

  // C_ij = S_ij / sqrt(S_ii·S_jj), clamped to [−1, 1]; diagonal 1. Entries are null where a variance is ≤ 0.
  function corrFromCov(S) {
    if (!isSquare(S)) return null;
    var p = S.length, C = [];
    for (var i = 0; i < p; i++) {
      var row = [];
      for (var j = 0; j < p; j++) {
        if (!(S[i][i] > 0) || !(S[j][j] > 0)) row.push(null);
        else if (i === j) row.push(1);
        else row.push(clamp(S[i][j] / Math.sqrt(S[i][i] * S[j][j]), -1, 1));
      }
      C.push(row);
    }
    return C;
  }

  // pearson = Σ(x−x̄)(y−ȳ) / sqrt(Σ(x−x̄)²·Σ(y−ȳ)²). null if lengths differ, n < 3 or either series is constant.
  function pearson(x, y) {
    if (!sameLengthNum(x, y) || x.length < 3) return null;
    if (isConstant(x) || isConstant(y)) return null;
    var mx = mean(x), my = mean(y), sxy = 0, sxx = 0, syy = 0;
    for (var i = 0; i < x.length; i++) {
      var dx = x[i] - mx, dy = y[i] - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    if (!(sxx > 0) || !(syy > 0)) return null;
    return clamp(sxy / Math.sqrt(sxx * syy), -1, 1);
  }

  // spearman = Pearson correlation of the average ranks (ties share the mean of their ranks). null if n < 3.
  function spearman(x, y) {
    if (!sameLengthNum(x, y) || x.length < 3) return null;
    return pearson(rank(x), rank(y));
  }

  // φ(z) = exp(−z²/2) / sqrt(2π).
  function normPdf(z) {
    if (typeof z !== 'number' || isNaN(z)) return null;
    return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  }

  // Φ(z): Hart (1968) double-precision rational approximation in the form given by West (2005); |error| ~ 1e-15.
  function normCdf(z) {
    if (typeof z !== 'number' || isNaN(z)) return null;
    var x = Math.abs(z), c;
    if (x > 37) {
      c = 0;
    } else {
      var e = Math.exp(-x * x / 2);
      if (x < 7.07106781186547) {
        var num = 3.52624965998911e-2 * x + 0.700383064443688;
        num = num * x + 6.37396220353165;
        num = num * x + 33.912866078383;
        num = num * x + 112.079291497871;
        num = num * x + 221.213596169931;
        num = num * x + 220.206867912376;
        var den = 8.83883476483184e-2 * x + 1.75566716318264;
        den = den * x + 16.064177579207;
        den = den * x + 86.7807322029461;
        den = den * x + 296.564248779674;
        den = den * x + 637.333633378831;
        den = den * x + 793.826512519948;
        den = den * x + 440.413735824752;
        c = e * num / den;
      } else {
        var b = x + 0.65;
        b = x + 4 / b;
        b = x + 3 / b;
        b = x + 2 / b;
        b = x + 1 / b;
        c = e / b / 2.506628274631;
      }
    }
    return z > 0 ? 1 - c : c;
  }

  // Φ⁻¹(p): Acklam's rational approximation (rel. error 1.15e-9), then one Newton step x ← x − (Φ(x) − p)/φ(x)
  // (for p > 0.5 the residual is computed as (1 − p) − Φ(−x) to avoid cancellation). null unless 0 < p < 1.
  function normInv(p) {
    if (!isNum(p) || p <= 0 || p >= 1) return null;
    var a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
      1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    var b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
      6.680131188771972e+01, -1.328068155288572e+01];
    var c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
      -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    var d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
      3.754408661907416e+00];
    var pLow = 0.02425, pHigh = 1 - pLow, q, r, x;
    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    var e = p > 0.5 ? (1 - p) - normCdf(-x) : normCdf(x) - p;
    return x - e / normPdf(x);
  }

  // OLS via normal equations (X'X)β = X'y solved by Gaussian elimination with partial pivoting.
  // se_i = sqrt(s²·[(X'X)⁻¹]_ii), s² = SSR/(n − p), p = k + intercept; t = coef/se (null if se = 0);
  // r2 = 1 − SSR/SST (SST centred with intercept, uncentred without). k = regressors excluding the intercept;
  // coef[0] is the intercept when intercept:true. null if n ≤ p (n ≤ k+1 with intercept) or X'X singular.
  function ols(y, X, opts) {
    var intercept = !(opts && opts.intercept === false);
    if (!isNumArray(y) || !Array.isArray(X) || X.length !== y.length || y.length === 0) return null;
    var n = y.length, i, j, l;
    var rows = X.map(function (r) { return Array.isArray(r) ? r : [r]; });
    var k = rows[0].length;
    for (i = 0; i < n; i++) if (rows[i].length !== k || !isNumArray(rows[i])) return null;
    var p = k + (intercept ? 1 : 0);
    if (p === 0 || n <= p) return null;
    var D = rows.map(function (r) { return intercept ? [1].concat(r) : r.slice(); });
    var XtX = zeroMat(p, p), Xty = zeros(p);
    for (i = 0; i < n; i++) {
      for (j = 0; j < p; j++) {
        Xty[j] += D[i][j] * y[i];
        for (l = j; l < p; l++) XtX[j][l] += D[i][j] * D[i][l];
      }
    }
    for (j = 0; j < p; j++) for (l = 0; l < j; l++) XtX[j][l] = XtX[l][j];
    var inv = invert(XtX);
    if (!inv) return null;
    var coef = matVec(inv, Xty);
    var ssr = 0;
    for (i = 0; i < n; i++) { var e = y[i] - dot(D[i], coef); ssr += e * e; }
    var my = mean(y), sst = 0;
    for (i = 0; i < n; i++) { var dy = intercept ? y[i] - my : y[i]; sst += dy * dy; }
    var s2 = ssr / (n - p);
    var se = [], t = [];
    for (j = 0; j < p; j++) {
      var v = s2 * inv[j][j];
      var sej = v > 0 ? Math.sqrt(v) : 0;
      se.push(sej);
      t.push(sej > 0 ? coef[j] / sej : null);
    }
    return { coef: coef, se: se, t: t, r2: sst > 0 ? 1 - ssr / sst : null, n: n, k: k, df: n - p };
  }

  // Ledoit & Wolf (2004) shrinkage toward μI, μ = tr(S)/p, on demeaned returns x_t with the paper's S = X'X/n:
  //   d² = ‖S − μI‖²/p, b̄² = (1/n²)Σ_t‖x_t x_t' − S‖²/p, b² = min(b̄², d²), δ = b²/d² clamped to [0,1] (0 if d² = 0);
  //   Σ* = δμI + (1 − δ)S, returned multiplied by n/(n − 1) so its scale matches cov() (n − 1); δ is scale-free.
  function ledoitWolf(R) {
    if (!isNumMatrix(R) || R.length < 2) return null;
    var n = R.length, p = R[0].length, i, j, t;
    var m = [];
    for (j = 0; j < p; j++) {
      var col = [];
      for (t = 0; t < n; t++) col.push(R[t][j]);
      m.push(mean(col));
    }
    var X = R.map(function (row) { return row.map(function (v, jj) { return v - m[jj]; }); });
    var S = zeroMat(p, p);
    for (t = 0; t < n; t++) {
      for (i = 0; i < p; i++) for (j = i; j < p; j++) S[i][j] += X[t][i] * X[t][j];
    }
    for (i = 0; i < p; i++) for (j = i; j < p; j++) { S[i][j] /= n; S[j][i] = S[i][j]; }
    var mu = 0;
    for (i = 0; i < p; i++) mu += S[i][i];
    mu /= p;
    var d2 = 0;
    for (i = 0; i < p; i++) for (j = 0; j < p; j++) {
      var dd = S[i][j] - (i === j ? mu : 0);
      d2 += dd * dd;
    }
    d2 /= p;
    var b2bar = 0;
    for (t = 0; t < n; t++) {
      for (i = 0; i < p; i++) for (j = 0; j < p; j++) {
        var bb = X[t][i] * X[t][j] - S[i][j];
        b2bar += bb * bb;
      }
    }
    b2bar /= n * n * p;
    var b2 = Math.min(b2bar, d2);
    var shrink = d2 > 0 ? clamp(b2 / d2, 0, 1) : 0;
    var k = n / (n - 1);
    var C = zeroMat(p, p);
    for (i = 0; i < p; i++) for (j = 0; j < p; j++) {
      C[i][j] = k * ((1 - shrink) * S[i][j] + (i === j ? shrink * mu : 0));
    }
    return { cov: C, shrinkage: shrink };
  }

  // ======================================================================
  // Series alignment and returns
  // ======================================================================

  // Median gap (calendar days) between consecutive distinct valid dates: ≤4 → D (252/yr), ≤10 → W (52), else M (12).
  // null if fewer than 2 distinct dates.
  function inferFreq(dates) {
    if (!Array.isArray(dates)) return null;
    var seen = {}, d = [];
    for (var i = 0; i < dates.length; i++) {
      var dn = dayNum(dates[i]);
      if (dn !== null && !seen[dn]) { seen[dn] = true; d.push(dn); }
    }
    if (d.length < 2) return null;
    d.sort(function (a, b) { return a - b; });
    var gaps = [];
    for (i = 1; i < d.length; i++) gaps.push(d[i] - d[i - 1]);
    gaps.sort(function (a, b) { return a - b; });
    var h = gaps.length, med = h % 2 ? gaps[(h - 1) / 2] : (gaps[h / 2 - 1] + gaps[h / 2]) / 2;
    var f = med <= 4 ? 'D' : (med <= 10 ? 'W' : 'M');
    return { freq: f, ppy: PPY[f] };
  }

  // Keeps the LAST observation of each ISO week ('W') or calendar month ('M'), dated with its own date;
  // 'D' returns the sorted copy. Input is cleaned first: non-finite values and invalid dates dropped,
  // repeated dates keep the last occurrence. null if freq is not 'D'|'W'|'M'.
  function resample(points, freq) {
    if (!PPY[freq]) return null;
    var pts = cleanPoints(points);
    if (freq === 'D') return pts;
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var k = periodKey(pts[i][0], freq);
      if (i + 1 < pts.length && periodKey(pts[i + 1][0], freq) === k) continue;
      out.push([pts[i][0], pts[i][1]]);
    }
    return out;
  }

  // Aligns price series on a common calendar. Each series is cleaned, cut to [start, end], resampled to freq
  // (auto = the coarsest inferred freq among ids), then only periods where EVERY id has a value are kept
  // (listwise intersection). For W/M, series are matched by period (ISO week / month), not by exact day, so
  // different holiday calendars do not drop periods; the row date is the latest observation date in the period.
  // missing[id] = number of the id's own resampled periods dropped by the intersection.
  function alignPrices(seriesById, ids, opts) {
    opts = opts || {};
    if (!Array.isArray(ids) || ids.length === 0) return { ok: false, reason: 'nenhum ativo informado' };
    if (opts.freq !== undefined && opts.freq !== null && !PPY[opts.freq]) {
      return { ok: false, reason: 'frequência inválida: ' + opts.freq };
    }
    var start = opts.start, end = opts.end;
    if ((start && dayNum(start) === null) || (end && dayNum(end) === null)) return { ok: false, reason: 'data inválida na janela' };
    var cleaned = [], j;
    for (j = 0; j < ids.length; j++) {
      var id = ids[j];
      var pts = cleanPoints(seriesById ? seriesById[id] : null);
      if (!pts.length) return { ok: false, reason: 'sem série: ' + id };
      pts = pts.filter(function (pt) { return (!start || pt[0] >= start) && (!end || pt[0] <= end); });
      if (!pts.length) return { ok: false, reason: 'sem dados no período: ' + id };
      cleaned.push(pts);
    }
    var freq = opts.freq;
    if (!freq) {
      freq = 'D';
      cleaned.forEach(function (pts) {
        var f = inferFreq(pts.map(function (pt) { return pt[0]; }));
        if (f && FREQ_RANK[f.freq] > FREQ_RANK[freq]) freq = f.freq;
      });
    }
    var maps = cleaned.map(function (pts) {
      var m = new Map();
      resample(pts, freq).forEach(function (pt) { m.set(periodKey(pt[0], freq), pt); });
      return m;
    });
    var rows = [];
    maps[0].forEach(function (pt0, key) {
      for (var jj = 1; jj < maps.length; jj++) if (!maps[jj].has(key)) return;
      var date = pt0[0], vals = [];
      for (jj = 0; jj < maps.length; jj++) {
        var pt = maps[jj].get(key);
        if (pt[0] > date) date = pt[0];
        vals.push(pt[1]);
      }
      rows.push({ date: date, vals: vals });
    });
    rows.sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
    var missing = {};
    for (j = 0; j < ids.length; j++) missing[ids[j]] = maps[j].size - rows.length;
    if (!rows.length) return { ok: false, reason: 'sem datas em comum', freq: freq, missing: missing };
    return {
      ok: true,
      dates: rows.map(function (r) { return r.date; }),
      ids: ids.slice(),
      P: rows.map(function (r) { return r.vals; }),
      freq: freq,
      ppy: PPY[freq],
      missing: missing
    };
  }

  // Simple returns r_tj = P_tj / P_(t−1)j − 1; rows = P.length − 1. An entry is null when either price is
  // missing/non-finite or the previous price is 0 (nothing is filled in).
  function toReturns(P) {
    if (!Array.isArray(P)) return null;
    var out = [];
    for (var t = 1; t < P.length; t++) {
      if (!Array.isArray(P[t]) || !Array.isArray(P[t - 1]) || P[t].length !== P[t - 1].length) return null;
      var row = [];
      for (var j = 0; j < P[t].length; j++) {
        var a = P[t - 1][j], b = P[t][j];
        row.push(isNum(a) && isNum(b) && a !== 0 ? b / a - 1 : null);
      }
      out.push(row);
    }
    return out;
  }

  // Simple returns of a 1-D price array: r_t = p_t / p_(t−1) − 1 (null entry where undefined, as in toReturns).
  function toReturnsSeries(prices) {
    if (!Array.isArray(prices)) return null;
    var out = [];
    for (var t = 1; t < prices.length; t++) {
      var a = prices[t - 1], b = prices[t];
      out.push(isNum(a) && isNum(b) && a !== 0 ? b / a - 1 : null);
    }
    return out;
  }

  // Return in BRL of a foreign asset: r_BRL = (1 + r_local)(1 + r_fx) − 1, elementwise; r_fx = change of BRL per
  // unit of foreign currency. null if lengths differ; null entry where an input is non-finite.
  function toBRL(rLocal, rFx) {
    if (!Array.isArray(rLocal) || !Array.isArray(rFx) || rLocal.length !== rFx.length) return null;
    return rLocal.map(function (r, i) {
      return isNum(r) && isNum(rFx[i]) ? (1 + r) * (1 + rFx[i]) - 1 : null;
    });
  }

  // Single-period decomposition: total = (1 + r)(1 + fx) − 1 = local + fx + cross, with cross = r·fx.
  function fxDecompose(rLocal, rFx) {
    if (!isNum(rLocal) || !isNum(rFx)) return null;
    return { local: rLocal, fx: rFx, cross: rLocal * rFx, total: (1 + rLocal) * (1 + rFx) - 1 };
  }

  // Cumulative return of a PRICE/level series over [start, end]: r = v1/v0 − 1, v0 = first obs ON OR AFTER start,
  // v1 = last obs ON OR BEFORE end. Not covered (ok:false) if v0 is later than start + 7 days or v1 earlier than
  // end − 7 days. For "return since the close of day X" pass start = X (e.g. YTD 2026 → start '2025-12-31').
  function cumReturn(points, startDate, endDate) {
    var s = dayNum(startDate), e = dayNum(endDate);
    if (s === null || e === null || s > e) return { ok: false, reason: 'janela inválida' };
    var pts = cleanPoints(points);
    if (!pts.length) return { ok: false, reason: 'sem série' };
    var i0 = -1, i1 = -1, i;
    for (i = 0; i < pts.length; i++) if (pts[i][0] >= startDate) { i0 = i; break; }
    for (i = pts.length - 1; i >= 0; i--) if (pts[i][0] <= endDate) { i1 = i; break; }
    if (i0 < 0 || i1 < 0 || i0 > i1) return { ok: false, reason: 'sem observações na janela' };
    var d0 = pts[i0][0], d1 = pts[i1][0];
    if (dayNum(d0) > s + 7) return { ok: false, reason: 'série começa depois do início da janela (' + d0 + ')', d0: d0, d1: d1 };
    if (dayNum(d1) < e - 7) return { ok: false, reason: 'série termina antes do fim da janela (' + d1 + ')', d0: d0, d1: d1 };
    if (pts[i0][1] === 0) return { ok: false, reason: 'valor inicial zero', d0: d0, d1: d1 };
    return { ok: true, r: pts[i1][1] / pts[i0][1] - 1, d0: d0, d1: d1 };
  }

  // Pairwise correlation on dated returns: each pair uses only the dates both series have (pairwise deletion).
  // N[i][j] = overlap count; C[i][j] = null when N < minObs (or undefined, e.g. constant series).
  // Diagonal: N = own count, C = 1 (null when the own count < minObs or the series is constant).
  // Note: a matrix built pairwise is not guaranteed to be positive semidefinite.
  function pairwiseCorr(returnsById, ids, opts) {
    opts = opts || {};
    var method = opts.method || 'pearson';
    var minObs = opts.minObs === undefined || opts.minObs === null ? 20 : opts.minObs;
    if ((method !== 'pearson' && method !== 'spearman') || !Array.isArray(ids)) return null;
    var fn = method === 'spearman' ? spearman : pearson;
    var maps = ids.map(function (id) {
      var m = new Map();
      cleanPoints(returnsById ? returnsById[id] : null).forEach(function (pt) { m.set(pt[0], pt[1]); });
      return m;
    });
    var k = ids.length, C = zeroMat(k, k), N = zeroMat(k, k);
    for (var i = 0; i < k; i++) {
      var own = Array.from(maps[i].values());
      N[i][i] = own.length;
      C[i][i] = own.length >= minObs && own.length >= 2 && !isConstant(own) ? 1 : null;
      for (var j = i + 1; j < k; j++) {
        var x = [], y = [];
        maps[i].forEach(function (v, d) { if (maps[j].has(d)) { x.push(v); y.push(maps[j].get(d)); } });
        N[i][j] = N[j][i] = x.length;
        C[i][j] = C[j][i] = x.length >= minObs ? fn(x, y) : null;
      }
    }
    return { C: C, N: N, ids: ids.slice(), method: method, minObs: minObs };
  }

  // ======================================================================
  // Portfolio risk
  // ======================================================================

  function checkWS(w, S) { return isNumArray(w) && w.length > 0 && isSquare(S) && S.length === w.length; }

  // σ_p = sqrt(w'Sw) in the units of S (periodic unless S is annualised). null if w'Sw < 0 beyond rounding.
  function portVol(w, S) {
    if (!checkWS(w, S)) return null;
    var q = quadForm(w, S);
    if (q < 0) {
      var absq = 0;
      for (var i = 0; i < w.length; i++) for (var j = 0; j < w.length; j++) absq += Math.abs(w[i] * S[i][j] * w[j]);
      if (q < -1e-12 * absq) return null;
      q = 0;
    }
    return Math.sqrt(q);
  }

  // Euler decomposition: mrc_i = (Sw)_i/σ, ctr_i = w_i·mrc_i (Σctr = σ), pct_i = ctr_i/σ (Σpct = 1).
  // null if σ = 0.
  function riskContrib(w, S) {
    var sigma = portVol(w, S);
    if (!sigma) return null;
    var Sw = matVec(S, w);
    var mrc = Sw.map(function (v) { return v / sigma; });
    var ctr = mrc.map(function (v, i) { return w[i] * v; });
    var pct = ctr.map(function (v) { return v / sigma; });
    return { sigma: sigma, mrc: mrc, ctr: ctr, pct: pct };
  }

  // Volatility before/after a weight change: delta = σ(wNew) − σ(w), same S for both.
  function deltaVol(w, S, wNew) {
    var a = portVol(w, S), b = portVol(wNew, S);
    if (a === null || b === null) return null;
    return { before: a, after: b, delta: b - a };
  }

  // r_p,t = Σ_j w_j·R_tj with the SAME weights every period, i.e. the portfolio is rebalanced back to w each period
  // (not buy-and-hold drift). A period with any missing return gives null for that period.
  function portReturns(R, w) {
    if (!Array.isArray(R) || !isNumArray(w)) return null;
    for (var t = 0; t < R.length; t++) if (!Array.isArray(R[t]) || R[t].length !== w.length) return null;
    return R.map(function (row) {
      var s = 0;
      for (var j = 0; j < w.length; j++) {
        if (!isNum(row[j])) return null;
        s += w[j] * row[j];
      }
      return s;
    });
  }

  // wealth_t = Π_{s≤t}(1 + r_s) from initial capital 1; dd_t = wealth_t / max(1, max_{s≤t} wealth_s) − 1 (≤ 0).
  // mdd = min dd (≤ 0), current = last dd; trough = index of mdd, peak = index of the running peak before it
  // (−1 = the initial capital). peak/trough are null when there was no drawdown.
  function drawdown(returns) {
    if (!isNumArray(returns) || returns.length === 0) return null;
    var w = 1, peakVal = 1, peakIdx = -1, mdd = 0, trough = null, peak = null;
    var wealth = [], dd = [];
    for (var t = 0; t < returns.length; t++) {
      w *= 1 + returns[t];
      wealth.push(w);
      if (w > peakVal) { peakVal = w; peakIdx = t; }
      var d = w / peakVal - 1;
      dd.push(d);
      if (d < mdd) { mdd = d; trough = t; peak = peakIdx; }
    }
    return { wealth: wealth, dd: dd, mdd: mdd, current: dd[dd.length - 1], peak: peak, trough: trough };
  }

  // Historical VaR as a POSITIVE loss: VaR_α = −quantile(r, 1 − α), type-7 quantile (linear between order
  // statistics). Same horizon as r. null if n < 30.
  function varHist(r, alpha) {
    if (!isNumArray(r) || r.length < 30 || !(alpha > 0 && alpha < 1)) return null;
    var q = quantile(r, 1 - alpha);
    return q === 0 ? 0 : -q;
  }

  // Historical ES (CVaR) as a POSITIVE loss: −mean{r_t : r_t ≤ quantile(r, 1 − α)} (type-7 quantile). null if n < 30.
  function esHist(r, alpha) {
    if (!isNumArray(r) || r.length < 30 || !(alpha > 0 && alpha < 1)) return null;
    var q = quantile(r, 1 - alpha);
    var m = mean(r.filter(function (v) { return v <= q; }));
    return m === 0 ? 0 : -m;
  }

  // Gaussian VaR (positive loss) with sample mean μ and sample std σ: VaR = −(μ + σ·z_{1−α}). null if n < 2.
  function varNormal(r, alpha) {
    if (!isNumArray(r) || r.length < 2 || !(alpha > 0 && alpha < 1)) return null;
    return -(mean(r) + std(r) * normInv(1 - alpha));
  }

  // Gaussian ES (positive loss): ES = −μ + σ·φ(z_α)/(1 − α), sample μ and σ. null if n < 2.
  function esNormal(r, alpha) {
    if (!isNumArray(r) || r.length < 2 || !(alpha > 0 && alpha < 1)) return null;
    return -mean(r) + std(r) * normPdf(normInv(alpha)) / (1 - alpha);
  }

  // σ_annual = σ_periodic·sqrt(ppy) (assumes serially uncorrelated returns).
  function annualizeVol(sigma, ppy) {
    if (!isNum(sigma) || !isNum(ppy) || ppy <= 0) return null;
    return sigma * Math.sqrt(ppy);
  }

  // Geometric annualisation: (1 + m)^ppy − 1, m = mean periodic return.
  function annualizeReturn(meanPeriodic, ppy) {
    if (!isNum(meanPeriodic) || !isNum(ppy) || ppy <= 0 || meanPeriodic <= -1) return null;
    return Math.pow(1 + meanPeriodic, ppy) - 1;
  }

  // β = cov(r, rb)/var(rb) (both n − 1). null if n < 3 or rb is constant.
  function beta(r, rb) {
    if (!sameLengthNum(r, rb) || r.length < 3 || isConstant(rb)) return null;
    var mr = mean(r), mb = mean(rb), c = 0, v = 0;
    for (var i = 0; i < r.length; i++) { c += (r[i] - mr) * (rb[i] - mb); v += (rb[i] - mb) * (rb[i] - mb); }
    return c / v;
  }

  function active(r, rb) { return r.map(function (v, i) { return v - rb[i]; }); }

  // TE = std(r − rb)·sqrt(ppy) (sample std of active returns, annualised). null if n < 2.
  function trackingError(r, rb, ppy) {
    if (!sameLengthNum(r, rb) || r.length < 2 || !(ppy > 0)) return null;
    return std(active(r, rb)) * Math.sqrt(ppy);
  }

  // IR = (mean(r − rb)·ppy) / TE — arithmetic annualisation of the mean active return. null if TE = 0.
  function infoRatio(r, rb, ppy) {
    var te = trackingError(r, rb, ppy);
    if (!te) return null;
    return mean(active(r, rb)) * ppy / te;
  }

  function excessOf(r, x) {
    if (x === undefined || x === null) x = 0;
    if (isNum(x)) return r.map(function (v) { return v - x; });
    if (isNumArray(x) && x.length === r.length) return r.map(function (v, i) { return v - x[i]; });
    return null;
  }

  // Sharpe = mean(r − rf)·ppy / (std(r − rf)·sqrt(ppy)); rfPerPeriod is a per-period rate (number or array).
  // null if n < 2 or zero dispersion.
  function sharpe(r, rfPerPeriod, ppy) {
    if (!isNumArray(r) || r.length < 2 || !(ppy > 0)) return null;
    var ex = excessOf(r, rfPerPeriod);
    if (!ex) return null;
    var s = std(ex);
    if (!s) return null;
    return mean(ex) * ppy / (s * Math.sqrt(ppy));
  }

  // Sortino = mean(r − mar)·ppy / (DD·sqrt(ppy)), DD = sqrt(mean over ALL n of min(0, r − mar)²).
  // null if n < 2 or DD = 0.
  function sortino(r, marPerPeriod, ppy) {
    if (!isNumArray(r) || r.length < 2 || !(ppy > 0)) return null;
    var ex = excessOf(r, marPerPeriod);
    if (!ex) return null;
    var s = 0;
    for (var i = 0; i < ex.length; i++) if (ex[i] < 0) s += ex[i] * ex[i];
    var dd = Math.sqrt(s / ex.length);
    if (!dd) return null;
    return mean(ex) * ppy / (dd * Math.sqrt(ppy));
  }

  // out[i] = fn(arr[i−window+1 .. i], i) for i ≥ window − 1; null for the first window − 1 entries.
  function rolling(arr, window, fn) {
    if (!Array.isArray(arr) || !(window >= 1) || window % 1 !== 0 || typeof fn !== 'function') return null;
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      if (i < window - 1) { out.push(null); continue; }
      var v = fn(arr.slice(i - window + 1, i + 1), i);
      out.push(v === undefined ? null : v);
    }
    return out;
  }

  // HHI = Σ(w_i/Σw)². Weights are renormalised by their own sum, so this measures concentration within the
  // covered sum (e.g. the equity sleeve), not against 100% of the portfolio. null if Σw = 0.
  function hhi(w) {
    if (!isNumArray(w) || w.length === 0) return null;
    var s = sumArr(w);
    if (s === 0) return null;
    var h = 0;
    for (var i = 0; i < w.length; i++) { var x = w[i] / s; h += x * x; }
    return h;
  }

  // Effective number of positions = 1/HHI (same renormalisation as hhi).
  function effN(w) {
    var h = hhi(w);
    return h ? 1 / h : null;
  }

  // Diversification ratio = Σ w_i·σ_i / sqrt(w'Sw), σ_i = sqrt(S_ii). null if portfolio vol is 0.
  function divRatio(w, S) {
    var pv = portVol(w, S);
    if (!pv) return null;
    var s = 0;
    for (var i = 0; i < w.length; i++) {
      if (S[i][i] < 0) return null;
      s += w[i] * Math.sqrt(S[i][i]);
    }
    return s / pv;
  }

  // ======================================================================
  // Optimisation
  // ======================================================================

  // Euclidean projection onto {Σw = total, lb ≤ w ≤ ub}: w_i = clip(v_i − λ, lb_i, ub_i), with λ found by bisection
  // (Σw is non-increasing in λ) and then solved exactly on the final free set. lb/ub: number or array (default
  // −∞/+∞). null if infeasible (Σlb > total, Σub < total or some lb_i > ub_i).
  function projBudgetBox(v, lb, ub, total) {
    if (!isNumArray(v) || v.length === 0 || !isNum(total)) return null;
    var n = v.length, L = boundArray(lb, n, -Infinity), U = boundArray(ub, n, Infinity), i;
    if (!L || !U) return null;
    var sL = 0, sU = 0;
    for (i = 0; i < n; i++) {
      if (L[i] > U[i] || L[i] === Infinity || U[i] === -Infinity) return null;
      sL += L[i]; sU += U[i];
    }
    var tolF = 1e-12 * Math.max(1, Math.abs(total));
    if (sL > total + tolF || sU < total - tolF) return null;
    function clip(x, k) { return x < L[k] ? L[k] : (x > U[k] ? U[k] : x); }
    function f(lam) { var s = 0; for (var k = 0; k < n; k++) s += clip(v[k] - lam, k); return s; }
    var vmin = Math.min.apply(null, v), vmax = Math.max.apply(null, v);
    var lo = vmin - 1, hi = vmax + 1, step = 1, it;
    for (it = 0; it < 1100 && f(lo) < total; it++) { lo -= step; step *= 2; }
    step = 1;
    for (it = 0; it < 1100 && f(hi) > total; it++) { hi += step; step *= 2; }
    for (it = 0; it < 200; it++) {
      var mid = 0.5 * (lo + hi);
      if (mid <= lo || mid >= hi) break;
      if (f(mid) > total) lo = mid; else hi = mid;
    }
    var lam = 0.5 * (lo + hi);
    var free = [], atL = [], atU = [], fixedSum = 0;
    for (i = 0; i < n; i++) {
      var x = v[i] - lam;
      if (x <= L[i]) { atL.push(i); fixedSum += L[i]; } else if (x >= U[i]) { atU.push(i); fixedSum += U[i]; } else free.push(i);
    }
    if (free.length) {
      var sv = 0;
      for (i = 0; i < free.length; i++) sv += v[free[i]];
      var lam2 = (sv - (total - fixedSum)) / free.length;
      var same = free.every(function (k) { return v[k] - lam2 >= L[k] && v[k] - lam2 <= U[k]; }) &&
        atL.every(function (k) { return v[k] - lam2 <= L[k]; }) &&
        atU.every(function (k) { return v[k] - lam2 >= U[k]; });
      if (same) lam = lam2;
    }
    return v.map(function (val, k) { return clip(val - lam, k); });
  }

  // Dykstra's alternating projections onto C_1 ∩ … ∩ C_m: for each set, y = P_i(x + p_i), p_i ← x + p_i − y, x ← y.
  // Converges to the Euclidean projection of v onto the intersection (if non-empty). Stops when max|Δx| over a full
  // cycle < tol. Returns {x, iters, converged}; null if a projector returns null.
  function dykstra(v, projectors, opts) {
    if (!isNumArray(v) || !Array.isArray(projectors) || projectors.length === 0) return null;
    opts = opts || {};
    var iters = opts.iters || 500, tol = opts.tol || 1e-10;
    var n = v.length, m = projectors.length, x = v.slice(), P = [], k, i, j;
    for (i = 0; i < m; i++) P.push(zeros(n));
    for (k = 1; k <= iters; k++) {
      var xPrev = x;
      for (i = 0; i < m; i++) {
        var z = new Array(n);
        for (j = 0; j < n; j++) z[j] = x[j] + P[i][j];
        var y = projectors[i](z);
        if (!y) return null;
        for (j = 0; j < n; j++) P[i][j] = z[j] - y[j];
        x = y;
      }
      if (maxAbsDiff(x, xPrev) < tol) return { x: x, iters: k, converged: true };
    }
    return { x: x, iters: iters, converged: false };
  }

  // Projector onto the slab {lo ≤ Σ_{i∈idx} x_i ≤ hi}: if the sum s is outside, every indexed coordinate is
  // shifted by the same amount (lo − s)/|idx| or (hi − s)/|idx| (closed-form Euclidean projection).
  function slabProjector(idx, lo, hi) {
    var a = isNum(lo) ? lo : -Infinity, b = isNum(hi) ? hi : Infinity;
    return function (x) {
      var y = x.slice(), s = 0, i;
      for (i = 0; i < idx.length; i++) s += x[idx[i]];
      var shift = s < a ? (a - s) / idx.length : (s > b ? (b - s) / idx.length : 0);
      if (shift !== 0) for (i = 0; i < idx.length; i++) y[idx[i]] += shift;
      return y;
    };
  }

  // Long-only style optimiser by projected gradient, step 1/L, L = largest eigenvalue of the Hessian (power iteration):
  //   minvar : minimise w'Sw + τ‖w − w0‖²                      (Hessian 2S + 2τI)
  //   meanvar: maximise μ'w − (γ/2)w'Sw − τ‖w − w0‖²            (Hessian γS + 2τI)
  // Projection onto {Σw = total, lb ≤ w ≤ ub, group slabs} is projBudgetBox alone, or Dykstra over [budget+box, slabs].
  // Stops when max|Δw| < tol. "active" uses a 1e-6 tolerance. lb defaults to 0, ub to +∞, total to 1.
  function optimize(spec) {
    spec = spec || {};
    var S = spec.S;
    if (!isSquare(S)) return { ok: false, reason: 'matriz de covariância inválida' };
    var p = S.length, i, j;
    var scale = 0;
    for (i = 0; i < p; i++) for (j = 0; j < p; j++) scale = Math.max(scale, Math.abs(S[i][j]));
    for (i = 0; i < p; i++) for (j = 0; j < i; j++) {
      if (Math.abs(S[i][j] - S[j][i]) > 1e-10 * scale) return { ok: false, reason: 'matriz de covariância não simétrica' };
    }
    var objective = spec.objective || 'minvar';
    if (objective !== 'minvar' && objective !== 'meanvar') return { ok: false, reason: 'objetivo inválido: ' + objective };
    var mu = spec.mu;
    if (objective === 'meanvar') {
      if (mu === undefined || mu === null) return { ok: false, reason: 'sem retornos esperados' };
      if (!isNumArray(mu) || mu.length !== p) return { ok: false, reason: 'retornos esperados inválidos' };
    }
    var total = spec.total === undefined || spec.total === null ? 1 : spec.total;
    if (!isNum(total)) return { ok: false, reason: 'total inválido' };
    var lb = boundArray(spec.lb, p, 0), ub = boundArray(spec.ub, p, Infinity);
    if (!lb || !ub) return { ok: false, reason: 'limites inválidos' };
    var gamma = spec.gamma === undefined || spec.gamma === null ? 4 : spec.gamma;
    var tau = spec.tau === undefined || spec.tau === null ? 0 : spec.tau;
    if (!isNum(gamma) || gamma <= 0 || !isNum(tau) || tau < 0) return { ok: false, reason: 'gamma/tau inválidos' };
    var maxIter = spec.maxIter || 5000, tol = spec.tol || 1e-10;
    var w0 = spec.w0;
    if (w0 !== undefined && w0 !== null && (!isNumArray(w0) || w0.length !== p)) return { ok: false, reason: 'w0 inválido' };
    if (!w0 && tau > 0) return { ok: false, reason: 'tau > 0 exige w0' };
    var groups = spec.groups || [];
    for (i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (!g || !Array.isArray(g.idx) || !g.idx.length ||
        !g.idx.every(function (k) { return k === (k | 0) && k >= 0 && k < p; })) {
        return { ok: false, reason: 'grupo inválido: ' + (g && g.name ? g.name : i) };
      }
    }

    var projBB = function (x) { return projBudgetBox(x, lb, ub, total); };
    var proj = projBB;
    if (groups.length) {
      var projectors = [projBB].concat(groups.map(function (gr) { return slabProjector(gr.idx, gr.lo, gr.hi); }));
      var dtol = Math.min(1e-13, tol * 1e-3);
      proj = function (x) {
        var d = dykstra(x, projectors, { iters: 5000, tol: dtol });
        return d ? d.x : null;
      };
    }

    var a = objective === 'minvar' ? 2 : gamma;
    var L = a * powerIterMax(S) + 2 * tau;
    if (!(L > 0)) return { ok: false, reason: 'hessiana nula (S = 0 e tau = 0)' };
    var grad = function (w) {
      var Sw = matVec(S, w);
      return w.map(function (wi, k) {
        var gk = a * Sw[k];
        if (tau > 0) gk += 2 * tau * (wi - w0[k]);
        if (objective === 'meanvar') gk -= mu[k];
        return gk;
      });
    };

    var start = w0 ? w0.slice() : zeros(p).map(function () { return total / p; });
    var w = proj(start);
    if (!w) return { ok: false, reason: 'restrições inviáveis (Σlb > total ou Σub < total)' };
    var converged = false, iters = 0;
    for (var it = 1; it <= maxIter; it++) {
      iters = it;
      var gr = grad(w);
      var wn = proj(w.map(function (wi, k) { return wi - gr[k] / L; }));
      if (!wn) return { ok: false, reason: 'restrições inviáveis' };
      var diff = maxAbsDiff(wn, w);
      w = wn;
      if (diff < tol) { converged = true; break; }
    }
    // Dykstra leaves ~1e-13 residues (e.g. −1e-13 weights): one exact budget+box pass; groups then hold to ~1e-13.
    if (groups.length) w = projBB(w) || w;

    // feasibility check of the returned point (catches conflicting group constraints)
    var viol = Math.abs(sumArr(w) - total);
    for (i = 0; i < p; i++) viol = Math.max(viol, lb[i] - w[i], w[i] - ub[i]);
    var gsum = groups.map(function (gr) { return gr.idx.reduce(function (s, k) { return s + w[k]; }, 0); });
    groups.forEach(function (gr, k) {
      if (isNum(gr.lo)) viol = Math.max(viol, gr.lo - gsum[k]);
      if (isNum(gr.hi)) viol = Math.max(viol, gsum[k] - gr.hi);
    });
    if (viol > 1e-8) return { ok: false, reason: 'restrições inviáveis ou conflitantes (violação ' + viol.toExponential(2) + ')' };

    var ACT = 1e-6;
    var active = { lower: [], upper: [], groups: [] };
    for (i = 0; i < p; i++) {
      if (w[i] - lb[i] <= ACT) active.lower.push(i);
      if (ub[i] - w[i] <= ACT) active.upper.push(i);
    }
    groups.forEach(function (gr, k) {
      var name = gr.name !== undefined ? gr.name : 'g' + k;
      if (isNum(gr.lo) && gsum[k] - gr.lo <= ACT) active.groups.push({ name: name, side: 'lo' });
      if (isNum(gr.hi) && gr.hi - gsum[k] <= ACT) active.groups.push({ name: name, side: 'hi' });
    });

    var q = quadForm(w, S), pen = 0;
    if (tau > 0) for (i = 0; i < p; i++) pen += (w[i] - w0[i]) * (w[i] - w0[i]);
    var obj = objective === 'minvar' ? q + tau * pen : dot(mu, w) - gamma / 2 * q - tau * pen;
    return { ok: true, w: w, iters: iters, converged: converged, objective: obj, active: active };
  }

  // Equal risk contribution (or risk budgets b, normalised to sum 1), long-only, fully invested. Cyclical coordinate
  // descent (Griveau-Billion, Richard & Roncalli 2013) on min ½y'Sy − Σ b_i ln y_i: each step solves
  // S_ii y_i² + c_i y_i − b_i = 0, c_i = Σ_{j≠i} S_ij y_j (positive root); then w = y/Σy, giving w_i(Sw)_i ∝ b_i.
  // Box and group constraints are NOT imposed by this method.
  function riskParity(S, b) {
    if (!isSquare(S)) return { ok: false, reason: 'matriz de covariância inválida' };
    var p = S.length, i, j;
    var bb;
    if (b === undefined || b === null) {
      bb = zeros(p).map(function () { return 1 / p; });
    } else {
      if (!isNumArray(b) || b.length !== p || !b.every(function (x) { return x > 0; })) {
        return { ok: false, reason: 'orçamentos de risco inválidos (precisam ser > 0)' };
      }
      var sb = sumArr(b);
      bb = b.map(function (x) { return x / sb; });
    }
    for (i = 0; i < p; i++) if (!(S[i][i] > 0)) return { ok: false, reason: 'variância não positiva no ativo ' + i };
    var y = [];
    for (i = 0; i < p; i++) y.push(1 / Math.sqrt(S[i][i]));
    var q = quadForm(y, S);
    if (q > 0) { var sc = 1 / Math.sqrt(q); y = y.map(function (v) { return v * sc; }); }
    var maxIter = 10000, tol = 1e-13, converged = false, it;
    for (it = 1; it <= maxIter; it++) {
      var maxRel = 0;
      for (i = 0; i < p; i++) {
        var c = 0;
        for (j = 0; j < p; j++) if (j !== i) c += S[i][j] * y[j];
        var disc = Math.sqrt(c * c + 4 * S[i][i] * bb[i]);
        var yi = c >= 0 ? 2 * bb[i] / (c + disc) : (-c + disc) / (2 * S[i][i]);
        var rel = Math.abs(yi - y[i]) / y[i];
        if (rel > maxRel) maxRel = rel;
        y[i] = yi;
      }
      if (maxRel < tol) { converged = true; break; }
    }
    if (it > maxIter) it = maxIter;
    var sy = sumArr(y);
    return { ok: true, w: y.map(function (v) { return v / sy; }), iters: it, converged: converged };
  }

  // ======================================================================
  // Performance
  // ======================================================================

  // Time-weighted return, chain-linked: r_t = (V_t − F_t)/V_(t−1) − 1, total = Π(1 + r_t) − 1. V_t = value at end of
  // period t (t = 0 initial); F_t = external flow during period t, already included in V_t (end-of-period
  // convention; F_0 ignored). null if lengths differ or some V_(t−1) ≤ 0.
  function twr(values, flows) {
    if (!isNumArray(values) || values.length < 2) return null;
    var n = values.length;
    var F = flows === undefined || flows === null ? zeros(n) : flows;
    if (!isNumArray(F) || F.length !== n) return null;
    var periods = [], g = 1;
    for (var t = 1; t < n; t++) {
      if (!(values[t - 1] > 0)) return null;
      var r = (values[t] - F[t]) / values[t - 1] - 1;
      periods.push(r);
      g *= 1 + r;
    }
    return { total: g - 1, periods: periods };
  }

  // Annual IRR: r solving Σ cf_k·(1 + r)^(−t_k) = 0, t in years (investor view: contributions < 0, withdrawals and
  // final value > 0). Brackets sign changes on a grid over r ∈ [−0.99, 10], then bisects; if several roots exist
  // (non-conventional flows) the one closest to 0 is returned. null if no sign change.
  function irr(cashflows) {
    if (!Array.isArray(cashflows) || cashflows.length < 2) return null;
    for (var i = 0; i < cashflows.length; i++) {
      var c = cashflows[i];
      if (!c || !isNum(c.t) || !isNum(c.cf)) return null;
    }
    function npv(r) {
      var s = 0;
      for (var k = 0; k < cashflows.length; k++) s += cashflows[k].cf * Math.pow(1 + r, -cashflows[k].t);
      return s;
    }
    var G = 4000, x0 = Math.log(0.01), x1 = Math.log(11), roots = [];
    var rPrev = -0.99, fPrev = npv(rPrev);
    if (fPrev === 0) roots.push(rPrev);
    for (var g = 1; g <= G; g++) {
      var r = g === G ? 10 : Math.exp(x0 + (x1 - x0) * g / G) - 1;
      var f = npv(r);
      if (f === 0) roots.push(r);
      else if (fPrev !== 0 && (f > 0) !== (fPrev > 0)) {
        var lo = rPrev, hi = r, flo = fPrev;
        for (var it = 0; it < 200; it++) {
          var mid = 0.5 * (lo + hi);
          if (mid <= lo || mid >= hi) break;
          var fm = npv(mid);
          if (fm === 0) { lo = hi = mid; break; }
          if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi = mid;
        }
        roots.push(0.5 * (lo + hi));
      }
      rPrev = r; fPrev = f;
    }
    if (!roots.length) return null;
    roots.sort(function (u, v) { return Math.abs(u) - Math.abs(v); });
    return roots[0];
  }

  // Money-weighted return = IRR of: −V_0 at t = 0, −F_t at each date t ≥ 1 (a contribution is a positive flow INTO
  // the portfolio, so a cash outflow for the investor), +V_last at the end; t = days/365.25. flows[0] ignored.
  function mwr(dates, values, flows) {
    if (!Array.isArray(dates) || !isNumArray(values) || dates.length !== values.length || dates.length < 2) return null;
    var n = dates.length;
    var F = flows === undefined || flows === null ? zeros(n) : flows;
    if (!isNumArray(F) || F.length !== n) return null;
    var d0 = dayNum(dates[0]);
    if (d0 === null) return null;
    var cfs = [{ t: 0, cf: -values[0] }], prev = d0;
    for (var t = 1; t < n; t++) {
      var dn = dayNum(dates[t]);
      if (dn === null || dn < prev) return null;
      prev = dn;
      if (F[t] !== 0) cfs.push({ t: (dn - d0) / 365.25, cf: -F[t] });
    }
    cfs.push({ t: (prev - d0) / 365.25, cf: values[n - 1] });
    return irr(cfs);
  }

  // Brinson-Fachler, single period, by group g: Rp = Σwp·rp, Rb = Σwb·rb;
  //   alloc_g = (wp − wb)(rb_g − Rb), select_g = wb(rp_g − rb_g), inter_g = (wp − wb)(rp_g − rb_g).
  // Missing weights count as 0; returns are never assumed: a weighted group without its return → ok:false.
  // A group with wp = 0 takes rp_g := rb_g (no holding → no selection/interaction effect).
  // residual = (Rp − Rb) − Σ effects; it is ~0 when Σwp = Σwb.
  function brinson(input) {
    input = input || {};
    var wp = input.wp || {}, wb = input.wb || {}, rp = input.rp || {}, rb = input.rb || {};
    var keys = [], seen = {};
    [wp, wb, rp, rb].forEach(function (o) {
      Object.keys(o).forEach(function (k) { if (!seen[k]) { seen[k] = true; keys.push(k); } });
    });
    var rowsB = [], Rp = 0, Rb = 0;
    for (var i = 0; i < keys.length; i++) {
      var g = keys[i];
      var a = wp[g] === undefined || wp[g] === null ? 0 : wp[g];
      var b = wb[g] === undefined || wb[g] === null ? 0 : wb[g];
      if (!isNum(a) || !isNum(b)) return { ok: false, reason: 'peso inválido no grupo ' + g };
      var hasRp = isNum(rp[g]), hasRb = isNum(rb[g]);
      if (a !== 0 && !hasRp) return { ok: false, reason: 'grupo ' + g + ' tem peso na carteira mas não tem retorno (rp)' };
      if (b !== 0 && !hasRb) return { ok: false, reason: 'grupo ' + g + ' tem peso no benchmark mas não tem retorno (rb)' };
      if (a !== 0 && !hasRb) return { ok: false, reason: 'grupo ' + g + ' fora do benchmark: informe o retorno de referência (rb)' };
      var rbg = hasRb ? rb[g] : 0;
      var rpg = a !== 0 ? rp[g] : rbg;
      rowsB.push({ g: g, a: a, b: b, rp: rpg, rb: rbg });
      Rp += a * rpg;
      Rb += b * rbg;
    }
    var alloc = {}, select = {}, inter = {}, tA = 0, tS = 0, tI = 0;
    rowsB.forEach(function (x) {
      alloc[x.g] = (x.a - x.b) * (x.rb - Rb);
      select[x.g] = x.b * (x.rp - x.rb);
      inter[x.g] = (x.a - x.b) * (x.rp - x.rb);
      tA += alloc[x.g]; tS += select[x.g]; tI += inter[x.g];
    });
    var act = Rp - Rb;
    return {
      ok: true, alloc: alloc, select: select, inter: inter,
      totals: { alloc: tA, select: tS, inter: tI, active: act },
      Rp: Rp, Rb: Rb, residual: act - (tA + tS + tI)
    };
  }

  // Single-period buy-and-hold contribution: c_i = w_i·r_i (w_i = weight at the start of the period), total = Σc_i
  // = portfolio return. Arrays, or objects keyed by asset (keys of w; a missing return → null).
  function contrib(w, r) {
    if (Array.isArray(w)) {
      if (!sameLengthNum(w, r)) return null;
      var items = w.map(function (x, i) { return x * r[i]; });
      return { items: items, total: sumArr(items) };
    }
    if (!w || typeof w !== 'object' || !r || typeof r !== 'object') return null;
    var out = {}, tot = 0, keys = Object.keys(w);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (!isNum(w[k]) || !isNum(r[k])) return null;
      out[k] = w[k] * r[k];
      tot += out[k];
    }
    return { items: out, total: tot };
  }

  // ======================================================================
  // Scenario helpers
  // ======================================================================

  // Conditional expectation of zero-mean jointly normal factors: E[f_U | f_K = s_K] = Σ_UK Σ_KK⁻¹ s_K;
  // known entries are copied. null if Σ_KK is singular or inputs are malformed.
  function conditionalShock(Sf, idxKnown, shocksKnown) {
    if (!isSquare(Sf)) return null;
    var p = Sf.length;
    if (!Array.isArray(idxKnown) || !isNumArray(shocksKnown) || idxKnown.length === 0 ||
      idxKnown.length !== shocksKnown.length) return null;
    var isK = {};
    for (var a = 0; a < idxKnown.length; a++) {
      var k = idxKnown[a];
      if (k !== (k | 0) || k < 0 || k >= p || isK[k]) return null;
      isK[k] = true;
    }
    var SKK = idxKnown.map(function (i) { return idxKnown.map(function (j) { return Sf[i][j]; }); });
    var x = solve(SKK, shocksKnown);
    if (!x) return null;
    var f = zeros(p);
    for (var u = 0; u < p; u++) {
      if (isK[u]) continue;
      var s = 0;
      for (a = 0; a < idxKnown.length; a++) s += Sf[u][idxKnown[a]] * x[a];
      f[u] = s;
    }
    idxKnown.forEach(function (i, b) { f[i] = shocksKnown[b]; });
    return f;
  }

  // ======================================================================
  // Utility
  // ======================================================================

  // Type-7 quantile (R default): h = (n − 1)p, q = x_(⌊h⌋) + (h − ⌊h⌋)(x_(⌊h⌋+1) − x_(⌊h⌋)) on the sorted sample.
  function quantile(x, p) {
    if (!isNumArray(x) || x.length === 0 || !isNum(p) || p < 0 || p > 1) return null;
    var s = x.slice().sort(function (a, b) { return a - b; });
    var h = (s.length - 1) * p, lo = Math.floor(h), hi = Math.min(lo + 1, s.length - 1);
    return s[lo] + (h - lo) * (s[hi] - s[lo]);
  }

  // 1-based ranks; tied values all get the average of the ranks they span.
  function rank(x) {
    if (!isNumArray(x)) return null;
    var idx = x.map(function (v, i) { return i; }).sort(function (a, b) { return x[a] - x[b]; });
    var r = new Array(x.length), i = 0;
    while (i < idx.length) {
      var j = i;
      while (j + 1 < idx.length && x[idx[j + 1]] === x[idx[i]]) j++;
      var avg = (i + j) / 2 + 1;
      for (var k = i; k <= j; k++) r[idx[k]] = avg;
      i = j + 1;
    }
    return r;
  }

  // Solves A·x = b by Gaussian elimination with partial pivoting; null if A is singular (pivot ≤ 1e-12·max|A_ij|).
  function solve(A, b) {
    if (!isSquare(A) || !isNumArray(b) || b.length !== A.length) return null;
    var X = gaussSolve(A, b.map(function (v) { return [v]; }));
    return X ? X.map(function (r) { return r[0]; }) : null;
  }

  // (A·v)_i = Σ_j A_ij v_j.
  function matVec(A, v) {
    if (!Array.isArray(A) || !Array.isArray(v)) return null;
    var out = new Array(A.length);
    for (var i = 0; i < A.length; i++) {
      if (!Array.isArray(A[i]) || A[i].length !== v.length) return null;
      var s = 0;
      for (var j = 0; j < v.length; j++) s += A[i][j] * v[j];
      out[i] = s;
    }
    return out;
  }

  // a·b = Σ a_i b_i. null if lengths differ.
  function dot(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return null;
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  // (Aᵀ)_ij = A_ji.
  function transpose(A) {
    if (!Array.isArray(A) || A.length === 0) return [];
    var r = A.length, c = A[0].length, T = zeroMat(c, r);
    for (var i = 0; i < r; i++) {
      if (!Array.isArray(A[i]) || A[i].length !== c) return null;
      for (var j = 0; j < c; j++) T[j][i] = A[i][j];
    }
    return T;
  }

  return {
    // statistics
    mean: mean, variance: variance, std: std, cov: cov, corrFromCov: corrFromCov,
    pearson: pearson, spearman: spearman, normCdf: normCdf, normPdf: normPdf, normInv: normInv,
    ols: ols, ledoitWolf: ledoitWolf,
    // series alignment and returns
    inferFreq: inferFreq, resample: resample, alignPrices: alignPrices, toReturns: toReturns,
    toReturnsSeries: toReturnsSeries, toBRL: toBRL, fxDecompose: fxDecompose, cumReturn: cumReturn,
    pairwiseCorr: pairwiseCorr,
    // portfolio risk
    portVol: portVol, riskContrib: riskContrib, deltaVol: deltaVol, portReturns: portReturns,
    drawdown: drawdown, varHist: varHist, esHist: esHist, varNormal: varNormal, esNormal: esNormal,
    annualizeVol: annualizeVol, annualizeReturn: annualizeReturn, beta: beta, trackingError: trackingError,
    infoRatio: infoRatio, sharpe: sharpe, sortino: sortino, rolling: rolling, hhi: hhi, effN: effN,
    divRatio: divRatio,
    // optimisation
    projBudgetBox: projBudgetBox, dykstra: dykstra, slabProjector: slabProjector, optimize: optimize,
    riskParity: riskParity,
    // performance
    twr: twr, irr: irr, mwr: mwr, brinson: brinson, contrib: contrib,
    // scenarios
    conditionalShock: conditionalShock,
    // utility
    quantile: quantile, rank: rank, solve: solve, matVec: matVec, dot: dot, transpose: transpose
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Q;
