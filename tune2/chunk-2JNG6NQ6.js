// src/core/numeric.ts
var cplx = (re, im = 0) => ({ re, im });
var cAdd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
var cMul = (a, b) => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re
});
var cDiv = (a, b) => {
  const d = b.re * b.re + b.im * b.im;
  return {
    re: (a.re * b.re + a.im * b.im) / d,
    im: (a.im * b.re - a.re * b.im) / d
  };
};
var cAbs = (a) => Math.hypot(a.re, a.im);
var cInv = (a) => {
  const d = a.re * a.re + a.im * a.im;
  return { re: a.re / d, im: -a.im / d };
};
function brentq(f, a, b, xtol = 1e-8, rtol = 1e-11, maxIter = 100) {
  let fa = f(a);
  let fb = f(b);
  if (fa === 0) return { root: a, iterations: 0 };
  if (fb === 0) return { root: b, iterations: 0 };
  if (fa * fb > 0) {
    throw new Error(`brentq: f(a) and f(b) must have opposite signs (fa=${fa}, fb=${fb})`);
  }
  let c = a;
  let fc = fa;
  let d = b - a;
  let e = d;
  for (let iter = 0; iter < maxIter; iter++) {
    if (fb * fc > 0) {
      c = a;
      fc = fa;
      d = b - a;
      e = d;
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b;
      b = c;
      c = a;
      fa = fb;
      fb = fc;
      fc = fa;
    }
    const tol1 = 2 * Number.EPSILON * Math.abs(b) + 0.5 * xtol;
    const xm = 0.5 * (c - b);
    if (Math.abs(xm) <= tol1 || fb === 0) {
      return { root: b, iterations: iter };
    }
    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      let s = fb / fa;
      let p;
      let q;
      if (a === c) {
        p = 2 * xm * s;
        q = 1 - s;
      } else {
        q = fa / fc;
        const r = fb / fc;
        p = s * (2 * xm * q * (q - r) - (b - a) * (r - 1));
        q = (q - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) q = -q;
      p = Math.abs(p);
      const min1 = 3 * xm * q - Math.abs(tol1 * q);
      const min2 = Math.abs(e * q);
      if (2 * p < Math.min(min1, min2)) {
        e = d;
        d = p / q;
      } else {
        d = xm;
        e = d;
      }
    } else {
      d = xm;
      e = d;
    }
    a = b;
    fa = fb;
    if (Math.abs(d) > tol1) {
      b += d;
    } else {
      b += xm >= 0 ? Math.abs(tol1) : -Math.abs(tol1);
    }
    fb = f(b);
  }
  throw new Error("brentq: max iterations reached without convergence");
}
function geomspace(start, stop, n) {
  if (n < 2) return [start];
  const ratio = Math.pow(stop / start, 1 / (n - 1));
  const out = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    out.push(v);
    v *= ratio;
  }
  out[n - 1] = stop;
  return out;
}

// src/core/spec.ts
function cloneSpec(spec, changes) {
  return { ...spec, ...changes };
}
function turnsRatio(spec) {
  return spec.primaryTurns / spec.secondaryTurns;
}
function bridgeGain(spec) {
  return spec.primaryTopology === "FULL_BRIDGE" ? 1 : 0.5;
}
function validateSpec(spec) {
  const errors = [];
  if (!(0 < spec.vbusHoldEndV && spec.vbusHoldEndV <= spec.vbusMinNormalV && spec.vbusMinNormalV <= spec.vbusNomV && spec.vbusNomV <= spec.vbusMaxV)) {
    errors.push("bus voltage ordering must be hold_end <= min_normal <= nominal <= maximum");
  }
  if (spec.voutV <= 0 || spec.poutW <= 0) {
    errors.push("output voltage and power must be positive");
  }
  if (!(0 < spec.minimumFrequencyHz && spec.minimumFrequencyHz < spec.maximumFrequencyHz)) {
    errors.push("frequency range is invalid");
  }
  if (!(spec.minimumFrequencyHz <= spec.resonantFrequencyHz && spec.resonantFrequencyHz <= spec.maximumFrequencyHz)) {
    errors.push("resonant frequency must lie inside the switching range");
  }
  if (spec.lnRatio <= 1) {
    errors.push("Ln=Lm/Lr must exceed 1");
  }
  if (spec.qFullLoad <= 0) {
    errors.push("full-load Q must be positive");
  }
  if (spec.primaryTurns <= 0 || spec.secondaryTurns <= 0) {
    errors.push("transformer turns must be positive integers");
  }
  if (spec.transformerCoreFamilies.length === 0) {
    errors.push("magnetic core-family filters cannot be empty");
  }
  if (spec.litzStrandCopperDiameterM <= 0) {
    errors.push("Litz strand copper diameter must be positive");
  }
  if (!(0 <= spec.litzTranspositionQuality && spec.litzTranspositionQuality <= 1)) {
    errors.push("Litz transposition quality must be within 0..1");
  }
  if (spec.litzMaxHarmonic < 1) {
    errors.push("Litz maximum harmonic must be >= 1");
  }
  if (spec.magneticWaveformSamples < 128) {
    errors.push("magnetic waveform samples must be >= 128");
  }
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
}

