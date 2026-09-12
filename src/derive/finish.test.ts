// The finish date splits the plan into what the calendar sets and what a
// readiness threshold holds (prompt 47 Part 2 item 7).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { heldByReadiness, planFinish, projectedFinish } from './finish.ts'
import { unavailableReason } from '../roadmap/operations.ts'
import { isHeld } from '../roadmap/holds.ts'
import { FINISH } from '../copy/statements.ts'

test('every outstanding step is either dated by the calendar or held by a named readiness threshold', () => {
  for (const f of allFixtures()) {
    const r = runFixture(f)
    const p = planFinish(r.steps)
    const outstanding = r.steps.filter((s) => s.status !== 'done' && s.status !== 'skipped')
    // A policy the plan cannot write waits on the thing it names, not on a
    // readiness number, so it is in neither bucket (roadmap/operations.ts).
    const held = outstanding.filter((s) => !s.floor && unavailableReason(s) === null && heldByReadiness(s) && isHeld(s))
    assert.equal(p.waitingCount, held.length, `${f.name}: the held count is the held steps`)
    for (const w of p.waiting) assert.match(w.measure, /readiness$/, `${f.name}: ${w.measure}`)
    // Anything the plan requires that is held leaves the plan with no finish at
    // all: a date measured to the rest assumes the hold clears (roadmap/holds.ts).
    if (outstanding.some((s) => !s.floor && isHeld(s))) {
      assert.equal(p.held, true, `${f.name}: held work, so the plan says it cannot finish`)
      assert.equal(p.finish, null, `${f.name}: and dates no finish`)
      continue
    }
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

// ------------------------------------------------------------ the projected finish (A2)

test('the projected finish is the estimate at pace, and the committed day only when the calendar names another day', () => {
  const estimate = '2026-10-05T12:00:00.000Z'
  assert.deepEqual(projectedFinish(null, null), { estimate: null, committed: null })
  // A held plan has no committed finish; the estimate stands alone.
  assert.deepEqual(projectedFinish(null, estimate), { estimate, committed: null })
  // The same day is said once, whatever the hour.
  assert.deepEqual(projectedFinish('2026-10-05T09:00:00.000Z', estimate), { estimate, committed: null })
  // Another day is the committed line under the estimate.
  assert.deepEqual(projectedFinish('2026-10-12T12:00:00.000Z', estimate), { estimate, committed: '2026-10-12T12:00:00.000Z' })
  // No estimate at all: the tile reads the placeholder; the committed day is still a fact.
  assert.deepEqual(projectedFinish('2026-10-12T12:00:00.000Z', null), { estimate: null, committed: '2026-10-12T12:00:00.000Z' })
  // Every fixture's plan carries an estimate once the forecast is settled (roadmap/forecast.ts), so the header tile shows a date on every tenant, held or not.
  for (const f of allFixtures()) {
    const r = runFixture(f)
    const p = projectedFinish(planFinish(r.steps, r.schedule.cleanup?.end ?? null).finish, r.schedule.estimate?.targetEnd ?? null)
    assert.ok(p.estimate !== null, `${f.name}: the Projected finish tile has no date`)
    if (p.committed !== null) assert.notEqual(p.committed.slice(0, 10), p.estimate.slice(0, 10), `${f.name}: the committed day repeats the estimate`)
  }
})
