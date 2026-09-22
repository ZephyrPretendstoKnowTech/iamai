// The Step Contract (Foundation D). Every Plan step answers the same questions
// in the same order, and these are the answers that must never go missing or go
// wrong: the state on both axes, the one action, the completion, the blockers
// that are still blocking, who the policy actually reaches, and whether an
// implementation is offered at all.
//
// The contract is a pure view model over Foundations A, B and C, so it is tested
// the way they are: whole fixtures through the whole engine, never a hand-built
// Step. A hand-built step would agree with whatever the contract happened to do.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { applyProgress } from '../../roadmap/progress.ts'
import { observationsOf, requiredMembers } from '../../roadmap/tracking.ts'
import { PINNED_GOAL_MAP } from '../../roadmap/goalMap.ts'
import { stepIdForGoal } from '../../roadmap/stepIds.ts'
import { implementationOffered, isPreserved, unavailableReason } from '../../roadmap/operations.ts'
import { operatorExclusionsDecision, exclusionsGroupCandidates } from '../../mapping/safetyChoice.ts'
import { activePeopleIds } from '../../derive/population.ts'
import { notPeopleIds } from '../../derive/sets.ts'
import type { Step } from '../../roadmap/types.ts'
import { readinessOf, readinessSentence, stepContract } from './stepContract.ts'
import type { StepContract } from './stepContract.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { watchedArrive } from '../../roadmap/observation.ts'

type Run = ReturnType<typeof runFixture>

function ctxFor(f: Fixture, r: Run, step: Step, snapshot = f.snapshot): StepVarContext {
  return {
    snapshot,
    mapping: f.mapping,
    nameOf: (id: string) => r.input.names!.label(id),
    signature: 'IT',
    operatorId: f.operatorId,
    now: snapshot.asOf,
    groups: f.groups,
    reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null,
  }
}

/** Every step of a fixture with its contract: the plan as a person would read it. */
function contracts(name: Parameters<typeof fixture>[0]): { f: Fixture; r: Run; all: { step: Step; c: StepContract }[] } {
  const f = fixture(name)
  const r = runFixture(f)
  return { f, r, all: r.steps.map((step) => ({ step, c: stepContract(step, ctxFor(f, r, step)) })) }
}

const FIXTURES = ['demo', 'demo-week2', 'getiamai', 'messy', 'hostile'] as const

// ---- 1. every step answers the four questions that are never optional ----

test('contract 1: every step on every plan has a state, one action and a concrete Done when', () => {
  for (const name of FIXTURES) {
    for (const { step, c } of contracts(name).all) {
      const where = `${name}/${step.id}`
      // The state, on both axes. The condition is always named; the stage is
      // named wherever the step has one (a prerequisite deploys no policy and so
      // is at no stage of one — that is a fact, not a gap).
      assert.ok(c.state.conditionLabel.length > 0, `${where}: no condition`)
      assert.equal(c.state.lifecycle === null && !c.state.satisfied && !c.state.setAside, c.state.stage === '', `${where}: stage "${c.state.stage}" does not match lifecycle ${c.state.lifecycle}`)
      assert.ok(c.why.trim().length > 0, `${where}: no Why`)
      // The one that used to be conditional on content existing.
      assert.ok(c.whatToDo.text.trim().length > 0, `${where}: no What to do`)
      assert.ok(!/\{[a-zA-Z0-9_:]+\}/.test(c.whatToDo.text), `${where}: a hole in What to do: ${c.whatToDo.text}`)
      // And the one that used to be dropped exactly where it was needed most.
      assert.ok(c.doneWhen.length > 0, `${where}: no Done when`)
      for (const line of c.doneWhen) {
        assert.ok(line.trim().length > 0, `${where}: an empty Done when line`)
        assert.ok(!/\{[a-zA-Z0-9_:]+\}/.test(line), `${where}: a hole in Done when: ${line}`)
      }
      // The Next line earns its place: it never repeats What to do, and a date in
      // it is always a date Foundation B holds — never one manufactured to fill it.
      if (c.milestone.line !== null) {
        assert.notEqual(c.milestone.line, `Next: ${c.whatToDo.text}`, `${where}: the Next line repeats What to do`)
        if (c.milestone.at === null) assert.ok(!/from \w/.test(c.milestone.line), `${where}: a Next line dated with no date behind it: ${c.milestone.line}`)
      }
    }
  }
})

