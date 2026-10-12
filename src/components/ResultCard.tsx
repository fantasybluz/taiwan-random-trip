import { MODES, type ModeInfo, type Station } from '../data/stations'

interface ResultCardProps {
  station: Station
  mode: ModeInfo
  disabled: boolean
  // 同一個縣市再轉一次車站；縣市只有這一站時不給
  onRespin?: () => void
  // 地區、縣市、車站整趟重轉
  onRetrip: () => void
}

// 一天至少一班就用一天算，不然用一週算
function frequency(weekly: number): string {
  return weekly >= 7 ? `一天約 ${Math.round(weekly / 7)} 班` : `一週約 ${weekly} 班`
}

// 做成一張車票的樣子
export function ResultCard({ station, mode, disabled, onRespin, onRetrip }: ResultCardProps) {
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${station.name}車站 ${station.county}`)}`
  const wikiUrl = `https://zh.wikipedia.org/w/index.php?search=${encodeURIComponent(`${station.name}車站`)}`
  // 目前的版本排第一行，另一種車有停也列出來
  const services = [mode, ...MODES.filter((info) => info.key !== mode.key)].filter(
    (info) => station.weeklyStops[info.key] > 0,
  )

  return (
    <section className="ticket" aria-labelledby="ticket-name">
      <div className="ticket__head">
        <span>台灣隨機旅行・{mode.name}單程票</span>
        <span>No.{station.code}</span>
      </div>
      <p className="ticket__eyebrow">今天就去</p>
      <h2 className="ticket__name" id="ticket-name">
        {station.name}
        <span className="ticket__ename">{station.ename}</span>
      </h2>
      <dl className="ticket__info">
        <dt>縣市</dt>
        <dd>{station.county}</dd>
        <dt>地址</dt>
        <dd>{station.address}</dd>
        <dt>班次</dt>
        <dd>
          {services.map((info) => (
            <span key={info.key} className="ticket__service">
              {info.name}
              {frequency(station.weeklyStops[info.key])}停靠
            </span>
          ))}
          {station.weeklyStops[mode.key] < mode.fewPerWeek && (
            <span className="ticket__warn">{mode.name}班次很少，出發前先查好回程</span>
          )}
        </dd>
      </dl>
      <div className="ticket__row">
        <a className="button button--paper" href={mapUrl} target="_blank" rel="noreferrer">
          Google 地圖
        </a>
        <a className="button button--paper" href={wikiUrl} target="_blank" rel="noreferrer">
          維基百科
        </a>
      </div>
      <div className="ticket__row">
        {onRespin && (
          <button type="button" className="button" disabled={disabled} onClick={onRespin}>
            同縣市換一站
          </button>
        )}
        <button type="button" className="button button--paper" disabled={disabled} onClick={onRetrip}>
          整趟重抽
        </button>
      </div>
    </section>
  )
}
