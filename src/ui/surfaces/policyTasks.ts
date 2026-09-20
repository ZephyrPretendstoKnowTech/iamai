// A policy step drawn with the Establish Emergency Access anatomy (owner,
// 2026-09-19: "there will be ZERO lack of uniformity among UI that SHOULD be
// identical"). Every policy step is, after the one-step pilot: the gate is the
// step's own content kind, and no step of another kind moves.
//
// Nothing here is a new surface, and nothing here decides anything.
//
// The Tasks Remaining cards are the step's own policy — the subject an account
// is on Step 1 — followed by its Readiness tiles through the adapter Steps 2-3
// already use (emergencyReadiness.ts emergencySubjectTileOf); the only thing
// added back is the tile's own link, which the strip drew and the card would
// otherwise drop.
//
// The Implementation Tasks are the step's own Entra procedure — the portal
// artifact stepBody.ts already built for this step, read back as the numbered
// steps it is — under a title the step's resolved operations
// (roadmap/operations.ts) already decide. The resolved settings the procedure
// carries below it become the task's facts, which the emergency task frame
// already draws.
//
// Pure: no DOM, no React, no network.
import type { Step } from '../../roadmap/types.ts'
import type { Lifecycle } from '../../roadmap/lifecycle.ts'
import { implementationIsCurrent } from '../../roadmap/nextSafeAction.ts'
import { contentStepForPackage } from '../../content/stepTitle.ts'
import { enforcesByStateOnly, stepOperations } from './stepJson.ts'
import type { ContractReadiness, ContractStage, StepContract } from './stepContract.ts'
import { emergencySubjectTileOf } from './emergencyReadiness.ts'
import type { EmergencySubjectTile } from './emergencyReadiness.ts'
import type { EmergencyAccountTask, EmergencyTaskProjection } from './emergencyAccountTasks.ts'

/**
 * Whether this step draws the Emergency Access task anatomy although it is a
 * policy step. Every policy step does (owner, 2026-09-19, after the one-step
 * pilot): the gate is the step's own content kind, so there is no second list
 * of ids to keep in step with the content.
 */
export function usesPolicyTaskAnatomy(stepId: string): boolean {
  return (contentStepForPackage(stepId) as { kind?: string } | undefined)?.kind === 'policy'
}

/**
 * The one policy whose resolved settings stand under its Entra procedure, folded
 * (owner, 2026-09-19: the deviation is approved on one policy before it goes
 * wider). Adding a step is adding an id here.
 */
export const POLICY_SETTINGS_STEP_IDS: readonly string[] = ['s-goal-admin-session']

/** Whether this step's Entra task offers its resolved settings on screen. */
export function drawsPolicySettings(stepId: string): boolean {
  return POLICY_SETTINGS_STEP_IDS.includes(stepId)
}

/** A step's portal channel, as stepBody.ts built it; only its text is read. */
type PortalArtifact = { id: string; text: () => string }

/**
 * What the operations this step submits make of the procedure, in the words the
 * step's own state already uses: a create lands in report-only (generate.ts
 * buildCreateAction), the state-only update is the one that turns the policy on,
 * and anything else changes settings.
 */
function taskTitle(step: Step, fallback: string): string {
  const ops = stepOperations(step)
  if (ops.length === 0) return fallback
  if (ops.every((op) => op.mode === 'create')) {
    return ops.every((op) => String((op.body as { state?: unknown }).state ?? '') === 'enabledForReportingButNotEnforced')
      ? 'Create the policy in Report-only'
      : 'Create the policy'
  }
  return enforcesByStateOnly(step) ? 'Turn the policy on' : 'Update the policy settings'
}

/**
 * The portal artifact read back as the procedure it is: its numbered lines are
 * the task's steps, and the resolved settings listed under the artifact's own
 * heading are the task's facts. Nothing is composed — every line is the
 * artifact's.
 */
