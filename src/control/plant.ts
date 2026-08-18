/**
 * LLC 功率级非线性动态相量/EDF 模型（从仓库 llc_design/dynamics/plant.py 移植）
 *
 * 状态（7 个）：[i_r,c, i_r,s, v_Cr,c, v_Cr,s, i_m,c, i_m,s, v_Co]
 * 输入（3 个）：[switching_frequency_hz, bus_voltage_v, load_current_disturbance_a]
 *
 * 本文件同时移植非线性稳态求解器（对应 scipy.optimize.root method="hybr"，
 * 用阻尼牛顿法 + 数值雅可比替代）与调频外环（brentq + 黄金分割）。
 */

import { brentq, type Complex } from '../core/numeric.ts'
import type { LLCOperatingPoint } from '../core/operatingPoint.ts'
import type { LLCDesignSpec } from '../core/spec.ts'
import type { TankDesign } from '../core/tank.ts'
import { matMul, matVec, solveLinear } from './linalg.ts'

export const PI = Math.PI
export const FOUR_OVER_PI = 4.0 / PI
export const TWO_OVER_PI = 2.0 / PI
export const SQRT2 = Math.sqrt(2.0)

export class PlantModelError extends Error {}

export interface LLCPlantInputs {
  switchingFrequencyHz: number
  busVoltageV: number
  loadCurrentDisturbanceA: number
}

export function inputsToArray(u: LLCPlantInputs): number[] {
  return [u.switchingFrequencyHz, u.busVoltageV, u.loadCurrentDisturbanceA]
}

export interface LLCPlantParameters {
  lrH: number
  crF: number
  lmH: number
  outputCapacitanceF: number
  outputCapEsrOhm: number
  loadResistanceOhm: number
  turnsRatio: number
  bridgeGain: number
  seriesResistanceOhm: number
  magnetizingSeriesResistanceOhm: number
  rectifierEquivalentDropV: number
  primaryDeadtimeS: number
  primaryTopology: string
  primaryTurns: number
  secondaryTurns: number
  transformerCoreAreaM2: number
  transformerMagneticPathM: number
  resonantInductorTurns: number
  resonantInductorCoreAreaM2: number
  resonantInductorMagneticPathM: number
}

export function validatePlantParameters(p: LLCPlantParameters): void {
  const bad: string[] = []
  if (p.lrH <= 0) bad.push('Lr')
  if (p.crF <= 0) bad.push('Cr')
  if (p.lmH <= 0) bad.push('Lm')
  if (p.outputCapacitanceF <= 0) bad.push('Co')
  if (p.loadResistanceOhm <= 0) bad.push('Rload')
  if (p.turnsRatio <= 0) bad.push('turns ratio')
  if (p.bridgeGain <= 0) bad.push('bridge gain')
  if (bad.length > 0) throw new Error('plant parameters must be positive: ' + bad.join(', '))
  if (p.outputCapEsrOhm < 0) throw new Error('output capacitor ESR cannot be negative')
  if (p.seriesResistanceOhm < 0) throw new Error('series resistance cannot be negative')
}

/**
 * 由设计与工作点构建 plant 参数（对应 LLCPlantParameters.from_design）。
 * analysis 为 null 时：保留显式 Cr ESR + 0.10Ω 参考阻尼。
 */
