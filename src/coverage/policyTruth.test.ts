// Policy truth (owner audit Step 3 and its correction). In place means the tenant
// object satisfies what the goal means — the people it is for, the resources, the
// conditions, the exclusions group its own policy carves out, and the control —
// never that it carries a similar control. A policy that is the goal's policy but
// falls short of it is partly in place, never missing. Every case is authored; no
// tenant data. Policies are told apart by id and by what they do, never by name.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeCoverage } from './coverage.ts'
import type { CoverageInput } from './coverage.ts'
import { buildStrengthLookup } from './strength.ts'
import type { GoalResult } from './types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { fixture, noExclusionsAnswer } from '../roadmap/fixtures/index.ts'
import { PREREQ_STEP_ID } from '../roadmap/stepIds.ts'
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

/** Coverage with the plan's identities confirmed and empty: nothing is assumed to be an emergency account, and no exclusions group is checked. */
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

/** The plan's identities with an exclusions group chosen (or none, as null): u7 is the emergency account, grp-x holds it. */
const withExclusionsGroup = (groupId: string | null): Partial<CoverageInput> => ({
  mapping: { breakGlassUsers: ['u7'], exclusionGroups: groupId ? { [groupId]: 'breakGlass/globalExclusion' } : {}, exclusionsGroupId: groupId },
  groupMembers: new Map([['grp-x', { memberIds: ['u7'], memberCount: 1, sampled: false }]]),
})

const goal = (r: ReturnType<typeof computeCoverage>, id: string): GoalResult => {
  const g = r.results.find((x) => x.goal.id === id)
  assert.ok(g, `goal ${id} present`)
  return g
}
const candidateIds = (g: GoalResult): string[] => g.candidates.map((c) => c.policyId)

// ---- population ----

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
  const g = goal(cover([policy('p-everyone', { includeUsers: ['All'] }), policy('p-guests', { includeUsers: ['GuestsOrExternalUsers'] })]), 'guests-mfa')
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

test('guest types: a policy for some guest types is not full coverage, even with no guests; two that reach every type between them are', () => {
  const forTypes = (id: string, types: string) => policy(id, { includeGuestsOrExternalUsers: { guestOrExternalUserTypes: types, externalTenants: { membershipKind: 'all' } } })
  const someTypes = forTypes('p-some', 'b2bCollaborationGuest,otherExternalUser')
  const restTypes = forTypes('p-rest', 'internalGuest,b2bCollaborationMember,b2bDirectConnectUser,serviceProvider')
  for (const n of [0, 2]) {
    const one = goal(cover([someTypes], { snapshot: snapshot(n) }), 'guests-mfa')
    assert.equal(one.status, 'partial', `${n} guests, some types`)
    assert.ok(one.reasons.some((x) => x.kind === 'guest-types-narrower'))
    assert.deepEqual(candidateIds(one), ['p-some'], 'still the goal policy to correct')
    const both = goal(cover([someTypes, restTypes], { snapshot: snapshot(n) }), 'guests-mfa')
    assert.equal(both.status, 'enforced', `${n} guests, both halves`)
    assert.equal(both.satisfaction?.sufficientId, null, 'neither reaches every type alone')
    assert.deepEqual([...(both.satisfaction?.policyIds ?? [])].sort(), ['p-rest', 'p-some'])
  }
  // One partner tenant's guests only reach no guest type everywhere.
  const partner = goal(cover([policy('p-partner', { includeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'b2bCollaborationGuest,otherExternalUser,internalGuest,b2bCollaborationMember,b2bDirectConnectUser,serviceProvider', externalTenants: { membershipKind: 'enumerated', members: ['tenant-a'] } } })], { snapshot: snapshot(0) }), 'guests-mfa')
  assert.equal(partner.status, 'partial')
  // A guest type IAMAI does not read settles nothing.
  const unread = goal(cover([forTypes('p-unread', 'b2bCollaborationGuest,someFutureKind')], { snapshot: snapshot(0) }), 'guests-mfa')
  assert.equal(unread.status, 'unknown')
})

// ---- required exclusions ----

