// Task 021 §11: a pin writes its snapshot and its index record together.
//
// The defect this guards was in the *generation* code, and the repository still
// carries its result: baselines/*.pinned.json is at 8461e0f2 and
// baselines/*.index.json is at ceccdc2a, because pin-baseline wrote the first
// and left the second. Nothing here changes those artifacts — the current pin is
// the owner's, and a re-pin is its own task. What is proved here is that the next
// authorized pin cannot leave the pair disagreeing again.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { attributionFor, indexRecord, pinArtifacts, pinMismatch } from './pinArtifacts.ts'
import { PINNED } from './pinned.ts'

const shippedIndex = JSON.parse(readFileSync('baselines/jhope188-conditionalaccesspolicies.index.json', 'utf8')) as Record<string, unknown>

const NEXT = '90d9b890c4b9af2ac4bc02d97c06bf8900064b4c'

const generate = (commit: string) =>
  pinArtifacts({
    previousIndex: shippedIndex,
    owner: 'Jhope188',
    repo: 'ConditionalAccessPolicies',
    label: 'Jon Hope — Defense in Depth',
    commit,
    generatedAt: '2026-09-07T00:00:00.000Z',
    files: ['Updated/Policies/b.json', 'Updated/Policies/a.json', 'readme.md'],
    policies: [{ id: 'x', displayName: 'X' }],
    stripped: [],
    goalMap: { 'mfa-all-users': ['x'] },
  })

test('J. one generation writes the snapshot and its index record at the same commit', () => {
  const { pinned, index } = generate(NEXT)
  assert.equal(pinned.commit, NEXT)
  assert.equal(index.commit, NEXT, 'the index record still names the previous pin')
  assert.equal(index.generatedAt, pinned.generatedAt)
  assert.equal(pinMismatch(pinned, index), null)
  // The attribution names the commit, so it is regenerated rather than carried.
  assert.equal(index.attribution, attributionFor('Jhope188', 'ConditionalAccessPolicies', NEXT))
  assert.equal((index.attribution ?? '').includes(String(shippedIndex.commit).slice(0, 7)), false, 'the previous commit survived in the attribution sentence')
  // The file allowlist is the new commit's, sorted, and the descriptive fields carry.
  assert.deepEqual(index.files, ['Updated/Policies/a.json', 'Updated/Policies/b.json', 'readme.md'])
  assert.equal(index.description, shippedIndex.description)
  assert.equal(index.goal, shippedIndex.goal)
  assert.deepEqual(index.tiers, shippedIndex.tiers)
})

test('J. a pair that disagrees is named, so a generation path cannot write one', () => {
  const { pinned, index } = generate(NEXT)
  assert.match(pinMismatch(pinned, { ...index, commit: String(shippedIndex.commit) }) ?? '', /is at 90d9b890.* and its index records ceccdc2a/)
  assert.match(pinMismatch(pinned, { ...index, attribution: attributionFor('Jhope188', 'ConditionalAccessPolicies', 'deadbeef0000') }) ?? '', /attribution names a commit other than/)
  // The shipped pair is exactly the disagreement this fix stops recurring; the
  // artifacts stay as the owner pinned them until a re-pin task changes them.
  assert.notEqual(PINNED.commit, shippedIndex.commit)
  assert.ok(pinMismatch(PINNED, shippedIndex as { commit: string }))
})

test('J. indexRecord is the one shape for an index record, whether a pin or a clone walk builds it', () => {
  const fresh = indexRecord({}, { owner: 'o', repo: 'r', commit: 'a'.repeat(40), label: 'L', generatedAt: 'now', files: ['x.json'] })
  assert.deepEqual(fresh, { owner: 'o', repo: 'r', commit: 'a'.repeat(40), label: 'L', generatedAt: 'now', files: ['x.json'], attribution: attributionFor('o', 'r', 'a'.repeat(40)) })
})
