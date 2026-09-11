// Dates as a human reads them: relative + absolute, never raw ISO. Pure (Intl
// only) so the roadmap engine and the UI share one rendering.

const REL = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

// Display time zone is a Setup answer; storage stays UTC.
let displayTimeZone: string | undefined

/**
 * The four date shapes, each built once and kept.
 *
 * An `Intl.DateTimeFormat` costs far more to construct than to use, and these
 * are called once per row: the Inventory people table and the Export CSVs
 * format a date for every account in the directory, which on a five-thousand
 * person tenant was 169 ms of building the same formatter five thousand times.
 * `REL` above was already hoisted for the same reason; these four were not.
 *
 * The zone is the one thing that changes them, so the cache is dropped when it
 * changes rather than keyed by it — a date is never formatted in a zone the
 * plan is no longer displaying.
 */
const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(key: string, locale: string | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const held = formatters.get(key)
  if (held) return held
  const made = new Intl.DateTimeFormat(locale, { ...options, timeZone: displayTimeZone })
  formatters.set(key, made)
  return made
}

export function setDisplayTimeZone(tz: string | null): void {
  const next = tz ?? undefined
  if (next === displayTimeZone) return
  displayTimeZone = next
  formatters.clear()
}

/** "Sep 10, 2026, 2:05 PM" in the display time zone. */
export function absolute(iso: string): string {
  return formatter('absolute', undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

/** "Sep 10, 2026" in the display time zone. */
export function absoluteDate(iso: string): string {
  return formatter('absoluteDate', undefined, { dateStyle: 'medium' }).format(new Date(iso))
}

/**
 * "Monday, September 28" in the display time zone: the long form, for emails
 * only (walk-51 item 5). In the display time zone like every other date here, so
 * it never falls a day either side of the short form from the same instant.
 */
export function longDate(iso: string): string {
  return formatter('longDate', 'en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(iso))
}

/** "Jul 30": a day inside a range whose year is obvious. */
export function monthDay(iso: string): string {
  return formatter('monthDay', 'en', { month: 'short', day: 'numeric' }).format(new Date(iso))
}

/** "Jul 30 → Aug 29": the sign-in window on Connect, in the range form the plan uses. */
export function monthDayRange(fromIso: string, toIso: string): string {
  return `${monthDay(fromIso)} → ${monthDay(toIso)}`
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

/**
 * "Sep 11–16", "Sep 29–Oct 3", "Sep 11": a phase's span as the Plan's group heads
 * read it (owner, 2026-09-11), in the display time zone; a year only where the
 * span crosses one.
 */
export function dateSpan(fromIso: string, toIso: string): string {
  const f = formatter('spanParts', 'en', { year: 'numeric', month: 'short', day: 'numeric' })
  const parts = (iso: string): { year: string; month: string; day: string } => {
    const out = { year: '', month: '', day: '' }
    for (const p of f.formatToParts(new Date(iso))) if (p.type === 'year' || p.type === 'month' || p.type === 'day') out[p.type] = p.value
    return out
  }
  const a = parts(fromIso)
  const b = parts(toIso)
  if (a.year !== b.year) return `${a.month} ${a.day}, ${a.year}–${b.month} ${b.day}, ${b.year}`
  if (a.month !== b.month) return `${a.month} ${a.day}–${b.month} ${b.day}`
  return a.day === b.day ? `${a.month} ${a.day}` : `${a.month} ${a.day}–${b.day}`
}

/** "Sep 1 → Sep 8, 2026" for a phase. */
export function dateRange(fromIso: string, toIso: string): string {
  return `${absoluteDate(fromIso)} → ${absoluteDate(toIso)}`
}

/** A scan older than this gets a warning on every page that depends on it (prompt 20 §9). */
export const STALE_SCAN_DAYS = 7
export function scanAgeDays(iso: string, nowMs = Date.now()): number {
  const ms = nowMs - Date.parse(iso)
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 86_400_000) : 0
}
