// walk-51 item 9: absent goals never render. The plan holds exactly the goals the
// pinned goal map holds (goalMap.ts); a catalogue goal the baseline does not
// implement has no row, no step and no footer entry — in the demo and the product
// alike, because the demo derives through the same pinned baseline. The policy
// that stands for a held goal is the map's, decided at pin time, never a
// render-time signature match.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { PINNED_GOAL_MAP, goalInMap } from './goalMap.ts'
import { PINNED, pinnedPackage } from '../baseline/pinned.ts'

// The four goals the reviewer saw rendered on the demo (walk-51 item 9) and the
// fifth the pinned map does not hold; none may produce a step.
const ABSENT = ['register-info-protected', 'byod-session-controls', 'mobile-app-protection', 'block-downloads-unmanaged', 'azure-management-mfa']

test('no fixture renders a goal the pinned goal map does not hold', () => {
  for (const f of allFixtures()) {
    const { steps } = runFixture(f)
    for (const s of steps) {
      if (!s.id.startsWith('s-goal-')) continue
      assert.ok(goalInMap(PINNED_GOAL_MAP, s.goalId), `${f.name}: ${s.id} renders a goal the baseline does not hold`)
    }
    for (const g of ABSENT) assert.equal(steps.find((s) => s.goalId === g), undefined, `${f.name}: ${g} is absent from the baseline and must not render`)
  }
})

test('the demo derives through the same pinned baseline as the product', () => {
  for (const name of ['demo', 'demo-week2'] as const) {
    const f = fixture(name)
    assert.equal(f.baseline, pinnedPackage(), `${name} carries a baseline of its own`)
    assert.equal(f.baseline.policies.length, PINNED.policies.length)
  }
})

test("the map's policy stands for a held goal, never a signature match", () => {
  const { steps } = runFixture(fixture('demo'))
  // The signature match picks the admin persistence policy for the all-users
  // goal and the risky-users block for registration; the map decides instead.
  const persistence = steps.find((s) => s.goalId === 'all-users-no-persistence')
  assert.ok(persistence, 'the demo holds the all-users persistence goal')
  assert.equal(persistence.naming?.fromBaseline, 'IAC - GLOBAL – SESSION – All Users Persistence (9-12 Hours)')
  const geo = steps.find((s) => s.goalId === 'geo-restriction')
  assert.ok(geo)
  assert.equal(geo.naming?.fromBaseline, 'IAC - GLOBAL – BLOCK – Countries not Allowed')
  for (const s of steps) {
    if (!s.id.startsWith('s-goal-') || !s.naming?.fromBaseline) continue
    const mapped = PINNED_GOAL_MAP[s.goalId].map((k) => PINNED.policies.find((p) => (p.id ?? p.displayName) === k)?.displayName)
    assert.ok(mapped.includes(s.naming.fromBaseline), `${s.id} renders ${s.naming.fromBaseline}, not one of the map's policies (${mapped.join(' | ')})`)
  }
})

test('an explicit goal map narrows the plan to the goals it holds', () => {
  const narrow = { 'mfa-all-users': PINNED_GOAL_MAP['mfa-all-users'], 'block-legacy-auth': PINNED_GOAL_MAP['block-legacy-auth'] }
  const { steps } = runFixture(fixture('mid'), { goalMap: narrow })
  const goalSteps = steps.filter((s) => s.id.startsWith('s-goal-')).map((s) => s.goalId).sort()
  assert.deepEqual(goalSteps, ['block-legacy-auth', 'mfa-all-users'])
})
