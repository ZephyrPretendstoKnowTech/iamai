// Prompt 51 Unit 1: the runtime reads the pinned baseline from pinned.json with
// no network; the one network call is the author-head check that drives the
// Connect "Baseline updated" line.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadPinnedBaseline, checkAuthorHead, PINNED } from './baseline.ts'

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
