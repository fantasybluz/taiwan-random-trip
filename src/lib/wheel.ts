// 轉盤的角度都用「度」：0 度在正上方（指針的位置），順時針為正

export function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

// 轉盤順時針轉了 rotation 度之後，指針指著第幾格
export function sliceAt(rotation: number, count: number): number {
  const slice = 360 / count
  return Math.min(count - 1, Math.floor(mod(-rotation, 360) / slice))
}

// 從 current 再多轉 turns 圈，停在第 index 格裡 offset（0～1）的位置
export function rotationFor(current: number, index: number, count: number, turns: number, offset: number): number {
  const target = -(index + offset) * (360 / count)
  return current + mod(target - current, 360) + turns * 360
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

// 相鄰兩格用不同顏色；格數是奇數時頭尾會撞色，最後一格改用第三個顏色
export function shadeOf(index: number, count: number): 0 | 1 | 2 {
  if (count > 1 && count % 2 === 1 && index === count - 1) return 2
  return index % 2 === 0 ? 0 : 1
}
