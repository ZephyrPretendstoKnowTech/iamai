// Execution tracking (roadmap-v2.md §5): what actually happened, from
// evidence. Policies match a step by plan tag first, then by intent
// fingerprint; dates come from the policy; a report-only policy's readiness
// to enforce from both of its gates — the window the plan asked for *and* the
// sign-in records over it, never one of them; regressions reopen done
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
import type { CoverageReport, GoalResult } from '../coverage/types.ts'
import { list } from '../copy/statements.ts'
import { holdOf, isHeld } from './holds.ts'
import type { PolicyAppliedResult, TenantSnapshot } from '../graph/collect/types.ts'
import { absoluteDate } from '../copy/dates.ts'
import { findTaggedPolicies } from './generate.ts'
import { inBaselineConflict } from './baselineConflict.ts'
import { observationDaysFor } from './schedule.ts'
import { readyBasis, readyWhen } from '../derive/readyWhen.ts'
import { effectOf } from './operations.ts'
import { evidenceStrategyOf } from './evidenceStrategy.ts'
import { scopeCohort } from './strand.ts'
import { engine } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import { advanceState, aggregateObservation, raiseCondition, setState } from './lifecycle.ts'
import type { Lifecycle, MemberObservation, StepState } from './lifecycle.ts'
import { artifactIdOf, historyReset, intentOf, observe, observedStateOf, priorFor, semanticFieldsOf, semanticsOf } from './observation.ts'
import type { ObservedState } from './observation.ts'
import type { ObservationChange, StepObservation, StepObservationRecord } from './observation.ts'

const TRACK = engine.tracking
import type { CorrectionSafety, MemberTracking, PolicyOperation, Step, StepTracking } from './types.ts'

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
/**
 * The outcome classes the evidence gate on a policy *in report-only* may count.
 *
 * A report-only record exists only while the policy is reporting, and that is
 * the whole of what the gate asks about: has this policy, while it was only
 * watching, produced records for everybody it reaches, none of them failing. An
 * enforced record was produced by a different state of the same object, outside
 * the window `since` opens, and it answers no part of that question. Counting
 * them let a policy an operator turned on and then moved back to report-only
 * inherit its own history: last month's enforced successes completed this
 * month's coverage, and the step offered the enforcement again over a window
 * nobody had watched.
 */
