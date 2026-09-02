// Evidence per goal from Lane B derived tables (roadmap.md §5): who the records
// show using what a block would block, and a tagged policy's report-only
// results. Pure.
import {
  EXIT_MAX_FAILURES,
  EXIT_MIN_DAYS_OBSERVED,
  EXIT_MIN_SIGNINS_ABSOLUTE,
  EXIT_SIGNINS_PER_ACTIVE_USER,
} from './constants.ts'
import type { TenantSnapshot, UsageSignal } from '../graph/collect/types.ts'
import type { Evidence } from './types.ts'

const RISK_HIGH_GOALS = new Set(['sign-in-risk', 'user-risk'])
const RISK_MEDIUM_GOALS = new Set(['sign-in-risk-medium', 'user-risk-medium'])

/** Risk evidence (prompt 47 item 6): a medium-or-above policy affects the medium and the high sign-ins. */
function riskIds(signals: (UsageSignal | undefined)[]): string[] {
  const present = signals.filter((s): s is UsageSignal => s !== undefined)
  return [...new Set(present.flatMap((s) => s.userIds))]
}

// Exit criterion for ready-to-enforce (roadmap.md §5) — thresholds are the
// named constants above.
export function meetsExitCriterion(daysObserved: number, signIns: number, failures: number, activeUsers: number): boolean {
  return (
    daysObserved >= EXIT_MIN_DAYS_OBSERVED &&
    (signIns >= activeUsers * EXIT_SIGNINS_PER_ACTIVE_USER || signIns >= EXIT_MIN_SIGNINS_ABSOLUTE) &&
    failures <= EXIT_MAX_FAILURES
  )
}

export function evidenceFor(
  goalId: string,
  snapshot: TenantSnapshot,
  activeUsers: number,
  matchedPolicyId: string | null,
): Evidence {
  const src = snapshot.sources.signInEvidence
  const status = (src?.status ?? 'pending') as Evidence['status']
  const usable = status === 'ok' || status === 'partial'

  const base: Evidence = { status, lines: [], affectedUserIds: [], reportOnly: null }
  if (!usable) return base

  const usage = snapshot.evidenceUsage
  if (goalId === 'block-legacy-auth') base.affectedUserIds = usage?.legacyAuth.userIds ?? []
  else if (goalId === 'block-device-code') base.affectedUserIds = usage?.deviceCode.userIds ?? []
  else if (goalId === 'block-auth-transfer') base.affectedUserIds = usage?.authTransfer.userIds ?? []
  else if (RISK_HIGH_GOALS.has(goalId)) base.affectedUserIds = riskIds([usage?.riskHigh])
  else if (RISK_MEDIUM_GOALS.has(goalId)) base.affectedUserIds = riskIds([usage?.riskMedium, usage?.riskHigh])

  if (matchedPolicyId !== null) {
    const pr = snapshot.evidencePolicyResults.find((p) => p.policyId === matchedPolicyId)
    const covered = src?.coveredWindow
    // Days observed = days since the tagged policy was created, capped by the
    // collected window — never the whole window for a policy created yesterday.
    const raw = (snapshot.config.caPolicies?.rows ?? []).find((p) => (p as { id?: string }).id === matchedPolicyId) as
      | { createdDateTime?: string }
      | undefined
    const windowDays = covered ? Math.floor((Date.parse(covered.to) - Date.parse(covered.from)) / 86_400_000) : 0
    const sinceCreated =
      covered && typeof raw?.createdDateTime === 'string'
        ? Math.max(0, Math.floor((Date.parse(covered.to) - Date.parse(raw.createdDateTime)) / 86_400_000))
        : windowDays
    const daysObserved = Math.min(windowDays, sinceCreated)
    if (pr) {
      const failures = pr.counts.reportOnlyFailure + pr.counts.reportOnlyInterrupted
      const signIns =
        pr.counts.reportOnlyFailure +
        pr.counts.reportOnlyInterrupted +
        pr.counts.reportOnlySuccess +
        pr.counts.enforcedFailure +
        pr.counts.enforcedSuccess
      base.reportOnly = {
        daysObserved,
        signIns,
        failures,
        meetsExitCriterion: meetsExitCriterion(daysObserved, signIns, failures, activeUsers),
      }
      const failedUsers = [
        ...new Set([...pr.affectedUserIds.reportOnlyFailure, ...pr.affectedUserIds.reportOnlyInterrupted]),
      ]
      if (failedUsers.length > 0) base.affectedUserIds = failedUsers
    }
  }
  return base
}
