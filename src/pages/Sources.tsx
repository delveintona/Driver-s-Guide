import Page from '../components/Page'
import { CONFIDENCE_LABEL, SOURCES } from '../data/vehicles'

export default function Sources() {
  return (
    <Page title="출처와 신뢰도" sub="조사 기준일 2026-11-09" back="/">
      <section className="card">
        <h2>신뢰도 범례</h2>
        <ul className="legend">
          {Object.entries(CONFIDENCE_LABEL).map(([k, c]) => (
            <li key={k}><span className={`badge ${c.tone}`}>{c.label}</span> {c.hint}</li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>자료 목록</h2>
        <ul className="src">
          {SOURCES.map((s) => (
            <li key={s.id}>
              <b>[{s.id}]</b> {s.title}
              <span className={`kind ${s.kind}`}>{s.kind === 'official' ? '공식' : '2차'}</span>
              <a href={s.url} target="_blank" rel="noreferrer noopener">{s.url}</a>
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>면허·운전 자격</h2>
        <p>군 운전면허와 일반 운전면허의 차종 기준은 같지 않습니다. 이 사이트는 어떤 면허로 어떤 차량을 운전할 수 있는지 판단하지 않습니다. 소속 군·부대의 차량 운전 허가와 교육 이수 여부를 확인하세요.</p>
      </section>
    </Page>
  )
}