test('contract 1b: a policy the plan cannot write still says what would finish it', () => {
  // This is the case that rendered no Done when at all before Foundation D: the
  // step whose policy is held, where the operator most needs to know what clears it.
  const held = contracts('demo').all.filter(({ c }) => !c.implementation.offered && c.implementation.reason !== null)
  assert.ok(held.length >= 3, `the demo holds ${held.length} policies; it holds several`)
  for (const { step, c } of held) {
    assert.ok(c.doneWhen.length > 0, `${step.id}: a held policy with no Done when`)
    // The action is the reason it is held, not the lifecycle's next move — except
    // on a baseline that contradicts itself, where Foundation B's own milestone
    // already says there is nothing to submit and repeating it differently would
    // be a second sentence for one fact.
    if (c.state.condition !== 'baseline-conflict') assert.notEqual(c.whatToDo.text, c.milestone.label, `${step.id}: the action is the lifecycle's, not the reason it is held`)
  }
})

// ---- 2. the conditional sections are conditional ----

test('contract 2: What IAMAI found, Who and Fix are absent where they have nothing to say', () => {
  const all = [...contracts('demo').all, ...contracts('demo-week2').all]
  assert.ok(all.some(({ c }) => c.found.length === 0), 'no step is without a finding: the section is not conditional')
  assert.ok(all.some(({ c }) => c.found.length > 0), 'no step has a finding at all')
  assert.ok(all.some(({ c }) => c.fix.length === 0), 'every step has something to fix: the section is not conditional')
  assert.ok(all.some(({ c }) => c.fix.length > 0), 'no step has anything to fix')
  assert.ok(all.some(({ c }) => c.who === null || !c.who.known), 'no step declines to name a population')
  assert.ok(all.some(({ c }) => c.who !== null && c.who.known), 'no step names a population')
  // Nothing is invented to fill a section.
  for (const { step, c } of all) for (const f of c.found) assert.ok(f.text.trim().length > 0 && !/\{/.test(f.text), `${step.id}: a made-up finding "${f.text}"`)
})

// ---- 3 & 4. blockers: what is still binding, and only that ----

test('contract 3: a passed check and a cleared prerequisite leave no Fix line behind', () => {
  // A failing check is a Fix line: the messy tenant's exclusions group holds more than the emergency accounts.
  const messy = contracts('messy').all.find(({ step }) => step.id === 's-prereq-exclusion-group')!
  assert.ok(messy.c.fix.some((f) => f.key.startsWith('check:')), 'a failing check is a Fix line')
  // The follow-up week's steps have nothing failing, and ask for nothing.
  for (const { step, c } of contracts('demo-week2').all) if ((step.checks?.failing ?? 0) === 0) assert.equal(c.fix.filter((f) => f.key.startsWith('check:')).length, 0, `demo-week2/${step.id}: no successful check appears as a correction`)
  // And every plan: a Fix line is never a check that passed.
  for (const name of FIXTURES) {
    for (const { step, c } of contracts(name).all) {
      const checkLines = c.fix.filter((x) => x.key.startsWith('check:')).length
      assert.ok(checkLines <= (step.checks?.failing ?? 0), `${name}/${step.id}: ${checkLines} check fixes for ${step.checks?.failing ?? 0} failing checks`)
    }
  }
})

test('contract 4: an outstanding prerequisite is an instruction under Fix before continuing', () => {
  const { all } = contracts('demo')
  const blocked = all.find(({ step }) => step.blockers.some((b) => b.kind === 'step'))!
  assert.ok(blocked, 'the demo has a step waiting on another')
  const stepFixes = blocked.c.fix.filter((x) => x.key.startsWith('step:'))
  assert.ok(stepFixes.length > 0, `${blocked.step.id}: the prerequisite is not a Fix line`)
  for (const f of stepFixes) assert.match(f.text, /^Finish .+ first\.$/, `a prerequisite Fix line reads "${f.text}"; it must be an instruction`)
  // The threshold a step waits on is not a fix — nobody clears it by doing
  // something on this step — so it is the observed number and the wait, and never
  // an instruction. A readiness blocker that names a countable thing somebody has
  // to make (a Temporary Access Pass policy, a trusted location) still is one.
  let gated = 0
  for (const { step, c } of all) {
    const gate = step.action.readinessGate
    if (!gate) continue
    gated += 1
    assert.ok(c.found.some((x) => x.key === 'readiness'), `${step.id}: the readiness number is not stated as an observation`)
    assert.ok(!c.fix.some((x) => x.text.includes(gate.threshold) && x.text.includes(gate.measure)), `${step.id}: the threshold rendered as something to go and fix`)
  }
  assert.ok(gated > 0, 'no step on the demo has a readiness threshold; the case is not covered')
})

// ---- 5. the implementation authority, whatever the status word says ----

test('contract 5: a step whose status has run ahead of Foundation A offers no implementation', () => {
  // Re-anchor the missing-object example on a genuinely tenant-specific object:
  // the operator has not confirmed the exclusions group. Microsoft first-party
  // application IDs are global resource IDs and are not missing tenant objects.
  const f = noExclusionsAnswer(fixture('demo-week2'))
  const r = runFixture(f)
  const step = r.steps.find((candidate) => candidate.id === 's-goal-token-protection')!
  const token = { step, c: stepContract(step, ctxFor(f, r, step)) }
  // The exclusions group the policy carves out has no usable, owner-confirmed
  // object, so the lifecycle is held too (Step 3 correction, owner decision): the
  // status no longer runs ahead on this cause, and Foundation A still decides.
  assert.equal(token.step.status, 'in-report-only', 'the status word is held with the policy')
  assert.equal(token.c.state.lifecycle, 'report-only', 'and so is the lifecycle')
  assert.notEqual(token.c.milestone.kind, 'enforce', 'and the milestone does not say enforce')
  assert.equal(token.c.implementation.offered, false, 'no implementation is offered')
  assert.equal(token.c.whatToDo.kind, 'resolve', 'and the action is not to enforce anything')
  assert.notEqual(token.c.whatToDo.text, token.c.milestone.label, 'the action is the reason it is held, not the milestone')
  // Across every plan: the contract's implementation answer is Foundation A's, always.
  for (const name of FIXTURES) {
    for (const { step, c } of contracts(name).all) {
      assert.equal(c.implementation.offered, implementationOffered(step), `${name}/${step.id}: the contract and Foundation A disagree about implementation`)
      if (!c.implementation.offered && c.implementation.reason !== null) assert.ok(c.implementation.because, `${name}/${step.id}: held with no reason to show`)
    }
  }
})

// ---- 6. a recommendation is not a confirmation ----

test('contract 6: a group IAMAI recommends is never handed over as one the operator confirmed', () => {
  // Foundation C: only an operator's own answer writes the exclusions group. A
  // fixture that has not answered still has candidates to recommend, and nothing
  // the contract hands the UI may treat that recommendation as the answer.
  const f = noExclusionsAnswer(fixture('demo'))
  const r = runFixture(f)
  assert.equal(operatorExclusionsDecision(f.mapping), null, 'nobody has confirmed a group')
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: undefined }
  assert.ok(exclusionsGroupCandidates(ctx as never).length >= 0, 'the detection still runs')
  const step = r.steps.find((s) => s.id === 's-prereq-exclusion-group')!
  const c = stepContract(step, ctxFor(f, r, step))
  assert.equal(c.state.satisfied, false, 'an unanswered question is not a satisfied step')
  assert.notEqual(c.whatToDo.kind, 'preserve', 'and the step does not ask to keep a group nobody chose')
  // And nothing that needs the group is offered while the question is open.
  for (const s of r.steps) {
    const sc = stepContract(s, ctxFor(f, r, s))
    if (sc.implementation.offered) assert.ok(!s.blockedBy.includes('s-prereq-exclusion-group'), `${s.id}: offered while the exclusions group is unconfirmed`)
  }
})

