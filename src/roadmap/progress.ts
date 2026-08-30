// Progress on re-scan (roadmap.md §7) and the skip rule (§9 test 8). Pure.
import type { CoverageReport } from '../coverage/types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { trackExecution } from './tracking.ts'
import { isEmergencyAccess } from './blockerSteps.ts'
import { SKIP } from '../copy/skip.ts'
import type { Step, StepStatus } from './types.ts'

const RANK: Record<StepStatus, number> = {
  blocked: 0,
  ready: 0,
  'in-report-only': 1,
  'ready-to-enforce': 2,
  done: 3,
  skipped: -1,
}

// Merge persisted status/history/skips into freshly generated steps by id.
export type SavedStep = {
  status: StepStatus
  history: Step['history']
  skipReason: string | null
  owner?: string | null
  scheduledDate?: string | null
  /** Evidence and actual ring dates survive a re-plan (roadmap-v2.md §5). */
  tracking?: Step['tracking']
  ringActuals?: { actualStart: string | null; actualEnd: string | null }[]
  currentRing?: number
}

export function savedStepOf(step: Step): SavedStep {
  return {
    status: step.status,
    history: step.history,
    skipReason: step.skipReason,
    owner: step.owner,
    scheduledDate: step.scheduledDate,
    tracking: step.tracking,
    ringActuals: step.rings.map((r) => ({ actualStart: r.actualStart, actualEnd: r.actualEnd })),
    currentRing: step.currentRing,
  }
}

export function mergePersisted(steps: Step[], saved: Record<string, SavedStep> | null): Step[] {
  if (!saved) return steps
  for (const step of steps) {
    const s = saved[step.id]
    if (!s) continue
    step.history = s.history
    step.skipReason = s.skipReason
    step.owner = s.owner ?? null
    step.scheduledDate = s.scheduledDate ?? null
    step.tracking = s.tracking ?? null
    if (s.ringActuals) for (const [i, r] of step.rings.entries()) if (s.ringActuals[i]) Object.assign(r, s.ringActuals[i])
    if (typeof s.currentRing === 'number') step.currentRing = Math.min(s.currentRing, Math.max(0, step.rings.length - 1))
    if (s.status === 'skipped') step.status = 'skipped'
    // Recurring steps are re-evaluated every scan (a drill can become overdue
    // again); a saved "done" must not pin them.
    else if (step.kind !== 'recurring' && RANK[s.status] > RANK[step.status]) step.status = s.status
  }
  return steps
}

// Detection on every scan (roadmap-v2.md §5) lives in tracking.ts; this
// keeps the entry point the page and the tests call.
export function applyProgress(steps: Step[], snapshot: TenantSnapshot, coverage: CoverageReport, planId: string, now?: string, planCreatedAt: string | null = null): Step[] {
  return trackExecution(steps, snapshot, coverage, planId, now, planCreatedAt)
}

// Skipping needs a reason — and is never "risk accepted" (§1, §9 test 8).
//
// The plan is advice, not a contract, so almost anything can be skipped. The
// exception is emergency access, and it is an exception because skipped is
// treated as SATISFIED in three places: safeTodayFor, isWork, and mergePersisted.
// Skipping the break-glass blocker would therefore flip every held deny-capable
// step to "safe today" and drop the scheduling edges that keep the exclusion
// group ahead of the policies referencing it. That is not an untidy plan, it is
// a tenant nobody can get back into (prompt 44 item 6).
export function skipStep(step: Step, reason: string): { ok: boolean; error?: string } {
  if (isEmergencyAccess(step)) return { ok: false, error: SKIP.cannotSkip }
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

/**
 * Put a skipped step back (item 8).
 *
 * The status is cleared rather than restored from history: what the step should
 * be now is a question for the generator, which recomputes it from the evidence
 * on the next pass. Restoring the status it held before the skip would reinstate
 * a judgement made against a tenant that has since moved.
 */
export function unskipStep(step: Step): { ok: boolean; error?: string } {
  if (step.status !== 'skipped') return { ok: false, error: 'that step is not skipped' }
  step.history.push({ at: new Date().toISOString(), from: 'skipped', to: 'blocked', note: SKIP.unskip })
  step.status = 'blocked'
  step.skipReason = null
  return { ok: true }
}
