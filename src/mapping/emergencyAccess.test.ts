// Emergency-access detection (prompt 46 item 20): five signals, two or more
// nominate; none found is an answer that puts the accounts in Wave 0.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectEmergencyAccess, emergencySignals } from './emergencyAccess.ts'
import { fixtureSnapshot } from '../ui/pages/fixtureSnapshot.ts'
import type { UserRow } from '../graph/collect/types.ts'

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

test('two or more signals nominate; one does not; guests and disabled accounts never do', () => {
  const s = fixtureSnapshot()
  s.roles = { active: {}, eligible: {} }
  s.users = [
    user({ id: 'a', displayName: 'Emergency Access 1', userPrincipalName: 'emergency1@contoso.onmicrosoft.com', assignedPlans: [] }), // name + onmicrosoft + noLicence
    user({ id: 'b', displayName: 'Break Glass 2', userPrincipalName: 'breakglass2@contoso.com' }), // name only
    user({ id: 'c', displayName: 'Guest Glass', userPrincipalName: 'glass@partner.onmicrosoft.com', userType: 'guest' }),
    user({ id: 'd', displayName: 'Old Glass', userPrincipalName: 'glass@contoso.onmicrosoft.com', accountEnabled: false }),
  ]
  const found = detectEmergencyAccess(s, [])
  assert.deepEqual(found.map((c) => c.id), ['a'])
  assert.deepEqual(found[0].signals, ['name', 'onmicrosoft', 'noLicence'])
})

test('none found is an empty list, not an error', () => {
  const s = fixtureSnapshot()
  s.roles = { active: {}, eligible: {} }
  s.users = [user({ id: 'a' }), user({ id: 'b', displayName: 'Sam Lee' })]
  assert.deepEqual(detectEmergencyAccess(s, []), [])
})
