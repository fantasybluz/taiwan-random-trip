import { MODES, type Mode } from '../data/stations'
import { stationCount } from '../lib/trip'

interface ModeTabsProps {
  mode: Mode
  // 站數扣掉排除的縣市
  excluded: readonly string[]
  disabled: boolean
  onChange: (mode: Mode) => void
}

// 切換區間車版、自強3000版
export function ModeTabs({ mode, excluded, disabled, onChange }: ModeTabsProps) {
  return (
    <div className="modes" role="group" aria-label="搭哪種車">
      {MODES.map((info) => {
        const active = info.key === mode
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
            <span className="modes__count">{stationCount({ mode: info.key, excluded })} 站</span>
          </button>
        )
      })}
    </div>
  )
}
