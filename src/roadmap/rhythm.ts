// The tenant's own rhythm (scheduling-and-onboarding.md §2.1): sign-ins per
// weekday and hour in the tenant's time zone, the peak hour, the quietest
// working hour, weekend activity, and a flat-24-hour detection. Pure: the
// worker keeps 168 UTC buckets on the snapshot; this converts and reads them.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { RHYTHM } from '../copy/timing.ts'

export type WeekdayHour = { weekday: number; hour: number }

export type TenantRhythm = {
  status: 'ok' | 'flat' | 'insufficient'
  timeZone: string
  /** 7 × 24 counts, local time, Monday first (0 = Monday). */
  byWeekdayHour: number[][]
  total: number
  /** How many people the sample covers; a pattern from three users is not a pattern. */
  people: number
  /** True when the sample is thin enough that the sentence carries a caveat. */
  provisional: boolean
  /** Local weekdays with meaningful activity, Monday first. */
  workingDays: number[]
  /** The local hour band that holds most of the working-day sign-ins. */
  workingHours: { start: number; end: number }
  peak: WeekdayHour | null
  quietWorking: WeekdayHour | null
  weekendActive: boolean
  sentence: string
}

export const MIN_SIGNINS_FOR_RHYTHM = 100
/**
 * Above the floor but still thin: the pattern is reported with a caveat naming
 * the sample (prompt 37 §18). The review saw Saturday called a working day from
 * thirteen users, stated flatly (S5); a reader who knows the sample is small
 * can weigh it, and a reader who is not told cannot.
 */
export const CONFIDENT_SIGNINS = 1000
export const CONFIDENT_USERS = 25
export const MIN_DAYS_FOR_RHYTHM = 7
const WORKING_BAND = { start: 9, end: 17 }
/** A weekday counts as working when it carries at least this share of the busiest day. */
const WORKING_DAY_SHARE = 0.25
/** Flat when the busiest hour is under this multiple of the average hour. */
const FLAT_RATIO = 1.6

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** Offset in minutes between UTC and the zone at a moment (positive east of UTC). */
const formatters = new Map<string, Intl.DateTimeFormat>()
function offsetMinutes(timeZone: string, at: Date): number {
  try {
    let f = formatters.get(timeZone)
    if (!f) formatters.set(timeZone, (f = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })))
    const parts = f.formatToParts(at)
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
    const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
    return Math.round((local - at.getTime()) / 60_000)
  } catch {
    return 0
  }
}

/** UTC 7×24 buckets (Sunday first, as Date.getUTCDay gives) → local 7×24 buckets, Monday first. */
export function localiseBuckets(utc: number[], timeZone: string, at: string): number[][] {
  const shiftHours = Math.round(offsetMinutes(timeZone, new Date(at)) / 60)
  const local: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  for (let i = 0; i < 168; i++) {
    const n = utc[i] ?? 0
    if (n === 0) continue
    const utcDay = Math.floor(i / 24) // 0 = Sunday
    const utcHour = i % 24
    let h = utcHour + shiftHours
    let d = utcDay
    while (h < 0) {
      h += 24
      d = (d + 6) % 7
    }
    while (h >= 24) {
      h -= 24
      d = (d + 1) % 7
    }
    const monFirst = (d + 6) % 7
    local[monFirst][h] += n
  }
  return local
}

