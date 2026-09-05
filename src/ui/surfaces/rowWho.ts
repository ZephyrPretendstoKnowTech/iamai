// A plan row's who-column, once, for the row and the tests: the population's
// who-line (derive/whoLine.ts), the row's gap clause, and, on a strength
// policy, its lockout count when it is not zero ("3 people · 2 without a
// passkey"). Pure.
import type { Step } from '../../roadmap/types.ts'
import { app } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { whoLine, shortGap } from '../../derive/whoLine.ts'
import { reached } from '../../derive/population.ts'

export function rowWho(step: Step, nameOf: (id: string) => string): string {
  // Who the row names is who the step's own policies name (derive/population.ts
  // reached), never the population the goal handed it. The gap beside it is the
  // goal's coverage and stays the goal's: "3 people · covers 1 of 4 active".
  const gap = step.gapShort ?? step.gap ?? null
  const pop = reached(step)
  // A policy whose scope could not be settled claims no count and no names; the
  // goal's coverage clause is all the row can honestly say.
  const head = pop === null ? (gap ? shortGap(gap.replace(/\*/g, '')) : '') : whoLine(pop, nameOf, gap)
  if (head === '') return ''
  return step.lockout ? `${head} · ${fillText(app.plan.lockoutSuffix, { n: step.lockout })}` : head
}
