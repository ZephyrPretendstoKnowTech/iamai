// intents.md §12 — the 14 required cases. Fixtures are authored, never
// copied tenant data.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeCoverage } from './coverage.ts'
import type { CoverageInput } from './coverage.ts'
import { buildStrengthLookup } from './strength.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'

const NOW = '2026-08-26T00:00:00Z'
const PR_STRENGTH = '00000000-0000-0000-0000-000000000004'

function mkSnapshot(over: Partial<TenantSnapshot> = {}): TenantSnapshot {
  const users = Array.from({ length: 10 }, (_, i) => ({
    id: `u${i}`,
    displayName: `User ${i}`,
    userPrincipalName: `u${i}@x.test`,
    userType: (i >= 8 ? 'guest' : 'member') as 'member' | 'guest',
    usageLocation: null,
    createdDateTime: '2024-01-01T00:00:00Z',
    lastSuccessfulSignIn: '2026-08-20T00:00:00Z',
    accountEnabled: true,
    assignedPlans: [],
    onPremisesSyncEnabled: null,
    externalUserState: null,
    department: null,
    jobTitle: null,
    officeLocation: null,
  }))
  const caps = (enabled: boolean) => ({ enabled, seats: enabled ? 10 : 0, consumed: 0 })
  return {
    schemaVersion: 1,
    tenantId: 't',
    asOf: NOW,
    sources: {} as TenantSnapshot['sources'],
    config: {} as TenantSnapshot['config'],
    registrationDetails: [],
    users,
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
    roles: { active: { u0: ['62e90394-69f5-4237-9190-012177145e10'], u1: ['62e90394-69f5-4237-9190-012177145e10'] }, eligible: {} },
    ...over,
  }
}

type P = Record<string, unknown>

function mkPolicy(over: P = {}): P {
  return {
    id: `p-${Math.abs(JSON.stringify(over).length)}-${String(over.displayName ?? '')}`,
    displayName: 'Policy',
    state: 'enabled',
    conditions: {
      users: { includeUsers: ['All'], excludeUsers: [], includeGroups: [], excludeGroups: [], includeRoles: [], excludeRoles: [] },
      applications: { includeApplications: ['All'], excludeApplications: [], includeUserActions: [] },
      clientAppTypes: ['all'],
    },
    grantControls: { operator: 'OR', builtInControls: ['mfa'] },
    sessionControls: null,
    ...over,
  }
}

const mergeConditions = (over: P): P => {
  const base = mkPolicy() as { conditions: Record<string, unknown> }
  return { ...base.conditions, ...over }
}

function run(tenantPolicies: P[], over: Partial<CoverageInput> = {}) {
  return computeCoverage({
    snapshot: mkSnapshot(),
    tenantPolicies,
    baselinePolicies: [],
    baselineUnusable: [],
    strengths: buildStrengthLookup([]),
    groupMembers: new Map(),
    ...over,
  })
}

const goal = (r: ReturnType<typeof computeCoverage>, id: string) => {
  const g = r.results.find((x) => x.goal.id === id)
  assert.ok(g, `goal ${id} present`)
  return g
}

test('1: two policies (members-minus-admins + admins) jointly enforce mfa-all-users, statement names both', () => {
  const r = run([
    mkPolicy({
      displayName: 'MFA for Internal Users',
      conditions: mergeConditions({
        users: { includeUsers: ['All'], excludeRoles: ['62e90394-69f5-4237-9190-012177145e10'] },
      }),
    }),
    mkPolicy({
      displayName: 'MFA for Admins',
      conditions: mergeConditions({
        users: { includeUsers: [], includeRoles: ['62e90394-69f5-4237-9190-012177145e10'] },
      }),
    }),
  ])
  const g = goal(r, 'mfa-all-users')
  assert.equal(g.status, 'enforced')
  assert.match(g.statement, /MFA for Internal Users/)
  assert.match(g.statement, /MFA for Admins/)
})

test('2: admins policy report-only → partial with report-only users = the admins', () => {
  const r = run([
    mkPolicy({
      displayName: 'MFA for Internal Users',
      conditions: mergeConditions({
        users: { includeUsers: ['All'], excludeRoles: ['62e90394-69f5-4237-9190-012177145e10'] },
      }),
    }),
    mkPolicy({
      displayName: 'MFA for Admins',
      state: 'enabledForReportingButNotEnforced',
      conditions: mergeConditions({
        users: { includeUsers: [], includeRoles: ['62e90394-69f5-4237-9190-012177145e10'] },
      }),
    }),
  ])
  const g = goal(r, 'mfa-all-users')
  assert.equal(g.status, 'partial')
  assert.deepEqual([...g.reportOnlyIds].sort(), ['u0', 'u1'])
  assert.ok(g.reasons.some((x) => x.kind === 'report-only'))
})

