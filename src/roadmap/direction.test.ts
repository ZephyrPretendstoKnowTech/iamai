// Define Your Rollout Scope (roadmap/direction.ts, directionAnswers.ts):
// the four steps' questions, their suggestions, where their answers are stored,
// completion, and reopening (docs/plans/direction-spec.md).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { directionSteps } from './direction.ts'
import type { DirectionInput } from './direction.ts'
import { DIRECTION_LOCATIONS_STORAGE, DIRECTION_STEP, answersOfDecision, directionDecisionOf, directionDecisionWith, legacyDecisionsOf, savedAnswerOf, trustedIpLocations } from './directionAnswers.ts'
import type { DirectionAnswer } from './directionAnswers.ts'
import { applyStepDecisions } from './decisions.ts'
import type { StepDecision } from './decisions.ts'
import { DEVICE_ANSWER_KEYS, QUESTION_STEP, answerKey, devicePlanOf, mailDevicesOf, questionLabels, serviceProvidersExcluded } from './answers.ts'
import { PREREQ_STEP_ID } from './stepIds.ts'
import { directionWords } from '../content/content.ts'
import type { DirectionQuestion, Step } from './types.ts'
import type { Fixture } from './fixtures/index.ts'
import { isPhoneOs } from '../derive/platforms.ts'

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

test('(b) with no signal every suggestion is the safe default, and no evidence line claims what the scan did not see', () => {
  const steps = stepsOf(noSignal())
  const use = stepOf(steps, DIRECTION_STEP.use)
  for (const x of use.directionQuestions!.filter((x) => x.key.startsWith('service:'))) {
    assert.equal(x.suggested.value, 'yes', `${x.key}: a service keeps its policy`)
    assert.equal(x.evidence, '', x.key)
  }
  assert.deepEqual([q(use, 'mailDevices').suggested.value, q(use, 'partner').suggested.value], ['none', 'no'], 'no exception is granted')
  for (const key of ['mailDevices', 'partner']) assert.equal(q(use, key).evidence, '', key)
  // A tenant with no trusted named location is not thereby all-remote, and the
  // scan reads nothing either way (owner, 2026-09-20): the safe default is the
  // one that keeps Define the Trusted Network on the plan. Asked on D3 since
  // Stage 3.
  assert.equal(q(stepOf(steps, DIRECTION_STEP.devices), 'officeNetwork').suggested.value, 'office')
  assert.equal(q(stepOf(steps, DIRECTION_STEP.devices), 'officeNetwork').evidence, '')
})

