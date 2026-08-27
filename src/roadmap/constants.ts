// Named constants for every roadmap threshold (roadmap.md; prompt 07 item 2).
export const READINESS_THRESHOLD_MFA_PERCENT = 90
export const READINESS_THRESHOLD_ADMINS_PERCENT = 100
export const READINESS_THRESHOLD_DEVICES_PERCENT = 80

export const EXIT_MIN_DAYS_OBSERVED = 7
export const EXIT_MIN_SIGNINS_ABSOLUTE = 500
export const EXIT_SIGNINS_PER_ACTIVE_USER = 1
export const EXIT_MAX_FAILURES = 0

export const BREAK_GLASS_DRILL_DAYS = 90

// Pacing presets (prompt 12 §A): one shared observation window, then
// enforcement waves in phase order. Standard is the default.
export type Pace = 'fast' | 'standard' | 'cautious'
export const PACES: Record<Pace, { observationDays: number; waveGapDays: number; verificationDays: number; targetWeeks: [number, number] }> = {
  fast: { observationDays: 5, waveGapDays: 2, verificationDays: 5, targetWeeks: [2, 2] },
  standard: { observationDays: 7, waveGapDays: 3.5, verificationDays: 10, targetWeeks: [3, 4] },
  cautious: { observationDays: 14, waveGapDays: 7, verificationDays: 14, targetWeeks: [6, 8] },
}
export const OBSERVATION_DAYS = PACES.standard.observationDays
export const DEFAULT_PACE: Pace = 'standard'

export const SEVERITY_BLOCK = 3
export const SEVERITY_STRENGTH_OR_DEVICE = 2
export const SEVERITY_DEFAULT = 1
