// src/core/spec.ts
var DEFAULT_SPEC = {
  vbusNomV: 400,
  vbusMinNormalV: 360,
  vbusMaxV: 420,
  vbusHoldEndV: 300,
  voutV: 53,
  poutW: 3e3,
  efficiencyAssumption: 0.96,
  primaryTopology: "FULL_BRIDGE",
  secondaryTopology: "FULL_BRIDGE_SR",
  resonantFrequencyHz: 1e5,
  minimumFrequencyHz: 6e4,
  maximumFrequencyHz: 18e4,
  lnRatio: 5,
  qFullLoad: 0.35,
  primaryTurns: 30,
  secondaryTurns: 4,
  rectifierEquivalentDropV: 0.4,
  busCapacitanceF: 18e-4,
  outputCapacitanceF: 15e-4,
  outputCapEsrOhm: 15e-4,
  resonantCapEsrOhm: 4e-3,
  primaryDeadtimeS: 2e-7,
  primaryZvsMarginRequired: 1.2,
  ambientTemperatureC: 45,
  windingTemperatureC: 100,
  transformerRthKPerW: 5,
  magneticThermalMaxIterations: 12,
  magneticThermalToleranceC: 0.25,
  magneticWaveformSamples: 2048,
  magneticHotspotLimitC: 130,
  litzStrandCopperDiameterM: 1e-4,
  litzStrandOuterDiameterM: 112e-6,
  litzPackingFactor: 0.55,
  litzCurrentDensityTargetAPerMm2: 5,
  litzCurrentDensityMaxAPerMm2: 6,
  transformerWindingLayout: "P/2-S-P/2",
  transformerCoreFamilies: ["PQ", "EE", "EC", "EER", "ETD"],
  transformerMaxFillFactor: 0.6,
  transformerMaxBT: 0.2,
  transformerMaxGapMm: 4,
  transformerInsulationAreaMm2: 28,
  litzMaxHarmonic: 15,
  litzTranspositionQuality: 0.9,
  litzSubBundleCouplingFactor: 0.12,
  windingTerminationResistanceFraction: 0.03,
  litzProximityCorrection: 1,
  transformerProximitySeverity: 1,
  includeGapFringingLoss: true,
  gapToWindingDistanceMm: 3,
  gapFringingCalibration: 1,
  minimumInductiveAngleDeg: 3,
  minimumModeledLoadFraction: 0.1
};
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

// src/data/corePresets.ts
var CORE_PRESETS = [
  {
    presetKey: "TDK_PQ35_35_B65881A_N87",
    manufacturer: "TDK Electronics",
    partNumber: "B65881A0000R087",
    shape: "PQ35/35",
    materialKey: "TDK_N87_REF",
    materialGrade: "N87",
    aeMm2: 171,
    aminMm2: 161,
    leMm: 79.7,
    veMm3: 13650,
    sigmaLOverAPerMm: 0.465,
    alNh: 4500,
    muE: 1670,
    windingAreaMm2: 158,
    meanTurnLengthMm: 76,
    usableWindingWidthMm: 24.6,
    arUohm: 16.5,
    coreMassG: 74,
    thermalResistanceKPerW: 5,
    datasheetLossRefW: 8.75,
    datasheetLossRefFrequencyHz: 1e5,
    datasheetLossRefBT: 0.2,
    datasheetLossRefTemperatureC: 100
  },
  {
    presetKey: "TDK_PQ35_35_B65881A_N97",
    manufacturer: "TDK Electronics",
    partNumber: "B65881A0000R097",
    shape: "PQ35/35",
    materialKey: "TDK_N97_REF",
    materialGrade: "N97",
    aeMm2: 171,
    aminMm2: 161,
    leMm: 79.7,
    veMm3: 13650,
    sigmaLOverAPerMm: 0.465,
    alNh: 4700,
    muE: 1750,
    windingAreaMm2: 158,
    meanTurnLengthMm: 76,
    usableWindingWidthMm: 24.6,
    arUohm: 16.5,
    coreMassG: 74,
    thermalResistanceKPerW: 5,
    datasheetLossRefW: 7.1,
    datasheetLossRefFrequencyHz: 1e5,
    datasheetLossRefBT: 0.2,
    datasheetLossRefTemperatureC: 100
  }
];

// src/engine/assumptions.ts
function designQuestions(req) {
  const qs = [];
  if (req.topology === void 0) {
    qs.push({
      param: "topology",
      prompt: "\u539F\u8FB9\u62D3\u6251\u662F\u534A\u6865\u8FD8\u662F\u5168\u6865\uFF1F",
      options: ["\u534A\u6865", "\u5168\u6865"],
      default: "\u5168\u6865"
    });
  }
  if (req.vinNom === void 0 || req.vinMinNormal === void 0 || req.vinMax === void 0) {
    qs.push({
      param: "vinNom/vinMinNormal/vinMax",
      prompt: "\u6BCD\u7EBF\u7535\u538B\u8303\u56F4\u662F\u591A\u5C11\uFF1F\uFF08\u6807\u79F0/\u6700\u4F4E/\u6700\u9AD8\uFF0C\u5355\u4F4D V\uFF09",
      options: ["360\u2013420V\uFF08PFC \u524D\u7EA7\u5178\u578B\uFF0C\u6807\u79F0 400\uFF09", "380\u2013420V\uFF08\u7A84\u8303\u56F4\uFF0C\u6807\u79F0 400\uFF09", "\u81EA\u5B9A\u4E49\uFF08\u8BF7\u586B\u4E09\u4E2A\u6570\u5B57\uFF09"],
      default: "400 / 360 / 420 V"
    });
  }
  if (req.vinHoldEnd === void 0) {
    qs.push({
      param: "vinHoldEnd",
      prompt: '\u662F\u5426\u9700\u8981\u6389\u7535\u4FDD\u6301\uFF08hold-up\uFF09\u8BBE\u8BA1\uFF1F\u672B\u7AEF\u7535\u538B\u662F\u591A\u5C11 V\uFF1F\uFF08\u82E5\u65E0\u9700\u4FDD\u6301\u53EF\u56DE\u7B54"\u4E0D\u9700\u8981"\uFF09',
      options: ["\u9700\u8981\uFF0C300V", "\u9700\u8981\uFF0C330V", "\u4E0D\u9700\u8981\uFF08\u6309\u6B63\u5E38\u8303\u56F4\u8BBE\u8BA1\uFF09"],
      default: "300 V"
    });
  }
  if (req.k === void 0) {
    qs.push({
      param: "k",
      prompt: "\u7535\u611F\u6BD4 K = Lm/Lr \u53D6\u591A\u5C11\uFF1F\uFF08\u5F71\u54CD\u589E\u76CA\u5CF0\u503C\u4E0E\u78C1\u6027\u4F53\u79EF\uFF09",
      options: ["3\uFF08\u7A84\u589E\u76CA\u8303\u56F4/\u5C0F\u4F53\u79EF\uFF09", "5\uFF08\u6298\u4E2D\uFF0C\u9ED8\u8BA4\uFF09", "7\uFF08\u5BBD\u589E\u76CA/\u5927\u4F53\u79EF\uFF09"],
      default: "5"
    });
  }
  if (req.q === void 0) {
    qs.push({
      param: "q",
      prompt: "\u6EE1\u8F7D\u54C1\u8D28\u56E0\u6570 Q \u53D6\u591A\u5C11\uFF1F\uFF08\u5F71\u54CD\u589E\u76CA\u66F2\u7EBF\u5C16\u9510\u5EA6\uFF09",
      options: ["0.3\uFF08\u5E73\u7F13\uFF09", "0.35\uFF08\u6298\u4E2D\uFF0C\u9ED8\u8BA4\uFF09", "0.4\uFF08\u5C16\u9510\uFF09"],
      default: "0.35"
    });
  }
  if (req.corePreset === void 0) {
    qs.push({
      param: "corePreset",
      prompt: "\u4F7F\u7528\u54EA\u4E2A\u78C1\u82AF\uFF1F\uFF08\u7A97\u53E3/\u635F\u8017/\u6210\u672C\u6743\u8861\uFF0C\u4E5F\u53EF\u81EA\u52A8\u4ECE\u78C1\u82AF\u5E93\u641C\u7D22\uFF09",
      options: ["\u81EA\u52A8\u641C\u7D22\uFF08\u63A8\u8350\uFF09", "TDK PQ35/35 N87", "TDK PQ35/35 N97", "\u81EA\u5B9A\u4E49\uFF08\u8BF7\u586B\u578B\u53F7\u6216\u6570\u636E\u8868\u53C2\u6570\uFF09"],
      default: "\u81EA\u52A8\u641C\u7D22"
    });
  }
  return qs;
}
function tuneQuestions(req) {
  const qs = [];
  if (req.crossoverKhz === void 0) {
    qs.push({
      param: "crossoverKhz",
      prompt: "\u7535\u538B\u73AF\u76EE\u6807\u7A7F\u8D8A\u9891\u7387\uFF08\u5E26\u5BBD\uFF09\u662F\u591A\u5C11 kHz\uFF1F\uFF08\u8D8A\u9AD8\u52A8\u6001\u8D8A\u5FEB\uFF0C\u4F46\u53D7 plant \u76F8\u4F4D\u9650\u5236\uFF09",
      options: ["\u81EA\u52A8\uFF08fsw/20\uFF09", "0.5 kHz\uFF08\u4FDD\u5B88\uFF09", "1 kHz", "2.5 kHz\uFF08\u6FC0\u8FDB\uFF0C\u9700\u9A8C\u8BC1\uFF09"],
      default: "fsw/20\uFF08\u81EA\u52A8\uFF09"
    });
  }
  if (req.phaseMarginDeg === void 0) {
    qs.push({
      param: "phaseMarginDeg",
      prompt: "\u76EE\u6807\u76F8\u4F4D\u88D5\u5EA6\u662F\u591A\u5C11\u5EA6\uFF1F\uFF08\u51B3\u5B9A\u9636\u8DC3\u963B\u5C3C\uFF0C\u4E00\u822C 40~70\xB0\uFF09",
      options: ["40\xB0\uFF08\u5E26\u5BBD\u4F18\u5148\uFF09", "50\xB0\uFF08\u6298\u4E2D\uFF0C\u9ED8\u8BA4\uFF09", "60\xB0\uFF08\u963B\u5C3C\u4F18\u5148\uFF09"],
      default: "50\xB0"
    });
  }
  if (req.sampleTimeUs === void 0) {
    qs.push({
      param: "sampleTimeUs",
      prompt: "\u6570\u5B57\u63A7\u5236\u91C7\u6837\u5468\u671F\u662F\u591A\u5C11 \xB5s\uFF1F\uFF08\u4E0E\u5F00\u5173\u9891\u7387/ADC \u914D\u7F6E\u76F8\u5173\uFF09",
      options: ["10 \xB5s", "20 \xB5s\uFF08\u9ED8\u8BA4\uFF09", "\u81EA\u5B9A\u4E49"],
      default: "20 \xB5s"
    });
  }
  if (req.loadFraction === void 0) {
    qs.push({
      param: "loadFraction",
      prompt: "\u6574\u5B9A\u5DE5\u4F5C\u70B9\u53D6\u591A\u5927\u8D1F\u8F7D\uFF1F",
      options: ["\u6EE1\u8F7D\uFF081.0\uFF0C\u9ED8\u8BA4\uFF09", "\u534A\u8F7D\uFF080.5\uFF09", "\u6EE1\u8F7D+\u8F7B\u8F7D\u90FD\u9A8C\u8BC1"],
      default: "1.0\uFF08\u6EE1\u8F7D\uFF09"
    });
  }
  return qs;
}
function collectDesignAssumptions(req) {
  const questions = designQuestions(req);
  const assumed = [];
  if (req.vinNom === void 0) {
    assumed.push({ param: "vinNom", value: "400 V", why: "\u6807\u79F0\u6BCD\u7EBF\u7535\u538B" });
  }
  if (req.vinMinNormal === void 0) {
    assumed.push({ param: "vinMinNormal", value: "360 V", why: "\u6B63\u5E38\u6700\u4F4E\u6BCD\u7EBF\u7535\u538B" });
  }
  if (req.vinMax === void 0) {
    assumed.push({ param: "vinMax", value: "420 V", why: "\u6700\u9AD8\u6BCD\u7EBF\u7535\u538B" });
  }
  if (req.vinHoldEnd === void 0) {
    assumed.push({ param: "vinHoldEnd", value: "300 V", why: "\u6389\u7535\u4FDD\u6301\u672B\u7AEF\u7535\u538B" });
  }
  if (req.k === void 0) {
    assumed.push({ param: "k", value: "5 (Lm/Lr)", why: "\u7535\u611F\u6BD4" });
  }
  if (req.q === void 0) {
    assumed.push({ param: "q", value: "0.35", why: "\u6EE1\u8F7D\u54C1\u8D28\u56E0\u6570" });
  }
  if (req.corePreset === void 0) {
    assumed.push({ param: "corePreset", value: "\u81EA\u52A8\u641C\u7D22\uFF08\u78C1\u82AF\u5E93\uFF09", why: "\u78C1\u82AF\u9009\u578B" });
  }
  if (req.primaryTurns === void 0 || req.secondaryTurns === void 0) {
    assumed.push({ param: "primaryTurns/secondaryTurns", value: "\u81EA\u52A8\u531D\u6570\u641C\u7D22", why: "\u531D\u6570\u7531\u7B97\u6CD5\u786E\u5B9A" });
  }
  if (req.fminKhz === void 0) {
    assumed.push({ param: "fminKhz", value: "fr\xD70.6", why: "\u6700\u4F4E\u5F00\u5173\u9891\u7387" });
  }
  if (req.fmaxKhz === void 0) {
    assumed.push({ param: "fmaxKhz", value: "fr\xD71.8", why: "\u6700\u9AD8\u5F00\u5173\u9891\u7387" });
  }
  if (req.maxFluxDensityT === void 0) {
    assumed.push({ param: "maxFluxDensityT", value: "0.18 T", why: "\u6700\u5927\u78C1\u901A\u5BC6\u5EA6\u9650\u5236" });
  }
  if (req.ambientTempC === void 0) {
    assumed.push({ param: "ambientTempC", value: "45 \u2103", why: "\u73AF\u5883\u6E29\u5EA6" });
  }
  if (req.windingTempC === void 0) {
    assumed.push({ param: "windingTempC", value: "100 \u2103", why: "\u7ED5\u7EC4\u6E29\u5EA6" });
  }
  return { questions, assumed };
}
function collectTuneAssumptions(req) {
  const base = collectDesignAssumptions(req);
  const questions = [...base.questions, ...tuneQuestions(req)];
  const assumed = [...base.assumed];
  if (req.crossoverKhz === void 0) {
    assumed.push({ param: "crossoverKhz", value: "fsw/20\uFF08\u81EA\u52A8\uFF09", why: "\u76EE\u6807\u7A7F\u8D8A\u9891\u7387" });
  }
  if (req.phaseMarginDeg === void 0) {
    assumed.push({ param: "phaseMarginDeg", value: "50\xB0", why: "\u76EE\u6807\u76F8\u4F4D\u88D5\u5EA6" });
  }
  if (req.sampleTimeUs === void 0) {
    assumed.push({ param: "sampleTimeUs", value: "20 \xB5s", why: "\u63A7\u5236\u91C7\u6837\u5468\u671F" });
  }
  if (req.loadFraction === void 0) {
    assumed.push({ param: "loadFraction", value: "1.0\uFF08\u6EE1\u8F7D\uFF09", why: "\u6574\u5B9A\u8D1F\u8F7D\u70B9" });
  }
  return { questions, assumed };
}

