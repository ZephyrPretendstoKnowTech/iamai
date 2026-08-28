// Roadmap: an actual plan (2026-08-27 redesign): dated phases, danger areas
// with named people, a safe-today lane, and steps with per-tenant impact.
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { annotateStateReasons } from '../../roadmap/stateReason.ts'
import { buildPlanFile, makeCheckpoint, parsePlanFile } from '../../roadmap/plan.ts'
import type { Checkpoint } from '../../roadmap/plan.ts'
import type { Step, StepStatus } from '../../roadmap/types.ts'
import { saveDevResults } from '../../graph/spikes/spike1.ts'
import baselineIndex from '../../../baselines/jhope188-conditionalaccesspolicies.index.json' with { type: 'json' }
import { ROADMAP as C } from '../../copy/pages.ts'
import { CHIP, STEP_KIND, STEP_STATUS, TILE } from '../../copy/definitions.ts'
import { overrunList, roadmapOverview, scheduleOverrun, scheduleRationale } from '../../copy/statements.ts'
import { NAMING, OPERATOR, PHASE_NAME, STEP_KIND_LABEL, STEP_STATUS_LABEL, affectedLine } from '../../copy/steps.ts'
import { NO_ANNOUNCEMENT } from '../../copy/announcements.ts'
import { planSummary } from '../../roadmap/summary.ts'
import { BANDS } from '../../roadmap/constants.ts'
import type { SizeBand } from '../../roadmap/constants.ts'
import type { Schedule } from '../../roadmap/schedule.ts'
import { PrintPlan } from './PrintPlan.tsx'
import { absolute, absoluteDate, dateRange, downloadFile, relative, when, whenAt } from '../format.ts'
import { ScanAge, StepFrame, stepHref, useHashStepId } from '../shell/AppShell.tsx'
import { Button, Callout, Card, Chip, ExpandCard, FilterChip, InfoTip, LinkButton, ScoreBadges, StatTile, Stats, Tabs } from '../components/index.ts'
import type { ChipStatus } from '../components/index.ts'
import { SCORE } from '../../copy/definitions.ts'
import { FINDINGS } from '../../copy/pages.ts'
import { compareScores } from '../../scoring/priority.ts'
import type { ScoreSort } from '../../scoring/priority.ts'
import type { BaselineResult } from './BaselinePage.tsx'

