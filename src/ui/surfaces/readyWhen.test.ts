// A policy already in report-only says when it may be enforced, from two gates
// and both of them (tracking.ts): the time gate (in report-only since the scan
// first saw it, plus the observation window) and the evidence gate (the records
// since then show zero failures and every active person in scope). The row's
// date column, the step's Done-when and the status word read one derivation;
// nothing asks the person to mark anything. Over the demo and its week two.
import { test } from 'node:test'
import assert from 'node:assert/strict'
// On the curated baseline (fixtures/index.ts `curatedFixture`): this is about a
// policy that can be written, not about the source groups this baseline has not
// settled (roadmap/sourceIdentity.test.ts).
import { curatedFixture as fixture, fixture as plainFixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
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
import { isHeld } from '../../roadmap/holds.ts'
import { nextMilestone } from '../../roadmap/lifecycle.ts'
import { awaitsWorkflowRecord, implementationOffered, policyHold, unavailableReason } from '../../roadmap/operations.ts'
import { stepEvidenceStrategy } from '../../roadmap/evidenceStrategy.ts'
import { stepContract } from './stepContract.ts'
import { statusOf } from './statusWord.ts'
import { laneReadings } from './planLanes.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { doneWhenTemplates } from './doneWhen.ts'
import { fillText, whole } from '../../content/render.ts'
import { content } from '../../content/content.ts'
import { RE } from '../../content/contentChecks.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { artifactIdOf, semanticFieldsOf, semanticsOf } from '../../roadmap/observation.ts'
import { activePeopleIds } from '../../derive/population.ts'
import { notPeopleIds } from '../../derive/sets.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'

const DAY = 86_400_000
const shared = content.shared as unknown as Record<string, string[]>

// What the walk reads on every report-only row of the app's demo (scripts/walk.mjs):
// the two gate lines of the step's Done-when. The time expectation is the walk's
// own object, imported from the one place that holds it
// (content/contentChecks.ts), so the wording of a gate cannot move on one
// surface without failing here first. The time line speaks about the
// observation window — closing on a date, or closed already — because readiness
// is both gates together and no single line may claim it (derive/readyWhen.ts).
// The row's own timing value (rowWhen.ts) still takes one of three forms; the
// board maps it to a day or the placeholder (planBoard.ts boardWhenOf, A1b), and
// the walk reads that column, so the form is held here and nowhere else.
const WALK_ROW = /^(ready now|held until the records clear|ready \S.*\d{4})$/
const WALK_TIME = RE.gateTime
// The evidence gate here accepts one form more than the walk's own regex does:
// the short-window line, which no fixture the walk visits renders. Every form the
// walk accepts must be accepted here too, which the assertion below proves.
const WALK_EVIDENCE = /Evidence: .+; today (ready now: 0 failures in \d+ days|\d+ failing or interrupted, \d+ of \d+ active people seen in \d+ days|no sign-in records read for this policy, \d+ of \d+ active people seen in \d+ days|the sign-in records read do not cover the whole window, \d+ of \d+ active people seen in \d+ days)\./

test('every evidence line the walk accepts is accepted here', () => {
  const tracked = (content.shared as { policyDoneWhenTracked: string[] }).policyDoneWhenTracked
  const gate = (key: string, vals: Record<string, unknown>): string =>
    fillText((content.shared as { engine: { tracking: Record<string, string> } }).engine.tracking[key], vals)
  for (const [key, vals] of [
    ['readyNow', { n: 14 }],
    ['evidenceToday', { failures: 2, seen: 3, people: 4, n: 14 }],
    ['evidenceTodayUnread', { seen: 3, people: 4, n: 14 }],
  ] as [string, Record<string, unknown>][]) {
    const line = fillText(tracked[1], { reportOnly: '12 Aug', evidenceGate: gate(key, vals) })
    assert.match(line, RE.gateEvidence, `the walk reads the ${key} evidence line`)
    assert.match(line, WALK_EVIDENCE, `and so does this file's regex`)
  }
})

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

test('week one: a policy the scan first sees in report-only is watched from the scan date for its observation window; held, its row reads no ready day', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === ADMINS)!
  assert.equal(step.status, 'in-report-only')
  assert.equal(step.tracking?.reportOnlyAt, f.snapshot.asOf, 'in report-only since the scan that first saw it')
  const readyOn = new Date(Date.parse(f.snapshot.asOf) + observationDaysFor(step) * DAY).toISOString()
  assert.equal(step.tracking?.readyOn, readyOn, 'the time gate: first seen plus the observation window')
  assert.equal(step.tracking?.readyNow, false, 'no records of this policy yet: the evidence gate is not met')
  assert.equal(readyWhen(step)?.kind, 'on')
  assert.equal(statusOf(step).word.split(' · ')[0], 'Report-only')
  // Day one's admins policy is held — the way back in is not verified — so its
  // window closing makes it ready for nothing: the row states no ready day and
  // the step names no review date (roadmap/holds.ts). Week two's transfer
  // policy, which nothing holds, is the one that reads ready <date> (below).
  assert.ok(isHeld(step), 'the premise: something holds it')
  assert.equal(rowWhen(step), '')
  assert.equal(nextMilestone(step).at, null)
  // The observation the plan record keeps, so the next scan continues the clock.
  const kept = observationsOf(run.steps)[ADMINS].members[SOLE_MEMBER]
  assert.equal(kept.state, 'report-only')
  assert.equal(kept.firstSeenAt, f.snapshot.asOf)
  assert.equal(kept.since, 'first-scan', 'the first time IAMAI looked, not a transition it watched')
})

