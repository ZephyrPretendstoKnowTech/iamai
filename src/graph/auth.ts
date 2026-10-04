// The sign-in library, loaded when it is first needed (prompt 53 queue item 8).
// @azure/msal-browser is the largest single piece of the bundle and the demo
// never signs in, so the shell, Connect and the App reach it through these
// wrappers; Vite splits it into its own chunk, fetched on the first call. Every
// caller already awaited these (or fired them from a click), so nothing changes
// in what they do — only when the code arrives.
import type { AccountInfo } from '@azure/msal-browser'

const lib = () => import('./msal.ts')

export async function initAuth(): Promise<AccountInfo | null> {
  return (await lib()).initAuth()
}

export async function authReady(): Promise<unknown> {
  return (await lib()).authReady()
}

export async function signIn(): Promise<void> {
  return (await lib()).signIn()
}

/** A Graph token (see msal.ts): Connect reads its roles before the first Graph call. */
export async function getGraphToken(mode: 'redirect' | 'popup' | 'silent' = 'redirect'): Promise<string> {
  return (await lib()).getGraphToken(mode)
}

/** The account picker, for a role the signed-in account lacks. */
export async function signInAnother(): Promise<void> {
  return (await lib()).signInAnother()
}

/** The accounts signed in in this tab, for the tenant switcher (T3-A). */
export async function signedInAccounts(): Promise<AccountInfo[]> {
  return (await lib()).signedInAccounts()
}

/** Make a signed-in account the active one: the switcher's move to its tenant. */
export async function openAccount(account: AccountInfo): Promise<void> {
  return (await lib()).openAccount(account)
}

/** The account picker for a stored tenant whose account is not signed in, with a login hint where one is known. */
export async function signInTo(loginHint: string | null): Promise<void> {
  return (await lib()).signInTo(loginHint)
}

export async function signOut(): Promise<void> {
  return (await lib()).signOut()
}

/** Clear MSAL's own local cache; async now, because the library arrives on demand. */
export async function clearAuthCache(): Promise<void> {
  ;(await lib()).clearAuthCache()
}
