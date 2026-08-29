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
const LINK_HOSTS = new Set(['learn.microsoft.com', 'entra.microsoft.com', 'aka.ms', 'github.com', 'www.linkedin.com', 'example.test', 'react.dev', 'www.w3.org', 'localhost'])

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|css|html)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

const files = [...walk('src'), 'index.html']
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
