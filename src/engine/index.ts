/**
 * 引擎适配层：把用户（模型）输入映射为算法调用，输出可序列化设计结果。
 */

import type { LLCDesignSpec, PrimaryTopology } from '../core/spec.ts'
import { DEFAULT_SPEC } from '../core/spec.ts'
import { CORE_PRESETS, type FerriteCorePreset } from '../data/corePresets.ts'
import {
  DEFAULT_SYNTHESIS_SETTINGS, synthesizeTransformer,
  type TransformerSynthesisResult, type TransformerWorkpoint,
} from '../magnetics/transformerDesigner.ts'

/** 用户/模型侧输入（对话中提供） */
export interface LlcDesignRequest {
  // 电气规格
  vinNom?: number
  vinMinNormal?: number
  vinMax?: number
  vinHoldEnd?: number
  vout: number
  pout: number
  frKhz: number
  fminKhz?: number
  fmaxKhz?: number
  topology?: 'half-bridge' | 'full-bridge'
  k?: number
  q?: number
  rectifierDropV?: number
  // 磁芯预设
  corePreset?: string
  // 搜索与工作点
  maxSecondaryTurns?: number
  maxPrimaryTurns?: number
  workpointScope?: 'all' | 'normal' | 'nominal'
  maxFluxDensityT?: number
  // 温度
  ambientTempC?: number
  windingTempC?: number
}

/** 对外可序列化的设计结果（纯数据，无 getter/类） */
export interface LlcDesignOutput {
  method: string
  feasible: boolean
  core: {
    presetKey: string
    partNumber: string
    shape: string
    materialGrade: string
    aeMm2: number
    aminMm2: number
    windingAreaMm2: number
    alNh: number
    muE: number
  }
  turns: {
    primary: number
    secondary: number
    ratio: number
    targetRatio: number
    ratioErrorPct: number
  }
  tank: {
    lrUh: number
    crNf: number
    lmUh: number
    frKhz: number
    fmKhz: number
    racNomOhm: number
    qFullLoad: number
    lnRatio: number
  }
  gap: {
    targetAlNh: number
    ungappedLmUh: number
    estimatedGapMm: number
  }
  litz: {
    primary: { description: string; strandCount: number; subBundles: number; currentRmsA: number; currentDensityAPerMm2: number }
    secondary: { description: string; strandCount: number; subBundles: number; currentRmsA: number; currentDensityAPerMm2: number }
  }
  winding: {
    fillFactor: number
    radialBuildMm: number
    primaryLayersPerHalf: number
    secondaryLayers: number
    primaryTurnsPerLayer: number
    secondaryTurnsPerLayer: number
    primaryRdcMohm: number
    secondaryRdcMohm: number
  }
  worstBPeakT: number
  gainCheck: {
    /** 最小增益需求 M_min（最高输入电压下） */
    mMin: number
    /** 最大增益需求 M_max（最低正常输入电压下） */
    mMax: number
    /** 掉电保持末端电压下的最大增益需求 */
    mMaxHoldEnd: number
    /** 满载各工作点的可用增益范围 [min, max]（1.0 满载点） */
    availableGainMin: number
    availableGainMax: number
  }
  zvs: {
    /** 各工作点是否全部处于感性区（输入阻抗相位 > 0） */
    allInductive: boolean
    /** 最低换流电流（A）及其工作点（ZVS 裕量下限） */
    minCommutationCurrentA: number
    minCommutationAtVbusV: number
    minCommutationAtLoad: number
  }
  loss: {
    coreW: number
    primaryCopperW: number
    secondaryCopperW: number
    totalW: number
    primaryAcFactor: number
    secondaryAcFactor: number
    estimatedHotspotC: number
  }
  workpoints: Array<{
    vbusV: number
    loadFraction: number
    fswKhz: number
    bPeakT: number
    primaryRmsA: number
    secondaryRmsA: number
    coreLossW: number
    primaryCopperW: number
    secondaryCopperW: number
    totalLossW: number
    /** 输入相位角（°），>0 感性区 */
    inputPhaseDeg: number
    /** 换流电流（A），ZVS 裕量评估 */
    commutationCurrentA: number
  }>
  warnings: string[]
  reasons: string[]
}

/** 按 presetKey 查磁芯预设；找不到返回默认 TDK_PQ35_35_B65881A_N87 */
export function resolveCorePreset(key?: string): FerriteCorePreset {
  if (key) {
    const hit = CORE_PRESETS.find(p => p.presetKey === key)
    if (hit) return hit
    throw new Error(
      `unknown core preset '${key}'. Available: ${CORE_PRESETS.map(p => p.presetKey).join(', ')}`,
    )
  }
  return CORE_PRESETS[0]!
}

