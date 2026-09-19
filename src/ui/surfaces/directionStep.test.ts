// Decide Your Tenant's Direction on the Plan (DirectionQuestions.tsx, ContentStep.tsx,
// stepBody.ts): the decision anatomy, one Approve answers button, and the
// "Answered in" line where a question used to be asked.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { answeredInOf, ANSWERED_IN } from '../../roadmap/direction.ts'
import { DIRECTION_STEP, directionDecisionOf } from '../../roadmap/directionAnswers.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import { directionWords } from '../../content/content.ts'
import { headingsOf, stepBodyOf } from './stepBody.ts'
import type { StepVarContext } from './stepVars.ts'

const W = directionWords
const CONTENT_STEP = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
const QUESTIONS = readFileSync('src/ui/surfaces/DirectionQuestions.tsx', 'utf8')

function setup() {
  const f = fixture('demo')
  const r = runFixture(f)
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: null } as StepVarContext
  return { f, r, ctx }
}

test('a Direction step draws About this Step, Questions and Completion Criteria, and no Implementation', () => {
  const { r, ctx } = setup()
  for (const id of Object.values(DIRECTION_STEP)) {
    const step = r.steps.find((s) => s.id === id)!
    const body = stepBodyOf(step, ctx)
    assert.equal(body.showImplementation, false, id)
    assert.deepEqual(headingsOf(body), ['About this Step', 'Questions', 'Completion Criteria'], id)
    assert.deepEqual(body.contract.doneWhen, [W.done], id)
    assert.ok((step.directionQuestions ?? []).length > 0, id)
  }
  // The body swaps Readiness for the Questions, and draws the three headings from the registry's anatomy.
  assert.match(CONTENT_STEP, /\{decisionHead \? <DirectionQuestions /)
  assert.match(CONTENT_STEP, /taskHead\?\.why \?\? decisionHead\?\.why \?\? HEAD\.why/)
  assert.match(CONTENT_STEP, /taskHead\?\.doneWhen \?\? decisionHead\?\.doneWhen \?\? HEAD\.doneWhen/)
})

test('one Approve answers button saves every answer in the step; the Not sure line stands over the tiles', () => {
  assert.equal(QUESTIONS.match(/\{W\.approve\}/g)?.length, 1, 'one Approve answers button per step')
  assert.match(QUESTIONS, /onDecide\?\.\(directionDecisionOf\(answers, basis\)\)/, 'the button saves every answer at once')
  assert.match(QUESTIONS, /<p className="reason">\{W\.notSure\}<\/p>/)
  assert.doesNotMatch(QUESTIONS, /[Nn]ot sure['"]/, 'no Not sure option')
  assert.equal(W.approve, 'Approve answers')
})

test('a step whose question moved says where it is answered now, with the answer and a link', () => {
  const { f, ctx } = setup()
  assert.deepEqual(Object.keys(ANSWERED_IN).sort(), [PREREQ_STEP_ID.allowedCountries, PREREQ_STEP_ID.serviceAccountsGroup, PREREQ_STEP_ID.trustedLocation, 's-goal-block-device-code', 's-goal-block-legacy-auth', 's-goal-guests-mfa', 's-shared-devices'].sort())
  f.mapping.questionAnswers = {}
  const open = answeredInOf('s-goal-block-device-code', { ...ctx, mapping: f.mapping })!
  assert.equal(open.step, DIRECTION_STEP.use)
  assert.equal(open.title, 'Confirm What You Use')
  assert.match(open.lines[0].value, /^Not answered yet: the suggestion is /)
  const saved = applyStepDecisions(f.mapping, { [DIRECTION_STEP.use]: { ...directionDecisionOf({ deviceCode: { value: 'used', picked: [] } }), at: f.snapshot.asOf } })
  const answered = answeredInOf('s-goal-block-device-code', { ...ctx, mapping: saved })!
  assert.deepEqual(answered.lines.map((l) => [l.label, l.value, l.saved]), [[W.questions.deviceCode.label, 'In use', true]])
  const countries = answeredInOf(PREREQ_STEP_ID.allowedCountries, ctx)!
  assert.equal(countries.step, DIRECTION_STEP.locations)
  assert.deepEqual(countries.lines.map((l) => l.key), ['workCountries', 'travel'])
  assert.equal(answeredInOf('s-goal-mfa-all-users', ctx), null)
  // The step draws it in place of its old picker.
  assert.match(CONTENT_STEP, /\{ANSWERED_IN\[step\.id\] \? <AnsweredInDirection stepId=\{step\.id\} ctx=\{ctx\} \/> :/)
  assert.match(QUESTIONS, /fillText\(W\.answeredIn, \{ step: answered\.title \}\)/)
  assert.match(QUESTIONS, /href=\{returnToStep\(answered\.step\)\}/)
})
