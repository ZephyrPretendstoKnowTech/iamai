// R1 probe: C01 identity with GROUP-assigned policies (a likelier live shape for "MFA for Internal Users"
// and for an admins policy assigned to an admins group), listed and reversed, names neutral.
// Synthetic only: demo fixture, existing fixture groups; no tenant, no network.
// SHAPE=roles (admins by directory role) | groups (admins by group) | mixed (roles + group)
import { fixture } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
import { stepOperations } from '../../../src/ui/surfaces/stepJson.ts'
const GA = '62e90394-69f5-4237-9190-012177145e10'
const GOALS = ['mfa-all-users', 'admins-phishing-resistant', 'admin-session']
const IDS = { admin: 'aaaaaaaa-0000-4000-8000-000000000001', internal: 'aaaaaaaa-0000-4000-8000-000000000002', session: 'aaaaaaaa-0000-4000-8000-000000000003' }
const shape = process.env.SHAPE ?? 'groups'
function variant(label: string, names: Record<keyof typeof IDS, string>, reverse: boolean) {
  const f = structuredClone(fixture('demo'))
  const rows = f.snapshot.config.caPolicies!.rows as any[]
  const exGroup = rows.find((p) => p.displayName === 'Core - Block - Legacy authentication').conditions.users.excludeGroups[0]
  const others = [...f.groups.keys()].filter((g) => g !== exGroup)
  const internalGroup = others[0]
  // The demo carries one group besides the exclusions group; the admins group is synthetic (membership not in the fixture).
  const adminsGroup = others[1] ?? 'bbbbbbbb-0000-4000-8000-00000000000a'
  f.mapping.exclusionsGroupId = exGroup; (f.mapping as any).exclusionsGroupConfirmed = true
  // Give the synthetic admins group a membership read (a copy of the internal group's read, first member only) so coverage is not unknown.
  if (!f.groups.has(adminsGroup) && process.env.READ !== '0') {
    const src = structuredClone(f.groups.get(internalGroup)) as any
    f.groups.set(adminsGroup, { ...src, groupId: adminsGroup, memberIds: (src.memberIds ?? []).slice(0, 1), memberCount: Math.min(1, src.memberCount ?? 1), object: src.object ? { ...src.object, displayName: 'Synthetic admins group' } : src.object })
  }
  const apps = { includeApplications: ['All'], excludeApplications: [] }
  const keep = rows.filter((p) => !/MFA for all users|Admins phishing-resistant/.test(p.displayName))
  const adminUsers = shape === 'roles' ? { includeRoles: [GA] } : shape === 'mixed' ? { includeRoles: [GA], includeGroups: [adminsGroup] } : { includeGroups: [adminsGroup] }
  const mine = [
    { id: IDS.admin, displayName: names.admin, state: 'enabled', conditions: { users: { ...adminUsers, excludeGroups: [exGroup] }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } } },
    { id: IDS.internal, displayName: names.internal, state: 'enabled', conditions: { users: { includeGroups: [internalGroup], excludeGroups: [exGroup] }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } },
    { id: IDS.session, displayName: names.session, state: 'enabled', conditions: { users: { includeRoles: [GA], excludeGroups: [exGroup] }, applications: apps, clientAppTypes: ['all'] }, grantControls: null, sessionControls: { signInFrequency: { isEnabled: true, value: 4, type: 'hours', frequencyInterval: 'timeBased' }, persistentBrowser: { isEnabled: true, mode: 'never' } } },
  ]
  let all = [...mine, ...keep]
  if (reverse) all = all.reverse()
  f.snapshot.config.caPolicies!.rows = all
  const r = runFixture(f, { planId: f.planId })
  const who = (id: string | null | undefined) => (Object.entries(IDS).find(([, v]) => v === id)?.[0] ?? (id ? (rows.find((p) => p.id === id)?.displayName ?? id) : null))
  console.log('==', shape, label, 'groups internal/admins', internalGroup, adminsGroup)
  for (const g of GOALS) {
    const cov = r.coverage.results.find((x) => x.goal.id === g)
    const s = r.steps.find((x) => x.goalId === g)
    const ops = s ? stepOperations(s) : []
    console.log(' ', g.padEnd(26), 'cov', cov?.status, JSON.stringify(cov?.candidates.map((c) => [who(c.policyId), c.contribution, c.ownScope, c.caveats.join('+')])))
    console.log(' ', ''.padEnd(26), 'ops', JSON.stringify(ops.map((o: any) => [o.mode, who(o.policyId), JSON.stringify(o.body ?? {}).slice(0, 160)])), 'track', JSON.stringify([s?.tracking?.matchedBy, who((s?.tracking as any)?.policyId)]), 'resolution', JSON.stringify((s?.action.resolution?.policies ?? []).map((o: any) => [o.mode, who(o.policyId), JSON.stringify(o.policy?.conditions?.users ?? o.changes ?? o.sections ?? null).slice(0, 140)])), 'lifecycle', s?.state?.lifecycle)
  }
}
variant('listed', { admin: 'Policy 3', internal: 'Policy 1', session: 'Policy 2' }, false)
variant('reversed', { admin: 'Policy 3', internal: 'Policy 1', session: 'Policy 2' }, true)
