// S5 probe: the policyIdentity R1-F2 group shape (rows replace the demo tenant's policies) — what the held all-users
// step's action and resolution carry. Synthetic only; no network. REV=1 reverses.
import { fixture } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../../../src/mapping/safetyChoice.ts'
import { stepOperations } from '../../../src/ui/surfaces/stepJson.ts'
const base = fixture('demo-week2')
const f = { ...base, groups: new Map(base.groups) }
const ex = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })!
const staff = [...f.groups.keys()].find((id) => id !== ex)!
const adm = 'bbbbbbbb-0000-4000-8000-00000000000a'
const copy = structuredClone(f.groups.get(staff)) as any
f.groups.set(adm, { ...copy, groupId: adm, memberIds: (copy.memberIds ?? []).slice(0, 1), memberCount: 1 })
const apps = { includeApplications: ['All'] }
const rows: any[] = [
  { id: 'A', displayName: 'Policy 1', state: 'enabled', conditions: { users: { includeGroups: [adm], excludeGroups: [ex] }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } } },
  { id: 'B', displayName: 'Policy 2', state: 'enabled', conditions: { users: { includeGroups: [staff], excludeGroups: [ex] }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } },
]
const ca = f.snapshot.config.caPolicies!
const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: process.env.REV === '1' ? [...rows].reverse() : rows } } }
const r = runFixture({ ...f, snapshot }, { snapshot } as never)
const cov = r.coverage.results.find((x) => x.goal.id === 'mfa-all-users')!
console.log('status', cov.status, JSON.stringify(cov.candidates.map((c) => [c.policyId, c.contribution, c.ownScope, c.reachesWhole, c.assignedToAll, c.caveats])))
const s = r.steps.find((x) => x.goalId === 'mfa-all-users' && x.kind !== 'verify')!
console.log('step', s.kind, 'action keys', Object.keys(s.action), 'ambiguous', s.action.ambiguousTarget ?? null, 'unmatchedPair', s.action.unmatchedPair ?? null)
console.log('resolution', JSON.stringify(s.action.resolution).slice(0, 600))
console.log('ops', JSON.stringify(stepOperations(s)))
