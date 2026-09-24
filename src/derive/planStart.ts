// The plan's start (target-state §5): today in the display time zone, locked
// the first time the plan is computed for a tenant (lockedStart below), so the
// dates never slide from one visit to the next. Pure, so the start is testable
// at a fixed instant in any zone; a weekend start is the working day that
// follows (roadmap/schedule.ts).
//
// And its first deployment (owner, 2026-09-11): preparation begins on the
// start, and the first deployment-capable work lands on the eligible workday
// after it unless the operator sets another day.
import { nextWorkingDay, toWeekday } from '../roadmap/schedule.ts'

/** The first deployment a plan proposes: the eligible workday after its (weekday) start. */
export function proposedFirstDeployment(startIso: string): string {
  return nextWorkingDay(toWeekday(startIso))
}

/**
 * The first deployment the plan runs on. A day the operator saved stands while it
 * is not before the start. A plan started before the setting existed deployed
 * from its start, and keeps doing so: the lock anchors the day, so its dates
 * never move under it. Otherwise, the proposal.
 */
export function effectiveFirstDeployment(startIso: string, saved: { firstDeployment?: string; startedAt?: string } | null | undefined): string {
  const start = toWeekday(startIso)
  if (saved?.firstDeployment && toWeekday(saved.firstDeployment) >= start) return toWeekday(saved.firstDeployment)
  if (saved?.startedAt && !saved.firstDeployment) return start
  return proposedFirstDeployment(startIso)
}

/** Today's date in the display zone (never UTC), as YYYY-MM-DD. */
export function todayIn(zone: string | null, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zone ?? undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

/** The proposed start: today in the display zone, at noon UTC so the calendar day reads the same everywhere. */
export function proposedStart(zone: string | null, now: Date = new Date()): string {
  return `${todayIn(zone, now)}T12:00:00.000Z`
}

/**
 * The plan's start, locked (owner, 2026-09-23: there is no Start the plan
 * button). A record with no startedAt is locked on the day it is first read:
 * the start it already saved, else today in the display zone, a weekend moved
 * to the Monday after it; the first deployment is anchored beside it as pressing
 * Start anchored it; and startedAt is stamped. A locked record comes back as it
 * is, so a later visit moves no date. Plan settings' Plan starts changes it.
 */
export function lockedStart<T extends { startDate?: string; firstDeployment?: string; startedAt?: string }>(saved: T, zone: string | null, now: Date = new Date()): T {
  if (saved.startedAt) return saved
  const start = toWeekday(saved.startDate ?? proposedStart(zone, now))
  return { ...saved, startDate: start, firstDeployment: effectiveFirstDeployment(start, saved), startedAt: now.toISOString() }
}
