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
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { implementationOffered, operationsOf, unavailableReason } from '../../roadmap/operations.ts'
import { effectsOf } from '../../roadmap/strand.ts'
import { readyWhen } from '../../derive/readyWhen.ts'
import { reached, stepPopulation } from '../../derive/population.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { stepContext } from '../../roadmap/prompts.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import type { Step } from '../../roadmap/types.ts'
import { stepContract } from './stepContract.ts'
import { stepExportView, datesLineFor, ifWrongLineFor } from './stepExport.ts'
import { policyJsonText, jsonOffered, stepOperations, createsNewPolicy } from './stepJson.ts'
import { powershellFor } from './stepPowerShell.ts'
import { stepPortalLines, portalNamesFor } from './stepPortal.ts'
import { statusOf } from './statusWord.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

/** The one canonical case, named here so a change to it is a change to this test. */
const FIXTURE = 'demo-week2'
const STEP_ID = 's-goal-admin-session'

const HOLE = /\{[a-zA-Z0-9_:]+\}/
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
  // The dates the plan does have, in order: announce, then the report-only
  // deployment, then the enforcement it earns. Nothing is dated ahead of them.
  const reportOnlyAt = ctx.reportOnlyAt
  assert.ok(reportOnlyAt, 'the plan schedules the report-only deployment')
  assert.ok(Date.parse(reportOnlyAt!) < Date.parse(step.events!.enforce.at), 'enforcement cannot precede the report-only deployment')
  assert.ok(Date.parse(step.events!.announce!.at) < Date.parse(step.events!.enforce.at))
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
  assert.deepEqual(v.doneWhen, c.doneWhen, 'the export must not invent a second Done when')
  // The dates and the rollback follow the operation, not the words the step's
  // content was written with: a created policy has a report-only deployment to
  // date and no settings to put back.
  assert.equal(datesLineFor(step, contentStepFor(step) as Record<string, unknown>), '{datesNew}')
  assert.equal(ifWrongLineFor(step, contentStepFor(step) as Record<string, unknown>), '{policyIfWrong}')
  assert.doesNotMatch(String(v.dates), /Change /, 'a create announces and deploys to report-only; it does not "Change"')
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
