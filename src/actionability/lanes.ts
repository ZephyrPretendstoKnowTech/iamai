// Lane engine — a pure reading of the dependency playbook (A1) over one scan.
//
// deriveLane runs A1 §4 in order: Completed (derived this scan) → Deferred → abnormal
// blockers on the step's NEXT action (§15) → started (§3) → Ready → Up Next. The graph
// is dependency-data.json (parsed from A1 §8 and §10); nothing here names a step id.
//
// Inputs are observations, never stored state: TenantState says what the scan saw
// (object exists, drift, evidence, conditions, non-step prerequisites), OwnerState
// says what the owner chose (deferred steps, resolved mappings and decisions).
// Anything unstated is read conservatively: an unlisted non-step prerequisite is
// unresolved and blocking (§8.1 "never silently satisfy"); an unlisted condition is
// unresolved and its edge participates.

import type { Action, DependencyData, Edge, Milestone, StepIndexEntry } from './parseDependencyDoc.ts'

export type Lane = 'Ready' | 'Up Next' | 'On Hold' | 'Completed' | 'Deferred'
export type Substatus = 'Create' | 'Correct' | 'Needs decision' | 'Observing' | 'Ready to enforce'

/** The action ladder a step walks (§4 next-action determination). */
export type StepKind = 'policy' | 'object' | 'decision'

/** Caller-supplied abnormal blockers the graph cannot carry (§15 rows without an edge, or a
 *  conflict / mapping the scan found on the step itself rather than on a listed prerequisite). */
export type ObservedBlockerKind = 'license/platform' | 'fact' | 'missingObject' | 'unsupported' | 'sourceConflict' | 'baselineSafetyConflict' | 'sourceMapping'

export type StepObservation = {
  /** Overrides the ladder derived from the graph (gated actions / effort_kind). */
  kind?: StepKind
  /** Target object exists in the tenant, in any state (policy Report-only counts). */
  exists?: boolean
  /** Object exists but differs from the pinned target. */
  drift?: boolean
  /** Policy evidence predicate satisfied (§7); objects: work is finished but not yet complete. */
  evidenceSatisfied?: boolean
  /** Policy is On / object at its intended terminal configuration. */
  enforced?: boolean
  /** Terminal intended outcome reached — derived by the scan, never stored (§2). Decisions: recorded. */
  complete?: boolean
  /** Named milestones reached short of complete (§9.1: 'minimum-satisfied', 'hardening-complete'). */
  milestones?: readonly Milestone[]
  /** Abnormal blockers the scan found on this step itself (missing license, unresolved required fact…). */
  blockers?: readonly { kind: ObservedBlockerKind; id: string }[]
}

export type ConditionState = 'applicable' | 'not-applicable' | 'unresolved'
export type PrerequisiteState = 'resolved' | 'actionable' | 'blocked'

export type TenantState = {
  steps: Readonly<Record<string, StepObservation>>
  conditions?: Readonly<Record<string, ConditionState>>
  /** Non-step prerequisites by id (`sourceMapping:62d67e66`, `decision:workload-identity-type`…). */
  prerequisites?: Readonly<Record<string, PrerequisiteState>>
}

export type OwnerState = {
  deferred?: readonly string[]
  /** Non-step prerequisite ids the owner resolved (Baseline mappings, recorded decisions). */
  resolved?: readonly string[]
}

/** §15 kinds, in primary-blocker order, plus the healthy prerequisite readings. */
export type BlockerKind =
  | 'baselineSafetyConflict' | 'sourceConflict' | 'sourceMapping' | 'license/platform'
  | 'decision' | 'fact' | 'missingObject' | 'step' | 'suspendedPrerequisite' | 'unsupported'

export type Blocker = {
  kind: BlockerKind
  /** Prerequisite id: a step id or a non-step id. */
  id: string
  milestone: Milestone | null
  condition: string | null
  /** True for §15 blockers (On Hold); false for a healthy unresolved prerequisite (Up Next / Observing). */
  abnormal: boolean
  /** Healthy step prerequisites: §14 rule 2 ordinal of the prerequisite's own substatus. */
  ordinal: number
}

export type LaneResult = {
  lane: Lane
  substatus: Substatus | null
  nextAction: Action | null
  started: boolean
  /** On Hold: the primary blocker. Up Next: the nearest unresolved prerequisite. Otherwise null. */
  reason: Blocker | null
  /** On Hold: §15 order, primary first. Ready / Up Next: the unresolved prerequisites of the next action. */
  blockers: Blocker[]
  /** §14 rule 1: distinct not-yet-completed steps before the next action is executable. */
  layers: number
}

