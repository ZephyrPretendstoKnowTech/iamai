import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeStepStatus } from './stepStatus.ts'

const base = { visitedStart: true, signedIn: true, baselineLoaded: true, scanRunning: false, hasSnapshot: true, setup: null }

test('fresh visit: only Start is done', () => {
  const s = computeStepStatus({ visitedStart: true, signedIn: false, baselineLoaded: false, scanRunning: false, hasSnapshot: false, setup: null })
  assert.equal(s.start, 'done')
  assert.equal(s.connect, 'notStarted')
  assert.equal(s.coverage, 'notStarted')
})

test('scan done with 0 of 9 Setup answers: Setup not started, Findings and Roadmap provisional', () => {
  const s = computeStepStatus({ ...base, setup: { answered: 0, requiredMissing: 3 } })
  assert.equal(s.scan, 'done')
  assert.equal(s.mapping, 'notStarted')
  assert.equal(s.coverage, 'provisional')
  assert.equal(s.roadmap, 'provisional')
})

test('required answers missing: Setup needs attention', () => {
  const s = computeStepStatus({ ...base, setup: { answered: 2, requiredMissing: 1 } })
  assert.equal(s.mapping, 'attention')
  assert.equal(s.roadmap, 'provisional')
})

test('required answers complete: Setup, Findings, Roadmap done', () => {
  const s = computeStepStatus({ ...base, setup: { answered: 3, requiredMissing: 0 } })
  assert.equal(s.mapping, 'done')
  assert.equal(s.coverage, 'done')
  assert.equal(s.roadmap, 'done')
})

test('scan running shows in progress', () => {
  const s = computeStepStatus({ ...base, scanRunning: true, hasSnapshot: false })
  assert.equal(s.scan, 'inProgress')
})
