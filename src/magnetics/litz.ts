/**
 * 物理 Litz 铜损 + 分层绕组场模型
 * （从仓库 llc_design/magnetics/litz.py 移植）
 *
 * 分离五种效应：
 *  1. 热态 DC 电阻
 *  2. 圆绞线内部集肤效应（精确解）
 *  3. 由逐层 MMF 场产生的邻近损耗
 *  4. 不完全换位 / 子束环流惩罚
 *  5. 端子与引线电阻
 */

import { besselI, mean, rfft, type Complex } from '../core/numeric.ts'

export const MU0 = 4.0e-7 * Math.PI
export const COPPER_RESISTIVITY_20 = 1.724e-8
export const COPPER_ALPHA = 0.00393

export interface LitzWire {
  strandCount: number
  strandCopperDiameterM: number
  strandOuterDiameterM: number
  packingFactor: number
  subBundleCount: number

  readonly copperAreaM2: number
  readonly copperAreaMm2: number
  readonly insulatedStrandAreaM2: number
  readonly envelopeAreaM2: number
  readonly equivalentOuterDiameterM: number
  readonly equivalentOuterDiameterMm: number
  readonly strandsPerSubBundle: number
  readonly description: string
}

export function makeLitzWire(
  strandCount: number, strandCopperDiameterM: number, strandOuterDiameterM: number,
  packingFactor: number, subBundleCount: number,
): LitzWire {
  return {
    strandCount, strandCopperDiameterM, strandOuterDiameterM, packingFactor, subBundleCount,
    get copperAreaM2() {
      return this.strandCount * Math.PI * this.strandCopperDiameterM ** 2 / 4.0
    },
    get copperAreaMm2() { return this.copperAreaM2 * 1e6 },
    get insulatedStrandAreaM2() {
      return this.strandCount * Math.PI * this.strandOuterDiameterM ** 2 / 4.0
    },
    get envelopeAreaM2() {
      return Math.max(this.copperAreaM2 / this.packingFactor, this.insulatedStrandAreaM2 / 0.72)
    },
    get equivalentOuterDiameterM() {
      return 2.0 * Math.sqrt(this.envelopeAreaM2 / Math.PI)
    },
    get equivalentOuterDiameterMm() { return this.equivalentOuterDiameterM * 1e3 },
    get strandsPerSubBundle() {
      return Math.ceil(this.strandCount / Math.max(this.subBundleCount, 1))
    },
    get description() {
      if (this.subBundleCount <= 1) {
        return `${this.strandCount}×${(this.strandCopperDiameterM * 1e3).toFixed(3)} mm`
      }
      return `${this.subBundleCount} parallel sub-bundles × approximately ${this.strandsPerSubBundle}×${(this.strandCopperDiameterM * 1e3).toFixed(3)} mm`
    },
  }
}

export interface HarmonicLoss {
  harmonic: number
  frequencyHz: number
  currentRmsA: number
  fieldRmsAPerM: number
  dcComponentW: number
  skinIncrementW: number
  proximityW: number
}

export interface WindingLossBreakdown {
  dcCopperW: number
  skinEffectW: number
  externalProximityW: number
  bundleCirculatingW: number
  terminationW: number
  totalW: number
  effectiveAcFactor: number
  currentRmsA: number
  harmonics: HarmonicLoss[]
}

export interface StackLayer {
  label: string
  turns: number
  conductorLengthM: number
  wire: LitzWire
  currentWaveformA: number[]
}

interface LayerSpectrum {
  layer: StackLayer
  currentPhasors: Complex[]
  currentRmsTotal: number
  rdcOhm: number
}

export function copperResistivity(temperatureC: number): number {
  return COPPER_RESISTIVITY_20 * (1.0 + COPPER_ALPHA * (temperatureC - 20.0))
}

export function skinDepthM(frequencyHz: number, temperatureC = 20.0): number {
  if (frequencyHz <= 0.0) return Infinity
  const rho = copperResistivity(temperatureC)
  return Math.sqrt(rho / (Math.PI * frequencyHz * MU0))
}

