// The canonical Plan case: Not deployed / Implement (task 004).
//
// One real step on one real fixture — demo-week2 / s-goal-admin-session,
// "Shorten Admin Sessions" — because it is the whole case at once: the policy
// genuinely is not deployed (Foundation B), nothing holds it (no missing object,
// no unresolved decision, no emergency-access gate, no readiness threshold),
// Foundation A offers an implementation, the operation is a true create, and the
// scope is one this scan settled, so "Who this touches" can be checked against
// the operation rather than against the goal's people.
//
// Nothing here builds a Step. The fixture runs through the whole engine and the
// assertions read what a person would see: the frozen Step Contract, the portal
// lines, the JSON, the PowerShell, and the export view the calendar entry, the
// prompt pack and the grounding bundle all speak from.
//
// What it exists to catch: the case turning into an update, the created policy
// landing enabled instead of report-only, the plan claiming report-only days or
// ready-to-enforce before the policy has been deployed at all, and an artifact
// saying something the screen does not.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { implementationOffered, operationsOf, unavailableReason } from '../../roadmap/operations.ts'
import { effectsOf } from '../../roadmap/strand.ts'
import { readyWhen } from '../../derive/readyWhen.ts'
import { reached, stepPopulation } from '../../derive/population.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { announcementDraft, groundingBundle, promptPack, stepContext } from '../../roadmap/prompts.ts'
import { findTaggedPolicies } from '../../roadmap/generate.ts'
import { absoluteDate, longDate } from '../../copy/dates.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { content } from '../../content/content.ts'
import type { Step } from '../../roadmap/types.ts'
import { stepContract } from './stepContract.ts'
import { stepExportView, commsFor, copyBoxes, datesLineFor, ifWrongLineFor, stepLines } from './stepExport.ts'
import { policyJsonText, jsonOffered, stepOperations, createsNewPolicy } from './stepJson.ts'
import { powershellFor } from './stepPowerShell.ts'
import { stepPortalLines, portalNamesFor } from './stepPortal.ts'
import { rowWhen } from './rowWhen.ts'
import { nextMilestone } from '../../roadmap/lifecycle.ts'
import { awaitingDeployment, enforcementTiming } from '../../roadmap/forecast.ts'
import { statusOf } from './statusWord.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

/** The one canonical case, named here so a change to it is a change to this test. */
const FIXTURE = 'demo-week2'
const STEP_ID = 's-goal-admin-session'

const HOLE = /\{[a-zA-Z0-9_:]+\}/
/** A date as `absoluteDate` writes one, so a row that states a reason instead of a date is not read as one. */
const DATE = /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/
const GUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i

function canonical(): { step: Step; ctx: StepVarContext; steps: Step[]; planId: string } {
  const f = fixture(FIXTURE)
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === STEP_ID)
  assert.ok(step, `${FIXTURE} no longer carries ${STEP_ID}`)
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
  return { step, ctx, steps: r.steps, planId: f.planId }
}

/** The step's portal lines, as the screen and the exports both render them. */
function portalOf(step: Step, ctx: StepVarContext): string[] {
  const cs = contentStepFor(step) as Record<string, unknown> | undefined
  const ex = stepVars(step, ctx)
  const lines = stepPortalLines(step, portalNamesFor(ctx, ex, String(cs?.title ?? step.title)))
  assert.ok(lines && lines.length > 0, 'the canonical case renders no portal instructions')
  return lines
}

// ---- 1. the case is real, and it is genuinely Not deployed ----

test('004.1: the canonical case is a Conditional Access policy step that is genuinely Not deployed', () => {
  const { step } = canonical()
  assert.equal(step.kind, 'create', 'the canonical case is a policy the plan writes')
  assert.equal(contentStepFor(step)?.kind, 'policy')
  // Foundation B, and only Foundation B, says where the policy is. Having an
  // operation to run is not deployment: the lifecycle has to say so itself.
  assert.equal(step.state.lifecycle, 'not-deployed')
  assert.equal(step.state.condition, 'healthy', 'the canonical Implement case has no blocker, decision or conflict')
  assert.equal(step.state.satisfied, false)
  assert.equal(step.state.inPlace, false)
  assert.equal(step.state.setAside, false)
  // Nothing has been observed of the policy, because there is no policy: no
  // tracking, no report-only date, and the member the step requires is absent.
  assert.equal(step.tracking, null, 'a not-deployed policy has nothing tracked')
  assert.equal(readyWhen(step), null, 'a not-deployed policy is not ready to enforce')
  assert.equal(step.state.members.length, 1, 'the canonical case is a single-policy goal')
  assert.equal(step.state.members[0].change.latest.state, 'absent')
  assert.equal(step.state.members[0].change.latest.artifact, null)
})

