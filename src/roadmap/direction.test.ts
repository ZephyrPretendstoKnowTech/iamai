// Decide Your Tenant's Direction (roadmap/direction.ts, directionAnswers.ts):
// the four steps' questions, their suggestions, where their answers are stored,
// completion, and reopening (docs/plans/direction-spec.md).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { directionSteps } from './direction.ts'
import type { DirectionInput } from './direction.ts'
import { DIRECTION_STEP, answersOfDecision, directionDecisionOf, savedAnswerOf } from './directionAnswers.ts'
import type { DirectionAnswer } from './directionAnswers.ts'
import { applyStepDecisions } from './decisions.ts'
import type { StepDecision } from './decisions.ts'
import { DEVICE_ANSWER_KEYS, QUESTION_STEP, answerKey, devicePlanOf, deviceCodeWorkflowsOf, mailDevicesOf, questionLabels, serviceProvidersExcluded } from './answers.ts'
import { PREREQ_STEP_ID } from './stepIds.ts'
import { directionWords } from '../content/content.ts'
import type { DirectionQuestion, Step } from './types.ts'
import type { Fixture } from './fixtures/index.ts'

const W = directionWords
const AT = '2026-09-18T00:00:00Z'

function stepsOf(f: Fixture, over: Partial<DirectionInput> = {}): Step[] {
  const run = runFixture(f)
  return directionSteps({ snapshot: f.snapshot, mapping: f.mapping, notAssessed: run.coverage.organisation.notAssessed, availableGoalIds: run.coverage.results.filter((r) => r.status !== 'licence-limited').map((r) => r.goal.id), ...over })
}
const stepOf = (steps: Step[], id: string): Step => steps.find((s) => s.id === id)!
const q = (step: Step, key: string): DirectionQuestion => step.directionQuestions!.find((x) => x.key === key)!

/** What Approve answers saves: every question at its saved answer, else its suggestion. */
function approve(step: Step, change: Record<string, DirectionAnswer> = {}): StepDecision {
  const answers = Object.fromEntries(step.directionQuestions!.map((x) => [x.key, change[x.key] ?? x.saved ?? x.suggested]))
  const basis = Object.fromEntries(step.directionQuestions!.filter((x) => x.basis !== null).map((x) => [x.key, x.basis!]))
  return { ...directionDecisionOf(answers, basis), at: AT }
}

/** A tenant the scan read nothing about: no sign-in evidence, no usage, no methods policy, no named locations. */
function noSignal(): Fixture {
  const f = fixture('demo')
  f.snapshot.scenarioEvidence = null as never
  f.snapshot.evidenceUsage = null
  f.snapshot.sources.signInEvidence = { ...f.snapshot.sources.signInEvidence, status: 'error' }
  f.snapshot.sources.appSignInSummary = { ...f.snapshot.sources.appSignInSummary, status: 'error' }
  f.snapshot.config.authMethodsPolicy = { ...f.snapshot.config.authMethodsPolicy, status: 'error' }
  f.snapshot.config.namedLocations = { ...f.snapshot.config.namedLocations, status: 'error' }
  f.snapshot.config.roleAssignments = { ...f.snapshot.config.roleAssignments, status: 'error' }
  return f
}

test('(b) with no signal every suggestion is the safe default, and says it is one', () => {
  const steps = stepsOf(noSignal())
  const use = stepOf(steps, DIRECTION_STEP.use)
  for (const x of use.directionQuestions!.filter((x) => x.key.startsWith('service:'))) {
    assert.equal(x.suggested.value, 'yes', `${x.key}: a service keeps its policy`)
    assert.equal(x.evidence, W.defaultEvidence, x.key)
  }
  assert.deepEqual([q(use, 'mailDevices').suggested.value, q(use, 'deviceCode').suggested.value, q(use, 'partner').suggested.value, q(use, 'externalMethods').suggested.value], ['none', 'unused', 'no', 'no'], 'no exception is granted')
  for (const key of ['mailDevices', 'deviceCode', 'partner', 'externalMethods']) assert.equal(q(use, key).evidence, W.defaultEvidence, key)
  const devices = stepOf(steps, DIRECTION_STEP.devices)
  assert.equal(q(devices, 'deviceExceptions').suggested.value, 'none')
  assert.equal(q(devices, 'deviceExceptions').evidence, W.defaultEvidence)
  assert.equal(q(stepOf(steps, DIRECTION_STEP.locations), 'officeNetwork').suggested.value, 'remote')
  assert.equal(q(stepOf(steps, DIRECTION_STEP.locations), 'officeNetwork').evidence, W.defaultEvidence)
})