/**
 * 孤立圆导线的精确内部阻抗（Rac/Rdc）。
 * 修正贝塞尔表示：z = (1+j)·r/δ；低频级数 1 + (a/δ)^4/48。
 */
export function roundWireSkinFactor(
  strandDiameterM: number, frequencyHz: number, temperatureC = 20.0,
): number {
  if (frequencyHz <= 0.0) return 1.0
  const radius = strandDiameterM / 2.0
  const delta = skinDepthM(frequencyHz, temperatureC)
  const z = { re: radius / delta, im: radius / delta }
  if (Math.hypot(z.re, z.im) < 1e-4) {
    return 1.0 + (radius / delta) ** 4 / 48.0
  }
  const ratio = cMul(cScale(z, 0.5), cDiv(besselI(0, z), besselI(1, z)))
  return Math.max(1.0, ratio.re)
}

export function dcResistanceOhm(wire: LitzWire, lengthM: number, temperatureC: number): number {
  return copperResistivity(temperatureC) * lengthM / wire.copperAreaM2
}

/** FFT RMS 相量：DC + 1..maxHarmonic 谐波的 RMS 复数相量 */
export function fftRmsPhasors(waveform: number[], maxHarmonic: number): Complex[] {
  if (waveform.length < 32) throw new Error('waveform must contain at least 32 samples')
  const coeffs = rfft(waveform).map(c => ({ re: c.re / waveform.length, im: c.im / waveform.length }))
  const phasors: Complex[] = [{ re: mean(waveform), im: 0.0 }]
  for (let harmonic = 1; harmonic <= maxHarmonic; harmonic++) {
    if (harmonic >= coeffs.length) {
      phasors.push({ re: 0.0, im: 0.0 })
    } else {
      // 峰值复系数为 2·Ck；RMS 相量 = 峰值/sqrt(2)
      phasors.push({ re: Math.SQRT2 * coeffs[harmonic]!.re, im: Math.SQRT2 * coeffs[harmonic]!.im })
    }
  }
  return phasors
}

export function harmonicRmsSpectrum(waveform: number[], maxHarmonic = 15): number[] {
  return fftRmsPhasors(waveform, maxHarmonic).map(x => Math.hypot(x.re, x.im))
}

/**
 * 单根圆绞线在横向 RMS H 场中的涡流损耗（W/m）。
 * 低频圆柱解在 d << δ 时精确；有界穿透修正扩展到实用 Litz 范围。
 */
export function transverseFieldLossPerStrandWPerM(
  strandDiameterM: number, frequencyHz: number, hRmsAPerM: number, temperatureC = 100.0,
): number {
  if (frequencyHz <= 0.0 || hRmsAPerM <= 0.0) return 0.0
  const rho = copperResistivity(temperatureC)
  const omega = 2.0 * Math.PI * frequencyHz
  const bRms = MU0 * hRmsAPerM
  const radius = strandDiameterM / 2.0
  const lowFrequency = (Math.PI * radius ** 4 * omega ** 2 * bRms ** 2) / (4.0 * rho)
  const penetration = roundWireSkinFactor(strandDiameterM, frequencyHz, temperatureC)
  return lowFrequency * Math.min(penetration, 8.0)
}

export function selectLitzWire(
  currentRmsA: number, strandCopperDiameterM: number, strandOuterDiameterM: number,
  packingFactor: number, currentDensityAPerMm2: number,
  maximumStrandsPerSubBundle = 400, strandRounding = 25,
): LitzWire {
  const areaRequiredMm2 = currentRmsA / currentDensityAPerMm2
  const areaPerStrandMm2 = Math.PI * (strandCopperDiameterM * 1e3) ** 2 / 4.0
  const rawCount = Math.max(1, Math.ceil(areaRequiredMm2 / areaPerStrandMm2))
  const strandCount = Math.ceil(rawCount / strandRounding) * strandRounding
  const subBundles = Math.ceil(strandCount / maximumStrandsPerSubBundle)
  return makeLitzWire(strandCount, strandCopperDiameterM, strandOuterDiameterM, packingFactor, subBundles)
}

