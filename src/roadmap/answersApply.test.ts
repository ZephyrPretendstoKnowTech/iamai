// Answers apply (E1), on the demo's week two, which carries its technician's
// stored answers (fixtures/index.ts decisions): the travellers answer adds New
// Zealand to the allowed list; the partner answer excludes the Service provider
// type from the guests and countries policies, in the JSON and on the portal
// lines, beside the baseline's version; the mail-sending devices answer puts the
// reception printer in the service-accounts group. The carve-out code reads
// questionAnswers[stepId:label]; each question's effect line is true once it
// shows; and a record round-trips the answers, so a reload keeps them.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import type { FixtureRun } from './fixtures/run.ts'
import type { MappingState } from '../mapping/types.ts'
import { applyStepDecisions } from './decisions.ts'
import type { StepDecision } from './decisions.ts'
import { CARVE_OUT_STEP_ID, QUESTION_STEP, answerKey, answerOf, effectLine, mailDevicesOf, questionLabels, serviceProvidersExcluded, travelCountriesOf } from './answers.ts'
import { PREREQ_STEP_ID } from './stepIds.ts'
import { decisionsOf } from './progress.ts'
import { defaultDecisions } from '../ui/surfaces/pickerRows.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { portalNamesFor, stepPortalLines } from '../ui/surfaces/stepPortal.ts'
import { contentStepFor } from '../content/stepTitle.ts'

/** The mapping as the plan derives it: the detected defaults, then the saved decisions. */
function applied(f: Fixture, decisions: Record<string, StepDecision> | null): MappingState {
  const nameOf = (id: string): string => f.snapshot.users.find((u) => u.id === id)?.displayName ?? id
  const defaults = applyStepDecisions(f.mapping, defaultDecisions({ snapshot: f.snapshot, mapping: f.mapping, nameOf, groups: f.groups, operatorId: f.operatorId, now: f.snapshot.asOf }), 'detected')
  return applyStepDecisions(defaults, decisions)
}

