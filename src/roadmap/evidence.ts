// Evidence per goal from Lane B derived tables (roadmap.md §5). Pure.
import {
  EXIT_MAX_FAILURES,
  EXIT_MIN_DAYS_OBSERVED,
  EXIT_MIN_SIGNINS_ABSOLUTE,
  EXIT_SIGNINS_PER_ACTIVE_USER,
} from './constants.ts'
import type { TenantSnapshot, UsageSignal } from '../graph/collect/types.ts'
import type { Evidence } from './types.ts'

function usageLines(label: string, sig: UsageSignal | undefined): { lines: string[]; ids: string[] } {
  if (!sig || sig.count === 0) {
    return { lines: [`no ${label} observed in the window — expect zero impact`], ids: [] }
  }
  const detail = Object.entries(sig.byDetail)
    .map(([k, n]) => `${k}: ${n}`)
    .join(', ')
  return {
    lines: [`${sig.userIds.length} user(s) seen using ${label} (${sig.count} sign-ins; ${detail}) — this is the blast radius`],
    ids: sig.userIds,
  }
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

  if (!usable) {
    base.lines.push('sign-in evidence is not usable for this scan — falling back to readiness alone; nothing is hidden')
    return base
  }

  const usage = snapshot.evidenceUsage
  if (goalId === 'block-legacy-auth') {
    const u = usageLines('legacy authentication', usage?.legacyAuth)
    base.lines.push(...u.lines)
    base.affectedUserIds = u.ids
  } else if (goalId === 'block-device-code') {
    const u = usageLines('the device-code flow', usage?.deviceCode)
    base.lines.push(...u.lines)
    base.affectedUserIds = u.ids
  } else if (goalId === 'block-auth-transfer') {
    const u = usageLines('authentication transfer', usage?.authTransfer)
    base.lines.push(...u.lines)
    base.affectedUserIds = u.ids
  }

  if (matchedPolicyId !== null) {
    const pr = snapshot.evidencePolicyResults.find((p) => p.policyId === matchedPolicyId)
    const covered = src?.coveredWindow
    const daysObserved = covered
      ? Math.floor((Date.parse(covered.to) - Date.parse(covered.from)) / 86_400_000)
      : 0
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
      base.lines.push(
        `report-only results: ${signIns} sign-in(s) over ${daysObserved} day(s), ${failures} failure(s)/interruption(s)`,
      )
      const failedUsers = [
        ...new Set([...pr.affectedUserIds.reportOnlyFailure, ...pr.affectedUserIds.reportOnlyInterrupted]),
      ]
      if (failedUsers.length > 0) base.affectedUserIds = failedUsers
    } else {
      base.lines.push('the created policy has not appeared in sign-in results yet')
    }
  }

  if (base.lines.length === 0) base.lines.push('no goal-specific evidence for this step; see readiness')
  return base
}
