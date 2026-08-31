// The upper-bound guard: when a plan runs past the length this product is for,
// say what would bring it inside — naming the steps, not the category.
//
// "Defer some session controls" is not advice. "Deferring Browser sessions
// never persist for anyone and Unmanaged devices cannot download brings it to
// 11 weeks" is, because the reader can act on it without first working out
// which steps were meant.
//
// Pure: it re-runs the scheduler on copies. That is expensive, so it runs only
// when the plan is actually over.
import { buildSchedule } from './schedule.ts'
import type { ScheduleOptions } from './schedule.ts'
import type { SizeBand } from './constants.ts'
import type { Step } from './types.ts'

/** The length this product is built for. Past it, the plan explains itself. */
export const LONG_PLAN_WEEKS = 12

export type Remedy = { kind: 'defer'; stepIds: string[]; weeks: number } | { kind: 'readiness'; people: number; weeks: number }

export type Overrun = { weeks: number; over: boolean; remedies: Remedy[] }

const clone = (steps: Step[]): Step[] => steps.map((s) => ({ ...s, rings: s.rings.map((r) => ({ ...r })) }))

function weeksWith(steps: Step[], day0: string, active: number, band: SizeBand | null, options: ScheduleOptions): number {
  return buildSchedule(clone(steps), day0, active, band, options).weeks
}

/**
 * Two levers, in the order a person would want them: do less, or get people
 * registered. Each is reported only when it actually helps, and with the
 * length it actually produces. Pace is not a lever any more: the weekly cap
 * is a constant of the band (target-state §9).
 */
export function overrunFor(
  steps: Step[],
  day0: string,
  active: number,
  band: SizeBand | null,
  options: ScheduleOptions,
  weeks: number,
): Overrun {
  if (weeks <= LONG_PLAN_WEEKS) return { weeks, over: false, remedies: [] }
  const remedies: Remedy[] = []

  // 1. Deferral. The steps at the end of the plan, taken off one at a time
  // until the rest fits, so the list is the shortest that actually works.
  const enforcing = steps
    .filter((s) => s.rings[0] && s.status !== 'done' && s.status !== 'skipped')
    .sort((a, b) => (b.rings.at(-1)?.plannedEnd ?? '').localeCompare(a.rings.at(-1)?.plannedEnd ?? ''))
  const deferred: string[] = []
  for (const s of enforcing.slice(0, 6)) {
    deferred.push(s.id)
    const rest = steps.filter((x) => !deferred.includes(x.id))
    const w = weeksWith(rest, day0, active, band, options)
    if (w <= LONG_PLAN_WEEKS) {
      remedies.push({ kind: 'defer', stepIds: [...deferred], weeks: w })
      break
    }
  }

  // 2. Readiness. What the plan becomes once nobody needs a method set up,
  // which is the campaign's whole reason for existing.
  const verify = steps.find((s) => s.kind === 'verify' && s.status !== 'done')
  if (verify) {
    const done = steps.map((s) => (s.id === verify.id ? { ...s, status: 'done' as const } : s))
    const w = weeksWith(done, day0, active, band, { ...options, registrationDays: 0 })
    if (w < weeks) remedies.push({ kind: 'readiness', people: verify.population.active, weeks: w })
  }

  return { weeks, over: true, remedies }
}
