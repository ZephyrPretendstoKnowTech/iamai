// A policy step drawn with the Establish Emergency Access anatomy (owner,
// 2026-09-19: "there will be ZERO lack of uniformity among UI that SHOULD be
// identical"). One step is piloted and the set below is the whole gate, so no
// other step moves.
//
// Nothing here is a new surface, and nothing here decides anything.
//
// The Tasks Remaining cards are the step's own Readiness tiles through the
// adapter Steps 2-3 already use (emergencyReadiness.ts emergencySubjectTileOf);
// the only thing added back is the tile's own link, which the strip drew and the
// card would otherwise drop.
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
import { enforcesByStateOnly, stepOperations } from './stepJson.ts'
import type { ContractReadiness } from './stepContract.ts'
import { emergencySubjectTileOf } from './emergencyReadiness.ts'
import type { EmergencySubjectTile } from './emergencyReadiness.ts'
import type { EmergencyAccountTask, EmergencyTaskProjection } from './emergencyAccountTasks.ts'

/** The one policy step piloted on the task anatomy. Adding a step is adding an id here. */
export const POLICY_TASK_STEP_IDS: readonly string[] = ['s-goal-admin-session']

/** Whether this step draws the Emergency Access task anatomy although it is a policy step. */
export function usesPolicyTaskAnatomy(stepId: string): boolean {
  return POLICY_TASK_STEP_IDS.includes(stepId)
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
 * keeps the body it always drew.
 */
export function policyTasksOf(step: Step, title: string, artifacts: readonly PortalArtifact[]): EmergencyTaskProjection | null {
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
  return { tasks: [task], recommendedTaskId: task.id, printAll: true }
}

/**
 * This step's Tasks Remaining cards: its Readiness tiles, remaining then
 * satisfied, as the subject tiles Steps 2-3 draw — with the tile's own link kept
 * as the card's one action.
 *
 * Which tiles are out of the way is the contract's answer and not a second
 * reading of a tone here: a tile the contract put under `satisfied` is a
 * satisfied card, so it folds under Satisfied the way it folded under the
 * strip's own disclosure.
 */
export function policySubjectsOf(readiness: ContractReadiness, projected: EmergencyTaskProjection | null): EmergencySubjectTile[] {
  const card = (tile: ContractReadiness['tiles'][number], satisfied: boolean): EmergencySubjectTile => {
    const subject = emergencySubjectTileOf(tile, projected)
    const link = tile.link && 'href' in tile.link ? tile.link : null
    return { ...subject, satisfied, ...(link && !subject.link ? { link } : {}) }
  }
  return [...readiness.tiles.map((tile) => card(tile, false)), ...readiness.satisfied.map((tile) => card(tile, true))]
}
