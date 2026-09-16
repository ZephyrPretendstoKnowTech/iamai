import test from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { effectOf } from './operations.ts'
import { createMethodPreparationCache, methodPreparation, methodReadiness } from './methodReadiness.ts'

function setup() {
  const snapshot = fixtureSnapshot()
  ;(snapshot.config.authMethodsPolicy.rows[0] as any).authenticationMethodConfigurations = [
    { id: 'MicrosoftAuthenticator', state: 'enabled', includeTargets: [{ id: 'all_users', authenticationMode: 'any' }], excludeTargets: [] },
    { id: 'Fido2', state: 'enabled', includeTargets: [{ id: 'all_users', targetType: 'group' }], excludeTargets: [], keyRestrictions: { isEnforced: false } },
  ]
  snapshot.registrationDetails = snapshot.users.map(u => ({ id: u.id, userPrincipalName: u.userPrincipalName, isMfaCapable: true, isMfaRegistered: true, isPasswordlessCapable: false, methodsRegistered: ['microsoftAuthenticatorPush'], defaultMfaMethod: null, userPreferredMethodForSecondaryAuthentication: null, isAdmin: false, userType: u.userType }))
  snapshot.config.authStrengths.rows.push({ id: 'target', allowedCombinations: ['password,microsoftAuthenticatorPush'], combinationConfigurations: [] })
  const policy = { state: 'enabled', conditions: { users: { includeUsers: ['u-1', 'u-2'] }, applications: { includeApplications: ['All'] } }, grantControls: { operator: 'AND', authenticationStrength: { id: 'target' } } }
  return { snapshot, policy }
}

test('readiness uses actual target scope and accepted methods, not a phishing-resistant family score', () => {
  const { snapshot, policy } = setup()
  snapshot.registrationDetails.find(r => r.id === 'u-2')!.methodsRegistered = ['mobilePhone']
  const reading = methodPreparation([effectOf(policy)], snapshot.users.map(u => u.id), snapshot)
  assert.deepEqual(reading.ids, ['u-1', 'u-2'])
  assert.deepEqual(reading.readyIds, ['u-1'])
  assert.equal(methodReadiness('mfa', reading).percent, 50)
})

test('eligible administrator is prepared for activation without changing active role scope', () => {
  const { snapshot, policy } = setup()
  snapshot.roles = { active: {}, eligible: { 'u-2': ['admin-role'] } }
  const effect = effectOf({ ...policy, conditions: { ...policy.conditions, users: { includeRoles: ['admin-role'] } } })
  assert.deepEqual(methodPreparation([effect], snapshot.users.map(u => u.id), snapshot).ids, ['u-2'])
  assert.deepEqual(snapshot.roles.active, {})
})

test('missing strength and unresolved group cannot become a passing number', () => {
  const { snapshot, policy } = setup()
  snapshot.config.authStrengths.rows = []
  assert.equal(methodReadiness('mfa', methodPreparation([effectOf(policy)], ['u-1'], snapshot)).unmeasured, 'unreadable')
  const group = effectOf({ ...policy, conditions: { ...policy.conditions, users: { includeGroups: ['unread'] } } })
  assert.equal(methodPreparation([group], ['u-1'], snapshot).completeScope, false)
})

test('restricted FIDO2 combination requires a key with the permitted model', () => {
  const { snapshot, policy } = setup()
  snapshot.config.authStrengths.rows = [{ id: 'target', allowedCombinations: ['fido2'], combinationConfigurations: [{ '@odata.type': '#microsoft.graph.fido2CombinationConfiguration', appliesToCombinations: ['fido2'], allowedAAGUIDs: ['approved-model'] }] }]
  snapshot.registrationDetails[0].methodsRegistered = ['fido2SecurityKey']
  snapshot.authMethods['u-1'] = [{ kind: 'fido2', aaGuid: 'different-model' }]
  assert.deepEqual(methodPreparation([effectOf(policy)], ['u-1'], snapshot).readyIds, [])
  snapshot.authMethods['u-1'] = [{ kind: 'fido2', aaGuid: 'approved-model' }]
  assert.deepEqual(methodPreparation([effectOf(policy)], ['u-1'], snapshot).readyIds, ['u-1'])
})

