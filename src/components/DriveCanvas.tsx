import { useEffect, useMemo, useRef, useState } from 'react'
import type { Vehicle } from '../data/vehicles'
import { vehicleGeometry } from '../data/vehicles'
import {
  boxDepth, drawBox, drawPolyline3, fillPolygon3, project,
  type Box, type Camera, type Pt3,
} from '../lib/render3d'
import {
  START, bodyCorners, buildScene, groundLines, predictPaths, stepCar,
  type CarState, type CornerKey,
} from '../lib/sim'
import {
  COURSE_LABEL, DEFAULT_DIMS, DIM_FIELDS, getCourse, pointInPolygon, to3,
  type Course, type CourseDims, type CourseId, type V2,
} from '../lib/courses'
import SteeringWheel, { WHEEL_LOCK_DEG } from './SteeringWheel'
import { getWorld, roadAt, startPose, type RoadHit } from '../lib/roadworld'

export type DriveMode = 'cab' | 'chase' | 'top'
type Geo = ReturnType<typeof vehicleGeometry>
type Gear = 'R' | 'N' | 'D'

interface Props {
  vehicle: Vehicle
  mode: DriveMode
  /** 가로 화면 레이아웃(타보기) */
  landscape?: boolean
  headerSlot?: React.ReactNode
  /** 세로 화면을 90° 돌려 쓰는 중이면 터치 좌표도 돌려서 해석 */
  rotated?: boolean
  /** 운전 시험 모드: 굴절·S자·T자 코스 + 접촉 2회 허용 + 2분 제한 */
  exam?: boolean
  /** 도로주행: 철원 동송 지도(OpenStreetMap) 위를 최대 60km/h로 */
  road?: boolean
}

const SKY: Record<DriveMode, string> = { cab: '#2a3a4a', chase: '#2a3a4a', top: '#1d2a1c' }
const GROUND = '#2b3326'
const CORNER_COLOR: Record<CornerKey, string> = { fl: '#ff6b6b', fr: '#ffa94d', rl: '#4dd0e1', rr: '#69db7c' }
const WHEEL_LEN = 1.0
const WHEEL_WID = 0.3
const MAP_PX_PER_M = 22 // 시험 모드 지도 축척: 어느 코스든 1 m가 이 픽셀 수
const MAP_ZOOM = 4 // 시험 모드 '위에서 보기': 내 차를 따라가며 선과의 간격이 보이는 배율
const MAX_ROAD_V = 60 / 3.6 // 도로주행 최고속도 60km/h
const TIME_LIMIT = 180 // 초 (3분 넘으면 실격)
const SOFT_LIMIT = 120 // 2분 넘으면 감점 구간(감점 기준은 미확인)
const MAX_CONTACTS = 2 // 바퀴가 선을 넘은 횟수, 2번까지 허용
const COURSE_VEHICLE = 'k511' // T·굴절·S 시험 코스는 두돈반만
const DIMS_KEY = 'drivers-guide.courseDims.v1'

interface Judge {
  contacts: number


  started: number | null
  elapsed: number
  failed: 'contacts' | 'time' | null
  done: boolean
  touched: boolean
  marks: V2[]
}
const newJudge = (): Judge => ({ contacts: 0, started: null, elapsed: 0, failed: null, done: false, touched: false, marks: [] })

function loadDims(): CourseDims {
  try {
    const raw = localStorage.getItem(DIMS_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return {
        gul: { ...DEFAULT_DIMS.gul, ...p.gul },
        s: { ...DEFAULT_DIMS.s, ...p.s },
        turn: { ...DEFAULT_DIMS.turn, ...p.turn },
      }
    }
  } catch { /* noop */ }
  return structuredClone(DEFAULT_DIMS)
}

function startState(g: Geo, course: Course | null, road?: boolean): CarState {
  if (road) {
    const sp = startPose()
    return { x: sp.x, y: sp.y, yaw: sp.yaw, steer: 0, v: 0 }
  }
  if (!course) return { ...START }
  const dir = { x: Math.cos(course.start.yaw), y: Math.sin(course.start.yaw) }
  return {
    x: course.start.x + dir.x * g.rearOverhang,
    y: course.start.y + dir.y * g.rearOverhang,
    yaw: course.start.yaw,
    steer: 0,
    v: 0,
  }
}

const toWorld = (s: { x: number; y: number; yaw: number }, l: number, side: number): V2 => ({
  x: s.x + Math.cos(s.yaw) * l - Math.sin(s.yaw) * side,
  y: s.y + Math.sin(s.yaw) * l + Math.cos(s.yaw) * side,
})

function wheelPoints(s: CarState, g: Geo): V2[][] {
  const res: V2[][] = []
  for (const a of [...rearAxles(g), g.wheelbase]) {
    for (const side of [g.W / 2 - 0.15, -(g.W / 2 - 0.15)]) {
      const steer = a === g.wheelbase ? s.steer : 0
      const c = toWorld(s, a, side)
      const yaw = s.yaw + steer
      const pts: V2[] = []
      for (const [dl, dw] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
        pts.push({
          x: c.x + Math.cos(yaw) * (dl * WHEEL_LEN / 2) - Math.sin(yaw) * (dw * WHEEL_WID / 2),
          y: c.y + Math.sin(yaw) * (dl * WHEEL_LEN / 2) + Math.cos(yaw) * (dw * WHEEL_WID / 2),
        })
      }
      res.push(pts)
    }
  }
  return res
}

const mirrorFwd = (g: Geo) => g.wheelbase + g.frontOverhang - 0.2
const eyeOf = (s: CarState, g: Geo) => toWorld(s, g.wheelbase + g.frontOverhang - 1.9, 0.3)
const bodyPoints = (s: CarState, g: Geo): V2[] => {
  const f = g.wheelbase + g.frontOverhang
  const r = -g.rearOverhang
  const h = g.W / 2
  return [toWorld(s, f, h), toWorld(s, f, -h), toWorld(s, r, h), toWorld(s, r, -h)]
}
const rearAxles = (g: Geo) => (g.tandem > 0 ? [-g.tandem / 2, g.tandem / 2] : [0])
const gearSign = (g: Gear) => (g === 'D' ? 1 : g === 'R' ? -1 : 0)

/** 타보기 화면 핸들 위치(캔버스 px) */
const wheelLayout = (w: number, h: number) => {
  const r = Math.min(h * 0.3, w * 0.14)
  return { cx: w * 0.47, cy: h * 0.9, r, ry: r * 0.42 }
}

