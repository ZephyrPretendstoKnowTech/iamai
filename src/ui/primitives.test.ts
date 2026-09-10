// The shared approved-design primitives (task 031).
//
// Task 030 built the theme, type and shell foundation; packs 032-038 restore
// the four surfaces. This layer sits between them: the low-level visual
// grammar that MORE THAN ONE approved pack declares, so the restoration packs
// compose it instead of each re-deriving the same declarations.
//
// The point of this file is that "shared" is a claim about evidence, not a
// preference. So every assertion below reads the four canonical files in
// docs/design/approved/ AT TEST TIME and fails if the pattern it calls shared
// stops being shared there. The opposite claim is tested just as hard: a
// pattern only one pack draws must NOT have become a global role, because a
// primitive that flattens a canonical difference is worse than no primitive.
//
// What this file does not re-prove, because one authority already owns it:
// the canonical hashes and bytes and the non-authority of generated branding
// previews (src/ui/design-authority.test.ts); the token system, the AA of every
// colour the pages paint text in, and brand-is-not-success
// (src/ui/tokens.test.ts); the shape/type/shell foundation
// (src/ui/foundation.test.ts); focus, forced colours and reduced motion
// (src/ui/accessibility.test.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

/** The four owner-approved packs, by surface. */
const PACKS = {
  home: 'docs/design/approved/anatomy/home-v2.html',
  connect: 'docs/design/approved/anatomy/connect-v3.html',
  plan: 'docs/design/approved/anatomy/plan-step-v1.html',
  mfa: 'docs/design/approved/anatomy/mfa-readiness-v2.html',
} as const

const APP = 'src/ui/app.css'

/**
 * The declaration block a stylesheet gives one selector, with whitespace
 * flattened. The selector is matched against the whole comma-separated list,
 * so `.callout` does not answer for `.callout.danger` or `.callout span`.
 *
 * `solo` reads the rule a selector has to ITSELF, which is what a test asking
 * "what does this role declare" wants: `.display` shares a rule with h1 and h2
 * and has a second one of its own, and an absence check wants the opposite —
 * any rule at all that names the selector. Hence the two modes.
 */
function ruleBody(css: string, selector: string, { solo = false } = {}): string | undefined {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1]
      .split(',')
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    const hit = solo ? selectors.length === 1 && selectors[0] === selector : selectors.includes(selector)
    if (hit) return m[2].replace(/\s+/g, ' ').trim()
  }
  return undefined
}

/** Every rule that names the selector, for a property one of several may set. */
function allRuleBodies(css: string, selector: string): string[] {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: string[] = []
  for (const m of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1]
      .split(',')
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    if (selectors.includes(selector)) out.push(m[2].replace(/\s+/g, ' ').trim())
  }
  return out
}

// ------------------------------------------------- what the evidence shares

test('the eyebrow is shared because all four packs declare it, and they declare it identically', () => {
  const declared = Object.entries(PACKS).map(([surface, path]) => ({ surface, body: ruleBody(read(path), '.eyebrow', { solo: true }) }))
  for (const { surface, body } of declared) assert.ok(body, `${surface} no longer declares .eyebrow — the shared role has lost its evidence`)
  const [first, ...rest] = declared
  for (const other of rest) assert.equal(other.body, first.body, `${other.surface} and ${first.surface} draw .eyebrow differently`)
  // The values the packs agree on, so a silent drift in the pack is caught too.
  assert.match(first.body!, /font-size:\s*11px/)
  assert.match(first.body!, /text-transform:\s*uppercase/)
  assert.match(first.body!, /letter-spacing:\s*\.11em/)

  // Production carries the same role, translated onto the brand skin: the
  // packs are dark Inter mockups and own the anatomy, not the face or the ink.
  const role = ruleBody(read(APP), '.eyebrow', { solo: true })
  assert.ok(role, 'app.css has no .eyebrow role')
  assert.match(role, /font-size: var\(--t-0\)/, '11px is --t-0')
  assert.match(role, /text-transform: uppercase/)
  assert.match(role, /letter-spacing: 0\.11em/)
  // 11px is text, so it takes the AA quiet level, not the muted component ink
  // (task 030 correction 1). src/ui/tokens.test.ts measures that it is AA.
  assert.match(role, /color: var\(--quiet-text\)/)
})

