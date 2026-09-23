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
import { READINESS_STATES } from '../scoring/phishingResistant.ts'
import type { ReadinessState } from '../scoring/phishingResistant.ts'
import { KINDS, ladder } from './ladder.ts'
import type { Kind, Ladder, LadderMapping } from './ladder.ts'
import { boardReadingsOf } from '../ui/surfaces/planBoard.ts'
import { laneCountsOf } from '../ui/surfaces/planLanes.ts'

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
 * (E4): the board's rows (ui/surfaces/planBoard.ts boardReadingsOf, the one
 * reading the Plan draws its rows from), the Cleanup rows included, and how
 * many of them are in the Completed lane. A Deferred row is out, and so is a
 * step the person said does not apply, which has no row.
 *
 * It counted the steps itself, by Step.status: a deferred step was out of both
 * numbers. The board reads a deferred policy the tenant already enforces as
 * Completed (a terminal outcome reached comes before a deferral,
 * actionability/lanes.ts), so mid after the recovery test with every remaining
 * step deferred printed "15 steps · 13 in place" over Completed (15) and To do
 * (2), and the Plan's Completed tile, which counts the board's rows, said 15 of
 * 17. Now the rows are counted where they are drawn.
 *
 * A Cleanup row is in place exactly when the row itself reads In place: the
 * board completes it by `roadmap/cleanupDone.ts` `cleanupComplete` over the
 * row and `answers`, not `row.done`, because the emergency-access sign-in-monitoring
 * attestation completes the alerting row without recording a date (task 042
 * correction 1). `answers` is the mapping's `breakGlassAnswers`, and it is
 * required so that a caller decides rather than forgets; absent or null is
 * nothing recorded, which completes nothing.
 */
export function stepFacts(steps: readonly Step[], cleanup: CleanupPhase | null | undefined, answers: CleanupAnswers): StepFacts {
  const lanes = laneCountsOf(boardReadingsOf(steps, cleanup, answers).readings)
  return { steps: lanes.Ready + lanes['Up Next'] + lanes['On Hold'] + lanes.Completed, done: lanes.Completed }
}

/**
 * The active people who are not Ready yet: Needs proof, Needs setup and
 * Unknown. A count over the one readiness derivation, never a second score.
 * It is not the population the registration window is sized for (the campaign
 * step's people with no usable method, roadmap/generate.ts registrationWindow),
 * so the printed plan no longer states it beside that window
 * (ui/surfaces/printPlan.ts verificationNoteOf).
 */
export function notReady(f: Facts): number {
  return f.active - f.states.ready - f.states.seamless
}
