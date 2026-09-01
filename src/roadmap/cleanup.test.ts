// Prompt 51 Part 3(e): the Cleanup rows are content-driven and present only when
// they have something to say (§5). This pins the presence rules, the render order
// and the fill lists, and checks every row's content key exists in content.cleanup
// (a missing key would be a build failure, not silent).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanupRows } from './cleanup.ts'
import type { CleanupInputs } from './cleanup.ts'
import { cleanup } from '../content/content.ts'

const FULL: CleanupInputs = {
  emergencyAccounts: ['Break Glass One', 'Break Glass Two'],
  renames: ['Old policy → Core - Block - Legacy authentication'],
  overlaps: ['Policy X, Policy Y'],
  notAssessed: ['IAC - GLOBAL - GRANT - BreakGlass - TrustedLocations'],
}

test('a full tenant renders all five Cleanup rows in order, each with its lists', () => {
  const rows = cleanupRows(FULL)
  assert.deepEqual(rows.map((r) => r.kind), ['alerting', 'drill', 'naming', 'consolidation', 'notAssessed'])
  assert.deepEqual(rows[0].lists, { emergencyAccountUpns: FULL.emergencyAccounts })
  assert.deepEqual(rows[2].lists, { renames: FULL.renames })
  assert.deepEqual(rows[4].lists, { policies: FULL.notAssessed })
})

test('a row with nothing to say does not render', () => {
  const none = cleanupRows({ emergencyAccounts: [], renames: [], overlaps: [], notAssessed: [] })
  assert.deepEqual(none, [], 'an empty Cleanup renders no rows, and the phase does not render (§5)')

  const onlyNotAssessed = cleanupRows({ emergencyAccounts: [], renames: [], overlaps: [], notAssessed: ['A policy'] })
  assert.deepEqual(onlyNotAssessed.map((r) => r.kind), ['notAssessed'])
})

test('every Cleanup row has its prose in content.cleanup (no missing key)', () => {
  for (const r of cleanupRows(FULL)) {
    const entry = (cleanup as Record<string, unknown>)[r.kind]
    assert.ok(entry, `content.cleanup is missing the "${r.kind}" entry`)
  }
})
