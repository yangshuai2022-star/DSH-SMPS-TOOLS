/**
 * LLC 小信号分析工作流（从仓库 llc_design/control/analysis.py 移植）
 *
 * 组装：工作点 → 动态相量稳态（调频外环）→ 线性化 → SISO → ZOH 离散
 */

import { designTank, tankState, bridgeFundamentalRmsV, type TankDesign } from '../core/tank.ts'
import { solveOperatingPoint, type LLCOperatingPoint } from '../core/operatingPoint.ts'
import { cloneSpec, type LLCDesignSpec } from '../core/spec.ts'
import { DynamicPhasorModel, plantParametersFromDesign } from './plant.ts'
import { linearizeDynamicPhasor, withControlInput, plantSiso, type ControlInputKind, type LinearizedPlant } from './linearize.ts'
import { discretizeZoh, type DiscretePlant } from './discretize.ts'
import type { SISOTransferFunction } from './tf.ts'

export interface SmallSignalAnalysis {
  spec: LLCDesignSpec
  tank: TankDesign
  operatingPoint: LLCOperatingPoint
  continuousPlant: LinearizedPlant
  continuousTransfer: SISOTransferFunction
  discretePlant: DiscretePlant
  sampleTimeS: number
  controlInputKind: ControlInputKind
  timerClockHz: number | null
  lineToOutputTransfer: SISOTransferFunction
  outputImpedanceTransfer: SISOTransferFunction
  resonantCurrentTransfer: SISOTransferFunction
  magnetizingCurrentTransfer: SISOTransferFunction

  readonly stable: boolean
}

export interface BuildSmallSignalOptions {
  vbusV?: number
  loadFraction?: number
  sampleTimeS?: number
  controlInputKind?: ControlInputKind
  timerClockHz?: number | null
  inputDelaySamples?: number
  seriesResistanceOhm?: number
  trimFrequencyToOutput?: boolean
}

export function buildSmallSignalAnalysis(
  specIn: LLCDesignSpec,
  options: BuildSmallSignalOptions = {},
): SmallSignalAnalysis {
  const {
    vbusV, loadFraction = 1.0, sampleTimeS = 20e-6,
    controlInputKind = 'frequency_hz', timerClockHz = null,
    inputDelaySamples = 0, seriesResistanceOhm,
    trimFrequencyToOutput = true,
  } = options
  if (!(0 < loadFraction && loadFraction <= 1.5)) {
    throw new Error('load fraction must be within 0..1.5')
  }
  const spec = specIn
  const tank = designTank(spec)
  const bus = vbusV ?? spec.vbusNomV

  let operatingPoint = solveOperatingPoint(spec, tank, bus, loadFraction)
  const params = plantParametersFromDesign(spec, tank, operatingPoint, seriesResistanceOhm)
  const model = new DynamicPhasorModel(params)

  let steady
  if (trimFrequencyToOutput) {
    steady = model.solveRegulatedSteadyState({
      busVoltageV: operatingPoint.vbusV,
      targetOutputVoltageV: spec.voutV,
      frequencyGuessHz: operatingPoint.switchingFrequencyHz,
      minimumFrequencyHz: spec.minimumFrequencyHz,
      maximumFrequencyHz: spec.maximumFrequencyHz,
      operatingPoint,
    })
    const state = tankState(tank, steady.inputs.switchingFrequencyHz, operatingPoint.racOhm)
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
      reflectedLoadCurrentRmsA: steady.primaryLoadCurrentPeakA / Math.sqrt(2.0),
      secondaryCurrentRmsA: steady.secondaryCurrentRmsA,
      secondaryCurrentPeakA: steady.secondaryCurrentRmsA * Math.sqrt(2.0),
    }
  } else {
    steady = model.solveSteadyState({
      switchingFrequencyHz: operatingPoint.switchingFrequencyHz,
      busVoltageV: operatingPoint.vbusV,
      loadCurrentDisturbanceA: 0,
    }, { operatingPoint })
  }

  let continuous = linearizeDynamicPhasor(model, steady)
  continuous = withControlInput(continuous, controlInputKind, timerClockHz)
  const transfer = plantSiso(continuous, { outputName: 'output_voltage_v' })
  const lineTransfer = plantSiso(continuous, { inputName: 'bus_voltage_v', outputName: 'output_voltage_v' })
  const outputImpedance = sisoScaledNeg(plantSiso(continuous, { inputName: 'load_current_disturbance_a', outputName: 'output_voltage_v' }))
  const resonantCurrentTransfer = plantSiso(continuous, { outputName: 'resonant_current_rms_a' })
  const magnetizingCurrentTransfer = plantSiso(continuous, { outputName: 'magnetizing_current_rms_a' })
  const discrete = discretizeZoh(continuous, sampleTimeS, {
    outputName: 'output_voltage_v', inputDelaySamples,
  })

  return {
    spec, tank, operatingPoint, continuousPlant: continuous,
    continuousTransfer: transfer, discretePlant: discrete,
    sampleTimeS, controlInputKind, timerClockHz,
    lineToOutputTransfer: lineTransfer,
    outputImpedanceTransfer: outputImpedance,
    resonantCurrentTransfer,
    magnetizingCurrentTransfer,
    get stable() { return this.continuousPlant.stable && this.discretePlant.stable },
  }
}

import { sisoScaled } from './tf.ts'

/** Zout = -v_hat/i_load_hat（对应 .scaled(-1.0, ...)） */
function sisoScaledNeg(tf: SISOTransferFunction): SISOTransferFunction {
  return sisoScaled(tf, -1.0, 'load_current_a', 'A')
}

export { cloneSpec }
