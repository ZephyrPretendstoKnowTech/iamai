// S1 C01 probe: overlapping all-users / admin / admin-session policies, renamed and reordered.
// Synthetic only: built on the demo fixture; no tenant data, no network.
import { fixture } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
import { stepOperations } from '../../../src/ui/surfaces/stepJson.ts'
const GA = '62e90394-69f5-4237-9190-012177145e10'
const GOALS = ['mfa-all-users', 'admins-phishing-resistant', 'admin-session', 'guests-mfa']
const IDS = { admin: 'aaaaaaaa-0000-4000-8000-000000000001', internal: 'aaaaaaaa-0000-4000-8000-000000000002', session: 'aaaaaaaa-0000-4000-8000-000000000003' }
function variant(label: string, names: Record<keyof typeof IDS, string>, reverse: boolean) {
  const f = structuredClone(fixture('demo'))
  const rows = (f.snapshot.config.caPolicies!.rows as any[])
  const exGroup = rows.find((p) => p.displayName === 'Core - Block - Legacy authentication').conditions.users.excludeGroups[0]
  const apps = { includeApplications: ['All'], excludeApplications: [] }
  const keep = rows.filter((p) => !/MFA for all users|Admins phishing-resistant/.test(p.displayName))
  const mine = [
    { id: IDS.admin, displayName: names.admin, state: 'enabled', conditions: { users: { includeRoles: [GA], excludeGroups: [exGroup] }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } } },
    { id: IDS.internal, displayName: names.internal, state: 'enabled', conditions: { users: { includeUsers: ['All'], excludeGroups: [exGroup], excludeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'internalGuest,b2bCollaborationGuest,b2bCollaborationMember,b2bDirectConnectUser,otherExternalUser,serviceProvider', externalTenants: { membershipKind: 'all' } } }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } },
    { id: IDS.session, displayName: names.session, state: 'enabled', conditions: { users: { includeRoles: [GA], excludeGroups: [exGroup] }, applications: apps, clientAppTypes: ['all'] }, grantControls: null, sessionControls: { signInFrequency: { isEnabled: true, value: 4, type: 'hours', frequencyInterval: 'timeBased' }, persistentBrowser: { isEnabled: true, mode: 'never' } } },
  ]
  let all = [...mine, ...keep]
  if (reverse) all = all.reverse()
  f.snapshot.config.caPolicies!.rows = all
  if (process.env.COMPLETE === '1') { f.mapping.exclusionsGroupId = exGroup; (f.mapping as any).exclusionsGroupConfirmed = true }
  const r = runFixture(f, { planId: f.planId })
  if (label === 'base order') console.log('mapping.exclusionsGroupId', f.mapping.exclusionsGroupId, 'exGroup', exGroup, 'groups', [...f.groups.keys()].join(','), 'mappingKeys', Object.keys(f.mapping).join(','))
  const who = (id: string | null | undefined) => (Object.entries(IDS).find(([, v]) => v === id)?.[0] ?? (id ? (rows.find((p) => p.id === id)?.displayName ?? id) : null))
  console.log('==', label)
  for (const g of GOALS) {
    const cov = r.coverage.results.find((x) => x.goal.id === g)
    const s = r.steps.find((x) => x.goalId === g)
    const ops = s ? stepOperations(s) : []
    console.log(' ', g.padEnd(26), 'cov', cov?.status, JSON.stringify(cov?.candidates.map((c) => [who(c.policyId), c.contribution, c.ownScope, c.caveats.join('+')])))
    console.log(' ', ''.padEnd(26), 'step', s?.kind, 'ops', JSON.stringify(ops.map((o: any) => [o.mode, who(o.policyId), Object.keys(o.body ?? {}).join('+')])), 'track', JSON.stringify([s?.tracking?.matchedBy, who((s?.tracking as any)?.policyId)]), 'missing', JSON.stringify((s?.action as any)?.missing), 'json', (s?.action as any)?.json ? 'yes' : 'no', 'blockers', JSON.stringify(s?.blockers?.map((b: any) => b.label)))
  }
}
const N = { admin: 'Core - Allow - MFA for Admins', internal: 'Core - Allow - MFA for Internal Users', session: 'Core - Session - Admin sign-in frequency' }
variant('base order', N, false)
variant('reversed order', N, true)
variant('names swapped (admin<->internal), reversed', { admin: N.internal, internal: N.admin, session: 'zz neutral session' }, true)
variant('neutral names', { admin: 'Policy 3', internal: 'Policy 1', session: 'Policy 2' }, false)
