// Define Your Rollout Scope on the Plan (DirectionQuestions.tsx, ContentStep.tsx,
// stepBody.ts): the decision anatomy and one Approve answers button.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { ANSWERED_IN } from '../../roadmap/direction.ts'
import { DIRECTION_STEP, directionMilestoneAction } from '../../roadmap/directionAnswers.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import { directionWords } from '../../content/content.ts'
import { headingsOf, stepBodyOf } from './stepBody.ts'
import { laneReadings } from './planLanes.ts'
import { DIRECTION_STEP_IDS } from '../../roadmap/stepGroups.ts'
import { emergencyTaskSteps, emergencyTaskText } from './emergencyAccountTasks.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
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

test('a Direction step draws About this Step, Questions and Completion Criteria and no Implementation, each question an Emergency Access subject card (owner, 2026-09-20)', () => {
  {
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
  }
  // The owner unfroze the Direction steps' UI (2026-09-20) and asked for one
  // family: a question reads as an Establish Emergency Access subject card, drawn
  // with the components that step already has rather than a second visual
  // language. Both files are read, so a question card that stopped being the
  // Emergency Access card — from either end — fails here.
  {
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
  }
})

test('a step whose question moved never asks it again', () => {
  {
    // The countries step asks its own work countries since Stage 3: nothing about it is answered in Direction.
    assert.deepEqual(Object.keys(ANSWERED_IN).sort(), [PREREQ_STEP_ID.serviceAccountsGroup, PREREQ_STEP_ID.trustedLocation, 's-goal-block-legacy-auth', 's-goal-guests-mfa', 's-shared-devices'].sort())
  }
  {
    // The owner's own example (docs/plans/step-redundancy-analysis.md finding 2).
    // This step is the doing of D4's office-network answer; it used to draw a
    // tile reading "Trusted Network: Choose your office networks", with the
    // detail "Select your office networks or confirm that everyone is remote" —
    // D4's question again, on a second row of the board.
    const f = fixture('demo')
    const unanswered = { ...f.mapping, wizardAnswered: { ...f.mapping.wizardAnswered, trustedLocations: false } }
    const open = runFixture({ ...f, mapping: unanswered }, { mapping: unanswered }).steps.find((s) => s.id === PREREQ_STEP_ID.trustedLocation)!
    assert.deepEqual(open.configurationFindings ?? [], [], 'the step asks the question again')

    // Answered, the tile is about the tenant's objects rather than the question,
    // so it comes back: nothing was hidden, only the second asking removed.
    const saved = { ...f.mapping, wizardAnswered: { ...f.mapping.wizardAnswered, trustedLocations: true }, assumed: { ...(f.mapping.assumed ?? {}), trustedLocations: 'confirmed' as const } }
    const answered = runFixture({ ...f, mapping: saved }, { mapping: saved }).steps.find((s) => s.id === PREREQ_STEP_ID.trustedLocation)!
    for (const finding of answered.configurationFindings ?? []) {
      assert.doesNotMatch(String(finding.value), /Choose your office networks/)
      assert.doesNotMatch(String(finding.detail ?? ''), /Select your office networks or confirm that everyone is remote/)
    }
  }
})

test('the text fixes the owner approved on the frozen steps, 2026-09-20: the six Direction notes and a passkey preparation whose every numbered line is a thing to do', () => {
  {
    // Frozen means frozen; these six are the owner's named exceptions, text only.
    const f = fixture('demo')
    const r = runFixture(f)
    const questionsOf = (id: string) => r.steps.find((s) => s.id === id)!.directionQuestions ?? []
    const use = questionsOf(DIRECTION_STEP.use)
    const devices = questionsOf(DIRECTION_STEP.devices)

    // 1. Device code sign-in never said what answering it does: a session that
    //    used the flow stays tracked, so later requests in it can be blocked and
    //    a device can be signed out (close-doors-spec.md section 4, ms-auth-flows).
    const code = use.find((q) => q.key === 'deviceCode')!
    assert.match(code.note ?? '', /stays tracked/)
    assert.match(code.note ?? '', /signed out/)

    // 2. Blocked from company data adds a policy step of its own, which the
    //    question never said.
    const phones = devices.find((q) => q.key === 'phones')!
    assert.match(phones.note ?? '', /Keep Company Data Off Phones/)
    assert.match(phones.note ?? '', /report-only/)

    // 3. The same dropdown position means the same thing: the service questions
    //    read Yes/No, and these two read No/Yes beside them on one screen.
    const pair = (key: string) => use.find((q) => q.key === key)!.options.map((o) => o.value)
    const service = use.find((q) => q.key.startsWith('service:'))
    if (service) assert.deepEqual(service.options.map((o) => o.value), ['yes', 'no'], 'the premise: a service question reads Yes/No')
    assert.deepEqual(pair('partner'), ['yes', 'no'])
  }
  {
    // Two lines were section titles numbered as if they were instructions, and the
    // second's section held nothing because the chosen variant carries its steps
    // (owner-approved text fix, 2026-09-20). They are instructions now, so the
    // count runs over things to do, with no new component and no new convention.
    const f = fixture('demo')
    const r = runFixture(f)
    const step = r.steps.find((s) => s.id === 's-prereq-passkey-settings')!
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
    const task = stepBodyOf(step, ctx).emergencyAccountTasks!.tasks.find((t) => t.id === 'prepare-affected-passkeys')!
    const lines = emergencyTaskSteps(task, task.defaultVariantId)
    for (const line of lines) {
      const plain = line.replace(/\*\*/g, '').trim()
      assert.ok(/\s/.test(plain.replace(/[:.]$/, '').trim().split(/(?<=[a-z]) /)[0] ?? '') || plain.split(/\s+/).length > 6, `a numbered line that instructs nothing: ${plain}`)
      assert.doesNotMatch(plain, /^(Compatible alternative|Replacement registration[^:]*)$/, `a section title is numbered as an instruction: ${plain}`)
    }
    assert.match(lines.join('\n'), /Compatible alternative:\*\* sign in with the registered compatible alternative/)
    assert.match(lines.join('\n'), /Replacement registration, only if needed:\*\* where no compatible alternative is registered/)
    // The copied text numbers every line, as it always did.
    const numbers = [...emergencyTaskText(task, task.defaultVariantId).matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]))
    assert.deepEqual(numbers, numbers.map((_, i) => i + 1))
    assert.equal(numbers.length, lines.length)
  }
})

