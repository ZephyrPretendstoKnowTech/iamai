// Policy truth (owner audit Step 3). In place means the tenant object satisfies
// what the goal means — the people it is for, the resources, the conditions and
// the control — never that it carries a similar control. Every case is authored;
// no tenant data. Policies are told apart by id and by what they do, never by name.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeCoverage } from './coverage.ts'
import type { CoverageInput } from './coverage.ts'
import { buildStrengthLookup } from './strength.ts'
import type { GoalResult } from './types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { fixture } from '../roadmap/fixtures/index.ts'
import type { Fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import type { FixtureRun } from '../roadmap/fixtures/run.ts'
import { operationsOf } from '../roadmap/operations.ts'
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../mapping/safetyChoice.ts'
import { policiesNotExcludingGroup } from '../validation/rules.ts'
import { rowReason } from '../ui/surfaces/rowWhen.ts'
import { existingOf } from '../ui/surfaces/stepContract.ts'

const GA = '62e90394-69f5-4237-9190-012177145e10'
const PR_STRENGTH = '00000000-0000-0000-0000-000000000004'
const MFA_STRENGTH = '00000000-0000-0000-0000-000000000002'
const PR_GRANT = { operator: 'OR', builtInControls: [], authenticationStrength: { id: PR_STRENGTH } }

function snapshot(guests = 2): TenantSnapshot {
  const person = (id: string, userType: 'member' | 'guest') => ({
    id,
    displayName: id,
    userPrincipalName: `${id}@x.test`,
    userType,
    usageLocation: null,
    createdDateTime: '2024-01-01T00:00:00Z',
    lastSuccessfulSignIn: '2026-08-20T00:00:00Z',
    accountEnabled: true,
    mail: null,
    assignedPlans: [],
    onPremisesSyncEnabled: null,
    externalUserState: null,
    department: null,
    jobTitle: null,
    officeLocation: null,
  })
  const caps = (enabled: boolean) => ({ enabled, seats: enabled ? 10 : 0, consumed: 0 })
  return {
    schemaVersion: 1,
    tenantId: 't',
    asOf: '2026-08-26T00:00:00Z',
    sources: {} as TenantSnapshot['sources'],
    config: {} as TenantSnapshot['config'],
    registrationDetails: [],
    users: [...Array.from({ length: 8 }, (_, i) => person(`u${i}`, 'member')), ...Array.from({ length: guests }, (_, i) => person(`g${i}`, 'guest'))],
    devices: [],
    spActivity: [],
    authMethods: {},
    appSignInSummary: [],
    signInEvidence: {},
    evidencePolicyResults: [],
    blockedToday: [],
    evidenceUsage: null,
    capabilities: {
      entraP1: caps(true),
      entraP2: caps(true),
      intune: caps(false),
      workloadIdPremium: caps(false),
      globalSecureAccess: caps(false),
      defenderForCloudApps: caps(false),
      purviewInsiderRisk: caps(false),
    },
    microsoftManagedPolicyIds: [],
    // u0 and u1 hold Global Administrator (active).
    roles: { active: { u0: [GA], u1: [GA] }, eligible: {} },
  }
}

type P = Record<string, unknown>

function policy(id: string, users: P, over: { conditions?: P; grantControls?: P | null; sessionControls?: P | null; displayName?: string } = {}): P {
  return {
    id,
    displayName: over.displayName ?? id,
    state: 'enabled',
    conditions: { users, applications: { includeApplications: ['All'], excludeApplications: [] }, clientAppTypes: ['all'], ...over.conditions },
    grantControls: over.grantControls === undefined ? { operator: 'OR', builtInControls: ['mfa'] } : over.grantControls,
    sessionControls: over.sessionControls ?? null,
  }
}

/** Coverage with the plan's identities confirmed and empty: nothing is assumed to be an emergency account. */
function cover(tenantPolicies: P[], over: Partial<CoverageInput> = {}) {
  return computeCoverage({
    snapshot: snapshot(),
    tenantPolicies,
    baselinePolicies: [],
    baselineUnusable: [],
    strengths: buildStrengthLookup([]),
    groupMembers: new Map(),
    mapping: { breakGlassUsers: [], exclusionGroups: {} },
    ...over,
  })
}

const goal = (r: ReturnType<typeof computeCoverage>, id: string): GoalResult => {
  const g = r.results.find((x) => x.goal.id === id)
  assert.ok(g, `goal ${id} present`)
  return g
}
const candidateIds = (g: GoalResult): string[] => g.candidates.map((c) => c.policyId)

// ---- the semantic cases ----

test('correct control, wrong population: MFA for a group of members is not MFA for everyone', () => {
  const g = goal(cover([policy('p-group', { includeGroups: ['grp-sales'] })], { groupMembers: new Map([['grp-sales', { memberIds: ['u2', 'u3'], memberCount: 2, sampled: false }]]) }), 'mfa-all-users')
  assert.equal(g.status, 'partial')
  assert.equal(g.satisfaction, null)
  assert.deepEqual([...g.enforcedIds].sort(), ['u2', 'u3'])
  assert.ok(g.reasons.some((x) => x.kind === 'not-targeted' && x.userIds.length === 8))
})

test('correct control, population excluded outright: no credit, and no policy named or changed for it', () => {
  const g = goal(cover([policy('p-internal', { includeUsers: ['All'], excludeUsers: ['GuestsOrExternalUsers'] })]), 'guests-mfa')
  assert.equal(g.status, 'absent')
  assert.deepEqual(candidateIds(g), [])
  assert.equal(g.satisfaction, null)
  // A policy that excludes the very role it includes reaches no admin.
  const a = goal(cover([policy('p-admins', { includeRoles: [GA], excludeRoles: [GA] }, { grantControls: PR_GRANT })]), 'admins-phishing-resistant')
  assert.equal(a.status, 'absent')
  assert.deepEqual(candidateIds(a), [])
})

test('a guest policy satisfies the guests goal, and it is the policy named for it', () => {
  const g = goal(
    cover([
      policy('p-everyone', { includeUsers: ['All'] }),
      policy('p-guests', { includeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'b2bCollaborationGuest,otherExternalUser', externalTenants: { membershipKind: 'all' } } }),
    ]),
    'guests-mfa',
  )
  assert.equal(g.status, 'enforced')
  // The all-users policy covers every guest too; the guest policy is the goal's own.
  assert.equal(g.satisfaction?.sufficientId, 'p-guests')
})

