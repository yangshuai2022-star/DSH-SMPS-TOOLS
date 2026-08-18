/**
 * 交互式 LLC 变压器综合（从仓库 llc_design/magnetics/transformer_designer.py 移植）
 *
 * 接受磁芯/骨架数据表参数（Ae/Amin/le/Ve/AL/µe/窗口面积/平均匝长），
 * 综合整数匝数对，按步长选择 0.1mm Litz 结构，用波形感知 iGSE 与
 * 分层 Litz 损耗引擎计算最终损耗。
 */

import { designTank, type TankDesign } from '../core/tank.ts'
import { GainNotReachableError } from '../core/tank.ts'
import { solveOperatingPoint, type LLCOperatingPoint } from '../core/operatingPoint.ts'
import { cloneSpec, type LLCDesignSpec } from '../core/spec.ts'
import { makeLitzWire, dcResistanceOhm, windingLayers, type LitzWire } from './litz.ts'
import { MaterialDatabase } from './material.ts'
import { toCoreSpec, type CoreSpec } from './core.ts'
import { MU0, transformerLoss, type TransformerDesign, type TransformerLoss } from './transformer.ts'

/** 铁氧体磁芯数据表输入（对应 FerriteCoreInput） */
export interface FerriteCoreInput {
  presetKey: string
  manufacturer: string
  partNumber: string
  shape: string
  materialKey: string
  materialGrade: string
  aeMm2: number
  aminMm2: number
  leMm: number
  veMm3: number
  sigmaLOverAPerMm: number
  alNh: number
  muE: number
  windingAreaMm2: number
  meanTurnLengthMm: number
  usableWindingWidthMm: number
  arUohm: number
  coreMassG: number
  thermalResistanceKPerW: number
  datasheetLossRefW: number
  datasheetLossRefFrequencyHz: number
  datasheetLossRefBT: number
  datasheetLossRefTemperatureC: number
}

export function effectiveWindowHeightMm(core: FerriteCoreInput): number {
  return core.windingAreaMm2 / Math.max(core.usableWindingWidthMm, 1e-9)
}

export function toCoreSpecFromFerrite(core: FerriteCoreInput): CoreSpec {
  const material = new MaterialDatabase().get(core.materialKey)
  return toCoreSpec({
    partNumber: core.partNumber,
    shape: core.shape,
    family: core.shape.toUpperCase().startsWith('PQ') ? 'PQ' : 'CUSTOM',
    manufacturer: core.manufacturer,
    standard: core.shape,
    materialKey: core.materialKey,
    purposes: ['transformer'],
    aeMm2: core.aeMm2,
    aminMm2: core.aminMm2,
    awMm2: core.windingAreaMm2,
    veMm3: core.veMm3,
    leMm: core.leMm,
    windowWidthMm: core.usableWindingWidthMm,
    windowHeightMm: effectiveWindowHeightMm(core),
    mltPrimaryMm: core.meanTurnLengthMm,
    mltSecondaryMm: core.meanTurnLengthMm,
    centerLegWidthMm: 2.0 * Math.sqrt(Math.max(core.aminMm2, 1e-9) / Math.PI),
    thermalResistanceKPerW: core.thermalResistanceKPerW,
    coreMassG: core.coreMassG,
    costUsd: 0.0,
  }, material)
}

export interface TransformerSynthesisSettings {
  nominalTankGain: number
  maxFluxDensityT: number
  strandCopperDiameterMm: number
  strandOuterDiameterMm: number
  strandCountStep: number
  currentDensityTargetAPerMm2: number
  currentDensityMaxAPerMm2: number
  packingFactor: number
  maxFillFactor: number
  insulationAreaMm2: number
  windingLayout: string
  maxSecondaryTurnsSearch: number
  maxPrimaryTurnsSearch: number
  turnRatioTolerance: number
  workpointScope: 'all' | 'normal' | 'nominal'
}

