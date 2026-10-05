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
import { DIRECTION_LOCATIONS_STORAGE, DIRECTION_STEP, answeredReasonOf, directionMilestoneAction } from './directionAnswers.ts'
import { EXCLUSIONS_RECORD_KEY } from '../mapping/safetyChoice.ts'

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
  assert.match(q?.chosen?.some ?? '', /no office network to keep these accounts to/)
  const office = withOffice('office')
  office.mapping.sharedDeviceUserIds = f.mapping.sharedDeviceUserIds
  const qo = runFixture(office).steps.flatMap((s) => s.directionQuestions ?? []).find((x) => x.key === 'sharedDevices')
  assert.match(qo?.chosen?.some ?? '', /keeps them to your office network/)
})

// A fully remote business opening 2.2 read that its accounts join a group
// "kept to your office network", two lines above "there is no office network
// to keep these accounts to" (Round 4 walk). With a remote answer the About and
// the milestone stop at what stays true; with an office they are unchanged.
test('2.2 names the service-accounts group only when there is an office (owner, 2026-09-27)', () => {
  for (const [answer, group] of [['remote', false], ['office', true]] as const) {
    const f = withOffice(answer)
    const step = runFixture(f).steps.find((s) => s.id === DIRECTION_STEP.accounts)
    assert.ok(step, 'the premise: 2.2 is on the plan')
    for (const why of [step.why, step.guidance?.why]) {
      assert.match(why ?? '', /stops counting them as people/, `${answer}: ${why}`)
      assert.equal(/service-accounts group|office network/.test(why ?? ''), group, `${answer}: ${why}`)
    }
    const milestone = directionMilestoneAction(DIRECTION_STEP.accounts, f.mapping) ?? ''
    assert.match(milestone, /which accounts count as people/)
    assert.equal(/service-accounts group/.test(milestone), group, `${answer}: ${milestone}`)
  }
})

test('with an office, each block is a step to do', () => {
  const r = runFixture(withOffice('office'))
  for (const id of [...BLOCKS, PREREQ_STEP_ID.serviceAccountsGroup]) {
    const s = r.steps.find((x) => x.id === id)
    assert.ok(s, `${id} is on the plan`)
    assert.equal(s.doesntApply ?? null, null, `${id}: ${s.doesntApply}`)
  }
})

// Owner, 2026-09-28: with everyone remote and a Countries block in the tenant,
// Restrict SharePoint and OneDrive read Completed. The Countries block is the
// countries goal's alone, so the three blocks read Doesn't apply by the answer
// and the Countries step is the one it completes.
test('everyone remote, with a Countries block: the three blocks read Doesn’t apply and the Countries step is complete', () => {
  const f = withOffice('remote')
  const country = 'c0c0c0c0-0000-4000-8000-00000000c0c0'
  const ex = (f.mapping.records[EXCLUSIONS_RECORD_KEY] as { resolvedId?: string } | undefined)?.resolvedId
  ;(f.snapshot.config.namedLocations!.rows as unknown[]).push({ '@odata.type': '#microsoft.graph.countryNamedLocation', id: country, displayName: 'Allowed countries', countriesAndRegions: ['AU'], countryLookupMethod: 'clientIpAddress', includeUnknownCountriesAndRegions: false })
  ;(f.snapshot.config.caPolicies!.rows as unknown[]).push({ id: 'p-countries', displayName: 'Block - Countries not allowed', state: 'enabled', conditions: { users: { includeUsers: ['All'], excludeGroups: [ex] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'], locations: { includeLocations: ['All'], excludeLocations: [country] } }, grantControls: { operator: 'OR', builtInControls: ['block'] } })
  const r = runFixture(f)
  const reason = answeredReasonOf('officeNetwork', 'remote')
  for (const id of BLOCKS) {
    const s = r.steps.find((x) => x.id === id)
    assert.ok(s, `${id} stays as a row`)
    assert.notEqual(s.status, 'done', `${id} read Completed from the Countries block`)
    assert.equal(s.doesntApply, reason, id)
  }
  assert.equal(r.steps.find((x) => x.goalId === 'geo-restriction')?.status, 'done', 'the Countries block does not complete the Countries step')
})
