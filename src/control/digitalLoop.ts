/**
 * LLC 数字电压环建模（从仓库 llc_design/control/digital_loop.py 移植）
 *
 * 信号链：Vout → 模拟分压/滤波 → ADC 多 SOC 递归平均 → PI/PIF/2P2Z
 *         → PCMD → 分段 FM LUT → PWM/ZOH → Gvf(s)
 *
 * 频域实现是混合域：连续功率级/模拟块在 s=jω 求值；数字块在 z=e^{jωTs}。
 * 另有全离散近似用于 z 平面极点检查。
 */

import { DigitalTransferFunction, cont2discreteBilinear, sisoFrequencyResponse } from './tf.ts'
import {
  geomspace, interp, searchsorted, sinc, unwrap,
} from './linalg.ts'
import type { SISOTransferFunction } from './tf.ts'

// ── 控制器类型 ─────────────────────────────────────────────────────

export type ControllerKind = 'pi' | 'pif' | '2p2z'
export type FMLUTMode = 'pcmd_to_tbprd' | 'pcmd_to_frequency'
export type PWMCountMode = 'up' | 'up_down'
export type DelayEnvelope = 'minimum' | 'nominal' | 'maximum'

export function pwmFrequencyDivisor(mode: PWMCountMode): number {
  return mode === 'up' ? 1.0 : 2.0
}

// ── 控制器配置 ─────────────────────────────────────────────────────

export interface PIControllerConfig {
  kp: number
  tiS: number
  sampleTimeS: number
  outputMin: number
  outputMax: number
  kind: 'pi'
}

export interface PIFControllerConfig {
  kp: number
  tiS: number
  lpfCutoffHz: number
  sampleTimeS: number
  outputMin: number
  outputMax: number
  kind: 'pif'
}

export interface TwoP2ZControllerConfig {
  b0: number
  b1: number
  b2: number
  a1: number
  a2: number
  sampleTimeS: number
  outputMin: number
  outputMax: number
  kind: '2p2z'
}

export type ControllerConfig = PIControllerConfig | PIFControllerConfig | TwoP2ZControllerConfig

export function makePiConfig(
  kp = 0.01, tiS = 1e-3, sampleTimeS = 20e-6, outputMin = 0, outputMax = 1,
): PIControllerConfig {
  return { kp, tiS, sampleTimeS, outputMin, outputMax, kind: 'pi' }
}

export function makePifConfig(
  kp = 0.01, tiS = 1e-3, lpfCutoffHz = 3500, sampleTimeS = 20e-6,
  outputMin = 0, outputMax = 1,
): PIFControllerConfig {
  return { kp, tiS, lpfCutoffHz, sampleTimeS, outputMin, outputMax, kind: 'pif' }
}

export function makeTwoP2ZConfig(
  b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0,
  sampleTimeS = 20e-6, outputMin = 0, outputMax = 1,
): TwoP2ZControllerConfig {
  return { b0, b1, b2, a1, a2, sampleTimeS, outputMin, outputMax, kind: '2p2z' }
}

export function controllerKind(config: ControllerConfig): ControllerKind {
  return config.kind
}

/** PI 精确线性传递（固件实现：i[k]=i[k-1]+ki2·(e[k]+e[k-1])；u=Kp·(e+i)） */
export function piTransferFunction(config: PIControllerConfig): DigitalTransferFunction {
  if (config.kp <= 0 || config.tiS <= 0 || config.sampleTimeS <= 0) {
    throw new Error('PI Kp, Ti and sample time must be positive')
  }
  const ki2 = config.sampleTimeS / (2.0 * config.tiS)
  return new DigitalTransferFunction(
    [config.kp * (1.0 + ki2), config.kp * (-1.0 + ki2)],
    [1, -1],
    config.sampleTimeS, 'PI(z)',
  )
}

/** PIF：PI 级联输出 LPF */
export function pifAlpha(config: PIFControllerConfig): number {
  if (config.lpfCutoffHz <= 0) return 1.0
  const tau = 1.0 / (2.0 * Math.PI * config.lpfCutoffHz)
  return config.sampleTimeS / (config.sampleTimeS + tau)
}

export function pifTransferFunction(config: PIFControllerConfig): DigitalTransferFunction {
  const pi = piTransferFunction({
    kp: config.kp, tiS: config.tiS, sampleTimeS: config.sampleTimeS,
    outputMin: config.outputMin, outputMax: config.outputMax, kind: 'pi',
  })
  const alpha = pifAlpha(config)
  const outputLpf = new DigitalTransferFunction(
    [alpha], [1, -(1 - alpha)], config.sampleTimeS, 'PI-output-LPF(z)',
  )
  return pi.cascade(outputLpf, 'PIF(z)')
}

export function twoP2ZTransferFunction(config: TwoP2ZControllerConfig): DigitalTransferFunction {
  return new DigitalTransferFunction(
    [config.b0, config.b1, config.b2],
    [1, config.a1, config.a2],
    config.sampleTimeS, '2P2Z(z)',
  )
}

