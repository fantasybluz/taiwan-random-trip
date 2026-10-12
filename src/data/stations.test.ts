import { describe, expect, it } from 'vitest'
import { REGIONS, STATIONS, stationsIn } from './stations'

describe('車站資料', () => {
  it('每個車站的縣市都分到某個地區（重撈資料後多了新縣市寫法會在這裡抓到）', () => {
    const counties = new Set(REGIONS.flatMap((region) => region.counties))
    const unknown = STATIONS.filter((station) => !counties.has(station.county))
    expect(unknown).toEqual([])
  })

  it('每個縣市至少有一站，轉盤才不會是空的', () => {
    for (const region of REGIONS) {
      for (const county of region.counties) {
        expect(stationsIn(county).length, county).toBeGreaterThan(0)
      }
    }
  })

  it('站碼不重複', () => {
    const codes = STATIONS.map((station) => station.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
