import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function Page({ title, sub, back, children }: { title: string; sub?: string; back?: string | true; children: ReactNode }) {
  const nav = useNavigate()
  return (
    <div className="page">
      <header className="top">
        {back ? (
          <button className="back" onClick={() => (back === true ? nav(-1) : nav(back))} aria-label="뒤로">‹</button>
        ) : (
          <span className="logo">▲</span>
        )}
        <div className="titles">
          <h1>{title}</h1>
          {sub && <p>{sub}</p>}
        </div>
        <Link className="src-link" to="/sources">출처</Link>
      </header>
      <main>{children}</main>
      <footer className="foot">
        교육 보조 도구입니다. 부대 운전 규정·차량 기술교범·교관 지시를 대체하지 않으며, 시뮬레이터는 운행 허가나 통과 가능의 보증이 아닙니다.
      </footer>
    </div>
  )
}
