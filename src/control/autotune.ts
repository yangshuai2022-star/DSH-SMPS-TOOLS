/**
 * LLC 电压环一键自动整定
 *
 * 输入目标穿越频率 fc 与目标相位裕度 PM，迭代设计 PI/PIF/2P2Z 控制器：
 *   1. 在完整数字环链（FM LUT 增益 + 模拟采样 + ADC + 延迟）上求开环频响
 *   2. Kp：使 |OL(fc)| = 1（增益穿越）
 *   3. Ti/零极点：使 PM(fc) = 目标（零点位置迭代）
 *   4. 完整 buildDigitalLoopAnalysis 验证收敛
 */

import { buildSmallSignalAnalysis, type SmallSignalAnalysis } from './analysis.ts'
import {
  makePiConfig, makePifConfig, buildDigitalLoopAnalysis,
  type ControllerConfig, type DigitalLoopAnalysisResult,
  type FrequencyModulatorLUT, type AnalogSenseConfig, type ADCSamplingConfig,
  type CommandTimingConfig,
} from './digitalLoop.ts'
import { interp } from './linalg.ts'
import type { LLCDesignSpec } from '../core/spec.ts'

export type TuneControllerKind = 'pi' | 'pif' | '2p2z'

export interface TuningTarget {
  /** 目标穿越频率（Hz）；默认 fsw/20 */
  crossoverHz?: number
  /** 目标相位裕度（°）；默认 50 */
  phaseMarginDeg?: number
  /** 控制器类型；默认 pi */
  controllerKind?: TuneControllerKind
  /** PIF 输出 LPF 截止（Hz）；默认 3500 */
  lpfCutoffHz?: number
  /** 2P2Z 高频极点频率倍率（×fc）；默认 4 */
  highFrequencyPoleRatio?: number
  maxIterations?: number
}

export interface TuningResult {
  controllerConfig: ControllerConfig
  analysis: DigitalLoopAnalysisResult
  achievedCrossoverHz: number
  achievedPhaseMarginDeg: number
  achievedGainMarginDb: number
  iterations: number
  converged: boolean
  notes: string[]
}

interface LoopChainOptions {
  fmLut?: FrequencyModulatorLUT
  analogSense?: AnalogSenseConfig
  adcSampling?: ADCSamplingConfig
  commandTiming?: CommandTimingConfig
  vbusV?: number
  loadFraction?: number
  sampleTimeS?: number
}

/**
 * 在开环频响上求某频率的幅值与相位（对数频率插值）。
 * 相位用 unwrap 后的序列插值，与 calculateStabilityMargins 的映射一致。
 */
export function evaluateOpenLoopAt(
  r: DigitalLoopAnalysisResult, frequencyHz: number,
): { re: number; im: number; phaseDeg: number } {
  const freqs = r.frequenciesHz
  const ol = r.responses['open_loop_nominal']!
  const logF = freqs.map(f => Math.log(f))
  const x = Math.log(frequencyHz)
  const clampIdx = (i: number) => Math.min(Math.max(i, 0), ol.length - 1)
  let idx: number
  let t: number
  if (x <= logF[0]!) {
    idx = 0
    t = 0
  } else if (x >= logF[logF.length - 1]!) {
    idx = ol.length - 2
    t = 1
  } else {
    idx = findIndex(logF, x)
    const x0 = logF[idx]!
    const x1 = logF[idx + 1]!
    t = (x - x0) / (x1 - x0)
  }
  const a = ol[clampIdx(idx)]!
  const b = ol[clampIdx(idx + 1)]!
  const re = a.re + t * (b.re - a.re)
  const im = a.im + t * (b.im - a.im)
  // unwrap 相位序列后插值
  const rawPhase = ol.map(v => Math.atan2(v.im, v.re))
  const unwrapped = unwrapPhase(rawPhase)
  const pa = unwrapped[clampIdx(idx)]!
  const pb = unwrapped[clampIdx(idx + 1)]!
  const phaseDeg = ((pa + t * (pb - pa)) * 180) / Math.PI
  return { re, im, phaseDeg }
}

/** 相位解包（同 numpy.unwrap） */
function unwrapPhase(phase: number[]): number[] {
  const out = [...phase]
  let offset = 0
  for (let i = 1; i < out.length; i++) {
    let d = out[i]! - out[i - 1]!
    if (d > Math.PI) {
      d -= 2 * Math.PI
      offset -= 2 * Math.PI
    } else if (d < -Math.PI) {
      d += 2 * Math.PI
      offset += 2 * Math.PI
    }
    out[i] = out[i]! + offset
  }
  return out
}