const REPORT_ONLY_RESULTS = ['reportOnlyFailure', 'reportOnlyInterrupted', 'reportOnlySuccess'] as const
/** Every class, for a policy that is not in report-only: the post-enforcement watch reads its enforced records. */
const ALL_RESULTS = [...REPORT_ONLY_RESULTS, 'enforcedFailure', 'enforcedSuccess'] as const
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
 *  0. the member's own record of the last scan (`record`, observation.ts). It
 *     names the very object the member was delivered by, and the association
 *     is kept for as long as that object is on the tenant: once a policy is a
 *     member's, a drift in it never erases the tie or hands the member to
 *     another candidate — however the object's grant, scope or state moved, and
 *     whichever candidate a regeneration would now prefer. The tie is reported
 *     by the strongest proof this scan still holds for it (the operation's
 *     target, a tag), and as `owned` where the record is the only thing that
 *     proves it;
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
export function matchMembers(step: Step, snapshot: TenantSnapshot, coverage: CoverageReport, planId: string, record: StepObservationRecord | null = null): MemberMatch[] {
  const out: MemberMatch[] = requiredMembers(step).map((m) => ({ ...m, policy: null, matchedBy: null, ambiguous: false }))
  const all = rows(snapshot)
  const byId = new Map(all.filter((p) => typeof p.id === 'string').map((p) => [p.id as string, p]))
  const claimed = new Set<string>()
  const claim = (m: MemberMatch, policy: PolicyRow, by: MemberTracking['matchedBy']): void => {
    m.policy = policy
    m.matchedBy = by
    claimed.add(policy.id as string)
  }
  const tagged = findTaggedPolicies(snapshot, planId, step.id)
  const sole = out.length === 1

  // 0. the member's own record of the last scan: the object it was delivered
  // by, kept while that object is on the tenant. A pre-member record is the
  // sole member's own; on a pair it is attributed only where identity proves it
  // (observation.ts priorFor), and here the identity to prove is the object
  // itself, so the record is read for its members alone.
  for (const m of out) {
    const artifact = (record?.members[m.key] ?? (sole ? record?.unattributed : null))?.artifact ?? null
    if (artifact === null) continue
    const policy = all.find((p) => artifactIdOf(p.id) === artifact)
    if (!policy || claimed.has(policy.id as string)) continue
    // The strongest proof this scan still holds for the tie, else the record.
    const by: MemberTracking['matchedBy'] =
      m.op && m.op.mode === 'update' && m.op.policyId === policy.id
        ? 'operation-target'
        : tagged.some((t) => t.policyId === policy.id && t.memberKey === m.key)
          ? 'member-tag'
          : sole && tagged.some((t) => t.policyId === policy.id && t.memberKey === null)
            ? 'step-tag'
            : 'owned'
    claim(m, policy, by)
  }

  if (step.action.unmatchedPair === true) {
    for (const m of out) if (!m.policy) m.ambiguous = true
    return out
  }

  // 1. the operation's own target
  for (const m of out) {
    if (m.policy) continue
    const id = m.op && m.op.mode === 'update' ? m.op.policyId : null
    if (!id || claimed.has(id)) continue
    const policy = byId.get(id)
    if (policy) claim(m, policy, 'operation-target')
  }

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
export function matchPolicy(step: Step, snapshot: TenantSnapshot, coverage: CoverageReport, planId: string, record: StepObservationRecord | null = null): { policy: PolicyRow; matchedBy: StepTracking['matchedBy'] } | null {
  const members = matchMembers(step, snapshot, coverage, planId, record)
  if (members.length !== 1) return null
  const m = members[0]
  return m.policy ? { policy: m.policy, matchedBy: m.matchedBy === 'fingerprint' ? 'fingerprint' : m.matchedBy === 'owned' ? 'owned' : 'tag' } : null
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
 * Never empty where the answer is not empty, and never a fallback. There are
 * three answers, and the difference between the last two is what decides whether
 * the evidence gate has a coverage question to ask at all:
 *
 *   * `people` — the active accounts this policy reaches, settled;
 *   * `uncountable` — the policy's scope names kinds of external user
 *     (`otherExternalUser` and its siblings), which is a class rather than a set.
 *     Everything else about the scope read cleanly; what is missing is a census
 *     this directory cannot take of anybody, on this scan or any later one. The
 *     evidence gate has no coverage question it can ask, so it cannot close, and
 *     the step stays in report-only however long the window runs (`gates`);
 *   * `unknown` — something that says who this policy reaches was not read: a
 *     group nothing says who is in, a clause IAMAI could not parse, or no list
 *     of active people at all. A later scan can settle it.
 *
 * The two used to be one null. They are not the same fact and they must not open
 * the same door: an unread group is a gap in this scan, and a gap in a scan is
 * never a pass.
 */
type TrackedScope = { kind: 'people'; ids: string[] } | { kind: 'uncountable' } | { kind: 'unknown' }

function trackedScope(policy: PolicyRow, snapshot: TenantSnapshot, ctx: TrackingEvidence, active: ReadonlySet<string> | null): TrackedScope {
  if (active === null) return { kind: 'unknown' }
  const effect = effectOf(policy as Record<string, unknown>)
  const everyone = snapshot.users.map((u) => u.id)
  const cohort = (e: typeof effect): string[] | null => scopeCohort([e], everyone, snapshot, { groupMembers: ctx.groupMembers })
  const named = cohort(effect)
  if (named !== null) return { kind: 'people', ids: named.filter((id) => active.has(id)) }
  // No list. Which of the two reasons it is, asked of the policy itself: take the
  // guest clauses out and see whether what remains resolves. If it does, the
  // external class was the only thing standing between this scan and a count; if
  // it does not, something readable is still missing and the answer stays unknown.
  if (effect.scope.guests.include === null && effect.scope.guests.exclude === null) return { kind: 'unknown' }
  const bounded = cohort({ ...effect, scope: { ...effect.scope, guests: { include: null, exclude: null } } })
  return bounded === null ? { kind: 'unknown' } : { kind: 'uncountable' }
}

type Gates = Pick<StepTracking, 'daysInReportOnly' | 'readyOn' | 'readyNow' | 'windowRead' | 'seenInScope' | 'activeInScope' | 'signIns' | 'failures' | 'failuresByUser' | 'evidenceQuality' | 'evidenceStrategy'>

/**
 * Whether the sign-in collection provably reaches across `from` to this scan, so
 * that a clean reading of that stretch is a reading of the whole of it.
 *
 * The collection states its own interval (`coveredWindow`), and it is honest
 * about it: a run that stopped early reports the contiguous stretch it did read,
 * ending at the scan, not the stretch it was asked for. So the question is
 * containment, and not a status word alone:
 *
 *   * it has to start at or before `from`, or the beginning of the stretch was
 *     never read. Clean records over the last two days of a seven-day window are
 *     clean records for two days, which is the reading the time gate exists to
 *     refuse;
 *   * it has to run to this scan's own day, or the end was never read either.
 *     Below a day is the scan's own duration — Lane B dates its window when it
 *     starts and the snapshot is stamped when every lane has finished — and the
 *     gate counts by UTC day, so the day is the resolution the question is asked
 *     at.
 *
 * A source that read nothing, or read too little to say what it covered, states
 * no interval and contains nothing. Unknown is not a passed gate.
 */
function windowCollected(snapshot: TenantSnapshot, from: string): boolean {
  const src = snapshot.sources.signInEvidence
  if (!src || (src.status !== 'ok' && src.status !== 'partial')) return false
  const covered = src.coveredWindow
  if (!covered) return false
  return Date.parse(covered.from) <= Date.parse(from) && covered.to.slice(0, 10) >= snapshot.asOf.slice(0, 10)
}

/**
 * The records' verdict on one member's policy, and the two gates on one in
 * report-only (constants.ts OBSERVATION_DAYS): the time gate, closed on `since`
 * plus the step's observation window; the evidence gate, closed when the records
 * since `since` show zero failures and every active person the *policy* reaches
 * at least once. `since` is null for a policy not in report-only.
 *
 * **Both**, and `readyNow` is that conjunction. The gates used to be alternatives
 * — "whichever comes first" — and each of them alone says something the other
 * has to supply:
 *
 *   * the time gate is a calendar fact. A week passing is not evidence about
 *     anybody, so on its own it made a policy with twelve failing sign-ins, or
 *     with no records read at all, Ready to enforce — and Foundation A then
 *     handed over the update that enforces it the moment it lands. That is
 *     unknown, and failure, converted into readiness by nothing but time.
 *   * the evidence gate is a reading of a window the plan has not finished
 *     watching. Clean records on day two are clean records for two days; the
 *     observation window is the plan's own statement of how long a tenant has to
 *     be watched before that reading means anything.
 *
 * So neither opens this on its own, and unknown never opens the evidence half:
 * no records read is `failures === null`, which is not zero (see below).
 *
 * And what the evidence half reads has to be *this* window's records, over the
 * whole of it. A `PolicyAppliedResult` is a set of totals over whatever the
 * collection managed to cover, which is a different interval from the one the
 * gate is judging, and two things follow from the difference:
 *
 *   * the collection has to reach across the window. A tenant whose sign-in log
 *     read stopped short covers the last two days of a seven-day window, and
 *     clean records over the part that was read say nothing about the part that
 *     was not — the people missing from it, or the failures in it, are exactly
 *     what the window was opened to find (`windowCollected`);
 *   * the records credited have to be inside it. A policy the tenant enforced
 *     and moved back to report-only has report-only records from the earlier
 *     episode in the same totals, and a policy left reporting for forty-five
 *     days has forty-five days of them; either way the ones outside the window
 *     paid for a stretch they were never watched over — a tenant that went
 *     quiet a month ago is not a tenant whose last seven days are clean. Only
 *     the dated view can separate them (collect/types.ts `reportOnlyDated`),
 *     and where a result has no dated view nothing about it is attributable, so
 *     nothing about it passes.
 *
 * Everything it reads is about the one deployed object it was handed: another
 * member's records are another policy's records, and never reach this.
 */
export function gates(
  step: Step,
  policy: PolicyRow,
  snapshot: TenantSnapshot,
  pr: PolicyAppliedResult | undefined,
  since: string | null,
  ctx: TrackingEvidence,
  activeSet: ReadonlySet<string> | null,
): Gates {
  const covered = snapshot.sources.signInEvidence?.coveredWindow ?? null
  const scope = trackedScope(policy, snapshot, ctx, activeSet)
  const active = scope.kind === 'people' ? scope.ids : null
  const daysInReportOnly = since ? daysBetween(since, snapshot.asOf) : 0
  // A User Action policy (roadmap/evidenceStrategy.ts). Microsoft does not
  // evaluate it in report-only, so there is no window of its records to wait
  // for and no count of them to state: `signIns` is none and `failures` is
  // unknown, never zero. Its readiness is its configuration — the object in
  // report-only, holding what the plan asked for, with nothing holding the step
  // — and every one of those is the caller's (trackExecution: `asPlanned`, the
  // review, `isHeld`). Here it is only "in report-only". What Microsoft cannot
  // show about it gates the enforcement action, not this stage.
  if (evidenceStrategyOf(policy) === 'configuration') {
    return { daysInReportOnly, readyOn: since, readyNow: since !== null, windowRead: false, seenInScope: null, activeInScope: active?.length ?? null, signIns: 0, failures: null, failuresByUser: [], evidenceQuality: 'none', evidenceStrategy: 'configuration' }
  }
  const observationDays = observationDaysFor(step)
  const readyOn = since ? new Date(Date.parse(since) + observationDays * DAY).toISOString() : null
  // The stretch the records have to be a complete reading of: the step's own
  // observation window, ending at this scan, and never reaching back before the
  // policy went into report-only. It is the window and not the whole episode
  // because the window is what the plan asked for — a policy somebody left
  // reporting for a year is being judged on the week behind it, which is the
  // week the sign-in log still holds (collect/constants.ts EVIDENCE_WINDOW_DAYS
  // is longer than any observation window, and shorter than some episodes).
  const readFrom = since === null ? null : new Date(Math.max(Date.parse(since), Date.parse(snapshot.asOf) - observationDays * DAY)).toISOString()
  // The time gate, as a verdict rather than a date: the step's own observation
  // window has been served by this policy. Half of `readyNow`, and never the
  // whole of it.
  const windowClosed = readyOn !== null && Date.parse(readyOn) <= Date.parse(snapshot.asOf)
  // No result for this policy at all: nothing was read about it, so there is no
  // failure count. A zero here is the shape of an empty set, not a clean window,
  // and every line under it reads "0 failing or interrupted" exactly as it reads
  // a zero twenty-four records prove (types.ts StepTracking.failures).
  //
  // The collection may still have read across the window, though: what it holds
  // no record of is this policy. Those are two different facts and the line
  // beside them says which one it is, so a window that was read is reported as
  // read even where nothing in it is about this object.
  if (!pr) return { daysInReportOnly, readyOn, readyNow: false, windowRead: readFrom !== null && windowCollected(snapshot, readFrom), seenInScope: active === null ? null : 0, activeInScope: active?.length ?? null, signIns: 0, failures: null, failuresByUser: [], evidenceQuality: covered ? 'thin' : 'none' }
  const c = pr.counts
  // Which of this policy's records answer the question being asked of it. In
  // report-only, only the records it made in report-only do (REPORT_ONLY_RESULTS);
  // the enforced ones are the same object in the state this gate exists to earn,
  // and they may not pay for it.
  const judged = since === null ? ALL_RESULTS : REPORT_ONLY_RESULTS
  // And which of *those* fall inside the window being judged. The totals cover
  // the whole collection; the dated view is the only thing that can say which of
  // them this window holds, so where a result carries one the counts below are
  // the window's own, and where it does not nothing about it is attributable to
  // a window and the gate cannot open on it (see the header).
  const dated = since === null ? null : (pr.reportOnlyDated ?? null)
  const sinceDay = since ? since.slice(0, 10) : null
  // The window, as the day the records are dated by. `readFrom` is an instant
  // and a record is a day, so the gate asks the question at the resolution the
  // answer exists at: the day the window opens on, and every day after it.
  const readFromDay = readFrom === null ? null : readFrom.slice(0, 10)
  // Whether what follows is a reading of the window at all: records this scan
  // can place in it, over a collection that reaches across it.
  const windowRead = readFrom !== null && dated !== null && windowCollected(snapshot, readFrom)
  // Credit is counted over the window, not over the episode. `windowRead` proves
  // the collection reached across the last `observationDays`; a record older
  // than that is outside the stretch that proof is about, so crediting it would
  // pay for a window on evidence from a week the gate never claimed to have
  // read. A policy reporting for forty-five days under a seven-day window is
  // judged on those seven days, in both halves of the evidence gate.
  const signIns = dated && readFromDay ? dated.signInsByDay.reduce((n, d) => (d.day >= readFromDay ? n + d.signIns : n), 0) : judged.reduce((n, k) => n + c[k], 0)
  // Failing or interrupted records since `since`: by day where the snapshot
  // carries days; the window's totals where it does not (or there is no since).
  // Failure is never discounted the way credit is — an enforced failure this
  // snapshot cannot date could have happened inside the window, so it counts
  // against the gate on either path. Nothing here can turn a failure into a pass.
  //
  // Which is why this one interval is the episode and not the window: the
  // narrowing above exists to stop old records paying for a window they were
  // never watched over, and applying it here would do the opposite — retire a
  // failure by waiting out the days it happened on. A person the policy would
  // have blocked is a fact about the policy, not about the week; the gate keeps
  // counting it until the tenant resolves it.
  const failures =
    pr.byDay && sinceDay
      ? Object.entries(pr.byDay).reduce((n, [day, d]) => (day >= sinceDay ? n + d.failures : n), 0)
      : c.reportOnlyFailure + c.reportOnlyInterrupted + c.enforcedFailure
  const byUser = new Map<string, number>()
  for (const id of [...pr.affectedUserIds.reportOnlyFailure, ...pr.affectedUserIds.reportOnlyInterrupted, ...pr.affectedUserIds.enforcedFailure]) byUser.set(id, (byUser.get(id) ?? 0) + 1)
  // A record of this policy for a person is that person seen — a record of the
  // state the gate is judging, and no other.
  const seen = dated && readFromDay ? new Set(Object.entries(dated.lastSeenByUser).filter(([, day]) => day >= readFromDay).map(([id]) => id)) : new Set(judged.flatMap((k) => pr.affectedUserIds[k] ?? []))
  const seenInScope = active === null ? null : active.filter((id) => seen.has(id)).length
  return {
    daysInReportOnly,
    readyOn,
    // Both gates on this member's own policy.
    //
    // Records of *this* policy over its own window, and none of them failing, is
    // asked of every policy and is never inferred: `signIns > 0` because an empty
    // set is not a clean window, and `failures === 0` because unknown (`null`) is
    // not zero. On top of that, every active person the policy reaches seen at
    // least once — a question that needs a scope which is a list, and so is asked
    // of the three answers `trackedScope` gives in the three ways they deserve:
    //
    //   * `people`: all of them, seen. The ordinary case, and the only one that
    //     can answer the question the gate asks;
    //   * `uncountable`: there is no census to take of an external class, so
    //     there is no such thing as everybody having been seen, and no number of
    //     records is that proof. A count of records was tried here in place of
    //     it, and a count of records is a different fact: twenty clean sign-ins
    //     by the same three guests say nothing about the fourth, and the stage
    //     they bought handed over the update that enforces the policy. So it does
    //     not pass — the step stays in report-only, IAMAI offers no enforcement,
    //     and an operator who decides to turn the policy on does it in the portal
    //     as their own decision rather than on evidence IAMAI does not have;
    //   * `unknown`: nothing passes. Something a later scan can read is missing,
    //     and a gap in a scan is not a pass.
    //
    // What none of the three does is let time, or a tally, stand in for evidence.
    //
    // And all of it over records that are about this window and cover the whole
    // of it: `dated` because a total is not attributable to an interval, and
    // `windowCollected` because a reading of part of a window is not a reading
    // of the window.
    readyNow: windowClosed && since !== null && windowRead && signIns > 0 && failures === 0 && scope.kind === 'people' && seenInScope === scope.ids.length,
    windowRead,
    seenInScope,
    activeInScope: active?.length ?? null,
    signIns,
    // A result whose window holds no record of this policy is the same empty set
    // as no result at all: a zero nothing was counted for says nothing, and only
    // records make a count. A failure the window cannot date is still a failure
    // and is still shown — nothing here discounts one. And a zero over a window
    // the collection did not read across is a zero for the part that was read,
    // which is not the fact the line beside it states, so that is unknown too.
    failures: since !== null && !windowRead ? null : failures === 0 && signIns === 0 ? null : failures,
    failuresByUser: [...byUser.entries()].map(([userId, n]) => ({ userId, count: n })).sort((a, b) => b.count - a.count),
    evidenceQuality: signIns >= MIN_SIGNINS_TO_JUDGE ? 'enough' : signIns > 0 ? 'thin' : 'none',
  }
}

const noGates = (snapshot: TenantSnapshot): Gates => ({
  daysInReportOnly: 0,
  readyOn: null,
  readyNow: false,
  windowRead: false,
  seenInScope: null,
  activeInScope: null,
  signIns: 0,
  failures: null,
  failuresByUser: [],
  evidenceQuality: snapshot.sources.signInEvidence?.coveredWindow ? 'thin' : 'none',
})

/** Every step the plan tracks: everything not skipped. The one denominator (ux-review-07 §2). */
export function trackable(steps: Step[]): Step[] {
  return steps.filter((s) => s.status !== 'skipped')
}

/**
 * The observations the plan record keeps (PlanDecisions.observations) after this
 * scan: what this scan saw of each *required policy member* of each step, over
 * whatever the record already held. The one thing a regeneration cannot work out
 * again — a snapshot shows the state now, never when a scan first saw it — so it
 * is also the one thing a scan may only ADD to.
 *
 * `prior` is what the record carried into this scan, and passing it is what
 * makes this an update rather than a replacement. A scan does not derive a step
 * for every goal: a goal whose coverage this scan could not settle produces no
 * step at all (generate.ts skips an `unknown` result), and one failed group read
 * is enough to do that to every goal whose policies name that group. Rebuilding
 * the block from the current plan therefore DELETED the rollout history of every
 * goal this scan could not assess — and the next scan that could assess it again
 * saw the deployed policy for the first time, restarted its report-only window
 * from that day, and moved "in report-only since" forward by however long the
 * read had been failing. A transient failure to read one group is not evidence
 * about a policy, and silence is not a deletion.
 *
 * What a step this scan DID derive holds is this scan's own reading, entire: its
 * required members are the ones the baseline asks for now, so a member the plan
 * no longer has is not a member whose history is being lost.
 *
 * Carrying a record forward is safe in the direction that matters. Nothing reads
 * it except `priorFor`, and only for a step the plan holds; and what it hands
 * over is then put through `observe`, which asks whether the object it names is
 * the object deployed now (observation.ts `artifactIdOf`) before any window
 * carries. A record about an object that is no longer there resets; a record
 * about the object still there is the history it always was.
 */
export function observationsOf(steps: Step[], prior: Record<string, StepObservationRecord> | null = null): Record<string, StepObservationRecord> {
  const out: Record<string, StepObservationRecord> = { ...(prior ?? {}) }
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
  const anyOwned = members.some((m) => m.matchedBy === 'owned')
  const matchedBy: StepTracking['matchedBy'] = anyFingerprint ? 'fingerprint' : anyOwned ? 'owned' : 'tag'
  const note = matchedBy === 'tag' ? TRACK.matchedByTag : matchedBy === 'owned' ? TRACK.matchedByRecord : TRACK.matchedByFingerprint
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
      windowRead: m.windowRead,
      seenInScope: m.seenInScope,
      activeInScope: m.activeInScope,
      signIns: m.signIns,
      failures: m.failures,
      failuresByUser: m.failuresByUser,
      evidenceQuality: m.evidenceQuality,
      ...(m.evidenceStrategy ? { evidenceStrategy: m.evidenceStrategy } : {}),
    }
  }
  const watched = members.filter((_, i) => observed[i] === 'report-only')
  const deployed = observed.every((s) => s === 'report-only' || s === 'enforced')
  // The pair's state is its least advanced member's: one policy enabled does not
  // make the pair enabled, and one missing makes the pair not deployed.
  const lowest = observed.reduce((a, b) => (stageRank(b) < stageRank(a) ? b : a), 'enforced' as ObservedState)
  const state = members[observed.findIndex((s) => s === lowest)]?.state ?? 'absent'
  // Every member's own ready date, and the pair is not ready until the last of
  // them is. No member is ready before its own window closes any more (`gates`),
  // so `readyOn` is always the earliest day that member could be ready and there
  // is nothing to pull forward.
  const readyDates = watched.map((m) => m.readyOn)
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
    // And the pair's window is read across only when every watched member's is.
    windowRead: watched.length > 0 && watched.every((m) => m.windowRead),
    seenInScope: sumOrNull(watched.map((m) => m.seenInScope)),
    activeInScope: sumOrNull(watched.map((m) => m.activeInScope)),
    signIns: members.reduce((n, m) => n + m.signIns, 0),
    // One member nobody read records for leaves the pair's count unknown: adding
    // its silence in as a zero would state the other member's clean window as
    // the pair's.
    failures: members.some((m) => m.failures === null) ? null : members.reduce((n, m) => n + (m.failures ?? 0), 0),
    failuresByUser: members.flatMap((m) => m.failuresByUser),
    evidenceQuality: members.some((m) => m.evidenceQuality === 'none') ? 'none' : members.some((m) => m.evidenceQuality === 'thin') ? 'thin' : 'enough',
    // One member whose readiness is its records keeps the pair on records.
    ...(members.length > 0 && members.every((m) => m.evidenceStrategy === 'configuration') ? { evidenceStrategy: 'configuration' as const } : {}),
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
    const record = observations[step.id] ?? null
    const matches = matchMembers(step, snapshot, coverage, planId, record)
    const sole = matches.length === 1
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
      // And a member whose policy no longer means what the plan asked for is
      // ready on nothing, however clean its window and its records look: what
      // was watched is not what would be enforced, and only a person can say
      // whether the change is safe (observation.ts `reviewRequired`). Kept apart
      // from `usable` on purpose — that asks whether the *history* carries, and
      // a policy can keep an admissible window (Microsoft's own evidence about
      // the object deployed now) while still holding a change nobody has
      // explained. This is that member's own observation and never another's.
      // And "ready to enforce" is a claim about the object in front of it: that
      // the only thing left to do to *this* policy is turn it on. So the object
      // being watched has to be the one the plan asked for — every dimension
      // the member's own operation submits already holding the value that
      // operation sets it to (observation.ts `intentOf`, the same comparison a
      // later scan makes when the policy moves).
      //
      // An update that only enables the policy submits no dimension at all and
      // passes: Foundation A built the patch as the difference, so a patch that
      // changes nothing but the state says everything else is already right.
      // Two shapes fail, and both used to reach the stage on the window alone:
      //
      //   * a correction is still owed. The patch carries dimensions the policy
      //     does not hold yet, so what the window watched is not what would be
      //     enforced, and the next submission is the correction, not the switch.
      //   * the tagged object means something else. The goal is not covered by
      //     it, what the plan offers is a second policy beside it, and there is
      //     nothing here to turn on — the step would read "Ready to enforce"
      //     over instructions to create.
      //
      // A member with no operation of its own is covered by the same reading:
      // nothing is being submitted, so nothing is waiting to be.
      const asked = m.op ? intentOf(m.op.body) : null
      const deployedFields = semanticFieldsOf(policyRow as Record<string, unknown> | null)
      const asPlanned = asked !== null && Object.entries(asked.controls).every(([dimension, value]) => deployedFields[dimension] === value)
      // `memberGates.readyNow` is both gates already (`gates`), so this line adds
      // the reasons that have nothing to do with the window or the records and
      // takes nothing away from them: there is one place where a member becomes
      // ready, and it needs every gate.
      // Nor while anything holds the step (roadmap/holds.ts): a prerequisite it
      // waits on, an object its policy names that is not there — an exclusions
      // group nobody has confirmed among them — a decision, a readiness threshold
      // or a baseline that contradicts itself. A report-only policy goes on being
      // watched through a hold, and is not ready to turn on.
      // Nor on a correction that is not safe to hand over (`correctionOf`): what
      // the operation would edit is not the policy this member owns, or another
      // goal is standing on it.
      const correction = correctionOf(m, step, coverage)
      const ready = observedState === 'report-only' && !m.ambiguous && asPlanned && usable && !change.reviewRequired && correction?.safe !== false && memberGates.readyNow && !isHeld(step)
      memberTracking.push({
        key: m.key,
        sourceName: m.sourceName,
        policyId: policyRow?.id ?? null,
        policyName: policyRow?.displayName ?? null,
        matchedBy: m.matchedBy,
        ambiguous: m.ambiguous,
        correction,
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

    // A goal whose baseline defines its policy two ways has no rollout for this
    // scan to track (roadmap/baselineConflict.ts). What the tenant holds is
    // still observed and recorded above — that is evidence, and it is honest —
    // but nothing below it may be said about a rollout the plan refuses to
    // define: no lifecycle stage, no review of a change against an intent IAMAI
    // never settled, and above all no `satisfied`. Everything below this line
    // reads a match between a tenant policy and what the baseline asked for, and
    // the baseline asked for two different things; a match against one of them
    // would silently pick that side and report the goal delivered. Generation
    // already withdrew the claim (roadmap/generate.ts); this is the same rule at
    // the one place a later scan could put it back.
    if (inBaselineConflict(step)) continue

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
    // And when the correction the plan wrote is not one it may hand over: the
    // member keeps the policy it owns, the operation is not offered against
    // another, and a person decides (`correctionOf`, types.ts CorrectionSafety).
    if (memberTracking.some((m) => m.correction?.safe === false)) raiseCondition(step, 'review-required')

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
        advance(step, { satisfied: true, inPlace: true }, fillText(TRACK.enforcedByOther, { name: satisfierOf(result) ?? 'an existing policy' }), now)
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
      // already, or through *both* of its own gates on its own window and its
      // own records. One member's clean window has never been another's, and the
      // note is the evidence that earned it — there is no other way in, so there
      // is no other note.
      if (lifecycle === 'ready-to-enforce') {
        const ready = readyWhen(step)
        if (ready?.kind === 'now') advance(step, { lifecycle: 'ready-to-enforce' }, readyBasis(ready) ?? fillText(TRACK.readyNow, { n: ready.days }), now)
      }
      continue
    }
    // Delivered by something the tenant already had, with the step's own policy
    // not enforced: a preservation result. On a step the baseline implements with
    // two policies it is admitted only where every required member is enforced —
    // one half of a pair has never finished a two-policy goal, whatever the
    // coverage of the goal as a whole adds up to.
    if (goalStatus === 'enforced' && (memberTracking.length === 1 || observed.every((x) => x === 'enforced'))) {
      advance(step, { satisfied: true, inPlace: true }, fillText(TRACK.enforcedByOther, { name: satisfierOf(result) ?? 'an existing policy' }), now)
    }
  }
  return steps
}

