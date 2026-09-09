// Task 033 — the approved Plan collapsed roadmap row, restored.
//
// The same two-sided shape as src/ui/surfaces/connectAnatomy.test.ts (task
// 032): every assertion reads `docs/design/approved/plan-step-v1.html` at test
// time and fails if the pack stops drawing what production claims to have
// restored, and reads production and fails if production stops drawing it. A
// green unit test that only knows about production can pass while the two
// drift apart, which is the failure this file exists to catch.
//
// This file owns the ROW. It does not own the expanded step: the frame,
// lifecycle track, head layout and right rail the pack draws under the row
// belong to packs 034 and 035, and §"nothing here is pack 034" below is the
// guard that they have not been quietly half-built here instead.
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
import type { Step } from '../../roadmap/types.ts'

const read = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

const PACK = 'docs/design/approved/plan-step-v1.html'
const SECTIONS = read('src/ui/surfaces/StepSections.tsx')
const PLAN = read('src/ui/surfaces/Plan.tsx')
const CSS = read('src/ui/app.css')

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
  // the row says another.
  assert.match(CSS, /\.plan-row\[aria-expanded='true'\] \{[\s\S]*?border-radius: var\(--radius\) var\(--radius\) 0 0;/, 'the open row does not square off the edge the step attaches to')
  assert.match(ROW, /aria-expanded=\{open\}/, 'the row no longer publishes its expanded state')
})

test('nothing here is pack 034: no expanded frame, lifecycle track, or right rail', () => {
  // The pack draws all of these under the row. Task 033 restored the row only,
  // and a half-built version of the next pack's anatomy is worse than none:
  // it would have to be unpicked before 034 could attach the real one.
  const pack = read(PACK)
  for (const owned of ['.track{', '.stage{', '.track-labels{', '.step-side{', '.step-head-top{', '.finding{']) {
    assert.ok(pack.includes(owned), `the pack no longer draws ${owned}; the deferral below is stale`)
  }
  const stripped = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const deferred of ['.track-wrap', '.track-labels', '.step-side', '.step-head-top', '.stage.done', '.stage.current']) {
    assert.equal(stripped.includes(deferred), false, `${deferred} belongs to pack 034/035 and was implemented early`)
  }
  assert.equal(SECTIONS.includes('track-wrap'), false, 'the lifecycle track was built before the pack that owns it')
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
