// One action module. Every button anywhere (the header menu, Connect's tiles,
// a step's Scan to update the plan, Today's Scan again) calls one of these;
// nothing else starts a scan, signs in or out, or forgets a tenant. Each acts
// on the one session (ui/session.ts) and reports through it: a scan's lane,
// pause and failure render wherever the scan shows (Connect's tile 3, the line
// under the header elsewhere); sign-in, sign-out and forget reject on failure,
// and the button that called them renders the error beside itself
// (ui/useAction.ts). No handler swallows.
import type { ScanHandle } from '../graph/collect/runScan.ts'
import { coreGaps, unreadSources } from '../graph/collect/coreSections.ts'
import { RoleGapError } from '../graph/collect/tokenRoles.ts'
import type { SectionEvent, WorkerOutMessage } from '../graph/collect/types.ts'
import { forgetTenant as forgetStored, saveSnapshotRecord } from '../graph/collect/cache.ts'
import * as auth from '../graph/auth.ts'
import { app } from '../content/content.ts'
import { isDemo } from './demoMode.ts'
import { afterScanHref } from './shell/routes.ts'
import type { ScanRecord } from './scan/scanRecord.ts'
import { IDLE_SCAN, getSession, setScan, setSession } from './session.ts'

/** The sign-in library behind the actions (graph/auth.ts). A test replaces these: the real one needs a browser. */
export const authLib = { signIn: auth.signIn, signInAnother: auth.signInAnother, signOut: auth.signOut }
/** The store behind the actions (graph/collect/cache.ts). A test replaces these: the real one needs IndexedDB. */
export const storeLib = { forgetTenant: forgetStored, saveSnapshotRecord }
/** The collector, loaded when the first scan starts: it carries the sign-in library, which needs a browser. */
const collector = () => import('../graph/collect/runScan.ts')

const CONNECT_HREF = '#/connect'

const go = (hash: string): void => {
  window.location.hash = hash
}

let handle: ScanHandle | null = null
let stopped = false

/**
 * Scan the signed-in tenant, from any page. The scan's state is the session's
 * (tile 3 on Connect, the line under the header elsewhere); when it lands it
 * is stored and the app returns to `returnTo` (a step's hash opens the step),
 * or stays where it is when null. A scan that could not read a core section
 * is done with gaps: nothing is built or stored from it. In the demo there is
 * no worker: the scan is the week-two snapshot and back. Never rejects: what
 * stops the scan renders where the scan shows.
 */
export async function scan(returnTo: string | null = null): Promise<void> {
  const s = getSession()
  if (isDemo()) {
    setScan({ returnTo })
    setSession({ demoWeek2: !s.demoWeek2 })
    return
  }
  if (s.scan.state === 'running' || s.scan.state === 'paused') return
  const account = s.account
  if (!account) {
    setScan({ ...IDLE_SCAN, state: 'failed', error: app.shell.scanNeedsConnect })
    return
  }
  stopped = false
  setScan({ ...IDLE_SCAN, state: 'running', startedAt: Date.now(), nowTick: Date.now(), returnTo })
  const tick = setInterval(() => setScan({ nowTick: Date.now() }), 1000)
  const onEvent = (m: WorkerOutMessage): void => {
    if (m.type === 'auth-expired') setScan({ state: 'paused' })
    else if (m.type === 'auth-resumed') setScan({ state: 'running' })
    else if (m.type === 'signin-page') setScan({ laneB: { pages: m.pages, rows: m.rows, oldest: m.oldest } })
    else if (m.type === 'state') setScan({ slow: m.value === 'slow' })
    else if (m.type === 'section') {
      const e = m as SectionEvent
      setScan((sc) => ({ sections: { ...sc.sections, [e.source]: { source: e.source, status: e.status, rows: e.rows, reason: e.reason, ms: e.ms } } }))
    }
  }
  try {
    const { startScan } = await collector()
    handle = startScan(account.tenantId, onEvent, s.getToken ?? undefined)
    const result = await handle.done
    const found = coreGaps(result)
    setScan({ state: 'done', gaps: found, unread: found.length > 0 ? unreadSources(result) : [] })
    if (found.length > 0) return
    const record: ScanRecord = { snapshot: result, at: new Date().toISOString() }
    setSession({ lastScan: record })
    void storeLib.saveSnapshotRecord(account.tenantId, record)
    if (returnTo !== null) go(afterScanHref(returnTo))
  } catch (e) {
    if (e instanceof RoleGapError) setScan({ state: 'idle', roleGap: e.gap, sections: {} })
    else if (stopped) setScan({ state: 'idle', sections: {} })
    else setScan({ state: 'failed', error: e instanceof Error ? e.message : String(e) })
  } finally {
    clearInterval(tick)
    handle = null
  }
}

/** Stop the running scan: back to where the page was, with nothing to report. */
export function stopScan(): void {
  stopped = true
  handle?.cancel()
}

/** A paused scan (the Microsoft session expired): sign in again in a popup and resume. Rejects when the sign-in fails. */
export async function resumeScan(): Promise<void> {
  if (!handle) return
  try {
    await handle.signInAgain()
  } catch (e) {
    setScan({ state: 'failed', error: e instanceof Error ? e.message : String(e) })
    throw e
  }
}

/** Sign in with Microsoft: the redirect. Rejects when the library cannot start it. */
export async function signIn(): Promise<void> {
  await authLib.signIn()
}

/** The account picker, for another account (a role the signed-in one lacks, or a work account after a personal one). */
export async function signInAnother(): Promise<void> {
  await authLib.signInAnother()
}

/**
 * Sign out: the session is cleared and the signed-out Connect renders at once,
 * whether or not MSAL had an active account; MSAL's cache is cleared, and an
 * account it held is signed out through its redirect (graph/msal.ts). Rejects
 * when the library fails, with the app already signed out.
 */
export async function signOut(): Promise<void> {
  stopScan()
  setSession({ account: null, tenantName: null, lastScan: null, scan: IDLE_SCAN, demoWeek2: false })
  go(CONNECT_HREF)
  await authLib.signOut()
}

/**
 * Forget this tenant: every record stored for it on this device (the scan, the
 * sign-in rows, the groups, the mapping, the plan, the baseline choice) and the
 * snapshot, plan and mapping in memory; Connect then shows its not-scanned
 * state, still signed in. Rejects when the store cannot be cleared.
 */
export async function forgetTenant(): Promise<void> {
  const account = getSession().account
  if (!account) throw new Error(app.shell.scanNeedsConnect)
  stopScan()
  await storeLib.forgetTenant(account.tenantId)
  setSession({ lastScan: null, scan: IDLE_SCAN, demoWeek2: false })
  go(CONNECT_HREF)
}
