// One fact, one function. Every count a surface shows about the tenant comes
// from here, from the snapshot and the mapping: the accounts, the active
// people, the not active, the four kinds that are not people, the five rungs;
// and, from the computed plan, the steps and how many are done. Connect (its
// Plan tile and the sample facts built at build time), the Plan strip, Today's
// ledger and rungs, the campaign step, the print, the CSV and the bundle read
// these; no surface computes a count of its own. Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { Step } from '../roadmap/types.ts'
import type { CleanupPhase } from '../roadmap/cleanupPhase.ts'
import { KINDS, RUNGS, ladder } from './ladder.ts'
import type { Kind, Ladder, LadderMapping, Rung } from './ladder.ts'
import { doneSteps, trackableSteps } from './sets.ts'

/** The tenant's people counts: the accounts, and the parts that sum to them; the five rungs sum to the active people. */
export type Facts = {
  accounts: number
  active: number
  notActive: number
  kinds: Record<Kind, number>
  rungs: Record<Rung, number>
}

/** The facts a ladder carries (derive/ladder.ts): the one place the counting happens. */
export function factsOf(l: Ladder): Facts {
  const kinds = Object.fromEntries(KINDS.map((k) => [k, l.kinds[k].length])) as Record<Kind, number>
  const rungs = Object.fromEntries(RUNGS.map((r) => [r, l.rungs[r].length])) as Record<Rung, number>
  return { accounts: l.accounts, active: l.active, notActive: l.notActive.length, kinds, rungs }
}

/** The tenant's facts from the snapshot and the mapping; the scan's moment is the clock. */
export function facts(snapshot: TenantSnapshot, mapping: LadderMapping, now: string = snapshot.asOf): Facts {
  return factsOf(ladder(snapshot, mapping, now))
}

/** The plan's facts: the rows it is measured against (the trackable steps plus the Cleanup rows), and how many are done. */
export type StepFacts = { steps: number; done: number }

/**
 * The counts the Plan header, the print cover and Connect's Plan tile share
 * (E4): the trackable steps plus the Cleanup rows (a step the person said does
 * not apply is out), and how many are done (a Cleanup row marked done counts as one).
 */
export function stepFacts(steps: readonly Step[], cleanup: CleanupPhase | null | undefined): StepFacts {
  const counted = steps.filter((s) => !s.doesntApply)
  const rows = cleanup?.rows ?? []
  return { steps: trackableSteps(counted).length + rows.length, done: doneSteps(counted).length + rows.filter((r) => r.done).length }
}