const BLOCKER_ORDER: readonly BlockerKind[] = [
  'baselineSafetyConflict', 'sourceConflict', 'sourceMapping', 'license/platform',
  'decision', 'fact', 'missingObject', 'step', 'suspendedPrerequisite', 'unsupported',
]

/** §14 rule 2: nearest blocker closest to completion. */
const SUBSTATUS_ORDINAL: Readonly<Record<Substatus, number>> = {
  'Ready to enforce': 0, Observing: 1, Correct: 2, Create: 3, 'Needs decision': 4,
}
const UP_NEXT_ORDINAL = 5

export type Graph = {
  data: DependencyData
  steps: ReadonlyMap<string, StepIndexEntry>
  /** Edges by gated step. */
  gates: ReadonlyMap<string, readonly Edge[]>
  /** Edges by prerequisite step. */
  dependents: ReadonlyMap<string, readonly Edge[]>
  /** Condition name → owning step. */
  conditionOwner: ReadonlyMap<string, string>
  kinds: ReadonlyMap<string, StepKind>
}

export function buildGraph(data: DependencyData): Graph {
  const steps = new Map(data.steps.map((s) => [s.id, s]))
  const gates = new Map<string, Edge[]>()
  const dependents = new Map<string, Edge[]>()
  for (const e of data.edges) {
    ;(gates.get(e.step) ?? gates.set(e.step, []).get(e.step)!).push(e)
    if (e.prerequisiteKind === 'step') (dependents.get(e.prerequisite) ?? dependents.set(e.prerequisite, []).get(e.prerequisite)!).push(e)
  }
  const kinds = new Map<string, StepKind>()
  for (const s of data.steps) {
    const actions = new Set((gates.get(s.id) ?? []).map((e) => e.action))
    const kind: StepKind = actions.has('create') || actions.has('enforce') || actions.has('observe') ? 'policy'
      : actions.has('decide') || s.effortKind === 'decision' ? 'decision'
      : 'object'
    kinds.set(s.id, kind)
  }
  return {
    data, steps, gates, dependents, kinds,
    conditionOwner: new Map(data.conditions.map((c) => [c.name, c.ownedBy])),
  }
}

type Ctx = {
  graph: Graph
  tenant: TenantState
  owner: OwnerState
  memo: Map<string, LaneResult>
  inProgress: Set<string>
}

function observation(ctx: Ctx, id: string): StepObservation { return ctx.tenant.steps[id] ?? {} }
function kindOf(ctx: Ctx, id: string): StepKind { return observation(ctx, id).kind ?? ctx.graph.kinds.get(id) ?? 'object' }
function conditionState(ctx: Ctx, name: string | null): ConditionState {
  return name === null ? 'applicable' : ctx.tenant.conditions?.[name] ?? 'unresolved'
}
function prerequisiteState(ctx: Ctx, id: string): PrerequisiteState {
  if (ctx.owner.resolved?.includes(id)) return 'resolved'
  return ctx.tenant.prerequisites?.[id] ?? 'blocked'
}

/** §8.1: an edge participates unless its condition is resolved not-applicable. */
function applicable(ctx: Ctx, e: Edge): boolean { return conditionState(ctx, e.condition) !== 'not-applicable' }

/** §2 / §8.2: terminal outcome reached this scan. */
function isComplete(ctx: Ctx, id: string): boolean {
  const obs = observation(ctx, id)
  if (obs.complete) return true
  // A question step whose condition resolved not-applicable has nothing left to do (§8.2).
  for (const c of ctx.graph.data.conditions) {
    if (c.ownedBy === id && ctx.tenant.conditions?.[c.name] === 'not-applicable' && !obs.exists) return true
  }
  return false
}

/** §4 next-action determination. */
export function nextActionOf(kind: StepKind, obs: StepObservation): Action {
  if (kind === 'decision') return 'decide'
  if (!obs.exists) return kind === 'policy' ? 'create' : 'start'
  if (obs.drift) return 'correct'
  if (kind === 'policy') return obs.evidenceSatisfied ? 'enforce' : 'observe'
  return 'complete'
}

/** Milestone reached by a prerequisite step, read from its observation (§5). `requester` breaks the
 *  reciprocal cutover pair (§9.5): ready-to-enforce ignores the enforce gate the requester itself owns. */
