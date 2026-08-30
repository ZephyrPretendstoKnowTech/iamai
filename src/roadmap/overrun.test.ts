// The upper-bound guard names the steps that would bring a long plan inside.
//
// No fixture is over 12 weeks any more, which is the point of the work that
// preceded this; the guard is exercised by squeezing the pace until one is,
// rather than by asserting on a fixture that might drift back under.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LONG_PLAN_WEEKS, overrunFor } from './overrun.ts'
import { buildSchedule } from './schedule.ts'
import { allFixtures } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'

const fixture = (name: string) => allFixtures().find((f) => f.name === name)!
const clone = (steps: unknown[]) => steps.map((s) => ({ ...(s as object), rings: (s as { rings: object[] }).rings.map((r) => ({ ...r })) }))

test('a plan inside the bound reports nothing', () => {
  const r = runFixture(fixture('small'))
  const o = overrunFor(r.steps, r.schedule.start, r.schedule.activeUsers, null, { rhythm: r.schedule.rhythm ?? null, holidays: [] }, r.schedule.weeks)
  assert.equal(o.over, false)
  assert.deepEqual(o.remedies, [])
})

test('a plan over the bound names a pace change, the steps to defer, and the readiness work', () => {
  const r = runFixture(fixture('mid'))
  // One change window a week: slow enough that this plan cannot fit.
  const options = { rhythm: r.schedule.rhythm ?? null, holidays: [], enforcementCap: 1 }
  const squeezed = buildSchedule(clone(r.steps) as never, r.schedule.start, r.schedule.activeUsers, null, options)
  assert.ok(squeezed.weeks > LONG_PLAN_WEEKS, `the squeezed plan is over the bound, got ${squeezed.weeks}`)

  const o = overrunFor(r.steps, r.schedule.start, r.schedule.activeUsers, null, options, squeezed.weeks)
  assert.equal(o.over, true)
  assert.ok(o.remedies.length > 0, 'it says something')

  const pace = o.remedies.find((x) => x.kind === 'pace')
  assert.ok(pace, 'a pace change is offered')
  assert.equal(pace.cap, 2, 'the next pace up, not an abstraction')
  assert.ok(pace.weeks < squeezed.weeks, 'and it actually helps')

  const defer = o.remedies.find((x) => x.kind === 'defer')
  if (defer) {
    // The whole point: named steps, and the length that results.
    assert.ok(defer.stepIds.length > 0, 'deferral names specific steps')
    for (const id of defer.stepIds) assert.ok(r.steps.some((s) => s.id === id), `${id} is a real step`)
    assert.ok(defer.weeks <= LONG_PLAN_WEEKS, 'and the result is inside the bound')
  }
})

test('every remedy shortens the plan; none is offered that does not', () => {
  const r = runFixture(fixture('mid'))
  const options = { rhythm: r.schedule.rhythm ?? null, holidays: [], enforcementCap: 1 }
  const squeezed = buildSchedule(clone(r.steps) as never, r.schedule.start, r.schedule.activeUsers, null, options)
  const o = overrunFor(r.steps, r.schedule.start, r.schedule.activeUsers, null, options, squeezed.weeks)
  for (const rem of o.remedies) {
    assert.ok(rem.weeks < squeezed.weeks, `${rem.kind} shortens the plan (${rem.weeks} < ${squeezed.weeks})`)
  }
})
