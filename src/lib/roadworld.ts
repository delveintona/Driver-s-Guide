import raw from '../data/dongsong.json'
import { corridorPolygon, type V2 } from './courses'

/** 동송터미널 주변 5 km: OpenStreetMap 도로·건물 (© OpenStreetMap contributors, ODbL 1.0) */
interface RawRoad { k: string; n: string; w: number; ms: number; ow: number; p: number[] }
interface RawBuilding { h: number; p: number[] }
interface RawData {
  name: string
  attribution: string
  generated: string
  roads: RawRoad[]
  buildings: RawBuilding[]
}

export interface Road {
  k: string
  name: string
  width: number
  limit: number
  oneway: boolean
  pts: V2[]
  poly: V2[]
  left: V2[]
  right: V2[]
  bbox: [number, number, number, number]
  length: number
}
export interface Building { h: number; pts: V2[]; cx: number; cy: number }
export interface Tree { x: number; y: number; h: number }

export interface RoadWorld {
  name: string
  attribution: string
  generated: string
  roads: Road[]
  buildings: Building[]
  trees: Tree[]
}

let cache: RoadWorld | null = null

function mulberry(seed: number) {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function distSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

export function getWorld(): RoadWorld {
  if (cache) return cache
  const d = raw as unknown as RawData
  const roads: Road[] = d.roads.map((r) => {
    const pts: V2[] = []
    for (let i = 0; i < r.p.length; i += 2) pts.push({ x: r.p[i], y: r.p[i + 1] })
    const poly = pts.length >= 2 ? corridorPolygon(pts, r.w) : []
    const n = pts.length
    const left = poly.slice(0, n)
    const right = poly.slice(n).reverse()
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity
    let length = 0
    pts.forEach((p, i) => {
      minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x)
      miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y)
      if (i) length += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y)
    })
    return { k: r.k, name: r.n, width: r.w, limit: r.ms, oneway: !!r.ow, pts, poly, left, right, bbox: [minx, miny, maxx, maxy], length }
  })
  const buildings: Building[] = d.buildings.map((b) => {
    const pts: V2[] = []
    for (let i = 0; i < b.p.length; i += 2) pts.push({ x: b.p[i], y: b.p[i + 1] })
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
    return { h: b.h, pts, cx, cy }
  })
  cache = { name: d.name, attribution: d.attribution, generated: d.generated, roads, buildings, trees: [] }
  // 가로수·들판 나무는 지도 데이터가 없어 길 옆에 일정 간격으로 흩뿌린 장식이다(실제 위치 아님)
  const rnd = mulberry(7)
  const trees: Tree[] = []
  roads.forEach((r) => {
    if (!['p', 's', 't', 'r', 'u'].includes(r.k) || r.length < 40) return
    let acc = 0
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1]
      const b = r.pts[i]
      const segLen = Math.hypot(b.x - a.x, b.y - a.y)
      if (!segLen) continue
      const ux = (b.x - a.x) / segLen
      const uy = (b.y - a.y) / segLen
      let s = (22 - acc) % 22
      for (; s < segLen; s += 22 + rnd() * 12) {
        for (const side of [1, -1]) {
          if (rnd() < 0.35) continue
          const off = r.width / 2 + 2.5 + rnd() * 3.5
          const x = a.x + ux * s - uy * off * side
          const y = a.y + uy * s + ux * off * side
          trees.push({ x, y, h: 4 + rnd() * 4 })
        }
      }
      acc = (acc + segLen) % 22
    }
  })
  cache.trees = trees.filter((t) => !roadAt(t.x, t.y, 1.5))
  return cache
}

export interface RoadHit { road: Road; d: number }

/** (x, y)가 어느 도로 위인지. margin만큼 여유를 둔다. */
export function roadAt(x: number, y: number, margin = 0): RoadHit | null {
  const w = cache ?? getWorld()
  let best: RoadHit | null = null
  for (const r of w.roads) {
    const m = r.width / 2 + margin
    if (x < r.bbox[0] - m || x > r.bbox[2] + m || y < r.bbox[1] - m || y > r.bbox[3] + m) continue
    let dmin = Infinity
    for (let i = 1; i < r.pts.length; i++) {
      dmin = Math.min(dmin, distSeg(x, y, r.pts[i - 1].x, r.pts[i - 1].y, r.pts[i].x, r.pts[i].y))
    }
    if (dmin <= m) {
      const score = dmin / m
      if (!best || score < best.d / (best.road.width / 2 + margin)) best = { road: r, d: dmin }
    }
  }
  return best
}

/** 출발 지점: 지도 중심(동송터미널)에서 가장 가까운 간선·집산도로 위, 진행 방향의 오른쪽 차로 */
export function startPose(): { x: number; y: number; yaw: number; roadName: string } {
  const w = getWorld()
  let best: { d: number; x: number; y: number; ux: number; uy: number; r: Road } | null = null
  for (const r of w.roads) {
    if (!['p', 's', 't'].includes(r.k) || r.length < 60) continue
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1]
      const b = r.pts[i]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const l2 = dx * dx + dy * dy
      if (!l2) continue
      const t = Math.max(0, Math.min(1, (-a.x * dx - a.y * dy) / l2))
      const px = a.x + t * dx
      const py = a.y + t * dy
      const d = Math.hypot(px, py)
      if (!best || d < best.d) {
        const l = Math.sqrt(l2)
        best = { d, x: px, y: py, ux: dx / l, uy: dy / l, r }
      }
    }
  }
  if (!best) return { x: 0, y: 0, yaw: 0, roadName: '도로' }
  const lane = best.r.oneway ? 0 : best.r.width / 4
  return {
    x: best.x + best.uy * lane, // 진행 방향의 오른쪽 차로
    y: best.y - best.ux * lane,
    yaw: Math.atan2(best.uy, best.ux),
    roadName: best.r.name || '도로',
  }
}
