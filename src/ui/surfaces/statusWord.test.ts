// The one status word per step (prompt 48 Part 4, target-state §8.3): every
// engine status maps to exactly one of the seven display words, and the verb
// lives in the title, not the word.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { statusOf } from './statusWord.ts'
import { initialState, setState, stateForStatus } from '../../roadmap/lifecycle.ts'
import type { StepState } from '../../roadmap/lifecycle.ts'
import type { Step, StepStatus } from '../../roadmap/types.ts'

const WORDS = new Set(['In place', 'Ready', 'Blocked', 'Scheduled', 'Report-only', 'Enforced', 'Skipped'])

function step(status: StepStatus, over: Partial<StepState> = {}): Step {
  const built = { status, state: initialState(), tracking: null } as Step
  return setState(built, { ...stateForStatus(status), ...over })
}

test('every engine status maps to one of the seven words', () => {
  const statuses: StepStatus[] = ['done', 'ready', 'blocked', 'in-report-only', 'ready-to-enforce', 'skipped']
  for (const s of statuses) assert.ok(WORDS.has(statusOf(step(s)).word), `${s} → ${statusOf(step(s)).word}`)
})

test('a done goal reads Enforced only where the step drove its own policy to enforcement', () => {
  // In place is a preservation result for a control the tenant already had, not
  // a Conditional Access stage: the step's lifecycle answers, not a date.
  assert.equal(statusOf(step('done')).word, 'In place')
  assert.equal(statusOf(step('done', { lifecycle: 'enforced' })).word, 'Enforced')
  assert.equal(statusOf(step('done', { lifecycle: 'report-only' })).word, 'In place', 'a policy still in report-only has not enforced anything')
})

test('no status word is a verb', () => {
  const statuses: StepStatus[] = ['done', 'ready', 'blocked', 'in-report-only', 'ready-to-enforce', 'skipped']
  for (const s of statuses) assert.doesNotMatch(statusOf(step(s)).word, /^(Create|Change|Check|Run|Give|Stop|Make)/)
})
