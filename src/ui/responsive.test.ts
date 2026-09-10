// Cross-surface responsive conformance (task 039; Step 7).
//
// Packs 032-038 restored Home, Connect, Plan and MFA Readiness one surface at a
// time, and each of them landed its own responsive rules. This file is the
// first test that reads all four TOGETHER, and it exists to protect two claims
// that no single-surface test can make.
//
// The first is that each surface still uses ITS OWN breakpoints. The surfaces
// do not share a responsive system — Home turns at 760 and 560, Connect at 760
// alone, Plan at 940 and 650, MFA Readiness (its final reference, Step 7) at 940
// and 720 — and the cheapest wrong answer to "make the product responsive" is
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
// stacked person row's own anatomy and its aria-hidden key
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

/** The authority for each surface's responsive model. MFA Readiness's is its final reference (Step 7). */
const PACKS = {
  home: 'docs/design/approved/anatomy/home-v2.html',
  connect: 'docs/design/approved/anatomy/connect-v3.html',
  plan: 'docs/design/approved/anatomy/plan-step-v1.html',
  mfa: 'docs/design/approved/reference/iamai-mfa-readiness-final.html',
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

const APP_WIDTHS = [940, 760, 720, 650]

// ---------------------------------------------------------------- the model

test('each authority still declares the breakpoints production is built against', () => {
  // The approved file is the authority for its own responsive model. These are
  // the numbers the rest of this file uses, and reading them here means a change
  // to an approved file cannot pass silently as "production is still conformant".
  assert.deepEqual(breakpoints(read(PACKS.home)), [760, 560])
  assert.deepEqual(breakpoints(read(PACKS.connect)), [760])
  assert.deepEqual(breakpoints(read(PACKS.plan)), [940, 650])
  assert.deepEqual(breakpoints(read(PACKS.mfa)), [940, 720])
})

test('no surface is normalised onto another surface\'s breakpoint', () => {
  // The failure this guards against is one shared mobile width. Home is a
  // separate stylesheet and turns at its own two; the application sheet has to
  // carry Connect's, Plan's and MFA Readiness's distinct widths at once (Plan and
  // MFA Readiness both turn first at 940, each in a block of its own).
  assert.deepEqual(breakpoints(HOME_CSS), [760, 560])
  for (const w of APP_WIDTHS) {
    assert.ok(breakpoints(APP).includes(w), `src/ui/app.css declares no @media (max-width: ${w}px)`)
  }
  // The retired MFA Readiness pack's two widths are gone with it.
  for (const w of [900, 620]) assert.ok(!breakpoints(APP).includes(w), `src/ui/app.css still turns at the retired readiness pack's ${w}px`)
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

test('Plan collapses the roadmap row and the opened body at the pack\'s 940', () => {
  const at940 = mediaBody(APP, 940)
  // Four zones become two: the state's column narrows and who/when drop under
  // the title and left-align. Nothing is dropped.
  assert.match(at940, /\.plan-row\s*\{[^}]*grid-template-columns:\s*110px/, 'the roadmap row keeps its four-zone grid')
  assert.match(at940, /text-align:\s*left/, 'the row metadata does not re-align')
  assert.match(at940, /\.step-body\.has-rail\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/, 'the opened body stays two columns')
  // The rail moves BELOW the main column and takes a separator above it. It is
  // one element in one place in the DOM, so reading order does not change.
  assert.match(at940, /\.step-side\s*\{[^}]*border-left:\s*0/, 'the rail keeps its left border below the main column')
  assert.match(at940, /\.step-side\s*\{[^}]*border-top:\s*1px/, 'the rail below the main column has no separator')
  assert.doesNotMatch(at940, /\.step-side\s*\{[^}]*display:\s*none/, 'the right rail disappears instead of moving')
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

test('MFA Readiness steps its summary and its strip through the reference\'s two states', () => {
  const at940 = mediaBodies(APP, 940)
  const at720 = mediaBodies(APP, 720)
  // Four cells become two columns with the dominant cell spanning both …
  assert.match(at940, /\.readiness-summary\s*\{[^}]*grid-template-columns:\s*1fr 1fr/, 'the summary does not become two columns')
  assert.match(at940, /\.summary-main\s*\{[^}]*grid-column:\s*1 \/ -1/, 'the dominant summary cell does not span')
  // … and then one, with the dominant cell giving up its span; the Plan gate and passkey strip stack too.
  assert.match(at720, /\.readiness-summary\s*\{[^}]*grid-template-columns:\s*1fr/, 'the summary does not become one column')
  assert.match(at720, /\.summary-main\s*\{[^}]*grid-column:\s*auto/, 'the dominant cell keeps a span it no longer has columns for')
  assert.match(at720, /\.progress-strip\s*\{[^}]*grid-template-columns:\s*1fr/, 'the Plan gate and passkey strip does not stack')
  // The counts are cells of one panel, not tiles that float away from it.
  assert.doesNotMatch(at940, /\.summary-stat\s*\{[^}]*border-radius/)
  assert.doesNotMatch(at720, /\.summary-stat\s*\{[^}]*display:\s*none/, 'a count is dropped on a phone')
  assert.doesNotMatch(at720, /\.progress-item\s*\{[^}]*display:\s*none/, 'the Plan gate or the passkey rollout is dropped on a phone')
})

test('MFA Readiness stacks a person row without losing a field or its label', () => {
  const at720 = mediaBodies(APP, 720)
  assert.match(at720, /table\.datatable,[\s\S]*?tr,[\s\S]*?td\s*\{\s*display: block/, 'the person row does not stack')
  // The column header goes off screen and STAYS IN THE ACCESSIBILITY TREE.
  // `display: none` would take the header a stacked cell is still associated
  // with out of it, which is the whole reason the visible key can be
  // aria-hidden (src/ui/surfaces/readinessAnatomy.test.ts owns that pairing).
  assert.match(at720, /thead\s*\{[^}]*clip-path:\s*inset\(50%\)/, 'the table head is not the visually-hidden pattern')
  assert.doesNotMatch(at720, /thead\s*\{[^}]*display:\s*none/, 'the table head is removed from the accessibility tree')
  // The Action column the reference drops between 720 and 940 is back in the stacked row.
  assert.match(at720, /td:nth-child\(6\)\s*\{\s*display:\s*block/, 'the stacked row loses the person\'s action')
  // The stacked key is a real element that becomes visible, never generated
  // content: CSS `content` is not text a screen reader or a copy/paste reaches.
  assert.match(at720, /\.cell-key\s*\{\s*display:\s*block/, 'the stacked field label never appears')
  assert.doesNotMatch(APP, /\.cell-key::(before|after)/, 'the field label is generated content')
  for (const cell of ['.row>div::before', '.row > div::before']) {
    assert.ok(!APP.includes(cell), 'the pack\'s pseudo-element labels were copied instead of using the real ones')
  }
})

test('MFA Readiness tightens its gutter at the reference\'s 720', () => {
  const at720 = mediaBodies(APP, 720)
  for (const part of ['header.app', '> main.page', 'footer.app']) {
    assert.ok(at720.includes(`.shell[data-route='readiness'] ${part}`), `${part} does not tighten with the readiness page`)
  }
  assert.match(at720, /padding-left:\s*12px/, 'the readiness gutter does not tighten')
  assert.match(at720, /\.footer-note\s*\{[^}]*flex-direction:\s*column/, 'the footer note does not stack its line above its link')
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
  const CANNOT_VANISH = ['.btn', '.blocking', '.callout', '.status', '.decision', '.tenant-object', '.stage-label', '.cell-key', '.step-side', '.connect-step-actions', '.row-action', '.proof-lines', '.methods-main', '.progress-strip']
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
