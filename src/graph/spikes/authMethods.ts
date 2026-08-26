// Dev-only check that the token carries UserAuthenticationMethod.Read.All by
// calling /me/authentication/methods. Saves only method types/ids — never the
// method payloads, which can contain phone numbers.
import { msal, GRAPH_SCOPES } from '../msal.ts'
import { saveDevResults } from './spike1.ts'

export type AuthMethodsCheck = {
  checkedAt: string
  account: string
  tokenScopes: string[]
  hasUserAuthMethodScope: boolean
  status: number | null
  ms: number | null
  methodCount: number | null
  methodTypes: string[] | null
  error?: string
}

export async function checkAuthMethods(): Promise<AuthMethodsCheck> {
  const account = msal.getActiveAccount()
  if (!account) throw new Error('Not signed in')
  const results: AuthMethodsCheck = {
    checkedAt: new Date().toISOString(),
    account: account.username,
    tokenScopes: [],
    hasUserAuthMethodScope: false,
    status: null,
    ms: null,
    methodCount: null,
    methodTypes: null,
  }
  try {
    const tok = await msal.acquireTokenSilent({ scopes: GRAPH_SCOPES, account })
    results.tokenScopes = tok.scopes
    results.hasUserAuthMethodScope = tok.scopes.some((s) =>
      s.toLowerCase().endsWith('userauthenticationmethod.read.all'),
    )
    const t0 = performance.now()
    const res = await fetch('https://graph.microsoft.com/v1.0/me/authentication/methods', {
      headers: { Authorization: `Bearer ${tok.accessToken}` },
    })
    results.ms = Math.round(performance.now() - t0)
    results.status = res.status
    const body: {
      value?: { '@odata.type'?: string }[]
      error?: { code?: string; message?: string }
    } = await res.json()
    if (Array.isArray(body.value)) {
      results.methodCount = body.value.length
      results.methodTypes = body.value.map((m) => m['@odata.type'] ?? 'unknown')
    }
    if (body.error) results.error = `${body.error.code}: ${String(body.error.message).slice(0, 200)}`
  } catch (e) {
    results.error = e instanceof Error ? e.message : String(e)
  }
  console.log('[authmethods] RESULTS', JSON.stringify(results, null, 2))
  await saveDevResults('authmethods', results)
  return results
}

let autoRan = false

// Called once after sign-in in dev; StrictMode double-mount is guarded here.
export function autoCheckAuthMethods(): void {
  if (!import.meta.env.DEV || autoRan) return
  autoRan = true
  void checkAuthMethods().catch((e: unknown) => console.log('[authmethods] check failed:', e))
}

declare global {
  interface Window {
    __checkAuthMethods?: typeof checkAuthMethods
  }
}

if (import.meta.env.DEV) {
  window.__checkAuthMethods = checkAuthMethods
}
