import { useEffect, useMemo, useState } from 'react'
import { hashTenantId, redactIdentifiers } from '../redact.ts'
import { startScan } from '../graph/collect/runScan.ts'
import type { SectionEvent, TenantSnapshot, UserRow, WorkerOutMessage } from '../graph/collect/types.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { scoreMfaViability, sortViability, summarizeTenant } from '../scoring/mfaViability.ts'
import type { ActivityState, MethodTier, MfaState, MfaViability } from '../scoring/mfaViability.ts'
import { absolute, absoluteDate, downloadFile, elapsedLabel, friendlyMethod, relative } from './format.ts'
import { loadMappingState } from '../mapping/store.ts'
import { StepFrame } from './shell/AppShell.tsx'
import { Button, Callout, Chip, DataTable, ExpandCard, FilterChip, ProgressBar, StatTile, Stats } from './components/index.ts'
import type { ChipStatus, Column } from './components/index.ts'

type SectionRow = { source: string; status: string; rows?: number; reason?: string; ms?: number }

const MFA_LABEL: Record<MfaState, string> = {
  verified: 'Verified',
  likelyViable: 'Likely viable',
  notChallenged: 'Not challenged',
  unverified: 'Unverified',
  none: 'No method',
}

const MFA_CHIP: Record<MfaState, ChipStatus> = {
  verified: 'done',
  likelyViable: 'ready',
  notChallenged: 'warning',
  unverified: 'warning',
  none: 'blocked',
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

// Definitions behind every number a user sees (InfoTip + legend).
const DEFS: Record<string, string> = {
  Verified: 'Completed MFA in the collected sign-in window — proven, not assumed.',
  'Likely viable':
    'A positive signal (current Authenticator, recent registration, or a recently active Windows Hello device) suggests MFA would succeed if required.',
  'Not challenged': 'Signed in during the window but nothing ever required MFA of them — enforcement is their first real test.',
  Unverified: 'MFA-capable on paper with no usage signal — verify before enforcing.',
  'No method': 'No MFA-capable method registered. Email and security questions do not count.',
  Active: 'Successful sign-in within the last 90 days.',
  Dormant: 'No successful sign-in for more than 90 days — planned separately, never counted as an MFA success.',
  'Never signed in': 'No successful sign-in on record; the account creation date is shown.',
  'Verification phase size': 'Active users whose MFA state is Unverified, Not challenged, or No method — the population to verify before any MFA enforcement step.',
  'Challenged rate': 'Of the users active in the sign-in window, the share who actually completed MFA.',
  'Phishing-resistant': 'Passkeys / FIDO2 security keys, Windows Hello for Business, or certificates.',
  Passwordless: 'Microsoft Authenticator passwordless phone sign-in.',
  Push: 'Microsoft Authenticator push approval.',
  OTP: 'Software or hardware one-time passcodes.',
  'SMS/voice': 'Phone-based methods only — works, but the weakest tier.',
}

function displayReason(r: string): { text: string; title?: string } {
  if (r.startsWith('Authenticator version stale')) return { text: 'Authenticator app out of date', title: r }
  if (r.startsWith('Authenticator current')) return { text: 'Authenticator app up to date', title: r }
  return { text: r }
}

const MFA_ORDER: MfaState[] = ['none', 'unverified', 'notChallenged', 'likelyViable', 'verified']
const ACTIVITY_ORDER: ActivityState[] = ['active', 'dormant', 'neverSignedIn']
const TIER_ORDER: MethodTier[] = ['phishingResistant', 'passwordless', 'push', 'otp', 'smsVoice', 'none']

// Friendly labels for the collection sections (no developer vocabulary).
const SECTION_LABEL: Record<string, string> = {
  'config:caPolicies': 'Conditional Access policies',
  'config:namedLocations': 'Named locations',
  'config:authStrengths': 'Authentication strengths',
  'config:authMethodsPolicy': 'Authentication methods policy',
  'config:securityDefaults': 'Security defaults',
  'config:crossTenantAccess': 'Cross-tenant access',
  'config:roleAssignments': 'Role assignments',
  'config:pimEligibility': 'PIM eligibility',
  'config:subscribedSkus': 'Licences',
  'config:organization': 'Organisation',
  'config:me': 'Your account',
  'config:meMemberOf': 'Your groups',
  registrationDetails: 'MFA registration',
  users: 'People',
  devices: 'Devices',
  spActivity: 'Service principal activity',
  authMethods: 'Registered methods',
  appSignInSummary: 'App usage',
  signInEvidence: 'Sign-in records',
}

const TOTAL_SECTIONS = Object.keys(SECTION_LABEL).length

type Row = MfaViability & { user: UserRow | undefined; name: string }

export function MfaViabilityScreen({
  tenantId,
  initial,
  onRunningChange,
  onComplete,
}: {
  tenantId: string
  initial: { snapshot: TenantSnapshot; at: string } | null
  onRunningChange: (running: boolean) => void
  onComplete: (snapshot: TenantSnapshot, at: string) => void
}) {
  const [scanState, setScanState] = useState<'idle' | 'running' | 'done' | 'failed'>(initial ? 'done' : 'idle')
  const [sections, setSections] = useState<Record<string, SectionRow>>({})
  const [snapshot, setSnapshot] = useState<TenantSnapshot | null>(initial?.snapshot ?? null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [nowTick, setNowTick] = useState(Date.now())
  const [highCare, setHighCare] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [laneB, setLaneB] = useState<{ pages: number; rows: number; oldest: string | null } | null>(null)
  const [slow, setSlow] = useState(false)
  const [mfaFilter, setMfaFilter] = useState<Set<MfaState>>(new Set())
  const [activityFilter, setActivityFilter] = useState<Set<ActivityState>>(new Set())
  const [tierFilter, setTierFilter] = useState<Set<MethodTier>>(new Set())
  const [search, setSearch] = useState('')

  useEffect(() => {
    void loadMappingState(tenantId).then((m) => setHighCare(new Set(m.highCareUserIds)))
  }, [tenantId])

  useEffect(() => {
    if (scanState !== 'running') return
    const t = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [scanState])

  const scan = async () => {
    setScanState('running')
    onRunningChange(true)
    setStartedAt(Date.now())
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
      setSections((prev) => ({ ...prev, [s.source]: { source: s.source, status: s.status, rows: s.rows, reason: s.reason, ms: s.ms } }))
    })
    try {
      const result = await handle.done
      setSnapshot(result)
      setScanState('done')
      onComplete(result, new Date().toISOString())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setScanState('failed')
    } finally {
      onRunningChange(false)
    }
  }

  const scored = useMemo(() => {
    if (!snapshot) return null
    const rows = sortViability(buildViabilityInputs(snapshot, new Date().toISOString()).map(scoreMfaViability))
    return { rows, summary: summarizeTenant(rows) }
  }, [snapshot])

  const userById = useMemo(() => new Map<string, UserRow>((snapshot?.users ?? []).map((u) => [u.id, u])), [snapshot])

  const visibleRows: Row[] = useMemo(() => {
    if (!scored) return []
    const q = search.trim().toLowerCase()
    return scored.rows
      .map((r) => {
        const user = userById.get(r.userId)
        return { ...r, user, name: user?.displayName ?? user?.userPrincipalName ?? r.userId }
      })
      .filter((r) => {
        if (mfaFilter.size > 0 && !mfaFilter.has(r.mfa)) return false
        if (activityFilter.size > 0 && !activityFilter.has(r.activity)) return false
        if (tierFilter.size > 0 && !tierFilter.has(r.strongestMethod)) return false
        if (q && !`${r.user?.displayName ?? ''} ${r.user?.userPrincipalName ?? ''}`.toLowerCase().includes(q)) return false
        return true
      })
  }, [scored, mfaFilter, activityFilter, tierFilter, search, userById])

  const toggle = <T,>(set: Set<T>, value: T, apply: (s: Set<T>) => void) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    apply(next)
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
    downloadFile(`iamai-diagnostics-${Date.now()}.json`, redactIdentifiers(JSON.stringify(bundle, null, 2)), 'application/json')
  }

  const evidence = snapshot?.sources.signInEvidence
  const finishedSections = Object.values(sections).filter((s) => s.status !== 'started').length
  const progressPercent = scanState === 'running' ? Math.min(95, Math.round((finishedSections / TOTAL_SECTIONS) * 100)) : null
  const nowLine =
    scanState !== 'running'
      ? undefined
      : laneB
        ? `Reading sign-in records — ${laneB.rows} so far${laneB.oldest ? `, back to ${absoluteDate(laneB.oldest)}` : ''}${startedAt !== null ? ` · ${elapsedLabel(startedAt, nowTick)} elapsed` : ''}`
        : `Reading configuration and inventory (${finishedSections} of ${TOTAL_SECTIONS})${startedAt !== null ? ` · ${elapsedLabel(startedAt, nowTick)} elapsed` : ''}`

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'User',
      sortValue: (r) => r.name.toLowerCase(),
      csv: (r) => r.name,
      render: (r) => (
        <>
          {r.name}
          {r.user?.userType === 'guest' && <Chip>guest</Chip>}
          {highCare.has(r.userId) && (
            <Chip status="warning" title="Handle with care — verified before enforcement, sequenced last">
              care
            </Chip>
          )}
          {r.user?.userPrincipalName && <div className="sub">{r.user.userPrincipalName}</div>}
        </>
      ),
    },
    { key: 'upn', header: 'UPN', hidden: true, render: () => null, csv: (r) => r.user?.userPrincipalName ?? '' },
    { key: 'admin', header: 'Admin', sortValue: (r) => (r.isAdmin ? 0 : 1), csv: (r) => (r.isAdmin ? 'yes' : ''), render: (r) => (r.isAdmin ? 'yes' : '') },
    {
      key: 'activity',
      header: 'Activity',
      sortValue: (r) => ACTIVITY_ORDER.indexOf(r.activity),
      csv: (r) => ACTIVITY_LABEL[r.activity],
      render: (r) => (
        <>
          <span title={DEFS[ACTIVITY_LABEL[r.activity]]}>{ACTIVITY_LABEL[r.activity]}</span>
          {r.activity === 'neverSignedIn' && r.accountCreated && (
            <div className="sub" title={absolute(r.accountCreated)}>
              created {relative(r.accountCreated)}
            </div>
          )}
        </>
      ),
    },
    {
      key: 'mfa',
      header: 'MFA state',
      sortValue: (r) => MFA_ORDER.indexOf(r.mfa),
      csv: (r) => MFA_LABEL[r.mfa],
      render: (r) => (
        <Chip status={MFA_CHIP[r.mfa]} title={DEFS[MFA_LABEL[r.mfa]]}>
          {MFA_LABEL[r.mfa]}
        </Chip>
      ),
    },
    {
      key: 'method',
      header: 'Strongest method',
      sortValue: (r) => TIER_ORDER.indexOf(r.strongestMethod),
      csv: (r) => TIER_LABEL[r.strongestMethod],
      render: (r) => <span title={r.methodTiers.map((t) => TIER_LABEL[t]).join(', ') || undefined}>{TIER_LABEL[r.strongestMethod]}</span>,
    },
    {
      key: 'reasons',
      header: 'Reasons',
      sortValue: (r) => r.reasons.join('; ').toLowerCase(),
      csv: (r) => r.reasons.join('; '),
      render: (r) => (
        <>
          {r.evidence &&
            (() => {
              const name = friendlyMethod(r.evidence.method)
              return <span title={absolute(r.evidence.at)}>{name ? `MFA via ${name} ${relative(r.evidence.at)}` : `MFA completed ${relative(r.evidence.at)}`}</span>
            })()}
          {r.reasons.map((reason, i) => {
            const d = displayReason(reason)
            return (
              <span key={i} title={d.title}>
                {i > 0 || r.evidence ? '; ' : ''}
                {d.text}
              </span>
            )
          })}
        </>
      ),
    },
    { key: 'care', header: 'Handle with care', hidden: true, render: () => null, csv: (r) => (highCare.has(r.userId) ? 'yes' : '') },
  ]

  return (
    <StepFrame
      title="Scan"
      does="Reads your tenant's configuration, inventory, and sign-in records into a local snapshot — nothing is written, and nothing leaves your browser."
      needs={[{ met: true, text: 'connected tenant' }]}
      next={snapshot ? 'mapping' : undefined}
      nextLabel="Setup"
    >
      <p className="row">
        <Button variant="primary" icon="refresh" onClick={() => void scan()} loading={scanState === 'running'}>
          {snapshot ? 'Re-scan tenant' : 'Scan tenant'}
        </Button>
        {(snapshot !== null || Object.keys(sections).length > 0) && (
          <Button icon="download" onClick={() => void downloadDiagnostics()}>
            Download diagnostics (redacted)
          </Button>
        )}
      </p>
      {error && <Callout kind="danger" title="Scan failed.">{error}</Callout>}
      {scanState !== 'running' && initial && snapshot === initial.snapshot && (
        <Callout kind="info">
          Using the scan from <strong title={absolute(initial.at)}>{relative(initial.at)}</strong>, saved on this device. Re-scan any time for fresh numbers.
        </Callout>
      )}
      {scanState === 'running' && <ProgressBar percent={laneB ? null : progressPercent} caption={nowLine} />}
      {scanState === 'running' && slow && (
        <Callout kind="warning">Microsoft's sign-in record service is slow right now — this can take several minutes on larger tenants. Everything else is already collected.</Callout>
      )}

      {Object.keys(sections).length > 0 && (
        <ExpandCard summary="Details" open={false}>
          <ul className="sections">
            {Object.values(sections).map((s) => (
              <li key={s.source}>
                {SECTION_LABEL[s.source] ?? s.source}: {s.status === 'started' ? 'reading…' : s.status}
                {s.rows !== undefined && ` — ${s.rows} item${s.rows === 1 ? '' : 's'}`}
                {s.reason && <span className="muted"> ({s.reason})</span>}
              </li>
            ))}
          </ul>
        </ExpandCard>
      )}

      {scored && snapshot && evidence && (
        <>
          <h3>Readiness</h3>
          <Callout kind={evidence.status === 'ok' ? 'success' : evidence.status === 'partial' ? 'info' : 'warning'}>
            Sign-in records: <strong>{evidence.status === 'ok' ? 'complete' : evidence.status}</strong>
            {evidence.coveredWindow && <> — covering {absoluteDate(evidence.coveredWindow.from)} to {absoluteDate(evidence.coveredWindow.to)}</>}
            {evidence.reason && <> ({evidence.reason})</>}
            {evidence.status === 'pending' && <>. Sign-in records haven't been collected yet; states below are based on registered methods only</>}
            {(evidence.status === 'insufficient' || evidence.status === 'disabled' || evidence.status === 'error') && (
              <>. States below are based on registered methods only; nothing can be "verified" without usable records</>
            )}
            .
          </Callout>

          <h4>MFA state</h4>
          <Stats>
            {(Object.keys(MFA_LABEL) as MfaState[]).map((state) => (
              <StatTile
                key={state}
                value={scored.summary.counts[state]}
                label={MFA_LABEL[state]}
                tone={state === 'verified' ? 'success' : state === 'likelyViable' ? 'info' : state === 'none' ? 'danger' : 'warning'}
                tip={{ title: MFA_LABEL[state], text: DEFS[MFA_LABEL[state]] }}
                onClick={() => toggle(mfaFilter, state, setMfaFilter)}
                active={mfaFilter.has(state)}
              />
            ))}
          </Stats>
          <h4>Activity</h4>
          <Stats>
            {(Object.keys(ACTIVITY_LABEL) as ActivityState[]).map((state) => (
              <StatTile
                key={state}
                value={scored.summary.activityCounts[state]}
                label={ACTIVITY_LABEL[state]}
                tip={{ title: ACTIVITY_LABEL[state], text: DEFS[ACTIVITY_LABEL[state]] }}
                onClick={() => toggle(activityFilter, state, setActivityFilter)}
                active={activityFilter.has(state)}
              />
            ))}
          </Stats>
          <h4>Rollout</h4>
          <Stats>
            <StatTile value={scored.summary.verificationPhaseSize} label="Verification phase size" tip={{ title: 'Verification phase size', text: DEFS['Verification phase size'] }} />
            {scored.summary.challengedRate !== null && (
              <StatTile value={`${Math.round(scored.summary.challengedRate * 100)}%`} label="Challenged rate" tip={{ title: 'Challenged rate', text: DEFS['Challenged rate'] }} />
            )}
          </Stats>

          {snapshot.blockedToday.length > 0 && (
            <Callout kind="danger" title={`Blocked today: ${new Set(snapshot.blockedToday.flatMap((b) => b.userIds)).size} user(s) whose most recent sign-in failed Conditional Access.`}>
              <ul className="sections">
                {snapshot.blockedToday.map((b) => (
                  <li key={b.policyId}>
                    {b.displayName ?? (b.policyId === 'unknown' ? 'No policy identified' : b.policyId)} — {b.userIds.length} user(s):{' '}
                    {b.userIds.map((id) => userById.get(id)?.displayName ?? userById.get(id)?.userPrincipalName ?? id).join(', ')}
                  </li>
                ))}
              </ul>
            </Callout>
          )}

          <div className="row no-print">
            <input type="search" placeholder="Search name or UPN…" aria-label="Search users" value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
            {(Object.keys(MFA_LABEL) as MfaState[]).map((s) => (
              <FilterChip key={s} selected={mfaFilter.has(s)} title={DEFS[MFA_LABEL[s]]} onToggle={() => toggle(mfaFilter, s, setMfaFilter)}>
                {MFA_LABEL[s]}
              </FilterChip>
            ))}
            {(Object.keys(ACTIVITY_LABEL) as ActivityState[]).map((s) => (
              <FilterChip key={s} selected={activityFilter.has(s)} title={DEFS[ACTIVITY_LABEL[s]]} onToggle={() => toggle(activityFilter, s, setActivityFilter)}>
                {ACTIVITY_LABEL[s]}
              </FilterChip>
            ))}
            {TIER_ORDER.filter((t) => t !== 'none').map((t) => (
              <FilterChip key={t} selected={tierFilter.has(t)} title={DEFS[TIER_LABEL[t]]} onToggle={() => toggle(tierFilter, t, setTierFilter)}>
                {TIER_LABEL[t]}
              </FilterChip>
            ))}
            {(mfaFilter.size > 0 || activityFilter.size > 0 || tierFilter.size > 0 || search) && (
              <Button
                size="sm"
                variant="quiet"
                onClick={() => {
                  setMfaFilter(new Set())
                  setActivityFilter(new Set())
                  setTierFilter(new Set())
                  setSearch('')
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          <DataTable rows={visibleRows} columns={columns} rowKey={(r) => r.userId} csvName="iamai-readiness.csv" empty="No users match these filters." />

          <ExpandCard summary="Legend">
            <dl className="legend">
              {Object.entries(DEFS).map(([term, def]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{def}</dd>
                </div>
              ))}
            </dl>
          </ExpandCard>
        </>
      )}
    </StepFrame>
  )
}
