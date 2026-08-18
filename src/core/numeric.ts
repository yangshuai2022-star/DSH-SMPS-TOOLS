/**
 * 数值工具层：Python (numpy/scipy) 依赖的 TS 移植。
 *
 * 对应仓库 llc_design 中用到的：
 *   - scipy.optimize.brentq        → brentq()
 *   - scipy.special.iv             → besselI()（修正贝塞尔函数，复数域）
 *   - scipy.special.gamma          → gamma()
 *   - numpy.fft.rfft               → rfft()
 *   - numpy.geomspace              → geomspace()
 *   - numpy.roll / mean / median   → roll() / mean() / median()
 *
 * 复数用 { re, im } 表示，运算函数见下。
 */

// ── 复数 ────────────────────────────────────────────────────────────

export interface Complex {
  re: number
  im: number
}

export const cplx = (re: number, im = 0): Complex => ({ re, im })
export const cAdd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im })
export const cSub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im })
export const cMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
})
export const cDiv = (a: Complex, b: Complex): Complex => {
  const d = b.re * b.re + b.im * b.im
  return {
    re: (a.re * b.re + a.im * b.im) / d,
    im: (a.im * b.re - a.re * b.im) / d,
  }
}
export const cAbs = (a: Complex): number => Math.hypot(a.re, a.im)
export const cScale = (a: Complex, s: number): Complex => ({ re: a.re * s, im: a.im * s })
export const cConj = (a: Complex): Complex => ({ re: a.re, im: -a.im })

/** cAdd(a, cMul(b, c)) —— 用于 z_series + 1/(jωC) 这类组合 */
export const cInv = (a: Complex): Complex => {
  const d = a.re * a.re + a.im * a.im
  return { re: a.re / d, im: -a.im / d }
}

// ── gamma 函数（Lanczos 近似，实数）─────────────────────────────────

const LANCZOS_G = 7
const LANCZOS_COEF = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
]

export function gamma(x: number): number {
  if (x < 0.5) {
    // Reflection formula
    return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x))
  }
  x -= 1
  let a = LANCZOS_COEF[0]!
  const t = x + LANCZOS_G + 0.5
  for (let i = 1; i < LANCZOS_COEF.length; i++) {
    a += LANCZOS_COEF[i]! / (x + i)
  }
  return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a
}

// ── 第一类修正贝塞尔函数 Iν(z)，z 复数 ─────────────────────────────

/**
 * I_ν(z) 用级数 + 渐近展开实现。
 * 级数：Iν(z) = (z/2)^ν · Σ_k (z²/4)^k / (k! · Γ(ν+k+1))
 * 我们的场景 |z| = r/δ 通常在 0.1..10 内，级数收敛快；|z| 大时转渐近。
 */
export function besselI(nu: number, z: Complex): Complex {
  const absZ = cAbs(z)
  if (absZ > 18) {
    // 渐近展开 Iν(z) ≈ e^z / sqrt(2πz) · (1 - (4ν²-1)/(8z))，|arg z| < π/2
    const argZ = Math.atan2(z.im, z.re)
    const eRe = Math.exp(z.re)
    const leadMag = eRe / Math.sqrt(2 * Math.PI * absZ)
    const leadPhase = z.im - argZ / 2
    const leading = cplx(leadMag * Math.cos(leadPhase), leadMag * Math.sin(leadPhase))
    const corr = cSub(cplx(1, 0), cScale(cInv(z), (4 * nu * nu - 1) / 8))
    return cMul(leading, corr)
  }
  // 级数展开
  const halfZ = cScale(z, 0.5) // z/2
  const z2over4 = cMul(halfZ, halfZ) // (z/2)^2 = z²/4
  let term = cplx(1, 0)
  const powHalf = cplx(1, 0)
  // (z/2)^ν
  let powZ: Complex
  if (Math.abs(nu - Math.round(nu)) < 1e-12 && Math.round(nu) >= 0) {
    // 整数阶：直接乘 nu 次
    const n = Math.round(nu)
    let acc = cplx(1, 0)
    for (let i = 0; i < n; i++) acc = cMul(acc, halfZ)
    powZ = acc
  } else {
    // 非整数阶：|z|^ν · e^{i·ν·arg(z)}
    const mag = Math.pow(absZ / 2, nu)
    const arg = nu * Math.atan2(z.im, z.re)
    powZ = cplx(mag * Math.cos(arg), mag * Math.sin(arg))
  }
  let sum = cplx(0, 0)
  const MAX_K = 200
  for (let k = 0; k < MAX_K; k++) {
    if (k > 0) {
      // term *= z2over4 / (k * (nu + k))
      const denom = k * (nu + k)
      term = cDiv(cMul(term, z2over4), cplx(denom, 0))
    }
    sum = cAdd(sum, term)
    if (cAbs(term) < 1e-16 * cAbs(sum)) break
  }
  return cMul(powZ, sum)
}

// ── Brent 求根（对应 scipy.optimize.brentq）────────────────────────

