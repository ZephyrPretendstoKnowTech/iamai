// The Plan's header and what sits under it (docs/design/mockups/plan-top-v2.html,
// then task 011): the start keeps its date, its button and its settings link, and
// nothing else stands between the header line and the rollout board.
//
// The MFA readiness ladder was a tenant-wide diagnostic on a page whose job is
// the rollout; it answered a question no step on the Plan asks. Task 011 took it
// off the Plan and task 016 took it off Connect. Step 7 replaced the rungs with
// the four readiness states (scoring/phishingResistant.ts): MFA Readiness counts
// them, and no surface draws a ladder at all.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { ladder } from '../../derive/ladder.ts'
import { factsOf } from '../../derive/facts.ts'
import { SUMMARY_STATES, readinessView } from '../../derive/mfaReadiness.ts'
import { READINESS_STATES } from '../../scoring/phishingResistant.ts'
import { startControl } from '../../derive/planHeader.ts'
import { pages } from '../../content/content.ts'
import { readinessHref } from '../shell/routes.ts'

test('the readiness numbers are one set, on the demo and GetIAMAI, wherever they are shown', () => {
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const strip = factsOf(ladder(f.snapshot, f.mapping, f.snapshot.asOf))
    const view = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    assert.deepEqual(strip, view.facts, `${name}: the facts and MFA Readiness`)
    for (const s of READINESS_STATES) assert.equal(view.counts[s], strip.states[s], `${name}: ${s} is counted once`)
    assert.equal(READINESS_STATES.reduce((n, s) => n + strip.states[s], 0), strip.active, `${name}: the four states sum to the active people`)
  }
  for (const s of SUMMARY_STATES) assert.equal(readinessHref(s), `#/readiness/${s}`, 'each count links to MFA Readiness filtered to its state')
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
  assert.ok(!('ladder' in pages), 'the ladder words went with the rungs (Step 7)')
})

// Task 011 took the five tiles off the Plan; task 016 took them off Connect. A
// tenant-wide readiness diagnostic is not the rollout board's job and it is not
// the setup progression's either: Connect ends at the Plan, and MFA Readiness
// comes after it.
test('no rollout surface draws a readiness ladder, and MFA Readiness counts states, not rungs', () => {
  for (const file of ['src/ui/surfaces/Plan.tsx', 'src/ui/surfaces/Connect.tsx']) {
    const src = readFileSync(file, 'utf8')
    assert.doesNotMatch(src, /LadderTiles|rung-tile|LadderHead/, `${file} renders no readiness tiles`)
    assert.doesNotMatch(src, /derive\/ladder\.ts/, `${file} reads no partition of its own`)
  }
  // The component the two surfaces shared is gone, and so are its rules.
  assert.equal(existsSync('src/ui/surfaces/LadderTiles.tsx'), false, 'the tiles component was deleted with its last caller')
  assert.doesNotMatch(readFileSync('src/ui/app.css', 'utf8'), /\.rung-tiles|\.rung-tile\b|\.rung-badge/, 'the tiles and the badge left their rules behind')
  const readiness = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')
  assert.doesNotMatch(readiness, /LadderTiles|LadderHead|className="ladder"|RungBadge|rung-badge/, 'the page draws no ladder and no rung badge')
  assert.match(readiness, /SUMMARY_STATES\.map/, 'the three counts beside Ready')
})

// The evidence itself is untouched by where it is drawn: a state that no longer
// counts anybody would be a deletion dressed up as a layout change.
test('the person-level MFA evidence MFA Readiness reads is intact', () => {
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const view = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    assert.ok(view.rows.length > 0, `${name}: a row per account`)
    assert.ok(view.rows.every((r) => typeof r.user.id === 'string' && (r.kind !== 'person' || r.readiness !== null)), `${name}: every person carries their readiness`)
    assert.ok(view.rows.some((r) => r.active && r.state !== null), `${name}: the states still land on people`)
    assert.ok(view.facts.active > 0, `${name}: the active count survives`)
  }
})