test('(b) a what-you-use question takes today\'s state; a how-it-should-work question takes the baseline\'s, today beside it', () => {
  const f = fixture('demo')
  const steps = stepsOf(f)
  const use = stepOf(steps, DIRECTION_STEP.use)
  const sharepoint = q(use, 'service:sharepoint')
  assert.equal(sharepoint.suggested.value, 'yes', 'seen in use')
  assert.notEqual(sharepoint.evidence, W.defaultEvidence, 'the evidence it was seen by')
  assert.equal(sharepoint.basis, 'present')
  // The scan read the sign-ins and saw none: today's state is No, and it says so.
  const quiet = fixture('demo')
  quiet.snapshot.appSignInSummary = []
  quiet.snapshot.spActivity = []
  const avd = q(stepOf(stepsOf(quiet), DIRECTION_STEP.use), 'service:avd')
  if (avd) {
    assert.equal(avd.suggested.value, 'no')
    assert.equal(avd.basis, 'absent')
  }
  // Device code sign-ins seen: In use.
  const seen = fixture('demo')
  seen.snapshot.evidenceUsage = { ...seen.snapshot.evidenceUsage!, deviceCode: { count: 3, userIds: ['u1'], byDetail: {} } }
  const code = q(stepOf(stepsOf(seen), DIRECTION_STEP.use), 'deviceCode')
  assert.equal(code.suggested.value, 'used')
  assert.match(code.evidence, /1 person used device code/)
  // D3: the baseline's recommendation, with today beside it.
  const devices = stepOf(steps, DIRECTION_STEP.devices)
  assert.equal(q(devices, 'computers').suggested.value, 'managed')
  assert.equal(q(devices, 'phones').suggested.value, 'apps')
  assert.equal(q(devices, 'computers').evidence, W.baselineEvidence)
  assert.match(q(devices, 'computers').today ?? '', /^Today: /)
  // D4: travel is the baseline's; work countries are where sign-ins came from.
  const locations = stepOf(steps, DIRECTION_STEP.locations)
  assert.equal(q(locations, 'travel').suggested.value, 'allowed')
  assert.ok(q(locations, 'workCountries').suggested.picked.length > 0)
})