test('(b) a what-you-use question takes today\'s state; a how-it-should-work question takes the baseline\'s, today beside it', () => {
  const f = fixture('demo')
  const steps = stepsOf(f)
  const use = stepOf(steps, DIRECTION_STEP.use)
  // The demo's sign-in records show one person in Azure management.
  const azure = q(use, 'service:azureManagement')
  assert.equal(azure.suggested.value, 'yes', 'seen in use')
  assert.notEqual(azure.evidence, '', 'the evidence it was seen by')
  assert.equal(azure.basis, 'present')
  // The scan read the sign-ins and saw none: today's state is No, and it says so.
  const quiet = fixture('demo')
  quiet.snapshot.appSignInSummary = []
  quiet.snapshot.spActivity = []
  const avd = q(stepOf(stepsOf(quiet), DIRECTION_STEP.use), 'service:avd')
  if (avd) {
    assert.equal(avd.suggested.value, 'no')
    assert.equal(avd.basis, 'absent')
  }
  // D3: the baseline's recommendation, with today beside it.
  const devices = stepOf(steps, DIRECTION_STEP.devices)
  assert.equal(q(devices, 'computers').suggested.value, 'managed')
  assert.equal(q(devices, 'phones').suggested.value, 'apps')
  // 2.3 asks how people should sign in, not what the tenant has today: no count
  // lines, and one line for the answer on screen (owner, 2026-09-24).
  for (const key of ['computers', 'phones', 'officeNetwork']) assert.equal(q(devices, key).evidence, '', key)
  assert.match(q(devices, 'computers').chosen?.managed ?? '', /^Outside the office, sign-ins need a managed computer\.$/)
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
      [DIRECTION_STEP.use]: approve(use, { 'service:sharepoint': { value: 'no', picked: [] }, mailDevices: { value: 'some', picked: [printer] }, partner: { value: 'yes', picked: [] } }),
      [DIRECTION_STEP.devices]: approve(devices, { computers: { value: 'hybrid', picked: [] }, phones: { value: 'blocked', picked: [] }, officeNetwork: { value: 'remote', picked: [] } }),
    }
    const m = applyStepDecisions(f.mapping, decisions)
    assert.equal(m.workflowAnswers?.sharepoint, 'no')
    assert.deepEqual(m.facetOverrides.sharepoint?.on, false)
    assert.ok(m.workflowConfirmedAt)
    assert.deepEqual(mailDevicesOf(m), [printer])
    assert.ok(m.serviceAccountUserIds.includes(printer), 'the mail-sending device joins the service accounts, as before')
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
    for (const value of ['office', 'remote']) {
      const f = fixture('demo')
      f.mapping.questionAnswers = {}
      const devices = stepOf(stepsOf(f), 's-direction-devices')
      const answers = Object.fromEntries([...devices.directionQuestions!.map((x) => [x.key, x.saved ?? x.suggested] as const), ['officeNetwork', { value, picked: [] }] as const])
      // With the trusted locations it was approved against, as Approve saves it.
      const basis = Object.fromEntries(devices.directionQuestions!.filter((x) => x.basis !== null).map((x) => [x.key, x.basis!]))
      const m = applyStepDecisions(f.mapping, { 's-direction-devices': { ...directionDecisionOf(answers, basis), at: AT } })
      assert.equal(m.questionAnswers?.['s-direction-locations:officeNetwork'], value, `${value}: written under the key it is read from`)
      assert.equal(savedAnswerOf('officeNetwork', m)?.value, value, `${value}: read back`)
      const after = stepOf(stepsOf({ ...f, mapping: m }), 's-direction-devices')
      assert.equal(q(after, 'officeNetwork').saved?.value, value, `${value}: the question shows it saved`)
      assert.equal(after.status, 'done', `${value}: 2.3 completes`)
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
  // A policy already enforced is not held by an answer it is written from, and
  // asks nothing on the step itself (walk list 4.x item 6).
  const code = r.steps.find((s) => s.goalId === 'block-device-code')!
  assert.equal(code.state.lifecycle, 'enforced', 'the premise: the demo already blocks device code')
  assert.ok(!code.blockers.some((b) => b.kind === 'decision' && b.label.startsWith('direction:')), 'an enforced policy waits on an answer it does not need')
  assert.equal(code.unsavedInputs, undefined, 'Block Device Code Sign-in asks a question of its own')
  // Saving the one answer it depends on releases it; the rest of D1 can stay open.
  const saved = applyStepDecisions(f.mapping, { [DIRECTION_STEP.devices]: { ...directionDecisionOf({ computers: { value: 'managed', picked: [] }, phones: { value: 'apps', picked: [] }, officeNetwork: { value: 'notInEntra', picked: [] } }, { officeNetwork: (trustedIpLocations(f.snapshot) ?? []).map((l) => l.id).sort().join(',') }), at: AT } })
  const after = runFixture({ ...f, mapping: saved }).steps
  const released = after.find((s) => s.goalId === 'require-managed-device')!
  assert.ok(!released.blockers.some((b) => b.kind === 'decision' && b.label.startsWith('direction:')))
  assert.notEqual(laneReadings(after).get(released.id)?.reason?.kind, 'decision')
  assert.equal(after.find((s) => s.id === DIRECTION_STEP.devices)!.status, 'done')
  assert.ok(after.find((s) => s.goalId === 'geo-restriction')?.blockers.some((b) => b.kind === 'decision') ?? true, 'a policy waiting on another step\'s answers still waits')
})

