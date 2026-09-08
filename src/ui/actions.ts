// One action module. Every button anywhere (the header menu, Connect's tiles,
// a step's Scan to update the plan, Today's Scan again) calls one of these;
// nothing else starts a scan, signs in or out, or forgets a tenant. Each acts
// on the one session (ui/session.ts) and reports through it: a scan's lane,
// pause and failure render wherever the scan shows (Connect's tile 3, the line
// under the header elsewhere); sign-in, sign-out and forget reject on failure,
// and the button that called them renders the error beside itself
// (ui/useAction.ts). No handler swallows.
import type { AccountInfo } from '@azure/msal-browser'
import type { ScanHandle } from '../graph/collect/runScan.ts'
import { coreGaps, unreadSources } from '../graph/collect/coreSections.ts'
import { RoleGapError } from '../graph/collect/tokenRoles.ts'
import type { SectionEvent, WorkerOutMessage } from '../graph/collect/types.ts'
import { forgetTenant as forgetStored, loadBaselineRecord, loadSnapshotRecord, saveBaselineRecord, saveSnapshotRecord } from '../graph/collect/cache.ts'
import * as auth from '../graph/auth.ts'
import { app } from '../content/content.ts'
import { isDemo } from './demoMode.ts'
import { afterScanHref } from './shell/routes.ts'
import type { ScanRecord } from './scan/scanRecord.ts'
import type { BaselineResult } from './baseline.ts'
import { restoreBaseline } from './baseline.ts'
import { IDLE_SCAN, endTenantTurn, getSession, setScan, setSession, stillThisTurn, tenantTurn } from './session.ts'

/** The sign-in library behind the actions (graph/auth.ts). A test replaces these: the real one needs a browser. */
export const authLib = { signIn: auth.signIn, signInAnother: auth.signInAnother, signOut: auth.signOut }
/** The store behind the actions (graph/collect/cache.ts). A test replaces these: the real one needs IndexedDB. */
export const storeLib = { forgetTenant: forgetStored, saveSnapshotRecord, saveBaselineRecord, loadSnapshotRecord, loadBaselineRecord }
/**
 * The tenant's name from the directory (graph/organization.ts), read by sign-in
 * restoration. Loaded on demand, as the collector and the sign-in library are:
 * it reaches Graph through MSAL, which reads `window` as it loads and so may
 * not be in this module's own chunk. A test replaces it: the real one fetches.
 */
export const tenantLib = {
  fetchTenantName: async (): Promise<string | null> => (await import('../graph/organization.ts')).fetchTenantName(),
}
/** The baseline reader behind the restore action (ui/baseline.ts). A test replaces it: the real one fetches. */
export const baselineLib = { restoreBaseline }
/** The collector, loaded when the first scan starts: it carries the sign-in library, which needs a browser. */
const collector = () => import('../graph/collect/runScan.ts')

const CONNECT_HREF = '#/connect'

const go = (hash: string): void => {
  window.location.hash = hash
}

let handle: ScanHandle | null = null
let stopped = false
/**
 * The tenant's baseline record being written, or nothing: Forget this tenant
 * waits on it before it deletes, so a row already being written cannot outlive
 * the delete that was meant to remove it.
 */
let baselineSave: Promise<void> = Promise.resolve()

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
    // The demo has two synthetic scans and no tenant to read, so Scan again
    // moves to the follow-up one — and only ever forwards. A control labelled
    // "Scan again" that silently returned the visitor to the initial scan would
    // be the one thing the sample must never say: that the plan went backwards
    // because IAMAI looked again. The way back to the initial scan is the
    // banner's snapshot selector, which names the snapshot it selects.
    if (s.demoWeek2) {
      if (returnTo) go(returnTo)
      return
    }
    setScan({ returnTo })
    setSession({ demoWeek2: true })
    return
  }
  if (s.scan.state === 'running' || s.scan.state === 'paused') return
  const account = s.account
  if (!account) {
    setScan({ ...IDLE_SCAN, state: 'failed', error: app.shell.scanNeedsConnect })
    return
  }
  stopped = false
  const turn = tenantTurn()
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
    // Sign out or Forget this tenant landed while the collector was still
    // reading: this snapshot is the previous turn's and belongs to nobody now.
    if (!stillThisTurn(turn)) return
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

/**
 * Which of the sample tenant's two synthetic scans is on screen (task 026): the
 * banner's selector calls this. It changes the *input* the app derives from and
 * nothing else — App.tsx reloads the fixture for the snapshot asked for and the
 * ordinary derivation runs over it — so the plan, the readiness table and the
 * artifacts that follow are the production ones over different facts, never a
 * second set of conclusions swapped in behind the surfaces.
 *
 * Outside the demo it does nothing: a real tenant has one scan, the one it read.
 */
