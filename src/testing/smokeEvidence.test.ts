// The smoke's evidence for a page that never drew, and the deadline on its
// DevTools calls (scripts/smokeEvidence.mjs). CI's smoke found no Plan at #/plan
// on some runs and printed only "main=(no main)"; on another it waited on an
// unanswered call until the job was cancelled, and the log ended at the last
// check that passed. These are what it prints and how long it waits now.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CDP_DEADLINE_MS, pageEvidence, withDeadline } from '../../scripts/smokeEvidence.mjs'

test('a DevTools call that is never answered fails with its name, inside the job limit', async () => {
  const never = new Promise<never>(() => {})
  await assert.rejects(withDeadline(never, 20, 'DevTools Runtime.evaluate'), /^Error: DevTools Runtime\.evaluate did not answer within 0 s$/)
  // The job's own limit is 15 minutes; a call waits a minute at most.
  assert.ok(CDP_DEADLINE_MS <= 60_000 && CDP_DEADLINE_MS >= 10_000, String(CDP_DEADLINE_MS))
})

test('an answered call passes its answer through, and its timer does not hold the process', async () => {
  assert.deepEqual(await withDeadline(Promise.resolve({ id: 1 }), 60_000, 'DevTools Page.navigate'), { id: 1 })
  await assert.rejects(withDeadline(Promise.reject(new Error('socket closed')), 60_000, 'x'), /socket closed/)
})

test('the evidence names what the page said, what it threw, what failed to load, the navigation and the dev server', () => {
  const out = pageEvidence({
    body: `  IAMAI\n\n  ${'x'.repeat(500)}`,
    pageErrors: ['one', 'two', 'three', 'four', 'five', 'six', 'TypeError: Cannot read properties of undefined\n  at Plan (Plan.tsx:1:1)'],
    logErrors: ['Failed to load resource: the server responded with a status of 504 (Outdated Optimize Dep) http://localhost:5199/planner/node_modules/.vite/deps/react.js?v=1'],
    navigation: { url: 'http://localhost:5199/?dev=1&mock=1#/plan', errorText: null },
    viteTail: '1:05:07 PM [vite] ✨ optimized dependencies changed. reloading\n\n',
  })
  // The page's text, whitespace collapsed and cut at 400 characters.
  assert.match(out, /--- page text \(first 400 characters\) ---\n {2}IAMAI x{394}\n/)
  // The last six page errors of seven, the count of all of them.
  assert.match(out, /--- page errors \(7\) ---\n {2}two\n/)
  assert.doesNotMatch(out, /\n {2}one\n/)
  assert.match(out, /\n {2}TypeError: Cannot read properties of undefined\n {4}at Plan \(Plan\.tsx:1:1\)\n/)
  assert.match(out, /--- browser load errors \(1\) ---\n {2}Failed to load resource: .*504/)
  assert.match(out, /--- last navigation ---\n {2}http:\/\/localhost:5199\/\?dev=1&mock=1#\/plan -> committed/)
  assert.match(out, /--- dev server ---\n {2}.*optimized dependencies changed\. reloading$/)
})

test('an empty page, no errors and no navigation read as such; a null body leaves the page text out', () => {
  const empty = pageEvidence({ body: '', pageErrors: [], logErrors: [], navigation: { url: 'u', errorText: 'net::ERR_CONNECTION_REFUSED' }, viteTail: '' })
  assert.match(empty, /--- page text \(first 400 characters\) ---\n {2}\(empty\)/)
  assert.match(empty, /--- page errors \(0\) ---\n {2}\(none\)/)
  assert.match(empty, /--- last navigation ---\n {2}u -> net::ERR_CONNECTION_REFUSED/)
  assert.match(empty, /--- dev server ---\n {2}\(none\)$/)
  const end = pageEvidence({ body: null, pageErrors: [], logErrors: [], navigation: null, viteTail: 'ready' })
  assert.doesNotMatch(end, /page text/)
  assert.match(end, /--- last navigation ---\n {2}\(none\)/)
})
