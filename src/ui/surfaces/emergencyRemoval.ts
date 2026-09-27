// The question the emergency access accounts picker asks before a chip comes off
// (F-007): removing an emergency account takes a step off the plan and turns
// Configure Emergency Exclusions' advice against it. It names that step and the
// exclusions group from the one authority on the group (mapping/safetyChoice.ts),
// since 1.1's own step variables never carry it.
//
// Pure: no DOM, no network.
import { app } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { exclusionsGroupChoice } from '../../mapping/safetyChoice.ts'
import { EXCLUSION_GROUP_STEP_ID } from '../../roadmap/stepIds.ts'
import type { StepVarContext } from './stepVars.ts'

type Words = { removeConfirm: string; removeConfirmNoGroup: string }
const W = (): Words => (app.plan as unknown as { emergencyTasks: Words }).emergencyTasks

/** The question for one chip, with the exclusions group the plan may name, or the short question where it may name none. */
export function emergencyRemovalQuestion(ctx: Pick<StepVarContext, 'snapshot' | 'mapping' | 'groups' | 'directory' | 'nameOf'>): (chip: { name: string }) => string {
  const choice = exclusionsGroupChoice({ snapshot: ctx.snapshot, mapping: ctx.mapping, groups: ctx.groups, directory: ctx.directory })
  const group = choice.actionableId ? (choice.actionableName ?? ctx.nameOf(choice.actionableId)) : null
  const step = contentTitle({ id: EXCLUSION_GROUP_STEP_ID, goalId: '', title: '' })
  return (chip) => (group !== null ? fillText(W().removeConfirm, { name: chip.name, step, group }) : fillText(W().removeConfirmNoGroup, { name: chip.name }))
}