// src/core/tank.ts
var SQRT2 = Math.sqrt(2);
var FHA_RECTIFIER_K = 2 * SQRT2 / Math.PI;
var GainNotReachableError = class extends Error {
};
function equivalentAcLoadOhm(turnsRatioN, voutV, poutW) {
  if (poutW <= 0) throw new Error("pout_w must be positive");
  const rLoad = voutV * voutV / poutW;
  return 8 / Math.PI ** 2 * turnsRatioN ** 2 * rLoad;
}
function designTank(spec) {
  validateSpec(spec);
  const rac = equivalentAcLoadOhm(turnsRatio(spec), spec.voutV, spec.poutW);
  const zr = spec.qFullLoad * rac;
  const omegaR = 2 * Math.PI * spec.resonantFrequencyHz;
  const lr = zr / omegaR;
  const cr = 1 / (omegaR * zr);
  const lm = spec.lnRatio * lr;
  return {
    lrH: lr,
    crF: cr,
    lmH: lm,
    racNomOhm: rac,
    zrOhm: zr,
    lnRatio: spec.lnRatio,
    qFullLoad: spec.qFullLoad,
    frHz: spec.resonantFrequencyHz,
    get fmHz() {
      return this.frHz / Math.sqrt(1 + this.lnRatio);
    }
  };
}
function tankState(tank, frequencyHz, racOhm) {
  if (frequencyHz <= 0 || racOhm <= 0) throw new Error("frequency and Rac must be positive");
  const w = 2 * Math.PI * frequencyHz;
  const zSeries = cAdd(cplx(0, w * tank.lrH), cInv(cplx(0, w * tank.crF)));
  const zLm = cplx(0, w * tank.lmH);
  const zParallel = cInv(cAdd(cInv(cplx(racOhm, 0)), cInv(zLm)));
  const zInput = cAdd(zSeries, zParallel);
  const transfer = cDiv(zParallel, zInput);
  return {
    frequencyHz,
    racOhm,
    zSeriesOhm: zSeries,
    zParallelOhm: zParallel,
    zInputOhm: zInput,
    transfer,
    get gain() {
      return cAbs(this.transfer);
    },
    get inputPhaseDeg() {
      return Math.atan2(this.zInputOhm.im, this.zInputOhm.re) * 180 / Math.PI;
    }
  };
}
function gain(tank, frequencyHz, racOhm) {
  return tankState(tank, frequencyHz, racOhm).gain;
}
function gainVector(tank, frequenciesHz, racOhm) {
  return frequenciesHz.map((f) => {
    const w = 2 * Math.PI * f;
    const zSeries = cAdd(cplx(0, w * tank.lrH), cInv(cplx(0, w * tank.crF)));
    const zLm = cplx(0, w * tank.lmH);
    const zParallel = cInv(cAdd(cInv(cplx(racOhm, 0)), cInv(zLm)));
    const zInput = cAdd(zSeries, zParallel);
    return cAbs(cDiv(zParallel, zInput));
  });
}
function targetGain(spec, vbusV) {
  return turnsRatio(spec) * (spec.voutV + spec.rectifierEquivalentDropV) / (bridgeGain(spec) * vbusV);
}
function bridgeFundamentalRmsV(spec, vbusV) {
  return FHA_RECTIFIER_K * bridgeGain(spec) * vbusV;
}
function findGainRoots(tank, racOhm, target, fminHz, fmaxHz, samples = 1600) {
  if (target <= 0) throw new Error("target gain must be positive");
  const freqs = geomspace(fminHz, fmaxHz, samples);
  const values = gainVector(tank, freqs, racOhm).map((v) => v - target);
  const roots2 = [];
  for (let idx = 0; idx < freqs.length - 1; idx++) {
    const f0 = freqs[idx];
    const f1 = freqs[idx + 1];
    const y0 = values[idx];
    const y1 = values[idx + 1];
    if (Math.abs(y0) < 1e-10) roots2.push(f0);
    if (y0 * y1 < 0) {
      const root = brentq((f) => gain(tank, f, racOhm) - target, f0, f1, 1e-8, 1e-11, 100);
      roots2.push(root.root);
    }
  }
  if (Math.abs(values[values.length - 1]) < 1e-10) roots2.push(freqs[freqs.length - 1]);
  const unique = [];
  for (const root of [...roots2].sort((a, b) => a - b)) {
    if (unique.length === 0 || Math.abs(root - unique[unique.length - 1]) > Math.max(0.1, 1e-7 * root)) {
      unique.push(root);
    }
  }
  return unique;
}
function solveFrequency(tank, spec, racOhm, requiredGain) {
  const target = requiredGain ?? targetGain(spec, spec.vbusNomV);
  const roots2 = findGainRoots(tank, racOhm, target, spec.minimumFrequencyHz, spec.maximumFrequencyHz);
  if (roots2.length === 0) {
    const frequencies = geomspace(spec.minimumFrequencyHz, spec.maximumFrequencyHz, 2e3);
    const gains = gainVector(tank, frequencies, racOhm);
    const gmin = Math.min(...gains);
    const gmax = Math.max(...gains);
    throw new GainNotReachableError(
      `required gain ${target.toFixed(4)} is outside available range ${gmin.toFixed(4)}..${gmax.toFixed(4)}`
    );
  }
  const inductive = roots2.filter((f) => tankState(tank, f, racOhm).inputPhaseDeg >= spec.minimumInductiveAngleDeg);
  const candidates = inductive.length > 0 ? inductive : roots2;
  let chosen;
  let branch;
  if (target <= 1) {
    const preferred = candidates.filter((f) => f >= tank.frHz * (1 - 1e-8));
    if (preferred.length > 0) {
      chosen = Math.min(...preferred);
      branch = "above_resonance";
    } else {
      chosen = candidates.reduce((best, f) => Math.abs(f - tank.frHz) < Math.abs(best - tank.frHz) ? f : best, candidates[0]);
      branch = "below_resonance_fallback";
    }
  } else {
    const preferred = candidates.filter((f) => f <= tank.frHz * (1 + 1e-8));
    if (preferred.length > 0) {
      chosen = Math.max(...preferred);
      branch = "boost_inductive";
    } else {
      chosen = candidates.reduce((best, f) => Math.abs(f - tank.frHz) < Math.abs(best - tank.frHz) ? f : best, candidates[0]);
      branch = "high_frequency_fallback";
    }
  }
  const state = tankState(tank, chosen, racOhm);
  return {
    frequencyHz: chosen,
    targetGain: target,
    achievedGain: state.gain,
    phaseDeg: state.inputPhaseDeg,
    rootsHz: roots2,
    branch
  };
}

// src/core/operatingPoint.ts
function solveOperatingPoint(spec, tank, vbusV, loadFraction) {
  const modeledFraction = Math.max(loadFraction, spec.minimumModeledLoadFraction);
  const pout = spec.poutW * modeledFraction;
  const transferredPower = pout * (1 + spec.rectifierEquivalentDropV / spec.voutV);
  const rac = equivalentAcLoadOhm(
    spec.primaryTurns / spec.secondaryTurns,
    spec.voutV + spec.rectifierEquivalentDropV,
    transferredPower
  );
  const required = targetGain(spec, vbusV);
  const solution = solveFrequency(tank, spec, rac, required);
  const state = tankState(tank, solution.frequencyHz, rac);
  const vBridge = bridgeFundamentalRmsV(spec, vbusV);
  const iResPhasor = cDiv(cplx(vBridge, 0), state.zInputOhm);
  const vParallel = cMul(iResPhasor, state.zParallelOhm);
  const iLoad = cDiv(vParallel, cplx(rac, 0));
  const iMag = cDiv(vParallel, cplx(0, 2 * Math.PI * solution.frequencyHz * tank.lmH));
  const iResRms = Math.hypot(iResPhasor.re, iResPhasor.im);
  const iResPeak = Math.sqrt(2) * iResRms;
  const iMagRms = Math.hypot(iMag.re, iMag.im);
  const iMagPeak = Math.sqrt(2) * iMagRms;
  const iLoadRms = Math.hypot(iLoad.re, iLoad.im);
  const iSecRms = spec.primaryTurns / spec.secondaryTurns * iLoadRms;
  const iSecPeak = Math.sqrt(2) * iSecRms;
  const phaseRad = state.inputPhaseDeg * Math.PI / 180;
  const fundamentalTransitionCurrent = Math.abs(iResPeak * Math.sin(phaseRad));
  const commutationCurrent = Math.max(0.75 * iMagPeak, fundamentalTransitionCurrent);
  const inputPower = vParallel.re * iLoad.re + vParallel.im * iLoad.im;
  const vSquareEq = Math.hypot(vParallel.re, vParallel.im) / FHA_RECTIFIER_K;
  const freqs = geomspace(spec.minimumFrequencyHz, spec.maximumFrequencyHz, 800);
  const gains = gainVector(tank, freqs, rac);
  return {
    vbusV,
    loadFraction,
    poutW: spec.poutW * loadFraction,
    outputCurrentA: spec.poutW / spec.voutV * loadFraction,
    racOhm: rac,
    qEffective: tank.zrOhm / rac,
    requiredGain: required,
    switchingFrequencyHz: solution.frequencyHz,
    normalizedFrequency: solution.frequencyHz / tank.frHz,
    achievedGain: solution.achievedGain,
    branch: solution.branch,
    inputImpedanceOhm: state.zInputOhm,
    inputPhaseDeg: state.inputPhaseDeg,
    bridgeFundamentalRmsV: vBridge,
    transformerFundamentalRmsV: Math.hypot(vParallel.re, vParallel.im),
    transformerSquareEquivalentV: vSquareEq,
    resonantCurrentRmsA: iResRms,
    resonantCurrentPeakA: iResPeak,
    magnetizingCurrentRmsA: iMagRms,
    magnetizingCurrentPeakA: iMagPeak,
    reflectedLoadCurrentRmsA: iLoadRms,
    secondaryCurrentRmsA: iSecRms,
    secondaryCurrentPeakA: iSecPeak,
    commutationCurrentA: commutationCurrent,
    estimatedInputPowerW: inputPower,
    availableGainMin: Math.min(...gains),
    availableGainMax: Math.max(...gains),
    get inductive() {
      return this.inputPhaseDeg > 0;
    }
  };
}

