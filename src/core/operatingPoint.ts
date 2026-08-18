/**
 * LLC 工作点求解（从仓库 llc_design/core/operating_point.py 移植）
 */

import {
  cDiv, cMul, cplx, geomspace, type Complex,
} from './numeric.ts'
import type { LLCDesignSpec } from './spec.ts'
import {
  FHA_RECTIFIER_K, bridgeFundamentalRmsV, equivalentAcLoadOhm, gainVector,
  solveFrequency, tankState, targetGain, type TankDesign,
} from './tank.ts'

export interface LLCOperatingPoint {
  vbusV: number
  loadFraction: number
  poutW: number
  outputCurrentA: number
  racOhm: number
  qEffective: number
  requiredGain: number
  switchingFrequencyHz: number
  normalizedFrequency: number
  achievedGain: number
  branch: string
  inputImpedanceOhm: Complex
  inputPhaseDeg: number
  bridgeFundamentalRmsV: number
  transformerFundamentalRmsV: number
  transformerSquareEquivalentV: number
  resonantCurrentRmsA: number
  resonantCurrentPeakA: number
  magnetizingCurrentRmsA: number
  magnetizingCurrentPeakA: number
  reflectedLoadCurrentRmsA: number
  secondaryCurrentRmsA: number
  secondaryCurrentPeakA: number
  commutationCurrentA: number
  estimatedInputPowerW: number
  availableGainMin: number
  availableGainMax: number
  readonly inductive: boolean
}

export function solveOperatingPoint(
  spec: LLCDesignSpec, tank: TankDesign, vbusV: number, loadFraction: number,
): LLCOperatingPoint {
  const modeledFraction = Math.max(loadFraction, spec.minimumModeledLoadFraction)
  const pout = spec.poutW * modeledFraction
  const transferredPower = pout * (1.0 + spec.rectifierEquivalentDropV / spec.voutV)
  const rac = equivalentAcLoadOhm(
    spec.primaryTurns / spec.secondaryTurns,
    spec.voutV + spec.rectifierEquivalentDropV,
    transferredPower,
  )
  const required = targetGain(spec, vbusV)
  const solution = solveFrequency(tank, spec, rac, required)
  const state = tankState(tank, solution.frequencyHz, rac)

  const vBridge = bridgeFundamentalRmsV(spec, vbusV)
  const iResPhasor = cDiv(cplx(vBridge, 0), state.zInputOhm)
  const vParallel = cMul(iResPhasor, state.zParallelOhm)
  const iLoad = cDiv(vParallel, cplx(rac, 0))
  const iMag = cDiv(vParallel, cplx(0, 2.0 * Math.PI * solution.frequencyHz * tank.lmH))

  const iResRms = Math.hypot(iResPhasor.re, iResPhasor.im)
  const iResPeak = Math.sqrt(2.0) * iResRms
  const iMagRms = Math.hypot(iMag.re, iMag.im)
  const iMagPeak = Math.sqrt(2.0) * iMagRms
  const iLoadRms = Math.hypot(iLoad.re, iLoad.im)
  const iSecRms = (spec.primaryTurns / spec.secondaryTurns) * iLoadRms
  const iSecPeak = Math.sqrt(2.0) * iSecRms

  const phaseRad = (state.inputPhaseDeg * Math.PI) / 180.0
  const fundamentalTransitionCurrent = Math.abs(iResPeak * Math.sin(phaseRad))
  const commutationCurrent = Math.max(0.75 * iMagPeak, fundamentalTransitionCurrent)
  const inputPower = vParallel.re * iLoad.re + vParallel.im * iLoad.im

  const vSquareEq = Math.hypot(vParallel.re, vParallel.im) / FHA_RECTIFIER_K

  const freqs = geomspace(spec.minimumFrequencyHz, spec.maximumFrequencyHz, 800)
  const gains = gainVector(tank, freqs, rac)

  return {
    vbusV, loadFraction,
    poutW: spec.poutW * loadFraction,
    outputCurrentA: (spec.poutW / spec.voutV) * loadFraction,
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
    get inductive() { return this.inputPhaseDeg > 0.0 },
  }
}
