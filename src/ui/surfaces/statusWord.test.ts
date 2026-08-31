// The one status word per step (prompt 48 Part 4, target-state §8.3): every
// engine status maps to exactly one of the seven display words, and the verb
// lives in the title, not the word.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { statusOf } from './statusWord.ts'
import type { Step, StepStatus } from '../../roadmap/types.ts'

const WORDS = new Set(['In place', 'Ready', 'Blocked', 'Scheduled', 'Report-only', 'Enforced', 'Skipped'])

function step(status: StepStatus, over: Partial<Step> = {}): Step {
  return { status, tracking: null, ...over } as Step
}

test('every engine status maps to one of the seven words', () => {
  const statuses: StepStatus[] = ['done', 'ready', 'blocked', 'in-report-only', 'ready-to-enforce', 'skipped']
  for (const s of statuses) assert.ok(WORDS.has(statusOf(step(s)).word), `${s} → ${statusOf(step(s)).word}`)
})

test('a done step that has enforced reads Enforced, otherwise In place', () => {
  assert.equal(statusOf(step('done')).word, 'In place')
  assert.equal(statusOf(step('done', { tracking: { enforcedAt: '2026-09-08' } as Step['tracking'] })).word, 'Enforced')
})

test('no status word is a verb', () => {
  const statuses: StepStatus[] = ['done', 'ready', 'blocked', 'in-report-only', 'ready-to-enforce', 'skipped']
  for (const s of statuses) assert.doesNotMatch(statusOf(step(s)).word, /^(Create|Change|Check|Run|Give|Stop|Make)/)
})
