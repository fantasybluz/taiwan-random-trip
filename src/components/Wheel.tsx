import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import {
  FONT,
  clearGlyphCache,
  makeGeometry,
  paintWheel,
  radii,
  type Geometry,
  type HubState,
  type WheelItem,
} from '../lib/pixelWheel'
import { easeOutCubic, rotationFor, sliceAt } from '../lib/wheel'

export interface WheelHandle {
  // 隨機轉到某一格，停下來後回傳第幾格
  spin: () => Promise<number>
}

interface WheelProps {
  items: readonly WheelItem[]
  // 轉到的那一格塗成黃色
  highlight: number | null
  // 指針換到另一格時呼叫；換一組項目時也會呼叫一次，這時 moving 是 false
  onPointerChange: (index: number, moving: boolean) => void
  // 中間的發車鈕
  hubLabel: string
  hubSub: string
  hubAriaLabel: string
  hubDisabled: boolean
  onHub: () => void
  ref?: Ref<WheelHandle>
}

interface Layout {
  // 轉盤寬幾個像素（畫布解析度）
  grid: number
  // 一個像素在畫面上是幾個 CSS px；乘上 devicePixelRatio 一定是整數，放大後每格才一樣大
  px: number
}

// 一個像素大約佔 2 個 CSS px
const PIXEL_CSS = 2

// 指針的像素圖：# 黑框、r 紅、w 亮點、d 暗紅；圖上一格放大成轉盤的 2×2 像素
const POINTER_SCALE = 2
const POINTER_COLORS: Record<string, string> = { '#': '#1b1b2f', r: '#e63946', w: '#ff8a93', d: '#a4161a' }
const POINTER = [
  '..#######..',
  '.#rrrrrrr#.',
  '#rwwrrrrrr#',
  '#rwrrrrrrd#',
  '#rrrrrrrdd#',
  '.#rrrrrdd#.',
  '..#rrrdd#..',
  '...#rdd#...',
  '....#d#....',
  '.....#.....',
]

function trackWidth(grid: number): number {
  const { outer, slices } = radii(grid)
  return outer - slices
}

function measure(width: number): Layout | null {
  const dpr = window.devicePixelRatio || 1
  const px = Math.max(1, Math.round(PIXEL_CSS * dpr)) / dpr
  const grid = Math.floor(width / px / 2) * 2
  return grid > 0 ? { grid, px } : null
}

export function Wheel(props: WheelProps) {
  const { items, highlight, onPointerChange, hubLabel, hubSub, hubAriaLabel, hubDisabled, onHub, ref } = props
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerRef = useRef<HTMLDivElement>(null)
  const geometry = useRef<Geometry | null>(null)
  const rotation = useRef(0)
  const pointing = useRef(-1)
  const frame = useRef(0)
  const lastBounce = useRef(0)
  const onPointer = useRef(onPointerChange)
  const paintRef = useRef(() => {})
  const [layout, setLayout] = useState<Layout | null>(null)
  const [fontVersion, setFontVersion] = useState(0)
  const [pressed, setPressed] = useState(false)
  const hubState: HubState = hubDisabled ? 'disabled' : pressed ? 'pressed' : 'ready'

  useEffect(() => {
    onPointer.current = onPointerChange
  })

  // 每次 render 都換成用最新 props 的版本，轉動中的動畫迴圈呼叫 paintRef 就會用到
  useEffect(() => {
    paintRef.current = () => {
      const canvas = canvasRef.current
      const geo = geometry.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !geo || !ctx) return
      paintWheel(ctx, geo, items, rotation.current, highlight, hubState)
    }
  })

  // 外框大小變了就重算解析度
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const update = () => {
      const next = measure(box.clientWidth)
      setLayout((prev) => (prev && next && prev.grid === next.grid && prev.px === next.px ? prev : next))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  // 像素字型載入前畫的字是備用字型，載好後清掉重畫
  useEffect(() => {
    let alive = true
    document.fonts.load(FONT).then(() => {
      if (!alive) return
      clearGlyphCache()
      setFontVersion((v) => v + 1)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!layout || !canvas) return
    if (geometry.current?.size !== layout.grid) {
      geometry.current = makeGeometry(layout.grid)
      canvas.width = layout.grid
      canvas.height = layout.grid
    }
    paintRef.current()
  }, [layout, items, highlight, hubState, fontVersion])

  useEffect(() => {
    pointing.current = sliceAt(rotation.current, items.length)
    onPointer.current(pointing.current, false)
  }, [items])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const px = layout?.px ?? PIXEL_CSS

  useImperativeHandle(
    ref,
    () => {
      const count = items.length

      // 指針換格時往上跳一下
      const bounce = () => {
        const now = performance.now()
        if (now - lastBounce.current < 60) return
        lastBounce.current = now
        pointerRef.current?.animate([{ transform: `translateY(${-POINTER_SCALE * px}px)` }, { transform: 'translateY(0)' }], {
          duration: 100,
          easing: 'steps(2, end)',
        })
      }

      const apply = (value: number) => {
        rotation.current = value
        paintRef.current()
        const index = sliceAt(value, count)
        if (index === pointing.current) return
        pointing.current = index
        onPointer.current(index, true)
        bounce()
      }

      return {
        spin: () =>
          new Promise<number>((resolve) => {
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            const index = Math.floor(Math.random() * count)
            const turns = reduceMotion ? 1 : 5 + Math.floor(Math.random() * 3)
            // 停在格子中段，不會壓在線上讓人看不出是哪一格
            const offset = 0.2 + Math.random() * 0.6
            const from = rotation.current
            const to = rotationFor(from, index, count, turns, offset)
            const duration = reduceMotion ? 1200 : 4800 + Math.random() * 800
            const start = performance.now()

            const step = (now: number) => {
              const t = Math.min(1, (now - start) / duration)
              apply(from + (to - from) * easeOutCubic(t))
              if (t < 1) frame.current = requestAnimationFrame(step)
              else resolve(index)
            }
            cancelAnimationFrame(frame.current)
            frame.current = requestAnimationFrame(step)
          }),
      }
    },
    [items, px],
  )

  const size = layout ? layout.grid * px : 0
  // 發車鈕蓋在畫布上的紅色圓上，大小跟著圓走
  const hubSize = layout ? Math.floor(radii(layout.grid).hub * 2) * px : 0
  // 指針尖端停在鐵軌內緣、剛好碰到格子
  const pointerTop = layout ? Math.round(trackWidth(layout.grid) - 2 - POINTER.length * POINTER_SCALE) * px : 0

  return (
    <div className="wheel" ref={boxRef}>
      <canvas className="wheel__disc" ref={canvasRef} aria-hidden="true" style={{ width: size, height: size }} />
      <div
        className="wheel__pointer"
        ref={pointerRef}
        aria-hidden="true"
        style={{ width: POINTER[0].length * POINTER_SCALE * px, top: pointerTop }}
      >
        <svg viewBox={`0 0 ${POINTER[0].length} ${POINTER.length}`} shapeRendering="crispEdges">
          {POINTER.flatMap((row, y) =>
            [...row].map((cell, x) =>
              cell === '.' ? null : (
                <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={POINTER_COLORS[cell]} />
              ),
            ),
          )}
        </svg>
      </div>
      <button
        type="button"
        className="wheel__hub"
        style={{ width: hubSize, height: hubSize }}
        disabled={hubDisabled}
        aria-label={hubAriaLabel}
        onClick={onHub}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
      >
        <span className="wheel__hub-label">{hubLabel}</span>
        <span className="wheel__hub-sub">{hubSub}</span>
      </button>
    </div>
  )
}
