// The who-line and the population line, from one denominator (prompt 48.1 Part
// 1, target-state §8.1). Every row and every step renders active people: the
// count, never a name, or the word for a reach of nobody. The full in-scope
// enabled count appears once, as a `covers N enabled` suffix on the step's
// population line, never as the headline. Pure, so the agreement test reads
// exactly what the page renders.
import type { StepPopulation } from '../roadmap/types.ts'
import { count } from '../copy/statements.ts'
import { engine, pages } from '../content/content.ts'
import { fillText } from '../content/render.ts'

/**
 * The Impact words that are not a count (owner, 2026-09-11): a reach nobody
 * settled is Not established, never zero; a policy that reaches nobody has No
 * user impact; a step that changes configuration and names no people reads
 * what it touches — its package's `impact.fallbackLabel` — or `none`, the
 * placeholder (U13, ui/surfaces/rowWho.ts).
 */
export const IMPACT = (pages.plan as { impact: { notEstablished: string; noUserImpact: string; none: string; coversEnabled: string } }).impact

// A row counts people and never names them (RUN-CONTEXT-B decision 11): one
// person reads "1 person", and the names are on the step. The gap on a row is
// one shortened clause; the full sentence is on the step.
const GAP_CHARS = 40

/** The people a step's row and step name: its active in-scope set (the dormant step names its own accounts). */
export function affectedIds(pop: StepPopulation): string[] {
  return pop.activeIds ?? pop.ids
}

/**
 * One cohort in the same words wherever it is counted (owner, 2026-09-19):
 * guests stay in the MFA campaign and are named beside the people — "30 people
 * and 1 guest" — never dropped from one count and kept in another. `total`
 * counts everyone, guests included; a cohort of guests alone reads "1 guest".
 * fillText prints each number as count() does ("3,981 people").
 */
export function cohortWords(total: number, guests: number): string {
  const W = engine.cohort
  const people = Math.max(0, total - guests)
  if (guests <= 0) return fillText(W.people, { n: total })
  if (people === 0) return fillText(W.guests, { n: guests })
  return fillText(W.both, { people, guests })
}

/** The guests among a cohort's ids, counted against the ids the cohort holds now. */
export function guestsAmong(ids: readonly string[], guestIds: readonly string[]): number {
  const guests = new Set(guestIds)
  return ids.filter((id) => guests.has(id)).length
}

/** A row's gap suffix: one shortened clause, ≤40 characters (the full sentence is on the step). */
export function shortGap(gap: string): string {
  let s = gap.replace(/^sessions /, '').replace(/\bbaseline wants\b/, 'wants')
  // Shortened, never truncated (prompt 50.1 item 9): drop secondary clauses
  // joined by " and " rather than cutting mid-word into "…persist in the…".
  if (s.length > GAP_CHARS) s = s.replace(/ and [^,]*/g, '')
  if (s.length <= GAP_CHARS) return s
  // Still over budget: keep whole words up to the budget, with no ellipsis.
  return s.slice(0, GAP_CHARS).replace(/[\s,]+\S*$/, '')
}

/**
 * The row's who-line: the count of the people the step reaches, never their
 * names. An empty reach reads `none`: No user impact for a policy, what the
 * step touches for a step that names no people (rowWho.ts).
 */
export function whoLine(pop: StepPopulation, gap: string | null = null, none: string = IMPACT.noUserImpact): string {
  gap = gap ? gap.replace(/\*/g, '') : gap
  const n = affectedIds(pop).length
  const head = n === 0 ? none : count(n, 'person', 'people')
  return gap ? `${head} · ${shortGap(gap)}` : head
}

/** The step's population line: the active count, then `covers N enabled` when more are in scope. */
export function populationLine(pop: StepPopulation): string {
  const ids = affectedIds(pop)
  if (ids.length === 0) return IMPACT.noUserImpact
  // "active people" only when every account the head counts is one; a naming
  // step (dormant accounts, per-user MFA states) names accounts, active or not
  // (derive/population.ts namedAccounts). "Any of them is active" called two
  // emergency accounts and seven dormant ones "active people" (R4-57).
  const bits = [pop.active >= ids.length ? count(ids.length, 'active person', 'active people') : count(ids.length, 'account')]
  if (pop.admins > 0) bits.push(count(pop.admins, 'admin'))
  if (pop.guests > 0) bits.push(count(pop.guests, 'guest'))
  let line = bits.join(' · ')
  const inScope = pop.inScope ?? ids.length
  if (inScope > ids.length) line += ` · ${fillText(IMPACT.coversEnabled, { n: inScope })}`
  return line
}
