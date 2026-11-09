import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Page from '../components/Page'
import DriveCanvas, { type DriveMode } from '../components/DriveCanvas'
import { getVehicle } from '../data/vehicles'

const MODES: { k: DriveMode; l: string }[] = [
  { k: 'cab', l: '타보기' },
  { k: 'chase', l: '3인칭' },
  { k: 'top', l: '위에서' },
]

function usePortrait() {
  const get = () => window.innerHeight > window.innerWidth
  const [p, setP] = useState(get)
  useEffect(() => {
    const on = () => setP(get())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return p
}

export default function Drive() {
  const { id, mode } = useParams()
  const nav = useNavigate()
  const portrait = usePortrait()
  const v = getVehicle(id ?? '')
  const m = (MODES.find((x) => x.k === mode)?.k ?? 'chase') as DriveMode

  // 타보기는 가로 화면. 가능하면 전체화면+가로 고정, 안 되면 화면을 90° 돌려서 보여준다.
  useEffect(() => {
    if (m !== 'cab') return
    const lock = async () => {
      try {
        await document.documentElement.requestFullscreen?.()
        await screen.orientation?.lock?.('landscape')
      } catch { /* 지원하지 않으면 회전 레이아웃으로 대체 */ }
    }
    void lock()
    return () => {
      try { screen.orientation?.unlock?.() } catch { /* noop */ }
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {})
    }
  }, [m])

  if (!v) return <Page title="차종 없음" back="/"><p>없는 차종입니다.</p></Page>

  if (m === 'cab') {
    return (
      <div className={`cab-shell ${portrait ? 'rotated' : ''}`}>
        <DriveCanvas
          vehicle={v}
          mode="cab"
          landscape
          rotated={portrait}
          headerSlot={
            <>
              <button className="back sm" onClick={() => nav(`/v/${v.id}`)} aria-label="나가기">‹</button>
              {MODES.filter((x) => x.k !== 'cab').map((x) => (
                <Link key={x.k} to={`/v/${v.id}/drive/${x.k}`} replace className="mini">{x.l}</Link>
              ))}
            </>
          }
        />
        {portrait && <div className="rotate-hint">폰을 옆으로 돌리면 더 크게 보여요</div>}
      </div>
    )
  }

  return (
    <Page title={v.shortName} sub="저속 연습 · 교육용 도식" back={`/v/${v.id}`}>
      <div className="chips">
        {MODES.map((x) => (
          <Link key={x.k} to={`/v/${v.id}/drive/${x.k}`} replace className={m === x.k ? 'chip on' : 'chip'}>{x.l}</Link>
        ))}
      </div>
      <DriveCanvas vehicle={v} mode={m} />
    </Page>
  )
}