function milestoneReached(ctx: Ctx, id: string, milestone: Milestone, requester: string): boolean {
  const obs = observation(ctx, id)
  if (isComplete(ctx, id)) return true
  switch (milestone) {
    case 'complete': case 'resolved': return false
    case 'created': return obs.exists === true
    case 'enforced': return obs.enforced === true
    case 'minimum-satisfied': case 'hardening-complete': return obs.milestones?.includes(milestone) === true
    case 'ready-to-enforce': {
      if (!obs.exists || obs.drift || !obs.evidenceSatisfied) return false
      return (ctx.graph.gates.get(id) ?? []).every((e) =>
        e.action !== 'enforce' || e.prerequisite === requester || !applicable(ctx, e) || edgeSatisfied(ctx, e))
    }
  }
}

function edgeSatisfied(ctx: Ctx, e: Edge): boolean {
  if (!applicable(ctx, e)) return true
  if (e.prerequisiteKind === 'step') return milestoneReached(ctx, e.prerequisite, e.milestone, e.step)
  return prerequisiteState(ctx, e.prerequisite) === 'resolved'
}

function blocker(kind: BlockerKind, id: string, e: Edge | null, abnormal: boolean, ordinal = UP_NEXT_ORDINAL): Blocker {
  return { kind, id, milestone: e?.milestone ?? null, condition: e?.condition ?? null, abnormal, ordinal }
}

function nonStepKind(e: Edge, state: PrerequisiteState): BlockerKind {
  switch (e.prerequisiteKind) {
    case 'baselineSafetyConflict': case 'sourceConflict': case 'sourceMapping': case 'license/platform': case 'decision':
      return e.prerequisiteKind
    case 'fact': return state === 'blocked' ? 'fact' : 'missingObject'
    default: return 'fact'
  }
}

/** Every unresolved prerequisite of `action` on `id`, abnormal or healthy, in edge order. A Deferred
 *  prerequisite on any applicable edge of the step counts too (§8.3 propagates to the dependent step,
 *  whichever action it gates: examples 5 and 10 hold an observing policy on an enforce-side edge). */
function unresolvedOn(ctx: Ctx, id: string, action: Action): Blocker[] {
  const out: Blocker[] = []
  for (const e of ctx.graph.gates.get(id) ?? []) {
    if (edgeSatisfied(ctx, e)) continue
    if (e.action !== action) {
      if (e.prerequisiteKind === 'step' && derive(ctx, e.prerequisite).lane === 'Deferred') {
        out.push(blocker('suspendedPrerequisite', e.prerequisite, e, true))
      }
      continue
    }
    if (e.prerequisiteKind !== 'step') {
      const state = prerequisiteState(ctx, e.prerequisite)
      // An actionable decision is healthy queue work (§4 decision rule); everything else unresolved holds.
      const healthy = e.prerequisiteKind === 'decision' && state === 'actionable'
      out.push(blocker(nonStepKind(e, state), e.prerequisite, e, !healthy, SUBSTATUS_ORDINAL['Needs decision']))
      continue
    }
    const pre = derive(ctx, e.prerequisite)
    if (pre.lane === 'Deferred') out.push(blocker('suspendedPrerequisite', e.prerequisite, e, true))
    else if (pre.lane === 'On Hold') out.push(blocker('step', e.prerequisite, e, true))
    else out.push(blocker('step', e.prerequisite, e, false, pre.substatus ? SUBSTATUS_ORDINAL[pre.substatus] : UP_NEXT_ORDINAL))
  }
  return out
}

function byTaxonomy(a: Blocker, b: Blocker): number {
  return BLOCKER_ORDER.indexOf(a.kind) - BLOCKER_ORDER.indexOf(b.kind) || a.id.localeCompare(b.id)
}

function nearest(a: Blocker, b: Blocker): number {
  return a.ordinal - b.ordinal || a.id.localeCompare(b.id)
}

const LADDER: Readonly<Record<StepKind, readonly Action[]>> = {
  policy: ['create', 'correct', 'observe', 'enforce'],
  object: ['start', 'correct', 'complete'],
  decision: ['decide'],
}
const EARLY: readonly Action[] = ['create', 'start', 'correct']

/** The actions a prerequisite still has to pass to reach `milestone`, from its own next action on. */
function remainingActions(ctx: Ctx, id: string, milestone: Milestone): readonly Action[] {
  const kind = kindOf(ctx, id)
  const ladder = LADDER[kind]
  const rest = ladder.slice(ladder.indexOf(nextActionOf(kind, observation(ctx, id))))
  // `created` and `minimum-satisfied` are reached at the start of the ladder.
  return milestone === 'created' || milestone === 'minimum-satisfied' ? rest.filter((a) => EARLY.includes(a)) : rest
}

