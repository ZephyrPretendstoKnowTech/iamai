import { EXCLUSION_GROUP_STEP_ID } from '../../roadmap/stepIds.ts'
import { workflowReviewIsCurrent } from '../../roadmap/lifecycle.ts'
import { PASSKEY_SETTINGS_STEP_ID } from '../../roadmap/passkeySettings.ts'
// The Plan's lanes: the actionability engine (src/actionability) read over the
// plan as this scan left it (S3).
//
// The engine derives Ready / Up Next / On Hold / Completed / Deferred from the
// dependency playbook's graph and a set of OBSERVATIONS; nothing here decides a
// lane itself. This module is the adapter: it reads each roadmap step once and
// says what the scan saw of it (does the object exist, does it differ from the
// pinned target, which evidence gates its enforcement, is it enforced, is it
// delivered), what the plan itself waits on (a maker step, the emergency gate, a
// Setup answer), and what the owner chose (a skipped step is a deferred one; a
// carve-out answer resolves its condition). The graph's own prerequisites that
// are not steps (a source mapping, a decision, a baseline conflict) are read off
// the step they gate, edge by edge, never by id.
//
// Every kind of hold the legacy roadmap/holds.ts knows has a counterpart here
// (A1a): a conflict and a decision are the step's condition; a review is drift; a
// readiness threshold, the report-only window and named evidence are evidence
// gates on enforcement (a started policy behind one waits On Hold, or reads
// Ready · Observing where the gate can be reviewed now, and its report-only
// creation is not gated, save a compliant-device create the readiness threshold
// holds too, `holdsCreate`); an unwritable
// policy is an observed blocker; a prerequisite is a step edge.
//
// The schedule is not an input. A step's phase, its wave and its dates are a
// secondary projection the row still shows (roadmap/stepSchedule.ts); a lane
// never reads them, so a step's tab cannot move when its phase does.
//
// A step the graph does not know (a runtime-only row) takes a lane from the
// Plan's own presentation state (planState.ts), after the engine's rows.
//
// Pure: no DOM, no network.
import data from '../../actionability/dependency-data.json' with { type: 'json' }
import { graphConditions } from '../../roadmap/graphConditions.ts'
import type { PlanAnswers } from '../../roadmap/graphConditions.ts'
import type { Action, DependencyData, Edge, Milestone } from '../../actionability/parseDependencyDoc.ts'
import { buildGraph, deriveLanes, nextActionOf } from '../../actionability/lanes.ts'
import type { Blocker, ConditionState, EvidenceGate, HoldBlocker, Lane, ObservedBlocker, ObservedEdge, OwnerState, PrerequisiteState, StepObservation, Substatus, TenantState } from '../../actionability/lanes.ts'
import { groupLanes, unlockCounts } from '../../actionability/sorting.ts'
import type { LaneRow } from '../../actionability/sorting.ts'
import type { Step } from '../../roadmap/types.ts'
import { FOUNDATION_WAIT, isHeld } from '../../roadmap/holds.ts'
import { driftOutcomeOf } from '../../roadmap/tracking.ts'
import { submitsEnforcementOnly, switchedOffPolicies, unavailableReason, implementationOffered, operationsOf, enforcesOnRun, createWaitsOnReadiness } from '../../roadmap/operations.ts'
import { GATING_SUBJECTS, blockerStepId } from '../../roadmap/blockerSteps.ts'
import { observationWindowDays, readyBasis, readyWhen } from '../../derive/readyWhen.ts'
import { planStateOf } from './planState.ts'
import { directionBlockerStep, directionWaitRelayed } from '../../roadmap/direction.ts'
import { isDirectionStep } from '../../roadmap/directionAnswers.ts'
import type { PlanState } from './planState.ts'

const GRAPH = buildGraph(data as DependencyData)
/** §12.1 counts leave the Security Defaults cutover edges out (BLOCKED.md · S2). */
const UNLOCKS = unlockCounts(GRAPH, { excludeConditions: ['sd-enabled'] })
/** The emergency-access foundations (roadmap/blockerSteps.ts): a wait on one holds a policy's enforcement. */
const GATE: ReadonlySet<string> = new Set(GATING_SUBJECTS.map(blockerStepId))

