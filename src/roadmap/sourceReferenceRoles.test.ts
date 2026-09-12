// Source references by the part they play (Batch 2, C6). A reference of the
// baseline's author can say who a policy reaches (include), who it spares
// (exclude), or both, and "none needed here" means something different for each:
// leaving out an exception keeps the people it spared in scope; leaving out part
// of who a policy reaches narrows it; and leaving out the whole of who or where a
// policy applies does not narrow it, it empties it — a users condition with nobody
// included is not a policy, and a block whose only included location is gone
// blocks everywhere. There that answer does not stand, and the reference is asked
// again. An answer that changes takes what was confirmed against the old one with
// it, and no author id ever becomes a tenant id.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { applyStepDecisions } from './decisions.ts'
import { answerTextFor, referenceOptions } from './answers.ts'
import { BASELINE_MAPPINGS_KEY, sourceMappingsOf, unresolvedSourceMappings } from './sourceMappings.ts'
import { implementationOffered, operationsOf } from './operations.ts'
import { implementable, resolveTenantPolicy, tenantObjectsOf } from './resolvePolicy.ts'
import type { RawPolicy } from './resolvePolicy.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { emptyMappingState } from '../mapping/types.ts'
import type { Step } from './types.ts'
import { stepContract } from '../ui/surfaces/stepContract.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { implementationPackageFor, packageBindings, packageStateOf } from '../ui/surfaces/stepPackage.ts'
import { prerequisiteBasis, prerequisiteStatus } from '../content/implementation/project.ts'

const SOURCE = BASELINE_MAPPINGS_KEY
const OMIT = (): string => referenceOptions()[0]
const MAP = (id: string): string => answerTextFor(referenceOptions()[1], [id])
const AT = '2026-09-11T00:00:00Z'

// The pinned baseline's own references, one for each part a reference plays.
const BROAD = '62d67e66-2bc9-43cd-b00c-6326dae53d18' // excluded from 23 policies, included by none
const PASSKEY_PILOT = '1178bb5d-4f19-4b69-b33b-44eb7f5b39c9' // the whole of who one policy reaches
const ADMIN_PASSKEYS = '5f96c57d-380f-4872-97ff-cfd74ef1ac1a' // the whole of who another reaches
const BLOCKED_COUNTRIES = '1267ac22-ce4d-4a2e-ae00-fd3a3a7f4748' // the only location a block policy names
const EAM = '8d0564e5-ab28-4283-9a94-9883c581adde' // included by one policy, excluded from its sibling

const DEVICE_REGISTRATION = 'aeb49474-5250-4b65-8b0a-56c47127ee0f'
const PASSKEY_REGISTRATION = '30a1edce-e832-456b-b2c5-4b1098d3a9b3'
const COUNTRIES_NO_EXCLUSIONS = '1eaf943a-abad-4c77-b101-0c5342fc1044'
const EAM_RISK = 'bb6a814e-808a-467c-9475-06f89140ce99'
const RISK = '544cd9ef-5e37-4568-9ad8-b8e151be1814'
const LEGACY = '9eab445f-7f21-479a-85c9-29769512067e'

const pkg = pinnedPackage()
const policyOf = (id: string): RawPolicy => {
  const p = pkg.policies.find((x) => x.id === id)
  assert.ok(p, `${id} is pinned`)
  return p as unknown as RawPolicy
}

/** One pinned policy resolved for a tenant whose answers went through the real decision path. */
function resolve(policy: RawPolicy, answers: Record<string, string>) {
  const mapping = applyStepDecisions(emptyMappingState('t'), { [SOURCE]: { answers, at: AT } })
  const resolved = resolveTenantPolicy(policy, tenantObjectsOf(mapping, null, 'tenant-exclusions'), 'x', pkg.policies)
  const whole = implementable(resolved.body, resolved)
  const conditions = whole.policy.conditions as { users: Record<string, unknown>; locations?: Record<string, unknown> }
  const waitsOn = (id: string) => whole.missing.find((m) => m.token.toLowerCase() === id)
  return { resolved, whole, users: conditions.users, locations: conditions.locations, waitsOn, text: JSON.stringify(whole.policy).toLowerCase() }
}

