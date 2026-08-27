// Validation-rule tests (prompt 06) — authored fixtures only.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateBreakGlass,
  validateExclusionGroup,
  validatePasskeyPilot,
  validateStrength,
  validateTrustedLocation,
} from './validate.ts'
import type { BreakGlassContext } from './validate.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { GroupMembersCacheEntry } from '../graph/collect/cache.ts'

const GA = '62e90394-69f5-4237-9190-012177145e10'

function user(id: string, over: Partial<TenantSnapshot['users'][0]> = {}): TenantSnapshot['users'][0] {
  return {
    id,
    displayName: id,
    userPrincipalName: `${id}@x.test`,
    userType: 'member',
    usageLocation: null,
    createdDateTime: '2024-01-01T00:00:00Z',
    lastSuccessfulSignIn: '2026-08-01T00:00:00Z',
    accountEnabled: true,
    assignedPlans: [],
    onPremisesSyncEnabled: false,
    externalUserState: null,
    department: null,
    jobTitle: null,
    officeLocation: null,
    ...over,
  }
}

function snapshot(over: Partial<TenantSnapshot> = {}): TenantSnapshot {
  return {
    schemaVersion: 1,
    tenantId: 't',
    asOf: '2026-08-26T00:00:00Z',
    sources: {} as TenantSnapshot['sources'],
    config: {} as TenantSnapshot['config'],
    registrationDetails: [],
    users: [user('bg1'), user('bg2'), user('u1')],
    devices: [],
    spActivity: [],
    authMethods: {
      bg1: [{ kind: 'fido2' }],
      bg2: [{ kind: 'fido2' }],
      u1: [{ kind: 'microsoftAuthenticator', displayName: 'Pixel 9' }],
    },
    appSignInSummary: [],
    signInEvidence: {},
    evidencePolicyResults: [],
    blockedToday: [],
    evidenceUsage: null,
    capabilities: {} as TenantSnapshot['capabilities'],
    microsoftManagedPolicyIds: [],
    roles: { active: { bg1: [GA], bg2: [GA] }, eligible: {} },
    ...over,
  }
}

const policy = (name: string, excludeUsers: string[] = [], excludeGroups: string[] = []) => ({
  displayName: name,
  state: 'enabled',
  conditions: { users: { excludeUsers, excludeGroups } },
})

function bgCtx(over: Partial<BreakGlassContext> = {}): BreakGlassContext {
  return {
    snapshot: snapshot(),
    tenantPolicies: [policy('P1', ['bg1', 'bg2']), policy('P2', ['bg1', 'bg2'])],
    groupMembers: [],
    confirmedBreakGlassIds: ['bg1', 'bg2'],
    ...over,
  }
}

test('break-glass: a compliant account passes', () => {
  const r = validateBreakGlass('bg1', bgCtx())
  assert.equal(r.passed, true)
})

test('break-glass: eligible-only Global Administrator fails with the PIM reason', () => {
  const snap = snapshot({ roles: { active: { bg2: [GA] }, eligible: { bg1: [GA] } } })
  const r = validateBreakGlass('bg1', bgCtx({ snapshot: snap }))
  assert.equal(r.passed, false)
  assert.ok(r.findings.some((f) => f.includes('eligible-only')))
})

test('break-glass: missing exclusion from one policy names the policy', () => {
  const r = validateBreakGlass('bg1', bgCtx({ tenantPolicies: [policy('P1', ['bg1']), policy('Report Only P', [])] }))
  assert.equal(r.passed, false)
  assert.ok(r.findings.some((f) => f.includes('Report Only P')))
})

test('break-glass: exclusion via group membership counts', () => {
  const group: GroupMembersCacheEntry = {
    tenantId: 't',
    groupId: 'g-bg',
    displayName: 'BreakGlass',
    membershipRule: null,
    memberCount: 2,
    memberIds: ['bg1', 'bg2'],
    sampled: false,
    asOf: '2026-08-26T00:00:00Z',
  }
  const r = validateBreakGlass(
    'bg1',
    bgCtx({ tenantPolicies: [policy('P1', [], ['g-bg'])], groupMembers: [group] }),
  )
  assert.equal(r.passed, true)
})

test('break-glass: SMS-only is a hard fail', () => {
  const snap = snapshot()
  snap.authMethods.bg1 = [{ kind: 'phone', phoneType: 'mobile' }]
  const r = validateBreakGlass('bg1', bgCtx({ snapshot: snap }))
  assert.equal(r.passed, false)
  assert.ok(r.findings.some((f) => f.includes('SMS/voice')))
})

test('break-glass: shared Authenticator displayName flags the other user', () => {
  const snap = snapshot()
  snap.authMethods.bg1 = [{ kind: 'microsoftAuthenticator', displayName: 'Pixel 9' }]
  const r = validateBreakGlass('bg1', bgCtx({ snapshot: snap }))
  assert.equal(r.passed, false)
  assert.ok(r.findings.some((f) => f.includes('Pixel 9') && f.includes('shared-device')))
})

