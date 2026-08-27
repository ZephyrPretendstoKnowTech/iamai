// Findings — the advisor's narrative (2026-08-27 redesign): here's your
// tenant, what's working, what needs attention, and the detail behind it.
import { useEffect, useMemo, useState } from 'react'
import { loadPlanRecord } from '../../graph/collect/cache.ts'
import { getGroupMembers } from '../../graph/collect/onDemand.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { computeCoverage } from '../../coverage/coverage.ts'
import type { CoverageReport, GoalResult, GoalStatus } from '../../coverage/types.ts'
import { buildStrengthLookup } from '../../coverage/strength.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import { saveDevResults } from '../../graph/spikes/spike1.ts'
import { buildQuestions } from '../../mapping/questions.ts'
import { loadMappingState, toCoverageMapping } from '../../mapping/store.ts'
import type { MappingState } from '../../mapping/types.ts'
import { buildNameDirectory, nameifyText } from '../../names.ts'
import type { Checkpoint } from '../../roadmap/plan.ts'
import { buildViabilityInputs } from '../../scoring/fromSnapshot.ts'
import { scoreMfaViability, summarizeTenant } from '../../scoring/mfaViability.ts'
import type { TenantMfaSummary } from '../../scoring/mfaViability.ts'
import { absolute, absoluteDate, relative } from '../format.ts'
import { StepFrame } from '../shell/AppShell.tsx'
import { Callout, Chip, StatTile, Stats, Tabs } from '../components/index.ts'
import type { ChipStatus } from '../components/index.ts'
import type { BaselineResult } from './BaselinePage.tsx'
import baselineIndex from '../../../baselines/jhope188-conditionalaccesspolicies.index.json' with { type: 'json' }

const STATUS_LABEL: Record<GoalStatus, string> = {
  enforced: 'In place',
  partial: 'Partly in place',
  absent: 'Missing',
  'not-applicable': "Doesn't apply",
  'licence-limited': 'Needs a licence you lack',
  unknown: "Couldn't tell",
}

const STATUS_CHIP: Record<GoalStatus, ChipStatus> = {
  enforced: 'done',
  partial: 'warning',
  absent: 'blocked',
  'not-applicable': 'neutral',
  'licence-limited': 'neutral',
  unknown: 'warning',
}

function renderStatement(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((p, i) =>
    p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith('*') ? <em key={i}>{p.slice(1, -1)}</em> : <span key={i}>{p}</span>,
  )
}

function referencedGroupIds(tenantPolicies: unknown[]): string[] {
  const ids = new Set<string>()
  for (const raw of tenantPolicies) {
    const users = (raw as { conditions?: { users?: { includeGroups?: string[]; excludeGroups?: string[] } } }).conditions?.users
    for (const g of users?.includeGroups ?? []) ids.add(g)
    for (const g of users?.excludeGroups ?? []) ids.add(g)
  }
  return [...ids]
}