/** 由模拟二阶零极点双线性变换创建 2P2Z（对应 from_analog_poles_zeros） */
export function twoP2ZFromAnalogPolesZeros(options: {
  gain: number
  zerosHz: number[]
  polesHz: number[]
  sampleTimeS: number
  outputMin?: number
  outputMax?: number
}): TwoP2ZControllerConfig {
  const { gain, zerosHz, polesHz, sampleTimeS, outputMin = 0, outputMax = 1 } = options
  if (zerosHz.length !== 2 || polesHz.length !== 2) {
    throw new Error('2P2Z analog design requires exactly two poles and two zeros')
  }
  const zerosRad = zerosHz.map(v => -2 * Math.PI * v)
  const polesRad = polesHz.map(v => -2 * Math.PI * v)
  // num_s = gain·(s−z0)(s−z1) → 降幂
  const numS = polyFromRoots(zerosRad).map(v => v * gain)
  const denS = polyFromRoots(polesRad)
  const { numZ, denZ } = cont2discreteBilinear(numS, denS, sampleTimeS)
  let num = numZ
  let den = denZ
  num = num.map(v => v / den[0]!)
  den = den.map(v => v / den[0]!)
  // 截取前 3 项（b0,b1,b2 / 1,a1,a2）
  const pad3 = (arr: number[]) => {
    const out = new Array<number>(3).fill(0)
    for (let i = 0; i < Math.min(3, arr.length); i++) out[i] = arr[i]!
    return out
  }
  const bn = pad3(num)
  const dn = pad3(den)
  return {
    b0: bn[0]!, b1: bn[1]!, b2: bn[2]!,
    a1: dn[1]!, a2: dn[2]!,
    sampleTimeS, outputMin, outputMax, kind: '2p2z',
  }
}

function polyFromRoots(rootsIn: number[]): number[] {
  let coeffs: number[] = [1]
  for (const root of rootsIn) {
    const next = new Array<number>(coeffs.length + 1).fill(0)
    for (let i = 0; i < coeffs.length; i++) {
      next[i]! += coeffs[i]!
      next[i + 1]! += -root * coeffs[i]!
    }
    coeffs = next
  }
  return coeffs
}

export function controllerTransferFunction(config: ControllerConfig): DigitalTransferFunction {
  switch (config.kind) {
    case 'pi': return piTransferFunction(config)
    case 'pif': return pifTransferFunction(config)
    case '2p2z': return twoP2ZTransferFunction(config)
  }
}

// ── FM LUT（分段频率调制查找表）───────────────────────────────────

export interface FrequencyModulatorLUT {
  pcmd: number[]
  values: number[]
  mode: FMLUTMode
  timerClockHz: number
  countMode: PWMCountMode
  name: string
}

export function makeFmLut(
  pcmd: number[], values: number[],
  mode: FMLUTMode = 'pcmd_to_tbprd', timerClockHz = 120e6,
  countMode: PWMCountMode = 'up_down', name = 'PCMD-FM-LUT',
): FrequencyModulatorLUT {
  if (pcmd.length < 2 || pcmd.length !== values.length) {
    throw new Error('FM LUT requires two or more PCMD/value pairs')
  }
  for (let i = 1; i < pcmd.length; i++) {
    if (pcmd[i]! <= pcmd[i - 1]!) throw new Error('FM LUT PCMD values must be strictly increasing')
  }
  if (pcmd[0]! > 0 || pcmd[pcmd.length - 1]! < 1.0) {
    throw new Error('FM LUT must cover the complete normalized PCMD range 0..1')
  }
  if (values.some(v => v <= 0)) throw new Error('FM LUT values must be positive')
  if (timerClockHz <= 0) throw new Error('PWM timer clock must be positive')
  return { pcmd, values, mode, timerClockHz, countMode, name }
}

export function fmLutFirmwareDefault(): FrequencyModulatorLUT {
  return makeFmLut(
    [0.0, 0.04, 0.08, 0.12, 0.16, 0.2, 0.25, 0.3, 0.355, 0.41, 0.465, 0.52, 0.5825, 0.645, 0.7075, 0.77, 0.8275, 0.885, 0.9425, 1.0],
    [240, 258, 279, 303, 332, 367, 424, 500, 533, 571, 615, 667, 706, 750, 800, 811, 822, 833, 845, 857],
    'pcmd_to_tbprd', 120e6, 'up_down', 'firmware-20-point-PCMD-TBPRD',
  )
}

export function fmSegmentIndex(lut: FrequencyModulatorLUT, command: number, side: 'left' | 'right' | 'auto' = 'auto'): number {
  const c = Math.min(Math.max(command, lut.pcmd[0]!), lut.pcmd[lut.pcmd.length - 1]!)
  const exact = lut.pcmd.findIndex(p => Math.abs(p - c) <= 1e-12)
  if (exact >= 0) {
    if (side === 'left') return Math.max(0, exact - 1)
    if (side === 'right') return Math.min(lut.pcmd.length - 2, exact)
    return Math.max(0, Math.min(lut.pcmd.length - 2, exact - 1))
  }
  return Math.max(0, Math.min(searchsorted(lut.pcmd, c) - 1, lut.pcmd.length - 2))
}

export function fmValue(lut: FrequencyModulatorLUT, command: number): number {
  const c = Math.min(Math.max(command, lut.pcmd[0]!), lut.pcmd[lut.pcmd.length - 1]!)
  return interp(c, lut.pcmd, lut.values)
}

