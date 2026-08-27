// Dates as a human reads them: relative + absolute, never raw ISO. Pure (Intl
// only) so the roadmap engine and the UI share one rendering.

const REL = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

// Display time zone is a Setup answer; storage stays UTC.
let displayTimeZone: string | undefined

export function setDisplayTimeZone(tz: string | null): void {
  displayTimeZone = tz ?? undefined
}

/** "Sep 10, 2026, 2:05 PM" in the display time zone. */
export function absolute(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: displayTimeZone }).format(
    new Date(iso),
  )
}

/** "Sep 10, 2026" in the display time zone. */
export function absoluteDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: displayTimeZone }).format(new Date(iso))
}

/** "in 9 days", "3 hours ago", "today". */
export function relative(iso: string, nowMs = Date.now()): string {
  const diffMs = Date.parse(iso) - nowMs
  const abs = Math.abs(diffMs)
  const minute = 60_000
  const hour = 3_600_000
  const day = 86_400_000
  if (abs < hour) return REL.format(Math.round(diffMs / minute), 'minute')
  if (abs < day) return REL.format(Math.round(diffMs / hour), 'hour')
  if (abs < 60 * day) return REL.format(Math.round(diffMs / day), 'day')
  return REL.format(Math.round(diffMs / (30 * day)), 'month')
}

/** Whole-day relative wording for plan dates: "in 9 days", "today", "12 days ago". */
export function relativeDays(iso: string, nowMs = Date.now()): string {
  const day = 86_400_000
  const days = Math.round((Date.parse(iso) - nowMs) / day)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  if (Math.abs(days) < 60) return REL.format(days, 'day')
  return REL.format(Math.round(days / 7), 'week')
}

/** Plan date: "in 9 days · Sep 10, 2026". */
export function when(iso: string, nowMs = Date.now()): string {
  return `${relativeDays(iso, nowMs)} · ${absoluteDate(iso)}`
}

/** Timestamp: "3 hours ago · Aug 27, 2026, 11:02 AM". */
export function whenAt(iso: string, nowMs = Date.now()): string {
  return `${relative(iso, nowMs)} · ${absolute(iso)}`
}

/** "Sep 1 → Sep 8, 2026" for a phase. */
export function dateRange(fromIso: string, toIso: string): string {
  return `${absoluteDate(fromIso)} → ${absoluteDate(toIso)}`
}
