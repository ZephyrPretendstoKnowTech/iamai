// The home page (prompt 35 §1, §2; prompt 52 Part 1; rebuilt by task 016; the
// approved composition restored by task 038).
//
// The page is generated from docs/design/content.json (pages.home) by
// scripts/build-home.ts, the way the theme file is generated from the tokens.
// These lock the committed files to their generators — so the words the owner
// reviews in content.json and the words the home page shows cannot drift — and
// hold the facts that have to be true whatever the copy says: read-only,
// browser-local, no server, nothing loaded from another host, nothing collected,
// the baseline's author named without an endorsement, and real destinations
// into the planner. The layout is the approved pack's (src/ui/design-authority.test.ts
// guards the pack itself); the words are the owner's to change.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { pages } from './content/content.ts'
import { PRODUCT_ENTRY, assembleHome, renderHomeHtml, renderHomeTheme, versionedName } from '../scripts/build-home.ts'
import type { HomeBeat, HomeTrust } from '../scripts/build-home.ts'
import { TOOL_PATH } from '../scripts/toolPath.ts'

const home = 'home'
const lf = (s: string): string => s.replace(/\r\n/g, '\n')
const html = lf(readFileSync(join(home, 'index.html'), 'utf8'))
const css = lf(readFileSync(join(home, 'home.css'), 'utf8'))
const theme = lf(readFileSync(join(home, 'theme.css'), 'utf8'))
const H = pages.home as Record<string, unknown>
const WORK = H.work as HomeBeat[]
const TRUST = H.trust as HomeTrust[]
const FOOTER = (pages.footer as { links: { text: string; href: string }[] }).links
const SHELL = pages.app.shell as { lightTheme: string; darkTheme: string; themeTooltip: string }
const REPO = 'https://github.com/ZephyrPretendstoKnowTech/iamai'
/** The planner's How page, the one public link that is not the product entry or the source. */
const HOW_HREF = '/{{TOOL_PATH}}/#/how'
const DEMO_HREF = '/{{TOOL_PATH}}/?demo=1#/plan'

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const unesc = (s: string): string => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
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
/** Every <a> in a fragment: where it goes and the words on it. */
const links = (fragment: string): { href: string; text: string }[] =>
  [...fragment.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1], text: unesc(m[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() }))

test('the home page and its theme are generated from content, current, and carry no word or path of their own', () => {
  assert.equal(html, lf(renderHomeHtml()), 'run node scripts/build-home.ts')
  assert.equal(theme, lf(renderHomeTheme()), 'run node scripts/build-home.ts')
  // The planner hrefs and the font path are substituted by the build, never written out.
  assert.ok(html.includes('{{TOOL_PATH}}') && theme.includes('{{TOOL_PATH}}'))
  for (const file of ['index.html', 'home.css', 'theme.css']) {
    const text = readFileSync(join(home, file), 'utf8')
    assert.doesNotMatch(text, new RegExp(`/${TOOL_PATH}\\b`), `${file} spells out the tool path instead of using the placeholder`)
    assert.doesNotMatch(text, /\/rollout\b/, `${file} still points at the retired /rollout/ path`)
  }
  // Every text piece the page shows is a content string, and every pages.home string is on the page.
  const allowed = new Set([...leaves(H), ...FOOTER.map((l) => l.text), SHELL.darkTheme, SHELL.lightTheme])
  const shown = textPieces(html.slice(html.indexOf('<header'), html.indexOf('</footer>')))
  assert.deepEqual(shown.filter((s) => !allowed.has(s)), [], 'strings on the page that are not in content.json')
  assert.ok(shown.length > 30, 'the page shows its words')
  for (const s of leaves(H)) assert.ok(html.includes(esc(s)), `pages.home string not on the page: "${s}"`)
})

