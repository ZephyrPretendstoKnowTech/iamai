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
// Two prerequisites and no more, because they are the two the plan reads
// without the person's answers: the drill from its own Cleanup record (the
// same `done` the board's row reads, roadmap/cleanupDone.ts cleanupComplete),
// and security defaults from the scan (the step is satisfied exactly when the
// scan reads them off, generate.ts). The graph's other enforce edges stay the
// lane engine's to sequence: the emergency accounts' minimum is already the
// escape hatch (generate.ts `escapeHatch`), the readiness campaign's own number
// is the readiness gate, and a conditional carve-out turns on an answer only
// the board holds.
import data from '../actionability/dependency-data.json' with { type: 'json' }
import { cleanup as cleanupWords } from '../content/content.ts'
import { contentTitle } from '../content/stepTitle.ts'
import type { Schedule } from './schedule.ts'
import type { Step } from './types.ts'

/** The Cleanup row that is the emergency-access recovery test, by the id the graph gives it. */
export const DRILL_PREREQUISITE = 'cleanup-drill'
/** The step that turns security defaults off, and the graph condition that says they are on. */
export const SECURITY_DEFAULTS_STEP_ID = 's-prereq-security-defaults'
const SECURITY_DEFAULTS_ON = 'sd-enabled'

type Edge = { step: string; action: string; prerequisite: string; milestone: string; condition: string | null; edgeKind: string }

/** Every policy step's enforce edges on the two prerequisites, from the graph. */
const EDGES: readonly Edge[] = (data as { edges: Edge[] }).edges.filter((e) =>
  e.action === 'enforce' && e.milestone === 'complete' && (
    (e.prerequisite === DRILL_PREREQUISITE && e.edgeKind === 'hard' && e.condition === null)
    || (e.prerequisite === SECURITY_DEFAULTS_STEP_ID && e.edgeKind === 'conditional' && e.condition === SECURITY_DEFAULTS_ON)))

/** A step whose policy the plan is still writing: the only kind whose turn-on can be handed over. */
const openPolicy = (s: Step): boolean => (s.kind === 'create' || s.kind === 'adjust') && s.status !== 'done' && s.status !== 'skipped' && !s.state.satisfied && !s.state.setAside

/**
 * The unmet prerequisites of turning each open policy on, by step id, each with
 * the title the board gives it. A prerequisite the plan does not carry is not
 * one it can be waiting on (the lane engine reads a graph step the plan lacks
 * as complete, planLanes.ts tenantStateOf).
 */
export function enforceWaitsOf(steps: readonly Step[], schedule: Pick<Schedule, 'cleanup'>): Map<string, { id: string; title: string }[]> {
  const drill = (schedule.cleanup?.rows ?? []).find((r) => r.kind === 'drill') ?? null
  const drillOpen = drill !== null && drill.done === null
  const drillTitle = (cleanupWords as Record<string, { title?: string }>).drill?.title ?? 'Verify Emergency Access'
  const sd = steps.find((s) => s.id === SECURITY_DEFAULTS_STEP_ID) ?? null
  // On while its step is on the plan and not satisfied: satisfied is the scan
  // reading them off (generate.ts). A step said not to apply resolves the
  // condition not-applicable, as the lane engine reads it (planLanes.ts conditionOf).
  const sdOn = sd !== null && !sd.state.satisfied && sd.doesntApply == null
  const out = new Map<string, { id: string; title: string }[]>()
  for (const s of steps) {
    if (!openPolicy(s)) continue
    const waits: { id: string; title: string }[] = []
    for (const e of EDGES) {
      if (e.step !== s.id || waits.some((w) => w.id === e.prerequisite)) continue
      if (e.prerequisite === DRILL_PREREQUISITE && drillOpen) waits.push({ id: DRILL_PREREQUISITE, title: drillTitle })
      if (e.prerequisite === SECURITY_DEFAULTS_STEP_ID && sdOn && sd !== null) waits.push({ id: SECURITY_DEFAULTS_STEP_ID, title: sd.plainTitle || contentTitle(sd) })
    }
    if (waits.length > 0) out.set(s.id, waits)
  }
  return out
}

/** Writes `Action.enforceWaitsOn` on every step from `enforceWaitsOf`, and takes it off every other. */
export function settleEnforceWaits(steps: Step[], schedule: Pick<Schedule, 'cleanup'>): void {
  const waits = enforceWaitsOf(steps, schedule)
  for (const s of steps) {
    const w = waits.get(s.id)
    if (w) s.action = { ...s.action, enforceWaitsOn: w }
    else if (s.action.enforceWaitsOn) { const { enforceWaitsOn: _, ...rest } = s.action; s.action = rest }
  }
}
