// The one status word per step (prompt 48 Part 4, target-state §8.3): every
// engine status maps to exactly one of the eight display words, and the verb
// lives in the title, not the word.
//
// Report-only and Ready to enforce are two of them because they are two states
// to act on: one is a policy to leave alone and watch, the other is a policy
// whose gates have closed (task 007). Neither is Enforced.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { statusOf } from './statusWord.ts'
import { initialState, setState, stateForStatus } from '../../roadmap/lifecycle.ts'
import type { StepState } from '../../roadmap/lifecycle.ts'
import type { Step, StepStatus } from '../../roadmap/types.ts'

const WORDS = new Set(['In place', 'Ready', 'Blocked', 'Scheduled', 'Report-only', 'Ready to enforce', 'Enforced', 'Skipped'])

function step(status: StepStatus, over: Partial<StepState> = {}): Step {
  // A step nothing holds: the word reads the hold (roadmap/holds.ts), which reads the step's kind and blockers.
  const built = { status, kind: 'prerequisite', blockers: [], state: initialState(), tracking: null } as unknown as Step
  return setState(built, { ...stateForStatus(status), ...over })
}

test('every engine status maps to one of the eight words', () => {
  const statuses: StepStatus[] = ['done', 'ready', 'blocked', 'in-report-only', 'ready-to-enforce', 'skipped']
  for (const s of statuses) assert.ok(WORDS.has(statusOf(step(s)).word), `${s} → ${statusOf(step(s)).word}`)
  // The three stages of a deployed policy are three words, and no two of them
  // are the same: a policy being watched, one whose gates have closed, and one
  // the tenant has on.
  const words = ['in-report-only', 'ready-to-enforce'].map((x) => statusOf(step(x as StepStatus)).word)
  assert.deepEqual(words, ['Report-only', 'Ready to enforce'])
  assert.notEqual(statusOf(step('ready-to-enforce')).word, statusOf(step('done', { inPlace: false, lifecycle: 'enforced' })).word, 'ready to enforce is not enforced')
})

test('a done goal reads Enforced only where the plan drove its own policy to enforcement', () => {
  // In place is a preservation result for a control the tenant already had, not
  // a Conditional Access stage — so the stage alone cannot answer it. A policy
  // the tenant wrote and switched on is `enforced` in the tenant exactly as one
  // the plan deployed is, and reading the stage made every goal a tenant
  // already delivered say Enforced. Foundation B's `inPlace` is the provenance
  // that tells them apart (roadmap/lifecycle.ts).
  assert.equal(statusOf(step('done')).word, 'In place')
  assert.equal(statusOf(step('done', { lifecycle: 'enforced' })).word, 'In place', 'the tenant own policy is enforced in the tenant too')
  assert.equal(statusOf(step('done', { inPlace: false, lifecycle: 'enforced' })).word, 'Enforced')
  // But the provenance alone cannot answer it either, and this is the other
  // half of the same claim: Enforced says a policy is on, so it takes a policy
  // that is on. A step with no policy has no provenance to carry and no stage
  // to reach — a finished verification campaign is `satisfied` with `inPlace`
  // false and no lifecycle at all — and it used to fall through to Enforced
  // over a rollout that never happened.
  assert.equal(statusOf(step('done', { inPlace: false, lifecycle: null })).word, 'In place', 'nothing was deployed, so nothing was enforced')
  assert.equal(statusOf(step('done', { inPlace: false, lifecycle: 'report-only' })).word, 'In place', 'a policy still being watched is not one the plan turned on')
})

test('no status word is a verb', () => {
  const statuses: StepStatus[] = ['done', 'ready', 'blocked', 'in-report-only', 'ready-to-enforce', 'skipped']
  for (const s of statuses) assert.doesNotMatch(statusOf(step(s)).word, /^(Create|Change|Check|Run|Give|Stop|Make)/)
})