// ---- 2. Foundation A offers the implementation, and the contract reports it ----

test('004.2: implementation is offered by Foundation A and the frozen contract says so', () => {
  const { step, ctx } = canonical()
  assert.equal(unavailableReason(step), null, 'nothing holds the canonical Implement case')
  assert.equal(implementationOffered(step), true)
  const c = stepContract(step, ctx)
  assert.equal(c.implementation.offered, true)
  assert.equal(c.implementation.offered && c.implementation.operations, 1)
  // The four channels are offered together or not at all.
  assert.equal(jsonOffered(step), true)
  assert.equal(portalOf(step, ctx).length > 0, true)
})

// ---- 3. a true create, in every channel ----

test('004.3: the operation is a create, and no channel describes an update', () => {
  const { step, ctx } = canonical()
  const ops = operationsOf(step)
  assert.equal(ops.length, 1)
  const op = ops[0]
  assert.equal(op.mode, 'create')
  assert.ok(op.policyId === null || op.policyId === undefined, 'a create names no tenant policy to change')
  assert.ok(op.target === null || op.target === undefined, 'a create has no tenant policy as its target')
  assert.equal(createsNewPolicy(step), true)
  // PowerShell calls New-, never Update-.
  const ps = powershellFor(stepOperations(step))
  assert.match(ps, /New-MgIdentityConditionalAccessPolicy/)
  assert.doesNotMatch(ps, /Update-MgIdentityConditionalAccessPolicy/)
  // The portal opens New policy and ends on Create, and says nothing about
  // opening or preserving a policy the tenant already has.
  const portal = portalOf(step, ctx)
  assert.match(portal[0], /New policy/)
  assert.match(portal.at(-1)!, /Create/)
  assert.doesNotMatch(portal.join('\n'), /Leave everything else as it is|already have|Keep it/i)
})

// ---- 4. report-only first: the central invariant of this case ----

test('004.4: the create lands in report-only, and every channel says so', () => {
  const { step, ctx } = canonical()
  const body = operationsOf(step)[0].body as Record<string, unknown>
  assert.equal(body.state, 'enabledForReportingButNotEnforced', 'IAMAI never creates an absent policy enabled')
  // The JSON tab, the PowerShell tab and Download JSON are one text.
  const json = policyJsonText(step)
  assert.match(json, /"state": "enabledForReportingButNotEnforced"/)
  assert.doesNotMatch(json, /"state": "enabled"/)
  assert.ok(powershellFor(stepOperations(step)).includes(json), 'the PowerShell body is the JSON the tab shows')
  // The portal instruction sets the same state.
  assert.match(portalOf(step, ctx).at(-1)!, /Report-only/)
  // And so does everything downstream of the screen.
  const v = stepExportView(step, ctx)
  assert.match(v.whatToDo.at(-1)!, /Report-only/)
  assert.match(String(v.dates), /Report-only/)
})

