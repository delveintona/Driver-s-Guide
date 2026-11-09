import type { Pt3 } from './render3d'

export type V2 = { x: number; y: number }

export type CourseId = 'free' | 'gul' | 's' | 'turn'

/**
 * 코스 치수. 군(부대) 시험 코스 치수는 공개 자료를 찾지 못했다.
 * 기본값은 임시값(민간 도로교통법 시행규칙 별표 23, 1종 대형 기능시험 치수 일부)이고, 화면에서 직접 고칠 수 있다.
 * S자 호 각도·반경은 별표에 없는 값이라 순수한 임시값이다.
 */
export interface CourseDims {
  gul: { width: number; between: number; entry: number; corner: number; firstLeft: boolean }
  s: { width: number; radius: number; arcDeg: number; firstLeft: boolean }
  turn: { width: number; garageLen: number; entryLen: number; corner: number; checkLine: number; garageLeft: boolean }
}

export const DEFAULT_DIMS: CourseDims = {
  gul: { width: 4.7, between: 15.0, entry: 6.0, corner: 1.5, firstLeft: true },
  s: { width: 4.2, radius: 10.0, arcDeg: 60, firstLeft: true },
  turn: { width: 5.2, garageLen: 8.0, entryLen: 8.0, corner: 1.5, checkLine: 1.0, garageLeft: true },
}

export interface Course {
  id: Exclude<CourseId, 'free'>
  name: string
  polygon: V2[]
  lines: V2[][]
  marks: { pts: V2[]; color: string; label?: string }[]
  /** 차량 뒤끝 중앙이 놓일 출발 위치와 진행 방향 */
  start: { x: number; y: number; yaw: number }
  /** 통과형: 차량 네 모서리가 모두 dir 방향으로 point를 넘으면 완료 */
  finish?: { point: V2; dir: V2 }
  /** 차고 후진형(T자) */
  garage?: { x0: number; x1: number; touchY: number; touchDir: 1 | -1; returnY: number }
  description: string
  goal: string
}

const D2R = Math.PI / 180
const EXT = 14 // 진입 전·통과 후 연장 구간(도식용)

function lineIntersect(p: V2, d: V2, q: V2, e: V2): V2 | null {
  const det = d.x * e.y - d.y * e.x
  if (Math.abs(det) < 1e-9) return null
  const t = ((q.x - p.x) * e.y - (q.y - p.y) * e.x) / det
  return { x: p.x + d.x * t, y: p.y + d.y * t }
}

/** 중심선을 폭 w로 부풀린 다각형. 결과 = 왼쪽 점들 + 오른쪽 점들(역순) */
export function corridorPolygon(center: V2[], w: number): V2[] {
  const h = w / 2
  const dirs: V2[] = []
  for (let i = 0; i < center.length - 1; i++) {
    const dx = center[i + 1].x - center[i].x
    const dy = center[i + 1].y - center[i].y
    const l = Math.hypot(dx, dy)
    dirs.push({ x: dx / l, y: dy / l })
  }
  const side = (sign: 1 | -1): V2[] => {
    const out: V2[] = []
    const n = (d: V2): V2 => ({ x: -d.y * sign, y: d.x * sign })
    for (let i = 0; i < center.length; i++) {
      if (i === 0) {
        const nn = n(dirs[0])
        out.push({ x: center[0].x + nn.x * h, y: center[0].y + nn.y * h })
      } else if (i === center.length - 1) {
        const nn = n(dirs[dirs.length - 1])
        out.push({ x: center[i].x + nn.x * h, y: center[i].y + nn.y * h })
      } else {
        const n1 = n(dirs[i - 1])
        const n2 = n(dirs[i])
        const a = { x: center[i].x + n1.x * h, y: center[i].y + n1.y * h }
        const b = { x: center[i].x + n2.x * h, y: center[i].y + n2.y * h }
        out.push(lineIntersect(a, dirs[i - 1], b, dirs[i]) ?? a)
      }
    }
    return out
  }
  return [...side(1), ...side(-1).reverse()]
}