test('the key label is shared by the two packs that draw a field key, at the smaller step', () => {
  const plan = read(PACKS.plan)
  const mfa = read(PACKS.mfa)
  // The Plan's side-block label and finding key, and MFA's person-table head.
  for (const [where, body] of [
    ['plan .side-label', ruleBody(plan, '.side-label', { solo: true })],
    ['plan .finding .k', ruleBody(plan, '.finding .k', { solo: true })],
    ['mfa .table-head', ruleBody(mfa, '.table-head', { solo: true })],
  ] as const) {
    assert.ok(body, `${where} is gone`)
    assert.match(body, /font-size:\s*10px/, `${where} is no longer 10px`)
    assert.match(body, /text-transform:\s*uppercase/, `${where} is no longer uppercase`)
  }
  const role = ruleBody(read(APP), '.key-label', { solo: true })
  assert.ok(role, 'app.css has no .key-label role')
  assert.match(role, /font-size: var\(--t-micro\)/, '10px is --t-micro')
  assert.match(role, /text-transform: uppercase/)
  // It is a step quieter than the eyebrow, which is what the packs draw.
  assert.notEqual(role, ruleBody(read(APP), '.eyebrow', { solo: true }))
})

test('the pill is shape only: two packs draw the same geometry, and neither the shape nor this role chooses a state', () => {
  const badge = ruleBody(read(PACKS.plan), '.badge', { solo: true })
  const cell = ruleBody(read(PACKS.mfa), '.status', { solo: true })
  assert.ok(badge && cell, 'the Plan state badge or the MFA readiness cell is gone')
  for (const [where, body] of [
    ['plan .badge', badge],
    ['mfa .status', cell],
  ] as const) {
    assert.match(body, /border-radius:\s*999px/, `${where} is no longer a full round`)
    assert.match(body, /padding:\s*5px 8px/, `${where} no longer has the shared padding`)
    assert.match(body, /font-size:\s*11px/, `${where} is no longer 11px`)
    assert.match(body, /gap:\s*7px/, `${where} no longer has the shared gap`)
  }

  const role = ruleBody(read(APP), '.pill', { solo: true })
  assert.ok(role, 'app.css has no .pill role')
  assert.match(role, /border-radius: 999px/)
  assert.match(role, /font-size: var\(--t-0\)/)
  // The whole reason this is geometry and not a component: the two packs put
  // DIFFERENT meanings in the same shape. A shared pill that carried a state
  // list would merge a Plan lifecycle badge with an MFA readiness cell, which
  // are not the same enum and must not become one.
  assert.doesNotMatch(role, /color/, '.pill must not choose a colour — the state colour is .status (design lint rule 5)')
  assert.doesNotMatch(role, /--(ok|wait|stop|idle|success|danger|attention)\b/, '.pill must carry no state token')
  // `.status` still owns the dot and the word, and still comes with a word.
  assert.match(read(APP), /\.status::before/, 'the status dot is gone')
  assert.match(read('src/ui/components/Status.tsx'), /\{children\}/, 'a status must render its word: state is never colour alone')
})

