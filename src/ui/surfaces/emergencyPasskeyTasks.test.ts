import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { emergencyPasskeyTasksOf } from './emergencyPasskeyTasks.ts'
import { emergencyTaskText } from './emergencyAccountTasks.ts'
import { PASSKEY_DEFAULT_MODELS, PASSKEY_TARGET_AAGUIDS, passkeyReadingOf, samePasskeyValue } from '../../roadmap/passkeySettings.ts'

function project() {
  const value = structuredClone(fixture('demo-week2'))
  const run = runFixture(value)
  const step = run.steps.find(row => row.id === 's-prereq-passkey-settings')!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  return emergencyPasskeyTasksOf(step, ctx)
}

function projectProfile(profile: Record<string, unknown> = {}) {
  const value = structuredClone(fixture('demo'))
  const current = {
    id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true,
    defaultPasskeyProfile: 'authenticator',
    includeTargets: [{ id: 'all_users', targetType: 'group', allowedPasskeyProfiles: ['authenticator'] }], excludeTargets: [],
    passkeyProfiles: [{ id: 'authenticator', name: 'Authenticator', passkeyTypes: 'deviceBound,synced', attestationEnforcement: 'registrationOnly', keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids: [...PASSKEY_TARGET_AAGUIDS] }, ...profile }],
  }
  value.snapshot.config.authMethodsPolicy = { status: 'ok', reason: null, rows: [{ authenticationMethodConfigurations: [current] }] }
  const run = runFixture(value)
  const step = run.steps.find(row => row.id === 's-prereq-passkey-settings')!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  return { projected: emergencyPasskeyTasksOf(step, ctx), reading: passkeyReadingOf(value.snapshot, value.mapping) }
}
const projectProfileChange = () => projectProfile().projected
const protectionFacts = (profile: Record<string, unknown>) => projectProfile(profile).projected.tasks.find(row => row.id === 'apply-passkey-settings')!.facts ?? []
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
  value.snapshot.config.authMethodsPolicy = { status: 'ok', reason: null, rows: [{ authenticationMethodConfigurations: [current], fido2Configuration: current }] }
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
  assert.match(rendered, /Replacement registration — only if needed/)
  assert.match(rendered, /Return to IAMAI.*Scan to update the plan/s)
})

test('profile corrections expose only changed fields and do not repeat fact values in the SOP', () => {
  const task = projectProfileChange().tasks.find(row => row.id === 'apply-passkey-settings')!
  const facts = task.facts ?? []
  assert.deepEqual(facts.map(row => row.label), ['Authenticator · Storage'])
  assert.match(facts[0].value, /Device-bound passkeys, Synced passkeys.*→.*Device-bound passkeys/)
  assert.doesNotMatch(facts[0].value, /deviceBound|deviceBound,synced/)
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
  const fact = task.facts?.find(row => row.label === 'Approved models')
  assert.ok(fact)
  assert.ok(fact.value.trim().length > 0)
  for (const aaguid of PASSKEY_TARGET_AAGUIDS) assert.match(fact.value, new RegExp(aaguid, 'i'))
})

test('include-target changes render the resolved target list', () => {
  const task = projectLegacyChange(current => { current.includeTargets = [] }).tasks.find(row => row.id === 'make-passkey-registration-available')!
  const fact = task.facts?.find(row => row.label === 'Included targets')
  assert.ok(fact)
  assert.match(fact.value, /Included targets → None/i)
  assert.doesNotMatch(fact.value, /use the resolved target list/i)
})

test('the same approved models in a different order produce no Approved models row', () => {
  assert.notDeepEqual(GRAPH_ORDER, [...PASSKEY_TARGET_AAGUIDS])
  assert.deepEqual(protectionFacts(allow(GRAPH_ORDER)).map(row => row.label), ['Authenticator · Storage'])
})

test('the same approved models in different letter casing produce no Approved models row', () => {
  assert.deepEqual(protectionFacts(allow(GRAPH_ORDER.map(id => id.toUpperCase()))).map(row => row.label), ['Authenticator · Storage'])
})

test('a reordered, otherwise correct profile reads in place with no protection facts', () => {
  const { projected, reading } = projectProfile({ passkeyTypes: 'deviceBound', ...allow(GRAPH_ORDER) })
  assert.equal(reading.state, 'inPlace')
  assert.deepEqual(reading.differs, [])
  assert.deepEqual(projected.tasks.find(row => row.id === 'apply-passkey-settings')!.facts, [])
})

test('a genuinely different model set still produces a row naming the before and after entries', () => {
  // A disabled list confers no approvals: its dormant Windows Hello entry is removed and the missing YubiKey 5 Series added.
  const current = GRAPH_ORDER.filter(id => id !== '19083c3d-8383-4b18-bc03-8f1c9ab2fd1b').concat(WINDOWS_HELLO)
  const fact = protectionFacts({ keyRestrictions: { isEnforced: false, enforcementType: 'allow', aaGuids: current } }).find(row => row.label === 'Authenticator · Approved models')
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
  assert.deepEqual(protectionFacts(allow([...GRAPH_ORDER, WINDOWS_HELLO])).map(row => row.label), ['Authenticator · Storage'])
  const { reading } = projectProfile({ passkeyTypes: 'deviceBound', ...allow([WINDOWS_HELLO, ...GRAPH_ORDER]) })
  assert.equal(reading.state, 'inPlace')
})