// ---- 7. in place is a result, not a redeployment ----

test('contract 7: a goal the tenant already delivers is preserved, never re-created', () => {
  for (const name of FIXTURES) {
    for (const { step, c } of contracts(name).all) {
      if (!c.state.satisfied) continue
      assert.equal(c.whatToDo.kind, 'preserve', `${name}/${step.id}: a delivered goal's action is ${c.whatToDo.kind}`)
      assert.equal(c.implementation.offered, false, `${name}/${step.id}: instructions for making a second copy of a policy the tenant has`)
      assert.ok(c.doneWhen[0]?.trim(), `${name}/${step.id}: completion criteria are missing`)
      assert.doesNotMatch(c.doneWhen[0], /^(?:Create|Correct|Deploy|Enable)\b/, `${name}/${step.id}: a completed step asks for another implementation`)
      assert.ok(c.fix.length === 0, `${name}/${step.id}: a delivered goal still asks for work`)
    }
  }
  // In place is an outcome, and the state says so rather than inventing a stage.
  const inPlace = contracts('demo').all.find(({ c }) => c.state.satisfied && !c.state.inPlace === false)!
  assert.ok(['In place', 'Enforced'].includes(inPlace.c.state.stage), `a delivered goal reads "${inPlace.c.state.stage}"`)
})

// ---- 8 & 11. a goal the baseline implements with two policies ----

/**
 * demo-week2 with none of its own Conditional Access policies, so the pinned
 * pair behind `guests-mfa` is the step's two required members, and whatever the
 * case plants is what a scan sees of each (the shape foundationB.test.ts uses).
 */
