// The Plan's header and what sits under it (docs/design/mockups/plan-top-v2.html,
// then task 011): the start keeps its date, its button and its settings link, and
// nothing else stands between the header line and the rollout board.
//
// The MFA readiness ladder was a tenant-wide diagnostic on a page whose job is
// the rollout; it answered a question no step on the Plan asks. It is gone from
// the Plan and unchanged everywhere it belongs — Today, which owns the
// person-level evidence, and Connect's Plan tile.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { RUNGS, ladder } from '../../derive/ladder.ts'
import { factsOf } from '../../derive/facts.ts'
import { todayView } from '../../derive/today.ts'
import { startControl } from '../../derive/planHeader.ts'
import { pages } from '../../content/content.ts'
import { todayHref } from '../shell/routes.ts'

test('the readiness numbers are one set, on the demo and GetIAMAI, wherever they are shown', () => {
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const strip = factsOf(ladder(f.snapshot, f.mapping, f.snapshot.asOf))
    const today = todayView(f.snapshot, f.snapshot.asOf, f.mapping).facts
    assert.deepEqual(strip, today, `${name}: the tiles and Today`)
    assert.equal(RUNGS.reduce((n, r) => n + strip.rungs[r], 0), strip.active, `${name}: the five rungs sum to the active people`)
  }
  for (const r of RUNGS) assert.equal(todayHref(`rung-${r}`), `#/today/rung-${r}`, 'each tile links to Today filtered to its rung')
})

test('the strip, the lists and the two note lines are gone from the Plan, with their words; the start keeps its date, its button and its settings link', () => {
  const plan = pages.plan as Record<string, unknown> & { settings: Record<string, unknown> }
  for (const key of ['readiness', 'startNote', 'line2']) assert.ok(!(key in plan), `pages.plan.${key} was retired`)
  assert.ok(!('startNote' in plan.settings), 'pages.plan.settings.startNote was retired')
  assert.deepEqual(startControl(), { label: 'Start the plan' })
  assert.equal(plan.settings.start, 'Start date')
  assert.equal(plan.settingsLink, 'Plan settings')
  const src = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.doesNotMatch(src, /ReadinessStrip|startNote|line2/, 'the strip and the notes are gone from the Plan')
  assert.ok((pages.ladder as { header: string }).header === 'MFA Readiness')
})

// Task 011: the Plan is the rollout board and nothing above it. The tiles are a
// tenant-wide diagnostic, not a step's next action, and a concise policy-specific
// MFA consequence still reaches the step that it changes the action on.
test('the Plan draws no MFA readiness ladder, and the surfaces that own it still do', () => {
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.doesNotMatch(plan, /LadderTiles|rung-tile|LadderHead/, 'the Plan renders no readiness tiles')
  assert.doesNotMatch(plan, /derive\/ladder\.ts/, 'the Plan reads no ladder')
  // Not deleted: Connect's Plan tile and Today still draw them, and Task 012 owns
  // where the person-level evidence finally lives.
  const tiles = readFileSync('src/ui/surfaces/LadderTiles.tsx', 'utf8')
  assert.match(tiles, /export function LadderTiles/, 'the tiles component is still here for the surfaces that own it')
  assert.match(readFileSync('src/ui/surfaces/Connect.tsx', 'utf8'), /<LadderTiles counts=/, "Connect's Plan tile still shows the readiness numbers")
  const today = readFileSync('src/ui/surfaces/Today.tsx', 'utf8')
  assert.match(today, /<LadderHead/, 'Today still shows the ladder header')
  assert.match(today, /rows/, 'Today still draws its own person rows')
})

// The evidence itself is untouched: Task 011 moved a presentation, and Task 012
// moves the operational one. A rung that no longer counts anybody would be a
// deletion dressed up as a layout change.
test('the person-level MFA evidence Today reads is intact', () => {
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const view = todayView(f.snapshot, f.snapshot.asOf, f.mapping)
    assert.ok(view.rows.length > 0, `${name}: Today still has a row per person`)
    assert.ok(view.rows.every((r) => typeof r.user.id === 'string' && r.evidence !== undefined), `${name}: every row still carries its account and what was seen of it`)
    assert.ok(view.rows.some((r) => r.active && r.rung !== null), `${name}: the rungs still land on people`)
    assert.ok(view.facts.active > 0, `${name}: the active count survives`)
  }
})
