// Prepare the Lockdown Kit on the Plan (T2-LK; owner, 2026-10-03): its cards, its
// rail headline and its Implementation Tasks, from the switches the engine read
// (roadmap/lockdownKit.ts).
//
// One card per switch still to prepare: to create, to correct, in Report-only,
// or On (a switch found On says it is blocking sign-ins and how to stand down).
// One create task per switch, the whole procedure in every state (owner,
// 2026-09-25), each the policy's own create procedure (roadmap/policyProcedure.ts
// createLines) with Enable policy Off; a correction or a Set Off task where the
// scan found one is needed; then the runbook: when to turn each switch on and
// who stays online, and how to stand down.
//
// Pure: no DOM, no React, no network.
import type { Step } from '../../roadmap/types.ts'
import type { LockdownKitMember, LockdownSwitch } from '../../roadmap/lockdownKit.ts'
import { switchReady } from '../../roadmap/lockdownKit.ts'
import type { CorrectionSection, ProcedureContext } from '../../roadmap/policyProcedure.ts'
import { PROCEDURE, correctionLines, correctionSettings, createLines, openLine, turnOffLines } from '../../roadmap/policyProcedure.ts'
import { stepById } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import type { EmergencyAccountTask, EmergencyTaskProjection } from './emergencyAccountTasks.ts'
import type { ReadinessTile } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'
import { proposedNamesFor } from './proposedNames.ts'
import { LOCKDOWN_KIT_STEP_ID, PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'

type KitWords = {
  milestoneOnOne: string
  milestoneOnMany: string
  milestoneOpenOne: string
  milestoneOpenMany: string
  switches: Record<LockdownSwitch, { label: string; when: string }>
  tileCreate: string
  tileCorrect: string
  tileReportOnly: string
  tileOn: string
  tileOnNote: string
  taskCreate: string
  taskCorrect: string
  taskOff: string
  taskFlip: string
  taskStandDown: string
  flipSwitch: string
  flipFirst: string
  flipTarget: string
  standDownTarget: string
  standDownWho: string
}
const W = (): KitWords => (stepById[LOCKDOWN_KIT_STEP_ID] as unknown as { kit: KitWords }).kit

const membersOf = (step: Step): LockdownKitMember[] => (step.id === LOCKDOWN_KIT_STEP_ID ? step.lockdownKit?.members ?? [] : [])
/** The name the tenant's policy carries, else the baseline's, which the create gives it. */
const nameOf = (m: LockdownKitMember): string => m.policyName || m.name

/**
 * Each switch still to prepare as a card, headed by the switch and naming its
 * policy: to create, to correct, in Report-only, or On. None once all three are
 * Off as planned (the Satisfied cards state them), and none on any other step.
 */
export function lockdownKitTilesOf(step: Step): ReadinessTile[] {
  const w = W()
  return membersOf(step).filter((m) => !switchReady(m)).map((m) => {
    const label = w.switches[m.switch].label
    const base = { key: `kit:${m.key}`, label, tone: 'warn' as const, names: [nameOf(m)] }
    if (m.state === 'on') return { ...base, value: w.tileOn, note: w.tileOnNote }
    if (m.state === 'absent') return { ...base, value: w.tileCreate, note: null }
    if (m.state === 'report-only') return { ...base, value: w.tileReportOnly, note: null }
    return { ...base, value: w.tileCorrect, note: null }
  })
}

/** The rail's headline while the kit is not ready: a switch that is On first, else how many switches are still to prepare. */
export function lockdownKitMilestoneOf(step: Step): string | null {
  const members = membersOf(step)
  if (members.length === 0) return null
  const w = W()
  const on = members.filter((m) => m.state === 'on').length
  if (on > 0) return on === 1 ? w.milestoneOnOne : fillText(w.milestoneOnMany, { n: on })
  const open = members.filter((m) => !switchReady(m)).length
  if (open === 0) return null
  return open === 1 ? w.milestoneOpenOne : fillText(w.milestoneOpenMany, { n: open })
}

/** Every part of a policy a correction may write. */
const ALL_SECTIONS: ReadonlySet<CorrectionSection> = new Set<CorrectionSection>(['users', 'resources', 'conditions', 'grant', 'session'])

/**
 * The kit's Implementation Tasks: per switch, its create (turned off) and,
 * where the scan found it needed, its correction or its Set Off; then the
 * runbook. `group` is the emergency access exclusions group's name (the
 * tenant's, else the one the plan proposes); `rows` the scan's policies.
 */
export function lockdownKitTasksOf(step: Step, ctx: ProcedureContext, group: string, rows: readonly unknown[]): EmergencyTaskProjection | null {
  const members = membersOf(step)
  if (members.length === 0) return null
  const ops = step.action.resolution?.policies ?? []
  const w = W()
  const task = (id: string, title: string, steps: string[], required: boolean): EmergencyAccountTask => ({ id, accountId: null, title, targetUpn: null, required, readinessKey: '', evidence: null, actionLabel: title, steps })
  const row = (id: string | null): Record<string, unknown> | null => (id ? (rows.find((r) => (r as { id?: unknown })?.id === id) as Record<string, unknown> | undefined) ?? null : null)
  const tasks: EmergencyAccountTask[] = []
  for (const m of members) {
    const op = ops.find((o) => o.memberKey === m.key)
    if (!op) continue
    // A switch named before its object exists is described with that object in it, as every policy step's create is.
    const body = (op.pending ?? op.body) as Record<string, unknown>
    // Each task points at its switch's card (lockdownKitTilesOf).
    const card = `kit:${m.key}`
    tasks.push({ ...task(`create:${m.key}`, fillText(w.taskCreate, { policy: m.name }), createLines({ ...body, state: 'disabled' }, ctx, { name: m.name }), m.state === 'absent'), readinessKey: card })
    const current = row(m.policyId)
    if (current && m.differences.length > 0) {
      const lines = correctionLines(nameOf(m), correctionSettings(current, body, ctx, ALL_SECTIONS))
      if (lines.length > 0) tasks.push({ ...task(`correct:${m.key}`, fillText(w.taskCorrect, { policy: nameOf(m) }), lines, true), readinessKey: card })
    }
    if (m.state === 'on' || m.state === 'report-only') tasks.push({ ...task(`off:${m.key}`, fillText(w.taskOff, { policy: nameOf(m) }), turnOffLines(nameOf(m)), true), readinessKey: card })
  }
  // The runbook, in every state: when each switch is for, from whose account, how.
  const flip = [
    ...members.map((m) => fillText(w.flipSwitch, { label: w.switches[m.switch].label, policy: nameOf(m), when: w.switches[m.switch].when })),
    fillText(w.flipFirst, { group }),
    openLine(w.flipTarget),
    PROCEDURE.turnOn,
  ]
  tasks.push(task('flip', w.taskFlip, flip, false))
  tasks.push(task('stand-down', w.taskStandDown, [fillText(w.standDownWho, { group }), ...turnOffLines(w.standDownTarget)], false))
  const next = tasks.find((t) => t.required) ?? null
  return { tasks, recommendedTaskId: next ? next.id : null, printAll: true }
}

/** The names a procedure line is written with (stepPortal.ts portalNamesFor). */
type Names = { nameOf: (id: string) => string; strengthNameFor?: (id: string) => string | null }

/**
 * The kit's Implementation Tasks as the screen and the export both draw them:
 * the switches' creates named with the tenant's objects (the exclusions group
 * the plan proposes, while it is still to be made, as every policy step's
 * create names it), and the runbook naming the exclusions group.
 */
export function lockdownKitProcedureOf(step: Step, ctx: StepVarContext, names: Names): EmergencyTaskProjection | null {
  if (membersOf(step).length === 0) return null
  const tenant = step.action.resolution?.tenant ?? null
  const proposed = proposedNamesFor(ctx).exclusionsGroup
  const pending = new Set((step.action.missing ?? []).filter((m) => m.stepId === PREREQ_STEP_ID.exclusionsGroup).map((m) => m.token.toLowerCase()))
  const procedure: ProcedureContext = { nameOf: (id) => (pending.has(id.toLowerCase()) ? proposed : names.nameOf(id)), strengthNameOf: (id) => names.strengthNameFor?.(id) ?? null, exclusionsGroupId: tenant?.exclusionsGroupId ?? null, emergencyIds: tenant?.emergencyIds ?? [] }
  const group = tenant?.exclusionsGroupId ? ctx.nameOf(tenant.exclusionsGroupId) : proposed
  return lockdownKitTasksOf(step, procedure, group, ctx.snapshot.config.caPolicies?.rows ?? [])
}
