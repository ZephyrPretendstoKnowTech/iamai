// Prompt 37 §1 items 2 and 3: the four surfaces that count the same things must
// agree, and no count may move when nothing has changed.
//
// Review 07 caught both failures on one screen. Findings said "Registering or
// joining a device requires MFA: no policy does this yet" while the Plan tab
// counted that step under Done and Do this next said "2 steps are now
// enforced" (T1). Progress read 11/31 beside Plan chips summing to a different
// 31 (T3). And the Progress badge was observed as 9/31, then 11/31, then 9/31
// across tab switches in one session with no re-scan (T5).
//
// There is no DOM here, so "renders all four" means: derive all four from one
// fixture through the same functions the pages call, and "switches tabs ten
// times" means: derive them ten times over and require the answers to be
// identical. A tab switch is a re-render, and a re-render re-runs exactly these
// derivations — so a derivation that is pure and clock-free cannot produce the
// oscillation the review saw, and one that is not will fail here.
import assert from 'node:assert/strict'
import test from 'node:test'
import { allFixtures } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { doThisNext } from '../roadmap/next.ts'
import { planSummary } from '../roadmap/summary.ts'
import { applicableGoals, doneSteps, goalCounts, outstandingSteps, trackableSteps } from './sets.ts'

/** Everything the four surfaces put on screen, from one plan. */
function surfaces(run: ReturnType<typeof runFixture>) {
  const { steps, schedule, coverage, viability } = run
  const summary = planSummary(steps)
  const goals = goalCounts(coverage)
  const next = doThisNext(steps, schedule, viability, (id) => id, null, run.input.snapshot.asOf)
  return {
    findings: goals,
    plan: { trackable: summary.trackable, byStatus: summary.byStatus, total: summary.total },
    progress: { done: summary.done, of: summary.trackable },
    next: { items: next.items.length, completed: next.completed.length, waiting: next.waiting },
  }
}

for (const f of allFixtures()) {
  test(`${f.name}: Findings, the Plan tab, Do this next and Progress agree`, () => {
    const run = runFixture(f)
    const s = surfaces(run)
    const { steps, coverage } = run

    // Progress is the plan summary, not a second count of the same steps.
    assert.equal(s.progress.done, doneSteps(steps).length, 'Progress numerator is not the done set')
    assert.equal(s.progress.of, trackableSteps(steps).length, 'Progress denominator is not the trackable set')
    assert.equal(s.plan.trackable, s.progress.of, 'the Plan tab and Progress disagree on the denominator')

    // The status chips partition the plan: every step is in exactly one, and
    // the non-skipped ones account for the whole trackable set.
    const byStatusTotal = Object.values(s.plan.byStatus).reduce((a, b) => a + b, 0)
    assert.equal(byStatusTotal, s.plan.total, 'the status chips do not partition the plan')
    assert.equal(byStatusTotal - s.plan.byStatus.skipped, s.plan.trackable, 'the chips and the trackable set disagree')

    // Findings publishes three numbers over one denominator. Unknown goals used
    // to sit in the denominator and in none of the numerators, so the published
    // breakdown silently failed to add up.
    const { applicable, inPlace, partly, missing, unknown } = s.findings
    assert.equal(inPlace + partly + missing + unknown, applicable, 'the goal states do not add up to the applicable set')
    assert.equal(applicable, applicableGoals(coverage).length, 'Findings is counting a different goal set')

    // T1: no step may be finished for a goal Findings reports as absent. This
    // is the contradiction that made the tool untrustworthy — one screen
    // saying "no policy does this yet" beside the same item counted as done.
    const status = new Map(coverage.results.map((r) => [r.goal.id, r.status]))
    for (const step of doneSteps(steps)) {
      if (!step.goalId) continue
      const goal = status.get(step.goalId)
      if (goal === undefined) continue
      assert.notEqual(goal, 'absent', `${step.id} is done while Findings reports goal ${step.goalId} as absent`)
    }

    // Do this next draws from the outstanding set and nothing else.
    assert.ok(s.next.items <= outstandingSteps(steps).length, 'Do this next offers more items than there are outstanding steps')
  })

  test(`${f.name}: re-rendering ten times cannot change a number`, () => {
    const run = runFixture(f)
    const first = JSON.stringify(surfaces(run))
    for (let i = 0; i < 10; i++) {
      assert.equal(JSON.stringify(surfaces(run)), first, `a count changed on re-render ${i + 1} with no new scan`)
    }
  })
}

test('skipping a step moves the badge and the chips together', () => {
  // Every fixture skips nothing, so the assertions above about the trackable
  // set never actually bite on a difference. This is the case the review
  // caught: the chips counted every step while the badge divided by the
  // trackable set, so they agreed only while nothing was skipped.
  for (const f of allFixtures()) {
    const run = runFixture(f)
    const victim = run.steps.find((s) => s.status !== 'done')
    if (!victim) continue
    const before = planSummary(run.steps)
    victim.status = 'skipped'
    const after = planSummary(run.steps)

    assert.equal(after.total, before.total, `${f.name}: skipping changed the number of steps`)
    assert.equal(after.trackable, before.trackable - 1, `${f.name}: a skipped step is still in the trackable set`)
    assert.equal(after.byStatus.skipped, before.byStatus.skipped + 1, `${f.name}: the skipped chip did not move`)
    const chips = Object.values(after.byStatus).reduce((a, b) => a + b, 0)
    assert.equal(chips - after.byStatus.skipped, after.trackable, `${f.name}: the chips and the badge disagree once a step is skipped`)
    assert.equal(after.remaining, after.trackable - after.done, `${f.name}: remaining is not the rest of the trackable set`)
  }
})