test('(c) Approve answers saves to the keys the answers have always lived under', () => {
  const f = fixture('demo')
  f.mapping.workflowAnswers = {}
  f.mapping.facetOverrides = {}
  f.mapping.questionAnswers = {}
  const steps = stepsOf(f)
  const use = stepOf(steps, DIRECTION_STEP.use)
  const devices = stepOf(steps, DIRECTION_STEP.devices)
  const locations = stepOf(steps, DIRECTION_STEP.locations)
  const printer = f.snapshot.users[1].id
  const decisions: Record<string, StepDecision> = {
    [DIRECTION_STEP.use]: approve(use, { 'service:sharepoint': { value: 'no', picked: [] }, mailDevices: { value: 'some', picked: [printer] }, deviceCode: { value: 'unused', picked: [] }, partner: { value: 'yes', picked: [] } }),
    [DIRECTION_STEP.devices]: approve(devices, { computers: { value: 'hybrid', picked: [] }, phones: { value: 'blocked', picked: [] } }),
    [DIRECTION_STEP.locations]: approve(locations, { officeNetwork: { value: 'remote', picked: [] }, workCountries: { value: 'some', picked: ['AU', 'NZ'] }, travel: { value: 'never', picked: [] } }),
  }
  const m = applyStepDecisions(f.mapping, decisions)
  assert.equal(m.workflowAnswers?.sharepoint, 'no')
  assert.deepEqual(m.facetOverrides.sharepoint?.on, false)
  assert.ok(m.workflowConfirmedAt)
  assert.deepEqual(mailDevicesOf(m), [printer])
  assert.ok(m.serviceAccountUserIds.includes(printer), 'the mail-sending device joins the service accounts, as before')
  assert.equal(deviceCodeWorkflowsOf(m), false)
  assert.equal(serviceProvidersExcluded(m), true)
  assert.equal(m.questionAnswers?.[answerKey(QUESTION_STEP.devices, DEVICE_ANSWER_KEYS.computers)], 'hybrid')
  assert.equal(devicePlanOf(m)?.noWorkPhones, true)
  assert.equal(m.wizardAnswered.trustedLocations, true)
  assert.deepEqual(m.trustedLocationIds, [])
  assert.deepEqual(m.allowedCountries, ['AU', 'NZ'])
  assert.equal(m.workCountriesConfirmed, true)
  assert.equal(m.questionAnswers?.[answerKey(DIRECTION_STEP.locations, 'travel')], 'never')
  assert.equal(m.questionAnswers?.[answerKey(DIRECTION_STEP.use, 'externalMethods')], 'no')
  // And the steps read those answers back as approved.
  const after = stepsOf({ ...f, mapping: m })
  for (const id of [DIRECTION_STEP.use, DIRECTION_STEP.devices, DIRECTION_STEP.locations]) assert.equal(stepOf(after, id).status, 'done', id)
  assert.equal(q(stepOf(after, DIRECTION_STEP.use), 'service:sharepoint').saved?.value, 'no')
})

test('(c) an answer saved before Direction existed still reads as saved', () => {
  const f = fixture('demo')
  const partner = questionLabels(QUESTION_STEP.partner).question!
  const m = applyStepDecisions(f.mapping, {
    's-confirm-workloads': { answers: { sharepoint: 'yes', 'evidence:sharepoint': 'present' }, at: AT },
    [QUESTION_STEP.deviceCode]: { option: 'None', at: AT },
    [QUESTION_STEP.mailDevices]: { option: 'None', at: AT },
    [QUESTION_STEP.partner]: { picked: [], answers: { [partner]: 'Prompt them like any guest' }, at: AT },
    [QUESTION_STEP.devices]: { answers: { [DEVICE_ANSWER_KEYS.phoneManagement]: 'enrolled', [DEVICE_ANSWER_KEYS.phoneAppProtection]: 'required', [DEVICE_ANSWER_KEYS.computers]: 'enrolled' }, at: AT },
    [PREREQ_STEP_ID.trustedLocation]: { picked: [], option: 'remote', at: AT },
    [PREREQ_STEP_ID.serviceAccountsGroup]: { picked: [], at: AT },
  })
  assert.deepEqual(savedAnswerOf('service:sharepoint', m), { value: 'yes', picked: [] })
  assert.deepEqual(savedAnswerOf('deviceCode', m), { value: 'unused', picked: [] })
  assert.deepEqual(savedAnswerOf('mailDevices', m), { value: 'none', picked: [] })
  assert.deepEqual(savedAnswerOf('partner', m), { value: 'no', picked: [] })
  assert.deepEqual(savedAnswerOf('computers', m), { value: 'managed', picked: [] })
  assert.deepEqual(savedAnswerOf('phones', m), { value: 'enrolled', picked: [] })
  assert.deepEqual(savedAnswerOf('officeNetwork', m), { value: 'remote', picked: [] })
  assert.deepEqual(savedAnswerOf('serviceAccounts', m), { value: 'none', picked: [] })
  // A saved Direction decision round-trips through its own encoding.
  const d = directionDecisionOf({ mailDevices: { value: 'some', picked: ['a', 'b'] } })
  assert.deepEqual(answersOfDecision({ ...d }), { mailDevices: { value: 'some', picked: ['a', 'b'] } })
})

