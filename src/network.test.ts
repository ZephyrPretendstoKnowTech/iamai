// Nothing leaves the browser (prompt 31 §1): a test, not an inspection.
// Every network destination in the source, the HTML shell and the styles
// must be one of the three hosts the product needs. Links a person can
// click (Learn, the portal, GitHub, aka.ms) are navigation, not requests,
// and are allowed only as href text; a fetch, an import, a script, a
// stylesheet, an image, a font, a beacon or a socket must stay on the list.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const REQUEST_HOSTS = new Set(['graph.microsoft.com', 'login.microsoftonline.com', 'raw.githubusercontent.com'])
/** Hosts that appear only as places a person may navigate to; never fetched. */
// getiamai.com is the site's own origin: the home page links to itself and
// declares its OpenGraph URL and image there. A social scraper fetches the
// image; the page never does.
const LINK_HOSTS = new Set(['learn.microsoft.com', 'entra.microsoft.com', 'aka.ms', 'github.com', 'www.linkedin.com', 'example.test', 'react.dev', 'www.w3.org', 'localhost', 'getiamai.com', 'www.getiamai.com'])

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|css|html)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

const files = [...walk('src'), ...walk('home'), 'index.html']
const HOST = /https?:\/\/([a-z0-9.-]+)/gi

test('every host in the source is either a request destination on the list or a link a person clicks', () => {
  const offenders: string[] = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(HOST)) {
      const host = m[1].toLowerCase()
      if (REQUEST_HOSTS.has(host) || LINK_HOSTS.has(host)) continue
      offenders.push(`${file}: ${host}`)
    }
  }
  assert.deepEqual(offenders, [])
})

