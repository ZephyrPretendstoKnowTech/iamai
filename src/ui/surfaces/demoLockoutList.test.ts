// DEMO-SP: the sample shows Configure Passkey Authentication's lockout list. The
// demo is on the auto-enabled default passkey profile (device-bound and synced,
// attestation off, no key restrictions), every sample passkey carries its type,
// and one active member holds a synced passkey in iCloud Keychain beside
// Microsoft Authenticator. 1.3 lists that one person, keeping Microsoft
// Authenticator, and nobody is locked out. The follow-up scan has the change
// applied, the person holds a device-bound Authenticator passkey, and 1.3 is done.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { passkeyRestrictionReading } from '../../roadmap/passkeyRestrictions.ts'
import { affectedPasskeysByProposedChange } from '../../roadmap/passkeyCompatibility.ts'
import { passkeyReadingOf } from '../../roadmap/passkeySettings.ts'
import { readinessView } from '../../derive/mfaReadiness.ts'
import { adminUserIds } from '../../roles.ts'
import { pages, shared } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { emergencyPasskeyTasksOf } from './emergencyPasskeyTasks.ts'
import { panelMethods, rowCells } from './readinessCells.ts'
import type { StepVarContext } from './stepVars.ts'

const STEP = 's-prereq-passkey-settings'
const ICLOUD = 'fbfc3007-154e-4ecc-8c0b-6e020557d7bd'
const P = (shared as unknown as { passkeyRestrictions: { factKeeps: string } }).passkeyRestrictions
const KEEPS = fillText(P.factKeeps, { method: 'Microsoft Authenticator' })
const R = pages.readiness as unknown as { panel: { storageTypes: Record<'deviceBound' | 'synced', string>; step3: Record<string, string> } }

function project(name: 'demo' | 'demo-week2') {
  const value = structuredClone(fixture(name))
  const run = runFixture(value)
  const step = run.steps.find((s) => s.id === STEP)!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: (id) => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  return { value, step, tasks: emergencyPasskeyTasksOf(step, ctx), reading: passkeyRestrictionReading(value.snapshot, value.mapping, value.groups) }
}

/** The one sample person holding a synced passkey. */
function syncedHolders(name: 'demo' | 'demo-week2'): string[] {
  const { snapshot } = fixture(name)
  return Object.entries(snapshot.authMethods).filter(([, ms]) => Array.isArray(ms) && ms.some((m) => (m.kind === 'fido2' || m.kind === 'passkey') && m.passkeyType === 'synced')).map(([id]) => id)
}

test('the sample is on the auto-enabled default profile, and every sample passkey has its type', () => {
  for (const name of ['demo', 'demo-week2'] as const) {
    const { snapshot } = fixture(name)
    const current = passkeyReadingOf(snapshot).current!
    const profiles = current.passkeyProfiles as { id: string; passkeyTypes: string; attestationEnforcement: string; keyRestrictions: { isEnforced: boolean } }[]
    assert.equal(profiles.length, 1, name)
    assert.equal(current.defaultPasskeyProfile, profiles[0].id, name)
    assert.deepEqual(current.includeTargets, [{ targetType: 'group', id: 'all_users', isRegistrationRequired: false, allowedPasskeyProfiles: [profiles[0].id] }], name)
    assert.deepEqual(current.excludeTargets, [], name)
    assert.equal(profiles[0].keyRestrictions.isEnforced, false, `${name}: no key restrictions`)
    assert.equal(profiles[0].attestationEnforcement, name === 'demo' ? 'disabled' : 'registrationOnly', name)
    for (const [id, ms] of Object.entries(snapshot.authMethods)) {
      if (!Array.isArray(ms)) continue
      for (const m of ms) if (m.kind === 'fido2' || m.kind === 'passkey') {
        assert.ok(m.passkeyType === 'deviceBound' || m.passkeyType === 'synced', `${name}/${id}: a passkey with no type`)
        assert.equal(m.attestationLevel, m.passkeyType === 'synced' ? 'notAttested' : 'attested', `${name}/${id}`)
      }
    }
  }
})

