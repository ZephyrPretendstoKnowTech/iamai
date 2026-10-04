// A fixture whose policy for one step is built exactly as the plan asks (every
// control is exact, owner 2026-09-25). The demo's admin policy differs from the
// plan's in its users and grant, which is a correction on every scan; a case about
// drift, renaming or replacing that policy starts from one with nothing to correct.
//
// Since the policy-matching pilot (T4-PM; owner, 2026-09-27: build new, retire
// old) 4.3 builds the baseline's policy beside a tenant policy that is not the
// plan's in every setting, and tracks none: the policy reshaped here is then the
// one it builds beside, given the baseline's name as well, so it is the plan's
// own policy the step tracks and corrects, as before.
import type { Fixture } from './index.ts'
import { runFixture } from './run.ts'

type Row = Record<string, unknown>

export function asPlanned(f: Fixture, stepId: string): Fixture {
  const step = runFixture(f).steps.find((s) => s.id === stepId)
  const beside = step?.action.besidePolicies ?? []
  const policyId = step?.tracking?.policyId ?? (beside.length === 1 ? beside[0].policyId : undefined)
  if (!step || !policyId) return f
  const rowsOf = (snap: Fixture['snapshot']): Row[] => (snap.config.caPolicies?.rows ?? []) as Row[]
  // A finished step submits nothing: the plan's policy is the one it writes once the policy is back in Report-only.
  const reopened = structuredClone(f.snapshot)
  rowsOf(reopened).find((p) => p.id === policyId)!.state = 'enabledForReportingButNotEnforced'
  const again = runFixture({ ...f, snapshot: reopened }).steps.find((s) => s.id === stepId)
  // The step that builds beside the policy creates the plan's whole policy: that create is the shape.
  const created = (s: typeof step | undefined): Row | undefined => {
    const op = s?.action.resolution?.policies[0]
    return op?.mode === 'create' ? (op.body as Row) : undefined
  }
  const intent = step.action.resolution?.policies[0]?.intent ?? step.action.intended ?? again?.action.resolution?.policies[0]?.intent ?? again?.action.intended ?? created(step) ?? created(again)
  if (!intent) return f
  const snapshot = structuredClone(f.snapshot)
  const row = rowsOf(snapshot).find((p) => p.id === policyId)!
  for (const k of ['conditions', 'grantControls', 'sessionControls']) row[k] = structuredClone(intent[k] ?? null)
  // A policy the step built beside takes the baseline's name too: built as the
  // plan asks, it is the plan's own, which the step tracks, compares and corrects
  // (a case about its drift needs that), not one of the tenant's left to retire.
  if (beside.length === 1 && !step.tracking?.policyId && step.createName) row.displayName = step.createName
  return { ...f, snapshot }
}

/**
 * A fixture whose tenant policy a step builds the baseline's beside (T4-PM) is
 * the plan's own instead: it carries the baseline's name, as a policy built from
 * the step's procedure does, so the step compares and corrects it as it always
 * has. A case about a correction, its history or its acceptance starts here; the
 * fixture is returned as it is where the step builds beside nothing.
 */
export function asPlansOwn(f: Fixture, stepId: string): Fixture {
  const step = runFixture(f).steps.find((s) => s.id === stepId)
  const beside = step?.action.besidePolicies ?? []
  const name = step?.createName
  if (!step || beside.length !== 1 || !name) return f
  const snapshot = structuredClone(f.snapshot)
  const row = ((snapshot.config.caPolicies?.rows ?? []) as Row[]).find((p) => p.id === beside[0].policyId)
  if (!row) return f
  row.displayName = name
  return { ...f, snapshot }
}
