// 像素風轉盤：canvas 用低解析度一格一格算顏色，再用 image-rendering: pixelated 放大
// 轉動不是旋轉整張圖（像素會變成斜的菱形），而是每一幀照新的角度重畫，像素永遠是正的
// 站名每個字都是正的，沿著半徑由外往內排，轉到哪個角度都讀得懂

import { mod } from './wheel'

export interface WheelItem {
  label: string
  color: string
}

export type HubState = 'ready' | 'pressed' | 'disabled'

// 每個像素到圓心的距離、角度（0 度在正上方、順時針），尺寸不變就不用重算
export interface Geometry {
  size: number
  radius: Float32Array
  angle: Float32Array
}

export const FONT = '12px Cubic11'
const GLYPH = 12
const DEG = Math.PI / 180

const COLORS = {
  ink: '#1b1b2f',
  ballast: '#4a4e5a',
  ballastDark: '#3a3d48',
  sleeper: '#8a5a32',
  rail: '#d8dde6',
  hub: '#e63946',
  hubLight: '#ff8a93',
  hubDark: '#a4161a',
  hubOff: '#7a7d96',
  hubOffLight: '#a3a6c4',
  hubOffDark: '#55587a',
  highlight: '#ffd23f',
  highlightLight: '#ffe58a',
  text: '#fff7e3',
  textShadow: '#1b1b2f',
  highlightText: '#1b1b2f',
  highlightShadow: '#e0a91a',
}

export function radii(size: number) {
  const outer = size / 2 - 1
  return { outer, slices: outer * 0.885, hub: outer * 0.3 }
}

export function makeGeometry(size: number): Geometry {
  const radius = new Float32Array(size * size)
  const angle = new Float32Array(size * size)
  const center = size / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - center
      const dy = y + 0.5 - center
      const i = y * size + x
      radius[i] = Math.hypot(dx, dy)
      angle[i] = mod(Math.atan2(dx, -dy) / DEG, 360)
    }
  }
  return { size, radius, angle }
}

