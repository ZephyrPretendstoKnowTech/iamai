// Passkey target preservation, concrete findings, and scan-driven completion.
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
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import { BLOCKED_REASON } from '../copy/reasons.ts'
import { operatorUserId } from '../derive/operator.ts'
import { OPERATOR_PASSKEY_STEP_ID, PASSKEY_SETTINGS_STEP_ID, PASSKEY_TARGET, PASSKEY_DEFAULT_MODELS, PASSKEY_TARGET_AAGUIDS, operatorPasskeyOf, passkeyReadingOf, resolvePasskeyTarget } from './passkeySettings.ts'
import type { Fido2Configuration, PasskeyResolution } from './passkeySettings.ts'

const CAMPAIGN = 's-verify-mfa'
const IOS = '90a3ccdf-635c-4729-a248-9b709135078f'
const ANDROID = 'de1e552d-db1d-4423-a619-566b625cdc84'
/** A hardware key model the tenant already allows (a synthetic AAGUID). */
const HARDWARE = 'cb69481e-8ff7-4039-93ec-0a2729a154a8'
/** A model someone registered that nobody approved (a synthetic AAGUID). */
const UNAPPROVED = '6d44ba9b-f6ec-2e49-b930-0c8fe920cb73'

type Config = { id: string } & Record<string, unknown>
const everyone = { targetType: 'group', id: 'all_users', isRegistrationRequired: false, allowedPasskeyProfiles: [] as string[] }
/** A complete v1.0 read of a policy without profiles: every setting the target is built from, profile assignments read and empty. */
const legacy = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  state: 'enabled',
  isSelfServiceRegistrationAllowed: true,
  isAttestationEnforced: true,
  keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids: [...PASSKEY_TARGET_AAGUIDS] },
  includeTargets: [everyone],
  excludeTargets: [],
  ...over,
})
const allow = (...aaGuids: string[]) => ({ keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids } })

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

function targetOf(r: PasskeyResolution | null): Extract<PasskeyResolution, { kind: 'target' }> {
  if (r === null || r.kind !== 'target') assert.fail(`no target was resolved: ${JSON.stringify(r)}`)
  return r
}
const resolved = (fido2: Record<string, unknown>) => resolvePasskeyTarget({ id: 'Fido2', ...fido2 } as Fido2Configuration)

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

