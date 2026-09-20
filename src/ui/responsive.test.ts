// Cross-surface responsive conformance (task 039; prompt 62).
//
// Packs 032-038 restored Home, Connect, Plan and MFA Readiness one surface at a
// time, and each of them landed its own responsive rules. This file is the
// first test that reads all four TOGETHER, and it exists to protect two claims
// that no single-surface test can make.
//
// The first is that each surface still uses ITS OWN breakpoints. The surfaces
// do not share a responsive system — Home turns at 760 and 560, Connect at 760
// alone, Plan at 940 and 650, MFA Readiness (its v3 pack, prompt 62) at 1040
// and 760 — and the cheapest wrong answer to "make the product responsive" is
// one shared mobile width that flattens all four into the same stack. So the
// breakpoints below are READ OUT OF THE AUTHORITY FILES at test time rather than
// typed here: if an approved file's bytes ever change, this test changes with
// it, and if production quietly normalises a surface onto another surface's
// width, it fails.
//
// The second is that responsive collapse never removes truth. A narrow layout
// may reflow, restack and re-order boxes; it may not delete an action, a
// blocker, a lifecycle word, an identity or a count, and it may not replace a
// real label with generated content that a screen reader cannot reach. The
// checks for that are stated as absences, because a disappearance is the defect
// that looks like success on a screenshot.
//
// What this file deliberately does NOT re-prove, because one authority already
// owns it: the canonical bytes and hashes (src/ui/design-authority.test.ts);
// focus, forced colours and reduced motion (src/ui/accessibility.test.ts); the
// stacked person row's own anatomy and its aria-hidden head row
// (src/ui/surfaces/readinessAnatomy.test.ts); the Connect step and Plan row
// anatomies (connectAnatomy.test.ts, planAnatomy.test.ts).
//
// Rendered evidence is not a substitute for these assertions and these
// assertions are not a substitute for it: `node scripts/responsive-probe.mjs`
// measures the live layout of both the packs and the built application on each
// side of every breakpoint, which is how the numbers below were established.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

const APP = read('src/ui/app.css')
const HOME_CSS = read('home/home.css')
const SHELL = read('src/ui/shell/AppShell.tsx')

/** The authority for each surface's responsive model. MFA Readiness's is its v3 pack (prompt 62). */
const PACKS = {
  home: 'docs/design/approved/anatomy/home-v2.html',
  connect: 'docs/design/approved/anatomy/connect-v3.html',
  plan: 'docs/design/approved/anatomy/plan-step-v1.html',
  mfa: 'docs/design/approved/anatomy/mfa-readiness-v3.html',
} as const

/** Every `max-width` a stylesheet turns at, in descending order. */
function breakpoints(css: string): number[] {
  const widths = [...css.matchAll(/@media\s*\(\s*max-width:\s*(\d+)px\s*\)/g)].map((m) => Number(m[1]))
  return [...new Set(widths)].sort((a, b) => b - a)
}

/** The body of the first `@media (max-width: N)` block, braces balanced. */
function mediaBody(css: string, width: number, from = 0): string {
  const open = css.indexOf(`@media (max-width: ${width}px)`, from)
  assert.notEqual(open, -1, `no @media (max-width: ${width}px) block`)
  let depth = 0
  for (let i = css.indexOf('{', open); i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(css.indexOf('{', open) + 1, i)
  }
  throw new Error(`unbalanced @media (max-width: ${width}px)`)
}

/** Every `@media (max-width: N)` block's body, joined: two surfaces may turn at one width in blocks of their own. */
function mediaBodies(css: string, width: number): string {
  const bodies: string[] = []
  for (let at = css.indexOf(`@media (max-width: ${width}px)`); at !== -1; at = css.indexOf(`@media (max-width: ${width}px)`, at + 1)) bodies.push(mediaBody(css, width, at))
  assert.ok(bodies.length > 0, `no @media (max-width: ${width}px) block`)
  return bodies.join('\n')
}

const APP_WIDTHS = [1040, 940, 760, 650]

// ---------------------------------------------------------------- the model