test("an unsaved question that moved to Direction is one wait on the Direction step that asks it, and the step's own procedure asks for no answer", () => {
  // Walk list 4.x item 6: an input answered on a Direction step never draws a
  // card or a decision lane of its own on the step it changes. The step waits on
  // the Direction step, and its one tile is the wait every other Direction
  // answer draws ("{step} · Waiting on your answers"), linking there (R4-43).
  {
    const f = fixture('midflight')
    const r = runFixture(f)
    const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: null } as StepVarContext
    const legacy = r.steps.find((s) => s.id === 's-goal-block-legacy-auth')!
    assert.deepEqual(legacy.unsavedInputs, ['Mail-sending devices'], 'the premise: the mail-devices answer is unsaved on a first scan')
    assert.equal(stepBodyOf(legacy, ctx).readiness.tiles.some((t) => t.key.startsWith('unsaved:')), false, 'the question still draws a card of its own')
    // The board holds the step On Hold on the Direction step, as it holds every
    // step waiting on an answer; that reading is the tile the step draws.
    const reading = laneReadings(r.steps).get(legacy.id)!
    assert.equal(reading.lane, 'On Hold')
    assert.deepEqual([reading.reason?.kind, reading.reason?.id], ['decision', 's-direction-use'])
    assert.equal(reading.unsaved, undefined, 'the row still says it is waiting on your answer to the question')
    for (const step of r.steps.filter((s) => ANSWERED_IN[s.id] && (s.unsavedInputs ?? []).length > 0)) {
      assert.equal(stepBodyOf(step, ctx).readiness.tiles.some((t) => t.key.startsWith('unsaved:')), false, `${step.id}: an answered-on-Direction question draws a card`)
    }
  }
  // R4-46: Require MFA for Guests' procedure still said "Answer the IT Provider
  // Access question" after that question moved to Confirm What You Use. The step
  // draws the Answered-in-Direction card instead of the decision control, so the
  // line pointed at a control that is on no page, and kept saying "Answer" after
  // the answer was saved. Where the question is answered is the card's to say;
  // no procedure line on a step whose question moved asks for it.
  {
    const f = fixture('midflight')
    const r = runFixture(f)
    const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: null } as StepVarContext
    let checked = 0
    for (const id of Object.keys(ANSWERED_IN)) {
      const step = r.steps.find((s) => s.id === id)
      if (!step) continue
      const heading = ((contentStepFor(step) as { decision?: { heading?: unknown } | null } | undefined)?.decision?.heading ?? null) as string | null
      const lines = (stepBodyOf(step, ctx).emergencyAccountTasks?.tasks ?? []).flatMap((t) => emergencyTaskSteps(t))
      for (const line of lines) {
        assert.doesNotMatch(line, /\bAnswer the\b.*question/, `${id}: "${line}" asks for an answer the step no longer takes`)
        if (heading) assert.equal(line.includes(heading), false, `${id}: "${line}" names the ${heading} control, which the step does not draw`)
        checked++
      }
    }
    assert.ok(checked > 5, `only ${checked} procedure lines checked`)
    // The guest types the partner answer decides are the procedure's own users
    // line (roadmap/policyProcedure.ts), the same in every state, so no line
    // restates the answer's effect (walk list item 19).
    const guests = r.steps.find((s) => s.id === 's-goal-guests-mfa')!
    const body = stepBodyOf(guests, ctx)
    // Its decision note — the Decision tile's words — said "saving an answer
    // here does not establish trust" on a step that takes no answer: the partner
    // answer is saved on Confirm What You Use.
    assert.doesNotMatch(body.contract.decisionNote, /\bhere\b/, `the decision note places the answer on this step: "${body.contract.decisionNote}"`)
    assert.match(body.contract.decisionNote, /does not establish/, 'the note no longer says an answer does not establish trust')
  }
})
