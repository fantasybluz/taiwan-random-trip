import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { Board } from './components/Board'
import { CountyFilter } from './components/CountyFilter'
import { ModeTabs } from './components/ModeTabs'
import { Picker } from './components/Picker'
import { ResultCard } from './components/ResultCard'
import { Steps } from './components/Steps'
import { Wheel, type WheelHandle } from './components/Wheel'
import { LEVELS, MODES, REGIONS, UPDATED_AT, modeInfo, type Mode } from './data/stations'
import { sound } from './lib/sound'
import { readStore, writeStore } from './lib/storage'
import { complete, pickerOptions, resolve, wheelItems, type Scope } from './lib/trip'

// 每一層轉完先停一下讓人看清楚，再換下一層的轉盤
const LANDED_PAUSE_MS = 1000
// 一次轉到底時，新轉盤出現後等一下再開始轉
const NEXT_WHEEL_PAUSE_MS = 600
const EXCLUDED_KEY = 'taiwan-random-trip-excluded'

const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

// 網址 hash 決定是哪個版本，例如 #emu3000 是自強3000版
function modeFromHash(): Mode {
  return MODES.find((info) => info.hash && info.hash === window.location.hash)?.key ?? 'local'
}

// 存的東西可能是舊版或被改過，只留認得的縣市
function loadExcluded(): string[] {
  const saved = readStore<unknown>(EXCLUDED_KEY, [])
  const counties = new Set(REGIONS.flatMap((region) => region.counties))
  return Array.isArray(saved) ? saved.filter((county): county is string => counties.has(county)) : []
}