export function tenantRhythm(snapshot: TenantSnapshot, timeZone: string | null): TenantRhythm {
  const tz = timeZone ?? 'UTC'
  const utc = snapshot.evidenceAggregates?.byWeekdayHour ?? null
  const covered = snapshot.sources.signInEvidence?.coveredWindow ?? null
  const coveredDays = covered ? (Date.parse(covered.to) - Date.parse(covered.from)) / 86_400_000 : 0
  const empty: TenantRhythm = {
    status: 'insufficient',
    timeZone: tz,
    byWeekdayHour: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
    total: 0,
    people: 0,
    provisional: true,
    workingDays: [0, 1, 2, 3, 4],
    workingHours: WORKING_BAND,
    peak: null,
    quietWorking: null,
    weekendActive: false,
    sentence: RHYTHM.insufficient,
  }
  if (!utc) return empty
  const total = utc.reduce((a, b) => a + b, 0)
  if (total < MIN_SIGNINS_FOR_RHYTHM || coveredDays < MIN_DAYS_FOR_RHYTHM) return { ...empty, total }
  const local = localiseBuckets(utc, tz, snapshot.asOf)
  const byDay = local.map((hours) => hours.reduce((a, b) => a + b, 0))
  const busiestDay = Math.max(...byDay)
  const workingDays = byDay.map((n, i) => (n >= busiestDay * WORKING_DAY_SHARE ? i : -1)).filter((i) => i >= 0)
  const weekendActive = workingDays.includes(5) || workingDays.includes(6)

  // Flat: the busiest hour is not far above the average hour.
  const byHour = Array.from({ length: 24 }, (_, h) => local.reduce((n, day) => n + day[h], 0))
  const avgHour = total / 24
  const maxHour = Math.max(...byHour)
  if (maxHour < avgHour * FLAT_RATIO) {
    return { ...empty, status: 'flat', byWeekdayHour: local, total, workingDays, weekendActive, sentence: RHYTHM.flat(tz) }
  }

  // The working band: the tightest hour range holding 80% of working-day sign-ins.
  const workHours = Array.from({ length: 24 }, (_, h) => workingDays.reduce((n, d) => n + local[d][h], 0))
  const workTotal = workHours.reduce((a, b) => a + b, 0)
  let start = 0
  let end = 23
  let trimmed = 0
  while (start < end && trimmed + workHours[start] <= workTotal * 0.1) {
    trimmed += workHours[start]
    start += 1
  }
  trimmed = 0
  while (end > start && trimmed + workHours[end] <= workTotal * 0.1) {
    trimmed += workHours[end]
    end -= 1
  }
  const workingHours = { start, end: end + 1 }

  let peak: WeekdayHour | null = null
  let peakN = -1
  let quiet: WeekdayHour | null = null
  let quietN = Number.POSITIVE_INFINITY
  for (const d of workingDays) {
    for (let h = 0; h < 24; h++) {
      const n = local[d][h]
      if (n > peakN) {
        peakN = n
        peak = { weekday: d, hour: h }
      }
      if (h >= WORKING_BAND.start && h < WORKING_BAND.end && n < quietN) {
        quietN = n
        quiet = { weekday: d, hour: h }
      }
    }
  }
  const dayRange = describeDays(workingDays)
  const people = Object.keys(snapshot.signInEvidence ?? {}).length
  const provisional = total < CONFIDENT_SIGNINS || people < CONFIDENT_USERS
  const base = RHYTHM.sentence(dayRange, hourLabel(workingHours.start), hourLabel(workingHours.end), tz, peak ? `${WEEKDAY_NAMES[peak.weekday]} ${hourLabel(peak.hour)}` : '', quiet ? `${WEEKDAY_NAMES[quiet.weekday]} ${hourLabel(quiet.hour)}` : '')
  const sentence = provisional ? `${base} ${RHYTHM.provisional(total, people)}` : base
  return { status: 'ok', timeZone: tz, byWeekdayHour: local, total, people, provisional, workingDays, workingHours, peak, quietWorking: quiet, weekendActive, sentence }
}

export function hourLabel(hour: number): string {
  return `${String(hour % 24).padStart(2, '0')}:00`
}

function describeDays(days: number[]): string {
  if (days.length === 0) return RHYTHM.noDays
  const sorted = [...days].sort((a, b) => a - b)
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1)
  if (contiguous && sorted.length > 1) return `${WEEKDAY_NAMES[sorted[0]]} to ${WEEKDAY_NAMES[sorted[sorted.length - 1]]}`
  return sorted.map((d) => WEEKDAY_NAMES[d]).join(', ')
}
