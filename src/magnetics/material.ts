/**
 * 铁氧体材料模型：温度插值 + Steinmetz + iGSE 损耗
 * （从仓库 llc_design/magnetics/material.py 移植）
 */

import { gamma, maxAbs, mean, roll } from '../core/numeric.ts'
import { MATERIALS, type MaterialRecord, type SteinmetzPoint } from '../data/materials.ts'

export interface SteinmetzCoefficients {
  temperatureC: number
  k: number
  alpha: number
  beta: number
}

export interface CoreMaterial {
  key: string
  manufacturer: string
  grade: string
  muI25: number
  bsatPoints: [number, number][]
  steinmetzPoints: SteinmetzCoefficients[]
  frequencyRangeHz: [number, number]
  fluxRangeT: [number, number]
  coreLossCorrection: number
}

export function toCoreMaterial(rec: MaterialRecord): CoreMaterial {
  return {
    key: rec.key,
    manufacturer: rec.manufacturer,
    grade: rec.grade,
    muI25: rec.muI25,
    bsatPoints: rec.bsatPoints.map(p => [p[0], p[1]] as [number, number]),
    steinmetzPoints: rec.steinmetzPoints.map(p => ({
      temperatureC: p.temperatureC, k: p.k, alpha: p.alpha, beta: p.beta,
    })),
    frequencyRangeHz: [rec.frequencyRangeHz[0], rec.frequencyRangeHz[1]],
    fluxRangeT: [rec.fluxRangeT[0], rec.fluxRangeT[1]],
    coreLossCorrection: rec.coreLossCorrection,
  }
}

/** 温度插值 Steinmetz 系数（线性内插/外推） */
export function coefficientsAt(material: CoreMaterial, temperatureC: number): SteinmetzCoefficients {
  const points = [...material.steinmetzPoints].sort((a, b) => a.temperatureC - b.temperatureC)
  const first = points[0]!
  const last = points[points.length - 1]!
  if (temperatureC <= first.temperatureC) return first
  if (temperatureC >= last.temperatureC) return last
  for (let i = 0; i < points.length - 1; i++) {
    const lo = points[i]!
    const hi = points[i + 1]!
    if (lo.temperatureC <= temperatureC && temperatureC <= hi.temperatureC) {
      const x = (temperatureC - lo.temperatureC) / (hi.temperatureC - lo.temperatureC)
      return {
        temperatureC,
        k: lo.k + x * (hi.k - lo.k),
        alpha: lo.alpha + x * (hi.alpha - lo.alpha),
        beta: lo.beta + x * (hi.beta - lo.beta),
      }
    }
  }
  return last
}

export function bsatAt(material: CoreMaterial, temperatureC: number): number {
  const pts = [...material.bsatPoints].sort((a, b) => a[0] - b[0])
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  if (temperatureC <= first[0]) return first[1]
  if (temperatureC >= last[0]) return last[1]
  for (let i = 0; i < pts.length - 1; i++) {
    const [t0, b0] = pts[i]!
    const [t1, b1] = pts[i + 1]!
    if (t0 <= temperatureC && temperatureC <= t1) {
      return b0 + (temperatureC - t0) * (b1 - b0) / (t1 - t0)
    }
  }
  return last[1]
}

/** 经典正弦 Steinmetz 损耗密度 W/m³ */
export function steinmetzDensityWM3(
  material: CoreMaterial, frequencyHz: number, bPeakT: number, temperatureC: number,
): number {
  if (frequencyHz <= 0.0 || bPeakT <= 0.0) return 0.0
  const c = coefficientsAt(material, temperatureC)
  return material.coreLossCorrection * c.k * frequencyHz ** c.alpha * bPeakT ** c.beta
}

/**
 * iGSE 任意波形损耗密度 W/m³。
 * B(t) 必须覆盖一个完整周期、不重复端点；周期导数用 wrapped first difference。
 * 归一化使正弦波在相同系数下精确复现经典 Steinmetz 结果。
 */
export function igseDensityWM3(
  material: CoreMaterial,
  timeS: number[], fluxDensityT: number[], temperatureC: number,
): number {
  const t = timeS
  const b = fluxDensityT
  if (t.length < 16 || t.length !== b.length) {
    throw new Error('time and B arrays must contain the same >=16 samples')
  }
  const dtSamples = t.slice(1).map((v, i) => v - t[i]!)
  const period = (t[t.length - 1]! - t[0]!) + medianOf(dtSamples)
  if (period <= 0.0) throw new Error('waveform period must be positive')
  const deltaB = Math.max(...b) - Math.min(...b)
  if (deltaB <= 0.0) return 0.0
  const dt = period / t.length
  const rolled = roll(b, -1)
  const dbdt = b.map((v, i) => (rolled[i]! - v) / dt)
  const c = coefficientsAt(material, temperatureC)
  // ∫|cosθ|^α dθ over 0..2π
  const cosIntegral = 2.0 * Math.sqrt(Math.PI) * gamma((c.alpha + 1.0) / 2.0) / gamma((c.alpha + 2.0) / 2.0)
  const denominator = (2.0 * Math.PI) ** (c.alpha - 1.0) * 2.0 ** (c.beta - c.alpha) * cosIntegral
  const kI = c.k / denominator
  const meanRate = mean(dbdt.map(v => Math.abs(v) ** c.alpha))
  return material.coreLossCorrection * kI * meanRate * deltaB ** (c.beta - c.alpha)
}

function medianOf(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]!
  return (sorted[mid - 1]! + sorted[mid]!) / 2
}

export function rangeWarnings(
  material: CoreMaterial, frequencyHz: number, bPeakT: number,
): string[] {
  const warnings: string[] = []
  const [f0, f1] = material.frequencyRangeHz
  const [b0, b1] = material.fluxRangeT
  if (!(f0 <= frequencyHz && frequencyHz <= f1)) {
    warnings.push(
      `frequency ${(frequencyHz / 1e3).toFixed(1)} kHz outside material fit range ${(f0 / 1e3).toFixed(1)}..${(f1 / 1e3).toFixed(1)} kHz`,
    )
  }
  if (!(b0 <= bPeakT && bPeakT <= b1)) {
    warnings.push(`Bpk ${bPeakT.toFixed(3)} T outside material fit range ${b0.toFixed(3)}..${b1.toFixed(3)} T`)
  }
  return warnings
}

/** 材料数据库（内存版，数据来自 data/materials.ts） */
export class MaterialDatabase {
  private materials: CoreMaterial[]
  private byKey = new Map<string, CoreMaterial>()

  constructor(records: MaterialRecord[] = MATERIALS) {
    this.materials = records.map(toCoreMaterial)
    for (const m of this.materials) {
      this.byKey.set(m.key.toLocaleLowerCase(), m)
      this.byKey.set(m.grade.toLocaleLowerCase(), m)
    }
  }

  get(key: string): CoreMaterial {
    const hit = this.byKey.get(key.toLocaleLowerCase())
    if (!hit) throw new Error(`unknown material key: ${key}`)
    return hit
  }

  all(): CoreMaterial[] {
    return this.materials
  }
}

// 保留引用避免未使用告警（maxAbs 在 igse 无直接使用处，供外部）
export { maxAbs }
