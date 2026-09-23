// Run by laneBStream.test.ts in a child process with a small heap
// (--max-old-space-size): the real runLaneB over 311,040 synthetic sign-ins
// with nothing saved. Holding the mapped records would take several hundred
// MB, so the read finishing at all says it held none. Prints what it held.
// With the argument `passkey`, every sign-in is a passkey sign-in: the tenant
// the product sends people toward, where each one is a recovery candidate.
import { runLaneB } from '../graph/collect/signInStream.ts'
import { discardStore } from './memoryEvidenceStore.ts'
import { fakeGraph } from './signInSynth.ts'

const passkey = process.argv[2] === 'passkey'
const now = Date.parse('2026-09-01T00:00:00Z')
const fake = fakeGraph({
  seed: 7,
  anchorMs: now,
  nowMs: now,
  variant: passkey
    ? (_k, raw) => {
        raw.status = { errorCode: 0 }
        raw.authenticationDetails = [{ authenticationMethod: 'Passkey (device-bound)', succeeded: true, authenticationStepDateTime: raw.createdDateTime, authenticationStepResultDetail: 'MFA successfully completed' }]
      }
    : undefined,
})
const result = await runLaneB({ pageUrl: fake.pageUrl, windowDays: 30, nowMs: now, clock: () => 0, fetchPage: fake.fetchPage, store: discardStore() })
const lists = Object.values(result.perUser).map((u) => u.recoveryCandidates?.length ?? 0)
console.log(JSON.stringify({ status: result.status, rows: result.rows, maxResidentRows: result.stats?.maxResidentRows ?? null, people: lists.length, candidates: lists.reduce((a, b) => a + b, 0), mostPerPerson: Math.max(0, ...lists) }))
