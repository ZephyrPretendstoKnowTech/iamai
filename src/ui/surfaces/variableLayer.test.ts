// Prompt 52, walk-51 item 2: no rendered line is a variable rendered around a
// hole, and a count of one reads as one. Pluralisation is a unit fact; the
// no-hole guarantee is checked on the demo and GetIAMAI campaign step, whose
// who-line and done-when lines the walk found rendering "1 guests · readiness ,
// the plan waits for 90% until ." with {readiness} and {enrollBy} empty.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { fillText, missingVars } from '../../content/render.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { contentLists } from '../../derive/contentLists.ts'
import { todayView } from '../../derive/today.ts'

test('a count of one singularises the noun that follows it', () => {
  assert.equal(fillText('{guests} guests', { guests: 1 }), '1 guest')
  assert.equal(fillText('{active} active people', { active: 1 }), '1 active person')
  assert.equal(fillText('{n} policies', { n: 1 }), '1 policy')
  assert.equal(fillText('{guests} guests', { guests: 3 }), '3 guests')
  assert.equal(fillText('{n} guests', { n: 11 }), '11 guests')
})

test('missingVars names only the variables a line does not fill', () => {
  assert.deepEqual(missingVars('readiness {readiness}, until {enrollBy}', { readiness: '36%' }), ['enrollBy'])
  assert.deepEqual(missingVars('{active} active people', { active: 4 }), [])
  assert.deepEqual(missingVars('{n} of {total}', { n: 0, total: 3 }), []) // zero is a value, not a hole
})

test('the campaign who and done-when lines have no hole on the demo and GetIAMAI', () => {
  const fixtures = allFixtures().filter((f) => f.name === 'demo' || f.name === 'getiamai')
  for (const f of fixtures) {
    const run = runFixture(f)
    const firstEnforce = run.steps.map((s) => s.events?.enforce?.at).filter((x): x is string => typeof x === 'string').sort()[0] ?? null
    const camp = run.steps.find((s) => s.goalId === 'mfa-all-users')
    assert.ok(camp, `${f.name}: the campaign step`)
    const cs = contentStepFor(camp!) as { who: Record<string, unknown>; doneWhen: string[] }
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names?.label(id) ?? id, signature: 'IT', operatorId: run.input.operatorUserId ?? null, now: f.snapshot.asOf, firstEnforce }
    const ex = stepVars(camp!, ctx) as Record<string, unknown>
    assert.deepEqual(missingVars(cs.who.lead, ex), [], `${f.name}: who.lead fills every variable`)
    for (const dw of cs.doneWhen) {
      // A line that still has a hole would be dropped by the renderer; assert the
      // derivations fill the campaign's own, so nothing important is dropped.
      if (dw.includes('{enrollBy}')) assert.deepEqual(missingVars(dw, ex), [], `${f.name}: done-when fills enrollBy`)
    }
  }
})

// Prompt 52, walk-51 item 3: the campaign's five lists and the special-care
// picker derive from the same population states Today computes — the walk found
// them empty while Today listed 7 no-method and 14 registered-unproven.
test('the campaign lists and the special-care picker derive from Today', () => {
  const f = allFixtures().find((x) => x.name === 'demo')!
  const run = runFixture(f)
  const nameOf = (id: string): string => run.input.names?.label(id) ?? id
  const cl = contentLists({ snapshot: f.snapshot, mapping: f.mapping, nameOf, now: f.snapshot.asOf, operatorId: run.input.operatorUserId ?? null })
  const tv = todayView(f.snapshot, f.snapshot.asOf, new Set(f.mapping.serviceAccountUserIds))
  assert.equal(cl.noMethod.length, tv.tiles.noMethod, 'no-method matches Today')
  assert.equal(cl.unproven.length, tv.tiles.unproven, 'registered-unproven matches Today')
  assert.ok(cl.noMethod.length > 0 && cl.unproven.length > 0, 'the demo has people in these buckets')
  assert.ok(cl.specialCare.length > 0, 'the special-care picker has people')
  for (const row of cl.specialCare) {
    assert.match(row, /\S · \S/, `"${row}" has a name and a state, not an empty "·"`)
  }
})
