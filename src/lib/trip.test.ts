import { describe, expect, it } from 'vitest'
import { REGIONS, type Mode } from '../data/stations'
import { complete, pickerOptions, regionsIn, resolve, stationCount, wheelItems, type Scope } from './trip'

const NORTH = REGIONS.findIndex((r) => r.name === '北部')
const CENTRAL = REGIONS.findIndex((r) => r.name === '中部')
const scope = (mode: Mode, excluded: string[] = []): Scope => ({ mode, excluded })
const allCounties = REGIONS.flatMap((r) => r.counties)

describe('resolve', () => {
  it('照路徑找出地區、縣市、車站', () => {
    const { region, county, station } = resolve([NORTH, 0, 0], scope('local'))
    expect(region?.name).toBe('北部')
    expect(county).toBe('基隆市')
    expect(station?.county).toBe('基隆市')
  })

  it('自強3000 的縣市清單跳過沒有停靠站的南投縣', () => {
    expect(resolve([CENTRAL], scope('local')).counties).toContain('南投縣')
    expect(resolve([CENTRAL], scope('emu3000')).counties).not.toContain('南投縣')
  })
})

describe('排除縣市', () => {
  it('被排除的縣市不在縣市清單裡，站數也扣掉', () => {
    const { counties } = resolve([NORTH], scope('local', ['臺北市']))
    expect(counties).not.toContain('臺北市')
    expect(stationCount(scope('local', ['臺北市']))).toBe(stationCount(scope('local')) - 4)
  })

  it('一個地區的縣市全被排除，地區也拿掉，後面地區的索引跟著往前', () => {
    const regions = regionsIn(scope('local', ['宜蘭縣', '花蓮縣', '臺東縣']))
    expect(regions.map((r) => r.name)).toEqual(['北部', '中部', '南部'])
  })

  it('全部排除就沒有地區可以轉', () => {
    expect(regionsIn(scope('local', allCounties))).toEqual([])
    expect(wheelItems(null, null, scope('local', allCounties))).toEqual([])
  })
})

describe('complete', () => {
  it('縣市只有一站時直接帶出那一站', () => {
    const s = scope('emu3000')
    const hsinchuCounty = resolve([NORTH], s).counties.indexOf('新竹縣')
    const path = complete([NORTH, hsinchuCounty], s)
    expect(path).toHaveLength(3)
    expect(resolve(path, s).station?.name).toBe('湖口')
  })

  it('排除到只剩一個地區，一開始就幫忙選好地區', () => {
    const others = allCounties.filter((c) => !['宜蘭縣', '花蓮縣'].includes(c))
    const s = scope('local', others)
    const path = complete([], s)
    expect(path).toEqual([0])
    expect(resolve(path, s).region?.name).toBe('東部')
  })

  it('有好幾個選項時不動', () => {
    expect(complete([NORTH, 0], scope('local'))).toEqual([NORTH, 0])
    expect(complete([], scope('local'))).toEqual([])
  })
})

describe('wheelItems 和 pickerOptions', () => {
  it('轉盤格子和直接選的選項一一對應', () => {
    for (const s of [scope('local'), scope('emu3000'), scope('local', ['臺北市', '花蓮縣', '臺東縣', '宜蘭縣'])]) {
      expect(wheelItems(null, null, s).map((item) => item.label)).toEqual(pickerOptions(null, s).map((o) => o.label))
      for (const region of regionsIn(s)) {
        const labels = wheelItems(region, null, s).map((item) => item.label)
        expect(labels).toEqual(pickerOptions(region, s).map((o) => o.label))
        expect(labels.length, `${s.mode} ${region.name}`).toBeGreaterThan(0)
      }
    }
  })
})
