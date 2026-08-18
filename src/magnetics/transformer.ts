/**
 * LLC 变压器综合：iGSE 磁芯损耗 + 分层 Litz 损耗
 * （从仓库 llc_design/magnetics/transformer.py 移植）
 *
 * 默认物理叠层 P/2-S-P/2。铜损按实际叠层 MMF 计算而非层数乘子：
 * 原边负载安匝与副边安匝在叠层内抵消；励磁电流、绞线集肤效应、
 * 残余外部场、束换位与端子电阻在损耗分解中显式可见。
 */

import { maxAbs } from '../core/numeric.ts'
import type { LLCOperatingPoint } from '../core/operatingPoint.ts'
import type { LLCDesignSpec } from '../core/spec.ts'
import type { TankDesign } from '../core/tank.ts'
import { coreLossWaveformW, lossRangeWarnings, saturationFluxAt, CoreDatabase, type CoreSpec } from './core.ts'
import {
  dcResistanceOhm, distributeTurns, layeredLitzStackLoss, selectLitzWire, windingLayers,
  type LitzWire, type StackLayer, type WindingLossBreakdown,
} from './litz.ts'
import { transformerCurrentWaveforms, transformerFluxWaveform } from './magneticWaveforms.ts'

export const MU0 = 4.0e-7 * Math.PI

export interface TransformerLoss {
  coreW: number
  primaryCopperW: number
  secondaryCopperW: number
  totalW: number
  bPeakT: number
  primaryAcFactor: number
  secondaryAcFactor: number
  bPeakMinAreaT: number
  primaryDcW: number
  primarySkinW: number
  primaryProximityW: number
  primaryBundleW: number
  primaryTerminationW: number
  secondaryDcW: number
  secondarySkinW: number
  secondaryProximityW: number
  secondaryBundleW: number
  secondaryTerminationW: number
  estimatedHotspotC: number
  materialWarnings: string[]
}

export interface TransformerCandidateSummary {
  rank: number
  partNumber: string
  family: string
  material: string
  feasible: boolean
  nominalTotalLossW: number
  nominalCoreLossW: number
  nominalPrimaryCopperW: number
  nominalSecondaryCopperW: number
  nominalHotspotC: number
  fillFactor: number
  radialBuildMm: number
  worstBPeakT: number
  gapTotalMm: number
  costUsd: number
  reasons: string[]
}

export interface TransformerDesign {
  core: CoreSpec
  primaryTurns: number
  secondaryTurns: number
  primaryWire: LitzWire
  secondaryWire: LitzWire
  primaryLayersPerHalf: number
  secondaryLayers: number
  primaryTurnsPerLayer: number
  secondaryTurnsPerLayer: number
  fillFactor: number
  radialBuildMm: number
  gapTotalMm: number
  primaryRdcOhm: number
  secondaryRdcOhm: number
  worstBPeakT: number
  feasible: boolean
  reasons: string[]
  alternatives: TransformerCandidateSummary[]
}

function windingStack(
  design: TransformerDesign,
  spec: LLCDesignSpec, op: LLCOperatingPoint,
): StackLayer[] {
  const samples = spec.magneticWaveformSamples
  const [primary, secondary] = transformerCurrentWaveforms(spec, op, samples)

  const p1Turns = Math.floor(design.primaryTurns / 2)
  const p2Turns = design.primaryTurns - p1Turns
  const p1Layers = distributeTurns(p1Turns, design.primaryTurnsPerLayer)
  const p2Layers = distributeTurns(p2Turns, design.primaryTurnsPerLayer)
  const sLayers = distributeTurns(design.secondaryTurns, design.secondaryTurnsPerLayer)
  const stack: StackLayer[] = []
  for (const turns of p1Layers) {
    stack.push({
      label: 'primary', turns,
      conductorLengthM: turns * design.core.mltPrimaryMm * 1e-3,
      wire: design.primaryWire, currentWaveformA: primary,
    })
  }
  for (const turns of sLayers) {
    stack.push({
      label: 'secondary', turns,
      conductorLengthM: turns * design.core.mltSecondaryMm * 1e-3,
      wire: design.secondaryWire, currentWaveformA: secondary,
    })
  }
  for (const turns of p2Layers) {
    stack.push({
      label: 'primary', turns,
      conductorLengthM: turns * design.core.mltPrimaryMm * 1e-3,
      wire: design.primaryWire, currentWaveformA: primary,
    })
  }
  return stack
}

interface LossAtTemperature {
  pCore: number
  primary: WindingLossBreakdown
  secondary: WindingLossBreakdown
  bPeak: number
  bPeakMin: number
  warnings: string[]
}

