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
// The audit's findings A1–A6 (docs/product/actionability/reference/audit-a1-a6.md)
// are reproduced at the end of this file, each against the fixture the audit
// names, asserting its correction direction (A4). Before them: one test per
// drift kind, and the invariants.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, curatedFixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { applyProgress } from './progress.ts'
import { stepIdForGoal } from './generate.ts'
import { holdOf } from './holds.ts'
import { nextSafeAction } from './nextSafeAction.ts'
import { unavailableReason } from './operations.ts'
import { laneReadings } from '../ui/surfaces/planLanes.ts'
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

// ---- the audit's findings, each against the fixture it names (A4) ----
//
// "demo-week2 with references answered" is the curated week-two demo: the
// same tenant with the baseline's unsettled source groups answered, so nothing
// but the drift holds a step. Each case mutates one tenant policy the way the
// audit's Evidence column describes and asserts its Correction direction
// (docs/product/actionability/reference/audit-a1-a6.md).

const ANSWERED = curatedFixture('demo-week2')
const MFA_ALL = 'Core - Grant - MFA for all users'
const LEGACY = 'Core - Block - Legacy authentication'
const TOKEN = 'Core - Session - Token protection'

/** The week-two demo with one policy edited, derived afresh with no record of an earlier scan — the audit's own probe. */
function mutated(edit: (policy: Row, snapshot: Fixture['snapshot']) => void, name: string): ReturnType<typeof runFixture> {
  const snapshot = structuredClone(ANSWERED.snapshot)
  const row = rowsOf(snapshot).find((p) => p.displayName === name)
  assert.ok(row, `the premise: the demo carries ${name}`)
  edit(row, snapshot)
  return runFixture({ ...ANSWERED, snapshot })
}

const stepOf = (run: ReturnType<typeof runFixture>, goal: string): Step => run.steps.find((s) => s.id === stepIdForGoal(goal))!
const goalOf = (run: ReturnType<typeof runFixture>, goal: string) => run.coverage.results.find((r) => r.goal.id === goal)!
const conditions = (row: Row): Row => row.conditions as Row
const users = (row: Row): Row => conditions(row).users as Row

test('A1: when the MFA-for-all policy drifts, the correction never edits another goal’s policy', () => {
  const run = mutated((row) => {
    row.grantControls = { operator: 'OR', builtInControls: ['compliantDevice'] }
  }, MFA_ALL)
  const step = stepOf(run, 'mfa-all-users')
  assert.equal(goalOf(run, 'admins-phishing-resistant').verdict, 'inPlace', 'the premise: the admins goal is still delivered by its own policy')
  const claimed = new Set(run.coverage.results.filter((r) => r.goal.id !== 'mfa-all-users').flatMap((r) => r.satisfaction?.policyIds ?? []))
  let foreign = 0
  for (const m of step.tracking?.members ?? []) {
    const op = step.action.resolution?.policies.find((o) => o.memberKey === m.key) ?? step.action.resolution?.policies[0]
    if (!op || op.mode !== 'update' || (op.policyId === m.policyId && !claimed.has(op.policyId))) continue
    foreign += 1
    // Only a policy the goal itself owns and no other goal claims is corrected; otherwise the step holds with the reason.
    assert.equal(m.correction?.safe, false, JSON.stringify(m.correction))
    assert.ok(m.correction && !m.correction.safe && m.correction.note.length > 0, 'the hold explains itself')
    assert.equal(m.ready, false)
  }
  assert.equal(foreign, 1, 'the premise: the regeneration wrote its update against the admins policy')
  assert.equal(driftOutcomeOf(step), 'review-required')
  assert.equal(nextSafeAction(step).executable, false, 'nothing against another goal’s policy is handed over')
})

test('A2: a policy excluding a group the scan cannot resolve keeps its goal on the plan, held until the exclusion can be verified', () => {
  const before = runFixture(ANSWERED).steps.map((s) => s.id)
  const run = mutated((row) => {
    users(row).excludeGroups = [...(users(row).excludeGroups as string[]), '11111111-2222-4333-8444-555555555555']
  }, LEGACY)
  assert.deepEqual(run.steps.map((s) => s.id).filter((id) => !before.includes(id)), [], 'no step appeared')
  assert.deepEqual(before.filter((id) => !run.steps.some((s) => s.id === id)), [], 'no baseline goal was dropped')
  const step = stepOf(run, 'block-legacy-auth')
  assert.equal(goalOf(run, 'block-legacy-auth').status, 'unknown', 'the premise: coverage cannot settle the goal')
  assert.notEqual(holdOf(step), null, 'the step is held, not dropped')
  assert.ok(step.blockers.some((b) => b.kind === 'evidence' && b.unverified === true && /group/i.test(b.binding ?? '')), JSON.stringify(step.blockers))
  assert.equal(laneReadings(run.steps).get(step.id)?.lane, 'On Hold')
  assert.ok(!(step.action.resolution?.policies ?? []).some((o) => o.mode === 'create'), 'no duplicate policy is proposed')
})

