// The policy rollout family: one renderer, six states.
//
// A policy step is the same object at six different moments — not deployed,
// blocked before deployment, in report-only, in report-only with something to
// review, ready to enforce, and enforced. The failure this file exists to stop
// is the obvious one: six branches, or six components, each drifting until the
// same tenant reads differently depending which moment it is caught in.
//
// So the assertions below are shape assertions over the CONTRACT, measured on
// synthetic steps that carry nothing but the state fields production already
// writes. They prove the projection restates Foundation B and never recomputes
// it: no readiness, no scheduling, no lifecycle arithmetic, and nothing read off
// a title.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import type { Step } from '../../roadmap/types.ts'
import type { Lifecycle } from '../../roadmap/lifecycle.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { CONTRACT, badgeLabel, nextCaption, railOf, stepTrack as trackFor } from './stepContract.ts'
import { absoluteDate } from '../../copy/dates.ts'

import type { ContractStage, StepContract } from './stepContract.ts'

const CONTENT_STEP = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
const SECTIONS = readFileSync('src/ui/surfaces/StepSections.tsx', 'utf8')
const CSS = readFileSync('src/ui/app.css', 'utf8')

/** The six moments, by the two fields production writes for each. */
const MATRIX = [
  { key: 'not-deployed', lifecycle: 'not-deployed' as Lifecycle, condition: 'healthy', status: 'ready', reached: [false, false, false, false], current: 0 },
  { key: 'blocked', lifecycle: 'not-deployed' as Lifecycle, condition: 'blocked', status: 'blocked', reached: [false, false, false, false], current: 0 },
  { key: 'report-only', lifecycle: 'report-only' as Lifecycle, condition: 'healthy', status: 'in-report-only', reached: [true, false, false, false], current: 1 },
  { key: 'review-required', lifecycle: 'report-only' as Lifecycle, condition: 'review-required', status: 'in-report-only', reached: [true, false, false, false], current: 1 },
  { key: 'ready-to-enforce', lifecycle: 'ready-to-enforce' as Lifecycle, condition: 'healthy', status: 'ready-to-enforce', reached: [true, true, false, false], current: 2 },
  { key: 'enforced', lifecycle: 'enforced' as Lifecycle, condition: 'healthy', status: 'done', reached: [true, true, true, true], current: 3 },
] as const

const stepAt = (m: (typeof MATRIX)[number]): Step =>
  ({
    id: `s-${m.key}`,
    status: m.status,
    state: { lifecycle: m.lifecycle, condition: m.condition, satisfied: m.key === 'enforced', inPlace: false, setAside: false, members: [] },
  }) as unknown as Step

const contractAt = (m: (typeof MATRIX)[number], over: Partial<StepContract> = {}): StepContract =>
  ({
    state: { stage: STAGE_WORD[m.lifecycle], condition: m.condition, conditionLabel: CONDITION_WORD[m.condition], word: 'x', tone: 'ok' },
    fix: [],
    ...over,
  }) as unknown as StepContract

const STAGE_WORD: Record<string, string> = {
  'not-deployed': 'Not deployed',
  'report-only': 'Report-only',
  'ready-to-enforce': 'Ready to enforce',
  enforced: 'Enforced',
}
const CONDITION_WORD: Record<string, string> = {
  healthy: 'Healthy',
  blocked: 'Blocked',
  'review-required': 'Review required',
  'needs-decision': 'Needs decision',
}

// ------------------------------------------------------------- one renderer

test('one renderer draws all six policy states: there is no component per state', () => {
  // The frame is one `<article className="step …">` with one head, one body and
  // one footer. Six states means six sets of VALUES through it, never six
  // components — which is how the same tenant ends up reading differently
  // depending on which moment it is caught in.
  assert.equal(CONTENT_STEP.split('<article className="step').length - 1, 1, 'the step frame is drawn more than once')
  assert.equal(CONTENT_STEP.split('<StepHead').length - 1, 1, 'more than one head')
  assert.equal(CONTENT_STEP.split('<StepFooter').length - 1, 1, 'more than one footer')
  assert.equal(CONTENT_STEP.split('<StepRail').length - 1, 1, 'more than one rail')
  // And no branch anywhere in the step names a lifecycle stage to decide what to
  // draw: the frame renders the contract, and the contract carries the stage.
  for (const named of ["=== 'report-only'", "=== 'ready-to-enforce'", "=== 'not-deployed'", "=== 'enforced'"]) {
    assert.equal(CONTENT_STEP.includes(named), false, `the step branches on ${named} instead of rendering the contract`)
  }
})

