/**
 * LLC 设计规格（从仓库 llc_design/core/spec.py 移植）
 *
 * 默认值代表 V1 基线：400Vdc → 53V / 3kW，全桥 LLC，全桥同步整流。
 * 移植说明：设备损耗（MOSFET/SR）不在此插件范围内，未移植 MosfetSpec。
 */

export type PrimaryTopology = 'HALF_BRIDGE' | 'FULL_BRIDGE'
export type SecondaryTopology = 'FULL_BRIDGE_SR'

export interface LLCDesignSpec {
  // 电气规格
  vbusNomV: number
  vbusMinNormalV: number
  vbusMaxV: number
  vbusHoldEndV: number
  voutV: number
  poutW: number
  efficiencyAssumption: number
  primaryTopology: PrimaryTopology
  secondaryTopology: SecondaryTopology

  // 谐振腔
  resonantFrequencyHz: number
  minimumFrequencyHz: number
  maximumFrequencyHz: number
  lnRatio: number // Lm/Lr
  qFullLoad: number // sqrt(Lr/Cr)/Rac at rated load
  primaryTurns: number
  secondaryTurns: number
  rectifierEquivalentDropV: number

  // 输出/母线电容（环路小信号模型用）
  busCapacitanceF: number
  outputCapacitanceF: number
  outputCapEsrOhm: number
  resonantCapEsrOhm: number

  // 原边开关（环路死区/ZVS）
  primaryDeadtimeS: number
  primaryZvsMarginRequired: number

  // 温度/热（变压器损耗计算用）
  ambientTemperatureC: number
  windingTemperatureC: number
  transformerRthKPerW: number
  magneticThermalMaxIterations: number
  magneticThermalToleranceC: number
  magneticWaveformSamples: number
  magneticHotspotLimitC: number

  // Litz 与绕组约束
  litzStrandCopperDiameterM: number
  litzStrandOuterDiameterM: number
  litzPackingFactor: number
  litzCurrentDensityTargetAPerMm2: number
  litzCurrentDensityMaxAPerMm2: number
  transformerWindingLayout: string
  transformerCoreFamilies: string[]
  transformerMaxFillFactor: number
  transformerMaxBT: number
  transformerMaxGapMm: number
  transformerInsulationAreaMm2: number

  // 谐波 Litz / 绕组场模型
  litzMaxHarmonic: number
  litzTranspositionQuality: number
  litzSubBundleCouplingFactor: number
  windingTerminationResistanceFraction: number
  litzProximityCorrection: number
  transformerProximitySeverity: number
  includeGapFringingLoss: boolean
  gapToWindingDistanceMm: number
  gapFringingCalibration: number

  // 可行性裕量
  minimumInductiveAngleDeg: number

  // 搜索/工作点
  minimumModeledLoadFraction: number
}

export const DEFAULT_SPEC: LLCDesignSpec = {
  vbusNomV: 400.0,
  vbusMinNormalV: 360.0,
  vbusMaxV: 420.0,
  vbusHoldEndV: 300.0,
  voutV: 53.0,
  poutW: 3000.0,
  efficiencyAssumption: 0.96,
  primaryTopology: 'FULL_BRIDGE',
  secondaryTopology: 'FULL_BRIDGE_SR',
  resonantFrequencyHz: 100_000.0,
  minimumFrequencyHz: 60_000.0,
  maximumFrequencyHz: 180_000.0,
  lnRatio: 5.0,
  qFullLoad: 0.35,
  primaryTurns: 30,
  secondaryTurns: 4,
  rectifierEquivalentDropV: 0.40,

  busCapacitanceF: 1800e-6,
  outputCapacitanceF: 1500e-6,
  outputCapEsrOhm: 1.5e-3,
  resonantCapEsrOhm: 4.0e-3,
  primaryDeadtimeS: 200e-9,
  primaryZvsMarginRequired: 1.20,

  ambientTemperatureC: 45.0,
  windingTemperatureC: 100.0,
  transformerRthKPerW: 5.0,
  magneticThermalMaxIterations: 12,
  magneticThermalToleranceC: 0.25,
  magneticWaveformSamples: 2048,
  magneticHotspotLimitC: 130.0,

  litzStrandCopperDiameterM: 0.10e-3,
  litzStrandOuterDiameterM: 0.112e-3,
  litzPackingFactor: 0.55,
  litzCurrentDensityTargetAPerMm2: 5.0,
  litzCurrentDensityMaxAPerMm2: 6.0,
  transformerWindingLayout: 'P/2-S-P/2',
  transformerCoreFamilies: ['PQ', 'EE', 'EC', 'EER', 'ETD'],
  transformerMaxFillFactor: 0.60,
  transformerMaxBT: 0.20,
  transformerMaxGapMm: 4.0,
  transformerInsulationAreaMm2: 28.0,

  litzMaxHarmonic: 15,
  litzTranspositionQuality: 0.90,
  litzSubBundleCouplingFactor: 0.12,
  windingTerminationResistanceFraction: 0.03,
  litzProximityCorrection: 1.0,
  transformerProximitySeverity: 1.0,
  includeGapFringingLoss: true,
  gapToWindingDistanceMm: 3.0,
  gapFringingCalibration: 1.0,

  minimumInductiveAngleDeg: 3.0,
  minimumModeledLoadFraction: 0.10,
}

