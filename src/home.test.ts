// The home page (prompt 35 §1, §2; prompt 52 Part 1; rebuilt by task 016).
//
// These assertions hold the page as built to its generator and to its content.
// They are not the owner's design target: Home's visual authority is
// docs/design/approved/home-v2.html (see
// docs/design/approved/manifest.json), which this page does not yet implement.
// A restoration pack updates these structural assertions with the page; task 028
// only corrected what they claim to be (docs/design/authority-reconciliation.md).
//
// The page is generated from docs/design/content.json (pages.home) by
// scripts/build-home.ts, the way the theme file is generated from the tokens.
// These lock the committed files to their generators — so the words the owner
// reviews in content.json and the words the home page shows cannot drift — and
// hold the structural invariants the page keeps whatever the copy says: the
// hero with the outcome and the only two actions, the five sections after it,
// About's three buttons, the app's footer, the app's button weights, light and
// dark. The assertions are about shape and about the facts that have to be true
// (read-only, browser-local, public source, the baseline's author), never about
// a particular sentence: the copy is the owner's to change.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

import { content, pages } from './content/content.ts'
import { LAYOUT, LIGHT, TYPE } from './ui/tokens.ts'
import { RETIRED_OPENER, assembleHome, beatList, catchList, renderHomeHtml, renderHomeTheme, trustList, versionedName } from '../scripts/build-home.ts'
import type { HomeBeat, HomeTrust } from '../scripts/build-home.ts'
import { TOOL_PATH } from '../scripts/toolPath.ts'

const home = 'home'
const lf = (s: string): string => s.replace(/\r\n/g, '\n')
const html = lf(readFileSync(join(home, 'index.html'), 'utf8'))
const css = lf(readFileSync(join(home, 'home.css'), 'utf8'))
const theme = lf(readFileSync(join(home, 'theme.css'), 'utf8'))
const appCss = lf(readFileSync('src/ui/app.css', 'utf8'))
const H = pages.home as Record<string, unknown>
const WORK = H.work as HomeBeat[]
const CATCHES = H.catches as string[]
const TRUST = H.trust as HomeTrust[]
const ABOUT_LINKS = H.aboutLinks as { text: string; href: string }[]
const FOOTER = (pages.footer as { links: { text: string; href: string }[] }).links
const SHELL = pages.app.shell as { lightTheme: string; darkTheme: string; themeTooltip: string }
const REPO = 'https://github.com/ZephyrPretendstoKnowTech/iamai'

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const unesc = (s: string): string => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
const re = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** The one element of the page with this class, opening tag to closing tag. */
const segment = (doc: string, tag: string, cls: string): string => {
  const m = doc.match(new RegExp(`<${tag} class="${re(cls)}"[^>]*>[\\s\\S]*?</${tag}>`))
  assert.ok(m, `one <${tag} class="${cls}"> on the page`)
  return m[0]
}
/** Every visible text piece between tags, entities decoded, whitespace folded. */
const textPieces = (doc: string): string[] =>
  doc
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .split(/<[^>]+>/)
    .map((s) => unesc(s).replace(/\s+/g, ' ').trim())
    .filter((s) => s !== '' && s !== '·' && s !== '|')
/** The string leaves of a content object, hrefs set aside (they are structure, not words). */
const leaves = (node: unknown, out: string[] = [], key = ''): string[] => {
  if (typeof node === 'string') {
    if (key !== 'href') out.push(node)
  } else if (Array.isArray(node)) node.forEach((v) => leaves(v, out, key))
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) leaves(v, out, k)
  return out
}
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]))
/** A rule's declarations, whitespace folded, from the first `selector {` at a line start. */
const rule = (sheet: string, selector: string): string | null => {
  const m = sheet.match(new RegExp(`(?:^|\\n)${re(selector)} \\{([^}]*)\\}`))
  return m ? m[1].replace(/\s+/g, ' ').trim() : null
}

// Every sentence the home page shows is a string in content.json: the page is
// its generator's output, and the generator reads pages.home (the footer and
// the theme labels are the app's own keys).
test('home/index.html is generated from pages.home, and is current', () => {
  assert.equal(html, lf(renderHomeHtml()), 'run node scripts/build-home.ts')
})

