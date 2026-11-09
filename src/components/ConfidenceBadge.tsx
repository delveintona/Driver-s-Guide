import { CONFIDENCE_LABEL, type Confidence } from '../data/vehicles'

export default function ConfidenceBadge({ level }: { level: Confidence }) {
  const c = CONFIDENCE_LABEL[level]
  return (
    <span className={`badge ${c.tone}`} title={c.hint}>
      {c.label}
    </span>
  )
}
