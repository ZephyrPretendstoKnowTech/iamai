import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser'
import type { AccountInfo } from '@azure/msal-browser'

// SPEC.md §4 — the full read scope set, requested once at sign-in (no staged consent).
export const GRAPH_SCOPES = [
  'Policy.Read.All',
  'Directory.Read.All',
  'Application.Read.All',
  'AuditLog.Read.All',
  'RoleManagement.Read.Directory',
  'UserAuthenticationMethod.Read.All',
  'Reports.Read.All',
  'openid',
  'profile',
  'offline_access',
]

export const msal = new PublicClientApplication({
  auth: {
    clientId: '13f55900-8e9a-4aa3-82c1-e42a4448680f',
    authority: 'https://login.microsoftonline.com/organizations',
    redirectUri: 'http://localhost:5173',
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

export function signIn(): Promise<void> {
  return msal.loginRedirect({ scopes: GRAPH_SCOPES })
}

export function signOut(): Promise<void> {
  return msal.logoutRedirect()
}

export async function getGraphToken(): Promise<string> {
  const account = msal.getActiveAccount()
  if (!account) throw new Error('Not signed in')
  try {
    const result = await msal.acquireTokenSilent({ scopes: GRAPH_SCOPES, account })
    return result.accessToken
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      await msal.acquireTokenRedirect({ scopes: GRAPH_SCOPES, account })
    }
    throw e
  }
}
