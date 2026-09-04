import { Suspense, lazy, useEffect, useState } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import { initAuth } from '../graph/auth.ts'
import { fetchTenantName } from '../graph/organization.ts'
import { loadBaselineRecord, loadSnapshotRecord, saveBaselineRecord, saveGroupMembersCache, loadPlanRecord, savePlanRecord } from '../graph/collect/cache.ts'
import { coreGaps, unreadSources } from '../graph/collect/coreSections.ts'
import { GLOBAL_ADMINISTRATOR } from '../graph/collect/tokenRoles.ts'
import { authErrorOf, classifyAuthError } from '../graph/authError.ts'
import type { SignInError } from '../graph/authError.ts'
import { planIdFor } from '../roadmap/generate.ts'
import { AppShell, PLAN_HREF, useHashRoute } from './shell/AppShell.tsx'
import { Callout, ErrorBoundary } from './components/index.ts'
import { learnRoleNames } from '../roles.ts'
import type { ShellState } from './shell/AppShell.tsx'
import { Connect } from './surfaces/Connect.tsx'
import type { BaselineUpdate } from './scan/connectView.ts'
import type { ScanRecord } from './scan/scanRecord.ts'
import { loadPinnedBaseline, restoreBaseline } from './baseline.ts'
import type { BaselineResult } from './baseline.ts'
import { Plan } from './surfaces/Plan.tsx'
import { Today } from './surfaces/Today.tsx'
import { IDLE_SCAN, setScan, setSession, useSession } from './session.ts'
// The surfaces a first visit does not open arrive on demand (prompt 53 queue
// item 8): Export carries the print and every exporter, Inventory its tables,
// How its endpoint tables. Plan, Today and Connect stay in the first chunk.
const Export = lazy(() => import('./surfaces/Export.tsx').then((m) => ({ default: m.Export })))
const How = lazy(() => import('./surfaces/How.tsx').then((m) => ({ default: m.How })))
const Inventory = lazy(() => import('./surfaces/Inventory.tsx').then((m) => ({ default: m.Inventory })))
import { INVENTORY } from '../copy/inventory.ts'

// Dev-only modules. The lazy import is itself inside an import.meta.env.DEV
// branch, so in a production build the condition folds to false, the dynamic
// import is unreachable, and Rollup emits no chunk for it at all. Lazy alone was
// not enough: it still emitted DevSpikes-*.js as a publicly fetchable file
// carrying the Graph probe harness (audit egress-04, supply-08).
const DevSpikes = import.meta.env.DEV
  ? lazy(() => import('./DevSpikes.tsx').then((m) => ({ default: m.DevSpikes })))
  : () => null
import { app, pages } from '../content/content.ts'
import { DEMO_TENANT_ID, isDemo } from './demoMode.ts'
import { saveMappingState } from '../mapping/store.ts'
import { probeStorage } from '../graph/collect/cache.ts'

const DEV_PANEL =
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === '1'

