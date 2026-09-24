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
import { readFileSync } from 'node:fs'
import type { Step } from '../../roadmap/types.ts'
import type { Lifecycle } from '../../roadmap/lifecycle.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { CONTRACT, badgeLabel, nextCaption, railOf, stepTrack as trackFor } from './stepContract.ts'
import { absoluteDate } from '../../copy/dates.ts'

import type { ContractStage, StepContract } from './stepContract.ts'

// The opened step's body spans the component and stepBody.ts (A3): the decisions read there.
const CONTENT_STEP = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8') + readFileSync('src/ui/surfaces/stepBody.ts', 'utf8')
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

/** The board's one state reading of a queued step (planBoard.ts laneViewOf), as the rail tests hand it in. */
const UP_NEXT = { lane: 'Up Next', substatus: null, label: 'Up Next · After Create or Correct Emergency Access Accounts', tail: 'After Create or Correct Emergency Access Accounts', tone: 'wait' } as const

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

test('one renderer draws every policy state, and it computes no lifecycle, readiness or schedule of its own', () => {
  {
    // The frame is one `<article className="step …">` with one head, one body and
    // one footer. Six states means six sets of VALUES through it, never six
    // components — which is how the same tenant ends up reading differently
    // depending on which moment it is caught in.
    assert.equal(CONTENT_STEP.split('<article className="step').length - 1, 1, 'the step frame is drawn more than once')
    assert.equal(CONTENT_STEP.split('<StepHead').length - 1, 1, 'more than one head')
    assert.equal(CONTENT_STEP.split('<StepFooter').length - 1, 1, 'more than one footer')
    assert.equal(CONTENT_STEP.split('<StepActionColumn').length - 1, 1, 'more than one action column')
    // And no branch anywhere in the step names a lifecycle stage to decide what to
    // draw: the frame renders the contract, and the contract carries the stage.
    for (const named of ["=== 'report-only'", "=== 'ready-to-enforce'", "=== 'not-deployed'", "=== 'enforced'"]) {
      assert.equal(CONTENT_STEP.includes(named), false, `the step branches on ${named} instead of rendering the contract`)
    }
  }
  {
    for (const [file, src] of [['ContentStep.tsx', CONTENT_STEP], ['StepSections.tsx', SECTIONS]] as const) {
      for (const forbidden of ['projectStatus', 'heldForReview(', 'readyWhen(', 'implementationOffered(', 'jsonOffered(', 'Date.now', 'new Date(']) {
        assert.equal(src.includes(forbidden), false, `${file} computes ${forbidden}: the contract already answered it`)
      }
    }
    // And nothing reads a title to decide anything.
    for (const heuristic of ['title.includes', 'title.match', 'title.toLowerCase']) {
      assert.equal(CONTENT_STEP.includes(heuristic), false, `the step renders from its title: ${heuristic}`)
    }
  }
})

// ------------------------------------------------------------ the state matrix

