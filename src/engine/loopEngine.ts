/**
 * 环路整定引擎适配层：用户输入 → tuneVoltageLoop → 可序列化输出（含 C99 片段）
 */

import { buildSpec, resolveCorePreset, type LlcDesignRequest } from './index.ts'
import { tuneVoltageLoop, type TuningResult } from '../control/autotune.ts'
import { controllerTransferFunction, controllerKind } from '../control/digitalLoop.ts'
import {
  computeFixedPoint, fixedPointTable, renderFixedC99, renderFixedLibInitC99,
} from '../control/qformat.ts'
import { collectTuneAssumptions, type AssumptionReport } from './assumptions.ts'
import { cloneSpec } from '../core/spec.ts'
import {
  synthesizeTransformer, DEFAULT_SYNTHESIS_SETTINGS,
  type FerriteCoreInput,
} from '../magnetics/transformerDesigner.ts'
import type { FerriteCorePreset } from '../data/corePresets.ts'

/** 磁芯预设 → 变压器设计输入（与 engine/index.ts 的 designLlc 一致） */
function presetToFerriteInput(preset: FerriteCorePreset): FerriteCoreInput {
  return {
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
  }
}

export interface LoopTuneRequest {
  // 电气规格（与 llc_design 工具共用字段）
  vout: number
  pout: number
  frKhz: number
  vinNom?: number
  vinMinNormal?: number
  vinMax?: number
  vinHoldEnd?: number
  topology?: 'half-bridge' | 'full-bridge'
  k?: number
  q?: number
  // 整定目标
  crossoverKhz?: number
  phaseMarginDeg?: number
  controllerKind?: 'pi' | 'pif' | '2p2z'
  sampleTimeUs?: number
  loadFraction?: number
  // 匝数（可选；不指定则由匝数搜索自动确定，与 llc_design 一致）
  primaryTurns?: number
  secondaryTurns?: number
  corePreset?: string
  // 输出电容（环路小信号模型用）
  outputCapF?: number
  outputCapEsrMohm?: number
}

export interface LoopTuneOutput {
  feasible: boolean
  converged: boolean
  /** 参数假设报告 */
  assumptions: AssumptionReport
  controllerKind: string
  controller: {
    coefficients: Record<string, number>
    numeratorZ: number[]
    denominatorZ: number[]
    differenceEquation: string
    c99: string
  }
  /** 32 位定点输出（IQ27 数据域 / IQ20·IQ24·IQ27 系数域，对齐 DSP_CTRL_CODE 定点库） */
  fixed: {
    /** 定点整数参数表：{ 系数: { float, q, int } } */
    coefficients: Record<string, { float: number; q: number; int: number }>
    /** 自包含 int32 定点代码（无库依赖） */
    c99: string
    /** 对接 fx_ctrl_iq27.h 定点库的初始化代码 */
    libInitC99: string
    /** fail-fast 检查 */
    checks: string[]
    /** 溢出/余量核算表 */
    budget: Array<{ item: string; upper: number; limit: number; ok: boolean }>
  }
  operatingPoint: {
    fswKhz: number
    fmCommandPu: number
    fmGainHzPerPu: number
  }
  margins: {
    phaseMarginDeg: number
    crossoverHz: number
    gainMarginDb: number
    delayMarginS: number | null
  }
  discreteStable: boolean
  iterations: number
  notes: string[]
  warnings: string[]
}

/** 生成 Direct Form I C99 控制器代码（对应 export_controller_c99） */
export function renderControllerC99(
  numerator: number[], denominator: number[],
  functionName = 'llc_voltage_controller_run', outputMin = 0, outputMax = 1,
): string {
  const orderX = numerator.length - 1
  const orderY = denominator.length - 1
  const cFloat = (value: number): string => {
    const text = value.toPrecision(9)
    const t = text.includes('e') || text.includes('.') ? text : text + '.0'
    return t + 'f'
  }
  const lines = [
    '/* Auto-generated LLC digital controller. C99, Direct Form I. */',
    '#include <stddef.h>',
    '',
    `#define LLC_CTRL_NX (${orderX + 1}u)`,
    `#define LLC_CTRL_NY (${orderY}u)`,
    '',
    'typedef struct {',
    '    float x_hist[LLC_CTRL_NX];',
    '    float y_hist[(LLC_CTRL_NY > 0u) ? LLC_CTRL_NY : 1u];',
    '} llc_controller_state_t;',
    '',
    `static const float llc_ctrl_b[LLC_CTRL_NX] = {${numerator.map(cFloat).join(', ')}};`,
    `static const float llc_ctrl_a[(LLC_CTRL_NY > 0u) ? LLC_CTRL_NY : 1u] = ${
      orderY > 0 ? `{${denominator.slice(1).map(cFloat).join(', ')}}` : '{0.0f}'
    };`,
    '',
    `float ${functionName}(llc_controller_state_t *state, float error)`,
    '{',
    '    size_t i;',
    '    float output = 0.0f;',
    '',
    '    for(i = LLC_CTRL_NX - 1u; i > 0u; --i) {',
    '        state->x_hist[i] = state->x_hist[i - 1u];',
    '    }',
    '    state->x_hist[0] = error;',
    '    for(i = 0u; i < LLC_CTRL_NX; ++i) {',
    '        output += llc_ctrl_b[i] * state->x_hist[i];',
    '    }',
    '    for(i = 0u; i < LLC_CTRL_NY; ++i) {',
    '        output -= llc_ctrl_a[i] * state->y_hist[i];',
    '    }',
    `    if(output > ${cFloat(outputMax)}) output = ${cFloat(outputMax)};`,
    `    if(output < ${cFloat(outputMin)}) output = ${cFloat(outputMin)};`,
    '    if(LLC_CTRL_NY > 0u) {',
    '        for(i = LLC_CTRL_NY - 1u; i > 0u; --i) {',
    '            state->y_hist[i] = state->y_hist[i - 1u];',
    '        }',
    '        state->y_hist[0] = output;',
    '    }',
    '    return output;',
    '}',
    '',
  ]
  return lines.join('\n')
}

