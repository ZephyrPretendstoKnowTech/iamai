// Emergency-access detection (prompt 46 item 20): five signals nominate; only
// the explicit name classifies, because taking an account out of the people
// population is not a guess a scan is allowed to make. None found is an answer
// that puts the accounts in Wave 0.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { autoEmergencyAccess, detectEmergencyAccess, emergencySignals, isEmergencyName } from './emergencyAccess.ts'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { emptyMappingState } from './types.ts'
import { applyDetectedDefaults } from './wizard.ts'
import { appliedMapping } from '../ui/surfaces/pickerRows.ts'
import { facts } from '../derive/facts.ts'
import { BREAK_GLASS_STEP_ID } from '../roadmap/generate.ts'
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'

const GA = '62e90394-69f5-4237-9190-012177145e10'
const user = (over: Partial<UserRow>): UserRow => ({
  id: 'u',
  displayName: 'Alex Morgan',
  userPrincipalName: 'alex@contoso.com',
  userType: 'member',
  usageLocation: 'AU',
  createdDateTime: null,
  lastSuccessfulSignIn: null,
  accountEnabled: true,
  mail: null,
  assignedPlans: [{ servicePlanId: 'p', capabilityStatus: 'Enabled' }],
  onPremisesSyncEnabled: false,
  externalUserState: null,
  department: null,
  jobTitle: null,
  officeLocation: null,
  ...over,
})

// The name signal classifies on its own, so it reads a purpose phrase the
// tenant wrote, never a word that happens to appear in somebody's name.
test('the automatic name is a purpose phrase: every way a tenant writes one', () => {
  for (const name of [
    'Breakglass',
    'Break Glass',
    'Break-Glass',
    'break_glass',
    'Break Glass 2',
    'Break-glass 01',
    'breakglass@contoso.com',
    'BreakGlass Admin',
    'Emergency Access',
    'Emergency-Access',
    'EmergencyAccess',
    'emergency access 1',
    'emergency admin',
    'Emergency Account',
    'BG-Admin',
    'bg_admin',
    'BG Admin',
    'contoso bg',
  ]) {
    assert.equal(isEmergencyName(name), true, `${name} names the account for the job`)
  }
})

test('the automatic name never fires on an ordinary name that contains the words', () => {
  for (const name of [
    'Alice Glass',
    'John Glassman',
    'Glass, Alice',
    'Breakwater',
    'Breakfast Club',
    'Kim Breakwell',
    'Glasscock Holdings',
    'Emergency Services Liaison',
    'Emergency Contact Mailbox',
    'Bigby Wolf',
    'bgood@contoso.com',
    'Bridget Gallagher',
    'Sam Lee',
  ]) {
    assert.equal(isEmergencyName(name), false, `${name} is a name, not a purpose`)
  }
})

test('a person whose surname is Glass keeps every weak signal and is still not classified', () => {
  const s = fixtureSnapshot()
  s.config.caPolicies!.rows = []
  s.roles = { active: { alice: [GA] }, eligible: {} }
  s.users = [
    user({ id: 'alice', displayName: 'Alice Glass', userPrincipalName: 'alice.glass@contoso.onmicrosoft.com', assignedPlans: [] }),
    user({ id: 'bg', displayName: 'Breakglass', userPrincipalName: 'breakglass@contoso.onmicrosoft.com', assignedPlans: [] }),
  ]
  assert.deepEqual(emergencySignals(s.users[0], s, []), ['onmicrosoft', 'globalAdmin', 'noLicence'], 'no name signal')
  assert.deepEqual(emergencySignals(s.users[1], s, []), ['name', 'onmicrosoft', 'noLicence'])
  assert.deepEqual(detectEmergencyAccess(s, []).map((c) => c.id), ['bg', 'alice'], 'both nominated, the named one first')
  assert.deepEqual(autoEmergencyAccess(s, []).map((c) => c.id), ['bg'], 'only the account named for the job is classified')
})

test('each signal is read from the tenant, and "bg" only as its own token', () => {
  const s = fixtureSnapshot()
  s.roles = { active: { ga1: [GA] }, eligible: {} }
  const policies = [{ state: 'enabled', conditions: { users: { excludeUsers: ['x1'] } } }, { state: 'enabled', conditions: { users: { excludeUsers: ['x1', 'other'] } } }]
  assert.deepEqual(emergencySignals(user({ id: 'n1', displayName: 'Break Glass 1' }), s, policies), ['name'])
  assert.deepEqual(emergencySignals(user({ id: 'n2', userPrincipalName: 'bg-admin@contoso.com' }), s, policies), ['name'])
  assert.deepEqual(emergencySignals(user({ id: 'n3', displayName: 'Bigby Wolf', userPrincipalName: 'bigby@contoso.com' }), s, policies), [], '"bg" inside a word is not a signal')
  assert.deepEqual(emergencySignals(user({ id: 'o1', userPrincipalName: 'ops@contoso.onmicrosoft.com' }), s, policies), ['onmicrosoft'])
  assert.deepEqual(emergencySignals(user({ id: 'ga1' }), s, policies), ['globalAdmin'])
  assert.deepEqual(emergencySignals(user({ id: 'x1' }), s, policies), ['excludedEverywhere'])
  assert.deepEqual(emergencySignals(user({ id: 'other' }), s, policies), [], 'excluded from one policy of two is not everywhere')
  assert.deepEqual(emergencySignals(user({ id: 'l1', assignedPlans: [] }), s, policies), ['noLicence'])
  assert.deepEqual(emergencySignals(user({ id: 'l2', assignedPlans: [{ servicePlanId: 'p', capabilityStatus: 'Deleted' }] }), s, policies), ['noLicence'])
})

