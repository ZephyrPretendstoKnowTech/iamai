// The Plan's Needs your input tile counts each place a question is asked, once
// (owner, 2026-09-27): the sample's tile read 6, counting Confirm What You Use's
// answers again on Block Legacy Authentication and Require MFA for Guests, which
// only wait on them.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { inputStepIds } from './planBoard.ts'
import { DIRECTION_STEP } from '../../roadmap/directionAnswers.ts'
import { stepIdForGoal } from '../../roadmap/stepIds.ts'
import { conditionalInputSteps } from '../../roadmap/answers.ts'
import { ANSWERED_IN } from '../../roadmap/direction.ts'

test('Needs your input counts the steps that ask, not the steps that wait on their answers', () => {
  const r = runFixture(fixture('demo'))
  const ids = inputStepIds(r.steps)
  const legacy = r.steps.find((s) => s.id === stepIdForGoal('block-legacy-auth'))!
  const guests = r.steps.find((s) => s.id === stepIdForGoal('guests-mfa'))!
  assert.ok((legacy.unsavedInputs ?? []).length > 0 && (guests.unsavedInputs ?? []).length > 0, 'the premise: both wait on answers Confirm What You Use asks')
  assert.equal(ids.has(legacy.id), false, 'Block Legacy Authentication counted again')
  assert.equal(ids.has(guests.id), false, 'Require MFA for Guests counted again')
  // The three decisions and the countries picker, each once.
  for (const id of Object.values(DIRECTION_STEP)) assert.ok(ids.has(id), id)
  assert.ok(ids.has(stepIdForGoal('geo-restriction')), 'the countries picker asks on its own step')
  assert.equal(ids.size, 4, [...ids].join(', '))
  assert.match(readFileSync('src/ui/surfaces/Plan.tsx', 'utf8'), /const inputIds = inputStepIds\(c\.steps\)/)
})

test('every conditional input is asked on a Direction step, so no step waiting on one is counted again (Round 4 review)', () => {
  // A new conditional input asked on its own step must fail here, and inputStepIds must then count it.
  for (const stepId of conditionalInputSteps()) assert.ok((ANSWERED_IN[stepId] ?? []).length > 0, `${stepId}: a conditional input no Direction step asks`)
})

test('a Direction step finished on its required answers is counted once more while a live step waits on its optional one (live check, 2026-10-05)', async () => {
  const { curatedFixture } = await import('../../roadmap/fixtures/index.ts')
  const { withFoundationSettled } = await import('../../roadmap/fixtures/run.ts')
  // The settled demo is the live tenant's case: every Direction step done, the admin
  // accounts group (2.2) and the emergency account's key (2.3) left unanswered.
  // The admin accounts group is asked only where the scan read a PIM-eligible admin (owner, 2026-10-07).
  const eligible = curatedFixture('demo')
  eligible.snapshot.roles = { ...eligible.snapshot.roles, eligible: { [eligible.snapshot.users[3].id]: ['62e90394-69f5-4237-9190-012177145e10'] } }
  const steps = runFixture(withFoundationSettled(eligible)).steps
  const held = steps.find((s) => s.id === stepIdForGoal('admin-accounts-group-strength'))!
  assert.ok(held.blockers.some((b) => b.label === 'direction:s-direction-accounts'), 'the premise: 4.5 waits on 2.2')
  assert.equal(steps.find((s) => s.id === 's-direction-accounts')?.status, 'done', 'the premise: 2.2 is done')
  const ids = inputStepIds(steps)
  // Decide How and Where People Sign In asks no optional question any more (owner, 2026-10-07), so only 2.2 is counted again.
  assert.ok(ids.has('s-direction-accounts') && !ids.has('s-direction-devices'), [...ids].join(', '))
  assert.ok(!ids.has(held.id), 'the step that waits is not counted too: the question is asked in one place')
})