/** 지정한 꼭짓점만 반경 r로 둥글게 깎는다 */
export function roundCorners(pts: V2[], r: number, which: Set<number>): V2[] {
  const out: V2[] = []
  const n = pts.length
  for (let i = 0; i < n; i++) {
    if (!which.has(i) || r <= 0) {
      out.push(pts[i])
      continue
    }
    const p0 = pts[(i + n - 1) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const a = { x: p0.x - p1.x, y: p0.y - p1.y }
    const b = { x: p2.x - p1.x, y: p2.y - p1.y }
    const la = Math.hypot(a.x, a.y)
    const lb = Math.hypot(b.x, b.y)
    const ua = { x: a.x / la, y: a.y / la }
    const ub = { x: b.x / lb, y: b.y / lb }
    const ang = Math.acos(Math.max(-1, Math.min(1, ua.x * ub.x + ua.y * ub.y)))
    const t = Math.min(r / Math.tan(ang / 2), la / 2, lb / 2)
    const rr = t * Math.tan(ang / 2)
    const s = { x: p1.x + ua.x * t, y: p1.y + ua.y * t }
    const e = { x: p1.x + ub.x * t, y: p1.y + ub.y * t }
    const bis = { x: ua.x + ub.x, y: ua.y + ub.y }
    const lbis = Math.hypot(bis.x, bis.y)
    const cdist = rr / Math.sin(ang / 2)
    const c = { x: p1.x + (bis.x / lbis) * cdist, y: p1.y + (bis.y / lbis) * cdist }
    const a0 = Math.atan2(s.y - c.y, s.x - c.x)
    const a1 = Math.atan2(e.y - c.y, e.x - c.x)
    let da = a1 - a0
    while (da > Math.PI) da -= 2 * Math.PI
    while (da < -Math.PI) da += 2 * Math.PI
    for (let k = 0; k <= 8; k++) {
      const aa = a0 + (da * k) / 8
      out.push({ x: c.x + rr * Math.cos(aa), y: c.y + rr * Math.sin(aa) })
    }
  }
  return out
}

export function pointInPolygon(p: V2, poly: V2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export const to3 = (pts: V2[], z = 0.02): Pt3[] => pts.map((p) => ({ x: p.x, y: p.y, z }))
const closed = (pts: V2[]) => [...pts, pts[0]]

function buildGul(d: CourseDims['gul']): Course {
  const sx = d.firstLeft ? -1 : 1 // 북쪽 진행 기준: 왼쪽 = 서쪽(-x)
  const c: V2[] = [
    { x: 0, y: -EXT },
    { x: 0, y: d.entry },
    { x: sx * d.between, y: d.entry },
    { x: sx * d.between, y: d.entry * 2 + EXT },
  ]
  const poly = roundCorners(corridorPolygon(c, d.width), d.corner, new Set([1, 2, 5, 6]))
  const ex = sx * d.between
  return {
    id: 'gul',
    name: '굴절코스',
    polygon: poly,
    lines: [closed(poly)],
    marks: [
      { pts: [{ x: -d.width / 2, y: 0 }, { x: d.width / 2, y: 0 }], color: '#ffffff', label: '입구' },
      { pts: [{ x: ex - d.width / 2, y: d.entry * 2 }, { x: ex + d.width / 2, y: d.entry * 2 }], color: '#ffffff', label: '출구' },
    ],
    start: { x: 0, y: -EXT + 0.6, yaw: Math.PI / 2 },
    finish: { point: { x: ex, y: d.entry * 2 }, dir: { x: 0, y: 1 } },
    description: `전진으로 들어가 ${d.firstLeft ? '좌회전 → 우회전' : '우회전 → 좌회전'}으로 지그재그를 통과`,
    goal: '차량 전체가 출구선을 지나면 완료',
  }
}

function buildS(d: CourseDims['s']): Course {
  const kappa = (d.firstLeft ? 1 : -1) / d.radius
  const ds = 0.25
  const n = Math.max(2, Math.round((d.radius * d.arcDeg * D2R) / ds))
  const c: V2[] = [{ x: 0, y: -EXT }]
  let x = 0
  let y = 0
  let h = Math.PI / 2
  c.push({ x, y })
  for (let seg = 0; seg < 2; seg++) {
    const k = seg === 0 ? kappa : -kappa
    for (let i = 0; i < n; i++) {
      x += Math.cos(h + (k * ds) / 2) * ds
      y += Math.sin(h + (k * ds) / 2) * ds
      h += k * ds
      c.push({ x, y })
    }
  }
  const end = { x, y }
  const dir = { x: Math.cos(h), y: Math.sin(h) }
  c.push({ x: x + dir.x * EXT, y: y + dir.y * EXT })
  const poly = corridorPolygon(c, d.width)
  const hw = d.width / 2
  return {
    id: 's',
    name: 'S자코스',
    polygon: poly,
    lines: [closed(poly)],
    marks: [
      { pts: [{ x: -hw, y: 0 }, { x: hw, y: 0 }], color: '#ffffff', label: '입구' },
      { pts: [{ x: end.x - dir.y * hw, y: end.y + dir.x * hw }, { x: end.x + dir.y * hw, y: end.y - dir.x * hw }], color: '#ffffff', label: '출구' },
    ],
    start: { x: 0, y: -EXT + 0.6, yaw: Math.PI / 2 },
    finish: { point: end, dir },
    description: `전진으로 들어가 ${d.firstLeft ? '왼쪽 → 오른쪽' : '오른쪽 → 왼쪽'}으로 두 번 꺾이는 S자를 통과`,
    goal: '차량 전체가 출구선을 지나면 완료',
  }
}

function buildTurn(d: CourseDims['turn']): Course {
  const w = d.width
  const L = -(EXT + d.entryLen)
  const R = w + d.entryLen
  const gl = d.garageLen
  const fy = (y: number) => (d.garageLeft ? y : w - y) // 차고가 오른쪽이면 y 반전
  const raw: V2[] = [
    { x: L, y: 0 },
    { x: R, y: 0 },
    { x: R, y: w },
    { x: w, y: w },
    { x: w, y: w + gl },
    { x: 0, y: w + gl },
    { x: 0, y: w },
    { x: L, y: w },
  ].map((p) => ({ x: p.x, y: fy(p.y) }))
  const poly = roundCorners(raw, d.corner, new Set([3, 4, 5, 6]))
  const chk = fy(w + gl - d.checkLine)
  const sy: 1 | -1 = d.garageLeft ? 1 : -1
  return {
    id: 'turn',
    name: 'T자코스',
    polygon: poly,
    lines: [closed(poly)],
    marks: [
      { pts: [{ x: 0, y: chk }, { x: w, y: chk }], color: '#ff5a5a', label: '확인선' },
      { pts: [{ x: -d.entryLen, y: fy(0) }, { x: -d.entryLen, y: fy(w) }], color: '#ffffff', label: '입구' },
    ],
    start: { x: L + 0.6, y: w / 2, yaw: 0 },
    garage: { x0: 0, x1: w, touchY: chk, touchDir: sy, returnY: d.garageLeft ? w - 0.4 : 0.4 },
    description: `직진 기준 ${d.garageLeft ? '왼쪽' : '오른쪽'}에 있는 차고에 후진 주차 후 전진으로 나옴`,
    goal: '뒷바퀴가 확인선에 닿은 뒤 통로로 되돌아 나오면 완료',
  }
}

export function getCourse(id: Exclude<CourseId, 'free'>, dims: CourseDims): Course {
  if (id === 'gul') return buildGul(dims.gul)
  if (id === 's') return buildS(dims.s)
  return buildTurn(dims.turn)
}

export const COURSE_LABEL: Record<CourseId, string> = {
  free: '자유 주행',
  gul: '굴절',
  s: 'S자',
  turn: 'T자',
}

export interface DimField { key: string; label: string; unit: string; bool?: [string, string] }
export const DIM_FIELDS: Record<Exclude<CourseId, 'free'>, DimField[]> = {
  gul: [
    { key: 'width', label: '코스 폭', unit: 'm' },
    { key: 'entry', label: '출입구 쪽 직선 길이', unit: 'm' },
    { key: 'between', label: '두 모퉁이 사이 길이', unit: 'm' },
    { key: 'corner', label: '모퉁이 반경', unit: 'm' },
    { key: 'firstLeft', label: '첫 꺾임', unit: '', bool: ['왼쪽', '오른쪽'] },
  ],
  s: [
    { key: 'width', label: '코스 폭', unit: 'm' },
    { key: 'radius', label: '중심선 반경', unit: 'm' },
    { key: 'arcDeg', label: '꺾임 각도(한 번당)', unit: '°' },
    { key: 'firstLeft', label: '첫 꺾임', unit: '', bool: ['왼쪽', '오른쪽'] },
  ],
  turn: [
    { key: 'width', label: '통로·차고 폭', unit: 'm' },
    { key: 'garageLen', label: '차고 깊이', unit: 'm' },
    { key: 'entryLen', label: '차고 양옆 통로 길이', unit: 'm' },
    { key: 'corner', label: '모퉁이 반경', unit: 'm' },
    { key: 'checkLine', label: '확인선(차고 끝에서)', unit: 'm' },
    { key: 'garageLeft', label: '차고 위치(직진 기준)', unit: '', bool: ['왼쪽', '오른쪽'] },
  ],
}