test('the presentation computes no lifecycle, readiness or schedule of its own', () => {
  for (const [file, src] of [['ContentStep.tsx', CONTENT_STEP], ['StepSections.tsx', SECTIONS]] as const) {
    for (const forbidden of ['projectStatus', 'heldForReview(', 'readyWhen(', 'implementationOffered(', 'jsonOffered(', 'Date.now', 'new Date(']) {
      assert.equal(src.includes(forbidden), false, `${file} computes ${forbidden}: the contract already answered it`)
    }
  }
  // And nothing reads a title to decide anything.
  for (const heuristic of ['title.includes', 'title.match', 'title.toLowerCase']) {
    assert.equal(CONTENT_STEP.includes(heuristic), false, `the step renders from its title: ${heuristic}`)
  }
})

// ------------------------------------------------------------ the state matrix

test('the lifecycle track is the recorded lifecycle, at every one of the six states', () => {
  for (const m of MATRIX) {
    const track = trackFor(stepAt(m))
    assert.deepEqual(track.map((t: ContractStage) => t.label), ['Not deployed', 'Report-only', 'Ready to enforce', 'Enforced'], `${m.key}: the four stages moved`)
    assert.deepEqual(track.map((t: ContractStage) => t.reached), [...m.reached], `${m.key}: the track claims progress the lifecycle has not made`)
    assert.equal(track.findIndex((t: ContractStage) => t.current), m.current, `${m.key}: the track is at the wrong stage`)
    // Every stage label is real text a screen reader reads in order; the bar is
    // the picture of the same fact and is hidden from it.
    for (const t of track) assert.ok(t.label.trim().length > 0, `${m.key}: a stage with no name`)
  }
})

test('the badge composes the two axes without collapsing them, at every state', () => {
  for (const m of MATRIX) {
    const label = badgeLabel(contractAt(m))
    assert.ok(label.startsWith(STAGE_WORD[m.lifecycle]), `${m.key}: the badge does not lead with the lifecycle`)
    if (m.condition === 'healthy') {
      // A condition that is simply fine says nothing: "Report-only · Healthy"
      // reads as a claim, and its absence is already the claim.
      assert.equal(label, STAGE_WORD[m.lifecycle], `${m.key}: the badge asserts a healthy condition`)
    } else {
      assert.equal(label, `${STAGE_WORD[m.lifecycle]} · ${CONDITION_WORD[m.condition]}`, `${m.key}: the badge lost the condition`)
    }
  }
  // A step with no lifecycle at all — a prerequisite, a check, a Cleanup row —
  // has no stage to compose and shows the one status word it always had.
  const noStage = { state: { stage: '', condition: 'healthy', conditionLabel: 'Healthy', word: 'Ready', tone: 'ok' } } as unknown as StepContract
  assert.equal(badgeLabel(noStage), 'Ready')
})

test('lifecycle and condition stay two fields: nothing merges them into one enum', () => {
  const contract = readFileSync('src/ui/surfaces/stepContract.ts', 'utf8')
  assert.match(contract, /const LIFECYCLE_ORDER: Lifecycle\[\] = \['not-deployed', 'report-only', 'ready-to-enforce', 'enforced'\]/, 'the lifecycle order left the contract')
  // The composed label is display only. The two fields, and the one status word
  // every other surface reads, are all still on the contract.
  assert.match(contract, /export function badgeLabel/, 'the composition is not a named projection')
  const compose = contract.slice(contract.indexOf('export function badgeLabel'))
  for (const field of ['s.stage', 's.condition', 's.conditionLabel', 's.word']) {
    assert.ok(compose.includes(field), `badgeLabel no longer reads ${field}`)
  }
})

