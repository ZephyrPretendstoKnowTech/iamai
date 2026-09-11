// Task 033 — the approved Plan collapsed roadmap row; task 034 — the expanded frame.
//
// The same two-sided shape as src/ui/surfaces/connectAnatomy.test.ts (task
// 032): every assertion reads `docs/design/approved/anatomy/plan-step-v1.html` at test
// time and fails if the pack stops drawing what production claims to have
// restored, and reads production and fails if production stops drawing it. A
// green unit test that only knows about production can pass while the two
// drift apart, which is the failure this file exists to catch.
//
// It owns the ROW (task 033), the EXPANDED FRAME under it (task 034) and the
// CONTENT ANATOMY inside that frame (task 035): the join between them, the
// head, the lifecycle track, the main/rail body and its responsive collapse,
// the sticky shell the pack asks the Plan for, the canonical section order, the
// Readiness region, the attention treatment, the Implementation region and its
// dialogs, the Next milestone rail and the footer (owner update, Sep 10, 2026),
// and the five canonical states through that one frame.
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
import { CONTRACT, badgeLabel, eyebrowOf, implementationEmptyOf, implementationIsCurrent, railOf, readinessOf, stageClass, stepContract, stepTrack as trackFor } from './stepContract.ts'
import type { StepContract } from './stepContract.ts'
import { absoluteDate } from '../../copy/dates.ts'
import type { StepVarContext } from './stepVars.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { Step } from '../../roadmap/types.ts'
import type { Lifecycle } from '../../roadmap/lifecycle.ts'

const read = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

