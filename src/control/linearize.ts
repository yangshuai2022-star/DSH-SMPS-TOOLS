/**
 * 非线性动态相量模型的数值线性化（从仓库 llc_design/control/linearize.py 移植）
 */

import { roots } from './linalg.ts'
import { ss2tf, makeSiso, type SISOTransferFunction } from './tf.ts'
import { DynamicPhasorModel, type DynamicPhasorSteadyState } from './plant.ts'

export type ControlInputKind = 'frequency_hz' | 'frequency_khz' | 'period_s' | 'timer_counts'

export interface LinearizedPlant {
  a: number[][]
  b: number[][]
  c: number[][]
  d: number[][]
  stateNames: string[]
  inputNames: string[]
  inputUnits: string[]
  outputNames: string[]
  outputUnits: string[]
  steadyStates: number[]
  steadyInputs: number[]
  steadyOutputs: number[]
  poles: { re: number; im: number }[]
  modelName: string
  controlInputKind: ControlInputKind
  timerClockHz: number | null

  readonly stable: boolean
}

export function makeLinearizedPlant(
  a: number[][], b: number[][], c: number[][], d: number[][],
  stateNames: string[], inputNames: string[], inputUnits: string[],
  outputNames: string[], outputUnits: string[],
  steadyStates: number[], steadyInputs: number[], steadyOutputs: number[],
  controlInputKind: ControlInputKind = 'frequency_hz', timerClockHz: number | null = null,
): LinearizedPlant {
  return {
    a, b, c, d, stateNames, inputNames, inputUnits, outputNames, outputUnits,
    steadyStates, steadyInputs, steadyOutputs,
    poles: eigvalsOf(a),
    modelName: 'seven_state_dynamic_phasor_edf',
    controlInputKind, timerClockHz,
    get stable() { return this.poles.every(p => p.re < 0) },
  }
}

