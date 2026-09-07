// One action module (ui/actions.ts) over one session (ui/session.ts): sign-out
// from a state with no MSAL account still lands signed out with the session
// cleared; forget clears the store and the memory and stays signed in; a scan
// with nobody signed in reports where the scan shows and never rejects; the
// demo's scan is the week-two toggle; and every button on every surface
// reaches these functions, never the sign-in library, the store or the
// collector directly.
//
// The two trust actions are also held apart here (task 015). Sign out clears
// who is signed in and deletes nothing this device stored; Forget this tenant
// deletes what this device stored for the one tenant now signed in and leaves
// the operator signed in. Neither may quietly grow into the other, and neither
// may leave a fact about the tenant behind in memory for a page to keep
// drawing.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { AccountInfo } from '@azure/msal-browser'
import type { BaselineResult } from './baseline.ts'

// The actions read the page's hash and the demo switch from `window`; Node has none.
const fakeWindow = { location: { hash: '#/plan', search: '', href: 'http://localhost/' } }
;(globalThis as unknown as { window: unknown }).window = fakeWindow
const actions = await import('./actions.ts')
const { getSession, resetSession, setSession, setScan, IDLE_SCAN } = await import('./session.ts')

const account = { homeAccountId: 'x', environment: 'login.windows.net', tenantId: 't-1', username: 'a@example.com', localAccountId: 'u-1', name: 'A' } as AccountInfo
const record = { snapshot: { tenantId: 't-1' } as never, at: '2026-09-04T00:00:00.000Z' }
// A second tenant, signed in to from the same browser after the first.
const otherAccount = { homeAccountId: 'y', environment: 'login.windows.net', tenantId: 't-2', username: 'b@other.example', localAccountId: 'u-2', name: 'B' } as AccountInfo
const otherRecord = { snapshot: { tenantId: 't-2' } as never, at: '2026-09-05T00:00:00.000Z' }
// The operator's own uploaded package: their file, restored for this tenant
// from the tenant's stored choice, so it is one of the tenant's facts.
const uploaded = { source: 'Uploaded package', pkg: { policies: [] }, fetchFailures: 0, origin: { kind: 'upload', files: [] } } as unknown as BaselineResult

beforeEach(() => {
  resetSession()
  fakeWindow.location.hash = '#/plan'
  fakeWindow.location.search = ''
})

test('sign-out from a state with no MSAL account still lands signed out: the session cleared, Connect the page, the library asked to clear its cache once', async () => {
  let cleared = 0
  actions.authLib.signOut = async () => {
    cleared += 1
  }
  setSession({ account, tenantName: 'Contoso', lastScan: record })
  setScan({ ...IDLE_SCAN, state: 'running', startedAt: 1 })
  await actions.signOut()
  const s = getSession()
  assert.equal(s.account, null)
  assert.equal(s.tenantName, null)
  assert.equal(s.lastScan, null)
  assert.equal(s.scan.state, 'idle')
  assert.equal(fakeWindow.location.hash, '#/connect')
  assert.equal(cleared, 1)
})

test('a sign-out the library cannot finish still signs the app out, and the failure reaches the button', async () => {
  actions.authLib.signOut = async () => {
    throw new Error('logout redirect failed')
  }
  setSession({ account, lastScan: record })
  await assert.rejects(actions.signOut(), /logout redirect failed/)
  assert.equal(getSession().account, null, 'signed out all the same')
  assert.equal(fakeWindow.location.hash, '#/connect')
})

test('forget this tenant clears the stored records and the snapshot in memory, then shows Connect not scanned, still signed in', async () => {
  const forgotten: string[] = []
  actions.storeLib.forgetTenant = async (tenantId: string) => {
    forgotten.push(tenantId)
  }
  setSession({ account, tenantName: 'Contoso', lastScan: record, demoWeek2: true })
  await actions.forgetTenant()
  const s = getSession()
  assert.deepEqual(forgotten, ['t-1'])
  assert.equal(s.lastScan, null, 'the snapshot in memory is gone')
  assert.equal(s.demoWeek2, false)
  assert.equal(s.account, account, 'still signed in')
  assert.equal(fakeWindow.location.hash, '#/connect')
  // Nobody signed in: nothing to forget, and the button hears why.
  resetSession()
  await assert.rejects(actions.forgetTenant())
})

