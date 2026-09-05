// Execution tracking (roadmap-v2.md §5): what actually happened, from
// evidence. Policies match a step by plan tag first, then by intent
// fingerprint; dates come from the policy; a report-only policy's readiness
// to enforce from two gates over the sign-in records; regressions reopen done
// steps with a dated note. The user is never asked whether a step is done, or
// to mark anything ready. Pure.
//
// One step is not one policy. A goal the baseline implements with two policies
// (the pinned guests pair) is one step delivering Policy A and Policy B, and
// every temporal fact here belongs to the deployed artifact rather than to the
// row: the object watched, the window it has served, Microsoft's evidence about
// it, the movement its own operation asked for. Reading one policy per step made
// each of those transferable — Policy A's earned window enforced Policy B, A's
// clean records satisfied B's gate, B's absence disappeared behind A, and B's
// rewrite was compared against A's intent. So the authority is the *required
// policy member*: each one resolves at most one tenant artifact, keeps its own
// history and its own gates, and the step's single lifecycle is derived from all
// of them conservatively — never taken from whichever member came first.
import type { CoverageReport } from '../coverage/types.ts'
import type { PolicyAppliedResult, TenantSnapshot } from '../graph/collect/types.ts'
import { absoluteDate } from '../copy/dates.ts'
import { findTaggedPolicies } from './generate.ts'
import { observationDaysFor } from './schedule.ts'
import { readyWhen } from '../derive/readyWhen.ts'
import { effectOf } from './operations.ts'
import { scopeCohort } from './strand.ts'
import { engine } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import { advanceState, aggregateObservation, raiseCondition, setState } from './lifecycle.ts'
import type { Lifecycle, MemberObservation, StepState } from './lifecycle.ts'
import { artifactIdOf, historyReset, intentOf, observe, observedStateOf, priorFor, semanticFieldsOf, semanticsOf } from './observation.ts'
import type { ObservedState } from './observation.ts'
import type { ObservationChange, StepObservation, StepObservationRecord } from './observation.ts'

const TRACK = engine.tracking
import type { MemberTracking, PolicyOperation, Step, StepTracking } from './types.ts'

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

/**
 * The member identity of a step that requires at most one policy: the step's own
 * one history, under a key that does not move when a baseline is re-pinned or a
 * goal's verdict flips. Only a step the baseline implements with two or more
 * policies keys its members by the baseline (observation.ts `memberKeyOf`).
 */
export const SOLE_MEMBER = 'sole'

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

const nameKey = (v: string | null | undefined): string => String(v ?? '').trim().toLowerCase()

// ---- the step's required policy members ----

/** One policy the step has to have deployed, before anything is known about the tenant. */
type RequiredMember = {
  key: string
  sourceName: string
  /** The operation that delivers this member; null on a step with no operation of its own. */
  op: PolicyOperation | null
  /** The name the plan gives this member's policy — the only thing that tells a pre-member tag's halves apart. */
  displayName: string | null
}

/** One required member, and the one tenant policy this scan resolved for it. */
export type MemberMatch = RequiredMember & {
  policy: PolicyRow | null
  matchedBy: MemberTracking['matchedBy']
  ambiguous: boolean
}

const nameOfOp = (op: PolicyOperation | null): string | null => {
  if (!op) return null
  const body = op.body as { displayName?: unknown }
  if (typeof body.displayName === 'string' && body.displayName.length > 0) return body.displayName
  const target = (op.target ?? null) as { displayName?: unknown } | null
  return typeof target?.displayName === 'string' && target.displayName.length > 0 ? target.displayName : null
}

/**
 * The policies this step is required to have deployed.
 *
 * A step with one operation, or none at all — a goal already delivered by
 * something the tenant had, which deploys nothing and is tracked by whatever
 * covers it — has one member, keyed `sole` so its history is not tied to a
 * baseline key that a re-pin or a change of verdict would move.
 *
 * A step with two or more takes each member's identity from the baseline
 * (types.ts `PolicyOperation.memberKey`). Neither member is ever the other, and
 * a step is not ready until every one of them is.
 */