/**
 * The policy the goal's coverage says delivers it, in words: the one that does it
 * alone, else the set that does it together (coverage/types.ts Satisfaction).
 * Never the first strong candidate, and never the step's own policy, which on
 * this branch is the one that is *not* enforced.
 */
function satisfierOf(result: GoalResult | undefined): string | null {
  const by = result?.satisfaction
  if (!by || by.policyNames.length === 0) return null
  return by.sufficientName ?? list(by.policyNames)
}

// ---- ownership: a correction edits the policy the member owns, or nobody's ----

/**
 * Whether the correction a member's own operation submits may be handed over
 * (types.ts CorrectionSafety). An update edits one tenant object, so it has to
 * be the object this member owns — the policy the scan resolved for it, which
 * the member's own record keeps across a drift (`matchMembers`). A regeneration
 * that now prefers another candidate has written its update against a policy
 * this member does not own, and handing that over would move the member: the
 * step asks a person instead, and the candidate is never substituted. And no
 * other goal may be counting the owned policy towards its own satisfaction
 * (coverage/types.ts Satisfaction): correcting it for this goal could take that
 * one out of place, which is a person's call too. Null where nothing is being
 * corrected — a create, a member with no operation, or an update whose target
 * is not on the tenant (Foundation A's unavailable reason, not a drift).
 */