/** §14 rule 1: distinct incomplete steps that must complete before `action` on `id` is executable. */
function layersOf(ctx: Ctx, id: string, action: Action): number {
  const seen = new Set<string>()
  const visit = (step: string, actions: readonly Action[]): void => {
    for (const e of ctx.graph.gates.get(step) ?? []) {
      if (!actions.includes(e.action)) continue
      if (e.prerequisiteKind !== 'step' || edgeSatisfied(ctx, e)) continue
      if (e.prerequisite === id || seen.has(e.prerequisite)) continue
      seen.add(e.prerequisite)
      visit(e.prerequisite, remainingActions(ctx, e.prerequisite, e.milestone))
    }
  }
  visit(id, [action])
  return seen.size
}

function result(lane: Lane, partial: Partial<LaneResult> = {}): LaneResult {
  return { lane, substatus: null, nextAction: null, started: false, reason: null, blockers: [], layers: 0, ...partial }
}

function derive(ctx: Ctx, id: string): LaneResult {
  const memoised = ctx.memo.get(id)
  if (memoised) return memoised
  // A cycle (only the reciprocal cutover pair can form one) reads as healthy queued work, never a hold.
  if (ctx.inProgress.has(id)) return result('Up Next')
  ctx.inProgress.add(id)
  const value = deriveUncached(ctx, id)
  ctx.inProgress.delete(id)
  ctx.memo.set(id, value)
  return value
}

function deriveUncached(ctx: Ctx, id: string): LaneResult {
  if (!ctx.graph.steps.has(id)) throw new Error(`deriveLane: unknown step ${id}`)
  const obs = observation(ctx, id)
  const kind = kindOf(ctx, id)

  // 1. Terminal intended outcome reached this scan.
  if (isComplete(ctx, id)) return result('Completed')
  // 2. Owner-deferred.
  if (ctx.owner.deferred?.includes(id)) return result('Deferred')

  const nextAction = nextActionOf(kind, obs)
  const started = kind !== 'decision' && obs.exists === true
  const layers = layersOf(ctx, id, nextAction)

  // 3. Abnormal blockers on the next action (§15), the step's own observed blockers included.
  const unresolved = unresolvedOn(ctx, id, nextAction)
  const abnormal = [
    ...(obs.blockers ?? []).map((b) => blocker(b.kind, b.id, null, true)),
    ...unresolved.filter((b) => b.abnormal),
  ].sort(byTaxonomy)
  if (abnormal.length) {
    const healthy = unresolved.filter((b) => !b.abnormal).sort(nearest)
    return result('On Hold', { nextAction, started, reason: abnormal[0]!, blockers: [...abnormal, ...healthy], layers })
  }

  const healthy = unresolved.sort(nearest)
  // 4–5. Started and progressing normally.
  if (started) {
    const substatus: Substatus = nextAction === 'correct' ? 'Correct'
      : nextAction === 'enforce' && healthy.length === 0 ? 'Ready to enforce'
      : 'Observing'
    return result('Ready', { substatus, nextAction, started, blockers: healthy, layers })
  }
  // 6. Not started, next safe action executable now.
  if (healthy.length === 0) {
    return result('Ready', { substatus: kind === 'decision' ? 'Needs decision' : 'Create', nextAction, started, layers })
  }
  // 7. Not started, chain healthy: queued behind its nearest unresolved prerequisite.
  return result('Up Next', { nextAction, started, reason: healthy[0]!, blockers: healthy, layers })
}

export function deriveLane(step: string, graph: Graph, tenantState: TenantState, ownerState: OwnerState = {}): LaneResult {
  return derive({ graph, tenant: tenantState, owner: ownerState, memo: new Map(), inProgress: new Set() }, step)
}

/** Every step of the graph in one pass (one memo, so prerequisite lanes are derived once). */
export function deriveLanes(graph: Graph, tenantState: TenantState, ownerState: OwnerState = {}): Map<string, LaneResult> {
  const ctx: Ctx = { graph, tenant: tenantState, owner: ownerState, memo: new Map(), inProgress: new Set() }
  const out = new Map<string, LaneResult>()
  for (const s of graph.data.steps) out.set(s.id, derive(ctx, s.id))
  return out
}