test('004.5: nothing claims report-only evidence, readiness or enforcement before the policy exists', () => {
  const { step, ctx } = canonical()
  const c = stepContract(step, ctx)
  // The state word the collapsed row shows, and the stage the opened step shows.
  assert.notEqual(statusOf(step).word, 'Report-only')
  assert.notEqual(statusOf(step).word, 'Enforced')
  assert.equal(c.state.stage, 'Not deployed')
  assert.equal(c.state.conditionLabel, 'Healthy')
  // The next safe move is the report-only deployment, not enforcement.
  assert.equal(c.whatToDo.kind, 'deploy')
  assert.match(c.whatToDo.text, /report-only/i)
  assert.doesNotMatch(c.whatToDo.text, /enforce/i)
  // No observation is reported for a policy nothing has observed, and the
  // completion is the report-only days the plan has yet to start — never a
  // change to settings that are not there.
  assert.deepEqual(c.found, [], 'a first scan of an absent policy has nothing to report as a finding')
  assert.ok(
    c.doneWhen.some((l) => /report-only/i.test(l)),
    `Done when must name the report-only observation this case still owes: ${c.doneWhen.join(' | ')}`,
  )
  assert.doesNotMatch(c.doneWhen.join(' | '), /changed settings|after the change/i)
  for (const line of c.doneWhen) assert.doesNotMatch(line, HOLE, `a hole in Done when: ${line}`)
  // The one date the plan has earned: the report-only deployment. The schedule
  // holds a planned enforcement day for its own waves, and no surface states it
  // while the policy is not deployed — a window nothing has been watched in
  // cannot have produced a change date.
  const reportOnlyAt = ctx.reportOnlyAt
  assert.ok(reportOnlyAt, 'the plan schedules the report-only deployment')
  const dates = String(stepExportView(step, ctx).dates)
  assert.match(dates, /Report-only from/)
  assert.match(dates, new RegExp(absoluteDate(reportOnlyAt!)))
  assert.doesNotMatch(dates, /Enforce |Change /, `an enforcement date beside a policy that does not exist: ${dates}`)
  assert.doesNotMatch(dates, new RegExp(absoluteDate(step.events!.enforce.at)), `the planned enforcement day reached the Dates line: ${dates}`)
  assert.doesNotMatch(dates, HOLE, `a hole in the Dates line: ${dates}`)
  // The screen reads the same line the export does, so neither can drift.
  assert.equal(datesLineFor(step, contentStepFor(step) as Record<string, unknown>), '{datesDeploy}')
})

// ---- 5. the screen the operator reads ----

test('004.6: the expanded step answers every question the contract makes non-optional', () => {
  const { step, ctx } = canonical()
  const c = stepContract(step, ctx)
  assert.ok(c.why.trim().length > 0)
  assert.notEqual(c.why.trim(), c.title, 'Why explains the control, it does not repeat the title')
  assert.ok(c.whatToDo.text.trim().length > 0)
  assert.ok(c.doneWhen.length > 0)
  // Neither a blocker nor a decision competes with the action on this case.
  assert.deepEqual(c.fix, [], 'the canonical Implement case has nothing to fix first')
  assert.equal(c.multiPolicy, false)
  assert.equal(c.members.length, 1)
  assert.equal(c.members[0].lifecycle, null, 'no member object is deployed yet')
})

test('004.7: Who this touches is the operation’s own reach, not the goal’s people', () => {
  const { step, ctx } = canonical()
  // The step has a policy of its own, so the reach is read from it (Foundation A):
  // the cohort the operation settled, never Step.population standing in for it.
  assert.notEqual(effectsOf(step), null, 'the canonical case carries its own resolved policy')
  assert.equal(reached(step), step.cohort)
  const c = stepContract(step, ctx)
  assert.ok(c.who, 'the canonical case reaches somebody')
  assert.equal(c.who!.known, true, 'a settled scope is stated, never left unknown')
  assert.doesNotMatch(c.who!.text, /\b0\b|nobody/i, 'a known reach is never zero')
  // The operation scopes to directory roles alone, so everybody it reaches is an
  // admin; the line the screen shows has to agree with the body being submitted.
  const users = ((operationsOf(step)[0].body as Record<string, any>).conditions?.users ?? {}) as Record<string, unknown[]>
  assert.ok((users.includeRoles ?? []).length > 0)
  assert.deepEqual(users.includeUsers ?? [], [])
  assert.deepEqual(users.includeGroups ?? [], [])
  const view = stepPopulation(step)!
  assert.equal(view.active, view.admins, 'an admin-scoped policy reaches admins and nobody else')
  assert.match(c.who!.text, new RegExp(`${view.admins} admin`))
})

// ---- 6. the portal instruction a person actually follows ----