function correctionOf(m: MemberMatch, step: Step, coverage: CoverageReport): CorrectionSafety | null {
  if (!m.op || m.op.mode !== 'update' || !m.policy) return null
  const owned = m.policy
  if (m.op.policyId !== owned.id) {
    return { safe: false, reason: 'unowned-target', note: fillText(TRACK.correctionUnowned, { target: nameOfOp(m.op) ?? m.op.policyId, owned: owned.displayName ?? owned.id ?? '' }) }
  }
  const other = coverage.results.find((r) => r.goal.id !== step.goalId && (r.satisfaction?.policyIds ?? []).includes(owned.id as string))
  if (other) return { safe: false, reason: 'shared-satisfier', note: fillText(TRACK.correctionShared, { name: owned.displayName ?? owned.id ?? '', goal: other.goal.name }) }
  return { safe: true }
}

/** What a drift in an owned policy comes to, and nothing else: it can be corrected now, a person has to look, or something holds the step. */
export type DriftOutcome = 'correctable' | 'review-required' | 'on-hold'

/**
 * The one reading of what a deployed policy's drift from the plan comes to.
 * Exactly three outcomes, never a fourth, and never a change of owner:
 * `review-required` where a person has to look — a change the plan did not ask
 * for (observation.ts `reviewRequired`), a regression (`reopen`), or a correction
 * that is not safe to hand over (`correctionOf`); `on-hold` where anything else
 * holds the step (roadmap/holds.ts); `correctable` otherwise — the step's own
 * operation against the policy it owns is the correction, a report-only policy
 * short of enforcement among them. Null where nothing owned has drifted: a step
 * no policy delivers yet, one that is done, or one set aside.
 */
export function driftOutcomeOf(step: Step): DriftOutcome | null {
  if (step.status === 'done' || step.status === 'skipped') return null
  const members = step.tracking?.members ?? []
  if (!members.some((m) => m.policyId !== null)) return null
  // Read from the members, which is where the condition is raised from: a step
  // already blocked on something else keeps that condition (lifecycle.ts
  // raiseCondition ranks it harder), and the drift still needs a person.
  if (step.state.condition === 'review-required' || members.some((m) => m.reviewRequired || m.correction?.safe === false)) return 'review-required'
  return holdOf(step) !== null ? 'on-hold' : 'correctable'
}
