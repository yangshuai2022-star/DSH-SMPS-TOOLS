import {
  DigitalTransferFunction,
  buildSmallSignalAnalysis,
  cont2discreteBilinear,
  cont2discreteZoh,
  geomspace,
  interp,
  roots,
  searchsorted,
  sinc,
  sisoFrequencyResponse,
  ss2tf,
  unwrap
} from "./chunk-2JNG6NQ6.js";

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
  const { gain, zerosHz, polesHz, sampleTimeS, outputMin = 0, outputMax = 1 } = options;
  if (zerosHz.length !== 2 || polesHz.length !== 2) {
    throw new Error("2P2Z analog design requires exactly two poles and two zeros");
  }
  const zerosRad = zerosHz.map((v) => -2 * Math.PI * v);
  const polesRad = polesHz.map((v) => -2 * Math.PI * v);
  const numS = polyFromRoots(zerosRad).map((v) => v * gain);
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
      dv = cDiv(dv, cAdd(cplx(1, 0), cMulS(s, dividerThevenin * c.dividerCapacitanceF)));
    }
    let oa = { re: c.opampGain, im: 0 };
    if (c.opampBandwidthHz > 0) {
      oa = cDiv(oa, cAdd(cplx(1, 0), cMulS(s, 1 / (2 * Math.PI * c.opampBandwidthHz))));
    }
    let rc = { re: 1, im: 0 };
    if (c.adcSeriesResistanceOhm > 0 && c.adcShuntCapacitanceF > 0) {
      rc = cDiv(rc, cAdd(cplx(1, 0), cMulS(s, c.adcSeriesResistanceOhm * c.adcShuntCapacitanceF)));
    }
    const rawV = cMul(cMul(dv, oa), rc);
    divider.push(dv);
    opamp.push(oa);
    adcRc.push(rc);
    raw.push(rawV);
    calibrated.push(cMulS(rawV, calGain));
  }
  return { divider, opamp, adcRc, rawAnalog: raw, calibratedAnalog: calibrated };
}
function analogNormalizedContinuousTf(c) {
  const gain = analogDividerGain(c) * c.opampGain * analogEffectiveCalibrationGain(c);
  let numerator = [gain];
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
function cAdd(a, b) {
  return { re: a.re + b.re, im: a.im + b.im };
}
function cMul(a, b) {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}
function cMulS(a, s) {
  return { re: a.re * s, im: a.im * s };
}
function cDiv(a, b) {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}
function cplx(re, im) {
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
  const sense = analogComponents.calibratedAnalog.map((v, i) => cMul(v, adcResponse[i]));
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
    const openLoop = controllerResponse.map((c, i) => cMul(cMul(cMul(c, fmPlant[i]), sense[i]), delay[i]));
    const closedLoop = openLoop.map((v) => cDiv(v, cAdd(v, cplx(1, 0))));
    const sensitivity = openLoop.map((v) => cDiv(cplx(1, 0), cAdd(v, cplx(1, 0))));
    responses[`delay_${envelope}`] = delay;
    responses[`open_loop_${envelope}`] = openLoop;
    responses[`closed_loop_${envelope}`] = closedLoop;
    responses[`sensitivity_${envelope}`] = sensitivity;
    margins[envelope] = calculateStabilityMargins(frequencies, openLoop);
  }
  const zout = sisoFrequencyResponse(smallSignal.outputImpedanceTransfer, frequencies);
  responses["closed_loop_output_impedance"] = zout.map((z, i) => cMul(z, responses["sensitivity_nominal"][i]));
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
function make2P2ZForTarget(fc, hpRatio, sampleTimeS, gain, zeroRatio = 2) {
  const nyquist = 0.5 / sampleTimeS;
  const poleHz = Math.min(hpRatio * fc, 0.4 * nyquist);
  const zerosHz = [fc / zeroRatio, fc / (2 * zeroRatio)];
  const polesHz = [poleHz, poleHz];
  return twoP2ZFromAnalogPolesZeros({
    gain,
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
export {
  evaluateOpenLoopAt,
  interp,
  make2P2ZForTarget,
  makeGridWithFc,
  phaseMarginFromPhaseDeg,
  tuneVoltageLoop
};