test('004.8: the portal instructions name the policy, the objects and the state in human terms', () => {
  const { step, ctx } = canonical()
  const portal = portalOf(step, ctx)
  const text = portal.join('\n')
  assert.match(text, new RegExp(`Name: ${step.naming!.proposed}`), 'the instruction names the policy being created')
  // The exclusions group by the name the tenant knows it by, never a raw id,
  // and never an emergency account by name.
  assert.match(text, /Users → Exclude → Groups: /)
  assert.doesNotMatch(text, GUID, `a raw object id reached the portal instructions: ${text}`)
  assert.doesNotMatch(text, HOLE, `an unfilled placeholder reached the portal instructions: ${text}`)
  // Every semantic section the body carries is instructed: who, what, the
  // conditions and the session controls it sets.
  const body = operationsOf(step)[0].body as Record<string, any>
  assert.match(text, /Users → Include/)
  assert.match(text, /Target resources/)
  if (body.conditions?.clientAppTypes) assert.match(text, /Client apps/)
  if (body.sessionControls?.signInFrequency) assert.match(text, /Sign-in frequency/)
  if (body.sessionControls?.persistentBrowser) assert.match(text, /Persistent browser session/)
})

// ---- 7. the artifacts, against the screen ----

test('004.9: the export view says what the screen says about this case', () => {
  const { step, ctx } = canonical()
  const c = stepContract(step, ctx)
  const v = stepExportView(step, ctx)
  const portal = portalOf(step, ctx)
  assert.equal(v.title, c.title)
  assert.equal(v.why, c.why)
  // The export never suppresses an implementation the screen offers, and never
  // rewrites the completion the frozen contract states.
  assert.deepEqual(v.whatToDo.slice(-portal.length), portal, 'the export carries the same portal instructions the screen shows')
  // And it leads with the same next action: the frozen contract's sentence,
  // not the portal path with the operation itself left unsaid.
  assert.equal(v.whatToDo[0], c.whatToDo.text, 'the export must lead with the action the screen states')
  assert.match(v.whatToDo[0], /report-only/i)
  assert.deepEqual(v.doneWhen, c.doneWhen, 'the export must not invent a second Done when')
  // The dates and the rollback follow the operation, not the words the step's
  // content was written with: a created policy has a report-only deployment to
  // date and no settings to put back.
  assert.equal(datesLineFor(step, contentStepFor(step) as Record<string, unknown>), '{datesDeploy}')
  assert.equal(ifWrongLineFor(step, contentStepFor(step) as Record<string, unknown>), '{policyIfWrong}')
  assert.doesNotMatch(String(v.dates), /Change /, 'a create deploys to report-only; it does not "Change"')
  assert.match(String(v.ifWrong), /report-only, or delete it/)
  assert.doesNotMatch(String(v.ifWrong), /back to what they were/, 'a created policy has no previous settings to restore')
})

test('004.10: the calendar entry and the prompt pack carry the same create-in-report-only', () => {
  const { step, ctx, steps, planId } = canonical()
  const view = (s: Step): ReturnType<typeof stepExportView> => stepExportView(s, ctx)
  const ics = buildIcs(steps, 'Fixture tenant', planId, view)
  const event = ics
    .split('BEGIN:VEVENT')
    .find((b) => b.includes(`${planId}-${step.id}@iamai`))
  assert.ok(event, 'the canonical case has a calendar entry')
  // ICS folds long lines, so compare on the unfolded text.
  const unfolded = event!.replace(/\r\n /g, '')
  assert.match(unfolded, /Report-only/)
  assert.match(unfolded, /New policy/)
  assert.doesNotMatch(unfolded, /Update-Mg/)
  const prompt = stepContext(step, view)
  assert.match(prompt, /Report-only/)
  assert.doesNotMatch(prompt, /changed settings|after the change/i)
})

// ---- 8. no enforcement is dated, on any surface, while the policy is absent ----

