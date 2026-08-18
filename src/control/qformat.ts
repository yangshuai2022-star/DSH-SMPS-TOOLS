/**
 * 32 位定点（Q 格式）转换：浮点控制器 → IQ 整数参数 + 自包含 int32 代码
 *
 * 严格对齐 DSP_CTRL_CODE 仓库的定点体系（doc/fixed_point_impl.md）：
 *   数据域 IQ27（±16，2⁻²⁷）：信号/状态/中间结果
 *   系数域 IQ20（±2048，2⁻²⁰）：增益类系数 kp / ki2p
 *   系数域 IQ24（±128，2⁻²⁴）：alpha（LPF 增量型）
 *   2P2Z 系数全 IQ27（极点位置灵敏度，§14.5）
 * 结构约定（§10.3/§11.3/§14.3）：
 *   PI  = 输出量纲积分器 + 方向性 anti-windup（ui ∈ [out_min, out_max]）
 *   PIF = PI + 增量型 LPF（凸组合天然有界免 clamp）
 *   2P2Z = DF-IIt 转置直接 II 型（状态 = 输出量纲部分和）
 */

import type { ControllerConfig } from './digitalLoop.ts'
import { controllerTransferFunction, controllerKind } from './digitalLoop.ts'

const Q27 = 27
const Q24 = 24
const Q20 = 20
const SCALE27 = 1 << Q27 // 134217728
const SCALE24 = 1 << Q24
const SCALE20 = 1 << Q20
const INT32_MAX = 2147483647

/** 定点量化的一个系数 */
export interface FixedCoeff {
  float: number
  q: number
  int: number
  lsb: number
}

export interface FixedPointResult {
  kind: 'pi' | 'pif' | '2p2z'
  tsS: number
  /** 系数（按控制器类型有不同子集） */
  kp?: FixedCoeff
  ki2p?: FixedCoeff
  alpha?: FixedCoeff
  b0?: FixedCoeff
  b1?: FixedCoeff
  b2?: FixedCoeff
  a1?: FixedCoeff
  a2?: FixedCoeff
  outMax: FixedCoeff
  outMin: FixedCoeff
  /** fail-fast 检查项 */
  checks: string[]
  /** 溢出核算表 */
  budget: Array<{ item: string; upper: number; limit: number; ok: boolean }>
}

export function quantize(value: number, q: number): FixedCoeff {
  const lsb = Math.pow(2, -q)
  const scaled = value * Math.pow(2, q)
  const rounded = Math.round(scaled)
  if (Math.abs(rounded) > INT32_MAX) {
    throw new Error(`fixed-point overflow: value ${value} at Q${q} exceeds int32`)
  }
  return { float: value, q, int: rounded, lsb }
}

/** 计算 PI 定点系数：kp（IQ20）、ki2p = kp·ts/(2Ti)（IQ20） */
export function computePiFixed(kp: number, tiS: number, tsS: number, outMax = 1.0, outMin = 0.0): {
  kp: FixedCoeff
  ki2p: FixedCoeff
  outMax: FixedCoeff
  outMin: FixedCoeff
} {
  const ki2p = kp * tsS / (2.0 * tiS)
  return {
    kp: quantize(kp, Q20),
    ki2p: quantize(ki2p, Q20),
    outMax: quantize(outMax, Q27),
    outMin: quantize(outMin, Q27),
  }
}

/** 计算 PIF 定点系数：PI + alpha（IQ24） */
export function computePifFixed(
  kp: number, tiS: number, lpfCutoffHz: number, tsS: number, outMax = 1.0, outMin = 0.0,
): { pi: ReturnType<typeof computePiFixed>; alpha: FixedCoeff } {
  const alphaFloat = lpfCutoffHz > 0
    ? tsS / (tsS + 1.0 / (2.0 * Math.PI * lpfCutoffHz))
    : 1.0
  return {
    pi: computePiFixed(kp, tiS, tsS, outMax, outMin),
    alpha: quantize(alphaFloat, Q24),
  }
}

