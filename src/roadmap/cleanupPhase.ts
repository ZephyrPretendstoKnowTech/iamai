// The Cleanup phase, dated (target-state §5, §9; prompt 52 Part 3). Cleanup holds
// the hygiene that protects nobody and delays nothing — emergency-account
// sign-in alerting, the emergency access drill, names off the tenant's
// convention, consolidation of the policies this plan superseded, the baseline
// policies not assessed — one row each, present only when it has something to
// say (cleanup.ts decides presence and supplies the lists). This dates it: after
// the last enforcement window, one working day per row, no notice, no rings; the
// header's finish date is the end of the last phase, Cleanup included.
//
// Pure: no DOM, no network. Runs in Node tests and in the worker.
import { cleanupRows } from './cleanup.ts'
import type { CleanupRow } from './cleanup.ts'
import { addWorkingDays } from './timing.ts'
import type { TenantRhythm } from './rhythm.ts'
import type { OrganisationReport } from '../coverage/types.ts'
import { proposeName, usable } from './convention.ts'

export type CleanupPhase = {
  /** The first Cleanup day: the working day after the last enforcement window. */
  start: string
  /** The last Cleanup day: one working day per row. */
  end: string
  /** The rows, in render order, each with its day. */
  rows: (CleanupRow & { day: string })[]
  /** The emergency-access account ids the alerting and drill rows act on. */
  accountIds: string[]
  /** The tenant's naming convention, as a shape a person can follow; null when none is usable. */
  convention: string | null
}

export type CleanupPhaseInput = {
  /** The end of the last enforcement window (the schedule's target end). */
  after: string
  rhythm: TenantRhythm | null
  emergencyAccountIds: string[]
  emergencyAccounts: string[]
  emergencyAccountUpns: string[]
  organisation: OrganisationReport
}

/** The convention as a name shape ("Core - Scope - Action - Target"), or null below the agreement floor. */
export function conventionShape(naming: OrganisationReport['naming']): string | null {
  if (!usable(naming.convention)) return null
  return proposeName(naming.convention, naming.names, { prefix: 'CA', rest: ['Scope', 'Action', 'Target'], collapsed: 'what it does' }).name
}

/**
 * The Cleanup phase for this tenant, or null when nothing in it has anything to
 * say (§5: a group with nothing in it does not render). Rows are dated one per
 * working day from the day after `after`, in render order.
 */
export function cleanupPhaseFor(input: CleanupPhaseInput): CleanupPhase | null {
  const naming = input.organisation.naming
  const convention = conventionShape(naming)
  const rows = cleanupRows({
    emergencyAccounts: input.emergencyAccounts,
    emergencyAccountUpns: input.emergencyAccountUpns,
    // A rename is proposed only where the tenant has a convention to follow.
    renames: convention ? naming.outliers : [],
    overlaps: input.organisation.consolidation.map((c) => c.policyNames.join(', ')),
    notAssessed: input.organisation.notAssessed.map((n) => n.name),
  })
  if (rows.length === 0) return null
  const ctx = input.rhythm ? { rhythm: input.rhythm } : undefined
  let day = addWorkingDays(input.after, 1, ctx)
  const dated: CleanupPhase['rows'] = []
  for (const [i, r] of rows.entries()) {
    if (i > 0) day = addWorkingDays(day, 1, ctx)
    dated.push({ ...r, day })
  }
  return { start: dated[0].day, end: dated[dated.length - 1].day, rows: dated, accountIds: input.emergencyAccountIds, convention }
}
