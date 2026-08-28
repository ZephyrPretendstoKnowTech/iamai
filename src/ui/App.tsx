import { Suspense, lazy, useEffect, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import { initAuth } from '../graph/msal.ts'
import { fetchTenantName } from '../graph/organization.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { loadBaselineRecord, loadSnapshotRecord, saveBaselineRecord, saveSnapshotRecord } from '../graph/collect/cache.ts'
import { AppShell, useHashRoute } from './shell/AppShell.tsx'
import { BackToTop, ErrorBoundary } from './components/index.ts'
import { learnRoleNames } from '../roles.ts'
import type { Route, StepStatus } from './shell/AppShell.tsx'
import { StartPage } from './pages/StartPage.tsx'
import { ConnectPage } from './pages/ConnectPage.tsx'
import { BaselinePage, restoreBaseline } from './pages/BaselinePage.tsx'
import type { BaselineResult } from './pages/BaselinePage.tsx'
import { LicensingPage } from './pages/LicensingPage.tsx'
import { CoveragePage } from './pages/CoveragePage.tsx'
import { MappingPage } from './pages/MappingPage.tsx'
import { RoadmapPage } from './pages/RoadmapPage.tsx'
import { MfaViabilityScreen } from './MfaViabilityScreen.tsx'
import { WhatIamaiReads } from './WhatIamaiReads.tsx'
import { PackagePage } from './pages/PackagePage.tsx'

// Dev-only modules are loaded on demand so they never enter the production bundle.
const DevSpikes = lazy(() => import('./DevSpikes.tsx').then((m) => ({ default: m.DevSpikes })))
const ComponentsPage = lazy(() => import('./pages/ComponentsPage.tsx').then((m) => ({ default: m.ComponentsPage })))
import { SHELL } from '../copy/pages.ts'
import { computeStepStatus } from './stepStatus.ts'
import { wizardProgress } from '../mapping/wizard.ts'
import type { WizardProgress } from '../mapping/wizard.ts'
import { loadMappingState } from '../mapping/store.ts'
import { probeStorage } from '../graph/collect/cache.ts'

const DEV_PANEL =
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === '1'
// ?dev=1&mock=1: the smoke test's tenant (prompt 20 §10). A synthetic account,
// scan and baseline stand in for Graph so the walk from Start to Roadmap runs
// headless with no sign-in. Dev builds only; the fixture is loaded lazily so
// it never ships.
const MOCK = DEV_PANEL && new URLSearchParams(window.location.search).get('mock') === '1'

export function App() {
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [ready, setReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [baseline, setBaseline] = useState<BaselineResult | null>(null)
  const [baselineRestoreError, setBaselineRestoreError] = useState<string | null>(null)
  const [lastScan, setLastScan] = useState<{ snapshot: TenantSnapshot; at: string } | null>(null)
  const [scanRunning, setScanRunning] = useState(false)
  const [mapProgress, setMapProgress] = useState<WizardProgress | null>(null)
  const route = useHashRoute()
  // Role names the scan carries ($expand=roleDefinition) resolve ids the bundled catalogue lacks.
  useEffect(() => {
    if (lastScan) learnRoleNames(lastScan.snapshot.config.roleAssignments?.rows ?? [])
  }, [lastScan])
  const [visitedStart, setVisitedStart] = useState<boolean>(() => {
    try {
      return localStorage.getItem('iamai-visited-start') === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    if (route !== 'start' || visitedStart) return
    setVisitedStart(true)
    try {
      localStorage.setItem('iamai-visited-start', '1')
    } catch {
      // storage unavailable: the status resets next visit
    }
  }, [route, visitedStart])

  useEffect(() => {
    if (MOCK) {
      void Promise.all([import('./pages/fixtureSnapshot.ts'), import('./pages/bigFixture.ts')]).then(([{ fixtureSnapshot, fixtureBaseline }, { bigFixtureSnapshot }]) => {
        const snapshot = new URLSearchParams(window.location.search).get('big') === '1' ? bigFixtureSnapshot() : fixtureSnapshot()
        setAccount({
          homeAccountId: 'mock',
          environment: 'login.windows.net',
          tenantId: snapshot.tenantId,
          username: 'alex@example.com',
          localAccountId: 'u-1',
          name: 'Alex Morgan',
        } as AccountInfo)
        setTenantName('Contoso Pty Ltd')
        setLastScan({ snapshot, at: snapshot.asOf })
        setBaseline(fixtureBaseline())
        void loadMappingState(snapshot.tenantId).then((m) => setMapProgress(wizardProgress(m)))
        setReady(true)
      })
      return
    }
    initAuth()
      .then((a) => {
        setAccount(a)
        if (a) {
          void fetchTenantName().then(setTenantName)
          // Restore the last scan so nobody re-scans just to look around.
          void loadSnapshotRecord<{ snapshot: TenantSnapshot; at: string }>(a.tenantId).then((stored) => {
            if (stored?.snapshot) setLastScan({ snapshot: stored.snapshot, at: stored.at })
          })
          // A blocked store shows as a plain sentence, never as a silently empty app.
          void probeStorage().catch((e: unknown) => setAuthError(e instanceof Error ? e.message : String(e)))
          // Saved Setup answers drive the stepper before Setup is opened.
          void loadMappingState(a.tenantId).then((m) => setMapProgress(wizardProgress(m)))
          // The loaded baseline comes back too (prompt 14 §6): pinned index by
          // commit, or the uploaded files themselves.
          void loadBaselineRecord<BaselineResult['origin']>(a.tenantId).then(async (origin) => {
            if (!origin) return
            try {
              setBaseline(await restoreBaseline(origin))
            } catch (e) {
              // Say so on the Baseline step rather than silently offering the load again.
              setBaselineRestoreError(e instanceof Error ? e.message : String(e))
            }
          })
        }
      })
      .catch((e: unknown) => setAuthError(e instanceof Error ? e.message : String(e)))
      .finally(() => setReady(true))
  }, [])

  const stepStatus: Partial<Record<Route, StepStatus>> = computeStepStatus({
    visitedStart,
    signedIn: account !== null,
    baselineLoaded: baseline !== null,
    scanRunning,
    hasSnapshot: lastScan !== null,
    setup: mapProgress ? { answered: mapProgress.answered, requiredMissing: mapProgress.requiredMissing } : null,
  })

  return (
    <AppShell account={account} tenantName={tenantName} route={route} stepStatus={stepStatus}>
      {!ready ? (
        SHELL.loading
      ) : (
        <ErrorBoundary key={route} route={route}>
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
          {route === 'baseline' && (
            <BaselinePage
              result={baseline}
              restoreError={baselineRestoreError}
              scan={lastScan}
              onLoaded={(r) => {
                setBaseline(r)
                if (account) void saveBaselineRecord(account.tenantId, r.origin)
              }}
            />
          )}
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
                <h2>{route === 'inventory' ? SHELL.steps.inventory : SHELL.steps.scan}</h2>
                <p>
                  {route === 'inventory' ? SHELL.inventoryNeedsConnect : SHELL.scanNeedsConnect} <a href="#/connect">{SHELL.connectLink}</a>
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
          {route === 'components' && import.meta.env.DEV && (
            <Suspense fallback={null}>
              <ComponentsPage />
            </Suspense>
          )}
          {DEV_PANEL && account && (
            <Suspense fallback={null}>
              <DevSpikes />
            </Suspense>
          )}
        </ErrorBoundary>
      )}
      <BackToTop />
    </AppShell>
  )
}
