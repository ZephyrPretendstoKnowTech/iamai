// A step the board holds names no day in its milestone (owner decision 2,
// 2026-09-22), and nothing else about the milestone moves: the undated wording
// comes from nextMilestone itself (roadmap/lifecycle.ts, `undated`), one branch
// at a time, never from a pass over a finished sentence.
//
// The defect: the pass that took the day out (undatedMilestone) turned every
// dated milestone that was not an observation into "Finish the steps this one
// waits on first." That included a create the plan schedules while only
// readiness holds its turn-on - "Create the policy in report-only on Aug 31,
// 2026; turning it on waits for MFA readiness to reach 90%." - so a held step
// stopped saying to create the policy in report-only, against the Step 5 ruling
// that a held create keeps its report-only preparation, and its kind moved
// from deploy to resolve while the Implementation region still offered the
// create: two instructions pulling apart.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture, withDirectionApproved, withFoundationSettled } from './fixtures/run.ts'
import { nextMilestone } from './lifecycle.ts'
import { absoluteDate } from '../copy/dates.ts'
import { engine } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import type { Step } from './types.ts'

const MILESTONE = engine.milestone
const DATE = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}\b/

/** The recovery test not yet run: every turn-on waits on it (roadmap/enforceWaits.ts). */
const withoutRecoveryTest = (f: Fixture): Fixture => ({ ...f, checkpoints: (f.checkpoints ?? []).filter((c) => (c as { cleanup?: string }).cleanup !== 'drill') })

const stepsOf = (f: Fixture): Step[] => runFixture(f, {}, null, f.snapshot.asOf).steps
const stepIn = (steps: readonly Step[], id: string): Step => {
  const s = steps.find((x) => x.id === id)
  assert.ok(s, `the fixture carries ${id}`)
  return s!
}

test('a held step names no day in its milestone, keeps its report-only preparation, and dated every milestone is what it was', () => {
  // A held create keeps its report-only preparation, its gate and its kind, without the day.
  {
    // small, settled: Require Phishing-Resistant MFA for Admins. It was the registration
    // policy on week two, which is created On since Phase 2e, so its create waits with its turn-on.
    const step = stepIn(stepsOf(withFoundationSettled(fixture('small'))), 's-goal-admins-phishing-resistant')
    const gate = step.action.readinessGate
    const dated = nextMilestone(step)
    // The premise: the create the plan schedules while readiness holds its turn-on.
    assert.ok(gate, 'the premise: a readiness gate on its turn-on')
    assert.equal(dated.kind, 'deploy')
    assert.ok(dated.at !== null && dated.label.includes(absoluteDate(dated.at)), `the premise: a dated create, "${dated.label}"`)
    assert.deepEqual(nextMilestone(step, { undated: true }), { kind: 'deploy', label: fillText(MILESTONE.prepareHeld, { measure: gate!.measure, threshold: gate!.threshold }), at: null, gatedBy: step.blockedReason })
  }
  // Undated, no milestone names or carries a day, and dated, every milestone is what it was.
  {
    let dated = 0
    for (const f of [withDirectionApproved(curatedFixture('demo-week2')), withoutRecoveryTest(withDirectionApproved(curatedFixture('demo-week2'))), curatedFixture('demo')]) {
      for (const step of stepsOf(f)) {
        const m = nextMilestone(step, { undated: true })
        assert.equal(m.at, null, `${f.name}/${step.id}: a day`)
        assert.doesNotMatch(m.label, DATE, `${f.name}/${step.id}: "${m.label}"`)
        assert.deepEqual(nextMilestone(step, { undated: false }), nextMilestone(step), `${f.name}/${step.id}: the dated milestone moved`)
        if (nextMilestone(step).at !== null) dated++
      }
    }
    assert.ok(dated > 0, 'the premise: dated milestones to take the day from')
  }
})
