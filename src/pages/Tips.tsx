import { useState } from 'react'
import { useParams } from 'react-router-dom'
import Page from '../components/Page'
import { COMMON_TIPS, getVehicle } from '../data/vehicles'

const TABS = [
  { k: 'vehicle', l: '이 차' },
  { k: 'preDrive', l: '공통' },
  { k: 'cargo', l: '화물' },
  { k: 'passenger', l: '인원' },
  { k: 'vip', l: '지휘관·귀빈' },
] as const

export default function Tips() {
  const { id } = useParams()
  const v = getVehicle(id ?? '')
  const [tab, setTab] = useState<(typeof TABS)[number]['k']>('vehicle')
  if (!v) return <Page title="차종 없음" back="/"><p>없는 차종입니다.</p></Page>
  const items = tab === 'vehicle' ? v.tips : COMMON_TIPS[tab]
  return (
    <Page title="운전 팁" sub={v.displayName} back={`/v/${v.id}`}>
      <div className="notice">운전 습관 팁입니다. 군 공식 절차가 아니며, 차량 교범과 부대 지시가 항상 우선합니다.</div>
      <div className="chips">
        {TABS.map((t) => (
          <button key={t.k} className={tab === t.k ? 'on' : ''} onClick={() => setTab(t.k)}>{t.l}</button>
        ))}
      </div>
      <ul className="tips">
        {items.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </Page>
  )
}
