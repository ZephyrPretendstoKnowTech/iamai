// One action module (ui/actions.ts) over one session (ui/session.ts): sign-out
// from a state with no MSAL account still lands signed out with the session
// cleared; forget clears the store and the memory and stays signed in; a scan
// with nobody signed in reports where the scan shows and never rejects; the
// demo's scan advances the sample to its follow-up snapshot and the banner's
// selector picks either one; and every button on every surface
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

/** A fresh session on the Plan, outside the demo: before every test, and before every case inside one. */
function fresh(): void {
  resetSession()
  fakeWindow.location.hash = '#/plan'
  fakeWindow.location.search = ''
}

beforeEach(fresh)

test('a trust action the library or the store cannot finish: Sign out still signs the app out, a failed Forget keeps everything, and both failures reach the button', async () => {
  // A sign-out the library cannot finish still signs the app out, and the failure reaches the button.
  {
    fresh()
    actions.authLib.signOut = async () => {
      throw new Error('logout redirect failed')
    }
    setSession({ account, lastScan: record })
    await assert.rejects(actions.signOut(), /logout redirect failed/)
    assert.equal(getSession().account, null, 'signed out all the same')
    assert.equal(fakeWindow.location.hash, '#/connect')
  }
  // A store that cannot be cleared rejects, so the menu shows it; the snapshot stays.
  {
    fresh()
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
  }
})

test('sign-in failures reach the button, and a scan with nobody signed in reports where the scan shows instead of rejecting', async () => {
  // A scan with nobody signed in never rejects: it reports where the scan shows.
  {
    fresh()
    await actions.scan('#/today')
    const { scan } = getSession()
    assert.equal(scan.state, 'failed')
    assert.ok(scan.error && scan.error.length > 0)
    assert.equal(fakeWindow.location.hash, '#/plan', 'nowhere to go')
  }
  // Sign in and sign in with another account reach the library, and its failure reaches the button.
  {
    fresh()
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
  }
})

test('the demo\'s scan only ever moves the sample forward, and the snapshot selector picks either scan in the demo and does nothing outside it', async () => {
  // The demo's scan advances to the follow-up snapshot and only ever forwards, with where to return kept for the landing.
  {
    fresh()
    fakeWindow.location.search = '?demo=1'
    setSession({ account })
    await actions.scan('#/plan/s-verify-mfa')
    assert.equal(getSession().demoWeek2, true)
    assert.equal(getSession().scan.returnTo, '#/plan/s-verify-mfa')
    // A second Scan again on the follow-up snapshot does not walk the sample
    // backwards in time: it stays where it is and goes where it was asked to go.
    fakeWindow.location.hash = '#/connect'
    await actions.scan('#/plan')
    assert.equal(getSession().demoWeek2, true)
    assert.equal(fakeWindow.location.hash, '#/plan', 'the second scan does not return to the page that asked for it')
  }
  // The demo snapshot selector picks either synthetic scan, and does nothing outside the demo.
  {
    fresh()
    fakeWindow.location.search = '?demo=1'
    setSession({ account })
    actions.showDemoSnapshot(true)
    assert.equal(getSession().demoWeek2, true)
    // Back to the initial scan: the selector is the way back, and it is the only one.
    actions.showDemoSnapshot(false)
    assert.equal(getSession().demoWeek2, false)
    // Outside the demo it is not an action at all: a real tenant has one scan.
    fakeWindow.location.search = ''
    actions.showDemoSnapshot(true)
    assert.equal(getSession().demoWeek2, false)
  }
})

