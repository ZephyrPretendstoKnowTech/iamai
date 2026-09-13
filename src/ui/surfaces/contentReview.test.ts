// Content review S0 (docs/content-review/specs/UNIVERSAL-CONTENT-CHANGES.md):
// one test per renderer fix, UI polish item and resolved decision, each
// asserting what the opened step now shows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { CONTRACT, railOf, readinessLeadOf } from './stepContract.ts'
import type { StepContract } from './stepContract.ts'
import { WHEN, prerequisiteLabelFor } from './planBoard.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { SNAPSHOT_DIR } from '../../testing/stepSnapshots.ts'

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
    assert.equal(WHEN.none, '—')
    assert.equal(railOf(c).metric, '—', `${lane.label}: the milestone repeats the lane`)
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

test('R3: a prerequisite tile reads In progress, Completed or Waiting, never Ready', () => {
  const readings = new Map((['Ready', 'Up Next', 'On Hold', 'Completed'] as const).map((lane) => [lane, { lane }])) as unknown as Parameters<typeof prerequisiteLabelFor>[0]
  const label = prerequisiteLabelFor(readings)
  assert.equal(label('Ready'), 'Prerequisite · In progress')
  assert.equal(label('Completed'), 'Prerequisite · Completed')
  assert.equal(label('Up Next'), 'Prerequisite · Waiting')
  assert.equal(label('On Hold'), 'Prerequisite · Waiting')
  assert.equal(label('unknown'), null)
  // Every opened step on every fixture draws the new words.
  let prerequisites = 0
  for (const { where, s } of snapshots()) {
    for (const t of s.tiles.filter((t) => t.label.startsWith('Prerequisite · '))) {
      assert.match(t.label, /^Prerequisite · (In progress|Completed|Waiting|Deferred)$/, `${where}: a prerequisite tile reads "${t.label}"`)
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

test('R5: a step with nothing unresolved reads "✓ Clear — No blockers. Ready to proceed."', () => {
  const tiles = CONTRACT.readiness.tiles as Record<string, string>
  assert.equal(tiles.clear, 'Clear')
  assert.equal(tiles.clearNote, 'No blockers. Ready to proceed.')
  const src = readFileSync('src/ui/surfaces/StepSections.tsx', 'utf8')
  assert.match(src, /<strong>\{W\.tiles\.clear\}<\/strong>\s*<span>\{W\.tiles\.clearNote\}<\/span>/, 'the clear line does not read the content key')
  assert.equal(readFileSync('docs/design/content.json', 'utf8').includes('Nothing outstanding changes the next action'), false, 'the engineer-speak is still in content')
})