test('the attention panel is shared by the two packs that draw it, and it is now actually drawn', () => {
  // The Plan calls it .attention and MFA calls it .callout; both are a 1px
  // tone border over a tone tint at a control radius.
  const planAttention = ruleBody(read(PACKS.plan), '.attention', { solo: true })
  const mfaCallout = ruleBody(read(PACKS.mfa), '.callout', { solo: true })
  assert.ok(planAttention && mfaCallout, 'a pack stopped drawing the attention panel')
  for (const [where, body] of [
    ['plan .attention', planAttention],
    ['mfa .callout', mfaCallout],
  ] as const) {
    assert.match(body, /border:\s*1px solid/, `${where} lost its tone border`)
    assert.match(body, /background:/, `${where} lost its tint`)
  }

  // Production has had a Callout component and no rule behind it, so an
  // attention notice rendered as plain body text. This is the treatment.
  const role = ruleBody(read(APP), '.callout', { solo: true })
  assert.ok(role, 'app.css has no .callout rule — an attention notice renders as plain text')
  assert.match(role, /border: 1px solid/)
  assert.match(role, /background: var\(--brand-tint\)/)
  assert.match(role, /border-radius: var\(--radius-control\)/)
  // The tone is border + tint + icon; the words stay at full body contrast, so
  // the notice never depends on colour to be read.
  assert.match(role, /color: var\(--primary-text\)/)

  // Brand teal is the info tone; success is the semantic green. They are
  // different colours and must not collapse into one another.
  const success = ruleBody(read(APP), '.callout-success', { solo: true })
  assert.ok(success, 'no success tone')
  assert.match(success, /var\(--success\)/)
  assert.doesNotMatch(success, /var\(--brand-/, 'the brand colour must not stand in for semantic success')
})

test('the row hairline is shared by three packs, and no universal row grid came with it', () => {
  // Home's steps and catches, Connect's flow steps, MFA's person rows: a top
  // hairline on every child but the first.
  for (const [where, body] of [
    ['home .step', ruleBody(read(PACKS.home), '.step', { solo: true })],
    ['home .catch', ruleBody(read(PACKS.home), '.catch', { solo: true })],
    ['connect .step', ruleBody(read(PACKS.connect), '.step', { solo: true })],
    ['mfa .row', ruleBody(read(PACKS.mfa), '.row', { solo: true })],
  ] as const) {
    assert.ok(body, `${where} is gone`)
    assert.match(body, /border-top:\s*1px solid/, `${where} no longer separates with a top hairline`)
  }
  const role = ruleBody(read(APP), '.row-group > * + *', { solo: true })
  assert.ok(role, 'app.css has no .row-group role')
  assert.match(role, /border-top: 1px solid var\(--line\)/)
  // The separator is what is shared. The column grid inside a row is not: the
  // four packs set four different ones, and each belongs to its own pack.
  assert.doesNotMatch(role, /grid/, '.row-group must not impose a column grid')
})

// --------------------------------------- what the evidence does NOT share

test('a pattern only one pack draws did not become a global role', () => {
  const app = read(APP)
  const plan = read(PACKS.plan)
  const mfa = read(PACKS.mfa)

  // Each of these is drawn by exactly one pack, so each stays that pack's.
  // The check is two-sided: it fails if the pattern quietly becomes shared in
  // production, and it fails if the pack it belongs to stops drawing it.
  for (const [name, packCss, selector] of [
    ['the Plan finding card', plan, '.finding'],
    ['the Plan instruction block', plan, '.instruction'],
    ['the Plan action tab strip', plan, '.action-tab'],
    ['the Plan roadmap row', plan, '.roadmap-row'],
    ['the Plan lifecycle stage', plan, '.stage'],
    ['the MFA summary stat', mfa, '.summary-stat'],
    ['the MFA filter pill', mfa, '.filter'],
  ] as const) {
    assert.ok(ruleBody(packCss, selector), `${name} is no longer in its pack`)
    assert.equal(ruleBody(app, selector), undefined, `${name} became a global role in app.css — one pack is not evidence of sharing`)
  }

  // The Plan ALSO has a left-edge `.callout` strip, which is a different
  // anatomy from the attention panel above and has no second surface using it.
  // Production's shared .callout is the panel, so it must not have grown a
  // 3px left edge that no other pack asked for.
  assert.match(ruleBody(plan, '.callout', { solo: true })!, /border-left:\s*3px/, "the Plan's left-edge callout is gone")
  assert.doesNotMatch(ruleBody(app, '.callout', { solo: true })!, /border-left/, "the Plan's left-edge callout must not become the shared one")

  // The four packs set four different row grids. None of them may appear in the
  // SHARED layer: that is page anatomy, and it belongs to the surface that owns
  // it. Task 031 wrote this as "nowhere in app.css" because no restoration pack
  // had landed yet and app.css held no surface anatomy from a pack. Task 032
  // landed Connect's 46/1fr/auto step, and app.css is where a surface's own CSS
  // lives in this product — so the check is now the thing it always meant: not
  // in the shared roles block, and only ever under its own surface's selector.
  const sharedRoles = app.slice(app.indexOf('shared approved-design roles (task 031)'), app.indexOf('/* ================= a surface: prose and rows'))
  assert.ok(sharedRoles.length > 500, 'the shared roles block could not be located')
  for (const grid of ['126px', '46px minmax', 'minmax(210px', '78px 1fr', '160px 1fr']) {
    assert.ok(!sharedRoles.includes(grid), `the shared roles block copied a pack's column grid (${grid})`)
  }
  // And where a grid IS in app.css, it is on the surface that draws it.
  const stripped = app.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [grid, owner] of [['46px minmax', /^\.connect-/]] as const) {
    const carriers = [...stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[2].includes(grid)).map((m) => m[1].replace(/\s+/g, ' ').trim())
    assert.ok(carriers.length > 0, `${grid} is in no rule in app.css`)
    for (const sel of carriers) assert.match(sel, owner, `${grid} is set on "${sel}", which is not the surface that owns it`)
  }
})

