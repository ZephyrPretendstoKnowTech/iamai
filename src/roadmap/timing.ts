// The three dates on every step (scheduling-and-onboarding.md §2.2, §2.3):
// announce, remind, enforce, each with a local day, date and time and a
// one-line reason. Suggestions from the rules table; the tenant's rhythm
// overrides the peak-hour and weekend assumptions. Pure.
import { EVENT } from '../copy/timing.ts'
import type { TenantRhythm } from './rhythm.ts'
import { WEEKDAY_NAMES, hourLabel } from './rhythm.ts'
import { unavailableReason } from './operations.ts'
import { effectsOf } from './strand.ts'
import type { Step, StepEvent, StepEvents } from './types.ts'

/**
 * Notice, in working days, by disruption (target-state §9). Constants, not
 * settings: when the records show no affected active person the notice is one
 * working day, as a courtesy; otherwise 2 / 5 / 10 by disruption.
 */
export const NOTICE_WORKING_DAYS = { none: 1, low: 2, medium: 5, high: 10 } as const
const ANNOUNCE_HOUR = 9.5
const DEFAULT_ENFORCE_HOUR = 10
/** No change lands before this hour, whatever the tenant's rhythm says. */
const ENFORCE_EARLIEST = 9

export type TimingContext = {
  rhythm: TenantRhythm
  timeZone: string
}

/** Monday-first weekday of an ISO date (0 = Monday). */
export function weekdayOf(iso: string): number {
  return (new Date(iso).getUTCDay() + 6) % 7
}

