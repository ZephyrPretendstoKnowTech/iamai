// Progress on re-scan (roadmap.md §7) and the skip rule (§9 test 8). Pure.
import type { CoverageReport } from '../coverage/types.ts'
import { RETIRED_DECISION_STEPS } from './baselineConflict.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { trackExecution } from './tracking.ts'
import { markHoldChains } from './holds.ts'
import type { TrackingEvidence } from './tracking.ts'
import { isEmergencyAccess } from './blockerSteps.ts'
import { engine } from '../content/content.ts'
import { setState } from './lifecycle.ts'
import { observationsFrom } from './observation.ts'
import type { StepObservationRecord } from './observation.ts'
import type { Step, StepStatus } from './types.ts'
import type { PlanDecisions, SkipDecision, StepDecision } from './decisions.ts'

export type { PlanDecisions, SkipDecision, StepDecision } from './decisions.ts'

// Merge what a saved plan legitimately holds into freshly generated steps by id.
export type SavedStep = {
  /**
   * The word the scan that saved this file projected. Kept for the record and for
   * reading a file written before `setAside` existed; it is not read as authority
   * for anything (see `mergePersisted`).
   */
  status: StepStatus
  history: Step['history']
  skipReason: string | null
  /**
   * The operator set this step aside. The fact itself rather than the word it
   * used to be inferred from: a decision nothing about the tenant can re-derive,
   * so it is persisted and restored explicitly.
   */
  setAside?: boolean
  owner?: string | null
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
    setAside: step.state.setAside,
    owner: step.owner,
    tracking: step.tracking,
    ringActuals: step.rings.map((r) => ({ actualStart: r.actualStart, actualEnd: r.actualEnd })),
    currentRing: step.currentRing,
  }
}

/**
 * What a saved plan may put back.
 *
 * Not the status word. Every step this engine generates works its own state out
 * from the scan in front of it: a policy step from the tenant's policy and the
 * observation history whose continuity that scan can prove (tracking.ts); a
 * prerequisite from whether the object exists or the validation subject passes
 * *now*; a check from whether anybody is still dormant, still an admin with a
 * mailbox, still unanswered; the verification from how many people still have no
 * method. None of that is a one-time act somebody performed and nobody can
 * observe again — it is all a reading of the tenant, and a reading has to be
 * taken again every time.
 *
 * So restoring a higher saved word was a way for a fact to survive the evidence
 * that produced it. The dangerous shape is not the row going stale on screen: the
 * emergency-access and exclusions-group steps are the gate every policy that can
 * deny access waits behind, and a saved `done` on either would have opened that
 * gate on evidence from a scan that no longer holds. The dormant and
 * separate-admin checks are not even generated once their condition clears, so a
 * word restored onto them describes a step about nobody.
 *
 * What does survive is what a scan cannot re-derive: the operator's own decision
 * to set a step aside, restored from the fact rather than from the word; and the
 * record — history, owner, tracking, the ring dates a rollout actually ran to.
 */
export function mergePersisted(steps: Step[], saved: Record<string, SavedStep> | null): Step[] {
  if (!saved) return steps
  for (const step of steps) {
    const s = saved[step.id]
    if (!s) continue
    step.history = s.history
    step.skipReason = s.skipReason
    step.owner = s.owner ?? null
    step.tracking = s.tracking ?? null
    if (s.ringActuals) for (const [i, r] of step.rings.entries()) if (s.ringActuals[i]) Object.assign(r, s.ringActuals[i])
    if (typeof s.currentRing === 'number') step.currentRing = Math.min(s.currentRing, Math.max(0, step.rings.length - 1))
    // Setting a step aside is the operator's own decision, and nothing about the
    // tenant can re-derive it: the fact is restored, and the word is read only
    // for a file written before the fact was stored beside it.
    if (s.setAside === true || (s.setAside === undefined && s.status === 'skipped')) setState(step, { setAside: true })
  }
  return steps
}

