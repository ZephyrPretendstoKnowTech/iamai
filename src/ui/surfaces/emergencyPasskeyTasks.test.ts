import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { emergencyPasskeyTasksOf } from './emergencyPasskeyTasks.ts'
import { emergencyImplementation } from './emergencyImplementation.ts'
import { passkeyRestrictionReading } from '../../roadmap/passkeyRestrictions.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { adminUserIds } from '../../roles.ts'
import { emergencyTaskText } from './emergencyAccountTasks.ts'
import { PASSKEY_DEFAULT_MODELS, PASSKEY_TARGET_AAGUIDS, passkeyReadingOf, samePasskeyValue } from '../../roadmap/passkeySettings.ts'

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
  assert.match(rendered, /Compatible alternative/)
  assert.match(rendered, /Replacement registration, only if needed:/)
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

test('legacy approved-model changes expose exact nonblank AAGUID values', () => {
  const task = projectLegacyChange(() => undefined).tasks.find(row => row.id === 'apply-passkey-settings')!
  const fact = task.readinessFacts?.find(row => row.label === 'Approved models')
  assert.ok(fact)
  assert.ok(fact.value.trim().length > 0)
  for (const aaguid of PASSKEY_TARGET_AAGUIDS) assert.match(fact.value, new RegExp(aaguid, 'i'))
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

test('a genuinely different model set still produces a row naming the before and after entries', () => {
  // A disabled list confers no approvals: its dormant Windows Hello entry is removed and the missing YubiKey 5 Series added.
  const current = GRAPH_ORDER.filter(id => id !== '19083c3d-8383-4b18-bc03-8f1c9ab2fd1b').concat(WINDOWS_HELLO)
  const fact = protectionFacts({ keyRestrictions: { isEnforced: false, enforcementType: 'allow', aaGuids: current } }).find(row => row.label === 'Authenticator · Model/Provider AAGUIDs')
  assert.ok(fact)
  const [before, after] = fact.value.split(' → ')
  assert.match(before, new RegExp(`AAGUID ${WINDOWS_HELLO}`))
  assert.doesNotMatch(before, /19083c3d-8383-4b18-bc03-8f1c9ab2fd1b/)
  assert.doesNotMatch(after, new RegExp(WINDOWS_HELLO))
  for (const model of PASSKEY_DEFAULT_MODELS) assert.match(after, new RegExp(escape(`${model.name} (${model.aaguid})`)))
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

test('storage: stored "deviceBound,synced" with attestation enforced is no change; synced only is', () => {
  assert.deepEqual(protectionFacts({ passkeyTypes: 'deviceBound,synced', attestationEnforcement: 'registrationOnly', ...allow(GRAPH_ORDER) }), [])
  assert.equal(projectProfile({ passkeyTypes: 'deviceBound,synced', attestationEnforcement: 'registrationOnly', ...allow(GRAPH_ORDER) }).reading.state, 'inPlace')
  const steps = protectionSteps({ passkeyTypes: 'synced', attestationEnforcement: 'registrationOnly', ...allow(GRAPH_ORDER) })
  assert.ok(steps.includes('Set **Passkey types** to **Device-bound**.'))
})


// ---- the allow list and the passkeys nobody could judge (Jordan D13, Marcus D8) ----
//
// The step opened on "Set Enforce key restrictions to Yes… Restrict specific keys
// to Allow… Add AAGUID… Save", four lines below a hedge that the passkeys on
// eleven accounts could not be judged — naming none of them, saying nothing of
// what they keep. An allow list stops every passkey it does not name. After the
// settings were applied the same hedge still said "before applying restrictions".

function onMidflight(change: (snapshot: TenantSnapshot, ids: string[]) => void = () => {}, name: 'midflight' | 'small' | 'mid' = 'midflight') {
  const value = structuredClone(fixture(name))
  change(value.snapshot, passkeyRestrictionReading(value.snapshot, value.mapping, value.groups).stranded)
  const run = runFixture(value)
  const step = run.steps.find(row => row.id === 's-prereq-passkey-settings')!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  const upn = (id: string): string => value.snapshot.users.find(u => u.id === id)!.userPrincipalName!
  return { projected: emergencyPasskeyTasksOf(step, ctx), portal: emergencyImplementation(step, ctx) ?? '', reading: passkeyRestrictionReading(value.snapshot, value.mapping, value.groups), upn }
}
const task = (p: ReturnType<typeof emergencyPasskeyTasksOf>, id: string) => p.tasks.find(row => row.id === id)!
const RESTRICTION = /Enforce key restrictions|Restrict specific keys|Add AAGUID|Target specific AAGUIDs/

test('passkeys nobody could judge: the step opens on preparing them, names them and says what each keeps', () => {
  // small: four accounts hold passkeys the scan could not judge, none of them an
  // administrator, and each keeps Microsoft Authenticator.
  const { projected, reading, upn } = onMidflight(() => {}, 'small')
  assert.equal(reading.stranded.length, 4, 'the premise: four accounts hold passkeys whose model the scan could not read')
  assert.equal(reading.lockedOut.length, 0, 'the premise: each keeps Microsoft Authenticator, and none is an admin')
  assert.equal(projected.recommendedTaskId, 'prepare-affected-passkeys', 'the step opens on the Save that stops their passkeys')
  const prepare = task(projected, 'prepare-affected-passkeys')
  assert.equal(prepare.required, true)
  const lead = prepare.steps[0]
  for (const id of reading.stranded) assert.ok(lead.includes(upn(id)), `${upn(id)} is not named: ${lead}`)
  assert.match(lead, /Each keeps Microsoft Authenticator, so none is locked out/)
  assert.doesNotMatch(lead, /could not tell whether/, 'the anonymous hedge is back')
  // Nobody is locked out by it, so the restrictions stay offered: holding them back
  // on every tenant with an unreadable passkey would make the tool require what it
  // can only help with.
  assert.match(task(projected, 'apply-passkey-settings').steps.join('\n'), RESTRICTION)
})

test('an account the allow list would lock out: the restrictions are not handed over, anywhere', () => {
  const { projected, portal, reading, upn } = onMidflight((snapshot, ids) => {
    const id = ids[0]
    snapshot.authMethods[id] = (snapshot.authMethods[id] as { kind: string }[]).filter(m => m.kind !== 'microsoftAuthenticator') as never
  })
  assert.equal(reading.lockedOut.length, 1, 'the premise: one account keeps nothing but the passkey nobody could judge')
  const apply = task(projected, 'apply-passkey-settings').steps.join('\n')
  assert.doesNotMatch(apply, RESTRICTION, `the allow list is handed over with an account it would lock out:\n${apply}`)
  assert.match(apply, /Key restrictions are not part of this change yet: 1 account would be locked out/)
  assert.match(apply, /Enforce attestation/, 'attestation only affects registration and stays')
  const lead = task(projected, 'prepare-affected-passkeys').steps[0]
  assert.match(lead, /Key restrictions stay off for now: they would lock out 1 account/)
  // A count of one bends the first verb after it (content/render.ts pluralise):
  // the first wording read "1 account would be left with no way to signs in".
  assert.doesNotMatch(lead, /signs in/)
  assert.ok(lead.includes(upn(reading.lockedOut[0])), lead)
  assert.equal(projected.recommendedTaskId, 'prepare-affected-passkeys')
  // The Entra channel says the same, not "apply the listed … Allow restrictions".
  assert.doesNotMatch(portal, /Allow restrictions/)
  assert.match(portal, /Key restrictions stay off for now/)
})

test('once the settings are applied, the passkeys nobody could judge are named, with no "before applying restrictions"', () => {
  const { projected, reading } = onMidflight((snapshot) => {
    // The tenant as the step's target would leave it.
    const mapping = structuredClone(fixture('midflight')).mapping
    const target = passkeyReadingOf(snapshot, mapping).resolution
    assert.ok(target && target.kind === 'target', 'the premise: the step resolves a target')
    const row = snapshot.config.authMethodsPolicy!.rows[0] as { authenticationMethodConfigurations?: Record<string, unknown>[]; fido2Configuration?: unknown }
    row.authenticationMethodConfigurations = (row.authenticationMethodConfigurations ?? []).map(c => String(c.id).toLowerCase() === 'fido2' ? { ...target.target, id: c.id } : c)
    if (row.fido2Configuration) row.fido2Configuration = { ...target.target }
  })
  assert.equal(reading.stranded.length > 0, true, 'the premise: some passkeys still could not be judged')
  const prepare = task(projected, 'prepare-affected-passkeys').steps
  assert.equal(prepare.some(line => /before applying restrictions/.test(line)), false, prepare.join('\n'))
  assert.match(prepare[0], /The passkey settings are applied/)
  assert.match(prepare[0], /sign in (once )?with their passkey/)
  // An admin among them with no other phishing-resistant way in is told to check now, not that they keep something.
  if (reading.lockedOut.length > 0) assert.doesNotMatch(prepare[0], /each keeps/)
  // Nothing waits on preparing them any more — unless one may have lost their way
  // in, and then checking them is the first thing the step asks.
  if (reading.lockedOut.length === 0) assert.notEqual(projected.recommendedTaskId, 'prepare-affected-passkeys', 'nothing is waiting on preparing them any more')
  else assert.equal(projected.recommendedTaskId, 'prepare-affected-passkeys', 'an account that may have lost its way in is not the first thing checked')
})

// An administrator is held to more. The admin policy asks for a
// phishing-resistant sign-in, and push does not satisfy it where that policy is
// enforced: "Each keeps Microsoft Authenticator, so none is locked out" was said
// over five admins on mid whose only phishing-resistant method was the passkey
// nobody could judge, above the allow list that could stop it.
test('an administrator whose only phishing-resistant method is an unjudged passkey is locked out by the list, and it is withheld', () => {
  const { projected, reading } = onMidflight(() => {}, 'mid')
  const value = fixture('mid')
  const admins = new Set(value.snapshot.registrationDetails.filter((r) => r.isAdmin).map((r) => r.id.toLowerCase()))
  const lockedAdmins = reading.lockedOut.filter((id) => admins.has(id.toLowerCase()))
  assert.ok(lockedAdmins.length > 0, 'the premise: some admin keeps only push beside an unjudged passkey')
  for (const id of lockedAdmins) {
    const kinds = (value.snapshot.authMethods[id] as { kind: string }[]).map((m) => m.kind)
    assert.ok(kinds.includes('microsoftAuthenticator'), `${id}: the premise is an admin who keeps push`)
  }
  const apply = task(projected, 'apply-passkey-settings').steps.join('\n')
  assert.doesNotMatch(apply, RESTRICTION, `the allow list is handed over with admins it would lock out:\n${apply}`)
  assert.doesNotMatch(task(projected, 'prepare-affected-passkeys').steps[0], /none is locked out/)
})

test('1.3’s card and its task state one count, the accounts the allow list would lock out, each named on the card (net-new 3)', () => {
  const f = curatedFixture('mid')
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === 's-prereq-passkey-settings')!
  const locked = passkeyRestrictionReading(f.snapshot, f.mapping, f.groups).lockedOut
  assert.ok(locked.length > 0, 'the premise: mid would lock accounts out')
  const card = (step.configurationFindings ?? []).find((c) => c.key === 'affected-passkeys')!
  assert.equal(card.value, `${locked.length} accounts would be locked out`)
  const named = (card.items ?? []).filter((i) => i.value === 'No other way in').map((i) => i.accountId)
  assert.deepEqual(named, locked, 'each lock-out named')
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const task = emergencyPasskeyTasksOf(step, ctx).tasks.find((t) => t.id === 'prepare-affected-passkeys')!
  assert.ok(task.steps.some((l) => l.includes(`would lock out ${locked.length} accounts`)), 'the task says the same count')
})

/** The fixture with Configure Passkey Authentication's planned settings already applied. */
function applied(name: 'mid' | 'small') {
  const f = curatedFixture(name)
  const snapshot = structuredClone(f.snapshot)
  const reading = passkeyReadingOf(snapshot, f.mapping)
  assert.equal(reading.resolution?.kind, 'target', 'the premise: the step has settings to apply')
  const target = (reading.resolution as { target: Record<string, unknown> }).target
  const rows = (snapshot.config.authMethodsPolicy?.rows ?? []) as { authenticationMethodConfigurations?: Record<string, unknown>[] }[]
  const others = (rows[0]?.authenticationMethodConfigurations ?? []).filter((c) => String(c.id).toLowerCase() !== 'fido2')
  snapshot.config.authMethodsPolicy = { status: 'ok', reason: null, rows: [{ ...(rows[0] ?? {}), authenticationMethodConfigurations: [{ ...target, id: 'Fido2' }, ...others] }] }
  const r = runFixture({ ...f, snapshot })
  return { f, snapshot, r, step: r.steps.find((s) => s.id === 's-prereq-passkey-settings')! }
}

test('1.3 is never Completed while an account the applied allow list locks out is still to check; with nobody locked out it completes, and the rest is a fact (net-new 4)', () => {
  {
    const { f, snapshot, r, step } = applied('mid')
    assert.notEqual(step.status, 'done', 'mid: accounts with no other way in keep the step open')
    const ctx: StepVarContext = { snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups }
    assert.equal(emergencyPasskeyTasksOf(step, ctx).tasks.find((t) => t.id === 'prepare-affected-passkeys')?.required, true)
    assert.match((step.configurationFindings ?? []).find((c) => c.key === 'affected-passkeys')?.value ?? '', /^\d+ accounts? to check now$/)
  }
  {
    const { f, snapshot, r, step } = applied('small')
    assert.equal(step.status, 'done', 'small: everyone affected keeps another way in')
    const ctx: StepVarContext = { snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups }
    assert.ok(emergencyPasskeyTasksOf(step, ctx).tasks.every((t) => !t.required), 'Completed: no task required')
    const card = (step.configurationFindings ?? []).find((c) => c.key === 'affected-passkeys')!
    assert.equal(card.outcome, 'pass')
    assert.match(card.value, /keep another way in$/)
  }
})
