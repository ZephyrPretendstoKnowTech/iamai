// Decide Your Tenant's Direction (roadmap/direction.ts, directionAnswers.ts):
// the four steps' questions, their suggestions, where their answers are stored,
// completion, and reopening (docs/plans/direction-spec.md).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { directionSteps, nextDirectionStep } from './direction.ts'
import type { DirectionInput } from './direction.ts'
import { DIRECTION_STEP, answersOfDecision, directionDecisionOf, legacyDecisionsOf, savedAnswerOf } from './directionAnswers.ts'
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
  // A tenant with no trusted named location is not thereby all-remote, and the
  // scan reads nothing either way (owner, 2026-09-20): the safe default is the
  // one that keeps Define the Trusted Network on the plan.
  assert.equal(q(stepOf(steps, DIRECTION_STEP.locations), 'officeNetwork').suggested.value, 'notInEntra')
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
  // The recommendation, and what it costs HERE. Managed means joined and
  // enrolled, so every computer under this answer needs an Intune licence,
  // and the question offered the baseline's advice with nothing about the
  // tenant beside it — on a tenant holding 300 seats with 41 in use.
  assert.ok(q(devices, 'computers').evidence.startsWith(W.baselineEvidence), q(devices, 'computers').evidence)
  assert.match(q(devices, 'computers').evidence, /Intune: [0-9]+ of [0-9]+ licences in use/)
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

