// plant 稳态验证：TS 移植 vs Python 参考（_ref_output/ssa_hb500.json）
import fs from 'fs'
const p = await import('./plant/_verify_plant_entry.js')
const ref = JSON.parse(fs.readFileSync('/home/yangshuai/task/_ref_output/ssa_hb500.json', 'utf8'))

const spec = p.cloneSpec(p.DEFAULT_SPEC, {
  vbusNomV: 400, vbusMinNormalV: 380, vbusMaxV: 420, vbusHoldEndV: 330,
  voutV: 24, poutW: 500,
  primaryTopology: 'HALF_BRIDGE',
  resonantFrequencyHz: 120000, minimumFrequencyHz: 70000, maximumFrequencyHz: 200000,
  lnRatio: 5, qFullLoad: 0.4,
})

const tank = p.designTank(spec)
const op = p.solveOperatingPoint(spec, tank, 400, 1.0)
const params = p.plantParametersFromDesign(spec, tank, op)
const model = new p.DynamicPhasorModel(params)
const steady = model.solveRegulatedSteadyState({
  busVoltageV: op.vbusV,
  targetOutputVoltageV: spec.voutV,
  frequencyGuessHz: op.switchingFrequencyHz,
  minimumFrequencyHz: spec.minimumFrequencyHz,
  maximumFrequencyHz: spec.maximumFrequencyHz,
  operatingPoint: op,
})

let allOk = true
function check(name, got, want, rel = 5e-4) {
  const ok = Math.abs(got - want) <= Math.max(rel * Math.abs(want), 1e-9)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(26)} got=${got}  want=${want}`)
  allOk &&= ok
}
function checkArr(name, got, want, rel = 5e-4) {
  const ok = got.length === want.length && got.every((g, i) =>
    Math.abs(g - want[i]) <= Math.max(rel * Math.abs(want[i]), 1e-9))
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(26)} [${got.map(x => x.toFixed(6)).join(', ')}]`)
  allOk &&= ok
}

check('steady_fsw_hz', steady.inputs.switchingFrequencyHz, ref.op_fsw_hz, 5e-3)
check('steady_output_v', steady.outputVoltageV, ref.steady_output_v, 5e-3)
checkArr('steady_states', steady.states, ref.steady_states, 1e-3)
check('ir_rms', steady.resonantCurrentRmsA, ref.steady_ir_rms, 5e-3)
check('im_rms', steady.magnetizingCurrentRmsA, ref.steady_im_rms, 5e-3)
check('is_rms', steady.secondaryCurrentRmsA, ref.steady_is_rms, 5e-3)
check('rect_avg', steady.rectifierCurrentAvgA, ref.steady_rect_avg, 5e-3)
check('converged', steady.converged ? 1 : 0, ref.steady_converged ? 1 : 0, 0)

console.log(`\n${allOk ? '✅ 全部通过' : '❌ 存在失败项'}`)
process.exit(allOk ? 0 : 1)
