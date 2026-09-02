// The upper-bound guard names the steps that would bring a long plan inside.
//
// Pace is no longer a lever (target-state §9: the weekly cap is a constant of
// the band), so the guard has two: defer named steps, or get people
// registered. The over-bound case is found in the fixtures where one exists,
// and made otherwise by a change freeze, so the test never asserts on a
// fixture that might drift back under.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LONG_PLAN_WEEKS, overrunFor } from './overrun.ts'
import { buildSchedule } from './schedule.ts'
import type { ScheduleOptions } from './schedule.ts'
import { HUGE, allFixtures } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import type { Step } from './types.ts'

const fixture = (name: string) => allFixtures().find((f) => f.name === name)!
const clone = (steps: Step[]): Step[] => steps.map((s) => ({ ...s, rings: s.rings.map((r) => ({ ...r })) }))

/** A plan over the bound: a real one where a fixture has it, else the mid plan behind a long freeze. */
function overBound(): { steps: Step[]; start: string; active: number; options: ScheduleOptions; weeks: number } {
  // huge is built only with HUGE=1 (prune A); without it the search falls through to large and mid.
  for (const name of ['huge', 'large', 'mid']) {
    if (name === 'huge' && !HUGE) continue
    const r = runFixture(fixture(name))
    if (r.schedule.weeks > LONG_PLAN_WEEKS) {
      return { steps: r.steps, start: r.schedule.start, active: r.schedule.activeUsers, options: { rhythm: r.schedule.rhythm ?? null, registrationDays: r.schedule.verification.workingDays }, weeks: r.schedule.weeks }
    }
  }
  const r = runFixture(fixture('mid'))
  const options: ScheduleOptions = { rhythm: r.schedule.rhythm ?? null, registrationDays: r.schedule.verification.workingDays, freeze: { from: '2026-09-08T00:00:00.000Z', to: '2026-11-27T23:59:59.000Z' } }
  const squeezed = buildSchedule(clone(r.steps), r.schedule.start, r.schedule.activeUsers, null, options)
  return { steps: r.steps, start: r.schedule.start, active: r.schedule.activeUsers, options, weeks: squeezed.weeks }
}

test('a plan inside the bound reports nothing', () => {
  const r = runFixture(fixture('small'))
  assert.ok(r.schedule.weeks <= LONG_PLAN_WEEKS)
  const o = overrunFor(r.steps, r.schedule.start, r.schedule.activeUsers, null, { rhythm: r.schedule.rhythm ?? null }, r.schedule.weeks)
  assert.equal(o.over, false)
  assert.deepEqual(o.remedies, [])
})

test('a plan over the bound is reported as over, and every remedy it offers names steps or people and actually shortens it', () => {
  const c = overBound()
  assert.ok(c.weeks > LONG_PLAN_WEEKS, `over the bound, got ${c.weeks}`)
  const o = overrunFor(c.steps, c.start, c.active, null, c.options, c.weeks)
  assert.equal(o.over, true)
  for (const rem of o.remedies) {
    assert.ok(rem.weeks < c.weeks, `${rem.kind} shortens the plan (${rem.weeks} < ${c.weeks})`)
    if (rem.kind === 'defer') {
      assert.ok(rem.stepIds.length > 0, 'deferral names specific steps')
      for (const id of rem.stepIds) assert.ok(c.steps.some((s) => s.id === id), `${id} is a real step`)
      assert.ok(rem.weeks <= LONG_PLAN_WEEKS, 'and the result is inside the bound')
    }
    if (rem.kind === 'readiness') assert.ok(rem.people > 0, 'the readiness remedy names how many people')
  }
  // No remedy is a pace change: the cap is not a setting any more.
  assert.equal(o.remedies.some((r) => (r as { kind: string }).kind === 'pace'), false)
})
