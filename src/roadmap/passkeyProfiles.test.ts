import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { PASSKEY_TARGET_AAGUIDS, passkeyFindingsOf, passkeyReadingOf, resolvePasskeyTarget } from './passkeySettings.ts'
import { affectedPasskeysByProposedChange, emergencyPasskeyCompatibility, emergencyProposedPasskeyCompatibility } from './passkeyCompatibility.ts'
import { collectConfigSection } from '../graph/collect/collectors.ts'
import { journeyPasskeyFindings } from './emergencyJourney.ts'

const HARDWARE = 'cb69481e-8ff7-4039-93ec-0a2729a154a8'
const profile = (id: string, aaGuids: string[] = [...PASSKEY_TARGET_AAGUIDS]) => ({ id, name: id, passkeyTypes: 'deviceBound', attestationEnforcement: 'registrationOnly', keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids } })
const policy = () => ({ id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true, defaultPasskeyProfile: 'authenticator', includeTargets: [{ id: 'all_users', targetType: 'group', allowedPasskeyProfiles: ['authenticator', 'hardware'] }], excludeTargets: [] as { id: string }[], passkeyProfiles: [profile('authenticator'), profile('hardware', [HARDWARE])] })
function scan(current: unknown) {
  const snapshot = structuredClone(fixture('demo').snapshot)
  snapshot.config.authMethodsPolicy = { status: 'ok', reason: null, rows: [{ authenticationMethodConfigurations: [current] }] }
  return snapshot
}

test('single unrestricted device-bound profile is collected accurately and already matches the plan, which adds no allow list (owner, 2026-10-03)', async () => {
  const profileId = '00000000-0000-0000-0000-000000000001'
  const current = {
    id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true,
    isAttestationEnforced: false,
    keyRestrictions: { isEnforced: false, enforcementType: 'block', aaGuids: [] },
    includeTargets: [{ targetType: 'group', id: 'all_users', allowedPasskeyProfiles: [profileId] }],
    excludeTargets: [],
    passkeyProfiles: [{
      id: profileId, name: 'Default passkey profile', passkeyTypes: 'deviceBound',
      attestationEnforcement: 'registrationOnly',
      keyRestrictions: { isEnforced: false, enforcementType: 'allow', aaGuids: [HARDWARE] },
    }],
  }
  const original = structuredClone(current)
  const f = structuredClone(fixture('demo-week2'))
  f.mapping.passkeyApprovedModels = [{ name: 'Additional approved key', aaguid: HARDWARE }]
  const before = globalThis.fetch
  globalThis.fetch = async input => {
    const url = String(input)
    const body = url.includes('/authenticationMethodConfigurations/Fido2')
      ? current
      : { policyMigrationState: 'migrationComplete', authenticationMethodConfigurations: [{
        ...current, passkeyProfiles: [{ ...current.passkeyProfiles[0], passkeyTypes: 'deviceBound,synced' }],
      }] }
    return new Response(JSON.stringify(body), { status: 200 })
  }
  try {
    f.snapshot.config.authMethodsPolicy = await collectConfigSection({
      tokens: { get: () => 'synthetic', refresh: async () => 'synthetic' },
      signal: new AbortController().signal,
    }, 'authMethodsPolicy')
  } finally { globalThis.fetch = before }
  // Methods exercise both affected and unaffected outcomes, not an empty population.
  f.snapshot.authMethods = Object.fromEntries(f.snapshot.users.map(user => [user.id, []]))
  const [a, b] = f.mapping.breakGlassUserIds
  f.snapshot.authMethods[a] = [{ kind: 'fido2', id: 'approved-key', aaGuid: HARDWARE, passkeyType: 'deviceBound', attestationLevel: 'attested' }]
  f.snapshot.authMethods[b] = [{ kind: 'fido2', id: 'unapproved-key', aaGuid: '11111111-2222-4333-8444-555555555555', passkeyType: 'deviceBound', attestationLevel: 'attested' }]
  const reading = passkeyReadingOf(f.snapshot, f.mapping)
  assert.equal(reading.state, 'inPlace', 'device-bound and attested already: nothing to change, not unread evidence')
  assert.equal(reading.resolution?.kind, 'target')
  if (reading.resolution?.kind === 'target') {
    const profiles = reading.resolution.target.passkeyProfiles as typeof current.passkeyProfiles
    assert.deepEqual(profiles[0].keyRestrictions, current.passkeyProfiles[0].keyRestrictions, 'the tenant\'s key restrictions are kept as they are')
  }
  const findings = passkeyFindingsOf(f.snapshot, f.mapping)
  assert.ok(findings.some(row => row.value === 'Device-bound only'))
  assert.ok(findings.some(row => row.value === 'Required' && row.key.endsWith('.attestation')))
  assert.equal(findings.some(row => row.value === 'Synced passkeys allowed' || row.outcome === 'unknown'), false)
  const impact = affectedPasskeysByProposedChange(f.snapshot, f.mapping, f.groups)
  assert.equal(impact.state, 'known')
  assert.deepEqual(impact.users.map(row => row.accountId), [], 'an attested device-bound key of any model keeps working: no allow list stops it')
  const tiles = journeyPasskeyFindings(f.snapshot, f.mapping, f.groups)
  assert.equal(tiles.some(row => row.outcome === 'unknown'), false)
  assert.deepEqual(current, original, 'proposal must not mutate observed tenant settings')
  // The live API can retain both type flags while the portal shows Device-bound,
  // and no portal action changes the stored value. Synced passkeys cannot be
  // attested, so with attestation enforced the outcome is device-bound
  // registration: storage passes and no change to the flag is proposed.
  const observed = structuredClone(current)
  observed.passkeyProfiles[0].passkeyTypes = 'deviceBound,synced'
  const observedSnapshot = scan(observed)
  const storage = passkeyFindingsOf(observedSnapshot).find(row => row.key.endsWith('.types'))!
  assert.equal(storage.value, 'Device-bound registration only')
  assert.equal(storage.outcome, 'pass')
  const resolution = passkeyReadingOf(observedSnapshot).resolution
  assert.equal(resolution?.kind, 'target')
  if (resolution?.kind === 'target') assert.equal((resolution.target.passkeyProfiles as any[])[0].passkeyTypes, 'deviceBound,synced')
  // An existing synced key is still judged per account: it is not an approved emergency passkey.
  const syncedId = observedSnapshot.users[0].id
  observedSnapshot.authMethods = Object.fromEntries(observedSnapshot.users.map(user => [user.id, []]))
  observedSnapshot.authMethods[syncedId] = [{ kind: 'fido2', id: 'existing-synced', aaGuid: PASSKEY_TARGET_AAGUIDS[0], passkeyType: 'synced', attestationLevel: 'notAttested' }]
  assert.notEqual(emergencyPasskeyCompatibility(observedSnapshot, [syncedId])[0].state, 'eligible',
    'an unattested synced key is not an approved emergency passkey')
})

