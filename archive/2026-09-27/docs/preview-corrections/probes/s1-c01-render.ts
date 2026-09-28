// S1 C01 rendered-channel probe: prerequisites met synthetically (curated demo-week2, exclusions group
// carved out, every person Ready as resolvePolicy.test.ts does), admin policy in report-only.
// Prints what Entra/JSON/PowerShell actually carry for each corrected goal. No network.
import { curatedFixture } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../../../src/mapping/safetyChoice.ts'
import { personReadiness } from '../../../src/scoring/phishingResistant.ts'
import { implementationOffered, policyJson, stepOperations } from '../../../src/ui/surfaces/stepJson.ts'
import { powershellFor } from '../../../src/ui/surfaces/stepPowerShell.ts'
import { portalNamesFor, stepPortalLines } from '../../../src/ui/surfaces/stepPortal.ts'
import { stepVars } from '../../../src/ui/surfaces/stepVars.ts'
const GA = '62e90394-69f5-4237-9190-012177145e10'
const IDS = { admin: 'c0100000-0000-4000-8000-000000000001', everyone: 'c0100000-0000-4000-8000-000000000002', session: 'c0100000-0000-4000-8000-000000000003' }
const READY = personReadiness({ methods: [{ kind: 'passkey' }], registered: null, signIns: { read: true, proofs: [{ cls: 'passkey', os: 'Windows', at: '2026-01-01T00:00:00.000Z', method: 'Passkey (device-bound)' }], platforms: [{ os: 'Windows', at: '2026-01-01T00:00:00.000Z' }] }, history: null } as never)
const f = curatedFixture('demo-week2')
const g = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })!
const apps = { includeApplications: ['All'] }
const rows = [
  { id: IDS.admin, displayName: 'Policy A', state: 'enabledForReportingButNotEnforced', conditions: { users: { includeRoles: [GA], excludeGroups: [g] }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } } },
  { id: IDS.everyone, displayName: 'Policy B', state: 'enabled', conditions: { users: { includeUsers: ['All'], excludeGroups: [g], excludeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'internalGuest,b2bCollaborationGuest,b2bCollaborationMember,b2bDirectConnectUser,otherExternalUser,serviceProvider', externalTenants: { membershipKind: 'all' } } }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } },
  { id: IDS.session, displayName: 'Policy C', state: 'enabled', conditions: { users: { includeRoles: [GA], excludeGroups: [g] }, applications: apps, clientAppTypes: ['all'] }, grantControls: null, sessionControls: { signInFrequency: { isEnabled: true, value: 24, type: 'hours', frequencyInterval: 'timeBased' } } },
]
const ca = f.snapshot.config.caPolicies!
const order = process.env.REV === '1' ? [...rows].reverse() : rows
const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: order } } }
const scored = runFixture({ ...f, snapshot }, { snapshot } as never).viability
const viability = scored.map((v) => ({ ...v, readiness: READY }))
const r = runFixture({ ...f, snapshot }, { snapshot, viability } as never)
const who = (id: unknown) => Object.entries(IDS).find(([, v]) => v === id)?.[0] ?? id
const ctx = { snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
for (const goalId of ['mfa-all-users', 'admins-phishing-resistant', 'admin-session']) {
  const s = r.steps.find((x) => x.goalId === goalId && x.kind !== 'verify')
  if (!s) { console.log('==', goalId, 'no step'); continue }
  const ops = stepOperations(s)
  console.log('==', goalId, s.kind, 'offered', implementationOffered(s), 'blockers', JSON.stringify(s.blockers.map((b: any) => b.label)), 'ops', JSON.stringify(ops.map((o: any) => [o.mode, who(o.policyId), Object.keys(o.body)])), 'changes', JSON.stringify((s.action.changes ?? []).map((c) => c.field)))
  const portal = stepPortalLines(s, portalNamesFor(ctx as never, stepVars(s, ctx as never) as Record<string, unknown>, s.title))
  console.log('  portal', JSON.stringify(portal))
  console.log('  json', JSON.stringify(policyJson(s)).slice(0, 500))
  const ps = powershellFor(ops)
  console.log('  ps carries', Object.values(IDS).filter((id) => ps.includes(id)).map(who), '| grant in ps', /grantControls/.test(ps), '| session in ps', /sessionControls/.test(ps), '| state in ps', /"state"|state\s*=/.test(ps))
}