export function requiredMembers(step: Step): RequiredMember[] {
  const ops = step.action.resolution?.policies ?? []
  if (ops.length <= 1) {
    const op = ops[0] ?? null
    return [{ key: SOLE_MEMBER, sourceName: op?.sourceName ?? '', op, displayName: nameOfOp(op) }]
  }
  return ops.map((op, i) => ({ key: op.memberKey || `m${i}`, sourceName: op.sourceName, op, displayName: nameOfOp(op) }))
}

/**
 * The tenant policy delivering each required member, at most one each and never
 * one object for two members.
 *
 * The order is exactness, strongest first:
 *
 *  1. the operation's own target. Foundation A settled that association at
 *     generation and refuses to guess a pair, so where an update names a policy
 *     that policy is the member;
 *  2. the member's own plan tag — a policy this plan created, saying which
 *     required policy it is;
 *  3. a plan tag from before members were tagged. It proves the step and not the
 *     member, so on a step with one member it is the member and on a pair it is
 *     admitted only where the policy carries the exact name the plan gives that
 *     member. A leftover the names do not settle leaves every unresolved member
 *     ambiguous rather than handing one of them the first row;
 *  4. the goal's coverage fingerprint, on a step with one member only. A
 *     fingerprint answers which policies deliver the *goal*; it never answers
 *     which half of a pair one of them is.
 *
 * A pair the plan itself could not tell apart (`Action.unmatchedPair`) is not one
 * this can tell apart either: nothing is matched and nothing advances.
 */
export function matchMembers(step: Step, snapshot: TenantSnapshot, coverage: CoverageReport, planId: string): MemberMatch[] {
  const out: MemberMatch[] = requiredMembers(step).map((m) => ({ ...m, policy: null, matchedBy: null, ambiguous: false }))
  const all = rows(snapshot)
  const byId = new Map(all.filter((p) => typeof p.id === 'string').map((p) => [p.id as string, p]))
  if (step.action.unmatchedPair === true) {
    for (const m of out) m.ambiguous = true
    return out
  }
  const claimed = new Set<string>()
  const claim = (m: MemberMatch, policy: PolicyRow, by: MemberTracking['matchedBy']): void => {
    m.policy = policy
    m.matchedBy = by
    claimed.add(policy.id as string)
  }

  // 1. the operation's own target
  for (const m of out) {
    const id = m.op && m.op.mode === 'update' ? m.op.policyId : null
    if (!id || claimed.has(id)) continue
    const policy = byId.get(id)
    if (policy) claim(m, policy, 'operation-target')
  }

  const tagged = findTaggedPolicies(snapshot, planId, step.id)
  // 2. the member's own tag
  for (const m of out) {
    if (m.policy) continue
    const hits = tagged.filter((t) => t.memberKey === m.key && !claimed.has(t.policyId))
    if (hits.length === 1) {
      const policy = byId.get(hits[0].policyId)
      if (policy) claim(m, policy, 'member-tag')
    } else if (hits.length > 1) m.ambiguous = true
  }

  // 3. a tag written before members were tagged
  const sole = out.length === 1
  const untagged = tagged.filter((t) => t.memberKey === null && !claimed.has(t.policyId))
  if (untagged.length > 0) {
    if (sole) {
      const m = out[0]
      const policy = m.policy || m.ambiguous ? undefined : byId.get(untagged[0].policyId)
      if (policy) claim(m, policy, 'step-tag')
    } else {
      for (const m of out) {
        if (m.policy || m.ambiguous) continue
        const want = nameKey(m.displayName)
        if (want.length === 0) continue
        const hits = untagged.filter((t) => !claimed.has(t.policyId) && nameKey(byId.get(t.policyId)?.displayName) === want)
        if (hits.length === 1) claim(m, byId.get(hits[0].policyId) as PolicyRow, 'member-name')
      }
      // A tagged policy nothing accounted for could have been any unresolved
      // member's. Nothing says which, so no member takes it and none of them
      // advances on the strength of what it might have been.
      if (untagged.some((t) => !claimed.has(t.policyId))) for (const m of out) if (!m.policy) m.ambiguous = true
    }
  }

  // 4. the goal's coverage fingerprint, for a step with one member
  if (sole && !out[0].policy && !out[0].ambiguous) {
    const result = coverage.results.find((r) => r.goal.id === step.goalId)
    const candidate =
      result?.candidates.find((c) => c.contribution === 'strong') ??
      result?.candidates.find((c) => c.contribution === 'reportOnly') ??
      result?.candidates.find((c) => c.contribution === 'weak') ??
      null
    const policy = candidate ? byId.get(candidate.policyId) : undefined
    if (policy && !claimed.has(policy.id as string)) claim(out[0], policy, 'fingerprint')
  }
  return out
}