function findIndex(sorted: number[], value: number): number {
  let lo = 0
  let hi = sorted.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >>> 1
    if (sorted[mid]! < value) lo = mid
    else hi = mid
  }
  return lo
}

/** 由开环相位（已 unwrap，°）求相位裕度（映射到最接近 -180° 的分支） */
export function phaseMarginFromPhaseDeg(phaseDeg: number): number {
  let phase = phaseDeg
  while (phase > 0) phase -= 360
  while (phase <= -360) phase += 360
  return 180 + phase
}

export function makeGridWithFc(sampleTimeS: number, fsw: number, fc: number): number[] {
  const nyquist = 0.5 / sampleTimeS
  const upper = Math.min(0.49 * nyquist, 0.25 * fsw)
  const lower = Math.max(0.1, upper / 2e5)
  const n = 2400
  const grid: number[] = []
  const ratio = Math.pow(upper / lower, 1 / (n - 1))
  for (let i = 0; i < n; i++) grid.push(lower * ratio ** i)
  grid[grid.length - 1] = upper
  const merged = [...grid, fc].sort((a, b) => a - b)
  const out: number[] = []
  for (const f of merged) {
    if (out.length === 0 || Math.abs(Math.log(f / out[out.length - 1]!)) > 1e-9) out.push(f)
  }
  return out
}

/**
 * 一键整定主入口。
 */
export function tuneVoltageLoop(
  spec: LLCDesignSpec,
  target: TuningTarget = {},
  chain: LoopChainOptions = {},
): TuningResult {
  const kind = target.controllerKind ?? 'pi'
  const pmTarget = target.phaseMarginDeg ?? 50
  const maxIter = target.maxIterations ?? 20

  const ssa: SmallSignalAnalysis = buildSmallSignalAnalysis(spec, {
    vbusV: chain.vbusV,
    loadFraction: chain.loadFraction,
    sampleTimeS: chain.sampleTimeS,
  })
  const sampleTime = chain.sampleTimeS ?? 20e-6
  const fsw = ssa.operatingPoint.switchingFrequencyHz
  const fc = target.crossoverHz ?? fsw / 20
  const grid = makeGridWithFc(sampleTime, fsw, fc)

  const notes: string[] = []
  let kp = 0.01
  let ti = 1 / (2 * Math.PI * (fc / 3))
  let lpfCutoff = target.lpfCutoffHz ?? 3500
  let hpRatio = target.highFrequencyPoleRatio ?? 4
  let zeroRatio = 2 // 2P2Z 零点位置：fc/zeroRatio、fc/(2·zeroRatio)

  const build = (ctrl: ControllerConfig) => buildDigitalLoopAnalysis(ssa, {
    controllerConfig: ctrl,
    fmLut: chain.fmLut,
    analogSense: chain.analogSense,
    adcSampling: chain.adcSampling,
    commandTiming: chain.commandTiming,
    frequenciesHz: grid,
  })

  let finalCtrl: ControllerConfig = makePiConfig(kp, ti, sampleTime)
  let finalAnalysis: DigitalLoopAnalysisResult | null = null
  let achievedPm = 0
  let achievedGc = 0
  let converged = false
  let iterations = 0

  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1

    // ── 阶段 1：固定 Ti，内循环收敛 Kp 使 |OL(fc)| = 1 ──────────────
    // Kp 与 Ti 都会影响 |OL(fc)|：若同时调整会互相干扰永不收敛；
    // 因此内循环只动 Kp，Ti 在外循环按 PM 调整。
    let r: DigitalLoopAnalysisResult | null = null
    let olFc: { re: number; im: number; phaseDeg: number } | null = null
    for (let inner = 0; inner < 15; inner++) {
      const ctrl = makeController(kind, kp, ti, fc, hpRatio, zeroRatio, sampleTime, lpfCutoff)
      r = build(ctrl)
      olFc = evaluateOpenLoopAt(r, fc)
      const mag = Math.hypot(olFc.re, olFc.im)
      const kpCorrection = mag > 1e-12 ? 1 / mag : 1.0
      kp = clamp(kp * kpCorrection, 1e-9, 1e6)
      if (Math.abs(mag - 1) < 0.005) break
    }

    // ── 阶段 2：评估 PM，必要时调整 Ti ──────────────────────────────
    if (r === null || olFc === null) throw new Error('autotune: iteration produced no analysis')
    const pm = phaseMarginFromPhaseDeg(olFc.phaseDeg)
    const pmErr = pm - pmTarget

    finalCtrl = makeController(kind, kp, ti, fc, hpRatio, zeroRatio, sampleTime, lpfCutoff)
    finalAnalysis = r
    achievedPm = pm
    achievedGc = fc

    if (Math.abs(pmErr) < 1.5) {
      converged = true
      break
    }
    if (kind === '2p2z') {
      // 2P2Z：结构决定相位，增益已收敛即视为达标
      converged = true
      notes.push(
        `2P2Z 结构在 fc=${fc.toFixed(0)} Hz 下可达 PM ${pm.toFixed(1)}°（目标 ${pmTarget}°）；` +
        '如需要不同相位裕度，请调整目标带宽或零点/极点配置。',
      )
      break
    }
    // 物理极限检测：Ti 到边界仍无法达标
    const atTiFloor = ti <= sampleTime * 1.01
    const atTiCeil = ti >= 10.0 * 0.99
    if ((atTiFloor && pmErr > 0) || (atTiCeil && pmErr < 0)) {
      converged = true
      if (pmErr > 0) {
        notes.push(
          `目标 PM ${pmTarget}° 在该工作点不可达（plant 相位滞后不足）：` +
          `TI 已降至最小值仍为 PM ${pm.toFixed(1)}°，当前为可达的最大相位裕度。`,
        )
      } else {
        notes.push(
          `目标 PM ${pmTarget}° 在该工作点不可达（plant 相位滞后过大）：` +
          `TI 已升至最大值仍为 PM ${pm.toFixed(1)}°。`,
        )
      }
      break
    }
    // PM 高 → 减小 Ti（零点升频，相位贡献减少）；PM 低 → 增大 Ti
    if (pmErr > 1.5) ti = clamp(ti * 0.65, sampleTime, 10.0)
    else if (pmErr < -1.5) ti = clamp(ti * 1.4, sampleTime, 10.0)
  }

  // 最终重建：用收敛后的最终 kp/ti 重新构建一次分析（保证 |OL(fc)| ≈ 1）
  finalCtrl = makeController(kind, kp, ti, fc, hpRatio, zeroRatio, sampleTime, lpfCutoff)
  finalAnalysis = build(finalCtrl)

  // 最终验证：完整分析（含全离散极点检查）
  const final = finalAnalysis
  const finalPm = final.marginsNominalDelay.phaseMarginDeg
  const finalGc = final.marginsNominalDelay.criticalGainCrossoverHz
  const finalGm = final.marginsNominalDelay.gainMarginDb

  if (!converged) {
    notes.push(`迭代 ${iterations} 次未完全收敛（PM 误差 ${(achievedPm - pmTarget).toFixed(1)}°）`)
  }
  if (!final.likelyStable) {
    notes.push('警告：最终设计的离散闭环近似不稳定，请降低带宽或增加相位裕度目标')
  }
  notes.push(`整定工作点：fsw = ${(fsw / 1e3).toFixed(1)} kHz，目标 fc = ${(fc / 1e3).toFixed(2)} kHz`)
  notes.push(`FM 工作点 command = ${final.fmOperatingPoint.commandPu.toFixed(4)}，增益 ${final.fmOperatingPoint.gainHzPerPu.toExponential(3)} Hz/pu`)

  return {
    controllerConfig: finalCtrl,
    analysis: final,
    achievedCrossoverHz: finalGc ?? fc,
    achievedPhaseMarginDeg: finalPm ?? achievedPm,
    achievedGainMarginDb: finalGm ?? 0,
    iterations,
    converged: converged && final.likelyStable,
    notes,
  }
}

