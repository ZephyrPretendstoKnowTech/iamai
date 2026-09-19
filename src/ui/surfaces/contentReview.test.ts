// Content review S0 (docs/content-review/specs/UNIVERSAL-CONTENT-CHANGES.md):
// one test per renderer fix, UI polish item and resolved decision, each
// asserting what the opened step now shows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { CONTRACT, implementationEmptyOf, railOf, readinessLeadOf } from './stepContract.ts'
import type { StepContract } from './stepContract.ts'
import { WHEN, laneViewFor, laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { SNAPSHOT_DIR } from '../../testing/stepSnapshots.ts'
import dependencyData from '../../actionability/dependency-data.json' with { type: 'json' }
import type { DependencyData } from '../../actionability/parseDependencyDoc.ts'
import { buildGraph, deriveLane } from '../../actionability/lanes.ts'
import type { ConditionState, PrerequisiteState, StepObservation, TenantState } from '../../actionability/lanes.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { laneReadings } from './planLanes.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import { fillText } from '../../content/render.ts'
import { AUTO_OPEN_CAP_PX, autoOpenTiles } from './tileExpansion.ts'
import type { StepBody } from './stepBody.ts'
import { usesDecisionAnatomy } from '../../roadmap/stepGroups.ts'

/** Every step's body on a fixture, as the Plan composes it (readinessWords.test.ts, stepSnapshots.ts). */
function bodiesOf(f: Fixture): Map<string, StepBody> {
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const readings = laneReadings(r.steps, [])
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
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

/** Every step snapshot the fixtures write (docs/qa/step-snapshots): what each opened step draws. */
const snapshots = (): { where: string; s: { tiles: { label: string; state: string }[] } }[] =>
  (readdirSync(SNAPSHOT_DIR, { recursive: true }) as string[]).filter((f) => f.endsWith('.json')).map((f) => ({ where: f, s: JSON.parse(readFileSync(join(SNAPSHOT_DIR, f), 'utf8')) }))

test('R1: an undated milestone reads "—", never the lane substatus', () => {
  const lanes = [
    { lane: 'Ready', substatus: 'Correct', label: 'Ready · Correct', tone: 'ok' },
    { lane: 'Up Next', substatus: null, label: 'Up Next · After Create or Correct Exclusions Group', tone: 'wait' },
    { lane: 'On Hold', substatus: null, label: 'On Hold · Baseline references an unmapped group', tone: 'stop' },
  ]
  for (const lane of lanes) {
    const c = { milestone: { at: null, label: 'x', kind: 'resolve', gatedBy: null }, state: { lane }, schedule: null, scheduledOn: null } as unknown as StepContract
    assert.equal(WHEN.none, 'Not scheduled')
    assert.equal(railOf(c).metric, 'Not scheduled', `${lane.label}: the milestone repeats the lane`)
  }
  // A scheduled day is still the metric, a decision's included.
  const decide = { milestone: { at: null, label: 'x', kind: 'decide', gatedBy: null }, state: { lane: lanes[0] }, schedule: { transition: 'decide', class: 'scheduled', at: '2026-09-14T00:00:00.000Z' }, scheduledOn: null } as unknown as StepContract
  assert.equal(railOf(decide).metric, absoluteDate('2026-09-14T00:00:00.000Z'))
})

test('R2: the readiness bar draws no filler sub-text', () => {
  const lead = (text: string): string | null => readinessLeadOf({ whatToDo: { kind: 'resolve', text } } as unknown as StepContract)
  for (const filler of ['Make the object this step names.', 'Make the decision', 'Make the decision.', 'Resolve prerequisites.', 'For each person:']) {
    assert.equal(lead(filler), null, `the bar still says "${filler}"`)
  }
  assert.equal(lead('Fix each failing check. 3 of 34 fail today.'), 'Fix each failing check. 3 of 34 fail today.')
  const src = readFileSync('src/ui/surfaces/StepSections.tsx', 'utf8')
  const fn = src.slice(src.indexOf('export function WhatToDoLead'), src.indexOf('export function DoneWhen'))
  assert.match(fn, /readinessLeadOf\(contract\)[\s\S]*if \(text === null\) return null/, 'the bar lead does not read the filler rule')
})

// Cycle 1 (FINDINGS 5): "In progress" said an actionable prerequisite nobody had
// started was under way. IAMAI cannot tell whether anyone started it, so the
// Ready lane reads "To do", which claims nothing about starting.
test('R3: a prerequisite tile reads To do, Completed or Waiting, never Ready or In progress', () => {
  const readings = new Map((['Ready', 'Up Next', 'On Hold', 'Completed'] as const).map((lane) => [lane, { lane }])) as unknown as Parameters<typeof prerequisiteLabelFor>[0]
  const label = prerequisiteLabelFor(readings)
  assert.equal(label('Ready'), 'Prerequisite · To do')
  assert.equal(label('Completed'), 'Prerequisite · Completed')
  assert.equal(label('Up Next'), 'Prerequisite · Waiting')
  assert.equal(label('On Hold'), 'Prerequisite · Waiting')
  assert.equal(label('unknown'), null)
  // Every opened step on every fixture draws the new words.
  let prerequisites = 0
  for (const { where, s } of snapshots()) {
    for (const t of s.tiles.filter((t) => t.label.startsWith('Prerequisite · '))) {
      assert.match(t.label, /^Prerequisite · (To do|Completed|Waiting|Deferred)$/, `${where}: a prerequisite tile reads "${t.label}"`)
      prerequisites += 1
    }
  }
  assert.ok(prerequisites > 0, 'no fixture draws a prerequisite tile: the premise is untested')
})

test('R4: tile marks follow one rule — ! blocking, ✓ satisfied, none informational', () => {
  const src = readFileSync('src/ui/surfaces/StepSections.tsx', 'utf8')
  // Waiting and in-progress prerequisites are blocking: the same ! as a tile that needs attention.
  assert.match(src, /const MARK: Record<ReadinessTone, string \| null> = \{ good: '✓', warn: '!', wait: '!', info: null \}/)
  assert.equal(src.includes("'…'"), false, 'a tile still draws the … mark')
})

test('R5: a step with nothing unresolved reads "✓ Clear — No unresolved checks."', () => {
  const tiles = CONTRACT.readiness.tiles as Record<string, string>
  assert.equal(tiles.clear, 'Clear')
  assert.equal(tiles.clearNote, 'No unresolved checks.')
  const src = readFileSync('src/ui/surfaces/StepSections.tsx', 'utf8')
  assert.match(src, /<strong>\{W\.tiles\.clear\}<\/strong>\s*<span>\{W\.tiles\.clearNote\}<\/span>/, 'the clear line does not read the content key')
  assert.equal(readFileSync('docs/design/content.json', 'utf8').includes('Nothing outstanding changes the next action'), false, 'the engineer-speak is still in content')
})

test('R6: the action column heads its first input with the input label, bold', () => {
  const step = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  const decision = step.slice(step.indexOf('function SingleDecision'), step.indexOf('export function Options'))
  assert.match(decision, /<h5 className="dlabel action-heading" id=\{`\$\{base\}-decision`\}>\{d\.heading \?\? d\.label\}<\/h5>/, 'no heading over the decision')
  const heading = decision.indexOf('<h5 className="dlabel action-heading"')
  assert.ok(heading < decision.indexOf('<Picker ') && heading < decision.indexOf('<Options '), 'the heading is not above the first input')
  const css = readFileSync('src/ui/app.css', 'utf8')
  assert.match(css, /\.step-action-column \.action-heading \{[^}]*font-weight: var\(--weight-strong\);/, 'the heading is not bold')
})

test('R7: the action column’s surface and hairline run to the bottom of the step body', () => {
  const css = readFileSync('src/ui/app.css', 'utf8')
  // The body's grid aligns its items to the start; the column overrides that and spans both rows.
  assert.match(css, /\.step-body\.has-rail > \.step-action-column \{[^}]*grid-row: 1 \/ span 2;[^}]*align-self: stretch;/, 'the action column stops after its last control')
  assert.match(css, /\.step-action-column \{[^}]*border-left: 1px solid var\(--line\);/, 'the column lost its hairline')
})

test('R8: an enforced policy that drifted reads Ready · Correct, whatever conditional input is unanswered', () => {
  const data = dependencyData as DependencyData
  const graph = buildGraph(data)
  // A healthy tenant around the step: everything else complete, every condition settled, every prerequisite resolved.
  const tenant = (id: string, obs: StepObservation): TenantState => {
    const steps: Record<string, StepObservation> = Object.fromEntries(data.steps.map((s) => [s.id, { complete: true }]))
    const conditions: Record<string, ConditionState> = Object.fromEntries(data.conditions.map((c) => [c.name, 'not-applicable']))
    const prerequisites: Record<string, PrerequisiteState> = Object.fromEntries(data.edges.filter((e) => e.prerequisiteKind !== 'step').map((e) => [e.prerequisite, 'resolved']))
    return { steps: { ...steps, [id]: obs }, conditions, prerequisites }
  }
  const enforced: StepObservation = { exists: true, enforced: true, evidenceSatisfied: true }
  for (const [id, input] of [['s-goal-block-legacy-auth', 'Mail-sending devices'], ['s-goal-block-device-code', 'Device code sign-in'], ['s-goal-guests-mfa', 'Partner or MSP access']]) {
    const drifted = deriveLane(id, graph, tenant(id, { ...enforced, drift: true, unsaved: [input] }), { deferred: [] })
    assert.deepEqual([drifted.lane, drifted.substatus], ['Ready', 'Correct'], `${id}: an unanswered ${input} overrides the correction`)
    // The input still gates completion, and with nothing to correct it is the next thing.
    const asPinned = deriveLane(id, graph, tenant(id, { ...enforced, unsaved: [input] }), { deferred: [] })
    assert.deepEqual([asPinned.lane, asPinned.substatus], ['Ready', 'Decision'], `${id}: the unanswered input no longer holds completion`)
  }
})

test('R9: "No implementation needed" appears only on a goal delivered with nothing open', () => {
  const E = CONTRACT.implementation.empty as Record<string, string[]>
  const satisfied = { state: { satisfied: true, condition: 'healthy', setAside: false }, fix: [], implementation: { offered: false, reason: null, hold: null }, whatToDo: { kind: 'preserve', text: 'x' } } as unknown as StepContract
  assert.equal(implementationEmptyOf(satisfied).key, 'inPlace')
  assert.equal(implementationEmptyOf(satisfied, 1).key, 'blocked', 'an unresolved tile still reads No implementation needed')
  assert.equal(implementationEmptyOf({ ...satisfied, fix: [{ key: 'step:x', text: 'x' }] } as unknown as StepContract).key, 'blocked', 'a pending correction still reads No implementation needed')
  // Every opened step on the fixtures: Block Legacy Auth with Mail-sending devices unconfirmed among them.
  let open = 0
  for (const name of ['small', 'mid', 'large'] as const) {
    for (const [id, b] of bodiesOf(fixture(name))) {
      if (b.readiness.tiles.length === 0 && b.contract.fix.length === 0) continue
      assert.notEqual(b.empty.title, E.inPlace[0], `${name}/${id}: "${E.inPlace[0]}" beside ${b.readiness.tiles.length} open tile(s)`)
      if (b.contract.state.satisfied) open += 1
    }
  }
  assert.ok(open > 0, 'no satisfied step with an open item on the fixtures: the premise is untested')
})

test('U-P1: a header tile date reads the day on one line and the year under it, never broken mid-date', () => {
  // The split the tile makes holds for the formatter the tiles use.
  const m = /^(.+), (\d{4})$/.exec(absoluteDate('2026-09-21T12:00:00.000Z'))
  assert.ok(m, 'the date format no longer splits into day and year')
  assert.match(m[1], /^[A-Z][a-z]{2} \d{1,2}$/, 'the day line is not a month and a day')
  assert.equal(m[2], '2026')
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  for (const key of ['projectedFinish']) assert.match(plan, new RegExp(`key: '${key}'[^\\n]*absoluteDate\\(`), `the ${key} tile no longer holds a date`)
  assert.match(plan, /tileValue\(t\.value\)/, 'the tile draws its value unsplit')
  assert.match(plan, /<span className="tile-day">\{m\[1\]\}<\/span>\s*<span className="tile-year-comma">, <\/span>\s*<span className="tile-year">\{m\[2\]\}<\/span>/, 'the tile no longer keeps the whole date as its text')
  const css = readFileSync('src/ui/app.css', 'utf8')
  assert.match(css, /\.plan-progress-tile \.tile-day \{\s*white-space: nowrap;/, 'the day can still break')
  assert.match(css, /\.plan-progress-tile \.tile-year \{\s*display: block;\s*font-size: var\(--t-2\);/, 'the year is not on its own smaller line')
  assert.match(css, /\.plan-progress-tile \.tile-year-comma \{[^}]*clip-path: inset\(50%\);/, 'the comma is drawn between the lines')
})

test('D1: the Managed Device Done when names no shared-device exception', () => {
  const content = readFileSync('docs/design/content.json', 'utf8')
  assert.ok(content.includes('"doneEnd": "The policy is enforced in {tenant}, requiring a compliant device OR Microsoft Entra hybrid joined device on the selected platforms outside the trusted network, with the approved exclusions applied."'), 'the Managed Device end state is not the decided sentence')
  assert.equal(/shared-device exception/i.test(content), false, 'an orphaned shared-device exception is still in content')
  // Every opened step's Done when, as the fixtures draw it.
  let lines = 0
  for (const name of ['small', 'mid'] as const) {
    for (const [id, b] of bodiesOf(fixture(name))) {
      for (const line of b.contract.doneWhen) {
        assert.equal(/shared-device exception/i.test(line), false, `${name}/${id}: Done when reads "${line}"`)
        lines += 1
      }
    }
  }
  assert.ok(lines > 0)
})

test('D2: steps keep supported channels across actions and omit permanently unsupported formats', () => {
  const unavailable = fillText(CONTRACT.implementation.channelUnavailable, { address: 'feedback@getiamai.com' })
  // Editorial batch C: a channel with nothing for this action says so neutrally, and never sends a customer to the product's feedback address.
  assert.equal(unavailable, 'This format has no output for the current action. Use the available guidance and readiness checks on this step.')
  assert.doesNotMatch(unavailable, /feedback@|could not be loaded/)
  let steps = 0
  let missing = 0
  for (const name of ['demo', 'mid'] as const) {
    for (const [id, b] of bodiesOf(fixture(name))) {
      // A decision-anatomy step (Decide Your Tenant's Direction) builds nothing and draws no Implementation (owner, 2026-09-19).
      if (usesDecisionAnatomy(id)) { assert.equal(b.showImplementation, false, `${name}/${id}`); continue }
      assert.equal(b.showImplementation, true, `${name}/${id}: the Implementation region is hidden`)
      assert.ok(b.artifacts.some((a) => a.id === 'ai'), `${name}/${id}: AI briefing is missing`)
      assert.ok(b.artifacts.every(a => a.text().trim().length > 0), `${name}/${id}: empty resource`)
      for (const a of b.artifacts.filter((x) => x.unavailable)) {
        assert.ok(a.text().trim().length > 0, `${name}/${id}: ${a.id} has no explanation`)
        assert.doesNotMatch(a.text(), /could not be loaded/, `${name}/${id}: lifecycle wait is presented as an error`)
        missing += 1
      }
      steps += 1
    }
  }
  assert.ok(steps > 20 && missing === 0, `steps ${steps}, channels without content ${missing}`)
  const src = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  assert.match(src, /const copyable = active !== null && active\.unavailable !== true/, 'a channel with no content can be copied')
  assert.doesNotMatch(src, /artifacts\.length === 0 \?/, 'the region still swaps its channels for a box')
})

test('D5: blocking tiles open with the step; past the height cap only the first does, and a line says the rest wait', () => {
  assert.equal(AUTO_OPEN_CAP_PX, 400)
  const tiles = [{ key: 'a', height: 120 }, { key: 'b', height: 150 }, { key: 'c', height: 90 }]
  assert.deepEqual(autoOpenTiles(tiles), ['a', 'b', 'c'], 'blocking tiles within the cap do not all open')
  assert.deepEqual(autoOpenTiles([...tiles, { key: 'd', height: 200 }]), ['a'], 'blocking tiles past the cap all open')
  assert.deepEqual(autoOpenTiles([]), [])
  const src = readFileSync('src/ui/surfaces/StepSections.tsx', 'utf8')
  const section = src.slice(src.indexOf('export function ReadinessSection('), src.indexOf('/** An in-app link'))
  // Only tiles marked ! are candidates; ✓ and informational tiles stay collapsed.
  assert.match(section, /const blocking = readiness\.tiles\.filter\(\(t\) => MARK\[t\.tone\] === '!'\)/)
  assert.match(section, /autoOpen=\{cls === 'unresolved' && autoKeys\.includes\(t\.key\)\}/, 'a satisfied tile can open with the step')
  assert.match(section, /useLayoutEffect\(\(\) => \{[\s\S]*getBoundingClientRect\(\)\.height[\s\S]*autoOpenTiles\(measured\)/, 'the explanations are not measured before paint')
  assert.match(section, /\{showClosedCount && closedBlocking > 0 && <p className="readiness-more">\{fillText\(W\.tiles\.moreBlocking, \{ n: closedBlocking \}\)\}<\/p>\}/, 'nothing says more blocking tiles wait closed')
  assert.match(section, /const shown = open \|\| \(expanded \?\? autoOpen\)/, 'a pressed tile does not keep its own state')
  assert.equal((CONTRACT.readiness.tiles as Record<string, string>).moreBlocking, 'Blocking items still closed: {n}')
})
