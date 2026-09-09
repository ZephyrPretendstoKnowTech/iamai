// The home page (prompt 35 §1, §2; prompt 52 Part 1; rebuilt by task 016; the
// approved composition restored by task 038).
//
// These assertions hold the page as built to its generator, to its content, and
// to the owner's Home design authority, docs/design/approved/home-v2.html
// (docs/design/approved/manifest.json). That pack owns the anatomy the tests
// below name — the public header, the hero and its meta row, the two-column
// product section with its side rail, the Reads / Compares / Plans rows, the
// label-and-explanation catches, the trust row, About, the footer, and the 760
// and 560 breakpoints. It does not own the words, and it does not own the
// technical truth (docs/design/authority-reconciliation.md).
//
// The page is generated from docs/design/content.json (pages.home) by
// scripts/build-home.ts, the way the theme file is generated from the tokens.
// These lock the committed files to their generators — so the words the owner
// reviews in content.json and the words the home page shows cannot drift — and
// hold the structural invariants the page keeps whatever the copy says: the
// public header with its real destinations, the hero with the outcome and the
// only two actions, the four sections after it, the app's footer, the app's
// button weights, light and dark. The assertions are about shape and about the
// facts that have to be true (read-only, browser-local, public source, the
// baseline's author), never about a particular sentence: the copy is the
// owner's to change.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

import { content, pages } from './content/content.ts'
import { DISPLAY, LAYOUT, LIGHT, ROLE_WEIGHTS, TYPE } from './ui/tokens.ts'
import { PRODUCT_ENTRY, RETIRED_OPENER, assembleHome, baselineRail, beatRows, catchRows, renderHomeHtml, renderHomeTheme, trustRow, versionedName } from '../scripts/build-home.ts'
import type { HomeBeat, HomeCatch, HomeTrust } from '../scripts/build-home.ts'
import { TOOL_PATH } from '../scripts/toolPath.ts'

const home = 'home'
const lf = (s: string): string => s.replace(/\r\n/g, '\n')
const html = lf(readFileSync(join(home, 'index.html'), 'utf8'))
const css = lf(readFileSync(join(home, 'home.css'), 'utf8'))
const theme = lf(readFileSync(join(home, 'theme.css'), 'utf8'))
const appCss = lf(readFileSync('src/ui/app.css', 'utf8'))
const H = pages.home as Record<string, unknown>
const WORK = H.work as HomeBeat[]
const CATCHES = H.catches as HomeCatch[]
const TRUST = H.trust as HomeTrust[]
const NAV_SOURCE = H.navSource as { text: string; href: string }
const FOOTER = (pages.footer as { links: { text: string; href: string }[] }).links
const SHELL = pages.app.shell as { lightTheme: string; darkTheme: string; themeTooltip: string }
const SHELL_TABS = (pages.app.shell as { tabs: Record<string, string> }).tabs
const REPO = 'https://github.com/ZephyrPretendstoKnowTech/iamai'
/** The owner's approved Home pack: the anatomy this page implements. */
const PACK = 'docs/design/approved/home-v2.html'
/** The planner's How page, the one public link that is not the product entry or the source. */
const HOW_HREF = '/{{TOOL_PATH}}/#/how'
const DEMO_HREF = '/{{TOOL_PATH}}/?demo=1#/plan'

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
/** Every <a> in a fragment: where it goes and the words on it. */
const links = (fragment: string): { href: string; text: string }[] =>
  [...fragment.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1], text: unesc(m[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() }))

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

