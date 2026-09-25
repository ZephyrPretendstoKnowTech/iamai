// Phase 2d (owner decision 5, 2026-09-24): with everyone working remotely, every
// policy whose only purpose is blocking sign-ins from outside the trusted network
// reads Doesn't apply, with the office answer as the reason — Jon's service
// accounts, SharePoint and OneDrive, and AVD blocks — and so does the
// service-accounts group, which nothing else uses then.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { PREREQ_STEP_ID } from './stepIds.ts'
import { answerKey } from './answers.ts'
import { DIRECTION_LOCATIONS_STORAGE, answeredReasonOf } from './directionAnswers.ts'

const BLOCKS = ['s-goal-service-accounts-trusted-network', 's-goal-avd-trusted-network', 's-goal-sharepoint-trusted-network']

/** demo with AVD and SharePoint in use and the office answer given. */
function withOffice(office: 'office' | 'remote'): Fixture {
  const f = structuredClone(fixture('demo'))
  f.mapping.workflowAnswers = { ...(f.mapping.workflowAnswers ?? {}), avd: 'yes', sharepoint: 'yes' }
  const on = { on: true, reason: 'confirmed in use' }
  f.mapping.facetOverrides = { ...f.mapping.facetOverrides, avd: on, sharepoint: on }
  f.mapping.questionAnswers = { ...(f.mapping.questionAnswers ?? {}), [answerKey(DIRECTION_LOCATIONS_STORAGE, 'officeNetwork')]: office }
  return f
}

test('everyone remote: the three trusted-network blocks and the service-accounts group read Doesn’t apply, by the answer', () => {
  const f = withOffice('remote')
  assert.ok(f.mapping.serviceAccountUserIds.length > 0, 'the premise: demo has service accounts')
  const r = runFixture(f)
  const reason = answeredReasonOf('officeNetwork', 'remote')
  for (const id of [...BLOCKS, PREREQ_STEP_ID.serviceAccountsGroup]) {
    const s = r.steps.find((x) => x.id === id)
    assert.ok(s, `${id} stays as a row`)
    assert.equal(s.doesntApply, reason, id)
    assert.equal(s.doesntApplyByAnswer, true, `${id} is set aside by the answer, not the person’s own skip`)
  }
})

test('2.2 says what a remote answer does to shared-device accounts: nothing keeps them to an office', () => {
  const f = withOffice('remote')
  f.mapping.sharedDeviceUserIds = [f.snapshot.users.find((u) => u.userType !== 'guest' && !f.mapping.breakGlassUserIds.includes(u.id) && !f.mapping.serviceAccountUserIds.includes(u.id))!.id]
  const q = runFixture(f).steps.flatMap((s) => s.directionQuestions ?? []).find((x) => x.key === 'sharedDevices')
  assert.match(q?.chosen?.some ?? '', /no office network to keep them to/)
  const office = withOffice('office')
  office.mapping.sharedDeviceUserIds = f.mapping.sharedDeviceUserIds
  const qo = runFixture(office).steps.flatMap((s) => s.directionQuestions ?? []).find((x) => x.key === 'sharedDevices')
  assert.match(qo?.chosen?.some ?? '', /keeps them to your office network/)
})

test('with an office, each block is a step to do', () => {
  const r = runFixture(withOffice('office'))
  for (const id of [...BLOCKS, PREREQ_STEP_ID.serviceAccountsGroup]) {
    const s = r.steps.find((x) => x.id === id)
    assert.ok(s, `${id} is on the plan`)
    assert.equal(s.doesntApply ?? null, null, `${id}: ${s.doesntApply}`)
  }
})
