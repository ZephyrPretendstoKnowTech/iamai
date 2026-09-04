// The home page (prompt 35 §1, §2; prompt 52 Part 1; docs/design/home-mockup.html).
//
// The page is generated from docs/design/content.json (pages.home) by
// scripts/build-home.ts, the way the theme file is generated from the tokens.
// These lock the committed files to their generators — so the words the owner
// reviews in content.json and the words the home page shows cannot drift — and
// hold the structural invariants the page keeps whatever the copy says: the
// hero, the one tool card and its parts, the two How cards, About's three
// buttons, the app's footer, the app's button weights, light and dark.
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
import { RETIRED_OPENER, assembleHome, renderHomeHtml, renderHomeTheme, toolCard, toolsGrid, versionedName } from '../scripts/build-home.ts'
import type { HomeTool } from '../scripts/build-home.ts'

const home = 'home'
const lf = (s: string): string => s.replace(/\r\n/g, '\n')
const html = lf(readFileSync(join(home, 'index.html'), 'utf8'))
const css = lf(readFileSync(join(home, 'home.css'), 'utf8'))
const theme = lf(readFileSync(join(home, 'theme.css'), 'utf8'))
const appCss = lf(readFileSync('src/ui/app.css', 'utf8'))
const H = pages.home as Record<string, unknown>
const PLANNER = H.planner as HomeTool
const HOW = H.how as { title: string; body: string; link?: string; href?: string }[]
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
  // The one place "rollout" may appear is vite.config.ts and the assemble
  // script, as the default for TOOL_PATH.
  for (const file of ['index.html', 'home.css', 'theme.css']) {
    const text = readFileSync(join(home, file), 'utf8')
    assert.doesNotMatch(text, /\/rollout\b/, `${file} spells out the tool path instead of using the placeholder`)
  }
})

// The hero: the existing headline and the new site line, and nothing of the
// opener the mockup retired, on the page or in the content.
test('the hero is the headline and the site line; the retired opener is gone', () => {
  const hero = segment(html, 'div', 'hero')
  assert.ok(hero.includes(`<h1>${esc(H.h1 as string)}</h1>`), 'the headline is content.h1')
  assert.ok(hero.includes(`<p class="site-line">${esc(H.siteLine as string)}</p>`), 'the site line is content.siteLine')
  assert.ok(RETIRED_OPENER.length >= 5, 'the retired opener is listed')
  for (const s of RETIRED_OPENER) {
    assert.ok(!html.includes(s) && !html.includes(esc(s)), `the retired opener remains on the page: "${s}"`)
    assert.ok(!JSON.stringify(H).includes(s), `the retired opener remains in pages.home: "${s}"`)
  }
  for (const key of ['intro', 'footer', 'footerLinks']) assert.ok(!(key in H), `pages.home.${key} was retired`)
  for (const key of ['body', 'builtFor', 'builtForLabel']) assert.ok(!(key in (PLANNER as unknown as Record<string, unknown>)), `pages.home.planner.${key} was retired`)
})

