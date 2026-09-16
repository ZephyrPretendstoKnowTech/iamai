import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { PASSKEY_TARGET_AAGUIDS, passkeyFindingsOf, passkeyReadingOf, resolvePasskeyTarget, passkeyReadinessFindingsOf } from './passkeySettings.ts'
import { emergencyPasskeyCompatibility, emergencyProposedPasskeyCompatibility } from './passkeyCompatibility.ts'

const HARDWARE = 'cb69481e-8ff7-4039-93ec-0a2729a154a8'
const profile = (id: string, aaGuids: string[] = [...PASSKEY_TARGET_AAGUIDS]) => ({ id, name: id, passkeyTypes: 'deviceBound', attestationEnforcement: 'registrationOnly', keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids } })
const policy = () => ({ id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true, defaultPasskeyProfile: 'authenticator', includeTargets: [{ id: 'all_users', targetType: 'group', allowedPasskeyProfiles: ['authenticator', 'hardware'] }], excludeTargets: [] as { id: string }[], passkeyProfiles: [profile('authenticator'), profile('hardware', [HARDWARE])] })
function scan(current: unknown) {
  const snapshot = structuredClone(fixture('demo').snapshot)
  snapshot.config.authMethodsPolicy = { status: 'ok', reason: null, rows: [{ authenticationMethodConfigurations: [current] }] }
  return snapshot
}

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

test('unrestricted legacy policy requires model selection without manufacturing an allow list', () => {
  const current = { id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true, isAttestationEnforced: true, includeTargets: [{ id: 'all_users', targetType: 'group', allowedPasskeyProfiles: [] }], excludeTargets: [], keyRestrictions: { isEnforced: false, enforcementType: 'allow', aaGuids: [] } }
  assert.deepEqual(resolvePasskeyTarget(current), { kind: 'review', review: 'modelSelection', subjects: ['unrestricted'] })
  assert.ok(passkeyFindingsOf(scan(current)).some(f => f.value === 'Unrestricted' && f.outcome === 'fail'))
  const snapshot = scan(current)
  snapshot.authMethods = { emergency: [{ kind: 'fido2', aaGuid: HARDWARE }] }
  assert.equal(emergencyPasskeyCompatibility(snapshot, ['emergency'])[0].state, 'eligible', 'existing hardware compatibility is separate from the desired restriction')
})

test('profile compatibility follows per-account assignments and exclusions, not a tenant-wide union', () => {
  const current = policy()
  current.includeTargets = [{ id: 'hardware-users', targetType: 'group', allowedPasskeyProfiles: ['hardware'] }, { id: 'other-users', targetType: 'group', allowedPasskeyProfiles: ['authenticator'] }]
  const snapshot = scan(current)
  snapshot.authMethods = { emergency: [{ kind: 'fido2', aaGuid: HARDWARE, passkeyType: 'deviceBound' }] }
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
  current.keyRestrictions = {isEnforced:false,enforcementType:'allow',aaGuids:[]}
  current.includeTargets = [{ id: 'all_users', targetType: 'group' }]
  const snapshot = scan(current)
  snapshot.authMethods = { emergency: [{kind:'passkey', aaGuid:PASSKEY_TARGET_AAGUIDS[0],passkeyType:'synced'}] }
  assert.equal(emergencyPasskeyCompatibility(snapshot,['emergency'])[0].state,'eligible')
  assert.equal(emergencyProposedPasskeyCompatibility(snapshot,['emergency'], fixture('demo').mapping)[0].state,'unknown')
  snapshot.authMethods.emergency = [{kind:'fido2',aaGuid:PASSKEY_TARGET_AAGUIDS[0],passkeyType:'deviceBound'}]
  assert.equal(emergencyProposedPasskeyCompatibility(snapshot,['emergency'], fixture('demo').mapping)[0].state,'unknown')
})