function pairStep(rowsFor: (a: Record<string, unknown>, b: Record<string, unknown>) => Record<string, unknown>[]): { f: Fixture; r: Run; step: Step } {
  const f = fixture('demo-week2')
  const ca = f.snapshot.config.caPolicies ?? { status: 'ok' as const, reason: null, rows: [] }
  const bare = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: [] } } }
  const r = runFixture({ ...f, snapshot: bare }, { snapshot: bare } as never)
  const goal = stepIdForGoal('guests-mfa')
  const ops = (r.steps.find((s) => s.id === goal) as Step).action.resolution!.policies
  const snapshot = structuredClone(bare)
  snapshot.config.caPolicies = { status: 'ok', reason: null, rows: rowsFor(ops[0].body, ops[1].body) } as typeof snapshot.config.caPolicies
  applyProgress(r.steps, snapshot, r.coverage, f.planId, undefined, null, {}, {
    groupMembers: Object.fromEntries([...f.groups].filter(([, g]) => g.sampled !== true).map(([id, g]) => [id.toLowerCase(), [...g.memberIds]])),
    activePeople: activePeopleIds(f.snapshot, f.snapshot.asOf, notPeopleIds(f.mapping)),
  })
  return { f: { ...f, snapshot }, r, step: r.steps.find((s) => s.id === goal) as Step }
}

test('contract 8: a two-policy step shows both, and neither stands for the step', () => {
  assert.equal(PINNED_GOAL_MAP['guests-mfa'].length, 2, 'the pinned baseline implements the guests goal with two policies')
  // Policy A deployed in report-only, Policy B not deployed at all: two members
  // with two different stories, and the step is neither of them on its own.
  const { f, r, step } = pairStep((a) => [{ ...structuredClone(a), id: '0a11a11a-0000-4000-8000-00000000000a', state: 'enabledForReportingButNotEnforced', createdDateTime: f0(), modifiedDateTime: f0() }])
  const c = stepContract(step, ctxFor(f, r, step))
  assert.equal(requiredMembers(step).length, 2, 'two required members')
  assert.equal(c.members.length, 2, 'and the contract renders two')
  assert.equal(c.multiPolicy, true, 'and says so')
  assert.notEqual(c.members[0].key, c.members[1].key, 'two identities, not one')
  assert.notEqual(c.members[0].name, c.members[1].name, 'each named as itself')
  assert.deepEqual(c.members.map((m) => m.label), ['Policy A', 'Policy B'], 'labelled in the baseline order')
  assert.notDeepEqual(c.members[0].line, c.members[1].line, "one member's line stands for the other")
  // The deployed half does not close the step: its own stage is not the step's answer.
  assert.equal(c.members[0].lifecycle, 'report-only', 'A is being watched')
  assert.notEqual(c.members[1].lifecycle, 'report-only', 'B is not, because B is not there')
  assert.equal(c.state.satisfied, false, "A's progress did not deliver the goal")
})

/** The pair fixture's own scan instant, as a policy's created/modified date. */
function f0(): string {
  return new Date(Date.parse(fixture('demo-week2').snapshot.asOf) - 30 * 86_400_000).toISOString()
}

test('contract 11: a one-policy step stays a one-policy step', () => {
  // Multi-policy support must not put a member block on every row: on the whole
  // demo plan exactly nothing is a pair, so nothing renders one.
  for (const name of FIXTURES) {
    for (const { step, c } of contracts(name).all) {
      if (c.multiPolicy) continue
      assert.ok(c.members.length <= 1, `${name}/${step.id}: ${c.members.length} members without multiPolicy`)
      if (c.members.length === 1) assert.equal(c.members[0].label, null, `${name}/${step.id}: a single policy labelled "Policy A"`)
    }
  }
})

// ---- 9. a baseline that contradicts itself ----

test('contract 9: a baseline conflict renders with no implementation and nothing to go and fix', () => {
  for (const name of ['demo', 'demo-week2'] as const) {
    const { c, step } = contracts(name).all.find(({ c }) => c.state.condition === 'baseline-conflict')!
    assert.equal(c.implementation.offered, false, `${name}/${step.id}: an implementation for a policy the baseline defines twice`)
    assert.equal(c.state.conditionLabel, 'Baseline conflict', 'the condition is named as itself, not as generic blockage')
    assert.equal(c.whatToDo.kind, 'resolve')
    assert.ok(c.whatToDo.text.length > 0, 'and it still says what happens next')
    // Nothing in the tenant clears it, so the step asks the operator for nothing.
    assert.equal(c.fix.length, 0, `${name}/${step.id}: a baseline conflict asked the operator to fix something`)
    assert.match(c.doneWhen[0], /baseline author/, `Done when reads "${c.doneWhen[0]}"`)
  }
})

