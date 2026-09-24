import test from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { effectOf } from './operations.ts'
import { policyVerdict } from './strand.ts'
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

  // An eligible administrator is prepared for activation without changing active role scope.
  const eligible = setup()
  eligible.snapshot.roles = { active: {}, eligible: { 'u-2': ['admin-role'] } }
  const effect = effectOf({ ...eligible.policy, conditions: { ...eligible.policy.conditions, users: { includeRoles: ['admin-role'] } } })
  assert.deepEqual(methodPreparation([effect], eligible.snapshot.users.map(u => u.id), eligible.snapshot).ids, ['u-2'])
  assert.deepEqual(eligible.snapshot.roles.active, {})

  // Quiet accounts do not need fresh sign-in proof for registration preparation.
  const quiet = setup()
  quiet.snapshot.sources.signInEvidence.status = 'error'
  assert.deepEqual(methodPreparation([effectOf(quiet.policy)], ['u-1'], quiet.snapshot).readyIds, ['u-1'])
})

test('missing strength and unresolved group cannot become a passing number', () => {
  const { snapshot, policy } = setup()
  snapshot.config.authStrengths.rows = []
  assert.equal(methodReadiness('mfa', methodPreparation([effectOf(policy)], ['u-1'], snapshot)).unmeasured, 'unreadable')
  const group = effectOf({ ...policy, conditions: { ...policy.conditions, users: { includeGroups: ['unread'] } } })
  assert.equal(methodPreparation([group], ['u-1'], snapshot).completeScope, false)
})

test('a passkey counts only where the strength, the method policy and the permitted model all accept the same key', () => {
  // A restricted FIDO2 combination requires a key with the permitted model.
  {
    const { snapshot, policy } = setup()
    snapshot.config.authStrengths.rows = [{ id: 'target', allowedCombinations: ['fido2'], combinationConfigurations: [{ '@odata.type': '#microsoft.graph.fido2CombinationConfiguration', appliesToCombinations: ['fido2'], allowedAAGUIDs: ['approved-model'] }] }]
    snapshot.registrationDetails[0].methodsRegistered = ['fido2SecurityKey']
    snapshot.authMethods['u-1'] = [{ kind: 'fido2', aaGuid: 'different-model' }]
    assert.deepEqual(methodPreparation([effectOf(policy)], ['u-1'], snapshot).readyIds, [])
    snapshot.authMethods['u-1'] = [{ kind: 'fido2', aaGuid: 'approved-model' }]
    assert.deepEqual(methodPreparation([effectOf(policy)], ['u-1'], snapshot).readyIds, ['u-1'])
  }
  // A registered passkey excluded by the method policy is not ready for its strength.
  {
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
  }
  // A model must satisfy both the method policy and the target strength on the same key.
  {
    const { snapshot, policy } = setup()
    snapshot.config.authStrengths.rows = [{ id: 'target', allowedCombinations: ['fido2'], combinationConfigurations: [{ '@odata.type': '#microsoft.graph.fido2CombinationConfiguration', appliesToCombinations: ['fido2'], allowedAAGUIDs: ['strength-key'] }] }]
    snapshot.registrationDetails[0].methodsRegistered = ['fido2SecurityKey']
    snapshot.authMethods['u-1'] = [{ kind: 'fido2', aaGuid: 'method-key' }, { kind: 'fido2', aaGuid: 'strength-key' }]
    const config = (snapshot.config.authMethodsPolicy.rows[0] as any).authenticationMethodConfigurations[1]
    config.keyRestrictions = { isEnforced: true, enforcementType: 'allow', aaGuids: ['method-key'] }
    assert.deepEqual(methodPreparation([effectOf(policy)], ['u-1'], snapshot).readyIds, [])
    config.keyRestrictions.aaGuids.push('strength-key')
    assert.deepEqual(methodPreparation([effectOf(policy)], ['u-1'], snapshot).readyIds, ['u-1'])
  }
})