// src/control/linalg.ts
function matMul(a, b) {
  const m = a.length;
  const n = b[0].length;
  const p = b.length;
  if (a[0].length !== p) throw new Error("matMul: dimension mismatch");
  const out = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < p; k++) s += a[i][k] * b[k][j];
      out[i][j] = s;
    }
  }
  return out;
}
function matAdd(a, b) {
  return a.map((row, i) => row.map((v, j) => v + b[i][j]));
}
function matScale(a, s) {
  return a.map((row) => row.map((v) => v * s));
}
function matIdentity(n) {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_2, j) => i === j ? 1 : 0));
}
function matVec(a, v) {
  return a.map((row) => row.reduce((acc, val, j) => acc + val * v[j], 0));
}
function solveLinear(a, b) {
  const n = a.length;
  const aug = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[pivot][col])) pivot = row;
    }
    if (Math.abs(aug[pivot][col]) < 1e-18) return null;
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]];
    const d = aug[col][col];
    for (let j = col; j <= n; j++) aug[col][j] = aug[col][j] / d;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = aug[row][col];
      if (f === 0) continue;
      for (let j = col; j <= n; j++) aug[row][j] = aug[row][j] - f * aug[col][j];
    }
  }
  return aug.map((row) => row[n]);
}
function matNorm1(a) {
  let max = 0;
  for (let j = 0; j < a[0].length; j++) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i][j]);
    if (s > max) max = s;
  }
  return max;
}
var EXPM_TAYLOR_ORDER = 16;
function expm(a) {
  const n = a.length;
  const norm = matNorm1(a);
  const s = Math.max(0, Math.ceil(Math.log2(norm / 0.5)));
  const scaled = matScale(a, 1 / 2 ** s);
  let term = matIdentity(n);
  let sum = matIdentity(n);
  for (let k = 1; k <= EXPM_TAYLOR_ORDER; k++) {
    term = matScale(matMul(term, scaled), 1 / k);
    sum = matAdd(sum, term);
    if (matNorm1(term) < 1e-18 * matNorm1(sum)) break;
  }
  let result = sum;
  for (let i = 0; i < s; i++) result = matMul(result, result);
  return result;
}
function hessenberg(a) {
  const n = a.length;
  const h = a.map((row) => [...row]);
  for (let k = 0; k < n - 2; k++) {
    let norm = 0;
    for (let i = k + 1; i < n; i++) norm += h[i][k] * h[i][k];
    norm = Math.sqrt(norm);
    if (norm < 1e-300) continue;
    let alpha = h[k + 1][k];
    if (alpha >= 0) norm = -norm;
    const v = new Array(n).fill(0);
    for (let i = k + 1; i < n; i++) v[i] = h[i][k];
    v[k + 1] -= norm;
    let vnorm = 0;
    for (let i = k + 1; i < n; i++) vnorm += v[i] * v[i];
    vnorm = Math.sqrt(vnorm);
    if (vnorm < 1e-300) continue;
    for (let i = k + 1; i < n; i++) v[i] = v[i] / vnorm;
    const wL = new Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let i = k + 1; i < n; i++) s += v[i] * h[i][j];
      wL[j] = s;
    }
    const wR = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = k + 1; j < n; j++) s += h[i][j] * v[j];
      wR[i] = s;
    }
    let p = 0;
    for (let i = k + 1; i < n; i++) p += v[i] * wR[i];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        h[i][j] = h[i][j] - 2 * (v[i] ?? 0) * wL[j] - 2 * wR[i] * (v[j] ?? 0) + 4 * p * (v[i] ?? 0) * (v[j] ?? 0);
      }
    }
  }
  return h;
}
function eig2(a00, a01, a10, a11) {
  const tr = a00 + a11;
  const det = a00 * a11 - a01 * a10;
  const disc = tr * tr - 4 * det;
  if (disc >= 0) {
    const sq2 = Math.sqrt(disc);
    return [{ re: (tr + sq2) / 2, im: 0 }, { re: (tr - sq2) / 2, im: 0 }];
  }
  const sq = Math.sqrt(-disc) / 2;
  return [{ re: tr / 2, im: sq }, { re: tr / 2, im: -sq }];
}
function eigvals(a) {
  const n = a.length;
  if (n === 0) return [];
  if (n === 1) return [{ re: a[0][0], im: 0 }];
  if (n === 2) return eig2(a[0][0], a[0][1], a[1][0], a[1][1]);
  let h = hessenberg(a);
  const results = [];
  let m = n;
  let iter = 0;
  const maxIter = 100 * n;
  while (m > 1) {
    iter++;
    if (iter > maxIter) {
      for (let i = 0; i < m; i++) results.push({ re: h[i][i], im: 0 });
      return results;
    }
    let p = m - 1;
    while (p > 0 && Math.abs(h[p][p - 1]) > 1e-13 * (Math.abs(h[p - 1][p - 1]) + Math.abs(h[p][p]))) p--;
    if (p === m - 1) {
      results.push({ re: h[m - 1][m - 1], im: 0 });
      m--;
      continue;
    }
    if (p === m - 2) {
      const pair = eig2(h[p][p], h[p][p + 1], h[p + 1][p], h[p + 1][p + 1]);
      results.push(...pair);
      m = p;
      continue;
    }
    const a00 = h[m - 2][m - 2];
    const a01 = h[m - 2][m - 1];
    const a10 = h[m - 1][m - 2];
    const a11 = h[m - 1][m - 1];
    const tr = a00 + a11;
    const det = a00 * a11 - a01 * a10;
    const disc = tr * tr - 4 * det;
    let mu;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      const l1 = (tr + sq) / 2;
      const l2 = (tr - sq) / 2;
      mu = Math.abs(l1 - a11) < Math.abs(l2 - a11) ? l1 : l2;
    } else {
      mu = a11;
    }
    const shifted = h.map((row, i) => row.map((v, j) => i === j ? v - mu : v));
    const { q, r } = qrHessenberg(shifted, p, m);
    const newH = h.map((row) => [...row]);
    const size = m - p;
    const rSub = r.slice(p, m).map((row) => row.slice(p, m));
    const qSub = q.slice(p, m).map((row) => row.slice(p, m));
    const rq = matMul(rSub, qSub);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        let v = rq[i][j];
        if (i === j) v += mu;
        newH[p + i][p + j] = v;
      }
    }
    h = newH;
  }
  if (m === 1) results.push({ re: h[0][0], im: 0 });
  return results;
}
function qrHessenberg(h, lo, hi) {
  const n = h.length;
  const r = h.map((row) => [...row]);
  const q = matIdentity(n);
  for (let k = lo; k < hi - 1; k++) {
    const a = r[k][k];
    const b = r[k + 1][k];
    const mag = Math.hypot(a, b);
    if (mag < 1e-300) continue;
    let c;
    let s;
    if (a !== 0) {
      const rho = Math.sign(a) * mag;
      c = a / rho;
      s = b / rho;
    } else {
      c = 0;
      s = 1;
    }
    for (let j = k; j < hi; j++) {
      const t1 = r[k][j];
      const t2 = r[k + 1][j];
      r[k][j] = c * t1 + s * t2;
      r[k + 1][j] = -s * t1 + c * t2;
    }
    for (let i = lo; i < hi; i++) {
      const t1 = q[i][k];
      const t2 = q[i][k + 1];
      q[i][k] = c * t1 + s * t2;
      q[i][k + 1] = -s * t1 + c * t2;
    }
  }
  return { q, r };
}
function polyvalC(coeffs, x) {
  let re = 0;
  let im = 0;
  for (const c of coeffs) {
    const nre = re * x.re - im * x.im + c;
    const nim = re * x.im + im * x.re;
    re = nre;
    im = nim;
  }
  return { re, im };
}
function convolve(a, b) {
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] = out[i + j] + a[i] * b[j];
  }
  return out;
}
function trimLeadingZeros(a, tolerance = 0) {
  let first = 0;
  while (first < a.length - 1 && Math.abs(a[first]) <= tolerance) first++;
  return a.slice(first);
}
function roots(coeffs) {
  const c = trimLeadingZeros(coeffs);
  if (c.length <= 1) return [];
  const n = c.length - 1;
  const lead = c[0];
  const norm = c.map((v) => v / lead);
  const comp = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_2, j) => {
    if (j === n - 1) return -norm[n - i];
    if (i === j + 1) return 1;
    return 0;
  }));
  return eigvals(comp);
}
function sinc(x) {
  const px = Math.PI * x;
  if (Math.abs(px) < 1e-12) return 1;
  return Math.sin(px) / px;
}
function unwrap(phase, discont = Math.PI) {
  const out = [...phase];
  let offset = 0;
  for (let i = 1; i < out.length; i++) {
    let d = out[i] - out[i - 1];
    if (d > discont) {
      d -= 2 * Math.PI;
      offset -= 2 * Math.PI;
    } else if (d < -discont) {
      d += 2 * Math.PI;
      offset += 2 * Math.PI;
    }
    out[i] = out[i] + offset;
  }
  return out;
}
function searchsorted(sorted, value) {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = lo + hi >>> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
function interp(x, xp, fp) {
  if (xp.length !== fp.length || xp.length === 0) throw new Error("interp: length mismatch");
  if (x <= xp[0]) return fp[0];
  if (x >= xp[xp.length - 1]) return fp[fp.length - 1];
  const idx = searchsorted(xp, x);
  const x0 = xp[idx - 1];
  const x1 = xp[idx];
  const f0 = fp[idx - 1];
  const f1 = fp[idx];
  const t = (x - x0) / (x1 - x0);
  return f0 + t * (f1 - f0);
}

// src/control/plant.ts
var PI = Math.PI;
var FOUR_OVER_PI = 4 / PI;
var TWO_OVER_PI = 2 / PI;
var SQRT22 = Math.sqrt(2);
var PlantModelError = class extends Error {
};
function validatePlantParameters(p) {
  const bad = [];
  if (p.lrH <= 0) bad.push("Lr");
  if (p.crF <= 0) bad.push("Cr");
  if (p.lmH <= 0) bad.push("Lm");
  if (p.outputCapacitanceF <= 0) bad.push("Co");
  if (p.loadResistanceOhm <= 0) bad.push("Rload");
  if (p.turnsRatio <= 0) bad.push("turns ratio");
  if (p.bridgeGain <= 0) bad.push("bridge gain");
  if (bad.length > 0) throw new Error("plant parameters must be positive: " + bad.join(", "));
  if (p.outputCapEsrOhm < 0) throw new Error("output capacitor ESR cannot be negative");
  if (p.seriesResistanceOhm < 0) throw new Error("series resistance cannot be negative");
}
function plantParametersFromDesign(spec, tank, operatingPoint, seriesResistanceOhm) {
  if (operatingPoint.poutW <= 0) throw new Error("operating point output power must be positive");
  const rLoad = spec.voutV ** 2 / operatingPoint.poutW;
  let rSeries;
  if (seriesResistanceOhm !== void 0) {
    rSeries = seriesResistanceOhm;
  } else {
    rSeries = spec.resonantCapEsrOhm + 0.1;
  }
  const params = {
    lrH: tank.lrH,
    crF: tank.crF,
    lmH: tank.lmH,
    outputCapacitanceF: spec.outputCapacitanceF,
    outputCapEsrOhm: spec.outputCapEsrOhm,
    loadResistanceOhm: rLoad,
    turnsRatio: spec.primaryTurns / spec.secondaryTurns,
    bridgeGain: spec.primaryTopology === "FULL_BRIDGE" ? 1 : 0.5,
    seriesResistanceOhm: Math.max(rSeries, 1e-6),
    magnetizingSeriesResistanceOhm: 0,
    rectifierEquivalentDropV: spec.rectifierEquivalentDropV,
    primaryDeadtimeS: spec.primaryDeadtimeS,
    primaryTopology: spec.primaryTopology,
    primaryTurns: spec.primaryTurns,
    secondaryTurns: spec.secondaryTurns,
    transformerCoreAreaM2: 0,
    transformerMagneticPathM: 0,
    resonantInductorTurns: 0,
    resonantInductorCoreAreaM2: 0,
    resonantInductorMagneticPathM: 0
  };
  validatePlantParameters(params);
  return params;
}
var DynamicPhasorModel = class _DynamicPhasorModel {
  p;
  constructor(parameters) {
    validatePlantParameters(parameters);
    this.p = parameters;
  }
  static amplitude(cosine, sine, epsilon = 1e-12) {
    return Math.sqrt(cosine * cosine + sine * sine + epsilon);
  }
  /** 代数整流器/输出量（对应 algebraic()） */
  algebraic(states, inputs) {
    const irC = states[0];
    const irS = states[1];
    const imC = states[4];
    const imS = states[5];
    const vco = states[6];
    const loadC = irC - imC;
    const loadS = irS - imS;
    const loadPeak = _DynamicPhasorModel.amplitude(loadC, loadS);
    const iRectAvg = TWO_OVER_PI * this.p.turnsRatio * loadPeak;
    const rload = this.p.loadResistanceOhm;
    const esr = this.p.outputCapEsrOhm;
    const iDist = inputs.loadCurrentDisturbanceA;
    const vout = (rload * vco + rload * esr * (iRectAvg - iDist)) / (rload + esr);
    const clampSecondaryV = Math.max(vout + this.p.rectifierEquivalentDropV, 0);
    const signFundamentalGain = FOUR_OVER_PI / loadPeak;
    const vpC = this.p.turnsRatio * clampSecondaryV * signFundamentalGain * loadC;
    const vpS = this.p.turnsRatio * clampSecondaryV * signFundamentalGain * loadS;
    return {
      primaryLoadCosA: loadC,
      primaryLoadSinA: loadS,
      primaryLoadPeakA: loadPeak,
      rectifierCurrentAvgA: iRectAvg,
      outputVoltageV: vout,
      vpCosV: vpC,
      vpSinV: vpS
    };
  }
  /** 慢时状态导数（对应 rhs()） */
  rhs(states, inputs) {
    if (inputs.switchingFrequencyHz <= 0 || inputs.busVoltageV <= 0) {
      throw new Error("frequency and bus voltage must be positive");
    }
    const irC = states[0];
    const irS = states[1];
    const vcrC = states[2];
    const vcrS = states[3];
    const imC = states[4];
    const imS = states[5];
    const vco = states[6];
    const alg = this.algebraic(states, inputs);
    const omega = 2 * PI * inputs.switchingFrequencyHz;
    const vbC = 0;
    const vbS = FOUR_OVER_PI * this.p.bridgeGain * inputs.busVoltageV;
    const vpC = alg["vpCosV"];
    const vpS = alg["vpSinV"];
    const fIrC = (vbC - vcrC - vpC - this.p.seriesResistanceOhm * irC) / this.p.lrH;
    const fIrS = (vbS - vcrS - vpS - this.p.seriesResistanceOhm * irS) / this.p.lrH;
    const dIrC = fIrC - omega * irS;
    const dIrS = fIrS + omega * irC;
    const dVcrC = irC / this.p.crF - omega * vcrS;
    const dVcrS = irS / this.p.crF + omega * vcrC;
    const fImC = (vpC - this.p.magnetizingSeriesResistanceOhm * imC) / this.p.lmH;
    const fImS = (vpS - this.p.magnetizingSeriesResistanceOhm * imS) / this.p.lmH;
    const dImC = fImC - omega * imS;
    const dImS = fImS + omega * imC;
    const rload = this.p.loadResistanceOhm;
    const esr = this.p.outputCapEsrOhm;
    const iCap = alg["rectifierCurrentAvgA"] - alg["outputVoltageV"] / rload - inputs.loadCurrentDisturbanceA;
    const dVco = iCap / this.p.outputCapacitanceF;
    return [dIrC, dIrS, dVcrC, dVcrS, dImC, dImS, dVco];
  }
  /** 标准输出向量（对应 outputs()） */
  outputs(states, inputs) {
    const irC = states[0];
    const irS = states[1];
    const imC = states[4];
    const imS = states[5];
    const alg = this.algebraic(states, inputs);
    const irPeak = _DynamicPhasorModel.amplitude(irC, irS);
    const imPeak = _DynamicPhasorModel.amplitude(imC, imS);
    const loadPeak = alg["primaryLoadPeakA"];
    return [
      alg["outputVoltageV"],
      irPeak / SQRT22,
      imPeak / SQRT22,
      this.p.turnsRatio * loadPeak / SQRT22,
      alg["rectifierCurrentAvgA"],
      states[6]
    ];
  }
  /** FHA 电路初值（对应 initial_guess()） */
  initialGuess(inputs, operatingPoint, outputVoltageGuessV) {
    const omega = 2 * PI * inputs.switchingFrequencyHz;
    let rac;
    let vout;
    if (operatingPoint) {
      rac = operatingPoint.racOhm;
      vout = outputVoltageGuessV ?? operatingPoint.outputCurrentA * this.p.loadResistanceOhm;
    } else {
      vout = outputVoltageGuessV ?? Math.sqrt(Math.max(inputs.busVoltageV ** 2 / Math.max(this.p.loadResistanceOhm, 1e-12), 1));
      rac = 8 / PI ** 2 * this.p.turnsRatio ** 2 * this.p.loadResistanceOhm;
    }
    const vbPeak = FOUR_OVER_PI * this.p.bridgeGain * inputs.busVoltageV;
    const vb = { re: 0, im: -vbPeak };
    const zSeries = {
      re: this.p.seriesResistanceOhm,
      im: omega * this.p.lrH - 1 / (omega * this.p.crF)
    };
    const zLm = { re: 0, im: omega * this.p.lmH };
    const zParallel = cInv2(cAdd2(cInv2(cplx2(Math.max(rac, 1e-9), 0)), cInv2(zLm)));
    const ir = cDiv2(vb, cAdd2(zSeries, zParallel));
    const vp = cMul3(ir, zParallel);
    const im = cDiv2(vp, zLm);
    const vcr = cDiv2(ir, cplx2(0, omega * this.p.crF));
    return [ir.re, -ir.im, vcr.re, -vcr.im, im.re, -im.im, vout];
  }
  /**
   * 稳态求解：rhs(x,u)=0（对应 solve_steady_state）。
   * 用阻尼牛顿法 + 中心差分雅可比替代 scipy root(hybr)。
   */
  solveSteadyState(inputs, options = {}) {
    const { operatingPoint, initialStates, tolerance = 1e-9, maxEvaluations = 1e3 } = options;
    let x = initialStates ? [...initialStates] : this.initialGuess(inputs, operatingPoint);
    if (x.length !== 7) throw new Error("dynamic-phasor initial state must contain seven values");
    const currentScale = Math.max(operatingPoint?.resonantCurrentPeakA ?? 10, 1);
    const voltageScale = Math.max(inputs.busVoltageV, 10);
    const outputScale = Math.max(operatingPoint?.outputCurrentA ?? voltageScale / this.p.loadResistanceOhm, 1);
    const omega = 2 * PI * inputs.switchingFrequencyHz;
    const scales = [
      currentScale * omega,
      currentScale * omega,
      voltageScale * omega,
      voltageScale * omega,
      currentScale * omega,
      currentScale * omega,
      outputScale / this.p.outputCapacitanceF
    ];
    const residual = (xx) => {
      const r = this.rhs(xx, inputs);
      return r.map((v, i) => v / scales[i]);
    };
    let evaluations = 0;
    const relativeStep = 1e-6;
    const residualNorm = (xx) => {
      const r = residual(xx);
      return Math.sqrt(r.reduce((acc, v) => acc + v * v, 0));
    };
    let norm = residualNorm(x);
    for (let iter = 0; iter < maxEvaluations; iter++) {
      evaluations++;
      if (norm <= 1e-6) break;
      const jac = this.centralJacobian(residual, x, relativeStep);
      const negR = residual(x).map((v) => -v);
      const delta = solveLinear(jac, negR);
      if (!delta) {
        x = x.map((v, i) => v * (1 + 1e-8) + 1e-10);
        norm = residualNorm(x);
        continue;
      }
      let lambda = 1;
      let accepted = false;
      let xNew = [];
      let normNew = norm;
      for (let step = 0; step < 40; step++) {
        xNew = x.map((v, i) => v + lambda * delta[i]);
        normNew = residualNorm(xNew);
        if (normNew < norm) {
          accepted = true;
          break;
        }
        lambda *= 0.5;
      }
      if (!accepted) {
        break;
      }
      x = xNew;
      norm = normNew;
    }
    const rawNorm = Math.sqrt(this.rhs(x, inputs).reduce((acc, v) => acc + v * v, 0));
    const normalizedNorm = norm;
    const converged = normalizedNorm <= 1e-6;
    if (!converged) {
      throw new PlantModelError(
        `dynamic-phasor steady-state solve failed: normalized residual=${normalizedNorm.toExponential(3)}`
      );
    }
    const out = this.outputs(x, inputs);
    const alg = this.algebraic(x, inputs);
    return {
      states: x,
      inputs,
      residualNorm: rawNorm,
      iterations: evaluations,
      converged,
      outputVoltageV: out[0],
      outputCapacitorVoltageV: out[5],
      rectifierCurrentAvgA: out[4],
      resonantCurrentPeakA: out[1] * SQRT22,
      resonantCurrentRmsA: out[1],
      magnetizingCurrentPeakA: out[2] * SQRT22,
      magnetizingCurrentRmsA: out[2],
      primaryLoadCurrentPeakA: alg["primaryLoadPeakA"],
      secondaryCurrentRmsA: out[3],
      outputVoltageErrorV: 0,
      frequencyTrimmed: false
    };
  }
  /** 中心差分雅可比 */
  centralJacobian(fn, point, relativeStep, absoluteSteps) {
    const n = point.length;
    const value = fn(point);
    const jac = Array.from({ length: value.length }, () => new Array(n).fill(0));
    for (let col = 0; col < n; col++) {
      const step = absoluteSteps ? Math.max(absoluteSteps[col], relativeStep * Math.max(Math.abs(point[col]), 1)) : relativeStep * Math.max(Math.abs(point[col]), 1);
      const plus = [...point];
      const minus = [...point];
      plus[col] += step;
      minus[col] -= step;
      const fp = fn(plus);
      const fm = fn(minus);
      for (let row = 0; row < value.length; row++) {
        jac[row][col] = (fp[row] - fm[row]) / (2 * step);
      }
    }
    return jac;
  }
  /**
   * 调频外环：求解 Vo(fs) = Vo_target（对应 solve_regulated_steady_state）。
   * 网格扫根 + brentq 精化；无根时黄金分割最小化误差。
   */
  solveRegulatedSteadyState(options) {
    const {
      busVoltageV,
      targetOutputVoltageV,
      minimumFrequencyHz,
      maximumFrequencyHz,
      operatingPoint,
      loadCurrentDisturbanceA = 0,
      outputToleranceV = 2e-3,
      frequencySamples = 31
    } = options;
    if (busVoltageV <= 0 || targetOutputVoltageV <= 0) {
      throw new Error("bus and target output voltage must be positive");
    }
    if (!(0 < minimumFrequencyHz && minimumFrequencyHz < maximumFrequencyHz)) {
      throw new Error("invalid regulated-frequency bounds");
    }
    let freqGuess = options.frequencyGuessHz;
    if (!(minimumFrequencyHz <= freqGuess && freqGuess <= maximumFrequencyHz)) {
      freqGuess = Math.min(Math.max(freqGuess, minimumFrequencyHz), maximumFrequencyHz);
    }
    const samples = Math.max(Math.trunc(frequencySamples), 9);
    const cache = /* @__PURE__ */ new Map();
    let lastStates = null;
    const solveAt = (frequencyHz) => {
      const key = frequencyHz;
      if (cache.has(key)) return cache.get(key);
      const inputs = {
        switchingFrequencyHz: key,
        busVoltageV,
        loadCurrentDisturbanceA
      };
      let steady2;
      try {
        steady2 = this.solveSteadyState(inputs, { operatingPoint, initialStates: lastStates ?? void 0 });
      } catch {
        steady2 = this.solveSteadyState(inputs, { operatingPoint });
      }
      lastStates = steady2.states;
      cache.set(key, steady2);
      return steady2;
    };
    const error = (frequencyHz) => solveAt(frequencyHz).outputVoltageV - targetOutputVoltageV;
    const gridVals = [];
    const nGrid = samples;
    const ratio = Math.pow(maximumFrequencyHz / minimumFrequencyHz, 1 / (nGrid - 1));
    for (let i = 0; i < nGrid; i++) {
      gridVals.push(minimumFrequencyHz * ratio ** i);
    }
    gridVals[gridVals.length - 1] = maximumFrequencyHz;
    const grid = [.../* @__PURE__ */ new Set([...gridVals, freqGuess])].sort((a, b) => a - b);
    const values = [];
    for (const frequency of grid) {
      try {
        values.push([frequency, error(frequency)]);
      } catch {
        continue;
      }
    }
    if (values.length === 0) {
      throw new PlantModelError("regulated EDF solve failed at every sampled frequency");
    }
    const roots2 = [];
    for (let i = 0; i < values.length - 1; i++) {
      const [f0, e0] = values[i];
      const [f1, e1] = values[i + 1];
      if (Math.abs(e0) <= outputToleranceV) roots2.push(f0);
      if (e0 * e1 < 0) {
        try {
          const res = brentq(error, f0, f1, 1e-7, 0, 100);
          roots2.push(res.root);
        } catch {
        }
      }
    }
    if (Math.abs(values[values.length - 1][1]) <= outputToleranceV) {
      roots2.push(values[values.length - 1][0]);
    }
    let steady;
    if (roots2.length > 0) {
      const selected = roots2.reduce((best, f) => Math.abs(f - freqGuess) < Math.abs(best - freqGuess) ? f : best);
      steady = solveAt(selected);
    } else {
      const fMin = goldenSection((f) => Math.abs(error(f)), minimumFrequencyHz, maximumFrequencyHz, 1e-6);
      steady = solveAt(fMin);
      if (Math.abs(steady.outputVoltageV - targetOutputVoltageV) > outputToleranceV) {
        throw new PlantModelError(
          `regulated EDF frequency solve cannot reach target output: best Vo=${steady.outputVoltageV.toFixed(6)} V at ${(steady.inputs.switchingFrequencyHz / 1e3).toFixed(6)} kHz`
        );
      }
    }
    return {
      ...steady,
      targetOutputVoltageV,
      outputVoltageErrorV: steady.outputVoltageV - targetOutputVoltageV,
      frequencyTrimmed: true
    };
  }
};
function goldenSection(f, a, b, tol = 1e-6) {
  const phi = (Math.sqrt(5) - 1) / 2;
  let lo = a;
  let hi = b;
  let c = hi - phi * (hi - lo);
  let d = lo + phi * (hi - lo);
  let fc = f(c);
  let fd = f(d);
  for (let i = 0; i < 200; i++) {
    if (Math.abs(hi - lo) < tol) break;
    if (fc < fd) {
      hi = d;
      d = c;
      fd = fc;
      c = hi - phi * (hi - lo);
      fc = f(c);
    } else {
      lo = c;
      c = d;
      fc = fd;
      d = lo + phi * (hi - lo);
      fd = f(d);
    }
  }
  return (lo + hi) / 2;
}
function cAdd2(a, b) {
  return { re: a.re + b.re, im: a.im + b.im };
}
function cInv2(a) {
  const d = a.re * a.re + a.im * a.im;
  return { re: a.re / d, im: -a.im / d };
}
function cMul3(a, b) {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}
function cDiv2(a, b) {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}
function cplx2(re, im) {
  return { re, im };
}

// src/control/tf.ts
function matrixTrace(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i][i];
  return s;
}
function ss2tf(a, b, c, d, inputIdx, outputIdx) {
  const n = a.length;
  const bCol = b.map((row) => row[inputIdx]);
  const cRow = c[outputIdx];
  const cs = [1];
  const ms = [matIdentity(n)];
  for (let k = 1; k <= n; k++) {
    const am = matMul(a, ms[k - 1]);
    const ck = -matrixTrace(am) / k;
    cs.push(ck);
    if (k < n) {
      ms.push(matAdd(am, matScale(matIdentity(n), ck)));
    }
  }
  const cb = [];
  for (let k = 0; k < n; k++) {
    const mb = matVec(ms[k], bCol);
    let acc = 0;
    for (let i = 0; i < n; i++) acc += cRow[i] * mb[i];
    cb.push(acc);
  }
  const den = cs;
  const dVal = d[outputIdx][inputIdx];
  const num = new Array(n + 1).fill(0);
  num[0] = dVal * den[0];
  for (let i = 1; i <= n; i++) {
    num[i] = dVal * den[i] + (cb[i - 1] ?? 0);
  }
  return [num, den];
}
function cont2discreteZoh(a, b, c, d, ts) {
  const n = a.length;
  const aug = Array.from({ length: n + 1 }, (_, i) => {
    if (i < n) {
      return [...a[i], ...b[i]];
    }
    return new Array(n + b[0].length).fill(0);
  });
  const e = expm(matScale(aug, ts));
  const ad = e.slice(0, n).map((row) => row.slice(0, n));
  const bd = e.slice(0, n).map((row) => row.slice(n, n + b[0].length));
  return { ad, bd, cd: c, dd: d };
}
function cont2discreteBilinear(numS, denS, ts) {
  const k = 2 / ts;
  const d = Math.max(numS.length, denS.length) - 1;
  const num = padLeftPoly(numS, d + 1);
  const den = padLeftPoly(denS, d + 1);
  const zm1 = [[1]];
  const zp1 = [[1]];
  for (let m = 1; m <= d; m++) {
    zm1.push(convolve(zm1[m - 1], [1, -1]));
    zp1.push(convolve(zp1[m - 1], [1, 1]));
  }
  function transform(coeffs) {
    let acc = [];
    for (let m = 0; m <= d; m++) {
      const part = convolve(zm1[d - m], zp1[m]);
      const scaled = part.map((v) => v * coeffs[m] * k ** (d - m));
      acc = acc.length === 0 ? scaled : polyAdd(acc, scaled);
    }
    return acc;
  }
  const numZ = transform(num);
  const denZ = transform(den);
  const lead = denZ[0];
  return {
    numZ: numZ.map((v) => v / lead),
    denZ: denZ.map((v) => v / lead)
  };
}
function padLeftPoly(coeffs, length) {
  if (coeffs.length >= length) return [...coeffs];
  return [...new Array(length - coeffs.length).fill(0), ...coeffs];
}
function polyAdd(a, b) {
  const len = Math.max(a.length, b.length);
  const out = new Array(len).fill(0);
  for (let i = 0; i < len; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0);
  return out;
}
function makeSiso(numerator, denominator, inputName, inputUnit, outputName, outputUnit) {
  const num = trimLeadingZeros(numerator);
  const den = denominator.length > 0 ? denominator : [1];
  return {
    numerator: num,
    denominator: den,
    inputName,
    inputUnit,
    outputName,
    outputUnit,
    poles: roots(den),
    zeros: num.length > 1 ? roots(num) : [],
    dcGain: Math.abs(den[den.length - 1]) > 0 ? num[num.length - 1] / den[den.length - 1] : Infinity,
    get order() {
      return Math.max(0, this.denominator.length - 1);
    }
  };
}
function sisoEvaluate(tf, s) {
  const num = polyvalC(tf.numerator, s);
  const den = polyvalC(tf.denominator, s);
  const d2 = den.re * den.re + den.im * den.im;
  if (d2 === 0) return { re: Infinity, im: Infinity };
  return {
    re: (num.re * den.re + num.im * den.im) / d2,
    im: (num.im * den.re - num.re * den.im) / d2
  };
}
function sisoFrequencyResponse(tf, frequenciesHz) {
  return frequenciesHz.map((f) => sisoEvaluate(tf, { re: 0, im: 2 * Math.PI * f }));
}
function sisoScaled(tf, factor, inputName, inputUnit, outputName, outputUnit) {
  const numerator = tf.numerator.map((v) => v * factor);
  return makeSiso(
    numerator,
    tf.denominator,
    inputName ?? tf.inputName,
    inputUnit ?? tf.inputUnit,
    outputName ?? tf.outputName,
    outputUnit ?? tf.outputUnit
  );
}
var DigitalTransferFunction = class _DigitalTransferFunction {
  numerator;
  denominator;
  sampleTimeS;
  name;
  inputName;
  outputName;
  constructor(numerator, denominator, sampleTimeS, name = "C(z)", inputName = "error", outputName = "command") {
    if (numerator.length === 0 || denominator.length === 0) {
      throw new Error("digital transfer-function polynomials cannot be empty");
    }
    if (sampleTimeS <= 0) throw new Error("sample time must be positive");
    if (Math.abs(denominator[0]) < 1e-18) {
      throw new Error("digital transfer-function denominator leading coefficient is zero");
    }
    const num = numerator.map((v) => v / denominator[0]);
    const den = denominator.map((v) => v / denominator[0]);
    this.numerator = num;
    this.denominator = den;
    this.sampleTimeS = sampleTimeS;
    this.name = name;
    this.inputName = inputName;
    this.outputName = outputName;
  }
  get poles() {
    if (this.denominator.length <= 1) return [];
    return roots(this.denominator);
  }
  get zeros() {
    const nonzero = this.numerator.findIndex((v) => Math.abs(v) > 1e-16);
    if (nonzero < 0) return [];
    const trimmed = this.numerator.slice(nonzero);
    if (trimmed.length <= 1) return [];
    return roots(trimmed);
  }
  get stable() {
    return this.poles.every((p) => Math.hypot(p.re, p.im) < 1);
  }
  frequencyResponse(frequenciesHz) {
    return frequenciesHz.map((f) => {
      const z = {
        re: Math.cos(2 * Math.PI * f * this.sampleTimeS),
        im: Math.sin(2 * Math.PI * f * this.sampleTimeS)
      };
      let numRe = 0;
      let numIm = 0;
      for (let k = 0; k < this.numerator.length; k++) {
        const c = this.numerator[k];
        const zk = powZInv(z, k);
        numRe += c * zk.re;
        numIm += c * zk.im;
      }
      let denRe = 0;
      let denIm = 0;
      for (let k = 0; k < this.denominator.length; k++) {
        const c = this.denominator[k];
        const zk = powZInv(z, k);
        denRe += c * zk.re;
        denIm += c * zk.im;
      }
      const d2 = denRe * denRe + denIm * denIm;
      return {
        re: (numRe * denRe + numIm * denIm) / d2,
        im: (numIm * denRe - numRe * denIm) / d2
      };
    });
  }
  cascade(other, name) {
    if (Math.abs(this.sampleTimeS - other.sampleTimeS) > 1e-15) {
      throw new Error("cannot cascade digital blocks with different sample times");
    }
    return new _DigitalTransferFunction(
      convolve(this.numerator, other.numerator),
      convolve(this.denominator, other.denominator),
      this.sampleTimeS,
      name ?? `${this.name}*${other.name}`,
      this.inputName,
      other.outputName
    );
  }
  scaled(gain2, name) {
    return new _DigitalTransferFunction(
      this.numerator.map((v) => v * gain2),
      [...this.denominator],
      this.sampleTimeS,
      name ?? this.name,
      this.inputName,
      this.outputName
    );
  }
  withDelay(samples, name) {
    if (samples < 0) throw new Error("delay samples cannot be negative");
    if (samples === 0) return this;
    return new _DigitalTransferFunction(
      [...new Array(samples).fill(0), ...this.numerator],
      [...this.denominator],
      this.sampleTimeS,
      name ?? this.name,
      this.inputName,
      this.outputName
    );
  }
  differenceEquation(precision = 9) {
    const terms = [];
    for (let index = 1; index < this.denominator.length; index++) {
      const value = -this.denominator[index];
      const sign = value >= 0 ? "+" : "-";
      terms.push(` ${sign} ${Math.abs(value).toPrecision(precision)}*y[k-${index}]`);
    }
    for (let index = 0; index < this.numerator.length; index++) {
      const c = this.numerator[index];
      if (Math.abs(c) < 1e-18) continue;
      const sign = c >= 0 ? "+" : "-";
      const suffix = index === 0 ? "k" : `k-${index}`;
      terms.push(` ${sign} ${Math.abs(c).toPrecision(precision)}*x[${suffix}]`);
    }
    let expression = terms.join("").trimStart();
    if (expression.startsWith("+")) expression = expression.slice(1).trimStart();
    return `y[k] = ${expression || "0"}`;
  }
};
function powZInv(z, k) {
  if (k === 0) return { re: 1, im: 0 };
  const mag = 1 / Math.hypot(z.re, z.im) ** k;
  const ang = -k * Math.atan2(z.im, z.re);
  return { re: mag * Math.cos(ang), im: mag * Math.sin(ang) };
}

