// The three dates on every step (scheduling-and-onboarding.md §2.2, §2.3):
// announce, remind, enforce, each with a local day, date and time and a
// one-line reason. Suggestions from the rules table; the tenant's rhythm
// overrides the peak-hour and weekend assumptions. Pure.
import { EVENT } from '../copy/timing.ts'
import type { TenantRhythm } from './rhythm.ts'
import { WEEKDAY_NAMES, hourLabel } from './rhythm.ts'
import type { Step, StepEvent, StepEvents } from './types.ts'

export type NoticeSettings = { low: number; medium: number; high: number }
export const NOTICE_DEFAULTS: NoticeSettings = { low: 2, medium: 5, high: 10 }
export const CARE_MINIMUM_NOTICE = 5
const HIGH_DISRUPTION = 4
const MEDIUM_DISRUPTION = 3
const ANNOUNCE_HOUR = 9.5
const DEFAULT_ENFORCE_HOUR = 10

export type TimingContext = {
  rhythm: TenantRhythm
  notice: NoticeSettings
  /** YYYY-MM-DD dates nothing is enforced on, or the working day before. */
  holidays: string[]
  timeZone: string
}

/** Monday-first weekday of an ISO date (0 = Monday). */
export function weekdayOf(iso: string): number {
  return (new Date(iso).getUTCDay() + 6) % 7
}

export function isHoliday(iso: string, holidays: string[]): boolean {
  return holidays.includes(iso.slice(0, 10))
}

/** A working day: Monday to Friday, not a holiday. The tenant's rhythm can add weekend days. */
export function isWorkingDay(iso: string, ctx: Pick<TimingContext, 'holidays' | 'rhythm'>): boolean {
  const d = weekdayOf(iso)
  const weekend = d >= 5 && !ctx.rhythm.workingDays.includes(d)
  return !weekend && !isHoliday(iso, ctx.holidays)
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

/** Step back N working days from a date. */
export function workingDaysBefore(iso: string, n: number, ctx: Pick<TimingContext, 'holidays' | 'rhythm'>): string {
  let cursor = iso
  let left = n
  let guard = 0
  while (left > 0 && guard < 400) {
    cursor = addDays(cursor, -1)
    if (isWorkingDay(cursor, ctx)) left -= 1
    guard += 1
  }
  return cursor
}

/** The last working day before a holiday is never an enforcement day (§2.2). */
export function isDayBeforeHoliday(iso: string, ctx: Pick<TimingContext, 'holidays' | 'rhythm'>): boolean {
  let next = addDays(iso, 1)
  let guard = 0
  while (!isWorkingDay(next, ctx) && guard < 10) {
    if (isHoliday(next, ctx.holidays)) return true
    next = addDays(next, 1)
    guard += 1
  }
  return isHoliday(next, ctx.holidays)
}

/**
 * The enforcement day for a change: Tuesday or Wednesday (Tuesday only when
 * high-disruption), never a Friday, a holiday, the last working day before
 * one, or a weekend. Weekend-active tenants still enforce midweek: the rule
 * is about support cover, not about who is signed in.
 */
export function toEnforcementDay(iso: string, opts: { highDisruption?: boolean; holidays?: string[]; rhythm?: TenantRhythm | null } = {}): string {
  const ctx = { holidays: opts.holidays ?? [], rhythm: opts.rhythm ?? { workingDays: [0, 1, 2, 3, 4] } as TenantRhythm }
  // No holidays: pure weekday arithmetic (the scheduler calls this thousands of times on a large tenant).
  if (ctx.holidays.length === 0) {
    const d = weekdayOf(iso)
    if (opts.highDisruption) return d === 1 ? iso : addDays(iso, (1 - d + 7) % 7)
    if (d === 1 || d === 2) return iso
    return addDays(iso, (1 - d + 7) % 7)
  }
  let cursor = iso
  for (let guard = 0; guard < 60; guard++) {
    const d = weekdayOf(cursor)
    const allowedDay = opts.highDisruption ? d === 1 : d === 1 || d === 2
    if (allowedDay && !isHoliday(cursor, ctx.holidays) && !isDayBeforeHoliday(cursor, ctx)) return cursor
    cursor = addDays(cursor, 1)
  }
  return cursor
}

function atLocalHour(iso: string, hour: number, timeZone: string): string {
  // Express a local wall-clock hour on that calendar day as UTC, using the zone's offset that day.
  const day = iso.slice(0, 10)
  const noon = Date.parse(`${day}T12:00:00.000Z`)
  const offset = offsetMinutes(timeZone, new Date(noon))
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), h, m) - offset * 60_000).toISOString()
}

