// The home page and the tool folder (prompt 35 §1, §2).
//
// The layout is assembled by scripts/assemble-site.mjs at build time, so these
// hold the inputs to it: the template keeps the markers the script substitutes,
// the tool data has the fields the cards need, and the tool path appears in
// exactly one place rather than being spelled out around the repo.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PRODUCT } from './copy/product.ts'
import { renderHomeTheme } from '../scripts/build-home.ts'

const home = 'home'
const html = readFileSync(join(home, 'index.html'), 'utf8')
const css = readFileSync(join(home, 'home.css'), 'utf8')
const theme = readFileSync(join(home, 'theme.css'), 'utf8')
const tools = JSON.parse(readFileSync(join(home, 'tools.json'), 'utf8')) as {
  name: string
  description: string
  status: string
  path: string | null
}[]

test('the template keeps the markers the build substitutes', () => {
  assert.ok(html.includes('<!-- tools -->'), 'the tool rows have somewhere to go')
  assert.ok(theme.includes('{{TOOL_PATH}}'), 'the font path is substituted rather than written out')
})

// Prompt 47.1 Part 3: the home wears the planner's tokens, written by the build.
test('home/theme.css is the planner\'s tokens, and is current', () => {
  assert.equal(theme.replace(/\r\n/g, '\n'), renderHomeTheme().replace(/\r\n/g, '\n'), 'run node scripts/build-home.ts')
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

test('the planner is the first card, and points at the tool folder', () => {
  const first = tools[0]
  // The name lives in one place (prompt 47.1 Part 4).
  assert.equal(first.name, PRODUCT.name)
  // An empty path means "this repository's tool", which the build resolves to
  // TOOL_PATH; anything else is a sibling folder.
  assert.equal(first.path, '')
})

test('the home page says the three things every tool promises', () => {
  assert.match(html, /Read-only/)
  // The claim used to be absolute and is not any more (audit egress-05): the
  // tools' own export features move data when the user asks. What the page
  // promises now is that nothing moves on its own.
  assert.match(html, /Nothing is sent automatically/i)
  assert.match(html, /source is public/i)
})

test('the page carries its title, description and a shareable image', () => {
  assert.match(html, /<title>IAMAI — tools for Microsoft Entra identity work<\/title>/)
  assert.match(html, /<meta\s+name="description"/)
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

test('the home page is one column: no cards, no boxes, the three sections in order', () => {
  assert.doesNotMatch(css, /tool-card/, 'no card')
  for (const m of css.matchAll(/border-radius:\s*([^;]+);/g)) assert.ok(['var(--radius)', '50%', '0'].includes(m[1].trim()), `radius ${m[1]} is beyond the token`)
  const order = ['Know what a change will do before you make it.', '>Tools<', '>How these work<', '>About<']
  let at = -1
  for (const s of order) {
    const i = html.indexOf(s)
    assert.ok(i > at, `${s} comes in order`)
    at = i
  }
  const lede = html.match(/<p class="lede">([\s\S]*?)<\/p>/)?.[1].replace(/\s+/g, ' ').trim() ?? ''
  assert.ok(lede.split(' ').length <= 40, `the lede is ${lede.split(' ').length} words`)
  const about = html.match(/<h2 id="about-heading">About<\/h2>\s*<p>([\s\S]*?)<\/p>/)?.[1].replace(/\s+/g, ' ').trim() ?? ''
  assert.ok(about.split(' ').length <= 60, `About is ${about.split(' ').length} words`)
})
