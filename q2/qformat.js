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
function matIdentity(n) {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_2, j) => i === j ? 1 : 0));
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

// src/control/tf.ts
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
  scaled(gain, name) {
    return new _DigitalTransferFunction(
      this.numerator.map((v) => v * gain),
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

// src/control/digitalLoop.ts
function piTransferFunction(config) {
  if (config.kp <= 0 || config.tiS <= 0 || config.sampleTimeS <= 0) {
    throw new Error("PI Kp, Ti and sample time must be positive");
  }
  const ki2 = config.sampleTimeS / (2 * config.tiS);
  return new DigitalTransferFunction(
    [config.kp * (1 + ki2), config.kp * (-1 + ki2)],
    [1, -1],
    config.sampleTimeS,
    "PI(z)"
  );
}
function pifAlpha(config) {
  if (config.lpfCutoffHz <= 0) return 1;
  const tau = 1 / (2 * Math.PI * config.lpfCutoffHz);
  return config.sampleTimeS / (config.sampleTimeS + tau);
}
function pifTransferFunction(config) {
  const pi = piTransferFunction({
    kp: config.kp,
    tiS: config.tiS,
    sampleTimeS: config.sampleTimeS,
    outputMin: config.outputMin,
    outputMax: config.outputMax,
    kind: "pi"
  });
  const alpha = pifAlpha(config);
  const outputLpf = new DigitalTransferFunction(
    [alpha],
    [1, -(1 - alpha)],
    config.sampleTimeS,
    "PI-output-LPF(z)"
  );
  return pi.cascade(outputLpf, "PIF(z)");
}
function twoP2ZTransferFunction(config) {
  return new DigitalTransferFunction(
    [config.b0, config.b1, config.b2],
    [1, config.a1, config.a2],
    config.sampleTimeS,
    "2P2Z(z)"
  );
}
function controllerTransferFunction(config) {
  switch (config.kind) {
    case "pi":
      return piTransferFunction(config);
    case "pif":
      return pifTransferFunction(config);
    case "2p2z":
      return twoP2ZTransferFunction(config);
  }
}

// src/control/qformat.ts
var Q27 = 27;
var Q24 = 24;
var Q20 = 20;
var SCALE27 = 1 << Q27;
var SCALE24 = 1 << Q24;
var SCALE20 = 1 << Q20;
var INT32_MAX = 2147483647;
function quantize(value, q) {
  const lsb = Math.pow(2, -q);
  const scaled = value * Math.pow(2, q);
  const rounded = Math.round(scaled);
  if (Math.abs(rounded) > INT32_MAX) {
    throw new Error(`fixed-point overflow: value ${value} at Q${q} exceeds int32`);
  }
  return { float: value, q, int: rounded, lsb };
}
function computePiFixed(kp, tiS, tsS, outMax = 1, outMin = 0) {
  const ki2p = kp * tsS / (2 * tiS);
  return {
    kp: quantize(kp, Q20),
    ki2p: quantize(ki2p, Q20),
    outMax: quantize(outMax, Q27),
    outMin: quantize(outMin, Q27)
  };
}
function computePifFixed(kp, tiS, lpfCutoffHz, tsS, outMax = 1, outMin = 0) {
  const alphaFloat = lpfCutoffHz > 0 ? tsS / (tsS + 1 / (2 * Math.PI * lpfCutoffHz)) : 1;
  return {
    pi: computePiFixed(kp, tiS, tsS, outMax, outMin),
    alpha: quantize(alphaFloat, Q24)
  };
}
function compute2P2ZFixed(b0, b1, b2, a1, a2, outMax = 1, outMin = 0) {
  return {
    b0: quantize(b0, Q27),
    b1: quantize(b1, Q27),
    b2: quantize(b2, Q27),
    a1: quantize(a1, Q27),
    a2: quantize(a2, Q27),
    outMax: quantize(outMax, Q27),
    outMin: quantize(outMin, Q27)
  };
}
function computeFixedPoint(config) {
  const kind = config.kind;
  const outMax = config.outputMax;
  const outMin = config.outputMin;
  const tsS = config.sampleTimeS;
  const checks = [];
  const budget = [];
  if (config.kind === "pi") {
    const pi = computePiFixed(config.kp, config.tiS, tsS, outMax, outMin);
    const kpBudget = Math.abs(pi.kp.float) * 2;
    const kiBudget = Math.abs(pi.ki2p.float) * 4;
    budget.push({ item: "kp\xD7e_max", upper: kpBudget, limit: 16, ok: kpBudget <= 16 });
    budget.push({ item: "ki2p\xD72e_max", upper: kiBudget, limit: 16, ok: kiBudget <= 16 });
    if (kpBudget > 16) checks.push(`FAIL-FAST: kp\xD7e_max = ${kpBudget.toFixed(3)} > 16\uFF08IQ27 \u7ED3\u679C\u57DF\uFF09\uFF0C\u9700\u964D\u4F4E\u589E\u76CA\u6216\u653E\u5927\u8F93\u51FA\u6EE1\u91CF\u7A0B`);
    if (kiBudget > 16) checks.push(`FAIL-FAST: ki2p\xD72e_max = ${kiBudget.toFixed(3)} > 16\uFF0C\u9700\u964D\u4F4E ki2p`);
    if (pi.ki2p.int === 0 && pi.ki2p.float > 0) {
      checks.push(`\u8B66\u544A: ki2p \u91CF\u5316\u5230 0 LSB\uFF08IQ20 \u4E0B ${pi.ki2p.float.toExponential(2)} < 2\u207B\xB2\u2070\uFF09\uFF0C\u79EF\u5206\u5668\u5C06\u5361\u6B7B`);
    }
    return { kind, tsS, kp: pi.kp, ki2p: pi.ki2p, outMax: pi.outMax, outMin: pi.outMin, checks, budget };
  }
  if (config.kind === "pif") {
    const pif = computePifFixed(config.kp, config.tiS, config.lpfCutoffHz, tsS, outMax, outMin);
    const kpBudget = Math.abs(pif.pi.kp.float) * 2;
    const kiBudget = Math.abs(pif.pi.ki2p.float) * 4;
    budget.push({ item: "kp\xD7e_max", upper: kpBudget, limit: 16, ok: kpBudget <= 16 });
    budget.push({ item: "ki2p\xD72e_max", upper: kiBudget, limit: 16, ok: kiBudget <= 16 });
    if (pif.alpha.int < 2) checks.push(`FAIL-FAST: alpha \u91CF\u5316\u540E < 2 LSB\uFF08IQ24\uFF09\uFF0CLPF \u5361\u6B7B\uFF1Bfc \u8FC7\u4F4E`);
    if (kpBudget > 16) checks.push(`FAIL-FAST: kp\xD7e_max = ${kpBudget.toFixed(3)} > 16`);
    if (kiBudget > 16) checks.push(`FAIL-FAST: ki2p\xD72e_max = ${kiBudget.toFixed(3)} > 16`);
    return {
      kind,
      tsS,
      kp: pif.pi.kp,
      ki2p: pif.pi.ki2p,
      alpha: pif.alpha,
      outMax: pif.pi.outMax,
      outMin: pif.pi.outMin,
      checks,
      budget
    };
  }
  const c = compute2P2ZFixed(config.b0, config.b1, config.b2, config.a1, config.a2, outMax, outMin);
  const s1Upper = Math.abs(c.b1.float + c.b2.float) + Math.abs(c.a1.float + c.a2.float);
  budget.push({ item: "|s1| = |B1+B2|+|A1+A2|", upper: s1Upper, limit: 16, ok: s1Upper <= 16 });
  if (s1Upper > 16) checks.push(`FAIL-FAST: |B1+B2|+|A1+A2| = ${s1Upper.toFixed(3)} > 16\uFF0C\u72B6\u6001\u53EF\u80FD\u6EA2\u51FA`);
  const dA2 = (1 - c.a2.float) * SCALE27;
  const dA1 = (c.a1.float + 2) * SCALE27;
  budget.push({ item: "A2 \u8DDD 1 \u4F59\u91CF(LSB)", upper: dA2, limit: 100, ok: dA2 >= 100 });
  budget.push({ item: "A1 \u8DDD -2 \u4F59\u91CF(LSB)", upper: dA1, limit: 100, ok: dA1 >= 100 });
  if (dA2 < 100) checks.push(`FAIL-FAST: A2 \u8DDD 1 \u4EC5 ${dA2.toFixed(0)} LSB < 100\uFF0C\u6781\u70B9\u53EF\u80FD\u88AB\u91CF\u5316\u5230\u5355\u4F4D\u5706\u4E0A`);
  if (dA1 < 100) checks.push(`FAIL-FAST: A1 \u8DDD -2 \u4EC5 ${dA1.toFixed(0)} LSB < 100`);
  for (const [name, coeff] of Object.entries({ b0: c.b0, b1: c.b1, b2: c.b2, a1: c.a1, a2: c.a2 })) {
    if (Math.abs(coeff.float) > 8) checks.push(`FAIL-FAST: ${name} = ${coeff.float.toFixed(3)} \u8D85 IQ27 \xB116 \u5B89\u5168\u57DF\uFF08B>8 \u65F6\u5EFA\u8BAE\u8BE5\u73AF\u5355\u72EC\u964D Q\uFF09`);
  }
  return {
    kind,
    tsS,
    b0: c.b0,
    b1: c.b1,
    b2: c.b2,
    a1: c.a1,
    a2: c.a2,
    outMax: c.outMax,
    outMin: c.outMin,
    checks,
    budget
  };
}
function renderFixedC99(fx, prefix = "vloop") {
  const lines = [
    "/* ============================================================",
    " * 32 \u4F4D\u5B9A\u70B9 LLC \u7535\u538B\u73AF\u63A7\u5236\u5668 \u2014\u2014 \u81EA\u5305\u542B int32 \u5B9E\u73B0",
    ` * \u6570\u636E\u57DF IQ27\uFF08\xB116\uFF0C2\u207B\xB2\u2077\uFF09\uFF1B\u7CFB\u6570\u57DF\uFF1A\u589E\u76CA IQ20 / alpha IQ24 / \u6781\u70B9 IQ27`,
    " * \u7EA6\u5B9A\u5BF9\u9F50 DSP_CTRL_CODE \u5B9A\u70B9\u5E93\uFF08fx_ctrl_iq27.h\uFF09\uFF1A",
    " *   PI   = \u8F93\u51FA\u91CF\u7EB2\u79EF\u5206\u5668 + \u65B9\u5411\u6027 anti-windup\uFF08\xA710.3\uFF09",
    " *   PIF  = PI + \u589E\u91CF\u578B LPF\uFF08\u51F8\u7EC4\u5408\u514D clamp\uFF0C\xA711.3\uFF09",
    " *   2P2Z = DF-IIt \u8F6C\u7F6E\u76F4\u63A5 II \u578B\uFF08\xA714.3\uFF09",
    " * ============================================================ */",
    "#include <stdint.h>",
    ""
  ];
  const cint = (v) => String(v);
  const outMax = cint(fx.outMax.int);
  const outMin = cint(fx.outMin.int);
  if (fx.kind === "pi" || fx.kind === "pif") {
    const kp = fx.kp;
    const ki2p = fx.ki2p;
    lines.push(
      `/* ${fx.kind.toUpperCase()} \u7CFB\u6570\uFF08IQ20 \u6574\u6570\uFF09 */`,
      `#define ${prefix.toUpperCase()}_KP_IQ20   ${cint(kp.int)}      /* ${kp.float.toPrecision(6)} \xD7 2^20 */`,
      `#define ${prefix.toUpperCase()}_KI2P_IQ20 ${cint(ki2p.int)}      /* ${ki2p.float.toPrecision(6)} \xD7 2^20\uFF08kp\xB7ts/(2Ti)\uFF09 */`,
      `#define ${prefix.toUpperCase()}_OUT_MAX   (${outMax})   /* ${fx.outMax.float} \xD7 2^27 */`,
      `#define ${prefix.toUpperCase()}_OUT_MIN   (${outMin})   /* ${fx.outMin.float} \xD7 2^27 */`,
      "",
      `static int32_t ${prefix}_ui = 0;           /* IQ27 \u8F93\u51FA\u91CF\u7EB2\u79EF\u5206\u5668 */`,
      `static int32_t ${prefix}_error_prev = 0;   /* IQ27 */`,
      "",
      `/* \u8BEF\u5DEE\u8F93\u5165 error_iq27\uFF08IQ27\uFF0C\u5F52\u4E00\u5316\uFF09\uFF1B\u8F93\u51FA out_iq27 \u2208 [out_min, out_max] */
static inline int32_t ${prefix}_run(int32_t error_iq27)
{
    int32_t ui_new, out_raw, out_sat;
    int32_t e_sum = error_iq27 + ${prefix}_error_prev;   /* IQ27\uFF0C|e_sum| \u2264 4 */

    /* _IQ20mpy\uFF1A\u7CFB\u6570 IQ20 \xD7 \u6570\u636E IQ27 \u2192 \u7ED3\u679C IQ27\uFF08int64 \u4E2D\u95F4\u91CF\uFF09 */
    ui_new = ${prefix}_ui + (int32_t)(((int64_t)${prefix.toUpperCase()}_KI2P_IQ20 * e_sum) >> ${Q20});

    if(ui_new > ${prefix.toUpperCase()}_OUT_MAX) { ui_new = ${prefix.toUpperCase()}_OUT_MAX; }
    if(ui_new < ${prefix.toUpperCase()}_OUT_MIN) { ui_new = ${prefix.toUpperCase()}_OUT_MIN; }

    out_raw = (int32_t)(((int64_t)${prefix.toUpperCase()}_KP_IQ20 * error_iq27) >> ${Q20}) + ${prefix}_ui;
    out_sat = out_raw;
    if(out_sat > ${prefix.toUpperCase()}_OUT_MAX) { out_sat = ${prefix.toUpperCase()}_OUT_MAX; }
    if(out_sat < ${prefix.toUpperCase()}_OUT_MIN) { out_sat = ${prefix.toUpperCase()}_OUT_MIN; }

    /* \u65B9\u5411\u6027\u6761\u4EF6\u79EF\u5206\uFF08\xA710.7 \u7B26\u53F7\u7EA6\u5B9A\uFF1Aerror \u4E0E\u8F93\u51FA\u540C\u53F7\u9A71\u52A8\uFF09 */
    if(!((out_raw > ${prefix.toUpperCase()}_OUT_MAX && error_iq27 > 0) ||
         (out_raw < ${prefix.toUpperCase()}_OUT_MIN && error_iq27 < 0)))
    {
        ${prefix}_ui = ui_new;
    }

    ${prefix}_error_prev = error_iq27;
    return out_sat;
}`
    );
  }
  if (fx.kind === "pif") {
    const alpha = fx.alpha;
    lines.push(
      "",
      `/* PIF \u589E\u91CF\u578B LPF\uFF08alpha IQ24\uFF09 */
#define ${prefix.toUpperCase()}_ALPHA_IQ24 ${cint(alpha.int)}   /* ${alpha.float.toPrecision(6)} \xD7 2^24 */
static int32_t ${prefix}_y_prev = 0;        /* IQ27 */
static inline int32_t ${prefix}_pif_run(int32_t error_iq27)
{
    int32_t x, diff, y;
    x = ${prefix}_run(error_iq27);                     /* PI \u9971\u548C\u8F93\u51FA IQ27 */
    diff = x - ${prefix}_y_prev;                       /* IQ27 */
    y = ${prefix}_y_prev + (int32_t)(((int64_t)${prefix.toUpperCase()}_ALPHA_IQ24 * diff) >> ${Q24});  /* \u51F8\u7EC4\u5408\uFF0C\u514D clamp */
    ${prefix}_y_prev = y;
    return y;
}`
    );
  }
  if (fx.kind === "2p2z") {
    const b0 = fx.b0;
    const b1 = fx.b1;
    const b2 = fx.b2;
    const a1 = fx.a1;
    const a2 = fx.a2;
    lines.push(
      `/* 2P2Z \u7CFB\u6570\uFF08\u5168 IQ27\uFF09 */
#define ${prefix.toUpperCase()}_B0_IQ27 ${cint(b0.int)}   /* ${b0.float.toPrecision(6)} */
#define ${prefix.toUpperCase()}_B1_IQ27 ${cint(b1.int)}   /* ${b1.float.toPrecision(6)} */
#define ${prefix.toUpperCase()}_B2_IQ27 ${cint(b2.int)}   /* ${b2.float.toPrecision(6)} */
#define ${prefix.toUpperCase()}_A1_IQ27 ${cint(a1.int)}   /* ${a1.float.toPrecision(6)} */
#define ${prefix.toUpperCase()}_A2_IQ27 ${cint(a2.int)}   /* ${a2.float.toPrecision(6)} */
#define ${prefix.toUpperCase()}_OUT_MAX  (${outMax})
#define ${prefix.toUpperCase()}_OUT_MIN  (${outMin})
static int32_t ${prefix}_s1 = 0, ${prefix}_s2 = 0;  /* IQ27 \u72B6\u6001\uFF1A|s1| \u2264 4 */
static inline int32_t ${prefix}_run(int32_t x)
{
    int32_t y_raw;
    y_raw = (int32_t)(((int64_t)${prefix.toUpperCase()}_B0_IQ27 * x) >> ${Q27}) + ${prefix}_s1;
    if(y_raw > ${prefix.toUpperCase()}_OUT_MAX) { y_raw = ${prefix.toUpperCase()}_OUT_MAX; }
    if(y_raw < ${prefix.toUpperCase()}_OUT_MIN) { y_raw = ${prefix.toUpperCase()}_OUT_MIN; }
    ${prefix}_s1 = (int32_t)(((int64_t)${prefix.toUpperCase()}_B1_IQ27 * x) >> ${Q27})
                 - (int32_t)(((int64_t)${prefix.toUpperCase()}_A1_IQ27 * y_raw) >> ${Q27}) + ${prefix}_s2;
    ${prefix}_s2 = (int32_t)(((int64_t)${prefix.toUpperCase()}_B2_IQ27 * x) >> ${Q27})
                 - (int32_t)(((int64_t)${prefix.toUpperCase()}_A2_IQ27 * y_raw) >> ${Q27});
    return y_raw;   /* \u9650\u5E45 y \u53CD\u9988 = \u5929\u7136 anti-windup */
}`
    );
  }
  lines.push("");
  return lines.join("\n");
}
function renderFixedLibInitC99(fx, prefix = "vloop") {
  const header = '#include "fx_ctrl_iq27.h"';
  if (fx.kind === "pi") {
    return [
      header,
      `/* ${fx.kind.toUpperCase()} \u2014\u2014 \u76F4\u63A5\u8C03\u7528\u5B9A\u70B9\u5E93\uFF08\u7ED3\u6784/\u51FD\u6570\u4E0E fx_ctrl_iq27.h \u4E00\u81F4\uFF09 */`,
      `static PI_IQ27_T ${prefix};`,
      "",
      `pi_iq27_init(&${prefix}, ${fx.kp.float.toPrecision(9)}f, ${(fx.tsS / fx.ki2p.float * fx.kp.float * 0.5).toPrecision(9)}f, ${fx.tsS.toPrecision(4)}f, ${fx.outMax.float}f, ${fx.outMin.float}f);`,
      `/* \u542F\u52A8\u671F fail-fast\uFF1Aif(pi_iq27_check(&${prefix}, _IQ(2.0f)) != 0) { /* \u62D2\u7EDD\u542F\u52A8 */ } */`,
      `/* ISR \u5185\uFF1Aout = pi_iq27_run(error_iq27, &${prefix}); */`
    ].join("\n");
  }
  if (fx.kind === "pif") {
    return [
      header,
      `/* PIF \u2014\u2014 PI \u5D4C\u5957 + \u589E\u91CF\u578B LPF */`,
      `static PIF_IQ27_T ${prefix};`,
      "",
      `pif_iq27_init(&${prefix}, ${fx.kp.float.toPrecision(9)}f, ${(fx.tsS / fx.ki2p.float * fx.kp.float * 0.5).toPrecision(9)}f, ${alphaOf(fx).toPrecision(9)}f, ${fx.tsS.toPrecision(4)}f, ${fx.outMax.float}f, ${fx.outMin.float}f);`,
      `/* ISR \u5185\uFF1Aout = pif_iq27_run(error_iq27, &${prefix}); */`
    ].join("\n");
  }
  return [
    header,
    `/* 2P2Z \u2014\u2014 DF-IIt \u5168 IQ27 */`,
    `static P2P2Z_IQ27_T ${prefix};`,
    "",
    `p2p2z_init(&${prefix}, ${fx.b0.float.toPrecision(9)}f, ${fx.b1.float.toPrecision(9)}f, ${fx.b2.float.toPrecision(9)}f, ${fx.a1.float.toPrecision(9)}f, ${fx.a2.float.toPrecision(9)}f, ${fx.outMax.float}f, ${fx.outMin.float}f);`,
    `/* \u542F\u52A8\u671F fail-fast\uFF1Aif(p2p2z_check(&${prefix}) != 0) { /* \u62D2\u7EDD\u542F\u52A8 */ } */`,
    `/* ISR \u5185\uFF1Aout = p2p2z_iq27_run(error_iq27, &${prefix}); */`
  ].join("\n");
}
function alphaOf(fx) {
  return fx.alpha ? fx.alpha.float : 0;
}
function fixedPointTable(fx) {
  const table = {
    outMax: { float: fx.outMax.float, q: fx.outMax.q, int: fx.outMax.int },
    outMin: { float: fx.outMin.float, q: fx.outMin.q, int: fx.outMin.int }
  };
  for (const key of ["kp", "ki2p", "alpha", "b0", "b1", "b2", "a1", "a2"]) {
    const c = fx[key];
    if (c) table[key] = { float: c.float, q: c.q, int: c.int };
  }
  return table;
}
export {
  SCALE20,
  SCALE24,
  SCALE27,
  compute2P2ZFixed,
  computeFixedPoint,
  computePiFixed,
  computePifFixed,
  controllerTransferFunction,
  fixedPointTable,
  quantize,
  renderFixedC99,
  renderFixedLibInitC99
};