export function App() {
  const wheelRef = useRef<WheelHandle>(null)
  const stageRef = useRef<HTMLElement>(null)
  const ticketRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<Mode>(modeFromHash)
  const [excluded, setExcluded] = useState<readonly string[]>(loadExcluded)
  const scope = useMemo<Scope>(() => ({ mode, excluded }), [mode, excluded])
  const [path, setPath] = useState<readonly number[]>(() => complete([], { mode, excluded }))
  const [spinning, setSpinning] = useState(false)
  // 轉完、還沒換到下一層之前，轉到的那格先亮著
  const [landed, setLanded] = useState<number | null>(null)
  const [pointer, setPointer] = useState(0)
  const [announce, setAnnounce] = useState('')
  const soundOn = useSyncExternalStore(sound.subscribe, sound.isEnabled)

  const info = modeInfo(mode)
  const { regions, region, county, stations, station } = resolve(path, scope)
  const empty = regions.length === 0
  const level = Math.min(path.length, 2)
  const items = useMemo(() => wheelItems(region, county, scope), [region, county, scope])
  const options = useMemo(() => pickerOptions(region, scope), [region, scope])
  // 只剩一個選項的層會自動選好，「重來」回到的就是這裡
  const start = useMemo(() => complete([], scope), [scope])

  // 換版本或改排除清單後，從頭開始（只剩一個選項的層直接幫忙選好）
  function restart(next: Scope) {
    setLanded(null)
    setPath(complete([], next))
  }

  // 使用者自己改網址的 hash 或按上一頁時跟著換版本
  useEffect(() => {
    const onHashChange = () => {
      const next = modeFromHash()
      setMode(next)
      setLanded(null)
      setPath(complete([], { mode: next, excluded }))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [excluded])

  useEffect(() => {
    document.title = mode === 'local' ? '台灣隨機旅行' : `台灣隨機旅行・${info.name}`
  }, [mode, info.name])

  function changeMode(next: Mode) {
    if (next === mode) return
    setMode(next)
    restart({ mode: next, excluded })
    const { pathname, search } = window.location
    window.history.replaceState(null, '', `${pathname}${search}${modeInfo(next).hash}`)
  }

  function changeExcluded(next: readonly string[]) {
    setExcluded(next)
    writeStore(EXCLUDED_KEY, next)
    restart({ mode, excluded: next })
  }

  function toggleCounty(target: string) {
    changeExcluded(excluded.includes(target) ? excluded.filter((c) => c !== target) : [...excluded, target])
  }

  function arrive(next: readonly number[]) {
    const picked = resolve(next, scope).station
    if (!picked) return
    setAnnounce(`抵達：${picked.name}（${picked.county}）`)
    sound.arrive()
    ticketRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' })
  }

  // 從 start 這條路徑開始轉；all 是一路轉到車站，不然只轉一層
  async function spin(start: readonly number[], all: boolean) {
    if (spinning || empty || start.length >= 3) return
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
      setLanded(index)
      const next = complete(current, scope)

      if (current.length < 3) {
        const picked = resolve(current, scope)
        setAnnounce(`${LEVELS[current.length - 1]}：${picked.county ?? picked.region?.name}`)
        sound.step()
        await sleep(LANDED_PAUSE_MS)
      }

      if (next.length === 3) {
        current = next
        flushSync(() => setPath(current))
        arrive(current)
        break
      }

      // 馬上換成下一層的轉盤，下一圈迴圈拿到的 wheelRef 才是新的
      current = next
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
    const next = complete([...path, index], scope)
    flushSync(() => {
      setLanded(null)
      setPath(next)
    })
    if (next.length === 3) arrive(next)
    else sound.step()
  }

  function goBack(to: number) {
    setLanded(null)
    setPath(complete(path.slice(0, to), scope))
  }

  function handlePointer(index: number, moving: boolean) {
    setPointer(index)
    if (moving) sound.tick()
  }

  // 轉到的縣市只有一站時，「再轉」改成整趟重轉
  const onlyStation = station !== null && stations.length === 1
  const respin = () => void spin(path.slice(0, 2), false)
  const retrip = () => void spin(start, true)

  const prompts = ['先決定去哪個地區？', `${region?.name}的哪個縣市？`, `${county}的哪一站？`]
  const board = empty
    ? { caption: info.name, text: '沒有縣市可以轉', waiting: true }
    : station
      ? { caption: `${info.name}・本次旅行目的地`, text: station.name, sub: station.ename, waiting: false }
      : spinning
        ? {
            caption: `${info.name}・${level + 1}／3・轉${LEVELS[level]}`,
            text: items[pointer]?.label ?? '',
            sub: stations[pointer]?.ename,
            waiting: false,
          }
        : { caption: `${info.name}・${level + 1}／3・${LEVELS[level]}`, text: prompts[level], waiting: true }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="header__title">台灣隨機旅行</h1>
          <p className="header__tagline">地區 → 縣市 → 車站，轉到哪就去哪</p>
        </div>
        <button type="button" className="button button--ghost button--small" aria-pressed={soundOn} onClick={sound.toggle}>
          音效{soundOn ? '開' : '關'}
        </button>
      </header>

      <ModeTabs mode={mode} excluded={excluded} disabled={spinning} onChange={changeMode} />

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
            // 換版本、排除清單或換一層就換一個轉盤，重新播一次登場動畫
            key={`${mode}:${excluded.join(',')}:${path.slice(0, 2).join('-')}`}
            ref={wheelRef}
            items={items}
            highlight={station ? path[2] : landed}
            onPointerChange={handlePointer}
            hubLabel={station ? '再轉' : '發車'}
            hubSub={onlyStation ? '整趟' : LEVELS[level]}
            hubAriaLabel={onlyStation ? '整趟重轉' : `轉${LEVELS[level]}`}
            hubDisabled={spinning || empty}
            onHub={onlyStation ? retrip : () => void spin(path.slice(0, level), false)}
          />
          <div className="controls">
            {level < 2 && (
              <button
                type="button"
                className="button"
                disabled={spinning || empty}
                onClick={() => void spin(path, true)}
              >
                一次轉到車站
              </button>
            )}
            {path.length > start.length && (
              <button type="button" className="button button--ghost" disabled={spinning} onClick={() => goBack(0)}>
                重來
              </button>
            )}
          </div>
        </section>

        <section className="layout__side">
          {empty && (
            <p className="hint">
              排除的縣市太多了，{info.name}沒有可以去的站。到下面「排除縣市」把幾個縣市加回來。
            </p>
          )}
          {!empty && level < 2 && <Picker options={options} disabled={spinning} onPick={pick} />}
          {level === 2 && !station && (
            <p className="hint">
              {county}有 {stations.length} 個{info.name}會停的站，按中間的「發車」抽一站。
            </p>
          )}
          {station && (
            <div ref={ticketRef}>
              <ResultCard
                station={station}
                mode={info}
                disabled={spinning}
                onRespin={onlyStation ? undefined : respin}
                onRetrip={retrip}
              />
            </div>
          )}
          <CountyFilter
            mode={mode}
            excluded={excluded}
            disabled={spinning}
            onToggle={toggleCounty}
            onClear={() => changeExcluded([])}
          />
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
        （車站基本資料、每日時刻表）：區間車版收區間車、區間快有停的站，自強3000版收 EMU3000 有停的站，{UPDATED_AT}{' '}
        更新。
      </footer>
    </div>
  )
}
