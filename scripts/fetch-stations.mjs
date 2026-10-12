// 從台鐵開放資料撈「有區間車或自強3000停靠」的車站，輸出 src/data/stations.json
//
// 車站清單用「車站基本資料集」，但裡面也有調車場、號誌站這些不載客的站，
// 所以再抓接下來一週的每日時刻表，數每一站一週有幾班區間車、幾班自強3000停，
// 兩種都沒停的站就不收。
//
// 用法：npm run stations

import { writeFile } from 'node:fs/promises'

const ODS = 'https://ods.railway.gov.tw/tra-ods-web/ods/download/dataResource'
const STATION_URL = `${ODS}/0518b833e8964d53bfea3f7691aea0ee`
const SCHEDULE_LIST_URL = `${ODS}/railway_schedule/JSON/list`
const OUTPUT = new URL('../src/data/stations.json', import.meta.url)

// 時刻表的 CarClass：
// - 區間車：1131 區間車、1132 區間快（南迴線的區間車在這裡是區間快）
// - 自強3000：110G、110H，這兩種每一班的備註都寫著「騰雲座艙」，那是 EMU3000 才有的商務車廂
const TRAIN_TYPES = {
  local: new Set(['1131', '1132']),
  emu3000: new Set(['110G', '110H']),
}
const EMU3000_MARK = '騰雲座艙'
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

// 站碼 → { local: 班數, emu3000: 班數 }
const stops = new Map()
// 有騰雲座艙卻不在自強3000車種裡（或反過來）的車，代表台鐵改了車種代碼
const mismatched = new Map()
const files = await scheduleUrls()
for (const file of files) {
  const { TrainInfos } = await fetchJson(file.url)
  for (const train of TrainInfos) {
    const marked = train.Note.includes(EMU3000_MARK)
    if (marked !== TRAIN_TYPES.emu3000.has(train.CarClass)) {
      mismatched.set(train.CarClass, (mismatched.get(train.CarClass) ?? 0) + 1)
    }
    for (const [type, classes] of Object.entries(TRAIN_TYPES)) {
      if (!classes.has(train.CarClass)) continue
      for (const { Station } of train.TimeInfos) {
        const counts = stops.get(Station) ?? { local: 0, emu3000: 0 }
        counts[type] += 1
        stops.set(Station, counts)
      }
    }
  }
  console.log(`時刻表 ${file.date}：${TrainInfos.length} 班車`)
}
if (mismatched.size > 0) {
  const list = [...mismatched].map(([carClass, n]) => `${carClass}（${n} 班）`).join('、')
  console.warn(`⚠ 這些車種的「${EMU3000_MARK}」備註跟自強3000車種對不起來，檢查 TRAIN_TYPES.emu3000：${list}`)
}

// 抓到的天數不滿一週時照比例換算
const perWeek = (count) => Math.round((count * 7) / files.length)

const result = []
for (const [code, counts] of stops) {
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
    // 一週有幾班停靠；有停但一週不到一班的算 1，才不會被當成沒停
    weeklyStops: {
      local: counts.local > 0 ? Math.max(1, perWeek(counts.local)) : 0,
      emu3000: counts.emu3000 > 0 ? Math.max(1, perWeek(counts.emu3000)) : 0,
    },
  })
}

// 站碼大致照路線排：西部幹線往南、南迴、東部往北繞回基隆，支線插在分歧站後面
result.sort((a, b) => a.code.localeCompare(b.code))

const skipped = stations.filter((s) => !stops.has(s.stationCode))
const count = (type) => result.filter((s) => s.weeklyStops[type] > 0).length
console.log(`兩種車都沒停的站：${skipped.map((s) => s.stationName).join('、')}`)
console.log(`區間車 ${count('local')} 站、自強3000 ${count('emu3000')} 站，共 ${result.length} 站，寫入 ${OUTPUT.pathname}`)

const date = today()
const output = {
  updatedAt: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`,
  stations: result,
}
await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`)
