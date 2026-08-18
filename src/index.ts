/**
 * LLC 设计插件 —— 入口
 *
 * 注册两个模型工具：
 *   - `llc_design`：变压器/谐振参数设计（Power Design Toolkit V7.5 算法）
 *   - `llc_tune_loop`：数字电压环一键自动整定（目标带宽/相位裕度 → 控制器参数 + C99）
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import { designLlc, type LlcDesignOutput, type LlcDesignRequest } from './engine/index.ts'
import { runLoopTune, type LoopTuneOutput, type LoopTuneRequest } from './engine/loopEngine.ts'
import { analyzeController, type AnalyzeControllerRequest, type ControllerAnalysisOutput } from './engine/analyzeController.ts'

export const name = 'llc-design-plugin'

export const inject = ['tools']

export function apply(ctx: Context) {
  registerDesignTool(ctx)
  registerTuneLoopTool(ctx)
  registerAnalyzeControllerTool(ctx)
}

function registerDesignTool(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'llc_design',
    description:
      '按专有 LLC 谐振变换器设计算法（Power Design Toolkit V7.5）完成变压器和谐振参数设计。' +
      '输入：输出电压(V)、输出功率(W)、谐振频率(kHz)、可选母线电压范围/拓扑(K、Q、磁芯预设)。' +
      '输出：整数匝数对(Np:Ns)、Lr/Lm/Cr、气隙、Litz 线规、窗口填充、磁芯/铜损与工作点表。' +
      '单位：电压 V、功率 W、频率 kHz。典型：vout=53, pout=3000, frKhz=100, vinNom=400。' +
      '建议尽量提供：母线电压范围(vinNom/vinMinNormal/vinMax/vinHoldEnd)、k、q、corePreset；' +
      '未提供的参数会使用默认值并在结果中明确标注，请确认后再采用。',

    parameters: {
      // 必填
      vout: { type: 'number', required: true, description: '输出电压 Vout（V）' },
      pout: { type: 'number', required: true, description: '输出功率 Pout（W）' },
      frKhz: { type: 'number', required: true, description: '谐振频率 fr（kHz）' },
      // 可选：母线
      vinNom: { type: 'number', description: '标称母线电压 Vin_nom（V），默认 400' },
      vinMinNormal: { type: 'number', description: '正常最小母线电压（V），默认 360' },
      vinMax: { type: 'number', description: '最大母线电压（V），默认 420' },
      vinHoldEnd: { type: 'number', description: '掉电保持末端电压（V），默认 300' },
      // 可选：拓扑与谐振腔
      topology: {
        type: 'string', enum: ['half-bridge', 'full-bridge'],
        description: '原边拓扑，默认 full-bridge',
      },
      k: { type: 'number', description: '电感比 K=Lm/Lr，默认 5' },
      q: { type: 'number', description: '满载品质因数 Q，默认 0.35' },
      rectifierDropV: { type: 'number', description: '整流等效压降（V），默认 0.40' },
      // 可选：频率范围
      fminKhz: { type: 'number', description: '最低开关频率（kHz），默认 fr*0.6' },
      fmaxKhz: { type: 'number', description: '最高开关频率（kHz），默认 fr*1.8' },
      // 可选：磁芯与搜索
      corePreset: {
        type: 'string',
        enum: ['TDK_PQ35_35_B65881A_N87', 'TDK_PQ35_35_B65881A_N97'],
        description: '磁芯数据表预设，默认 TDK_PQ35_35_B65881A_N87',
      },
      maxSecondaryTurns: { type: 'number', description: '副边匝数搜索上限，默认 40' },
      maxFluxDensityT: { type: 'number', description: '最大磁通密度限制（T），默认 0.18' },
      workpointScope: {
        type: 'string', enum: ['all', 'normal', 'nominal'],
        description: '工作点范围：all(含掉电保持) / normal / nominal(仅标称)，默认 all',
      },
      // 可选：温度
      ambientTempC: { type: 'number', description: '环境温度（℃），默认 45' },
      windingTempC: { type: 'number', description: '绕组温度（℃），默认 100' },
    },

    output: {
      // 无约束 lossless JSON 节点：由 execute 保证结构，render 负责展示。
      schema: { type: 'json' },
      render: (_args, value) => [
        { type: 'text', text: formatResult(value as unknown as LlcDesignOutput) },
      ],
    },

    async execute(args: LlcDesignRequest) {
      return designLlc(args) as unknown as JsonValue
    },
  }))
}

function fmt(v: number, digits = 3): string {
  return Number.isFinite(v) ? v.toFixed(digits) : 'n/a'
}

function formatResult(r: LlcDesignOutput): string {
  const lines: string[] = [
    'LLC 变压器设计结果（Power Design Toolkit 算法）',
    '='.repeat(64),
    `磁芯：${r.core.shape} ${r.core.materialGrade}（${r.core.partNumber}，Ae=${r.core.aeMm2} mm²）`,
    `匝数：Np:Ns = ${r.turns.primary}:${r.turns.secondary}（实际匝比 ${fmt(r.turns.ratio, 4)}，目标 ${fmt(r.turns.targetRatio, 4)}，误差 ${fmt(r.turns.ratioErrorPct)}%）`,
    `谐振腔：Lr = ${fmt(r.tank.lrUh)} µH，Lm = ${fmt(r.tank.lmUh)} µH，Cr = ${fmt(r.tank.crNf)} nF，fr = ${fmt(r.tank.frKhz)} kHz`,
    `气隙：目标 AL = ${fmt(r.gap.targetAlNh)} nH，估算总气隙 = ${fmt(r.gap.estimatedGapMm)} mm（无气隙 Lm = ${fmt(r.gap.ungappedLmUh)} µH）`,
    `原边 Litz：${r.litz.primary.description}，J = ${fmt(r.litz.primary.currentDensityAPerMm2)} A/mm²`,
    `副边 Litz：${r.litz.secondary.description}，J = ${fmt(r.litz.secondary.currentDensityAPerMm2)} A/mm²`,
    `窗口填充 = ${fmt(r.winding.fillFactor * 100)}%，径向堆叠 = ${fmt(r.winding.radialBuildMm)} mm`,
    `Rdc：原边 ${fmt(r.winding.primaryRdcMohm)} mΩ，副边 ${fmt(r.winding.secondaryRdcMohm)} mΩ`,
    `最恶劣 Bpk = ${fmt(r.worstBPeakT * 1e3)} mT`,
    `增益需求：Mmin = ${fmt(r.gainCheck.mMin)}，Mmax = ${fmt(r.gainCheck.mMax)}（掉电保持 ${fmt(r.gainCheck.mMaxHoldEnd)}）；满载可用增益 ${fmt(r.gainCheck.availableGainMin)}..${fmt(r.gainCheck.availableGainMax)}`,
    `ZVS：${r.zvs.allInductive ? '全部工作点处于感性区' : '⚠ 存在非感性工作点'}；最低换流电流 ${fmt(r.zvs.minCommutationCurrentA)} A @ ${r.zvs.minCommutationAtVbusV.toFixed(0)}V/${(r.zvs.minCommutationAtLoad * 100).toFixed(0)}%`,
    `标称损耗：磁芯 ${fmt(r.loss.coreW)} W + 原边铜损 ${fmt(r.loss.primaryCopperW)} W + 副边铜损 ${fmt(r.loss.secondaryCopperW)} W = ${fmt(r.loss.totalW)} W（热点 ${fmt(r.loss.estimatedHotspotC)} ℃）`,
    `可行性：${r.feasible ? '可行' : '不可行'}`,
  ]
  appendAssumptions(lines, r.assumptions)

  if (r.workpoints.length > 0) {
    lines.push('', '工作点：')
    lines.push('  Vbus(V) 负载(%)  fsw(kHz)  Bpk(mT)  Ip(A)  Is(A)  相位(°) 换流(A) 总损耗(W)')
    for (const wp of r.workpoints) {
      lines.push(
        `  ${wp.vbusV.toFixed(0).padStart(6)} ${(wp.loadFraction * 100).toFixed(0).padStart(6)} ${wp.fswKhz.toFixed(0).padStart(8)} ${(wp.bPeakT * 1e3).toFixed(1).padStart(7)} ${wp.primaryRmsA.toFixed(1).padStart(6)} ${wp.secondaryRmsA.toFixed(1).padStart(6)} ${wp.inputPhaseDeg.toFixed(1).padStart(8)} ${wp.commutationCurrentA.toFixed(2).padStart(7)} ${wp.totalLossW.toFixed(2).padStart(9)}`,
      )
    }
  }

  if (r.reasons.length > 0) {
    lines.push('', '不满足约束的原因：')
    for (const reason of r.reasons) lines.push(`  - ${reason}`)
  }
  if (r.warnings.length > 0) {
    lines.push('', '警告：')
    for (const w of r.warnings) lines.push(`  - ${w}`)
  }
  return lines.join('\n')
}

function registerTuneLoopTool(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'llc_tune_loop',
    description:
      'LLC 数字电压环一键自动整定（Power Design Toolkit 算法）。' +
      '输入电源规格 + 目标穿越频率/相位裕度，自动设计 PI/PIF/2P2Z 控制器参数，' +
      '返回控制器系数、差异方程、FM 工作点、稳定裕度与可直接烧录的 C99 代码。' +
      '单位：电压 V、功率 W、频率 kHz。典型：vout=24, pout=500, frKhz=120, crossoverKhz=2, phaseMarginDeg=50。' +
      '建议尽量提供：母线电压范围、k、q、目标穿越频率(crossoverKhz)与相位裕度(phaseMarginDeg)、采样周期(sampleTimeUs)；' +
      '未提供的参数会使用默认值并在结果中明确标注，请确认后再采用。',

    parameters: {
      vout: { type: 'number', required: true, description: '输出电压 Vout（V）' },
      pout: { type: 'number', required: true, description: '输出功率 Pout（W）' },
      frKhz: { type: 'number', required: true, description: '谐振频率 fr（kHz）' },
      crossoverKhz: { type: 'number', description: '目标穿越频率（kHz），默认 fsw/20' },
      phaseMarginDeg: { type: 'number', description: '目标相位裕度（°），默认 50' },
      controllerKind: {
        type: 'string', enum: ['pi', 'pif', '2p2z'],
        description: '控制器类型，默认 pi',
      },
      vinNom: { type: 'number', description: '标称母线电压（V），默认 400' },
      vinMinNormal: { type: 'number', description: '正常最小母线电压（V）' },
      vinMax: { type: 'number', description: '最大母线电压（V）' },
      vinHoldEnd: { type: 'number', description: '掉电保持末端电压（V）' },
      topology: {
        type: 'string', enum: ['half-bridge', 'full-bridge'],
        description: '原边拓扑，默认 full-bridge',
      },
      k: { type: 'number', description: '电感比 K=Lm/Lr，默认 5' },
      q: { type: 'number', description: '满载品质因数 Q，默认 0.35' },
      sampleTimeUs: { type: 'number', description: '控制采样周期（µs），默认 20' },
    },

    output: {
      schema: { type: 'json' },
      render: (_args, value) => [
        { type: 'text', text: formatTuneResult(value as unknown as LoopTuneOutput) },
      ],
    },

    async execute(args: LoopTuneRequest) {
      return runLoopTune(args) as unknown as JsonValue
    },
  }))
}

function formatTuneResult(r: LoopTuneOutput): string {
  const lines: string[] = [
    'LLC 电压环自动整定结果（Power Design Toolkit 算法）',
    '='.repeat(64),
    `控制器：${r.controllerKind.toUpperCase()}（${r.converged ? '已收敛' : '未完全收敛'}）`,
    `工作点：fsw = ${r.operatingPoint.fswKhz.toFixed(1)} kHz，FM command = ${r.operatingPoint.fmCommandPu.toFixed(4)}，FM 增益 = ${r.operatingPoint.fmGainHzPerPu.toExponential(3)} Hz/pu`,
    `稳定裕度：穿越 ${r.margins.crossoverHz.toFixed(1)} Hz，相位裕度 ${r.margins.phaseMarginDeg.toFixed(1)}°，增益裕度 ${r.margins.gainMarginDb.toFixed(1)} dB`,
    `离散闭环稳定：${r.discreteStable ? '是' : '否'}（迭代 ${r.iterations} 次）`,
  ]
  lines.push('', r.bodeAscii)
  if (r.notes.length > 0) {
    lines.push('', '说明：')
    for (const n of r.notes) lines.push(`  - ${n}`)
  }
  if (r.warnings.length > 0) {
    lines.push('', '警告：')
    for (const w of r.warnings) lines.push(`  - ${w}`)
  }
  // 系数格式：2P2Z 输出 Numerator/Denominator/GAIN（归一化 B0 外置，完整 double 精度）
  if (r.controllerKind === '2p2z' && r.normalized2P2Z) {
    const n = r.normalized2P2Z.float
    lines.push('', '系数（归一化，float64 完整精度）：')
    lines.push(`  Numerator:   1、${n.B1.toPrecision(17)}、${n.B2.toPrecision(17)}`)
    lines.push(`  Denominator: 1、${n.A1.toPrecision(17)}、${n.A2.toPrecision(17)}`)
    lines.push(`  GAIN:        ${n.B0.toPrecision(17)}`)
    lines.push('', '等效 z 域传函：')
    lines.push(`  num = [${r.controller.numeratorZ.map(v => v.toPrecision(17)).join(', ')}]`)
    lines.push(`  den = [${r.controller.denominatorZ.map(v => v.toPrecision(17)).join(', ')}]`)
    lines.push(`  差分方程：${r.controller.differenceEquation}`)
  } else {
    lines.push('', `系数：${JSON.stringify(r.controller.coefficients, (k, v) => typeof v === 'number' ? Number(v.toPrecision(17)) : v)}`)
    lines.push(`z 域传函：num = [${r.controller.numeratorZ.map(v => v.toPrecision(17)).join(', ')}]`)
    lines.push(`         den = [${r.controller.denominatorZ.map(v => v.toPrecision(17)).join(', ')}]`)
    lines.push(`差分方程：${r.controller.differenceEquation}`)
  }
  appendAssumptions(lines, r.assumptions)
  lines.push('', '═══ 32 位定点（IQ27 数据域 / IQ20·IQ24·IQ27 系数域）═══')
  lines.push('定点整数参数（可直接烧录）：')
  for (const [name, c] of Object.entries(r.fixed.coefficients)) {
    lines.push(`  ${name.padEnd(8)} = ${c.int}（Q${c.q}，浮点 ${c.float.toFixed(10)}）`)
  }
  if (r.normalized2P2Z) {
    lines.push('', '▶ 归一化 2P2Z（B0 = 1.0 标准形式，DF-IIt）：')
    lines.push('  H(z) = B0·(1 + B1·z⁻¹ + B2·z⁻²) / (1 + A1·z⁻¹ + A2·z⁻²)')
    lines.push('  浮点（10 位小数）：')
    const nf = r.normalized2P2Z.float
    lines.push(`    B0 = ${nf.B0.toFixed(10)}   B1 = ${nf.B1.toFixed(10)}   B2 = ${nf.B2.toFixed(10)}`)
    lines.push(`    A1 = ${nf.A1.toFixed(10)}   A2 = ${nf.A2.toFixed(10)}`)
    lines.push('  定点整数（B1/B2/A1/A2 全 IQ27，B0 增益 IQ20）：')
    for (const [name, c] of Object.entries(r.normalized2P2Z.fixed)) {
      lines.push(`    ${name.padEnd(3)} = ${String(c.int).padStart(12)}   Q${c.q}  （浮点 ${c.float.toFixed(10)}）`)
    }
  }
  if (r.fixed.checks.length > 0) {
    lines.push('', '定点 fail-fast 检查：')
    for (const c of r.fixed.checks) lines.push(`  - ${c}`)
  }
  const budgetFail = r.fixed.budget.filter(b => !b.ok)
  if (budgetFail.length > 0) {
    lines.push('', '溢出核算未通过项：')
    for (const b of budgetFail) lines.push(`  - ${b.item}: ${b.upper.toFixed(3)} > 上限 ${b.limit}`)
  }
  lines.push('', '自包含 int32 定点代码（零浮点运行时）：')
  lines.push('```c')
  lines.push(r.normalized2P2Z ? r.normalized2P2Z.c99 : r.fixed.c99)
  lines.push('```')
  lines.push('', '对接定点库 fx_ctrl_iq27.h 的初始化：')
  lines.push('```c')
  lines.push(r.fixed.libInitC99)
  lines.push('```')
  lines.push('', '浮点 C99 控制器代码（Direct Form I）：')
  lines.push('```c')
  lines.push(r.controller.c99)
  lines.push('```')
  return lines.join('\n')
}

/** 渲染交互式问答引导 + 参数假设说明（不脑补原则） */
function appendAssumptions(
  lines: string[],
  a: { questions: Array<{ param: string; prompt: string; options: string[]; default: string }>; assumed: Array<{ param: string; value: string; why: string }> },
): void {
  if (a.questions.length > 0) {
    lines.push('', '❓ 需要您确认/补充的参数 —— 请逐项回答（点选或填数字），回答后重新调用即可：')
    a.questions.forEach((q, i) => {
      lines.push(`  ${i + 1}. ${q.prompt}`)
      q.options.forEach((opt, j) => lines.push(`     ${String.fromCharCode(65 + j)}. ${opt}`))
      lines.push(`     （若不回答将使用默认：${q.default}）`)
    })
  }
  if (a.assumed.length > 0) {
    lines.push('', '⚠️ 以下参数本次使用默认值，请确认（对应上面的问题）：')
    for (const item of a.assumed) {
      lines.push(`  - ${item.param} = ${item.value}`)
    }
  }
}


