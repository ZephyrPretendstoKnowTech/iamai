// A5 — the passkey settings step and the operator's own passkey.
//
// The target is decision 9's (RUN-CONTEXT-A): the Fido2 method on for all users,
// attestation and key restrictions enforced, an allow list of the Microsoft
// Authenticator AAGUIDs for iOS and Android, self-service registration allowed.
// The step is generated on every plan that can hold Conditional Access: Ready ·
// Create while the tenant's configuration differs (Missing with the method off,
// Partial otherwise), Completed when every field matches, On Hold on a methods
// policy the scan could not read. The verification campaign waits on it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import type { FixtureRun } from './fixtures/run.ts'
import { laneReadings } from '../ui/surfaces/planLanes.ts'
import { laneLabelOf } from '../ui/surfaces/planBoard.ts'
import { stepContract } from '../ui/surfaces/stepContract.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { packageBindings, packageStateOf } from '../ui/surfaces/stepPackage.ts'
import { BLOCKED_REASON } from '../copy/reasons.ts'
import { operatorUserId } from '../derive/operator.ts'
import { OPERATOR_PASSKEY_STEP_ID, PASSKEY_SETTINGS_STEP_ID, PASSKEY_TARGET, PASSKEY_TARGET_AAGUIDS, operatorPasskeyOf, passkeyReadingOf } from './passkeySettings.ts'

const CAMPAIGN = 's-verify-mfa'
const IOS = '90a3ccdf-635c-4729-a248-9b709135078f'
const ANDROID = 'de1e552d-db1d-4423-a619-566b625cdc84'

type Config = { id: string } & Record<string, unknown>

/** The fixture with its Fido2 entry replaced (null removes it). */
function withFido2(f: Fixture, fido2: Record<string, unknown> | null): Fixture {
  const section = f.snapshot.config.authMethodsPolicy!
  const row = section.rows[0] as { authenticationMethodConfigurations: Config[] }
  const others = row.authenticationMethodConfigurations.filter((c) => c.id !== 'Fido2')
  const rows = [{ ...row, authenticationMethodConfigurations: fido2 ? [...others, { id: 'Fido2', ...fido2 }] : others }]
  return { ...f, snapshot: { ...f.snapshot, config: { ...f.snapshot.config, authMethodsPolicy: { ...section, rows } } } }
}

/** The fixture as a scan refused the methods policy read. */
function refused(f: Fixture): Fixture {
  const authMethodsPolicy = { status: 'error' as const, reason: 'Insufficient privileges to complete the operation.', rows: [] }
  return { ...f, snapshot: { ...f.snapshot, config: { ...f.snapshot.config, authMethodsPolicy } } }
}

const matching = (): Record<string, unknown> => structuredClone(PASSKEY_TARGET)

function plan(f: Fixture): { r: FixtureRun; label: (id: string) => string | null; lane: (id: string) => string | undefined } {
  const r = runFixture(f)
  const readings = laneReadings(r.steps)
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
  return {
    r,
    label: (id) => {
      const reading = readings.get(id)
      return reading ? laneLabelOf(reading, titleOf) : null
    },
    lane: (id) => readings.get(id)?.lane,
  }
}

function packageOf(f: Fixture, r: FixtureRun) {
  const step = r.steps.find((s) => s.id === PASSKEY_SETTINGS_STEP_ID)!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const c = stepContract(step, ctx)
  return { state: packageStateOf(step, c, f.snapshot), bindings: packageBindings(step, ctx, c) }
}

test('A5.1 the pinned target is decision 9, with the Authenticator AAGUIDs from Microsoft Learn', () => {
  assert.equal(PASSKEY_TARGET.state, 'enabled')
  assert.deepEqual((PASSKEY_TARGET.includeTargets as { id: string }[]).map((t) => t.id), ['all_users'])
  assert.equal(PASSKEY_TARGET.isAttestationEnforced, true)
  assert.equal(PASSKEY_TARGET.isSelfServiceRegistrationAllowed, true)
  assert.equal(PASSKEY_TARGET.keyRestrictions?.isEnforced, true)
  assert.equal(PASSKEY_TARGET.keyRestrictions?.enforcementType, 'allow')
  assert.deepEqual([...PASSKEY_TARGET_AAGUIDS], [IOS, ANDROID].sort())
})

test('A5.2 the tenant reading: disabled is Missing, on and different is Partial, every field matching is In place, unread is never a match', () => {
  const demo = fixture('demo')
  assert.equal(passkeyReadingOf(withFido2(demo, { state: 'disabled', includeTargets: [{ id: 'all_users' }] }).snapshot).state, 'missing')
  assert.equal(passkeyReadingOf(withFido2(demo, null).snapshot).state, 'missing')
  const partial = passkeyReadingOf(demo.snapshot)
  assert.equal(partial.state, 'partial')
  assert.deepEqual(partial.differs, ['isAttestationEnforced', 'keyRestrictions.isEnforced', 'keyRestrictions.enforcementType', 'keyRestrictions.aaGuids', 'isSelfServiceRegistrationAllowed'])
  assert.deepEqual(passkeyReadingOf(withFido2(demo, matching()).snapshot), { state: 'inPlace', current: { id: 'Fido2', ...matching() }, differs: [] })
  // The allow list is the two AAGUIDs and nothing else, in any case.
  const upper = matching() as { keyRestrictions: { aaGuids: string[] } }
  upper.keyRestrictions.aaGuids = upper.keyRestrictions.aaGuids.map((g) => g.toUpperCase()).reverse()
  assert.equal(passkeyReadingOf(withFido2(demo, upper).snapshot).state, 'inPlace')
  const extra = matching() as { keyRestrictions: { aaGuids: string[] } }
  extra.keyRestrictions.aaGuids.push('ee882879-721c-4913-9775-3dfcce97072a')
  assert.deepEqual(passkeyReadingOf(withFido2(demo, extra).snapshot).differs, ['keyRestrictions.aaGuids'])
  const groupOnly = { ...matching(), includeTargets: [{ targetType: 'group', id: 'pilot-group' }] }
  assert.deepEqual(passkeyReadingOf(withFido2(demo, groupOnly).snapshot).differs, ['includeTargets'])
  assert.equal(passkeyReadingOf(refused(demo).snapshot).state, 'unread')
  assert.equal(passkeyReadingOf(null).state, 'unread')
})