const PACK = 'docs/design/approved/anatomy/plan-step-v1.html'
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
  // 14px, not the pack's 18px. The pack draws the row on its own; the final
  // organisation reference draws it under a column head in a group, and sets
  // `gap:14px` on both so the head and the rows it names share one track set
  // (docs/design/approved/reference/iamai-plan-organization-final.html
  // `.column-head,.row`). That file owns the board; the pack still owns the
  // opened step, and neither supersedes the other.
  assert.match(row, /gap: 14px;/)
  assert.match(rule('.plan-column-head'), /grid-template-columns: 126px minmax\(0, 1fr\) 240px 125px;/, 'the column head does not sit on the row’s tracks')
  assert.match(rule('.plan-column-head'), /gap: 14px;/, 'the column head and the rows under it are on different gaps')
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
  assert.match(rule('.plan-row .who,\n.plan-row .when'), /color: var\(--quiet-text\);/)
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
  // Nothing is hidden ON THE ROW. The rule reads the row's own declarations
  // rather than the whole breakpoint, because the COLUMN HEAD does drop its
  // third and fourth headings here — and must: the row no longer has a third or
  // a fourth column for them to name, so a heading left standing would label a
  // column that is not there. The zones themselves move under the title, which
  // is what the two assertions above prove.
  const rowAtNarrow = narrow.match(/\.plan-row \{[^}]*\}/)?.[0] ?? ''
  assert.ok(rowAtNarrow !== '', 'the row has no rule at the narrow width')
  assert.equal(/display:\s*none/.test(rowAtNarrow), false, 'a zone is hidden at the narrow width instead of moved')
  assert.match(narrow, /\.plan-column-head \{[\s\S]*grid-template-columns: 110px minmax\(0, 1fr\);/, 'the column head does not follow the row it heads')
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
  // A step nothing holds: the word reads the hold (roadmap/holds.ts), which reads the step's kind and blockers.
  const step = (over: Record<string, unknown>): Step => ({ status: 'ready', kind: 'prerequisite', blockers: [], state: { inPlace: false, lifecycle: 'not-deployed', condition: 'healthy' }, operatorSafe: true, ...over }) as unknown as Step
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
  // The timing zone still reads `rowWhen` and nothing else — but through the
  // board's own reading of it (planBoard.ts `boardWhenOf`), which drops the
  // generic `now` and says `Held` exactly where roadmap/holds.ts holds the step.
  // It takes the VALUE and chooses what to show; it computes no date, and every
  // other surface still calls `rowWhen` directly.
  assert.match(PLAN, /const when = boardWhenOf\(step, group\.start, titleOf\)/, 'the timing zone no longer reads the one when authority')
  assert.match(PLAN, /when=\{when\}/, 'the row is no longer handed the board’s timing value')
  // The reason and the wrap are the board's readings of the same two authorities
  // (planBoard.ts boardReasonOf over rowReason, boardWhenWraps over rowWhenWraps).
  assert.match(PLAN, /reason=\{boardReasonOf\(step, when\)\}/, 'the quiet line no longer reads the one reason authority')
  assert.match(PLAN, /whenReason=\{boardWhenWraps\(step, when\)\}/)
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
  assert.match(openRow, /border: 1px solid var\(--line\);/, 'the open row does not carry the frame it heads')
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
  assert.match(rule('.step .track .stage.current .stage-label'), /color: var\(--primary-text\);/, 'the current stage is marked by colour alone')
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
  // Ready to enforce is a STATE and takes a semantic role, not the brand: the
  // brand answers "this is IAMAI, this is selected", never "the tenant is in a
  // good state" (docs/brand/brand-manifest.json semantics). The approved step
  // reference paints this stage `var(--success)` with the stages already passed,
  // which is what it means — the gates have closed and the change is earned.
  // The 84% stays: the stage is reached, not finished.
  assert.match(rule('.step .track .stage.current.stage-ready-to-enforce .stage-fill'), /width: 84%;\n\s*background: var\(--success\);/, 'Ready to enforce lost its own treatment')
  assert.equal(rule('.step .track .stage.current.stage-ready-to-enforce .stage-fill').includes('--brand-primary'), false, 'the brand is painting a tenant state')
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
  assert.match(rule('.step-body.has-rail'), /grid-template-columns: minmax\(0, 1fr\) 290px;/, 'the desktop body is not main + rail')
  assert.match(rule('.step-side'), /border-left: 1px solid var\(--line\);/, 'the rail is not divided from the main column')
  const narrow = atWidth(940)
  assert.match(narrow, /\.step-body\.has-rail \{[\s\S]*grid-template-columns: minmax\(0, 1fr\);/, 'the body does not collapse to one column')
  assert.match(narrow, /\.step-side \{[\s\S]*border-top: 1px solid var\(--line\);/, 'the rail does not move below the main column')
  assert.equal(/\.step-side \{[^}]*display:\s*none/.test(narrow), false, 'the rail is hidden rather than moved')
  // One rail, in one place in the DOM, on every step: the Next milestone is a
  // fact every step has, so the rail is never gated and never duplicated.
  assert.equal(CONTENT_STEP.split('<StepRail').length - 1, 1, 'the step draws more than one rail')
  assert.match(CONTENT_STEP, /<div className="step-body has-rail">/, 'the body does not lay out the rail')
  assert.match(CONTENT_STEP, /<StepRail contract=\{contract\} when=\{when\} \/>/, 'the rail is gated')
})

test('the Plan’s topbar sticks, through the one shell the product already has', () => {
  const pack = read(PACK)
  assert.match(pack, /\.topbar\{[\s\S]{0,60}position:sticky;top:0/, 'the pack no longer defines a sticky topbar')
  assert.match(SHELL, /const sticky = planActive/, 'the Plan does not turn on the sticky shell its pack asks for')
  assert.match(SHELL, /className=\{`shell\$\{sticky \? ' shell-sticky' : ''\}`\}/, 'the sticky state is not set on the one shell')
  assert.match(CSS, /\.shell\.shell-sticky header\.app \{[\s\S]*?position: sticky;/, 'the sticky rule left the shell')
  assert.match(CSS, /\.shell\.shell-sticky \[id\] \{\s*\n\s*scroll-margin-top:/, 'a sticky header without an anchor offset lands every in-page link under itself')
  assert.equal(SHELL.match(/<header className="app">/g)?.length, 1, 'the shell renders more than one application header')
})

test('the frame is production’s composition, not a second reading of the engine', () => {
  // The head, the track, the rail, the footer, Readiness and the dialogs render
  // the contract and nothing else. The code, without its prose: a comment naming
  // the authority a component defers to is documentation, not a second reading.
  const parts = code(SECTIONS.slice(SECTIONS.indexOf('export function StepHead('), SECTIONS.indexOf('export function PolicyMembers(')))
  for (const forbidden of ['implementationOffered', 'unavailableReason', 'policyHold', 'nextMilestone', 'statusOf', 'projectStatus', 'heldForReview']) {
    assert.equal(parts.includes(forbidden), false, `the frame calls ${forbidden}; the contract already answered it`)
  }
  // The projection reads Foundation B's lifecycle and never rebuilds one: a stage
  // is reached because the recorded lifecycle is past it; a set-aside step and a
  // step whose source contradicts itself draw no rollout.
  assert.match(CONTRACT_SRC, /const LIFECYCLE_ORDER: Lifecycle\[\] = \['not-deployed', 'report-only', 'ready-to-enforce', 'enforced'\]/, 'the lifecycle order left the contract')
  const trackOf = CONTRACT_SRC.slice(CONTRACT_SRC.indexOf('function stepTrack'), CONTRACT_SRC.indexOf('function stepTrack') + 700)
  assert.match(trackOf, /if \(s\.lifecycle === null \|\| s\.setAside \|\| s\.condition === 'baseline-conflict'\) return \[\]/, 'a rollout is drawn for a step that has none')
  for (const forbidden of ['advanceState', 'setState', 'Date.', 'percent']) {
    assert.equal(trackOf.includes(forbidden), false, `the track projection ${forbidden}: it may only restate the recorded lifecycle`)
  }
})

test('the track projects the recorded lifecycle and nothing else', () => {
  const at = (s: Step): { labels: string[]; reached: boolean[]; current: number } => {
    const t = trackFor(s)
    return { labels: t.map((x) => x.label), reached: t.map((x) => x.reached), current: t.findIndex((x) => x.current) }
  }
  assert.deepEqual(at(step({})).labels, ['Not deployed', 'Report-only', 'Ready to enforce', 'Enforced'])
  assert.deepEqual(at(step({})).reached, [false, false, false, false])
  assert.equal(at(step({})).current, 0)
  const ro = step({ state: { inPlace: false, setAside: false, satisfied: false, lifecycle: 'report-only', condition: 'healthy' } })
  assert.deepEqual(at(ro).reached, [true, false, false, false])
  assert.equal(at(ro).current, 1)
  // The condition moves on its own axis and moves no stage.
  const held = step({ state: { inPlace: false, setAside: false, satisfied: false, lifecycle: 'report-only', condition: 'review-required' } })
  assert.deepEqual(at(held), at(ro), 'a condition advanced or retreated the lifecycle')
  const blocked = step({ status: 'blocked', state: { inPlace: false, setAside: false, satisfied: false, lifecycle: 'not-deployed', condition: 'blocked' } })
  assert.deepEqual(at(blocked).reached, [false, false, false, false], 'a blocked step claims progress it has not made')
  // A goal the tenant already delivers draws the lifecycle its policy recorded:
  // the approved In-place variant draws four reached stages.
  const pack = read(PACK)
  const v4 = pack.slice(pack.indexOf('id="v4"'), pack.indexOf('id="v5"'))
  assert.equal(v4.split('<div class="stage done"></div>').length - 1, 4, 'the pack no longer draws the In-place lifecycle as reached')
  assert.deepEqual(at(step({ status: 'done', state: { inPlace: true, setAside: false, satisfied: true, lifecycle: 'enforced', condition: 'healthy' } })).reached, [true, true, true, true])
  // A resolution step draws no track, whatever lifecycle it carries — and the pack draws none.
  const v5 = pack.slice(pack.indexOf('id="v5"'), pack.indexOf('id="decisions"'))
  assert.equal(v5.includes('class="track"'), false, 'the pack now draws a lifecycle on its resolution variant')
  assert.deepEqual(trackFor(step({ state: { inPlace: false, setAside: false, satisfied: false, lifecycle: 'not-deployed', condition: 'baseline-conflict' } })), [])
  assert.deepEqual(trackFor(step({ state: { inPlace: false, setAside: true, satisfied: false, lifecycle: 'not-deployed', condition: 'healthy' } })), [])
  assert.deepEqual(trackFor(step({ state: { inPlace: false, setAside: false, satisfied: false, lifecycle: null, condition: 'healthy' } })), [])
})

test('no generated attribution or tagline came in with the design work', () => {
  for (const file of ['src/ui/surfaces/Plan.tsx', 'src/ui/surfaces/StepSections.tsx', 'src/ui/surfaces/PlanFooter.tsx', 'src/ui/app.css']) {
    assert.equal(/jon hope|built by/i.test(read(file)), false, `${file} carries a generated attribution`)
  }
  const content = read('docs/design/content.json')
  const mentions = [...content.matchAll(/[^"]*built by Jon Hope[^"]*/gi)].map((m) => m[0].trim())
  assert.equal(mentions.length, 1, 'a second attribution was added')
  assert.match(mentions[0], /Conditional Access policies, built by Jon Hope, a Microsoft MVP\.$/, 'the baseline author sentence changed')
  const home = JSON.parse(content).pages.home as { about: string; baseline: string; brand: string }
  assert.match(home.about, /^Built by Lachlan Robinette\./)
  assert.ok(!home.brand.includes('Jon Hope'), 'the wordmark carries an attribution')
})

// ------------------------------------ the approved step anatomy (owner update, Sep 10, 2026)

/** The opened step's main column, which is all of the markup the anatomy orders. */
const MAIN = ((): string => {
  const from = CONTENT_STEP.indexOf('<div className="step-main">')
  assert.ok(from >= 0, 'ContentStep still draws the main column')
  return CONTENT_STEP.slice(from, CONTENT_STEP.indexOf('<StepRail contract', from))
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

type VariantId = 'v1' | 'v2' | 'v3' | 'v4' | 'v5'
const VARIANTS: VariantId[] = ['v1', 'v2', 'v3', 'v4', 'v5']

/** One canonical variant of the approved pack, by its id. */
function variant(pack: string, id: VariantId): string {
  const i = VARIANTS.indexOf(id)
  const from = pack.indexOf(`id="${id}"`)
  const to = i < VARIANTS.length - 1 ? pack.indexOf(`id="${VARIANTS[i + 1]}"`) : pack.indexOf('id="decisions"')
  assert.ok(from > 0 && to > from, `the pack no longer draws variant ${id}`)
  return pack.slice(from, to)
}

/** The regions a pack variant's main column draws, in order: a section's heading, or the attention panel it holds. */
const regions = (html: string): string[] =>
  [...html.matchAll(/<section class="step-section[^"]*"[^>]*>\s*(?:<h4>([^<]+)<\/h4>|<div class="attention( danger)?">)/g)].map((m) => m[1] ?? (m[2] ? 'attention danger' : 'attention'))

test('every approved variant draws the same regions, and production runs them in that order', () => {
  const pack = read(PACK)
  assert.match(pack, /Right rail is intentionally Next milestone only in current canonical variants/, 'the pack no longer states that the rail is Next milestone only')
  assert.deepEqual(regions(variant(pack, 'v1')), ['Why', 'Readiness', 'Implementation', 'Done when'])
  assert.deepEqual(regions(variant(pack, 'v2')), ['Why', 'Readiness', 'What to do', 'Implementation', 'Done when'])
  assert.deepEqual(regions(variant(pack, 'v3')), ['Why', 'Readiness', 'attention', 'What to do', 'Implementation', 'Done when'])
  assert.deepEqual(regions(variant(pack, 'v4')), ['Why', 'Readiness', 'What to do', 'Implementation', 'Done when'])
  assert.deepEqual(regions(variant(pack, 'v5')), ['Why', 'Readiness', 'attention danger', 'What to do', 'Implementation', 'Done when'])
  // The regions the owner's update took out of the step, and that none of the
  // canonical variants draws.
  for (const id of VARIANTS) {
    for (const gone of ['What IAMAI found', 'Who this touches', '<details class="more"']) assert.equal(variant(pack, id).includes(gone), false, `${id} draws ${gone} again`)
  }

  // Production: the same order, read off the markup. The anchors are what each
  // region is, not what it says, so a wording change does not reorder the step.
  const at = (needle: string): number => {
    const i = MAIN.indexOf(needle)
    assert.ok(i >= 0, `the opened step no longer renders ${needle}`)
    return i
  }
  const order = [
    ['why', at('<h4>{HEAD.why}</h4>')],
    ['readiness', at('<ReadinessSection')],
    ['conflict attention', at('{conflictWords && (')],
    ['fix attention', at('<FixBeforeContinuing fix={contract.fix}')],
    ['what to do', at('{showWhatToDo && (')],
    ['implementation', at('<Implementation\n')],
    ['done when', at('<DoneWhen heading={HEAD.doneWhen}')],
  ] as const
  assert.deepEqual([...order].sort((a, b) => a[1] - b[1]).map((x) => x[0]), order.map((x) => x[0]), 'the opened step’s regions are not in the approved order')
  // What IAMAI found, Who this touches, Dates and More are on the printed page
  // only; on screen they are the Readiness evidence dialog, outside the column.
  const printed = at('{printing && (')
  for (const needle of ['<WhatIamaiFound', '<More', '<h4>{HEAD.who}</h4>', '<h4>{HEAD.dates}</h4>']) {
    assert.ok(at(needle) > printed, `${needle} is on the opened step outside the printed page`)
  }
  // Done when is drawn on every step, gated by nothing.
  assert.match(MAIN, /\n\s*<DoneWhen heading=\{HEAD\.doneWhen\} lines=\{contract\.doneWhen\} \/>/, 'Done when is gated')
  // Each region is the pack's ruled section.
  assert.match(pack, /\.step-section\{padding:19px 0;border-bottom:1px solid var\(--line\)\}/, 'the pack no longer rules its sections')
  assert.match(rule('.step-section'), /border-bottom: 1px solid var\(--line\);/, 'production’s sections are not divided')
  assert.match(rule('.step-section:last-child'), /border-bottom: 0;/, 'the last section keeps a rule under it')
})

test('Readiness is the pack’s tiles over its bar, from facts the contract already holds', () => {
  const pack = read(PACK)
  assert.match(pack, /\.readiness-strip\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\);gap:10px\}/, 'the pack no longer lays Readiness out as three tiles')
  assert.match(pack, /\.readiness-tile\{[^}]*min-height:104px/, 'the pack’s tile lost its height')
  assert.match(pack, /\.readiness-bar\{display:flex;justify-content:space-between/, 'the pack’s bar is gone')
  assert.match(pack, /Why IAMAI says this →/, 'the pack no longer opens the readiness evidence')
  assert.match(pack, /<dialog aria-labelledby="readiness-dialog-title" id="readiness-dialog">/, 'the pack’s readiness dialog is gone')
  assert.match(rule('.step .readiness-strip'), /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/, 'production’s strip is not three tracks')
  assert.match(rule('.step .readiness-tile'), /min-height: 104px;/)
  assert.match(rule('.step .readiness-bar'), /justify-content: space-between;/)
  // The component presents; it does not count, and a mark never carries a state on its own.
  const section = code(SECTIONS.slice(SECTIONS.indexOf('export function ReadinessSection('), SECTIONS.indexOf('/** The truthful no-action box')))
  for (const forbidden of ['step.', 'reduce(', 'Math.', 'implementation.offered']) assert.equal(section.includes(forbidden), false, `Readiness ${forbidden}`)
  assert.match(section, /className=\{`readiness-strip tiles-\$\{readiness\.tiles\.length\}`\}/, 'the strip is padded to three tracks')
  assert.match(section, /aria-hidden="true"/, 'the tile mark is announced as content')
  assert.match(section, /<strong>\{t\.value\}<\/strong>/, 'a tile’s state is not a word')
  // And over every plan the fixtures build: one to three tiles, each a label over
  // a value the contract holds, and a headline from the content file.
  const bars = new Set(Object.values(CONTRACT.readiness.bar))
  for (const name of ['demo', 'demo-week2', 'messy', 'hostile'] as const) {
    for (const { step: s, c } of contractsOf(name)) {
      const r = readinessOf(s, c)
      assert.ok(r.tiles.length >= 1 && r.tiles.length <= 3, `${name}/${s.id}: ${r.tiles.length} tiles`)
      for (const t of r.tiles) assert.ok(t.label.trim() !== '' && t.value.trim() !== '', `${name}/${s.id}: an empty tile`)
      assert.ok(bars.has(r.bar.main), `${name}/${s.id}: the bar’s headline is not the content file’s`)
      const people = r.tiles.find((t) => t.key === 'people')
      if (people && c.who?.known) assert.equal(people.value, c.who.text, `${name}/${s.id}: the people tile counts on its own`)
    }
  }
})

test('Implementation is the pack’s pill channels over a fixed preview, or one truthful no-action box', () => {
  const pack = read(PACK)
  const v1 = variant(pack, 'v1')
  assert.deepEqual([...v1.matchAll(/class="impl-tab(?: active)?"[^>]*>([^<]+)</g)].map((m) => m[1]), ['Entra', 'PowerShell', 'JSON', 'AI Info'], 'the pack’s channels moved')
  assert.match(pack, /\.impl-tab\{[^}]*border-radius:999px/, 'the pack’s channels are no longer pills')
  assert.match(pack, /\.impl-preview\{height:112px/, 'the pack’s preview lost its height')
  assert.match(v1, /aria-label="Copy implementation"[\s\S]*aria-label="Expand implementation"/, 'the pack’s preview controls are gone')
  assert.match(pack, /<dialog aria-labelledby="implementation-dialog-title" id="implementation-dialog">/, 'the pack’s implementation dialog is gone')
  // The variants that offer nothing draw the no-action box at the weight of their reason.
  assert.match(variant(pack, 'v2'), /class="implementation-empty"/)
  assert.match(variant(pack, 'v3'), /class="implementation-empty warn"/)
  assert.match(variant(pack, 'v4'), /class="implementation-empty good"/)
  assert.match(variant(pack, 'v5'), /class="implementation-empty danger"/)
  for (const id of ['v2', 'v3', 'v4', 'v5'] as const) assert.equal(variant(pack, id).includes('class="impl-tab'), false, `${id} offers an implementation`)

  assert.match(rule('.step .tabs.impl-tabs .tab'), /border-radius: 999px;/, 'production’s channels are not pills')
  assert.match(rule('.step .impl-preview'), /height: 112px;/, 'production’s preview lost its height')
  assert.match(CONTENT_STEP, /className="tabs impl-tabs no-print"/, 'the channels are not the shared tab role')
  // The artifacts are their own modules', and nothing is composed in the JSX.
  assert.match(CONTENT_STEP, /policyJsonText\(step\)/)
  assert.match(CONTENT_STEP, /powershellFor\(stepOperations\(step\)\)/)
  assert.match(CONTENT_STEP, /stepContext\(step, \(s\) => stepExportView\(s, ctx\)\)/, 'AI Info is not the step context the prompts ground themselves in')
  for (const forbidden of ['JSON.stringify', 'conditions:', 'grantControls', 'displayName:']) {
    assert.equal(CONTENT_STEP.includes(forbidden), false, `the surface builds ${forbidden}; policy JSON is not composed in presentation`)
  }
  // Tenant context is flagged wherever the AI channel is shown.
  assert.equal(CONTENT_STEP.split("{tab === 'ai' && (").length - 1, 2, 'the AI channel is shown without its tenant-context warning')
  assert.match(rule('.step .impl-preview .preview-text'), /overflow-wrap: anywhere;/, 'a long line widens the step')
})

test('Done when is prose on every step, and the footer carries the rollout exception and the scan', () => {
  const pack = read(PACK)
  assert.match(variant(pack, 'v1'), /<section class="step-section"><h4>Done when<\/h4><p>/, 'the pack’s Done when is no longer prose')
  assert.match(variant(pack, 'v1'), /<footer class="step-footer"><button class="btn rollout-exception" type="button">Exclude from rollout<\/button><button class="btn primary scan-update-plan"/, 'the pack’s footer moved')
  assert.equal(variant(pack, 'v2').includes('rollout-exception'), false, 'the pack offers the exception on a step that is not excludable')
  assert.match(pack, /It does not count as implemented or as satisfying the baseline\./, 'the pack’s exception no longer says what it does not count as')
  assert.match(pack, /@media\(max-width:650px\)\{\.step-footer\{padding-left:18px;padding-right:18px;align-items:flex-start;flex-direction:column\}/)

  assert.match(SECTIONS.slice(SECTIONS.indexOf('export function DoneWhen(')), /<p key=\{i\} className="done-line">/, 'Done when is not prose')
  assert.match(CONTRACT.rollout.body, /does not count as implemented/, 'the exception no longer says it does not count as implemented')
  assert.match(CONTENT_STEP, /cs\.skip \? <Button key="exclude" variant="secondary" className="rollout-exception"/, 'the exception is offered on a step the content does not mark excludable')
  assert.match(atWidth(650), /\.step-footer \{\n\s*flex-direction: column;/, 'the footer does not stack on a phone')
})

test('the rail is the Next milestone only, from the same contract', () => {
  const pack = read(PACK)
  for (const id of VARIANTS) {
    const v = variant(pack, id)
    assert.match(v, /<aside class="step-side"><div class="side-block"><div class="side-label">Next milestone<\/div>/, `${id}: the pack’s rail is not the Next milestone`)
    assert.equal(v.split('class="side-block"').length - 1, 1, `${id}: the pack’s rail holds more than one block`)
  }
  const railSrc = code(SECTIONS.slice(SECTIONS.indexOf('export function StepRail('), SECTIONS.indexOf('export function StepFooter(')))
  // The contract, and the row's When column it repeats for an undated held step (planState.ts), and nothing else.
  assert.match(railSrc, /export function StepRail\(\{ contract, when = null \}: \{ contract: StepContract; when\?: string \| null \}\)/, 'the rail takes something other than the contract')
  assert.match(railSrc, /railOf\(contract, when\)/, 'the rail does not read the contract’s one projection')
  for (const forbidden of ['step.', 'snapshot', 'mapping', 'implementation', 'side-list', 'reduce(', 'Math.', 'Date.']) {
    assert.equal(railSrc.includes(forbidden), false, `the rail ${forbidden}: it is the Next milestone and nothing else`)
  }
  for (const name of ['demo', 'demo-week2', 'hostile'] as const) {
    for (const { step: s, c } of contractsOf(name)) {
      const r = railOf(c)
      assert.ok(r.metric.trim() !== '' && r.sub.trim() !== '', `${name}/${s.id}: an empty rail`)
      if (c.milestone.at !== null) assert.equal(r.metric, absoluteDate(c.milestone.at), `${name}/${s.id}: the rail’s date is not the milestone’s`)
    }
  }
})

test('the narrow widths collapse the approved regions and widen nothing', () => {
  const pack = read(PACK)
  assert.match(pack, /@media\(max-width:940px\)\{\.readiness-strip\{grid-template-columns:1fr\}\.readiness-bar\{align-items:flex-start;flex-direction:column\}\}/, 'the pack no longer collapses Readiness at 940')
  const narrow = atWidth(940)
  assert.match(narrow, /\.step \.readiness-strip,\s*\.step \.readiness-strip\.tiles-2 \{\s*grid-template-columns: minmax\(0, 1fr\);/, 'Readiness does not stack at 940')
  assert.match(narrow, /\.step \.readiness-bar \{\s*flex-direction: column;/, 'the bar does not stack at 940')
  for (const gone of ['.readiness-strip', '.impl-preview', '.step-section', '.callout', '.tabs.impl-tabs']) {
    assert.equal(new RegExp(`\\${gone.replace(/\./g, '\\.')} \\{[^}]*display:\\s*none`).test(narrow), false, `${gone} is hidden at 940px rather than reflowed`)
  }
  assert.equal(/display:\s*none/.test(atWidth(650).match(/\.step[\s\S]{0,400}/)?.[0] ?? ''), false, 'the step hides content at the second breakpoint')
  // Code wraps inside its own box, in the preview and in the dialog.
  assert.match(rule('.step-dialog .dialog-code'), /white-space: pre-wrap;/)
  assert.match(rule('.step-dialog .dialog-content'), /overflow: auto;/, 'the dialog’s content scrolls the page instead of itself')
})

// ---------------------------------------------- the five canonical states

type Mock = { step: Step; c: StepContract }

/** A step and its contract in one canonical state, carrying only the fields the projections read. */
function stateOf(o: {
  lifecycle: Lifecycle | null
  condition: string
  kind: StepContract['whatToDo']['kind']
  status?: string
  satisfied?: boolean
  inPlace?: boolean
  at?: string | null
  gatedBy?: string | null
  offered?: boolean
  reason?: string | null
  hold?: string | null
  fix?: number
  observation?: string | null
}): Mock {
  const s = step({ status: o.status ?? 'ready', action: {}, state: { lifecycle: o.lifecycle, condition: o.condition, satisfied: o.satisfied ?? false, inPlace: o.inPlace ?? false, setAside: false, members: [], observation: o.observation ? { note: o.observation } : null } })
  const stage = o.satisfied ? (o.inPlace || o.lifecycle !== 'enforced' ? CONTRACT.lifecycle['in-place'] : CONTRACT.lifecycle.enforced) : o.lifecycle ? CONTRACT.lifecycle[o.lifecycle] : ''
  const c = {
    state: { lifecycle: o.lifecycle, condition: o.condition, stage, conditionLabel: CONTRACT.condition[o.condition], setAside: false, inPlace: o.inPlace ?? false, satisfied: o.satisfied ?? false, word: 'Blocked', tone: 'stop' },
    milestone: { kind: o.kind, label: 'The milestone’s own words.', at: o.at ?? null, gatedBy: o.gatedBy ?? null, line: null },
    track: trackFor(s),
    why: 'Why.',
    found: [],
    who: { known: true, text: '4 active people' },
    whatToDo: { kind: o.kind, text: 'The one action.' },
    fix: Array.from({ length: o.fix ?? 0 }, (_, i) => ({ key: `f${i}`, text: 'Fix it.' })),
    doneWhen: ['Done.'],
    members: [],
    multiPolicy: false,
    existing: null,
    implementation: o.offered ? { offered: true, operations: 1 } : { offered: false, reason: o.reason ?? null, hold: o.hold ?? null, because: o.reason ? 'Because.' : null },
  } as unknown as StepContract
  return { step: s, c }
}

const STATES = {
  'not-deployed': stateOf({ lifecycle: 'not-deployed', condition: 'healthy', kind: 'deploy', at: '2026-09-22T00:00:00.000Z', offered: true }),
  'report-only': stateOf({ lifecycle: 'report-only', condition: 'healthy', status: 'in-report-only', kind: 'observe', at: '2026-09-17T00:00:00.000Z', hold: 'observation-incomplete' }),
  'review-required': stateOf({ lifecycle: 'report-only', condition: 'review-required', status: 'in-report-only', kind: 'resolve', hold: 'observation-incomplete', observation: 'The policy changed since IAMAI last read it.', gatedBy: 'The policy changed since IAMAI last read it.', fix: 1 }),
  'in-place': stateOf({ lifecycle: 'enforced', condition: 'healthy', status: 'done', satisfied: true, inPlace: true, kind: 'preserve' }),
  'baseline-conflict': stateOf({ lifecycle: null, condition: 'baseline-conflict', status: 'blocked', kind: 'resolve', reason: 'baseline-conflict' }),
} as const

test('the five canonical states are one frame whose content the state changes', () => {
  // One frame: one article, head, body, rail and footer, one render path, and
  // nothing in the frame chooses a component from where a step stands.
  for (const [needle, n] of [['<article className="step', 1], ['<StepHead', 1], ['<ReadinessSection', 1], ['<Implementation\n', 1], ['<StepRail', 1], ['<StepFooter', 1]] as const) {
    assert.equal(CONTENT_STEP.split(needle).length - 1, n, `${needle} appears ${CONTENT_STEP.split(needle).length - 1} times`)
  }
  const body = CONTENT_STEP.slice(CONTENT_STEP.indexOf('export function ContentStep'), CONTENT_STEP.indexOf('function Implementation('))
  assert.equal(body.split('return (').length - 1, 1, 'the step has more than one render path')
  for (const [file, src] of [['ContentStep.tsx', CONTENT_STEP], ['StepSections.tsx', SECTIONS]] as const) {
    assert.equal(/standingOf|stepFamily|title\.(includes|match)/.test(code(src)), false, `${file} selects presentation from the step’s standing, family or title`)
  }
  // No duplicate shell or header inside the step.
  assert.equal(/<header className="app"|AppShell|<nav\b/.test(CONTENT_STEP + SECTIONS), false, 'the step draws a shell of its own')

  const S = STATES
  // Lifecycle and condition stay apart: the badge composes them, the track is the
  // lifecycle alone, and a review moves no stage.
  assert.equal(badgeLabel(S['not-deployed'].c), 'Not deployed')
  assert.equal(badgeLabel(S['report-only'].c), 'Report-only')
  assert.equal(badgeLabel(S['review-required'].c), 'Report-only · Review required')
  assert.equal(badgeLabel(S['in-place'].c), 'In place')
  assert.deepEqual(S['review-required'].c.track, S['report-only'].c.track, 'a condition moved the lifecycle')
  assert.deepEqual(S['not-deployed'].c.track.map((t) => [t.reached, t.current]), [[false, true], [false, false], [false, false], [false, false]])
  assert.deepEqual(S['report-only'].c.track.map((t) => t.reached), [true, false, false, false])
  assert.deepEqual(S['in-place'].c.track.map((t) => t.reached), [true, true, true, true])
  assert.deepEqual(S['baseline-conflict'].c.track, [])
  assert.equal(eyebrowOf(S['baseline-conflict'].c, 'policy'), CONTRACT.kind.resolution)
  for (const k of ['not-deployed', 'report-only', 'review-required', 'in-place'] as const) assert.equal(eyebrowOf(S[k].c, 'policy'), CONTRACT.kind.policy)

  // Readiness: tiles and headline, per state.
  const tiles = (m: Mock): string[] => readinessOf(m.step, m.c).tiles.map((t) => `${t.key}:${t.tone}`)
  assert.deepEqual(tiles(S['not-deployed']), ['people:info', 'blockers:good'])
  assert.deepEqual(tiles(S['report-only']), ['observation:wait', 'people:info', 'blockers:good'])
  assert.deepEqual(tiles(S['review-required']), ['evidence:warn', 'people:info', 'blockers:warn'])
  assert.deepEqual(tiles(S['in-place']), ['coverage:good', 'people:info', 'blockers:good'])
  assert.deepEqual(tiles(S['baseline-conflict']), ['baseline:warn', 'people:info', 'implementation:warn'])
  const bar = (m: Mock): string => readinessOf(m.step, m.c).bar.main
  const B = CONTRACT.readiness.bar
  assert.deepEqual(
    [bar(S['not-deployed']), bar(S['report-only']), bar(S['review-required']), bar(S['in-place']), bar(S['baseline-conflict'])],
    [B.deploy, B.observe, B.review, B.preserve, B.conflict],
  )

  // Implementation only where it is the current action; otherwise the one box, at the weight of the reason.
  assert.equal(implementationIsCurrent(S['not-deployed'].step), true)
  assert.equal(S['not-deployed'].c.implementation.offered, true)
  for (const k of ['review-required', 'baseline-conflict'] as const) assert.equal(implementationIsCurrent(S[k].step), false, `${k} offers its implementation`)
  for (const k of ['report-only', 'in-place', 'baseline-conflict'] as const) assert.equal(S[k].c.implementation.offered, false, `${k} offers an artifact`)
  const empty = (m: Mock): string => `${implementationEmptyOf(m.c).key}:${implementationEmptyOf(m.c).tone}`
  assert.deepEqual(
    [empty(S['report-only']), empty(S['review-required']), empty(S['in-place']), empty(S['baseline-conflict'])],
    ['observe:neutral', 'review:warn', 'inPlace:good', 'conflict:danger'],
  )

  // The Next milestone rail: the date where there is one, the standing word where there is not.
  const W = CONTRACT.rail
  assert.equal(railOf(S['not-deployed'].c).metric, absoluteDate('2026-09-22T00:00:00.000Z'))
  assert.equal(railOf(S['report-only'].c).metric, absoluteDate('2026-09-17T00:00:00.000Z'))
  assert.equal(railOf(S['review-required'].c).metric, W.held)
  assert.equal(railOf(S['in-place'].c).metric, W.noChange)
  assert.equal(railOf(S['baseline-conflict'].c).metric, W.deferred)
})

test('the opened step mutates nothing: its only actions are the exception, the scan, the decision and copying', () => {
  for (const [file, src] of [['ContentStep.tsx', CONTENT_STEP], ['StepSections.tsx', SECTIONS]] as const) {
    const c = code(src)
    for (const forbidden of ['fetch(', "from '../../graph", 'graphClient', "method: 'POST'", "method: 'PATCH'", 'XMLHttpRequest']) {
      assert.equal(c.includes(forbidden), false, `${file} carries ${forbidden}`)
    }
  }
  // The footer presses only the handlers the Plan handed down.
  const footer = SECTIONS.slice(SECTIONS.indexOf('export function StepFooter('), SECTIONS.indexOf('/** A tile'))
  assert.equal(footer.split('<Button').length - 1, 1, 'the footer draws a control of its own')
  assert.match(footer, /onClick=\{onScan\}/)
  // Copy goes through the export guard, redacted.
  assert.match(CONTENT_STEP, /exportClipboard\(text, REDACTED\)/, 'the step copies around the export guard')
  assert.equal(CONTENT_STEP.includes('exportDownload'), false, 'the step downloads an artifact the approved design does not offer')
})

test('the demo opens the same step body, with the same grammar', () => {
  const bodies = ['src/ui/surfaces/ContentStep.tsx', 'src/ui/surfaces/CleanupStep.tsx', 'src/ui/surfaces/Plan.tsx', 'src/ui/surfaces/PrintPlan.tsx']
    .map((f) => (read(f).includes('className="step-main"') ? f : null))
    .filter(Boolean)
  assert.deepEqual(bodies, ['src/ui/surfaces/ContentStep.tsx', 'src/ui/surfaces/CleanupStep.tsx'], 'a third step body draws its own main column')
  for (const body of bodies) assert.match(read(body!), /from '\.\/StepSections\.tsx'/, `${body} draws its sections itself`)
  assert.match(CLEANUP_STEP, /<StepSection heading=\{HEAD\.why\}>/, 'the Cleanup row stopped using the shared section')
  for (const forbidden of ['demoMode', 'isDemo', 'demo-']) {
    assert.equal(CONTENT_STEP.includes(forbidden), false, `the step body branches on ${forbidden}`)
  }
  assert.equal(SECTIONS.includes('demo'), false, 'the step components branch on the demo')
  const demo = contractsOf('demo')
  assert.ok(demo.length > 0)
  for (const { step: s, c } of demo) {
    for (const f of c.found) assert.equal(f.label, CONTRACT.foundLabel[f.key], `demo/${s.id}: a finding with no key`)
    assert.ok(c.doneWhen.length > 0, `demo/${s.id}: no completion`)
    assert.ok(readinessOf(s, c).tiles.length > 0, `demo/${s.id}: no readiness`)
  }
})
