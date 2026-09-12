// The canonical Plan case: Needs decision (task 009).
//
// Tasks 004–008 followed a policy: deployed, watched, enforced, or already
// there. This is the case where the plan cannot go anywhere at all, because the
// next fact is not in the tenant — it is in the operator's head.
//
// The canonical decision is the exclusions group: the one group every policy
// the plan writes excludes, and therefore the one carve-out that decides who
// still gets in when a policy goes wrong. Foundation C
// (mapping/safetyChoice.ts) already keeps the five facts apart — recorded,
// detected, recommended, confirmed, actionable — and already refuses to let a
// detection become an answer. What this case is about is whether the *Plan*
// says so:
//
//   * the step where the question is answered reads Needs decision. Before
//     this it read "Healthy · Ready", with "Make the object this step names."
//     as its next action and "The policy exists in {tenant} in report-only" as
//     its Done-when — on a step that deploys no policy, telling an operator to
//     build a second exclusions group while two of their own already qualify
//     and IAMAI was waiting to be told which. Every step *waiting* on the group
//     read Blocked; the one row the operator could actually clear was the row
//     that said nothing was wrong.
//   * a recommendation is shown and is not a selection. One candidate, two
//     candidates, or a candidate sorted to the top: none of them is an answer,
//     and nothing is pre-ticked that nobody ticked.
//   * candidate order carries no authority. The tenant's break-glass group
//     sorts above its exclusions group (it is excluded from more policies), and
//     confirming the second one leaves the second one confirmed.
//   * no implementation and no rollout while the question is open. Foundation A
//     already withholds the policy body; this asserts the whole plan does —
//     no portal instruction, no JSON, no PowerShell, no date, no calendar entry.
//   * the answer is saved through the real path — the picker's decision, applied
//     by roadmap/decisions.ts — and the plan then recalculates by itself. No
//     surface overrides the condition away.
//   * the answer survives a rescan, and survives a *better* candidate appearing
//     afterwards.
//   * an answer whose object is proved gone goes back to unresolved. It does
//     not quietly become the other candidate, and the implementation it was
//     holding stays held.
//
// Everything here runs the whole engine over a real fixture and asserts what a
// person would see: the generated step, the frozen Step Contract, the collapsed
// row, the picker the operator answers with, the implementation channels and
// the export view. Nothing here builds a Step and nothing writes a mapping
// record by hand.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, noExclusionsAnswer, withBreakGlassCarveOut } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import { nextMilestone } from '../../roadmap/lifecycle.ts'
import { implementationOffered, unavailableReason } from '../../roadmap/operations.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { scheduledEventOf } from '../../roadmap/stepSchedule.ts'
import {
  EXCLUSIONS_RECORD_KEY,
  awaitsOperator,
  directoryEvidenceFromGroups,
  exclusionsGroupChoice,
  operatorAnsweredExclusions,
  operatorExclusionsDecision,
} from '../../mapping/safetyChoice.ts'
import type { DirectoryEvidence, SafetyChoice } from '../../mapping/safetyChoice.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import type { StepDecision } from '../../roadmap/decisions.ts'
import type { Step } from '../../roadmap/types.ts'
import { CONTRACT, stepContract } from './stepContract.ts'
import { appliedMapping } from './pickerRows.ts'
import { stepExportView, stepLines } from './stepExport.ts'
import { jsonOffered, stepOperations } from './stepJson.ts'
import { powershellFor } from './stepPowerShell.ts'
import { rowReason, rowWhen } from './rowWhen.ts'
import { statusOf } from './statusWord.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

/** The one canonical case, named here so a change to it is a change to this test. */
const FIXTURE = 'small'
const STEP_ID = PREREQ_STEP_ID.exclusionsGroup
/** The two groups the small tenant has, and which of them sorts first as a candidate. */
const TOP_CANDIDATE = 'Core - Break glass'
const OTHER_CANDIDATE = 'Core - Exclusions'
const WHEN = '2026-09-01T00:00:00.000Z'

