// Policy ownership across drift (S1, Plan Actionability + Trust Correction).
//
// Once a tenant policy is a member's, a drift in it never erases the tie or
// hands the member to another candidate (tracking.ts matchMembers stage 0: the
// member's own record of the last scan). A correction is offered only against
// the policy the member owns and no other goal stands on; otherwise the step is
// Review required with its reason, and no candidate is substituted
// (tracking.ts correctionOf). What a drift comes to is exactly one of three
// outcomes (tracking.ts driftOutcomeOf).
//
// The audit items A1–A6 the segment names are not in the repository
// (docs/product/actionability/BLOCKED.md); their tests are deferred with them.
// The tests below are one per drift kind, and the invariants.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { applyProgress } from './progress.ts'
import { stepIdForGoal } from './generate.ts'
import { artifactIdOf, semanticFieldsOf, semanticsOf } from './observation.ts'
import type { StepObservation, StepObservationRecord } from './observation.ts'
import { SOLE_MEMBER, driftOutcomeOf, matchMembers } from './tracking.ts'
import type { DriftOutcome } from './tracking.ts'
import type { Step } from './types.ts'

type Row = Record<string, unknown>
const fixtures = allFixtures()
const DEMO = fixtures.find((f) => f.name === 'demo')!
const WEEK2 = fixtures.find((f) => f.name === 'demo-week2')!
const ADMINS = stepIdForGoal('admins-phishing-resistant')
const TEN_DAYS = 10 * 86_400_000
const OUTCOMES: DriftOutcome[] = ['correctable', 'review-required', 'on-hold']

const rowsOf = (snap: { config: { caPolicies?: { rows?: unknown[] } | null } }): Row[] => (snap.config.caPolicies?.rows ?? []) as Row[]

/** The object the admins step is delivered by on an untouched scan of a fixture. */
const ownedId = (f: typeof DEMO): string => runFixture(f).steps.find((s) => s.id === ADMINS)!.tracking!.policyId as string

/** The record the last scan of `f` left behind for the admins step: the object it watched, in the state it saw. */
function priorOf(f: typeof DEMO, state: StepObservation['state'], over: Partial<StepObservation> = {}): Record<string, StepObservationRecord> {
  const row = rowsOf(f.snapshot).find((p) => p.id === ownedId(f))!
  const seenAt = new Date(Date.parse(f.snapshot.asOf) - TEN_DAYS).toISOString()
  return { [ADMINS]: { members: { [SOLE_MEMBER]: { artifact: artifactIdOf(String(row.id)), state, semantics: semanticsOf(row), fields: semanticFieldsOf(row), firstSeenAt: seenAt, since: 'first-scan', lastSeenAt: seenAt, evidenceAt: null, ...over } }, unattributed: null } }
}

/**
 * A second scan of a tenant: the owned admins policy edited however the case
 * needs, the plan derived afresh from that snapshot, and the record of the
 * previous scan carried in. `before` may edit the freshly generated plan or its
 * coverage before tracking runs — a regeneration that now prefers another
 * candidate, or another goal standing on the policy.
 */
function rescan(f: typeof DEMO, edit: (row: Row, snapshot: typeof DEMO.snapshot) => void, prior: Record<string, StepObservationRecord> | null, before: (step: Step, run: ReturnType<typeof runFixture>) => void = () => {}): Step {
  const snapshot = structuredClone(f.snapshot)
  const row = rowsOf(snapshot).find((p) => p.id === ownedId(f))!
  edit(row, snapshot)
  const run = runFixture({ ...f, snapshot })
  const step = run.steps.find((s) => s.id === ADMINS)!
  before(step, run)
  applyProgress(run.steps, snapshot, run.coverage, f.planId, undefined, null, prior)
  return step
}

/** The invariant every drift case asserts: the member still owns the object it watched, and the outcome is one of three. */
function assertOwned(step: Step, f: typeof DEMO, outcome?: DriftOutcome): DriftOutcome {
  const id = ownedId(f)
  assert.equal(step.tracking?.policyId, id, 'the member still owns the policy it watched')
  assert.equal(step.state.observation?.latest.artifact, artifactIdOf(id), 'and the record still names it')
  const got = driftOutcomeOf(step)
  assert.ok(got !== null && OUTCOMES.includes(got), `a drift comes to one of ${OUTCOMES.join(' | ')}, got ${String(got)}`)
  if (outcome) assert.equal(got, outcome)
  return got as DriftOutcome
}

