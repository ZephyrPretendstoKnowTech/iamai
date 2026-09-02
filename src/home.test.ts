// The home page and the tool folder (prompt 35 §1, §2; prompt 52 Part 1).
//
// The page is generated from docs/design/content.json (pages.home) by
// scripts/build-home.ts, the way the theme file is generated from the tokens.
// These lock the committed files to their generators — so the words the owner
// reviews in content.json and the words the home page shows cannot drift — and
// hold the structural invariants the page keeps whatever the copy says.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const PRODUCT = (pages.home as { planner: { name: string } }).planner
import { pages } from './content/content.ts'
import { renderHomeHtml, renderHomeTheme } from '../scripts/build-home.ts'

const home = 'home'
const lf = (s: string): string => s.replace(/\r\n/g, '\n')
const html = lf(readFileSync(join(home, 'index.html'), 'utf8'))
const css = readFileSync(join(home, 'home.css'), 'utf8')
const theme = readFileSync(join(home, 'theme.css'), 'utf8')
const H = pages.home as Record<string, unknown>
const tools = JSON.parse(readFileSync(join(home, 'tools.json'), 'utf8')) as {
  name: string
  description: string
  status: string
  path: string | null
}[]

// Every sentence the home page shows is a string in content.json: the page is
// its generator's output, and the generator reads only pages.home.
test('home/index.html is generated from pages.home, and is current', () => {
  assert.equal(html, lf(renderHomeHtml()), 'run node scripts/build-home.ts')
})

test('the template keeps the tool-path placeholder for the build to substitute', () => {
  assert.ok(html.includes('{{TOOL_PATH}}'), 'the planner hrefs are substituted rather than written out')
  assert.ok(theme.includes('{{TOOL_PATH}}'), 'the font path is substituted rather than written out')
})

// Prompt 47.1 Part 3: the home wears the planner's tokens, written by the build.
test('home/theme.css is the planner\'s tokens, and is current', () => {
  assert.equal(lf(theme), lf(renderHomeTheme()), 'run node scripts/build-home.ts')
  assert.match(html, /<link rel="stylesheet" href="\/theme\.css" \/>/)
  assert.doesNotMatch(css, /@font-face/, 'the fonts come from the token file')
})

test('the theme control shares the planner\'s key and labels', () => {
  assert.match(html, /'iamai-theme'/)
  assert.match(html, /Light theme/)
  assert.match(html, /Dark theme/)
  assert.match(html, /prefers-color-scheme: dark/)
})

test('the tool path is never hard-coded outside the build constant', () => {
  // The one place "rollout" may appear is vite.config.ts and the assemble
  // script, as the default for TOOL_PATH.
  for (const file of ['index.html', 'home.css', 'theme.css']) {
    const text = readFileSync(join(home, file), 'utf8')
    assert.doesNotMatch(text, /\/rollout\b/, `${file} spells out the tool path instead of using the placeholder`)
  }
})

test('every tool has what a card needs', () => {
  assert.ok(tools.length > 0, 'at least one tool')
  for (const t of tools) {
    assert.ok(t.name.length > 3, 'a name')
    assert.ok(t.description.length > 40, `${t.name}: a description worth reading`)
    assert.ok(['live', 'testing', 'planned'].includes(t.status), `${t.name}: a status the page can render`)
    assert.ok(t.path === null || typeof t.path === 'string', `${t.name}: a path or null`)
  }
})

test('the planner is the first tool, and its name lives in one place', () => {
  const first = tools[0]
  assert.equal(first.name, PRODUCT.name)
  // An empty path means "this repository's tool", which the build resolves to TOOL_PATH.
  assert.equal(first.path, '')
})

// The home page shows the planner from pages.home.planner (prompt 52 Part 1):
// its name, the Preview label, the descriptor, the body, and the two actions.
test('the home page shows the planner entry from content', () => {
  const pl = H.planner as Record<string, string>
  assert.match(html, /class="pill">Preview</)
  for (const key of ['name', 'descriptor', 'body', 'open', 'demo'] as const) {
    assert.ok(html.includes(pl[key]), `the planner ${key} is on the page`)
  }
  assert.equal(pl.name, PRODUCT.name)
})

test('the home page shows the intro, the three sections and the footer from content', () => {
  assert.ok(html.includes(H.h1 as string), 'the headline is content.h1')
  assert.ok(html.includes(H.intro as string), 'the lede is content.intro')
  assert.ok(html.includes(H.about as string), 'About is content.about')
  for (const line of H.how as string[]) {
    // The source bullet carries a link inside it; match the sentence up to the link.
    assert.ok(html.includes(line.split('github.com/')[0].trim().slice(0, 40)), 'each How line is from content')
  }
  assert.ok(html.includes(H.footer as string), 'the footer line is content.footer')
  for (const l of H.footerLinks as string[]) assert.ok(html.includes(`>${l}</a>`), `footer link ${l}`)
})

test('the page carries its title, description and a shareable image, all from content', () => {
  assert.match(html, new RegExp(`<title>${(H.metaTitle as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</title>`))
  assert.ok(html.includes(H.metaDescription as string), 'the meta description is content.metaDescription')
  assert.match(html, /og:image/)
  assert.ok(readdirSync(home).includes('og.png'), 'the OpenGraph image ships with the page')
})

test('the home page loads nothing from anywhere else', () => {
  // Same rule as the app (CLAUDE.md): no CDN, no framework, no analytics. The
  // one script is inline and same-origin: the theme control (prompt 47.1).
  assert.doesNotMatch(html, /<script[^>]*\ssrc=/i, 'no script is fetched')
  assert.doesNotMatch(html, /https?:\/\/[^"']*\.(js|css)\b/i, 'nothing loaded from another host')
  assert.doesNotMatch(css, /@import/i, 'no imported stylesheet')
})

test('the home page is one column: the sections in order', () => {
  for (const m of css.matchAll(/border-radius:\s*([^;]+);/g)) assert.ok(['var(--radius)', '50%', '0'].includes(m[1].trim()), `radius ${m[1]} is beyond the token`)
  const order = [H.h1 as string, `>${H.toolsLabel}<`, `>${H.howLabel}<`, `>${H.aboutLabel}<`]
  let at = -1
  for (const s of order) {
    const i = html.indexOf(s)
    assert.ok(i > at, `${s} comes in order`)
    at = i
  }
})