export function runLoopTune(request: LoopTuneRequest): LoopTuneOutput {
  const assumptions = collectTuneAssumptions(request)
  let spec = buildSpec({
    vout: request.vout,
    pout: request.pout,
    frKhz: request.frKhz,
    vinNom: request.vinNom,
    vinMinNormal: request.vinMinNormal,
    vinMax: request.vinMax,
    vinHoldEnd: request.vinHoldEnd,
    topology: request.topology,
    k: request.k,
    q: request.q,
    primaryTurns: request.primaryTurns,
    secondaryTurns: request.secondaryTurns,
    outputCapF: request.outputCapF,
    outputCapEsrMohm: request.outputCapEsrMohm,
  })

  // 匝数搜索：若未显式指定匝数，先按专有算法确定 Np:Ns（与 llc_design 一致），
  // 否则默认匝数对任意 Vout 可能增益失配（如 12V 输出需 n≈16）。
  // 注意：整定只需匝比正确；磁芯/窗口可行性由 llc_design 单独报告。
  if (request.primaryTurns === undefined || request.secondaryTurns === undefined) {
    const preset = resolveCorePreset(request.corePreset)
    const result = synthesizeTransformer(spec, presetToFerriteInput(preset), {
      ...DEFAULT_SYNTHESIS_SETTINGS,
      workpointScope: 'all',
    })
    spec = cloneSpec(spec, {
      primaryTurns: result.primaryTurns,
      secondaryTurns: result.secondaryTurns,
    })
  }
  const sampleTimeS = (request.sampleTimeUs ?? 20) * 1e-6
  const result: TuningResult = tuneVoltageLoop(spec, {
    crossoverHz: request.crossoverKhz !== undefined ? request.crossoverKhz * 1e3 : undefined,
    phaseMarginDeg: request.phaseMarginDeg,
    controllerKind: request.controllerKind,
  }, { sampleTimeS, loadFraction: request.loadFraction })

  const controller = controllerTransferFunction(result.controllerConfig)
  const kind = controllerKind(result.controllerConfig)
  const cfg = result.controllerConfig
  const coefficients: Record<string, number> = {}
  if (cfg.kind === 'pi') {
    coefficients.kp = cfg.kp
    coefficients.tiS = cfg.tiS
  } else if (cfg.kind === 'pif') {
    coefficients.kp = cfg.kp
    coefficients.tiS = cfg.tiS
    coefficients.lpfCutoffHz = cfg.lpfCutoffHz
  } else {
    coefficients.b0 = cfg.b0
    coefficients.b1 = cfg.b1
    coefficients.b2 = cfg.b2
    coefficients.a1 = cfg.a1
    coefficients.a2 = cfg.a2
  }

  const outMin = cfg.outputMin
  const outMax = cfg.outputMax

  // 32 位定点：系数 + 自包含代码 + 库对接代码 + fail-fast
  const fx = computeFixedPoint(result.controllerConfig)

  return {
    feasible: result.converged,
    assumptions,
    converged: result.converged,
    controllerKind: kind,
    controller: {
      coefficients,
      numeratorZ: controller.numerator,
      denominatorZ: controller.denominator,
      differenceEquation: controller.differenceEquation(),
      c99: renderControllerC99(controller.numerator, controller.denominator, 'llc_voltage_controller_run', outMin, outMax),
    },
    fixed: {
      coefficients: fixedPointTable(fx),
      c99: renderFixedC99(fx, 'vloop'),
      libInitC99: renderFixedLibInitC99(fx, 'vloop'),
      checks: fx.checks,
      budget: fx.budget,
    },
    operatingPoint: {
      fswKhz: result.analysis.fmOperatingPoint.frequencyHz / 1e3,
      fmCommandPu: result.analysis.fmOperatingPoint.commandPu,
      fmGainHzPerPu: result.analysis.fmOperatingPoint.gainHzPerPu,
    },
    margins: {
      phaseMarginDeg: result.achievedPhaseMarginDeg,
      crossoverHz: result.achievedCrossoverHz,
      gainMarginDb: result.achievedGainMarginDb,
      delayMarginS: result.analysis.marginsNominalDelay.delayMarginS,
    },
    discreteStable: result.analysis.discreteApproximation.stable,
    iterations: result.iterations,
    notes: result.notes,
    warnings: result.analysis.warnings,
  }
}

export type { LlcDesignRequest }
