// Lane engine — a pure reading of the dependency playbook (A1) over one scan.
//
// deriveLane runs A1 §4 in order: Completed (derived this scan) → Deferred → abnormal
// blockers on the step's NEXT action (§15) → started (§3) → Ready → Up Next. The graph
// is dependency-data.json (parsed from A1 §8 and §10); nothing here names a step id.
//
// Inputs are observations, never stored state: TenantState says what the scan saw
// (object exists, drift, evidence gates, conditions, non-step prerequisites, and the
// step edges and blockers the graph cannot carry), OwnerState says what the owner
// chose (deferred steps, resolved mappings and decisions). Anything unstated is read
// conservatively: an unlisted non-step prerequisite is unresolved and blocking (§8.1
// "never silently satisfy"); an unlisted condition is unresolved and its edge
// participates.
//
// Evidence is never a hold (§7). An evidence gate — the observation predicate, a
// readiness threshold, an `evidence` or `time/evidence-window` edge — gates `enforce`
// only: a started policy behind an open one reads Ready · Observing with the gate as
// its reason, and an unstarted policy's create never waits on it. Every kind of hold
// the legacy roadmap/holds.ts knew has a counterpart here (A1a).

import type { Action, DependencyData, Edge, Milestone, StepIndexEntry } from './parseDependencyDoc.ts'

export type Lane = 'Ready' | 'Up Next' | 'On Hold' | 'Completed' | 'Deferred'
export type Substatus = 'Create' | 'Correct' | 'Needs decision' | 'Observing' | 'Ready to enforce'

/** The action ladder a step walks (§4 next-action determination). */
export type StepKind = 'policy' | 'object' | 'decision'

/** Caller-supplied abnormal blockers the graph cannot carry (§15 rows without an edge, or a
 *  conflict / mapping the scan found on the step itself rather than on a listed prerequisite). */
export type ObservedBlockerKind = 'license/platform' | 'fact' | 'missingObject' | 'unsupported' | 'sourceConflict' | 'baselineSafetyConflict' | 'sourceMapping'

export type ObservedBlocker = {
  kind: ObservedBlockerKind
  id: string
  /** `sourceMapping` only: the part the reference plays in the policy (§18.1). */
  role?: SourceRole
  /** The one action it holds; unstated, it holds whichever action is next. */
  action?: Action
}

/** A step edge the graph does not carry: the plan's own wait on a maker step, or the
 *  emergency gate on a policy's enforcement (the legacy `prerequisite` hold). */
export type ObservedEdge = { step: string; action: Action; milestone?: Milestone }

/** An evidence predicate on `enforce` (§7): the observation window, a readiness threshold, an evidence edge. */
export type EvidenceGate = {
  /** `evidence:<what>`, or the graph edge's prerequisite id. */
  id: string
  satisfied: boolean
  /** The predicate's time component in days where it has one (RUN-CONTEXT-A decision 5:
   *  the package's `observation.minDays`, else the plan's 7 / 3); null where it has none. */
  minDays: number | null
  /** The gate's own words — a threshold, the records' state — or null. */
  reason: string | null
}

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
  blockers?: readonly ObservedBlocker[]
  /** Evidence gates on this policy's enforcement the graph does not carry (§7). */
  gates?: readonly EvidenceGate[]
  /** Step edges the graph does not carry; one the graph already has on the same action is read once. */
  waitsOn?: readonly ObservedEdge[]
}

/** The part an unmapped source reference plays in the policy it holds: an exception, a target, or both. */
export type SourceRole = 'include' | 'exclude' | 'both'

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

/** §15 kinds, in primary-blocker order, the healthy prerequisite readings, and `evidence`:
 *  an open evidence gate, the reason of a Ready · Observing step and never a hold. */
export type BlockerKind =
  | 'baselineSafetyConflict' | 'sourceConflict' | 'sourceMapping' | 'license/platform'
  | 'decision' | 'fact' | 'missingObject' | 'step' | 'suspendedPrerequisite' | 'unsupported'
  | 'evidence'

/** The kinds a prerequisite tile or an On Hold heading can carry: every kind but the evidence gate. */
export type HoldBlockerKind = Exclude<BlockerKind, 'evidence'>
/** A blocker that is a prerequisite, as the board and the Readiness tiles read it. */
export type HoldBlocker = Blocker & { kind: HoldBlockerKind }

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
  /** `sourceMapping` only: include | exclude | both, as the observed blocker stated it. */
  role?: SourceRole
  /** `evidence` only: the gate's own words (a threshold, the records' state). */
  text?: string
}

export type LaneResult = {
  lane: Lane
  substatus: Substatus | null
  nextAction: Action | null
  started: boolean
  /** On Hold: the primary blocker. Up Next: the nearest unresolved prerequisite.
   *  Ready · Observing: the open evidence gate, else the nearest unresolved prerequisite. Otherwise null. */
  reason: Blocker | null
  /** On Hold: §15 order, primary first. Ready / Up Next: the unresolved prerequisites of the next action. */
  blockers: Blocker[]
  /** Policy steps: every evidence gate on enforcement, satisfied or not, with its time part (§7). */
  gates: EvidenceGate[]
  /** §14 rule 1: distinct not-yet-completed steps before the next action is executable. */
  layers: number
}

