/**
 * 传递函数层（scipy.signal 核心的 TS 移植）
 *
 *   - ss2tf：Leverrier-Faddeev 状态空间 → 传递函数
 *   - cont2discrete zoh / bilinear
 *   - SISOTransferFunction（连续 s 域，对应 control/linearize.py）
 *   - DigitalTransferFunction（z 域，对应 control/digital_loop.py）
 */

import {
  expm, matAdd, matInv, matMul, matScale, matTranspose, matVec,
  matIdentity, polyvalC, roots, trimLeadingZeros, convolve, type Mat, type Complex2,
} from './linalg.ts'

// ── ss2tf：Leverrier-Faddeev ───────────────────────────────────────

export function matrixTrace(a: Mat): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i]![i]!
  return s
}

/**
 * 状态空间 → 传递函数（单输入，取 inputIdx 列；输出取 outputIdx 行）。
 * 返回 [num, den]，均按 s 降幂，den[0] 归一化为 1。
 */
export function ss2tf(
  a: Mat, b: Mat, c: Mat, d: Mat, inputIdx: number, outputIdx: number,
): [number[], number[]] {
  const n = a.length
  const bCol = b.map(row => row[inputIdx]!)
  const cRow = c[outputIdx]!

  // Faddeev 递推
  const cs: number[] = [1] // c0 = 1
  const ms: Mat[] = [matIdentity(n)]
  for (let k = 1; k <= n; k++) {
    const am = matMul(a, ms[k - 1]!)
    const ck = -matrixTrace(am) / k
    cs.push(ck)
    if (k < n) {
      ms.push(matAdd(am, matScale(matIdentity(n), ck)))
    }
  }
  // cb[k] = C·M_k·B
  const cb: number[] = []
  for (let k = 0; k < n; k++) {
    const mb = matVec(ms[k]!, bCol)
    let acc = 0
    for (let i = 0; i < n; i++) acc += cRow[i]! * mb[i]!
    cb.push(acc)
  }
  // 分母：s^n + c1·s^(n-1) + ... + cn
  const den = cs
  // 分子：D·den(s) + Σ_k cb[k]·s^(n-1-k)
  const dVal = d[outputIdx]![inputIdx]!
  const num: number[] = new Array<number>(n + 1).fill(0)
  num[0] = dVal * den[0]!
  for (let i = 1; i <= n; i++) {
    num[i] = dVal * den[i]! + (cb[i - 1] ?? 0)
  }
  // 归一化 den[0] = 1
  return [num, den]
}

// ── cont2discrete ──────────────────────────────────────────────────

/** ZOH 离散化（augmented-matrix 指数法，等价 scipy method="zoh"） */
export function cont2discreteZoh(
  a: Mat, b: Mat, c: Mat, d: Mat, ts: number,
): { ad: Mat; bd: Mat; cd: Mat; dd: Mat } {
  const n = a.length
  // aug = [[A, B], [0, 0]]；expm(aug·ts) 的右上块 = ∫expm(Aτ)dτ·B
  const aug: Mat = Array.from({ length: n + 1 }, (_, i) => {
    if (i < n) {
      return [...a[i]!, ...b[i]!]
    }
    return new Array<number>(n + b[0]!.length).fill(0)
  })
  const e = expm(matScale(aug, ts))
  const ad: Mat = e.slice(0, n).map(row => row.slice(0, n))
  const bd: Mat = e.slice(0, n).map(row => row.slice(n, n + b[0]!.length))
  return { ad, bd, cd: c, dd: d }
}

/** 双线性变换（等价 scipy cont2discrete method="bilinear"，无预畸变） */
export function cont2discreteBilinear(
  numS: number[], denS: number[], ts: number,
): { numZ: number[]; denZ: number[] } {
  const k = 2.0 / ts
  const d = Math.max(numS.length, denS.length) - 1
  // s 降幂数组：补前导零到 d+1（最高次在前）
  const num = padLeftPoly(numS, d + 1)
  const den = padLeftPoly(denS, d + 1)

  // 预计算 (z-1)^m 和 (z+1)^m 系数
  const zm1: number[][] = [ [1] ]
  const zp1: number[][] = [ [1] ]
  for (let m = 1; m <= d; m++) {
    zm1.push(convolve(zm1[m - 1]!, [1, -1]))
    zp1.push(convolve(zp1[m - 1]!, [1, 1]))
  }

  // 系数数组 coeffs（s 降幂）中 coeffs[m] 是 s^(d-m) 的系数：
  // s^(d-m) → k^(d-m)·(z-1)^(d-m)/(z+1)^(d-m)，通分 (z+1)^d 后乘 (z+1)^m
  function transform(coeffs: number[]): number[] {
    let acc: number[] = []
    for (let m = 0; m <= d; m++) {
      const part = convolve(zm1[d - m]!, zp1[m]!)
      const scaled = part.map(v => v * coeffs[m]! * k ** (d - m))
      acc = acc.length === 0 ? scaled : polyAdd(acc, scaled)
    }
    return acc
  }

  const numZ = transform(num)
  const denZ = transform(den)
  // 归一化 den[0] = 1（与 scipy 行为一致）
  const lead = denZ[0]!
  return {
    numZ: numZ.map(v => v / lead),
    denZ: denZ.map(v => v / lead),
  }
}

