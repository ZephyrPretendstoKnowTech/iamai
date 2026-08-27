import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSchedule, nextMonday, phaseDuration } from './schedule.ts'
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

test('nextMonday lands on a Monday after the given date', () => {
  const m = nextMonday('2026-08-26T10:00:00Z') // a Wednesday
  assert.equal(new Date(m).getUTCDay(), 1)
  assert.equal(m.slice(0, 10), '2026-08-31')
})

test('done-only phases take no time; create steps add the observation window', () => {
  assert.equal(phaseDuration([step({ status: 'done' })], 10).days, 0)
  const d = phaseDuration([step({ kind: 'create' })], 10)
  assert.ok(d.days >= 7 + 2)
  assert.match(d.note ?? '', /observation window/)
})

test('phases are sequential, start on weekdays, and the total scales with work', () => {
  const steps = [
    step({ id: 'a', phase: 1 }),
    step({ id: 'b', phase: 2 }),
    step({ id: 'c', phase: 2 }),
    step({ id: 'd', phase: 3, status: 'done' }),
  ]
  const s = buildSchedule(steps, '2026-08-31T00:00:00.000Z', 20)
  assert.equal(s.phases.length, 3)
  assert.ok(Date.parse(s.phases[1].start) >= Date.parse(s.phases[0].end))
  assert.equal(s.phases[2].days, 0)
  for (const p of s.phases) {
    const day = new Date(p.start).getUTCDay()
    assert.ok(day >= 1 && day <= 5)
  }
  assert.ok(s.totalDays > 14)
  assert.ok(s.weeks >= 2)
})
