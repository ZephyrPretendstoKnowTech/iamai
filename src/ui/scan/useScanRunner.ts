// The scan runner (moved out of MfaViabilityScreen in prompt 47 Part 4,
// without behaviour change): starts the worker, relays its events into state,
// pauses on an expired session and resumes after a fresh sign-in, and reports
// completion to the app. Connect renders it; nothing else starts a scan.
import { useEffect, useRef, useState } from 'react'
import { startScan } from '../../graph/collect/runScan.ts'
import type { ScanHandle, TokenSource } from '../../graph/collect/runScan.ts'
import { coreGaps, unreadSources } from '../../graph/collect/coreSections.ts'
import type { CoreGap } from '../../graph/collect/coreSections.ts'
import { RoleGapError } from '../../graph/collect/tokenRoles.ts'
import type { RoleGap } from '../../graph/collect/tokenRoles.ts'
import type { SectionEvent, TenantSnapshot, WorkerOutMessage } from '../../graph/collect/types.ts'

export type SectionRow = { source: string; status: string; rows?: number; reason?: string; ms?: number }
export type ScanState = 'idle' | 'running' | 'paused' | 'done' | 'failed'
export type LaneB = { pages: number; rows: number; oldest: string | null }

export type ScanRunner = {
  state: ScanState
  sections: Record<string, SectionRow>
  laneB: LaneB | null
  slow: boolean
  error: string | null
  /** The core sections the last scan could not read (coreSections.ts): a scan with gaps is done, and no plan is built or stored from it. */
  gaps: CoreGap[]
  /** Every section the last scan could not read, for the gaps tile's rows; empty unless the scan ended with gaps. */
  unread: string[]
  /** The token's roles read none of the core sections: the scan did not start (tokenRoles.ts). */
  roleGap: RoleGap | null
  startedAt: number | null
  nowTick: number
  start: () => Promise<void>
  stop: () => void
  signInAgain: () => void
}

export function useScanRunner(
  tenantId: string,
  {
    frozen = null,
    finished = null,
    getToken,
    onRunningChange,
    onComplete,
  }: {
    /** A scan held mid-lane, so the progress view can be captured (prompt 46 Part 1 item 2). Never set outside the mock. */
    frozen?: Record<string, SectionRow> | null
    /** A scan that just finished, so the finished-with-gaps view can be captured. Never set outside the mock. */
    finished?: TenantSnapshot | null
    /** The mock's token stand-in; MSAL otherwise. */
    getToken?: TokenSource
    onRunningChange: (running: boolean) => void
    onComplete: (snapshot: TenantSnapshot, at: string) => void
  },
): ScanRunner {
  const [state, setState] = useState<ScanState>(frozen ? 'running' : finished ? 'done' : 'idle')
  const [gaps, setGaps] = useState<CoreGap[]>(() => (finished ? coreGaps(finished) : []))
  const [unread, setUnread] = useState<string[]>(() => (finished ? unreadSources(finished) : []))
  const [roleGap, setRoleGap] = useState<RoleGap | null>(null)
  const handleRef = useRef<ScanHandle | null>(null)
  const stoppedRef = useRef(false)
  const [sections, setSections] = useState<Record<string, SectionRow>>(frozen ?? {})
  const [startedAt, setStartedAt] = useState<number | null>(frozen ? Date.now() : null)
  const [nowTick, setNowTick] = useState(Date.now())
  const [error, setError] = useState<string | null>(null)
  const [laneB, setLaneB] = useState<LaneB | null>(null)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (state !== 'running') return
    const t = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [state])

  // Two starts before the state has settled (StrictMode's doubled effect, a
  // second click) run one scan, never two.
  const startingRef = useRef(false)
  const start = async () => {
    if (startingRef.current || state === 'running' || state === 'paused') return
    startingRef.current = true
    stoppedRef.current = false
    setState('running')
    onRunningChange(true)
    setStartedAt(Date.now())
    setSections({})
    setError(null)
    setGaps([])
    setUnread([])
    setRoleGap(null)
    setLaneB(null)
    setSlow(false)
    const handle = startScan(tenantId, (m: WorkerOutMessage) => {
      if (m.type === 'auth-expired') {
        setState('paused')
        return
      }
      if (m.type === 'auth-resumed') {
        setState('running')
        return
      }
      if (m.type === 'signin-page') {
        setLaneB({ pages: m.pages, rows: m.rows, oldest: m.oldest })
        return
      }
      if (m.type === 'state') {
        if (m.value === 'slow') setSlow(true)
        if (m.value === 'done') setSlow(false)
        return
      }
      if (m.type !== 'section') return
      const s = m as SectionEvent
      setSections((prev) => ({ ...prev, [s.source]: { source: s.source, status: s.status, rows: s.rows, reason: s.reason, ms: s.ms } }))
    }, getToken)
    handleRef.current = handle
    try {
      const result = await handle.done
      // A scan that could not read a core section is done, with gaps: Connect
      // lists them, and the app never hears of it, so the last good plan and
      // its record stay as they were.
      const found = coreGaps(result)
      setGaps(found)
      setUnread(found.length > 0 ? unreadSources(result) : [])
      setState('done')
      if (found.length === 0) onComplete(result, new Date().toISOString())
    } catch (e) {
      if (e instanceof RoleGapError) {
        // Never started: the token's roles read none of the core sections.
        setRoleGap(e.gap)
        setState('idle')
        setSections({})
      } else if (stoppedRef.current) {
        // Stopped on purpose: back to where the page was, with nothing to report.
        setState('idle')
        setSections({})
      } else {
        setError(e instanceof Error ? e.message : String(e))
        setState('failed')
      }
    } finally {
      startingRef.current = false
      onRunningChange(false)
    }
  }

  const stop = () => {
    stoppedRef.current = true
    handleRef.current?.cancel()
  }

  const signInAgain = () => {
    void handleRef.current?.signInAgain().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e))
      setState('failed')
    })
  }

  return { state, sections, laneB, slow, error, gaps, unread, roleGap, startedAt, nowTick, start, stop, signInAgain }
}
