// The scan runner (moved out of MfaViabilityScreen in prompt 47 Part 4,
// without behaviour change): starts the worker, relays its events into state,
// pauses on an expired session and resumes after a fresh sign-in, and reports
// completion to the app. Connect renders it; nothing else starts a scan.
import { useEffect, useRef, useState } from 'react'
import { startScan } from '../../graph/collect/runScan.ts'
import type { ScanHandle } from '../../graph/collect/runScan.ts'
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
    onRunningChange,
    onComplete,
  }: {
    /** A scan held mid-lane, so the progress view can be captured (prompt 46 Part 1 item 2). Never set outside the mock. */
    frozen?: Record<string, SectionRow> | null
    onRunningChange: (running: boolean) => void
    onComplete: (snapshot: TenantSnapshot, at: string) => void
  },
): ScanRunner {
  const [state, setState] = useState<ScanState>(frozen ? 'running' : 'idle')
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

  const start = async () => {
    if (state === 'running' || state === 'paused') return
    stoppedRef.current = false
    setState('running')
    onRunningChange(true)
    setStartedAt(Date.now())
    setSections({})
    setError(null)
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
    })
    handleRef.current = handle
    try {
      const result = await handle.done
      setState('done')
      onComplete(result, new Date().toISOString())
    } catch (e) {
      if (stoppedRef.current) {
        // Stopped on purpose: back to where the page was, with nothing to report.
        setState('idle')
        setSections({})
      } else {
        setError(e instanceof Error ? e.message : String(e))
        setState('failed')
      }
    } finally {
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

  return { state, sections, laneB, slow, error, startedAt, nowTick, start, stop, signInAgain }
}

/**
 * Sections Microsoft Graph refused for the signed-in account, from the live
 * scan events and from the saved scan, so the advice is there on the walk
 * back as well as while the scan runs.
 */
export function deniedSources(sections: Record<string, SectionRow>, snapshot: TenantSnapshot | null, isDenial: (reason: string | null | undefined) => boolean): { denied: string[]; all: boolean } {
  const live = Object.values(sections)
  const settled = live.filter((s) => s.status !== 'started')
  const bySource = new Map<string, string>()
  for (const s of live) if (isDenial(s.reason)) bySource.set(s.source, s.reason as string)
  for (const [key, v] of Object.entries(snapshot?.sources ?? {})) if (isDenial(v?.reason)) bySource.set(key, v.reason as string)
  for (const [key, v] of Object.entries(snapshot?.config ?? {})) if (isDenial(v?.reason)) bySource.set(`config:${key}`, v?.reason as string)
  const denied = [...bySource.keys()]
  const known = settled.length > 0 ? settled.length : Object.keys(snapshot?.sources ?? {}).length + Object.keys(snapshot?.config ?? {}).length
  return { denied, all: denied.length > 0 && known > 0 && denied.length === known }
}
