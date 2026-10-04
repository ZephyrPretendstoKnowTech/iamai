// Policies as JSON (F-024; owner, 2026-10-04): every policy step of the plan in
// one file, in the Plan's order and under the number the board gives it, with
// the baseline policies it comes from and where it stands. A step that writes
// today carries the operations its own PowerShell and JSON tabs hand over
// (stepJson.ts stepOperations, the one source); the Lockdown Kit its switches
// still to create, Off (lockdownKitStep.ts). Nothing else carries a body: a
// policy in place has nothing to write, and one that waits — on an answer, an
// object, Emergency Access, a readiness number, or a policy switched off that
// goes back to Report-only rather than being built again — is never handed
// over before its own step would hand it over.
//
// Pure: no DOM, no network.
import type { Step } from '../../roadmap/types.ts'
import { LOCKDOWN_KIT_STEP_ID } from '../../roadmap/stepIds.ts'
import { implementationIsCurrent } from '../../roadmap/nextSafeAction.ts'
import { switchedOffPolicies } from '../../roadmap/operations.ts'
import type { Board } from './planBoard.ts'
import { printSectionsOf } from './printPlan.ts'
import { stepOperations } from './stepJson.ts'
import { lockdownKitCreatesOf } from './lockdownKitStep.ts'
import { heldCreateMilestoneOf } from './policyTasks.ts'
import { policyKey } from '../../roadmap/goalMap.ts'
import type { GoalMap } from '../../roadmap/goalMap.ts'

/** A goal's baseline policies by their own names, read from the goal map the plan uses. */
export function baselineNamesFrom(goalMap: GoalMap, policies: readonly { id?: string | null; displayName: string }[]): (goalId: string) => string[] {
  return (goalId) => policies.filter((p) => (goalMap[goalId] ?? []).includes(policyKey(p))).map((p) => p.displayName)
}

/** Where a policy step stands in the file. */
export type PlanPolicyStatus = 'write' | 'in place' | 'waiting' | 'set aside'

/** One policy step: its number and title, the baseline policies it comes from, and what it writes today. */
export type PlanPolicyEntry = {
  step: string
  title: string
  status: PlanPolicyStatus
  baselinePolicies: string[]
  /** Only where the status is write: each create or update, as the step's own tabs hand it over. */
  operations?: { mode: 'create' | 'update'; policyId: string | null; body: Record<string, unknown> }[]
}

export type PlanPolicies = {
  tool: 'IAMAI Planner'
  tenant: { id: string; name: string | null }
  baseline: { source: string; pin: string | null }
  generated: string
  steps: PlanPolicyEntry[]
}

const POLICY_KINDS: ReadonlySet<string> = new Set(['create', 'adjust'])

/** The operations a step hands over today; none where its tabs hand none over. */
function writtenToday(step: Step): NonNullable<PlanPolicyEntry['operations']> {
  const ops = step.id === LOCKDOWN_KIT_STEP_ID
    ? lockdownKitCreatesOf(step)
    : implementationIsCurrent(step) && heldCreateMilestoneOf(step) === null && switchedOffPolicies(step).length === 0 ? stepOperations(step) : []
  return ops.map((o) => ({ mode: o.mode, policyId: o.mode === 'update' ? o.policyId : null, body: o.body as Record<string, unknown> }))
}

/** The file: every policy step the board draws, the Lockdown Kit with them. */
export function planPoliciesOf(board: Pick<Board, 'rows'>, meta: { tenantId: string; tenantName: string | null; baselineSource: string; baselinePin: string | null; generated: string; baselineNamesOf: (goalId: string) => string[] }): PlanPolicies {
  const steps: PlanPolicyEntry[] = []
  for (const sec of printSectionsOf(board)) {
    for (const r of sec.rows) {
      const step = r.step
      if (!step || !(POLICY_KINDS.has(step.kind) || step.id === LOCKDOWN_KIT_STEP_ID)) continue
      const number = sec.number !== null && r.number !== null ? `${sec.number}.${r.number}` : ''
      // The step's own operations name their source policies; a step with none (in place, or waiting) is named from the goal map.
      const own = (step.action.resolution?.policies ?? []).map((o) => o.sourceName).filter((n) => typeof n === 'string' && n !== '')
      const baselinePolicies = [...new Set(own.length > 0 ? own : meta.baselineNamesOf(step.goalId))]
      const ops = writtenToday(step)
      const status: PlanPolicyStatus = r.lane.lane === 'Deferred' ? 'set aside' : r.lane.lane === 'Completed' || step.state.satisfied ? 'in place' : ops.length > 0 ? 'write' : 'waiting'
      steps.push({ step: number, title: r.title, status, baselinePolicies, ...(status === 'write' ? { operations: ops } : {}) })
    }
  }
  return { tool: 'IAMAI Planner', tenant: { id: meta.tenantId, name: meta.tenantName }, baseline: { source: meta.baselineSource, pin: meta.baselinePin }, generated: meta.generated, steps }
}
