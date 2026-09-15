// Cleanup completion (E3). Each Cleanup row has a Done control that records the
// date in the plan's checkpoints (PlanDecisions.checkpoints, in the plan file):
// one small entry per press, `{ at, cleanup, date }`, beside the scan
// checkpoints a save writes. The row then reads "done <date>", and the drill's
// recorded dates exempt the matching emergency sign-ins from the emergency-access
// step's recent-sign-in check: a sign-in on a recorded drill day is the drill;
// any other recent one is a question (confirm who signed in and why).
//
// Pure: no DOM, no network.
import type { CleanupKind } from './cleanup.ts'

export type CleanupCheckpoint = { at: string; cleanup: CleanupKind; date: string; basis?: string; accountIds?: string[]; timeZone?: string }
/** The latest recorded completion per row, as an ISO instant. */
export type CleanupDone = Partial<Record<CleanupKind, string>>
/** What the engine reads from the checkpoints: each row's completion, and every drill date ever recorded. */
export type CleanupRecord = { done: CleanupDone; drills: string[]; records?: CleanupCheckpoint[] }

const KINDS: ReadonlySet<string> = new Set<CleanupKind>(['alerting', 'drill', 'hardening', 'naming', 'consolidation', 'notAssessed'])

export function isCleanupCheckpoint(c: unknown): c is CleanupCheckpoint {
  const x = c as Partial<CleanupCheckpoint> | null
  return typeof x === 'object' && x !== null && typeof x.cleanup === 'string' && KINDS.has(x.cleanup) && typeof x.date === 'string' && !Number.isNaN(Date.parse(x.date))
}

/** A calendar day from the Done control ("2026-09-03") as an instant at noon UTC, so it reads as that day in every display zone. */
export function cleanupDateToIso(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00.000Z` : new Date(date).toISOString()
}

/** The checkpoints with one more completion recorded. */
export function withCleanupDone(checkpoints: readonly unknown[], kind: CleanupKind, date: string, at: string, details: Pick<CleanupCheckpoint, 'basis' | 'accountIds' | 'timeZone'> = {}): unknown[] {
  if (!validCompletionDate(date, at, details.timeZone)) return [...checkpoints]
  const entry: CleanupCheckpoint = { at, cleanup: kind, date: cleanupDateToIso(date), ...details }
  return [...checkpoints, entry]
}

/** The latest completion per row (by when it was recorded). */
export function cleanupDoneDates(checkpoints: readonly unknown[]): CleanupDone {
  const out: CleanupDone = {}
  const seenAt: Partial<Record<CleanupKind, string>> = {}
  for (const c of checkpoints) {
    if (!isCleanupCheckpoint(c)) continue
    const prev = seenAt[c.cleanup]
    if (prev !== undefined && prev > c.at) continue
    seenAt[c.cleanup] = c.at
    out[c.cleanup] = c.date
  }
  return out
}

/** Every drill date ever recorded: an older sign-in matches an older drill. */
export function drillDates(checkpoints: readonly unknown[]): string[] {
  return checkpoints.filter(isCleanupCheckpoint).filter((c) => c.cleanup === 'drill').map((c) => c.date)
}

export function cleanupRecord(checkpoints: readonly unknown[]): CleanupRecord {
  return { done: cleanupDoneDates(checkpoints), drills: drillDates(checkpoints), records: checkpoints.filter(isCleanupCheckpoint) }
}

function calendarDay(iso: string, timeZone: string): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)) }
  catch { return '' }
}

/** Calendar validation also rejects impossible dates and future completions. */
export function validCompletionDate(date: string, now: string, timeZone = 'UTC'): boolean {
  const day = date.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const parsed = new Date(`${day}T00:00:00Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === day && day <= calendarDay(now, timeZone)
}

export function cleanupBasis(kind: CleanupKind, lists: Record<string, string[]>, accountIds: string[] = []): string {
  return JSON.stringify([kind, Object.entries(lists).sort(([a], [b]) => a.localeCompare(b)).map(([key, values]) => [key, [...values].sort()]), accountIds.map((id) => id.toLowerCase()).sort()])
}

/** A legacy date alone is history, not proof about a particular account. */
export function isRecordedDrill(signInIso: string, _legacyDates: readonly string[], accountId?: string, records: readonly CleanupCheckpoint[] = []): boolean {
  if (!accountId || Number.isNaN(Date.parse(signInIso))) return false
  return records.some((r) => {
    if (!validCompletionDate(r.date, r.at, r.timeZone)) return false
    if (r.cleanup !== 'drill' || !r.accountIds?.some((id) => id.toLowerCase() === accountId.toLowerCase())) return false
    try {
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: r.timeZone ?? 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(signInIso))
      return date === r.date.slice(0, 10)
    } catch { return false }
  })
}

export function latestRecoveryTest(accountId: string, records: readonly CleanupCheckpoint[], now: string): string | null {
  const dates = records.filter((r) => r.cleanup === 'drill' && r.accountIds?.some((id) => id.toLowerCase() === accountId.toLowerCase()) && validCompletionDate(r.date, now, r.timeZone) && Date.parse(r.at) <= Date.parse(now)).map((r) => r.date).sort()
  return dates.at(-1) ?? null
}

/**
 * The two facts that can complete the emergency-access alerting row, read as
 * one (task 042).
 *
 * A Cleanup row is normally complete because somebody pressed its Done control,
 * which records a date (`row.done`). Alerting has a second way to be complete
 * and always has: the emergency-access attestation `bg.signInMonitoring`, which
 * the operator ticks on the emergency step and which the validation authority
 * already reads as the answer to "does a sign-in by an emergency account raise
 * an alert somebody sees" (validation/rules.ts). An attestation records no date,
 * so it cannot be a `row.done`, and the two facts had to be read together
 * somewhere.
 *
 * They were being read together in Plan.tsx and read apart in PrintPlan.tsx, so
 * a tenant that had ticked the attestation saw the alerting row as In place on
 * the Plan and as Ready in the printed document — one row, one fact, two
 * answers. This is that reading, once, for both.
 *
 * `answers` is the mapping's `breakGlassAnswers`; absent or null is not "no",
 * it is nothing recorded, and nothing recorded does not complete a row.
 */
export function cleanupComplete(
  row: { kind: CleanupKind; done: string | null },
  answers: { signInMonitoring: boolean | null } | null | undefined,
): boolean {
  if (row.done !== null) return true
  return row.kind === 'alerting' && answers?.signInMonitoring === true
}
