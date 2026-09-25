// intents.md §12 — the required cases. Fixtures are authored, never
// copied tenant data.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CATALOGUE, computeCoverage } from './coverage.ts'
import type { CoverageInput } from './coverage.ts'
import { buildStrengthLookup } from './strength.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'

const NOW = '2026-08-26T00:00:00Z'
const PR_STRENGTH = '00000000-0000-0000-0000-000000000004'
const GA = '62e90394-69f5-4237-9190-012177145e10'

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
    mail: null,
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
      pim: caps(true),
      intune: caps(false),
      workloadIdPremium: caps(false),
      globalSecureAccess: caps(false),
      defenderForCloudApps: caps(false),
      purviewInsiderRisk: caps(false),
    },
    microsoftManagedPolicyIds: [],
    // u0 and u1 hold Global Administrator (active).
    roles: { active: { u0: [GA], u1: [GA] }, eligible: {} },
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

const withIntune = () => mkSnapshot({ capabilities: { ...mkSnapshot().capabilities, intune: { enabled: true, seats: 10, consumed: 0 } } })
const internalUsers = (state = 'enabled') => mkPolicy({ displayName: 'MFA for Internal Users', state, conditions: mergeConditions({ users: { includeUsers: ['All'], excludeRoles: [GA] } }) })
const adminsPolicy = (state = 'enabled') => mkPolicy({ displayName: 'MFA for Admins', state, conditions: mergeConditions({ users: { includeUsers: [], includeRoles: [GA] } }) })

test('policies that jointly reach everyone enforce the goal, and the statement names each of them', () => {
  // 1: members-minus-admins plus admins.
  const joint = goal(run([internalUsers(), adminsPolicy()]), 'mfa-all-users')
  assert.equal(joint.status, 'enforced')
  assert.match(joint.statement, /MFA for Internal Users/)
  assert.match(joint.statement, /MFA for Admins/)
  // 14: guests excluded from the all-users policy plus a separate guests policy.
  const union = goal(run([
    mkPolicy({ displayName: 'MFA Members', conditions: mergeConditions({ users: { includeUsers: ['All'], excludeUsers: ['GuestsOrExternalUsers'] } }) }),
    mkPolicy({ displayName: 'MFA Guests', conditions: mergeConditions({ users: { includeUsers: ['GuestsOrExternalUsers'] } }) }),
  ]), 'mfa-all-users')
  assert.equal(union.status, 'enforced')
  assert.match(union.statement, /MFA Members/)
  assert.match(union.statement, /MFA Guests/)
})

test('a policy that falls short is partial with its reason, and a disabled one is absent', () => {
  // 2: the admins' half in report-only: report-only users are the admins.
  const ro = goal(run([internalUsers(), adminsPolicy('enabledForReportingButNotEnforced')]), 'mfa-all-users')
  assert.equal(ro.status, 'partial')
  assert.deepEqual([...ro.reportOnlyIds].sort(), ['u0', 'u1'])
  assert.ok(ro.reasons.some((x) => x.kind === 'report-only'))
  // 3: an exclusion group nobody mapped: partial, excluded, with the ids.
  const ex = goal(
    run([mkPolicy({ displayName: 'MFA All', conditions: mergeConditions({ users: { includeUsers: ['All'], excludeGroups: ['grp-x'] } }) })], { groupMembers: new Map([['grp-x', { memberIds: ['u2', 'u3'], memberCount: 2, sampled: false }]]) }),
    'mfa-all-users',
  )
  assert.equal(ex.status, 'partial')
  const reason = ex.reasons.find((x) => x.kind === 'excluded')
  assert.ok(reason && !reason.expected)
  assert.deepEqual([...reason.userIds].sort(), ['u2', 'u3'])
  assert.match(reason.detail, /grp-x/)
  // 5: OR [mfa, compliantDevice] against an MFA floor is a weaker control.
  const or = goal(run([mkPolicy({ displayName: 'MFA or Device', grantControls: { operator: 'OR', builtInControls: ['mfa', 'compliantDevice'] } })]), 'mfa-all-users')
  assert.equal(or.status, 'partial')
  assert.ok(or.reasons.some((x) => x.kind === 'weaker-control'))
  // 8: Office 365 only is not all applications.
  assert.notEqual(goal(run([mkPolicy({ displayName: 'MFA Office Only', conditions: mergeConditions({ applications: { includeApplications: ['Office365'] } }) })]), 'mfa-all-users').status, 'enforced')
  // 9: only a disabled candidate.
  const off = goal(run([mkPolicy({ displayName: 'MFA All (off)', state: 'disabled' })]), 'mfa-all-users')
  assert.equal(off.status, 'absent')
  assert.ok(off.reasons.some((x) => x.kind === 'disabled-candidate'))
})