export const DEFAULT_SYNTHESIS_SETTINGS: TransformerSynthesisSettings = {
  nominalTankGain: 1.0,
  maxFluxDensityT: 0.18,
  strandCopperDiameterMm: 0.10,
  strandOuterDiameterMm: 0.112,
  strandCountStep: 50,
  currentDensityTargetAPerMm2: 6.0,
  currentDensityMaxAPerMm2: 8.0,
  packingFactor: 0.55,
  maxFillFactor: 0.60,
  insulationAreaMm2: 28.0,
  windingLayout: 'P/2-S-P/2',
  maxSecondaryTurnsSearch: 40,
  maxPrimaryTurnsSearch: 500,
  turnRatioTolerance: 0.04,
  workpointScope: 'all',
}

export interface LitzSelection {
  strandCount: number
  strandDiameterMm: number
  strandOuterDiameterMm: number
  copperAreaMm2: number
  equivalentOuterDiameterMm: number
  currentRmsA: number
  currentDensityAPerMm2: number
  parallelSubBundles: number
  strandsPerSubBundle: number
  description: string
}

export interface TransformerWorkpoint {
  vbusV: number
  loadFraction: number
  switchingFrequencyHz: number
  bPeakT: number
  primaryRmsA: number
  secondaryRmsA: number
  coreLossW: number
  primaryCopperW: number
  secondaryCopperW: number
  totalTransformerLossW: number
  /** 输入阻抗相位角（°）；>0 为感性区（容性/感性判定） */
  inputPhaseDeg: number
  /** 换流电流（A）：max(0.75·I_mag_peak, 基波换流电流)，ZVS 裕量评估用 */
  commutationCurrentA: number
  /** 该频率下可用增益范围 [min, max] */
  availableGainMin: number
  availableGainMax: number
}

export interface TransformerSynthesisResult {
  core: FerriteCoreInput
  settings: TransformerSynthesisSettings
  spec: LLCDesignSpec
  tank: TankDesign
  primaryTurns: number
  secondaryTurns: number
  targetTurnsRatio: number
  actualTurnsRatio: number
  turnsRatioErrorPct: number
  targetLmUh: number
  ungappedLmUh: number
  targetAlNh: number
  estimatedGapMm: number
  primaryLitz: LitzSelection
  secondaryLitz: LitzSelection
  primaryLayersPerHalf: number
  secondaryLayers: number
  primaryTurnsPerLayer: number
  secondaryTurnsPerLayer: number
  fillFactor: number
  radialBuildMm: number
  primaryRdcMohm: number
  secondaryRdcMohm: number
  worstBPeakT: number
  nominalLoss: TransformerLoss
  workpoints: TransformerWorkpoint[]
  feasible: boolean
  warnings: string[]
  reasons: string[]
}

function roundUpMultiple(value: number, step: number): number {
  const s = Math.max(Math.trunc(step), 1)
  return Math.ceil(Math.max(Math.trunc(value), 1) / s) * s
}

function selectDiscreteLitz(
  currentRmsA: number, settings: TransformerSynthesisSettings,
): [LitzWire, LitzSelection] {
  const dM = settings.strandCopperDiameterMm * 1e-3
  const doM = settings.strandOuterDiameterMm * 1e-3
  const areaStrandMm2 = Math.PI * settings.strandCopperDiameterMm ** 2 / 4.0
  const raw = Math.ceil(currentRmsA / Math.max(settings.currentDensityTargetAPerMm2 * areaStrandMm2, 1e-12))
  const count = roundUpMultiple(raw, settings.strandCountStep)
  const subBundles = Math.max(1, Math.ceil(count / 400.0))
  const wire = makeLitzWire(count, dM, doM, settings.packingFactor, subBundles)
  const density = currentRmsA / Math.max(wire.copperAreaMm2, 1e-12)
  const sel: LitzSelection = {
    strandCount: count,
    strandDiameterMm: settings.strandCopperDiameterMm,
    strandOuterDiameterMm: settings.strandOuterDiameterMm,
    copperAreaMm2: wire.copperAreaMm2,
    equivalentOuterDiameterMm: wire.equivalentOuterDiameterMm,
    currentRmsA,
    currentDensityAPerMm2: density,
    parallelSubBundles: subBundles,
    strandsPerSubBundle: wire.strandsPerSubBundle,
    description: wire.description,
  }
  return [wire, sel]
}

