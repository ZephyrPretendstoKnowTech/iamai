import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSchedule, nextMonday } from './schedule.ts'
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

test('nextMonday lands on a Monday after the given date', () => {
  const m = nextMonday('2026-08-26T10:00:00Z') // a Wednesday
  assert.equal(new Date(m).getUTCDay(), 1)
  assert.equal(m.slice(0, 10), '2026-08-31')
})

test('waves: day 0 batch, one shared observation window, enforcement in phase order', () => {
  const steps = [
    step({ id: 'a', phase: 1 }),
    step({ id: 'b', phase: 2 }),
    step({ id: 'c', phase: 2 }),
    step({ id: 'd', phase: 3, status: 'done' }),
    step({ id: 'p', phase: 0, kind: 'prerequisite' }),
  ]
  const s = buildSchedule(steps, MON, 20, 'standard')
  assert.equal(s.observation.days, 7)
  assert.deepEqual(s.waves[0].stepIds.sort(), ['d', 'p'])
  assert.equal(s.waveOf.a, 1)
  assert.equal(s.waveOf.b, 2)
  assert.equal(s.waveOf.d, 0)
  const w1 = s.waves.find((w) => w.wave === 1)!
  const w2 = s.waves.find((w) => w.wave === 2)!
  assert.ok(Date.parse(w1.start) >= Date.parse(s.observation.end))
  assert.ok(Date.parse(w2.start) >= Date.parse(w1.end))
  for (const w of s.waves) assert.ok([1, 2, 3, 4, 5].includes(new Date(w.start).getUTCDay()))
  assert.ok(s.totalDays >= 7 + 3 + 3)
})

test('blocked steps move after their blocker, never inside a wave they cannot join', () => {
  const steps = [step({ id: 'loc', phase: 2 }), step({ id: 'reg', phase: 1, status: 'blocked', blockedBy: ['loc'] })]
  const s = buildSchedule(steps, MON, 20)
  assert.equal(s.waveOf.reg, 3)
})

test('pace presets change the observation window and the total', () => {
  const steps = [step({ id: 'a', phase: 1 }), step({ id: 'b', phase: 2 }), step({ id: 'v', phase: 2, kind: 'verify' })]
  const fast = buildSchedule(steps, MON, 20, 'fast')
  const standard = buildSchedule(steps, MON, 20, 'standard')
  const cautious = buildSchedule(steps, MON, 20, 'cautious')
  assert.equal(fast.observation.days, 5)
  assert.equal(cautious.observation.days, 14)
  assert.ok(fast.totalDays < standard.totalDays && standard.totalDays < cautious.totalDays)
  assert.match(standard.waves.find((w) => w.wave === 2)!.note ?? '', /verification/)
})

test('all done → no observation, finishes on day 0', () => {
  const s = buildSchedule([step({ id: 'a', status: 'done' })], MON, 20)
  assert.equal(s.observation.days, 0)
  assert.equal(s.targetEnd, s.start)
  assert.equal(s.waves.length, 1)
})
