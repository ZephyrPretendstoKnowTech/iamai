// One fact, one function. Every count a surface shows about the tenant comes
// from here, from the snapshot and the mapping: the accounts, the active
// people, the not active, the four kinds that are not people, the four
// readiness states; and, from the computed plan, the steps and how many are
// done. Connect (its Plan tile and the sample facts built at build time), the
// Plan strip, MFA Readiness's ledger and counts, the campaign step, the print,
// the CSV and the bundle read these; no surface computes a count of its own.
// Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { Step } from '../roadmap/types.ts'
import type { CleanupPhase } from '../roadmap/cleanupPhase.ts'
import { cleanupComplete } from '../roadmap/cleanupDone.ts'
import { READINESS_STATES } from '../scoring/phishingResistant.ts'
import type { ReadinessState } from '../scoring/phishingResistant.ts'
import { KINDS, ladder } from './ladder.ts'
import type { Kind, Ladder, LadderMapping } from './ladder.ts'
import { doneSteps, trackableSteps } from './sets.ts'

/** The tenant's people counts: the accounts, and the parts that sum to them; the four states sum to the active people. */
export type Facts = {
  accounts: number
  active: number
  notActive: number
  kinds: Record<Kind, number>
  states: Record<ReadinessState, number>
}

/** The facts a partition carries (derive/ladder.ts): the one place the counting happens. */
export function factsOf(l: Ladder): Facts {
  const kinds = Object.fromEntries(KINDS.map((k) => [k, l.kinds[k].length])) as Record<Kind, number>
  const states = Object.fromEntries(READINESS_STATES.map((s) => [s, l.states[s].length])) as Record<ReadinessState, number>
  return { accounts: l.accounts, active: l.active, notActive: l.notActive.length, kinds, states }
}

/** The tenant's facts from the snapshot and the mapping; the scan's moment is the clock. */
export function facts(snapshot: TenantSnapshot, mapping: LadderMapping, now: string = snapshot.asOf): Facts {
  return factsOf(ladder(snapshot, mapping, now))
}

/** What completes a Cleanup row beyond its Done control: the mapping's emergency-access answers, as `cleanupComplete` reads them. */
export type CleanupAnswers = { signInMonitoring: boolean | null } | null | undefined

/** The plan's facts: the rows it is measured against (the trackable steps plus the Cleanup rows), and how many are done. */
export type StepFacts = { steps: number; done: number }

/**
 * The counts the Plan header, the print cover and Connect's Plan tile share
 * (E4): the trackable steps plus the Cleanup rows (a step the person said does
 * not apply is out), and how many are done.
 *
 * A Cleanup row is in place exactly when the row itself reads In place, which is
 * `roadmap/cleanupDone.ts` `cleanupComplete(row, answers)` and not `row.done`:
 * the emergency-access sign-in-monitoring attestation completes the alerting row
 * without recording a date. Counting `row.done` here put the aggregate one
 * behind the rows it aggregates — a row saying In place under a header that had
 * not counted it (task 042 correction 1). `answers` is the mapping's
 * `breakGlassAnswers`, and it is required so that a caller decides rather than
 * forgets; absent or null is nothing recorded, which completes nothing.
 */
export function stepFacts(steps: readonly Step[], cleanup: CleanupPhase | null | undefined, answers: CleanupAnswers): StepFacts {
  const counted = steps.filter((s) => !s.doesntApply)
  const rows = cleanup?.rows ?? []
  return { steps: trackableSteps(counted).length + rows.length, done: doneSteps(counted).length + rows.filter((r) => cleanupComplete(r, answers)).length }
}

/**
 * The active people who are not Ready yet: Needs proof, Needs setup and
 * Unknown. The population the registration and verification window exists
 * for, and the one the printed plan states beside it. A count over the one
 * readiness derivation, never a second score: the campaign's pace, the manager
 * line and this all count the same people (Step 7 unified three definitions of
 * "to set up").
 */
export function notReady(f: Facts): number {
  return f.active - f.states.ready
}