test('Define the Trusted Network answers the office network through 2.3\'s own decision: remote sets it aside, a picked trusted location completes it', () => {
  // One stored answer, two doors (owner, 2026-09-24): 3.6's rail saves 2.3's
  // decision with the office network changed, and 2.3's other answers stand.
  const f = fixture('demo')
  const devices = stepOf(stepsOf(f), DIRECTION_STEP.devices)
  const saveFrom36 = (a: DirectionAnswer) => applyStepDecisions(f.mapping, { [DIRECTION_STEP.devices]: { ...directionDecisionWith(devices, 'officeNetwork', a), at: AT } })
  const network = (mapping: typeof f.mapping) => runFixture({ ...f, mapping }, { mapping }).steps.find((s) => s.id === PREREQ_STEP_ID.trustedLocation)!

  const remote = saveFrom36({ value: 'remote', picked: [] })
  assert.equal(savedAnswerOf('officeNetwork', remote)?.value, 'remote')
  for (const key of ['computers', 'phones']) assert.deepEqual(savedAnswerOf(key as never, remote), savedAnswerOf(key as never, f.mapping), `${key} stands`)
  assert.equal(network(remote).doesntApply, directionWords.doesntApplyAnswered.replace('{option}', directionWords.questions.officeNetwork.options.remote).replace('{question}', directionWords.questions.officeNetwork.label).replace('{step}', directionWords.steps.devices.title))

  const trusted = trustedIpLocations(f.snapshot) ?? []
  assert.ok(trusted.length > 0, 'the premise: the demo trusts a location in Entra')
  const office = saveFrom36({ value: 'office', picked: [trusted[0].id] })
  assert.equal(savedAnswerOf('officeNetwork', office)?.value, 'office')
  assert.equal(network(office).state.satisfied, true, 'the picked trusted location is the office')
})

test('every Direction card says what its chosen answer does in one line, and no line opens on the answer it follows', () => {
  // The questions read alike on 2.1, 2.2 and 2.3 (owner, 2026-09-24): the line
  // follows the answer on screen, so it never repeats "Answering X".
  const qs = runFixture(fixture('demo')).steps.flatMap((s) => s.directionQuestions ?? [])
  const card = (key: string): DirectionQuestion => qs.find((x) => x.key === key)!
  assert.match(card('mailDevices').chosen?.some ?? '', /^The accounts you pick become service accounts/)
  assert.match(card('partner').chosen?.yes ?? '', /^Keeps partner and MSP technicians out of/)
  assert.match(card('serviceAccounts').chosen?.none ?? '', /^Takes Restrict Service Accounts to the Trusted Network off your plan/)
  assert.ok(qs.some((x) => x.key.startsWith('service:') && /^Takes .+ off your plan[.]$/.test(x.chosen?.no ?? '')), 'a service card says what No takes off')
  for (const x of qs) for (const line of [...Object.values(x.chosen ?? {}), x.note ?? '']) assert.doesNotMatch(line, /^Answering /, x.key)
})

test('the office network asks one thing, an office or everyone remote; an old Not in Entra yet reads as the office', () => {
  // Owner, 2026-09-24: whether the office is in Entra is the scan's to read and
  // Define the Trusted Network's to do. The question asks only the decision.
  const f = fixture('demo')
  const q = stepsOf(f).flatMap((s) => s.directionQuestions ?? []).find((x) => x.key === 'officeNetwork')!
  assert.deepEqual(q.options.map((o) => o.value), ['office', 'remote'])
  assert.equal(q.control, 'choice', 'no location picker on 2.3: Define the Trusted Network picks the office')

  const apply = (value: string) => {
    const decision = directionDecisionOf({ officeNetwork: { value, picked: [] } })
    const legacy = legacyDecisionsOf(DIRECTION_STEP.devices, { ...decision, at: AT } as never)
    return Object.fromEntries(legacy)
  }
  // The office with nothing picked is the office not in Entra yet: the step stands.
  assert.equal(apply('office')[PREREQ_STEP_ID.trustedLocation].option, 'office-network')
  assert.deepEqual(apply('office')[PREREQ_STEP_ID.trustedLocation].picked, [])
  assert.equal(apply('remote')[PREREQ_STEP_ID.trustedLocation].option, 'remote')
  for (const value of ['office', 'remote']) assert.equal(savedAnswerOf('officeNetwork', applyStepDecisions(f.mapping, apply(value) as never))?.value, value, value)
  // A plan saved with "Not in Entra yet" reads as the office, wherever it was stored.
  assert.equal(savedAnswerOf('officeNetwork', applyStepDecisions(f.mapping, apply('notInEntra') as never))?.value, 'office')
  assert.equal(savedAnswerOf('officeNetwork', { ...f.mapping, questionAnswers: { ...f.mapping.questionAnswers, [`${DIRECTION_LOCATIONS_STORAGE}:officeNetwork`]: 'notInEntra' } })?.value, 'office')

  // What each answer does, one line each.
  assert.match(q.chosen?.office ?? '', /Define the Trusted Network sets that up in Entra\.$/)
  assert.match(q.chosen?.remote ?? '', /Define the Trusted Network leaves your plan\.$/)
})