export const LANE_ORDER: readonly Lane[] = ['Ready', 'Up Next', 'On Hold', 'Completed', 'Deferred']

/**
 * The Ready word of a check whose work is a review or a create (walk list item
 * 18): Disable or Confirm Dormant Accounts goes through each account it lists,
 * and Use Separate Accounts for Admin Work creates a separate admin account for
 * each admin it lists. Every other check and campaign reads Ready.
 */
const CHECK_WORK: Readonly<Record<string, Substatus>> = {
  's-check-dormant-accounts': 'Review',
  's-check-separate-admin-accounts': 'Create',
}

export type LaneReading = {
  lane: Lane
  substatus: Substatus | null
  /** Up Next: the nearest unresolved prerequisite. On Hold: the primary blocker. Ready · Observing: the
   *  nearest unresolved prerequisite, or null where the open evidence gate is the reason (see `gates`). */
  reason: HoldBlocker | null
  /** On Hold: every §15 blocker, primary first. Ready / Up Next: the unresolved prerequisites of the next action. The opened step's Readiness tiles (A1 §16.1). */
  blockers: readonly HoldBlocker[]
  /** Policy steps: the evidence gates on enforcement, each with its time part and its own words (A1 §7);
   *  an open one is what a Ready · Observing step waits on. */
  gates: readonly EvidenceGate[]
  /** Position inside the lane: the engine's §13 / §14 order, then the rows the graph does not know, by id. */
  order: number
  /** False where the graph does not know the step and the Plan's own state stood in. */
  fromEngine: boolean
  /**
   * Conditional inputs nobody has saved (roadmap/answers.ts unsavedInputsOf).
   *
   * They are why the engine keeps a step out of Completed (`isComplete`, U28),
   * and the row could not say so: a policy already enforced read "In place" in
   * the State column, "Ready - Decision" in its lane and "Not scheduled" under
   * When, three answers to one question with nothing naming the answer that was
   * missing.
   */
  unsaved?: readonly string[]
  /** True where those inputs are IAMAI's to have confirmed rather than its questions (Step.unsavedInputsPrefilled). */
  unsavedPrefilled?: boolean
  /** Where the plan expects the row to happen (roadmap/forecast.ts planForecast), set by the board (planBoard.ts boardReadingsOf): the day a row with none of its own is dated by. */
  estimate?: string
}

/** A row that is not a roadmap step: a Cleanup row, by the id the board gives it. */
export type LaneRowInput = { id: string; complete: boolean; afterRollout?: boolean }

/** How many rows each lane holds, counted off the readings (A1c): Connect's Plan tile and any other surface that states a lane count read this. */
export function laneCountsOf(readings: ReadonlyMap<string, LaneReading>): Record<Lane, number> {
  const out: Record<Lane, number> = { Ready: 0, 'Up Next': 0, 'On Hold': 0, Completed: 0, Deferred: 0 }
  for (const r of readings.values()) out[r.lane] += 1
  return out
}

/** The recorded answers the carve-out conditions resolve from (mapping.questionAnswers). */
export type { PlanAnswers }

const POLICY: readonly Step['kind'][] = ['create', 'adjust', 'enforce']

/** True where the graph already gates `action` on `step` behind `prerequisite`. */
function graphGates(step: string, prerequisite: string, action: Action): boolean {
  return (GRAPH.gates.get(step) ?? []).some((e) => e.prerequisiteKind === 'step' && e.prerequisite === prerequisite && e.action === action)
}

/**
 * What this scan saw of one step, in the engine's terms. Reads fields, never ids.
 * `byId` is the plan's own steps, for the objects a body names that the tenant
 * does not have yet (Action.missing) and the steps the plan waits on
 * (Step.blockers): a maker step the plan carries is healthy queued work (A1 §8.4);
 * an object no step makes, or one its maker says it made and the scan cannot
 * find, holds the step until the scan finds it.
 */
