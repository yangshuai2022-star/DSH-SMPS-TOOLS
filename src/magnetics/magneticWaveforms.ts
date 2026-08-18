/**
 * LLC 磁性元件波形重建（从仓库 llc_design/magnetics/magnetic_waveforms.py 移植）
 */

import { mean, roll } from '../core/numeric.ts'
import type { LLCOperatingPoint } from '../core/operatingPoint.ts'
import type { LLCDesignSpec } from '../core/spec.ts'

export function periodicTimebase(frequencyHz: number, samples = 2048): number[] {
  const out: number[] = new Array(samples)
  for (let i = 0; i < samples; i++) out[i] = i / (samples * frequencyHz)
  return out
}

/** 对称三角波：-peak 起，半周期达 +peak，再返回 */
export function symmetricTriangle(samples: number, peak: number): number[] {
  const out: number[] = new Array(samples)
  for (let i = 0; i < samples; i++) {
    const phase = i / samples
    const unit = phase < 0.5 ? -1.0 + 4.0 * phase : 3.0 - 4.0 * phase
    out[i] = peak * unit
  }
  return out
}

export function transformerFluxWaveform(
  op: LLCOperatingPoint, primaryTurns: number, effectiveAreaM2: number, samples = 2048,
): [number[], number[]] {
  const bPeak = op.transformerSquareEquivalentV
    / (4.0 * primaryTurns * effectiveAreaM2 * op.switchingFrequencyHz)
  return [periodicTimebase(op.switchingFrequencyHz, samples), symmetricTriangle(samples, bPeak)]
}

/**
 * 原/副边绕组电流近似（一个周期）。
 * 反射负载分量正弦；励磁分量三角（变压器近似方波驱动）。
 * 副边电流抵消原边负载安匝 → 层 MMF 模型保留励磁场。
 */
export function transformerCurrentWaveforms(
  spec: LLCDesignSpec, op: LLCOperatingPoint, samples = 2048,
): [number[], number[], number[]] {
  const theta: number[] = new Array(samples)
  for (let i = 0; i < samples; i++) theta[i] = (2.0 * Math.PI * i) / samples
  const loadPrimary = theta.map(t => Math.SQRT2 * op.reflectedLoadCurrentRmsA * Math.sin(t))
  const magPeak = Math.sqrt(3.0) * op.magnetizingCurrentRmsA
  // 三角励磁电流相对负载电压移相 1/4 周期
  const magnetizing = roll(symmetricTriangle(samples, magPeak), Math.floor(samples / 4))

  let primary = loadPrimary.map((v, i) => v + magnetizing[i]!)
  const primaryRms = Math.sqrt(mean(primary.map(v => v * v)))
  if (primaryRms > 0.0) {
    // FHA 幅值与重建形状不完全一致：只缩放励磁残差使端电流匹配
    const targetSq = op.resonantCurrentRmsA ** 2
    const loadSq = op.reflectedLoadCurrentRmsA ** 2
    const magTarget = Math.sqrt(Math.max(targetSq - loadSq, 0.0))
    const magNow = Math.sqrt(mean(magnetizing.map(v => v * v)))
    if (magNow > 0.0) {
      const scale = magTarget / magNow
      for (let i = 0; i < samples; i++) magnetizing[i] = magnetizing[i]! * scale
    }
    primary = loadPrimary.map((v, i) => v + magnetizing[i]!)
  }
  const secondary = loadPrimary.map(v => -spec.primaryTurns / spec.secondaryTurns * v)
  return [primary, secondary, magnetizing]
}

export function resonantInductorWaveforms(
  op: LLCOperatingPoint, inductanceH: number, turns: number, effectiveAreaM2: number, samples = 2048,
): [number[], number[], number[]] {
  const theta: number[] = new Array(samples)
  for (let i = 0; i < samples; i++) theta[i] = (2.0 * Math.PI * i) / samples
  const current = theta.map(t => op.resonantCurrentPeakA * Math.sin(t))
  const fluxDensity = current.map(i => inductanceH * i / (turns * effectiveAreaM2))
  return [periodicTimebase(op.switchingFrequencyHz, samples), current, fluxDensity]
}