test('assigned attested device-bound profiles jointly support Authenticator and retained hardware; a second permissive applicable profile prevents completion, an unassigned one does not', () => {
  const current = policy()
  const snapshot = scan(current)
  assert.equal(passkeyReadingOf(snapshot).state, 'inPlace')
  assert.ok(passkeyFindingsOf(snapshot).every(f => f.outcome === 'pass'))
  const resolved = resolvePasskeyTarget(current)
  assert.equal(resolved.kind, 'target')
  if (resolved.kind === 'target') assert.deepEqual(resolved.target.passkeyProfiles, current.passkeyProfiles)

  // A second permissive applicable profile prevents completion; an unassigned one does not.
  {
    const current = policy()
    current.passkeyProfiles.push({ ...profile('permissive'), passkeyTypes: 'deviceBound,synced', attestationEnforcement: 'disabled', keyRestrictions: { isEnforced: false, enforcementType: 'allow', aaGuids: [] } })
    assert.equal(passkeyReadingOf(scan(current)).state, 'inPlace')
    current.includeTargets[0].allowedPasskeyProfiles.push('permissive')
    const snapshot = scan(current)
    assert.equal(passkeyReadingOf(snapshot).state, 'review')
    assert.ok(passkeyFindingsOf(snapshot).some(f => f.value === 'Synced passkeys allowed' && f.outcome === 'fail'))
    assert.ok(passkeyFindingsOf(snapshot).some(f => f.key === 'profile.permissive.attestation' && f.outcome === 'fail'))
  }
})

