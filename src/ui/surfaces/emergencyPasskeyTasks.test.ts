import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { emergencyPasskeyTasksOf } from './emergencyPasskeyTasks.ts'
import { emergencyImplementation } from './emergencyImplementation.ts'
import { listedPasskeyAccounts, passkeyRestrictionReading } from '../../roadmap/passkeyRestrictions.ts'
import { notActiveUsers } from '../../derive/sets.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { adminUserIds } from '../../roles.ts'
import { emergencyTaskText } from './emergencyAccountTasks.ts'
import { PASSKEY_TARGET_AAGUIDS, passkeyReadingOf, samePasskeyValue } from '../../roadmap/passkeySettings.ts'

function project() {
  const value = structuredClone(fixture('demo-week2'))
  const run = runFixture(value)
  const step = run.steps.find(row => row.id === 's-prereq-passkey-settings')!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  return emergencyPasskeyTasksOf(step, ctx)
}

/**
 * The tenant's methods policy with its FIDO2 entry replaced and every other
 * method's configuration kept. A policy holding only FIDO2 is a tenant where
 * nobody is known to keep Microsoft Authenticator, and the allow list is then
 * rightly withheld (roadmap/passkeyRestrictions.ts) — which is not what the cases
 * about how the restrictions are worded are about.
 */
/**
 * Every administrator also holds Windows Hello for Business. An admin whose only
 * phishing-resistant method is a passkey the scan cannot judge is locked out by
 * an allow list, and the list is then withheld (roadmap/passkeyRestrictions.ts);
 * the cases about how the restrictions are worded start where nobody is.
 */
function withAdminsOnWindowsHello(snapshot: TenantSnapshot): void {
  const admins = new Set([...adminUserIds(snapshot.roles), ...(snapshot.registrationDetails ?? []).filter((r) => r.isAdmin).map((r) => r.id)])
  for (const id of admins) {
    const methods = snapshot.authMethods[id]
    if (Array.isArray(methods) && !methods.some((m) => m.kind === 'windowsHelloForBusiness')) snapshot.authMethods[id] = [...methods, { kind: 'windowsHelloForBusiness' }] as never
  }
}

function withFido2(snapshot: TenantSnapshot, current: Record<string, unknown>, extra: Record<string, unknown> = {}): void {
  withAdminsOnWindowsHello(snapshot)
  const rows = (snapshot.config.authMethodsPolicy?.rows ?? []) as { authenticationMethodConfigurations?: Record<string, unknown>[] }[]
  const others = (rows[0]?.authenticationMethodConfigurations ?? []).filter(c => String(c.id).toLowerCase() !== 'fido2')
  snapshot.config.authMethodsPolicy = { status: 'ok', reason: null, rows: [{ ...(rows[0] ?? {}), authenticationMethodConfigurations: [current, ...others], ...extra }] }
}