export function fmTbprd(lut: FrequencyModulatorLUT, command: number): number {
  if (lut.mode === 'pcmd_to_tbprd') return fmValue(lut, command)
  const freq = fmValue(lut, command)
  return lut.timerClockHz / (pwmFrequencyDivisor(lut.countMode) * freq)
}

export function fmFrequencyHz(lut: FrequencyModulatorLUT, command: number): number {
  if (lut.mode === 'pcmd_to_frequency') return fmValue(lut, command)
  const tbprd = fmValue(lut, command)
  return lut.timerClockHz / (pwmFrequencyDivisor(lut.countMode) * tbprd)
}

export function fmCommandForFrequency(lut: FrequencyModulatorLUT, frequencyHz: number): number {
  const frequencies = lut.pcmd.map(v => fmFrequencyHz(lut, v))
  let monoInc = true
  let monoDec = true
  for (let i = 1; i < frequencies.length; i++) {
    if (frequencies[i]! <= frequencies[i - 1]!) monoInc = false
    if (frequencies[i]! >= frequencies[i - 1]!) monoDec = false
  }
  if (monoDec) return interp(frequencyHz, [...frequencies].reverse(), [...lut.pcmd].reverse())
  if (monoInc) return interp(frequencyHz, frequencies, lut.pcmd)
  // 无单调性：最近点
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < frequencies.length; i++) {
    const d = Math.abs(frequencies[i]! - frequencyHz)
    if (d < bestDist) { bestDist = d; best = i }
  }
  return lut.pcmd[best]!
}

export function fmLocalGainHzPerPu(lut: FrequencyModulatorLUT, command: number, side: 'left' | 'right' | 'auto' = 'auto'): number {
  const index = fmSegmentIndex(lut, command, side)
  const dp = lut.pcmd[index + 1]! - lut.pcmd[index]!
  const slopeValue = (lut.values[index + 1]! - lut.values[index]!) / dp
  if (lut.mode === 'pcmd_to_frequency') return slopeValue
  const tbprd = fmTbprd(lut, command)
  return -lut.timerClockHz / (pwmFrequencyDivisor(lut.countMode) * tbprd ** 2) * slopeValue
}

export interface FMOperatingPoint {
  commandPu: number
  frequencyHz: number
  tbprdCounts: number
  gainHzPerPu: number
  leftGainHzPerPu: number
  rightGainHzPerPu: number
  commandHeadroomLow: number
  commandHeadroomHigh: number
}

export function evaluateFmOperatingPoint(
  lut: FrequencyModulatorLUT,
  options: { switchingFrequencyHz: number; commandPu?: number },
): FMOperatingPoint {
  const command = options.commandPu !== undefined
    ? Math.min(Math.max(options.commandPu, 0.0), 1.0)
    : fmCommandForFrequency(lut, options.switchingFrequencyHz)
  return {
    commandPu: command,
    frequencyHz: fmFrequencyHz(lut, command),
    tbprdCounts: fmTbprd(lut, command),
    gainHzPerPu: fmLocalGainHzPerPu(lut, command),
    leftGainHzPerPu: fmLocalGainHzPerPu(lut, command, 'left'),
    rightGainHzPerPu: fmLocalGainHzPerPu(lut, command, 'right'),
    commandHeadroomLow: command,
    commandHeadroomHigh: 1.0 - command,
  }
}

// ── 模拟采样链 ─────────────────────────────────────────────────────

export interface AnalogSenseConfig {
  rupOhm: number
  rlowOhm: number
  dividerCapacitanceF: number
  opampGain: number
  opampBandwidthHz: number
  adcSeriesResistanceOhm: number
  adcShuntCapacitanceF: number
  normalizeToEngineeringUnits: boolean
  calibrationGain: number | null
}

export function makeAnalogSenseConfig(overrides: Partial<AnalogSenseConfig> = {}): AnalogSenseConfig {
  return {
    rupOhm: 117e3, rlowOhm: 1.6e3, dividerCapacitanceF: 1e-9,
    opampGain: 1.0, opampBandwidthHz: 0,
    adcSeriesResistanceOhm: 220, adcShuntCapacitanceF: 2e-9,
    normalizeToEngineeringUnits: true, calibrationGain: null,
    ...overrides,
  }
}

export function analogDividerGain(c: AnalogSenseConfig): number {
  return c.rlowOhm / (c.rupOhm + c.rlowOhm)
}
export function analogDividerTheveninOhm(c: AnalogSenseConfig): number {
  return c.rupOhm * c.rlowOhm / (c.rupOhm + c.rlowOhm)
}
export function analogDividerPoleHz(c: AnalogSenseConfig): number {
  if (c.dividerCapacitanceF <= 0) return Infinity
  return 1.0 / (2 * Math.PI * analogDividerTheveninOhm(c) * c.dividerCapacitanceF)
}
export function analogAdcRcPoleHz(c: AnalogSenseConfig): number {
  if (c.adcSeriesResistanceOhm <= 0 || c.adcShuntCapacitanceF <= 0) return Infinity
  return 1.0 / (2 * Math.PI * c.adcSeriesResistanceOhm * c.adcShuntCapacitanceF)
}
export function analogEffectiveCalibrationGain(c: AnalogSenseConfig): number {
  if (c.calibrationGain !== null) return c.calibrationGain
  if (c.normalizeToEngineeringUnits) return 1.0 / (analogDividerGain(c) * c.opampGain)
  return 1.0
}