test('the name nominates on its own, two weak signals nominate together; guests and disabled accounts never do', () => {
  const s = fixtureSnapshot()
  s.roles = { active: {}, eligible: {} }
  s.users = [
    user({ id: 'a', displayName: 'Emergency Access 1', userPrincipalName: 'emergency1@contoso.onmicrosoft.com', assignedPlans: [] }), // name + onmicrosoft + noLicence
    user({ id: 'b', displayName: 'Break Glass 2', userPrincipalName: 'breakglass2@contoso.com' }), // name only
    user({ id: 'c', displayName: 'Guest Glass', userPrincipalName: 'glass@partner.onmicrosoft.com', userType: 'guest' }),
    user({ id: 'd', displayName: 'Old Glass', userPrincipalName: 'glass@contoso.onmicrosoft.com', accountEnabled: false }),
    user({ id: 'e', displayName: 'Ops Console', userPrincipalName: 'ops@contoso.onmicrosoft.com', assignedPlans: [] }), // onmicrosoft + noLicence, no name
    user({ id: 'f', displayName: 'Sam Lee' }),
  ]
  const found = detectEmergencyAccess(s, [])
  assert.deepEqual(found.map((c) => c.id), ['a', 'b', 'e'], 'the named ones first, then the circumstantial one')
  assert.deepEqual(found[0].signals, ['name', 'onmicrosoft', 'noLicence'])
  assert.deepEqual(found.map((c) => c.automatic), [true, true, false])
  assert.deepEqual(autoEmergencyAccess(s, []).map((c) => c.id), ['a', 'b'], 'only the tenant’s own naming classifies')
})

test('weak signals never classify: a Global Administrator that is unlicensed and .onmicrosoft.com stays a person', () => {
  const s = fixtureSnapshot()
  s.config.caPolicies!.rows = []
  s.roles = { active: { ga: [GA] }, eligible: {} }
  s.users = [
    // Every circumstantial signal at once, and no name: the first admin of a small tenant.
    user({ id: 'ga', displayName: 'Admin', userPrincipalName: 'admin@contoso.onmicrosoft.com', assignedPlans: [] }),
    user({ id: 'p', displayName: 'Sam Lee', userPrincipalName: 'sam@contoso.com' }),
  ]
  const signals = emergencySignals(s.users[0], s, [])
  assert.deepEqual(signals, ['onmicrosoft', 'globalAdmin', 'noLicence'], 'three weak signals')
  assert.deepEqual(detectEmergencyAccess(s, []).map((c) => c.id), ['ga'], 'still offered in the picker')
  assert.equal(detectEmergencyAccess(s, [])[0].automatic, false)
  assert.deepEqual(autoEmergencyAccess(s, []), [], 'and classified by nothing')
  const state = applyDetectedDefaults(emptyMappingState(s.tenantId), s, { knownGroups: [] })
  assert.deepEqual(state.breakGlassUserIds, [], 'the detected default leaves the administrator in the people population')
  assert.equal(state.assumed?.breakGlass, 'noneFound')
})

test('none found is an empty list, not an error', () => {
  const s = fixtureSnapshot()
  s.roles = { active: {}, eligible: {} }
  s.users = [user({ id: 'a' }), user({ id: 'b', displayName: 'Sam Lee' })]
  assert.deepEqual(detectEmergencyAccess(s, []), [])
})

// ---- The account ledger of a small tenant, end to end ----

/**
 * Four accounts, the shape a small tenant actually has: an ordinary
 * administrator whose address is the tenant's initial domain, a licensed
 * person, one account the tenant named for emergencies, and a mailbox with
 * sign-in blocked. The administrator carries three circumstantial signals and
 * is still a person.
 */
