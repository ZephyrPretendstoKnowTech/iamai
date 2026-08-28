// Findings: what the scan found: what's working, what needs attention, and
// the detail behind it. Generated sentences come from src/copy/statements.ts.
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
import { FINDINGS as C } from '../../copy/pages.ts'
import { INVENTORY } from '../../copy/inventory.ts'
import { CHIP, GOAL_STATUS, TILE } from '../../copy/definitions.ts'
import { findingsSummary, lowerFirst } from '../../copy/statements.ts'
import { absoluteDate, whenAt } from '../format.ts'
import { ScanAge, StepFrame, stepHref } from '../shell/AppShell.tsx'
import { proposedPolicyName, stepIdForGoal } from '../../roadmap/generate.ts'
import { NAMING, stepTitle } from '../../copy/steps.ts'
import { Callout, Card, Chip, ExpandCard, InfoTip, ScoreBadges, StatTile, Stats, Tabs } from '../components/index.ts'
import type { ChipStatus } from '../components/index.ts'
import { SCORE } from '../../copy/definitions.ts'
import { scoreResult } from '../../roadmap/score.ts'
import { arrangeGoals } from '../../scoring/arrange.ts'
import type { GroupBy } from '../../scoring/arrange.ts'
import type { GoalScore, ScoreSort } from '../../scoring/priority.ts'
import type { BaselineResult } from './BaselinePage.tsx'
import { goalsCoveredBy } from './BaselinePage.tsx'