export function CoveragePage({
  scan,
  baseline,
}: {
  scan: { snapshot: TenantSnapshot; at: string } | null
  baseline: BaselineResult | null
}) {
  const [groups, setGroups] = useState<GroupMembers>(new Map())
  const [groupsLoaded, setGroupsLoaded] = useState(false)
  const [mapping, setMapping] = useState<MappingState | null>(null)
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])

  const snapshot = scan?.snapshot ?? null
  const tenantPolicies = useMemo(() => (snapshot ? (snapshot.config.caPolicies?.rows ?? []) : []), [snapshot])

  useEffect(() => {
    if (!snapshot) return
    void loadMappingState(snapshot.tenantId).then(setMapping)
    void loadPlanRecord<{ checkpoints?: Checkpoint[] }>(snapshot.tenantId).then((p) => setCheckpoints(p?.checkpoints ?? []))
  }, [snapshot])

  useEffect(() => {
    if (!snapshot) return
    let cancelled = false
    void (async () => {
      const map: GroupMembers = new Map()
      for (const id of referencedGroupIds(tenantPolicies)) {
        try {
          const g = await getGroupMembers(snapshot.tenantId, id)
          map.set(id, { memberIds: g.memberIds, memberCount: g.memberCount, sampled: g.sampled, displayName: g.displayName })
        } catch {
          // unresolved → the engine reports unknown for that goal
        }
      }
      if (!cancelled) {
        setGroups(map)
        setGroupsLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [snapshot, tenantPolicies])

  const notInScope = useMemo(
    () =>
      Object.entries(mapping?.targetState ?? {})
        .filter(([, t]) => !t.include)
        .map(([name, t]) => ({ name, reason: t.reason })),
    [mapping],
  )

  const computed = useMemo(() => {
    if (!snapshot || !groupsLoaded) return null
    const excluded = new Set(notInScope.map((p) => p.name))
    const questions = baseline ? buildQuestions(baseline.pkg) : []
    const report = computeCoverage({
      snapshot,
      tenantPolicies,
      baselinePolicies: (baseline?.pkg.policies ?? []).filter((p) => !excluded.has(p.displayName)),
      baselineUnusable: baseline?.pkg.report.warnings ?? [],
      strengths: buildStrengthLookup(snapshot.config.authStrengths?.rows ?? []),
      groupMembers: groups,
      mapping: mapping && baseline ? toCoverageMapping(mapping, questions) : undefined,
      facetOverrides: mapping?.facetOverrides,
    })
    const viability = buildViabilityInputs(snapshot, new Date().toISOString()).map(scoreMfaViability)
    const summary = summarizeTenant(viability)
    const names = buildNameDirectory(snapshot, groups)
    return { report, summary, names }
  }, [snapshot, groupsLoaded, groups, tenantPolicies, baseline, mapping, notInScope])

  useEffect(() => {
    if (!computed || !import.meta.env.DEV) return
    if (new URLSearchParams(window.location.search).get('dev') !== '1') return
    void saveDevResults('coverage-run', {
      summary: computed.report.summary,
      results: computed.report.results.map((r) => ({ id: r.goal.id, status: r.status, statement: r.statement })),
    })
  }, [computed])

  const needs = [
    { met: scan !== null, text: scan !== null ? 'scan complete' : 'run a scan', href: '#/scan' },
    { met: baseline !== null, text: baseline !== null ? 'baseline loaded' : 'load a baseline', href: '#/baseline' },
  ]

  if (!scan || !snapshot) {
    return (
      <StepFrame title="Findings" does="What I found in your tenant — what's working, what needs attention, and why." needs={needs} next="roadmap" nextLabel="Roadmap">
        <div className="card">
          <p>
            I need a scan to have findings. <a href="#/scan">Run a scan</a>
            {baseline === null && (
              <>
                {' '}
                and <a href="#/baseline">load a baseline</a>
              </>
            )}
            .
          </p>
        </div>
      </StepFrame>
    )
  }
  if (!computed) {
    return (
      <StepFrame title="Findings" does="What I found in your tenant — what's working, what needs attention, and why." needs={needs}>
        <p className="reason">Resolving group memberships…</p>
      </StepFrame>
    )
  }

  const { report, summary, names } = computed
  const tenantName =
    ((snapshot.config.organization?.rows?.[0] ?? {}) as { displayName?: string }).displayName ?? 'your tenant'
  const enabledPolicies = tenantPolicies.filter((p) => (p as { state?: string }).state === 'enabled').length
  const enforced = report.results.filter((r) => r.status === 'enforced')
  const partial = report.results.filter((r) => r.status === 'partial')
  const absent = report.results.filter((r) => r.status === 'absent')
  const unknown = report.results.filter((r) => r.status === 'unknown')
  const licence = report.results.filter((r) => r.status === 'licence-limited')
  const scoredCount = report.results.filter((r) => r.status !== 'not-applicable' && r.status !== 'licence-limited').length
  const active = summary.activityCounts.active
  const readyPct = active > 0 ? Math.round(((summary.counts.verified + summary.counts.likelyViable) / active) * 100) : 0
  const nameify = (s: string) => nameifyText(s, names)

  const delta = sinceLastScan(checkpoints, report, summary)

  const summaryTab = () => (
    <div className="advisor">
      <p>
        I compared <strong>{tenantName}</strong>'s {enabledPolicies} enabled Conditional Access polic
        {enabledPolicies === 1 ? 'y' : 'ies'} against{' '}
        <strong>{baseline ? baselineIndex.label : 'the catalogue'}</strong>
        {baseline ? ` (${baseline.pkg.policies.length} policies)` : ''} — by what they do, not what they're called.{' '}
        <strong>
          {enforced.length} of {scoredCount} security goals are already in place
        </strong>
        , {partial.length} partly, and {absent.length} not at all.
      </p>
      <p>
        On the people side: {snapshot.users.length} users, {active} active in the last 90 days.{' '}
        <strong>{readyPct}% of active users could complete MFA today</strong>
        {summary.counts.none > 0 ? `; ${summary.counts.none} have no MFA method at all` : ''}
        {summary.counts.notChallenged > 0 ? `; ${summary.counts.notChallenged} have never been asked` : ''}.
        {summary.challengedRate !== null && ` Only ${Math.round(summary.challengedRate * 100)}% of window-active users actually completed MFA — enforcement is largely untested here.`}
      </p>
      {enforced.length > 0 && (
        <p>
          <strong>What's working:</strong> {enforced.slice(0, 4).map((r) => r.goal.name.toLowerCase()).join(', ')}
          {enforced.length > 4 ? ` and ${enforced.length - 4} more` : ''}. Credit where due — these are done.
        </p>
      )}
      {absent.length + partial.length > 0 && (
        <p>
          <strong>What I'd fix first:</strong>{' '}
          {[...absent, ...partial]
            .sort((a, b) => a.goal.phase - b.goal.phase)
            .slice(0, 3)
            .map((r) => r.goal.name.toLowerCase())
            .join('; ')}
          . The <a href="#/roadmap">Roadmap</a> has each one dated, with who it touches and the exact change.
        </p>
      )}
      {delta && <p><strong>Since your last checkpoint ({delta.when}):</strong> {delta.text}</p>}
      {!report.assumed.confirmed && (report.assumed.groups.size > 0 || report.assumed.users.size > 0) && (
        <Callout kind="info">
          I inferred {report.assumed.groups.size} exclusion group(s) and {report.assumed.users.size} likely break-glass
          account(s) from how your policies use them — confirm them in <a href="#/mapping">Setup</a> and I'll stop
          hedging.
        </Callout>
      )}
      {licence.length > 0 && (
        <p className="reason">
          {licence.length} goal(s) need a licence tier you don't have; I don't score you on those — see the Licensing guide.
        </p>
      )}
      <Stats>
        <StatTile value={enforced.length} label="In place" tone="success" />
        <StatTile value={partial.length} label="Partly" tone="warning" />
        <StatTile value={absent.length} label="Missing" tone="danger" />
        <StatTile value={`${report.summary.scoredPercent}%`} label="of scored goals in place" tip={{ title: 'Scored goals', text: 'Goals that apply to this tenant and its licence. Not-applicable and licence-limited goals are left out.' }} />
        <StatTile value={`${readyPct}%`} label="active users MFA-ready" tip={{ title: 'MFA-ready', text: 'Active users whose MFA state is Verified or Likely viable.' }} />
      </Stats>
    </div>
  )

  const goalCard = (r: GoalResult) => (
    <details key={r.goal.id} className="card">
      <summary>
        <Chip status={STATUS_CHIP[r.status]}>{STATUS_LABEL[r.status]}</Chip> {renderStatement(nameify(r.statement))}
      </summary>
      {r.goal.tldr && <p className="reason">{r.goal.tldr}</p>}
      {r.goal.learnUrl && (
        <p className="reason">
          <a href={r.goal.learnUrl} target="_blank" rel="noreferrer">
            Microsoft Learn →
          </a>{' '}
          {(r.goal.cis ?? []).map((c) => (
            <Chip key={c} status="neutral">
              CIS {c}
            </Chip>
          ))}
        </p>
      )}
      {r.candidates.length > 0 && (
        <>
          <h4>Your policies involved</h4>
          <ul className="sections">
            {r.candidates.map((c) => (
              <li key={c.policyId || c.policyName}>
                <em>{c.policyName}</em> — {c.state === 'enabledForReportingButNotEnforced' ? 'report-only' : c.state};{' '}
                {c.contribution === 'strong' ? 'delivers it' : c.contribution === 'weak' ? 'applies but too weak' : c.contribution}
                {c.caveats.length > 0 && ` (${c.caveats.join(', ')})`}
              </li>
            ))}
          </ul>
        </>
      )}
      {r.reasons.length > 0 && (
        <>
          <h4>Why not fully</h4>
          <ul className="sections">
            {r.reasons.map((reason, i) => (
              <li key={i}>
                {nameify(reason.detail)}
                {reason.expected && ' (expected)'}
                {reason.userIds.length > 0 && (
                  <details>
                    <summary>{reason.userIds.length} user(s)</summary>
                    <ul>
                      {reason.userIds.map((id) => (
                        <li key={id}>{names.label(id)}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {r.status !== 'enforced' && (
        <p className="reason">
          <a href="#/roadmap">See the step for this in the Roadmap →</a>
        </p>
      )}
    </details>
  )

  const workingTab = () => (
    <div>
      {enforced.length === 0 && <p className="advisor">Nothing is fully in place yet — that's what the plan is for.</p>}
      {enforced.map(goalCard)}
    </div>
  )

  const attentionTab = () => (
    <div>
      {absent.length + partial.length + unknown.length === 0 && (
        <p className="advisor">Everything the baseline asks for is in place. Keep re-scanning; I'll flag drift.</p>
      )}
      {[...partial, ...absent, ...unknown].sort((a, b) => a.goal.phase - b.goal.phase).map(goalCard)}
    </div>
  )

  const detailsTab = () => (
    <div>
      {[...report.results.filter((r) => r.status === 'not-applicable' || r.status === 'licence-limited')].map(goalCard)}
      {notInScope.length > 0 && (
        <div className="card">
          <h3>Not in scope for this tenant</h3>
          <ul className="sections">
            {notInScope.map((p) => (
              <li key={p.name}>
                <em>{p.name}</em>
                {p.reason && <> — {p.reason}</>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {report.couldNotEvaluate.length > 0 && (
        <div className="card">
          <h3>Couldn't be evaluated</h3>
          <ul className="sections">
            {report.couldNotEvaluate.map((c) => (
              <li key={c.name}>
                <em>{c.name}</em> — {c.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="card">
        <h3>Policies not in the baseline</h3>
        {report.organisation.notInBaseline.length === 0 ? (
          <p className="reason">Every policy you have maps to a goal.</p>
        ) : (
          <ul className="sections">
            {report.organisation.notInBaseline.map((p) => (
              <li key={p.id}>
                <em>{p.name}</em> ({p.state}) — fine to keep; just not part of this baseline
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="card">
        <h3>Housekeeping</h3>
        <ul className="sections">
          <li>
            Naming:{' '}
            {report.organisation.naming.pattern
              ? `${Math.round(report.organisation.naming.share * 100)}% of your policies share the prefix "${report.organisation.naming.pattern}"${report.organisation.naming.outliers.length > 0 ? `; outliers: ${report.organisation.naming.outliers.join(', ')}` : ''}`
              : 'no dominant naming convention yet — the plan uses the baseline\'s'}
          </li>
          {report.organisation.consolidation.map((c) => (
            <li key={c.goalId}>
              <em>{c.goalName}</em> is delivered by {c.policyNames.length} policies — consider consolidating
            </li>
          ))}
          {report.organisation.microsoftManaged.length > 0 && (
            <li>Microsoft-managed policies: {report.organisation.microsoftManaged.map((p) => `${p.name} (${p.state})`).join('; ')}</li>
          )}
        </ul>
      </div>
    </div>
  )

  return (
    <StepFrame title="Findings" does="What I found in your tenant — what's working, what needs attention, and why." needs={needs} next="roadmap" nextLabel="Roadmap">
      <p className="reason">
        Based on the scan from <span title={absolute(scan.at)}>{relative(scan.at)}</span> —{' '}
        <a href="#/scan">Re-scan</a>
      </p>
      <Tabs
        tabs={[
          { id: 'summary', label: 'Summary', render: summaryTab },
          { id: 'working', label: "What's working", badge: enforced.length, render: workingTab },
          { id: 'attention', label: 'Needs attention', badge: absent.length + partial.length + unknown.length, render: attentionTab },
          { id: 'details', label: 'Details', render: detailsTab },
        ]}
      />
    </StepFrame>
  )
}

// "Since your last scan" — the delta against the most recent saved checkpoint.
function sinceLastScan(
  checkpoints: Checkpoint[],
  report: CoverageReport,
  summary: TenantMfaSummary,
): { when: string; text: string } | null {
  const last = checkpoints.at(-1)
  if (!last) return null
  const wasEnforced = last.coverage.filter((c) => c.state === 'enforced').length
  const nowEnforced = report.results.filter((r) => r.status === 'enforced').length
  const bits: string[] = []
  if (nowEnforced !== wasEnforced) bits.push(`goals in place ${wasEnforced} → ${nowEnforced}`)
  const verDelta = summary.counts.verified - (last.mfaStateCounts?.verified ?? 0)
  if (verDelta !== 0) bits.push(`${Math.abs(verDelta)} ${verDelta > 0 ? 'more' : 'fewer'} verified user(s)`)
  const noneDelta = summary.counts.none - (last.mfaStateCounts?.none ?? 0)
  if (noneDelta !== 0) bits.push(`${Math.abs(noneDelta)} ${noneDelta < 0 ? 'fewer' : 'more'} without a method`)
  const regressed = last.coverage.filter(
    (c) => c.state === 'enforced' && report.results.find((r) => r.goal.id === c.goalId)?.status !== 'enforced',
  )
  if (regressed.length > 0) bits.push(`${regressed.length} goal(s) regressed — check for policy changes outside the plan`)
  return { when: absoluteDate(last.at), text: bits.length > 0 ? bits.join('; ') + '.' : 'nothing has changed.' }
}
