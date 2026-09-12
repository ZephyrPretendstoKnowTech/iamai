// The Plan's lanes: the actionability engine (src/actionability) read over the
// plan as this scan left it (S3).
//
// The engine derives Ready / Up Next / On Hold / Completed / Deferred from the
// dependency playbook's graph and a set of OBSERVATIONS; nothing here decides a
// lane itself. This module is the adapter: it reads each roadmap step once and
// says what the scan saw of it (does the object exist, does it differ from the
// pinned target, is its evidence satisfied, is it enforced, is it delivered) and
// what the owner chose (a skipped step is a deferred one). The graph's own
// prerequisites that are not steps (a source mapping, a decision, a baseline
// conflict) are read off the step they gate, edge by edge, never by id.
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
import type { DependencyData, Edge, Milestone } from '../../actionability/parseDependencyDoc.ts'
import { buildGraph, deriveLanes, nextActionOf } from '../../actionability/lanes.ts'
import type { Blocker, Lane, ObservedBlockerKind, OwnerState, PrerequisiteState, StepObservation, Substatus, TenantState } from '../../actionability/lanes.ts'
import { groupLanes, unlockCounts } from '../../actionability/sorting.ts'
import type { LaneRow } from '../../actionability/sorting.ts'
import type { Step } from '../../roadmap/types.ts'
import { isHeld } from '../../roadmap/holds.ts'
import { unavailableReason } from '../../roadmap/operations.ts'
import { planStateOf } from './planState.ts'
import type { PlanState } from './planState.ts'

const GRAPH = buildGraph(data as DependencyData)
/** §12.1 counts leave the Security Defaults cutover edges out (BLOCKED.md · S2). */
const UNLOCKS = unlockCounts(GRAPH, { excludeConditions: ['sd-enabled'] })

export const LANE_ORDER: readonly Lane[] = ['Ready', 'Up Next', 'On Hold', 'Completed', 'Deferred']

export type LaneReading = {
  lane: Lane
  substatus: Substatus | null
  /** Up Next: the nearest unresolved prerequisite. On Hold: the primary blocker. Otherwise null. */
  reason: Blocker | null
  /** Position inside the lane: the engine's §13 / §14 order, then the rows the graph does not know, by id. */
  order: number
  /** False where the graph does not know the step and the Plan's own state stood in. */
  fromEngine: boolean
}

/** A row that is not a roadmap step: a Cleanup row, by the id the board gives it. */
export type LaneRowInput = { id: string; complete: boolean }

const POLICY: readonly Step['kind'][] = ['create', 'adjust', 'enforce']

/**
 * What this scan saw of one step, in the engine's terms. Reads fields, never ids.
 * `byId` is the plan's own steps, for the objects a body names that the tenant
 * does not have yet (Action.missing): where the graph already carries the maker
 * step as a prerequisite the engine reads it as healthy queued work; anywhere
 * else the missing object holds the step until the scan finds it.
 */