// ------------------------------------------------------- the design authority
//
// The page implements docs/design/approved/home-v2.html.
// src/ui/design-authority.test.ts guards all four packs and their recorded
// hashes; this one is Home's own — the pack is unedited, and the numbers the
// pack sets are the numbers this page's stylesheet sets.
test('the Home the page implements is the approved pack, unedited', () => {
  const manifest = JSON.parse(readFileSync('docs/design/approved/manifest.json', 'utf8')) as {
    surfaces: { surface: string; path: string; sha256: string; observed: { desktopWidthPx: number; breakpointsPx: number[] } }[]
  }
  const record = manifest.surfaces.find((s) => s.surface === 'home')
  assert.ok(record, 'the manifest records the Home surface')
  assert.equal(record.path, PACK)
  assert.equal(createHash('sha256').update(readFileSync(PACK)).digest('hex'), record.sha256, 'the approved Home pack was edited; it is read-only authority')
  // The anatomy this page took from it, as values rather than as prose.
  assert.equal(record.observed.desktopWidthPx, 1040)
  assert.deepEqual(record.observed.breakpointsPx, [760, 560])
  assert.match(css, /max-width: calc\(var\(--w-home\) \+ 2 \* var\(--pad\)\)/, 'the page runs in the column the pack sets')
  assert.match(css, /grid-template-columns: minmax\(0, 1\.5fr\) minmax\(280px, 0\.8fr\)/, "the product section is the pack's two columns")
  assert.match(css, /\.step \{[\s\S]*?grid-template-columns: 78px 1fr;/, "a Reads / Compares / Plans row is the pack's 78px label column")
  assert.match(css, /\.catch \{[\s\S]*?grid-template-columns: 160px 1fr;/, "a catch is the pack's 160px label column")
  for (const bp of record.observed.breakpointsPx) assert.ok(css.includes(`@media (max-width: ${bp}px)`), `the pack's ${bp}px breakpoint`)
})

// ------------------------------------------------------------- public header
//
// The pack's public header: the lockup, then the public links, the product
// entry last. Lighter than the planner's shell — a visitor who has never signed
// in must not be shown the signed-in navigation.
test('the public header is the lockup and real public links, not the planner shell', () => {
  const header = segment(html, 'header', 'app')
  assert.ok(header.includes('<svg width="20" height="20"'), 'the Guided Route mark is in the lockup')
  const wordmark = header.match(/<a class="wordmark" href="\/">[\s\S]*?<\/a>/)?.[0] ?? ''
  assert.ok(wordmark, 'the lockup links home')
  assert.deepEqual(textPieces(wordmark), [H.brand as string], 'the lockup is the mark and the wordmark, with no tagline under it')
  const nav = header.match(/<nav class="links">[\s\S]*?<\/nav>/)?.[0] ?? ''
  assert.ok(nav, 'the public links are a nav')
  assert.deepEqual(links(nav), [
    { href: HOW_HREF, text: H.navHow as string },
    { href: NAV_SOURCE.href, text: NAV_SOURCE.text },
    { href: PRODUCT_ENTRY, text: H.open as string },
  ])
  assert.equal(NAV_SOURCE.href, REPO, 'the source link is the repository')
  // The signed-in shell's navigation is the planner's, and never the public page's.
  const tabs = Object.values(SHELL_TABS) as string[]
  for (const tab of tabs.filter((t) => t !== 'Connect')) assert.ok(!header.includes(`>${tab}<`), `the signed-in tab ${tab} is in the public header`)
  assert.doesNotMatch(header, /Account|Sign out|Sign in/, 'the public header carries no signed-in state')
})

// ---------------------------------------------------------------------- hero
//
// The pack's hero: the label, the display line, the lead, the two ways in, and
// a meta row of three claims short enough to be exactly true with nothing
// attached to them. The opener the mockup retired stays gone.
test("the hero is the pack's: eyebrow, display line, lead, two actions, meta row", () => {
  const hero = segment(html, 'div', 'hero')
  assert.ok(hero.includes(`<p class="eyebrow">${esc(H.eyebrow as string)}</p>`), 'the eyebrow is content.eyebrow')
  assert.ok(hero.includes(`<h1>${esc(H.h1 as string)}</h1>`), 'the headline is content.h1')
  assert.ok(hero.includes(`<p class="site-line">${esc(H.siteLine as string)}</p>`), 'the site line is content.siteLine')
  assert.ok(hero.indexOf('class="eyebrow"') < hero.indexOf('<h1>'), 'the label comes above the display line')
  const buttons = [...hero.matchAll(/<a class="btn btn-(\w+)" href="([^"]+)">([^<]+)<\/a>/g)].map((m) => ({ weight: m[1], href: m[2], text: unesc(m[3]) }))
  assert.deepEqual(buttons, [
    { weight: 'primary', href: PRODUCT_ENTRY, text: H.open as string },
    { weight: 'secondary', href: DEMO_HREF, text: H.demo as string },
  ])
  // The meta row: three claims, each one the trust section names in full below.
  const meta = hero.match(/<p class="meta">[\s\S]*?<\/p>/)?.[0] ?? ''
  assert.deepEqual(textPieces(meta), H.heroMeta as string[])
  assert.equal((H.heroMeta as string[]).length, 3)
  for (const claim of H.heroMeta as string[]) assert.ok(claim.length < 32, `"${claim}" is a meta claim, not a sentence`)
  assert.ok(RETIRED_OPENER.length >= 5, 'the retired opener is listed')
  for (const s of RETIRED_OPENER) {
    assert.ok(!html.includes(s) && !html.includes(esc(s)), `the retired opener remains on the page: "${s}"`)
    assert.ok(!JSON.stringify(H).includes(s), `the retired opener remains in pages.home: "${s}"`)
  }
  for (const key of ['intro', 'footer', 'footerLinks', 'heroNote', 'aboutLinks']) assert.ok(!(key in H), `pages.home.${key} was retired`)
})

// The way into the product is where the pack puts it and nowhere else: the
// header, the hero's primary action, and the side rail. The sample-data view is
// the hero's second action, and How is the one supporting link.
test('every link into the planner is a real destination, in one of the places the pack puts it', () => {
  const into = links(html).filter((l) => l.href.startsWith('/{{TOOL_PATH}}/'))
  assert.deepEqual(
    into.map((l) => l.href),
    [HOW_HREF, PRODUCT_ENTRY, PRODUCT_ENTRY, DEMO_HREF, PRODUCT_ENTRY],
    'How and the product entry in the header, the two actions in the hero, the product entry in the rail',
  )
  // Each hash is a route the planner actually has.
  const routes = readFileSync('src/ui/shell/routes.ts', 'utf8')
  for (const hash of ['connect', 'how', 'plan']) assert.ok(routes.includes(`'${hash}'`), `#/${hash} is a planner route`)
  assert.equal(PRODUCT_ENTRY, '/{{TOOL_PATH}}/#/connect', 'the product entry is Connect, the first step of the product')
  const built = assembleHome(html, { 'theme.css': theme, 'home.css': css }, TOOL_PATH)['index.html']
  for (const l of into) assert.ok(built.includes(l.href.replaceAll('{{TOOL_PATH}}', TOOL_PATH)), 'the built page carries the substituted destination')
})

// Task 016: the outcome comes before the mechanism. A visitor reads what IAMAI
// is for before it names Conditional Access, and the headline is not a process.
test('the first screen is the security outcome, not the mechanism', () => {
  const body = html.slice(html.indexOf('<body>'))
  const first = body.slice(body.indexOf('<div class="hero">'), body.indexOf('<section class="band'))
  assert.doesNotMatch(first, /Conditional Access/, 'the hero explains the outcome; the term comes later, with context')
  assert.match(body, /Conditional Access/, 'and the page does eventually say what it plans')
  assert.ok(body.indexOf('Conditional Access') > body.indexOf(esc(H.siteLine as string)), 'the term comes after the outcome')
  // No AI-first or generic-SaaS language, and nothing describing the product as magic.
  assert.doesNotMatch(html, /\bAI-powered\b|\bpowered by AI\b|\bmagic(al)?\b|\bseamless\b|\bworld-class\b|\bgame.chang/i, html.match(/\bAI-powered\b|\bmagic\b|\bseamless\b/i)?.[0] ?? '')
})

// The obsolete composition: the tool card, its Preview pill and the Tools grid
// left with the approved v2 direction and may not come back by hand. Neither
// may a generated branding preview's lockup tagline
// (docs/design/approved/manifest.json generatedPreviews).
test('no card wall, no pill, no Tools grid, no generated tagline', () => {
  for (const gone of ['class="card', 'class="pill"', 'class="grid', 'tool-name', 'tools-heading', 'how-heading']) {
    assert.ok(!html.includes(gone), `the retired home composition is back: ${gone}`)
    assert.ok(!css.includes(gone.replace('class="', '.').replace(/"$/, '')), `home.css still styles the retired ${gone}`)
  }
  assert.ok(!('planner' in H) && !('toolsLabel' in H) && !('howLabel' in H) && !('how' in H), 'the tool-card content keys were retired')
  assert.ok(!JSON.stringify(H).includes('Preview'), 'the Preview pill and its word are gone')
  // Nothing on the page is a raised box: the sections are separated by a rule.
  assert.match(css, /\.band \{\s*border-top: 1px solid var\(--line\);/, 'a section is a hairline, not a card')
  assert.doesNotMatch(css, /background: var\(--surface\)/, 'no raised panel remains in the home stylesheet')
  assert.doesNotMatch(css, /\.panel\b|\.panel-key\b/, 'the page was not blanket-cardified with the panel roles')
  // The brand's own rule: the lockup is the mark and IAMAI, with nothing under it.
  const brand = JSON.parse(readFileSync('docs/brand/brand-manifest.json', 'utf8')) as { brand: { tagline: string | null } }
  assert.equal(brand.brand.tagline, null)
  const header = segment(html, 'header', 'app')
  for (const line of ['Built by Jon Hope', 'PLAN PROGRESS ACHIEVE', "FROM HERE TO WHAT'S NEXT", 'IDENTITY ROADMAP', 'PLAN WITH EVIDENCE', 'GUIDED PROGRESSION']) {
    assert.ok(!header.includes(line), `"${line}" is under the wordmark; the lockup carries no tagline`)
  }
})

// Four sections after the hero, in order, each an eyebrow, a heading and a body.
test('the page is the hero and four sections, in order, from content', () => {
  const bands = [...html.matchAll(/<section class="band[^"]*" aria-labelledby="([a-z]+)-heading">([\s\S]*?)<\/section>/g)].map((m) => ({
    id: m[1],
    label: unesc(m[2].match(/<p class="eyebrow">([^<]+)<\/p>/)?.[1] ?? ''),
    heading: unesc(m[2].match(new RegExp(`<h2 id="${m[1]}-heading">([^<]+)</h2>`))?.[1] ?? ''),
  }))
  assert.deepEqual(bands, [
    { id: 'work', label: H.workLabel as string, heading: H.workHeading as string },
    { id: 'catches', label: H.catchesLabel as string, heading: H.catchesHeading as string },
    { id: 'trust', label: H.trustLabel as string, heading: H.trustHeading as string },
    { id: 'about', label: H.aboutLabel as string, heading: H.aboutHeading as string },
  ])
  // A heading for every section and no orphan heading: h1, then four h2, nothing
  // deeper. The pack draws the product section's heading as an h3 under no h2;
  // production keeps the level and takes only the size.
  assert.equal((html.match(/<h1>/g) ?? []).length, 1)
  assert.equal((html.match(/<h2 /g) ?? []).length, 4)
  assert.equal((html.match(/<h3/g) ?? []).length, 0, 'the page has no third heading level to skip to')
  assert.match(css, /\.band-lead h2 \{\s*font-size: var\(--d-13\);/, "the product heading takes the pack's smaller display size")
})

// What it does: the visitor should be able to say what IAMAI reads, what the
// comparison is against, and that the output is an ordered plan — beside the
// rail naming the standard it is compared with.
test('What it does is the three rows, with the side rail beside them', () => {
  const band = segment(html, 'section', 'band band-lead')
  assert.ok(band.includes(beatRows(WORK)), 'the section renders through beatRows')
  assert.ok(band.includes(baselineRail(H as never)), 'the rail renders through baselineRail')
  assert.ok(band.includes('<div class="product">'), "the two columns are the pack's product grid")
  assert.ok(band.indexOf('<div class="steps">') < band.indexOf('<aside class="side">'), 'the explanation comes before the rail in reading order')
  assert.equal(WORK.length, 3)
  assert.deepEqual(
    WORK.map((b) => b.verb),
    ['Reads', 'Compares', 'Plans'],
    'the loop is read, compare, plan; Writes retired with the v2 direction',
  )
  assert.match(WORK[0].text, /policies|people|sign-in/, 'the first beat says what it reads')
  assert.match(WORK[2].text, /step|plan/i, 'the last beat says the output is an ordered plan')
  // It plans; it never applies. Nothing here may say the product changes a tenant.
  const said = WORK.map((b) => `${b.verb} ${b.text}`).join(' ')
  assert.doesNotMatch(said, /\b(applies|applying|apply|remediates|enforces|deploys|rolls out|fixes) (it|them|the|your|a) /i, said)
})

// The baseline, for a visitor who has never met the term: what it is, whose it
// is, why the source is credible, and what it aims at. No Microsoft endorsement.
test('the side rail explains the baseline and attributes it without claiming an endorsement', () => {
  const side = segment(html, 'aside', 'side')
  const said = [H.baselineName, H.baseline, H.baselineGoal, H.baselineNote].join(' ') as string
  assert.match(H.baseline as string, /^A baseline is /, 'the term is explained before it is used')
  for (const fact of ['Defense in Depth', 'Jon Hope', 'Microsoft MVP']) {
    assert.ok(said.includes(fact), `the rail names ${fact}`)
    assert.ok(side.includes(esc(fact)), `the rail shows ${fact}`)
  }
  assert.doesNotMatch(said, /Microsoft(-| )(approved|certified|endorsed|recommended|official)|endorse|certifie|approved by Microsoft|partnership/i, said)
  // The rail is subordinate to the column beside it, and separates from it — a
  // left border on a wide screen, a top border when the two stack.
  assert.match(css, /\.side \{\s*padding-left: 24px;\s*border-left: 1px solid var\(--line\);/, "the rail carries the pack's left border")
  assert.match(css, /\.side \{[\s\S]*?border-left: 0;\s*border-top: 1px solid var\(--line\);/, 'and moves it to the top when the two columns stack')
})

// A small set of real examples, and no more. Each is something the product can
// actually find in a tenant before a change goes live, under the kind of problem
// it is: the pack's label-and-explanation row, never a card.
test('the catches are label-and-explanation rows, a few of them, not a feature grid', () => {
  assert.ok(html.includes(catchRows(CATCHES)), 'the section renders through catchRows')
  assert.ok(CATCHES.length >= 3 && CATCHES.length <= 6, `${CATCHES.length} examples; a few, not a wall`)
  assert.equal((html.match(/<div class="catches">/g) ?? []).length, 1)
  for (const c of CATCHES) {
    assert.ok(c.label.length > 0 && c.label.length <= 22, `"${c.label}" is a label for the row's first column`)
    assert.ok(c.text.length > c.label.length, `${c.label} has an explanation beside it`)
  }
  // No invented number: the examples are shapes IAMAI finds, not statistics.
  assert.doesNotMatch(CATCHES.map((c) => c.text).join(' '), /\b\d+\s?%|\b\d+ out of \d+|\b(most|majority of) (tenants|organisations|organizations)\b/i)
})

// Trust is specific and checkable: read-only, the tenant's data stays in the
// browser, the source is public. Vague reassurance is not enough.
test('the trust row names read-only, browser-local handling and the public source', () => {
  assert.ok(html.includes(trustRow(TRUST)), 'the section renders through trustRow')
  assert.equal(TRUST.length, 3, "the pack's row is three claims")
  const said = TRUST.map((t) => `${t.title} ${t.body}`).join(' ')
  assert.match(said, /no permission that can create, change or delete|read-only/i, 'read-only, in terms of the permission set')
  assert.match(said, /browser/, 'where the tenant data is')
  assert.match(said, /no IAMAI server|no server/i, 'and where it is not')
  assert.ok(
    TRUST.some((t) => t.href === REPO),
    'the source claim links to the repository',
  )
  // Not the vague version: a promise with nothing to inspect behind it, or a
  // guarantee nothing in the product backs.
  assert.doesNotMatch(said, /privacy first|secure by design|your data is safe|bank.grade|military.grade/i, said)
  assert.doesNotMatch(said, /\b(ISO ?27001|SOC ?2|GDPR compliant|HIPAA|certified|uptime|SLA|partner of|trusted by)\b/i, said)
  // How's Cloudflare sentence is said once, on How; the home page makes its own
  // shorter claim rather than repeating it.
  assert.doesNotMatch(html, /Cloudflare/, 'the hosting sentence lives on How, not here')
})

// The three claims the hero shows are the three the trust section explains: one
// set of public claims, said short at the top and in full below.
test('the hero meta row and the trust row are the same three claims', () => {
  const meta = (H.heroMeta as string[]).map((s) => s.toLowerCase())
  assert.ok(meta.some((m) => m.includes('read-only')), 'read-only')
  assert.ok(meta.some((m) => m.includes('browser')), 'browser')
  assert.ok(meta.some((m) => m.includes('source')), 'public source')
  // A claim the trust section does not carry may not appear as a meta chip.
  for (const claim of H.heroMeta as string[]) {
    assert.doesNotMatch(claim, /free|no (sign|account)|encrypted|private|secure|certified/i, `"${claim}" is a claim the trust section does not carry`)
  }
})

test('About is the paragraph the pack draws, with no invented identity', () => {
  const at = html.indexOf('<section class="band" aria-labelledby="about-heading">')
  const about = html.slice(at, html.indexOf('</section>', at))
  assert.ok(about.includes(`<div class="about"><p>${esc(H.about as string)}</p></div>`), 'About is content.about')
  assert.equal((about.match(/<a /g) ?? []).length, 0, "About is the paragraph; the public links are the footer's")
  // Provenance, not marketing: no invented scale, customers or credentials, and
  // no attribution the owner did not write.
  assert.doesNotMatch(H.about as string, /\b\d+[,\d]*\+? (customers|tenants|users|companies|organisations|organizations)\b|trusted by|award.winning|certified/i, H.about as string)
  assert.match(H.about as string, /^Built by Lachlan Robinette\./, "the About attribution is the owner's own")
})

// The dropped opt-in: there is no endpoint or workflow behind an email
// subscription, so the page must not ask for one.
test('the page collects nothing: no form, no field, no mailing-list opt-in', () => {
  for (const tag of ['<form', '<input', '<textarea', '<select']) assert.ok(!html.includes(tag), `the home page carries a ${tag} control`)
  assert.doesNotMatch(html, /subscribe|mailing list|newsletter|keep me posted|notify me/i, 'an opt-in with nothing behind it')
})

// The pack's footer: the product's name on the left, the public links on the
// right. The links are the app's (pages.footer); the one that points at this
// page is the name on the left rather than a link to itself.
test("the footer is the name and the app's public links, in the pack's arrangement", () => {
  const footer = segment(html, 'footer', 'app')
  const want = FOOTER.filter((l) => !/^https:\/\/getiamai\.com\/?$/.test(l.href))
  assert.deepEqual(links(footer), want)
  assert.equal(textPieces(footer)[0], H.brand as string, 'the product name is the first thing in the footer')
  assert.equal(textPieces(footer).join(' · '), [H.brand as string, ...want.map((l) => l.text)].join(' · '))
  assert.ok(want.length >= 2 && want.length < FOOTER.length, 'the link back to this page is the name, not a link to itself')
  for (const l of want) assert.match(l.href, /^(https:\/\/|mailto:)/, `${l.text} points somewhere real`)
  assert.equal(rule(css, 'footer.app a'), rule(appCss, 'footer.app a'))
  assert.match(css, /footer\.app \{[\s\S]*?justify-content: space-between;/, 'the name and the links sit at the two ends')
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
test("Built for and What it catches are the home page's, not the app's", () => {
  assert.match(H.catchesLabel as string, /^What it catches/, "the examples are the home page's section")
  const rest = JSON.parse(JSON.stringify(content)) as { pages: Record<string, unknown> }
  delete rest.pages.home
  for (const phrase of ['Built for', 'What it catches']) {
    assert.ok(!JSON.stringify(rest).includes(phrase), `"${phrase}" is in the content outside pages.home`)
    for (const f of files('src').filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))) {
      assert.ok(!readFileSync(f, 'utf8').includes(phrase), `"${phrase}" is in ${f}`)
    }
  }
})

// Same tokens and the same button weights as Connect. The page draws two of
// them; the tertiary rule stays equal to the app's so the two sheets cannot
// drift apart while the page is not using it.
test("the button weights are the app's rules, on the same tokens", () => {
  for (const sel of ['.btn', '.btn-primary', '.btn-secondary', '.btn-tertiary']) {
    const mine = rule(css, sel)
    assert.ok(mine, `${sel} in home.css`)
    assert.equal(mine, rule(appCss, sel), `${sel} differs from src/ui/app.css`)
  }
  for (const w of ['primary', 'secondary']) assert.ok(html.includes(`class="btn btn-${w}"`), `a ${w} button on the page`)
})

test('light and dark: the palette is the tokens, the stylesheet names no colour of its own', () => {
  assert.match(theme, /\[data-theme='dark'\]/)
  assert.match(theme, /prefers-color-scheme: dark/)
  assert.match(css, /:root\[data-theme='dark'\]\s*\{\s*color-scheme: dark;/)
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, 'a colour outside the tokens')
  for (const m of css.matchAll(/border-radius:\s*([^;]+);/g)) assert.ok(['var(--radius)', '50%', '0'].includes(m[1].trim()), `radius ${m[1]} is beyond the token`)
  for (const m of css.matchAll(/font-size:\s*([^;]+);/g)) assert.match(m[1].trim(), /^var\(--(t-[a-z0-9-]+|d-\d+)\)$/, `font size ${m[1]} is beyond the scale and the approved display ramp`)
})

// The brand type, from the token file, served from this origin. A remote font
// host would be a third party watching every visit to the public page.
test('the fonts are IBM Plex, staged locally, and nothing is fetched from a CDN', () => {
  const faces = [...theme.matchAll(/@font-face \{[\s\S]*?\n\}/g)].map((m) => m[0])
  assert.ok(faces.length >= 7, `${faces.length} font faces; the brand's three families`)
  for (const face of faces) {
    assert.match(face, /font-family: 'IBM Plex (Serif|Sans|Mono)'/, 'a face outside the brand families')
    assert.match(face, /url\('\/\{\{TOOL_PATH\}\}\/fonts\/[^']+\.woff2'\)/, 'a face served from somewhere other than this origin')
  }
  // Neither sheet reaches out at all: no @import, no absolute URL, nothing to a
  // third party. src/brand/brand.test.ts names the remote font hosts and scans
  // everything the site serves for them; this is the same fact from the page's
  // side, said without writing one of those hosts down again.
  assert.doesNotMatch(theme, /https?:\/\//, 'the token sheet reaches out to a host')
  assert.doesNotMatch(css, /https?:\/\//, 'the home stylesheet reaches out to a host')
  assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"[^>]+href="https?:/i, 'the page links a stylesheet on another host')
  assert.doesNotMatch(html, /<link[^>]+rel="preconnect"/i, 'the page warms a connection to another host')
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

test('the sections come in order: the hero, then the four bands', () => {
  const order = [H.h1, H.workHeading, H.catchesHeading, H.trustHeading, H.aboutHeading] as string[]
  let at = -1
  for (const s of order) {
    const i = html.indexOf(esc(s))
    assert.ok(i > at, `${s} comes in order`)
    at = i
  }
  assert.ok(!readdirSync(home).includes('tools.json'), 'the page words are pages.home, not a second file')
})

// Narrower: the pack's two breakpoints. One supporting link stands down at 560
// (the pack hides the first of them); nothing on the page may hide the way into
// the product, at any width.
test('the responsive rules never hide the way into the product', () => {
  const hidden = [...css.matchAll(/([^{}]+)\{([^}]*display:\s*none[^}]*)\}/g)].map((m) => m[1].trim().split('\n').at(-1)?.trim() ?? '')
  assert.deepEqual(hidden, ['header.app .links a:first-child'], 'the pack hides one supporting link and nothing else')
  assert.ok(html.indexOf(`href="${PRODUCT_ENTRY}"`) < html.indexOf('<main'), 'the header carries the product entry')
  assert.equal(links(segment(html, 'nav', 'links'))[0].href, HOW_HREF, 'the link that stands down at 560 is How, not the product entry')
  for (const sel of ['.hero .actions', '.btn', '.btn-primary', 'header.app .links a.enter']) {
    assert.doesNotMatch(rule(css, sel) ?? '', /display: none|visibility: hidden/, `${sel} is hidden somewhere`)
  }
  // The gutters tighten rather than disappear, and the page never runs wider
  // than the viewport.
  assert.match(css, /@media \(max-width: 560px\) \{\s*header\.app,\s*main\.page,\s*footer\.app \{\s*padding-left: 12px;/, 'the 560 gutter')
  assert.match(css, /main\.page \{[\s\S]*?width: 100%;[\s\S]*?max-width: calc\(var\(--w-home\)/, 'the column never exceeds the viewport')
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

// The site the build publishes: the public home page at /, the planner under
// the tool path. Home has its own source and its own build path, and neither
// route may be lost to the other (scripts/assemble-site.mjs).
test('the build publishes the home page at / and the planner under the tool path', () => {
  const assemble = readFileSync('scripts/assemble-site.mjs', 'utf8')
  assert.match(assemble, /join\(dist, name\)/, 'the home page and its sheets are written to the site root')
  assert.match(assemble, /join\(dist, TOOL_PATH, 'index\.html'\)/, 'the planner is expected under the tool path')
  assert.equal(TOOL_PATH, 'planner')
  const built = assembleHome(html, { 'theme.css': theme, 'home.css': css }, TOOL_PATH)
  assert.ok(built['index.html'].includes('<main class="page">'), 'dist/index.html is the home page')
  assert.ok(built['index.html'].includes(`href="/${TOOL_PATH}/#/connect"`), 'and it links into the planner at its own path')
  // The home page is generated from its own source, never hand-edited output.
  assert.match(readFileSync('scripts/build-home.ts', 'utf8'), /writeFileSync\('home\/index\.html', renderHomeHtml\(\)\)/)
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
type Rendered = { sheets: string[]; primary: Computed; secondary: Computed; band: Computed; eyebrow: Computed; display: Computed; boxes: number; product: Computed; side: Computed; step: Computed; catch: Computed; overflow: boolean }
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
        band: cs('.band', ['backgroundColor', 'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'borderTopLeftRadius']),
        eyebrow: cs('.band .eyebrow', ['textTransform', 'fontSize', 'color']),
        display: cs('.hero h1', ['fontSize', 'fontWeight']),
        boxes: [...document.querySelectorAll('main.page *')].filter((e) => { const s = getComputedStyle(e); return s.borderBottomWidth !== '0px' && s.borderLeftWidth !== '0px' && s.borderRightWidth !== '0px' }).length,
        product: cs('.product', ['display', 'gridTemplateColumns']),
        side: cs('.side', ['borderLeftWidth', 'borderLeftStyle', 'paddingLeft']),
        step: cs('.steps .step', ['display', 'gridTemplateColumns']),
        catch: cs('.catches .catch', ['display', 'gridTemplateColumns']),
        overflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
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
    // A section is a rule and nothing else: no fill, no radius, no box.
    assert.deepEqual(r.band, { backgroundColor: 'rgba(0, 0, 0, 0)', borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: rgb(LIGHT.line), borderTopLeftRadius: '0px' })
    // The section label is the quiet reading level, not the muted component
    // colour: at 11px it is text, and text is AA (task 030 correction 1).
    assert.deepEqual(r.eyebrow, { textTransform: 'uppercase', fontSize: `${TYPE['t-0']}px`, color: rgb(LIGHT.quietText) })
    // The display line is the pack's 50px serif at the brand's display weight.
    assert.deepEqual(r.display, { fontSize: `${DISPLAY['d-1']}px`, fontWeight: String(ROLE_WEIGHTS.display) })
    // The pack's own grids, as a browser resolves them: the product's two
    // columns with the rail bordered off, the 78px step and the 160px catch.
    assert.equal(r.product?.display, 'grid')
    assert.equal(r.product?.gridTemplateColumns.split(' ').length, 2, `the product section resolved to ${r.product?.gridTemplateColumns}`)
    assert.equal(r.side?.borderLeftWidth, '1px')
    assert.equal(r.side?.borderLeftStyle, 'solid')
    assert.equal(r.side?.paddingLeft, '24px')
    assert.match(r.step?.gridTemplateColumns ?? '', /^78px /)
    assert.match(r.catch?.gridTemplateColumns ?? '', /^160px /)
    // The two hero buttons are the only boxed things on the page: no card wall.
    assert.equal(r.boxes, 2, `${r.boxes} boxed elements in the page body; only the two hero actions carry a border, and nothing else is a panel`)
    assert.ok(r.overflow, 'the page is wider than the viewport at 1280')
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