/** The mock's ?crash=1: throws while drawing, inside the page's error boundary. */
function MockCrash(): never {
  throw new Error('mock crash (?crash=1)')
}
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
  // The session (ui/session.ts): who is signed in, the stored scan, the scan in
  // flight. ui/actions.ts changes it from any page's button; this reads it.
  const { account, tenantName, lastScan, scan, demoWeek2 } = useSession()
  const [ready, setReady] = useState(false)
  // A sign-in that returned an error, classified (graph/authError.ts): Connect's first tile shows one of three states from it.
  const [authError, setAuthError] = useState<SignInError | null>(null)
  const [baseline, setBaseline] = useState<BaselineResult | null>(null)
  const [baselineRestoreError, setBaselineRestoreError] = useState<string | null>(null)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  // Test support (dev builds, ?author=1): an author update over the pinned package, no network.
  const [mockAuthorUpdate, setMockAuthorUpdate] = useState<BaselineUpdate | null>(null)
  useEffect(() => {
    if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get('author') !== '1') return
    void import('../testing/authorUpdate.ts').then((m) => setMockAuthorUpdate(m.mockAuthorUpdate()))
  }, [])
  // ?crash=1 (the mock only): a surface that throws while drawing, so the error
  // page can be reached by the walk and the smoke.
  const [mockCrash, setMockCrash] = useState(false)
  const route = useHashRoute()
  // Role names the scan carries ($expand=roleDefinition) resolve ids the bundled catalogue lacks.
  useEffect(() => {
    if (lastScan) learnRoleNames(lastScan.snapshot.config.roleAssignments?.rows ?? [])
  }, [lastScan])
  useEffect(() => {
    if (DEMO) {
      // Two demo loads can be in flight (day one, then week two on a quick
      // Re-scan); only the latest may land, or the earlier one finishing last
      // would leave day one's plan under week two's banner.
      let stale = false
      void import('./demo.ts').then(async ({ demoTenant }) => {
        const d = demoTenant(demoWeek2)
        if (stale) return
        // Seed the Setup answers, or the Roadmap has nothing to compute from and
        // renders empty: the demo would show a stranger a blank page, which is
        // worse than not offering it. Written under the demo tenant id, so it
        // cannot land on a real tenant's keys.
        await saveMappingState(d.mapping)
        // Seed the exclusion and target group members so coverage resolves each
        // policy's scope; without them every excluding policy reads as not in
        // place and the demo shows one step in place instead of five, and a
        // re-scan cannot raise the count (prompt 50.1 item 5). Under the demo
        // tenant id, so it cannot land on a real tenant's keys.
        await Promise.all(
          [...d.groups].map(([groupId, g]) =>
            saveGroupMembersCache({ tenantId: DEMO_TENANT_ID, groupId, displayName: g.displayName ?? null, membershipRule: null, mailEnabled: false, memberCount: g.memberCount, memberIds: g.memberIds, sampled: g.sampled, asOf: d.snapshot.asOf }),
          ),
        )
        // Week two carries the decisions the sample's technician made in week
        // one (the fixture's), so every answer's effect shows on the plan. A
        // decision the visitor saved themselves wins over the sample's.
        // The checkpoints its technician recorded travel the same way (the
        // emergency access drill, E3), once each, beside the visitor's own.
        if (d.decisions || d.checkpoints) {
          const rec: Record<string, unknown> & { stepDecisions?: Record<string, unknown>; checkpoints?: unknown[] } = (await loadPlanRecord<Record<string, unknown> & { stepDecisions?: Record<string, unknown>; checkpoints?: unknown[] }>(DEMO_TENANT_ID)) ?? { planId: planIdFor(DEMO_TENANT_ID), skips: {}, checkpoints: [] }
          const have = new Set((rec.checkpoints ?? []).map((c: unknown) => JSON.stringify(c)))
          const seeded = (d.checkpoints ?? []).filter((c: unknown) => !have.has(JSON.stringify(c)))
          await savePlanRecord(DEMO_TENANT_ID, { ...rec, stepDecisions: { ...(d.decisions ?? {}), ...(rec.stepDecisions ?? {}) }, checkpoints: [...(rec.checkpoints ?? []), ...seeded] })
        }
        if (stale) return
        // The sample org's own name; the banner, not the tenant name, tells a
        // visitor it is sample data (prompt 50 item 12).
        setSession({
          account: {
            homeAccountId: 'demo',
            environment: 'login.windows.net',
            tenantId: DEMO_TENANT_ID,
            username: 'sample.admin@sample-tenant.example',
            localAccountId: d.operatorId,
            name: 'Sample Admin',
          } as AccountInfo,
          tenantName: 'Contoso Pty Ltd',
          lastScan: { snapshot: d.snapshot, at: d.snapshot.asOf },
        })
        // The scan has landed: back to the page that asked for it, reopened on the new plan (ui/actions.ts scan).
        const returnTo = scan.returnTo
        if (returnTo) {
          setScan({ returnTo: null })
          window.location.hash = returnTo
        }
        // The demo derives through the product's pinned baseline and goal map
        // (walk-51 item 9); the fixture's package is that same one.
        setBaseline(await loadPinnedBaseline())
        setReady(true)
      })
      return () => {
        stale = true
      }
    }
    if (MOCK) {
      // The dev-only contract walk and failure-path checks run against a
      // calibrated synthetic tenant (test support); the demo (?demo=1) is what
      // loads the demo fixture through the same App snapshot-setting path.
      void Promise.all([import('../testing/uiSnapshot.ts'), import('../testing/bigFixture.ts'), import('../testing/gapsFixture.ts')]).then(([{ fixtureSnapshot, fixtureBaseline }, { bigFixtureSnapshot }, { gapsSnapshot, mockAuthError, noRolesToken, tokenWithRoles }]) => {
        const params = new URLSearchParams(window.location.search)
        if (params.get('crash') === '1') setMockCrash(true)
        const snapshot = params.get('big') === '1' ? bigFixtureSnapshot() : fixtureSnapshot()
        // ?operatorDormant=1: the signed-in account's directory sign-in is stale
        // and it has no sign-in records of its own: a person like any other
        // (derive/operator.ts is display only), so Today reads it not active.
        if (params.get('operatorDormant') === '1') {
          const me = snapshot.users.find((u) => u.id === 'u-1')
          if (me) me.lastSuccessfulSignIn = new Date(Date.parse(snapshot.asOf) - 200 * 86_400_000).toISOString()
          delete snapshot.signInEvidence['u-1']
        }
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
        // The mock's token: a Global Administrator, or with ?roles=none the User
        // role and nothing else, so the scan must not start and Connect says so.
        setSession({ getToken: async () => (params.get('roles') === 'none' ? noRolesToken() : tokenWithRoles([GLOBAL_ADMINISTRATOR])) })
        // ?policies=0: a tenant with no Conditional Access policies at all (prompt 31 §4.19).
        if (params.get('policies') === '0') snapshot.config.caPolicies = { status: 'ok', reason: null, rows: [] }
        // ?state=<signedOut|noScan|scanning|scanned>: which state the synthetic
        // tenant is in (prompt 46 Part 1 item 2). The contract reaches each
        // surface in a named state, and the inventory has to be able to put the
        // app there without a sign-in or a worker. 'scanned' is the default
        // and today's behaviour.
        const state = params.get('state') ?? 'scanned'
        if (state === 'signedOut') {
          // ?auth=consent|personal|cancelled: tile 1 after a sign-in that did not succeed.
          const auth = params.get('auth')
          if (auth) setAuthError(classifyAuthError(mockAuthError(auth)))
          setReady(true)
          return
        }
        setSession({
          account: {
            homeAccountId: 'mock',
            environment: 'login.windows.net',
            tenantId: snapshot.tenantId,
            username: 'alex@example.com',
            localAccountId: 'u-1',
            name: 'Alex Morgan',
          } as AccountInfo,
          tenantName: 'Contoso Pty Ltd',
        })
        setBaseline(fixtureBaseline())
        if (state === 'scanning') {
          // A scan frozen two lanes in (configuration read, people in progress),
          // for the 'scanning' mock state (prompt 46 Part 1 item 2): the progress
          // view is otherwise unreachable by a harness, as it lasts as long as
          // the worker takes, and the synthetic tenant has no worker.
          setScan({
            ...IDLE_SCAN,
            state: 'running',
            startedAt: Date.now(),
            nowTick: Date.now(),
            sections: {
              'config:caPolicies': { source: 'config:caPolicies', status: 'ok', rows: 3, ms: 412 },
              'config:namedLocations': { source: 'config:namedLocations', status: 'ok', rows: 2, ms: 205 },
              users: { source: 'users', status: 'started' },
            },
          })
        } else if (state === 'gaps') {
          // A scan that could not read the policies or the sign-in records just
          // finished; the last good scan is kept, as its record would be.
          const finished = gapsSnapshot()
          setSession({ lastScan: { snapshot, at: snapshot.asOf } })
          setScan({ ...IDLE_SCAN, state: 'done', gaps: coreGaps(finished), unread: unreadSources(finished) })
        } else if (state === 'scanned') {
          setSession({ lastScan: { snapshot, at: snapshot.asOf } })
        }
        setReady(true)
      })
      return
    }
    initAuth()
      .then(async (a) => {
        setSession({ account: a })
        if (a) {
          void fetchTenantName().then((name) => setSession({ tenantName: name }))
          // Restore the last scan so nobody re-scans just to look around. Where
          // the app lands depends on it (target-state §2: a scanned tenant
          // lands on Plan), so the shell waits for the record before drawing.
          const stored = await loadSnapshotRecord<ScanRecord>(a.tenantId).catch(() => null)
          if (stored?.snapshot) setSession({ lastScan: { snapshot: stored.snapshot, at: stored.at } })
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
      .catch((e: unknown) => setAuthError(classifyAuthError(authErrorOf(e))))
      .finally(() => setReady(true))
    // Re-runs only for the demo (demoWeek2 toggles); the real auth path runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoWeek2])

  // The shell's state (target-state §2): signed out, signed in with no scan,
  // scanning, or scanned. It decides the tabs and where an empty hash lands.
  const scanning = scan.state === 'running' || scan.state === 'paused'
  const shellState: ShellState = !account ? 'signedOut' : scanning ? 'scanning' : lastScan ? 'scanned' : 'noScan'
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
      snapshot={lastScan?.snapshot ?? null}
      demoWeek2={demoWeek2}
    >
      {!ready ? (
        app.shell.loading
      ) : (
        <ErrorBoundary key={route} route={route}>
          {mockCrash && <MockCrash />}
          {storageWarning && <Callout kind="warning" title={app.shell.storageBlocked}>{storageWarning}</Callout>}
          {route === 'connect' && (
            <Connect
              account={account}
              tenantName={tenantName}
              authError={authError}
              baseline={baseline}
              baselineRestoreError={baselineRestoreError}
              onBaseline={(r) => {
                setBaseline(r)
                setBaselineRestoreError(null)
                if (account) void saveBaselineRecord(account.tenantId, r.origin)
              }}
              lastScan={lastScan}
              authorUpdate={mockAuthorUpdate}
            />
          )}
          {(route === 'today' || route === 'inventory') &&
            (account && lastScan ? (
              route === 'today' ? (
                <Today snapshot={lastScan.snapshot} />
              ) : (
                <Suspense fallback={<section className="surface"><p className="reason">{app.shell.loading}</p></section>}>
                  <Inventory snapshot={lastScan.snapshot} />
                </Suspense>
              )
            ) : (
              <section className="surface">
                <h1>{route === 'inventory' ? INVENTORY.heading : (pages.today as { h1: string }).h1}</h1>
                <p>
                  {account ? app.today.needsScan : app.shell.scanNeedsConnect} <a href="#/connect">{account ? app.today.scanLink : app.shell.connectLink}</a>
                </p>
              </section>
            ))}
          {route === 'plan' && <Plan scan={lastScan} baseline={baseline} account={account} />}
          {route === 'export' && (
            <Suspense fallback={<section className="surface"><p className="reason">{app.shell.loading}</p></section>}>
              <Export scan={lastScan} baseline={baseline} account={account} />
            </Suspense>
          )}
          {route === 'how' && (
            <Suspense fallback={<section className="surface"><p className="reason">{app.shell.loading}</p></section>}>
              <How />
            </Suspense>
          )}
          {DEV_PANEL && account && (
            <Suspense fallback={null}>
              <DevSpikes tenantId={account.tenantId} />
            </Suspense>
          )}
        </ErrorBoundary>
      )}
    </AppShell>
  )
}
