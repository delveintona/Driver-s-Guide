// 동송시외버스공용터미널 주변 도로(반경 5 km)·건물(반경 3 km)을 OpenStreetMap(Overpass)에서 받아 가볍게 가공한다.
// 사용: node scripts/build-dongsong.mjs   → src/data/dongsong.json
// 데이터 © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)
import fs from 'node:fs'

// 중심: 동송시외버스공용터미널 (OSM node 1100462291)
const LAT0 = 38.2076737
const LON0 = 127.2176699
const ROAD_RADIUS = 5000
const BLD_RADIUS = 3000
const KX = Math.cos((LAT0 * Math.PI) / 180) * 111320
const KY = 110574

const proj = (lat, lon) => [(lon - LON0) * KX, (lat - LAT0) * KY]

async function overpass(q) {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'User-Agent': 'drivers-guide-dev/0.1', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(q),
  })
  if (!res.ok) throw new Error('overpass ' + res.status)
  return res.json()
}

const HW = 'motorway|trunk|primary|secondary|tertiary|residential|unclassified|service|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link'
const roads = await overpass(`[out:json][timeout:90];way["highway"~"^(${HW})$"](around:${ROAD_RADIUS},${LAT0},${LON0});out geom tags;`)
const blds = await overpass(`[out:json][timeout:90];way["building"](around:${BLD_RADIUS},${LAT0},${LON0});out geom tags;`)

const KIND = { motorway: 'p', trunk: 'p', primary: 'p', secondary: 's', tertiary: 't', residential: 'r', unclassified: 'u', service: 'v' }
const DEF_W = { p: 7.0, s: 7.0, t: 6.0, r: 5.0, u: 4.5, v: 3.5 }
const DEF_LIMIT = { p: 60, s: 60, t: 50, r: 30, u: 30, v: 20 }

function dp(pts, eps) {
  if (pts.length < 3) return pts
  const [ax, ay] = pts[0]
  const [bx, by] = pts[pts.length - 1]
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  let idx = -1
  let max = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len
    if (d > max) { max = d; idx = i }
  }
  if (max <= eps) return [pts[0], pts[pts.length - 1]]
  const l = dp(pts.slice(0, idx + 1), eps)
  const r = dp(pts.slice(idx), eps)
  return [...l.slice(0, -1), ...r]
}
const r1 = (n) => Math.round(n * 10) / 10

const outRoads = []
for (const w of roads.elements) {
  const t = w.tags || {}
  const base = t.highway.replace('_link', '')
  const k = KIND[base]
  if (!k || !w.geometry || w.geometry.length < 2) continue
  const pts = dp(w.geometry.map((g) => proj(g.lat, g.lon)), 0.6)
  const lanes = parseInt(t.lanes, 10)
  const oneway = t.oneway === 'yes' || t.junction === 'roundabout'
  let width = DEF_W[k]
  if (Number.isFinite(lanes)) width = Math.max(3.2, lanes * 3.25 * (oneway || lanes >= 2 ? 1 : 1.5))
  if (t.highway.endsWith('_link')) width = Math.min(width, 5)
  const ms = parseInt(t.maxspeed, 10)
  outRoads.push({
    k,
    n: t.name || '',
    w: r1(width),
    ms: Number.isFinite(ms) ? ms : DEF_LIMIT[k],
    ow: oneway ? 1 : 0,
    p: pts.flatMap(([x, y]) => [r1(x), r1(y)]),
  })
}

const outBld = []
for (const w of blds.elements) {
  if (!w.geometry || w.geometry.length < 4) continue
  const t = w.tags || {}
  const levels = parseFloat(t['building:levels'])
  const height = parseFloat(t.height)
  const h = Number.isFinite(height) ? height : Number.isFinite(levels) ? levels * 3 : 6
  const pts = w.geometry.slice(0, -1).map((g) => proj(g.lat, g.lon))
  outBld.push({ h: r1(Math.min(30, Math.max(3, h))), p: pts.flatMap(([x, y]) => [r1(x), r1(y)]) })
}

const out = {
  name: '동송터미널 주변 5 km',
  origin: { lat: LAT0, lon: LON0 },
  attribution: '© OpenStreetMap contributors (ODbL 1.0)',
  generated: new Date().toISOString().slice(0, 10),
  roads: outRoads,
  buildings: outBld,
}
fs.writeFileSync(new URL('../src/data/dongsong.json', import.meta.url), JSON.stringify(out))
console.log('roads', outRoads.length, 'buildings', outBld.length)
