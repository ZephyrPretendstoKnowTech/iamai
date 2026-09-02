// Execution tracking (roadmap-v2.md §5): what actually happened, from
// evidence. Policies match a step by plan tag first, then by intent
// fingerprint; dates come from the policy; soak evidence from sign-in
// records; regressions reopen done steps with a dated note. The user is
// never asked whether a step is done. Pure.
import type { CoverageReport } from '../coverage/types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { absoluteDate } from '../copy/dates.ts'
import { findTaggedPolicy } from './generate.ts'
import { engine } from '../content/content.ts'
import { fillText } from '../content/render.ts'

const TRACK = engine.tracking
import type { Step, StepStatus, StepTracking } from './types.ts'

type PolicyRow = { id?: string; displayName?: string; state?: string; createdDateTime?: string; modifiedDateTime?: string; conditions?: { users?: { includeUsers?: string[]; includeGroups?: string[] } } }

const RANK: Record<StepStatus, number> = { blocked: 0, ready: 0, 'in-report-only': 1, 'ready-to-enforce': 2, done: 3, skipped: -1 }
/**
 * Executed steps needed before a completion date is projected. Below this the
 * page says the projection needs more data rather than extrapolating from one
 * point (prompt 40 §8).
 */

const MIN_SIGNINS_TO_JUDGE = 20

function advance(step: Step, to: StepStatus, note: string, at: string): void {
  if (step.status === 'skipped') return
  if (RANK[to] < RANK[step.status]) return
  // A step generated already at this status (coverage saw it enforced) still
  // records the evidence once, so the history says why it is where it is.
  if (RANK[to] === RANK[step.status]) {
    if (!step.history.some((h) => h.to === to)) step.history.push({ at, from: 'ready', to, note })
    return
  }
  step.history.push({ at, from: step.status, to, note })
  step.status = to
}

function reopen(step: Step, note: string, at: string, kind: Step['kind']): void {
  step.history.push({ at, from: step.status, to: 'ready', note })
  step.status = 'ready'
  step.kind = kind
}

const rows = (snapshot: TenantSnapshot): PolicyRow[] => (snapshot.config.caPolicies?.rows ?? []) as PolicyRow[]

/** The policy delivering a step: by tag, else by the coverage fingerprint (with a note). */
export function matchPolicy(step: Step, snapshot: TenantSnapshot, coverage: CoverageReport, planId: string): { policy: PolicyRow; matchedBy: 'tag' | 'fingerprint' } | null {
  const tagged = findTaggedPolicy(snapshot, planId, step.id)
  const all = rows(snapshot)
  if (tagged) {
    const policy = all.find((p) => p.id === tagged)
    if (policy) return { policy, matchedBy: 'tag' }
  }
  const result = coverage.results.find((r) => r.goal.id === step.goalId)
  if (!result) return null
  const candidate =
    result.candidates.find((c) => c.contribution === 'strong') ??
    result.candidates.find((c) => c.contribution === 'reportOnly') ??
    result.candidates.find((c) => c.contribution === 'weak') ??
    null
  if (!candidate) return null
  const policy = all.find((p) => p.id === candidate.policyId)
  return policy ? { policy, matchedBy: 'fingerprint' } : null
}

function soak(snapshot: TenantSnapshot, policyId: string, createdAt: string | null): Pick<StepTracking, 'daysInReportOnly' | 'signIns' | 'failures' | 'interruptions' | 'failuresByUser' | 'evidenceQuality'> {
  const pr = snapshot.evidencePolicyResults.find((p) => p.policyId === policyId)
  const covered = snapshot.sources.signInEvidence?.coveredWindow ?? null
  const windowDays = covered ? Math.floor((Date.parse(covered.to) - Date.parse(covered.from)) / 86_400_000) : 0
  const sinceCreated = covered && createdAt ? Math.max(0, Math.floor((Date.parse(covered.to) - Date.parse(createdAt)) / 86_400_000)) : windowDays
  const daysInReportOnly = Math.min(windowDays, sinceCreated)
  if (!pr) return { daysInReportOnly, signIns: 0, failures: 0, interruptions: 0, failuresByUser: [], evidenceQuality: covered ? 'thin' : 'none' }
  const c = pr.counts
  const signIns = c.reportOnlyFailure + c.reportOnlyInterrupted + c.reportOnlySuccess + c.enforcedFailure + c.enforcedSuccess
  const byUser = new Map<string, number>()
  for (const id of [...pr.affectedUserIds.reportOnlyFailure, ...pr.affectedUserIds.reportOnlyInterrupted, ...pr.affectedUserIds.enforcedFailure]) byUser.set(id, (byUser.get(id) ?? 0) + 1)
  return {
    daysInReportOnly,
    signIns,
    failures: c.reportOnlyFailure + c.enforcedFailure,
    interruptions: c.reportOnlyInterrupted,
    failuresByUser: [...byUser.entries()].map(([userId, n]) => ({ userId, count: n })).sort((a, b) => b.count - a.count),
    evidenceQuality: signIns >= MIN_SIGNINS_TO_JUDGE ? 'enough' : signIns > 0 ? 'thin' : 'none',
  }
}

/**
 * Detection on every scan. Statuses move forward on evidence; a done step
 * whose policy was disabled, deleted, weakened or narrowed reopens with a
 * dated note. `now` is injectable for tests.
 */
/** Every step the plan tracks: everything not skipped. The one denominator (ux-review-07 §2). */
export function trackable(steps: Step[]): Step[] {
  return steps.filter((s) => s.status !== 'skipped')
}