export interface AnalogFrequencyComponents {
  divider: { re: number; im: number }[]
  opamp: { re: number; im: number }[]
  adcRc: { re: number; im: number }[]
  rawAnalog: { re: number; im: number }[]
  calibratedAnalog: { re: number; im: number }[]
}

export function analogFrequencyResponseComponents(
  c: AnalogSenseConfig, frequenciesHz: number[],
): AnalogFrequencyComponents {
  const dividerGain = analogDividerGain(c)
  const dividerThevenin = analogDividerTheveninOhm(c)
  const calGain = analogEffectiveCalibrationGain(c)
  const divider: { re: number; im: number }[] = []
  const opamp: { re: number; im: number }[] = []
  const adcRc: { re: number; im: number }[] = []
  const raw: { re: number; im: number }[] = []
  const calibrated: { re: number; im: number }[] = []
  for (const f of frequenciesHz) {
    const s = { re: 0, im: 2 * Math.PI * f }
    let dv = { re: dividerGain, im: 0 }
    if (c.dividerCapacitanceF > 0) {
      dv = cDiv(dv, cAdd(cplx(1, 0), cMulS(s, dividerThevenin * c.dividerCapacitanceF)))
    }
    let oa = { re: c.opampGain, im: 0 }
    if (c.opampBandwidthHz > 0) {
      oa = cDiv(oa, cAdd(cplx(1, 0), cMulS(s, 1 / (2 * Math.PI * c.opampBandwidthHz))))
    }
    let rc = { re: 1, im: 0 }
    if (c.adcSeriesResistanceOhm > 0 && c.adcShuntCapacitanceF > 0) {
      rc = cDiv(rc, cAdd(cplx(1, 0), cMulS(s, c.adcSeriesResistanceOhm * c.adcShuntCapacitanceF)))
    }
    const rawV = cMul(cMul(dv, oa), rc)
    divider.push(dv)
    opamp.push(oa)
    adcRc.push(rc)
    raw.push(rawV)
    calibrated.push(cMulS(rawV, calGain))
  }
  return { divider, opamp, adcRc, rawAnalog: raw, calibratedAnalog: calibrated }
}

/** 工程单位模拟采样链的连续传递函数（对应 normalized_continuous_tf） */
export function analogNormalizedContinuousTf(c: AnalogSenseConfig): [number[], number[]] {
  const gain = analogDividerGain(c) * c.opampGain * analogEffectiveCalibrationGain(c)
  let numerator = [gain]
  let denominator = [1]
  const taus = [
    analogDividerTheveninOhm(c) * c.dividerCapacitanceF,
    c.opampBandwidthHz > 0 ? 1 / (2 * Math.PI * c.opampBandwidthHz) : 0,
    c.adcSeriesResistanceOhm * c.adcShuntCapacitanceF,
  ]
  for (const tau of taus) {
    if (tau > 0) {
      denominator = polyConvolve(denominator, [tau, 1])
    }
  }
  return [numerator, denominator]
}

// ── ADC 采样配置 ───────────────────────────────────────────────────

export interface ADCSamplingConfig {
  controlSampleTimeS: number
  adcClockHz: number
  acquisitionTimeS: number
  conversionCycles: number
  socCount: number
  recursivePreviousWeight: number
  socSampleOffsetsS: number[] | null
}

export function makeAdcSamplingConfig(overrides: Partial<ADCSamplingConfig> = {}): ADCSamplingConfig {
  return {
    controlSampleTimeS: 20e-6, adcClockHz: 60e6, acquisitionTimeS: 300e-9,
    conversionCycles: 13, socCount: 3, recursivePreviousWeight: 0.25,
    socSampleOffsetsS: null, ...overrides,
  }
}

export function adcConversionTimeS(c: ADCSamplingConfig): number {
  return c.conversionCycles / c.adcClockHz
}
export function adcSocSlotTimeS(c: ADCSamplingConfig): number {
  return c.acquisitionTimeS + adcConversionTimeS(c)
}
export function adcSampleOffsetsS(c: ADCSamplingConfig): number[] {
  if (c.socSampleOffsetsS !== null) return c.socSampleOffsetsS
  return Array.from({ length: c.socCount }, (_, i) =>
    i * adcSocSlotTimeS(c) + 0.5 * c.acquisitionTimeS)
}
export function adcEocDelayS(c: ADCSamplingConfig): number {
  if (c.socSampleOffsetsS !== null) {
    return Math.max(...adcSampleOffsetsS(c)) + 0.5 * c.acquisitionTimeS + adcConversionTimeS(c)
  }
  return c.socCount * adcSocSlotTimeS(c)
}
export function adcCurrentSampleWeight(c: ADCSamplingConfig): number {
  return (1.0 - c.recursivePreviousWeight) / c.socCount
}
export function adcEffectiveSampleOffsetS(c: ADCSamplingConfig): number {
  const offsets = adcSampleOffsetsS(c)
  return offsets.reduce((a, b) => a + b, 0) / offsets.length
}

