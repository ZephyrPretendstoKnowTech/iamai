import { useEffect, useMemo, useState } from 'react'
import { hashTenantId, redactIdentifiers } from '../redact.ts'
import { startScan } from '../graph/collect/runScan.ts'
import type { SectionEvent, TenantSnapshot, UserRow, WorkerOutMessage } from '../graph/collect/types.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { scoreMfaViability, sortViability, summarizeTenant } from '../scoring/mfaViability.ts'
import type { ActivityState, MethodTier, MfaState, MfaViability } from '../scoring/mfaViability.ts'
import { absolute, absoluteDate, downloadFile, elapsedLabel, friendlyMethod, relative, whenAt } from './format.ts'
import { loadMappingState } from '../mapping/store.ts'
import { SCAN } from '../copy/pages.ts'
import { ACTIVITY_STATE, CHIP, LEGEND, METHOD_TIER, MFA_STATE, TILE } from '../copy/definitions.ts'
import { StepFrame } from './shell/AppShell.tsx'
import { Button, Callout, Card, Chip, DataTable, ExpandCard, FilterChip, LinkButton, ProgressBar, StatTile, Stats, Tabs } from './components/index.ts'
import type { ChipStatus, Column } from './components/index.ts'
import { InventoryPage } from './pages/InventoryPage.tsx'

const DEV = import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === '1'

type SectionRow = { source: string; status: string; rows?: number; reason?: string; ms?: number }

const MFA_CHIP: Record<MfaState, ChipStatus> = {
  verified: 'done',
  likelyViable: 'ready',
  notChallenged: 'warning',
  unverified: 'warning',
  none: 'blocked',
}

function displayReason(r: string): { text: string; title?: string } {
  if (r.startsWith('Authenticator version stale')) return { text: SCAN.authenticatorStale, title: r }
  if (r.startsWith('Authenticator current')) return { text: SCAN.authenticatorCurrent, title: r }
  return { text: r }
}

const MFA_ORDER: MfaState[] = ['none', 'unverified', 'notChallenged', 'likelyViable', 'verified']
const ACTIVITY_ORDER: ActivityState[] = ['active', 'dormant', 'neverSignedIn']
const TIER_ORDER: MethodTier[] = ['phishingResistant', 'passwordless', 'push', 'otp', 'smsVoice', 'none']
const TOTAL_SECTIONS = Object.keys(SCAN.sections).length

type Row = MfaViability & { user: UserRow | undefined; name: string }

