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

test('sign-out clears the cache whether or not MSAL held an account, and redirects only with one; it never routes the page itself (ui/actions.ts does)', () => {
  const start = src.indexOf('export async function signOut')
  assert.ok(start >= 0)
  const body = src.slice(start, src.indexOf('\n}', start))
  const clearAt = body.indexOf('clearAuthCache()')
  const returnAt = body.indexOf('if (!account) return')
  const redirectAt = body.indexOf('msal.logoutRedirect({ account })')
  assert.ok(clearAt >= 0 && returnAt >= 0 && redirectAt >= 0, body)
  assert.ok(clearAt < returnAt && returnAt < redirectAt, 'the cache is cleared before the no-account return, and the redirect comes last')
  assert.doesNotMatch(body, /window\.location/, 'the action module lands the page on Connect; the library only signs out')
})

test('Sign in as another account is a fresh authentication attempt: the picker is asked for, and the library picks nobody itself', () => {
  const start = src.indexOf('export async function signInAnother')
  assert.ok(start >= 0, 'signInAnother is not exported')
  const body = src.slice(start, src.indexOf('\n}', start))
  assert.match(body, /await authReady\(\)/, 'signInAnother does not await readiness, so the first click can be a no-op')
  // prompt: 'select_account' is what stops Microsoft answering from the session
  // it already has: the operator is shown the picker and chooses.
  assert.match(body, /msal\.loginRedirect\(\{[^}]*prompt: 'select_account'[^}]*\}\)/, 'the account picker is not asked for, so the signed-in account can be reselected silently')
  // And it chooses no account of its own: whoever the redirect comes back with
  // is the account initAuth makes active, so a stale cached account cannot win.
  assert.doesNotMatch(body, /getActiveAccount|getAllAccounts|setActiveAccount/, 'signInAnother picks an account out of the cache instead of letting the redirect decide')
})