function padLeftPoly(coeffs: number[], length: number): number[] {
  if (coeffs.length >= length) return [...coeffs]
  return [...new Array<number>(length - coeffs.length).fill(0), ...coeffs]
}

function polyAdd(a: number[], b: number[]): number[] {
  const len = Math.max(a.length, b.length)
  const out = new Array<number>(len).fill(0)
  for (let i = 0; i < len; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0)
  return out
}

// ── SISO 连续传递函数（对应 control/linearize.py 的 SISOTransferFunction）──

export interface SISOTransferFunction {
  numerator: number[]
  denominator: number[]
  inputName: string
  inputUnit: string
  outputName: string
  outputUnit: string
  poles: Complex2[]
  zeros: Complex2[]
  dcGain: number
  readonly order: number
}

export function makeSiso(
  numerator: number[], denominator: number[],
  inputName: string, inputUnit: string, outputName: string, outputUnit: string,
): SISOTransferFunction {
  const num = trimLeadingZeros(numerator)
  const den = denominator.length > 0 ? denominator : [1]
  return {
    numerator: num,
    denominator: den,
    inputName, inputUnit, outputName, outputUnit,
    poles: roots(den),
    zeros: num.length > 1 ? roots(num) : [],
    dcGain: Math.abs(den[den.length - 1]!) > 0 ? num[num.length - 1]! / den[den.length - 1]! : Infinity,
    get order() { return Math.max(0, this.denominator.length - 1) },
  }
}

export function sisoEvaluate(tf: SISOTransferFunction, s: Complex2): Complex2 {
  const num = polyvalC(tf.numerator, s)
  const den = polyvalC(tf.denominator, s)
  const d2 = den.re * den.re + den.im * den.im
  if (d2 === 0) return { re: Infinity, im: Infinity }
  return {
    re: (num.re * den.re + num.im * den.im) / d2,
    im: (num.im * den.re - num.re * den.im) / d2,
  }
}

/** s = jω 频响（等价 scipy signal.freqresp） */
export function sisoFrequencyResponse(tf: SISOTransferFunction, frequenciesHz: number[]): Complex2[] {
  return frequenciesHz.map(f => sisoEvaluate(tf, { re: 0, im: 2 * Math.PI * f }))
}

/** 增益缩放副本（对应 .scaled()） */
export function sisoScaled(
  tf: SISOTransferFunction, factor: number,
  inputName?: string, inputUnit?: string, outputName?: string, outputUnit?: string,
): SISOTransferFunction {
  const numerator = tf.numerator.map(v => v * factor)
  return makeSiso(
    numerator, tf.denominator,
    inputName ?? tf.inputName, inputUnit ?? tf.inputUnit,
    outputName ?? tf.outputName, outputUnit ?? tf.outputUnit,
  )
}

// ── z 域数字传递函数（对应 control/digital_loop.py DigitalTransferFunction）──

export class DigitalTransferFunction {
  numerator: number[]
  denominator: number[]
  sampleTimeS: number
  name: string
  inputName: string
  outputName: string

  constructor(
    numerator: number[], denominator: number[], sampleTimeS: number,
    name = 'C(z)', inputName = 'error', outputName = 'command',
  ) {
    if (numerator.length === 0 || denominator.length === 0) {
      throw new Error('digital transfer-function polynomials cannot be empty')
    }
    if (sampleTimeS <= 0.0) throw new Error('sample time must be positive')
    if (Math.abs(denominator[0]!) < 1e-18) {
      throw new Error('digital transfer-function denominator leading coefficient is zero')
    }
    const num = numerator.map(v => v / denominator[0]!)
    const den = denominator.map(v => v / denominator[0]!)
    this.numerator = num
    this.denominator = den
    this.sampleTimeS = sampleTimeS
    this.name = name
    this.inputName = inputName
    this.outputName = outputName
  }

