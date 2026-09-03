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

export function evidenceFor(
  goalId: string,
  snapshot: TenantSnapshot,
  matchedPolicyId: string | null,
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
  else if (RISK_HIGH_GOALS.has(goalId)) base.affectedUserIds = riskIds([usage?.riskHigh])
  else if (RISK_MEDIUM_GOALS.has(goalId)) base.affectedUserIds = riskIds([usage?.riskMedium, usage?.riskHigh])

  if (matchedPolicyId !== null) {
    const pr = snapshot.evidencePolicyResults.find((p) => p.policyId === matchedPolicyId)
    if (pr) {
      const failedUsers = [
        ...new Set([...pr.affectedUserIds.reportOnlyFailure, ...pr.affectedUserIds.reportOnlyInterrupted]),
      ]
      if (failedUsers.length > 0) base.affectedUserIds = failedUsers
    }
  }
  return base
}