test('requests, imports, scripts, styles, fonts, images, beacons and sockets never reach a host off the list', () => {
  const offenders: string[] = []
  const requestish = [
    /fetch\(\s*[`'"](https?:\/\/[^`'"]+)/gi,
    /new\s+(?:WebSocket|EventSource|Worker|Image)\(\s*[`'"](https?:\/\/[^`'"]+)/gi,
    /sendBeacon\(\s*[`'"](https?:\/\/[^`'"]+)/gi,
    /import\(\s*[`'"](https?:\/\/[^`'"]+)/gi,
    /\b(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["'][^>]*\brel=["']stylesheet/gi,
    /<script[^>]+src=["'](https?:\/\/[^"']+)/gi,
    /<link[^>]+href=["'](https?:\/\/[^"']+)/gi,
    /@import\s+(?:url\()?["']?(https?:\/\/[^"')]+)/gi,
    /url\(\s*["']?(https?:\/\/[^"')]+)/gi,
    /<img[^>]+src=["'](https?:\/\/[^"']+)/gi,
  ]
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const re of requestish) {
      for (const m of text.matchAll(re)) {
        const host = new URL(m[1]).hostname.toLowerCase()
        if (!REQUEST_HOSTS.has(host)) offenders.push(`${file}: ${m[0].slice(0, 80)}`)
      }
    }
  }
  assert.deepEqual(offenders, [])
})

test('the Graph and login hosts are the only ones the collectors and MSAL call', () => {
  const msal = readFileSync('src/graph/msal.ts', 'utf8')
  assert.match(msal, /authority: 'https:\/\/login\.microsoftonline\.com\//)
  const registry = readFileSync('src/graph/collect/registry.ts', 'utf8')
  for (const m of registry.matchAll(HOST)) assert.equal(m[1].toLowerCase(), 'graph.microsoft.com')
  const github = readFileSync('src/baseline/github.ts', 'utf8')
  for (const m of github.matchAll(HOST)) assert.ok(['raw.githubusercontent.com', 'github.com'].includes(m[1].toLowerCase()), m[0])
})

test('the styles self-host every font and import nothing remote', () => {
  const css = ['src/ui/tokens.css', 'src/ui/styles.css'].map((f) => readFileSync(f, 'utf8')).join('\n')
  for (const m of css.matchAll(/url\(([^)]+)\)/g)) assert.ok(!/^["']?https?:/i.test(m[1].trim()), `remote url in css: ${m[1]}`)
  assert.doesNotMatch(css, /@import\s+(?:url\()?["']?https?:/i)
})

// ---- the built artifact, not just the source ----
//
// The two tests above read source. That is a lint, and the audit was right that
// SECURITY.md oversold it: it cannot see what a dependency does, what a bundled
// JSON carries, or what the build actually emitted (egress-02, supply-03). It
// also could not see that the dev-only Graph spike harness was shipping to every
// visitor while two source comments said it did not (egress-04, supply-08).
//
// So these check dist/ when it exists. Skipped rather than failed when it does
// not, because `npm test` runs before `npm run build` in CI and a developer
// running tests alone should not be told to build first — CI reaches both.
/**
 * Hosts that appear as inert strings in the built artifact and are never
 * requested. Each is named with where it comes from, so a NEW host still fails
 * — which is the whole point of checking the artifact rather than the source.
 *
 * The audit predicted this list would be non-empty (egress-02: "a bundled JSON
 * already smuggles a fourth host past it"), and it was right: five of these six
 * are invisible to the source lint above.
 */
const ARTIFACT_ONLY = new Map([
  // MSAL ships a known-authority table for every sovereign cloud. IAMAI's
  // authority is login.microsoftonline.com (src/graph/msal.ts:14); the rest are
  // constants MSAL compares against and never contacts on our configuration.
  ['login.microsoftonline.us', '@azure/msal-browser sovereign-cloud authority table'],
  ['login.microsoftonline.de', '@azure/msal-browser sovereign-cloud authority table'],
  ['login.chinacloudapi.cn', '@azure/msal-browser sovereign-cloud authority table'],
  ['login.windows-ppe.net', '@azure/msal-browser test authority constant'],
  // The Azure instance-metadata address, in MSAL's managed-identity path. That
  // path is unreachable from a browser SPA and is not configured here.
  ['169.254.169.254', '@azure/msal-browser managed-identity IMDS constant'],
  // Provenance in data/product-names.json: the "source" field recording where
  // the licence table was generated from. Read by scripts/refresh-product-names.ts
  // at development time, never by the app.
  ['download.microsoft.com', 'data/product-names.json provenance field'],
])

const DIST = 'dist/rollout/assets'
const built = (): string[] => {
  try {
    return readdirSync(DIST)
      .filter((f) => /\.(js|css)$/.test(f))
      .map((f) => join(DIST, f))
  } catch {
    return []
  }
}

test('the built bundle addresses no host outside the list', () => {
  const files = built()
  if (files.length === 0) return // no build to check; CI always has one
  const offenders: string[] = []
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(HOST)) {
      const host = m[1].toLowerCase()
      if (REQUEST_HOSTS.has(host) || LINK_HOSTS.has(host) || ARTIFACT_ONLY.has(host)) continue
      offenders.push(`${f}: ${host}`)
    }
  }
  assert.deepEqual([...new Set(offenders)], [], 'the built bundle names a host that is on no list')

  // A documented exception that stops being present is an exception to delete.
  const text = files.map((f) => readFileSync(f, 'utf8')).join('')
  const stale = [...ARTIFACT_ONLY.keys()].filter((h) => !text.includes(h))
  assert.deepEqual(stale, [], 'these hosts are no longer in the bundle; remove them from ARTIFACT_ONLY')
})

test('the dev spike harness is absent from the built bundle', () => {
  const files = built()
  if (files.length === 0) return
  // Markers unique to the harness. Deliberately not 'authentication/methods' or
  // 'applicationSignInDetailedSummary': those are real collector endpoints and
  // matching on them would fail on correct code.
  const SPIKE_ONLY = ['__spike', '__spike1', '[spike1]', 'runSpike1', 'not%20startswith']
  const found: string[] = []
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    for (const marker of SPIKE_ONLY) if (text.includes(marker)) found.push(`${f}: ${marker}`)
  }
  assert.deepEqual(found, [], 'the dev-only Graph probe harness ships in the production bundle')
})