test('findings stay concrete: missing relationships and models are distinct, a disabled method stays disabled, and a failed dedicated read keeps its reason and never reads as disabled or complete', () => {
  const current = policy()
  // The tenant's allow list is its own: one without the default models is kept and passes.
  current.passkeyProfiles[0].keyRestrictions.aaGuids = [PASSKEY_TARGET_AAGUIDS[0]]
  assert.ok(passkeyFindingsOf(scan(current)).some(f => f.value === 'Allow list kept' && f.outcome === 'pass'))
  assert.equal(passkeyFindingsOf(scan(current)).some(f => f.value === 'AAGUID missing'), false)
  current.passkeyProfiles = []
  assert.equal(passkeyReadingOf(scan(current)).state, 'review')
  assert.ok(passkeyFindingsOf(scan(current)).some(f => f.label === 'Passkey Profiles' && f.outcome === 'unknown'))

  // Disabled method and registration remain concrete while profile details are incomplete.
  {
    const current = policy()
    current.state = 'disabled'
    current.isSelfServiceRegistrationAllowed = false
    current.passkeyProfiles = []
    const findings = passkeyFindingsOf(scan(current))
    assert.ok(findings.some(f => f.key === 'method' && f.value === 'Disabled'))
    assert.ok(findings.some(f => f.key === 'selfService' && f.value === 'Self-service disabled'))
    assert.ok(findings.some(f => f.outcome === 'unknown'))
  }

  // Failed dedicated read preserves its reason and cannot become disabled or complete.
  {
    const snapshot = scan(policy())
    snapshot.config.authMethodsPolicy.fido2Read = { status: 'error', reason: 'Policy.Read.AuthenticationMethod was not granted', httpStatus: 403 }
    assert.equal(passkeyReadingOf(snapshot).state, 'unread')
    assert.equal(passkeyFindingsOf(snapshot)[0].outcome, 'unknown')
    assert.match(passkeyFindingsOf(snapshot)[0].detail, /Policy.Read.AuthenticationMethod/)
    assert.ok(snapshot.config.authMethodsPolicy.rows.length, 'the parent response remains available with provenance')
  }
})

test('profile compatibility follows per-account assignments and exclusions, not a tenant-wide union, and an unknown key type is never claimed compatible', () => {
  const current = policy()
  current.includeTargets = [{ id: 'hardware-users', targetType: 'group', allowedPasskeyProfiles: ['hardware'] }, { id: 'other-users', targetType: 'group', allowedPasskeyProfiles: ['authenticator'] }]
  const snapshot = scan(current)
  snapshot.authMethods = { emergency: [{ kind: 'fido2', aaGuid: HARDWARE, passkeyType: 'deviceBound', attestationLevel: 'attested' }] }
  const groups = new Map([['hardware-users', { memberIds: ['emergency'], memberCount: 1, sampled: false }], ['other-users', { memberIds: [], memberCount: 0, sampled: false }]])
  assert.equal(emergencyPasskeyCompatibility(snapshot, ['emergency'], groups)[0].state, 'eligible')
  current.excludeTargets = [{ id: 'hardware-users' }]
  assert.equal(emergencyPasskeyCompatibility(scan(current), ['emergency'], groups)[0].state, 'excluded')
  current.excludeTargets = []
  current.includeTargets[0].allowedPasskeyProfiles = ['authenticator']
  const changed = scan(current); changed.authMethods = snapshot.authMethods
  assert.equal(emergencyPasskeyCompatibility(changed, ['emergency'], groups)[0].state, 'review')

  // Unknown registered key type cannot be claimed compatible with a device-bound profile.
  {
    const snapshot = scan(policy())
    snapshot.authMethods = { emergency: [{ kind: 'fido2', aaGuid: HARDWARE }] }
    assert.equal(emergencyPasskeyCompatibility(snapshot, ['emergency'])[0].state, 'unknown')
  }
})

test('a saved extra model no longer shapes the passkey settings, and attestation is still checked (owner, 2026-10-03)', () => {
  const mapping = { ...fixture('demo').mapping, passkeyApprovedModels: [{name: 'Approved extra', aaguid: '11111111-1111-4111-8111-111111111111'}] }
  assert.equal(passkeyReadingOf(scan(policy()), mapping).state, 'inPlace', 'an extra model is not added to any list')
  const current = policy()
  current.passkeyProfiles[0].attestationEnforcement = 'disabled'
  assert.notEqual(passkeyReadingOf(scan(current), mapping).state, 'inPlace')
})

