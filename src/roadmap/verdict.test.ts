// The readiness verdict (observation-and-readiness.md §2, prompt 42 Part 2).
//
// The property that matters most here is the one the design doc had backwards
// until this prompt: a person who has not signed in for a month never blocks a
// verdict. They are named in it. Requiring a sign-in from every active affected
// user made the 3-day window unreachable by construction, so the user waited
// anyway — the abandonment the short window exists to prevent.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RECENT_WINDOW_DAYS, coverage, requiredDays, verdictFor } from './verdict.ts'
import type { Step } from './types.ts'

const NOW = '2026-09-30T00:00:00.000Z'
const daysAgo = (n: number): string => new Date(Date.parse(NOW) - n * 86_400_000).toISOString()

const snapshot = (evidence: Record<string, { lastSignIn: string | null }>) =>
  ({ signInEvidence: Object.fromEntries(Object.entries(evidence).map(([k, v]) => [k, { signInCount: 1, lastSignIn: v.lastSignIn, lastMfaSuccess: null }])) }) as never

function step(over: Partial<Step> & { id: string }): Step {
  const ids = over.population?.ids ?? ['u0', 'u1']
  return {
    id: over.id,
    goalId: over.id,
    status: 'in-report-only',
    kind: 'create',
    readiness: { family: 'mfa', percent: 100, lines: [] },
    evidence: { status: 'ok', lines: [], affectedUserIds: [], reportOnly: null },
    population: { total: ids.length, active: ids.length, admins: 0, guests: 0, ids },
    tracking: { daysInReportOnly: 7, signIns: 20, failures: 0, interruptions: 0, failuresByUser: [], evidenceQuality: 'enough' },
    ...over,
  } as Step
}

test('a 7-day window that has run clean is Ready', () => {
  const s = step({ id: 'a' })
  const v = verdictFor(s, snapshot({ u0: { lastSignIn: daysAgo(1) }, u1: { lastSignIn: daysAgo(2) } }), NOW, null)!
  assert.equal(v.kind, 'ready')
  assert.equal(v.days.required, 7)
  assert.equal(v.unseen.length, 0)
})

test('three days and two sign-ins is Not enough evidence, and never reads as ready (item 8)', () => {
  const s = step({ id: 'b', tracking: { daysInReportOnly: 3, signIns: 2, failures: 0, interruptions: 0, failuresByUser: [], evidenceQuality: 'thin' } } as Partial<Step> & { id: string })
  const v = verdictFor(s, snapshot({ u0: { lastSignIn: daysAgo(1) }, u1: { lastSignIn: daysAgo(1) } }), NOW, null)!
  assert.equal(v.kind, 'notEnough')
  assert.notEqual(v.kind, 'ready')
  assert.match(v.reason, /4 days left to run/)
})

test('a quiet person never blocks the verdict; they are named in it', () => {
  // u1 has not signed in for 60 days. Under the old bar this step could never
  // reach Ready, whatever the evidence showed about everyone else.
  const s = step({ id: 'c', tracking: { daysInReportOnly: 7, signIns: 20, failures: 0, interruptions: 0, failuresByUser: [], evidenceQuality: 'enough' } } as Partial<Step> & { id: string })
  const snap = snapshot({ u0: { lastSignIn: daysAgo(1) }, u1: { lastSignIn: daysAgo(60) } })
  const v = verdictFor(s, snap, NOW, null)!
  assert.equal(v.kind, 'ready', 'the quiet person does not block it')
  assert.deepEqual(
    v.unseen.map((u) => u.userId),
    ['u1'],
    'the quiet person is named',
  )
  assert.match(v.reason, /cannot speak for one person/)
  assert.equal(v.covered.expected, 1, 'only the recently active person is expected to appear')
})

test('someone with no sign-in record at all is unseen, not expected', () => {
  const s = step({ id: 'd' })
  const { expected, unseen } = coverage(s, snapshot({ u0: { lastSignIn: daysAgo(2) } }), NOW)
  assert.deepEqual(expected, ['u0'])
  assert.deepEqual(
    unseen.map((u) => [u.userId, u.lastSignIn]),
    [['u1', null]],
  )
})

test('the recency boundary is exactly RECENT_WINDOW_DAYS', () => {
  const s = step({ id: 'e', population: { total: 2, active: 2, admins: 0, guests: 0, ids: ['inside', 'outside'] } } as Partial<Step> & { id: string })
  const snap = snapshot({ inside: { lastSignIn: daysAgo(RECENT_WINDOW_DAYS - 1) }, outside: { lastSignIn: daysAgo(RECENT_WINDOW_DAYS + 1) } })
  const { expected, unseen } = coverage(s, snap, NOW)
  assert.deepEqual(expected, ['inside'])
  assert.deepEqual(unseen.map((u) => u.userId), ['outside'])
})

test('any would-be failure is Not yet, with the people counted', () => {
  const s = step({
    id: 'f',
    tracking: { daysInReportOnly: 7, signIns: 20, failures: 1, interruptions: 0, failuresByUser: [{ userId: 'u0', count: 2 }], evidenceQuality: 'enough' },
  } as Partial<Step> & { id: string })
  const v = verdictFor(s, snapshot({ u0: { lastSignIn: daysAgo(1) }, u1: { lastSignIn: daysAgo(1) } }), NOW, null)!
  assert.equal(v.kind, 'notYet')
  assert.deepEqual(v.failures, ['u0'])
})

test('the operator being in the failure set outranks the count', () => {
  const s = step({
    id: 'g',
    tracking: { daysInReportOnly: 7, signIns: 20, failures: 1, interruptions: 0, failuresByUser: [{ userId: 'u0', count: 1 }], evidenceQuality: 'enough' },
  } as Partial<Step> & { id: string })
  const v = verdictFor(s, snapshot({ u0: { lastSignIn: daysAgo(1) }, u1: { lastSignIn: daysAgo(1) } }), NOW, 'u0')!
  assert.equal(v.kind, 'notYet')
  assert.equal(v.operatorAtRisk, true)
  assert.match(v.reason, /signed-in account/)
})

test('a zero-affected block needs 3 days, not 7', () => {
  const s = step({
    id: 'h',
    readiness: { family: 'block', percent: null, lines: [] },
    evidence: { status: 'ok', lines: [], affectedUserIds: [], reportOnly: null },
  } as Partial<Step> & { id: string })
  assert.equal(requiredDays(s), 3)
  const busy = step({ id: 'i' })
  assert.equal(requiredDays(busy), 7)
})

test('a step that is not in report-only has no verdict', () => {
  assert.equal(verdictFor(step({ id: 'j', status: 'done' } as Partial<Step> & { id: string }), snapshot({}), NOW, null), null)
  assert.equal(verdictFor(step({ id: 'k', status: 'blocked' } as Partial<Step> & { id: string }), snapshot({}), NOW, null), null)
})
