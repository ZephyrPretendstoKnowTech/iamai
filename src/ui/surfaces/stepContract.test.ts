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
import { requiredMembers } from '../../roadmap/tracking.ts'
import { PINNED_GOAL_MAP } from '../../roadmap/goalMap.ts'
import { stepIdForGoal } from '../../roadmap/stepIds.ts'
import { implementationOffered } from '../../roadmap/operations.ts'
import { operatorExclusionsDecision, exclusionsGroupCandidates } from '../../mapping/safetyChoice.ts'
import { activePeopleIds } from '../../derive/population.ts'
import { notPeopleIds } from '../../derive/sets.ts'
import type { Step } from '../../roadmap/types.ts'
import { stepContract } from './stepContract.ts'
import type { StepContract } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'

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
  // The same emergency-access step on day one and in week two: three checks fail
  // on the first, none on the second, and week two's step asks for nothing.
  const day1 = contracts('demo').all.find(({ step }) => step.id === 's-prereq-break-glass')!
  const week2 = contracts('demo-week2').all.find(({ step }) => step.id === 's-prereq-break-glass')!
  assert.ok(day1.c.fix.length > 0, 'day one: the failing checks are Fix lines')
  assert.equal(day1.c.fix.length, day1.step.checks!.failing, 'one Fix line per failing check, and no more')
  assert.equal(week2.step.checks!.failing, 0, 'week two: every check passes')
  assert.equal(week2.c.fix.length, 0, 'week two: nothing passed is left on screen')
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
  assert.equal(token.step.status, 'ready-to-enforce', 'the status word has run ahead')
  assert.equal(token.c.state.lifecycle, 'ready-to-enforce', 'and so has the lifecycle')
  assert.equal(token.c.milestone.kind, 'enforce', 'and the milestone says enforce')
  assert.equal(token.c.implementation.offered, false, 'yet no implementation is offered')
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
      assert.match(c.doneWhen[0], /Already satisfied/, `${name}/${step.id}: Done when reads "${c.doneWhen[0]}"`)
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
    assert.match(c.doneWhen[0], /reviewed baseline/, `Done when reads "${c.doneWhen[0]}"`)
  }
})

// ---- 10. unknown is unknown ----

test('contract 10: a reach IAMAI could not settle is never a count of nobody', () => {
  const unknown = [...contracts('demo').all, ...contracts('demo-week2').all].filter(({ c }) => c.who !== null && !c.who.known)
  assert.ok(unknown.length > 0, 'no step on the demo has an unsettled reach; the case is not covered')
  for (const { step, c } of unknown) {
    assert.doesNotMatch(c.who!.text, /\b0\b|nobody|no people|none/i, `${step.id}: an unknown reach reads "${c.who!.text}"`)
    assert.match(c.who!.text, /cannot establish/, `${step.id}: an unknown reach does not say so`)
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
  const body = read('./ContentStep.tsx')
  assert.match(body, /stepContract\(step, ctx/, 'the step body is built from the contract')
  assert.match(body, /<WhatToDoLead contract=\{contract\}/, 'and its action comes from there')
  assert.match(body, /<DoneWhen /, 'and its completion')
  assert.match(body, /<FixBeforeContinuing /, 'and its blockers')
  for (const gone of ['implementationOffered', 'isPreserved', 'statusOf']) {
    assert.doesNotMatch(body, new RegExp(`\\b${gone}\\(`), `ContentStep still asks the engine ${gone}() itself`)
  }
})