/** A working day: Monday to Friday. The tenant's rhythm can add weekend days. */
export function isWorkingDay(iso: string, ctx: Pick<TimingContext, 'rhythm'>): boolean {
  const d = weekdayOf(iso)
  const weekend = d >= 5 && !ctx.rhythm.workingDays.includes(d)
  return !weekend
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

/** Step forward N working days from a date. */
export function addWorkingDays(iso: string, n: number, ctx: Pick<TimingContext, 'rhythm'> = WEEKDAYS): string {
  let cursor = iso
  let left = n
  let guard = 0
  while (left > 0 && guard < 400) {
    cursor = addDays(cursor, 1)
    if (isWorkingDay(cursor, ctx)) left -= 1
    guard += 1
  }
  return cursor
}

/** Step back N working days from a date. */
export function workingDaysBefore(iso: string, n: number, ctx: Pick<TimingContext, 'rhythm'>): string {
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

const WEEKDAYS: Pick<TimingContext, 'rhythm'> = { rhythm: { workingDays: [0, 1, 2, 3, 4] } as TenantRhythm }

/**
 * The enforcement day for a change: Tuesday, Wednesday or Thursday
 * (target-state §9), never a Friday or a weekend. A change freeze, and the
 * last working day before one, are the scheduler's to avoid: it knows the
 * freeze. Weekend-active tenants still enforce midweek: the rule is about
 * support cover, not about who is signed in.
 */
export function toEnforcementDay(iso: string): string {
  const d = weekdayOf(iso)
  if (d >= 1 && d <= 3) return iso
  return addDays(iso, (1 - d + 7) % 7)
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

/** The hour of the day an instant falls in, in the display zone. */
export function localHour(iso: string, timeZone: string): number {
  const at = new Date(iso)
  return new Date(at.getTime() + offsetMinutes(timeZone, at) * 60_000).getUTCHours()
}

function event(at: string, reason: string, ctx: TimingContext, kind: StepEvent['kind']): StepEvent {
  const hour = localHour(at, ctx.timeZone)
  const outOfHours = ctx.rhythm.status === 'ok' ? hour < ctx.rhythm.workingHours.start || hour >= ctx.rhythm.workingHours.end : hour < 8 || hour >= 18
  return { kind, at, reason, outOfHours }
}

/**
 * An hour inside the enforcement window, varied per step but stable for it.
 *
 * Kept inside the working day: the spread is over the hours a change may
 * legitimately land in, not over the clock. A change at 03:00 is not variety.
 */
function spreadHour(base: number, stepId: string, ctx: TimingContext): number {
  const hours = ctx.rhythm.status === 'ok' ? ctx.rhythm.workingHours : { start: 9, end: 17 }
  const first = Math.max(hours.start, ENFORCE_EARLIEST)
  // Leave the last hour clear: nobody wants a change landing as they leave.
  const last = Math.max(first, hours.end - 2)
  if (last <= first) return first
  let h = 0
  for (let i = 0; i < stepId.length; i++) h = (h * 31 + stepId.charCodeAt(i)) >>> 0
  const span = last - first + 1
  // Anchored on the base hour when it is inside the window, so the tenant's own
  // rhythm still leads and the spread moves around it.
  const anchor = base >= first && base <= last ? base : first
  return first + ((anchor - first + (h % span)) % span)
}

/**
 * The records show no affected active person: sign-in evidence was read, and
 * nobody in it meets this change. The same bar as the scheduler's zero batch
 * class, never merely absent evidence.
 */
export function nobodyAffected(step: Step): boolean {
  // A step with no policy of its own — a policy already in place, the enforce
  // step — is read by its goal's family, as it always was.
  const effects = effectsOf(step)
  if (effects === null) {
    const family = step.readiness.family
    const affected = family === 'block' || family === 'location' || family === 'risk' ? step.evidence.affectedUserIds.length : step.population.active
    return step.evidence.status === 'ok' && affected === 0
  }
  // Work the plan cannot write proves nothing at all — least of all a zero — and
  // it is not read by the people the step happens to list.
  if (effects.length === 0) return false
  // Zero is proved, never assumed: a policy IAMAI cannot read in full might
  // touch anyone (roadmap/operations.ts PolicyEffect.unknown).
  if (effects.some((e) => e.unknown.length > 0)) return false
  for (const effect of effects) {
    // A policy that stops a protocol or applies only above a risk level touches
    // whoever was seen doing it — and only where the records could be read. So
    // does one that names places and asks for nothing: it stops people, rather
    // than prompting them.
    if (effect.blocks || effect.usesRisk || (effect.usesLocations && !effect.asksForMethod && !effect.requiresDevice)) {
      if (step.evidence.status !== 'ok') return false
      if (step.evidence.affectedUserIds.length > 0) return false
      continue
    }
    // Anything else asks people for something, so it touches everyone it
    // applies to.
    if (step.population.active > 0) return false
  }
  return true
}

export function noticeDaysFor(step: Step): number {
  if (nobodyAffected(step)) return NOTICE_WORKING_DAYS.none
  return NOTICE_WORKING_DAYS.medium
}

/** The three dates for a step, from its first ring's enforcement date. */
export function eventsFor(step: Step, ctx: TimingContext, placedStart: string | null = null): StepEvents | null {
  if (step.kind === 'prerequisite' || step.kind === 'verify' || step.kind === 'check') return null
  if (step.status === 'done' || step.status === 'skipped') return null
  // Nothing to roll out while there is nothing to run: a policy the plan cannot
  // write has no enforcement date and no announcement (roadmap/operations.ts).
  if (unavailableReason(step) !== null) return null
  // Nothing to roll out while there is nothing to run: a policy step whose
  // operation the plan cannot write yet — an object it names is missing, a pair
  // it cannot match, a baseline that contradicts itself — has no enforcement
  // date and no announcement (roadmap/operations.ts implementationOffered).
  if ((step.kind === 'create' || step.kind === 'adjust') && unavailableReason(step) !== null) return null
  const enforceDay = step.rings[0]?.plannedStart ?? placedStart ?? null
  if (!enforceDay) return null
  // The slot varies within the hours the change may land in (prompt 42 §12).
  // Every enforcement in every week was Tuesday or Wednesday at 12:00 for
  // eleven weeks (review-09 finding 10): one hour after the peak, and the peak
  // does not move. A fixed hour means every change lands while the same people
  // are doing the same thing, so one bad slot is repeated for the life of the
  // plan; spreading them means a problem in one window does not recur in all of
  // them. The offset is derived from the step id, so it is stable across scans
  // rather than random: the same step keeps its time.
  const baseHour = ctx.rhythm.status === 'ok' && ctx.rhythm.peak ? (ctx.rhythm.peak.hour + 1) % 24 : DEFAULT_ENFORCE_HOUR
  const peakHour = spreadHour(baseHour, step.id, ctx)
  const enforceAt = atLocalHour(enforceDay, peakHour, ctx.timeZone)
  const enforceReason = ctx.rhythm.status === 'ok' && ctx.rhythm.peak ? EVENT.reason.enforcePeak(`${WEEKDAY_NAMES[ctx.rhythm.peak.weekday]} ${hourLabel(ctx.rhythm.peak.hour)}`) : EVENT.reason.enforceDefault
  const enforce = event(enforceAt, enforceReason, ctx, 'enforce')

  // Notice is a constant of the change, never a setting (target-state §9): one
  // working day as a courtesy when the records show nobody affected; otherwise
  // five working days. Announce at
  // 09:30 on a Monday to Thursday the tenant works: a Friday note is read on
  // Monday, and 09:30 is early enough to be read and acted on the same day.
  const courtesy = nobodyAffected(step)
  const noticeDays = noticeDaysFor(step)
  const usable = ctx.rhythm.status === 'ok' && ctx.rhythm.workingDays.length > 0
  const worksOn = (d: number): boolean => !usable || ctx.rhythm.workingDays.includes(d)
  const announceHour = ANNOUNCE_HOUR
  let announceDay = workingDaysBefore(enforceDay, noticeDays, ctx)
  for (let guard = 0; guard < 14; guard++) {
    const d = weekdayOf(announceDay)
    if (d <= 3 && worksOn(d)) break
    announceDay = addDays(announceDay, -1)
  }
  const announceTime = '09:30'
  const chosenDay = WEEKDAY_NAMES[weekdayOf(announceDay)]
  const announceReason = [
    usable ? EVENT.reason.announceOn(chosenDay, announceTime) : `${EVENT.reason.announceDefaultDay(chosenDay, announceTime)} ${EVENT.reason.announceNoRhythm}`,
    courtesy ? EVENT.reason.announceCourtesy : EVENT.reason.announceNotice(noticeDays),
  ].join(' ')
  const announce = event(atLocalHour(announceDay, announceHour, ctx.timeZone), announceReason, ctx, 'announce')
  // The reminder is the working day before. With one working day of notice
  // that is the announcement itself, so there is no second message.
  const remindDay = workingDaysBefore(enforceDay, 1, ctx)
  const remind = remindDay.slice(0, 10) === announceDay.slice(0, 10) ? null : event(atLocalHour(remindDay, announceHour, ctx.timeZone), EVENT.reason.remindDayBefore, ctx, 'remind')
  const remindMorning = null
  return { announce, remind, remindMorning, enforce, noticeDays }
}
