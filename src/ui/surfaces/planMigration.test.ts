// The Plan migration (task 011): every step the product can draw goes through the
// one shared body, and none of them recreates a layout of its own.
//
// Tasks 004–010 proved the canonical lifecycle and condition cases one step at a
// time. This is the sweep: every step of every fixture, through the frozen Step
// Contract, asserted on structure and state rather than on sentences — the words
// are content.json's and are allowed to change, the shape is not.
//
// What it exists to catch:
//
//  - a step family that never reached the shared body (the free-tier ladder and
//    the validation blockers opened to an empty panel, and three ladder rungs
//    borrowed a Conditional Access policy step's content on a tenant that cannot
//    hold a policy: the wrong title, "Make the object this step names.", and a
//    report-only completion checklist for work that is not a policy);
//  - the lifecycle and the condition collapsing back into one word;
//  - the default step filling up again with everything the engine knows;
//  - a blocker or a decision sinking into More;
//  - a step that cannot be implemented gaining an implementation, a date, a
//    rollback or a completion it has not got.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { allFixtures, fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import type { Step } from '../../roadmap/types.ts'
import { LADDER_ITEMS, ladderStepId } from '../../roadmap/ladder.ts'
import { blockerStepId } from '../../roadmap/blockerSteps.ts'
import type { RuleSubject } from '../../validation/rules.ts'
import { implementationOffered } from '../../roadmap/operations.ts'
import { stepById } from '../../content/content.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { CONTRACT, stepContract } from './stepContract.ts'
import type { StepContract } from './stepContract.ts'
import { HEAD } from './stepHeadings.ts'
import { NAMES_INLINE, whoBlocks } from './whoBlocks.ts'
import { stepInstructions } from './stepInstructions.ts'
import { portalNamesFor } from './stepPortal.ts'
import { jsonOffered } from './stepJson.ts'
import { datesLineFor, ifWrongLineFor, stepExportView } from './stepExport.ts'

const HOLE = /\{[a-zA-Z0-9_:]+\}/

/** Every validation subject that can become a step of its own (blockerSteps.ts skips the two foundations). */
const BLOCKER_SUBJECTS: RuleSubject[] = ['trustedLocation', 'allowedCountries', 'pilotGroup', 'serviceAccount', 'authStrength']

type Opened = { fixture: string; step: Step; ctx: StepVarContext; ex: Record<string, unknown>; contract: StepContract; cs: Record<string, unknown> }

function ctxFor(f: Fixture, r: ReturnType<typeof runFixture>, step: Step): StepVarContext {
  return {
    snapshot: f.snapshot,
    mapping: f.mapping,
    nameOf: (id: string) => r.input.names!.label(id),
    signature: 'IT',
    operatorId: f.operatorId,
    now: f.snapshot.asOf,
    groups: f.groups,
    reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null,
  }
}

/**
 * The demo tenant with the exclusions question unanswered: the one thing an
 * operator must settle before any policy can be written (Foundation C), and so
 * the canonical step that waits on a person rather than on work.
 */
function unansweredExclusions(): Opened[] {
  const f = noExclusionsAnswer(fixture('demo'))
  const r = runFixture(f, { mapping: f.mapping })
  return r.steps.map((step) => {
    const ctx = ctxFor(f, r, step)
    const ex = stepVars(step, ctx) as Record<string, unknown>
    return { fixture: 'demo (exclusions unanswered)', step, ctx, ex, contract: stepContract(step, ctx, ex), cs: (contentStepFor(step) ?? {}) as Record<string, unknown> }
  })
}

/** Every step of every fixture, as the Plan opens it. Derived once; the fixture runs are memoised. */
let cache: Opened[] | null = null
function everyStep(): Opened[] {
  if (cache) return cache
  const out: Opened[] = []
  for (const f of allFixtures()) {
    const r = runFixture(f)
    for (const step of r.steps) {
      const ctx = ctxFor(f, r, step)
      const ex = stepVars(step, ctx) as Record<string, unknown>
      out.push({ fixture: f.name, step, ctx, ex, contract: stepContract(step, ctx, ex), cs: (contentStepFor(step) ?? {}) as Record<string, unknown> })
    }
  }
  assert.ok(out.length > 100, 'the fixtures stopped producing steps')
  cache = out
  return out
}

// ---------------------------------------------------------------------------
// A. Every production step family reaches the shared body
// ---------------------------------------------------------------------------