export function adcFrequencyResponse(c: ADCSamplingConfig, frequenciesHz: number[]): { re: number; im: number }[] {
  const offsets = adcSampleOffsetsS(c)
  const weight = adcCurrentSampleWeight(c)
  return frequenciesHz.map(f => {
    const omega = 2 * Math.PI * f
    const aperture = sinc(f * c.acquisitionTimeS)
    let re = 0
    let im = 0
    for (const offset of offsets) {
      const ph = omega * offset
      re += weight * aperture * Math.cos(ph)
      im += weight * aperture * Math.sin(ph)
    }
    // z^-1 递归平均：1/(1 - w·z^-1)
    const zInvRe = Math.cos(-omega * c.controlSampleTimeS)
    const zInvIm = Math.sin(-omega * c.controlSampleTimeS)
    const denRe = 1 - c.recursivePreviousWeight * zInvRe
    const denIm = -c.recursivePreviousWeight * zInvIm
    const d2 = denRe * denRe + denIm * denIm
    return {
      re: (re * denRe + im * denIm) / d2,
      im: (im * denRe - re * denIm) / d2,
    }
  })
}

export function adcSimplifiedDigitalFilter(c: ADCSamplingConfig): DigitalTransferFunction {
  return new DigitalTransferFunction(
    [1 - c.recursivePreviousWeight],
    [1, -c.recursivePreviousWeight],
    c.controlSampleTimeS, 'ADC-recursive-average(z)', 'sampled_voltage', 'measured_voltage',
  )
}

// ── 命令时序 ───────────────────────────────────────────────────────

export interface CommandTimingConfig {
  computationDelayS: number
  includeZeroOrderHold: boolean
}

export function makeCommandTimingConfig(overrides: Partial<CommandTimingConfig> = {}): CommandTimingConfig {
  return { computationDelayS: 1e-6, includeZeroOrderHold: true, ...overrides }
}

export function pwmZeroWaitS(switchingFrequencyHz: number, envelope: DelayEnvelope): number {
  if (switchingFrequencyHz <= 0) throw new Error('switching frequency must be positive')
  const period = 1 / switchingFrequencyHz
  if (envelope === 'minimum') return 0.0
  if (envelope === 'maximum') return period
  return 0.5 * period
}

export function applicationDelayS(
  c: CommandTimingConfig, adc: ADCSamplingConfig, switchingFrequencyHz: number, envelope: DelayEnvelope,
): number {
  return adcEocDelayS(adc) + c.computationDelayS + pwmZeroWaitS(switchingFrequencyHz, envelope)
}

export function commandTimingFrequencyResponse(
  c: CommandTimingConfig, adc: ADCSamplingConfig, switchingFrequencyHz: number,
  envelope: DelayEnvelope, frequenciesHz: number[],
): { re: number; im: number }[] {
  const delay = applicationDelayS(c, adc, switchingFrequencyHz, envelope)
  return frequenciesHz.map(f => {
    const omega = 2 * Math.PI * f
    let re = Math.cos(-omega * delay)
    let im = Math.sin(-omega * delay)
    if (c.includeZeroOrderHold) {
      const zohMag = sinc(f * adc.controlSampleTimeS)
      const zohPhase = -omega * 0.5 * adc.controlSampleTimeS
      const zohRe = zohMag * Math.cos(zohPhase)
      const zohIm = zohMag * Math.sin(zohPhase)
      const nre = re * zohRe - im * zohIm
      const nim = re * zohIm + im * zohRe
      re = nre
      im = nim
    }
    return { re, im }
  })
}

// ── 稳定裕度 ───────────────────────────────────────────────────────

export interface StabilityMargins {
  gainCrossoversHz: number[]
  phaseMarginsDeg: number[]
  phaseCrossoversHz: number[]
  gainMarginsDb: number[]
  criticalGainCrossoverHz: number | null
  phaseMarginDeg: number | null
  criticalPhaseCrossoverHz: number | null
  gainMarginDb: number | null
  delayMarginS: number | null
}

function logInterpolateCrossing(frequencies: number[], values: number[], target: number): Array<[number, number, number]> {
  const results: Array<[number, number, number]> = []
  const logF = frequencies.map(f => Math.log(Math.max(f, 1e-300)))
  const shifted = values.map(v => v - target)
  for (let i = 0; i < frequencies.length - 1; i++) {
    const a = shifted[i]!
    const b = shifted[i + 1]!
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    if (a === 0) { results.push([frequencies[i]!, i, 0]); continue }
    if (a * b > 0 || b === a) continue
    const fraction = -a / (b - a)
    const lf = logF[i]! + fraction * (logF[i + 1]! - logF[i]!)
    results.push([Math.exp(lf), i, fraction])
  }
  return results
}

function linearBetween(values: number[], index: number, fraction: number): number {
  return values[index]! + fraction * (values[index + 1]! - values[index]!)
}

