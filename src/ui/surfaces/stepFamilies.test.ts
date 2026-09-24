// The six step families, and the one sentence this file exists to hold:
// they are six sets of MODULES through one frame, not six components.
//
// The assertions below are about the modules being self-gating, measured over
// every step every fixture produces rather than over a hand-picked example.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { allFixtures, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'
import { stepVars } from './stepVars.ts'
import { stepInstructions } from './stepInstructions.ts'
import { portalNamesFor } from './stepPortal.ts'
import { CONTRACT, eyebrowOf, implementationEmptyOf, implementationIsCurrent, railOf, stepContract, stepFamily } from './stepContract.ts'
import type { StepFamily } from './stepContract.ts'
import type { StepContract } from './stepContract.ts'
import type { Step } from '../../roadmap/types.ts'
import { enforcesOnRun, operationsOf } from '../../roadmap/operations.ts'

// The opened step's body spans the component and stepBody.ts (A3): the decisions read there.
const CONTENT_STEP = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8') + readFileSync('src/ui/surfaces/stepBody.ts', 'utf8')

type Audited = {
  fixture: string
  step: Step
  family: StepFamily
  contract: StepContract
  channels: number
  decision: boolean
}

/**
 * Every step every fixture produces, with what the opened step would draw.
 *
 * Built once and shared: it walks the whole corpus, and the point of the
 * assertions below is that they hold over ALL of it rather than over an example
 * somebody chose because it worked.
 */
let CACHE: Audited[] | null = null
function audited(): Audited[] {
  if (CACHE) return CACHE
  const out: Audited[] = []
  for (const f0 of allFixtures()) {
    const f = fixture(f0.name)
    const r = runFixture(f)
    const ctx = {
      snapshot: f.snapshot,
      mapping: f.mapping,
      nameOf: (id: string) => r.input.names?.label(id) ?? id,
      signature: 'IT',
      operatorId: f.operatorId,
      now: f.snapshot.asOf,
      groups: f.groups,
    }
    for (const step of r.steps) {
      const cs = (contentStepFor(step) ?? {}) as Record<string, unknown>
      const ex = stepVars(step, ctx as never) as Record<string, unknown>
      const contract = stepContract(step, ctx as never, ex)
      const instr = stepInstructions(step, cs, ex, portalNamesFor(ctx as never, ex, contentTitle(step)))
      const hasPortal = instr.portal !== null && instr.portal.length + instr.before.length > 0
      out.push({
        fixture: f0.name,
        step,
        family: stepFamily(step, (cs.kind as string | undefined) ?? null),
        contract,
        // The two machine channels stand or fall together on Foundation A's one
        // answer, so a step offers 0, 1 or 3.
        channels: (hasPortal ? 1 : 0) + (contract.implementation.offered ? 2 : 0),
        decision: cs.decision !== undefined,
      })
    }
  }
  CACHE = out
  return out
}

const of = (family: StepFamily): Audited[] => audited().filter((a) => a.family === family)

// --------------------------------------------------- the lifecycle is policy's

test('only a policy draws a lifecycle, and every policy state keeps its own', () => {
  // The premise: the corpus reaches every family but the decision one, which is a
  // condition, not a fixture (planVariants.test.ts constructs it).
  const seen = new Set(audited().map((a) => a.family))
  for (const family of ['policy', 'supporting', 'mfa', 'in-place', 'resolution'] as StepFamily[]) {
    assert.ok(seen.has(family), `no fixture produces a ${family} step, so the assertions below prove nothing`)
  }
  for (const a of audited()) {
    // A goal the tenant already delivers draws the lifecycle its policy recorded
    // (the approved In-place variant draws four reached stages); every other
    // family draws none.
    if (a.family === 'policy' || a.family === 'in-place') continue
    assert.equal(a.contract.track.length, 0, `${a.fixture}/${a.step.id}: a ${a.family} step draws a Conditional Access lifecycle`)
  }
  // And the track is the recorded lifecycle wherever it does render.
  const withTrack = audited().filter((a) => a.contract.track.length > 0)
  assert.ok(withTrack.length > 0, 'no step draws a lifecycle, so this proves nothing')
  for (const a of withTrack) {
    assert.equal(a.contract.track.length, 4, `${a.fixture}/${a.step.id}: a partial lifecycle`)
    const at = ['not-deployed', 'report-only', 'ready-to-enforce', 'enforced'].indexOf(String(a.step.state.lifecycle))
    assert.equal(a.contract.track.findIndex((t) => t.current), at, `${a.fixture}/${a.step.id}: the track is not at the recorded lifecycle`)
  }
})

// ------------------------------------------------------- the channels, globally