test('(d) a legacy "Not sure" reads as unanswered: the suggestion shows and the step still needs approval', () => {
  const f = fixture('demo')
  f.mapping.facetOverrides = {}
  f.mapping.workflowAnswers = { sharepoint: 'unsure' }
  const use = stepOf(stepsOf(f), DIRECTION_STEP.use)
  const sharepoint = q(use, 'service:sharepoint')
  assert.equal(sharepoint.saved, null)
  assert.equal(sharepoint.suggested.value, 'yes')
  assert.notEqual(use.status, 'done')
  assert.equal(use.state.condition, 'needs-decision')
  assert.equal(savedAnswerOf('service:sharepoint', f.mapping), null)
  for (const x of use.directionQuestions!) assert.ok(x.options.every((o) => !/not sure/i.test(o.label)), `${x.key} offers no Not sure`)
  assert.equal(W.notSure, 'Not sure? Keep the suggestion. You can change it any time.')
})

test('(f) a saved No reopens Confirm What You Use when new usage appears; missing evidence never does', () => {
  const f = fixture('demo')
  f.mapping.workflowAnswers = {}
  f.mapping.facetOverrides = {}
  const first = stepOf(stepsOf(f), DIRECTION_STEP.use)
  // Saved No while the scan could not read usage.
  const unread = fixture('demo')
  unread.snapshot.sources.appSignInSummary = { ...unread.snapshot.sources.appSignInSummary, status: 'error' }
  unread.mapping.workflowAnswers = {}
  unread.mapping.facetOverrides = {}
  const unreadStep = stepOf(stepsOf(unread), DIRECTION_STEP.use)
  const saved = applyStepDecisions(f.mapping, { [DIRECTION_STEP.use]: approve(unreadStep, { 'service:sharepoint': { value: 'no', picked: [] } }) })
  // Now the scan sees SharePoint in use: the saved No is contradicted.
  const reopened = stepOf(stepsOf({ ...f, mapping: saved }), DIRECTION_STEP.use)
  assert.equal(q(reopened, 'service:sharepoint').needsReview, true)
  assert.equal(q(reopened, 'service:sharepoint').saved?.value, 'no', 'the saved answer stays visible')
  assert.notEqual(reopened.status, 'done')
  // Evidence going missing never reopens: a saved Yes with the usage unread stays done.
  const yes = applyStepDecisions(f.mapping, { [DIRECTION_STEP.use]: approve(first) })
  assert.equal(stepOf(stepsOf({ ...f, mapping: yes }), DIRECTION_STEP.use).status, 'done')
  assert.equal(stepOf(stepsOf({ ...unread, mapping: yes }), DIRECTION_STEP.use).status, 'done', 'usage unread: still done')
  const noUnread = applyStepDecisions(unread.mapping, { [DIRECTION_STEP.use]: approve(unreadStep, { 'service:sharepoint': { value: 'no', picked: [] } }) })
  assert.equal(stepOf(stepsOf({ ...unread, mapping: noUnread }), DIRECTION_STEP.use).status, 'done', 'a saved No with nothing seen stays done')
})

test('(g) the retired steps are gone as rows, and D3 shows even with no device sign-ins', () => {
  const f = fixture('demo')
  if (f.snapshot.scenarioEvidence) {
    delete f.snapshot.scenarioEvidence.phoneSignIns
    delete f.snapshot.scenarioEvidence.unjoinedComputers
  }
  const ids = runFixture(f).steps.map((s) => s.id)
  assert.equal(ids.includes('s-confirm-workloads'), false)
  assert.equal(ids.includes(PREREQ_STEP_ID.devicePlan), false)
  for (const id of Object.values(DIRECTION_STEP)) assert.ok(ids.includes(id), id)
})
