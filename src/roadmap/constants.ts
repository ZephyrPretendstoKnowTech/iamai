// Named constants for every roadmap threshold (roadmap.md; prompt 07 item 2).
export const READINESS_THRESHOLD_MFA_PERCENT = 90
export const READINESS_THRESHOLD_ADMINS_PERCENT = 100
export const READINESS_THRESHOLD_DEVICES_PERCENT = 80

export const EXIT_MIN_DAYS_OBSERVED = 7
export const EXIT_MIN_SIGNINS_ABSOLUTE = 500
export const EXIT_SIGNINS_PER_ACTIVE_USER = 1
export const EXIT_MAX_FAILURES = 0

export const BREAK_GLASS_DRILL_DAYS = 90

// Pace follows tenant size (ux-review-03 §A3, prompt 18): the band sets the
// expected length, the registration-and-verification window, and the wave
// spacing that makes the total land on the band. Observation is always 7
// days. The band is auto-detected from active users and overridable.
export type SizeBand = 'small' | 'mid' | 'large'
//
// `weeks` is a typical length, not a promise, and for the small band it is the
// middle of a range rather than a number (prompt 42).
//
// Three things move it, and which one binds depends on the tenant:
//
//   Readiness. If people still need to register a method, the campaign sets the
//   length and nothing else can shorten it. That is verificationDays below:
//   2 weeks small, 4 mid, 6 large. A tenant whose people are already registered
//   skips it entirely, and its plan is much shorter than the band suggests.
//
//   Pace. ENFORCEMENT_CAP change windows a week, adjustable in Plan settings.
//   On the small fixture this is the binding constraint until it reaches 4:
//   13 weeks at 1 a week, 7 at 2, 6 at 3, 5 at 4 and above.
//
//   The dependency graph. Two policies that prompt the same people cannot
//   overlap, so a tenant with many overlapping populations runs longer whatever
//   the pace. This is what sets the mid fixture.
//
// So the small band is roughly 3 to 7 weeks, and the number below is the
// typical case. The plan does not rely on the band to explain itself: it names
// the constraint that set its own length, in the sentence it already writes.
export const BANDS: Record<SizeBand, { maxActive: number; weeks: number; verificationDays: number }> = {
  small: { maxActive: 30, weeks: 6, verificationDays: 14 },
  mid: { maxActive: 300, weeks: 9, verificationDays: 28 },
  large: { maxActive: Number.POSITIVE_INFINITY, weeks: 11, verificationDays: 42 },
}
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
 */
export const OBSERVATION_DAYS = 7

/** Where evidence already shows zero affected users, there is less to watch for. */
export const OBSERVATION_DAYS_ZERO = 3
/** An enforcement wave never runs shorter than this, whatever the band. */
export const MIN_WAVE_DAYS = 2

export function bandForActiveUsers(active: number): SizeBand {
  if (active <= BANDS.small.maxActive) return 'small'
  if (active <= BANDS.mid.maxActive) return 'mid'
  return 'large'
}

export const SEVERITY_BLOCK = 3
export const SEVERITY_STRENGTH_OR_DEVICE = 2
export const SEVERITY_DEFAULT = 1
