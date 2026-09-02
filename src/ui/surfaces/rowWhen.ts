// The plan row's date column, once, for the row and the tests: a readiness hold
// reads its reason; a prerequisite or check is now; a dated step reads its
// enforcement instant; a blocked step with no date of its own reads its wave's
// start, so a row reads Blocked · <date> or Ready · now, never Blocked · now.
import type { Step } from '../../roadmap/types.ts'
import { pages } from '../../content/content.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { heldByReadiness } from '../../derive/finish.ts'

const NOW = (pages.plan as { now: string }).now

export function rowWhen(step: Step, waveStart: string | null = null): string {
  if (heldByReadiness(step)) {
    const b = step.blockers.find((x) => x.kind === 'readiness' && typeof x.binding === 'string' && /readiness reaches/.test(x.binding))
    if (b && typeof b.binding === 'string') return b.binding
  }
  if (step.kind === 'prerequisite' || step.kind === 'check') return NOW
  const at = step.events?.enforce.at ?? step.rings[0]?.plannedStart ?? (step.status === 'blocked' ? waveStart : null)
  return at ? absoluteDate(at) : NOW
}
