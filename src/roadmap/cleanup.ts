// The Cleanup phase (target-state §5, §9, prompt 51 Part 3(e)). Cleanup holds the
// hygiene that protects nobody and delays nothing: emergency-account sign-in
// alerting, the emergency access drill, names off the tenant's convention, and
// consolidation of the policies this plan superseded — one row each, and each
// rendered only when it has something to say. Every row's prose is a string in
// content.cleanup; this deriver decides which rows are present and supplies the
// lists those strings fill.
//
// The baseline policies IAMAI did not assess were a sixth row, and are not:
// generate.ts builds one `s-review-baseline-<policy>` step per policy from the
// same `organisation.notAssessed` array, so the row said the same list a second
// time and was already switched off by handing this module an empty array
// (docs/plans/step-redundancy-analysis.md finding 8). The review steps are the
// one source.
//
// Cleanup is dated after the last enforcement window and delays no protection
// (§9); the finish-date-includes-Cleanup wiring lives with the schedule calendar
// and the Plan header (Unit 5), because it needs the working-day calendar.
//
// Pure: no DOM, no network. Runs in Node tests and in the worker.

export type CleanupKind = 'alerting' | 'drill' | 'hardening' | 'naming' | 'consolidation'

/** A Cleanup row: which content.cleanup entry to render, and the lists it fills. */
export type CleanupRow = {
  kind: CleanupKind
  lists: Record<string, string[]>
}

export type CleanupInputs = {
  /** Emergency-access account names; the drill acts on these. */
  emergencyAccounts: string[]
  /** The same accounts as sign-in names, for the alert rule; the names stand in when absent. */
  emergencyAccountUpns?: string[]
  /** Proposed renames, already formatted for the reader; empty when the tenant follows its convention. */
  renames: string[]
  /** Groups of policy names this plan superseded and can merge; empty when nothing overlaps. */
  overlaps: string[]
  /** Emergency-access hardening the operator deferred, already worded (owner, 2026-09-11); empty when nothing is deferred and outstanding. */
  hardening?: string[]
}

// The order Cleanup renders in (§5): alerting, drill, naming, consolidation.
// Each entry names its content key and whether it is present.
const ORDER: { kind: CleanupKind; present: (i: CleanupInputs) => boolean; lists: (i: CleanupInputs) => Record<string, string[]> }[] = [
  { kind: 'alerting', present: (i) => i.emergencyAccounts.length > 0, lists: (i) => ({ emergencyAccountUpns: i.emergencyAccountUpns && i.emergencyAccountUpns.length === i.emergencyAccounts.length ? i.emergencyAccountUpns : i.emergencyAccounts }) },
  // Recovery verification is one of the four canonical emergency-access steps.
  // Keep its row present before account selection so the grouped journey has a
  // stable fourth step and can point back to the selection work it needs.
  { kind: 'drill', present: () => true, lists: (i) => ({ emergencyAccounts: i.emergencyAccounts }) },
  { kind: 'hardening', present: (i) => (i.hardening ?? []).length > 0, lists: (i) => ({ hardening: i.hardening ?? [] }) },
  { kind: 'naming', present: (i) => i.renames.length > 0, lists: (i) => ({ renames: i.renames }) },
  { kind: 'consolidation', present: (i) => i.overlaps.length > 0, lists: (i) => ({ overlaps: i.overlaps }) },
]

/**
 * The Cleanup rows that are present, in render order. A row with nothing to say
 * does not appear (§5: a group with nothing in it does not render), so on a clean
 * tenant with no emergency accounts, no renames and no overlaps, Cleanup is the
 * drill alone.
 */
export function cleanupRows(inputs: CleanupInputs): CleanupRow[] {
  return ORDER.filter((e) => e.present(inputs)).map((e) => ({ kind: e.kind, lists: e.lists(inputs) }))
}