function registerAnalyzeControllerTool(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'llc_analyze_controller',
    description:
      '分析自定义数字控制器（归一化 2P2Z，B0 外置增益）并输出完整设计报告：' +
      '零极点/稳定性/直流增益识别 + IQ27 定点整数参数 + 归一化 DF-IIt C99 代码 + ASCII Bode 图。' +
      '输入归一化系数：H(z) = B0·(1 + B1·z⁻¹ + B2·z⁻²)/(1 + A1·z⁻¹ + A2·z⁻²)。' +
      '典型：B0=0.00186, B1=2, B2=1, A1=-1.874, A2=0.882。',

    parameters: {
      B0: { type: 'number', required: true, description: '外置增益 B0（b0）' },
      B1: { type: 'number', required: true, description: '归一化分子系数 B1 = b1/b0' },
      B2: { type: 'number', required: true, description: '归一化分子系数 B2 = b2/b0' },
      A1: { type: 'number', required: true, description: '分母系数 A1' },
      A2: { type: 'number', required: true, description: '分母系数 A2' },
      sampleTimeUs: { type: 'number', description: '采样周期（µs），默认 20' },
      showBode: { type: 'boolean', description: '是否输出 Bode 图，默认 true' },
    },

    output: {
      schema: { type: 'json' },
      render: (_args, value) => [
        { type: 'text', text: formatAnalyzeResult(value as unknown as ControllerAnalysisOutput) },
      ],
    },

    async execute(args: AnalyzeControllerRequest) {
      return analyzeController(args) as unknown as JsonValue
    },
  }))
}