export interface BrentqResult {
  root: number
  iterations: number
}

/**
 * 在 [a, b] 内求 f(x)=0 的根。要求 f(a)·f(b) ≤ 0。
 * 复刻 scipy brentq 的收敛判据（xtol/rtol）与逆二次插值+Bisection 混合。
 */
export function brentq(
  f: (x: number) => number,
  a: number,
  b: number,
  xtol = 1e-8,
  rtol = 1e-11,
  maxIter = 100,
): BrentqResult {
  let fa = f(a)
  let fb = f(b)
  if (fa === 0) return { root: a, iterations: 0 }
  if (fb === 0) return { root: b, iterations: 0 }
  if (fa * fb > 0) {
    throw new Error(`brentq: f(a) and f(b) must have opposite signs (fa=${fa}, fb=${fb})`)
  }

  let c = a
  let fc = fa
  let d = b - a
  let e = d

  for (let iter = 0; iter < maxIter; iter++) {
    if (fb * fc > 0) {
      c = a
      fc = fa
      d = b - a
      e = d
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b
      b = c
      c = a
      fa = fb
      fb = fc
      fc = fa
    }

    const tol1 = 2 * Number.EPSILON * Math.abs(b) + 0.5 * xtol
    const xm = 0.5 * (c - b)
    if (Math.abs(xm) <= tol1 || fb === 0) {
      return { root: b, iterations: iter }
    }

    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      // 尝试逆二次插值（IQI）
      let s = fb / fa
      let p: number
      let q: number
      if (a === c) {
        // 割线法
        p = 2 * xm * s
        q = 1 - s
      } else {
        // IQI
        q = fa / fc
        const r = fb / fc
        p = s * (2 * xm * q * (q - r) - (b - a) * (r - 1))
        q = (q - 1) * (r - 1) * (s - 1)
      }
      if (p > 0) q = -q
      p = Math.abs(p)
      const min1 = 3 * xm * q - Math.abs(tol1 * q)
      const min2 = Math.abs(e * q)
      if (2 * p < Math.min(min1, min2)) {
        e = d
        d = p / q
      } else {
        d = xm
        e = d
      }
    } else {
      d = xm
      e = d
    }

    a = b
    fa = fb
    if (Math.abs(d) > tol1) {
      b += d
    } else {
      b += xm >= 0 ? Math.abs(tol1) : -Math.abs(tol1)
    }
    fb = f(b)
  }
  throw new Error('brentq: max iterations reached without convergence')
}

// ── FFT（radix-2 实数输入的 rfft 等价）─────────────────────────────

function fftComplex(input: Complex[]): Complex[] {
  const n = input.length
  if (n === 1) return [input[0]!]
  if (n % 2 !== 0) throw new Error('fft: length must be a power of two')
  const even = new Array<Complex>(n / 2)
  const odd = new Array<Complex>(n / 2)
  for (let i = 0; i < n / 2; i++) {
    even[i] = input[2 * i]!
    odd[i] = input[2 * i + 1]!
  }
  const evenOut = fftComplex(even)
  const oddOut = fftComplex(odd)
  const out = new Array<Complex>(n)
  for (let k = 0; k < n / 2; k++) {
    const angle = (-2 * Math.PI * k) / n
    const tw = cplx(Math.cos(angle), Math.sin(angle))
    const t = cMul(tw, oddOut[k]!)
    out[k] = cAdd(evenOut[k]!, t)
    out[k + n / 2] = cSub(evenOut[k]!, t)
  }
  return out
}

/**
 * 实数序列的 rfft（仅返回 0..N/2 个复数系数，非归一化）。
 * 等价 numpy.fft.rfft(values)。
 */
export function rfft(values: number[]): Complex[] {
  const n = values.length
  if (n === 1) return [{ re: values[0]!, im: 0 }]
  const full = fftComplex(values.map(v => cplx(v, 0)))
  return full.slice(0, Math.floor(n / 2) + 1)
}

// ── numpy 数组工具 ─────────────────────────────────────────────────

/** np.geomspace(a, b, n)：对数等距 */
export function geomspace(start: number, stop: number, n: number): number[] {
  if (n < 2) return [start]
  const ratio = Math.pow(stop / start, 1 / (n - 1))
  const out: number[] = []
  let v = start
  for (let i = 0; i < n; i++) {
    out.push(v)
    v *= ratio
  }
  out[n - 1] = stop
  return out
}

/** np.roll：向右滚动 */
export function roll<T>(arr: T[], shift: number): T[] {
  const n = arr.length
  if (n === 0) return []
  const s = ((shift % n) + n) % n
  return arr.slice(n - s).concat(arr.slice(0, n - s))
}

export function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  let s = 0
  for (const v of arr) s += v
  return s / arr.length
}

export function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]!
  return (sorted[mid - 1]! + sorted[mid]!) / 2
}

export function maxAbs(arr: number[]): number {
  let m = 0
  for (const v of arr) m = Math.max(m, Math.abs(v))
  return m
}
