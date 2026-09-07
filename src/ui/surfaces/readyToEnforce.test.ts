// The canonical Plan case: Ready to enforce (task 007).
//
// Task 005 proved a healthy policy in report-only does not advance early and
// task 006 proved unexplained evidence holds it. This is the positive edge: the
// window has been served, the records are clean and complete, nothing is
// unresolved, and the one safe change left is to turn the policy the plan
// already deployed on. What that must and must not do:
//
//   * Ready to enforce is Foundation B's own stage, reached because both of the
//     step's real gates closed on this policy's own window and this policy's own
//     records — never because time passed, a date exists, or a policy happens to
//     be in report-only.
//   * Ready to enforce is not Enforced. The tenant's policy is still in
//     report-only at this scan; the enforcement is a planned change; and only a
//     later scan that finds the policy on writes `enforced`.
//   * the change is an update of the exact matched tenant policy, and it enforces
//     the moment it lands. Nothing creates a second policy beside one the tenant
//     already has.
//   * the update submits the one field it controls. Every other setting on that
//     policy — including a stronger one the tenant put there — survives it, on
//     every channel.
//   * Foundation A decides whether the change is handed over at all. A Ready
//     lifecycle whose way back in is unverified is offered no implementation, no
//     enforcement date and no calendar entry.
//   * a gate that goes incomplete, or evidence a person has to look at, takes
//     the enforcement away again.
//   * the rollback is the inverse of what was submitted, decided by the patch:
//     report-only for the state-only enforcement, restoring the settings for any
//     other update, and never deleting a policy this step did not create.
//
// Everything here runs the whole engine over a real fixture and then asserts
// what a person would see: the frozen Step Contract, the row, the four
// implementation channels, the export view every artifact speaks from, the
// calendar and the schedule. Nothing here builds a Step.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { observationsOf } from '../../roadmap/tracking.ts'
import type { StepObservationRecord } from '../../roadmap/observation.ts'
import { heldForReview, nextMilestone } from '../../roadmap/lifecycle.ts'
import { enforcesOnRun, finalTargets, implementationOffered, operationsOf, policyHold, unavailableReason } from '../../roadmap/operations.ts'
import { enforcementTiming, enforcementUnearned } from '../../roadmap/forecast.ts'
import { readyBasis, readyWhen } from '../../derive/readyWhen.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import type { Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { stepContract } from './stepContract.ts'
import { ifWrongLineFor, stepExportView, stepLines } from './stepExport.ts'
import { enforcesByStateOnly, jsonOffered, policyJsonText, stepOperations, updatesExistingPolicy } from './stepJson.ts'
import { powershellFor } from './stepPowerShell.ts'
import { portalNamesFor, stepPortalLines } from './stepPortal.ts'
import { stepInstructions } from './stepInstructions.ts'
import { rowReason, rowWhen } from './rowWhen.ts'
import { statusOf } from './statusWord.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

/** The one canonical case, named here so a change to it is a change to this test. */
const FIXTURE = 'demo-week2'
const STEP_ID = 's-goal-token-protection'
/** The other week-two policy: deployed the same way, two days in and not everybody seen. */
const SHORT_ID = 's-goal-block-auth-transfer'
const DAY = 86_400_000
/** An account somebody excluded from the policy by hand between two scans. */
const BY_HAND = '11111111-2222-4333-8444-555555555555'
/**
 * Words that would tell an operator to make a second policy rather than change
 * the one they have: the portal's own "+ New policy", and any sentence that asks
 * for a policy to be created. Not the bare verb — a rollback line that points at
 * "Create or Correct Emergency Access Accounts" names another step of the plan
 * and asks for no policy at all.
 */
const CREATING = /\bnew policy\b|\bcreat(e|es|ing) (a |an |the )?(new |second )?polic/i

type Row = Record<string, unknown>

type Case = {
  step: Step
  ctx: StepVarContext
  snapshot: TenantSnapshot
  run: ReturnType<typeof runFixture>
  view: (s: Step) => ReturnType<typeof stepExportView>
}

function caseOf(run: ReturnType<typeof runFixture>, snapshot: TenantSnapshot, f: ReturnType<typeof fixture>, stepId: string): Case {
  const step = run.steps.find((s) => s.id === stepId)
  assert.ok(step, `${stepId} left the plan`)
  const ctx: StepVarContext = {
    snapshot,
    mapping: f.mapping,
    nameOf: (id: string) => run.input.names!.label(id),
    signature: 'IT',
    operatorId: f.operatorId,
    now: snapshot.asOf,
    groups: f.groups,
    reportOnlyAt: run.schedule.reportOnlyAt[step.id] ?? null,
  }
  return { step, ctx, snapshot, run, view: (s: Step) => stepExportView(s, ctx) }
}

/**
 * The canonical case, exactly as the fixture generates it: the demo tenant's own
 * week-two plan, whose token-protection policy the plan created last week and
 * which this scan finds in report-only with seven clean days behind it and every
 * active person in scope seen. Nothing is edited and no scan is replayed.
 */
function canonical(stepId: string = STEP_ID): Case {
  const f = fixture(FIXTURE)
  const run = runFixture(f)
  return caseOf(run, f.snapshot, f, stepId)
}

/**
 * The same tenant `days` later, with one policy row edited the way a person in
 * the tenant would have edited it, read against what the first scan recorded.
 * The run goes through the one `applyProgress` the app runs.
 */
