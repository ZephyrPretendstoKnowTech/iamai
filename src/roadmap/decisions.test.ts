// Prompt 50.1 items 1-2: the plan record holds decisions only, and a pre-50.1
// record (a full per-step blob) is read once for its decisions and then the plan
// is regenerated from the snapshot — never from the record's cached statuses.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { generateRoadmap } from './generate.ts'
import { applySkips, applyProgress, decisionsOf } from './progress.ts'
import { isEmergencyAccess } from './blockerSteps.ts'

test('a pre-50.1 record: only the skip is kept; the plan renders from the snapshot, not the cached status', () => {
  const f = fixture('midflight')
  const fresh = runFixture(f)
  // A create/adjust step the snapshot does NOT have in place, and a step that can
  // be skipped. The first is where a stale cache would lie.
  const notInPlace = fresh.steps.find((s) => (s.kind === 'create' || s.kind === 'adjust') && s.status !== 'done' && s.status !== 'skipped')
  const skippable = fresh.steps.find((s) => s.status !== 'done' && !isEmergencyAccess(s) && s.id !== notInPlace?.id)
  assert.ok(notInPlace && skippable, 'the fixture has a not-in-place step and a skippable one')

  // A record as an older build wrote it: the full per-step blob, claiming the
  // not-in-place step is DONE (with a fabricated enforcement date), and carrying a
  // real skip decision. The done claim is generated state, not a decision.
  const legacy = {
    planId: f.planId,
    steps: {
      [notInPlace.id]: {
        status: 'done',
        skipReason: null,
        history: [{ at: '2026-01-01T00:00:00.000Z', from: 'ready', to: 'done', note: 'cached by an old build' }],
        tracking: { policyId: 'ghost', policyName: 'ghost', matchedBy: 'tag', note: '', enforcedAt: '2026-01-01T00:00:00.000Z' },
        ringActuals: [{ actualStart: '2026-01-01T00:00:00.000Z', actualEnd: null }],
        currentRing: 1,
      },
      [skippable.id]: {
        status: 'skipped',
        skipReason: 'Not this quarter',
        history: [{ at: '2026-02-01T00:00:00.000Z', from: 'ready', to: 'skipped', note: 'Not this quarter' }],
      },
    },
    startDate: '2026-08-31',
    checkpoints: [{ at: '2026-02-01T00:00:00.000Z' }],
    planCreatedAt: '2026-01-15T00:00:00.000Z',
  }

  // Migration: read the record once for its decisions.
  const decisions = decisionsOf(legacy as never, f.planId)
  assert.deepEqual(Object.keys(decisions.skips), [skippable.id], 'only the skipped step is a decision; the cached "done" is dropped')
  assert.equal(decisions.skips[skippable.id].reason, 'Not this quarter')
  assert.equal(decisions.skips[skippable.id].at, '2026-02-01T00:00:00.000Z')
  assert.equal(decisions.startDate, '2026-08-31', 'the start date is a decision and survives')
  assert.equal(decisions.planCreatedAt, '2026-01-15T00:00:00.000Z', 'when the plan began survives')
  assert.deepEqual(decisions.checkpoints, [{ at: '2026-02-01T00:00:00.000Z' }])
  assert.ok(!('steps' in decisions), 'the generated per-step blob is gone from the record')

  // Regenerate exactly as the page does: generate -> apply the skip -> track.
  const regen = generateRoadmap(fresh.input).steps
  applySkips(regen, decisions.skips)
  applyProgress(regen, f.snapshot, fresh.coverage, f.planId, undefined, decisions.planCreatedAt ?? null)
  const again = (id: string) => regen.find((s) => s.id === id)

  assert.notEqual(again(notInPlace.id)?.status, 'done', 'the cached done status did not survive the regeneration')
  assert.equal(again(notInPlace.id)?.status, notInPlace.status, 'the step renders exactly the status the current snapshot produces')
  assert.equal(again(skippable.id)?.status, 'skipped', 'the skip decision does survive')
  assert.equal(again(skippable.id)?.skipReason, 'Not this quarter')
})

test('a decisions-shaped record round-trips unchanged through decisionsOf', () => {
  const rec = {
    planId: 'plan-abcd1234',
    skips: { 's-goal-x': { reason: 'not us', at: '2026-03-01T00:00:00.000Z' } },
    startDate: '2026-09-01',
    freeze: { from: '2026-12-20', to: '2027-01-05' },
    checkpoints: [{ at: '2026-03-01T00:00:00.000Z' }],
    planCreatedAt: '2026-02-01T00:00:00.000Z',
  }
  const out = decisionsOf(rec, 'plan-abcd1234')
  assert.deepEqual(out.skips, rec.skips)
  assert.equal(out.startDate, '2026-09-01')
  assert.deepEqual(out.freeze, rec.freeze)
  assert.deepEqual(out.checkpoints, rec.checkpoints)
  assert.equal(out.planCreatedAt, rec.planCreatedAt)
})
