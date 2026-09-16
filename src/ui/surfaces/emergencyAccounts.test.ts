import { recoveryAccountBasis } from '../../roadmap/cleanupDone.ts'
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
  f.snapshot.config.authMethodsPolicy = structuredClone(fixture('demo-week2').snapshot.config.authMethodsPolicy)
  for (const id of f.mapping.breakGlassUserIds) { const methods = f.snapshot.authMethods[id]; if (Array.isArray(methods)) f.snapshot.authMethods[id] = methods.map(method => method.kind === 'fido2' ? { ...method, aaGuid: 'a25342c0-3cdc-4414-8e46-f4807fca511c', passkeyType: 'deviceBound' } : method) }
  return { f, a, b }
}

function run(f: Tenant, over: Partial<RoadmapInput> = {}) {
  // A recorded drill on the day the first account signed in (cleanupDone.ts isRecordedDrill).
  const r = runFixture(f, { cleanupRecord: { done: {}, drills: [DRILL], records: [{ at: f.snapshot.asOf, cleanup: 'drill', date: DRILL, accountIds: f.mapping.breakGlassUserIds, outcome: 'passed', accountBasis: recoveryAccountBasis(f.snapshot, f.mapping.breakGlassUserIds), signInAtByAccount: { [f.mapping.breakGlassUserIds[0]]: DRILL }, timeZone: 'UTC' }] }, ...over })
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
  // Readiness draws one slot per account (P0-7): the hardened one clear, the other with its hardening open.
  const rd = readinessOf(step, c)
  assert.deepEqual([...rd.tiles, ...rd.satisfied].filter((t) => t.key.startsWith('slot:')).map((t) => `${t.label}: ${t.value}`).sort(), [`${ctx.nameOf(a)}: ${T.meets}`, `${ctx.nameOf(b)}: ${T.hardeningOpen}`].sort())
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
  // Only the failing account's slot is unresolved, and its minimum blockers are its own lines, without its name again.
  const slots = readinessOf(step, c).tiles.filter((t) => t.key.startsWith('slot:'))
  assert.deepEqual(slots.map((t) => `${t.label}: ${t.value}`), [`${ctx.nameOf(b)}: ${T.minimumOpen}`])
  const bSlot = c.emergencySlots.find((s) => s.accountId === b)!
  assert.ok(bSlot.minimum.length > 0 && bSlot.minimum.every((l) => !l.startsWith(`${ctx.nameOf(b)}: `)), JSON.stringify(bSlot))
})

test('P0-7: with no account selected, Readiness is two Not selected slots, Account 1 and Account 2, and no check tile beside them', () => {
  const { f } = tenant((t) => {
    t.mapping.breakGlassUserIds = []
  })
  const { step, c } = run(f)
  assert.ok(step.emergency, 'the premise: the emergency step carries its standing with nobody selected')
  const r = readinessOf(step, c)
  assert.deepEqual(r.tiles.filter((t) => t.key.startsWith('slot:')).map((t) => `${t.label}: ${t.value}`), [`${fillText(T.slot, { n: 1 })}: ${T.notSelected}`, `${fillText(T.slot, { n: 2 })}: ${T.notSelected}`])
  assert.equal(r.tiles.some((t) => t.key.startsWith('check:') || t.key === 'emergency' || t.key === 'resilience'), false, r.tiles.map((t) => t.key).join(', '))
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
