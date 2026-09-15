// S1 probe: the drift audit's A1 case after the C01 fallback change. Synthetic (curated demo-week2).
import { curatedFixture } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
const A = curatedFixture('demo-week2')
const snapshot = structuredClone(A.snapshot)
const rows = snapshot.config.caPolicies!.rows as any[]
const row = rows.find((p) => p.displayName === 'Core - Grant - MFA for all users')
row.grantControls = { operator: 'OR', builtInControls: ['compliantDevice'] }
const r = runFixture({ ...A, snapshot })
const name = (id: unknown) => rows.find((p) => p.id === id)?.displayName ?? id
const cov = r.coverage.results.find((x) => x.goal.id === 'mfa-all-users')!
console.log('cov', cov.status, JSON.stringify(cov.candidates.map((c) => [c.policyName, c.contribution, c.ownScope])))
const s = r.steps.find((x) => x.goalId === 'mfa-all-users' && x.kind !== 'verify')!
console.log('step', s.id, s.kind, 'status', s.status, 'naming', JSON.stringify((s as any).naming ?? null))
console.log('ops', JSON.stringify((s.action.resolution?.policies ?? []).map((o: any) => [o.mode, name(o.policyId), (o.body as any)?.displayName ?? null])))
console.log('tracking', JSON.stringify({ policyId: name(s.tracking?.policyId), matchedBy: s.tracking?.matchedBy, members: s.tracking?.members?.map((m: any) => [m.key, name(m.policyId), m.matchedBy, m.correction, m.ready]) }))
console.log('lifecycle', JSON.stringify(s.state))