test('each authority still declares the breakpoints production is built against', () => {
  // The approved file is the authority for its own responsive model. These are
  // the numbers the rest of this file uses, and reading them here means a change
  // to an approved file cannot pass silently as "production is still conformant".
  assert.deepEqual(breakpoints(read(PACKS.home)), [760, 560])
  assert.deepEqual(breakpoints(read(PACKS.connect)), [760])
  assert.deepEqual(breakpoints(read(PACKS.plan)), [940, 650])
  assert.deepEqual(breakpoints(read(PACKS.mfa)), [1040, 760])
})

test('no surface is normalised onto another surface\'s breakpoint', () => {
  // The failure this guards against is one shared mobile width. Home is a
  // separate stylesheet and turns at its own two; the application sheet has to
  // carry Connect's, Plan's and MFA Readiness's distinct widths at once (Connect
  // and MFA Readiness both turn at 760, each in a block of its own).
  assert.deepEqual(breakpoints(HOME_CSS), [760, 560])
  for (const w of APP_WIDTHS) {
    assert.ok(breakpoints(APP).includes(w), `src/ui/app.css declares no @media (max-width: ${w}px)`)
  }
  // The retired MFA Readiness pack's 620 is gone with it. 900 is the opened
  // step's own (U2, RUN-CONTEXT-B decision 2): its body stacks there, and nothing
  // else in the sheet turns at it.
  assert.ok(!breakpoints(APP).includes(620), `src/ui/app.css still turns at the retired readiness pack's 620px`)
  assert.equal(APP.split('@media (max-width: 900px)').length - 1, 1, 'more than one block turns at 900px')
  const selectors = [...mediaBody(APP, 900).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)].flatMap((m) => m[1].split(',').map((s) => s.trim()))
  assert.ok(selectors.length > 0 && selectors.every((s) => s.startsWith('.step-body.has-rail') || s === '.step-action-column'), `something besides the opened step's body turns at 900px: ${selectors.join(' | ')}`)
})

// ------------------------------------------------------------------- Home

test('Home collapses the product and its side rail at the pack\'s 760', () => {
  const at760 = mediaBody(HOME_CSS, 760)
  assert.match(at760, /\.product\s*\{[^}]*grid-template-columns:\s*1fr/, 'the product does not become one column')
  // The pack moves the rail's separator rather than deleting it: a rail below
  // the copy with no line above it reads as more of the same paragraph.
  assert.match(at760, /\.side\s*\{[^}]*border-left:\s*0/, 'the rail keeps its left border')
  assert.match(at760, /\.side\s*\{[^}]*border-top:\s*1px/, 'the rail below the copy has no separator above it')
  assert.match(at760, /\.catch\s*\{[^}]*grid-template-columns:\s*1fr/, 'the catch rows do not collapse')
})

