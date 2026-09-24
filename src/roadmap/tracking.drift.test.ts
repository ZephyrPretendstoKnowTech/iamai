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
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { applyProgress } from './progress.ts'
import { stepIdForGoal } from './generate.ts'
import { holdOf } from './holds.ts'
import { nextSafeAction } from './nextSafeAction.ts'
import { awaitsWorkflowRecord, unavailableReason } from './operations.ts'
import { laneReadings } from '../ui/surfaces/planLanes.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import { stepExportView } from '../ui/surfaces/stepExport.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { content, shared } from '../content/content.ts'
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

  // On an unchanged tenant the record resolves the member before the tenant is
  // searched, and reports the strongest proof this scan still holds.
  const run = runFixture(DEMO)
  const step = run.steps.find((s) => s.id === ADMINS)!
  const [withRecord] = matchMembers(step, DEMO.snapshot, run.coverage, DEMO.planId, prior[ADMINS])
  const [without] = matchMembers(step, DEMO.snapshot, run.coverage, DEMO.planId)
  assert.equal(withRecord.policy?.id, without.policy?.id, 'the same object either way on an unchanged tenant')
  assert.equal(withRecord.matchedBy, without.matchedBy, 'and the tie is reported by the proof the tenant holds, not by the record')
  assert.notEqual(withRecord.matchedBy, 'owned')
})

test('ownership: a correction against another candidate or a policy another goal stands on is Review required with its reason, and no candidate is substituted', () => {
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

  // A correction of a policy another goal counts as its satisfier.
  const share = (step: Step, run: ReturnType<typeof runFixture>): void => {
    // The runner memoises coverage per fixture: this scan's reading is its own copy.
    run.coverage = structuredClone(run.coverage)
    const other = run.coverage.results.find((r) => r.goal.id !== step.goalId)!
    other.satisfaction = { policyIds: [owned], policyNames: ['Shared'], sufficientId: owned, sufficientName: 'Shared' }
  }
  const shared = rescan(DEMO, () => {}, prior, share)
  assertOwned(shared, DEMO, 'review-required')
  const sm = shared.tracking!.members[0]
  assert.equal(sm.correction?.safe, false, JSON.stringify(sm.correction))
  assert.equal(sm.correction && !sm.correction.safe ? sm.correction.reason : null, 'shared-satisfier', JSON.stringify(sm.correction))
  assert.match(sm.correction && !sm.correction.safe ? sm.correction.note : '', /also satisfies .*; a person decides/)
  assert.equal(sm.ready, false)
  // The same policy, claimed by nobody else: the correction is the member's own to make.
  const alone = rescan(DEMO, () => {}, prior)
  assert.deepEqual(alone.tracking?.members[0].correction, { safe: true })
})

test('outcomes: every deployed, undone step of every fixture reads exactly one of the three, and nothing else reads one', () => {
  for (const f of fixtures) {
    for (const s of runFixture(f).steps) {
      const got = driftOutcomeOf(s)
      const deployed = (s.tracking?.members ?? []).some((m) => m.policyId !== null)
      // A goal the tenant's enforced policy delivers, open only for its workflow record, has not drifted either.
      if (s.status === 'done' || s.status === 'skipped' || !deployed || awaitsWorkflowRecord(s)) assert.equal(got, null, `${f.name} ${s.id} has nothing owned to drift`)
      else assert.ok(got !== null && OUTCOMES.includes(got), `${f.name} ${s.id}: ${String(got)}`)
    }
  }
})

// ---- one per drift kind: the member keeps its policy, and the outcome is one of three ----

const DRIFTS: [string, (row: Row) => void][] = [
  ['grant: the grant moves somewhere the plan did not ask', (row) => { row.grantControls = { operator: 'OR', builtInControls: ['block'] } }],
  ['client-app: the client app types narrow', (row) => { row.conditions = { ...(row.conditions as Row), clientAppTypes: ['browser'] } }],
  ['include: who the policy names changes', (row) => {
    const users = (row.conditions as { users: Row }).users
    row.conditions = { ...(row.conditions as Row), users: { ...users, includeRoles: [], includeUsers: ['All'] } }
  }],
  ['exclusion: the carve-out is dropped', (row) => {
    const users = (row.conditions as { users: Row }).users
    row.conditions = { ...(row.conditions as Row), users: { ...users, excludeGroups: [], excludeUsers: [] } }
  }],
  ['location: a location condition appears', (row) => { row.conditions = { ...(row.conditions as Row), locations: { includeLocations: ['All'], excludeLocations: ['AllTrusted'] } } }],
  ['platform: a platform condition appears', (row) => { row.conditions = { ...(row.conditions as Row), platforms: { includePlatforms: ['windows'], excludePlatforms: [] } } }],
]

