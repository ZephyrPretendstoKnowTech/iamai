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

const read = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8')
const CONTENT_STEP = read('./ContentStep.tsx')
const STEP_SECTIONS = read('./StepSections.tsx')
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

test('U2/U5: the action column sits between Readiness and Implementation, and holds the decision', () => {
  const at = (s: string): number => {
    const i = CONTENT_STEP.indexOf(s)
    assert.ok(i >= 0, `${s} is not in ContentStep.tsx`)
    return i
  }
  const order = ['<div className="step-body has-rail">', '<div className="step-main step-main-lead">', '<h4>{HEAD.why}</h4>', '<ReadinessSection', '<StepActionColumn rail={rail}>', '<div className="step-main step-main-rest">', '<Implementation', '<DoneWhen'].map(at)
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the DOM order is not Why → Readiness → action column → Implementation → Done when')
  const column = CONTENT_STEP.slice(at('<StepActionColumn rail={rail}>'), at('</StepActionColumn>'))
  assert.match(column, /\{decides && <Decision /, 'the decision controls are not children of the action column')
  assert.equal(CONTENT_STEP.split('<Decision ').length - 1, 1, 'the decision is drawn somewhere besides the action column')
  assert.doesNotMatch(CONTENT_STEP, /StepRail/, 'the old rail is still drawn')
  // The column is led by the milestone, with no sub-line where the package authors none.
  const component = STEP_SECTIONS.slice(STEP_SECTIONS.indexOf('export function StepActionColumn'))
  assert.match(component, /<aside className="step-action-column surface-inset">\s*<div className="side-block">\s*<div className="key-label">\{CONTRACT\.railMilestone\}<\/div>\s*<p className="metric">\{rail\.metric\}<\/p>\s*\{rail\.sub !== '' && <p className="metric-sub">\{rail\.sub\}<\/p>\}\s*<\/div>\s*\{children\}/)
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

test('U3: the milestone sub-line is the package’s actionText or nothing, never generated', () => {
  const lane = { lane: 'Up Next', substatus: null, label: 'Up Next · After Create or Correct Exclusions Group', tone: 'wait' }
  const undated = { milestone: { at: null, label: 'Make the object this step names', kind: 'resolve', gatedBy: 'after: Create or Correct Exclusions Group' }, state: { lane }, schedule: null, scheduledOn: null } as unknown as StepContract
  assert.deepEqual(railOf(undated), { metric: 'Not scheduled', sub: '' })
  assert.deepEqual(railOf(undated, 'Create and verify two emergency accounts'), { metric: 'Not scheduled', sub: 'Create and verify two emergency accounts' })
  const dated = { ...undated, schedule: { transition: 'createReportOnly', class: 'scheduled', at: '2026-09-22T00:00:00.000Z' } } as unknown as StepContract
  assert.deepEqual(railOf(dated), { metric: absoluteDate('2026-09-22T00:00:00.000Z'), sub: '' }, 'a dated milestone still writes its transition words')
  assert.match(STEP_BODY, /railOf\(contract, pkg\?\.meta\.milestone\?\.actionText \?\? null\)/, 'the action column does not read the package’s milestone.actionText')
  assert.equal((CONTRACT as unknown as Record<string, unknown>).rail, undefined, 'the generated sub-line words are still in content')
  const fn = read('./stepContract.ts')
  const railSrc = fn.slice(fn.indexOf('export function railOf'), fn.indexOf('export type ImplementationEmpty'))
  for (const generated of ['railTransition', 'gatedBy', 'resolveSub', 'decideSub']) assert.equal(railSrc.includes(generated), false, `railOf still composes its sub-line from ${generated}`)
  // Every step on every fixture still has a milestone to lead the column with.
  for (const { where, s } of snapshots()) assert.ok(s.rail.trim().length > 0, `${where}: the action column has no milestone`)
})

test('U4: no Planned work banner stands over the channels', () => {
  assert.equal('label' in CONTRACT.implementation.preview, false, 'the Planned work label is still in content')
  assert.doesNotMatch(CONTENT_STEP, /preview\.label|\{planning\}/, 'the Implementation region still draws the Planned work banner')
  // The one `.impl-planning` left is the re-pin review's note.
  for (const m of CONTENT_STEP.matchAll(/<div className="impl-planning"[^>]*>/g)) assert.match(m[0], /data-review="true"/, `a banner other than the review note: ${m[0]}`)
})

test('the full-width decision layout is exclusive to services', () => {
  assert.doesNotMatch(CSS, /:has\([^)]*\.decision-form/, 'ordinary decision forms must retain their desktop sidebar')
  assert.match(CSS, /\.step-body\.has-rail:has\(\.workflow-choices\)/)
})