/**
 * 计算 2P2Z 定点系数（全 IQ27）。
 * 总增益外置归一化（B ≤ 1）→ 状态 |s1| ≤ |B1+B2|+|A1+A2| ≤ 4（§14.2）。
 * 若 |B| 或 |A| 超界则报告 fail-fast。
 */
export function compute2P2ZFixed(
  b0: number, b1: number, b2: number, a1: number, a2: number, outMax = 1.0, outMin = 0.0,
): {
  b0: FixedCoeff
  b1: FixedCoeff
  b2: FixedCoeff
  a1: FixedCoeff
  a2: FixedCoeff
  outMax: FixedCoeff
  outMin: FixedCoeff
} {
  return {
    b0: quantize(b0, Q27),
    b1: quantize(b1, Q27),
    b2: quantize(b2, Q27),
    a1: quantize(a1, Q27),
    a2: quantize(a2, Q27),
    outMax: quantize(outMax, Q27),
    outMin: quantize(outMin, Q27),
  }
}

/**
 * 2P2Z 归一化定点（B0 = 1.0 标准形式）：
 *   H(z) = B0 · (1 + B1·z⁻¹ + B2·z⁻²) / (1 + A1·z⁻¹ + A2·z⁻²)
 *   B1 = b1/b0, B2 = b2/b0, A1 = a1, A2 = a2，B0 = b0 外置为增益
 * 定点域：B1/B2/A1/A2 全 IQ27；B0 为增益（IQ20，与 fx_ctrl_iq27.h 增益类系数一致）
 */
export function compute2P2ZNormalizedFixed(
  b0: number, b1: number, b2: number, a1: number, a2: number,
  outMax = 1.0, outMin = 0.0,
): {
  B0: FixedCoeff
  B1: FixedCoeff
  B2: FixedCoeff
  A1: FixedCoeff
  A2: FixedCoeff
  outMax: FixedCoeff
  outMin: FixedCoeff
} {
  if (Math.abs(b0) < 1e-12) throw new Error('2P2Z 归一化要求 b0 ≠ 0（增益外置前 b0 不可为零）')
  return {
    B0: quantize(b0, Q20),
    B1: quantize(b1 / b0, Q27),
    B2: quantize(b2 / b0, Q27),
    A1: quantize(a1, Q27),
    A2: quantize(a2, Q27),
    outMax: quantize(outMax, Q27),
    outMin: quantize(outMin, Q27),
  }
}