type SavedSteps = Record<string, { status: StepStatus; history: Step['history']; skipReason: string | null }>
type PlanStore = { planId: string; steps: SavedSteps; checkpoints: Checkpoint[]; startDate?: string; band?: SizeBand | null; owner?: string }

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
  const [stepSort, setStepSort] = useState<'schedule' | ScoreSort>('schedule')
  // Hide completed defaults on once more than a third of the steps are done (ux-review-04 §5).
  const [showCompletedChoice, setShowCompletedChoice] = useState<boolean | null>(null)
  const [skipDraft, setSkipDraft] = useState<{ id: string; reason: string } | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  // The step opened in place on the Steps tab (prompt 26 §15).
  const [openStepId, setOpenStepId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [copied, setCopied] = useState<string | null>(null)
  // Deep link #/roadmap/step/<id>: open the Steps tab with that step expanded.
  const linkedStepId = useHashStepId()
  const [activeTab, setActiveTab] = useState<string>(linkedStepId ? 'steps' : 'overview')
  useEffect(() => {
    if (!linkedStepId) return
    setActiveTab('steps')
    const el = document.getElementById(`step-${linkedStepId}`)
    if (el) {
      el.setAttribute('open', '')
      el.scrollIntoView({ block: 'start' })
    }
  }, [linkedStepId])
  const fileInput = useRef<HTMLInputElement>(null)

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
  const band: SizeBand | null = saved?.band && BANDS[saved.band] ? saved.band : null

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
      band,
      operatorUserId: operator?.userId ?? null,
      names,
      groupMembers: groups,
    })
    mergePersisted(steps, saved?.steps ?? null)
    annotateStateReasons(steps)
    applyProgress(steps, snapshot, coverage, planId)
    const dangers = findDangerAreas({
      snapshot,
      viability,
      highCareUserIds: mapping.highCareUserIds,
      operatorUserId: operator?.userId ?? null,
      breakGlassUserIds: mapping.breakGlassUserIds,
    })
    return { steps, schedule, coverage, viability, names, dangers }
  }, [snapshot, baseline, mapping, groupsLoaded, loadedStores, groups, saved, planId, version, startDate, band, operator, extraNames])

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
      band,
    })
  }, [computed, snapshot, planId, saved, startDate, band])

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
  // One derived summary feeds every tab (prompt 13 §11).
  const summary = planSummary(steps)
  const showCompleted = showCompletedChoice ?? !(summary.done * 3 > summary.total)
  const setShowCompleted = (next: boolean | ((v: boolean) => boolean)) => setShowCompletedChoice(typeof next === 'function' ? next(showCompleted) : next)
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
      // clipboard unavailable: the text is visible on screen anyway
    }
  }

  const setStart = (iso: string): void => {
    setSaved((p) => (p ? { ...p, startDate: iso } : p))
    setVersion((v) => v + 1)
  }
  const setBand = (next: SizeBand | null): void => {
    setSaved((p) => (p ? { ...p, band: next } : p))
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
      schedule: startDate ? { startDate, band: band ?? undefined, owner: owner || undefined } : { startDate: schedule.start, band: band ?? undefined, owner: owner || undefined },
    })
    downloadFile(`iamai-plan-${snapshot.tenantId.slice(0, 8)}.json`, JSON.stringify(plan, null, 2), 'application/json')
  }

  const loadPlan = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return
    setPlanLoading(true)
    try {
      await loadPlanInner(files)
    } finally {
      setPlanLoading(false)
    }
  }
  const loadPlanInner = async (files: FileList): Promise<void> => {
    const { plan, error } = parsePlanFile(await files[0].text())
    if (!plan) {
      window.alert?.(error ?? C.couldNotRead)
      return
    }
    const stepsRecord: SavedSteps = Object.fromEntries(
      plan.steps.map((s) => [s.id, { status: s.status, history: s.history, skipReason: s.skipReason }]),
    )
    const start = plan.schedule?.startDate ?? startDate ?? undefined
    const loadedBand = plan.schedule?.band && BANDS[plan.schedule.band as SizeBand] ? (plan.schedule.band as SizeBand) : band
    const record: PlanStore = { planId: plan.planId, steps: stepsRecord, checkpoints: plan.checkpoints, startDate: start, band: loadedBand }
    await savePlanRecord(snapshot.tenantId, record)
    // Setup answers travel with the plan file (provenance intact); re-opening Setup shows them.
    if (plan.mappings && plan.mappings.tenantId === snapshot.tenantId) {
      await saveMappingState(plan.mappings)
      setMapping(plan.mappings)
    }
    setSaved(record)
    setVersion((v) => v + 1)
  }

  const rollout = summarizeTenant(computed.viability).rollout
  const overviewText = roadmapOverview({
    tenant: tenantName,
    done: summary.done,
    total: summary.total,
    skipped: summary.byStatus.skipped,
    pace: C.bandWord[schedule.band] ?? schedule.band,
    finishes: when(schedule.targetEnd),
    weeks: schedule.weeks,
  })
  const rationale = scheduleRationale({
    weeks: schedule.weeks,
    campaigns: schedule.verification.days > 0 ? 1 : 0,
    verificationDays: schedule.verification.days,
    observationDays: schedule.observation.days,
    waves: schedule.waves.filter((w) => w.wave > 0).length,
    waitingOnSetup: schedule.waitingOnSetup,
    setupQuestions: schedule.waitingOnSetupQuestions,
  })
  const overrunSteps = overrunList(schedule.extendedBy.filter((id) => id !== 's-verify-mfa').map((id) => stepById.get(id)?.title ?? id))
  const overrun =
    !schedule.withinBand && work.length > 0
      ? scheduleOverrun(
          C.bands[schedule.band].label.toLowerCase(),
          BANDS[schedule.band].weeks,
          schedule.weeks,
          schedule.extendedBy.filter((id) => id !== 's-verify-mfa').map((id) => stepById.get(id)?.title ?? id),
          schedule.verification.days > 0 ? Math.round(schedule.verification.days / 7) : null,
        )
      : null

  const owner = saved?.owner ?? ''
  const setOwner = (value: string): void => {
    setSaved((p) => (p ? { ...p, owner: value } : p))
    void savePlanRecord(snapshot.tenantId, { ...(saved ?? { planId, steps: {}, checkpoints: [] }), owner: value })
  }
  const openSteps = (status: StepStatus | null): void => {
    setStatusFilter(status ? new Set([status]) : new Set())
    setActiveTab('steps')
  }
  const campaignWeeks = schedule.verification.days > 0 ? Math.round(schedule.verification.days / 7) : 0
  const constraint =
    work.length === 0
      ? null
      : campaignWeeks > 0
        ? C.constraintCampaign(schedule.weeks, rollout.toSetUp, campaignWeeks)
        : C.constraintWaves(schedule.weeks, schedule.waves.filter((w) => w.wave > 0).length, schedule.observation.days)
  const readyToday = steps.filter((s) => s.status === 'ready')
  const highDangers = dangers.filter((d) => d.severity === 'high').length

  const overview = () => (
    <div className="overview">
      {/* Band 1: the headline and the one constraint that sets the length (prompt 26 §6). */}
      <div className="overview-band">
        <h3 className="overview-headline">{work.length === 0 ? C.headlineDone(steps.length) : C.headline(done.length, steps.length, absoluteDate(schedule.targetEnd))}</h3>
        {constraint && <p className="overview-constraint">{constraint}</p>}
      </div>

      {/* Band 2: four tiles, each opening the Steps tab pre-filtered (§7). */}
      <div className="overview-band">
        <Stats>
          <StatTile value={`${done.length}/${steps.length}`} label={TILE.stepsDone.title} tone="success" tip={TILE.stepsDone} onClick={() => openSteps('done')} />
          <StatTile value={schedule.weeks} label={TILE.weeks.title} tip={TILE.weeks} onClick={() => setActiveTab('timeline')} />
          <StatTile value={readyToday.length} label={C.readyToday} tone={readyToday.length > 0 ? 'info' : 'neutral'} tip={TILE.readyToday} onClick={() => openSteps('ready')} />
          <StatTile value={blocked.length} label={STEP_STATUS.blocked.title} tone={blocked.length > 0 ? 'warning' : 'neutral'} tip={STEP_STATUS.blocked} onClick={() => openSteps('blocked')} />
        </Stats>
      </div>

      {/* Band 3: what needs attention, and the plan settings (§8). */}
      <div className="overview-band overview-grid">
        <div>
          <h4>{C.attentionTitle}</h4>
          <Callout kind={highDangers > 0 ? 'danger' : dangers.length > 0 ? 'warning' : 'success'}>
            {C.attentionDangers(dangers.length)}{' '}
            {dangers.length > 0 && (
              <a href="#/roadmap" onClick={(e) => { e.preventDefault(); setActiveTab('danger') }}>
                {C.openDangers}
              </a>
            )}
          </Callout>
          <Callout kind={blocked.length > 0 ? 'warning' : 'success'}>
            {C.attentionBlocked(blocked.length)}{' '}
            {blocked.length > 0 && (
              <a href="#/roadmap" onClick={(e) => { e.preventDefault(); openSteps('blocked') }}>
                {C.openBlocked}
              </a>
            )}
          </Callout>
          {overrun && overrunSteps.length > 0 && (
            <details className="card">
              <summary>{C.overrunShow(schedule.extendedBy.filter((id) => id !== 's-verify-mfa').length)}</summary>
              <p className="reason">{overrun}</p>
              <ul className="sections">
                {overrunSteps.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <Card title={C.settingsTitle} className="settings-card no-print">
          <p>
            <label>
              {C.startDate}{' '}
              <input type="date" value={schedule.start.slice(0, 10)} onChange={(e) => e.currentTarget.value && setStart(`${e.currentTarget.value}T12:00:00.000Z`)} />{' '}
              <span className="muted">{when(schedule.start)}</span>
            </label>
          </p>
          <div className="row">
            <span className="muted">{C.paceLabel}</span>
            {(Object.keys(BANDS) as SizeBand[]).map((b) => (
              <FilterChip key={b} selected={schedule.band === b} title={C.bands[b].text} onToggle={() => setBand(b === schedule.band && band !== null ? null : b)}>
                {C.bands[b].label}
              </FilterChip>
            ))}
            {schedule.bandSource === 'override' && (
              <Button size="sm" variant="quiet" onClick={() => setBand(null)}>
                {C.bandReset}
              </Button>
            )}
          </div>
          <p className="reason">
            {schedule.bandSource === 'auto' ? C.bandAuto(schedule.activeUsers, C.bands[schedule.band].label) : C.bandOverride(schedule.activeUsers, C.bands[schedule.band].label)} ·{' '}
            {C.expected(BANDS[schedule.band].weeks)}
          </p>
          <p>
            <label>
              {C.owner}{' '}
              <input type="text" value={owner} placeholder={C.ownerPlaceholder} aria-label={C.owner} onChange={(e) => setOwner(e.currentTarget.value)} style={{ minWidth: '16rem' }} />
            </label>
          </p>
        </Card>
      </div>

      {/* One row of actions, right-aligned (§9). */}
      <p className="row actions-row no-print">
        <Button variant="primary" icon="download" onClick={savePlan}>
          {C.save}
        </Button>
        <Button icon="refresh" loading={planLoading} onClick={() => fileInput.current?.click()}>
          {C.load}
        </Button>
        <input ref={fileInput} type="file" accept=".json" style={{ display: 'none' }} aria-hidden onChange={(e) => void loadPlan(e.currentTarget.files)} />
        <Button icon="copy" onClick={() => void copy('plan-md', planMarkdown(tenantName, steps, schedule, dangers, nameOf))}>
          {copied === 'plan-md' ? C.copied : C.copyMarkdown}
        </Button>
        <Button icon="print" onClick={() => window.print()}>
          {C.print}
        </Button>
      </p>
    </div>
  )

  /** A compact tile for a step inside a phase card; the whole tile is the link (prompt 26 §12). */
  const stepTile = (st: Step, onOpen?: () => void) => (
    <a
      key={st.id}
      className={`step-tile ${st.safeToday ? 'lane-safe' : ''}`}
      href={stepHref(st.id)}
      onClick={onOpen ? (e) => { e.preventDefault(); onOpen() } : undefined}
    >
      <div className="row">
        <Chip status={STATUS_CHIP[st.status]} title={STEP_STATUS[st.status].text}>
          {STEP_STATUS_LABEL[st.status]}
        </Chip>
        <Chip status="neutral" title={STEP_KIND[st.kind].text}>
          {STEP_KIND_LABEL[st.kind]}
        </Chip>
      </div>
      <strong className="step-tile-title">{st.title}</strong>
      <div className="sub state-reason">{st.stateReason}</div>
    </a>
  )
  const dates = (start: string, end: string, days: number) => (days === 0 ? absoluteDate(start) : dateRange(start, end))
  const phaseSteps = (w: Schedule['waves'][number]) => w.stepIds.map((id) => stepById.get(id)).filter((x): x is Step => x !== undefined)

  const timeline = () => {
    const created = steps.filter((st) => st.kind === 'create' && st.status !== 'done' && st.status !== 'skipped').length
    const completedCount = steps.filter((st) => st.status === 'done').length
    const waves = schedule.waves.filter((w) => phaseSteps(w).length > 0)
    const totalDays = Math.max(1, Math.round((Date.parse(schedule.targetEnd) - Date.parse(schedule.start)) / 86_400_000))
    const todayPct = Math.min(100, Math.max(0, ((Date.now() - Date.parse(schedule.start)) / 86_400_000 / totalDays) * 100))
    const windowCard = (id: string, title: string, text: string, w: { start: string; end: string; days: number }) => (
      <div key={id} className="card window-card" id={id}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span>
            <Chip status="neutral">{C.windowChip}</Chip> <strong>{title}</strong>
          </span>
          <span className="reason">{dates(w.start, w.end, w.days)}</span>
        </div>
        <p className="reason">{text}</p>
      </div>
    )
    return (
      <div>
        {/* Mini-map: the whole plan in one bar, segmented by phase, today marked (§10). */}
        <div className="minimap no-print" aria-label={C.tabs.timeline}>
          {waves.map((w) => {
            const all = phaseSteps(w)
            const doneN = all.filter((st) => st.status === 'done').length
            const days = Math.max(1, w.days)
            return (
              <a
                key={w.wave}
                href={`#phase-${w.wave}`}
                className={`minimap-seg ${doneN === all.length ? 'is-done' : doneN > 0 ? 'is-partial' : ''}`}
                style={{ flexGrow: days }}
                title={`${waveTitle(w)} · ${C.phaseProgress(doneN, all.length)}`}
                onClick={(e) => { e.preventDefault(); document.getElementById(`phase-${w.wave}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }}
              >
                <span className="minimap-label">{waveTitle(w)}</span>
              </a>
            )
          })}
          <span className="minimap-today" style={{ left: `${todayPct}%` }} title={C.minimapToday} />
        </div>
        <p className="reason">
          {rationale}
          {completedCount > 0 && (
            <>
              {' '}
              {!showCompleted && C.completedHidden(completedCount)}{' '}
              <Button size="sm" variant="quiet" onClick={() => setShowCompleted((v) => !v)}>
                {showCompleted ? C.hideCompleted : C.showCompleted}
              </Button>
            </>
          )}
        </p>
        {schedule.waves.map((w) => {
          const all = phaseSteps(w)
          const inWave = showCompleted ? all : all.filter((st) => st.status !== 'done')
          const waveDone = all.filter((st) => st.status === 'done').length
          const allDone = all.length > 0 && waveDone === all.length
          return (
            <div key={w.wave}>
              {all.length > 0 && (
                <details className="card phase-card" id={`phase-${w.wave}`} open={!allDone}>
                  <summary>
                    <span className="row" style={{ justifyContent: 'space-between' }}>
                      <span>
                        <strong>{waveTitle(w)}</strong> <span className="reason">{dates(w.start, w.end, w.days)}</span>
                        {w.note ? <span className="reason"> · {w.note}</span> : null}
                      </span>
                      <span className="reason">
                        {allDone ? C.phaseAllDone(waveDone) : C.phaseProgress(waveDone, all.length)}
                        <InfoTip title={TILE.phaseProgress.title} text={TILE.phaseProgress.text} />
                      </span>
                    </span>
                  </summary>
                  {w.wave === 0 && created > 0 && <p className="reason">{C.day0Text(created)}</p>}
                  <div className="step-grid">{inWave.map((st) => stepTile(st, () => { setActiveTab('steps'); setOpenStepId(st.id) }))}</div>
                </details>
              )}
              {w.wave === 0 && schedule.verification.days > 0 && windowCard('window-verification', C.verificationWindow(schedule.verification.days), C.verificationText(rollout.toSetUp, rollout.enabled), schedule.verification)}
              {w.wave === 0 && schedule.verification.days === 0 && steps.some((st) => st.kind === 'verify') && work.length > 0 && (
                <p className="reason">{C.verificationDone}</p>
              )}
              {w.wave === 0 && schedule.observation.days > 0 && windowCard('window-observation', C.observation(schedule.observation.days), C.observationText, schedule.observation)}
            </div>
          )
        })}
      </div>
    )
  }

  const dangerAreas = () => (
    <div>
      {dangers.length === 0 && <p className="advisor">{C.noDangers}</p>}
      {dangers.length > 0 && <p className="advisor">{C.dangerLead(dangers.map((d) => d.title))}</p>}
      {dangers.map((d, i) => (
        <div key={i} className={`card danger-${d.severity}`}>
          <h4>{d.title}</h4>
          <p>{d.detail}</p>
          <ul className="sections">
            {d.people.map((p, j) => (
              <li key={j}>
                <strong>{p.name}</strong>: {p.need}
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
    const completedCount = steps.filter((s) => s.status === 'done').length
    const visible = steps.filter((s) => (statusFilter.size === 0 ? showCompleted || s.status !== 'done' : statusFilter.has(s.status)))
    return (
      <div>
        <p className="reason">
          {!showCompleted && statusFilter.size === 0 && C.completedHidden(completedCount)}{' '}
          {completedCount > 0 && (
            <Button size="sm" variant="quiet" onClick={() => setShowCompleted((v) => !v)}>
              {showCompleted ? C.hideCompleted : C.showCompleted}
            </Button>
          )}
        </p>
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
              {C.filterCount(STEP_STATUS_LABEL[s], summary.byStatus[s])}
            </FilterChip>
          ))}
        </div>
        <div className="control-bar no-print">
          <label>
            {C.sortBy}
            <select value={stepSort} onChange={(e) => setStepSort(e.currentTarget.value as 'schedule' | ScoreSort)}>
              <option value="schedule">{C.sortSchedule}</option>
              {(['priority', 'value', 'effort', 'disruption'] as ScoreSort[]).map((k) => (
                <option key={k} value={k}>
                  {FINDINGS.sort[k]}
                </option>
              ))}
            </select>
            {stepSort !== 'schedule' && <InfoTip title={SCORE[stepSort].title} text={SCORE[stepSort].text} />}
          </label>
        </div>
        {schedule.waves.map((w) => {
          const inWave = phaseSteps(w)
            .filter((st) => visible.includes(st))
            .sort((a, b) => (stepSort === 'schedule' ? 0 : compareScores(a.score ?? null, b.score ?? null, stepSort)))
          if (inWave.length === 0) return null
          return (
            <div key={w.wave} className="card phase-card" id={`steps-phase-${w.wave}`}>
              <h3 className="phase-title">
                {waveTitle(w)} <span className="reason">{dates(w.start, w.end, w.days)}</span>
              </h3>
              <div className="step-grid">
                {inWave.map((step) =>
                  openStepId === step.id || step.id === linkedStepId ? (
                    <div key={step.id} className="grid-span">
                      <StepCard
                        step={step}
                        linked
                        stepById={stepById}
                        nameOf={nameOf}
                        copied={copied}
                        onCopy={copy}
                        skipDraft={skipDraft}
                        setSkipDraft={setSkipDraft}
                        onSkipped={(st) => {
                          // Persist the skip before regenerating, or mergePersisted forgets it.
                          setSaved((p) =>
                            p ? { ...p, steps: { ...p.steps, [st.id]: { status: st.status, history: st.history, skipReason: st.skipReason } } } : p,
                          )
                          setVersion((v) => v + 1)
                        }}
                      />
                      <p className="no-print">
                        <Button size="sm" variant="quiet" onClick={() => setOpenStepId(null)}>
                          {C.collapseStep}
                        </Button>
                      </p>
                    </div>
                  ) : (
                    stepTile(step, () => setOpenStepId(step.id))
                  ),
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <StepFrame title={C.title} does={C.does} needs={needs}>
      {scan && <ScanAge at={scan.at} baseline={baseline?.source ?? null} />}
      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'overview', label: C.tabs.overview, render: overview },
          { id: 'timeline', label: C.tabs.timeline, badge: C.weeksBadge(schedule.weeks), render: timeline },
          { id: 'danger', label: C.tabs.danger, badge: dangers.length || '', render: dangerAreas },
          { id: 'steps', label: C.tabs.steps, badge: C.stepsBadge(summary.done, summary.total), render: stepsView },
        ]}
      />
      <PrintPlan
        tenantName={tenantName}
        baselineLabel={baseline?.source ?? ''}
        operator={operator?.userPrincipalName ?? ''}
        steps={steps}
        schedule={schedule}
        verificationNote={C.verificationText(rollout.toSetUp, rollout.enabled)}
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
      for (const p of d.people) lines.push(`  - ${p.name}. ${p.need}`)
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
      lines.push(`- [${s.status === 'done' ? 'x' : ' '}] **${s.title}** (${STEP_KIND_LABEL[s.kind]}). ${s.impact}`)
      if (s.highCare.userIds.length > 0) lines.push(`  - ${C.markdown.care(s.highCare.userIds.map(nameOf).join(', '))}`)
      if (s.status === 'blocked') lines.push(`  - ${C.markdown.blocked(s.unblockNotes.join('; '))}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

function StepCard({
  step,
  linked,
  stepById,
  nameOf,
  copied,
  onCopy,
  skipDraft,
  setSkipDraft,
  onSkipped,
}: {
  step: Step
  linked: boolean
  stepById: Map<string, Step>
  nameOf: (id: string) => string
  copied: string | null
  onCopy: (id: string, text: string) => Promise<void>
  skipDraft: { id: string; reason: string } | null
  setSkipDraft: (d: { id: string; reason: string } | null) => void
  onSkipped: (step: Step) => void
}) {
  const [tab, setTab] = useState<'json' | 'portal' | 'ps'>('portal')
  return (
    <ExpandCard
      className={`step-card ${step.safeToday ? 'lane-safe' : ''}`}
      id={`step-${step.id}`}
      open={linked || undefined}
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
          <ScoreBadges score={step.score ?? null} />
          <div className="sub">{step.impact}</div>
          <div className="sub state-reason">{step.stateReason}</div>
        </>
      }
    >
      <h4>{C.why}</h4>
      {step.whyLink && (
        <p className="reason">
          <a href={step.whyLink} target="_blank" rel="noreferrer">
            {C.whyLink}
          </a>
        </p>
      )}
      <p>
        {step.why}
        {step.whyAttribution && (
          <span className="reason">
            {' '}
            {C.authorIntent}{' '}
            <a href={step.whyAttribution.url} target="_blank" rel="noreferrer">
              {step.whyAttribution.author}
            </a>
            {C.authorIntentEnd}
          </span>
        )}
      </p>
      {step.learn && (
        <p className="reason">
          <a href={step.learn.url} target="_blank" rel="noreferrer">
            {C.learn}
          </a>{' '}
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
                {b.kind === 'step' && <a href={stepHref(b.stepId)}>{stepById.get(b.stepId)?.title ?? b.stepId}</a>}
                {b.kind === 'setup' && <a href={`#/mapping`}>{C.setupQuestionLink(b.questionNumber)}</a>}
                {b.kind !== 'step' && b.kind !== 'setup' && b.label}
              </li>
            ))}
            {step.blockers.length === 0 && step.unblockNotes.map((n, i) => <li key={`n${i}`}>{n}</li>)}
            {step.blockers.length > 0 && step.blockedBy.length > 0 && step.blockedBy.filter((id) => !step.blockers.some((b) => b.kind === 'step' && b.stepId === id)).map((id) => (
              <li key={id}>
                <a href={stepHref(id)}>{stepById.get(id)?.title ?? id}</a>
              </li>
            ))}
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
        <Callout kind={step.operatorSafe ? 'info' : 'warning'}>
          {step.operatorNote}
          {!step.operatorSafe && ` ${C.operatorUnsafe}`}
          {step.operatorWhatIf && <div>{OPERATOR.whatIf(step.operatorWhatIf)}</div>}
        </Callout>
      )}

      {step.naming && (
        <p>
          <strong>{C.proposedName}</strong> {step.naming.proposed}
          {step.naming.fromBaseline && <div className="sub">{NAMING.fromBaseline(step.naming.fromBaseline)}</div>}
        </p>
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
              {step.action.roleList && (
                <li>
                  <details>
                    <summary>{C.showRoles(step.action.roleList.names.length)}</summary>
                    <p className="reason">{step.action.roleList.names.join(', ')}</p>
                  </details>
                </li>
              )}
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
          {step.comms === NO_ANNOUNCEMENT ? (
            <p className="reason">{step.comms}</p>
          ) : (
            <>
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
                {h.note && `. ${h.note}`}
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
                    onSkipped(step)
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