test('an internal-users policy that excludes guests cannot satisfy the guests goal, with guests or with none', () => {
  const internal = policy('p-internal', { includeUsers: ['All'], excludeUsers: ['GuestsOrExternalUsers'] })
  const guests = policy('p-guests', { includeUsers: ['GuestsOrExternalUsers'] })
  for (const n of [2, 0]) {
    const alone = goal(cover([internal], { snapshot: snapshot(n) }), 'guests-mfa')
    assert.notEqual(alone.verdict, 'inPlace', `${n} guests, the internal policy alone`)
    assert.equal(alone.satisfaction, null)
    const both = goal(cover([internal, guests], { snapshot: snapshot(n) }), 'guests-mfa')
    assert.equal(both.status, 'enforced', `${n} guests, beside a guest policy`)
    assert.deepEqual(both.satisfaction?.policyIds, ['p-guests'])
    assert.equal(both.satisfaction?.sufficientId, 'p-guests')
  }
})

test('an exclusion the plan has not confirmed as emergency access is a gap, never the emergency carve-out', () => {
  const g = goal(cover([policy('p-everyone', { includeUsers: ['All'], excludeUsers: ['u5'] })]), 'mfa-all-users')
  assert.equal(g.status, 'partial')
  const ex = g.reasons.find((x) => x.kind === 'excluded')
  assert.ok(ex && ex.expected === false)
  assert.deepEqual(ex.userIds, ['u5'])
})

