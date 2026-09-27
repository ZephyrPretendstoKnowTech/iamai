// The service, shared-device and mail-sending pickers say when an account is an
// administrator or the one signed in now (F-056): Casey Kim, Global
// Administrator and the demo's own account, was the first result for "a" in
// 2.1's email-device picker, unmarked, and approving it made a service account
// of it, left out of every policy that asks everyone for MFA.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { QUESTION_STEP } from '../../roadmap/answers.ts'
import { accountMarkOf, adminPickedLine, adminsOf, pickerUniverse, withAccountMark } from './pickerRows.ts'

test('an administrator and the signed-in account are marked, in the list and on the chip, and nobody else is', () => {
  const admins = new Set(['a', 'op'])
  assert.equal(accountMarkOf('a', admins, 'me'), 'Administrator')
  assert.equal(accountMarkOf('me', admins, 'me'), 'Your account')
  assert.equal(accountMarkOf('op', admins, 'op'), 'Administrator · Your account')
  assert.equal(accountMarkOf('x', admins, 'op'), null)
  assert.equal(accountMarkOf('x', admins, null), null)

  const f = fixture('demo')
  const nameOf = (id: string): string => f.snapshot.users.find((u) => u.id === id)?.displayName ?? id
  const demoAdmins = adminsOf(f.snapshot)
  const offered = pickerUniverse(QUESTION_STEP.mailDevices, 'accounts', { snapshot: f.snapshot, mapping: f.mapping, nameOf }).map((o) => withAccountMark(o, demoAdmins, f.operatorId))
  const casey = offered.find((o) => o.name === 'Casey Kim')!
  assert.equal(casey.why, 'Administrator · Your account · user0@demo.example.com')
  assert.equal(casey.badge, 'Administrator · Your account')
  assert.equal(offered.find((o) => o.name === 'Kai Patel')!.why, undefined, 'a person with no role keeps the plain line')

  assert.equal(adminPickedLine([f.operatorId!, 'nobody'], demoAdmins, f.operatorId, nameOf), 'Picked here: Casey Kim (administrator, your account). A picked account is treated as a service account and kept out of the policies that ask everyone for MFA.')
  assert.equal(adminPickedLine(['nobody'], demoAdmins, f.operatorId, nameOf), null)
})

test('the Direction pickers mark their accounts, and Approve answers carries the line', () => {
  const page = readFileSync('src/ui/surfaces/DirectionQuestions.tsx', 'utf8')
  assert.match(page, /pickerUniverse\(stepId, 'accounts', pickerCtx\)\.map\(\(o\) => withAccountMark\(/)
  assert.match(page, /\{adminLine && <p className="reason">\{adminLine\}<\/p>\}/)
  assert.match(readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8'), /<ApproveAnswers draft=\{directionDraft\} onDecide=\{onDecide\} saving=\{saveStatus === 'saving'\} ctx=\{ctx\} \/>/)
})
