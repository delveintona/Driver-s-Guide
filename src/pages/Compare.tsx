import { useParams } from 'react-router-dom'
import Page from '../components/Page'
import { Person, SideShape, TopShape } from '../components/Silhouette'
import { getVehicle, vehicleGeometry } from '../data/vehicles'

const LANE = 3.25
const STALL_W = 2.5
const STALL_L = 5.0

export default function Compare() {
  const { id } = useParams()
  const v = getVehicle(id ?? '')
  if (!v) return <Page title="차종 없음" back="/"><p>없는 차종입니다.</p></Page>
  const g = vehicleGeometry(v)
  const sideGap = (LANE - g.W) / 2
  const stallGap = (STALL_W - g.W) / 2

  const sw = g.L + 8
  const sh = Math.max(g.H, 4.0) + 1
  const gy = sh - 0.4
  const tw = g.L + 3
  const th = LANE + 1.2

  return (
    <Page title="실제 크기 비교" sub={v.displayName} back={`/v/${v.id}`}>
      <section className="card">
        <h2>옆에서 · 높이</h2>
        <div className="scroll">
          <svg viewBox={`0 0 ${sw} ${sh}`} style={{ minWidth: 520 }} role="img" aria-label="높이 비교">
            <line x1={0} y1={gy} x2={sw} y2={gy} stroke="#7d8a70" strokeWidth={0.06} />
            <line x1={0} y1={gy - 4} x2={sw} y2={gy - 4} stroke="#ff7a7a" strokeWidth={0.04} strokeDasharray="0.3 0.2" />
            <text x={sw - 0.1} y={gy - 4.1} textAnchor="end" fontSize={0.45} fill="#ff9a9a">일반 통행 높이 기준 4.0 m</text>
            <SideShape vehicle={v} x={0.3} yGround={gy} />
            <Person x={g.L + 1.2} yBottom={gy} side />
            <text x={g.L + 1.2} y={gy - 1.9} textAnchor="middle" fontSize={0.4} fill="#ffe9a8">1.7 m</text>
            <g>
              <rect x={g.L + 2.3} y={gy - 1.45} width={4.7} height={1.45} rx={0.4} fill="none" stroke="rgba(255,255,255,.6)" strokeWidth={0.05} strokeDasharray="0.25 0.2" />
              <text x={g.L + 4.65} y={gy - 0.6} textAnchor="middle" fontSize={0.4} fill="#cfd8e3">승용차 4.7 m</text>
            </g>
            <text x={0.4} y={gy - g.H - 0.2} fontSize={0.45} fill="#fff">전고 {g.H.toFixed(2)} m</text>
          </svg>
        </div>
      </section>

      <section className="card">
        <h2>위에서 · 차로 폭 {LANE} m(예시)</h2>
        <div className="scroll">
          <svg viewBox={`0 0 ${tw} ${th}`} style={{ minWidth: 520 }} role="img" aria-label="차로 폭 비교">
            <rect x={0} y={0.6} width={tw} height={LANE} fill="#3a3f36" />
            <line x1={0} y1={0.6} x2={tw} y2={0.6} stroke="#e8e8e8" strokeWidth={0.08} />
            <line x1={0} y1={0.6 + LANE} x2={tw} y2={0.6 + LANE} stroke="#e8e8e8" strokeWidth={0.08} />
            <g transform={`translate(0.3, ${0.6 + LANE / 2}) rotate(90)`}>
              <TopShape vehicle={v} x={0} yBottom={0} />
            </g>
            <text x={0.3} y={0.4} fontSize={0.32} fill="#fff">
              차체 기준 좌우 여유 각 {(sideGap * 100).toFixed(0)} cm (거울 제외)
            </text>
          </svg>
        </div>
        <p className="fineprint">거울 폭은 미확인 값이라 포함하지 않았습니다. 실제 여유는 이보다 작습니다. 차로 폭은 교육용 예시이며 도로마다 다릅니다.</p>
      </section>

      <section className="card">
        <h2>위에서 · 주차칸 {STALL_W}×{STALL_L} m(예시)</h2>
        <div className="scroll">
          <svg viewBox={`0 0 8 ${g.L + 2}`} style={{ minWidth: 300, maxHeight: 460 }} role="img" aria-label="주차칸 비교">
            <rect x={2.75} y={g.L + 1 - STALL_L} width={STALL_W} height={STALL_L} fill="rgba(255,255,255,.06)" stroke="#cfd8e3" strokeWidth={0.06} />
            <TopShape vehicle={v} x={4} yBottom={g.L + 1} />
            <text x={0.1} y={0.7} fontSize={0.35} fill="#fff">
              {stallGap >= 0 ? `칸보다 좌우 각 ${(stallGap * 100).toFixed(0)} cm 좁음` : `칸보다 좌우 각 ${(-stallGap * 100).toFixed(0)} cm 넓음`}
            </text>
            <text x={0.1} y={1.3} fontSize={0.35} fill="#fff">
              {g.L > STALL_L ? `칸보다 ${(g.L - STALL_L).toFixed(1)} m 김` : '칸 안에 들어가는 길이'}
            </text>
          </svg>
        </div>
      </section>
    </Page>
  )
}
