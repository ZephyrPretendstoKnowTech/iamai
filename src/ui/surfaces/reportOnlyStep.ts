// Create the Policies in Report-only on the Plan (3.8, owner 2026-09-24): its
// cards, its rail headline and its Implementation Tasks, from the list the engine
// settled (roadmap/reportOnlyBatch.ts).
//
// One card per policy: still to create, headed by its step's title and naming
// the policy; or created, a Satisfied fact ("Report-only until Oct 1", "On").
// One task per listed policy, created or not, in plan order, and each task is that policy's own create
// procedure, read from its own step (policyTasks.ts policyProcedureOf through
// stepBody.ts), so the two can never say different things. A policy's own step
// keeps its create task too: whichever the person follows, the scan closes both.
//
// Pure: no DOM, no React, no network.
import type { Step } from '../../roadmap/types.ts'
import { REPORT_ONLY_STEP_ID } from '../../roadmap/stepIds.ts'
import { operationBodies } from '../../roadmap/operations.ts'
import { stepById } from '../../content/content.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { fillText } from '../../content/render.ts'
import type { EmergencyAccountTask, EmergencyTaskProjection } from './emergencyAccountTasks.ts'
import type { ReadinessTile } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'

type BatchWords = { createValue: string; milestone: string }
const W = (): BatchWords => (stepById[REPORT_ONLY_STEP_ID] as unknown as { batch: BatchWords }).batch

type Member = { id: string; step: Step; toCreate: boolean }

/** The batch's policy steps, in plan order: still to create first-come, created alike. */
function membersOf(step: Step, ctx: StepVarContext): Member[] {
  const batch = step.reportOnlyBatch
  const plan = ctx.planSteps ?? []
  if (!batch || plan.length === 0) return []
  const toCreate = new Set(batch.create)
  const listed = new Set([...batch.create, ...batch.created])
  return plan.filter((s) => listed.has(s.id)).map((s) => ({ id: s.id, step: s, toCreate: toCreate.has(s.id) }))
}

/** The policy a member creates, by the name its create gives it; the tenant's own name once it exists. */
function policyNames(m: Member): string[] {
  if (!m.toCreate) {
    const tenant = (m.step.tracking?.members ?? []).map((t) => t.policyName).filter((n): n is string => typeof n === 'string' && n !== '')
    if (tenant.length > 0) return tenant
  }
  return operationBodies(m.step as Parameters<typeof operationBodies>[0]).map((b) => String(b.displayName ?? '')).filter((n) => n !== '')
}

/**
 * Each policy as a card: to create (a task); created with a setting that is not
 * the plan's, to correct (every control is exact: owner, 2026-09-25); or created
 * as planned, a Satisfied fact, naming the step's own name where the tenant's
 * differs. None on any other step.
 */
export function reportOnlyTilesOf(step: Step, ctx: StepVarContext): ReadinessTile[] {
  if (step.id !== REPORT_ONLY_STEP_ID) return []
  const w = W()
  // Only the policies still to create (owner, 2026-09-26): a correction is its
  // own step's card, and the policies already created are no roster here.
  return membersOf(step, ctx).filter((m) => m.toCreate).map((m) => {
    // Its instruction is its task's (emergencyReadiness.ts: "Follow {title} in Implementation Tasks.").
    return { key: `batch:${m.id}`, label: contentTitle(m.step), tone: 'warn' as const, value: w.createValue, note: null, names: policyNames(m) }
  })
}

/** The rail's headline while any policy is left to create; null once none is. */
export function reportOnlyMilestoneOf(step: Step): string | null {
  const n = step.reportOnlyBatch?.create.length ?? 0
  return step.id === REPORT_ONLY_STEP_ID && n > 0 ? fillText(W().milestone, { n }) : null
}

/**
 * One task per listed policy, created or not, each its own step's create
 * procedure (`createOf` reads it from that step's body; stepBody.ts hands it in,
 * so this module imports none of it). A created policy keeps its task: the
 * procedure is never hidden, whatever the step's state (owner, 2026-09-25). The
 * first policy still to create is the task the card and the rail point at, else
 * the first.
 */
export function reportOnlyTasksOf(step: Step, ctx: StepVarContext, createOf: (member: Step) => string[] | null): EmergencyTaskProjection | null {
  if (step.id !== REPORT_ONLY_STEP_ID) return null
  const members = membersOf(step, ctx)
  const tasks: EmergencyAccountTask[] = members.flatMap((m) => {
    const steps = createOf(m.step)
    if (steps === null || steps.length === 0) return []
    const title = contentTitle(m.step)
    return [{ id: `create:${m.id}`, accountId: null, title, targetUpn: null, required: m.toCreate, readinessKey: `batch:${m.id}`, evidence: null, actionLabel: title, steps }]
  })
  if (tasks.length === 0) return null
  const next = members.find((m) => m.toCreate && tasks.some((t) => t.id === `create:${m.id}`))
  return { tasks, recommendedTaskId: next ? `create:${next.id}` : tasks[0].id, printAll: true }
}
