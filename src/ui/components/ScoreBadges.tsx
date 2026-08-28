import { SCORE } from '../../copy/definitions.ts'
import { FINDINGS } from '../../copy/pages.ts'
import type { GoalScore } from '../../scoring/priority.ts'

// Three small badges: security value, effort, disruption. Each carries its
// definition as a title; the full InfoTip lives once in the control bar.
export function ScoreBadges({ score }: { score: GoalScore | null }) {
  if (!score) return null
  const B = FINDINGS.badge
  return (
    <span className="score-badges" aria-label={`${SCORE.priority.title} ${score.priority}`}>
      <span className="score-badge score-value" title={`${SCORE.value.title}: ${SCORE.value.text}`}>
        {B.value} {score.value}
      </span>
      <span className="score-badge score-effort" title={`${SCORE.effort.title}: ${SCORE.effort.text}`}>
        {B.effort} {score.effort}
      </span>
      <span className="score-badge score-disruption" title={`${SCORE.disruption.title}: ${SCORE.disruption.text}`}>
        {B.disruption} {score.disruption}
      </span>
    </span>
  )
}
