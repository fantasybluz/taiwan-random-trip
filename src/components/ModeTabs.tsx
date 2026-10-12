import { MODES, STATIONS, type Mode } from '../data/stations'

interface ModeTabsProps {
  mode: Mode
  disabled: boolean
  onChange: (mode: Mode) => void
}

// 切換區間車版、自強3000版
export function ModeTabs({ mode, disabled, onChange }: ModeTabsProps) {
  return (
    <div className="modes" role="group" aria-label="搭哪種車">
      {MODES.map((info) => {
        const active = info.key === mode
        const count = STATIONS.filter((station) => station.weeklyStops[info.key] > 0).length
        return (
          <button
            key={info.key}
            type="button"
            className={active ? 'modes__tab modes__tab--active' : 'modes__tab'}
            aria-pressed={active}
            disabled={disabled && !active}
            onClick={() => onChange(info.key)}
          >
            {info.name}
            <span className="modes__count">{count} 站</span>
          </button>
        )
      })}
    </div>
  )
}