// src/control/linearize.ts
function makeLinearizedPlant(a, b, c, d, stateNames, inputNames, inputUnits, outputNames, outputUnits, steadyStates, steadyInputs, steadyOutputs, controlInputKind = "frequency_hz", timerClockHz = null) {
  return {
    a,
    b,
    c,
    d,
    stateNames,
    inputNames,
    inputUnits,
    outputNames,
    outputUnits,
    steadyStates,
    steadyInputs,
    steadyOutputs,
    poles: eigvalsOf(a),
    modelName: "seven_state_dynamic_phasor_edf",
    controlInputKind,
    timerClockHz,
    get stable() {
      return this.poles.every((p) => p.re < 0);
    }
  };
}
function centralJacobian(fn, point, relativeStep, absoluteSteps) {
  const value = fn(point);
  const jac = Array.from({ length: value.length }, () => new Array(point.length).fill(0));
  for (let col = 0; col < point.length; col++) {
    const step = absoluteSteps ? Math.max(absoluteSteps[col], relativeStep * Math.max(Math.abs(point[col]), 1)) : relativeStep * Math.max(Math.abs(point[col]), 1);
    const plus = [...point];
    const minus = [...point];
    plus[col] += step;
    minus[col] -= step;
    const fp = fn(plus);
    const fm = fn(minus);
    for (let row = 0; row < value.length; row++) {
      jac[row][col] = (fp[row] - fm[row]) / (2 * step);
    }
  }
  return jac;
}
function controlInputFactor(kind, f0, timerClockHz) {
  switch (kind) {
    case "frequency_hz":
      return { factor: 1, name: "switching_frequency_hz", unit: "Hz" };
    case "frequency_khz":
      return { factor: 1e3, name: "switching_frequency_khz", unit: "kHz" };
    case "period_s":
      return { factor: -(f0 ** 2), name: "switching_period_s", unit: "s" };
    case "timer_counts": {
      if (timerClockHz === null || timerClockHz === void 0 || timerClockHz <= 0) {
        throw new Error("timer_clock_hz must be positive for timer-count control");
      }
      return { factor: -(f0 ** 2) / timerClockHz, name: "timer_period_counts", unit: "count" };
    }
  }
}
function withControlInput(plant, kind, timerClockHz) {
  const f0 = plant.steadyInputs[0];
  const { factor, name, unit } = controlInputFactor(kind, f0, timerClockHz);
  const b = plant.b.map((row) => [...row]);
  const d = plant.d.map((row) => [...row]);
  for (let i = 0; i < b.length; i++) b[i][0] *= factor;
  for (let i = 0; i < d.length; i++) d[i][0] *= factor;
  const inputNames = [...plant.inputNames];
  const inputUnits = [...plant.inputUnits];
  inputNames[0] = name;
  inputUnits[0] = unit;
  return {
    ...plant,
    b,
    d,
    inputNames,
    inputUnits,
    controlInputKind: kind,
    timerClockHz: timerClockHz ?? null
  };
}
function plantSiso(plant, options = {}) {
  const { inputName, outputName = "output_voltage_v", relativeTrim = 1e-11 } = options;
  const inputIdx = inputName === void 0 ? 0 : plant.inputNames.indexOf(inputName);
  if (inputIdx < 0) throw new Error(`unknown input name: ${inputName}`);
  const outputIdx = plant.outputNames.indexOf(outputName);
  if (outputIdx < 0) throw new Error(`unknown output name: ${outputName}`);
  const [numAll, den] = ss2tf(plant.a, plant.b, plant.c, plant.d, inputIdx, outputIdx);
  let numerator = numAll;
  let denominator = den;
  if (denominator[0] === 0) throw new Error("invalid transfer-function denominator");
  numerator = numerator.map((v) => v / denominator[0]);
  denominator = denominator.map((v) => v / denominator[0]);
  const maxNum = Math.max(Math.max(...numerator.map(Math.abs)), 1);
  let first = 0;
  while (first < numerator.length - 1 && Math.abs(numerator[first]) <= relativeTrim * maxNum) first++;
  numerator = numerator.slice(first);
  return makeSiso(
    numerator,
    denominator,
    plant.inputNames[inputIdx],
    plant.inputUnits[inputIdx],
    plant.outputNames[outputIdx],
    plant.outputUnits[outputIdx]
  );
}
function linearizeDynamicPhasor(model, steadyState, relativeStep = 1e-6) {
  const x0 = steadyState.states;
  const u0 = [
    steadyState.inputs.switchingFrequencyHz,
    steadyState.inputs.busVoltageV,
    steadyState.inputs.loadCurrentDisturbanceA
  ];
  const a = centralJacobian((x) => model.rhs(x, steadyState.inputs), x0, relativeStep);
  const b = centralJacobian((u) => model.rhs(x0, { switchingFrequencyHz: u[0], busVoltageV: u[1], loadCurrentDisturbanceA: u[2] }), u0, relativeStep, [0.25, 1e-3, 1e-4]);
  const c = centralJacobian((x) => model.outputs(x, steadyState.inputs), x0, relativeStep);
  const d = centralJacobian((u) => model.outputs(x0, { switchingFrequencyHz: u[0], busVoltageV: u[1], loadCurrentDisturbanceA: u[2] }), u0, relativeStep, [0.25, 1e-3, 1e-4]);
  const outputs = model.outputs(x0, steadyState.inputs);
  return makeLinearizedPlant(
    a,
    b,
    c,
    d,
    [...STATE_NAMES_LOCAL],
    [...INPUT_NAMES_LOCAL],
    ["Hz", "V", "A"],
    [...OUTPUT_NAMES_LOCAL],
    ["V", "A", "A", "A", "A", "V"],
    x0,
    u0,
    outputs
  );
}
var STATE_NAMES_LOCAL = [
  "ir_cos_a",
  "ir_sin_a",
  "vcr_cos_v",
  "vcr_sin_v",
  "im_cos_a",
  "im_sin_a",
  "vco_v"
];
var INPUT_NAMES_LOCAL = ["switching_frequency_hz", "bus_voltage_v", "load_current_disturbance_a"];
var OUTPUT_NAMES_LOCAL = [
  "output_voltage_v",
  "resonant_current_rms_a",
  "magnetizing_current_rms_a",
  "secondary_current_rms_a",
  "rectifier_current_avg_a",
  "output_capacitor_voltage_v"
];
function eigvalsOf(a) {
  return eigvals(a);
}