/** 数值中心差分雅可比 */
export function centralJacobian(
  fn: (x: number[]) => number[],
  point: number[],
  relativeStep: number,
  absoluteSteps?: number[],
): number[][] {
  const value = fn(point)
  const jac: number[][] = Array.from({ length: value.length }, () => new Array<number>(point.length).fill(0))
  for (let col = 0; col < point.length; col++) {
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

/** 输入变换系数（对应 with_control_input 的 factor） */
export function controlInputFactor(kind: ControlInputKind, f0: number, timerClockHz?: number | null): { factor: number; name: string; unit: string } {
  switch (kind) {
    case 'frequency_hz':
      return { factor: 1.0, name: 'switching_frequency_hz', unit: 'Hz' }
    case 'frequency_khz':
      return { factor: 1000.0, name: 'switching_frequency_khz', unit: 'kHz' }
    case 'period_s':
      return { factor: -(f0 ** 2), name: 'switching_period_s', unit: 's' }
    case 'timer_counts': {
      if (timerClockHz === null || timerClockHz === undefined || timerClockHz <= 0) {
        throw new Error('timer_clock_hz must be positive for timer-count control')
      }
      return { factor: -(f0 ** 2) / timerClockHz, name: 'timer_period_counts', unit: 'count' }
    }
  }
}

/** with_control_input：把第一输入从频率变换到控制器变量 */
export function withControlInput(
  plant: LinearizedPlant, kind: ControlInputKind, timerClockHz?: number | null,
): LinearizedPlant {
  const f0 = plant.steadyInputs[0]!
  const { factor, name, unit } = controlInputFactor(kind, f0, timerClockHz)
  const b = plant.b.map(row => [...row])
  const d = plant.d.map(row => [...row])
  for (let i = 0; i < b.length; i++) b[i]![0]! *= factor
  for (let i = 0; i < d.length; i++) d[i]![0]! *= factor
  const inputNames = [...plant.inputNames]
  const inputUnits = [...plant.inputUnits]
  inputNames[0] = name
  inputUnits[0] = unit
  return {
    ...plant,
    b, d, inputNames, inputUnits,
    controlInputKind: kind, timerClockHz: timerClockHz ?? null,
  }
}

/**
 * SISO 传递函数（对应 LinearizedPlant.siso()）。
 * inputName 为 null 时取第一个输入；outputName 默认 output_voltage_v。
 */
export function plantSiso(
  plant: LinearizedPlant,
  options: { inputName?: string; outputName?: string; relativeTrim?: number } = {},
): SISOTransferFunction {
  const { inputName, outputName = 'output_voltage_v', relativeTrim = 1e-11 } = options
  const inputIdx = inputName === undefined ? 0 : plant.inputNames.indexOf(inputName)
  if (inputIdx < 0) throw new Error(`unknown input name: ${inputName}`)
  const outputIdx = plant.outputNames.indexOf(outputName)
  if (outputIdx < 0) throw new Error(`unknown output name: ${outputName}`)
  const [numAll, den] = ss2tf(plant.a, plant.b, plant.c, plant.d, inputIdx, outputIdx)
  let numerator = numAll
  let denominator = den
  if (denominator[0] === 0) throw new Error('invalid transfer-function denominator')
  numerator = numerator.map(v => v / denominator[0]!)
  denominator = denominator.map(v => v / denominator[0]!)
  // 修剪前导数值噪声
  const maxNum = Math.max(Math.max(...numerator.map(Math.abs)), 1.0)
  let first = 0
  while (first < numerator.length - 1 && Math.abs(numerator[first]!) <= relativeTrim * maxNum) first++
  numerator = numerator.slice(first)
  return makeSiso(
    numerator, denominator,
    plant.inputNames[inputIdx]!, plant.inputUnits[inputIdx]!,
    plant.outputNames[outputIdx]!, plant.outputUnits[outputIdx]!,
  )
}

/** 对应 linearize_dynamic_phasor() */
export function linearizeDynamicPhasor(
  model: DynamicPhasorModel, steadyState: DynamicPhasorSteadyState,
  relativeStep = 1e-6,
): LinearizedPlant {
  const x0 = steadyState.states
  const u0 = [
    steadyState.inputs.switchingFrequencyHz,
    steadyState.inputs.busVoltageV,
    steadyState.inputs.loadCurrentDisturbanceA,
  ]
  const a = centralJacobian(x => model.rhs(x, steadyState.inputs), x0, relativeStep)
  const b = centralJacobian(u => model.rhs(x0, { switchingFrequencyHz: u[0]!, busVoltageV: u[1]!, loadCurrentDisturbanceA: u[2]! }), u0, relativeStep, [0.25, 1e-3, 1e-4])
  const c = centralJacobian(x => model.outputs(x, steadyState.inputs), x0, relativeStep)
  const d = centralJacobian(u => model.outputs(x0, { switchingFrequencyHz: u[0]!, busVoltageV: u[1]!, loadCurrentDisturbanceA: u[2]! }), u0, relativeStep, [0.25, 1e-3, 1e-4])
  const outputs = model.outputs(x0, steadyState.inputs)
  return makeLinearizedPlant(
    a, b, c, d,
    [...STATE_NAMES_LOCAL], [...INPUT_NAMES_LOCAL], ['Hz', 'V', 'A'],
    [...OUTPUT_NAMES_LOCAL], ['V', 'A', 'A', 'A', 'A', 'V'],
    x0, u0, outputs,
  )
}

const STATE_NAMES_LOCAL = [
  'ir_cos_a', 'ir_sin_a', 'vcr_cos_v', 'vcr_sin_v',
  'im_cos_a', 'im_sin_a', 'vco_v',
]
const INPUT_NAMES_LOCAL = ['switching_frequency_hz', 'bus_voltage_v', 'load_current_disturbance_a']
const OUTPUT_NAMES_LOCAL = [
  'output_voltage_v', 'resonant_current_rms_a', 'magnetizing_current_rms_a',
  'secondary_current_rms_a', 'rectifier_current_avg_a', 'output_capacitor_voltage_v',
]

/** 矩阵特征值（复用 linalg eigvals） */
function eigvalsOf(a: number[][]): { re: number; im: number }[] {
  return eigvals(a)
}

import { eigvals } from './linalg.ts'

export { roots }
