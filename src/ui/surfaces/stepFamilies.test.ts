// The six step families, and the one sentence this file exists to hold:
// they are six sets of MODULES through one frame, not six components.
//
// The failure it stops is the one that creeps back in every time a family gets
// a requirement of its own — a `kind === 'decision'` branch that mounts a whole
// second shell, and a Plan that is six pages wearing one header. So the
// assertions below are about the frame being singular and the modules being
// self-gating, measured over every step every fixture produces rather than over
// a hand-picked example.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { allFixtures, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'
import { stepVars } from './stepVars.ts'
import { stepInstructions } from './stepInstructions.ts'
import { portalNamesFor } from './stepPortal.ts'
import { CONTRACT, FOOTER, eyebrowOf, implementationEmptyOf, implementationIsCurrent, railOf, stepContract, stepFamily } from './stepContract.ts'
import type { StepFamily } from './stepContract.ts'
import type { StepContract } from './stepContract.ts'
import type { Step } from '../../roadmap/types.ts'
import { enforcesOnRun, operationsOf } from '../../roadmap/operations.ts'

const CONTENT_STEP = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
const SECTIONS = readFileSync('src/ui/surfaces/StepSections.tsx', 'utf8')
const CONTRACT_SRC = readFileSync('src/ui/surfaces/stepContract.ts', 'utf8')
const HANDOFF = readFileSync('src/ui/surfaces/MfaHandoff.tsx', 'utf8')
const CSS = readFileSync('src/ui/app.css', 'utf8')

const FAMILIES: StepFamily[] = ['policy', 'supporting', 'mfa', 'in-place', 'decision', 'resolution']

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

// ------------------------------------------------------------- one frame

