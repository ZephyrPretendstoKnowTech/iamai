// The app's session, in one store: who is signed in, the tenant's name, the
// stored scan, and the scan in flight (its lane, its pause, its failure, where
// it returns to). ui/actions.ts changes it; App.tsx and the shell read it
// through useSession. A scan started from any page shows on every page (tile
// 3's bar on Connect, one line under the header elsewhere) because its state
// lives here and nowhere in a component. Pure store: no DOM, so Node tests
// can drive the actions against it.
import { useSyncExternalStore } from 'react'
import type { AccountInfo } from '@azure/msal-browser'
import type { TokenSource } from '../graph/collect/runScan.ts'
import type { CoreGap } from '../graph/collect/coreSections.ts'
import type { RoleGap } from '../graph/collect/tokenRoles.ts'
import type { ScanRecord } from './scan/scanRecord.ts'

export type SectionRow = { source: string; status: string; rows?: number; reason?: string; ms?: number }
export type ScanPhase = 'idle' | 'running' | 'paused' | 'done' | 'failed'
export type LaneB = { pages: number; rows: number; oldest: string | null }

/** The scan in flight, or the last one's outcome. */
export type ScanState = {
  state: ScanPhase
  sections: Record<string, SectionRow>
  laneB: LaneB | null
  slow: boolean
  /** Why the scan stopped before it finished; rendered where the scan shows. */
  error: string | null
  /** The core sections the last scan could not read (coreSections.ts): a scan with gaps is done, and no plan is built or stored from it. */
  gaps: CoreGap[]
  /** Every section the last scan could not read, for the gaps tile's rows; empty unless the scan ended with gaps. */
  unread: string[]
  /** The token's roles read none of the core sections: the scan did not start (tokenRoles.ts). */
  roleGap: RoleGap | null
  startedAt: number | null
  nowTick: number
  /** Where the scan lands when it finishes: the page (with the step open) that asked for it; null stays where it is. */
  returnTo: string | null
}

export type Session = {
  account: AccountInfo | null
  tenantName: string | null
  /** The stored scan (scan/scanRecord.ts); null before the first scan and after Forget this tenant. */
  lastScan: ScanRecord | null
  scan: ScanState
  /** The demo's week-two snapshot is showing (App.tsx loads it); the demo's scan flips this. */
  demoWeek2: boolean
  /** The mock's token stand-in; MSAL otherwise. Never set outside the mock. */
  getToken: TokenSource | null
}

export const IDLE_SCAN: ScanState = { state: 'idle', sections: {}, laneB: null, slow: false, error: null, gaps: [], unread: [], roleGap: null, startedAt: null, nowTick: 0, returnTo: null }

const initial = (): Session => ({ account: null, tenantName: null, lastScan: null, scan: IDLE_SCAN, demoWeek2: false, getToken: null })

let session: Session = initial()
const listeners = new Set<() => void>()

export function getSession(): Session {
  return session
}

export function setSession(patch: Partial<Session> | ((s: Session) => Partial<Session>)): void {
  session = { ...session, ...(typeof patch === 'function' ? patch(session) : patch) }
  for (const fn of listeners) fn()
}

export function setScan(patch: Partial<ScanState> | ((s: ScanState) => Partial<ScanState>)): void {
  setSession((s) => ({ scan: { ...s.scan, ...(typeof patch === 'function' ? patch(s.scan) : patch) } }))
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** The session, live: a change from any action re-renders the reader. */
export function useSession(): Session {
  return useSyncExternalStore(subscribe, getSession, getSession)
}

/** Test support: back to the initial state. */
export function resetSession(): void {
  session = initial()
  for (const fn of listeners) fn()
}