function laterScan(over: { edit?: (row: Row) => void; days?: number; evidence?: boolean } = {}): Case {
  const f = fixture(FIXTURE)
  const first = runFixture(f)
  const record: Record<string, StepObservationRecord> = observationsOf(first.steps)
  const target = first.steps.find((s) => s.id === STEP_ID)!.tracking!.policyId!
  const asOf = new Date(Date.parse(f.snapshot.asOf) + (over.days ?? 3) * DAY).toISOString()
  const rows = ((f.snapshot.config.caPolicies?.rows ?? []) as Row[]).map((r) => {
    if (r.id !== target || !over.edit) return r
    const copy = structuredClone(r)
    over.edit(copy)
    return copy
  })
  const snapshot = {
    ...f.snapshot,
    asOf,
    config: { ...f.snapshot.config, caPolicies: { ...f.snapshot.config.caPolicies!, rows } },
    evidencePolicyResults: over.evidence === false ? [] : f.snapshot.evidencePolicyResults,
  } as TenantSnapshot
  const run = runFixture({ ...f, snapshot }, { snapshot }, record)
  return caseOf(run, snapshot, f, STEP_ID)
}

/**
 * The same tenant as the canonical case, scanned once, with the policy row
 * already in the shape the edit gives it — the tenant this scan finds, not a
 * tenant that changed under one.
 *
 * The difference matters and is the whole of task 006: a policy edited *between*
 * two scans is a change nobody explained, so the plan holds it for review and
 * offers nothing, whatever the gates say. That is right, and it is not the case
 * under test here. A setting that was already there when the window opened is
 * what the window watched, and the enforcement is still the one change left.
 */
function freshScan(over: { edit?: (row: Row) => void; evidence?: boolean; records?: (result: Row) => void } = {}): Case {
  const f = fixture(FIXTURE)
  const target = runFixture(f).steps.find((s) => s.id === STEP_ID)!.tracking!.policyId!
  const rows = ((f.snapshot.config.caPolicies?.rows ?? []) as Row[]).map((r) => {
    if (r.id !== target || !over.edit) return r
    const copy = structuredClone(r)
    over.edit(copy)
    return copy
  })
  // What Microsoft's records say about this policy, where a case is about the
  // evidence gate rather than the object: the fixture's own result for the
  // matched policy, edited the way the records would read.
  const results = ((f.snapshot.evidencePolicyResults ?? []) as unknown as Row[]).map((r) => {
    if (r.policyId !== target || !over.records) return r
    const copy = structuredClone(r)
    over.records(copy)
    return copy
  })
  const snapshot = {
    ...f.snapshot,
    config: { ...f.snapshot.config, caPolicies: { ...f.snapshot.config.caPolicies!, rows } },
    evidencePolicyResults: over.evidence === false ? [] : (results as typeof f.snapshot.evidencePolicyResults),
  } as TenantSnapshot
  const run = runFixture({ ...f, snapshot }, { snapshot })
  return caseOf(run, snapshot, f, STEP_ID)
}

/**
 * Nothing an operator could act on. The gate this file is about decides whether
 * IAMAI hands an enforcement over, so a control for it does not assert that a
 * word changed — it asserts that every channel is shut: the implementation, the
 * enforcement instant and the date beside it, the wave the schedule would have
 * put the step in, the portal lines, the JSON tab, the PowerShell tab and the
 * download the two share.
 */
function nothingIsOffered(c: Case): void {
  assert.equal(c.step.state.lifecycle, 'report-only', 'the policy is still being watched')
  assert.notEqual(c.step.status, 'ready-to-enforce')
  assert.equal(statusOf(c.step).word, 'Report-only')
  assert.equal(policyHold(c.step), 'observation-incomplete', 'Foundation A holds the operation, and names the reason')
  assert.equal(implementationOffered(c.step), false)
  assert.equal(enforcementUnearned(c.step), true)
  assert.equal(c.step.events, null, 'no enforcement event while a gate is open')
  assert.equal(enforcementTiming(c.step).basis !== 'committed', true, 'and no committed date behind it')
  assert.equal(c.run.schedule.waves.filter((w) => w.stepIds.includes(c.step.id)).length, 0, 'and no enforcement wave')
  assert.equal(portalOf(c.step, c.ctx), null, 'no portal lines')
  assert.equal(jsonOffered(c.step), false, 'no JSON tab')
  assert.deepEqual(stepOperations(c.step), [], 'and nothing for the JSON, PowerShell or Download tabs to serialise')
  assert.doesNotMatch(powershellFor(stepOperations(c.step)), /Update-MgIdentityConditionalAccessPolicy|New-MgIdentityConditionalAccessPolicy/, 'no PowerShell that writes a policy')
  assert.doesNotMatch(policyJsonText(c.step), /"state"/, 'and the download carries no enforcement body')
  assert.ok(!/Ready to enforce/.test(everythingSaid(c)), everythingSaid(c))
}

// ---- control A2: each gate, short on its own ----

test('007.11b: an elapsed window with no records read, and one with failing records, are both held and offer nothing', () => {
  // The window has closed on the canonical policy and nobody has read a single
  // sign-in evaluated under it. A week passing is a calendar fact and says
  // nothing about whether enforcing this policy would lock anybody out, so it
  // does not carry the stage on its own — and the failure count says unknown
  // rather than printing the zero an empty set adds up to.
  const unread = laterScan({ days: 3, evidence: false })
  assert.ok(Date.parse(unread.step.tracking!.readyOn!) <= Date.parse(unread.snapshot.asOf), 'the window has closed')
  assert.equal(unread.step.tracking?.failures, null, 'no records read is not a clean window')
  assert.equal(unread.step.tracking?.signIns, 0)
  assert.equal(unread.step.tracking?.readyNow, false)
  assert.equal(readyWhen(unread.step)?.kind, 'since', 'the time gate is the only one that closed')
  nothingIsOffered(unread)
  // The same window with records that show people being stopped. This is the
  // case the window was opened to find, and the one an operator must not be
  // handed the enforcement for.
  const failing = freshScan({
    records: (r) => {
      const counts = r.counts as Record<string, number>
      const ids = r.affectedUserIds as Record<string, string[]>
      const victim = ids.reportOnlySuccess[0]
      counts.reportOnlyFailure = 3
      ids.reportOnlyFailure = [victim]
      r.byDay = null
    },
  })
  assert.ok(Date.parse(failing.step.tracking!.readyOn!) <= Date.parse(failing.snapshot.asOf), 'the window has closed here too')
  assert.equal(failing.step.tracking?.failures, 3, 'and three people were stopped by it')
  assert.equal(failing.step.tracking?.readyNow, false)
  nothingIsOffered(failing)
  // And the numbers are on the row, so the operator is told what is outstanding
  // rather than only that something is.
  assert.equal(rowWhen(failing.step), 'held until the records clear')
  assert.equal(rowReason(failing.step), readyBasis(readyWhen(failing.step)!))
  assert.match(rowReason(failing.step)!, /^3 failing or interrupted/)
})

