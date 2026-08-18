/**
 * 变压器磁芯预设（从仓库 llc_design/data/transformer_core_presets.json 转换）
 * 来源：TDK PQ35/35 B65881A core + B65882B coil former datasheet (2022-10)
 */

export interface FerriteCorePreset {
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

export const CORE_PRESETS: FerriteCorePreset[] = [
  {
    presetKey: 'TDK_PQ35_35_B65881A_N87',
    manufacturer: 'TDK Electronics',
    partNumber: 'B65881A0000R087',
    shape: 'PQ35/35',
    materialKey: 'TDK_N87_REF',
    materialGrade: 'N87',
    aeMm2: 171.0,
    aminMm2: 161.0,
    leMm: 79.7,
    veMm3: 13650.0,
    sigmaLOverAPerMm: 0.465,
    alNh: 4500.0,
    muE: 1670.0,
    windingAreaMm2: 158.0,
    meanTurnLengthMm: 76.0,
    usableWindingWidthMm: 24.6,
    arUohm: 16.5,
    coreMassG: 74.0,
    thermalResistanceKPerW: 5.0,
    datasheetLossRefW: 8.75,
    datasheetLossRefFrequencyHz: 100000.0,
    datasheetLossRefBT: 0.2,
    datasheetLossRefTemperatureC: 100.0,
  },
  {
    presetKey: 'TDK_PQ35_35_B65881A_N97',
    manufacturer: 'TDK Electronics',
    partNumber: 'B65881A0000R097',
    shape: 'PQ35/35',
    materialKey: 'TDK_N97_REF',
    materialGrade: 'N97',
    aeMm2: 171.0,
    aminMm2: 161.0,
    leMm: 79.7,
    veMm3: 13650.0,
    sigmaLOverAPerMm: 0.465,
    alNh: 4700.0,
    muE: 1750.0,
    windingAreaMm2: 158.0,
    meanTurnLengthMm: 76.0,
    usableWindingWidthMm: 24.6,
    arUohm: 16.5,
    coreMassG: 74.0,
    thermalResistanceKPerW: 5.0,
    datasheetLossRefW: 7.10,
    datasheetLossRefFrequencyHz: 100000.0,
    datasheetLossRefBT: 0.2,
    datasheetLossRefTemperatureC: 100.0,
  },
]
