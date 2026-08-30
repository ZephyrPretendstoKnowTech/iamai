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
// `weeks` was recomputed with enforcement batching in place (prompt 41 §8). The
// weekly cap counts supervised change windows, not steps, so several policies
// observed in the same window are enforced together and the enforcement tail
// shrinks: the small fixture fell from 7 weeks to 5, and its change days from 7
// to 2.
//
// What remains is not enforcement pace at all. In every fixture the binding
// constraint is the registration campaign plus the ring soak that follows it,
// which is why these numbers track verificationDays rather than the caps.
// Batching cannot shorten a campaign, and the band does not pretend otherwise:
// a plan that runs past its band names the constraint that set it.
export const BANDS: Record<SizeBand, { maxActive: number; weeks: number; verificationDays: number }> = {
  small: { maxActive: 30, weeks: 5, verificationDays: 14 },
  mid: { maxActive: 300, weeks: 8, verificationDays: 28 },
  large: { maxActive: Number.POSITIVE_INFINITY, weeks: 12, verificationDays: 42 },
}
export const OBSERVATION_DAYS = 7
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
