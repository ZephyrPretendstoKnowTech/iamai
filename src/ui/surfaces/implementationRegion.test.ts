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
import { laneViewFor, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
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
    const lane = laneViewFor(step, { readings, titleOf })
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
    out.set(step.id, stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) }))
  }
  return out
}

/** The channels with content. Every channel is a tab (content review D2); one without content says so. */
const tabs = (b: StepBody | undefined): string[] => (b ? channelTabsOf(b.artifacts.filter((a) => !a.unavailable)).map((t) => String(t.label)) : [])
const named = (name: FixtureName) => bodiesOf(fixture(name))

test('held policy resources stay copyable, useful and free of repeated disclaimer panels', () => {
  const bodies = bodiesOf(noExclusionsAnswer(fixture('mid')))
  // No read-only PowerShell or JSON stands in, and Block Legacy Authentication has no Email tab (walk list 4.x item 29).
  for (const [id, expected] of [['s-goal-block-legacy-auth', ['Entra', 'AI Info']], ['s-goal-guests-mfa', ['Entra', 'AI Info', 'Email']]] as const) {
    const body = bodies.get(id)!
    assert.equal(body.contract.state.lifecycle, 'enforced')
    assert.deepEqual(tabs(body), expected)
    assert.equal(body.previewNote, null)
    for (const a of body.artifacts) {
      assert.notEqual(a.unavailable, true)
      assert.doesNotMatch(a.text(), /This format has no output|You can copy this guidance/)
    }
  }
})

test('Copy stays available for every substantive resource without preview notes', () => {
  const group = bodiesOf(noExclusionsAnswer(fixture('mid'))).get('s-prereq-exclusion-group')!
  assert.equal(group.previewNote, null)
  assert.ok(group.artifacts.every(a => a.unavailable !== true && a.text().trim().length > 0))
  assert.match(CONTENT_STEP, /const copyable = active !== null && active\.unavailable !== true/)
  assert.equal(CONTENT_STEP.includes('className="impl-planning"'), false)
  assert.equal((CONTENT_STEP.match(/\{copyControl\}/g) ?? []).length, 3, 'the first-step channel toolbar adds one conditional inline placement')
})

test('machine resources follow supported step capability, including useful prerequisite inspection', () => {
  const demo = named('demo')
  // Prepare Emergency Access Accounts has no machine channel: the scan already reads what its script and JSON read (owner, 2026-09-23).
  assert.deepEqual(tabs(demo.get('s-prereq-break-glass')), ['Entra', 'AI Info'])
  assert.ok(demo.get('s-direction-devices')!.artifacts.every(a => a.id !== 'json' && a.id !== 'ps'))
})

test('retained baseline conflict remains a conflict and has no deployment operation', () => {
  const conflict = [...named('demo').values()].find(b => b.contract.state.condition === 'baseline-conflict')!
  assert.ok(conflict)
  assert.equal(conflict.contract.implementation.offered, false)
  assert.equal(conflict.empty.key, 'conflict')
  for (const artifact of conflict.artifacts.filter(a => a.id === 'json')) assert.ok(JSON.parse(artifact.text()).requests.every((r: {method:string}) => r.method === 'GET'))
})

test('P0-2: a tile is one line until opened; its detail is hidden; the strip does not match heights', () => {
  const tile = SECTIONS.slice(SECTIONS.indexOf('function Tile('), SECTIONS.indexOf('/** `**bold**`'))
  assert.match(tile, /const \[expanded, setExpanded\] = useState<boolean \| null>\(null\)/, 'the open state is not the tile’s own (it must reset when the step closes)')
  assert.match(tile, /<button type="button" className="tile-summary" aria-expanded=\{shown\} aria-controls=\{detailId\}/)
  assert.match(tile, /<div id=\{detailId\} className="tile-detail" hidden=\{!shown\}>/)
  assert.match(tile, /const shown = open \|\| \(expanded \?\? autoOpen\)/, 'printing does not stand every tile open')
  assert.doesNotMatch(tile, /<details|<summary/, 'a tile still draws a details disclosure')
  assert.match(CSS, /\.step \.readiness-strip \{[^}]*align-items: start;/)
  assert.match(CSS, /\.step \.tile-summary strong \{[^}]*white-space: nowrap;/)
  assert.doesNotMatch(CSS, /\.step \.readiness-tile \{[^}]*min-height/, 'tiles are still padded to one height')
})

test('P0-5: the viewer’s tabs and Copy are in its sticky head, and no dialog button carries text', () => {
  const dialog = SECTIONS.slice(SECTIONS.indexOf('export function StepDialog('), SECTIONS.indexOf('export function PolicyMembers'))
  assert.match(dialog, /<header className="dialog-head">[\s\S]*<div className="dialog-head-actions">\s*\{toolbar\}\s*<button type="button" className="icon-btn" aria-label=\{closeLabel\} title=\{closeLabel\} onClick=\{onClose\}>\s*<Icon name="close" size=\{14\} \/>\s*<\/button>/)
  assert.doesNotMatch(dialog, /<Button /, 'a dialog control still carries text')
  const viewerStart = CONTENT_STEP.search(/<StepDialog\s+open=\{open\}/)
  const viewer = CONTENT_STEP.slice(viewerStart, CONTENT_STEP.indexOf('</StepDialog>', viewerStart))
  assert.ok(
    viewerStart >= 0 &&
      viewer.includes('<TabList') &&
      viewer.indexOf('<TabList') < viewer.indexOf('{taskControls}') &&
      viewer.indexOf('{taskControls}') < viewer.indexOf('{copyControl}'),
    'the tabs, applicable task controls and Copy are not the head’s toolbar',
  )
  assert.doesNotMatch(CONTENT_STEP, /dialog-toolbar/)
  assert.match(CSS, /\.step-dialog \.dialog-head \{\s*position: sticky;\s*top: 0;\s*z-index: 1;/)
  assert.equal(CONTRACT.implementation.close, 'Minimize')
})