function workpointRequests(spec: LLCDesignSpec, scope: TransformerSynthesisSettings['workpointScope']): [number, number][] {
  if (scope === 'nominal') return [[spec.vbusNomV, 1.0]]
  if (scope === 'normal') {
    return [
      [spec.vbusMaxV, 1.0],
      [spec.vbusNomV, 1.0],
      [spec.vbusMinNormalV, 1.0],
      [spec.vbusNomV, 0.50],
      [spec.vbusNomV, 0.25],
      [spec.vbusNomV, 0.10],
    ]
  }
  return defaultWorkPoints(spec)
}

export function defaultWorkPoints(spec: LLCDesignSpec): [number, number][] {
  return [
    [spec.vbusMaxV, 1.0],
    [spec.vbusNomV, 1.0],
    [spec.vbusMinNormalV, 1.0],
    [spec.vbusHoldEndV, 1.0],
    [spec.vbusNomV, 0.50],
    [spec.vbusNomV, 0.25],
    [spec.vbusNomV, 0.10],
  ]
}

function solveWorkpoints(
  spec: LLCDesignSpec, tank: TankDesign,
  scope: TransformerSynthesisSettings['workpointScope'],
): LLCOperatingPoint[] {
  const points: LLCOperatingPoint[] = []
  const errors: string[] = []
  for (const [vbus, load] of workpointRequests(spec, scope)) {
    try {
      points.push(solveOperatingPoint(spec, tank, vbus, load))
    } catch (exc) {
      if (exc instanceof GainNotReachableError) {
        errors.push(`${vbus.toFixed(0)} V/${(load * 100).toFixed(0)}%: ${exc.message}`)
      } else {
        throw exc
      }
    }
  }
  if (errors.length > 0) {
    throw new GainNotReachableError(errors.join('; '))
  }
  return points
}

function candidateTurnPairs(
  spec: LLCDesignSpec, settings: TransformerSynthesisSettings,
): [number, number, number][] {
  const vsec = spec.voutV + spec.rectifierEquivalentDropV
  const targetRatio = (bridgeGainOf(spec) * spec.vbusNomV * settings.nominalTankGain) / Math.max(vsec, 1e-12)
  const out: [number, number, number][] = []
  for (let ns = 1; ns <= settings.maxSecondaryTurnsSearch; ns++) {
    const center = targetRatio * ns
    for (const npRaw of [...new Set([-1, 0, 1].map(delta => Math.max(1, Math.round(center) + delta)))].sort((a, b) => a - b)) {
      if (npRaw > settings.maxPrimaryTurnsSearch) continue
      const error = Math.abs(npRaw / ns - targetRatio) / Math.max(targetRatio, 1e-12)
      if (error <= settings.turnRatioTolerance) {
        out.push([npRaw, ns, targetRatio])
      }
    }
  }
  return out
}

function estimateGapMm(
  core: FerriteCoreInput, primaryTurns: number, targetLmH: number,
): [number, number, number] {
  const alTargetH = targetLmH / Math.max(primaryTurns ** 2, 1)
  const ungappedLmH = core.alNh * 1e-9 * primaryTurns ** 2
  if (alTargetH <= 0.0) return [0.0, ungappedLmH, 0.0]
  // 数据表有效磁导率的磁阻模型 —— 一阶总气隙估计；不含边缘与分布气隙。
  const gM = MU0 * core.aeMm2 * 1e-6 / alTargetH - core.leMm * 1e-3 / Math.max(core.muE, 1.0)
  return [Math.max(gM, 0.0) * 1e3, ungappedLmH, alTargetH * 1e9]
}

function bridgeGainOf(spec: LLCDesignSpec): number {
  return spec.primaryTopology === 'FULL_BRIDGE' ? 1.0 : 0.5
}

/**
 * 主入口：综合变压器设计（对应 synthesize_transformer）
 */
