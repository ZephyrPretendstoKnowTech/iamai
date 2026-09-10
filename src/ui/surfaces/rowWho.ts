// A plan row's Impact column, once, for the row and the tests: who the step's
// own policies reach (derive/whoLine.ts), the row's gap clause, and, on a
// strength policy, its lockout count when it is not zero ("3 people · 2 without a
// passkey"). Pure.
import type { Step } from '../../roadmap/types.ts'
import { app } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { whoLine } from '../../derive/whoLine.ts'
import { reached } from '../../derive/population.ts'
import { REPORT_ONLY_GAP } from '../../coverage/verdict.ts'

export function rowWho(step: Step, nameOf: (id: string) => string): string {
  // Who the row names is who the step's own policies name (derive/population.ts
  // reached), never the population the goal handed it. The gap beside it is the
  // goal's coverage and stays the goal's: "3 people · covers 1 of 4 active".
  const pop = reached(step)
  // Impact is who the step reaches. A policy whose scope could not be settled
  // claims no count, no names and nothing in their place: the goal's gap clause
  // on its own ("does not exclude the exclusions group") says what is wrong with
  // a policy, not who it affects, and it read as the column's answer.
  if (pop === null) return ''
  // Nor does the column restate the state: "report-only, not enforced" beside a
  // row whose status word is Report-only said the same thing twice.
  const gap = step.gapShort ?? step.gap ?? null
  const head = whoLine(pop, nameOf, gap === REPORT_ONLY_GAP ? null : gap)
  return step.lockout ? `${head} · ${fillText(app.plan.lockoutSuffix, { n: step.lockout })}` : head
}
