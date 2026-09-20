// Prompt 51 Part 3(e): the Cleanup rows are content-driven and present only when
// they have something to say (§5). This pins the presence rules, the render order
// and the fill lists, and checks every row's content key exists in content.cleanup
// (a missing key would be a build failure, not silent).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanupRows } from './cleanup.ts'
import type { CleanupInputs } from './cleanup.ts'
import { cleanup } from '../content/content.ts'
import { readFileSync } from 'node:fs'

const FULL: CleanupInputs = {
  emergencyAccounts: ['Break Glass One', 'Break Glass Two'],
  renames: ['Old policy → Core - Block - Legacy authentication'],
  overlaps: ['Policy X, Policy Y'],
}

test('a full tenant renders all four Cleanup rows in order, each with its lists', () => {
  const rows = cleanupRows(FULL)
  assert.deepEqual(rows.map((r) => r.kind), ['alerting', 'drill', 'naming', 'consolidation'])
  assert.deepEqual(rows[0].lists, { emergencyAccountUpns: FULL.emergencyAccounts })
  assert.deepEqual(rows[2].lists, { renames: FULL.renames })
  assert.deepEqual(rows[3].lists, { overlaps: FULL.overlaps })
  // The baseline policies IAMAI did not assess are the s-review-baseline- steps
  // and nothing else: this module has no row and no input for them
  // (docs/plans/step-redundancy-analysis.md finding 8).
  assert.equal(rows.some((r) => (r.kind as string) === 'notAssessed'), false)
  assert.equal('notAssessed' in FULL, false)
})

test('the canonical recovery row remains when optional cleanup has nothing to say', () => {
  const none = cleanupRows({ emergencyAccounts: [], renames: [], overlaps: [] })
  assert.deepEqual(none.map((r) => r.kind), ['drill'])
  assert.deepEqual(none[0].lists, { emergencyAccounts: [] })
})

test('the baseline policies IAMAI did not assess have one source, and it is not a Cleanup row', () => {
  // generate.ts builds one s-review-baseline- step per policy from
  // coverage.organisation.notAssessed. The Cleanup row said the same list again
  // and was disabled by being handed an empty array; both the row and the
  // blanking are gone (docs/plans/step-redundancy-analysis.md finding 8).
  assert.equal('notAssessed' in (cleanup as Record<string, unknown>), false, 'the words came back')
  assert.equal(readFileSync('src/roadmap/generate.ts', 'utf8').includes('notAssessed: []'), false, 'the engine still blanks the input instead of having no row')
  assert.equal(readFileSync('src/roadmap/stepGroups.ts', 'utf8').includes('cleanup-notAssessed'), false, 'the registry still lists the row')
})

test('every Cleanup row has its prose in content.cleanup (no missing key)', () => {
  for (const r of cleanupRows(FULL)) {
    const entry = (cleanup as Record<string, unknown>)[r.kind]
    assert.ok(entry, `content.cleanup is missing the "${r.kind}" entry`)
  }
})