// ---- 10. unknown is unknown ----

test('contract 10: a reach IAMAI could not settle is never a count of nobody', () => {
  const unknown = [...contracts('demo').all, ...contracts('demo-week2').all].filter(({ c }) => c.who !== null && !c.who.known)
  assert.ok(unknown.length > 0, 'no step on the demo has an unsettled reach; the case is not covered')
  for (const { step, c } of unknown) {
    assert.doesNotMatch(c.who!.text, /\b0\b|nobody|no people|none/i, `${step.id}: an unknown reach reads "${c.who!.text}"`)
    assert.match(c.who!.text, /cannot establish|Policy scope awaits|Policy applicability|Exact guest-policy reach|directory/i, `${step.id}: an unknown reach does not say so`)
  }
})

// ---- 12. one structure, everywhere ----

test('contract 12: every Plan row and every step body is drawn by the shared components', () => {
  const read = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8')
  const shared = read('./StepSections.tsx')
  assert.match(shared, /className="plan-row"/, 'the shared row is where the row markup lives')
  for (const file of ['./Plan.tsx', './ContentStep.tsx', './CleanupStep.tsx', './PlanFooter.tsx', './PrintPlan.tsx']) {
    const src = read(file)
    assert.doesNotMatch(src, /className="plan-row"/, `${file} builds its own row instead of using PlanRow`)
  }
  const plan = read('./Plan.tsx')
  assert.match(plan, /import \{ PlanRow \} from '\.\/StepSections\.tsx'/, 'Plan.tsx draws its rows with the shared row')
  assert.equal(plan.match(/<PlanRow/g)?.length, 2, 'both kinds of Plan row — a step and a Cleanup item — go through it')
  // And the step body renders the contract rather than re-reading the engine.
  // The opened step's body spans the component and stepBody.ts (A3): the decisions read there.
  const body = read('./ContentStep.tsx') + read('./stepBody.ts')
  assert.match(body, /stepContract\(step, ctx/, 'the step body is built from the contract')
  assert.match(body, /<WhatToDoLead contract=\{contract\}/, 'and its action comes from there')
  assert.match(body, /<DoneWhen /, 'and its completion')
  assert.match(body, /readinessOf\(step, contract, blockers, prerequisiteLabel \?\? undefined\)/, 'and its blockers, as Readiness tiles labelled by their own lane (A1b decision 12)')
  for (const gone of ['implementationOffered', 'isPreserved', 'statusOf']) {
    assert.doesNotMatch(body, new RegExp(`\\b${gone}\\(`), `ContentStep still asks the engine ${gone}() itself`)
  }
})

// A step IAMAI WATCHED move is not a report of coverage that was already there.
// "Already delivered by X, so there is nothing to create" is a sentence about a
// tenant that had the policy before IAMAI looked; printed on the step somebody
// has just created, watched through its window and enforced, it describes their
// work as something they never needed to do. Every persona who finishes a policy
// correctly reads this line, so it is the successful path's sentence, not an
// edge case. `observation.since` already knows which it is (observation.ts).
test('a policy IAMAI watched get into place is not reported as coverage the tenant already had', () => {
  const f = structuredClone(fixture('demo-week2'))
  const r = runFixture(f)
  const watched = r.steps.find((s) => s.state.observation?.latest.since === 'observed-change' && isPreserved(s))
  const found = (s: Step, run: Run): string[] =>
    stepContract(s, ctxFor(f, run, s)).found.filter((x) => x.key === 'in-place').map((x) => x.text)
  if (watched) {
    const text = found(watched, r).join(' ')
    assert.equal(/nothing to create/.test(text), false, `${watched.id}: ${text}`)
    assert.match(text, /IAMAI watched (it|them) get there/, `${watched.id}: ${text}`)
  }
  // And a goal the tenant genuinely already had, on a scan that watched nothing:
  // the existing-coverage report is unchanged, because it is still true.
  const first = structuredClone(fixture('mid'))
  const fr = runFixture(first)
  const already = fr.steps.filter((s) => isPreserved(s) && s.state.observation?.latest.since !== 'observed-change')
  assert.ok(already.length > 0, 'the premise: this tenant has goals it already delivered')
  for (const s of already) {
    const text = stepContract(s, ctxFor(first, fr, s)).found.filter((x) => x.key === 'in-place').map((x) => x.text).join(' ')
    if (text.length === 0) continue
    assert.equal(/IAMAI watched/.test(text), false, `${s.id}: claims to have watched a policy it found in place — ${text}`)
  }
})

// A threshold stated against a non-number is a dead end. "Enforcement waits for
// MFA readiness to reach 90%; it is not measured today" appeared three times on
// one step — the finding, the Threshold tile and its note — and named nothing
// the reader could go and change. methodReadiness.ts had already counted who is
// ready and who could not be read, and that sentence was rendered nowhere.
//
// Since the floor (roadmap/readiness.ts `atLeast`) the two cases cannot overlap:
// a counted reading means the scope was read, which means there IS a number to
// state, so a gate with no number is now exactly a gate whose scope could not be
// read. It must still say its threshold, and must still not claim a number.
test('a readiness gate with no number states its threshold and claims no number', () => {
  let bare = 0
  let floored = 0
  for (const name of ['demo', 'small', 'mid', 'large', 'messy', 'midflight', 'hostile'] as const) {
    const r = runFixture(structuredClone(fixture(name)))
    for (const step of r.steps) {
      const gate = step.action.readinessGate
      if (!gate) continue
      const text = readinessSentence(step, gate)
      const line = step.readiness.lines[0]
      if (!gate.value.endsWith('%')) {
        bare += 1
        assert.match(text, /reach [0-9]+%/, `${name}/${step.id}: the gate no longer states its threshold — ${text}`)
        // A counted reading may still sit under a gate with no number, where the
        // count is zero because nobody could be judged: that is a reading of what
        // the scan could not see, and a floor of zero is not a floor.
        if (typeof line === 'string') assert.doesNotMatch(line, /^[1-9][0-9]* of /, `${name}/${step.id}: somebody was judged ready and no number is stated`)
        continue
      }
      if (gate.floor !== true) continue
      floored += 1
      // What used to be a dead end: the reading is said, and marked as a floor.
      assert.match(text, /At least [0-9]+%/, `${name}/${step.id}: ${text}`)
      if (step.state.lifecycle !== 'enforced' && typeof line === 'string' && line.length > 0) assert.ok(text.includes(line), `${name}/${step.id}: the gate does not say what could not be measured — ${text}`)
    }
  }
  assert.ok(floored > 3, `gates reading a floor: ${floored}`)
  assert.ok(bare > 0, 'no fixture reaches a gate whose scope could not be read')
  // A measured gate is unchanged: it has a number, and the number is the point.
  const r = runFixture(structuredClone(fixture('mid')))
  for (const s of r.steps.filter((x) => x.action.readinessGate?.value.endsWith('%') && x.action.readinessGate?.floor !== true)) {
    const g = s.action.readinessGate!
    assert.ok(readinessSentence(s, g).includes(g.value), `${s.id}: a measured gate lost its number`)
  }
})

// A prerequisite is not always waited on until it is FINISHED. The dependency
// data carries a milestone on every edge, and dropping it made every wait read
// "Finish X first" — which turned one legitimate pair of edges into an apparent
// deadlock: Turn Off Security Defaults waits for the replacement policies to be
// READY TO ENFORCE, and those policies wait for it to be COMPLETE. Both tiles
// told the reader to finish the other one first. The way out of an apparent
// deadlock is to turn security defaults off, which is the single thing that
// step's own words say not to do yet, and it costs the tenant its MFA.
test('a prerequisite waited on short of completion says which milestone, not "finish it"', () => {
  const { f, r, all } = contracts('small')
  // A step whose own fixes name no prerequisite, so the injected blocker is the
  // only one in play: with others present the tile is filtered by which of them
  // can be acted on first, which is a different rule and tested below.
  const { step, c } = all.find((x) => (x.step.kind === 'create' || x.step.kind === 'adjust') && !x.c.fix.some((fx) => /^(?:step|missing):/.test(fx.key)))!
  const title = 'Require MFA for Everyone'
  const noteFor = (milestone?: string): string | null => {
    const blockers = [{ kind: 'step' as const, id: 's-goal-mfa-all-users', abnormal: false, label: 'Prerequisite', title, ...(milestone ? { milestone } : {}) }]
    const ready = readinessOf(step, c, blockers, () => null)
    return [...ready.tiles, ...ready.satisfied].find((t) => t.key === 'engine:step:s-goal-mfa-all-users')?.note ?? null
  }
  assert.ok(f && r, 'the fixture ran')
  const short = noteFor('ready-to-enforce')
  assert.match(short ?? '', /ready to enforce first/, String(short))
  assert.equal(/Finish .* first\./.test(short ?? ''), false, String(short))
  // A wait that really is until completion keeps the plain sentence, and a
  // blocker carrying no milestone is read as one (callers that never had it).
  for (const milestone of ['complete', undefined]) {
    assert.equal(noteFor(milestone), `Finish ${title} first.`, `${String(milestone)}`)
  }
})

// Where a step waits on two prerequisites and one of them waits on the other,
// the tile drawn is the one that is NOT waiting — the step somebody can go and
// do today. It used to be the other way round: the prerequisite others waited on
// was dropped as "that tile's to finish first", which holds only if the tile
// that survives leads somewhere. Block Legacy Authentication waits on both
// Create or Correct Service Accounts Group and Turn Off Security Defaults, and
// Turn Off Security Defaults waits on Block Legacy Authentication — so the tile
// that survived was the reciprocal half that cannot move, and the one step that
// would have released the chain was named on no surface. Two simulated
// administrators sat in front of that; one never unlocked the plan at all.
test('of two prerequisites where one waits on the other, the tile names the one that can be done now', () => {
  const { f, r, all } = contracts('demo')
  const { step, c } = all.find((x) => (x.step.kind === 'create' || x.step.kind === 'adjust') && !x.c.fix.some((fx) => /^(?:step|missing):/.test(fx.key)))!
  assert.ok(f && r, 'the fixture ran')
  // A real one-way pair from the shipped dependency graph: s-verify-mfa waits on
  // s-prereq-passkey-settings, and the passkey step does not wait on it.
  const FIRST = 's-prereq-passkey-settings'
  const LATER = 's-verify-mfa'
  const blockers = [FIRST, LATER].map((id) => ({ kind: 'step' as const, id, abnormal: false, label: 'Prerequisite', title: id }))
  const keys = readinessOf(step, c, blockers, () => null)
  const drawn = [...keys.tiles, ...keys.satisfied].map((t) => t.key)
  assert.ok(drawn.includes(`engine:step:${FIRST}`), `the actionable prerequisite is not drawn: ${JSON.stringify(drawn)}`)
  assert.equal(drawn.includes(`engine:step:${LATER}`), false, `the prerequisite that waits on it is drawn too: ${JSON.stringify(drawn)}`)

  // The reciprocal cutover pair is neither's ancestor, so both survive: that is
  // the case the milestone wording exists for, and dropping half of it would put
  // the reader back in a loop with no way through.
  const PAIR = ['s-prereq-security-defaults', 's-goal-block-legacy-auth']
  const pairTiles = readinessOf(step, c, PAIR.map((id) => ({ kind: 'step' as const, id, abnormal: false, label: 'Prerequisite', title: id })), () => null)
  const pairDrawn = [...pairTiles.tiles, ...pairTiles.satisfied].map((t) => t.key)
  for (const id of PAIR) assert.ok(pairDrawn.includes(`engine:step:${id}`), `${id}: half the cutover pair is missing — ${JSON.stringify(pairDrawn)}`)
})

// "Require MFA for Everyone", Completed, beside a card reading "6 active
// people" on a 122-person tenant. The policy delivering it excludes a group
// holding 116 of 122 accounts, and nothing on the step named the other 116.
//
// The cause is not a missing check. generate.ts subtracts the excluded from the
// goal's own population, so the goal becomes six people and is then delivered
// for all of them — true of the goal as redefined, and silent about the number a
// reader needs. The exclusion is marked EXPECTED, because the exclusions group
// is what the plan asks for, so nothing in the coverage reasons marks it wrong
// either. What is worth saying is the size, which needs no judgement at all.
test('a goal delivered for a fraction of the people it is written for says so', () => {
  const f = structuredClone(fixture('messy'))
  const r = runFixture(f)
  const step = r.steps.find((s) => s.goalId === 'mfa-all-users')!
  assert.equal(step.state.satisfied, true, 'the premise: the classifier calls it delivered')
  const line = stepContract(step, ctxFor(f, r, step)).found.find((x) => x.key === 'shortfall')?.text ?? ''
  assert.match(line, /written for 122 people/, line)
  assert.match(line, /116 of them are excluded/, line)
  assert.match(line, /reaches 6/, line)

  // The emergency accounts are excluded from every policy by design. Saying so
  // on every step would put a line about two people under thirty rows, so the
  // sentence appears only where the exclusions take out somebody else as well.
  const clean = runFixture(structuredClone(fixture('mid')))
  const byDesign = clean.steps.filter((s) => {
    const sf = s.coverageShortfall
    return sf !== undefined && sf.people <= fixture('mid').mapping.breakGlassUserIds.length
  })
  assert.deepEqual(byDesign.map((s) => s.id), [], 'a step states an exclusion that is only the emergency accounts')

  // And a scoped goal counts its own people, never the whole directory: an
  // admins policy that reaches every admin is not missing the other 230.
  for (const name of ['mid', 'large', 'demo-week2'] as const) {
    for (const s of runFixture(structuredClone(fixture(name))).steps) {
      const sf = s.coverageShortfall
      if (!sf) continue
      assert.equal(sf.reached + sf.people, sf.active, `${name}/${s.id}: the denominator is not the goal's own population`)
    }
  }
})

// One step said both things about one policy: What IAMAI found reported "is in
// place. IAMAI watched it get there", and the who-line above it said "{tenant}
// already covers this with X". The first had been corrected and the second had
// not, which is worse than leaving both wrong: a reader cannot tell which row to
// believe. Both read one predicate now (roadmap/observation.ts watchedArrive).
test('a policy IAMAI watched arrive is never also reported as coverage the tenant already had', () => {
  const f = structuredClone(fixture('demo'))
  const first = runFixture(f)
  const prior = observationsOf(first.steps)
  assert.ok(Object.keys(prior).length > 0, 'the premise: the first scan recorded observations')
  const second = runFixture(f, {}, prior)
  const watched = second.steps.filter((s) => watchedArrive(s))
  for (const step of watched) {
    const ex = stepVars(step, ctxFor(f, second, step)) as Record<string, unknown>
    const claims = Array.isArray(ex.existingPolicies) ? (ex.existingPolicies as unknown[]).length : 0
    assert.equal(claims, 0, `${step.id}: says the tenant already covers a policy IAMAI watched arrive`)
  }
  // And the predicate has one definition: both readers call it rather than
  // re-deriving it, which is how the two rows came to disagree.
  const contract = readFileSync('src/ui/surfaces/stepContract.ts', 'utf8')
  const vars = readFileSync('src/ui/surfaces/stepVars.ts', 'utf8')
  for (const [where, src] of [['stepContract.ts', contract], ['stepVars.ts', vars]] as const) {
    assert.match(src, /watchedArrive\(/, `${where}: does not use the shared predicate`)
    assert.equal(/since === 'observed-change'/.test(src), false, `${where}: re-derives "watched" instead of calling it`)
  }
})

// "Scan again to rebuild it" over a goal the tenant already delivers.
//
// The step's own record names the policy doing it (Step.satisfiedBy), so both
// halves of the sentence are wrong for this case: there is nothing to rebuild
// and rescanning changes nothing. A reader scanned, got the identical page,
// and had no way forward — the step is open for some other reason, and those
// reasons are on the card already.
test('a step with nothing to write over existing coverage names the policy, not a rescan', () => {
  let checked = 0
  for (const name of ['mid', 'large', 'midflight', 'messy', 'hostile'] as const) {
    const f = structuredClone(fixture(name))
    const run = runFixture(f)
    const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
    for (const step of run.steps) {
      if (unavailableReason(step) !== 'no-operation') continue
      const by = step.satisfiedBy
      if (!by || by.policies.length === 0) continue
      checked++
      const said = stepContract(step, ctx).milestone.line ?? stepContract(step, ctx).whatToDo.text
      const policy = by.sufficient ?? by.policies[0]
      assert.ok(said.includes(policy), `${name}/${step.id}: the policy delivering this is not named: ${said}`)
      assert.doesNotMatch(said, /again to rebuild it/, `${name}/${step.id}: still asks for a rescan`)
    }
  }
  assert.ok(checked > 0, 'no fixture reaches the case')
})

// A completion no scan can reach.
//
// "A scan rebuilds this step with a policy IAMAI can write" was the Done-when
// on fourteen rows across five tenants whose goal is ALREADY ENFORCED by a
// policy the step itself names. There is nothing to rebuild, so those rows
// could be neither finished nor declined: an operator scanned, read the
// identical page, and left them open for the life of the plan.
test('a step whose goal is already delivered does not wait on a scan that cannot help it', () => {
  let checked = 0
  for (const name of ['mid', 'large', 'midflight', 'messy', 'hostile'] as const) {
    const f = structuredClone(fixture(name))
    const run = runFixture(f)
    const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
    for (const step of run.steps) {
      if (unavailableReason(step) !== 'no-operation') continue
      const by = step.satisfiedBy
      if (!by || by.policies.length === 0) continue
      checked++
      const contract = stepContract(step, ctx)
      const done = contract.doneWhen.join(String.fromCharCode(10))
      assert.doesNotMatch(done, /A scan rebuilds this step/, `${name}/${step.id}: an unfinishable completion`)
      // The policy is named once, on the card; the completion says what
      // finishes the step and nothing else.
      const card = contract.milestone.line ?? contract.whatToDo.text
      assert.ok(card.includes(by.sufficient ?? by.policies[0]), `${name}/${step.id}: the policy delivering it is named nowhere`)
      // And the way out is stated, because there is one.
      assert.match(done, /does not apply/, `${name}/${step.id}: no way to decline`)
    }
  }
  assert.ok(checked > 3, `only ${checked} rows reach the case`)
})
