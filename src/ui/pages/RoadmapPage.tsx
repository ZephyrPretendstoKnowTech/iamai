import { useEffect, useMemo, useState } from 'react'
import { loadPlanRecord, savePlanRecord } from '../../graph/collect/cache.ts'
import { getGroupMembers } from '../../graph/collect/onDemand.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { computeCoverage } from '../../coverage/coverage.ts'
import { buildStrengthLookup } from '../../coverage/strength.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import { buildQuestions } from '../../mapping/questions.ts'
import { loadMappingState, toCoverageMapping } from '../../mapping/store.ts'
import type { MappingState } from '../../mapping/types.ts'
import { buildViabilityInputs } from '../../scoring/fromSnapshot.ts'
import { scoreMfaViability, summarizeTenant } from '../../scoring/mfaViability.ts'
import { generateRoadmap } from '../../roadmap/generate.ts'
import { applyProgress, mergePersisted, skipStep } from '../../roadmap/progress.ts'
import { buildPlanFile, makeCheckpoint, parsePlanFile } from '../../roadmap/plan.ts'
import type { Checkpoint } from '../../roadmap/plan.ts'
import type { Step, StepStatus } from '../../roadmap/types.ts'
import { saveDevResults } from '../../graph/spikes/spike1.ts'
import baselineIndex from '../../../baselines/jhope188-conditionalaccesspolicies.index.json' with { type: 'json' }
import { absolute, downloadFile, relative } from '../format.ts'
import { StepFrame } from '../shell/AppShell.tsx'
import type { BaselineResult } from './BaselinePage.tsx'

type SavedSteps = Record<string, { status: StepStatus; history: Step['history']; skipReason: string | null }>
type PlanStore = { planId: string; steps: SavedSteps; checkpoints: Checkpoint[] }

const STATUS_LABEL: Record<StepStatus, string> = {
  done: 'Done',
  ready: 'Ready',
  blocked: 'Blocked',
  'in-report-only': 'In report-only',
  'ready-to-enforce': 'Ready to enforce',
  skipped: 'Skipped',
}

const STATUS_CHIP: Record<StepStatus, string> = {
  done: 'state-verified',
  ready: 'state-likelyViable',
  blocked: 'state-none',
  'in-report-only': 'state-notChallenged',
  'ready-to-enforce': 'state-likelyViable',
  skipped: '',
}

