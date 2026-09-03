// Prompt 51 Unit 1: the runtime reads the pinned baseline from pinned.json with
// no network; the one network call is the author-head check that drives the
// Connect "Baseline updated" line.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadPinnedBaseline, checkAuthorHead, restoreBaseline, PINNED } from './baseline.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { demoTenant } from './demo.ts'

test('one policy count, from the pinned package: signed out (the pinned load) and signed in (a restore, whatever file list the record kept) agree', async () => {
  const pinned = await loadPinnedBaseline()
  assert.equal(pinned.pkg.policies.length, PINNED.policies.length)
  assert.equal(pinnedPackage().policies.length, PINNED.policies.length)
  // A record from before the pin kept the repository's files (many more than the pin holds); the restore reads the pin, not them.
  const stale = Array.from({ length: 46 }, (_, i) => ({ path: `Policies/stale-${i}.json`, text: JSON.stringify({ id: `stale-${i}`, displayName: `Stale ${i}`, state: 'enabled', conditions: {}, grantControls: null, sessionControls: null }) }))
  const restored = await restoreBaseline({ kind: 'github', owner: 'x', repo: 'y', commit: PINNED.commit, files: stale })
  assert.equal(restored.pkg.policies.length, PINNED.policies.length)
  assert.equal(restored.source, pinned.source)
})

test('the count reconciles with the not-assessed Cleanup row on the demo: count − assessed = not assessed', () => {
  const f = fixture('demo')
  const d = demoTenant(false)
  const run = runFixture({ ...f, snapshot: d.snapshot, mapping: d.mapping })
  const count = f.baseline.policies.length
  assert.equal(count, PINNED.policies.length, 'the demo runs on the pinned package')
  const assessed = new Set(run.coverage.assessed).size
  const notAssessed = run.coverage.organisation.notAssessed.length
  const row = run.schedule.cleanup?.rows.find((r) => r.kind === 'notAssessed')
  assert.ok(row, 'the demo has a not-assessed Cleanup row')
  assert.equal(row.lists?.policies?.length, notAssessed, 'the row lists what coverage did not assess')
  assert.equal(count - assessed, notAssessed, `${count} policies − ${assessed} assessed = ${notAssessed} not assessed`)
})

test('the pinned baseline loads offline from pinned.json, at its commit', async () => {
  const r = await loadPinnedBaseline()
  assert.equal(r.fetchFailures, 0)
  assert.equal(r.origin.kind, 'github')
  if (r.origin.kind === 'github') assert.equal(r.origin.commit, PINNED.commit)
  assert.ok(r.pkg.policies.length >= 30, `expected the pinned policy set, got ${r.pkg.policies.length}`)
})

test('checkAuthorHead: a differing head is an update, a matching head is not, a failure is not', async () => {
  const differ = await checkAuthorHead(async () => new Response(JSON.stringify([{ sha: 'newsha', commit: { author: { date: '2026-09-01T00:00:00Z' } } }]), { status: 200 }))
  assert.equal(differ.updated, true)
  assert.equal(differ.head, 'newsha')
  assert.equal(differ.date, '2026-09-01T00:00:00Z')

  const same = await checkAuthorHead(async () => new Response(JSON.stringify([{ sha: PINNED.commit }]), { status: 200 }))
  assert.equal(same.updated, false)

  const failed = await checkAuthorHead(async () => {
    throw new Error('offline')
  })
  assert.equal(failed.updated, false)
  assert.equal(failed.head, null)
})