test('week two: the report-only policy with clean, complete records is ready now; the one seen for 24 people waits for its window; the one the tenant turned on is In place', () => {
  // With the plan's foundation settled (roadmap/foundations.ts): until both
  // pinned groups are, every policy step is held and the plan dates nothing.
  const f = withFoundationSettled(fixture('demo-week2'))
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
  assert.ok(lines.includes('A later scan confirms the intended policy settings and enabled state.'), 'the lines after the gates stay')
  const untracked = doneWhenTemplates(transfer, ['{policyDoneWhen}']).map((x) => fillText(x as string, stepVars(transfer, ctx)))
  const seen = `${transfer.tracking!.seenInScope} of ${transfer.tracking!.activeInScope} active people seen in ${transfer.tracking!.daysInReportOnly} days.`
  assert.ok(untracked.some((l) => l.startsWith('Time: ')) && untracked.some((l) => l.endsWith(`today 0 failing or interrupted, ${seen}`)), untracked.join('\n'))
})

test('rescan: a policy whose window closed on clean records while a Foundation-A blocker holds it stays Report-only, and is offered no date', () => {
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
  assert.ok(Date.parse(step.tracking!.readyOn!) <= Date.parse(step.tracking!.noticedAt!), 'the window closed')
  assert.equal(step.tracking?.readyNow, true, 'and the records cleared it')
  assert.equal(readyWhen(step)?.kind, 'now')
  // The demo's admins policy was the Ready-but-withheld case (task 007). A policy
  // something holds is never Ready to enforce (Step 4): the way back in is not
  // verified, so it stays Report-only, and the row offers no date at all.
  assert.ok(isHeld(step))
  assert.equal(step.status, 'in-report-only')
  assert.equal(statusOf(step).word.split(' · ')[0], 'Report-only')
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
  assert.equal(statusOf(step).word.split(' · ')[0], 'Report-only')
  assert.equal(readyWhen(step)?.kind, 'since', 'the window closed and the records did not')
  // Held besides — the way back in is not verified — so the column states nothing
  // at all, and the step is not waiting on the records alone (roadmap/holds.ts).
  assert.ok(isHeld(step))
  assert.equal(rowWhen(step), '')
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
  assert.equal(statusOf(step).word.split(' · ')[0], 'Report-only')
})

test('the app\'s demo: final emergency verification holds the turn-on everywhere, not only on the board', () => {
  const f = fixture('demo-week2')
  const d = demoTenant(true)
  const planId = planIdFor(DEMO_TENANT_ID)
  assert.ok(findTaggedPolicy(d.snapshot, planId, TOKEN), 'the token protection policy carries the app\'s plan tag')
  // With the plan's foundation settled (roadmap/foundations.ts): until both
  // pinned groups are, every policy step is held and the plan dates nothing.
  const run = runFixture(withFoundationSettled({ ...f, snapshot: d.snapshot, mapping: d.mapping, planId }))
  const token = run.steps.find((s) => s.id === TOKEN)!
  // The token policy's window has closed on clean records, and the one change
  // left is the turn-on ({"state":"enabled"}). This used to assert that turn-on
  // was offered, as "a bounded correction safe in Report-only", while final
  // emergency verification gated "the later enforcement through the dependency
  // graph" — on the board alone. Every channel handed the turn-on over beside a
  // board that held it (Sam D2, Nadia D1). The recovery test holds the turn-on
  // itself now (roadmap/enforceWaits.ts), and the board reads the drill row it
  // waits on, as Plan.tsx gives it.
  assert.equal(token.tracking?.readyNow, true)
  assert.equal(unavailableReason(token), null, 'held, not unwritable: the operation is sound')
  assert.equal(implementationOffered(token), false, 'the turn-on is handed over with the recovery test undone')
  assert.equal(policyHold(token), 'prerequisite-unmet')
  assert.deepEqual(token.action.enforceWaitsOn?.map((w) => w.title), ['Verify Emergency Access'])
  const cleanup = (run.schedule.cleanup?.rows ?? []).map((r) => ({ id: `cleanup-${r.kind}`, complete: r.done !== null }))
  // Up Next: the drill it waits on is itself Ready work. Never Ready while its turn-on is held.
  assert.equal(laneReadings(run.steps, cleanup).get(TOKEN)?.lane, 'Up Next', 'the board and the channels disagree about the turn-on')
  const transfer = run.steps.find((s) => s.id === TRANSFER)!
  assert.equal(statusOf(transfer).word.split(' · ')[0], 'Report-only')
  assert.equal(isHeld(transfer), false)
  assert.equal(laneReadings(run.steps).get(TRANSFER)?.lane, 'On Hold', 'its evidence gate remains open independently of the safe token-policy path')
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
  const rows = run.steps.filter((s) => statusOf(s).word.split(' · ')[0] === 'Report-only' && readyWhen(s) !== null)
  assert.ok(rows.length > 0, 'the app\'s demo week two has a policy in report-only')
  for (const step of rows) {
    // A held one states nothing in its column: it is not watched towards a day it
    // may be turned on (roadmap/holds.ts), and the walk reads it as held.
    if (isHeld(step)) {
      assert.equal(rowWhen(step), '', step.id)
      continue
    }
    assert.match(rowWhen(step), WALK_ROW, step.id)
    const lines = doneWhenOf(step, demo, run.schedule.reportOnlyAt[step.id] ?? null)
    assert.match(lines, WALK_TIME, step.id)
    assert.match(lines, WALK_EVIDENCE, step.id)
  }
})

