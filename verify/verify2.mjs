// 数值验证 2：TS 移植 vs Python baseline（半桥 400→24V/500W，spec_hb500.json）
// 运行: node verify2.mjs
import { designLlc } from './index.js'

const r = designLlc({
  vout: 24, pout: 500, frKhz: 120,
  vinNom: 400, vinMinNormal: 380, vinMax: 420, vinHoldEnd: 330,
  topology: 'half-bridge', k: 5, q: 0.4,
  fminKhz: 70, fmaxKhz: 200,
})

const baseline = {
  primaryTurns: 25, secondaryTurns: 3, ratio: 8.333333, ratioErrPct: 1.666667,
  lrUh: 34.401637, crNf: 51.132693, lmUh: 172.008184,
  gapMm: 0.73307,
  pStrands: 100, sStrands: 500, sSub: 2,
  fill: 0.538733, radial: 6.911913, worstB: 0.160194,
  rdcP: 54.818675, rdcS: 1.31564819,
  totalLossW: 2.323861, coreW: 1.494367,
  feasible: true,
}

let allOk = true
function check(name, got, want, rel = 5e-4) {
  const ok = Math.abs(got - want) <= Math.max(rel * Math.abs(want), 1e-6)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(20)} got=${got}  want=${want}`)
  allOk &&= ok
}

console.log(`Np:Ns = ${r.turns.primary}:${r.turns.secondary}  feasible=${r.feasible}`)
check('primary_turns', r.turns.primary, baseline.primaryTurns, 0)
check('secondary_turns', r.turns.secondary, baseline.secondaryTurns, 0)
check('ratio', r.turns.ratio, baseline.ratio, 1e-4)
check('ratio_error_pct', r.turns.ratioErrorPct, baseline.ratioErrPct, 0.02)
check('lr_uH', r.tank.lrUh, baseline.lrUh)
check('cr_nF', r.tank.crNf, baseline.crNf)
check('lm_uH', r.tank.lmUh, baseline.lmUh)
check('gap_mm', r.gap.estimatedGapMm, baseline.gapMm, 2e-3)
check('p_litz_strands', r.litz.primary.strandCount, baseline.pStrands, 0)
check('s_litz_strands', r.litz.secondary.strandCount, baseline.sStrands, 0)
check('s_litz_sub', r.litz.secondary.subBundles, baseline.sSub, 0)
check('fill', r.winding.fillFactor, baseline.fill, 2e-3)
check('radial', r.winding.radialBuildMm, baseline.radial, 2e-3)
check('worst_bpk', r.worstBPeakT, baseline.worstB, 2e-3)
check('rdc_p', r.winding.primaryRdcMohm, baseline.rdcP)
check('rdc_s', r.winding.secondaryRdcMohm, baseline.rdcS, 2e-3)
check('total_loss_W', r.loss.totalW, baseline.totalLossW, 2e-3)
check('core_loss_W', r.loss.coreW, baseline.coreW, 2e-3)
check('feasible', r.feasible ? 1 : 0, baseline.feasible ? 1 : 0, 0)

console.log(`  gainCheck: Mmin=${r.gainCheck.mMin.toFixed(4)} Mmax=${r.gainCheck.mMax.toFixed(4)} holdEnd=${r.gainCheck.mMaxHoldEnd.toFixed(4)}`)
console.log(`  zvs: allInductive=${r.zvs.allInductive} minIcomm=${r.zvs.minCommutationCurrentA.toFixed(3)}A`)

console.log(`\n${allOk ? '✅ 全部通过' : '❌ 存在失败项'}`)
process.exit(allOk ? 0 : 1)
