// A plan row's who-column, once, for the row and the tests: the population's
// who-line (derive/whoLine.ts), the row's gap clause, and, on a strength
// policy, its lockout count when it is not zero ("3 people · 2 without a
// passkey"). Pure.
import type { Step } from '../../roadmap/types.ts'
import { app } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { whoLine } from '../../derive/whoLine.ts'

export function rowWho(step: Step, nameOf: (id: string) => string): string {
  const head = whoLine(step.population, nameOf, step.gapShort ?? step.gap ?? null)
  return step.lockout ? `${head} · ${fillText(app.plan.lockoutSuffix, { n: step.lockout })}` : head
}