test('the exclusions group the goal requires is part of in place: present keeps it, missing makes it partly, and a policy that excludes the emergency account by name is not the same', () => {
  const present = goal(cover([policy('p-everyone', { includeUsers: ['All'], excludeGroups: ['grp-x'] })], withExclusionsGroup('grp-x')), 'mfa-all-users')
  assert.equal(present.status, 'enforced')
  assert.equal(present.satisfaction?.sufficientId, 'p-everyone')
  assert.ok(present.reasons.some((x) => x.kind === 'excluded' && x.expected === true && x.userIds.includes('u7')), 'the emergency account out through the group is expected')

  const byName = goal(cover([policy('p-everyone', { includeUsers: ['All'], excludeUsers: ['u7'] })], withExclusionsGroup('grp-x')), 'mfa-all-users')
  assert.equal(byName.status, 'partial')
  assert.equal(byName.satisfaction, null)
  assert.deepEqual(byName.candidates.find((c) => c.policyId === 'p-everyone')?.caveats, ['exclusion-missing'])
  assert.ok(byName.reasons.some((x) => x.kind === 'exclusion-missing'))
  assert.ok(byName.gapSentence && byName.gapSentence.length > 0, 'the row states the gap')

  // No usable exclusions group: no policy can carry it yet, and the policy says so.
  const none = goal(cover([policy('p-everyone', { includeUsers: ['All'] })], withExclusionsGroup(null)), 'mfa-all-users')
  assert.equal(none.status, 'partial')
  assert.deepEqual(none.candidates.find((c) => c.policyId === 'p-everyone')?.caveats, ['exclusion-missing', 'exclusion-unresolved'])
})

