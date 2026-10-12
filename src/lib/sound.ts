// 8-bit 方波音效：轉盤的喀喀聲、轉完一層的嗶嗶、到站的小樂句，用 Web Audio 即時合成，不需要音檔
import { readStore, writeStore } from './storage'

const SOUND_KEY = 'taiwan-random-trip-sound'
// 轉很快時每一格都響會糊成一片，至少隔這麼久才響下一聲
const TICK_GAP_MS = 45

let ctx: AudioContext | null = null
let enabled = readStore(SOUND_KEY, true)
let lastTick = 0
const listeners = new Set<() => void>()

function context(): AudioContext | null {
  if (!ctx) {
    const AudioCtx =
      window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return null
    ctx = new AudioCtx()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, duration: number, delay = 0, volume = 0.05, type: OscillatorType = 'square') {
  if (!enabled) return
  const c = context()
  if (!c) return
  const start = c.currentTime + delay
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(start)
  osc.stop(start + duration)
}

export const sound = {
  isEnabled: () => enabled,
  // 給 useSyncExternalStore 用，開關音效時通知畫面更新
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  toggle() {
    enabled = !enabled
    writeStore(SOUND_KEY, enabled)
    listeners.forEach((listener) => listener())
  },
  // 瀏覽器要在使用者點擊時才允許出聲，按發車時先叫一次
  unlock() {
    if (enabled) context()
  },
  tick() {
    const now = performance.now()
    if (now - lastTick < TICK_GAP_MS) return
    lastTick = now
    tone(1600, 0.025, 0, 0.025)
  },
  // 轉完一層
  step() {
    tone(660, 0.08)
    tone(990, 0.14, 0.08)
  },
  // 轉到車站：Do Mi Sol Do 的到站小樂句
  arrive() {
    ;[523, 659, 784].forEach((freq, i) => tone(freq, 0.1, i * 0.1))
    tone(1047, 0.45, 0.3, 0.06)
  },
}