test('Sign out lets go of every fact about the tenant, and deletes nothing this device stored', async () => {
  const deleted: string[] = []
  let libSignOut = 0
  const signedOut: (AccountInfo | null | undefined)[] = []
  actions.authLib.signOut = async (a?: AccountInfo | null) => {
    libSignOut += 1
    signedOut.push(a)
  }
  actions.storeLib.forgetTenant = async (tenantId: string) => {
    deleted.push(tenantId)
  }
  setSession({ account, tenantName: 'Contoso', lastScan: record, baseline: uploaded, baselineRestoreError: 'the stored package would not load' })
  setScan({ ...IDLE_SCAN, state: 'failed', error: 'a scan that failed', returnTo: '#/plan/s-one' })
  await actions.signOut()
  // T3-A: the library is told which account to sign out, the open one, and so signs out no other.
  assert.deepEqual(signedOut, [account], 'the library was not handed the open account')
  const s = getSession()
  assert.equal(s.account, null, 'nobody is signed in')
  assert.equal(s.tenantName, null)
  assert.equal(s.lastScan, null)
  // The operator's own uploaded package is a fact about the tenant they just
  // left: the signed-out page draws the baseline tile, so leaving it in memory
  // would put their file under a page that says nobody is signed in.
  assert.equal(s.baseline, null, "the tenant's baseline is not still on the signed-out page")
  assert.equal(s.baselineRestoreError, null)
  assert.deepEqual([s.scan.state, s.scan.error, s.scan.roleGap, s.scan.returnTo], ['idle', null, null, null], 'Sign out left a scan fact in memory')
  assert.equal(fakeWindow.location.hash, '#/connect')
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
  setSession({ account, tenantName: 'Contoso', lastScan: record, baseline: uploaded, baselineRestoreError: 'the stored package would not load', demoWeek2: true })
  setScan({ ...IDLE_SCAN, state: 'failed', error: 'a scan that failed', returnTo: '#/plan/s-one' })
  await actions.forgetTenant()
  const s = getSession()
  assert.deepEqual(deleted, ['t-1'], 'the tenant now signed in, by its own id, and no other')
  assert.equal(s.lastScan, null)
  // The stored baseline choice is one of the records forget deletes, so the
  // page may not go on showing the choice the device no longer remembers.
  assert.equal(s.baseline, null)
  assert.equal(s.baselineRestoreError, null)
  assert.deepEqual([s.scan.error, s.scan.roleGap, s.scan.returnTo], [null, null, null], 'Forget left a scan fact in memory')
  assert.equal(s.demoWeek2, false)
  assert.equal(fakeWindow.location.hash, '#/connect')
  assert.equal(s.account, account, 'still signed in')
  assert.equal(s.tenantName, 'Contoso', 'still signed in to the same tenant')
  assert.equal(libSignOut, 0, 'Forget is not Sign out: the operator was not signed out')
  // Nobody signed in: nothing to forget, and the button hears why.
  resetSession()
  await assert.rejects(actions.forgetTenant())
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
  // S4-8: what the scan could not read is computed for every finished scan, not
  // only one that ended with core gaps. A tenant that refused ten non-core
  // sections has no gap, and the list was thrown away before it reached a
  // surface, so Connect said complete and named nothing.
  assert.match(src, /gaps: found, unread: unreadSources\(result\)/, 'the unread list is computed for every scan')
  assert.doesNotMatch(src, /unread: found\.length/, 'the unread list is thrown away when there is no core gap')
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
  // A step calls the handler it was GIVEN, never a scan of its own. The content
  // step now hands that handler to the frame's footer (StepSections.tsx
  // StepFooter) instead of drawing the button itself, so the chain is checked
  // through both links: the step passes the handler it was given, and the footer
  // is what presses it.
  assert.match(readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8'), /onScan=\{printing \? null : \(onScan \?\? null\)\}/, 'the content step no longer hands the footer the handler it was given')
  assert.match(readFileSync('src/ui/surfaces/StepSections.tsx', 'utf8'), /onClick=\{onScan\}/, 'the step footer calls the handler it was given')
  // And neither builds one: the only scan on a step is the one the Plan passed down.
  for (const file of ['src/ui/surfaces/ContentStep.tsx', 'src/ui/surfaces/StepSections.tsx']) {
    assert.equal(readFileSync(file, 'utf8').includes('runScan('), false, `${file} runs a scan of its own`)
  }
  // The header menu's two buttons, Connect's tile buttons and MFA Readiness's Scan again (its Evidence read tile) call the actions by name.
  // The Account menu's two actions; Forget runs from its confirm (F-160) and closes the menu once it worked.
  assert.match(readFileSync('src/ui/shell/AppShell.tsx', 'utf8'), /run\(signOut\(\)\)/)
  assert.match(readFileSync('src/ui/shell/AppShell.tsx', 'utf8'), /run\(forgetTenant\(\)\.then\(close\)\)/)
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

test('work in flight when a trust action lands never comes back: a late baseline read, a row being written, or a failed rebuild of the stored choice', async () => {
  // A baseline still being read when Sign out lands never comes back: it is applied to nothing and recorded nowhere.
  {
    fresh()
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
  }
  // A baseline still being read when Forget this tenant lands writes no row back under the forgotten tenant, and another tenant keeps its own.
  {
    fresh()
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
  }
  // A baseline row already being written when Forget this tenant lands does not outlive the delete.
  {
    fresh()
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
  }
  // A stored baseline choice that cannot be rebuilt is reported, unless the tenant was let go of while it was being rebuilt.
  {
    fresh()
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
  }
})

test('with nobody letting go of the tenant everything lands: a picked baseline once, the whole restoration, and the unchosen default without a saved choice; with nobody signed in nothing is restored', async () => {
  // With nobody letting go of the tenant a read still lands: the baseline renders, and a pick is recorded once.
  {
    fresh()
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
  }
  // Opening a saved plan directly restores the unchosen default baseline without saving a choice.
  {
    fresh()
    const h = hydration()
    let saves = 0
    actions.storeLib.saveBaselineRecord = async () => { saves += 1 }
    actions.baselineLib.loadPinnedBaseline = async () => pinnedResult
    const restoring = actions.restoreSession(account)
    h.name.settle('Contoso')
    h.snapshot.settle(record)
    h.origin.settle(null)
    await restoring
    assert.equal(getSession().lastScan?.snapshot, record.snapshot)
    assert.equal(getSession().baseline, pinnedResult)
    assert.equal(saves, 0)
  }
  // With nobody letting go of the tenant the whole restoration lands: the name, the stored scan and the chosen package, and the choice is not recorded again.
  {
    fresh()
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
  }
  // Nobody signed in restores nothing: the session is left signed out and the store is never asked.
  {
    fresh()
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
  }
})

test('the tenant\'s turn is ended by the two trust actions and the tenant switch and by nothing else, and the scan lands only in the turn it began in', () => {
  // Line endings normalised: a Windows checkout writes the working copy with CRLF.
  const src = readFileSync('src/ui/actions.ts', 'utf8').replace(/\r\n/g, '\n')
  const ends = src.match(/endTenantTurn\(\)/g) ?? []
  assert.equal(ends.length, 3, 'the turn is ended somewhere other than Sign out, Forget this tenant and the tenant switch')
  assert.match(src, /stopScan\(\)\n  endTenantTurn\(\)\n  setSession\(\{ account: null/, 'Sign out no longer ends the turn before it clears the session')
  // T3-A: the switch ends the turn before it lets go of the tenant being left, and before the next one is restored.
  assert.match(src, /stopScan\(\)\n  endTenantTurn\(\)\n  setSession\(\{ tenantName: null, lastScan: null, scan: IDLE_SCAN/, 'the switch no longer ends the turn before it clears the session')
  // And this tab lets go of the left tenant's plan copy, so another tab's save of it cannot mark this tab behind (planSync.ts letGo).
  assert.match(src, /clearDrafts\(\)\n  clearPlanNotice\(\)\n  if \(leaving\) letGo\(leaving\.tenantId\)/)
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

// T3-A: restoring a tenant starts from that tenant's own stored state or from
// nothing. restoreSession used to set only the account and then each fact it
// read, so a tenant with no stored scan kept the previous tenant's scan, name,
// baseline and scan outcome on screen under its own account.
test('restoring a tenant with nothing stored shows nothing of the tenant before it: no scan, no name, no baseline, no scan outcome', async () => {
  setSession({ account, tenantName: 'Contoso', lastScan: record, baseline: uploaded, baselineRestoreError: 'an older failure' })
  setScan({ ...IDLE_SCAN, state: 'done', error: null, returnTo: '#/plan/s-one', gaps: [{ source: 'caPolicies' } as never] })
  const h = hydration()
  const pinned = deferred<BaselineResult>()
  actions.baselineLib.loadPinnedBaseline = () => pinned.promise
  const restoring = actions.restoreSession(otherAccount)
  // At once, before any read answers: tenant B's account and nothing of tenant A.
  {
    const s = getSession()
    assert.equal(s.account, otherAccount)
    assert.equal(s.lastScan, null, "tenant A's scan is still on screen under tenant B")
    assert.equal(s.tenantName, null, "tenant A's name is still in the header")
    assert.equal(s.baseline, null, "tenant A's uploaded package is still tenant B's baseline")
    assert.equal(s.baselineRestoreError, null)
    assert.deepEqual([s.scan.state, s.scan.gaps, s.scan.returnTo], ['idle', [], null], "tenant A's scan outcome is still on screen")
  }
  // Tenant B has no stored scan and no stored choice: it stays with none, and gets the default baseline.
  h.snapshot.settle(null)
  h.origin.settle(null)
  pinned.settle(pinnedResult)
  h.name.settle('Fabrikam')
  await restoring
  await flush()
  const s = getSession()
  assert.equal(s.lastScan, null, "tenant B, with nothing stored, shows tenant A's scan")
  assert.equal(s.tenantName, 'Fabrikam')
  assert.equal(s.baseline, pinnedResult)
  // And a tenant that has a stored scan gets its own.
  fresh()
  setSession({ account, tenantName: 'Contoso', lastScan: record })
  const h2 = hydration()
  actions.baselineLib.loadPinnedBaseline = async () => pinnedResult
  const again = actions.restoreSession(otherAccount)
  h2.snapshot.settle(otherRecord)
  h2.origin.settle(null)
  h2.name.settle('Fabrikam')
  await again
  assert.equal(getSession().lastScan?.at, otherRecord.at)
})

// T3-A: switching tenants from the Account menu. A tenant whose account is
// signed in opens in place, in a new turn, from its own stored state; one whose
// account is not signed in is a sign-in with the account that scanned it suggested.
const GUID_A = 'aaaaaaaa-0000-4000-8000-000000000001'
const GUID_B = 'bbbbbbbb-0000-4000-8000-000000000002'
const GUID_C = 'cccccccc-0000-4000-8000-000000000003'
const tenantA = { ...account, tenantId: GUID_A } as AccountInfo
const tenantB = { ...otherAccount, tenantId: GUID_B } as AccountInfo
const entryB = { tenantId: GUID_B, name: 'Fabrikam', account: tenantB, loginHint: tenantB.username, stored: true, current: false, scannedAt: null, label: 'Fabrikam' }

test('switching to a signed-in tenant stops the scan, ends the turn, lets go of the tenant being left, makes the account active and restores the chosen tenant', async () => {
  const calls: string[] = []
  actions.authLib.openAccount = async (a: AccountInfo) => { calls.push(`open ${a.tenantId}`) }
  actions.authLib.signInTo = async () => { calls.push('signIn') }
  const h = hydration()
  actions.baselineLib.loadPinnedBaseline = async () => pinnedResult
  setSession({ account: tenantA, tenantName: 'Contoso', lastScan: record, baseline: uploaded })
  setScan({ ...IDLE_SCAN, state: 'failed', error: 'a scan that failed' })
  const { tenantTurn, stillThisTurn } = await import('./session.ts')
  const began = tenantTurn()
  fakeWindow.location.hash = '#/how'
  const switching = actions.switchTenant(entryB)
  // At once: the turn tenant A's work began in is over, and nothing of A is on screen.
  assert.equal(stillThisTurn(began), false, "work in flight for the tenant being left can still land")
  assert.equal(getSession().lastScan, null)
  assert.equal(getSession().baseline, null)
  assert.equal(getSession().tenantName, null)
  assert.equal(getSession().scan.error, null)
  // And the page waits for the chosen tenant's state, as on load: nothing draws on the empty session.
  assert.equal(getSession().restoring, true, 'the page draws on the empty session while tenant B is restored')
  assert.match(readFileSync('src/ui/App.tsx', 'utf8'), /\{!ready \|\| restoring \? \(\n\s+app\.shell\.loading/)
  h.snapshot.settle(otherRecord)
  h.origin.settle(null)
  h.name.settle('Fabrikam')
  await switching
  const s = getSession()
  assert.deepEqual(calls, [`open ${GUID_B}`], 'MSAL was not told which account is now active, or a sign-in was started')
  assert.equal(s.account, tenantB)
  assert.equal(s.tenantName, 'Fabrikam')
  assert.equal(s.lastScan?.at, otherRecord.at, "tenant B's own stored scan")
  assert.equal(s.baseline, pinnedResult)
  assert.equal(fakeWindow.location.hash, '#/plan', 'a tenant with a stored scan lands on its Plan')
  assert.equal(s.restoring, false, 'the page is still waiting after the restore')
  // A tenant with nothing stored lands on Connect.
  fresh()
  const h2 = hydration()
  setSession({ account: tenantA, lastScan: record })
  const second = actions.switchTenant(entryB)
  h2.snapshot.settle(null)
  h2.origin.settle(null)
  h2.name.settle(null)
  await second
  assert.equal(getSession().lastScan, null)
  assert.equal(fakeWindow.location.hash, '#/connect')
})

test('switching to a tenant whose account is not signed in signs in with its hint and lets nothing go first; choosing the open tenant does nothing', async () => {
  const calls: string[] = []
  actions.authLib.openAccount = async () => { calls.push('open') }
  actions.authLib.signInTo = async (hint: string | null) => { calls.push(`signIn ${hint}`) }
  setSession({ account: tenantA, tenantName: 'Contoso', lastScan: record })
  const { tenantTurn, stillThisTurn } = await import('./session.ts')
  const began = tenantTurn()
  await actions.switchTenant({ ...entryB, account: null, loginHint: 'ops@fabrikam.example' })
  assert.deepEqual(calls, ['signIn ops@fabrikam.example'])
  // The redirect leaves the page; until it does, the open tenant is still the open tenant.
  assert.equal(getSession().lastScan, record)
  assert.equal(stillThisTurn(began), true)
  await actions.switchTenant({ ...entryB, tenantId: GUID_A, account: tenantA, current: true })
  assert.deepEqual(calls, ['signIn ops@fabrikam.example'], 'choosing the open tenant moved')
  assert.equal(getSession().lastScan, record)
})

test("an account gone from the cache is not half-opened: the switch rejects and the tenant being left is restored", async () => {
  actions.authLib.openAccount = async () => { throw new Error('Not signed in') }
  actions.baselineLib.loadPinnedBaseline = async () => pinnedResult
  actions.tenantLib.fetchTenantName = async () => 'Contoso'
  actions.storeLib.loadSnapshotRecord = (async (id: string) => (id === GUID_A ? record : null)) as typeof actions.storeLib.loadSnapshotRecord
  actions.storeLib.loadBaselineRecord = (async () => null) as typeof actions.storeLib.loadBaselineRecord
  setSession({ account: tenantA, tenantName: 'Contoso', lastScan: record })
  await assert.rejects(actions.switchTenant(entryB), /Not signed in/)
  await flush()
  assert.equal(getSession().restoring, false, 'a switch that failed left the page waiting')
  assert.equal(getSession().account, tenantA)
  assert.equal(getSession().lastScan?.at, record.at)
  assert.equal(getSession().tenantName, 'Contoso')
})

test("the menu's tenants: the store's tenant ids (the sample's left out), each named from its stored scan once, and the accounts signed in", async () => {
  const reads: string[] = []
  actions.storeLib.storedTenantIds = async () => [GUID_A, GUID_C, 'demo-sample-tenant']
  actions.storeLib.loadSnapshotRecord = (async (id: string) => {
    reads.push(id)
    return id === GUID_C ? { snapshot: { config: { organization: { rows: [{ displayName: 'Northwind' }] }, me: { rows: [{ userPrincipalName: 'ops@northwind.example' }] } } }, at: 'x' } : null
  }) as typeof actions.storeLib.loadSnapshotRecord
  actions.authLib.signedInAccounts = async () => [tenantA, tenantB]
  setSession({ account: tenantA, tenantName: 'Contoso' })
  const rows = await actions.listTenants()
  assert.deepEqual(rows.map((r) => [r.tenantId, r.name, r.current, r.account?.tenantId ?? null, r.loginHint]), [
    [GUID_A, 'Contoso', true, GUID_A, tenantA.username],
    [GUID_B, null, false, GUID_B, tenantB.username],
    [GUID_C, 'Northwind', false, null, 'ops@northwind.example'],
  ])
  assert.deepEqual(reads.sort(), [GUID_A, GUID_C], 'the sample was read, or a stored tenant was not')
  // A stored scan's name is read once per page; a tenant with no stored scan is read again, so its first scan names it.
  await actions.listTenants()
  assert.deepEqual(reads.sort(), [GUID_A, GUID_A, GUID_C])
  // A store or a library that will not answer leaves the open tenant.
  actions.storeLib.storedTenantIds = async () => { throw new Error('blocked') }
  actions.authLib.signedInAccounts = async () => { throw new Error('no msal') }
  assert.deepEqual((await actions.listTenants()).map((r) => r.tenantId), [GUID_A])
})

test('a tenant that is not open is forgotten by its own id without signing in to it; the open tenant is never forgotten through it', async () => {
  const deleted: string[] = []
  const calls: string[] = []
  actions.storeLib.forgetTenant = async (tenantId: string) => { deleted.push(tenantId) }
  actions.authLib.signInTo = async () => { calls.push('signIn') }
  actions.authLib.openAccount = async () => { calls.push('open') }
  actions.authLib.signOut = async () => { calls.push('signOut') }
  setSession({ account: tenantA, tenantName: 'Contoso', lastScan: record, baseline: uploaded })
  const { tenantTurn, stillThisTurn } = await import('./session.ts')
  const began = tenantTurn()
  await actions.forgetStoredTenant(GUID_C)
  assert.deepEqual(deleted, [GUID_C], 'another id was deleted')
  assert.deepEqual(calls, [], 'forgetting a stored tenant signed in, opened or signed out an account')
  // The open tenant is untouched: its turn goes on and everything it holds stays.
  assert.equal(stillThisTurn(began), true)
  const s = getSession()
  assert.deepEqual([s.account, s.tenantName, s.lastScan, s.baseline], [tenantA, 'Contoso', record, uploaded])
  // The open tenant is refused, whatever row asked: nothing is deleted.
  await assert.rejects(actions.forgetStoredTenant(GUID_A))
  assert.deepEqual(deleted, [GUID_C])
  assert.equal(getSession().lastScan, record)
  // A store that cannot be cleared rejects, so the menu shows it.
  actions.storeLib.forgetTenant = async () => { throw new Error('store blocked') }
  await assert.rejects(actions.forgetStoredTenant(GUID_B), /store blocked/)
})

test('R4-37: a scan saved before the PIM capability existed reopens with it, from the licence rows that scan read', async () => {
  // `pim` (licensing/capabilities.ts) arrived after scans were being kept. A
  // kept scan has no entry for it, and every reading of
  // `capabilities.pim.enabled` threw on it; read as absent, a P2 tenant's PIM
  // goal would have left its plan until it scanned again.
  const h = hydration()
  actions.baselineLib.loadPinnedBaseline = async () => pinnedResult
  const p2 = { capabilityStatus: 'Enabled', prepaidUnits: { enabled: 5 }, consumedUnits: 2, servicePlans: [{ servicePlanId: 'eec0eb4f-6444-4f95-aba0-50c24d67f998', servicePlanName: 'AAD_PREMIUM_P2' }] }
  const enabled = { enabled: true, seats: 5, consumed: 2 }
  const off = { enabled: false, seats: 0, consumed: 0 }
  const kept = { snapshot: { tenantId: 't-1', capabilities: { entraP1: off, entraP2: enabled, intune: off, workloadIdPremium: off, globalSecureAccess: off, defenderForCloudApps: off, purviewInsiderRisk: off }, config: { subscribedSkus: { status: 'ok', reason: null, rows: [p2] } } }, at: record.at }
  const restoring = actions.restoreSession(account)
  h.name.settle('Contoso')
  h.snapshot.settle(kept)
  h.origin.settle(null)
  await restoring
  const caps = getSession().lastScan?.snapshot.capabilities
  assert.equal(caps?.pim?.enabled, true)
  assert.equal(caps?.entraP2, enabled, 'what the scan recorded is kept as it was')
})

test('a trust action during restoration leaves nothing of the tenant behind, whichever read is still in flight; Forget keeps the operator signed in and writes nothing back', async () => {
  // Signing out during default baseline restoration does not repopulate the signed-out session.
  {
    fresh()
    const h = hydration()
    const pending = deferred<BaselineResult>()
    let started = false
    actions.authLib.signOut = async () => {}
    actions.baselineLib.loadPinnedBaseline = () => { started = true; return pending.promise }
    const restoring = actions.restoreSession(account)
    h.name.settle('Contoso')
    h.snapshot.settle(record)
    h.origin.settle(null)
    await flush()
    assert.equal(started, true)
    await actions.signOut()
    pending.settle(pinnedResult)
    await restoring
    assert.equal(getSession().baseline, null)
  }
  // Sign out while the stored scan is still being read leaves nothing of the tenant: no name, no scan, no baseline.
  {
    fresh()
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
  }
  // Sign out while the tenant's stored baseline choice is being read never puts the package it names on the signed-out page.
  {
    fresh()
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
  }
  // Sign out while the chosen package is being rebuilt leaves the signed-out page with no package and nothing to say about one.
  {
    fresh()
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
  }
  // Forget this tenant while it is still being restored keeps the operator signed in and writes nothing back under the tenant it just deleted.
  {
    fresh()
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
  }
})

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
