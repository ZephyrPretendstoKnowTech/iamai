// The plan's proposed start (target-state §5): today in the display time zone,
// proposed again on every visit until Start the plan anchors a date. Pure, so
// the proposal is testable at a fixed instant in any zone; the schedule clamps
// a weekend proposal to the working day that follows (roadmap/schedule.ts).
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
 * from its start, and keeps doing so: pressing Start anchors the day, so its
 * dates never move under it. Otherwise, the proposal.
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
