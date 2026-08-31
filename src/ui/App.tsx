import { Suspense, lazy, useEffect, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import { initAuth } from '../graph/msal.ts'
import { fetchTenantName } from '../graph/organization.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { loadBaselineRecord, loadSnapshotRecord, saveBaselineRecord, saveSnapshotRecord } from '../graph/collect/cache.ts'
import { AppShell, PLAN_HREF, useHashRoute } from './shell/AppShell.tsx'
import { BackToTop, Callout, ErrorBoundary } from './components/index.ts'
import { learnRoleNames } from '../roles.ts'
import type { ShellState } from './shell/AppShell.tsx'
import { Connect } from './surfaces/Connect.tsx'
import { restoreBaseline } from './baseline.ts'
import type { BaselineResult } from './baseline.ts'
import { Plan } from './surfaces/Plan.tsx'
import { Export } from './surfaces/Export.tsx'
import { How } from './surfaces/How.tsx'
import { Today } from './surfaces/Today.tsx'
import { Inventory } from './surfaces/Inventory.tsx'
import { TODAY } from '../copy/today.ts'
import { INVENTORY } from '../copy/inventory.ts'
import { Recovery } from './surfaces/Recovery.tsx'

// Dev-only modules. The lazy import is itself inside an import.meta.env.DEV
// branch, so in a production build the condition folds to false, the dynamic
// import is unreachable, and Rollup emits no chunk for it at all. Lazy alone was
// not enough: it still emitted DevSpikes-*.js as a publicly fetchable file
// carrying the Graph probe harness (audit egress-04, supply-08).
const DevSpikes = import.meta.env.DEV
  ? lazy(() => import('./DevSpikes.tsx').then((m) => ({ default: m.DevSpikes })))
  : () => null
import { SHELL } from '../copy/pages.ts'
import { isDemo } from './demo.ts'
import { saveMappingState } from '../mapping/store.ts'
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
  // The header's Re-scan: Connect starts the scan as soon as it mounts, and
  // returns to Plan when it finishes (target-state §2).
  const [rescanRequested, setRescanRequested] = useState(false)
  // A scan frozen mid-lane, for the 'scanning' mock state (prompt 46 Part 1
  // item 2). The progress view is otherwise unreachable by a harness: it lasts
  // as long as the worker takes, and the synthetic tenant has no worker.
  const [frozenScan, setFrozenScan] = useState<Record<string, { source: string; status: string; rows?: number; reason?: string; ms?: number }> | null>(null)
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
    void detectAssumptions(account.tenantId, lastScan.snapshot, baseline.pkg).catch(() => {
      // Detection is a convenience over a saved state; a failure leaves the saved state as it was.
    })
  }, [lastScan, baseline, account])

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
      void Promise.all([import('./fixtures/fixtureSnapshot.ts'), import('./fixtures/bigFixture.ts')]).then(([{ fixtureSnapshot, fixtureBaseline }, { bigFixtureSnapshot }]) => {
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
            'config:caPolicies': { source: 'config:caPolicies', status: 'ok', rows: 3, ms: 412 },
            'config:namedLocations': { source: 'config:namedLocations', status: 'ok', rows: 2, ms: 205 },
            users: { source: 'users', status: 'started' },
          })
          setScanRunning(true)
        } else if (state === 'scanned') {
          setLastScan({ snapshot, at: snapshot.asOf })
        }
        setReady(true)
      })
      return
    }
    initAuth()
      .then(async (a) => {
        setAccount(a)
        if (a) {
          void fetchTenantName().then(setTenantName)
          // Restore the last scan so nobody re-scans just to look around. Where
          // the app lands depends on it (target-state §2: a scanned tenant
          // lands on Plan), so the shell waits for the record before drawing.
          const stored = await loadSnapshotRecord<{ snapshot: TenantSnapshot; at: string }>(a.tenantId).catch(() => null)
          if (stored?.snapshot) setLastScan({ snapshot: stored.snapshot, at: stored.at })
          // A blocked store shows as a plain sentence, never as a silently empty app.
          void probeStorage().catch((e: unknown) => setStorageWarning(e instanceof Error ? e.message : String(e)))
          // The loaded baseline comes back too (prompt 14 §6): pinned index by
          // commit, or the uploaded files themselves. Awaited, so Connect does
          // not load the default over a baseline that was about to be restored.
          const origin = await loadBaselineRecord<BaselineResult['origin']>(a.tenantId).catch(() => null)
          if (origin) {
            try {
              setBaseline(await restoreBaseline(origin))
            } catch (e) {
              // Connect says so and offers the choice again.
              setBaselineRestoreError(e instanceof Error ? e.message : String(e))
            }
          }
        }
      })
      .catch((e: unknown) => setAuthError(e instanceof Error ? e.message : String(e)))
      .finally(() => setReady(true))
  }, [])

  // The shell's state (target-state §2): signed out, signed in with no scan,
  // scanning, or scanned. It decides the tabs, the Re-scan control and where
  // an empty hash lands.
  const shellState: ShellState = !account ? 'signedOut' : scanRunning ? 'scanning' : lastScan ? 'scanned' : 'noScan'
  useEffect(() => {
    if (!ready) return
    if (route === 'home') {
      window.location.replace(shellState === 'scanned' ? PLAN_HREF : '#/connect')
      return
    }
    // Signed out, Connect is the page (target-state §2, prompt 48.1 item 17): a
    // gated route never renders its "connect first" placeholder.
    if (shellState === 'signedOut' && (route === 'plan' || route === 'today' || route === 'inventory')) {
      window.location.replace('#/connect')
    }
  }, [ready, route, shellState])

  return (
    <AppShell
      account={account}
      tenantName={tenantName}
      route={route}
      state={shellState}
      scannedAt={lastScan?.at ?? null}
      onRescan={() => {
        setRescanRequested(true)
        window.location.hash = '#/connect'
      }}
      snapshot={lastScan?.snapshot ?? null}
    >
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
          {route === 'connect' && (
            <Connect
              account={account}
              tenantName={tenantName}
              baseline={baseline}
              baselineRestoreError={baselineRestoreError}
              onBaseline={(r) => {
                setBaseline(r)
                setBaselineRestoreError(null)
                if (account) void saveBaselineRecord(account.tenantId, r.origin)
              }}
              lastScan={lastScan}
              frozen={frozenScan}
              onRunningChange={setScanRunning}
              onComplete={(snapshot, at) => {
                setLastScan({ snapshot, at })
                if (account) void saveSnapshotRecord(account.tenantId, { snapshot, at })
              }}
              autoScan={rescanRequested}
              onAutoScanConsumed={() => setRescanRequested(false)}
            />
          )}
          {(route === 'today' || route === 'inventory') &&
            (account && lastScan ? (
              route === 'today' ? (
                <Today snapshot={lastScan.snapshot} tenantId={account.tenantId} />
              ) : (
                <Inventory snapshot={lastScan.snapshot} />
              )
            ) : (
              <section className="surface">
                <h1>{route === 'inventory' ? INVENTORY.heading : TODAY.title}</h1>
                <p>
                  {account ? TODAY.needsScan : SHELL.scanNeedsConnect} <a href="#/connect">{account ? TODAY.scanLink : SHELL.connectLink}</a>
                </p>
              </section>
            ))}
          {route === 'plan' && <Plan scan={lastScan} baseline={baseline} account={account} />}
          {route === 'export' && <Export scan={lastScan} baseline={baseline} account={account} />}
          {route === 'how' && <How />}
      {route === 'recovery' && <Recovery scan={lastScan} />}
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
