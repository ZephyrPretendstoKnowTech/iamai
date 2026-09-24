// Prompt 51 Part 3(e): the Cleanup rows are content-driven and present only when
// they have something to say (§5). This pins the presence rules, the render order
// and the fill lists, and checks every row's content key exists in content.cleanup
// (a missing key would be a build failure, not silent).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanupRows, namedEmergencyExclusions } from './cleanup.ts'
import type { CleanupInputs } from './cleanup.ts'
import { cleanup } from '../content/content.ts'

const FULL: CleanupInputs = {
  emergencyAccounts: ['Break Glass One', 'Break Glass Two'],
  renames: ['Old policy → Core - Block - Legacy authentication'],
  overlaps: ['Policy X, Policy Y'],
}

test('Cleanup rows are present only when they have something to say, in order, with their lists and their prose; the recovery row always remains', () => {
  // a full tenant renders all four Cleanup rows in order, each with its lists
  {
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
  }

  // the canonical recovery row remains when optional cleanup has nothing to say
  {
    const none = cleanupRows({ emergencyAccounts: [], renames: [], overlaps: [] })
    assert.deepEqual(none.map((r) => r.kind), ['drill'])
    assert.deepEqual(none[0].lists, { emergencyAccounts: [] })
  }

  // every Cleanup row has its prose in content.cleanup (no missing key)
  {
    for (const r of cleanupRows({ ...FULL, hardening: ['A deferred check'], namedExclusions: ['Policy A (ID: p-1): Break Glass One'] })) {
      const entry = (cleanup as Record<string, unknown>)[r.kind]
      assert.ok(entry, `content.cleanup is missing the "${r.kind}" entry`)
    }
  }
})

// A correction never removes an exclusion the tenant already has (owner,
// 2026-09-19), so an emergency account the tenant excluded by name stays named in
// the policy IAMAI corrects. The exclusions group is the one carve-out
// (CLAUDE.md), and this row is where the name comes out.
test('a policy that excludes an emergency account by name gets a Cleanup row naming it, and one that does not gets none', () => {
  const nameOf = (id: string): string => (id === 'bg-1' ? 'Break Glass One' : id === 'bg-2' ? 'Break Glass Two' : id)
  const policy = (over: Record<string, unknown>) => ({ id: 'p-1', displayName: 'Core - Grant - MFA for all users', state: 'enabled', conditions: { users: { includeUsers: ['All'], excludeUsers: ['BG-1'] } }, ...over })
  assert.deepEqual(namedEmergencyExclusions([policy({})], ['bg-1', 'bg-2'], nameOf), ['Core - Grant - MFA for all users (ID: p-1): Break Glass One'], 'the policy, its id and the account it names')
  assert.deepEqual(namedEmergencyExclusions([policy({ state: 'enabledForReportingButNotEnforced' })], ['bg-1'], nameOf).length, 1, 'a report-only policy still evaluates')
  assert.deepEqual(namedEmergencyExclusions([policy({ state: 'disabled' })], ['bg-1'], nameOf), [], 'a policy that is off evaluates nobody')
  assert.deepEqual(namedEmergencyExclusions([policy({ conditions: { users: { includeUsers: ['All'], excludeGroups: ['g-1'] } } })], ['bg-1'], nameOf), [], 'the group is not a name')
  assert.deepEqual(namedEmergencyExclusions(null, ['bg-1'], nameOf), [], 'a scan that did not read the policies lists none')
  // And the row is present only when there is one, in §5 order after hardening.
  assert.deepEqual(cleanupRows({ ...FULL, namedExclusions: [] }).some((r) => r.kind === 'namedExclusions'), false)
  assert.deepEqual(cleanupRows({ ...FULL, namedExclusions: ['Policy A (ID: p-1): Break Glass One'] }).map((r) => r.kind), ['alerting', 'drill', 'namedExclusions', 'naming', 'consolidation'])
})
