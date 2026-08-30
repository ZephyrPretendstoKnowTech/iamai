// Three scores per goal, one priority (ux-review-03 §A7). Pure.
//
//   value       1–5 from the catalogue, raised by one when the tenant shows
//               exposure (legacy auth in use, risky sign-ins seen …).
//   effort      base effort + prerequisites + new objects + a readiness gap,
//               capped at 5.
//   disruption  affected active users × control severity, reduced by
//               readiness and clean evidence, scaled by tenant size band.
//   priority    value × (6 − disruption); ties broken by lower effort.
import type { Domain, Goal, GoalStatus } from '../coverage/types.ts'

export type GoalScore = {
  domain: Domain
  value: number
  effort: number
  disruption: number
  priority: number
}

export type ScoreInput = {
  goal: Goal
  status: GoalStatus
  /** Active users the goal's population contains. */
  affectedActive: number
  /** Active users in the tenant. */
  tenantActive: number
  /** Readiness percent for the population (null when not measured). */
  readinessPercent: number | null
  /** True when clean report-only or usage evidence shows nobody is interrupted. */
  evidenceClean: boolean
  /** Phase-0 objects or steps this goal waits on. */
  prerequisites: number
  /** Groups or locations the step itself creates. */
  newObjects: number
  /** The tenant shows the exposure the goal closes (legacy auth seen, …). */
  exposure: boolean
}

export type SizeBand = 'small' | 'mid' | 'large'

/** A3 bands by active users. */
export function sizeBand(activeUsers: number): SizeBand {
  if (activeUsers <= 30) return 'small'
  if (activeUsers <= 300) return 'mid'
  return 'large'
}

const BAND_FACTOR: Record<SizeBand, number> = { small: 0.7, mid: 0.85, large: 1 }

/** How hard the control lands on someone it applies to, 1–3. */
export function controlSeverity(goal: Goal): number {
  const impl = goal.implementations[0]
  const grant = impl?.floor.grant
  if (grant === 'block' || grant === 'phishingResistant' || grant === 'compliantDevice' || grant === 'passwordChange') return 3
  if (grant === 'mfa' || grant === 'passwordless' || grant === 'approvedApplication' || grant === 'compliantApplication') return 2
  return 1 // session floors
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

export function scoreGoal(i: ScoreInput): GoalScore {
  const domain = i.goal.domain ?? 'Identity'
  const value = clamp((i.goal.securityValue ?? 3) + (i.exposure ? 1 : 0), 1, 5)

  const readinessGap = i.readinessPercent !== null && i.readinessPercent < 80 ? 1 : 0
  const effort = i.status === 'enforced' ? 1 : clamp((i.goal.baseEffort ?? 2) + (i.prerequisites > 0 ? 1 : 0) + (i.newObjects > 0 ? 1 : 0) + readinessGap, 1, 5)

  let disruption = 1
  if (i.status !== 'enforced' && i.tenantActive > 0 && i.affectedActive > 0) {
    const share = clamp(i.affectedActive / i.tenantActive, 0, 1)
    const severity = controlSeverity(i.goal) / 3
    const readinessRelief = i.readinessPercent === null ? 1 : 1 - (i.readinessPercent / 100) * 0.6
    const evidenceRelief = i.evidenceClean ? 0.4 : 1
    const raw = share * severity * readinessRelief * evidenceRelief * BAND_FACTOR[sizeBand(i.tenantActive)]
    disruption = clamp(Math.round(1 + raw * 4), 1, 5)
  }

  const priority = value * (6 - disruption)
  return { domain, value, effort, disruption, priority }
}

/** Sort keys for the Findings and Roadmap controls. */
export type ScoreSort = 'priority' | 'value' | 'effort' | 'disruption'

export function compareScores(a: GoalScore | null, b: GoalScore | null, by: ScoreSort): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  if (by === 'priority') return b.priority - a.priority || a.effort - b.effort
  if (by === 'value') return b.value - a.value || b.priority - a.priority
  if (by === 'effort') return a.effort - b.effort || b.priority - a.priority
  return a.disruption - b.disruption || b.priority - a.priority
}

export const DOMAINS: Domain[] = ['Identity', 'Admins', 'Devices', 'Sessions', 'Guests', 'Locations', 'Risk']
