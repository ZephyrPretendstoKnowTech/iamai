// Per-tenant goal scoring shared by Findings and the Roadmap (§A7). Pure.
import type { Goal, GoalResult } from '../coverage/types.ts'
import { resolvePopulation } from '../coverage/population.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { scoreGoal } from '../scoring/priority.ts'
import type { GoalScore } from '../scoring/priority.ts'
import { goalFamily, readinessFor } from './readiness.ts'

export type ScoreExtras = {
  prerequisites?: number
  newObjects?: number
  evidenceClean?: boolean
  affectedByBlock?: number | null
}

/** The exposure a goal closes, as the tenant shows it today. */
export function exposureFor(goalId: string, snapshot: TenantSnapshot): boolean {
  const usage = snapshot.evidenceUsage
  if (goalId === 'block-legacy-auth') return (usage?.legacyAuth.userIds.length ?? 0) > 0
  if (goalId === 'block-device-code') return (usage?.deviceCode.userIds.length ?? 0) > 0
  if (goalId === 'block-auth-transfer') return (usage?.authTransfer.userIds.length ?? 0) > 0
  if (goalId === 'admins-phishing-resistant' || goalId === 'admin-session' || goalId === 'admin-portals-protected') {
    return Object.keys(snapshot.roles.active).length > 2
  }
  if (goalId === 'guests-mfa') return snapshot.users.some((u) => u.userType === 'guest')
  return false
}

export function scoreResult(result: GoalResult, snapshot: TenantSnapshot, viability: MfaViability[], extras: ScoreExtras = {}): GoalScore | null {
  const goal: Goal = result.goal
  if (goal.securityValue === undefined && goal.domain === undefined) return null
  if (result.status === 'not-applicable' || result.status === 'licence-limited') return null
  const impl = goal.implementations[0]
  const popIds = impl && impl.expectedWho.kind !== 'workload' ? [...resolvePopulation(impl.expectedWho, snapshot).ids] : []
  const pop = new Set(popIds)
  const activeIn = viability.filter((v) => pop.has(v.userId) && v.activity === 'active').length
  const tenantActive = viability.filter((v) => v.activity === 'active').length
  const readiness = readinessFor(goal.id, popIds, viability, snapshot)
  const family = goalFamily(goal.id)
  // A block affects only the users seen using the thing, when measured.
  const affectedActive = family === 'block' && extras.affectedByBlock !== undefined && extras.affectedByBlock !== null ? extras.affectedByBlock : activeIn
  return scoreGoal({
    goal,
    status: result.status,
    affectedActive,
    tenantActive,
    readinessPercent: readiness.percent,
    evidenceClean: extras.evidenceClean ?? false,
    prerequisites: extras.prerequisites ?? 0,
    newObjects: extras.newObjects ?? 0,
    exposure: exposureFor(goal.id, snapshot),
  })
}
