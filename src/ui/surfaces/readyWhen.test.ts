// A policy already in report-only says when it may be enforced, from two gates
// and both of them (tracking.ts): the time gate (in report-only since the scan
// first saw it, plus the observation window) and the evidence gate (the records
// since then show zero failures and every active person in scope). The row's
// date column, the step's Done-when and the status word read one derivation;
// nothing asks the person to mark anything. Over the demo and its week two.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { cleanReportOnly } from '../../roadmap/fixtures/records.ts'
import { stepIdForGoal, findTaggedPolicy, planIdFor } from '../../roadmap/generate.ts'
import { demoTenant } from '../demo.ts'
import { DEMO_TENANT_ID } from '../demoMode.ts'
import { applyProgress } from '../../roadmap/progress.ts'
import { observationDaysFor } from '../../roadmap/schedule.ts'
import { SOLE_MEMBER, observationsOf } from '../../roadmap/tracking.ts'
import { observationsFrom } from '../../roadmap/observation.ts'
import { readyBasis, readyWhen } from '../../derive/readyWhen.ts'
import { rowReason, rowWhen } from './rowWhen.ts'
import { implementationOffered, unavailableReason } from '../../roadmap/operations.ts'
import { statusOf } from './statusWord.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { doneWhenTemplates } from './doneWhen.ts'
import { fillText, whole } from '../../content/render.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { artifactIdOf, semanticFieldsOf, semanticsOf } from '../../roadmap/observation.ts'
import { activePeopleIds } from '../../derive/population.ts'
import { notPeopleIds } from '../../derive/sets.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'

const DAY = 86_400_000

// What the walk reads on every report-only row of the app's demo (scripts/walk.mjs):
// the row's date column, and the two gate lines of the step's Done-when. The
// regexes are the walk's own, so the wording of a gate cannot move on one surface
// without failing here first. The time line speaks about the observation window —
// closing on a date, or closed already — because readiness is both gates together
// and no single line may claim it (derive/readyWhen.ts).
const WALK_ROW = /^(ready now|held until the records clear|ready \S.*\d{4})$/
const WALK_TIME = /Time: in report-only since .+, the window clos(es|ed) \S.*\d{4}\./
const WALK_EVIDENCE = /Evidence: .+; today (ready now: 0 failures in \d+ days|\d+ failing or interrupted, \d+ of \d+ active people seen in \d+ days|no sign-in records read for this policy, \d+ of \d+ active people seen in \d+ days|the sign-in records read do not cover the whole window, \d+ of \d+ active people seen in \d+ days)\./

/** A step's Done-when, filled, exactly as the opened step prints it. */
function doneWhenOf(step: Parameters<typeof stepVars>[0], f: Pick<Fixture, 'snapshot' | 'mapping' | 'operatorId'>, reportOnlyAt: string | null = null): string {
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, firstEnforce: null, reportOnlyAt }
  const v = stepVars(step, ctx)
  return doneWhenTemplates(step, ['{policyDoneWhen}']).filter((x) => whole(x, v)).map((x) => fillText(x as string, v)).join('\n')
}

/** The tenant's own directory facts, as a scan reads them (tracking.ts TrackingEvidence). */
const scopeOf = (f: Fixture): Parameters<typeof applyProgress>[7] => ({
  groupMembers: Object.fromEntries([...f.groups].filter(([, g]) => g.sampled !== true).map(([id, g]) => [id.toLowerCase(), [...g.memberIds]])),
  activePeople: activePeopleIds(f.snapshot, f.snapshot.asOf, notPeopleIds(f.mapping)),
})

/**
 * Microsoft's records of one policy over a window it served clean: a report-only
 * success for every active person, so the evidence gate's "everybody in scope
 * seen" half closes whoever the policy reaches, and its failure count is a zero
 * records prove. Readiness needs both gates, so a case about a served window
 * hands the engine the records that window is read with.
 */
function cleanRecords(f: Fixture, policyId: string): unknown {
  const people = activePeopleIds(f.snapshot, f.snapshot.asOf, notPeopleIds(f.mapping))
  return cleanReportOnly({ policyId, people, asOf: f.snapshot.asOf })
}
const ADMINS = stepIdForGoal('admins-phishing-resistant')
const TOKEN = stepIdForGoal('token-protection')
const TRANSFER = stepIdForGoal('block-auth-transfer')