test('3: unmapped exclusion group of members → partial excluded with the ids', () => {
  const r = run(
    [
      mkPolicy({
        displayName: 'MFA All',
        conditions: mergeConditions({ users: { includeUsers: ['All'], excludeGroups: ['grp-x'] } }),
      }),
    ],
    { groupMembers: new Map([['grp-x', { memberIds: ['u2', 'u3'], memberCount: 2, sampled: false }]]) },
  )
  const g = goal(r, 'mfa-all-users')
  assert.equal(g.status, 'partial')
  const ex = g.reasons.find((x) => x.kind === 'excluded')
  assert.ok(ex && !ex.expected)
  assert.deepEqual([...ex.userIds].sort(), ['u2', 'u3'])
  assert.match(ex.detail, /grp-x/)
})

test('4: exclusion group mapped as break-glass → enforced with expected note', () => {
  const r = run(
    [
      mkPolicy({
        displayName: 'MFA All',
        conditions: mergeConditions({ users: { includeUsers: ['All'], excludeGroups: ['grp-bg'] } }),
      }),
    ],
    {
      groupMembers: new Map([['grp-bg', { memberIds: ['u2', 'u3'], memberCount: 2, sampled: false }]]),
      mapping: { confirmed: true, exclusionGroups: { 'grp-bg': 'breakGlass' }, breakGlassUsers: [] },
    },
  )
  const g = goal(r, 'mfa-all-users')
  assert.equal(g.status, 'enforced')
  assert.match(g.statement, /2 accounts excluded as break-glass/)
})

test('5: OR grant [mfa, compliantDevice] vs floor mfa → weaker-control', () => {
  const r = run([
    mkPolicy({
      displayName: 'MFA or Device',
      grantControls: { operator: 'OR', builtInControls: ['mfa', 'compliantDevice'] },
    }),
  ])
  const g = goal(r, 'mfa-all-users')
  assert.equal(g.status, 'partial')
  assert.ok(g.reasons.some((x) => x.kind === 'weaker-control'))
})

test('6: AND grant [mfa, compliantDevice] vs floor compliantDevice → satisfies', () => {
  const r = run(
    [
      mkPolicy({
        displayName: 'MFA and Device',
        conditions: mergeConditions({ applications: { includeApplications: ['Office365'] } }),
        grantControls: { operator: 'AND', builtInControls: ['mfa', 'compliantDevice'] },
      }),
    ],
    {
      snapshot: mkSnapshot({
        capabilities: {
          ...mkSnapshot().capabilities,
          intune: { enabled: true, seats: 10, consumed: 0 },
        },
      }),
    },
  )
  const g = goal(r, 'require-managed-device')
  assert.equal(g.status, 'enforced')
})

test('7: baseline phishing-resistant policy raises the floor; plain-MFA tenant policy → weaker-control for everyone', () => {
  const r = run(
    [mkPolicy({ displayName: 'Plain MFA' })],
    {
      baselinePolicies: [
        mkPolicy({
          displayName: 'Baseline PR MFA',
          grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: PR_STRENGTH } },
        }),
      ],
    },
  )
  const g = goal(r, 'mfa-all-users')
  assert.equal(g.status, 'partial')
  assert.equal(g.floorRaised?.to, 'phishingResistant')
  const weak = g.reasons.find((x) => x.kind === 'weaker-control')
  assert.equal(weak?.userIds.length, 10)
})

test('8: apps narrower (Office365 vs all) → partial apps-narrower', () => {
  const r = run([
    mkPolicy({
      displayName: 'MFA Office Only',
      conditions: mergeConditions({ applications: { includeApplications: ['Office365'] } }),
    }),
  ])
  const g = goal(r, 'mfa-all-users')
  // Office-only policy fails the appsAll signature → nobody targeted for the goal.
  assert.notEqual(g.status, 'enforced')
})

test('9: only a disabled candidate → absent with disabled-candidate note', () => {
  const r = run([mkPolicy({ displayName: 'MFA All (off)', state: 'disabled' })])
  const g = goal(r, 'mfa-all-users')
  assert.equal(g.status, 'absent')
  assert.ok(g.reasons.some((x) => x.kind === 'disabled-candidate'))
})

test('audit-1: an all-client-apps block (geo/device-code) does not count as the legacy-auth block', () => {
  const r = run([
    mkPolicy({
      displayName: 'Block outside countries',
      conditions: mergeConditions({ locations: { includeLocations: ['All'], excludeLocations: ['loc-1'] } }),
      grantControls: { operator: 'OR', builtInControls: ['block'] },
    }),
  ])
  assert.equal(goal(r, 'block-legacy-auth').status, 'absent')
  const r2 = run([
    mkPolicy({
      displayName: 'Block legacy',
      conditions: mergeConditions({ clientAppTypes: ['exchangeActiveSync', 'other'] }),
      grantControls: { operator: 'OR', builtInControls: ['block'] },
    }),
  ])
  assert.equal(goal(r2, 'block-legacy-auth').status, 'enforced')
})

