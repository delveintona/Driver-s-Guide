import { Link, useParams } from 'react-router-dom'
import Page from '../components/Page'
import DriveCanvas, { type DriveMode } from '../components/DriveCanvas'
import { getVehicle } from '../data/vehicles'

const MODES: { k: Exclude<DriveMode, 'cab'>; l: string }[] = [
  { k: 'chase', l: '3인칭' },
  { k: 'top', l: '위에서' },
]

/** 3인칭·위에서 보기. 타보기(운전석)와는 따로 있는 화면 */
export default function View() {
  const { id, mode } = useParams()
  const v = getVehicle(id ?? '')
  if (!v) return <Page title="차종 없음" back="/"><p>없는 차종입니다.</p></Page>
  const m = MODES.find((x) => x.k === mode)?.k ?? 'chase'
  return (
    <Page title={v.shortName} sub="3인칭 · 위에서 보기" back={`/v/${v.id}`}>
      <div className="chips">
        {MODES.map((x) => (
          <Link key={x.k} to={`/v/${v.id}/view/${x.k}`} replace className={m === x.k ? 'chip on' : 'chip'}>{x.l}</Link>
        ))}
      </div>
      <DriveCanvas vehicle={v} mode={m} />
    </Page>
  )
}