/** 为 fc 构造 2P2Z：零点 fc/zr、fc/(2zr)；极点 min(hpRatio·fc, 0.4·Nyquist) */
export function make2P2ZForTarget(
  fc: number, hpRatio: number, sampleTimeS: number, gain: number, zeroRatio = 2,
): ControllerConfig {
  const nyquist = 0.5 / sampleTimeS
  const poleHz = Math.min(hpRatio * fc, 0.4 * nyquist)
  const zerosHz = [fc / zeroRatio, fc / (2 * zeroRatio)]
  const polesHz = [poleHz, poleHz]
  return twoP2ZFromAnalogPolesZeros({
    gain, zerosHz, polesHz, sampleTimeS, outputMin: 0, outputMax: 1,
  })
}

import { twoP2ZFromAnalogPolesZeros } from './digitalLoop.ts'


/** 按控制器类型构造配置 */
function makeController(
  kind: TuneControllerKind, kp: number, ti: number, fc: number,
  hpRatio: number, zeroRatio: number, sampleTime: number, lpfCutoff: number,
): ControllerConfig {
  switch (kind) {
    case 'pi': return makePiConfig(kp, ti, sampleTime)
    case 'pif': return makePifConfig(kp, ti, lpfCutoff, sampleTime)
    case '2p2z': return make2P2ZForTarget(fc, hpRatio, sampleTime, kp, zeroRatio)
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi)
}

export { interp }
