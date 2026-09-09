// The design lint: the theme is one token file and a handful of primitives, and
// this is what keeps it that way. It reads src/ui/tokens.css, src/ui/app.css,
// every .css file and every inline `style` under src/ui/shell and
// src/ui/surfaces, and fails on:
//
//   design 1: a colour literal outside tokens.css
//   design 2: a box-shadow other than the focus ring or the one panel shadow;
//             a gradient, filter, text-shadow, or opacity on text
//   design 3: a border-radius that is not one of the three shape tokens,
//             except 50% on a circle and a 999px pill on a chip
//   design 4: a font-family not one of the three --font-* variables, a
//             font-weight that is not a named --weight-* role, a font-size not
//             a --t-*, --d-* or --display-size variable
//   design 5: --ok, --wait, --stop or --idle outside a .status rule
//   design 6: the raised surface only on a panel or a floating layer
//
// Task 030 changed rules 2, 3, 4 and 6, and made each of them stricter rather
// than looser. Before it, rule 3 was a 4px ceiling with a growing list of named
// selectors allowed a raw 8px, and rule 4 capped every font-size at --t-6
// (26px) and every weight at 500. That ceiling was load-bearing in the wrong
// direction: the owner-approved packs in docs/design/approved/ set display
// headings at 38-50px and the brand sets the wordmark at 700, so the lint as
// written made the approved design unreachable while still allowing raw px
// wherever the exception list grew. Now the shape hierarchy is three tokens
// (4 / 8 / 12, docs/brand/brand-manifest.json ui.radiusPx) and a radius must be
// one of them; the display ramp is --d-1 ... --d-15, every value read out of an
// approved pack; and a weight above 500 is reachable only by naming its role.
//
// These rules guard the token system. They do NOT claim the four approved
// surfaces have been restored: task 030 built the theme, type and shell
// foundation, and packs 031-038 own the page composition
// (docs/design/authority-reconciliation.md).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const TOKENS = 'src/ui/tokens.css'
/** home/theme.css is the same tokens, written by scripts/build-home.ts: a token file, not a stylesheet to lint. */
const TOKEN_COPIES = ['home/theme.css']
const SCANNED_CSS = ['src/ui/app.css']
const SCANNED_DIRS = ['src/ui/shell', 'src/ui/surfaces', 'home']
/** On borrowed time (prompt 47): deleted with the legacy pages in prompt 49. */
export const LEGACY_ALLOW_LIST: string[] = []
const CONTRACTS = JSON.parse(readFileSync(process.env.CONTRACTS_JSON ?? 'docs/qa/page-contracts.json', 'utf8')) as { enforceAll: boolean }

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(css|tsx|ts|html)$/.test(entry) && !/\.test\.ts$/.test(entry) && !TOKEN_COPIES.includes(full.replace(/\\/g, '/'))) out.push(full)
  }
  return out
}

type Rule = { file: string; selector: string; body: string }

/** Rules from a stylesheet: selector and declaration block, at-rules flattened. */
function rulesOf(css: string, file: string): Rule[] {
  const out: Rule[] = []
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const re = /([^{}]+)\{([^{}]*)\}/g
  for (const m of stripped.matchAll(re)) {
    const selector = m[1].trim().split('\n').at(-1)?.trim() ?? m[1].trim()
    if (/^@(media|supports|font-face|keyframes)/.test(selector) && m[2].trim() === '') continue
    out.push({ file, selector, body: m[2] })
  }
  return out
}