test('an exception left out keeps the people it spared in scope; mapped, it is the tenant’s group', () => {
  const pending = resolve(policyOf(DEVICE_REGISTRATION), {})
  assert.deepEqual(pending.waitsOn(BROAD), { token: pending.waitsOn(BROAD)?.token, stepId: null, decision: true })
  const omit = resolve(policyOf(DEVICE_REGISTRATION), { [BROAD]: OMIT() })
  assert.equal(omit.waitsOn(BROAD), undefined, 'an exception left out holds nothing')
  assert.ok(omit.whole.omitted.map((x) => x.toLowerCase()).includes(BROAD), 'and is reported as the person’s answer')
  assert.equal(omit.resolved.decisions.get(BROAD)?.answer, 'omitted')
  assert.deepEqual(omit.users.includeUsers, ['All'], 'who the policy reaches is unchanged')
  assert.equal(omit.text.includes(BROAD), false)
  const map = resolve(policyOf(DEVICE_REGISTRATION), { [BROAD]: MAP('tenant-group') })
  assert.ok((map.users.excludeGroups as string[]).includes('tenant-group'), 'the tenant’s group is the exception')
  assert.equal(map.waitsOn(BROAD), undefined)
  assert.equal(map.text.includes(BROAD), false)
})

test('the whole of who a policy reaches is never left out: the reference is asked again and the policy waits', () => {
  const omit = resolve(policyOf(PASSKEY_REGISTRATION), { [PASSKEY_PILOT]: OMIT() })
  assert.deepEqual(omit.waitsOn(PASSKEY_PILOT), { token: omit.waitsOn(PASSKEY_PILOT)?.token, stepId: null, decision: true }, 'a users condition with nobody included was handed over')
  assert.equal(omit.resolved.decisions.get(PASSKEY_PILOT)?.answer, 'pending')
  assert.equal(omit.whole.omitted.map((x) => x.toLowerCase()).includes(PASSKEY_PILOT), false)
  assert.equal(omit.text.includes(PASSKEY_PILOT), false, 'the author’s id is in no body')
  const map = resolve(policyOf(PASSKEY_REGISTRATION), { [PASSKEY_PILOT]: MAP('tenant-group') })
  assert.deepEqual(map.users.includeGroups, ['tenant-group'], 'mapped, the tenant’s group is who it reaches')
  assert.equal(map.waitsOn(PASSKEY_PILOT), undefined)
})

test('the only location a block names is never left out: a block without it would block everywhere', () => {
  const omit = resolve(policyOf(COUNTRIES_NO_EXCLUSIONS), { [BLOCKED_COUNTRIES]: OMIT(), [BROAD]: OMIT() })
  assert.ok(omit.waitsOn(BLOCKED_COUNTRIES)?.decision, JSON.stringify(omit.locations))
  assert.equal(omit.waitsOn(BROAD), undefined, 'the exception beside it still stands left out')
  const map = resolve(policyOf(COUNTRIES_NO_EXCLUSIONS), { [BLOCKED_COUNTRIES]: MAP('tenant-location'), [BROAD]: OMIT() })
  assert.deepEqual(map.locations?.includeLocations, ['tenant-location'])
  assert.equal(map.whole.missing.length, 0, JSON.stringify(map.whole.missing))
})

test('part of who a policy reaches left out narrows it, and stands', () => {
  const policy = structuredClone(policyOf(PASSKEY_REGISTRATION))
  ;((policy.conditions as { users: Record<string, unknown> }).users).includeGroups = [PASSKEY_PILOT, ADMIN_PASSKEYS]
  const narrowed = resolve(policy, { [PASSKEY_PILOT]: OMIT(), [ADMIN_PASSKEYS]: MAP('tenant-group') })
  assert.deepEqual(narrowed.users.includeGroups, ['tenant-group'])
  assert.equal(narrowed.waitsOn(PASSKEY_PILOT), undefined)
  assert.ok(narrowed.whole.omitted.map((x) => x.toLowerCase()).includes(PASSKEY_PILOT))
  const emptied = resolve(policy, { [PASSKEY_PILOT]: OMIT(), [ADMIN_PASSKEYS]: OMIT() })
  for (const id of [PASSKEY_PILOT, ADMIN_PASSKEYS]) assert.ok(emptied.waitsOn(id)?.decision, `${id}: leaving out every group it reaches emptied the policy`)
})