test('004.11: every date the operator reads on this step is the report-only deployment, never an enforcement', () => {
  const { step, ctx, steps, planId } = canonical()
  assert.equal(step.state.lifecycle, 'not-deployed')
  assert.equal(step.tracking, null)
  assert.equal(readyWhen(step), null)
  // The plan keeps a forecast for this policy — the rings it placed, the wave it
  // read back off them, the enforcement instant they end on — because drawing a
  // whole rollout before any policy exists is what a roadmap is for. What it may
  // not do is hand that forecast to a person as this step's date, so the forecast
  // is a classified fact rather than a bare instant: roadmap/forecast.ts calls it
  // `forecast`, never `committed`, and it stays that until a scan finds the
  // policy in report-only and Foundation B's evidence carries it further.
  const timing = enforcementTiming(step)
  assert.equal(timing.basis, 'forecast', 'the schedule’s enforcement instant for an absent policy is a projection, not a commitment')
  assert.equal(timing.at, step.events!.enforce.at, 'the projection is the schedule’s own instant; nothing here recomputes it')
  assert.equal(awaitingDeployment(step), true)
  assert.notEqual(nextMilestone(step).kind, 'enforce', 'a forecast never becomes the step’s actionable milestone')
  // And every place a person reads a date for this step reads the one day the
  // plan has actually scheduled: the report-only deployment.
  const enforceDay = absoluteDate(step.events!.enforce.at)
  const reportOnlyDay = absoluteDate(ctx.reportOnlyAt!)
  assert.notEqual(enforceDay, reportOnlyDay, 'the two days differ, so the assertions below can tell them apart')
  const view = (s: Step): ReturnType<typeof stepExportView> => stepExportView(s, ctx)
  const v = view(step)
  // The collapsed row's date column, which is where a person reads a step's date
  // without opening it.
  assert.equal(rowWhen(step), reportOnlyDay)
  assert.notEqual(rowWhen(step), enforceDay, 'the row dates an enforcement for a policy that does not exist')
  // The Dates line the opened step and the export both read.
  assert.match(String(v.dates), /Report-only from/)
  assert.match(String(v.dates), new RegExp(reportOnlyDay))
  assert.doesNotMatch(String(v.dates), new RegExp(enforceDay), `the Dates line dates an enforcement: ${v.dates}`)
  // The next milestone Foundation B states for the step.
  assert.equal(nextMilestone(step).kind, 'deploy')
  assert.notEqual(nextMilestone(step).at, step.events!.enforce.at)
  // The prompt pack.
  assert.doesNotMatch(stepContext(step, view), new RegExp(enforceDay), 'the prompt pack dates an enforcement')
  // The calendar entry is the report-only deployment day, and not the
  // enforcement rings the schedule has proposed and nothing has earned.
  const event = buildIcs(steps, 'Fixture tenant', planId, view)
    .split('BEGIN:VEVENT')
    .find((b) => b.includes(`${planId}-${step.id}@iamai`))!
  const day = (iso: string): string => iso.slice(0, 10).replaceAll('-', '')
  assert.ok(event.includes(`DTSTART;VALUE=DATE:${day(ctx.reportOnlyAt!)}`), event)
  assert.ok(!event.includes(`DTSTART;VALUE=DATE:${day(step.events!.enforce.at)}`), 'the calendar books the enforcement day')
  assert.ok(step.rings.length > 0, 'the schedule still proposes the rings it plans with')
  assert.ok(!event.includes(`DTSTART;VALUE=DATE:${day(step.rings[0].plannedStart)}`), 'the calendar books the enforcement rings')
  assert.doesNotMatch(String(v.dates), new RegExp(absoluteDate(step.rings[0].plannedStart)), 'a ring date reached the Dates line')
})

// ---- 9. a policy created from the Portal instructions is this step's ----