export function buildSpec(request: LlcDesignRequest): LLCDesignSpec {
  const topology: PrimaryTopology = request.topology === 'half-bridge' ? 'HALF_BRIDGE' : 'FULL_BRIDGE'
  const frHz = request.frKhz * 1e3
  const fminHz = (request.fminKhz ?? request.frKhz * 0.6) * 1e3
  const fmaxHz = (request.fmaxKhz ?? request.frKhz * 1.8) * 1e3
  return {
    ...DEFAULT_SPEC,
    vbusNomV: request.vinNom ?? DEFAULT_SPEC.vbusNomV,
    vbusMinNormalV: request.vinMinNormal ?? DEFAULT_SPEC.vbusMinNormalV,
    vbusMaxV: request.vinMax ?? DEFAULT_SPEC.vbusMaxV,
    vbusHoldEndV: request.vinHoldEnd ?? DEFAULT_SPEC.vbusHoldEndV,
    voutV: request.vout,
    poutW: request.pout,
    primaryTopology: topology,
    resonantFrequencyHz: frHz,
    minimumFrequencyHz: fminHz,
    maximumFrequencyHz: fmaxHz,
    lnRatio: request.k ?? DEFAULT_SPEC.lnRatio,
    qFullLoad: request.q ?? DEFAULT_SPEC.qFullLoad,
    rectifierEquivalentDropV: request.rectifierDropV ?? DEFAULT_SPEC.rectifierEquivalentDropV,
    ambientTemperatureC: request.ambientTempC ?? DEFAULT_SPEC.ambientTemperatureC,
    windingTemperatureC: request.windingTempC ?? DEFAULT_SPEC.windingTemperatureC,
  }
}

export function toOutput(result: TransformerSynthesisResult): LlcDesignOutput {
  const core = result.core
  const tank = result.tank
  const pl = result.primaryLitz
  const sl = result.secondaryLitz
  const loss = result.nominalLoss
  return {
    method: 'proprietary-toolkit-v7.5',
    feasible: result.feasible,
    core: {
      presetKey: core.presetKey,
      partNumber: core.partNumber,
      shape: core.shape,
      materialGrade: core.materialGrade,
      aeMm2: core.aeMm2,
      aminMm2: core.aminMm2,
      windingAreaMm2: core.windingAreaMm2,
      alNh: core.alNh,
      muE: core.muE,
    },
    turns: {
      primary: result.primaryTurns,
      secondary: result.secondaryTurns,
      ratio: result.actualTurnsRatio,
      targetRatio: result.targetTurnsRatio,
      ratioErrorPct: result.turnsRatioErrorPct,
    },
    tank: {
      lrUh: tank.lrH * 1e6,
      crNf: tank.crF * 1e9,
      lmUh: tank.lmH * 1e6,
      frKhz: tank.frHz / 1e3,
      fmKhz: tank.fmHz / 1e3,
      racNomOhm: tank.racNomOhm,
      qFullLoad: tank.qFullLoad,
      lnRatio: tank.lnRatio,
    },
    gap: {
      targetAlNh: result.targetAlNh,
      ungappedLmUh: result.ungappedLmUh,
      estimatedGapMm: result.estimatedGapMm,
    },
    litz: {
      primary: {
        description: pl.description, strandCount: pl.strandCount,
        subBundles: pl.parallelSubBundles, currentRmsA: pl.currentRmsA,
        currentDensityAPerMm2: pl.currentDensityAPerMm2,
      },
      secondary: {
        description: sl.description, strandCount: sl.strandCount,
        subBundles: sl.parallelSubBundles, currentRmsA: sl.currentRmsA,
        currentDensityAPerMm2: sl.currentDensityAPerMm2,
      },
    },
    winding: {
      fillFactor: result.fillFactor,
      radialBuildMm: result.radialBuildMm,
      primaryLayersPerHalf: result.primaryLayersPerHalf,
      secondaryLayers: result.secondaryLayers,
      primaryTurnsPerLayer: result.primaryTurnsPerLayer,
      secondaryTurnsPerLayer: result.secondaryTurnsPerLayer,
      primaryRdcMohm: result.primaryRdcMohm,
      secondaryRdcMohm: result.secondaryRdcMohm,
    },
    worstBPeakT: result.worstBPeakT,
    gainCheck: computeGainCheck(result),
    zvs: computeZvs(result),
    loss: {
      coreW: loss.coreW,
      primaryCopperW: loss.primaryCopperW,
      secondaryCopperW: loss.secondaryCopperW,
      totalW: loss.totalW,
      primaryAcFactor: loss.primaryAcFactor,
      secondaryAcFactor: loss.secondaryAcFactor,
      estimatedHotspotC: loss.estimatedHotspotC,
    },
    workpoints: result.workpoints.map(wp => ({
      vbusV: wp.vbusV,
      loadFraction: wp.loadFraction,
      fswKhz: wp.switchingFrequencyHz / 1e3,
      bPeakT: wp.bPeakT,
      primaryRmsA: wp.primaryRmsA,
      secondaryRmsA: wp.secondaryRmsA,
      coreLossW: wp.coreLossW,
      primaryCopperW: wp.primaryCopperW,
      secondaryCopperW: wp.secondaryCopperW,
      totalLossW: wp.totalTransformerLossW,
      inputPhaseDeg: wp.inputPhaseDeg,
      commutationCurrentA: wp.commutationCurrentA,
    })),
    warnings: result.warnings,
    reasons: result.reasons,
  }
}

