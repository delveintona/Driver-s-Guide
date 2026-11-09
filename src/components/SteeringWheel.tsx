import { useRef } from 'react'

/** 도식용 핸들 회전 범위(한쪽). 실제 조향비는 차량별로 미확인 */
export const WHEEL_LOCK_DEG = 540

interface Props {
  /** -1(왼쪽 끝) ~ 1(오른쪽 끝) */
  value: number
  onChange: (v: number) => void
  size?: number
  /** true면 그림 없이 터치 영역만(타보기 화면의 캔버스 핸들 위에 덮어씀) */
  ghost?: boolean
  style?: React.CSSProperties
}

export default function SteeringWheel({ value, onChange, size = 150, ghost, style }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ last: number } | null>(null)
  const valRef = useRef(value)
  valRef.current = value

  const angleOf = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2))
  }

  const down = (e: React.PointerEvent) => {
    ref.current!.setPointerCapture(e.pointerId)
    drag.current = { last: angleOf(e) }
  }
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return
    const a = angleOf(e)
    let d = a - drag.current.last
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    drag.current.last = a
    const next = valRef.current + ((d * 180) / Math.PI) / WHEEL_LOCK_DEG
    onChange(Math.max(-1, Math.min(1, next)))
  }
  const up = () => { drag.current = null }

  const deg = value * WHEEL_LOCK_DEG
  if (ghost) {
    return (
      <div ref={ref} className="wheel-ghost" style={{ touchAction: 'none', ...style }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="slider" aria-label="핸들" aria-valuenow={Math.round(deg)} />
    )
  }
  return (
    <div
      ref={ref}
      className="wheel"
      style={{ width: size, height: size, touchAction: 'none' }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      role="slider"
      aria-label="핸들"
      aria-valuemin={-WHEEL_LOCK_DEG}
      aria-valuemax={WHEEL_LOCK_DEG}
      aria-valuenow={Math.round(deg)}
    >
      <svg viewBox="-60 -60 120 120" style={{ transform: `rotate(${deg}deg)` }}>
        <circle r="52" fill="none" stroke="#1a1a1a" strokeWidth="11" />
        <circle r="52" fill="none" stroke="#3b3f38" strokeWidth="7" />
        <circle r="13" fill="#2a2e27" stroke="#555" strokeWidth="2" />
        <path d="M-48 4 L-14 4 M48 4 L14 4 M0 14 L0 48" stroke="#2f342b" strokeWidth="9" strokeLinecap="round" />
        <path d="M-8 -52 L8 -52" stroke="#ff7a1a" strokeWidth="9" strokeLinecap="round" />
      </svg>
      <span className="wheel-deg">{deg > 0 ? '→' : deg < 0 ? '←' : ''} {Math.abs(Math.round(deg))}°</span>
    </div>
  )
}
