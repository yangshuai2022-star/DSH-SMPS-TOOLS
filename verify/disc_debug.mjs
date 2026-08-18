// 离散近似调试：TS vs Python（_ref_output/dloop_disc.json）
import fs from 'fs'
const p = await import('./loop/_verify_loop_entry.js')
const ref = JSON.parse(fs.readFileSync('/home/yangshuai/task/_ref_output/dloop_disc.json', 'utf8'))

const spec = p.cloneSpec(p.DEFAULT_SPEC, {
  vbusNomV: 400, vbusMinNormalV: 380, vbusMaxV: 420, vbusHoldEndV: 330,
  voutV: 24, poutW: 500,
  primaryTopology: 'HALF_BRIDGE',
  resonantFrequencyHz: 120000, minimumFrequencyHz: 70000, maximumFrequencyHz: 200000,
  lnRatio: 5, qFullLoad: 0.4,
})

const ssa = p.buildSmallSignalAnalysis(spec, { vbusV: 400, loadFraction: 1.0, sampleTimeS: 20e-6 })
const ctrl = p.makePiConfig(0.01, 1e-3, 20e-6)
const r = p.buildDigitalLoopAnalysis(ssa, { controllerConfig: ctrl })

console.log('=== 离散 plant (Gvf-ZOH) ===')
console.log('TS num:', ssa.discretePlant.numerator.map(x => x.toExponential(4)).join(', '))
console.log('PY num:', ref.disc_plant_num.map(x => x.toExponential(4)).join(', '))
console.log('TS den:', ssa.discretePlant.denominator.map(x => x.toExponential(4)).join(', '))
console.log('PY den:', ref.disc_plant_den.map(x => x.toExponential(4)).join(', '))

console.log('\n=== 开环离散（含控制器/FM/模拟/ADC/延迟）===')
console.log('TS ol_num len:', r.discreteApproximation.openLoopNumerator.length, 'den:', r.discreteApproximation.openLoopDenominator.length)
console.log('PY ol_num len:', ref.ol_num.length, 'den:', ref.ol_den.length)
console.log('TS ol_num:', r.discreteApproximation.openLoopNumerator.map(x => x.toExponential(3)).join(', '))
console.log('PY ol_num:', ref.ol_num.map(x => x.toExponential(3)).join(', '))

console.log('\n=== 闭环极点 ===')
console.log('TS:', r.discreteApproximation.closedLoopPoles.map(p => `(${p.re.toFixed(4)},${p.im.toFixed(4)})`).join(' '))
console.log('PY:', ref.closed_poles.map(p => `(${p[0].toFixed(4)},${p[1].toFixed(4)})`).join(' '))
console.log('TS stable:', r.discreteApproximation.stable, ' PY stable:', ref.closed_poles.every(p => Math.hypot(p[0], p[1]) < 1))
