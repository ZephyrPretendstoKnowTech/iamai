// One test per rule, pass and fail and unknown; a worst-state fixture per
// subject; and the registry regression test that makes dropping a rule fail the
// build (validation-rules.md §6).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { REGISTRY, citationFor, evaluateSubject, ruleText } from './rules.ts'
import type { GroupFacts, NeedKey, RuleResult, RuleSubject, ValidationContext } from './rules.ts'
import { buildContext, breakGlassReport } from './report.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { FIELD_PRACTICE, RULE_TEXT } from '../copy/validation.ts'
import { canDenyAccess } from '../roadmap/strand.ts'
import { blockerStepId } from '../roadmap/blockerSteps.ts'

// ---- the regression test (design §6) ---------------------------------------

/**
 * The full set, by subject. A refactor that drops a rule fails here, which is
 * the point of the registry: the break-glass set was incomplete twice.
 */
const EXPECTED: Record<RuleSubject, string[]> = {
  breakGlass: [
    'bg.count',
    'bg.role.permanentGa',
    'bg.cloudOnly',
    'bg.initialDomain',
    'bg.enabled',
    'bg.excludedFromAllPolicies',
    'bg.notInDynamicScope',
    'bg.hasMfaMethod',
    'bg.separateDevices',
    'bg.notPersonal',
    'bg.excludedFromReportOnly',
    'bg.microsoftManaged',
    'bg.phishingResistant',
    'bg.methodDiversity',
    'bg.perUserMfaOff',
    'bg.noLicenceNeeded',
    'bg.drilled',
    'bg.credentialStorage',
    'bg.signInMonitoring',
    'bg.nameIdentifiesPurpose',
    'bg.lastSignIn',
    'bg.signInCountries',
    'bg.mfaSeen',
  ],
  exclusionGroup: ['xg.membersApproved', 'xg.noExtraAdmins', 'xg.notDynamic', 'xg.usedConsistently', 'xg.sizeReasonable', 'xg.notMailEnabled'],
  trustedLocation: ['loc.notWholeInternet', 'loc.notTooWide', 'loc.isTrusted', 'loc.redundancy', 'loc.seenInSignIns'],
  allowedCountries: ['cty.atLeastOne', 'cty.includesOperator', 'cty.unknownCountries', 'cty.seenCountriesIncluded'],
  pilotGroup: ['pilot.hasMembers', 'pilot.noBreakGlass', 'pilot.spread', 'pilot.hasAdmin', 'pilot.membersReady', 'pilot.passkeyEnabled', 'pilot.tapEnabled'],
  serviceAccount: ['svc.noInteractive', 'svc.noAdminRole', 'svc.excludedFromBlocks'],
  authStrength: ['str.exists', 'str.achievable', 'str.matchesBaseline'],
}

/** Severity per rule, asserted so a blocker cannot be quietly downgraded. */
const BLOCKERS = new Set([
  'bg.count', 'bg.role.permanentGa', 'bg.cloudOnly', 'bg.initialDomain', 'bg.enabled', 'bg.excludedFromAllPolicies',
  'bg.notInDynamicScope', 'bg.hasMfaMethod', 'bg.separateDevices', 'bg.notPersonal',
  'xg.membersApproved', 'xg.noExtraAdmins', 'xg.notDynamic', 'xg.usedConsistently',
  'loc.notWholeInternet', 'loc.notTooWide', 'loc.isTrusted',
  'cty.atLeastOne', 'cty.includesOperator',
  'pilot.hasMembers', 'pilot.noBreakGlass',
  'str.exists', 'str.achievable',
])

test('the registry holds exactly the rule set the design lists, by subject', () => {
  for (const [subject, ids] of Object.entries(EXPECTED)) {
    const actual = REGISTRY.filter((r) => r.subject === subject).map((r) => r.id)
    assert.deepEqual(actual, ids, `${subject}: the rule set changed`)
  }
  assert.equal(REGISTRY.length, Object.values(EXPECTED).flat().length, 'no rule outside a known subject')
  assert.equal(new Set(REGISTRY.map((r) => r.id)).size, REGISTRY.length, 'rule ids are unique')
})

