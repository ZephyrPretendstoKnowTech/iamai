// S1 probe: the guests step in small with the exclusions answer left open (planVariants 'small+unanswered'). Synthetic.
import { fixture, noExclusionsAnswer } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
const f = noExclusionsAnswer(fixture('small'))
const r = runFixture(f)
const rows = (f.snapshot.config.caPolicies?.rows ?? []) as any[]
const name = (id: unknown) => rows.find((p) => p.id === id)?.displayName ?? id
for (const p of rows) console.log('pol', p.displayName, p.state, JSON.stringify(p.conditions?.users), JSON.stringify(p.grantControls?.builtInControls))
const cov = r.coverage.results.find((x) => x.goal.id === 'guests-mfa')!
console.log('cov', cov.status, JSON.stringify(cov.candidates.map((c) => [c.policyName, c.contribution, c.ownScope, c.meetsFloor, c.caveats])), 'satisfaction', JSON.stringify(cov.satisfaction))
const s = r.steps.find((x) => x.goalId === 'guests-mfa' && x.kind !== 'verify')!
console.log('step', s.kind, s.state.lifecycle, s.state.condition, 'unmatchedPair', (s.action as any).unmatchedPair ?? null, 'ops', JSON.stringify((s.action.resolution?.policies ?? []).map((o: any) => [o.mode, name(o.policyId)])), 'tracking', JSON.stringify(s.tracking ? { policyId: name(s.tracking.policyId), matchedBy: s.tracking.matchedBy, members: s.tracking.members?.map((m: any) => [m.key, name(m.policyId), m.matchedBy, m.ambiguous ?? null]) } : null))