test('007.11c: clean, complete records before the window closes are not ready either, and offer nothing', () => {
  // The other half of the same correction. The records are the fixture's own —
  // every active person in scope seen, nothing failing — and the policy went
  // into report-only yesterday. Clean records over two days are clean records
  // for two days; the observation window is the plan's own statement of how long
  // a tenant has to be watched before that reading means anything, and it has
  // not been served.
  const f = fixture(FIXTURE)
  const yesterday = new Date(Date.parse(f.snapshot.asOf) - DAY).toISOString()
  const c = freshScan({
    edit: (row) => {
      row.createdDateTime = yesterday
      row.modifiedDateTime = yesterday
    },
    records: (r) => {
      // Microsoft's own record of when this policy began to be evaluated moves
      // with it: the window starts yesterday, and the records still cover
      // everybody.
      r.firstReportOnlyAt = yesterday
      r.byDay = null
    },
  })
  assert.equal(c.step.tracking?.reportOnlyAt, yesterday, 'the window opened yesterday')
  assert.ok(Date.parse(c.step.tracking!.readyOn!) > Date.parse(c.snapshot.asOf), 'so it has not closed')
  assert.equal(c.step.tracking?.failures, 0, 'the records are clean')
  assert.ok((c.step.tracking?.signIns ?? 0) > 0, 'and they are a zero records prove')
  assert.equal(c.step.tracking?.seenInScope, c.step.tracking?.activeInScope, 'and complete')
  assert.equal(c.step.tracking?.readyNow, false, 'and still not ready: the window is the other gate')
  assert.equal(readyWhen(c.step)?.kind, 'on', 'what it is waiting for is the day')
  nothingIsOffered(c)
  assert.equal(rowWhen(c.step), `ready ${absoluteDate(c.step.tracking!.readyOn!)}`)
})


// ---- control A3: evidence that is not about this window, and a scope with no census ----

test('007.11d: a scope with no census is not closed by a tally of records, however many and however clean', () => {
  // The tenant pointed this policy at a kind of external user as well as at its
  // own people. Which accounts that is, this scan and every later one cannot
  // say: a directory row says Member or Guest, the clause names one of the three
  // kinds a guest could be, and no row says which tenant anybody came from. So
  // the policy reaches a class rather than a set, there is no list of the people
  // it reaches, and "every active person in scope seen" has no denominator.
  //
  // Everything else is the canonical ready case: the window has closed, the
  // records are the fixture's own, all of them clean, and there are far more
  // than a tally would ask for. A count of records was once accepted here in
  // place of the coverage nobody can establish, and a count of records is a
  // different fact — thirty-four clean sign-ins by the people the directory does
  // list say nothing about the guests it does not. The stage that bought handed
  // over the update that enforces the policy the moment it lands, so the substitute
  // is refused: the step stays in report-only and IAMAI offers nothing.
  const c = freshScan({
    edit: (row) => {
      const users = (row.conditions as Row).users as Row
      users.includeGuestsOrExternalUsers = { guestOrExternalUserTypes: 'b2bCollaborationGuest', externalTenants: { membershipKind: 'all' } }
    },
  })
  const t = c.step.tracking!
  assert.equal(t.activeInScope, null, 'no count of who this policy reaches')
  assert.equal(t.seenInScope, null, 'and none of who has been seen')
  assert.ok(Date.parse(t.readyOn!) <= Date.parse(c.snapshot.asOf), 'the window has closed')
  assert.equal(t.failures, 0, 'the records are clean')
  assert.ok(t.signIns >= 20, `and there are ${t.signIns} of them, past any threshold a tally could set`)
  assert.equal(t.evidenceQuality, 'enough', 'which is worth saying about the records themselves')
  assert.equal(t.readyNow, false, 'and is still not readiness: a tally is not everybody seen')
  assert.equal(readyWhen(c.step)?.kind, 'since', 'the time gate is the only one that closed')
  assert.equal(readyBasis(readyWhen(c.step)!), null, 'and the row claims no numbers nobody counted')
  nothingIsOffered(c)
})

test('007.11e: records this policy made while it was enforced do not close its report-only gate', () => {
  // The tenant turned this policy on once and moved it back to report-only. The
  // enforced sign-ins from that time cover everybody it reaches; what it has
  // recorded since it went back to reporting covers two people. The gate asks
  // what this policy has shown while it was only watching — the window it is
  // being watched over now — so the history pays for none of it, and the step
  // that would otherwise be handed its enforcement again keeps waiting.
  const c = freshScan({
    records: (r) => {
      const counts = r.counts as Record<string, number>
      const ids = r.affectedUserIds as Record<string, string[]>
      const since = ids.reportOnlySuccess.slice(0, 2)
      const before = ids.reportOnlySuccess.slice(2)
      ids.reportOnlySuccess = since
      counts.reportOnlySuccess = since.length
      ids.enforcedSuccess = before
      counts.enforcedSuccess = before.length
      r.byDay = null
    },
  })
  const t = c.step.tracking!
  assert.ok(Date.parse(t.readyOn!) <= Date.parse(c.snapshot.asOf), 'the window has closed')
  assert.equal(t.failures, 0, 'and nothing has failed under it')
  assert.equal(t.signIns, 2, 'the records that count are the two it has made in report-only')
  assert.ok((t.seenInScope ?? 0) > 0, 'which is a zero records prove, not an empty set')
  assert.ok((t.seenInScope ?? 0) < (t.activeInScope ?? 0), 'and most of the people it reaches have not been seen under it')
  assert.equal(t.readyNow, false)
  assert.equal(readyWhen(c.step)?.kind, 'since')
  nothingIsOffered(c)
  // What is being refused is the composition, not the records: the same sign-ins,
  // all of them made in report-only, are the canonical ready case.
  assert.equal(canonical().step.tracking?.readyNow, true)
})

