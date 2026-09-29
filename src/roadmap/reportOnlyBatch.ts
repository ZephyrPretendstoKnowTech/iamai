// Create the Policies in Report-only (3.8, owner 2026-09-24): one step at the
// end of Prepare Accounts and Objects that lists every policy the plan can
// create in Report-only now, so each starts its report-only week at once. It
// completes when the scan sees each listed policy in Report-only or On, and the
// policy steps in sections 4 to 8 then open in their report-only week; their
// turn-ons keep their order, because each still waits on what it waited on.
//
// What it lists is read from the policies themselves (the pinned baseline, and
// the tenant's licences through the plan: a policy not licensed is not on it):
//   - every policy the plan creates whose create the plan can write now: a
//     whole-create step, a create inside a mixed step (the guest step updating
//     the tenant's Mixed-Guests by name while creating B2B-Guest), and a
//     replacement create beside a tenant's own policy (owner, 2026-09-29: every
//     policy the plan adds or replaces is listed here). Its create
//     the plan can write now (operations.ts implementationOffered): a step
//     held only by order or by a readiness threshold qualifies, because
//     Report-only stops nobody; one waiting on an object nobody has identified,
//     or on a baseline that contradicts itself, does not;
//   - and, as facts, the ones already in Report-only or On.
// What it leaves out, and why (Microsoft Learn,
// concept-conditional-access-report-only):
//   - a policy with a user action (Protect Sign-in Method Registration, Require
//     MFA to Register a Device): report-only doesn't cover user actions;
//   - a policy that checks a compliant or managed device on anything but
//     Windows: report-only can prompt macOS, iOS and Android users for a device
//     certificate;
//   - the countries policy: its countries are picked on its own step;
//   - a step set aside, deferred, or that doesn't apply.
//
// Pure: no DOM, no network.
import type { Step } from './types.ts'
import { finalTargets, implementationOffered, operationsOf } from './operations.ts'
import { setState } from './lifecycle.ts'

import { REPORT_ONLY_STEP_ID } from './stepIds.ts'

export { REPORT_ONLY_STEP_ID }

/** The countries policy: its countries are chosen on its own step, so it is never created ahead of them. */
const COUNTRIES_GOAL = 'geo-restriction'
/** Where a created policy stands: in Report-only, past its week, or On. */
const CREATED: ReadonlySet<string> = new Set(['report-only', 'ready-to-enforce', 'enforced'])

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {})
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** The tenant's own policies, by id, as the scan read them: a created policy is judged as it stands. */
export type TenantPolicies = ReadonlyMap<string, Json>
export function tenantPoliciesOf(rows: readonly unknown[] | null | undefined): TenantPolicies {
  return new Map((rows ?? []).flatMap((r) => (r && typeof (r as Json).id === 'string' ? [[String((r as Json).id), r as Json] as const] : [])))
}

/**
 * The whole policies a step leaves behind (its operations' final targets: the
 * authority on what a policy means, operations.ts), else, once created, the
 * tenant's own as the scan read them through tracking. Never an update's patch:
 * a correction's patch left out the user action that makes a policy an outlier
 * (review, 2026-09-26: 3.6 listed Protect Sign-in Method Registration).
 */
function policiesOf(step: Step, tenant: TenantPolicies): Json[] {
  const bodies = finalTargets(step as Parameters<typeof finalTargets>[0])
  if (bodies.length > 0) return bodies
  return (step.tracking?.members ?? []).flatMap((m) => (m.policyId && tenant.has(m.policyId) ? [tenant.get(m.policyId)!] : []))
}

/**
 * The whole policies a step creates (its create operations' bodies), never an
 * update's: a mixed step lists only the policy it adds, and its in-place
 * correction stays its own step's task (owner, 2026-09-26).
 */
export function createdBodiesOf(step: Step): Json[] {
  return operationsOf(step as Parameters<typeof operationsOf>[0]).filter((o) => o.mode === 'create').map((o) => o.body as Json)
}

/** Why report-only is left out for a policy: it has a user action, or it checks a device beyond Windows. */
export type ReportOnlyOutlier = 'userAction' | 'deviceCheck'
/** The order the step's note names them in. */
const OUTLIERS: readonly ReportOnlyOutlier[] = ['userAction', 'deviceCheck']

/**
 * Why report-only would do harm or nothing for this policy, or null where it
 * would not: a user action (report-only doesn't cover them), or a compliant- or
 * managed-device check that reaches beyond Windows (report-only can prompt
 * macOS, iOS and Android users for a device certificate).
 */