/**
 * Words that would tell an operator to go and build a group while IAMAI is
 * waiting to be told which of theirs it is.
 */
const CREATING = /New group|Name it |Create one if/i

type Case = {
  f: Fixture
  run: ReturnType<typeof runFixture>
  step: Step
  ctx: StepVarContext
  choice: SafetyChoice
}

function groupId(f: Fixture, displayName: string): string {
  const hit = [...f.groups].find(([, g]) => g.displayName === displayName)
  assert.ok(hit, `the ${FIXTURE} fixture has no group named ${displayName}`)
  return hit[0]
}

/** The whole engine over the fixture, and the generated step — never a built one. */
function caseOf(f: Fixture, directory?: DirectoryEvidence): Case {
  const run = directory ? runFixture(f, { directory }) : runFixture(f)
  const step = run.steps.find((s) => s.id === STEP_ID)
  assert.ok(step, `${STEP_ID} left the plan`)
  const ctx: StepVarContext = {
    snapshot: f.snapshot,
    mapping: f.mapping,
    nameOf: (id: string) => run.input.names!.label(id),
    signature: 'IT',
    operatorId: f.operatorId,
    now: f.snapshot.asOf,
    groups: f.groups,
    directory: directory ?? directoryEvidenceFromGroups(f.groups, 'complete'),
    naming: run.coverage.organisation.naming,
  }
  const choice = exclusionsGroupChoice({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: ctx.directory })
  return { f, run, step, ctx, choice }
}

/**
 * The canonical fixture: the small tenant with nobody's answer to the
 * exclusions-group question, which is the state every tenant is in before an
 * operator answers it (roadmap/fixtures/index.ts noExclusionsAnswer). The
 * tenant itself is untouched — it has the same two groups, the same policies
 * and the same emergency accounts as the answered fixture.
 */
function open(): Fixture {
  // The small tenant whose policies carve out its break-glass group, so both groups
  // qualify and the one an operator chooses is not the one that sorts first.
  return noExclusionsAnswer(withBreakGlassCarveOut(fixture(FIXTURE)))
}

/**
 * The operator's answer, saved the way the Plan saves it: a step decision
 * (ui/surfaces/planData.ts onDecide) applied through the picker's own
 * `appliedMapping`, which is what every surface derives from. Nothing here
 * writes the mapping record.
 */
function confirm(f: Fixture, picked: string[]): Fixture {
  const decision: Record<string, StepDecision> = { [STEP_ID]: { picked, at: WHEN } }
  const mapping = appliedMapping({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => f.groups.get(id)?.displayName ?? id, groups: f.groups, now: f.snapshot.asOf }, decision)
  return { ...f, mapping }
}

/** The scan's reading of the tenant's groups, with one of them proved gone by Graph. */
function withGroupGone(f: Fixture, id: string): DirectoryEvidence {
  const base = directoryEvidenceFromGroups(f.groups, 'complete')
  const groups = new Map(base.groups)
  groups.set(id.toLowerCase(), { presence: 'absent', members: 'unknown', displayName: null, memberIds: [], memberCount: null })
  return { groups, universe: 'complete' }
}

// ---- 1. a real, whole-fixture generated decision case ----

test('needs decision: the canonical case is a generated step over a real tenant with two qualifying groups', () => {
  const c = caseOf(open())
  assert.equal(c.step.id, STEP_ID)
  assert.equal(c.step.kind, 'prerequisite')
  // Foundation C's own verdict, over the whole tenant's groups: more than one
  // object plausibly serves the role, and IAMAI does not choose between them.
  assert.equal(c.choice.status, 'ambiguous')
  assert.equal(c.choice.evidence, 'complete')
  assert.deepEqual(c.choice.candidates.map((x) => x.name), [TOP_CANDIDATE, OTHER_CANDIDATE])
  assert.equal(awaitsOperator(c.choice), true)
})

// ---- 2. detected and recommended, and not confirmed ----

