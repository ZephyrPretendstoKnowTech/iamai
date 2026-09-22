import test from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { effectOf } from './operations.ts'
import { createMethodPreparationCache, methodPreparation, methodReadiness } from './methodReadiness.ts'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'

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

// Which people the denominator counts.
//
// One step printed "246 active people", "covers 283 enabled" and "209 of 279
// people" — three derivable totals, none explained. The readiness
// denominator is its own population: the people the target policies actually
// apply to, which is neither the step's active count nor its enabled count.
// The line said "people" and left the reader to work out which.
test('the readiness line says which population its denominator is', () => {
  let checked = 0
  for (const name of ['small', 'mid', 'large', 'midflight', 'messy'] as const) {
    for (const step of runFixture(fixture(name)).steps) {
      const line = step.readiness.lines[0]
      if (typeof line !== 'string' || !/[0-9]+ of [0-9]+ people/.test(line)) continue
      // The campaign step states its own cohort in its own words; this is the
      // policy steps' readiness line (methodReadiness.ts).
      if (!step.methodPreparation) continue
      checked++
      assert.match(line, /in scope of these policies/, `${name}/${step.id}: ${line}`)
      // And the count itself is unchanged: the population it counts is the
      // step's own methodPreparation, not a new one.
      const m = /([0-9]+) of ([0-9]+) people/.exec(line)!
      assert.equal(Number(m[2]), step.methodPreparation?.ids.length, `${name}/${step.id}: the denominator moved`)
      assert.equal(Number(m[1]), step.methodPreparation?.readyIds.length, `${name}/${step.id}: the numerator moved`)
    }
  }
  assert.ok(checked > 3, `only ${checked} steps printed a readiness reading`)
})

// Two readings that were sentences about nobody. "0 of 0 people in scope of
// these policies have a registered method" stood where there was nobody to
// count, and "None of the 1 person in scope could be judged" was the
// count-of-one rule applied to a sentence written for many.
test('nobody to count states no reading, and one person unjudged reads as one', () => {
  const nobody = methodReadiness('mfa', { ids: [], readyIds: [], unknownIds: [], completeScope: true })
  assert.deepEqual(nobody.lines, [])
  assert.equal(nobody.unmeasured, 'no-population')
  const one = methodReadiness('mfa', { ids: ['a'], readyIds: [], unknownIds: ['a'], completeScope: true })
  assert.deepEqual(one.lines, ['The one person in scope could not be judged: method compatibility is not established for them.'])
  const two = methodReadiness('mfa', { ids: ['a', 'b'], readyIds: [], unknownIds: ['a', 'b'], completeScope: true })
  assert.match(two.lines[0], /^None of the 2 people in scope could be judged/)
})
