// 小信号全链验证：TS 移植 vs Python 参考（_ref_output/ssa_hb500.json）
// plant 稳态 + 线性化 A/B/C/D + Gvf(s) 传递函数
import fs from 'fs'
const p = await import('./ssa/_verify_ssa_entry.js')
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

const continuous = p.linearizeDynamicPhasor(model, steady)
const continuousKhz = p.withControlInput(continuous, 'frequency_khz')
const transfer = p.plantSiso(continuousKhz, { outputName: 'output_voltage_v' })

let allOk = true
function check(name, got, want, rel = 5e-3) {
  const ok = Math.abs(got - want) <= Math.max(rel * Math.abs(want), 1e-12)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(22)} got=${got}  want=${want}`)
  allOk &&= ok
}
function checkMat(name, got, want, rel = 5e-3) {
  const flat = got.flat()
  const wantFlat = want.flat()
  const ok = flat.length === wantFlat.length && flat.every((g, i) =>
    Math.abs(g - wantFlat[i]) <= Math.max(rel * Math.abs(wantFlat[i]), 1e-12))
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} (${flat.length} 项，最大误差 ${flat.reduce((m, g, i) => Math.max(m, Math.abs(g - wantFlat[i])), 0).toExponential(2)})`)
  allOk &&= ok
}

// 注意：Python 参考的 A/B/C/D 是频率控制输入（Hz）；with_control_input(frequency_khz) 会缩放
// 参考 ssa_hb500.json 里 continuous_plant 是 build_small_signal_analysis 默认（frequency_hz）
checkMat('A', continuous.a, ref.A, 5e-3)
checkMat('B', continuous.b, ref.B, 5e-3)
checkMat('C', continuous.c, ref.C, 5e-3)
checkMat('D', continuous.d, ref.D, 5e-3)

// 极点比较（无序）
function polesClose(got, want, tol = 5e-3) {
  if (got.length !== want.length) return false
  const used = new Array(want.length).fill(false)
  for (const g of got) {
    let found = false
    for (let i = 0; i < want.length; i++) {
      if (!used[i] && Math.abs(g.re - want[i][0]) <= Math.max(tol * Math.abs(want[i][0]), 1e-9)
        && Math.abs(g.im - want[i][1]) <= Math.max(tol * Math.abs(want[i][1]), 1e-9)) {
        used[i] = true; found = true; break
      }
    }
    if (!found) return false
  }
  return true
}
console.log(`${polesClose(continuous.poles, ref.poles) ? 'PASS' : 'FAIL'}  poles (unordered)`)
allOk &&= polesClose(continuous.poles, ref.poles)

// Gvf(s) 传递函数（kHz 控制输入）—— 参考是 frequency_hz；缩放 1000
const num = transfer.numerator
const den = transfer.denominator
// Python 参考 tf 是 frequency_hz 输入；TS 是 frequency_khz → 分子 ×1000
const refNum = ref.tf_num.map(v => v * 1000)
checkMat('tf_num(kHz)', num, refNum, 5e-3)
checkMat('tf_den', den, ref.tf_den, 5e-3)

// 频响抽样对比（低频增益）
const freqs = [1, 10, 100, 1000, 10000]
const tsResp = p.sisoFrequencyResponse(transfer, freqs)
const pyResp = freqs.map(f => {
  // 从参考 A/B/C/D 计算 freqresp（用 Python 参考的 continuous transfer? 没有直接存频响）
  // 简单对比 dc_gain 和 10kHz 处的估计
  return null
})
console.log(`  Gvf dc_gain(TS) = ${transfer.dcGain.toExponential(4)}`)
console.log(`  Gvf dc_gain(参考, 缩放1000) = ${(ref.tf_dc_gain * 1000).toExponential(4)}`)
check('tf_dc_gain(kHz)', transfer.dcGain, ref.tf_dc_gain * 1000, 5e-3)
console.log(`  Gvf 频响(TS): ${freqs.map((f, i) => `${f}Hz=${tsResp[i].re.toExponential(2)}${tsResp[i].im >= 0 ? '+' : ''}${tsResp[i].im.toExponential(2)}j`).join(', ')}`)
void pyResp

console.log(`\n${allOk ? '✅ 全部通过' : '❌ 存在失败项'}`)
process.exit(allOk ? 0 : 1)