test('Authenticator targeting and unread memberships do not become usable registration', () => {
  const { snapshot, policy } = setup()
  const config = (snapshot.config.authMethodsPolicy.rows[0] as any).authenticationMethodConfigurations[0]
  config.includeTargets = [{ id: 'team', targetType: 'group' }]
  assert.deepEqual(methodPreparation([effectOf(policy)], ['u-1'], snapshot).unknownIds, ['u-1'])
  assert.deepEqual(methodPreparation([effectOf(policy)], ['u-1'], snapshot, { groupMembers: { team: [] } }).readyIds, [])
  assert.deepEqual(methodPreparation([effectOf(policy)], ['u-1'], snapshot, { groupMembers: { team: ['u-1'] } }).readyIds, ['u-1'])
})

test('scan-local readiness memo agrees across target scopes, keeps the aged-out reason for every step, and a new derivation sees changed policy', () => {
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

  // R4-15: the answer is shared across steps in one scan, and only the step that
  // computed it used to record why. Two steps reading the same people from one
  // scan name the same aged-out sign-ins.
  {
    const { snapshot } = setup()
    ;(snapshot.config.authMethodsPolicy.rows[0] as any).authenticationMethodConfigurations[0].includeTargets = [{ id: 'team', targetType: 'group' }]
    const old = new Date(Date.parse(snapshot.asOf) - 60 * 86_400_000).toISOString()
    snapshot.signInEvidence['u-1'] = { ...snapshot.signInEvidence['u-1'], proofs: [{ cls: 'authenticator', os: 'Windows', at: old, method: 'Mobile app notification' }] } as never
    const requireMfa = (users: string[]) => effectOf({ state: 'enabled', conditions: { users: { includeUsers: users }, applications: { includeApplications: ['All'] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } })
    const ids = snapshot.users.map(u => u.id)
    const cache = createMethodPreparationCache(snapshot, {})
    const first = methodPreparation([requireMfa(['u-1', 'u-2'])], ids, snapshot, {}, cache)
    const second = methodPreparation([requireMfa(['u-1', 'u-3'])], ids, snapshot, {}, cache)
    assert.deepEqual(first.staleIds, ['u-1'], 'the premise: u-1 is unknown only because the sign-in aged out')
    assert.deepEqual(second.staleIds, first.staleIds, 'the second step lost the reason')
    assert.deepEqual(second, methodPreparation([requireMfa(['u-1', 'u-3'])], ids, snapshot, {}), 'the shared answer differs from a fresh one')
  }
})

// R4-42 (Sam D8), R4-15 (Marcus D5). One registration was judged two ways.
// Require MFA read a person with no accepted method as not ready; Microsoft's
// built-in Multifactor authentication strength — the same grant, stated as a
// strength — read the same person as "not established", because it carries
// federated combinations nothing in the registration report speaks to. On one
// tenant 1,293 people were not ready on Require MFA for All Users and "not yet
// established" on the two steps beside it; on another, 38 people whose only
// method (text) the tenant had switched off were called unknowable, and the
// line told the admin to have them sign in with it. The strength is now read as
// the grant it is (operations.ts effectOf), so every step gives one answer.
test('R4-42: the built-in Multifactor authentication strength judges every person exactly as Require MFA does', () => {
  const { snapshot } = setup()
  const methods = snapshot.config.authMethodsPolicy.rows[0] as any
  methods.policyMigrationState = 'migrationComplete'
  methods.authenticationMethodConfigurations.push(
    { id: 'Sms', state: 'disabled', includeTargets: [], excludeTargets: [] },
    { id: 'Voice', state: 'disabled', includeTargets: [], excludeTargets: [] },
  )
  const shape: Record<string, { methods: string[]; capable: boolean }> = {
    'u-1': { methods: [], capable: false },
    'u-2': { methods: ['mobilePhone'], capable: false },
    'u-3': { methods: ['microsoftAuthenticatorPush'], capable: true },
  }
  for (const r of snapshot.registrationDetails) if (shape[r.id]) Object.assign(r, { methodsRegistered: shape[r.id].methods, isMfaCapable: shape[r.id].capable, isMfaRegistered: shape[r.id].capable })
  const scope = { users: { includeUsers: ['u-1', 'u-2', 'u-3'] }, applications: { includeApplications: ['All'] } }
  const grant = effectOf({ state: 'enabled', conditions: scope, grantControls: { operator: 'OR', builtInControls: ['mfa'] } })
  const strength = effectOf({ state: 'enabled', conditions: scope, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000002' } } })
  assert.deepEqual(strength.requirements, [{ kind: 'mfa' }], 'the built-in MFA strength is read as the grant it is')
  assert.deepEqual(strength.strength, { id: '00000000-0000-0000-0000-000000000002' }, 'and the policy still names the strength it names')
  const ids = Object.keys(shape)
  const byGrant = methodPreparation([grant], ids, snapshot)
  const byStrength = methodPreparation([strength], ids, snapshot)
  assert.deepEqual(byStrength, byGrant, 'the same people, two answers')
  assert.deepEqual(byStrength.readyIds, ['u-3'])
  assert.deepEqual(byStrength.unknownIds, [], 'nothing registered, or only a method the tenant switched off, is not "not established"')
  // And the lockout reading: one verdict per person whichever grant the policy uses.
  for (const id of ids) assert.deepEqual(policyVerdict(strength, id, snapshot, {}), policyVerdict(grant, id, snapshot, {}), id)
  // A tenant's own strength is still judged combination by combination.
  assert.deepEqual(effectOf({ state: 'enabled', conditions: scope, grantControls: { operator: 'OR', authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } } }).requirements, [{ kind: 'strength', id: '00000000-0000-0000-0000-000000000004' }])
})

// R4-15 (Marcus D5). "13 of those were confirmed by a sign-in that is now older
// than 30 days, so nothing about them has changed: ask them to sign in once with
// that method and the next scan counts them again." Their old sign-ins were text
// messages, against a strength only a passkey, Windows Hello or certificate
// sign-in settles: the admin did as told, and the next scan counted nobody. The
// clause is said only where the same sign-in, made today, would count the person
// — the one rule a fresh sign-in is read by.
test('R4-15: an aged-out sign-in is named only where the same sign-in made today would count the person', () => {
  const { snapshot, policy } = setup()
  // Settled by a passkey alone, or by a password and Authenticator push.
  snapshot.config.authStrengths.rows = [{ id: 'target', allowedCombinations: ['fido2', 'password,microsoftAuthenticatorPush'], combinationConfigurations: [] }]
  // Authenticator is on for a group the scan could not open, so u-1's registration cannot settle it.
  ;(snapshot.config.authMethodsPolicy.rows[0] as any).authenticationMethodConfigurations[0].includeTargets = [{ id: 'team', targetType: 'group' }]
  const old = new Date(Date.parse(snapshot.asOf) - 60 * 86_400_000).toISOString()
  // u-2 is judged ready (a passkey sign-in this week), so the line is a reading.
  snapshot.signInEvidence['u-2'] = { ...snapshot.signInEvidence['u-2'], proofs: [{ cls: 'passkey', os: 'Windows', at: snapshot.asOf, method: 'passkey' }] } as never
  const signedIn = (cls: string, at: string) => {
    snapshot.signInEvidence['u-1'] = { ...snapshot.signInEvidence['u-1'], proofs: [{ cls, os: 'Windows', at, method: cls }] } as never
    return methodPreparation([effectOf(policy)], ['u-1', 'u-2'], snapshot)
  }
  // A text-message sign-in settles nothing here, fresh or old.
  const text = signedIn('phone', old)
  assert.deepEqual(text.unknownIds, ['u-1'], 'the premise: u-1 cannot be judged')
  assert.deepEqual(text.staleIds, [], 'an old sign-in that could never count is called the reason')
  assert.doesNotMatch(methodReadiness('mfa', text).lines[0], /sign in once/, 'the line promises a number that will not move')
  assert.deepEqual(signedIn('phone', snapshot.asOf).readyIds, ['u-2'], 'the premise: made today, it would not count either')
  // An old passkey sign-in would: said, and true.
  const passkey = signedIn('passkey', old)
  assert.deepEqual(passkey.staleIds, ['u-1'])
  assert.match(methodReadiness('mfa', passkey).lines[0], /confirmed by a sign-in that is now older than 30 days/)
  assert.deepEqual(signedIn('passkey', snapshot.asOf).readyIds, ['u-1', 'u-2'], 'and made today, it counts them: the promise is kept')
})

// R4-41 (Sam D7), the residual the challenger kept, and R4-15 (Marcus D5). 669 of
// 4,900 people held a phone and nothing else; the tenant's Authentication methods
// policy switches text and voice off; the gate read "4231 of 4900 people in scope
// of these policies have a registered method the policies allow". Sam knew
// Require MFA accepts a phone and took the number for a measurement error. On
// Marcus's tenant 38 people whose only method was text were called unknowable.
// The engine told "registered only what the tenant does not allow" from
// "registered nothing" and dropped the difference before the line, and "the
// policies" named the wrong authority: the Conditional Access policy accepts a
// phone; the methods policy stops it.
test('R4-41: people who registered only methods the tenant does not allow are counted, and named, apart from people who registered nothing', () => {
  const { snapshot } = setup()
  const methods = snapshot.config.authMethodsPolicy.rows[0] as any
  methods.policyMigrationState = 'migrationComplete'
  methods.authenticationMethodConfigurations.push(
    { id: 'Sms', state: 'disabled', includeTargets: [], excludeTargets: [] },
    { id: 'Voice', state: 'disabled', includeTargets: [], excludeTargets: [] },
  )
  // u-1 Authenticator; u-2 a phone and nothing else; u-3 nothing; u-4 a passkey
  // the registration report names and no key on record, which is a missing key,
  // not a setting, and is never put down to the tenant.
  const shape: Record<string, { methods: string[]; capable: boolean }> = {
    'u-1': { methods: ['microsoftAuthenticatorPush'], capable: true },
    'u-2': { methods: ['mobilePhone'], capable: false },
    'u-3': { methods: [], capable: false },
    'u-4': { methods: ['fido2SecurityKey'], capable: true },
  }
  for (const r of snapshot.registrationDetails) if (shape[r.id]) Object.assign(r, { methodsRegistered: shape[r.id].methods, isMfaCapable: shape[r.id].capable, isMfaRegistered: shape[r.id].capable })
  snapshot.authMethods['u-4'] = []
  const ids = Object.keys(shape)
  const scope = { users: { includeUsers: ids }, applications: { includeApplications: ['All'] } }
  const requireMfa = effectOf({ state: 'enabled', conditions: scope, grantControls: { operator: 'OR', builtInControls: ['mfa'] } })
  const reading = methodPreparation([requireMfa], ids, snapshot)
  assert.deepEqual(reading.readyIds, ['u-1'])
  assert.deepEqual(reading.unknownIds, [], 'a method the tenant does not allow is known, not "not established"')
  assert.deepEqual(reading.offIds, ['u-2'], 'a phone the tenant switched off, told apart from nothing registered and from a key not on record')
  const line = methodReadiness('mfa', reading).lines[0]
  assert.match(line, /^1 of 4 people this step's policies include has a registered method those policies accept and this tenant lets them use\. /, line)
  // The sentence states the counterfactual it counts (the R4-41 review below):
  // it said "has registered only methods ... does not let them use", which is
  // true of people the step's own policy refuses as well.
  assert.match(line, /\. 1 of the 3 people without one would be counted if this tenant's Authentication methods policy allowed the methods they registered\.$/, line)
  assert.doesNotMatch(line, /the policies allow/, 'the line names the Conditional Access policy as what stopped them')

  // Marcus's steps required Microsoft's built-in MFA strength: the same people, the same words.
  const strength = effectOf({ state: 'enabled', conditions: scope, grantControls: { operator: 'OR', authenticationStrength: { id: '00000000-0000-0000-0000-000000000002' } } })
  assert.deepEqual(methodPreparation([strength], ids, snapshot), reading)

  // Where every person it did not count is one of them, it says so without "1 of the 1".
  const two = methodPreparation([requireMfa], ['u-1', 'u-2'], snapshot)
  assert.equal(methodReadiness('mfa', two).lines[0].split('. ')[1], "The 1 person without one would be counted if this tenant's Authentication methods policy allowed the methods they registered.")

  // A key on record that the passkey settings exclude is the tenant's doing.
  snapshot.authMethods['u-4'] = [{ kind: 'fido2', aaGuid: 'key' }]
  methods.authenticationMethodConfigurations[1].excludeTargets = [{ id: 'all_users' }]
  assert.deepEqual(methodPreparation([requireMfa], ids, snapshot).offIds, ['u-2', 'u-4'])
  methods.authenticationMethodConfigurations[1].excludeTargets = []

  // Before the methods policy has migrated, the legacy MFA and SSPR settings can
  // still turn text on: the scan cannot say, and does not.
  methods.policyMigrationState = 'migrationInProgress'
  const legacy = methodPreparation([requireMfa], ids, snapshot)
  assert.deepEqual(legacy.offIds, [])
  assert.doesNotMatch(methodReadiness('mfa', legacy).lines[0], /Authentication methods policy/)
})

// R4-41, the review of the fix above. On the phishing-resistant administrator
// step of a tenant that switches text and voice off, the tile read "5 of the 48
// people without one have registered only methods this tenant's Authentication
// methods policy does not let them use". All five held only a phone. A
// phishing-resistant strength refuses a phone whatever the methods policy says:
// the sentence named the wrong obstacle, and the one change it invites — text
// back on for administrators — weakens the tenant and counts nobody. offIds
// counted everyone whose methods the methods policy refuses, and never asked
// whether the step's own policy would take those methods if it did not.
test('R4-41: the methods policy is named only where the policies that refused a person would accept what they registered', () => {
  const { snapshot } = setup()
  const methods = snapshot.config.authMethodsPolicy.rows[0] as any
  methods.policyMigrationState = 'migrationComplete'
  methods.authenticationMethodConfigurations.push(
    { id: 'Sms', state: 'disabled', includeTargets: [], excludeTargets: [] },
    { id: 'Voice', state: 'disabled', includeTargets: [], excludeTargets: [] },
  )
  // u-1 and u-2 hold a phone and nothing else; u-3 a passkey with its key on
  // record, which the passkey settings exclude.
  const shape: Record<string, string[]> = { 'u-1': ['mobilePhone'], 'u-2': ['mobilePhone'], 'u-3': ['fido2SecurityKey'] }
  for (const r of snapshot.registrationDetails) if (shape[r.id]) Object.assign(r, { methodsRegistered: shape[r.id], isMfaCapable: false, isMfaRegistered: false })
  snapshot.authMethods['u-3'] = [{ kind: 'fido2', aaGuid: 'key' }]
  methods.authenticationMethodConfigurations[1].excludeTargets = [{ id: 'all_users' }]
  const policy = (users: string[], grantControls: Record<string, unknown>) => effectOf({ state: 'enabled', conditions: { users: { includeUsers: users }, applications: { includeApplications: ['All'] } }, grantControls })
  const phishingResistant = (users: string[]) => policy(users, { operator: 'OR', authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } })

  const admins = methodPreparation([phishingResistant(['u-1', 'u-3'])], ['u-1', 'u-3'], snapshot)
  assert.deepEqual(admins.readyIds, [], 'the premise: neither is ready')
  assert.deepEqual(admins.offIds, ['u-3'], 'the strength refuses a phone either way; only the passkey is held back by the methods policy alone')
  assert.match(methodReadiness('admin', admins).lines[0], /\. 1 of the 2 people without one would be counted if this tenant's Authentication methods policy allowed the methods they registered\.$/)

  const phoneOnly = methodPreparation([phishingResistant(['u-1'])], ['u-1'], snapshot)
  assert.deepEqual(phoneOnly.offIds, [], 'a phone-only administrator on a phishing-resistant step')
  assert.doesNotMatch(methodReadiness('admin', phoneOnly).lines[0], /Authentication methods policy/, 'no sentence that invites switching text back on for administrators')

  // One step, two policies: Require MFA for both, the strength for u-1 as well.
  // Text back on would count u-2 and not u-1, whom the strength still refuses.
  const both = methodPreparation([policy(['u-1', 'u-2'], { operator: 'OR', builtInControls: ['mfa'] }), phishingResistant(['u-1'])], ['u-1', 'u-2'], snapshot)
  assert.deepEqual(both.offIds, ['u-2'])
})