test('a policy the tenant enforces never finishes on a report-only period it is past', () => {
  // R4-19, R4-28, R4-29. A guest-MFA policy the first scan found enforced read
  // Ready · Review under a tile saying only the person's workflow record was left,
  // and its Done-when led with "The required report-only period of 7 days is
  // complete, with no failures on this policy in the sign-in records" and "The
  // available records show every active person in scope signing in during those
  // days" — a window that can never run on a policy already on. It printed on every
  // inherited enforced policy of six tenants, one of them a tenant whose sign-in
  // records could not be read at all (hostile). The shipped tenants as they are
  // scanned, and again with the foundation settled, which is where the
  // enforced-and-waiting-on-the-person steps appear.
  const GATE = /required report-only period|during those days|^Time: in report-only|^Evidence: the sign-in records since/
  let enforced = 0
  let awaiting = 0
  for (const name of ['small', 'mid', 'large', 'messy', 'midflight', 'hostile', 'demo', 'demo-week2'] as const) {
    for (const f of [plainFixture(name), withFoundationSettled(plainFixture(name))]) {
      const run = runFixture(f)
      for (const step of run.steps) {
        if (step.state.lifecycle !== 'enforced') continue
        enforced++
        const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
        const lines = stepContract(step, ctx).doneWhen
        for (const line of lines) assert.doesNotMatch(line, GATE, `${name}/${step.id} (enforced) still finishes on a report-only window: ${line}`)
        if (!awaitsWorkflowRecord(step)) continue
        awaiting++
        assert.ok(lines.length > 0, `${name}/${step.id} finishes on nothing`)
        // What is left stays: the scan that confirms the policy, and the person's own workflow line.
        if (step.id !== 's-goal-guests-mfa') continue
        assert.ok(lines.includes(shared.policyDoneWhen[2]), `${name}/${step.id} lost the scan that confirms the policy`)
        assert.ok(lines.some((l) => /Representative guests/.test(l)), `${name}/${step.id} lost its own workflow line: ${lines.join(' | ')}`)
      }
    }
  }
  assert.ok(enforced > 0 && awaiting > 0, `the premise: enforced steps (${enforced}) and steps waiting on a workflow record (${awaiting})`)

  // A policy still in report-only keeps both gates: this is about the enforced one only.
  const week2 = runFixture(fixture('demo-week2'))
  const watched = week2.steps.find((s) => s.state.lifecycle === 'report-only' && readyWhen(s) === null && stepEvidenceStrategy(s) === 'sign-in-records')
  if (watched) assert.deepEqual(doneWhenTemplates(watched, ['{policyDoneWhen}']).slice(0, 2), shared.policyDoneWhen.slice(0, 2))
  const notYet = week2.steps.find((s) => s.state.lifecycle === 'not-deployed' && stepEvidenceStrategy(s) === 'sign-in-records')
  assert.ok(notYet, 'the premise: a policy not yet deployed')
  assert.deepEqual(doneWhenTemplates(notYet, ['{policyDoneWhen}']).slice(0, 2), shared.policyDoneWhen.slice(0, 2), `${notYet.id} lost the report-only gates it has still to run`)
})
