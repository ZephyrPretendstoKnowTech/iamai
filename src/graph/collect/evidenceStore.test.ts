// The saved sign-in records (cache.ts evidenceStore): the batching rule the
// streaming read depends on, and the store's promise that a device without
// IndexedDB degrades to no saved records, never to a failed scan. Node has no
// IndexedDB (structuralCorrections.test.ts), so the store's own requests run in
// the browser smoke (scripts/smoke.mjs: the version 8 index, and Forget this
// tenant deleting one tenant's records by key range).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readInTimeBatches } from './timeBatches.ts'
import { evidenceStore } from './cache.ts'
import { CACHE_READ_BATCH } from './constants.ts'
import { newestFirst, rangeCursor } from '../../testing/memoryEvidenceStore.ts'
import type { StoredSignIn } from './types.ts'

const at = (s: number) => new Date(Date.parse('2026-09-01T00:00:00Z') - s * 1000).toISOString().replace('.000Z', 'Z')

/** 2,500 records in runs of one to seven sharing a second, and one run of 1,500 in a single second. */
function saved(): StoredSignIn[] {
  const rows: StoredSignIn[] = []
  let second = 0
  let n = 0
  while (rows.length < 2_500) {
    const run = 1 + ((second * 7919) % 7)
    for (let i = 0; i < run; i++) rows.push({ id: `row-${String((n++ * 104729) % 100_000).padStart(5, '0')}`, createdDateTime: at(second), userId: 'u' })
    second += 1 + (second % 3)
  }
  for (let i = 0; i < 1_500; i++) rows.push({ id: `burst-${String(i).padStart(4, '0')}`, createdDateTime: at(second + 5), userId: 'u' })
  return rows
}

async function readAll(rows: StoredSignIn[], from: string, to: string, size: number) {
  const sorted = newestFirst(rows)
  const opened: (string | null)[] = []
  const batches: StoredSignIn[][] = []
  await readInTimeBatches(async (upper) => {
    opened.push(upper)
    return rangeCursor(sorted, from, to, upper)
  }, size, (batch) => batches.push(batch))
  return { batches, opened, expected: sorted.filter((r) => r.createdDateTime >= from && r.createdDateTime <= to) }
}

test('the saved records come back newest first, each once, in batches that never split a second', async () => {
  const rows = saved()
  const times = rows.map((r) => r.createdDateTime).sort()
  const { batches, expected } = await readAll(rows, times[0], times[times.length - 1], CACHE_READ_BATCH)
  assert.deepEqual(batches.flat().map((r) => r.id), expected.map((r) => r.id), 'every record once, in the index order read backwards')
  assert.equal(batches.flat().length, rows.length)
  const perSecond = new Map<string, number>()
  for (const r of rows) perSecond.set(r.createdDateTime, (perSecond.get(r.createdDateTime) ?? 0) + 1)
  const largestSecond = Math.max(...perSecond.values())
  for (const [i, batch] of batches.entries()) {
    assert.ok(batch.length <= Math.max(CACHE_READ_BATCH + largestSecond - 1, largestSecond), `batch ${i} holds ${batch.length}`)
    const next = batches[i + 1]
    if (next) assert.notEqual(batch[batch.length - 1].createdDateTime, next[0].createdDateTime, `batch ${i} does not split a second`)
  }
  assert.equal(batches.filter((b) => b.some((r) => r.id.startsWith('burst-'))).length, 1, 'a second larger than a batch stays whole, in one batch')
})

test('both ends of the range are inclusive, and a later batch opens strictly below the last second taken', async () => {
  const rows = saved()
  const times = [...new Set(rows.map((r) => r.createdDateTime))].sort()
  const from = times[10]
  const to = times[times.length - 10]
  const { batches, opened, expected } = await readAll(rows, from, to, 50)
  const read = batches.flat()
  assert.deepEqual(read.map((r) => r.id), expected.map((r) => r.id))
  assert.ok(read.some((r) => r.createdDateTime === from) && read.some((r) => r.createdDateTime === to), 'both end seconds are read')
  assert.equal(opened[0], null)
  for (const [i, upper] of opened.slice(1).entries()) assert.equal(upper, batches[i][batches[i].length - 1].createdDateTime)
})

test('an empty range reads no batch', async () => {
  const { batches } = await readAll(saved(), '2030-01-01T00:00:00Z', '2030-01-02T00:00:00Z', CACHE_READ_BATCH)
  assert.deepEqual(batches, [])
})

test('without IndexedDB the store degrades to no saved records, never to a failed scan', async () => {
  // The worker and the page both open the store; Node has none, which is the case under test.
  assert.equal(typeof (globalThis as { indexedDB?: unknown }).indexedDB, 'undefined')
  const store = evidenceStore('tenant-a', 10)
  assert.equal(await store.meta(), null)
  assert.equal(await store.write([{ id: 'r', createdDateTime: at(1), userId: 'u' }], { from: at(10), to: at(0) }), false)
  assert.equal(await store.reset(), false)
  await store.expire(at(100))
  await assert.rejects(store.read({ from: at(10), to: at(0) }, () => {}), 'a failed read is reported, so the scan reads Graph instead')
  const aborted = new AbortController()
  aborted.abort()
  assert.equal(await evidenceStore('tenant-a', 10, aborted.signal).write([], { from: at(10), to: at(0) }), false, 'a cancelled scan writes nothing')
})
