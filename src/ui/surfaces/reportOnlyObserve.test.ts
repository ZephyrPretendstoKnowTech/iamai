// The canonical Plan case: Report-only / Observe (task 005).
//
// One real step on one real fixture — demo-week2 / s-goal-block-auth-transfer,
// "Block Authentication Transfer" — because it is the whole case at once: the
// plan deployed the policy two days ago and a scan found it in report-only
// (Foundation B), nothing is wrong with it (no blocker, no decision, no
// baseline conflict, no review condition), the policy already delivers the goal
// so there is no correction to make, and the window it has to be watched for has
// not closed. The only thing the step has left to submit is the enforcement, and
// nothing has earned that yet.
//
// Nothing here builds a Step. The fixture runs through the whole engine and the
// assertions read what a person would see: the frozen Step Contract, the row's
// date column, the four implementation channels, the export view the calendar
// entry, the prompt pack and the grounding bundle all speak from, and the
// calendar itself.
//
// What it exists to catch: the plan handing over {"state":"enabled"} while its
// own What to do says to wait; an enforcement date, wave or calendar entry
// standing in for a review milestone; observed days derived from the schedule
// or the clock instead of from the records; a step advancing to ready with a
// gate still open; and evidence nobody collected reported as zero failures or
// everybody seen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { allFixtures, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { cleanReportOnly } from '../../roadmap/fixtures/records.ts'
import { readBackPlacement } from '../../roadmap/schedule.ts'
import { enforcesOnRun, implementationOffered, operationsOf, policyHold, unavailableReason } from '../../roadmap/operations.ts'
import { enforcementTiming, enforcementUnearned, settleForecast, statedEnforcement } from '../../roadmap/forecast.ts'
import { artifactIdOf } from '../../roadmap/observation.ts'
import { nextMilestone } from '../../roadmap/lifecycle.ts'
import { readyWhen } from '../../derive/readyWhen.ts'
import { reached } from '../../derive/population.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { announcementDraft, groundingBundle, stepContext } from '../../roadmap/prompts.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import type { Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { stepContract } from './stepContract.ts'
import { commsFor, copyBoxes, stepExportView, stepLines } from './stepExport.ts'
import { jsonOffered, policyJsonText, stepOperations } from './stepJson.ts'
import { powershellFor } from './stepPowerShell.ts'
import { stepPortalLines, portalNamesFor } from './stepPortal.ts'
import { stepInstructions } from './stepInstructions.ts'
import { rowWhen } from './rowWhen.ts'
import { statusOf } from './statusWord.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

/** The one canonical case, named here so a change to it is a change to this test. */
const FIXTURE = 'demo-week2'
const STEP_ID = 's-goal-block-auth-transfer'
/** The other week-two policy in report-only: its records are not this step's. */
const OTHER_ID = 's-goal-token-protection'
/** The goal one over, whose content step carries an email that names the enforcement day (005.13). */
const COMMS_STEP_ID = 's-goal-all-users-no-persistence'
/** The one goal in the plan whose content carries a tenant change to make *before* the policy (005.14). */
const PREREQ_STEP_ID = 's-goal-device-registration-mfa'
/** That change: it turns off the setting the policy replaces. */
const PREREQ_LINE = /Require Multifactor Authentication to register or join devices: No/

/** Words that would tell the operator to do something other than keep watching. */
const DOING = /\b(create|creating|change|changing|update|updating|enforce|enforcing|enable|submit|resolve|delete|remove)\b/i

type Case = {
  step: Step
  ctx: StepVarContext
  steps: Step[]
  snapshot: TenantSnapshot
  view: (s: Step) => ReturnType<typeof stepExportView>
  run: ReturnType<typeof runFixture>
}

/**
 * The canonical case, or the same fixture with one focused evidence change: the
 * records this policy was judged on removed, so the observation is unknown
 * rather than clean. Everything else about the tenant is untouched.
 */
function canonical(over: { noRecords?: boolean } = {}): Case {
  const f = fixture(FIXTURE)
  const snapshot = over.noRecords
    ? ({
        ...f.snapshot,
        evidencePolicyResults: (f.snapshot.evidencePolicyResults ?? []).filter((p) => !/Authentication transfer/i.test(String(p.displayName))),
      } as TenantSnapshot)
    : f.snapshot
  const r = over.noRecords ? runFixture({ ...f, snapshot }, { snapshot }) : runFixture(f)
  const step = r.steps.find((s) => s.id === STEP_ID)
  assert.ok(step, `${FIXTURE} no longer carries ${STEP_ID}`)
  const ctx: StepVarContext = {
    snapshot,
    mapping: f.mapping,
    nameOf: (id: string) => r.input.names!.label(id),
    signature: 'IT',
    operatorId: f.operatorId,
    now: snapshot.asOf,
    groups: f.groups,
    reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null,
  }
  return { step, ctx, steps: r.steps, snapshot, view: (s: Step) => stepExportView(s, ctx), run: r }
}

/**
 * The same demo tenant with one more of its own plan's policies already
 * deployed: the step's create operation, submitted `days` ago and found by the
 * scan sitting in report-only with records behind it.
 *
 * Nothing here is written by hand. The policy body is the one IAMAI's own
 * operation would submit for that step — tag, scope, controls and report-only
 * state — so what comes back through the generator is the same canonical case
 * as the fixture's own week-two policies, on a goal whose content step carries a
 * communication template. The canonical fixture step has none, and an email is
 * the one artifact IAMAI writes that leaves the tenant.
 */
function deployedByThePlan(stepId: string, days = 2): Case {
  const f = fixture(FIXTURE)
  const seed = runFixture(f).steps.find((x) => x.id === stepId)
  assert.ok(seed, `${FIXTURE} no longer carries ${stepId}`)
  const op = operationsOf(seed).find((o) => o.mode === 'create')
  assert.ok(op, `${stepId} is no longer a policy the plan would create`)
  const at = new Date(Date.parse(f.snapshot.asOf) - days * 86_400_000).toISOString()
  const policyId = 'e5d0d3c6-0b6e-4a2e-9a3f-9c4b7a1d0005'
  const people = (f.snapshot.users ?? []).slice(0, 20).map((u) => String(u.id))
  const snapshot = {
    ...f.snapshot,
    config: { ...f.snapshot.config, caPolicies: { ...f.snapshot.config.caPolicies!, rows: [...(f.snapshot.config.caPolicies?.rows ?? []), { id: policyId, createdDateTime: at, modifiedDateTime: at, ...(op!.body as Record<string, unknown>) }] } },
    evidencePolicyResults: [
      ...(f.snapshot.evidencePolicyResults ?? []),
      cleanReportOnly({ policyId, displayName: String((op!.body as Record<string, unknown>).displayName), people, asOf: f.snapshot.asOf, firstReportOnlyAt: at }),
    ],
  } as TenantSnapshot
  const r = runFixture({ ...f, snapshot }, { snapshot })
  const step = r.steps.find((x) => x.id === stepId)
  assert.ok(step, `${stepId} left the plan once its policy was deployed`)
  const ctx: StepVarContext = {
    snapshot,
    mapping: f.mapping,
    nameOf: (id: string) => r.input.names!.label(id),
    signature: 'IT',
    operatorId: f.operatorId,
    now: snapshot.asOf,
    groups: f.groups,
    reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null,
  }
  return { step, ctx, steps: r.steps, snapshot, view: (x: Step) => stepExportView(x, ctx), run: r }
}

/**
 * The whole-plan artifacts of one fixture, built once: the grounding bundle a
 * downstream tool reads and the calendar file a person imports. Both are
 * per-plan, so 005.11 builds them per fixture rather than per step.
 */
const bundles = new Map<string, Record<string, unknown>[]>()
const calendars = new Map<string, string>()
function bundleFor(name: string, r: ReturnType<typeof runFixture>, ctx: StepVarContext): Record<string, unknown>[] {
  let hit = bundles.get(name)
  if (!hit) {
    const bundle = groundingBundle({ view: (s: Step) => stepExportView(s, ctx), tenant: 'Tenant', snapshot: ctx.snapshot, coverage: r.coverage, steps: r.steps, schedule: r.schedule, redacted: false, generated: 'Sep 6, 2026', cleanup: [] }) as unknown as { plan: { steps: Record<string, unknown>[] } }
    bundles.set(name, (hit = bundle.plan.steps))
  }
  return hit
}
function icsFor(name: string, r: ReturnType<typeof runFixture>, ctx: StepVarContext): string {
  let hit = calendars.get(name)
  if (hit === undefined) calendars.set(name, (hit = buildIcs(r.steps, 'Tenant', `plan-${name}`, (s: Step) => stepExportView(s, ctx))))
  return hit
}

/** The step's portal lines, as the screen and the exports both render them. */
function portalOf(step: Step, ctx: StepVarContext): string[] | null {
  const cs = contentStepFor(step) as Record<string, unknown> | undefined
  const ex = stepVars(step, ctx)
  return stepPortalLines(step, portalNamesFor(ctx, ex, String(cs?.title ?? step.title)))
}

/**
 * What the opened step would put under What to do: the one selection
 * ContentStep.tsx renders from (stepInstructions.ts), read here rather than a
 * second reading of the same authorities.
 */
function instructionsOf(step: Step, ctx: StepVarContext): ReturnType<typeof stepInstructions> {
  const cs = contentStepFor(step) as Record<string, unknown> | undefined
  const ex = stepVars(step, ctx) as Record<string, unknown>
  return stepInstructions(step, cs, ex, portalNamesFor(ctx, ex, String(cs?.title ?? step.title)))
}

/** The service-accounts group the demo tenant's scan did not hold, with its own members. */
const SERVICE_ACCOUNTS_GROUP_ID = '00b2c9ad-2f3e-4c81-9a3d-7c1f6e4b5a01'

/**
 * The same demo tenant one step further on: its people have working MFA, so the
 * readiness the plan waits for is met, and it has the service-accounts group the
 * device-registration policy excludes. That clears everything holding
 * `s-goal-device-registration-mfa` — the one goal in the plan whose content
 * carries a *prerequisite* instruction, and a destructive one: the tenant's own
 * "Require Multifactor Authentication to register or join devices" is turned off
 * because the Conditional Access policy replaces it.
 *
 * With the policy then deployed by the plan and sitting in report-only, the step
 * is the canonical Observe case carrying a tenant change in its content. Nothing
 * here is hand-built: the group is a group, the readiness is the tenant's own
 * people scored ready, and the policy body is the one IAMAI's own operation
 * would submit.
 */
function observingWithAPrerequisite(days = 2): { due: Case; observing: Case } {
  const f = fixture(FIXTURE)
  const anyGroup = [...f.groups][0][1]
  const members = f.mapping.serviceAccountUserIds ?? []
  const groups = new Map([...f.groups, [SERVICE_ACCOUNTS_GROUP_ID, { ...anyGroup, memberIds: members, memberCount: members.length, displayName: 'Core - Service accounts' }]])
  const mapping = { ...f.mapping, serviceAccountsGroupId: SERVICE_ACCOUNTS_GROUP_ID }
  // The tenant's own viability rows with its active people ready on MFA: the
  // readiness percentage is derived from these (roadmap/readiness.ts), so this
  // is a tenant whose people can pass the policy, not a gate switched off.
  const scored = runFixture({ ...f, groups, mapping })
  const viability = scored.viability.map((v) => (v.activity === 'active' ? { ...v, mfa: 'likelyViable' as const } : v))
  const asCase = (r: ReturnType<typeof runFixture>, snapshot: TenantSnapshot): Case => {
    const step = r.steps.find((x) => x.id === PREREQ_STEP_ID)
    assert.ok(step, `${FIXTURE} no longer carries ${PREREQ_STEP_ID}`)
    const ctx: StepVarContext = {
      snapshot,
      mapping,
      nameOf: (id: string) => r.input.names!.label(id),
      signature: 'IT',
      operatorId: f.operatorId,
      now: snapshot.asOf,
      groups,
      reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null,
    }
    return { step, ctx, steps: r.steps, snapshot, view: (x: Step) => stepExportView(x, ctx), run: r }
  }
  const due = asCase(runFixture({ ...f, groups, mapping }, { viability }), f.snapshot)
  const op = operationsOf(due.step).find((o) => o.mode === 'create')
  assert.ok(op, `${PREREQ_STEP_ID} is no longer a policy the plan would create`)
  const at = new Date(Date.parse(f.snapshot.asOf) - days * 86_400_000).toISOString()
  const policyId = 'e5d0d3c6-0b6e-4a2e-9a3f-9c4b7a1d0006'
  const people = (f.snapshot.users ?? []).slice(0, 20).map((u) => String(u.id))
  const snapshot = {
    ...f.snapshot,
    config: { ...f.snapshot.config, caPolicies: { ...f.snapshot.config.caPolicies!, rows: [...(f.snapshot.config.caPolicies?.rows ?? []), { id: policyId, createdDateTime: at, modifiedDateTime: at, ...(op!.body as Record<string, unknown>) }] } },
    evidencePolicyResults: [
      ...(f.snapshot.evidencePolicyResults ?? []),
      cleanReportOnly({ policyId, displayName: String((op!.body as Record<string, unknown>).displayName), people, asOf: f.snapshot.asOf, firstReportOnlyAt: at }),
    ],
  } as TenantSnapshot
  return { due, observing: asCase(runFixture({ ...f, groups, mapping, snapshot }, { snapshot, viability }), snapshot) }
}

// ---- 1. the case is real, and it is genuinely Report-only and Healthy ----

test('005.1: the canonical case is a deployed Conditional Access policy in Report-only, in good health', () => {
  const { step } = canonical()
  assert.equal(contentStepFor(step)?.kind, 'policy')
  // Foundation B, and only Foundation B, says where the policy is and how it is
  // doing. The two axes move independently and both are read here.
  assert.equal(step.state.lifecycle, 'report-only')
  assert.equal(step.state.condition, 'healthy', 'the canonical Observe case has no blocker, decision, conflict or review condition')
  assert.equal(step.state.satisfied, false)
  assert.equal(step.state.inPlace, false)
  assert.equal(step.state.setAside, false)
  assert.equal(step.status, 'in-report-only')
  assert.notEqual(step.state.lifecycle, 'ready-to-enforce', 'it has not earned enforcement')
  // Nothing holds it and nothing is wrong with it: no blocker to fix, no
  // unavailable reason, no review the observation raised.
  assert.deepEqual(step.blockers, [])
  assert.equal(unavailableReason(step), null)
  assert.equal(step.state.observation?.reviewRequired, false)
  assert.deepEqual(
    (step.tracking?.members ?? []).map((m) => m.reviewRequired),
    [false],
    'and no member of it wants a person to look',
  )
  // The row says the state without being opened, and its date column is the
  // review milestone rather than a rollout day.
  assert.equal(statusOf(step).word, 'Report-only')
  assert.equal(rowWhen(step), `ready ${absoluteDate(readyWhen(step)!.date)}`)
})

// ---- 2. the observation belongs to this deployed policy, and to no other ----

test('005.2: the observation is this step’s own deployed policy, and another policy’s records cannot stand for it', () => {
  const { step, steps } = canonical()
  assert.equal(step.state.members.length, 1, 'the canonical case is a single-policy goal')
  const m = step.state.members[0]
  const t = step.tracking!
  assert.ok(t.policyId, 'a deployed policy was matched')
  assert.equal(m.change.latest.artifact, artifactIdOf(t.policyId), 'the observation names the object the tracking matched')
  assert.equal(m.change.latest.state, 'report-only')
  assert.equal(t.state, 'enabledForReportingButNotEnforced')
  // The other week-two policy is a different object with different records, and
  // its numbers are nowhere in this step's.
  const other = steps.find((s) => s.id === OTHER_ID)!
  assert.notEqual(other.tracking?.policyId ?? null, t.policyId)
  assert.notEqual(other.tracking?.seenInScope, t.seenInScope, 'the two policies were seen for different people')
  assert.equal(t.members.length, 1)
  assert.equal(t.members[0].policyId, t.policyId, 'the member holds its own object, not the step’s idea of one')
})

// ---- 3. the clock is the records', not the calendar's ----

test('005.3: the observed days and the review date come from the evidence, not from the schedule or the clock', () => {
  const { step, ctx } = canonical()
  const t = step.tracking!
  const ready = readyWhen(step)!
  assert.equal(t.reportOnlyAtSource, 'sign-in-evidence', 'the day it entered report-only is a record, not a guess')
  assert.ok(t.daysInReportOnly > 0, 'days have been earned')
  assert.equal(ready.days, t.daysInReportOnly, 'one reading of the clock')
  assert.equal(ready.date, t.readyOn)
  const ex = stepVars(step, ctx) as Record<string, unknown>
  assert.equal(ex.readyOn, absoluteDate(t.readyOn!))
  assert.match(String(ex.evidenceGate), new RegExp(`${t.seenInScope} of ${t.activeInScope} active people seen in ${t.daysInReportOnly} days`))

  // Moving the rollout the schedule projected, and moving the surface's idea of
  // now, add no observed history: the numbers come from what a scan saw.
  const moved = structuredClone(step) as Step
  moved.rings = moved.rings.map((r) => ({ ...r, plannedStart: '2027-01-01T00:00:00.000Z', plannedEnd: '2027-01-08T00:00:00.000Z' }))
  if (moved.events) moved.events = { ...moved.events, enforce: { ...moved.events.enforce, at: '2027-01-01T00:00:00.000Z' } }
  const later = stepVars(moved, { ...ctx, now: '2027-06-01T00:00:00.000Z' }) as Record<string, unknown>
  assert.equal(later.evidenceGate, ex.evidenceGate, 'a later clock is not more observation')
  assert.equal(later.timeGate, ex.timeGate, 'and a later rollout is not a later review')
  assert.equal(later.readyOn, absoluteDate(t.readyOn!))
  assert.equal(readyWhen(moved)!.days, ready.days)
  assert.equal(moved.state.lifecycle, 'report-only', 'and none of it advances the lifecycle')

  // The evidence is what moves it: with this policy's records gone the same
  // fixture earns no days at all.
  const bare = canonical({ noRecords: true })
  assert.ok(bare.step.tracking!.daysInReportOnly < t.daysInReportOnly, 'no records, no earned window')
})

// ---- 4. the healthy claim is proven, not assumed ----

test('005.4: “no unresolved failures” is a count the records support, not the absence of records', () => {
  const { step } = canonical()
  const t = step.tracking!
  assert.equal(t.evidenceQuality, 'enough', 'enough records to judge on')
  assert.ok(t.signIns > 0, `records exist (${t.signIns})`)
  assert.equal(t.failures, 0)
  assert.deepEqual(t.failuresByUser, [])
  assert.ok(t.seenInScope !== null && t.activeInScope !== null, 'the policy’s own scope was settled, so the count is a count')
  assert.ok(t.seenInScope! > 0, 'people were actually seen under it')
})

// ---- 5. it is not ready, and a real gate says why ----

test('005.5: at least one observation gate is still open, so the step stays Report-only', () => {
  const { step, ctx } = canonical()
  const ready = readyWhen(step)!
  assert.equal(step.tracking!.readyNow, false, 'the evidence gate has not opened')
  assert.equal(ready.kind, 'on', 'and the time gate closes in the future')
  assert.ok(ready.seen! < ready.people!, `people in scope are still unseen (${ready.seen} of ${ready.people})`)
  assert.equal(step.state.lifecycle, 'report-only')
  assert.notEqual(step.status, 'ready-to-enforce')
  // Done when states the gates, so the operator can read what would clear it.
  const done = stepContract(step, ctx).doneWhen.join(' | ')
  assert.match(done, /in report-only since/i)
  assert.match(done, new RegExp(`${ready.seen} of ${ready.people}`))
})

// ---- 6. the next action is to keep watching ----

test('005.6: What to do is keep it in report-only, on the screen and in every artifact', () => {
  const { step, ctx, view } = canonical()
  const c = stepContract(step, ctx)
  const m = nextMilestone(step)
  assert.equal(m.kind, 'observe')
  assert.equal(c.milestone.kind, 'observe')
  assert.equal(c.whatToDo.kind, 'observe')
  assert.match(c.whatToDo.text, /report-only/i)
  assert.match(c.whatToDo.text, new RegExp(absoluteDate(readyWhen(step)!.date)))
  assert.doesNotMatch(c.whatToDo.text, DOING)
  // Nothing is presented as a blocker, because nothing is one.
  assert.deepEqual(c.fix, [])
  // The export, the calendar entry, the prompt pack and the grounding bundle all
  // speak from this view: its first line is the contract's own action, and it
  // carries no instructions for making a change.
  const v = view(step)
  assert.equal(v.whatToDo[0], c.whatToDo.text)
  assert.equal(v.whatToDo.length, 1, `no instructions beside it: ${JSON.stringify(v.whatToDo)}`)
})

// ---- 7. no implementation is handed over while the window is open ----

test('005.7: the four channels stand down — no portal change, no JSON, no PowerShell, no download', () => {
  const { step, ctx } = canonical()
  // One authority, one answer. Foundation A holds the implementation itself
  // (`observation-incomplete`): the operation is sound and today is not its day.
  // That is not the same as a policy the plan cannot write, so nothing is
  // blocked and no reason is given — the step's action is to keep watching.
  assert.equal(policyHold(step), 'observation-incomplete', 'Foundation A holds the implementation')
  assert.equal(unavailableReason(step), null, 'and holds it without calling anything unavailable')
  assert.equal(implementationOffered(step), false, 'so no implementation is offered today')
  const impl = stepContract(step, ctx).implementation
  assert.equal(impl.offered, false, 'and the frozen contract reports the same answer')
  assert.equal(impl.offered === false && impl.hold, 'observation-incomplete', 'naming the hold, not a blocker')
  assert.equal(impl.offered === false && impl.reason, null)
  assert.equal(impl.offered === false && impl.because, null, 'no reason line, because nothing is wrong')
  // The operations survive the hold — they are what the step will submit, and
  // what makes it enforcing is read off them.
  const ops = operationsOf(step)
  assert.equal(ops.length, 1)
  assert.equal(ops[0].mode, 'update', 'the policy exists, so there is nothing to create')
  assert.equal(enforcesOnRun(ops[0]), true, 'and the one thing left to submit turns it on')
  assert.equal(enforcementUnearned(step), true)
  // So no channel offers it.
  assert.equal(jsonOffered(step), false)
  assert.deepEqual(stepOperations(step), [])
  assert.equal(portalOf(step, ctx), null, 'no portal instructions')
  assert.doesNotMatch(policyJsonText(step), /"state"\s*:\s*"enabled"/, 'nothing downloadable enforces the policy')
  const ps = powershellFor(stepOperations(step))
  assert.doesNotMatch(ps, /Update-MgIdentityConditionalAccessPolicy/)
  assert.doesNotMatch(ps, /New-MgIdentityConditionalAccessPolicy/, 'and no second policy either')
  // And no consumer can find a second answer to disagree with: every channel is
  // the contract's own, so an implementation offered by one is offered by all.
  assert.equal(jsonOffered(step), impl.offered)
  assert.equal(portalOf(step, ctx) !== null, impl.offered)
  assert.equal(stepOperations(step).length > 0, impl.offered)
})

// ---- 8. no enforcement date, wave or calendar entry ----

test('005.8: the step is in no enforcement wave, carries no enforce event, and the calendar books the review', () => {
  const { step, ctx, steps, view, run } = canonical()
  // The generator dated and placed this step before anything knew its policy
  // existed: every step's lifecycle is still not-deployed when the schedule is
  // built, so it went into an enforcement wave and got three dated events.
  // Tracking settled the lifecycle afterwards and the projection came off the
  // plan with it (roadmap/forecast.ts settleForecast) — kept, on its own
  // terms, where nothing reads it as this step's milestone.
  assert.equal(step.events, null, 'the step carries no enforce event')
  assert.equal(run.schedule.waveOf[step.id], undefined, 'no wave enforces it')
  for (const w of run.schedule.waves) assert.ok(!w.stepIds.includes(step.id), `wave ${w.wave} still carries the step`)
  assert.equal(step.comms, null, 'and no dated announcement draft survives on it')
  // What was taken off is kept, on its own terms, where nothing reads it as
  // this step's milestone.
  const projected = run.schedule.forecastOnly?.[step.id]
  assert.ok(projected, 'the rollout the schedule drew is kept')
  assert.ok(projected!.events, 'and it is the enforce event the generator wrote')
  assert.equal(typeof projected!.wave, 'number', 'and the wave it had been placed in')
  const timing = enforcementTiming(step)
  assert.notEqual(timing.basis, 'committed', 'nothing about the step reads as an earned enforcement')
  assert.deepEqual(statedEnforcement(step), { basis: 'unearned', at: null }, 'no surface has an enforcement instant to state')
  const forecastAt = projected!.events!.enforce.at
  const forecastDay = absoluteDate(forecastAt)
  const ready = readyWhen(step)!
  assert.notEqual(forecastDay, absoluteDate(ready.date), 'the two days differ, so the assertions below can tell them apart')
  const v = view(step)
  assert.ok(v.dates, 'the step is dated')
  assert.match(v.dates!, /^Report-only since /)
  assert.match(v.dates!, new RegExp(`Review ${absoluteDate(ready.date)}`))
  assert.ok(!v.dates!.includes(forecastDay), `no enforcement date on the line: ${v.dates}`)
  assert.doesNotMatch(v.dates!, /^Announce /, 'and it is not the change-step line')
  // Nor anywhere else a person reads this step's dates: the row's date column,
  // what it says to do, and what would finish it.
  assert.ok(!rowWhen(step).includes(forecastDay), `the row dates the forecast enforcement: ${rowWhen(step)}`)
  for (const line of [...v.whatToDo, ...v.doneWhen]) assert.ok(!line.includes(forecastDay), `an enforcement date is stated: ${line}`)
  // And the milestone the frozen contract puts on the step is the observation,
  // never the enforcement the schedule projected.
  assert.equal(stepContract(step, ctx).milestone.kind, 'observe')
  assert.notEqual(nextMilestone(step).at, forecastAt)
  // One calendar entry, on the review day, lasting the day — not the ring window
  // the schedule projected for an enforcement.
  const ics = buildIcs(steps, 'Tenant', 'plan-1', view)
  const entry = ics.split('BEGIN:VEVENT').find((b) => b.includes(`UID:plan-1-${step.id}@iamai`))
  assert.ok(entry, 'the step is in the calendar')
  assert.match(entry!, new RegExp(`DTSTART;VALUE=DATE:${ready.date.slice(0, 10).replace(/-/g, '')}`))
  assert.doesNotMatch(entry!, new RegExp(`DTSTART;VALUE=DATE:${forecastAt.slice(0, 10).replace(/-/g, '')}`), 'the entry is not booked on the projected enforcement day')
  assert.doesNotMatch(entry!, /Enable policy/i, 'and it is not a runbook for turning the policy on')
  assert.ok(!entry!.includes(forecastDay), 'nor does it name the enforcement day')
})

// ---- 9. the screen and the artifacts say one thing ----

test('005.9: screen, export, calendar, prompt pack and grounding bundle agree', () => {
  const { step, ctx, steps, snapshot, view, run } = canonical()
  const c = stepContract(step, ctx)
  const v = view(step)
  assert.equal(c.state.stage, 'Report-only')
  assert.equal(c.state.conditionLabel, 'Healthy')
  assert.notEqual(c.state.stage, c.state.conditionLabel, 'the two axes are said apart')
  // The prompt pack is the text a person hands to a model to draft an
  // announcement from, so the projection is not in it under any wording: this
  // step's enforcement is not yet dated, and the day it does name is the review
  // the screen names.
  // Both instants the plan still holds for this step: the ring the rollout is
  // drawn from, and the enforcement the schedule had dated it with before its
  // lifecycle was known, now kept apart in `schedule.forecastOnly`.
  const projected = [enforcementTiming(step).at, run.schedule.forecastOnly?.[step.id]?.events?.enforce.at ?? null].filter((x): x is string => x !== null)
  const facts = stepContext(step, view)
  // The prompt answers "when" with the step's own Dates line and nothing it
  // composed itself. It used to write a second sentence here ("Takes effect: not
  // yet dated") that no other surface said, from its own second reading of the
  // timing; the Dates line is the one authority, and on this step it says the
  // enforcement is not this step's to state.
  assert.ok(facts.includes(v.dates!), `the prompt pack dates the step its own way: ${facts}`)
  for (const at of projected) assert.ok(!facts.includes(absoluteDate(at)), `the prompt pack states the projected enforcement day: ${facts}`)
  assert.ok(facts.includes(absoluteDate(readyWhen(step)!.date)), 'and it does name the review day')
  assert.ok(facts.includes(c.whatToDo.text), 'and the action is the screen’s')
  // The grounding bundle is read by another tool, and a bare instant is
  // indistinguishable from one a policy has earned: this step has none to give.
  const bundle = groundingBundle({ view, tenant: 'Tenant', snapshot, coverage: run.coverage, steps, schedule: run.schedule, redacted: false, generated: 'Sep 6, 2026', cleanup: [] }) as unknown as { plan: { steps: Record<string, unknown>[] } }
  const b = bundle.plan.steps.find((x) => x.id === step.id)!
  assert.equal(b.status, 'in-report-only')
  assert.deepEqual(b.enforcement, { basis: 'unearned', at: null })
  assert.deepEqual(b.whatToDo, v.whatToDo)
  assert.equal(b.dates, v.dates)
  const json = JSON.stringify(b)
  for (const at of projected) {
    assert.ok(!json.includes(at), `the bundle carries the enforcement instant: ${json}`)
    assert.ok(!json.includes(absoluteDate(at)), `the bundle carries the enforcement day: ${json}`)
  }
  assert.ok(!json.includes('"state": "enabled"'), 'no artifact carries the enforcing body')
  // Who this touches is Foundation A's reach, and it is a different fact from
  // how many of them the records have seen.
  const pop = reached(step)
  assert.ok(pop, 'the scope was settled')
  assert.equal(c.who?.known, true)
  assert.equal(step.tracking!.activeInScope, pop!.active, 'the policy’s scope is the step’s reach')
  assert.notEqual(step.tracking!.seenInScope, step.tracking!.activeInScope, 'observed is not the same number as in scope')
})

// ---- 10. unknown evidence is not clean evidence ----

test('005.10: with the records gone the step claims no clean window, no full observation and no readiness', () => {
  const { step, ctx, view } = canonical({ noRecords: true })
  const t = step.tracking!
  assert.equal(step.state.lifecycle, 'report-only', 'still report-only, and no further')
  assert.notEqual(t.evidenceQuality, 'enough', `the evidence is not enough to judge on (${t.evidenceQuality})`)
  assert.equal(t.signIns, 0, 'nothing was read')
  assert.equal(t.readyNow, false, 'so the evidence gate cannot open')
  assert.equal(readyWhen(step)!.kind, 'on', 'and the time gate is the only way through')
  assert.equal(t.seenInScope, 0, 'nobody was seen — not everybody')
  assert.ok(t.activeInScope! > 0, 'against a scope that is known')
  assert.equal(t.daysInReportOnly, 0, 'and no days are claimed for a window nothing watched')
  // A failure count is a count of records, so with none read there is no count:
  // the zero an empty set adds up to reads to a person exactly like a zero
  // twenty-four records prove (roadmap/tracking.ts).
  assert.equal(t.failures, null, 'no records, no failure count')
  assert.deepEqual(t.failuresByUser, [])
  assert.equal(readyWhen(step)!.failures, null, 'and the one reading the lines share says the same')
  // The lines a person reads never turn that into a clean window. Done when may
  // still state the gate it has to clear — zero failures and everybody seen is
  // what would finish the step — but nothing it says about *today* claims either.
  const c = stepContract(step, ctx)
  const v = view(step)
  const lines = [...c.doneWhen, ...v.doneWhen, ...v.whatToDo, v.dates ?? '', rowWhen(step), stepContext(step, view)]
  // Every clause that speaks about *today* — the gate a line states as the
  // criterion for finishing is the step's requirement and stays.
  const today = lines.flatMap((l) => l.split(/today/i).slice(1))
  assert.ok(today.length > 0, 'a line does report the current state')
  for (const clean of [/\b0 failing/i, /\bzero failures\b/i, /\bno failures\b/i, /\bno unresolved failures\b/i, /\b0 unresolved\b/i, /\bhealthy evidence\b/i]) {
    for (const clause of today) assert.doesNotMatch(clause, clean, `the absence of records is stated as a clean window: ${clause}`)
  }
  assert.doesNotMatch(rowWhen(step), /ready now/i, 'and the row does not call it ready')
  assert.match(c.doneWhen.join(' | '), new RegExp(`0 of ${t.activeInScope} active people`), 'the people it has seen is a true zero and stays')
  assert.match(c.doneWhen.join(' | '), /zero failures and every active person in scope seen/, 'while the gate it still has to clear is stated as the gate')
  assert.doesNotMatch(v.whatToDo.join(' | '), /Enable policy/i, 'and the enforcement is still withheld')
  assert.equal(jsonOffered(step), false)
})

// ---- 11. the whole path, on every fixture ----

test('005.11: no fixture hands over an enforcement while its policy is still in report-only', () => {
  let seen = 0
  for (const f of allFixtures()) {
    const r = runFixture(f)
    for (const step of r.steps) {
      if (step.state.lifecycle !== 'report-only') continue
      const ctx: StepVarContext = {
        snapshot: f.snapshot,
        mapping: f.mapping,
        nameOf: (id: string) => r.input.names!.label(id),
        signature: 'IT',
        operatorId: f.operatorId,
        now: f.snapshot.asOf,
        groups: f.groups,
        reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null,
      }
      const where = `${f.name}/${step.id}`
      // Foundation B has not granted the enforcement, so nothing a person could
      // run submits it — in any channel, on any surface.
      for (const op of stepOperations(step)) assert.equal(enforcesOnRun(op), false, `${where}: a channel offers an operation that enforces the moment it is run`)
      assert.doesNotMatch(policyJsonText(step), /"state"\s*:\s*"enabled"/, `${where}: the JSON enforces it`)
      assert.doesNotMatch(powershellFor(stepOperations(step)), /"state": "enabled"/, `${where}: the PowerShell enforces it`)
      // A failure count with no records behind it is not a zero, on any policy of
      // any fixture: the gate's own reading says unknown and the line renders it.
      const t = step.tracking
      if (t && t.signIns === 0) assert.equal(t.failures, null, `${where}: a policy nothing was read about has a failure count`)
      if (!enforcementUnearned(step)) continue
      seen += 1
      // The plan itself does not schedule the enforcement. The generator placed
      // this step in an enforcement wave and dated it while every lifecycle was
      // still not-deployed; once tracking settled this one, the placement came
      // off the plan and went where it cannot be read as a milestone
      // (roadmap/forecast.ts settleForecast). A consumer that reads the schedule
      // or the step, rather than asking `statedEnforcement`, finds nothing.
      assert.equal(step.events, null, `${where}: the step still carries an enforce event`)
      assert.equal(r.schedule.waveOf[step.id], undefined, `${where}: an enforcement wave still enforces it`)
      for (const w of r.schedule.waves) assert.ok(!w.stepIds.includes(step.id), `${where}: enforcement wave ${w.wave} still carries it`)
      assert.ok(r.schedule.forecastOnly?.[step.id] !== undefined, `${where}: the projection was dropped instead of kept apart`)
      assert.equal(step.comms, null, `${where}: a dated announcement draft survives on the step`)
      assert.equal(jsonOffered(step), false, `${where}: the JSON, PowerShell and download tabs are open`)
      assert.equal(portalOf(step, ctx), null, `${where}: the portal lines tell the operator to change it`)
      // And the opened step has no instructions of its own to put in their
      // place. This is the selection the screen renders from
      // (stepInstructions.ts), so the same reading answers for the tabs, the
      // leading prerequisite lines and the step's own numbered instructions.
      const screen = instructionsOf(step, ctx)
      assert.equal(screen.held, true, `${where}: the screen does not know the change is held`)
      assert.equal(screen.portal, null, `${where}: the screen renders portal instructions`)
      assert.deepEqual(screen.before, [], `${where}: the screen tells the operator to change the tenant before a policy that is only watching`)
      assert.deepEqual(screen.steps, [], `${where}: the screen renders the step's change instructions`)
      const v = stepExportView(step, ctx)
      assert.doesNotMatch(v.whatToDo.join(' | '), /Enable policy/i, `${where}: the export tells the operator to enforce it`)
      assert.equal(nextMilestone(step).kind, 'observe', `${where}: the next milestone is not observation`)
      if (v.dates) assert.doesNotMatch(v.dates, /^Announce /, `${where}: the Dates line promises a change`)
      // And no enforcement instant reaches a person or another tool as this
      // step's date. The schedule keeps its projection — that is the roadmap —
      // but the one reading every surface goes through has none to state, so the
      // Dates line, the row, What to do, Done when, the prompt pack, the calendar
      // entry and the bundle all speak from the review milestone instead.
      assert.deepEqual(statedEnforcement(step), { basis: 'unearned', at: null }, `${where}: an enforcement instant is offered for a window that has not closed`)
      // Both instants the plan still holds: the ring the rollout is drawn from,
      // and the enforcement the schedule had dated the step with before its
      // lifecycle was known. Neither reaches a person or another tool.
      for (const at of [enforcementTiming(step).at, r.schedule.forecastOnly?.[step.id]?.events?.enforce.at ?? null]) {
        if (at === null) continue
        const day = absoluteDate(at)
        const dated = [v.dates ?? '', rowWhen(step), ...v.whatToDo, ...v.doneWhen, stepContext(step, (x: Step) => stepExportView(x, ctx))].join(' | ')
        assert.ok(!dated.includes(day), `${where}: the enforcement day is stated as this step's date: ${dated}`)
        // The email is the one artifact that leaves the tenant: the screen's
        // Tell your people box, its copy, and the print/export lines.
        for (const box of copyBoxes(step, ctx)) assert.ok(!box.text.includes(day), `${where}: a copy box states the projected enforcement day: ${box.text}`)
        const lines = stepLines(step, ctx).join(' | ')
        assert.ok(!lines.includes(day), `${where}: the print and export lines state it: ${lines}`)
        const b = bundleFor(f.name, r, ctx).find((x) => x.id === step.id)
        if (b) {
          const json = JSON.stringify(b)
          assert.ok(!json.includes(at) && !json.includes(day), `${where}: the grounding bundle carries the enforcement instant: ${json}`)
        }
        const entry = icsFor(f.name, r, ctx).split('BEGIN:VEVENT').find((x) => x.includes(`-${step.id}@iamai`))
        if (entry) assert.ok(!entry.includes(day) && !entry.includes(`DATE:${at.slice(0, 10).replace(/-/g, '')}`), `${where}: the calendar books the enforcement: ${entry}`)
      }
    }
  }
  assert.ok(seen >= 1, `the case is exercised on a real fixture (${seen})`)
})

// ---- 12. and the fixture is the one the case is named for ----

test('005.12: the canonical case is the demo tenant’s own week-two policy, deployed by the plan it belongs to', () => {
  const { step, snapshot } = canonical()
  const t = step.tracking!
  const row = (snapshot.config.caPolicies?.rows ?? []).find((p) => String((p as { id?: unknown }).id) === t.policyId) as Record<string, unknown> | undefined
  assert.ok(row, 'the policy is in the tenant the scan read')
  assert.match(String(row!.description ?? ''), /\[IAMAI:plan-demo-week2:s-goal-block-auth-transfer/, 'and it carries this plan’s tag for this step')
  assert.equal(row!.state, 'enabledForReportingButNotEnforced')
  assert.equal(t.matchedBy, 'tag')
})

// ---- 13. the email is an artifact too ----

test('005.13: a healthy Report-only policy with an email to send states no enforcement date in it', () => {
  // The canonical fixture step has no communication template, so this is the
  // same case one goal over: the plan's own session policy, deployed in
  // report-only two days ago, healthy, with a template whose body names the
  // enforcement day ({enforceLong}). It is the one artifact IAMAI writes that
  // leaves the tenant, and before this it read "From Monday, September 14" with
  // a note under it saying the date was only a target — a projection sent to
  // everyone in the tenant while the window it depends on was two days old.
  const { step, ctx, run, view } = deployedByThePlan(COMMS_STEP_ID)
  assert.equal(step.state.lifecycle, 'report-only')
  assert.equal(step.state.condition, 'healthy')
  assert.equal(enforcementUnearned(step), true)
  assert.deepEqual(step.blockers, [])
  // A real gate, on real records: people seen, none failing, and not everybody yet.
  const t = step.tracking!
  assert.equal(t.evidenceQuality, 'enough')
  assert.equal(t.failures, 0)
  assert.ok(t.seenInScope! > 0 && t.seenInScope! < t.activeInScope!, `still unseen people in scope (${t.seenInScope} of ${t.activeInScope})`)
  assert.equal(t.readyNow, false)
  // The template does name the enforcement day, so there is something to withhold.
  const cs = contentStepFor(step) as Record<string, unknown>
  assert.match(String((cs.comms as Record<string, unknown>).body), /\{enforceLong\}/, 'the step has an email that states the enforcement day')
  const projected = run.schedule.forecastOnly?.[step.id]?.events?.enforce.at ?? step.events?.enforce.at ?? null
  assert.ok(projected, 'and the schedule did project one')
  const forecastDay = absoluteDate(projected!)
  const review = absoluteDate(readyWhen(step)!.date)
  assert.notEqual(forecastDay, review)
  // With no enforce event on the step there is no {enforceLong} to fill, and a
  // template with a hole in it renders nothing at all — the same rule every
  // other line follows. No email on the screen, none to copy, none in the export.
  const ex = stepVars(step, ctx) as Record<string, unknown>
  assert.equal(ex.enforce, undefined, 'no enforcement date reaches the step’s values')
  assert.equal(ex.enforceLong, undefined)
  assert.equal(commsFor(cs, ex, step), null, 'Tell your people has nothing to say yet')
  assert.deepEqual(copyBoxes(step, ctx).filter((b) => b.kind === 'comms'), [], 'and there is no copy box for it')
  // Nothing else a person or a tool reads states the day either — while the
  // review the step's own gates derive is named where the action is.
  const v = view(step)
  const said = [...stepLines(step, ctx), v.dates ?? '', ...v.whatToDo, ...v.doneWhen, rowWhen(step), stepContext(step, view), step.comms ?? ''].join(' | ')
  assert.ok(!said.includes(forecastDay), `the projected enforcement day is stated: ${said}`)
  assert.ok(said.includes(review), 'and the review milestone is')
  assert.match(v.whatToDo.join(' | '), /report-only/i)
  assert.doesNotMatch(v.whatToDo.join(' | '), DOING)
  // Including the prompt pack's draft announcement, which is the plan's, not
  // this step's: with no dated draft left on it, it cannot be the one picked.
  assert.equal(step.comms, null)
  const draft = announcementDraft(run.steps)
  if (draft !== null) assert.ok(!draft.includes(forecastDay), `the draft announcement states it: ${draft}`)
})

// ---- 14. the opened step instructs nothing while the window is open ----

test('005.14: the screen renders its What-to-do instructions from the one selection, and it is empty while the change is held', () => {
  const { step, ctx, view } = canonical()
  const c = stepContract(step, ctx)
  // The selection ContentStep.tsx renders from: no portal block, no leading
  // prerequisite lines, no instructions of the step's own.
  const screen = instructionsOf(step, ctx)
  assert.equal(screen.held, true, 'an authority holds the change')
  assert.equal(screen.portal, null)
  assert.deepEqual(screen.before, [])
  assert.deepEqual(screen.steps, [])
  // So the only thing under What to do is the contract's action, and the export
  // carries the same one line: the screen and the artifacts cannot disagree.
  const v = view(step)
  assert.deepEqual(v.whatToDo, [c.whatToDo.text])
  assert.match(c.whatToDo.text, /report-only/i)
  assert.doesNotMatch(c.whatToDo.text, DOING)
  // The screen has no second reading of the content to fall back on: the JSX
  // renders `instructions`, and the `whatToDo.before` / `whatToDo.steps` arrays
  // it used to build unconditionally are no longer reachable from it.
  const jsx = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  assert.doesNotMatch(jsx, /w\.before/, 'ContentStep builds the leading lines itself again')
  assert.doesNotMatch(jsx, /w\.steps/, 'ContentStep reads the step instructions itself again')
})

// ---- 15. and the held instruction is the one that would undo the protection ----

test('005.15: a Report-only policy whose content turns off the setting it replaces offers that instruction only while the change is due', () => {
  const { due, observing } = observingWithAPrerequisite()
  const cs = contentStepFor(due.step) as Record<string, any>
  // The step exists to be the destructive case: its first instruction turns off
  // the tenant's own MFA-at-device-registration setting because the policy
  // replaces it.
  const before = ((cs.whatToDo ?? {}).before ?? []) as string[]
  assert.ok(before.some((l) => PREREQ_LINE.test(l)), `the content no longer carries the prerequisite: ${JSON.stringify(before)}`)

  // Today is the day to make the change: nothing holds it, so the screen offers
  // the prerequisite above the portal lines and the export carries it too.
  assert.deepEqual(due.step.blockers, [], `still blocked: ${JSON.stringify(due.step.blockers)}`)
  assert.equal(unavailableReason(due.step), null)
  assert.equal(implementationOffered(due.step), true)
  const dueScreen = instructionsOf(due.step, due.ctx)
  assert.equal(dueScreen.held, false)
  assert.ok(dueScreen.portal && dueScreen.portal.length > 0, 'the policy is offered')
  assert.ok(dueScreen.before.some((l) => PREREQ_LINE.test(l)), `the prerequisite is not offered when it should be: ${JSON.stringify(dueScreen.before)}`)
  assert.ok(due.view(due.step).whatToDo.some((l) => PREREQ_LINE.test(l)), 'and the export carries it')

  // The plan then deploys that same policy, and it sits in report-only with two
  // days behind it: healthy, nothing wrong with it, and the only thing left to
  // submit is the enforcement it has not earned.
  const step = observing.step
  assert.equal(step.state.lifecycle, 'report-only')
  assert.equal(step.state.condition, 'healthy')
  assert.deepEqual(step.blockers, [])
  assert.equal(unavailableReason(step), null)
  assert.equal(enforcementUnearned(step), true)
  const t = step.tracking!
  assert.equal(t.evidenceQuality, 'enough')
  assert.equal(t.failures, 0)
  assert.equal(t.readyNow, false)
  assert.ok(t.seenInScope! < t.activeInScope!, `people in scope are still unseen (${t.seenInScope} of ${t.activeInScope})`)

  // So the screen withholds it. Telling the operator to turn off the setting the
  // policy replaces, while the replacement is only watching, would leave device
  // registration with neither.
  const screen = instructionsOf(step, observing.ctx)
  assert.equal(screen.held, true)
  assert.equal(screen.portal, null)
  assert.deepEqual(screen.before, [], 'the screen still instructs the tenant change')
  assert.deepEqual(screen.steps, [])
  assert.equal(jsonOffered(step), false)
  assert.deepEqual(stepOperations(step), [])

  // And the export says exactly what the screen says: the contract's action,
  // which is to keep watching, and nothing else.
  const v = observing.view(step)
  const c = stepContract(step, observing.ctx)
  assert.deepEqual(v.whatToDo, [c.whatToDo.text])
  assert.doesNotMatch(v.whatToDo.join(' | '), PREREQ_LINE)
  assert.match(v.whatToDo.join(' | '), /report-only/i)
  assert.doesNotMatch(v.whatToDo.join(' | '), DOING)
  // Nor does any other artifact a person or a tool reads carry it.
  const said = [...stepLines(step, observing.ctx), ...v.doneWhen, v.dates ?? '', stepContext(step, observing.view)].join(' | ')
  assert.doesNotMatch(said, PREREQ_LINE, `an artifact still states the prerequisite: ${said}`)
})

// ---- 16. the plan carries no placement for the step at all ----

test('005.16: the whole schedule placement is withdrawn — no start date, no batch, no overrun, no empty wave', () => {
  const { step, run } = canonical()
  const sch = run.schedule
  // `startAt` is the day a step enforces on. The step has no such day.
  assert.equal(sch.startAt[step.id], undefined, 'the schedule still dates the step’s enforcement')
  assert.equal(sch.waveOf[step.id], undefined, 'no wave enforces it')
  for (const w of sch.waves) assert.ok(!w.stepIds.includes(step.id), `wave ${w.wave} still carries the step`)
  // Nor does any wave survive with nothing in it: an empty wave is a dated
  // rollout phase with no rollout, and its dates were the withdrawn step’s.
  for (const w of sch.waves) if (w.wave >= 1) assert.ok(w.stepIds.length > 0, `wave ${w.wave} is empty`)
  assert.deepEqual(
    sch.waves.map((w) => w.wave),
    sch.waves.map((_, i) => i),
    'and the waves are still numbered without a gap',
  )
  // No change window names it, in either direction.
  assert.equal(sch.batchWith[step.id], undefined, 'the step still shares a change window')
  for (const [id, ids] of Object.entries(sch.batchWith)) assert.ok(!ids.includes(step.id), `${id} still lands in the same window as the step`)
  assert.ok(!sch.extendedBy.includes(step.id), 'the step is still counted among those running past the band')
  // Every wave’s dates come from a step the wave still carries.
  for (const w of sch.waves) {
    if (w.wave < 1) continue
    assert.ok(
      w.stepIds.some((id) => sch.startAt[id] === w.start),
      `wave ${w.wave} starts on a day no step in it starts on`,
    )
  }
  // The plan’s end and its critical path are measured to what the plan carries.
  const last = Object.values(sch.startAt).reduce((m, x) => (x > m ? x : m), sch.start)
  assert.ok(sch.targetEnd >= last, 'the plan ends no earlier than its last placed step')
  assert.ok(!sch.derivation.chain.includes(step.id), `the critical path runs through the withdrawn step: ${sch.derivation.chain.join(' → ')}`)
  assert.ok(!sch.derivation.criticalPath.includes(contentStepFor(step)!.title as string), `the critical-path sentence names the withdrawn step: ${sch.derivation.criticalPath}`)
  // What was withdrawn is kept, whole, under the one name that says what it is
  // worth — and it is not the empty record that would hide the withdrawal.
  const kept = sch.forecastOnly?.[step.id]
  assert.ok(kept, 'the rollout the schedule drew is kept')
  assert.equal(typeof kept!.startAt, 'string', 'including the day it had been dated to enforce on')
  assert.ok(kept!.events, 'and the events the generator wrote')
})

// ---- 17. the exported plan conclusions cannot be the step’s ----

test('005.17: the grounding bundle’s plan end, length and critical path are read from a plan without the step', () => {
  const { step, steps, snapshot, view, run } = canonical()
  const bundle = groundingBundle({ view, tenant: 'Tenant', snapshot, coverage: run.coverage, steps, schedule: run.schedule, redacted: false, generated: 'Sep 6, 2026', cleanup: [] }) as unknown as {
    plan: { targetEnd: string; weeks: number; criticalPath: string }
  }
  const withdrawn = new Set(Object.keys(run.schedule.forecastOnly ?? {}))
  assert.ok(withdrawn.has(step.id), 'the step was settled, or this proves nothing')
  // The three conclusions the bundle exports are the read-back of a placement
  // the step is not in — not the build's, patched afterwards.
  const without = readBackPlacement(run.steps, run.schedule.placement!, withdrawn)
  assert.equal(bundle.plan.targetEnd, without.targetEnd)
  assert.equal(bundle.plan.weeks, without.weeks)
  assert.equal(bundle.plan.criticalPath, without.derivation.criticalPath)
  // And they are not the step's own: the day the schedule had it enforcing on
  // ends nothing, and the sentence about what sets the plan's length does not
  // name it.
  const projected = run.schedule.forecastOnly?.[step.id]!
  assert.equal(typeof projected.startAt, 'string', 'the step had a placement to withdraw')
  assert.ok(!without.derivation.chain.includes(step.id), 'the critical path runs through the withdrawn step')
  assert.ok(!bundle.plan.criticalPath.includes(contentStepFor(step)!.title as string), `the exported critical path names the withdrawn step: ${bundle.plan.criticalPath}`)
  assert.ok(!bundle.plan.criticalPath.includes(absoluteDate(projected.startAt!)), 'the exported critical path carries the withdrawn enforcement day')
  // The same read-back with the step still in it is a different plan, so the
  // withdrawal is what these values are measured without.
  const with_ = readBackPlacement(run.steps, run.schedule.placement!)
  assert.notDeepEqual(with_.startAt, without.startAt, 'withdrawing the placement is what makes the difference')
})

// ---- 18. withdrawing is the whole read-back, and it is idempotent ----

test('005.18: settling is a read-back of the placement, so it is the same answer whether it runs once or twice', () => {
  const f = fixture(FIXTURE)
  const run = runFixture(f)
  const before = JSON.stringify(run.schedule)
  // The plan pipeline calls it once; a regeneration can call it again on a plan
  // already settled. The second pass must not settle a second time over its own
  // absence — no wave renumbered again, no start removed twice, no shorter plan.
  settleForecast(run.steps, run.schedule)
  assert.equal(JSON.stringify(run.schedule), before, 'a second settle moved the plan')
  // And with nothing to withdraw the read-back is exactly what the build
  // produced, so the recomputation itself changes no plan that has no held step.
  const untouched = runFixture(fixture(FIXTURE))
  const rebuilt = readBackPlacement(untouched.steps, untouched.schedule.placement!)
  const settled = new Set(Object.keys(untouched.schedule.forecastOnly ?? {}))
  assert.ok(settled.size > 0, 'the fixture has a settled step, or this proves nothing')
  const again = readBackPlacement(untouched.steps, untouched.schedule.placement!, settled)
  assert.equal(JSON.stringify(again.waves), JSON.stringify(untouched.schedule.waves), 'the plan is the read-back of its own placement, minus the withdrawn steps')
  assert.notEqual(JSON.stringify(rebuilt.startAt), JSON.stringify(again.startAt), 'and withdrawing them is what makes the difference')
  for (const id of settled) assert.ok(rebuilt.startAt[id] !== undefined, `${id} had a placement to withdraw`)
})