test('a proposed change stays unknown where it is incompletely described, and an attestation-only approval change claims no existing passkey loses runtime access', () => {
  const current: any = policy()
  current.passkeyProfiles = []
  delete (current as Partial<typeof current>).defaultPasskeyProfile
  current.passkeyTypes = 'deviceBound,synced'
  current.attestationEnforcement = 'disabled'
  current.isAttestationEnforced = false
  current.keyRestrictions = {isEnforced:false,enforcementType:'allow',aaGuids:[]}
  current.includeTargets = [{ id: 'all_users', targetType: 'group' }]
  const snapshot = scan(current)
  snapshot.authMethods = { emergency: [{kind:'passkey', aaGuid:PASSKEY_TARGET_AAGUIDS[0],passkeyType:'synced',attestationLevel:'attested'}] }
  assert.equal(emergencyPasskeyCompatibility(snapshot,['emergency'])[0].state,'eligible')
  assert.equal(emergencyProposedPasskeyCompatibility(snapshot,['emergency'], fixture('demo').mapping)[0].state,'unknown')
  snapshot.authMethods.emergency = [{kind:'fido2',aaGuid:PASSKEY_TARGET_AAGUIDS[0],passkeyType:'deviceBound',attestationLevel:'attested'}]
  assert.equal(emergencyProposedPasskeyCompatibility(snapshot,['emergency'], fixture('demo').mapping)[0].state,'unknown')

  // An attestation-only approval change does not claim an existing passkey loses runtime access.
  {
    const current: any = policy()
    current.passkeyProfiles = current.passkeyProfiles.map((row: any) => ({ ...row, attestationEnforcement: 'disabled' }))
    const snapshot = scan(current)
    const id = snapshot.users[0].id
    snapshot.authMethods[id] = [{ kind: 'fido2', id: 'existing-key', aaGuid: HARDWARE, passkeyType: 'deviceBound', attestationLevel: 'notAttested' }]
    const mapping = fixture('demo').mapping
    assert.notEqual(emergencyProposedPasskeyCompatibility(snapshot, [id], mapping)[0].state, 'eligible')
    assert.deepEqual(affectedPasskeysByProposedChange(snapshot, mapping).users, [])
  }
})

test('an unambiguous assigned profile mismatch produces an executable per-profile proposal', () => {
  const current = policy()
  current.includeTargets = [{ id: 'all_users', targetType: 'group', allowedPasskeyProfiles: ['authenticator'] }]
  current.passkeyProfiles = [{ ...profile('authenticator', [PASSKEY_TARGET_AAGUIDS[0]]), passkeyTypes: 'deviceBound,synced', attestationEnforcement: 'disabled' }]
  const reading = passkeyReadingOf(scan(current))
  assert.equal(reading.state, 'partial')
  assert.equal(reading.resolution?.kind, 'target')
  if (reading.resolution?.kind === 'target') {
    const proposed = (reading.resolution.target.passkeyProfiles as any[])[0]
    // Enforcing attestation already limits registration to device-bound passkeys; the stored flag is kept.
    assert.equal(proposed.passkeyTypes, 'deviceBound,synced')
    assert.equal(proposed.attestationEnforcement, 'registrationOnly')
    assert.deepEqual(proposed.keyRestrictions, current.passkeyProfiles[0].keyRestrictions, 'the tenant\'s key restrictions are kept as they are')
    assert.ok(reading.differs.includes('passkeyProfiles'))
  }
})

