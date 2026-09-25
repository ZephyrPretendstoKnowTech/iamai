// Block Legacy Authentication's completion and turn-on, and the edit
// Configure Emergency Exclusions asks for, read from the scan (walk list 4.x
// items 4, 5 and 7). One behaviour each.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { observationsOf } from './tracking.ts'
import { policyResult } from './operations.ts'
import { QUESTION_STEP, answerKey, answerTextFor, questionLabels, questionOptions } from './answers.ts'
import { LEGACY_AUTH_STEP_ID, MAIL_ACCOUNTS_WAIT, mailAnswerMoot } from './blockSignIns.ts'
import { EXCLUSION_GROUP_STEP_ID } from './stepIds.ts'

/** The tenant with `id` named in Confirm What You Use's mail-sending answer, and signing in by SMTP or not. */
function naming(f: Fixture, id: string, legacy: boolean): Fixture {
  const next = structuredClone(f)
  const key = answerKey(QUESTION_STEP.mailDevices, questionLabels(QUESTION_STEP.mailDevices).decision!)
  next.mapping = { ...next.mapping, questionAnswers: { ...(next.mapping.questionAnswers ?? {}), [key]: answerTextFor(questionOptions(QUESTION_STEP.mailDevices, 'decision')[1], [id]) } }
  const clients = next.snapshot.scenarioEvidence!.legacyClients.byPerson
  if (legacy) clients[id] = ['Authenticated SMTP']
  else delete clients[id]
  return next
}

test('item 4: a named mail account still signing in with legacy authentication keeps the enforced policy open; the scan completes it once it has moved', () => {
  const week2 = fixture('demo-week2')
  const id = week2.snapshot.users.find((u) => u.userPrincipalName === 'mfp-reception@demo.example.com')!.id
  const open = runFixture(naming(week2, id, true)).steps.find((s) => s.id === LEGACY_AUTH_STEP_ID)!
  assert.equal(open.state.lifecycle, 'enforced', 'the premise: the policy is on')
  assert.deepEqual(open.mailAccountsToMove, [id])
  assert.notEqual(open.status, 'done', 'the policy being on completed the step with the mail account still to move')
  assert.equal(open.manualReview, undefined, 'the step asks for a record')
  assert.equal(policyResult(open).kind, 'not-policy', 'the step offers a policy change, or none at all, where the work is the move')
  const moved = runFixture(naming(week2, id, false)).steps.find((s) => s.id === LEGACY_AUTH_STEP_ID)!
  assert.equal(moved.mailAccountsToMove, undefined)
  assert.equal(moved.status, 'done', 'the scan does not complete the step once the account has moved')
})

test('item 5: with a named mail account still on legacy authentication, the report-only create goes ahead and the turn-on waits', () => {
  const g = fixture('getiamai')
  const id = g.snapshot.users.find((u) => u.accountEnabled && u.userType !== 'guest' && !/^bg\d/.test(u.userPrincipalName ?? ''))!.id
  const step = runFixture(naming(g, id, true)).steps.find((s) => s.id === LEGACY_AUTH_STEP_ID)!
  assert.equal(step.state.lifecycle, 'not-deployed', 'the premise')
  assert.ok(step.blockers.some((b) => b.kind === 'readiness' && b.label === MAIL_ACCOUNTS_WAIT), 'the turn-on does not wait for the account')
  assert.ok(!step.blockers.some((b) => b.kind === 'step' && b.stepId === 's-prereq-service-accounts-group'), 'the turn-on still waits on the service accounts group')
  const none = runFixture(naming(g, id, false)).steps.find((s) => s.id === LEGACY_AUTH_STEP_ID)!
  assert.ok(!none.blockers.some((b) => b.label === MAIL_ACCOUNTS_WAIT), 'an account that has moved still holds the turn-on')
})

test('item 7: the exclusions edit Configure Emergency Exclusions asks for is not asked again, and making it raises no review', () => {
  // The demo's legacy policy also excludes a group the plan's does not, which is a
  // correction of its own (every control is exact, owner 2026-09-25): taken out, so
  // the exclusions group is all it lacks.
  const demo = structuredClone(fixture('demo'))
  for (const row of demo.snapshot.config.caPolicies!.rows as { displayName?: string; conditions?: { users?: { excludeGroups?: string[] } } }[]) {
    if (/Legacy authentication/.test(row.displayName ?? '') && row.conditions?.users) row.conditions.users.excludeGroups = []
  }
  const first = runFixture(demo)
  const legacy = first.steps.find((s) => s.id === LEGACY_AUTH_STEP_ID)!
  assert.equal(legacy.action.correctionAskedBy, EXCLUSION_GROUP_STEP_ID, 'the premise: the policy lacks only the exclusions group')
  assert.ok(legacy.blockers.some((b) => b.kind === 'step' && b.stepId === EXCLUSION_GROUP_STEP_ID), 'the step does not wait on Configure Emergency Exclusions')
  assert.equal(policyResult(legacy).kind, 'held', 'the step hands over the same edit')
  // The person makes the edit in Configure Emergency Exclusions; the next scan reads it.
  const group = legacy.action.resolution!.tenant.exclusionsGroupId!
  const edited = structuredClone(demo)
  for (const row of edited.snapshot.config.caPolicies!.rows as { displayName?: string; conditions?: { users?: { excludeGroups?: string[] } } }[]) {
    if (!/Legacy authentication/.test(row.displayName ?? '') || !row.conditions?.users) continue
    row.conditions.users.excludeGroups = [...new Set([...(row.conditions.users.excludeGroups ?? []), group])]
  }
  const next = runFixture(edited, {}, observationsOf(first.steps), edited.snapshot.asOf).steps.find((s) => s.id === LEGACY_AUTH_STEP_ID)!
  assert.equal(next.state.satisfied, true, 'the premise: the policy now delivers the goal')
  assert.equal(next.state.members[0].change.reviewRequired, false, 'the edit the plan asked for reads as a change to review')
  assert.notEqual(next.state.condition, 'review-required')
})

test('4.1 waits on no mail answer where the records, read whole, show nobody using legacy authentication (net-new 26)', () => {
  const legacy = (name: 'getiamai' | 'small' | 'hostile') => runFixture(curatedFixture(name)).steps.find((s) => s.id === LEGACY_AUTH_STEP_ID)!
  const directionWait = (s: ReturnType<typeof legacy>) => s.blockers.some((b) => b.label === 'direction:s-direction-use')
  // getiamai: read whole, nobody.
  assert.equal(mailAnswerMoot(curatedFixture('getiamai').snapshot), true, 'the premise')
  assert.equal(directionWait(legacy('getiamai')), false)
  assert.equal(legacy('getiamai').unsavedInputs, undefined, 'nor is the answer asked of it')
  // small: someone used it, so the answer can still move an account.
  assert.equal(mailAnswerMoot(curatedFixture('small').snapshot), false, 'the premise')
  assert.equal(directionWait(legacy('small')), true)
  // hostile: the records were not read, so nothing shows nobody.
  assert.equal(mailAnswerMoot(curatedFixture('hostile').snapshot), false)
  assert.equal(directionWait(legacy('hostile')), true)
})