export function calculateStabilityMargins(frequenciesHz: number[], openLoop: { re: number; im: number }[]): StabilityMargins {
  const magnitudeDb = openLoop.map(r => 20 * Math.log10(Math.max(Math.hypot(r.re, r.im), 1e-300)))
  const rawPhase = openLoop.map(r => Math.atan2(r.im, r.re))
  const phaseDeg = unwrap(rawPhase).map(p => p * 180 / Math.PI)

  const gainCrossings = logInterpolateCrossing(frequenciesHz, magnitudeDb, 0)
  const gcFrequencies: number[] = []
  const phaseMargins: number[] = []
  for (const [frequency, index, fraction] of gainCrossings) {
    let phase = linearBetween(phaseDeg, index, fraction)
    while (phase > 0) phase -= 360
    while (phase <= -360) phase += 360
    gcFrequencies.push(frequency)
    phaseMargins.push(180 + phase)
  }

  const minPhase = Math.min(...phaseDeg)
  const maxPhase = Math.max(...phaseDeg)
  const kMin = Math.floor((minPhase + 180) / 360) - 1
  const kMax = Math.ceil((maxPhase + 180) / 360) + 1
  let phaseCrossingsAll: Array<[number, number, number]> = []
  for (let k = kMin; k <= kMax; k++) {
    phaseCrossingsAll.push(...logInterpolateCrossing(frequenciesHz, phaseDeg, -180 + 360 * k))
  }
  phaseCrossingsAll.sort((a, b) => a[0] - b[0])
  const uniquePc: Array<[number, number, number]> = []
  for (const item of phaseCrossingsAll) {
    if (uniquePc.length === 0 || Math.abs(Math.log(item[0] / uniquePc[uniquePc.length - 1]![0])) > 1e-6) {
      uniquePc.push(item)
    }
  }

  const pcFrequencies: number[] = []
  const gainMargins: number[] = []
  for (const [frequency, index, fraction] of uniquePc) {
    const mag = linearBetween(magnitudeDb, index, fraction)
    pcFrequencies.push(frequency)
    gainMargins.push(-mag)
  }

  let criticalGc: number | null = null
  let criticalPm: number | null = null
  let delayMargin: number | null = null
  if (gcFrequencies.length > 0) {
    let criticalIndex = 0
    for (let i = 1; i < phaseMargins.length; i++) {
      if (phaseMargins[i]! < phaseMargins[criticalIndex]!) criticalIndex = i
    }
    criticalGc = gcFrequencies[criticalIndex]!
    criticalPm = phaseMargins[criticalIndex]!
    delayMargin = (criticalPm * Math.PI / 180) / (2 * Math.PI * criticalGc)
  }

  let criticalPc: number | null = null
  let criticalGm: number | null = null
  if (pcFrequencies.length > 0) {
    const pairs = gainMargins.map((m, i) => [m, pcFrequencies[i]!] as [number, number])
    const positive = pairs.filter(([m]) => m >= 0)
    const chosen = positive.length > 0
      ? positive.reduce((best, p) => (p[0] < best[0] ? p : best))
      : pairs.reduce((best, p) => (p[0] < best[0] ? p : best))
    criticalGm = chosen[0]
    criticalPc = chosen[1]
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
    delayMarginS: delayMargin,
  }
}

// 复数助手
function cAdd(a: { re: number; im: number }, b: { re: number; im: number }): { re: number; im: number } {
  return { re: a.re + b.re, im: a.im + b.im }
}
function cMul(a: { re: number; im: number }, b: { re: number; im: number }): { re: number; im: number } {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }
}
function cMulS(a: { re: number; im: number }, s: number): { re: number; im: number } {
  return { re: a.re * s, im: a.im * s }
}
function cDiv(a: { re: number; im: number }, b: { re: number; im: number }): { re: number; im: number } {
  const d = b.re * b.re + b.im * b.im
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }
}
function cplx(re: number, im: number): { re: number; im: number } {
  return { re, im }
}
function polyConvolve(a: number[], b: number[]): number[] {
  const out = new Array<number>(a.length + b.length - 1).fill(0)
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] = out[i + j]! + a[i]! * b[j]!
  }
  return out
}

export { sisoFrequencyResponse }

// ── 全离散近似（z 平面极点检查）────────────────────────────────────

export interface DiscreteClosedLoopApproximation {
  openLoopNumerator: number[]
  openLoopDenominator: number[]
  closedLoopDenominator: number[]
  closedLoopPoles: { re: number; im: number }[]
  stable: boolean
  integerDelaySamples: number
  fractionalDelaySamples: number
}

export function fractionalDelayThiran(delaySamples: number, sampleTimeS: number): DigitalTransferFunction {
  const delay = Math.min(Math.max(delaySamples, 0.0), 1.0)
  if (delay <= 1e-12) {
    return new DigitalTransferFunction([1], [1], sampleTimeS, 'fractional-delay')
  }
  const coefficient = (1.0 - delay) / (1.0 + delay)
  return new DigitalTransferFunction(
    [coefficient, 1.0], [1.0, coefficient], sampleTimeS, 'Thiran-fractional-delay',
  )
}

import { cont2discreteZoh, ss2tf as ss2tfFn } from './tf.ts'

export function continuousToDiscreteTf(
  numerator: number[], denominator: number[], sampleTimeS: number, name: string,
): DigitalTransferFunction {
  // 用可控型状态空间 + ZOH（对应 scipy cont2discrete zoh 对 TF 输入）
  const { numZ, denZ } = tfZoh(numerator, denominator, sampleTimeS)
  return new DigitalTransferFunction(numZ, denZ, sampleTimeS, name)
}