function formatAnalyzeResult(r: ControllerAnalysisOutput): string {
  const a = r.analysis
  const lines: string[] = [
    '控制器分析报告（归一化 2P2Z）',
    '='.repeat(64),
    `识别：${a.type}`,
    `传递函数：H(z) = B0·(1 + B1·z⁻¹ + B2·z⁻²)/(1 + A1·z⁻¹ + A2·z⁻²)`,
    `浮点（10 位小数）：`,
    `  B0 = ${r.float.B0.toFixed(10)}   B1 = ${r.float.B1.toFixed(10)}   B2 = ${r.float.B2.toFixed(10)}`,
    `  A1 = ${r.float.A1.toFixed(10)}   A2 = ${r.float.A2.toFixed(10)}`,
    '',
    '零极点与稳定性：',
    `  零点：${a.zeros.map(z => `(${z.re.toFixed(4)}${z.im >= 0 ? '+' : ''}${z.im.toFixed(4)}j)`).join(' ') || '（无）'}`,
    `  极点：${a.poles.map(p => `(${p.re.toFixed(4)}${p.im >= 0 ? '+' : ''}${p.im.toFixed(4)}j, |z|=${p.magnitude.toFixed(4)}, f=${p.freqHz.toFixed(1)}Hz)`).join(' ') || '（无）'}`,
    `  稳定：${a.stable ? '✅ 是' : '❌ 否'}   直流增益 H(1) = ${a.dcGain.toFixed(6)}   极点-单位圆余量 = ${a.poleMarginLsb.toExponential(2)} LSB`,
    '',
    'IQ27 定点整数参数（B1/B2/A1/A2 全 IQ27，B0 增益 IQ20）：',
  ]
  for (const [name, c] of Object.entries(r.fixed)) {
    lines.push(`  ${name.padEnd(3)} = ${String(c.int).padStart(12)}   Q${c.q}  （浮点 ${c.float.toFixed(10)}）`)
  }
  lines.push('', '溢出核算：')
  for (const b of r.budget) {
    lines.push(`  ${b.item}: ${b.upper.toExponential(4)} vs ${b.limit}  ${b.ok ? '✓' : '✗'}`)
  }
  if (r.bodeAscii) {
    lines.push('', r.bodeAscii)
  }
  lines.push('', '归一化 DF-IIt C99（可直接烧录）：')
  lines.push('```c')
  lines.push(r.c99)
  lines.push('```')
  return lines.join('\n')
}
