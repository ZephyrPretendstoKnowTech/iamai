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
// gates on enforcement, never holds (a started policy behind one reads
// Ready · Observing, and its report-only creation is not gated); an unwritable
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
import type { Action, DependencyData, Edge, Milestone } from '../../actionability/parseDependencyDoc.ts'
import { buildGraph, deriveLanes, nextActionOf } from '../../actionability/lanes.ts'
import type { Blocker, ConditionState, EvidenceGate, HoldBlocker, Lane, ObservedBlocker, ObservedEdge, OwnerState, PrerequisiteState, StepObservation, Substatus, TenantState } from '../../actionability/lanes.ts'
import { groupLanes, unlockCounts } from '../../actionability/sorting.ts'
import type { LaneRow } from '../../actionability/sorting.ts'
import type { Step } from '../../roadmap/types.ts'
import type { MappingState } from '../../mapping/types.ts'
import { isHeld } from '../../roadmap/holds.ts'
import { unavailableReason } from '../../roadmap/operations.ts'
import { GATING_SUBJECTS, blockerStepId } from '../../roadmap/blockerSteps.ts'
import { QUESTION_STEP, answerOf } from '../../roadmap/answers.ts'
import { observationWindowDays, readyBasis, readyWhen } from '../../derive/readyWhen.ts'
import { planStateOf } from './planState.ts'
import type { PlanState } from './planState.ts'

const GRAPH = buildGraph(data as DependencyData)
/** §12.1 counts leave the Security Defaults cutover edges out (BLOCKED.md · S2). */
const UNLOCKS = unlockCounts(GRAPH, { excludeConditions: ['sd-enabled'] })
/** The emergency-access foundations (roadmap/blockerSteps.ts): a wait on one holds a policy's enforcement. */
const GATE: ReadonlySet<string> = new Set(GATING_SUBJECTS.map(blockerStepId))

export const LANE_ORDER: readonly Lane[] = ['Ready', 'Up Next', 'On Hold', 'Completed', 'Deferred']

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
}

/** A row that is not a roadmap step: a Cleanup row, by the id the board gives it. */
export type LaneRowInput = { id: string; complete: boolean }

/** The recorded answers the carve-out conditions resolve from (mapping.questionAnswers). */
export type PlanAnswers = Pick<MappingState, 'questionAnswers'>

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
  // A policy exists in any deployed stage; an object with tiers exists once its minimum is met; anything else exists when it is delivered.
  const exists = policy ? lifecycle !== null && lifecycle !== 'not-deployed' : step.emergency ? step.emergency.minimum === 0 : done
  const blockers: ObservedBlocker[] = []
  const gates: EvidenceGate[] = []
  const waitsOn: ObservedEdge[] = []
  const conflict = step.state.condition === 'baseline-conflict'
  if (conflict) blockers.push({ kind: 'sourceConflict', id: step.state.conflictSource ?? 'baseline-conflict' })
  const drift = !done && (step.state.condition === 'review-required' || (step.kind === 'adjust' && exists))
  const kind = step.state.condition === 'needs-decision' ? 'decision' : policy ? 'policy' : (GRAPH.kinds.get(step.id) ?? 'object')
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
      if (!GRAPH.steps.has(b.stepId) || byId.get(b.stepId)?.status === 'done') continue
      const on: Action = policy && GATE.has(b.stepId) ? 'enforce' : action
      if (!graphGates(step.id, b.stepId, on)) waitsOn.push({ step: b.stepId, action: on, milestone: 'complete' })
    }
    else if (b.kind === 'readiness' && b.binding) gates.push({ id: `evidence:readiness:${b.label}`, satisfied: false, minDays: null, reason: b.binding })
    else if (b.kind === 'evidence' && !conflict) gates.push({ id: `evidence:${b.label}`, satisfied: false, minDays: null, reason: b.binding ?? b.label })
  }
  if (policy && open && step.action.readinessGate && !gates.some((g) => g.id.startsWith('evidence:readiness:'))) {
    gates.push({ id: 'evidence:readiness:threshold', satisfied: false, minDays: null, reason: null })
  }
  // The report-only window: both of tracking's gates close before enforcement
  // (derive/readyWhen.ts), and the window's length is the gate's time part.
  if (policy && exists && open) {
    const ready = readyWhen(step)
    gates.push({ id: 'evidence:observation', satisfied: lifecycle === 'ready-to-enforce' || lifecycle === 'enforced', minDays: observationWindowDays(step), reason: ready ? readyBasis(ready) : null })
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
    kind: step.state.condition === 'needs-decision' ? 'decision' : policy ? 'policy' : undefined,
    exists,
    drift,
    evidenceSatisfied: lifecycle === 'ready-to-enforce' || lifecycle === 'enforced',
    enforced: lifecycle === 'enforced',
    complete: done || step.doesntApply != null,
    milestones,
    blockers,
    gates,
    waitsOn,
  }
}

const PREREQUISITE_RANK: Readonly<Record<PrerequisiteState, number>> = { blocked: 0, actionable: 1, resolved: 2 }

