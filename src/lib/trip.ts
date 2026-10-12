// 一趟旅程的路徑：path 是每一層選到第幾個 [地區, 縣市, 車站]，長度就是已經選到第幾層
// 每一層的選項都照 scope（哪種車、排除了哪些縣市）過濾，path 的索引是過濾後的位置
import { REGIONS, STATIONS, stationsIn, type Mode, type Region } from '../data/stations'
import type { WheelItem } from './pixelWheel'
import { shadeOf } from './wheel'

export interface Scope {
  mode: Mode
  // 使用者排除的縣市
  excluded: readonly string[]
}

// 這個版本有車停、而且沒被排除的縣市；自強3000 沒有停南投縣，就不會出現在轉盤上
export function countiesIn(region: Region, scope: Scope): string[] {
  return region.counties.filter(
    (county) => !scope.excluded.includes(county) && stationsIn(county, scope.mode).length > 0,
  )
}

// 縣市全被排除的地區也拿掉
export function regionsIn(scope: Scope): Region[] {
  return REGIONS.filter((region) => countiesIn(region, scope).length > 0)
}

export function stationCount(scope: Scope): number {
  return STATIONS.filter((s) => s.weeklyStops[scope.mode] > 0 && !scope.excluded.includes(s.county)).length
}

export function resolve(path: readonly number[], scope: Scope) {
  const regions = regionsIn(scope)
  const region = path.length > 0 ? (regions[path[0]] ?? null) : null
  const counties = region ? countiesIn(region, scope) : []
  const county = path.length > 1 ? (counties[path[1]] ?? null) : null
  const stations = county ? stationsIn(county, scope.mode) : []
  const station = path.length > 2 ? (stations[path[2]] ?? null) : null
  return { regions, region, counties, county, stations, station }
}

// 下一層只剩一個選項就直接選掉，不用轉只有一格的轉盤
// 例如自強3000 在新竹縣只停湖口，或是排除到只剩一個地區
export function complete(path: readonly number[], scope: Scope): readonly number[] {
  let result = path
  while (result.length < 3) {
    const { regions, counties, stations } = resolve(result, scope)
    const options = [regions, counties, stations][result.length]
    if (options.length !== 1) break
    result = [...result, 0]
  }
  return result
}

export function wheelItems(region: Region | null, county: string | null, scope: Scope): WheelItem[] {
  if (!region) return regionsIn(scope).map((r) => ({ label: r.name, color: r.colors[0] }))
  const labels = county ? stationsIn(county, scope.mode).map((s) => s.name) : countiesIn(region, scope)
  return labels.map((label, i) => ({ label, color: region.colors[shadeOf(i, labels.length)] }))
}

export interface PickerOption {
  label: string
  // 這個選項底下有幾站
  count: number
}

export function pickerOptions(region: Region | null, scope: Scope): PickerOption[] {
  const countOf = (county: string) => stationsIn(county, scope.mode).length
  if (!region) {
    return regionsIn(scope).map((r) => ({
      label: r.name,
      count: countiesIn(r, scope).reduce((sum, county) => sum + countOf(county), 0),
    }))
  }
  return countiesIn(region, scope).map((county) => ({ label: county, count: countOf(county) }))
}