test('week one: a policy the scan first sees in report-only is ready on the scan date plus its observation window; the row reads Report-only · ready <date>', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === ADMINS)!
  assert.equal(step.status, 'in-report-only')
  assert.equal(step.tracking?.reportOnlyAt, f.snapshot.asOf, 'in report-only since the scan that first saw it')
  const readyOn = new Date(Date.parse(f.snapshot.asOf) + observationDaysFor(step) * DAY).toISOString()
  assert.equal(step.tracking?.readyOn, readyOn, 'the time gate: first seen plus the observation window')
  assert.equal(step.tracking?.readyNow, false, 'no records of this policy yet: the evidence gate is not met')
  assert.equal(readyWhen(step)?.kind, 'on')
  assert.equal(statusOf(step).word, 'Report-only')
  assert.equal(rowWhen(step), `ready ${absoluteDate(readyOn)}`)
  // The observation the plan record keeps, so the next scan continues the clock.
  const kept = observationsOf(run.steps)[ADMINS].members[SOLE_MEMBER]
  assert.equal(kept.state, 'report-only')
  assert.equal(kept.firstSeenAt, f.snapshot.asOf)
  assert.equal(kept.since, 'first-scan', 'the first time IAMAI looked, not a transition it watched')
})

test('week two: the report-only policy with clean, complete records is ready now; the one seen for 24 people waits for its window; the one the tenant turned on is In place', () => {
  const f = fixture('demo-week2')
  const run = runFixture(f)
  const token = run.steps.find((s) => s.id === TOKEN)!
  assert.equal(token.status, 'ready-to-enforce')
  assert.equal(token.tracking?.failures, 0)
  assert.ok((token.tracking?.activeInScope ?? 0) > 0)
  assert.equal(token.tracking?.seenInScope, token.tracking?.activeInScope, 'every active person in scope seen at least once')
  assert.equal(token.tracking?.daysInReportOnly, 7)
  assert.equal(readyWhen(token)?.kind, 'now')
  // The gates have closed, so the row says the state that is now true and the
  // date of the change it has earned; the evidence that earned it is the reason
  // line beneath (task 007). It is not Enforced: the policy is still in
  // report-only in the tenant.
  assert.equal(statusOf(token).word, 'Ready to enforce')
  assert.equal(token.tracking?.state, 'enabledForReportingButNotEnforced')
  assert.equal(rowWhen(token), absoluteDate(token.events!.enforce.at!))
  assert.equal(rowReason(token), readyBasis(readyWhen(token)!))

  const transfer = run.steps.find((s) => s.id === TRANSFER)!
  assert.equal(transfer.status, 'in-report-only')
  assert.ok((transfer.tracking?.seenInScope ?? 0) < (transfer.tracking?.activeInScope ?? 0), 'not everyone seen yet')
  assert.equal(readyWhen(transfer)?.kind, 'on')
  assert.equal(rowWhen(transfer), `ready ${absoluteDate(transfer.tracking!.readyOn!)}`)

  const admins = run.steps.find((s) => s.id === ADMINS)!
  assert.equal(admins.status, 'done')
  // The tenant's own policy, which the tenant switched on: the plan deployed
  // nothing for this goal, so the word is the preservation result and not the
  // rollout one. Enforced would say IAMAI drove a change it never made.
  assert.equal(admins.state.inPlace, true)
  assert.equal(statusOf(admins).word, 'In place')
  assert.equal(readyWhen(admins), null)

  // The step's Done-when: both gates with today's numbers replace the generic lines.
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, firstEnforce: null, reportOnlyAt: run.schedule.reportOnlyAt[TOKEN] ?? null }
  const ex = stepVars(token, ctx)
  const lines = doneWhenTemplates(token, ['{policyDoneWhen}']).filter((x) => whole(x, ex)).map((x) => fillText(x as string, ex))
  assert.ok(lines.some((l) => l.startsWith('Time: in report-only since ') && l.includes(absoluteDate(token.tracking!.reportOnlyAt!))), lines.join('\n'))
  assert.ok(lines.some((l) => l.startsWith('Evidence: ') && l.endsWith('today ready now: 0 failures in 7 days.')), lines.join('\n'))
  assert.ok(!lines.some((l) => /in report-only for \d+ days with no failures/.test(l)), 'the generic gate line is replaced by the gates with numbers')
  assert.ok(lines.some((l) => l.startsWith('After enforcement')), 'the lines after the gates stay')
  const untracked = doneWhenTemplates(transfer, ['{policyDoneWhen}']).map((x) => fillText(x as string, stepVars(transfer, ctx)))
  const seen = `${transfer.tracking!.seenInScope} of ${transfer.tracking!.activeInScope} active people seen in ${transfer.tracking!.daysInReportOnly} days.`
  assert.ok(untracked.some((l) => l.startsWith('Time: ')) && untracked.some((l) => l.endsWith(`today 0 failing or interrupted, ${seen}`)), untracked.join('\n'))
})

