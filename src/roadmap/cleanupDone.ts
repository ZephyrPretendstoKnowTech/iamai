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

export type CleanupCheckpoint = { at: string; cleanup: CleanupKind; date: string }
/** The latest recorded completion per row, as an ISO instant. */
export type CleanupDone = Partial<Record<CleanupKind, string>>
/** What the engine reads from the checkpoints: each row's completion, and every drill date ever recorded. */
export type CleanupRecord = { done: CleanupDone; drills: string[] }

const KINDS: ReadonlySet<string> = new Set<CleanupKind>(['alerting', 'drill', 'naming', 'consolidation', 'notAssessed'])

export function isCleanupCheckpoint(c: unknown): c is CleanupCheckpoint {
  const x = c as Partial<CleanupCheckpoint> | null
  return typeof x === 'object' && x !== null && typeof x.cleanup === 'string' && KINDS.has(x.cleanup) && typeof x.date === 'string' && !Number.isNaN(Date.parse(x.date))
}

/** A calendar day from the Done control ("2026-09-03") as an instant at noon UTC, so it reads as that day in every display zone. */
export function cleanupDateToIso(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00.000Z` : new Date(date).toISOString()
}

/** The checkpoints with one more completion recorded. */
export function withCleanupDone(checkpoints: readonly unknown[], kind: CleanupKind, date: string, at: string): unknown[] {
  const entry: CleanupCheckpoint = { at, cleanup: kind, date: cleanupDateToIso(date) }
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
  return { done: cleanupDoneDates(checkpoints), drills: drillDates(checkpoints) }
}

/** A sign-in within this many hours of a drill day's noon is that drill: a day recorded by its date, whatever zone the sign-in landed in. */
const DRILL_WINDOW_MS = 24 * 3_600_000

/** True when the sign-in fell on a recorded drill's day. */
export function isRecordedDrill(signInIso: string, drills: readonly string[]): boolean {
  const at = Date.parse(signInIso)
  if (drills.length === 0 || Number.isNaN(at)) return false
  return drills.some((d) => Math.abs(at - Date.parse(d)) <= DRILL_WINDOW_MS)
}
