// Execution tracking (roadmap-v2.md §5): what actually happened, from
// evidence. Policies match a step by plan tag first, then by intent
// fingerprint; dates come from the policy; soak evidence from sign-in
// records; regressions reopen done steps with a dated note. The user is
// never asked whether a step is done. Pure.
import type { CoverageReport } from '../coverage/types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { absoluteDate } from '../copy/dates.ts'
import { PROGRESS, TRACK } from '../copy/progress.ts'
import { findTaggedPolicy } from './generate.ts'
import type { Checkpoint } from './plan.ts'
import type { Schedule } from './schedule.ts'
import type { Step, StepStatus, StepTracking } from './types.ts'

type PolicyRow = { id?: string; displayName?: string; state?: string; createdDateTime?: string; modifiedDateTime?: string; conditions?: { users?: { includeUsers?: string[]; includeGroups?: string[] } } }

const RANK: Record<StepStatus, number> = { blocked: 0, ready: 0, 'in-report-only': 1, 'ready-to-enforce': 2, done: 3, skipped: -1 }
const SLIP_WEEK_DAYS = 7
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
  planCreatedAt: string | null = null,
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
        reopen(step, TRACK.regression.deleted(previousName, sinceText), now, 'create')
        step.tracking = null
        continue
      }
      if (prev && prev.state === 'disabled') {
        reopen(step, TRACK.regression.disabled(prev.displayName ?? previousName, sinceText), now, 'adjust')
      } else if (goalStatus === 'absent') {
        reopen(step, TRACK.regression.goal(sinceText, 'missing'), now, 'create')
      } else if (goalStatus === 'below-baseline') {
        reopen(step, TRACK.regression.weakened(prev?.displayName ?? previousName, sinceText), now, 'adjust')
      } else if (goalStatus === 'partial') {
        const narrowed = (result?.reasons ?? []).some((r) => !r.expected && (r.kind === 'not-targeted' || r.kind === 'excluded'))
        reopen(step, narrowed ? TRACK.regression.narrowed(prev?.displayName ?? previousName, sinceText) : TRACK.regression.goal(sinceText, 'partly in place'), now, 'adjust')
      }
      if (step.status !== 'done') {
        if (step.tracking) step.tracking = { ...step.tracking, state: prev?.state ?? 'deleted', regressedAt: now }
        step.alreadyInPlace = false
        continue
      }
    }

    if (!match) {
      if (goalStatus === 'enforced') {
        advance(step, 'done', TRACK.enforcedByOther(result?.candidates.find((c) => c.contribution === 'strong')?.policyName ?? 'an existing policy'), now)
        step.alreadyInPlace = planCreatedAt !== null
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
    // Evidence that predates the plan is not execution (ux-review-07 §1).
    step.alreadyInPlace = state === 'enabled' && planCreatedAt !== null && tracking.enforcedAt !== null && Date.parse(tracking.enforcedAt) < Date.parse(planCreatedAt)

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
      advance(step, 'done', `${TRACK.enforced(absoluteDate(tracking.enforcedAt ?? now))}; ${tracking.note}`, now)
      continue
    }
    if (state === 'enabledForReportingButNotEnforced') {
      advance(step, 'in-report-only', `${TRACK.reportOnlyFound(absoluteDate(createdAt ?? now))}; ${tracking.note}`, now)
      if (step.evidence.reportOnly?.meetsExitCriterion && step.highCare.ready) {
        advance(step, 'ready-to-enforce', `${TRACK.readyToEnforce}: ${TRACK.soak(evidence.daysInReportOnly, evidence.signIns, evidence.failures + evidence.interruptions)}`, now)
      }
      continue
    }
    if (goalStatus === 'enforced') advance(step, 'done', TRACK.enforcedByOther(policy.displayName ?? step.title), now)
  }
  return steps
}

// ---- Planned against actual (§5) ----

export type Stage = 'planned' | 'reportOnly' | 'soaking' | 'readyToEnforce' | 'enforced' | 'verified' | 'alreadyInPlace'

export type StepProgress = {
  stepId: string
  title: string
  stage: Stage
  plannedStart: string | null
  plannedEnd: string | null
  actualStart: string | null
  actualEnd: string | null
  slipDays: number | null
  slipReason: string | null
  ring: number
}