function projectProfile(profile: Record<string, unknown> = {}) {
  const value = structuredClone(fixture('demo'))
  const current = {
    id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true,
    defaultPasskeyProfile: 'authenticator',
    includeTargets: [{ id: 'all_users', targetType: 'group', allowedPasskeyProfiles: ['authenticator'] }], excludeTargets: [],
    passkeyProfiles: [{ id: 'authenticator', name: 'Authenticator', passkeyTypes: 'deviceBound', attestationEnforcement: 'disabled', keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids: [...PASSKEY_TARGET_AAGUIDS] }, ...profile }],
  }
  withFido2(value.snapshot, current)
  const run = runFixture(value)
  const step = run.steps.find(row => row.id === 's-prereq-passkey-settings')!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  return { projected: emergencyPasskeyTasksOf(step, ctx), reading: passkeyReadingOf(value.snapshot, value.mapping) }
}
const projectProfileChange = () => projectProfile().projected
const protectionFacts = (profile: Record<string, unknown>) => projectProfile(profile).projected.tasks.find(row => row.id === 'apply-passkey-settings')!.readinessFacts ?? []
const allow = (aaGuids: string[]) => ({ keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids } })
// Graph's order on the live tenant: Android, iOS, YubiKey 5 Series, YubiKey 5 Series with NFC.
const GRAPH_ORDER = ['de1e552d-db1d-4423-a619-566b625cdc84', '90a3ccdf-635c-4729-a248-9b709135078f', '19083c3d-8383-4b18-bc03-8f1c9ab2fd1b', 'a25342c0-3cdc-4414-8e46-f4807fca511c']
const WINDOWS_HELLO = '9ddd1817-af5a-4672-a2b9-3e3dd95000a9'
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function projectLegacyChange(change: (current: Record<string, any>) => void) {
  const value = structuredClone(fixture('demo'))
  const current: Record<string, any> = {
    id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true, isAttestationEnforced: true,
    includeTargets: [{ id: 'all_users', targetType: 'group', allowedPasskeyProfiles: [] }], excludeTargets: [],
    keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids: [PASSKEY_TARGET_AAGUIDS[0]] },
  }
  change(current)
  withFido2(value.snapshot, current, { fido2Configuration: current })
  const run = runFixture(value)
  const step = run.steps.find(row => row.id === 's-prereq-passkey-settings')!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  return emergencyPasskeyTasksOf(step, ctx)
}

test('affected-passkey task keeps users as facts and one method selector', () => {
  const task = project().tasks.find(row => row.id === 'prepare-affected-passkeys')!
  assert.equal(task.variants?.length, 3)
  assert.equal(task.facts?.every(row => row.label.length > 0), true)
  assert.doesNotMatch(task.steps.join('\n'), /Global Administrator|custody|Temporary Access Pass/i)
  const rendered = emergencyTaskText({ ...task, facts: [{ label: 'user@example.com', value: 'Security key · Replacement needed' }] }, task.defaultVariantId)
  assert.match(rendered, /Compatible alternative registered|Replacement needed/)
  assert.match(rendered, /Someone who keeps another way in:/)
  assert.match(rendered, /Someone with no other way in:/)
  assert.match(rendered, /Return to IAMAI.*Scan to update the plan/s)
})