test('a reference that is a target in one policy and an exception in another: left out, only the exception stands', () => {
  const exception = resolve(policyOf(RISK), { [EAM]: OMIT() })
  assert.equal(exception.waitsOn(EAM), undefined)
  assert.equal((exception.users.excludeGroups as string[]).some((g) => g.toLowerCase() === EAM), false)
  assert.deepEqual(exception.users.includeUsers, ['All'])
  const target = resolve(policyOf(EAM_RISK), { [EAM]: OMIT() })
  assert.ok(target.waitsOn(EAM)?.decision, 'the policy whose whole target it is waits')
  const mappedException = resolve(policyOf(RISK), { [EAM]: MAP('tenant-group') })
  const mappedTarget = resolve(policyOf(EAM_RISK), { [EAM]: MAP('tenant-group') })
  assert.ok((mappedException.users.excludeGroups as string[]).includes('tenant-group'))
  assert.deepEqual(mappedTarget.users.includeGroups, ['tenant-group'])
})

// ---- on the plan ----

const stepOf = (steps: Step[], id: string): Step => {
  const s = steps.find((x) => x.id === id)
  assert.ok(s, `${id} is on the plan`)
  return s
}
const withAnswers = (f: Fixture, answers: Record<string, string>): Fixture => ({ ...f, mapping: applyStepDecisions(f.mapping, { [SOURCE]: { answers, at: f.snapshot.asOf } }) })
const ctxOf = (f: Fixture, r: ReturnType<typeof runFixture>): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups })

test('on the plan, a reference left out where it is a policy’s whole target keeps the step asking, and only that policy waits', () => {
  // The demo, with the legacy-authentication block reaching the broad group instead of everyone: the group is then a target there and an exception everywhere else.
  const base = fixture('demo')
  const legacy = structuredClone(policyOf(LEGACY))
  const users = (legacy.conditions as { users: Record<string, unknown> }).users
  users.includeUsers = []
  users.includeGroups = [BROAD]
  users.excludeGroups = (users.excludeGroups as string[]).filter((g) => g.toLowerCase() !== BROAD)
  const f: Fixture = { ...base, baseline: { ...base.baseline, policies: base.baseline.policies.map((p) => (p.id === LEGACY ? (legacy as never) : p)) } }
  const pending = sourceMappingsOf(runFixture(f).steps)
  const broad = pending.find((r) => r.id.toLowerCase() === BROAD)
  assert.equal(broad?.role, 'both', 'the premise: the group is a target in one policy and an exception in others')
  assert.ok(broad?.stepIds?.includes('s-goal-block-legacy-auth'), 'the premise: the legacy block names it')
  const r = runFixture(withAnswers(f, Object.fromEntries(pending.map((p) => [p.id, OMIT()]))))
  assert.equal(sourceMappingsOf(r.steps).find((x) => x.id.toLowerCase() === BROAD)?.answer, 'pending', 'an answer that does not stand for every policy is still open')
  assert.ok(unresolvedSourceMappings(r.steps).length > 0, 'the mapping is still asked')
  const block = stepOf(r.steps, 's-goal-block-legacy-auth')
  assert.ok((block.action.missing ?? []).some((m) => m.decision && m.token.toLowerCase() === BROAD), 'the policy whose whole target it is waits on the answer')
  assert.equal(implementationOffered(block), false)
  for (const id of (broad?.stepIds ?? []).filter((s) => s !== 's-goal-block-legacy-auth')) {
    assert.equal((stepOf(r.steps, id).action.missing ?? []).some((m) => m.token.toLowerCase() === BROAD), false, `${id}: an exception left out holds nothing`)
  }
  for (const s of r.steps) for (const op of s.action.resolution?.policies ?? []) assert.equal(JSON.stringify([op.body, op.target ?? null]).toLowerCase().includes(BROAD), false, `${s.id} carries the author’s id`)
})