test('no usable exclusions group: the step is partly in place, held on the exclusions prerequisite, offers no operation, and names no group', () => {
  // The week-two tenant, whose policies carve out the group its technician chose,
  // with that answer taken away: every policy still excludes the group, and none
  // of that is an owner-confirmed exclusions group any more.
  const answered = fixture('demo-week2')
  const f = noExclusionsAnswer(answered)
  const run = runFixture(f, { mapping: f.mapping })
  assert.equal(actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') }), null)
  const mfa = resultOf(run, 'mfa-all-users')
  assert.equal(mfa.verdict, 'partly', 'not In place while the required group is unresolved')
  assert.ok(mfa.candidates.some((c) => c.caveats.includes('exclusion-unresolved')))
  const held = run.steps.filter((s) => s.id.startsWith('s-goal-') && run.coverage.results.some((x) => x.goal.id === s.goalId && x.candidates.some((c) => c.caveats.includes('exclusion-unresolved'))))
  assert.ok(held.length > 0)
  for (const s of held) {
    assert.notEqual(s.status, 'done', `${s.id}: not In place`)
    assert.deepEqual(operationsOf(s), [], `${s.id}: no operation`)
    assert.equal(s.action.json ?? null, null, `${s.id}: no JSON`)
    assert.ok(s.blockedBy.includes(PREREQ_STEP_ID.exclusionsGroup), `${s.id}: held on Create or Correct Exclusions Group`)
    assert.notEqual(s.state.lifecycle, 'ready-to-enforce', `${s.id}: not ready to enforce`)
  }
  // The report-only policy that is ready to enforce with the answer is not ready without it.
  assert.equal(runFixture(answered).steps.find((s) => s.id === 's-goal-token-protection')?.state.lifecycle, 'ready-to-enforce', 'the premise: ready with a confirmed group')
  const token = run.steps.find((s) => s.id === 's-goal-token-protection')
  assert.ok(token && held.includes(token), 'token protection is among the held steps')
  assert.equal(token.state.lifecycle, 'report-only', 'it goes on being watched, and is not ready to turn on')
  // No group the tenant has — the stored one included — reaches any step.
  const text = JSON.stringify(run.steps)
  for (const [id] of f.groups) assert.equal(text.includes(id), false, `group ${id} named in the plan`)
})

test('an exclusion the baseline does not carve out is not required', () => {
  const tenant = [policy('p-everyone', { includeUsers: ['All'] })]
  // The baseline member excludes the author's exclusions group: required.
  const carving = policy('b-everyone', { includeUsers: ['All'], excludeGroups: ['author-x'] })
  const required = goal(cover(tenant, { ...withExclusionsGroup('grp-x'), baselinePolicies: [{ ...carving, placeholders: { 'author-x': 'exclusionsGroup' } }] }), 'mfa-all-users')
  assert.equal(required.status, 'partial')
  // The same member carving out nothing IAMAI reads as the exclusions group: not required.
  const notRequired = goal(cover(tenant, { ...withExclusionsGroup('grp-x'), baselinePolicies: [policy('b-everyone', { includeUsers: ['All'] })] }), 'mfa-all-users')
  assert.equal(notRequired.status, 'enforced')
})

test('an exclusion the plan has not confirmed as emergency access is a gap, never the emergency carve-out', () => {
  const g = goal(cover([policy('p-everyone', { includeUsers: ['All'], excludeUsers: ['u5'] })]), 'mfa-all-users')
  assert.equal(g.status, 'partial')
  const ex = g.reasons.find((x) => x.kind === 'excluded')
  assert.ok(ex && ex.expected === false)
  assert.deepEqual(ex.userIds, ['u5'])
})

// ---- resources and conditions ----

test("an application the reference does not exclude narrows the coverage; the reference's own exclusion does not", () => {
  const excludingApp = (id: string) => policy(id, { includeUsers: ['All'] }, { conditions: { applications: { includeApplications: ['All'], excludeApplications: ['app-x'] } } })
  const narrowed = goal(cover([excludingApp('p-everyone')]), 'mfa-all-users')
  assert.equal(narrowed.status, 'partial')
  assert.ok(narrowed.reasons.some((x) => x.kind === 'apps-excluded'))
  assert.equal(narrowed.satisfaction, null)
  const same = goal(cover([excludingApp('p-everyone')], { baselinePolicies: [excludingApp('b-everyone')] }), 'mfa-all-users')
  assert.equal(same.status, 'enforced')
})

test('one policy that delivers the goal delivers it: a second that falls short does not make it partly', () => {
  const shortA = policy('p-a', { includeUsers: ['All'] }, { conditions: { applications: { includeApplications: ['All'], excludeApplications: ['app-x'] } } })
  const fullB = policy('p-b', { includeUsers: ['All'] })
  const g = goal(cover([shortA, fullB]), 'mfa-all-users')
  assert.equal(g.status, 'enforced')
  assert.equal(g.satisfaction?.sufficientId, 'p-b')
  assert.deepEqual(g.satisfaction?.policyIds, ['p-b'], 'the policy that falls short delivers none of it')
  assert.equal(g.reasons.some((x) => x.kind === 'apps-excluded'), false, 'no correction remains on a delivered goal')
  // Alone, the policy that falls short is the one to correct.
  const alone = goal(cover([shortA]), 'mfa-all-users')
  assert.equal(alone.status, 'partial')
  assert.deepEqual(candidateIds(alone), ['p-a'])
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

test("a narrower condition on the goal's own policy is partly in place, never missing", () => {
  const cases: [string, P, string][] = [
    ['phishing-resistant MFA on Windows only', policy('p-admins', { includeRoles: [GA] }, { grantControls: PR_GRANT, conditions: { platforms: { includePlatforms: ['windows'], excludePlatforms: [] } } }), 'admins-phishing-resistant'],
    ['a legacy block that spares the office network', policy('p-legacy', { includeUsers: ['All'] }, { conditions: { clientAppTypes: ['exchangeActiveSync', 'other'], locations: { includeLocations: ['All'], excludeLocations: ['loc-office'] } }, grantControls: { operator: 'OR', builtInControls: ['block'] } }), 'block-legacy-auth'],
    ['guest MFA that spares compliant devices', policy('p-guests', { includeUsers: ['GuestsOrExternalUsers'] }, { conditions: { devices: { deviceFilter: { mode: 'exclude', rule: 'device.isCompliant -eq True' } } } }), 'guests-mfa'],
    ['MFA only at elevated insider risk, a condition IAMAI does not read', policy('p-everyone', { includeUsers: ['All'] }, { conditions: { insiderRiskLevels: 'elevated' } }), 'mfa-all-users'],
  ]
  for (const [label, p, goalId] of cases) {
    const g = goal(cover([p]), goalId)
    assert.equal(g.status, 'partial', label)
    assert.deepEqual(candidateIds(g), [String(p.id)], `${label}: the policy to correct`)
    assert.ok(g.reasons.some((x) => x.kind === 'conditions-narrower'), `${label}: the condition is the stated gap`)
    assert.equal(g.satisfaction, null)
  }
  // The same policies without the condition are in place.
  assert.equal(goal(cover([policy('p-admins', { includeRoles: [GA] }, { grantControls: PR_GRANT })]), 'admins-phishing-resistant').status, 'enforced')
  assert.equal(goal(cover([policy('p-legacy', { includeUsers: ['All'] }, { conditions: { clientAppTypes: ['exchangeActiveSync', 'other'] }, grantControls: { operator: 'OR', builtInControls: ['block'] } })]), 'block-legacy-auth').status, 'enforced')
  assert.equal(goal(cover([policy('p-guests', { includeUsers: ['GuestsOrExternalUsers'] })]), 'guests-mfa').status, 'enforced')
})

test("a policy whose condition makes it another goal's policy stays out of this goal", () => {
  // MFA on risky sign-ins is the sign-in risk goal's policy, not MFA for everyone.
  const risky = goal(cover([policy('p-risky', { includeUsers: ['All'] }, { conditions: { signInRiskLevels: ['high'] } })]), 'mfa-all-users')
  assert.equal(risky.status, 'absent')
  assert.deepEqual(candidateIds(risky), [])
  // A block on every client app outside allowed countries is not the legacy-authentication block.
  const geo = goal(cover([policy('p-geo', { includeUsers: ['All'] }, { conditions: { locations: { includeLocations: ['All'], excludeLocations: ['loc-1'] } }, grantControls: { operator: 'OR', builtInControls: ['block'] } })]), 'block-legacy-auth')
  assert.equal(geo.status, 'absent')
  assert.deepEqual(candidateIds(geo), [])
})

test("a condition the reference carries is the goal's own: the same rule keeps coverage, another rule does not", () => {
  const filtered = (id: string, rule: string) => policy(id, { includeUsers: ['All'] }, { conditions: { devices: { deviceFilter: { mode: 'exclude', rule } } } })
  const baselinePolicies = [filtered('b-everyone', 'device.trustType -eq "ServerAD"')]
  assert.equal(goal(cover([filtered('p-same', 'device.trustType -eq "ServerAD"')], { baselinePolicies }), 'mfa-all-users').status, 'enforced')
  const other = goal(cover([filtered('p-other', 'device.trustType -eq "Workplace"')], { baselinePolicies }), 'mfa-all-users')
  assert.equal(other.status, 'partial', 'a rule IAMAI does not evaluate is never assumed equal')
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

type Row = { id: string; displayName: string; state: string; conditions: { users?: { includeUsers?: string[]; excludeUsers?: string[]; excludeGroups?: string[] } } }
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
const chosenGroup = (f: Fixture): string => {
  const id = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })
  assert.ok(id !== null, 'the fixture has a chosen exclusions group')
  return id
}

test('audit, demo MFA for everyone: without the exclusions group it is partly in place and the Plan changes that policy; with it, in place', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const r = resultOf(run, 'mfa-all-users')
  assert.equal(r.status, 'partial')
  assert.equal(r.verdict, 'partly')
  assert.equal(r.satisfaction, null)
  const mfa = r.candidates.find((c) => c.contribution === 'strong' && c.ownScope && c.caveats.includes('exclusion-missing'))
  const row = rowsOf(f).find((p) => p.id === mfa?.policyId)
  assert.ok(mfa && row && row.conditions.users?.includeUsers?.includes('All'), 'the all-users policy is the one that falls short')
  assert.deepEqual(mfa.caveats, ['exclusion-missing'], 'and the exclusions group is the only thing it lacks')
  assert.ok(r.reasons.some((x) => x.kind === 'exclusion-missing'))
  // Step 2's own reading of the chosen group names the same policy.
  assert.ok(policiesNotExcludingGroup(rowsOf(f), chosenGroup(f)).includes(row.displayName))
  // The Plan asks for a change to that policy's users, not a new policy.
  const step = goalStep(run, 'mfa-all-users')
  assert.notEqual(step.status, 'done')
  assert.equal(step.kind, 'adjust')
  const update = (step.action.resolution?.policies ?? []).find((o) => o.mode === 'update')
  assert.equal(update?.policyId, mfa.policyId)
  assert.ok((step.action.changes ?? []).some((c) => c.field === 'Users'))

  // The same tenant a week on, its policies carving out the chosen group: in place, by the same policy.
  const w = fixture('demo-week2')
  const week2 = resultOf(runFixture(w), 'mfa-all-users')
  assert.equal(week2.verdict, 'inPlace')
  assert.equal(week2.satisfaction?.sufficientId, mfa.policyId)
  assert.ok(rowsOf(w).find((p) => p.id === mfa.policyId)?.conditions.users?.excludeGroups?.includes(chosenGroup(w)))
})

test('audit, demo legacy authentication: partly in place on day one for the exclusions group alone; in place in week two with the service accounts inside the block', () => {
  const day1 = resultOf(runFixture(fixture('demo')), 'block-legacy-auth')
  assert.equal(day1.status, 'partial')
  assert.deepEqual(day1.reasons.filter((x) => !x.expected).map((x) => x.kind), ['exclusion-missing'])
  const w = fixture('demo-week2')
  const r = resultOf(runFixture(w), 'block-legacy-auth')
  assert.equal(r.verdict, 'inPlace')
  assert.ok(rowsOf(w).some((p) => p.id === r.satisfaction?.sufficientId))
  // The baseline allows the service accounts out; this tenant blocks them too, which is stricter and not a gap.
  assert.ok(w.mapping.serviceAccountUserIds.length > 0)
  for (const id of w.mapping.serviceAccountUserIds) assert.ok(r.enforcedIds.includes(id), id)
})

test('audit, demo guests: the guest policy is named on the coverage, the step, the finding, the row and the history', () => {
  const run = runFixture(fixture('demo-week2'))
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
  const base = fixture('demo-week2')
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
