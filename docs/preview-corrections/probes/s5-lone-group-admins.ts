// S5 probe: the tenant's only all-users MFA candidate is an admins GROUP policy with the built-in phishing-resistant
// strength (no staff policy beside it). Curated demo-week2, other policies kept, as R1's F2 probe; prerequisites met.
// Prints the all-users step's target and what it hands over. Synthetic only; no network.
import { curatedFixture } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../../../src/mapping/safetyChoice.ts'
import { personReadiness } from '../../../src/scoring/phishingResistant.ts'
import { stepOperations } from '../../../src/ui/surfaces/stepJson.ts'
import { nextSafeAction } from '../../../src/roadmap/nextSafeAction.ts'
const READY = personReadiness({ methods: [{ kind: 'passkey' }], registered: null, signIns: { read: true, proofs: [{ cls: 'passkey', os: 'Windows', at: '2026-01-01T00:00:00.000Z', method: 'Passkey (device-bound)' }], platforms: [{ os: 'Windows', at: '2026-01-01T00:00:00.000Z' }] }, history: null } as never)
const base = curatedFixture('demo-week2')
const f = { ...base, groups: new Map(base.groups) }
const g = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })!
const staff = [...f.groups.keys()].find((id) => id !== g)!
const adm = 'bbbbbbbb-0000-4000-8000-00000000000a'
const src = structuredClone(f.groups.get(staff)) as any
f.groups.set(adm, { ...src, groupId: adm, memberIds: (src.memberIds ?? []).slice(0, 1), memberCount: 1 })
const row = { id: 'c0100000-0000-4000-8000-000000000001', displayName: 'Policy A', state: 'enabled', conditions: { users: { includeGroups: [adm], excludeGroups: [g] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } } }
const ca = f.snapshot.config.caPolicies!
const keep = (ca.rows as any[]).filter((p) => !/MFA for all users|Admins phishing-resistant|Admin sign-in|session/i.test(String(p.displayName)))
const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: [row, ...keep] } } }
const scored = runFixture({ ...f, snapshot }, { snapshot } as never).viability
const r = runFixture({ ...f, snapshot }, { snapshot, viability: scored.map((v) => ({ ...v, readiness: READY })) } as never)
const s = r.steps.find((x) => x.goalId === 'mfa-all-users' && x.kind !== 'verify')!
const cov = r.coverage.results.find((x) => x.goal.id === 'mfa-all-users')!
console.log('cov', cov.status, JSON.stringify(cov.candidates.map((c) => [c.policyName, c.contribution, c.ownScope, c.reachesWhole, c.assignedToAll])))
console.log('step', s.kind, 'ambiguous', s.action.ambiguousTarget ?? null, 'next', JSON.stringify(nextSafeAction(s)), 'tracking', s.tracking?.policyId ?? null)
console.log('ops', JSON.stringify(stepOperations(s).map((o: any) => [o.mode, o.policyId, JSON.stringify(o.body ?? {}).slice(0, 200)])))