export function reportOnlyOutlierOf(policy: Json): ReportOnlyOutlier | null {
  const c = obj(policy.conditions)
  if (strings(obj(c.applications).includeUserActions).length > 0) return 'userAction'
  const grant = strings(obj(policy.grantControls).builtInControls)
  const rule = String(obj(obj(c.devices).deviceFilter).rule ?? '')
  const deviceCheck = grant.includes('compliantDevice') || grant.includes('domainJoinedDevice') || /isCompliant|trustType/i.test(rule)
  const platforms = strings(obj(c.platforms).includePlatforms).map((p) => p.toLowerCase())
  const windowsOnly = platforms.length > 0 && platforms.every((p) => p === 'windows')
  return deviceCheck && !windowsOnly ? 'deviceCheck' : null
}

/** Whether report-only would do harm or nothing for this policy (reportOnlyOutlierOf). */
export function reportOnlyOutlier(policy: Json): boolean {
  return reportOnlyOutlierOf(policy) !== null
}

/** A step the batch would otherwise list for the plan to create, or null. */
const onThePlan = (step: Step): boolean => !(step.status === 'skipped' || step.state.setAside || step.doesntApply || step.goalId === COUNTRIES_GOAL)

/**
 * Why a policy still to create is left out of the batch (owner, 2026-09-26: the
 * step says so, by the type of policy): a user action or a device check. A
 * policy already created counts for nothing, and neither does a step set
 * aside, deferred or not applying, nor the countries policy, whose own step
 * says why it waits.
 */
function leftOutOf(step: Step): ReportOnlyOutlier[] {
  if (!onThePlan(step)) return []
  // A whole create counts only while its policy is still to create; once created it counts for nothing.
  if (step.kind === 'create' ? step.state.lifecycle !== 'not-deployed' : step.kind !== 'adjust') return []
  const whole = step.kind === 'create'
  // The plan's own policies, whether or not their create can be written today:
  // a policy held on something else is still never listed here, for this reason.
  // Beside a whole create, only the creates count (a mixed step's update is its own task).
  return (step.action.resolution?.policies ?? []).filter((op) => whole || op.mode === 'create').map((op) => reportOnlyOutlierOf(obj(op.body))).filter((r): r is ReportOnlyOutlier => r !== null)
}

/** A policy step the batch can ever list, whatever its lifecycle. */
export function batchable(step: Step, tenant: TenantPolicies = new Map()): boolean {
  if (step.kind !== 'create' && step.kind !== 'adjust') return false
  if (!onThePlan(step)) return false
  // A step that creates a policy is judged by the policies it creates.
  const creates = createdBodiesOf(step)
  const policies = creates.length > 0 ? creates : policiesOf(step, tenant)
  return policies.length > 0 && !policies.some(reportOnlyOutlier)
}

/** Where a policy step stands in the batch: still to create, already created, or not in it. */
export function batchMemberOf(step: Step, tenant: TenantPolicies = new Map()): 'create' | 'created' | null {
  if (!batchable(step, tenant)) return null
  // Any policy the plan creates, in a whole-create step or beside an update (owner, 2026-09-29).
  const creates = createdBodiesOf(step).length > 0 && (step.kind !== 'create' || step.state.lifecycle === 'not-deployed')
  if (creates && implementationOffered(step as Parameters<typeof implementationOffered>[0])) return 'create'
  if (CREATED.has(step.state.lifecycle ?? '')) return 'created'
  return null
}

/**
 * The batch as this scan reads it, once tracking has settled every lifecycle
 * (roadmap/progress.ts applyProgress): the policies still to create and the
 * ones created, in plan order; Completed when none is left to create. A batch
 * with nothing in it leaves the plan.
 */
export function settleReportOnlyBatch(steps: Step[], tenant: TenantPolicies = new Map()): void {
  const at = steps.findIndex((s) => s.id === REPORT_ONLY_STEP_ID)
  if (at === -1) return
  const batch = steps[at]
  const create: string[] = []
  const created: string[] = []
  const leftOut = new Set<ReportOnlyOutlier>()
  for (const s of steps) {
    const member = batchMemberOf(s, tenant)
    if (member === 'create') create.push(s.id)
    else if (member === 'created') created.push(s.id)
    for (const why of leftOutOf(s)) leftOut.add(why)
  }
  if (create.length === 0 && created.length === 0) {
    steps.splice(at, 1)
    return
  }
  // Only the policies still to create (owner, 2026-09-26): a created policy with
  // a setting to correct is its own step's task, never listed here a second time,
  // and never holds this step open.
  batch.reportOnlyBatch = { create, created, ...(leftOut.size > 0 ? { leftOut: OUTLIERS.filter((k) => leftOut.has(k)) } : {}) }
  // Impact counts what the step changes: the policies still to create, and once none is left, the ones it created.
  batch.impactCount = create.length > 0 ? create.length : created.length
  setState(batch, { satisfied: create.length === 0 })
}
