// Prompt 50 item 7: the first click on "Sign in with Microsoft" after a page
// load must start the flow. The bug was that loginRedirect ran before MSAL's
// initialize() resolved, which is a no-op, so nothing happened until the second
// click. signIn now awaits the memoized init first. A real redirect navigates
// away from a headless page, so the guarantee is asserted at the source: signIn
// awaits initAuth before it calls loginRedirect.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('signIn awaits MSAL init before loginRedirect', () => {
  const src = readFileSync('src/graph/msal.ts', 'utf8')
  const start = src.indexOf('export async function signIn')
  assert.ok(start >= 0, 'signIn is not async (it must await init)')
  const body = src.slice(start, src.indexOf('\n}', start))
  const awaitAt = body.indexOf('await initAuth()')
  const redirectAt = body.indexOf('return msal.loginRedirect')
  assert.ok(awaitAt >= 0, 'signIn does not await initAuth()')
  assert.ok(redirectAt >= 0, 'signIn does not call msal.loginRedirect')
  assert.ok(awaitAt < redirectAt, 'signIn calls loginRedirect before awaiting init')
})
