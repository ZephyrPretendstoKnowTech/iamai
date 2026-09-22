import test from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { effectOf, validOperations } from './operations.ts'
import { policyVerdict } from './strand.ts'
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
      // "In scope of these policies" read as one number over two steps whose
      // policies include different people — 200 of 265 on one step, 209 of 279
      // on the next, both headed MFA readiness (R4-14, Marcus D4). The line names
      // the step's own policies, so two steps reading two numbers say why.
      assert.match(line, /people this step's policies include/, `${name}/${step.id}: ${line}`)
      assert.doesNotMatch(line, /these policies/, `${name}/${step.id}: ${line}`)
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

test('R4-42: on a generated plan, a step requiring the built-in MFA strength reads exactly what Require MFA would', () => {
  const f = fixture('large')
  const run = runFixture(f)
  // The group memberships the plan read, as the generator hands them on.
  const groupMembers: Record<string, string[]> = {}
  for (const [id, g] of run.input.groupMembers?.entries() ?? []) if (g.sampled !== true) groupMembers[id.toLowerCase()] = [...g.memberIds]
  let checked = 0
  for (const id of ['s-goal-admin-portals-protected', 's-goal-device-registration-mfa']) {
    const step = run.steps.find((s) => s.id === id)!
    const body = validOperations(step.action).map((o) => (o.mode === 'update' ? o.target : o.body) as Record<string, unknown>)
    assert.equal(body.length, 1, `${id}: the premise is one policy`)
    const grant = body[0].grantControls as { authenticationStrength?: { id?: string } }
    assert.equal(grant.authenticationStrength?.id, '00000000-0000-0000-0000-000000000002', `${id}: the premise is the built-in MFA strength`)
    const people = run.viability.map((v) => v.userId)
    const asGrant = methodPreparation([effectOf({ ...body[0], grantControls: { operator: 'OR', builtInControls: ['mfa'] } })], people, f.snapshot, { groupMembers })
    const asStrength = methodPreparation([effectOf(body[0])], people, f.snapshot, { groupMembers })
    assert.deepEqual(asStrength, asGrant, `${id}: one registration, two answers`)
    assert.equal(step.methodPreparation?.unknownIds.length, 0, `${id}: ${step.readiness.lines[0]}`)
    assert.equal(step.readiness.atLeast, undefined, `${id}: a floor where Require MFA reads a number`)
    checked++
  }
  assert.equal(checked, 2)
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

// The same clause was lost on the second step reading the same people: the
// answer is shared across steps in one scan (createMethodPreparationCache) and
// only the step that computed it recorded why. Device registration read "not
// yet established for 38" beside Admin Portals' "— 13 of those were confirmed
// by a sign-in that is now older than 30 days", over the same people.
test('R4-15: two steps reading the same people from one scan name the same aged-out sign-ins', () => {
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
})
