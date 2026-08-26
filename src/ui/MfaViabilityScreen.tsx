import { useMemo, useState } from 'react'
import { startScan } from '../graph/collect/runScan.ts'
import type { SectionEvent, TenantSnapshot, WorkerOutMessage } from '../graph/collect/types.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { scoreMfaViability, sortViability, summarizeTenant } from '../scoring/mfaViability.ts'
import type { MfaViability, MfaViabilityState } from '../scoring/mfaViability.ts'

type SectionRow = { source: string; status: string; rows?: number; reason?: string; ms?: number }

const STATE_LABEL: Record<MfaViabilityState, string> = {
  verified: 'Verified',
  likelyViable: 'Likely viable',
  notChallenged: 'Not challenged',
  unverified: 'Unverified',
  none: 'No MFA',
  inactive: 'Inactive',
}

export function MfaViabilityScreen({ tenantId }: { tenantId: string }) {
  const [scanState, setScanState] = useState<'idle' | 'running' | 'done' | 'failed'>('idle')
  const [sections, setSections] = useState<Record<string, SectionRow>>({})
  const [snapshot, setSnapshot] = useState<TenantSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  const scan = async () => {
    setScanState('running')
    setSections({})
    setSnapshot(null)
    setError(null)
    const handle = startScan(tenantId, (m: WorkerOutMessage) => {
      if (m.type !== 'section') return
      const s = m as SectionEvent
      setSections((prev) => ({
        ...prev,
        [s.source]: { source: s.source, status: s.status, rows: s.rows, reason: s.reason, ms: s.ms },
      }))
    })
    try {
      setSnapshot(await handle.done)
      setScanState('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setScanState('failed')
    }
  }

  const scored = useMemo(() => {
    if (!snapshot) return null
    const rows = sortViability(buildViabilityInputs(snapshot, new Date().toISOString()).map(scoreMfaViability))
    return { rows, summary: summarizeTenant(rows) }
  }, [snapshot])

  const userById = useMemo(
    () => new Map((snapshot?.users ?? []).map((u) => [u.id, u])),
    [snapshot],
  )

  return (
    <section>
      <h2>MFA viability</h2>
      <p>
        <button onClick={() => void scan()} disabled={scanState === 'running'}>
          {scanState === 'running' ? 'Scanning…' : snapshot ? 'Re-scan tenant' : 'Scan tenant'}
        </button>
      </p>
      {error && <p className="error">Scan failed: {error}</p>}

      {Object.keys(sections).length > 0 && (
        <details open={scanState === 'running'}>
          <summary>Collection sections</summary>
          <ul className="sections">
            {Object.values(sections).map((s) => (
              <li key={s.source}>
                <code>{s.source}</code>: {s.status}
                {s.rows !== undefined && ` — ${s.rows} rows`}
                {s.ms !== undefined && ` in ${s.ms} ms`}
                {s.reason && <span className="reason"> ({s.reason})</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {scored && snapshot && (
        <>
          <p className="notice">
            Sign-in evidence: <strong>{snapshot.sources.signInEvidence.status}</strong> —{' '}
            {snapshot.sources.signInEvidence.reason ?? 'no evidence collected yet'}. States below are
            metadata-only; nothing can be "verified" until the evidence lane runs. Predicted impact is
            confirmed in report-only.
          </p>
          <div className="tiles">
            {(Object.keys(STATE_LABEL) as MfaViabilityState[]).map((state) => (
              <div key={state} className={`tile state-${state}`}>
                <div className="tile-count">{scored.summary.counts[state]}</div>
                <div className="tile-label">{STATE_LABEL[state]}</div>
              </div>
            ))}
            <div className="tile">
              <div className="tile-count">{scored.summary.verificationPhaseSize}</div>
              <div className="tile-label">Verification phase size</div>
            </div>
          </div>
          <table className="viability">
            <thead>
              <tr>
                <th>User</th>
                <th>Admin</th>
                <th>State</th>
                <th>Reasons</th>
              </tr>
            </thead>
            <tbody>
              {scored.rows.map((r: MfaViability) => {
                const u = userById.get(r.userId)
                return (
                  <tr key={r.userId}>
                    <td>
                      {u?.displayName ?? u?.userPrincipalName ?? r.userId}
                      {u?.userType === 'guest' && <span className="chip">guest</span>}
                    </td>
                    <td>{r.isAdmin ? 'yes' : ''}</td>
                    <td>
                      <span className={`chip state-${r.state}`}>{STATE_LABEL[r.state]}</span>
                    </td>
                    <td>{r.reasons.join('; ')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