test('4: an exclusion group mapped as break-glass is expected, and the goal stays enforced', () => {
  const r = run(
    [mkPolicy({ displayName: 'MFA All', conditions: mergeConditions({ users: { includeUsers: ['All'], excludeGroups: ['grp-bg'] } }) })],
    {
      groupMembers: new Map([['grp-bg', { memberIds: ['u2', 'u3'], memberCount: 2, sampled: false }]]),
      mapping: { exclusionGroups: { 'grp-bg': 'breakGlass' }, breakGlassUsers: [] },
    },
  )
  const g = goal(r, 'mfa-all-users')
  assert.equal(g.status, 'enforced')
  assert.match(g.statement, /2 break-glass accounts excluded/)
})

test('controls against the floor: AND satisfies, a raised baseline floor is below-baseline, every-time sign-in frequency satisfies any session floor', () => {
  // 6: AND [mfa, compliantDevice] satisfies a compliant-device floor.
  const and = run(
    [mkPolicy({ displayName: 'MFA and Device', conditions: mergeConditions({ applications: { includeApplications: ['All'] } }), grantControls: { operator: 'AND', builtInControls: ['mfa', 'compliantDevice'] } })],
    { snapshot: withIntune() },
  )
  assert.equal(goal(and, 'require-managed-device').status, 'enforced')
  // 7: a phishing-resistant baseline policy raises the floor; plain MFA is met at the catalogue floor only.
  const raised = goal(
    run([mkPolicy({ displayName: 'Plain MFA' })], { baselinePolicies: [mkPolicy({ displayName: 'Baseline PR MFA', grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: PR_STRENGTH } } })] }),
    'mfa-all-users',
  )
  assert.equal(raised.status, 'below-baseline')
  assert.match(raised.statement, /is met: .* requires .*\. Below the baseline: it expects /)
  assert.equal(raised.floorRaised?.to, 'phishingResistant')
  assert.equal(raised.reasons.find((x) => x.kind === 'weaker-control')?.userIds.length, 10)
  // audit-3: sign-in frequency every time.
  const session = run([
    mkPolicy({
      displayName: 'Admin sessions',
      conditions: mergeConditions({ users: { includeUsers: [], includeRoles: [GA] } }),
      sessionControls: { signInFrequency: { isEnabled: true, frequencyInterval: 'everyTime', value: null, type: null }, persistentBrowser: { isEnabled: true, mode: 'never' } },
    }),
  ])
  assert.equal(goal(session, 'admin-session').status, 'enforced')
})

test('audit: an all-client-apps block is not the legacy block; a strong policy with nobody in scope is in place', () => {
  const block = (displayName: string, conditions: P) => mkPolicy({ displayName, conditions: mergeConditions(conditions), grantControls: { operator: 'OR', builtInControls: ['block'] } })
  assert.equal(goal(run([block('Block outside countries', { locations: { includeLocations: ['All'], excludeLocations: ['loc-1'] } })]), 'block-legacy-auth').status, 'absent')
  assert.equal(goal(run([block('Block legacy', { clientAppTypes: ['exchangeActiveSync', 'other'] })]), 'block-legacy-auth').status, 'enforced')
  // At the grant the baseline asks of every guest type (phishing-resistant MFA meets Jon's Modern MFA + TAP).
  const guestsOnly = run(
    [mkPolicy({ displayName: 'MFA for Guests', conditions: mergeConditions({ users: { includeUsers: ['GuestsOrExternalUsers'] } }), grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } } })],
    { snapshot: mkSnapshot({ users: mkSnapshot().users.filter((u) => u.userType !== 'guest') }) },
  )
  assert.equal(goal(guestsOnly, 'guests-mfa').status, 'enforced')
})

test('10: a group over the member cap gives estimated percentages', () => {
  const r = run(
    [mkPolicy({ displayName: 'MFA big-group exclusion', conditions: mergeConditions({ users: { includeUsers: ['All'], excludeGroups: ['grp-big'] } }) })],
    { groupMembers: new Map([['grp-big', { memberIds: ['u2'], memberCount: 30000, sampled: true }]]) },
  )
  assert.match(goal(r, 'mfa-all-users').statement, /estimated/)
})

