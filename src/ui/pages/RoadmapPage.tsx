// Roadmap — an actual plan (2026-08-27 redesign): dated phases, danger areas
// with named people, a safe-today lane, and steps with per-tenant impact.
import { useEffect, useMemo, useState } from 'react'
import { loadPlanRecord, savePlanRecord } from '../../graph/collect/cache.ts'
import { getGroupMembers, resolveNames } from '../../graph/collect/onDemand.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { computeCoverage } from '../../coverage/coverage.ts'
import { buildStrengthLookup } from '../../coverage/strength.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import { buildQuestions } from '../../mapping/questions.ts'
import { loadMappingState, toCoverageMapping } from '../../mapping/store.ts'
import type { MappingState } from '../../mapping/types.ts'
import { buildNameDirectory } from '../../names.ts'
import { buildViabilityInputs } from '../../scoring/fromSnapshot.ts'
import { scoreMfaViability, summarizeTenant } from '../../scoring/mfaViability.ts'
import { generateRoadmap } from '../../roadmap/generate.ts'
import { findDangerAreas } from '../../roadmap/dangers.ts'
import { nextMonday } from '../../roadmap/schedule.ts'
import { applyProgress, mergePersisted, skipStep } from '../../roadmap/progress.ts'
import { buildPlanFile, makeCheckpoint, parsePlanFile } from '../../roadmap/plan.ts'
import type { Checkpoint } from '../../roadmap/plan.ts'
import type { Step, StepStatus } from '../../roadmap/types.ts'
import { saveDevResults } from '../../graph/spikes/spike1.ts'
import baselineIndex from '../../../baselines/jhope188-conditionalaccesspolicies.index.json' with { type: 'json' }
import { absolute, absoluteDate, downloadFile, relative } from '../format.ts'
import { StepFrame } from '../shell/AppShell.tsx'
import { SectionTabs } from '../shell/SectionTabs.tsx'
import type { BaselineResult } from './BaselinePage.tsx'

type SavedSteps = Record<string, { status: StepStatus; history: Step['history']; skipReason: string | null }>
type PlanStore = { planId: string; steps: SavedSteps; checkpoints: Checkpoint[]; startDate?: string }

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

