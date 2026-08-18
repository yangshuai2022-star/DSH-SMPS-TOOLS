/**
 * 参数完整性检查 + 交互式问答引导
 *
 * 识别用户未显式提供的工程关键参数，以结构化"问答"形式引导用户补全
 * （用户点选选项/填数字即可），而不是静默使用默认值（不脑补原则）。
 */

/** 一项假设/默认参数的说明 */
export interface ParamAssumption {
  param: string
  value: string
  why: string
}

/** 一个待用户确认/回答的参数问题 */
export interface ParamQuestion {
  /** 参数名（工具 schema 中的名称） */
  param: string
  /** 给用户的问题（中文） */
  prompt: string
  /** 可点选的选项（按键式回答） */
  options: string[]
  /** 当前默认值（如果用户不回答将使用） */
  default: string
}

export interface AssumptionReport {
  /** 需要用户回答的问题（缺失的关键参数） */
  questions: ParamQuestion[]
  /** 使用了默认值的参数（仍建议用户知晓） */
  assumed: ParamAssumption[]
}

interface RequestLike {
  vinNom?: number
  vinMinNormal?: number
  vinMax?: number
  vinHoldEnd?: number
  k?: number
  q?: number
  corePreset?: string
  topology?: string
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

interface TuneRequestLike extends RequestLike {
  crossoverKhz?: number
  phaseMarginDeg?: number
  sampleTimeUs?: number
  loadFraction?: number
}

/** 设计工具（llc_design）参数问题定义 */
function designQuestions(req: RequestLike): ParamQuestion[] {
  const qs: ParamQuestion[] = []
  if (req.topology === undefined) {
    qs.push({
      param: 'topology',
      prompt: '原边拓扑是半桥还是全桥？',
      options: ['半桥', '全桥'],
      default: '全桥',
    })
  }
  if (req.vinNom === undefined || req.vinMinNormal === undefined || req.vinMax === undefined) {
    qs.push({
      param: 'vinNom/vinMinNormal/vinMax',
      prompt: '母线电压范围是多少？（标称/最低/最高，单位 V）',
      options: ['360–420V（PFC 前级典型，标称 400）', '380–420V（窄范围，标称 400）', '自定义（请填三个数字）'],
      default: '400 / 360 / 420 V',
    })
  }
  if (req.vinHoldEnd === undefined) {
    qs.push({
      param: 'vinHoldEnd',
      prompt: '是否需要掉电保持（hold-up）设计？末端电压是多少 V？（若无需保持可回答"不需要"）',
      options: ['需要，300V', '需要，330V', '不需要（按正常范围设计）'],
      default: '300 V',
    })
  }
  if (req.k === undefined) {
    qs.push({
      param: 'k',
      prompt: '电感比 K = Lm/Lr 取多少？（影响增益峰值与磁性体积）',
      options: ['3（窄增益范围/小体积）', '5（折中，默认）', '7（宽增益/大体积）'],
      default: '5',
    })
  }
  if (req.q === undefined) {
    qs.push({
      param: 'q',
      prompt: '满载品质因数 Q 取多少？（影响增益曲线尖锐度）',
      options: ['0.3（平缓）', '0.35（折中，默认）', '0.4（尖锐）'],
      default: '0.35',
    })
  }
  if (req.corePreset === undefined) {
    qs.push({
      param: 'corePreset',
      prompt: '使用哪个磁芯？（窗口/损耗/成本权衡，也可自动从磁芯库搜索）',
      options: ['自动搜索（推荐）', 'TDK PQ35/35 N87', 'TDK PQ35/35 N97', '自定义（请填型号或数据表参数）'],
      default: '自动搜索',
    })
  }
  return qs
}

/** 整定工具（llc_tune_loop）额外参数问题 */
function tuneQuestions(req: TuneRequestLike): ParamQuestion[] {
  const qs: ParamQuestion[] = []
  if (req.crossoverKhz === undefined) {
    qs.push({
      param: 'crossoverKhz',
      prompt: '电压环目标穿越频率（带宽）是多少 kHz？（越高动态越快，但受 plant 相位限制）',
      options: ['自动（fsw/20）', '0.5 kHz（保守）', '1 kHz', '2.5 kHz（激进，需验证）'],
      default: 'fsw/20（自动）',
    })
  }
  if (req.phaseMarginDeg === undefined) {
    qs.push({
      param: 'phaseMarginDeg',
      prompt: '目标相位裕度是多少度？（决定阶跃阻尼，一般 40~70°）',
      options: ['40°（带宽优先）', '50°（折中，默认）', '60°（阻尼优先）'],
      default: '50°',
    })
  }
  if (req.sampleTimeUs === undefined) {
    qs.push({
      param: 'sampleTimeUs',
      prompt: '数字控制采样周期是多少 µs？（与开关频率/ADC 配置相关）',
      options: ['10 µs', '20 µs（默认）', '自定义'],
      default: '20 µs',
    })
  }
  if (req.loadFraction === undefined) {
    qs.push({
      param: 'loadFraction',
      prompt: '整定工作点取多大负载？',
      options: ['满载（1.0，默认）', '半载（0.5）', '满载+轻载都验证'],
      default: '1.0（满载）',
    })
  }
  return qs
}

/** 设计工具（llc_design）参数完整性检查 */
export function collectDesignAssumptions(req: RequestLike): AssumptionReport {
  const questions = designQuestions(req)
  const assumed: ParamAssumption[] = []
  if (req.vinNom === undefined) {
    assumed.push({ param: 'vinNom', value: '400 V', why: '标称母线电压' })
  }
  if (req.vinMinNormal === undefined) {
    assumed.push({ param: 'vinMinNormal', value: '360 V', why: '正常最低母线电压' })
  }
  if (req.vinMax === undefined) {
    assumed.push({ param: 'vinMax', value: '420 V', why: '最高母线电压' })
  }
  if (req.vinHoldEnd === undefined) {
    assumed.push({ param: 'vinHoldEnd', value: '300 V', why: '掉电保持末端电压' })
  }
  if (req.k === undefined) {
    assumed.push({ param: 'k', value: '5 (Lm/Lr)', why: '电感比' })
  }
  if (req.q === undefined) {
    assumed.push({ param: 'q', value: '0.35', why: '满载品质因数' })
  }
  if (req.corePreset === undefined) {
    assumed.push({ param: 'corePreset', value: '自动搜索（磁芯库）', why: '磁芯选型' })
  }
  if (req.primaryTurns === undefined || req.secondaryTurns === undefined) {
    assumed.push({ param: 'primaryTurns/secondaryTurns', value: '自动匝数搜索', why: '匝数由算法确定' })
  }
  if (req.fminKhz === undefined) {
    assumed.push({ param: 'fminKhz', value: 'fr×0.6', why: '最低开关频率' })
  }
  if (req.fmaxKhz === undefined) {
    assumed.push({ param: 'fmaxKhz', value: 'fr×1.8', why: '最高开关频率' })
  }
  if (req.maxFluxDensityT === undefined) {
    assumed.push({ param: 'maxFluxDensityT', value: '0.18 T', why: '最大磁通密度限制' })
  }
  if (req.ambientTempC === undefined) {
    assumed.push({ param: 'ambientTempC', value: '45 ℃', why: '环境温度' })
  }
  if (req.windingTempC === undefined) {
    assumed.push({ param: 'windingTempC', value: '100 ℃', why: '绕组温度' })
  }
  return { questions, assumed }
}

/** 整定工具（llc_tune_loop）参数完整性检查 */
export function collectTuneAssumptions(
  req: TuneRequestLike,
): AssumptionReport {
  const base = collectDesignAssumptions(req)
  const questions = [...base.questions, ...tuneQuestions(req)]
  const assumed = [...base.assumed]
  if (req.crossoverKhz === undefined) {
    assumed.push({ param: 'crossoverKhz', value: 'fsw/20（自动）', why: '目标穿越频率' })
  }
  if (req.phaseMarginDeg === undefined) {
    assumed.push({ param: 'phaseMarginDeg', value: '50°', why: '目标相位裕度' })
  }
  if (req.sampleTimeUs === undefined) {
    assumed.push({ param: 'sampleTimeUs', value: '20 µs', why: '控制采样周期' })
  }
  if (req.loadFraction === undefined) {
    assumed.push({ param: 'loadFraction', value: '1.0（满载）', why: '整定负载点' })
  }
  return { questions, assumed }
}
