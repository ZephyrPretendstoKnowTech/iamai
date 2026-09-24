// Define Your Rollout Scope (roadmap/direction.ts, directionAnswers.ts):
// the four steps' questions, their suggestions, where their answers are stored,
// completion, and reopening (docs/plans/direction-spec.md).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { directionSteps } from './direction.ts'
import type { DirectionInput } from './direction.ts'
import { DIRECTION_LOCATIONS_STORAGE, DIRECTION_STEP, answersOfDecision, directionDecisionOf, legacyDecisionsOf, savedAnswerOf } from './directionAnswers.ts'
import type { DirectionAnswer } from './directionAnswers.ts'
import { applyStepDecisions } from './decisions.ts'
import type { StepDecision } from './decisions.ts'
import { DEVICE_ANSWER_KEYS, QUESTION_STEP, answerKey, devicePlanOf, deviceCodeWorkflowsOf, mailDevicesOf, questionLabels, serviceProvidersExcluded } from './answers.ts'
import { PREREQ_STEP_ID } from './stepIds.ts'
import { directionWords } from '../content/content.ts'
import type { DirectionQuestion, Step } from './types.ts'
import type { Fixture } from './fixtures/index.ts'
import { isPhoneOs } from '../derive/platforms.ts'
import { phoneSignInIds } from '../derive/sets.ts'
import { fillText } from '../content/render.ts'

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
  assert.deepEqual([q(use, 'mailDevices').suggested.value, q(use, 'deviceCode').suggested.value, q(use, 'partner').suggested.value], ['none', 'unused', 'no'], 'no exception is granted')
  for (const key of ['mailDevices', 'deviceCode', 'partner']) assert.equal(q(use, key).evidence, W.defaultEvidence, key)
  // A tenant with no trusted named location is not thereby all-remote, and the
  // scan reads nothing either way (owner, 2026-09-20): the safe default is the
  // one that keeps Define the Trusted Network on the plan. Asked on D3 since
  // Stage 3.
  assert.equal(q(stepOf(steps, DIRECTION_STEP.devices), 'officeNetwork').suggested.value, 'notInEntra')
  assert.equal(q(stepOf(steps, DIRECTION_STEP.devices), 'officeNetwork').evidence, W.defaultEvidence)
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
  assert.match(q(devices, 'computers').evidence, /Intune: [0-9]+ of [0-9]+ licences in use/)
  assert.match(q(devices, 'computers').today ?? '', /^Today: /)
})