/** 自包含 int32 定点代码：2P2Z 归一化（B0 外置增益）DF-IIt */
export function renderFixed2P2ZNormalizedC99(
  fx: ReturnType<typeof compute2P2ZNormalizedFixed>, prefix = 'vloop',
): string {
  const cint = (v: number): string => String(v)
  const lines = [
    '/* ============================================================',
    ' * 32 位定点 2P2Z —— 归一化形式（B0 外置增益，DF-IIt 转置直接 II 型）',
    ' *   H(z) = B0·(1 + B1·z⁻¹ + B2·z⁻²) / (1 + A1·z⁻¹ + A2·z⁻²)',
    ' *   B1/B2/A1/A2 全 IQ27；B0 增益 IQ20（约定对齐 fx_ctrl_iq27.h）',
    ' * 状态 = 输出量纲部分和，|s1| ≤ |B1+B2| + |A1+A2|（B 归一化后恒 ≤ 4）',
    ' * ============================================================ */',
    '#include <stdint.h>',
    '',
    `/* 归一化系数（全 IQ27） */
#define ${prefix.toUpperCase()}_B1_IQ27 ${cint(fx.B1.int)}   /* ${fx.B1.float.toPrecision(10)} */
#define ${prefix.toUpperCase()}_B2_IQ27 ${cint(fx.B2.int)}   /* ${fx.B2.float.toPrecision(10)} */
#define ${prefix.toUpperCase()}_A1_IQ27 ${cint(fx.A1.int)}   /* ${fx.A1.float.toPrecision(10)} */
#define ${prefix.toUpperCase()}_A2_IQ27 ${cint(fx.A2.int)}   /* ${fx.A2.float.toPrecision(10)} */
/* 外置增益 B0（IQ20） */
#define ${prefix.toUpperCase()}_B0_IQ20 ${cint(fx.B0.int)}   /* ${fx.B0.float.toPrecision(10)} × 2^20 */
#define ${prefix.toUpperCase()}_OUT_MAX (${cint(fx.outMax.int)})
#define ${prefix.toUpperCase()}_OUT_MIN (${cint(fx.outMin.int)})
static int32_t ${prefix}_s1 = 0, ${prefix}_s2 = 0;   /* IQ27 状态 */
static inline int32_t ${prefix}_run(int32_t x)
{
    int32_t y_inner, y_out;
    /* 内部 2P2Z（B0=1）：y_inner = x + s1 */
    y_inner = ${prefix}_s1 + x;
    if(y_inner > ${prefix.toUpperCase()}_OUT_MAX) { y_inner = ${prefix.toUpperCase()}_OUT_MAX; }
    if(y_inner < ${prefix.toUpperCase()}_OUT_MIN) { y_inner = ${prefix.toUpperCase()}_OUT_MIN; }
    ${prefix}_s1 = (int32_t)(((int64_t)${prefix.toUpperCase()}_B1_IQ27 * x) >> ${Q27})
                 - (int32_t)(((int64_t)${prefix.toUpperCase()}_A1_IQ27 * y_inner) >> ${Q27}) + ${prefix}_s2;
    ${prefix}_s2 = (int32_t)(((int64_t)${prefix.toUpperCase()}_B2_IQ27 * x) >> ${Q27})
                 - (int32_t)(((int64_t)${prefix.toUpperCase()}_A2_IQ27 * y_inner) >> ${Q27});
    /* 外置增益：y_out = B0·y_inner（IQ20 增益 × IQ27 数据 → IQ27） */
    y_out = (int32_t)(((int64_t)${prefix.toUpperCase()}_B0_IQ20 * y_inner) >> ${Q20});
    if(y_out > ${prefix.toUpperCase()}_OUT_MAX) { y_out = ${prefix.toUpperCase()}_OUT_MAX; }
    if(y_out < ${prefix.toUpperCase()}_OUT_MIN) { y_out = ${prefix.toUpperCase()}_OUT_MIN; }
    return y_out;
}`,
    '',
  ]
  return lines.join('\n')
}