/** One non-step prerequisite as the step it gates reads it. */
function prerequisiteOf(e: Edge, step: Step): PrerequisiteState {
  switch (e.prerequisiteKind) {
    case 'sourceConflict':
    case 'baselineSafetyConflict':
      return step.state.condition === 'baseline-conflict' ? 'blocked' : 'resolved'
    case 'decision':
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
function prerequisites(byId: ReadonlyMap<string, Step>): Record<string, PrerequisiteState> {
  const out: Record<string, PrerequisiteState> = {}
  for (const e of GRAPH.data.edges) {
    if (e.prerequisiteKind === 'step') continue
    const step = byId.get(e.step)
    if (!step) continue
    const state = prerequisiteOf(e, step)
    const held = out[e.prerequisite]
    if (held === undefined || PREREQUISITE_RANK[state] < PREREQUISITE_RANK[held]) out[e.prerequisite] = state
  }
  return out
}

/**
 * One graph condition (A1 §8) as this plan resolves it. A step the person said does
 * not apply resolves its condition not-applicable, and that completes the step
 * (§8.2). The Security Defaults cutover is applicable while the scan's read put its
 * step on the plan; shared devices are applicable while the scan found any; the
 * registration campaign targets passkeys (product constant); a carve-out is
 * applicable while its answer put the step on the plan, else the recorded answer
 * says, and an unrecorded one stays unresolved (§8.1: never silently satisfied).
 */
function conditionOf(name: string, ownedBy: string, byId: ReadonlyMap<string, Step>, answers: PlanAnswers | undefined): ConditionState {
  const owner = byId.get(ownedBy)
  if (owner?.doesntApply != null) return 'not-applicable'
  switch (name) {
    case 'campaign-targets-passkey': return 'applicable'
    case 'sd-enabled': return owner !== undefined && owner.status !== 'done' ? 'applicable' : 'not-applicable'
    case 'shared-devices-exist': return owner !== undefined ? 'applicable' : 'not-applicable'
    default: break
  }
  if (owner !== undefined) return 'applicable'
  if (!answers) return 'unresolved'
  switch (name) {
    case 'travel-exceptions-allowed': return yesNo(answerOf(answers, QUESTION_STEP.travel, 'question')?.index)
    case 'partner-accounts-exist': return yesNo(answerOf(answers, QUESTION_STEP.partner, 'question')?.index)
    case 'mail-devices-incompatible-path': {
      const a = answerOf(answers, QUESTION_STEP.mailDevices, 'decision')
      return a === null ? 'unresolved' : a.picked.length > 0 ? 'applicable' : 'not-applicable'
    }
    default: return 'unresolved'
  }
}

/** A recorded answer's first option is the one that changes nothing (roadmap/answers.ts). */
function yesNo(index: number | undefined): ConditionState {
  return index === undefined ? 'unresolved' : index > 0 ? 'applicable' : 'not-applicable'
}

function conditions(byId: ReadonlyMap<string, Step>, answers: PlanAnswers | undefined): Record<string, ConditionState> {
  const out: Record<string, ConditionState> = {}
  for (const c of GRAPH.data.conditions) out[c.name] = conditionOf(c.name, c.ownedBy, byId, answers)
  return out
}

/** The engine's inputs for this plan. A graph step this plan does not carry is nothing to do here. */
export function tenantStateOf(steps: readonly Step[], rows: readonly LaneRowInput[] = [], answers?: PlanAnswers): [TenantState, OwnerState] {
  const byId = new Map(steps.map((s) => [s.id, s]))
  const observed: Record<string, StepObservation> = {}
  for (const s of GRAPH.data.steps) observed[s.id] = { complete: true }
  for (const s of steps) if (GRAPH.steps.has(s.id)) observed[s.id] = observe(s, byId)
  for (const r of rows) if (GRAPH.steps.has(r.id)) observed[r.id] = { exists: false, complete: r.complete }
  return [
    { steps: observed, conditions: conditions(byId, answers), prerequisites: prerequisites(byId) },
    { deferred: steps.filter((s) => s.status === 'skipped').map((s) => s.id) },
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
      return { lane: 'Ready', substatus: 'Needs decision' }
    case 'attention':
      return { lane: 'Ready', substatus: 'Correct' }
    case 'reportOnly':
      return { lane: 'Ready', substatus: 'Observing' }
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
      out.set(r.id, { lane, substatus: r.result.substatus, reason: r.result.reason ? hold(r.result.reason) : null, blockers, gates: r.result.gates, order: counts[lane]++, fromEngine: true })
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
    const reason: HoldBlocker | null = mapping ? { kind: 'sourceMapping', id: mapping.id, milestone: null, condition: null, abnormal: true, ordinal: 0, ...(mapping.role ? { role: mapping.role } : {}) } : null
    rest.push({ id: s.id, reading: { ...reading, reason, blockers: reason ? [reason] : [], gates: [] } })
  }
  for (const r of rows) {
    if (out.has(r.id)) continue
    rest.push({ id: r.id, reading: r.complete ? { lane: 'Completed', substatus: null, reason: null, blockers: [], gates: [] } : { lane: 'Ready', substatus: 'Create', reason: null, blockers: [], gates: [] } })
  }
  rest.sort((a, b) => a.id.localeCompare(b.id))
  for (const { id, reading } of rest) out.set(id, { ...reading, order: counts[reading.lane]++, fromEngine: false })
  return out
}