function ctxFor(f: Fixture, r: FixtureRun, mapping: MappingState): StepVarContext {
  return { snapshot: f.snapshot, mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: null, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
}

test('the stored answers change the plan: countries added, service providers excluded, the printer a service account', () => {
  const f = fixture('demo-week2')
  assert.ok(f.decisions, 'week two carries the stored answers')
  const before = applied(f, null)
  const m = applied(f, f.decisions)

  // The travellers answer: New Zealand joins the allowed list.
  assert.ok(!before.allowedCountries.includes('NZ'), 'unanswered: New Zealand is not on the list')
  assert.deepEqual(travelCountriesOf(m), ['NZ'])
  assert.ok(m.allowedCountries.includes('NZ'), 'answered: New Zealand is on the allowed list')
  assert.ok(m.allowedCountries.includes('AU'), 'the picker\'s own countries stay')

  // The partner answer: the Service provider type is excluded.
  assert.equal(serviceProvidersExcluded(before), false)
  assert.equal(serviceProvidersExcluded(m), true)

  // The mail-sending devices answer: the printer is a service account.
  const printer = f.snapshot.users.find((u) => u.displayName === 'MFP Reception')
  assert.ok(printer, 'the demo has the reception printer')
  assert.ok(!before.serviceAccountUserIds.includes(printer.id))
  assert.deepEqual(mailDevicesOf(m), [printer.id])
  assert.ok(m.serviceAccountUserIds.includes(printer.id), 'answered: the printer is in the service accounts')

  // The store: questionAnswers[stepId:label], never the old free-text keys.
  const mailLabels = questionLabels(QUESTION_STEP.mailDevices)
  assert.ok(mailLabels.decision, 'the legacy block\'s decision has a label')
  assert.ok(m.questionAnswers?.[answerKey(QUESTION_STEP.mailDevices, mailLabels.decision)], 'the option persists under stepId:label')
  assert.equal(m.questionAnswers?.[QUESTION_STEP.mailDevices], undefined, 'the bare step id is not a key')
  assert.equal(m.questionAnswers?.mailDevices, undefined)
  assert.equal(m.questionAnswers?.travel, undefined)
  assert.equal(m.questionAnswers?.partner, undefined)

  // The plan: the carve-out steps appear only once answered.
  const r0 = runFixture({ ...f, mapping: before }, { mapping: before })
  const r = runFixture({ ...f, mapping: m }, { mapping: m })
  for (const id of Object.values(CARVE_OUT_STEP_ID)) {
    assert.ok(!r0.steps.some((s) => s.id === id), `${id}: not on the plan before the answer`)
    const step = r.steps.find((s) => s.id === id)
    assert.ok(step, `${id}: on the plan once answered`)
    assert.ok(contentStepFor(step), `${id}: has content`)
  }

  // The service-accounts step names the printer.
  const sa = r.steps.find((s) => s.id === PREREQ_STEP_ID.serviceAccountsGroup)
  assert.ok(sa, 'the service-accounts step is on the plan (no group holds them yet)')
  const saVars = stepVars(sa, ctxFor(f, r, m))
  assert.ok((saVars.accountsWithSignals as string[]).some((row) => row.startsWith('MFP Reception')), 'the printer is a row of the service-accounts picker')

  // The countries step lists New Zealand.
  const countries = r.steps.find((s) => s.id === PREREQ_STEP_ID.allowedCountries)
  assert.ok(countries)
  const cVars = stepVars(countries, ctxFor(f, r, m))
  assert.ok((cVars.countriesWithCounts as string[]).some((row) => row.startsWith('New Zealand')), 'New Zealand is a row of the countries picker')
})

test('the service-provider exclusion is on both policies, in the JSON and on the portal lines beside the baseline\'s version', () => {
  const f = fixture('demo-week2')
  const before = applied(f, null)
  const m = applied(f, f.decisions ?? null)
  const r0 = runFixture({ ...f, mapping: before }, { mapping: before })
  const r = runFixture({ ...f, mapping: m }, { mapping: m })
  for (const goalId of ['guests-mfa', 'geo-restriction']) {
    const step = r.steps.find((s) => s.goalId === goalId)
    const step0 = r0.steps.find((s) => s.goalId === goalId)
    assert.ok(step && step0, `${goalId}: on the plan`)
    if (step.action.json) {
      const body = JSON.parse(step.action.json) as { conditions: { users: { includeGuestsOrExternalUsers?: { guestOrExternalUserTypes?: string }; excludeGuestsOrExternalUsers?: { guestOrExternalUserTypes?: string } } } }
      assert.equal(body.conditions.users.excludeGuestsOrExternalUsers?.guestOrExternalUserTypes, 'serviceProvider', `${goalId}: the JSON excludes service providers`)
      assert.doesNotMatch(body.conditions.users.includeGuestsOrExternalUsers?.guestOrExternalUserTypes ?? '', /serviceProvider/, `${goalId}: the JSON no longer includes them`)
    }
    if (step0.action.json) {
      const body0 = JSON.parse(step0.action.json) as { conditions: { users: { excludeGuestsOrExternalUsers?: unknown } } }
      assert.equal(body0.conditions.users.excludeGuestsOrExternalUsers, undefined, `${goalId}: unanswered, the baseline's users stand`)
    }
    const lines = stepPortalLines(goalId, portalNamesFor(ctxFor(f, r, m), stepVars(step, ctxFor(f, r, m)), goalId)) ?? []
    const lines0 = stepPortalLines(goalId, portalNamesFor(ctxFor(f, r0, before), stepVars(step0, ctxFor(f, r0, before)), goalId)) ?? []
    assert.ok(lines.some((l) => /Service provider users/.test(l) && /the baseline's version/.test(l)), `${goalId}: the exclusion shows beside the baseline's version: ${lines.join(' | ')}`)
    assert.ok(!lines0.some((l) => /the baseline's version/.test(l)), `${goalId}: unanswered, nothing deviates from the baseline`)
  }
})

test('each question\'s effect line is true when it shows, and never before', () => {
  const f = fixture('demo-week2')
  const before = applied(f, null)
  const m = applied(f, f.decisions ?? null)
  const countries = contentStepFor({ id: QUESTION_STEP.travel, goalId: '' }) as unknown as { decision: { question: { effect: unknown } } }
  assert.match(String(effectLine(countries.decision.question.effect, answerOf(m, QUESTION_STEP.travel, 'question'))), /on the allowed list now/)
  assert.equal(effectLine(countries.decision.question.effect, answerOf(before, QUESTION_STEP.travel, 'question')), null)
  const guests = contentStepFor({ id: QUESTION_STEP.partner, goalId: 'guests-mfa' }) as unknown as { decision: { question: { effect: unknown } } }
  assert.match(String(effectLine(guests.decision.question.effect, answerOf(m, QUESTION_STEP.partner, 'question'))), /Service provider type/)
  assert.equal(effectLine(guests.decision.question.effect, answerOf(before, QUESTION_STEP.partner, 'question')), null)
  const legacy = contentStepFor({ id: QUESTION_STEP.mailDevices, goalId: 'block-legacy-auth' }) as unknown as { decision: { effect: unknown } }
  assert.match(String(effectLine(legacy.decision.effect, answerOf(m, QUESTION_STEP.mailDevices, 'decision'))), /in the service-accounts group now/)
  assert.equal(effectLine(legacy.decision.effect, answerOf(before, QUESTION_STEP.mailDevices, 'decision')), null)
  // The first option changes nothing, so it has no effect line.
  const nobody = applyStepDecisions(before, { [QUESTION_STEP.travel]: { picked: ['AU'], answers: { [questionLabels(QUESTION_STEP.travel).question!]: 'Nobody' }, at: f.snapshot.asOf } })
  assert.equal(effectLine(countries.decision.question.effect, answerOf(nobody, QUESTION_STEP.travel, 'question')), null)
  assert.deepEqual(travelCountriesOf(nobody), [])
})

test('a plan record round-trips the answers, so a reload keeps them', () => {
  const f = fixture('demo-week2')
  const rec = decisionsOf({ stepDecisions: f.decisions }, 'plan-x')
  const saved = rec.stepDecisions?.[PREREQ_STEP_ID.allowedCountries]
  assert.deepEqual(saved?.answers, f.decisions?.[PREREQ_STEP_ID.allowedCountries].answers)
  assert.equal(rec.stepDecisions?.[QUESTION_STEP.mailDevices]?.option, f.decisions?.[QUESTION_STEP.mailDevices].option)
})