export function synthesizeTransformer(
  baseSpec: LLCDesignSpec,
  coreInput: FerriteCoreInput,
  settings?: TransformerSynthesisSettings,
): TransformerSynthesisResult {
  const s = settings ?? DEFAULT_SYNTHESIS_SETTINGS
  const core = toCoreSpecFromFerrite(coreInput)

  interface CandidateRecord {
    score: number
    spec: LLCDesignSpec
    tank: TankDesign
    ops: LLCOperatingPoint[]
    worstB: number
  }
  const candidateRecords: CandidateRecord[] = []
  const solveNotes: string[] = []
  for (const [np, ns, targetRatio] of candidateTurnPairs(baseSpec, s)) {
    const spec = cloneSpec(baseSpec, { primaryTurns: np, secondaryTurns: ns })
    const tank = designTank(spec)
    let ops: LLCOperatingPoint[]
    try {
      ops = solveWorkpoints(spec, tank, s.workpointScope)
    } catch (exc) {
      if (exc instanceof GainNotReachableError) {
        if (solveNotes.length < 6) solveNotes.push(exc.message)
        continue
      }
      throw exc
    }
    const bValues = ops.map(op =>
      op.transformerSquareEquivalentV / (4.0 * np * core.aminM2 * op.switchingFrequencyHz))
    const worstB = Math.max(...bValues)
    if (worstB > s.maxFluxDensityT * 1.20) {
      // 保持搜索紧凑：明显欠匝的候选直接丢弃
      continue
    }
    const ratioErr = Math.abs(np / ns - targetRatio) / targetRatio
    const fluxPenalty = Math.max(0.0, worstB / s.maxFluxDensityT - 1.0)
    // 优先最低实用匝数，同时强约束磁通与匝比
    const score = np + 0.35 * ns + 250.0 * ratioErr + 1000.0 * fluxPenalty
    candidateRecords.push({ score, spec, tank, ops, worstB })
  }

  if (candidateRecords.length === 0) {
    const detail = solveNotes[0] ?? 'no turn pair satisfied the search constraints'
    throw new Error(`automatic transformer turn search failed: ${detail}`)
  }
  candidateRecords.sort((a, b) => a.score - b.score)
  const best = candidateRecords[0]!
  const { spec, tank, ops, worstB } = best

  const maxIp = Math.max(...ops.map(op => op.resonantCurrentRmsA))
  const maxIs = Math.max(...ops.map(op => op.secondaryCurrentRmsA))
  const [pWire, pSel] = selectDiscreteLitz(maxIp, s)
  const [sWire, sSel] = selectDiscreteLitz(maxIs, s)

  const halfTurns = Math.ceil(spec.primaryTurns / 2)
  const [pLayers, pTpl] = windingLayers(halfTurns, pWire, core.windowWidthMm)
  const [sLayers, sTpl] = windingLayers(spec.secondaryTurns, sWire, core.windowWidthMm)

  const fillArea = spec.primaryTurns * pWire.envelopeAreaM2 * 1e6
    + spec.secondaryTurns * sWire.envelopeAreaM2 * 1e6
    + s.insulationAreaMm2
  const fillFactor = fillArea / Math.max(coreInput.windingAreaMm2, 1e-9)
  const radialBuild = 2.0 * pLayers * pWire.equivalentOuterDiameterMm
    + sLayers * sWire.equivalentOuterDiameterMm + 1.2

  const lengthP = spec.primaryTurns * coreInput.meanTurnLengthMm * 1e-3
  const lengthS = spec.secondaryTurns * coreInput.meanTurnLengthMm * 1e-3
  const rdcP = dcResistanceOhm(pWire, lengthP, spec.windingTemperatureC)
  const rdcS = dcResistanceOhm(sWire, lengthS, spec.windingTemperatureC)

  const [gapMm, ungappedLmH, targetAlNh] = estimateGapMm(coreInput, spec.primaryTurns, tank.lmH)

  const transformer: TransformerDesign = {
    core,
    primaryTurns: spec.primaryTurns,
    secondaryTurns: spec.secondaryTurns,
    primaryWire: pWire,
    secondaryWire: sWire,
    primaryLayersPerHalf: pLayers,
    secondaryLayers: sLayers,
    primaryTurnsPerLayer: pTpl,
    secondaryTurnsPerLayer: sTpl,
    fillFactor,
    radialBuildMm: radialBuild,
    gapTotalMm: gapMm,
    primaryRdcOhm: rdcP,
    secondaryRdcOhm: rdcS,
    worstBPeakT: worstB,
    feasible: true,
    reasons: [],
    alternatives: [],
  }

  const nominalOp = ops.reduce((bestOp, op) =>
    Math.abs(op.vbusV - spec.vbusNomV) + 100.0 * Math.abs(op.loadFraction - 1.0)
      < Math.abs(bestOp.vbusV - spec.vbusNomV) + 100.0 * Math.abs(bestOp.loadFraction - 1.0)
      ? op : bestOp)
  const nominalLoss = transformerLoss(transformer, spec, nominalOp)
  const workpoints: TransformerWorkpoint[] = ops.map(op => {
    const loss = transformerLoss(transformer, spec, op)
    return {
      vbusV: op.vbusV,
      loadFraction: op.loadFraction,
      switchingFrequencyHz: op.switchingFrequencyHz,
      bPeakT: loss.bPeakMinAreaT,
      primaryRmsA: op.resonantCurrentRmsA,
      secondaryRmsA: op.secondaryCurrentRmsA,
      coreLossW: loss.coreW,
      primaryCopperW: loss.primaryCopperW,
      secondaryCopperW: loss.secondaryCopperW,
      totalTransformerLossW: loss.totalW,
      inputPhaseDeg: op.inputPhaseDeg,
      commutationCurrentA: op.commutationCurrentA,
      availableGainMin: op.availableGainMin,
      availableGainMax: op.availableGainMax,
    }
  })

  const reasons: string[] = []
  const warnings: string[] = []
  if (worstB > s.maxFluxDensityT) {
    reasons.push(`worst Bpk ${worstB.toFixed(3)} T exceeds design limit ${s.maxFluxDensityT.toFixed(3)} T`)
  }
  if (pSel.currentDensityAPerMm2 > s.currentDensityMaxAPerMm2) {
    reasons.push('primary Litz current density exceeds maximum')
  }
  if (sSel.currentDensityAPerMm2 > s.currentDensityMaxAPerMm2) {
    reasons.push('secondary Litz current density exceeds maximum')
  }
  if (fillFactor > s.maxFillFactor) {
    reasons.push(`window fill ${fillFactor.toFixed(3)} exceeds ${s.maxFillFactor.toFixed(3)}`)
  }
  if (radialBuild > core.windowHeightMm) {
    warnings.push(
      `round-bundle radial-build screen ${radialBuild.toFixed(2)} mm exceeds equivalent window height `
      + `${core.windowHeightMm.toFixed(2)} mm; consider parallel/flattened Litz bundles and verify the bobbin drawing`,
    )
  }
  if (gapMm <= 0.0 && tank.lmH > ungappedLmH) {
    reasons.push('target Lm is higher than the ungapped AL estimate')
  }
  if (gapMm > 5.0) {
    warnings.push(`estimated total gap is large (${gapMm.toFixed(2)} mm); verify fringing/leakage`)
  }
  warnings.push(...nominalLoss.materialWarnings)
  warnings.push(
    'Core-loss calculation uses the bundled iGSE material reference fit.  The datasheet single-point Pv value is shown for cross-checking, not used as a full loss surface.',
  )

  const targetRatio = (bridgeGainOf(spec) * spec.vbusNomV * s.nominalTankGain)
    / (spec.voutV + spec.rectifierEquivalentDropV)
  const actualRatio = spec.primaryTurns / spec.secondaryTurns

  return {
    core: coreInput,
    settings: s,
    spec,
    tank,
    primaryTurns: spec.primaryTurns,
    secondaryTurns: spec.secondaryTurns,
    targetTurnsRatio: targetRatio,
    actualTurnsRatio: actualRatio,
    turnsRatioErrorPct: 100.0 * (actualRatio - targetRatio) / targetRatio,
    targetLmUh: tank.lmH * 1e6,
    ungappedLmUh: ungappedLmH * 1e6,
    targetAlNh,
    estimatedGapMm: gapMm,
    primaryLitz: pSel,
    secondaryLitz: sSel,
    primaryLayersPerHalf: pLayers,
    secondaryLayers: sLayers,
    primaryTurnsPerLayer: pTpl,
    secondaryTurnsPerLayer: sTpl,
    fillFactor,
    radialBuildMm: radialBuild,
    primaryRdcMohm: rdcP * 1e3,
    secondaryRdcMohm: rdcS * 1e3,
    worstBPeakT: worstB,
    nominalLoss,
    workpoints,
    feasible: reasons.length === 0,
    warnings: [...new Set(warnings)],
    reasons,
  }
}
