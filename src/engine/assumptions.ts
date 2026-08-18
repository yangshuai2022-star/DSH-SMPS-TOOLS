/**
 * 参数完整性检查：识别用户未显式提供的工程关键参数，
 * 输出"假设值"清单与"缺失建议"提示 —— 不脑补，不静默。
 */

/** 一项假设/默认参数的说明 */
export interface ParamAssumption {
  /** 参数名（工具 schema 中的名称） */
  param: string
  /** 实际使用的值 */
  value: string
  /** 为什么需要关注/建议显式提供 */
  why: string
}

export interface AssumptionReport {
  /** 使用了默认值的参数（建议用户确认） */
  assumed: ParamAssumption[]
  /** 缺失且工程上强烈建议显式提供的参数名 */
  missing: string[]
}

interface RequestLike {
  vinNom?: number
  vinMinNormal?: number
  vinMax?: number
  vinHoldEnd?: number
  k?: number
  q?: number
  corePreset?: string
  primaryTurns?: number
  secondaryTurns?: number
  outputCapF?: number
  outputCapEsrMohm?: number
  fminKhz?: number
  fmaxKhz?: number
  maxFluxDensityT?: number
  ambientTempC?: number
  windingTempC?: number
}

/** 设计工具（llc_design）的参数完整性检查 */
export function collectDesignAssumptions(req: RequestLike): AssumptionReport {
  const assumed: ParamAssumption[] = []
  const missing: string[] = []

  if (req.vinNom === undefined) {
    assumed.push({ param: 'vinNom', value: '400 V', why: '标称母线电压；若输入来自 PFC 前端请确认实际值' })
  }
  if (req.vinMinNormal === undefined) {
    assumed.push({ param: 'vinMinNormal', value: '360 V', why: '正常最低母线电压（决定最大增益需求 Mmax）' })
  }
  if (req.vinMax === undefined) {
    assumed.push({ param: 'vinMax', value: '420 V', why: '最高母线电压（决定最小增益需求 Mmin 与 Bpk 校验）' })
  }
  if (req.vinHoldEnd === undefined) {
    assumed.push({ param: 'vinHoldEnd', value: '300 V', why: '掉电保持末端电压（决定保持段增益需求与 Bpk 最恶劣点）' })
  }
  if (req.k === undefined) {
    assumed.push({ param: 'k', value: '5 (Lm/Lr)', why: '电感比：越大峰值增益越低、磁性体积越大；典型 3~8' })
  }
  if (req.q === undefined) {
    assumed.push({ param: 'q', value: '0.35', why: '满载品质因数：越大增益曲线越尖锐；典型 0.3~0.5' })
  }
  if (req.corePreset === undefined) {
    missing.push('corePreset')
    assumed.push({ param: 'corePreset', value: 'TDK_PQ35_35_B65881A_N87（自动搜索时用磁芯库）', why: '磁芯选型影响窗口/损耗/可行性，建议指定或确认自动选择结果' })
  }
  if (req.primaryTurns === undefined || req.secondaryTurns === undefined) {
    assumed.push({ param: 'primaryTurns/secondaryTurns', value: '自动匝数搜索', why: '匝数由算法搜索确定；如需指定请显式给出' })
  }
  if (req.fminKhz === undefined) {
    assumed.push({ param: 'fminKhz', value: 'fr×0.6', why: '最低开关频率（决定低压段 Bpk）' })
  }
  if (req.fmaxKhz === undefined) {
    assumed.push({ param: 'fmaxKhz', value: 'fr×1.8', why: '最高开关频率' })
  }
  if (req.maxFluxDensityT === undefined) {
    assumed.push({ param: 'maxFluxDensityT', value: '0.18 T', why: '最大磁通密度限制（Bpk 校验阈值）' })
  }
  if (req.ambientTempC === undefined) {
    assumed.push({ param: 'ambientTempC', value: '45 ℃', why: '环境温度（影响热点估算）' })
  }
  if (req.windingTempC === undefined) {
    assumed.push({ param: 'windingTempC', value: '100 ℃', why: '绕组温度（影响铜阻/损耗）' })
  }

  return { assumed, missing }
}

/** 整定工具（llc_tune_loop）的参数完整性检查（含设计参数） */
export function collectTuneAssumptions(
  req: RequestLike & { crossoverKhz?: number; phaseMarginDeg?: number; sampleTimeUs?: number; loadFraction?: number },
): AssumptionReport {
  const base = collectDesignAssumptions(req)
  const assumed = [...base.assumed]
  const missing = [...base.missing]

  if (req.crossoverKhz === undefined) {
    assumed.push({ param: 'crossoverKhz', value: 'fsw/20（自动）', why: '目标穿越频率：带宽越高对 plant 相位要求越高，建议显式指定' })
  }
  if (req.phaseMarginDeg === undefined) {
    assumed.push({ param: 'phaseMarginDeg', value: '50°', why: '目标相位裕度：建议按动态要求显式指定（40~70°）' })
  }
  if (req.sampleTimeUs === undefined) {
    assumed.push({ param: 'sampleTimeUs', value: '20 µs', why: '控制采样周期：决定离散化与延迟，建议与开关频率/ADC 配置核对' })
  }
  if (req.loadFraction === undefined) {
    assumed.push({ param: 'loadFraction', value: '1.0（满载）', why: '整定工作点负载' })
  }

  return { assumed, missing }
}
