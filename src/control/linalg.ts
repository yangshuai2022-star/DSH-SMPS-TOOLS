/**
 * 数值线性代数内核（numpy/scipy 核心函数的 TS 移植）
 *
 * 覆盖本插件数字环路移植所需的全部基础运算：
 *   - 矩阵运算（乘/加/转置/求逆/向量乘）
 *   - expm（矩阵指数，缩放平方法 + Padé/Taylor）
 *   - eigvals（Hessenberg + 带位移 QR 迭代，实数/复特征值）
 *   - roots（companion 矩阵 + eigvals，对应 np.roots）
 *   - polyval / convolve / poly
 *   - np 工具：sinc / unwrap / interp / searchsorted / pad
 */

export type Mat = number[][]

// ── 基础矩阵运算 ───────────────────────────────────────────────────

export function matMul(a: Mat, b: Mat): Mat {
  const m = a.length
  const n = b[0]!.length
  const p = b.length
  if (a[0]!.length !== p) throw new Error('matMul: dimension mismatch')
  const out: Mat = Array.from({ length: m }, () => new Array<number>(n).fill(0))
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0
      for (let k = 0; k < p; k++) s += a[i]![k]! * b[k]![j]!
      out[i]![j] = s
    }
  }
  return out
}

export function matAdd(a: Mat, b: Mat): Mat {
  return a.map((row, i) => row.map((v, j) => v + b[i]![j]!))
}

export function matScale(a: Mat, s: number): Mat {
  return a.map(row => row.map(v => v * s))
}

export function matTranspose(a: Mat): Mat {
  const n = a.length
  const m = a[0]!.length
  return Array.from({ length: m }, (_, j) => Array.from({ length: n }, (_, i) => a[i]![j]!))
}

export function matIdentity(n: number): Mat {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)))
}

/** 高斯消元求逆；奇异时返回 null */
export function matInv(a: Mat): Mat | null {
  const n = a.length
  const aug: Mat = a.map((row, i) => [...row, ...matIdentity(n)[i]!])
  for (let col = 0; col < n; col++) {
    // 选主元
    let pivot = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row]![col]!) > Math.abs(aug[pivot]![col]!)) pivot = row
    }
    if (Math.abs(aug[pivot]![col]!) < 1e-15) return null
    ;[aug[col], aug[pivot]] = [aug[pivot]!, aug[col]!]
    const d = aug[col]![col]!
    for (let j = 0; j < 2 * n; j++) aug[col]![j] = aug[col]![j]! / d
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const f = aug[row]![col]!
      if (f === 0) continue
      for (let j = 0; j < 2 * n; j++) aug[row]![j] = aug[row]![j]! - f * aug[col]![j]!
    }
  }
  return aug.map(row => row.slice(n))
}

export function matVec(a: Mat, v: number[]): number[] {
  return a.map(row => row.reduce((acc, val, j) => acc + val * v[j]!, 0))
}

/** 解线性方程组 A·x = b（高斯消元）；奇异返回 null */
export function solveLinear(a: Mat, b: number[]): number[] | null {
  const n = a.length
  const aug: Mat = a.map((row, i) => [...row, b[i]!])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row]![col]!) > Math.abs(aug[pivot]![col]!)) pivot = row
    }
    if (Math.abs(aug[pivot]![col]!) < 1e-18) return null
    ;[aug[col], aug[pivot]] = [aug[pivot]!, aug[col]!]
    const d = aug[col]![col]!
    for (let j = col; j <= n; j++) aug[col]![j] = aug[col]![j]! / d
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const f = aug[row]![col]!
      if (f === 0) continue
      for (let j = col; j <= n; j++) aug[row]![j] = aug[row]![j]! - f * aug[col]![j]!
    }
  }
  return aug.map(row => row[n]!)
}

/** 矩阵 1-范数（最大绝对列和） */
export function matNorm1(a: Mat): number {
  let max = 0
  for (let j = 0; j < a[0]!.length; j++) {
    let s = 0
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i]![j]!)
    if (s > max) max = s
  }
  return max
}

// ── 矩阵指数 expm（Taylor + scaling-and-squaring）──────────────────

const EXPM_TAYLOR_ORDER = 16