export function RoadmapPage({
  scan,
  baseline,
  operator,
}: {
  scan: { snapshot: TenantSnapshot; at: string } | null
  baseline: BaselineResult | null
  operator: { userId: string; userPrincipalName: string } | null
}) {
  const [groups, setGroups] = useState<GroupMembers>(new Map())
  const [groupsLoaded, setGroupsLoaded] = useState(false)
  const [mapping, setMapping] = useState<MappingState | null>(null)
  const [saved, setSaved] = useState<PlanStore | null>(null)
  const [loadedStores, setLoadedStores] = useState(false)
  const [statusFilter, setStatusFilter] = useState<Set<StepStatus>>(new Set())
  const [phaseFilter, setPhaseFilter] = useState<number | null>(null)
  const [skipDraft, setSkipDraft] = useState<{ id: string; reason: string } | null>(null)
  const [version, setVersion] = useState(0) // bumps after mutations to steps

  const snapshot = scan?.snapshot ?? null
  const planId = snapshot ? `plan-${snapshot.tenantId.slice(0, 8)}` : 'plan'

  useEffect(() => {
    if (!snapshot) return
    void Promise.all([
      loadMappingState(snapshot.tenantId),
      loadPlanRecord<PlanStore>(snapshot.tenantId),
    ]).then(([m, p]) => {
      setMapping(m)
      setSaved(p ?? { planId, steps: {}, checkpoints: [] })
      setLoadedStores(true)
    })
  }, [snapshot, planId])

  useEffect(() => {
    if (!snapshot) return
    let cancelled = false
    const ids = new Set<string>()
    for (const raw of snapshot.config.caPolicies?.rows ?? []) {
      const users = (raw as { conditions?: { users?: { includeGroups?: string[]; excludeGroups?: string[] } } })
        .conditions?.users
      for (const g of users?.includeGroups ?? []) ids.add(g)
      for (const g of users?.excludeGroups ?? []) ids.add(g)
    }
    void (async () => {
      const map: GroupMembers = new Map()
      for (const id of ids) {
        try {
          const g = await getGroupMembers(snapshot.tenantId, id)
          map.set(id, { memberIds: g.memberIds, memberCount: g.memberCount, sampled: g.sampled })
        } catch {
          // unresolved
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
  }, [snapshot])

  const computed = useMemo(() => {
    if (!snapshot || !baseline || !mapping || !groupsLoaded || !loadedStores) return null
    const strengths = buildStrengthLookup(snapshot.config.authStrengths?.rows ?? [])
    const questions = buildQuestions(baseline.pkg)
    const notInScope = new Set(
      Object.entries(mapping.targetState)
        .filter(([, t]) => !t.include)
        .map(([name]) => name),
    )
    const coverage = computeCoverage({
      snapshot,
      tenantPolicies: snapshot.config.caPolicies?.rows ?? [],
      baselinePolicies: baseline.pkg.policies.filter((p) => !notInScope.has(p.displayName)),
      baselineUnusable: baseline.pkg.report.warnings,
      strengths,
      groupMembers: groups,
      mapping: toCoverageMapping(mapping, questions),
      facetOverrides: mapping.facetOverrides,
    })
    const viability = buildViabilityInputs(snapshot, new Date().toISOString()).map(scoreMfaViability)
    const steps = generateRoadmap({
      planId,
      coverage,
      snapshot,
      baseline: baseline.pkg,
      baselineAuthor:
        baselineIndex.author !== undefined
          ? { author: baselineIndex.author, url: baselineIndex.authorUrl ?? '#' }
          : null,
      mapping,
      questions,
      viability,
      strengths,
    })
    mergePersisted(steps, saved?.steps ?? null)
    applyProgress(steps, snapshot, coverage, planId)
    return { steps, coverage, viability, questions }
  }, [snapshot, baseline, mapping, groupsLoaded, loadedStores, groups, saved, planId, version])

  // Persist step state after every recompute/mutation.
  useEffect(() => {
    if (!computed || !snapshot) return
    const stepsRecord: SavedSteps = Object.fromEntries(
      computed.steps.map((s) => [s.id, { status: s.status, history: s.history, skipReason: s.skipReason }]),
    )
    void savePlanRecord(snapshot.tenantId, { planId, steps: stepsRecord, checkpoints: saved?.checkpoints ?? [] })
  }, [computed, snapshot, planId, saved])

  // First-run capture (prompt 07 item 7) behind ?dev=1.
  useEffect(() => {
    if (!computed || !import.meta.env.DEV) return
    if (new URLSearchParams(window.location.search).get('dev') !== '1') return
    void saveDevResults('roadmap-run', {
      steps: computed.steps.map((s) => ({
        id: s.id,
        goalId: s.goalId,
        phase: s.phase,
        kind: s.kind,
        status: s.status,
        title: s.title,
        blockedBy: s.blockedBy,
        unblockNotes: s.unblockNotes,
        hasJson: s.action.json !== null,
        summary: s.action.summary,
        readiness: s.readiness,
        evidence: s.evidence.lines,
      })),
    })
  }, [computed])

  const userName = (id: string): string => {
    const u = snapshot?.users.find((x) => x.id === id)
    return u?.displayName ?? u?.userPrincipalName ?? id
  }

  const savePlan = (): void => {
    if (!computed || !snapshot || !mapping || !operator) return
    const summary = summarizeTenant(computed.viability)
    const exclusionGroups = [...groups.entries()].map(([groupId, g]) => ({ groupId, memberCount: g.memberCount }))
    const breakGlassIds = Object.values(mapping.records)
      .filter((r) => r.group === 'breakGlass' && r.resolvedId !== null)
      .map((r) => r.resolvedId as string)
    const checkpoint = makeCheckpoint({ snapshot, coverage: computed.coverage, summary, exclusionGroups, breakGlassIds })
    const checkpoints = [...(saved?.checkpoints ?? []), checkpoint]
    setSaved((p) => (p ? { ...p, checkpoints } : p))
    const plan = buildPlanFile({
      planId,
      snapshot,
      operator,
      baselineSource:
        baseline && baseline.source.startsWith('uploaded')
          ? { kind: 'upload', fileName: baseline.source }
          : { kind: 'github', owner: baselineIndex.owner, repo: baselineIndex.repo, commit: baselineIndex.commit },
      mapping,
      steps: computed.steps,
      checkpoints,
    })
    downloadFile(`iamai-plan-${snapshot.tenantId.slice(0, 8)}.json`, JSON.stringify(plan, null, 2), 'application/json')
  }

  const loadPlan = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0 || !snapshot) return
    const { plan, error } = parsePlanFile(await files[0].text())
    if (!plan) {
      window.alert?.(error ?? 'could not read the plan file')
      return
    }
    const stepsRecord: SavedSteps = Object.fromEntries(
      plan.steps.map((s) => [s.id, { status: s.status, history: s.history, skipReason: s.skipReason }]),
    )
    await savePlanRecord(snapshot.tenantId, { planId: plan.planId, steps: stepsRecord, checkpoints: plan.checkpoints })
    setSaved({ planId: plan.planId, steps: stepsRecord, checkpoints: plan.checkpoints })
    setVersion((v) => v + 1) // re-run generation + progress matching against the latest scan
  }

  const needs = [
    { met: scan !== null, text: scan !== null ? 'scan complete' : 'run a scan', href: '#/scan' },
    { met: baseline !== null, text: baseline !== null ? 'baseline loaded' : 'load a baseline', href: '#/baseline' },
  ]

  if (!computed) {
    return (
      <StepFrame title="Roadmap" does="The phased plan: every step with its why, population, readiness, evidence, action, exit criteria, and rollback." needs={needs}>
        <div className="card">
          {scan && baseline ? (
            <p className="reason">Preparing the roadmap (resolving group memberships)…</p>
          ) : (
            <p>
              The roadmap builds from a scan and a baseline. {!scan && <a href="#/scan">Run a scan</a>}
              {!scan && !baseline && ' and '}
              {!baseline && <a href="#/baseline">load a baseline</a>}.
            </p>
          )}
        </div>
      </StepFrame>
    )
  }

  const { steps } = computed
  const phases = [...new Set(steps.map((s) => s.phase))].sort((a, b) => a - b)
  const visible = steps.filter(
    (s) => (statusFilter.size === 0 || statusFilter.has(s.status)) && (phaseFilter === null || s.phase === phaseFilter),
  )
  const blockedToday = snapshot?.blockedToday ?? []

  return (
    <StepFrame
      title="Roadmap"
      does="The phased plan: every step with its why, population, readiness, evidence, action, exit criteria, and rollback."
      needs={needs}
    >
      {scan && (
        <p className="reason">
          Based on the scan from <span title={absolute(scan.at)}>{relative(scan.at)}</span> —{' '}
          <a href="#/scan">Re-scan</a>
        </p>
      )}
      <p className="no-print">
        <button className="primary" onClick={savePlan}>Save plan</button>{' '}
        <label className="chip">
          Load plan <input type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => void loadPlan(e.currentTarget.files)} />
        </label>{' '}
        <button onClick={() => window.print()}>Print</button>
      </p>

      {blockedToday.length > 0 && (
        <p className="notice">
          <strong>Blocked today:</strong>{' '}
          {new Set(blockedToday.flatMap((b) => b.userIds)).size} user(s) whose most recent sign-in
          failed Conditional Access — fix this before adding policies. Details on the Scan page.
        </p>
      )}

      <div className="tiles no-print">
        {phases.map((phase) => {
          const inPhase = steps.filter((s) => s.phase === phase)
          const done = inPhase.filter((s) => s.status === 'done').length
          const blocked = inPhase.filter((s) => s.status === 'blocked').length
          return (
            <button
              key={phase}
              className={`tile ${phaseFilter === phase ? 'selected' : ''}`}
              onClick={() => setPhaseFilter((p) => (p === phase ? null : phase))}
            >
              <div className="tile-count">
                {done}/{inPhase.length}
              </div>
              <div className="tile-label">
                {phase === 8 ? 'Baseline extras' : `Phase ${phase}`}
                {blocked > 0 && ` · ${blocked} blocked`}
              </div>
            </button>
          )
        })}
      </div>

      <div className="filters no-print">
        {(Object.keys(STATUS_LABEL) as StepStatus[]).map((s) => (
          <button
            key={s}
            className={`chip ${STATUS_CHIP[s]} ${statusFilter.has(s) ? 'selected' : ''}`}
            onClick={() =>
              setStatusFilter((prev) => {
                const next = new Set(prev)
                if (next.has(s)) next.delete(s)
                else next.add(s)
                return next
              })
            }
          >
            {STATUS_LABEL[s]} ({steps.filter((x) => x.status === s).length})
          </button>
        ))}
      </div>

      {phases.map((phase) => {
        const inPhase = visible.filter((s) => s.phase === phase)
        if (inPhase.length === 0) return null
        return (
          <div key={phase} className="phase-group">
            <h3>{phase === 8 ? 'From this baseline' : `Phase ${phase}`}</h3>
            {inPhase.map((step) => (
              <details key={step.id} className="card step-card">
                <summary>
                  <span className={`chip ${STATUS_CHIP[step.status]}`}>{STATUS_LABEL[step.status]}</span>{' '}
                  <span className="chip">{step.kind}</span> {step.title}
                  {step.population.total > 0 && (
                    <span className="reason"> — {step.population.total} user(s), {step.population.active} active</span>
                  )}
                </summary>

                <h4>Why</h4>
                <p>
                  {step.why}
                  {step.whyAttribution && (
                    <span className="reason">
                      {' '}
                      — baseline author's intent,{' '}
                      <a href={step.whyAttribution.url} target="_blank" rel="noreferrer">
                        {step.whyAttribution.author}
                      </a>
                    </span>
                  )}
                </p>

                {step.status === 'blocked' && step.unblockNotes.length > 0 && (
                  <p className="notice">Unblocked by: {step.unblockNotes.join('; ')}</p>
                )}

                {step.population.total > 0 && (
                  <>
                    <h4>Population</h4>
                    <p className="reason">
                      {step.population.total} total · {step.population.active} active · {step.population.admins} admin(s) ·{' '}
                      {step.population.guests} guest(s)
                    </p>
                  </>
                )}

                {step.readiness.lines.length > 0 && (
                  <>
                    <h4>Readiness</h4>
                    <ul className="sections">
                      {step.readiness.lines.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </>
                )}

                {step.evidence.lines.length > 0 && (
                  <>
                    <h4>Evidence</h4>
                    <ul className="sections">
                      {step.evidence.lines.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                      {step.evidence.affectedUserIds.length > 0 && (
                        <li>affected: {step.evidence.affectedUserIds.map(userName).join(', ')}</li>
                      )}
                    </ul>
                  </>
                )}

                <h4>Action</h4>
                <ul className="sections">
                  {step.action.summary.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
                {step.action.json && <ActionTabs step={step} />}

                <h4>Exit criteria</h4>
                <ul className="sections">
                  {step.exitCriteria.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>

                <h4>Rollback</h4>
                <p className="reason">{step.rollback}</p>

                {step.history.length > 0 && (
                  <>
                    <h4>History</h4>
                    <ul className="sections">
                      {step.history.map((h, i) => (
                        <li key={i}>
                          <span title={absolute(h.at)}>{relative(h.at)}</span>: {h.from} → {h.to}
                          {h.note && ` — ${h.note}`}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {step.status !== 'done' && step.status !== 'skipped' && (
                  <p className="no-print">
                    {skipDraft?.id === step.id ? (
                      <>
                        <input
                          type="text"
                          placeholder='Why is this not applicable? (never "risk accepted")'
                          value={skipDraft.reason}
                          onChange={(e) => setSkipDraft({ id: step.id, reason: e.currentTarget.value })}
                        />{' '}
                        <button
                          onClick={() => {
                            const r = skipStep(step, skipDraft.reason)
                            if (r.ok) {
                              setSkipDraft(null)
                              setVersion((v) => v + 1)
                            } else {
                              setSkipDraft({ id: step.id, reason: skipDraft.reason })
                              window.alert?.(r.error)
                            }
                          }}
                        >
                          Confirm skip
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setSkipDraft({ id: step.id, reason: '' })}>Skip this step…</button>
                    )}
                  </p>
                )}
              </details>
            ))}
          </div>
        )
      })}
    </StepFrame>
  )
}

function ActionTabs({ step }: { step: Step }) {
  const [tab, setTab] = useState<'json' | 'portal' | 'ps'>('json')
  return (
    <div>
      <p className="no-print">
        <button className={`chip ${tab === 'json' ? 'selected' : ''}`} onClick={() => setTab('json')}>JSON</button>{' '}
        <button className={`chip ${tab === 'portal' ? 'selected' : ''}`} onClick={() => setTab('portal')}>Portal steps</button>{' '}
        <button className={`chip ${tab === 'ps' ? 'selected' : ''}`} onClick={() => setTab('ps')}>PowerShell</button>{' '}
        {step.action.json && (
          <button className="chip" onClick={() => downloadFile(`${step.id}.json`, step.action.json!, 'application/json')}>
            Download JSON
          </button>
        )}
      </p>
      {tab === 'json' && step.action.json && <pre className="code-block">{step.action.json}</pre>}
      {tab === 'portal' && (
        <ol className="sections">
          {step.action.portalSteps.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
      )}
      {tab === 'ps' && step.action.powershell && <pre className="code-block">{step.action.powershell}</pre>}
    </div>
  )
}
