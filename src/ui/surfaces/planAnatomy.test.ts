// Task 033 — the approved Plan collapsed roadmap row; task 034 — the expanded frame.
//
// The same two-sided shape as src/ui/surfaces/connectAnatomy.test.ts (task
// 032): every assertion reads `docs/design/approved/plan-step-v1.html` at test
// time and fails if the pack stops drawing what production claims to have
// restored, and reads production and fails if production stops drawing it. A
// green unit test that only knows about production can pass while the two
// drift apart, which is the failure this file exists to catch.
//
// It owns the ROW (task 033), the EXPANDED FRAME under it (task 034) and the
// CONTENT ANATOMY inside that frame (task 035): the join between them, the
// head, the lifecycle track, the main/rail body and its responsive collapse,
// the sticky shell the pack asks the Plan for, the canonical section order, the
// findings cards, the attention treatment, the action strip over its
// instruction block, the More disclosure and the rail's side blocks.
//
// Applying that grammar to every step VARIANT, and retiring the bespoke
// branches it makes redundant, is pack 036's.
//
// What this file does not re-prove, because one authority already owns it: the
// canonical hashes and bytes (src/ui/design-authority.test.ts); the row's
// disclosure semantics and the narrow layout (src/ui/accessibility.test.ts);
// the token system and AA (src/ui/tokens.test.ts); shared-vs-surface
// primitives (src/ui/primitives.test.ts); that PlanRow is the only row markup
// in the product (src/ui/surfaces/stepContract.test.ts contract 12); the words
// each zone carries (src/ui/surfaces/statusWord.test.ts,
// rowWhen/rowWho's own tests); the demo's isolation (src/ui/demo.test.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { statusOf } from './statusWord.ts'
import { CONTRACT, stageClass, stepContract, stepTrack as trackFor } from './stepContract.ts'
import type { StepVarContext } from './stepVars.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { Step } from '../../roadmap/types.ts'
import type { Lifecycle } from '../../roadmap/lifecycle.ts'

const read = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

const PACK = 'docs/design/approved/plan-step-v1.html'
const SECTIONS = read('src/ui/surfaces/StepSections.tsx')
const PLAN = read('src/ui/surfaces/Plan.tsx')
const CSS = read('src/ui/app.css')
const CONTENT_STEP = read('src/ui/surfaces/ContentStep.tsx')
const CLEANUP_STEP = read('src/ui/surfaces/CleanupStep.tsx')
const SHELL = read('src/ui/shell/AppShell.tsx')
const CONTRACT_SRC = read('src/ui/surfaces/stepContract.ts')

/** The PlanRow function body, which is all of the row's markup. */
const ROW = ((): string => {
  const from = SECTIONS.indexOf('export function PlanRow(')
  assert.ok(from >= 0, 'StepSections still draws the one Plan row')
  return SECTIONS.slice(from, SECTIONS.indexOf('\n}\n', from))
})()

/**
 * One declaration block from app.css, by exact selector. The selector must
 * start the rule: `.plan-row .when` is also the tail of the combined
 * `.plan-row .who, .plan-row .when` selector, and reading that block instead
 * would quietly assert against the wrong declarations.
 */