  get poles(): Complex2[] {
    if (this.denominator.length <= 1) return []
    return roots(this.denominator)
  }

  get zeros(): Complex2[] {
    const nonzero = this.numerator.findIndex(v => Math.abs(v) > 1e-16)
    if (nonzero < 0) return []
    const trimmed = this.numerator.slice(nonzero)
    if (trimmed.length <= 1) return []
    return roots(trimmed)
  }

  get stable(): boolean {
    return this.poles.every(p => Math.hypot(p.re, p.im) < 1.0)
  }

  frequencyResponse(frequenciesHz: number[]): Complex2[] {
    return frequenciesHz.map(f => {
      const z: Complex2 = {
        re: Math.cos(2 * Math.PI * f * this.sampleTimeS),
        im: Math.sin(2 * Math.PI * f * this.sampleTimeS),
      }
      // num Σ b_k z^-k
      let numRe = 0
      let numIm = 0
      for (let k = 0; k < this.numerator.length; k++) {
        const c = this.numerator[k]!
        const zk = powZInv(z, k)
        numRe += c * zk.re
        numIm += c * zk.im
      }
      let denRe = 0
      let denIm = 0
      for (let k = 0; k < this.denominator.length; k++) {
        const c = this.denominator[k]!
        const zk = powZInv(z, k)
        denRe += c * zk.re
        denIm += c * zk.im
      }
      const d2 = denRe * denRe + denIm * denIm
      return {
        re: (numRe * denRe + numIm * denIm) / d2,
        im: (numIm * denRe - numRe * denIm) / d2,
      }
    })
  }

  cascade(other: DigitalTransferFunction, name?: string): DigitalTransferFunction {
    if (Math.abs(this.sampleTimeS - other.sampleTimeS) > 1e-15) {
      throw new Error('cannot cascade digital blocks with different sample times')
    }
    return new DigitalTransferFunction(
      convolve(this.numerator, other.numerator),
      convolve(this.denominator, other.denominator),
      this.sampleTimeS,
      name ?? `${this.name}*${other.name}`,
      this.inputName,
      other.outputName,
    )
  }

  scaled(gain: number, name?: string): DigitalTransferFunction {
    return new DigitalTransferFunction(
      this.numerator.map(v => v * gain),
      [...this.denominator],
      this.sampleTimeS,
      name ?? this.name,
      this.inputName,
      this.outputName,
    )
  }

  withDelay(samples: number, name?: string): DigitalTransferFunction {
    if (samples < 0) throw new Error('delay samples cannot be negative')
    if (samples === 0) return this
    return new DigitalTransferFunction(
      [...new Array<number>(samples).fill(0), ...this.numerator],
      [...this.denominator],
      this.sampleTimeS,
      name ?? this.name,
      this.inputName,
      this.outputName,
    )
  }

  differenceEquation(precision = 9): string {
    const terms: string[] = []
    for (let index = 1; index < this.denominator.length; index++) {
      const value = -this.denominator[index]!
      const sign = value >= 0 ? '+' : '-'
      terms.push(` ${sign} ${Math.abs(value).toPrecision(precision)}*y[k-${index}]`)
    }
    for (let index = 0; index < this.numerator.length; index++) {
      const c = this.numerator[index]!
      if (Math.abs(c) < 1e-18) continue
      const sign = c >= 0 ? '+' : '-'
      const suffix = index === 0 ? 'k' : `k-${index}`
      terms.push(` ${sign} ${Math.abs(c).toPrecision(precision)}*x[${suffix}]`)
    }
    let expression = terms.join('').trimStart()
    if (expression.startsWith('+')) expression = expression.slice(1).trimStart()
    return `y[k] = ${expression || '0'}`
  }
}

/** z^-k 的复数幂 */
function powZInv(z: Complex2, k: number): Complex2 {
  if (k === 0) return { re: 1, im: 0 }
  const mag = 1 / Math.hypot(z.re, z.im) ** k
  const ang = -k * Math.atan2(z.im, z.re)
  return { re: mag * Math.cos(ang), im: mag * Math.sin(ang) }
}

// 保留引用避免未使用告警
export { matInv, matTranspose }