export function observe(step: Step, byId: ReadonlyMap<string, Step> = new Map()): StepObservation {
  const policy = POLICY.includes(step.kind)
  const lifecycle = step.state.lifecycle
  const done = step.status === 'done'
  // A policy exists in any deployed stage; an object with tiers exists once its minimum is met; anything else exists when it is delivered.
  const exists = policy ? lifecycle !== null && lifecycle !== 'not-deployed' : step.emergency ? step.emergency.minimum === 0 : done
  const blockers: { kind: ObservedBlockerKind; id: string }[] = []
  if (step.state.condition === 'baseline-conflict') blockers.push({ kind: 'sourceConflict', id: step.state.conflictSource ?? 'baseline-conflict' })
  for (const b of step.blockers) if (b.kind === 'setup') blockers.push({ kind: 'fact', id: `setup:${b.questionNumber}` })
  const drift = !done && (step.state.condition === 'review-required' || (step.kind === 'adjust' && exists))
  const kind = step.state.condition === 'needs-decision' ? 'decision' : policy ? 'policy' : (GRAPH.kinds.get(step.id) ?? 'object')
  const action = nextActionOf(kind, { exists, drift })
  // The maker steps the graph already queues this step's next action behind.
  const gatedBy = new Set((GRAPH.gates.get(step.id) ?? []).filter((e) => e.prerequisiteKind === 'step' && e.action === action).map((e) => e.prerequisite))
  for (const m of step.action.missing ?? []) {
    // A source reference only a person can answer (resolvePolicy.ts unsettled / decisions) holds the policy
    // until Plan settings -> Baseline mappings answers it; the blocker states the part it plays (§18.1).
    if (m.unreadable || m.decision) {
      const role = (step.action.sourceReferences ?? []).find((r) => r.id.toLowerCase() === m.token.toLowerCase())?.role
      blockers.push({ kind: 'sourceMapping', id: `sourceMapping:${m.token.slice(0, 8)}`, ...(role ? { role } : {}) })
    }
    else if (m.stepId === null || (!gatedBy.has(m.stepId) && byId.get(m.stepId)?.status !== 'done')) blockers.push({ kind: 'missingObject', id: `missingObject:${m.stepId ?? m.token}` })
  }
  const unavailable = policy && !done && step.status !== 'skipped' ? unavailableReason(step) : null
  if (unavailable === 'unmatched-pair' || unavailable === 'no-operation') blockers.push({ kind: 'unsupported', id: unavailable })
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

/** The engine's inputs for this plan. A graph step this plan does not carry is nothing to do here. */
export function tenantStateOf(steps: readonly Step[], rows: readonly LaneRowInput[] = []): [TenantState, OwnerState] {
  const byId = new Map(steps.map((s) => [s.id, s]))
  const observed: Record<string, StepObservation> = {}
  for (const s of GRAPH.data.steps) observed[s.id] = { complete: true }
  for (const s of steps) if (GRAPH.steps.has(s.id)) observed[s.id] = observe(s, byId)
  for (const r of rows) if (GRAPH.steps.has(r.id)) observed[r.id] = { exists: false, complete: r.complete }
  return [
    { steps: observed, prerequisites: prerequisites(byId) },
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
 * here are not rows and get no reading.
 */
export function laneReadings(steps: readonly Step[], rows: readonly LaneRowInput[] = []): Map<string, LaneReading> {
  const [tenant, owner] = tenantStateOf(steps, rows)
  const results = deriveLanes(GRAPH, tenant, owner)
  const groups = groupLanes(results, GRAPH, UNLOCKS)
  const out = new Map<string, LaneReading>()
  const known = new Set([...steps.filter((s) => !s.doesntApply).map((s) => s.id), ...rows.map((r) => r.id)])
  const counts: Record<Lane, number> = { Ready: 0, 'Up Next': 0, 'On Hold': 0, Completed: 0, Deferred: 0 }
  const place = (lane: Lane, list: readonly LaneRow[]): void => {
    for (const r of list) if (known.has(r.id)) out.set(r.id, { lane, substatus: r.result.substatus, reason: r.result.reason, order: counts[lane]++, fromEngine: true })
  }
  place('Ready', groups.ready)
  place('Up Next', groups.upNext)
  place('On Hold', groups.onHold)
  place('Completed', groups.completed)
  place('Deferred', groups.deferred)
  const rest: { id: string; reading: Pick<LaneReading, 'lane' | 'substatus' | 'reason'> }[] = []
  const byId = new Map(steps.map((s) => [s.id, s]))
  for (const s of steps) {
    if (out.has(s.id) || s.doesntApply) continue
    const reading = fallbackOf(planStateOf(s, isHeld(s)))
    // A pending Baseline mapping holds a runtime-only row the same way it holds
    // an engine row (S4): the row carries the blocker as its reason, so the board
    // reads "Baseline references an unmapped group" here too.
    const mapping = reading.lane === 'On Hold' ? (observe(s, byId).blockers ?? []).find((b) => b.kind === 'sourceMapping') : undefined
    const reason: Blocker | null = mapping ? { kind: 'sourceMapping', id: mapping.id, milestone: null, condition: null, abnormal: true, ordinal: 0, ...(mapping.role ? { role: mapping.role } : {}) } : null
    rest.push({ id: s.id, reading: { ...reading, reason } })
  }
  for (const r of rows) {
    if (out.has(r.id)) continue
    rest.push({ id: r.id, reading: r.complete ? { lane: 'Completed', substatus: null, reason: null } : { lane: 'Ready', substatus: 'Create', reason: null } })
  }
  rest.sort((a, b) => a.id.localeCompare(b.id))
  for (const { id, reading } of rest) out.set(id, { ...reading, order: counts[reading.lane]++, fromEngine: false })
  return out
}