test('an emergency exclusion the plan confirmed keeps full coverage, directly or through the exclusions group', () => {
  const direct = goal(cover([policy('p-everyone', { includeUsers: ['All'], excludeUsers: ['u7'] })], { mapping: { breakGlassUsers: ['u7'], exclusionGroups: {} } }), 'mfa-all-users')
  assert.equal(direct.status, 'enforced')
  assert.ok(direct.reasons.some((x) => x.kind === 'excluded' && x.expected === true && x.userIds.includes('u7')))
  const group = goal(
    cover([policy('p-everyone', { includeUsers: ['All'], excludeGroups: ['grp-x'] })], {
      mapping: { breakGlassUsers: ['u7'], exclusionGroups: { 'grp-x': 'globalExclusion' } },
      groupMembers: new Map([['grp-x', { memberIds: ['u7'], memberCount: 1, sampled: false }]]),
    }),
    'mfa-all-users',
  )
  assert.equal(group.status, 'enforced')
  assert.equal(group.satisfaction?.sufficientId, 'p-everyone')
})

test("an application the reference does not exclude narrows the coverage; the reference's own exclusion does not", () => {
  const excludingApp = (id: string) => policy(id, { includeUsers: ['All'] }, { conditions: { applications: { includeApplications: ['All'], excludeApplications: ['app-x'] } } })
  const narrowed = goal(cover([excludingApp('p-everyone')]), 'mfa-all-users')
  assert.equal(narrowed.status, 'partial')
  assert.ok(narrowed.reasons.some((x) => x.kind === 'apps-excluded'))
  assert.equal(narrowed.satisfaction, null)
  const same = goal(cover([excludingApp('p-everyone')], { baselinePolicies: [excludingApp('b-everyone')] }), 'mfa-all-users')
  assert.equal(same.status, 'enforced')
})

test('a policy that differs only in ways that change nothing keeps full coverage', () => {
  const g = goal(
    cover([
      policy('p-plain', { includeUsers: ['All'], excludeUsers: [], includeGroups: [], excludeGroups: [], includeRoles: [], excludeRoles: [] }, {
        displayName: 'CA017 - whatever this tenant calls it',
        conditions: {
          '@odata.type': '#microsoft.graph.conditionalAccessConditionSet',
          platforms: null,
          locations: null,
          devices: { includeDevices: [], excludeDevices: [] },
          signInRiskLevels: [],
          userRiskLevels: [],
          servicePrincipalRiskLevels: [],
          insiderRiskLevels: null,
          authenticationFlows: null,
        },
        // The built-in MFA strength is the same bar as the MFA control.
        grantControls: { operator: 'OR', builtInControls: [], termsOfUse: [], authenticationStrength: { id: MFA_STRENGTH } },
        // A session control is its own goals' business; it takes nothing from the grant.
        sessionControls: { signInFrequency: { isEnabled: true, value: 24, type: 'hours' } },
      }),
    ]),
    'mfa-all-users',
  )
  assert.equal(g.status, 'enforced')
  assert.equal(g.satisfaction?.sufficientId, 'p-plain')
  // A grant that asks for more under AND is still the goal's control.
  assert.equal(goal(cover([policy('p-and', { includeUsers: ['All'] }, { grantControls: { operator: 'AND', builtInControls: ['mfa', 'compliantDevice'] } })]), 'mfa-all-users').status, 'enforced')
})