test('(c) Approve saves every answer under the key it is read from, completes the step, and moves to the next open Direction step', () => {
  // (c) Approve answers saves to the keys the answers have always lived under
  {
    const f = fixture('demo')
    f.mapping.workflowAnswers = {}
    f.mapping.facetOverrides = {}
    f.mapping.questionAnswers = {}
    const steps = stepsOf(f)
    const use = stepOf(steps, DIRECTION_STEP.use)
    const devices = stepOf(steps, DIRECTION_STEP.devices)
    const printer = f.snapshot.users[1].id
    const decisions: Record<string, StepDecision> = {
      [DIRECTION_STEP.use]: approve(use, { 'service:sharepoint': { value: 'no', picked: [] }, mailDevices: { value: 'some', picked: [printer] }, deviceCode: { value: 'unused', picked: [] }, partner: { value: 'yes', picked: [] } }),
      [DIRECTION_STEP.devices]: approve(devices, { computers: { value: 'hybrid', picked: [] }, phones: { value: 'blocked', picked: [] }, officeNetwork: { value: 'remote', picked: [] } }),
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
    assert.equal(m.questionAnswers?.[answerKey(DIRECTION_LOCATIONS_STORAGE, 'officeNetwork')], 'remote', 'the office network answer, under the key it is read from')
    // And the steps read those answers back as approved.
    const after = stepsOf({ ...f, mapping: m })
    for (const id of [DIRECTION_STEP.use, DIRECTION_STEP.devices]) assert.equal(stepOf(after, id).status, 'done', id)
    assert.equal(q(stepOf(after, DIRECTION_STEP.use), 'service:sharepoint').saved?.value, 'no')
  }

  // approving 2.3 saves the office network answer under the key it is read from, reads it back, and completes 2.3
  // The writer bug (roadmap-flow proposal, section 7): approving the step that
  // asks the office network saved it under that step's own id, and the answer is
  // read from s-direction-locations only — so "we have one, not in Entra yet" and
  // "everyone is remote" were lost, and the step never completed.
  {
    for (const value of ['notInEntra', 'remote']) {
      const f = fixture('demo')
      f.mapping.questionAnswers = {}
      const devices = stepOf(stepsOf(f), 's-direction-devices')
      const answers = Object.fromEntries([...devices.directionQuestions!.map((x) => [x.key, x.saved ?? x.suggested] as const), ['officeNetwork', { value, picked: [] }] as const])
      const m = applyStepDecisions(f.mapping, { 's-direction-devices': { ...directionDecisionOf(answers), at: AT } })
      assert.equal(m.questionAnswers?.['s-direction-locations:officeNetwork'], value, `${value}: written under the key it is read from`)
      assert.equal(savedAnswerOf('officeNetwork', m)?.value, value, `${value}: read back`)
      const after = stepOf(stepsOf({ ...f, mapping: m }), 's-direction-devices')
      assert.equal(q(after, 'officeNetwork').saved?.value, value, `${value}: the question shows it saved`)
      assert.equal(after.status, 'done', `${value}: 2.3 completes`)
    }
  }

  {
    const steps = stepsOf(fixture('demo'))
    // A service question states no window: its two sources (appSignInSummary and
    // spActivity) declare none, so "the last 30 days" would be a measured month
    // read from a summary that states no period at all.
    for (const x of stepOf(steps, DIRECTION_STEP.use).directionQuestions!.filter((y) => y.key.startsWith('service:'))) {
      assert.doesNotMatch(x.evidence, /last 30 days/, x.key + ' claims a window its sources do not declare')
    }
  }
})

test('(c, d) an answer saved before Direction existed still reads as saved, and a legacy Not sure reads as unanswered', () => {
  // (c) an answer saved before Direction existed still reads as saved
  {
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
    assert.deepEqual(savedAnswerOf('mailDevices', m), { value: 'none', picked: [] })
    assert.deepEqual(savedAnswerOf('partner', m), { value: 'no', picked: [] })
    assert.deepEqual(savedAnswerOf('computers', m), { value: 'managed', picked: [] })
    assert.deepEqual(savedAnswerOf('phones', m), { value: 'enrolled', picked: [] })
    assert.deepEqual(savedAnswerOf('officeNetwork', m), { value: 'remote', picked: [] })
    assert.deepEqual(savedAnswerOf('serviceAccounts', m), { value: 'none', picked: [] })
    // A saved Direction decision round-trips through its own encoding.
    const d = directionDecisionOf({ mailDevices: { value: 'some', picked: ['a', 'b'] } })
    assert.deepEqual(answersOfDecision({ ...d }), { mailDevices: { value: 'some', picked: ['a', 'b'] } })
  }

  // (d) a legacy "Not sure" reads as unanswered: the suggestion shows and the step still needs approval
  {
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
  }
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

test('(g) Direction is three steps, D3 asks the office network and shows even with no device sign-ins, and the retired steps and questions are gone', async () => {
  // (g) the retired steps are gone as rows, and D3 shows even with no device sign-ins
  {
    const f = fixture('demo')
    // No phone in anybody's own records (the one source of who signed in from a
    // phone, derive/sets.ts phoneSignInIds; NEW-Nadia-D4), and no unjoined computer.
    for (const e of Object.values(f.snapshot.signInEvidence)) {
      e.platforms = (e.platforms ?? []).filter((p) => !isPhoneOs(p.os))
      if (e.devices) e.devices = e.devices.filter((d) => !isPhoneOs(d.os))
    }
    if (f.snapshot.scenarioEvidence) delete f.snapshot.scenarioEvidence.unjoinedComputers
    const ids = runFixture(f).steps.map((s) => s.id)
    assert.equal(ids.includes('s-confirm-workloads'), false)
    assert.equal(ids.includes(PREREQ_STEP_ID.devicePlan), false)
    for (const id of Object.values(DIRECTION_STEP)) assert.ok(ids.includes(id), id)
  }

  // Direction shows three steps: 2.3 asks the office network, and the retired questions are gone
  // Stage 3 (roadmap-flow V1 decisions 3 and 4). Direction is three steps: the
  // office network joins the devices step, work countries move to the countries
  // step (6.3), and the three questions nothing read are retired.
  {
    const { isGroupMember, DIRECTION_GROUP } = await import('./stepGroups.ts')
    const { curatedFixture } = await import('./fixtures/index.ts')
    const { withFoundationSettled } = await import('./fixtures/run.ts')
    const steps = stepsOf(fixture('demo'))
    assert.deepEqual(steps.map((s) => s.id), ['s-direction-use', 's-direction-accounts', 's-direction-devices'])
    const keys = steps.flatMap((s) => (s.directionQuestions ?? []).map((x) => x.key))
    for (const retired of ['externalMethods', 'deviceExceptions', 'travel', 'workCountries']) assert.ok(!keys.includes(retired as never), `${retired} is still asked`)
    const devices = stepOf(steps, 's-direction-devices')
    assert.deepEqual(devices.directionQuestions!.map((x) => x.key), ['computers', 'phones', 'officeNetwork'])
    // The plan draws the same three, on the tenant closest to the owner's.
    const plan = runFixture(withFoundationSettled(curatedFixture('getiamai'))).steps
    assert.deepEqual(plan.filter((s) => isGroupMember(s.id, DIRECTION_GROUP)).map((s) => s.id), ['s-direction-use', 's-direction-accounts', 's-direction-devices'])
    assert.ok(!plan.some((s) => s.id === 's-direction-locations'), 'the storage id is not a drawn step')
  }
})

test('(e) a policy with an unanswered Direction dependency is held Waiting on your answers; one with none is not', async () => {
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
  // The row names what it waits on, the person's answers (owner, roadmap flow V2 decision A: the section is Define Your Rollout Scope).
  assert.equal(laneViewOf(reading, titleOf).tail, W.waiting)
  const tile = readinessBlockersOf(reading, titleOf).find((b) => b.id === DIRECTION_STEP.devices)!
  assert.equal(tile.label, W.waiting)
  assert.equal(tile.title, titleOf(DIRECTION_STEP.devices), 'the tile names, and links to, the Direction step')
  // geo-restriction waits on D1 (partner) alone: its countries are its own
  // step's picker, and travel was retired (Stage 3).
  const geo = r.steps.find((s) => s.goalId === 'geo-restriction')
  if (geo) assert.deepEqual(geo.blockers.filter((b) => b.kind === 'decision' && b.label.startsWith('direction:')).map((b) => b.label).sort(), [`direction:${DIRECTION_STEP.use}`])
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
  const saved = applyStepDecisions(f.mapping, { [DIRECTION_STEP.devices]: { ...directionDecisionOf({ computers: { value: 'managed', picked: [] }, phones: { value: 'apps', picked: [] }, officeNetwork: { value: 'notInEntra', picked: [] } }), at: AT } })
  const after = runFixture({ ...f, mapping: saved }).steps
  const released = after.find((s) => s.goalId === 'require-managed-device')!
  assert.ok(!released.blockers.some((b) => b.kind === 'decision' && b.label.startsWith('direction:')))
  assert.notEqual(laneReadings(after).get(released.id)?.reason?.kind, 'decision')
  assert.equal(after.find((s) => s.id === DIRECTION_STEP.devices)!.status, 'done')
  assert.ok(after.find((s) => s.goalId === 'geo-restriction')?.blockers.some((b) => b.kind === 'decision') ?? true, 'a policy waiting on another step\'s answers still waits')
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
    const legacy = legacyDecisionsOf(DIRECTION_STEP.devices, { ...decision, at: AT } as never)
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

  // What answering it leaves to do: the step that defines the office network.
  const note = q.note ?? ''
  assert.match(note, /Define the Trusted Network/)
})

// ---------------------------------------------------------------------------
// NEW-Nadia-D4: "Today: no phone sign-ins were seen." beside an iPhone.
// The phones question counted a tally over the bulk sign-in rows
// (scenarioEvidence.phoneSignIns) while MFA Readiness drew each person's phone
// from their own record. A person read on their own after a partial bulk read
// reached the record and never the tally, and every shipped fixture built the
// tally from rows of its own: getiamai, small, mid, messy and midflight said no
// phone was seen beside MFA Readiness's phones, and the public demo said 3
// beside 7. One source now (derive/sets.ts phoneSignInIds).
// ---------------------------------------------------------------------------

const phonesToday = (f: Fixture): string | null => q(stepOf(directionSteps({ snapshot: f.snapshot, mapping: f.mapping, notAssessed: [], availableGoalIds: [] }), DIRECTION_STEP.devices), 'phones').today

test('NEW-Nadia-D4: the phones question counts exactly the people MFA Readiness shows a phone for, a person read on their own included', async () => {
  // NEW-Nadia-D4: on every shipped fixture the phones question counts exactly the people MFA Readiness shows a phone for
  {
    const { readinessView } = await import('../derive/mfaReadiness.ts')
    const { deviceChips } = await import('../ui/surfaces/readinessCells.ts')
    for (const name of ['getiamai', 'demo', 'micro'] as const) {
      const f = fixture(name)
      const shown = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows.filter((r) => deviceChips(r).chips.some((c) => c.kind === 'phone')).map((r) => r.user.id).sort()
      const counted = phoneSignInIds(f.snapshot)
      const today = phonesToday(f)
      if (counted === null) {
        // Records not read: nobody was seen, which says nothing about phones.
        assert.equal(today, null, `${name}: a line about phones over records nobody read`)
        assert.deepEqual(shown, [], `${name}: MFA Readiness shows a phone over records nobody read`)
        continue
      }
      assert.deepEqual(counted, shown, `${name}: the question and MFA Readiness disagree about who signed in from a phone`)
      assert.equal(today, shown.length > 0 ? fillText(W.questions.phones.today, { n: shown.length }) : W.questions.phones.todayNone, name)
    }
  }
})