/** 控制器配置 → 定点参数全集（含 fail-fast 检查与溢出核算） */
export function computeFixedPoint(config: ControllerConfig): FixedPointResult {
  const kind = config.kind
  const outMax = config.outputMax
  const outMin = config.outputMin
  const tsS = config.sampleTimeS
  const checks: string[] = []
  const budget: FixedPointResult['budget'] = []

  if (config.kind === 'pi') {
    const pi = computePiFixed(config.kp, config.tiS, tsS, outMax, outMin)
    // 核算（§10.5）：e_max = 2 → kp×e_max ≤ 16、ki2p×2e_max ≤ 16
    const kpBudget = Math.abs(pi.kp.float) * 2
    const kiBudget = Math.abs(pi.ki2p.float) * 4
    budget.push({ item: 'kp×e_max', upper: kpBudget, limit: 16, ok: kpBudget <= 16 })
    budget.push({ item: 'ki2p×2e_max', upper: kiBudget, limit: 16, ok: kiBudget <= 16 })
    if (kpBudget > 16) checks.push(`FAIL-FAST: kp×e_max = ${kpBudget.toFixed(3)} > 16（IQ27 结果域），需降低增益或放大输出满量程`)
    if (kiBudget > 16) checks.push(`FAIL-FAST: ki2p×2e_max = ${kiBudget.toFixed(3)} > 16，需降低 ki2p`)
    if (pi.ki2p.int === 0 && pi.ki2p.float > 0) {
      checks.push(`警告: ki2p 量化到 0 LSB（IQ20 下 ${pi.ki2p.float.toExponential(2)} < 2⁻²⁰），积分器将卡死`)
    }
    return { kind, tsS, kp: pi.kp, ki2p: pi.ki2p, outMax: pi.outMax, outMin: pi.outMin, checks, budget }
  }

  if (config.kind === 'pif') {
    const pif = computePifFixed(config.kp, config.tiS, config.lpfCutoffHz, tsS, outMax, outMin)
    const kpBudget = Math.abs(pif.pi.kp.float) * 2
    const kiBudget = Math.abs(pif.pi.ki2p.float) * 4
    budget.push({ item: 'kp×e_max', upper: kpBudget, limit: 16, ok: kpBudget <= 16 })
    budget.push({ item: 'ki2p×2e_max', upper: kiBudget, limit: 16, ok: kiBudget <= 16 })
    if (pif.alpha.int < 2) checks.push(`FAIL-FAST: alpha 量化后 < 2 LSB（IQ24），LPF 卡死；fc 过低`)
    if (kpBudget > 16) checks.push(`FAIL-FAST: kp×e_max = ${kpBudget.toFixed(3)} > 16`)
    if (kiBudget > 16) checks.push(`FAIL-FAST: ki2p×2e_max = ${kiBudget.toFixed(3)} > 16`)
    return {
      kind, tsS,
      kp: pif.pi.kp, ki2p: pif.pi.ki2p, alpha: pif.alpha,
      outMax: pif.pi.outMax, outMin: pif.pi.outMin, checks, budget,
    }
  }

  // 2p2z
  const c = compute2P2ZFixed(config.b0, config.b1, config.b2, config.a1, config.a2, outMax, outMin)
  // 状态核算（§14.2）：|s1| ≤ |B1+B2| + |A1+A2| ≤ 16
  const s1Upper = Math.abs(c.b1.float + c.b2.float) + Math.abs(c.a1.float + c.a2.float)
  budget.push({ item: '|s1| = |B1+B2|+|A1+A2|', upper: s1Upper, limit: 16, ok: s1Upper <= 16 })
  if (s1Upper > 16) checks.push(`FAIL-FAST: |B1+B2|+|A1+A2| = ${s1Upper.toFixed(3)} > 16，状态可能溢出`)
  // 极点余量（§14.5）：A2 距 1、A1 距 -2 ≥ 100 LSB
  const dA2 = (1 - c.a2.float) * SCALE27
  const dA1 = (c.a1.float + 2) * SCALE27
  budget.push({ item: 'A2 距 1 余量(LSB)', upper: dA2, limit: 100, ok: dA2 >= 100 })
  budget.push({ item: 'A1 距 -2 余量(LSB)', upper: dA1, limit: 100, ok: dA1 >= 100 })
  if (dA2 < 100) checks.push(`FAIL-FAST: A2 距 1 仅 ${dA2.toFixed(0)} LSB < 100，极点可能被量化到单位圆上`)
  if (dA1 < 100) checks.push(`FAIL-FAST: A1 距 -2 仅 ${dA1.toFixed(0)} LSB < 100`)
  // 系数范围
  for (const [name, coeff] of Object.entries({ b0: c.b0, b1: c.b1, b2: c.b2, a1: c.a1, a2: c.a2 })) {
    if (Math.abs(coeff.float) > 8) checks.push(`FAIL-FAST: ${name} = ${coeff.float.toFixed(3)} 超 IQ27 ±16 安全域（B>8 时建议该环单独降 Q）`)
  }
  return {
    kind, tsS,
    b0: c.b0, b1: c.b1, b2: c.b2, a1: c.a1, a2: c.a2,
    outMax: c.outMax, outMin: c.outMin, checks, budget,
  }
}