export function showDemoSnapshot(followUp: boolean): void {
  if (!isDemo()) return
  if (getSession().demoWeek2 === followUp) return
  setSession({ demoWeek2: followUp })
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
 *
 * Authentication only: what this device stored for the tenant is left where it
 * is (the menu's Forget this tenant is the action that deletes it). What the
 * app was holding in memory goes, so nothing of the tenant — its snapshot, its
 * name, the baseline it was planned against — is still on screen beside a page
 * that says nobody is signed in.
 */
export async function signOut(): Promise<void> {
  stopScan()
  endTenantTurn()
  setSession({ account: null, tenantName: null, lastScan: null, scan: IDLE_SCAN, baseline: null, baselineRestoreError: null, demoWeek2: false })
  go(CONNECT_HREF)
  await authLib.signOut()
}

/**
 * Forget this tenant: every record stored for it on this device (the scan, the
 * sign-in rows, the groups, the mapping, the plan, the baseline choice) and
 * everything the app was holding of it in memory — the snapshot, the plan, the
 * mapping and the baseline the choice named; Connect then shows its not-scanned
 * state, still signed in. Only this tenant's id is named, so another tenant's
 * records on the same device are untouched. Rejects when the store cannot be
 * cleared, and nothing in memory is let go of first: a forget that failed must
 * not read as one that worked.
 */
export async function forgetTenant(): Promise<void> {
  const account = getSession().account
  if (!account) throw new Error(app.shell.scanNeedsConnect)
  stopScan()
  // The turn ends before the delete, not after it: baseline work already in
  // flight may neither land nor start a write from here, and a write that had
  // already begun is waited for, so the delete is the last word on the tenant's
  // rows. A forget the store refuses still ends the turn — the operator asked
  // to let the tenant go, and a package still loading for it is not an answer.
  endTenantTurn()
  await baselineSave.catch(() => {})
  await storeLib.forgetTenant(account.tenantId)
  setSession({ lastScan: null, scan: IDLE_SCAN, baseline: null, baselineRestoreError: null, demoWeek2: false })
  go(CONNECT_HREF)
}

/**
 * Read a baseline and make it this tenant's: it renders from the session, and
 * a pick — the operator's answer in tile 2's picker or their own uploaded
 * package — is recorded for the tenant so it comes back on the next sign-in.
 * The default tile 2 loads for itself is not a pick and is not recorded.
 *
 * The reading happens inside the action, in the turn it began in, so Sign out
 * and Forget this tenant take an unfinished read with them (ui/session.ts):
 * a package that arrives after either action is applied to nothing and stored
 * nowhere. `began` is that turn: a caller already working inside one hands it
 * down rather than letting this read start a turn of its own, or a read the
 * signed-out tenant's restoration asked for would pass the test by beginning
 * after the Sign out it should have been cancelled by. Rejects when the package
 * cannot be read: the tile that asked for it renders the failure beside itself
 * (ui/useAction.ts).
 */
export async function chooseBaseline(read: () => Promise<BaselineResult>, chosen: boolean, began: number = tenantTurn()): Promise<void> {
  const turn = began
  const account = getSession().account
  const result = await read()
  if (!stillThisTurn(turn)) return
  setSession({ baseline: result, baselineRestoreError: null })
  if (!chosen || !account) return
  baselineSave = storeLib.saveBaselineRecord(account.tenantId, result.origin)
}

/**
 * The baseline the tenant's stored choice names, restored on sign-in. Not a
 * pick, so nothing is written back. There is no button behind this one, so a
 * package that cannot be rebuilt is reported in the session and Connect offers
 * the choice again; a tenant let go of while it was being rebuilt is told
 * nothing, because there is no longer anyone it is about. `began` is the turn
 * the restoration this belongs to began in (`restoreSession`), not the turn
 * this call happens to start in: the choice being read is the stored one of the
 * tenant that was signed in then.
 */
export async function restoreChosenBaseline(origin: BaselineResult['origin'], began: number = tenantTurn()): Promise<void> {
  const turn = began
  try {
    await chooseBaseline(() => baselineLib.restoreBaseline(origin), false, turn)
  } catch (e) {
    if (stillThisTurn(turn)) setSession({ baselineRestoreError: e instanceof Error ? e.message : String(e) })
  }
}

/**
 * Restore the session for the account the sign-in library returned: who is
 * signed in, the tenant's name, the scan this device stored for it, and the
 * baseline its stored choice names. The whole sequence is one turn's work
 * (ui/session.ts), captured the moment the account is adopted and carried
 * through every read to the baseline restore at the end of it. Sign out and
 * Forget this tenant end that turn, and from there each read still in flight
 * arrives to nobody: no name, no scan and no baseline of a tenant the operator
 * has already let go of is put back on a page that says they have.
 *
 * The reads happen here and not in App.tsx for the same reason the baseline's
 * do: only the action module knows the turn, and a tenant fact read anywhere
 * else is a fact no trust action can cancel. Awaited to the end, so the shell
 * draws on a restored session and Connect does not load its default over a
 * baseline that was about to come back. Never rejects: a store or a directory
 * that will not answer leaves the tenant with less on screen, not an error page.
 */
export async function restoreSession(account: AccountInfo | null): Promise<void> {
  setSession({ account })
  if (!account) return
  const turn = tenantTurn()
  // The name is not waited for: the header fills it in when Graph answers, and
  // only while this tenant is still the one the app has.
  void tenantLib
    .fetchTenantName()
    .then((name) => {
      if (stillThisTurn(turn)) setSession({ tenantName: name })
    })
    .catch(() => {})
  // The last scan comes back so nobody re-scans just to look around. Where the
  // app lands depends on it (target-state §2: a scanned tenant lands on Plan).
  const stored = await storeLib.loadSnapshotRecord<ScanRecord>(account.tenantId).catch(() => null)
  if (!stillThisTurn(turn)) return
  if (stored?.snapshot) setSession({ lastScan: { snapshot: stored.snapshot, at: stored.at } })
  // The baseline the tenant chose (prompt 14 §6): the pinned index by commit,
  // or the operator's own uploaded files.
  const origin = await storeLib.loadBaselineRecord<BaselineResult['origin']>(account.tenantId).catch(() => null)
  if (!stillThisTurn(turn) || !origin) return
  await restoreChosenBaseline(origin, turn)
}