// Detection on every scan (roadmap-v2.md §5) lives in tracking.ts; this
// keeps the entry point the page and the tests call.
export function applyProgress(
  steps: Step[],
  snapshot: TenantSnapshot,
  coverage: CoverageReport,
  planId: string,
  now?: string,
  planCreatedAt: string | null = null,
  observations: Record<string, StepObservationRecord> | null = null,
  // What a deployed policy's scope is resolved against (tracking.ts
  // TrackingEvidence): the group memberships the scan read. Absent leaves the
  // scope of any policy that names a group unknown, which is conservative and
  // never a fallback to the goal's population.
  scopeEvidence: TrackingEvidence = {},
): Step[] {
  // A wait on a held step is a hold before tracking asks who is ready (roadmap/holds.ts).
  markHoldChains(steps)
  return trackExecution(steps, snapshot, coverage, planId, now, observations ?? {}, scopeEvidence)
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
  // were live has none, and a record for a decision the product has since
  // retired is not a decision (baselineConflict.ts RETIRED_DECISION_STEPS): it
  // stops here, so no surface, no plan and no export ever sees it again.
  const stepDecisions: Record<string, StepDecision> = {}
  for (const [id, d] of Object.entries(rec?.stepDecisions ?? {})) {
    if (!d || typeof d !== 'object' || RETIRED_DECISION_STEPS.has(id)) continue
    // A question's answers travel too (E1): the record is what makes a stored answer apply after a reload.
    const answers = Object.fromEntries(Object.entries(d.answers ?? {}).filter((e): e is [string, string] => typeof e[1] === 'string'))
    stepDecisions[id] = { ...(Array.isArray(d.picked) ? { picked: d.picked.map(String) } : {}), ...(typeof d.option === 'string' ? { option: d.option } : {}), ...(Object.keys(answers).length > 0 ? { answers } : {}), at: String(d.at ?? '') }
  }
  // Owner confirmations travel as written — when, and the fingerprint of what
  // they were given against — and anything else in their place is not one.
  const confirmations: Record<string, Record<string, { at: string; basis: string }>> = {}
  for (const [stepId, byId] of Object.entries((rec as { confirmations?: unknown } | null | undefined)?.confirmations ?? {})) {
    if (!byId || typeof byId !== 'object') continue
    const kept: Record<string, { at: string; basis: string }> = {}
    for (const [id, c] of Object.entries(byId as Record<string, unknown>)) {
      const v = c as { at?: unknown; basis?: unknown } | null
      if (v && typeof v.at === 'string' && typeof v.basis === 'string') kept[id] = { at: v.at, basis: v.basis }
    }
    if (Object.keys(kept).length > 0) confirmations[stepId] = kept
  }
  // What the last scan saw of each step's policy: the one history only the
  // record holds (observation.ts). A pre-Foundation-B record kept a single
  // report-only date per step, and it migrates as a report-only observation.
  const observations = observationsFrom(rec)
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
    ...(Object.keys(confirmations).length > 0 ? { confirmations } : {}),
    observations,
    ...(typeof (rec as { signature?: unknown } | null)?.signature === 'string' ? { signature: (rec as { signature: string }).signature } : {}),
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
    setState(step, { setAside: true })
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
  if (isEmergencyAccess(step)) return { ok: false, error: engine.skip.cannotSkip }
  const r = reason.trim()
  if (r.length === 0) return { ok: false, error: 'a reason is required to skip a step' }
  if (/risk\s*accept/i.test(r)) {
    return { ok: false, error: 'steps are skipped as "not applicable to us", never as accepted risk' }
  }
  step.history.push({ at: new Date().toISOString(), from: step.status, to: 'skipped', note: r })
  setState(step, { setAside: true })
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
  if (!step.state.setAside) return { ok: false, error: 'that step is not skipped' }
  step.history.push({ at: new Date().toISOString(), from: 'skipped', to: 'blocked', note: engine.skip.unskip })
  setState(step, { setAside: false, condition: 'blocked' })
  step.skipReason = null
  return { ok: true }
}