test('every family goes through one frame: there is no second step shell', () => {
  // One article, one head, one body, one footer, one rail — in the file that
  // draws every step there is.
  for (const [what, n] of [['<article className="step', 1], ['<StepHead', 1], ['<StepFooter', 1], ['<StepRail', 1], ['className="step-body has-rail"', 1]] as const) {
    assert.equal(CONTENT_STEP.split(what).length - 1, n, `${what} appears ${CONTENT_STEP.split(what).length - 1} times, not ${n}`)
  }
  // And no branch mounts a whole alternative structure for a family. A module
  // may be conditional and a VALUE may be chosen by kind — `cs.kind === 'policy'
  // ? unavailableReason(step) : null` asks Foundation A a question only a policy
  // has — but a kind must never open JSX. That is the difference between an
  // optional module and a second page.
  for (const m of CONTENT_STEP.matchAll(/kind === '[a-z-]+'\s*(\?|&&)\s*(<|\()/g)) {
    assert.fail(`the step mounts markup on a kind: ${m[0]}`)
  }
  // Nor does the step itself return early with a different tree. Scoped to
  // ContentStep's own body: the file also holds the small components the step
  // composes (the decision primitive, a who-block, More), and each of those
  // rightly has a render of its own.
  const body = CONTENT_STEP.slice(CONTENT_STEP.indexOf('export function ContentStep'), CONTENT_STEP.indexOf('function Implementation({'))
  assert.ok(body.length > 500, 'the step body could not be read')
  assert.equal(body.split('return (').length - 1, 1, 'the step has more than one render path')
})

test('the family is a reading, not a switch: nothing selects a layout from it', () => {
  // `stepFamily` exists for the audit and for these tests. If a component ever
  // starts branching on it, the six-modules-one-frame claim stops being true
  // and this is where that shows up.
  for (const [file, src] of [['ContentStep.tsx', CONTENT_STEP], ['StepSections.tsx', SECTIONS]] as const) {
    assert.equal(src.includes('stepFamily'), false, `${file} branches on the family instead of on the module's own truth`)
  }
})

test('no family is detected from a title, anywhere in the projection', () => {
  const body = CONTRACT_SRC.slice(CONTRACT_SRC.indexOf('export function stepFamily'), CONTRACT_SRC.indexOf('export function stepFamily') + 900)
  for (const heuristic of ['title', 'includes(', 'match(', 'toLowerCase']) {
    assert.equal(body.includes(heuristic), false, `the family projection reads ${heuristic}`)
  }
  // It reads the recorded state and the content kind, and that is all.
  assert.match(body, /step\.state/, 'the family is not read off the recorded state')
})

test('the corpus exercises every family the manifest calls migrated', () => {
  const manifest = JSON.parse(readFileSync('docs/design/approved/reference/REFERENCE-MANIFEST.json', 'utf8')) as {
    planStep: { families: Record<string, string> }
  }
  for (const [name, status] of Object.entries(manifest.planStep.families)) {
    if (name.startsWith('$')) continue
    assert.equal(status, 'migrated', `${name} is not migrated`)
  }
  const seen = new Set(audited().map((a) => a.family))
  // The decision family is a condition, not a fixture: `needs-decision` is what
  // a tenant looks like before somebody answers, and the corpus's fixtures are
  // answered. planVariants.test.ts constructs the unanswered variants and proves
  // the decision presentation there; this only records which families the plain
  // corpus reaches, so a later reader is not misled by a silent gap.
  for (const family of ['policy', 'supporting', 'mfa', 'in-place', 'resolution'] as StepFamily[]) {
    assert.ok(seen.has(family), `no fixture produces a ${family} step, so its assertions below prove nothing`)
  }
})

// --------------------------------------------------- the lifecycle is policy's

test('only a policy draws a lifecycle, and every policy state keeps its own', () => {
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

test('every family draws the one Next milestone rail, and it is never empty', () => {
  for (const a of audited()) {
    const r = railOf(a.contract)
    assert.ok(r.metric.trim().length > 0 && r.sub.trim().length > 0, `${a.fixture}/${a.step.id}: a rail with nothing in it`)
    // A date only where Foundation B holds one; never one it does not.
    if (a.contract.milestone.at === null) assert.equal(/\d{4}/.test(r.metric), false, `${a.fixture}/${a.step.id}: the rail invents a date`)
  }
  assert.equal(CONTENT_STEP.split('<StepRail contract={contract} />').length - 1, 1, 'the rail is gated, or drawn twice')
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
  assert.equal(healthyInCorpus.length, 0, 'a fixture now produces a healthy step with artifacts — give it a plate and delete this note')
  const one = held[0]
  assert.equal(implementationIsCurrent({ ...one.step, state: { ...one.step.state, condition: 'healthy' } } as never), true, 'clearing the condition does not bring the deployment back')
  assert.equal(one.contract.implementation.offered, true, 'the capability was not preserved across the round trip')
})

test('the step gates the display and never the artifact', () => {
  // The gate is one boolean over one condition, applied to the channel list. The
  // JSON and the commands are still built by the modules that built them.
  assert.match(CONTENT_STEP, /const deployNow = implementationIsCurrent\(step\)/, 'the step decides for itself when to deploy')
  assert.match(CONTENT_STEP, /const channels = deployNow \? channelsFor\(/, 'the gate is not applied to the channel list')
  assert.match(CONTENT_STEP, /: channels\.map\(\(ch\) => \(\{ id: ch,/, 'the implementation region is not built from the gated channel list')
  assert.match(CONTENT_STEP, /<Implementation\n\s*artifacts=\{artifacts\}/, 'the implementation region is not handed the artifacts')
  // Nothing writes to the capability.
  assert.equal(CONTENT_STEP.includes('implementation.offered ='), false, 'the step mutates Foundation A’s answer')
  // And no title decides any of it.
  for (const heuristic of ['title.includes', 'title.match', 'title.toLowerCase']) {
    assert.equal(CONTENT_STEP.includes(heuristic), false, `the gate reads a title: ${heuristic}`)
  }
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
  // The rail is the Next milestone only: it names no channel on any step.
  const rail = SECTIONS.slice(SECTIONS.indexOf('export function StepRail'), SECTIONS.indexOf('export function StepFooter'))
  assert.equal(/railChannels|side-list|implementation/.test(rail), false, 'the rail advertises implementation channels')
})

// ------------------------------------------------------------------ the footer

test('the footer offers the rollout exception where the step is excludable, and the existing scan', () => {
  const footer = SECTIONS.slice(SECTIONS.indexOf('export function StepFooter'), SECTIONS.indexOf('/** A tile'))
  assert.match(footer, /\{onScan && \(/, 'the scan is drawn without the handler it presses')
  assert.equal(/onClose|disabled/.test(footer), false, 'the footer closes the step or keeps a disabled control; the row closes it')
  assert.deepEqual(Object.keys(FOOTER), ['scan'], 'the footer grew words the approved footer does not carry')
  // The exception is the existing skip, offered only on a step the content marks
  // excludable, and it records the operator's own reason.
  assert.match(CONTENT_STEP, /cs\.skip \? <Button key="exclude"/, 'the exception is offered on a step the content does not mark excludable')
  assert.match(CONTENT_STEP, /onConfirm=\{\(r\) => \{ closeDialog\(\); onSkip\(r\) \}\}/, 'the exception is not the existing skip with the operator’s reason')
  assert.match(CONTENT_STEP, /disabled=\{given\.length === 0\}/, 'the exception can be recorded without a reason')
  assert.match(CONTENT_STEP, /onScan=\{printing \? null : \(onScan \?\? null\)\}/, 'the footer is not handed the scan it was given')
})

// --------------------------------------------------- the board's mobile controls

test('every Plan control stays whole at the narrow width', () => {
  // "Show completed" used to sit half off the edge of a 390px screen: the focus
  // row scrolled sideways with nothing to say there was more. A control the
  // operator cannot see is a control they do not have.
  const narrow = CSS.slice(CSS.indexOf('@media (max-width: 650px)'))
  const focuses = narrow.slice(narrow.indexOf('.plan-controls .focuses {'))
  const rule = focuses.slice(0, focuses.indexOf('}'))
  assert.match(rule, /flex-wrap: wrap;/, 'the focus row still scrolls instead of wrapping')
  assert.equal(/overflow-x:\s*auto/.test(rule), false, 'the focus row still hides controls behind a scroll')
  const button = narrow.slice(narrow.indexOf('.plan-controls .focus {'))
  const brule = button.slice(0, button.indexOf('}'))
  assert.match(brule, /white-space: normal;/, 'a long label is still clipped rather than wrapped')
  assert.equal(/display:\s*none/.test(brule), false, 'a control is hidden at the narrow width')
  // And nothing shrank below the board's compact floor to make room.
  assert.equal(/font-size:\s*(?!var\(--t-micro\))[0-9]/.test(brule), false, 'the control text was shrunk to a raw size')
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
  assert.equal(/showsDoneWhen|<DoneWhen[^>]*&&/.test(CONTENT_STEP), false, 'Done when is withheld from a step again')
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
  // The notice is the approved danger attention under Readiness, above What to
  // do and Implementation, and never behind a disclosure.
  const main = CONTENT_STEP.slice(CONTENT_STEP.indexOf('<div className="step-main">'), CONTENT_STEP.indexOf('{printing && ('))
  const at = main.indexOf('conflictWords && (')
  assert.ok(at > main.indexOf('<ReadinessSection'), 'the conflict notice is above Readiness')
  assert.ok(at < main.indexOf('<Implementation'), 'the conflict notice sank below Implementation')
  for (const a of conflicts) {
    assert.equal(eyebrowOf(a.contract, 'policy'), CONTRACT.kind.resolution, `${a.fixture}/${a.step.id}: a resolution step is not named one`)
    assert.equal(implementationEmptyOf(a.contract).tone, 'danger', `${a.fixture}/${a.step.id}: the conflict's no-action box is not at the danger weight`)
  }
})

// ------------------------------------------------------- MFA hands off, it does not recompute

test('the MFA preview consumes existing readiness truth and computes none of its own', () => {
  // Every word in a preview row is one of MFA Readiness's own four projections,
  // so the Plan and the page cannot describe one person differently.
  for (const cell of ['roleWord', 'methodsCell', 'readinessWord', 'actionOf']) {
    assert.ok(HANDOFF.includes(cell), `the preview writes its own ${cell}`)
  }
  assert.match(HANDOFF, /from '\.\/readinessCells\.ts'/, 'the preview does not read the shared cell projections')
  // The hold, the ids and the rows all come from the derive layer.
  assert.match(HANDOFF, /stepMfaHold\(step, scored\)/, 'the step decides its own hold')
  assert.match(HANDOFF, /readinessView\(snapshot, snapshot\.asOf, mapping\)/, 'the preview builds its own view')
  // It may CALL the derive layer — `scoredPeople` and `readinessView` are the
  // authority — but it may not do the arithmetic itself.
  for (const forbidden of ['rung >', '>= 0.9', 'Math.', 'new Date(', '.reduce(', 'percent']) {
    assert.equal(HANDOFF.includes(forbidden), false, `the handoff computes ${forbidden} instead of reading the derive layer`)
  }
})

test('the preview is bounded and the total is never the bound', () => {
  assert.match(HANDOFF, /const PREVIEW = 3/, 'the preview is unbounded or the bound moved')
  assert.match(HANDOFF, /\.slice\(0, PREVIEW\)/, 'the preview is not bounded by the constant')
  // The count in the handoff line is the hold's own length, not the bound.
  assert.match(HANDOFF, /const n = hold\.ids === null \? null : hold\.ids\.length/, 'the count is not the hold’s')
  assert.match(HANDOFF, /fillText\(P\.mfaReadinessHold, \{ n \}\)/, 'the handoff line does not carry the real total')
  // No name, no number, written down.
  assert.equal(/['"][A-Z][a-z]+ [A-Z][a-z]+['"]/.test(HANDOFF), false, 'a person’s name is hardcoded in the handoff')
  assert.equal(/\bof 7\b|\bof 3\b/.test(HANDOFF), false, 'an example count is hardcoded')
  // And the way to the page that owns the rest.
  assert.match(HANDOFF, /readinessStepHref\(step\.id\)/, 'the handoff does not reuse the existing route')
})

test('the full person-by-person view stays on MFA Readiness', () => {
  // The Plan previews; it does not become a second readiness table. The page's
  // own table is the one that lists everybody.
  const readiness = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')
  assert.match(readiness, /readinessView\(/, 'MFA Readiness no longer builds the person view')
  assert.equal(CONTENT_STEP.includes('readinessView('), false, 'the opened step builds a person view of its own')
  assert.equal(CONTENT_STEP.includes('scoredPeople('), false, 'the opened step scores people of its own')
})

// ------------------------------------------------ decision stays the operator's

test('a detected candidate is not a persisted decision, and the step creates no store', () => {
  // The picker writes through the Plan's own handler, which is the mapping's
  // persistence path. The step neither writes nor invents one.
  assert.match(CONTENT_STEP, /onDecide\?: \(decision: StepDecisionInput\) => void/, 'the step no longer takes the persistence handler')
  assert.match(CONTENT_STEP, /<Decision d=\{d\} ex=\{ex\} saved=\{decision\} onDecide=\{onDecide\}/, 'the decision primitive is not handed the saved decision and the handler')
  for (const forbidden of ['localStorage', 'indexedDB', 'putMapping', 'saveMapping', 'new Map()']) {
    assert.equal(CONTENT_STEP.includes(forbidden), false, `the step persists a decision itself: ${forbidden}`)
  }
  // Detected is not confirmed: the picker's rows are candidates, and Save is the
  // operator action that turns them into a decision.
  assert.match(CONTENT_STEP, /const rows: string\[\] = key \? \(ex\[key\] as string\[\]\) : \[\]/, 'the candidate rows are no longer the scan’s nominations')
})

// ------------------------------------------------------- supporting stays small

test('supporting work is not dressed as a rollout', () => {
  const supporting = of('supporting')
  assert.ok(supporting.length > 0, 'no supporting step in the corpus')
  for (const a of supporting) {
    assert.equal(a.contract.track.length, 0, `${a.fixture}/${a.step.id}: supporting work on a Conditional Access lifecycle`)
    assert.ok(a.contract.whatToDo.text.length > 0, `${a.fixture}/${a.step.id}: supporting work with no action`)
  }
})

test('the corpus reaches 0 and 3 channels, and a strip never has one tab', () => {
  // An honest record rather than a silent gap. The portal translator runs for
  // policy steps, and the two machine channels stand or fall together on
  // Foundation A's one answer — so every step in the corpus offers either all
  // three or none, and NO fixture produces exactly one.
  //
  // The one-channel branch is still real and still reachable: a policy step with
  // portal lines whose artifacts Foundation A withholds renders it. It is proven
  // here against the rule rather than against a tenant, and the gap is written
  // down so a later reader does not mistake "never seen" for "never happens".
  const counts = new Map<number, number>()
  for (const a of audited()) counts.set(a.channels, (counts.get(a.channels) ?? 0) + 1)
  assert.deepEqual([...counts.keys()].sort((x, y) => x - y), [0, 3], `the corpus's channel counts changed: ${[...counts].join(' ')}`)
  // The rule itself, at each of the three cases.
  const rule = CONTENT_STEP.slice(CONTENT_STEP.indexOf('function channelsFor'), CONTENT_STEP.indexOf('function channelsFor') + 700)
  assert.match(rule, /if \(hasPortal\) out\.push\('portal'\)/)
  assert.match(rule, /if \(machineOffered\) out\.push\('ps', 'json'\)/)
  // AI Info joins any channel set and never stands alone, so a strip always holds
  // a choice; a step with no channel draws the no-action box, never an empty strip.
  assert.match(rule, /if \(out\.length > 0\) out\.push\('ai'\)/, 'AI Info can stand alone or is never offered')
  assert.match(CONTENT_STEP, /artifacts\.length === 0 \? \(\n\s*<ImplementationEmptyBox/, 'a step with no channel draws an empty strip')
})