// src/core/numeric.ts
var cplx = (re, im = 0) => ({ re, im });
var cAdd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
var cSub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
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
var cScale = (a, s) => ({ re: a.re * s, im: a.im * s });
var cInv = (a) => {
  const d = a.re * a.re + a.im * a.im;
  return { re: a.re / d, im: -a.im / d };
};
var LANCZOS_G = 7;
var LANCZOS_COEF = [
  0.9999999999998099,
  676.5203681218851,
  -1259.1392167224028,
  771.3234287776531,
  -176.6150291621406,
  12.507343278686905,
  -0.13857109526572012,
  9984369578019572e-21,
  15056327351493116e-23
];
function gamma(x) {
  if (x < 0.5) {
    return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
  }
  x -= 1;
  let a = LANCZOS_COEF[0];
  const t = x + LANCZOS_G + 0.5;
  for (let i = 1; i < LANCZOS_COEF.length; i++) {
    a += LANCZOS_COEF[i] / (x + i);
  }
  return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a;
}
function besselI(nu, z) {
  const absZ = cAbs(z);
  if (absZ > 18) {
    const argZ = Math.atan2(z.im, z.re);
    const eRe = Math.exp(z.re);
    const leadMag = eRe / Math.sqrt(2 * Math.PI * absZ);
    const leadPhase = z.im - argZ / 2;
    const leading = cplx(leadMag * Math.cos(leadPhase), leadMag * Math.sin(leadPhase));
    const corr = cSub(cplx(1, 0), cScale(cInv(z), (4 * nu * nu - 1) / 8));
    return cMul(leading, corr);
  }
  const halfZ = cScale(z, 0.5);
  const z2over4 = cMul(halfZ, halfZ);
  let term = cplx(1, 0);
  const powHalf = cplx(1, 0);
  let powZ;
  if (Math.abs(nu - Math.round(nu)) < 1e-12 && Math.round(nu) >= 0) {
    const n = Math.round(nu);
    let acc = cplx(1, 0);
    for (let i = 0; i < n; i++) acc = cMul(acc, halfZ);
    powZ = acc;
  } else {
    const mag = Math.pow(absZ / 2, nu);
    const arg = nu * Math.atan2(z.im, z.re);
    powZ = cplx(mag * Math.cos(arg), mag * Math.sin(arg));
  }
  let sum = cplx(0, 0);
  const MAX_K = 200;
  for (let k = 0; k < MAX_K; k++) {
    if (k > 0) {
      const denom = k * (nu + k);
      term = cDiv(cMul(term, z2over4), cplx(denom, 0));
    }
    sum = cAdd(sum, term);
    if (cAbs(term) < 1e-16 * cAbs(sum)) break;
  }
  return cMul(powZ, sum);
}
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
function fftComplex(input) {
  const n = input.length;
  if (n === 1) return [input[0]];
  if (n % 2 !== 0) throw new Error("fft: length must be a power of two");
  const even = new Array(n / 2);
  const odd = new Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    even[i] = input[2 * i];
    odd[i] = input[2 * i + 1];
  }
  const evenOut = fftComplex(even);
  const oddOut = fftComplex(odd);
  const out = new Array(n);
  for (let k = 0; k < n / 2; k++) {
    const angle = -2 * Math.PI * k / n;
    const tw = cplx(Math.cos(angle), Math.sin(angle));
    const t = cMul(tw, oddOut[k]);
    out[k] = cAdd(evenOut[k], t);
    out[k + n / 2] = cSub(evenOut[k], t);
  }
  return out;
}
function rfft(values) {
  const n = values.length;
  if (n === 1) return [{ re: values[0], im: 0 }];
  const full = fftComplex(values.map((v) => cplx(v, 0)));
  return full.slice(0, Math.floor(n / 2) + 1);
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
function roll(arr, shift) {
  const n = arr.length;
  if (n === 0) return [];
  const s = (shift % n + n) % n;
  return arr.slice(n - s).concat(arr.slice(0, n - s));
}
function mean(arr) {
  if (arr.length === 0) return 0;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}
function maxAbs(arr) {
  let m = 0;
  for (const v of arr) m = Math.max(m, Math.abs(v));
  return m;
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

// src/magnetics/litz.ts
var MU0 = 4e-7 * Math.PI;
var COPPER_RESISTIVITY_20 = 1724e-11;
var COPPER_ALPHA = 393e-5;
function makeLitzWire(strandCount, strandCopperDiameterM, strandOuterDiameterM, packingFactor, subBundleCount) {
  return {
    strandCount,
    strandCopperDiameterM,
    strandOuterDiameterM,
    packingFactor,
    subBundleCount,
    get copperAreaM2() {
      return this.strandCount * Math.PI * this.strandCopperDiameterM ** 2 / 4;
    },
    get copperAreaMm2() {
      return this.copperAreaM2 * 1e6;
    },
    get insulatedStrandAreaM2() {
      return this.strandCount * Math.PI * this.strandOuterDiameterM ** 2 / 4;
    },
    get envelopeAreaM2() {
      return Math.max(this.copperAreaM2 / this.packingFactor, this.insulatedStrandAreaM2 / 0.72);
    },
    get equivalentOuterDiameterM() {
      return 2 * Math.sqrt(this.envelopeAreaM2 / Math.PI);
    },
    get equivalentOuterDiameterMm() {
      return this.equivalentOuterDiameterM * 1e3;
    },
    get strandsPerSubBundle() {
      return Math.ceil(this.strandCount / Math.max(this.subBundleCount, 1));
    },
    get description() {
      if (this.subBundleCount <= 1) {
        return `${this.strandCount}\xD7${(this.strandCopperDiameterM * 1e3).toFixed(3)} mm`;
      }
      return `${this.subBundleCount} parallel sub-bundles \xD7 approximately ${this.strandsPerSubBundle}\xD7${(this.strandCopperDiameterM * 1e3).toFixed(3)} mm`;
    }
  };
}
function copperResistivity(temperatureC) {
  return COPPER_RESISTIVITY_20 * (1 + COPPER_ALPHA * (temperatureC - 20));
}
function skinDepthM(frequencyHz, temperatureC = 20) {
  if (frequencyHz <= 0) return Infinity;
  const rho = copperResistivity(temperatureC);
  return Math.sqrt(rho / (Math.PI * frequencyHz * MU0));
}
function roundWireSkinFactor(strandDiameterM, frequencyHz, temperatureC = 20) {
  if (frequencyHz <= 0) return 1;
  const radius = strandDiameterM / 2;
  const delta = skinDepthM(frequencyHz, temperatureC);
  const z = { re: radius / delta, im: radius / delta };
  if (Math.hypot(z.re, z.im) < 1e-4) {
    return 1 + (radius / delta) ** 4 / 48;
  }
  const ratio = cMul3(cScale2(z, 0.5), cDiv2(besselI(0, z), besselI(1, z)));
  return Math.max(1, ratio.re);
}
function dcResistanceOhm(wire, lengthM, temperatureC) {
  return copperResistivity(temperatureC) * lengthM / wire.copperAreaM2;
}
function fftRmsPhasors(waveform, maxHarmonic) {
  if (waveform.length < 32) throw new Error("waveform must contain at least 32 samples");
  const coeffs = rfft(waveform).map((c) => ({ re: c.re / waveform.length, im: c.im / waveform.length }));
  const phasors = [{ re: mean(waveform), im: 0 }];
  for (let harmonic = 1; harmonic <= maxHarmonic; harmonic++) {
    if (harmonic >= coeffs.length) {
      phasors.push({ re: 0, im: 0 });
    } else {
      phasors.push({ re: Math.SQRT2 * coeffs[harmonic].re, im: Math.SQRT2 * coeffs[harmonic].im });
    }
  }
  return phasors;
}
function transverseFieldLossPerStrandWPerM(strandDiameterM, frequencyHz, hRmsAPerM, temperatureC = 100) {
  if (frequencyHz <= 0 || hRmsAPerM <= 0) return 0;
  const rho = copperResistivity(temperatureC);
  const omega = 2 * Math.PI * frequencyHz;
  const bRms = MU0 * hRmsAPerM;
  const radius = strandDiameterM / 2;
  const lowFrequency = Math.PI * radius ** 4 * omega ** 2 * bRms ** 2 / (4 * rho);
  const penetration = roundWireSkinFactor(strandDiameterM, frequencyHz, temperatureC);
  return lowFrequency * Math.min(penetration, 8);
}
function windingLayers(turns, wire, windowWidthMm, turnSpacingMm = 0.15) {
  const pitch = wire.equivalentOuterDiameterMm + turnSpacingMm;
  const turnsPerLayer = Math.max(1, Math.floor(windowWidthMm / pitch));
  return [Math.ceil(turns / turnsPerLayer), turnsPerLayer];
}
function distributeTurns(turns, turnsPerLayer) {
  let remaining = turns;
  const result = [];
  while (remaining > 0) {
    const n = Math.min(remaining, turnsPerLayer);
    result.push(n);
    remaining -= n;
  }
  return result;
}
function layeredLitzStackLoss(layers, fundamentalFrequencyHz, windowWidthM, temperatureC = 100, options = {}) {
  const {
    maxHarmonic = 15,
    transpositionQuality = 0.9,
    subBundleCouplingFactor = 0.12,
    terminationResistanceFraction = 0.03,
    extraFieldHarmonicsAPerM = /* @__PURE__ */ new Map(),
    calibrationFactor = 1
  } = options;
  if (layers.length === 0) return /* @__PURE__ */ new Map();
  const sampleCount = layers[0].currentWaveformA.length;
  for (const layer of layers) {
    if (layer.currentWaveformA.length !== sampleCount) {
      throw new Error("all stack-layer waveforms must have equal length");
    }
  }
  if (windowWidthM <= 0) throw new Error("window width must be positive");
  const tq = Math.min(Math.max(transpositionQuality, 0), 1);
  const spectra = layers.map((layer) => {
    const phasors = fftRmsPhasors(layer.currentWaveformA, maxHarmonic);
    const rmsTotal = Math.sqrt(mean(layer.currentWaveformA.map((v) => v * v)));
    const rdc = dcResistanceOhm(layer.wire, layer.conductorLengthM, temperatureC);
    return { layer, currentPhasors: phasors, currentRmsTotal: rmsTotal, rdcOhm: rdc };
  });
  const labels = [...new Set(layers.map((l) => l.label))].sort();
  const accum = /* @__PURE__ */ new Map();
  for (const label of labels) {
    accum.set(label, { dc: 0, skin: 0, prox: 0, bundle: 0, term: 0, rmsSqLength: 0, rdcLoss: 0, harmonics: [] });
  }
  for (let harmonic = 0; harmonic <= maxHarmonic; harmonic++) {
    const frequency = harmonic * fundamentalFrequencyHz;
    const boundaryMmf = [{ re: 0, im: 0 }];
    for (const spectrum of spectra) {
      const iph = spectrum.currentPhasors[harmonic];
      const last = boundaryMmf[boundaryMmf.length - 1];
      boundaryMmf.push({ re: last.re + spectrum.layer.turns * iph.re, im: last.im + spectrum.layer.turns * iph.im });
    }
    for (let index = 0; index < spectra.length; index++) {
      const spectrum = spectra[index];
      const label = spectrum.layer.label;
      const item = accum.get(label);
      const current = spectrum.currentPhasors[harmonic];
      const iRms = Math.hypot(current.re, current.im);
      if (harmonic === 0) {
        const pDc = iRms ** 2 * spectrum.rdcOhm;
        item.dc += pDc;
        continue;
      }
      const h0 = { re: boundaryMmf[index].re / windowWidthM, im: boundaryMmf[index].im / windowWidthM };
      const h1 = { re: boundaryMmf[index + 1].re / windowWidthM, im: boundaryMmf[index + 1].im / windowWidthM };
      const h0sq = h0.re * h0.re + h0.im * h0.im;
      const h0h1real = h0.re * h1.re + h0.im * h1.im;
      const h1sq = h1.re * h1.re + h1.im * h1.im;
      const extra = extraFieldHarmonicsAPerM.get(harmonic) ?? 0;
      const hSq = (h0sq + h0h1real + h1sq) / 3 + extra * extra;
      const hRms = Math.sqrt(Math.max(hSq, 0));
      const pBase = iRms ** 2 * spectrum.rdcOhm;
      const skinFactor = roundWireSkinFactor(
        spectrum.layer.wire.strandCopperDiameterM,
        frequency,
        temperatureC
      );
      const pSkin = pBase * (skinFactor - 1);
      let pProx = transverseFieldLossPerStrandWPerM(
        spectrum.layer.wire.strandCopperDiameterM,
        frequency,
        hRms,
        temperatureC
      ) * spectrum.layer.wire.strandCount * spectrum.layer.conductorLengthM;
      const buildRatio = Math.max(1, spectrum.layer.wire.equivalentOuterDiameterM / spectrum.layer.wire.strandOuterDiameterM);
      const imperfection = (1 - tq) * Math.sqrt(buildRatio);
      const subBundle = Math.max(spectrum.layer.wire.subBundleCount - 1, 0);
      const pBundle = pProx * (subBundleCouplingFactor * imperfection * Math.log1p(subBundle));
      pProx *= calibrationFactor;
      const pBundleCal = pBundle * calibrationFactor;
      item.dc += pBase;
      item.skin += pSkin;
      item.prox += pProx;
      item.bundle += pBundleCal;
      item.harmonics.push({
        harmonic,
        frequencyHz: frequency,
        currentRmsA: iRms,
        fieldRmsAPerM: hRms,
        dcComponentW: pBase,
        skinIncrementW: pSkin,
        proximityW: pProx + pBundleCal
      });
    }
  }
  const results = /* @__PURE__ */ new Map();
  for (const label of labels) {
    const item = accum.get(label);
    const dc = item.dc;
    const skin = item.skin;
    const prox = item.prox;
    const bundle = item.bundle;
    const termination = terminationResistanceFraction * dc;
    const total = dc + skin + prox + bundle + termination;
    const first = spectra.find((s) => s.layer.label === label);
    const factor = dc > 0 ? total / dc : 1;
    results.set(label, {
      dcCopperW: dc,
      skinEffectW: skin,
      externalProximityW: prox,
      bundleCirculatingW: bundle,
      terminationW: termination,
      totalW: total,
      effectiveAcFactor: factor,
      currentRmsA: first.currentRmsTotal,
      harmonics: item.harmonics
    });
  }
  return results;
}
function cMul3(a, b) {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}
function cDiv2(a, b) {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}
function cScale2(a, s) {
  return { re: a.re * s, im: a.im * s };
}

// src/data/materials.ts
var MATERIALS = [
  {
    key: "TDK_N87_REF",
    manufacturer: "TDK/EPCOS",
    grade: "N87",
    muI25: 2200,
    bsatPoints: [[25, 0.49], [100, 0.39], [120, 0.36]],
    steinmetzPoints: [
      { temperatureC: 25, k: 3.7, alpha: 1.43, beta: 2.72 },
      { temperatureC: 60, k: 3.25, alpha: 1.43, beta: 2.72 },
      { temperatureC: 100, k: 3, alpha: 1.43, beta: 2.72 },
      { temperatureC: 120, k: 3.2, alpha: 1.43, beta: 2.72 }
    ],
    frequencyRangeHz: [2e4, 5e5],
    fluxRangeT: [0.02, 0.3],
    coreLossCorrection: 1
  },
  {
    key: "TDK_N97_REF",
    manufacturer: "TDK/EPCOS",
    grade: "N97",
    muI25: 2300,
    bsatPoints: [[25, 0.49], [100, 0.39], [120, 0.36]],
    steinmetzPoints: [
      { temperatureC: 25, k: 2.75, alpha: 1.45, beta: 2.7 },
      { temperatureC: 60, k: 2.35, alpha: 1.45, beta: 2.7 },
      { temperatureC: 100, k: 2.1, alpha: 1.45, beta: 2.7 },
      { temperatureC: 120, k: 2.3, alpha: 1.45, beta: 2.7 }
    ],
    frequencyRangeHz: [25e3, 5e5],
    fluxRangeT: [0.02, 0.3],
    coreLossCorrection: 1
  },
  {
    key: "FERROXCUBE_3C95_REF",
    manufacturer: "Ferroxcube",
    grade: "3C95",
    muI25: 3e3,
    bsatPoints: [[25, 0.5], [100, 0.4], [120, 0.37]],
    steinmetzPoints: [
      { temperatureC: 25, k: 2.6, alpha: 1.46, beta: 2.72 },
      { temperatureC: 60, k: 2.2, alpha: 1.46, beta: 2.72 },
      { temperatureC: 100, k: 2, alpha: 1.46, beta: 2.72 },
      { temperatureC: 120, k: 2.2, alpha: 1.46, beta: 2.72 }
    ],
    frequencyRangeHz: [25e3, 4e5],
    fluxRangeT: [0.02, 0.3],
    coreLossCorrection: 1
  },
  {
    key: "TDK_PC95_REF",
    manufacturer: "TDK",
    grade: "PC95-class",
    muI25: 3300,
    bsatPoints: [[25, 0.51], [100, 0.41], [120, 0.38]],
    steinmetzPoints: [
      { temperatureC: 25, k: 2.35, alpha: 1.48, beta: 2.7 },
      { temperatureC: 60, k: 2, alpha: 1.48, beta: 2.7 },
      { temperatureC: 100, k: 1.85, alpha: 1.48, beta: 2.7 },
      { temperatureC: 120, k: 2.05, alpha: 1.48, beta: 2.7 }
    ],
    frequencyRangeHz: [5e4, 5e5],
    fluxRangeT: [0.02, 0.25],
    coreLossCorrection: 1
  }
];

// src/magnetics/material.ts
function toCoreMaterial(rec) {
  return {
    key: rec.key,
    manufacturer: rec.manufacturer,
    grade: rec.grade,
    muI25: rec.muI25,
    bsatPoints: rec.bsatPoints.map((p) => [p[0], p[1]]),
    steinmetzPoints: rec.steinmetzPoints.map((p) => ({
      temperatureC: p.temperatureC,
      k: p.k,
      alpha: p.alpha,
      beta: p.beta
    })),
    frequencyRangeHz: [rec.frequencyRangeHz[0], rec.frequencyRangeHz[1]],
    fluxRangeT: [rec.fluxRangeT[0], rec.fluxRangeT[1]],
    coreLossCorrection: rec.coreLossCorrection
  };
}
function coefficientsAt(material, temperatureC) {
  const points = [...material.steinmetzPoints].sort((a, b) => a.temperatureC - b.temperatureC);
  const first = points[0];
  const last = points[points.length - 1];
  if (temperatureC <= first.temperatureC) return first;
  if (temperatureC >= last.temperatureC) return last;
  for (let i = 0; i < points.length - 1; i++) {
    const lo = points[i];
    const hi = points[i + 1];
    if (lo.temperatureC <= temperatureC && temperatureC <= hi.temperatureC) {
      const x = (temperatureC - lo.temperatureC) / (hi.temperatureC - lo.temperatureC);
      return {
        temperatureC,
        k: lo.k + x * (hi.k - lo.k),
        alpha: lo.alpha + x * (hi.alpha - lo.alpha),
        beta: lo.beta + x * (hi.beta - lo.beta)
      };
    }
  }
  return last;
}
function bsatAt(material, temperatureC) {
  const pts = [...material.bsatPoints].sort((a, b) => a[0] - b[0]);
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (temperatureC <= first[0]) return first[1];
  if (temperatureC >= last[0]) return last[1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [t0, b0] = pts[i];
    const [t1, b1] = pts[i + 1];
    if (t0 <= temperatureC && temperatureC <= t1) {
      return b0 + (temperatureC - t0) * (b1 - b0) / (t1 - t0);
    }
  }
  return last[1];
}
function igseDensityWM3(material, timeS, fluxDensityT, temperatureC) {
  const t = timeS;
  const b = fluxDensityT;
  if (t.length < 16 || t.length !== b.length) {
    throw new Error("time and B arrays must contain the same >=16 samples");
  }
  const dtSamples = t.slice(1).map((v, i) => v - t[i]);
  const period = t[t.length - 1] - t[0] + medianOf(dtSamples);
  if (period <= 0) throw new Error("waveform period must be positive");
  const deltaB = Math.max(...b) - Math.min(...b);
  if (deltaB <= 0) return 0;
  const dt = period / t.length;
  const rolled = roll(b, -1);
  const dbdt = b.map((v, i) => (rolled[i] - v) / dt);
  const c = coefficientsAt(material, temperatureC);
  const cosIntegral = 2 * Math.sqrt(Math.PI) * gamma((c.alpha + 1) / 2) / gamma((c.alpha + 2) / 2);
  const denominator = (2 * Math.PI) ** (c.alpha - 1) * 2 ** (c.beta - c.alpha) * cosIntegral;
  const kI = c.k / denominator;
  const meanRate = mean(dbdt.map((v) => Math.abs(v) ** c.alpha));
  return material.coreLossCorrection * kI * meanRate * deltaB ** (c.beta - c.alpha);
}
function medianOf(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}
function rangeWarnings(material, frequencyHz, bPeakT) {
  const warnings = [];
  const [f0, f1] = material.frequencyRangeHz;
  const [b0, b1] = material.fluxRangeT;
  if (!(f0 <= frequencyHz && frequencyHz <= f1)) {
    warnings.push(
      `frequency ${(frequencyHz / 1e3).toFixed(1)} kHz outside material fit range ${(f0 / 1e3).toFixed(1)}..${(f1 / 1e3).toFixed(1)} kHz`
    );
  }
  if (!(b0 <= bPeakT && bPeakT <= b1)) {
    warnings.push(`Bpk ${bPeakT.toFixed(3)} T outside material fit range ${b0.toFixed(3)}..${b1.toFixed(3)} T`);
  }
  return warnings;
}
var MaterialDatabase = class {
  materials;
  byKey = /* @__PURE__ */ new Map();
  constructor(records = MATERIALS) {
    this.materials = records.map(toCoreMaterial);
    for (const m of this.materials) {
      this.byKey.set(m.key.toLocaleLowerCase(), m);
      this.byKey.set(m.grade.toLocaleLowerCase(), m);
    }
  }
  get(key) {
    const hit = this.byKey.get(key.toLocaleLowerCase());
    if (!hit) throw new Error(`unknown material key: ${key}`);
    return hit;
  }
  all() {
    return this.materials;
  }
};

// src/magnetics/core.ts
function toCoreSpec(rec, material) {
  return {
    partNumber: rec.partNumber,
    shape: rec.shape,
    family: rec.family,
    manufacturer: rec.manufacturer,
    standard: rec.standard,
    materialKey: rec.materialKey,
    purposes: rec.purposes,
    aeMm2: rec.aeMm2,
    aminMm2: rec.aminMm2,
    awMm2: rec.awMm2,
    veMm3: rec.veMm3,
    leMm: rec.leMm,
    windowWidthMm: rec.windowWidthMm,
    windowHeightMm: rec.windowHeightMm,
    mltPrimaryMm: rec.mltPrimaryMm,
    mltSecondaryMm: rec.mltSecondaryMm,
    centerLegWidthMm: rec.centerLegWidthMm,
    thermalResistanceKPerW: rec.thermalResistanceKPerW,
    coreMassG: rec.coreMassG,
    costUsd: rec.costUsd,
    materialSpec: material,
    get material() {
      return this.materialSpec.grade;
    },
    get muR() {
      return this.materialSpec.muI25;
    },
    get bSatT() {
      return bsatAt(this.materialSpec, 100);
    },
    get aeM2() {
      return this.aeMm2 * 1e-6;
    },
    get aminM2() {
      return this.aminMm2 * 1e-6;
    },
    get veM3() {
      return this.veMm3 * 1e-9;
    },
    get leM() {
      return this.leMm * 1e-3;
    },
    get windowWidthM() {
      return this.windowWidthMm * 1e-3;
    }
  };
}
function coreLossWaveformW(core, timeS, fluxDensityT, temperatureC = 100) {
  return igseDensityWM3(core.materialSpec, timeS, fluxDensityT, temperatureC) * core.veM3;
}
function lossRangeWarnings(core, frequencyHz, bPeakT) {
  return rangeWarnings(core.materialSpec, frequencyHz, bPeakT);
}

// src/magnetics/magneticWaveforms.ts
function periodicTimebase(frequencyHz, samples = 2048) {
  const out = new Array(samples);
  for (let i = 0; i < samples; i++) out[i] = i / (samples * frequencyHz);
  return out;
}
function symmetricTriangle(samples, peak) {
  const out = new Array(samples);
  for (let i = 0; i < samples; i++) {
    const phase = i / samples;
    const unit = phase < 0.5 ? -1 + 4 * phase : 3 - 4 * phase;
    out[i] = peak * unit;
  }
  return out;
}
function transformerFluxWaveform(op, primaryTurns, effectiveAreaM2, samples = 2048) {
  const bPeak = op.transformerSquareEquivalentV / (4 * primaryTurns * effectiveAreaM2 * op.switchingFrequencyHz);
  return [periodicTimebase(op.switchingFrequencyHz, samples), symmetricTriangle(samples, bPeak)];
}
function transformerCurrentWaveforms(spec, op, samples = 2048) {
  const theta = new Array(samples);
  for (let i = 0; i < samples; i++) theta[i] = 2 * Math.PI * i / samples;
  const loadPrimary = theta.map((t) => Math.SQRT2 * op.reflectedLoadCurrentRmsA * Math.sin(t));
  const magPeak = Math.sqrt(3) * op.magnetizingCurrentRmsA;
  const magnetizing = roll(symmetricTriangle(samples, magPeak), Math.floor(samples / 4));
  let primary = loadPrimary.map((v, i) => v + magnetizing[i]);
  const primaryRms = Math.sqrt(mean(primary.map((v) => v * v)));
  if (primaryRms > 0) {
    const targetSq = op.resonantCurrentRmsA ** 2;
    const loadSq = op.reflectedLoadCurrentRmsA ** 2;
    const magTarget = Math.sqrt(Math.max(targetSq - loadSq, 0));
    const magNow = Math.sqrt(mean(magnetizing.map((v) => v * v)));
    if (magNow > 0) {
      const scale = magTarget / magNow;
      for (let i = 0; i < samples; i++) magnetizing[i] = magnetizing[i] * scale;
    }
    primary = loadPrimary.map((v, i) => v + magnetizing[i]);
  }
  const secondary = loadPrimary.map((v) => -spec.primaryTurns / spec.secondaryTurns * v);
  return [primary, secondary, magnetizing];
}

// src/magnetics/transformer.ts
var MU02 = 4e-7 * Math.PI;
function windingStack(design, spec, op) {
  const samples = spec.magneticWaveformSamples;
  const [primary, secondary] = transformerCurrentWaveforms(spec, op, samples);
  const p1Turns = Math.floor(design.primaryTurns / 2);
  const p2Turns = design.primaryTurns - p1Turns;
  const p1Layers = distributeTurns(p1Turns, design.primaryTurnsPerLayer);
  const p2Layers = distributeTurns(p2Turns, design.primaryTurnsPerLayer);
  const sLayers = distributeTurns(design.secondaryTurns, design.secondaryTurnsPerLayer);
  const stack = [];
  for (const turns of p1Layers) {
    stack.push({
      label: "primary",
      turns,
      conductorLengthM: turns * design.core.mltPrimaryMm * 1e-3,
      wire: design.primaryWire,
      currentWaveformA: primary
    });
  }
  for (const turns of sLayers) {
    stack.push({
      label: "secondary",
      turns,
      conductorLengthM: turns * design.core.mltSecondaryMm * 1e-3,
      wire: design.secondaryWire,
      currentWaveformA: secondary
    });
  }
  for (const turns of p2Layers) {
    stack.push({
      label: "primary",
      turns,
      conductorLengthM: turns * design.core.mltPrimaryMm * 1e-3,
      wire: design.primaryWire,
      currentWaveformA: primary
    });
  }
  return stack;
}
function lossAtTemperature(design, spec, op, temperatureC) {
  const [t, b] = transformerFluxWaveform(op, design.primaryTurns, design.core.aeM2, spec.magneticWaveformSamples);
  const bPeak = Math.max(maxAbs(b));
  const bPeakMin = bPeak * design.core.aeM2 / design.core.aminM2;
  const pCore = coreLossWaveformW(design.core, t, b, temperatureC);
  const stackLoss = layeredLitzStackLoss(
    windingStack(design, spec, op),
    op.switchingFrequencyHz,
    design.core.windowWidthM,
    temperatureC,
    {
      maxHarmonic: spec.litzMaxHarmonic,
      transpositionQuality: spec.litzTranspositionQuality,
      subBundleCouplingFactor: spec.litzSubBundleCouplingFactor,
      terminationResistanceFraction: spec.windingTerminationResistanceFraction,
      calibrationFactor: spec.litzProximityCorrection * spec.transformerProximitySeverity
    }
  );
  return {
    pCore,
    primary: stackLoss.get("primary"),
    secondary: stackLoss.get("secondary"),
    bPeak,
    bPeakMin,
    warnings: lossRangeWarnings(design.core, op.switchingFrequencyHz, bPeak)
  };
}
function transformerLoss(design, spec, op) {
  let temperature = Math.max(spec.windingTemperatureC, spec.ambientTemperatureC);
  let last = null;
  for (let i = 0; i < spec.magneticThermalMaxIterations; i++) {
    last = lossAtTemperature(design, spec, op, temperature);
    const predicted = spec.ambientTemperatureC + (last.pCore + last.primary.totalW + last.secondary.totalW) * spec.transformerRthKPerW;
    const clamped = Math.min(Math.max(predicted, spec.ambientTemperatureC), 220);
    const updated = 0.55 * temperature + 0.45 * clamped;
    if (Math.abs(updated - temperature) <= spec.magneticThermalToleranceC) {
      temperature = updated;
      break;
    }
    temperature = updated;
  }
  if (last === null) last = lossAtTemperature(design, spec, op, temperature);
  const pCore = last.pCore;
  const primary = last.primary;
  const secondary = last.secondary;
  const total = pCore + primary.totalW + secondary.totalW;
  return {
    coreW: pCore,
    primaryCopperW: primary.totalW,
    secondaryCopperW: secondary.totalW,
    totalW: total,
    bPeakT: last.bPeak,
    primaryAcFactor: primary.effectiveAcFactor,
    secondaryAcFactor: secondary.effectiveAcFactor,
    bPeakMinAreaT: last.bPeakMin,
    primaryDcW: primary.dcCopperW,
    primarySkinW: primary.skinEffectW,
    primaryProximityW: primary.externalProximityW,
    primaryBundleW: primary.bundleCirculatingW,
    primaryTerminationW: primary.terminationW,
    secondaryDcW: secondary.dcCopperW,
    secondarySkinW: secondary.skinEffectW,
    secondaryProximityW: secondary.externalProximityW,
    secondaryBundleW: secondary.bundleCirculatingW,
    secondaryTerminationW: secondary.terminationW,
    estimatedHotspotC: temperature,
    materialWarnings: last.warnings
  };
}

// src/magnetics/transformerDesigner.ts
function effectiveWindowHeightMm(core) {
  return core.windingAreaMm2 / Math.max(core.usableWindingWidthMm, 1e-9);
}
function toCoreSpecFromFerrite(core) {
  const material = new MaterialDatabase().get(core.materialKey);
  return toCoreSpec({
    partNumber: core.partNumber,
    shape: core.shape,
    family: core.shape.toUpperCase().startsWith("PQ") ? "PQ" : "CUSTOM",
    manufacturer: core.manufacturer,
    standard: core.shape,
    materialKey: core.materialKey,
    purposes: ["transformer"],
    aeMm2: core.aeMm2,
    aminMm2: core.aminMm2,
    awMm2: core.windingAreaMm2,
    veMm3: core.veMm3,
    leMm: core.leMm,
    windowWidthMm: core.usableWindingWidthMm,
    windowHeightMm: effectiveWindowHeightMm(core),
    mltPrimaryMm: core.meanTurnLengthMm,
    mltSecondaryMm: core.meanTurnLengthMm,
    centerLegWidthMm: 2 * Math.sqrt(Math.max(core.aminMm2, 1e-9) / Math.PI),
    thermalResistanceKPerW: core.thermalResistanceKPerW,
    coreMassG: core.coreMassG,
    costUsd: 0
  }, material);
}
var DEFAULT_SYNTHESIS_SETTINGS = {
  nominalTankGain: 1,
  maxFluxDensityT: 0.18,
  strandCopperDiameterMm: 0.1,
  strandOuterDiameterMm: 0.112,
  strandCountStep: 50,
  currentDensityTargetAPerMm2: 6,
  currentDensityMaxAPerMm2: 8,
  packingFactor: 0.55,
  maxFillFactor: 0.6,
  insulationAreaMm2: 28,
  windingLayout: "P/2-S-P/2",
  maxSecondaryTurnsSearch: 40,
  maxPrimaryTurnsSearch: 500,
  turnRatioTolerance: 0.04,
  workpointScope: "all"
};
function roundUpMultiple(value, step) {
  const s = Math.max(Math.trunc(step), 1);
  return Math.ceil(Math.max(Math.trunc(value), 1) / s) * s;
}
function selectDiscreteLitz(currentRmsA, settings) {
  const dM = settings.strandCopperDiameterMm * 1e-3;
  const doM = settings.strandOuterDiameterMm * 1e-3;
  const areaStrandMm2 = Math.PI * settings.strandCopperDiameterMm ** 2 / 4;
  const raw = Math.ceil(currentRmsA / Math.max(settings.currentDensityTargetAPerMm2 * areaStrandMm2, 1e-12));
  const count = roundUpMultiple(raw, settings.strandCountStep);
  const subBundles = Math.max(1, Math.ceil(count / 400));
  const wire = makeLitzWire(count, dM, doM, settings.packingFactor, subBundles);
  const density = currentRmsA / Math.max(wire.copperAreaMm2, 1e-12);
  const sel = {
    strandCount: count,
    strandDiameterMm: settings.strandCopperDiameterMm,
    strandOuterDiameterMm: settings.strandOuterDiameterMm,
    copperAreaMm2: wire.copperAreaMm2,
    equivalentOuterDiameterMm: wire.equivalentOuterDiameterMm,
    currentRmsA,
    currentDensityAPerMm2: density,
    parallelSubBundles: subBundles,
    strandsPerSubBundle: wire.strandsPerSubBundle,
    description: wire.description
  };
  return [wire, sel];
}
function workpointRequests(spec, scope) {
  if (scope === "nominal") return [[spec.vbusNomV, 1]];
  if (scope === "normal") {
    return [
      [spec.vbusMaxV, 1],
      [spec.vbusNomV, 1],
      [spec.vbusMinNormalV, 1],
      [spec.vbusNomV, 0.5],
      [spec.vbusNomV, 0.25],
      [spec.vbusNomV, 0.1]
    ];
  }
  return defaultWorkPoints(spec);
}
function defaultWorkPoints(spec) {
  return [
    [spec.vbusMaxV, 1],
    [spec.vbusNomV, 1],
    [spec.vbusMinNormalV, 1],
    [spec.vbusHoldEndV, 1],
    [spec.vbusNomV, 0.5],
    [spec.vbusNomV, 0.25],
    [spec.vbusNomV, 0.1]
  ];
}
function solveWorkpoints(spec, tank, scope) {
  const points = [];
  const errors = [];
  for (const [vbus, load] of workpointRequests(spec, scope)) {
    try {
      points.push(solveOperatingPoint(spec, tank, vbus, load));
    } catch (exc) {
      if (exc instanceof GainNotReachableError) {
        errors.push(`${vbus.toFixed(0)} V/${(load * 100).toFixed(0)}%: ${exc.message}`);
      } else {
        throw exc;
      }
    }
  }
  if (errors.length > 0) {
    throw new GainNotReachableError(errors.join("; "));
  }
  return points;
}
function candidateTurnPairs(spec, settings) {
  const vsec = spec.voutV + spec.rectifierEquivalentDropV;
  const targetRatio = bridgeGainOf(spec) * spec.vbusNomV * settings.nominalTankGain / Math.max(vsec, 1e-12);
  const out = [];
  for (let ns = 1; ns <= settings.maxSecondaryTurnsSearch; ns++) {
    const center = targetRatio * ns;
    for (const npRaw of [...new Set([-1, 0, 1].map((delta) => Math.max(1, Math.round(center) + delta)))].sort((a, b) => a - b)) {
      if (npRaw > settings.maxPrimaryTurnsSearch) continue;
      const error = Math.abs(npRaw / ns - targetRatio) / Math.max(targetRatio, 1e-12);
      if (error <= settings.turnRatioTolerance) {
        out.push([npRaw, ns, targetRatio]);
      }
    }
  }
  return out;
}
function estimateGapMm(core, primaryTurns, targetLmH) {
  const alTargetH = targetLmH / Math.max(primaryTurns ** 2, 1);
  const ungappedLmH = core.alNh * 1e-9 * primaryTurns ** 2;
  if (alTargetH <= 0) return [0, ungappedLmH, 0];
  const gM = MU02 * core.aeMm2 * 1e-6 / alTargetH - core.leMm * 1e-3 / Math.max(core.muE, 1);
  return [Math.max(gM, 0) * 1e3, ungappedLmH, alTargetH * 1e9];
}
function bridgeGainOf(spec) {
  return spec.primaryTopology === "FULL_BRIDGE" ? 1 : 0.5;
}
function synthesizeTransformer(baseSpec, coreInput, settings) {
  const s = settings ?? DEFAULT_SYNTHESIS_SETTINGS;
  const core = toCoreSpecFromFerrite(coreInput);
  const candidateRecords = [];
  const solveNotes = [];
  for (const [np, ns, targetRatio2] of candidateTurnPairs(baseSpec, s)) {
    const spec2 = cloneSpec(baseSpec, { primaryTurns: np, secondaryTurns: ns });
    const tank2 = designTank(spec2);
    let ops2;
    try {
      ops2 = solveWorkpoints(spec2, tank2, s.workpointScope);
    } catch (exc) {
      if (exc instanceof GainNotReachableError) {
        if (solveNotes.length < 6) solveNotes.push(exc.message);
        continue;
      }
      throw exc;
    }
    const bValues = ops2.map((op) => op.transformerSquareEquivalentV / (4 * np * core.aminM2 * op.switchingFrequencyHz));
    const worstB2 = Math.max(...bValues);
    if (worstB2 > s.maxFluxDensityT * 1.2) {
      continue;
    }
    const ratioErr = Math.abs(np / ns - targetRatio2) / targetRatio2;
    const fluxPenalty = Math.max(0, worstB2 / s.maxFluxDensityT - 1);
    const score = np + 0.35 * ns + 250 * ratioErr + 1e3 * fluxPenalty;
    candidateRecords.push({ score, spec: spec2, tank: tank2, ops: ops2, worstB: worstB2 });
  }
  if (candidateRecords.length === 0) {
    const detail = solveNotes[0] ?? "no turn pair satisfied the search constraints";
    throw new Error(`automatic transformer turn search failed: ${detail}`);
  }
  candidateRecords.sort((a, b) => a.score - b.score);
  const best = candidateRecords[0];
  const { spec, tank, ops, worstB } = best;
  const maxIp = Math.max(...ops.map((op) => op.resonantCurrentRmsA));
  const maxIs = Math.max(...ops.map((op) => op.secondaryCurrentRmsA));
  const [pWire, pSel] = selectDiscreteLitz(maxIp, s);
  const [sWire, sSel] = selectDiscreteLitz(maxIs, s);
  const halfTurns = Math.ceil(spec.primaryTurns / 2);
  const [pLayers, pTpl] = windingLayers(halfTurns, pWire, core.windowWidthMm);
  const [sLayers, sTpl] = windingLayers(spec.secondaryTurns, sWire, core.windowWidthMm);
  const fillArea = spec.primaryTurns * pWire.envelopeAreaM2 * 1e6 + spec.secondaryTurns * sWire.envelopeAreaM2 * 1e6 + s.insulationAreaMm2;
  const fillFactor = fillArea / Math.max(coreInput.windingAreaMm2, 1e-9);
  const radialBuild = 2 * pLayers * pWire.equivalentOuterDiameterMm + sLayers * sWire.equivalentOuterDiameterMm + 1.2;
  const lengthP = spec.primaryTurns * coreInput.meanTurnLengthMm * 1e-3;
  const lengthS = spec.secondaryTurns * coreInput.meanTurnLengthMm * 1e-3;
  const rdcP = dcResistanceOhm(pWire, lengthP, spec.windingTemperatureC);
  const rdcS = dcResistanceOhm(sWire, lengthS, spec.windingTemperatureC);
  const [gapMm, ungappedLmH, targetAlNh] = estimateGapMm(coreInput, spec.primaryTurns, tank.lmH);
  const transformer = {
    core,
    primaryTurns: spec.primaryTurns,
    secondaryTurns: spec.secondaryTurns,
    primaryWire: pWire,
    secondaryWire: sWire,
    primaryLayersPerHalf: pLayers,
    secondaryLayers: sLayers,
    primaryTurnsPerLayer: pTpl,
    secondaryTurnsPerLayer: sTpl,
    fillFactor,
    radialBuildMm: radialBuild,
    gapTotalMm: gapMm,
    primaryRdcOhm: rdcP,
    secondaryRdcOhm: rdcS,
    worstBPeakT: worstB,
    feasible: true,
    reasons: [],
    alternatives: []
  };
  const nominalOp = ops.reduce((bestOp, op) => Math.abs(op.vbusV - spec.vbusNomV) + 100 * Math.abs(op.loadFraction - 1) < Math.abs(bestOp.vbusV - spec.vbusNomV) + 100 * Math.abs(bestOp.loadFraction - 1) ? op : bestOp);
  const nominalLoss = transformerLoss(transformer, spec, nominalOp);
  const workpoints = ops.map((op) => {
    const loss = transformerLoss(transformer, spec, op);
    return {
      vbusV: op.vbusV,
      loadFraction: op.loadFraction,
      switchingFrequencyHz: op.switchingFrequencyHz,
      bPeakT: loss.bPeakMinAreaT,
      primaryRmsA: op.resonantCurrentRmsA,
      secondaryRmsA: op.secondaryCurrentRmsA,
      coreLossW: loss.coreW,
      primaryCopperW: loss.primaryCopperW,
      secondaryCopperW: loss.secondaryCopperW,
      totalTransformerLossW: loss.totalW,
      inputPhaseDeg: op.inputPhaseDeg,
      commutationCurrentA: op.commutationCurrentA,
      availableGainMin: op.availableGainMin,
      availableGainMax: op.availableGainMax
    };
  });
  const reasons = [];
  const warnings = [];
  if (worstB > s.maxFluxDensityT) {
    reasons.push(`worst Bpk ${worstB.toFixed(3)} T exceeds design limit ${s.maxFluxDensityT.toFixed(3)} T`);
  }
  if (pSel.currentDensityAPerMm2 > s.currentDensityMaxAPerMm2) {
    reasons.push("primary Litz current density exceeds maximum");
  }
  if (sSel.currentDensityAPerMm2 > s.currentDensityMaxAPerMm2) {
    reasons.push("secondary Litz current density exceeds maximum");
  }
  if (fillFactor > s.maxFillFactor) {
    reasons.push(`window fill ${fillFactor.toFixed(3)} exceeds ${s.maxFillFactor.toFixed(3)}`);
  }
  if (radialBuild > core.windowHeightMm) {
    warnings.push(
      `round-bundle radial-build screen ${radialBuild.toFixed(2)} mm exceeds equivalent window height ${core.windowHeightMm.toFixed(2)} mm; consider parallel/flattened Litz bundles and verify the bobbin drawing`
    );
  }
  if (gapMm <= 0 && tank.lmH > ungappedLmH) {
    reasons.push("target Lm is higher than the ungapped AL estimate");
  }
  if (gapMm > 5) {
    warnings.push(`estimated total gap is large (${gapMm.toFixed(2)} mm); verify fringing/leakage`);
  }
  warnings.push(...nominalLoss.materialWarnings);
  warnings.push(
    "Core-loss calculation uses the bundled iGSE material reference fit.  The datasheet single-point Pv value is shown for cross-checking, not used as a full loss surface."
  );
  const targetRatio = bridgeGainOf(spec) * spec.vbusNomV * s.nominalTankGain / (spec.voutV + spec.rectifierEquivalentDropV);
  const actualRatio = spec.primaryTurns / spec.secondaryTurns;
  return {
    core: coreInput,
    settings: s,
    spec,
    tank,
    primaryTurns: spec.primaryTurns,
    secondaryTurns: spec.secondaryTurns,
    targetTurnsRatio: targetRatio,
    actualTurnsRatio: actualRatio,
    turnsRatioErrorPct: 100 * (actualRatio - targetRatio) / targetRatio,
    targetLmUh: tank.lmH * 1e6,
    ungappedLmUh: ungappedLmH * 1e6,
    targetAlNh,
    estimatedGapMm: gapMm,
    primaryLitz: pSel,
    secondaryLitz: sSel,
    primaryLayersPerHalf: pLayers,
    secondaryLayers: sLayers,
    primaryTurnsPerLayer: pTpl,
    secondaryTurnsPerLayer: sTpl,
    fillFactor,
    radialBuildMm: radialBuild,
    primaryRdcMohm: rdcP * 1e3,
    secondaryRdcMohm: rdcS * 1e3,
    worstBPeakT: worstB,
    nominalLoss,
    workpoints,
    feasible: reasons.length === 0,
    warnings: [...new Set(warnings)],
    reasons
  };
}

// src/engine/index.ts
function resolveCorePreset(key) {
  if (key) {
    const hit = CORE_PRESETS.find((p) => p.presetKey === key);
    if (hit) return hit;
    throw new Error(
      `unknown core preset '${key}'. Available: ${CORE_PRESETS.map((p) => p.presetKey).join(", ")}`
    );
  }
  return CORE_PRESETS[0];
}
function buildSpec(request) {
  const topology = request.topology === "half-bridge" ? "HALF_BRIDGE" : "FULL_BRIDGE";
  const frHz = request.frKhz * 1e3;
  const fminHz = (request.fminKhz ?? request.frKhz * 0.6) * 1e3;
  const fmaxHz = (request.fmaxKhz ?? request.frKhz * 1.8) * 1e3;
  return {
    ...DEFAULT_SPEC,
    vbusNomV: request.vinNom ?? DEFAULT_SPEC.vbusNomV,
    vbusMinNormalV: request.vinMinNormal ?? DEFAULT_SPEC.vbusMinNormalV,
    vbusMaxV: request.vinMax ?? DEFAULT_SPEC.vbusMaxV,
    vbusHoldEndV: request.vinHoldEnd ?? DEFAULT_SPEC.vbusHoldEndV,
    voutV: request.vout,
    poutW: request.pout,
    primaryTopology: topology,
    resonantFrequencyHz: frHz,
    minimumFrequencyHz: fminHz,
    maximumFrequencyHz: fmaxHz,
    lnRatio: request.k ?? DEFAULT_SPEC.lnRatio,
    qFullLoad: request.q ?? DEFAULT_SPEC.qFullLoad,
    rectifierEquivalentDropV: request.rectifierDropV ?? DEFAULT_SPEC.rectifierEquivalentDropV,
    primaryTurns: request.primaryTurns ?? DEFAULT_SPEC.primaryTurns,
    secondaryTurns: request.secondaryTurns ?? DEFAULT_SPEC.secondaryTurns,
    outputCapacitanceF: (request.outputCapF ?? DEFAULT_SPEC.outputCapacitanceF * 1e6) * 1e-6,
    outputCapEsrOhm: (request.outputCapEsrMohm ?? DEFAULT_SPEC.outputCapEsrOhm * 1e3) * 1e-3,
    ambientTemperatureC: request.ambientTempC ?? DEFAULT_SPEC.ambientTemperatureC,
    windingTemperatureC: request.windingTempC ?? DEFAULT_SPEC.windingTemperatureC
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
    const ir = cDiv3(vb, cAdd2(zSeries, zParallel));
    const vp = cMul4(ir, zParallel);
    const im = cDiv3(vp, zLm);
    const vcr = cDiv3(ir, cplx2(0, omega * this.p.crF));
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
function cMul4(a, b) {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}
function cDiv3(a, b) {
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

// src/control/digitalLoop.ts
function pwmFrequencyDivisor(mode) {
  return mode === "up" ? 1 : 2;
}
function makePiConfig(kp = 0.01, tiS = 1e-3, sampleTimeS = 2e-5, outputMin = 0, outputMax = 1) {
  return { kp, tiS, sampleTimeS, outputMin, outputMax, kind: "pi" };
}
function makePifConfig(kp = 0.01, tiS = 1e-3, lpfCutoffHz = 3500, sampleTimeS = 2e-5, outputMin = 0, outputMax = 1) {
  return { kp, tiS, lpfCutoffHz, sampleTimeS, outputMin, outputMax, kind: "pif" };
}
function controllerKind(config) {
  return config.kind;
}
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
function twoP2ZFromAnalogPolesZeros(options) {
  const { gain: gain2, zerosHz, polesHz, sampleTimeS, outputMin = 0, outputMax = 1 } = options;
  if (zerosHz.length !== 2 || polesHz.length !== 2) {
    throw new Error("2P2Z analog design requires exactly two poles and two zeros");
  }
  const zerosRad = zerosHz.map((v) => -2 * Math.PI * v);
  const polesRad = polesHz.map((v) => -2 * Math.PI * v);
  const numS = polyFromRoots(zerosRad).map((v) => v * gain2);
  const denS = polyFromRoots(polesRad);
  const { numZ, denZ } = cont2discreteBilinear(numS, denS, sampleTimeS);
  let num = numZ;
  let den = denZ;
  num = num.map((v) => v / den[0]);
  den = den.map((v) => v / den[0]);
  const pad3 = (arr) => {
    const out = new Array(3).fill(0);
    for (let i = 0; i < Math.min(3, arr.length); i++) out[i] = arr[i];
    return out;
  };
  const bn = pad3(num);
  const dn = pad3(den);
  return {
    b0: bn[0],
    b1: bn[1],
    b2: bn[2],
    a1: dn[1],
    a2: dn[2],
    sampleTimeS,
    outputMin,
    outputMax,
    kind: "2p2z"
  };
}
function polyFromRoots(rootsIn) {
  let coeffs = [1];
  for (const root of rootsIn) {
    const next = new Array(coeffs.length + 1).fill(0);
    for (let i = 0; i < coeffs.length; i++) {
      next[i] += coeffs[i];
      next[i + 1] += -root * coeffs[i];
    }
    coeffs = next;
  }
  return coeffs;
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
function makeFmLut(pcmd, values, mode = "pcmd_to_tbprd", timerClockHz = 12e7, countMode = "up_down", name = "PCMD-FM-LUT") {
  if (pcmd.length < 2 || pcmd.length !== values.length) {
    throw new Error("FM LUT requires two or more PCMD/value pairs");
  }
  for (let i = 1; i < pcmd.length; i++) {
    if (pcmd[i] <= pcmd[i - 1]) throw new Error("FM LUT PCMD values must be strictly increasing");
  }
  if (pcmd[0] > 0 || pcmd[pcmd.length - 1] < 1) {
    throw new Error("FM LUT must cover the complete normalized PCMD range 0..1");
  }
  if (values.some((v) => v <= 0)) throw new Error("FM LUT values must be positive");
  if (timerClockHz <= 0) throw new Error("PWM timer clock must be positive");
  return { pcmd, values, mode, timerClockHz, countMode, name };
}
function fmLutFirmwareDefault() {
  return makeFmLut(
    [0, 0.04, 0.08, 0.12, 0.16, 0.2, 0.25, 0.3, 0.355, 0.41, 0.465, 0.52, 0.5825, 0.645, 0.7075, 0.77, 0.8275, 0.885, 0.9425, 1],
    [240, 258, 279, 303, 332, 367, 424, 500, 533, 571, 615, 667, 706, 750, 800, 811, 822, 833, 845, 857],
    "pcmd_to_tbprd",
    12e7,
    "up_down",
    "firmware-20-point-PCMD-TBPRD"
  );
}
function fmSegmentIndex(lut, command, side = "auto") {
  const c = Math.min(Math.max(command, lut.pcmd[0]), lut.pcmd[lut.pcmd.length - 1]);
  const exact = lut.pcmd.findIndex((p) => Math.abs(p - c) <= 1e-12);
  if (exact >= 0) {
    if (side === "left") return Math.max(0, exact - 1);
    if (side === "right") return Math.min(lut.pcmd.length - 2, exact);
    return Math.max(0, Math.min(lut.pcmd.length - 2, exact - 1));
  }
  return Math.max(0, Math.min(searchsorted(lut.pcmd, c) - 1, lut.pcmd.length - 2));
}
function fmValue(lut, command) {
  const c = Math.min(Math.max(command, lut.pcmd[0]), lut.pcmd[lut.pcmd.length - 1]);
  return interp(c, lut.pcmd, lut.values);
}
function fmTbprd(lut, command) {
  if (lut.mode === "pcmd_to_tbprd") return fmValue(lut, command);
  const freq = fmValue(lut, command);
  return lut.timerClockHz / (pwmFrequencyDivisor(lut.countMode) * freq);
}
function fmFrequencyHz(lut, command) {
  if (lut.mode === "pcmd_to_frequency") return fmValue(lut, command);
  const tbprd = fmValue(lut, command);
  return lut.timerClockHz / (pwmFrequencyDivisor(lut.countMode) * tbprd);
}
function fmCommandForFrequency(lut, frequencyHz) {
  const frequencies = lut.pcmd.map((v) => fmFrequencyHz(lut, v));
  let monoInc = true;
  let monoDec = true;
  for (let i = 1; i < frequencies.length; i++) {
    if (frequencies[i] <= frequencies[i - 1]) monoInc = false;
    if (frequencies[i] >= frequencies[i - 1]) monoDec = false;
  }
  if (monoDec) return interp(frequencyHz, [...frequencies].reverse(), [...lut.pcmd].reverse());
  if (monoInc) return interp(frequencyHz, frequencies, lut.pcmd);
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < frequencies.length; i++) {
    const d = Math.abs(frequencies[i] - frequencyHz);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return lut.pcmd[best];
}
function fmLocalGainHzPerPu(lut, command, side = "auto") {
  const index = fmSegmentIndex(lut, command, side);
  const dp = lut.pcmd[index + 1] - lut.pcmd[index];
  const slopeValue = (lut.values[index + 1] - lut.values[index]) / dp;
  if (lut.mode === "pcmd_to_frequency") return slopeValue;
  const tbprd = fmTbprd(lut, command);
  return -lut.timerClockHz / (pwmFrequencyDivisor(lut.countMode) * tbprd ** 2) * slopeValue;
}
function evaluateFmOperatingPoint(lut, options) {
  const command = options.commandPu !== void 0 ? Math.min(Math.max(options.commandPu, 0), 1) : fmCommandForFrequency(lut, options.switchingFrequencyHz);
  return {
    commandPu: command,
    frequencyHz: fmFrequencyHz(lut, command),
    tbprdCounts: fmTbprd(lut, command),
    gainHzPerPu: fmLocalGainHzPerPu(lut, command),
    leftGainHzPerPu: fmLocalGainHzPerPu(lut, command, "left"),
    rightGainHzPerPu: fmLocalGainHzPerPu(lut, command, "right"),
    commandHeadroomLow: command,
    commandHeadroomHigh: 1 - command
  };
}
function makeAnalogSenseConfig(overrides = {}) {
  return {
    rupOhm: 117e3,
    rlowOhm: 1600,
    dividerCapacitanceF: 1e-9,
    opampGain: 1,
    opampBandwidthHz: 0,
    adcSeriesResistanceOhm: 220,
    adcShuntCapacitanceF: 2e-9,
    normalizeToEngineeringUnits: true,
    calibrationGain: null,
    ...overrides
  };
}
function analogDividerGain(c) {
  return c.rlowOhm / (c.rupOhm + c.rlowOhm);
}
function analogDividerTheveninOhm(c) {
  return c.rupOhm * c.rlowOhm / (c.rupOhm + c.rlowOhm);
}
function analogEffectiveCalibrationGain(c) {
  if (c.calibrationGain !== null) return c.calibrationGain;
  if (c.normalizeToEngineeringUnits) return 1 / (analogDividerGain(c) * c.opampGain);
  return 1;
}
function analogFrequencyResponseComponents(c, frequenciesHz) {
  const dividerGain = analogDividerGain(c);
  const dividerThevenin = analogDividerTheveninOhm(c);
  const calGain = analogEffectiveCalibrationGain(c);
  const divider = [];
  const opamp = [];
  const adcRc = [];
  const raw = [];
  const calibrated = [];
  for (const f of frequenciesHz) {
    const s = { re: 0, im: 2 * Math.PI * f };
    let dv = { re: dividerGain, im: 0 };
    if (c.dividerCapacitanceF > 0) {
      dv = cDiv4(dv, cAdd3(cplx3(1, 0), cMulS(s, dividerThevenin * c.dividerCapacitanceF)));
    }
    let oa = { re: c.opampGain, im: 0 };
    if (c.opampBandwidthHz > 0) {
      oa = cDiv4(oa, cAdd3(cplx3(1, 0), cMulS(s, 1 / (2 * Math.PI * c.opampBandwidthHz))));
    }
    let rc = { re: 1, im: 0 };
    if (c.adcSeriesResistanceOhm > 0 && c.adcShuntCapacitanceF > 0) {
      rc = cDiv4(rc, cAdd3(cplx3(1, 0), cMulS(s, c.adcSeriesResistanceOhm * c.adcShuntCapacitanceF)));
    }
    const rawV = cMul5(cMul5(dv, oa), rc);
    divider.push(dv);
    opamp.push(oa);
    adcRc.push(rc);
    raw.push(rawV);
    calibrated.push(cMulS(rawV, calGain));
  }
  return { divider, opamp, adcRc, rawAnalog: raw, calibratedAnalog: calibrated };
}
function analogNormalizedContinuousTf(c) {
  const gain2 = analogDividerGain(c) * c.opampGain * analogEffectiveCalibrationGain(c);
  let numerator = [gain2];
  let denominator = [1];
  const taus = [
    analogDividerTheveninOhm(c) * c.dividerCapacitanceF,
    c.opampBandwidthHz > 0 ? 1 / (2 * Math.PI * c.opampBandwidthHz) : 0,
    c.adcSeriesResistanceOhm * c.adcShuntCapacitanceF
  ];
  for (const tau of taus) {
    if (tau > 0) {
      denominator = polyConvolve(denominator, [tau, 1]);
    }
  }
  return [numerator, denominator];
}
function makeAdcSamplingConfig(overrides = {}) {
  return {
    controlSampleTimeS: 2e-5,
    adcClockHz: 6e7,
    acquisitionTimeS: 3e-7,
    conversionCycles: 13,
    socCount: 3,
    recursivePreviousWeight: 0.25,
    socSampleOffsetsS: null,
    ...overrides
  };
}
function adcConversionTimeS(c) {
  return c.conversionCycles / c.adcClockHz;
}
function adcSocSlotTimeS(c) {
  return c.acquisitionTimeS + adcConversionTimeS(c);
}
function adcSampleOffsetsS(c) {
  if (c.socSampleOffsetsS !== null) return c.socSampleOffsetsS;
  return Array.from({ length: c.socCount }, (_, i) => i * adcSocSlotTimeS(c) + 0.5 * c.acquisitionTimeS);
}
function adcEocDelayS(c) {
  if (c.socSampleOffsetsS !== null) {
    return Math.max(...adcSampleOffsetsS(c)) + 0.5 * c.acquisitionTimeS + adcConversionTimeS(c);
  }
  return c.socCount * adcSocSlotTimeS(c);
}
function adcCurrentSampleWeight(c) {
  return (1 - c.recursivePreviousWeight) / c.socCount;
}
function adcEffectiveSampleOffsetS(c) {
  const offsets = adcSampleOffsetsS(c);
  return offsets.reduce((a, b) => a + b, 0) / offsets.length;
}
function adcFrequencyResponse(c, frequenciesHz) {
  const offsets = adcSampleOffsetsS(c);
  const weight = adcCurrentSampleWeight(c);
  return frequenciesHz.map((f) => {
    const omega = 2 * Math.PI * f;
    const aperture = sinc(f * c.acquisitionTimeS);
    let re = 0;
    let im = 0;
    for (const offset of offsets) {
      const ph = omega * offset;
      re += weight * aperture * Math.cos(ph);
      im += weight * aperture * Math.sin(ph);
    }
    const zInvRe = Math.cos(-omega * c.controlSampleTimeS);
    const zInvIm = Math.sin(-omega * c.controlSampleTimeS);
    const denRe = 1 - c.recursivePreviousWeight * zInvRe;
    const denIm = -c.recursivePreviousWeight * zInvIm;
    const d2 = denRe * denRe + denIm * denIm;
    return {
      re: (re * denRe + im * denIm) / d2,
      im: (im * denRe - re * denIm) / d2
    };
  });
}
function adcSimplifiedDigitalFilter(c) {
  return new DigitalTransferFunction(
    [1 - c.recursivePreviousWeight],
    [1, -c.recursivePreviousWeight],
    c.controlSampleTimeS,
    "ADC-recursive-average(z)",
    "sampled_voltage",
    "measured_voltage"
  );
}
function makeCommandTimingConfig(overrides = {}) {
  return { computationDelayS: 1e-6, includeZeroOrderHold: true, ...overrides };
}
function pwmZeroWaitS(switchingFrequencyHz, envelope) {
  if (switchingFrequencyHz <= 0) throw new Error("switching frequency must be positive");
  const period = 1 / switchingFrequencyHz;
  if (envelope === "minimum") return 0;
  if (envelope === "maximum") return period;
  return 0.5 * period;
}
function applicationDelayS(c, adc, switchingFrequencyHz, envelope) {
  return adcEocDelayS(adc) + c.computationDelayS + pwmZeroWaitS(switchingFrequencyHz, envelope);
}
function commandTimingFrequencyResponse(c, adc, switchingFrequencyHz, envelope, frequenciesHz) {
  const delay = applicationDelayS(c, adc, switchingFrequencyHz, envelope);
  return frequenciesHz.map((f) => {
    const omega = 2 * Math.PI * f;
    let re = Math.cos(-omega * delay);
    let im = Math.sin(-omega * delay);
    if (c.includeZeroOrderHold) {
      const zohMag = sinc(f * adc.controlSampleTimeS);
      const zohPhase = -omega * 0.5 * adc.controlSampleTimeS;
      const zohRe = zohMag * Math.cos(zohPhase);
      const zohIm = zohMag * Math.sin(zohPhase);
      const nre = re * zohRe - im * zohIm;
      const nim = re * zohIm + im * zohRe;
      re = nre;
      im = nim;
    }
    return { re, im };
  });
}
function logInterpolateCrossing(frequencies, values, target) {
  const results = [];
  const logF = frequencies.map((f) => Math.log(Math.max(f, 1e-300)));
  const shifted = values.map((v) => v - target);
  for (let i = 0; i < frequencies.length - 1; i++) {
    const a = shifted[i];
    const b = shifted[i + 1];
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (a === 0) {
      results.push([frequencies[i], i, 0]);
      continue;
    }
    if (a * b > 0 || b === a) continue;
    const fraction = -a / (b - a);
    const lf = logF[i] + fraction * (logF[i + 1] - logF[i]);
    results.push([Math.exp(lf), i, fraction]);
  }
  return results;
}
function linearBetween(values, index, fraction) {
  return values[index] + fraction * (values[index + 1] - values[index]);
}
function calculateStabilityMargins(frequenciesHz, openLoop) {
  const magnitudeDb = openLoop.map((r) => 20 * Math.log10(Math.max(Math.hypot(r.re, r.im), 1e-300)));
  const rawPhase = openLoop.map((r) => Math.atan2(r.im, r.re));
  const phaseDeg = unwrap(rawPhase).map((p) => p * 180 / Math.PI);
  const gainCrossings = logInterpolateCrossing(frequenciesHz, magnitudeDb, 0);
  const gcFrequencies = [];
  const phaseMargins = [];
  for (const [frequency, index, fraction] of gainCrossings) {
    let phase = linearBetween(phaseDeg, index, fraction);
    while (phase > 0) phase -= 360;
    while (phase <= -360) phase += 360;
    gcFrequencies.push(frequency);
    phaseMargins.push(180 + phase);
  }
  const minPhase = Math.min(...phaseDeg);
  const maxPhase = Math.max(...phaseDeg);
  const kMin = Math.floor((minPhase + 180) / 360) - 1;
  const kMax = Math.ceil((maxPhase + 180) / 360) + 1;
  let phaseCrossingsAll = [];
  for (let k = kMin; k <= kMax; k++) {
    phaseCrossingsAll.push(...logInterpolateCrossing(frequenciesHz, phaseDeg, -180 + 360 * k));
  }
  phaseCrossingsAll.sort((a, b) => a[0] - b[0]);
  const uniquePc = [];
  for (const item of phaseCrossingsAll) {
    if (uniquePc.length === 0 || Math.abs(Math.log(item[0] / uniquePc[uniquePc.length - 1][0])) > 1e-6) {
      uniquePc.push(item);
    }
  }
  const pcFrequencies = [];
  const gainMargins = [];
  for (const [frequency, index, fraction] of uniquePc) {
    const mag = linearBetween(magnitudeDb, index, fraction);
    pcFrequencies.push(frequency);
    gainMargins.push(-mag);
  }
  let criticalGc = null;
  let criticalPm = null;
  let delayMargin = null;
  if (gcFrequencies.length > 0) {
    let criticalIndex = 0;
    for (let i = 1; i < phaseMargins.length; i++) {
      if (phaseMargins[i] < phaseMargins[criticalIndex]) criticalIndex = i;
    }
    criticalGc = gcFrequencies[criticalIndex];
    criticalPm = phaseMargins[criticalIndex];
    delayMargin = criticalPm * Math.PI / 180 / (2 * Math.PI * criticalGc);
  }
  let criticalPc = null;
  let criticalGm = null;
  if (pcFrequencies.length > 0) {
    const pairs = gainMargins.map((m, i) => [m, pcFrequencies[i]]);
    const positive = pairs.filter(([m]) => m >= 0);
    const chosen = positive.length > 0 ? positive.reduce((best, p) => p[0] < best[0] ? p : best) : pairs.reduce((best, p) => p[0] < best[0] ? p : best);
    criticalGm = chosen[0];
    criticalPc = chosen[1];
  }
  return {
    gainCrossoversHz: gcFrequencies,
    phaseMarginsDeg: phaseMargins,
    phaseCrossoversHz: pcFrequencies,
    gainMarginsDb: gainMargins,
    criticalGainCrossoverHz: criticalGc,
    phaseMarginDeg: criticalPm,
    criticalPhaseCrossoverHz: criticalPc,
    gainMarginDb: criticalGm,
    delayMarginS: delayMargin
  };
}
function cAdd3(a, b) {
  return { re: a.re + b.re, im: a.im + b.im };
}
function cMul5(a, b) {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}
function cMulS(a, s) {
  return { re: a.re * s, im: a.im * s };
}
function cDiv4(a, b) {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}
function cplx3(re, im) {
  return { re, im };
}
function polyConvolve(a, b) {
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] = out[i + j] + a[i] * b[j];
  }
  return out;
}
function fractionalDelayThiran(delaySamples, sampleTimeS) {
  const delay = Math.min(Math.max(delaySamples, 0), 1);
  if (delay <= 1e-12) {
    return new DigitalTransferFunction([1], [1], sampleTimeS, "fractional-delay");
  }
  const coefficient = (1 - delay) / (1 + delay);
  return new DigitalTransferFunction(
    [coefficient, 1],
    [1, coefficient],
    sampleTimeS,
    "Thiran-fractional-delay"
  );
}
function continuousToDiscreteTf(numerator, denominator, sampleTimeS, name) {
  const { numZ, denZ } = tfZoh(numerator, denominator, sampleTimeS);
  return new DigitalTransferFunction(numZ, denZ, sampleTimeS, name);
}
function tfZoh(numS, denS, ts) {
  const den0 = denS[0];
  const den = denS.map((v) => v / den0);
  const numRaw = numS.map((v) => v / den0);
  const n = den.length - 1;
  const num = [...new Array(Math.max(0, n + 1 - numRaw.length)).fill(0), ...numRaw];
  const a = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_2, j) => {
    if (i === 0) return -den[j + 1];
    if (i === j + 1) return 1;
    return 0;
  }));
  const b = Array.from({ length: n }, (_, i) => i === 0 ? [1] : [0]);
  const c = [Array.from({ length: n }, (_, j) => num[j + 1] - num[0] * den[j + 1])];
  const d = [[num[0]]];
  const { ad, bd, cd, dd } = cont2discreteZoh(a, b, c, d, ts);
  const [numAll, denAll] = ss2tf(ad, bd, cd, dd, 0, 0);
  return { numZ: numAll, denZ: denAll };
}
function buildDigitalLoopAnalysis(smallSignal, options) {
  const { controllerConfig, commandPu } = options;
  const controller = controllerTransferFunction(controllerConfig);
  const sampleTime = controller.sampleTimeS;
  if (Math.abs(sampleTime - smallSignal.sampleTimeS) > 1e-15) {
    throw new Error("controller and LLC ZOH plant sample times must match");
  }
  const lut = options.fmLut ?? fmLutFirmwareDefault();
  const analog = options.analogSense ?? makeAnalogSenseConfig();
  const adc = options.adcSampling ?? makeAdcSamplingConfig({ controlSampleTimeS: sampleTime });
  const timing = options.commandTiming ?? makeCommandTimingConfig();
  if (Math.abs(adc.controlSampleTimeS - sampleTime) > 1e-15) {
    throw new Error("ADC and controller sample times must match");
  }
  const fsw = smallSignal.operatingPoint.switchingFrequencyHz;
  const fm = evaluateFmOperatingPoint(lut, { switchingFrequencyHz: fsw, commandPu });
  let frequencies;
  if (options.frequenciesHz !== void 0 && options.frequenciesHz.length > 0) {
    frequencies = options.frequenciesHz;
  } else {
    const nyquist = 0.5 / sampleTime;
    const upper = Math.min(0.49 * nyquist, 0.25 * fsw);
    const lower = Math.max(0.1, upper / 2e5);
    frequencies = geomspace(lower, upper, 2400);
  }
  if (frequencies.some((f) => f <= 0)) throw new Error("Bode frequencies must be positive");
  const plant = sisoFrequencyResponse(smallSignal.continuousTransfer, frequencies);
  const controllerResponse = controller.frequencyResponse(frequencies);
  const analogComponents = analogFrequencyResponseComponents(analog, frequencies);
  const adcResponse = adcFrequencyResponse(adc, frequencies);
  const sense = analogComponents.calibratedAnalog.map((v, i) => cMul5(v, adcResponse[i]));
  const fmPlant = plant.map((v) => cMulS(v, fm.gainHzPerPu));
  const responses = {
    power_stage: plant,
    fm_power_stage: fmPlant,
    controller: controllerResponse,
    sense_analog_raw: analogComponents.rawAnalog,
    sense_analog_calibrated: analogComponents.calibratedAnalog,
    adc_sampling: adcResponse,
    sense_total: sense
  };
  const margins = {};
  for (const envelope of ["minimum", "nominal", "maximum"]) {
    const delay = commandTimingFrequencyResponse(timing, adc, fsw, envelope, frequencies);
    const openLoop = controllerResponse.map((c, i) => cMul5(cMul5(cMul5(c, fmPlant[i]), sense[i]), delay[i]));
    const closedLoop = openLoop.map((v) => cDiv4(v, cAdd3(v, cplx3(1, 0))));
    const sensitivity = openLoop.map((v) => cDiv4(cplx3(1, 0), cAdd3(v, cplx3(1, 0))));
    responses[`delay_${envelope}`] = delay;
    responses[`open_loop_${envelope}`] = openLoop;
    responses[`closed_loop_${envelope}`] = closedLoop;
    responses[`sensitivity_${envelope}`] = sensitivity;
    margins[envelope] = calculateStabilityMargins(frequencies, openLoop);
  }
  const zout = sisoFrequencyResponse(smallSignal.outputImpedanceTransfer, frequencies);
  responses["closed_loop_output_impedance"] = zout.map((z, i) => cMul5(z, responses["sensitivity_nominal"][i]));
  const plantD = new DigitalTransferFunction(
    smallSignal.discretePlant.numerator,
    smallSignal.discretePlant.denominator,
    sampleTime,
    "Gvf-ZOH(z)",
    "frequency_hz",
    "output_voltage_v"
  ).scaled(fm.gainHzPerPu, "Gpcmd(z)");
  const [analogNum, analogDen] = analogNormalizedContinuousTf(analog);
  const analogD = continuousToDiscreteTf(analogNum, analogDen, sampleTime, "analog-sense-ZOH(z)");
  const adcD = adcSimplifiedDigitalFilter(adc);
  const applicationDelay = applicationDelayS(timing, adc, fsw, "nominal");
  const sampleToActuationDelay = Math.max(0, applicationDelay - adcEffectiveSampleOffsetS(adc));
  const delayInSamples = sampleToActuationDelay / sampleTime;
  const integerDelay = Math.floor(delayInSamples);
  const fractionalDelay = delayInSamples - integerDelay;
  const fractionalD = fractionalDelayThiran(fractionalDelay, sampleTime);
  let openD = controller.cascade(plantD).cascade(analogD).cascade(adcD).cascade(fractionalD);
  openD = openD.withDelay(integerDelay);
  const openNum = openD.numerator;
  const openDen = openD.denominator;
  const closedDen = polyAddArr(openDen, openNum);
  const closedPoles = closedDen.length > 1 ? rootsOf(closedDen) : [];
  const warnings = [];
  if (smallSignal.continuousTransfer.dcGain * fm.gainHzPerPu <= 0) {
    warnings.push(
      "PCMD-to-output low-frequency gain is non-positive; the firmware error polarity may create positive feedback at this operating point."
    );
  }
  if (Math.min(fm.commandHeadroomLow, fm.commandHeadroomHigh) < 0.03) {
    warnings.push("PCMD operating point is within 3% of saturation; linear loop headroom is limited.");
  }
  if (Math.abs(fm.frequencyHz - fsw) / Math.max(fsw, 1e-12) > 0.01) {
    warnings.push(
      "The selected/custom FM LUT does not reproduce the plant operating frequency within 1%; PCMD linearization and plant work point are inconsistent."
    );
  }
  if (controllerConfig.kind === "pi" || controllerConfig.kind === "pif") {
    if (controllerConfig.outputMin !== 0 || controllerConfig.outputMax !== 1) {
      warnings.push("Controller output limits differ from the requested normalized PCMD range 0..1.");
    }
  }
  warnings.push(
    "Linear Bode validity requires voltage-loop ownership: no current-limit min-selector takeover, burst, soft-start, saturation, OVP/UVP/OPP or hardware trip."
  );
  return {
    controllerConfig,
    controller,
    fmLut: lut,
    fmOperatingPoint: fm,
    analogSense: analog,
    adcSampling: adc,
    commandTiming: timing,
    frequenciesHz: frequencies,
    responses,
    marginsMinimumDelay: margins["minimum"],
    marginsNominalDelay: margins["nominal"],
    marginsMaximumDelay: margins["maximum"],
    discreteApproximation: {
      openLoopNumerator: openNum,
      openLoopDenominator: openDen,
      closedLoopDenominator: closedDen,
      closedLoopPoles: closedPoles,
      stable: closedPoles.every((p) => Math.hypot(p.re, p.im) < 1),
      integerDelaySamples: integerDelay,
      fractionalDelaySamples: fractionalDelay
    },
    warnings,
    get nominalOpenLoop() {
      return this.responses["open_loop_nominal"];
    },
    get nominalClosedLoop() {
      return this.responses["closed_loop_nominal"];
    },
    get likelyStable() {
      const margin = this.marginsNominalDelay.phaseMarginDeg;
      const gainMargin = this.marginsNominalDelay.gainMarginDb;
      const marginOk = margin !== null && margin > 0;
      const gainOk = gainMargin === null || gainMargin > 0;
      return marginOk && gainOk && this.discreteApproximation.stable;
    }
  };
}
function rootsOf(coeffs) {
  return roots(coeffs);
}
function polyAddArr(a, b) {
  const len = Math.max(a.length, b.length);
  const out = new Array(len).fill(0);
  for (let i = 0; i < len; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0);
  return out;
}

// src/control/autotune.ts
function evaluateOpenLoopAt(r, frequencyHz) {
  const freqs = r.frequenciesHz;
  const ol = r.responses["open_loop_nominal"];
  const logF = freqs.map((f) => Math.log(f));
  const x = Math.log(frequencyHz);
  const clampIdx = (i) => Math.min(Math.max(i, 0), ol.length - 1);
  let idx;
  let t;
  if (x <= logF[0]) {
    idx = 0;
    t = 0;
  } else if (x >= logF[logF.length - 1]) {
    idx = ol.length - 2;
    t = 1;
  } else {
    idx = findIndex(logF, x);
    const x0 = logF[idx];
    const x1 = logF[idx + 1];
    t = (x - x0) / (x1 - x0);
  }
  const a = ol[clampIdx(idx)];
  const b = ol[clampIdx(idx + 1)];
  const re = a.re + t * (b.re - a.re);
  const im = a.im + t * (b.im - a.im);
  const rawPhase = ol.map((v) => Math.atan2(v.im, v.re));
  const unwrapped = unwrapPhase(rawPhase);
  const pa = unwrapped[clampIdx(idx)];
  const pb = unwrapped[clampIdx(idx + 1)];
  const phaseDeg = (pa + t * (pb - pa)) * 180 / Math.PI;
  return { re, im, phaseDeg };
}
function unwrapPhase(phase) {
  const out = [...phase];
  let offset = 0;
  for (let i = 1; i < out.length; i++) {
    let d = out[i] - out[i - 1];
    if (d > Math.PI) {
      d -= 2 * Math.PI;
      offset -= 2 * Math.PI;
    } else if (d < -Math.PI) {
      d += 2 * Math.PI;
      offset += 2 * Math.PI;
    }
    out[i] = out[i] + offset;
  }
  return out;
}
function findIndex(sorted, value) {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi - 1) {
    const mid = lo + hi >>> 1;
    if (sorted[mid] < value) lo = mid;
    else hi = mid;
  }
  return lo;
}
function phaseMarginFromPhaseDeg(phaseDeg) {
  let phase = phaseDeg;
  while (phase > 0) phase -= 360;
  while (phase <= -360) phase += 360;
  return 180 + phase;
}
function makeGridWithFc(sampleTimeS, fsw, fc) {
  const nyquist = 0.5 / sampleTimeS;
  const upper = Math.min(0.49 * nyquist, 0.25 * fsw);
  const lower = Math.max(0.1, upper / 2e5);
  const n = 2400;
  const grid = [];
  const ratio = Math.pow(upper / lower, 1 / (n - 1));
  for (let i = 0; i < n; i++) grid.push(lower * ratio ** i);
  grid[grid.length - 1] = upper;
  const merged = [...grid, fc].sort((a, b) => a - b);
  const out = [];
  for (const f of merged) {
    if (out.length === 0 || Math.abs(Math.log(f / out[out.length - 1])) > 1e-9) out.push(f);
  }
  return out;
}
function tuneVoltageLoop(spec, target = {}, chain = {}) {
  const kind = target.controllerKind ?? "pi";
  const pmTarget = target.phaseMarginDeg ?? 50;
  const maxIter = target.maxIterations ?? 20;
  const ssa = buildSmallSignalAnalysis(spec, {
    vbusV: chain.vbusV,
    loadFraction: chain.loadFraction,
    sampleTimeS: chain.sampleTimeS
  });
  const sampleTime = chain.sampleTimeS ?? 2e-5;
  const fsw = ssa.operatingPoint.switchingFrequencyHz;
  const fc = target.crossoverHz ?? fsw / 20;
  const grid = makeGridWithFc(sampleTime, fsw, fc);
  const notes = [];
  let kp = 0.01;
  let ti = 1 / (2 * Math.PI * (fc / 3));
  let lpfCutoff = target.lpfCutoffHz ?? 3500;
  let hpRatio = target.highFrequencyPoleRatio ?? 4;
  let zeroRatio = 2;
  const build = (ctrl) => buildDigitalLoopAnalysis(ssa, {
    controllerConfig: ctrl,
    fmLut: chain.fmLut,
    analogSense: chain.analogSense,
    adcSampling: chain.adcSampling,
    commandTiming: chain.commandTiming,
    frequenciesHz: grid
  });
  let finalCtrl = makePiConfig(kp, ti, sampleTime);
  let finalAnalysis = null;
  let achievedPm = 0;
  let achievedGc = 0;
  let converged = false;
  let iterations = 0;
  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;
    let r = null;
    let olFc = null;
    for (let inner = 0; inner < 15; inner++) {
      const ctrl = makeController(kind, kp, ti, fc, hpRatio, zeroRatio, sampleTime, lpfCutoff);
      r = build(ctrl);
      olFc = evaluateOpenLoopAt(r, fc);
      const mag = Math.hypot(olFc.re, olFc.im);
      const kpCorrection = mag > 1e-12 ? 1 / mag : 1;
      kp = clamp(kp * kpCorrection, 1e-9, 1e6);
      if (Math.abs(mag - 1) < 5e-3) break;
    }
    if (r === null || olFc === null) throw new Error("autotune: iteration produced no analysis");
    const pm = phaseMarginFromPhaseDeg(olFc.phaseDeg);
    const pmErr = pm - pmTarget;
    finalCtrl = makeController(kind, kp, ti, fc, hpRatio, zeroRatio, sampleTime, lpfCutoff);
    finalAnalysis = r;
    achievedPm = pm;
    achievedGc = fc;
    if (Math.abs(pmErr) < 1.5) {
      converged = true;
      break;
    }
    if (kind === "2p2z") {
      converged = true;
      notes.push(
        `2P2Z \u7ED3\u6784\u5728 fc=${fc.toFixed(0)} Hz \u4E0B\u53EF\u8FBE PM ${pm.toFixed(1)}\xB0\uFF08\u76EE\u6807 ${pmTarget}\xB0\uFF09\uFF1B\u5982\u9700\u8981\u4E0D\u540C\u76F8\u4F4D\u88D5\u5EA6\uFF0C\u8BF7\u8C03\u6574\u76EE\u6807\u5E26\u5BBD\u6216\u96F6\u70B9/\u6781\u70B9\u914D\u7F6E\u3002`
      );
      break;
    }
    const atTiFloor = ti <= sampleTime * 1.01;
    const atTiCeil = ti >= 10 * 0.99;
    if (atTiFloor && pmErr > 0 || atTiCeil && pmErr < 0) {
      converged = true;
      if (pmErr > 0) {
        notes.push(
          `\u76EE\u6807 PM ${pmTarget}\xB0 \u5728\u8BE5\u5DE5\u4F5C\u70B9\u4E0D\u53EF\u8FBE\uFF08plant \u76F8\u4F4D\u6EDE\u540E\u4E0D\u8DB3\uFF09\uFF1ATI \u5DF2\u964D\u81F3\u6700\u5C0F\u503C\u4ECD\u4E3A PM ${pm.toFixed(1)}\xB0\uFF0C\u5F53\u524D\u4E3A\u53EF\u8FBE\u7684\u6700\u5927\u76F8\u4F4D\u88D5\u5EA6\u3002`
        );
      } else {
        notes.push(
          `\u76EE\u6807 PM ${pmTarget}\xB0 \u5728\u8BE5\u5DE5\u4F5C\u70B9\u4E0D\u53EF\u8FBE\uFF08plant \u76F8\u4F4D\u6EDE\u540E\u8FC7\u5927\uFF09\uFF1ATI \u5DF2\u5347\u81F3\u6700\u5927\u503C\u4ECD\u4E3A PM ${pm.toFixed(1)}\xB0\u3002`
        );
      }
      break;
    }
    if (pmErr > 1.5) ti = clamp(ti * 0.65, sampleTime, 10);
    else if (pmErr < -1.5) ti = clamp(ti * 1.4, sampleTime, 10);
  }
  finalCtrl = makeController(kind, kp, ti, fc, hpRatio, zeroRatio, sampleTime, lpfCutoff);
  finalAnalysis = build(finalCtrl);
  const final = finalAnalysis;
  const finalPm = final.marginsNominalDelay.phaseMarginDeg;
  const finalGc = final.marginsNominalDelay.criticalGainCrossoverHz;
  const finalGm = final.marginsNominalDelay.gainMarginDb;
  if (!converged) {
    notes.push(`\u8FED\u4EE3 ${iterations} \u6B21\u672A\u5B8C\u5168\u6536\u655B\uFF08PM \u8BEF\u5DEE ${(achievedPm - pmTarget).toFixed(1)}\xB0\uFF09`);
  }
  if (!final.likelyStable) {
    notes.push("\u8B66\u544A\uFF1A\u6700\u7EC8\u8BBE\u8BA1\u7684\u79BB\u6563\u95ED\u73AF\u8FD1\u4F3C\u4E0D\u7A33\u5B9A\uFF0C\u8BF7\u964D\u4F4E\u5E26\u5BBD\u6216\u589E\u52A0\u76F8\u4F4D\u88D5\u5EA6\u76EE\u6807");
  }
  notes.push(`\u6574\u5B9A\u5DE5\u4F5C\u70B9\uFF1Afsw = ${(fsw / 1e3).toFixed(1)} kHz\uFF0C\u76EE\u6807 fc = ${(fc / 1e3).toFixed(2)} kHz`);
  notes.push(`FM \u5DE5\u4F5C\u70B9 command = ${final.fmOperatingPoint.commandPu.toFixed(4)}\uFF0C\u589E\u76CA ${final.fmOperatingPoint.gainHzPerPu.toExponential(3)} Hz/pu`);
  return {
    controllerConfig: finalCtrl,
    analysis: final,
    achievedCrossoverHz: finalGc ?? fc,
    achievedPhaseMarginDeg: finalPm ?? achievedPm,
    achievedGainMarginDb: finalGm ?? 0,
    iterations,
    converged: converged && final.likelyStable,
    notes
  };
}
function make2P2ZForTarget(fc, hpRatio, sampleTimeS, gain2, zeroRatio = 2) {
  const nyquist = 0.5 / sampleTimeS;
  const poleHz = Math.min(hpRatio * fc, 0.4 * nyquist);
  const zerosHz = [fc / zeroRatio, fc / (2 * zeroRatio)];
  const polesHz = [poleHz, poleHz];
  return twoP2ZFromAnalogPolesZeros({
    gain: gain2,
    zerosHz,
    polesHz,
    sampleTimeS,
    outputMin: 0,
    outputMax: 1
  });
}
function makeController(kind, kp, ti, fc, hpRatio, zeroRatio, sampleTime, lpfCutoff) {
  switch (kind) {
    case "pi":
      return makePiConfig(kp, ti, sampleTime);
    case "pif":
      return makePifConfig(kp, ti, lpfCutoff, sampleTime);
    case "2p2z":
      return make2P2ZForTarget(fc, hpRatio, sampleTime, kp, zeroRatio);
  }
}
function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi);
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