test('needs decision: the evidence is on screen and none of it is an answer', () => {
  const c = caseOf(open())
  const ex = stepVars(c.step, c.ctx) as Record<string, unknown>
  // Both candidates are named, on the screen and in the export, from the one
  // set of who-lines both read (stepExport.ts whoEvidenceLines).
  assert.deepEqual(ex.candidateGroups, [TOP_CANDIDATE, OTHER_CANDIDATE])
  assert.ok(stepLines(c.step, c.ctx).some((l) => l.includes(TOP_CANDIDATE) && l.includes(OTHER_CANDIDATE) && /does not choose between them/.test(l)))
  // And nothing anywhere calls any of them chosen.
  assert.equal(c.choice.storedId, null, 'nobody has answered')
  assert.equal(c.choice.actionableId, null, 'nothing may act on it')
  assert.equal(operatorExclusionsDecision(c.f.mapping), null)
  assert.equal(operatorAnsweredExclusions(c.f.mapping), false)
  assert.equal(c.f.mapping.records[EXCLUSIONS_RECORD_KEY], undefined, 'no record was written by a detection')
  // The picker offers both and ticks neither. `groupsTicked` has to be an empty
  // *array*: the Decision component falls back to ticking every nominated id
  // when the key is absent (ContentStep.tsx), so a missing key here is a silent
  // default, not an empty one.
  assert.ok(Array.isArray(ex.groupsTicked) && (ex.groupsTicked as string[]).length === 0, 'nothing is ticked that nobody ticked')
  const rows = ex.groups as string[]
  assert.ok(rows.some((r) => r.startsWith(TOP_CANDIDATE)) && rows.some((r) => r.startsWith(OTHER_CANDIDATE)), `both groups are offered: ${JSON.stringify(rows)}`)
})

test('needs decision: a single candidate is a strong recommendation and still not an answer', () => {
  const f = open()
  // The tenant's break-glass group is gone, so exactly one object qualifies.
  const c = caseOf(f, withGroupGone(f, groupId(f, TOP_CANDIDATE)))
  assert.equal(c.choice.status, 'recommended')
  assert.equal(c.choice.recommended?.name, OTHER_CANDIDATE)
  assert.equal(c.choice.actionableId, null, 'the only candidate is still not the operator’s answer')
  assert.equal(c.choice.unresolved, true)
  assert.equal(statusOf(c.step).word, 'Needs decision')
  const ex = stepVars(c.step, c.ctx) as Record<string, unknown>
  assert.deepEqual(ex.suggestedGroup, [OTHER_CANDIDATE])
  // The recommendation says out loud that it is not a selection.
  assert.ok(stepLines(c.step, c.ctx).some((l) => /IAMAI suggests/.test(l) && /Nothing uses it until you choose it/.test(l)))
  assert.equal(stepLines(c.step, c.ctx).some((l) => /\bSelected\b|\bConfirmed\b/.test(l)), false)
})

// ---- 3. the state is Needs decision ----

test('needs decision: the state, the word, the next milestone, the action and the completion are one reading', () => {
  const c = caseOf(open())
  assert.equal(c.step.state.condition, 'needs-decision')
  assert.equal(c.step.state.satisfied, false)
  assert.equal(c.step.state.lifecycle, null, 'a decision is not a stage of a Conditional Access policy')
  assert.equal(statusOf(c.step).word, 'Needs decision')
  const m = nextMilestone(c.step)
  assert.equal(m.kind, 'decide')
  assert.equal(m.at, null, 'no date is invented for a question')
  assert.equal(m.gatedBy, 'until you choose the exclusions group')
  const contract = stepContract(c.step, c.ctx)
  assert.equal(contract.state.condition, 'needs-decision')
  assert.equal(contract.state.conditionLabel, 'Needs decision')
  assert.equal(contract.state.word, 'Needs decision')
  assert.equal(contract.whatToDo.kind, 'decide')
  assert.deepEqual(contract.doneWhen, [CONTRACT.doneDecision])
  // The question is the step's What to do, not something to fix (owner, 2026-09-11).
  assert.deepEqual(contract.fix.map((x) => x.text), [])
  // The collapsed row says the same, without the step being opened.
  assert.equal(rowReason(c.step), 'until you choose the exclusions group')
  // Neither the action nor the completion tells them to build a group.
  assert.equal(CREATING.test(contract.whatToDo.text), false, contract.whatToDo.text)
  assert.equal(contract.doneWhen.some((d) => CREATING.test(d)), false)
})