// The tool card (docs/design/home-mockup.html): the name with its status pill,
// the tag line, Reads / Compares / Writes, the What it catches collapsible,
// Open (primary), Try it with sample data (secondary), and the meta line.
test("the tool card's parts, in the mockup's order, from content", () => {
  const card = segment(html, 'section', 'card tool')
  const parts = [
    `<h3 class="tool-name">${esc(PLANNER.name)} <span class="pill">${esc(PLANNER.label)}</span></h3>`,
    `<p class="tag">${esc(PLANNER.descriptor)}</p>`,
    '<ul class="beats">',
    ...PLANNER.beats.map((b) => `<li><b>${esc(b.verb)}</b> ${esc(b.text)}</li>`),
    '<details class="catches">',
    `<summary>${esc(PLANNER.catchesLabel)}</summary>`,
    ...PLANNER.catches.map((c) => `<li>${esc(c)}</li>`),
    '<p class="actions">',
    `<a class="btn btn-primary" href="/{{TOOL_PATH}}/#/connect">${esc(PLANNER.open)}</a>`,
    `<a class="btn btn-secondary" href="/{{TOOL_PATH}}/?demo=1#/plan">${esc(PLANNER.demo)}</a>`,
    `<p class="meta"><span>${esc(PLANNER.meta.baseline)}</span> · <span>${esc(PLANNER.meta.role)}</span> · <a href="${REPO}">${esc(PLANNER.meta.code)}</a></p>`,
  ]
  let at = -1
  for (const part of parts) {
    const i = card.indexOf(part)
    assert.ok(i > at, `the card carries, in order: ${part}`)
    at = i
  }
  assert.deepEqual(
    PLANNER.beats.map((b) => b.verb),
    ['Reads', 'Compares', 'Writes'],
  )
  assert.equal(PLANNER.catches.length, 5)
  assert.doesNotMatch(card, /<details[^>]*\sopen/, 'What it catches is closed until opened')
  assert.equal((card.match(/class="btn /g) ?? []).length, 2, 'two buttons on the card')
  assert.doesNotMatch(card, /Built for/, 'the card has no Built for block; the site line carries the audience')
})

test('the card is one component, and the grid is one column with one tool, two from the second', () => {
  const card = segment(html, 'section', 'card tool')
  assert.equal(card, toolCard(PLANNER, { open: '/{{TOOL_PATH}}/#/connect', demo: '/{{TOOL_PATH}}/?demo=1#/plan' }), 'the page renders the card through toolCard')
  assert.match(html, /<div class="grid tools" aria-labelledby="tools-heading">/, 'one tool: one column')
  assert.match(toolsGrid([card]), /^<div class="grid tools" /)
  assert.match(toolsGrid([card, card]), /^<div class="grid tools two" /)
  assert.equal((html.match(/<section class="card tool">/g) ?? []).length, 1, 'one tool today')
  assert.match(css, /\.grid\.two \{\s*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/, 'the two-column grid rule')
})

test('How these work is two small cards from content', () => {
  const grid = html.match(/<div class="grid two" aria-labelledby="how-heading">[\s\S]*?<\/div>\n/)
  assert.ok(grid, 'the How grid')
  const cards = grid[0].match(/<section class="card small">[\s\S]*?<\/section>/g) ?? []
  assert.equal(cards.length, 2)
  assert.equal(HOW.length, 2)
  HOW.forEach((c, i) => {
    assert.ok(cards[i].includes(`<h3>${esc(c.title)}</h3>`), `How card ${i + 1} title`)
    assert.ok(cards[i].includes(esc(c.body)), `How card ${i + 1} body`)
    if (c.link) assert.ok(cards[i].includes(`<a class="lnk" href="${c.href}">${esc(c.link)}</a>`), `How card ${i + 1} link`)
  })
  assert.equal(HOW[1].href, REPO, 'the source card links to the repository')
})

test("About is the paragraph and three buttons: secondary, tertiary, tertiary", () => {
  const about = segment(html, 'section', 'card small about')
  assert.ok(about.includes(`<p>${esc(H.about as string)}</p>`), 'About is content.about')
  const buttons = [...about.matchAll(/<a class="btn btn-(\w+)" href="([^"]+)">([^<]+)<\/a>/g)].map((m) => ({ weight: m[1], href: m[2], text: unesc(m[3]) }))
  assert.deepEqual(
    buttons,
    ABOUT_LINKS.map((l, i) => ({ weight: i === 0 ? 'secondary' : 'tertiary', href: l.href, text: l.text })),
  )
  assert.equal(buttons.length, 3)
  assert.match(buttons[0].href, /linkedin\.com/)
  assert.match(buttons[2].href, /^mailto:/)
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
  assert.equal(PLANNER.catchesLabel, 'What it catches')
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

test('the sections come in order: the hero, Tools, How these work, About', () => {
  const order = [H.h1 as string, `>${H.toolsLabel}<`, `>${H.howLabel}<`, `>${H.aboutLabel}<`]
  let at = -1
  for (const s of order) {
    const i = html.indexOf(s)
    assert.ok(i > at, `${s} comes in order`)
    at = i
  }
  assert.ok(!readdirSync(home).includes('tools.json'), 'the tool list is pages.home, not a second file')
})

// The built page (scripts/assemble-site.mjs writes what assembleHome returns):
// the stylesheets under their content-hashed names, the links pointed at them.
// The site's stylesheets are cached for hours where its HTML is not, so a deploy
// that changed both once rendered the new structure with the old sheet, unstyled.
test('the built page links each stylesheet by its content hash, so a changed sheet is a new URL', () => {
  const built = assembleHome(html, { 'theme.css': theme, 'home.css': css }, 'rollout')
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
  assert.throws(() => assembleHome(html, { 'other.css': '' }, 'rollout'), /does not link/)
})

// The built page in a browser, with its stylesheet: the computed styles of the
// primary button, the card and the pill are the tokens (docs/design/home-mockup.html),
// How these work is two columns, and a button is a button, not an underlined link.
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
type Rendered = { sheets: string[]; primary: Computed; secondary: Computed; tertiary: Computed; card: Computed; pill: Computed; how: Computed; beat: Computed }
type CdpReply = { id?: number; result?: { result?: { value?: unknown }; exceptionDetails?: { text?: string } } }

test('the built page, with its stylesheet, renders the tokens: the primary button, the card, the pill, the two-column How', async () => {
  assert.ok(CHROME, 'no Chrome binary found; set CHROME=/path/to/chrome')
  const built = assembleHome(html, { 'theme.css': theme, 'home.css': css }, 'rollout')
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
        primary: cs('.card.tool .btn-primary', ['backgroundColor', 'color', 'borderTopColor', 'borderTopLeftRadius', 'height', 'fontWeight', 'textDecorationLine']),
        secondary: cs('.card.tool .btn-secondary', ['backgroundColor', 'color', 'borderTopColor', 'textDecorationLine']),
        tertiary: cs('.card.about .btn-tertiary', ['backgroundColor', 'color', 'borderTopColor', 'textDecorationLine']),
        card: cs('.card.tool', ['backgroundColor', 'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'borderTopLeftRadius']),
        pill: cs('.card.tool .pill', ['color', 'backgroundColor', 'textTransform', 'fontSize', 'fontWeight', 'borderTopLeftRadius']),
        how: cs('.grid.two', ['display', 'gridTemplateColumns']),
        beat: cs('.card.tool .beats b', ['display', 'width']),
      }
    })()`)) as Rendered
    assert.deepEqual(r.sheets, Object.keys(built).filter((n) => n !== 'index.html'), 'the page holds the versioned sheets')
    assert.deepEqual(r.primary, {
      backgroundColor: rgb(LIGHT.accent),
      color: rgb(LIGHT.onAccent),
      borderTopColor: rgb(LIGHT.accent),
      borderTopLeftRadius: `${LAYOUT.radiusPx}px`,
      height: `${LAYOUT.controlPx}px`,
      fontWeight: '500',
      textDecorationLine: 'none',
    })
    assert.deepEqual(r.secondary, { backgroundColor: 'rgba(0, 0, 0, 0)', color: rgb(LIGHT.accent), borderTopColor: rgb(LIGHT.accent), textDecorationLine: 'none' })
    assert.deepEqual(r.tertiary, { backgroundColor: rgb(LIGHT.bgInset), color: rgb(LIGHT.ink2), borderTopColor: rgb(LIGHT.ruleStrong), textDecorationLine: 'none' })
    assert.deepEqual(r.card, { backgroundColor: rgb(LIGHT.bgRaised), borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: rgb(LIGHT.rule), borderTopLeftRadius: `${LAYOUT.radiusPx}px` })
    assert.deepEqual(r.pill, { color: rgb(LIGHT.accent), backgroundColor: rgb(LIGHT.accentTint), textTransform: 'uppercase', fontSize: `${TYPE['t-1']}px`, fontWeight: '500', borderTopLeftRadius: `${LAYOUT.radiusPx}px` })
    assert.equal(r.how?.display, 'grid')
    assert.equal(r.how?.gridTemplateColumns.split(' ').length, 2, `How these work is two columns at 1280 (${r.how?.gridTemplateColumns})`)
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
