// Progress on re-scan (roadmap.md §7) and the skip rule (§9 test 8). Pure.
import type { CoverageReport } from '../coverage/types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { findTaggedPolicy } from './generate.ts'
import { absoluteDate } from '../copy/dates.ts'
import type { Step, StepStatus } from './types.ts'

const RANK: Record<StepStatus, number> = {
  blocked: 0,
  ready: 0,
  'in-report-only': 1,
  'ready-to-enforce': 2,
  done: 3,
  skipped: -1,
}

function advance(step: Step, to: StepStatus, note: string | null): void {
  if (step.status === 'skipped') return
  if (RANK[to] <= RANK[step.status]) return
  step.history.push({ at: new Date().toISOString(), from: step.status, to, note })
  step.status = to
}

// Merge persisted status/history/skips into freshly generated steps by id.
export function mergePersisted(
  steps: Step[],
  saved: Record<string, { status: StepStatus; history: Step['history']; skipReason: string | null; owner?: string | null; scheduledDate?: string | null }> | null,
): Step[] {
  if (!saved) return steps
  for (const step of steps) {
    const s = saved[step.id]
    if (!s) continue
    step.history = s.history
    step.skipReason = s.skipReason
    step.owner = s.owner ?? null
    step.scheduledDate = s.scheduledDate ?? null
    if (s.status === 'skipped') step.status = 'skipped'
    // Recurring steps are re-evaluated every scan (a drill can become overdue
    // again); a saved "done" must not pin them.
    else if (step.kind !== 'recurring' && RANK[s.status] > RANK[step.status]) step.status = s.status
  }
  return steps
}

// Match tenant policies by tag, then by the goal's coverage state; move
// statuses forward; reopen drifted done steps as adjust.
export function applyProgress(
  steps: Step[],
  snapshot: TenantSnapshot,
  coverage: CoverageReport,
  planId: string,
): Step[] {
  const statusByGoal = new Map(coverage.results.map((r) => [r.goal.id, r.status]))
  for (const step of steps) {
    if (step.kind !== 'create' && step.kind !== 'adjust') continue
    const goalStatus = statusByGoal.get(step.goalId)

    // Drift (§7): a done step whose goal regressed to partial/absent re-opens
    // as adjust. Unknown (unreadable group) or not-applicable is not drift.
    if (step.status === 'done' && (goalStatus === 'absent' || goalStatus === 'partial' || goalStatus === 'below-baseline')) {
      const since = step.history.at(-1)?.at
      step.history.push({
        at: new Date().toISOString(),
        from: 'done',
        to: 'ready',
        note: `changed since ${since ? absoluteDate(since) : 'the last scan'} — the goal is ${goalStatus === 'absent' ? 'missing' : 'partly in place'} again`,
      })
      step.status = 'ready'
      step.kind = 'adjust'
      continue
    }

    const taggedId = findTaggedPolicy(snapshot, planId, step.id)
    if (taggedId !== null) {
      const policy = (snapshot.config.caPolicies?.rows ?? []).find(
        (p) => (p as { id?: string }).id === taggedId,
      ) as { state?: string } | undefined
      if (policy?.state === 'enabled') {
        advance(step, 'done', 'policy enabled in the tenant')
        continue
      }
      if (policy?.state === 'enabledForReportingButNotEnforced') {
        advance(step, 'in-report-only', 'tagged policy found in report-only')
        // Handle-with-care users gate enforcement: evidence alone is not enough.
        if (step.evidence.reportOnly?.meetsExitCriterion && step.highCare.ready) {
          advance(step, 'ready-to-enforce', 'report-only evidence meets the exit criterion')
        }
        continue
      }
    }
    if (goalStatus === 'enforced') {
      advance(step, 'done', 'coverage shows the goal enforced')
    }
  }
  return steps
}

// Skipping needs a reason — and is never "risk accepted" (§1, §9 test 8).
export function skipStep(step: Step, reason: string): { ok: boolean; error?: string } {
  const r = reason.trim()
  if (r.length === 0) return { ok: false, error: 'a reason is required to skip a step' }
  if (/risk\s*accept/i.test(r)) {
    return { ok: false, error: 'steps are skipped as "not applicable to us", never as accepted risk' }
  }
  step.history.push({ at: new Date().toISOString(), from: step.status, to: 'skipped', note: r })
  step.status = 'skipped'
  step.skipReason = r
  return { ok: true }
}