test('004.12: the Portal instructions carry the operation’s description, and the next scan matches the created policy to this step', () => {
  const { step, ctx, planId } = canonical()
  const op = operationsOf(step)[0]
  const description = String((op.body as Record<string, unknown>).description)
  assert.ok(description.startsWith('[IAMAI:'), 'the canonical operation tags the policy it creates')
  // The instruction hands the operator the operation's own description, whole —
  // it is not rebuilt here and it is not left out, so a policy created through
  // the Portal is the artifact the JSON, the PowerShell and the download create.
  const line = portalOf(step, ctx).find((l) => l.startsWith('Description: '))
  assert.ok(line, 'the Portal instructions omit the description the operation carries')
  const pasted = line!.slice('Description: '.length).split(' — ')[0]
  assert.equal(pasted, description)
  assert.ok(policyJsonText(step).includes(description), 'the JSON carries the same description')
  assert.ok(powershellFor(stepOperations(step)).includes(description), 'the PowerShell carries the same description')
  // The policy a person creates by following those instructions, read back by
  // the next scan: it is this step's, and this member of it.
  assert.deepEqual(findTaggedPolicies(ctx.snapshot, planId, step.id), [], 'the canonical case has no tagged policy in the tenant yet')
  const snapshot = structuredClone(ctx.snapshot)
  snapshot.config.caPolicies!.rows.push({ id: 'portal-created-policy', displayName: step.naming!.proposed, description: pasted, state: 'enabledForReportingButNotEnforced' } as never)
  assert.deepEqual(findTaggedPolicies(snapshot, planId, step.id), [{ policyId: 'portal-created-policy', memberKey: op.memberKey }], 'a policy created from the Portal instructions is not matched to this step')
})

// ---- 10. the forecast is carried as a forecast, and never as a commitment ----

test('004.13: the grounding bundle states what the step’s enforcement date is worth, beside the date', () => {
  const f = fixture(FIXTURE)
  const r = runFixture(f)
  const step = r.steps.find((st) => st.id === STEP_ID)!
  const { ctx } = canonical()
  const view = (st: Step): ReturnType<typeof stepExportView> => stepExportView(st, ctx)
  // The bundle speaks from the screen's view and has no other branch: the
  // fallback that emitted the schedule's own events and rings is gone (task
  // 013), because it was a second description of every step. A tool reading this
  // gets an instant; without the basis beside it, it could not tell a projection
  // from a milestone something earned.
  const bundle = groundingBundle({
    view,
    tenant: 'Fixture tenant',
    snapshot: f.snapshot,
    coverage: r.coverage,
    steps: r.steps,
    schedule: r.schedule,
    redacted: false,
    generated: f.snapshot.asOf,
  })
  const plan = bundle.plan as { steps: Record<string, unknown>[] }
  const row = plan.steps.find((x) => x.id === STEP_ID)!
  assert.deepEqual(row.enforcement, { basis: 'forecast', at: step.events!.enforce.at }, 'the bundle does not say the enforcement instant is a forecast')
  // And the engine's own field names are in none of it: one reading of a step,
  // and it is the screen's.
  for (const key of ['rings', 'events', 'plainTitle', 'forManager']) assert.equal(key in row, false, `the bundle carries the engine's ${key}`)
})

test('004.14: across every fixture, a forecast enforcement never becomes an actionable one', () => {
  for (const f of allFixtures()) {
    const r = runFixture(f)
    for (const st of r.steps) {
      const t = enforcementTiming(st)
      // Only a policy Foundation B has already carried to ready-to-enforce or
      // beyond has an enforcement anything has earned. Everything before that —
      // including a policy sitting healthily in report-only whose window has not
      // closed — is the roadmap projecting forward, and the projection is never
      // the step's next action.
      if (t.basis === 'committed') assert.ok(st.state.lifecycle === 'ready-to-enforce' || st.state.lifecycle === 'enforced', `${f.name}/${st.id}: an enforcement is called committed at ${st.state.lifecycle}`)
      if (t.basis === 'forecast') assert.notEqual(nextMilestone(st).kind, 'enforce', `${f.name}/${st.id}: a forecast enforcement is the step's milestone`)
      if (!awaitingDeployment(st)) continue
      // A policy that is not in the tenant: the forecast stays on the step, and
      // no surface hands it to a person as this step's date.
      assert.notEqual(t.basis, 'committed', `${f.name}/${st.id}: an absent policy has a committed enforcement`)
      assert.equal(readyWhen(st), null, `${f.name}/${st.id}: an absent policy is ready to enforce`)
      // The row's date column: a readiness hold states its reason there instead
      // of a date, so only a row that is a date is checked, and the only date it
      // may be is the report-only deployment.
      const row = rowWhen(st)
      if (t.at !== null) assert.notEqual(row, absoluteDate(t.at), `${f.name}/${st.id}: the row dates the forecast enforcement`)
      if (DATE.test(row)) assert.equal(row, absoluteDate(st.reportOnlyAt ?? ''), `${f.name}/${st.id}: the row dates something other than the report-only deployment`)
    }
  }
})

