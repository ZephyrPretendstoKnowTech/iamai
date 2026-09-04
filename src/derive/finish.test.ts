// The finish date splits the plan into what the calendar sets and what a
// readiness threshold holds (prompt 47 Part 2 item 7).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { heldByReadiness, planFinish } from './finish.ts'
import { unavailableReason } from '../roadmap/operations.ts'
import { FINISH } from '../copy/statements.ts'

test('every outstanding step is either dated by the calendar or held by a named readiness threshold', () => {
  for (const f of allFixtures()) {
    const r = runFixture(f)
    const p = planFinish(r.steps)
    const outstanding = r.steps.filter((s) => s.status !== 'done' && s.status !== 'skipped')
    // A policy the plan cannot write waits on the thing it names, not on a
    // readiness number, so it is in neither bucket (roadmap/operations.ts).
    const held = outstanding.filter((s) => unavailableReason(s) === null && heldByReadiness(s))
    assert.equal(p.waitingCount, held.length, `${f.name}: the held count is the held steps`)
    for (const w of p.waiting) assert.match(w.measure, /readiness$/, `${f.name}: ${w.measure}`)
    // The finish is the last planned end among the steps the calendar dates: no dated step runs past it.
    const dated = outstanding.filter((s) => !heldByReadiness(s) && s.rings.length > 0)
    if (dated.length > 0) {
      assert.ok(p.finish !== null, `${f.name}: something enforces, so there is a finish`)
      const ends = dated.map((s) => s.rings.at(-1)!.plannedEnd)
      assert.ok(ends.includes(p.finish!), `${f.name}: the finish is a planned end`)
      for (const e of ends) assert.ok(e <= p.finish!, `${f.name}: ${e} runs past ${p.finish}`)
    } else {
      assert.equal(p.finish, null, `${f.name}: nothing dated, so no finish`)
    }
  }
})

test('the header line says the date and what waits, in the words given', () => {
  assert.equal(FINISH.line('Sep 20', []), 'finishes Sep 20')
  assert.equal(FINISH.line('Sep 20', [{ measure: 'device readiness', count: 3, family: 'device' }]), 'finishes Sep 20 · 3 device steps wait for device readiness')
  assert.equal(FINISH.line('Sep 20', [{ measure: 'MFA readiness', count: 1, family: 'mfa' }]), 'finishes Sep 20 · 1 MFA step waits for MFA readiness')
  assert.equal(FINISH.line(null, [{ measure: 'admin readiness', count: 2, family: 'admin' }]), 'nothing is dated · 2 admin steps wait for admin readiness')
})
