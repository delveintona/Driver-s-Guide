// 아주 작은 핀홀 와이어프레임 렌더러. 월드: x=동, y=북, z=위 (미터).

export interface Camera {
  x: number
  y: number
  z: number
  /** 라디안. 바라보는 수평 방향 (π/2 = 북쪽) */
  yaw: number
  /** 라디안. 아래로 숙인 각도 (π/2 = 수직 아래) */
  pitch: number
  /** 초점거리(px) */
  f: number
  w: number
  h: number
}

export interface Pt3 {
  x: number
  y: number
  z: number
}

interface CamPt {
  r: number // 오른쪽
  u: number // 위
  d: number // 깊이
}

const NEAR = 0.25

function toCam(c: Camera, p: Pt3): CamPt {
  const dx = p.x - c.x
  const dy = p.y - c.y
  const dz = p.z - c.z
  const fx = Math.cos(c.yaw)
  const fy = Math.sin(c.yaw)
  const fwd = dx * fx + dy * fy
  const right = dx * fy - dy * fx
  const cp = Math.cos(c.pitch)
  const sp = Math.sin(c.pitch)
  return { r: right, u: fwd * sp + dz * cp, d: fwd * cp - dz * sp }
}

function toScreen(c: Camera, p: CamPt): [number, number] {
  return [c.w / 2 + (c.f * p.r) / p.d, c.h / 2 - (c.f * p.u) / p.d]
}

function clipNear(poly: CamPt[]): CamPt[] {
  const out: CamPt[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const ain = a.d >= NEAR
    const bin = b.d >= NEAR
    if (ain) out.push(a)
    if (ain !== bin) {
      const t = (NEAR - a.d) / (b.d - a.d)
      out.push({ r: a.r + (b.r - a.r) * t, u: a.u + (b.u - a.u) * t, d: NEAR })
    }
  }
  return out
}

export function project(c: Camera, p: Pt3): [number, number] | null {
  const cp = toCam(c, p)
  if (cp.d < NEAR) return null
  return toScreen(c, cp)
}

export function drawPolyline3(
  ctx: CanvasRenderingContext2D,
  c: Camera,
  pts: Pt3[],
  style: { stroke: string; width?: number; dash?: number[] },
) {
  ctx.strokeStyle = style.stroke
  ctx.lineWidth = style.width ?? 1
  ctx.setLineDash(style.dash ?? [])
  ctx.beginPath()
  let pen = false
  for (let i = 0; i < pts.length; i++) {
    const cur = toCam(c, pts[i])
    if (i === 0) {
      if (cur.d >= NEAR) {
        const [sx, sy] = toScreen(c, cur)
        ctx.moveTo(sx, sy)
        pen = true
      }
      continue
    }
    const prev = toCam(c, pts[i - 1])
    let a = prev
    let b = cur
    if (a.d < NEAR && b.d < NEAR) {
      pen = false
      continue
    }
    if (a.d < NEAR) {
      const t = (NEAR - a.d) / (b.d - a.d)
      a = { r: a.r + (b.r - a.r) * t, u: a.u + (b.u - a.u) * t, d: NEAR }
      pen = false
    } else if (b.d < NEAR) {
      const t = (NEAR - a.d) / (b.d - a.d)
      b = { r: a.r + (b.r - a.r) * t, u: a.u + (b.u - a.u) * t, d: NEAR }
    }
    const [ax, ay] = toScreen(c, a)
    const [bx, by] = toScreen(c, b)
    if (!pen) ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    pen = true
  }
  ctx.stroke()
  ctx.setLineDash([])
}

export interface Box {
  cx: number
  cy: number
  yaw: number
  /** 진행 방향 길이 */
  len: number
  /** 좌우 폭 */
  wid: number
  z0: number
  z1: number
  fill: string
  stroke: string
  alpha?: number
}

function boxFaces(b: Box): Pt3[][] {
  const cos = Math.cos(b.yaw)
  const sin = Math.sin(b.yaw)
  const hl = b.len / 2
  const hw = b.wid / 2
  const corner = (l: number, w: number, z: number): Pt3 => ({
    x: b.cx + l * cos - w * sin,
    y: b.cy + l * sin + w * cos,
    z,
  })
  const bot = [corner(hl, hw, b.z0), corner(hl, -hw, b.z0), corner(-hl, -hw, b.z0), corner(-hl, hw, b.z0)]
  const top = [corner(hl, hw, b.z1), corner(hl, -hw, b.z1), corner(-hl, -hw, b.z1), corner(-hl, hw, b.z1)]
  const faces: Pt3[][] = [top]
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    faces.push([bot[i], bot[j], top[j], top[i]])
  }
  return faces
}

/** 거리순(먼 것부터)으로 그려야 해서 박스 단위로 깊이를 반환 */
export function boxDepth(c: Camera, b: Box): number {
  return toCam(c, { x: b.cx, y: b.cy, z: (b.z0 + b.z1) / 2 }).d
}

export function drawBox(ctx: CanvasRenderingContext2D, c: Camera, b: Box) {
  const faces = boxFaces(b)
  const items = faces.map((f) => {
    const cam = f.map((p) => toCam(c, p))
    const depth = cam.reduce((s, p) => s + p.d, 0) / cam.length
    return { cam, depth }
  })
  items.sort((a, z) => z.depth - a.depth)
  ctx.lineJoin = 'round'
  for (const it of items) {
    const poly = clipNear(it.cam)
    if (poly.length < 3) continue
    ctx.beginPath()
    poly.forEach((p, i) => {
      const [sx, sy] = toScreen(c, p)
      if (i === 0) ctx.moveTo(sx, sy)
      else ctx.lineTo(sx, sy)
    })
    ctx.closePath()
    ctx.globalAlpha = b.alpha ?? 0.85
    ctx.fillStyle = b.fill
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = b.stroke
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

/** 지면(또는 일정 높이)의 다각형을 채운다 */
export function fillPolygon3(ctx: CanvasRenderingContext2D, c: Camera, pts: Pt3[], fill: string) {
  const poly = clipNear(pts.map((p) => toCam(c, p)))
  if (poly.length < 3) return
  ctx.beginPath()
  poly.forEach((p, i) => {
    const [sx, sy] = toScreen(c, p)
    if (i === 0) ctx.moveTo(sx, sy)
    else ctx.lineTo(sx, sy)
  })
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

/** project + 카메라 깊이(m) */
export function projectD(c: Camera, p: Pt3): [number, number, number] | null {
  const cp = toCam(c, p)
  if (cp.d < NEAR) return null
  const [x, y] = toScreen(c, cp)
  return [x, y, cp.d]
}
