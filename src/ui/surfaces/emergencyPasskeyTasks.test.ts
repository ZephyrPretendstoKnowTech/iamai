import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { emergencyPasskeyTasksOf } from './emergencyPasskeyTasks.ts'
import { emergencyTaskText } from './emergencyAccountTasks.ts'
import { PASSKEY_TARGET_AAGUIDS } from '../../roadmap/passkeySettings.ts'

function project() {
  const value = structuredClone(fixture('demo-week2'))
  const run = runFixture(value)
  const step = run.steps.find(row => row.id === 's-prereq-passkey-settings')!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  return emergencyPasskeyTasksOf(step, ctx)
}

function projectProfileChange() {
  const value = structuredClone(fixture('demo'))
  const current = {
    id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true,
    defaultPasskeyProfile: 'authenticator',
    includeTargets: [{ id: 'all_users', targetType: 'group', allowedPasskeyProfiles: ['authenticator'] }], excludeTargets: [],
    passkeyProfiles: [{ id: 'authenticator', name: 'Authenticator', passkeyTypes: 'deviceBound,synced', attestationEnforcement: 'registrationOnly', keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids: [...PASSKEY_TARGET_AAGUIDS] } }],
  }
  value.snapshot.config.authMethodsPolicy = { status: 'ok', reason: null, rows: [{ authenticationMethodConfigurations: [current] }] }
  const run = runFixture(value)
  const step = run.steps.find(row => row.id === 's-prereq-passkey-settings')!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  return emergencyPasskeyTasksOf(step, ctx)
}

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
