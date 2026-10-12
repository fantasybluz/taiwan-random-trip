import type { Station } from '../data/stations'

// 一天少於這麼多班，就提醒先查回程
const FEW_TRAINS = 12

interface ResultCardProps {
  station: Station
  disabled: boolean
  // 同一個縣市再轉一次車站
  onRespin: () => void
  // 地區、縣市、車站整趟重轉
  onRetrip: () => void
}

// 做成一張車票的樣子
export function ResultCard({ station, disabled, onRespin, onRetrip }: ResultCardProps) {
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${station.name}車站 ${station.county}`)}`
  const wikiUrl = `https://zh.wikipedia.org/w/index.php?search=${encodeURIComponent(`${station.name}車站`)}`

  return (
    <section className="ticket" aria-labelledby="ticket-name">
      <div className="ticket__head">
        <span>台灣隨機旅行・單程票</span>
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
          區間車一天約 {station.dailyStops} 班停靠
          {station.dailyStops < FEW_TRAINS && <span className="ticket__warn">班次很少，出發前先查好回程</span>}
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
        <button type="button" className="button" disabled={disabled} onClick={onRespin}>
          同縣市換一站
        </button>
        <button type="button" className="button button--paper" disabled={disabled} onClick={onRetrip}>
          整趟重抽
        </button>
      </div>
    </section>
  )
}
