import { useMemo, useState } from 'react'
import { hashTenantId, redactIdentifiers } from '../redact.ts'
import { startScan } from '../graph/collect/runScan.ts'
import type { SectionEvent, TenantSnapshot, WorkerOutMessage } from '../graph/collect/types.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { scoreMfaViability, sortViability, summarizeTenant } from '../scoring/mfaViability.ts'
import type { ActivityState, MethodTier, MfaState, MfaViability } from '../scoring/mfaViability.ts'

type SectionRow = { source: string; status: string; rows?: number; reason?: string; ms?: number }

const MFA_LABEL: Record<MfaState, string> = {
  verified: 'Verified',
  likelyViable: 'Likely viable',
  notChallenged: 'Not challenged',
  unverified: 'Unverified',
  none: 'No method',
}

const ACTIVITY_LABEL: Record<ActivityState, string> = {
  active: 'Active',
  dormant: 'Dormant',
  neverSignedIn: 'Never signed in',
}

const TIER_LABEL: Record<MethodTier, string> = {
  phishingResistant: 'Phishing-resistant',
  passwordless: 'Passwordless',
  push: 'Push',
  otp: 'OTP',
  smsVoice: 'SMS/voice',
  none: '—',
}

export function MfaViabilityScreen({ tenantId }: { tenantId: string }) {
  const [scanState, setScanState] = useState<'idle' | 'running' | 'done' | 'failed'>('idle')
  const [sections, setSections] = useState<Record<string, SectionRow>>({})
  const [snapshot, setSnapshot] = useState<TenantSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [laneB, setLaneB] = useState<{ pages: number; rows: number; oldest: string | null } | null>(null)
  const [slow, setSlow] = useState(false)

  const scan = async () => {
    setScanState('running')
    setSections({})
    setSnapshot(null)
    setError(null)
    setLaneB(null)
    setSlow(false)
    const handle = startScan(tenantId, (m: WorkerOutMessage) => {
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

  // Redacted diagnostics bundle (docs/design/diagnostics.md): statuses,
  // timings, errors only — no UPNs, no user GUIDs, tenant id hashed.
  const downloadDiagnostics = async () => {
    const bundle = {
      generatedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      schemaVersion: snapshot?.schemaVersion ?? null,
      tenantIdHash: await hashTenantId(tenantId),
      sources: snapshot?.sources ?? null,
      sections: Object.values(sections),
    }
    const json = redactIdentifiers(JSON.stringify(bundle, null, 2))
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `iamai-diagnostics-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section>
      <h2>MFA viability</h2>
      <p>
        <button onClick={() => void scan()} disabled={scanState === 'running'}>
          {scanState === 'running' ? 'Scanning…' : snapshot ? 'Re-scan tenant' : 'Scan tenant'}
        </button>{' '}
        {(snapshot !== null || Object.keys(sections).length > 0) && (
          <button onClick={() => void downloadDiagnostics()}>Download diagnostics (redacted)</button>
        )}
      </p>
      {error && <p className="error">Scan failed: {error}</p>}
      {scanState === 'running' && slow && (
        <p className="notice">
          Graph is slow — still collecting sign-in evidence.
          {laneB?.oldest && <> Covered back to {new Date(laneB.oldest).toLocaleString()} so far.</>}
        </p>
      )}
      {scanState === 'running' && laneB && !slow && (
        <p className="reason">
          Sign-in evidence: {laneB.rows} rows over {laneB.pages} page{laneB.pages === 1 ? '' : 's'}
          {laneB.oldest && <>, covered back to {new Date(laneB.oldest).toLocaleString()}</>}…
        </p>
      )}

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
            Sign-in evidence: <strong>{snapshot.sources.signInEvidence.status}</strong>
            {snapshot.sources.signInEvidence.coveredWindow && (
              <>
                {' '}
                — covers {new Date(snapshot.sources.signInEvidence.coveredWindow.from).toLocaleDateString()} to{' '}
                {new Date(snapshot.sources.signInEvidence.coveredWindow.to).toLocaleDateString()}
              </>
            )}
            {snapshot.sources.signInEvidence.reason && <> ({snapshot.sources.signInEvidence.reason})</>}
            {snapshot.sources.signInEvidence.status === 'pending' && (
              <> — sign-in evidence hasn't been collected yet; states below are based on registered methods only</>
            )}
            {(snapshot.sources.signInEvidence.status === 'insufficient' ||
              snapshot.sources.signInEvidence.status === 'disabled' ||
              snapshot.sources.signInEvidence.status === 'error') && (
              <> — states below are metadata-only; nothing can be "verified" without usable evidence</>
            )}
            . Predicted impact, confirmed in report-only.
          </p>
          <div className="tiles">
            {(Object.keys(MFA_LABEL) as MfaState[]).map((state) => (
              <div key={state} className={`tile state-${state}`}>
                <div className="tile-count">{scored.summary.counts[state]}</div>
                <div className="tile-label">{MFA_LABEL[state]}</div>
              </div>
            ))}
            {(Object.keys(ACTIVITY_LABEL) as ActivityState[]).map((state) => (
              <div key={state} className="tile">
                <div className="tile-count">{scored.summary.activityCounts[state]}</div>
                <div className="tile-label">{ACTIVITY_LABEL[state]}</div>
              </div>
            ))}
            <div className="tile">
              <div className="tile-count">{scored.summary.verificationPhaseSize}</div>
              <div className="tile-label">Verification phase size</div>
            </div>
            {scored.summary.challengedRate !== null && (
              <div className="tile">
                <div className="tile-count">{Math.round(scored.summary.challengedRate * 100)}%</div>
                <div className="tile-label">Challenged rate</div>
              </div>
            )}
          </div>
          {snapshot.blockedToday.length > 0 && (
            <div className="notice">
              <strong>
                Blocked today:{' '}
                {new Set(snapshot.blockedToday.flatMap((b) => b.userIds)).size} user(s) whose most
                recent sign-in failed Conditional Access
              </strong>
              <ul>
                {snapshot.blockedToday.map((b) => (
                  <li key={b.policyId}>
                    {b.displayName ?? (b.policyId === 'unknown' ? 'No policy identified' : b.policyId)} —{' '}
                    {b.userIds.length} user(s):{' '}
                    {b.userIds
                      .map((id) => userById.get(id)?.displayName ?? userById.get(id)?.userPrincipalName ?? id)
                      .join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <table className="viability">
            <thead>
              <tr>
                <th>User</th>
                <th>Admin</th>
                <th>Activity</th>
                <th>MFA state</th>
                <th>Strongest method</th>
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
                      {ACTIVITY_LABEL[r.activity]}
                      {r.activity === 'neverSignedIn' && r.accountCreated && (
                        <span className="reason"> (created {new Date(r.accountCreated).toLocaleDateString()})</span>
                      )}
                    </td>
                    <td>
                      <span className={`chip state-${r.mfa}`}>{MFA_LABEL[r.mfa]}</span>
                    </td>
                    <td>{TIER_LABEL[r.strongestMethod]}</td>
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
