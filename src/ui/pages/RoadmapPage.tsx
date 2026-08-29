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
import { CALENDAR } from '../../copy/schedule.ts'
import { POPULATION } from '../../copy/population.ts'
import { ROLLBACK_V2, SECTION } from '../../copy/stepContent.ts'
import { RINGS } from '../../copy/rings.ts'
import { RingProgress } from '../components/Ring.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { Term } from '../components/Term.tsx'
import { EVENT as EVENT_LABEL, LICENCE_HEADER, TERM_WORDS, MANAGER as MANAGER_UI, NOTICE, RHYTHM, SAFE, THIS_WEEK, WEEK_VIEW } from '../../copy/timing.ts'
import { NOTICE_DEFAULTS } from '../../roadmap/timing.ts'
import { PLAIN_TITLES } from '../../copy/plain.ts'
import type { NoticeSettings } from '../../roadmap/timing.ts'
import type { StepEvent } from '../../roadmap/types.ts'
import { EXPORT_TAB, PROGRESS, SCHEDULE_TAB, TRACK } from '../../copy/progress.ts'
import { changesSince, groupGrowth, progressHeadline, stepProgress, trackable } from '../../roadmap/tracking.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { savedStepOf } from '../../roadmap/progress.ts'
import type { Dependency } from '../../roadmap/schedule.ts'
import { POPULATION_CSV_HEADER, cohortsFor, populationContext, populationRows } from '../../roadmap/population.ts'
import { ringContextIndexes } from '../../roadmap/rings.ts'
import { adminUserIds } from '../../roles.ts'
import { NAMING, OPERATOR, PHASE_NAME, STEP_KIND_LABEL, STEP_STATUS_LABEL, affectedLine } from '../../copy/steps.ts'
import { NO_ANNOUNCEMENT } from '../../copy/announcements.ts'
import { planSummary } from '../../roadmap/summary.ts'
import { BANDS } from '../../roadmap/constants.ts'
import type { SizeBand } from '../../roadmap/constants.ts'
import type { ChangeFreeze, Schedule } from '../../roadmap/schedule.ts'
import { PrintPlan } from './PrintPlan.tsx'
import { absolute, absoluteDate, dateRange, downloadFile, relative, toCsv, when, whenAt } from '../format.ts'
import { ScanAge, StepFrame, stepHref, useHashStepId } from '../shell/AppShell.tsx'
import { Button, Callout, Card, Chip, ExpandCard, FilterChip, InfoTip, LinkButton, ScoreBadges, StatTile, Stats, Tabs } from '../components/index.ts'
import type { ChipStatus } from '../components/index.ts'
import { SCORE } from '../../copy/definitions.ts'
import { FINDINGS } from '../../copy/pages.ts'
import { compareScores } from '../../scoring/priority.ts'
import type { ScoreSort } from '../../scoring/priority.ts'
import type { BaselineResult } from './BaselinePage.tsx'