// ImageData 的 Uint32 是 little-endian：0xAABBGGRR
const packed = new Map<string, number>()
function pack(hex: string): number {
  let value = packed.get(hex)
  if (value === undefined) {
    const n = parseInt(hex.slice(1), 16)
    value = ((0xff << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0
    packed.set(hex, value)
  }
  return value
}

// 跟白色混一點，當格子外緣的亮邊
function lighten(hex: string, amount = 0.28): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  const rgb = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff].map(mix)
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

// ---------- 字 ----------

interface Glyph {
  canvas: HTMLCanvasElement
  width: number
  height: number
}

const glyphs = new Map<string, Glyph>()

// 字型載入後要清掉，不然會留著用備用字型畫的字
export function clearGlyphCache() {
  glyphs.clear()
}

// 先用 12px 畫一次、透明度切成全有或全無，再照倍數放大，加上右下一格的陰影
function glyph(char: string, scale: number, color: string, shadow: string): Glyph {
  const key = `${char}|${scale}|${color}`
  const cached = glyphs.get(key)
  if (cached) return cached

  const box = 16
  const probe = document.createElement('canvas')
  probe.width = box
  probe.height = box
  const pctx = probe.getContext('2d', { willReadFrequently: true })
  if (!pctx) throw new Error('canvas 2d 不支援')
  pctx.font = FONT
  pctx.textBaseline = 'alphabetic'
  pctx.fillText(char, 1, 12)
  const data = pctx.getImageData(0, 0, box, box).data

  const cells: [number, number][] = []
  let minX = box
  let minY = box
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < box; y++) {
    for (let x = 0; x < box; x++) {
      if (data[(y * box + x) * 4 + 3] < 128) continue
      cells.push([x, y])
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  if (cells.length === 0) {
    minX = minY = 0
    maxX = maxY = GLYPH - 1
  }

  const width = (maxX - minX + 1) * scale + 1
  const height = (maxY - minY + 1) * scale + 1
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d 不支援')
  for (const [fill, offset] of [
    [shadow, 1],
    [color, 0],
  ] as const) {
    ctx.fillStyle = fill
    for (const [x, y] of cells) {
      ctx.fillRect((x - minX) * scale + offset, (y - minY) * scale + offset, scale, scale)
    }
  }

  const result = { canvas, width, height }
  glyphs.set(key, result)
  return result
}

const LABEL_PAD = 2

// 格子少、字放得下就用兩倍大的字
export function glyphScale(items: readonly WheelItem[], size: number): 1 | 2 {
  const { slices, hub } = radii(size)
  const longest = Math.max(1, ...items.map((item) => [...item.label].length))
  for (const scale of [2, 1] as const) {
    const step = GLYPH * scale + scale
    const inner = slices - LABEL_PAD - (longest - 0.5) * step
    const fitsRadius = inner - (GLYPH * scale) / 2 >= hub + 2
    const fitsArc = (2 * Math.PI * inner) / items.length >= GLYPH * scale + 1
    if (fitsRadius && fitsArc) return scale
  }
  return 1
}

// ---------- 整張轉盤 ----------

export function paintWheel(
  ctx: CanvasRenderingContext2D,
  geo: Geometry,
  items: readonly WheelItem[],
  rotation: number,
  highlight: number | null,
  hubState: HubState,
) {
  const { size, radius, angle } = geo
  const { outer, slices, hub } = radii(size)
  const count = items.length
  const sliceDeg = 360 / Math.max(1, count)
  const trackWidth = outer - slices
  const rails = [slices + trackWidth * 0.32, slices + trackWidth * 0.72]
  // 枕木大約每 6 格像素一根
  const ties = Math.max(24, Math.round((2 * Math.PI * outer) / 6))
  const tieDeg = 360 / ties

  const c = {
    ink: pack(COLORS.ink),
    ballast: pack(COLORS.ballast),
    ballastDark: pack(COLORS.ballastDark),
    sleeper: pack(COLORS.sleeper),
    rail: pack(COLORS.rail),
  }
  const off = hubState === 'disabled'
  const hubFace = pack(off ? COLORS.hubOff : COLORS.hub)
  const hubLight = pack(off ? COLORS.hubOffLight : COLORS.hubLight)
  const hubDark = pack(off ? COLORS.hubOffDark : COLORS.hubDark)
  // 按下去時亮邊和暗邊對調，看起來像凹下去
  const [hubTop, hubBottom] = hubState === 'pressed' ? [hubDark, hubLight] : [hubLight, hubDark]
  const fills = items.map((item, i) => pack(i === highlight ? COLORS.highlight : item.color))
  const edges = items.map((item, i) => pack(i === highlight ? COLORS.highlightLight : lighten(item.color)))

  const image = ctx.createImageData(size, size)
  const pixels = new Uint32Array(image.data.buffer)
  const center = size / 2

  for (let i = 0; i < pixels.length; i++) {
    const r = radius[i]
    if (r > outer + 0.5) continue
    if (r > outer - 0.5) {
      pixels[i] = c.ink
      continue
    }

    if (r > slices + 0.5) {
      const a = mod(angle[i] - rotation, 360)
      if (Math.abs(r - rails[0]) < 0.6 || Math.abs(r - rails[1]) < 0.6) pixels[i] = c.rail
      else if (mod(a, tieDeg) / tieDeg < 0.4) pixels[i] = c.sleeper
      else pixels[i] = ((i % size) + Math.floor(i / size)) % 2 === 0 ? c.ballast : c.ballastDark
      continue
    }
    if (r > slices - 0.5) {
      pixels[i] = c.ink
      continue
    }

    if (r > hub + 0.5) {
      if (count === 0) {
        pixels[i] = c.ballastDark
        continue
      }
      const a = mod(angle[i] - rotation, 360)
      const slice = Math.min(count - 1, Math.floor(a / sliceDeg))
      const fromEdge = Math.min(a - slice * sliceDeg, (slice + 1) * sliceDeg - a) * DEG * r
      if (count > 1 && fromEdge < 0.5) pixels[i] = c.ink
      else pixels[i] = r > slices - 2.5 ? edges[slice] : fills[slice]
      continue
    }
    if (r > hub - 0.5) {
      pixels[i] = c.ink
      continue
    }

    // 中間的發車鈕：左上亮邊、右下暗邊
    const dx = (i % size) + 0.5 - center
    const dy = Math.floor(i / size) + 0.5 - center
    if (r > hub - 3.5 && dx + dy < -hub * 0.35) pixels[i] = hubTop
    else if (r > hub - 3.5 && dx + dy > hub * 0.35) pixels[i] = hubBottom
    else pixels[i] = hubFace
  }
  ctx.putImageData(image, 0, 0)

  if (count === 0) return
  const scale = glyphScale(items, size)
  const step = GLYPH * scale + scale
  items.forEach((item, i) => {
    const theta = ((i + 0.5) * sliceDeg + rotation) * DEG
    const sin = Math.sin(theta)
    const cos = Math.cos(theta)
    const lit = i === highlight
    const chars = [...item.label]
    // 由外往內排的方向是往右或往下才順著讀；往左或往上（轉盤右半邊、下面）就反過來從內圈排起
    const outerFirst = cos - sin >= 0
    chars.forEach((char, k) => {
      const g = glyph(
        char,
        scale,
        lit ? COLORS.highlightText : COLORS.text,
        lit ? COLORS.highlightShadow : COLORS.textShadow,
      )
      const slot = outerFirst ? k : chars.length - 1 - k
      const r = slices - LABEL_PAD - (slot + 0.5) * step
      const x = Math.round(center + r * sin - g.width / 2)
      const y = Math.round(center - r * cos - g.height / 2)
      ctx.drawImage(g.canvas, x, y)
    })
  })
}