const STATUS_CHIP: Record<GoalStatus, ChipStatus> = {
  'below-baseline': 'warning',
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

const SORTS: ScoreSort[] = ['priority', 'value', 'effort', 'disruption']
const CONTROL_KEY = 'iamai.findings.controls'

/** The session's last choice for a control, if it is still a valid value. */
function readControl<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(CONTROL_KEY) ?? '{}') as Record<string, unknown>
    const v = saved[name]
    return allowed.includes(v as T) ? (v as T) : fallback
  } catch {
    return fallback
  }
}
function writeControl(name: string, value: string): void {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(CONTROL_KEY) ?? '{}') as Record<string, unknown>
    window.sessionStorage.setItem(CONTROL_KEY, JSON.stringify({ ...saved, [name]: value }))
  } catch {
    // session storage unavailable: the default still applies
  }
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
  // Control bar (prompt 17 §2, prompt 19 §A4): grouped by domain and sorted by
  // priority unless this session chose otherwise. The two are independent.
  const [groupBy, setGroupBy] = useState<GroupBy>(() => readControl('groupBy', ['none', 'domain'], 'domain'))
  const [sortBy, setSortBy] = useState<ScoreSort>(() => readControl('sortBy', SORTS, 'priority'))
  useEffect(() => writeControl('groupBy', groupBy), [groupBy])
  useEffect(() => writeControl('sortBy', sortBy), [sortBy])

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
    const scores = new Map<string, GoalScore | null>(report.results.map((r) => [r.goal.id, scoreResult(r, snapshot, viability)]))
    return { report, summary, names, scores }
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
    { met: scan !== null, text: scan !== null ? C.needsScan : C.needScan, href: '#/scan' },
    { met: baseline !== null, text: baseline !== null ? C.needsBaseline : C.needBaseline, href: '#/baseline' },
  ]

  if (!scan || !snapshot) {
    return (
      <StepFrame title={C.title} does={C.does} needs={needs}>
        <Card>
          <p>
            {C.blocked} <a href="#/scan">{C.runScan}</a>
            {baseline === null && (
              <>
                {' '}
                {C.and} <a href="#/baseline">{C.loadBaseline}</a>
              </>
            )}
            .
          </p>
        </Card>
      </StepFrame>
    )
  }
  if (!computed) {
    return (
      <StepFrame title={C.title} does={C.does} needs={needs}>
        <p className="reason">{C.resolving}</p>
      </StepFrame>
    )
  }

  const { report, summary, names, scores } = computed
  const scoreOf = (r: GoalResult): GoalScore | null => scores.get(r.goal.id) ?? null
  const tenantName =
    ((snapshot.config.organization?.rows?.[0] ?? {}) as { displayName?: string }).displayName ?? 'this tenant'
  const enabledPolicies = tenantPolicies.filter((p) => (p as { state?: string }).state === 'enabled').length
  const enforced = report.results.filter((r) => r.status === 'enforced')
  const partial = report.results.filter((r) => r.status === 'partial' || r.status === 'below-baseline')
  const absent = report.results.filter((r) => r.status === 'absent')
  const unknown = report.results.filter((r) => r.status === 'unknown')
  const licence = report.results.filter((r) => r.status === 'licence-limited')
  const scoredCount = report.results.filter((r) => r.status !== 'not-applicable' && r.status !== 'licence-limited').length
  // Same count as the Baseline step (ux-review-05 §9): catalogue goals the baseline has a policy for, plus its ad-hoc goals.
  const baselineGoals = baseline ? goalsCoveredBy(baseline.pkg) : report.results.length
  const active = summary.activityCounts.active
  const nameify = (s: string) => nameifyText(s, names)

  const delta = sinceLastScan(checkpoints, report, summary)

  const paragraphs = findingsSummary({
    tenant: tenantName,
    enabledPolicies,
    baselineLabel: baseline ? baseline.source : 'the goal catalogue',
    baselinePolicies: baseline ? baseline.pkg.policies.length : null,
    inPlace: enforced.length,
    partly: partial.length,
    missing: absent.length,
    scored: scoredCount,
    users: snapshot.users.length,
    active,
    rollout: summary.rollout,
    working: enforced.map((r) => lowerFirst(r.goal.name)),
    fixFirst: [...absent, ...partial].sort((a, b) => a.goal.phase - b.goal.phase).map((r) => lowerFirst(r.goal.name)),
    licenceLimited: licence.length,
  })

  const summaryTab = () => (
    <div className="advisor">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {delta && (
        <p>
          <strong>{C.sinceCheckpoint(delta.when)}</strong> {delta.text}
        </p>
      )}
      {!report.assumed.confirmed && (report.assumed.groups.size > 0 || report.assumed.users.size > 0) && (
        <Callout kind="info">
          {C.assumed(report.assumed.groups.size, report.assumed.users.size)} <a href="#/mapping">{C.assumedLink}</a> {C.assumedAfter}
        </Callout>
      )}
      <Stats>
        <StatTile value={enforced.length} label={C.tiles.inPlace} tone="success" tip={TILE.inPlace} />
        <StatTile value={partial.length} label={C.tiles.partly} tone="warning" tip={TILE.partly} />
        <StatTile value={absent.length} label={C.tiles.missing} tone="danger" tip={TILE.missing} />
        <StatTile value={`${report.summary.scoredPercent}%`} label={C.tiles.scored} tip={TILE.scoredGoals} />
        <StatTile value={`${summary.rollout.enabled === 0 ? 0 : Math.round((summary.rollout.proven / summary.rollout.enabled) * 100)}%`} label={C.tiles.proven} tone="success" tip={TILE.mfaProven} />
        <StatTile value={summary.rollout.toSetUp} label={C.tiles.toSetUp} tone={summary.rollout.toSetUp === 0 ? 'neutral' : 'warning'} tip={TILE.toSetUp} />
      </Stats>
    </div>
  )

  const goalCard = (r: GoalResult) => (
    <ExpandCard
      key={r.goal.id}
      summary={
        <>
          <Chip status={STATUS_CHIP[r.status]} title={GOAL_STATUS[r.status].text}>
            {GOAL_STATUS[r.status].title}
          </Chip>{' '}
          {renderStatement(nameify(r.statement))}
          <ScoreBadges score={scoreOf(r)} />
          {r.status !== 'enforced' && r.status !== 'not-applicable' && r.status !== 'licence-limited' ? (
            <InfoTip title={C.whyMatters} text={`${r.goal.tldr ?? r.goal.description} ${C.fixText(r.goal.name)}`} link={{ href: stepHref(stepIdForGoal(r.goal.id)), label: C.fixLink }} />
          ) : (
            <InfoTip title={C.whyMatters} text={r.goal.tldr ?? r.goal.description} />
          )}
        </>
      }
    >
      {r.goal.tldr && <p className="reason">{r.goal.tldr}</p>}
      {(r.status === 'absent' || r.status === 'partial' || r.status === 'below-baseline') && (
        // The name the plan proposes, in the tenant's convention; the baseline's own name beneath (ux-review-04 §6).
        <p>
          <strong>{C.proposedName}</strong> {proposedPolicyName(stepTitle(r.goal.name), report.organisation.naming)}
          {r.goal.adHocSource && <span className="sub"> {NAMING.fromBaseline(r.goal.adHocSource)}</span>}
        </p>
      )}
      {r.goal.learnUrl && (
        <p className="reason">
          <a href={r.goal.learnUrl} target="_blank" rel="noreferrer">
            {C.learn}
          </a>{' '}
          {(r.goal.cis ?? []).map((c) => (
            <Chip key={c} status="neutral" title={CHIP.cis.text}>
              {C.cis(c)}
            </Chip>
          ))}
        </p>
      )}
      {r.candidates.length > 0 && (
        <>
          <h4>{C.policiesInvolved}</h4>
          <ul className="sections">
            {r.candidates.map((c) => (
              <li key={c.policyId || c.policyName}>
                <em>{c.policyName}</em>: {INVENTORY.policies.state[c.state]}
                {/* Report-only and off already say it; only add what the state does not (prompt 19 §B). */}
                {c.contribution === 'strong' ? `; ${C.delivers}` : c.contribution === 'weak' ? `; ${C.tooWeak}` : ''}
                {c.caveats.length > 0 && ` (${c.caveats.join(', ')})`}
              </li>
            ))}
          </ul>
        </>
      )}
      {r.reasons.length > 0 && (
        <>
          <h4>{C.whyNot}</h4>
          <ul className="sections">
            {r.reasons.map((reason, i) => (
              <li key={i}>
                {nameify(reason.detail)}
                {reason.expected && ` ${C.expected}`}
                {reason.userIds.length > 0 && (
                  <details>
                    <summary>{C.usersCount(reason.userIds.length)}</summary>
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
      {(r.status === 'absent' || r.status === 'partial' || r.status === 'below-baseline' || r.status === 'unknown') && (
        <p className="reason">
          <a href={stepHref(stepIdForGoal(r.goal.id))}>{C.seeStep}</a>
        </p>
      )}
    </ExpandCard>
  )

  const controlBar = (
    <div className="control-bar no-print">
      <label>
        {C.groupBy}
        <select value={groupBy} onChange={(e) => setGroupBy(e.currentTarget.value as GroupBy)}>
          <option value="none">{C.groupNone}</option>
          <option value="domain">{C.groupDomain}</option>
        </select>
      </label>
      <label>
        {C.sortBy}
        <select value={sortBy} onChange={(e) => setSortBy(e.currentTarget.value as ScoreSort)}>
          {SORTS.map((k) => (
            <option key={k} value={k}>
              {C.sort[k]}
            </option>
          ))}
        </select>
        <InfoTip title={SCORE[sortBy].title} text={SCORE[sortBy].text} />
      </label>
    </div>
  )

  const grouped = (rows: GoalResult[]) =>
    arrangeGoals(rows, scoreOf, (r) => scoreOf(r)?.domain ?? r.goal.domain ?? 'Identity', (r) => r.goal.phase, groupBy, sortBy).map((g) =>
      g.domain === null ? (
        g.rows.map(goalCard)
      ) : (
        <div key={g.domain} className="phase-group">
          <h3>{g.domain}</h3>
          {g.rows.map(goalCard)}
        </div>
      ),
    )

  const workingTab = () => (
    <div>
      {enforced.length === 0 && <p className="advisor">{C.nothingInPlace}</p>}
      {grouped(enforced)}
    </div>
  )

  const attentionTab = () => (
    <div>
      {absent.length + partial.length + unknown.length === 0 && <p className="advisor">{C.allInPlace}</p>}
      {grouped([...partial, ...absent, ...unknown])}
    </div>
  )

  const detailsTab = () => (
    <div>
      {[...report.results.filter((r) => r.status === 'not-applicable' || r.status === 'licence-limited')].map(goalCard)}
      {notInScope.length > 0 && (
        <Card title={C.notInScope}>
          <ul className="sections">
            {notInScope.map((p) => (
              <li key={p.name}>
                <em>{p.name}</em>
                {p.reason && <>: {p.reason}</>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {report.couldNotEvaluate.length > 0 && (
        <Card title={C.couldNotEvaluate}>
          <ul className="sections">
            {report.couldNotEvaluate.map((c) => (
              <li key={c.name}>
                <em>{c.name}</em>: {c.reason}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title={C.notInBaseline}>
        {report.organisation.notInBaseline.length === 0 ? (
          <p className="reason">{C.everyPolicyMaps}</p>
        ) : (
          <ul className="sections">
            {report.organisation.notInBaseline.map((p) => (
              <li key={p.id}>
                <em>{p.name}</em> ({INVENTORY.policies.state[p.state as keyof typeof INVENTORY.policies.state] ?? p.state}): {C.fineToKeep}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={C.housekeeping}>
        <ul className="sections">
          <li>
            {report.organisation.naming.pattern
              ? C.naming(Math.round(report.organisation.naming.share * 100), report.organisation.naming.pattern, report.organisation.naming.outliers.join(', '))
              : C.noNaming}
          </li>
          {report.organisation.consolidation.map((c) => (
            <li key={c.goalId}>{C.consolidate(c.goalName, c.policyNames.length)}</li>
          ))}
          {report.organisation.microsoftManaged.length > 0 && (
            <li>
              {C.microsoftManaged(
                report.organisation.microsoftManaged
                  .map((p) => `${p.name} (${INVENTORY.policies.state[p.state as keyof typeof INVENTORY.policies.state] ?? p.state})`)
                  .join('; '),
              )}
            </li>
          )}
        </ul>
      </Card>
    </div>
  )

  return (
    <StepFrame title={C.title} does={C.does} needs={needs} next="roadmap" nextLabel={C.next}>
      <ScanAge at={scan.at} baseline={baseline?.source ?? null} />
      <p className="reason">{C.goalCounts(baselineGoals, scoredCount)}</p>
      {controlBar}
      <Tabs
        tabs={[
          { id: 'summary', label: C.tabs.summary, render: summaryTab },
          { id: 'working', label: C.tabs.working, badge: enforced.length, render: workingTab },
          { id: 'attention', label: C.tabs.attention, badge: absent.length + partial.length + unknown.length, render: attentionTab },
          { id: 'details', label: C.tabs.details, render: detailsTab },
        ]}
      />
    </StepFrame>
  )
}

// "Since the last checkpoint": the delta against the most recent saved checkpoint.
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
  if (nowEnforced !== wasEnforced) bits.push(C.delta.goals(wasEnforced, nowEnforced))
  const verDelta = summary.counts.verified - (last.mfaStateCounts?.verified ?? 0)
  if (verDelta !== 0) bits.push(C.delta.verified(Math.abs(verDelta), verDelta > 0))
  const noneDelta = summary.counts.none - (last.mfaStateCounts?.none ?? 0)
  if (noneDelta !== 0) bits.push(C.delta.noMethod(Math.abs(noneDelta), noneDelta < 0))
  const regressed = last.coverage.filter(
    (c) => c.state === 'enforced' && report.results.find((r) => r.goal.id === c.goalId)?.status !== 'enforced',
  )
  if (regressed.length > 0) bits.push(C.delta.regressed(regressed.length))
  return { when: absoluteDate(last.at), text: bits.length > 0 ? bits.join('; ') + '.' : C.delta.nothing }
}