export function expm(a: Mat): Mat {
  const n = a.length
  const norm = matNorm1(a)
  const s = Math.max(0, Math.ceil(Math.log2(norm / 0.5)))
  const scaled = matScale(a, 1 / 2 ** s)
  // Taylor 级数
  let term = matIdentity(n)
  let sum = matIdentity(n)
  for (let k = 1; k <= EXPM_TAYLOR_ORDER; k++) {
    term = matScale(matMul(term, scaled), 1 / k)
    sum = matAdd(sum, term)
    if (matNorm1(term) < 1e-18 * matNorm1(sum)) break
  }
  let result = sum
  for (let i = 0; i < s; i++) result = matMul(result, result)
  return result
}

// ── 特征值：Hessenberg + 带位移 QR 迭代 ────────────────────────────

/** Householder 约化到上 Hessenberg（原地，返回约化矩阵） */
function hessenberg(a: Mat): Mat {
  const n = a.length
  const h = a.map(row => [...row])
  for (let k = 0; k < n - 2; k++) {
    let norm = 0
    for (let i = k + 1; i < n; i++) norm += h[i]![k]! * h[i]![k]!
    norm = Math.sqrt(norm)
    if (norm < 1e-300) continue
    // Householder 向量（符号使 v[k+1] 抵消）
    let alpha = h[k + 1]![k]!
    if (alpha >= 0) norm = -norm
    const v: number[] = new Array(n).fill(0)
    for (let i = k + 1; i < n; i++) v[i] = h[i]![k]!
    v[k + 1]! -= norm
    let vnorm = 0
    for (let i = k + 1; i < n; i++) vnorm += v[i]! * v[i]!
    vnorm = Math.sqrt(vnorm)
    if (vnorm < 1e-300) continue
    for (let i = k + 1; i < n; i++) v[i] = v[i]! / vnorm
    // 非对称 Householder：H·A·H，H = I - 2·v·vᵀ（||v||=1）
    // 左乘 wL[j] = (vᵀA)[j]；右乘 wR[i] = (Av)[i]
    const wL: number[] = new Array(n).fill(0)
    for (let j = 0; j < n; j++) {
      let s = 0
      for (let i = k + 1; i < n; i++) s += v[i]! * h[i]![j]!
      wL[j] = s
    }
    const wR: number[] = new Array(n).fill(0)
    for (let i = 0; i < n; i++) {
      let s = 0
      for (let j = k + 1; j < n; j++) s += h[i]![j]! * v[j]!
      wR[i] = s
    }
    let p = 0
    for (let i = k + 1; i < n; i++) p += v[i]! * wR[i]!
    // A' = A - 2·v·wLᵀ - 2·wR·vᵀ + 4·p·v·vᵀ
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        h[i]![j] = h[i]![j]!
          - 2 * (v[i] ?? 0) * wL[j]!
          - 2 * wR[i]! * (v[j] ?? 0)
          + 4 * p * (v[i] ?? 0) * (v[j] ?? 0)
      }
    }
  }
  return h
}

/** 2x2 矩阵特征值（可能复） */
function eig2(a00: number, a01: number, a10: number, a11: number): Complex2[] {
  const tr = a00 + a11
  const det = a00 * a11 - a01 * a10
  const disc = tr * tr - 4 * det
  if (disc >= 0) {
    const sq = Math.sqrt(disc)
    return [{ re: (tr + sq) / 2, im: 0 }, { re: (tr - sq) / 2, im: 0 }]
  }
  const sq = Math.sqrt(-disc) / 2
  return [{ re: tr / 2, im: sq }, { re: tr / 2, im: -sq }]
}

export interface Complex2 {
  re: number
  im: number
}

