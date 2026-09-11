// The published pages carry a Content-Security-Policy (scripts/csp.ts): the
// planner as a build-only transform, the home page when it is assembled.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { REQUEST_HOSTS, homeCsp, inlineScriptHashes, plannerCsp, withCsp } from '../scripts/csp.ts'
import { assembleHome } from '../scripts/build-home.ts'

const directive = (policy: string, name: string): string[] => (policy.split('; ').find((d) => d.startsWith(`${name} `)) ?? '').split(' ').slice(1)

test('the planner may reach only the hosts it requests, and runs no inline or evaluated script', () => {
  const p = plannerCsp()
  assert.deepEqual(directive(p, 'connect-src').filter((s) => s.startsWith('https://') && !/cloudflareinsights/.test(s)), REQUEST_HOSTS.map((h) => `https://${h}`))
  assert.deepEqual(directive(p, 'frame-src'), ['https://login.microsoftonline.com'], 'MSAL renews tokens in a frame on the sign-in host and nowhere else')
  assert.ok(!/unsafe-eval/.test(p))
  assert.ok(!directive(p, 'script-src').includes("'unsafe-inline'"))
  assert.deepEqual(directive(p, 'object-src'), ["'none'"])
  assert.ok(!/frame-ancestors/.test(p), 'frame-ancestors is ignored in a meta policy; it is a header')
})

test('the home page allows its own inline scripts by hash and fetches nothing', () => {
  const html = '<head><meta charset="UTF-8" /></head><body><script src="/x.js"></script><script>var a = 1</script></body>'
  const hash = `sha256-${createHash('sha256').update('var a = 1').digest('base64')}`
  assert.deepEqual(inlineScriptHashes(html), [hash])
  const p = homeCsp([hash])
  assert.ok(directive(p, 'script-src').includes(`'${hash}'`))
  assert.ok(!directive(p, 'script-src').includes("'unsafe-inline'"))
  assert.deepEqual(directive(p, 'frame-src'), ["'none'"])
})

test('the policy is placed straight after the charset, once', () => {
  const out = withCsp('<head>\n    <meta charset="UTF-8" />\n    <title>x</title>', 'default-src \'self\'')
  assert.match(out, /<meta charset="UTF-8" \/>\n {4}<meta http-equiv="Content-Security-Policy" content="default-src 'self'" \/>\n {4}<title>/)
  assert.throws(() => withCsp(out, 'x'), /already carries/)
  assert.throws(() => withCsp('<head></head>', 'x'), /no <meta charset>/)
})

test('the assembled home page carries the hash of the script it publishes', () => {
  const html = readFileSync('home/index.html', 'utf8')
  const sheets = { 'home.css': readFileSync('home/home.css', 'utf8'), 'theme.css': readFileSync('home/theme.css', 'utf8') }
  const page = assembleHome(html, sheets, 'planner')['index.html']
  const meta = page.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)" \/>/)
  assert.ok(meta, 'no policy on the assembled home page')
  const withoutMeta = page.replace(meta[0], '')
  for (const h of inlineScriptHashes(withoutMeta)) assert.ok(meta[1].includes(`'${h}'`), `the policy does not allow the published inline script ${h}`)
  assert.ok(inlineScriptHashes(withoutMeta).length > 0, 'the home page publishes its theme script inline')
})

test('the planner build writes the policy; the dev server does not', () => {
  const src = readFileSync('vite.config.ts', 'utf8')
  assert.match(src, /name: 'content-security-policy',\s*apply: 'build',\s*transformIndexHtml\(html\) \{\s*return withCsp\(html, plannerCsp\(\)\)/)
})