function smallTenant(operatorId: string): TenantSnapshot {
  const s = fixtureSnapshot()
  const daysAgo = (d: number): string => new Date(Date.parse(s.asOf) - d * 86_400_000).toISOString()
  const licensed = [{ servicePlanId: '41781fb2-bc02-4b7c-bd55-b576c07bb09d', capabilityStatus: 'Enabled' }]
  s.config.caPolicies!.rows = []
  s.users = [
    user({ id: 'admin', displayName: 'Admin', userPrincipalName: 'admin@contoso.onmicrosoft.com', assignedPlans: [], lastSuccessfulSignIn: daysAgo(1) }),
    user({ id: 'person', displayName: 'Robin Fielding', userPrincipalName: 'robin@contoso.com', assignedPlans: licensed, lastSuccessfulSignIn: daysAgo(3) }),
    user({ id: 'bg', displayName: 'Breakglass', userPrincipalName: 'breakglass@contoso.onmicrosoft.com', assignedPlans: [], lastSuccessfulSignIn: daysAgo(30) }),
    user({ id: 'mailbox', displayName: 'Feedback Mailbox', userPrincipalName: 'feedback@contoso.com', assignedPlans: licensed, accountEnabled: false, lastSuccessfulSignIn: null }),
  ]
  s.roles = { active: { admin: [GA], bg: [GA] }, eligible: {} }
  s.registrationDetails = s.users.map((u) => ({
    id: u.id,
    userPrincipalName: u.userPrincipalName,
    isMfaCapable: u.id !== 'mailbox',
    isMfaRegistered: u.id !== 'mailbox',
    isPasswordlessCapable: u.id === 'bg',
    methodsRegistered: u.id === 'mailbox' ? [] : u.id === 'bg' ? ['fido2SecurityKey'] : ['microsoftAuthenticatorPush'],
    defaultMfaMethod: null,
    userPreferredMethodForSecondaryAuthentication: null,
    isAdmin: u.id === 'admin' || u.id === 'bg',
    userType: 'member' as const,
  }))
  s.authMethods = {
    admin: [{ kind: 'microsoftAuthenticator', phoneAppVersion: '6.2508.0' }],
    person: [{ kind: 'microsoftAuthenticator', phoneAppVersion: '6.2508.0' }],
    bg: [{ kind: 'fido2' }],
    mailbox: [],
  }
  s.signInEvidence = {
    admin: { signInCount: 40, lastSignIn: daysAgo(1), lastMfaSuccess: { at: daysAgo(1), method: 'Mobile app notification' } },
    person: { signInCount: 12, lastSignIn: daysAgo(3), lastMfaSuccess: { at: daysAgo(3), method: 'Mobile app notification' } },
  }
  s.devices = []
  s.blockedToday = []
  s.evidencePolicyResults = []
  const me = s.users.find((u) => u.id === operatorId)!
  s.config.me!.rows = [{ id: me.id, displayName: me.displayName, userPrincipalName: me.userPrincipalName }]
  return s
}

const applied = (s: TenantSnapshot, stored = emptyMappingState(s.tenantId), saved: Record<string, { picked: string[]; at: string }> | null = null) =>
  appliedMapping({ snapshot: s, mapping: stored, nameOf: (id) => id, now: s.asOf }, saved)

test('a fresh scan of a four-account tenant: 2 active people, 1 emergency access, 1 sign-in disabled', () => {
  const s = smallTenant('admin')
  const m = applied(s)
  assert.deepEqual(m.breakGlassUserIds, ['bg'], 'the named account, and only it')
  const F = facts(s, m)
  assert.deepEqual(
    { accounts: F.accounts, active: F.active, emergency: F.kinds.emergency, disabled: F.kinds.disabled, service: F.kinds.service, notActive: F.notActive },
    { accounts: 4, active: 2, emergency: 1, disabled: 1, service: 0, notActive: 0 },
  )
})

test('the ledger is the same whoever is signed in: the operator changes no classification', () => {
  const base = facts(smallTenant('admin'), applied(smallTenant('admin')))
  for (const operator of ['admin', 'person', 'bg', 'mailbox']) {
    const s = smallTenant(operator)
    const m = applied(s)
    assert.deepEqual(m.breakGlassUserIds, ['bg'], `signed in as ${operator}: the same emergency account`)
    assert.deepEqual(facts(s, m), base, `signed in as ${operator}: the same facts`)
  }
})

test('a saved decision is authoritative: the accounts a person picked are the emergency accounts', () => {
  const s = smallTenant('admin')
  const saved = { [BREAK_GLASS_STEP_ID]: { picked: ['admin'], at: s.asOf } }
  const m = applied(s, emptyMappingState(s.tenantId), saved)
  assert.deepEqual(m.breakGlassUserIds, ['admin'], 'the decision wins over the detection')
  // And the stored mapping alone says the same, with no decision saved on the step.
  const stored = { ...emptyMappingState(s.tenantId), breakGlassUserIds: ['admin'] }
  assert.deepEqual(applied(s, stored).breakGlassUserIds, ['admin'], 'the plan’s own value is never widened by a nomination')
})

test('the classification survives a rescan: the same account, with nothing saved', () => {
  const s = smallTenant('admin')
  const first = applied(s)
  const rescan = smallTenant('person')
  rescan.asOf = new Date(Date.parse(s.asOf) + 86_400_000).toISOString()
  const second = applied(rescan)
  assert.deepEqual(second.breakGlassUserIds, first.breakGlassUserIds)
  assert.equal(facts(rescan, second).kinds.emergency, 1)
})
