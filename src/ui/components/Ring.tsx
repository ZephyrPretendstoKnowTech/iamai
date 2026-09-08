// The ring motif (ux-review-07 §F1): staged rollout as concentric arcs, one
// arc per ring, as the progress indicator on a step.
//
// It used to be the logo as well. It is not any more: the mark is the Guided
// Route logo the owner approved (task 029), drawn from one master and rendered
// by src/ui/components/Mark.tsx. A progress indicator and a brand mark being
// the same shape meant a change to either one moved the other.
import type { Step } from '../../roadmap/types.ts'

/**
 * Ring progress for a step: one arc per ring, filled by completion. A step
 * without rings shows one arc: full when done, empty otherwise.
 */
export function RingProgress({ step, size = 28, title }: { step: Step; size?: number; title?: string }) {
  const rings = step.rings.length > 0 ? step.rings : [null]
  const done = step.status === 'done'
  const c = size / 2
  const stroke = Math.max(2, size / 10)
  const gap = stroke * 0.9
  const outer = c - stroke / 2 - 1
  const filledIndex = (i: number): boolean => {
    if (done) return true
    const r = rings[i]
    if (!r) return false
    return r.actualEnd !== null || (step.currentRing > i && r.actualStart !== null)
  }
  const activeIndex = (i: number): boolean => !done && rings[i] !== null && rings[i]?.actualStart !== null && rings[i]?.actualEnd === null
  return (
    <svg className={`ring-progress ${done ? 'is-done' : ''}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title} focusable="false">
      {title && <title>{title}</title>}
      {rings.map((_, i) => {
        const r = outer - i * (stroke + gap)
        if (r <= stroke) return null
        const filled = filledIndex(i)
        const active = activeIndex(i)
        return (
          <g key={i}>
            <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="ring-track" />
            <circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeLinecap="round"
              className={`ring-fill ${filled ? 'is-filled' : active ? 'is-active' : ''}`}
              pathLength={100}
              strokeDasharray={filled ? '100 0' : active ? '50 50' : '0 100'}
              transform={`rotate(-90 ${c} ${c})`}
            />
          </g>
        )
      })}
    </svg>
  )
}