export function trackExecution(
  steps: Step[],
  snapshot: TenantSnapshot,
  coverage: CoverageReport,
  planId: string,
  now: string = new Date().toISOString(),
): Step[] {
  const resultByGoal = new Map(coverage.results.map((r) => [r.goal.id, r]))
  for (const step of steps) {
    if (step.kind !== 'create' && step.kind !== 'adjust') continue
    const result = resultByGoal.get(step.goalId)
    const goalStatus = result?.status
    const match = matchPolicy(step, snapshot, coverage, planId)
    const since = step.history.at(-1)?.at ?? snapshot.asOf
    const sinceText = absoluteDate(since)
    const wasDone = step.status === 'done'
    const previousPolicy = step.tracking?.policyId ?? null
    const previousName = step.tracking?.policyName ?? step.deliveredBy[0]?.replace(/ \([^)]*\)$/, '') ?? step.title

    // ---- Regressions (§5): reopen with a dated note ----
    if (wasDone) {
      const prev = previousPolicy ? rows(snapshot).find((p) => p.id === previousPolicy) ?? null : null
      if (previousPolicy && !prev) {
        reopen(step, fillText(TRACK.regression.deleted, { name: previousName, since: sinceText }), now, 'create')
        step.tracking = null
        continue
      }
      if (prev && prev.state === 'disabled') {
        reopen(step, fillText(TRACK.regression.disabled, { name: prev.displayName ?? previousName, since: sinceText }), now, 'adjust')
      } else if (goalStatus === 'absent') {
        reopen(step, fillText(TRACK.regression.goal, { since: sinceText, what: 'missing' }), now, 'create')
      } else if (goalStatus === 'below-baseline') {
        reopen(step, fillText(TRACK.regression.weakened, { name: prev?.displayName ?? previousName, since: sinceText }), now, 'adjust')
      } else if (goalStatus === 'partial') {
        const narrowed = (result?.reasons ?? []).some((r) => !r.expected && (r.kind === 'not-targeted' || r.kind === 'excluded'))
        reopen(step, narrowed ? fillText(TRACK.regression.narrowed, { name: prev?.displayName ?? previousName, since: sinceText }) : fillText(TRACK.regression.goal, { since: sinceText, what: 'partly in place' }), now, 'adjust')
      }
      if (step.status !== 'done') {
        if (step.tracking) step.tracking = { ...step.tracking, state: prev?.state ?? 'deleted', regressedAt: now }
        continue
      }
    }

    if (!match) {
      if (result?.verdict === 'inPlace') {
        advance(step, 'done', fillText(TRACK.enforcedByOther, { name: result?.candidates.find((c) => c.contribution === 'strong')?.policyName ?? 'an existing policy' }), now)
      }
      continue
    }
    const { policy, matchedBy } = match
    const createdAt = policy.createdDateTime ?? null
    const modifiedAt = policy.modifiedDateTime ?? null
    const state = policy.state ?? 'unknown'
    const evidence = soak(snapshot, policy.id ?? '', createdAt)
    const includesAll = (policy.conditions?.users?.includeUsers ?? []).some((u) => /^(All|GuestsOrExternalUsers)$/i.test(u))
    const tracking: StepTracking = {
      policyId: policy.id ?? '',
      policyName: policy.displayName ?? step.title,
      matchedBy,
      note: matchedBy === 'tag' ? TRACK.matchedByTag : TRACK.matchedByFingerprint,
      createdAt,
      modifiedAt,
      state,
      reportOnlyAt: createdAt,
      enforcedAt: state === 'enabled' ? (modifiedAt ?? createdAt) : step.tracking?.enforcedAt ?? null,
      regressedAt: null,
      noticedAt: step.tracking?.noticedAt ?? now,
      ...evidence,
    }
    step.tracking = tracking

    // ---- Rings: actual dates from what the policy shows ----
    if (state === 'enabled' && step.rings.length > 0) {
      const at = tracking.enforcedAt ?? now
      step.rings[0].actualStart = step.rings[0].actualStart ?? at
      if (includesAll) {
        // The policy already covers everyone: every ring is through.
        for (const [i, r] of step.rings.entries()) {
          r.actualStart = r.actualStart ?? at
          if (i < step.rings.length - 1) r.actualEnd = r.actualEnd ?? at
        }
        step.currentRing = step.rings.length - 1
      } else {
        step.currentRing = Math.max(step.currentRing, 0)
      }
    }

    // ---- Status transitions, each with the evidence that justified it ----
    if (state === 'enabled') {
      // A step is done if and only if its goal's verdict is inPlace (target-state
      // §8.2, prompt 46 item 9). This used to advance on the policy's state
      // alone, so a policy that was on but short of the baseline made its step
      // done while Findings said partly: "Admin sessions expire quickly" was
      // done on the Plan and partly in place on Findings, and the demo tenant
      // counted 11 in place against 6. An enabled policy behind a partly goal
      // is a change step whose object already exists, never a finished one.
      if (result?.verdict === 'inPlace') {
        advance(step, 'done', `${fillText(TRACK.enforced, { date: absoluteDate(tracking.enforcedAt ?? now) })}; ${tracking.note}`, now)
      } else {
      }
      continue
    }
    if (state === 'enabledForReportingButNotEnforced') {
      advance(step, 'in-report-only', `${fillText(TRACK.reportOnlyFound, { date: absoluteDate(createdAt ?? now) })}; ${tracking.note}`, now)
      if (step.evidence.reportOnly?.meetsExitCriterion) {
        advance(step, 'ready-to-enforce', `${TRACK.readyToEnforce}: ${fillText(TRACK.soak, { days: evidence.daysInReportOnly, signIns: evidence.signIns, failures: evidence.failures + evidence.interruptions })}`, now)
      }
      continue
    }
    if (goalStatus === 'enforced') advance(step, 'done', fillText(TRACK.enforcedByOther, { name: policy.displayName ?? step.title }), now)
  }
  return steps
}