test('every step in the corpus offers a channel count the capability rule can draw', () => {
  const counts = new Map<number, number>()
  for (const a of audited()) {
    counts.set(a.channels, (counts.get(a.channels) ?? 0) + 1)
    assert.notEqual(a.channels, 2, `${a.fixture}/${a.step.id}: two channels, which Foundation A cannot produce`)
    // Nothing manufactures a machine artifact for work that has none.
    if (a.family === 'in-place' || a.family === 'resolution') {
      assert.equal(a.channels, 0, `${a.fixture}/${a.step.id}: a ${a.family} step offers ${a.channels} channel(s)`)
    }
  }
  assert.ok((counts.get(0) ?? 0) > 0 && (counts.get(1) ?? 0) + (counts.get(3) ?? 0) > 0, `the corpus does not exercise the rule: ${[...counts].join(' ')}`)
})

// ------------------------------------------------------------ the rail is real

test('every family draws the one milestone at the head of its action column, and it is never empty', () => {
  for (const a of audited()) {
    const r = railOf(a.contract)
    // The sub-line is the package's words or nothing (U3); the milestone itself is always there.
    assert.ok(r.metric.trim().length > 0, `${a.fixture}/${a.step.id}: a milestone with nothing in it`)
    assert.equal(r.sub, '', `${a.fixture}/${a.step.id}: the contract composed a sub-line`)
    // A date only where Foundation B holds one; never one it does not.
    // A day the schedule places (roadmap/stepSchedule.ts) is not invented: the row reads the same day.
    const scheduled = a.contract.schedule !== null ? a.contract.schedule.at : null
    if (a.contract.milestone.at === null && scheduled === null) assert.equal(/\d{4}/.test(r.metric), false, `${a.fixture}/${a.step.id}: the rail invents a date`)
  }
})

// ------------------------------------ implementation is not always the action

test('a held policy does not offer the deployment as its current action', () => {
  // The defect this closes: a blocked step said "Clear what this step is waiting
  // on" under What to do and then printed seven numbered steps for creating the
  // policy, with a Download JSON under them. Two instructions at once, and the
  // numbered ones are the louder.
  //
  // Only `healthy` deploys. The condition union is closed, so this is exhaustive
  // rather than a list somebody has to remember to extend.
  for (const condition of ['blocked', 'review-required', 'needs-decision', 'baseline-conflict'] as const) {
    assert.equal(implementationIsCurrent({ state: { condition } } as never), false, `${condition} still offers the deployment`)
  }
  assert.equal(implementationIsCurrent({ state: { condition: 'healthy' } } as never), true, 'a healthy step stopped offering its implementation')
})

test('the capability is untouched: the same channels come back when the condition clears', () => {
  // The gate is on the DISPLAY. Nothing regenerates, nothing is deleted, and
  // `implementation.offered` is not mutated — so the proof is that a step's
  // capability is identical either side of the gate, and only the current
  // offering differs.
  // A held step whose own next action IS the report-only preparation offers it
  // (owner decision, Step 5: a policy created in report-only denies nobody, and
  // "Nothing to submit yet" under "Create the policy in report-only now" was
  // the two-instructions contradiction). Every such step says so as its action,
  // has nothing deployed, and submits nothing that enforces on arrival.
  const preparing = audited().filter((a) => a.contract.implementation.offered && a.step.state.condition !== 'healthy' && implementationIsCurrent(a.step))
  for (const a of preparing) {
    assert.equal(a.contract.whatToDo.kind, 'deploy', `${a.fixture}/${a.step.id}: a held step offers its implementation under an action that is not the preparation`)
    assert.equal(a.step.state.lifecycle, 'not-deployed', `${a.fixture}/${a.step.id}: a deployed held policy offers its implementation`)
    assert.equal(operationsOf(a.step).some(enforcesOnRun), false, `${a.fixture}/${a.step.id}: a held step offers a change that enforces on arrival`)
  }
  const held = audited().filter((a) => a.contract.implementation.offered && a.step.state.condition !== 'healthy' && !implementationIsCurrent(a.step))
  assert.ok(held.length > 0, 'no fixture holds a step that has artifacts, so this proves nothing')
  for (const a of held) {
    assert.equal(a.contract.implementation.offered, true, `${a.fixture}/${a.step.id}: the gate mutated the capability`)
    assert.equal(implementationIsCurrent(a.step), false, `${a.fixture}/${a.step.id}: a held step offers its deployment`)
    // Foundation A still says the artifacts exist; the step is simply not the
    // place to use them today.
    assert.ok(a.channels > 0, `${a.fixture}/${a.step.id}: the capability was lost, not gated`)
  }
  // And the round trip, on a REAL step with real artifacts: clear the condition
  // and the same capability is offered again. Nothing is regenerated — the
  // contract is untouched and only the condition differs — which is the whole
  // claim: the gate is on the display, and it is reversible.
  //
  // The corpus contains no healthy step that has artifacts (every one of them is
  // currently held, mostly on emergency access, which is the first prerequisite
  // in every fixture). So the visible case is proven here rather than from a
  // tenant, and that gap is recorded rather than papered over: no fixture is
  // altered to manufacture it.
  const healthyInCorpus = audited().filter((a) => a.contract.implementation.offered && a.step.state.condition === 'healthy')
  for (const a of healthyInCorpus) assert.ok(a.channels > 0, `${a.step.id}: healthy configuration lost its reference resources`)
  const one = held[0]
  assert.equal(implementationIsCurrent({ ...one.step, state: { ...one.step.state, condition: 'healthy' } } as never), true, 'clearing the condition does not bring the deployment back')
  assert.equal(one.contract.implementation.offered, true, 'the capability was not preserved across the round trip')
})