/**
 * The policy delivering a step, where one policy delivers it: the sole required
 * member's artifact. Null on a step the baseline implements with two policies —
 * no single object is that step, and returning Policy A would say it was.
 */
export function matchPolicy(step: Step, snapshot: TenantSnapshot, coverage: CoverageReport, planId: string): { policy: PolicyRow; matchedBy: 'tag' | 'fingerprint' } | null {
  const members = matchMembers(step, snapshot, coverage, planId)
  if (members.length !== 1) return null
  const m = members[0]
  return m.policy ? { policy: m.policy, matchedBy: m.matchedBy === 'fingerprint' ? 'fingerprint' : 'tag' } : null
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

type Gates = Pick<StepTracking, 'daysInReportOnly' | 'readyOn' | 'readyNow' | 'seenInScope' | 'activeInScope' | 'signIns' | 'failures' | 'failuresByUser' | 'evidenceQuality'>

/**
 * The records' verdict on one member's policy, and the two gates on one in
 * report-only (constants.ts OBSERVATION_DAYS): the time gate, ready on `since`
 * plus the step's observation window; the evidence gate, ready now when the
 * records since `since` show zero failures and every active person the *policy*
 * reaches at least once. Whichever comes first. `since` is null for a policy not
 * in report-only.
 *
 * Everything it reads is about the one deployed object it was handed: another
 * member's records are another policy's records, and never reach this.
 */
function gates(
  step: Step,
  policy: PolicyRow,
  snapshot: TenantSnapshot,
  pr: PolicyAppliedResult | undefined,
  since: string | null,
  ctx: TrackingEvidence,
  activeSet: ReadonlySet<string> | null,
): Gates {
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

const noGates = (snapshot: TenantSnapshot): Gates => ({
  daysInReportOnly: 0,
  readyOn: null,
  readyNow: false,
  seenInScope: null,
  activeInScope: null,
  signIns: 0,
  failures: 0,
  failuresByUser: [],
  evidenceQuality: snapshot.sources.signInEvidence?.coveredWindow ? 'thin' : 'none',
})

/** Every step the plan tracks: everything not skipped. The one denominator (ux-review-07 §2). */
export function trackable(steps: Step[]): Step[] {
  return steps.filter((s) => s.status !== 'skipped')
}

/**
 * The observations the plan record keeps (PlanDecisions.observations): what this
 * scan saw of each *required policy member* of each step, so the next scan can
 * say what moved — for that member, and for no other. The one thing a
 * regeneration cannot work out again: a snapshot shows the state now, never when
 * a scan first saw it.
 */
export function observationsOf(steps: Step[]): Record<string, StepObservationRecord> {
  const out: Record<string, StepObservationRecord> = {}
  for (const s of steps) {
    if (s.state.members.length === 0) continue
    const members: Record<string, StepObservation> = {}
    for (const m of s.state.members) members[m.key] = m.change.latest
    // Written in the member shape from here on: a record that had one
    // observation for the whole step has already been attributed, or proved it
    // could not be, at the scan that read it.
    out[s.id] = { members, unattributed: null }
  }
  return out
}

// ---- the aggregate ----

const STAGE: ObservedState[] = ['unknown', 'absent', 'disabled', 'report-only', 'enforced']
const stageRank = (s: ObservedState): number => STAGE.indexOf(s)

const latest = (dates: (string | null)[]): string | null => {
  const known = dates.filter((d): d is string => d !== null)
  return known.length === 0 ? null : known.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a))
}

const sumOrNull = (values: (number | null)[]): number | null => (values.length === 0 || values.some((v) => v === null) ? null : values.reduce((a: number, b) => a + (b as number), 0))