test('a store that cannot be cleared rejects, so the menu shows it; the snapshot stays', async () => {
  actions.storeLib.forgetTenant = async () => {
    throw new Error('store blocked')
  }
  setSession({ account, lastScan: record, baseline: uploaded })
  await assert.rejects(actions.forgetTenant(), /store blocked/)
  // A forget that failed must not read as one that worked: everything the app
  // held of the tenant is still held, because none of it was deleted.
  assert.equal(getSession().lastScan, record)
  assert.equal(getSession().baseline, uploaded)
  assert.equal(getSession().account, account)
})

test('a scan with nobody signed in never rejects: it reports where the scan shows', async () => {
  await actions.scan('#/today')
  const { scan } = getSession()
  assert.equal(scan.state, 'failed')
  assert.ok(scan.error && scan.error.length > 0)
  assert.equal(fakeWindow.location.hash, '#/plan', 'nowhere to go')
})

test("the demo's scan is the week-two snapshot and back, with where to return kept for the landing", async () => {
  fakeWindow.location.search = '?demo=1'
  setSession({ account })
  await actions.scan('#/plan/s-verify-mfa')
  assert.equal(getSession().demoWeek2, true)
  assert.equal(getSession().scan.returnTo, '#/plan/s-verify-mfa')
  await actions.scan(null)
  assert.equal(getSession().demoWeek2, false)
})

test('sign in and sign in with another account reach the library, and its failure reaches the button', async () => {
  const calls: string[] = []
  actions.authLib.signIn = async () => {
    calls.push('signIn')
  }
  actions.authLib.signInAnother = async () => {
    calls.push('another')
    throw new Error('picker blocked')
  }
  await actions.signIn()
  await assert.rejects(actions.signInAnother(), /picker blocked/)
  assert.deepEqual(calls, ['signIn', 'another'])
})

test('Sign out lets go of every fact about the tenant, and deletes nothing this device stored', async () => {
  const deleted: string[] = []
  let libSignOut = 0
  actions.authLib.signOut = async () => {
    libSignOut += 1
  }
  actions.storeLib.forgetTenant = async (tenantId: string) => {
    deleted.push(tenantId)
  }
  setSession({ account, tenantName: 'Contoso', lastScan: record, baseline: uploaded, baselineRestoreError: 'the stored package would not load' })
  await actions.signOut()
  const s = getSession()
  assert.equal(s.account, null, 'nobody is signed in')
  assert.equal(s.tenantName, null)
  assert.equal(s.lastScan, null)
  // The operator's own uploaded package is a fact about the tenant they just
  // left: the signed-out page draws the baseline tile, so leaving it in memory
  // would put their file under a page that says nobody is signed in.
  assert.equal(s.baseline, null, "the tenant's baseline is not still on the signed-out page")
  assert.equal(s.baselineRestoreError, null)
  assert.equal(s.scan.state, 'idle')
  assert.equal(libSignOut, 1, 'the library was asked to sign out')
  assert.deepEqual(deleted, [], 'Sign out is not Forget: nothing this device stored was deleted')
})

test('Forget this tenant deletes this tenant only, lets go of it in memory, and leaves the operator signed in', async () => {
  const deleted: string[] = []
  let libSignOut = 0
  actions.authLib.signOut = async () => {
    libSignOut += 1
  }
  actions.storeLib.forgetTenant = async (tenantId: string) => {
    deleted.push(tenantId)
  }
  setSession({ account, tenantName: 'Contoso', lastScan: record, baseline: uploaded, baselineRestoreError: 'the stored package would not load' })
  await actions.forgetTenant()
  const s = getSession()
  assert.deepEqual(deleted, ['t-1'], 'the tenant now signed in, by its own id, and no other')
  assert.equal(s.lastScan, null)
  // The stored baseline choice is one of the records forget deletes, so the
  // page may not go on showing the choice the device no longer remembers.
  assert.equal(s.baseline, null)
  assert.equal(s.baselineRestoreError, null)
  assert.equal(s.account, account, 'still signed in')
  assert.equal(s.tenantName, 'Contoso', 'still signed in to the same tenant')
  assert.equal(libSignOut, 0, 'Forget is not Sign out: the operator was not signed out')
})

