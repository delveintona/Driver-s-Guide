import { Link, useNavigate, useParams } from 'react-router-dom'
import DriveCanvas, { type DriveMode } from '../components/DriveCanvas'
import { getVehicle } from '../data/vehicles'

const MODES: { k: Exclude<DriveMode, 'cab'>; l: string }[] = [
  { k: 'chase', l: '3인칭' },
  { k: 'top', l: '위에서' },
]

/** 3인칭·위에서 보기. 스크롤 없이 한 화면에 고정 */
export default function View() {
  const { id, mode } = useParams()
  const nav = useNavigate()
  const v = getVehicle(id ?? '')
  if (!v) return <div className="view-shell"><p>없는 차종입니다.</p></div>
  const m = MODES.find((x) => x.k === mode)?.k ?? 'chase'
  return (
    <div className="view-shell">
      <header className="view-top">
        <button className="back sm" onClick={() => nav(`/v/${v.id}`)} aria-label="뒤로">‹</button>
        <strong>{v.shortName}</strong>
        <div className="chips">
          {MODES.map((x) => (
            <Link key={x.k} to={`/v/${v.id}/view/${x.k}`} replace className={m === x.k ? 'chip on' : 'chip'}>{x.l}</Link>
          ))}
        </div>
        <small>교육용 도식</small>
      </header>
      <DriveCanvas vehicle={v} mode={m} />
    </div>
  )
}