/**
 * The step's one lifecycle, from every required member's, conservatively.
 *
 * Enforced only when all of them are; ready to enforce only when every one is
 * either enforced already or ready on its *own* window and its *own* records;
 * report-only while the whole set is deployed and any of it is still being
 * watched; and not deployed whenever a required member is missing, disabled or
 * unresolved — a pair with one half deployed has not been deployed, whatever the
 * other half has earned.
 */
function aggregateLifecycle(members: readonly MemberTracking[], observed: readonly ObservedState[]): Lifecycle {
  if (members.some((m) => m.ambiguous)) return 'not-deployed'
  const deployed = observed.every((s) => s === 'report-only' || s === 'enforced')
  if (!deployed) return 'not-deployed'
  if (observed.every((s) => s === 'enforced')) return 'enforced'
  const ready = members.every((m, i) => observed[i] === 'enforced' || m.ready)
  return ready ? 'ready-to-enforce' : 'report-only'
}

/**
 * The step's tracking, from its members'. Every aggregate field is derived here
 * and nowhere else, so no surface can read one member's date as the step's.
 *
 * A step with one required member is that member, field for field. A step with
 * two or more names no single policy — `policyId` and `policyName` are null,
 * because Policy A is not what the step is — and takes the conservative reading
 * of everything with a direction: the latest report-only date, the latest ready
 * date, the fewest days watched, the least evidence.
 */
