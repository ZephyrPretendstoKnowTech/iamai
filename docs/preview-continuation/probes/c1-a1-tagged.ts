// Cycle 1 probe: drift audit A1 (MFA-for-all grant drifted to compliant device) with and without the plan's own tag
// on the drifted policy, and with the policy's name set to the plan's proposed name. Synthetic: curated demo-week2.
import { curatedFixture } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
import { stepIdForGoal } from '../../../src/roadmap/generate.ts'
import { nextSafeAction } from '../../../src/roadmap/nextSafeAction.ts'
const base = curatedFixture('demo-week2')
const stepId = stepIdForGoal('mfa-all-users')
for (const mode of ['untracked', 'tagged', 'named']) {
  const snapshot = structuredClone(base.snapshot)
  const rows = snapshot.config.caPolicies!.rows as any[]
  const row = rows.find((p) => p.displayName === 'Core - Grant - MFA for all users')
  row.grantControls = { operator: 'OR', builtInControls: ['compliantDevice'] }
  if (mode === 'tagged') row.description = `[IAMAI:${base.planId}:${stepId}]`
  if (mode === 'named') row.displayName = 'Core - Require - MFA for all users'
  const run = runFixture({ ...base, snapshot })
  const step = run.steps.find((s) => s.id === stepId)!
  const cov = run.coverage.results.find((r) => r.goal.id === 'mfa-all-users')!
  const ops = (step.action.resolution?.policies ?? []).map((o: any) => [o.mode, o.mode === 'update' ? (o.policyId === row.id ? 'DRIFTED' : o.policyId) : o.body?.displayName])
  console.log(mode, 'status', cov.status, 'kind', step.kind, 'ops', JSON.stringify(ops), 'tracking', step.tracking?.policyId === row.id ? 'DRIFTED' : step.tracking?.policyId ?? null, step.tracking?.matchedBy ?? null, 'next', JSON.stringify(nextSafeAction(step)), 'cond', step.state.condition)
}