test('rescan: a policy whose window closed on clean records reads Ready to enforce, and a Foundation-A blocker still offers it no date', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const seenAt = new Date(Date.parse(f.snapshot.asOf) - 10 * DAY).toISOString()
  const first = runFixture(f).steps.find((s) => s.id === ADMINS)!
  const rows = (f.snapshot.config.caPolicies?.rows ?? []) as { id?: string }[]
  const row = rows.find((p) => p.id === first.tracking?.policyId)
  // The record names the policy it watched, which is what lets the ten days it
  // counted belong to the policy deployed now (observation.ts artifactIdOf).
  const watched = { [ADMINS]: { members: { [SOLE_MEMBER]: { artifact: artifactIdOf(row?.id), state: 'report-only' as const, semantics: semanticsOf(row as Record<string, unknown>), fields: semanticFieldsOf(row as Record<string, unknown>), firstSeenAt: seenAt, since: 'first-scan' as const, lastSeenAt: seenAt, evidenceAt: null } }, unattributed: null } }
  // And the records that window is read with. Ten days is not evidence about
  // anybody: the stage needs the window *and* the records, so a case that means
  // the policy to be ready supplies both (tracking.ts `gates`).
  const snapshot = { ...f.snapshot, evidencePolicyResults: [cleanRecords(f, String(row!.id))] as typeof f.snapshot.evidencePolicyResults }
  applyProgress(run.steps, snapshot, run.coverage, f.planId, undefined, null, watched, scopeOf(f))
  const step = run.steps.find((s) => s.id === ADMINS)!
  assert.equal(step.tracking?.reportOnlyAt, seenAt, 'the record own observation wins over this scan')
  assert.equal(step.status, 'ready-to-enforce')
  assert.ok(Date.parse(step.tracking!.readyOn!) <= Date.parse(step.tracking!.noticedAt!), 'the window closed')
  assert.equal(step.tracking?.readyNow, true, 'and the records cleared it')
  assert.equal(readyWhen(step)?.kind, 'now')
  assert.equal(statusOf(step).word, 'Ready to enforce')
  assert.equal(step.history.at(-1)?.note, `ready now: 0 failures in ${step.tracking!.daysInReportOnly} days`)
  // The demo's admins policy is the Ready-but-withheld case: Foundation B has
  // carried the lifecycle, and Foundation A will not hand the enforcement over
  // while the way back in is unverified. So the row offers no date at all --
  // a Ready lifecycle never manufactures one on its own (task 007).
  assert.equal(unavailableReason(step), 'escape-hatch-unverified')
  assert.equal(implementationOffered(step), false)
  assert.equal(rowWhen(step), '')
  assert.equal(step.events?.enforce.at ?? null, null)
})

test('rescan: the same ten days with no records read is not ready, and the row says what it is held for', () => {
  // The same policy and the same ten days, with nothing read about how it
  // behaved over them. A calendar is not evidence about anybody: the window has
  // closed and the evidence gate has not, so the step is still being watched and
  // the column says what it is waiting for instead of offering the change.
  const f = fixture('demo')
  const run = runFixture(f)
  const seenAt = new Date(Date.parse(f.snapshot.asOf) - 10 * DAY).toISOString()
  const first = runFixture(f).steps.find((s) => s.id === ADMINS)!
  const rows = (f.snapshot.config.caPolicies?.rows ?? []) as { id?: string }[]
  const row = rows.find((p) => p.id === first.tracking?.policyId)
  const watched = { [ADMINS]: { members: { [SOLE_MEMBER]: { artifact: artifactIdOf(row?.id), state: 'report-only' as const, semantics: semanticsOf(row as Record<string, unknown>), fields: semanticFieldsOf(row as Record<string, unknown>), firstSeenAt: seenAt, since: 'first-scan' as const, lastSeenAt: seenAt, evidenceAt: null } }, unattributed: null } }
  applyProgress(run.steps, f.snapshot, run.coverage, f.planId, undefined, null, watched, scopeOf(f))
  const step = run.steps.find((s) => s.id === ADMINS)!
  assert.equal(step.tracking?.failures, null, 'no records read is not a clean window')
  assert.equal(step.tracking?.readyNow, false)
  assert.equal(step.status, 'in-report-only')
  assert.equal(statusOf(step).word, 'Report-only')
  assert.equal(readyWhen(step)?.kind, 'since', 'the window closed and the records did not')
  assert.equal(rowWhen(step), 'held until the records clear')
  assert.match(rowWhen(step), WALK_ROW)
  // And the Done-when says which gate closed and which did not: the window has a
  // past date, the records have no count of failures to show at all.
  const held = doneWhenOf(step, f)
  assert.match(held, WALK_TIME)
  assert.match(held, /the window closed \S.*\d{4}\./)
  assert.match(held, WALK_EVIDENCE)
  assert.match(held, /no sign-in records read for this policy/)
  assert.equal(step.events?.enforce.at ?? null, null)
})