function aggregateTracking(members: MemberTracking[], observed: ObservedState[], snapshot: TenantSnapshot): StepTracking {
  const anyFingerprint = members.some((m) => m.matchedBy === 'fingerprint')
  const matchedBy: StepTracking['matchedBy'] = anyFingerprint ? 'fingerprint' : 'tag'
  const note = matchedBy === 'tag' ? TRACK.matchedByTag : TRACK.matchedByFingerprint
  if (members.length === 1) {
    const m = members[0]
    return {
      members,
      policyId: m.policyId,
      policyName: m.policyName,
      matchedBy,
      note,
      createdAt: m.createdAt,
      modifiedAt: m.modifiedAt,
      state: m.state,
      reportOnlyAt: m.reportOnlyAt,
      reportOnlyAtSource: m.reportOnlyAtSource,
      enforcedAt: m.enforcedAt,
      enforcedAtSource: m.enforcedAtSource,
      regressedAt: null,
      noticedAt: snapshot.asOf,
      daysInReportOnly: m.daysInReportOnly,
      readyOn: m.readyOn,
      readyNow: m.readyNow,
      seenInScope: m.seenInScope,
      activeInScope: m.activeInScope,
      signIns: m.signIns,
      failures: m.failures,
      failuresByUser: m.failuresByUser,
      evidenceQuality: m.evidenceQuality,
    }
  }
  const watched = members.filter((_, i) => observed[i] === 'report-only')
  const deployed = observed.every((s) => s === 'report-only' || s === 'enforced')
  // The pair's state is its least advanced member's: one policy enabled does not
  // make the pair enabled, and one missing makes the pair not deployed.
  const lowest = observed.reduce((a, b) => (stageRank(b) < stageRank(a) ? b : a), 'enforced' as ObservedState)
  const state = members[observed.findIndex((s) => s === lowest)]?.state ?? 'absent'
  // Every member's own ready date, and the pair is not ready until the last of
  // them is. A member that met its evidence gate is ready at this scan, so that
  // is the date it contributes.
  const readyDates = watched.map((m) => (m.readyNow && m.readyOn && Date.parse(m.readyOn) > Date.parse(snapshot.asOf) ? snapshot.asOf : m.readyOn))
  const readyOn = deployed && watched.length > 0 && !readyDates.some((d) => d === null) ? latest(readyDates) : null
  const reportOnlyAt = deployed && watched.length > 0 ? latest(watched.map((m) => m.reportOnlyAt)) : null
  const source = watched.find((m) => m.reportOnlyAt === reportOnlyAt)?.reportOnlyAtSource ?? null
  const enforcedAt = observed.every((x) => x === 'enforced') ? latest(members.map((m) => m.enforcedAt)) : null
  return {
    members,
    // No one object is this step. A surface that needs a policy reads the member.
    policyId: null,
    policyName: null,
    matchedBy,
    note,
    createdAt: null,
    modifiedAt: null,
    state,
    reportOnlyAt,
    reportOnlyAtSource: reportOnlyAt === null ? null : source,
    // The pair is enforced when the last of its members is, and not before; the
    // date is that member's, and so is what it says about where it came from.
    enforcedAt,
    enforcedAtSource: members.find((m) => m.enforcedAt === enforcedAt)?.enforcedAtSource ?? null,
    regressedAt: null,
    noticedAt: snapshot.asOf,
    // The shortest window any member has served: what the pair has been watched for.
    daysInReportOnly: watched.length > 0 ? Math.min(...watched.map((m) => m.daysInReportOnly)) : 0,
    readyOn,
    // The evidence gate is the pair's only when it is met on every member's own records.
    readyNow: watched.length > 0 && watched.every((m) => m.readyNow),
    seenInScope: sumOrNull(watched.map((m) => m.seenInScope)),
    activeInScope: sumOrNull(watched.map((m) => m.activeInScope)),
    signIns: members.reduce((n, m) => n + m.signIns, 0),
    failures: members.reduce((n, m) => n + m.failures, 0),
    failuresByUser: members.flatMap((m) => m.failuresByUser),
    evidenceQuality: members.some((m) => m.evidenceQuality === 'none') ? 'none' : members.some((m) => m.evidenceQuality === 'thin') ? 'thin' : 'enough',
  }
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
  observations: Record<string, StepObservationRecord> = {},
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
    const matches = matchMembers(step, snapshot, coverage, planId)
    const sole = matches.length === 1
    const record = observations[step.id] ?? null
    const carried = step.tracking

    // ---- What this scan saw of each member, against what the last one saw of
    // that same member ----
    // Recorded for every required policy, including the ones with nothing there
    // yet: "not deployed" is an observation, a policy that appears between two
    // scans is a change somebody made, and a member with no object is a member
    // whose half of the step has not been deployed.
    const observed: ObservedState[] = []
    const memberObservations: MemberObservation[] = []
    const memberTracking: MemberTracking[] = []
    for (const m of matches) {
      const policyRow = m.policy
      const pr = policyRow ? snapshot.evidencePolicyResults.find((p) => p.policyId === policyRow.id) : undefined
      const observedState = observedStateOf(policyRow?.state ?? null)
      const artifact = artifactIdOf(policyRow?.id)
      const change = observe(priorFor(record, m.key, artifact, sole), {
        // Which object this scan saw. The step id says which row of the plan this
        // is; it never says which policy is delivering it, and the two were being
        // asked to do one job (observation.ts artifactIdOf).
        artifact,
        state: observedState,
        semantics: semanticsOf(policyRow as Record<string, unknown> | null),
        // The same policy dimension by dimension, so a movement can be attributed
        // to the part that moved rather than to the policy as a whole.
        fields: semanticFieldsOf(policyRow as Record<string, unknown> | null),
        at: snapshot.asOf,
        // The one transition a tenant can prove: a sign-in evaluated under the
        // policy in report-only says it was in report-only that day.
        evidenceAt: observedState === 'report-only' ? pr?.firstReportOnlyAt ?? null : null,
        // *This* member's operation, and never another's. Comparing Policy B's
        // movement against Policy A's patch could call an unexpected rewrite
        // expected, or manufacture a review against a change nobody submitted.
        intent: m.op ? intentOf(m.op.body) : null,
      })
      observed.push(observedState)
      memberObservations.push({ key: m.key, sourceName: m.sourceName, change })

      const inReportOnlySince = observedState === 'report-only' ? reportOnlySince(change) : null
      const memberGates = policyRow ? gates(step, policyRow, snapshot, pr, inReportOnlySince?.at ?? null, scopeEvidence, activeSet) : noGates(snapshot)
      const state = policyRow ? policyRow.state ?? 'unknown' : 'absent'
      const modifiedAt = policyRow?.modifiedDateTime ?? null
      const createdAt = policyRow?.createdDateTime ?? null
      // A policy's own stamps date the object, never the moment it began to
      // enforce; a value carried from an earlier scan is older still. The source
      // says which, so nothing downstream reads it as a proven transition.
      const previous = carried?.members?.find((x) => x.key === m.key)?.enforcedAt ?? (sole ? carried?.enforcedAt ?? null : null)
      const enforced: { at: string | null; source: MemberTracking['enforcedAtSource'] } =
        state === 'enabled'
          ? modifiedAt
            ? { at: modifiedAt, source: 'policy-modified' }
            : createdAt
              ? { at: createdAt, source: 'policy-created' }
              : { at: null, source: null }
          : previous
            ? { at: previous, source: 'carried-forward' }
            : { at: null, source: null }
      // A member is ready on its own window and its own records, and on nothing
      // anybody else has earned. A policy this scan found rewritten has been
      // watched for nothing, so it is ready on neither gate however clean the
      // records look; what may still open a gate is Microsoft's own evidence
      // about the object deployed *now* (observation.ts historyReset, admit).
      const usable = !(historyReset(change) && change.latest.evidenceAt === null)
      const timeGate = memberGates.readyOn !== null && Date.parse(memberGates.readyOn) <= Date.parse(snapshot.asOf)
      const ready = observedState === 'report-only' && !m.ambiguous && usable && (memberGates.readyNow || timeGate)
      memberTracking.push({
        key: m.key,
        sourceName: m.sourceName,
        policyId: policyRow?.id ?? null,
        policyName: policyRow?.displayName ?? null,
        matchedBy: m.matchedBy,
        ambiguous: m.ambiguous,
        lifecycle: m.ambiguous ? 'not-deployed' : observedState === 'enforced' ? 'enforced' : observedState === 'report-only' ? (ready ? 'ready-to-enforce' : 'report-only') : 'not-deployed',
        state,
        createdAt,
        modifiedAt,
        reportOnlyAt: inReportOnlySince?.at ?? null,
        reportOnlyAtSource: inReportOnlySince?.source ?? null,
        enforcedAt: enforced.at,
        enforcedAtSource: enforced.source,
        ready,
        reviewRequired: change.reviewRequired,
        ...memberGates,
      })
    }
    // `observation` is the step's one line, derived from the members and never
    // assigned beside them (lifecycle.ts aggregateObservation).
    setState(step, { members: memberObservations, observation: aggregateObservation(memberObservations) })

    const lifecycle = aggregateLifecycle(memberTracking, observed)
    advanceState(step, { lifecycle: lifecycle === 'ready-to-enforce' ? 'report-only' : lifecycle })
    // A person looks when what a policy *means* is now something the plan did
    // not ask for — on any member, and a healthy other half does not settle it.
    // Not when the window merely restarts: a policy replaced by a different
    // object that means the same thing, or by exactly the one the plan meant to
    // create, has changed nothing for anybody to decide, and raising review for
    // it put a healthy rollout into a condition it was not in (observation.ts
    // reviewRequired, kept apart from continuity).
    if (memberTracking.some((m) => m.reviewRequired)) raiseCondition(step, 'review-required')

    const since = step.history.at(-1)?.at ?? snapshot.asOf
    const sinceText = absoluteDate(since)
    const wasDone = step.status === 'done'
    // Every object the last scan recorded for this step, whichever member it was.
    const previousIds = carried ? (carried.members?.length ? carried.members.map((m) => m.policyId) : [carried.policyId]).filter((id): id is string => typeof id === 'string' && id.length > 0) : []
    const previousName = carried?.policyName ?? carried?.members?.find((m) => m.policyName)?.policyName ?? step.deliveredBy[0]?.replace(/ \([^)]*\)$/, '') ?? step.title

    // ---- Regressions (§5): reopen with a dated note ----
    if (wasDone) {
      const all = rows(snapshot)
      const still = previousIds.map((id) => all.find((p) => p.id === id) ?? null)
      // Any member's policy gone is the step's change no longer deployed.
      if (previousIds.length > 0 && still.some((p) => p === null)) {
        reopen(step, fillText(TRACK.regression.deleted, { name: previousName, since: sinceText }), now, 'create')
        step.tracking = null
        continue
      }
      const prev = still.find((p) => p !== null) ?? null
      const disabled = still.find((p) => p?.state === 'disabled') ?? null
      if (disabled) {
        reopen(step, fillText(TRACK.regression.disabled, { name: disabled.displayName ?? previousName, since: sinceText }), now, 'adjust')
      } else if (goalStatus === 'absent') {
        reopen(step, fillText(TRACK.regression.goal, { since: sinceText, what: 'missing' }), now, 'create')
      } else if (goalStatus === 'below-baseline') {
        reopen(step, fillText(TRACK.regression.weakened, { name: prev?.displayName ?? previousName, since: sinceText }), now, 'adjust')
      } else if (goalStatus === 'partial') {
        const narrowed = (result?.reasons ?? []).some((r) => !r.expected && (r.kind === 'not-targeted' || r.kind === 'excluded'))
        reopen(step, narrowed ? fillText(TRACK.regression.narrowed, { name: prev?.displayName ?? previousName, since: sinceText }) : fillText(TRACK.regression.goal, { since: sinceText, what: 'partly in place' }), now, 'adjust')
      }
      if (step.status !== 'done') {
        if (step.tracking) step.tracking = { ...step.tracking, state: disabled?.state ?? prev?.state ?? 'deleted', regressedAt: now }
        continue
      }
    }

    if (!memberTracking.some((m) => m.policyId !== null)) {
      if (result?.verdict === 'inPlace') {
        advance(step, { satisfied: true, inPlace: true }, fillText(TRACK.enforcedByOther, { name: result?.candidates.find((c) => c.contribution === 'strong')?.policyName ?? 'an existing policy' }), now)
      }
      continue
    }
    const tracking = aggregateTracking(memberTracking, observed, snapshot)
    step.tracking = tracking
    const first = matches.find((m) => m.policy)?.policy as PolicyRow
    const includesAll = (first.conditions?.users?.includeUsers ?? []).some((u) => /^(All|GuestsOrExternalUsers)$/i.test(u))

    // ---- Rings: actual dates from what the policy shows ----
    if (lifecycle === 'enforced' && step.rings.length > 0) {
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
    if (lifecycle === 'enforced') {
      // A step is done if and only if its goal's verdict is inPlace (target-state
      // §8.2, prompt 46 item 9). This used to advance on the policy's state
      // alone, so a policy that was on but short of the baseline made its step
      // done while Findings said partly: "Admin sessions expire quickly" was
      // done on the Plan and partly in place on Findings, and the demo tenant
      // counted 11 in place against 6. An enabled policy behind a partly goal
      // is a change step whose object already exists, never a finished one.
      //
      // On a pair, `enforced` already means every required member is enforced:
      // one enforced policy has never finished a two-policy goal.
      if (result?.verdict === 'inPlace') {
        advance(step, { satisfied: true }, `${fillText(TRACK.enforced, { date: absoluteDate(tracking.enforcedAt ?? now) })}; ${tracking.note}`, now)
      }
      continue
    }
    if ((lifecycle === 'report-only' || lifecycle === 'ready-to-enforce') && tracking.reportOnlyAt) {
      advance(step, { lifecycle: 'report-only' }, `${fillText(TRACK.reportOnlyFound, { date: absoluteDate(tracking.reportOnlyAt) })}; ${tracking.note}`, now)
      // Ready to enforce only when every required member is: each one enforced
      // already, or through its own gate on its own records. One member's clean
      // window has never been another's, and the note names whichever gate the
      // last of them came through.
      if (lifecycle === 'ready-to-enforce') {
        const ready = readyWhen(step)
        if (ready?.kind === 'now') advance(step, { lifecycle: 'ready-to-enforce' }, fillText(TRACK.readyNow, { n: ready.days }), now)
        else if (ready) advance(step, { lifecycle: 'ready-to-enforce' }, fillText(TRACK.readySince, { date: absoluteDate(ready.date) }), now)
      }
      continue
    }
    // Delivered by something the tenant already had, with the step's own policy
    // not enforced: a preservation result. On a step the baseline implements with
    // two policies it is admitted only where every required member is enforced —
    // one half of a pair has never finished a two-policy goal, whatever the
    // coverage of the goal as a whole adds up to.
    if (goalStatus === 'enforced' && (memberTracking.length === 1 || observed.every((x) => x === 'enforced'))) {
      advance(step, { satisfied: true, inPlace: true }, fillText(TRACK.enforcedByOther, { name: first.displayName ?? step.title }), now)
    }
  }
  return steps
}