export function observe(step: Step, byId: ReadonlyMap<string, Step> = new Map()): StepObservation {
  const policy = POLICY.includes(step.kind)
  const lifecycle = step.state.lifecycle
  const done = step.status === 'done'
  const open = !done && step.status !== 'skipped'
  // A policy exists in any deployed stage; emergency access exists once the plan
  // holds confirmed accounts (they are on the tenant) or its minimum is met;
  // anything else exists when it is delivered.
  const emergency = step.emergency ?? null
  // A policy this plan tagged that the tenant switched off exists: its lifecycle
  // reads not-deployed because a disabled policy enforces nothing, and the board
  // read "Ready · Create" over a step whose own words said the policy is already
  // there and setting it to Report-only is the change, not a new policy (Jordan D6). The
  // next action corrects it.
  const switchedOff = policy && !done && switchedOffPolicies(step).length > 0
  const exists = policy ? (lifecycle !== null && lifecycle !== 'not-deployed') || switchedOff : emergency ? emergency.accounts.length > 0 : done
  const blockers: ObservedBlocker[] = []
  const gates: EvidenceGate[] = []
  const waitsOn: ObservedEdge[] = []
  // The readiness threshold holds a compliant-device policy's report-only
  // preparation: its create, or, found switched off, its Report-only patch
  // (roadmap/operations.ts createWaitsOnReadiness).
  const holdsCreate = policy && (!exists || switchedOff) && createWaitsOnReadiness(step)
  const conflict = step.state.condition === 'baseline-conflict'
  if (conflict) blockers.push({ kind: 'sourceConflict', id: step.state.conflictSource ?? 'baseline-conflict' })
  // Drift is a policy a person has to look at, or one the plan's own update
  // corrects in something other than its state. An adjust step whose only
  // operation turns a report-only policy on is not drifted: it is being watched.
  const corrects = (step.action.resolution?.policies ?? []).some((o) => o.mode === 'update' && !submitsEnforcementOnly(o))
  // An enforced policy the tracker reads as short of the plan (roadmap/tracking.ts
  // driftOutcomeOf) has drifted whatever its operations say: an enforced policy
  // that is not what the plan asked for is corrected, never complete (U20, U21).
  const enforcedShort = policy && lifecycle === 'enforced' && driftOutcomeOf(step) !== null
  // Accounts that exist and fail a minimum check are started work drifted from
  // the target: the next action corrects them, it does not create them.
  const drift = !done && (switchedOff || enforcedShort || step.state.condition === 'review-required' || (step.kind === 'adjust' && exists && corrects) || (emergency !== null && exists && emergency.minimum > 0))
  // Emergency access with fewer than two accounts saved asks the person to choose them: the
  // accounts may already be on the tenant, so the next action is the choice,
  // not a create (owner, 2026-09-23: the row read "Ready · Create" over cards
  // saying "No account selected").
  const decides = step.state.condition === 'needs-decision' || (emergency !== null && emergency.accounts.length < 2 && !done)
  const kind = decides ? 'decision' : policy ? 'policy' : (GRAPH.kinds.get(step.id) ?? 'object')
  const action = nextActionOf(kind, { exists, drift })
  // The plan's own waits (the legacy `prerequisite` hold), each in the engine's terms: a
  // maker step or a decision gates the action that needs it; the emergency gate holds a
  // policy's enforcement and never its report-only preparation (A3 B3); a Setup answer
  // is a tenant fact; a threshold or a sequence-safety wait with a number to reach is an
  // evidence gate on enforcement (the legacy `readiness` hold), while one with no number
  // is an ordering rule the graph owns; evidence the plan named is a gate too (the legacy
  // `evidence` hold), the baseline conflict being the blocker above.
  for (const b of step.blockers) {
    if (b.kind === 'setup') blockers.push({ kind: 'fact', id: `setup:${b.questionNumber}` })
    else if (b.kind === 'step') {
      // A saved choice is the next action on an already deployed policy. Legacy
      // rollout blockers still describe its enforcement history; they do not
      // turn the pending choice itself into dependent work.
      if (action === 'decide') continue
      if (!GRAPH.steps.has(b.stepId) || byId.get(b.stepId)?.status === 'done') continue
      // The emergency gate held a policy's enforcement and never its report-only
      // preparation (A3 B3) — except where the wait is the plan's foundation
      // (roadmap/foundations.ts; owner, 2026-09-19), which holds the step's own
      // next action, so no policy reads Ready while Emergency Access or Direction is unsettled.
      const on: Action = policy && GATE.has(b.stepId) && b.label !== FOUNDATION_WAIT ? 'enforce' : action
      if (!graphGates(step.id, b.stepId, on)) waitsOn.push({ step: b.stepId, action: on, milestone: 'complete' })
    }
    else if (b.kind === 'readiness' && b.label === 'session-loop' && exists) blockers.push({ kind: 'fact', id: 'fact:session-loop' })
    // The readiness threshold holds a compliant-device policy's create as well as its
    // enforcement (roadmap/operations.ts createWaitsOnReadiness; owner, 2026-09-23).
    else if (b.kind === 'readiness' && b.binding) gates.push({ id: `evidence:readiness:${b.label}`, satisfied: false, minDays: null, reason: b.binding, ...(b.label === 'readiness' && holdsCreate ? { holdsCreate } : {}) })
    // A tenant fact this scan could not read — a group a policy names whose
    // members nobody could list — holds the step; it is not a gate the policy
    // earns by being watched (§8.4: a fact still to be established holds).
    else if (b.kind === 'evidence' && b.unverified === true) blockers.push({ kind: 'fact', id: `fact:${b.label}` })
    else if (b.kind === 'evidence' && !conflict) gates.push({ id: `evidence:${b.label}`, satisfied: false, minDays: null, reason: b.binding ?? b.label })
    // A Direction answer the step depends on and nobody has saved holds it whole
    // (owner decision 3, roadmap/direction.ts): the step's own policy is written
    // from that answer, so neither its creation nor its enforcement can go first.
    // An enforced policy is not held back by it: its correction and its recorded
    // inputs are available now (the engine's own rule for an enforced policy).
    else if (b.kind === 'decision' && lifecycle !== 'enforced') {
      const direction = directionBlockerStep(b)
      if (direction !== null && !blockers.some((x) => x.kind === 'decision' && x.id === direction)) blockers.push({ kind: 'decision', id: direction })
    }
  }
  if (policy && open && step.action.readinessGate && !gates.some((g) => g.id.startsWith('evidence:readiness:'))) {
    gates.push({ id: 'evidence:readiness:threshold', satisfied: false, minDays: null, reason: null, ...(holdsCreate ? { holdsCreate } : {}) })
  }
  // The report-only window: both of tracking's gates close before enforcement
  // (derive/readyWhen.ts), and the window's length is the gate's time part.
  if (policy && exists && open) {
    const ready = readyWhen(step)
    // The window closed over records that were read: what they show can be reviewed now,
    // though it has not cleared the gate (time alone never does).
    const reviewable = ready !== null && ready.kind === 'since' && ready.read && ready.failures !== null
    gates.push({ id: 'evidence:observation', satisfied: lifecycle === 'ready-to-enforce' || lifecycle === 'enforced', minDays: observationWindowDays(step), reason: ready ? readyBasis(ready) : null, ...(reviewable ? { reviewable } : {}) })
  }
  // A policy the plan cannot write as it stands (the legacy `unavailable` hold). A missing
  // object is Action.missing below, the baseline conflict is the condition above, an unmet
  // threshold is the gate above, and the unverified escape hatch is the gate's step edge.
  const unavailable = policy && open ? unavailableReason(step) : null
  if (unavailable === 'unmatched-pair' || unavailable === 'no-operation') blockers.push({ kind: 'unsupported', id: unavailable })
  else if (unavailable === 'unsafe-emergency-access') blockers.push({ kind: 'baselineSafetyConflict', id: `baselineSafetyConflict:${unavailable}` })
  else if (unavailable === 'unverified-emergency-exclusion') blockers.push({ kind: 'fact', id: `fact:${unavailable}` })
  for (const m of step.action.missing ?? []) {
    // A source reference only a person can answer (resolvePolicy.ts unsettled / decisions) holds the policy
    // until Plan settings -> Baseline mappings answers it; the blocker states the part it plays (§18.1).
    if (m.unreadable || m.decision) {
      const role = (step.action.sourceReferences ?? []).find((r) => r.id.toLowerCase() === m.token.toLowerCase())?.role
      blockers.push({ kind: 'sourceMapping', id: `sourceMapping:${m.token.slice(0, 8)}`, ...(role ? { role } : {}) })
      continue
    }
    // An object the step makes itself is its own task, not a wait and not a
    // missing object (Stage 3: the countries policy makes the countries
    // location). Without this it waited on itself, or read On Hold ·
    // missingObject over work its own Implementation Tasks hand over now.
    if (m.stepId === step.id) continue
    const maker = m.stepId !== null ? byId.get(m.stepId) : undefined
    if (maker && GRAPH.steps.has(maker.id) && graphGates(step.id, maker.id, action)) continue
    if (maker && GRAPH.steps.has(maker.id) && maker.status !== 'done') waitsOn.push({ step: maker.id, action, milestone: 'complete' })
    else blockers.push({ kind: 'missingObject', id: `missingObject:${m.stepId ?? m.token}` })
  }
  const milestones: Milestone[] = []
  if (step.emergency) {
    if (step.emergency.minimum === 0) milestones.push('minimum-satisfied')
    if (step.emergency.hardening === 0) milestones.push('hardening-complete')
  }
  return {
    kind: decides ? 'decision' : policy ? 'policy' : undefined,
    exists,
    drift,
    evidenceSatisfied: lifecycle === 'ready-to-enforce' || lifecycle === 'enforced',
    enforced: lifecycle === 'enforced',
    complete: done || step.doesntApply != null,
    milestones,
    blockers,
    gates,
    waitsOn,
    // A conditional input nobody saved (U28); a step that does not apply here asks nothing.
    ...(step.doesntApply == null && (step.unsavedInputs ?? []).length > 0 ? { unsaved: step.unsavedInputs } : {}),
  }
}

