// 一趟旅程的路徑：path 是每一層選到第幾個 [地區, 縣市, 車站]，長度就是已經選到第幾層
import { REGIONS, countiesIn, stationsIn, type Mode, type Region } from '../data/stations'
import type { WheelItem } from './pixelWheel'
import { shadeOf } from './wheel'

export function resolve(path: readonly number[], mode: Mode) {
  const region = path.length > 0 ? REGIONS[path[0]] : null
  const counties = region ? countiesIn(region, mode) : []
  const county = path.length > 1 ? (counties[path[1]] ?? null) : null
  const stations = county ? stationsIn(county, mode) : []
  const station = path.length > 2 ? (stations[path[2]] ?? null) : null
  return { region, counties, county, stations, station }
}

// 下一層只剩一個選項（例如自強3000 在新竹縣只停湖口）就直接選掉，不用轉只有一格的轉盤
export function complete(path: readonly number[], mode: Mode): readonly number[] {
  let result = path
  while (result.length > 0 && result.length < 3) {
    const { counties, stations } = resolve(result, mode)
    const options = result.length === 1 ? counties : stations
    if (options.length !== 1) break
    result = [...result, 0]
  }
  return result
}

export function wheelItems(region: Region | null, county: string | null, mode: Mode): WheelItem[] {
  if (!region) return REGIONS.map((r) => ({ label: r.name, color: r.colors[0] }))
  const labels = county ? stationsIn(county, mode).map((s) => s.name) : countiesIn(region, mode)
  return labels.map((label, i) => ({ label, color: region.colors[shadeOf(i, labels.length)] }))
}

export interface PickerOption {
  label: string
  // 這個選項底下有幾站
  count: number
}

export function pickerOptions(region: Region | null, mode: Mode): PickerOption[] {
  const countOf = (county: string) => stationsIn(county, mode).length
  if (!region) {
    return REGIONS.map((r) => ({
      label: r.name,
      count: countiesIn(r, mode).reduce((sum, county) => sum + countOf(county), 0),
    }))
  }
  return countiesIn(region, mode).map((county) => ({ label: county, count: countOf(county) }))
}
