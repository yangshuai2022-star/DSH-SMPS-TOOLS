// 数值验证 1：TS 移植 vs Python baseline（全桥 400→53V/3kW，TDK_PQ35_35_B65881A_N87）
// 运行: node verify.mjs  （依赖同目录 index.js = tsup 打包的 engine）
import { designLlc } from './index.js'

const r = designLlc({
  vout: 53, pout: 3000, frKhz: 100,
  vinNom: 400, vinMinNormal: 360, vinMax: 420, vinHoldEnd: 300,
  topology: 'full-bridge', k: 5, q: 0.35,
})

const baseline = {
  primaryTurns: 60, secondaryTurns: 8, actualRatio: 7.5, ratioErrorPct: 0.125,
  targetLmUh: 118.9053602925003, ungappedLmUh: 16200.0, targetAlNh: 33.02926674791675,
  gapMm: 6.458170331527403,
  pLitz: 250, sLitzSubBundles: 4, sLitzStrands: 1350,
  fill: 2.5090072054837935, radial: 23.90071686747387, worstB: 0.17103947320474208,
  rdcP_mohm: 52.62592767623258, rdcS_mohm: 1.2994056216353718,
  lrUh: 23.78107205850006, crNf: 106.51452486361164, lmUh: 118.9053602925003,
  coreLossW: 1.0232804547330352, totalLossW: 29.20434153081286,
  feasible: false,
}

let allOk = true
function check(name, got, want, rel = 5e-4) {
  const ok = Math.abs(got - want) <= Math.max(rel * Math.abs(want), 1e-6)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(20)} got=${got}  want=${want}`)
  allOk &&= ok
}

console.log('=== 全桥 3kW 基线 ===')
check('primary_turns', r.turns.primary, baseline.primaryTurns, 0)
check('secondary_turns', r.turns.secondary, baseline.secondaryTurns, 0)
check('actual_ratio', r.turns.ratio, baseline.actualRatio)
check('ratio_error_pct', r.turns.ratioErrorPct, baseline.ratioErrorPct, 0.02)
check('lr_uH', r.tank.lrUh, baseline.lrUh)
check('cr_nF', r.tank.crNf, baseline.crNf)
check('lm_uH', r.tank.lmUh, baseline.lmUh)
check('target_al_nH', r.gap.targetAlNh, baseline.targetAlNh)
check('ungapped_lm_uH', r.gap.ungappedLmUh, baseline.ungappedLmUh)
check('gap_mm', r.gap.estimatedGapMm, baseline.gapMm, 2e-3)
check('p_litz_strands', r.litz.primary.strandCount, baseline.pLitz, 0)
check('s_litz_sub_bundles', r.litz.secondary.subBundles, baseline.sLitzSubBundles, 0)
check('s_litz_strands', r.litz.secondary.strandCount, baseline.sLitzStrands, 0)
check('fill_factor', r.winding.fillFactor, baseline.fill, 2e-3)
check('radial_build', r.winding.radialBuildMm, baseline.radial, 2e-3)
check('rdc_p_mohm', r.winding.primaryRdcMohm, baseline.rdcP_mohm)
check('rdc_s_mohm', r.winding.secondaryRdcMohm, baseline.rdcS_mohm)
check('worst_bpk_T', r.worstBPeakT, baseline.worstB)
check('core_loss_W', r.loss.coreW, baseline.coreLossW, 2e-3)
check('total_loss_W', r.loss.totalW, baseline.totalLossW, 2e-3)
check('feasible', r.feasible ? 1 : 0, baseline.feasible ? 1 : 0, 0)

console.log('--- 增益/ZVS 检查（新增输出） ---')
console.log(`  gainCheck: Mmin=${r.gainCheck.mMin.toFixed(4)} Mmax=${r.gainCheck.mMax.toFixed(4)} holdEnd=${r.gainCheck.mMaxHoldEnd.toFixed(4)} 可用=${r.gainCheck.availableGainMin.toFixed(4)}..${r.gainCheck.availableGainMax.toFixed(4)}`)
console.log(`  zvs: allInductive=${r.zvs.allInductive} minIcomm=${r.zvs.minCommutationCurrentA.toFixed(3)}A @${r.zvs.minCommutationAtVbusV}V/${(r.zvs.minCommutationAtLoad * 100).toFixed(0)}%`)
const wp = r.workpoints[1]
check('wp_fsw_kHz', wp.fswKhz, 99.689, 1e-3)
check('wp_bpk_T', wp.bPeakT, 0.104, 5e-3)
check('wp_Ip_A', wp.primaryRmsA, 9.68, 1e-3)
check('wp_Is_A', wp.secondaryRmsA, 62.87, 1e-3)

console.log(`\n${allOk ? '✅ 全部通过' : '❌ 存在失败项'}`)
process.exit(allOk ? 0 : 1)