type SavedSteps = Record<string, import('../../roadmap/progress.ts').SavedStep>
type PlanStore = {
  planId: string
  steps: SavedSteps
  checkpoints: Checkpoint[]
  startDate?: string
  band?: SizeBand | null
  owner?: string
  freeze?: ChangeFreeze | null
  /** Re-plan record (roadmap-v2.md §5): counts up when the step set or the baseline pin changes. */
  revision?: number
  revisions?: { revision: number; at: string; note: string }[]
  stepIds?: string[]
  baselinePin?: string | null
  /** When this plan was first generated: evidence before it is "already in place" (ux-review-07 §1). */
  planCreatedAt?: string
  /** Suggested notice periods by disruption, in working days (scheduling-and-onboarding.md §2.3). */
  notice?: NoticeSettings
  /** YYYY-MM-DD dates nothing is enforced on. */
  holidays?: string[]
}

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
  // The fast path (scheduling-and-onboarding.md §2.5): show only what is safe to enforce today.
  const [safeOnly, setSafeOnly] = useState(false)
  const [stepSort, setStepSort] = useState<'schedule' | ScoreSort>('schedule')
  // Hide completed defaults on once more than a third of the steps are done (ux-review-04 §5).
  const [showCompletedChoice, setShowCompletedChoice] = useState<boolean | null>(null)
  const [skipDraft, setSkipDraft] = useState<{ id: string; reason: string } | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  // The step opened in place on the Steps tab (prompt 26 §15).
  const [openStepId, setOpenStepId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  // Statuses at the previous render: a step that moved gets one flash (ux-review-07 §F3).
  const prevStatusRef = useRef<Record<string, StepStatus>>({})
  const [copied, setCopied] = useState<string | null>(null)
  // Deep link #/roadmap/step/<id>: open the Steps tab with that step expanded.
  const linkedStepId = useHashStepId()
  const [activeTab, setActiveTab] = useState<string>(linkedStepId ? 'plan' : 'progress')
  useEffect(() => {
    if (!linkedStepId) return
    setActiveTab('plan')
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
      changeFreeze: saved?.freeze ?? null,
      notice: saved?.notice ?? NOTICE_DEFAULTS,
      holidays: saved?.holidays ?? [],
      scheduled: Object.fromEntries(Object.entries(saved?.steps ?? {}).flatMap(([id, v]) => (v.scheduledDate ? [[id, v.scheduledDate]] : []))),
    })
    mergePersisted(steps, saved?.steps ?? null)
    applyProgress(steps, snapshot, coverage, planId, undefined, saved?.revisions?.[0]?.at ?? saved?.planCreatedAt ?? null)
    // State reasons read the tracking (the real enforcement date), so they come last.
    annotateStateReasons(steps)
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
    const stepsRecord: SavedSteps = Object.fromEntries(computed.steps.map((s) => [s.id, { ...(saved?.steps[s.id] ?? {}), ...savedStepOf(s) }]))
    // Re-plan in place (roadmap-v2.md §5): the step set or the baseline pin changing is a revision, recorded, never a fresh plan.
    const ids = computed.steps.map((s) => s.id)
    const pin = baselineIndex.commit ?? null
    const prevIds = saved?.stepIds ?? null
    const revisions = [...(saved?.revisions ?? [{ revision: 1, at: new Date().toISOString(), note: PROGRESS.revisionNote.created }])]
    let revision = saved?.revision ?? 1
    const notes: string[] = []
    if (prevIds) {
      const added = ids.filter((id) => !prevIds.includes(id)).length
      const gone = prevIds.filter((id) => !ids.includes(id)).length
      if (added > 0) notes.push(PROGRESS.revisionNote.stepsAdded(added))
      if (gone > 0) notes.push(PROGRESS.revisionNote.stepsGone(gone))
    }
    if (saved?.baselinePin && pin && saved.baselinePin !== pin) notes.push(PROGRESS.revisionNote.baseline(pin.slice(0, 7)))
    if (notes.length > 0) {
      revision += 1
      revisions.push({ revision, at: new Date().toISOString(), note: notes.join('; ') })
    }
    void savePlanRecord(snapshot.tenantId, {
      ...(saved ?? { planId, checkpoints: [] }),
      planId,
      steps: stepsRecord,
      checkpoints: saved?.checkpoints ?? [],
      startDate,
      band,
      revision,
      revisions,
      stepIds: ids,
      baselinePin: pin,
      planCreatedAt: saved?.planCreatedAt ?? revisions[0]?.at ?? new Date().toISOString(),
    })
  }, [computed, snapshot, planId, saved, startDate, band, baselineIndex.commit])

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
            <EmptyState
              scene="noPlan"
              title={C.noPlanTitle}
              text={C.blocked}
              action={
                <>
                  {!scan && <a href="#/scan">{C.runScan}</a>}
                  {!scan && !baseline && ` ${C.and} `}
                  {!baseline && <a href="#/baseline">{C.loadBaseline}</a>}
                </>
              }
            />
          )}
        </Card>
      </StepFrame>
    )
  }

  const { steps, schedule, dangers } = computed
  const changedIds = new Set(steps.filter((s) => prevStatusRef.current[s.id] !== undefined && prevStatusRef.current[s.id] !== s.status).map((s) => s.id))
  prevStatusRef.current = Object.fromEntries(steps.map((s) => [s.id, s.status]))
  const nameOf = (id: string) => computed.names.label(id)
  // One derived summary feeds every tab (prompt 13 §11).
  const summary = planSummary(steps)
  const showCompleted = showCompletedChoice ?? !(summary.done * 3 > summary.total)
  const setShowCompleted = (next: boolean | ((v: boolean) => boolean)) => setShowCompletedChoice(typeof next === 'function' ? next(showCompleted) : next)
  const work = steps.filter((s) => s.status !== 'done' && s.status !== 'skipped')
  // The one denominator (ux-review-07 §2): every step that is not skipped, used by the badge, the headline and the journey.
  const tracked = trackable(steps)
  const trackedDone = tracked.filter((s) => s.status === 'done').length
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
  // Notice periods and holidays travel with the plan (scheduling-and-onboarding.md §2.2, §2.3).
  const setNotice = (next: NoticeSettings): void => {
    setSaved((p) => (p ? { ...p, notice: next } : p))
    void savePlanRecord(snapshot.tenantId, { ...(saved ?? { planId, steps: {}, checkpoints: [] }), notice: next })
    setVersion((v) => v + 1)
  }
  const setHolidays = (text: string): void => {
    const next = text.split(/[\n,;]+/).map((x) => x.trim()).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))
    setSaved((p) => (p ? { ...p, holidays: next } : p))
    void savePlanRecord(snapshot.tenantId, { ...(saved ?? { planId, steps: {}, checkpoints: [] }), holidays: next })
    setVersion((v) => v + 1)
  }
  // The change freeze travels with the plan (roadmap-v2.md §2): the schedule moves around it.
  const setFreeze = (next: ChangeFreeze | null): void => {
    setSaved((p) => (p ? { ...p, freeze: next } : p))
    void savePlanRecord(snapshot.tenantId, { ...(saved ?? { planId, steps: {}, checkpoints: [] }), freeze: next })
    setVersion((v) => v + 1)
  }
  const waveTitle = (w: Schedule['waves'][number]) => (w.wave === 0 ? C.day0 : C.wave(w.wave, PHASE_NAME[w.phase] ?? ''))
  // Owner and scheduled date travel with the plan (roadmap-v2.md §4.12); a date re-plans in place.
  const saveStepMeta = (st: Step, meta: { owner?: string | null; scheduledDate?: string | null }): void => {
    setSaved((p) => {
      const base = p ?? { planId, steps: {}, checkpoints: [] }
      const prev = base.steps[st.id] ?? { status: st.status, history: st.history, skipReason: st.skipReason }
      const next = { ...base, steps: { ...base.steps, [st.id]: { ...prev, ...meta } } }
      void savePlanRecord(snapshot.tenantId, next)
      return next
    })
    if (meta.scheduledDate !== undefined) setVersion((v) => v + 1)
  }
  // The population export is built in the browser from the scan (roadmap-v2.md §3): nothing leaves this machine.
  // Built on demand (after the early returns above, so no hook); cohorts and the CSV share it.
  let populationCtxCache: ReturnType<typeof populationContext> | null = null
  const populationCtx = (): ReturnType<typeof populationContext> => {
    if (!populationCtxCache) {
      const viabilityById = new Map(computed.viability.map((v) => [v.userId, v]))
      populationCtxCache = populationContext(snapshot, viabilityById, adminUserIds(snapshot.roles), new Set(mapping?.highCareUserIds ?? []), ringContextIndexes(snapshot).deviceReady, nameOf)
    }
    return populationCtxCache
  }
  const exportPopulation = (step: Step): void => {
    downloadFile(`${step.id}-people.csv`, toCsv(POPULATION_CSV_HEADER, populationRows(step, populationCtx())), 'text/csv')
  }
  // Cohorts are built when a step opens (25,000 users are not bucketed for every step of every plan).
  const cohortsOf = (step: Step) => (step.populationView && step.populationView.mode !== 'names' ? cohortsFor(step.population.ids, populationCtx()) : [])
  /** At most ten names, then "and N more" (roadmap-v2.md §3: nothing renders unbounded). */
  const boundedNames = (ids: string[]): string => {
    const shown = ids.slice(0, 10).map(nameOf)
    return ids.length > 10 ? `${shown.join(', ')} ${POPULATION.andMore(ids.length - 10)}` : shown.join(', ')
  }
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
      schedule: { startDate: startDate ?? schedule.start, band: band ?? undefined, owner: owner || undefined, freeze: saved?.freeze ?? null },
      revision: saved?.revision,
      revisions: saved?.revisions,
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
    const stepsRecord: SavedSteps = Object.fromEntries(plan.steps.map((s) => [s.id, savedStepOf(s)]))
    const start = plan.schedule?.startDate ?? startDate ?? undefined
    const loadedBand = plan.schedule?.band && BANDS[plan.schedule.band as SizeBand] ? (plan.schedule.band as SizeBand) : band
    const record: PlanStore = {
      planId: plan.planId,
      steps: stepsRecord,
      checkpoints: plan.checkpoints,
      startDate: start,
      band: loadedBand,
      owner: plan.schedule?.owner,
      freeze: plan.schedule?.freeze ?? null,
      revision: plan.revision,
      revisions: plan.revisions,
      stepIds: plan.steps.map((s) => s.id),
      baselinePin: plan.baselinePin,
    }
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
    setSafeOnly(false)
    setStatusFilter(status ? new Set([status]) : new Set())
    setActiveTab('plan')
  }
  // The critical path in one sentence (roadmap-v2.md §2), plus what the scheduler relaxed to land on the band.
  const constraint = work.length === 0 ? null : [schedule.derivation.criticalPath, ...schedule.derivation.relaxed].join(' ')
  const policyCount = schedule.policyCount
  const readyToday = steps.filter((s) => s.status === 'ready')
  const highDangers = dangers.filter((d) => d.severity === 'high').length

  const overview = () => (
    <div className="overview">
      {/* Band 1: the headline and the one constraint that sets the length (prompt 26 §6). */}
      <div className="overview-band">
        <h3 className="overview-headline">{work.length === 0 ? C.headlineDone(tracked.length) : C.headline(trackedDone, tracked.length, absoluteDate(schedule.targetEnd))}</h3>
        {constraint && <p className="overview-constraint">{constraint}</p>}
      </div>

      {/* Band 2: four tiles, each opening the Steps tab pre-filtered (§7). */}
      <div className="overview-band">
        <Stats>
          <StatTile value={`${trackedDone}/${tracked.length}`} label={TILE.stepsDone.title} tone="success" tip={TILE.stepsDone} onClick={() => openSteps('done')} />
          <StatTile value={schedule.weeks} label={TILE.weeks.title} tip={TILE.weeks} onClick={() => setActiveTab('schedule')} />
          <StatTile value={safe.length} label={SAFE.tile} tone={safe.length > 0 ? 'success' : 'neutral'} tip={TILE.safeToday} onClick={() => { setSafeOnly(true); setStatusFilter(new Set()); setActiveTab('plan') }} />
          <StatTile value={blocked.length} label={STEP_STATUS.blocked.title} tone={blocked.length > 0 ? 'warning' : 'neutral'} tip={STEP_STATUS.blocked} onClick={() => openSteps('blocked')} />
        </Stats>
      </div>

      {/* Band 3: what needs attention, and the plan settings (§8). */}
      <div className="overview-band">
        <div>
          <h4>{C.attentionTitle}</h4>
          {dangers.length === 0 && blocked.length === 0 && <EmptyState scene="nothingToWatch" title={C.nothingToWatchTitle} text={C.nothingToWatchText} />}
          {(dangers.length > 0 || blocked.length > 0) && (
          <>
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
          </>
          )}
          {policyCount && (
            <Callout kind={policyCount.warning ? 'warning' : 'info'}>
              {policyCount.statement}
              {policyCount.warning && ` ${policyCount.warning}`}
              {policyCount.consolidation.length > 0 && (
                <>
                  {' '}
                  {C.consolidationLead(policyCount.consolidation.length)}
                  <ul className="sections">
                    {policyCount.consolidation.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </>
              )}
            </Callout>
          )}
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
      </div>

    </div>
  )

  // ---- Progress (roadmap-v2.md §5, §8): the overview plus the journey ----
  const progressRows = stepProgress(steps, schedule)
  const headline = progressHeadline(steps, schedule)
  const lastCheckpoint = saved?.checkpoints.at(-1) ?? null
  const changes = [...changesSince(snapshot, lastCheckpoint, steps, planId), ...groupGrowth(lastCheckpoint, groups)]
  const STAGES: { id: (typeof progressRows)[number]['stage']; label: string }[] = [
    { id: 'planned', label: TRACK.stage.planned },
    { id: 'reportOnly', label: TRACK.stage.reportOnly },
    { id: 'soaking', label: TRACK.stage.soaking },
    { id: 'readyToEnforce', label: TRACK.stage.readyToEnforce },
    { id: 'enforced', label: TRACK.stage.enforced },
    { id: 'verified', label: TRACK.stage.verified },
    { id: 'alreadyInPlace', label: TRACK.stage.alreadyInPlace },
  ]
  const weekKey = (iso: string): string => {
    const d = new Date(iso)
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
    return d.toISOString().slice(0, 10)
  }
  const stripWeeks = (): { week: string; planned: number; actual: number }[] => {
    const last = [schedule.targetEnd, headline.projectedEnd ?? schedule.targetEnd].sort().at(-1) as string
    const out: { week: string; planned: number; actual: number }[] = []
    const first = [schedule.start, headline.started ?? schedule.start].sort()[0]
    for (let d = new Date(weekKey(first) + 'T12:00:00.000Z'); d.toISOString() <= last; d.setUTCDate(d.getUTCDate() + 7)) {
      const wk = d.toISOString().slice(0, 10)
      out.push({
        week: wk,
        planned: progressRows.filter((r) => r.plannedStart && weekKey(r.plannedStart) === wk).length,
        actual: progressRows.filter((r) => r.actualStart && weekKey(r.actualStart) === wk).length,
      })
    }
    return out
  }
  const anySlipReason = progressRows.some((r) => r.slipReason)
  const progressTab = () => (
    <div>
      {overview()}
      <div className="overview-band">
        <h3 className="overview-headline">{headline.state}</h3>
        {headline.projection && <p className="overview-constraint">{headline.projection}</p>}
        {headline.already && <p className="overview-constraint">{headline.already}</p>}
      </div>
      <h4>{PROGRESS.journeyTitle}</h4>
      <p className="reason">{PROGRESS.journeyHint}</p>
      <div className="journey">
        {STAGES.map((st) => (
          <div key={st.id} className={`journey-col stage-${st.id}`}>
            <div className="journey-head">
              {st.label} <span className="reason">{progressRows.filter((r) => r.stage === st.id).length}</span>
            </div>
            {progressRows
              .filter((r) => r.stage === st.id)
              .map((r) => (
                <a key={r.stepId} className={`journey-dot ring-${Math.min(r.ring, 3)}`} href={stepHref(r.stepId)} title={r.title} onClick={(e) => { e.preventDefault(); setActiveTab('plan'); setOpenStepId(r.stepId) }}>
                  {r.title}
                </a>
              ))}
          </div>
        ))}
      </div>
      <h4>{PROGRESS.stripTitle}</h4>
      <p className="reason">{PROGRESS.stripLegend}</p>
      <div className="strip" aria-label={PROGRESS.stripTitle}>
        {stripWeeks().map((w) => (
          <div key={w.week} className="strip-week" title={`${PROGRESS.stripWeek(absoluteDate(w.week + 'T12:00:00.000Z'))}: ${PROGRESS.stripPlanned(w.planned)}, ${PROGRESS.stripActual(w.actual)}`}>
            <div className="strip-bars">
              <span className="strip-planned" style={{ height: `${Math.min(100, w.planned * 20)}%` }} />
              <span className="strip-actual" style={{ height: `${Math.min(100, w.actual * 20)}%` }} />
            </div>
            <span className="strip-label">{absoluteDate(w.week + 'T12:00:00.000Z').replace(/,? \d{4}$/, '')}</span>
          </div>
        ))}
      </div>
      <h4>{PROGRESS.perStepTitle}</h4>
      <div className="table-scroll">
        <table className="cohort-table progress-table">
          <thead>
            <tr>
              <th>{SCHEDULE_TAB.colStep}</th>
              <th>{PROGRESS.colPlanned}</th>
              <th>{PROGRESS.colActual}</th>
              <th>{PROGRESS.colSlip}</th>
              {anySlipReason && <th>{PROGRESS.colWhy}</th>}
            </tr>
          </thead>
          <tbody>
            {progressRows.map((r) => (
              <tr key={r.stepId}>
                <td>
                  <a href={stepHref(r.stepId)} onClick={(e) => { e.preventDefault(); setActiveTab('plan'); setOpenStepId(r.stepId) }}>{r.title}</a>
                </td>
                <td>{r.plannedStart ? absoluteDate(r.plannedStart) : PROGRESS.absent}</td>
                <td>{r.actualStart ? absoluteDate(r.actualStart) : PROGRESS.absent}</td>
                <td>{r.slipDays === null ? PROGRESS.absent : PROGRESS.slipDays(r.slipDays)}</td>
                {anySlipReason && <td className="reason">{r.slipReason ?? PROGRESS.absent}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4>{PROGRESS.changesTitle}</h4>
      {!lastCheckpoint && <p className="reason">{PROGRESS.changesNoCheckpoint}</p>}
      {lastCheckpoint && changes.length === 0 && <p className="reason">{PROGRESS.changesNone}</p>}
      {changes.length > 0 && (
        <>
          <p className="reason">{PROGRESS.driftNote(changes.filter((c) => !c.planned).length)}</p>
          <ul className="sections">
            {changes.map((c, i) => (
              <li key={i}>
                <Chip status={c.planned ? 'done' : 'warning'}>{c.planned ? PROGRESS.planned : PROGRESS.unplanned}</Chip> {c.text}
                {c.at && <span className="reason"> · {absoluteDate(c.at)}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      {(saved?.revisions ?? []).length > 0 && (
        <details>
          <summary>{PROGRESS.revision(saved?.revision ?? 1, absoluteDate((saved?.revisions ?? []).at(-1)?.at ?? new Date().toISOString()))}</summary>
          <ul className="sections">
            {(saved?.revisions ?? []).map((r) => (
              <li key={r.revision}>
                {PROGRESS.revision(r.revision, absoluteDate(r.at))}: {r.note}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )

  // ---- Schedule (§8): the timeline with owners, editable dates, the critical path, ICS ----
  const exportIcs = (): void => downloadFile(`iamai-plan-${snapshot.tenantId.slice(0, 8)}.ics`, buildIcs(steps, tenantName, planId), 'text/calendar')
  const weekView = () => {
    const weekKeyOf = (iso: string): string => {
      const d = new Date(iso)
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
      return d.toISOString().slice(0, 10)
    }
    const weeks = [...new Set(allEvents.map(({ e }) => weekKeyOf(e.at)))].sort()
    if (weeks.length === 0) return <p className="reason">{WEEK_VIEW.nothing}</p>
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    return (
      <div className="week-view">
        {weeks.map((wk) => {
          const inWeek = allEvents.filter(({ e }) => weekKeyOf(e.at) === wk)
          const outOfHours = inWeek.filter(({ e }) => e.outOfHours).length
          return (
            <div key={wk} className="card week-card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{WEEK_VIEW.weekOf(absoluteDate(wk + 'T12:00:00.000Z'))}</strong>
                {outOfHours > 0 && <Chip status="warning">{WEEK_VIEW.outOfHours(outOfHours)}</Chip>}
              </div>
              <div className="table-scroll">
                <table className="cohort-table week-table">
                  <thead>
                    <tr>
                      <th />
                      {DAYS.map((d) => (
                        <th key={d}>{d.slice(0, 3)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(['announce', 'remind', 'enforce'] as const).map((kind) => (
                      <tr key={kind}>
                        <th>{WEEK_VIEW.rows[kind]}</th>
                        {DAYS.map((d) => (
                          <td key={d}>
                            {inWeek
                              .filter(({ e }) => e.kind === kind && e.day === d)
                              .map(({ step: st, e }) => (
                                <a key={`${st.id}-${e.kind}`} className={`week-event ${e.outOfHours ? 'is-out' : ''}`} href={stepHref(st.id)} title={e.reason} onClick={(ev) => { ev.preventDefault(); setActiveTab('plan'); setOpenStepId(st.id) }}>
                                  <span className="mono">{e.time}</span> {st.plainTitle}
                                </a>
                              ))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    )
  }
  const scheduleTab = () => (
    <div>
      <p className="overview-constraint">{schedule.derivation.criticalPath}</p>
      {schedule.rhythm && (
        <p className="reason">
          <strong>{RHYTHM.title}.</strong> {schedule.rhythm.sentence}
        </p>
      )}
      <h4>{WEEK_VIEW.title}</h4>
      <p className="reason">{WEEK_VIEW.hint}</p>
      {weekView()}
      {timeline()}
      <h4>{SCHEDULE_TAB.ownersTitle}</h4>
      <div className="table-scroll">
        <table className="cohort-table progress-table">
          <thead>
            <tr>
              <th>{SCHEDULE_TAB.colStep}</th>
              <th>{SCHEDULE_TAB.colOwner}</th>
              <th>{SCHEDULE_TAB.colStart}</th>
              <th>{SCHEDULE_TAB.colEnd}</th>
              <th>{SCHEDULE_TAB.colRing}</th>
            </tr>
          </thead>
          <tbody>
            {work.map((st) => (
              <tr key={st.id}>
                <td>
                  <a href={stepHref(st.id)} onClick={(e) => { e.preventDefault(); setActiveTab('plan'); setOpenStepId(st.id) }}>{st.title}</a>
                </td>
                <td>
                  <input type="text" value={st.owner ?? ''} placeholder={SECTION.ownerPlaceholder} aria-label={`${SECTION.owner}: ${st.title}`} onChange={(e) => saveStepMeta(st, { owner: e.currentTarget.value || null })} />
                </td>
                <td>
                  <input type="date" value={(st.scheduledDate ?? st.rings[0]?.plannedStart ?? '').slice(0, 10)} aria-label={`${SECTION.scheduledDate}: ${st.title}`} onChange={(e) => e.currentTarget.value && saveStepMeta(st, { scheduledDate: `${e.currentTarget.value}T12:00:00.000Z` })} />
                </td>
                <td>{st.rings.at(-1) ? absoluteDate(st.rings.at(-1)!.plannedEnd) : SCHEDULE_TAB.unscheduled}</td>
                <td>{st.rings.length > 0 ? st.rings.map((r) => r.name).join(' → ') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="row no-print">
        <Button icon="download" onClick={exportIcs}>
          {SCHEDULE_TAB.exportIcs}
        </Button>
        <span className="reason">{SCHEDULE_TAB.icsNote}</span>
      </p>
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
          <div className="row">
            <span className="muted">{CALENDAR.freezeLabel}</span>
            <label>
              {CALENDAR.freezeFrom}{' '}
              <input
                type="date"
                value={saved?.freeze?.from.slice(0, 10) ?? ''}
                aria-label={`${CALENDAR.freezeLabel} ${CALENDAR.freezeFrom}`}
                onChange={(e) => e.currentTarget.value && setFreeze({ from: `${e.currentTarget.value}T00:00:00.000Z`, to: saved?.freeze?.to ?? `${e.currentTarget.value}T23:59:59.000Z` })}
              />
            </label>
            <label>
              {CALENDAR.freezeTo}{' '}
              <input
                type="date"
                value={saved?.freeze?.to.slice(0, 10) ?? ''}
                aria-label={`${CALENDAR.freezeLabel} ${CALENDAR.freezeTo}`}
                onChange={(e) => e.currentTarget.value && setFreeze({ from: saved?.freeze?.from ?? `${e.currentTarget.value}T00:00:00.000Z`, to: `${e.currentTarget.value}T23:59:59.000Z` })}
              />
            </label>
            {saved?.freeze && (
              <Button size="sm" variant="quiet" onClick={() => setFreeze(null)}>
                {CALENDAR.freezeClear}
              </Button>
            )}
            <InfoTip title={CALENDAR.freezeLabel} text={CALENDAR.freezeHint} />
          </div>
          {schedule.freeze && <p className="reason">{CALENDAR.freeze(absoluteDate(schedule.freeze.from), absoluteDate(schedule.freeze.to))}</p>}
          <div className="row">
            <span className="muted">{NOTICE.title}</span>
            {(['low', 'medium', 'high'] as const).map((k) => (
              <label key={k}>
                {NOTICE[k]}{' '}
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={(saved?.notice ?? NOTICE_DEFAULTS)[k]}
                  aria-label={`${NOTICE.title}: ${NOTICE[k]}`}
                  style={{ minWidth: '4rem', width: '5rem' }}
                  onChange={(e) => setNotice({ ...(saved?.notice ?? NOTICE_DEFAULTS), [k]: Math.max(0, Number(e.currentTarget.value) || 0) })}
                />
              </label>
            ))}
            <InfoTip title={NOTICE.title} text={NOTICE.hint} />
          </div>
          <div className="row">
            <label>
              {NOTICE.holidays}{' '}
              <input
                type="text"
                defaultValue={(saved?.holidays ?? []).join(', ')}
                placeholder={NOTICE.holidaysPlaceholder}
                aria-label={NOTICE.holidays}
                onBlur={(e) => setHolidays(e.currentTarget.value)}
                style={{ minWidth: '18rem' }}
              />
            </label>
            <InfoTip title={NOTICE.holidays} text={NOTICE.holidaysHint} />
          </div>
          <p className="reason">
            {CALENDAR.noFriday} {CALENDAR.weeklyCap(schedule.enforcementCap)}
          </p>
        </Card>
    </div>
  )

  // ---- Export (§8): the plan file, the document, the change record, markdown ----
  // The change record (ux-review-07 §32): one row per step, as a Markdown table or a CSV.
  const changeRecordRows = (): (string | number)[][] =>
    trackable(steps).map((st) => {
      const row = progressRows.find((r) => r.stepId === st.id)
      const evidence = st.tracking
        ? `${st.tracking.policyName} (${st.tracking.note})${st.tracking.enforcedAt ? `; ${TRACK.enforced(absoluteDate(st.tracking.enforcedAt))}` : ''}`
        : (st.history.at(-1)?.note ?? st.stateReason)
      return [
        st.title,
        STEP_KIND_LABEL[st.kind],
        st.goalId,
        st.populationBasis || PROGRESS.absent,
        row?.plannedStart ? absoluteDate(row.plannedStart) : PROGRESS.absent,
        row?.actualStart ? absoluteDate(row.actualStart) : PROGRESS.absent,
        evidence,
        st.rollback,
      ]
    })
  const CHANGE_HEADER = [SCHEDULE_TAB.colStep, C.kindLabel, C.goalLabel, C.whoItTouches, PROGRESS.colPlanned, PROGRESS.colActual, C.evidenceLabel, SECTION.rollback]
  const changeRecordMarkdown = (): string => {
    const esc = (v: string | number) => String(v).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
    const lines = [`# Change record: ${tenantName}`, `Plan ${planId}, revision ${saved?.revision ?? 1}, ${absoluteDate(new Date().toISOString())}`, '', `| ${CHANGE_HEADER.join(' | ')} |`, `| ${CHANGE_HEADER.map(() => '---').join(' | ')} |`]
    for (const r of changeRecordRows()) lines.push(`| ${r.map(esc).join(' | ')} |`)
    return lines.join('\n')
  }
  const changeRecordCsv = (): string => toCsv(CHANGE_HEADER, changeRecordRows())
  const exportTab = () => (
    <div className="export-grid">
      <Card title={EXPORT_TAB.planFile}>
        <p className="reason">{EXPORT_TAB.planFileText}</p>
      <p className="row no-print">
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
      </p>
      </Card>
      <Card title={EXPORT_TAB.changeRecord}>
        <p className="reason">{EXPORT_TAB.changeRecordText}</p>
        <p className="row no-print">
          <Button icon="download" onClick={() => downloadFile(`iamai-change-record-${snapshot.tenantId.slice(0, 8)}.md`, changeRecordMarkdown(), 'text/markdown')}>
            {EXPORT_TAB.downloadChangeRecord}
          </Button>
          <Button icon="download" onClick={() => downloadFile(`iamai-change-record-${snapshot.tenantId.slice(0, 8)}.csv`, changeRecordCsv(), 'text/csv')}>
            {EXPORT_TAB.downloadChangeRecordCsv}
          </Button>
        </p>
      </Card>
      <Card title={EXPORT_TAB.pdf}>
        <p className="reason">{EXPORT_TAB.pdfText}</p>
        <p className="row no-print">
          <Button icon="print" onClick={() => window.print()}>
            {EXPORT_TAB.print}
          </Button>
        </p>
      </Card>
    </div>
  )

  /** A compact tile for a step inside a phase card; the whole tile is the link (prompt 26 §12). */
  const stepTile = (st: Step, onOpen?: () => void) => (
    <a
      key={st.id}
      className={`step-tile ${st.safeToday ? 'lane-safe' : ''} ${changedIds.has(st.id) ? 'just-changed' : ''}`}
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
        <RingProgress step={st} size={26} title={st.rings.length > 0 ? RINGS.summary(st.rings.length, st.rings[0].soakDays, Math.max(1, Math.round(st.rings.reduce((n, r) => n + r.soakDays, 0) / 7))) : STEP_STATUS_LABEL[st.status]} />
      </div>
      <strong className="step-tile-title">{st.plainTitle || st.title}</strong>
      {st.plainTitle && st.plainTitle !== st.title && <div className="sub technical-name">{st.title}</div>}
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
        <div className="minimap no-print" aria-label={C.tabs.schedule}>
          {waves.map((w) => {
            const all = phaseSteps(w)
            const doneN = all.filter((st) => st.status === 'done').length
            const days = Math.max(1, w.days)
            return (
              <a
                key={w.wave}
                href={`#phase-${w.wave}`}
                className={`minimap-seg ${doneN === all.length ? 'is-done' : doneN > 0 ? 'is-partial' : Date.parse(w.start) > Date.now() ? 'is-future' : ''}`}
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
                  {w.wave === 0 && created > 0 && (
                    <p className="reason">
                      {C.day0Text(created)} <Term id="reportOnly">{TERM_WORDS.reportOnly}</Term>
                    </p>
                  )}
                  <div className="step-grid">{inWave.map((st) => stepTile(st, () => { setActiveTab('plan'); setOpenStepId(st.id) }))}</div>
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
      {dangers.length === 0 && <EmptyState scene="noDangers" title={C.noDangersTitle} text={C.noDangers} />}
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
    const visible = steps.filter((s) => (safeOnly ? s.safeToday : statusFilter.size === 0 ? showCompleted || s.status !== 'done' : statusFilter.has(s.status)))
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
          <FilterChip selected={safeOnly} title={SAFE.cardSentence} onToggle={() => setSafeOnly((v) => !v)}>
            {C.filterCount(SAFE.filter, safe.length)}
          </FilterChip>
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
                        onExportPopulation={exportPopulation}
                        cohortsOf={cohortsOf}
                        boundedNames={boundedNames}
                        dependencies={schedule.graph[step.id] ?? []}
                        onMeta={saveStepMeta}
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
        {unavailable.length > 0 && !safeOnly && statusFilter.size === 0 && (
          <div className="card phase-card">
            <h3 className="phase-title">{LICENCE_HEADER.unavailableTitle}</h3>
            <p className="reason">{LICENCE_HEADER.unavailableText}</p>
            <ul className="sections">
              {unavailable.map((r) => (
                <li key={r.goal.id}>
                  <strong>{PLAIN_TITLES[r.goal.id] ?? r.goal.name}</strong> <span className="reason">· {r.goal.name} · {LICENCE_HEADER.tierName(r.goal.implementations[0]?.tier ?? '')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  // ---- This week (scheduling-and-onboarding.md §3.5): at most three things, with dates and times ----
  const nowMs = Date.now()
  const weekEnd = nowMs + 7 * 86_400_000
  const allEvents: { step: Step; e: StepEvent }[] = work.flatMap((st) => (st.events ? [st.events.announce, st.events.remind, st.events.remindMorning, st.events.enforce].filter((e): e is StepEvent => e !== null).map((e) => ({ step: st, e })) : []))
  const thisWeekEvents = allEvents.filter(({ e }) => Date.parse(e.at) >= nowMs - 86_400_000 && Date.parse(e.at) <= weekEnd).sort((a, b) => a.e.at.localeCompare(b.e.at))
  const thisWeekItems: string[] = []
  const announces = thisWeekEvents.filter((x) => x.e.kind === 'announce')
  const reminds = thisWeekEvents.filter((x) => x.e.kind === 'remind')
  const enforces = thisWeekEvents.filter((x) => x.e.kind === 'enforce')
  if (announces.length > 0) thisWeekItems.push(THIS_WEEK.announce(announces.length, announces[0].e.day))
  for (const x of enforces.slice(0, 2)) thisWeekItems.push(THIS_WEEK.enforce(x.step.plainTitle, `${x.e.day} ${x.e.time}`))
  if (reminds.length > 0 && thisWeekItems.length < 3) thisWeekItems.push(THIS_WEEK.remind(reminds.length, reminds[0].e.day))
  const toSetUpNames = computed.viability.filter((v) => v.enabled && v.activity === 'active' && (v.mfa === 'none' || v.mfa === 'unverified')).slice(0, 3).map((v) => nameOf(v.userId))
  if (toSetUpNames.length > 0 && thisWeekItems.length < 3 && steps.some((st) => st.kind === 'verify' && st.status !== 'done')) thisWeekItems.push(THIS_WEEK.setUp(toSetUpNames.join(', ')))
  const readyPrereq = work.find((st) => st.kind === 'prerequisite' && st.status === 'ready')
  if (readyPrereq && thisWeekItems.length < 3) thisWeekItems.push(THIS_WEEK.prerequisite(readyPrereq.plainTitle))
  const nextEvent = allEvents.filter(({ e }) => Date.parse(e.at) > weekEnd).sort((a, b) => a.e.at.localeCompare(b.e.at))[0] ?? null
  const nothingUntil =
    thisWeekItems.length === 0
      ? Date.parse(schedule.observation.end) > nowMs
        ? THIS_WEEK.nothingUntil(absoluteDate(schedule.observation.end), THIS_WEEK.observationEnds)
        : Date.parse(schedule.verification.end) > nowMs && schedule.verification.days > 0
          ? THIS_WEEK.nothingUntil(absoluteDate(schedule.verification.end), THIS_WEEK.campaignEnds)
          : nextEvent
            ? THIS_WEEK.nothingUntil(absoluteDate(nextEvent.e.at), THIS_WEEK.noticeEnds)
            : THIS_WEEK.nothing
      : null

  // ---- Licence awareness (§3.4): what this tenant's licence makes available ----
  const caps = snapshot.capabilities
  const tier = caps.entraP2?.enabled ? LICENCE_HEADER.tier.p2 : caps.entraP1?.enabled ? LICENCE_HEADER.tier.p1 : LICENCE_HEADER.tier.free
  const unavailable = computed.coverage.results.filter((r) => r.status === 'licence-limited')
  const neededTiers = [...new Set(unavailable.map((r) => r.goal.implementations[0]?.tier ?? ''))].filter(Boolean).map((t) => LICENCE_HEADER.tierName(t)).join(' or ')
  const licenceSentence = LICENCE_HEADER.sentence(tier, tracked.length, tracked.length + unavailable.length, unavailable.length, neededTiers)

  return (
    <StepFrame title={C.title} does={C.does} needs={needs}>
      {scan && <ScanAge at={scan.at} baseline={baseline?.source ?? null} />}
      <p className="reason">{licenceSentence}</p>
      <Card title={THIS_WEEK.title} className="this-week">
        {nothingUntil ? <p>{nothingUntil}</p> : <p>{THIS_WEEK.lead(thisWeekItems)}</p>}
      </Card>
      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'progress', label: C.tabs.progress, badge: `${trackedDone}/${tracked.length}`, render: progressTab },
          { id: 'plan', label: C.tabs.plan, render: stepsView },
          { id: 'danger', label: C.tabs.danger, badge: dangers.length || '', render: dangerAreas },
          { id: 'schedule', label: C.tabs.schedule, render: scheduleTab },
          { id: 'export', label: C.tabs.export, render: exportTab },
        ]}
      />
      <PrintPlan
        tenantName={tenantName}
        baselineLabel={baseline?.source ?? ''}
        operator={operator?.userPrincipalName ?? ''}
        baselinePin={baselineIndex.commit ?? null}
        progress={{ state: headline.state, projection: headline.projection, already: headline.already }}
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
      if (s.highCare.userIds.length > 0) lines.push(`  - ${C.markdown.care(s.highCare.userIds.slice(0, 10).map(nameOf).join(', ') + (s.highCare.userIds.length > 10 ? ` ${POPULATION.andMore(s.highCare.userIds.length - 10)}` : ''))}`)
      if (s.status === 'blocked') lines.push(`  - ${C.markdown.blocked(s.unblockNotes.join('; '))}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

/** Populations at scale (roadmap-v2.md §3): names under 25, cohorts and the riskiest ten above, a CSV in every mode. */
function PopulationBody({ view, total, onExport }: { view: NonNullable<Step['populationView']>; total: number; onExport: () => void }) {
  return (
    <div className="population">
      {view.named.length > 0 && (
        <p>
          <strong>{view.namedIsSample ? POPULATION.riskiestTitle(view.named.length) : POPULATION.everyoneNamed(total)}</strong>{' '}
          {view.named.map((n) => (n.reasons.length > 0 ? `${n.name} (${n.reasons.join(', ')})` : n.name)).join(', ')}
        </p>
      )}
      {view.namedIsSample && <p className="reason">{POPULATION.riskiestNote}</p>}
      {view.cohorts.length > 0 && (
        <details>
          <summary>{POPULATION.cohortsTitle}</summary>
          <div className="cohorts">
            {view.cohorts.map((c) => (
              <table key={c.title} className="cohort-table">
                <caption>{c.title}</caption>
                <tbody>
                  {c.rows.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td className="num">{view.mode === 'percentages' ? `${r.percent}%` : `${r.count.toLocaleString('en-AU')} (${r.percent}%)`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
          {view.mode === 'percentages' && <p className="reason">{POPULATION.cohortsPercentOnly}</p>}
        </details>
      )}
      <p className="row no-print">
        <Button size="sm" icon="download" onClick={onExport}>
          {POPULATION.exportCsv}
        </Button>
        <span className="reason">{POPULATION.exportNote}</span>
      </p>
    </div>
  )
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
  onExportPopulation,
  cohortsOf,
  boundedNames,
  dependencies,
  onMeta,
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
  onExportPopulation: (step: Step) => void
  cohortsOf: (step: Step) => NonNullable<Step['populationView']>['cohorts']
  boundedNames: (ids: string[]) => string
  dependencies: Dependency[]
  onMeta: (step: Step, meta: { owner?: string | null; scheduledDate?: string | null }) => void
}) {
  const [tab, setTab] = useState<'json' | 'portal' | 'ps'>('portal')
  const [ownerDraft, setOwnerDraft] = useState<string | null>(null)
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
          {step.plainTitle || step.title}
          <ScoreBadges score={step.score ?? null} />
          {step.plainTitle && step.plainTitle !== step.title && <div className="sub technical-name">{step.title}</div>}
          {(step.kind === 'create' || step.kind === 'adjust') && step.status !== 'done' && step.status !== 'skipped' && (
            <div className={`verdict ${step.safeVerdict.safe ? 'is-safe' : ''}`}>{step.safeVerdict.safe ? SAFE.verdictSafe : step.safeVerdict.sentence}</div>
          )}
          <div className="sub">{step.impact}</div>
          <div className="sub state-reason">{step.stateReason}</div>
        </>
      }
    >
      {step.safeVerdict.safe && <Callout kind="success">{step.safeVerdict.sentence}</Callout>}
      {step.events && (
        <div className="dates card">
          {([step.events.announce, step.events.remind, step.events.remindMorning, step.events.enforce].filter((e): e is StepEvent => e !== null)).map((e, i) => (
            <div key={i} className="date-row">
              <span className="date-kind">{e.kind === 'announce' ? EVENT_LABEL.announce : e.kind === 'remind' ? EVENT_LABEL.remind : EVENT_LABEL.enforce}</span>
              <span className="date-when">
                {EVENT_LABEL.suggested}: {e.day} {e.date}, {e.time}
                {e.outOfHours && <Chip status="warning">{EVENT_LABEL.outOfHours}</Chip>}
              </span>
              <span className="reason">{e.reason}</span>
            </div>
          ))}
        </div>
      )}
      {/* 1. What changes (roadmap-v2.md §4) */}
      <h4>{SECTION.whatChanges}</h4>
      <p>{step.whatChanges}</p>

      {/* 2. Why it matters */}
      <h4>{SECTION.whyItMatters}</h4>
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


      {/* 3. Who it touches, with the operator's own exposure */}
      {step.population.total > 0 && (
        <>
          <h4>{C.whoItTouches}</h4>
          <p className="reason">
            {step.populationBasis} · {affectedLine(step.population.total, step.population.active, step.population.admins, step.population.guests)}
          </p>
          {step.populationView && <PopulationBody view={{ ...step.populationView, cohorts: cohortsOf(step) }} total={step.population.total} onExport={() => onExportPopulation(step)} />}
        </>
      )}

      {step.includesOperator && (
        <Callout kind={step.operatorSafe ? 'info' : 'warning'}>
          {step.operatorNote}
          {!step.operatorSafe && ` ${C.operatorUnsafe}`}
          {step.operatorWhatIf && <div>{OPERATOR.whatIf(step.operatorWhatIf)}</div>}
        </Callout>
      )}

      {step.highCare.userIds.length > 0 && (
        <div className={`card ${step.highCare.ready ? '' : 'danger-high'}`}>
          <h4>{C.careTitle(boundedNames(step.highCare.userIds))}</h4>
          <ul className="sections">
            {step.highCare.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
            {step.highCare.ready && <li>{CHIP.care.text}</li>}
          </ul>
        </div>
      )}


      {/* 4. What could go wrong, with this tenant's evidence */}
      {step.failureModes.length > 0 && (
        <>
          <h4>{SECTION.couldGoWrong}</h4>
          <ul className="sections failure-modes">
            {step.failureModes.map((m, i) => (
              <li key={i} className={`applies-${m.applies}`}>
                <strong>{m.title}</strong> <Chip status={m.applies === 'yes' ? 'warning' : m.applies === 'no' ? 'done' : 'neutral'}>{SECTION.applies[m.applies]}</Chip>
                <div className="sub">{m.evidence}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* 5. Prerequisites, each linked to its step */}
      {step.status !== 'done' && (
        <>
          <h4>{SECTION.prerequisites}</h4>
          {dependencies.filter((d) => d.kind === 'hard').length === 0 && step.blockers.length === 0 && <p className="reason">{SECTION.noPrerequisites}</p>}
          {dependencies.filter((d) => d.kind === 'hard').length > 0 && (
            <ul className="sections">
              {dependencies
                .filter((d) => d.kind === 'hard')
                .map((d) => (
                  <li key={d.stepId}>
                    <a href={stepHref(d.stepId)}>{stepById.get(d.stepId)?.title ?? d.stepId}</a> <span className="reason">· {d.reason}</span>
                  </li>
                ))}
            </ul>
          )}
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
            {step.evidence.affectedUserIds.length > 0 && <li>{C.affected(boundedNames(step.evidence.affectedUserIds))}</li>}
          </ul>
        </>
      )}


      {/* 6. The change */}
      <h4>{SECTION.theChange}</h4>
      {step.naming && (
        <p>
          <strong>{C.proposedName}</strong> {step.naming.proposed}
          {step.naming.fromBaseline && <div className="sub">{NAMING.fromBaseline(step.naming.fromBaseline)}</div>}
        </p>
      )}

      {step.action.changes && step.action.changes.length > 0 && (
        <table className="cohort-table change-table">
          <thead>
            <tr>
              <th>{SECTION.changeField}</th>
              <th>{SECTION.changeFrom}</th>
              <th>{SECTION.changeTo}</th>
            </tr>
          </thead>
          <tbody>
            {step.action.changes.map((c) => (
              <tr key={c.field}>
                <td>{c.field}</td>
                <td>
                  <code>{c.from}</code>
                </td>
                <td>
                  <code>{c.to}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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

      {/* 7. Ring plan */}
      {step.rings.length > 0 && (
        <>
          <h4>
            <Term id="ring">{SECTION.ringPlan}</Term>
          </h4>
          <ol className="sections rings">
            {step.rings.map((r) => (
              <li key={r.index}>
                <strong>{r.name}</strong> <span className="reason">· {dateRange(r.plannedStart, r.plannedEnd)} · {SECTION.ringSoak(r.soakDays)}</span>
                <div className="sub">
                  {r.targeting.groupName && <span>{r.targeting.groupName} · </span>}
                  {r.targeting.advice}
                  {r.targeting.filter && <div><code>{RINGS.filter(r.targeting.filter)}</code></div>}
                  {r.targeting.suggestedMemberIds.length > 0 && r.targeting.kind === 'group' && <div>{boundedNames(r.targeting.suggestedMemberIds)}</div>}
                </div>
                <details>
                  <summary>{SECTION.ringEntry}</summary>
                  <ul className="sections">
                    {r.entryCriteria.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ol>
        </>
      )}

      {/* 8. How to verify */}
      {step.verify && (
        <>
          <h4>{SECTION.howToVerify}</h4>
          <ul className="sections">
            {step.verify.where.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {step.verify.filter && (
              <li>
                {SECTION.filterLabel} <code>{step.verify.filter}</code>
              </li>
            )}
            <li>
              {SECTION.goodLooksLike} {step.verify.good}
            </li>
          </ul>
        </>
      )}

      {/* 9. Exit criteria, per ring and for the step */}
      <h4>{SECTION.exitCriteria}</h4>
      <ul className="sections">
        {step.exitCriteria.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      {step.rings.length > 0 && (
        <ul className="sections">
          {step.rings.map((r) => (
            <li key={r.index}>
              <strong>{r.name}</strong> · {SECTION.ringExit}
              <ul className="sections">
                {r.exitCriteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {/* 10. Rollback, with the previous body */}
      <h4>{SECTION.rollback}</h4>
      <p className="reason">
        {step.rollback} {ROLLBACK_V2.timing}
      </p>
      {step.rollbackBody && (
        <details>
          <summary>{SECTION.previousBody}</summary>
          <p className="reason">{ROLLBACK_V2.storedBody}</p>
          <pre className="code-block">{step.rollbackBody}</pre>
          <p className="no-print">
            <Button size="sm" icon="download" onClick={() => downloadFile(`${step.id}-previous.json`, step.rollbackBody!, 'application/json')}>
              {C.downloadJson}
            </Button>
          </p>
        </details>
      )}

      {/* 11. Comms: per ring, dated, and the help-desk version */}
      {step.comms && (
        <>
          <h4>{SECTION.comms}</h4>
          {step.comms === NO_ANNOUNCEMENT ? (
            <p className="reason">{step.comms}</p>
          ) : step.ringComms.length > 1 ? (
            step.ringComms.map((rc) => (
              <details key={rc.ring}>
                <summary>{SECTION.ringAnnouncement(rc.ring, rc.date)}</summary>
                <pre className="code-block" style={{ whiteSpace: 'pre-wrap' }}>
                  {rc.text}
                </pre>
                <p className="no-print">
                  <Button size="sm" icon="copy" onClick={() => void onCopy(`${step.id}:${rc.ring}`, rc.text)}>
                    {copied === `${step.id}:${rc.ring}` ? C.copied : C.copyAnnouncement}
                  </Button>
                </p>
              </details>
            ))
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
      {step.helpDesk && (
        <details className="card">
          <summary>{SECTION.helpDeskTitle}</summary>
          <p>
            <strong>{SECTION.callsAbout}</strong>
          </p>
          <ul className="sections">
            {step.helpDesk.callsAbout.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          <p>
            <strong>{SECTION.whatToSay}</strong>
          </p>
          <ul className="sections">
            {step.helpDesk.whatToSay.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </details>
      )}

      {step.forManager && (
        <>
          <h4>{MANAGER_UI.title}</h4>
          <p>{step.forManager}</p>
          <p className="no-print">
            <Button size="sm" icon="copy" onClick={() => void onCopy(`${step.id}:manager`, step.forManager)}>
              {copied === `${step.id}:manager` ? C.copied : MANAGER_UI.copy}
            </Button>
          </p>
        </>
      )}
      {/* 12. Owner and scheduled date */}
      {step.status !== 'done' && step.status !== 'skipped' && (
        <>
          <h4>{SECTION.ownerAndDate}</h4>
          <p className="row no-print">
            <label>
              {SECTION.owner}{' '}
              <input
                type="text"
                value={ownerDraft ?? step.owner ?? ''}
                placeholder={SECTION.ownerPlaceholder}
                aria-label={SECTION.owner}
                onChange={(e) => setOwnerDraft(e.currentTarget.value)}
                onBlur={() => {
                  if (ownerDraft !== null && ownerDraft !== (step.owner ?? '')) onMeta(step, { owner: ownerDraft.trim() || null })
                  setOwnerDraft(null)
                }}
              />
            </label>
            <label>
              {SECTION.scheduledDate}{' '}
              <input
                type="date"
                value={step.scheduledDate?.slice(0, 10) ?? ''}
                aria-label={SECTION.scheduledDate}
                onChange={(e) => e.currentTarget.value && onMeta(step, { scheduledDate: `${e.currentTarget.value}T12:00:00.000Z` })}
              />
            </label>
            {step.scheduledDate && (
              <Button size="sm" variant="quiet" onClick={() => onMeta(step, { scheduledDate: null })}>
                {SECTION.scheduledClear}
              </Button>
            )}
            <InfoTip title={SECTION.scheduledDate} text={SECTION.scheduledHint} />
          </p>
          <p className="reason print-only">
            {SECTION.owner}: {step.owner ?? '—'} · {SECTION.scheduledDate}: {step.scheduledDate ? absoluteDate(step.scheduledDate) : step.rings[0] ? absoluteDate(step.rings[0].plannedStart) : '—'}
          </p>
        </>
      )}

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
