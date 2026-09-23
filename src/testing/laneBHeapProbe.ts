// Run by laneBStream.test.ts in a child process with a small heap
// (--max-old-space-size): the real runLaneB over 311,040 synthetic sign-ins
// with nothing saved. Holding the mapped records would take several hundred
// MB, so the read finishing at all says it held none. Prints what it held.
import { runLaneB } from '../graph/collect/signInStream.ts'
import { discardStore } from './memoryEvidenceStore.ts'
import { fakeGraph } from './signInSynth.ts'

const now = Date.parse('2026-09-01T00:00:00Z')
const fake = fakeGraph({ seed: 7, anchorMs: now, nowMs: now })
const result = await runLaneB({ pageUrl: fake.pageUrl, windowDays: 30, nowMs: now, clock: () => 0, fetchPage: fake.fetchPage, store: discardStore() })
console.log(JSON.stringify({ status: result.status, rows: result.rows, maxResidentRows: result.stats?.maxResidentRows ?? null }))