// ---- 4. no implementation while the question is open ----

test('needs decision: no channel hands over a policy while the exclusions group is unchosen', () => {
  const c = caseOf(open())
  // The step itself deploys nothing: it is where a question is answered.
  assert.equal(c.step.action.json, null)
  assert.deepEqual(stepOperations(c.step), [])
  assert.equal(jsonOffered(c.step), false)
  assert.equal(/(New|Update)-MgIdentityConditionalAccessPolicy/.test(powershellFor(stepOperations(c.step))), false, 'no PowerShell mutates a policy')
  assert.equal(stepExportView(c.step, c.ctx).whatToDo.some((l) => CREATING.test(l)), false, 'the export does not carry the create instructions either')
  // And no step in the plan does, because every policy the plan would write
  // names the group nobody has chosen (Foundation A).
  assert.deepEqual(c.run.steps.filter((s) => implementationOffered(s)).map((s) => s.id), [])
  const withheld = c.run.steps.filter((s) => s.id.startsWith('s-goal-') && !s.state.satisfied)
  assert.ok(withheld.length > 0, 'the tenant does have policy steps to withhold')
  for (const s of withheld) assert.notEqual(unavailableReason(s), null, `${s.id} hands over a policy while the exclusions group is unchosen`)
  assert.ok(withheld.some((s) => unavailableReason(s) === 'missing-object'), 'the object nobody has chosen is what withholds them')
})

// ---- 5. no rollout date or event ----

test('needs decision: nothing is scheduled while the question is open', () => {
  const c = caseOf(open())
  assert.equal(c.step.events, null)
  assert.equal(c.step.rings.length, 0)
  assert.equal(c.step.reportOnlyAt ?? null, null)
  // The row's date column says a question can be answered now, not a day a
  // policy lands.
  assert.equal(rowWhen(c.step), 'now')
  assert.equal(stepContract(c.step, c.ctx).milestone.line, null, 'no Next line: Foundation B holds no date')
  // Nothing in the plan has earned an enforcement instant, so the calendar books no
  // policy work: no entry implies the final policy is known. What it still books is
  // the plan's canonical events (roadmap/stepSchedule.ts scheduledEventOf) —
  // preparation and checks that do not wait on the answer — and never the question.
  assert.equal(c.run.steps.some((s) => s.events !== null), false)
  const ics = buildIcs(c.run.steps, 'Tenant', c.run.input.planId, (s) => stepExportView(s, c.ctx))
  const booked = c.run.steps.filter((s) => ics.includes(`-${s.id}@iamai`))
  assert.deepEqual(booked.map((s) => s.id), c.run.steps.filter((s) => scheduledEventOf(s) !== null).map((s) => s.id), 'the calendar books exactly the steps with a canonical event')
  assert.deepEqual(booked.filter((s) => s.kind === 'create' || s.kind === 'adjust' || s.id === STEP_ID).map((s) => `${s.id}:${scheduledEventOf(s)?.transition}`), [], 'a policy, or the open question, booked on a day')
})

// ---- 6, 7, 12. the operator answers, through the real path ----

