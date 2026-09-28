// S5 probe: dump the messy fixture's admins step (candidates with reach flags, tracking, resolution, state).
// Synthetic only; no network. FIX=messy (default) or any fixture name; CURATED=1 uses the curated fixture.
import { fixture, curatedFixture } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
const name = process.env.FIX ?? 'messy'
const goal = process.env.GOAL ?? 'admins-phishing-resistant'
const f = process.env.CURATED === '1' ? curatedFixture(name as never) : fixture(name as never)
const r = runFixture(f)
const rows = (f.snapshot.config.caPolicies?.rows ?? []) as any[]
const nm = (id: unknown) => rows.find((p) => p.id === id)?.displayName ?? id
const cov = r.coverage.results.find((x) => x.goal.id === goal)!
console.log('status', cov.status, 'satisfaction', JSON.stringify(cov.satisfaction))
for (const c of cov.candidates) console.log('  cand', JSON.stringify([nm(c.policyId), c.state, c.contribution, 'own', c.ownScope, 'whole', c.reachesWhole, 'all', c.assignedToAll, c.caveats]))
const s = r.steps.find((x) => x.goalId === goal && x.kind !== 'verify')!
console.log('step', s.kind, 'lifecycle', s.state?.lifecycle, 'condition', s.state?.condition, 'ambiguous', s.action.ambiguousTarget ?? null)
console.log('tracking', JSON.stringify([s.tracking?.matchedBy ?? null, nm(s.tracking?.policyId)]))
console.log('resolution', JSON.stringify((s.action.resolution?.policies ?? []).map((o: any) => [o.mode, nm(o.policyId), Object.keys(o.body ?? {})])))