function lossAtTemperature(
  design: TransformerDesign, spec: LLCDesignSpec, op: LLCOperatingPoint, temperatureC: number,
): LossAtTemperature {
  const [t, b] = transformerFluxWaveform(op, design.primaryTurns, design.core.aeM2, spec.magneticWaveformSamples)
  const bPeak = Math.max(maxAbs(b))
  const bPeakMin = bPeak * design.core.aeM2 / design.core.aminM2
  const pCore = coreLossWaveformW(design.core, t, b, temperatureC)
  const stackLoss = layeredLitzStackLoss(
    windingStack(design, spec, op), op.switchingFrequencyHz, design.core.windowWidthM,
    temperatureC,
    {
      maxHarmonic: spec.litzMaxHarmonic,
      transpositionQuality: spec.litzTranspositionQuality,
      subBundleCouplingFactor: spec.litzSubBundleCouplingFactor,
      terminationResistanceFraction: spec.windingTerminationResistanceFraction,
      calibrationFactor: spec.litzProximityCorrection * spec.transformerProximitySeverity,
    },
  )
  return {
    pCore,
    primary: stackLoss.get('primary')!,
    secondary: stackLoss.get('secondary')!,
    bPeak, bPeakMin,
    warnings: lossRangeWarnings(design.core, op.switchingFrequencyHz, bPeak),
  }
}

export function transformerLoss(
  design: TransformerDesign, spec: LLCDesignSpec, op: LLCOperatingPoint,
): TransformerLoss {
  let temperature = Math.max(spec.windingTemperatureC, spec.ambientTemperatureC)
  let last: LossAtTemperature | null = null
  for (let i = 0; i < spec.magneticThermalMaxIterations; i++) {
    last = lossAtTemperature(design, spec, op, temperature)
    const predicted = spec.ambientTemperatureC
      + (last.pCore + last.primary.totalW + last.secondary.totalW) * spec.transformerRthKPerW
    const clamped = Math.min(Math.max(predicted, spec.ambientTemperatureC), 220.0)
    const updated = 0.55 * temperature + 0.45 * clamped
    if (Math.abs(updated - temperature) <= spec.magneticThermalToleranceC) {
      temperature = updated
      break
    }
    temperature = updated
  }
  if (last === null) last = lossAtTemperature(design, spec, op, temperature)
  const pCore = last.pCore
  const primary = last.primary
  const secondary = last.secondary
  const total = pCore + primary.totalW + secondary.totalW
  return {
    coreW: pCore,
    primaryCopperW: primary.totalW,
    secondaryCopperW: secondary.totalW,
    totalW: total,
    bPeakT: last.bPeak,
    primaryAcFactor: primary.effectiveAcFactor,
    secondaryAcFactor: secondary.effectiveAcFactor,
    bPeakMinAreaT: last.bPeakMin,
    primaryDcW: primary.dcCopperW,
    primarySkinW: primary.skinEffectW,
    primaryProximityW: primary.externalProximityW,
    primaryBundleW: primary.bundleCirculatingW,
    primaryTerminationW: primary.terminationW,
    secondaryDcW: secondary.dcCopperW,
    secondarySkinW: secondary.skinEffectW,
    secondaryProximityW: secondary.externalProximityW,
    secondaryBundleW: secondary.bundleCirculatingW,
    secondaryTerminationW: secondary.terminationW,
    estimatedHotspotC: temperature,
    materialWarnings: last.warnings,
  }
}

