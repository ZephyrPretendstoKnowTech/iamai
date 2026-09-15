// S1 C01 channel probe on demo-week2 (chosen exclusions group carved out). Synthetic only.
import { fixture } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../../../src/mapping/safetyChoice.ts'
import { implementationOffered, policyJson, stepOperations } from '../../../src/ui/surfaces/stepJson.ts'
import { powershellFor } from '../../../src/ui/surfaces/stepPowerShell.ts'
import { portalNamesFor, stepPortalLines } from '../../../src/ui/surfaces/stepPortal.ts'
import { stepVars } from '../../../src/ui/surfaces/stepVars.ts'
const GA = '62e90394-69f5-4237-9190-012177145e10'
const IDS = { admin: 'aaaaaaaa-0000-4000-8000-000000000001', internal: 'aaaaaaaa-0000-4000-8000-000000000002', session: 'aaaaaaaa-0000-4000-8000-000000000003' }
const f = fixture('demo-week2')
const g = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })
console.log('chosen group', g)
const apps = { includeApplications: ['All'] }
const ex = process.env.NOEX === '1' ? [] : [g]
const rows = [
  { id: IDS.admin, displayName: 'Core - Allow - MFA for Admins', state: 'enabled', conditions: { users: { includeRoles: [GA], excludeGroups: ex }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } } },
  { id: IDS.internal, displayName: 'Core - Allow - MFA for Internal Users', state: process.env.RO === '1' ? 'enabledForReportingButNotEnforced' : 'enabled', conditions: { users: { includeUsers: ['All'], excludeGroups: ex, excludeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'internalGuest,b2bCollaborationGuest,b2bCollaborationMember,b2bDirectConnectUser,otherExternalUser,serviceProvider', externalTenants: { membershipKind: 'all' } } }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } },
  { id: IDS.session, displayName: 'Core - Session - Admin sign-in frequency', state: 'enabled', conditions: { users: { includeRoles: [GA], excludeGroups: ex }, applications: apps, clientAppTypes: ['all'] }, grantControls: null, sessionControls: { signInFrequency: { isEnabled: true, value: 24, type: 'hours', frequencyInterval: 'timeBased' } } },
]
const ca = f.snapshot.config.caPolicies!
const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: process.env.REV === '1' ? [...rows].reverse() : rows } } }
const r = runFixture({ ...f, snapshot }, { snapshot } as never)
const who = (id: unknown) => Object.entries(IDS).find(([, v]) => v === id)?.[0] ?? id
const ctx = { snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
for (const goalId of ['mfa-all-users', 'admins-phishing-resistant', 'admin-session']) {
  const cov = r.coverage.results.find((x) => x.goal.id === goalId)!
  const s = r.steps.find((x) => x.goalId === goalId && x.kind !== 'verify')
  if (!s) { console.log(goalId, 'no step', cov.status); continue }
  const upd = (s.action.resolution?.policies ?? []).map((o: any) => [o.mode, who(o.policyId), JSON.stringify(o.body)])
  console.log('==', goalId, cov.status, s.kind, 'track', s.tracking?.matchedBy, who((s.tracking as any)?.policyId), 'offered', implementationOffered(s), 'missing', JSON.stringify(s.action.missing), 'blockers', JSON.stringify(s.blockers?.map((b: any) => b.label)))
  console.log('  reasons', JSON.stringify(cov.reasons.map((x) => [x.kind, x.expected ?? null])))
  console.log('  resolution', JSON.stringify(upd).slice(0, 900))
  console.log('  changes', JSON.stringify(s.action.changes))
  let portal: string[] | null = null
  try { portal = stepPortalLines(s, portalNamesFor(ctx as never, stepVars(s, ctx as never) as Record<string, unknown>, s.title)) } catch (e) { console.log('  portal error', String(e)) }
  console.log('  portal', JSON.stringify(portal).slice(0, 900))
  try { const j = policyJson(s); console.log('  json', JSON.stringify(j).slice(0, 600)) } catch (e) { console.log('  json error', String(e)) }
  try { const ps = powershellFor(stepOperations(s)); console.log('  ps ids', Object.values(IDS).filter((id) => ps.includes(id)).map(who), 'len', ps.length) } catch (e) { console.log('  ps error', String(e)) }
}
