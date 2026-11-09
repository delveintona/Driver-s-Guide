import { useState } from 'react'
import { Link } from 'react-router-dom'
import Page from '../components/Page'
import ConfidenceBadge from '../components/ConfidenceBadge'
import { Person, TopShape } from '../components/Silhouette'
import { VEHICLES, type VehicleCategory } from '../data/vehicles'

const SCALE_M = 9.4 // 카드 하나에 담는 세로 미터(모든 카드 동일 축척)

export default function Home() {
  const [cat, setCat] = useState<'all' | VehicleCategory>('all')
  const list = VEHICLES.filter((v) => cat === 'all' || v.category === cat)
  return (
    <Page title="운전병 가이드" sub="타고 싶은 차를 고르세요">
      <div className="notice">
        모든 카드는 <b>같은 축척</b>입니다. 점선은 승용차(4.7 m), 노란 점은 사람입니다. 값은 공개 자료 기준이며 차량 형식마다 다를 수 있습니다.
      </div>
      <div className="chips" role="tablist">
        {([['all', '전체'], ['military', '군용'], ['commercial', '민수 상용']] as const).map(([k, l]) => (
          <button key={k} className={cat === k ? 'on' : ''} onClick={() => setCat(k)}>{l}</button>
        ))}
      </div>
      <div className="grid2">
        {list.map((v) => (
          <Link key={v.id} to={`/v/${v.id}`} className="vcard">
            <svg viewBox={`0 0 ${SCALE_M} ${SCALE_M}`} preserveAspectRatio="xMidYMax meet" aria-hidden>
              <rect x={0} y={0} width={SCALE_M} height={SCALE_M} fill="transparent" />
              <TopShape vehicle={v} x={2.2} yBottom={SCALE_M - 0.3} />
              <g>
                <rect x={5.1} y={SCALE_M - 0.3 - 4.7} width={1.85} height={4.7} rx={0.3} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth={0.05} strokeDasharray="0.25 0.2" />
              </g>
              <Person x={8} yBottom={SCALE_M - 0.6} />
            </svg>
            <div className="vmeta">
              <strong>{v.shortName}</strong>
              <span className="dims">{(v.dimensionsMm.length / 1000).toFixed(1)} × {(v.dimensionsMm.widthBody / 1000).toFixed(2)} m</span>
              <ConfidenceBadge level={v.confidence} />
            </div>
          </Link>
        ))}
      </div>
    </Page>
  )
}
