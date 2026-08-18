// 数字环路验证：TS 移植 vs Python 参考（_ref_output/dloop_hb500.json）
import fs from 'fs'
const p = await import('./loop/_verify_loop_entry.js')
const ref = JSON.parse(fs.readFileSync('/home/yangshuai/task/_ref_output/dloop_hb500.json', 'utf8'))

const spec = p.cloneSpec(p.DEFAULT_SPEC, {
  vbusNomV: 400, vbusMinNormalV: 380, vbusMaxV: 420, vbusHoldEndV: 330,
  voutV: 24, poutW: 500,
  primaryTopology: 'HALF_BRIDGE',
  resonantFrequencyHz: 120000, minimumFrequencyHz: 70000, maximumFrequencyHz: 200000,
  lnRatio: 5, qFullLoad: 0.4,
})

const ssa = p.buildSmallSignalAnalysis(spec, { vbusV: 400, loadFraction: 1.0, sampleTimeS: 20e-6 })
const ctrl = p.makePiConfig(0.01, 1e-3, 20e-6)
// 默认 2400 点网格（与 Python 参考的 margins 一致）
const r = p.buildDigitalLoopAnalysis(ssa, { controllerConfig: ctrl })
// 6 点采样网格（与 Python 的 ol_nominal 采样点一致）
const rSample = p.buildDigitalLoopAnalysis(ssa, { controllerConfig: ctrl, frequenciesHz: ref.sample_freqs })

let allOk = true
function check(name, got, want, rel = 5e-3) {
  const ok = Math.abs(got - want) <= Math.max(rel * Math.abs(want), 1e-12)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(24)} got=${got}  want=${want}`)
  allOk &&= ok
}
function checkArr(name, got, want, rel = 5e-3) {
  const ok = got.length === want.length && got.every((g, i) =>
    Math.abs(g - want[i]) <= Math.max(rel * Math.abs(want[i]), 1e-12))
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(24)} [${got.map(x => x.toFixed(8)).join(', ')}]`)
  allOk &&= ok
}

check('fsw_hz', ssa.operatingPoint.switchingFrequencyHz, ref.fsw_hz, 1e-3)
check('fm_command_pu', r.fmOperatingPoint.commandPu, ref.fm_op.command_pu, 1e-3)
check('fm_frequency_hz', r.fmOperatingPoint.frequencyHz, ref.fm_op.frequency_hz, 1e-3)
check('fm_gain', r.fmOperatingPoint.gainHzPerPu, ref.fm_op.gain_hz_per_pu, 1e-3)
check('fm_left_gain', r.fmOperatingPoint.leftGainHzPerPu, ref.fm_op.left, 1e-3)
check('fm_right_gain', r.fmOperatingPoint.rightGainHzPerPu, ref.fm_op.right, 1e-3)

checkArr('ctrl_num', r.controller.numerator, ref.ctrl_num, 1e-9)
checkArr('ctrl_den', r.controller.denominator, ref.ctrl_den, 1e-9)

for (const env of ['minimum', 'nominal', 'maximum']) {
  const m = r[`margins${env[0].toUpperCase()}${env.slice(1)}Delay`]
  const refM = ref.margins[env]
  check(`${env}_pm_deg`, m.phaseMarginDeg, refM.pm_deg, 5e-3)
  check(`${env}_gc_hz`, m.criticalGainCrossoverHz, refM.gc_hz, 5e-3)
  check(`${env}_gm_db`, m.gainMarginDb, refM.gm_db, 5e-3)
  check(`${env}_pc_hz`, m.criticalPhaseCrossoverHz, refM.pc_hz, 5e-3)
  check(`${env}_delay_margin`, m.delayMarginS, refM.delay_margin_s, 5e-3)
}

check('likely_stable', r.likelyStable ? 1 : 0, ref.likely_stable ? 1 : 0, 0)
check('disc_stable', r.discreteApproximation.stable ? 1 : 0, ref.disc_stable ? 1 : 0, 0)
check('disc_int_delay', r.discreteApproximation.integerDelaySamples, ref.disc_int_delay, 0)
check('disc_frac_delay', r.discreteApproximation.fractionalDelaySamples, ref.disc_frac_delay, 1e-3)

// 极点集合比较（容忍近零伪极点：尾部零差异产生的 z≈0 极点数学等价）
function polesClose(got, want, tol = 5e-3) {
  const normGot = got.filter(p => Math.hypot(p.re, p.im) > 1e-3)
  const normWant = want.filter(p => Math.hypot(p[0], p[1]) > 1e-3)
  if (normGot.length !== normWant.length) return false
  const used = new Array(normWant.length).fill(false)
  for (const g of normGot) {
    let found = false
    for (let i = 0; i < normWant.length; i++) {
      if (!used[i] && Math.abs(g.re - normWant[i][0]) <= Math.max(tol * Math.abs(normWant[i][0]), 1e-9)
        && Math.abs(g.im - normWant[i][1]) <= Math.max(tol * Math.abs(normWant[i][1]), 1e-9)) {
        used[i] = true; found = true; break
      }
    }
    if (!found) return false
  }
  return true
}
console.log(`${polesClose(r.discreteApproximation.closedLoopPoles, ref.disc_poles) ? 'PASS' : 'FAIL'}  disc_poles (unordered)`)
allOk &&= polesClose(r.discreteApproximation.closedLoopPoles, ref.disc_poles)

// 开环频响采样点（用 6 点网格的分析）
const ol = rSample.responses['open_loop_nominal']
const refOl = ref.ol_nominal
const okOl = ol.length === refOl.length && ol.every((v, i) =>
  Math.abs(v.re - refOl[i][0]) <= Math.max(5e-3 * Math.abs(refOl[i][0]), 1e-9)
  && Math.abs(v.im - refOl[i][1]) <= Math.max(5e-3 * Math.abs(refOl[i][1]), 1e-9))
console.log(`${okOl ? 'PASS' : 'FAIL'}  open_loop_nominal @sample freqs`)
allOk &&= okOl
console.log(`  ol@100Hz: TS=${ol[1].re.toFixed(6)}${ol[1].im >= 0 ? '+' : ''}${ol[1].im.toFixed(6)}j  PY=${refOl[1][0].toFixed(6)}${refOl[1][1] >= 0 ? '+' : ''}${refOl[1][1].toFixed(6)}j`)
console.log(`  ol@10kHz: TS=${ol[4].re.toFixed(6)}${ol[4].im >= 0 ? '+' : ''}${ol[4].im.toFixed(6)}j  PY=${refOl[4][0].toFixed(6)}${refOl[4][1] >= 0 ? '+' : ''}${refOl[4][1].toFixed(6)}j`)

console.log(`\n${allOk ? '✅ 全部通过' : '❌ 存在失败项'}`)
process.exit(allOk ? 0 : 1)
