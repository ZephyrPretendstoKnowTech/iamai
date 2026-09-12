// State-word agreement (S7, Plan Actionability + Trust Correction): the row, the
// opened step's badge, the export view, the calendar entry and the bundle read
// one state, and a Fix line names only what holds the next action.
//
//  1. A row reading Needs attention never leaves as "Healthy": the export's one
//     state label is the badge (planState.ts badgeOf), never stage and condition
//     joined again by an artifact.
//  2. An enforced policy whose meaning drifted is Review required in its stage,
//     never In place and never "Already satisfied": tracking withdraws the
//     delivery claim (tracking.ts), lifecycle.ts holds it for review.
//  3. Readiness gates enforcement, not creation: while the plan dates the
//     report-only create, no readiness wait is listed under Fix before continuing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { applyProgress } from '../../roadmap/progress.ts'
import { stepIdForGoal } from '../../roadmap/generate.ts'
import { artifactIdOf, semanticFieldsOf, semanticsOf } from '../../roadmap/observation.ts'
import type { StepObservationRecord } from '../../roadmap/observation.ts'
import { SOLE_MEMBER } from '../../roadmap/tracking.ts'
import { heldForReview } from '../../roadmap/lifecycle.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { groundingBundle } from '../../roadmap/prompts.ts'
import { stateLine, stepArtifactLines } from '../../roadmap/artifactLines.ts'
import { scheduleOf } from '../../roadmap/stepSchedule.ts'
import { engine } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import type { Step } from '../../roadmap/types.ts'
import { badgeLabel, stepContract } from './stepContract.ts'
import { stepExportView } from './stepExport.ts'
import { statusOf } from './statusWord.ts'
import { laneReadings } from './planLanes.ts'
import type { StepVarContext } from './stepVars.ts'

type Row = Record<string, unknown>
const fixtures = allFixtures()
const ctxOf = (f: Fixture): StepVarContext => {
  const snapshot = f.snapshot
  return { snapshot, mapping: f.mapping, nameOf: (id) => snapshot.users.find((u) => u.id === id)?.displayName ?? id, signature: 'IT', operatorId: null, now: snapshot.asOf }
}

// ---- 1. Needs attention never exports Healthy ----

test('S7.1: every artifact carries the badge as the step’s one state, so a Needs attention row never leaves as Healthy', () => {
  let attention = 0
  for (const f of fixtures) {
    const run = runFixture(f)
    const ctx = ctxOf(f)
    const view = (s: Step) => stepExportView(s, ctx)
    for (const s of run.steps) {
      const v = view(s)
      const badge = badgeLabel(stepContract(s, ctx))
      assert.equal(v.state, badge, `${f.name}/${s.id}: the export view's state is the badge`)
      assert.equal(stateLine(v), badge === '' ? null : badge, `${f.name}/${s.id}: the artifact's state line is the badge and nothing joined to it`)
      assert.equal('condition' in v || 'stage' in v, false, `${f.name}/${s.id}: no second state model leaves in the view`)
      if (statusOf(s).word !== 'Needs attention') continue
      attention++
      assert.equal(v.state, 'Needs attention', `${f.name}/${s.id}: the row's word is the export's state`)
      assert.doesNotMatch(stepArtifactLines(v).join(' | '), /Healthy/, `${f.name}/${s.id}: the calendar entry says what the row says`)
    }
    const ics = buildIcs(run.steps, f.name, f.planId, view)
    assert.doesNotMatch(ics, /Healthy/, `${f.name}: no calendar entry reads Healthy`)
    const bundle = groundingBundle({ view, tenant: f.name, snapshot: f.snapshot, coverage: run.coverage, steps: run.steps, schedule: run.schedule, redacted: true, generated: '2026-09-12' }) as unknown as { plan: { steps: Row[] } }
    for (const row of bundle.plan.steps) {
      assert.equal('condition' in row || 'stage' in row, false, `${f.name}/${String(row.id)}: the bundle carries no second state model`)
      const s = run.steps.find((x) => x.id === row.id)
      if (s) assert.equal(row.state, view(s).state, `${f.name}/${s.id}: the bundle's state is the view's`)
    }
  }
  assert.ok(attention > 0, 'the corpus holds a Needs attention row to check')
})

// ---- 2. review-required enforced never says In place / Already satisfied ----

const WEEK2 = fixtures.find((f) => f.name === 'demo-week2')!
const ADMINS = stepIdForGoal('admins-phishing-resistant')
const rowsOf = (snap: Fixture['snapshot']): Row[] => (snap.config.caPolicies?.rows ?? []) as Row[]

