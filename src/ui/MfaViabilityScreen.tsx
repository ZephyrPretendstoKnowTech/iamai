import { useMemo, useState } from 'react'
import { hashTenantId, redactIdentifiers } from '../redact.ts'
import { startScan } from '../graph/collect/runScan.ts'
import type { SectionEvent, TenantSnapshot, UserRow, WorkerOutMessage } from '../graph/collect/types.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { scoreMfaViability, sortViability, summarizeTenant } from '../scoring/mfaViability.ts'
import type { ActivityState, MethodTier, MfaState, MfaViability } from '../scoring/mfaViability.ts'
import { absolute, absoluteDate, downloadFile, relative, toCsv } from './format.ts'

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

// Hover definitions for every state and tile (the legend uses the same text).
const DEFS: Record<string, string> = {
  Verified: 'Completed MFA in the collected sign-in window — proven, not assumed.',
  'Likely viable':
    'A positive signal (current Authenticator, recent registration, or a recently active Windows Hello device) suggests MFA would succeed if required.',
  'Not challenged':
    'Signed in during the evidence window but nothing ever required MFA of them — enforcement is their first real test.',
  Unverified: 'MFA-capable on paper with no usage signal — verify before enforcing.',
  'No method': 'No MFA-capable method registered. Email and security questions do not count.',
  Active: 'Successful sign-in within the last 90 days.',
  Dormant: 'No successful sign-in for more than 90 days — planned separately, never counted as an MFA success.',
  'Never signed in': 'No successful sign-in on record; the account creation date is shown.',
  'Verification phase size':
    'Active users whose MFA state is Unverified, Not challenged, or No method — the population to verify before any MFA enforcement step.',
  'Challenged rate':
    'Of the users active in the evidence window, the share who actually completed MFA. A low rate with many Not challenged means enforcement is largely untested.',
  'Phishing-resistant': 'Passkeys / FIDO2 security keys, Windows Hello for Business, or certificates.',
  Passwordless: 'Microsoft Authenticator passwordless phone sign-in.',
  Push: 'Microsoft Authenticator push approval.',
  OTP: 'Software or hardware one-time passcodes.',
  'SMS/voice': 'Phone-based methods only — works, but the weakest tier.',
}

// Plain-language wording in the cell; the version numbers live in the tooltip.
function displayReason(r: string): { text: string; title?: string } {
  if (r.startsWith('Authenticator version stale')) return { text: 'Authenticator app out of date', title: r }
  if (r.startsWith('Authenticator current')) return { text: 'Authenticator app up to date', title: r }
  return { text: r }
}

type SortKey = 'name' | 'admin' | 'activity' | 'mfa' | 'method' | 'reasons'

const MFA_ORDER: MfaState[] = ['none', 'unverified', 'notChallenged', 'likelyViable', 'verified']
const ACTIVITY_ORDER: ActivityState[] = ['active', 'dormant', 'neverSignedIn']
const TIER_ORDER: MethodTier[] = ['phishingResistant', 'passwordless', 'push', 'otp', 'smsVoice', 'none']