export function portalProcedureOf(text: string): { steps: string[]; facts: { label: string; value: string }[] } {
  const steps: string[] = []
  const facts: { label: string; value: string }[] = []
  let underHeading = false
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '') continue
    if (/^#{1,6}\s/.test(line)) {
      underHeading = true
      continue
    }
    const item = /^(?:\d+\.|[-*])\s+(.*)$/.exec(line)?.[1] ?? line
    if (!underHeading) {
      steps.push(item)
      continue
    }
    const split = /^(.{1,64}?):\s+(.*)$/.exec(item)
    facts.push(split ? { label: split[1], value: split[2] } : { label: 'Setting', value: item })
  }
  return { steps, facts }
}

/**
 * This step's Implementation Tasks: one task, because the step has one Entra
 * procedure. A step whose portal channel has no procedure gets no projection and
 * keeps the body it always drew — and so does a step whose baseline contradicts
 * itself, because nothing anybody does in the portal resolves that (stepContract
 * `fixOf`: such a step asks for nothing), and a task there would be work offered
 * over a step that says there is none.
 */
export function policyTasksOf(step: Step, title: string, artifacts: readonly PortalArtifact[]): EmergencyTaskProjection | null {
  if (step.state.condition === 'baseline-conflict') return null
  const portal = artifacts.find((a) => a.id === 'portal')
  if (!portal) return null
  const { steps, facts } = portalProcedureOf(portal.text())
  if (steps.length === 0) return null
  const task: EmergencyAccountTask = {
    id: 'policy-procedure',
    accountId: null,
    title: taskTitle(step, title),
    targetUpn: null,
    required: true,
    readinessKey: '',
    evidence: null,
    actionLabel: 'Open the Entra procedure',
    facts,
    steps,
  }
  // Recommended only where writing the policy is what the step is doing now
  // (roadmap/nextSafeAction.ts implementationIsCurrent). A step the plan's
  // foundation holds keeps the procedure — it is the persistent reference the
  // anatomy asks for — but nothing on the step directs the operator into it,
  // because the card beside it says to finish Establish Emergency Access or
  // approve the Direction answer first, and two directions is none.
  return { tasks: [task], recommendedTaskId: implementationIsCurrent(step) ? task.id : null, printAll: true }
}

/** The subject a card names where the step delivers one policy; a step that delivers two labels each member ("Policy A") itself. */
const POLICY_SUBJECT = 'Conditional Access policy'

/**
 * The bar over the evidence link: what to do, as Prepare Emergency Access
 * Accounts says it, and not the status word a policy step used to show there
 * ("Ready now") — the step's state is already its badge's.
 *
 * Two sentences, the way that step's own two are two sentences in
 * ContentStep.tsx: there is no content key for them, and the words are the
 * cards' ("task", "complete"), not new vocabulary.
 */
export function policyBarOf(subjects: readonly EmergencySubjectTile[]): string {
  return subjects.some((subject) => !subject.satisfied)
    ? 'Complete the next task shown for each item.'
    : 'Every task on this step is complete.'
}

/**
 * A policy's own checks: the rollout stages the step's track already records
 * (stepContract.ts `stepTrack`), read for one policy. Nothing is classified
 * here — `reached`/`current` are the track's, and the stage a policy has not
 * got to yet is the next check.
 *
 * The first stage is where every policy starts, so it is never a check anybody
 * completed and never counted as one remaining.
 */
function stagesOf(track: readonly ContractStage[], lifecycle: Lifecycle | null): { completed: string[]; remaining: number | null; next: string | null } {
  const at = track.findIndex((stage) => stage.key === lifecycle)
  const index = at >= 0 ? at : track.findIndex((stage) => stage.current)
  if (track.length === 0 || index < 0) return { completed: [], remaining: null, next: null }
  return {
    completed: track.filter((_, i) => i > 0 && i <= index).map((stage) => stage.label),
    remaining: track.length - 1 - index,
    next: track[index + 1]?.label ?? null,
  }
}

