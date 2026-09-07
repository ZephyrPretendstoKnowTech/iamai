// The Plan's header and what sits under it (docs/design/mockups/plan-top-v2.html,
// then task 011): the start keeps its date, its button and its settings link, and
// nothing else stands between the header line and the rollout board.
//
// The MFA readiness ladder was a tenant-wide diagnostic on a page whose job is
// the rollout; it answered a question no step on the Plan asks. Task 011 took it
// off the Plan and task 016 took it off Connect, where it stood in front of the
// destination. MFA Readiness owns the rungs and draws no ladder of its own: it
// counts the three groupings over the same rungs, and a rung is a person's badge.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { RUNGS, ladder } from '../../derive/ladder.ts'
import { factsOf } from '../../derive/facts.ts'
import { readinessView } from '../../derive/mfaReadiness.ts'
import { startControl } from '../../derive/planHeader.ts'
import { pages } from '../../content/content.ts'
import { readinessHref } from '../shell/routes.ts'

test('the readiness numbers are one set, on the demo and GetIAMAI, wherever they are shown', () => {
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const strip = factsOf(ladder(f.snapshot, f.mapping, f.snapshot.asOf))
    const view = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    assert.deepEqual(strip, view.facts, `${name}: the tiles and MFA Readiness`)
    assert.equal(view.groups.ready, strip.rungs[5], `${name}: passkey-ready is rung 5, counted once`)
    assert.equal(view.groups.ready + view.groups.needsProof + view.groups.needsPasskey + view.groups.unknown, strip.active, `${name}: the groups and the rungs share one denominator`)
    assert.equal(RUNGS.reduce((n, r) => n + strip.rungs[r], 0), strip.active, `${name}: the five rungs sum to the active people`)
  }
  for (const r of RUNGS) assert.equal(readinessHref(`rung-${r}`), `#/readiness/rung-${r}`, 'each tile links to MFA Readiness filtered to its rung')
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

// Task 011 took the five tiles off the Plan; task 016 took them off Connect. A
// tenant-wide readiness diagnostic is not the rollout board's job and it is not
// the setup progression's either: Connect ends at the Plan, and MFA Readiness
// comes after it. The rungs themselves are untouched — MFA Readiness owns them.
test('no rollout surface draws the MFA readiness ladder; MFA Readiness owns the rungs', () => {
  for (const file of ['src/ui/surfaces/Plan.tsx', 'src/ui/surfaces/Connect.tsx']) {
    const src = readFileSync(file, 'utf8')
    assert.doesNotMatch(src, /LadderTiles|rung-tile|LadderHead/, `${file} renders no readiness tiles`)
    assert.doesNotMatch(src, /derive\/ladder\.ts/, `${file} reads no ladder`)
  }
  // The component the two surfaces shared is gone, and so are its rules: a dead
  // component is a second place for the rungs to come back from.
  assert.equal(existsSync('src/ui/surfaces/LadderTiles.tsx'), false, 'the tiles component was deleted with its last caller')
  assert.doesNotMatch(readFileSync('src/ui/app.css', 'utf8'), /\.rung-tiles|\.rung-tile\b/, 'the tiles left their rules behind')
  // MFA Readiness draws no ladder either (task 012): three counts over the same
  // rungs, and the rung itself as the badge in a person's row.
  const readiness = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')
  assert.doesNotMatch(readiness, /LadderTiles|LadderHead|className="ladder"/, 'the page counts the three groupings, not the five rungs')
  assert.match(readiness, /READINESS_GROUPS\.map/, 'the three counts')
  assert.match(readiness, /<RungBadge rung=\{r\.rung\} \/>/, 'and the rung is still the badge in a row')
})

// The evidence itself is untouched: Task 011 moved a presentation, and Task 012
// moves the operational one. A rung that no longer counts anybody would be a
// deletion dressed up as a layout change.
test('the person-level MFA evidence Today reads is intact', () => {
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const view = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    assert.ok(view.rows.length > 0, `${name}: Today still has a row per person`)
    assert.ok(view.rows.every((r) => typeof r.user.id === 'string' && r.evidence !== undefined), `${name}: every row still carries its account and what was seen of it`)
    assert.ok(view.rows.some((r) => r.active && r.rung !== null), `${name}: the rungs still land on people`)
    assert.ok(view.facts.active > 0, `${name}: the active count survives`)
  }
})
