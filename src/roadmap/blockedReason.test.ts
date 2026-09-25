// One binding blocked reason per step (target-state §8.5, prompt 46 item 16):
// at most twelve words, in one of four shapes, on every fixture. The rest of
// the causes stay on the step under More. The fourth shape is the baseline's
// own contradiction (roadmap/baselineConflict.ts): a whole sentence, because
// nothing in the tenant is the cause and nothing there can clear it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BLOCKED_REASON, BLOCKED_REASON_MAX_WORDS } from '../copy/reasons.ts'
import { allFixtures } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { isHeld } from './holds.ts'

const SHAPES = [/^(Attestation|Allowed Authenticators|Method Availability): .+$/, /^(Passkey|Authenticator) [^:]+: .+$/,/^after: .+$/, /^when .+ reaches .+ \(now .+\)$/, /^when \d+ .+ exists? \(now \d+\)$/]
/**
 * The fourth shape is the content file's own sentence, not a fill: matched whole.
 * So are the holds no step of the plan clears (roadmap/stateReason.ts holdReasonFor).
 */
const SENTENCES = [BLOCKED_REASON.baseline, BLOCKED_REASON.exclusionsGroup, BLOCKED_REASON.devicePlan, BLOCKED_REASON.direction, BLOCKED_REASON.unsettled, BLOCKED_REASON.sourceMapping, BLOCKED_REASON.pairUnmatched, BLOCKED_REASON.noOperation, BLOCKED_REASON.noOperationHeld, BLOCKED_REASON.manualCorrection, BLOCKED_REASON.emergency]
const inShape = (reason: string): boolean => SENTENCES.includes(reason) || SHAPES.some((re) => re.test(reason))
const words = (s: string): number => s.trim().split(/\s+/).length

test('every blocked step on every fixture carries one binding reason, in one of the shapes, within twelve words', () => {
  // The fills land in the shapes; the baseline's is a sentence the content file writes.
  {
    for (const r of [BLOCKED_REASON.after('Create the exclusion group'), BLOCKED_REASON.reaches('MFA readiness', '90%', '60%'), BLOCKED_REASON.exist(2, 'emergency-access account', 0), BLOCKED_REASON.exist(1, 'trusted location', 0), BLOCKED_REASON.baseline]) {
      assert.ok(inShape(r), r)
      assert.ok(words(r) <= BLOCKED_REASON_MAX_WORDS, r)
    }
  }

  // every blocked step on every fixture carries one binding reason, in shape, within twelve words
  {
    let blocked = 0
    const failures: string[] = []
    for (const f of allFixtures()) {
      const r = runFixture(f)
      for (const s of r.steps) {
        if (s.status !== 'blocked') {
          // A held step says what holds it whatever its word (roadmap/holds.ts); nothing else carries a reason.
          if (s.blockedReason !== null && !isHeld(s)) failures.push(`${f.name}/${s.id}: not blocked but carries a reason`)
          if (s.blockedReason !== null && !inShape(s.blockedReason)) failures.push(`${f.name}/${s.id}: "${s.blockedReason}" is in none of the shapes`)
          continue
        }
        blocked += 1
        const reason = s.blockedReason
        if (!reason) {
          failures.push(`${f.name}/${s.id}: blocked with no reason`)
          continue
        }
        if (!inShape(reason)) failures.push(`${f.name}/${s.id}: "${reason}" is in none of the four shapes`)
        if (words(reason) > BLOCKED_REASON_MAX_WORDS) failures.push(`${f.name}/${s.id}: "${reason}" is ${words(reason)} words`)
        if (/named cause/.test(reason)) failures.push(`${f.name}/${s.id}: a producer left its cause unnamed`)
        assert.ok(s.blockers.length + s.blockedBy.length > 0, `${s.id}: the causes are still on the step`)
      }
    }
    assert.ok(blocked > 10, `the fixtures have blocked steps to check (${blocked})`)
    assert.deepEqual(failures, [])
  }
})
