// The who-line and the population line, from one denominator (prompt 48.1 Part
// 1, target-state §8.1). Every row and every step renders active people: the
// count, or the names when three or fewer, or `nobody affected` when the
// evidence shows nobody. The full in-scope enabled count appears once, as a
// `covers N enabled` suffix on the step's population line, never as the
// headline. Pure, so the agreement test reads exactly what the page renders.
import type { StepPopulation } from '../roadmap/types.ts'
import { count, list } from '../copy/statements.ts'

const NAMED_AT_MOST = 3

/** The people a step's row and step name: its active in-scope set (the dormant step names its own accounts). */
export function affectedIds(pop: StepPopulation): string[] {
  return pop.activeIds ?? pop.ids
}

/** The row's who-line: names when three or fewer, else the count, else nobody. */
export function whoLine(pop: StepPopulation, nameOf: (id: string) => string, gap: string | null = null): string {
  const ids = affectedIds(pop)
  const head = ids.length === 0 ? 'nobody affected' : ids.length <= NAMED_AT_MOST ? list(ids.map(nameOf)) : count(ids.length, 'person', 'people')
  return gap ? `${head} · ${gap}` : head
}

/** The step's population line: the active count, then `covers N enabled` when more are in scope. */
export function populationLine(pop: StepPopulation): string {
  const ids = affectedIds(pop)
  if (ids.length === 0) return 'nobody affected'
  // "active people" when they are active; a naming step (dormant, shared) names accounts.
  const bits = [pop.active > 0 ? count(ids.length, 'active person', 'active people') : count(ids.length, 'account')]
  if (pop.admins > 0) bits.push(count(pop.admins, 'admin'))
  if (pop.guests > 0) bits.push(count(pop.guests, 'guest'))
  let line = bits.join(' · ')
  if ((pop.inScope ?? ids.length) > ids.length) line += ` · covers ${pop.inScope} enabled`
  return line
}