// ---- the invariant ----

test('ownership: a policy the member owns is kept across a drift that its fingerprint no longer survives', () => {
  const prior = priorOf(DEMO, 'report-only')
  // Rewritten into something the goal does not recognise as its own: without the
  // record, the scan may not find the policy for this step at all.
  const edit = (row: Row): void => {
    row.grantControls = { operator: 'OR', builtInControls: ['block'] }
    row.conditions = { users: { includeUsers: ['All'] }, applications: { includeApplications: ['None'] } }
  }
  const kept = rescan(DEMO, edit, prior)
  assertOwned(kept, DEMO, 'review-required')
  assert.equal(kept.state.observation?.changed, 'semantics')
  assert.equal(kept.state.observation?.reviewRequired, true, 'a person looks; the tie is not broken')
  // The same scan with no record: whatever the chain finds, it is not the record that found it.
  const bare = rescan(DEMO, edit, null)
  assert.notEqual(bare.tracking?.members[0].matchedBy, 'owned')
})

test('ownership: a regeneration that prefers another candidate does not move the member; the correction is Review required, and no candidate is substituted', () => {
  const prior = priorOf(DEMO, 'report-only')
  const owned = ownedId(DEMO)
  const other = rowsOf(DEMO.snapshot).find((p) => p.id !== owned)!
  const retarget = (step: Step): void => {
    const ops = step.action.resolution?.policies ?? []
    assert.equal(ops.length, 1, 'one required member')
    assert.equal(ops[0].mode, 'update', 'the admins step corrects the policy it found')
    ops[0] = { ...ops[0], mode: 'update', policyId: String(other.id) }
  }
  const step = rescan(DEMO, () => {}, prior, retarget)
  assertOwned(step, DEMO, 'review-required')
  const m = step.tracking!.members[0]
  assert.equal(m.policyId, owned, 'the member was not handed to the operation’s new target')
  assert.equal(m.matchedBy, 'owned', 'tied by the record, since nothing on the tenant ties it now')
  assert.deepEqual(m.correction && { safe: m.correction.safe, reason: m.correction.safe ? null : m.correction.reason }, { safe: false, reason: 'unowned-target' })
  assert.match(m.correction && !m.correction.safe ? m.correction.note : '', /a person decides which one this step delivers/)
  // The condition is raised to Review required unless the step already carries
  // one that binds harder (lifecycle.ts raiseCondition); the outcome reads the member either way.
  assert.ok(step.state.condition === 'review-required' || step.state.condition === 'blocked', step.state.condition)
  assert.equal(m.ready, false, 'nothing is handed over against a policy the member does not own')
  assert.equal(step.action.resolution?.policies[0].policyId, String(other.id), 'and the operation is left as written rather than rewritten against a substitute')
  // Without the record, the operation’s target would have taken the member: the record is what prevents the transfer.
  const moved = rescan(DEMO, () => {}, null, retarget)
  assert.equal(moved.tracking?.policyId, String(other.id))
})

test('ownership: a correction of a policy another goal counts as its satisfier is Review required with the reason', () => {
  const prior = priorOf(DEMO, 'report-only')
  const owned = ownedId(DEMO)
  const share = (step: Step, run: ReturnType<typeof runFixture>): void => {
    // The runner memoises coverage per fixture: this scan's reading is its own copy.
    run.coverage = structuredClone(run.coverage)
    const other = run.coverage.results.find((r) => r.goal.id !== step.goalId)!
    other.satisfaction = { policyIds: [owned], policyNames: ['Shared'], sufficientId: owned, sufficientName: 'Shared' }
  }
  const step = rescan(DEMO, () => {}, prior, share)
  assertOwned(step, DEMO, 'review-required')
  const m = step.tracking!.members[0]
  assert.equal(m.correction?.safe, false, JSON.stringify(m.correction))
  assert.equal(m.correction && !m.correction.safe ? m.correction.reason : null, 'shared-satisfier', JSON.stringify(m.correction))
  assert.match(m.correction && !m.correction.safe ? m.correction.note : '', /also satisfies .*; a person decides/)
  assert.equal(m.ready, false)
  // The same policy, claimed by nobody else: the correction is the member's own to make.
  const alone = rescan(DEMO, () => {}, prior)
  assert.deepEqual(alone.tracking?.members[0].correction, { safe: true })
})

