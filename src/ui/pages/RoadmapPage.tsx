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
import { loadMappingState, saveMappingState, toCoverageMapping } from '../../mapping/store.ts'
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
import { ROADMAP as C } from '../../copy/pages.ts'
import { CHIP, STEP_KIND, STEP_STATUS, TILE } from '../../copy/definitions.ts'
import { roadmapOverview } from '../../copy/statements.ts'
import { PHASE_NAME, STEP_KIND_LABEL, STEP_STATUS_LABEL, affectedLine } from '../../copy/steps.ts'
import { DEFAULT_PACE, PACES } from '../../roadmap/constants.ts'
import type { Pace } from '../../roadmap/constants.ts'
import type { Schedule } from '../../roadmap/schedule.ts'
import { PrintPlan } from './PrintPlan.tsx'
import { absolute, absoluteDate, dateRange, downloadFile, relative, when, whenAt } from '../format.ts'
import { StepFrame } from '../shell/AppShell.tsx'
import { Button, Callout, Card, Chip, ExpandCard, FilterChip, StatTile, Stats, Tabs } from '../components/index.ts'
import type { ChipStatus } from '../components/index.ts'
import type { BaselineResult } from './BaselinePage.tsx'

type SavedSteps = Record<string, { status: StepStatus; history: Step['history']; skipReason: string | null }>
type PlanStore = { planId: string; steps: SavedSteps; checkpoints: Checkpoint[]; startDate?: string; pace?: Pace }

