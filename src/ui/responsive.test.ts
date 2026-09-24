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

test("each surface keeps its authority's own breakpoints, and none is normalised onto another's", () => {
  {
    // The approved file is the authority for its own responsive model. These are
    // the numbers the rest of this file uses, and reading them here means a change
    // to an approved file cannot pass silently as "production is still conformant".
    assert.deepEqual(breakpoints(read(PACKS.home)), [760, 560])
    assert.deepEqual(breakpoints(read(PACKS.connect)), [760])
    assert.deepEqual(breakpoints(read(PACKS.plan)), [940, 650])
    assert.deepEqual(breakpoints(read(PACKS.mfa)), [1040, 760])
  }
  {
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
  }
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

test('no narrow rule hides a control, a blocker, a state word or the way into the product', () => {
  {
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
  }
  {
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
  }
  {
    // The action is how the operator moves; it may move, it may not vanish.
    const at760 = mediaBody(APP, 760)
    assert.doesNotMatch(at760, /\.connect-step-actions\s*\{[^}]*display:\s*none/)
    assert.doesNotMatch(at760, /\.connect-step\s+\.n\s*\{[^}]*display:\s*none/, 'the numbered state indicator is hidden')
    // The flow is one contiguous element with rows inside it. If a narrow rule
    // ever gave each step its own border and radius, the pack's single flow would
    // have become the card stack the pack replaced.
    assert.doesNotMatch(at760, /\.connect-step\s*\{[^}]*border-radius/, 'the steps become separate cards at narrow width')
  }
  {
    // The pack drops its stage labels to 8px at 650. Production keeps them on the
    // type scale and lets a long stage name wrap instead, because the stage is a
    // WORD the operator reads, not a decoration under a bar.
    const at650 = mediaBody(APP, 650)
    assert.doesNotMatch(at650, /\.stage-label\s*\{[^}]*display:\s*none/, 'the lifecycle labels are hidden')
    assert.doesNotMatch(at650, /\.stage-label\s*\{[^}]*font-size:\s*8px/, 'the lifecycle labels are shrunk below the type scale')
    assert.doesNotMatch(at650, /\.step\s+\.track\s*\{[^}]*display:\s*none/, 'the lifecycle track is hidden')
  }
})
