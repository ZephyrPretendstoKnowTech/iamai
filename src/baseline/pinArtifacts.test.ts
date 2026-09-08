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
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { attributionFor, indexRecord, pinArtifacts, pinMismatch } from './pinArtifacts.ts'
import { pinGeneration, writePin } from '../../scripts/pin-baseline.ts'
import { PINNED } from './pinned.ts'

const shippedIndex = JSON.parse(readFileSync('baselines/jhope188-conditionalaccesspolicies.index.json', 'utf8')) as Record<string, unknown>

const NEXT = '90d9b890c4b9af2ac4bc02d97c06bf8900064b4c'
/** The commit the index record was stuck at while the pair was written apart. */
const STALE = 'ceccdc2a6dc2e4a3e1f960fc2d91f05c8963265b'

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
  assert.equal((index.attribution ?? '').includes(STALE.slice(0, 7)), false, 'the previous commit survived in the attribution sentence')
  // The file allowlist is the new commit's, sorted, and the descriptive fields carry.
  assert.deepEqual(index.files, ['Updated/Policies/a.json', 'Updated/Policies/b.json', 'readme.md'])
  assert.equal(index.description, shippedIndex.description)
  assert.equal(index.goal, shippedIndex.goal)
  assert.deepEqual(index.tiers, shippedIndex.tiers)
})

test('J. a pair that disagrees is named, so a generation path cannot write one', () => {
  const { pinned, index } = generate(NEXT)
  assert.match(pinMismatch(pinned, { ...index, commit: STALE }) ?? '', /is at 90d9b890.* and its index records ceccdc2a/)
  assert.match(pinMismatch(pinned, { ...index, attribution: attributionFor('Jhope188', 'ConditionalAccessPolicies', 'deadbeef0000') }) ?? '', /attribution names a commit other than/)
  // And the shipped pair, which carried exactly that disagreement until the
  // re-pin ran through this path, now names one commit.
  assert.equal(PINNED.commit, shippedIndex.commit)
  assert.equal(pinMismatch(PINNED, shippedIndex as { commit: string }), null)
})

test('J. indexRecord is the one shape for an index record, whether a pin or a clone walk builds it', () => {
  const fresh = indexRecord({}, { owner: 'o', repo: 'r', commit: 'a'.repeat(40), label: 'L', generatedAt: 'now', files: ['x.json'] })
  assert.deepEqual(fresh, { owner: 'o', repo: 'r', commit: 'a'.repeat(40), label: 'L', generatedAt: 'now', files: ['x.json'], attribution: attributionFor('o', 'r', 'a'.repeat(40)) })
})

// ---- the pin script's own path ----
//
// The helper above is only worth anything if the script that pins actually
// calls it. scripts/pin-baseline.ts used to hand-build the pinned object and
// write one file, which is how the shipped pair came to name two commits; these
// exercise the generation and write path that script now runs.

const GENERATED = '2026-09-07T00:00:00.000Z'

const scriptInput = (commit: string) => ({
  previousIndex: shippedIndex,
  owner: 'Jhope188',
  repo: 'ConditionalAccessPolicies',
  label: 'Jon Hope — Defense in Depth',
  commit,
  generatedAt: GENERATED,
  indexFiles: ['Updated/Policies/b.json', 'Updated/Policies/a.json', 'readme.md'],
  policies: [{ id: 'x', displayName: 'X', state: 'enabled', conditions: {}, grantControls: null, sessionControls: null, placeholders: {} }],
  stripped: ['one app exclusion'],
  goalMap: { 'mfa-all-users': ['x'] },
})

test('J. the pin script writes the snapshot and the index record, for one commit, in one run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'iamai-pin-'))
  try {
    const written = writePin(dir, 'test-baseline', pinGeneration(scriptInput(NEXT)))
    assert.deepEqual(readdirSync(dir).sort(), ['test-baseline.index.json', 'test-baseline.pinned.json'], 'a pin that writes one file is the defect')
    assert.equal(written.length, 2)
    const pinned = JSON.parse(readFileSync(`${dir}/test-baseline.pinned.json`, 'utf8')) as { commit: string; generatedAt: string; policies: unknown[]; stripped: string[] }
    const index = JSON.parse(readFileSync(`${dir}/test-baseline.index.json`, 'utf8')) as Record<string, unknown> & { commit: string }
    assert.equal(pinned.commit, NEXT)
    assert.equal(index.commit, NEXT, 'the index record was left at the previous pin')
    assert.equal(index.generatedAt, pinned.generatedAt)
    assert.equal(pinMismatch(pinned, index), null)
    assert.equal(index.attribution, attributionFor('Jhope188', 'ConditionalAccessPolicies', NEXT))
    assert.deepEqual(index.files, ['Updated/Policies/a.json', 'Updated/Policies/b.json', 'readme.md'])
    assert.equal(pinned.policies.length, 1)
    assert.deepEqual(pinned.stripped, ['one app exclusion'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('J. the script refuses a disagreeing pair, and writes neither file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'iamai-pin-'))
  try {
    const out = pinGeneration(scriptInput(NEXT))
    const stale = { pinned: out.pinned, index: { ...out.index, commit: STALE } }
    assert.throws(() => writePin(dir, 'test-baseline', stale), /disagree/)
    assert.deepEqual(readdirSync(dir), [], 'a rejected pin still put a file on disk')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('J. the pin script has one write path for its artifacts', () => {
  const script = readFileSync('scripts/pin-baseline.ts', 'utf8')
  assert.match(script, /const out = pinGeneration\(\{/, 'the script builds its artifacts through the shared generation path')
  assert.match(script, /writePin\('baselines', BASE, out\)/, 'and writes both through the one write path')
  assert.doesNotMatch(script, /writeFileSync\(`baselines\//, 'a second, hand-built write of a baselines/ artifact')
})
