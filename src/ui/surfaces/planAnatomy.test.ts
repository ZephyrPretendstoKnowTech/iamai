// Task 033 — the approved Plan collapsed roadmap row; task 034 — the expanded frame.
//
// The same two-sided shape as src/ui/surfaces/connectAnatomy.test.ts (task
// 032): every assertion reads `docs/design/approved/plan-step-v1.html` at test
// time and fails if the pack stops drawing what production claims to have
// restored, and reads production and fails if production stops drawing it. A
// green unit test that only knows about production can pass while the two
// drift apart, which is the failure this file exists to catch.
//
// It owns the ROW (task 033) and the EXPANDED FRAME under it (task 034): the
// join between them, the head, the lifecycle track, the main/rail body and its
// responsive collapse, and the sticky shell the pack asks the Plan for. The
// detailed content of the opened step — the findings grid, the action strip,
// the attention blocks, the rail's remaining side blocks — is pack 035's.
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
import { stepTrack as trackFor } from './stepContract.ts'
import type { Step } from '../../roadmap/types.ts'

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
  const parts = SECTIONS.slice(SECTIONS.indexOf('export function StepHead('), SECTIONS.indexOf('export function PolicyMembers('))
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
  const step = (over: Record<string, unknown>): Step => ({ status: 'ready', state: { inPlace: false, setAside: false, satisfied: false, lifecycle: 'not-deployed', condition: 'healthy' }, ...over }) as unknown as Step
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