test('a plan derived twice from the same fixture gives the same numbers', () => {
  // The stability test above re-derives from one plan object. This one rebuilds
  // the plan itself, which is what a dependency change in the page's memo does:
  // the same scan must produce the same counts however many times it is
  // replanned. Anything reading the wall clock fails here rather than in front
  // of a user.
  for (const f of allFixtures()) {
    const a = JSON.stringify(surfaces(runFixture(f)))
    const b = JSON.stringify(surfaces(runFixture(f)))
    assert.equal(b, a, `${f.name}: replanning the same scan produced different numbers`)
  }
})

// ---- prompt 46 Part 2: one denominator, one verdict ----

test('one denominator: active people agree across sets, viability and rollout, and never-signed-in accounts are in none (prompt 46 item 7)', async () => {
  const { activeUsers, notActiveUsers, peopleCounts } = await import('./sets.ts')
  const { summarizeTenant } = await import('../scoring/mfaViability.ts')
  for (const f of allFixtures()) {
    const run = runFixture(f)
    const snapshot = run.input.snapshot
    const now = snapshot.asOf
    const confirmed = new Set(f.mapping.serviceAccountUserIds ?? [])
    const active = activeUsers(snapshot, now, confirmed)
    const notActive = notActiveUsers(snapshot, now, confirmed)
    const people = peopleCounts(snapshot, now, confirmed)
    // The scoring engine's idea of active is the same set.
    const viaActive = run.viability.filter((v) => v.activity === 'active').map((v) => v.userId).sort()
    assert.deepEqual(active.map((u) => u.id).sort(), viaActive, `${f.name}: sets.activeUsers and viability.activity disagree`)
    // Enabled splits cleanly into active and not active.
    assert.equal(people.enabled, people.active + people.notActive, `${f.name}: enabled != active + notActive`)
    assert.equal(people.notActive, notActive.length)
    // Rollout counts over active people and nothing else.
    const rollout = summarizeTenant(run.viability).rollout
    assert.equal(rollout.active, active.length, `${f.name}: rollout denominator is not the active set`)
    assert.equal(rollout.proven + rollout.noMethod + rollout.unproven, rollout.active, `${f.name}: rollout buckets do not sum to active`)
    // A never-signed-in account is in no denominator.
    const never = new Set(snapshot.users.filter((u) => !u.lastSuccessfulSignIn).map((u) => u.id))
    for (const id of active) assert.ok(!never.has(id.id), `${f.name}: ${id.id} never signed in and is counted active`)
    for (const v of run.viability) if (never.has(v.userId)) assert.notEqual(v.activity, 'active')
    // Step populations count active people only.
    for (const s of run.steps) assert.ok(s.population.active <= people.active, `${f.name}/${s.id}: population.active ${s.population.active} exceeds the tenant's active count ${people.active}`)
  }
})

test('one verdict: for every goal in every fixture, the findings verdict and the step status agree (prompt 46 item 9)', async () => {
  const { applyProgress } = await import('../roadmap/progress.ts')
  for (const f of allFixtures()) {
    const run = runFixture(f)
    const snapshot = run.input.snapshot
    // Tracking is what disagreed with coverage on the demo and mid fixtures
    // (Findings 6 in place, Plan 11): a matched policy that was on advanced its
    // step to done while the goal was partly in place. So the assertion runs
    // after tracking, not before it.
    const steps = applyProgress(run.steps, snapshot, run.coverage, `agreement-${f.name}`, snapshot.asOf, snapshot.asOf)
    const byGoal = new Map(run.coverage.results.map((r) => [r.goal.id, r]))
    const disagreements: string[] = []
    for (const s of steps) {
      if (s.kind !== 'create' && s.kind !== 'adjust') continue
      const r = byGoal.get(s.goalId)
      if (!r) continue
      const stepDone = s.status === 'done'
      const verdictDone = r.verdict === 'inPlace'
      if (stepDone !== verdictDone) disagreements.push(`${f.name}: ${s.id} is ${s.status} while its goal's verdict is ${r.verdict}`)
      // A partly or below-baseline goal is a change step carrying its gap.
      if ((r.verdict === 'partly' || r.verdict === 'belowBaseline') && s.status !== 'done' && s.gap === null && r.gapSentence !== null) {
        disagreements.push(`${f.name}: ${s.id} has no gap sentence though its goal has one`)
      }
    }
    assert.deepEqual(disagreements, [])
    // Header and footer count the same set.
    const summary = planSummary(steps)
    assert.equal(summary.done, doneSteps(steps).length, `${f.name}: the plan header's done count is not doneSteps`)
  }
})