test('severity is fixed: a blocker cannot be quietly downgraded', () => {
  for (const rule of REGISTRY) {
    const expected = BLOCKERS.has(rule.id) ? 'blocker' : rule.severity
    if (BLOCKERS.has(rule.id)) assert.equal(rule.severity, expected, `${rule.id} must stay a blocker`)
    else assert.notEqual(rule.severity, 'blocker', `${rule.id} became a blocker without the design saying so`)
  }
})

test('every rule carries a source, or says plainly that it is field practice', () => {
  // audit-program §6, adjusted by guidance-audit-01: a citation, or an explicit
  // field-practice label. A rule with neither is a rule nobody has verified.
  const missing: string[] = []
  for (const rule of REGISTRY) {
    const c = citationFor(rule.id)
    if (c === undefined) missing.push(rule.id)
    else if (c !== FIELD_PRACTICE) {
      assert.match(c.url, /^https:\/\/learn\.microsoft\.com\//, `${rule.id}: the source is a Microsoft Learn page`)
      assert.ok(c.label.length > 8, `${rule.id}: the link has a name a person can read`)
    }
  }
  assert.deepEqual(missing, [], 'rules with no source')
})

test('every rule says what it checks and why it matters, for the reference page', () => {
  for (const rule of REGISTRY) {
    const text = ruleText(rule.id)
    assert.ok(RULE_TEXT[rule.id], `${rule.id}: no copy`)
    assert.ok(text.what.length > 10 && text.what.endsWith('.'), `${rule.id}: what it checks`)
    assert.ok(text.why.length > 20, `${rule.id}: why it matters`)
  }
})

// ---- the harness -----------------------------------------------------------

type Base = { snapshot: TenantSnapshot; state: MappingState; groups: GroupFacts[]; viability: MfaViability[] }

function base(): Base {
  const f = fixture('small')
  return {
    snapshot: structuredClone(f.snapshot),
    state: structuredClone(f.mapping),
    groups: [...f.groups.entries()].map(([groupId, g]) => structuredClone({ groupId, ...g })),
    viability: [],
  }
}

function ctxOf(b: Base): ValidationContext {
  return buildContext({ snapshot: b.snapshot, state: b.state, groupMembers: b.groups, viability: b.viability })
}

function run(ruleId: string, target: unknown, b: Base): RuleResult {
  const rule = REGISTRY.find((r) => r.id === ruleId)
  assert.ok(rule, `${ruleId} is in the registry`)
  const hit = evaluateSubject(rule.subject, target, ctxOf(b)).find((r) => r.id === ruleId)
  assert.ok(hit, `${ruleId} produced a result`)
  return hit
}

/** Remove the data a rule declares it needs, so the rule reports unknown. */
function stripNeed(b: Base, need: NeedKey): void {
  const off = { status: 'disabled' as const, reason: 'access denied (403)', rows: [] }
  const src = { status: 'disabled' as const, coveredWindow: null, reason: 'access denied (403)', asOf: b.snapshot.asOf }
  if (need === 'users') {
    b.snapshot.users = []
    b.snapshot.sources.users = src
  } else if (need === 'roles') b.snapshot.config.roleAssignments = off
  else if (need === 'authMethods') b.snapshot.sources.authMethods = src
  else if (need === 'caPolicies') b.snapshot.config.caPolicies = off
  else if (need === 'organization') b.snapshot.config.organization = off
  else if (need === 'authMethodsPolicy') b.snapshot.config.authMethodsPolicy = off
  else if (need === 'namedLocations') b.snapshot.config.namedLocations = off
  else if (need === 'authStrengths') b.snapshot.config.authStrengths = off
  else if (need === 'signInEvidence') b.snapshot.sources.signInEvidence = src
  else if (need === 'devices') b.snapshot.sources.devices = src
}

const bgId = (b: Base): string => b.state.breakGlassUserIds[0]
const userAt = (b: Base, id: string) => b.snapshot.users.find((u) => u.id === id)!
const exclusionGroup = (b: Base): GroupFacts => b.groups.find((g) => g.displayName === 'Core - Exclusions')!
const goodLocation = () => ({ id: 'loc-1', displayName: 'Head office', isTrusted: true, ipRanges: [{ cidrAddress: '203.0.113.0/24' }, { cidrAddress: '198.51.100.0/24' }] })
const goodStrength = () => ({ tenant: { id: 's-1', allowedCombinations: ['password,sms'] }, baselineCombinations: ['password,sms'], population: [] as string[] })

type Case = {
  /** The thing the rule looks at, in its healthy state. */
  target: (b: Base) => unknown
  /** Make the rule fail; return a new target when the target itself changes. */
  fail: (b: Base) => unknown | void
  /** How the rule reaches unknown: by stripping a need (default), by a null target, by an unanswered question, or never. */
  unknown?: 'needs' | 'target' | 'answers' | 'never'
  /** Setup a healthy pass when the fixture is not already one. */
  pass?: (b: Base) => unknown | void
  /** The rule has no failure mode it can prove; it passes or reports unknown. */
  neverFails?: true
}

const CASES: Record<string, Case> = {
  // ---- break-glass ----
  'bg.count': { target: bgId, fail: (b) => { b.state.breakGlassUserIds = [b.state.breakGlassUserIds[0]] }, unknown: 'never' },
  'bg.role.permanentGa': {
    target: bgId,
    fail: (b) => {
      const id = bgId(b)
      b.snapshot.roles.eligible[id] = b.snapshot.roles.active[id]
      b.snapshot.roles.active[id] = []
    },
  },
  'bg.cloudOnly': { target: bgId, fail: (b) => { userAt(b, bgId(b)).onPremisesSyncEnabled = true } },
  'bg.initialDomain': { target: bgId, fail: (b) => { userAt(b, bgId(b)).userPrincipalName = 'bg1@small.example.com' } },
  'bg.enabled': { target: bgId, fail: (b) => { userAt(b, bgId(b)).accountEnabled = false } },
  'bg.excludedFromAllPolicies': {
    target: bgId,
    fail: (b) => {
      b.snapshot.config.caPolicies.rows.push({ id: 'p-new', displayName: 'Require MFA for all', state: 'enabled', conditions: { users: { includeUsers: ['All'] } } })
    },
  },
  'bg.notInDynamicScope': {
    target: bgId,
    unknown: 'never',
    fail: (b) => {
      b.groups.push({ groupId: 'g-dyn', displayName: 'All staff', membershipRule: 'user.accountEnabled -eq true', memberIds: [bgId(b)], memberCount: 1, sampled: false })
    },
  },
  'bg.hasMfaMethod': { target: bgId, fail: (b) => { b.snapshot.authMethods[bgId(b)] = [] } },
  'bg.separateDevices': {
    target: bgId,
    fail: (b) => {
      b.snapshot.authMethods[bgId(b)] = [{ kind: 'microsoftAuthenticator', displayName: 'Pixel 8' }]
      b.snapshot.authMethods[b.snapshot.users[0].id] = [{ kind: 'microsoftAuthenticator', displayName: 'Pixel 8' }]
    },
  },
  'bg.notPersonal': { target: bgId, fail: (b) => { userAt(b, bgId(b)).department = 'Finance' } },
  'bg.excludedFromReportOnly': {
    target: bgId,
    fail: (b) => {
      b.snapshot.config.caPolicies.rows.push({
        id: 'p-ro',
        displayName: 'Staged MFA',
        state: 'enabledForReportingButNotEnforced',
        conditions: { users: { includeUsers: ['All'] } },
      })
    },
  },
  'bg.microsoftManaged': {
    target: bgId,
    fail: (b) => {
      b.snapshot.config.caPolicies.rows.push({
        id: 'p-msm',
        displayName: 'Microsoft-managed: Multifactor authentication for admins',
        state: 'enabledForReportingButNotEnforced',
        conditions: { users: { includeUsers: ['All'] } },
      })
      b.snapshot.microsoftManagedPolicyIds = ['p-msm']
    },
  },
  'bg.phishingResistant': { target: bgId, fail: (b) => { b.snapshot.authMethods[bgId(b)] = [{ kind: 'phone', phoneType: 'mobile' }] } },
  'bg.methodDiversity': {
    target: bgId,
    pass: (b) => {
      const [a, second] = b.state.breakGlassUserIds
      b.snapshot.authMethods[a] = [{ kind: 'fido2' }]
      b.snapshot.authMethods[second] = [{ kind: 'microsoftAuthenticator' }]
    },
    fail: (b) => {
      for (const id of b.state.breakGlassUserIds) b.snapshot.authMethods[id] = [{ kind: 'phone', phoneType: 'mobile' }]
    },
  },
  'bg.perUserMfaOff': {
    target: bgId,
    fail: (b) => {
      b.snapshot.config.authMethodsPolicy.rows = [{ policyMigrationState: 'preMigration' }]
    },
  },
  'bg.noLicenceNeeded': {
    target: bgId,
    fail: (b) => {
      userAt(b, bgId(b)).assignedPlans = [{ servicePlanId: 'efb87545-963c-4e0d-99df-69c6916d9eb0', capabilityStatus: 'Enabled' }]
    },
  },
  'bg.drilled': { target: bgId, fail: (b) => { userAt(b, bgId(b)).lastSuccessfulSignIn = null } },
  // An absent answer is "not yet done", never unknown (prompt 46 item 21).
  'bg.credentialStorage': { target: bgId, unknown: 'never', fail: (b) => { b.state.breakGlassAnswers = { credentialStorage: null, signInMonitoring: true } } },
  'bg.signInMonitoring': { target: bgId, unknown: 'never', fail: (b) => { b.state.breakGlassAnswers = { credentialStorage: true, signInMonitoring: null } } },
  'bg.nameIdentifiesPurpose': { target: bgId, fail: (b) => { userAt(b, bgId(b)).displayName = 'Alex Garcia' } },
  // Notes report a fact either way; "fail" for them is the absence of the fact.
  // R10 inverted what these three report. The quiet state — never signed in, no
  // evidence in the window — is the expected one for a break-glass account, and
  // printing it was the date bookkeeping the review removed. The state worth a
  // line is the account having actually been used, so that is what the
  // "says something" case sets up.
  'bg.lastSignIn': { target: bgId, fail: (b) => { userAt(b, bgId(b)).lastSuccessfulSignIn = '2026-06-03T02:00:00.000Z' } },
  'bg.signInCountries': {
    target: bgId,
    fail: (b) => { b.snapshot.signInEvidence[bgId(b)] = { ...(b.snapshot.signInEvidence[bgId(b)] ?? {}), signInCount: 2, countries: ['AU'] } as never },
  },
  'bg.mfaSeen': {
    target: bgId,
    fail: (b) => { b.snapshot.signInEvidence[bgId(b)] = { ...(b.snapshot.signInEvidence[bgId(b)] ?? {}), signInCount: 2, lastMfaSuccess: null } as never },
  },
  // ---- exclusions group ----
  'xg.membersApproved': {
    target: (b) => ({ ...exclusionGroup(b), memberIds: [...b.state.breakGlassUserIds], memberCount: 2 }),
    unknown: 'target',
    fail: (b) => ({ ...exclusionGroup(b), memberIds: [...b.state.breakGlassUserIds, b.snapshot.users[0].id], memberCount: 3 }),
  },
  'xg.noExtraAdmins': {
    target: (b) => ({ ...exclusionGroup(b), memberIds: [...b.state.breakGlassUserIds] }),
    unknown: 'target',
    fail: (b) => {
      const admin = Object.keys(b.snapshot.roles.active).find((id) => !b.state.breakGlassUserIds.includes(id))!
      return { ...exclusionGroup(b), memberIds: [...b.state.breakGlassUserIds, admin] }
    },
  },
  'xg.notDynamic': {
    target: (b) => ({ ...exclusionGroup(b), membershipRule: null }),
    unknown: 'target',
    fail: (b) => ({ ...exclusionGroup(b), membershipRule: 'user.department -eq "IT"' }),
  },
  'xg.usedConsistently': {
    target: (b) => exclusionGroup(b),
    unknown: 'target',
    // Healthy: every live policy excludes the group (the rule checks the policies the plan touches, or every live one).
    pass: (b) => {
      const g = exclusionGroup(b)
      for (const p of b.snapshot.config.caPolicies.rows as { conditions?: { users?: { excludeGroups?: string[] } } }[]) {
        p.conditions ??= {}
        p.conditions.users ??= {}
        p.conditions.users.excludeGroups = [...new Set([...(p.conditions.users.excludeGroups ?? []), g.groupId])]
      }
      return g
    },
    fail: (b) => {
      const g = exclusionGroup(b)
      b.snapshot.config.caPolicies.rows = [
        { id: 'p-a', displayName: 'Policy A', state: 'enabled', conditions: { users: { includeUsers: ['All'], excludeGroups: [g.groupId] } } },
        { id: 'p-b', displayName: 'Policy B', state: 'enabled', conditions: { users: { includeUsers: ['All'] } } },
      ]
      return g
    },
  },
  'xg.sizeReasonable': {
    target: (b) => ({ ...exclusionGroup(b), memberIds: [...b.state.breakGlassUserIds], memberCount: 2 }),
    unknown: 'target',
    fail: (b) => ({ ...exclusionGroup(b), memberCount: 12 }),
  },
  'xg.notMailEnabled': {
    target: (b) => ({ ...exclusionGroup(b), mailEnabled: false }),
    unknown: 'target',
    fail: (b) => ({ ...exclusionGroup(b), mailEnabled: true }),
  },
  // ---- trusted named location ----
  'loc.notWholeInternet': { target: goodLocation, unknown: 'target', fail: () => ({ ...goodLocation(), ipRanges: [{ cidrAddress: '0.0.0.0/0' }] }) },
  'loc.notTooWide': { target: goodLocation, unknown: 'target', fail: () => ({ ...goodLocation(), ipRanges: [{ cidrAddress: '10.0.0.0/8' }] }) },
  'loc.isTrusted': { target: goodLocation, unknown: 'target', fail: () => ({ ...goodLocation(), isTrusted: false }) },
  'loc.redundancy': { target: goodLocation, unknown: 'target', fail: () => ({ ...goodLocation(), ipRanges: [{ cidrAddress: '203.0.113.7/32' }] }) },
  'loc.seenInSignIns': {
    target: goodLocation,
    unknown: 'target',
    // IAMAI keeps no addresses from sign-in records by design, so a stale range
    // cannot be proved; the rule passes or says it cannot tell.
    neverFails: true,
    fail: () => goodLocation(),
  },
  // ---- allowed countries ----
  'cty.atLeastOne': { target: () => null, unknown: 'never', fail: (b) => { b.state.allowedCountries = [] } },
  'cty.includesOperator': {
    target: () => null,
    fail: (b) => {
      b.state.allowedCountries = ['NZ']
    },
  },
  'cty.unknownCountries': {
    target: () => ({ id: 'loc-c', includeUnknownCountriesAndRegions: false }),
    unknown: 'target',
    fail: () => ({ id: 'loc-c', includeUnknownCountriesAndRegions: true }),
  },
  'cty.seenCountriesIncluded': {
    target: () => null,
    fail: (b) => {
      b.snapshot.evidenceAggregates = { ...(b.snapshot.evidenceAggregates ?? { total: 1, distinctUsers: 1, byClientApp: {}, byProtocol: {}, byCountry: {} }), byCountry: { AU: 5, RU: 1 } }
    },
    pass: (b) => {
      b.snapshot.evidenceAggregates = { ...(b.snapshot.evidenceAggregates ?? { total: 1, distinctUsers: 1, byClientApp: {}, byProtocol: {}, byCountry: {} }), byCountry: { AU: 5 } }
    },
  },
  // ---- pilot group ----
  'pilot.hasMembers': {
    target: (b) => ({ groupId: 'g-pilot', displayName: 'Pilot', membershipRule: null, memberIds: [b.snapshot.users[0].id], memberCount: 1, sampled: false }),
    unknown: 'target',
    fail: () => ({ groupId: 'g-pilot', displayName: 'Pilot', membershipRule: null, memberIds: [], memberCount: 0, sampled: false }),
  },
  'pilot.noBreakGlass': {
    target: (b) => ({ groupId: 'g-pilot', displayName: 'Pilot', membershipRule: null, memberIds: [b.snapshot.users[0].id], memberCount: 1, sampled: false }),
    unknown: 'target',
    fail: (b) => ({ groupId: 'g-pilot', displayName: 'Pilot', membershipRule: null, memberIds: [bgId(b)], memberCount: 1, sampled: false }),
  },
  'pilot.spread': {
    target: (b) => ({ groupId: 'g-pilot', displayName: 'Pilot', membershipRule: null, memberIds: b.snapshot.users.slice(0, 12).map((u) => u.id), memberCount: 12, sampled: false }),
    unknown: 'target',
    fail: (b) => {
      for (const u of b.snapshot.users) u.department = 'IT'
      return { groupId: 'g-pilot', displayName: 'Pilot', membershipRule: null, memberIds: b.snapshot.users.slice(0, 3).map((u) => u.id), memberCount: 3, sampled: false }
    },
  },
  'pilot.hasAdmin': {
    target: (b) => ({ groupId: 'g-pilot', displayName: 'Pilot', membershipRule: null, memberIds: Object.keys(b.snapshot.roles.active).slice(0, 1), memberCount: 1, sampled: false }),
    unknown: 'target',
    fail: (b) => {
      const notAdmin = b.snapshot.users.find((u) => (b.snapshot.roles.active[u.id] ?? []).length === 0)!
      return { groupId: 'g-pilot', displayName: 'Pilot', membershipRule: null, memberIds: [notAdmin.id], memberCount: 1, sampled: false }
    },
  },
  'pilot.membersReady': {
    target: (b) => {
      const id = b.snapshot.users[0].id
      b.viability = [{ userId: id, mfa: 'verified' } as MfaViability]
      return { groupId: 'g-pilot', displayName: 'Pilot', membershipRule: null, memberIds: [id], memberCount: 1, sampled: false }
    },
    unknown: 'target',
    fail: (b) => {
      const id = b.snapshot.users[0].id
      b.viability = [{ userId: id, mfa: 'none' } as MfaViability]
      return { groupId: 'g-pilot', displayName: 'Pilot', membershipRule: null, memberIds: [id], memberCount: 1, sampled: false }
    },
  },
  'pilot.passkeyEnabled': {
    target: (b) => {
      b.snapshot.config.authMethodsPolicy.rows = [{ authenticationMethodConfigurations: [{ id: 'Fido2', state: 'enabled', includeTargets: [{ id: 'all_users' }] }, { id: 'TemporaryAccessPass', state: 'enabled', includeTargets: [{ id: 'all_users' }] }] }]
      return { groupId: 'g-pilot', displayName: 'Pilot', membershipRule: null, memberIds: [], memberCount: 0, sampled: false }
    },
    unknown: 'target',
    fail: (b) => {
      b.snapshot.config.authMethodsPolicy.rows = [{ authenticationMethodConfigurations: [{ id: 'Fido2', state: 'disabled', includeTargets: [] }] }]
      return { groupId: 'g-pilot', displayName: 'Pilot', membershipRule: null, memberIds: [], memberCount: 0, sampled: false }
    },
  },
  'pilot.tapEnabled': {
    target: (b) => {
      b.snapshot.config.authMethodsPolicy.rows = [{ authenticationMethodConfigurations: [{ id: 'Fido2', state: 'enabled', includeTargets: [{ id: 'all_users' }] }, { id: 'TemporaryAccessPass', state: 'enabled', includeTargets: [{ id: 'all_users' }] }] }]
      return { groupId: 'g-pilot', displayName: 'Pilot', membershipRule: null, memberIds: [], memberCount: 0, sampled: false }
    },
    unknown: 'target',
    fail: () => ({ groupId: 'g-pilot', displayName: 'Pilot', membershipRule: null, memberIds: [], memberCount: 0, sampled: false }),
  },
  // ---- service accounts ----
  'svc.noInteractive': {
    target: () => '',
    fail: (b) => {
      const id = b.snapshot.users[0].id
      b.state.serviceAccountUserIds = [id]
      b.snapshot.signInEvidence[id] = { signInCount: 4, lastSignIn: b.snapshot.asOf, lastMfaSuccess: null }
    },
  },
  'svc.noAdminRole': {
    target: () => '',
    fail: (b) => {
      b.state.serviceAccountUserIds = [Object.keys(b.snapshot.roles.active)[0]]
    },
  },
  'svc.excludedFromBlocks': {
    target: () => '',
    fail: (b) => {
      const id = b.snapshot.users[0].id
      b.state.serviceAccountUserIds = [id]
      b.snapshot.evidenceUsage = {
        legacyAuth: { count: 3, userIds: [id], byDetail: {} },
        deviceCode: { count: 0, userIds: [], byDetail: {} },
        authTransfer: { count: 0, userIds: [], byDetail: {} }, riskHigh: { count: 0, userIds: [], byDetail: {} }, riskMedium: { count: 0, userIds: [], byDetail: {} },
      }
    },
  },
  // ---- authentication strength ----
  'str.exists': { target: goodStrength, fail: () => ({ ...goodStrength(), tenant: null }) },
  'str.achievable': {
    target: goodStrength,
    fail: (b) => {
      const id = b.snapshot.users[0].id
      b.viability = [{ userId: id, mfa: 'verified', methodTiers: [] } as unknown as MfaViability]
      return { tenant: { id: 's-1', allowedCombinations: ['fido2'] }, baselineCombinations: ['fido2'], population: [id] }
    },
  },
  'str.matchesBaseline': { target: goodStrength, fail: () => ({ ...goodStrength(), baselineCombinations: ['password,voice'] }) },
}

test('every rule in the registry has a case', () => {
  const missing = REGISTRY.map((r) => r.id).filter((id) => !CASES[id])
  assert.deepEqual(missing, [], 'a rule without a test is a rule that can regress')
})

for (const rule of REGISTRY) {
  const c = CASES[rule.id]
  if (!c) continue

  test(`${rule.id}: passes on a healthy tenant`, () => {
    const b = base()
    const fromPass = c.pass?.(b)
    const target = fromPass ?? c.target(b)
    const r = run(rule.id, target, b)
    assert.equal(r.outcome, 'pass', `${rule.id}: ${r.finding ?? ''}`)
  })

  test(`${rule.id}: fails on the state it exists to catch`, () => {
    const b = base()
    const target = c.fail(b) ?? c.target(b)
    const r = run(rule.id, target, b)
    if (c.neverFails) {
      assert.notEqual(r.outcome, 'fail', `${rule.id} claims it can never fail`)
      return
    }
    if (rule.severity === 'note') {
      // A note never fails; it reports the other fact.
      assert.equal(r.outcome, 'pass')
      assert.ok(r.finding, `${rule.id}: a note always says something`)
    } else {
      assert.equal(r.outcome, 'fail', `${rule.id} did not fail`)
      assert.ok(r.finding && r.finding.length > 5, `${rule.id}: the finding names the fact`)
      assert.doesNotMatch(r.finding, /[0-9a-f]{8}-[0-9a-f]{4}-/i, `${rule.id}: names, never ids`)
    }
  })

  test(`${rule.id}: reports unknown rather than passing when the data is missing`, () => {
    const how = c.unknown ?? 'needs'
    if (how === 'never') {
      // A rule with nothing to collect cannot be unknown; assert that shape.
      assert.equal(rule.needs.length === 0 || rule.id === 'bg.notInDynamicScope', true, `${rule.id}: declared needs but claims it can never be unknown`)
      return
    }
    const b = base()
    let target = c.target(b)
    if (how === 'needs') for (const need of rule.needs) stripNeed(b, need)
    if (how === 'target') target = null
    if (how === 'answers') b.state.breakGlassAnswers = { credentialStorage: null, signInMonitoring: null }
    const r = run(rule.id, target, b)
    assert.equal(r.outcome, 'unknown', `${rule.id} passed silently with its data missing`)
    assert.ok(r.finding, `${rule.id}: unknown says what could not be read`)
  })
}

// ---- worst-state fixtures (design §6) --------------------------------------

test('worst-state emergency access: every blocker fires, each naming its fact', () => {
  const b = base()
  const id = bgId(b)
  b.state.breakGlassUserIds = [id] // one account
  const u = userAt(b, id)
  u.onPremisesSyncEnabled = true // synced
  u.userPrincipalName = 'admin@small.example.com' // custom domain
  u.accountEnabled = false // disabled
  u.department = 'IT' // a person's account
  u.displayName = 'Alex Garcia' // says nothing about its purpose
  b.snapshot.roles.eligible[id] = [...(b.snapshot.roles.active[id] ?? [])]
  b.snapshot.roles.active[id] = [] // eligible only
  b.snapshot.authMethods[id] = [] // no MFA method
  b.snapshot.config.caPolicies.rows.push({ id: 'p-x', displayName: 'Require MFA for all', state: 'enabled', conditions: { users: { includeUsers: ['All'] } } })
  b.groups.push({ groupId: 'g-dyn', displayName: 'All staff', membershipRule: 'user.accountEnabled -eq true', memberIds: [id], memberCount: 1, sampled: false })

  const report = breakGlassReport(ctxOf(b))
  const fired = new Set(report.blocking.map((r) => r.id))
  const expected = [
    'bg.count', 'bg.role.permanentGa', 'bg.cloudOnly', 'bg.initialDomain', 'bg.enabled',
    'bg.excludedFromAllPolicies', 'bg.notInDynamicScope', 'bg.hasMfaMethod', 'bg.notPersonal',
  ]
  for (const ruleId of expected) assert.ok(fired.has(ruleId), `${ruleId} did not fire on the worst state`)
  for (const r of report.blocking) assert.ok(r.finding && r.finding.length > 5, `${r.id}: no finding text`)
  assert.ok(report.warnings.some((r) => r.id === 'bg.nameIdentifiesPurpose'), 'the name is called out as a recommendation')
})

test('worst-state exclusions group: every blocker fires', () => {
  const b = base()
  const admin = Object.keys(b.snapshot.roles.active).find((id) => !b.state.breakGlassUserIds.includes(id))!
  const entry: GroupFacts = { groupId: 'g-x', displayName: 'Exclusions', membershipRule: 'user.jobTitle -eq "IT"', mailEnabled: true, memberIds: [...b.state.breakGlassUserIds, admin], memberCount: 12, sampled: false }
  b.snapshot.config.caPolicies.rows.push({ id: 'p-y', displayName: 'Another policy', state: 'enabled', conditions: { users: { includeUsers: ['All'] } } })
  const results = evaluateSubject('exclusionGroup', entry, ctxOf(b))
  const failed = new Set(results.filter((r) => r.outcome === 'fail').map((r) => r.id))
  for (const ruleId of ['xg.membersApproved', 'xg.noExtraAdmins', 'xg.notDynamic', 'xg.sizeReasonable', 'xg.notMailEnabled']) {
    assert.ok(failed.has(ruleId), `${ruleId} did not fire`)
  }
})

test('worst-state trusted location: the whole internet, untrusted, one address', () => {
  const b = base()
  const loc = { id: 'loc-bad', displayName: 'Everywhere', isTrusted: false, ipRanges: [{ cidrAddress: '0.0.0.0/0' }] }
  const failed = new Set(evaluateSubject('trustedLocation', loc, ctxOf(b)).filter((r) => r.outcome === 'fail').map((r) => r.id))
  assert.ok(failed.has('loc.notWholeInternet'))
  assert.ok(failed.has('loc.isTrusted'))
})

// ---- the plan gate (design §2) ---------------------------------------------

test('with an emergency-access blocker, no step that can deny access is Ready', () => {
  const f = fixture('small')
  const broken = structuredClone(f)
  // One account, and it is not a Global Administrator: two blockers.
  broken.mapping.breakGlassUserIds = [f.mapping.breakGlassUserIds[0]]
  broken.snapshot.roles.active[f.mapping.breakGlassUserIds[0]] = []
  const { steps } = runFixture(broken)
  const gate = steps.find((s) => s.id === blockerStepId('breakGlass'))
  assert.ok(gate, 'the plan carries the emergency-access step')
  const denying = steps.filter((s) => canDenyAccess(s) && s.status !== 'done' && s.status !== 'skipped')
  assert.ok(denying.length > 0, 'the fixture has steps that can deny access')
  for (const s of denying) {
    assert.equal(s.status, 'blocked', `${s.id} is offered while the way back in is unverified`)
    assert.ok(s.blockedBy.includes(gate.id), `${s.id} does not name the emergency-access step`)
    assert.match(s.blockedReason ?? '', /emergency access/i, `${s.id}: the blocked reason names the subject`)
  }
})

test('a healthy tenant carries no blocker step, and its deny-capable steps are offered', () => {
  const { steps } = runFixture(fixture('small'))
  assert.equal(steps.some((s) => s.id.startsWith('s-blocker-')), false)
  assert.ok(steps.some((s) => canDenyAccess(s) && s.status !== 'blocked'), 'nothing is held on a tenant with a working escape hatch')
})