test("the demo's 1.3 lists one person whose synced passkey stops, keeping Microsoft Authenticator, and locks nobody out", () => {
  const { value, step, tasks, reading } = project('demo')
  const [person] = syncedHolders('demo')
  assert.deepEqual(syncedHolders('demo'), [person], 'one sample person holds a synced passkey')
  const user = value.snapshot.users.find((u) => u.id === person)!
  const admins = new Set([...adminUserIds(value.snapshot.roles)].map((id) => id.toLowerCase()))
  assert.equal(user.userType, 'member')
  assert.equal(user.accountEnabled, true)
  assert.equal(admins.has(person.toLowerCase()), false, 'not an administrator')
  // The reading: that person, keeping Microsoft Authenticator; nobody locked out; nobody unjudged.
  assert.deepEqual(reading.stranded, [person])
  assert.deepEqual(reading.lockedOut, [])
  assert.deepEqual(reading.keeps, [{ accountId: person, method: 'microsoftAuthenticator' }])
  const affected = affectedPasskeysByProposedChange(value.snapshot, value.mapping, value.groups)
  assert.equal(affected.state, 'known')
  assert.deepEqual(affected.unassessable, [])
  assert.deepEqual(affected.users.map((u) => [u.accountId, u.methods.map((m) => [m.aaguid, m.passkeyType])]), [[person, [[ICLOUD, 'synced']]]])
  // The card names the person once, with what they keep.
  const card = (step.configurationFindings ?? []).find((c) => c.key === 'affected-passkeys')!
  assert.deepEqual((card.items ?? []).map((i) => i.accountId), [person])
  assert.ok(card.items![0].value.endsWith(` · ${KEEPS}`), card.items![0].value)
  // The task names them once, in the lead and in the facts, and the step opens on it.
  const prepare = tasks.tasks.find((t) => t.id === 'prepare-affected-passkeys')!
  assert.equal(prepare.required, true)
  assert.equal(tasks.recommendedTaskId, 'prepare-affected-passkeys')
  const upn = user.userPrincipalName!
  assert.equal(prepare.steps[0].split(upn).length - 1, 1, prepare.steps[0])
  assert.match(prepare.steps[0], /stops the synced passkeys on 1 account/)
  assert.deepEqual((prepare.facts ?? []).map((f) => f.label), [upn])
  assert.ok(prepare.facts![0].value.endsWith(` · ${KEEPS}`), prepare.facts![0].value)
  // No other task carries a lock-out line.
  assert.equal(tasks.tasks.find((t) => t.id === 'apply-passkey-settings')!.steps.some((l) => /would lock out/.test(l)), false)
})

test("MFA Readiness names the synced person's passkey Synced, and says it stops once 1.3 is applied", () => {
  const f = fixture('demo')
  const [person] = syncedHolders('demo')
  const row = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows.find((r) => r.user.id === person)!
  assert.equal(rowCells(row).at(-1), R.panel.storageTypes.synced)
  const fact = panelMethods(row).flatMap((m) => m.facts).find(([label, value]) => label !== '' && value.includes(R.panel.step3.synced))
  assert.ok(fact, JSON.stringify(panelMethods(row)))
  assert.doesNotMatch(JSON.stringify(panelMethods(row)), /approved list/, 'no allow-list line for a synced passkey')
})

test('the follow-up scan has the change applied as the engine resolves it, the person holds a device-bound passkey, and 1.3 is done', () => {
  const week1 = fixture('demo')
  const resolved = passkeyReadingOf(week1.snapshot).resolution
  assert.equal(resolved?.kind, 'target')
  const { value, step, reading } = project('demo-week2')
  const current = passkeyReadingOf(value.snapshot, value.mapping)
  assert.equal(current.state, 'inPlace')
  assert.deepEqual({ ...current.current, id: 'Fido2' }, { ...(resolved as { target: Record<string, unknown> }).target, id: 'Fido2' }, "week two's settings are week one's resolved target")
  assert.equal(step.status, 'done')
  assert.deepEqual(reading.stranded, [])
  assert.deepEqual(reading.lockedOut, [])
  assert.equal((step.configurationFindings ?? []).some((c) => c.key === 'affected-passkeys'), false, 'no affected-passkeys card once applied')
  const [person] = syncedHolders('demo')
  const held = value.snapshot.authMethods[person]
  assert.ok(Array.isArray(held) && held.some((m) => m.kind === 'fido2' && m.passkeyType === 'deviceBound' && m.attestationLevel === 'attested'), 'a device-bound passkey registered')
  // MFA Readiness: both passkeys named, and the synced one no longer allowed.
  const row = readinessView(value.snapshot, value.snapshot.asOf, value.mapping).rows.find((r) => r.user.id === person)!
  assert.equal(rowCells(row).at(-1), `${R.panel.storageTypes.deviceBound}, ${R.panel.storageTypes.synced}`)
  const synced = row.readiness!.credentials.find((c) => c.storage === 'synced')!
  assert.equal(synced.allowedNow, 'no', 'a synced passkey does not sign in under the applied device-bound profile')
})
