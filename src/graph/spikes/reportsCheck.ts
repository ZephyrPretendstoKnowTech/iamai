// Dev-only check that the token carries Reports.Read.All by calling the beta
// applicationSignInDetailedSummary report (403'd with a clean permission error
// in the spike 1 extended run before the scope existed).
import { msal, GRAPH_SCOPES } from '../msal.ts'
import { saveDevResults } from './spike1.ts'

export type ReportsCheck = {
  checkedAt: string
  account: string
  tokenScopes: string[]
  hasReportsScope: boolean
  status: number | null
  ms: number | null
  itemCount: number | null
  firstItemKeys: string[] | null
  error?: string
}

export async function checkReports(): Promise<ReportsCheck> {
  const account = msal.getActiveAccount()
  if (!account) throw new Error('Not signed in')
  const results: ReportsCheck = {
    checkedAt: new Date().toISOString(),
    account: account.username,
    tokenScopes: [],
    hasReportsScope: false,
    status: null,
    ms: null,
    itemCount: null,
    firstItemKeys: null,
  }
  try {
    const tok = await msal.acquireTokenSilent({ scopes: GRAPH_SCOPES, account })
    results.tokenScopes = tok.scopes
    results.hasReportsScope = tok.scopes.some((s) => s.toLowerCase().endsWith('reports.read.all'))
    const t0 = performance.now()
    const res = await fetch('https://graph.microsoft.com/beta/reports/applicationSignInDetailedSummary', {
      headers: { Authorization: `Bearer ${tok.accessToken}` },
    })
    results.ms = Math.round(performance.now() - t0)
    results.status = res.status
    const body: { value?: Record<string, unknown>[]; error?: { code?: string; message?: string } } =
      await res.json()
    if (Array.isArray(body.value)) {
      results.itemCount = body.value.length
      results.firstItemKeys = body.value[0] ? Object.keys(body.value[0]) : []
    }
    if (body.error) results.error = `${body.error.code}: ${String(body.error.message).slice(0, 200)}`
  } catch (e) {
    results.error = e instanceof Error ? e.message : String(e)
  }
  console.log('[reportscheck] RESULTS', JSON.stringify(results, null, 2))
  await saveDevResults('reportscheck', results)
  return results
}

let autoRan = false

export function autoCheckReports(): void {
  if (!import.meta.env.DEV || autoRan) return
  autoRan = true
  void checkReports().catch((e: unknown) => console.log('[reportscheck] check failed:', e))
}

declare global {
  interface Window {
    __checkReports?: typeof checkReports
  }
}

if (import.meta.env.DEV) {
  window.__checkReports = checkReports
}
