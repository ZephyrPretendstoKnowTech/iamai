// One binding blocked reason per step (target-state §8.5, prompt 46 item 16):
// at most twelve words, in one of three shapes, on every fixture. The rest of
// the causes stay on the step under More.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BLOCKED_REASON, BLOCKED_REASON_MAX_WORDS } from '../copy/reasons.ts'
import { allFixtures } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'

const SHAPES = [/^after: .+$/, /^when .+ reaches .+ \(now .+\)$/, /^when \d+ .+ exists? \(now \d+\)$/]
const words = (s: string): number => s.trim().split(/\s+/).length

test('the three shapes', () => {
  assert.equal(BLOCKED_REASON.after('Create the exclusion group'), 'after: Create the exclusion group')
  assert.equal(BLOCKED_REASON.reaches('MFA readiness', '90%', '60%'), 'when MFA readiness reaches 90% (now 60%)')
  assert.equal(BLOCKED_REASON.exist(2, 'emergency-access account', 0), 'when 2 emergency-access accounts exist (now 0)')
  assert.equal(BLOCKED_REASON.exist(1, 'trusted location', 0), 'when 1 trusted location exists (now 0)')
})

test('every blocked step on every fixture carries one binding reason, in shape, within twelve words', () => {
  let blocked = 0
  const failures: string[] = []
  for (const f of allFixtures()) {
    const r = runFixture(f)
    for (const s of r.steps) {
      if (s.status !== 'blocked') {
        if (s.blockedReason !== null) failures.push(`${f.name}/${s.id}: not blocked but carries a reason`)
        continue
      }
      blocked += 1
      const reason = s.blockedReason
      if (!reason) {
        failures.push(`${f.name}/${s.id}: blocked with no reason`)
        continue
      }
      if (!SHAPES.some((re) => re.test(reason))) failures.push(`${f.name}/${s.id}: "${reason}" is in none of the three shapes`)
      if (words(reason) > BLOCKED_REASON_MAX_WORDS) failures.push(`${f.name}/${s.id}: "${reason}" is ${words(reason)} words`)
      if (/named cause/.test(reason)) failures.push(`${f.name}/${s.id}: a producer left its cause unnamed`)
      // The row shows the binding reason; the full list is still on the step.
      assert.equal(s.stateReason, reason, `${s.id}: stateReason is the binding reason`)
      assert.ok(s.blockers.length + s.blockedBy.length > 0, `${s.id}: the causes are still on the step`)
    }
  }
  assert.ok(blocked > 10, `the fixtures have blocked steps to check (${blocked})`)
  assert.deepEqual(failures, [])
})

test('"is not sorted yet" is gone', () => {
  for (const f of allFixtures()) {
    for (const s of runFixture(f).steps) {
      const text = [s.stateReason, s.blockedReason ?? '', ...s.unblockNotes, ...s.blockers.map((b) => b.label)].join(' ')
      assert.doesNotMatch(text, /is not sorted yet/, `${f.name}/${s.id}`)
    }
  }
})
