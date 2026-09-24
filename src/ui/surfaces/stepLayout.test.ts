// B3 — the opened step's layout (RUN-CONTEXT-B decisions 1, 2 and 4; U1–U5).
// No step draws What to do; the body is two columns with the action column
// between Readiness and Implementation in the DOM, led by the milestone and
// holding the controls the step takes in IAMAI; the milestone's sub-line is the
// package's own words or nothing; no Planned work banner stands over the
// channels. The per-step snapshots are the plan as every fixture draws it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { CONTRACT, railOf } from './stepContract.ts'
import type { StepContract } from './stepContract.ts'
import { HEAD } from './stepHeadings.ts'
import { SNAPSHOT_DIR, SNAPSHOT_FIXTURES } from '../../testing/stepSnapshots.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { DIRECTION_STEP_IDS } from '../../roadmap/stepGroups.ts'
import { directionMilestoneAction } from '../../roadmap/directionAnswers.ts'

const read = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8')
const CONTENT_STEP = read('./ContentStep.tsx')
const STEP_BODY = read('./stepBody.ts')
const CSS = read('../app.css')

/** Every committed snapshot, by fixture and step. */
function snapshots(): { where: string; s: { rail: string; headings: string[] } }[] {
  const out: { where: string; s: { rail: string; headings: string[] } }[] = []
  for (const name of SNAPSHOT_FIXTURES) {
    const dir = new URL(`../../../${SNAPSHOT_DIR}/${name}/`, import.meta.url)
    for (const file of readdirSync(dir)) out.push({ where: `${name}/${file}`, s: JSON.parse(readFileSync(new URL(file, dir), 'utf8')) })
  }
  return out
}

test('U1: no opened step on any fixture draws a What to do heading', () => {
  const all = snapshots()
  assert.ok(all.length > 100, 'the snapshots were not read')
  for (const { where, s } of all) assert.equal(s.headings.includes(HEAD.whatToDo), false, `${where}: draws What to do`)
  assert.doesNotMatch(STEP_BODY.slice(STEP_BODY.indexOf('export function headingsOf')), /whatToDo/, 'headingsOf still lists What to do')
  assert.doesNotMatch(CONTENT_STEP, /HEAD\.whatToDo/, 'the opened step still draws the What to do heading')
})

test('U2: the body is a two-column grid, 1fr and 260px, that stacks below 900px', () => {
  const rule = (sel: string, css = CSS): string => css.match(new RegExp(`(^|\\n)\\s*${sel.replace(/[.>]/g, (c) => `\\${c}`)} \\{[^}]*\\}`))?.[0] ?? ''
  const body = rule('.step-body.has-rail')
  assert.match(body, /grid-template-columns: 1fr 260px;/)
  assert.match(body, /column-gap: 2rem;/)
  assert.match(body, /align-items: start;/)
  assert.match(rule('.step-body.has-rail > .step-action-column'), /grid-column: 2;[\s\S]*grid-row: 1 \/ span 2;/)
  assert.match(rule('.step-body.has-rail > .step-main-lead'), /grid-column: 1;[\s\S]*grid-row: 1;/)
  assert.match(rule('.step-body.has-rail > .step-main-rest'), /grid-column: 1;[\s\S]*grid-row: 2;/)
  const from = CSS.indexOf('@media (max-width: 900px) {')
  assert.ok(from >= 0, 'no 900px breakpoint')
  const narrow = CSS.slice(from, CSS.indexOf('\n}\n', from))
  assert.match(rule('.step-body.has-rail', narrow), /grid-template-columns: 1fr;/, 'the body does not stack below 900px')
  assert.match(narrow, /> \.step-action-column,[^}]*grid-column: auto;[^}]*grid-row: auto;/, 'the action column keeps its desktop place when stacked')
  assert.doesNotMatch(narrow, /display:\s*none/, 'a column is hidden rather than stacked')
})

test('U4: no Planned work banner stands over the channels', () => {
  assert.equal('label' in CONTRACT.implementation.preview, false, 'the Planned work label is still in content')
  assert.doesNotMatch(CONTENT_STEP, /preview\.label|\{planning\}/, 'the Implementation region still draws the Planned work banner')
  // The one `.impl-planning` left is the re-pin review's note.
  for (const m of CONTENT_STEP.matchAll(/<div className="impl-planning"[^>]*>/g)) assert.match(m[0], /data-review="true"/, `a banner other than the review note: ${m[0]}`)
})

// A Direction step used to drop the rail and run its questions across the whole
// body, so its milestone became a band between the questions and Completion
// Criteria and the step read as three stacked blocks. The owner asked for one
// family (2026-09-20): every step keeps the same two columns, and no step
// widens itself by what its main column happens to contain.
test('no step widens its body by what its main column contains', () => {
  assert.doesNotMatch(CSS, /:has\([^)]*\.decision-form/, 'ordinary decision forms must retain their desktop sidebar')
  assert.doesNotMatch(CSS, /\.step-body[^{]*:has\(/, 'a step body still reshapes itself from its own contents')
  assert.doesNotMatch(CSS, /workflow-choice/, 'the Direction questions still carry their own layout')
})

test('every control a step takes is in the action column, and the anatomy is four sections', () => {
  // Owner, 2026-09-20. The Workflow Check stood in the main column *below*
  // Completion Criteria — a fifth section, outside the four the anatomy has, on
  // twelve steps. Emergency Access puts its one control in the action column
  // beside the milestone; so does every step now.
  const col = CONTENT_STEP.slice(CONTENT_STEP.indexOf('<StepActionColumn'), CONTENT_STEP.indexOf('</StepActionColumn>'))
  assert.match(col, /<ManualReviewForm/, 'the Workflow Check is not in the action column')
  assert.match(col, /<DormantDecision/)
  assert.match(col, /<Decision key=/, 'the decision control left the action column')
  // The main column draws it only while printing, where the page is one column.
  const rest = CONTENT_STEP.slice(CONTENT_STEP.indexOf('</StepActionColumn>'))
  assert.match(rest, /step\.manualReview && printing && <ManualReviewForm/, 'the main column draws it on screen')
})

test('the dormant step asks one question however many accounts there are', () => {
  // It drew a dropdown and a text box per account: two controls on the demo and
  // 1,462 on a directory with 731 dormant accounts. The step completes when each
  // account is disabled, active again, or kept with a reason — and the scan sees
  // the first two for itself, so the only answer needed is which are kept.
  const body = CONTENT_STEP.slice(CONTENT_STEP.indexOf('function DormantDecision('), CONTENT_STEP.indexOf('function DormantDecision(') + 2600)
  assert.match(body, /<Picker/, 'the dormant step does not use the shared picker')
  assert.equal(/rows\.map\(row => <fieldset/.test(body), false, 'a control per account came back')
  assert.equal((body.match(/<select/g) ?? []).length, 0, 'a per-account dropdown came back')
})
