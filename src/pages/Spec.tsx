import { useParams } from 'react-router-dom'
import Page from '../components/Page'
import ConfidenceBadge from '../components/ConfidenceBadge'
import { getVehicle, vehicleGeometry } from '../data/vehicles'

const mm = (n: number | null) => (n == null ? null : `${n.toLocaleString()} mm`)

export default function Spec() {
  const { id } = useParams()
  const v = getVehicle(id ?? '')
  if (!v) return <Page title="차종 없음" back="/"><p>없는 차종입니다.</p></Page>
  const d = v.dimensionsMm
  const g = vehicleGeometry(v)
  const rows: [string, string | null, string?][] = [
    ['전장', mm(d.length)],
    ['전폭 (차체)', mm(d.widthBody)],
    ['전폭 (거울 포함)', mm(d.widthIncludingMirrors)],
    ['전고', mm(d.height)],
    ['축거', mm(d.wheelbase), g.wheelbaseAssumed ? `도식용 가정 ${(g.wheelbase * 1000).toLocaleString()} mm` : undefined],
    ['앞 오버행', mm(d.frontOverhang), `도식용 가정 ${(g.frontOverhang * 1000).toLocaleString()} mm`],
    ['뒤 오버행', mm(d.rearOverhang)],
    ['전륜 트레드', mm(d.frontTrack)],
    ['최소회전반경', v.turning.minimumRadiusM == null ? null : `${v.turning.minimumRadiusM} m`],
    ['최대 조향각', null, `도식 계산 ${g.maxSteerDeg.toFixed(0)}°${g.steerAssumed ? ' (가정)' : ' (반경에서 환산)'}`],
  ]
  return (
    <Page title="제원" sub={v.displayName} back={`/v/${v.id}`}>
      <div className="hero">
        <ConfidenceBadge level={v.confidence} />
        <p className="variant">{v.variant}</p>
      </div>
      <table className="spec">
        <tbody>
          {rows.map(([k, val, note]) => (
            <tr key={k}>
              <th>{k}</th>
              <td>
                {val ?? <em className="unknown">미확인</em>}
                {note && <small>{note}</small>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className="card">
        <h2>회전반경 기준</h2>
        <ConfidenceBadge level={v.turning.confidence} />
        <p>{v.turning.radiusReference}</p>
        <p className="fineprint">제조사 최소회전반경은 측정 기준점이 없으면 차체 외곽 반경과 같다고 볼 수 없습니다.</p>
      </section>
      <section className="card">
        <h2>자료 설명</h2>
        <p>{v.sourceNote}</p>
        <p className="fineprint">출처 ID: {v.sourceIds.length ? v.sourceIds.join(', ') : '2차 자료(출처 페이지 참조)'} · 검토일 {v.lastReviewed}</p>
      </section>
    </Page>
  )
}