// src/control/discretize.ts
function makeDiscretePlant(ad, bd, cd, dd, sampleTimeS, numerator, denominator, inputName, inputUnit, outputName, outputUnit, inputDelaySamples = 0) {
  return {
    ad,
    bd,
    cd,
    dd,
    sampleTimeS,
    numerator,
    denominator,
    poles: roots(denominator),
    zeros: numerator.length > 1 ? roots(trimLeadingZerosOf(numerator)) : [],
    inputName,
    inputUnit,
    outputName,
    outputUnit,
    inputDelaySamples,
    get stable() {
      return this.poles.every((p) => Math.hypot(p.re, p.im) < 1);
    },
    get differenceEquationText() {
      const terms = [];
      for (let index = 1; index < this.denominator.length; index++) {
        const value = -this.denominator[index];
        const sign = value >= 0 ? "+" : "-";
        terms.push(` ${sign} ${Math.abs(value).toPrecision(10)}*y[k-${index}]`);
      }
      for (let index = 0; index < this.numerator.length; index++) {
        const c = this.numerator[index];
        if (Math.abs(c) < 1e-18) continue;
        const delay = index + this.inputDelaySamples;
        const suffix = delay === 0 ? "k" : `k-${delay}`;
        const sign = c >= 0 ? "+" : "-";
        terms.push(` ${sign} ${Math.abs(c).toPrecision(10)}*u[${suffix}]`);
      }
      let expression = terms.join("").trimStart();
      if (expression.startsWith("+")) expression = expression.slice(1).trimStart();
      return `y[k] = ${expression || "0"}`;
    }
  };
}
function trimLeadingZerosOf(a) {
  let first = 0;
  while (first < a.length - 1 && Math.abs(a[first]) <= 0) first++;
  return a.slice(first);
}
function discretizeZoh(plant, sampleTimeS, options = {}) {
  const { inputName, outputName = "output_voltage_v", inputDelaySamples = 0, relativeTrim = 1e-12 } = options;
  if (sampleTimeS <= 0) throw new Error("sample time must be positive");
  if (inputDelaySamples < 0) throw new Error("input delay cannot be negative");
  const inputIdx = inputName === void 0 ? 0 : plant.inputNames.indexOf(inputName);
  if (inputIdx < 0) throw new Error(`unknown input name: ${inputName}`);
  const outputIdx = plant.outputNames.indexOf(outputName);
  if (outputIdx < 0) throw new Error(`unknown output name: ${outputName}`);
  const b = plant.b.map((row) => [row[inputIdx]]);
  const c = [plant.c[outputIdx]];
  const d = [[plant.d[outputIdx][inputIdx]]];
  const { ad, bd, cd, dd } = cont2discreteZoh(plant.a, b, c, d, sampleTimeS);
  const [numAll, den] = ss2tf(ad, bd, cd, dd, 0, 0);
  let numerator = numAll;
  let denominator = den;
  numerator = numerator.map((v) => v / denominator[0]);
  denominator = denominator.map((v) => v / denominator[0]);
  const maxNum = Math.max(Math.max(...numerator.map(Math.abs)), 1);
  numerator = numerator.map((v) => Math.abs(v) < relativeTrim * maxNum ? 0 : v);
  return makeDiscretePlant(
    ad,
    bd,
    cd,
    dd,
    sampleTimeS,
    numerator,
    denominator,
    plant.inputNames[inputIdx],
    plant.inputUnits[inputIdx],
    plant.outputNames[outputIdx],
    plant.outputUnits[outputIdx],
    inputDelaySamples
  );
}

