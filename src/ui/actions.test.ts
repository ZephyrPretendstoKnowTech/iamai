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
