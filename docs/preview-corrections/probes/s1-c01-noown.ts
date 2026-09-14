// S1 C01 probe: a goal with no policy of its own scope — does its step rewrite another goal's policy?
// Synthetic only (demo-week2); no network.
import { fixture } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
const GA = '62e90394-69f5-4237-9190-012177145e10'
const f = fixture('demo-week2')
const ca = f.snapshot.config.caPolicies!
const apps = { includeApplications: ['All'] }
const cases: Record<string, Record<string, unknown>[]> = {
  'A guests goal, only All-users MFA (no exclusions group)': [
    { id: 'p-all', displayName: 'Policy 1', state: 'enabled', conditions: { users: { includeUsers: ['All'], excludeGroups: [] }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } },
  ],
  'B all-users goal, only admin-role MFA (no exclusions group)': [
    { id: 'p-admin', displayName: 'Policy 2', state: 'enabled', conditions: { users: { includeRoles: [GA], excludeGroups: [] }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } },
  ],
}
for (const [label, rows] of Object.entries(cases)) {
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows } } }
  const r = runFixture({ ...f, snapshot }, { snapshot } as never)
  console.log('==', label)
  for (const goalId of ['guests-mfa', 'mfa-all-users', 'admins-phishing-resistant']) {
    const cov = r.coverage.results.find((x) => x.goal.id === goalId)!
    const s = r.steps.find((x) => x.goalId === goalId && x.kind !== 'verify')
    const ops = (s?.action.resolution?.policies ?? []).map((o: any) => [o.mode, o.policyId, JSON.stringify(o.body).slice(0, 260)])
    console.log(' ', goalId, cov.status, JSON.stringify(cov.candidates.map((c) => [c.policyId, c.contribution, c.ownScope, c.caveats.join('+')])), '| step', s?.kind, '| track', s?.tracking?.policyId ?? null, '| ops', JSON.stringify(ops), '| changes', JSON.stringify((s?.action.changes ?? []).map((c) => c.field)))
  }
}