export function windingLayers(
  turns: number, wire: LitzWire, windowWidthMm: number, turnSpacingMm = 0.15,
): [number, number] {
  const pitch = wire.equivalentOuterDiameterMm + turnSpacingMm
  const turnsPerLayer = Math.max(1, Math.floor(windowWidthMm / pitch))
  return [Math.ceil(turns / turnsPerLayer), turnsPerLayer]
}

export function distributeTurns(turns: number, turnsPerLayer: number): number[] {
  let remaining = turns
  const result: number[] = []
  while (remaining > 0) {
    const n = Math.min(remaining, turnsPerLayer)
    result.push(n)
    remaining -= n
  }
  return result
}

export interface LayeredLitzStackOptions {
  maxHarmonic?: number
  transpositionQuality?: number
  subBundleCouplingFactor?: number
  terminationResistanceFraction?: number
  extraFieldHarmonicsAPerM?: Map<number, number>
  calibrationFactor?: number
}

/**
 * 完整物理绕组叠层的损耗。
 * 层边界累积复数安匝 → 每层内部平均 H²，自然捕捉
 * P/2-S-P/2 交错的好处与双层电感绕组的强场。
 */
export function layeredLitzStackLoss(
  layers: StackLayer[], fundamentalFrequencyHz: number, windowWidthM: number,
  temperatureC = 100.0, options: LayeredLitzStackOptions = {},
): Map<string, WindingLossBreakdown> {
  const {
    maxHarmonic = 15, transpositionQuality = 0.90, subBundleCouplingFactor = 0.12,
    terminationResistanceFraction = 0.03, extraFieldHarmonicsAPerM = new Map(),
    calibrationFactor = 1.0,
  } = options

  if (layers.length === 0) return new Map()
  const sampleCount = layers[0]!.currentWaveformA.length
  for (const layer of layers) {
    if (layer.currentWaveformA.length !== sampleCount) {
      throw new Error('all stack-layer waveforms must have equal length')
    }
  }
  if (windowWidthM <= 0.0) throw new Error('window width must be positive')
  const tq = Math.min(Math.max(transpositionQuality, 0.0), 1.0)

  const spectra: LayerSpectrum[] = layers.map(layer => {
    const phasors = fftRmsPhasors(layer.currentWaveformA, maxHarmonic)
    const rmsTotal = Math.sqrt(mean(layer.currentWaveformA.map(v => v * v)))
    const rdc = dcResistanceOhm(layer.wire, layer.conductorLengthM, temperatureC)
    return { layer, currentPhasors: phasors, currentRmsTotal: rmsTotal, rdcOhm: rdc }
  })

  const labels = [...new Set(layers.map(l => l.label))].sort()
  interface Accum {
    dc: number; skin: number; prox: number; bundle: number; term: number
    rmsSqLength: number; rdcLoss: number; harmonics: HarmonicLoss[]
  }
  const accum = new Map<string, Accum>()
  for (const label of labels) {
    accum.set(label, { dc: 0, skin: 0, prox: 0, bundle: 0, term: 0, rmsSqLength: 0, rdcLoss: 0, harmonics: [] })
  }

  for (let harmonic = 0; harmonic <= maxHarmonic; harmonic++) {
    const frequency = harmonic * fundamentalFrequencyHz
    const boundaryMmf: Complex[] = [{ re: 0, im: 0 }]
    for (const spectrum of spectra) {
      const iph = spectrum.currentPhasors[harmonic]!
      const last = boundaryMmf[boundaryMmf.length - 1]!
      boundaryMmf.push({ re: last.re + spectrum.layer.turns * iph.re, im: last.im + spectrum.layer.turns * iph.im })
    }

    for (let index = 0; index < spectra.length; index++) {
      const spectrum = spectra[index]!
      const label = spectrum.layer.label
      const item = accum.get(label)!
      const current = spectrum.currentPhasors[harmonic]!
      const iRms = Math.hypot(current.re, current.im)
      if (harmonic === 0) {
        const pDc = iRms ** 2 * spectrum.rdcOhm
        item.dc += pDc
        continue
      }
      const h0 = { re: boundaryMmf[index]!.re / windowWidthM, im: boundaryMmf[index]!.im / windowWidthM }
      const h1 = { re: boundaryMmf[index + 1]!.re / windowWidthM, im: boundaryMmf[index + 1]!.im / windowWidthM }
      // ∫|线性复数场|² 穿过层厚度
      const h0sq = h0.re * h0.re + h0.im * h0.im
      const h0h1real = h0.re * h1.re + h0.im * h1.im
      const h1sq = h1.re * h1.re + h1.im * h1.im
      const extra = extraFieldHarmonicsAPerM.get(harmonic) ?? 0.0
      const hSq = (h0sq + h0h1real + h1sq) / 3.0 + extra * extra
      const hRms = Math.sqrt(Math.max(hSq, 0.0))

      const pBase = iRms ** 2 * spectrum.rdcOhm
      const skinFactor = roundWireSkinFactor(
        spectrum.layer.wire.strandCopperDiameterM, frequency, temperatureC)
      const pSkin = pBase * (skinFactor - 1.0)
      let pProx = transverseFieldLossPerStrandWPerM(
        spectrum.layer.wire.strandCopperDiameterM, frequency, hRms, temperatureC)
        * spectrum.layer.wire.strandCount * spectrum.layer.conductorLengthM

      // 不完全换位 + 独立绞合子束 → 残余环流惩罚
      const buildRatio = Math.max(1.0, spectrum.layer.wire.equivalentOuterDiameterM
        / spectrum.layer.wire.strandOuterDiameterM)
      const imperfection = (1.0 - tq) * Math.sqrt(buildRatio)
      const subBundle = Math.max(spectrum.layer.wire.subBundleCount - 1, 0)
      const pBundle = pProx * (subBundleCouplingFactor * imperfection * Math.log1p(subBundle))
      pProx *= calibrationFactor
      const pBundleCal = pBundle * calibrationFactor

      item.dc += pBase
      item.skin += pSkin
      item.prox += pProx
      item.bundle += pBundleCal
      item.harmonics.push({
        harmonic, frequencyHz: frequency, currentRmsA: iRms, fieldRmsAPerM: hRms,
        dcComponentW: pBase, skinIncrementW: pSkin, proximityW: pProx + pBundleCal,
      })
    }
  }

  const results = new Map<string, WindingLossBreakdown>()
  for (const label of labels) {
    const item = accum.get(label)!
    const dc = item.dc
    const skin = item.skin
    const prox = item.prox
    const bundle = item.bundle
    const termination = terminationResistanceFraction * dc
    const total = dc + skin + prox + bundle + termination
    const first = spectra.find(s => s.layer.label === label)!
    const factor = dc > 0.0 ? total / dc : 1.0
    results.set(label, {
      dcCopperW: dc, skinEffectW: skin, externalProximityW: prox, bundleCirculatingW: bundle,
      terminationW: termination, totalW: total, effectiveAcFactor: factor,
      currentRmsA: first.currentRmsTotal, harmonics: item.harmonics,
    })
  }
  return results
}

/** 兼容包装：保守单频估计（新代码应使用 layeredLitzStackLoss） */
export function litzAcFactor(
  wire: LitzWire, frequencyHz: number, layers: number, severity: number, correction: number,
  temperatureC = 100.0,
): number {
  const skin = roundWireSkinFactor(wire.strandCopperDiameterM, frequencyHz, temperatureC)
  const delta = skinDepthM(frequencyHz, temperatureC)
  const strandRatio = wire.strandCopperDiameterM / Math.max(2.0 * delta, 1e-15)
  const proximity = correction * severity * Math.max(layers, 1) ** 2 * strandRatio ** 4
  return Math.max(1.0, skin + proximity)
}

// 本地复数助手
function cMul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }
}
function cDiv(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }
}
function cScale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s }
}
