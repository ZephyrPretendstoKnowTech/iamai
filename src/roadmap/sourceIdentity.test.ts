// No identifier out of the author's tenant reaches an implementation IAMAI
// offers (task 022 correction).
//
// The pinned baseline is an export of somebody else's tenant, so it is full of
// their object ids: their groups, their named locations, their people, their
// custom authentication strength. None of those exist in the tenant reading it.
// A body carrying one is not a policy that tenant can create — Graph refuses it
// — and offering it anyway is the planner promising work it cannot do.
//
// Two things had to be true and were not:
//
//  1. `implementable` only ever looked inside arrays, so an identifier standing
//     on its own passed through untouched. There is exactly one of those in a
//     Conditional Access policy: `grantControls.authenticationStrength.id`. The
//     re-pin at 90d9b890 pointed the device-registration policy at the author's
//     own custom strength, and that id went into the JSON tab, the PowerShell,
//     the download and the create, with `missing` empty, so every channel
//     offered it.
//  2. A group the baseline only excluded, which nothing in this baseline's
//     interpretation settles, was substituted with the tenant's exclusions
//     group. The body was the same either way — the exclusions group is added to
//     every policy the plan writes — but `substitutions` claimed a resolution
//     that had not happened, and the claim, not the body, is what the next
//     reading trusts.
//  3. The same group was then simply left out, and the policy offered anyway,
//     because "only ever excluded" was read as "the author's own environment,
//     which this tenant needs no counterpart for". That is not a reading of the
//     object; it is a reading of where the object sits in a collection. An
//     exclusion is people the author's tenant spared from a policy that blocks
//     sign-in or demands a stronger one, and a copy made without it stops those
//     people here. Which people, in this tenant, is exactly what nobody knows —
//     so the policy is held, and only a reading settled with evidence in this
//     baseline's interpretation file (`authorEnvironment`) lets one be left out.
//
// What the sweep below asserts is the whole property rather than those three
// cases: take every step of every fixture that offers an implementation, and no
// identifier the source names may appear anywhere in what it hands over.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture, strengthMissing } from './fixtures/index.ts'
import interpretation from '../../baselines/jhope188-conditionalaccesspolicies.interpretation.json' with { type: 'json' }
import type { FixtureName } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { inventoryReferences, unresolvedReferences } from '../baseline/references.ts'
import { implementationOffered, operationsOf } from './operations.ts'
import { PREREQ_STEP_ID } from './stepIds.ts'
import { policyKey } from '../baseline/interpretation.ts'

const FIXTURES: FixtureName[] = ['demo', 'demo-week2', 'getiamai', 'small', 'mid', 'messy', 'midflight']

/** Every identifier the pinned source names that belongs to the author's tenant and to no other. */
function sourceIds(): Set<string> {
  const out = new Set<string>()
  for (const r of unresolvedReferences(inventoryReferences(pinnedPackage().policies))) {
    // A non-GUID token is the author asking a consumer to fill something in, not
    // an object of theirs; Graph's own words ("All", "AllTrusted") name nothing.
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r.id)) out.add(r.id)
  }
  // And the author's own policy ids, which travel in the `@odata.context` URL
  // Graph puts beside an expanded object.
  for (const p of pinnedPackage().policies) {
    const key = policyKey(p).toLowerCase()
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key)) out.add(key)
  }
  return out
}

test('nothing the plan offers carries an identifier out of the author’s tenant', () => {
  const ids = sourceIds()
  assert.ok(ids.size > 15, `the pinned source names the author’s own objects (${ids.size})`)
  let offered = 0
  for (const name of FIXTURES) {
    const r = runFixture(fixture(name))
    for (const step of r.steps) {
      if (!implementationOffered(step)) continue
      offered += 1
      const text = JSON.stringify(operationsOf(step).map((o) => o.body)).toLowerCase()
      const hits = [...ids].filter((id) => text.includes(id))
      assert.deepEqual(hits, [], `${name}/${step.id} hands over the author’s own ${hits.join(', ')}`)
      assert.doesNotMatch(text, /@odata\.context/, `${name}/${step.id} carries a reply annotation out of the author’s tenant`)
    }
  }
  assert.ok(offered > 20, `the sweep saw real work (${offered} offered steps)`)
})