/** Inline `style={{ ... }}` and `style="..."` from the shell and surfaces, as pseudo-rules. */
function inlineStylesOf(src: string, file: string): Rule[] {
  const out: Rule[] = []
  for (const m of src.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) out.push({ file, selector: '(inline style)', body: m[1].replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/,/g, ';').replace(/['"]/g, '') })
  for (const m of src.matchAll(/style="([^"]*)"/g)) out.push({ file, selector: '(inline style)', body: m[1] })
  return out
}

function sources(): { tokens: string; rules: Rule[] } {
  const tokens = readFileSync(TOKENS, 'utf8')
  const rules: Rule[] = []
  const files = [...SCANNED_CSS, ...SCANNED_DIRS.flatMap((d) => walk(d))]
  if (process.env.DESIGN_LINT_EXTRA) files.push(process.env.DESIGN_LINT_EXTRA)
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    if (f.endsWith('.css')) rules.push(...rulesOf(text, f))
    else rules.push(...inlineStylesOf(text, f))
  }
  return { tokens, rules }
}

// A hex, a functional colour, or a colour keyword standing as a value (not
// inside a property name like white-space).
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|color-mix|oklch|lab)\s*\(|(?<![-\w])(?:white|black|red|blue|green|gray|grey|navy|teal|orange|yellow|purple|silver|cyan|magenta)(?![-\w])/
const where = (r: Rule, detail: string): string => `${r.file} — ${r.selector} — ${detail}`

test('design 1: no colour literal outside tokens.css', () => {
  const { rules } = sources()
  const hits = rules.filter((r) => COLOUR.test(r.body)).map((r) => where(r, r.body.match(COLOUR)?.[0] ?? ''))
  assert.deepEqual(hits, [])
})

test('design 2: no box-shadow except the focus ring and the one key-panel shadow; no gradient, filter, text-shadow, or opacity on text', () => {
  const { rules } = sources()
  const hits: string[] = []
  for (const r of rules) {
    for (const m of r.body.matchAll(/box-shadow\s*:\s*([^;]+)/g)) {
      const v = m[1].trim()
      // The approved Plan lifts an opened step off the page, and the approved
      // Connect lifts its staged flow the same way
      // (docs/design/approved/connect-v3.html `.flow{box-shadow:var(--shadow)}`).
      // One shadow value, on the two role classes the packs put it on.
      if (v === 'var(--shadow-panel)' && /\.panel-key\b|\.connect-flow\b/.test(r.selector)) continue
      if (v !== 'var(--focus-ring)' && v !== 'none') hits.push(where(r, `box-shadow: ${v}`))
    }
    if (/gradient\s*\(/.test(r.body)) hits.push(where(r, 'gradient'))
    if (/(^|[^-])filter\s*:/.test(r.body) && !/filter\s*:\s*none/.test(r.body)) hits.push(where(r, 'filter'))
    if (/text-shadow\s*:/.test(r.body) && !/text-shadow\s*:\s*none/.test(r.body)) hits.push(where(r, 'text-shadow'))
    // Opacity is a fade on a tooltip or a menu (motion), never a way to grey out text.
    if (/(^|[^-])opacity\s*:/.test(r.body) && !/tip|menu/.test(r.selector)) hits.push(where(r, 'opacity'))
  }
  assert.deepEqual(hits, [])
})

test('design 3: a border-radius is one of the three shape tokens, except a circle and a pill', () => {
  const { rules } = sources()
  // The brand's hierarchy (docs/brand/brand-manifest.json ui.radiusPx): a
  // compact row at 4, a control at 8, a deliberate grouped panel at 12. A raw
  // px value is what this rule exists to stop - the value belongs in
  // src/ui/tokens.ts, where the hierarchy is one authority.
  const SHAPE = new Set(['0', 'var(--radius)', 'var(--radius-control)', 'var(--radius-panel)'])
  const hits: string[] = []
  for (const r of rules) {
    for (const m of r.body.matchAll(/border-radius\s*:\s*([^;]+)/g)) {
      const v = m[1].trim()
      if (SHAPE.has(v)) continue
      // A shape may be asymmetric as long as every corner of it is still one of
      // the three tokens. The approved Plan pack draws the open roadmap row
      // that way — `.roadmap-row{border-radius:10px 10px 0 0}` in
      // docs/design/approved/plan-step-v1.html — because the row is the head of
      // the step attached under it and squares off the edge they share. What
      // this rule exists to stop is a raw px value, and a corner list built
      // only from --radius / --radius-control / --radius-panel / 0 introduces
      // none: the hierarchy is still the one authority.
      if (v.split(/\s+/).every((part) => SHAPE.has(part))) continue
      // A state dot is a circle: the shared `.status` dot, and the one the
      // approved Connect pack sets in its status strip
      // (docs/design/approved/connect-v3.html `.dot{border-radius:50%}`). So is
      // the ladder's rung badge (docs/design/mockups/today-v2.html).
      // And the bullet in a Plan rail's side list
      // (docs/design/approved/plan-step-v1.html `.tiny{border-radius:50%}`),
      // which is a list marker rather than a state: it carries the quiet ink,
      // not a status colour, and is hidden from assistive technology.
      if (v === '50%' && (/\.status::before/.test(r.selector) || /spinner|infotip-btn/.test(r.selector) || /\.connect-status \.dot/.test(r.selector) || /\.rung-badge/.test(r.selector) || /\.side-list \.tiny/.test(r.selector))) continue
      // A picker's chip is a pill (the accent tint, the name, a separate x),
      // and so is the shared `.pill` role — the Plan pack's state badge and the
      // MFA pack's readiness cell are both `border-radius:999px`
      // (docs/design/approved/plan-step-v1.html `.badge`,
      // docs/design/approved/mfa-readiness-v2.html `.status`), which is a full
      // round rather than a value on the 4/8/12 shape hierarchy.
      // and the approved Connect step's numbered badge, which that pack draws as
      // a full round rather than a value on the 4/8/12 hierarchy
      // (docs/design/approved/connect-v3.html `.num{border-radius:999px}`).
      if (v === '999px' && /\.chip-(select|remove)|\.pill\b|\.connect-step \.n\b/.test(r.selector)) continue
      hits.push(where(r, `border-radius: ${v}`))
    }
  }
  assert.deepEqual(hits, [])
})

test('design 4: font-family only via --font-*, a weight only via a named role, a size only via --t-* / --d-*', () => {
  const { rules } = sources()
  const hits: string[] = []
  for (const r of rules) {
    if (/@font-face/.test(r.selector)) continue
    for (const m of r.body.matchAll(/font-family\s*:\s*([^;]+)/g)) {
      const v = m[1].trim()
      if (!/^var\(--font-(serif|sans|mono)\)$/.test(v) && v !== 'inherit') hits.push(where(r, `font-family: ${v}`))
    }
    for (const m of r.body.matchAll(/font-weight\s*:\s*([^;]+)/g)) {
      const v = m[1].trim()
      // A named role, or one of the two weights the page was built on. 600 and
      // 700 exist in the token file and are reachable only through a role, so
      // nothing goes bold without saying which role it is being bold as.
      if (/^var\(--weight-(display|body|strong|wordmark)\)$/.test(v)) continue
      if (!['400', '500', 'inherit'].includes(v)) hits.push(where(r, `font-weight: ${v}`))
    }
    for (const m of r.body.matchAll(/font-size\s*:\s*([^;]+)/g)) {
      const v = m[1].trim()
      // The interface scale, the approved display ramp, or the display role's
      // own variable. Never a px literal.
      if (/^var\(--t-[a-z0-9-]+\)$/.test(v)) continue
      if (/^var\(--d-\d+\)$/.test(v)) continue
      if (v === 'var(--display-size)') continue
      if (v !== 'inherit') hits.push(where(r, `font-size: ${v}`))
    }
    for (const m of r.body.matchAll(/(^|;)\s*font\s*:\s*([^;]+)/g)) {
      const v = m[2].trim()
      if (v !== 'inherit') hits.push(where(r, `font: ${v}`))
    }
  }
  assert.deepEqual(hits, [])
})

test('design 5: --ok, --wait, --stop and --idle only inside a .status rule, or a Connect tile carrying its state colour', () => {
  const { rules } = sources()
  // A Connect step's number badge and state word carry the state colour, and so
  // does the dot in the status strip above the flow
  // (docs/design/approved/connect-v3.html). In each of those the state's word is
  // beside the colour, so the meaning never depends on the colour alone.
  const hits = rules
    .filter((r) => /var\(--(ok|wait|stop|idle)\)/.test(r.body) && !/\.status|\.connect-step|\.connect-status|\.connect-destination/.test(r.selector))
    .map((r) => where(r, r.body.match(/var\(--(ok|wait|stop|idle)\)/)?.[0] ?? ''))
  assert.deepEqual(hits, [])
})

test('design 6: --bg-raised only on the two-depth panels and the floating layers (prompt 49.1 item 12)', () => {
  const { rules } = sources()
  // The raised surface is the two content panels (.wave, .export-card) and the
  // floating layers that already sit above the page (a tooltip, a menu, a table
  // row on hover). Nothing else in the content flow may gain a box.
  // Connect's staged flow and its Plan destination are panels too
  // (docs/design/approved/connect-v3.html `.flow` and `.ready`), and so are the
  // home page's cards (docs/design/home-mockup.html; home/home.css). The steps
  // INSIDE the flow are not, and must not become so: they sit on the one panel,
  // which is what makes the flow contiguous instead of a stack of cards.
  const ALLOWED = /\.wave\b|\.phase\b|\.export-card|\.infotip-pop|\.menu-list|tbody tr:hover|\.connect-flow\b|\.connect-destination\b|\.card\b|\.panel\b/
  const hits = rules
    // --surface is the canonical name and --bg-raised its compatibility alias;
    // they are one value, so the rule checks both.
    .filter((r) => /var\(--(bg-raised|surface)\)/.test(r.body) && !ALLOWED.test(r.selector))
    .map((r) => where(r, 'the raised surface'))
  assert.deepEqual(hits, [], 'a new element gained the raised surface outside the panels and the floating layers')
})

test('every variable the primitives use is defined, and a colour can only come from the token file', () => {
  const { tokens, rules } = sources()
  const inTokens = new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
  // A role variable may be declared in the rule that uses it (`.display` sets
  // --display-size to a ramp token). It can only ever hold another variable or
  // a length: design 1 already fails on a colour literal in these files.
  const inSheets = new Set(rules.flatMap((r) => [...r.body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1])))
  const used = new Set(rules.flatMap((r) => [...r.body.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1])))
  const missing = [...used].filter((v) => !inTokens.has(v) && !inSheets.has(v))
  assert.deepEqual(missing, [], 'variables used but never defined')
})

test('the legacy allow-list is empty once the contract enforces every surface', () => {
  if (CONTRACTS.enforceAll) assert.deepEqual(LEGACY_ALLOW_LIST, [], 'styles.css and src/ui/pages are gone with prompt 49')
  else assert.ok(LEGACY_ALLOW_LIST.length > 0)
})
