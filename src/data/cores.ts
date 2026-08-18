/**
 * 磁芯几何库（从仓库 llc_design/data/cores.json 转换）
 * 官方标注：geometry values are engineering reference values ——
 * 正式设计前请按所选厂商订货代码核对磁芯半体/骨架/有效参数。
 */

export interface CoreRecord {
  partNumber: string
  shape: string
  family: string
  manufacturer: string
  standard: string
  materialKey: string
  purposes: string[]
  aeMm2: number
  aminMm2: number
  awMm2: number
  veMm3: number
  leMm: number
  windowWidthMm: number
  windowHeightMm: number
  mltPrimaryMm: number
  mltSecondaryMm: number
  centerLegWidthMm: number
  thermalResistanceKPerW: number
  coreMassG: number
  costUsd: number
}

export const CORES: CoreRecord[] = [
  { partNumber: 'PQ35_35_N97_REF', shape: 'PQ35/35', family: 'PQ', manufacturer: 'TDK/EPCOS-class', standard: 'PQ35/35', materialKey: 'TDK_N97_REF', purposes: ['transformer'], aeMm2: 160.0, aminMm2: 142.0, awMm2: 175.0, veMm3: 23800.0, leMm: 74.0, windowWidthMm: 21.5, windowHeightMm: 10.6, mltPrimaryMm: 78.0, mltSecondaryMm: 70.0, centerLegWidthMm: 14.0, thermalResistanceKPerW: 12.0, coreMassG: 74.0, costUsd: 5.5 },
  { partNumber: 'PQ40_REF', shape: 'PQ40/40', family: 'PQ', manufacturer: 'TDK/EPCOS-class', standard: 'PQ40/40', materialKey: 'TDK_N97_REF', purposes: ['transformer', 'inductor'], aeMm2: 201.0, aminMm2: 181.0, awMm2: 245.0, veMm3: 36000.0, leMm: 96.0, windowWidthMm: 25.0, windowHeightMm: 13.5, mltPrimaryMm: 92.0, mltSecondaryMm: 84.0, centerLegWidthMm: 16.0, thermalResistanceKPerW: 10.0, coreMassG: 110.0, costUsd: 7.0 },
  { partNumber: 'PQ50_REF', shape: 'PQ50/50', family: 'PQ', manufacturer: 'TDK/EPCOS-class', standard: 'PQ50/50', materialKey: 'TDK_N97_REF', purposes: ['transformer', 'inductor'], aeMm2: 328.0, aminMm2: 295.0, awMm2: 390.0, veMm3: 69000.0, leMm: 122.0, windowWidthMm: 32.0, windowHeightMm: 17.0, mltPrimaryMm: 116.0, mltSecondaryMm: 104.0, centerLegWidthMm: 20.0, thermalResistanceKPerW: 7.5, coreMassG: 205.0, costUsd: 11.0 },
  { partNumber: 'E42_IND_REF', shape: 'E42/21/15', family: 'EE', manufacturer: 'TDK/EPCOS-class', standard: 'E42/21/15', materialKey: 'TDK_N97_REF', purposes: ['transformer', 'inductor'], aeMm2: 178.0, aminMm2: 160.0, awMm2: 210.0, veMm3: 24000.0, leMm: 97.0, windowWidthMm: 27.0, windowHeightMm: 12.0, mltPrimaryMm: 91.0, mltSecondaryMm: 86.0, centerLegWidthMm: 14.5, thermalResistanceKPerW: 11.0, coreMassG: 78.0, costUsd: 5.0 },
  { partNumber: 'E55_IND_REF', shape: 'E55/28/21', family: 'EE', manufacturer: 'TDK/EPCOS-class', standard: 'E55/28/21', materialKey: 'TDK_N97_REF', purposes: ['transformer', 'inductor'], aeMm2: 354.0, aminMm2: 318.0, awMm2: 390.0, veMm3: 65000.0, leMm: 128.0, windowWidthMm: 36.0, windowHeightMm: 16.0, mltPrimaryMm: 119.0, mltSecondaryMm: 112.0, centerLegWidthMm: 20.5, thermalResistanceKPerW: 7.5, coreMassG: 190.0, costUsd: 9.0 },
  { partNumber: 'E65_32_27_N87_REF', shape: 'E65/32/27', family: 'EE', manufacturer: 'TDK/EPCOS-class', standard: 'E65/32/27', materialKey: 'TDK_N87_REF', purposes: ['transformer', 'inductor'], aeMm2: 535.0, aminMm2: 480.0, awMm2: 535.0, veMm3: 113000.0, leMm: 147.0, windowWidthMm: 42.0, windowHeightMm: 19.5, mltPrimaryMm: 143.0, mltSecondaryMm: 134.0, centerLegWidthMm: 26.0, thermalResistanceKPerW: 5.8, coreMassG: 330.0, costUsd: 15.0 },
  { partNumber: 'E70_33_32_N97_REF', shape: 'E70/33/32', family: 'EE', manufacturer: 'TDK/EPCOS-class', standard: 'E70/33/32', materialKey: 'TDK_N97_REF', purposes: ['transformer', 'inductor'], aeMm2: 683.0, aminMm2: 615.0, awMm2: 650.0, veMm3: 150000.0, leMm: 160.0, windowWidthMm: 46.0, windowHeightMm: 21.0, mltPrimaryMm: 157.0, mltSecondaryMm: 147.0, centerLegWidthMm: 30.0, thermalResistanceKPerW: 4.9, coreMassG: 430.0, costUsd: 19.0 },
  { partNumber: 'EC41_N97_REF', shape: 'EC41', family: 'EC', manufacturer: 'Ferroxcube/TDK-class', standard: 'EC41', materialKey: 'TDK_N97_REF', purposes: ['transformer', 'inductor'], aeMm2: 158.0, aminMm2: 142.0, awMm2: 225.0, veMm3: 25800.0, leMm: 82.0, windowWidthMm: 25.0, windowHeightMm: 12.5, mltPrimaryMm: 88.0, mltSecondaryMm: 80.0, centerLegWidthMm: 14.0, thermalResistanceKPerW: 11.5, coreMassG: 82.0, costUsd: 5.5 },
  { partNumber: 'EC52_N97_REF', shape: 'EC52', family: 'EC', manufacturer: 'Ferroxcube/TDK-class', standard: 'EC52', materialKey: 'TDK_N97_REF', purposes: ['transformer', 'inductor'], aeMm2: 285.0, aminMm2: 257.0, awMm2: 390.0, veMm3: 63000.0, leMm: 116.0, windowWidthMm: 35.0, windowHeightMm: 16.0, mltPrimaryMm: 116.0, mltSecondaryMm: 106.0, centerLegWidthMm: 20.0, thermalResistanceKPerW: 7.8, coreMassG: 185.0, costUsd: 9.5 },
  { partNumber: 'EC70_3C95_REF', shape: 'EC70', family: 'EC', manufacturer: 'Ferroxcube-class', standard: 'EC70', materialKey: 'FERROXCUBE_3C95_REF', purposes: ['transformer', 'inductor'], aeMm2: 650.0, aminMm2: 585.0, awMm2: 720.0, veMm3: 157000.0, leMm: 165.0, windowWidthMm: 49.0, windowHeightMm: 22.0, mltPrimaryMm: 163.0, mltSecondaryMm: 151.0, centerLegWidthMm: 30.0, thermalResistanceKPerW: 4.7, coreMassG: 450.0, costUsd: 21.0 },
  { partNumber: 'EER49_REF', shape: 'EER49', family: 'EER', manufacturer: 'industry-standard', standard: 'EER49', materialKey: 'TDK_N97_REF', purposes: ['transformer', 'inductor'], aeMm2: 250.0, aminMm2: 225.0, awMm2: 360.0, veMm3: 53000.0, leMm: 110.0, windowWidthMm: 31.0, windowHeightMm: 16.0, mltPrimaryMm: 108.0, mltSecondaryMm: 96.0, centerLegWidthMm: 19.0, thermalResistanceKPerW: 8.5, coreMassG: 155.0, costUsd: 9.0 },
  { partNumber: 'EER54_REF', shape: 'EER54', family: 'EER', manufacturer: 'industry-standard', standard: 'EER54', materialKey: 'TDK_N97_REF', purposes: ['transformer', 'inductor'], aeMm2: 353.0, aminMm2: 318.0, awMm2: 470.0, veMm3: 82000.0, leMm: 132.0, windowWidthMm: 36.0, windowHeightMm: 18.5, mltPrimaryMm: 126.0, mltSecondaryMm: 112.0, centerLegWidthMm: 22.0, thermalResistanceKPerW: 6.5, coreMassG: 235.0, costUsd: 13.0 },
  { partNumber: 'ETD49_REF', shape: 'ETD49', family: 'ETD', manufacturer: 'TDK/EPCOS-class', standard: 'ETD49', materialKey: 'TDK_N87_REF', purposes: ['transformer', 'inductor'], aeMm2: 211.0, aminMm2: 190.0, awMm2: 300.0, veMm3: 37000.0, leMm: 114.0, windowWidthMm: 30.0, windowHeightMm: 14.0, mltPrimaryMm: 104.0, mltSecondaryMm: 94.0, centerLegWidthMm: 17.0, thermalResistanceKPerW: 9.0, coreMassG: 120.0, costUsd: 8.0 },
  { partNumber: 'ETD59_REF', shape: 'ETD59', family: 'ETD', manufacturer: 'TDK/EPCOS-class', standard: 'ETD59', materialKey: 'TDK_N87_REF', purposes: ['transformer', 'inductor'], aeMm2: 368.0, aminMm2: 331.0, awMm2: 450.0, veMm3: 76000.0, leMm: 139.0, windowWidthMm: 38.0, windowHeightMm: 17.0, mltPrimaryMm: 128.0, mltSecondaryMm: 114.0, centerLegWidthMm: 22.0, thermalResistanceKPerW: 6.8, coreMassG: 220.0, costUsd: 12.0 },
]