/** The week-two admins policy, enforced and owned on the last scan, rescanned after its grant drifted somewhere the plan did not ask. */
function driftedEnforced(): { step: Step; steps: Step[]; snapshot: Fixture['snapshot'] } {
  const owned = runFixture(WEEK2).steps.find((s) => s.id === ADMINS)!.tracking!.policyId as string
  const row0 = rowsOf(WEEK2.snapshot).find((p) => p.id === owned)!
  const seenAt = new Date(Date.parse(WEEK2.snapshot.asOf) - 10 * 86_400_000).toISOString()
  const prior: Record<string, StepObservationRecord> = { [ADMINS]: { members: { [SOLE_MEMBER]: { artifact: artifactIdOf(String(row0.id)), state: 'enforced', semantics: semanticsOf(row0), fields: semanticFieldsOf(row0), firstSeenAt: seenAt, since: 'first-scan', lastSeenAt: seenAt, evidenceAt: null } }, unattributed: null } }
  const snapshot = structuredClone(WEEK2.snapshot)
  const row = rowsOf(snapshot).find((p) => p.id === owned)!
  row.grantControls = { operator: 'OR', builtInControls: ['block'] }
  const run = runFixture({ ...WEEK2, snapshot })
  const step = run.steps.find((s) => s.id === ADMINS)!
  assert.equal(step.status, 'done', 'the case is real: generation still reads the drifted policy as delivering the goal')
  applyProgress(run.steps, snapshot, run.coverage, WEEK2.planId, undefined, null, prior)
  return { step, steps: run.steps, snapshot }
}

test('S7.2: an enforced policy that no longer means what the plan asked for is Enforced · Review required everywhere, never In place or Already satisfied', () => {
  const { step, steps, snapshot } = driftedEnforced()
  assert.equal(step.state.condition, 'review-required')
  assert.equal(step.state.lifecycle, 'enforced', 'a condition, never a stage: the policy stays where it is')
  assert.equal(step.state.satisfied, false, 'the delivery claim is withdrawn')
  assert.notEqual(step.status, 'done')
  assert.ok(heldForReview(step), 'held for review in its stage')
  const name = step.tracking!.members[0].policyName
  assert.equal(step.history.at(-1)?.note, fillText(engine.tracking.reviewWithdrawn, { name }), 'the history says why the claim went')
  const ctx: StepVarContext = { ...ctxOf(WEEK2), snapshot }
  const c = stepContract(step, ctx)
  const v = stepExportView(step, ctx)
  const word = 'Enforced · Review required'
  assert.equal(statusOf(step).word, word, 'the row')
  assert.equal(badgeLabel(c), word, 'the badge')
  assert.equal(v.state, word, 'the export')
  assert.equal(stateLine(v), word, 'the calendar entry')
  for (const line of [...c.doneWhen, ...v.doneWhen, c.whatToDo.text, ...v.whatToDo]) assert.doesNotMatch(line, /Already satisfied|In place/, `never a delivery claim: ${line}`)
  assert.ok(c.fix.some((x) => x.key.startsWith('review:')), 'the review is the fix')
  assert.notEqual(laneReadings(steps).get(step.id)?.lane, 'Completed', 'and the lane is not Completed')
})

// ---- 3. Fix never claims creation blocked when only enforcement is ----

test('S7.3: while the plan dates the report-only create, no readiness wait is listed under Fix before continuing', () => {
  let creating = 0
  for (const f of fixtures) {
    const run = runFixture(f)
    const ctx = ctxOf(f)
    for (const s of run.steps) {
      if (scheduleOf(s).transition !== 'createReportOnly') continue
      // The step's own threshold is a wait on every reading (stepContract.ts thresholdBinding); the other readiness bindings are the ones at issue.
      const waits = s.blockers.filter((b) => b.kind === 'readiness' && typeof b.binding === 'string' && !/readiness reaches/.test(b.binding)).map((b) => b.binding as string)
      if (waits.length === 0) continue
      creating++
      const c = stepContract(s, ctx)
      for (const w of waits) assert.equal(c.fix.some((x) => x.text === w), false, `${f.name}/${s.id}: "${w}" holds the enforcement, not the create the step says to do`)
      assert.match(c.whatToDo.text, /report-only/, `${f.name}/${s.id}: the next action is the report-only create`)
      // The same step with no finished plan behind it dates nothing, and then the waits are what it says it waits on.
      const bare = { ...s, scheduled: undefined } as Step
      const held = stepContract(bare, ctx)
      for (const w of waits) assert.ok(held.fix.some((x) => x.text === w), `${f.name}/${s.id}: undated, "${w}" is listed`)
    }
  }
  assert.ok(creating > 0, 'the corpus holds a readiness-gated create to check')
})