export function buildForCore(
  spec: LLCDesignSpec, tank: TankDesign, operatingPoints: LLCOperatingPoint[],
  core: CoreSpec,
): Omit<TransformerDesign, 'alternatives'> {
  const ops = operatingPoints
  const maxIp = Math.max(...ops.map(op => op.resonantCurrentRmsA))
  const maxIs = Math.max(...ops.map(op => op.secondaryCurrentRmsA))
  const primaryWire = selectLitzWire(
    maxIp, spec.litzStrandCopperDiameterM, spec.litzStrandOuterDiameterM,
    spec.litzPackingFactor, spec.litzCurrentDensityTargetAPerMm2)
  const secondaryWire = selectLitzWire(
    maxIs, spec.litzStrandCopperDiameterM, spec.litzStrandOuterDiameterM,
    spec.litzPackingFactor, spec.litzCurrentDensityTargetAPerMm2)

  const halfTurns = Math.ceil(spec.primaryTurns / 2)
  const [pLayers, pTpl] = windingLayers(halfTurns, primaryWire, core.windowWidthMm)
  const [sLayers, sTpl] = windingLayers(spec.secondaryTurns, secondaryWire, core.windowWidthMm)

  const fillArea = spec.primaryTurns * primaryWire.envelopeAreaM2 * 1e6
    + spec.secondaryTurns * secondaryWire.envelopeAreaM2 * 1e6
    + spec.transformerInsulationAreaMm2
  const fillFactor = fillArea / core.awMm2
  const radialBuild = 2.0 * pLayers * primaryWire.equivalentOuterDiameterMm
    + sLayers * secondaryWire.equivalentOuterDiameterMm + 1.2

  const lengthP = spec.primaryTurns * core.mltPrimaryMm * 1e-3
  const lengthS = spec.secondaryTurns * core.mltSecondaryMm * 1e-3
  const rdcP = dcResistanceOhm(primaryWire, lengthP, spec.windingTemperatureC)
  const rdcS = dcResistanceOhm(secondaryWire, lengthS, spec.windingTemperatureC)

  const bValues = ops.map(op =>
    op.transformerSquareEquivalentV / (4.0 * spec.primaryTurns * core.aminM2 * op.switchingFrequencyHz))
  const worstB = Math.max(...bValues)
  const gapM = MU0 * spec.primaryTurns ** 2 * core.aeM2 / tank.lmH - core.leM / core.muR
  const gapMm = Math.max(gapM, 0.0) * 1e3

  const reasons: string[] = []
  if (fillFactor > spec.transformerMaxFillFactor) {
    reasons.push(`window fill ${fillFactor.toFixed(3)} exceeds ${spec.transformerMaxFillFactor.toFixed(3)}`)
  }
  if (radialBuild > core.windowHeightMm) {
    reasons.push(`radial build ${radialBuild.toFixed(1)} mm exceeds ${core.windowHeightMm.toFixed(1)} mm`)
  }
  if (worstB > spec.transformerMaxBT) {
    reasons.push(`Bpk at minimum area ${worstB.toFixed(3)} T exceeds ${spec.transformerMaxBT.toFixed(3)} T`)
  }
  if (worstB > 0.70 * saturationFluxAt(core, spec.windingTemperatureC)) {
    reasons.push('Bpk exceeds 70% of temperature-adjusted saturation flux')
  }
  if (gapM < 0) reasons.push('required Lm exceeds ungapped-core estimate')
  if (gapMm > spec.transformerMaxGapMm) {
    reasons.push(`total gap ${gapMm.toFixed(2)} mm exceeds ${spec.transformerMaxGapMm.toFixed(2)} mm`)
  }

  return {
    core,
    primaryTurns: spec.primaryTurns,
    secondaryTurns: spec.secondaryTurns,
    primaryWire, secondaryWire,
    primaryLayersPerHalf: pLayers, secondaryLayers: sLayers,
    primaryTurnsPerLayer: pTpl, secondaryTurnsPerLayer: sTpl,
    fillFactor, radialBuildMm: radialBuild, gapTotalMm: gapMm,
    primaryRdcOhm: rdcP, secondaryRdcOhm: rdcS, worstBPeakT: worstB,
    feasible: reasons.length === 0, reasons,
  }
}

export function designTransformer(
  spec: LLCDesignSpec, tank: TankDesign, operatingPoints: LLCOperatingPoint[],
  database?: CoreDatabase, preferredCore?: string,
): TransformerDesign {
  const db = database ?? new CoreDatabase()
  const cores = preferredCore ? [db.get(preferredCore)] : db.forPurpose('transformer', spec.transformerCoreFamilies)
  const ops = operatingPoints
  const designs = cores.map(core => buildForCore(spec, tank, ops, core))
  const feasible = designs.filter(d => d.feasible)
  const candidates = feasible.length > 0 ? feasible : designs
  const nominal = ops.reduce((best, op) =>
    Math.abs(op.vbusV - spec.vbusNomV) + 100.0 * Math.abs(op.loadFraction - 1.0)
      < Math.abs(best.vbusV - spec.vbusNomV) + 100.0 * Math.abs(best.loadFraction - 1.0) ? op : best)
  const evaluated = candidates.map(design => {
    const loss = transformerLoss({ ...design, alternatives: [] }, spec, nominal)
    return { design, loss }
  })
  evaluated.sort((a, b) => {
    const fa = a.design.feasible ? 0 : 1
    const fb = b.design.feasible ? 0 : 1
    if (fa !== fb) return fa - fb
    if (a.loss.totalW !== b.loss.totalW) return a.loss.totalW - b.loss.totalW
    if (a.design.fillFactor !== b.design.fillFactor) return a.design.fillFactor - b.design.fillFactor
    return a.design.core.costUsd - b.design.core.costUsd
  })
  const summaries: TransformerCandidateSummary[] = evaluated.slice(0, 12).map((item, index) => ({
    rank: index + 1,
    partNumber: item.design.core.partNumber,
    family: item.design.core.family,
    material: item.design.core.material,
    feasible: item.design.feasible,
    nominalTotalLossW: item.loss.totalW,
    nominalCoreLossW: item.loss.coreW,
    nominalPrimaryCopperW: item.loss.primaryCopperW,
    nominalSecondaryCopperW: item.loss.secondaryCopperW,
    nominalHotspotC: item.loss.estimatedHotspotC,
    fillFactor: item.design.fillFactor,
    radialBuildMm: item.design.radialBuildMm,
    worstBPeakT: item.design.worstBPeakT,
    gapTotalMm: item.design.gapTotalMm,
    costUsd: item.design.core.costUsd,
    reasons: item.design.reasons,
  }))
  const best = evaluated[0]!
  return { ...best.design, alternatives: summaries }
}