export default function DriveCanvas({ vehicle, mode, landscape, headerSlot, rotated, exam, road }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const geo = vehicleGeometry(vehicle)
  const geoRef = useRef(geo)
  geoRef.current = geo
  const modeRef = useRef(mode)
  modeRef.current = mode
  const landRef = useRef(!!landscape)
  landRef.current = !!landscape
  const hoodRef = useRef(geo.hood)
  hoodRef.current = geo.hood
  const roadRef = useRef(!!road)
  roadRef.current = !!road
  const roadInfo = useRef<RoadHit | null>(null)

  const courseOk = !!exam && vehicle.id === COURSE_VEHICLE
  const [courseId, setCourseId] = useState<CourseId>(exam ? 'gul' : 'free')
  const [dims, setDims] = useState<CourseDims>(loadDims)
  const course = useMemo(
    () => (courseOk && courseId !== 'free' ? getCourse(courseId, dims) : null),
    [courseOk, courseId, dims],
  )
  const courseRef = useRef<Course | null>(null)
  courseRef.current = course

  const car = useRef<CarState>({ ...START })
  const input = useRef({ gas: 0, key: 0, brake: false })
  const gearRef = useRef<Gear>('D')
  const leverUntil = useRef(0)
  const steerRef = useRef(0)
  const look = useRef({ yaw: 0, pitch: 0 }) // yaw +: 왼쪽, pitch +: 위
  const lookDrag = useRef<{ x: number; y: number } | null>(null)
  const trail = useRef<Record<CornerKey, Pt3[]>>({ fl: [], fr: [], rl: [], rr: [] })
  const camYaw = useRef(START.yaw)
  const judge = useRef<Judge>(newJudge())
  const wasOut = useRef({ wheel: false })
  const toastRef = useRef<{ text: string; until: number } | null>(null)

  const [steerUi, setSteerUi] = useState(0)
  const [gearUi, setGearUi] = useState<Gear>('D')
  const [showTrail, setShowTrail] = useState(true)
  const [showPredict, setShowPredict] = useState(true)
  const [showGuide, setShowGuide] = useState(true)
  const [showMap, setShowMap] = useState(!!exam)
  const [zoom, setZoom] = useState(1)
  const mapZoom = MAP_ZOOM
  const flags = useRef({ showTrail, showPredict, showGuide, showMap, zoom, mapZoom })
  flags.current = { showTrail, showPredict, showGuide, showMap, zoom, mapZoom }
  const [hud, setHud] = useState({ speed: 0, dir: 'N' as 'D' | 'R' | 'N', limit: 0, road: '', off: false })
  const [jui, setJui] = useState<Judge>(newJudge())
  const [showSpec, setShowSpec] = useState(false)
  const [dim, setDim] = useState({ w: 800, h: 360 })
  const scene = useRef(buildScene())

  const setGear = (g: Gear) => {
    gearRef.current = g
    setGearUi(g)
    leverUntil.current = performance.now() + 1500
    if (g === 'N') input.current.gas = 0
  }

  const reset = () => {
    car.current = startState(geoRef.current, courseRef.current, roadRef.current)
    trail.current = { fl: [], fr: [], rl: [], rr: [] }
    camYaw.current = car.current.yaw
    steerRef.current = 0
    look.current = { yaw: 0, pitch: 0 }
    input.current = { gas: 0, key: 0, brake: false }
    gearRef.current = 'D'
    setGearUi('D')
    judge.current = newJudge()
    wasOut.current = { wheel: false }
    setSteerUi(0)
    setJui(newJudge())
  }

  useEffect(() => {
    reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id, course])

  useEffect(() => {
    if (!courseOk && courseId !== 'free') setCourseId('free')
  }, [courseOk, courseId])

  const updateDims = (id: Exclude<CourseId, 'free'>, key: string, value: number | boolean) => {
    setDims((d) => {
      const next = { ...d, [id]: { ...d[id], [key]: value } } as CourseDims
      try { localStorage.setItem(DIMS_KEY, JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
  }
  const resetDims = (id: Exclude<CourseId, 'free'>) => {
    setDims((d) => {
      const next = { ...d, [id]: structuredClone(DEFAULT_DIMS[id]) } as CourseDims
      try { localStorage.setItem(DIMS_KEY, JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w') input.current.gas = 1
      if (e.key === 'ArrowDown' || e.key === 's') input.current.gas = -1
      if (e.key === 'ArrowLeft' || e.key === 'a') input.current.key = -1
      if (e.key === 'ArrowRight' || e.key === 'd') input.current.key = 1
      if (e.key === ' ') input.current.brake = true
    }
    const up = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'w', 's'].includes(e.key)) input.current.gas = 0
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) input.current.key = 0
      if (e.key === ' ') input.current.brake = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let last = performance.now()
    let hudAcc = 0
    let size = { w: 300, h: 300 }

    const resize = () => {
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      const dpr = window.devicePixelRatio || 1
      size = { w, h }
      setDim({ w, h })
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const evaluate = (now: number) => {
      const course = courseRef.current
      const j = judge.current
      if (!course) return
      const s = car.current
      const g = geoRef.current
      if (j.started == null && Math.abs(s.v) > 0.05) j.started = now
      if (j.started != null && !j.done && !j.failed) j.elapsed = (now - j.started) / 1000
      if (j.done || j.failed) return
      if (j.elapsed >= TIME_LIMIT) {
        j.elapsed = TIME_LIMIT
        j.failed = 'time'
        toastRef.current = { text: '3분 초과 → 시험 종료', until: now + 3000 }
        return
      }

      const wheelOut = wheelPoints(s, g).flat().find((p) => !pointInPolygon(p, course.polygon))
      if (wheelOut && !wasOut.current.wheel) {
        j.contacts++
        j.marks.push(wheelOut)
        if (j.contacts > MAX_CONTACTS) {
          j.failed = 'contacts'
          toastRef.current = { text: `검지선 접촉 ${j.contacts}회 → 시험 종료`, until: now + 3000 }
        } else {
          toastRef.current = { text: `검지선 접촉 ${j.contacts}/${MAX_CONTACTS} (바퀴)`, until: now + 1400 }
        }
      }
      wasOut.current.wheel = !!wheelOut

      if (course.finish) {
        const f = course.finish
        const allPast = bodyPoints(s, g).every((p) => (p.x - f.point.x) * f.dir.x + (p.y - f.point.y) * f.dir.y > 0)
        if (allPast && !wheelOut) j.done = true
      } else if (course.garage) {
        const gr = course.garage
        const rearWheels = wheelPoints(s, g).slice(0, 2).flat()
        if (!j.touched && rearWheels.some((p) => (p.y - gr.touchY) * gr.touchDir >= 0 && p.x > gr.x0 && p.x < gr.x1)) {
          j.touched = true
          toastRef.current = { text: '뒷바퀴가 확인선에 닿음 → 전진으로 나오세요', until: now + 2200 }
        }
        if (j.touched && (s.y - gr.returnY) * gr.touchDir < 0) j.done = true
      }
    }

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const g = geoRef.current
      const s = car.current

      if (input.current.key !== 0) {
        steerRef.current = Math.max(-1, Math.min(1, steerRef.current + input.current.key * dt * 0.9))
      }
      const rd = roadRef.current
      if (rd) roadInfo.current = roadAt(s.x, s.y, 0.5)
      const offRoad = rd && !roadInfo.current
      const fwdMax = rd ? (offRoad ? 6 : MAX_ROAD_V) : 3
      const maxV = input.current.gas >= 0 ? fwdMax : rd ? 3 : 1.6
      let targetV = input.current.gas * maxV
      let acc = input.current.gas === 0 ? (rd ? 0.6 : 4) : rd && input.current.gas > 0 ? 2.6 - 1.7 * Math.min(1, Math.abs(s.v) / MAX_ROAD_V) : 1.6
      if (rd && offRoad && s.v > fwdMax) { targetV = fwdMax; acc = 3 } // 도로 밖(풀밭)에서는 속도가 빠르게 줄어든다
      if (input.current.brake || judge.current.failed) { targetV = 0; acc = rd ? 7 : 8 }
      s.v += Math.sign(targetV - s.v) * Math.min(Math.abs(targetV - s.v), acc * dt)
      const maxSteer = (g.maxSteerDeg * Math.PI) / 180
      // 도로주행: 속도가 빠를수록 같은 핸들 각도에서 앞바퀴가 덜 꺾이게 한다(옆가속도 약 3.2 m/s² 이내)
      const vAbs = Math.abs(s.v)
      const effMax = rd ? Math.min(maxSteer, Math.atan((3.2 * g.wheelbase) / Math.max(vAbs * vAbs, 1))) : maxSteer
      const targetSteer = -steerRef.current * effMax // 핸들 오른쪽(+) = 우회전
      const rate = (rd ? 0.5 : 0.7) * dt
      s.steer += Math.sign(targetSteer - s.steer) * Math.min(Math.abs(targetSteer - s.steer), rate)
      car.current = stepCar(s, g, dt)

      if (Math.abs(car.current.v) > 0.05) {
        const c = bodyCorners(car.current, g)
        for (const k of ['fl', 'fr', 'rl', 'rr'] as CornerKey[]) {
          const arr = trail.current[k]
          const lastPt = arr[arr.length - 1]
          if (!lastPt || Math.hypot(lastPt.x - c[k].x, lastPt.y - c[k].y) > 0.2) {
            arr.push(c[k])
            if (arr.length > 500) arr.shift()
          }
        }
      }
      evaluate(now)

      hudAcc += dt
      if (hudAcc > 0.12) {
        hudAcc = 0
        const v = car.current.v
        const ri = roadInfo.current
        setHud({
          speed: Math.abs(v) * 3.6,
          dir: Math.abs(v) < 0.05 ? 'N' : v > 0 ? 'D' : 'R',
          limit: ri ? ri.road.limit : 0,
          road: ri ? ri.road.name || '이름 없는 도로' : '',
          off: roadRef.current && !ri,
        })
        if (input.current.key !== 0) setSteerUi(steerRef.current)
        if (courseRef.current) setJui({ ...judge.current })
      }

      draw(now)
      raf = requestAnimationFrame(frame)
    }

    /** 코스 전체가 들어오는 고정 탑뷰(코스 없으면 차량 따라가기) */
    const topCam = (w: number, h: number, mz = 1): Camera => {
      const g = geoRef.current
      const s = car.current
      const fl = flags.current
      const mn = Math.min(w, h)
      const c = courseRef.current
      let height = (g.L * 2.2 + 8) / fl.zoom
      if (roadRef.current && !c) height = 80
      let ox = s.x + Math.cos(s.yaw) * (g.wheelbase / 2)
      let oy = s.y + Math.sin(s.yaw) * (g.wheelbase / 2) + 0.01
      if (c) {
        const xs = c.polygon.map((p) => p.x)
        const ys = c.polygon.map((p) => p.y)
        const bw = Math.max(...xs) - Math.min(...xs)
        const bh = Math.max(...ys) - Math.min(...ys)
        ox = (Math.max(...xs) + Math.min(...xs)) / 2
        oy = (Math.max(...ys) + Math.min(...ys)) / 2
        height = Math.max(bw / (0.78 * 1.24 * (w / mn)), bh / (0.78 * 1.24 * (h / mn)))
        if (modeRef.current === 'top') height /= fl.zoom
        if (mz <= 1.01) height /= mz
        if (mz > 1.01) {
          // 코스 크기와 상관없이 항상 같은 축척(1 m = MAP_PX_PER_M px)으로 보여준다
          height = mn / 2 / 0.62 / MAP_PX_PER_M
          // 확대하면 내 차를 따라가며 간격을 자세히 볼 수 있게 한다
          ox = s.x + Math.cos(s.yaw) * (g.wheelbase / 2)
          oy = s.y + Math.sin(s.yaw) * (g.wheelbase / 2)
        }
      }
      return { x: ox, y: oy, z: height, yaw: Math.PI / 2, pitch: Math.PI / 2 - 0.0001, f: mn / 2 / 0.62, w, h }
    }

    const makeCam = (m: DriveMode): Camera => {
      const g = geoRef.current
      const s = car.current
      const fl = flags.current
      const { w, h } = size
      if (m === 'top') return topCam(w, h)
      const cx = s.x + Math.cos(s.yaw) * (g.wheelbase / 2)
      const cy = s.y + Math.sin(s.yaw) * (g.wheelbase / 2)
      const cam: Camera = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, f: 0, w, h }
      if (m === 'chase') {
        let d = s.yaw - camYaw.current
        d = Math.atan2(Math.sin(d), Math.cos(d))
        camYaw.current += d * 0.08
        const back = (g.L * 1.1 + 5) / fl.zoom
        Object.assign(cam, {
          x: cx - Math.cos(camYaw.current) * back,
          y: cy - Math.sin(camYaw.current) * back,
          z: (g.H * 0.9 + 3) / Math.sqrt(fl.zoom),
          yaw: camYaw.current, pitch: 0.38, f: Math.min(w, h * 0.95) * 0.95,
        })
      } else {
        const p = eyeOf(s, g)
        Object.assign(cam, {
          x: p.x, y: p.y, z: Math.min(g.H - 0.25, g.H * 0.78 + 0.15),
          yaw: s.yaw + look.current.yaw, pitch: 0.04 - look.current.pitch, f: w * 0.33,
        })
      }
      return cam
    }

    /** 동송 도로·건물을 그린다(가까운 것만) */
    const drawRoadWorld = (ctx: CanvasRenderingContext2D, cam: Camera, m: DriveMode, light: boolean) => {
      const wd = getWorld()
      const R = light ? 100 : m === 'top' ? 120 : 230
      const nearBox = (b: [number, number, number, number]) => !(b[0] > cam.x + R || b[2] < cam.x - R || b[1] > cam.y + R || b[3] < cam.y - R)
      const rs = wd.roads.filter((r) => nearBox(r.bbox))
      for (const r of rs) fillPolygon3(ctx, cam, to3(r.poly, 0.01), r.k === 'v' ? '#585b5e' : '#4a4d52')
      for (const r of rs) {
        if (r.width >= 5.5) {
          drawPolyline3(ctx, cam, to3(r.left, 0.02), { stroke: 'rgba(235,235,235,0.75)', width: 1.4 })
          drawPolyline3(ctx, cam, to3(r.right, 0.02), { stroke: 'rgba(235,235,235,0.75)', width: 1.4 })
        }
        if (!r.oneway && r.width >= 6) drawPolyline3(ctx, cam, to3(r.pts, 0.02), { stroke: '#ffd23f', width: 1.6, dash: [10, 10] })
      }
      const dist = (x: number, y: number) => Math.hypot(x - cam.x, y - cam.y)
      const bl = wd.buildings.filter((b) => dist(b.cx, b.cy) < R).sort((a, b) => dist(b.cx, b.cy) - dist(a.cx, a.cy))
      for (const b of bl) {
        const n = b.pts.length
        const edges = b.pts.map((a, i) => {
          const c = b.pts[(i + 1) % n]
          return { a, c, d: dist((a.x + c.x) / 2, (a.y + c.y) / 2) }
        }).sort((x, y) => y.d - x.d)
        edges.forEach((e, i) => {
          const quad: Pt3[] = [
            { x: e.a.x, y: e.a.y, z: 0 }, { x: e.c.x, y: e.c.y, z: 0 },
            { x: e.c.x, y: e.c.y, z: b.h }, { x: e.a.x, y: e.a.y, z: b.h },
          ]
          fillPolygon3(ctx, cam, quad, i % 2 ? '#a39d90' : '#908b7f')
          drawPolyline3(ctx, cam, [...quad, quad[0]], { stroke: 'rgba(0,0,0,0.35)', width: 1 })
        })
        fillPolygon3(ctx, cam, b.pts.map((p) => ({ x: p.x, y: p.y, z: b.h })), '#6d7470')
      }
    }

    const drawWorld = (ctx: CanvasRenderingContext2D, cam: Camera, m: DriveMode, opts: { labels: boolean; light?: boolean }) => {
      const g = geoRef.current
      const s = car.current
      const fl = flags.current
      const course = courseRef.current
      const { w, h } = cam
      ctx.fillStyle = SKY[m]
      ctx.fillRect(0, 0, w, h)

      ctx.fillStyle = roadRef.current ? '#3d4a2c' : GROUND
      if (m !== 'top') {
        const hz = project(cam, { x: cam.x + Math.cos(cam.yaw) * 400, y: cam.y + Math.sin(cam.yaw) * 400, z: 0 })
        const hy = hz ? hz[1] : h / 2
        ctx.fillRect(0, Math.max(0, hy), w, h - Math.max(0, hy))
      } else ctx.fillRect(0, 0, w, h)

      const gridR = roadRef.current ? -1 : m === 'top' ? Math.ceil(cam.z * 0.9) : 40
      const gx0 = Math.floor(cam.x - gridR)
      const gy0 = Math.floor(cam.y - gridR)
      for (let i = 0; i <= gridR * 2; i++) {
        const gxx = gx0 + i
        const gyy = gy0 + i
        const major = (n: number) => Math.round(n) % 5 === 0
        drawPolyline3(ctx, cam, [{ x: gxx, y: gy0, z: 0 }, { x: gxx, y: gy0 + gridR * 2, z: 0 }], { stroke: major(gxx) ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.045)' })
        drawPolyline3(ctx, cam, [{ x: gx0, y: gyy, z: 0 }, { x: gx0 + gridR * 2, y: gyy, z: 0 }], { stroke: major(gyy) ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.045)' })
      }

      if (course) {
        fillPolygon3(ctx, cam, to3(course.polygon, 0.01), 'rgba(78,84,70,0.95)')
        for (const ln of course.lines) drawPolyline3(ctx, cam, to3(ln), { stroke: '#ffd23f', width: 2.5 })
        for (const mk of course.marks) drawPolyline3(ctx, cam, to3(mk.pts, 0.03), { stroke: mk.color, width: 2.5 })
        for (const p of judge.current.marks) {
          drawPolyline3(ctx, cam, to3([{ x: p.x - 0.25, y: p.y }, { x: p.x + 0.25, y: p.y }], 0.05), { stroke: '#ff3b3b', width: 4 })
          drawPolyline3(ctx, cam, to3([{ x: p.x, y: p.y - 0.25 }, { x: p.x, y: p.y + 0.25 }], 0.05), { stroke: '#ff3b3b', width: 4 })
        }
      } else if (!roadRef.current) {
        for (const ln of groundLines()) drawPolyline3(ctx, cam, ln.pts, { stroke: ln.color, width: ln.width, dash: ln.dash })
      }

      if (roadRef.current) drawRoadWorld(ctx, cam, m, !!opts.light)

      if (fl.showTrail) {
        for (const k of ['fl', 'fr', 'rl', 'rr'] as CornerKey[]) drawPolyline3(ctx, cam, trail.current[k], { stroke: CORNER_COLOR[k], width: 1.5 })
      }
      if (fl.showPredict) {
        const dir: 1 | -1 = s.v < -0.05 ? -1 : gearRef.current === 'R' || input.current.gas < 0 ? -1 : 1
        const paths = predictPaths(s, g, 12, dir)
        for (const k of ['fl', 'fr', 'rl', 'rr'] as CornerKey[]) drawPolyline3(ctx, cam, paths[k], { stroke: CORNER_COLOR[k], width: 1.5, dash: [4, 5] })
      }
      if (fl.showGuide && m !== 'cab') {
        const hw = g.W / 2
        const front = g.wheelbase + g.frontOverhang
        const rear = -g.rearOverhang
        const seg = (side: number, a: number, b: number): Pt3[] => [
          { ...toWorld(s, a, side), z: 0.03 },
          { ...toWorld(s, b, side), z: 0.03 },
        ]
        for (const side of [hw, -hw]) {
          drawPolyline3(ctx, cam, seg(side, front, front + 14), { stroke: 'rgba(255,235,59,0.75)', width: 1.5 })
          drawPolyline3(ctx, cam, seg(side, rear, rear - 10), { stroke: 'rgba(255,235,59,0.45)', width: 1.5, dash: [3, 4] })
        }
        const mw = hw + g.mirrorOut
        for (const side of [mw, -mw]) {
          drawPolyline3(ctx, cam, seg(side, mirrorFwd(g), mirrorFwd(g) + 14), { stroke: 'rgba(255,140,0,0.8)', width: 1.5, dash: [5, 4] })
        }
      }

      const boxes: Box[] = []
      if (!course && !roadRef.current) {
        for (const r of scene.current.refs) boxes.push(...r.boxes)
        boxes.push(...scene.current.cones)
      }
      if (roadRef.current) {
        const near = getWorld().trees
          .map((t) => ({ t, d: Math.hypot(t.x - cam.x, t.y - cam.y) }))
          .filter((o) => o.d < (opts.light ? 45 : 90))
          .sort((a, b) => a.d - b.d)
          .slice(0, opts.light ? 15 : 80)
        for (const { t } of near) {
          boxes.push({ cx: t.x, cy: t.y, yaw: 0, len: 0.35, wid: 0.35, z0: 0, z1: 2.2, fill: '#5b4430', stroke: '#2a1d10', alpha: 1 })
          boxes.push({ cx: t.x, cy: t.y, yaw: 0, len: 2.6, wid: 2.6, z0: 2.2, z1: t.h, fill: '#3f7a3a', stroke: '#1f3d1d', alpha: 1 })
        }
      }
      boxes.push(...vehicleBoxes(s, g, vehicle.color, m === 'cab'))
      boxes.sort((a, b) => boxDepth(cam, b) - boxDepth(cam, a))
      for (const b of boxes) drawBox(ctx, cam, b)

      // 위에서 볼 때: 차체 아래에 가려진 바퀴를 지면 위치 그대로 위에 겹쳐 그린다
      if (m === 'top') {
        wheelPoints(s, g).forEach((pts, i, arr) => {
          const front = i >= arr.length - 2 // 마지막 두 개 = 앞바퀴(조향)
          const out = !!course && pts.some((pt) => !pointInPolygon(pt, course.polygon))
          const poly = to3(pts, 0.04)
          fillPolygon3(ctx, cam, poly, out ? 'rgba(255,60,60,0.9)' : 'rgba(10,10,10,0.9)')
          drawPolyline3(ctx, cam, [...poly, poly[0]], { stroke: out ? '#ffffff' : front ? '#ffd23f' : '#ffffff', width: 2 })
        })
      }

      if (opts.labels) {
        ctx.font = '600 11px system-ui, sans-serif'
        ctx.textAlign = 'center'
        const items: { label: string; at: Pt3; color: string }[] = []
        if (!course) for (const r of scene.current.refs) items.push({ label: r.label, at: r.at, color: '#ffe9a8' })
        else for (const mk of course.marks) {
          if (mk.label) items.push({ label: mk.label, at: { x: (mk.pts[0].x + mk.pts[1].x) / 2, y: (mk.pts[0].y + mk.pts[1].y) / 2, z: 0.3 }, color: mk.color })
        }
        for (const r of items) {
          const p = project(cam, r.at)
          if (!p) continue
          if (m !== 'top' && Math.hypot(r.at.x - cam.x, r.at.y - cam.y) > 24) continue
          const tw = ctx.measureText(r.label).width + 10
          ctx.fillStyle = 'rgba(0,0,0,0.6)'
          ctx.fillRect(p[0] - tw / 2, p[1] - 12, tw, 16)
          ctx.fillStyle = r.color
          ctx.fillText(r.label, p[0], p[1])
        }
      }
    }

    const mirrorCam = (side: 1 | -1, w: number, h: number): Camera => {
      const g = geoRef.current
      const s = car.current
      const p = toWorld(s, mirrorFwd(g), side * (g.W / 2 + g.mirrorOut))
      return {
        x: p.x, y: p.y, z: g.H * 0.62 + 0.15,
        yaw: s.yaw + Math.PI - side * 0.14,
        pitch: 0.06, f: w * 1.35, w, h,
      }
    }

    const draw = (now: number) => {
      const m = modeRef.current
      const { w, h } = size
      ctx.clearRect(0, 0, w, h)
      const cam0 = makeCam(m)
      drawWorld(ctx, cam0, m, { labels: m !== 'cab' })

      if (m === 'cab') {
        const s = car.current
        const f = cam0.f
        const lk = look.current
        const dx = f * Math.tan(Math.max(-1.25, Math.min(1.25, lk.yaw)))
        const dy = f * Math.tan(lk.pitch)
        drawCabInterior(ctx, w, h, {
          steer: steerRef.current, gear: gearRef.current, hood: hoodRef.current,
          speed: Math.abs(s.v) * 3.6, vmax: roadRef.current ? 80 : 20, color: vehicle.color, lever: leverUntil.current > now, now, dx, dy,
        })
        // 후사경: 실제 후사경 위치에 붙어 있어서, 고개를 돌려야 보인다
        for (const side of [1, -1] as const) {
          // 정면을 볼 때 왼쪽 위·오른쪽 위 모서리에 고정, 고개를 돌리면 운전석 내부와 함께 움직인다
          const mw = Math.round(w * 0.1)
          const mh = Math.round(h * 0.32)
          const x0 = Math.round((side === 1 ? w * 0.025 : w * 0.875) + dx)
          const y0 = Math.round((side === 1 ? h * 0.12 : h * 0.1) + dy)
          if (x0 > w || x0 + mw < 0 || y0 > h || y0 + mh < 0) continue
          ctx.save()
          ctx.beginPath()
          ctx.roundRect(x0, y0, mw, mh, 6)
          ctx.clip()
          ctx.translate(x0 + mw, y0)
          ctx.scale(-1, 1)
          drawWorld(ctx, mirrorCam(side, mw, mh), 'cab', { labels: false, light: true })
          ctx.restore()
          ctx.strokeStyle = '#0d0d0d'
          ctx.lineWidth = 5
          ctx.beginPath()
          ctx.roundRect(x0, y0, mw, mh, 6)
          ctx.stroke()
          ctx.strokeStyle = '#777'
          ctx.lineWidth = 1.2
          ctx.stroke()
        }
      }

      // 시험 모드: 위에서 본 내 위치 (북쪽이 위)
      if ((courseRef.current || roadRef.current) && flags.current.showMap && m !== 'top') {
        const land = landRef.current
        const mw = Math.round(Math.min(w * 0.7, h * (land ? 1.5 : 1.2)))
        const mh = Math.round(Math.min(h * (land ? 0.66 : 0.74), mw * 0.8))
        const mx = Math.round((w - mw) / 2)
        const my = land ? 108 : 8
        const cam = topCam(mw, mh, flags.current.mapZoom)
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(mx, my, mw, mh, 10)
        ctx.clip()
        ctx.translate(mx, my)
        drawWorld(ctx, cam, 'top', { labels: false, light: true })
        const g = geoRef.current
        const s = car.current
        const c0 = project(cam, { x: s.x + Math.cos(s.yaw) * (g.wheelbase / 2), y: s.y + Math.sin(s.yaw) * (g.wheelbase / 2), z: 0 })
        if (c0) {
          const pulse = 12 + 4 * Math.sin(now / 180)
          ctx.strokeStyle = '#ff8c00'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(c0[0], c0[1], pulse, 0, Math.PI * 2)
          ctx.stroke()
          ctx.fillStyle = '#ff8c00'
          ctx.font = '700 12px system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('내 위치', c0[0], c0[1] - pulse - 5)
        }
        ctx.restore()
        ctx.strokeStyle = 'rgba(255,255,255,.7)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(mx, my, mw, mh, 10)
        ctx.stroke()
        ctx.font = '11px system-ui, sans-serif'
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'left'
        ctx.fillText('위에서 본 화면 (위쪽 = 북쪽)', mx + 8, my + mh - 8)
      }

      const t = toastRef.current
      if (t && t.until > now) {
        ctx.font = '700 15px system-ui, sans-serif'
        ctx.textAlign = 'center'
        const tw = ctx.measureText(t.text).width + 24
        ctx.fillStyle = 'rgba(200,40,40,.92)'
        ctx.beginPath()
        ctx.roundRect(w / 2 - tw / 2, h * 0.5 - 18, tw, 34, 10)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.fillText(t.text, w / 2, h * 0.5 + 5)
      }
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [vehicle.color, vehicle.id, vehicle])

  const hold = (gas: 1 | -1) => ({
    onPointerDown: (e: React.PointerEvent) => {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      input.current.gas = gas
    },
    onPointerUp: () => { input.current.gas = 0 },
    onPointerCancel: () => { input.current.gas = 0 },
  })
  const accel = {
    onPointerDown: (e: React.PointerEvent) => {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      input.current.gas = gearSign(gearRef.current)
      if (gearRef.current === 'N') toastRef.current = { text: '기어가 중립(N)입니다. D(전진) 또는 R(후진)을 누르세요', until: performance.now() + 2200 }
    },
    onPointerUp: () => { input.current.gas = 0 },
    onPointerCancel: () => { input.current.gas = 0 },
  }
  const brake = {
    onPointerDown: (e: React.PointerEvent) => {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      input.current.brake = true
    },
    onPointerUp: () => { input.current.brake = false },
    onPointerCancel: () => { input.current.brake = false },
  }

  const setSteer = (v: number) => { steerRef.current = v; setSteerUi(v) }
  const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
  const courseIds: CourseId[] = courseOk ? ['gul', 's', 'turn'] : []

  const courseChips = road ? (
    <div className="chips course-chips">
      <button className={showMap ? 'on map' : 'map'} onClick={() => setShowMap((v) => !v)}>위에서 보기</button>
    </div>
  ) : !exam ? null : (
    <div className="chips course-chips">
      {courseIds.map((c) => (
        <button key={c} className={courseId === c ? 'on' : ''} onClick={() => setCourseId(c)}>{COURSE_LABEL[c]}</button>
      ))}
      {course && (
        <button className={showMap ? 'on map' : 'map'} onClick={() => setShowMap((v) => !v)}>위에서 보기</button>
      )}
    </div>
  )

  const dimEditor = course && (
    <div className="spec-pop">
      <p><b>코스 치수 입력</b> — 군 코스 치수는 공개 자료를 못 찾았습니다. 아래 값은 임시값이니 부대 코스에 맞게 고쳐 쓰세요.</p>
      <div className="dim-grid">
        {DIM_FIELDS[course.id].map((f) => {
          const cur = (dims[course.id] as unknown as Record<string, number | boolean>)[f.key]
          return (
            <label key={f.key}>
              <span>{f.label}</span>
              {f.bool ? (
                <select value={cur ? '1' : '0'} onChange={(e) => updateDims(course.id, f.key, e.target.value === '1')}>
                  <option value="1">{f.bool[0]}</option>
                  <option value="0">{f.bool[1]}</option>
                </select>
              ) : (
                <span className="num">
                  <input
                    type="number" step="0.1" min="0.1" value={cur as number}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v) && v > 0) updateDims(course.id, f.key, v) }}
                  />
                  {f.unit}
                </span>
              )}
            </label>
          )
        })}
      </div>
      <button className="mini" onClick={() => resetDims(course.id)}>임시 기본값으로</button>
      <p className="fineprint">기본값: 굴절 폭 4.7·모퉁이 사이 15·직선 6, T자 폭 5.2·차고 8 은 민간 별표 23(1종 대형) 일부이고, S자 반경·각도는 근거 없는 임시값입니다.</p>
    </div>
  )

  const statusPanel = course && (
    <div className={`status ${jui.done ? 'done' : ''}`}>
      <div className="row">
        <b>{course.name}</b>
        <span className={jui.elapsed > SOFT_LIMIT ? 'late' : ''}>{fmt(jui.elapsed)} / 3:00</span>
      </div>
      <div className="small desc">{course.description}</div>
      <div className="row small">
        <span>바퀴 접촉 <b className={jui.contacts ? 'bad' : ''}>{jui.contacts}</b> / {MAX_CONTACTS}회까지 허용</span>
      </div>
      {!jui.failed && jui.elapsed > SOFT_LIMIT && <div className="small late">2분 초과 구간 (감점 기준은 미확인)</div>}
      {jui.failed && (
        <div className="fail">
          <b>{jui.failed === 'time' ? '시간 초과(3분)' : `바퀴 접촉 ${MAX_CONTACTS + 1}회`} → 연습 종료</b>
          <button className="mini" onClick={reset}>다시 시작</button>
        </div>
      )}
      {course.garage && <div className="small">확인선 {jui.touched ? '✔ 닿음 → 전진으로 나오세요' : '아직'}</div>}
      <div className="small goal">{jui.done ? '✔ 통과 (연습 기록, 공식 판정 아님)' : course.goal}</div>
    </div>
  )

  const hudEl = road ? (
    <div className="hud road-hud">
      <span className="gear">{hud.dir}</span>
      <b className={hud.limit > 0 && hud.speed > hud.limit + 0.5 ? 'over' : ''}>{Math.round(hud.speed)}</b>
      <small>km/h</small>
      {hud.limit > 0 && <span className="limit" title="제한속도(지도 기준)">{hud.limit}</span>}
      <span className={hud.off ? 'rname off' : 'rname'}>{hud.off ? '도로 이탈' : hud.road}</span>
    </div>
  ) : (
    <div className="hud">
      <span className="gear">{hud.dir}</span>
      <span>{hud.speed.toFixed(1)} km/h</span>
    </div>
  )

  if (landscape) {
    const lookHandlers = {
      onPointerDown: (e: React.PointerEvent) => {
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        lookDrag.current = { x: e.clientX, y: e.clientY }
      },
      onPointerMove: (e: React.PointerEvent) => {
        const ld = lookDrag.current
        if (!ld) return
        const sx = e.clientX - ld.x
        const sy = e.clientY - ld.y
        lookDrag.current = { x: e.clientX, y: e.clientY }
        // 화면을 90° 돌려 쓰는 경우: 화면 좌표 → 레이아웃 좌표
        const dx = rotated ? sy : sx
        const dy = rotated ? -sx : sy
        const f = Math.max(1, dim.w) * 0.5
        look.current.yaw = Math.max(-1.9, Math.min(1.9, look.current.yaw + dx / f))
        look.current.pitch = Math.max(-0.45, Math.min(0.6, look.current.pitch + dy / f))
      },
      onPointerUp: () => { lookDrag.current = null },
      onPointerCancel: () => { lookDrag.current = null },
    }
    return (
      <div className="cab">
        <div className="canvas-wrap fill" ref={wrapRef} {...lookHandlers}>
          <canvas ref={canvasRef} />
        </div>
        <div className="cab-top">
          {headerSlot}
          {courseChips}
          <button className="mini" onClick={() => { look.current = { yaw: 0, pitch: 0 } }}>시선 정면</button>
          <button className="mini" onClick={reset}>처음으로</button>
          {hudEl}
          {course && (
            <button className={showSpec ? 'mini on' : 'mini'} onClick={() => setShowSpec((v) => !v)}>치수 조정</button>
          )}
        </div>
        {statusPanel && <div className="cab-status">{statusPanel}</div>}
        {course && showSpec && (
          <div className="dim-drawer">
            <div className="drawer-head">
              <b>코스 치수 조정</b>
              <button className="mini" onClick={() => setShowSpec(false)}>닫기</button>
            </div>
            {dimEditor}
          </div>
        )}
        <div className="cab-wheel">
          <SteeringWheel value={steerUi} onChange={setSteer} size={Math.min(170, Math.round(dim.h * 0.46))} />
          <button className="mini" onClick={() => setSteer(0)}>직진</button>
        </div>
        <div className="gear-btns right">
          {(['D', 'N', 'R'] as Gear[]).map((g) => (
            <button key={g} className={gearUi === g ? 'on' : ''} onPointerDown={(e) => { e.preventDefault(); setGear(g) }}>{g}</button>
          ))}
        </div>
        {road && <p className="osm-credit">동송터미널 주변 · © OpenStreetMap contributors</p>}
        <div className="cab-pedals two">
          <button className="pedal brake" {...brake}>브레이크</button>
          <button className="pedal fwd" {...accel}>가속 ({gearUi === 'D' ? '전진' : gearUi === 'R' ? '후진' : '중립'})</button>
        </div>
      </div>
    )
  }

  // 3인칭·위에서 보기: 한 화면에 고정(스크롤 없음). 캔버스 + 핸들 + 전진/후진
  return (
    <div className="drive view">
      <div className="canvas-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} />
        {hudEl}
        <div className="zoom">
          <button onClick={() => setZoom((z) => Math.min(6, z * 1.25))} aria-label="확대">＋</button>
          <button onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))} aria-label="축소">－</button>
        </div>
        <div className="view-toggles">
          <button className={showGuide ? 'on' : ''} onClick={() => setShowGuide((v) => !v)}>차폭선</button>
          <button className={showPredict ? 'on' : ''} onClick={() => setShowPredict((v) => !v)}>예상</button>
          <button className={showTrail ? 'on' : ''} onClick={() => setShowTrail((v) => !v)}>궤적</button>
          <button onClick={reset}>처음</button>
        </div>
      </div>
      <div className="view-controls">
        <div className="view-wheel">
          <SteeringWheel value={steerUi} onChange={setSteer} size={118} />
          <button className="mini" onClick={() => setSteer(0)}>직진</button>
        </div>
        <div className="view-pedals">
          <button className="pedal rev" {...hold(-1)}>후진 R</button>
          <button className="pedal fwd" {...hold(1)}>전진 D</button>
        </div>
      </div>
    </div>
  )
}