test('Sign out and Forget this tenant stay two different actions: one clears who is signed in, the other deletes the records', async () => {
  const run = async (press: () => Promise<void>) => {
    const deleted: string[] = []
    let libSignOut = 0
    actions.authLib.signOut = async () => {
      libSignOut += 1
    }
    actions.storeLib.forgetTenant = async (tenantId: string) => {
      deleted.push(tenantId)
    }
    resetSession()
    setSession({ account, tenantName: 'Contoso', lastScan: record, baseline: uploaded })
    await press()
    return { deleted, libSignOut, signedIn: getSession().account !== null }
  }
  const out = await run(() => actions.signOut())
  const forget = await run(() => actions.forgetTenant())
  // This is the regression: if either action ever grows the other's mutation,
  // one of these three comparisons stops holding.
  assert.notEqual(out.signedIn, forget.signedIn, 'both actions left the same authentication state')
  assert.notDeepEqual(out.deleted, forget.deleted, 'both actions deleted the same stored records')
  assert.notEqual(out.libSignOut, forget.libSignOut, 'both actions asked the sign-in library the same thing')
  assert.equal(out.signedIn, false)
  assert.deepEqual(out.deleted, [])
  assert.equal(forget.signedIn, true)
  assert.deepEqual(forget.deleted, ['t-1'])
})

test('Forget names the tenant signed in now, never one signed in before it: tenant A, then tenant B', async () => {
  const deleted: string[] = []
  actions.storeLib.forgetTenant = async (tenantId: string) => {
    deleted.push(tenantId)
  }
  setSession({ account, tenantName: 'Contoso', lastScan: record })
  await actions.forgetTenant()
  assert.deepEqual(deleted, ['t-1'])
  // The same browser, the other tenant. Its forget carries its own id, so
  // tenant A's records are not named a second time and tenant B's are not
  // deleted under A's id.
  setSession({ account: otherAccount, tenantName: 'Fabrikam', lastScan: otherRecord })
  await actions.forgetTenant()
  assert.deepEqual(deleted, ['t-1', 't-2'])
  assert.equal(getSession().account, otherAccount, 'still signed in to tenant B')
})

test('after either action the session holds nothing of the tenant, so no selector can still call it the current one', async () => {
  actions.authLib.signOut = async () => {}
  actions.storeLib.forgetTenant = async () => {}
  const held = (): unknown[] => {
    const s = getSession()
    return [s.lastScan, s.baseline, s.baselineRestoreError, s.scan.error, s.scan.roleGap, s.scan.returnTo]
  }
  setSession({ account, tenantName: 'Contoso', lastScan: record, baseline: uploaded, baselineRestoreError: 'stale' })
  setScan({ ...IDLE_SCAN, state: 'failed', error: 'a scan that failed', returnTo: '#/plan/s-one' })
  await actions.signOut()
  assert.deepEqual(held(), [null, null, null, null, null, null], 'Sign out left a tenant fact in memory')
  assert.equal(getSession().account, null)

  setSession({ account, tenantName: 'Contoso', lastScan: record, baseline: uploaded, baselineRestoreError: 'stale' })
  setScan({ ...IDLE_SCAN, state: 'failed', error: 'a scan that failed', returnTo: '#/plan/s-one' })
  await actions.forgetTenant()
  assert.deepEqual(held(), [null, null, null, null, null, null], 'Forget left a tenant fact in memory')
  assert.equal(getSession().account, account, 'and left the operator signed in')
})

test('the scan stores what it read under the signed-in tenant, and returns only where it was asked to', () => {
  const src = readFileSync('src/ui/actions.ts', 'utf8')
  // One tenant id, read from the account the scan ran for: a snapshot cannot be
  // filed under a tenant other than the one it was collected from.
  assert.match(src, /handle = startScan\(account\.tenantId,/)
  assert.match(src, /storeLib\.saveSnapshotRecord\(account\.tenantId, record\)/)
  assert.doesNotMatch(src, /saveSnapshotRecord\((?!account\.tenantId)/, 'a snapshot is saved under some other tenant id')
  // A scan asked for from Connect's first tile passes null and the page stays
  // where it is; every other caller names the page it wants back.
  assert.match(src, /if \(returnTo !== null\) go\(afterScanHref\(returnTo\)\)/)
})

/** Every non-test source file under a directory. */
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) sources(p, out)
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p.replace(/\\/g, '/'))
  }
  return out
}

