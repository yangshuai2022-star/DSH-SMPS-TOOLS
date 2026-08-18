/**
 * ZOH 离散化（从仓库 llc_design/control/discretize.py 移植）
 */

import { roots } from './linalg.ts'
import { cont2discreteZoh, ss2tf, type SISOTransferFunction } from './tf.ts'
import type { LinearizedPlant } from './linearize.ts'

export interface DiscretePlant {
  ad: number[][]
  bd: number[][]
  cd: number[][]
  dd: number[][]
  sampleTimeS: number
  numerator: number[]
  denominator: number[]
  poles: { re: number; im: number }[]
  zeros: { re: number; im: number }[]
  inputName: string
  inputUnit: string
  outputName: string
  outputUnit: string
  inputDelaySamples: number

  readonly stable: boolean
  readonly differenceEquationText: string
}

export function makeDiscretePlant(
  ad: number[][], bd: number[][], cd: number[][], dd: number[][],
  sampleTimeS: number, numerator: number[], denominator: number[],
  inputName: string, inputUnit: string, outputName: string, outputUnit: string,
  inputDelaySamples = 0,
): DiscretePlant {
  return {
    ad, bd, cd, dd, sampleTimeS, numerator, denominator,
    poles: roots(denominator),
    zeros: numerator.length > 1 ? roots(trimLeadingZerosOf(numerator)) : [],
    inputName, inputUnit, outputName, outputUnit, inputDelaySamples,
    get stable() { return this.poles.every(p => Math.hypot(p.re, p.im) < 1.0) },
    get differenceEquationText() {
      const terms: string[] = []
      for (let index = 1; index < this.denominator.length; index++) {
        const value = -this.denominator[index]!
        const sign = value >= 0 ? '+' : '-'
        terms.push(` ${sign} ${Math.abs(value).toPrecision(10)}*y[k-${index}]`)
      }
      for (let index = 0; index < this.numerator.length; index++) {
        const c = this.numerator[index]!
        if (Math.abs(c) < 1e-18) continue
        const delay = index + this.inputDelaySamples
        const suffix = delay === 0 ? 'k' : `k-${delay}`
        const sign = c >= 0 ? '+' : '-'
        terms.push(` ${sign} ${Math.abs(c).toPrecision(10)}*u[${suffix}]`)
      }
      let expression = terms.join('').trimStart()
      if (expression.startsWith('+')) expression = expression.slice(1).trimStart()
      return `y[k] = ${expression || '0'}`
    },
  }
}

function trimLeadingZerosOf(a: number[]): number[] {
  let first = 0
  while (first < a.length - 1 && Math.abs(a[first]!) <= 0) first++
  return a.slice(first)
}

/** 对应 discretize_zoh() */
export function discretizeZoh(
  plant: LinearizedPlant,
  sampleTimeS: number,
  options: { inputName?: string; outputName?: string; inputDelaySamples?: number; relativeTrim?: number } = {},
): DiscretePlant {
  const { inputName, outputName = 'output_voltage_v', inputDelaySamples = 0, relativeTrim = 1e-12 } = options
  if (sampleTimeS <= 0) throw new Error('sample time must be positive')
  if (inputDelaySamples < 0) throw new Error('input delay cannot be negative')
  const inputIdx = inputName === undefined ? 0 : plant.inputNames.indexOf(inputName)
  if (inputIdx < 0) throw new Error(`unknown input name: ${inputName}`)
  const outputIdx = plant.outputNames.indexOf(outputName)
  if (outputIdx < 0) throw new Error(`unknown output name: ${outputName}`)

  const b = plant.b.map(row => [row[inputIdx]!])
  const c = [plant.c[outputIdx]!]
  const d = [[plant.d[outputIdx]![inputIdx]!]]
  const { ad, bd, cd, dd } = cont2discreteZoh(plant.a, b, c, d, sampleTimeS)
  const [numAll, den] = ss2tf(ad, bd, cd, dd, 0, 0)
  let numerator = numAll
  let denominator = den
  numerator = numerator.map(v => v / denominator[0]!)
  denominator = denominator.map(v => v / denominator[0]!)
  // 只抑制数值噪声，不丢弃有物理意义的样本延迟
  const maxNum = Math.max(Math.max(...numerator.map(Math.abs)), 1.0)
  numerator = numerator.map(v => (Math.abs(v) < relativeTrim * maxNum ? 0 : v))

  return makeDiscretePlant(
    ad, bd, cd, dd, sampleTimeS, numerator, denominator,
    plant.inputNames[inputIdx]!, plant.inputUnits[inputIdx]!,
    plant.outputNames[outputIdx]!, plant.outputUnits[outputIdx]!,
    inputDelaySamples,
  )
}

export type { SISOTransferFunction }
