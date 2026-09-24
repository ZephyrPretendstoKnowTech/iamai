// The dependency graph's conditions (A1 §8) as this plan resolves them: the one
// reading the board's lanes (ui/surfaces/planLanes.ts) and the turn-on holds
// (roadmap/enforceWaits.ts) both take, so a conditional prerequisite the board
// shows is the one a step's turn-on waits for.
import data from '../actionability/dependency-data.json' with { type: 'json' }
import type { ConditionState } from '../actionability/lanes.ts'
import type { MappingState } from '../mapping/types.ts'
import { QUESTION_STEP, answerOf, deviceCodeWorkflowsOf } from './answers.ts'
import { campaignTargetsPasskeys } from './campaign.ts'
import type { Step } from './types.ts'

/** The recorded answers a carve-out's condition resolves from. */
export type PlanAnswers = Pick<MappingState, 'questionAnswers'>

const CONDITIONS = (data as { conditions: { name: string; ownedBy: string }[] }).conditions

/**
 * One graph condition (A1 §8) as this plan resolves it. A step the person said does
 * not apply resolves its condition not-applicable, and that completes the step
 * (§8.2). The Security Defaults cutover is applicable while the scan's read put its
 * step on the plan; shared devices are applicable while the scan found any; the
 * registration campaign reads its selected method from the package; a carve-out is
 * applicable while its answer put the step on the plan, else the recorded answer
 * says, and an unrecorded one stays unresolved (§8.1: never silently satisfied).
 */
function conditionOf(name: string, ownedBy: string, byId: ReadonlyMap<string, Step>, answers: PlanAnswers | undefined): ConditionState {
  const owner = byId.get(ownedBy)
  if (owner?.doesntApply != null) return 'not-applicable'
  switch (name) {
    // Never not-applicable (walk list section 3 item 3; BLOCKED.md S2): that
    // would complete Prepare Your Team for MFA through §8.2 on every tenant's
    // first scan, whoever is still not ready. The step completes on its people.
    case 'campaign-targets-passkey': return campaignTargetsPasskeys() === true ? 'applicable' : 'unresolved'
    case 'sd-enabled': return owner !== undefined && owner.status !== 'done' ? 'applicable' : 'not-applicable'
    case 'shared-devices-exist': return owner !== undefined ? 'applicable' : 'not-applicable'
    // Owned by the policy it gates, so the owner being on the plan says nothing: the saved answer does.
    case 'device-code-workflows-exist': {
      const inUse = answers ? deviceCodeWorkflowsOf(answers) : null
      return inUse === null ? 'unresolved' : inUse ? 'applicable' : 'not-applicable'
    }
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

/** Every graph condition, resolved for this plan. */
export function graphConditions(byId: ReadonlyMap<string, Step>, answers: PlanAnswers | undefined): Record<string, ConditionState> {
  const out: Record<string, ConditionState> = {}
  for (const c of CONDITIONS) out[c.name] = conditionOf(c.name, c.ownedBy, byId, answers)
  return out
}
