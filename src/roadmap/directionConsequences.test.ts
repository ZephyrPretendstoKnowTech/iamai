// The decision cards say what each answer does, beside the baseline's version
// (F-041, F-067, F-069).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { DIRECTION_LOCATIONS_STORAGE, DIRECTION_STEP } from './directionAnswers.ts'
import { answerKey } from './answers.ts'
import { directionWords } from '../content/content.ts'

const Q = directionWords.questions

function questionOf(f: Fixture, stepId: string, key: string) {
  const step = runFixture(f).steps.find((s) => s.id === stepId)
  const q = step?.directionQuestions?.find((x) => x.key === key)
  assert.ok(q, `the premise: ${stepId} asks ${key}`)
  return q
}

test('the partner card shows the baseline’s version beside Yes, and says what No does (F-041, F-067)', () => {
  const q = questionOf(fixture('demo'), DIRECTION_STEP.use, 'partner')
  assert.equal(q.suggested?.value, 'yes', 'the premise: the demo saw a partner sign in, so Yes is suggested')
  assert.equal(q.chosen?.yes, 'Keeps partner and MSP technicians out of Require MFA for Guests and Block Sign-ins From Countries Not Allowed · your choice; the baseline’s version: they sign in with MFA like any guest, and only from your countries'.replace('’', "'"))
  assert.equal(q.chosen?.no, 'Partner and MSP technicians sign in with MFA like any guest, and only from your countries, as the baseline asks.')
})

test('the mail-devices card says what None does to the senders the scan saw (F-067)', () => {
  const q = questionOf(fixture('demo'), DIRECTION_STEP.use, 'mailDevices')
  assert.equal(q.suggested?.value, 'some', 'the premise: the demo saw a mail sender')
  assert.equal(q.chosen?.none, "Once Block Legacy Authentication is on, these accounts can't send mail the old way.")
  // A tenant where nobody sends mail by signing in: None has nothing to say.
  const quiet = questionOf(fixture('getiamai'), DIRECTION_STEP.use, 'mailDevices')
  if (quiet.suggested?.value === 'none') assert.equal(quiet.chosen?.none, undefined)
})

test('with everyone working remotely, the service and shared-device cards and the office answer say those accounts get MFA like anyone (F-069)', () => {
  const f = structuredClone(fixture('demo'))
  const svc = f.snapshot.users.find((u) => /^svc-/.test(u.displayName ?? ''))
  assert.ok(svc, 'the premise: the demo has a service account')
  f.mapping.serviceAccountUserIds = [svc.id]
  f.mapping.questionAnswers = { ...(f.mapping.questionAnswers ?? {}), [answerKey(DIRECTION_LOCATIONS_STORAGE, 'officeNetwork')]: 'remote' }
  const joins = 'Counts these accounts as people: everyone works remotely, so there is no office network to keep them to, and they get MFA like anyone.'
  assert.equal(Q.sharedDevices.joinsRemote, joins)
  assert.equal(questionOf(f, DIRECTION_STEP.accounts, 'serviceAccounts').chosen?.some, joins)
  assert.equal(questionOf(f, DIRECTION_STEP.devices, 'officeNetwork').chosen?.remote, `${Q.officeNetwork.chosen.remote} Your service and shared-device accounts then count as people and get MFA like anyone.`)
  // With an office network, the service accounts keep their exclusion, and nothing says otherwise.
  const office = structuredClone(fixture('demo'))
  office.mapping.serviceAccountUserIds = [svc.id]
  assert.equal(questionOf(office, DIRECTION_STEP.accounts, 'serviceAccounts').chosen?.some, undefined)
  // With no accounts picked, the remote answer says nothing about them.
  const none = structuredClone(fixture('demo'))
  none.mapping.serviceAccountUserIds = []
  none.mapping.sharedDeviceUserIds = []
  assert.equal(questionOf(none, DIRECTION_STEP.devices, 'officeNetwork').chosen?.remote, Q.officeNetwork.chosen.remote)
})