/** TF → 可控型 SS → ZOH 离散 → 返回 z 域 num/den */
export function tfZoh(numS: number[], denS: number[], ts: number): { numZ: number[]; denZ: number[] } {
  // 归一化分母首项为 1（与 scipy tf2ss 一致）
  const den0 = denS[0]!
  const den = denS.map(v => v / den0)
  const numRaw = numS.map(v => v / den0)
  const n = den.length - 1
  // 分子补前导零到 n+1（分子阶数可以低于分母）
  const num = [...new Array<number>(Math.max(0, n + 1 - numRaw.length)).fill(0), ...numRaw]
  // scipy 的 companion 排列（数值稳健）：
  //   A 首行 = [-a1, -a2, ..., -an]；次对角 A[i][i-1] = 1
  //   B = [1, 0, ..., 0]ᵀ；C[j] = b_{j+1} - b0·a_{j+1}；D = b0
  const a = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === 0) return -den[j + 1]!
      if (i === j + 1) return 1
      return 0
    }))
  const b = Array.from({ length: n }, (_, i) => (i === 0 ? [1] : [0]))
  const c = [Array.from({ length: n }, (_, j) => num[j + 1]! - num[0]! * den[j + 1]!)]
  const d = [[num[0]!]]
  const { ad, bd, cd, dd } = cont2discreteZoh(a, b, c, d, ts)
  const [numAll, denAll] = ss2tfFn(ad, bd, cd, dd, 0, 0)
  return { numZ: numAll, denZ: denAll }
}

// ── 主分析：build_digital_loop_analysis ────────────────────────────

export interface SmallSignalAnalysisLike {
  operatingPoint: { switchingFrequencyHz: number }
  continuousTransfer: SISOTransferFunction
  outputImpedanceTransfer: SISOTransferFunction
  discretePlant: { numerator: number[]; denominator: number[] }
  sampleTimeS: number
}

export interface DigitalLoopAnalysisResult {
  controllerConfig: ControllerConfig
  controller: DigitalTransferFunction
  fmLut: FrequencyModulatorLUT
  fmOperatingPoint: FMOperatingPoint
  analogSense: AnalogSenseConfig
  adcSampling: ADCSamplingConfig
  commandTiming: CommandTimingConfig
  frequenciesHz: number[]
  responses: Record<string, { re: number; im: number }[]>
  marginsMinimumDelay: StabilityMargins
  marginsNominalDelay: StabilityMargins
  marginsMaximumDelay: StabilityMargins
  discreteApproximation: DiscreteClosedLoopApproximation
  warnings: string[]
  /** 名义延迟下的开环与闭环频响（便捷访问） */
  readonly nominalOpenLoop: { re: number; im: number }[]
  readonly nominalClosedLoop: { re: number; im: number }[]
  readonly likelyStable: boolean
}

