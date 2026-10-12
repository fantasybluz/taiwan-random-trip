interface BoardProps {
  // 上面那行小字，例如「第 2 層・縣市」「終點站」
  caption: string
  // 中間的大字；轉動時是指針指著的那一格
  text: string
  // 大字下面的英文站名
  sub?: string
  // 還沒轉，大字顯示的是提問
  waiting: boolean
}

// 月台上那種橘色 LED 看板
export function Board({ caption, text, sub, waiting }: BoardProps) {
  return (
    <div className="board">
      <p className="board__caption">{caption}</p>
      <p className={waiting ? 'board__text board__text--waiting' : 'board__text'}>{text}</p>
      <p className="board__sub">{sub ?? ' '}</p>
    </div>
  )
}
