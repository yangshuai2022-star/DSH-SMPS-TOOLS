// 线性代数内核验证：对拍 numpy/scipy 参考（_ref_output/linalg_ref.json）
// 运行: node linalg_test.mjs（需先 tsup 打包到 ./lin/）
import fs from 'fs'

const lin = await import('./lin/linalg.js')
const tflib = await import('./lin/tf.js')
const ref = JSON.parse(fs.readFileSync('/home/yangshuai/task/_ref_output/linalg_ref.json', 'utf8'))

let allOk = true
function close(a, b, tol = 1e-8) {
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b))
}
function check(name, got, want, tol = 1e-6) {
  let ok
  if (Array.isArray(want)) {
    ok = got.length === want.length && got.every((g, i) => {
      if (Array.isArray(want[i])) return g.every((v, j) => close(v, want[i][j], tol))
      return close(g, want[i], tol)
    })
  } else {
    ok = close(got, want, tol)
  }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got).slice(0, 90)} want=${JSON.stringify(want).slice(0, 90)}`)
  allOk &&= ok
}

// expm
const expmA = lin.expm([[0, 1], [-2, -3]])
check('expm_A', expmA, ref.expm_A, 1e-6)

// eigvals
const evB = lin.eigvals([[0, -1], [1, 0]])
// 特征值顺序可能不同，比较集合
function eigClose(got, want, tol = 1e-6) {
  if (got.length !== want.length) return false
  const used = new Array(want.length).fill(false)
  for (const g of got) {
    let found = false
    for (let i = 0; i < want.length; i++) {
      if (!used[i] && close(g.re, want[i][0], tol) && close(g.im, want[i][1], tol)) {
        used[i] = true; found = true; break
      }
    }
    if (!found) return false
  }
  return true
}
console.log(`${eigClose(evB, ref.eigvals_B) ? 'PASS' : 'FAIL'}  eigvals_B (unordered)  ${JSON.stringify(evB)}`)
allOk &&= eigClose(evB, ref.eigvals_B)

const evC = lin.eigvals([[2, 1, 0], [0, 2, 1], [0, 0, 2]])
console.log(`${eigClose(evC, ref.eigvals_C) ? 'PASS' : 'FAIL'}  eigvals_C (unordered)  ${JSON.stringify(evC)}`)
allOk &&= eigClose(evC, ref.eigvals_C)

// roots
check('roots_quad', lin.roots([1, -5, 6]).map(x => [x.re, x.im]).sort((a, b) => a[0] - b[0]), ref.roots.sort((a, b) => a[0] - b[0]), 1e-6)
check('roots_cubic', lin.roots([1, -6, 11, -6]).map(x => [x.re, x.im]).sort((a, b) => a[0] - b[0]), ref.roots_cubic.sort((a, b) => a[0] - b[0]), 1e-6)

// ss2tf
const A3 = [[0, 1, 0], [0, 0, 1], [-6, -11, -6]]
const B3 = [[0], [0], [1]]
const C3 = [[1, 0, 0]]
const D3 = [[0]]
const [num, den] = tflib.ss2tf(A3, B3, C3, D3, 0, 0)
check('ss2tf_num', num, ref.ss2tf_num, 1e-6)
check('ss2tf_den', den, ref.ss2tf_den, 1e-6)

// cont2discrete zoh
const zoh = tflib.cont2discreteZoh(A3, B3, C3, D3, 0.001)
check('zoh_ad', zoh.ad, ref.zoh_ad, 1e-6)
check('zoh_bd', zoh.bd, ref.zoh_bd, 1e-6)
check('zoh_cd', zoh.cd, ref.zoh_cd, 1e-6)
check('zoh_dd', zoh.dd, ref.zoh_dd, 1e-6)

// bilinear
const bl = tflib.cont2discreteBilinear([1.0, 2.0], [1.0, 3.0, 2.0], 0.001)
check('bilinear_numz', bl.numZ, ref.bilinear_numz, 1e-6)
check('bilinear_denz', bl.denZ, ref.bilinear_denz, 1e-6)

// unwrap
check('unwrap', lin.unwrap([0, 3, 6, 9]), ref.unwrap, 1e-9)

// sinc
check('sinc', [0, 0.5, 1.0, 1.5].map(x => lin.sinc(x)), ref.sinc, 1e-9)

console.log(`\n${allOk ? '✅ 全部通过' : '❌ 存在失败项'}`)
process.exit(allOk ? 0 : 1)