// ---- 11. the send-ready communication states the forecast as a forecast ----

/** The words the content file gives a message that names a date the roadmap projected. */
const FORECAST_NOTE = String((content.shared as unknown as Record<string, unknown>).commsForecastNote)

test('004.15: the canonical step keeps its projected enforcement date in the email, and the email says the date is a target', () => {
  const { step, ctx } = canonical()
  assert.equal(step.state.lifecycle, 'not-deployed')
  assert.equal(enforcementTiming(step).basis, 'forecast')
  const cs = contentStepFor(step) as Record<string, unknown>
  const ex = stepVars(step, ctx) as Record<string, unknown>
  const email = commsFor(cs, ex, step)
  assert.ok(email, 'the canonical step renders no email')
  // The roadmap's projected enforcement day is still in the message. This is not
  // fixed by deleting the date: a rollout planner has to be able to draw a whole
  // path before a policy exists, and the operator has to be able to tell people
  // what it is (owner decision, 004 correction 2).
  const projected = String(ex.enforceLong)
  assert.equal(projected, longDate(step.events!.enforce.at), 'the email’s day is the schedule’s own projection')
  assert.ok(email!.body.includes(projected), `the projected date left the email: ${email!.body}`)
  // And the message says what that day is worth, in its own paragraph, in the
  // words the content file gives it — never a sentence composed here.
  assert.ok(email!.extra.includes(FORECAST_NOTE), `the email states a projected date as a commitment: ${[email!.body, ...email!.extra].join(' / ')}`)
  assert.match(FORECAST_NOTE, /not a commitment/)
  assert.match(FORECAST_NOTE, /report-only/)
  // The Dates line above it withholds the enforcement date entirely; the email
  // below it names the day and qualifies it. Both say the same thing about what
  // the plan has earned, which is what they disagreed about.
  const dates = String(stepExportView(step, ctx).dates)
  assert.doesNotMatch(dates, new RegExp(absoluteDate(step.events!.enforce.at)), dates)
  assert.match(dates, /Report-only from/)
  // The authoritative action is unmoved: this step deploys in report-only.
  assert.equal(nextMilestone(step).kind, 'deploy')
  assert.equal(rowWhen(step), absoluteDate(ctx.reportOnlyAt!))
})

test('004.16: what the screen copies and what the exports render is the one email, qualification included', () => {
  const { step, ctx } = canonical()
  const cs = contentStepFor(step) as Record<string, unknown>
  const email = commsFor(cs, stepVars(step, ctx) as Record<string, unknown>, step)!
  const text = [email.salutation, email.body, ...email.extra, email.signature].join('\n\n')
  // The copy button's text (ContentStep.tsx joins the same four parts) and the
  // lines every export reads: an operator cannot copy a version of this message
  // without the qualification, from either.
  const box = copyBoxes(step, ctx).find((b) => b.kind === 'comms')
  assert.ok(box, 'the canonical step renders no Tell your people box')
  assert.equal(box!.text, text)
  assert.ok(box!.text.includes(FORECAST_NOTE), 'the copied email drops the qualification')
  assert.ok(stepLines(step, ctx).includes(FORECAST_NOTE), 'the rendered lines drop the qualification')
})