/** The step's portal lines, as the screen and the exports both render them. */
function portalOf(step: Step, ctx: StepVarContext): string[] | null {
  const cs = contentStepFor(step) as Record<string, unknown> | undefined
  const ex = stepVars(step, ctx)
  return stepPortalLines(step, portalNamesFor(ctx, ex, String(cs?.title ?? step.title)))
}

/** What the opened step would put under What to do (stepInstructions.ts). */
function instructionsOf(step: Step, ctx: StepVarContext): ReturnType<typeof stepInstructions> {
  const cs = contentStepFor(step) as Record<string, unknown> | undefined
  const ex = stepVars(step, ctx) as Record<string, unknown>
  return stepInstructions(step, cs, ex, portalNamesFor(ctx, ex, String(cs?.title ?? step.title)))
}

/** Every sentence about this step that reaches a person or another tool. */
function everythingSaid(c: Case): string {
  const v = c.view(c.step)
  return [
    ...v.whatToDo,
    ...v.doneWhen,
    v.dates ?? '',
    v.ifWrong ?? '',
    rowWhen(c.step),
    rowReason(c.step) ?? '',
    ...stepLines(c.step, c.ctx),
    buildIcs(c.run.steps, 'Tenant', 'plan-007', c.view)
      .split('BEGIN:VEVENT')
      .find((x) => x.includes(`-${c.step.id}@iamai`)) ?? '',
  ].join(' | ')
}

/** The tenant's row for this step's matched policy, at that scan. */
function matchedRow(c: Case): Row {
  const id = c.step.tracking?.policyId
  const row = ((c.snapshot.config.caPolicies?.rows ?? []) as Row[]).find((r) => r.id === id)
  assert.ok(row, 'the scan matched a deployed policy')
  return row
}

// ---- 1. the case is real, and it is Ready to enforce · Healthy ----

test('007.1: a whole fixture generates a report-only policy whose gates have closed, and it is Ready to enforce · Healthy', () => {
  const { step } = canonical()
  assert.equal(contentStepFor(step)?.kind, 'policy')
  // Both axes, from Foundation B and nowhere else.
  assert.equal(step.state.lifecycle, 'ready-to-enforce')
  assert.equal(step.state.condition, 'healthy')
  assert.equal(step.status, 'ready-to-enforce')
  assert.equal(step.state.satisfied, false, 'nothing is delivered yet')
  assert.equal(step.state.setAside, false)
  assert.equal(heldForReview(step), false, 'no hold in the clean case')
  // The three stages of a deployed policy are three words on the row, and this
  // is the middle one: not the policy being watched, not the policy that is on.
  assert.equal(statusOf(step).word, 'Ready to enforce')
  assert.equal(stepContract(step, canonical().ctx).state.stage, 'Ready to enforce')
  assert.equal(stepContract(step, canonical().ctx).state.conditionLabel, 'Healthy')
})

// ---- 2. every gate the step actually uses is closed, on this policy's own evidence ----

test('007.2: the gates this policy uses are closed on its own window and its own records, and no unknown counts as a pass', () => {
  const { step } = canonical()
  const t = step.tracking!
  const ready = readyWhen(step)!
  // The two gates tracking.ts states for a policy in report-only, and nothing
  // else gates this step: no readiness threshold, no unresolved safety choice,
  // no missing object, no baseline conflict.
  assert.equal(step.action.readinessGate, undefined, 'this policy has no readiness threshold of its own')
  assert.deepEqual(step.action.missing ?? [], [])
  assert.equal(step.action.escapeHatch, undefined, 'the way back in is verified')
  assert.deepEqual(step.action.emergencyExposure?.reached ?? [], [])
  assert.deepEqual(step.action.emergencyExposure?.unproven ?? [], [])
  assert.equal(step.blockers.length, 0, 'nothing is outstanding')
  // The time gate: in report-only for the step's observation window.
  assert.ok(t.reportOnlyAt, 'the scan knows when the policy entered report-only')
  assert.equal(t.reportOnlyAtSource, 'sign-in-evidence', "Microsoft's own record, not a first sighting")
  assert.ok(Date.parse(t.readyOn!) <= Date.parse(t.noticedAt!), 'the window has closed')
  // The evidence gate: zero failures and every active person in scope seen.
  assert.equal(t.readyNow, true)
  assert.equal(ready.kind, 'now')
  assert.equal(t.failures, 0)
  assert.ok(t.signIns > 0, 'the zero is a zero records prove, not an empty set')
  assert.equal(t.evidenceQuality, 'enough')
  assert.notEqual(t.activeInScope, null, "the policy's own scope was settled")
  assert.equal(t.seenInScope, t.activeInScope)
  assert.ok((t.activeInScope ?? 0) > 0)
  // Unknown is not pass: with the records taken away the same policy is not
  // ready, and its failure count is unknown rather than a clean zero.
  const blind = laterScan({ days: 0, evidence: false })
  assert.equal(blind.step.tracking?.failures, null, 'no records read is not a clean window')
  assert.equal(blind.step.tracking?.readyNow, false)
})

// ---- 3. Ready is not Enforced ----

