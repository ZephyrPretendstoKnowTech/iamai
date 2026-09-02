// The Cleanup phase (target-state §5, §9, prompt 51 Part 3(e)). Cleanup holds the
// hygiene that protects nobody and delays nothing: emergency-account sign-in
// alerting, the emergency access drill, names off the tenant's convention,
// consolidation of the policies this plan superseded, and the baseline policies
// not assessed — one row each, and each rendered only when it has something to
// say. Every row's prose is a string in content.cleanup; this deriver decides
// which rows are present and supplies the lists those strings fill.
//
// Cleanup is dated after the last enforcement window and delays no protection
// (§9); the finish-date-includes-Cleanup wiring lives with the schedule calendar
// and the Plan header (Unit 5), because it needs the working-day calendar.
//
// Pure: no DOM, no network. Runs in Node tests and in the worker.

export type CleanupKind = 'alerting' | 'drill' | 'naming' | 'consolidation' | 'notAssessed'

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
  /** Baseline policies IAMAI could not assess against a goal; reviewed, never enforced. */
  notAssessed: string[]
}

// The order Cleanup renders in (§5): alerting, drill, naming, consolidation,
// not-assessed. Each entry names its content key and whether it is present.
const ORDER: { kind: CleanupKind; present: (i: CleanupInputs) => boolean; lists: (i: CleanupInputs) => Record<string, string[]> }[] = [
  { kind: 'alerting', present: (i) => i.emergencyAccounts.length > 0, lists: (i) => ({ emergencyAccountUpns: i.emergencyAccountUpns && i.emergencyAccountUpns.length === i.emergencyAccounts.length ? i.emergencyAccountUpns : i.emergencyAccounts }) },
  { kind: 'drill', present: (i) => i.emergencyAccounts.length > 0, lists: (i) => ({ emergencyAccounts: i.emergencyAccounts }) },
  { kind: 'naming', present: (i) => i.renames.length > 0, lists: (i) => ({ renames: i.renames }) },
  { kind: 'consolidation', present: (i) => i.overlaps.length > 0, lists: (i) => ({ overlaps: i.overlaps }) },
  { kind: 'notAssessed', present: (i) => i.notAssessed.length > 0, lists: (i) => ({ policies: i.notAssessed }) },
]

/**
 * The Cleanup rows that are present, in render order. A row with nothing to say
 * does not appear (§5: a group with nothing in it does not render), so on a clean
 * tenant with no emergency accounts, no renames, no overlaps and nothing
 * unassessed, Cleanup is empty and the phase does not render.
 */
export function cleanupRows(inputs: CleanupInputs): CleanupRow[] {
  return ORDER.filter((e) => e.present(inputs)).map((e) => ({ kind: e.kind, lists: e.lists(inputs) }))
}
