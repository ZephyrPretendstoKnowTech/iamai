// Progress on re-scan (roadmap.md §7) and the skip rule (§9 test 8). Pure.
import type { CoverageReport } from '../coverage/types.ts'
import { RETIRED_DECISION_STEPS } from './baselineConflict.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { trackExecution } from './tracking.ts'
import type { TrackingEvidence } from './tracking.ts'
import { isEmergencyAccess } from './blockerSteps.ts'
import { engine } from '../content/content.ts'
import { setState, stateForStatus, statusRank } from './lifecycle.ts'
import { observationsFrom } from './observation.ts'
import type { StepObservation } from './observation.ts'
import type { Step, StepStatus } from './types.ts'
import type { PlanDecisions, SkipDecision, StepDecision } from './decisions.ts'

export type { PlanDecisions, SkipDecision, StepDecision } from './decisions.ts'

// Merge persisted status/history/skips into freshly generated steps by id.
export type SavedStep = {
  status: StepStatus
  history: Step['history']
  skipReason: string | null
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
    owner: step.owner,
    tracking: step.tracking,
    ringActuals: step.rings.map((r) => ({ actualStart: r.actualStart, actualEnd: r.actualEnd })),
    currentRing: step.currentRing,
  }
}

/** Step kinds whose state belongs to a Conditional Access policy, and so to the current scan. */
const DEPLOYS_POLICY: ReadonlySet<Step['kind']> = new Set(['create', 'adjust', 'enforce'])

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
    // tenant can re-derive it. It is restored through its own authority.
    if (s.status === 'skipped') {
      setState(step, { setAside: true })
      continue
    }
    // Everything else the word stood for is a *projection* of a state this scan
    // works out again (lifecycle.ts projectStatus). For a step that deploys a
    // policy it must stay that way: a record saying "ready to enforce last time"
    // is not evidence that the policy deployed now has been watched, and letting
    // the word back in walked straight past the observation contract — past
    // artifact continuity, past a window that reset, past a legacy record that
    // can prove nothing. The lifecycle comes from the current scan and from the
    // history whose continuity that scan can prove (tracking.ts), or not at all.
    if (DEPLOYS_POLICY.has(step.kind)) continue
    // A step that deploys no policy — a prerequisite somebody carried out, a
    // verification that was run — has no tenant object to re-read, so the record
    // is the authority it always was.
    if (statusRank(s.status) > statusRank(step.status)) setState(step, stateForStatus(s.status))
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
  observations: Record<string, StepObservation> | null = null,
  // What a deployed policy's scope is resolved against (tracking.ts
  // TrackingEvidence): the group memberships the scan read. Absent leaves the
  // scope of any policy that names a group unknown, which is conservative and
  // never a fallback to the goal's population.
  scopeEvidence: TrackingEvidence = {},
): Step[] {
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