test('each action from each location reaches the same function: the surfaces import ui/actions.ts and nothing under src/ui but it touches the library, the store or the collector', () => {
  const SITES = ['src/ui/shell/AppShell.tsx', 'src/ui/surfaces/Connect.tsx', 'src/ui/surfaces/MfaReadiness.tsx', 'src/ui/surfaces/Plan.tsx', 'src/ui/scan/ScanProgress.tsx']
  for (const file of SITES) {
    const src = readFileSync(file, 'utf8')
    assert.match(src, /from '(\.\.\/)+actions\.ts'|from '\.\/actions\.ts'/, `${file} imports the action module`)
  }
  // The steps' Scan to update the plan is the Plan's handler, which is the action.
  assert.match(readFileSync('src/ui/surfaces/Plan.tsx', 'utf8'), /runScan\(returnTo\)/, "the Plan's onScan is the one scan action")
  for (const file of ['src/ui/surfaces/ContentStep.tsx', 'src/ui/surfaces/CleanupStep.tsx']) assert.match(readFileSync(file, 'utf8'), /onClick=\{onScan\}/, `${file} calls the handler it was given`)
  // The header menu's two buttons, Connect's tile buttons and Today's Scan again call the actions by name.
  assert.match(readFileSync('src/ui/shell/AppShell.tsx', 'utf8'), /run\(signOut\(\)\)[\s\S]*run\(forgetTenant\(\)\)/)
  assert.match(readFileSync('src/ui/surfaces/Connect.tsx', 'utf8'), /run\(signInAnother\(\)\)[\s\S]*run\(signOut\(\)\)/)
  assert.match(readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8'), /run\(scan\(readinessHref\(show\)\)\)/)
  for (const file of sources('src/ui')) {
    if (file.endsWith('src/ui/actions.ts')) continue
    const src = readFileSync(file, 'utf8')
    assert.doesNotMatch(src, /import \{[^}]*\b(signIn|signInAnother|signOut)\b[^}]*\} from '[./]*\/graph\/auth\.ts'/, `${file} signs in or out through the library, not the action`)
    assert.doesNotMatch(src, /import \{[^}]*\bforgetTenant\b[^}]*\} from '[./]*\/graph\/collect\/cache\.ts'/, `${file} forgets through the store, not the action`)
    assert.doesNotMatch(src, /\bstartScan\b/, `${file} starts the collector itself`)
  }
  // No handler swallows: the surfaces' buttons run through useAction, which renders the rejection.
  for (const file of SITES) assert.doesNotMatch(readFileSync(file, 'utf8'), /void (signOut|signIn|signInAnother|forgetTenant)\(\)/, `${file} fires an action and drops its failure`)
})


// Work in flight when a trust action lands (task 015 correction). Reading a
// baseline takes time — the pinned package is fetched, an uploaded one is read
// off the operator's disk — and Sign out or Forget this tenant may land while
// it is still being read. The read belongs to the tenant's turn (ui/session.ts);
// once the turn is over the result is applied to nothing and stored nowhere, so
// what is on screen and what this device remembers cannot contradict a trust
// action that finished. A tenant id could not decide this: Forget this tenant
// leaves the same tenant signed in.

/** A read the test finishes when it chooses, so the interleaving is exact and not a timer. */
function deferred<T>(): { promise: Promise<T>; settle: (v: T) => void; fail: (e: Error) => void } {
  let settle!: (v: T) => void
  let fail!: (e: Error) => void
  const promise = new Promise<T>((res, rej) => {
    settle = res
    fail = rej
  })
  return { promise, settle, fail }
}

/** The author's pinned package, as a read returns it. */
const pinnedResult = { source: 'Pinned package', pkg: { policies: [] }, fetchFailures: 0, origin: { kind: 'github', owner: 'a', repo: 'b', commit: 'c', files: [] } } as unknown as BaselineResult

test('a baseline still being read when Sign out lands never comes back: it is applied to nothing and recorded nowhere', async () => {
  const saved: string[] = []
  actions.authLib.signOut = async () => {}
  actions.storeLib.saveBaselineRecord = async (tenantId: string) => {
    saved.push(tenantId)
  }
  setSession({ account, tenantName: 'Contoso', baseline: uploaded })
  const read = deferred<BaselineResult>()
  const choosing = actions.chooseBaseline(() => read.promise, true)
  await actions.signOut()
  assert.equal(getSession().baseline, null, 'Sign out left the baseline on screen')
  // The package arrives after the operator has signed out.
  read.settle(pinnedResult)
  await choosing
  assert.equal(getSession().baseline, null, 'a late read put a signed-out tenant\'s baseline back')
  assert.deepEqual(saved, [], 'a late read recorded a baseline for a tenant nobody is signed in to')
})

