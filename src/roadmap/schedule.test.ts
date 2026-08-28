import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSchedule, nextMonday } from './schedule.ts'
import { bandForActiveUsers } from './constants.ts'
import type { Step } from './types.ts'

function step(over: Partial<Step>): Step {
  return {
    id: 'x',
    goalId: 'g',
    phase: 1,
    kind: 'create',
    title: 't',
    why: '',
    whyAttribution: null,
    status: 'ready',
    blockedBy: [],
    blockers: [],
    unblockNotes: [],
    population: { total: 0, active: 0, admins: 0, guests: 0, ids: [] },
    readiness: { family: 'other', percent: null, lines: [] },
    evidence: { status: 'none', lines: [], affectedUserIds: [], reportOnly: null },
    action: { kind: 'create', summary: [], json: null, portalSteps: [], powershell: null },
    exitCriteria: [],
    rollback: '',
    history: [],
    skipReason: null,
    impact: '',
    safeToday: false,
    highCare: { userIds: [], ready: true, notes: [] },
    comms: null,
    learn: null,
    includesOperator: false,
    operatorSafe: null,
    ...over,
  }
}

const MON = '2026-08-31T00:00:00.000Z'

// A typical plan: a prerequisite, the verification campaign, and enforcement
// steps in phases 1–5 (one done).
const typical = () => [
  step({ id: 'p', phase: 0, kind: 'prerequisite' }),
  step({ id: 'v', phase: 2, kind: 'verify' }),
  step({ id: 'a', phase: 1 }),
  step({ id: 'b', phase: 2 }),
  step({ id: 'c', phase: 3 }),
  step({ id: 'd', phase: 3, status: 'done' }),
  step({ id: 'e', phase: 5 }),
]

test('nextMonday lands on a Monday after the given date', () => {
  const m = nextMonday('2026-08-26T10:00:00Z') // a Wednesday
  assert.equal(new Date(m).getUTCDay(), 1)
  assert.equal(m.slice(0, 10), '2026-08-31')
})

test('bands follow §A3: small ≤30, mid 31–300, large >300', () => {
  assert.equal(bandForActiveUsers(12), 'small')
  assert.equal(bandForActiveUsers(30), 'small')
  assert.equal(bandForActiveUsers(31), 'mid')
  assert.equal(bandForActiveUsers(300), 'mid')
  assert.equal(bandForActiveUsers(301), 'large')
})

test('12 active users: small band, about 4 weeks, with a 2-week verification window and 7-day observation', () => {
  const s = buildSchedule(typical(), MON, 12)
  assert.equal(s.band, 'small')
  assert.equal(s.bandSource, 'auto')
  assert.equal(s.verification.days, 14)
  assert.equal(s.observation.days, 7)
  assert.equal(s.weeks, 4)
  assert.equal(s.withinBand, true)
  assert.deepEqual(s.extendedBy, [])
  // Sequence: day 0 → verification → observation → waves in phase order.
  assert.ok(Date.parse(s.verification.start) >= Date.parse(s.waves[0].end))
  assert.ok(Date.parse(s.observation.start) >= Date.parse(s.verification.end))
  const w1 = s.waves.find((w) => w.wave === 1)!
  const w2 = s.waves.find((w) => w.wave === 2)!
  assert.ok(Date.parse(w1.start) >= Date.parse(s.observation.end))
  assert.ok(Date.parse(w2.start) >= Date.parse(w1.end))
  for (const w of s.waves) assert.ok([1, 2, 3, 4, 5].includes(new Date(w.start).getUTCDay()))
  assert.deepEqual(s.waves[0].stepIds.sort(), ['d', 'p', 'v'])
})

test('mid and large bands stretch the same plan to about 8 and 12 weeks', () => {
  const mid = buildSchedule(typical(), MON, 100)
  const large = buildSchedule(typical(), MON, 1000)
  assert.equal(mid.band, 'mid')
  assert.equal(mid.verification.days, 28)
  assert.equal(mid.weeks, 8)
  assert.equal(large.band, 'large')
  assert.equal(large.verification.days, 42)
  assert.equal(large.weeks, 12)
})

test('the band can be overridden', () => {
  const s = buildSchedule(typical(), MON, 12, 'large')
  assert.equal(s.band, 'large')
  assert.equal(s.bandSource, 'override')
  assert.equal(s.weeks, 12)
})

test('verification complete on a re-scan pulls the waves forward and shortens the end date', () => {
  const before = buildSchedule(typical(), MON, 12)
  const after = buildSchedule(
    typical().map((s) => (s.id === 'v' ? { ...s, status: 'done' as const } : s)),
    MON,
    12,
  )
  assert.equal(after.verification.days, 0)
  assert.equal(after.verification.complete, true)
  assert.ok(Date.parse(after.targetEnd) < Date.parse(before.targetEnd))
  assert.ok(after.totalDays <= before.totalDays - 14)
})

test('blocked steps move after their blocker, never inside a wave they cannot join', () => {
  const steps = [step({ id: 'loc', phase: 2 }), step({ id: 'reg', phase: 1, status: 'blocked', blockedBy: ['loc'] })]
  const s = buildSchedule(steps, MON, 20)
  assert.equal(s.waveOf.reg, 3)
})

test('too many waves for the band: the plan runs over and names the steps that extend it', () => {
  const steps = [1, 2, 3, 4, 5, 6, 7].map((p) => step({ id: `s${p}`, phase: p }))
  steps.push(step({ id: 'v', kind: 'verify', phase: 2 }))
  steps.push(step({ id: 'p1', kind: 'prerequisite', phase: 0 }), step({ id: 'p2', kind: 'prerequisite', phase: 0 }), step({ id: 'p3', kind: 'prerequisite', phase: 0 }))
  const s = buildSchedule(steps, MON, 12)
  assert.equal(s.withinBand, false)
  assert.ok(s.extendedBy.includes('s7'))
})

test('all done → no windows, finishes on day 0', () => {
  const s = buildSchedule([step({ id: 'a', status: 'done' })], MON, 20)
  assert.equal(s.observation.days, 0)
  assert.equal(s.verification.days, 0)
  assert.equal(s.targetEnd, s.start)
  assert.equal(s.waves.length, 1)
})