/** spec.clone(**changes) —— 不可变更新 */
export function cloneSpec(spec: LLCDesignSpec, changes: Partial<LLCDesignSpec>): LLCDesignSpec {
  return { ...spec, ...changes }
}

export function turnsRatio(spec: LLCDesignSpec): number {
  return spec.primaryTurns / spec.secondaryTurns
}

export function outputCurrentA(spec: LLCDesignSpec): number {
  return spec.poutW / spec.voutV
}

/** DC 转换归一化：全桥 1，半桥 0.5 */
export function bridgeGain(spec: LLCDesignSpec): number {
  return spec.primaryTopology === 'FULL_BRIDGE' ? 1.0 : 0.5
}

export function validateSpec(spec: LLCDesignSpec): void {
  const errors: string[] = []
  if (!(0 < spec.vbusHoldEndV && spec.vbusHoldEndV <= spec.vbusMinNormalV
    && spec.vbusMinNormalV <= spec.vbusNomV && spec.vbusNomV <= spec.vbusMaxV)) {
    errors.push('bus voltage ordering must be hold_end <= min_normal <= nominal <= maximum')
  }
  if (spec.voutV <= 0 || spec.poutW <= 0) {
    errors.push('output voltage and power must be positive')
  }
  if (!(0 < spec.minimumFrequencyHz && spec.minimumFrequencyHz < spec.maximumFrequencyHz)) {
    errors.push('frequency range is invalid')
  }
  if (!(spec.minimumFrequencyHz <= spec.resonantFrequencyHz && spec.resonantFrequencyHz <= spec.maximumFrequencyHz)) {
    errors.push('resonant frequency must lie inside the switching range')
  }
  if (spec.lnRatio <= 1.0) {
    errors.push('Ln=Lm/Lr must exceed 1')
  }
  if (spec.qFullLoad <= 0) {
    errors.push('full-load Q must be positive')
  }
  if (spec.primaryTurns <= 0 || spec.secondaryTurns <= 0) {
    errors.push('transformer turns must be positive integers')
  }
  if (spec.transformerCoreFamilies.length === 0) {
    errors.push('magnetic core-family filters cannot be empty')
  }
  if (spec.litzStrandCopperDiameterM <= 0) {
    errors.push('Litz strand copper diameter must be positive')
  }
  if (!(0.0 <= spec.litzTranspositionQuality && spec.litzTranspositionQuality <= 1.0)) {
    errors.push('Litz transposition quality must be within 0..1')
  }
  if (spec.litzMaxHarmonic < 1) {
    errors.push('Litz maximum harmonic must be >= 1')
  }
  if (spec.magneticWaveformSamples < 128) {
    errors.push('magnetic waveform samples must be >= 128')
  }
  if (errors.length > 0) {
    throw new Error(errors.join('; '))
  }
}
