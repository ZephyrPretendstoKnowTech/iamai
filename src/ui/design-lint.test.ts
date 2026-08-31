// The design lint (prompt 47 Part 1 item 4): the theme is one token file and a
// handful of primitives, and this is what keeps it that way. It reads
// src/ui/tokens.css, src/ui/app.css, every .css file and every inline `style`
// under src/ui/shell and src/ui/surfaces, and fails on:
//
//   design 1: a colour literal outside tokens.css
//   design 2: a box-shadow other than the focus ring; a gradient, filter,
//             text-shadow, or opacity on text
//   design 3: a border-radius over 4px, except 50% on .status::before
//   design 4: a font-family not one of the three --font-* variables, a
//             font-weight other than 400 or 500, a font-size not a --t-* variable
//   design 5: --ok, --wait, --stop or --idle outside a .status rule
//
// styles.css and src/ui/pages/** are on a legacy allow-list until prompt 49;
// the last test asserts that list is empty once the contract's enforceAll is
// true. scripts/lint-mutations.mjs proves each of the five checks fails on an
// injected violation (DESIGN_LINT_EXTRA names the injected file).
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

test('design 2: no box-shadow except the focus ring; no gradient, filter, text-shadow, or opacity on text', () => {
  const { rules } = sources()
  const hits: string[] = []
  for (const r of rules) {
    for (const m of r.body.matchAll(/box-shadow\s*:\s*([^;]+)/g)) {
      const v = m[1].trim()
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

test('design 3: border-radius at most 4px, or 8px on a .wave / .export-card panel, except 50% on .status::before', () => {
  const { rules } = sources()
  const hits: string[] = []
  for (const r of rules) {
    for (const m of r.body.matchAll(/border-radius\s*:\s*([^;]+)/g)) {
      const v = m[1].trim()
      if (v === '0' || v === 'var(--radius)') continue
      if (v === '50%' && (/\.status::before/.test(r.selector) || /spinner|infotip-btn/.test(r.selector))) continue
      const px = v.match(/^(\d+(?:\.\d+)?)px$/)
      if (px && Number(px[1]) <= 4) continue
      // The two surface-depth panels (prompt 49.1 item 12) may round to 8px.
      if (px && Number(px[1]) <= 8 && /\.wave|\.export-card/.test(r.selector)) continue
      hits.push(where(r, `border-radius: ${v}`))
    }
  }
  assert.deepEqual(hits, [])
})

test('design 4: font-family only via --font-*, font-weight 400 or 500, font-size only via --t-*', () => {
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
      if (!['400', '500', 'inherit'].includes(v)) hits.push(where(r, `font-weight: ${v}`))
    }
    for (const m of r.body.matchAll(/font-size\s*:\s*([^;]+)/g)) {
      const v = m[1].trim()
      if (!/^var\(--t-[1-6]\)$/.test(v) && v !== 'inherit') hits.push(where(r, `font-size: ${v}`))
    }
    for (const m of r.body.matchAll(/(^|;)\s*font\s*:\s*([^;]+)/g)) {
      const v = m[2].trim()
      if (v !== 'inherit') hits.push(where(r, `font: ${v}`))
    }
  }
  assert.deepEqual(hits, [])
})

test('design 5: --ok, --wait, --stop and --idle only inside a .status rule', () => {
  const { rules } = sources()
  const hits = rules
    .filter((r) => /var\(--(ok|wait|stop|idle)\)/.test(r.body) && !/\.status/.test(r.selector))
    .map((r) => where(r, r.body.match(/var\(--(ok|wait|stop|idle)\)/)?.[0] ?? ''))
  assert.deepEqual(hits, [])
})

test('design 6: --bg-raised only on the two-depth panels and the floating layers (prompt 49.1 item 12)', () => {
  const { rules } = sources()
  // The raised surface is the two content panels (.wave, .export-card) and the
  // floating layers that already sit above the page (a tooltip, a menu, a table
  // row on hover). Nothing else in the content flow may gain a box.
  const ALLOWED = /\.wave\b|\.export-card|\.infotip-pop|\.menu-list|tbody tr:hover/
  const hits = rules
    .filter((r) => /var\(--bg-raised\)/.test(r.body) && !ALLOWED.test(r.selector))
    .map((r) => where(r, 'var(--bg-raised)'))
  assert.deepEqual(hits, [], 'a new element gained the raised surface outside the panels and the floating layers')
})

test('the token file defines every colour the primitives use, and nothing is imported from outside', () => {
  const { tokens, rules } = sources()
  const defined = new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
  const used = new Set(rules.flatMap((r) => [...r.body.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1])))
  const missing = [...used].filter((v) => !defined.has(v))
  assert.deepEqual(missing, [], 'variables used but never defined in tokens.css')
})

test('the legacy allow-list is empty once the contract enforces every surface', () => {
  if (CONTRACTS.enforceAll) assert.deepEqual(LEGACY_ALLOW_LIST, [], 'styles.css and src/ui/pages are gone with prompt 49')
  else assert.ok(LEGACY_ALLOW_LIST.length > 0)
})