/** 实矩阵特征值（QR 迭代；处理复共轭对） */
export function eigvals(a: Mat): Complex2[] {
  const n = a.length
  if (n === 0) return []
  if (n === 1) return [{ re: a[0]![0]!, im: 0 }]
  if (n === 2) return eig2(a[0]![0]!, a[0]![1]!, a[1]![0]!, a[1]![1]!)
  let h = hessenberg(a)
  const results: Complex2[] = []
  let m = n
  let iter = 0
  const maxIter = 100 * n

  while (m > 1) {
    iter++
    if (iter > maxIter) {
      // 保底：返回剩余对角元（带警告语义，调用方判断）
      for (let i = 0; i < m; i++) results.push({ re: h[i]![i]!, im: 0 })
      return results
    }
    // 找尾部的不可约子块
    let p = m - 1
    while (p > 0 && Math.abs(h[p]![p - 1]!) > 1e-13 * (Math.abs(h[p - 1]![p - 1]!) + Math.abs(h[p]![p]!))) p--
    if (p === m - 1) {
      // 尾元素已收敛（亚对角元 ≈ 0）
      results.push({ re: h[m - 1]![m - 1]!, im: 0 })
      m--
      continue
    }
    if (p === m - 2) {
      // 2x2 尾块 → 复共轭对
      const pair = eig2(h[p]![p]!, h[p]![p + 1]!, h[p + 1]![p]!, h[p + 1]![p + 1]!)
      results.push(...pair)
      m = p
      continue
    }
    // Wilkinson 位移：尾 2x2 块中更接近 h[m-1][m-1] 的特征值
    const a00 = h[m - 2]![m - 2]!
    const a01 = h[m - 2]![m - 1]!
    const a10 = h[m - 1]![m - 2]!
    const a11 = h[m - 1]![m - 1]!
    const tr = a00 + a11
    const det = a00 * a11 - a01 * a10
    const disc = tr * tr - 4 * det
    let mu: number
    if (disc >= 0) {
      const sq = Math.sqrt(disc)
      const l1 = (tr + sq) / 2
      const l2 = (tr - sq) / 2
      mu = Math.abs(l1 - a11) < Math.abs(l2 - a11) ? l1 : l2
    } else {
      mu = a11
    }
    // 单步位移 QR：A - μI = QR；A' = RQ + μI
    const shifted = h.map((row, i) => row.map((v, j) => (i === j ? v - mu : v)))
    const { q, r } = qrHessenberg(shifted, p, m)
    // A' = R·Q + μI（仅作用在子块 p..m-1）
    const newH = h.map(row => [...row])
    const size = m - p
    const rSub = r.slice(p, m).map(row => row.slice(p, m))
    const qSub = q.slice(p, m).map(row => row.slice(p, m))
    const rq = matMul(rSub, qSub)
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        let v = rq[i]![j]!
        if (i === j) v += mu
        newH[p + i]![p + j] = v
      }
    }
    h = newH
  }
  if (m === 1) results.push({ re: h[0]![0]!, im: 0 })
  return results
}

/**
 * Hessenberg 矩阵的 QR 分解（Givens 旋转，保持 Hessenberg 结构）。
 * 子块 [lo, hi)；q 为 n×n 正交累积，r 为全矩阵上三角（子块内）。
 */
function qrHessenberg(h: Mat, lo: number, hi: number): { q: Mat; r: Mat } {
  const n = h.length
  const r = h.map(row => [...row])
  const q = matIdentity(n)
  for (let k = lo; k < hi - 1; k++) {
    const a = r[k]![k]!
    const b = r[k + 1]![k]!
    const mag = Math.hypot(a, b)
    if (mag < 1e-300) continue
    let c: number
    let s: number
    if (a !== 0) {
      const rho = Math.sign(a) * mag
      c = a / rho
      s = b / rho
    } else {
      c = 0
      s = 1
    }
    // 旋转作用于 r 的行 k, k+1（列 k..hi-1）
    for (let j = k; j < hi; j++) {
      const t1 = r[k]![j]!
      const t2 = r[k + 1]![j]!
      r[k]![j] = c * t1 + s * t2
      r[k + 1]![j] = -s * t1 + c * t2
    }
    // 累积 Q：列 k, k+1（行 lo..hi-1）
    for (let i = lo; i < hi; i++) {
      const t1 = q[i]![k]!
      const t2 = q[i]![k + 1]!
      q[i]![k] = c * t1 + s * t2
      q[i]![k + 1] = -s * t1 + c * t2
    }
  }
  return { q, r }
}

// ── 多项式 ─────────────────────────────────────────────────────────

