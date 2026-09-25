// Require MFA for Guests on a tenant with no guest account (owner audit,
// 2026-09-24): the policy On completes it, with no workflow record asked for.
// Its readiness counts everyone the policy reaches, which can be all users, so
// the count reads people: "17 of 22 guests" read on a tenant with none.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture } from './fixtures/index.ts'
import { runFixture, withFoundationSettled, withRecoveryTested } from './fixtures/run.ts'
import { awaitsWorkflowRecord } from './operations.ts'
import { CONTRACT } from '../ui/surfaces/stepContract.ts'

test('5.3 with the policy On and no guest in the directory is Completed, and asks for no workflow test', () => {
  const f = withRecoveryTested(withFoundationSettled(curatedFixture('small')))
  assert.equal(f.snapshot.users.filter((u) => u.userType === 'guest').length, 0, 'the premise: no guests')
  const step = runFixture(f).steps.find((s) => s.id === 's-goal-guests-mfa')!
  assert.equal(step.state.lifecycle, 'enforced', 'the premise: the policy is On')
  assert.equal(step.status, 'done')
  assert.equal(awaitsWorkflowRecord(step), false)
  assert.equal(step.manualReview, undefined)
})

test('5.3 counts the people its policy reaches as people, never as guests', () => {
  // The premise: the plan's guest policy reaches all users on getiamai, as the baseline writes it.
  const step = runFixture(curatedFixture('getiamai')).steps.find((s) => s.id === 's-goal-guests-mfa')!
  const users = (step.action.resolution?.policies[0]?.body as { conditions?: { users?: { includeUsers?: string[] } } } | undefined)?.conditions?.users
  assert.deepEqual(users?.includeUsers, ['All'])
  assert.ok((step.methodPreparation?.ids.length ?? 0) > 0, 'its readiness counts the members it reaches')
  assert.equal(CONTRACT.acceptedWho.guest, 'people')
  assert.equal(CONTRACT.readinessScope.guest, 'people in scope')
})

test('5.3 with guests still asks for its record', () => {
  const f = withRecoveryTested(withFoundationSettled(curatedFixture('mid')))
  assert.ok(f.snapshot.users.some((u) => u.userType === 'guest'), 'the premise: mid has guests')
  const step = runFixture(f).steps.find((s) => s.id === 's-goal-guests-mfa')!
  assert.notEqual(step.status, 'done', 'guests to test: this rule does not complete it')
  assert.ok(step.manualReview, 'its record is still asked for')
})
