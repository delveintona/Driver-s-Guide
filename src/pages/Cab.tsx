import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Page from '../components/Page'
import DriveCanvas from '../components/DriveCanvas'
import { getVehicle } from '../data/vehicles'

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

/** 타보기(자유 주행)와 운전 시험이 같은 가로 운전석 화면을 쓴다 */
export default function Cab({ exam, road }: { exam?: boolean; road?: boolean }) {
  const { id } = useParams()
  const nav = useNavigate()
  const portrait = usePortrait()
  const v = getVehicle(id ?? '')
  const blocked = !!exam && v?.id !== 'k511'

  // 가능하면 전체화면+가로 고정, 안 되면 화면을 90° 돌려서 보여준다.
  useEffect(() => {
    if (!v || blocked) return
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
  }, [v, blocked])

  if (!v) return <Page title="차종 없음" back="/"><p>없는 차종입니다.</p></Page>
  if (blocked) {
    return (
      <Page title="운전 시험" sub={v.displayName} back={`/v/${v.id}`}>
        <div className="notice">운전 시험(굴절·S자·T자 코스)은 두돈반(K511)만 지원합니다.</div>
      </Page>
    )
  }

  return (
    <div className={`cab-shell ${portrait ? 'rotated' : ''}`}>
      <DriveCanvas
        vehicle={v}
        mode="cab"
        landscape
        rotated={portrait}
        exam={exam}
        road={road}
        headerSlot={<button className="back sm" onClick={() => nav(`/v/${v.id}`)} aria-label="나가기">‹</button>}
      />
      {portrait && <div className="rotate-hint">폰을 옆으로 돌리면 더 크게 보여요</div>}
    </div>
  )
}