test("a condition that confines the policy to fewer sign-ins is not the goal's control", () => {
  const cases: [string, P, string][] = [
    ['phishing-resistant MFA on Windows only', policy('p-admins', { includeRoles: [GA] }, { grantControls: PR_GRANT, conditions: { platforms: { includePlatforms: ['windows'], excludePlatforms: [] } } }), 'admins-phishing-resistant'],
    ['a legacy block that spares the office network', policy('p-legacy', { includeUsers: ['All'] }, { conditions: { clientAppTypes: ['exchangeActiveSync', 'other'], locations: { includeLocations: ['All'], excludeLocations: ['loc-office'] } }, grantControls: { operator: 'OR', builtInControls: ['block'] } }), 'block-legacy-auth'],
    ['guest MFA that spares compliant devices', policy('p-guests', { includeUsers: ['GuestsOrExternalUsers'] }, { conditions: { devices: { deviceFilter: { mode: 'exclude', rule: 'device.isCompliant -eq True' } } } }), 'guests-mfa'],
    ['MFA only at elevated insider risk, a condition IAMAI does not read', policy('p-everyone', { includeUsers: ['All'] }, { conditions: { insiderRiskLevels: 'elevated' } }), 'mfa-all-users'],
    ['guest MFA for one partner tenant', policy('p-guests', { includeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'b2bCollaborationGuest', externalTenants: { membershipKind: 'enumerated', members: ['tenant-a'] } } }), 'guests-mfa'],
  ]
  for (const [label, p, goalId] of cases) {
    const g = goal(cover([p]), goalId)
    assert.notEqual(g.verdict, 'inPlace', label)
    assert.deepEqual(candidateIds(g), [], `${label}: not counted, named or changed as this goal's policy`)
  }
  // The same policies without the condition are in place.
  assert.equal(goal(cover([policy('p-admins', { includeRoles: [GA] }, { grantControls: PR_GRANT })]), 'admins-phishing-resistant').status, 'enforced')
  assert.equal(goal(cover([policy('p-legacy', { includeUsers: ['All'] }, { conditions: { clientAppTypes: ['exchangeActiveSync', 'other'] }, grantControls: { operator: 'OR', builtInControls: ['block'] } })]), 'block-legacy-auth').status, 'enforced')
  assert.equal(goal(cover([policy('p-guests', { includeUsers: ['GuestsOrExternalUsers'] })]), 'guests-mfa').status, 'enforced')
})

test("a condition the reference carries is the goal's own: the same rule keeps coverage, another rule does not", () => {
  const filtered = (id: string, rule: string) => policy(id, { includeUsers: ['All'] }, { conditions: { devices: { deviceFilter: { mode: 'exclude', rule } } } })
  const baselinePolicies = [filtered('b-everyone', 'device.trustType -eq "ServerAD"')]
  assert.equal(goal(cover([filtered('p-same', 'device.trustType -eq "ServerAD"')], { baselinePolicies }), 'mfa-all-users').status, 'enforced')
  const other = goal(cover([filtered('p-other', 'device.trustType -eq "Workplace"')], { baselinePolicies }), 'mfa-all-users')
  assert.notEqual(other.verdict, 'inPlace', 'a rule IAMAI does not evaluate is never assumed equal')
})

test('extra controls: a weaker alternative is material, an added session control is not', () => {
  const or = goal(cover([policy('p-or', { includeUsers: ['All'] }, { grantControls: { operator: 'OR', builtInControls: ['mfa', 'compliantDevice'] } })]), 'mfa-all-users')
  assert.equal(or.status, 'partial')
  assert.ok(or.reasons.some((x) => x.kind === 'weaker-control'))
  // Live-shaped: the admins' phishing-resistant policy also sets their session lifetime.
  const r = cover([
    policy('p-admins', { includeRoles: [GA] }, { grantControls: PR_GRANT, sessionControls: { signInFrequency: { isEnabled: true, value: 24, type: 'hours' }, persistentBrowser: { isEnabled: true, mode: 'always' } } }),
  ])
  const pr = goal(r, 'admins-phishing-resistant')
  assert.equal(pr.status, 'enforced')
  assert.equal(pr.satisfaction?.sufficientId, 'p-admins')
  // The session goal reads the same policy and states its own gap on it.
  const session = goal(r, 'admin-session')
  assert.equal(session.status, 'partial')
  assert.deepEqual(candidateIds(session), ['p-admins'])
  assert.ok(session.reasons.some((x) => x.kind === 'session-weaker'))
})