export function MfaViabilityScreen({ tenantId }: { tenantId: string }) {
  const [scanState, setScanState] = useState<'idle' | 'running' | 'done' | 'failed'>('idle')
  const [sections, setSections] = useState<Record<string, SectionRow>>({})
  const [snapshot, setSnapshot] = useState<TenantSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [laneB, setLaneB] = useState<{ pages: number; rows: number; oldest: string | null } | null>(null)
  const [slow, setSlow] = useState(false)
  const [mfaFilter, setMfaFilter] = useState<Set<MfaState>>(new Set())
  const [activityFilter, setActivityFilter] = useState<Set<ActivityState>>(new Set())
  const [tierFilter, setTierFilter] = useState<Set<MethodTier>>(new Set())
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null)

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
    () => new Map<string, UserRow>((snapshot?.users ?? []).map((u) => [u.id, u])),
    [snapshot],
  )

  const visibleRows = useMemo(() => {
    if (!scored) return []
    const q = search.trim().toLowerCase()
    let rows = scored.rows.filter((r) => {
      if (mfaFilter.size > 0 && !mfaFilter.has(r.mfa)) return false
      if (activityFilter.size > 0 && !activityFilter.has(r.activity)) return false
      if (tierFilter.size > 0 && !tierFilter.has(r.strongestMethod)) return false
      if (q) {
        const u = userById.get(r.userId)
        const hay = `${u?.displayName ?? ''} ${u?.userPrincipalName ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    if (sort) {
      const name = (r: MfaViability) => {
        const u = userById.get(r.userId)
        return (u?.displayName ?? u?.userPrincipalName ?? r.userId).toLowerCase()
      }
      const val: Record<SortKey, (r: MfaViability) => string | number> = {
        name,
        admin: (r) => (r.isAdmin ? 0 : 1),
        activity: (r) => ACTIVITY_ORDER.indexOf(r.activity),
        mfa: (r) => MFA_ORDER.indexOf(r.mfa),
        method: (r) => TIER_ORDER.indexOf(r.strongestMethod),
        reasons: (r) => r.reasons.join('; ').toLowerCase(),
      }
      const f = val[sort.key]
      rows = [...rows].sort((a, b) => {
        const va = f(a)
        const vb = f(b)
        return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir
      })
    }
    return rows
  }, [scored, mfaFilter, activityFilter, tierFilter, search, sort, userById])

  const toggle = <T,>(set: Set<T>, value: T, apply: (s: Set<T>) => void) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    apply(next)
  }

  const headerClick = (key: SortKey) =>
    setSort((s) => (s?.key === key ? (s.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 }))

  const sortMark = (key: SortKey) => (sort?.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : '')

  const exportCsv = () => {
    const rows = visibleRows.map((r) => {
      const u = userById.get(r.userId)
      return [
        u?.displayName ?? '',
        u?.userPrincipalName ?? r.userId,
        r.isAdmin ? 'yes' : '',
        ACTIVITY_LABEL[r.activity],
        r.accountCreated ?? '',
        MFA_LABEL[r.mfa],
        TIER_LABEL[r.strongestMethod],
        r.methodTiers.map((t) => TIER_LABEL[t]).join('; '),
        r.reasons.join('; '),
        r.evidence ? `${r.evidence.method} at ${r.evidence.at}` : '',
      ]
    })
    downloadFile(
      'iamai-readiness.csv',
      toCsv(
        ['Name', 'UPN', 'Admin', 'Activity', 'Account created', 'MFA state', 'Strongest method', 'Method tiers', 'Reasons', 'Evidence'],
        rows,
      ),
      'text/csv',
    )
  }

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
    downloadFile(`iamai-diagnostics-${Date.now()}.json`, json, 'application/json')
  }

  const evidence = snapshot?.sources.signInEvidence

  return (
    <section>
      <h2>Readiness</h2>
      <p>
        <button onClick={() => void scan()} disabled={scanState === 'running'}>
          {scanState === 'running' ? 'Scanning…' : snapshot ? 'Re-scan tenant' : 'Scan tenant'}
        </button>{' '}
        {scored && <button onClick={exportCsv}>Export CSV ({visibleRows.length} rows)</button>}{' '}
        {(snapshot !== null || Object.keys(sections).length > 0) && (
          <button onClick={() => void downloadDiagnostics()}>Download diagnostics (redacted)</button>
        )}
      </p>
      {error && <p className="error">Scan failed: {error}</p>}
      {scanState === 'running' && slow && (
        <p className="notice">
          Graph is slow — still collecting sign-in evidence.
          {laneB?.oldest && <> Covered back to <span title={absolute(laneB.oldest)}>{relative(laneB.oldest)}</span> so far.</>}
        </p>
      )}
      {scanState === 'running' && laneB && !slow && (
        <p className="reason">
          Sign-in evidence: {laneB.rows} rows over {laneB.pages} page{laneB.pages === 1 ? '' : 's'}
          {laneB.oldest && <>, covered back to <span title={absolute(laneB.oldest)}>{relative(laneB.oldest)}</span></>}…
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

      {scored && snapshot && evidence && (
        <>
          <p className="notice">
            Sign-in evidence: <strong>{evidence.status}</strong>
            {evidence.coveredWindow && (
              <>
                {' '}
                — covers {absoluteDate(evidence.coveredWindow.from)} to {absoluteDate(evidence.coveredWindow.to)}
              </>
            )}
            {evidence.reason && <> ({evidence.reason})</>}
            {evidence.status === 'pending' && (
              <> — sign-in evidence hasn't been collected yet; states below are based on registered methods only</>
            )}
            {(evidence.status === 'insufficient' || evidence.status === 'disabled' || evidence.status === 'error') && (
              <> — states below are metadata-only; nothing can be "verified" without usable evidence</>
            )}
            . Predicted impact, confirmed in report-only.
          </p>

          <div className="tiles">
            {(Object.keys(MFA_LABEL) as MfaState[]).map((state) => (
              <button
                key={state}
                className={`tile state-${state} ${mfaFilter.has(state) ? 'selected' : ''}`}
                title={DEFS[MFA_LABEL[state]]}
                onClick={() => toggle(mfaFilter, state, setMfaFilter)}
              >
                <div className="tile-count">{scored.summary.counts[state]}</div>
                <div className="tile-label">{MFA_LABEL[state]}</div>
              </button>
            ))}
            {(Object.keys(ACTIVITY_LABEL) as ActivityState[]).map((state) => (
              <button
                key={state}
                className={`tile ${activityFilter.has(state) ? 'selected' : ''}`}
                title={DEFS[ACTIVITY_LABEL[state]]}
                onClick={() => toggle(activityFilter, state, setActivityFilter)}
              >
                <div className="tile-count">{scored.summary.activityCounts[state]}</div>
                <div className="tile-label">{ACTIVITY_LABEL[state]}</div>
              </button>
            ))}
            <div className="tile" title={DEFS['Verification phase size']}>
              <div className="tile-count">{scored.summary.verificationPhaseSize}</div>
              <div className="tile-label">Verification phase size</div>
            </div>
            {scored.summary.challengedRate !== null && (
              <div className="tile" title={DEFS['Challenged rate']}>
                <div className="tile-count">{Math.round(scored.summary.challengedRate * 100)}%</div>
                <div className="tile-label">Challenged rate</div>
              </div>
            )}
          </div>

          {snapshot.blockedToday.length > 0 && (
            <div className="notice">
              <strong>
                Blocked today: {new Set(snapshot.blockedToday.flatMap((b) => b.userIds)).size} user(s) whose most
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

          <div className="filters">
            <input
              type="search"
              placeholder="Search name or UPN…"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
            {(Object.keys(MFA_LABEL) as MfaState[]).map((s) => (
              <button
                key={s}
                className={`chip state-${s} ${mfaFilter.has(s) ? 'selected' : ''}`}
                title={DEFS[MFA_LABEL[s]]}
                onClick={() => toggle(mfaFilter, s, setMfaFilter)}
              >
                {MFA_LABEL[s]}
              </button>
            ))}
            {(Object.keys(ACTIVITY_LABEL) as ActivityState[]).map((s) => (
              <button
                key={s}
                className={`chip ${activityFilter.has(s) ? 'selected' : ''}`}
                title={DEFS[ACTIVITY_LABEL[s]]}
                onClick={() => toggle(activityFilter, s, setActivityFilter)}
              >
                {ACTIVITY_LABEL[s]}
              </button>
            ))}
            {TIER_ORDER.filter((t) => t !== 'none').map((t) => (
              <button
                key={t}
                className={`chip ${tierFilter.has(t) ? 'selected' : ''}`}
                title={DEFS[TIER_LABEL[t]]}
                onClick={() => toggle(tierFilter, t, setTierFilter)}
              >
                {TIER_LABEL[t]}
              </button>
            ))}
            {(mfaFilter.size > 0 || activityFilter.size > 0 || tierFilter.size > 0 || search) && (
              <button
                className="chip"
                onClick={() => {
                  setMfaFilter(new Set())
                  setActivityFilter(new Set())
                  setTierFilter(new Set())
                  setSearch('')
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          <table className="viability">
            <thead>
              <tr>
                <th className="sortable" onClick={() => headerClick('name')}>User{sortMark('name')}</th>
                <th className="sortable" onClick={() => headerClick('admin')}>Admin{sortMark('admin')}</th>
                <th className="sortable" onClick={() => headerClick('activity')}>Activity{sortMark('activity')}</th>
                <th className="sortable" onClick={() => headerClick('mfa')}>MFA state{sortMark('mfa')}</th>
                <th className="sortable" onClick={() => headerClick('method')}>Strongest method{sortMark('method')}</th>
                <th className="sortable" onClick={() => headerClick('reasons')}>Reasons{sortMark('reasons')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r: MfaViability) => {
                const u = userById.get(r.userId)
                return (
                  <tr key={r.userId}>
                    <td>
                      {u?.displayName ?? u?.userPrincipalName ?? r.userId}
                      {u?.userType === 'guest' && <span className="chip">guest</span>}
                      {u?.userPrincipalName && <div className="sub">{u.userPrincipalName}</div>}
                    </td>
                    <td>{r.isAdmin ? 'yes' : ''}</td>
                    <td>
                      <span title={DEFS[ACTIVITY_LABEL[r.activity]]}>{ACTIVITY_LABEL[r.activity]}</span>
                      {r.activity === 'neverSignedIn' && r.accountCreated && (
                        <div className="sub" title={absolute(r.accountCreated)}>
                          created {relative(r.accountCreated)}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`chip state-${r.mfa}`} title={DEFS[MFA_LABEL[r.mfa]]}>
                        {MFA_LABEL[r.mfa]}
                      </span>
                    </td>
                    <td title={r.methodTiers.map((t) => TIER_LABEL[t]).join(', ') || undefined}>
                      {TIER_LABEL[r.strongestMethod]}
                    </td>
                    <td>
                      {r.evidence && (
                        <span title={absolute(r.evidence.at)}>
                          MFA via {r.evidence.method} {relative(r.evidence.at)}
                        </span>
                      )}
                      {r.reasons.map((reason, i) => {
                        const d = displayReason(reason)
                        return (
                          <span key={i} title={d.title}>
                            {i > 0 || r.evidence ? '; ' : ''}
                            {d.text}
                          </span>
                        )
                      })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <details className="legend">
            <summary>Legend</summary>
            <dl>
              {Object.entries(DEFS).map(([term, def]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{def}</dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      )}
    </section>
  )
}