const PREREQUISITE_RANK: Readonly<Record<PrerequisiteState, number>> = { blocked: 0, actionable: 1, resolved: 2 }

/** One non-step prerequisite as the step it gates reads it. */
function prerequisiteOf(e: Edge, step: Step, conds: Readonly<Record<string, ConditionState>>): PrerequisiteState {
  switch (e.prerequisiteKind) {
    case 'sourceConflict':
    case 'baselineSafetyConflict':
      return step.state.condition === 'baseline-conflict' ? 'blocked' : 'resolved'
    case 'decision':
      // A decision behind a condition the person's answer made applicable (device
      // code sign-in in use) is theirs to act on until the answer changes.
      if (e.condition !== null && conds[e.condition] === 'applicable') return 'actionable'
      return step.state.condition === 'needs-decision' ? 'actionable' : 'resolved'
    case 'sourceMapping':
      // The graph puts one mapping on every policy create; the scan knows which
      // policies actually name the reference (Action.missing, read in `observe`),
      // so the edge is resolved here and the pending mapping holds only the
      // steps whose bodies wait on it.
      return 'resolved'
    default:
      return 'blocked'
  }
}

/** The graph's non-step prerequisites, each read off every step it gates; the most conservative reading wins. */
function prerequisites(byId: ReadonlyMap<string, Step>, conds: Readonly<Record<string, ConditionState>>): Record<string, PrerequisiteState> {
  const out: Record<string, PrerequisiteState> = {}
  for (const e of GRAPH.data.edges) {
    if (e.prerequisiteKind === 'step') continue
    const step = byId.get(e.step)
    if (!step) continue
    const state = prerequisiteOf(e, step, conds)
    const held = out[e.prerequisite]
    if (held === undefined || PREREQUISITE_RANK[state] < PREREQUISITE_RANK[held]) out[e.prerequisite] = state
  }
  return out
}