test('what the scan could not read stays unresolved: never In place, never named', () => {
  const g = goal(cover([policy('p-everyone', { includeUsers: ['All'], excludeGroups: ['grp-unread'] })]), 'mfa-all-users')
  assert.equal(g.status, 'unknown')
  assert.equal(g.verdict, 'unknown')
  assert.equal(g.satisfaction, null)
})

test('no title makes a match: a guests name on a members policy earns nothing, a plain name on a guest policy loses nothing', () => {
  const groupMembers = new Map([['grp-staff', { memberIds: ['u2', 'u3'], memberCount: 2, sampled: false }]])
  const misnamed = goal(cover([policy('p-a', { includeGroups: ['grp-staff'] }, { displayName: 'Require MFA for Guests' })], { groupMembers }), 'guests-mfa')
  assert.equal(misnamed.status, 'absent')
  assert.deepEqual(candidateIds(misnamed), [])
  const body = { includeUsers: ['GuestsOrExternalUsers'] }
  const plain = goal(cover([policy('p-b', body, { displayName: 'Printer exceptions' })]), 'guests-mfa')
  const titled = goal(cover([policy('p-b', body, { displayName: 'Require MFA for Guests' })]), 'guests-mfa')
  assert.equal(plain.status, 'enforced')
  assert.equal(plain.satisfaction?.sufficientId, 'p-b')
  assert.deepEqual({ status: titled.status, ids: titled.satisfaction?.policyIds }, { status: plain.status, ids: plain.satisfaction?.policyIds })
})

// ---- the audit cases, through the plan ----

type Row = { id: string; displayName: string; state: string; conditions: { users?: { includeUsers?: string[]; excludeUsers?: string[] } } }
const rowsOf = (f: Fixture): Row[] => (f.snapshot.config.caPolicies?.rows ?? []) as Row[]
const resultOf = (run: FixtureRun, goalId: string): GoalResult => {
  const r = run.coverage.results.find((x) => x.goal.id === goalId)
  assert.ok(r, goalId)
  return r
}
const goalStep = (run: FixtureRun, goalId: string) => {
  const s = run.steps.find((x) => x.goalId === goalId && x.id.startsWith('s-goal-'))
  assert.ok(s, `${goalId} step`)
  return s
}

test('audit, demo MFA for everyone: In place by its all-users policy; the missing exclusions group is Step 2\'s finding on that same policy', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const r = resultOf(run, 'mfa-all-users')
  assert.equal(r.verdict, 'inPlace')
  const by = rowsOf(f).find((p) => p.id === r.satisfaction?.sufficientId)
  assert.ok(by && by.state === 'enabled' && by.conditions.users?.includeUsers?.includes('All'))
  // The only account it leaves out is one the plan confirmed as emergency access.
  const excluded = r.reasons.filter((x) => x.kind === 'excluded')
  assert.ok(excluded.length > 0 && excluded.every((x) => x.expected === true && x.userIds.every((id) => f.mapping.breakGlassUserIds.includes(id))))
  // The exclusions group is not on it, and the one reading of that says so by this policy.
  const groupId = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })
  assert.ok(groupId !== null)
  assert.ok(policiesNotExcludingGroup(rowsOf(f), groupId).includes(by.displayName))
  const step = goalStep(run, 'mfa-all-users')
  assert.equal(step.status, 'done')
  assert.equal(step.satisfiedBy?.sufficient, r.satisfaction?.sufficientName)
})