test('004.17: the prompt pack’s draft announcement carries the same qualification the screen does', () => {
  const r = runFixture(fixture(FIXTURE))
  const steps = r.steps
  const source = steps.find((s) => s.comms)!
  // The draft the pack sends is the first step's, and that step's enforcement
  // is not one Foundation B has earned — including the case the schedule never
  // placed, which has no enforcement instant of its own and whose draft is
  // dated from the plan's start all the same.
  assert.equal(source.state.lifecycle, 'not-deployed')
  assert.notEqual(enforcementTiming(source).basis, 'committed', 'the draft the pack sends states a date Foundation B has earned')
  const draft = announcementDraft(steps)
  assert.ok(draft, 'the pack has no draft to send')
  // The draft the generator wrote is unchanged apart from the paragraph that
  // says what its date is worth, and that paragraph sits under the one naming
  // the day and above the sign-off.
  const parts = draft!.split('\n\n')
  assert.equal(parts[2], FORECAST_NOTE, draft!)
  assert.deepEqual([...parts.slice(0, 2), ...parts.slice(3)], source.comms!.split('\n\n'), 'the draft says something other than what the step wrote')
  // And the pack a person actually copies carries it, in both prompts built
  // from the draft (rewrite, translate) — not only in the facts block.
  const pack = promptPack({ view: (st: Step) => stepExportView(st, canonical().ctx), tenant: 'Fixture tenant', steps, schedule: r.schedule, changeRecord: '', planSummary: '', announcement: draft })
  const carrying = pack.filter((p) => p.prompt.includes(source.comms!.split('\n\n')[1]))
  assert.ok(carrying.length >= 2, `the pack builds ${carrying.length} prompts from the draft`)
  for (const p of carrying) assert.ok(p.prompt.includes(FORECAST_NOTE), `${p.title}: the prompt hands a model a projected date as a commitment`)
})

test('004.18: an enforcement Foundation B has earned is stated plainly — the qualification is not added to every message', () => {
  const f = fixture(FIXTURE)
  const r = runFixture(f)
  // A real step on the same fixture that Foundation B has carried to
  // ready-to-enforce: its date is committed, and its draft is untouched.
  const committed = r.steps.find((s) => s.comms && enforcementTiming(s).basis === 'committed')
  assert.ok(committed, `${FIXTURE} no longer carries a step with an earned enforcement and a draft`)
  assert.ok(committed!.state.lifecycle === 'ready-to-enforce' || committed!.state.lifecycle === 'enforced')
  assert.equal(announcementDraft([committed!]), committed!.comms, 'a committed enforcement is downgraded to a target')
  assert.ok(!announcementDraft([committed!])!.includes(FORECAST_NOTE))
  // The screen reads the same authority. Same content, same tenant values, only
  // the step whose lifecycle classifies the date changed — and the paragraph
  // goes away.
  const { step, ctx } = canonical()
  const cs = contentStepFor(step) as Record<string, unknown>
  const ex = stepVars(step, ctx) as Record<string, unknown>
  assert.ok(commsFor(cs, ex, step)!.extra.includes(FORECAST_NOTE))
  assert.ok(!commsFor(cs, ex, committed!)!.extra.includes(FORECAST_NOTE), 'the screen qualifies a date that has been earned')
})

test('004.19: across every fixture, a message names a projected enforcement date only with the paragraph that says so', () => {
  for (const f of allFixtures()) {
    const r = runFixture(f)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
    for (const s of r.steps) {
      const cs = contentStepFor(s) as Record<string, unknown> | undefined
      if (!cs) continue
      const email = commsFor(cs, stepVars(s, ctx) as Record<string, unknown>, s)
      if (!email) continue
      // Only a message that states this step's own enforcement day is at issue.
      const names = String((cs.comms as Record<string, unknown>).body ?? '').includes('{enforceLong}')
      const qualified = email.extra.includes(FORECAST_NOTE)
      if (!names) {
        assert.equal(qualified, false, `${f.name}/${s.id}: a message that names no enforcement date is qualified anyway`)
        continue
      }
      assert.equal(qualified, enforcementTiming(s).basis !== 'committed', `${f.name}/${s.id}: the email and roadmap/forecast.ts disagree about what the date is worth`)
    }
    // The draft the pack would send, on the same terms.
    const draft = announcementDraft(r.steps)
    const source = r.steps.find((s) => s.comms)
    if (draft === null || source === undefined) continue
    assert.equal(draft.includes(FORECAST_NOTE), enforcementTiming(source).basis !== 'committed' && source.comms!.split('\n\n').length >= 3, `${f.name}: the pack’s draft and roadmap/forecast.ts disagree`)
  }
})
