import { useEffect, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import { initAuth } from '../graph/msal.ts'
import { fetchTenantName } from '../graph/organization.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { AppShell, useHashRoute } from './shell/AppShell.tsx'
import type { Route, StepStatus } from './shell/AppShell.tsx'
import { StartPage } from './pages/StartPage.tsx'
import { ConnectPage } from './pages/ConnectPage.tsx'
import { BaselinePage } from './pages/BaselinePage.tsx'
import type { BaselineResult } from './pages/BaselinePage.tsx'
import { LicensingGuidePage, MappingPage, RoadmapPage } from './pages/PlaceholderPage.tsx'
import { CoveragePage } from './pages/CoveragePage.tsx'
import { MfaViabilityScreen } from './MfaViabilityScreen.tsx'
import { WhatIamaiReads } from './WhatIamaiReads.tsx'
import { DevSpikes } from './DevSpikes.tsx'

const DEV_PANEL =
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === '1'

export function App() {
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [ready, setReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [baseline, setBaseline] = useState<BaselineResult | null>(null)
  const [lastScan, setLastScan] = useState<{ snapshot: TenantSnapshot; at: string } | null>(null)
  const [scanRunning, setScanRunning] = useState(false)
  const route = useHashRoute()

  useEffect(() => {
    initAuth()
      .then((a) => {
        setAccount(a)
        if (a) void fetchTenantName().then(setTenantName)
      })
      .catch((e: unknown) => setAuthError(e instanceof Error ? e.message : String(e)))
      .finally(() => setReady(true))
  }, [])

  const stepStatus: Partial<Record<Route, StepStatus>> = {
    start: account ? 'done' : 'notStarted',
    connect: account ? 'done' : 'notStarted',
    baseline: baseline ? 'done' : 'notStarted',
    scan: scanRunning ? 'inProgress' : lastScan ? 'done' : 'notStarted',
  }

  return (
    <AppShell account={account} tenantName={tenantName} route={route} stepStatus={stepStatus}>
      {!ready ? (
        'Loading…'
      ) : (
        <>
          {authError && <p className="error">Sign-in error: {authError}</p>}
          {route === 'start' && <StartPage />}
          {route === 'connect' && <ConnectPage account={account} tenantName={tenantName} />}
          {route === 'baseline' && <BaselinePage result={baseline} onLoaded={setBaseline} />}
          {route === 'scan' &&
            (account ? (
              <MfaViabilityScreen
                tenantId={account.tenantId}
                initial={lastScan}
                onRunningChange={setScanRunning}
                onComplete={(snapshot, at) => setLastScan({ snapshot, at })}
              />
            ) : (
              <section>
                <h2>Scan</h2>
                <p>
                  The scan reads your tenant into a local snapshot. <a href="#/connect">Connect a
                  tenant</a> first.
                </p>
              </section>
            ))}
          {route === 'mapping' && (
            <MappingPage baselineLoaded={baseline !== null} scanDone={lastScan !== null} />
          )}
          {route === 'coverage' && <CoveragePage scan={lastScan} baseline={baseline} />}
          {route === 'roadmap' && <RoadmapPage scanAt={lastScan?.at ?? null} />}
          {route === 'licensing' && <LicensingGuidePage />}
          {route === 'reads' && <WhatIamaiReads />}
          {DEV_PANEL && account && <DevSpikes />}
        </>
      )}
    </AppShell>
  )
}
