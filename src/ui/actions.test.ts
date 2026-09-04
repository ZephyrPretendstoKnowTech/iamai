// One action module (ui/actions.ts) over one session (ui/session.ts): sign-out
// from a state with no MSAL account still lands signed out with the session
// cleared; forget clears the store and the memory and stays signed in; a scan
// with nobody signed in reports where the scan shows and never rejects; the
// demo's scan is the week-two toggle; and every button on every surface
// reaches these functions, never the sign-in library, the store or the
// collector directly.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { AccountInfo } from '@azure/msal-browser'

// The actions read the page's hash and the demo switch from `window`; Node has none.
const fakeWindow = { location: { hash: '#/plan', search: '', href: 'http://localhost/' } }
;(globalThis as unknown as { window: unknown }).window = fakeWindow
const actions = await import('./actions.ts')
const { getSession, resetSession, setSession, setScan, IDLE_SCAN } = await import('./session.ts')

const account = { homeAccountId: 'x', environment: 'login.windows.net', tenantId: 't-1', username: 'a@example.com', localAccountId: 'u-1', name: 'A' } as AccountInfo
const record = { snapshot: { tenantId: 't-1' } as never, at: '2026-09-04T00:00:00.000Z' }

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
  setSession({ account, lastScan: record })
  await assert.rejects(actions.forgetTenant(), /store blocked/)
  assert.equal(getSession().lastScan, record)
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
  const SITES = ['src/ui/shell/AppShell.tsx', 'src/ui/surfaces/Connect.tsx', 'src/ui/surfaces/Today.tsx', 'src/ui/surfaces/Plan.tsx', 'src/ui/scan/ScanProgress.tsx']
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
  assert.match(readFileSync('src/ui/surfaces/Today.tsx', 'utf8'), /run\(scan\(todayHref\(show\)\)\)/)
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
