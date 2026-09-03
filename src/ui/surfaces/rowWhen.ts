// The plan row's date column, once, for the row and the tests: a readiness hold
// reads its reason; a policy in report-only reads when it may be enforced (ready
// <date> · ready now · ready since <date>, from the tracking's two gates); a
// prerequisite or check is now; a dated step reads its enforcement instant; a
// blocked step with no date of its own reads its wave's start, so a row reads
// Blocked · <date>, Report-only · ready <date> or Ready · now, never Blocked · now.
import type { Step } from '../../roadmap/types.ts'
import { pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { heldByReadiness } from '../../derive/finish.ts'
import { readyWhen } from '../../derive/readyWhen.ts'

const PLAN = pages.plan as { now: string; readyOn: string; readyNow: string; readySince: string }

export function rowWhen(step: Step, waveStart: string | null = null): string {
  // A done step's row shows no date word: blank, never "now".
  if (step.status === 'done') return ''
  if (heldByReadiness(step)) {
    const b = step.blockers.find((x) => x.kind === 'readiness' && typeof x.binding === 'string' && /readiness reaches/.test(x.binding))
    if (b && typeof b.binding === 'string') return b.binding
  }
  const ready = readyWhen(step)
  if (ready) return ready.kind === 'now' ? PLAN.readyNow : fillText(ready.kind === 'since' ? PLAN.readySince : PLAN.readyOn, { date: absoluteDate(ready.date) })
  if (step.kind === 'prerequisite' || step.kind === 'check') return PLAN.now
  const at = step.events?.enforce.at ?? step.rings[0]?.plannedStart ?? (step.status === 'blocked' ? waveStart : null)
  return at ? absoluteDate(at) : PLAN.now
}
