// Named constants for every roadmap threshold (roadmap.md; prompt 07 item 2).
export const READINESS_THRESHOLD_MFA_PERCENT = 90
export const READINESS_THRESHOLD_ADMINS_PERCENT = 100
export const READINESS_THRESHOLD_DEVICES_PERCENT = 80

export const BREAK_GLASS_DRILL_DAYS = 90

// The plan's length follows the number of active people (target-state §9).
// The band sets the expected length in weeks, the weekly cap on supervised
// change windows (schedule.ts ENFORCEMENT_CAP) and the ring shape (rings.ts
// RING_BANDS). None of it is a promise: the plan names the one constraint
// that set its own length, in the sentence it already writes. Expected
// outcomes, reported never targeted: up to 30 active people about 3 to 4
// weeks; 31 to 300 about 6 to 8; above 300 about 10 to 12.
export type SizeBand = 'small' | 'mid' | 'large'
export const BANDS: Record<SizeBand, { maxActive: number; weeks: number }> = {
  small: { maxActive: 50, weeks: 4 },
  mid: { maxActive: 300, weeks: 8 },
  large: { maxActive: Number.POSITIVE_INFINITY, weeks: 12 },
}

/**
 * The registration window (target-state §9): the active people who still have
 * no proven method, at this many a working day. It runs alongside the first
 * report-only soak, never before it.
 */
export const REGISTRATION_PER_WORKING_DAY = 5
/** Never longer than this, in working days: past four weeks the answer is a Temporary Access Pass, not more waiting. */
export const REGISTRATION_MAX_WORKING_DAYS = 20

/**
 * How long a policy sits in report-only before anyone can call it safe
 * (observation-and-readiness.md §1, prompt 42 §1).
 *
 * Two lengths, and no more. The audience is a person with weak sign-in
 * requirements today and limited attention: a long window does not make them
 * safer, it makes them stop. A policy in report-only harms nobody, so the cost
 * of a shorter window is a smaller evidence base, not exposure. The cost of a
 * three-week window is abandonment.
 *
 * What a short window cannot see is stated as a named unknown the user can
 * close in one click, rather than waited out. See UNKNOWNS in copy/timing.ts.
 *
 * The same window is the time gate on a policy already in report-only
 * (tracking.ts): ready on the day it has been in report-only this long, or
 * sooner when the records since that day show zero failures and every active
 * person in scope seen.
 */
export const OBSERVATION_DAYS = 7

/** Where evidence already shows zero affected users, there is less to watch for. */
export const OBSERVATION_DAYS_ZERO = 3

export function bandForActiveUsers(active: number): SizeBand {
  if (active <= BANDS.small.maxActive) return 'small'
  if (active <= BANDS.mid.maxActive) return 'mid'
  return 'large'
}

export const SEVERITY_BLOCK = 3
export const SEVERITY_STRENGTH_OR_DEVICE = 2
export const SEVERITY_DEFAULT = 1

/** Below this many people, an announcement names them rather than counting them. */
export const NAMED_BELOW = 10
