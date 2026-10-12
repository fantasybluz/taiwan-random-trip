import { useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { Board } from './components/Board'
import { Picker, type PickerOption } from './components/Picker'
import { ResultCard } from './components/ResultCard'
import { Steps } from './components/Steps'
import { Wheel, type WheelHandle } from './components/Wheel'
import { LEVELS, REGIONS, UPDATED_AT, stationsIn, type Region } from './data/stations'
import type { WheelItem } from './lib/pixelWheel'
import { sound } from './lib/sound'
import { shadeOf } from './lib/wheel'

// 每一層轉完先停一下讓人看清楚，再換下一層的轉盤
const LANDED_PAUSE_MS = 1000
// 一次轉到底時，新轉盤出現後等一下再開始轉
const NEXT_WHEEL_PAUSE_MS = 600

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

// path 是每一層選到第幾個：[地區, 縣市, 車站]，長度就是已經選到第幾層
function resolve(path: readonly number[]) {
  const region = path.length > 0 ? REGIONS[path[0]] : null
  const county = region && path.length > 1 ? region.counties[path[1]] : null
  const stations = county ? stationsIn(county) : []
  const station = path.length > 2 ? stations[path[2]] : null
  return { region, county, stations, station }
}

function wheelItems(region: Region | null, county: string | null): WheelItem[] {
  if (!region) return REGIONS.map((r) => ({ label: r.name, color: r.colors[0] }))
  const labels = county ? stationsIn(county).map((s) => s.name) : region.counties
  return labels.map((label, i) => ({ label, color: region.colors[shadeOf(i, labels.length)] }))
}

function pickerOptions(region: Region | null): PickerOption[] {
  const countOf = (county: string) => stationsIn(county).length
  if (!region) {
    return REGIONS.map((r) => ({ label: r.name, count: r.counties.reduce((sum, c) => sum + countOf(c), 0) }))
  }
  return region.counties.map((county) => ({ label: county, count: countOf(county) }))
}

export function App() {
  const wheelRef = useRef<WheelHandle>(null)
  const stageRef = useRef<HTMLElement>(null)
  const ticketRef = useRef<HTMLDivElement>(null)
  const [path, setPath] = useState<readonly number[]>([])
  const [spinning, setSpinning] = useState(false)
  // 轉完、還沒換到下一層之前，轉到的那格先亮著
  const [landed, setLanded] = useState<number | null>(null)
  const [pointer, setPointer] = useState(0)
  const [announce, setAnnounce] = useState('')
  const soundOn = useSyncExternalStore(sound.subscribe, sound.isEnabled)

  const { region, county, stations, station } = resolve(path)
  const level = Math.min(path.length, 2)
  const items = useMemo(() => wheelItems(region, county), [region, county])
  const options = useMemo(() => pickerOptions(region), [region])

  // 從 start 這條路徑開始轉；all 是一路轉到車站，不然只轉一層
  async function spin(start: readonly number[], all: boolean) {
    if (spinning) return
    sound.unlock()
    stageRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' })
    let current = start
    flushSync(() => {
      setSpinning(true)
      setLanded(null)
      setPath(current)
    })

    for (;;) {
      const wheel = wheelRef.current
      if (!wheel) break
      const index = await wheel.spin()
      current = [...current, index]
      const picked = resolve(current)
      setLanded(index)

      if (picked.station) {
        flushSync(() => setPath(current))
        setAnnounce(`抵達：${picked.station.name}（${picked.station.county}）`)
        sound.arrive()
        ticketRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' })
        break
      }

      setAnnounce(`${LEVELS[current.length - 1]}：${picked.county ?? picked.region?.name}`)
      sound.step()
      await sleep(LANDED_PAUSE_MS)
      // 馬上換成下一層的轉盤，下一圈迴圈拿到的 wheelRef 才是新的
      flushSync(() => {
        setPath(current)
        setLanded(null)
      })
      if (!all) break
      await sleep(NEXT_WHEEL_PAUSE_MS)
    }
    setSpinning(false)
  }

  function pick(index: number) {
    sound.unlock()
    sound.step()
    setLanded(null)
    setPath([...path, index])
  }

  function goBack(to: number) {
    setLanded(null)
    setPath(path.slice(0, to))
  }

  function handlePointer(index: number, moving: boolean) {
    setPointer(index)
    if (moving) sound.tick()
  }

  const prompts = ['先決定去哪個地區？', `${region?.name}的哪個縣市？`, `${county}的哪一站？`]
  const board = station
    ? { caption: '本次旅行目的地', text: station.name, sub: station.ename, waiting: false }
    : spinning
      ? {
          caption: `${level + 1}／3・轉${LEVELS[level]}`,
          text: items[pointer]?.label ?? '',
          sub: stations[pointer]?.ename,
          waiting: false,
        }
      : { caption: `${level + 1}／3・${LEVELS[level]}`, text: prompts[level], waiting: true }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="header__title">台灣隨機旅行</h1>
          <p className="header__tagline">地區 → 縣市 → 區間車站，轉到哪就去哪</p>
        </div>
        <button type="button" className="button button--ghost button--small" aria-pressed={soundOn} onClick={sound.toggle}>
          音效{soundOn ? '開' : '關'}
        </button>
      </header>

      <Steps
        level={level}
        picks={[region?.name ?? null, county, station?.name ?? null]}
        disabled={spinning}
        onBack={goBack}
      />

      <main className="layout">
        <section className="layout__stage" ref={stageRef} aria-label="轉盤">
          <Board {...board} />
          <Wheel
            // 換一層就換一個轉盤，重新播一次登場動畫
            key={path.slice(0, 2).join('-')}
            ref={wheelRef}
            items={items}
            highlight={station ? path[2] : landed}
            onPointerChange={handlePointer}
            hubLabel={station ? '再轉' : '發車'}
            hubSub={LEVELS[level]}
            hubAriaLabel={`轉${LEVELS[level]}`}
            hubDisabled={spinning}
            onHub={() => void spin(path.slice(0, level), false)}
          />
          <div className="controls">
            {level < 2 && (
              <button type="button" className="button" disabled={spinning} onClick={() => void spin(path, true)}>
                一次轉到車站
              </button>
            )}
            {path.length > 0 && (
              <button type="button" className="button button--ghost" disabled={spinning} onClick={() => goBack(0)}>
                重來
              </button>
            )}
          </div>
        </section>

        <section className="layout__side">
          {level < 2 && <Picker options={options} disabled={spinning} onPick={pick} />}
          {level === 2 && !station && (
            <p className="hint">
              {county}有 {stations.length} 個區間車會停的站，按中間的「發車」抽一站。
            </p>
          )}
          {station && (
            <div ref={ticketRef}>
              <ResultCard
                station={station}
                disabled={spinning}
                onRespin={() => void spin(path.slice(0, 2), false)}
                onRetrip={() => void spin([], true)}
              />
            </div>
          )}
        </section>
      </main>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <footer className="footer">
        車站資料來自
        <a href="https://ods.railway.gov.tw/" target="_blank" rel="noreferrer">
          台鐵開放資料
        </a>
        （車站基本資料、每日時刻表），只收區間車或區間快有停的站，{UPDATED_AT} 更新。
      </footer>
    </div>
  )
}