// src/engine/asciiBode.ts
function sampleBode(frequenciesHz, responses, samples = 60) {
  const n = responses.length;
  if (n < 2) return { freqs: [], magDb: [], phaseDeg: [] };
  const out = { freqs: [], magDb: [], phaseDeg: [] };
  for (let s = 0; s < samples; s++) {
    const frac = s / (samples - 1);
    const idx = Math.round(frac * (n - 1));
    const v = responses[idx];
    const f = frequenciesHz[idx];
    out.freqs.push(f);
    out.magDb.push(20 * Math.log10(Math.max(Math.hypot(v.re, v.im), 1e-300)));
    out.phaseDeg.push(Math.atan2(v.im, v.re) * 180 / Math.PI);
  }
  out.phaseDeg = unwrapDeg(out.phaseDeg);
  return out;
}
function unwrapDeg(phase) {
  const out = [...phase];
  let offset = 0;
  for (let i = 1; i < out.length; i++) {
    const d = phase[i] - phase[i - 1];
    if (d > 180) offset -= 360;
    else if (d < -180) offset += 360;
    out[i] = phase[i] + offset;
  }
  return out;
}
function renderCurve(xs, ys, yMin, yMax, opts) {
  const { width, height } = opts;
  const plotW = width - 8;
  const plotH = height - 2;
  const grid = Array.from({ length: plotH }, () => new Array(plotW).fill(" "));
  const ySpan = yMax - yMin;
  const colOf = (x) => {
    const xMin = Math.log10(xs[0]);
    const xMax = Math.log10(xs[xs.length - 1]);
    return Math.round((Math.log10(x) - xMin) / (xMax - xMin) * (plotW - 1));
  };
  const rowOf = (y) => Math.round((yMax - y) / ySpan * (plotH - 1));
  const drawLine = (y, ch) => {
    const r = rowOf(y);
    if (r >= 0 && r < plotH) for (let c = 0; c < plotW; c++) grid[r][c] = ch;
  };
  drawLine(0, "\xB7");
  if (opts.label === "Phase (deg)") drawLine(-180, "\xB7");
  for (let i = 0; i < xs.length; i++) {
    const c = colOf(xs[i]);
    let r = rowOf(ys[i]);
    r = Math.max(0, Math.min(plotH - 1, r));
    if (grid[r][c] === "\xB7") grid[r][c] = "\xD7";
    else grid[r][c] = "*";
  }
  const lines = [];
  for (let r = 0; r < plotH; r++) {
    const yVal = yMax - r / (plotH - 1) * ySpan;
    const tick = r % Math.max(1, Math.floor(plotH / 4)) === 0 || r === plotH - 1 ? yVal.toFixed(0).padStart(6) : "      ";
    lines.push(`${tick} ${grid[r].join("")}`);
  }
  lines.push("       " + "-".repeat(plotW));
  lines.push(`       ${opts.xTicks[0].padEnd(20)}${opts.xTicks[1].padEnd(20)}${opts.xTicks[2]}`);
  lines.push(`${opts.label}\uFF08${opts.yUnit}\uFF09  x \u8F74: \u9891\u7387 (Hz, \u5BF9\u6570)`);
  return lines.join("\n");
}
function renderAsciiBode(frequenciesHz, responses, options = {}) {
  const width = options.width ?? 64;
  const height = options.height ?? 13;
  const samples = options.samples ?? 60;
  const bode = sampleBode(frequenciesHz, responses, samples);
  if (bode.freqs.length < 2) return "(Bode \u6570\u636E\u4E0D\u8DB3)";
  const magMax = Math.max(...bode.magDb);
  const magMin = Math.min(...bode.magDb);
  const yMaxM = Math.min(30, Math.ceil(magMax / 10) * 10 + 10);
  const yMinM = Math.max(-80, Math.floor(magMin / 10) * 10 - 10);
  const yMaxP = Math.ceil(Math.max(...bode.phaseDeg) / 90) * 90;
  const yMinP = Math.floor(Math.min(...bode.phaseDeg) / 90) * 90;
  const fMin = bode.freqs[0];
  const fMax = bode.freqs[bode.freqs.length - 1];
  const xTicks = [fmtFreq(fMin), fmtFreq(Math.sqrt(fMin * fMax)), fmtFreq(fMax)];
  const magFig = renderCurve(bode.freqs, bode.magDb, yMinM, yMaxM, {
    width,
    height,
    label: "Magnitude",
    yUnit: "dB",
    xTicks
  });
  const phaseFig = renderCurve(bode.freqs, bode.phaseDeg, yMinP, yMaxP, {
    width,
    height,
    label: "Phase",
    yUnit: "deg",
    xTicks
  });
  const header = ["```text", "Open-Loop Bode (nominal delay)", "=".repeat(width)];
  if (options.fcHz) header.push(`  fc = ${fmtFreq(options.fcHz)}   PM = ${options.phaseMarginDeg?.toFixed(1) ?? "-"}\xB0   GM = ${options.gainMarginDb?.toFixed(1) ?? "-"} dB`);
  return [...header, "", magFig, "", phaseFig, "```"].join("\n");
}
function fmtFreq(f) {
  if (f >= 1e3) return `${(f / 1e3).toFixed(1)}k`;
  if (f >= 1) return f.toFixed(0);
  return f.toExponential(1);
}