test('profile corrections expose only changed fields and do not repeat fact values in the SOP', () => {
  const task = projectProfileChange().tasks.find(row => row.id === 'apply-passkey-settings')!
  assert.equal(task.facts, undefined, 'the changes are the tile’s facts, not a block above the procedure')
  const facts = task.readinessFacts ?? []
  assert.deepEqual(facts.map(row => row.label), ['Authenticator · Enforce attestation'])
  assert.equal(facts[0].value, 'No → Yes')
  assert.doesNotMatch(facts[0].value, /registrationOnly|disabled/)
  const text = task.steps.join('\n')
  for (const fact of facts) assert.doesNotMatch(text, new RegExp(fact.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  assert.doesNotMatch(text, /Add only:|Remove only:|Use these approved authenticator models:/i)
})

test('the same approved models in a different order produce no Approved models row', () => {
  assert.notDeepEqual(GRAPH_ORDER, [...PASSKEY_TARGET_AAGUIDS])
  assert.deepEqual(protectionFacts(allow(GRAPH_ORDER)).map(row => row.label), ['Authenticator · Enforce attestation'])
})

test('the same approved models in different letter casing produce no Approved models row', () => {
  assert.deepEqual(protectionFacts(allow(GRAPH_ORDER.map(id => id.toUpperCase()))).map(row => row.label), ['Authenticator · Enforce attestation'])
})

test('a reordered, otherwise correct profile reads in place with no protection facts', () => {
  const { projected, reading } = projectProfile({ passkeyTypes: 'deviceBound', attestationEnforcement: 'registrationOnly', ...allow(GRAPH_ORDER) })
  assert.equal(reading.state, 'inPlace')
  assert.deepEqual(reading.differs, [])
  assert.deepEqual(projected.tasks.find(row => row.id === 'apply-passkey-settings')!.readinessFacts, [])
})

test('passkeyTypes equality ignores order and serialisation', () => {
  assert.equal(samePasskeyValue('deviceBound,synced', 'synced, deviceBound', 'passkeyTypes'), true)
  assert.equal(samePasskeyValue(['synced', 'deviceBound'], 'deviceBound,synced', 'passkeyTypes'), true)
  assert.equal(samePasskeyValue(['DeviceBound'], 'deviceBound', 'passkeyTypes'), true)
  assert.equal(samePasskeyValue('deviceBound', 'deviceBound,synced', 'passkeyTypes'), false)
  assert.equal(samePasskeyValue({ passkeyTypes: 'synced,deviceBound' }, { passkeyTypes: ['deviceBound', 'synced'] }), true)
  assert.deepEqual(protectionFacts({ passkeyTypes: ['deviceBound'], ...allow(GRAPH_ORDER) }).filter(row => row.label.endsWith('Storage')), [])
})

test('extra tenant models outside the required set do not by themselves produce a row', () => {
  assert.deepEqual(protectionFacts(allow([...GRAPH_ORDER, WINDOWS_HELLO])).map(row => row.label), ['Authenticator · Enforce attestation'])
  const { reading } = projectProfile({ passkeyTypes: 'deviceBound', attestationEnforcement: 'registrationOnly', ...allow([WINDOWS_HELLO, ...GRAPH_ORDER]) })
  assert.equal(reading.state, 'inPlace')
})

const protectionSteps = (profile: Record<string, unknown>) => projectProfile(profile).projected.tasks.find(row => row.id === 'apply-passkey-settings')!.steps

test('storage: stored "deviceBound,synced" is a change even with attestation enforced, as synced only is (a registered synced passkey keeps signing in until Synced is unticked; audit, 2026-10-07)', () => {
  assert.ok(protectionFacts({ passkeyTypes: 'deviceBound,synced', attestationEnforcement: 'registrationOnly', ...allow(GRAPH_ORDER) }).length > 0)
  assert.notEqual(projectProfile({ passkeyTypes: 'deviceBound,synced', attestationEnforcement: 'registrationOnly', ...allow(GRAPH_ORDER) }).reading.state, 'inPlace')
  assert.ok(protectionSteps({ passkeyTypes: 'deviceBound,synced', attestationEnforcement: 'registrationOnly', ...allow(GRAPH_ORDER) }).includes('Set **Passkey types** to **Device-bound**.'))
  const steps = protectionSteps({ passkeyTypes: 'synced', attestationEnforcement: 'registrationOnly', ...allow(GRAPH_ORDER) })
  assert.ok(steps.includes('Set **Passkey types** to **Device-bound**.'))
})


// ---- the people a device-bound change stops (owner, 2026-10-03) ----
//
// Passkeys become device-bound and attested for every user, with no key
// restrictions added. Device-bound applies at sign-in, so a synced passkey
// stops working. Before the change the step names the active people and the
// emergency accounts it stops, with what each keeps, those with no other way
// in first. The tenant here is the one Microsoft's April–May 2026 auto-enable
// left: a default profile that allows synced passkeys, attestation off.

const SYNCED_PROFILE = {
  id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true,
  defaultPasskeyProfile: 'default',
  includeTargets: [{ id: 'all_users', targetType: 'group', allowedPasskeyProfiles: ['default'] }], excludeTargets: [],
  passkeyProfiles: [{ id: 'default', name: 'Default passkey profile', passkeyTypes: 'deviceBound,synced', attestationEnforcement: 'disabled', keyRestrictions: { isEnforced: false, enforcementType: 'block', aaGuids: [] } }],
}
const synced = (id: string) => ({ kind: 'fido2', id: `synced-${id}`, aaGuid: 'fbfc3007-154e-4ecc-8c0b-6e020557d7bd', passkeyType: 'synced', attestationLevel: 'notAttested' })
const deviceBound = (id: string) => ({ kind: 'fido2', id: `bound-${id}`, aaGuid: PASSKEY_TARGET_AAGUIDS[0], passkeyType: 'deviceBound', attestationLevel: 'attested' })
const DAY = 86_400_000

/** The demo on the auto-enabled profile; `change` gives people their methods. */
function onSyncedTenant(change: (snapshot: TenantSnapshot, people: string[], emergency: string[]) => void) {
  const value = structuredClone(fixture('demo'))
  withFido2(value.snapshot, structuredClone(SYNCED_PROFILE))
  // Nobody else holds a passkey, so each case names exactly the people it gives one.
  for (const [id, methods] of Object.entries(value.snapshot.authMethods)) if (Array.isArray(methods)) value.snapshot.authMethods[id] = methods.filter((m) => m.kind !== 'fido2' && m.kind !== 'passkey') as never
  const admins = new Set([...adminUserIds(value.snapshot.roles), ...(value.snapshot.registrationDetails ?? []).filter((r) => r.isAdmin).map((r) => r.id)].map((id) => id.toLowerCase()))
  const emergency = value.mapping.breakGlassUserIds
  const listed = listedPasskeyAccounts(value.snapshot, value.mapping)
  const people = value.snapshot.users.filter((u) => u.userType === 'member' && u.accountEnabled !== false && !admins.has(u.id.toLowerCase()) && !emergency.includes(u.id) && listed(u.id)).map((u) => u.id)
  change(value.snapshot, people, emergency)
  const run = runFixture(value)
  const step = run.steps.find(row => row.id === 's-prereq-passkey-settings')!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  const upn = (id: string): string => value.snapshot.users.find(u => u.id === id)!.userPrincipalName!
  return { value, step, projected: emergencyPasskeyTasksOf(step, ctx), portal: emergencyImplementation(step, ctx) ?? '', reading: passkeyRestrictionReading(value.snapshot, value.mapping, value.groups), upn, people, emergency }
}
const task = (p: ReturnType<typeof emergencyPasskeyTasksOf>, id: string) => p.tasks.find(row => row.id === id)!
/** A line that adds, removes or sets a model: none is handed over any more. */
const MODEL_LINE = /Add AAGUID|Enter AAGUID|Remove \*\*[0-9a-f-]{36}\*\*|Select \*\*Target specific AAGUIDs\*\*|Restrict specific keys|Set \*\*Enforce key restrictions|Clear \*\*Target specific AAGUIDs/

test('people whose synced passkey stops are named before the save, each with what they keep, and the step opens on preparing them', () => {
  const { projected, reading, upn, people } = onSyncedTenant((snapshot, people) => {
    for (const id of people.slice(0, 2)) snapshot.authMethods[id] = [synced(id), { kind: 'microsoftAuthenticator' }] as never
  })
  const named = people.slice(0, 2)
  assert.deepEqual([...reading.stranded].sort(), [...named].sort(), 'the premise: two people hold only a synced passkey and Authenticator')
  assert.equal(reading.lockedOut.length, 0, 'the premise: each keeps Microsoft Authenticator')
  assert.equal(projected.recommendedTaskId, 'prepare-affected-passkeys', 'the step opens on the people the save stops')
  const prepare = task(projected, 'prepare-affected-passkeys')
  assert.equal(prepare.required, true)
  for (const id of named) assert.ok(prepare.steps[0].includes(upn(id)), `${upn(id)} is not named: ${prepare.steps[0]}`)
  assert.match(prepare.steps[0], /Changing passkeys to device-bound stops the synced passkeys on 2 accounts/)
  assert.match(prepare.steps[0], /Each keeps Microsoft Authenticator, so none is locked out/)
  // The facts: each passkey that stops, its type, and what the person keeps.
  for (const id of named) assert.ok((prepare.facts ?? []).some((f) => f.label === upn(id) && /· Synced ·/.test(f.value) && /Keeps Microsoft Authenticator/.test(f.value)), `${upn(id)}'s fact: ${JSON.stringify(prepare.facts)}`)
  // The change itself is offered whole: device-bound, attestation, and no model line.
  const apply = task(projected, 'apply-passkey-settings').steps.join('\n')
  assert.match(apply, /Set \*\*Passkey types\*\* to \*\*Device-bound\*\*/)
  assert.match(apply, /Set \*\*Enforce attestation\*\* to \*\*Yes\*\*/)
  assert.doesNotMatch(apply, MODEL_LINE)
})

test('someone whose only way in is a synced passkey is named first as locked out, and the change is still offered, never withheld', () => {
  const { projected, portal, reading, upn, people } = onSyncedTenant((snapshot, people) => {
    snapshot.authMethods[people[0]] = [synced(people[0]), { kind: 'microsoftAuthenticator' }] as never
    snapshot.authMethods[people[1]] = [synced(people[1])] as never
  })
  assert.deepEqual(reading.lockedOut, [people[1]], 'the premise: one person keeps nothing but the synced passkey')
  const prepare = task(projected, 'prepare-affected-passkeys')
  assert.match(prepare.steps[0], /^Before you save: changing passkeys to device-bound would lock out 1 account/)
  assert.match(prepare.steps[0], /Every passkey that account holds is synced/, 'one account is "that account"')
  assert.doesNotMatch(prepare.steps[0], /signs in/)
  assert.ok(prepare.steps[0].includes(upn(people[1])))
  // Locked out first in the list, then the person who keeps another way in.
  assert.deepEqual((prepare.facts ?? []).map((f) => f.label), [upn(people[1]), upn(people[0])])
  assert.match(prepare.facts![0].value, /No other way to sign in$/)
  const apply = task(projected, 'apply-passkey-settings').steps
  assert.match(apply[0], /Prepare affected passkeys first: this change would lock out 1 account/)
  assert.ok(apply.some((l) => /Set \*\*Passkey types\*\* to \*\*Device-bound\*\*/.test(l)), 'the change is withheld')
  assert.equal(projected.recommendedTaskId, 'prepare-affected-passkeys')
  // The Entra channel says the same.
  assert.match(portal, /Before you save: changing passkeys to device-bound would lock out 1 account/)
  assert.doesNotMatch(portal, /Allow restrictions|allow list/i)
})

test('the list holds the people who sign in and every emergency account; a dormant or disabled account and a device-bound key are not on it', () => {
  const { reading, people, emergency, value } = onSyncedTenant((snapshot, people, emergency) => {
    const [active, dormant, disabled, bound] = people
    const old = new Date(Date.parse(snapshot.asOf) - 400 * DAY).toISOString()
    for (const id of [active, dormant, disabled]) snapshot.authMethods[id] = [synced(id)] as never
    snapshot.authMethods[bound] = [deviceBound(bound)] as never
    const d = snapshot.users.find((u) => u.id === dormant)!
    Object.assign(d, { lastSuccessfulSignIn: old, successfulSignInActivityRead: true, createdDateTime: old })
    if (snapshot.signInEvidence) delete snapshot.signInEvidence[dormant]
    snapshot.users.find((u) => u.id === disabled)!.accountEnabled = false
    // An emergency account signs in rarely; its passkey is still the way back in.
    const e = snapshot.users.find((u) => u.id === emergency[0])!
    Object.assign(e, { lastSuccessfulSignIn: old, successfulSignInActivityRead: true, createdDateTime: old })
    if (snapshot.signInEvidence) delete snapshot.signInEvidence[emergency[0]]
    snapshot.authMethods[emergency[0]] = [synced(emergency[0])] as never
  })
  const [active, dormant, disabled, bound] = people
  assert.ok(notActiveUsers(value.snapshot, value.snapshot.asOf).some((u) => u.id === dormant), 'the premise: the dormant account reads dormant')
  assert.ok(notActiveUsers(value.snapshot, value.snapshot.asOf).some((u) => u.id === emergency[0]), 'the premise: the emergency account reads dormant too')
  assert.ok(reading.stranded.includes(active), 'an active person is listed')
  assert.ok(reading.stranded.includes(emergency[0]), 'an emergency account is listed however rarely it signs in')
  assert.equal(reading.stranded.includes(dormant), false, 'a dormant account is Disable or Confirm Dormant Accounts\' to handle')
  assert.equal(reading.stranded.includes(disabled), false, 'a disabled account cannot sign in at all')
  assert.equal(reading.stranded.includes(bound), false, 'a device-bound key keeps working')
})

test('no task, fact or channel adds, removes or names a model to allow: legacy or profiles, any tenant list', () => {
  for (const projected of [
    projectLegacyChange(() => undefined),
    projectLegacyChange((c) => { c.keyRestrictions = { isEnforced: false, enforcementType: 'block', aaGuids: [] } }),
    projectProfile().projected,
    projectProfile({ keyRestrictions: { isEnforced: false, enforcementType: 'allow', aaGuids: [WINDOWS_HELLO] } }).projected,
  ]) {
    const apply = task(projected, 'apply-passkey-settings')
    assert.doesNotMatch(apply.steps.join('\n'), MODEL_LINE)
    assert.equal((apply.readinessFacts ?? []).some((f) => /AAGUID|Approved models/.test(f.label)), false, JSON.stringify(apply.readinessFacts))
  }
})

test('1.3’s card and its task state one count, the accounts the change would lock out, each named on the card (net-new 3)', () => {
  const { step, projected, reading, people } = onSyncedTenant((snapshot, people) => {
    for (const id of people.slice(0, 2)) snapshot.authMethods[id] = [synced(id)] as never
  })
  assert.equal(reading.lockedOut.length, 2, 'the premise: two people would be locked out')
  const card = (step.configurationFindings ?? []).find((c) => c.key === 'affected-passkeys')!
  assert.equal(card.value, '2 accounts would be locked out')
  const named = (card.items ?? []).filter((i) => i.value === 'No other way in').map((i) => i.accountId)
  assert.deepEqual([...named].sort(), [...people.slice(0, 2)].sort(), 'each lock-out named')
  assert.ok(task(projected, 'prepare-affected-passkeys').steps.some((l) => l.includes('would lock out 2 accounts')), 'the task says the same count')
})

test("1.3's card and its task name the same accounts, and a person who keeps another way in is named with it on both (F-036)", () => {
  const { step, projected, upn, people } = onSyncedTenant((snapshot, people) => {
    snapshot.authMethods[people[0]] = [synced(people[0]), { kind: 'microsoftAuthenticator' }] as never
  })
  const card = (step.configurationFindings ?? []).find((c) => c.key === 'affected-passkeys')!
  assert.deepEqual((card.items ?? []).map((i) => i.accountId), [people[0]])
  assert.match(card.items![0].value, /Keeps Microsoft Authenticator/)
  assert.deepEqual((task(projected, 'prepare-affected-passkeys').facts ?? []).map((f) => f.label), [upn(people[0])])
})

test('1.3 completes once the settings are applied, and a device-bound tenant has nobody to list (net-new 4)', () => {
  const { value } = onSyncedTenant((snapshot, people) => {
    for (const id of people.slice(0, 3)) snapshot.authMethods[id] = [deviceBound(id)] as never
  })
  const snapshot = structuredClone(value.snapshot)
  const reading = passkeyReadingOf(snapshot, value.mapping)
  assert.equal(reading.resolution?.kind, 'target')
  withFido2(snapshot, { ...(reading.resolution as { target: Record<string, unknown> }).target, id: 'Fido2' })
  const r = runFixture({ ...value, snapshot })
  const step = r.steps.find((s) => s.id === 's-prereq-passkey-settings')!
  assert.equal(passkeyRestrictionReading(snapshot, value.mapping, value.groups).stranded.length, 0)
  assert.equal(step.status, 'done')
})
