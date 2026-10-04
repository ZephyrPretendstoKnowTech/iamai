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
import { createdBodiesOf } from '../../roadmap/reportOnlyBatch.ts'
import { stepById } from '../../content/content.ts'
import { contentTitle } from '../../content/stepTitle.ts'
import { byPlanPlace } from '../../roadmap/stepGroups.ts'
import { fillText } from '../../content/render.ts'
import type { EmergencyAccountTask, EmergencyTaskProjection } from './emergencyAccountTasks.ts'
import type { ReadinessTile } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'

type BatchWords = { createValue: string; milestone: string; taskTitle: string; leftOutBoth: string; leftOutUserAction: string; leftOutDeviceCheck: string; leftOutOwnStep: string }

/** One policy's create lines, as its own step's create task holds them (policyTasks.ts `creates`). */
export type CreateTaskLines = { name: string; steps: string[] }

/** The key of a member's i-th policy: its card's and its task's (`batch:<id>`, then `batch:<id>#2`). */
const nth = (id: string, i: number): string => (i === 0 ? id : `${id}#${i + 1}`)
const W = (): BatchWords => (stepById[REPORT_ONLY_STEP_ID] as unknown as { batch: BatchWords }).batch

type Member = { id: string; step: Step; toCreate: boolean }

/** The batch's policy steps, in the order the Plan shows them (review, 2026-09-26: they read in the engine's order). */
function membersOf(step: Step, ctx: StepVarContext): Member[] {
  const batch = step.reportOnlyBatch
  const plan = ctx.planSteps ?? []
  if (!batch || plan.length === 0) return []
  const toCreate = new Set(batch.create)
  const listed = new Set([...batch.create, ...batch.created])
  return plan.filter((s) => listed.has(s.id)).sort((a, b) => byPlanPlace(a, b)).map((s) => ({ id: s.id, step: s, toCreate: toCreate.has(s.id) }))
}

/** The policy a member creates, by the name its create gives it; the tenant's own name once it exists. */
function policyNames(m: Member): string[] {
  if (!m.toCreate) {
    const tenant = (m.step.tracking?.members ?? []).map((t) => t.policyName).filter((n): n is string => typeof n === 'string' && n !== '')
    if (tenant.length > 0) return tenant
  }
  // Only the policies it creates: a mixed step's update is its own step's task.
  return createdBodiesOf(m.step).map((b) => String(b.displayName ?? '')).filter((n) => n !== '')
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
  // One card per policy (owner, 2026-09-29): a step that creates two (Jon's guest pair) has two.
  return membersOf(step, ctx).filter((m) => m.toCreate).flatMap((m) => {
    const names = policyNames(m)
    // Its instruction is its task's (emergencyReadiness.ts: "Follow {title} in Implementation Tasks.").
    return (names.length > 0 ? names : [null]).map((name, i) => ({ key: `batch:${nth(m.id, i)}`, label: contentTitle(m.step), tone: 'warn' as const, value: w.createValue, note: null, names: name === null ? [] : [name] }))
  })
}

/**
 * The note under the cards, where a policy still to create was left out (owner,
 * 2026-09-26): one whole sentence for the types this tenant's plan leaves out;
 * null where none is. The screen, the print and the export read this one value.
 */
export function reportOnlyNoteOf(step: Step): string | null {
  const why = step.id === REPORT_ONLY_STEP_ID ? step.reportOnlyBatch?.leftOut ?? [] : []
  const w = W()
  const user = why.includes('userAction')
  const device = why.includes('deviceCheck')
  const types = user && device ? w.leftOutBoth : user ? w.leftOutUserAction : device ? w.leftOutDeviceCheck : null
  // The countries policies (owner, 2026-10-04): created on their own step, which the note names.
  const own = step.id === REPORT_ONLY_STEP_ID ? (step.reportOnlyBatch?.ownStep ?? []).map((g) => fillText(w.leftOutOwnStep, { step: stepById[g]?.title ?? g })) : []
  const out = [types, ...own].filter((s): s is string => s !== null)
  return out.length > 0 ? out.join(' ') : null
}

/**
 * The rail's headline while any policy is left to create; null once none is. It
 * counts policies, as the cards do (T1-6d): the engine's count of the policies
 * still to create (reportOnlyBatch.ts `impactCount`), never the steps that
 * create them — Jon's guest pair is two.
 */
export function reportOnlyMilestoneOf(step: Step): string | null {
  const n = (step.reportOnlyBatch?.create.length ?? 0) > 0 ? step.impactCount ?? 0 : 0
  return step.id === REPORT_ONLY_STEP_ID && n > 0 ? fillText(W().milestone, { n }) : null
}

/**
 * One task per listed policy, created or not, each its own step's create
 * procedure for that policy (`createOf` reads it from that step's body, per
 * policy; stepBody.ts hands it in, so this module imports none of it). A step
 * that creates two policies has two tasks, each with its own create lines and
 * its own card (T1-6d: the second guest card pointed at no task), titled with
 * the step and the policy. A created policy keeps its task: the procedure is
 * never hidden, whatever the step's state (owner, 2026-09-25). The first policy
 * still to create is the task the card and the rail point at, else the first.
 */
export function reportOnlyTasksOf(step: Step, ctx: StepVarContext, createOf: (member: Step) => CreateTaskLines[] | null): EmergencyTaskProjection | null {
  if (step.id !== REPORT_ONLY_STEP_ID) return null
  const members = membersOf(step, ctx)
  const tasks: EmergencyAccountTask[] = members.flatMap((m) => {
    const each = (createOf(m.step) ?? []).filter((c) => c.steps.length > 0)
    const own = contentTitle(m.step)
    return each.map((c, i) => {
      const title = each.length > 1 && c.name !== '' ? fillText(W().taskTitle, { title: own, name: c.name }) : own
      return { id: `create:${nth(m.id, i)}`, accountId: null, title, targetUpn: null, required: m.toCreate, readinessKey: `batch:${nth(m.id, i)}`, evidence: null, actionLabel: title, steps: c.steps }
    })
  })
  if (tasks.length === 0) return null
  const next = members.find((m) => m.toCreate && tasks.some((t) => t.id === `create:${m.id}`))
  return { tasks, recommendedTaskId: next ? `create:${next.id}` : tasks[0].id, printAll: true }
}
