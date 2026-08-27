import { useEffect, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import { initAuth } from '../graph/msal.ts'
import { AppShell, useHashRoute } from './shell/AppShell.tsx'
import { BaselinePage } from './pages/BaselinePage.tsx'
import { ConnectPage } from './pages/ConnectPage.tsx'
import { PlaceholderPage } from './pages/PlaceholderPage.tsx'
import { MfaViabilityScreen } from './MfaViabilityScreen.tsx'
import { WhatIamaiReads } from './WhatIamaiReads.tsx'
import { DevSpikes } from './DevSpikes.tsx'

const DEV_PANEL =
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === '1'

export function App() {
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [ready, setReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const route = useHashRoute()

  useEffect(() => {
    initAuth()
      .then(setAccount)
      .catch((e: unknown) => setAuthError(e instanceof Error ? e.message : String(e)))
      .finally(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <AppShell account={null} route={route}>
        Loading…
      </AppShell>
    )
  }

  return (
    <AppShell account={account} route={route}>
      {authError && <p className="error">Sign-in error: {authError}</p>}
      {route === 'baseline' && <BaselinePage />}
      {route === 'connect' && <ConnectPage account={account} />}
      {route === 'mapping' && <PlaceholderPage page="mapping" />}
      {route === 'coverage' && <PlaceholderPage page="coverage" />}
      {route === 'readiness' &&
        (account ? (
          <MfaViabilityScreen tenantId={account.tenantId} />
        ) : (
          <section>
            <h2>Readiness</h2>
            <p>
              Readiness scores every user's MFA viability from your tenant's data.{' '}
              <a href="#/connect">Connect a tenant</a> to scan.
            </p>
          </section>
        ))}
      {route === 'roadmap' && <PlaceholderPage page="roadmap" />}
      {route === 'licensing' && <PlaceholderPage page="licensing" />}
      {route === 'reads' && <WhatIamaiReads />}
      {DEV_PANEL && account && <DevSpikes />}
    </AppShell>
  )
}