// Intl formatters are costly to build; one per zone is enough.
const offsetFormatters = new Map<string, Intl.DateTimeFormat>()
const labelFormatters = new Map<string, Intl.DateTimeFormat>()
function offsetMinutes(timeZone: string, at: Date): number {
  try {
    let f = offsetFormatters.get(timeZone)
    if (!f) offsetFormatters.set(timeZone, (f = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })))
    const parts = f.formatToParts(at)
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
    return Math.round((Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute')) - at.getTime()) / 60_000)
  } catch {
    return 0
  }
}

export function localLabel(iso: string, timeZone: string): { day: string; date: string; time: string } {
  try {
    let f = labelFormatters.get(timeZone)
    if (!f) labelFormatters.set(timeZone, (f = new Intl.DateTimeFormat('en-AU', { timeZone, weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })))
    const parts = f.formatToParts(new Date(iso))
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
    return { day: get('weekday'), date: `${get('day')} ${get('month')} ${get('year')}`, time: `${get('hour')}:${get('minute')}` }
  } catch {
    const d = new Date(iso)
    return { day: WEEKDAY_NAMES[weekdayOf(iso)], date: iso.slice(0, 10), time: `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }
  }
}

function event(at: string, reason: string, ctx: TimingContext, kind: StepEvent['kind']): StepEvent {
  const l = localLabel(at, ctx.timeZone)
  const hour = Number(l.time.slice(0, 2))
  const outOfHours = ctx.rhythm.status === 'ok' ? hour < ctx.rhythm.workingHours.start || hour >= ctx.rhythm.workingHours.end : hour < 8 || hour >= 18
  return { kind, at, day: l.day, date: l.date, time: l.time, reason, outOfHours }
}

export function noticeDaysFor(step: Step, notice: NoticeSettings): number {
  const disruption = step.score?.disruption ?? 1
  const base = disruption >= HIGH_DISRUPTION ? notice.high : disruption >= MEDIUM_DISRUPTION ? notice.medium : notice.low
  return step.highCare.userIds.length > 0 ? Math.max(base, CARE_MINIMUM_NOTICE) : base
}

/** The three dates for a step, from its first ring's enforcement date. */
export function eventsFor(step: Step, ctx: TimingContext): StepEvents | null {
  if (step.kind === 'prerequisite' || step.kind === 'verify' || step.kind === 'recurring') return null
  if (step.status === 'done' || step.status === 'skipped') return null
  const enforceDay = step.scheduledDate ?? step.rings[0]?.plannedStart ?? null
  if (!enforceDay) return null
  const high = (step.score?.disruption ?? 1) >= HIGH_DISRUPTION
  const peakHour = ctx.rhythm.status === 'ok' && ctx.rhythm.peak ? (ctx.rhythm.peak.hour + 1) % 24 : DEFAULT_ENFORCE_HOUR
  const enforceAt = atLocalHour(enforceDay, peakHour, ctx.timeZone)
  const enforceReason = step.safeToday
    ? EVENT.reason.enforceSafeToday
    : [high ? EVENT.reason.enforceHighTuesday : null, ctx.rhythm.status === 'ok' && ctx.rhythm.peak ? EVENT.reason.enforcePeak(`${WEEKDAY_NAMES[ctx.rhythm.peak.weekday]} ${hourLabel(ctx.rhythm.peak.hour)}`) : EVENT.reason.enforceDefault].filter(Boolean).join(' ')
  const enforce = event(enforceAt, enforceReason, ctx, 'enforce')
  if (step.safeToday) return { announce: null, remind: null, remindMorning: null, enforce, noticeDays: 0 }

  const noticeDays = noticeDaysFor(step, ctx.notice)
  // Announce on a Tuesday or Wednesday at or before the notice deadline.
  let announceDay = workingDaysBefore(enforceDay, noticeDays, ctx)
  for (let guard = 0; guard < 14; guard++) {
    const d = weekdayOf(announceDay)
    if (d === 1 || d === 2) break
    announceDay = addDays(announceDay, -1)
  }
  const announceReason = [EVENT.reason.announceTueWed, step.highCare.userIds.length > 0 ? EVENT.reason.announceCare : EVENT.reason.announceNotice(noticeDays)].join(' ')
  const announce = event(atLocalHour(announceDay, ANNOUNCE_HOUR, ctx.timeZone), announceReason, ctx, 'announce')
  const remindDay = workingDaysBefore(enforceDay, 1, ctx)
  const remind = event(atLocalHour(remindDay, ANNOUNCE_HOUR, ctx.timeZone), EVENT.reason.remindDayBefore, ctx, 'remind')
  const remindMorning = high ? event(atLocalHour(enforceDay, Math.max(7, peakHour - 2), ctx.timeZone), EVENT.reason.remindMorningOf, ctx, 'remind') : null
  return { announce, remind, remindMorning, enforce, noticeDays }
}
