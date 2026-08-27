import { useEffect, useMemo, useState } from 'react'
import { getGroupMembers } from '../../graph/collect/onDemand.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { computeCoverage } from '../../coverage/coverage.ts'
import type { CoverageReport } from '../../coverage/types.ts'
import type { GoalStatus } from '../../coverage/types.ts'
import { buildStrengthLookup } from '../../coverage/strength.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import { saveDevResults } from '../../graph/spikes/spike1.ts'
import { buildQuestions } from '../../mapping/questions.ts'
import { loadMappingState, toCoverageMapping } from '../../mapping/store.ts'
import type { MappingState } from '../../mapping/types.ts'
import { absolute, relative } from '../format.ts'
import { StepFrame } from '../shell/AppShell.tsx'
import type { BaselineResult } from './BaselinePage.tsx'

const STATUS_LABEL: Record<GoalStatus, string> = {
  enforced: 'Enforced',
  partial: 'Partial',
  absent: 'Absent',
  'not-applicable': 'Not applicable',
  'licence-limited': 'Licence-limited',
  unknown: 'Unknown',
}

const STATUS_CHIP: Record<GoalStatus, string> = {
  enforced: 'state-verified',
  partial: 'state-notChallenged',
  absent: 'state-none',
  'not-applicable': '',
  'licence-limited': '',
  unknown: 'state-unverified',
}

// Statements carry *emphasis* markers — render them without a markdown lib.
function renderStatement(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((p, i) =>
    p.startsWith('**') ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : p.startsWith('*') ? (
      <em key={i}>{p.slice(1, -1)}</em>
    ) : (
      <span key={i}>{p}</span>
    ),
  )
}