test('007.3: the tenant policy is still in report-only, and nothing records an enforcement that has not happened', () => {
  const c = canonical()
  const row = matchedRow(c)
  assert.equal(row.state, 'enabledForReportingButNotEnforced', 'the deployed policy is still in report-only')
  assert.equal(c.step.tracking?.state, 'enabledForReportingButNotEnforced')
  assert.notEqual(c.step.state.lifecycle, 'enforced')
  assert.equal(c.step.state.satisfied, false)
  assert.equal(c.step.tracking?.enforcedAt, null, 'no enforcement instant is recorded')
  assert.equal(c.step.tracking?.enforcedAtSource, null)
  assert.ok(!c.step.history.some((h) => h.to === 'done'), 'no completion is in the history')
  assert.equal(statusOf(c.step).word !== 'Enforced', true)
  // The word "enforced" never appears as something that already happened.
  const said = everythingSaid(c)
  assert.doesNotMatch(said, /\b(is|was|has been|already) enforced\b/i, said)
  assert.doesNotMatch(said, /Enforced (Sep|Oct|Aug|Nov|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul)\b/, said)
  // Completion is a later observation, stated as one.
  assert.ok(
    c.view(c.step).doneWhen.some((l) => /later scan finds the policy enabled/i.test(l)),
    c.view(c.step).doneWhen.join('\n'),
  )
})

// ---- 4. the change is an update of the matched policy, and it enforces ----

test('007.4: the one operation updates the exact matched tenant policy and enforces the moment it lands', () => {
  const c = canonical()
  const ops = operationsOf(c.step)
  assert.equal(implementationOffered(c.step), true)
  assert.equal(policyHold(c.step), null, 'nothing holds it any more')
  assert.equal(unavailableReason(c.step), null)
  assert.equal(ops.length, 1, 'a single-policy step is one operation')
  const [op] = ops
  assert.equal(op.mode, 'update')
  assert.equal(op.policyId, c.step.tracking?.policyId, 'and it names the policy this scan matched')
  assert.equal(op.policyId, matchedRow(c).id)
  // Enforcing by Foundation A's own predicate, not by what a button says.
  assert.equal(enforcesOnRun(op), true)
  assert.equal(String((finalTargets(c.step)[0] as Row).state), 'enabled', 'what the tenant is left with is an enabled policy')
  assert.equal(nextMilestone(c.step).kind, 'enforce')
  assert.equal(stepContract(c.step, c.ctx).whatToDo.kind, 'enforce')
})

// ---- 5. only the controlled field changes ----

