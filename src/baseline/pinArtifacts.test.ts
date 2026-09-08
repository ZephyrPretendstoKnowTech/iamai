// Task 021 §11: a pin writes its snapshot and its index record together.
//
// The defect this guards was in the *generation* code, and the repository
// carried its result for as long as the two were written apart:
// baselines/*.pinned.json was at 8461e0f2 while baselines/*.index.json was still
// at ceccdc2a, because pin-baseline wrote the first and left the second. Task
// 022 re-pinned both through this path at 90d9b890; what is proved here is that
// no later pin can leave the pair disagreeing again — and, below, that no pin
// can happen at all except as the promotion of one named, wholly-read commit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { attributionFor, indexRecord, pinArtifacts, pinMismatch } from './pinArtifacts.ts'
import { acquisitionFailure, pinGeneration, targetCommit, writePin } from '../../scripts/pin-baseline.ts'
import type { Acquisition } from '../../scripts/pin-baseline.ts'
import type { LoadReport } from './types.ts'
import { PINNED } from './pinned.ts'

const shippedIndex = JSON.parse(readFileSync('baselines/jhope188-conditionalaccesspolicies.index.json', 'utf8')) as Record<string, unknown>

const NEXT = '90d9b890c4b9af2ac4bc02d97c06bf8900064b4c'
/** The commit the index record was stuck at while the pair was written apart. */
const STALE = 'ceccdc2a6dc2e4a3e1f960fc2d91f05c8963265b'
const STALE_SHA = '8461e0f2fd10167bf034e7c20ed8ea293827d890'

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

// ---- the promotion boundary (task 022 correction) ----
//
// A pin is the promotion of one version somebody reviewed and approved by name.
// Two ways that boundary was not held:
//
//  - the script defaulted its target to the author's current head, so a run with
//    no argument asked the author what was newest and adopted it. "Re-pin" and
//    "adopt whatever they have pushed since" were the same command, and the
//    review the approval exists for happened after the write.
//  - a raw-file fetch that did not come back was dropped on the floor, and the
//    discovery report's parse errors and skips were never read, so an incomplete
//    read became a pin that claimed the commit whole. Afterwards a policy that
//    failed to fetch reads as a policy the author deleted.

test('K. the commit to pin comes from the command line, and nothing else supplies one', () => {
  const HEAD = 'a'.repeat(40)
  assert.throws(() => targetCommit([], HEAD), /needs the commit to pin/, 'a run with no argument has nothing to promote')
  assert.throws(() => targetCommit(['90d9b890'], HEAD), /full 40-character/, 'an abbreviation is not the identity the artifacts claim')
  assert.throws(() => targetCommit(['not-a-sha-at-all'], HEAD), /full 40-character/)
  assert.throws(() => targetCommit([NEXT, 'b'.repeat(40)], HEAD), /pins one commit/)
  assert.deepEqual(targetCommit([NEXT], HEAD), { commit: NEXT, from: HEAD }, 'the argument is the target, and the diff base defaults to the pin we are on')
  assert.deepEqual(targetCommit([NEXT.toUpperCase()], HEAD).commit, NEXT, 'case is not identity')
  // --from moves only what the report is read against, never what is pinned.
  assert.deepEqual(targetCommit([NEXT, '--from', STALE_SHA], HEAD), { commit: NEXT, from: STALE_SHA })
  assert.deepEqual(targetCommit(['--from=' + STALE_SHA, NEXT], HEAD), { commit: NEXT, from: STALE_SHA })
  assert.throws(() => targetCommit([NEXT, '--from', 'ceccdc2a'], HEAD), /full 40-character/)
  assert.throws(() => targetCommit([NEXT, '--from'], HEAD), /--from needs a commit/)
})

test('K. the pin script asks the author what is newest for nothing that decides what is pinned', () => {
  const script = readFileSync('scripts/pin-baseline.ts', 'utf8')
  const main = script.slice(script.indexOf('async function main('))
  assert.doesNotMatch(main, /commits\?per_page/, 'the run resolves its own target from the author’s head')
  assert.match(script, /const \{ commit: target, from: oldCommit \} = targetCommit\(process\.argv/, 'the target is the validated argument')
})

const clean: LoadReport = { considered: 2, parsed: 2, skipped: [], errors: [], duplicates: [], warnings: [] }
const read = (over: Partial<Acquisition> = {}): Acquisition => ({ requested: ['Policies/a.json', 'Policies/b.json'], fetched: 2, parsed: 2, skipped: 0, duplicates: 0, errors: 0, failed: [], ...over })

test('K. a source that was not read whole is refused before either artifact is written', () => {
  assert.equal(acquisitionFailure(read(), clean), null, 'a complete read pins')
  assert.match(
    acquisitionFailure(read({ fetched: 1, failed: [{ path: 'Policies/b.json', why: 'HTTP 500' }] }), { ...clean, parsed: 1 }) ?? '',
    /did not come back.*Policies\/b\.json \(HTTP 500\)/s,
    'a file that did not come back',
  )
  assert.match(acquisitionFailure(read({ fetched: 1 }), { ...clean, parsed: 1 }) ?? '', /tree lists 2 policy file\(s\) and 1 were read/, 'a file that went missing without an error')
  assert.match(acquisitionFailure(read(), { ...clean, errors: [{ path: 'Policies/b.json', error: 'invalid JSON: x' }] }) ?? '', /could not be read.*invalid JSON/s, 'a file that would not parse')
  assert.match(acquisitionFailure(read(), { ...clean, skipped: [{ path: 'Policies/b.json', reason: 'no Conditional Access policy object found' }] }) ?? '', /held nothing this reader recognised/, 'a file this reader did not understand')
  assert.match(acquisitionFailure(read({ parsed: 0 }), { ...clean, parsed: 0 }) ?? '', /no policy was read/, 'a commit that yielded nothing')
  // A duplicate is a decision discoverPolicies made and reported, not a file it
  // could not read: the equivalent-copy rules stand and the pin proceeds.
  assert.equal(
    acquisitionFailure(read({ duplicates: 1, parsed: 3 }), { ...clean, parsed: 3, duplicates: [{ path: 'Policies/b.json', supersededBy: 'Policies/a.json', reason: 'same policy id p-1' }] }),
    null,
    'a superseded copy does not stop a pin',
  )
})

test('K. the shipped pin, index and report are one run’s output', () => {
  const pinnedFile = JSON.parse(readFileSync('baselines/jhope188-conditionalaccesspolicies.pinned.json', 'utf8')) as { commit: string; generatedAt: string }
  const report = readFileSync(`docs/baselines/jhope188-conditionalaccesspolicies/${pinnedFile.commit}.md`, 'utf8')
  assert.equal(shippedIndex.generatedAt, pinnedFile.generatedAt, 'the pair carries one generation time')
  assert.ok(report.includes(`Generated ${pinnedFile.generatedAt}.`), `the report is that run’s: ${report.split('\n')[2]}`)
  assert.match(report, /Source read: \d+ policy files listed, \d+ fetched, \d+ parsed, \d+ skipped, \d+ duplicate, \d+ error, \d+ unread/, 'and it says how the source was read')
})