test('the lifecycle track and the badge restate the recorded lifecycle and condition at all six states', () => {
  {
    for (const m of MATRIX) {
      const track = trackFor(stepAt(m))
      assert.deepEqual(track.map((t: ContractStage) => t.label), ['Not deployed', 'Report-only', 'Ready to enforce', 'Enforced'], `${m.key}: the four stages moved`)
      assert.deepEqual(track.map((t: ContractStage) => t.reached), [...m.reached], `${m.key}: the track claims progress the lifecycle has not made`)
      assert.equal(track.findIndex((t: ContractStage) => t.current), m.current, `${m.key}: the track is at the wrong stage`)
      // Every stage label is real text a screen reader reads in order; the bar is
      // the picture of the same fact and is hidden from it.
      for (const t of track) assert.ok(t.label.trim().length > 0, `${m.key}: a stage with no name`)
    }
  }
  {
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

// -------------------------------------------------------------- the frame

test('the frame: a full-width header holding the track, a body split beside the action column, and the footer band under both', () => {
  {
    assert.match(CONTENT_STEP, /<StepFooter controls=\{exceptions\.length > 0 \? exceptions : null\} onScan=\{printing \? null : \(onScan \?\? null\)\}/, 'the footer is not handed the exception and the scan')
    // A footer with nothing to offer is not drawn.
    const footer = SECTIONS.slice(SECTIONS.indexOf('export function StepFooter'), SECTIONS.indexOf('/** A tile'))
    assert.match(footer, /\{onScan && \(/, 'the scan control is unconditional')
  }
  {
    // The head is a sibling of the body, not a row inside it: the lifecycle track
    // spans the whole frame rather than being squeezed into the main column beside
    // the 260px action column.
    const start = CONTENT_STEP.indexOf('<article className="step')
    const frame = CONTENT_STEP.slice(start, CONTENT_STEP.indexOf('</article>', start))
    assert.ok(frame.indexOf('<StepHead') < frame.indexOf('<div className="step-body has-rail">'), 'the head is not above the body')
    assert.ok(frame.indexOf('</StepHead>') < frame.indexOf('<div className="step-body has-rail">'), 'the head is inside the body')
    assert.equal(/step-body[\s\S]{0,400}<StepHead/.test(frame), false, 'the head was drawn inside the split')
    // The footer is the frame's, under both columns.
    assert.ok(frame.indexOf('<StepFooter') > frame.indexOf('</StepActionColumn>'), 'the footer is inside the body')
  }
  {
    // The action column is led by the milestone, and every step has one, so the
    // column is never optional and never empty.
    assert.match(CONTENT_STEP, /<div className="step-body has-rail">/, 'the body does not lay out the action column')
    const one = CSS.match(/\.step-body \{[^}]*\}/)?.[0] ?? ''
    const two = CSS.match(/\.step-body\.has-rail \{[^}]*\}/)?.[0] ?? ''
    assert.match(one, /grid-template-columns: minmax\(0, 1fr\);/, 'a step with no action column leaves an empty column')
    assert.match(two, /grid-template-columns: 1fr 260px;/, 'the action column is not 260px')
  }
  {
    const rule = CSS.match(/\.step-footer \{[^}]*\}/)?.[0] ?? ''
    assert.match(rule, /border-top: 1px solid var\(--line\);/, 'the footer is not divided from the step')
    assert.match(rule, /background: var\(--secondary-surface\);/, 'the footer is not on the quieter surface')
    assert.match(CSS, /\.step-footer-end \{[^}]*margin-left: auto;/, 'the scan is not held to the end')
    // And it collapses with the rest of the frame at the pack's second breakpoint.
    const narrow = CSS.slice(CSS.indexOf('@media (max-width: 650px)'))
    assert.match(narrow, /\.step-head,\n\s*\.step-main,\n\s*\.step-footer \{/, 'the footer keeps a desktop inset on a phone')
  }
  {
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
  }
  {
    const head = SECTIONS.slice(SECTIONS.indexOf('export function StepHead'), SECTIONS.indexOf('export function LifecycleTrack'))
    assert.match(head, /<LifecycleTrack track=\{track\} \/>/, 'the head no longer draws the track')
    assert.match(head, /<header className="step-head">/, 'the track is not inside the full-width header')
    // Not in the body, not in the action column: the frame renders the head, then the split.
    const main = CONTENT_STEP.slice(CONTENT_STEP.indexOf('<div className="step-body has-rail">'), CONTENT_STEP.indexOf('<StepFooter'))
    assert.equal(main.includes('LifecycleTrack'), false, 'the track moved into the body')
    const column = SECTIONS.slice(SECTIONS.indexOf('export function StepActionColumn'), SECTIONS.indexOf('export function PolicyMembers'))
    assert.equal(column.includes('LifecycleTrack'), false, 'the track moved into the action column')
    // The split still begins below the header, and the action column is still optional.
    assert.match(CSS.match(/\.step-body\.has-rail \{[^}]*\}/)?.[0] ?? '', /grid-template-columns: 1fr 260px;/)
    assert.match(CSS.match(/\.step-body \{[^}]*\}/)?.[0] ?? '', /grid-template-columns: minmax\(0, 1fr\);/)
    // And it stacks below 900px (U2), with the frame's approved breakpoints still there.
    for (const w of [940, 900, 650]) assert.ok(CSS.includes(`@media (max-width: ${w}px)`), `the ${w} breakpoint is gone`)
    const from = CSS.indexOf('@media (max-width: 900px)')
    const narrow = CSS.slice(from, CSS.indexOf('\n}\n', from))
    assert.match(narrow, /\.step-body\.has-rail \{[\s\S]*?grid-template-columns: 1fr;/, 'the body no longer stacks at 900')
  }
})

// ------------------------------------------------------------ the Next caption

test('the Next caption and the rail read the milestone, and invent nothing where it has no date', () => {
  {
    const dated = { milestone: { line: 'Next: leave it in report-only until Sep 17, 2026.', at: '2026-09-17', gatedBy: null } } as unknown as StepContract
    assert.equal(nextCaption(dated), 'Next: leave it in report-only until Sep 17, 2026.')
  }
  {
    // Owner, 2026-09-11: one blocker, one place. The gate stays the row's reason
    // and Fix before continuing's; the caption restating it is gone.
    const gated = { milestone: { line: null, at: null, gatedBy: 'after: Create or Correct Emergency Access Accounts', kind: 'resolve', label: 'Clear what this step is waiting on.' }, state: { condition: 'blocked', setAside: false, lane: UP_NEXT }, whatToDo: { kind: 'resolve', text: 'x' } } as unknown as StepContract
    assert.equal(nextCaption(gated), null)
  }
  {
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
  }
})
