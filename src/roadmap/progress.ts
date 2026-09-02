// Progress on re-scan (roadmap.md §7) and the skip rule (§9 test 8). Pure.
import type { CoverageReport } from '../coverage/types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { trackExecution } from './tracking.ts'
import { isEmergencyAccess } from './blockerSteps.ts'
import { SKIP } from '../copy/skip.ts'
import type { Step, StepStatus } from './types.ts'
import type { PlanDecisions, SkipDecision, StepDecision } from './decisions.ts'

export type { PlanDecisions, SkipDecision, StepDecision } from './decisions.ts'

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

// ---- Decisions-only record (prompt 50.1 item 1) ----
//
// The plan the operator sees is regenerated from the snapshot on every load,
// re-scan and edit. The only thing that is persisted is what the operator
// *decided* (PlanDecisions, decisions.ts), which a regeneration cannot know.
// Statuses, populations, evidence lines and dates are never stored — a stale
// build cannot pin them, and a re-scan moves every row that the new snapshot
// moves.

/**
 * Read a stored record of any vintage for its decisions. A pre-50.1 record
 * carried a full per-step blob (status, tracking, ring dates); the only
 * decisions inside it were which steps were skipped. This drops everything else,
 * so migrating a record is reading it once through this function and writing the
 * result back (prompt 50.1 item 2).
 */
export function decisionsOf(
  rec: (Partial<PlanDecisions> & { steps?: Record<string, SavedStep> }) | null | undefined,
  planId: string,
): PlanDecisions {
  const skips: Record<string, SkipDecision> = {}
  if (rec?.skips) for (const [id, d] of Object.entries(rec.skips)) skips[id] = { reason: d.reason, at: d.at }
  // A legacy record's skips live inside its step blob; the generated fields are dropped.
  for (const [id, s] of Object.entries(rec?.steps ?? {})) {
    if (s.status === 'skipped' && !skips[id]) skips[id] = { reason: s.skipReason ?? '', at: s.history?.at(-1)?.at ?? '' }
  }
  // A picker's decision travels as written; a record from before the pickers
  // were live has none.
  const stepDecisions: Record<string, StepDecision> = {}
  for (const [id, d] of Object.entries(rec?.stepDecisions ?? {})) {
    if (!d || typeof d !== 'object') continue
    stepDecisions[id] = { ...(Array.isArray(d.picked) ? { picked: d.picked.map(String) } : {}), ...(typeof d.option === 'string' ? { option: d.option } : {}), at: String(d.at ?? '') }
  }
  return {
    planId: rec?.planId ?? planId,
    skips,
    startDate: rec?.startDate,
    ...(typeof rec?.startedAt === 'string' ? { startedAt: rec.startedAt } : {}),
    band: rec?.band,
    freeze: rec?.freeze ?? null,
    checkpoints: rec?.checkpoints ?? [],
    planCreatedAt: rec?.planCreatedAt,
    stepDecisions,
  }
}

/**
 * Apply the skip decisions to freshly generated steps — the one thing a
 * regeneration cannot know. Everything else (status, tracking, dates) is left to
 * trackExecution over the current snapshot. Emergency access is never skippable
 * (a skipped break-glass step would read as satisfied and drop the edges that
 * keep the tenant recoverable), so a stray decision against it is ignored.
 */
export function applySkips(steps: Step[], skips: Record<string, SkipDecision> | null | undefined): Step[] {
  if (!skips) return steps
  for (const step of steps) {
    const d = skips[step.id]
    if (!d || isEmergencyAccess(step)) continue
    step.history = [...step.history, { at: d.at || new Date().toISOString(), from: step.status, to: 'skipped', note: d.reason }]
    step.skipReason = d.reason
    step.status = 'skipped'
  }
  return steps
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