test('007.5: the update submits the one field it controls, and an unrelated tenant setting survives it on every channel', () => {
  // The tenant put a sign-in frequency on the policy that the plan's enforcement
  // does not control. The patch must not carry it away, and the whole policy the
  // operation leaves behind must still have it.
  const stronger = { signInFrequency: { isEnabled: true, type: 'hours', value: 4 } }
  const c = freshScan({
    edit: (row) => {
      row.sessionControls = { ...(row.sessionControls as Row), ...stronger }
    },
  })
  assert.equal(c.step.state.lifecycle, 'ready-to-enforce', 'a stronger unrelated setting does not stop the enforcement')
  const [op] = operationsOf(c.step)
  assert.equal(op.mode, 'update')
  assert.deepEqual(op.body, { state: 'enabled' }, 'the patch is the one controlled field and nothing else')
  const target = finalTargets(c.step)[0] as Record<string, Row>
  assert.deepEqual((target.sessionControls as Row).signInFrequency, stronger.signInFrequency, 'the tenant keeps its own stronger setting')
  // And every channel carries that same bounded body.
  assert.equal(policyJsonText(c.step), JSON.stringify({ state: 'enabled' }, null, 2))
  const ps = powershellFor(stepOperations(c.step))
  assert.match(ps, /Update-MgIdentityConditionalAccessPolicy -ConditionalAccessPolicyId '/)
  assert.doesNotMatch(ps, /signInFrequency/, 'the PowerShell does not rewrite a setting nobody asked to change')
  assert.ok(portalOf(c.step, c.ctx)!.some((l) => /leave every other setting on this policy as it is/i.test(l)))
})

// ---- 6. Portal, JSON, PowerShell and the download say the same update ----

test('007.6: Portal opens the existing policy by name, and JSON, PowerShell and the download serialise the same update', () => {
  const c = canonical()
  const name = c.step.tracking!.policyName!
  const id = c.step.tracking!.policyId!
  const portal = portalOf(c.step, c.ctx)!
  assert.ok(portal.length > 0)
  assert.ok(portal[0].includes(name), `the first line opens the policy by the name the tenant knows it by: ${portal[0]}`)
  assert.ok(portal.some((l) => /Enable policy/i.test(l)), portal.join('\n'))
  assert.ok(portal.some((l) => /leave every other setting/i.test(l)), portal.join('\n'))
  // No channel tells the operator to make a second policy.
  for (const line of portal) assert.doesNotMatch(line, CREATING, line)
  assert.doesNotMatch(everythingSaid(c), CREATING, 'nothing anywhere asks for a new policy')
  assert.ok(!portal.some((l) => l.includes(id)), 'the portal names the object, not a Graph id')
  // JSON, PowerShell and the download: one body, the real object id.
  assert.equal(jsonOffered(c.step), true)
  const ops = stepOperations(c.step)
  assert.equal(ops.length, 1)
  assert.equal(ops[0].mode, 'update')
  assert.equal(ops[0].policyId, id)
  const json = policyJsonText(c.step)
  assert.deepEqual(JSON.parse(json), { state: 'enabled' })
  const ps = powershellFor(ops)
  assert.ok(ps.includes(`-ConditionalAccessPolicyId '${id}'`), ps)
  assert.ok(!ps.includes('New-MgIdentityConditionalAccessPolicy'), ps)
  assert.ok(ps.includes(json), 'the PowerShell body is the JSON tab’s body')
  // The screen's own What to do is the same set of lines the export carries.
  assert.deepEqual(instructionsOf(c.step, c.ctx).portal, portal)
  assert.deepEqual(c.view(c.step).whatToDo.slice(1), portal)
})

// ---- 7. the rollback is the inverse of what was submitted ----

test('007.7: the way back from an enforcement is report-only, and never deleting a policy this step did not create', () => {
  const c = canonical()
  const ifWrong = c.view(c.step).ifWrong
  assert.ok(ifWrong, 'a step that hands over a change has a rollback')
  assert.match(ifWrong!, /back to report-only/i)
  assert.doesNotMatch(ifWrong!, /delete/i, 'an update is not undone by deleting the tenant’s policy')
})

test('007.7b: report-only is the rollback of the state-only enforcement and of nothing else, in every plan', () => {
  for (const f of allFixtures()) {
    for (const step of runFixture(f).steps) {
      const where = `${f.name}/${step.id}`
      const cs = contentStepFor(step) as Record<string, unknown> | undefined
      if (!cs) continue
      const line = ifWrongLineFor(step, cs)
      if (line === '{enforceIfWrong}') {
        // "Set the policy back to report-only" is only the inverse of a change
        // that turned the policy on and touched nothing else. Anywhere else it
        // switches off a control this step never switched on.
        assert.equal(enforcesByStateOnly(step), true, `${where}: the enforcement rollback over a change that is not the enforcement`)
        for (const op of operationsOf(step)) assert.deepEqual(Object.keys(op.body), ['state'], `${where}: the enforcement rollback over a body that changes settings`)
      }
      // The other side of the same rule: a step that only ever changes policies
      // the tenant already has is never told to delete one, and a semantic
      // correction is told to put the settings back.
      if (!updatesExistingPolicy(step)) continue
      assert.notEqual(line, '{policyIfWrong}', `${where}: "or delete it" over a policy this step did not create`)
      if (!enforcesByStateOnly(step)) assert.notEqual(line, '{enforceIfWrong}', `${where}: report-only offered as the way back from a settings change`)
    }
  }
})

test('007.7c: a correction to a policy the tenant already enforces is put back by restoring the settings, never by report-only', () => {
  // The canonical policy after a later scan finds it on (control D below): a
  // live, denying policy whose remaining operation is an ordinary settings
  // correction submitting no state at all. Telling the operator to put the whole
  // policy into report-only would weaken an active control in answer to a change
  // that never turned it on, and would leave the corrected setting in place.
  const c = laterScan({ edit: (row) => { row.state = 'enabled' } })
  assert.equal(c.step.state.lifecycle, 'enforced')
  const ops = operationsOf(c.step)
  assert.ok(ops.length > 0, 'the correction is still handed over')
  assert.equal(updatesExistingPolicy(c.step), true, 'and it is an update, not a create')
  assert.equal(enforcesByStateOnly(c.step), false, 'it changes settings and submits no state')
  assert.equal(ifWrongLineFor(c.step, contentStepFor(c.step) as Record<string, unknown>), '{changeIfWrong}')
  const ifWrong = c.view(c.step).ifWrong
  assert.ok(ifWrong, 'a step that hands over a change has a rollback')
  assert.match(ifWrong!, /put the settings back/i)
  assert.doesNotMatch(ifWrong!, /report-only/i, 'a live control is not switched off to undo a settings change')
  assert.doesNotMatch(ifWrong!, /delete/i, 'and nothing deletes a policy this step did not create')
})

// ---- 8. the row, and the enforcement it has earned ----

test('007.8: the collapsed row reads the state, the evidence behind it and the day the change lands', () => {
  const c = canonical()
  const ready = readyWhen(c.step)!
  assert.equal(statusOf(c.step).word, 'Ready to enforce')
  assert.equal(rowReason(c.step), readyBasis(ready), 'the evidence that earned it, in the one reading Done-when uses')
  const at = c.step.events?.enforce.at
  assert.ok(at, 'a step whose enforcement is available carries the day it happens')
  assert.equal(rowWhen(c.step), absoluteDate(at!), 'and the date column is that day, not a readiness date already past')
  assert.ok(Date.parse(at!) > Date.parse(c.snapshot.asOf), 'the enforcement is in front of the tenant, not behind it')
  // The Step Contract's own milestone is the same instant, and it is prospective.
  const contract = stepContract(c.step, c.ctx)
  assert.equal(contract.milestone.kind, 'enforce')
  assert.equal(contract.milestone.at, at)
  assert.equal(contract.implementation.offered, true)
  assert.deepEqual(contract.fix, [], 'nothing is outstanding, so nothing is listed to fix')
  // Who it touches is Foundation A's settled reach, and it is known.
  assert.equal(contract.who?.known, true)
})

test('007.9: the enforcement date the Plan shows is the one the schedule, the export and the calendar carry', () => {
  const c = canonical()
  const at = c.step.events!.enforce.at!
  assert.equal(enforcementUnearned(c.step), false, 'the forecast is not withdrawn from a step that earned it')
  assert.equal(enforcementTiming(c.step).basis, 'committed', 'the date is committed, not a projection')
  assert.equal(enforcementTiming(c.step).at, at)
  // One instant, and the Dates line states it as a change to come.
  const dates = c.view(c.step).dates
  assert.ok(dates, 'the step has a Dates line')
  assert.ok(dates!.includes(absoluteDate(at)), `${dates} does not carry ${absoluteDate(at)}`)
  assert.doesNotMatch(dates!, /\bEnforced\b/, dates!)
  // Exactly one calendar entry for this step, and one enforcement wave carrying it.
  const events = buildIcs(c.run.steps, 'Tenant', 'plan-007', c.view)
    .split('BEGIN:VEVENT')
    .filter((x) => x.includes(`-${c.step.id}@iamai`))
  assert.equal(events.length, 1, 'no duplicate enforcement entry')
  const waves = c.run.schedule.waves.filter((w) => w.stepIds.includes(c.step.id))
  assert.equal(waves.length, 1, 'the step is in exactly one wave')
})

// ---- control A: a gate that is not closed ----

test('007.10: a policy whose gates have not closed is not Ready, and no enforcement is offered anywhere', () => {
  // The same fixture's other week-two policy: deployed the same way by the same
  // plan, two days in and not everybody seen. One gate short is not ready.
  const c = canonical(SHORT_ID)
  const t = c.step.tracking!
  assert.equal(t.state, 'enabledForReportingButNotEnforced', 'the same shape of artifact')
  assert.ok(Date.parse(t.readyOn!) > Date.parse(t.noticedAt!), 'the window has not closed')
  assert.equal(t.readyNow, false)
  assert.ok((t.seenInScope ?? 0) < (t.activeInScope ?? 0), 'and not everybody has been seen')
  assert.equal(c.step.state.lifecycle, 'report-only')
  assert.equal(statusOf(c.step).word, 'Report-only')
  // Its operation is the very same enforcing update, and Foundation A holds it.
  const [op] = operationsOf(c.step)
  assert.equal(op.mode, 'update')
  assert.equal(enforcesOnRun(op), true)
  assert.equal(policyHold(c.step), 'observation-incomplete')
  assert.equal(implementationOffered(c.step), false)
  assert.equal(jsonOffered(c.step), false)
  assert.equal(portalOf(c.step, c.ctx), null)
  assert.equal(c.step.events, null, 'no enforcement event while a gate is open')
  assert.equal(enforcementUnearned(c.step), true)
})

test('007.11: with both gates closed against it the canonical policy itself falls back to Report-only', () => {
  // The same policy, on a tenant where it went into report-only yesterday and no
  // sign-in records have been read: the window is open and the evidence gate has
  // nothing to close it with. Neither gate is met, and everything the
  // enforcement carried goes with them.
  //
  // Scanned once rather than replayed, because a record of an earlier scan's own
  // observation outlasts a later reading of the created date — that is the point
  // of keeping one (`the record's observation wins over this scan`), and a test
  // that edited the date under a record would be proving the record works, not
  // the gate.
  const c = freshScan({
    evidence: false,
    edit: (row) => {
      const yesterday = new Date(Date.parse(fixture(FIXTURE).snapshot.asOf) - DAY).toISOString()
      row.createdDateTime = yesterday
      row.modifiedDateTime = yesterday
    },
  })
  assert.equal(c.step.state.lifecycle, 'report-only')
  assert.notEqual(c.step.status, 'ready-to-enforce')
  assert.equal(readyWhen(c.step)?.kind !== 'now', true)
  assert.equal(implementationOffered(c.step), false)
  assert.equal(policyHold(c.step), 'observation-incomplete')
  assert.equal(c.step.events, null)
  assert.equal(statusOf(c.step).word, 'Report-only')
})

// ---- control B: evidence a person has to look at ----

test('007.12: unexplained evidence returns the held Report-only case and takes the enforcement away', () => {
  // Task 006's behaviour, on this step: somebody excluded an account nobody asked
  // to exclude, so what was watched is not what would be enforced.
  const c = laterScan({
    edit: (row) => {
      const users = (row.conditions as Record<string, Row>).users
      ;(row.conditions as Record<string, unknown>).users = { ...users, excludeUsers: [...((users.excludeUsers as string[]) ?? []), BY_HAND] }
    },
  })
  assert.equal(c.step.state.lifecycle, 'report-only', 'review required is a condition, never a stage')
  assert.equal(c.step.state.condition, 'review-required')
  assert.equal(heldForReview(c.step), true)
  assert.equal(implementationOffered(c.step), false)
  assert.equal(jsonOffered(c.step), false)
  assert.equal(c.step.events, null, 'no enforcement date survives a change nobody has explained')
  assert.equal(statusOf(c.step).word, 'Report-only')
  assert.notEqual(rowWhen(c.step), '')
  assert.ok(!/Ready to enforce/.test(everythingSaid(c)), everythingSaid(c))
})

// ---- control C: Foundation A withholds the implementation ----

test('007.13: a Ready lifecycle Foundation A will not implement is offered no implementation, no date and no wave', () => {
  // Foundation C: the operator has never answered the exclusions question, so
  // the group the policy excludes is not an object this tenant has. Foundation A
  // hands nothing over while a policy names something missing — whatever
  // Foundation B says about the window. A Ready lifecycle is not a second door.
  const f = noExclusionsAnswer(fixture(FIXTURE))
  const run = runFixture(f)
  const c = caseOf(run, f.snapshot, f, STEP_ID)
  assert.equal(c.step.state.lifecycle, 'ready-to-enforce', 'Foundation B still says the gates closed')
  assert.equal(unavailableReason(c.step), 'missing-object')
  assert.ok((c.step.action.missing ?? []).length > 0, 'and it says which object')
  assert.equal(implementationOffered(c.step), false)
  assert.equal(jsonOffered(c.step), false)
  assert.equal(portalOf(c.step, c.ctx), null)
  assert.deepEqual(operationsOf(c.step), [], 'no operation to run')
  assert.equal(c.step.events, null, 'no enforcement event')
  assert.equal(rowWhen(c.step), '', 'and no date in the row')
  assert.equal(run.schedule.waves.filter((w) => w.stepIds.includes(c.step.id)).length, 0, 'and no wave')
  // The one action is the blocker, not the enforcement.
  const contract = stepContract(c.step, c.ctx)
  assert.equal(contract.whatToDo.kind, 'resolve')
  assert.notEqual(contract.whatToDo.text, contract.milestone.label)
  assert.equal(contract.implementation.offered, false)
  assert.equal(c.view(c.step).ifWrong, null, 'nothing to roll back from a change nobody was given')
})

// ---- control D: the policy is already on ----

test('007.14: the canonical policy, once a later scan finds it enabled, is Enforced and is offered no second enforcement', () => {
  const c = laterScan({ edit: (row) => { row.state = 'enabled' } })
  // The tenant's own evidence, and only it, moved the stage on.
  assert.equal(c.step.tracking?.state, 'enabled')
  assert.equal(c.step.state.lifecycle, 'enforced')
  assert.ok(c.step.tracking?.enforcedAt, 'now there is an enforcement instant, and it came from the tenant')
  assert.equal(c.step.tracking?.enforcedAtSource, 'policy-modified')
  // Nothing is waiting to be turned on any more: no readiness, no enforcement
  // milestone, and — the safety point — no operation that would enforce again.
  assert.equal(readyWhen(c.step), null)
  assert.notEqual(c.step.status, 'ready-to-enforce')
  assert.notEqual(statusOf(c.step).word, 'Ready to enforce')
  assert.equal(nextMilestone(c.step).kind === 'enforce', false, 'nothing is still waiting to be turned on')
  for (const op of operationsOf(c.step)) {
    // Anything still offered is a correction to a policy that is already on, and
    // whatever else it is it is not a second enforcement: it submits no state,
    // so nothing here turns on a policy the tenant has already turned on.
    //
    // Such an operation is still `enforcesOnRun` — deliberately, and it is not a
    // contradiction. That predicate is about the policy the change leaves
    // behind, not about a state transition: a change to a live policy binds the
    // moment it lands, with no report-only to catch it, and the plan treats it
    // with the same care whatever field it touches.
    assert.equal(op.mode, 'update', 'nothing creates a second policy beside it')
    assert.equal((op.body as Record<string, unknown>).state, undefined, 'and nothing submits this policy’s state again')
  }
  // Nothing an operator would follow asks for a second policy: not the request,
  // and not the portal lines they read to make the change by hand.
  const portal = portalOf(c.step, c.ctx) ?? []
  for (const line of portal) assert.doesNotMatch(line, CREATING, line)
  assert.ok(portal.length === 0 || portal[0].includes(c.step.tracking!.policyName!), 'the portal opens the policy the tenant has')
  assert.doesNotMatch(policyJsonText(c.step) ?? '', /"displayName"/, 'the request names no new policy')
  // Known and left alone here: this step's *lead* sentence still falls through to
  // Foundation B's deploy milestone ("Create the policy in report-only.") because
  // the ladder has no milestone for correcting a policy the tenant already
  // enforces (roadmap/lifecycle.ts nextMilestone, last line). The instructions
  // under it are right and the operation is an update, so nothing duplicates a
  // policy; the sentence is the Enforced/correction presentation, which this task
  // is told not to redesign. Reported, not papered over.
})

test('007.14b: the fixtures’ own enforced policies are delivered, and carry no operation at all', () => {
  // The demo tenant's five week-one policies, which this scan finds enabled:
  // real whole-fixture steps that have finished, not a variant. A policy the
  // plan drove all the way is done and has nothing left to submit.
  const run = runFixture(fixture(FIXTURE))
  const enforced = run.steps.filter((s) => s.state.lifecycle === 'enforced')
  assert.ok(enforced.length > 0, 'the fixture has policies the tenant already enforces')
  for (const step of enforced) {
    assert.equal(step.state.satisfied, true, `${step.id}: enforced and not delivered`)
    assert.equal(step.status, 'done', step.id)
    assert.equal(statusOf(step).word, 'Enforced', step.id)
    assert.ok(step.tracking?.enforcedAt, `${step.id}: Enforced with no instant from the tenant`)
    assert.deepEqual(operationsOf(step), [], `${step.id}: nothing left to submit`)
    assert.equal(implementationOffered(step), false, step.id)
    assert.equal(jsonOffered(step), false, step.id)
    assert.equal(readyWhen(step), null, step.id)
    assert.equal(rowWhen(step), '', step.id)
  }
})

// ---- the whole path, across every fixture ----

test('007.15: no plan anywhere offers an enforcement that is not an update of the policy it watched', () => {
  for (const f of allFixtures()) {
    for (const step of runFixture(f).steps) {
      const where = `${f.name}/${step.id}`
      const ops = operationsOf(step)
      if (step.state.lifecycle === 'ready-to-enforce') {
        // Ready to enforce is a claim about the object in front of the scan: a
        // matched policy, still in report-only, whose own operation turns it on.
        assert.ok(step.tracking?.policyId || (step.tracking?.members ?? []).some((m) => m.policyId), `${where}: ready to enforce with no matched policy`)
        assert.equal(step.state.satisfied, false, `${where}: ready to enforce and delivered at once`)
        for (const m of step.tracking?.members ?? []) {
          if (m.lifecycle !== 'ready-to-enforce') continue
          assert.equal(m.state, 'enabledForReportingButNotEnforced', `${where}: a member said ready to enforce and is not in report-only`)
        }
        assert.ok(!ops.some((o) => o.mode === 'create'), `${where}: ready to enforce while the plan offers to create a second policy`)
      }
      if (!implementationOffered(step)) continue
      for (const op of ops) {
        // The operation that turns a policy on: the one submitting `enabled` to
        // a policy the tenant has. Nowhere in any plan is that handed over
        // before Foundation B grants it, and nowhere is it a create — the
        // policy being turned on is by definition one the tenant already has.
        if (String((op.body as Record<string, unknown>).state ?? '') !== 'enabled') continue
        assert.equal(op.mode, 'update', `${where}: an enforcement that is not an update of an existing policy`)
        assert.ok(op.policyId, `${where}: an enforcing update naming no policy`)
        assert.equal(enforcesOnRun(op), true, `${where}: an enforcement that does not enforce`)
        assert.equal(step.state.lifecycle, 'ready-to-enforce', `${where}: an enforcement offered at ${step.state.lifecycle}`)
        assert.equal(step.state.condition === 'review-required', false, `${where}: an enforcement offered over unexplained evidence`)
        assert.equal(step.tracking?.state, 'enabledForReportingButNotEnforced', `${where}: an enforcement offered on a policy that is not in report-only`)
      }
      // And no step is called Enforced without the tenant's own evidence for it.
      if (statusOf(step).word === 'Enforced') {
        assert.equal(step.state.lifecycle, 'enforced', `${where}: Enforced without the lifecycle`)
        assert.ok(step.tracking?.enforcedAt, `${where}: Enforced with no instant from the tenant`)
      }
    }
  }
})