export function stageOf(step: Step): Stage {
  if (step.status === 'done' && step.alreadyInPlace) return 'alreadyInPlace'
  if (step.kind === 'prerequisite' || step.kind === 'verify' || step.kind === 'recurring') return step.status === 'done' ? 'enforced' : 'planned'
  if (step.status === 'done') return step.tracking?.evidenceQuality === 'enough' ? 'verified' : 'enforced'
  if (step.status === 'ready-to-enforce') return 'readyToEnforce'
  if (step.status === 'in-report-only') return (step.tracking?.daysInReportOnly ?? 0) > 0 && (step.tracking?.signIns ?? 0) > 0 ? 'soaking' : 'reportOnly'
  return 'planned'
}

function slipReason(step: Step, byId: Map<string, Step>): string | null {
  const b = step.blockers[0]
  if (!b) return step.status === 'in-report-only' && !step.evidence.reportOnly ? TRACK.slip.noEvidence : null
  if (b.kind === 'step') return TRACK.slip.prerequisite(byId.get(b.stepId)?.title ?? b.stepId)
  if (b.kind === 'setup') return TRACK.slip.setup
  if (b.kind === 'readiness') return /locked out/.test(b.label) ? TRACK.slip.operator : TRACK.slip.readiness
  return TRACK.slip.noEvidence
}

export function stepProgress(steps: Step[], schedule: Schedule, now: string = new Date().toISOString()): StepProgress[] {
  const byId = new Map(steps.map((s) => [s.id, s]))
  const waveStart = new Map(schedule.waves.map((w) => [w.wave, w]))
  return trackable(steps).map((s) => {
      const wave = waveStart.get(schedule.waveOf[s.id] ?? 0)
      const plannedStart = s.rings[0]?.plannedStart ?? schedule.reportOnlyAt[s.id] ?? (s.kind === 'verify' ? schedule.verification.start : wave?.start ?? null)
      const plannedEnd = s.rings.at(-1)?.plannedEnd ?? (s.kind === 'verify' ? schedule.verification.end : plannedStart)
      const actualStart = s.tracking?.enforcedAt ?? (s.status === 'done' ? s.history.find((h) => h.to === 'done')?.at ?? null : null)
      const actualEnd = s.status === 'done' ? actualStart : null
      let slipDays: number | null = null
      if (plannedStart && !s.alreadyInPlace) {
        if (actualStart) slipDays = Math.round((Date.parse(actualStart) - Date.parse(plannedStart)) / 86_400_000)
        else if (Date.parse(now) > Date.parse(plannedStart) && s.status !== 'done' && s.status !== 'skipped') slipDays = Math.round((Date.parse(now) - Date.parse(plannedStart)) / 86_400_000)
      }
      return {
        stepId: s.id,
        title: s.title,
        stage: stageOf(s),
        plannedStart,
        plannedEnd,
        actualStart,
        actualEnd,
        slipDays,
        slipReason: slipDays !== null && slipDays > 0 && s.status !== 'done' ? slipReason(s, byId) ?? TRACK.slip.unknown : null,
        ring: s.currentRing,
      }
    })
}

export type ProgressHeadline = {
  started: string | null
  enforced: number
  total: number
  soaking: number
  slipped: number
  alreadyInPlace: number
  projectedEnd: string | null
  plannedEnd: string
  /** The state, the projection, and the already-covered note: three lines, never one paragraph (ux-review-07 §18). */
  state: string
  projection: string
  already: string
  sentence: string
}

export function progressHeadline(steps: Step[], schedule: Schedule, now: string = new Date().toISOString()): ProgressHeadline {
  const rows = stepProgress(steps, schedule, now)
  const total = rows.length
  const alreadyInPlace = rows.filter((r) => r.stage === 'alreadyInPlace').length
  const enforced = rows.filter((r) => r.stage === 'enforced' || r.stage === 'verified').length
  const soaking = rows.filter((r) => r.stage === 'soaking' || r.stage === 'reportOnly' || r.stage === 'readyToEnforce').length
  const slipped = rows.filter((r) => (r.slipDays ?? 0) > SLIP_WEEK_DAYS).length
  // The start is the first real execution, never a policy's birthday (ux-review-07 §1).
  const starts = rows.filter((r) => r.stage !== 'alreadyInPlace').map((r) => r.actualStart).filter((x): x is string => x !== null).sort()
  const started = starts[0] ?? null
  const plannedEnd = schedule.targetEnd
  let projectedEnd: string | null = null
  if (started && enforced > 0 && enforced + alreadyInPlace < total) {
    const elapsedDays = Math.max(1, (Date.parse(now) - Date.parse(started)) / 86_400_000)
    const pace = enforced / elapsedDays
    projectedEnd = new Date(Date.parse(now) + ((total - enforced - alreadyInPlace) / pace) * 86_400_000).toISOString()
  }
  const state = started ? PROGRESS.headline(absoluteDate(started), enforced, total, soaking, slipped) : PROGRESS.notStarted
  const projection = !started
    ? ''
    : projectedEnd
      ? Date.parse(projectedEnd) <= Date.parse(plannedEnd) + SLIP_WEEK_DAYS * 86_400_000
        ? PROGRESS.projectionOnTrack(absoluteDate(plannedEnd))
        : PROGRESS.projection(absoluteDate(projectedEnd), absoluteDate(plannedEnd))
      : PROGRESS.projectionNoPace(absoluteDate(plannedEnd))
  const already = PROGRESS.alreadyCovered(alreadyInPlace)
  return { started, enforced, total, soaking, slipped, alreadyInPlace, projectedEnd, plannedEnd, state, projection, already, sentence: [state, projection, already].filter(Boolean).join(' ') }
}

