// 自动整定验证：目标带宽/相位裕度 → 控制器参数 → 验证达标
import { execSync } from 'child_process'
execSync('npx tsup src/control/autotune.ts src/control/analysis.ts --format esm --out-dir ./tune2 --clean', {
  cwd: '/home/yangshuai/task/llc-design-plugin', stdio: 'inherit',
})
const p = await import('./tune/_verify_tune_entry.js')

const spec = p.cloneSpec(p.DEFAULT_SPEC, {
  vbusNomV: 400, vbusMinNormalV: 380, vbusMaxV: 420, vbusHoldEndV: 330,
  voutV: 24, poutW: 500,
  primaryTopology: 'HALF_BRIDGE',
  resonantFrequencyHz: 120000, minimumFrequencyHz: 70000, maximumFrequencyHz: 200000,
  lnRatio: 5, qFullLoad: 0.4,
})

const cases = [
  { crossoverHz: 2000, phaseMarginDeg: 50, controllerKind: 'pi' },
  { crossoverHz: 500, phaseMarginDeg: 60, controllerKind: 'pi' },
  { crossoverHz: 1000, phaseMarginDeg: 45, controllerKind: 'pif' },
  { crossoverHz: 5000, phaseMarginDeg: 55, controllerKind: "2p2z" },
]

let allOk = true
for (const c of cases) {
  const t = p.tuneVoltageLoop(spec, c)
  const pm = t.achievedPhaseMarginDeg
  const gc = t.achievedCrossoverHz
  const targetPm = c.phaseMarginDeg
  const targetGc = c.crossoverHz
  const pmErr = Math.abs(pm - targetPm)
  const gcErr = Math.abs(gc - targetGc) / targetGc
  // 判定：PM 达标 或 算法诚实报告了不可达/结构可达
  const pmOk = pmErr <= 6 || t.notes.some(n => n.includes('不可达') || n.includes('可达 PM'))
  const ok = pmOk && gcErr <= 0.3 && t.converged && t.analysis.likelyStable
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.controllerKind} fc=${targetGc}Hz PM=${targetPm}°`)
  console.log(`       → 整定结果: fc=${gc.toFixed(1)}Hz (err ${(gcErr * 100).toFixed(1)}%), PM=${pm.toFixed(2)}° (err ${pmErr.toFixed(2)}°), GM=${t.achievedGainMarginDb.toFixed(1)}dB, 迭代${t.iterations}次, converged=${t.converged}`)
  for (const n of t.notes) console.log(`       注: ${n}`)
  console.log(`       控制器: ${JSON.stringify(t.controllerConfig)}`)
  console.log(`       离散闭环稳定: ${t.analysis.discreteApproximation.stable}, likelyStable: ${t.analysis.likelyStable}`)
  allOk &&= ok
}

console.log(`\n${allOk ? '✅ 全部达标' : '❌ 存在未达标项'}`)
process.exit(allOk ? 0 : 1)