test('the demo: its first visit answers none of Direction; week two approved it, the device answers still open', () => {
  const initial = fixture('demo')
  const first = runFixture({ ...initial, mapping: applyStepDecisions(initial.mapping, initial.decisions ?? {}) }).steps
  for (const id of Object.values(DIRECTION_STEP)) {
    const s = stepOf(first, id)
    assert.notEqual(s.status, 'done', `${id}: unanswered on the first visit`)
    assert.ok(s.directionQuestions!.every((x) => x.saved === null), `${id}: every question shows its suggestion`)
  }
  const week2 = fixture('demo-week2')
  const second = runFixture({ ...week2, mapping: applyStepDecisions(week2.mapping, week2.decisions ?? {}) }).steps
  for (const id of [DIRECTION_STEP.use, DIRECTION_STEP.accounts, DIRECTION_STEP.locations]) assert.equal(stepOf(second, id).status, 'done', `${id}: approved in week one`)
  assert.notEqual(stepOf(second, DIRECTION_STEP.devices).status, 'done', 'the device decision stays open, as it always has on the demo')
  // The answers are the ones the demo already assumed.
  const use = stepOf(second, DIRECTION_STEP.use)
  assert.equal(q(use, 'partner').saved?.value, 'yes')
  assert.equal(q(use, 'deviceCode').saved?.value, 'unused')
  assert.equal(q(use, 'mailDevices').saved?.value, 'some')
  assert.deepEqual(q(stepOf(second, DIRECTION_STEP.locations), 'workCountries').saved?.picked, week2.mapping.allowedCountries)
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

test('(e) a policy with an unanswered Direction dependency is held Waiting on your direction; one with none is not', async () => {
  const { laneReadings } = await import('../ui/surfaces/planLanes.ts')
  const { laneViewOf, readinessBlockersOf } = await import('../ui/surfaces/planBoard.ts')
  const f = fixture('demo')
  f.mapping.questionAnswers = {}
  const r = runFixture(f)
  const readings = laneReadings(r.steps)
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.plainTitle ?? null
  // The device goals wait on D3, and only on D3.
  const device = r.steps.find((s) => s.goalId === 'require-managed-device')!
  assert.equal(device.state.lifecycle, 'not-deployed', 'the premise')
  assert.deepEqual(device.blockers.filter((b) => b.kind === 'decision').map((b) => b.label), [`direction:${DIRECTION_STEP.devices}`])
  const reading = readings.get(device.id)!
  assert.equal(reading.lane, 'On Hold')
  assert.equal(laneViewOf(reading, titleOf).tail, W.waiting)
  const tile = readinessBlockersOf(reading, titleOf).find((b) => b.id === DIRECTION_STEP.devices)!
  assert.equal(tile.label, W.waiting)
  assert.equal(tile.title, 'Decide How People and Devices Sign In', 'the tile names, and links to, the Direction step')
  // geo-restriction waits on both D1 (partner) and D4 (countries, travel).
  const geo = r.steps.find((s) => s.goalId === 'geo-restriction')
  if (geo) assert.deepEqual(geo.blockers.filter((b) => b.kind === 'decision').map((b) => b.label).sort(), [`direction:${DIRECTION_STEP.locations}`, `direction:${DIRECTION_STEP.use}`])
  // A policy that depends on no answer is untouched.
  for (const goal of ['mfa-all-users', 'admins-phishing-resistant', 'block-auth-transfer']) {
    const s = r.steps.find((x) => x.goalId === goal)
    if (!s) continue
    assert.ok(!s.blockers.some((b) => b.kind === 'decision' && b.label.startsWith('direction:')), goal)
    assert.notEqual(readings.get(s.id)?.reason?.kind, 'decision', goal)
  }
  // A policy already enforced is never held by it: its question is asked where it is, as before.
  const code = r.steps.find((s) => s.goalId === 'block-device-code')!
  assert.equal(code.state.lifecycle, 'enforced', 'the premise: the demo already blocks device code')
  assert.notEqual(readings.get(code.id)?.lane, 'On Hold')
  assert.ok((code.unsavedInputs ?? []).length > 0, 'it still asks its question until it is answered')
  // Saving the one answer it depends on releases it; the rest of D1 can stay open.
  const saved = applyStepDecisions(f.mapping, { [DIRECTION_STEP.devices]: { ...directionDecisionOf({ computers: { value: 'managed', picked: [] }, phones: { value: 'apps', picked: [] }, deviceExceptions: { value: 'none', picked: [] } }), at: AT } })
  const after = runFixture({ ...f, mapping: saved }).steps
  const released = after.find((s) => s.goalId === 'require-managed-device')!
  assert.ok(!released.blockers.some((b) => b.kind === 'decision' && b.label.startsWith('direction:')))
  assert.notEqual(laneReadings(after).get(released.id)?.reason?.kind, 'decision')
  assert.equal(after.find((s) => s.id === DIRECTION_STEP.devices)!.status, 'done')
  assert.ok(after.find((s) => s.goalId === 'geo-restriction')?.blockers.some((b) => b.kind === 'decision') ?? true, 'a policy waiting on another step\'s answers still waits')
})

test('Direction polish: evidence is content sentences, the eyebrow is a decision step, and Approve moves to the next open step', async () => {
  const { eyebrowOf } = await import('../ui/surfaces/stepContract.ts')
  const f = fixture('demo')
  const steps = stepsOf(f)
  const use = stepOf(steps, DIRECTION_STEP.use)
  // Words from content, never the engine's reason ("no sign-in activity for ...").
  //
  // The sentence names the SOURCES and not a window. It said "in the last 30
  // days" while appSignInSummary and spActivity, the two sources behind it,
  // carry coveredWindow null on every tenant seen so far — so a reader took a
  // measured month of watching from a summary that states no period at all.
  assert.equal(q(use, 'service:sharepoint').evidence, "SharePoint and OneDrive sign-ins appear in the tenant's app sign-in summary or its service-principal activity.")
  // A service question states no window, because its two sources declare none:
  // appSignInSummary and spActivity carry coveredWindow null on every tenant.
  // The questions backed by signInEvidence keep theirs — that source DOES
  // declare a covered window, so "the last 30 days" is measured there and the
  // distinction is the whole point.
  for (const x of use.directionQuestions!.filter((y) => y.key.startsWith('service:'))) {
    assert.doesNotMatch(x.evidence, /last 30 days/, x.key + ' claims a window its sources do not declare')
  }
  for (const x of use.directionQuestions!) {
    assert.doesNotMatch(x.evidence, /no sign-in activity|sign-in activity observed|licence present/, x.key)
    assert.match(x.evidence, /^[A-Z0-9].*\.$/, `${x.key} is a capitalised sentence: ${x.evidence}`)
  }
  // The eyebrow reads Decision step, not Check step.
  assert.equal(use.guidance?.kind, 'decision')
  assert.equal(eyebrowOf({ state: use.state } as never, use.guidance!.kind), 'Decision step')
  // Approving D1 moves to D2; with D2 and D3 answered too, D4 is next, and from D4 back to the first open one.
  assert.equal(nextDirectionStep(DIRECTION_STEP.use, steps), DIRECTION_STEP.accounts)
  const answered = (id: string): Step => ({ ...stepOf(steps, id), directionQuestions: stepOf(steps, id).directionQuestions!.map((x) => ({ ...x, saved: x.suggested, needsReview: false })) })
  const later = steps.map((s) => s.id === DIRECTION_STEP.accounts || s.id === DIRECTION_STEP.devices ? answered(s.id) : s)
  assert.equal(nextDirectionStep(DIRECTION_STEP.use, later), DIRECTION_STEP.locations)
  assert.equal(nextDirectionStep(DIRECTION_STEP.locations, later), DIRECTION_STEP.use)
  const all = steps.map((s) => answered(s.id))
  assert.equal(nextDirectionStep(DIRECTION_STEP.use, all), null, 'nothing open: the page stays')
  assert.equal(nextDirectionStep('s-goal-admin-mfa', steps), null, 'only a Direction step moves the page')
})

test('a count of one bends "look": "1 account looks like"', async () => {
  const { fillText } = await import('../content/render.ts')
  assert.equal(fillText(W.questions.sharedDevices.seen, { n: 1 }), '1 account looks like shared-device accounts.')
  assert.equal(fillText(W.questions.sharedDevices.seen, { n: 2 }), '2 accounts look like shared-device accounts.')
})

test('the office network has a third answer, and answering it keeps the trusted-network step on the plan', () => {
  // Owner, 2026-09-20: most small tenants have never created a trusted network,
  // so the only answer they could give was "Everyone works remotely" — untrue,
  // and it switched off the step that would have defined the office network in
  // the first place.
  const f = fixture('demo')
  const q = stepsOf(f).flatMap((s) => s.directionQuestions ?? []).find((x) => x.key === 'officeNetwork')!
  assert.deepEqual(q.options.map((o) => o.value), ['office', 'notInEntra', 'remote'])

  const apply = (value: string) => {
    const decision = directionDecisionOf({ officeNetwork: { value, picked: [] } })
    const legacy = legacyDecisionsOf(DIRECTION_STEP.locations, { ...decision, at: AT } as never)
    return Object.fromEntries(legacy)
  }

  // "Not in Entra yet" is the office-network option with nothing picked, which
  // is the shape decisions.ts already reads as "the step stands, and its own
  // question is unanswered". "Everyone works remotely" sets it aside.
  assert.equal(apply('notInEntra')[PREREQ_STEP_ID.trustedLocation].option, 'office-network')
  assert.deepEqual(apply('notInEntra')[PREREQ_STEP_ID.trustedLocation].picked, [])
  assert.equal(apply('remote')[PREREQ_STEP_ID.trustedLocation].option, 'remote')
  assert.equal(apply('office')[PREREQ_STEP_ID.trustedLocation].option, 'office-network')

  // And the answer reads back, which the legacy decision alone cannot do: it
  // cannot tell "not in Entra yet" from "nobody has answered".
  for (const value of ['office', 'notInEntra', 'remote']) {
    const m = applyStepDecisions(f.mapping, apply(value) as never)
    assert.equal(savedAnswerOf('officeNetwork', m)?.value, value, value)
  }

  // A tenant that answers it is not thereby told its office network's ranges:
  // IAMAI reads no sign-in addresses, and says so rather than implying it could.
  const note = q.note ?? ''
  assert.match(note, /Define the Trusted Network/)
  assert.match(note, /does not read sign-in addresses/)
})