test('rescan: the same ten days in a record that never named a policy carries nothing', () => {
  // The pre-Foundation-B record held one date per step. A step is not a policy,
  // so the date cannot be shown to belong to the object deployed now, and the
  // window runs from the scan that could name it. The date is still loaded and
  // still readable — it just does not decide a rollout gate.
  const f = fixture('demo')
  const run = runFixture(f)
  const seenAt = new Date(Date.parse(f.snapshot.asOf) - 10 * DAY).toISOString()
  applyProgress(run.steps, f.snapshot, run.coverage, f.planId, undefined, null, observationsFrom({ reportOnlySeen: { [ADMINS]: seenAt } }))
  const step = run.steps.find((s) => s.id === ADMINS)!
  assert.equal(step.state.observation?.continuity, 'unknown')
  assert.equal(step.state.observation?.prior?.firstSeenAt, seenAt, 'the date is still there')
  assert.equal(step.tracking?.reportOnlyAt, f.snapshot.asOf, 'but the window runs from this scan')
  assert.notEqual(step.status, 'ready-to-enforce')
  assert.equal(statusOf(step).word, 'Report-only')
})

test('the app\'s demo: the plan\'s tags follow the app\'s plan id, so week two\'s report-only policies match their steps on screen (Ready to enforce / ready <date>) and the admins policy reads In place', () => {
  const f = fixture('demo-week2')
  const d = demoTenant(true)
  const planId = planIdFor(DEMO_TENANT_ID)
  assert.ok(findTaggedPolicy(d.snapshot, planId, TOKEN), 'the token protection policy carries the app\'s plan tag')
  const run = runFixture({ ...f, snapshot: d.snapshot, mapping: d.mapping, planId })
  const token = run.steps.find((s) => s.id === TOKEN)!
  assert.equal(statusOf(token).word, 'Ready to enforce')
  // The app's own demo has not confirmed its exclusions group, so this is the
  // Ready-but-withheld case again on the tenant a visitor actually sees:
  // Foundation B has carried the lifecycle and Foundation A hands nothing over,
  // so the row carries the evidence and no date, and the step is in no wave
  // (task 007). Nothing invents an enforcement day from a Ready word.
  assert.equal(unavailableReason(token), 'escape-hatch-unverified')
  assert.equal(implementationOffered(token), false)
  assert.equal(token.events, null)
  assert.equal(rowWhen(token), '')
  assert.equal(rowReason(token), readyBasis(readyWhen(token)!))
  const transfer = run.steps.find((s) => s.id === TRANSFER)!
  assert.equal(statusOf(transfer).word, 'Report-only')
  assert.match(rowWhen(transfer), /^ready \S.*\d{4}$/)
  // And the tenant's own admins policy, which no tag of this plan's touches,
  // reads as what it is: a control already in place, not one the plan enforced.
  assert.equal(statusOf(run.steps.find((s) => s.id === ADMINS)!).word, 'In place')
})

test("the walk's reading: every report-only step of the app's demo says where it stands on its row, and carries both gates in its Done-when", () => {
  // The surfaces the walk asserts on demo-week2, asserted here on the same tenant
  // the walk loads. A gate word renamed on one surface and not the other is a P0
  // in CI; this is that P0 as a unit test, one scan earlier.
  const f = fixture('demo-week2')
  const d = demoTenant(true)
  const demo = { ...f, snapshot: d.snapshot, mapping: d.mapping, planId: planIdFor(DEMO_TENANT_ID) }
  const run = runFixture(demo)
  const rows = run.steps.filter((s) => statusOf(s).word === 'Report-only' && readyWhen(s) !== null)
  assert.ok(rows.length > 0, 'the app\'s demo week two has a policy in report-only')
  for (const step of rows) {
    assert.match(rowWhen(step), WALK_ROW, step.id)
    const lines = doneWhenOf(step, demo, run.schedule.reportOnlyAt[step.id] ?? null)
    assert.match(lines, WALK_TIME, step.id)
    assert.match(lines, WALK_EVIDENCE, step.id)
  }
})