const PHASE_NAME: Record<number, string> = {
  0: 'Foundations',
  1: 'Low-impact blocks',
  2: 'MFA for everyone',
  3: 'Admin hardening',
  4: 'Guests and locations',
  5: 'Devices',
  6: 'Sessions',
  7: 'Advanced',
  8: 'From this baseline',
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
  const [extraNames, setExtraNames] = useState<Map<string, string>>(new Map())
  const [statusFilter, setStatusFilter] = useState<Set<StepStatus>>(new Set())
  const [skipDraft, setSkipDraft] = useState<{ id: string; reason: string } | null>(null)
  const [version, setVersion] = useState(0)
  const [copied, setCopied] = useState<string | null>(null)

  const snapshot = scan?.snapshot ?? null
  const planId = snapshot ? `plan-${snapshot.tenantId.slice(0, 8)}` : 'plan'

  useEffect(() => {
    if (!snapshot) return
    void Promise.all([loadMappingState(snapshot.tenantId), loadPlanRecord<PlanStore>(snapshot.tenantId)]).then(
      ([m, p]) => {
        setMapping(m)
        setSaved(p ?? { planId, steps: {}, checkpoints: [] })
        setLoadedStores(true)
      },
    )
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
          map.set(id, { memberIds: g.memberIds, memberCount: g.memberCount, sampled: g.sampled, displayName: g.displayName })
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

  const startDate = saved?.startDate ?? (snapshot ? nextMonday(new Date().toISOString()) : null)

  const computed = useMemo(() => {
    if (!snapshot || !baseline || !mapping || !groupsLoaded || !loadedStores || !startDate) return null
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
    const names = buildNameDirectory(snapshot, groups, extraNames)
    const { steps, schedule } = generateRoadmap({
      planId,
      coverage,
      snapshot,
      baseline: baseline.pkg,
      baselineAuthor:
        baselineIndex.author !== undefined ? { author: baselineIndex.author, url: baselineIndex.authorUrl ?? '#' } : null,
      mapping,
      questions,
      viability,
      strengths,
      startDate,
      operatorUserId: operator?.userId ?? null,
      names,
    })
    mergePersisted(steps, saved?.steps ?? null)
    applyProgress(steps, snapshot, coverage, planId)
    const dangers = findDangerAreas({
      snapshot,
      viability,
      highCareUserIds: mapping.highCareUserIds,
      operatorUserId: operator?.userId ?? null,
      breakGlassUserIds: mapping.breakGlassUserIds,
    })
    return { steps, schedule, coverage, viability, names, dangers }
  }, [snapshot, baseline, mapping, groupsLoaded, loadedStores, groups, saved, planId, version, startDate, operator, extraNames])

  // Resolve any ids the directory could not name (portal steps, exclusions).
  useEffect(() => {
    if (!computed) return
    const text = computed.steps.map((s) => s.action.portalSteps.join(' ')).join(' ')
    const ids = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? []
    const unknown = computed.names.unknown(new Set(ids))
    if (unknown.length === 0) return
    void resolveNames(unknown).then((m) => {
      if (m.size > 0) setExtraNames((prev) => new Map([...prev, ...m]))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed?.steps.length])

  useEffect(() => {
    if (!computed || !snapshot) return
    const stepsRecord: SavedSteps = Object.fromEntries(
      computed.steps.map((s) => [s.id, { status: s.status, history: s.history, skipReason: s.skipReason }]),
    )
    void savePlanRecord(snapshot.tenantId, {
      planId,
      steps: stepsRecord,
      checkpoints: saved?.checkpoints ?? [],
      startDate,
    })
  }, [computed, snapshot, planId, saved, startDate])

  useEffect(() => {
    if (!computed || !import.meta.env.DEV) return
    if (new URLSearchParams(window.location.search).get('dev') !== '1') return
    void saveDevResults('roadmap-run', {
      schedule: computed.schedule,
      dangers: computed.dangers.map((d) => ({ title: d.title, people: d.people.length })),
      steps: computed.steps.map((s) => ({
        id: s.id,
        phase: s.phase,
        kind: s.kind,
        status: s.status,
        title: s.title,
        impact: s.impact,
        safeToday: s.safeToday,
        blockedBy: s.blockedBy,
        unblockNotes: s.unblockNotes,
        hasJson: s.action.json !== null,
      })),
    })
  }, [computed])

  const needs = [
    { met: scan !== null, text: scan !== null ? 'scan complete' : 'run a scan', href: '#/scan' },
    { met: baseline !== null, text: baseline !== null ? 'baseline loaded' : 'load a baseline', href: '#/baseline' },
  ]

  if (!computed || !snapshot) {
    return (
      <StepFrame title="Roadmap" does="Your dated plan from here to the baseline — with the danger areas called out by name." needs={needs}>
        <div className="card">
          {scan && baseline ? (
            <p className="reason">Preparing the plan (resolving group memberships)…</p>
          ) : (
            <p>
              The plan builds from a scan and a baseline. {!scan && <a href="#/scan">Run a scan</a>}
              {!scan && !baseline && ' and '}
              {!baseline && <a href="#/baseline">load a baseline</a>}.
            </p>
          )}
        </div>
      </StepFrame>
    )
  }

  const { steps, schedule, dangers } = computed
  const nameOf = (id: string) => computed.names.label(id)
  const work = steps.filter((s) => s.status !== 'done' && s.status !== 'skipped')
  const done = steps.filter((s) => s.status === 'done')
  const safe = steps.filter((s) => s.safeToday)
  const blocked = steps.filter((s) => s.status === 'blocked')
  const phases = [...new Set(steps.map((s) => s.phase))].sort((a, b) => a - b)
  const tenantName =
    ((snapshot.config.organization?.rows?.[0] ?? {}) as { displayName?: string }).displayName ?? 'your tenant'

  const copy = async (id: string, text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // clipboard unavailable — the text is visible on screen anyway
    }
  }

  const setStart = (iso: string): void => {
    setSaved((p) => (p ? { ...p, startDate: iso } : p))
    setVersion((v) => v + 1)
  }

  const savePlan = (): void => {
    if (!mapping || !operator) return
    const summary = summarizeTenant(computed.viability)
    const exclusionGroups = [...groups.entries()].map(([groupId, g]) => ({ groupId, memberCount: g.memberCount }))
    const checkpoint = makeCheckpoint({
      snapshot,
      coverage: computed.coverage,
      summary,
      exclusionGroups,
      breakGlassIds: mapping.breakGlassUserIds,
    })
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
      steps,
      checkpoints,
    })
    downloadFile(`iamai-plan-${snapshot.tenantId.slice(0, 8)}.json`, JSON.stringify(plan, null, 2), 'application/json')
  }

  const loadPlan = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return
    const { plan, error } = parsePlanFile(await files[0].text())
    if (!plan) {
      window.alert?.(error ?? 'could not read the plan file')
      return
    }
    const stepsRecord: SavedSteps = Object.fromEntries(
      plan.steps.map((s) => [s.id, { status: s.status, history: s.history, skipReason: s.skipReason }]),
    )
    const start = startDate ?? undefined
    await savePlanRecord(snapshot.tenantId, { planId: plan.planId, steps: stepsRecord, checkpoints: plan.checkpoints, startDate: start })
    setSaved({ planId: plan.planId, steps: stepsRecord, checkpoints: plan.checkpoints, startDate: start })
    setVersion((v) => v + 1)
  }

  const overview = () => (
    <div className="advisor">
      <p>
        <strong>
          {tenantName}: {done.length} of {steps.length} steps are already in place
        </strong>{' '}
        — {work.length} to go. Starting{' '}
        <span title={absolute(schedule.start)}>{absoluteDate(schedule.start)}</span>, I'd have this done by{' '}
        <strong title={absolute(schedule.targetEnd)}>{absoluteDate(schedule.targetEnd)}</strong> — about{' '}
        {schedule.weeks} week{schedule.weeks === 1 ? '' : 's'}
        {schedule.withinTypicalTarget ? ', inside the usual 2–4 week window' : ' — longer than usual because of the observation windows each new policy needs'}
        .
      </p>
      {safe.length > 0 && (
        <p>
          <strong>Do these {safe.length} today:</strong> {safe.map((s) => s.title.replace(/^Block: /, '')).join('; ')}.
          Nobody in {tenantName} used what they block in the last 30 days — free security, zero interruption.
        </p>
      )}
      {dangers.length > 0 && (
        <p>
          <strong>{dangers.filter((d) => d.severity === 'high').length} thing(s) need care before we start</strong> — the
          Danger areas tab names the people and the exact settings.
        </p>
      )}
      {blocked.length > 0 && (
        <p>
          {blocked.length} step(s) are blocked right now; each one says exactly what unblocks it. Most of them clear once
          the verification campaign in phase 2 lands.
        </p>
      )}
      <p className="no-print">
        <label>
          Plan start date:{' '}
          <input
            type="date"
            value={schedule.start.slice(0, 10)}
            onChange={(e) => e.currentTarget.value && setStart(`${e.currentTarget.value}T00:00:00.000Z`)}
          />
        </label>
      </p>
      <p className="no-print">
        <button className="primary" onClick={savePlan}>
          Save plan
        </button>{' '}
        <button onClick={() => void copy('plan-md', planMarkdown(tenantName, steps, schedule, dangers, nameOf))}>
          {copied === 'plan-md' ? 'Copied ✓' : 'Copy as Markdown'}
        </button>{' '}
        <label className="chip">
          Load plan <input type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => void loadPlan(e.currentTarget.files)} />
        </label>{' '}
        <button onClick={() => window.print()}>Print the plan</button>
      </p>
    </div>
  )

  const timeline = () => (
    <div>
      {schedule.phases.map((p) => {
        const inPhase = steps.filter((s) => s.phase === p.phase)
        const phaseDone = inPhase.filter((s) => s.status === 'done').length
        return (
          <div key={p.phase} className="timeline-row">
            <div className="timeline-dates">
              {p.days === 0 ? 'complete' : `${absoluteDate(p.start)} → ${absoluteDate(p.end)}`}
            </div>
            <div>
              <strong>
                Phase {p.phase}: {PHASE_NAME[p.phase] ?? ''}
              </strong>{' '}
              <span className="reason">
                {phaseDone}/{inPhase.length} done{p.note ? ` · ${p.note}` : ''}
              </span>
              <ul className="sections">
                {inPhase.map((s) => (
                  <li key={s.id}>
                    <span className={`chip ${STATUS_CHIP[s.status]}`}>{STATUS_LABEL[s.status]}</span> {s.title}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )
      })}
    </div>
  )

  const dangerAreas = () => (
    <div>
      {dangers.length === 0 && (
        <p className="advisor">Nothing alarming: no one is blocked today, and everyone flagged for care can already use MFA.</p>
      )}
      {dangers.map((d, i) => (
        <div key={i} className={`card danger-${d.severity}`}>
          <h4>{d.title}</h4>
          <p>{d.detail}</p>
          <ul className="sections">
            {d.people.map((p, j) => (
              <li key={j}>
                <strong>{p.name}</strong> — {p.need}
              </li>
            ))}
          </ul>
          {d.entraPath && (
            <p className="reason">
              Where: <code>{d.entraPath}</code>
            </p>
          )}
          {d.link && (
            <p className="reason">
              <a href={d.link.url} target="_blank" rel="noreferrer">
                {d.link.label} →
              </a>
            </p>
          )}
        </div>
      ))}
    </div>
  )

  const stepsView = () => {
    const visible = steps.filter((s) => statusFilter.size === 0 || statusFilter.has(s.status))
    return (
      <div>
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
          const sched = schedule.phases.find((p) => p.phase === phase)
          return (
            <div key={phase} className="phase-group">
              <h3>
                Phase {phase}: {PHASE_NAME[phase] ?? ''}{' '}
                {sched && sched.days > 0 && (
                  <span className="reason">
                    {absoluteDate(sched.start)} → {absoluteDate(sched.end)}
                  </span>
                )}
              </h3>
              {inPhase.map((step) => (
                <StepCard
                  key={step.id}
                  step={step}
                  nameOf={nameOf}
                  copied={copied}
                  onCopy={copy}
                  skipDraft={skipDraft}
                  setSkipDraft={setSkipDraft}
                  onSkipped={() => setVersion((v) => v + 1)}
                />
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <StepFrame title="Roadmap" does="Your dated plan from here to the baseline — with the danger areas called out by name." needs={needs}>
      {scan && (
        <p className="reason">
          Based on the scan from <span title={absolute(scan.at)}>{relative(scan.at)}</span> —{' '}
          <a href="#/scan">Re-scan</a>
        </p>
      )}
      <SectionTabs
        sections={[
          { id: 'overview', label: 'Overview', render: overview },
          { id: 'timeline', label: 'Timeline', badge: `${schedule.weeks}w`, render: timeline },
          { id: 'danger', label: 'Danger areas', badge: dangers.length || '', render: dangerAreas },
          { id: 'steps', label: 'Steps', badge: `${done.length}/${steps.length}`, render: stepsView },
        ]}
      />
    </StepFrame>
  )
}

// Paste-into-a-ticket version of the plan (MSPs live in PSA tools).
function planMarkdown(
  tenantName: string,
  steps: Step[],
  schedule: { start: string; targetEnd: string; weeks: number; phases: { phase: number; start: string; end: string; days: number }[] },
  dangers: { title: string; people: { name: string; need: string }[] }[],
  nameOf: (id: string) => string,
): string {
  const lines: string[] = [
    `# IAMAI rollout plan — ${tenantName}`,
    '',
    `Start ${schedule.start.slice(0, 10)} → target ${schedule.targetEnd.slice(0, 10)} (${schedule.weeks} weeks)`,
    '',
  ]
  if (dangers.length > 0) {
    lines.push('## Danger areas')
    for (const d of dangers) {
      lines.push(`- **${d.title}**`)
      for (const p of d.people) lines.push(`  - ${p.name} — ${p.need}`)
    }
    lines.push('')
  }
  for (const p of schedule.phases) {
    const inPhase = steps.filter((s) => s.phase === p.phase)
    if (inPhase.length === 0) continue
    lines.push(`## Phase ${p.phase}: ${PHASE_NAME[p.phase] ?? ''} (${p.days === 0 ? 'complete' : `${p.start.slice(0, 10)} → ${p.end.slice(0, 10)}`})`)
    for (const s of inPhase) {
      lines.push(`- [${s.status === 'done' ? 'x' : ' '}] **${s.title}** — ${s.impact}`)
      if (s.highCare.userIds.length > 0) lines.push(`  - Handle with care: ${s.highCare.userIds.map(nameOf).join(', ')}`)
      if (s.status === 'blocked') lines.push(`  - Blocked: ${s.unblockNotes.join('; ')}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

function StepCard({
  step,
  nameOf,
  copied,
  onCopy,
  skipDraft,
  setSkipDraft,
  onSkipped,
}: {
  step: Step
  nameOf: (id: string) => string
  copied: string | null
  onCopy: (id: string, text: string) => Promise<void>
  skipDraft: { id: string; reason: string } | null
  setSkipDraft: (d: { id: string; reason: string } | null) => void
  onSkipped: () => void
}) {
  const [tab, setTab] = useState<'json' | 'portal' | 'ps'>('portal')
  return (
    <details className={`card step-card ${step.safeToday ? 'lane-safe' : ''}`}>
      <summary>
        <span className={`chip ${STATUS_CHIP[step.status]}`}>{STATUS_LABEL[step.status]}</span>{' '}
        {step.safeToday && <span className="chip state-verified">safe today</span>} {step.title}
        <div className="sub">{step.impact}</div>
      </summary>

      <h4>Why</h4>
      <p>
        {step.why}
        {step.whyAttribution && (
          <span className="reason">
            {' '}
            — the baseline author's intent,{' '}
            <a href={step.whyAttribution.url} target="_blank" rel="noreferrer">
              {step.whyAttribution.author}
            </a>
          </span>
        )}
      </p>
      {step.learn && (
        <p className="reason">
          <a href={step.learn.url} target="_blank" rel="noreferrer">
            Microsoft Learn →
          </a>{' '}
          {step.learn.tldr}
          {step.learn.cis.map((c) => (
            <span key={c} className="chip">
              CIS {c}
            </span>
          ))}
        </p>
      )}

      {step.status === 'blocked' && step.unblockNotes.length > 0 && (
        <p className="notice">Unblocked by: {step.unblockNotes.join('; ')}</p>
      )}

      {step.highCare.userIds.length > 0 && (
        <div className={`card ${step.highCare.ready ? '' : 'danger-high'}`}>
          <h4>Handle with care — {step.highCare.userIds.map(nameOf).join(', ')}</h4>
          <ul className="sections">
            {step.highCare.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
            {step.highCare.ready && <li>All verified — this step can be enforced for them when the evidence is clean.</li>}
          </ul>
        </div>
      )}

      {step.includesOperator && (
        <p className={step.operatorSafe ? 'notice' : 'notice error'}>
          This policy applies to <strong>your own account</strong>.{' '}
          {step.operatorSafe
            ? 'I checked your registered methods — you have a strong one. You will not lock yourself out.'
            : 'Register a passkey/FIDO2 key and complete one MFA sign-in before enforcing this.'}
        </p>
      )}

      {step.population.total > 0 && (
        <>
          <h4>Who it touches</h4>
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
          <h4>What the last 30 days say</h4>
          <ul className="sections">
            {step.evidence.lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
            {step.evidence.affectedUserIds.length > 0 && (
              <li>affected: {step.evidence.affectedUserIds.map(nameOf).join(', ')}</li>
            )}
          </ul>
        </>
      )}

      <h4>What to do</h4>
      <ul className="sections">
        {step.action.summary.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      {step.action.json && (
        <div>
          <p className="no-print">
            <button className={`chip ${tab === 'portal' ? 'selected' : ''}`} onClick={() => setTab('portal')}>Portal steps</button>{' '}
            <button className={`chip ${tab === 'json' ? 'selected' : ''}`} onClick={() => setTab('json')}>JSON</button>{' '}
            <button className={`chip ${tab === 'ps' ? 'selected' : ''}`} onClick={() => setTab('ps')}>PowerShell</button>{' '}
            <button className="chip" onClick={() => downloadFile(`${step.id}.json`, step.action.json!, 'application/json')}>
              Download JSON
            </button>
          </p>
          {tab === 'portal' && (
            <ol className="sections">
              {step.action.portalSteps.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ol>
          )}
          {tab === 'json' && <pre className="code-block">{step.action.json}</pre>}
          {tab === 'ps' && step.action.powershell && <pre className="code-block">{step.action.powershell}</pre>}
        </div>
      )}

      {step.comms && (
        <>
          <h4>Tell your people</h4>
          <pre className="code-block" style={{ whiteSpace: 'pre-wrap' }}>{step.comms}</pre>
          <p className="no-print">
            <button className="chip" onClick={() => void onCopy(step.id, step.comms!)}>
              {copied === step.id ? 'Copied ✓' : 'Copy announcement'}
            </button>
          </p>
        </>
      )}

      <h4>Done when</h4>
      <ul className="sections">
        {step.exitCriteria.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>

      <h4>If it goes wrong</h4>
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
                    onSkipped()
                  } else window.alert?.(r.error)
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
  )
}