test('a passkey the scan cannot judge is reported as unjudged, never folded into "none affected"', () => {
  // `users` is the accounts a proposed change provably breaks. Accounts holding
  // a passkey the scan could not assess were counted into neither list, and the
  // step read the empty `users` as an all-clear: "No existing passkey is
  // affected by the planned settings" — four lines under its own tile saying
  // "Existing passkeys affected · Could not verify", and immediately above
  // instructions to enforce attestation and a four-model allow-list. On one
  // tenant that sentence covered thirty-five accounts whose key model the scan
  // had never been able to read.
  // A model matters only under the tenant's own allow list (the plan adds none, owner
  // 2026-10-03), so mid is given one: its keys of unreadable model are then unjudged.
  const f = structuredClone(fixture('mid'))
  const fido2 = (f.snapshot.config.authMethodsPolicy!.rows[0] as { authenticationMethodConfigurations: Record<string, unknown>[] }).authenticationMethodConfigurations.find((c) => String(c.id).toLowerCase() === 'fido2')!
  fido2.keyRestrictions = { isEnforced: true, enforcementType: 'allow', aaGuids: [...PASSKEY_TARGET_AAGUIDS] }
  const projection = affectedPasskeysByProposedChange(f.snapshot, f.mapping, f.groups)

  // The premise: this tenant holds passkeys whose model is unreadable.
  const unreadable = f.snapshot.users.filter((u) => {
    const methods = f.snapshot.authMethods[u.id]
    if (!Array.isArray(methods)) return false
    const keys = methods.filter((m) => m.kind === 'fido2' || m.kind === 'passkey')
    return keys.length > 0 && keys.every((k) => !k.aaGuid)
  })
  assert.ok(unreadable.length > 10, `the premise: mid has many unreadable passkeys, not ${unreadable.length}`)

  assert.equal(projection.state, 'unknown', 'a tenant it cannot fully assess reports itself as known')
  assert.ok(projection.unassessable.length > 0, 'the accounts it could not judge are counted nowhere')
  // They are not claimed as broken either: unjudged is its own answer.
  for (const id of projection.unassessable) {
    assert.equal(projection.users.some((u) => u.accountId === id), false, `${id} is reported as provably affected and as unjudged`)
  }
})

test('a passkey the device-bound type stops is named, whatever its model (review of F-036)', async () => {
  // Review, 2026-09-28: the first fix dropped every passkey whose reason read
  // "modelRestricted", but on a profile a synced key the planned Device-bound type
  // stops reads the same. Since 2026-10-03 no allow list is planned, so the type
  // alone decides it.
  const { passkeyRestrictionReading, affectedByHandover } = await import('./passkeyRestrictions.ts')
  const f = structuredClone(fixture('demo'))
  const synced = { id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true, defaultPasskeyProfile: 'p', includeTargets: [{ id: 'all_users', targetType: 'group', allowedPasskeyProfiles: ['p'] }], excludeTargets: [], passkeyProfiles: [{ id: 'p', name: 'p', passkeyTypes: 'synced', attestationEnforcement: 'disabled', keyRestrictions: { isEnforced: false, enforcementType: 'allow', aaGuids: [] } }] }
  f.snapshot.config.authMethodsPolicy = { status: 'ok', reason: null, rows: [{ authenticationMethodConfigurations: [synced] }] } as typeof f.snapshot.config.authMethodsPolicy
  f.snapshot.authMethods = Object.fromEntries(f.snapshot.users.map((u) => [u.id, []]))
  const [a, b] = f.snapshot.users.filter((u) => u.accountEnabled !== false && u.userType === 'member').map((u) => u.id)
  f.snapshot.authMethods[a] = [{ kind: 'fido2', id: 'ka', aaGuid: PASSKEY_TARGET_AAGUIDS[0], passkeyType: 'synced', attestationLevel: 'notAttested' }]
  f.snapshot.authMethods[b] = [{ kind: 'fido2', id: 'kb', aaGuid: '11111111-2222-4333-8444-555555555555', passkeyType: 'synced', attestationLevel: 'notAttested' }]
  const affected = affectedPasskeysByProposedChange(f.snapshot, f.mapping, f.groups)
  const reading = passkeyRestrictionReading(f.snapshot, f.mapping, f.groups)
  assert.ok(reading.lockedOut.length > 0, 'the premise: someone would be locked out')
  assert.ok(affected.users.some((u) => u.accountId === a && u.methods.every((m) => m.reason === 'modelRestricted')), 'the premise: the type stop reads "modelRestricted"')
  const handed = affectedByHandover(f.snapshot, f.mapping, affected, reading).map((u) => u.accountId)
  assert.ok(handed.includes(a) && handed.includes(b), `a synced passkey the Device-bound type stops was dropped: ${handed.join(', ')}`)
})