test('quiet accounts do not need fresh sign-in proof for registration preparation', () => {
  const { snapshot, policy } = setup()
  snapshot.sources.signInEvidence.status = 'error'
  assert.deepEqual(methodPreparation([effectOf(policy)], ['u-1'], snapshot).readyIds, ['u-1'])
})


test('a registered passkey excluded by the method policy is not ready for its strength', () => {
  const { snapshot, policy } = setup()
  snapshot.config.authStrengths.rows = [{ id: 'target', allowedCombinations: ['fido2'], combinationConfigurations: [] }]
  snapshot.registrationDetails[0].methodsRegistered = ['fido2SecurityKey']
  snapshot.authMethods['u-1'] = [{ kind: 'fido2', aaGuid: 'key' }]
  const configuration = (snapshot.config.authMethodsPolicy.rows[0] as any).authenticationMethodConfigurations[1]
  assert.deepEqual(methodPreparation([effectOf(policy)], ['u-1'], snapshot).readyIds, ['u-1'])
  configuration.excludeTargets = [{ id: 'all_users' }]
  assert.deepEqual(methodPreparation([effectOf(policy)], ['u-1'], snapshot).readyIds, [])
  configuration.excludeTargets = []
  configuration.state = 'disabled'
  assert.deepEqual(methodPreparation([effectOf(policy)], ['u-1'], snapshot).readyIds, [])
})

test('a model must satisfy both the method policy and the target strength on the same key', () => {
  const { snapshot, policy } = setup()
  snapshot.config.authStrengths.rows = [{ id: 'target', allowedCombinations: ['fido2'], combinationConfigurations: [{ '@odata.type': '#microsoft.graph.fido2CombinationConfiguration', appliesToCombinations: ['fido2'], allowedAAGUIDs: ['strength-key'] }] }]
  snapshot.registrationDetails[0].methodsRegistered = ['fido2SecurityKey']
  snapshot.authMethods['u-1'] = [{ kind: 'fido2', aaGuid: 'method-key' }, { kind: 'fido2', aaGuid: 'strength-key' }]
  const config = (snapshot.config.authMethodsPolicy.rows[0] as any).authenticationMethodConfigurations[1]
  config.keyRestrictions = { isEnforced: true, enforcementType: 'allow', aaGuids: ['method-key'] }
  assert.deepEqual(methodPreparation([effectOf(policy)], ['u-1'], snapshot).readyIds, [])
  config.keyRestrictions.aaGuids.push('strength-key')
  assert.deepEqual(methodPreparation([effectOf(policy)], ['u-1'], snapshot).readyIds, ['u-1'])
})

test('Authenticator targeting and unread memberships do not become usable registration', () => {
  const { snapshot, policy } = setup()
  const config = (snapshot.config.authMethodsPolicy.rows[0] as any).authenticationMethodConfigurations[0]
  config.includeTargets = [{ id: 'team', targetType: 'group' }]
  assert.deepEqual(methodPreparation([effectOf(policy)], ['u-1'], snapshot).unknownIds, ['u-1'])
  assert.deepEqual(methodPreparation([effectOf(policy)], ['u-1'], snapshot, { groupMembers: { team: [] } }).readyIds, [])
  assert.deepEqual(methodPreparation([effectOf(policy)], ['u-1'], snapshot, { groupMembers: { team: ['u-1'] } }).readyIds, ['u-1'])
})

test('scan-local readiness memo agrees across target scopes and a new derivation sees changed policy', () => {
  const { snapshot, policy } = setup()
  const effect = effectOf(policy)
  const context = {}
  const cache = createMethodPreparationCache(snapshot, context)
  const ids = snapshot.users.map(u => u.id)
  assert.deepEqual(methodPreparation([effect], ids, snapshot, context, cache), methodPreparation([effect], ids, snapshot, context))
  const narrow = effectOf({ ...policy, conditions: { ...policy.conditions, users: { includeUsers: ['u-2'] } } })
  assert.deepEqual(methodPreparation([narrow], ids, snapshot, context, cache), methodPreparation([narrow], ids, snapshot, context))
  const config = (snapshot.config.authMethodsPolicy.rows[0] as any).authenticationMethodConfigurations[0]
  config.excludeTargets = [{ id: 'all_users' }]
  ;(snapshot.config.authMethodsPolicy.rows[0] as any).policyMigrationState = 'migrationComplete'
  assert.deepEqual(methodPreparation([effect], ids, snapshot, context, createMethodPreparationCache(snapshot, context)).readyIds, [])
})
