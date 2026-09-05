// Execution tracking (roadmap-v2.md §5): what actually happened, from
// evidence. Policies match a step by plan tag first, then by intent
// fingerprint; dates come from the policy; a report-only policy's readiness
// to enforce from two gates over the sign-in records; regressions reopen done
// steps with a dated note. The user is never asked whether a step is done, or
// to mark anything ready. Pure.
import type { CoverageReport } from '../coverage/types.ts'
import type { PolicyAppliedResult, TenantSnapshot } from '../graph/collect/types.ts'
import { absoluteDate } from '../copy/dates.ts'
import { findTaggedPolicy } from './generate.ts'
import { observationDaysFor } from './schedule.ts'
import { readyWhen } from '../derive/readyWhen.ts'
import { effectOf } from './operations.ts'
import { scopeCohort } from './strand.ts'
import { engine } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import { advanceState, raiseCondition, setState, statusRank } from './lifecycle.ts'
import type { StepState } from './lifecycle.ts'
import { observe, observedStateOf, semanticsOf } from './observation.ts'
import type { ObservationChange, StepObservation } from './observation.ts'

const TRACK = engine.tracking
import type { Step, StepStatus, StepTracking } from './types.ts'

type PolicyRow = { id?: string; displayName?: string; state?: string; createdDateTime?: string; modifiedDateTime?: string; conditions?: { users?: { includeUsers?: string[]; includeGroups?: string[] } } }

/**
 * What tracking needs beside the snapshot to resolve a deployed policy's scope
 * exactly: who is in a group, where the scan read the whole group, and the
 * tenant's active people — the denominator the evidence gate counts over.
 *
 * Both are read only to answer *this policy's* own conditions, and neither is
 * guessed: a caller that supplies no group memberships leaves the scope of any
 * policy naming a group unknown, and one that names no active people leaves the
 * denominator unknown. Both are conservative, and neither is ever filled in from
 * the goal's population.
 */
export type TrackingEvidence = {
  groupMembers?: Record<string, readonly string[]>
  activePeople?: readonly string[]
}

/**
 * Executed steps needed before a completion date is projected. Below this the
 * page says the projection needs more data rather than extrapolating from one
 * point (prompt 40 §8).
 */

const MIN_SIGNINS_TO_JUDGE = 20
const DAY = 86_400_000
const REPORT_ONLY = 'enabledForReportingButNotEnforced'

const daysBetween = (from: string, to: string): number => Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / DAY))

/**
 * Move a step forward on the evidence, never backwards. The state is what
 * moves; the status word follows from it (lifecycle.ts), so a stage and a word
 * cannot disagree. Returns nothing: a refused move leaves the step alone.
 */
function advance(step: Step, to: Partial<StepState>, note: string, at: string): void {
  if (step.state.setAside) return
  const from = step.status
  if (!advanceState(step, to)) return
  // A step generated already at this status (coverage saw it enforced) still
  // records the evidence once, so the history says why it is where it is.
  if (step.status === from) {
    if (!step.history.some((h) => h.to === from)) step.history.push({ at, from: 'ready', to: from, note })
    return
  }
  step.history.push({ at, from, to: step.status, note })
}

/**
 * A done step whose policy went away, was turned off, weakened or narrowed. The
 * goal is open again and the change IAMAI planned is not deployed, so the
 * lifecycle restarts and the condition says the step needs looking at.
 */
