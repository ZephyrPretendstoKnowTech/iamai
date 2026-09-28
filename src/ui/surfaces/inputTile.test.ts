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