// Same rule as the app (CLAUDE.md): no CDN, no framework, no analytics. A remote
// font host would be a third party watching every visit; a form would collect
// something there is no endpoint behind.
test('the home page loads nothing from another host and collects nothing', () => {
  const faces = [...theme.matchAll(/@font-face \{[\s\S]*?\n\}/g)].map((m) => m[0])
  assert.ok(faces.length >= 7, `${faces.length} font faces; the brand's three families`)
  for (const face of faces) assert.match(face, /url\('\/\{\{TOOL_PATH\}\}\/fonts\/[^']+\.woff2'\)/, 'a face served from somewhere other than this origin')
  assert.doesNotMatch(theme, /https?:\/\//, 'the token sheet reaches out to a host')
  assert.doesNotMatch(css, /https?:\/\/|@import/i, 'the home stylesheet reaches out to a host')
  assert.doesNotMatch(html, /<script[^>]*\ssrc=/i, 'no script is fetched')
  assert.doesNotMatch(html, /https?:\/\/[^"']*\.(js|css)\b/i, 'nothing loaded from another host')
  assert.doesNotMatch(html, /<link[^>]+rel="(stylesheet|preconnect)"[^>]+href="https?:/i, 'the page links or warms another host')
  for (const tag of ['<form', '<input', '<textarea', '<select']) assert.ok(!html.includes(tag), `the home page carries a ${tag} control`)
  assert.doesNotMatch(html, /subscribe|mailing list|newsletter|keep me posted|notify me/i, 'an opt-in with nothing behind it')
})

// Trust is specific and checkable, and nothing the page says may claim more
// than the product does: it plans, it never applies; approving it adds an
// enterprise application; it has no server; the baseline is Jon Hope's and
// Microsoft endorses nothing here.
test('the public claims are the true ones: read-only, browser-local, no server, the operator makes the changes, the baseline attributed without an endorsement', () => {
  const said = TRUST.map((t) => `${t.title} ${t.body}`).join(' ')
  assert.match(said, /does not change your tenant|read-only/i)
  assert.match(said, /has no server, so your scan is not uploaded anywhere/i)
  assert.match(said, /enterprise application/, 'approving IAMAI adds an enterprise application, and the row says so')
  assert.doesNotMatch(said, /its own server/)
  assert.match(said, /you decide which changes to make and carry them out yourself/)
  assert.ok(TRUST.some((t) => t.href === REPO), 'the source claim links to the repository')
  assert.doesNotMatch(said, /privacy first|secure by design|your data is safe|bank.grade|military.grade|\b(ISO ?27001|SOC ?2|GDPR compliant|HIPAA|certified|uptime|SLA|partner of|trusted by)\b/i, said)
  const work = WORK.map((b) => `${b.verb} ${b.text}`).join(' ')
  assert.doesNotMatch(work, /\b(applies|applying|apply|remediates|enforces|deploys|rolls out|fixes) (it|them|the|your|a) /i, work)
  assert.doesNotMatch(JSON.stringify(H.heroMeta), /guarantee|certified|automatically/i)
  const baseline = [H.baselineName, H.baseline, H.baselineGoal, H.baselineNote].join(' ')
  for (const fact of ['Defense in Depth', 'Jon Hope', 'Microsoft MVP']) assert.ok(baseline.includes(fact) && html.includes(esc(fact)), `the rail names ${fact}`)
  assert.doesNotMatch(baseline, /Microsoft(-| )(approved|certified|endorsed|recommended|official)|endorse|certifie|approved by Microsoft|partnership/i, baseline)
  assert.doesNotMatch(H.baseline as string, /\bdefault\b/i, 'the baseline is offered as a default among choices')
})

// The build publishes the home page at / and the planner under the tool path;
// every link into the planner is a real destination there.
test('every link into the planner is a real route, and the build publishes home at / with the planner under the tool path', () => {
  const into = links(html).filter((l) => l.href.startsWith('/{{TOOL_PATH}}/'))
  assert.deepEqual(into.map((l) => l.href), [HOW_HREF, PRODUCT_ENTRY, PRODUCT_ENTRY, DEMO_HREF, PRODUCT_ENTRY])
  const routes = readFileSync('src/ui/shell/routes.ts', 'utf8')
  for (const hash of ['connect', 'how', 'plan']) assert.ok(routes.includes(`'${hash}'`), `#/${hash} is a planner route`)
  assert.equal(PRODUCT_ENTRY, '/{{TOOL_PATH}}/#/connect', 'the product entry is Connect, the first step of the product')
  const built = assembleHome(html, { 'theme.css': theme, 'home.css': css }, TOOL_PATH)['index.html']
  for (const l of into) assert.ok(built.includes(l.href.replaceAll('{{TOOL_PATH}}', TOOL_PATH)), 'the built page carries the substituted destination')
  assert.ok(built.includes('<main class="page">'), 'dist/index.html is the home page')
  assert.match(readFileSync('scripts/assemble-site.mjs', 'utf8'), /join\(dist, TOOL_PATH, 'index\.html'\)/, 'the planner is expected under the tool path')
  assert.equal(TOOL_PATH, 'planner')
  assert.ok(readdirSync(home).includes('og.png'), 'the OpenGraph image ships with the page')
})

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
  assert.doesNotMatch(page, /href="\/(theme|home)\.css"|\{\{/, 'an unversioned link or an unsubstituted placeholder remains')
  assert.notEqual(versionedName('home.css', css), versionedName('home.css', `${css}\n.card { padding: 0; }\n`), 'a changed sheet is a new name')
  assert.throws(() => assembleHome(html, { 'other.css': '' }, TOOL_PATH), /does not link/)
})