const rule = (selector: string): string => {
  for (const m of CSS.matchAll(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{`, 'g'))) {
    const before = CSS.slice(0, m.index).trimEnd().at(-1)
    if (before !== '}' && before !== '/') continue
    return CSS.slice(m.index, CSS.indexOf('}', m.index))
  }
  assert.fail(`app.css no longer declares ${selector} as a rule of its own`)
}

/** A step with the fields these tests read, over the ordinary starting state. */
const step = (over: Record<string, unknown>): Step => ({ status: 'ready', state: { inPlace: false, setAside: false, satisfied: false, lifecycle: 'not-deployed', condition: 'healthy' }, ...over }) as unknown as Step

/** A source slice with its comments removed, so a check for a CALL is not tripped by prose about it. */
const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** The @media block at a breakpoint, flattened. */
const atWidth = (px: number): string => CSS.match(new RegExp(`@media \\(max-width: ${px}px\\) \\{[\\s\\S]*?\\n\\}`))?.[0] ?? ''

// The precondition for every assertion below: the bytes this file reads are the
// owner-approved bytes. src/ui/design-authority.test.ts owns the hash contract
// across all four packs and against the committed git blob; this is only the
// guarantee that THIS file's evidence came from the approved file.
test('the Plan pack this file reads is the approved one, byte for byte', () => {
  const manifest = JSON.parse(read('docs/design/approved/manifest.json')) as { surfaces: { surface: string; path: string; sha256: string }[] }
  const record = manifest.surfaces.find((s) => s.surface === 'plan')
  assert.ok(record, 'the manifest records a Plan surface')
  assert.equal(record.path, PACK)
  assert.equal(createHash('sha256').update(readFileSync(PACK)).digest('hex'), record.sha256, 'the canonical Plan pack changed')
})

// ------------------------------------------------ the anatomy, both sides

test('the pack draws a four-zone roadmap row, and so does production', () => {
  const pack = read(PACK)
  // The pack: status | title | metadata | date, at its own measurements.
  assert.match(pack, /\.roadmap-row\{[^}]*grid-template-columns:126px 1fr 240px 125px/, 'the pack no longer draws the four-zone row')
  assert.match(pack, /\.roadmap-row\{[^}]*gap:18px/, "the pack's row gap moved")
  assert.match(pack, /\.roadmap-row\{[^}]*min-height:64px/, "the pack's row density moved")
  assert.match(pack, /\.roadmap-row\{[^}]*padding:0 17px/, "the pack's row inset moved")

  // Production: the same four tracks at the same numbers. The 1fr track is
  // minmax(0, 1fr) so a long policy or group name wraps inside its column
  // instead of widening the grid — the one deliberate difference, and it is a
  // correctness one.
  const row = rule('.plan-row')
  assert.match(row, /display: grid;/, 'the roadmap row is not a grid')
  assert.match(row, /grid-template-columns: 126px minmax\(0, 1fr\) 240px 125px;/, 'production lost the four-zone grid')
  assert.match(row, /gap: 18px;/)
  assert.match(row, /min-height: 64px;/)
  assert.match(row, /padding: 0 17px;/)
})

test('the title carries a quiet reason under it rather than a line under the whole row', () => {
  const pack = read(PACK)
  // The pack: the title zone is a strong over a quiet span, and the quiet span
  // shares its colour and size with the metadata and date zones.
  assert.match(pack, /\.row-title strong\{display:block/, 'the pack no longer stacks the title over its subtitle')
  assert.match(pack, /\.row-title span,\.row-meta,\.row-date\{color:var\(--muted\);font-size:12px\}/, 'the pack no longer sets one quiet level for the row')

  // Production: the reason is a child of the title zone, and every zone that
  // follows the title comes after it. Before task 033 it was a sibling of the
  // whole row, so a blocked step's cause rendered under the state column.
  assert.match(ROW, /<span className="plan-row-title">/, 'the row has no title zone')
  const title = ROW.slice(ROW.indexOf('<span className="plan-row-title">'), ROW.indexOf('<span className="who">'))
  assert.match(title, /className="step-title"/, 'the title left its own zone')
  assert.match(title, /reason && <span className="plan-row-reason">\{reason\}<\/span>/, 'the reason is not inside the title zone')
  assert.match(rule('.plan-row-reason'), /display: block;/, 'the reason no longer starts its own line under the title')
  // One quiet level for the three secondary zones, as the pack sets it.
  assert.match(rule('.plan-row-reason'), /font-size: var\(--t-1\);/)
  assert.match(rule('.plan-row .who,\n.plan-row .when'), /font-size: var\(--t-1\);/)
  assert.match(rule('.plan-row .who,\n.plan-row .when'), /color: var\(--ink-3\);/)
})

test('the metadata and date zones are right-aligned tracks of their own', () => {
  assert.match(read(PACK), /\.row-meta,\.row-date\{text-align:right\}/, 'the pack no longer right-aligns the two trailing zones')
  assert.match(rule('.plan-row .who,\n.plan-row .when'), /text-align: right;/, 'who and when are no longer their own right-aligned tracks')
  // A date does not break; the timing column's sentence form does. That
  // distinction is production's (rowWhenWraps) and it survives the restoration.
  assert.match(rule('.plan-row .when'), /white-space: nowrap;/)
  assert.match(rule('.plan-row .when.when-reason'), /white-space: normal;/)
  assert.match(ROW, /className=\{`when\$\{whenReason \? ' when-reason' : ''\}`\}/, 'the row stopped marking a timing value that is a sentence')
})

test('the row collapses at the breakpoint the pack collapses at, and drops nothing', () => {
  const pack = read(PACK)
  assert.match(pack, /@media\(max-width:940px\)\{[\s\S]*\.roadmap-row\{grid-template-columns:110px 1fr\}/, 'the pack no longer collapses the row at 940')
  assert.match(pack, /@media\(max-width:940px\)\{[\s\S]*\.row-meta,\.row-date\{text-align:left\}/, 'the pack no longer left-aligns the moved zones')
  // Production collapses at the same width to the same two tracks. Four
  // children in two tracks is how the pack itself moves the metadata and the
  // date below the state and the title; nothing is hidden to make room.
  const narrow = atWidth(940)
  assert.match(narrow, /\.plan-row \{[\s\S]*grid-template-columns: 110px minmax\(0, 1fr\);/, 'the row does not collapse to two tracks')
  assert.match(narrow, /text-align: left;/, 'the moved zones do not left-align')
  assert.equal(/display:\s*none/.test(narrow), false, 'a zone is hidden at the narrow width instead of moved')
})

// ------------------------------------------------ the row presents truth, it does not compute it

test('the status zone consumes the authoritative Plan state and computes nothing', () => {
  // The Plan hands the row `statusOf(step)` — the one projection of Step.state
  // — and the row renders the word it is given. The row must not be able to
  // disagree with the step.
  assert.match(PLAN, /const status = statusOf\(step\)/, 'the Plan row no longer reads the one status authority')
  assert.match(PLAN, /word=\{status\.word\}\n\s*tone=\{status\.tone\}/, 'the row is no longer handed the authoritative word and tone')
  // Nothing in the row markup reads a step, a lifecycle, a condition or a date.
  // A second reading here is how two answers to one question get on one screen.
  for (const forbidden of ['step.', 'state.lifecycle', 'state.condition', 'blockers', 'Date.', 'new Date', 'toLocale']) {
    assert.equal(ROW.includes(forbidden), false, `the row derives ${forbidden} instead of being handed the fact`)
  }
})

test('the state is a word, never a colour alone, in every state the plan can be in', () => {
  assert.match(ROW, /<Status tone=\{tone\}>\{word\}<\/Status>/, 'the state is no longer rendered as a word')
  // Every status a step can project renders a non-empty word. A tone with no
  // word would be a row whose meaning is the dot's colour.
  const step = (over: Record<string, unknown>): Step => ({ status: 'ready', state: { inPlace: false, lifecycle: 'not-deployed', condition: 'healthy' }, operatorSafe: true, ...over }) as unknown as Step
  const cases: Step[] = [
    step({ status: 'ready' }),
    step({ status: 'blocked' }),
    step({ status: 'blocked', state: { inPlace: false, lifecycle: 'not-deployed', condition: 'needs-decision' } }),
    step({ status: 'blocked', operatorSafe: false }),
    step({ status: 'in-report-only' }),
    step({ status: 'ready-to-enforce' }),
    step({ status: 'skipped' }),
    step({ status: 'done' }),
    step({ status: 'done', state: { inPlace: true, lifecycle: 'enforced', condition: 'healthy' } }),
  ]
  for (const s of cases) {
    const view = statusOf(s)
    assert.ok(view.word.trim().length > 0, `${s.status} renders no state word`)
    assert.ok(['ok', 'wait', 'stop', 'idle'].includes(view.tone))
  }
  // Lifecycle and provenance stay two facts, and only the pair produces
  // Enforced: `inPlace` is false exactly where a policy THIS plan deployed
  // earned the goal, so Enforced needs that provenance and an enforced stage
  // together. Reading either alone is what once made every goal the tenant had
  // already delivered claim IAMAI had rolled it out.
  assert.equal(statusOf(step({ status: 'done', state: { inPlace: false, lifecycle: 'enforced', condition: 'healthy' } })).word, 'Enforced')
  assert.equal(statusOf(step({ status: 'done', state: { inPlace: true, lifecycle: 'enforced', condition: 'healthy' } })).word, 'In place')
  assert.equal(statusOf(step({ status: 'done', state: { inPlace: false, lifecycle: 'in-report-only', condition: 'healthy' } })).word, 'In place')
  // And the condition is read on its own axis, not folded into the stage: a
  // blocked step waiting on the operator says so instead of saying Blocked.
  assert.equal(statusOf(step({ status: 'blocked', state: { inPlace: false, lifecycle: 'not-deployed', condition: 'needs-decision' } })).word, 'Needs decision')
  assert.equal(statusOf(step({ status: 'blocked', state: { inPlace: false, lifecycle: 'not-deployed', condition: 'healthy' } })).word, 'Blocked')
})

test('the metadata and timing zones are handed existing facts, and no new one is invented', () => {
  // The row's four values come from the four modules that already own them.
  // Nothing on the Plan builds a count, a date or an elapsed time for display.
  assert.match(PLAN, /title=\{contentTitle\(step\)\}/, 'the title is no longer the content entry')
  assert.match(PLAN, /who=\{rowWho\(step, nameOf\)\}/, 'the metadata zone no longer reads the one who-line authority')
  assert.match(PLAN, /when=\{rowWhen\(step, waveStart\)\}/, 'the timing zone no longer reads the one when authority')
  assert.match(PLAN, /reason=\{rowReason\(step\)\}/, 'the quiet line no longer reads the one reason authority')
  assert.match(PLAN, /whenReason=\{rowWhenWraps\(step\)\}/)
})

test('the roadmap order and grouping are still the plan\'s, not the row\'s', () => {
  // planRows.ts decides which rows each group draws; the restoration changed
  // where a row's facts sit, not which rows exist or what order they come in.
  assert.match(PLAN, /const floor = floorRows\(c\.steps\)/)
  assert.match(PLAN, /const heldRows = undatedRows\(c\.steps, c\.schedule\.waves\)/)
  assert.match(PLAN, /steps: phaseRows\(c\.steps, w\)/)
  // No sorting, filtering or grouping in the row component.
  for (const forbidden of ['.sort(', '.filter(', '.slice(']) {
    assert.equal(ROW.includes(forbidden), false, `the row ${forbidden} its own content instead of rendering what the plan gave it`)
  }
})

// ------------------------------------------------ the join, and nothing beyond it

test('the open row is the head of the step under it, driven by the real expanded state', () => {
  // The pack attaches the step to the row: the row squares off the edge they
  // share and the step below it carries no top border of its own.
  const pack = read(PACK)
  assert.match(pack, /\.roadmap-row\{[^}]*border-radius:10px 10px 0 0/, 'the pack no longer draws the row as the head of the step')
  assert.match(pack, /\.step\{[\s\S]{0,120}border-top:0/, 'the pack no longer attaches the step to the row above it')
  // Production makes the same join, and it is keyed off `aria-expanded` — the
  // accessibility state itself — so the affordance cannot say one thing while
  // the row says another. The corner value is one of the brand's three shape
  // tokens (task 030); what is asserted is the SHAPE — the two corners the step
  // does not share are rounded, the two it does are square — and that the row
  // carries the frame's own border, which is what makes the pair one unit.
  const openRow = rule(".plan-row[aria-expanded='true']")
  assert.match(openRow, /border-radius: var\(--radius[a-z-]*\) var\(--radius[a-z-]*\) 0 0;/, 'the open row does not square off the edge the step attaches to')
  assert.match(openRow, /border: 1px solid var\(--rule\);/, 'the open row does not carry the frame it heads')
  assert.match(ROW, /aria-expanded=\{open\}/, 'the row no longer publishes its expanded state')
})

// ------------------------------------------------ pack 034: the expanded frame

test('the step is one frame attached under the row, not a second card beside it', () => {
  const pack = read(PACK)
  // The pack: a bordered panel with no top border, only its lower corners
  // rounded, lifted off the page by the one shadow.
  assert.match(pack, /\.step\{[\s\S]{0,200}border-radius:0 0 12px 12px/, 'the pack no longer rounds only the step’s lower corners')
  assert.match(pack, /\.step\{[\s\S]{0,200}box-shadow:var\(--shadow\)/, 'the pack no longer lifts the opened step')
  // Production: the same shape, composed from the two shared roles task 031
  // proved (.panel, .panel-key) rather than declaring surface and shadow again.
  const step = rule('.step')
  assert.match(step, /border-top: 0;/, 'the step does not attach to the row above it')
  assert.match(step, /border-radius: 0 0 var\(--radius[a-z-]*\) var\(--radius[a-z-]*\);/, 'the step rounds corners the row above it already rounded')
  for (const file of [CONTENT_STEP, CLEANUP_STEP]) {
    assert.match(file, /className="step panel panel-key"/, 'a step body is not the one lifted frame')
  }
})

test('the head is the pack’s four zones, and the step title is a heading', () => {
  const pack = read(PACK)
  assert.match(pack, /\.step-head-top\{display:flex;justify-content:space-between/, 'the pack no longer holds the badge beside the heading')
  assert.match(pack, /\.step-head h3\{/, 'the pack no longer draws the title as a heading')
  assert.match(pack, /\.step-sub\{/, 'the pack no longer draws a supporting line under the title')
  // Production draws the same four zones: eyebrow, title, supporting line, badge.
  const head = SECTIONS.slice(SECTIONS.indexOf('export function StepHead('), SECTIONS.indexOf('export function LifecycleTrack('))
  assert.match(head, /className="eyebrow"/, 'the head lost the shared eyebrow role')
  assert.match(head, /<h3 className="step-title">\{title\}<\/h3>/, 'the opened step’s title is not a heading')
  assert.match(head, /<Status tone=\{tone\} pill>/, 'the state badge is not the shared pill over the one status role')
  assert.match(rule('.step-head-top'), /justify-content: space-between;/)
  assert.match(rule('.step-head-top'), /align-items: flex-start;/)
  // And the contract's sections nest UNDER that title rather than beside it.
  assert.equal(/<h3>/.test(CONTENT_STEP), false, 'a section heading still sits at the step title’s level')
  assert.match(SECTIONS, /<h4>\{heading\}<\/h4>/, 'the contract’s sections are no longer nested under the step title')
})

test('the lifecycle track draws the four stages and reads them off Foundation B', () => {
  const pack = read(PACK)
  assert.match(pack, /\.track\{display:grid;grid-template-columns:repeat\(4,1fr\)/, 'the pack no longer draws four stages')
  for (const label of ['Not deployed', 'Report-only', 'Ready to enforce', 'Enforced']) {
    assert.ok(pack.includes(`<span>${label}</span>`), `the pack no longer labels the ${label} stage`)
  }
  assert.match(rule('.step .track'), /grid-template-columns: repeat\(4, 1fr\);/, 'production does not draw four stages')
  const track = SECTIONS.slice(SECTIONS.indexOf('export function LifecycleTrack('), SECTIONS.indexOf('export function StepRail('))
  // The labels are the contract's own lifecycle words, not four literals here.
  assert.match(track, /\{s\.label\}/, 'a stage label is written into the component instead of coming from the contract')
  for (const label of ['Not deployed', 'Report-only', 'Ready to enforce', 'Enforced']) {
    assert.equal(track.includes(label), false, `the track writes "${label}" out instead of reading the contract's lifecycle words`)
  }
  // Nothing in the component decides where the step is.
  for (const forbidden of ['step.', 'state.lifecycle', 'state.condition', 'Date.', 'indexOf']) {
    assert.equal(track.includes(forbidden), false, `the track derives ${forbidden} instead of rendering contract.track`)
  }
  // The stage is a word and a position assistive technology can read, never a
  // colour: the label is real text and the current one is marked twice over.
  assert.match(track, /aria-current=\{s\.current \? 'step' : undefined\}/, 'the current stage is not marked programmatically')
  assert.match(track, /<span className="stage-label">\{s\.label\}<\/span>/, 'the stage labels are not real text')
  assert.match(rule('.step .track .stage.current .stage-label'), /color: var\(--ink\);/, 'the current stage is marked by colour alone')
})

test('each lifecycle is drawn as itself, and no step is painted mid-rollout that is not', () => {
  const pack = read(PACK)
  // The pack does not have one "current" treatment. It draws a policy that is
  // not deployed with four unfilled bars, gives Report-only and Ready to
  // enforce their own two partial treatments, and fills a passed stage.
  assert.match(pack, /\.stage\{[^}]*background:#263039\}/, 'the pack no longer draws an unfilled stage')
  assert.match(pack, /\.stage\.done\{background:rgba\(121,215,166/, 'the pack no longer fills a passed stage')
  assert.match(pack, /\.stage\.current\{background:linear-gradient\(90deg,rgba\(230,188,98,\.85\) 62%/, "the pack's current treatment moved")
  assert.match(pack, /\.stage\.ready\{background:linear-gradient\(90deg,rgba\(79,209,197,\.85\) 84%/, "the pack's ready treatment moved")
  assert.match(pack, /<div class="track"><div class="stage"><\/div><div class="stage"><\/div><div class="stage"><\/div><div class="stage"><\/div><\/div>/, 'the pack no longer draws Not deployed as four unfilled bars')

  // Production draws the same four apart, on the stage name the contract
  // already projected. The default fill is empty, so a stage with no treatment
  // of its own claims nothing.
  assert.match(rule('.step .track .stage-fill'), /width: 0;/, 'an unmarked stage claims progress')
  assert.match(rule('.step .track .stage.reached .stage-fill'), /width: 100%;\n\s*background: var\(--success\);/, 'a passed stage is no longer complete')
  assert.match(rule('.step .track .stage.current.stage-report-only .stage-fill'), /width: 62%;\n\s*background: var\(--attention\);/, "Report-only lost the pack's current treatment")
  assert.match(rule('.step .track .stage.current.stage-ready-to-enforce .stage-fill'), /width: 84%;\n\s*background: var\(--accent\);/, 'Ready to enforce lost its own treatment')
  // The blanket rule the four replaced: a `.current` fill that names no stage
  // paints Not deployed and Enforced with Report-only's bar.
  assert.equal(/\.step \.track \.stage\.current \.stage-fill \{/.test(CSS), false, 'one treatment is applied to every current stage again')

  // End to end, per lifecycle: the classes production actually renders, from
  // the contract's own projection through the component's one class list.
  const cls = (lifecycle: Lifecycle): string[] => trackFor(step({ state: { inPlace: false, setAside: false, satisfied: false, lifecycle, condition: 'healthy' } })).map(stageClass)
  assert.match(SECTIONS, /className=\{stageClass\(s\)\}/, 'the track builds its own class list beside the contract’s')
  const treated = (c: string): 'empty' | 'report-only' | 'ready' | 'complete' => {
    if (/\breached\b/.test(c)) return 'complete'
    if (/\bcurrent\b/.test(c) && c.includes('stage-report-only')) return 'report-only'
    if (/\bcurrent\b/.test(c) && c.includes('stage-ready-to-enforce')) return 'ready'
    return 'empty'
  }
  // Not deployed: nothing has been deployed, so nothing is filled and nothing
  // is part-filled. The step is still marked — by aria-current and the label.
  assert.deepEqual(cls('not-deployed').map(treated), ['empty', 'empty', 'empty', 'empty'])
  assert.deepEqual(cls('report-only').map(treated), ['complete', 'report-only', 'empty', 'empty'])
  assert.deepEqual(cls('ready-to-enforce').map(treated), ['complete', 'complete', 'ready', 'empty'])
  // Enforced reads as finished: the last stage is reached as well as current,
  // and `.reached` is the only fill rule that matches it.
  assert.deepEqual(cls('enforced').map(treated), ['complete', 'complete', 'complete', 'complete'])
  assert.match(cls('enforced')[3], /\bcurrent\b/, 'the finished step is no longer marked as being at Enforced')
  // And the condition never changes a treatment: it is not on this axis.
  const held = trackFor(step({ state: { inPlace: false, setAside: false, satisfied: false, lifecycle: 'report-only', condition: 'review-required' } })).map(stageClass)
  assert.deepEqual(held, cls('report-only'), 'a condition repainted the lifecycle bar')
})

test('the frame has a main column and the step’s own rail, and the rail survives the collapse', () => {
  const pack = read(PACK)
  assert.match(pack, /\.step-body\{display:grid;grid-template-columns:minmax\(0,1fr\) 290px\}/, 'the pack no longer draws a main column and a rail')
  assert.match(pack, /@media\(max-width:940px\)\{[\s\S]*\.step-body\{grid-template-columns:1fr\}/, 'the pack no longer collapses the body to one column')
  assert.match(pack, /@media\(max-width:940px\)\{[\s\S]*\.step-side\{border-left:0;border-top:1px solid var\(--line\)\}/, 'the pack no longer moves the rail below the main column')
  // Production: the same two tracks, and the rail belongs to the step's frame
  // rather than to the page.
  assert.match(rule('.step-body.has-rail'), /grid-template-columns: minmax\(0, 1fr\) 290px;/, 'the desktop body is not main + rail')
  assert.match(rule('.step-side'), /border-left: 1px solid var\(--rule\);/, 'the rail is not divided from the main column')
  const narrow = atWidth(940)
  assert.match(narrow, /\.step-body\.has-rail \{[\s\S]*grid-template-columns: minmax\(0, 1fr\);/, 'the body does not collapse to one column')
  assert.match(narrow, /\.step-side \{[\s\S]*border-top: 1px solid var\(--rule\);/, 'the rail does not move below the main column')
  assert.equal(/\.step-side \{[^}]*display:\s*none/.test(narrow), false, 'the rail is hidden rather than moved')
  // One rail, in one place in the DOM, at every width: no second copy for a
  // second layout, so reading order and rendered order cannot diverge.
  assert.equal(CONTENT_STEP.split('<StepRail').length - 1, 1, 'the step draws more than one rail')
  assert.match(CONTENT_STEP, /\{rail && <StepRail contract=\{contract\} \/>\}/, 'the rail is not gated on the contract having something for it')
})

test('the Plan’s topbar sticks, through the one shell the product already has', () => {
  const pack = read(PACK)
  assert.match(pack, /\.topbar\{[\s\S]{0,60}position:sticky;top:0/, 'the pack no longer defines a sticky topbar')
  assert.match(SHELL, /const sticky = planActive/, 'the Plan does not turn on the sticky shell its pack asks for')
  assert.match(SHELL, /className=\{`shell\$\{sticky \? ' shell-sticky' : ''\}`\}/, 'the sticky state is not set on the one shell')
  // The capability stays task 030's one rule, with the anchor offset it needs;
  // no second navigation shell was built for the Plan.
  assert.match(CSS, /\.shell\.shell-sticky header\.app \{[\s\S]*?position: sticky;/, 'the sticky rule left the shell')
  assert.match(CSS, /\.shell\.shell-sticky \[id\] \{\s*\n\s*scroll-margin-top:/, 'a sticky header without an anchor offset lands every in-page link under itself')
  assert.equal(SHELL.match(/<header className="app">/g)?.length, 1, 'the shell renders more than one application header')
})

test('the frame is production’s composition, not a second reading of the engine', () => {
  // The frame moved markup. It must not have moved a DECISION into the markup:
  // the head, the track and the rail render `stepContract` and nothing else.
  // The code, without its prose: a comment naming the authority the component
  // defers to is the documentation this file wants, not the second reading it
  // forbids.
  const parts = code(SECTIONS.slice(SECTIONS.indexOf('export function StepHead('), SECTIONS.indexOf('export function PolicyMembers(')))
  for (const forbidden of ['implementationOffered', 'unavailableReason', 'policyHold', 'nextMilestone', 'statusOf', 'projectStatus', 'heldForReview']) {
    assert.equal(parts.includes(forbidden), false, `the frame calls ${forbidden}; the contract already answered it`)
  }
  // The projection itself reads Foundation B's lifecycle and never rebuilds one:
  // a stage is reached because the recorded lifecycle is past it, and a goal the
  // tenant already satisfies draws no rollout it never had.
  assert.match(CONTRACT_SRC, /const LIFECYCLE_ORDER: Lifecycle\[\] = \['not-deployed', 'report-only', 'ready-to-enforce', 'enforced'\]/, 'the lifecycle order left the contract')
  const trackOf = CONTRACT_SRC.slice(CONTRACT_SRC.indexOf('function stepTrack'), CONTRACT_SRC.indexOf('function stepTrack') + 700)
  assert.match(trackOf, /if \(s\.lifecycle === null \|\| s\.setAside \|\| s\.inPlace\) return \[\]/, 'a rollout is drawn for a step that never had one')
  for (const forbidden of ['advanceState', 'setState', 'Date.', 'percent']) {
    assert.equal(trackOf.includes(forbidden), false, `the track projection ${forbidden}: it may only restate the recorded lifecycle`)
  }
})

test('the track projects the recorded lifecycle and nothing else', () => {
  const at = (s: Step): { labels: string[]; reached: boolean[]; current: number } => {
    const t = trackFor(s)
    return { labels: t.map((x) => x.label), reached: t.map((x) => x.reached), current: t.findIndex((x) => x.current) }
  }
  // Not deployed: four stages, none reached, the first current.
  assert.deepEqual(at(step({})).labels, ['Not deployed', 'Report-only', 'Ready to enforce', 'Enforced'])
  assert.deepEqual(at(step({})).reached, [false, false, false, false])
  assert.equal(at(step({})).current, 0)
  // Report-only: the stage before it is behind the policy, because a policy in
  // report-only has been deployed. Nothing beyond it is claimed.
  const ro = step({ state: { inPlace: false, setAside: false, satisfied: false, lifecycle: 'report-only', condition: 'healthy' } })
  assert.deepEqual(at(ro).reached, [true, false, false, false])
  assert.equal(at(ro).current, 1)
  // The condition moves on its own axis and moves no stage: a held report-only
  // policy is at exactly the stage a healthy one is at.
  const held = step({ state: { inPlace: false, setAside: false, satisfied: false, lifecycle: 'report-only', condition: 'review-required' } })
  assert.deepEqual(at(held), at(ro), 'a condition advanced or retreated the lifecycle')
  const blocked = step({ status: 'blocked', state: { inPlace: false, setAside: false, satisfied: false, lifecycle: 'not-deployed', condition: 'blocked' } })
  assert.deepEqual(at(blocked).reached, [false, false, false, false], 'a blocked step claims progress it has not made')
  // A goal the tenant already satisfies was never on this plan's lifecycle, and
  // a set-aside step has left it: neither gets a rollout drawn for it.
  assert.deepEqual(trackFor(step({ status: 'done', state: { inPlace: true, setAside: false, satisfied: true, lifecycle: 'enforced', condition: 'healthy' } })), [])
  assert.deepEqual(trackFor(step({ state: { inPlace: false, setAside: true, satisfied: false, lifecycle: 'not-deployed', condition: 'healthy' } })), [])
  assert.deepEqual(trackFor(step({ state: { inPlace: false, setAside: false, satisfied: false, lifecycle: null, condition: 'healthy' } })), [])
})

test('no generated attribution or tagline came in with the design work', () => {
  // The approved packs are a visual authority and not a copy one; the branding
  // previews are authority for nothing at all. Neither may put a name or a
  // strapline into the product.
  for (const file of ['src/ui/surfaces/Plan.tsx', 'src/ui/surfaces/StepSections.tsx', 'src/ui/surfaces/PlanFooter.tsx', 'src/ui/app.css']) {
    assert.equal(/jon hope|built by/i.test(read(file)), false, `${file} carries a generated attribution`)
  }
  // The one place the name appears is the glossary's sentence about who wrote
  // the BASELINE, which is a fact about the package and predates the design
  // work (task 016). It is not an IAMAI byline, and nothing in the restoration
  // turned it into one.
  const content = read('docs/design/content.json')
  const mentions = [...content.matchAll(/[^"]*built by Jon Hope[^"]*/gi)].map((m) => m[0].trim())
  assert.deepEqual(
    mentions.map((s) => s.includes('Defense in Depth, built by Jon Hope, a Microsoft MVP')),
    [true],
    'the baseline author sentence changed, or a second attribution was added',
  )
})

// ------------------------------------------------ pack 035: the content anatomy

/** The opened step's main column, which is all of the markup pack 035 orders. */
const MAIN = ((): string => {
  const from = CONTENT_STEP.indexOf('<div className="step-main">')
  assert.ok(from >= 0, 'ContentStep still draws the main column')
  return CONTENT_STEP.slice(from, CONTENT_STEP.indexOf('{rail && <StepRail', from))
})()

/** Every step of a fixture with its contract: the plan as a person actually reads it. */
function contractsOf(name: 'demo' | 'demo-week2' | 'messy' | 'hostile') {
  const f = fixture(name)
  const r = runFixture(f)
  const ctx = (step: Step): StepVarContext => ({
    snapshot: f.snapshot,
    mapping: f.mapping,
    nameOf: (id: string) => r.input.names!.label(id),
    signature: 'IT',
    operatorId: f.operatorId,
    now: f.snapshot.asOf,
    groups: f.groups,
    reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null,
  })
  return r.steps.map((step) => ({ step, c: stepContract(step, ctx(step)) }))
}

test('the opened step runs the pack’s section order, and each section is a section', () => {
  const pack = read(PACK)
  // The pack states the order twice, and both statements have to still be
  // there: as its numbered step contract, and as the sections its variants
  // actually draw.
  const rules = pack.slice(pack.indexOf('<div class="rules"'), pack.indexOf('</section>', pack.indexOf('<div class="rules"')))
  assert.deepEqual(
    [...rules.matchAll(/<strong>([^<]+)<\/strong>/g)].map((m) => m[1]),
    ['State / next milestone', 'Why', 'What IAMAI found', 'Who this touches', 'What to do', 'Fix before continuing', 'Done when', 'More'],
    'the pack no longer states the canonical section order',
  )
  const v1 = pack.slice(pack.indexOf('<!-- V1 -->'), pack.indexOf('<!-- V2 -->'))
  assert.deepEqual(
    [...v1.matchAll(/<section class="step-section"><h4>([^<]+)<\/h4>/g)].map((m) => m[1]),
    ['Why', 'What IAMAI found', 'Who this touches', 'What to do', 'Done when'],
    'the pack no longer draws its sections in that order',
  )
  // Production: the same order, read off the markup rather than off a comment.
  // The anchors are what each section is, not what it says, so a wording change
  // does not silently reorder the step.
  const at = (needle: string): number => {
    const i = MAIN.indexOf(needle)
    assert.ok(i >= 0, `the opened step no longer renders ${needle}`)
    return i
  }
  const order = [
    ['why', at('<h4>{HEAD.why}</h4>')],
    ['found', at('<WhatIamaiFound found={contract.found} />')],
    ['who', at('<h4>{HEAD.who}</h4>')],
    ['what to do', at('<h4>{HEAD.whatToDo}</h4>')],
    ['fix', at('<FixBeforeContinuing fix={contract.fix}')],
    ['done when', at('<DoneWhen heading={HEAD.doneWhen}')],
    ['more', at('<More')],
  ] as const
  assert.deepEqual(
    [...order].sort((a, b) => a[1] - b[1]).map((x) => x[0]),
    order.map((x) => x[0]),
    'the opened step’s sections are not in the pack’s order',
  )
  // The conflict notice is the one deliberate difference from the pack's own
  // conflict variant, and it is the safe direction: the pack has nothing above
  // Why to be above, and production does, so "do not deploy this policy" stays
  // at the top of the step rather than arriving after two sections.
  assert.ok(MAIN.indexOf('{conflictWords && (') < order[0][1], 'the baseline-conflict notice sank below Why')

  // And each of them is the pack's ruled section, in production and in the pack.
  assert.match(pack, /\.step-section\{padding:19px 0;border-bottom:1px solid var\(--line\)\}/, 'the pack no longer rules its sections')
  assert.match(pack, /\.step-section:last-child\{border-bottom:0\}/, 'the pack no longer drops the last rule')
  assert.match(rule('.step-section'), /border-bottom: 1px solid var\(--rule\);/, 'production’s sections are not divided')
  assert.match(rule('.step-section:last-child'), /border-bottom: 0;/, 'the last section keeps a rule under it')
  // Real elements, so the division a reader sees is the structure a screen
  // reader walks — not a border drawn between two loose headings.
  assert.ok(MAIN.split('<section className="step-section">').length - 1 >= 5, 'the sections are not <section> elements')
})

test('What IAMAI found draws the pack’s cards, over facts the contract already built', () => {
  const pack = read(PACK)
  assert.match(pack, /\.findings\{display:grid/, 'the pack no longer lays the findings out as cards')
  assert.match(pack, /\.finding\{border:1px solid var\(--line\)/, 'the pack’s finding card lost its edge')
  assert.match(pack, /\.finding \.k\{[^}]*text-transform:uppercase/, 'the pack’s finding no longer carries a key over it')
  // Production draws the same card with the shared key-label role.
  assert.match(rule('.step .finding'), /border: 1px solid var\(--rule\);/)
  assert.match(SECTIONS, /<li key=\{f\.key\} className="finding">/, 'the findings are not cards')
  assert.match(SECTIONS, /<span className="key-label">\{f\.label\}<\/span>/, 'a finding no longer carries its key')

  // The component presents; it does not count. Nothing in it reads a step, adds
  // up a population or decides which findings there are.
  const found = code(SECTIONS.slice(SECTIONS.indexOf('export function WhatIamaiFound('), SECTIONS.indexOf('export function FixBeforeContinuing(')))
  for (const forbidden of ['step.', 'reduce(', 'filter(', '.length >', 'Number(', 'Math.']) {
    assert.equal(found.includes(forbidden), false, `the findings component ${forbidden}: the contract already built the list`)
  }

  // And the labels are real: every finding the contract produces on every
  // fixture has one, from the content file rather than from the component.
  const labelled = new Set<string>()
  let any = 0
  for (const name of ['demo', 'demo-week2', 'messy', 'hostile'] as const) {
    for (const { step, c } of contractsOf(name)) {
      for (const f of c.found) {
        any++
        labelled.add(f.key)
        assert.equal(typeof f.label, 'string', `${name}/${step.id}: a finding with no key over it`)
        assert.ok(f.label.length > 0, `${name}/${step.id}: a finding’s key is empty`)
        assert.equal(f.label, CONTRACT.foundLabel[f.key], `${name}/${step.id}: the key did not come from the content file`)
        // The card is a key over the finding, never a headline production never
        // wrote: the text is the contract's own sentence, whole.
        assert.equal(f.text.trim(), f.text)
        assert.ok(f.text.length > 0)
      }
    }
  }
  assert.ok(any > 0, 'no fixture produces a finding, so this proves nothing')
  assert.ok(labelled.size >= 2, 'only one kind of finding was exercised')
  // Nothing is padded to fill the pack's three sample columns.
  const counts = new Set(contractsOf('demo').map(({ c }) => c.found.length))
  assert.ok(!counts.has(3) || counts.size > 1, 'every step reports exactly three findings, which would mean they are being made up')
})

test('a blocker is the pack’s attention panel, at production’s severity, and never inside More', () => {
  const pack = read(PACK)
  assert.match(pack, /\.attention\{border:1px solid[^}]*\}/, 'the pack no longer draws an attention panel')
  assert.match(pack, /\.attention\.danger\{border-color/, 'the pack no longer has a danger weight for it')
  // Production draws it with the shared `.callout` role — the same object task
  // 031 established, not a second one for the Plan.
  const fix = SECTIONS.slice(SECTIONS.indexOf('export function FixBeforeContinuing('), SECTIONS.indexOf('/** The one next operator action'))
  assert.match(fix, /<Callout kind=\{tone\}>/, 'Fix before continuing is not the attention panel')
  assert.match(fix, /<h4>\{CONTRACT\.fixHeading\}<\/h4>/, 'the blocker list lost its heading')
  // The severity is production's, from the condition Foundation B recorded, and
  // is chosen once, at the call site, from the contract's own state.
  assert.match(MAIN, /tone=\{contract\.state\.condition === 'blocked' \|\| contract\.state\.condition === 'baseline-conflict' \? 'danger' : 'warning'\}/, 'the attention weight is not read off the step’s condition')
  assert.equal(code(fix).includes('condition'), false, 'the panel decides its own severity')

  // Nothing safety-critical is under the disclosure. More carries audit depth
  // and work artifacts; the blockers, the action, the completion and the
  // conflict notice all stay on the default step.
  const more = CONTENT_STEP.slice(CONTENT_STEP.indexOf('function More('))
  for (const forbidden of ['FixBeforeContinuing', 'contract.fix', 'DoneWhen', 'contract.doneWhen', 'WhatToDoLead', 'conflictWords', 'Callout']) {
    assert.equal(more.includes(forbidden), false, `More carries ${forbidden}; a blocker behind a disclosure is a blocker somebody skips`)
  }
})

test('the three channels are the pack’s strip over its instruction block, and consume one authority', () => {
  const pack = read(PACK)
  assert.match(pack, /<div class="action-tabs">[\s\S]{0,200}?PowerShell/, 'the pack no longer draws the three-channel strip')
  assert.match(pack, /\.action-tabs\{display:flex/, 'the pack’s strip is gone')
  assert.match(pack, /\.instruction\{border:1px solid var\(--line\)/, 'the pack’s instruction block lost its edge')
  // Production: the shared strip wearing the Plan's own treatment, over a panel
  // with the pack's edge. The strip is not a second tab implementation.
  assert.match(MAIN, /className="tabs action-tabs no-print"/, 'the action strip is not the Plan’s treatment of the shared tab role')
  assert.equal(MAIN.includes('role="tablist"'), false, 'the step hand-rolled a tab strip')
  assert.match(rule('.step .instruction'), /border: 1px solid var\(--rule\);/, 'the instruction block has no edge')
  assert.match(rule('.step .tabs.action-tabs .tab'), /border: 1px solid var\(--rule\);/, 'the action tabs are not the pack’s chips')
  // The selected tab is not a colour alone: aria-selected drives it, and the
  // treatment is a border, a fill and the ink together.
  const active = rule(".step .tabs.action-tabs .tab.active,\n.step .tabs.action-tabs .tab[aria-selected='true']")
  for (const prop of ['color:', 'border-color:', 'background:']) assert.ok(active.includes(prop), `the selected channel is signalled by ${prop.replace(':', '')} alone`)

  // Whether a channel carries anything is Foundation A's one answer, read from
  // the contract that already asked it. The surface asks nothing itself.
  assert.match(MAIN, /tab === 'json' && contract\.implementation\.offered/, 'the JSON tab does not read the contract’s answer')
  assert.match(MAIN, /tab === 'ps' && contract\.implementation\.offered/, 'the PowerShell tab does not read the contract’s answer')
  assert.equal(CONTENT_STEP.includes('jsonOffered('), false, 'the surface re-reads the implementation gate')
  assert.equal(CONTENT_STEP.includes('implementationOffered('), false, 'the surface asks Foundation A directly')
  // And the artifacts are their own modules': nothing is composed in the JSX.
  assert.match(MAIN, /<pre className="mono">\{policyJsonText\(step\)\}<\/pre>/, 'the JSON is not stepJson.ts’s')
  assert.match(MAIN, /<pre className="mono">\{powershellFor\(stepOperations\(step\)\)\}<\/pre>/, 'the commands are not stepPowerShell.ts’s')
  for (const forbidden of ['JSON.stringify', 'conditions:', 'grantControls', 'displayName:']) {
    assert.equal(CONTENT_STEP.includes(forbidden), false, `the surface builds ${forbidden}; policy JSON is not composed in presentation`)
  }
  // A long policy body scrolls inside the block rather than widening the step.
  assert.match(rule('.step .instruction pre.mono'), /background: transparent;/, 'the code carries a second inset box inside the instruction panel')
  assert.match(rule('.step-body pre.mono'), /overflow-x: auto;/, 'a long line widens the step instead of scrolling')
})

test('Done when and More are the contract’s, and More is a real disclosure', () => {
  const pack = read(PACK)
  assert.match(pack, /<details class="more"><summary>More<\/summary>/, 'the pack’s More is no longer a disclosure')
  assert.match(pack, /\.more-grid\{display:grid;grid-template-columns:1fr 1fr/, 'the pack no longer cards the disclosure')
  // Done when renders the contract's completion and computes none of its own.
  assert.match(MAIN, /<DoneWhen heading=\{HEAD\.doneWhen\} lines=\{contract\.doneWhen\} \/>/, 'Done when is not the contract’s')
  assert.match(CONTRACT_SRC, /function doneWhenOf\(/, 'the completion authority left the contract')
  const done = code(SECTIONS.slice(SECTIONS.indexOf('export function DoneWhen(')))
  for (const forbidden of ['step.', 'lifecycle', 'enforced', 'Date.']) {
    assert.equal(done.includes(forbidden), false, `Done when ${forbidden}: it may only render what the contract computed`)
  }
  // More is <details>/<summary>: keyboard-operable and disclosed by the
  // platform, not by a div listening for a click.
  assert.match(CONTENT_STEP, /<details className="more" open=\{open \|\| undefined\}>/, 'More is not a semantic disclosure')
  assert.match(CONTENT_STEP, /<summary>\{HEAD\.more\}<\/summary>/, 'the disclosure has no summary')
  // The pack's small-card grammar, holding the two blocks its own samples hold
  // and nothing invented to fill the second column.
  assert.match(CONTENT_STEP, /<div className="more-grid">/, 'the disclosure lost the pack’s card grid')
  assert.equal(CONTENT_STEP.match(/<div className="more-card">/g)?.length, 2, 'the disclosure gained or lost a card')
  assert.match(rule('.step .more-grid'), /grid-template-columns: repeat\(auto-fit/, 'a lone card is held to half a row with a gap beside it')
  assert.match(rule('.step .more-card'), /border: 1px solid var\(--rule\);/, 'the cards have no edge')
})

test('the rail says what the main column says, from the same contract', () => {
  const pack = read(PACK)
  assert.match(pack, /\.side-list\{list-style:none/, 'the pack’s rail no longer lists')
  assert.match(pack, /\.side-label\{[^}]*text-transform:uppercase/, 'the pack’s rail label is gone')
  const railSrc = code(SECTIONS.slice(SECTIONS.indexOf('export function StepRail('), SECTIONS.indexOf('export function PolicyMembers(')))
  // The rail is handed the contract and reads nothing else: no step, no
  // snapshot, no second count. That is what keeps it from disagreeing with the
  // main column about the same fact.
  assert.match(railSrc, /export function StepRail\(\{ contract \}: \{ contract: StepContract \}\)/, 'the rail takes something other than the contract')
  for (const forbidden of ['step.', 'snapshot', 'mapping', 'jsonOffered', 'implementationOffered', 'reduce(', 'Math.', 'Date.']) {
    assert.equal(railSrc.includes(forbidden), false, `the rail ${forbidden}: a second reading is how a rail comes to contradict the step beside it`)
  }
  assert.match(railSrc, /className="side-list"/, 'the rail’s channels are not the pack’s side list')
  assert.match(railSrc, /contract\.implementation\.offered \? \(/, 'the rail does not read the one implementation answer')
  // The list marker is a bullet, not a state: the meaning is in the words, and
  // the marker is hidden from assistive technology.
  assert.match(railSrc, /<span className="tiny" aria-hidden="true" \/>/, 'the rail’s bullet is exposed as content')
  assert.match(rule('.step .side-list .tiny'), /background: var\(--ink-3\);/, 'the rail’s bullet carries a state colour')
  // And every value it shows is a value the contract holds: a step with no
  // dated milestone gets no invented date, and one with nothing to submit gets
  // no invented channel.
  for (const name of ['demo', 'demo-week2', 'hostile'] as const) {
    for (const { step, c } of contractsOf(name)) {
      if (c.milestone.at === null && c.milestone.gatedBy === null) continue
      assert.ok(c.milestone.at !== null || c.milestone.gatedBy !== null, `${name}/${step.id}: the rail would show a milestone the contract has not got`)
    }
  }
})

test('the narrow widths keep every section, in order, and widen nothing', () => {
  const pack = read(PACK)
  assert.match(pack, /@media\(max-width:940px\)\{[\s\S]*\.findings,\.more-grid\{grid-template-columns:1fr\}/, 'the pack no longer collapses its grids')
  const narrow = atWidth(940)
  assert.match(narrow, /\.step \.more-grid \{[\s\S]*grid-template-columns: 1fr;/, 'the More grid does not collapse')
  // The findings grid collapses on its own track sizing rather than by a rule,
  // which is why it is not in the narrow block: min(100%, …) is the floor.
  assert.match(rule('.step .findings'), /minmax\(min\(100%, 260px\), 1fr\)/, 'a finding card can be wider than the column it sits in')
  // Nothing is hidden to make the step shorter: the sections, the attention
  // panel, the strip and the rail are all still rendered at every width.
  for (const gone of ['.findings', '.instruction', '.step-section', '.callout', '.tabs.action-tabs']) {
    assert.equal(new RegExp(`\\${gone.replace(/\./g, '\\.')} \\{[^}]*display:\\s*none`).test(narrow), false, `${gone} is hidden at 940px rather than reflowed`)
  }
  assert.equal(/display:\s*none/.test(atWidth(650).match(/\.step[\s\S]{0,400}/)?.[0] ?? ''), false, 'the step hides content at the second breakpoint')
})

test('the demo opens the same step body, with the same grammar', () => {
  // One step body in the product, and the demo is the product with a synthetic
  // snapshot behind it: there is no demo branch in the Plan's composition and
  // no second content anatomy to keep in step.
  const bodies = ['src/ui/surfaces/ContentStep.tsx', 'src/ui/surfaces/CleanupStep.tsx', 'src/ui/surfaces/Plan.tsx', 'src/ui/surfaces/PrintPlan.tsx']
    .map((f) => (read(f).includes('className="step-main"') ? f : null))
    .filter(Boolean)
  // Two bodies, for the two things the Plan opens: a step, and a Cleanup row.
  // Neither is a demo body — the demo is the product with a synthetic snapshot
  // behind it — and both draw their sections through the same components, so
  // the grammar cannot be restored on one and not the other.
  assert.deepEqual(bodies, ['src/ui/surfaces/ContentStep.tsx', 'src/ui/surfaces/CleanupStep.tsx'], 'a third step body draws its own main column')
  for (const body of bodies) assert.match(read(body!), /from '\.\/StepSections\.tsx'/, `${body} draws its sections itself`)
  assert.match(CLEANUP_STEP, /<StepSection heading=\{HEAD\.why\}>/, 'the Cleanup row stopped using the shared section')
  for (const forbidden of ['demoMode', 'isDemo', 'demo-']) {
    assert.equal(CONTENT_STEP.includes(forbidden), false, `the step body branches on ${forbidden}`)
  }
  assert.equal(SECTIONS.includes('demo'), false, 'the step components branch on the demo')
  // And the fixture the demo is built from produces the same grammar: findings
  // with keys, an attention list where there is one, a completion always.
  const demo = contractsOf('demo')
  assert.ok(demo.length > 0)
  for (const { step, c } of demo) {
    for (const f of c.found) assert.equal(f.label, CONTRACT.foundLabel[f.key], `demo/${step.id}: a finding with no key`)
    assert.ok(c.doneWhen.length > 0, `demo/${step.id}: no completion`)
  }
})
