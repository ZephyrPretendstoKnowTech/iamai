// The Plan's MFA readiness strip (docs/design/mockups/plan-top-v2.html): the
// five tiles read derive/facts.ts, the numbers Today shows; the
// expanding lists, the "Clear the date" line and the "Starting locks" line are
// gone with their words; Start date, Start the plan and Plan settings remain.
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

test('the Plan strip shows the numbers Today shows, on the demo and GetIAMAI', () => {
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const strip = factsOf(ladder(f.snapshot, f.mapping, f.snapshot.asOf))
    const today = todayView(f.snapshot, f.snapshot.asOf, f.mapping).facts
    assert.deepEqual(strip, today, `${name}: the strip and Today`)
    assert.equal(RUNGS.reduce((n, r) => n + strip.rungs[r], 0), strip.active, `${name}: the five tiles sum to the active people`)
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
  assert.match(src, /<LadderTiles counts=/, 'the Plan renders the ladder tiles')
  assert.doesNotMatch(src, /ReadinessStrip|startNote|line2/, 'the strip and the notes are gone from the Plan')
  assert.ok((pages.ladder as { header: string }).header === 'MFA Readiness')
})