function contextOf(f: Fixture, r: FixtureRun): StepVarContext {
  return { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
}

function packageOf(f: Fixture, r: FixtureRun) {
  const step = r.steps.find((s) => s.id === PASSKEY_SETTINGS_STEP_ID)!
  const ctx = contextOf(f, r)
  const c = stepContract(step, ctx)
  return { step, ctx, state: packageStateOf(step, c, f.snapshot), bindings: packageBindings(step, ctx, c) }
}

test('A5.1 the pinned object carries the approved Authenticator AAGUIDs from Microsoft Learn and the product settings', () => {
  assert.equal(PASSKEY_TARGET.state, 'enabled')
  assert.deepEqual((PASSKEY_TARGET.includeTargets as { id: string }[]).map((t) => t.id), ['all_users'])
  assert.equal(PASSKEY_TARGET.isAttestationEnforced, true)
  assert.equal(PASSKEY_TARGET.isSelfServiceRegistrationAllowed, true)
  assert.equal(PASSKEY_TARGET.keyRestrictions?.isEnforced, true)
  assert.equal(PASSKEY_TARGET.keyRestrictions?.enforcementType, 'allow')
  assert.deepEqual([...PASSKEY_TARGET_AAGUIDS], PASSKEY_DEFAULT_MODELS.map(m => m.aaguid).sort())
})

test('A5.2 the tenant reading against its resolved target: disabled is Missing, on and different is Partial, every field matching is In place, unread is never a match', () => {
  const demo = fixture('demo')
  assert.equal(passkeyReadingOf(withFido2(demo, legacy({ state: 'disabled' })).snapshot).state, 'missing')
  assert.equal(passkeyReadingOf(withFido2(demo, null).snapshot).state, 'missing')
  // A known allow list with attestation disabled has one concrete correction.
  const partial = passkeyReadingOf(withFido2(demo, legacy({ isAttestationEnforced: false })).snapshot)
  assert.equal(partial.state, 'partial')
  assert.deepEqual(partial.differs, ['isAttestationEnforced'])
  assert.equal(passkeyReadingOf(withFido2(demo, legacy()).snapshot).state, 'inPlace')
  // The allow list is compared as a set: any case, any order.
  assert.equal(passkeyReadingOf(withFido2(demo, legacy(allow(...PASSKEY_TARGET_AAGUIDS.map(id => id.toUpperCase()).reverse()))).snapshot).state, 'inPlace')
  assert.deepEqual(passkeyReadingOf(withFido2(demo, legacy({ includeTargets: [{ ...everyone, id: 'pilot-group' }] })).snapshot).differs, [], 'an existing pilot scope is preserved')
  assert.equal(passkeyReadingOf(refused(demo).snapshot).state, 'unread')
  assert.equal(passkeyReadingOf(null).state, 'unread')
})

test('A5.3 on the demo the step reads Ready · Correct, the campaign waits on it, and the bound target is the one resolved from the tenant', () => {
  const demo = withFido2(fixture('demo'), legacy({ isAttestationEnforced: false }))
  const { r, label } = plan(demo)
  assert.equal(label(PASSKEY_SETTINGS_STEP_ID), 'Ready · Correct')
  assert.equal(label(CAMPAIGN), 'Up Next')
  const { state, bindings } = packageOf(demo, r)
  // An object step reaches `missing` only (states.ts RUNTIME_REACH); the package's one projection is `missingOrPartial`.
  assert.equal(state, 'missing')
  const target = targetOf(passkeyReadingOf(demo.snapshot).resolution).target
  assert.deepEqual(bindings['passkey.target.fido2Configuration'], target)
  assert.deepEqual(target.keyRestrictions, { isEnforced: true, enforcementType: 'allow', aaGuids: [...PASSKEY_TARGET_AAGUIDS] })
  assert.deepEqual(bindings['passkey.target.allowedAaguids'], [...PASSKEY_TARGET_AAGUIDS])
  assert.equal(bindings['passkey.current.state'], 'partial')
  assert.deepEqual(bindings['passkey.current.differences'], ['isAttestationEnforced'])
  assert.match(String(bindings['passkey.target.summary']), /allow list/i)
})

test('A5.4 the method off is Missing and still Ready · Correct; the campaign still waits', () => {
  const f = withFido2(fixture('demo'), legacy({ state: 'disabled' }))
  const { r, label } = plan(f)
  assert.equal(label(PASSKEY_SETTINGS_STEP_ID), 'Ready · Correct')
  assert.equal(packageOf(f, r).state, 'missing')
  assert.equal(label(CAMPAIGN), 'Up Next')
})

test('A5.5 every field matching completes the step and releases the campaign from it', () => {
  const f = withFido2(fixture('demo'), legacy())
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
  assert.equal(reading?.lane, 'Ready')
  assert.equal(reading?.substatus, 'Review')
  assert.equal(reading?.reason, null)
  assert.notEqual(lane(CAMPAIGN), 'Ready', `the campaign reads ${label(CAMPAIGN)}`)
})

test('A5.7 the operator passkey step: generated where the operator\'s methods were read and hold no passkey, after the settings', () => {
  const small = fixture('small')
  const operatorId = operatorUserId(small.snapshot)!
  assert.deepEqual(operatorPasskeyOf(small.snapshot), { operatorId, holds: false })
  const { r, label } = plan(small)
  assert.deepEqual(r.steps.find((s) => s.id === OPERATOR_PASSKEY_STEP_ID)?.population.ids, [operatorId])
  assert.notEqual(label(OPERATOR_PASSKEY_STEP_ID), 'Completed')

  const withMethods = (methods: Fixture['snapshot']['authMethods'][string]): Fixture => ({ ...small, snapshot: { ...small.snapshot, authMethods: { ...small.snapshot.authMethods, [operatorId]: methods } } })
  for (const methods of [[{ kind: 'passkey' as const }], [{ kind: 'fido2' as const }], 'unknown' as const]) {
    const f = withMethods(methods)
    assert.equal(runFixture(f).steps.some((s) => s.id === OPERATOR_PASSKEY_STEP_ID), methods !== 'unknown', `known passkeys retain their step; unknown is not proof for ${JSON.stringify(methods)}`)
  }
})

test('A5.8 without Conditional Access neither step is generated', () => {
  const r = runFixture(fixture('micro'))
  assert.equal(r.steps.some((s) => s.id === PASSKEY_SETTINGS_STEP_ID || s.id === OPERATOR_PASSKEY_STEP_ID), false)
})

test('B.1 an allow list keeps its existing hardware model and gains the approved Authenticator models; once they are there the hardware model is not drift', () => {
  const r = targetOf(resolved(legacy(allow(HARDWARE))))
  assert.deepEqual(r.retained, [HARDWARE])
  assert.deepEqual(r.added, [...PASSKEY_TARGET_AAGUIDS])
  assert.deepEqual(r.target.keyRestrictions, { isEnforced: true, enforcementType: 'allow', aaGuids: [HARDWARE, ...PASSKEY_TARGET_AAGUIDS] })
  assert.equal(passkeyReadingOf(withFido2(fixture('demo'), legacy(allow(HARDWARE))).snapshot).state, 'partial')
  assert.equal(passkeyReadingOf(withFido2(fixture('demo'), legacy(allow(HARDWARE, ...PASSKEY_TARGET_AAGUIDS))).snapshot).state, 'inPlace')
})

test('B.2 duplicates and case: each model once, as Graph returned it first, compared case-insensitively', () => {
  const r = targetOf(resolved(legacy(allow(IOS.toUpperCase(), IOS, HARDWARE, HARDWARE.toUpperCase()))))
  assert.deepEqual(r.retained, [IOS.toUpperCase(), HARDWARE])
  assert.deepEqual(r.added, PASSKEY_TARGET_AAGUIDS.filter(id => id !== IOS))
  assert.deepEqual(r.target.keyRestrictions?.aaGuids, [IOS.toUpperCase(), HARDWARE, ...PASSKEY_TARGET_AAGUIDS.filter(id => id !== IOS)])
})

test('B.3 an unrestricted policy needs approved-model selection, never a silent narrowing', () => {
  const kept = { isEnforced: false, enforcementType: 'block', aaGuids: [HARDWARE] }
  const current = legacy({ keyRestrictions: kept })
  assert.deepEqual(resolved(current), { kind: 'review', review: 'modelSelection', subjects: ['unrestricted'] })
  assert.deepEqual(current.keyRestrictions, kept)
})

test('B.4 a block list that blocks Authenticator is reviewed, never overridden: no target is bound and the step holds on it', () => {
  const f = withFido2(fixture('demo'), legacy({ keyRestrictions: { isEnforced: true, enforcementType: 'block', aaGuids: [HARDWARE, IOS] } }))
  const reading = passkeyReadingOf(f.snapshot)
  assert.equal(reading.state, 'review')
  assert.deepEqual(reading.resolution, { kind: 'review', review: 'blockListConflict', subjects: [IOS] })
  const { r, lane } = plan(f)
  assert.match(r.steps.find((s) => s.id === PASSKEY_SETTINGS_STEP_ID)!.blockers.map(b => b.binding).join(' '), /Block list/)
  assert.equal(lane(PASSKEY_SETTINGS_STEP_ID), 'Ready')
  const { bindings } = packageOf(f, r)
  assert.equal(bindings['passkey.target.fido2Configuration'], undefined)
  assert.match(String(bindings['passkey.review.detail']), /does not remove a block list entry/)
  // A block list that does not block Authenticator is kept as it is.
  const other = resolved(legacy({ keyRestrictions: { isEnforced: true, enforcementType: 'block', aaGuids: [HARDWARE] } }))
  assert.deepEqual(other, { kind: 'review', review: 'modelSelection', subjects: ['block'] })
})

test('B.5 a profile-based policy keeps its profiles and assignments: nothing legacy is written over it and the step holds on the review', () => {
  const assigned = legacy({ includeTargets: [{ targetType: 'group', id: 'finance', isRegistrationRequired: false, allowedPasskeyProfiles: ['11111111-1111-4111-8111-111111111111'] }] })
  for (const fido2 of [assigned, legacy({ defaultPasskeyProfile: '11111111-1111-4111-8111-111111111111' }), legacy({ passkeyProfiles: [{ id: 'p', name: 'Finance' }] })]) {
    assert.equal(resolved(fido2).kind === 'review' && (resolved(fido2) as { review: string }).review, 'profiles', JSON.stringify(fido2))
  }
  const f = withFido2(fixture('demo'), assigned)
  const { r, lane } = plan(f)
  assert.match(r.steps.find((s) => s.id === PASSKEY_SETTINGS_STEP_ID)!.blockers.map(b => b.binding).join(' '), /Method Availability: Not fully read/)
  assert.equal(lane(PASSKEY_SETTINGS_STEP_ID), 'Ready')
  const { step, ctx, bindings } = packageOf(f, r)
  assert.equal(bindings['passkey.target.fido2Configuration'], undefined, 'no legacy request is built over profiles')
  // The planned JSON stays a stand-in: no request body with key restrictions is offered anywhere.
  const ai = stepBodyOf(step, ctx).artifacts.find((a) => a.id === 'ai')!.text()
  assert.doesNotMatch(ai, /"keyRestrictions"/)
  assert.match(String(bindings['passkey.review.detail']), /not read/i)
})

test('B.6 groups and exclusions are kept: nobody excluded is newly included', () => {
  const r = targetOf(resolved(legacy({ includeTargets: [{ ...everyone, id: 'staff' }], excludeTargets: [{ targetType: 'group', id: 'contractors' }] })))
  assert.deepEqual(r.target.excludeTargets, [{ targetType: 'group', id: 'contractors' }])
  const included = (r.target.includeTargets as { id: string }[]).map((t) => t.id)
  assert.deepEqual(included, ['staff'], 'preserving hardware access must not enable a new population')
  assert.equal(included.includes('contractors'), false)
})

test('B.7 profile assignments missing from the read stay unknown: never In place, never a request', () => {
  const unread = legacy({ includeTargets: [{ targetType: 'group', id: 'all_users', isRegistrationRequired: false }] })
  const reading = passkeyReadingOf(withFido2(fixture('demo'), unread).snapshot)
  assert.equal(reading.state, 'review')
  assert.deepEqual(reading.resolution, { kind: 'review', review: 'partialRead', subjects: ['includeTargets.allowedPasskeyProfiles'] })
  const minimal = resolved({ state: 'enabled', includeTargets: [{ id: 'all_users' }] })
  assert.equal(minimal.kind, 'review')
  assert.ok((minimal as { subjects: string[] }).subjects.includes('keyRestrictions'))
  const f = withFido2(fixture('demo'), unread)
  assert.deepEqual(plan(f).r.steps.find((s) => s.id === PASSKEY_SETTINGS_STEP_ID)!.blockers.map((b) => b.binding), [BLOCKED_REASON.passkeyPartialRead])
})

test('B.8 an allowed model nobody registered is retained, and a registered model nobody approved is not added', () => {
  const base = withFido2(fixture('demo'), legacy(allow(HARDWARE)))
  // Every account the scan read holds a key of a model the allow list does not name.
  const methods = Object.fromEntries(Object.keys(base.snapshot.authMethods ?? {}).map((id) => [id, [{ kind: 'fido2', aaGuid: UNAPPROVED }]]))
  const f = { ...base, snapshot: { ...base.snapshot, authMethods: methods } } as unknown as Fixture
  const { bindings } = packageOf(f, runFixture(f))
  const aaGuids = (bindings['passkey.target.fido2Configuration'] as { keyRestrictions: { aaGuids: string[] } }).keyRestrictions.aaGuids
  assert.deepEqual(aaGuids, [HARDWARE, ...PASSKEY_TARGET_AAGUIDS])
  assert.equal(aaGuids.includes(UNAPPROVED), false)
})

test('B.9 one resolved target in every channel: the bound request, the Entra walkthrough and AI Info say the same models', () => {
  const staff = '00000000-0000-4000-8000-000000000123'
  const f = withFido2(fixture('demo'), legacy({ isAttestationEnforced: false, includeTargets: [{ ...everyone, id: staff }], ...allow(HARDWARE) }))
  const r = runFixture(f)
  const { step, ctx, bindings } = packageOf(f, r)
  const target = targetOf(passkeyReadingOf(f.snapshot).resolution).target
  assert.deepEqual(bindings['passkey.target.fido2Configuration'], target)
  const body = stepBodyOf(step, ctx)
  const entra = body.artifacts.find((a) => a.id === 'portal')!.text()
  const ai = body.artifacts.find((a) => a.id === 'ai')!.text()
  assert.doesNotMatch(ai, /Passkey \(FIDO2\) → Enable: On; Target: All users/, 'fallback facts must not widen the resolved passkey population')
  assert.match(ai, /keep the target groups and exclusions shown in the resolved configuration/)
  assert.deepEqual((target.includeTargets as { id: string }[]).map(t => t.id), [staff])
  for (const text of [entra, ai]) {
    assert.match(text, /Microsoft Authenticator/)
    assert.ok(text.includes(`Keep the allow list and its existing allowed models (${HARDWARE}); add approved authenticator models (${PASSKEY_TARGET_AAGUIDS.join(', ')}).`), text)
  }
  // AI Info's intended result carries the request the step's JSON sends, whole.
  const sent = ai.split('\n').find((l) => l.startsWith('{"@odata.type"'))
  assert.ok(sent, 'the request body is in the briefing')
  assert.deepEqual(JSON.parse(sent), target)
})
