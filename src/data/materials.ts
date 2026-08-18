/**
 * 铁氧体材料库（从仓库 llc_design/data/materials.json 转换）
 * 注意：官方标注为 engineering_reference_curves —— 生产发布前需用
 * 精确材料损耗曲线替换这些参考拟合系数。
 */

export interface SteinmetzPoint {
  temperatureC: number
  k: number
  alpha: number
  beta: number
}

export interface MaterialRecord {
  key: string
  manufacturer: string
  grade: string
  muI25: number
  bsatPoints: [number, number][]
  steinmetzPoints: SteinmetzPoint[]
  frequencyRangeHz: [number, number]
  fluxRangeT: [number, number]
  coreLossCorrection: number
}

export const MATERIALS: MaterialRecord[] = [
  {
    key: 'TDK_N87_REF', manufacturer: 'TDK/EPCOS', grade: 'N87', muI25: 2200.0,
    bsatPoints: [[25.0, 0.49], [100.0, 0.39], [120.0, 0.36]],
    steinmetzPoints: [
      { temperatureC: 25.0, k: 3.70, alpha: 1.43, beta: 2.72 },
      { temperatureC: 60.0, k: 3.25, alpha: 1.43, beta: 2.72 },
      { temperatureC: 100.0, k: 3.00, alpha: 1.43, beta: 2.72 },
      { temperatureC: 120.0, k: 3.20, alpha: 1.43, beta: 2.72 },
    ],
    frequencyRangeHz: [20000.0, 500000.0], fluxRangeT: [0.02, 0.30], coreLossCorrection: 1.0,
  },
  {
    key: 'TDK_N97_REF', manufacturer: 'TDK/EPCOS', grade: 'N97', muI25: 2300.0,
    bsatPoints: [[25.0, 0.49], [100.0, 0.39], [120.0, 0.36]],
    steinmetzPoints: [
      { temperatureC: 25.0, k: 2.75, alpha: 1.45, beta: 2.70 },
      { temperatureC: 60.0, k: 2.35, alpha: 1.45, beta: 2.70 },
      { temperatureC: 100.0, k: 2.10, alpha: 1.45, beta: 2.70 },
      { temperatureC: 120.0, k: 2.30, alpha: 1.45, beta: 2.70 },
    ],
    frequencyRangeHz: [25000.0, 500000.0], fluxRangeT: [0.02, 0.30], coreLossCorrection: 1.0,
  },
  {
    key: 'FERROXCUBE_3C95_REF', manufacturer: 'Ferroxcube', grade: '3C95', muI25: 3000.0,
    bsatPoints: [[25.0, 0.50], [100.0, 0.40], [120.0, 0.37]],
    steinmetzPoints: [
      { temperatureC: 25.0, k: 2.60, alpha: 1.46, beta: 2.72 },
      { temperatureC: 60.0, k: 2.20, alpha: 1.46, beta: 2.72 },
      { temperatureC: 100.0, k: 2.00, alpha: 1.46, beta: 2.72 },
      { temperatureC: 120.0, k: 2.20, alpha: 1.46, beta: 2.72 },
    ],
    frequencyRangeHz: [25000.0, 400000.0], fluxRangeT: [0.02, 0.30], coreLossCorrection: 1.0,
  },
  {
    key: 'TDK_PC95_REF', manufacturer: 'TDK', grade: 'PC95-class', muI25: 3300.0,
    bsatPoints: [[25.0, 0.51], [100.0, 0.41], [120.0, 0.38]],
    steinmetzPoints: [
      { temperatureC: 25.0, k: 2.35, alpha: 1.48, beta: 2.70 },
      { temperatureC: 60.0, k: 2.00, alpha: 1.48, beta: 2.70 },
      { temperatureC: 100.0, k: 1.85, alpha: 1.48, beta: 2.70 },
      { temperatureC: 120.0, k: 2.05, alpha: 1.48, beta: 2.70 },
    ],
    frequencyRangeHz: [50000.0, 500000.0], fluxRangeT: [0.02, 0.25], coreLossCorrection: 1.0,
  },
]