test('ownership: the record resolves a member before the tenant is searched, and reports the strongest proof this scan still holds', () => {
  const run = runFixture(DEMO)
  const step = run.steps.find((s) => s.id === ADMINS)!
  const prior = priorOf(DEMO, 'report-only')
  const [withRecord] = matchMembers(step, DEMO.snapshot, run.coverage, DEMO.planId, prior[ADMINS])
  const [without] = matchMembers(step, DEMO.snapshot, run.coverage, DEMO.planId)
  assert.equal(withRecord.policy?.id, without.policy?.id, 'the same object either way on an unchanged tenant')
  assert.equal(withRecord.matchedBy, without.matchedBy, 'and the tie is reported by the proof the tenant holds, not by the record')
  assert.notEqual(withRecord.matchedBy, 'owned')
})

test('outcomes: every deployed, undone step of every fixture reads exactly one of the three, and nothing else reads one', () => {
  for (const f of fixtures) {
    for (const s of runFixture(f).steps) {
      const got = driftOutcomeOf(s)
      const deployed = (s.tracking?.members ?? []).some((m) => m.policyId !== null)
      if (s.status === 'done' || s.status === 'skipped' || !deployed) assert.equal(got, null, `${f.name} ${s.id} has nothing owned to drift`)
      else assert.ok(got !== null && OUTCOMES.includes(got), `${f.name} ${s.id}: ${String(got)}`)
    }
  }
})

// ---- one per drift kind: the member keeps its policy, and the outcome is one of three ----

test('drift:grant — the grant moves somewhere the plan did not ask', () => {
  const step = rescan(DEMO, (row) => {
    row.grantControls = { operator: 'OR', builtInControls: ['block'] }
  }, priorOf(DEMO, 'report-only'))
  assertOwned(step, DEMO, 'review-required')
  assert.equal(step.state.observation?.reviewRequired, true)
})

test('drift:client-app — the client app types narrow', () => {
  const step = rescan(DEMO, (row) => {
    row.conditions = { ...(row.conditions as Row), clientAppTypes: ['browser'] }
  }, priorOf(DEMO, 'report-only'))
  assertOwned(step, DEMO, 'review-required')
  assert.equal(step.state.observation?.reviewRequired, true)
})

test('drift:include — who the policy names changes', () => {
  const step = rescan(DEMO, (row) => {
    const users = (row.conditions as { users: Row }).users
    row.conditions = { ...(row.conditions as Row), users: { ...users, includeRoles: [], includeUsers: ['All'] } }
  }, priorOf(DEMO, 'report-only'))
  assertOwned(step, DEMO, 'review-required')
  assert.equal(step.state.observation?.reviewRequired, true)
})

test('drift:exclusion — the carve-out is dropped', () => {
  const step = rescan(DEMO, (row) => {
    const users = (row.conditions as { users: Row }).users
    row.conditions = { ...(row.conditions as Row), users: { ...users, excludeGroups: [], excludeUsers: [] } }
  }, priorOf(DEMO, 'report-only'))
  assertOwned(step, DEMO, 'review-required')
  assert.equal(step.state.observation?.reviewRequired, true)
})

test('drift:location — a location condition appears', () => {
  const step = rescan(DEMO, (row) => {
    row.conditions = { ...(row.conditions as Row), locations: { includeLocations: ['All'], excludeLocations: ['AllTrusted'] } }
  }, priorOf(DEMO, 'report-only'))
  assertOwned(step, DEMO, 'review-required')
  assert.equal(step.state.observation?.reviewRequired, true)
})

test('drift:platform — a platform condition appears', () => {
  const step = rescan(DEMO, (row) => {
    row.conditions = { ...(row.conditions as Row), platforms: { includePlatforms: ['windows'], excludePlatforms: [] } }
  }, priorOf(DEMO, 'report-only'))
  assertOwned(step, DEMO, 'review-required')
  assert.equal(step.state.observation?.reviewRequired, true)
})

test('drift:report-only-before-enforcement — an enforced policy moved back to report-only stays the member’s, and is not a person’s question', () => {
  const step = rescan(WEEK2, (row) => {
    row.state = 'enabledForReportingButNotEnforced'
  }, priorOf(WEEK2, 'enforced'))
  const outcome = assertOwned(step, WEEK2)
  assert.equal(step.state.observation?.changed, 'state', 'the meaning did not move')
  assert.equal(step.state.observation?.reviewRequired, false)
  assert.equal(step.state.lifecycle, 'report-only')
  assert.notEqual(outcome, 'review-required', 'it is corrected by enforcing it again, or held by whatever holds enforcement')
})