test('a held policy offers no implementation, and its region says why at the weight of the reason', () => {
  for (const a of audited()) {
    if (a.step.state.condition === 'healthy') continue
    // The owner's one exception (Step 5): the report-only preparation of a held,
    // undeployed policy, offered under the action that says so.
    if (implementationIsCurrent(a.step)) {
      assert.equal(a.contract.whatToDo.kind, 'deploy', `${a.fixture}/${a.step.id}: a held step offers its deployment under another action`)
      continue
    }
    assert.equal(implementationIsCurrent(a.step), false, `${a.fixture}/${a.step.id}: a held step offers its deployment`)
    // The no-action box names the reason; "nothing to generate" is for a step
    // that describes no policy, never for one something is holding.
    assert.notEqual(implementationEmptyOf(a.contract).key, 'none', `${a.fixture}/${a.step.id}: a held step says it has nothing to generate rather than why`)
  }
})

// ------------------------------------------------- already in place is calm

test('a goal the tenant already delivers invents no work', () => {
  const inPlace = of('in-place')
  assert.ok(inPlace.length > 0, 'no in-place step in the corpus')
  for (const a of inPlace) {
    // The lifecycle its policy recorded, and never a rollout in progress: where a
    // track is drawn every stage is reached (the approved In-place variant).
    assert.ok(a.contract.track.length === 0 || a.contract.track.every((t) => t.reached), `${a.fixture}/${a.step.id}: an in-place step drawn mid-rollout`)
    assert.equal(a.channels, 0, `${a.fixture}/${a.step.id}: an in-place step offers an implementation`)
    if (!a.step.state.setAside) {
      const empty = implementationEmptyOf(a.contract)
      assert.deepEqual([empty.key, empty.tone], ['inPlace', 'good'], `${a.fixture}/${a.step.id}: an in-place step does not say no implementation is needed`)
    }
    assert.ok(a.contract.whatToDo.text.length > 0, `${a.fixture}/${a.step.id}: an in-place step has no action line at all`)
    // Done when is drawn on every step, this one included (the approved V4).
    assert.ok(a.contract.doneWhen.length > 0, `${a.fixture}/${a.step.id}: an in-place step has no completion`)
  }
})

// -------------------------------------------------- resolution states the facts

test('a source conflict states the ambiguity and invents no deployment', () => {
  const conflicts = of('resolution')
  assert.ok(conflicts.length > 0, 'no resolution step in the corpus')
  for (const a of conflicts) {
    assert.equal(a.step.state.condition, 'baseline-conflict')
    assert.equal(a.contract.track.length, 0, `${a.fixture}/${a.step.id}: a rollout on an unsettled source`)
    assert.equal(a.channels, 0, `${a.fixture}/${a.step.id}: instructions for a change that cannot be described`)
    assert.equal(a.contract.implementation.offered, false, `${a.fixture}/${a.step.id}: an artifact for an ambiguous source`)
    assert.ok(a.contract.whatToDo.text.length > 0, `${a.fixture}/${a.step.id}: no resolution action`)
  }
  for (const a of conflicts) {
    assert.equal(eyebrowOf(a.contract, 'policy'), CONTRACT.kind.resolution, `${a.fixture}/${a.step.id}: a resolution step is not named one`)
    assert.equal(implementationEmptyOf(a.contract).tone, 'danger', `${a.fixture}/${a.step.id}: the conflict's no-action box is not at the danger weight`)
  }
})

// ------------------------------------------------ decision stays the operator's

test('a detected candidate is not a persisted decision, and the step creates no store', () => {
  // The picker writes through the Plan's own handler, which is the mapping's
  // persistence path. The step neither writes nor invents one.
  assert.match(CONTENT_STEP, /onDecide\?: \(decision: StepDecisionInput\) => void/, 'the step no longer takes the persistence handler')
  for (const forbidden of ['localStorage', 'indexedDB', 'putMapping', 'saveMapping', 'new Map()']) {
    assert.equal(CONTENT_STEP.includes(forbidden), false, `the step persists a decision itself: ${forbidden}`)
  }
})