export function plantParametersFromDesign(
  spec: LLCDesignSpec, tank: TankDesign, operatingPoint: LLCOperatingPoint,
  seriesResistanceOhm?: number,
): LLCPlantParameters {
  if (operatingPoint.poutW <= 0) throw new Error('operating point output power must be positive')
  const rLoad = spec.voutV ** 2 / operatingPoint.poutW
  let rSeries: number
  if (seriesResistanceOhm !== undefined) {
    rSeries = seriesResistanceOhm
  } else {
    rSeries = spec.resonantCapEsrOhm + 0.10
  }
  const params: LLCPlantParameters = {
    lrH: tank.lrH,
    crF: tank.crF,
    lmH: tank.lmH,
    outputCapacitanceF: spec.outputCapacitanceF,
    outputCapEsrOhm: spec.outputCapEsrOhm,
    loadResistanceOhm: rLoad,
    turnsRatio: spec.primaryTurns / spec.secondaryTurns,
    bridgeGain: spec.primaryTopology === 'FULL_BRIDGE' ? 1.0 : 0.5,
    seriesResistanceOhm: Math.max(rSeries, 1e-6),
    magnetizingSeriesResistanceOhm: 0.0,
    rectifierEquivalentDropV: spec.rectifierEquivalentDropV,
    primaryDeadtimeS: spec.primaryDeadtimeS,
    primaryTopology: spec.primaryTopology,
    primaryTurns: spec.primaryTurns,
    secondaryTurns: spec.secondaryTurns,
    transformerCoreAreaM2: 0.0,
    transformerMagneticPathM: 0.0,
    resonantInductorTurns: 0,
    resonantInductorCoreAreaM2: 0.0,
    resonantInductorMagneticPathM: 0.0,
  }
  validatePlantParameters(params)
  return params
}

export interface DynamicPhasorSteadyState {
  states: number[]
  inputs: LLCPlantInputs
  residualNorm: number
  iterations: number
  converged: boolean
  outputVoltageV: number
  outputCapacitorVoltageV: number
  rectifierCurrentAvgA: number
  resonantCurrentPeakA: number
  resonantCurrentRmsA: number
  magnetizingCurrentPeakA: number
  magnetizingCurrentRmsA: number
  primaryLoadCurrentPeakA: number
  secondaryCurrentRmsA: number
  targetOutputVoltageV?: number
  outputVoltageErrorV: number
  frequencyTrimmed: boolean
}

export const STATE_NAMES = [
  'ir_cos_a', 'ir_sin_a', 'vcr_cos_v', 'vcr_sin_v',
  'im_cos_a', 'im_sin_a', 'vco_v',
]
export const INPUT_NAMES = ['switching_frequency_hz', 'bus_voltage_v', 'load_current_disturbance_a']
export const OUTPUT_NAMES = [
  'output_voltage_v', 'resonant_current_rms_a', 'magnetizing_current_rms_a',
  'secondary_current_rms_a', 'rectifier_current_avg_a', 'output_capacitor_voltage_v',
]

export class DynamicPhasorModel {
  p: LLCPlantParameters

  constructor(parameters: LLCPlantParameters) {
    validatePlantParameters(parameters)
    this.p = parameters
  }

  static amplitude(cosine: number, sine: number, epsilon = 1e-12): number {
    return Math.sqrt(cosine * cosine + sine * sine + epsilon)
  }

  /** 代数整流器/输出量（对应 algebraic()） */
  algebraic(states: number[], inputs: LLCPlantInputs): Record<string, number> {
    const irC = states[0]!
    const irS = states[1]!
    const imC = states[4]!
    const imS = states[5]!
    const vco = states[6]!
    const loadC = irC - imC
    const loadS = irS - imS
    const loadPeak = DynamicPhasorModel.amplitude(loadC, loadS)
    const iRectAvg = TWO_OVER_PI * this.p.turnsRatio * loadPeak

    const rload = this.p.loadResistanceOhm
    const esr = this.p.outputCapEsrOhm
    const iDist = inputs.loadCurrentDisturbanceA
    // Co ESR 作为内电容电压与输出端子之间的串联元件
    const vout = (rload * vco + rload * esr * (iRectAvg - iDist)) / (rload + esr)

    const clampSecondaryV = Math.max(vout + this.p.rectifierEquivalentDropV, 0.0)
    const signFundamentalGain = FOUR_OVER_PI / loadPeak
    const vpC = this.p.turnsRatio * clampSecondaryV * signFundamentalGain * loadC
    const vpS = this.p.turnsRatio * clampSecondaryV * signFundamentalGain * loadS
    return {
      primaryLoadCosA: loadC,
      primaryLoadSinA: loadS,
      primaryLoadPeakA: loadPeak,
      rectifierCurrentAvgA: iRectAvg,
      outputVoltageV: vout,
      vpCosV: vpC,
      vpSinV: vpS,
    }
  }

