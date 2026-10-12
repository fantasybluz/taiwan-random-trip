import { describe, expect, it } from 'vitest'
import { MODES, REGIONS, STATIONS, stationsIn } from './stations'

describe('車站資料', () => {
  it('每個車站的縣市都分到某個地區（重撈資料後多了新縣市寫法會在這裡抓到）', () => {
    const counties = new Set(REGIONS.flatMap((region) => region.counties))
    const unknown = STATIONS.filter((station) => !counties.has(station.county))
    expect(unknown).toEqual([])
  })

  it('區間車版每個縣市至少有一站', () => {
    for (const region of REGIONS) {
      for (const county of region.counties) {
        expect(stationsIn(county, 'local').length, county).toBeGreaterThan(0)
      }
    }
  })

  it('每個版本的每個地區都有車站，地區轉盤才不會轉到空的', () => {
    for (const { key } of MODES) {
      for (const region of REGIONS) {
        const count = region.counties.reduce((sum, county) => sum + stationsIn(county, key).length, 0)
        expect(count, `${key} ${region.name}`).toBeGreaterThan(0)
      }
    }
  })

  it('每一站至少有一種車停', () => {
    const idle = STATIONS.filter((station) => MODES.every(({ key }) => station.weeklyStops[key] === 0))
    expect(idle).toEqual([])
  })

  it('站碼不重複', () => {
    const codes = STATIONS.map((station) => station.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
