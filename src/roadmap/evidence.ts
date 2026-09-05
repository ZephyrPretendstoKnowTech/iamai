// Evidence per goal from Lane B derived tables (roadmap.md §5): who the records
// show using what a block would block, and the people a tagged policy's
// report-only results failed. Whether a report-only policy is ready to enforce
// is tracking.ts's question (the time gate and the evidence gate), not this
// module's. Pure.
import type { TenantSnapshot, UsageSignal } from '../graph/collect/types.ts'
import type { Evidence } from './types.ts'

const RISK_HIGH_GOALS = new Set(['sign-in-risk', 'user-risk'])
const RISK_MEDIUM_GOALS = new Set(['sign-in-risk-medium', 'user-risk-medium'])

/** Risk evidence (prompt 47 item 6): a medium-or-above policy affects the medium and the high sign-ins. */
function riskIds(signals: (UsageSignal | undefined)[]): string[] {
  const present = signals.filter((s): s is UsageSignal => s !== undefined)
  return [...new Set(present.flatMap((s) => s.userIds))]
}

/**
 * `matchedPolicyIds` is every policy this plan tagged for the step, not one of
 * them: a goal the baseline implements with two policies is one step delivering
 * both, and the people Policy A's report-only results failed are not the people
 * the step affects — they are the people A affects. The step's line is the union
 * over its own policies.
 */
export function evidenceFor(
  goalId: string,
  snapshot: TenantSnapshot,
  matchedPolicyIds: readonly string[],
): Evidence {
  const src = snapshot.sources.signInEvidence
  const status = (src?.status ?? 'pending') as Evidence['status']
  const usable = status === 'ok' || status === 'partial'

  const base: Evidence = { status, lines: [], affectedUserIds: [] }
  if (!usable) return base

  const usage = snapshot.evidenceUsage
  if (goalId === 'block-legacy-auth') base.affectedUserIds = usage?.legacyAuth.userIds ?? []
  else if (goalId === 'block-device-code') base.affectedUserIds = usage?.deviceCode.userIds ?? []
  else if (goalId === 'block-auth-transfer') base.affectedUserIds = usage?.authTransfer.userIds ?? []
  // The unsupported-platforms block stops the sign-ins that carried no platform (E9).
  else if (goalId === 'block-unsupported-platforms') base.affectedUserIds = snapshot.scenarioEvidence?.emptyPlatform?.people ?? []
  else if (RISK_HIGH_GOALS.has(goalId)) base.affectedUserIds = riskIds([usage?.riskHigh])
  else if (RISK_MEDIUM_GOALS.has(goalId)) base.affectedUserIds = riskIds([usage?.riskMedium, usage?.riskHigh])

  if (matchedPolicyIds.length > 0) {
    const results = snapshot.evidencePolicyResults.filter((p) => matchedPolicyIds.includes(p.policyId))
    const failedUsers = [
      ...new Set(results.flatMap((pr) => [...pr.affectedUserIds.reportOnlyFailure, ...pr.affectedUserIds.reportOnlyInterrupted])),
    ]
    if (failedUsers.length > 0) base.affectedUserIds = failedUsers
  }
  return base
}
