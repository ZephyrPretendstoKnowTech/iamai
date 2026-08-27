import { useEffect, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import { initAuth } from '../graph/msal.ts'
import { fetchTenantName } from '../graph/organization.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { loadSnapshotRecord, saveSnapshotRecord } from '../graph/collect/cache.ts'
import { AppShell, useHashRoute } from './shell/AppShell.tsx'
import type { Route, StepStatus } from './shell/AppShell.tsx'
import { StartPage } from './pages/StartPage.tsx'
import { ConnectPage } from './pages/ConnectPage.tsx'
import { BaselinePage } from './pages/BaselinePage.tsx'
import type { BaselineResult } from './pages/BaselinePage.tsx'
import { LicensingPage } from './pages/LicensingPage.tsx'
import { CoveragePage } from './pages/CoveragePage.tsx'
import { MappingPage } from './pages/MappingPage.tsx'
import { RoadmapPage } from './pages/RoadmapPage.tsx'
import { MfaViabilityScreen } from './MfaViabilityScreen.tsx'
import { WhatIamaiReads } from './WhatIamaiReads.tsx'
import { DevSpikes } from './DevSpikes.tsx'
import { ComponentsPage } from './pages/ComponentsPage.tsx'
import { PackagePage } from './pages/PackagePage.tsx'
import { SHELL } from '../copy/pages.ts'

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
  const [mapProgress, setMapProgress] = useState<{ answered: number; total: number; complete: boolean } | null>(null)
  const route = useHashRoute()

  useEffect(() => {
    initAuth()
      .then((a) => {
        setAccount(a)
        if (a) {
          void fetchTenantName().then(setTenantName)
          // Restore the last scan so nobody re-scans just to look around.
          void loadSnapshotRecord<{ snapshot: TenantSnapshot; at: string }>(a.tenantId).then((stored) => {
            if (stored?.snapshot) setLastScan({ snapshot: stored.snapshot, at: stored.at })
          })
        }
      })
      .catch((e: unknown) => setAuthError(e instanceof Error ? e.message : String(e)))
      .finally(() => setReady(true))
  }, [])

  const stepStatus: Partial<Record<Route, StepStatus>> = {
    start: account ? 'done' : 'notStarted',
    connect: account ? 'done' : 'notStarted',
    baseline: baseline ? 'done' : 'notStarted',
    scan: scanRunning ? 'inProgress' : lastScan ? 'done' : 'notStarted',
    mapping: mapProgress?.complete ? 'done' : (mapProgress?.answered ?? 0) > 0 ? 'inProgress' : 'notStarted',
    coverage: lastScan && baseline ? 'done' : 'notStarted',
    roadmap: lastScan && baseline ? (mapProgress?.complete ? 'done' : 'inProgress') : 'notStarted',
  }

  return (
    <AppShell account={account} tenantName={tenantName} route={route} stepStatus={stepStatus}>
      {!ready ? (
        SHELL.loading
      ) : (
        <>
          {authError && (
            <p className="error">
              {SHELL.signInError} {authError}
            </p>
          )}
          {route === 'start' && <StartPage />}
          {route === 'connect' && (
            <ConnectPage
              account={account}
              tenantName={tenantName}
              lastScanAt={lastScan?.at ?? null}
              userCount={lastScan?.snapshot.users.length ?? null}
            />
          )}
          {route === 'baseline' && <BaselinePage result={baseline} onLoaded={setBaseline} />}
          {route === 'baseline/package' && <PackagePage />}
          {(route === 'scan' || route === 'inventory') &&
            (account ? (
              <MfaViabilityScreen
                key={route}
                view={route === 'inventory' ? 'inventory' : 'readiness'}
                tenantId={account.tenantId}
                initial={lastScan}
                onRunningChange={setScanRunning}
                onComplete={(snapshot, at) => {
                  setLastScan({ snapshot, at })
                  void saveSnapshotRecord(account.tenantId, { snapshot, at })
                }}
              />
            ) : (
              <section>
                <h2>{SHELL.steps.scan}</h2>
                <p>
                  {SHELL.scanNeedsConnect} <a href="#/connect">{SHELL.connectLink}</a>
                </p>
              </section>
            ))}
          {route === 'mapping' && (
            <MappingPage scan={lastScan} baseline={baseline} onProgress={setMapProgress} />
          )}
          {route === 'coverage' && <CoveragePage scan={lastScan} baseline={baseline} />}
          {route === 'roadmap' && (
            <RoadmapPage
              scan={lastScan}
              baseline={baseline}
              operator={account ? { userId: account.localAccountId, userPrincipalName: account.username } : null}
            />
          )}
          {route === 'licensing' && <LicensingPage scan={lastScan} />}
          {route === 'reads' && <WhatIamaiReads />}
          {route === 'components' && (import.meta.env.DEV ? <ComponentsPage /> : <StartPage />)}
          {DEV_PANEL && account && <DevSpikes />}
        </>
      )}
    </AppShell>
  )
}
