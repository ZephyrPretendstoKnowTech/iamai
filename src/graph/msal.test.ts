// Prompt 50 item 7 / 50.1 item 7: the first click on "Sign in with Microsoft"
// after a page load must start the flow. The bug was that loginRedirect ran
// before MSAL's initialize() resolved (and before the authority metadata was
// loaded), which is a no-op, so nothing happened until the second click. signIn
// now awaits authReady() — initialize, the redirect handling, and the warmed
// metadata — first. A real redirect navigates away from a headless page, so the
// guarantee is asserted at the source: signIn awaits authReady before it calls
// loginRedirect, and authReady is initAuth plus the warmed authority.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync('src/graph/msal.ts', 'utf8')

test('signIn awaits MSAL readiness before loginRedirect', () => {
  const start = src.indexOf('export async function signIn')
  assert.ok(start >= 0, 'signIn is not async (it must await readiness)')
  const body = src.slice(start, src.indexOf('\n}', start))
  const awaitAt = body.indexOf('await authReady()')
  const redirectAt = body.indexOf('return msal.loginRedirect')
  assert.ok(awaitAt >= 0, 'signIn does not await authReady()')
  assert.ok(redirectAt >= 0, 'signIn does not call msal.loginRedirect')
  assert.ok(awaitAt < redirectAt, 'signIn calls loginRedirect before awaiting readiness')
})

test('authReady waits for both the memoized init and the warmed authority metadata', () => {
  const start = src.indexOf('export function authReady')
  assert.ok(start >= 0, 'authReady is not exported')
  const body = src.slice(start, src.indexOf('\n}', start))
  assert.match(body, /initAuth\(\)/, 'authReady does not await initAuth')
  assert.match(body, /warmAuthority\(\)/, 'authReady does not warm the authority metadata')
})
