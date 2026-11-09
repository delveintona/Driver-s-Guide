import type { Vehicle } from '../data/vehicles'
import { vehicleGeometry } from '../data/vehicles'

interface TopProps {
  vehicle: Vehicle
  /** 앞쪽이 위. (x, yBottom)은 차체 뒤끝 중앙 좌표(미터 단위 좌표계) */
  x: number
  yBottom: number
  ghost?: boolean
}

/** 미터 단위 좌표계에서 위에서 본 차량 (앞이 위쪽) */
export function TopShape({ vehicle, x, yBottom, ghost }: TopProps) {
  const g = vehicleGeometry(vehicle)
  const cabLen = Math.min(g.cabLength, g.L * 0.45)
  const left = x - g.W / 2
  const top = yBottom - g.L
  const fill = ghost ? 'none' : vehicle.color
  const stroke = ghost ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.55)'
  const sw = 0.05
  const axleY = (a: number) => yBottom - g.rearOverhang - a
  return (
    <g>
      {!ghost && (
        <>
          {[...(g.tandem > 0 ? [-g.tandem / 2, g.tandem / 2] : [0]), g.wheelbase].map((a) =>
            [left - 0.02, left + g.W - 0.2].map((wx) => (
              <rect key={`${a}-${wx}`} x={wx} y={axleY(a) - 0.5} width={0.22} height={1} fill="#0b0b0b" rx={0.05} />
            )),
          )}
        </>
      )}
      <rect x={left} y={top} width={g.W} height={g.L} rx={0.25} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={ghost ? '0.25 0.2' : undefined} fillOpacity={0.92} />
      {!ghost && (
        <>
          <rect x={left} y={top} width={g.W} height={cabLen} rx={0.25} fill="rgba(255,255,255,.18)" />
          <rect x={left + 0.12} y={top + 0.25} width={g.W - 0.24} height={0.35} rx={0.1} fill="rgba(20,30,40,.75)" />
        </>
      )}
    </g>
  )
}

/** 측면(앞이 오른쪽) */
export function SideShape({ vehicle, x, yGround, ghost }: { vehicle: Vehicle; x: number; yGround: number; ghost?: boolean }) {
  const g = vehicleGeometry(vehicle)
  const cabLen = Math.min(g.cabLength, g.L * 0.45)
  const cargoTop = Math.min(g.H, 0.75 + g.cargoHeight * 0.62)
  const stroke = ghost ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.55)'
  const fill = ghost ? 'none' : vehicle.color
  const sw = 0.05
  const rear = x
  const wheelR = 0.5
  return (
    <g>
      <rect x={rear} y={yGround - cargoTop} width={g.L - cabLen} height={cargoTop - 0.75 + 0.0} rx={0.1} fill={fill} stroke={stroke} strokeWidth={sw} fillOpacity={0.8} strokeDasharray={ghost ? '0.25 0.2' : undefined} />
      <rect x={rear + g.L - cabLen} y={yGround - g.H} width={cabLen} height={g.H - 0.6} rx={0.15} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={ghost ? '0.25 0.2' : undefined} fillOpacity={0.95} />
      {!ghost && (
        <>
          <rect x={rear + g.L - cabLen + 0.15} y={yGround - g.H + 0.2} width={cabLen - 0.3} height={0.7} rx={0.08} fill="rgba(20,30,40,.75)" />
          {[...(g.tandem > 0 ? [g.rearOverhang - g.tandem / 2, g.rearOverhang + g.tandem / 2] : [g.rearOverhang]), g.rearOverhang + g.wheelbase].map((a) => (
            <circle key={a} cx={rear + a} cy={yGround - wheelR} r={wheelR} fill="#0b0b0b" stroke="#555" strokeWidth={0.04} />
          ))}
        </>
      )}
    </g>
  )
}

export function Person({ x, yBottom, side }: { x: number; yBottom: number; side?: boolean }) {
  // 위에서: 지름 0.5 m 원 / 옆에서: 높이 1.7 m
  if (side) {
    return (
      <g fill="#e8b64c" stroke="rgba(0,0,0,.5)" strokeWidth={0.03}>
        <rect x={x - 0.2} y={yBottom - 1.45} width={0.4} height={1.45} rx={0.1} />
        <circle cx={x} cy={yBottom - 1.58} r={0.13} />
      </g>
    )
  }
  return <circle cx={x} cy={yBottom} r={0.25} fill="#e8b64c" stroke="rgba(0,0,0,.5)" strokeWidth={0.03} />
}