for (const [what, edit] of [
  ['client apps', (row: Row): void => { conditions(row).clientAppTypes = ['exchangeActiveSync'] }],
  ['grant', (row: Row): void => { row.grantControls = { operator: 'OR', builtInControls: ['mfa'] } }],
] as const) {
  test(`A3: ${what} drift on the name-matched legacy-auth policy reads as drift to review or correct, never as a missing policy`, () => {
    const run = mutated(edit, LEGACY)
    const step = stepOf(run, 'block-legacy-auth')
    const policy = rowsOf(ANSWERED.snapshot).find((p) => p.displayName === LEGACY)!
    assert.ok(!(step.action.resolution?.policies ?? []).some((o) => o.mode === 'create'), 'no "(2)" duplicate is offered')
    assert.equal(step.tracking?.policyId, policy.id, 'the step tracks the policy that carries its name')
    assert.notEqual(step.status, 'done')
    const outcome = driftOutcomeOf(step)
    assert.ok(outcome === 'review-required' || outcome === 'correctable', String(outcome))
  })
}

for (const [what, edit] of [
  ['location', (row: Row): void => { conditions(row).locations = { includeLocations: ['All'], excludeLocations: ['AllTrusted'] } }],
  ['platform', (row: Row): void => { conditions(row).platforms = { includePlatforms: ['windows'], excludePlatforms: [] } }],
] as const) {
  test(`A4: ${what} drift on an enforced block policy is a stated manual correction, not an empty update held for a rebuild`, () => {
    const run = mutated(edit, LEGACY)
    const step = stepOf(run, 'block-legacy-auth')
    assert.notEqual(unavailableReason(step), 'no-operation', 'the row no longer waits for a scan to rebuild the step')
    const update = (step.action.resolution?.policies ?? []).find((o) => o.mode === 'update')
    const submits = update !== undefined && Object.keys(update.body).length > 0
    if (!submits) {
      assert.equal(step.state.condition, 'review-required', 'a change the plan does not write is said plainly')
      assert.match(step.state.observation?.note ?? '', new RegExp(what === 'location' ? 'locations' : 'platforms', 'i'))
      assert.equal(step.tracking?.members[0].correction?.safe, false)
    }
  })
}

test('A5: a report-only policy whose conditions drifted is not offered for enforcement', () => {
  const clean = stepOf(runFixture(ANSWERED), 'token-protection')
  assert.equal(clean.state.lifecycle, 'ready-to-enforce', 'the premise: undrifted, the policy is ready to enforce')
  const run = mutated((row) => {
    conditions(row).locations = { includeLocations: ['All'], excludeLocations: ['AllTrusted'] }
  }, TOKEN)
  const step = stepOf(run, 'token-protection')
  assert.notEqual(step.state.lifecycle, 'ready-to-enforce')
  assert.equal(step.tracking?.members[0].ready, false)
  assert.equal(nextSafeAction(step).enforceable, false)
  assert.equal(step.state.condition, 'review-required', 'the conditions were compared before enforcement was offered')
  assert.match(step.state.observation?.note ?? '', /locations/i)
})

test('A6: an ordinary person excluded from MFA-for-all is a coverage gap, as it is for the legacy-auth block', () => {
  const member = ANSWERED.snapshot.users.find((u) => (u.userPrincipalName ?? '').startsWith('user10@'))!
  assert.equal(member.userType, 'member')
  for (const name of [MFA_ALL, LEGACY]) {
    const goal = name === MFA_ALL ? 'mfa-all-users' : 'block-legacy-auth'
    const run = mutated((row) => {
      users(row).excludeUsers = [member.id]
    }, name)
    const result = goalOf(run, goal)
    assert.notEqual(result.verdict, 'inPlace', `${goal}: an unauthorised exclusion left the goal in place`)
    assert.ok(result.reasons.some((r) => r.kind === 'excluded' && !r.expected && r.userIds.includes(member.id)), JSON.stringify(result.reasons))
    assert.equal(stepOf(run, goal).kind, 'adjust', 'the correction is offered on the policy')
  }
  // The audit's `user4` is one of the demo's two guests, and Guests MFA covers
  // guests: excluding them from the all-users policy leaves the goal delivered.
  const guest = ANSWERED.snapshot.users.find((u) => (u.userPrincipalName ?? '').startsWith('user4@'))!
  assert.equal(guest.userType, 'guest')
  assert.equal(goalOf(mutated((row) => { users(row).excludeUsers = [guest.id] }, MFA_ALL), 'mfa-all-users').verdict, 'inPlace')
})
