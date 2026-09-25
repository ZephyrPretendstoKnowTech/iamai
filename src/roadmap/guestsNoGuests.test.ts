// Require MFA for Guests on a tenant with no guest account (owner audit,
// 2026-09-24): the policy On completes it, with no workflow record asked for,
// and its readiness counts guests, never every person.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture } from './fixtures/index.ts'
import { runFixture, withFoundationSettled, withRecoveryTested } from './fixtures/run.ts'
import { awaitsWorkflowRecord } from './operations.ts'

test('5.3 with the policy On and no guest in the directory is Completed, and asks for no workflow test', () => {
  const f = withRecoveryTested(withFoundationSettled(curatedFixture('small')))
  assert.equal(f.snapshot.users.filter((u) => u.userType === 'guest').length, 0, 'the premise: no guests')
  const step = runFixture(f).steps.find((s) => s.id === 's-goal-guests-mfa')!
  assert.equal(step.state.lifecycle, 'enforced', 'the premise: the policy is On')
  assert.equal(step.status, 'done')
  assert.equal(awaitsWorkflowRecord(step), false)
  assert.equal(step.manualReview, undefined)
  // Its readiness counts guests: none here, so no "N of M guests" line at all.
  assert.ok(!step.readiness.lines.some((l) => /guests? ha(s|ve) a method/.test(l)), step.readiness.lines.join(' | '))
})

test('5.3 with guests still asks for its record', () => {
  const f = withRecoveryTested(withFoundationSettled(curatedFixture('mid')))
  assert.ok(f.snapshot.users.some((u) => u.userType === 'guest'), 'the premise: mid has guests')
  const step = runFixture(f).steps.find((s) => s.id === 's-goal-guests-mfa')!
  assert.notEqual(step.status, 'done', 'guests to test: this rule does not complete it')
  assert.ok(step.manualReview, 'its record is still asked for')
})
