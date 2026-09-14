// R1 probe: REVIEW-1 F2 with prerequisites met synthetically (as s1-c01-render.ts: curated demo-week2,
// actionable exclusions group carved out, every person Ready). Admins policy assigned to a GROUP with the
// built-in phishing-resistant strength; internal-users MFA policy assigned to a group; role session policy.
// Prints whether the all-users step's wrong target is offered, and what JSON/PowerShell carry. REV=1 reverses.
// Synthetic only; no network.
import { curatedFixture } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../../../src/mapping/safetyChoice.ts'
import { personReadiness } from '../../../src/scoring/phishingResistant.ts'
import { implementationOffered, policyJson, stepOperations } from '../../../src/ui/surfaces/stepJson.ts'
import { nextSafeAction } from '../../../src/roadmap/nextSafeAction.ts'
import { powershellFor } from '../../../src/ui/surfaces/stepPowerShell.ts'
const GA = '62e90394-69f5-4237-9190-012177145e10'
const IDS = { admin: 'c0100000-0000-4000-8000-000000000001', internal: 'c0100000-0000-4000-8000-000000000002', session: 'c0100000-0000-4000-8000-000000000003' }
const READY = personReadiness({ methods: [{ kind: 'passkey' }], registered: null, signIns: { read: true, proofs: [{ cls: 'passkey', os: 'Windows', at: '2026-01-01T00:00:00.000Z', method: 'Passkey (device-bound)' }], platforms: [{ os: 'Windows', at: '2026-01-01T00:00:00.000Z' }] }, history: null } as never)
const base = curatedFixture('demo-week2')
const f = { ...base, groups: new Map(base.groups) }
const g = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })!
const others = [...f.groups.keys()].filter((id) => id !== g)
const internalGroup = others[0]
const adminsGroup = others[1] ?? 'bbbbbbbb-0000-4000-8000-00000000000a'
if (!f.groups.has(adminsGroup)) {
  const src = structuredClone(f.groups.get(internalGroup)) as any
  f.groups.set(adminsGroup, { ...src, groupId: adminsGroup, memberIds: (src.memberIds ?? []).slice(0, 1), memberCount: Math.min(1, src.memberCount ?? 1), object: src.object ? { ...src.object, displayName: 'Synthetic admins group' } : src.object })
}
const apps = { includeApplications: ['All'] }
const rows = [
  { id: IDS.admin, displayName: 'Policy A', state: 'enabled', conditions: { users: { includeGroups: [adminsGroup], excludeGroups: [g] }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } } },
  { id: IDS.internal, displayName: 'Policy B', state: 'enabled', conditions: { users: { includeGroups: [internalGroup], excludeGroups: [g] }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } },
  { id: IDS.session, displayName: 'Policy C', state: 'enabled', conditions: { users: { includeRoles: [GA], excludeGroups: [g] }, applications: apps, clientAppTypes: ['all'] }, grantControls: null, sessionControls: { signInFrequency: { isEnabled: true, value: 24, type: 'hours', frequencyInterval: 'timeBased' } } },
]
const ca = f.snapshot.config.caPolicies!
const keep = (ca.rows as any[]).filter((p) => !/MFA for all users|Admins phishing-resistant|Admin sign-in|session/i.test(String(p.displayName)))
const mine = process.env.REV === '1' ? [...rows].reverse() : rows
const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: [...mine, ...keep] } } }
const scored = runFixture({ ...f, snapshot }, { snapshot } as never).viability
const viability = scored.map((v) => ({ ...v, readiness: READY }))
const r = runFixture({ ...f, snapshot }, { snapshot, viability } as never)
const who = (id: unknown) => Object.entries(IDS).find(([, v]) => v === id)?.[0] ?? id
console.log('== order', process.env.REV === '1' ? 'reversed' : 'listed', 'groups internal/admins', internalGroup, adminsGroup)
for (const goalId of ['mfa-all-users', 'admins-phishing-resistant', 'admin-session']) {
  const s = r.steps.find((x) => x.goalId === goalId && x.kind !== 'verify')
  if (!s) { console.log('  ', goalId, 'no step'); continue }
  const cov = r.coverage.results.find((x) => x.goal.id === goalId)
  const ops = stepOperations(s)
  const nsa = nextSafeAction(s) as any
  console.log('  ', goalId, s.kind, 'cov', cov?.status, JSON.stringify(cov?.candidates.map((c) => [who(c.policyId), c.contribution, c.ownScope])), 'offered', implementationOffered(s), 'next', JSON.stringify({ kind: nsa.kind, executable: nsa.executable }), 'blockers', JSON.stringify(s.blockers.map((b: any) => b.label)))
  console.log('     resolution', JSON.stringify((s.action.resolution?.policies ?? []).map((o: any) => [o.mode, who(o.policyId), JSON.stringify(o.body ?? {}).slice(0, 220)])))
  console.log('     ops', JSON.stringify(ops.map((o: any) => [o.mode, who(o.policyId), Object.keys(o.body ?? {})])), '| json', JSON.stringify(policyJson(s)).slice(0, 260))
  const ps = powershellFor(ops)
  console.log('     ps carries', Object.values(IDS).filter((id) => ps.includes(id)).map(who), '| includeUsers All in ps', /includeUsers[^\]]*All/.test(ps))
}