test('needs decision: the operator’s own answer clears it, and the plan recalculates by itself', () => {
  const before = caseOf(open())
  const chosen = groupId(before.f, OTHER_CANDIDATE)
  const after = caseOf(confirm(before.f, [chosen]))
  // The record exists because an operator confirmed it, and says so.
  const record = after.f.mapping.records[EXCLUSIONS_RECORD_KEY]
  assert.equal(record?.provenance, 'confirmed')
  assert.equal(record?.resolvedId, chosen)
  assert.deepEqual(operatorExclusionsDecision(after.f.mapping), { id: chosen, name: null })
  // Foundation C now has an answer it read for itself, so it is actionable.
  assert.equal(after.choice.status, 'confirmed')
  assert.equal(after.choice.actionableId, chosen)
  assert.equal(awaitsOperator(after.choice), false)
  // Nothing overrode the condition: the engine regenerated without it.
  assert.notEqual(after.step.state.condition, 'needs-decision')
  assert.equal(after.step.blockers.some((b) => b.kind === 'decision'), false)
  assert.notEqual(statusOf(after.step).word, 'Needs decision')
  // And the implementation the decision was holding is released — by the
  // ordinary gates, not by the confirmation itself.
  assert.ok(after.run.steps.filter((s) => implementationOffered(s)).length > 0, 'the plan can write its policies now')
  // Screen and export agree, before and after.
  assert.ok(stepLines(before.step, before.ctx).includes(stepContract(before.step, before.ctx).whatToDo.text))
  assert.ok(stepLines(after.step, after.ctx).includes(stepContract(after.step, after.ctx).whatToDo.text))
  assert.equal(stepLines(after.step, after.ctx).some((l) => /does not choose between them/.test(l)), false, 'the unresolved candidate line is gone once there is an answer')
  assert.ok(stepLines(after.step, after.ctx).some((l) => l.includes(OTHER_CANDIDATE)), 'the export names the group that was chosen')
})

test('needs decision: a detected default can never write the answer', () => {
  const f = open()
  // The same decision, applied on the detected pass rather than the operator's:
  // this is the pass that carries every picker's pre-ticked default, and this
  // picker has none to carry (roadmap/decisions.ts).
  const detected = applyStepDecisions(f.mapping, { [STEP_ID]: { picked: [groupId(f, OTHER_CANDIDATE)], at: WHEN } }, 'detected')
  assert.equal(detected.records[EXCLUSIONS_RECORD_KEY], undefined)
  assert.equal(operatorAnsweredExclusions(detected), false)
  assert.equal(statusOf(caseOf({ ...f, mapping: detected }).step).word, 'Needs decision')
})

// ---- 8, 9. the answer survives ----

test('needs decision: the answer survives a rescan, and a better candidate appearing afterwards', () => {
  const f = open()
  const chosen = groupId(f, OTHER_CANDIDATE)
  const confirmed = confirm(f, [chosen])
  // Two scans of the same tenant with the same saved decision.
  assert.equal(caseOf(confirmed).choice.actionableId, chosen)
  assert.equal(caseOf(confirmed).choice.actionableId, chosen)
  // A new group appears that qualifies by Foundation C's second rule (every
  // member is an emergency account) and sorts above the confirmed one.
  const groups = new Map(confirmed.groups)
  groups.set('11111111-1111-1111-1111-111111111111', { memberIds: [...confirmed.mapping.breakGlassUserIds], memberCount: confirmed.mapping.breakGlassUserIds.length, sampled: false, displayName: 'AAA - Newer exclusions' })
  const later = caseOf({ ...confirmed, groups })
  assert.ok(later.choice.candidates.some((x) => x.name === 'AAA - Newer exclusions'), 'the new group is a candidate')
  assert.equal(later.choice.status, 'confirmed')
  assert.equal(later.choice.actionableId, chosen, 'a newer candidate does not replace an answer')
  assert.equal(later.choice.recommended, null, 'nothing is recommended over an answer')
  assert.notEqual(statusOf(later.step).word, 'Needs decision')
})

// ---- 10. an answer whose object is gone ----

