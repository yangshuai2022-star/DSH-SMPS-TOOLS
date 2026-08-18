// 定点输出验证：整定 PI → 浮点/定点双份参数 + 代码
import { execSync } from 'child_process'
execSync('npx tsup src/control/qformat.ts --format esm --out-dir ./q2 --clean', {
  cwd: '/home/yangshuai/task/llc-design-plugin', stdio: 'inherit',
})
const p = await import('./qfmt/_verify_qentry.js')

const spec = p.cloneSpec(p.DEFAULT_SPEC, {
  vbusNomV: 400, vbusMinNormalV: 380, vbusMaxV: 420, vbusHoldEndV: 330,
  voutV: 24, poutW: 500, primaryTopology: 'HALF_BRIDGE',
  resonantFrequencyHz: 120000, minimumFrequencyHz: 70000, maximumFrequencyHz: 200000,
  lnRatio: 5, qFullLoad: 0.4,
})

// 用已验证的 PI 整定结果（fc=2000, PM=50）
const t = p.tuneVoltageLoop(spec, { crossoverHz: 2000, phaseMarginDeg: 50, controllerKind: 'pi' })
const out = p.runLoopTune({ vout: 24, pout: 500, frKhz: 120, topology: 'half-bridge', crossoverKhz: 2, phaseMarginDeg: 50, controllerKind: 'pi' })

let allOk = true
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
  allOk &&= cond
}

console.log('=== 浮点控制器 ===')
console.log('  kp =', out.controller.coefficients.kp, ' ti =', out.controller.coefficients.tiS)
console.log('  PM =', out.margins.phaseMarginDeg.toFixed(1), ' fc =', out.margins.crossoverHz.toFixed(1))

console.log('=== 32 位定点整数参数 ===')
for (const [name, c] of Object.entries(out.fixed.coefficients)) {
  console.log(`  ${name.padEnd(8)} int=${String(c.int).padStart(10)}  Q${c.q}  float=${c.float.toPrecision(7)}`)
  // 验证反量化 ≈ 原值
  const back = c.int / 2 ** c.q
  check(`${name} 反量化误差 < 1e-6`, Math.abs(back - c.float) <= Math.max(1e-6, c.float * 1e-6) + 2 ** -c.q)
}

console.log('=== fail-fast 检查 ===')
for (const c of out.fixed.checks) console.log(`  - ${c}`)
console.log('=== 溢出核算 ===')
for (const b of out.fixed.budget) console.log(`  ${b.item}: ${b.upper.toFixed(3)} ≤ ${b.limit} ${b.ok ? '✓' : '✗'}`)
check('所有核算通过', out.fixed.budget.every(b => b.ok))

console.log('=== 自包含 int32 代码 ===')
console.log(out.fixed.c99.split('\n').slice(0, 20).join('\n'))
console.log('...')
check('代码包含 IQ20 宏', out.fixed.c99.includes('_IQ20'))
check('代码包含 int64 中间量', out.fixed.c99.includes('int64_t'))

console.log('=== 库对接代码 ===')
console.log(out.fixed.libInitC99)

console.log(`\n${allOk ? '✅ 全部通过' : '❌ 存在失败项'}`)
process.exit(allOk ? 0 : 1)
