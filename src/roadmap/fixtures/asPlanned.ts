// A fixture whose policy for one step is built exactly as the plan asks (every
// control is exact, owner 2026-09-25). The demo's admin policy differs from the
// plan's in its users and grant, which is a correction on every scan; a case about
// drift, renaming or replacing that policy starts from one with nothing to correct.
import type { Fixture } from './index.ts'
import { runFixture } from './run.ts'

type Row = Record<string, unknown>

export function asPlanned(f: Fixture, stepId: string): Fixture {
  const step = runFixture(f).steps.find((s) => s.id === stepId)
  const policyId = step?.tracking?.policyId
  if (!step || !policyId) return f
  const rowsOf = (snap: Fixture['snapshot']): Row[] => (snap.config.caPolicies?.rows ?? []) as Row[]
  // A finished step submits nothing: the plan's policy is the one it writes once the policy is back in Report-only.
  const reopened = structuredClone(f.snapshot)
  rowsOf(reopened).find((p) => p.id === policyId)!.state = 'enabledForReportingButNotEnforced'
  const again = runFixture({ ...f, snapshot: reopened }).steps.find((s) => s.id === stepId)
  const intent = step.action.resolution?.policies[0]?.intent ?? step.action.intended ?? again?.action.resolution?.policies[0]?.intent ?? again?.action.intended
  if (!intent) return f
  const snapshot = structuredClone(f.snapshot)
  const row = rowsOf(snapshot).find((p) => p.id === policyId)!
  for (const k of ['conditions', 'grantControls', 'sessionControls']) row[k] = structuredClone(intent[k] ?? null)
  return { ...f, snapshot }
}
