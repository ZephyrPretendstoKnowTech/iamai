// Create the Policies in Report-only (3.8, owner 2026-09-24): one step at the
// end of Prepare Accounts and Objects that lists every policy the plan can
// create in Report-only now, so each starts its report-only week at once. It
// completes when the scan sees each listed policy in Report-only or On, and the
// policy steps in sections 4 to 8 then open in their report-only week; their
// turn-ons keep their order, because each still waits on what it waited on.
//
// What it lists is read from the policies themselves (the pinned baseline, and
// the tenant's licences through the plan: a policy not licensed is not on it):
//   - every policy step whose next task is to create its policy, and whose
//     create the plan can write now (operations.ts implementationOffered): a step
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
import { implementationOffered, operationBodies } from './operations.ts'
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
 * The policies a step writes (its operations: the authority on what a policy
 * means, operations.ts), else, once created, the tenant's own as the scan read
 * them through tracking.
 */
function policiesOf(step: Step, tenant: TenantPolicies): Json[] {
  const bodies = operationBodies(step as Parameters<typeof operationBodies>[0])
  if (bodies.length > 0) return bodies
  return (step.tracking?.members ?? []).flatMap((m) => (m.policyId && tenant.has(m.policyId) ? [tenant.get(m.policyId)!] : []))
}

/**
 * Whether report-only would do harm or nothing for this policy: a user action
 * (report-only doesn't cover them), or a compliant- or managed-device check that
 * reaches beyond Windows (report-only can prompt macOS, iOS and Android users for
 * a device certificate).
 */
export function reportOnlyOutlier(policy: Json): boolean {
  const c = obj(policy.conditions)
  if (strings(obj(c.applications).includeUserActions).length > 0) return true
  const grant = strings(obj(policy.grantControls).builtInControls)
  const rule = String(obj(obj(c.devices).deviceFilter).rule ?? '')
  const deviceCheck = grant.includes('compliantDevice') || grant.includes('domainJoinedDevice') || /isCompliant|trustType/i.test(rule)
  const platforms = strings(obj(c.platforms).includePlatforms).map((p) => p.toLowerCase())
  const windowsOnly = platforms.length > 0 && platforms.every((p) => p === 'windows')
  return deviceCheck && !windowsOnly
}

/** A policy step the batch can ever list, whatever its lifecycle. */
export function batchable(step: Step, tenant: TenantPolicies = new Map()): boolean {
  if (step.kind !== 'create' && step.kind !== 'adjust') return false
  if (step.status === 'skipped' || step.state.setAside || step.doesntApply || step.goalId === COUNTRIES_GOAL) return false
  const policies = policiesOf(step, tenant)
  return policies.length > 0 && !policies.some(reportOnlyOutlier)
}

/** Where a policy step stands in the batch: still to create, already created, or not in it. */
export function batchMemberOf(step: Step, tenant: TenantPolicies = new Map()): 'create' | 'created' | null {
  if (!batchable(step, tenant)) return null
  if (CREATED.has(step.state.lifecycle ?? '')) return 'created'
  if (step.kind === 'create' && step.state.lifecycle === 'not-deployed' && implementationOffered(step as Parameters<typeof implementationOffered>[0])) return 'create'
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
  const correct: string[] = []
  for (const s of steps) {
    const member = batchMemberOf(s, tenant)
    if (member === 'create') create.push(s.id)
    else if (member === 'created') {
      created.push(s.id)
      // Every control is exact (owner, 2026-09-25): a created policy with a
      // setting that is not the plan's is not done until it is corrected.
      if (s.state.members.some((m) => m.change.unwritten.length > 0)) correct.push(s.id)
    }
  }
  if (create.length === 0 && created.length === 0) {
    steps.splice(at, 1)
    return
  }
  batch.reportOnlyBatch = { create, created, correct }
  // Impact counts what the step changes: the policies still to create or correct, and once none is left, the ones it lists.
  const open = create.length + correct.length
  batch.impactCount = open > 0 ? open : created.length
  setState(batch, { satisfied: open === 0 })
}