test('drift of every kind: the member keeps its policy and a person reviews it', () => {
  for (const [label, edit] of DRIFTS) {
    const step = rescan(DEMO, edit, priorOf(DEMO, 'report-only'))
    assertOwned(step, DEMO, 'review-required')
    assert.equal(step.state.observation?.reviewRequired, true, label)
  }
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

// With the plan's foundation settled (roadmap/foundations.ts): these cases are
// about drift in a policy the plan would otherwise be offering.
const ANSWERED = withFoundationSettled(curatedFixture('demo-week2'))
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

const driftToDevice = (row: Row): void => {
  row.grantControls = { operator: 'OR', builtInControls: ['compliantDevice'] }
}
const mfaAllId = String(rowsOf(ANSWERED.snapshot).find((p) => p.displayName === MFA_ALL)?.id)

test('A1: when the MFA-for-all policy drifts, the correction never edits another goal’s policy, and a policy the plan identifies is never duplicated', () => {
  const run = mutated(driftToDevice, MFA_ALL)
  const step = stepOf(run, 'mfa-all-users')
  assert.equal(goalOf(run, 'admins-phishing-resistant').verdict, 'inPlace', 'the premise: the admins goal is still delivered by its own policy')
  const claimed = new Set(run.coverage.results.filter((r) => r.goal.id !== 'mfa-all-users').flatMap((r) => r.satisfaction?.policyIds ?? []))
  assert.ok(claimed.size > 0, 'the premise: other goals stand on policies of their own')
  // The regeneration used to write its update against the admins policy — the
  // first candidate in scan order. Since C01 the step never takes another goal's
  // policy as its target: the invariant is asserted directly.
  const ops = step.action.resolution?.policies ?? []
  for (const op of ops) {
    assert.ok(op.mode !== 'update' || !claimed.has(op.policyId), `no update is written against another goal’s policy (${op.mode === 'update' ? op.policyId : ''})`)
  }
  assert.equal(step.tracking?.policyId != null && claimed.has(step.tracking.policyId), false, 'nor is another goal’s policy tracked as this step’s')
  // With no tag, no record of an earlier scan and not the plan's name, nothing
  // identifies the drifted policy as this goal's: an All users policy requiring a
  // compliant device is another goal's shape too. It stays as it is, and the
  // goal's own policy is created beside it in report-only, which enforces nothing.
  assert.deepEqual(ops.map((o) => o.mode), ['create'], 'the goal’s own policy is created; nothing is updated')
  assert.equal(ops[0].body.state, 'enabledForReportingButNotEnforced')
  assert.notEqual(step.tracking?.policyId ?? null, mfaAllId, 'the untracked policy is not taken for the goal’s own')

  // A drifted MFA-for-all policy the plan identifies, by its tag or the plan’s
  // own name, is the step’s own and never duplicated.
  const planName = String(ops.find((o) => o.mode === 'create')?.body.displayName)
  assert.notEqual(planName, MFA_ALL, 'the premise: the demo’s own name is not the plan’s')
  const identify: [string, (row: Row) => void][] = [
    ['tagged', (row) => { row.description = `[IAMAI:${ANSWERED.planId}:${stepIdForGoal('mfa-all-users')}]` }],
    ['named', (row) => { row.displayName = planName }],
  ]
  for (const [label, mark] of identify) {
    const step = stepOf(mutated((row) => { driftToDevice(row); mark(row) }, MFA_ALL), 'mfa-all-users')
    const ops = step.action.resolution?.policies ?? []
    assert.equal(ops.some((o) => o.mode === 'create'), false, `${label}: no duplicate is proposed beside it`)
    assert.deepEqual(ops.filter((o) => o.mode === 'update').map((o) => o.policyId), [mfaAllId], `${label}: the correction is written against the drifted policy`)
    assert.equal(step.tracking?.policyId, mfaAllId, `${label}: tracking follows it`)
    // IAMAI does not write the drifted grant back itself: a person corrects it, and the step says so.
    assert.equal(nextSafeAction(step).executable, false, `${label}: nothing is handed over`)
    assert.equal(unavailableReason(step), 'manual-correction', `${label}: held as a person’s correction, with its reason`)
  }
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

test('A3: client-app or grant drift on the name-matched legacy-auth policy reads as drift to review or correct, never as a missing policy', () => {
  for (const [what, edit] of [
    ['client apps', (row: Row): void => { conditions(row).clientAppTypes = ['exchangeActiveSync'] }],
    ['grant', (row: Row): void => { row.grantControls = { operator: 'OR', builtInControls: ['mfa'] } }],
  ] as const) {
    const run = mutated(edit, LEGACY)
    const step = stepOf(run, 'block-legacy-auth')
    const policy = rowsOf(ANSWERED.snapshot).find((p) => p.displayName === LEGACY)!
    assert.ok(!(step.action.resolution?.policies ?? []).some((o) => o.mode === 'create'), `${what}: no "(2)" duplicate is offered`)
    assert.equal(step.tracking?.policyId, policy.id, `${what}: the step tracks the policy that carries its name`)
    assert.notEqual(step.status, 'done')
    const outcome = driftOutcomeOf(step)
    assert.ok(outcome === 'review-required' || outcome === 'correctable', `${what}: ${String(outcome)}`)
  }
})

test('A4: location or platform drift on an enforced block policy is a stated manual correction, not an empty update held for a rebuild', () => {
  for (const [what, edit] of [
    ['location', (row: Row): void => { conditions(row).locations = { includeLocations: ['All'], excludeLocations: ['AllTrusted'] } }],
    ['platform', (row: Row): void => { conditions(row).platforms = { includePlatforms: ['windows'], excludePlatforms: [] } }],
  ] as const) {
    const run = mutated(edit, LEGACY)
    const step = stepOf(run, 'block-legacy-auth')
    assert.notEqual(unavailableReason(step), 'no-operation', `${what}: the row no longer waits for a scan to rebuild the step`)
    const update = (step.action.resolution?.policies ?? []).find((o) => o.mode === 'update')
    const submits = update !== undefined && Object.keys(update.body).length > 0
    if (!submits) {
      assert.equal(step.state.observation?.reviewRequired, true, `${what}: the unsubmitted change requires review`)
      assert.ok(step.state.condition === 'review-required' || step.state.condition === 'blocked' && step.blockers.some(b => b.kind === 'step' && b.stepId === 's-prereq-break-glass'), 'changed policy conditions can also reopen the recovery check')
      assert.match(step.state.observation?.note ?? '', new RegExp(what === 'location' ? 'locations' : 'platforms', 'i'))
      assert.equal(step.tracking?.members[0].correction?.safe, false)
    }
  }
})

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
  assert.equal(step.state.observation?.reviewRequired, true, 'the conditions were compared before enforcement was offered')
  assert.ok(step.state.condition === 'review-required' || step.state.condition === 'blocked' && step.blockers.some(b => b.kind === 'step' && b.stepId === 's-prereq-break-glass'), 'the location change can also reopen the emergency recovery check')
  assert.match(step.state.observation?.note ?? '', /locations/i)
})

/** Whether a channel hands over a write: a JSON request body carrying policy settings, or a script run in a mode that changes the policy. */
const handsOverWrite = (id: string, text: string): boolean =>
  (id === 'json' && /"(conditions|grantControls|sessionControls)"\s*:/.test(text)) || (id === 'ps' && /-Mode '(Correct|Create|Enforce)'/.test(text))

test('R4-10: a token-protection policy without the Cloud PC device filter is told, on the portal and in the export, to put the filter back, handed no write for it, and never read as Completed', () => {
  // R4-10 (B), on the pinned baseline: the week-two demo's token-protection
  // policy in report-only, without the baseline's Cloud PC device filter. The
  // update the step resolves is the turn-on alone, so the filter is a difference
  // that update does not write (observation.unwritten). The step said "a person
  // corrects it in the Entra admin center", while the portal kept to the
  // observe procedure and no channel named the filter. The product's own words:
  // left at No, Microsoft Entra joined Cloud PCs are blocked.
  //
  // Premise corrected on review of 978e15a7. That commit drew the package's own
  // device-filter correction module for the difference, and with it the
  // module's JSON and PowerShell: a PATCH that replaces every condition on the
  // policy, direct exclusions included, under a note that says IAMAI does not
  // write that part. The portal now carries the correction from the plan's own
  // policy in the translator's words (stepPortal.ts unwrittenCorrectionLines),
  // and no channel hands over a write for it.
  const snapshot = structuredClone(ANSWERED.snapshot)
  const row = rowsOf(snapshot).find((p) => p.displayName === TOKEN)!
  assert.ok(conditions(row).devices, 'the premise: the demo policy carries the filter')
  delete conditions(row).devices
  const run = runFixture({ ...ANSWERED, snapshot })
  const step = stepOf(run, 'token-protection')
  assert.deepEqual(step.state.observation?.unwritten, ['conditions.devices'], 'the premise: the filter is a difference the update does not write')
  const ctx: StepVarContext = { snapshot, mapping: ANSWERED.mapping, nameOf: (id) => run.input.names!.label(id), signature: 'IT', operatorId: ANSWERED.operatorId, now: snapshot.asOf, groups: ANSWERED.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  const rule = 'device.systemLabels -contains "CloudPC" -and device.trustType -eq "AzureAD"'
  const artifacts = stepBodyOf(step, ctx).artifacts
  const portal = artifacts.find((a) => a.id === 'portal')?.text() ?? ''
  assert.ok(portal.includes(rule), `the portal does not say which filter to set:\n${portal}`)
  assert.match(portal, /Filter for devices → Configure: Yes, then Exclude devices matching/)
  assert.match(portal, /not what the plan asked for in the device filter/)
  assert.equal(portal.includes(String(shared.changeUntouched)), false, 'the portal tells the operator to leave the missing filter as it is')
  for (const a of artifacts) assert.equal(handsOverWrite(a.id, a.text()), false, `the ${a.id} channel hands over a write for a part the note says IAMAI does not write:\n${a.text().slice(0, 400)}`)
  assert.ok(stepExportView(step, ctx).whatToDo.some((l) => l.includes(rule)), 'the export says a person corrects the filter and never says to what')

  // The token-protection policy the plan tagged, On without the Cloud PC filter, is never Completed: on the first scan, and after it was watched with the filter.
  {
    // Review of a27fb72d. Before it, the D7 no-op apps update was the only thing
    // that read the enforced policy against the plan's, and it read "not what the
    // plan asked for in the device filter". With the no-op gone the goal is in
    // place, the step had no operation, the difference was never computed, and
    // the step read "Completed" with "Keep the policy as it is". On a later scan
    // of a policy watched in report-only with the filter and then enforced
    // without it, the note said what was watched is no longer what is deployed
    // while the export said "IAMAI watched it get there". The product's own words
    // say that without the filter Entra-joined Cloud PCs are blocked. The step now
    // reads the policy against the whole policy the plan writes (Action.intended):
    // a person corrects the filter, and the portal says to what.
    const id = stepIdForGoal('token-protection')
    const rule = 'device.systemLabels -contains "CloudPC" -and device.trustType -eq "AzureAD"'
    const keep = String((content.pages.app as Record<string, Record<string, string>>).plan.inPlaceKeep)
    const watched = /IAMAI watched it get there/
    const row0 = rowsOf(ANSWERED.snapshot).find((p) => p.displayName === TOKEN)!
    assert.ok(conditions(row0).devices, 'the premise: the demo policy carries the filter')
    const seenAt = new Date(Date.parse(ANSWERED.snapshot.asOf) - TEN_DAYS).toISOString()
    const watchedRecord = { [id]: { members: { [SOLE_MEMBER]: { artifact: artifactIdOf(String(row0.id)), state: 'report-only', semantics: semanticsOf(row0), fields: semanticFieldsOf(row0), firstSeenAt: seenAt, since: 'first-scan', lastSeenAt: seenAt, evidenceAt: null } }, unattributed: null } } as Record<string, StepObservationRecord>
    for (const [label, prior] of [['first scan', null], ['watched in report-only with the filter', watchedRecord]] as const) {
      const snapshot = structuredClone(ANSWERED.snapshot)
      const row = rowsOf(snapshot).find((p) => p.displayName === TOKEN)!
      delete conditions(row).devices
      row.state = 'enabled'
      const run = runFixture({ ...ANSWERED, snapshot })
      if (prior) applyProgress(run.steps, snapshot, run.coverage, ANSWERED.planId, undefined, null, prior)
      const step = run.steps.find((s) => s.id === id)!
      assert.notEqual(step.status, 'done', `${label}: the step reads as finished`)
      assert.notEqual(laneReadings(run.steps).get(id)?.lane, 'Completed', `${label}: the board files the step under Completed`)
      assert.deepEqual(step.state.observation?.unwritten, ['conditions.devices'], `${label}: the filter is not read as a difference`)
      const ctx: StepVarContext = { snapshot, mapping: ANSWERED.mapping, nameOf: (x) => run.input.names!.label(x), signature: 'IT', operatorId: ANSWERED.operatorId, now: snapshot.asOf, groups: ANSWERED.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
      const portal = stepBodyOf(step, ctx).artifacts.find((a) => a.id === 'portal')?.text() ?? ''
      assert.ok(portal.includes(rule), `${label}: no channel names the filter to set:\n${portal}`)
      const exported = stepExportView(step, ctx).whatToDo
      assert.equal(exported.includes(keep), false, `${label}: the export says to keep the policy as it is`)
      assert.equal(exported.some((l) => watched.test(l)), false, `${label}: the export says IAMAI watched the policy get there`)
    }
  }
})

test('a report-only legacy-authentication block with a trusted-location exclusion is told where to look, handed no checklist that never mentions it, and never has the exclusion stated as the plan setting', () => {
  // Review of 978e15a7: the location exclusion, a difference the update does not
  // write, selected the package's generic whole-conditions correction module.
  // The observe procedure was replaced by "make sure" client apps, users,
  // resources, exclusions and grant, then "Leave Enable policy as it is and click
  // Save. Rescan in IAMAI." It never mentioned locations, so following it could
  // not close the difference, and AI Info named the module id. The portal now
  // names Locations in the manual-correction sentence, keeps the observe
  // procedure, and no channel hands over a write.
  const snapshot = structuredClone(ANSWERED.snapshot)
  const row = rowsOf(snapshot).find((p) => p.displayName === LEGACY)!
  row.state = 'enabledForReportingButNotEnforced'
  conditions(row).locations = { includeLocations: ['All'], excludeLocations: ['AllTrusted'] }
  const run = runFixture({ ...ANSWERED, snapshot })
  const step = stepOf(run, 'block-legacy-auth')
  assert.deepEqual(step.state.observation?.unwritten, ['conditions.locations'], 'the premise: the location exclusion is a difference the update does not write')
  const ctx: StepVarContext = { snapshot, mapping: ANSWERED.mapping, nameOf: (id) => run.input.names!.label(id), signature: 'IT', operatorId: ANSWERED.operatorId, now: snapshot.asOf, groups: ANSWERED.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  const artifacts = stepBodyOf(step, ctx).artifacts
  const portal = artifacts.find((a) => a.id === 'portal')?.text() ?? ''
  assert.match(portal, /not what the plan asked for in locations/, `the portal never names the difference:\n${portal}`)
  assert.doesNotMatch(portal, /click Save|make sure/i, `the portal hands over a correction that does not mention locations:\n${portal}`)
  for (const a of artifacts) assert.equal(handsOverWrite(a.id, a.text()), false, `the ${a.id} channel hands over a write for a part the note says IAMAI does not write`)
  assert.doesNotMatch(artifacts.find((a) => a.id === 'ai')?.text() ?? '', /conditions\.canonical/, 'AI Info names a package module id')

  // A difference the update does not write is never stated as the setting to keep, on any channel.
  {
    // The legacy-authentication block with a trusted-location exclusion added in
    // the tenant. The plan's policy has no location condition, and the update does
    // not write one (observation.unwritten). The update's target is the tenant's
    // policy with the patch applied, so it still carries the exclusion. The step's
    // package bound its settings from that target, and "Settings for This Action"
    // listed "Conditions → Locations → ... Exclude: All trusted locations" as the
    // setting: the drift, stated as the plan. That happened wherever the update
    // wrote something else (here, the exclusions group put back). When the
    // package's corrections began to select the unwritten fields (R4-10), it also
    // happened with the policy in report-only. Legacy authentication from a
    // trusted network stays unblocked, and the step says that is the plan.
    const cases: [string, (row: Row) => void][] = [
      ['report-only', (row) => { row.state = 'enabledForReportingButNotEnforced' }],
      ['enforced, exclusions group gone', (row) => { users(row).excludeGroups = [] }],
    ]
    for (const [label, edit] of cases) {
      const snapshot = structuredClone(ANSWERED.snapshot)
      const row = rowsOf(snapshot).find((p) => p.displayName === LEGACY)!
      conditions(row).locations = { includeLocations: ['All'], excludeLocations: ['AllTrusted'] }
      edit(row)
      const run = runFixture({ ...ANSWERED, snapshot })
      const step = stepOf(run, 'block-legacy-auth')
      assert.deepEqual(step.state.observation?.unwritten, ['conditions.locations'], `${label}: the premise: the location exclusion is a difference the update does not write`)
      const ctx: StepVarContext = { snapshot, mapping: ANSWERED.mapping, nameOf: (id) => run.input.names!.label(id), signature: 'IT', operatorId: ANSWERED.operatorId, now: snapshot.asOf, groups: ANSWERED.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
      for (const a of stepBodyOf(step, ctx).artifacts) assert.doesNotMatch(a.text(), /trusted locations|AllTrusted/i, `${label}: the ${a.id} channel states the tenant's location exclusion as the plan's setting`)
      for (const l of stepExportView(step, ctx).whatToDo) assert.doesNotMatch(l, /trusted locations|AllTrusted/i, `${label}: the export states the tenant's location exclusion as the plan's setting`)
    }
  }
})

test('a policy the tenant wrote under its own name is not told to take the plan\'s shape where the plan does not write', () => {
  // The other side of the rule above, and an owner question. The large
  // fixture's own enforced compliant-device policies deliver its goal, and the
  // settled device decision asks the plan's policy to leave Android and iOS
  // out. Reading the tenant's own policy against the plan's shape told it to
  // take Android and iOS out of its enforced compliant-device requirement: a
  // narrowing of a policy the plan never built. Only a policy the plan tagged,
  // or one carrying the name the plan gives the goal's policy, is read against
  // the plan's (generate.ts Action.intended).
  const f = withFoundationSettled(fixtures.find((x) => x.name === 'large')!)
  const run = runFixture(f)
  const step = run.steps.find((s) => s.goalId === 'require-managed-device')!
  assert.equal(step.tracking?.matchedBy, 'fingerprint', 'the premise: the tenant\'s own policy delivers the goal')
  assert.equal(step.action.intended, undefined, 'the tenant\'s own policy is read against the plan\'s')
  assert.deepEqual(step.state.observation?.unwritten ?? [], [])
  assert.equal(step.status, 'done')
})

test('a step whose policy differs where the update does not write never says to leave every other setting as it is', () => {
  // R4-10 (B): "Change only the settings listed above; leave every other setting
  // on this policy as it is" closed the update's own lines on every channel that
  // reads them (AI Info's intended result, the export). Over a policy that differs
  // in a part the update does not write, that sentence is the instruction that
  // keeps the difference: the token-protection policy without its Cloud PC
  // filter, the legacy-authentication block with a trusted-location exclusion.
  const cases: [string, string, (row: Row) => void][] = [
    ['token protection without the Cloud PC filter', TOKEN, (row) => { delete conditions(row).devices }],
    ['legacy authentication with a trusted-location exclusion', LEGACY, (row) => { row.state = 'enabledForReportingButNotEnforced'; conditions(row).locations = { includeLocations: ['All'], excludeLocations: ['AllTrusted'] } }],
  ]
  const untouched = String(shared.changeUntouched)
  for (const [label, name, edit] of cases) {
    const snapshot = structuredClone(ANSWERED.snapshot)
    edit(rowsOf(snapshot).find((p) => p.displayName === name)!)
    const run = runFixture({ ...ANSWERED, snapshot })
    const step = stepOf(run, name === TOKEN ? 'token-protection' : 'block-legacy-auth')
    assert.ok((step.state.observation?.unwritten.length ?? 0) > 0, `${label}: the premise: a difference the update does not write`)
    const ctx: StepVarContext = { snapshot, mapping: ANSWERED.mapping, nameOf: (id) => run.input.names!.label(id), signature: 'IT', operatorId: ANSWERED.operatorId, now: snapshot.asOf, groups: ANSWERED.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
    for (const a of stepBodyOf(step, ctx).artifacts) assert.equal(a.text().includes(untouched), false, `${label}: the ${a.id} channel says to leave every other setting as it is`)
    assert.equal(stepExportView(step, ctx).whatToDo.some((l) => l.includes(untouched)), false, `${label}: the export says to leave every other setting as it is`)
  }
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
