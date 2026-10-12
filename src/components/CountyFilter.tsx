import { REGIONS, stationsIn, type Mode } from '../data/stations'

interface CountyFilterProps {
  mode: Mode
  excluded: readonly string[]
  disabled: boolean
  onToggle: (county: string) => void
  onClear: () => void
}

// 不想去的縣市點掉，轉盤上就不會出現；排除清單記在這支手機，兩個版本共用
export function CountyFilter({ mode, excluded, disabled, onToggle, onClear }: CountyFilterProps) {
  return (
    <details className="filter">
      <summary className="filter__summary">
        排除縣市
        <span className="filter__status">{excluded.length > 0 ? `已排除 ${excluded.length} 個` : '全部都去'}</span>
      </summary>
      <p className="filter__help">點一下排除，再點一下加回來</p>
      {REGIONS.map((region) => (
        <div key={region.name} className="filter__group">
          <p className="filter__region">{region.name}</p>
          <div className="filter__counties">
            {region.counties.map((county) => {
              const off = excluded.includes(county)
              const count = stationsIn(county, mode).length
              return (
                <button
                  key={county}
                  type="button"
                  className={off ? 'toggle toggle--off' : 'toggle'}
                  aria-pressed={off}
                  aria-label={`排除${county}`}
                  disabled={disabled}
                  onClick={() => onToggle(county)}
                >
                  {county}
                  <span className="toggle__count">{count > 0 ? `${count} 站` : '沒停'}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {excluded.length > 0 && (
        <div className="filter__actions">
          <button type="button" className="button button--ghost button--small" disabled={disabled} onClick={onClear}>
            全部加回來
          </button>
        </div>
      )}
    </details>
  )
}
