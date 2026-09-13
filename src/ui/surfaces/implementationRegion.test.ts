// B10 — the Implementation region and the Readiness tiles against the post-B8
// audit (docs/product/actionability/POST-B8-AUDIT.md): channels on an enforced
// policy held by the unconfirmed exclusions group (P0-1), compact tiles (P0-2),
// Copy disabled with its reason (P0-3), PowerShell and JSON on policy steps only
// (P0-4), the sticky viewer with icon buttons (P0-5) and the baseline-conflict
// message (P0-6).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { laneViewFor, laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { laneReadings } from './planLanes.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { channelTabsOf, stepBodyOf } from './stepBody.ts'
import type { StepBody } from './stepBody.ts'
import { CONTRACT } from './stepContract.ts'

const read = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8')
const CONTENT_STEP = read('./ContentStep.tsx')
const SECTIONS = read('./StepSections.tsx')
const CSS = read('../app.css')
const CONTENT = read('../../../docs/design/content.json')

/** Every step's body on a fixture, composed as the Plan composes it (stepSnapshots.ts). */
function bodiesOf(f: Fixture): Map<string, StepBody> {
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const readings = laneReadings(r.steps, [])
  const titleOf = (id: string): string | null => {
    const s = r.steps.find((x) => x.id === id)
    return s ? s.plainTitle || s.title : null
  }
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  const out = new Map<string, StepBody>()
  for (const step of r.steps) {
    const reading = readings.get(step.id)
    const lane = reading ? laneViewOf(reading, titleOf) : laneViewFor(step, r.steps, titleOf)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
    out.set(step.id, stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) }))
  }
  return out
}

const tabs = (b: StepBody | undefined): string[] => (b ? channelTabsOf(b.artifacts).map((t) => String(t.label)) : [])
const named = (name: FixtureName) => bodiesOf(fixture(name))

test('P0-1: an enforced policy held by the unanswered exclusions question draws its correction as a planning preview', () => {
  const bodies = bodiesOf(noExclusionsAnswer(fixture('mid')))
  const legacy = bodies.get('s-goal-block-legacy-auth')
  assert.ok(legacy, 'legacy auth is on the mid plan')
  assert.equal(legacy.contract.state.lifecycle, 'enforced', 'the premise: the policy is enforced')
  assert.deepEqual(tabs(legacy), ['Entra', 'PowerShell', 'JSON', 'AI Info'])
  assert.ok(legacy.previewNote, 'the held correction is offered as if it could run')
  // No empty box, and no content anywhere says "Nothing to submit yet" (decision 5).
  assert.equal(CONTENT.includes('Nothing to submit'), false)
})

test('P0-3: Copy is drawn on a planning preview, not offered, with the values still to resolve as its reason', () => {
  const group = bodiesOf(noExclusionsAnswer(fixture('mid'))).get('s-prereq-exclusion-group')
  assert.ok(group?.previewNote, 'the exclusions group is a planning preview')
  assert.ok(group.previewNote.lines.some((l) => /^Values still to resolve: /.test(l)), group.previewNote.lines.join(' | '))
  // One control, inline and in the viewer: always drawn, disabled on a preview, titled with the preview's lines.
  assert.match(CONTENT_STEP, /const copyReason = copyable \? W\.copy : \(preview\?\.lines\.join\(' '\) \?\? W\.copy\)/)
  assert.match(CONTENT_STEP, /title=\{copyReason\}/)
  assert.match(CONTENT_STEP, /aria-disabled=\{!copyable\}/)
  assert.equal((CONTENT_STEP.match(/\{copyControl\}/g) ?? []).length, 2)
  assert.match(CSS, /\.step \.icon-btn\[aria-disabled="true"\] \{[^}]*opacity: 0\.4;[^}]*cursor: not-allowed;/)
})

test('P0-4: PowerShell and JSON render on Conditional Access policy steps only', () => {
  const demo = named('demo')
  assert.deepEqual(tabs(demo.get('s-prereq-break-glass')), ['Entra', 'AI Info'])
  assert.deepEqual(tabs(demo.get('s-prereq-exclusion-group')), ['Entra', 'AI Info'])
  assert.deepEqual(tabs(demo.get('s-goal-block-legacy-auth')), ['Entra', 'PowerShell', 'JSON', 'AI Info'])
  for (const [id, b] of demo) if (b.cs.kind !== 'policy') assert.equal(tabs(b).some((t) => t === 'PowerShell' || t === 'JSON'), false, `${id}: ${tabs(b).join(', ')}`)
})

test('P0-6: the baseline-conflict step says there is not enough information, and offers no channel', () => {
  const conflict = [...named('demo').values()].find((b) => b.contract.state.condition === 'baseline-conflict')
  assert.ok(conflict, 'the demo has a baseline-conflict step')
  assert.deepEqual(conflict.artifacts, [])
  assert.equal(conflict.empty.title, 'Not enough information to provide implementation guidance.')
  assert.equal(conflict.empty.text, 'The baseline defines this policy two ways; resolve the conflict before implementation is available.')
})

test('P0-2: a tile is one line until opened; its detail is hidden; the strip does not match heights', () => {
  const tile = SECTIONS.slice(SECTIONS.indexOf('function Tile('), SECTIONS.indexOf('/** `**bold**`'))
  assert.match(tile, /const \[expanded, setExpanded\] = useState\(false\)/, 'the open state is not the tile’s own (it must reset when the step closes)')
  assert.match(tile, /<button type="button" className="tile-summary" aria-expanded=\{shown\} aria-controls=\{detailId\}/)
  assert.match(tile, /<div id=\{detailId\} className="tile-detail" hidden=\{!shown\}>/)
  assert.match(tile, /const shown = open \|\| expanded/, 'printing does not stand every tile open')
  assert.doesNotMatch(tile, /<details|<summary/, 'a tile still draws a details disclosure')
  assert.match(CSS, /\.step \.readiness-strip \{[^}]*align-items: start;/)
  assert.match(CSS, /\.step \.tile-summary strong \{[^}]*white-space: nowrap;/)
  assert.doesNotMatch(CSS, /\.step \.readiness-tile \{[^}]*min-height/, 'tiles are still padded to one height')
})

test('P0-5: the viewer’s tabs and Copy are in its sticky head, and no dialog button carries text', () => {
  const dialog = SECTIONS.slice(SECTIONS.indexOf('export function StepDialog('), SECTIONS.indexOf('export function PolicyMembers'))
  assert.match(dialog, /<header className="dialog-head">[\s\S]*<div className="dialog-head-actions">\s*\{toolbar\}\s*<button type="button" className="icon-btn" aria-label=\{closeLabel\} title=\{closeLabel\} onClick=\{onClose\}>\s*<Icon name="close" size=\{14\} \/>\s*<\/button>/)
  assert.doesNotMatch(dialog, /<Button /, 'a dialog control still carries text')
  const viewer = CONTENT_STEP.slice(CONTENT_STEP.indexOf('<StepDialog\n            open={open}'), CONTENT_STEP.indexOf('</StepDialog>', CONTENT_STEP.indexOf('<StepDialog\n            open={open}')))
  assert.match(viewer, /toolbar=\{\s*<>\s*<TabList[^]*?\{copyControl\}\s*<\/>\s*\}/, 'the tabs and Copy are not the head’s toolbar')
  assert.doesNotMatch(CONTENT_STEP, /dialog-toolbar/)
  assert.match(CSS, /\.step-dialog \.dialog-head \{\s*position: sticky;\s*top: 0;\s*z-index: 1;/)
  assert.equal(CONTRACT.implementation.close, 'Minimize')
})
