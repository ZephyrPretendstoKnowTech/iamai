import { Suspense, lazy, useEffect, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import { initAuth } from '../graph/msal.ts'
import { fetchTenantName } from '../graph/organization.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { loadBaselineRecord, loadSnapshotRecord, saveBaselineRecord, saveSnapshotRecord } from '../graph/collect/cache.ts'
import { AppShell, useHashRoute } from './shell/AppShell.tsx'
import { BackToTop, Callout, ErrorBoundary } from './components/index.ts'
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
import { ChecksPage } from './pages/ChecksPage.tsx'
import { NamingPage } from './pages/NamingPage.tsx'
import { RecoveryCard } from './pages/RecoveryCard.tsx'
import { WhatIamaiReads } from './WhatIamaiReads.tsx'
import { PackagePage } from './pages/PackagePage.tsx'

// Dev-only modules. The lazy import is itself inside an import.meta.env.DEV
// branch, so in a production build the condition folds to false, the dynamic
// import is unreachable, and Rollup emits no chunk for it at all. Lazy alone was
// not enough: it still emitted DevSpikes-*.js as a publicly fetchable file
// carrying the Graph probe harness (audit egress-04, supply-08).
const DevSpikes = import.meta.env.DEV
  ? lazy(() => import('./DevSpikes.tsx').then((m) => ({ default: m.DevSpikes })))
  : () => null
const ComponentsPage = import.meta.env.DEV
  ? lazy(() => import('./pages/ComponentsPage.tsx').then((m) => ({ default: m.ComponentsPage })))
  : () => null
import { SHELL } from '../copy/pages.ts'
import { isDemo } from './demo.ts'
import { computeStepStatus } from './stepStatus.ts'
import { activeWizardQuestions, wizardProgress } from '../mapping/wizard.ts'
import type { WizardProgress } from '../mapping/wizard.ts'
import { loadMappingState, saveMappingState } from '../mapping/store.ts'
import { detectAssumptions } from './detectAssumptions.ts'
import { probeStorage } from '../graph/collect/cache.ts'

const DEV_PANEL =
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === '1'
// ?dev=1&mock=1: the smoke test's tenant (prompt 20 §10). A synthetic account,
// scan and baseline stand in for Graph so the walk from Start to Roadmap runs
// headless with no sign-in. Dev builds only; the fixture is loaded lazily so
// it never ships.
const MOCK = DEV_PANEL && new URLSearchParams(window.location.search).get('mock') === '1'
// Demo mode ships (prompt 45 Part 1). Unlike MOCK it is not gated on a dev
// build: the whole point is that a stranger can see the tool work before being
// asked to connect a production tenant. The fixture is synthetic, so shipping it
// exposes nothing; it is imported lazily so it costs nothing until asked for.
const DEMO = isDemo()

export function App() {
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [ready, setReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [baseline, setBaseline] = useState<BaselineResult | null>(null)
  const [baselineRestoreError, setBaselineRestoreError] = useState<string | null>(null)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  const [lastScan, setLastScan] = useState<{ snapshot: TenantSnapshot; at: string } | null>(null)
  const [scanRunning, setScanRunning] = useState(false)
  // A scan frozen mid-lane, for the 'scanning' mock state (prompt 46 Part 1
  // item 2). The progress view is otherwise unreachable by a harness: it lasts
  // as long as the worker takes, and the synthetic tenant has no worker.
  const [frozenScan, setFrozenScan] = useState<Record<string, { source: string; status: string; rows?: number; reason?: string; ms?: number }> | null>(null)
  const [mapProgress, setMapProgress] = useState<WizardProgress | null>(null)
  const route = useHashRoute()
  // Role names the scan carries ($expand=roleDefinition) resolve ids the bundled catalogue lacks.
  useEffect(() => {
    if (lastScan) learnRoleNames(lastScan.snapshot.config.roleAssignments?.rows ?? [])
  }, [lastScan])
  // Nothing is asked before the plan exists (target-state §5, prompt 46 item
  // 19): once a scan and a baseline are both here, every answer nobody has
  // given gets its detected default, saved under the tenant.
  useEffect(() => {
    if (!lastScan || !baseline?.pkg || !account) return
    let cancelled = false
    const { snapshot } = lastScan
    const pkg = baseline.pkg
    void detectAssumptions(account.tenantId, snapshot, pkg)
      .then((m) => {
        if (!cancelled) setMapProgress(wizardProgress(m, activeWizardQuestions(pkg, { snapshot, state: m })))
      })
      .catch(() => {
        // Detection is a convenience over a saved state; a failure leaves the saved state as it was.
      })
    return () => {
      cancelled = true
    }
  }, [lastScan, baseline, account])
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
    if (DEMO) {
      void import('./demo.ts').then(async ({ demoTenant, DEMO_TENANT_ID }) => {
        const d = demoTenant()
        // Seed the Setup answers, or the Roadmap has nothing to compute from and
        // renders empty: the demo would show a stranger a blank page, which is
        // worse than not offering it. Written under the demo tenant id, so it
        // cannot land on a real tenant's keys.
        await saveMappingState(d.mapping)
        setAccount({
          homeAccountId: 'demo',
          environment: 'login.windows.net',
          tenantId: DEMO_TENANT_ID,
          username: 'sample.admin@sample-tenant.example',
          localAccountId: d.operatorId,
          name: 'Sample Admin',
        } as AccountInfo)
        setTenantName('Sample Tenant (demo)')
        setLastScan({ snapshot: d.snapshot, at: d.snapshot.asOf })
        setBaseline({ source: 'sample baseline', pkg: d.baseline } as BaselineResult)
        setReady(true)
      })
      return
    }
    if (MOCK) {
      void Promise.all([import('./pages/fixtureSnapshot.ts'), import('./pages/bigFixture.ts')]).then(([{ fixtureSnapshot, fixtureBaseline }, { bigFixtureSnapshot }]) => {
        const params = new URLSearchParams(window.location.search)
        const snapshot = params.get('big') === '1' ? bigFixtureSnapshot() : fixtureSnapshot()
        // ?licence=free: the unlicensed tenant (prompt 31 §4.17): no P1, no sign-in records, no registration report.
        if (params.get('licence') === 'free') {
          for (const k of Object.keys(snapshot.capabilities) as (keyof typeof snapshot.capabilities)[]) snapshot.capabilities[k] = { enabled: false, seats: 0, consumed: 0 }
          snapshot.sources.signInEvidence = { status: 'disabled', coveredWindow: null, reason: 'needs Entra ID P1 or P2', asOf: snapshot.asOf }
          snapshot.sources.registrationDetails = { status: 'disabled', coveredWindow: null, reason: 'needs Entra ID P1 or P2', asOf: snapshot.asOf }
          snapshot.registrationDetails = []
          snapshot.signInEvidence = {}
          snapshot.evidencePolicyResults = []
          snapshot.evidenceUsage = null
          snapshot.evidenceAggregates = null
          snapshot.config.subscribedSkus = { status: 'ok', reason: null, rows: [] }
        }
        // ?denied=1: a sign-in with too little access (prompt 31 §4.18): Graph
        // refuses the sections this account's role does not reach.
        if (params.get('denied') === '1') {
          const refused = 'Insufficient privileges to complete the operation.'
          for (const key of ['roleAssignments', 'caPolicies', 'namedLocations'] as const) {
            snapshot.config[key] = { status: 'disabled', reason: refused, rows: [] }
          }
          snapshot.sources.signInEvidence = { status: 'disabled', coveredWindow: null, reason: refused, asOf: snapshot.asOf }
          snapshot.signInEvidence = {}
          snapshot.evidenceAggregates = null
        }
        // ?policies=0: a tenant with no Conditional Access policies at all (prompt 31 §4.19).
        if (params.get('policies') === '0') snapshot.config.caPolicies = { status: 'ok', reason: null, rows: [] }
        // ?state=<signedOut|noScan|scanning|scanned>: which state the synthetic
        // tenant is in (prompt 46 Part 1 item 2). The contract reaches each
        // surface in a named state, and the inventory has to be able to put the
        // app there without a sign-in or a worker. 'scanned' is the default
        // and today's behaviour.
        const state = params.get('state') ?? 'scanned'
        if (state === 'signedOut') {
          setReady(true)
          return
        }
        setAccount({
          homeAccountId: 'mock',
          environment: 'login.windows.net',
          tenantId: snapshot.tenantId,
          username: 'alex@example.com',
          localAccountId: 'u-1',
          name: 'Alex Morgan',
        } as AccountInfo)
        setTenantName('Contoso Pty Ltd')
        setBaseline(fixtureBaseline())
        if (state === 'scanning') {
          // Frozen two lanes in: configuration read, people in progress.
          setFrozenScan({
            caPolicies: { source: 'caPolicies', status: 'ok', rows: 3, ms: 412 },
            namedLocations: { source: 'namedLocations', status: 'ok', rows: 2, ms: 205 },
            users: { source: 'users', status: 'started' },
          })
          setScanRunning(true)
        } else if (state === 'scanned') {
          setLastScan({ snapshot, at: snapshot.asOf })
          void loadMappingState(snapshot.tenantId).then((m) => setMapProgress(wizardProgress(m, activeWizardQuestions(null, { snapshot, state: m }))))
        }
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
            // The stepper measures completeness against the questions this
            // tenant is asked, which needs the snapshot (prompt 37 §7).
            void loadMappingState(a.tenantId).then((m) => setMapProgress(wizardProgress(m, activeWizardQuestions(null, { snapshot: stored?.snapshot ?? null, state: m }))))
          })
          // A blocked store shows as a plain sentence, never as a silently empty app.
          void probeStorage().catch((e: unknown) => setStorageWarning(e instanceof Error ? e.message : String(e)))
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
    <AppShell account={account} tenantName={tenantName} route={route} stepStatus={stepStatus}
          snapshot={lastScan?.snapshot ?? null}>
      {!ready ? (
        SHELL.loading
      ) : (
        <ErrorBoundary key={route} route={route}>
          {authError && (
            <p className="error">
              {SHELL.signInError} {authError}
            </p>
          )}
          {storageWarning && <Callout kind="warning" title={SHELL.storageBlocked}>{storageWarning}</Callout>}
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
                frozen={frozenScan}
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
          {(route === 'roadmap' || route === 'roadmap/prompts') && (
            <RoadmapPage
              scan={lastScan}
              baseline={baseline}
              operator={account ? { userId: account.localAccountId, userPrincipalName: account.username } : null}
            />
          )}
          {route === 'licensing' && <LicensingPage scan={lastScan} />}
          {route === 'reads' && <WhatIamaiReads />}
          {route === 'checks' && <ChecksPage />}
      {route === 'naming' && <NamingPage scan={lastScan} />}
      {route === 'recovery' && <RecoveryCard scan={lastScan} />}
          {route === 'components' && import.meta.env.DEV && (
            <Suspense fallback={null}>
              <ComponentsPage />
            </Suspense>
          )}
          {DEV_PANEL && account && (
            <Suspense fallback={null}>
              <DevSpikes tenantId={account.tenantId} />
            </Suspense>
          )}
        </ErrorBoundary>
      )}
      <BackToTop />
    </AppShell>
  )
}