function referencedGroupIds(tenantPolicies: unknown[]): string[] {
  const ids = new Set<string>()
  for (const raw of tenantPolicies) {
    const users = (raw as { conditions?: { users?: { includeGroups?: string[]; excludeGroups?: string[] } } })
      .conditions?.users
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

  useEffect(() => {
    if (!scan) return
    void loadMappingState(scan.snapshot.tenantId).then(setMapping)
  }, [scan])

  const tenantPolicies = useMemo(
    () => (scan ? (scan.snapshot.config.caPolicies?.rows ?? []) : []),
    [scan],
  )

  useEffect(() => {
    if (!scan) return
    let cancelled = false
    const ids = referencedGroupIds(tenantPolicies)
    void (async () => {
      const map: GroupMembers = new Map()
      for (const id of ids) {
        try {
          const g = await getGroupMembers(scan.snapshot.tenantId, id)
          map.set(id, { memberIds: g.memberIds, memberCount: g.memberCount, sampled: g.sampled })
        } catch {
          // unresolved group → the engine reports the goal as unknown
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
  }, [scan, tenantPolicies])

  const notInScope = useMemo(
    () =>
      Object.entries(mapping?.targetState ?? {})
        .filter(([, t]) => !t.include)
        .map(([name, t]) => ({ name, reason: t.reason })),
    [mapping],
  )

  const report: CoverageReport | null = useMemo(() => {
    if (!scan || !groupsLoaded) return null
    const excluded = new Set(notInScope.map((p) => p.name))
    const includedBaseline = (baseline?.pkg.policies ?? []).filter((p) => !excluded.has(p.displayName))
    const questions = baseline ? buildQuestions(baseline.pkg) : []
    return computeCoverage({
      snapshot: scan.snapshot,
      tenantPolicies,
      baselinePolicies: includedBaseline,
      baselineUnusable: baseline?.pkg.report.warnings ?? [],
      strengths: buildStrengthLookup(scan.snapshot.config.authStrengths?.rows ?? []),
      groupMembers: groups,
      mapping: mapping && baseline ? toCoverageMapping(mapping, questions) : undefined,
      facetOverrides: mapping?.facetOverrides,
    })
  }, [scan, groupsLoaded, groups, tenantPolicies, baseline, mapping, notInScope])

  // First-run capture (prompt 05 item 12): behind ?dev=1, save the outcome so
  // it can be compared with the worked example in intents.md §11.
  useEffect(() => {
    if (!report || !import.meta.env.DEV) return
    if (new URLSearchParams(window.location.search).get('dev') !== '1') return
    void saveDevResults('coverage-run', {
      summary: report.summary,
      results: report.results.map((r) => ({
        id: r.goal.id,
        status: r.status,
        statement: r.statement,
        floorRaised: r.floorRaised,
        candidates: r.candidates,
        reasons: r.reasons.map((x) => ({ kind: x.kind, count: x.userIds.length, detail: x.detail, expected: x.expected })),
      })),
      couldNotEvaluate: report.couldNotEvaluate,
      organisation: report.organisation,
    })
  }, [report])

  const userById = useMemo(
    () => new Map((scan?.snapshot.users ?? []).map((u) => [u.id, u])),
    [scan],
  )

  const needs = [
    { met: scan !== null, text: scan !== null ? 'scan complete' : 'run a scan', href: '#/scan' },
    { met: baseline !== null, text: baseline !== null ? 'baseline loaded' : 'load a baseline', href: '#/baseline' },
  ]

  return (
    <StepFrame
      title="Coverage"
      does="Shows which baseline goals your tenant's enabled policies already deliver — enforced, partial, or absent — ignoring policy names."
      needs={needs}
      next="roadmap"
      nextLabel="Roadmap"
    >
      {scan && (
        <p className="reason">
          Based on the scan from <span title={absolute(scan.at)}>{relative(scan.at)}</span> —{' '}
          <a href="#/scan">Re-scan</a>
        </p>
      )}
      {!scan && (
        <div className="card">
          <p>
            Coverage reads from the scan snapshot. <a href="#/scan">Run a scan</a> first
            {baseline === null && (
              <>
                {' '}
                and <a href="#/baseline">load a baseline</a>
              </>
            )}
            .
          </p>
        </div>
      )}
      {scan && !groupsLoaded && <p className="reason">Resolving group memberships…</p>}
      {report && (
        <>
          {!report.assumed.confirmed && (report.assumed.groups.size > 0 || report.assumed.users.size > 0) && (
            <p className="notice">
              Exclusion roles below are <strong>assumed — confirm in Mapping</strong>: IAMAI inferred{' '}
              {report.assumed.groups.size} exclusion group(s) and {report.assumed.users.size} likely
              break-glass account(s) from how your policies use them.
            </p>
          )}

          <div className="tiles">
            {(
              [
                ['Enforced', report.summary.enforced],
                ['Partial', report.summary.partial],
                ['Absent', report.summary.absent],
                ['Not applicable', report.summary.notApplicable],
                ['Licence-limited', report.summary.licenceLimited],
              ] as const
            ).map(([label, count]) => (
              <div key={label} className="tile">
                <div className="tile-count">{count}</div>
                <div className="tile-label">{label}</div>
              </div>
            ))}
            <div className="tile">
              <div className="tile-count">{report.summary.scoredPercent}%</div>
              <div className="tile-label">of scored goals enforced</div>
            </div>
          </div>

          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((phase) => {
            const rows = report.results.filter((r) => r.goal.phase === phase)
            if (rows.length === 0) return null
            return (
              <div key={phase} className="tile-group">
                <h4>{phase === 8 ? 'From this baseline (ad-hoc)' : `Phase ${phase}`}</h4>
                {rows.map((r) => (
                  <details key={r.goal.id} className="card">
                    <summary>
                      <span className={`chip ${STATUS_CHIP[r.status]}`}>{STATUS_LABEL[r.status]}</span>{' '}
                      {renderStatement(r.statement)}
                    </summary>
                    {r.candidates.length > 0 && (
                      <>
                        <h4>Candidate policies</h4>
                        <ul className="sections">
                          {r.candidates.map((c) => (
                            <li key={c.policyId || c.policyName}>
                              <em>{c.policyName}</em> — {c.state}; contribution: {c.contribution}
                              {c.caveats.length > 0 && ` (${c.caveats.join(', ')})`}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {r.reasons.length > 0 && (
                      <>
                        <h4>Reasons</h4>
                        <ul className="sections">
                          {r.reasons.map((reason, i) => (
                            <li key={i}>
                              <strong>{reason.kind}</strong>
                              {reason.expected && ' (expected)'} — {reason.detail}
                              {reason.userIds.length > 0 && (
                                <details>
                                  <summary>{reason.userIds.length} affected user(s)</summary>
                                  <ul>
                                    {reason.userIds.map((id) => {
                                      const u = userById.get(id)
                                      return (
                                        <li key={id}>
                                          {u?.displayName ?? id}
                                          {u?.userPrincipalName && <span className="sub"> {u.userPrincipalName}</span>}
                                        </li>
                                      )
                                    })}
                                  </ul>
                                </details>
                              )}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </details>
                ))}
              </div>
            )
          })}

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
              <h3>Could not be evaluated</h3>
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
            <h3>Not in the baseline</h3>
            {report.organisation.notInBaseline.length === 0 ? (
              <p className="reason">Every tenant policy maps to a goal.</p>
            ) : (
              <ul className="sections">
                {report.organisation.notInBaseline.map((p) => (
                  <li key={p.id}>
                    <em>{p.name}</em> ({p.state}) — informational; not part of coverage
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h3>Organisation</h3>
            <ul className="sections">
              <li>
                Naming:{' '}
                {report.organisation.naming.pattern
                  ? `${Math.round(report.organisation.naming.share * 100)}% share the prefix "${report.organisation.naming.pattern}"${report.organisation.naming.outliers.length > 0 ? `; outliers: ${report.organisation.naming.outliers.join(', ')}` : ''}`
                  : 'no dominant naming convention detected'}
              </li>
              {report.organisation.consolidation.map((c) => (
                <li key={c.goalId}>
                  Consolidation candidate: <em>{c.goalName}</em> is delivered by {c.policyNames.length}{' '}
                  policies
                </li>
              ))}
              {report.organisation.microsoftManaged.length > 0 && (
                <li>
                  Microsoft-managed policies:{' '}
                  {report.organisation.microsoftManaged.map((p) => `${p.name} (${p.state})`).join('; ')}
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </StepFrame>
  )
}
