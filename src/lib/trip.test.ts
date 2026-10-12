import { describe, expect, it } from 'vitest'
import { REGIONS } from '../data/stations'
import { complete, pickerOptions, resolve, wheelItems } from './trip'

const NORTH = REGIONS.findIndex((r) => r.name === '北部')
const CENTRAL = REGIONS.findIndex((r) => r.name === '中部')

describe('resolve', () => {
  it('照路徑找出地區、縣市、車站', () => {
    const { region, county, station } = resolve([NORTH, 0, 0], 'local')
    expect(region?.name).toBe('北部')
    expect(county).toBe('基隆市')
    expect(station?.county).toBe('基隆市')
  })

  it('自強3000 的縣市清單跳過沒有停靠站的南投縣', () => {
    expect(resolve([CENTRAL], 'local').counties).toContain('南投縣')
    expect(resolve([CENTRAL], 'emu3000').counties).not.toContain('南投縣')
  })
})

describe('complete', () => {
  it('縣市只有一站時直接帶出那一站', () => {
    const hsinchuCounty = resolve([NORTH], 'emu3000').counties.indexOf('新竹縣')
    const path = complete([NORTH, hsinchuCounty], 'emu3000')
    expect(path).toHaveLength(3)
    expect(resolve(path, 'emu3000').station?.name).toBe('湖口')
  })

  it('有好幾站時不動', () => {
    expect(complete([NORTH, 0], 'local')).toEqual([NORTH, 0])
    expect(complete([], 'local')).toEqual([])
  })
})

describe('wheelItems 和 pickerOptions', () => {
  it('轉盤格子和直接選的選項一一對應', () => {
    for (const mode of ['local', 'emu3000'] as const) {
      expect(wheelItems(null, null, mode).map((item) => item.label)).toEqual(pickerOptions(null, mode).map((o) => o.label))
      for (let r = 0; r < REGIONS.length; r++) {
        const labels = wheelItems(REGIONS[r], null, mode).map((item) => item.label)
        expect(labels).toEqual(pickerOptions(REGIONS[r], mode).map((o) => o.label))
        expect(labels.length, `${mode} ${REGIONS[r].name}`).toBeGreaterThan(0)
      }
    }
  })
})
