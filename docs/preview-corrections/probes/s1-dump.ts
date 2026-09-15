// S1 probe: what the synthetic fixtures hold for the MFA/admin/session goals. Local, synthetic only.
import { fixture } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
import { stepOperations } from '../../../src/ui/surfaces/stepJson.ts'
const GOALS = ['mfa-all-users', 'admins-phishing-resistant', 'admin-session']
for (const name of ['demo', 'getiamai'] as const) {
  const f = fixture(name)
  console.log('==', name)
  for (const p of (f.snapshot.config.caPolicies?.rows ?? []) as any[]) console.log('  pol', p.id.slice(0, 8), p.state, JSON.stringify(p.displayName), 'users', JSON.stringify(p.conditions?.users), 'grant', JSON.stringify(p.grantControls), 'session', JSON.stringify(p.sessionControls))
  const r = runFixture(f)
  for (const g of GOALS) {
    const cov = r.coverage.results.find((x) => x.goal.id === g)
    console.log('  cov', g, cov?.status, JSON.stringify(cov?.candidates.map((c) => [c.policyName, c.contribution, c.ownScope, c.caveats])))
    const s = r.steps.find((x) => x.goalId === g)
    if (!s) { console.log('  step', g, 'none'); continue }
    const ops = stepOperations(s)
    console.log('  step', g, s.kind, JSON.stringify(s.state), 'ops', JSON.stringify(ops.map((o: any) => ({ mode: o.mode, policyId: o.policyId, keys: Object.keys(o) }))), 'tracking', JSON.stringify((s as any).tracking?.matchedBy), (s as any).tracking?.policyId)
  }
}
