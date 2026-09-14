// R1 probe: drift audit A1 (MFA-for-all grant drifted to compliant device), no prior record.
// What the all-users step proposes after C01 now that another goal's policy is never its target.
// Synthetic only: curated demo-week2; no tenant, no network. DRIFT=0 runs the undrifted tenant.
import { curatedFixture } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
import { stepIdForGoal } from '../../../src/roadmap/generate.ts'
import { nextSafeAction } from '../../../src/roadmap/nextSafeAction.ts'
import { driftOutcomeOf } from '../../../src/roadmap/tracking.ts'
import { stepOperations } from '../../../src/ui/surfaces/stepJson.ts'

const base = curatedFixture('demo-week2')
const snapshot = structuredClone(base.snapshot)
const rows = snapshot.config.caPolicies!.rows as any[]
const row = rows.find((p) => p.displayName === 'Core - Grant - MFA for all users')
if (process.env.DRIFT !== '0') row.grantControls = { operator: 'OR', builtInControls: ['compliantDevice'] }
const run = runFixture({ ...base, snapshot })
const name = (id: unknown) => rows.find((p) => p.id === id)?.displayName ?? id
for (const goal of ['mfa-all-users', 'admins-phishing-resistant']) {
  const step = run.steps.find((s) => s.id === stepIdForGoal(goal))!
  const cov = run.coverage.results.find((r) => r.goal.id === goal)!
  const nsa = nextSafeAction(step) as any
  console.log('==', goal, 'coverage', cov.status, JSON.stringify(cov.candidates.map((c) => [name(c.policyId), c.contribution, c.ownScope, c.meetsFloor ?? null])))
  console.log('   ops', JSON.stringify(stepOperations(step).map((o: any) => [o.mode, name(o.policyId), Object.keys(o.body ?? {}).join('+'), o.body?.displayName ?? null, o.body?.state ?? null])))
  console.log('   tracking', JSON.stringify([step.tracking?.matchedBy ?? null, name(step.tracking?.policyId)]), 'drift', driftOutcomeOf(step), 'lifecycle', step.state?.lifecycle)
  console.log('   nextSafeAction', JSON.stringify({ kind: nsa.kind ?? nsa.action ?? null, executable: nsa.executable }), 'blockers', JSON.stringify(step.blockers?.map((b: any) => b.label)))
}
