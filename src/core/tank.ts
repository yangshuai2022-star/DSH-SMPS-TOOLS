/**
 * FHA LLC 谐振腔模型（从仓库 llc_design/core/tank.py 移植）
 */

import { brentq, cAbs, cAdd, cDiv, cInv, cMul, cplx, geomspace, type Complex } from './numeric.ts'
import { bridgeGain, turnsRatio, validateSpec, type LLCDesignSpec } from './spec.ts'

export const SQRT2 = Math.sqrt(2.0)
export const FHA_RECTIFIER_K = (2.0 * SQRT2) / Math.PI

export interface TankDesign {
  lrH: number
  crF: number
  lmH: number
  racNomOhm: number
  zrOhm: number
  lnRatio: number
  qFullLoad: number
  frHz: number
  readonly fmHz: number
}

export interface TankState {
  frequencyHz: number
  racOhm: number
  zSeriesOhm: Complex
  zParallelOhm: Complex
  zInputOhm: Complex
  transfer: Complex
  readonly gain: number
  readonly inputPhaseDeg: number
}

export interface FrequencySolution {
  frequencyHz: number
  targetGain: number
  achievedGain: number
  phaseDeg: number
  rootsHz: number[]
  branch: string
}

export class GainNotReachableError extends Error {}

/** FHA 全波整流负载折算到变压器原边 */
export function equivalentAcLoadOhm(turnsRatioN: number, voutV: number, poutW: number): number {
  if (poutW <= 0) throw new Error('pout_w must be positive')
  const rLoad = (voutV * voutV) / poutW
  return (8.0 / Math.PI ** 2) * turnsRatioN ** 2 * rLoad
}

/** 由 fr、满载 Q、Ln 综合 Lr/Cr/Lm */
export function designTank(spec: LLCDesignSpec): TankDesign {
  validateSpec(spec)
  const rac = equivalentAcLoadOhm(turnsRatio(spec), spec.voutV, spec.poutW)
  const zr = spec.qFullLoad * rac
  const omegaR = 2.0 * Math.PI * spec.resonantFrequencyHz
  const lr = zr / omegaR
  const cr = 1.0 / (omegaR * zr)
  const lm = spec.lnRatio * lr
  return {
    lrH: lr, crF: cr, lmH: lm, racNomOhm: rac, zrOhm: zr,
    lnRatio: spec.lnRatio, qFullLoad: spec.qFullLoad, frHz: spec.resonantFrequencyHz,
    get fmHz() { return this.frHz / Math.sqrt(1.0 + this.lnRatio) },
  }
}

export function tankState(tank: TankDesign, frequencyHz: number, racOhm: number): TankState {
  if (frequencyHz <= 0 || racOhm <= 0) throw new Error('frequency and Rac must be positive')
  const w = 2.0 * Math.PI * frequencyHz
  const zSeries = cAdd(cplx(0, w * tank.lrH), cInv(cplx(0, w * tank.crF)))
  const zLm = cplx(0, w * tank.lmH)
  const zParallel = cInv(cAdd(cInv(cplx(racOhm, 0)), cInv(zLm)))
  const zInput = cAdd(zSeries, zParallel)
  const transfer = cDiv(zParallel, zInput)
  return {
    frequencyHz, racOhm, zSeriesOhm: zSeries, zParallelOhm: zParallel,
    zInputOhm: zInput, transfer,
    get gain() { return cAbs(this.transfer) },
    get inputPhaseDeg() {
      return (Math.atan2(this.zInputOhm.im, this.zInputOhm.re) * 180) / Math.PI
    },
  }
}

export function gain(tank: TankDesign, frequencyHz: number, racOhm: number): number {
  return tankState(tank, frequencyHz, racOhm).gain
}

/** 频率数组上的 |transfer|（等价 gain_vector） */
export function gainVector(tank: TankDesign, frequenciesHz: number[], racOhm: number): number[] {
  return frequenciesHz.map(f => {
    const w = 2.0 * Math.PI * f
    const zSeries = cAdd(cplx(0, w * tank.lrH), cInv(cplx(0, w * tank.crF)))
    const zLm = cplx(0, w * tank.lmH)
    const zParallel = cInv(cAdd(cInv(cplx(racOhm, 0)), cInv(zLm)))
    const zInput = cAdd(zSeries, zParallel)
    return cAbs(cDiv(zParallel, zInput))
  })
}