// ---- What changed since the last scan (§5) ----

export type TenantChange = { kind: string; text: string; planned: boolean; at: string | null }

export function changesSince(snapshot: TenantSnapshot, checkpoint: Checkpoint | null, steps: Step[], planId: string, groupNames: Map<string, string | null> = new Map()): TenantChange[] {
  if (!checkpoint) return []
  const changes: TenantChange[] = []
  const tag = `[IAMAI:${planId}:`
  const matched = new Set(steps.map((s) => s.tracking?.policyId).filter((x): x is string => typeof x === 'string'))
  const isPlanned = (p: PolicyRow): boolean => matched.has(p.id ?? '') || String((p as { description?: string }).description ?? '').includes(tag)
  const before = new Map(checkpoint.tenantPolicies.map((p) => [p.id, p]))
  const current = rows(snapshot)
  for (const p of current) {
    const id = p.id ?? ''
    const name = p.displayName ?? id
    const prev = before.get(id)
    if (!prev) {
      changes.push({ kind: 'created', text: PROGRESS.change.created(name), planned: isPlanned(p), at: p.createdDateTime ?? null })
      continue
    }
    if (prev.state !== p.state) {
      const text = p.state === 'enabled' ? PROGRESS.change.enabled(name) : p.state === 'enabledForReportingButNotEnforced' ? PROGRESS.change.reportOnly(name) : PROGRESS.change.disabled(name)
      changes.push({ kind: p.state ?? 'modified', text, planned: isPlanned(p), at: p.modifiedDateTime ?? null })
    } else if (p.modifiedDateTime && Date.parse(p.modifiedDateTime) > Date.parse(checkpoint.at)) {
      changes.push({ kind: 'modified', text: PROGRESS.change.modified(name), planned: isPlanned(p), at: p.modifiedDateTime })
    }
  }
  const currentIds = new Set(current.map((p) => p.id ?? ''))
  for (const p of checkpoint.tenantPolicies) if (!currentIds.has(p.id)) changes.push({ kind: 'deleted', text: PROGRESS.change.deleted(p.id), planned: matched.has(p.id), at: null })
  // Admins added and break-glass used: from the checkpoint's own record; group growth needs today's counts (groupGrowth).
  const adminsNow = Object.keys(snapshot.roles.active).length
  if (checkpoint.adminIds && adminsNow > checkpoint.adminIds.length) changes.push({ kind: 'admins', text: PROGRESS.change.adminsAdded(adminsNow - checkpoint.adminIds.length), planned: false, at: null })
  for (const bg of checkpoint.breakGlass) {
    const u = snapshot.users.find((x) => x.id === bg.userId)
    if (u?.lastSuccessfulSignIn && u.lastSuccessfulSignIn !== bg.lastSignIn) changes.push({ kind: 'breakGlass', text: PROGRESS.change.breakGlassUsed(u.displayName ?? bg.userId, absoluteDate(u.lastSuccessfulSignIn)), planned: false, at: u.lastSuccessfulSignIn })
  }
  void groupNames
  return changes.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
}

/** Exclusion groups that grew since the checkpoint, given today's member counts. */
export function groupGrowth(checkpoint: Checkpoint | null, groups: Map<string, { memberCount: number; displayName?: string | null }>): TenantChange[] {
  if (!checkpoint) return []
  const out: TenantChange[] = []
  for (const g of checkpoint.exclusionGroups) {
    const now = groups.get(g.groupId)
    if (now && now.memberCount > g.memberCount) out.push({ kind: 'group', text: PROGRESS.change.groupGrew(now.displayName ?? g.groupId, g.memberCount, now.memberCount), planned: false, at: null })
  }
  return out
}
