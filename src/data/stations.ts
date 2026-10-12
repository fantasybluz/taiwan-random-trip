// stations.json 由 scripts/fetch-stations.mjs 從台鐵開放資料產生，要更新跑 npm run stations
import data from './stations.json'

export interface Station {
  code: string
  name: string
  ename: string
  county: string
  address: string
  // 一天平均有幾班區間車（含區間快）停靠
  dailyStops: number
}

export interface Region {
  name: string
  // 轉盤上的顏色：第一個是地區轉盤用的主色，縣市和車站轉盤三個輪流用
  colors: readonly [string, string, string]
  counties: readonly string[]
}

// 站碼大致照路線排，同縣市的車站轉盤上相鄰的就是鐵路上相鄰的站
export const STATIONS: readonly Station[] = data.stations
// 撈資料的日期（yyyy-mm-dd）
export const UPDATED_AT: string = data.updatedAt

// 轉盤的三層
export const LEVELS = ['地區', '縣市', '車站'] as const

// 宜蘭照宜花東的分法算東部
export const REGIONS: readonly Region[] = [
  {
    name: '北部',
    colors: ['#3a7bd5', '#24569e', '#5a5fc4'],
    counties: ['基隆市', '臺北市', '新北市', '桃園市', '新竹縣', '新竹市'],
  },
  {
    name: '中部',
    colors: ['#1f9a63', '#00744c', '#4f8a2a'],
    counties: ['苗栗縣', '臺中市', '彰化縣', '南投縣', '雲林縣'],
  },
  {
    name: '南部',
    colors: ['#f47920', '#c25a10', '#d9483b'],
    counties: ['嘉義縣', '嘉義市', '臺南市', '高雄市', '屏東縣'],
  },
  {
    name: '東部',
    colors: ['#17a0aa', '#0d727c', '#2f7fb8'],
    counties: ['宜蘭縣', '花蓮縣', '臺東縣'],
  },
]

export function stationsIn(county: string): Station[] {
  return STATIONS.filter((station) => station.county === county)
}
