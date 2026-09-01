import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser'
import type { AccountInfo } from '@azure/msal-browser'
import { SessionExpiredError } from './collect/tokenGate.ts'

// SPEC.md §4 — the full read scope set, requested once at sign-in (no staged
// consent). The list itself lives in scopes.ts so it can be read without a
// browser; re-exported here because this is where callers expect it.
export { GRAPH_SCOPES } from './scopes.ts'
import { GRAPH_SCOPES } from './scopes.ts'

export const msal = new PublicClientApplication({
  auth: {
    clientId: '13f55900-8e9a-4aa3-82c1-e42a4448680f',
    authority: 'https://login.microsoftonline.com/organizations',
    // The app registration lists the dev origin and the published origin plus subpath (SPEC §8, docs/RELEASE-CHECKLIST.md).
    redirectUri: window.location.origin + (import.meta.env.BASE_URL ?? '/'),
  },
  cache: { cacheLocation: 'sessionStorage' },
})

let initialized: Promise<AccountInfo | null> | undefined

export function initAuth(): Promise<AccountInfo | null> {
  // Memoized so React StrictMode's double effect run cannot call handleRedirectPromise twice.
  initialized ??= (async () => {
    await msal.initialize()
    const result = await msal.handleRedirectPromise()
    if (result?.account) {
      msal.setActiveAccount(result.account)
      return result.account
    }
    const existing = msal.getAllAccounts()[0] ?? null
    if (existing) msal.setActiveAccount(existing)
    return existing
  })()
  return initialized
}

let authorityWarm: Promise<void> | undefined

/**
 * Fetch the authority's OpenID metadata so the browser has it cached before the
 * first `loginRedirect` needs it (prompt 50.1 item 7). `initialize()` does not
 * load it — `loginRedirect` fetches it lazily and awaits it, so the first click
 * on a cold page still stalls on the network. Warming it up front, and gating
 * the button on it, means the click that lands is the one that navigates.
 * Memoized; a failure resolves rather than rejects, so a warm that cannot reach
 * the network never traps the button disabled.
 */
export function warmAuthority(): Promise<void> {
  authorityWarm ??= fetch('https://login.microsoftonline.com/organizations/v2.0/.well-known/openid-configuration', { method: 'GET' })
    .then(() => undefined)
    .catch(() => undefined)
  return authorityWarm
}

/** MSAL is ready to sign in: initialised, the redirect handled, the metadata warmed. */
export function authReady(): Promise<unknown> {
  return Promise.all([initAuth(), warmAuthority()])
}

export async function signIn(): Promise<void> {
  // The first click used to race MSAL's initialize(); loginRedirect before it
  // resolved was a no-op, so the button did nothing until the second click
  // (prompt 50 item 7). Await the memoized init and the warmed metadata first,
  // so a queued early click navigates the moment it can (prompt 50.1 item 7).
  await authReady()
  return msal.loginRedirect({ scopes: GRAPH_SCOPES })
}

export async function signOut(): Promise<void> {
  // Never signed in through MSAL (the dev mock): nothing to log out of; back to Connect.
  if (!initialized) {
    window.location.hash = '#/connect'
    return
  }
  await initialized
  // Warming MSAL up initialises it without ever signing in (the mock, or a
  // visitor who never clicked): there is no account to redirect a logout for, so
  // stay local and go back to Connect.
  if (!msal.getActiveAccount()) {
    window.location.hash = '#/connect'
    return
  }
  return msal.logoutRedirect()
}

/**
 * Remove every local MSAL trace, so "Forget this tenant" leaves nothing behind
 * (prompt 31 §2.8) even when sign-in only ever got as far as warming MSAL up and
 * writing its cache. Session-storage only; MSAL keeps nothing else locally.
 */
export function clearAuthCache(): void {
  try {
    for (const k of Object.keys(sessionStorage)) if (/^msal\./i.test(k) || /login\.windows|microsoftonline/i.test(k)) sessionStorage.removeItem(k)
  } catch {
    // Session storage blocked; there is nothing to clear.
  }
}

/**
 * A Graph token. When the silent refresh needs the operator: 'redirect' leaves
 * the page (first sign-in), 'popup' keeps it (mid-scan, prompt 20 §3), and
 * 'silent' reports a SessionExpiredError so the caller can pause.
 */
export async function getGraphToken(mode: 'redirect' | 'popup' | 'silent' = 'redirect'): Promise<string> {
  const account = msal.getActiveAccount()
  if (!account) throw new Error('Not signed in')
  try {
    const result = await msal.acquireTokenSilent({ scopes: GRAPH_SCOPES, account })
    return result.accessToken
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      if (mode === 'popup') return (await msal.acquireTokenPopup({ scopes: GRAPH_SCOPES, account })).accessToken
      if (mode === 'redirect') await msal.acquireTokenRedirect({ scopes: GRAPH_SCOPES, account })
      throw new SessionExpiredError()
    }
    throw e
  }
}
