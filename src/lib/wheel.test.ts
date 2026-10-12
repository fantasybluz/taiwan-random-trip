import { describe, expect, it } from 'vitest'
import { rotationFor, shadeOf, sliceAt } from './wheel'

describe('sliceAt', () => {
  it('沒轉的時候指著第 0 格', () => {
    expect(sliceAt(0, 4)).toBe(0)
  })

  it('順時針轉，指針會往前一格（最後一格）移動', () => {
    expect(sliceAt(10, 4)).toBe(3)
    expect(sliceAt(100, 4)).toBe(2)
    expect(sliceAt(-10, 4)).toBe(0)
    expect(sliceAt(-100, 4)).toBe(1)
  })

  it('轉很多圈也算得對', () => {
    expect(sliceAt(360 * 7 + 10, 4)).toBe(3)
  })
})

describe('rotationFor', () => {
  it('停下來時指針剛好指著選中的那一格', () => {
    for (const count of [2, 3, 5, 19, 25]) {
      for (let index = 0; index < count; index++) {
        for (const current of [0, 123.4, -987.6, 3600.5]) {
          const to = rotationFor(current, index, count, 5, 0.5)
          expect(sliceAt(to, count)).toBe(index)
        }
      }
    }
  })

  it('至少多轉 turns 圈，而且不會倒轉', () => {
    for (const current of [0, 45, 359, -720]) {
      const to = rotationFor(current, 1, 6, 5, 0.3)
      expect(to - current).toBeGreaterThanOrEqual(5 * 360)
      expect(to - current).toBeLessThan(6 * 360)
    }
  })
})

describe('shadeOf', () => {
  it('相鄰的格子（含頭尾）顏色都不一樣', () => {
    for (let count = 2; count <= 30; count++) {
      for (let index = 0; index < count; index++) {
        expect(shadeOf(index, count)).not.toBe(shadeOf((index + 1) % count, count))
      }
    }
  })
})