const BLOCKER_ORDER: readonly BlockerKind[] = [
  'baselineSafetyConflict', 'sourceConflict', 'sourceMapping', 'license/platform',
  'decision', 'fact', 'missingObject', 'step', 'suspendedPrerequisite', 'unsupported', 'evidence',
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

/** §7: an evidence predicate authored as an edge. Read as a gate on `enforce`, never as a fact. */
function isEvidenceEdge(e: Edge): boolean { return e.prerequisiteKind === 'evidence' || e.prerequisiteKind === 'time/evidence-window' }

/** The step's gating edges: the graph's, then the observed ones the graph does not already carry. */
function edgesOf(ctx: Ctx, id: string): readonly Edge[] {
  const own = ctx.graph.gates.get(id) ?? []
  const observed = observation(ctx, id).waitsOn ?? []
  if (observed.length === 0) return own
  const extra: Edge[] = []
  for (const w of observed) {
    if (!ctx.graph.steps.has(w.step)) continue
    if (own.some((e) => e.prerequisiteKind === 'step' && e.prerequisite === w.step && e.action === w.action)) continue
    if (extra.some((e) => e.prerequisite === w.step && e.action === w.action)) continue
    extra.push({ step: id, action: w.action, prerequisite: w.step, prerequisiteKind: 'step', milestone: w.milestone ?? 'complete', condition: null, edgeKind: 'hard', source: 'observed', status: 'ok', table: 'observed' })
  }
  return extra.length ? [...own, ...extra] : own
}

/** Every evidence gate on the step's enforcement: the observed ones, then the graph's evidence edges. */
function gatesOf(ctx: Ctx, id: string): EvidenceGate[] {
  const out: EvidenceGate[] = [...(observation(ctx, id).gates ?? [])]
  for (const e of ctx.graph.gates.get(id) ?? []) {
    if (!isEvidenceEdge(e) || !applicable(ctx, e)) continue
    out.push({ id: e.prerequisite, satisfied: prerequisiteState(ctx, e.prerequisite) === 'resolved', minDays: null, reason: null })
  }
  return out
}

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
      if (gatesOf(ctx, id).some((g) => !g.satisfied)) return false
      return edgesOf(ctx, id).every((e) =>
        e.action !== 'enforce' || isEvidenceEdge(e) || e.prerequisite === requester || !applicable(ctx, e) || edgeSatisfied(ctx, e))
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

/** An open evidence gate as the reason of a Ready · Observing step: healthy, never a hold. */
function evidenceBlocker(g: EvidenceGate): Blocker {
  return { kind: 'evidence', id: g.id, milestone: null, condition: null, abnormal: false, ordinal: SUBSTATUS_ORDINAL.Observing, ...(g.reason !== null ? { text: g.reason } : {}) }
}

/** The §15 kind of a non-step edge, each its own; evidence edges never reach here (§7). */
function nonStepKind(e: Edge, state: PrerequisiteState): BlockerKind {
  switch (e.prerequisiteKind) {
    case 'baselineSafetyConflict': case 'sourceConflict': case 'sourceMapping': case 'license/platform': case 'decision': case 'suspendedPrerequisite':
      return e.prerequisiteKind
    // §8.4: a required object no step produces holds; a fact still to be established holds too.
    case 'fact': return state === 'blocked' ? 'fact' : 'missingObject'
    case 'evidence': case 'time/evidence-window': return 'evidence'
    case 'step': return 'step'
  }
}

/** Every unresolved prerequisite of `action` on `id`, abnormal or healthy, in edge order. A Deferred
 *  prerequisite on any applicable edge of the step counts too (§8.3 propagates to the dependent step,
 *  whichever action it gates: examples 5 and 10 hold an observing policy on an enforce-side edge). */
function unresolvedOn(ctx: Ctx, id: string, action: Action): Blocker[] {
  const out: Blocker[] = []
  for (const e of edgesOf(ctx, id)) {
    if (isEvidenceEdge(e) || edgeSatisfied(ctx, e)) continue
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
    for (const e of edgesOf(ctx, step)) {
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
  return { lane, substatus: null, nextAction: null, started: false, reason: null, blockers: [], gates: [], layers: 0, ...partial }
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
  const gates = kind === 'policy' ? gatesOf(ctx, id) : []

  // 3. Abnormal blockers on the next action (§15), the step's own observed blockers included.
  const unresolved = unresolvedOn(ctx, id, nextAction)
  const abnormal = [
    ...(obs.blockers ?? [])
      .filter((b) => b.action === undefined || b.action === nextAction)
      .map((b) => ({ ...blocker(b.kind, b.id, null, true), ...(b.role ? { role: b.role } : {}) })),
    ...unresolved.filter((b) => b.abnormal),
  ].sort(byTaxonomy)
  if (abnormal.length) {
    const healthy = unresolved.filter((b) => !b.abnormal).sort(nearest)
    return result('On Hold', { nextAction, started, reason: abnormal[0]!, blockers: [...abnormal, ...healthy], gates, layers })
  }

  const healthy = unresolved.sort(nearest)
  // 4–5. Started and progressing normally. Evidence gates matter once the object is as pinned:
  // a correction comes first, and enforcement waits for every gate to close (§7).
  if (started) {
    if (nextAction === 'correct') return result('Ready', { substatus: 'Correct', nextAction, started, blockers: healthy, gates, layers })
    const open = gates.filter((g) => !g.satisfied)
    if (nextAction === 'enforce' && healthy.length === 0 && open.length === 0) {
      return result('Ready', { substatus: 'Ready to enforce', nextAction, started, gates, layers })
    }
    const reason = open[0] ? evidenceBlocker(open[0]) : healthy[0] ?? null
    return result('Ready', { substatus: 'Observing', nextAction, started, reason, blockers: healthy, gates, layers })
  }
  // 6. Not started, next safe action executable now.
  if (healthy.length === 0) {
    return result('Ready', { substatus: kind === 'decision' ? 'Needs decision' : 'Create', nextAction, started, gates, layers })
  }
  // 7. Not started, chain healthy: queued behind its nearest unresolved prerequisite.
  return result('Up Next', { nextAction, started, reason: healthy[0]!, blockers: healthy, gates, layers })
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