function reopen(step: Step, note: string, at: string, kind: Step['kind']): void {
  step.history.push({ at, from: step.status, to: 'ready', note })
  setState(step, { satisfied: false, inPlace: false, lifecycle: 'not-deployed', condition: 'review-required' })
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

/**
 * In report-only since, and which of the two it is: Microsoft's own evidence — a
 * sign-in record evaluated under the policy in report-only, which proves it was
 * in report-only that day — or IAMAI's own first sighting of it, which proves
 * only that. The observation holds both and admits the evidence only while it
 * can still be about the policy that is deployed now (observation.ts).
 */
function reportOnlySince(change: ObservationChange): { at: string; source: NonNullable<StepTracking['reportOnlyAtSource']> } {
  const { firstSeenAt, evidenceAt } = change.latest
  if (evidenceAt !== null && Date.parse(evidenceAt) < Date.parse(firstSeenAt)) return { at: evidenceAt, source: 'sign-in-evidence' }
  return { at: firstSeenAt, source: 'first-seen-by-iamai' }
}

/**
 * What the step's own operation would leave on the tenant, fingerprinted the
 * same way an observation is, so a change that matches it is the plan's own work
 * landing rather than somebody editing the policy. Null where the operation is a
 * partial update with no whole policy behind it: the plan cannot tell, and a
 * change it cannot tell about is not one it may claim to have asked for.
 */
function intendedSemantics(step: Step): string | null {
  const op = step.action.resolution?.policies[0]
  if (!op) return null
  const whole = op.mode === 'create' ? op.body : op.target
  return whole ? semanticsOf(whole) : null
}

/**
 * What the evidence gate counts over: the accounts the *matched tenant policy*
 * reaches, from its own conditions and nothing else (roadmap/strand.ts
 * scopeCohort), narrowed to the tenant's active people — the ones the records
 * could show.
 *
 * The question the gate asks is about a policy that is deployed, so the deployed
 * policy is the authority: the plan's own operation describes a different object
 * (it may not be this policy, and on a step whose objects are missing there is no
 * operation at all), and the goal's population describes no policy whatsoever.
 *
 * Null — not empty — where the policy's scope cannot be settled: a group nothing
 * says who is in, a clause IAMAI could not read. Nothing falls back.
 */
function trackedScope(policy: PolicyRow, snapshot: TenantSnapshot, ctx: TrackingEvidence, active: ReadonlySet<string> | null): string[] | null {
  if (active === null) return null
  const effect = effectOf(policy as Record<string, unknown>)
  const named = scopeCohort([effect], snapshot.users.map((u) => u.id), snapshot, { groupMembers: ctx.groupMembers })
  return named === null ? null : named.filter((id) => active.has(id))
}

/**
 * The records' verdict on a policy, and the two gates on one in report-only
 * (constants.ts OBSERVATION_DAYS): the time gate, ready on `since` plus the
 * step's observation window; the evidence gate, ready now when the records since
 * `since` show zero failures and every active person the *policy* reaches at
 * least once. Whichever comes first. `since` is null for a policy not in
 * report-only.
 */
function gates(
  step: Step,
  policy: PolicyRow,
  snapshot: TenantSnapshot,
  pr: PolicyAppliedResult | undefined,
  since: string | null,
  ctx: TrackingEvidence,
  activeSet: ReadonlySet<string> | null,
): Pick<StepTracking, 'daysInReportOnly' | 'readyOn' | 'readyNow' | 'seenInScope' | 'activeInScope' | 'signIns' | 'failures' | 'failuresByUser' | 'evidenceQuality'> {
  const covered = snapshot.sources.signInEvidence?.coveredWindow ?? null
  const active = trackedScope(policy, snapshot, ctx, activeSet)
  const daysInReportOnly = since ? daysBetween(since, snapshot.asOf) : 0
  const readyOn = since ? new Date(Date.parse(since) + observationDaysFor(step) * DAY).toISOString() : null
  if (!pr) return { daysInReportOnly, readyOn, readyNow: false, seenInScope: active === null ? null : 0, activeInScope: active?.length ?? null, signIns: 0, failures: 0, failuresByUser: [], evidenceQuality: covered ? 'thin' : 'none' }
  const c = pr.counts
  const signIns = c.reportOnlyFailure + c.reportOnlyInterrupted + c.reportOnlySuccess + c.enforcedFailure + c.enforcedSuccess
  // Failing or interrupted records since `since`: by day where the snapshot
  // carries days; the window's totals where it does not (or there is no since).
  const sinceDay = since ? since.slice(0, 10) : null
  const failures =
    pr.byDay && sinceDay
      ? Object.entries(pr.byDay).reduce((n, [day, d]) => (day >= sinceDay ? n + d.failures : n), 0)
      : c.reportOnlyFailure + c.reportOnlyInterrupted + c.enforcedFailure
  const byUser = new Map<string, number>()
  for (const id of [...pr.affectedUserIds.reportOnlyFailure, ...pr.affectedUserIds.reportOnlyInterrupted, ...pr.affectedUserIds.enforcedFailure]) byUser.set(id, (byUser.get(id) ?? 0) + 1)
  // A record of this policy for a person is that person seen; a report-only
  // record exists only while the policy is in report-only.
  const seen = new Set(Object.values(pr.affectedUserIds).flat())
  const seenInScope = active === null ? null : active.filter((id) => seen.has(id)).length
  return {
    daysInReportOnly,
    readyOn,
    // A scope nobody established is not an empty scope: with no in-scope list the
    // "everybody seen" half of the gate would be vacuously true, so the evidence
    // gate cannot open at all and the time gate is the only way through.
    readyNow: active !== null && seenInScope !== null && since !== null && signIns > 0 && failures === 0 && seenInScope === active.length,
    seenInScope,
    activeInScope: active?.length ?? null,
    signIns,
    failures,
    failuresByUser: [...byUser.entries()].map(([userId, n]) => ({ userId, count: n })).sort((a, b) => b.count - a.count),
    evidenceQuality: signIns >= MIN_SIGNINS_TO_JUDGE ? 'enough' : signIns > 0 ? 'thin' : 'none',
  }
}

/** Every step the plan tracks: everything not skipped. The one denominator (ux-review-07 §2). */
export function trackable(steps: Step[]): Step[] {
  return steps.filter((s) => s.status !== 'skipped')
}

/**
 * The observations the plan record keeps (PlanDecisions.observations): what this
 * scan saw of each step's policy, so the next scan can say what moved. The one
 * thing a regeneration cannot work out again — a snapshot shows the state now,
 * never when a scan first saw it.
 */
export function observationsOf(steps: Step[]): Record<string, StepObservation> {
  const out: Record<string, StepObservation> = {}
  for (const s of steps) if (s.state.observation) out[s.id] = s.state.observation.latest
  return out
}

/**
 * Detection on every scan. The lifecycle moves forward on evidence; a done step
 * whose policy was disabled, deleted, weakened or narrowed reopens with a dated
 * note. `now` is injectable for tests; `observations` is what the plan record
 * carried in from the last scan (observation.ts), the one history a
 * regeneration cannot repeat.
 */
export function trackExecution(
  steps: Step[],
  snapshot: TenantSnapshot,
  coverage: CoverageReport,
  planId: string,
  now: string = new Date().toISOString(),
  observations: Record<string, StepObservation> = {},
  scopeEvidence: TrackingEvidence = {},
): Step[] {
  const resultByGoal = new Map(coverage.results.map((r) => [r.goal.id, r]))
  // The tenant's own active people: a directory fact the caller supplies, never a
  // goal's population and never invented here.
  const activeSet = scopeEvidence.activePeople ? new Set(scopeEvidence.activePeople) : null
  for (const step of steps) {
    if (step.kind !== 'create' && step.kind !== 'adjust') continue
    const result = resultByGoal.get(step.goalId)
    const goalStatus = result?.status
    const match = matchPolicy(step, snapshot, coverage, planId)

    // ---- What this scan saw, against what the last one saw ----
    // Recorded for every step that deploys a policy, including the ones where
    // there is nothing there yet: "not deployed" is an observation, and a policy
    // that appears between two scans is a change somebody made.
    const policyRow = match?.policy ?? null
    const pr = policyRow ? snapshot.evidencePolicyResults.find((p) => p.policyId === policyRow.id) : undefined
    const observedState = observedStateOf(policyRow?.state ?? null)
    const change = observe(observations[step.id] ?? null, {
      state: observedState,
      semantics: semanticsOf(policyRow as Record<string, unknown> | null),
      at: snapshot.asOf,
      // The one transition a tenant can prove: a sign-in evaluated under the
      // policy in report-only says it was in report-only that day.
      evidenceAt: observedState === 'report-only' ? pr?.firstReportOnlyAt ?? null : null,
      intended: intendedSemantics(step),
    })
    setState(step, { observation: change })
    advanceState(step, { lifecycle: observedState === 'report-only' ? 'report-only' : observedState === 'enforced' ? 'enforced' : 'not-deployed' })
    // A policy rewritten since the last scan has not been watched: what the
    // records hold is about the policy it used to be. The step needs looking
    // at, and its window starts again from the scan that noticed (observe()).
    if (change.invalidated) raiseCondition(step, 'review-required')

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
        advance(step, { satisfied: true, inPlace: true }, fillText(TRACK.enforcedByOther, { name: result?.candidates.find((c) => c.contribution === 'strong')?.policyName ?? 'an existing policy' }), now)
      }
      continue
    }
    const { policy, matchedBy } = match
    const createdAt = policy.createdDateTime ?? null
    const modifiedAt = policy.modifiedDateTime ?? null
    const state = policy.state ?? 'unknown'
    const inReportOnlySince = observedState === 'report-only' ? reportOnlySince(change) : null
    const reportOnlyAt = inReportOnlySince?.at ?? null
    const evidence = gates(step, policy, snapshot, pr, reportOnlyAt, scopeEvidence, activeSet)
    // A policy's own stamps date the object, never the moment it began to
    // enforce; a value carried from an earlier scan is older still. The source
    // says which, so nothing downstream reads it as a proven transition.
    const enforced: { at: string | null; source: StepTracking['enforcedAtSource'] } =
      state === 'enabled'
        ? modifiedAt
          ? { at: modifiedAt, source: 'policy-modified' }
          : createdAt
            ? { at: createdAt, source: 'policy-created' }
            : { at: null, source: null }
        : step.tracking?.enforcedAt
          ? { at: step.tracking.enforcedAt, source: 'carried-forward' }
          : { at: null, source: null }
    const includesAll = (policy.conditions?.users?.includeUsers ?? []).some((u) => /^(All|GuestsOrExternalUsers)$/i.test(u))
    const tracking: StepTracking = {
      policyId: policy.id ?? '',
      policyName: policy.displayName ?? step.title,
      matchedBy,
      note: matchedBy === 'tag' ? TRACK.matchedByTag : TRACK.matchedByFingerprint,
      createdAt,
      modifiedAt,
      state,
      reportOnlyAt,
      reportOnlyAtSource: inReportOnlySince?.source ?? null,
      enforcedAt: enforced.at,
      enforcedAtSource: enforced.source,
      regressedAt: null,
      noticedAt: snapshot.asOf,
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
        advance(step, { satisfied: true }, `${fillText(TRACK.enforced, { date: absoluteDate(tracking.enforcedAt ?? now) })}; ${tracking.note}`, now)
      }
      continue
    }
    if (state === REPORT_ONLY && reportOnlyAt) {
      advance(step, { lifecycle: 'report-only' }, `${fillText(TRACK.reportOnlyFound, { date: absoluteDate(reportOnlyAt) })}; ${tracking.note}`, now)
      // Ready to enforce by whichever gate came first; the note says which. A
      // policy this scan found rewritten has been watched for nothing, so it
      // advances on neither gate however clean the records look.
      const ready = change.invalidated ? null : readyWhen(step)
      if (ready?.kind === 'now') advance(step, { lifecycle: 'ready-to-enforce' }, fillText(TRACK.readyNow, { n: ready.days }), now)
      else if (ready?.kind === 'since') advance(step, { lifecycle: 'ready-to-enforce' }, fillText(TRACK.readySince, { date: absoluteDate(ready.date) }), now)
      continue
    }
    if (goalStatus === 'enforced') advance(step, { satisfied: true, inPlace: true }, fillText(TRACK.enforcedByOther, { name: policy.displayName ?? step.title }), now)
  }
  return steps
}