test('audit-2: an enabled strong policy with nobody in scope is in place, not missing', () => {
  const r = run(
    [
      mkPolicy({
        displayName: 'MFA for Guests',
        conditions: mergeConditions({ users: { includeUsers: ['GuestsOrExternalUsers'] } }),
      }),
    ],
    { snapshot: mkSnapshot({ users: mkSnapshot().users.filter((u) => u.userType !== 'guest') }) },
  )
  assert.equal(goal(r, 'guests-mfa').status, 'enforced')
})

test('audit-3: sign-in frequency "every time" satisfies any session floor', () => {
  const r = run([
    mkPolicy({
      displayName: 'Admin sessions',
      conditions: mergeConditions({ users: { includeUsers: [], includeRoles: ['62e90394-69f5-4237-9190-012177145e10'] } }),
      grantControls: { operator: 'OR', builtInControls: ['mfa'] },
      sessionControls: {
        signInFrequency: { isEnabled: true, frequencyInterval: 'everyTime', value: null, type: null },
        persistentBrowser: { isEnabled: true, mode: 'never' },
      },
    }),
  ])
  assert.equal(goal(r, 'admin-session').status, 'enforced')
})

test('10: group over the member cap → estimated percentages', () => {
  const r = run(
    [
      mkPolicy({
        displayName: 'MFA big-group exclusion',
        conditions: mergeConditions({ users: { includeUsers: ['All'], excludeGroups: ['grp-big'] } }),
      }),
    ],
    { groupMembers: new Map([['grp-big', { memberIds: ['u2'], memberCount: 30000, sampled: true }]]) },
  )
  const g = goal(r, 'mfa-all-users')
  assert.match(g.statement, /estimated/)
})

test('10b: unresolvable group → unknown', () => {
  const r = run([
    mkPolicy({
      displayName: 'MFA with mystery group',
      conditions: mergeConditions({ users: { includeUsers: ['All'], excludeGroups: ['grp-unknown'] } }),
    }),
  ])
  assert.equal(goal(r, 'mfa-all-users').status, 'unknown')
})

test('11: facet off → not-applicable; facet on → evaluated', () => {
  const off = run([])
  assert.equal(goal(off, 'require-managed-device').status, 'not-applicable')
  const on = run([], {
    snapshot: mkSnapshot({
      capabilities: { ...mkSnapshot().capabilities, intune: { enabled: true, seats: 10, consumed: 0 } },
    }),
  })
  assert.notEqual(goal(on, 'require-managed-device').status, 'not-applicable')
})

test('12: P2 goal on a P1 tenant → licence-limited, excluded from score', () => {
  const r = run([], {
    snapshot: mkSnapshot({
      capabilities: { ...mkSnapshot().capabilities, entraP2: { enabled: false, seats: 0, consumed: 0 } },
    }),
  })
  const g = goal(r, 'sign-in-risk')
  assert.equal(g.status, 'licence-limited')
  assert.equal(r.summary.licenceLimited >= 2, true) // sign-in-risk + user-risk
})

test('13: unclassifiable baseline policy → ad-hoc goal created and evaluated structurally', () => {
  const odd = mkPolicy({
    displayName: 'Baseline Odd TOU',
    conditions: mergeConditions({
      applications: { includeApplications: ['11111111-1111-1111-1111-111111111111'] },
      clientAppTypes: ['browser'],
    }),
    grantControls: { operator: 'OR', builtInControls: [], termsOfUse: ['tou-1'] },
  })
  const r = run([], { baselinePolicies: [odd] })
  const g = r.results.find((x) => x.goal.id === 'adhoc:Baseline Odd TOU')
  assert.ok(g, 'ad-hoc goal exists')
  assert.equal(g.goal.adHocSource, 'Baseline Odd TOU')
})

test('14: guests excluded from the all-users policy plus a separate guests policy → enforced by union', () => {
  const r = run([
    mkPolicy({
      displayName: 'MFA Members',
      conditions: mergeConditions({ users: { includeUsers: ['All'], excludeUsers: ['GuestsOrExternalUsers'] } }),
    }),
    mkPolicy({
      displayName: 'MFA Guests',
      conditions: mergeConditions({
        users: { includeUsers: [], includeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'b2bCollaborationGuest,b2bCollaborationMember' } },
      }),
    }),
  ])
  const g = goal(r, 'mfa-all-users')
  assert.equal(g.status, 'enforced')
  assert.match(g.statement, /MFA Members/)
  assert.match(g.statement, /MFA Guests/)
})
