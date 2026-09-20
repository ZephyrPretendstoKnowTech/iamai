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

// The owner unfroze the Direction steps' UI (2026-09-20) and asked for one
// family: a question reads as an Establish Emergency Access subject card, drawn
// with the components that step already has rather than a second visual
// language. Both files are read, so a question card that stopped being the
// Emergency Access card — from either end — fails here.
test('a question is drawn as an Emergency Access subject card, in that card’s grid', () => {
  const CONTENT_STEP_CARD = CONTENT_STEP.slice(CONTENT_STEP.indexOf('function EmergencyAccountStatusTile'), CONTENT_STEP.indexOf('export function EmergencySubjectReadiness'))
  for (const cls of ['emergency-account-status', 'emergency-account-label']) {
    assert.ok(CONTENT_STEP_CARD.includes(cls), `Emergency Access no longer draws .${cls}`)
    assert.ok(QUESTIONS.includes(cls), `a question no longer draws .${cls}`)
  }
  assert.match(QUESTIONS, /<div className="emergency-account-status-grid">/, 'the questions are not in the subject grid')
  assert.match(QUESTIONS, /<article className="emergency-account-status direction-question"/, 'a question is not the subject card')
  // The state, the question, the control and the evidence each own a row.
  assert.match(QUESTIONS, /className="emergency-account-label direction-question-state"[^]*?<h5 id=\{labelId\}>\{q\.label\}<\/h5>/, 'the state and the question are not the card’s first two lines')
  // Nothing bespoke: no layout of its own, and the controls stay the shared ones.
  assert.doesNotMatch(QUESTIONS, /workflow-choice/, 'the questions carry a layout of their own again')
  assert.match(QUESTIONS, /className="decision-select"/, 'the answer is no longer the shared dropdown')
  assert.match(QUESTIONS, /<Picker labelledBy=\{labelId\}/, 'the list answer is no longer the shared Picker')
  // The lead line and the one button stand outside the grid, not as cells in it.
  const grid = QUESTIONS.slice(QUESTIONS.indexOf('<div className="emergency-account-status-grid">'), QUESTIONS.indexOf('</div>', QUESTIONS.indexOf('<div className="emergency-account-status-grid">')))
  for (const outside of ['W.notSure', 'W.approve']) assert.equal(grid.includes(outside), false, `${outside} is a cell of the question grid`)
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

test('the Trusted Network step does not ask what Decide Where People Sign In From asks', () => {
  // The owner's own example (docs/plans/step-redundancy-analysis.md finding 2).
  // This step is the doing of D4's office-network answer and says so through the
  // "Answered in" panel; it used to draw a tile beside that panel reading
  // "Trusted Network: Choose your office networks", with the detail "Select your
  // office networks or confirm that everyone is remote" — D4's question again,
  // on a second row of the board.
  const f = fixture('demo')
  const unanswered = { ...f.mapping, wizardAnswered: { ...f.mapping.wizardAnswered, trustedLocations: false } }
  const open = runFixture({ ...f, mapping: unanswered }, { mapping: unanswered }).steps.find((s) => s.id === PREREQ_STEP_ID.trustedLocation)!
  assert.deepEqual(open.configurationFindings ?? [], [], 'the step asks the question again')
  // It still says where the answer lives, and what it is so far.
  const panel = answeredInOf(PREREQ_STEP_ID.trustedLocation, { snapshot: f.snapshot, mapping: unanswered, nameOf: (id: string) => id })!
  assert.equal(panel.title, 'Decide Where People Sign In From')
  assert.deepEqual(panel.lines.map((l) => l.key), ['officeNetwork'])

  // Answered, the tile is about the tenant's objects rather than the question,
  // so it comes back: nothing was hidden, only the second asking removed.
  const saved = { ...f.mapping, wizardAnswered: { ...f.mapping.wizardAnswered, trustedLocations: true }, assumed: { ...(f.mapping.assumed ?? {}), trustedLocations: 'confirmed' as const } }
  const answered = runFixture({ ...f, mapping: saved }, { mapping: saved }).steps.find((s) => s.id === PREREQ_STEP_ID.trustedLocation)!
  assert.ok((answered.configurationFindings ?? []).length > 0, 'the tenant-object reading went with the question')
  for (const finding of answered.configurationFindings ?? []) {
    assert.doesNotMatch(String(finding.value), /Choose your office networks/)
    assert.doesNotMatch(String(finding.detail ?? ''), /Select your office networks or confirm that everyone is remote/)
  }
})