test('every policy state the fixtures actually produce renders from recorded state, not from a title', () => {
  let seen = new Set<string>()
  for (const name of ['demo', 'demo-week2', 'getiamai'] as const) {
    for (const s of runFixture(fixture(name)).steps) {
      if ((contentStepFor(s) as { kind?: string } | undefined)?.kind !== 'policy') continue
      const track = trackFor(s)
      if (track.length === 0) continue
      seen.add(`${s.state.lifecycle}/${s.state.condition}`)
      // The track's current stage is the recorded lifecycle's own index. A
      // condition never moves it: a blocked report-only policy is still in
      // report-only.
      const at = ['not-deployed', 'report-only', 'ready-to-enforce', 'enforced'].indexOf(String(s.state.lifecycle))
      assert.equal(track.findIndex((t: ContractStage) => t.current), at, `${name}/${s.id}: the track is not at the recorded lifecycle`)
    }
  }
  assert.ok(seen.size >= 3, `only ${seen.size} lifecycle/condition pairs across the fixtures: ${[...seen].join(', ')}`)
})

// ---------------------------------------------------------------- the channels

test('the implementation control follows the capability: none, one, or a real tab set', () => {
  // The rule, read out of the projection rather than described: no selector
  // where there is nothing to select, the channel itself where there is one, and
  // tabs only where there is a choice.
  const fn = CONTENT_STEP.slice(CONTENT_STEP.indexOf('function channelsFor'), CONTENT_STEP.indexOf('function channelsFor') + 700)
  assert.match(fn, /if \(hasPortal\) out\.push\('portal'\)/, 'the portal channel is not read from the translator')
  assert.match(fn, /if \(machineOffered\) out\.push\('ps', 'json'\)/, 'the machine channels are not read from Foundation A')
  // Availability is production's answer, asked once. The surface must not ask
  // Foundation A again under another name — these two ARE that answer, and the
  // contract already carries it as `implementation.offered`.
  //
  // `unavailableReason` is deliberately not on this list: it answers a different
  // question (WHY an implementation is withheld, for the reason line), it
  // predates this pass, and the channel rule does not consult it.
  for (const forbidden of ['implementationOffered(', 'jsonOffered(']) {
    assert.equal(CONTENT_STEP.includes(forbidden), false, `the surface asks ${forbidden} instead of reading the contract`)
  }
  assert.match(CONTENT_STEP, /channelsFor\([\s\S]{0,120}contract\.implementation\.offered\)/, 'the channel rule does not read the contract’s one answer')
  // AI Info joins any channel that exists, so the strip always holds a choice,
  // and a step with none draws the one no-action box instead of a strip.
  assert.match(fn, /if \(out\.length > 0\) out\.push\('ai'\)/, 'AI Info is offered alone, or not beside the channels')
  assert.match(CONTENT_STEP, /artifacts\.length === 0 \? \(\n\s*<ImplementationEmptyBox/, 'no channel draws an empty strip')
})

test('the channel order is Entra, PowerShell, JSON, AI Info, then Email, among the channels that exist', () => {
  const list = CONTENT_STEP.slice(CONTENT_STEP.indexOf('const CHANNEL_TABS'), CONTENT_STEP.indexOf('const CHANNEL_TABS') + 400)
  const ids = [...list.matchAll(/id: '([a-z]+)'/g)].map((m) => m[1])
  assert.deepEqual(ids, ['portal', 'ps', 'json', 'ai', 'email'], 'the canonical channel order moved')
  // The strip is the canonical order FILTERED by what is available, so removing
  // a channel can never reorder the ones that remain.
  assert.match(CONTENT_STEP, /CHANNEL_TABS\.filter\(\(t\) => ids\.includes\(t\.id as Channel\)\)/, 'the strip is built from something other than the canonical order')
})

test('every policy step in the fixtures offers a channel count the rule can draw', () => {
  const counts = new Map<number, number>()
  for (const name of ['demo', 'getiamai'] as const) {
    for (const s of runFixture(fixture(name)).steps) {
      if ((contentStepFor(s) as { kind?: string } | undefined)?.kind !== 'policy') continue
      // The two machine channels stand or fall together on Foundation A's one
      // answer, so a step offers 0, 1 or 3 — never 2.
      const n = s.action.json ? 3 : 1
      counts.set(n, (counts.get(n) ?? 0) + 1)
      assert.notEqual(n, 2, `${name}/${s.id}: a step offers exactly two channels, which Foundation A cannot produce`)
    }
  }
  assert.ok(counts.size >= 1, 'no policy step in any fixture, so this proves nothing')
})

// ----------------------------------------------------------------- the footer

test('the footer carries the rollout exception and the scan, and nothing it cannot act on', () => {
  assert.match(CONTENT_STEP, /<StepFooter controls=\{exceptions\.length > 0 \? exceptions : null\} onScan=\{printing \? null : \(onScan \?\? null\)\} \/>/, 'the footer is not handed the exception and the scan')
  // A disabled button kept for symmetry is a control that teaches the operator
  // to ignore the footer, and a footer with nothing to offer is not drawn.
  const footer = SECTIONS.slice(SECTIONS.indexOf('export function StepFooter'), SECTIONS.indexOf('/** A tile'))
  assert.match(footer, /\{onScan && \(/, 'the scan control is unconditional')
  assert.match(footer, /if \(!controls && !onScan\) return null/, 'an empty footer is drawn')
  assert.equal(/disabled|onClose/.test(footer), false, 'the footer keeps a disabled control, or closes the step the row closes')
})

// ------------------------------------------------------------- the frame shape

test('the header is full width and the two-column split begins below it', () => {
  // The head is a sibling of the body, not a row inside it: the lifecycle track
  // spans the whole frame rather than being squeezed into the main column beside
  // a 290px rail.
  const frame = CONTENT_STEP.slice(CONTENT_STEP.indexOf('<article className="step'), CONTENT_STEP.indexOf('</article>'))
  assert.ok(frame.indexOf('<StepHead') < frame.indexOf('<div className="step-body has-rail">'), 'the head is not above the body')
  assert.ok(frame.indexOf('</StepHead>') < frame.indexOf('<div className="step-body has-rail">'), 'the head is inside the body')
  assert.equal(/step-body[\s\S]{0,400}<StepHead/.test(frame), false, 'the head was drawn inside the split')
  // The footer is the frame's, under both columns.
  assert.ok(frame.indexOf('<StepFooter') > frame.indexOf('<StepRail contract'), 'the footer is inside the body')
})

test('every step has the Next milestone rail beside its main column', () => {
  // The approved rail is Next milestone only, and every step has a next
  // milestone, so the rail is never optional and never empty.
  assert.match(CONTENT_STEP, /<div className="step-body has-rail">/, 'the body does not lay out the rail')
  assert.match(CONTENT_STEP, /<StepRail contract=\{contract\} \/>/, 'the rail is gated')
  const one = CSS.match(/\.step-body \{[^}]*\}/)?.[0] ?? ''
  const two = CSS.match(/\.step-body\.has-rail \{[^}]*\}/)?.[0] ?? ''
  assert.match(one, /grid-template-columns: minmax\(0, 1fr\);/, 'a step with no rail leaves an empty column')
  assert.match(two, /grid-template-columns: minmax\(0, 1fr\) 290px;/, 'the rail is not 290px')
})

test('the footer is the frame’s own band, not the last line of the main column', () => {
  const rule = CSS.match(/\.step-footer \{[^}]*\}/)?.[0] ?? ''
  assert.match(rule, /border-top: 1px solid var\(--line\);/, 'the footer is not divided from the step')
  assert.match(rule, /background: var\(--secondary-surface\);/, 'the footer is not on the quieter surface')
  assert.match(CSS, /\.step-footer \.step-footer-scan \{\n\s*margin-left: auto;/, 'the scan is not held to the end')
  // And it collapses with the rest of the frame at the pack's second breakpoint.
  const narrow = CSS.slice(CSS.indexOf('@media (max-width: 650px)'))
  assert.match(narrow, /\.step-head,\n\s*\.step-main,\n\s*\.step-footer \{/, 'the footer keeps a desktop inset on a phone')
})

// ------------------------------------- the lifecycle spans the whole header

test('the lifecycle track spans the header and is held by no reading measure', () => {
  // The defect: `.surface p, .surface ul, .surface ol` caps everything it
  // matches at --measure (72ch), which is right for a paragraph and wrong for a
  // grid. The track is an <ol>, so it was caught and stopped at about 45% of the
  // frame — four stages crushed into the left half of a full-width header.
  for (const sel of ['.step .track', '.step .track-wrap']) {
    const at = CSS.indexOf(`${sel} {`)
    assert.ok(at > 0, `${sel} has no rule`)
    const r = CSS.slice(at, CSS.indexOf('}', at))
    assert.match(r, /max-width: none;/, `${sel} is still held to the prose measure`)
  }
  // And the cap it is escaping is real, so the assertion above is not vacuous.
  assert.match(CSS, /\.surface p,\n\.surface ul,\n\.surface ol \{[^}]*max-width: var\(--measure\);/, 'the prose measure this escapes is gone')
  // The measure still holds the sentences in the head: the Next caption is a
  // paragraph and wants it.
  assert.equal(/\.step-next \{[^}]*max-width: none/.test(CSS), false, 'the Next caption escaped the reading measure with the track')
})

test('the track is the header’s, never the main column’s and never the rail’s', () => {
  const head = SECTIONS.slice(SECTIONS.indexOf('export function StepHead'), SECTIONS.indexOf('export function LifecycleTrack'))
  assert.match(head, /<LifecycleTrack track=\{track\} \/>/, 'the head no longer draws the track')
  assert.match(head, /<header className="step-head">/, 'the track is not inside the full-width header')
  // Not in the body, not in the rail: the frame renders the head, then the split.
  const main = CONTENT_STEP.slice(CONTENT_STEP.indexOf('<div className="step-main">'), CONTENT_STEP.indexOf('<StepRail contract'))
  assert.equal(main.includes('LifecycleTrack'), false, 'the track moved into the main column')
  const rail = SECTIONS.slice(SECTIONS.indexOf('export function StepRail'), SECTIONS.indexOf('export function PolicyMembers'))
  assert.equal(rail.includes('LifecycleTrack'), false, 'the track moved into the rail')
  // The split still begins below the header, and the rail is still optional.
  assert.match(CSS.match(/\.step-body\.has-rail \{[^}]*\}/)?.[0] ?? '', /grid-template-columns: minmax\(0, 1fr\) 290px;/)
  assert.match(CSS.match(/\.step-body \{[^}]*\}/)?.[0] ?? '', /grid-template-columns: minmax\(0, 1fr\);/)
  // And it collapses with the rest of the frame at both approved breakpoints.
  for (const w of [940, 650]) assert.ok(CSS.includes(`@media (max-width: ${w}px)`), `the ${w} breakpoint is gone`)
  const narrow = CSS.slice(CSS.indexOf('@media (max-width: 940px)'), CSS.indexOf('@media (max-width: 650px)'))
  assert.match(narrow, /\.step-body\.has-rail \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/, 'the body no longer collapses at 940')
})

