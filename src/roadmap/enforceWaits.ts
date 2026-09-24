// The plan's own prerequisites of turning a policy on, where the plan can read
// whether they are met for itself — and where they are not, the one fact that
// holds the turn-on back in every channel (types.ts `Action.enforceWaitsOn`,
// operations.ts `policyResult`, hold `prerequisite-unmet`).
//
// The board already read these. The dependency graph
// (src/actionability/dependency-data.json) puts every Conditional Access
// policy's ENFORCE behind the emergency-access recovery test (the Cleanup
// drill, owner) and, while security defaults are on, behind Turn Off Security
// Defaults (Microsoft: a policy cannot be turned on beside them). The lane
// engine read both and filed the step On Hold. Foundation B read neither, so
// the same step handed over "Change Enable policy to On", `{"state":"enabled"}`,
// a PowerShell Enforce mode with the policy id filled in, and AI Info saying
// "the next action is enforcement". The only dissent was one "Stop" line
// spliced into one channel (ui/surfaces/policyTasks.ts). A reader enforced
// eight policies with security defaults on (Sam D2); another was handed an
// enabling script with the recovery test still undone (Nadia D1). A warning
// beside an instruction is still the instruction. This stops giving it.
//
// It held the turn-on for two prerequisites only — the drill and security
// defaults — on the premise that the readiness gates covered the rest. They do
// not: the risk policies have no readiness threshold, and Block Legacy
// Authentication's wait is the service-accounts group. A sign-in risk policy a
// week into report-only said "Change Enable policy to On" beside a Stop line
// while thirty people were still without a method, and every one of them would
// be blocked the next time Entra flagged their sign-in. So every prerequisite
// of turning the policy on that the board reads holds it here too (owner
// decision 6, 2026-09-22): each step prerequisite the graph puts on ENFORCE,
// hard, or conditional where this plan does not rule the condition out — the
// board's own rule (actionability/lanes.ts `applicable`), over the board's own
// condition reading (roadmap/graphConditions.ts). The drill is read from its
// Cleanup record (the same `done` the board's row reads, roadmap/cleanupDone.ts
// cleanupComplete); every other prerequisite is a step on the plan, waiting
// until it is done. Two stay the lane engine's: the emergency accounts' minimum
// is already the escape hatch (generate.ts `escapeHatch`), and a decision
// prerequisite already holds its policy as Needs decision.
import data from '../actionability/dependency-data.json' with { type: 'json' }
import { cleanup as cleanupWords } from '../content/content.ts'
import { contentTitle } from '../content/stepTitle.ts'
import { graphConditions } from './graphConditions.ts'
import type { PlanAnswers } from './graphConditions.ts'
import { positionInGroup } from './stepGroups.ts'
import type { Schedule } from './schedule.ts'
import type { Step } from './types.ts'

/** The Cleanup row that is the emergency-access recovery test, by the id the graph gives it. */
export const DRILL_PREREQUISITE = 'cleanup-drill'
/** The step that turns security defaults off. */
export const SECURITY_DEFAULTS_STEP_ID = 's-prereq-security-defaults'

type Edge = { step: string; action: string; prerequisite: string; prerequisiteKind: string; milestone: string; condition: string | null; edgeKind: string }

/**
 * The policies Turn Off Security Defaults turns on in the same change: the steps
 * the graph starts it on, in the Plan's order (stepGroups.ts). Their turn-ons
 * wait on security defaults being off, so once someone saves Disabled no other
 * step says to turn them on until a scan reads it (walk list 4.x item 8).
 */
const SECURITY_DEFAULTS_TURNS_ON: readonly string[] = [...new Set((data as { edges: Edge[] }).edges
  .filter((e) => e.step === SECURITY_DEFAULTS_STEP_ID && e.action === 'start' && e.prerequisiteKind === 'step')
  .map((e) => e.prerequisite))]
  .sort((a, b) => (positionInGroup(a) ?? Number.MAX_SAFE_INTEGER) - (positionInGroup(b) ?? Number.MAX_SAFE_INTEGER))