test('a baseline still being read when Forget this tenant lands writes no row back under the forgotten tenant, and another tenant keeps its own', async () => {
  const rows = new Map<string, unknown>([
    ['t-1', { kind: 'upload' }],
    ['t-2', { kind: 'github' }],
  ])
  actions.storeLib.forgetTenant = async (tenantId: string) => {
    rows.delete(tenantId)
  }
  actions.storeLib.saveBaselineRecord = async (tenantId: string, value: Record<string, unknown>) => {
    rows.set(tenantId, value)
  }
  setSession({ account, tenantName: 'Contoso', lastScan: record, baseline: uploaded })
  const read = deferred<BaselineResult>()
  const choosing = actions.chooseBaseline(() => read.promise, true)
  await actions.forgetTenant()
  assert.equal(getSession().baseline, null)
  assert.equal(getSession().account, account, 'Forget this tenant signed the operator out')
  read.settle(pinnedResult)
  await choosing
  assert.equal(rows.has('t-1'), false, 'a late read recreated the forgotten tenant\'s baseline row')
  assert.equal(getSession().baseline, null, 'a late read put the forgotten baseline back on screen')
  assert.equal(rows.has('t-2'), true, 'another tenant\'s baseline row was touched')
})

test('a baseline row already being written when Forget this tenant lands does not outlive the delete', async () => {
  const rows = new Map<string, unknown>([['t-2', { kind: 'github' }]])
  const write = deferred<void>()
  actions.storeLib.forgetTenant = async (tenantId: string) => {
    rows.delete(tenantId)
  }
  actions.storeLib.saveBaselineRecord = async (tenantId: string, value: Record<string, unknown>) => {
    await write.promise
    rows.set(tenantId, value)
  }
  setSession({ account, tenantName: 'Contoso', baseline: null })
  await actions.chooseBaseline(async () => pinnedResult, true)
  const forgetting = actions.forgetTenant()
  // The row lands in the store while the forget is under way; the delete waits
  // for it, so the tenant is left with nothing either way round.
  write.settle()
  await forgetting
  assert.equal(rows.has('t-1'), false, 'the row written mid-forget outlived the delete')
  assert.equal(rows.has('t-2'), true)
})

test('with nobody letting go of the tenant a read still lands: the baseline renders, and a pick is recorded once', async () => {
  const saved: [string, unknown][] = []
  actions.storeLib.saveBaselineRecord = async (tenantId: string, value: Record<string, unknown>) => {
    saved.push([tenantId, value])
  }
  setSession({ account, tenantName: 'Contoso', baselineRestoreError: 'an older failure' })
  await actions.chooseBaseline(async () => pinnedResult, true)
  assert.equal(getSession().baseline, pinnedResult)
  assert.equal(getSession().baselineRestoreError, null)
  assert.deepEqual(saved, [['t-1', pinnedResult.origin]])
  // The default tile 2 loads for itself is not a pick, so nothing more is written.
  await actions.chooseBaseline(async () => pinnedResult, false)
  assert.equal(saved.length, 1)
})

test('a stored baseline choice that cannot be rebuilt is reported, unless the tenant was let go of while it was being rebuilt', async () => {
  actions.authLib.signOut = async () => {}
  const first = deferred<BaselineResult>()
  actions.baselineLib.restoreBaseline = async () => first.promise
  setSession({ account, tenantName: 'Contoso' })
  const restoring = actions.restoreChosenBaseline({ kind: 'upload', files: [] } as unknown as BaselineResult['origin'])
  await actions.signOut()
  first.fail(new Error('the package could not be rebuilt'))
  await restoring
  assert.equal(getSession().baselineRestoreError, null, 'a signed-out page was told about a tenant it no longer has')
  // Signed in and nobody letting go: the same failure is what Connect reads.
  const second = deferred<BaselineResult>()
  actions.baselineLib.restoreBaseline = async () => second.promise
  setSession({ account })
  const again = actions.restoreChosenBaseline({ kind: 'upload', files: [] } as unknown as BaselineResult['origin'])
  second.fail(new Error('the package could not be rebuilt'))
  await again
  assert.equal(getSession().baselineRestoreError, 'the package could not be rebuilt')
})