  /** 慢时状态导数（对应 rhs()） */
  rhs(states: number[], inputs: LLCPlantInputs): number[] {
    if (inputs.switchingFrequencyHz <= 0 || inputs.busVoltageV <= 0) {
      throw new Error('frequency and bus voltage must be positive')
    }
    const irC = states[0]!
    const irS = states[1]!
    const vcrC = states[2]!
    const vcrS = states[3]!
    const imC = states[4]!
    const imS = states[5]!
    const vco = states[6]!
    const alg = this.algebraic(states, inputs)
    const omega = 2.0 * PI * inputs.switchingFrequencyHz
    // 方波桥参考 sin(theta)，基波峰值 4/π·方波幅值
    const vbC = 0.0
    const vbS = FOUR_OVER_PI * this.p.bridgeGain * inputs.busVoltageV
    const vpC = alg['vpCosV']!
    const vpS = alg['vpSinV']!

    const fIrC = (vbC - vcrC - vpC - this.p.seriesResistanceOhm * irC) / this.p.lrH
    const fIrS = (vbS - vcrS - vpS - this.p.seriesResistanceOhm * irS) / this.p.lrH
    const dIrC = fIrC - omega * irS
    const dIrS = fIrS + omega * irC

    const dVcrC = irC / this.p.crF - omega * vcrS
    const dVcrS = irS / this.p.crF + omega * vcrC

    const fImC = (vpC - this.p.magnetizingSeriesResistanceOhm * imC) / this.p.lmH
    const fImS = (vpS - this.p.magnetizingSeriesResistanceOhm * imS) / this.p.lmH
    const dImC = fImC - omega * imS
    const dImS = fImS + omega * imC

    const rload = this.p.loadResistanceOhm
    const esr = this.p.outputCapEsrOhm
    const iCap = alg['rectifierCurrentAvgA']! - alg['outputVoltageV']! / rload - inputs.loadCurrentDisturbanceA
    const dVco = iCap / this.p.outputCapacitanceF

    return [dIrC, dIrS, dVcrC, dVcrS, dImC, dImS, dVco]
  }

  /** 标准输出向量（对应 outputs()） */
  outputs(states: number[], inputs: LLCPlantInputs): number[] {
    const irC = states[0]!
    const irS = states[1]!
    const imC = states[4]!
    const imS = states[5]!
    const alg = this.algebraic(states, inputs)
    const irPeak = DynamicPhasorModel.amplitude(irC, irS)
    const imPeak = DynamicPhasorModel.amplitude(imC, imS)
    const loadPeak = alg['primaryLoadPeakA']!
    return [
      alg['outputVoltageV']!,
      irPeak / SQRT2,
      imPeak / SQRT2,
      this.p.turnsRatio * loadPeak / SQRT2,
      alg['rectifierCurrentAvgA']!,
      states[6]!,
    ]
  }

  /** FHA 电路初值（对应 initial_guess()） */
  initialGuess(inputs: LLCPlantInputs, operatingPoint?: LLCOperatingPoint, outputVoltageGuessV?: number): number[] {
    const omega = 2.0 * PI * inputs.switchingFrequencyHz
    let rac: number
    let vout: number
    if (operatingPoint) {
      rac = operatingPoint.racOhm
      vout = outputVoltageGuessV ?? operatingPoint.outputCurrentA * this.p.loadResistanceOhm
    } else {
      vout = outputVoltageGuessV ?? Math.sqrt(Math.max(inputs.busVoltageV ** 2 / Math.max(this.p.loadResistanceOhm, 1e-12), 1.0))
      rac = (8.0 / PI ** 2) * this.p.turnsRatio ** 2 * this.p.loadResistanceOhm
    }
    // Re{X·exp(jθ)} = x_c·cosθ + x_s·sinθ → X = x_c − j·x_s；桥基波为正弦
    const vbPeak = FOUR_OVER_PI * this.p.bridgeGain * inputs.busVoltageV
    const vb: Complex = { re: 0, im: -vbPeak }
    const zSeries: Complex = {
      re: this.p.seriesResistanceOhm,
      im: omega * this.p.lrH - 1 / (omega * this.p.crF),
    }
    const zLm: Complex = { re: 0, im: omega * this.p.lmH }
    const zParallel = cInv(cAdd(cInv(cplx(Math.max(rac, 1e-9), 0)), cInv(zLm)))
    const ir = cDiv(vb, cAdd(zSeries, zParallel))
    const vp = cMul(ir, zParallel)
    const im = cDiv(vp, zLm)
    const vcr = cDiv(ir, cplx(0, omega * this.p.crF))
    // X = x_c − j·x_s → x_c = Re(X), x_s = −Im(X)
    return [ir.re, -ir.im, vcr.re, -vcr.im, im.re, -im.im, vout]
  }