/**
 * Writes Turn Off Security Defaults' `turnsOn`: each of those policies on the
 * plan, by the name it has in the tenant, else the name the plan creates it
 * under. A policy deferred or ruled out here is not one it turns on. Run once
 * tracking has read every policy (progress.ts applyProgress).
 */
export function noteTurnOns(steps: readonly Step[]): void {
  const sd = steps.find((s) => s.id === SECURITY_DEFAULTS_STEP_ID)
  if (sd === undefined) return
  const byId = new Map(steps.map((s) => [s.id, s]))
  sd.turnsOn = SECURITY_DEFAULTS_TURNS_ON.flatMap((id) => {
    const s = byId.get(id)
    if (s === undefined || s.status === 'skipped' || s.state.setAside || s.doesntApply != null) return []
    const policy = s.tracking?.policyName || s.naming?.proposed
    return policy ? [{ stepId: id, policy }] : []
  })
}

/** Every policy step's enforce edges on a step prerequisite's completion, from the graph. */
const EDGES: readonly Edge[] = (data as { edges: Edge[] }).edges.filter((e) =>
  e.action === 'enforce' && e.prerequisiteKind === 'step' && e.milestone === 'complete' && (e.edgeKind === 'hard' || e.edgeKind === 'conditional'))

/** A step whose policy the plan is still writing: the only kind whose turn-on can be handed over. */
const openPolicy = (s: Step): boolean => (s.kind === 'create' || s.kind === 'adjust') && s.status !== 'done' && s.status !== 'skipped' && !s.state.satisfied && !s.state.setAside

/**
 * The unmet prerequisites of turning each open policy on, by step id, each with
 * the title the board gives it. A prerequisite the plan does not carry is not
 * one it can be waiting on (the lane engine reads a graph step the plan lacks
 * as complete, planLanes.ts tenantStateOf); a conditional one waits only where
 * the plan does not rule its condition out, as the board reads it.
 */
export function enforceWaitsOf(steps: readonly Step[], schedule: Pick<Schedule, 'cleanup'>, answers?: PlanAnswers): Map<string, { id: string; title: string }[]> {
  const drill = (schedule.cleanup?.rows ?? []).find((r) => r.kind === 'drill') ?? null
  const drillOpen = drill !== null && drill.done === null
  const drillTitle = (cleanupWords as Record<string, { title?: string }>).drill?.title ?? 'Verify Emergency Access'
  const byId = new Map(steps.map((s) => [s.id, s]))
  const conditions = graphConditions(byId, answers)
  const open = (e: Edge): { id: string; title: string } | null => {
    if (e.condition !== null && conditions[e.condition] === 'not-applicable') return null
    if (e.prerequisite === DRILL_PREREQUISITE) return drillOpen ? { id: DRILL_PREREQUISITE, title: drillTitle } : null
    const p = byId.get(e.prerequisite)
    // Done, or said not to apply here (the board reads that as complete, §8.2).
    if (p === undefined || p.status === 'done' || p.doesntApply != null) return null
    return { id: p.id, title: p.plainTitle || contentTitle(p) }
  }
  const out = new Map<string, { id: string; title: string }[]>()
  for (const s of steps) {
    if (!openPolicy(s)) continue
    const waits: { id: string; title: string }[] = []
    for (const e of EDGES) {
      if (e.step !== s.id || waits.some((w) => w.id === e.prerequisite)) continue
      const w = open(e)
      if (w !== null) waits.push(w)
    }
    if (waits.length > 0) out.set(s.id, waits)
  }
  return out
}

/** Writes `Action.enforceWaitsOn` on every step from `enforceWaitsOf`, and takes it off every other. */
export function settleEnforceWaits(steps: Step[], schedule: Pick<Schedule, 'cleanup'>, answers?: PlanAnswers): void {
  const waits = enforceWaitsOf(steps, schedule, answers)
  for (const s of steps) {
    const w = waits.get(s.id)
    if (w) s.action = { ...s.action, enforceWaitsOn: w }
    else if (s.action.enforceWaitsOn) { const { enforceWaitsOn: _, ...rest } = s.action; s.action = rest }
  }
}