/**
 * The step's own work as Tasks Remaining cards: one card per policy the step
 * delivers, drawn by the same component an Emergency Access account is drawn by,
 * because the policy is this step's subject the way an account is that step's.
 *
 * Every line is already somewhere in the contract: the policy's name is its
 * member's (Foundation B), its checks are the step's own rollout stages, the
 * next stage is the next check, what that stage means is Foundation B's own
 * milestone, and the one action is the matching Implementation Task, directed to
 * in the words emergencyReadiness.ts already uses. No taxonomy is invented.
 *
 * A card is satisfied only when the policy has reached the last stage and the
 * step has no task left to do, so "No tasks remaining" cannot be shown over work
 * that Implementation Tasks still lists.
 */
export function policyCardsOf(contract: StepContract, projected: EmergencyTaskProjection | null): EmergencySubjectTile[] {
  const task = projected?.tasks.find((item) => item.required) ?? projected?.tasks[0] ?? null
  // The task the card sends the operator to: the one this step is recommending
  // now. A projection that recommends none is a step whose next thing is not the
  // procedure (policyTasksOf), so the card states the check and stops there.
  const directed = projected && (projected.recommendedTaskId ?? null) !== null ? task : null
  const subjects = contract.members.length > 0
    ? contract.members.map((member) => ({ key: `policy:${member.key}`, heading: member.label ?? POLICY_SUBJECT, name: member.name, lifecycle: member.lifecycle ?? contract.state.lifecycle }))
    : [{ key: 'policy', heading: POLICY_SUBJECT, name: contract.existing?.names.join(', ') ?? null, lifecycle: contract.state.lifecycle }]
  return subjects.map((subject) => {
    const stages = stagesOf(contract.track, subject.lifecycle)
    // Nothing is left on the policy itself when the goal is already delivered
    // (Foundation B's own `satisfied`: "nothing to create; keep it as it is"),
    // or when it has reached its last stage with nothing left to submit.
    const satisfied = contract.state.satisfied || (stages.remaining === 0 && task === null)
    const here = contract.state.stage || contract.state.word
    // Where the step has no rollout to draw — a goal with no policy of its own,
    // a step set aside — the next check is the task itself; there is no stage to
    // name it by.
    const next = stages.next ?? (contract.track.length === 0 ? task?.title ?? null : null)
    return {
      key: subject.key,
      accountId: null,
      heading: subject.heading,
      upn: subject.name,
      title: satisfied ? here : next ?? here,
      // What that check means, in the contract's own words for this step: its one
      // action (Foundation B's milestone where nothing overrules it, and the more
      // specific sentence where something does — "this policy names an object
      // Contoso does not have yet", "in place already: nothing to create").
      detail: contract.whatToDo.text,
      instruction: satisfied || directed === null ? '' : `Follow ${directed.title} in Implementation Tasks.`,
      completed: stages.completed,
      remainingCount: stages.remaining !== null && stages.remaining > 0 ? stages.remaining : null,
      satisfied,
    }
  })
}

/**
 * This step's Tasks Remaining cards: its own policy first, then its Readiness
 * tiles, remaining then satisfied, as the subject tiles Steps 2-3 draw — with
 * the tile's own link kept as the card's one action.
 *
 * Which tiles are out of the way is the contract's answer and not a second
 * reading of a tone here: a tile the contract put under `satisfied` is a
 * satisfied card, so it folds under the completed disclosure the way it folded
 * under the strip's own.
 */
export function policySubjectsOf(contract: StepContract, readiness: ContractReadiness, projected: EmergencyTaskProjection | null): EmergencySubjectTile[] {
  const card = (tile: ContractReadiness['tiles'][number], satisfied: boolean): EmergencySubjectTile => {
    const subject = emergencySubjectTileOf(tile, projected)
    const link = tile.link && 'href' in tile.link ? tile.link : null
    return { ...subject, satisfied, ...(link && !subject.link ? { link } : {}) }
  }
  return [...policyCardsOf(contract, projected), ...readiness.tiles.map((tile) => card(tile, false)), ...readiness.satisfied.map((tile) => card(tile, true))]
}
