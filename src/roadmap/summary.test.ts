import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planSummary } from './summary.ts'
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
    deliveredBy: [],
    stateReason: '',
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

test('Overview counts equal Steps-tab counts for a fixture plan', () => {
  const steps = [
    step({ id: 'a', status: 'done' }),
    step({ id: 'b', status: 'done' }),
    step({ id: 'c', status: 'ready', safeToday: true }),
    step({ id: 'd', status: 'blocked' }),
    step({ id: 'e', status: 'skipped' }),
    step({ id: 'f', status: 'in-report-only' }),
  ]
  const s = planSummary(steps)
  // Overview: "2 of 6 steps already in place. 3 remain."
  assert.equal(s.done, 2)
  assert.equal(s.total, 6)
  assert.equal(s.remaining, 3)
  // Steps tab filter chips: the same numbers by status.
  const chips = Object.values(s.byStatus).reduce((a, b) => a + b, 0)
  assert.equal(chips, s.total)
  assert.equal(s.byStatus.done, s.done)
  assert.equal(s.byStatus.blocked, s.blocked)
  assert.equal(s.safeToday, 1)
})
