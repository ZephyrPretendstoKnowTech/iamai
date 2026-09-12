// Emergency access with more than one confirmed account (Batch 2, B5). Each
// confirmed account stands on its own evidence: one account's minimum failure is
// not the other's, one account's pass is not borrowed by the other, and a finding
// about the set of accounts is no account's. Minimum safety holds the rollout and
// nothing defers it; hardening holds it only until it is fixed or deferred.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { RoadmapInput } from '../../roadmap/generate.ts'
import { stepContract, readinessOf, CONTRACT } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'
import { implementationPackageFor, packageBindings } from './stepPackage.ts'
import { NO_RUNTIME, projectSafely } from '../../content/implementation/project.ts'
import { fillText } from '../../content/render.ts'

const EMERGENCY = 's-prereq-break-glass'
const DRILL = '2026-08-18T09:00:00.000Z'

type Tenant = ReturnType<typeof fixture>

/** The small tenant's two confirmed emergency accounts, with evidence edited per account. */
function tenant(edit: (f: Tenant, a: string, b: string) => void): { f: Tenant; a: string; b: string } {
  const f = structuredClone(fixture('small'))
  const [a, b] = f.mapping.breakGlassUserIds
  edit(f, a, b)
  return { f, a, b }
}

function run(f: Tenant, over: Partial<RoadmapInput> = {}) {
  // A recorded drill on the day the first account signed in (cleanupDone.ts isRecordedDrill).
  const r = runFixture(f, { cleanupRecord: { done: {}, drills: [DRILL] }, ...over })
  const step = r.steps.find((s) => s.id === EMERGENCY)!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  return { r, step, ctx, c: stepContract(step, ctx) }
}

const waitingOnEmergency = (r: ReturnType<typeof runFixture>): number => r.steps.filter((s) => s.blockers.some((b) => b.kind === 'step' && b.stepId === EMERGENCY)).length
const user = (f: Tenant, id: string) => f.snapshot.users.find((u) => u.id === id)!
const T = CONTRACT.hardening.tiles

/** Account A hardened (two method types, its sign-in the recorded drill); account B signed in on a day no drill records. */
const hardenedAndNot = (f: Tenant, a: string, b: string): void => {
  f.snapshot.authMethods[a] = [{ kind: 'fido2' }, { kind: 'windowsHelloForBusiness' }] as never
  user(f, a).lastSuccessfulSignIn = DRILL
  user(f, b).lastSuccessfulSignIn = '2026-08-30T09:00:00.000Z'
}

test('two confirmed accounts, one hardened and one not: each account carries its own findings, and deferrable hardening does not block once deferred', () => {
  const { f, a, b } = tenant(hardenedAndNot)
  const { r, step, ctx, c } = run(f)
  assert.deepEqual(step.emergency?.accounts, [
    { id: a, minimum: 0, hardening: 0, assessed: true },
    { id: b, minimum: 0, hardening: 1, assessed: true },
  ], JSON.stringify(step.checks?.items))
  assert.equal(step.emergency?.minimum, 0)
  assert.equal(step.emergency?.hardening, 1, 'the hardened account was given the other account’s finding')
  // Undeferred hardening holds the rollout until someone acknowledges it; a deferral releases it.
  assert.ok(waitingOnEmergency(r) > 0)
  assert.equal(c.hardening?.canDefer, true)
  const d = run(f, { hardeningDeferral: { at: '2026-09-11T10:00:00.000Z', basis: step.emergency!.basis } })
  assert.equal(d.step.status, 'done')
  assert.equal(waitingOnEmergency(d.r), 0, 'deferred hardening still blocked the rollout')
  // Readiness names each account's own standing: available, so it is satisfied evidence.
  const access = readinessOf(step, c).satisfied.find((t) => t.key === 'emergency')!
  assert.equal(access.value, T.available)
  assert.equal(access.note, [fillText(T.accountMeets, { name: ctx.nameOf(a) }), fillText(T.accountHardening, { name: ctx.nameOf(b) })].join(' · '))
  // The package binds the whole set, and the one account whose own checks are outstanding.
  const bindings = packageBindings(step, ctx, c)
  assert.equal(bindings['emergency.target.userId'], b)
  assert.equal(bindings['emergency.target.upn'], user(f, b).userPrincipalName)
  for (const id of [a, b]) assert.match(String(bindings['emergency.target.accountsSummary']), new RegExp(user(f, id).userPrincipalName!.replace('.', '\\.')))
})

test('a minimum safety failure on one account holds the rollout, stays that account’s, and no deferral releases it', () => {
  const { f, a, b } = tenant((t, x, y) => {
    hardenedAndNot(t, x, y)
    t.snapshot.roles.active[y] = []
  })
  const { r, step, ctx, c } = run(f)
  const [first, second] = step.emergency!.accounts
  assert.deepEqual(first, { id: a, minimum: 0, hardening: 0, assessed: true }, 'the healthy account borrowed the other’s minimum failure')
  assert.ok(second.id === b && second.minimum > 0)
  assert.equal(step.emergency!.minimum, second.minimum)
  assert.ok(waitingOnEmergency(r) > 0)
  assert.equal(c.hardening?.canDefer ?? false, false)
  const d = run(f, { hardeningDeferral: { at: '2026-09-11T10:00:00.000Z', basis: step.emergency!.basis } })
  assert.notEqual(d.step.status, 'done')
  assert.ok(waitingOnEmergency(d.r) > 0, 'a deferral released a missing way back in')
  const access = readinessOf(step, c).tiles.find((t) => t.key === 'emergency')!
  assert.equal(access.value, T.unavailable)
  assert.equal(access.note, [fillText(T.accountMeets, { name: ctx.nameOf(a) }), fillText(T.accountMinimum, { name: ctx.nameOf(b) })].join(' · '))
})

test('a finding about the set is no account’s, two accounts owing work bind no single account, and the package still names the whole set', () => {
  const { f, a, b } = tenant(() => {})
  const { step, ctx, c } = run(f, { cleanupRecord: { done: {}, drills: [] } })
  const accounts = step.emergency!.accounts
  assert.deepEqual(accounts.map((x) => x.id), [a, b])
  const own = accounts.reduce((n, x) => n + x.minimum + x.hardening, 0)
  assert.ok(own < step.emergency!.minimum + step.emergency!.hardening, 'the premise: a set-level finding (method diversity) is outstanding and no account carries it')
  assert.ok(accounts.every((x) => x.hardening > 0), 'the premise: both accounts owe hardening of their own')
  const bindings = packageBindings(step, ctx, c)
  assert.equal(Object.hasOwn(bindings, 'emergency.target.userId'), false, 'IAMAI picked one of two accounts for the operator')
  assert.equal(Object.hasOwn(bindings, 'emergency.target.upn'), false)
  const pkg = implementationPackageFor(step)!
  const p = projectSafely(pkg, 'missing', bindings, NO_RUNTIME)
  assert.equal(p.hold, null, JSON.stringify(p.hold))
  const ai = p.channels.find((x) => x.channel === 'aiInfo')
  assert.ok(ai, `the set-level work projects nothing: ${JSON.stringify(p)}`)
  for (const id of [a, b]) assert.ok(ai.text.includes(user(f, id).userPrincipalName!), 'the AI Info names only part of the set')
  // A per-account artifact waits for one account instead of guessing one.
  assert.equal(p.channels.some((x) => x.channel === 'json'), false)
  assert.ok((p.degraded ?? []).some((x) => x.channel === 'json' && x.missingBindings.includes('emergency.target.userId')), JSON.stringify(p.degraded))
})