test('11/12: a facet off is not applicable, a tier the tenant lacks is licence-limited, and PIM is licensed by P2 or Governance (R4-37)', () => {
  assert.equal(goal(run([]), 'require-managed-device').status, 'not-applicable')
  assert.notEqual(goal(run([], { snapshot: withIntune() }), 'require-managed-device').status, 'not-applicable')
  const none = { enabled: false, seats: 0, consumed: 0 }
  // A P1 tenant holds neither P2 nor a PIM licence.
  const p1 = run([], { snapshot: mkSnapshot({ capabilities: { ...mkSnapshot().capabilities, entraP2: none, pim: none } }) })
  assert.equal(goal(p1, 'sign-in-risk').status, 'licence-limited')
  assert.equal(p1.summary.licenceLimited >= 2, true)
  assert.equal(goal(p1, 'pim-activation-reauth').status, 'licence-limited')
  assert.match(goal(p1, 'pim-activation-reauth').statement, /Entra ID P2 or Microsoft Entra ID Governance/)
  // Governance licenses PIM on a P1 tenant; ID Protection still needs P2.
  const governance = run([], { snapshot: mkSnapshot({ capabilities: { ...mkSnapshot().capabilities, entraP2: none, pim: { enabled: true, seats: 10, consumed: 4 } } }) })
  assert.notEqual(goal(governance, 'pim-activation-reauth').status, 'licence-limited')
  assert.equal(goal(governance, 'sign-in-risk').status, 'licence-limited')
})

test('13: unclassifiable baseline policy → not assessed, never a goal (prompt 46 item 14)', () => {
  const odd = mkPolicy({
    displayName: 'Baseline Odd TOU',
    conditions: mergeConditions({ applications: { includeApplications: ['11111111-1111-1111-1111-111111111111'] }, clientAppTypes: ['browser'] }),
    grantControls: { operator: 'OR', builtInControls: [], termsOfUse: ['tou-1'] },
  })
  const r = run([], { baselinePolicies: [odd], baselineUnusable: [{ policyName: 'Baseline Broken', warning: 'the file is not a policy' }] })
  assert.equal(r.results.some((x) => x.goal.id.startsWith('adhoc:') || /Odd TOU/.test(x.goal.name) || /^Restrict access to/.test(x.goal.name)), false)
  const odds = r.organisation.notAssessed.find((n) => n.name === 'Baseline Odd TOU')
  assert.ok(odds, 'listed as not assessed')
  assert.ok(odds.json && odds.json.includes('"termsOfUse"'), 'carries the baseline JSON')
  const broken = r.organisation.notAssessed.find((n) => n.name === 'Baseline Broken')
  assert.ok(broken)
  assert.equal(broken.reason, 'the file is not a policy')
  assert.equal(broken.json, null)
})

test('a goal\'s own template, switched on where the baseline holds no policy for the goal, never reads as covering fewer applications', () => {
  // Nadia D7 / R4-10: a policy exactly as the step builds it must be able to
  // finish the step. Where no baseline policy stands for the goal, its template
  // is the reference. The pinned half is baselineFidelity.test.ts.
  const on = { enabled: true, seats: 10, consumed: 0 }
  const snapshot = mkSnapshot({ capabilities: { entraP1: on, entraP2: on, intune: on, workloadIdPremium: on, globalSecureAccess: on, defenderForCloudApps: on, purviewInsiderRisk: on, pim: on } })
  const judged: string[] = []
  const narrower: string[] = []
  for (const g of CATALOGUE) {
    const impl = g.implementations[0]
    if (impl?.kind !== 'ca') continue
    const tenant = { ...structuredClone(impl.template), id: `tenant-${g.id}`, state: 'enabled' }
    const own = goal(run([tenant], { snapshot, goalMap: {} }), g.id).candidates.find((c) => c.policyId === tenant.id)
    if (!own) continue
    judged.push(g.id)
    if (own.caveats.includes('apps-narrower')) narrower.push(g.id)
  }
  assert.ok(judged.includes('token-protection') && judged.includes('require-managed-device'), `the goals the defect was found on were not judged: ${judged.join(', ')}`)
  assert.deepEqual(narrower, [], 'a policy exactly as the goal\'s own template writes it reads as covering fewer applications than the goal')
})