/** The engine's inputs for this plan. A graph step this plan does not carry is nothing to do here. */
export function tenantStateOf(steps: readonly Step[], rows: readonly LaneRowInput[] = [], answers?: PlanAnswers): [TenantState, OwnerState] {
  const byId = new Map(steps.map((s) => [s.id, s]))
  const observed: Record<string, StepObservation> = {}
  for (const s of GRAPH.data.steps) observed[s.id] = { complete: true }
  for (const s of steps) if (GRAPH.steps.has(s.id)) observed[s.id] = observe(s, byId)
  for (const r of rows) if (GRAPH.steps.has(r.id)) observed[r.id] = { exists: false, complete: r.complete }
  const conds = graphConditions(byId, answers)
  return [
    { steps: observed, conditions: conds, prerequisites: prerequisites(byId, conds) },
    // Deferred is the person's choice to put a step off. A step that does not
    // apply here is set aside too (its status reads skipped), but nobody
    // deferred it: it is complete to the engine (`observe`), never Deferred.
    { deferred: steps.filter((s) => s.status === 'skipped' && s.doesntApply == null).map((s) => s.id) },
  ]
}

/** Where the Plan's own state puts a row the graph does not know. */
function fallbackOf(s: PlanState): Pick<LaneReading, 'lane' | 'substatus'> {
  if (s.complete) return { lane: 'Completed', substatus: null }
  switch (s.kind) {
    case 'skipped':
      return { lane: 'Deferred', substatus: null }
    case 'blocked':
    case 'correction':
    case 'conflict':
      return { lane: s.held ? 'On Hold' : 'Up Next', substatus: null }
    case 'decision':
      return { lane: 'Ready', substatus: 'Decision' }
    case 'attention':
      return { lane: 'Ready', substatus: 'Correct' }
    case 'reportOnly':
      // Collecting its evidence: a wait, not an action (owner's status contract).
      return { lane: 'On Hold', substatus: null }
    case 'readyToEnforce':
      return { lane: 'Ready', substatus: 'Ready to enforce' }
    default:
      return { lane: 'Ready', substatus: 'Create' }
  }
}

