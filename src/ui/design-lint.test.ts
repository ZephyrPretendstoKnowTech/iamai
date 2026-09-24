// The design lint: the theme is one token file and a handful of primitives, and
// this is what keeps it that way. It reads src/ui/tokens.css, src/ui/app.css,
// every .css file and every inline `style` under src/ui/shell,
// src/ui/surfaces and home, and fails on:
//
//   design 1: a colour literal outside tokens.css
//   design 5: a state colour painted where no word or icon says which state it is
//   a custom property read that nothing declares
//   a font face served from anywhere but this origin
//
// Task 040 rewrote rule 5: it names the state roles themselves, so a state
// colour may only be painted where a word or an icon says which state it is.
// Rules 2, 3, 4 and 6 (shadows, radii, type roles, the raised surface) were
// presentation pins and were retired with the test-suite cut of 2026-09-23;
// the approved packs and the rendered comparison own those.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const TOKENS = 'src/ui/tokens.css'
/** home/theme.css is the same tokens, written by scripts/build-home.ts: a token file, not a stylesheet to lint. */
const TOKEN_COPIES = ['home/theme.css']
const SCANNED_CSS = ['src/ui/app.css']
const SCANNED_DIRS = ['src/ui/shell', 'src/ui/surfaces', 'home']

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

test('design 5: a state colour is painted only where a word or an icon carries the state with it', () => {
  const { rules } = sources()
  // The state roles, by their canonical names. Until task 040 this rule named
  // the legacy aliases --ok / --wait / --stop, which meant it constrained the
  // OLD name and let the same colour through under its canonical one: the
  // callout tones were already painting `--success-text` and `--danger-text`
  // outside every selector listed here, and the rule could not see them. It now
  // names the roles themselves, which is what it was always trying to say.
  //
  // Where a state colour is allowed, and why each is not colour alone:
  //   .status          the status word itself
  //   .callout-*       a notice whose tone is border + tint + icon, with the
  //                    words at full body contrast (task 031)
  //   .connect-*       a step number, a state word and the strip's dot, each
  //                    beside its own word (docs/design/approved/anatomy/connect-v3.html)
  //   .rung-*, .stat-n a ladder rung and the count it names, both labelled
  //   .stage-*         a lifecycle stage, whose name is under the bar
  //   .plan-controls .dot-*
  //                    the dot inside a focus control, whose own label is the
  //                    state it filters to ("Needs attention", "Up next"). The
  //                    dot is `aria-hidden` and the word is the control's name,
  //                    so nothing here is carried by the colour.
  //   .plan-row-number.number-*
  //                    a Plan row's place in its group, tinted with the row's own
  //                    lane tone. The lane label ("Ready · Create", "On Hold ·
  //                    Baseline conflict") is the next zone along, in body ink and
  //                    unchanged, so the state is in words on the same row; the
  //                    numeral is `aria-hidden` and is a second cue only.
  //   (The v2 admin role name and the Step 7 proof mark were allowed here until
  //   their designs were archived on 2026-09-19; production draws neither.)
  const STATE = /var\(--(success|attention|danger|admin|unproven)(-text)?\)|var\(--idle\)|var\(--rung-\d\)/
  //   .readiness-status-*
  //                    the opened Plan step's readiness mark (docs/design/approved/
  //                    anatomy/plan-step-v1.html `.readiness-status`): a ✓ ! … glyph
  //                    beside the tile's own label and value, so the words say it.
  //   MFA Readiness v3 (prompt 62, mfa-readiness-v3.html):
  //   .state-dot.s-*   the dot beside a state's own word (the legend, a group, the panel)
  //   .dev-word.s-*    a device chip's word, which is the state itself
  //   .readiness-bar .s-*
  //                    the bar, aria-hidden, whose legend names every state and count
  //   .readiness-change b
  //                    the "+N" beside the word Ready or Seamless
  //   .surface.readiness .tag
  //                    the Admin tag: the role's own NAME in the admin colour
  //   .readiness-tile li .ok
  //                    the check mark beside a completed check's own words
  const CARRIES_A_WORD = /\.status|\.callout-|\.plan-row-number\.number-|\.connect-step|\.connect-status|\.connect-destination|\.rung-|\.stat-n|\.stage-|\.side-list \.tiny|\.print-|\.plan-controls \.dot-|\.readiness-status-|\.state-dot\.s-|\.dev-word\.s-|\.readiness-bar \.s-|\.readiness-change b|\.surface\.readiness \.tag|\.readiness-tile li \.ok/
  const hits = rules
    .filter((r) => STATE.test(r.body) && !CARRIES_A_WORD.test(r.selector))
    .map((r) => where(r, r.body.match(STATE)?.[0] ?? ''))
  assert.deepEqual(hits, [], 'a state colour is painted where nothing says which state it is')
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

test('the three IBM Plex roles are served from this origin, and nothing asks a CDN', () => {
  const tokensCss = readFileSync(TOKENS, 'utf8')
  for (const family of ['IBM Plex Serif', 'IBM Plex Sans', 'IBM Plex Mono']) {
    assert.ok(tokensCss.includes(`font-family: '${family}'`), `${family} has no @font-face`)
  }
  for (const m of tokensCss.matchAll(/src: url\('([^']+)'\)/g)) {
    assert.match(m[1], /^\/fonts\/IBMPlex/, `${m[1]} is not a local IBM Plex face`)
    assert.ok(existsSync(`public${m[1]}`), `${m[1]} is declared but not published`)
  }
  assert.doesNotMatch(tokensCss, /https?:/, 'a remote font URL in the token sheet')
  for (const sheet of ['src/ui/app.css', 'home/home.css', 'home/theme.css']) {
    const code = readFileSync(sheet, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    assert.ok(!/@import|https?:\/\/fonts\.|cdn\./i.test(code), `${sheet} asks a third party for a face`)
  }
})
