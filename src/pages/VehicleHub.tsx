import { Link, useParams } from 'react-router-dom'
import Page from '../components/Page'
import ConfidenceBadge from '../components/ConfidenceBadge'
import { getVehicle } from '../data/vehicles'

const ACTIONS = [
  { to: 'drive/cab', icon: '🪑', title: '타보기', desc: '운전석 눈높이에서 차폭 느끼기' },
  { to: 'drive/chase', icon: '🎥', title: '3인칭으로 보기', desc: '뒤에서 따라가며 궤적 보기' },
  { to: 'drive/top', icon: '🧭', title: '위에서 보기', desc: '탑뷰로 회전 궤적 확인' },
  { to: 'compare', icon: '📏', title: '실제 크기 비교', desc: '사람·승용차·주차칸과 비교' },
  { to: 'spec', icon: '📋', title: '제원', desc: '값마다 출처와 신뢰도' },
  { to: 'tips', icon: '💡', title: '운전 팁', desc: '차종·화물·인원 수송' },
]

export default function VehicleHub() {
  const { id } = useParams()
  const v = getVehicle(id ?? '')
  if (!v) return <Page title="차종 없음" back="/"><p>없는 차종입니다.</p></Page>
  return (
    <Page title={v.displayName} sub={v.tagline} back="/">
      <div className="hero">
        <ConfidenceBadge level={v.confidence} />
        <p className="variant">{v.variant}</p>
        <p className="caution">{v.caution}</p>
      </div>
      <div className="grid2">
        {ACTIONS.map((a) => (
          <Link key={a.to} to={`/v/${v.id}/${a.to}`} className="tile">
            <span className="icon" aria-hidden>{a.icon}</span>
            <strong>{a.title}</strong>
            <span className="desc">{a.desc}</span>
          </Link>
        ))}
      </div>
    </Page>
  )
}
