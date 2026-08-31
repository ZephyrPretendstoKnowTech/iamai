// Skipping a step (prompt 44 Part 1).
//
// The plan is advice, not a contract, so almost anything can be skipped. The one
// exception is emergency access, and it is an exception for a mechanical reason
// rather than a moral one: `skipped` is treated as SATISFIED by safeTodayFor,
// isWork and mergePersisted, so skipping the break-glass blocker would flip every
// held deny-capable step to "safe today" and drop the scheduling edges that keep
// the exclusion group ahead of the policies referencing it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { skipStep, unskipStep } from './progress.ts'
import { EMERGENCY_ACCESS_STEP_IDS, isEmergencyAccess } from './blockerSteps.ts'
import { allFixtures } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import type { Step } from './types.ts'

const step = (over: Record<string, unknown> & { id: string }): Step =>
  ({ status: 'ready', history: [], skipReason: null, score: { value: 3 }, ...over }) as unknown as Step

test('every emergency-access step is refused, by id', () => {
  for (const id of EMERGENCY_ACCESS_STEP_IDS) {
    const s = step({ id })
    const r = skipStep(s, 'Not this quarter')
    assert.equal(r.ok, false, `${id} cannot be skipped`)
    assert.match(r.error ?? '', /emergency access/i)
    assert.equal(s.status, 'ready', `${id} is left alone`)
  }
})

test('the refusal covers every emergency-access step the generator actually builds', () => {
  // The ids are a hardcoded set, so this checks the set against real plans
  // rather than against itself. A renamed step id would slip past a set that is
  // only ever compared with its own contents.
  for (const f of allFixtures()) {
    for (const s of runFixture(f).steps) {
      const looksEmergency = /break-glass|exclusion-group/.test(s.id)
      if (!looksEmergency) continue
      assert.equal(isEmergencyAccess(s), true, `${s.id} (${f.name}) is recognised as emergency access`)
    }
  }
})

test('an ordinary step skips, and records the reason and the transition', () => {
  const s = step({ id: 's-goal-token-protection', status: 'blocked' })
  assert.equal(skipStep(s, 'No licence for it').ok, true)
  assert.equal(s.status, 'skipped')
  assert.equal(s.skipReason, 'No licence for it')
  assert.equal(s.history.at(-1)?.from, 'blocked')
  assert.equal(s.history.at(-1)?.to, 'skipped')
  assert.equal(s.history.at(-1)?.note, 'No licence for it')
})

test('a reason is required, and is never accepted risk', () => {
  const s = step({ id: 's-goal-x' })
  assert.equal(skipStep(s, '   ').ok, false)
  assert.equal(skipStep(s, 'risk accepted').ok, false)
  assert.equal(skipStep(s, 'Risk  Accepted by the board').ok, false)
  assert.equal(s.status, 'ready', 'a refused skip changes nothing')
})

test('un-skipping clears the status rather than restoring the old one', () => {
  const s = step({ id: 's-goal-y', status: 'ready' })
  skipStep(s, 'Deferred to a later phase')
  assert.equal(s.status, 'skipped')
  assert.equal(unskipStep(s).ok, true)
  // Not 'ready': what it should be now is the generator's question, and the
  // status it held before the skip was a judgement about a tenant that has
  // since moved on.
  assert.equal(s.status, 'blocked')
  assert.equal(s.skipReason, null)
  assert.equal(s.history.at(-1)?.from, 'skipped')
})

test('un-skipping something that is not skipped does nothing', () => {
  const s = step({ id: 's-goal-z', status: 'ready' })
  assert.equal(unskipStep(s).ok, false)
  assert.equal(s.status, 'ready')
  assert.equal(s.history.length, 0)
})

