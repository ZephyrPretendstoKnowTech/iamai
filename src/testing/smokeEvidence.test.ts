// The deadline on the smoke's DevTools calls (scripts/smokeEvidence.mjs). On one
// CI run the smoke waited on an unanswered call until the job was cancelled, and
// the log ended at the last check that passed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CDP_DEADLINE_MS, withDeadline } from '../../scripts/smokeEvidence.mjs'

test('a DevTools call that is never answered fails with its name inside the job limit; an answered one passes through', async () => {
  const never = new Promise<never>(() => {})
  await assert.rejects(withDeadline(never, 20, 'DevTools Runtime.evaluate'), /^Error: DevTools Runtime\.evaluate did not answer within 0 s$/)
  // The job's own limit is 15 minutes; a call waits a minute at most.
  assert.ok(CDP_DEADLINE_MS <= 60_000 && CDP_DEADLINE_MS >= 10_000, String(CDP_DEADLINE_MS))
  // An answered call passes its answer through, and its timer does not hold the process.
  assert.deepEqual(await withDeadline(Promise.resolve({ id: 1 }), 60_000, 'DevTools Page.navigate'), { id: 1 })
  await assert.rejects(withDeadline(Promise.reject(new Error('socket closed')), 60_000, 'x'), /socket closed/)
})