test('the author’s own authentication strength is never handed over, and the step says what it waits on', () => {
  // On the curated baseline: this is about the strength, and the same policy's
  // unexplained carve-outs are the case below.
  const base = curatedFixture('demo-week2')
  // The same tenant with no custom strength of its own: it has not made the one
  // the baseline requires, so the policies that require it cannot be created.
  const snapshot = strengthMissing(base.snapshot)
  const r = runFixture({ ...base, snapshot }, { snapshot } as never)
  const step = r.steps.find((s) => s.id === 's-goal-device-registration-mfa')
  assert.ok(step, 'the device-registration step is on the plan')
  assert.equal(implementationOffered(step), false, 'no channel offers a policy naming a strength this tenant does not have')
  assert.deepEqual(operationsOf(step), [], 'and there is no operation to run')
  assert.deepEqual(
    (step.action.missing ?? []).map((m) => m.stepId),
    [PREREQ_STEP_ID.authStrength],
    'it waits on the step that creates the strength',
  )
  assert.ok(
    r.steps.some((s) => s.id === PREREQ_STEP_ID.authStrength),
    'and that step is on the plan, so what it waits on is somewhere to go',
  )
  assert.ok(step.blockedBy.includes(PREREQ_STEP_ID.authStrength), 'the dependency is on the step, not only in the body')

  // The same tenant with its own strength allowing exactly what the baseline
  // asks for: that is the same requirement under another name, so the policy is
  // offered and carries the tenant's id.
  const own = runFixture(base).steps.find((s) => s.id === 's-goal-device-registration-mfa')!
  assert.equal(implementationOffered(own), true, 'a tenant with the strength can create the policy')
  const body = operationsOf(own)[0].body as { grantControls?: { authenticationStrength?: { id?: string } } }
  const tenantStrength = (base.snapshot.config.authStrengths?.rows ?? []).map((x) => x as { id?: string; policyType?: string }).find((x) => x.policyType !== 'builtIn')
  assert.equal(body.grantControls?.authenticationStrength?.id, tenantStrength?.id, 'the body names the tenant’s own strength')
  assert.ok(r.steps.length > 0)
})

/** The author's groups this baseline's interpretation settles as nothing (its own list, by id). */
function unsettledGroups(): string[] {
  return (interpretation as { references: { id: string; kind: string; meaning: string }[] }).references
    .filter((r) => r.kind === 'group' && r.meaning === 'unknown')
    .map((r) => r.id.toLowerCase())
}

test('a group of the author’s that nothing settles holds the policy: no operation, and no channel offers one', () => {
  // The case the reviewer named. The author's Device Registration policy carves
  // three groups of his own out of a requirement for Modern MFA + TAP. Nothing
  // he published says what any of them is, so nothing here can say who a copy of
  // that policy made in another tenant would newly stop — and a carve-out left
  // out of a policy that demands a stronger sign-in is people who cannot sign in.
  //
  // It used to be dropped and the policy offered anyway, on the reading that an
  // author's exclusion is the author's own business because leaving it out
  // reaches more people and never fewer. More people is the danger, and "only
  // ever excluded" was never a reading of the object at all.
  const r = runFixture(fixture('demo-week2'))
  const step = r.steps.find((s) => s.id === 's-goal-device-registration-mfa')
  assert.ok(step, 'the device-registration step is on the demo plan')
  const unsettled = unsettledGroups()
  const held = (step.action.missing ?? []).filter((m) => unsettled.includes(m.token.toLowerCase()))
  assert.ok(held.length >= 3, `the source policy's own unexplained carve-outs are what it waits on (${held.length})`)
  assert.ok(held.every((m) => m.unreadable === true && m.stepId === null), 'and no step of this tenant’s ends the wait')
  assert.equal(implementationOffered(step), false, 'no channel offers a policy this tenant cannot honestly copy')
  assert.deepEqual(operationsOf(step), [], 'and there is no operation to run')
  assert.equal(step.action.json, null, 'nothing is written for the plan file or the exports either')
})

test('nothing is left out as the author’s own without a settled reading, anywhere on the demo', () => {
  // `authorOnly` is the one list whose entries are dropped from a body an
  // implementation channel carries and do not hold the step. Reaching it takes a
  // reading settled in this baseline's interpretation file with the evidence it
  // rests on (`authorEnvironment`), and this baseline settles no such reading —
  // so on the demo the list is empty everywhere, however many groups the author
  // only ever excludes.
  const r = runFixture(fixture('demo-week2'))
  let steps = 0
  for (const step of r.steps) {
    steps += 1
    assert.deepEqual(step.action.authorOnly ?? [], [], `${step.id} leaves out a source object nothing settles`)
  }
  assert.ok(steps > 10, `the sweep saw the whole plan (${steps})`)
})

test('a settled authorEnvironment reference is left out, and does not hold the policy', () => {
  // The other half of the same rule. A curator who establishes that a source
  // reference is the author's own environment — a vendor's service principal,
  // one dependency's own addresses — records it, and then the adopting tenant's
  // copy is whole without it: dropped from every body, reported as the author's
  // own, and holding nothing. `asCuratedBaseline` is that one change to the
  // interpretation file and nothing else.
  const base = curatedFixture('demo-week2')
  const r = runFixture(base)
  const step = r.steps.find((s) => s.id === 's-goal-device-registration-mfa')
  assert.ok(step, 'the device-registration step is on the plan')
  assert.equal(implementationOffered(step), true, 'the policy can be written once the readings are settled')
  const reported = step.action.authorOnly ?? []
  assert.ok(reported.length >= 3, `and what it does without is named (${reported.length})`)
  for (const id of reported) {
    assert.ok(unsettledGroups().includes(id.toLowerCase()), `${id} is one of the settled readings, not a guess`)
    for (const op of operationsOf(step)) assert.doesNotMatch(JSON.stringify(op.body).toLowerCase(), new RegExp(id.toLowerCase()), `${step.id}: ${id} is in a body`)
  }
  assert.deepEqual((step.action.missing ?? []).filter((m) => m.unreadable), [], 'and nothing is waiting on them')
})