/** 自包含 int32 定点代码（无库依赖，宏/结构对齐 fx_ctrl_iq27.h 约定） */
export function renderFixedC99(fx: FixedPointResult, prefix = 'vloop'): string {
  const lines: string[] = [
    '/* ============================================================',
    ' * 32 位定点 LLC 电压环控制器 —— 自包含 int32 实现',
    ` * 数据域 IQ27（±16，2⁻²⁷）；系数域：增益 IQ20 / alpha IQ24 / 极点 IQ27`,
    ' * 约定对齐 DSP_CTRL_CODE 定点库（fx_ctrl_iq27.h）：',
    ' *   PI   = 输出量纲积分器 + 方向性 anti-windup（§10.3）',
    ' *   PIF  = PI + 增量型 LPF（凸组合免 clamp，§11.3）',
    ' *   2P2Z = DF-IIt 转置直接 II 型（§14.3）',
    ' * ============================================================ */',
    '#include <stdint.h>',
    '',
  ]

  const cint = (v: number): string => String(v)
  const outMax = cint(fx.outMax.int)
  const outMin = cint(fx.outMin.int)

  if (fx.kind === 'pi' || fx.kind === 'pif') {
    const kp = fx.kp!
    const ki2p = fx.ki2p!
    lines.push(
      `/* ${fx.kind.toUpperCase()} 系数（IQ20 整数） */`,
      `#define ${prefix.toUpperCase()}_KP_IQ20   ${cint(kp.int)}      /* ${kp.float.toPrecision(6)} × 2^20 */`,
      `#define ${prefix.toUpperCase()}_KI2P_IQ20 ${cint(ki2p.int)}      /* ${ki2p.float.toPrecision(6)} × 2^20（kp·ts/(2Ti)） */`,
      `#define ${prefix.toUpperCase()}_OUT_MAX   (${outMax})   /* ${fx.outMax.float} × 2^27 */`,
      `#define ${prefix.toUpperCase()}_OUT_MIN   (${outMin})   /* ${fx.outMin.float} × 2^27 */`,
      '',
      `static int32_t ${prefix}_ui = 0;           /* IQ27 输出量纲积分器 */`,
      `static int32_t ${prefix}_error_prev = 0;   /* IQ27 */`,
      '',
      `/* 误差输入 error_iq27（IQ27，归一化）；输出 out_iq27 ∈ [out_min, out_max] */
static inline int32_t ${prefix}_run(int32_t error_iq27)
{
    int32_t ui_new, out_raw, out_sat;
    int32_t e_sum = error_iq27 + ${prefix}_error_prev;   /* IQ27，|e_sum| ≤ 4 */

    /* _IQ20mpy：系数 IQ20 × 数据 IQ27 → 结果 IQ27（int64 中间量） */
    ui_new = ${prefix}_ui + (int32_t)(((int64_t)${prefix.toUpperCase()}_KI2P_IQ20 * e_sum) >> ${Q20});

    if(ui_new > ${prefix.toUpperCase()}_OUT_MAX) { ui_new = ${prefix.toUpperCase()}_OUT_MAX; }
    if(ui_new < ${prefix.toUpperCase()}_OUT_MIN) { ui_new = ${prefix.toUpperCase()}_OUT_MIN; }

    out_raw = (int32_t)(((int64_t)${prefix.toUpperCase()}_KP_IQ20 * error_iq27) >> ${Q20}) + ${prefix}_ui;
    out_sat = out_raw;
    if(out_sat > ${prefix.toUpperCase()}_OUT_MAX) { out_sat = ${prefix.toUpperCase()}_OUT_MAX; }
    if(out_sat < ${prefix.toUpperCase()}_OUT_MIN) { out_sat = ${prefix.toUpperCase()}_OUT_MIN; }

    /* 方向性条件积分（§10.7 符号约定：error 与输出同号驱动） */
    if(!((out_raw > ${prefix.toUpperCase()}_OUT_MAX && error_iq27 > 0) ||
         (out_raw < ${prefix.toUpperCase()}_OUT_MIN && error_iq27 < 0)))
    {
        ${prefix}_ui = ui_new;
    }

    ${prefix}_error_prev = error_iq27;
    return out_sat;
}`,)
  }

  if (fx.kind === 'pif') {
    const alpha = fx.alpha!
    lines.push(
      '',
      `/* PIF 增量型 LPF（alpha IQ24） */
#define ${prefix.toUpperCase()}_ALPHA_IQ24 ${cint(alpha.int)}   /* ${alpha.float.toPrecision(6)} × 2^24 */
static int32_t ${prefix}_y_prev = 0;        /* IQ27 */
static inline int32_t ${prefix}_pif_run(int32_t error_iq27)
{
    int32_t x, diff, y;
    x = ${prefix}_run(error_iq27);                     /* PI 饱和输出 IQ27 */
    diff = x - ${prefix}_y_prev;                       /* IQ27 */
    y = ${prefix}_y_prev + (int32_t)(((int64_t)${prefix.toUpperCase()}_ALPHA_IQ24 * diff) >> ${Q24});  /* 凸组合，免 clamp */
    ${prefix}_y_prev = y;
    return y;
}`,)
  }

  if (fx.kind === '2p2z') {
    const b0 = fx.b0!
    const b1 = fx.b1!
    const b2 = fx.b2!
    const a1 = fx.a1!
    const a2 = fx.a2!
    lines.push(
      `/* 2P2Z 系数（全 IQ27） */
#define ${prefix.toUpperCase()}_B0_IQ27 ${cint(b0.int)}   /* ${b0.float.toPrecision(6)} */
#define ${prefix.toUpperCase()}_B1_IQ27 ${cint(b1.int)}   /* ${b1.float.toPrecision(6)} */
#define ${prefix.toUpperCase()}_B2_IQ27 ${cint(b2.int)}   /* ${b2.float.toPrecision(6)} */
#define ${prefix.toUpperCase()}_A1_IQ27 ${cint(a1.int)}   /* ${a1.float.toPrecision(6)} */
#define ${prefix.toUpperCase()}_A2_IQ27 ${cint(a2.int)}   /* ${a2.float.toPrecision(6)} */
#define ${prefix.toUpperCase()}_OUT_MAX  (${outMax})
#define ${prefix.toUpperCase()}_OUT_MIN  (${outMin})
static int32_t ${prefix}_s1 = 0, ${prefix}_s2 = 0;  /* IQ27 状态：|s1| ≤ 4 */
static inline int32_t ${prefix}_run(int32_t x)
{
    int32_t y_raw;
    y_raw = (int32_t)(((int64_t)${prefix.toUpperCase()}_B0_IQ27 * x) >> ${Q27}) + ${prefix}_s1;
    if(y_raw > ${prefix.toUpperCase()}_OUT_MAX) { y_raw = ${prefix.toUpperCase()}_OUT_MAX; }
    if(y_raw < ${prefix.toUpperCase()}_OUT_MIN) { y_raw = ${prefix.toUpperCase()}_OUT_MIN; }
    ${prefix}_s1 = (int32_t)(((int64_t)${prefix.toUpperCase()}_B1_IQ27 * x) >> ${Q27})
                 - (int32_t)(((int64_t)${prefix.toUpperCase()}_A1_IQ27 * y_raw) >> ${Q27}) + ${prefix}_s2;
    ${prefix}_s2 = (int32_t)(((int64_t)${prefix.toUpperCase()}_B2_IQ27 * x) >> ${Q27})
                 - (int32_t)(((int64_t)${prefix.toUpperCase()}_A2_IQ27 * y_raw) >> ${Q27});
    return y_raw;   /* 限幅 y 反馈 = 天然 anti-windup */
}`,)
  }

  lines.push('')
  return lines.join('\n')
}

