/**
 * ASCII Bode 图渲染：把开环频响画成字符图（幅频 + 相频），
 * 供文本对话直接展示（无需图片渲染）。
 */

export interface AsciiBodeOptions {
  /** 画布宽度（字符），默认 64 */
  width?: number
  /** 画布高度（行），默认 13 */
  height?: number
  /** 采样点数（对数均匀），默认 60 */
  samples?: number
  /** 标注穿越频率/相位裕度（可选） */
  fcHz?: number
  phaseMarginDeg?: number
  gainMarginDb?: number
}

/** 采样对数均匀频率点的频响（幅值 dB + 相位°，已 unwrap） */
export function sampleBode(
  frequenciesHz: number[],
  responses: { re: number; im: number }[],
  samples = 60,
): { freqs: number[]; magDb: number[]; phaseDeg: number[] } {
  const n = responses.length
  if (n < 2) return { freqs: [], magDb: [], phaseDeg: [] }
  const out: { freqs: number[]; magDb: number[]; phaseDeg: number[] } = { freqs: [], magDb: [], phaseDeg: [] }
  // 对数均匀索引
  for (let s = 0; s < samples; s++) {
    const frac = s / (samples - 1)
    const idx = Math.round(frac * (n - 1))
    const v = responses[idx]!
    const f = frequenciesHz[idx]!
    out.freqs.push(f)
    out.magDb.push(20 * Math.log10(Math.max(Math.hypot(v.re, v.im), 1e-300)))
    out.phaseDeg.push(Math.atan2(v.im, v.re) * 180 / Math.PI)
  }
  // 相位 unwrap
  out.phaseDeg = unwrapDeg(out.phaseDeg)
  return out
}

export function unwrapDeg(phase: number[]): number[] {
  const out = [...phase]
  let offset = 0
  for (let i = 1; i < out.length; i++) {
    // numpy.unwrap 语义：用原始值两两比较，偏移只累积在输出上
    const d = phase[i]! - phase[i - 1]!
    if (d > 180) offset -= 360
    else if (d < -180) offset += 360
    out[i] = phase[i]! + offset
  }
  return out
}

/** 渲染单条曲线的 ASCII 图 */
function renderCurve(
  xs: number[], ys: number[], yMin: number, yMax: number,
  opts: { width: number; height: number; label: string; yUnit: string; xTicks: string[] },
): string {
  const { width, height } = opts
  const plotW = width - 8 // 左侧留 y 轴刻度
  const plotH = height - 2 // 底部留 x 轴刻度

  // 建立字符网格
  const grid: string[][] = Array.from({ length: plotH }, () => new Array<string>(plotW).fill(' '))
  const ySpan = yMax - yMin
  const colOf = (x: number) => {
    const xMin = Math.log10(xs[0]!)
    const xMax = Math.log10(xs[xs.length - 1]!)
    return Math.round(((Math.log10(x) - xMin) / (xMax - xMin)) * (plotW - 1))
  }
  const rowOf = (y: number) => Math.round(((yMax - y) / ySpan) * (plotH - 1))

  // 关键参考线
  const drawLine = (y: number, ch: string) => {
    const r = rowOf(y)
    if (r >= 0 && r < plotH) for (let c = 0; c < plotW; c++) grid[r]![c] = ch
  }
  drawLine(0, '·') // 0dB / 0° 参考线
  if (opts.label === 'Phase (deg)') drawLine(-180, '·')

  // 曲线
  for (let i = 0; i < xs.length; i++) {
    const c = colOf(xs[i]!)
    let r = rowOf(ys[i]!)
    r = Math.max(0, Math.min(plotH - 1, r))
    if (grid[r]![c] === '·') grid[r]![c] = '×'
    else grid[r]![c] = '*'
  }

  // 组装行
  const lines: string[] = []
  for (let r = 0; r < plotH; r++) {
    const yVal = yMax - (r / (plotH - 1)) * ySpan
    const tick = r % Math.max(1, Math.floor(plotH / 4)) === 0 || r === plotH - 1
      ? yVal.toFixed(0).padStart(6)
      : '      '
    lines.push(`${tick} ${grid[r]!.join('')}`)
  }
  // x 轴刻度
  lines.push('       ' + '-'.repeat(plotW))
  lines.push(`       ${opts.xTicks[0]!.padEnd(20)}${opts.xTicks[1]!.padEnd(20)}${opts.xTicks[2]!}`)
  lines.push(`${opts.label}（${opts.yUnit}）  x 轴: 频率 (Hz, 对数)`)
  return lines.join('\n')
}

/** 渲染完整 ASCII Bode 图（幅频 + 相频） */
export function renderAsciiBode(
  frequenciesHz: number[],
  responses: { re: number; im: number }[],
  options: AsciiBodeOptions = {},
): string {
  const width = options.width ?? 64
  const height = options.height ?? 13
  const samples = options.samples ?? 60
  const bode = sampleBode(frequenciesHz, responses, samples)
  if (bode.freqs.length < 2) return '(Bode 数据不足)'

  // 幅值范围：-60..+20dB 或数据范围
  const magMax = Math.max(...bode.magDb)
  const magMin = Math.min(...bode.magDb)
  const yMaxM = Math.min(30, Math.ceil(magMax / 10) * 10 + 10)
  const yMinM = Math.max(-80, Math.floor(magMin / 10) * 10 - 10)
  const yMaxP = Math.ceil(Math.max(...bode.phaseDeg) / 90) * 90
  const yMinP = Math.floor(Math.min(...bode.phaseDeg) / 90) * 90

  const fMin = bode.freqs[0]!
  const fMax = bode.freqs[bode.freqs.length - 1]!
  const xTicks = [fmtFreq(fMin), fmtFreq(Math.sqrt(fMin * fMax)), fmtFreq(fMax)]

  const magFig = renderCurve(bode.freqs, bode.magDb, yMinM, yMaxM, {
    width, height, label: 'Magnitude', yUnit: 'dB', xTicks,
  })
  const phaseFig = renderCurve(bode.freqs, bode.phaseDeg, yMinP, yMaxP, {
    width, height, label: 'Phase', yUnit: 'deg', xTicks,
  })

  const header: string[] = ['```text', 'Open-Loop Bode (nominal delay)', '='.repeat(width)]
  if (options.fcHz) header.push(`  fc = ${fmtFreq(options.fcHz)}   PM = ${options.phaseMarginDeg?.toFixed(1) ?? '-'}°   GM = ${options.gainMarginDb?.toFixed(1) ?? '-'} dB`)
  return [...header, '', magFig, '', phaseFig, '```'].join('\n')
}

function fmtFreq(f: number): string {
  if (f >= 1e3) return `${(f / 1e3).toFixed(1)}k`
  if (f >= 1) return f.toFixed(0)
  return f.toExponential(1)
}