test('the template keeps the tool-path placeholder for the build to substitute', () => {
  assert.ok(html.includes('{{TOOL_PATH}}'), 'the planner hrefs are substituted rather than written out')
  assert.ok(theme.includes('{{TOOL_PATH}}'), 'the font path is substituted rather than written out')
})

// Prompt 47.1 Part 3: the home wears the planner's tokens, written by the build.
test("home/theme.css is the planner's tokens, and is current", () => {
  assert.equal(theme, lf(renderHomeTheme()), 'run node scripts/build-home.ts')
  assert.match(html, /<link rel="stylesheet" href="\/theme\.css" \/>/)
  assert.doesNotMatch(css, /@font-face/, 'the fonts come from the token file')
})

test("the theme control is the app's: its key, its labels, text without a button face", () => {
  assert.match(html, /'iamai-theme'/)
  assert.ok(html.includes(JSON.stringify({ light: SHELL.lightTheme, dark: SHELL.darkTheme })), 'the labels are pages.app.shell')
  assert.match(html, /prefers-color-scheme: dark/)
  const header = segment(html, 'header', 'app')
  assert.match(header, new RegExp(`<button class="text-control" id="theme" type="button" title="${re(esc(SHELL.themeTooltip))}">${re(esc(SHELL.darkTheme))}</button>`))
  assert.equal(rule(css, 'header.app .right .text-control'), rule(appCss, 'header.app .right .text-control'), "the text control's rule is the app's")
})

test('the tool path is never hard-coded outside the build constant', () => {
  // scripts/toolPath.ts is the only place the folder is named; the home page
  // and its sheets carry the {{TOOL_PATH}} placeholder instead. The retired
  // /rollout/ path is named here so it cannot come back by hand.
  for (const file of ['index.html', 'home.css', 'theme.css']) {
    const text = readFileSync(join(home, file), 'utf8')
    assert.doesNotMatch(text, new RegExp(`/${TOOL_PATH}\b`), `${file} spells out the tool path instead of using the placeholder`)
    assert.doesNotMatch(text, /\/rollout\b/, `${file} still points at the retired /rollout/ path`)
  }
})