test('needs decision: a confirmed group proved gone goes back to unresolved, and is never swapped for another', () => {
  const f = open()
  const chosen = groupId(f, OTHER_CANDIDATE)
  const confirmed = confirm(f, [chosen])
  const gone = caseOf(confirmed, withGroupGone(confirmed, chosen))
  assert.equal(gone.choice.status, 'invalidated')
  assert.equal(gone.choice.actionableId, null, 'nothing may act on it')
  // The operator's decision is kept: it is theirs, and it is the provenance.
  assert.equal(gone.choice.storedId, chosen)
  assert.deepEqual(operatorExclusionsDecision(gone.f.mapping), { id: chosen, name: null })
  // The other group still qualifies, and is not taken.
  assert.ok(gone.choice.candidates.some((x) => x.name === TOP_CANDIDATE))
  assert.equal(gone.choice.recommended, null)
  // The step says so, and the implementation stays held.
  assert.equal(gone.step.state.condition, 'needs-decision')
  assert.equal(statusOf(gone.step).word, 'Needs decision')
  assert.deepEqual(gone.run.steps.filter((s) => implementationOffered(s)).map((s) => s.id), [])
  const ex = stepVars(gone.step, gone.ctx) as Record<string, unknown>
  assert.deepEqual(ex.missingGroup, [OTHER_CANDIDATE])
  assert.ok(stepLines(gone.step, gone.ctx).some((l) => /is not in .* any more/.test(l) && /has not chosen another group/.test(l)))
})

// ---- 11. candidate order has no authority ----

test('needs decision: candidate order chooses nothing, before or after the answer', () => {
  const f = open()
  const reversed: Fixture = { ...f, groups: new Map([...f.groups].reverse()) }
  const a = caseOf(f)
  const b = caseOf(reversed)
  // The order the scan happened to read the groups in changes neither the
  // candidate list nor anything downstream of it.
  assert.deepEqual(b.choice.candidates.map((x) => x.name), a.choice.candidates.map((x) => x.name))
  for (const c of [a, b]) {
    assert.equal(c.choice.actionableId, null)
    assert.equal(c.choice.storedId, null)
    assert.equal(statusOf(c.step).word, 'Needs decision')
    assert.deepEqual((stepVars(c.step, c.ctx) as Record<string, unknown>).groupsTicked, [])
  }
  // And the operator's answer wins over the sort: the confirmed group is the
  // one that sorts *second*, and it stays the one that is used.
  const chosen = groupId(f, OTHER_CANDIDATE)
  const after = caseOf(confirm(f, [chosen]))
  assert.equal(after.choice.candidates[0]?.name, TOP_CANDIDATE, 'the other candidate still sorts first')
  assert.equal(after.choice.actionableId, chosen)
})

// ---- 13. the whole path, in one walk ----

test('needs decision: fixture → evidence → step → contract → decision → regenerated plan → export', () => {
  // 1. a tenant with an unanswered safety-sensitive question.
  const f = open()
  const before = caseOf(f)
  assert.equal(before.choice.status, 'ambiguous')
  // 2. the evidence is put forward and is not an answer.
  assert.deepEqual((stepVars(before.step, before.ctx) as Record<string, unknown>).groupsTicked, [])
  // 3. the generated step says Needs decision, on the row and in the contract.
  assert.equal(statusOf(before.step).word, 'Needs decision')
  assert.equal(stepContract(before.step, before.ctx).state.conditionLabel, 'Needs decision')
  // 4. nothing is implementable and nothing is scheduled.
  assert.deepEqual(before.run.steps.filter((s) => implementationOffered(s)).map((s) => s.id), [])
  assert.equal(before.run.steps.some((s) => s.events !== null || s.rings.length > 0), false)
  // 5. the operator answers, through the path the Plan uses.
  const chosen = groupId(f, OTHER_CANDIDATE)
  const after = caseOf(confirm(f, [chosen]))
  assert.equal(after.f.mapping.records[EXCLUSIONS_RECORD_KEY]?.provenance, 'confirmed')
  // 6. the regenerated plan clears the hold and can write its policies.
  assert.notEqual(after.step.state.condition, 'needs-decision')
  assert.ok(after.run.steps.filter((s) => implementationOffered(s)).length > 0)
  // 7. the export says what the screen says, at both ends.
  const say = (c: Case): string => stepContract(c.step, c.ctx).whatToDo.text
  assert.ok(stepLines(before.step, before.ctx).includes(say(before)))
  assert.ok(stepLines(after.step, after.ctx).includes(say(after)))
  assert.notEqual(say(before), say(after))
})
