import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareScores, controlSeverity, scoreGoal, sizeBand } from './priority.ts'
import type { ScoreInput } from './priority.ts'
import type { Goal } from '../coverage/types.ts'

function goal(over: Partial<Goal> = {}, grant: 'block' | 'mfa' | undefined = 'mfa'): Goal {
  return {
    id: 'g',
    name: 'Goal',
    shortName: 'Goal',
    description: '',
    phase: 1,
    domain: 'Identity',
    securityValue: 4,
    baseEffort: 2,
    applicability: null,
    implementations: [{ tier: 'p1', kind: 'ca', signature: {}, expectedWho: { kind: 'all' }, expectedApps: 'all', floor: grant ? { grant } : { session: { anyOf: true } }, allowedExclusions: [], template: {} }],
    free: [],
    ...over,
  }
}

const base: ScoreInput = {
  goal: goal(),
  status: 'absent',
  affectedActive: 100,
  tenantActive: 100,
  readinessPercent: null,
  evidenceClean: false,
  prerequisites: 0,
  newObjects: 0,
  exposure: false,
}

test('size bands follow A3', () => {
  assert.equal(sizeBand(30), 'small')
  assert.equal(sizeBand(31), 'mid')
  assert.equal(sizeBand(300), 'mid')
  assert.equal(sizeBand(301), 'large')
})

test('value: catalogue value, raised by exposure, capped at 5', () => {
  assert.equal(scoreGoal(base).value, 4)
  assert.equal(scoreGoal({ ...base, exposure: true }).value, 5)
  assert.equal(scoreGoal({ ...base, goal: goal({ securityValue: 5 }), exposure: true }).value, 5)
})

test('effort: base plus prerequisites, new objects, readiness gap; capped; enforced is 1', () => {
  assert.equal(scoreGoal(base).effort, 2)
  assert.equal(scoreGoal({ ...base, prerequisites: 2, newObjects: 1, readinessPercent: 40 }).effort, 5)
  assert.equal(scoreGoal({ ...base, goal: goal({ baseEffort: 4 }), prerequisites: 1, newObjects: 1 }).effort, 5)
  assert.equal(scoreGoal({ ...base, readinessPercent: 90 }).effort, 2)
  assert.equal(scoreGoal({ ...base, status: 'enforced', prerequisites: 3 }).effort, 1)
})

test('disruption: everyone affected by a block in a large tenant is 5; readiness and clean evidence pull it down; nobody affected is 1', () => {
  const block = goal({}, 'block')
  assert.equal(controlSeverity(block), 3)
  assert.equal(scoreGoal({ ...base, goal: block, affectedActive: 400, tenantActive: 400 }).disruption, 5)
  assert.equal(scoreGoal({ ...base, goal: block, affectedActive: 400, tenantActive: 400, evidenceClean: true }).disruption, 3)
  assert.equal(scoreGoal({ ...base, readinessPercent: 100 }).disruption, 2)
  assert.equal(scoreGoal({ ...base, affectedActive: 0 }).disruption, 1)
  assert.equal(scoreGoal({ ...base, status: 'enforced' }).disruption, 1)
  // Small tenants land softer than large ones for the same share.
  const small = scoreGoal({ ...base, goal: block, affectedActive: 20, tenantActive: 20 }).disruption
  const large = scoreGoal({ ...base, goal: block, affectedActive: 2000, tenantActive: 2000 }).disruption
  assert.ok(small < large)
})

test('priority = value × (6 − disruption), ties by lower effort', () => {
  const a = scoreGoal({ ...base, affectedActive: 0 }) // value 4, disruption 1 → 20
  assert.equal(a.priority, 20)
  const b = { ...a, effort: 5 }
  assert.equal(compareScores(a, b, 'priority') < 0, true)
  assert.equal(compareScores(a, null, 'priority') < 0, true)
  const cheap = { ...a, effort: 1, priority: 5 }
  assert.equal(compareScores(cheap, a, 'effort') < 0, true)
})