export function buildDigitalLoopAnalysis(
  smallSignal: SmallSignalAnalysisLike,
  options: {
    controllerConfig: ControllerConfig
    fmLut?: FrequencyModulatorLUT
    commandPu?: number
    analogSense?: AnalogSenseConfig
    adcSampling?: ADCSamplingConfig
    commandTiming?: CommandTimingConfig
    frequenciesHz?: number[]
  },
): DigitalLoopAnalysisResult {
  const { controllerConfig, commandPu } = options
  const controller = controllerTransferFunction(controllerConfig)
  const sampleTime = controller.sampleTimeS
  if (Math.abs(sampleTime - smallSignal.sampleTimeS) > 1e-15) {
    throw new Error('controller and LLC ZOH plant sample times must match')
  }
  const lut = options.fmLut ?? fmLutFirmwareDefault()
  const analog = options.analogSense ?? makeAnalogSenseConfig()
  const adc = options.adcSampling ?? makeAdcSamplingConfig({ controlSampleTimeS: sampleTime })
  const timing = options.commandTiming ?? makeCommandTimingConfig()
  if (Math.abs(adc.controlSampleTimeS - sampleTime) > 1e-15) {
    throw new Error('ADC and controller sample times must match')
  }

  const fsw = smallSignal.operatingPoint.switchingFrequencyHz
  const fm = evaluateFmOperatingPoint(lut, { switchingFrequencyHz: fsw, commandPu })

  let frequencies: number[]
  if (options.frequenciesHz !== undefined && options.frequenciesHz.length > 0) {
    frequencies = options.frequenciesHz
  } else {
    const nyquist = 0.5 / sampleTime
    const upper = Math.min(0.49 * nyquist, 0.25 * fsw)
    const lower = Math.max(0.1, upper / 2e5)
    frequencies = geomspace(lower, upper, 2400)
  }
  if (frequencies.some(f => f <= 0)) throw new Error('Bode frequencies must be positive')

  const plant = sisoFrequencyResponse(smallSignal.continuousTransfer, frequencies)
  const controllerResponse = controller.frequencyResponse(frequencies)
  const analogComponents = analogFrequencyResponseComponents(analog, frequencies)
  const adcResponse = adcFrequencyResponse(adc, frequencies)
  const sense = analogComponents.calibratedAnalog.map((v, i) => cMul(v, adcResponse[i]!))
  const fmPlant = plant.map(v => cMulS(v, fm.gainHzPerPu))

  const responses: Record<string, { re: number; im: number }[]> = {
    power_stage: plant,
    fm_power_stage: fmPlant,
    controller: controllerResponse,
    sense_analog_raw: analogComponents.rawAnalog,
    sense_analog_calibrated: analogComponents.calibratedAnalog,
    adc_sampling: adcResponse,
    sense_total: sense,
  }

  const margins: Record<string, StabilityMargins> = {}
  for (const envelope of ['minimum', 'nominal', 'maximum'] as DelayEnvelope[]) {
    const delay = commandTimingFrequencyResponse(timing, adc, fsw, envelope, frequencies)
    const openLoop = controllerResponse.map((c, i) => cMul(cMul(cMul(c, fmPlant[i]!), sense[i]!), delay[i]!))
    const closedLoop = openLoop.map(v => cDiv(v, cAdd(v, cplx(1, 0))))
    const sensitivity = openLoop.map(v => cDiv(cplx(1, 0), cAdd(v, cplx(1, 0))))
    responses[`delay_${envelope}`] = delay
    responses[`open_loop_${envelope}`] = openLoop
    responses[`closed_loop_${envelope}`] = closedLoop
    responses[`sensitivity_${envelope}`] = sensitivity
    margins[envelope] = calculateStabilityMargins(frequencies, openLoop)
  }

  // 闭环输出阻抗（名义灵敏度）
  const zout = sisoFrequencyResponse(smallSignal.outputImpedanceTransfer, frequencies)
  responses['closed_loop_output_impedance'] = zout.map((z, i) => cMul(z, responses['sensitivity_nominal']![i]!))

  // 全离散近似
  const plantD = new DigitalTransferFunction(
    smallSignal.discretePlant.numerator, smallSignal.discretePlant.denominator, sampleTime,
    'Gvf-ZOH(z)', 'frequency_hz', 'output_voltage_v',
  ).scaled(fm.gainHzPerPu, 'Gpcmd(z)')
  const [analogNum, analogDen] = analogNormalizedContinuousTf(analog)
  const analogD = continuousToDiscreteTf(analogNum, analogDen, sampleTime, 'analog-sense-ZOH(z)')
  const adcD = adcSimplifiedDigitalFilter(adc)

  const applicationDelay = applicationDelayS(timing, adc, fsw, 'nominal')
  const sampleToActuationDelay = Math.max(0.0, applicationDelay - adcEffectiveSampleOffsetS(adc))
  const delayInSamples = sampleToActuationDelay / sampleTime
  const integerDelay = Math.floor(delayInSamples)
  const fractionalDelay = delayInSamples - integerDelay
  const fractionalD = fractionalDelayThiran(fractionalDelay, sampleTime)

  let openD = controller.cascade(plantD).cascade(analogD).cascade(adcD).cascade(fractionalD)
  openD = openD.withDelay(integerDelay)
  const openNum = openD.numerator
  const openDen = openD.denominator
  const closedDen = polyAddArr(openDen, openNum)
  const closedPoles = closedDen.length > 1 ? rootsOf(closedDen) : []

  const warnings: string[] = []
  if (smallSignal.continuousTransfer.dcGain * fm.gainHzPerPu <= 0) {
    warnings.push(
      'PCMD-to-output low-frequency gain is non-positive; the firmware error polarity may create positive feedback at this operating point.',
    )
  }
  if (Math.min(fm.commandHeadroomLow, fm.commandHeadroomHigh) < 0.03) {
    warnings.push('PCMD operating point is within 3% of saturation; linear loop headroom is limited.')
  }
  if (Math.abs(fm.frequencyHz - fsw) / Math.max(fsw, 1e-12) > 0.01) {
    warnings.push(
      'The selected/custom FM LUT does not reproduce the plant operating frequency within 1%; PCMD linearization and plant work point are inconsistent.',
    )
  }
  if (controllerConfig.kind === 'pi' || controllerConfig.kind === 'pif') {
    if (controllerConfig.outputMin !== 0 || controllerConfig.outputMax !== 1) {
      warnings.push('Controller output limits differ from the requested normalized PCMD range 0..1.')
    }
  }
  warnings.push(
    'Linear Bode validity requires voltage-loop ownership: no current-limit min-selector takeover, burst, soft-start, saturation, OVP/UVP/OPP or hardware trip.',
  )

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
    marginsMinimumDelay: margins['minimum']!,
    marginsNominalDelay: margins['nominal']!,
    marginsMaximumDelay: margins['maximum']!,
    discreteApproximation: {
      openLoopNumerator: openNum,
      openLoopDenominator: openDen,
      closedLoopDenominator: closedDen,
      closedLoopPoles: closedPoles,
      stable: closedPoles.every(p => Math.hypot(p.re, p.im) < 1.0),
      integerDelaySamples: integerDelay,
      fractionalDelaySamples: fractionalDelay,
    },
    warnings,
    get nominalOpenLoop() { return this.responses['open_loop_nominal']! },
    get nominalClosedLoop() { return this.responses['closed_loop_nominal']! },
    get likelyStable() {
      const margin = this.marginsNominalDelay.phaseMarginDeg
      const gainMargin = this.marginsNominalDelay.gainMarginDb
      const marginOk = margin !== null && margin > 0
      const gainOk = gainMargin === null || gainMargin > 0
      return marginOk && gainOk && this.discreteApproximation.stable
    },
  }
}

import { roots as rootsFn } from './linalg.ts'

function rootsOf(coeffs: number[]): { re: number; im: number }[] {
  return rootsFn(coeffs)
}

function polyAddArr(a: number[], b: number[]): number[] {
  const len = Math.max(a.length, b.length)
  const out = new Array<number>(len).fill(0)
  for (let i = 0; i < len; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0)
  return out
}