test('every step the fixtures produce opens with a title, a why, one action and a completion, and no hole in any of them', () => {
  for (const { fixture, step, contract } of everyStep()) {
    const where = `${fixture}/${step.id}`
    assert.ok(contract.title.length > 0, `${where}: no title`)
    assert.ok(contract.why.length > 0, `${where}: no why`)
    assert.ok(contract.whatToDo.text.length > 0, `${where}: no next action`)
    assert.ok(contract.doneWhen.length > 0, `${where}: no completion`)
    for (const [what, text] of [['title', contract.title], ['why', contract.why], ['action', contract.whatToDo.text], ...contract.doneWhen.map((l, i) => [`doneWhen[${i}]`, l] as [string, string]), ...contract.fix.map((f, i) => [`fix[${i}]`, f.text] as [string, string])] as [string, string][]) {
      assert.doesNotMatch(text, HOLE, `${where}: ${what} has a hole`)
    }
  }
})

test('the row and the body it opens read one title resolver, and it answers for every step', () => {
  for (const { fixture, step } of everyStep()) {
    const title = contentTitle(step)
    assert.ok(title.length > 0, `${fixture}/${step.id}: no title`)
    assert.doesNotMatch(title, HOLE, `${fixture}/${step.id}: the title has a hole`)
  }
  // Both sides read `contentTitle` (content/stepTitle.ts). The body used to read
  // the content entry directly, which is the same answer for a step that has one
  // and no answer at all for the two families that do not.
  assert.match(readFileSync('src/ui/surfaces/Plan.tsx', 'utf8'), /title=\{contentTitle\(step\)\}/, 'the row reads contentTitle')
  // The opened step's body spans the component and stepBody.ts (A3): the decisions read there.
  const body = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8') + readFileSync('src/ui/surfaces/stepBody.ts', 'utf8')
  assert.match(body, /const title = contentTitle\(step\)/, 'the body reads contentTitle')
  assert.doesNotMatch(body, /step-title">\{cs\.title\}/, 'the body reads the content entry directly')
})

// The two families that had no content entry at all. Their words are the
// engine's, so the entries carry only What to do and Done when; without an entry
// the contract falls through to a policy step's answers, which is how a free-tier
// ladder rung came to instruct a Conditional Access deployment.
test('every free-tier ladder rung and every validation blocker has its own content entry, and it adds only the words the engine has none of', () => {
  const ids = [...LADDER_ITEMS.map((i) => ladderStepId(i.id)), ...BLOCKER_SUBJECTS.map(blockerStepId)]
  for (const id of ids) {
    const cs = stepById[id]
    assert.ok(cs, `${id} has no content entry, so its body falls back to a policy step's`)
    assert.ok(['ladder', 'blocker'].includes(cs.kind), `${id}: unexpected kind ${cs.kind}`)
    assert.equal(cs.title, undefined, `${id}: the title is the engine's; writing it here makes two sources of one fact`)
    assert.equal(cs.why, undefined, `${id}: the why is the engine's`)
    assert.ok(typeof (cs.whatToDo as { lead?: unknown } | null)?.lead === 'string', `${id}: no What to do`)
    assert.ok(Array.isArray(cs.doneWhen) && cs.doneWhen.length > 0, `${id}: no Done when`)
  }
})

test('no ladder rung borrows a policy step content entry', () => {
  const rungs = new Set(LADDER_ITEMS.map((i) => ladderStepId(i.id)))
  for (const { fixture, step, cs } of everyStep()) {
    if (!rungs.has(step.id)) continue
    assert.equal(cs.id, step.id, `${fixture}/${step.id}: resolved ${String(cs.id)} instead of its own entry`)
    assert.equal(cs.kind, 'ladder', `${fixture}/${step.id}: resolved a ${String(cs.kind)} step`)
  }
})

// One body, drawn with the contract's components. A step that wanted a section of
// its own would have to add a second renderer, and there is nowhere to put one.
test('the Plan draws a step body one way, through the Step Contract components', () => {
  const cs = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  for (const c of ['<StepState', '<WhatIamaiFound', '<WhatToDoLead', '<ReadinessSection', '<DoneWhen', '<PolicyMembers']) {
    assert.equal(cs.split(c).length - 1, 1, `ContentStep draws ${c} other than exactly once`)
  }
  assert.doesNotMatch(cs, /return <div className="step-body" \/>/, 'a step without a content entry must still open to its contract, not to an empty panel')
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(plan, /<ContentStep/, 'the Plan opens a step with ContentStep')
  assert.match(plan, /<CleanupBody/, 'the Plan opens a Cleanup row with CleanupBody')
  // The two of them and nothing else: a third `step-body` is a second renderer.
  const bodies = ['src/ui/surfaces/ContentStep.tsx', 'src/ui/surfaces/CleanupStep.tsx']
  for (const file of ['src/ui/surfaces/Plan.tsx', 'src/ui/surfaces/PrintPlan.tsx', 'src/ui/surfaces/Export.tsx', 'src/ui/surfaces/PlanFooter.tsx']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /className=[{"]`?step-body/, `${file} builds a step body of its own`)
  }
  // Task 034 gave the body the approved frame's two columns, so the class the
  // step carries is `step-body` plus the rail marker where the contract has one
  // for it. The claim is unchanged: two files draw a step body and no other may.
  for (const file of bodies) assert.match(readFileSync(file, 'utf8'), /className=[{"]`?step-body/, `${file} is a step body`)
})

test('a section heading is written in one place and read everywhere', () => {
  for (const [key, value] of Object.entries(HEAD)) {
    assert.equal(typeof value, 'string', `HEAD.${key} is not a string`)
    assert.ok((value as string).length > 0, `HEAD.${key} is empty`)
  }
  const literals = [HEAD.why, HEAD.who, HEAD.whatToDo, HEAD.doneWhen, HEAD.ifWrong, HEAD.comms, HEAD.helpDesk, HEAD.manager, HEAD.risks]
  for (const file of ['src/ui/surfaces/ContentStep.tsx', 'src/ui/surfaces/CleanupStep.tsx']) {
    const src = readFileSync(file, 'utf8')
    for (const lit of literals) {
      assert.doesNotMatch(src, new RegExp(`<h3>${lit}</h3>`), `${file} writes "${lit}" out instead of reading it from stepHeadings.ts`)
    }
  }
})

// ---------------------------------------------------------------------------
// B. Lifecycle and condition stay two things
// ---------------------------------------------------------------------------

test('the lifecycle words and the condition words are two disjoint sets', () => {
  const lifecycle = new Set(Object.values(CONTRACT.lifecycle))
  const condition = new Set(Object.values(CONTRACT.condition))
  for (const w of condition) assert.ok(!lifecycle.has(w), `"${w}" is both a stage and a condition`)
  for (const stage of ['Not deployed', 'Report-only', 'Ready to enforce', 'Enforced']) {
    assert.ok(lifecycle.has(stage), `the rollout lost the stage "${stage}"`)
  }
  for (const c of ['Review required', 'Blocked', 'Needs decision', 'Baseline conflict']) {
    assert.ok(condition.has(c), `the conditions lost "${c}"`)
  }
})

test('no step turns a condition into a rollout stage', () => {
  const lifecycle = new Set<string>([...Object.values(CONTRACT.lifecycle), ''])
  const condition = new Set<string>(Object.values(CONTRACT.condition))
  let held = 0
  for (const { fixture, step, contract } of everyStep()) {
    const where = `${fixture}/${step.id}`
    assert.ok(lifecycle.has(contract.state.stage), `${where}: "${contract.state.stage}" is not a stage`)
    assert.ok(condition.has(contract.state.conditionLabel), `${where}: "${contract.state.conditionLabel}" is not a condition`)
    assert.ok(!condition.has(contract.state.stage), `${where}: the condition "${contract.state.stage}" is being shown as the stage`)
    if (contract.state.condition === 'healthy') continue
    held += 1
    // A condition rides beside the lifecycle; it never replaces it, and the
    // lifecycle underneath is still one of the four (or none, before deployment).
    assert.ok(contract.state.lifecycle === null || Object.keys(CONTRACT.lifecycle).includes(contract.state.lifecycle), `${where}: lifecycle ${String(contract.state.lifecycle)}`)
  }
  assert.ok(held > 0, 'no fixture produces a step in any condition but healthy, so this proves nothing')
})

// ---------------------------------------------------------------------------
// C. Density: what is on the default step, and what is one click away
// ---------------------------------------------------------------------------

test('a check that passes is not on the step; a check that fails is, in its own section', () => {
  let passing = 0
  let failing = 0
  for (const { fixture, step, contract } of everyStep()) {
    const checks = step.checks
    if (!checks || checks.total === 0) continue
    if (checks.failing === 0) {
      passing += 1
      assert.deepEqual(contract.fix.filter((f) => f.key.startsWith('check:')), [], `${fixture}/${step.id}: a step whose checks all pass lists one under Fix before continuing`)
    } else {
      failing += 1
      // Under Fix before continuing, or — for emergency-access hardening — under Hardening recommendations (owner, 2026-09-11).
      assert.ok(contract.fix.length > 0 || (contract.hardening?.groups.length ?? 0) > 0, `${fixture}/${step.id}: ${checks.failing} checks fail and nothing is under Fix before continuing or Hardening recommendations`)
    }
  }
  assert.ok(passing > 0 && failing > 0, `the fixtures no longer cover both (passing ${passing}, failing ${failing})`)
})

test('a step waiting on a person says so as its one action, and never inside More', () => {
  // Every shipped fixture answers the exclusions question, because a tenant
  // without an answer has no policy the plan can write - so the canonical
  // needs-decision case is built here rather than swept for. It used to appear
  // in the sweep by accident: the author's own CA-GlobalExclusions placeholder
  // was classified as the service accounts, and the step that named it waited on
  // a group the tenant had no reason to make (task 022).
  const decisions = [...everyStep(), ...unansweredExclusions()].filter((o) => o.contract.state.condition === 'needs-decision')
  assert.ok(decisions.length > 0, 'no fixture produces a step that needs a decision')
  for (const { fixture, step, contract } of decisions) {
    assert.ok(contract.whatToDo.text.length > 0, `${fixture}/${step.id}: no action text`)
    // The decision is the action, unless Foundation A will not hand the policy
    // over at all — a step whose policy names an object the tenant does not have
    // is not waiting on an answer, and says which authority it is waiting on.
    const overruled = contract.implementation.offered === false && contract.implementation.reason !== null
    assert.ok(contract.whatToDo.kind === 'decide' || (overruled && contract.whatToDo.kind === 'resolve'), `${fixture}/${step.id}: the action is ${contract.whatToDo.kind} and nothing overrules the decision`)
  }
  // The blocker, the action, the question it asks and the completion are all
  // drawn above More in the body, never inside it.
  const src = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  const more = src.indexOf('<More')
  for (const c of ['<WhatToDoLead', '<Decision', '<ReadinessSection', '<DoneWhen']) {
    const at = src.indexOf(c)
    assert.ok(at > 0 && at < more, `${c} must not be inside More`)
  }
})

test('a long list of names leaves its count and its instruction on the step, and only the names go to More', () => {
  let moved = 0
  let kept = 0
  for (const { fixture, step, ex, cs } of everyStep()) {
    const who = (cs.who ?? null) as Record<string, unknown> | null
    if (!who) continue
    const { inline, held } = whoBlocks(who, ex)
    const where = `${fixture}/${step.id}`
    for (const b of inline) {
      assert.ok(b.names.length <= NAMES_INLINE, `${where}: ${b.names.length} names on the default step`)
      kept += b.names.length
    }
    for (const b of held) {
      moved += b.names.length
      // Nothing is only in More: the sentence that carries the count is still on
      // the step, with the same lead, minus the colon that promised the list.
      if (b.key === 'admins' || b.key === 'overlap') continue
      const stub = b.lead.replace(/\s*:\s*$/, '')
      assert.ok(inline.some((i) => i.lead.startsWith(stub)), `${where}: "${stub.slice(0, 60)}" left the default step entirely`)
    }
  }
  assert.ok(moved > 1000, `the fixtures moved only ${moved} names to More; the large tenants used to put thousands on the page`)
  assert.ok(kept > 0, 'a short list of names is a fact and belongs on the step')
})

test('a simple step activates fewer sections than a complex one', () => {
  const sections = (o: Opened): number => {
    const who = (o.cs.who ?? null) as Record<string, unknown> | null
    return [
      o.contract.state.stage !== '' || o.contract.state.condition !== 'healthy',
      o.contract.milestone.line !== null,
      true, // Why
      o.contract.found.length > 0,
      who !== null && whoBlocks(who, o.ex).inline.length > 0,
      true, // What to do
      o.contract.fix.length > 0,
      datesLineFor(o.step, o.cs) !== null,
      true, // Done when
      o.contract.members.length > 1,
    ].filter(Boolean).length
  }
  const all = everyStep()
  const rung = all.find((o) => o.cs.kind === 'ladder')
  const policy = all.find((o) => o.cs.kind === 'policy' && o.contract.found.length > 0 && o.contract.members.length > 0)
  assert.ok(rung && policy, 'the fixtures no longer cover both a ladder rung and a policy step')
  assert.ok(sections(rung) < sections(policy), `a ladder rung draws ${sections(rung)} sections and a policy step ${sections(policy)}`)
})

// ---------------------------------------------------------------------------
// D. Nothing that cannot be done is offered as if it could
// ---------------------------------------------------------------------------

test('a step with no implementation is offered none: no portal lines, no JSON, no dates, no rollback', () => {
  let checked = 0
  for (const o of everyStep()) {
    if (implementationOffered(o.step)) continue
    checked += 1
    const where = `${o.fixture}/${o.step.id}`
    assert.equal(jsonOffered(o.step), false, `${where}: JSON is offered on a step with no implementation`)
    const names = portalNamesFor(o.ctx, o.ex, o.contract.title)
    assert.equal(stepInstructions(o.step, o.cs, o.ex, names).portal, null, `${where}: portal lines on a step with no implementation`)
  }
  assert.ok(checked > 0, 'no fixture produces a step without an implementation')
})

test('the two families the engine words carry no policy rollout, no policy completion and no rollback', () => {
  const families = new Set<string>([...LADDER_ITEMS.map((i) => ladderStepId(i.id)), ...BLOCKER_SUBJECTS.map(blockerStepId)])
  let seen = 0
  for (const o of everyStep()) {
    if (!families.has(o.step.id)) continue
    seen += 1
    const where = `${o.fixture}/${o.step.id}`
    assert.equal(o.contract.implementation.offered, false, `${where}: an implementation is offered for work that is not a policy`)
    // The contract's generic policy fall-throughs, which is what these steps got
    // before they had words of their own.
    for (const line of o.contract.doneWhen) {
      assert.ok(!line.includes('in report-only'), `${where}: "${line}" is a policy's completion on work that is not a policy`)
    }
    assert.notEqual(o.contract.whatToDo.text, 'Make the object this step names.', `${where}: the generic deploy action`)
    assert.equal(datesLineFor(o.step, o.cs), null, `${where}: a rollout date`)
    assert.equal(ifWrongLineFor(o.step, o.cs), null, `${where}: a rollback for a change nobody submits`)
  }
  assert.ok(seen >= LADDER_ITEMS.length, `only ${seen} of these steps appear in the fixtures`)
})

// The export view is the one the calendar, the prompt pack and the grounding
// bundle all speak from. It reads the step's title and Why through the same two
// resolvers the screen does, so a family whose words are the engine's does not
// arrive in an artifact as the string "undefined".
test('every step’s export view carries its own title and why', () => {
  for (const { fixture, step, ctx } of everyStep()) {
    const v = stepExportView(step, ctx)
    const where = `${fixture}/${step.id}`
    assert.equal(v.title, contentTitle(step), `${where}: the artifact and the screen disagree about the title`)
    assert.ok(v.title.length > 0 && v.title !== 'undefined', `${where}: the artifact's title is "${v.title}"`)
    assert.ok(v.why.length > 0, `${where}: the artifact carries no why`)
    assert.doesNotMatch(JSON.stringify(v), /undefined/, `${where}: the export view carries the string "undefined"`)
    assert.doesNotMatch(JSON.stringify(v), HOLE, `${where}: the export view carries a hole`)
  }
})

// ---------------------------------------------------------------------------
// F. The copy is the product's, and it is checked as structure
// ---------------------------------------------------------------------------

test('the words added for the two families are in the product voice', () => {
  const ids = [...LADDER_ITEMS.map((i) => ladderStepId(i.id)), ...BLOCKER_SUBJECTS.map(blockerStepId)]
  const banned = /\b(we recommend|intelligently|effortless|seamless|simply |just click|please note|leverage|unlock the power|best-in-class)\b/i
  for (const id of ids) {
    const cs = stepById[id]
    const lines = [String((cs.whatToDo as { lead?: unknown }).lead), ...((cs.whatToDo as { steps?: string[] }).steps ?? []), ...(cs.doneWhen ?? [])]
    for (const line of lines) {
      assert.doesNotMatch(line, banned, `${id}: "${line}"`)
      assert.doesNotMatch(line, HOLE, `${id}: "${line}" names a variable nothing fills`)
      assert.ok(line.trim().length > 0 && /[.:]$/.test(line.trim()), `${id}: "${line}" is not a finished sentence`)
    }
    assert.ok(typeof cs.learn?.url === 'string' && cs.learn.url.startsWith('https://learn.microsoft.com/'), `${id}: no Learn link`)
  }
})