  /**
   * 稳态求解：rhs(x,u)=0（对应 solve_steady_state）。
   * 用阻尼牛顿法 + 中心差分雅可比替代 scipy root(hybr)。
   */
  solveSteadyState(
    inputs: LLCPlantInputs,
    options: { operatingPoint?: LLCOperatingPoint; initialStates?: number[]; tolerance?: number; maxEvaluations?: number } = {},
  ): DynamicPhasorSteadyState {
    const { operatingPoint, initialStates, tolerance = 1e-9, maxEvaluations = 1000 } = options
    let x: number[] = initialStates ? [...initialStates] : this.initialGuess(inputs, operatingPoint)
    if (x.length !== 7) throw new Error('dynamic-phasor initial state must contain seven values')

    // 残差缩放（与 Python 一致）
    const currentScale = Math.max(operatingPoint?.resonantCurrentPeakA ?? 10.0, 1.0)
    const voltageScale = Math.max(inputs.busVoltageV, 10.0)
    const outputScale = Math.max(operatingPoint?.outputCurrentA ?? voltageScale / this.p.loadResistanceOhm, 1.0)
    const omega = 2.0 * PI * inputs.switchingFrequencyHz
    const scales = [
      currentScale * omega, currentScale * omega,
      voltageScale * omega, voltageScale * omega,
      currentScale * omega, currentScale * omega,
      outputScale / this.p.outputCapacitanceF,
    ]

    const residual = (xx: number[]): number[] => {
      const r = this.rhs(xx, inputs)
      return r.map((v, i) => v / scales[i]!)
    }

    let evaluations = 0
    const relativeStep = 1e-6

    const residualNorm = (xx: number[]): number => {
      const r = residual(xx)
      return Math.sqrt(r.reduce((acc, v) => acc + v * v, 0))
    }

    let norm = residualNorm(x)
    for (let iter = 0; iter < maxEvaluations; iter++) {
      evaluations++
      if (norm <= 1e-6) break
      // 数值雅可比（中心差分）
      const jac = this.centralJacobian(residual, x, relativeStep)
      const negR = residual(x).map(v => -v)
      const delta = solveLinear(jac, negR)
      if (!delta) {
        // 奇异雅可比：微扰重试
        x = x.map((v, i) => v * (1 + 1e-8) + 1e-10)
        norm = residualNorm(x)
        continue
      }
      // 阻尼：λ 减半直到残差下降
      let lambda = 1.0
      let accepted = false
      let xNew: number[] = []
      let normNew = norm
      for (let step = 0; step < 40; step++) {
        xNew = x.map((v, i) => v + lambda * delta[i]!)
        normNew = residualNorm(xNew)
        if (normNew < norm) {
          accepted = true
          break
        }
        lambda *= 0.5
      }
      if (!accepted) {
        // 停滞：无法继续下降
        break
      }
      x = xNew
      norm = normNew
    }

    const rawNorm = Math.sqrt(this.rhs(x, inputs).reduce((acc, v) => acc + v * v, 0))
    const normalizedNorm = norm
    const converged = normalizedNorm <= 1e-6
    if (!converged) {
      throw new PlantModelError(
        `dynamic-phasor steady-state solve failed: normalized residual=${normalizedNorm.toExponential(3)}`,
      )
    }

    const out = this.outputs(x, inputs)
    const alg = this.algebraic(x, inputs)
    return {
      states: x,
      inputs,
      residualNorm: rawNorm,
      iterations: evaluations,
      converged,
      outputVoltageV: out[0]!,
      outputCapacitorVoltageV: out[5]!,
      rectifierCurrentAvgA: out[4]!,
      resonantCurrentPeakA: out[1]! * SQRT2,
      resonantCurrentRmsA: out[1]!,
      magnetizingCurrentPeakA: out[2]! * SQRT2,
      magnetizingCurrentRmsA: out[2]!,
      primaryLoadCurrentPeakA: alg['primaryLoadPeakA']!,
      secondaryCurrentRmsA: out[3]!,
      outputVoltageErrorV: 0,
      frequencyTrimmed: false,
    }
  }