/** 对接用户定点库（fx_ctrl_iq27.h）的初始化代码片段 */
export function renderFixedLibInitC99(fx: FixedPointResult, prefix = 'vloop'): string {
  const header = '#include "fx_ctrl_iq27.h"'
  if (fx.kind === 'pi') {
    return [
      header,
      `/* ${fx.kind.toUpperCase()} —— 直接调用定点库（结构/函数与 fx_ctrl_iq27.h 一致） */`,
      `static PI_IQ27_T ${prefix};`,
      '',
      `pi_iq27_init(&${prefix}, ${fx.kp!.float.toPrecision(9)}f, ${(fx.tsS / fx.ki2p!.float * fx.kp!.float * 0.5).toPrecision(9)}f, ${fx.tsS.toPrecision(4)}f, ${fx.outMax.float}f, ${fx.outMin.float}f);`,
      `/* 启动期 fail-fast：if(pi_iq27_check(&${prefix}, _IQ(2.0f)) != 0) { /* 拒绝启动 */ } */`,
      `/* ISR 内：out = pi_iq27_run(error_iq27, &${prefix}); */`,
    ].join('\n')
  }
  if (fx.kind === 'pif') {
    return [
      header,
      `/* PIF —— PI 嵌套 + 增量型 LPF */`,
      `static PIF_IQ27_T ${prefix};`,
      '',
      `pif_iq27_init(&${prefix}, ${fx.kp!.float.toPrecision(9)}f, ${(fx.tsS / fx.ki2p!.float * fx.kp!.float * 0.5).toPrecision(9)}f, ${alphaOf(fx).toPrecision(9)}f, ${fx.tsS.toPrecision(4)}f, ${fx.outMax.float}f, ${fx.outMin.float}f);`,
      `/* ISR 内：out = pif_iq27_run(error_iq27, &${prefix}); */`,
    ].join('\n')
  }
  return [
    header,
    `/* 2P2Z —— DF-IIt 全 IQ27 */`,
    `static P2P2Z_IQ27_T ${prefix};`,
    '',
    `p2p2z_init(&${prefix}, ${fx.b0!.float.toPrecision(9)}f, ${fx.b1!.float.toPrecision(9)}f, ${fx.b2!.float.toPrecision(9)}f, ${fx.a1!.float.toPrecision(9)}f, ${fx.a2!.float.toPrecision(9)}f, ${fx.outMax.float}f, ${fx.outMin.float}f);`,
    `/* 启动期 fail-fast：if(p2p2z_check(&${prefix}) != 0) { /* 拒绝启动 */ } */`,
    `/* ISR 内：out = p2p2z_iq27_run(error_iq27, &${prefix}); */`,
  ].join('\n')
}

function alphaOf(fx: FixedPointResult): number {
  return fx.alpha ? fx.alpha.float : 0
}

/** 输出定点参数表（纯数据，供序列化） */
export function fixedPointTable(fx: FixedPointResult): Record<string, { float: number; q: number; int: number }> {
  const table: Record<string, { float: number; q: number; int: number }> = {
    outMax: { float: fx.outMax.float, q: fx.outMax.q, int: fx.outMax.int },
    outMin: { float: fx.outMin.float, q: fx.outMin.q, int: fx.outMin.int },
  }
  for (const key of ['kp', 'ki2p', 'alpha', 'b0', 'b1', 'b2', 'a1', 'a2'] as const) {
    const c = fx[key]
    if (c) table[key] = { float: c.float, q: c.q, int: c.int }
  }
  return table
}

export { controllerTransferFunction }
export { SCALE27, SCALE24, SCALE20 }