// ------------------------------------------------------------ the Next caption

test('the Next caption is the dated milestone where there is one', () => {
  const dated = { milestone: { line: 'Next: leave it in report-only until Sep 17, 2026.', at: '2026-09-17', gatedBy: null } } as unknown as StepContract
  assert.equal(nextCaption(dated), 'Next: leave it in report-only until Sep 17, 2026.')
})

test('an undated blocked policy carries no caption: the rail names the move and Fix before continuing the blocker', () => {
  // Owner, 2026-09-11: one blocker, one place. The gate stays the row's reason
  // and Fix before continuing's; the caption restating it is gone.
  const gated = { milestone: { line: null, at: null, gatedBy: 'after: Create or Correct Emergency Access Accounts', kind: 'resolve', label: 'Clear what this step is waiting on.' }, state: { condition: 'blocked', setAside: false }, whatToDo: { kind: 'resolve', text: 'x' } } as unknown as StepContract
  assert.equal(nextCaption(gated), null)
  assert.equal(railOf(gated).sub, CONTRACT.rail.resolveSub, 'the rail restates the blocker instead of naming the move')
})

test('a state with no dated line gets no caption, and none is invented', () => {
  const bare = { milestone: { line: null, at: null, gatedBy: null } } as unknown as StepContract
  assert.equal(nextCaption(bare), null, 'a caption was manufactured for a step with no next fact')
  // The projection reads one field and computes nothing.
  const src = readFileSync('src/ui/surfaces/stepContract.ts', 'utf8')
  const from = src.indexOf('export function nextCaption')
  const body = src.slice(from, src.indexOf('\n}', from)).replace(/\/\/.*$/gm, '')
  for (const forbidden of ['Date', 'absoluteDate', 'title', 'lifecycle', 'readyWhen', 'schedule', 'step.']) {
    assert.equal(body.includes(forbidden), false, `the caption computes ${forbidden} instead of reading the milestone`)
  }
  // A dated line is Foundation B's own sentence and is never rewritten.
  const dated = { milestone: { line: 'Next: leave it in report-only until Sep 17, 2026.', at: '2026-09-17', gatedBy: 'after: something' } } as unknown as StepContract
  assert.equal(nextCaption(dated), 'Next: leave it in report-only until Sep 17, 2026.')
})