/** np.polyval：按最高次到最低次系数求值（Horner） */
export function polyval(coeffs: number[], x: number): number {
  let acc = 0
  for (const c of coeffs) acc = acc * x + c
  return acc
}

export function polyvalC(coeffs: number[], x: Complex2): Complex2 {
  let re = 0
  let im = 0
  for (const c of coeffs) {
    const nre = re * x.re - im * x.im + c
    const nim = re * x.im + im * x.re
    re = nre
    im = nim
  }
  return { re, im }
}

/** np.convolve：多项式卷积 */
export function convolve(a: number[], b: number[]): number[] {
  const out = new Array<number>(a.length + b.length - 1).fill(0)
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] = out[i + j]! + a[i]! * b[j]!
  }
  return out
}

/** np.poly(roots)：由根构造多项式系数（最高次在前） */
export function poly(roots: number[]): number[] {
  let coeffs: number[] = [1]
  for (const root of roots) {
    coeffs = convolve(coeffs, [1, -root])
  }
  return coeffs
}

/** np.pad 右侧补零到目标长度 */
export function padRight(a: number[], length: number): number[] {
  if (a.length >= length) return [...a]
  return [...a, ...new Array<number>(length - a.length).fill(0)]
}

/** np.pad 左侧补零到目标长度 */
export function padLeft(a: number[], length: number): number[] {
  if (a.length >= length) return [...a]
  return [...new Array<number>(length - a.length).fill(0), ...a]
}

/** 截断前导（接近零的）系数，返回从第一个有效系数开始的数组 */
export function trimLeadingZeros(a: number[], tolerance = 0): number[] {
  let first = 0
  while (first < a.length - 1 && Math.abs(a[first]!) <= tolerance) first++
  return a.slice(first)
}

/** np.roots：多项式求根（companion 矩阵 + eigvals） */
export function roots(coeffs: number[]): Complex2[] {
  // 去掉前导零
  const c = trimLeadingZeros(coeffs)
  if (c.length <= 1) return []
  const n = c.length - 1
  // 归一化
  const lead = c[0]!
  const norm = c.map(v => v / lead)
  // companion 矩阵（Frobenius）：第 n 列 = -升幂系数 [a0..a_{n-1}]/a_n；
  // 降幂数组 norm 的第 n-i 个元素即升幂 a_i
  const comp: Mat = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (j === n - 1) return -norm[n - i]!
      if (i === j + 1) return 1
      return 0
    }))
  return eigvals(comp)
}

// ── numpy 工具函数 ─────────────────────────────────────────────────

/** np.sinc：sinc(x) = sin(πx)/(πx) */
export function sinc(x: number): number {
  const px = Math.PI * x
  if (Math.abs(px) < 1e-12) return 1.0
  return Math.sin(px) / px
}

/** np.unwrap：沿轴解包相位（弧度） */
export function unwrap(phase: number[], discont = Math.PI): number[] {
  const out = [...phase]
  let offset = 0
  for (let i = 1; i < out.length; i++) {
    let d = out[i]! - out[i - 1]!
    if (d > discont) {
      d -= 2 * Math.PI
      offset -= 2 * Math.PI
    } else if (d < -discont) {
      d += 2 * Math.PI
      offset += 2 * Math.PI
    }
    out[i] = out[i]! + offset
  }
  return out
}

/** np.searchsorted（left） */
export function searchsorted(sorted: number[], value: number): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sorted[mid]! < value) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** np.interp：一维线性插值（x 升序） */
export function interp(x: number, xp: number[], fp: number[]): number {
  if (xp.length !== fp.length || xp.length === 0) throw new Error('interp: length mismatch')
  if (x <= xp[0]!) return fp[0]!
  if (x >= xp[xp.length - 1]!) return fp[fp.length - 1]!
  const idx = searchsorted(xp, x)
  // idx in [1, len-1]
  const x0 = xp[idx - 1]!
  const x1 = xp[idx]!
  const f0 = fp[idx - 1]!
  const f1 = fp[idx]!
  const t = (x - x0) / (x1 - x0)
  return f0 + t * (f1 - f0)
}

/** np.geomspace（在 numeric.ts 已有，转发） */
export { geomspace } from '../core/numeric.ts'
