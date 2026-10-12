import type { PickerOption } from '../lib/trip'

interface PickerProps {
  options: readonly PickerOption[]
  disabled: boolean
  onPick: (index: number) => void
}

// 不想交給轉盤決定，就直接點
export function Picker({ options, disabled, onPick }: PickerProps) {
  return (
    <div className="picker">
      <p className="picker__label">或是直接選</p>
      <div className="picker__options">
        {options.map((option, i) => (
          <button key={option.label} type="button" className="chip" disabled={disabled} onClick={() => onPick(i)}>
            {option.label}
            <span className="chip__count">{option.count} 站</span>
          </button>
        ))}
      </div>
    </div>
  )
}