test('the rail’s metric is the date where there is one, and the word for where the step stands where there is not', () => {
  // The caption says what happens next; the rail's headline says when, or — with
  // no date — the one word for the step's standing, never the caption again.
  const gated = { milestone: { at: null, gatedBy: 'after: something', label: 'Clear what this step is waiting on.' }, state: { condition: 'blocked', setAside: false }, whatToDo: { kind: 'resolve', text: 'x' } } as unknown as StepContract
  assert.equal(railOf(gated).metric, CONTRACT.rail.held, 'an undated held step is not Held')
  assert.equal((nextCaption(gated) ?? '').includes(railOf(gated).metric), false, 'the rail headline repeats the caption')
  const dated = { milestone: { at: '2026-09-17T00:00:00.000Z', gatedBy: null, label: 'Leave it in report-only until Sep 17.' }, state: { condition: 'healthy', setAside: false }, whatToDo: { kind: 'observe', text: 'x' } } as unknown as StepContract
  assert.equal(railOf(dated).metric, absoluteDate('2026-09-17T00:00:00.000Z'), 'a dated milestone does not lead with its date')
  assert.equal(railOf(dated).sub, 'Leave it in report-only until Sep 17.')
  const src = readFileSync('src/ui/surfaces/stepContract.ts', 'utf8')
  const rail = src.slice(src.indexOf('export function railOf'), src.indexOf('export type ImplementationEmpty'))
  for (const forbidden of ['Date.', 'new Date', 'step.', 'implementation']) assert.equal(rail.includes(forbidden), false, `the rail computes ${forbidden}`)
})