test('audit, demo legacy authentication: In place by the block, with the confirmed service accounts inside it', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const r = resultOf(run, 'block-legacy-auth')
  assert.equal(r.verdict, 'inPlace')
  assert.ok(rowsOf(f).some((p) => p.id === r.satisfaction?.sufficientId))
  // The baseline allows the service accounts out; this tenant blocks them too, which is stricter and not a gap.
  assert.ok(f.mapping.serviceAccountUserIds.length > 0)
  for (const id of f.mapping.serviceAccountUserIds) assert.ok(r.enforcedIds.includes(id), id)
})

test('audit, demo guests: the guest policy is named on the coverage, the step, the finding, the row and the history', () => {
  const run = runFixture(fixture('demo'))
  const r = resultOf(run, 'guests-mfa')
  assert.equal(r.verdict, 'inPlace')
  const own = r.candidates.find((c) => c.policyId === r.satisfaction?.sufficientId)
  assert.ok(own?.ownScope, 'the named policy is scoped to guests')
  const step = goalStep(run, 'guests-mfa')
  assert.equal(step.status, 'done')
  assert.equal(step.satisfiedBy?.sufficient, own.policyName)
  assert.deepEqual(existingOf(step), { names: [own.policyName], together: false })
  assert.ok(rowReason(step)?.includes(own.policyName))
  for (const other of r.candidates.filter((c) => c.policyId !== own.policyId)) {
    assert.equal(step.history.some((h) => (h.note ?? '').includes(other.policyName)), false, `history names ${other.policyName}`)
  }
})

test('audit, live-shaped guests: with no guests, a policy excluding guests does not put the step In place, and a guest policy does', () => {
  const base = fixture('demo')
  const baseRun = runFixture(base)
  const everyoneId = resultOf(baseRun, 'mfa-all-users').satisfaction?.sufficientId
  const guestId = resultOf(baseRun, 'guests-mfa').satisfaction?.sufficientId
  assert.ok(everyoneId && guestId && everyoneId !== guestId)
  // The same tenant with no guest accounts, whose everyone policy now excludes guests.
  const variant = (keepGuestPolicy: boolean): Fixture => {
    const f = structuredClone(base)
    for (const u of f.snapshot.users) if (u.userType === 'guest') u.userType = 'member'
    const rows = rowsOf(f).filter((p) => keepGuestPolicy || p.id !== guestId)
    const everyone = rows.find((p) => p.id === everyoneId) as Row
    everyone.conditions.users = { ...everyone.conditions.users, excludeUsers: [...(everyone.conditions.users?.excludeUsers ?? []), 'GuestsOrExternalUsers'] }
    ;(f.snapshot.config.caPolicies as { rows: unknown[] }).rows = rows
    return f
  }
  const everyoneName = rowsOf(base).find((p) => p.id === everyoneId)?.displayName as string

  const without = runFixture(variant(false), { startDate: '2026-08-31' })
  const g0 = resultOf(without, 'guests-mfa')
  assert.equal(g0.expectedCount, 0)
  assert.notEqual(g0.verdict, 'inPlace')
  const s0 = goalStep(without, 'guests-mfa')
  assert.notEqual(s0.status, 'done')
  assert.equal(s0.satisfiedBy, undefined)
  assert.equal(existingOf(s0), null)
  assert.equal((rowReason(s0) ?? '').includes(everyoneName), false)
  assert.equal(s0.deliveredBy.some((d) => d.startsWith(everyoneName)), false)
  // Nothing offers to rewrite the internal policy into a guest policy.
  assert.equal(operationsOf(s0).some((o) => o.mode === 'update'), false)

  const withGuestPolicy = runFixture(variant(true), { startDate: '2026-08-31' })
  const g1 = resultOf(withGuestPolicy, 'guests-mfa')
  assert.equal(g1.verdict, 'inPlace')
  assert.deepEqual(g1.satisfaction?.policyIds, [guestId])
  const s1 = goalStep(withGuestPolicy, 'guests-mfa')
  assert.equal(s1.status, 'done')
  assert.equal(s1.satisfiedBy?.sufficient, rowsOf(base).find((p) => p.id === guestId)?.displayName)
})