// The hero: the outcome, the line under it, the two ways in, and one note. The
// opener the mockup retired stays gone, on the page and in the content.
test('the hero leads with the outcome and carries the only two actions; the retired opener is gone', () => {
  const hero = segment(html, 'div', 'hero')
  assert.ok(hero.includes(`<h1>${esc(H.h1 as string)}</h1>`), 'the headline is content.h1')
  assert.ok(hero.includes(`<p class="site-line">${esc(H.siteLine as string)}</p>`), 'the site line is content.siteLine')
  assert.ok(hero.includes(`<p class="note">${esc(H.heroNote as string)}</p>`), 'the note is content.heroNote')
  const buttons = [...hero.matchAll(/<a class="btn btn-(\w+)" href="([^"]+)">([^<]+)<\/a>/g)].map((m) => ({ weight: m[1], href: m[2], text: unesc(m[3]) }))
  assert.deepEqual(buttons, [
    { weight: 'primary', href: '/{{TOOL_PATH}}/#/connect', text: H.open as string },
    { weight: 'secondary', href: '/{{TOOL_PATH}}/?demo=1#/plan', text: H.demo as string },
  ])
  // One pair of actions on the whole page: the v2 direction does not repeat a
  // call to action after every section.
  assert.equal((html.match(/href="\/\{\{TOOL_PATH\}\}\//g) ?? []).length, 2, 'the two ways in are in the hero and nowhere else')
  assert.ok(RETIRED_OPENER.length >= 5, 'the retired opener is listed')
  for (const s of RETIRED_OPENER) {
    assert.ok(!html.includes(s) && !html.includes(esc(s)), `the retired opener remains on the page: "${s}"`)
    assert.ok(!JSON.stringify(H).includes(s), `the retired opener remains in pages.home: "${s}"`)
  }
  for (const key of ['intro', 'footer', 'footerLinks']) assert.ok(!(key in H), `pages.home.${key} was retired`)
})

// Task 016: the outcome comes before the mechanism. A visitor reads what IAMAI
// is for before it names Conditional Access, and the headline is not a process.
test('the first screen is the security outcome, not the mechanism', () => {
  const body = html.slice(html.indexOf('<body>'))
  const first = body.slice(body.indexOf('<div class="hero">'), body.indexOf('<section class="band"'))
  assert.doesNotMatch(first, /Conditional Access/, 'the hero explains the outcome; the term comes later, with context')
  assert.match(body, /Conditional Access/, 'and the page does eventually say what it plans')
  assert.ok(body.indexOf('Conditional Access') > body.indexOf(esc(H.siteLine as string)), 'the term comes after the outcome')
  // No AI-first or generic-SaaS language, and nothing describing the product as magic.
  assert.doesNotMatch(html, /\bAI-powered\b|\bpowered by AI\b|\bmagic(al)?\b|\bseamless\b|\bworld-class\b|\bgame.chang/i, html.match(/\bAI-powered\b|\bmagic\b|\bseamless\b/i)?.[0] ?? '')
})

// The obsolete composition: the tool card, its Preview pill and the Tools grid
// left with the approved v2 direction and may not come back by hand.
test('the old tool-card composition is gone: no card wall, no pill, no Tools grid', () => {
  for (const gone of ['class="card', 'class="pill"', 'class="grid', 'tool-name', 'tools-heading', 'how-heading']) {
    assert.ok(!html.includes(gone), `the retired home composition is back: ${gone}`)
    assert.ok(!css.includes(gone.replace('class="', '.').replace(/"$/, '')), `home.css still styles the retired ${gone}`)
  }
  assert.ok(!('planner' in H) && !('toolsLabel' in H) && !('howLabel' in H) && !('how' in H), 'the tool-card content keys were retired')
  assert.ok(!JSON.stringify(H).includes('Preview'), 'the Preview pill and its word are gone')
  // Nothing on the page is a raised box: the sections are separated by a rule.
  assert.match(css, /\.band \{\s*border-top: 1px solid var\(--rule\);/, 'a section is a hairline, not a card')
  assert.doesNotMatch(css, /background: var\(--bg-raised\)/, 'no raised panel remains in the home stylesheet')
})

// Five sections after the hero, in order, each a heading and its body.
test('the page is the hero and five sections, in order, from content', () => {
  const bands = [...html.matchAll(/<section class="band" aria-labelledby="([a-z]+)-heading">\s*<h2 id="\1-heading">([^<]+)<\/h2>/g)].map((m) => ({ id: m[1], title: unesc(m[2]) }))
  assert.deepEqual(bands, [
    { id: 'work', title: H.workLabel as string },
    { id: 'baseline', title: H.baselineLabel as string },
    { id: 'catches', title: H.catchesLabel as string },
    { id: 'trust', title: H.trustLabel as string },
    { id: 'about', title: H.aboutLabel as string },
  ])
  // A heading for every section and no orphan heading: h1, then five h2, nothing deeper.
  assert.equal((html.match(/<h1>/g) ?? []).length, 1)
  assert.equal((html.match(/<h2 /g) ?? []).length, 5)
  assert.equal((html.match(/<h3/g) ?? []).length, 0, 'the page has no third heading level to skip to')
})

// What it does: the visitor should be able to say what IAMAI reads, what the
// comparison is against, and that the output is an ordered plan.
test('What it does is the three beats, and the last one is the plan', () => {
  const band = segment(html, 'section', 'band')
  assert.ok(band.includes(beatList(WORK)), 'the section renders through beatList')
  assert.equal(WORK.length, 3)
  assert.deepEqual(
    WORK.map((b) => b.verb),
    ['Reads', 'Compares', 'Plans'],
    'the loop is read, compare, plan; Writes retired with the v2 direction',
  )
  assert.match(WORK[0].text, /policies|people|sign-in/, 'the first beat says what it reads')
  assert.match(WORK[2].text, /step|plan/i, 'the last beat says the output is an ordered plan')
})

// The baseline, for a visitor who has never met the term: what it is, whose it
// is, why the source is credible, and what it aims at. No Microsoft endorsement.
test('the baseline section explains the term and attributes it without claiming an endorsement', () => {
  const said = [H.baseline, H.baselineGoal, H.baselineNote].join(' ') as string
  assert.match(H.baseline as string, /^A baseline is /, 'the term is explained before it is used')
  for (const fact of ['Defense in Depth', 'Jon Hope', 'Microsoft MVP']) assert.ok(said.includes(fact), `the section names ${fact}`)
  assert.ok(html.includes(esc(said.split(' ')[0])), 'the section is on the page')
  assert.doesNotMatch(said, /Microsoft(-| )(approved|certified|endorsed|recommended|official)|endorse|certifie|approved by Microsoft|partnership/i, said)
})

// A small set of real examples, and no more. Each is something the product can
// actually find in a tenant before a change goes live.
test('the examples are a short plain list, not a feature grid', () => {
  assert.ok(html.includes(catchList(CATCHES)), 'the section renders through catchList')
  assert.ok(CATCHES.length >= 3 && CATCHES.length <= 6, `${CATCHES.length} examples; a few, not a wall`)
  assert.equal((html.match(/<ul class="catch">/g) ?? []).length, 1)
})

// Trust is specific and checkable: read-only, the tenant's data stays in the
// browser, the source is public. Vague reassurance is not enough.
test('the trust section names read-only, browser-local handling and the public source', () => {
  assert.ok(html.includes(trustList(TRUST)), 'the section renders through trustList')
  const said = TRUST.map((t) => `${t.title} ${t.body}`).join(' ')
  assert.match(said, /no permission that can create, change or delete|read-only/i, 'read-only, in terms of the permission set')
  assert.match(said, /browser/, 'where the tenant data is')
  assert.match(said, /no IAMAI server|no server/i, 'and where it is not')
  assert.ok(
    TRUST.some((t) => t.href === REPO),
    'the source claim links to the repository',
  )
  // Not the vague version: a promise with nothing to inspect behind it.
  assert.doesNotMatch(said, /privacy first|secure by design|your data is safe|bank.grade|military.grade/i, said)
  // How's Cloudflare sentence is said once, on How; the home page makes its own
  // shorter claim rather than repeating it.
  assert.doesNotMatch(html, /Cloudflare/, 'the hosting sentence lives on How, not here')
})

test('About is the paragraph and three buttons: secondary, tertiary, tertiary', () => {
  const about = html.slice(html.indexOf('<section class="band" aria-labelledby="about-heading">'))
  assert.ok(about.includes(`<p>${esc(H.about as string)}</p>`), 'About is content.about')
  const buttons = [...about.matchAll(/<a class="btn btn-(\w+)" href="([^"]+)">([^<]+)<\/a>/g)].map((m) => ({ weight: m[1], href: m[2], text: unesc(m[3]) }))
  assert.deepEqual(
    buttons,
    ABOUT_LINKS.map((l, i) => ({ weight: i === 0 ? 'secondary' : 'tertiary', href: l.href, text: l.text })),
  )
  assert.equal(buttons.length, 3)
  assert.match(buttons[0].href, /linkedin\.com/)
  assert.match(buttons[2].href, /^mailto:/)
  // Provenance, not marketing: no invented scale, customers or credentials.
  assert.doesNotMatch(H.about as string, /\b\d+[,\d]*\+? (customers|tenants|users|companies|organisations|organizations)\b|trusted by|award.winning|certified/i, H.about as string)
})

// The dropped opt-in: there is no endpoint or workflow behind an email
// subscription, so the page must not ask for one.
test('the page collects nothing: no form, no field, no mailing-list opt-in', () => {
  for (const tag of ['<form', '<input', '<textarea', '<select']) assert.ok(!html.includes(tag), `the home page carries a ${tag} control`)
  assert.doesNotMatch(html, /subscribe|mailing list|newsletter|keep me posted|notify me/i, 'an opt-in with nothing behind it')
})

test("the footer is the app's: pages.footer's links, joined the way AppShell joins them", () => {
  const footer = segment(html, 'footer', 'app')
  const links = [...footer.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => ({ href: m[1], text: unesc(m[2]) }))
  assert.deepEqual(links, FOOTER)
  assert.equal(textPieces(footer).join(' | '), FOOTER.map((l) => l.text).join(' | '))
  assert.equal(rule(css, 'footer.app a'), rule(appCss, 'footer.app a'))
})

// The generator reads pages.home for every string: every text piece the page
// shows, header to footer, is a leaf of pages.home, a footer link of the app's,
// or the theme control's label.
test('every string on the page is a content string', () => {
  const allowed = new Set([...leaves(H), ...FOOTER.map((l) => l.text), SHELL.darkTheme, SHELL.lightTheme])
  const shown = textPieces(html.slice(html.indexOf('<header'), html.indexOf('</footer>')))
  const strays = shown.filter((s) => !allowed.has(s))
  assert.deepEqual(strays, [], 'strings on the page that are not in content.json')
  assert.ok(shown.length > 30, 'the page shows its words')
  // And every word in pages.home is on the page (the meta strings are in the head).
  for (const s of leaves(H)) assert.ok(html.includes(esc(s)), `pages.home string not on the page: "${s}"`)
})

// Built for and What it catches live on the home page and nowhere in the app.
test('Built for and What it catches are the home page\'s, not the app\'s', () => {
  assert.match(H.catchesLabel as string, /^What it catches/, 'the examples are the home page\'s section')
  const rest = JSON.parse(JSON.stringify(content)) as { pages: Record<string, unknown> }
  delete rest.pages.home
  for (const phrase of ['Built for', 'What it catches']) {
    assert.ok(!JSON.stringify(rest).includes(phrase), `"${phrase}" is in the content outside pages.home`)
    for (const f of files('src').filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))) {
      assert.ok(!readFileSync(f, 'utf8').includes(phrase), `"${phrase}" is in ${f}`)
    }
  }
})

// Same tokens and the three button weights as Connect.
test("the three button weights are the app's rules, on the same tokens", () => {
  for (const sel of ['.btn', '.btn-primary', '.btn-secondary', '.btn-tertiary']) {
    const mine = rule(css, sel)
    assert.ok(mine, `${sel} in home.css`)
    assert.equal(mine, rule(appCss, sel), `${sel} differs from src/ui/app.css`)
  }
  for (const w of ['primary', 'secondary', 'tertiary']) assert.ok(html.includes(`class="btn btn-${w}"`), `a ${w} button on the page`)
})

test('light and dark: the palette is the tokens, the stylesheet names no colour of its own', () => {
  assert.match(theme, /\[data-theme='dark'\]/)
  assert.match(theme, /prefers-color-scheme: dark/)
  assert.match(css, /:root\[data-theme='dark'\]\s*\{\s*color-scheme: dark;/)
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, 'a colour outside the tokens')
  for (const m of css.matchAll(/border-radius:\s*([^;]+);/g)) assert.ok(['var(--radius)', '50%', '0'].includes(m[1].trim()), `radius ${m[1]} is beyond the token`)
  for (const m of css.matchAll(/font-size:\s*([^;]+);/g)) assert.match(m[1].trim(), /^var\(--t-\d\)$/, `font size ${m[1]} is beyond the scale`)
})

test('the page carries its title, description and a shareable image, all from content', () => {
  assert.match(html, new RegExp(`<title>${re(H.metaTitle as string)}</title>`))
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

test('the sections come in order: the hero, then the five bands', () => {
  const order = [H.h1, H.workLabel, H.baselineLabel, H.catchesLabel, H.trustLabel, H.aboutLabel] as string[]
  let at = -1
  for (const s of order) {
    const i = html.indexOf(esc(s))
    assert.ok(i > at, `${s} comes in order`)
    at = i
  }
  assert.ok(!readdirSync(home).includes('tools.json'), 'the page words are pages.home, not a second file')
})

// The built page (scripts/assemble-site.mjs writes what assembleHome returns):
// the stylesheets under their content-hashed names, the links pointed at them.
// The site's stylesheets are cached for hours where its HTML is not, so a deploy
// that changed both once rendered the new structure with the old sheet, unstyled.
test('the built page links each stylesheet by its content hash, so a changed sheet is a new URL', () => {
  const built = assembleHome(html, { 'theme.css': theme, 'home.css': css }, TOOL_PATH)
  const page = built['index.html']
  const names = Object.keys(built).filter((n) => n !== 'index.html')
  assert.equal(names.length, 2)
  for (const n of names) {
    assert.match(n, /^(theme|home)\.[0-9a-f]{8}\.css$/, `${n} carries its hash`)
    assert.ok(page.includes(`<link rel="stylesheet" href="/${n}" />`), `the page links /${n}`)
    assert.doesNotMatch(built[n], /\{\{/, `${n} is substituted`)
  }
  assert.doesNotMatch(page, /href="\/(theme|home)\.css"/, 'an unversioned stylesheet link remains')
  assert.doesNotMatch(page, /\{\{/, 'the page is substituted')
  assert.equal(versionedName('home.css', css), versionedName('home.css', css), 'the name is the content')
  assert.notEqual(versionedName('home.css', css), versionedName('home.css', `${css}\n.card { padding: 0; }\n`), 'a changed sheet is a new name')
  // The template keeps the plain names: the version is the build's, not the source's.
  assert.match(html, /<link rel="stylesheet" href="\/home\.css" \/>/)
  assert.throws(() => assembleHome(html, { 'other.css': '' }, TOOL_PATH), /does not link/)
})

// The built page in a browser, with its stylesheet: the computed styles of the
// primary button and the section rule are the tokens, the sections are separated
// by a hairline rather than boxed, and a button is a button, not an underlined link.
const CHROME = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => p && existsSync(p))
/** A token's colour the way getComputedStyle spells it. */
const rgb = (hex: string): string => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`
type Computed = Record<string, string> | null
type Rendered = { sheets: string[]; primary: Computed; secondary: Computed; tertiary: Computed; band: Computed; bandHeading: Computed; boxes: number; beat: Computed }
type CdpReply = { id?: number; result?: { result?: { value?: unknown }; exceptionDetails?: { text?: string } } }

test('the built page, with its stylesheet, renders the tokens: the primary button, the section rule, no boxes', async () => {
  assert.ok(CHROME, 'no Chrome binary found; set CHROME=/path/to/chrome')
  const built = assembleHome(html, { 'theme.css': theme, 'home.css': css }, TOOL_PATH)
  const server = createServer((req, res) => {
    const name = (req.url ?? '/').slice(1).split('?')[0] || 'index.html'
    const body = built[name]
    if (body === undefined) {
      res.writeHead(404)
      res.end()
      return
    }
    res.writeHead(200, { 'content-type': name.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8' })
    res.end(body)
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const port = (server.address() as { port: number }).port
  const cdpPort = Number(process.env.HOME_TEST_CDP_PORT ?? 9452)
  const profile = mkdtempSync(join(tmpdir(), 'iamai-home-test-'))
  const chrome = spawn(
    CHROME,
    ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--hide-scrollbars', `--user-data-dir=${profile}`, `--remote-debugging-port=${cdpPort}`, '--window-size=1280,1000', `http://127.0.0.1:${port}/`],
    { stdio: 'ignore' },
  )
  let ws: WebSocket | undefined
  try {
    let targets: { type: string; webSocketDebuggerUrl: string }[] = []
    for (let i = 0; i < 300 && !targets.some((t) => t.type === 'page'); i++) {
      try {
        targets = (await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()) as typeof targets
      } catch {
        await sleep(200)
      }
    }
    const target = targets.find((t) => t.type === 'page')
    assert.ok(target, 'Chrome exposed no page target within 60 s')
    const socket = new WebSocket(target.webSocketDebuggerUrl)
    ws = socket
    await new Promise((r) => (socket.onopen = r))
    let id = 0
    const pending = new Map<number, (m: CdpReply) => void>()
    socket.onmessage = (m) => {
      const msg = JSON.parse(String(m.data)) as CdpReply
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)?.(msg)
        pending.delete(msg.id)
      }
    }
    const evaluate = (expression: string): Promise<unknown> =>
      new Promise((resolve, reject) => {
        const i = ++id
        pending.set(i, (msg) => (msg.result?.exceptionDetails ? reject(new Error(msg.result.exceptionDetails.text ?? 'evaluate failed')) : resolve(msg.result?.result?.value)))
        socket.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }))
      })
    // Both sheets loaded and parsed: a link that failed to load lists no sheet.
    let loaded = false
    for (let i = 0; i < 100 && !loaded; i++) {
      loaded = (await evaluate(`document.readyState === 'complete' && document.styleSheets.length === 2 && [...document.styleSheets].every((s) => s.cssRules.length > 0)`)) === true
      if (!loaded) await sleep(100)
    }
    assert.ok(loaded, 'the page loaded both stylesheets')
    const r = (await evaluate(`(() => {
      document.documentElement.setAttribute('data-theme', 'light')
      const cs = (sel, props) => { const e = document.querySelector(sel); if (!e) return null; const s = getComputedStyle(e); return Object.fromEntries(props.map((p) => [p, s[p]])) }
      return {
        sheets: [...document.styleSheets].map((s) => s.href.replace(/^.*\\//, '')),
        primary: cs('.hero .btn-primary', ['backgroundColor', 'color', 'borderTopColor', 'borderTopLeftRadius', 'height', 'fontWeight', 'textDecorationLine']),
        secondary: cs('.hero .btn-secondary', ['backgroundColor', 'color', 'borderTopColor', 'textDecorationLine']),
        tertiary: cs('.band .btn-tertiary', ['backgroundColor', 'color', 'borderTopColor', 'textDecorationLine']),
        band: cs('.band', ['backgroundColor', 'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'borderTopLeftRadius']),
        bandHeading: cs('.band h2', ['textTransform', 'fontSize', 'fontWeight', 'color']),
        boxes: [...document.querySelectorAll('main.page *')].filter((e) => { const s = getComputedStyle(e); return s.borderBottomWidth !== '0px' && s.borderLeftWidth !== '0px' && s.borderRightWidth !== '0px' }).length,
        beat: cs('.band .beats b', ['display', 'width']),
      }
    })()`)) as Rendered
    assert.deepEqual(r.sheets, Object.keys(built).filter((n) => n !== 'index.html'), 'the page holds the versioned sheets')
    assert.deepEqual(r.primary, {
      backgroundColor: rgb(LIGHT.brandPrimary),
      color: rgb(LIGHT.onBrand),
      borderTopColor: rgb(LIGHT.brandPrimary),
      borderTopLeftRadius: `${LAYOUT.radiusPx}px`,
      height: `${LAYOUT.controlPx}px`,
      fontWeight: '500',
      textDecorationLine: 'none',
    })
    assert.deepEqual(r.secondary, { backgroundColor: 'rgba(0, 0, 0, 0)', color: rgb(LIGHT.brandPrimary), borderTopColor: rgb(LIGHT.brandPrimary), textDecorationLine: 'none' })
    assert.deepEqual(r.tertiary, { backgroundColor: rgb(LIGHT.secondarySurface), color: rgb(LIGHT.secondaryText), borderTopColor: rgb(LIGHT.strongLine), textDecorationLine: 'none' })
    // A section is a rule and nothing else: no fill, no radius, no box.
    assert.deepEqual(r.band, { backgroundColor: 'rgba(0, 0, 0, 0)', borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: rgb(LIGHT.line), borderTopLeftRadius: '0px' })
    // The section label is the quiet reading level, not the muted component
    // colour: at 13px it is text, and text is AA (task 030 correction 1).
    assert.deepEqual(r.bandHeading, { textTransform: 'uppercase', fontSize: `${TYPE['t-2']}px`, fontWeight: '500', color: rgb(LIGHT.quietText) })
    // The buttons are the only boxed things on the page: no card wall came back.
    assert.equal(r.boxes, 5, `${r.boxes} boxed elements in the page body; only the five buttons carry a border, and nothing else is a panel`)
    assert.deepEqual(r.beat, { display: 'inline-block', width: '76px' })
  } finally {
    ws?.close()
    const gone = new Promise<void>((r) => chrome.once('exit', () => r()))
    chrome.kill()
    await Promise.race([gone, sleep(5000)])
    await new Promise<void>((r) => server.close(() => r()))
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    } catch {
      // Chrome's profile lock outlives the process on Windows for a moment; the temp dir is the OS's to clean.
    }
  }
})