  /** 中心差分雅可比 */
  centralJacobian(fn: (x: number[]) => number[], point: number[], relativeStep: number, absoluteSteps?: number[]): number[][] {
    const n = point.length
    const value = fn(point)
    const jac: number[][] = Array.from({ length: value.length }, () => new Array<number>(n).fill(0))
    for (let col = 0; col < n; col++) {
      const step = absoluteSteps
        ? Math.max(absoluteSteps[col]!, relativeStep * Math.max(Math.abs(point[col]!), 1.0))
        : relativeStep * Math.max(Math.abs(point[col]!), 1.0)
      const plus = [...point]
      const minus = [...point]
      plus[col]! += step
      minus[col]! -= step
      const fp = fn(plus)
      const fm = fn(minus)
      for (let row = 0; row < value.length; row++) {
        jac[row]![col] = (fp[row]! - fm[row]!) / (2 * step)
      }
    }
    return jac
  }

  /**
   * 调频外环：求解 Vo(fs) = Vo_target（对应 solve_regulated_steady_state）。
   * 网格扫根 + brentq 精化；无根时黄金分割最小化误差。
   */
  solveRegulatedSteadyState(options: {
    busVoltageV: number
    targetOutputVoltageV: number
    frequencyGuessHz: number
    minimumFrequencyHz: number
    maximumFrequencyHz: number
    operatingPoint?: LLCOperatingPoint
    loadCurrentDisturbanceA?: number
    outputToleranceV?: number
    frequencySamples?: number
  }): DynamicPhasorSteadyState {
    const {
      busVoltageV, targetOutputVoltageV, minimumFrequencyHz, maximumFrequencyHz,
      operatingPoint, loadCurrentDisturbanceA = 0,
      outputToleranceV = 2e-3, frequencySamples = 31,
    } = options
    if (busVoltageV <= 0 || targetOutputVoltageV <= 0) {
      throw new Error('bus and target output voltage must be positive')
    }
    if (!(0 < minimumFrequencyHz && minimumFrequencyHz < maximumFrequencyHz)) {
      throw new Error('invalid regulated-frequency bounds')
    }
    let freqGuess = options.frequencyGuessHz
    if (!(minimumFrequencyHz <= freqGuess && freqGuess <= maximumFrequencyHz)) {
      freqGuess = Math.min(Math.max(freqGuess, minimumFrequencyHz), maximumFrequencyHz)
    }
    const samples = Math.max(Math.trunc(frequencySamples), 9)

    const cache = new Map<number, DynamicPhasorSteadyState>()
    let lastStates: number[] | null = null

    const solveAt = (frequencyHz: number): DynamicPhasorSteadyState => {
      const key = frequencyHz
      if (cache.has(key)) return cache.get(key)!
      const inputs: LLCPlantInputs = {
        switchingFrequencyHz: key, busVoltageV, loadCurrentDisturbanceA,
      }
      let steady: DynamicPhasorSteadyState
      try {
        steady = this.solveSteadyState(inputs, { operatingPoint, initialStates: lastStates ?? undefined })
      } catch {
        steady = this.solveSteadyState(inputs, { operatingPoint })
      }
      lastStates = steady.states
      cache.set(key, steady)
      return steady
    }

    const error = (frequencyHz: number): number => solveAt(frequencyHz).outputVoltageV - targetOutputVoltageV

    // 对数网格 + FHA 估计
    const gridVals: number[] = []
    const nGrid = samples
    const ratio = Math.pow(maximumFrequencyHz / minimumFrequencyHz, 1 / (nGrid - 1))
    for (let i = 0; i < nGrid; i++) {
      gridVals.push(minimumFrequencyHz * ratio ** i)
    }
    gridVals[gridVals.length - 1] = maximumFrequencyHz
    const grid = [...new Set([...gridVals, freqGuess])].sort((a, b) => a - b)

    const values: Array<[number, number]> = []
    for (const frequency of grid) {
      try {
        values.push([frequency, error(frequency)])
      } catch {
        continue
      }
    }
    if (values.length === 0) {
      throw new PlantModelError('regulated EDF solve failed at every sampled frequency')
    }

    const roots: number[] = []
    for (let i = 0; i < values.length - 1; i++) {
      const [f0, e0] = values[i]!
      const [f1, e1] = values[i + 1]!
      if (Math.abs(e0) <= outputToleranceV) roots.push(f0)
      if (e0 * e1 < 0.0) {
        try {
          const res = brentq(error, f0, f1, 1e-7, 0, 100)
          roots.push(res.root)
        } catch {
          // 跳过该区间
        }
      }
    }
    if (Math.abs(values[values.length - 1]![1]) <= outputToleranceV) {
      roots.push(values[values.length - 1]![0])
    }

    let steady: DynamicPhasorSteadyState
    if (roots.length > 0) {
      const selected = roots.reduce((best, f) =>
        Math.abs(f - freqGuess) < Math.abs(best - freqGuess) ? f : best)
      steady = solveAt(selected)
    } else {
      // 黄金分割最小化 |error(f)|
      const fMin = goldenSection(f => Math.abs(error(f)), minimumFrequencyHz, maximumFrequencyHz, 1e-6)
      steady = solveAt(fMin)
      if (Math.abs(steady.outputVoltageV - targetOutputVoltageV) > outputToleranceV) {
        throw new PlantModelError(
          'regulated EDF frequency solve cannot reach target output: ' +
          `best Vo=${steady.outputVoltageV.toFixed(6)} V at ${(steady.inputs.switchingFrequencyHz / 1e3).toFixed(6)} kHz`,
        )
      }
    }

    return {
      ...steady,
      targetOutputVoltageV,
      outputVoltageErrorV: steady.outputVoltageV - targetOutputVoltageV,
      frequencyTrimmed: true,
    }
  }
}

/** 黄金分割一维最小化（替代 scipy minimize_scalar method="bounded"） */
export function goldenSection(f: (x: number) => number, a: number, b: number, tol = 1e-6): number {
  const phi = (Math.sqrt(5) - 1) / 2
  let lo = a
  let hi = b
  let c = hi - phi * (hi - lo)
  let d = lo + phi * (hi - lo)
  let fc = f(c)
  let fd = f(d)
  for (let i = 0; i < 200; i++) {
    if (Math.abs(hi - lo) < tol) break
    if (fc < fd) {
      hi = d
      d = c
      fd = fc
      c = hi - phi * (hi - lo)
      fc = f(c)
    } else {
      lo = c
      c = d
      fc = fd
      d = lo + phi * (hi - lo)
      fd = f(d)
    }
  }
  return (lo + hi) / 2
}

// 复数助手
function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im }
}
function cInv(a: Complex): Complex {
  const d = a.re * a.re + a.im * a.im
  return { re: a.re / d, im: -a.im / d }
}
function cMul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }
}
function cDiv(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }
}
function cplx(re: number, im: number): Complex {
  return { re, im }
}

export { matMul, matVec }