test('the tenant\'s turn is ended by the two trust actions and by nothing else, and the scan lands only in the turn it began in', () => {
  const src = readFileSync('src/ui/actions.ts', 'utf8')
  const ends = src.match(/endTenantTurn\(\)/g) ?? []
  assert.equal(ends.length, 2, 'the turn is ended somewhere other than Sign out and Forget this tenant')
  assert.match(src, /stopScan\(\)\n  endTenantTurn\(\)\n  setSession\(\{ account: null/, 'Sign out no longer ends the turn before it clears the session')
  assert.match(src, /endTenantTurn\(\)\n  await baselineSave\.catch\(\(\) => \{\}\)\n  await storeLib\.forgetTenant\(account\.tenantId\)/, 'Forget deletes before it ends the turn, or without waiting for a write it must supersede')
  assert.match(src, /const result = await handle\.done[\s\S]*?if \(!stillThisTurn\(turn\)\) return/, 'a scan that finished after a trust action still lands')
  // Only the action module ends a turn: no surface may decide that for itself.
  for (const file of sources('src/ui')) {
    if (file.endsWith('src/ui/actions.ts') || file.endsWith('src/ui/session.ts')) continue
    assert.doesNotMatch(readFileSync(file, 'utf8'), /endTenantTurn/, `${file} ends the tenant's turn outside the action module`)
  }
})


// Sign-in restoration, interrupted (task 015 correction 3). Restoring a session
// is four reads about one tenant — its name from the directory, its stored scan,
// its stored baseline choice, and the package that choice names — and any of
// them can still be in flight when the operator lets the tenant go. Each read is
// bound to the turn the account was adopted in, so a trust action cancels the
// ones that have not landed and the ones that have not started: what comes back
// afterwards belongs to nobody and is applied to nothing. Without that binding
// the last read was the worst of them, because it began after the Sign out and
// so began in a turn that had not ended — an uploaded package the operator had
// let go of, drawn on the signed-out Connect.

/** The four reads a restoration makes, each finished by the test when it chooses. */
function hydration() {
  const name = deferred<string | null>()
  const snapshot = deferred<{ snapshot: unknown; at: string } | null>()
  const origin = deferred<unknown>()
  const pkg = deferred<BaselineResult>()
  actions.tenantLib.fetchTenantName = () => name.promise
  actions.storeLib.loadSnapshotRecord = (() => snapshot.promise) as typeof actions.storeLib.loadSnapshotRecord
  actions.storeLib.loadBaselineRecord = (() => origin.promise) as typeof actions.storeLib.loadBaselineRecord
  actions.baselineLib.restoreBaseline = () => pkg.promise
  return { name, snapshot, origin, pkg }
}

/** Let every settled read run its handlers before the assertions read the session. */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
  await new Promise((r) => setTimeout(r, 0))
}

/** Nothing of the tenant is left in the session; `signedIn` is the account Forget leaves behind. */
function assertReleased(signedIn: AccountInfo | null): void {
  const s = getSession()
  assert.equal(s.account, signedIn, 'the wrong account is signed in after the tenant was let go of')
  assert.equal(s.lastScan, null, 'a stored scan landed after the tenant was let go of')
  assert.equal(s.baseline, null, 'a baseline landed after the tenant was let go of')
  assert.equal(s.baselineRestoreError, null, 'a page with no tenant was told about one')
  if (!signedIn) assert.equal(s.tenantName, null, 'a signed-out page kept the tenant name')
}

test('Sign out while the stored scan is still being read leaves nothing of the tenant: no name, no scan, no baseline', async () => {
  actions.authLib.signOut = async () => {}
  const h = hydration()
  const restoring = actions.restoreSession(account)
  assert.equal(getSession().account, account, 'the account the library returned is adopted at once')
  await actions.signOut()
  // Every read answers after the operator has signed out.
  h.name.settle('Contoso')
  h.snapshot.settle(record)
  h.origin.settle(uploaded.origin)
  h.pkg.settle(uploaded)
  await restoring
  await flush()
  assertReleased(null)
})

test("Sign out while the tenant's stored baseline choice is being read never puts the package it names on the signed-out page", async () => {
  actions.authLib.signOut = async () => {}
  const h = hydration()
  const restoring = actions.restoreSession(account)
  // The scan lands while the tenant is still the app's; the choice is read next.
  h.snapshot.settle(record)
  await flush()
  assert.equal(getSession().lastScan?.at, record.at, 'the restoration did not reach the stored scan')
  await actions.signOut()
  // The stored choice — the operator's own uploaded package — comes back after
  // the Sign out. Restoring it here would begin a turn of its own, and a turn
  // that begins after the Sign out is one no Sign out has ended.
  h.origin.settle(uploaded.origin)
  h.pkg.settle(uploaded)
  h.name.settle('Contoso')
  await restoring
  await flush()
  assertReleased(null)
})

test('Sign out while the chosen package is being rebuilt leaves the signed-out page with no package and nothing to say about one', async () => {
  actions.authLib.signOut = async () => {}
  const h = hydration()
  const restoring = actions.restoreSession(account)
  h.snapshot.settle(record)
  await flush()
  h.origin.settle(uploaded.origin)
  await flush()
  await actions.signOut()
  h.pkg.settle(uploaded)
  h.name.settle('Contoso')
  await restoring
  await flush()
  assertReleased(null)
})

test('Forget this tenant while it is still being restored keeps the operator signed in and writes nothing back under the tenant it just deleted', async () => {
  const rows = new Map<string, unknown>([['t-1', { kind: 'upload' }]])
  actions.storeLib.forgetTenant = async (tenantId: string) => {
    rows.delete(tenantId)
  }
  actions.storeLib.saveBaselineRecord = async (tenantId: string, value: Record<string, unknown>) => {
    rows.set(tenantId, value)
  }
  const h = hydration()
  const restoring = actions.restoreSession(account)
  h.snapshot.settle(record)
  await flush()
  await actions.forgetTenant()
  h.origin.settle(uploaded.origin)
  h.pkg.settle(uploaded)
  h.name.settle('Contoso')
  await restoring
  await flush()
  // Still signed in, as Forget this tenant leaves it, and holding none of what
  // the delete was meant to remove.
  assertReleased(account)
  assert.equal(rows.has('t-1'), false, "a read still in flight wrote the deleted tenant's baseline row back")
})

test('with nobody letting go of the tenant the whole restoration lands: the name, the stored scan and the chosen package, and the choice is not recorded again', async () => {
  const saved: string[] = []
  actions.storeLib.saveBaselineRecord = async (tenantId: string) => {
    saved.push(tenantId)
  }
  const h = hydration()
  const restoring = actions.restoreSession(account)
  h.name.settle('Contoso')
  h.snapshot.settle(record)
  h.origin.settle(uploaded.origin)
  h.pkg.settle(uploaded)
  await restoring
  await flush()
  const s = getSession()
  assert.equal(s.account, account)
  assert.equal(s.tenantName, 'Contoso')
  assert.equal(s.lastScan?.at, record.at)
  assert.equal(s.baseline, uploaded, "the tenant's chosen package did not come back")
  assert.equal(s.baselineRestoreError, null)
  assert.deepEqual(saved, [], 'restoring a stored choice recorded it a second time')
})

test('nobody signed in restores nothing: the session is left signed out and the store is never asked', async () => {
  let asked = 0
  const h = hydration()
  actions.storeLib.loadSnapshotRecord = (() => {
    asked += 1
    return h.snapshot.promise
  }) as typeof actions.storeLib.loadSnapshotRecord
  await actions.restoreSession(null)
  await flush()
  assertReleased(null)
  assert.equal(asked, 0, 'the store was read with nobody signed in')
})

test('every read the restoration makes is bound to the turn it began in, and the baseline restore is handed that turn rather than starting one', () => {
  const src = readFileSync('src/ui/actions.ts', 'utf8')
  const restore = src.slice(src.indexOf('export async function restoreSession'))
  assert.match(restore, /const turn = tenantTurn\(\)/, 'the restoration does not capture a turn')
  // The name, the stored scan and the stored choice each check the turn before
  // they touch the session or read on.
  assert.match(restore, /fetchTenantName\(\)[\s\S]*?if \(stillThisTurn\(turn\)\) setSession\(\{ tenantName: name \}\)/, 'a late tenant name is written to the session unchecked')
  assert.match(restore, /loadSnapshotRecord<ScanRecord>[\s\S]*?if \(!stillThisTurn\(turn\)\) return/, 'a late stored scan is written to the session unchecked')
  assert.match(restore, /loadBaselineRecord<BaselineResult\['origin'\]>[\s\S]*?if \(!stillThisTurn\(turn\) \|\| !origin\) return/, 'a late baseline choice is acted on unchecked')
  assert.match(restore, /await restoreChosenBaseline\(origin, turn\)/, "the baseline restore starts a turn of its own instead of being handed the restoration's")
})