test('break-glass: dynamic-group sweep is a hard fail', () => {
  const dyn: GroupMembersCacheEntry = {
    tenantId: 't',
    groupId: 'g-dyn',
    displayName: 'All Staff',
    membershipRule: 'user.department -ne null',
    memberCount: 3,
    memberIds: ['bg1', 'u1'],
    sampled: false,
    asOf: '2026-08-26T00:00:00Z',
  }
  const r = validateBreakGlass('bg1', bgCtx({ groupMembers: [dyn] }))
  assert.equal(r.passed, false)
  assert.ok(r.findings.some((f) => f.includes('dynamic group')))
})

test('break-glass: fewer than two accounts fails', () => {
  const r = validateBreakGlass('bg1', bgCtx({ confirmedBreakGlassIds: ['bg1'] }))
  assert.equal(r.passed, false)
  assert.ok(r.findings.some((f) => f.includes('two break-glass')))
})

test('exclusion group: dynamic rule is a hard fail; admins among members noted', () => {
  const entry: GroupMembersCacheEntry = {
    tenantId: 't',
    groupId: 'g-x',
    displayName: 'Exclusions',
    membershipRule: 'user.userType -eq "Member"',
    memberCount: 2,
    memberIds: ['bg1', 'u1'],
    sampled: false,
    asOf: '2026-08-26T00:00:00Z',
  }
  const r = validateExclusionGroup(entry, { snapshot: snapshot(), tenantPolicies: [policy('P1', [], ['g-x'])] })
  assert.equal(r.passed, false)
  assert.ok(r.findings.some((f) => f.includes('dynamic membership')))
  assert.ok(r.findings.some((f) => f.includes('admin roles')))
})

test('exclusion group: inconsistent use across policies is reported', () => {
  const entry: GroupMembersCacheEntry = {
    tenantId: 't',
    groupId: 'g-x',
    displayName: 'Exclusions',
    membershipRule: null,
    memberCount: 1,
    memberIds: ['u1'],
    sampled: false,
    asOf: '2026-08-26T00:00:00Z',
  }
  const r = validateExclusionGroup(entry, {
    snapshot: snapshot(),
    tenantPolicies: [policy('P1', [], ['g-x']), policy('P2'), policy('P3')],
  })
  assert.ok(r.findings.some((f) => f.includes('1 of 3')))
})

test('trusted location: 0.0.0.0/0 and wider-than-/16 are hard fails; isTrusted required', () => {
  const bad = validateTrustedLocation({ isTrusted: false, ipRanges: [{ cidrAddress: '0.0.0.0/0' }, { cidrAddress: '10.0.0.0/8' }] })
  assert.equal(bad.passed, false)
  assert.ok(bad.findings.some((f) => f.includes('entire internet')))
  assert.ok(bad.findings.some((f) => f.includes('wider than /16')))
  assert.ok(bad.findings.some((f) => f.includes('isTrusted')))
  const good = validateTrustedLocation({ isTrusted: true, ipRanges: [{ cidrAddress: '203.0.113.0/24' }] })
  assert.equal(good.passed, true)
})

test('strength: identical combinations pass; extra combinations fail', () => {
  const base = ['fido2', 'windowsHelloForBusiness']
  const same = validateStrength({ allowedCombinations: base }, base)
  assert.equal(same.passed, true)
  const looser = validateStrength({ allowedCombinations: [...base, 'password,sms'] }, base)
  assert.equal(looser.passed, false)
  assert.ok(looser.findings.some((f) => f.includes('password,sms')))
})

test('strength: baseline without combinations offers the built-in comparison', () => {
  const r = validateStrength({ allowedCombinations: ['fido2'] }, null)
  assert.equal(r.passed, true)
  assert.ok(r.findings.some((f) => f.includes('built-in')))
})

test('passkey pilot: untargeted FIDO2 and missing TAP fail; ACCE absence is a note', () => {
  const policyDoc = {
    authenticationMethodConfigurations: [
      { id: 'Fido2', state: 'enabled', includeTargets: [{ id: 'other-group' }] },
      { id: 'TemporaryAccessPass', state: 'disabled', includeTargets: [] },
    ],
  }
  const r = validatePasskeyPilot('g-pilot', policyDoc, [])
  assert.equal(r.passed, false)
  assert.ok(r.findings.some((f) => f.includes('not targeted')))
  assert.ok(r.findings.some((f) => f.includes('Temporary Access Pass')))
  assert.ok(r.findings.some((f) => f.includes('could not verify')))
  const ok = validatePasskeyPilot(
    'g-pilot',
    {
      authenticationMethodConfigurations: [
        { id: 'Fido2', state: 'enabled', includeTargets: [{ id: 'g-pilot' }] },
        { id: 'TemporaryAccessPass', state: 'enabled', includeTargets: [{ id: 'all_users' }] },
      ],
    },
    [{ appDisplayName: 'Azure Credential Configuration Endpoint Service' }],
  )
  assert.equal(ok.passed, true)
})