// src/control/analysis.ts
function buildSmallSignalAnalysis(specIn, options = {}) {
  const {
    vbusV,
    loadFraction = 1,
    sampleTimeS = 2e-5,
    controlInputKind = "frequency_hz",
    timerClockHz = null,
    inputDelaySamples = 0,
    seriesResistanceOhm,
    trimFrequencyToOutput = true
  } = options;
  if (!(0 < loadFraction && loadFraction <= 1.5)) {
    throw new Error("load fraction must be within 0..1.5");
  }
  const spec = specIn;
  const tank = designTank(spec);
  const bus = vbusV ?? spec.vbusNomV;
  let operatingPoint = solveOperatingPoint(spec, tank, bus, loadFraction);
  const params = plantParametersFromDesign(spec, tank, operatingPoint, seriesResistanceOhm);
  const model = new DynamicPhasorModel(params);
  let steady;
  if (trimFrequencyToOutput) {
    steady = model.solveRegulatedSteadyState({
      busVoltageV: operatingPoint.vbusV,
      targetOutputVoltageV: spec.voutV,
      frequencyGuessHz: operatingPoint.switchingFrequencyHz,
      minimumFrequencyHz: spec.minimumFrequencyHz,
      maximumFrequencyHz: spec.maximumFrequencyHz,
      operatingPoint
    });
    const state = tankState(tank, steady.inputs.switchingFrequencyHz, operatingPoint.racOhm);
    operatingPoint = {
      ...operatingPoint,
      switchingFrequencyHz: steady.inputs.switchingFrequencyHz,
      normalizedFrequency: steady.inputs.switchingFrequencyHz / tank.frHz,
      branch: `${operatingPoint.branch}+EDF_TRIM`,
      inputImpedanceOhm: state.zInputOhm,
      inputPhaseDeg: state.inputPhaseDeg,
      bridgeFundamentalRmsV: bridgeFundamentalRmsV(spec, operatingPoint.vbusV),
      resonantCurrentRmsA: steady.resonantCurrentRmsA,
      resonantCurrentPeakA: steady.resonantCurrentPeakA,
      magnetizingCurrentRmsA: steady.magnetizingCurrentRmsA,
      magnetizingCurrentPeakA: steady.magnetizingCurrentPeakA,
      reflectedLoadCurrentRmsA: steady.primaryLoadCurrentPeakA / Math.sqrt(2),
      secondaryCurrentRmsA: steady.secondaryCurrentRmsA,
      secondaryCurrentPeakA: steady.secondaryCurrentRmsA * Math.sqrt(2)
    };
  } else {
    steady = model.solveSteadyState({
      switchingFrequencyHz: operatingPoint.switchingFrequencyHz,
      busVoltageV: operatingPoint.vbusV,
      loadCurrentDisturbanceA: 0
    }, { operatingPoint });
  }
  let continuous = linearizeDynamicPhasor(model, steady);
  continuous = withControlInput(continuous, controlInputKind, timerClockHz);
  const transfer = plantSiso(continuous, { outputName: "output_voltage_v" });
  const lineTransfer = plantSiso(continuous, { inputName: "bus_voltage_v", outputName: "output_voltage_v" });
  const outputImpedance = sisoScaledNeg(plantSiso(continuous, { inputName: "load_current_disturbance_a", outputName: "output_voltage_v" }));
  const resonantCurrentTransfer = plantSiso(continuous, { outputName: "resonant_current_rms_a" });
  const magnetizingCurrentTransfer = plantSiso(continuous, { outputName: "magnetizing_current_rms_a" });
  const discrete = discretizeZoh(continuous, sampleTimeS, {
    outputName: "output_voltage_v",
    inputDelaySamples
  });
  return {
    spec,
    tank,
    operatingPoint,
    continuousPlant: continuous,
    continuousTransfer: transfer,
    discretePlant: discrete,
    sampleTimeS,
    controlInputKind,
    timerClockHz,
    lineToOutputTransfer: lineTransfer,
    outputImpedanceTransfer: outputImpedance,
    resonantCurrentTransfer,
    magnetizingCurrentTransfer,
    get stable() {
      return this.continuousPlant.stable && this.discretePlant.stable;
    }
  };
}
function sisoScaledNeg(tf) {
  return sisoScaled(tf, -1, "load_current_a", "A");
}

export {
  geomspace,
  cloneSpec,
  roots,
  sinc,
  unwrap,
  searchsorted,
  interp,
  ss2tf,
  cont2discreteZoh,
  cont2discreteBilinear,
  sisoFrequencyResponse,
  DigitalTransferFunction,
  buildSmallSignalAnalysis
};