export function MfaViabilityScreen({
  tenantId,
  initial,
  onRunningChange,
  onComplete,
  view = 'readiness',
}: {
  tenantId: string
  initial: { snapshot: TenantSnapshot; at: string } | null
  onRunningChange: (running: boolean) => void
  onComplete: (snapshot: TenantSnapshot, at: string) => void
  view?: 'readiness' | 'inventory'
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
  const sectionList = Object.values(sections).filter((s) => s.source !== 'signInEvidence')
  const finishedSections = sectionList.filter((s) => s.status !== 'started').length
  const sectionTotal = TOTAL_SECTIONS - 1
  const sectionsPercent = Math.min(100, Math.round((finishedSections / sectionTotal) * 100))
  const inProgress = sectionList.filter((s) => s.status === 'started').map((s) => SCAN.sections[s.source] ?? s.source)
  const elapsed = startedAt !== null ? elapsedLabel(startedAt, nowTick) : null
  const signInSection = sections['signInEvidence']

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: SCAN.columns.user,
      sortValue: (r) => r.name.toLowerCase(),
      csv: (r) => r.name,
      render: (r) => (
        <>
          {r.name}
          {r.user?.userType === 'guest' && <Chip title={CHIP.guest.text}>{SCAN.guest}</Chip>}
          {highCare.has(r.userId) && (
            <Chip status="warning" title={CHIP.care.text}>
              {SCAN.care}
            </Chip>
          )}
          {r.user?.userPrincipalName && <div className="sub">{r.user.userPrincipalName}</div>}
        </>
      ),
    },
    { key: 'upn', header: SCAN.columns.signInAddress, hidden: true, render: () => null, csv: (r) => r.user?.userPrincipalName ?? '' },
    { key: 'admin', header: SCAN.columns.admin, sortValue: (r) => (r.isAdmin ? 0 : 1), csv: (r) => (r.isAdmin ? SCAN.yes : ''), render: (r) => (r.isAdmin ? SCAN.yes : '') },
    {
      key: 'activity',
      header: SCAN.columns.activity,
      sortValue: (r) => ACTIVITY_ORDER.indexOf(r.activity),
      csv: (r) => ACTIVITY_STATE[r.activity].title,
      render: (r) => (
        <>
          <span title={ACTIVITY_STATE[r.activity].text}>{ACTIVITY_STATE[r.activity].title}</span>
          {r.activity === 'neverSignedIn' && r.accountCreated && (
            <div className="sub" title={absolute(r.accountCreated)}>
              {SCAN.createdAgo(relative(r.accountCreated))}
            </div>
          )}
        </>
      ),
    },
    {
      key: 'mfa',
      header: SCAN.columns.mfa,
      sortValue: (r) => MFA_ORDER.indexOf(r.mfa),
      csv: (r) => MFA_STATE[r.mfa].title,
      render: (r) => (
        <Chip status={MFA_CHIP[r.mfa]} title={MFA_STATE[r.mfa].text}>
          {MFA_STATE[r.mfa].title}
        </Chip>
      ),
    },
    {
      key: 'method',
      header: SCAN.columns.method,
      sortValue: (r) => TIER_ORDER.indexOf(r.strongestMethod),
      csv: (r) => METHOD_TIER[r.strongestMethod].title,
      render: (r) => (
        <span title={r.methodTiers.map((t) => METHOD_TIER[t].title).join(', ') || undefined}>
          {r.strongestMethod === 'none' ? '—' : METHOD_TIER[r.strongestMethod].title}
        </span>
      ),
    },
    {
      key: 'reasons',
      header: SCAN.columns.reasons,
      sortValue: (r) => r.reasons.join('; ').toLowerCase(),
      csv: (r) => r.reasons.join('; '),
      render: (r) => (
        <>
          {r.evidence &&
            (() => {
              const name = friendlyMethod(r.evidence.method)
              return <span title={absolute(r.evidence.at)}>{name ? SCAN.mfaVia(name, relative(r.evidence.at)) : SCAN.mfaCompleted(relative(r.evidence.at))}</span>
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
    { key: 'care', header: SCAN.columns.care, hidden: true, render: () => null, csv: (r) => (highCare.has(r.userId) ? SCAN.yes : '') },
  ]

  return (
    <StepFrame
      title={SCAN.title}
      does={SCAN.does}
      needs={[{ met: true, text: SCAN.needs }]}
      next={snapshot ? 'mapping' : undefined}
      nextLabel={SCAN.next}
    >
      <p className="row">
        <Button variant="primary" icon="refresh" onClick={() => void scan()} loading={scanState === 'running'}>
          {snapshot ? SCAN.rescan : SCAN.scan}
        </Button>
        {(snapshot !== null || Object.keys(sections).length > 0) && (
          <Button icon="download" onClick={() => void downloadDiagnostics()}>
            {SCAN.diagnostics}
          </Button>
        )}
      </p>
      {error && <Callout kind="danger" title={SCAN.failed}>{error}</Callout>}
      {scanState !== 'running' && initial && snapshot === initial.snapshot && <Callout kind="info">{SCAN.usingSaved(whenAt(initial.at))}</Callout>}
      {scanState === 'running' && (
        <Card>
          <ProgressBar percent={sectionsPercent} caption={SCAN.sectionsBar(finishedSections, sectionTotal)} />
          {signInSection && (
            <ProgressBar
              percent={signInSection.status === 'started' ? null : 100}
              caption={SCAN.signInsBar(laneB?.rows ?? 0, laneB?.oldest ? absoluteDate(laneB.oldest) : null)}
            />
          )}
          <p className="reason">
            {SCAN.nowReading(inProgress)}
            {elapsed && ` · ${SCAN.elapsed(elapsed)}`}
          </p>
        </Card>
      )}
      {scanState === 'running' && slow && <Callout kind="warning">{SCAN.slow}</Callout>}

      {scanState === 'done' && snapshot && (
        <Card title={SCAN.completeTitle}>
          <p>
            {SCAN.completeLine(
              snapshot.users.length,
              snapshot.config.caPolicies?.rows.length ?? 0,
              evidence?.coveredWindow ? `${absoluteDate(evidence.coveredWindow.from)} – ${absoluteDate(evidence.coveredWindow.to)}` : null,
            )}
          </p>
          <p>
            <LinkButton href="#/mapping">{`Next: ${SCAN.next}`}</LinkButton>
          </p>
        </Card>
      )}

      {Object.keys(sections).length > 0 && (
        <ExpandCard summary={SCAN.details} open={false}>
          <ul className="sections">
            {Object.values(sections).map((s) => (
              <li key={s.source}>
                {s.status === 'started'
                  ? `${SCAN.sections[s.source] ?? s.source}: ${SCAN.reading}`
                  : s.rows !== undefined
                    ? SCAN.found(SCAN.sections[s.source] ?? s.source, s.rows)
                    : `${SCAN.sections[s.source] ?? s.source}: ${s.status}`}
                {s.reason && <span className="muted"> ({s.reason})</span>}
                {DEV && s.ms !== undefined && <span className="muted"> · {s.ms} ms</span>}
              </li>
            ))}
          </ul>
        </ExpandCard>
      )}

      {scored && snapshot && evidence && (
        <Tabs
          initial={view}
          tabs={[
            { id: 'readiness', label: SCAN.tabs.readiness, render: () => readinessView() },
            { id: 'inventory', label: SCAN.tabs.inventory, render: () => <InventoryPage snapshot={snapshot} /> },
          ]}
        />
      )}
    </StepFrame>
  )

  function readinessView() {
    if (!scored || !snapshot || !evidence) return null
    return (
      <div>
        <>
          <h3>{SCAN.readiness}</h3>
          <Callout kind={evidence.status === 'ok' ? 'success' : evidence.status === 'partial' ? 'info' : 'warning'}>
            {SCAN.signInRecords} <strong>{evidence.status === 'ok' ? SCAN.complete : evidence.status}</strong>
            {evidence.coveredWindow && <> — {SCAN.covering(absoluteDate(evidence.coveredWindow.from), absoluteDate(evidence.coveredWindow.to))}</>}
            {evidence.reason && <> ({evidence.reason})</>}
            {evidence.status === 'pending' && <>. {SCAN.pending}</>}
            {(evidence.status === 'insufficient' || evidence.status === 'disabled' || evidence.status === 'error') && <>. {SCAN.unusable}</>}.
          </Callout>

          <h4>{SCAN.mfaState}</h4>
          <Stats>
            {(Object.keys(MFA_STATE) as MfaState[]).map((state) => (
              <StatTile
                key={state}
                value={scored.summary.counts[state]}
                label={MFA_STATE[state].title}
                tone={state === 'verified' ? 'success' : state === 'likelyViable' ? 'info' : state === 'none' ? 'danger' : 'warning'}
                tip={MFA_STATE[state]}
                onClick={() => toggle(mfaFilter, state, setMfaFilter)}
                active={mfaFilter.has(state)}
              />
            ))}
          </Stats>
          <h4>{SCAN.activity}</h4>
          <Stats>
            {(Object.keys(ACTIVITY_STATE) as ActivityState[]).map((state) => (
              <StatTile
                key={state}
                value={scored.summary.activityCounts[state]}
                label={ACTIVITY_STATE[state].title}
                tip={ACTIVITY_STATE[state]}
                onClick={() => toggle(activityFilter, state, setActivityFilter)}
                active={activityFilter.has(state)}
              />
            ))}
          </Stats>
          <h4>{SCAN.rollout}</h4>
          <Stats>
            <StatTile value={scored.summary.verificationPhaseSize} label={TILE.verificationPhase.title} tip={TILE.verificationPhase} />
            {scored.summary.challengedRate !== null && (
              <StatTile value={`${Math.round(scored.summary.challengedRate * 100)}%`} label={TILE.challengedRate.title} tip={TILE.challengedRate} />
            )}
          </Stats>

          {snapshot.blockedToday.length > 0 && (
            <Callout kind="danger" title={SCAN.blockedToday(new Set(snapshot.blockedToday.flatMap((b) => b.userIds)).size)}>
              <ul className="sections">
                {snapshot.blockedToday.map((b) => (
                  <li key={b.policyId}>
                    {b.displayName ?? (b.policyId === 'unknown' ? SCAN.noPolicyIdentified : b.policyId)} — {SCAN.users(b.userIds.length)}:{' '}
                    {b.userIds.map((id) => userById.get(id)?.displayName ?? userById.get(id)?.userPrincipalName ?? id).join(', ')}
                  </li>
                ))}
              </ul>
            </Callout>
          )}

          <div className="row no-print">
            <input type="search" placeholder={SCAN.search} aria-label={SCAN.searchLabel} value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
            {(Object.keys(MFA_STATE) as MfaState[]).map((s) => (
              <FilterChip key={s} selected={mfaFilter.has(s)} title={MFA_STATE[s].text} onToggle={() => toggle(mfaFilter, s, setMfaFilter)}>
                {MFA_STATE[s].title}
              </FilterChip>
            ))}
            {(Object.keys(ACTIVITY_STATE) as ActivityState[]).map((s) => (
              <FilterChip key={s} selected={activityFilter.has(s)} title={ACTIVITY_STATE[s].text} onToggle={() => toggle(activityFilter, s, setActivityFilter)}>
                {ACTIVITY_STATE[s].title}
              </FilterChip>
            ))}
            {TIER_ORDER.filter((t) => t !== 'none').map((t) => (
              <FilterChip key={t} selected={tierFilter.has(t)} title={METHOD_TIER[t].text} onToggle={() => toggle(tierFilter, t, setTierFilter)}>
                {METHOD_TIER[t].title}
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
                {SCAN.clearFilters}
              </Button>
            )}
          </div>

          <DataTable rows={visibleRows} columns={columns} rowKey={(r) => r.userId} csvName="iamai-readiness.csv" empty={SCAN.noMatch} />

          <ExpandCard summary={SCAN.legend}>
            {LEGEND.slice(0, 3).map((group) => (
              <div key={group.heading}>
                <h4>{group.heading}</h4>
                <dl className="legend">
                  {group.items.map((d) => (
                    <div key={d.title}>
                      <dt>{d.title}</dt>
                      <dd>{d.text}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </ExpandCard>
        </>
      </div>
    )
  }
}