test('A5.3 on the demo (passkeys not configured to the target) the step reads Ready · Create and the campaign waits on it', () => {
  const demo = fixture('demo')
  const { r, label } = plan(demo)
  assert.equal(label(PASSKEY_SETTINGS_STEP_ID), 'Ready · Create')
  assert.equal(label(CAMPAIGN), 'Up Next · After Set Up Passkeys to Match the Baseline')
  const { state, bindings } = packageOf(demo, r)
  // An object step reaches `missing` only (states.ts RUNTIME_REACH); the package's one projection is `missingOrPartial`.
  assert.equal(state, 'missing')
  assert.deepEqual(bindings['passkey.target.fido2Configuration'], PASSKEY_TARGET)
  assert.deepEqual(bindings['passkey.target.allowedAaguids'], [...PASSKEY_TARGET_AAGUIDS])
  assert.equal(bindings['passkey.current.state'], 'partial')
  assert.deepEqual(bindings['passkey.current.differences'], passkeyReadingOf(demo.snapshot).differs)
})

test('A5.4 the method off is Missing and still Ready · Create; the campaign still waits', () => {
  const f = withFido2(fixture('demo'), { state: 'disabled', includeTargets: [] })
  const { r, label } = plan(f)
  assert.equal(label(PASSKEY_SETTINGS_STEP_ID), 'Ready · Create')
  assert.equal(packageOf(f, r).state, 'missing')
  assert.match(label(CAMPAIGN) ?? '', /^Up Next · After Set Up Passkeys/)
})

test('A5.5 every field matching completes the step and releases the campaign from it', () => {
  const f = withFido2(fixture('demo'), matching())
  const { r, lane, label } = plan(f)
  const step = r.steps.find((s) => s.id === PASSKEY_SETTINGS_STEP_ID)
  assert.equal(step?.status, 'done')
  assert.equal(lane(PASSKEY_SETTINGS_STEP_ID), 'Completed')
  assert.doesNotMatch(label(CAMPAIGN) ?? '', /Passkeys/)
})

test('A5.6 a refused methods policy read holds the step on an unresolved fact, never a silent pass', () => {
  const { r, lane, label } = plan(refused(fixture('demo')))
  const step = r.steps.find((s) => s.id === PASSKEY_SETTINGS_STEP_ID)
  assert.ok(step, 'the step stays on the plan')
  assert.deepEqual(step.blockers.map((b) => b.binding), [BLOCKED_REASON.methodsPolicyUnread])
  const reading = laneReadings(r.steps).get(PASSKEY_SETTINGS_STEP_ID)
  assert.equal(reading?.lane, 'On Hold')
  assert.equal(reading?.reason?.kind, 'fact')
  assert.notEqual(lane(CAMPAIGN), 'Ready', `the campaign reads ${label(CAMPAIGN)}`)
})

test('A5.7 the operator passkey step: generated where the operator\'s methods were read and hold no passkey, after the settings', () => {
  const small = fixture('small')
  const operatorId = operatorUserId(small.snapshot)!
  assert.deepEqual(operatorPasskeyOf(small.snapshot), { operatorId, holds: false })
  const { r, label } = plan(small)
  assert.deepEqual(r.steps.find((s) => s.id === OPERATOR_PASSKEY_STEP_ID)?.population.ids, [operatorId])
  assert.equal(label(OPERATOR_PASSKEY_STEP_ID), 'Up Next · After Set Up Passkeys to Match the Baseline')

  const withMethods = (methods: Fixture['snapshot']['authMethods'][string]): Fixture => ({ ...small, snapshot: { ...small.snapshot, authMethods: { ...small.snapshot.authMethods, [operatorId]: methods } } })
  for (const methods of [[{ kind: 'passkey' as const }], [{ kind: 'fido2' as const }], 'unknown' as const]) {
    const f = withMethods(methods)
    assert.equal(runFixture(f).steps.some((s) => s.id === OPERATOR_PASSKEY_STEP_ID), false, `not generated for ${JSON.stringify(methods)}`)
  }
})

test('A5.8 without Conditional Access neither step is generated', () => {
  const r = runFixture(fixture('micro'))
  assert.equal(r.steps.some((s) => s.id === PASSKEY_SETTINGS_STEP_ID || s.id === OPERATOR_PASSKEY_STEP_ID), false)
})