export function targetGain(spec: LLCDesignSpec, vbusV: number): number {
  return (turnsRatio(spec) * (spec.voutV + spec.rectifierEquivalentDropV)) / (bridgeGain(spec) * vbusV)
}

/** 桥式方波基波的 RMS 值 */
export function bridgeFundamentalRmsV(spec: LLCDesignSpec, vbusV: number): number {
  return FHA_RECTIFIER_K * bridgeGain(spec) * vbusV
}

/** 在 [fmin, fmax] 上求 gain(f) == target 的全部根 */
export function findGainRoots(
  tank: TankDesign, racOhm: number, target: number,
  fminHz: number, fmaxHz: number, samples = 1600,
): number[] {
  if (target <= 0) throw new Error('target gain must be positive')
  const freqs = geomspace(fminHz, fmaxHz, samples)
  const values = gainVector(tank, freqs, racOhm).map(v => v - target)
  const roots: number[] = []
  for (let idx = 0; idx < freqs.length - 1; idx++) {
    const f0 = freqs[idx]!
    const f1 = freqs[idx + 1]!
    const y0 = values[idx]!
    const y1 = values[idx + 1]!
    if (Math.abs(y0) < 1e-10) roots.push(f0)
    if (y0 * y1 < 0.0) {
      const root = brentq(f => gain(tank, f, racOhm) - target, f0, f1, 1e-8, 1e-11, 100)
      roots.push(root.root)
    }
  }
  if (Math.abs(values[values.length - 1]!) < 1e-10) roots.push(freqs[freqs.length - 1]!)
  // 去重相邻根
  const unique: number[] = []
  for (const root of [...roots].sort((a, b) => a - b)) {
    if (unique.length === 0 || Math.abs(root - unique[unique.length - 1]!) > Math.max(0.1, 1e-7 * root)) {
      unique.push(root)
    }
  }
  return unique
}

export function solveFrequency(
  tank: TankDesign, spec: LLCDesignSpec, racOhm: number,
  requiredGain?: number,
): FrequencySolution {
  const target = requiredGain ?? targetGain(spec, spec.vbusNomV)
  const roots = findGainRoots(tank, racOhm, target, spec.minimumFrequencyHz, spec.maximumFrequencyHz)
  if (roots.length === 0) {
    const frequencies = geomspace(spec.minimumFrequencyHz, spec.maximumFrequencyHz, 2000)
    const gains = gainVector(tank, frequencies, racOhm)
    const gmin = Math.min(...gains)
    const gmax = Math.max(...gains)
    throw new GainNotReachableError(
      `required gain ${target.toFixed(4)} is outside available range ${gmin.toFixed(4)}..${gmax.toFixed(4)}`,
    )
  }

  const inductive = roots.filter(f =>
    tankState(tank, f, racOhm).inputPhaseDeg >= spec.minimumInductiveAngleDeg)
  const candidates = inductive.length > 0 ? inductive : roots

  let chosen: number
  let branch: string
  if (target <= 1.0) {
    const preferred = candidates.filter(f => f >= tank.frHz * (1.0 - 1e-8))
    if (preferred.length > 0) {
      chosen = Math.min(...preferred)
      branch = 'above_resonance'
    } else {
      chosen = candidates.reduce((best, f) => (Math.abs(f - tank.frHz) < Math.abs(best - tank.frHz) ? f : best), candidates[0]!)
      branch = 'below_resonance_fallback'
    }
  } else {
    const preferred = candidates.filter(f => f <= tank.frHz * (1.0 + 1e-8))
    if (preferred.length > 0) {
      chosen = Math.max(...preferred)
      branch = 'boost_inductive'
    } else {
      chosen = candidates.reduce((best, f) => (Math.abs(f - tank.frHz) < Math.abs(best - tank.frHz) ? f : best), candidates[0]!)
      branch = 'high_frequency_fallback'
    }
  }

  const state = tankState(tank, chosen, racOhm)
  return {
    frequencyHz: chosen, targetGain: target, achievedGain: state.gain,
    phaseDeg: state.inputPhaseDeg, rootsHz: roots, branch,
  }
}

export function gainRange(tank: TankDesign, racOhm: number, frequenciesHz: number[]): [number, number] {
  const values = frequenciesHz.map(f => gain(tank, f, racOhm))
  return [Math.min(...values), Math.max(...values)]
}