/**
 * One reading per row: the engine's for every step and Cleanup row the graph
 * knows, the Plan's own state for the rest. Rows the person said do not apply
 * here are not rows and get no reading. `answers` are the recorded carve-out
 * answers the conditions resolve from; without them a carve-out nobody answered
 * stays unresolved.
 */
export function laneReadings(steps: readonly Step[], rows: readonly LaneRowInput[] = [], answers?: PlanAnswers): Map<string, LaneReading> {
  const [tenant, owner] = tenantStateOf(steps, rows, answers)
  const results = deriveLanes(GRAPH, tenant, owner)
  const groups = groupLanes(results, GRAPH, UNLOCKS)
  const out = new Map<string, LaneReading>()
  const known = new Set([...steps.filter((s) => !s.doesntApply).map((s) => s.id), ...rows.map((r) => r.id)])
  const counts: Record<Lane, number> = { Ready: 0, 'Up Next': 0, 'On Hold': 0, Completed: 0, Deferred: 0 }
  /** A prerequisite blocker as the board reads it; an evidence gate is not one (it is in `gates`). */
  const hold = (b: Blocker): HoldBlocker | null => (b.kind === 'evidence' ? null : (b as HoldBlocker))
  const place = (lane: Lane, list: readonly LaneRow[]): void => {
    for (const r of list) {
      if (!known.has(r.id)) continue
      const blockers = r.result.blockers.map(hold).filter((b): b is HoldBlocker => b !== null)
      // An open evidence gate is the reason a report-only policy waits On Hold, and the board says so.
      const reason = r.result.reason === null ? null : lane === 'On Hold' ? (r.result.reason as HoldBlocker) : hold(r.result.reason)
      out.set(r.id, { lane, substatus: r.result.substatus, reason, blockers, gates: r.result.gates, order: counts[lane]++, fromEngine: true })
    }
  }
  place('Ready', groups.ready)
  place('Up Next', groups.upNext)
  place('On Hold', groups.onHold)
  place('Completed', groups.completed)
  place('Deferred', groups.deferred)
  const rest: { id: string; reading: Pick<LaneReading, 'lane' | 'substatus' | 'reason' | 'blockers' | 'gates'> }[] = []
  const byId = new Map(steps.map((s) => [s.id, s]))
  for (const s of steps) {
    if (out.has(s.id) || s.doesntApply) continue
    const reading = fallbackOf(planStateOf(s, isHeld(s)))
    // A pending Baseline mapping holds a runtime-only row the same way it holds
    // an engine row (S4): the row carries the blocker as its reason, so the board
    // reads "Baseline references an unmapped group" here too.
    const mapping = reading.lane === 'On Hold' ? (observe(s, byId).blockers ?? []).find((b) => b.kind === 'sourceMapping') : undefined
    // A Direction answer this row depends on holds it, as it holds an engine row (observe),
    // unless its policy is already enforced; it outranks a wait on ordinary work.
    const waitsOn = s.state.lifecycle === 'enforced' ? null : s.blockers.map(directionBlockerStep).find((id) => id !== null) ?? null
    const direction = waitsOn !== null ? byId.get(waitsOn) : undefined
    const dependency = (direction && direction.status !== 'done' ? direction : undefined) ?? s.blockedBy.map((id) => byId.get(id)).find((d) => d && d.status !== 'done')
    const prerequisite: HoldBlocker | null = direction && dependency === direction ? { kind: 'decision', id: direction.id, milestone: null, condition: null, abnormal: true, ordinal: 0 } : dependency ? { kind: 'step', id: dependency.id, milestone: null, condition: null, abnormal: false, ordinal: 0 } : null
    const reason: HoldBlocker | null = mapping ? { kind: 'sourceMapping', id: mapping.id, milestone: null, condition: null, abnormal: true, ordinal: 0, ...(mapping.role ? { role: mapping.role } : {}) } : prerequisite
    if (dependency && !mapping && reading.lane !== 'Completed' && reading.lane !== 'Deferred') { reading.lane = direction && dependency === direction ? 'On Hold' : (out.get(dependency.id) ?? fallbackOf(planStateOf(dependency, isHeld(dependency)))).lane === 'Ready' ? 'Up Next' : 'On Hold'; reading.substatus = null }
    rest.push({ id: s.id, reading: { ...reading, reason, blockers: reason ? [reason] : [], gates: [] } })
  }
  for (const r of rows) {
    if (out.has(r.id)) continue
    rest.push({ id: r.id, reading: r.complete ? { lane: 'Completed', substatus: null, reason: null, blockers: [], gates: [] } : { lane: 'Ready', substatus: 'Review', reason: null, blockers: [], gates: [] } })
  }
  rest.sort((a, b) => a.id.localeCompare(b.id))
  for (const { id, reading } of rest) out.set(id, { ...reading, order: counts[reading.lane]++, fromEngine: false })
  for (const step of steps) {
    const unsaved = step.doesntApply == null ? step.unsavedInputs ?? [] : []
    const own = out.get(step.id)
    if (own && unsaved.length > 0) out.set(step.id, { ...own, unsaved, unsavedPrefilled: step.unsavedInputsPrefilled === true })
  }
  for (const step of steps) {
    const reading = out.get(step.id)
    // A policy waiting on the plan's foundation (roadmap/foundations.ts) is not
    // promoted back into Ready by any of the readings below: Emergency Access
    // and Direction come first, and that is the whole of the rule.
    const gated = step.blockers.some((b) => b.label === FOUNDATION_WAIT)
    // Reviewing an unread or unsupported configuration is available now; this
    // does not clear the engine's blockers or enable generated write operations.
    if (reading && step.id === PASSKEY_SETTINGS_STEP_ID && step.status !== 'done' && step.status !== 'skipped' && step.blockers.some(b => b.label.startsWith('passkey-settings-'))) {
      reading.lane = 'Ready'
      reading.substatus = 'Review'
      reading.reason = null
      reading.blockers = []
    }
    // A review is not a write: an unmatched pair asks a person to look, and the
    // foundation gate leaves review rows where they are (owner, 2026-09-19).
    if (reading && step.goalId === 'guests-mfa' && step.action.unmatchedPair && step.status !== 'done' && step.status !== 'skipped') {
      reading.lane = 'Ready'
      reading.substatus = 'Review'
      reading.reason = null
      reading.blockers = []
    }
    // A confirmed, policy-usable exclusions group may still need its exclusions
    // added to existing policies. Its final completion must not prevent the safe
    // report-only preparation that contributes to finishing those exclusions.
    const safePreparation = implementationOffered(step) && !(step.action.missing?.length) && operationsOf(step).length > 0 && operationsOf(step).every(op => !enforcesOnRun(op))
    if (!gated && (reading?.lane === 'On Hold' || reading?.lane === 'Up Next') && reading.blockers.length > 0 && reading.blockers.every(b => b.kind === 'step' && b.id === EXCLUSION_GROUP_STEP_ID) && safePreparation) {
      Object.assign(reading, { lane: 'Ready', substatus: operationsOf(step).some(op => op.mode === 'create') ? 'Create' : 'Correct', reason: null, blockers: [] })
    }
    // Authentication-method configuration already exists in Entra, even when
    // disabled. This action changes its settings rather than creating an object.
    if (reading?.lane === 'Ready' && step.id === PASSKEY_SETTINGS_STEP_ID && reading.substatus === 'Create') reading.substatus = 'Correct'
    // The office location picked in Decide How and Where People Sign In is in
    // Entra without the trusted mark: the step marks it, it makes nothing (walk list 61).
    if (reading?.lane === 'Ready' && (step.officeToTrust?.length ?? 0) > 0 && reading.substatus === 'Create') reading.substatus = 'Correct'
    // A saved exclusions-group choice is an existing object to inspect or
    // correct. Keep the create label only while no group has been saved.
    const savedExclusionsGroup = step.id === EXCLUSION_GROUP_STEP_ID
      && step.configurationFindings?.find(finding => finding.key === 'group-choice')?.items?.some(item => item.factLabel === 'Selection' && item.value === 'Saved')
    if (reading?.lane === 'Ready' && savedExclusionsGroup && reading.substatus === 'Create') reading.substatus = 'Correct'
    // Account checks ask for a review, not creation of a policy or object.
    if (reading && workflowReviewIsCurrent(step)) Object.assign(reading, { lane: 'Ready', substatus: 'Review', reason: null, blockers: [], gates: [] })
    const workflowCheckIsNext = step.manualReview && (!POLICY.includes(step.kind) || workflowReviewIsCurrent(step))
    if (reading?.lane === 'Ready' && workflowCheckIsNext) reading.substatus = 'Review'
    // Ready's word is the work that is ready (walk list item 18, owner
    // 2026-09-23). The engine's Create is a policy's or an object's create; every
    // check's used to become Review here, so Register Your Own Passkey read
    // Ready · Review with nothing to review, and Prepare Your Team for MFA read
    // Ready · Create over a campaign, which creates nothing. A check or a
    // campaign says its own work (CHECK_WORK), and one with nothing to review or
    // create reads Ready.
    else if (reading?.lane === 'Ready' && reading.substatus === 'Create' && (step.kind === 'check' || step.kind === 'verify')) reading.substatus = CHECK_WORK[step.id] ?? null
  }
  // One wait, said once (docs/plans/step-redundancy-analysis.md finding 3), on
  // the reading the second tile producer reads. A policy held by "Define the
  // Trusted Network" AND by "Waiting on your direction: Decide Where People Sign
  // In From" (the label then) said one thing twice, in two vocabularies: the
  // trusted network is what that answer is for, and the step is where it gets
  // made. The nearest cause is the step; the answer behind it is that step's
  // own wait to show. The row's `reason` is untouched, so no row changes lane,
  // label or order, and a row whose stated reason IS the answer still says it
  // — once.
  //
  // The relay is by question, not by Direction step (direction.ts
  // directionWaitRelayed): a device policy's own computers-and-phones wait is
  // not Define the Trusted Network's to carry.
  for (const [id, reading] of out) {
    const via = reading.blockers.flatMap((b) => (b.kind === 'step' || b.kind === 'suspendedPrerequisite' ? [b.id] : []))
    if (via.length === 0) continue
    const step = byId.get(id) ?? null
    reading.blockers = reading.blockers.filter((b) => !(b.kind === 'decision' && isDirectionStep(b.id) && directionWaitRelayed(step, via, b.id)))
  }
  for (const row of rows) { const reading = out.get(row.id); if (reading?.lane === 'Ready') reading.substatus = 'Review' }
  const rolloutPending = steps.some(step => POLICY.includes(step.kind) && step.status !== 'done' && step.status !== 'skipped' && !step.doesntApply)
  if (rolloutPending) for (const row of rows.filter(row => row.afterRollout && !row.complete)) {
    const reading = out.get(row.id)
    if (reading) Object.assign(reading, {lane: 'On Hold', substatus: null, reason: {kind: 'fact', id: 'after-security-rollout', milestone: null, condition: null, abnormal: false, ordinal: 0}, blockers: [], gates: []})
  }
  // Moving a review into Ready must keep lane positions unique and keep
  // catalogue rows ahead of runtime-only cleanup rows.
  for (const lane of LANE_ORDER) {
    [...out.values()].filter(r => r.lane === lane).sort((a, b) => Number(b.fromEngine) - Number(a.fromEngine) || a.order - b.order).forEach((reading, order) => { reading.order = order })
  }
  return out
}
