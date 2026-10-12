import { LEVELS } from '../data/stations'

interface StepsProps {
  // 目前在第幾層（0～2）
  level: number
  // 每一層選到的東西，還沒選是 null
  picks: readonly (string | null)[]
  disabled: boolean
  // 點已經選過的那層，回到那層重選
  onBack: (level: number) => void
}

export function Steps({ level, picks, disabled, onBack }: StepsProps) {
  return (
    <ol className="steps">
      {LEVELS.map((name, i) => {
        const pick = picks[i]
        const done = pick !== null
        const modifier = i === level && !done ? ' steps__item--current' : done ? ' steps__item--done' : ''
        return (
          <li key={name} className={`steps__item${modifier}`}>
            <button
              type="button"
              className="steps__button"
              disabled={disabled || !done}
              onClick={() => onBack(i)}
              aria-label={done ? `${name}：${pick}，點一下重選` : name}
            >
              <span className="steps__name">
                {i + 1}．{name}
              </span>
              <span className="steps__pick">{pick ?? '？'}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
