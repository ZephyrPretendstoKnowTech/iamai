// The plan's proposed start (target-state §5): today in the display time zone,
// proposed again on every visit until Start the plan anchors a date. Pure, so
// the proposal is testable at a fixed instant in any zone; the schedule clamps
// a weekend proposal to the working day that follows (roadmap/schedule.ts).

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
