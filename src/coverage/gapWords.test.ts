// Prompt 52, walk-51 item 17: a session gap reads in words, never the "168h"/"4h"
// abbreviation the contract forbids — "sessions expire weekly, baseline wants 4
// hours". The demo does not carry the admin-session gap, so this checks the
// gap builder directly and every fixture's rendered gaps.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gapSentenceOf } from './verdict.ts'
import { allFixtures } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'

test('a session gap reads in words, never 168h', () => {
  const r = { status: 'partial' as const, reasons: [{ kind: 'session-weaker' as const, current: 'expire every 168 hours', floor: 'sign-in every 4 hours at most' }], expectedCount: 5, reportOnlyIds: [], enforcedIds: [] }
  const g = gapSentenceOf(r as never)!
  assert.doesNotMatch(g, /\b\d+h\b/, `no hour abbreviation in "${g}"`)
  assert.match(g, /weekly/, '168 hours reads as weekly')
  assert.match(g, /4 hours/, '4 hours stays 4 hours')
  for (const f of allFixtures()) {
    for (const s of runFixture(f).steps) {
      if (typeof s.gap === 'string') assert.doesNotMatch(s.gap, /\b\d+h\b/, `${f.name} ${s.id}: "${s.gap}"`)
    }
  }
})