/**
 * 增益检查：需求增益 M_min/M_max vs 满载工作点可用增益范围。
 * 需求增益定义（同算法 target_gain）：M = n·(Vout+Vf)/(bridge_gain·Vbus)
 */
function computeGainCheck(result: TransformerSynthesisResult) {
  const spec = result.spec
  const n = result.actualTurnsRatio
  const bg = spec.primaryTopology === 'FULL_BRIDGE' ? 1.0 : 0.5
  const num = n * (spec.voutV + spec.rectifierEquivalentDropV)
  const mMin = num / (bg * spec.vbusMaxV)
  const mMax = num / (bg * spec.vbusMinNormalV)
  const mMaxHoldEnd = num / (bg * spec.vbusHoldEndV)
  // 满载（loadFraction=1）工作点的可用增益范围（solve_frequency 报告）
  const fullLoad = result.workpoints.filter(wp => wp.loadFraction >= 0.999)
  const availableGainMin = fullLoad.length > 0 ? Math.min(...fullLoad.map(wp => wp.availableGainMin)) : 0
  const availableGainMax = fullLoad.length > 0 ? Math.max(...fullLoad.map(wp => wp.availableGainMax)) : 0
  return { mMin, mMax, mMaxHoldEnd, availableGainMin, availableGainMax }
}

/** ZVS 检查：全部工作点是否感性区 + 最低换流电流 */
function computeZvs(result: TransformerSynthesisResult) {
  const wps = result.workpoints
  const allInductive = wps.every(wp => wp.inputPhaseDeg > 0)
  let min: TransformerWorkpoint | null = null
  for (const wp of wps) {
    if (min === null || wp.commutationCurrentA < min.commutationCurrentA) min = wp
  }
  return {
    allInductive,
    minCommutationCurrentA: min?.commutationCurrentA ?? 0,
    minCommutationAtVbusV: min?.vbusV ?? 0,
    minCommutationAtLoad: min?.loadFraction ?? 0,
  }
}

/** 顶层设计入口 */
export function designLlc(request: LlcDesignRequest): LlcDesignOutput {
  const preset = resolveCorePreset(request.corePreset)
  const spec = buildSpec(request)
  const result = synthesizeTransformer(spec, {
    presetKey: preset.presetKey,
    manufacturer: preset.manufacturer,
    partNumber: preset.partNumber,
    shape: preset.shape,
    materialKey: preset.materialKey,
    materialGrade: preset.materialGrade,
    aeMm2: preset.aeMm2,
    aminMm2: preset.aminMm2,
    leMm: preset.leMm,
    veMm3: preset.veMm3,
    sigmaLOverAPerMm: preset.sigmaLOverAPerMm,
    alNh: preset.alNh,
    muE: preset.muE,
    windingAreaMm2: preset.windingAreaMm2,
    meanTurnLengthMm: preset.meanTurnLengthMm,
    usableWindingWidthMm: preset.usableWindingWidthMm,
    arUohm: preset.arUohm,
    coreMassG: preset.coreMassG,
    thermalResistanceKPerW: preset.thermalResistanceKPerW,
    datasheetLossRefW: preset.datasheetLossRefW,
    datasheetLossRefFrequencyHz: preset.datasheetLossRefFrequencyHz,
    datasheetLossRefBT: preset.datasheetLossRefBT,
    datasheetLossRefTemperatureC: preset.datasheetLossRefTemperatureC,
  }, {
    ...DEFAULT_SYNTHESIS_SETTINGS,
    maxSecondaryTurnsSearch: request.maxSecondaryTurns ?? DEFAULT_SYNTHESIS_SETTINGS.maxSecondaryTurnsSearch,
    maxPrimaryTurnsSearch: request.maxPrimaryTurns ?? DEFAULT_SYNTHESIS_SETTINGS.maxPrimaryTurnsSearch,
    workpointScope: request.workpointScope ?? DEFAULT_SYNTHESIS_SETTINGS.workpointScope,
    maxFluxDensityT: request.maxFluxDensityT ?? DEFAULT_SYNTHESIS_SETTINGS.maxFluxDensityT,
  })
  return toOutput(result)
}