// ------------------------------------------- the other families are untouched

test('every family is migrated, and each one still has the components it always had', () => {
  // Prompt 2 asserted the other five were `pending`, which was true then. The
  // final pass migrated them — which did NOT mean rewriting them: the frame was
  // already shared, and migrating a family means its optional modules gate
  // themselves on production truth through that one frame. So the guard now runs
  // the other way: every family is migrated, and nothing that drew a family
  // before has been deleted or replaced by a shell of its own.
  const manifest = JSON.parse(readFileSync('docs/design/approved/reference/REFERENCE-MANIFEST.json', 'utf8')) as {
    planStep: { families: Record<string, string> }
  }
  for (const family of ['policy', 'setup', 'mfa', 'inPlace', 'decision', 'resolution']) {
    assert.equal(manifest.planStep.families[family], 'migrated', `${family} is not recorded as migrated`)
  }
  // The decision primitive, the people blocks, More and the MFA handoff are all
  // still drawn by the components that drew them, inside the same frame.
  for (const kept of ['<Decision d={d}', '<WhoBlockView', '<More', '<MfaHandoff']) {
    assert.ok(CONTENT_STEP.includes(kept), `${kept} left the step`)
  }
  // src/ui/surfaces/stepFamilies.test.ts is where the one-frame claim is proven
  // over the whole corpus; this only holds the record to it.
  assert.ok(existsSync('src/ui/surfaces/stepFamilies.test.ts'), 'the family contract has no test')
})