// src/engine/loopEngine.ts
function presetToFerriteInput(preset) {
  return {
    presetKey: preset.presetKey,
    manufacturer: preset.manufacturer,
    partNumber: preset.partNumber,
    shape: preset.shape,
    materialKey: preset.materialKey,
    materialGrade: preset.materialGrade,
    aeMm2: preset.aeMm2,
    aminMm2: preset.aminMm2,
    leMm: preset.leMm,
    veMm3: preset.veMm3,
    sigmaLOverAPerMm: preset.sigmaLOverAPerMm,
    alNh: preset.alNh,
    muE: preset.muE,
    windingAreaMm2: preset.windingAreaMm2,
    meanTurnLengthMm: preset.meanTurnLengthMm,
    usableWindingWidthMm: preset.usableWindingWidthMm,
    arUohm: preset.arUohm,
    coreMassG: preset.coreMassG,
    thermalResistanceKPerW: preset.thermalResistanceKPerW,
    datasheetLossRefW: preset.datasheetLossRefW,
    datasheetLossRefFrequencyHz: preset.datasheetLossRefFrequencyHz,
    datasheetLossRefBT: preset.datasheetLossRefBT,
    datasheetLossRefTemperatureC: preset.datasheetLossRefTemperatureC
  };
}
function renderControllerC99(numerator, denominator, functionName = "llc_voltage_controller_run", outputMin = 0, outputMax = 1) {
  const orderX = numerator.length - 1;
  const orderY = denominator.length - 1;
  const cFloat = (value) => {
    const text = value.toPrecision(9);
    const t = text.includes("e") || text.includes(".") ? text : text + ".0";
    return t + "f";
  };
  const lines = [
    "/* Auto-generated LLC digital controller. C99, Direct Form I. */",
    "#include <stddef.h>",
    "",
    `#define LLC_CTRL_NX (${orderX + 1}u)`,
    `#define LLC_CTRL_NY (${orderY}u)`,
    "",
    "typedef struct {",
    "    float x_hist[LLC_CTRL_NX];",
    "    float y_hist[(LLC_CTRL_NY > 0u) ? LLC_CTRL_NY : 1u];",
    "} llc_controller_state_t;",
    "",
    `static const float llc_ctrl_b[LLC_CTRL_NX] = {${numerator.map(cFloat).join(", ")}};`,
    `static const float llc_ctrl_a[(LLC_CTRL_NY > 0u) ? LLC_CTRL_NY : 1u] = ${orderY > 0 ? `{${denominator.slice(1).map(cFloat).join(", ")}}` : "{0.0f}"};`,
    "",
    `float ${functionName}(llc_controller_state_t *state, float error)`,
    "{",
    "    size_t i;",
    "    float output = 0.0f;",
    "",
    "    for(i = LLC_CTRL_NX - 1u; i > 0u; --i) {",
    "        state->x_hist[i] = state->x_hist[i - 1u];",
    "    }",
    "    state->x_hist[0] = error;",
    "    for(i = 0u; i < LLC_CTRL_NX; ++i) {",
    "        output += llc_ctrl_b[i] * state->x_hist[i];",
    "    }",
    "    for(i = 0u; i < LLC_CTRL_NY; ++i) {",
    "        output -= llc_ctrl_a[i] * state->y_hist[i];",
    "    }",
    `    if(output > ${cFloat(outputMax)}) output = ${cFloat(outputMax)};`,
    `    if(output < ${cFloat(outputMin)}) output = ${cFloat(outputMin)};`,
    "    if(LLC_CTRL_NY > 0u) {",
    "        for(i = LLC_CTRL_NY - 1u; i > 0u; --i) {",
    "            state->y_hist[i] = state->y_hist[i - 1u];",
    "        }",
    "        state->y_hist[0] = output;",
    "    }",
    "    return output;",
    "}",
    ""
  ];
  return lines.join("\n");
}
function runLoopTune(request) {
  const assumptions = collectTuneAssumptions(request);
  let spec = buildSpec({
    vout: request.vout,
    pout: request.pout,
    frKhz: request.frKhz,
    vinNom: request.vinNom,
    vinMinNormal: request.vinMinNormal,
    vinMax: request.vinMax,
    vinHoldEnd: request.vinHoldEnd,
    topology: request.topology,
    k: request.k,
    q: request.q,
    primaryTurns: request.primaryTurns,
    secondaryTurns: request.secondaryTurns,
    outputCapF: request.outputCapF,
    outputCapEsrMohm: request.outputCapEsrMohm
  });
  if (request.primaryTurns === void 0 || request.secondaryTurns === void 0) {
    const preset = resolveCorePreset(request.corePreset);
    const result2 = synthesizeTransformer(spec, presetToFerriteInput(preset), {
      ...DEFAULT_SYNTHESIS_SETTINGS,
      workpointScope: "all"
    });
    spec = cloneSpec(spec, {
      primaryTurns: result2.primaryTurns,
      secondaryTurns: result2.secondaryTurns
    });
  }
  const sampleTimeS = (request.sampleTimeUs ?? 20) * 1e-6;
  const result = tuneVoltageLoop(spec, {
    crossoverHz: request.crossoverKhz !== void 0 ? request.crossoverKhz * 1e3 : void 0,
    phaseMarginDeg: request.phaseMarginDeg,
    controllerKind: request.controllerKind
  }, { sampleTimeS, loadFraction: request.loadFraction });
  const controller = controllerTransferFunction(result.controllerConfig);
  const kind = controllerKind(result.controllerConfig);
  const cfg = result.controllerConfig;
  const coefficients = {};
  if (cfg.kind === "pi") {
    coefficients.kp = cfg.kp;
    coefficients.tiS = cfg.tiS;
  } else if (cfg.kind === "pif") {
    coefficients.kp = cfg.kp;
    coefficients.tiS = cfg.tiS;
    coefficients.lpfCutoffHz = cfg.lpfCutoffHz;
  } else {
    coefficients.b0 = cfg.b0;
    coefficients.b1 = cfg.b1;
    coefficients.b2 = cfg.b2;
    coefficients.a1 = cfg.a1;
    coefficients.a2 = cfg.a2;
  }
  const outMin = cfg.outputMin;
  const outMax = cfg.outputMax;
  const fx = computeFixedPoint(result.controllerConfig);
  return {
    feasible: result.converged,
    assumptions,
    converged: result.converged,
    controllerKind: kind,
    controller: {
      coefficients,
      numeratorZ: controller.numerator,
      denominatorZ: controller.denominator,
      differenceEquation: controller.differenceEquation(),
      c99: renderControllerC99(controller.numerator, controller.denominator, "llc_voltage_controller_run", outMin, outMax)
    },
    fixed: {
      coefficients: fixedPointTable(fx),
      c99: renderFixedC99(fx, "vloop"),
      libInitC99: renderFixedLibInitC99(fx, "vloop"),
      checks: fx.checks,
      budget: fx.budget
    },
    operatingPoint: {
      fswKhz: result.analysis.fmOperatingPoint.frequencyHz / 1e3,
      fmCommandPu: result.analysis.fmOperatingPoint.commandPu,
      fmGainHzPerPu: result.analysis.fmOperatingPoint.gainHzPerPu
    },
    margins: {
      phaseMarginDeg: result.achievedPhaseMarginDeg,
      crossoverHz: result.achievedCrossoverHz,
      gainMarginDb: result.achievedGainMarginDb,
      delayMarginS: result.analysis.marginsNominalDelay.delayMarginS
    },
    discreteStable: result.analysis.discreteApproximation.stable,
    iterations: result.iterations,
    notes: result.notes,
    warnings: result.analysis.warnings,
    bodeAscii: request.showBode ?? true ? renderAsciiBode(
      result.analysis.frequenciesHz,
      result.analysis.responses["open_loop_nominal"],
      {
        fcHz: result.achievedCrossoverHz,
        phaseMarginDeg: result.achievedPhaseMarginDeg,
        gainMarginDb: result.achievedGainMarginDb
      }
    ) : ""
  };
}
export {
  renderControllerC99,
  runLoopTune
};