const STATUS_CHIP: Record<StepStatus, ChipStatus> = {
  done: 'done',
  ready: 'ready',
  blocked: 'blocked',
  'in-report-only': 'in-progress',
  'ready-to-enforce': 'ready',
  skipped: 'neutral',
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
  const pace: Pace = saved?.pace ?? DEFAULT_PACE

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
      pace,
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
  }, [snapshot, baseline, mapping, groupsLoaded, loadedStores, groups, saved, planId, version, startDate, pace, operator, extraNames])

  // The print document exists only once the plan is computed; until then the
  // screen layout prints as-is.
  const hasPlan = computed !== null
  useEffect(() => {
    if (!hasPlan) return
    document.body.classList.add('has-print-plan')
    return () => document.body.classList.remove('has-print-plan')
  }, [hasPlan])

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
      pace,
    })
  }, [computed, snapshot, planId, saved, startDate, pace])

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
    { met: scan !== null, text: scan !== null ? C.needsScan : C.needScan, href: '#/scan' },
    { met: baseline !== null, text: baseline !== null ? C.needsBaseline : C.needBaseline, href: '#/baseline' },
  ]

  if (!computed || !snapshot) {
    return (
      <StepFrame title={C.title} does={C.does} needs={needs}>
        <Card>
          {scan && baseline ? (
            <p className="reason">{C.preparing}</p>
          ) : (
            <p>
              {C.blocked} {!scan && <a href="#/scan">{C.runScan}</a>}
              {!scan && !baseline && ` ${C.and} `}
              {!baseline && <a href="#/baseline">{C.loadBaseline}</a>}.
            </p>
          )}
        </Card>
      </StepFrame>
    )
  }

  const { steps, schedule, dangers } = computed
  const nameOf = (id: string) => computed.names.label(id)
  const work = steps.filter((s) => s.status !== 'done' && s.status !== 'skipped')
  const done = steps.filter((s) => s.status === 'done')
  const safe = steps.filter((s) => s.safeToday)
  const blocked = steps.filter((s) => s.status === 'blocked')
  const tenantName =
    ((snapshot.config.organization?.rows?.[0] ?? {}) as { displayName?: string }).displayName ?? 'This tenant'

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
  const setPace = (next: Pace): void => {
    setSaved((p) => (p ? { ...p, pace: next } : p))
    setVersion((v) => v + 1)
  }
  const waveTitle = (w: Schedule['waves'][number]) => (w.wave === 0 ? C.day0 : C.wave(w.wave, PHASE_NAME[w.phase] ?? ''))
  const stepById = new Map(steps.map((s) => [s.id, s]))

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
      window.alert?.(error ?? C.couldNotRead)
      return
    }
    const stepsRecord: SavedSteps = Object.fromEntries(
      plan.steps.map((s) => [s.id, { status: s.status, history: s.history, skipReason: s.skipReason }]),
    )
    const start = startDate ?? undefined
    await savePlanRecord(snapshot.tenantId, { planId: plan.planId, steps: stepsRecord, checkpoints: plan.checkpoints, startDate: start })
    // Setup answers travel with the plan file (provenance intact); re-opening Setup shows them.
    if (plan.mappings && plan.mappings.tenantId === snapshot.tenantId) {
      await saveMappingState(plan.mappings)
      setMapping(plan.mappings)
    }
    setSaved({ planId: plan.planId, steps: stepsRecord, checkpoints: plan.checkpoints, startDate: start })
    setVersion((v) => v + 1)
  }

  const overviewText = roadmapOverview({
    tenant: tenantName,
    done: done.length,
    total: steps.length,
    pace: C.paceWord[schedule.pace] ?? schedule.pace,
    finishes: when(schedule.targetEnd),
    weeks: schedule.weeks,
  })

  const overview = () => (
    <div className="advisor">
      <p>
        <strong>{overviewText}</strong>
        {!schedule.withinTypicalTarget && work.length > 0 && ` ${C.longerThanUsual}`}
      </p>
      <Stats>
        <StatTile value={`${done.length}/${steps.length}`} label={TILE.stepsDone.title} tone="success" tip={TILE.stepsDone} />
        <StatTile value={schedule.weeks} label={TILE.weeks.title} tip={TILE.weeks} />
        <StatTile value={safe.length} label={CHIP.safeToday.title} tone="info" tip={CHIP.safeToday} />
        <StatTile value={blocked.length} label={STEP_STATUS.blocked.title} tone={blocked.length > 0 ? 'warning' : 'neutral'} tip={STEP_STATUS.blocked} />
      </Stats>
      {safe.length > 0 && (
        <p>
          <strong>{C.safeToday(safe.length)}</strong> {safe.map((s) => s.title).join('; ')}. {C.safeTodayWhy(tenantName)}
        </p>
      )}
      {dangers.length > 0 && (
        <p>
          <strong>{C.dangers(dangers.filter((d) => d.severity === 'high').length)}</strong> {C.dangersAfter}
        </p>
      )}
      {blocked.length > 0 && <p>{C.blockedSteps(blocked.length)}</p>}
      <p className="row no-print">
        <label>
          {C.startDate}{' '}
          <input
            type="date"
            value={schedule.start.slice(0, 10)}
            onChange={(e) => e.currentTarget.value && setStart(`${e.currentTarget.value}T12:00:00.000Z`)}
          />{' '}
          <span className="muted">{when(schedule.start)}</span>
        </label>
      </p>
      <div className="row no-print">
        <span className="muted">{C.paceLabel}</span>
        {(Object.keys(PACES) as Pace[]).map((p) => (
          <FilterChip key={p} selected={pace === p} title={C.paces[p].text} onToggle={() => setPace(p)}>
            {C.paces[p].label}
          </FilterChip>
        ))}
        <span className="muted">{C.paces[pace].text}</span>
      </div>
      <p className="row no-print">
        <Button variant="primary" icon="download" onClick={savePlan}>
          {C.save}
        </Button>
        <Button icon="copy" onClick={() => void copy('plan-md', planMarkdown(tenantName, steps, schedule, dangers, nameOf))}>
          {copied === 'plan-md' ? C.copied : C.copyMarkdown}
        </Button>
        <label className="btn">
          {C.load} <input type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => void loadPlan(e.currentTarget.files)} />
        </label>
        <Button icon="print" onClick={() => window.print()}>
          {C.print}
        </Button>
      </p>
    </div>
  )

  const timeline = () => {
    const created = steps.filter((s) => s.kind === 'create' && s.status !== 'done' && s.status !== 'skipped').length
    const stepLine = (s: Step) => (
      <li key={s.id}>
        <Chip status={STATUS_CHIP[s.status]} title={STEP_STATUS[s.status].text}>
          {STEP_STATUS_LABEL[s.status]}
        </Chip>{' '}
        <a href={`#step-${s.id}`}>{s.title}</a>
      </li>
    )
    return (
      <div>
        {schedule.waves.map((w) => {
          const inWave = w.stepIds.map((id) => stepById.get(id)).filter((s): s is Step => s !== undefined)
          const waveDone = inWave.filter((s) => s.status === 'done').length
          return (
            <div key={w.wave}>
              <div className="timeline-row">
                <div className="timeline-dates">{w.days === 0 ? absoluteDate(w.start) : dateRange(w.start, w.end)}</div>
                <div>
                  <strong>{waveTitle(w)}</strong>{' '}
                  <span className="reason">
                    {C.phaseDone(waveDone, inWave.length)}
                    {w.note ? ` · ${w.note}` : ''}
                  </span>
                  {w.wave === 0 && created > 0 && <p className="reason">{C.day0Text(created)}</p>}
                  <ul className="sections">{inWave.map(stepLine)}</ul>
                </div>
              </div>
              {w.wave === 0 && schedule.observation.days > 0 && (
                <div className="timeline-row">
                  <div className="timeline-dates">{dateRange(schedule.observation.start, schedule.observation.end)}</div>
                  <div>
                    <strong>{C.observation(schedule.observation.days)}</strong>
                    <p className="reason">{C.observationText}</p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const dangerAreas = () => (
    <div>
      {dangers.length === 0 && <p className="advisor">{C.noDangers}</p>}
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
              {C.where} <code>{d.entraPath}</code>
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
        <div className="row no-print">
          {(Object.keys(STEP_STATUS_LABEL) as StepStatus[]).map((s) => (
            <FilterChip
              key={s}
              selected={statusFilter.has(s)}
              title={STEP_STATUS[s].text}
              onToggle={() =>
                setStatusFilter((prev) => {
                  const next = new Set(prev)
                  if (next.has(s)) next.delete(s)
                  else next.add(s)
                  return next
                })
              }
            >
              {C.filterCount(STEP_STATUS_LABEL[s], steps.filter((x) => x.status === s).length)}
            </FilterChip>
          ))}
        </div>
        {schedule.waves.map((w) => {
          const inWave = w.stepIds.map((id) => stepById.get(id)).filter((s): s is Step => s !== undefined && visible.includes(s))
          if (inWave.length === 0) return null
          return (
            <div key={w.wave} className="phase-group">
              <h3>
                {waveTitle(w)} <span className="reason">{w.days === 0 ? absoluteDate(w.start) : dateRange(w.start, w.end)}</span>
              </h3>
              {inWave.map((step) => (
                <StepCard
                  key={step.id}
                  step={step}
                  stepById={stepById}
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
    <StepFrame title={C.title} does={C.does} needs={needs}>
      {scan && (
        <p className="reason">
          {C.basedOn(whenAt(scan.at))} <a href="#/scan">{C.rescan}</a>
        </p>
      )}
      <Tabs
        tabs={[
          { id: 'overview', label: C.tabs.overview, render: overview },
          { id: 'timeline', label: C.tabs.timeline, badge: C.weeksBadge(schedule.weeks), render: timeline },
          { id: 'danger', label: C.tabs.danger, badge: dangers.length || '', render: dangerAreas },
          { id: 'steps', label: C.tabs.steps, badge: `${done.length}/${steps.length}`, render: stepsView },
        ]}
      />
      <PrintPlan
        tenantName={tenantName}
        baselineLabel={baseline ? baselineIndex.label : ''}
        operator={operator?.userPrincipalName ?? ''}
        steps={steps}
        schedule={schedule}
        dangers={dangers}
        nameOf={nameOf}
      />
    </StepFrame>
  )
}

// Paste-into-a-ticket version of the plan (MSPs live in PSA tools).
function planMarkdown(
  tenantName: string,
  steps: Step[],
  schedule: Schedule,
  dangers: { title: string; people: { name: string; need: string }[] }[],
  nameOf: (id: string) => string,
): string {
  const lines: string[] = [C.markdown.title(tenantName), '', C.markdown.range(absoluteDate(schedule.start), absoluteDate(schedule.targetEnd), schedule.weeks), '']
  if (dangers.length > 0) {
    lines.push(C.markdown.dangers)
    for (const d of dangers) {
      lines.push(`- **${d.title}**`)
      for (const p of d.people) lines.push(`  - ${p.name} — ${p.need}`)
    }
    lines.push('')
  }
  const byId = new Map(steps.map((s) => [s.id, s]))
  for (const w of schedule.waves) {
    const inPhase = w.stepIds.map((id) => byId.get(id)).filter((s): s is Step => s !== undefined)
    if (inPhase.length === 0) continue
    const title = w.wave === 0 ? C.day0 : C.wave(w.wave, PHASE_NAME[w.phase] ?? '')
    lines.push(`## ${title} (${w.days === 0 ? absoluteDate(w.start) : dateRange(w.start, w.end)})`)
    for (const s of inPhase) {
      lines.push(`- [${s.status === 'done' ? 'x' : ' '}] **${s.title}** (${STEP_KIND_LABEL[s.kind]}) — ${s.impact}`)
      if (s.highCare.userIds.length > 0) lines.push(`  - ${C.markdown.care(s.highCare.userIds.map(nameOf).join(', '))}`)
      if (s.status === 'blocked') lines.push(`  - ${C.markdown.blocked(s.unblockNotes.join('; '))}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

function StepCard({
  step,
  stepById,
  nameOf,
  copied,
  onCopy,
  skipDraft,
  setSkipDraft,
  onSkipped,
}: {
  step: Step
  stepById: Map<string, Step>
  nameOf: (id: string) => string
  copied: string | null
  onCopy: (id: string, text: string) => Promise<void>
  skipDraft: { id: string; reason: string } | null
  setSkipDraft: (d: { id: string; reason: string } | null) => void
  onSkipped: () => void
}) {
  const [tab, setTab] = useState<'json' | 'portal' | 'ps'>('portal')
  return (
    <ExpandCard
      className={`step-card ${step.safeToday ? 'lane-safe' : ''}`}
      id={`step-${step.id}`}
      summary={
        <>
          <Chip status={STATUS_CHIP[step.status]} title={STEP_STATUS[step.status].text}>
            {STEP_STATUS_LABEL[step.status]}
          </Chip>{' '}
          <Chip status="neutral" title={STEP_KIND[step.kind].text}>
            {STEP_KIND_LABEL[step.kind]}
          </Chip>{' '}
          {step.safeToday && (
            <Chip status="done" title={CHIP.safeToday.text}>
              {C.safeChip}
            </Chip>
          )}{' '}
          {step.title}
          <div className="sub">{step.impact}</div>
        </>
      }
    >
      <h4>{C.why}</h4>
      <p>
        {step.why}
        {step.whyAttribution && (
          <span className="reason">
            {' '}
            {C.authorIntent}{' '}
            <a href={step.whyAttribution.url} target="_blank" rel="noreferrer">
              {step.whyAttribution.author}
            </a>
          </span>
        )}
      </p>
      {step.learn && (
        <p className="reason">
          <a href={step.learn.url} target="_blank" rel="noreferrer">
            {C.learn}
          </a>{' '}
          {step.learn.tldr}
          {step.learn.cis.map((c) => (
            <Chip key={c} status="neutral" title={CHIP.cis.text}>
              {C.cis(c)}
            </Chip>
          ))}
        </p>
      )}

      {step.status === 'blocked' && (step.blockers.length > 0 || step.unblockNotes.length > 0) && (
        <Callout kind="warning" title={C.blockedBy}>
          <ul className="sections">
            {step.blockers.map((b, i) => (
              <li key={i}>
                {b.kind === 'step' && <a href={`#step-${b.stepId}`}>{stepById.get(b.stepId)?.title ?? b.stepId}</a>}
                {b.kind === 'setup' && <a href={`#/mapping`}>{C.setupQuestionLink(b.questionNumber)}</a>}
                {(b.kind === 'step' || b.kind === 'setup') && ' — '}
                {b.label}
              </li>
            ))}
            {step.blockers.length === 0 && step.unblockNotes.map((n, i) => <li key={`n${i}`}>{n}</li>)}
          </ul>
        </Callout>
      )}

      {step.highCare.userIds.length > 0 && (
        <div className={`card ${step.highCare.ready ? '' : 'danger-high'}`}>
          <h4>{C.careTitle(step.highCare.userIds.map(nameOf).join(', '))}</h4>
          <ul className="sections">
            {step.highCare.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
            {step.highCare.ready && <li>{CHIP.care.text}</li>}
          </ul>
        </div>
      )}

      {step.includesOperator && (
        <Callout kind={step.operatorSafe ? 'success' : 'danger'}>
          {C.operatorBefore} <strong>{C.operatorAccount}</strong>. {step.operatorSafe ? C.operatorSafe : C.operatorUnsafe}
        </Callout>
      )}

      {step.population.total > 0 && (
        <>
          <h4>{C.whoItTouches}</h4>
          <p className="reason">{affectedLine(step.population.total, step.population.active, step.population.admins, step.population.guests)}</p>
        </>
      )}

      {step.readiness.lines.length > 0 && (
        <>
          <h4>{C.readiness}</h4>
          <ul className="sections">
            {step.readiness.lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </>
      )}

      {step.evidence.lines.length > 0 && (
        <>
          <h4>{C.last30}</h4>
          <ul className="sections">
            {step.evidence.lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
            {step.evidence.affectedUserIds.length > 0 && <li>{C.affected(step.evidence.affectedUserIds.map(nameOf).join(', '))}</li>}
          </ul>
        </>
      )}

      <h4>{C.whatToDo}</h4>
      <ul className="sections">
        {step.action.summary.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      {step.action.json && (
        <div>
          <p className="row no-print">
            <FilterChip selected={tab === 'portal'} onToggle={() => setTab('portal')}>
              {C.portalSteps}
            </FilterChip>
            <FilterChip selected={tab === 'json'} onToggle={() => setTab('json')}>
              {C.json}
            </FilterChip>
            <FilterChip selected={tab === 'ps'} onToggle={() => setTab('ps')}>
              {C.powershell}
            </FilterChip>
            <Button size="sm" icon="download" onClick={() => downloadFile(`${step.id}.json`, step.action.json!, 'application/json')}>
              {C.downloadJson}
            </Button>
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
          <h4>{C.tellPeople}</h4>
          <pre className="code-block" style={{ whiteSpace: 'pre-wrap' }}>
            {step.comms}
          </pre>
          <p className="no-print">
            <Button size="sm" icon="copy" onClick={() => void onCopy(step.id, step.comms!)}>
              {copied === step.id ? C.copied : C.copyAnnouncement}
            </Button>
          </p>
        </>
      )}

      <h4>{C.doneWhen}</h4>
      <ul className="sections">
        {step.exitCriteria.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>

      <h4>{C.ifWrong}</h4>
      <p className="reason">{step.rollback}</p>

      {step.history.length > 0 && (
        <>
          <h4>{C.history}</h4>
          <ul className="sections">
            {step.history.map((h, i) => (
              <li key={i}>
                <span title={absolute(h.at)}>{relative(h.at)}</span>: {STEP_STATUS_LABEL[h.from]} → {STEP_STATUS_LABEL[h.to]}
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
                placeholder={C.skipPlaceholder}
                value={skipDraft.reason}
                onChange={(e) => setSkipDraft({ id: step.id, reason: e.currentTarget.value })}
              />{' '}
              <Button
                size="sm"
                onClick={() => {
                  const r = skipStep(step, skipDraft.reason)
                  if (r.ok) {
                    setSkipDraft(null)
                    onSkipped()
                  } else window.alert?.(r.error)
                }}
              >
                {C.confirmSkip}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="quiet" onClick={() => setSkipDraft({ id: step.id, reason: '' })}>
              {C.skip}
            </Button>
          )}
        </p>
      )}
    </ExpandCard>
  )
}
