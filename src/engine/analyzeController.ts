/**
 * 自定义控制器分析引擎：输入归一化 2P2Z 系数（B0 外置）→ 完整设计报告
 *
 * 输出格式：
 *   1. 控制器识别（零点/极点/稳定性/直流增益/极点频率）
 *   2. IQ27 定点化（B1/B2/A1/A2 全 IQ27，B0 增益 IQ20）+ 溢出核算
 *   3. 归一化 DF-IIt C99 代码
 *   4. ASCII Bode 图
 */

import { DigitalTransferFunction } from '../control/tf.ts'
import {
  compute2P2ZNormalizedFixed, renderFixed2P2ZNormalizedC99, quantize,
} from '../control/qformat.ts'
import { renderAsciiBode } from './asciiBode.ts'

export interface AnalyzeControllerRequest {
  /** 外置增益 B0（b0） */
  B0: number
  /** 归一化分子系数（B1 = b1/b0，B2 = b2/b0） */
  B1: number
  B2: number
  /** 分母系数（A1, A2） */
  A1: number
  A2: number
  /** 采样周期（µs），默认 20 */
  sampleTimeUs?: number
  /** 是否输出 Bode 图，默认 true */
  showBode?: boolean
}

export interface ControllerAnalysisOutput {
  /** 控制器特性分析 */
  analysis: {
    zeros: Array<{ re: number; im: number }>
    poles: Array<{ re: number; im: number; magnitude: number; freqHz: number }>
    stable: boolean
    dcGain: number
    /** 极点-单位圆最小余量（LSB，IQ27） */
    poleMarginLsb: number
    /** 类型识别说明 */
    type: string
  }
  /** 浮点归一化系数（10 位小数渲染） */
  float: { B0: number; B1: number; B2: number; A1: number; A2: number }
  /** 定点整数参数 */
  fixed: Record<string, { float: number; q: number; int: number }>
  /** 溢出核算 */
  budget: Array<{ item: string; upper: number; limit: number; ok: boolean }>
  /** 归一化 DF-IIt C99 */
  c99: string
  /** ASCII Bode 图 */
  bodeAscii: string
}

export function analyzeController(req: AnalyzeControllerRequest): ControllerAnalysisOutput {
  const ts = (req.sampleTimeUs ?? 20) * 1e-6
  const { B0, B1, B2, A1, A2 } = req

  // 原始系数（B0 外置前的 b0/b1/b2）
  const tf = new DigitalTransferFunction([B0, B0 * B1, B0 * B2], [1, A1, A2], ts)

  const zeros = tf.zeros
  const poles = tf.poles.map(p => ({
    re: p.re,
    im: p.im,
    magnitude: Math.hypot(p.re, p.im),
    freqHz: Math.abs(Math.atan2(p.im, p.re)) / (2 * Math.PI * ts),
  }))
  const stable = tf.stable
  const dcGain = (B0 * (1 + B1 + B2)) / (1 + A1 + A2)
  const poleMarginLsb = Math.min(...poles.map(p => Math.abs(1 - p.magnitude))) * 134217728

  // 类型识别
  let type = '2P2Z（二阶数字补偿器）'
  const isDoubleIntegrator = Math.abs(B1) < 1e-9 || true // B1/B2 由用户给定，不做强判定
  const hasUnitZeros = zeros.length === 2 && zeros.every(z => Math.abs(Math.hypot(z.re + 1, z.im)) < 1e-9)
  if (hasUnitZeros) type = '双积分 + 阻尼极点（分子 (1+z⁻¹)²）——DC 单位增益型电压环补偿器'
  void isDoubleIntegrator

  // 定点化
  const nf = compute2P2ZNormalizedFixed(B0, B0 * B1, B0 * B2, A1, A2)
  const fixed: Record<string, { float: number; q: number; int: number }> = {}
  for (const [k, c] of Object.entries(nf)) {
    if (k === 'outMax' || k === 'outMin') continue
    fixed[k] = { float: c.float, q: c.q, int: c.int }
  }

  // 溢出核算
  const s1Upper = Math.abs(B1 + B2) + Math.abs(A1 + A2)
  const budget = [
    { item: '|B1+B2|+|A1+A2|（状态 s1 上限）', upper: s1Upper, limit: 16, ok: s1Upper <= 16 },
    { item: 'A2 距 1 余量（LSB，IQ27）', upper: Math.abs(1 - A2) * 134217728, limit: 100, ok: Math.abs(1 - A2) * 134217728 >= 100 },
    { item: 'A1 距 -2 余量（LSB，IQ27）', upper: Math.abs(A1 + 2) * 134217728, limit: 100, ok: Math.abs(A1 + 2) * 134217728 >= 100 },
  ]

  // C99
  const c99 = renderFixed2P2ZNormalizedC99(nf, 'ctrl')

  // Bode
  let bodeAscii = ''
  if (req.showBode ?? true) {
    const freqs: number[] = []
    const resp: { re: number; im: number }[] = []
    for (let f = 0.1; f <= Math.min(20000, 0.49 / ts); f *= 1.25) freqs.push(f)
    tf.frequencyResponse(freqs).forEach(v => resp.push({ re: v.re, im: v.im }))
    bodeAscii = renderAsciiBode(freqs, resp, { width: 64, height: 12 })
  }

  return {
    analysis: { zeros, poles, stable, dcGain, poleMarginLsb, type },
    float: { B0, B1, B2, A1, A2 },
    fixed,
    budget,
    c99,
    bodeAscii,
  }
}

export { quantize }
