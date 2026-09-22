import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { emergencyPasskeyTasksOf } from './emergencyPasskeyTasks.ts'
import { emergencyImplementation } from './emergencyImplementation.ts'
import { passkeyRestrictionReading } from '../../roadmap/passkeyRestrictions.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
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
function withFido2(snapshot: TenantSnapshot, current: Record<string, unknown>, extra: Record<string, unknown> = {}): void {
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

test('Step 3 keeps exactly four persistent outcome tasks and no per-user task IDs', () => {
  const projected = project()
  assert.deepEqual(projected.tasks.map(task => task.id), ['inspect-passkey-settings', 'make-passkey-registration-available', 'prepare-affected-passkeys', 'apply-passkey-settings'])
  assert.equal(projected.tasks.some(task => task.id.includes(':')), false)
  assert.equal(projected.printAll, true)
})

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

test('inspection instructions do not refer to facts when no facts are projected', () => {
  const task = project().tasks.find(row => row.id === 'inspect-passkey-settings')!
  if ((task.facts ?? []).length === 0) assert.doesNotMatch(task.steps.join('\n'), /shown above|displayed intended values/i)
})

test('legacy approved-model changes expose exact nonblank AAGUID values', () => {
  const task = projectLegacyChange(() => undefined).tasks.find(row => row.id === 'apply-passkey-settings')!
  const fact = task.readinessFacts?.find(row => row.label === 'Approved models')
  assert.ok(fact)
  assert.ok(fact.value.trim().length > 0)
  for (const aaguid of PASSKEY_TARGET_AAGUIDS) assert.match(fact.value, new RegExp(aaguid, 'i'))
})

test('include-target changes are set in the step, never "None"', () => {
  const task = projectLegacyChange(current => { current.includeTargets = [] }).tasks.find(row => row.id === 'make-passkey-registration-available')!
  assert.equal(task.facts, undefined)
  assert.ok(task.steps.includes('Under **Include**, add the users or groups who register passkeys, including the emergency accounts.'), task.steps.join('\n'))
  assert.doesNotMatch(task.steps.join('\n'), /target \*\*None\*\*|use the resolved target list/i)
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

test('protections: navigate first, then apply each value inline, one Save per Add AAGUID entry', () => {
  // A GetIAMAI-shaped profile: attestation enforced, stored types "deviceBound,synced"
  // (the portal shows Device-bound), no restrictions. Enforced attestation already
  // limits registration to device-bound passkeys, so Passkey types is no step.
  const steps = protectionSteps({ name: 'Default passkey profile', passkeyTypes: 'deviceBound,synced', attestationEnforcement: 'registrationOnly', keyRestrictions: { isEnforced: false, enforcementType: 'block', aaGuids: [] } })
  assert.deepEqual(steps, [
    'Keep your working administrator session open.',
    'Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Authentication methods → Policies → Passkey (FIDO2)**.',
    'Open **Default passkey profile**.',
    'Select **Target specific AAGUIDs** and set **Behavior** to **Allow**.',
    'Select **+ Add AAGUID → Microsoft Authenticator**, then **Save**.',
    'Select **+ Add AAGUID → Enter AAGUID**, enter **19083c3d-8383-4b18-bc03-8f1c9ab2fd1b** (YubiKey 5 Series), then **Save**.',
    'Select **+ Add AAGUID → Enter AAGUID**, enter **a25342c0-3cdc-4414-8e46-f4807fca511c** (YubiKey 5 Series with NFC), then **Save**.',
    'Return to IAMAI and select **Scan to update the plan**.',
  ])
})

test('protections: a satisfied value produces no step, and an AAGUID is never a header block', () => {
  // Only the Android model is missing; storage and restrictions already match.
  const steps = protectionSteps({ passkeyTypes: 'deviceBound', attestationEnforcement: 'registrationOnly', keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids: GRAPH_ORDER.filter(id => id !== 'de1e552d-db1d-4423-a619-566b625cdc84') } })
  const text = steps.join('\n')
  assert.doesNotMatch(text, /Passkey types|Target specific AAGUIDs|Enforce attestation|Apply only the changed values/)
  assert.deepEqual(steps.slice(2, -1), ['Open **Authenticator**.', 'Select **+ Add AAGUID → Microsoft Authenticator**, then **Save**.'])
  const task = projectProfile({ passkeyTypes: 'deviceBound', attestationEnforcement: 'registrationOnly', keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids: [] } }).projected.tasks.find(row => row.id === 'apply-passkey-settings')!
  for (const line of task.steps) if (/19083c3d|a25342c0/.test(line)) assert.match(line, /^Select \*\*\+ Add AAGUID → Enter AAGUID\*\*, enter/)
  assert.equal(task.facts, undefined)
})

test('protections: a legacy configuration is changed on Configure, each AAGUID entered where it is typed', () => {
  const task = projectLegacyChange(() => undefined).tasks.find(row => row.id === 'apply-passkey-settings')!
  const [, , open, ...rest] = task.steps
  assert.equal(open, 'Open **Configure**.')
  assert.equal(rest.at(-1), 'Return to IAMAI and select **Scan to update the plan**.')
  const entered = rest.filter(line => line.startsWith('Select **Add AAGUID** and enter'))
  assert.equal(entered.length, PASSKEY_TARGET_AAGUIDS.length - 1)
  assert.equal(rest.at(-2), 'Select **Save**.')
})

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

function onMidflight(change: (snapshot: TenantSnapshot, ids: string[]) => void = () => {}) {
  const value = structuredClone(fixture('midflight'))
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
  const { projected, reading, upn } = onMidflight()
  assert.equal(reading.stranded.length, 11, 'the premise: eleven accounts hold passkeys whose model the scan could not read')
  assert.equal(reading.lockedOut.length, 0, 'the premise: each keeps Microsoft Authenticator')
  assert.equal(projected.recommendedTaskId, 'prepare-affected-passkeys', 'the step opens on the Save that stops their passkeys')
  const prepare = task(projected, 'prepare-affected-passkeys')
  assert.equal(prepare.required, true)
  const lead = prepare.steps[0]
  for (const id of reading.stranded.slice(0, 5)) assert.ok(lead.includes(upn(id)), `${upn(id)} is not named: ${lead}`)
  assert.match(lead, /and 6 more/)
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
  assert.match(lead, /Key restrictions stay off for now/)
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
  assert.match(prepare[0], /sign in once with their passkey/)
  assert.notEqual(projected.recommendedTaskId, 'prepare-affected-passkeys', 'nothing is waiting on preparing them any more')
})
