import type { Box } from './render3d'

export interface Geometry {
  L: number
  W: number
  H: number
  wheelbase: number
  frontOverhang: number
  rearOverhang: number
  cabLength: number
  cargoHeight: number
  maxSteerDeg: number
}

/** 기준점 = 뒷바퀴 축 중심. 저속 단일 전륜 조향 bicycle model */
export interface CarState {
  x: number
  y: number
  yaw: number
  /** 현재 앞바퀴 조향각(rad) */
  steer: number
  v: number
}

export const START: CarState = { x: 1.9, y: -8, yaw: Math.PI / 2, steer: 0, v: 0 }

export function stepCar(s: CarState, g: Geometry, dt: number): CarState {
  const x = s.x + s.v * Math.cos(s.yaw) * dt
  const y = s.y + s.v * Math.sin(s.yaw) * dt
  const yaw = s.yaw + (s.v * Math.tan(s.steer)) / g.wheelbase * dt
  return { ...s, x, y, yaw }
}

/** 차체 외곽 네 모서리 (뒷축 기준, 차량 좌표 → 월드) */
export function bodyCorners(s: { x: number; y: number; yaw: number }, g: Geometry) {
  const cos = Math.cos(s.yaw)
  const sin = Math.sin(s.yaw)
  const front = g.wheelbase + g.frontOverhang
  const rear = -g.rearOverhang
  const hw = g.W / 2
  const w = (l: number, side: number) => ({
    x: s.x + l * cos - side * sin,
    y: s.y + l * sin + side * cos,
    z: 0.02,
  })
  return {
    fl: w(front, hw),
    fr: w(front, -hw),
    rl: w(rear, hw),
    rr: w(rear, -hw),
  }
}

export type CornerKey = 'fl' | 'fr' | 'rl' | 'rr'

/** 현재 조향각을 유지한 채 distance(m)만큼 진행할 때 네 모서리의 예상 궤적 */
export function predictPaths(s: CarState, g: Geometry, distance: number, dir: 1 | -1) {
  const out: Record<CornerKey, { x: number; y: number; z: number }[]> = { fl: [], fr: [], rl: [], rr: [] }
  let cur: CarState = { ...s, v: dir }
  const ds = 0.25
  const n = Math.ceil(distance / ds)
  for (let i = 0; i <= n; i++) {
    const c = bodyCorners(cur, g)
    out.fl.push(c.fl)
    out.fr.push(c.fr)
    out.rl.push(c.rl)
    out.rr.push(c.rr)
    cur = stepCar(cur, g, ds)
  }
  return out
}

export const LANE_W = 3.25

/** 크기 비교용 실물 기준 객체들 (모두 예시 치수) */
export interface RefObject {
  label: string
  boxes: Box[]
  /** 라벨 위치 */
  at: { x: number; y: number; z: number }
}

export const person = (x: number, y: number, label = '사람 1.7 m'): RefObject => ({
  label,
  at: { x, y, z: 1.9 },
  boxes: [
    { cx: x, cy: y, yaw: 0, len: 0.3, wid: 0.5, z0: 0, z1: 1.45, fill: '#e8b64c', stroke: '#6b4e0a' },
    { cx: x, cy: y, yaw: 0, len: 0.22, wid: 0.22, z0: 1.45, z1: 1.7, fill: '#f0d49a', stroke: '#6b4e0a' },
  ],
})

export const sedan = (x: number, y: number, yaw: number, label = '승용차 4.7×1.85 m'): RefObject => ({
  label,
  at: { x, y, z: 1.9 },
  boxes: [
    { cx: x, cy: y, yaw, len: 4.7, wid: 1.85, z0: 0.25, z1: 0.95, fill: '#7d8ea3', stroke: '#2d3b4d' },
    {
      cx: x - Math.cos(yaw) * 0.2,
      cy: y - Math.sin(yaw) * 0.2,
      yaw,
      len: 2.4,
      wid: 1.6,
      z0: 0.95,
      z1: 1.45,
      fill: '#9db0c6',
      stroke: '#2d3b4d',
    },
  ],
})

const container = (x: number, y: number, yaw: number): RefObject => ({
  label: '20피트 컨테이너 6.06×2.44×2.59 m',
  at: { x, y, z: 2.9 },
  boxes: [{ cx: x, cy: y, yaw, len: 6.06, wid: 2.44, z0: 0, z1: 2.59, fill: '#b5532f', stroke: '#4a1f0d' }],
})

const cone = (x: number, y: number): Box => ({
  cx: x, cy: y, yaw: 0, len: 0.3, wid: 0.3, z0: 0, z1: 0.7, fill: '#ff7a1a', stroke: '#7a2e00',
})

export function buildScene(): { refs: RefObject[]; cones: Box[] } {
  return {
    refs: [
      person(4.6, 6),
      person(-4.6, 14),
      sedan(-1.6, 18, Math.PI / 2),
      sedan(1.6, 34, -Math.PI / 2),
      container(-9, 10, Math.PI / 2),
      sedan(9.75, 2.6, Math.PI / 2, '주차칸(2.5×5 m) 속 승용차'),
    ],
    cones: [
      cone(-3.6, 26), cone(-3.6, 30), cone(3.6, 38), cone(3.6, 42),
      cone(6, 7), cone(18.5, 7),
    ],
  }
}

/** 지면에 그릴 선들: 차로선, 주차칸 */
export function groundLines() {
  const lines: { pts: { x: number; y: number; z: number }[]; color: string; width: number; dash?: number[]; label?: string }[] = []
  const y0 = -40
  const y1 = 90
  const edge = LANE_W
  const p = (x: number, y: number) => ({ x, y, z: 0 })
  // 도로 가장자리, 중앙선(점선)
  lines.push({ pts: [p(-edge, y0), p(-edge, y1)], color: '#e8e8e8', width: 2 })
  lines.push({ pts: [p(edge, y0), p(edge, y1)], color: '#e8e8e8', width: 2 })
  lines.push({ pts: [p(0, y0), p(0, y1)], color: '#ffd23f', width: 2, dash: [6, 6] })
  // 주차칸 (2.5 x 5.0), 도로 오른쪽
  for (let i = 0; i < 6; i++) {
    const x = 6 + i * 2.5
    lines.push({ pts: [p(x, 0), p(x, 5)], color: '#cfd8e3', width: 1.5 })
  }
  lines.push({ pts: [p(6, 0), p(6 + 2.5 * 5, 0)], color: '#cfd8e3', width: 1.5 })
  return lines
}
