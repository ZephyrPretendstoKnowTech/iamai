// One fact, one function (derive/facts.ts): every surface's numbers are the
// facts, identical on both fixtures, and no surface computes a count of its
// own; the emergency accounts are recognised on every scan through the
// population's mapping (pickerRows.ts appliedMapping), so a re-scan never
// loses the kind.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { facts, factsOf, stepFacts } from './facts.ts'
import { KINDS, RUNGS, ladder } from './ladder.ts'
import { todayView } from './today.ts'
import { contentLists } from './contentLists.ts'
import { demoFacts } from '../ui/demoFacts.ts'
import { appliedMapping } from '../ui/surfaces/pickerRows.ts'
import { emptyMappingState } from '../mapping/types.ts'

test("every surface's facts are identical on both fixtures: Today, the ladder, the campaign step and the sample facts read one function", () => {
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const F = facts(f.snapshot, f.mapping)
    assert.equal(F.accounts, f.snapshot.users.length, `${name}: every account once`)
    assert.equal(F.accounts, F.active + F.notActive + KINDS.reduce((n, k) => n + F.kinds[k], 0), `${name}: the parts sum to the accounts`)
    assert.equal(F.active, RUNGS.reduce((n, r) => n + F.rungs[r], 0), `${name}: the rungs sum to the active people`)
    assert.deepEqual(todayView(f.snapshot, f.snapshot.asOf, f.mapping).facts, F, `${name}: Today's ledger and rungs`)
    assert.deepEqual(factsOf(ladder(f.snapshot, f.mapping, f.snapshot.asOf)), F, `${name}: the Plan strip and Connect's tile`)
    const cl = contentLists({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, now: f.snapshot.asOf })
    assert.deepEqual({ 1: cl.noMethod.length, 2: cl.unproven.length, 3: cl.rung3.length, 4: cl.rung4.length }, { 1: F.rungs[1], 2: F.rungs[2], 3: F.rungs[3], 4: F.rungs[4] }, `${name}: the campaign step's groups`)
    const run = runFixture(f)
    const sf = stepFacts(run.steps, run.schedule.cleanup)
    assert.ok(sf.steps > 0 && sf.done <= sf.steps, `${name}: the plan's steps and done`)
  }
  const d = fixture('demo')
  assert.equal(demoFacts().people, facts(d.snapshot, d.mapping).active, "the sample facts on the signed-out Connect are the demo's active people")
})

test('no surface computes a count: the three surfaces, the print, the sample facts and the campaign lists read derive/facts.ts', () => {
  const surfaces = ['src/ui/surfaces/Today.tsx', 'src/ui/surfaces/Plan.tsx', 'src/ui/surfaces/Connect.tsx', 'src/ui/surfaces/LadderTiles.tsx', 'src/ui/surfaces/PrintPlan.tsx', 'src/ui/surfaces/Export.tsx', 'src/ui/demoFacts.ts']
  for (const file of surfaces) {
    const src = readFileSync(file, 'utf8')
    assert.ok(/derive\/facts\.ts/.test(src) || file.endsWith('LadderTiles.tsx') || file.endsWith('Today.tsx'), `${file} reads derive/facts.ts`)
    assert.doesNotMatch(src, /ladderCounts|peopleCounts|planCounts|rolloutBucket|activePeopleIds|campaignIdsFor/, `${file} computes no count of its own`)
  }
  assert.doesNotMatch(readFileSync('src/ui/surfaces/Today.tsx', 'utf8'), /ladder\(|\.rungs\[r\]\.length/, 'Today reads the facts, never the ladder')
  assert.match(readFileSync('src/derive/contentLists.ts', 'utf8'), /ladder\(snapshot, mapping, now\)/, 'the campaign lists are the ladder\'s rungs')
  assert.doesNotMatch(readFileSync('src/derive/planHeader.ts', 'utf8'), /planCounts/, 'the header has no count of its own')
})

test('the emergency accounts are recognised on every scan: after a simulated re-scan with nothing saved, the emergency kind survives', () => {
  const f = fixture('demo')
  const stored = emptyMappingState(f.snapshot.tenantId)
  const applied = (snapshot: typeof f.snapshot) => appliedMapping({ snapshot, mapping: stored, nameOf: (id) => id, now: snapshot.asOf }, null)
  const first = applied(f.snapshot)
  assert.ok(first.breakGlassUserIds.length > 0, 'the scan detects the emergency accounts with nothing saved')
  const before = facts(f.snapshot, first)
  assert.equal(before.kinds.emergency, first.breakGlassUserIds.length)
  // The re-scan: the same tenant a day later, the stored mapping still empty.
  const rescan = structuredClone(f.snapshot)
  rescan.asOf = new Date(Date.parse(f.snapshot.asOf) + 86_400_000).toISOString()
  const second = applied(rescan)
  assert.deepEqual([...second.breakGlassUserIds].sort(), [...first.breakGlassUserIds].sort(), 'the same accounts are recognised')
  const after = facts(rescan, second)
  assert.equal(after.kinds.emergency, before.kinds.emergency, 'the emergency kind survives the re-scan')
  for (const id of second.breakGlassUserIds) {
    const row = todayView(rescan, rescan.asOf, second).rows.find((r) => r.user.id === id)!
    assert.equal(row.kind, 'emergency', `${id} is listed as emergency access after the re-scan`)
  }
  // The stored record alone would have counted them as people: the population is the applied mapping's.
  assert.ok(facts(rescan, stored).kinds.emergency < after.kinds.emergency, 'the applied mapping, never the stored record alone, is the population')
})
