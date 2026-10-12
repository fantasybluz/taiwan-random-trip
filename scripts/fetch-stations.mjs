// 從台鐵開放資料撈「有區間車停靠」的車站，輸出 src/data/stations.json
//
// 車站清單用「車站基本資料集」，但裡面也有調車場、號誌站這些不載客的站，
// 所以再抓接下來幾天的每日時刻表，只留下區間車或區間快有停的站。
//
// 用法：npm run stations

import { writeFile } from 'node:fs/promises'

const ODS = 'https://ods.railway.gov.tw/tra-ods-web/ods/download/dataResource'
const STATION_URL = `${ODS}/0518b833e8964d53bfea3f7691aea0ee`
const SCHEDULE_LIST_URL = `${ODS}/railway_schedule/JSON/list`
const OUTPUT = new URL('../src/data/stations.json', import.meta.url)

// 時刻表的 CarClass：1131 區間車、1132 區間快（南迴線的區間車在這裡是區間快）
const LOCAL_CAR_CLASSES = new Set(['1131', '1132'])
// 抓一週，平日和假日的班次都算到
const DAYS = 7

// 時刻表有停、但車站基本資料集還沒收錄的新站
const EXTRA_STATIONS = {
  1105: {
    name: '平鎮',
    ename: 'Pingzhen',
    address: '桃園市平鎮區新富一街與新富三街路口',
  },
}

async function fetchText(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}：${url}`)
  return res.text()
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url))
}

function today() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
}

// 時刻表清單是一頁 HTML，每天一個 yyyymmdd.json 的連結
async function scheduleUrls() {
  const html = await fetchText(SCHEDULE_LIST_URL)
  const files = [...html.matchAll(/href="([^"]+)">(\d{8})\.json</g)]
    .map(([, href, date]) => ({ date, url: new URL(href, STATION_URL).href }))
    .filter((file) => file.date >= today())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, DAYS)
  if (files.length === 0) throw new Error('時刻表清單裡找不到今天以後的檔案')
  return files
}

function countyOf(address) {
  return address.replace(/^台/, '臺').slice(0, 3)
}

const stations = await fetchJson(STATION_URL)
const byCode = new Map(stations.map((s) => [s.stationCode, s]))

const stops = new Map()
const files = await scheduleUrls()
for (const file of files) {
  const { TrainInfos } = await fetchJson(file.url)
  for (const train of TrainInfos) {
    if (!LOCAL_CAR_CLASSES.has(train.CarClass)) continue
    for (const { Station } of train.TimeInfos) {
      stops.set(Station, (stops.get(Station) ?? 0) + 1)
    }
  }
  console.log(`時刻表 ${file.date}：${TrainInfos.length} 班車`)
}

const result = []
for (const [code, count] of stops) {
  const raw = byCode.get(code)
  const station = raw
    ? { name: raw.stationName, ename: raw.stationEName, address: raw.stationAddrTw }
    : EXTRA_STATIONS[code]
  if (!station) {
    console.warn(`⚠ 站碼 ${code} 不在車站資料裡，先略過（要的話加到 EXTRA_STATIONS）`)
    continue
  }
  result.push({
    code,
    name: station.name,
    ename: station.ename,
    county: countyOf(station.address),
    address: station.address,
    // 一天平均有幾班區間車停
    dailyStops: Math.round(count / files.length),
  })
}

// 站碼大致照路線排：西部幹線往南、南迴、東部往北繞回基隆，支線插在分歧站後面
result.sort((a, b) => a.code.localeCompare(b.code))

const skipped = stations.filter((s) => !stops.has(s.stationCode))
console.log(`沒有區間車停的站：${skipped.map((s) => s.stationName).join('、')}`)
console.log(`共 ${result.length} 站，寫入 ${OUTPUT.pathname}`)

const date = today()
const output = {
  updatedAt: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`,
  stations: result,
}
await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`)