test('Home tightens its gutter at 560 and never drops the way into the product', () => {
  const at560 = mediaBody(HOME_CSS, 560)
  assert.match(at560, /padding-left:\s*12px/, 'the gutter does not tighten')
  // The pack's own `.links a:first-child{display:none}`: the FIRST public link
  // stands down at the narrowest width, never the last, which is the way in.
  assert.match(at560, /\.links a:first-child\s*\{\s*display:\s*none/, 'the pack\'s one public-header collapse is missing')
  assert.doesNotMatch(at560, /\.links a:last-child\s*\{\s*display:\s*none/, 'the product entry is hidden on a phone')
  // And no narrow rule anywhere may hide the hero's calls to action.
  for (const w of [760, 560]) {
    assert.doesNotMatch(mediaBody(HOME_CSS, w), /\.hero-actions\s*\{[^}]*display:\s*none/, `the hero actions are hidden at ${w}`)
  }
})

// ---------------------------------------------------------------- Connect

test('Connect stacks its strip, step and destination at the pack\'s one breakpoint', () => {
  const at760 = mediaBody(APP, 760)
  assert.match(at760, /\.connect-status\s*\{[^}]*flex-direction:\s*column/, 'the status strip does not stack')
  // Three tracks become two, and the action moves UNDER the copy in the
  // content column rather than off the row: `.actions{grid-column:2}`.
  assert.match(at760, /\.connect-step\s*\{[^}]*grid-template-columns:\s*36px/, 'the step keeps its three-track desktop grid')
  assert.match(at760, /\.connect-step-actions\s*\{[^}]*grid-column:\s*2/, 'the step action does not move beneath its copy')
  assert.match(at760, /\.connect-destination\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/, 'the Plan-ready destination stays two columns')
})

test('Connect never hides a step action to make the phone layout fit', () => {
  // The action is how the operator moves; it may move, it may not vanish.
  const at760 = mediaBody(APP, 760)
  assert.doesNotMatch(at760, /\.connect-step-actions\s*\{[^}]*display:\s*none/)
  assert.doesNotMatch(at760, /\.connect-step\s+\.n\s*\{[^}]*display:\s*none/, 'the numbered state indicator is hidden')
  // The flow is one contiguous element with rows inside it. If a narrow rule
  // ever gave each step its own border and radius, the pack's single flow would
  // have become the card stack the pack replaced.
  assert.doesNotMatch(at760, /\.connect-step\s*\{[^}]*border-radius/, 'the steps become separate cards at narrow width')
})

// ------------------------------------------------------------------- Plan

test('Plan collapses the roadmap row at the pack\'s 940 and stacks the opened body at 900', () => {
  const at940 = mediaBody(APP, 940)
  // Four zones become two: the state's column narrows and who/when drop under
  // the title and left-align. Nothing is dropped. The number column (owner,
  // 2026-09-19) leads the row at both widths and narrows with it.
  assert.match(at940, /\.plan-row\s*\{[^}]*grid-template-columns:\s*28px 110px/, 'the roadmap row keeps its numbered four-zone grid')
  assert.match(at940, /text-align:\s*left/, 'the row metadata does not re-align')
  assert.doesNotMatch(at940, /\.step-body\.has-rail\s*\{/, 'the opened body stacks at 940 rather than 900 (U2)')
  // The body stacks at 900 (U2): the action column moves BELOW Readiness and
  // takes a separator above it. It is one element in one place in the DOM,
  // between Readiness and Implementation, so reading order does not change (U5).
  const at900 = mediaBody(APP, 900)
  assert.match(at900, /\.step-body\.has-rail\s*\{[^}]*grid-template-columns:\s*1fr/, 'the opened body stays two columns')
  assert.match(at900, /\.step-action-column\s*\{[^}]*border-left:\s*0/, 'the action column keeps its left border when stacked')
  assert.match(at900, /\.step-action-column\s*\{[^}]*border-top:\s*1px/, 'the stacked action column has no separator')
  assert.doesNotMatch(at900, /\.step-action-column\s*\{[^}]*display:\s*none/, 'the action column disappears instead of moving')
})

test('Plan tightens the widest surface\'s gutter at the pack\'s 650, shell and page together', () => {
  const at650 = mediaBody(APP, 650)
  // The pack's `.page,.topbar-inner{width:min(100% - 24px,1240px)}`. The header
  // and footer tighten with the page: a page inset 12px under a header inset
  // 24px puts the wordmark out of line with the content beneath it.
  for (const part of ['header.app', '> main.page', 'footer.app']) {
    assert.ok(at650.includes(`.shell[data-route='plan'] ${part}`), `${part} does not tighten with the Plan page`)
  }
  assert.match(at650, /padding-left:\s*12px/, 'the Plan gutter does not tighten')
  assert.match(at650, /\.step-head-top\s*\{\s*display:\s*block/, 'the opened step\'s header does not stack')
  // The route has to be on the shell for those selectors to match anything.
  assert.match(SHELL, /className=\{`shell\$\{[^`]*`\} data-route=\{route\}/, 'the shell carries no route for the gutter rules to key off')
})

test('Plan keeps every lifecycle label readable rather than shrinking it away', () => {
  // The pack drops its stage labels to 8px at 650. Production keeps them on the
  // type scale and lets a long stage name wrap instead, because the stage is a
  // WORD the operator reads, not a decoration under a bar.
  const at650 = mediaBody(APP, 650)
  assert.doesNotMatch(at650, /\.stage-label\s*\{[^}]*display:\s*none/, 'the lifecycle labels are hidden')
  assert.doesNotMatch(at650, /\.stage-label\s*\{[^}]*font-size:\s*8px/, 'the lifecycle labels are shrunk below the type scale')
  assert.doesNotMatch(at650, /\.step\s+\.track\s*\{[^}]*display:\s*none/, 'the lifecycle track is hidden')
})

// --------------------------------------------------------- MFA Readiness

/** The v3 pack's own `@media (max-width:N)` block, minified as the pack writes it. */
const packMedia = (w: number): string => read(PACKS.mfa).match(new RegExp(`@media \\(max-width:${w}px\\)\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''
const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

test("MFA Readiness drops its rail under the worklist at the pack's 1040 and stacks its answer at 760", () => {
  // The pack: one column below 1040, the rail's tiles side by side under it …
  assert.match(packMedia(1040), /\.layout\{grid-template-columns:1fr\}/)
  assert.match(packMedia(1040), /\.rail\{position:static;grid-template-columns:repeat\(auto-fit,minmax\(260px,1fr\)\)\}/)
  // … and at 760 the change since the last scan moves under the sentence.
  assert.match(packMedia(760), /\.answer-top\{flex-direction:column;gap:16px\}/)
  assert.match(packMedia(760), /\.change\{flex:none;width:100%\}/)
  // Production, the same two states.
  const at1040 = mediaBodies(APP, 1040)
  const at760 = mediaBodies(APP, 760)
  assert.match(at1040, /\.readiness-layout\s*\{[^}]*grid-template-columns:\s*1fr/, 'the rail does not drop under the worklist')
  assert.match(at1040, /\.readiness-rail\s*\{[^}]*position:\s*static/, 'the rail stays sticky beside nothing')
  assert.match(at1040, /\.readiness-rail\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(260px, 1fr\)\)/, 'the rail tiles do not share the row')
  assert.match(at760, /\.readiness-answer \.answer-top\s*\{[^}]*flex-direction:\s*column/, 'the answer does not stack')
  assert.match(at760, /\.readiness-change\s*\{[^}]*width:\s*100%/, 'the change since the last scan does not take the full width')
  // The rail, the change, the legend and the bar are moved, never dropped.
  for (const w of [1040, 760]) {
    for (const part of ['.readiness-rail', '.readiness-tile', '.readiness-change', '.readiness-legend', '.readiness-bar', '.readiness-setup-next']) {
      assert.doesNotMatch(mediaBodies(APP, w), new RegExp(`${escape(part)}\\s*\\{[^}]*display:\\s*none`), `${part} is dropped at ${w}`)
    }
  }
})

test('MFA Readiness stacks a person row without losing a field or its words', () => {
  const at760 = mediaBodies(APP, 760)
  // The pack's own stacked row: the person and Details on the first line, the rest under it.
  assert.match(packMedia(760), /\.row\{grid-template-columns:1fr auto;gap:6px 12px\}/)
  assert.match(at760, /\.readiness-row\s*\{[^}]*grid-template-columns:\s*1fr auto/, 'the person row does not stack')
  assert.match(at760, /\.readiness-row > \.devices,\s*\.readiness-row > \.methods,\s*\.readiness-row > \.next-step\s*\{[^}]*grid-column:\s*1 \/ -1/, 'the devices, methods and next step do not take the full row')
  assert.match(at760, /\.readiness-row > \.open\s*\{[^}]*grid-row:\s*1;\s*grid-column:\s*2/, 'Details leaves the person it opens')
  // The head row is the one thing that goes: it is aria-hidden, a visual label
  // the stacked row no longer lines up under.
  assert.match(packMedia(760), /\.row\.head\{display:none\}/)
  assert.match(at760, /\.readiness-row\.head\s*\{\s*display:\s*none/)
  // Nothing else in the row, and no chip's word, is dropped.
  for (const field of ['.person', '.person-name', '.person-upn', '.devices', '.dev', '.dev-word', '.methods', '.cell-note', '.next-step', '.open']) {
    assert.doesNotMatch(at760, new RegExp(`${escape(field)}\\s*\\{[^}]*display:\\s*none`), `${field} is dropped on a phone`)
  }
  // A field's words are DOM text, never generated content a screen reader or a copy cannot reach.
  assert.doesNotMatch(APP, /\.readiness-row[^{]*::(before|after)/, 'a row field is generated content')
  for (const cell of ['.row>div::before', '.row > div::before']) {
    assert.ok(!APP.includes(cell), 'the pack\'s pseudo-element labels were copied instead of using the real ones')
  }
})

test("MFA Readiness tightens its gutter at the pack's 760, and its footer note wraps", () => {
  const at760 = mediaBodies(APP, 760)
  for (const part of ['header.app', '> main.page', 'footer.app']) {
    assert.ok(at760.includes(`.shell[data-route='readiness'] ${part}`), `${part} does not tighten with the readiness page`)
  }
  assert.match(at760, /padding-left:\s*12px/, 'the readiness gutter does not tighten')
  // The pack's footer note wraps its line and its link rather than overflowing.
  assert.match(read(PACKS.mfa), /footer\.note\{[^}]*flex-wrap:wrap/)
  assert.match(APP, /\.surface\.readiness \.footer-note \{[^}]*flex-wrap: wrap/, 'the footer note does not wrap')
})

// ----------------------------------------------------------------- global

test('long tenant objects are handled where they are, not by breaking all prose', () => {
  // Task 030's rule. `anywhere` also lets a flex or grid track shrink below the
  // longest word, so on ordinary prose it produces a ladder of broken words;
  // the technical faces that actually carry a UPN, a GUID or a Graph path opt
  // in themselves. A responsive pass is exactly when someone reaches for the
  // global version to stop a phone overflowing, so it is asserted here too.
  for (const [name, css] of [['src/ui/app.css', APP], ['home/home.css', HOME_CSS]] as const) {
    assert.match(css, /main\.page \{[^}]*overflow-wrap: break-word/, `${name} does not give the page the safe wrap`)
    for (const global of ['main.page {', 'body {', '.surface {', '* {']) {
      const start = css.indexOf(`\n${global}`)
      if (start === -1) continue
      const block = css.slice(start, css.indexOf('}', start))
      assert.doesNotMatch(block, /overflow-wrap:\s*anywhere/, `${name} breaks ordinary prose mid-word under ${global}`)
    }
  }
})

test('Demo inherits the responsive result instead of carrying its own', () => {
  // Demo reuses the production surfaces. A `.demo` narrow rule would mean the
  // sample tenant renders through a second layout that nothing else tests, and
  // the screenshots would stop being evidence about the product.
  for (const w of APP_WIDTHS) {
    const body = mediaBodies(APP, w)
    assert.doesNotMatch(body, /\.demo-(banner|snapshots)?[\w-]*\s*\{[^}]*(grid-template-columns|flex-direction|display)/, `a Demo-only responsive rule exists at ${w}`)
  }
})

test('no narrow rule hides a control, a blocker or a state word', () => {
  // The layout may compress. The truth may not. These are the roles that carry
  // an action the operator takes or a fact the plan asserts, and none of them
  // may be answered with `display: none` at any width.
  const CANNOT_VANISH = ['.btn', '.blocking', '.callout', '.status', '.decision', '.tenant-object', '.stage-label', '.cell-key', '.step-action-column', '.connect-step-actions', '.row-action', '.state-dot', '.dev-word', '.devices', '.methods', '.next-step', '.readiness-legend', '.readiness-change', '.readiness-rail', '.readiness-setup-next']
  for (const w of APP_WIDTHS) {
    const body = mediaBodies(APP, w)
    for (const role of CANNOT_VANISH) {
      const escaped = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      assert.doesNotMatch(
        body,
        new RegExp(`${escaped}\\s*\\{[^}]*display:\\s*none`),
        `${role} is hidden at ${w}px — responsive conformance is layout, not truth`,
      )
    }
  }
})
