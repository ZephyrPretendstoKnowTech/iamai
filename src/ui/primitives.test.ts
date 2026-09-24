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
  mfa: 'docs/design/approved/anatomy/mfa-readiness-v3.html',
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

// --------------------------------------- what the evidence does NOT share

test('a pattern only one pack draws did not become a global role', () => {
  const app = read(APP)
  const plan = read(PACKS.plan)
  const mfa = read(PACKS.mfa)

  // Each of these is drawn by exactly one pack, so each stays that pack's.
  // The check is two-sided: it fails if the pattern quietly becomes shared in
  // production, and it fails if the pack it belongs to stops drawing it.
  for (const [name, packCss, selector] of [
    ['the Plan readiness tile', plan, '.readiness-tile'],
    ['the Plan instruction block', plan, '.instruction'],
    ['the Plan action tab strip', plan, '.action-tab'],
    ['the Plan roadmap row', plan, '.roadmap-row'],
    ['the Plan lifecycle stage', plan, '.stage'],
    // MFA Readiness v3 (prompt 62): the device chip and the state ribbon are its own.
    ['the MFA device chip', mfa, '.dev'],
    ['the MFA state ribbon', mfa, '.ribbon'],
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