// ------------------------------------------------------- the display role

test('the display role has one declaration and one knob, and production reads it', () => {
  const app = read(APP)
  // One source for the role. `.display` was declared beside h1/h2 with the same
  // three properties and no consumer at all; a second copy is how the two drift.
  assert.equal(app.match(/font-size: var\(--display-size\)/g)?.length, 1, 'the display role is declared more than once')
  const shared = ruleBody(app, '.display', { solo: true })
  assert.ok(shared, 'the .display role is gone')
  assert.match(shared, /--display-size: var\(--d-6\)/)
  assert.match(shared, /line-height: var\(--lh-display\)/)

  // A heading is on the role by setting one variable, which is what a
  // restoration pack changes. These are the sizes production is built at
  // today: the packs' own sizes are per-surface and are packs 032-038's.
  // h2 shares its rule with .wave-title, so this asks whether ANY rule naming
  // the heading sets the knob, not what one particular rule says.
  const setsKnob = (selector: string, token: string): boolean =>
    allRuleBodies(app, selector).some((b) => b.includes(`--display-size: var(${token})`))
  assert.ok(setsKnob('h1', '--t-6'), 'h1 is not on the display role')
  assert.ok(setsKnob('h2', '--t-5'), 'h2 is not on the display role')
  assert.ok(setsKnob('.wave-title', '--t-5'), '.wave-title is not on the display role')
})

test('the packs decide which headings are editorial, and they say some are not', () => {
  // Every page h1 in every pack is serif, which is why production's h1 is.
  for (const [surface, path] of Object.entries(PACKS)) {
    const css = read(path)
    assert.match(css, /h1\{font:\s*700 \d+px\/[\d.]+ Georgia/, `${surface} no longer sets its h1 in the display face`)
  }
  // And the opened Plan step's title is deliberately NOT: 21px in the
  // interface face. That is why h3 and h4 stay sans, and why a later pack must
  // not treat every heading as display text.
  const plan = read(PACKS.plan)
  assert.match(plan, /\.step-head h3\{[^}]*font-size:\s*21px/, "the Plan step title's size moved")
  assert.doesNotMatch(ruleBody(plan, '.step-head h3', { solo: true })!, /Georgia|serif/, 'the Plan step title is the interface face')
  const app = read(APP)
  assert.match(ruleBody(app, 'h3', { solo: true })!, /font-family: var\(--font-sans\)/)
  assert.match(ruleBody(app, 'h4', { solo: true })!, /font-family: var\(--font-sans\)/)
})

// ------------------------------------------------------------------ scope

test('the shared layer adds no second token system and no product meaning', () => {
  const app = read(APP)
  const block = app.slice(app.indexOf('shared approved-design roles (task 031)'), app.indexOf('.row-group > * + *') + 200)
  assert.ok(block.length > 500, 'the task 031 block is not where this test thinks it is')

  // Every colour and length still comes from the token file. A primitive layer
  // that minted its own values would be the second system this task exists to
  // avoid; src/ui/design-lint.test.ts rule 1 proves the colour half globally.
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b/, 'a colour literal entered the shared layer')
  assert.doesNotMatch(block, /--(?:t|d)-[a-z0-9-]+:/, 'the shared layer redefined a type token')

  // These primitives are visual roles. None of them may name a product
  // concept: rung, readiness, proof, lifecycle and enforcement are technical
  // truth and are decided in the engine, never in a stylesheet.
  for (const word of ['rung', 'readiness', 'proof', 'report-only', 'enforced', 'break-glass', 'emergency']) {
    assert.ok(!block.toLowerCase().includes(`.${word}`), `the shared layer defined a selector for the product concept "${word}"`)
  }
})

test('no tagline and no generated attribution reached the shared layer', () => {
  // The brand lockup has no tagline (docs/brand/brand-manifest.json), and the
  // generated branding previews are authority for nothing — including copy.
  // Built from parts so this file is not itself a hit for the string it bans.
  const banned = new RegExp(['Built', 'by', 'Jon', 'Hope'].join('\\s+'), 'i')
  for (const f of [APP, 'src/ui/components/Callout.tsx', 'docs/design/reports/031-shared-approved-design-primitives.md']) {
    assert.doesNotMatch(read(f), banned, `${f} carries a generated-preview attribution`)
  }
})