test('a changed answer invalidates what was confirmed against the old one; taking it back unbinds the field it completed', () => {
  const base = fixture('demo')
  const pending = sourceMappingsOf(runFixture(base).steps)
  const group = [...base.groups.keys()].find((id) => !pending.some((p) => p.id.toLowerCase() === id.toLowerCase()))!
  const others = Object.fromEntries(pending.filter((p) => p.id.toLowerCase() !== BROAD).map((p) => [p.id, OMIT()]))
  const read = (answers: Record<string, string>) => {
    const f = withAnswers(base, answers)
    const r = runFixture(f)
    const step = stepOf(r.steps, 's-goal-device-registration-mfa')
    const c = stepContract(step, ctxOf(f, r))
    return { step, bindings: packageBindings(step, ctxOf(f, r), c), state: packageStateOf(step, c, f.snapshot) ?? 'missing' }
  }
  const omitted = read({ ...others, [BROAD]: OMIT() })
  const mapped = read({ ...others, [BROAD]: MAP(group) })
  const takenBack = read(others)
  const pkgOf = implementationPackageFor(omitted.step)
  assert.ok(pkgOf, 'the device-registration package applies')
  const pr = (pkgOf.meta.prerequisites ?? []).find((p) => (p.invalidatedBy ?? []).includes('policy.target.excludeGroups'))
  assert.ok(pr, 'the premise: a prerequisite is confirmed against the exclusions')
  assert.notDeepEqual(omitted.bindings['policy.target.excludeGroups'], mapped.bindings['policy.target.excludeGroups'], 'the answer changed the exclusions bound')
  const confirmations = { [pr.id]: { at: AT, basis: prerequisiteBasis(pr, omitted.bindings) } }
  const standing = (x: typeof omitted) => prerequisiteStatus(pkgOf, x.state, x.bindings, confirmations, null).find((s) => s.id === pr.id)!
  assert.equal(standing(omitted).satisfied, true, 'the confirmation stands for the answer it was given against')
  assert.equal(standing(mapped).satisfied, false, 'a confirmation given against the old answer still counted')
  assert.ok((takenBack.step.action.missing ?? []).some((m) => m.decision && m.token.toLowerCase() === BROAD), 'taken back, the policy waits again')
  assert.equal(Object.hasOwn(takenBack.bindings, 'policy.target.excludeGroups'), false, 'an exclusion set short of the open answer was bound')
  assert.equal(standing(takenBack).satisfied, false)
})

test('no author id reaches a package binding or an operation target, whichever answers are given or taken back', () => {
  const base = fixture('demo')
  const pending = sourceMappingsOf(runFixture(base).steps)
  const ids = pending.map((p) => p.id.toLowerCase())
  const group = [...base.groups.keys()].find((id) => !ids.includes(id.toLowerCase()))!
  let checked = 0
  for (const answers of [{}, Object.fromEntries(pending.map((p) => [p.id, OMIT()])), Object.fromEntries(pending.map((p) => [p.id, MAP(group)]))]) {
    const f = withAnswers(base, answers)
    const r = runFixture(f)
    for (const s of r.steps) {
      const text = JSON.stringify([(s.action.resolution?.policies ?? []).map((o) => [o.body, o.target ?? null]), operationsOf(s).map((o) => o.body)]).toLowerCase()
      for (const id of ids) assert.equal(text.includes(id), false, `${s.id} carries ${id.slice(0, 8)} in an operation`)
      if (!implementationPackageFor(s)) continue
      const bound = JSON.stringify(packageBindings(s, ctxOf(f, r), stepContract(s, ctxOf(f, r)))).toLowerCase()
      for (const id of ids) assert.equal(bound.includes(id), false, `${s.id} binds ${id.slice(0, 8)}`)
      checked++
    }
  }
  assert.ok(checked > 10, `only ${checked} package steps checked`)
})
