import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { PASSKEY_TARGET_AAGUIDS, passkeyFindingsOf, passkeyReadingOf, resolvePasskeyTarget, passkeyReadinessFindingsOf } from './passkeySettings.ts'
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

test('single unrestricted device-bound profile is collected accurately and compared with the approved plan', async () => {
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
  assert.equal(reading.state, 'partial', 'known change, not unread evidence')
  assert.equal(reading.resolution?.kind, 'target')
  if (reading.resolution?.kind === 'target') {
    const profiles = reading.resolution.target.passkeyProfiles as typeof current.passkeyProfiles
    assert.deepEqual(profiles[0].keyRestrictions.aaGuids.sort(), [...PASSKEY_TARGET_AAGUIDS, HARDWARE].sort())
    assert.equal(profiles[0].keyRestrictions.isEnforced, true)
  }
  const findings = passkeyFindingsOf(f.snapshot, f.mapping)
  assert.ok(findings.some(row => row.value === 'Device-bound only'))
  assert.ok(findings.some(row => row.value === 'Required' && row.key.endsWith('.attestation')))
  assert.equal(findings.some(row => row.value === 'Synced passkeys allowed' || row.outcome === 'unknown'), false)
  const impact = affectedPasskeysByProposedChange(f.snapshot, f.mapping, f.groups)
  assert.equal(impact.state, 'known')
  assert.deepEqual(impact.users.map(row => row.accountId), [b])
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

test('assigned attested device-bound profiles jointly support Authenticator and retained hardware', () => {
  const current = policy()
  const snapshot = scan(current)
  assert.equal(passkeyReadingOf(snapshot).state, 'inPlace')
  assert.ok(passkeyFindingsOf(snapshot).every(f => f.outcome === 'pass'))
  const resolved = resolvePasskeyTarget(current)
  assert.equal(resolved.kind, 'target')
  if (resolved.kind === 'target') assert.deepEqual(resolved.target.passkeyProfiles, current.passkeyProfiles)
})

test('a second permissive applicable profile prevents completion; an unassigned one does not', () => {
  const current = policy()
  current.passkeyProfiles.push({ ...profile('permissive'), passkeyTypes: 'deviceBound,synced', attestationEnforcement: 'disabled', keyRestrictions: { isEnforced: false, enforcementType: 'allow', aaGuids: [] } })
  assert.equal(passkeyReadingOf(scan(current)).state, 'inPlace')
  current.includeTargets[0].allowedPasskeyProfiles.push('permissive')
  const snapshot = scan(current)
  assert.equal(passkeyReadingOf(snapshot).state, 'review')
  assert.ok(passkeyFindingsOf(snapshot).some(f => f.value === 'Synced passkeys allowed' && f.outcome === 'fail'))
  assert.ok(passkeyFindingsOf(snapshot).some(f => f.key === 'profile.permissive.attestation' && f.outcome === 'fail'))
})

test('missing profile relationships and missing required Authenticator model are distinct findings', () => {
  const current = policy()
  current.passkeyProfiles[0].keyRestrictions.aaGuids = [PASSKEY_TARGET_AAGUIDS[0]]
  assert.ok(passkeyFindingsOf(scan(current)).some(f => f.value === 'AAGUID missing' && f.outcome === 'fail'))
  current.passkeyProfiles = []
  assert.equal(passkeyReadingOf(scan(current)).state, 'review')
  assert.ok(passkeyFindingsOf(scan(current)).some(f => f.label === 'Passkey Profiles' && f.outcome === 'unknown'))
})

test('disabled method and registration remain concrete while profile details are incomplete', () => {
  const current = policy()
  current.state = 'disabled'
  current.isSelfServiceRegistrationAllowed = false
  current.passkeyProfiles = []
  const findings = passkeyFindingsOf(scan(current))
  assert.ok(findings.some(f => f.key === 'method' && f.value === 'Disabled'))
  assert.ok(findings.some(f => f.key === 'selfService' && f.value === 'Self-service disabled'))
  assert.ok(findings.some(f => f.outcome === 'unknown'))
})

test('failed dedicated read preserves its reason and cannot become disabled or complete', () => {
  const snapshot = scan(policy())
  snapshot.config.authMethodsPolicy.fido2Read = { status: 'error', reason: 'Policy.Read.AuthenticationMethod was not granted', httpStatus: 403 }
  assert.equal(passkeyReadingOf(snapshot).state, 'unread')
  assert.equal(passkeyFindingsOf(snapshot)[0].outcome, 'unknown')
  assert.match(passkeyFindingsOf(snapshot)[0].detail, /Policy.Read.AuthenticationMethod/)
  assert.ok(snapshot.config.authMethodsPolicy.rows.length, 'the parent response remains available with provenance')
})

test('unrestricted legacy policy compares against approved plan models while preserving current access', () => {
  const current = { id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true, isAttestationEnforced: true, includeTargets: [{ id: 'all_users', targetType: 'group', allowedPasskeyProfiles: [] }], excludeTargets: [], keyRestrictions: { isEnforced: false, enforcementType: 'allow', aaGuids: [] } }
  const proposed = resolvePasskeyTarget(current)
  assert.equal(proposed.kind, 'target')
  if (proposed.kind === 'target') {
    assert.deepEqual(proposed.target.keyRestrictions, { isEnforced: true, enforcementType: 'allow', aaGuids: [...PASSKEY_TARGET_AAGUIDS] })
    assert.deepEqual(proposed.retained, [])
  }
  assert.ok(passkeyFindingsOf(scan(current)).some(f => f.value === 'Unrestricted' && f.outcome === 'fail'))
  const snapshot = scan(current)
  snapshot.authMethods = { emergency: [{ kind: 'fido2', aaGuid: HARDWARE, attestationLevel: 'attested' }] }
  assert.equal(emergencyPasskeyCompatibility(snapshot, ['emergency'])[0].state, 'eligible', 'existing hardware compatibility is separate from the desired restriction')
})

test('profile compatibility follows per-account assignments and exclusions, not a tenant-wide union', () => {
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
})

test('unknown registered key type cannot be claimed compatible with a device-bound profile', () => {
  const snapshot = scan(policy())
  snapshot.authMethods = { emergency: [{ kind: 'fido2', aaGuid: HARDWARE }] }
  assert.equal(emergencyPasskeyCompatibility(snapshot, ['emergency'])[0].state, 'unknown')
})


test('readiness groups missing platform and hardware IDs into one named model finding', () => {
  const current = policy()
  current.passkeyProfiles[0].keyRestrictions.aaGuids = []
  const findings = passkeyReadinessFindingsOf(scan(current))
  assert.equal(findings.filter(f => f.key === 'models').length, 1)
  const models = findings.find(f => f.key === 'models')!
  assert.match(models.detail, /Microsoft Authenticator — Android/)
  assert.match(models.detail, /YubiKey/)
  assert.doesNotMatch(models.detail, /all_users/)
  assert.ok(findings.length <= 4)
})

test('an accepted model is required on the next scan without bypassing other configuration checks', () => {
  const snapshot = scan(policy())
  const mapping = { ...fixture('demo').mapping, passkeyApprovedModels: [{name: 'Approved extra', aaguid: '11111111-1111-4111-8111-111111111111'}] }
  assert.equal(passkeyReadingOf(snapshot, mapping).state, 'review')
  const current = policy()
  current.passkeyProfiles[0].keyRestrictions.aaGuids.push(mapping.passkeyApprovedModels[0].aaguid)
  assert.equal(passkeyReadingOf(scan(current), mapping).state, 'inPlace')
  current.passkeyProfiles[0].attestationEnforcement = 'disabled'
  assert.notEqual(passkeyReadingOf(scan(current), mapping).state, 'inPlace')
})

test('an incompletely described synced-profile change stays unknown rather than claiming recovery compatibility', () => {
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
})

test('an attestation-only approval change does not claim an existing passkey loses runtime access', () => {
  const current: any = policy()
  current.passkeyProfiles = current.passkeyProfiles.map((row: any) => ({ ...row, attestationEnforcement: 'disabled' }))
  const snapshot = scan(current)
  const id = snapshot.users[0].id
  snapshot.authMethods[id] = [{ kind: 'fido2', id: 'existing-key', aaGuid: HARDWARE, passkeyType: 'deviceBound', attestationLevel: 'notAttested' }]
  const mapping = fixture('demo').mapping
  assert.notEqual(emergencyProposedPasskeyCompatibility(snapshot, [id], mapping)[0].state, 'eligible')
  assert.deepEqual(affectedPasskeysByProposedChange(snapshot, mapping).users, [])
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
    assert.ok(PASSKEY_TARGET_AAGUIDS.every(id => proposed.keyRestrictions.aaGuids.includes(id)))
    assert.ok(reading.differs.includes('passkeyProfiles'))
  }
})
