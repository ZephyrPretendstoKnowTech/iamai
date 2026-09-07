// Microsoft's records of one policy, as a fixture hands them to the engine.
//
// A `PolicyAppliedResult` is a set of totals over whatever the sign-in
// collection covered, and the readiness gate judges one window inside that — so
// a result also carries the dated view that says which of its report-only
// records fall in the window being judged (collect/types.ts `reportOnlyDated`).
// A fixture that supplies the totals and no dates is handing the engine records
// it cannot place, and the gate does not open on those. That is the contract, so
// there is one place that builds a clean record rather than one per test file.
import type { PolicyAppliedResult, TenantSnapshot } from '../../graph/collect/types.ts'

/** The dated view of a set of report-only records all made on the day of `at`. */
export function seenOn(people: readonly string[], at: string): NonNullable<PolicyAppliedResult['reportOnlyDated']> {
  const day = at.slice(0, 10)
  return {
    signInsByDay: people.length > 0 ? [{ day, signIns: people.length }] : [],
    lastSeenByUser: Object.fromEntries(people.map((id) => [id, day])),
  }
}

/**
 * One policy watched clean: a report-only success for every person given and
 * nothing failing, dated to the day of `asOf` — so the evidence gate's
 * "everybody in scope seen" half closes whoever the policy reaches, and its
 * failure count is a zero records prove rather than the zero an empty set adds
 * up to.
 */
export function cleanReportOnly(opts: {
  policyId: string
  people: readonly string[]
  asOf: string
  displayName?: string
  firstReportOnlyAt?: string | null
}): PolicyAppliedResult {
  const people = [...opts.people]
  return {
    policyId: opts.policyId,
    displayName: opts.displayName ?? '',
    counts: { reportOnlyFailure: 0, reportOnlyInterrupted: 0, reportOnlySuccess: people.length, enforcedFailure: 0, enforcedSuccess: 0 },
    affectedUserIds: { reportOnlyFailure: [], reportOnlyInterrupted: [], reportOnlySuccess: people, enforcedFailure: [], enforcedSuccess: [] },
    reportOnlyDated: seenOn(people, opts.asOf),
    firstReportOnlyAt: opts.firstReportOnlyAt ?? null,
  }
}

/**
 * The same tenant, read by a scan at `asOf`: the snapshot's own timestamp and
 * the interval its sign-in collection covers both move with the scan.
 *
 * A scan reads the log it can reach at the moment it runs, so a fixture that
 * advances the clock and leaves the collection where it was is a tenant whose
 * records stop days before the scan — and the readiness gate reads that,
 * correctly, as a window nobody finished watching (roadmap/tracking.ts
 * `windowCollected`). The window keeps its length and slides, which is what the
 * collector does with it (collect/laneBCore.ts `runLaneB`).
 */
export function scannedAt(snapshot: TenantSnapshot, asOf: string): TenantSnapshot {
  const src = snapshot.sources.signInEvidence
  const covered = src?.coveredWindow ?? null
  const slid = covered === null ? null : { from: new Date(Date.parse(covered.from) + (Date.parse(asOf) - Date.parse(covered.to))).toISOString(), to: asOf }
  return {
    ...snapshot,
    asOf,
    sources: { ...snapshot.sources, signInEvidence: { ...src, asOf, coveredWindow: slid } },
  }
}