interface InteriorOpts { vmax: number; steer: number; gear: Gear; hood: boolean; speed: number; color: string; lever: boolean; now: number; dx: number; dy: number }

/** 운전석 안쪽: 창틀·A필러·계기판·보닛·핸들·두 손·변속 레버 */
function drawCabInterior(ctx: CanvasRenderingContext2D, w: number, h: number, o: InteriorOpts) {
  ctx.save()
  ctx.translate(o.dx, o.dy)
  const dark = '#14160f'
  const sleeve = '#4b5a2e'
  const skin = '#d9a47a'
  // 운전석 안쪽 좌표계: 정면 화면이 0~w. 옆 창은 A필러 바깥쪽(왼쪽 -0.85w까지, 오른쪽 1.85w까지)에 이어진다.
  const wallL = -w * 0.85
  const wallR = w * 1.85
  // 옆 창 유리(살짝 푸른 반사)
  ctx.fillStyle = 'rgba(120,160,200,0.06)'
  ctx.fillRect(wallL, h * 0.05, w * 1.0, h * 0.85)
  ctx.fillRect(w * 0.85, h * 0.05, wallR - w * 0.85, h * 0.85)
  // 지붕 헤더 + 햇빛가리개 띠
  ctx.fillStyle = dark
  ctx.fillRect(-w * 5, 0, w * 11, h * 0.05)
  ctx.fillStyle = 'rgba(20,40,60,.25)'
  ctx.fillRect(w * 0.12, h * 0.05, w * 0.76, h * 0.04)
  // A필러
  ctx.fillStyle = dark
  ctx.beginPath()
  ctx.moveTo(w * 0.105, h * 0.05); ctx.lineTo(w * 0.135, h * 0.05); ctx.lineTo(w * 0.2, h * 0.73); ctx.lineTo(w * 0.17, h * 0.73)
  ctx.closePath(); ctx.fill()
  ctx.beginPath()
  ctx.moveTo(w * 0.895, h * 0.05); ctx.lineTo(w * 0.865, h * 0.05); ctx.lineTo(w * 0.8, h * 0.73); ctx.lineTo(w * 0.83, h * 0.73)
  ctx.closePath(); ctx.fill()
  // 도어 패널(창 아래) + 창틀 아래선
  ctx.fillStyle = '#1d2018'
  ctx.beginPath(); ctx.moveTo(wallL, h * 0.9); ctx.lineTo(w * 0.17, h * 0.94); ctx.lineTo(w * 0.17, h * 2); ctx.lineTo(wallL, h * 2); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(wallR, h * 0.9); ctx.lineTo(w * 0.83, h * 0.94); ctx.lineTo(w * 0.83, h * 2); ctx.lineTo(wallR, h * 2); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = '#3a3f33'; ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(wallL, h * 0.9); ctx.lineTo(w * 0.17, h * 0.94); ctx.moveTo(wallR, h * 0.9); ctx.lineTo(w * 0.83, h * 0.94); ctx.stroke()
  // 창 뒤쪽 기둥과 캐빈 뒷벽(고개를 끝까지 돌리면 보인다)
  ctx.fillStyle = dark
  ctx.fillRect(-w * 6, 0, w * 6 - w * 0.85, h * 2)
  ctx.fillRect(wallR, 0, w * 6, h * 2)
  ctx.fillStyle = '#26291f'
  ctx.fillRect(wallL - 6, 0, 6, h * 2)
  ctx.fillRect(wallR, 0, 6, h * 2)
  // 룸미러
  ctx.fillStyle = '#0c0d0a'
  ctx.beginPath(); ctx.roundRect(w * 0.46, h * 0.06, w * 0.08, h * 0.045, 4); ctx.fill()
  ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.stroke()
  // 보닛
  if (o.hood) {
    ctx.fillStyle = shade(o.color, -35)
    ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.73); ctx.lineTo(w * 0.7, h * 0.73); ctx.lineTo(w * 0.6, h * 0.67); ctx.lineTo(w * 0.4, h * 0.67); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.5; ctx.stroke()
  }
  // 대시보드
  const dg = ctx.createLinearGradient(0, h * 0.71, 0, h)
  dg.addColorStop(0, '#2a2d24'); dg.addColorStop(1, '#101109')
  ctx.fillStyle = dg
  ctx.beginPath(); ctx.moveTo(w * 0.17, h * 0.73); ctx.quadraticCurveTo(w * 0.5, h * 0.69, w * 0.83, h * 0.73); ctx.lineTo(w * 0.83, h * 2); ctx.lineTo(w * 0.17, h * 2); ctx.closePath(); ctx.fill()
  // 속도계
  const gx = w * 0.3, gy = h * 0.84, gr = h * 0.085
  ctx.fillStyle = '#0a0b08'; ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#6f7a5c'; ctx.lineWidth = 2; ctx.stroke()
  const frac = Math.min(1, o.speed / o.vmax)
  const ang = Math.PI * 0.75 + frac * Math.PI * 1.5
  ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(ang) * gr * 0.8, gy + Math.sin(ang) * gr * 0.8); ctx.stroke()
  ctx.fillStyle = '#9aa98c'; ctx.font = `${Math.round(gr * 0.32)}px system-ui, sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('km/h', gx, gy + gr * 0.62)
  ctx.fillText(o.speed.toFixed(0), gx, gy - gr * 0.2)

  // 변속 레버 (오른쪽)
  const bx = w * 0.62, by = h * 0.92
  const Ls = h * 0.2
  const tilt = o.gear === 'D' ? -0.35 : o.gear === 'R' ? 0.35 : 0
  const kx = bx + Math.sin(tilt) * Ls
  const ky = by - Math.cos(tilt) * Ls
  ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.ellipse(bx, by + 2, 20, 8, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#8b8f84'; ctx.lineWidth = 6; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(kx, ky); ctx.stroke()
  ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(kx, ky, 11, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.stroke()
  ctx.fillStyle = '#ffd23f'; ctx.font = '700 12px system-ui, sans-serif'; ctx.fillText(o.gear, kx, ky + 4)

  // 핸들
  const wl = wheelLayout(w, h)
  const rot = o.steer * WHEEL_LOCK_DEG * Math.PI / 180
  const hand = (ang: number, grip: boolean, side: 1 | -1) => {
    const hx = wl.cx + wl.r * Math.cos(ang)
    const hy = wl.cy + wl.ry * Math.sin(ang)
    drawHand(ctx, hx, hy, wl.r * 0.13, side, grip, sleeve, skin, w, h)
  }
  ctx.save()
  ctx.translate(wl.cx, wl.cy)
  ctx.scale(1, 0.42)
  ctx.rotate(rot)
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#0c0c0c'; ctx.lineWidth = wl.r * 0.16
  ctx.beginPath(); ctx.arc(0, 0, wl.r, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = '#3a3e34'; ctx.lineWidth = wl.r * 0.1
  ctx.beginPath(); ctx.arc(0, 0, wl.r, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = '#25281f'; ctx.lineWidth = wl.r * 0.12
  ctx.beginPath(); ctx.moveTo(-wl.r, 0); ctx.lineTo(wl.r, 0); ctx.moveTo(0, 0); ctx.lineTo(0, wl.r); ctx.stroke()
  ctx.fillStyle = '#25281f'; ctx.beginPath(); ctx.arc(0, 0, wl.r * 0.22, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = wl.r * 0.1
  ctx.beginPath(); ctx.moveTo(-wl.r * 0.12, -wl.r); ctx.lineTo(wl.r * 0.12, -wl.r); ctx.stroke()
  ctx.restore()
  // 두 손: 왼손은 항상 핸들 9시, 오른손은 레버 조작 중이면 레버로
  hand(Math.PI + rot, true, -1)
  if (o.lever) drawHand(ctx, kx, ky, wl.r * 0.13, 1, true, sleeve, skin, w, h)
  else hand(rot, true, 1)
  ctx.restore()
}

function drawHand(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, side: 1 | -1, grip: boolean, sleeve: string, skin: string, w: number, h: number) {
  // 소매(전투복)
  ctx.strokeStyle = sleeve
  ctx.lineWidth = r * 1.9
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.quadraticCurveTo(x + side * (w * 0.08), y + (h - y) * 0.55, w * 0.5 + side * w * 0.3, h + 30)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(0,0,0,.35)'
  ctx.lineWidth = 2
  ctx.stroke()
  // 손
  ctx.fillStyle = skin
  ctx.beginPath(); ctx.ellipse(x, y, r * 1.1, r * 0.85, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(80,40,20,.6)'; ctx.lineWidth = 1.2; ctx.stroke()
  if (grip) {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(x - r * 0.6, y + i * r * 0.35); ctx.lineTo(x + r * 0.6, y + i * r * 0.35)
      ctx.strokeStyle = 'rgba(80,40,20,.55)'; ctx.lineWidth = 1; ctx.stroke()
    }
  }
  ctx.fillStyle = skin
  ctx.beginPath(); ctx.ellipse(x - side * r * 0.5, y - r * 0.75, r * 0.38, r * 0.55, side * 0.5, 0, Math.PI * 2); ctx.fill()
}

function vehicleBoxes(s: CarState, g: Geo, color: string, hideCabTop = false): Box[] {
  const cos = Math.cos(s.yaw)
  const sin = Math.sin(s.yaw)
  const at = (l: number) => ({ x: s.x + cos * l, y: s.y + sin * l })
  const frontEnd = g.wheelbase + g.frontOverhang
  const rearEnd = -g.rearOverhang
  const cabLen = Math.min(g.cabLength, g.L * 0.45)
  const cabC = at(frontEnd - cabLen / 2)
  const cargoLen = g.L - cabLen
  const cargoC = at(rearEnd + cargoLen / 2)
  const stroke = '#101510'
  const boxes: Box[] = []
  const chassis = at((frontEnd + rearEnd) / 2)
  boxes.push({ cx: chassis.x, cy: chassis.y, yaw: s.yaw, len: g.L, wid: g.W * 0.9, z0: 0.35, z1: 0.75, fill: '#222', stroke })
  boxes.push({ cx: cargoC.x, cy: cargoC.y, yaw: s.yaw, len: cargoLen, wid: g.W, z0: 0.75, z1: Math.min(g.H, 0.75 + g.cargoHeight * 0.62), fill: shade(color, -10), stroke, alpha: 0.9 })
  boxes.push({ cx: cabC.x, cy: cabC.y, yaw: s.yaw, len: cabLen, wid: g.W, z0: 0.6, z1: hideCabTop ? g.H * 0.55 : g.H, fill: color, stroke, alpha: 0.95 })
  const mz0 = g.H * 0.5
  const mz1 = Math.min(g.H - 0.1, g.H * 0.5 + 0.55)
  for (const side of [1, -1]) {
    const lat = side * (g.W / 2 + g.mirrorOut / 2)
    const mp = at(mirrorFwd(g))
    boxes.push({ cx: mp.x - sin * lat, cy: mp.y + cos * lat, yaw: s.yaw, len: 0.14, wid: g.mirrorOut, z0: mz0, z1: mz1, fill: '#e8e8e8', stroke: '#222', alpha: 1 })
  }
  for (const a of [...rearAxles(g), g.wheelbase]) {
    for (const side of [g.W / 2 - 0.15, -(g.W / 2 - 0.15)]) {
      const p = at(a)
      const steer = a === g.wheelbase ? s.steer : 0
      boxes.push({ cx: p.x - sin * side, cy: p.y + cos * side, yaw: s.yaw + steer, len: WHEEL_LEN, wid: WHEEL_WID, z0: 0, z1: WHEEL_LEN, fill: '#0c0c0c', stroke: '#444', alpha: 1 })
    }
  }
  return boxes
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, v + amt))
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`
}
