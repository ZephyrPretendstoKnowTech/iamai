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
//
// What the sweep below asserts is the whole property rather than those two
// cases: take every step of every fixture that offers an implementation, and no
// identifier the source names may appear anywhere in what it hands over.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, strengthMissing } from './fixtures/index.ts'
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
  const base = fixture('demo-week2')
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

test('a group of the author’s that nothing settles is left out, not swapped for one of this tenant’s', () => {
  const r = runFixture(fixture('demo-week2'))
  const settled = new Set<string>()
  for (const p of pinnedPackage().policies) for (const [id, token] of Object.entries((p as unknown as { placeholders?: Record<string, string> }).placeholders ?? {})) if (token !== 'strength') settled.add(id.toLowerCase())
  let reported = 0
  for (const step of r.steps) {
    for (const id of step.action.authorOnly ?? []) {
      reported += 1
      assert.equal(settled.has(id.toLowerCase()), false, `${id} carries a settled meaning and is not the author's to leave out`)
      // Left out, and not standing in for anything: no substitution claims it.
      for (const op of step.action.resolution?.policies ?? []) assert.doesNotMatch(JSON.stringify(op.body).toLowerCase(), new RegExp(id.toLowerCase()), `${step.id}: ${id} is in a body`)
    }
  }
  assert.ok(reported > 0, 'the demo plan does name the author’s own groups it does without')
})
