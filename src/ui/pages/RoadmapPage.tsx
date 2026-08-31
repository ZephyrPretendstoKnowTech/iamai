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
import { batchClassOf, nextMonday } from '../../roadmap/schedule.ts'
import { LONG_PLAN_WEEKS, overrunFor } from '../../roadmap/overrun.ts'
import { insightsUrl, preflightFor, verdictFor, whatIfUrl } from '../../roadmap/verdict.ts'
import type { Preflight, Verdict } from '../../roadmap/verdict.ts'
import { VERDICT } from '../../copy/verdict.ts'
import { applyProgress, mergePersisted, skipStep, unskipStep } from '../../roadmap/progress.ts'
import { annotateStateReasons } from '../../roadmap/stateReason.ts'
import { refreshBlockerImpact } from '../../roadmap/blockerSteps.ts'
import { buildPlanFile, makeCheckpoint, parsePlanFile } from '../../roadmap/plan.ts'
import type { Checkpoint } from '../../roadmap/plan.ts'
import type { Step, StepStatus } from '../../roadmap/types.ts'
import { saveDevResults } from '../../devSave.ts'
import baselineIndex from '../../../baselines/jhope188-conditionalaccesspolicies.index.json' with { type: 'json' }
import { ROADMAP as C } from '../../copy/pages.ts'
import { CHIP, STEP_KIND, STEP_STATUS, TILE } from '../../copy/definitions.ts'
import { overrunList, roadmapOverview, scheduleOverrun, scheduleRationale } from '../../copy/statements.ts'
import { CALENDAR, OVERRUN } from '../../copy/schedule.ts'
import { POPULATION } from '../../copy/population.ts'
import { ROLLBACK_V2, SECTION } from '../../copy/stepContent.ts'
import { RINGS } from '../../copy/rings.ts'
import { RingProgress } from '../components/Ring.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { Term } from '../components/Term.tsx'
import { BATCH, EVENT as EVENT_LABEL, LICENCE_HEADER, TERM_WORDS, MANAGER as MANAGER_UI, NOTICE_LINE, RHYTHM, SAFE, THIS_WEEK, WEEK_VIEW } from '../../copy/timing.ts'
import { LADDER } from '../../copy/ladder.ts'
import { CITATION, FIELD_PRACTICE } from '../../copy/validation.ts'
import { PLAIN_TITLES } from '../../copy/plain.ts'
import { isEmergencyAccess } from '../../roadmap/blockerSteps.ts'
import { RECOVERY } from '../../copy/recovery.ts'
import { DRIFT } from '../../copy/drift.ts'
import { directExclusionDrift, exclusionDrift } from '../../roadmap/drift.ts'
import firstPartyApps from '../../../data/first-party-apps.json' with { type: 'json' }
import { ASSERTION_CHOICES, ASSERTION_EFFECT, unansweredFor, unknownsFor } from '../../roadmap/unknowns.ts'
import { checkServicePrincipals, createCommands, SP_TEXT } from '../../roadmap/servicePrincipals.ts'
import { SKIP, SKIP_REASONS } from '../../copy/skip.ts'
import type { SkipReasonId } from '../../copy/skip.ts'
import { LOG, NEXT } from '../../copy/next.ts'
import { doThisNext } from '../../roadmap/next.ts'
import { appendLog, emptyLog, entriesForScan, logCsvRows, logMarkdown, logView, rolledUpSentence } from '../../roadmap/activityLog.ts'
import type { ActivityLog } from '../../roadmap/activityLog.ts'
import { COMMS_PLAN, GROUNDING, PROMPTS, WATCH, BULLETIN } from '../../copy/comms.ts'
import { audiencesFor, bulletinsFor, commsPlanRows, monthlyWarnings, recipientRows } from '../../roadmap/comms.ts'
import type { Bulletin, CommsContext } from '../../roadmap/comms.ts'
import { groundingBundle, promptFor, promptPack, promptPackMarkdown, stepContext } from '../../roadmap/prompts.ts'
import { DEFAULT_REVERT_PERCENT, watchFor } from '../../roadmap/watch.ts'
import { CHANGE_RECORD_HEADER, changeRecordMarkdown as changeRecordMarkdownPure, changeRecordRows } from '../../roadmap/changeRecord.ts'
import type { StepEvent } from '../../roadmap/types.ts'
import { EXPORT_TAB, PROGRESS, SCHEDULE_TAB, TRACK } from '../../copy/progress.ts'
import { changesSince, groupGrowth, progressHeadline, stepProgress } from '../../roadmap/tracking.ts'
import { blockedSteps, trackableSteps } from '../../derive/sets.ts'
import { REDACTED, exportClipboard, exportDownload, exportPrint, unredactedFrom } from '../exportGuard.ts'
import { NAME_WARNING } from '../../copy/comms.ts'
import { initialDomain } from '../../validation/rules.ts'
import { activeWizardQuestions } from '../../mapping/wizard.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { savedStepOf } from '../../roadmap/progress.ts'
import type { Dependency } from '../../roadmap/schedule.ts'
import { POPULATION_CSV_HEADER, cohortsFor, populationContext, populationRows } from '../../roadmap/population.ts'
import { ringContextIndexes } from '../../roadmap/rings.ts'
import { adminUserIds } from '../../roles.ts'
import { EVIDENCE as EVIDENCE_COPY, NAMING, WHY, OPERATOR, PHASE_NAME, STEP_KIND_LABEL, WHY_NOW, STEP_STATUS_LABEL, affectedLine, stepKindLabel } from '../../copy/steps.ts'
import { NO_ANNOUNCEMENT } from '../../copy/announcements.ts'
import { planSummary } from '../../roadmap/summary.ts'
import { BANDS } from '../../roadmap/constants.ts'
import type { SizeBand } from '../../roadmap/constants.ts'
import type { ChangeFreeze, Schedule } from '../../roadmap/schedule.ts'
import { PrintPlan } from './PrintPlan.tsx'
import { absolute, absoluteDate, dateRange, relative, toCsv, when, whenAt } from '../format.ts'
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
  /**
   * Answers to the questions a short observation window cannot answer
   * (prompt 42 item 4), keyed by step id then unknown id. Stored with the date
   * they were given, because an assertion about a tenant is only as good as the
   * day it was made.
   */
  assertions?: Record<string, Record<string, { answer: 'yes' | 'no'; at: string; effect: 'carveOut' | 'laterWave' | 'accepted' }>>
  /** The automatic activity log (prompt 30 §3). */
  log?: ActivityLog
  /** The scan the log last recorded, so one scan is logged once. */
  loggedScanAt?: string
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
  const [skipDraft, setSkipDraft] = useState<SkipDraft | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  // The step opened in place on the Steps tab (prompt 26 §15).
  const [openStepId, setOpenStepId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  // Statuses at the previous render: a step that moved gets one flash (ux-review-07 §F3).
  const prevStatusRef = useRef<Record<string, StepStatus>>({})
  const [logFilter, setLogFilter] = useState<'all' | 'mine'>('all')
  const [bundleRedacted, setBundleRedacted] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  // Deep link #/roadmap/step/<id>: open the Steps tab with that step expanded.
  const linkedStepId = useHashStepId()
  const promptsLink = typeof window !== 'undefined' && /^#\/roadmap\/prompts/.test(window.location.hash)
  const [activeTab, setActiveTab] = useState<string>(promptsLink ? 'export' : 'plan')
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
      mapping: toCoverageMapping(mapping, questions, activeWizardQuestions(baseline.pkg, { snapshot, state: mapping })),
      facetOverrides: mapping.facetOverrides,
    })
    // Activity is measured against the scan, not the clock (prompt 37 §3).
    // Four surfaces asking `new Date()` at four moments is why a step header
    // could say "2 active" while the summary said 4 (T11), and why a count
    // could move on a tab switch with no re-scan (T4, T5).
    const viability = buildViabilityInputs(snapshot, snapshot.asOf).map(scoreMfaViability)
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
    })
    mergePersisted(steps, saved?.steps ?? null)
    applyProgress(steps, snapshot, coverage, planId, undefined, saved?.revisions?.[0]?.at ?? saved?.planCreatedAt ?? null)
    // State reasons read the tracking (the real enforcement date), so they come last.
    annotateStateReasons(steps)
    // And the blocker step's "N steps are held" is recomputed here, because
    // this is the first point where statuses are final. Generating it inside
    // generateRoadmap froze a count that mergePersisted and applyProgress then
    // moved, so the sentence said 14 while the tile beside it said 13
    // (review-08 A9, prompt 40 §9).
    refreshBlockerImpact(steps)
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
    // The automatic log (prompt 30 §3): each scan is recorded once, from what the scan itself noticed.
    let log = saved?.log ?? emptyLog()
    if (saved?.loggedScanAt !== snapshot.asOf) {
      log = appendLog(
        log,
        entriesForScan({ snapshot, steps: computed.steps, previous: saved?.checkpoints.at(-1) ?? null, planId, baselinePin: pin, previousBaselinePin: saved?.baselinePin ?? null, scanAt: snapshot.asOf, since: saved?.loggedScanAt ?? null }),
      )
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
      log,
      loggedScanAt: snapshot.asOf,
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
  // One summary, one set (prompt 37 §1): the Progress badge, the Steps done
  // tile, the Overview headline and the Plan chips all read `summary` now, so
  // they cannot disagree about what the denominator is.
  const tracked = trackableSteps(steps)
  const trackedDone = summary.done
  const done = steps.filter((s) => s.status === 'done')
  const safe = steps.filter((s) => s.safeToday)
  // The one blocked set (prompt 40 §9) — the tile, the attention callout and
  // the blocker step's "N held" all count over this.
  const blocked = blockedSteps(steps)
  const tenantName =
    ((snapshot.config.organization?.rows?.[0] ?? {}) as { displayName?: string }).displayName ?? 'This tenant'
  // C15: the organisation display name is often the tenant identifier. It looks
  // like one when it matches the initial onmicrosoft prefix, ignoring case,
  // spaces and punctuation.
  const tenantNameLooksLikeId = (() => {
    const initial = initialDomain(snapshot)?.split('.')[0] ?? null
    if (!initial) return false
    const flat = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '')
    return flat(tenantName) === flat(initial)
  })()

  const copy = async (id: string, text: string): Promise<void> => {
    if (!(await exportClipboard(text, REDACTED))) return
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  const setStart = (iso: string): void => {
    setSaved((p) => (p ? { ...p, startDate: iso } : p))
    setVersion((v) => v + 1)
  }
  const setBand = (next: SizeBand | null): void => {
    setSaved((p) => (p ? { ...p, band: next } : p))
    setVersion((v) => v + 1)
  }
  const setAssertion = (stepId: string, unknownId: string, answer: 'yes' | 'no', effect: 'carveOut' | 'laterWave' | 'accepted'): void => {
    const entry = { answer, at: new Date().toISOString(), effect }
    setSaved((prev) => {
      const base = prev ?? { planId, steps: {}, checkpoints: [] }
      const next = { ...base, assertions: { ...(base.assertions ?? {}), [stepId]: { ...(base.assertions?.[stepId] ?? {}), [unknownId]: entry } } }
      void savePlanRecord(snapshot.tenantId, next)
      return next
    })
    setVersion((v) => v + 1)
  }
  // The change freeze travels with the plan (roadmap-v2.md §2): the schedule moves around it.
  const setFreeze = (next: ChangeFreeze | null): void => {
    setSaved((p) => (p ? { ...p, freeze: next } : p))
    void savePlanRecord(snapshot.tenantId, { ...(saved ?? { planId, steps: {}, checkpoints: [] }), freeze: next })
    setVersion((v) => v + 1)
  }
  const waveTitle = (w: Schedule['waves'][number]) =>
    w.wave === 0 ? C.day0 : C.wave(w.wave, C.waveAreas(w.phases.map((p) => PHASE_NAME[p]).filter((n): n is string => Boolean(n))))
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
    exportDownload(`${step.id}-people.csv`, toCsv(POPULATION_CSV_HEADER, populationRows(step, populationCtx())), 'text/csv', REDACTED)
  }
  // Cohorts are built when a step opens (25,000 users are not bucketed for every step of every plan).
  const cohortsOf = (step: Step) => (step.populationView && step.populationView.mode !== 'names' ? cohortsFor(step.population.ids, populationCtx()) : [])
  /** At most ten names, then "and N more" (roadmap-v2.md §3: nothing renders unbounded). */
  const boundedNames = (ids: string[]): string => {
    // A name list holds names. An id the directory cannot resolve is counted at
    // the end rather than rendered as a phrase between two people (prompt 40
    // §12, review-08 A8).
    const named: string[] = []
    let unnamed = 0
    for (const id of ids.slice(0, 10)) {
      const name = computed.names.nameOf(id)
      if (name) named.push(name)
      else unnamed += 1
    }
    const parts = [...named]
    if (unnamed > 0) parts.push(POPULATION.andUnnamed(unnamed))
    if (ids.length > 10) parts.push(POPULATION.andMore(ids.length - 10))
    return parts.join(', ')
  }
  const stepById = new Map(steps.map((s) => [s.id, s]))

  const savePlan = (): void => {
    if (!mapping || !operator) return
    const summary = summarizeTenant(computed.viability)
    // Ids as well as the count: without them a later scan can say how many
    // arrived but never who (prompt 44 item 14).
    const exclusionGroups = [...groups.entries()].map(([groupId, g]) => ({ groupId, memberCount: g.memberCount, memberIds: g.memberIds ?? [] }))
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
      schedule: { startDate: startDate ?? schedule.start, band: band ?? undefined, freeze: saved?.freeze ?? null },
      revision: saved?.revision,
      revisions: saved?.revisions,
      log: saved?.log,
    })
    exportDownload(`iamai-plan-${snapshot.tenantId.slice(0, 8)}.json`, JSON.stringify(plan, null, 2), 'application/json', REDACTED)
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
    // Before anything is written. The only tenant check used to be on
    // plan.mappings, and it ran after savePlanRecord had already put the other
    // tenant's steps, checkpoints and log under this tenant's key (audit
    // token-01) — from where changesSince diffed this tenant's live policies
    // against the other one's checkpoint and reported them as deleted.
    const planTenantId = plan.tenant?.id || plan.mappings?.tenantId || ''
    if (!planTenantId) {
      window.alert?.(C.planTenantUnknown(tenantName))
      return
    }
    if (planTenantId !== snapshot.tenantId) {
      window.alert?.(C.planFromAnotherTenant(plan.tenant?.name ?? '', tenantName))
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
      freeze: plan.schedule?.freeze ?? null,
      revision: plan.revision,
      revisions: plan.revisions,
      stepIds: plan.steps.map((s) => s.id),
      baselinePin: plan.baselinePin,
      log: plan.log,
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
  const headline = progressHeadline(steps, schedule, undefined, saved?.planCreatedAt ?? saved?.revisions?.[0]?.at ?? null)
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
  const log = saved?.log ?? emptyLog()
  const logRows = logView(log, logFilter)
  const historySection = () => (
    <>
      <h4>{LOG.title}</h4>
      <p className="reason">{LOG.hint}</p>
      <div className="row no-print">
        <FilterChip selected={logFilter === 'all'} onToggle={() => setLogFilter('all')}>
          {LOG.filterAll}
        </FilterChip>
        <FilterChip selected={logFilter === 'mine'} onToggle={() => setLogFilter('mine')}>
          {LOG.filterMine}
        </FilterChip>
        <Button size="sm" icon="download" onClick={() => exportDownload(`iamai-history-${snapshot.tenantId.slice(0, 8)}.csv`, toCsv([LOG.columns.when, LOG.columns.what, LOG.columns.step, LOG.columns.detected, LOG.columns.planned], logCsvRows(logRows)), 'text/csv', REDACTED)}>
          {LOG.exportCsv}
        </Button>
        <Button size="sm" icon="download" onClick={() => exportDownload(`iamai-history-${snapshot.tenantId.slice(0, 8)}.md`, logMarkdown(logRows, `${LOG.title}: ${tenantName}`), 'text/markdown', REDACTED)}>
          {LOG.exportMd}
        </Button>
      </div>
      {logRows.length === 0 && <p className="reason">{LOG.empty}</p>}
      {logRows.length > 0 && (
        <ul className="sections history-list">
          {logRows.slice(0, 200).map((e, i) => (
            <li key={i}>
              <span className="reason">{absoluteDate(e.at)}</span> ·{' '}
              {e.stepId && stepById.get(e.stepId) ? (
                <a href={stepHref(e.stepId)} onClick={(ev) => { ev.preventDefault(); setActiveTab('plan'); setOpenStepId(e.stepId!) }}>{e.what}</a>
              ) : (
                e.what
              )}{' '}
              <Chip status={e.planned ? 'done' : 'warning'}>{e.planned ? LOG.planned : LOG.unplanned}</Chip> <span className="reason">{LOG.detected[e.detectedBy]}</span>
            </li>
          ))}
        </ul>
      )}
      {rolledUpSentence(log) && <p className="reason">{rolledUpSentence(log)}</p>}
    </>
  )
  const progressTab = () => (
    <div>
      {overview()}
      <div className="overview-band">
        {/* Must-fix validation reads first (validation-rules.md §2). */}
        {headline.blockers && <p className="overview-blockers">{headline.blockers}</p>}
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
              <th scope="col">{SCHEDULE_TAB.colStep}</th>
              <th scope="col">{PROGRESS.colPlanned}</th>
              <th scope="col">{PROGRESS.colActual}</th>
              <th scope="col">{PROGRESS.colSlip}</th>
              {anySlipReason && <th scope="col">{PROGRESS.colWhy}</th>}
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
      {/*
        The whole section waits for a checkpoint (prompt 40 §22). It used to
        render its heading and then a line explaining that it cannot work yet,
        which is a section whose only content is its own unavailability
        (review-08 C3). There is nothing to compare against until a scan has
        been saved, so there is nothing to show.
      */}
      {/* Exclusion drift (prompt 44 Part 3). A group that quietly grows is the
          one change nothing else in the tenant reports. */}
      {[...driftItems, ...directDrift].length > 0 && (
        <>
          <h4>{DRIFT.title}</h4>
          <ul className="sections">
            {[...driftItems, ...directDrift].map((d) => (
              <li key={d.kind + d.id}>
                <Chip status={d.finding ? 'warning' : 'neutral'}>{d.finding ? SECTION.applies.yes : SECTION.applies.unknown}</Chip> {d.sentence}
                {d.detail && <div className="sub">{d.detail}</div>}
                {d.finding && <div className="sub">{DRIFT.change}</div>}
              </li>
            ))}
          </ul>
        </>
      )}

      {lastCheckpoint && <h4>{PROGRESS.changesTitle}</h4>}
      {lastCheckpoint && changes.length === 0 && <p className="reason">{PROGRESS.changesNone}</p>}
      {lastCheckpoint && changes.length > 0 && (
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
      {historySection()}
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
  const exportIcs = (): void => exportDownload(`iamai-plan-${snapshot.tenantId.slice(0, 8)}.ics`, buildIcs(steps, tenantName, planId, watchThreshold), 'text/calendar', REDACTED)
  const weekView = () => {
    const weekKeyOf = (iso: string): string => {
      const d = new Date(iso)
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
      return d.toISOString().slice(0, 10)
    }
    // The calendar shows one bulletin per audience per week, not one row per
    // step (prompt 37 §14, comms-and-bridges.md §1.2). The bundling rules were
    // already implemented and already used by the plan table below; the grid
    // simply read the per-step events instead, which is how fifteen changes
    // became fifteen announcements in one Wednesday cell (S1) and how the same
    // fifteen reappeared twice more as reminders (S2). Enforcement stays
    // per-step, because each change really does take effect on its own day.
    type Cell = { key: string; time: string; label: string; reason: string; out: boolean; stepId: string }
    const cellsOf = (kind: 'announce' | 'remind' | 'enforce'): Cell[] => {
      if (kind === 'enforce') {
        // Bundled by day and audience, not one cell entry per step (prompt 40
        // §16). Prompt 37 bundled the announce and remind rows and left this
        // one per-step on the reasoning that "each change really does take
        // effect on its own day" — which is true of the change and false of the
        // cell, because the scheduler puts many changes on one day at one
        // rhythm-derived hour. The live site showed twenty-one entries stacked
        // in a single 12:00 cell (review-08 B1).
        const groups = new Map<string, { at: string; time: string; audience: string; kind: string; steps: Step[]; out: boolean }>()
        for (const { step: st, e } of allEvents) {
          if (e.kind !== 'enforce') continue
          const audience = audiencesFor(st, commsCtx).find((a) => a.kind !== 'none')?.label ?? WEEK_VIEW.everyone
          // The class is part of the key: two windows for one audience on one day
          // are two windows, and the label says which (prompt 42 §14).
          const kind = batchClassOf(st)
          const key = `${e.at.slice(0, 10)}|${audience}|${kind}`
          const g = groups.get(key)
          if (g) {
            g.steps.push(st)
            g.out = g.out || e.outOfHours
          } else {
            groups.set(key, { at: e.at, time: e.time, audience, kind, steps: [st], out: e.outOfHours })
          }
        }
        return [...groups.entries()].map(([key, g]) => ({
          key: `enforce-${key}`,
          time: g.time,
          label: g.steps.length === 1 ? g.steps[0].plainTitle : WEEK_VIEW.enforceBundle(g.audience, g.steps.length, WEEK_VIEW.batchKind[g.kind] ?? null),
          reason: g.steps.map((st) => st.plainTitle).join('; '),
          out: g.out,
          stepId: g.steps[0].id,
          at: g.at,
        })) as Cell[]
      }
      // One reminder per bulletin, never one per step (§15).
      return bulletins
        .map((b) => ({ b, at: kind === 'announce' ? b.sendAt : b.remindAt }))
        .filter((x): x is { b: Bulletin; at: string } => x.at !== null)
        .map(({ b, at }) => ({
          key: `${b.id}-${kind}`,
          time: at.slice(11, 16),
          label: WEEK_VIEW.bulletin(b.audience.label, b.steps.length),
          reason: b.subject,
          out: false,
          stepId: b.steps[0]?.stepId ?? '',
          at,
        }))
        .map(({ at, ...c }) => ({ ...c, at })) as Cell[]
    }
    const atOf = (c: Cell & { at?: string }, kind: string): string =>
      c.at ?? allEvents.find(({ step: st, e }) => `${st.id}-${kind}` === c.key && e.kind === kind)?.e.at ?? ''
    const rowsData = (['announce', 'remind', 'enforce'] as const).map((kind) => ({
      kind,
      cells: cellsOf(kind).map((c) => ({ ...c, at: atOf(c as Cell & { at?: string }, kind) })),
    }))
    const weeks = [...new Set(rowsData.flatMap((r) => r.cells.map((c) => weekKeyOf(c.at))))].filter(Boolean).sort()
    if (weeks.length === 0) return <p className="reason">{WEEK_VIEW.nothing}</p>
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    return (
      <div className="week-view">
        {weeks.map((wk) => {
          const dayOf = (at: string): string => DAYS[(new Date(at).getUTCDay() + 6) % 7]
          // All three rows, every week, with the empty ones saying so
          // (prompt 42 §13, review-09 finding 12).
          //
          // Prompt 37 §16 dropped empty rows because a blank row read as a
          // missing event. It does, but so does an absent one: a week showing
          // Announce and Enforce and no Remind row reads as an oversight rather
          // than as "nothing needed reminding about this week". The fix for a
          // blank cell is words in it, not a missing row.
          const weekRows = rowsData.map((r) => ({ ...r, cells: r.cells.filter((c) => weekKeyOf(c.at) === wk) }))
          if (weekRows.every((r) => r.cells.length === 0)) return null
          const outOfHours = weekRows.flatMap((r) => r.cells).filter((c) => c.out).length
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
                      <th scope="col" />
                      {DAYS.map((d) => (
                        <th key={d} scope="col">{d.slice(0, 3)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weekRows.map((r) => (
                      <tr key={r.kind} className={r.cells.length === 0 ? 'is-quiet' : ''}>
                        <th scope="col">{WEEK_VIEW.rows[r.kind]}</th>
                        {r.cells.length === 0 && (
                          <td colSpan={DAYS.length} className="reason">
                            {WEEK_VIEW.noneNeeded[r.kind]}
                          </td>
                        )}
                        {r.cells.length > 0 && DAYS.map((d) => (
                          <td key={d}>
                            {r.cells
                              .filter((c) => dayOf(c.at) === d)
                              .map((c) => (
                                <a key={c.key} className={`week-event ${c.out ? 'is-out' : ''}`} href={stepHref(c.stepId)} title={c.reason} onClick={(ev) => { ev.preventDefault(); setActiveTab('plan'); setOpenStepId(c.stepId) }}>
                                  <span className="mono">{c.time}</span> {c.label}
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
      {/* Past the length this planner is for, say what would bring it in
          (prompt 43 item 5). Named steps, never a category. */}
      {longPlan.over && longPlan.remedies.length > 0 && (
        <div className="card overrun">
          <h4>{OVERRUN.title}</h4>
          <p className="reason">{OVERRUN.lead(longPlan.weeks, LONG_PLAN_WEEKS)}</p>
          <ul className="sections">
            {longPlan.remedies.map((r, i) => (
              <li key={i}>
                {r.kind === 'defer'
                    ? OVERRUN.defer(
                        r.stepIds.map((id) => stepById.get(id)?.plainTitle || stepById.get(id)?.title || id),
                        r.weeks,
                      )
                    : OVERRUN.readiness(r.people, r.weeks)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {schedule.rhythm && (
        <p className="reason">
          <strong>{RHYTHM.title}.</strong> {schedule.rhythm.sentence}
        </p>
      )}
      <h4>{WEEK_VIEW.title}</h4>
      <p className="reason">{WEEK_VIEW.hint}</p>
      {weekView()}
      {timeline()}
      <h4>{COMMS_PLAN.title}</h4>
      <p className="reason">{COMMS_PLAN.hint}</p>
      {commsWarnings.map((w, i) => (
        <Callout key={i} kind="warning">
          {w}
        </Callout>
      ))}
      {commsRows.length === 0 && <p className="reason">{COMMS_PLAN.empty}</p>}
      {commsRows.length > 0 && (
        <div className="table-scroll">
          <table className="cohort-table progress-table comms-table">
            <thead>
              <tr>
                <th scope="col">{COMMS_PLAN.columns.date}</th>
                <th scope="col">{COMMS_PLAN.columns.time}</th>
                <th scope="col">{COMMS_PLAN.columns.audience}</th>
                <th scope="col">{COMMS_PLAN.columns.channel}</th>
                <th scope="col">{COMMS_PLAN.columns.subject}</th>
                <th scope="col">{COMMS_PLAN.columns.steps}</th>
              </tr>
            </thead>
            <tbody>
              {commsRows.map((r, i) => (
                <tr key={i}>
                  <td>{absoluteDate(r.at)}</td>
                  <td className="mono">{new Date(r.at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: commsCtx.timeZone })}</td>
                  <td>{r.audience}</td>
                  <td className="reason">{r.channels}</td>
                  <td>
                    <a href={`#bulletin-${r.bulletinId}`} onClick={(e) => { e.preventDefault(); document.getElementById(`bulletin-${r.bulletinId}`)?.scrollIntoView({ block: 'start' }) }}>{r.subject}</a>{' '}
                    <span className="reason">({COMMS_PLAN.kind[r.kind]})</span>
                  </td>
                  <td className="reason">{r.steps.join('; ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {bulletins.map((b) => (
        <BulletinCard key={b.id} b={b} ctx={commsCtx} copied={copied} onCopy={copy} onPrompt={(id, kind, context, draft) => void copyPrompt(id, kind, context, draft)} />
      ))}
      <h4>{SCHEDULE_TAB.ownersTitle}</h4>
      <div className="table-scroll">
        <table className="cohort-table progress-table">
          <thead>
            <tr>
              <th scope="col">{SCHEDULE_TAB.colStep}</th>
              <th scope="col">{SCHEDULE_TAB.colStart}</th>
              <th scope="col">{SCHEDULE_TAB.colEnd}</th>
              <th scope="col">{SCHEDULE_TAB.colRing}</th>
            </tr>
          </thead>
          <tbody>
            {work.map((st) => (
              <tr key={st.id}>
                <td>
                  <a href={stepHref(st.id)} onClick={(e) => { e.preventDefault(); setActiveTab('plan'); setOpenStepId(st.id) }}>{st.title}</a>
                </td>
                <td>{st.rings[0]?.plannedStart ? absoluteDate(st.rings[0].plannedStart) : SCHEDULE_TAB.unscheduled}</td>
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
              <Button size="sm" variant="tertiary" onClick={() => setBand(null)}>
                {C.bandReset}
              </Button>
            )}
          </div>
          <p className="reason">
            {schedule.bandSource === 'auto' ? C.bandAuto(schedule.activeUsers, C.bands[schedule.band].label) : C.bandOverride(schedule.activeUsers, C.bands[schedule.band].label)} ·{' '}
            {C.expected(BANDS[schedule.band].weeks)}
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
              <Button size="sm" variant="tertiary" onClick={() => setFreeze(null)}>
                {CALENDAR.freezeClear}
              </Button>
            )}
            <InfoTip title={CALENDAR.freezeLabel} text={CALENDAR.freezeHint} />
          </div>
          {schedule.freeze && <p className="reason">{CALENDAR.freeze(absoluteDate(schedule.freeze.from), absoluteDate(schedule.freeze.to))}</p>}
          <p className="reason">
            {CALENDAR.noFriday} {CALENDAR.weeklyCap(schedule.enforcementCap)}
          </p>
        </Card>
    </div>
  )

  // ---- Export (§8): the plan file, the document, the change record, markdown ----
  // The change record (ux-review-07 §32, prompt 30 §1): one row per step, as a Markdown table or a CSV; pure so the export is tested.
  const recordRows = () => changeRecordRows(steps, schedule, snapshot, nameOf, watchThreshold)
  const changeRecordMarkdown = (): string => changeRecordMarkdownPure(recordRows(), tenantName, planId, saved?.revision ?? 1)
  const changeRecordCsv = (): string => toCsv(CHANGE_RECORD_HEADER, recordRows())
  const exportTab = () => (
    <div className="export-grid">
      <Card title={RECOVERY.title}>
        <p className="reason">{RECOVERY.does}</p>
        <p>
          <a href="#/recovery">{RECOVERY.action}</a>
        </p>
      </Card>
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
        <Button icon="copy" onClick={() => void copyPrompt('plan-md', 'wholePlan', schedule.derivation.criticalPath, planMarkdown(tenantName, steps, schedule, dangers, nameOf))}>
          {copied === 'plan-md:prompt' ? C.copied : COMMS_PLAN.copyPrompt}
        </Button>
      </p>
      </Card>
      <Card title={EXPORT_TAB.changeRecord}>
        <p className="reason">{EXPORT_TAB.changeRecordText}</p>
        <p className="row no-print">
          <Button icon="download" onClick={() => exportDownload(`iamai-change-record-${snapshot.tenantId.slice(0, 8)}.md`, changeRecordMarkdown(), 'text/markdown', REDACTED)}>
            {EXPORT_TAB.downloadChangeRecord}
          </Button>
          <Button icon="download" onClick={() => exportDownload(`iamai-change-record-${snapshot.tenantId.slice(0, 8)}.csv`, changeRecordCsv(), 'text/csv', REDACTED)}>
            {EXPORT_TAB.downloadChangeRecordCsv}
          </Button>
          <Button icon="copy" onClick={() => void copyPrompt('change-record', 'changeRecord', overviewText, changeRecordMarkdown())}>
            {copied === 'change-record:prompt' ? C.copied : COMMS_PLAN.copyPrompt}
          </Button>
        </p>
      </Card>
      <Card title={PROMPTS.title} className="prompt-pack" id="prompt-pack">
        <p className="reason">{PROMPTS.intro}</p>
        <ul className="sections">
          {promptPack({ tenant: tenantName, steps, schedule, changeRecord: changeRecordMarkdown(), planSummary: `${overviewText} ${schedule.derivation.criticalPath}`, announcement: bulletins[0]?.channels.email ?? steps.find((st) => st.comms && st.comms !== NO_ANNOUNCEMENT)?.comms ?? null }).map((it, i) => (
            <li key={i} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{it.title}</span>
              <Button size="sm" icon="copy" onClick={() => void copy(`pack-${i}`, it.prompt)}>
                {copied === `pack-${i}` ? C.copied : PROMPTS.copy}
              </Button>
            </li>
          ))}
        </ul>
        <p className="row no-print">
          <Button icon="download" onClick={() => exportDownload(`iamai-prompts-${snapshot.tenantId.slice(0, 8)}.md`, promptPackMarkdown(promptPack({ tenant: tenantName, steps, schedule, changeRecord: changeRecordMarkdown(), planSummary: `${overviewText} ${schedule.derivation.criticalPath}`, announcement: bulletins[0]?.channels.email ?? null }), tenantName), 'text/markdown', REDACTED)}>
            {PROMPTS.downloadAll}
          </Button>
        </p>
      </Card>
      <Card title={GROUNDING.title}>
        <p className="reason">{GROUNDING.text}</p>
        {/* C19: the warning sits above the checkbox that enables it, so it is
            read before the choice rather than after it. */}
        <Callout kind="warning">{GROUNDING.warning}</Callout>
        <p className="row no-print">
          <label>
            <input type="checkbox" checked={!bundleRedacted} onChange={(e) => setBundleRedacted(!e.currentTarget.checked)} /> {GROUNDING.unredacted}
          </label>
        </p>
        <p className="row no-print">
          <Button icon="download" onClick={() => exportDownload(`iamai-bundle-${snapshot.tenantId.slice(0, 8)}${bundleRedacted ? '-redacted' : ''}.json`, JSON.stringify(groundingBundle({ tenant: tenantName, snapshot, coverage: computed.coverage, steps, schedule, redacted: bundleRedacted, generated: absoluteDate(new Date().toISOString()) }), null, 2), 'application/json', bundleRedacted ? REDACTED : unredactedFrom('grounding-bundle'))}>
            {GROUNDING.download}
          </Button>
          <span className="reason">{bundleRedacted ? GROUNDING.redacted : GROUNDING.unredacted}</span>
        </p>
      </Card>
      <Card title={EXPORT_TAB.pdf}>
        <p className="reason">{EXPORT_TAB.pdfText}</p>
        <p className="row no-print">
          <Button icon="print" onClick={() => exportPrint(unredactedFrom('print-document'))}>
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
          {stepKindLabel(st)}
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
    /**
     * One segment per phase and per window, in date order, sized by duration.
     * A window has no steps, so its tone comes from the calendar rather than
     * from progress: past, running now, or still ahead.
     */
    type Segment = { key: string; anchor: string; label: string; title: string; days: number; tone: string }
    const windowTone = (w: { start: string; end: string }): string =>
      Date.parse(w.end) <= Date.now() ? 'is-done' : Date.parse(w.start) <= Date.now() ? 'is-partial' : 'is-future'
    const segments: Segment[] = [
      ...waves.map((w) => {
        const all = phaseSteps(w)
        const doneN = all.filter((st) => st.status === 'done').length
        return {
          key: `wave-${w.wave}`,
          anchor: `phase-${w.wave}`,
          label: waveTitle(w),
          title: `${waveTitle(w)} · ${C.phaseProgress(doneN, all.length)}`,
          days: Math.max(1, w.days),
          start: w.start,
          tone: doneN === all.length ? 'is-done' : doneN > 0 ? 'is-partial' : Date.parse(w.start) > Date.now() ? 'is-future' : '',
        }
      }),
      ...(schedule.verification.days > 0
        ? [{
            key: 'window-verification',
            anchor: 'window-verification',
            label: C.minimapRegistration,
            title: C.verificationWindow(schedule.verification.days),
            days: Math.max(1, schedule.verification.days),
            start: schedule.verification.start,
            tone: windowTone(schedule.verification),
          }]
        : []),
      ...(schedule.observation.days > 0
        ? [{
            key: 'window-observation',
            anchor: 'window-observation',
            label: C.minimapObservation,
            title: C.observation(schedule.observation.days),
            days: Math.max(1, schedule.observation.days),
            start: schedule.observation.start,
            tone: windowTone(schedule.observation),
          }]
        : []),
    ]
      .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
      .map(({ start: _start, ...seg }) => seg)
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
        {/*
          Mini-map: every phase AND every window in the plan, each sized by its
          own duration, today marked (§10, prompt 40 §19). It used to iterate
          waves alone, so a plan whose first five weeks are the registration and
          observation windows drew two segments and left those five weeks off
          the bar entirely (review-08 B2). The windows are real elapsed time
          with their own cards, so they are segments like any other.
        */}
        <div className="minimap no-print" aria-label={C.tabs.schedule}>
          {segments.map((seg) => (
            <a
              key={seg.key}
              href={`#${seg.anchor}`}
              className={`minimap-seg ${seg.tone}`}
              style={{ flexGrow: seg.days }}
              title={seg.title}
              onClick={(e) => { e.preventDefault(); document.getElementById(seg.anchor)?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }}
            >
              <span className="minimap-label">{seg.label}</span>
            </a>
          ))}
          <span className="minimap-today" style={{ left: `${todayPct}%` }} title={C.minimapToday} />
        </div>
        <p className="reason">
          {rationale}
          {completedCount > 0 && (
            <>
              {' '}
              {!showCompleted && C.completedHidden(completedCount)}{' '}
              <Button size="sm" variant="tertiary" onClick={() => setShowCompleted((v) => !v)}>
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
              {w.wave === 0 && schedule.verification.days > 0 && windowCard('window-verification', C.verificationWindow(schedule.verification.days), C.verificationText(rollout.toSetUp, rollout.active), schedule.verification)}
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
              <a href={d.link.url} target="_blank" rel="noopener noreferrer">
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
            <Button size="sm" variant="tertiary" onClick={() => setShowCompleted((v) => !v)}>
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
                        audienceName={tenantNameLooksLikeId ? tenantName : null}
                        step={step}
                        linked
                        stepById={stepById}
                        nameOf={nameOf}
                        copied={copied}
                        onCopy={copy}
                        skipDraft={skipDraft}
                        schedule={schedule}
                        waitsOn={(schedule.graph[step.id] ?? [])
                          .filter((d) => d.kind === 'hard')
                          .map((d) => stepById.get(d.stepId))
                          .filter((x): x is Step => x !== undefined && x.status !== 'done' && x.status !== 'skipped')}
                        dependents={steps.filter(
                          (x) => (schedule.graph[x.id] ?? []).some((d) => d.kind === 'hard' && d.stepId === step.id) && x.status !== 'done' && x.status !== 'skipped',
                        )}
                        setSkipDraft={setSkipDraft}
                        onExportPopulation={exportPopulation}
                        cohortsOf={cohortsOf}
                        boundedNames={boundedNames}
                        dependencies={schedule.graph[step.id] ?? []}
                        onPrompt={(id, kind, context, draft) => void copyPrompt(id, kind, context, draft)}
                        watch={watchFor(step, snapshot, nameOf, watchThreshold)}
                        snapshotForApps={snapshot}
                        assertions={saved?.assertions?.[step.id] ?? {}}
                        onAssert={setAssertion}
                        now={nowMs}
                        batchWith={schedule.batchWith[step.id] ?? []}
                        verdict={verdictFor(step, snapshot, new Date(nowMs).toISOString(), operator?.userId ?? null)}
                        preflight={preflightFor(
                          [step, ...(schedule.batchWith[step.id] ?? []).map((id) => stepById.get(id)).filter((x): x is Step => x !== undefined)],
                          operator?.userId ?? null,
                          snapshot,
                          mapping?.allowedCountries ?? [],
                        )}
                        tenantId={snapshot.tenantId}
                        onSkipped={(st) => {
                          // Persist the skip before regenerating, or mergePersisted forgets it.
                          //
                          // The previous record is spread first. Replacing it
                          // outright dropped scheduledDate, tracking, ringActuals
                          // and currentRing, so skipping a step and putting it
                          // back lost a hand-set date and the execution history
                          // that went with it. saveStepMeta beside this has
                          // always spread; this one did not.
                          setSaved((p) =>
                            p
                              ? {
                                  ...p,
                                  steps: {
                                    ...p.steps,
                                    [st.id]: { ...(p.steps[st.id] ?? {}), status: st.status, history: st.history, skipReason: st.skipReason },
                                  },
                                }
                              : p,
                          )
                          setVersion((v) => v + 1)
                        }}
                      />
                      <p className="no-print">
                        <Button size="sm" variant="tertiary" onClick={() => setOpenStepId(null)}>
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

  // ---- Do this next (prompt 30 §2): the front door ----
  const previousStatuses = saved?.steps ? Object.fromEntries(Object.entries(saved.steps).map(([id, v]) => [id, v.status])) : null
  const nextCard = doThisNext(steps, schedule, computed.viability, nameOf, previousStatuses, new Date().toISOString())

  // ---- Communications as a plan (comms-and-bridges.md §1) ----
  const userById = new Map(snapshot.users.map((u) => [u.id, u]))
  const commsCtx: CommsContext = {
    enabledUsers: snapshot.users.filter((u) => u.accountEnabled !== false).length,
    adminIds: adminUserIds(snapshot.roles),
    guestIds: new Set(snapshot.users.filter((u) => u.userType === 'guest').map((u) => u.id)),
    departmentOf: new Map(snapshot.users.filter((u) => u.department).map((u) => [u.id, u.department as string])),
    nameOf,
    upnOf: (id) => userById.get(id)?.userPrincipalName ?? null,
    tenantName,
    timeZone: mapping?.displayTimeZone ?? 'UTC',
  }
  const bulletins = bulletinsFor(steps, commsCtx)
  const commsRows = commsPlanRows(bulletins)
  const commsWarnings = monthlyWarnings(bulletins)
  // Groups any policy actually excludes. A normal group growing is not a
  // security event; one that undoes a policy is.
  const excludedGroupIds = new Set(
    ((snapshot.config.caPolicies?.rows ?? []) as { conditions?: { users?: { excludeGroups?: string[] } } }[]).flatMap((p) => p.conditions?.users?.excludeGroups ?? []),
  )
  // What changed in the exclusion groups since the last checkpoint.
  const driftItems = exclusionDrift({
    previous: lastCheckpoint ?? null,
    current: [...groups.entries()].map(([groupId, g]) => ({ groupId, name: g.displayName ?? groupId, memberCount: g.memberCount, memberIds: g.memberIds })),
    usedAsExclusion: excludedGroupIds,
    nominated: mapping?.breakGlassUserIds.length ?? 0,
    nameOf,
  })
  // A policy that names accounts directly is worse than a group, not better:
  // one never appears in a group review (prompt 44 item 15).
  const directDrift = directExclusionDrift({
    previous: lastCheckpoint ? new Map(lastCheckpoint.tenantPolicies.map((t) => [t.id, 0])) : null,
    current: ((snapshot.config.caPolicies?.rows ?? []) as { id?: string; displayName?: string; conditions?: { users?: { excludeUsers?: string[] } } }[]).map((p) => ({
      policyId: String(p.id ?? ''),
      policyName: String(p.displayName ?? ''),
      excludedCount: (p.conditions?.users?.excludeUsers ?? []).length,
    })),
    since: lastCheckpoint?.at ?? schedule.start,
  })
  // Only runs when the plan is actually over the bound; it re-schedules copies.
  const longPlan = overrunFor(
    steps,
    schedule.start,
    schedule.activeUsers,
    schedule.bandSource === 'override' ? schedule.band : null,
    { freeze: schedule.freeze, rhythm: schedule.rhythm ?? null },
    schedule.weeks,
  )
  const watchThreshold = DEFAULT_REVERT_PERCENT
  const copyPrompt = (id: string, kind: Parameters<typeof promptFor>[0], context: string, draft: string): Promise<void> => copy(`${id}:prompt`, promptFor(kind, tenantName, context, draft))

  // ---- Licence awareness (§3.4): what this tenant's licence makes available ----
  const caps = snapshot.capabilities
  const tier = caps.entraP2?.enabled ? LICENCE_HEADER.tier.p2 : caps.entraP1?.enabled ? LICENCE_HEADER.tier.p1 : LICENCE_HEADER.tier.free
  const unavailable = computed.coverage.results.filter((r) => r.status === 'licence-limited')
  const neededTiers = [...new Set(unavailable.map((r) => r.goal.implementations[0]?.tier ?? ''))].filter(Boolean).map((t) => LICENCE_HEADER.tierName(t)).join(' or ')
  const licenceSentence = LICENCE_HEADER.sentence(tier, tracked.length, tracked.length + unavailable.length, unavailable.length, neededTiers)
  // Without Entra ID P1 the plan is the free hardening ladder, so say what the plan is (SPEC §12).
  const onLadder = steps.some((s) => s.id.startsWith('s-ladder-'))

  return (
    <StepFrame title={C.title} does={C.does} needs={needs}>
      {scan && <ScanAge at={scan.at} baseline={baseline?.source ?? null} />}
      <p className="reason">{licenceSentence}</p>
      {/* Reachable from the header as well as the Export tab (prompt 44 item 10):
          the moment somebody needs it, they are not browsing tabs. */}
      <p className="row no-print">
        <a href="#/recovery">{RECOVERY.action}</a>
      </p>
      {onLadder && <p className="advisor">{LADDER.intro}</p>}
      <Card title={NEXT.title} className="do-next">
        {/* R12 moved "Watch first" out of a tab of its own and onto this card.
            It then led the card, pushing the three actions the card exists for
            below the fold (review-09 finding 9, prompt 41 §14). A card called
            "Do this next" opens with what to do; the danger areas follow it,
            still on the same screen and still before the reader leaves. */}
        {nextCard.completed.length > 0 && (
          <p className="completed-lead">
            {nextCard.completed.length === 1 ? NEXT.completed(nextCard.completed[0]) : NEXT.completedMany(nextCard.completed.length)} {nextCard.items.length > 0 && NEXT.next}
          </p>
        )}
        {nextCard.waiting && <p>{nextCard.waiting}</p>}
        {nextCard.items.length > 0 && (
          <ol className="next-list">
            {nextCard.items.map((item) => (
              <li key={item.stepId} className="next-item">
                <div>
                  <strong>{item.title}</strong>
                  {/* C5: "nobody" is not a quantity of people. When a step
                      touches no one the "why" already says so, and appending
                      "· nobody" reads as a value in a list of counts. */}
                  <div className="sub">
                    {item.why}
                    {item.touches !== NEXT.touches.nobody && ` · ${item.touches}`}
                  </div>
                </div>
                <div className="row">
                  <Button size="sm" variant="primary" onClick={() => { setSafeOnly(false); setStatusFilter(new Set()); setActiveTab('plan'); setOpenStepId(item.stepId) }}>
                    {NEXT.open}
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
        {dangers.length > 0 && dangerAreas()}
      </Card>
      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        // Plan, Schedule, Export (R12, R13). Progress was a tab that restated
        // the Plan tab's own header; it is that header line now. Watch first
        // held a single item, which belongs at the top of Do this next, where
        // the reader already is.
        tabs={[
          {
            id: 'plan',
            label: C.tabs.plan,
            badge: `${trackedDone}/${tracked.length}`,
            render: () => (
              <>
                {progressTab()}
                {stepsView()}
              </>
            ),
          },
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
        comms={commsRows.map((r) => ({ at: r.at, audience: r.audience, channels: r.channels, subject: r.subject, steps: r.steps }))}
        steps={steps}
        schedule={schedule}
        verificationNote={C.verificationText(rollout.toSetUp, rollout.active)}
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
      lines.push(`- [${s.status === 'done' ? 'x' : ' '}] **${s.title}** (${stepKindLabel(s)}). ${s.impact}`)
      if (s.highCare.userIds.length > 0) lines.push(`  - ${C.markdown.care(s.highCare.userIds.slice(0, 10).map(nameOf).join(', ') + (s.highCare.userIds.length > 10 ? ` ${POPULATION.andMore(s.highCare.userIds.length - 10)}` : ''))}`)
      if (s.status === 'blocked') lines.push(`  - ${C.markdown.blocked(s.unblockNotes.join('; '))}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

/** One message the plan will send (comms-and-bridges.md §1.3): channels, recipients, copy and copy-as-prompt. */
function BulletinCard({ b, ctx, copied, onCopy, onPrompt }: { b: Bulletin; ctx: CommsContext; copied: string | null; onCopy: (id: string, text: string) => Promise<void>; onPrompt: (id: string, kind: 'announcement' | 'reminder', context: string, draft: string) => void }) {
  const [channel, setChannel] = useState<'email' | 'teams' | 'helpdesk' | 'portal' | 'reminder'>('email')
  const text = channel === 'reminder' ? b.reminder : b.channels[channel]
  const context = `${b.audience.label}; ${b.steps.map((s) => `${s.plainTitle} on ${s.enforceDay} ${absoluteDate(s.enforceAt)} ${s.enforceTime}`).join('; ')}`
  return (
    <details className="card bulletin" id={`bulletin-${b.id}`}>
      <summary>
        <strong>{b.subject}</strong> <span className="reason">· {b.audience.label} · {absoluteDate(b.sendAt)}{b.kind === 'solo' ? ` · ${COMMS_PLAN.solo}` : ''}</span>
      </summary>
      <p className="row no-print">
        {(['email', 'teams', 'helpdesk', 'portal'] as const).map((c) => (
          <FilterChip key={c} selected={channel === c} onToggle={() => setChannel(c)}>
            {BULLETIN.channels[c]}
          </FilterChip>
        ))}
        {b.remindAt && (
          <FilterChip selected={channel === 'reminder'} onToggle={() => setChannel('reminder')}>
            {EVENT_LABEL.remind}
          </FilterChip>
        )}
      </p>
      <pre className="code-block" style={{ whiteSpace: 'pre-wrap' }}>
        {text}
      </pre>
      <p className="row no-print">
        <Button size="sm" icon="copy" onClick={() => void onCopy(`${b.id}:${channel}`, text)}>
          {copied === `${b.id}:${channel}` ? COMMS_PLAN.copied : COMMS_PLAN.copy}
        </Button>
        <Button size="sm" icon="copy" onClick={() => onPrompt(`${b.id}:${channel}`, channel === 'reminder' ? 'reminder' : 'announcement', context, text)}>
          {copied === `${b.id}:${channel}:prompt` ? COMMS_PLAN.copied : COMMS_PLAN.copyPrompt}
        </Button>
        {(b.audience.kind === 'segment' || b.audience.kind === 'named') && b.recipients.length > 0 && (
          <>
            <Button size="sm" icon="copy" onClick={() => void onCopy(`${b.id}:recipients`, b.recipients.map((id) => ctx.upnOf(id) ?? ctx.nameOf(id)).join('; '))}>
              {copied === `${b.id}:recipients` ? COMMS_PLAN.copied : COMMS_PLAN.copyRecipients}
            </Button>
            <Button size="sm" icon="download" onClick={() => exportDownload(`recipients-${b.id}.csv`, toCsv(['Name', 'Sign-in name', 'Department'], recipientRows(b, ctx)), 'text/csv', REDACTED)}>
              {COMMS_PLAN.recipientsCsv}
            </Button>
            <span className="reason">{COMMS_PLAN.recipientsNote}</span>
          </>
        )}
      </p>
    </details>
  )
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

/**
 * When to send this step's message, in one sentence above the draft
 * (prompt 41 §3).
 *
 * Reads the step's own events rather than recomputing a notice period, so the
 * sentence and the calendar cannot disagree. `noticeDays` is 0 exactly when the
 * step needs no announcement, which is what the "none" branch reports.
 */
function noticeLine(step: Step, nowMs: number): string {
  const e = step.events
  if (!e || !e.announce || e.noticeDays === 0) return NOTICE_LINE.none
  const send = `${e.announce.day} ${e.announce.date}`
  if (Date.parse(e.announce.at) < nowMs) return NOTICE_LINE.overdue(send)
  if (step.highCare.userIds.length > 0) return NOTICE_LINE.care(send, e.noticeDays)
  return NOTICE_LINE.standard(send, e.noticeDays)
}

/**
 * The change window this step shares (prompt 41 §9).
 *
 * Three branches. A safe-today step takes no window at all, so saying "enforced
 * on its own" about it would be wrong in the way that matters: it implies a
 * supervised hour it does not need.
 */
function batchLine(step: Step, batchWith: string[]): string | null {
  const at = step.rings[0]?.plannedStart
  if (!at || step.status === 'done' || step.status === 'skipped') return null
  if (step.safeToday) return BATCH.safeToday
  return batchWith.length > 0 ? BATCH.withOthers(batchWith.length, absoluteDate(at)) : BATCH.alone(absoluteDate(at))
}

/**
 * The pace control, and what a slower or faster pace would cost.
 *
 * Its own component because the numbers beside it come from re-running the
 * scheduler, which is worth memoising, and the page above has an early return
 * for the not-yet-computed state — so a useMemo in the page body would be
 * called on some renders and not others (prompt 42, pace control).
 */
/**
 * Can this step be enforced yet, with the evidence under it.
 *
 * Grouped by STEP, not by policy (§2): a goal delivered by three policies shows
 * one verdict with the three listed under it, because whether a change can be
 * enforced is a question about the change, not about each object behind it.
 */
function VerdictCard({
  v,
  step,
  nameOf,
  tenantId,
  answered,
}: {
  v: Verdict
  step: Step
  nameOf: (id: string) => string
  tenantId: string
  /** Assertions already given, so the verdict lists only what is still open. */
  answered: import('../../roadmap/unknowns.ts').Assertion[]
}) {
  const status = v.kind === 'ready' ? 'done' : v.kind === 'notYet' ? 'warning' : 'neutral'
  const label = v.kind === 'ready' ? VERDICT.ready : v.kind === 'notYet' ? VERDICT.notYet : VERDICT.notEnough
  const policyId = step.tracking?.policyId ?? null
  const firstAffected = v.failures[0] ?? step.population.ids[0] ?? null
  const times = new Map((step.tracking?.failuresByUser ?? []).map((f) => [f.userId, f.count]))
  const openUnknowns = unansweredFor(step, answered)
  return (
    <div className="card verdict-card" id={`verdict-${step.id}`}>
      <h4>{VERDICT.title}</h4>
      <p className="row">
        <Chip status={status}>{label}</Chip> <span>{v.reason}</span>
      </p>
      <ul className="sections">
        <li>{VERDICT.days(v.days.observed, v.days.required)}</li>
        <li>{VERDICT.signIns(v.signIns)}</li>
        <li>{VERDICT.covered(v.covered.seen, v.covered.expected)}</li>
      </ul>

      {v.failures.length > 0 && (
        <>
          <h5>{VERDICT.failuresTitle}</h5>
          <ul className="sections">
            {v.failures.map((id) => (
              <li key={id}>{VERDICT.failure(nameOf(id), times.get(id) ?? 1)}</li>
            ))}
          </ul>
        </>
      )}

      {/* Named, never waited for (§1). */}
      {v.unseen.length > 0 && (
        <>
          <h5>{VERDICT.unseenTitle}</h5>
          <p className="reason">{VERDICT.unseenNote}</p>
          <ul className="sections">
            {v.unseen.map((u) => (
              <li key={u.userId}>{VERDICT.unseenPerson(nameOf(u.userId), u.lastSignIn ? absoluteDate(u.lastSignIn) : null)}</li>
            ))}
          </ul>
        </>
      )}

      {step.exitCriteria.length > 0 && (
        <>
          {/* Unknowns still open appear in the verdict as well as on the step
              (prompt 42 item 5). They never gate it; they are named so nobody
              mistakes silence for safety. */}
          {openUnknowns.length > 0 && (
            <>
              <h5>{VERDICT.unknownsTitle}</h5>
              <p className="reason">{VERDICT.unanswered}</p>
              <ul className="sections">
                {openUnknowns.map((u) => (
                  <li key={u.id}>{u.question ?? u.cannotSee}</li>
                ))}
              </ul>
            </>
          )}
          <h5>{VERDICT.exitTitle}</h5>
          <ul className="sections exit-criteria">
            {step.exitCriteria.map((c, i) => (
              <li key={i}>
                <Chip status={v.kind === 'ready' ? 'done' : 'neutral'}>{v.kind === 'ready' ? SECTION.applies.no : SECTION.applies.unknown}</Chip> {c}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Show your work (§2): Microsoft's own data, one click away. */}
      {policyId && (
        <p className="row no-print">
          <span className="reason">{VERDICT.showWork}</span>
          <a href={insightsUrl(tenantId, policyId)} target="_blank" rel="noopener noreferrer">
            {VERDICT.insights}
          </a>
          {firstAffected && (
            <a href={whatIfUrl(tenantId, policyId, firstAffected)} target="_blank" rel="noopener noreferrer">
              {VERDICT.whatIf}
            </a>
          )}
        </p>
      )}
    </div>
  )
}

/** The draft a skip is composed in, before anything is written. */
export type SkipDraft = { id: string; reason: string; reasonId: SkipReasonId; detail: string; typed: string; alsoSkip: boolean }

/** A goal worth asking about twice (item 7). */
const HIGH_VALUE = 4

/**
 * The skip panel: the reason, what it leaves exposed, what else it blocks, and
 * for a high-value goal a typed confirmation.
 *
 * The exposure paragraph is the point of the whole panel. It is drawn from the
 * goal's own risk text and the population still affected, and it is the last
 * thing the reader sees before confirming — not to change their mind, which is
 * theirs to make, but so the decision is made with the fact in view.
 */
function SkipPanel({
  step,
  draft,
  dependents,
  onChange,
  onCancel,
  onConfirm,
}: {
  step: Step
  draft: SkipDraft
  dependents: Step[]
  onChange: (d: SkipDraft) => void
  onCancel: () => void
  onConfirm: (reason: string, alsoSkip: Step[]) => string | null
}) {
  const [error, setError] = useState<string | null>(null)
  const highValue = (step.score?.value ?? 0) >= HIGH_VALUE
  const shortName = step.plainTitle || step.title
  const needsDetail = draft.reasonId === 'other'
  const label = SKIP_REASONS.find((r) => r.id === draft.reasonId)?.label ?? ''
  const reason = [label, draft.detail.trim()].filter(Boolean).join(': ')
  const typedOk = !highValue || draft.typed.trim().toLowerCase() === shortName.trim().toLowerCase()

  return (
    <div className="card skip-panel">
      <h4>{SKIP.panelTitle}</h4>

      {/* What the tenant is left exposed to. One paragraph, no persuasion. */}
      <p>{step.why ? SKIP.exposure(step.why, step.population.active) : SKIP.exposureUnknown(step.impact)}</p>

      {dependents.length > 0 && (
        <>
          <p className="reason">{SKIP.dependents(dependents.map((d) => d.plainTitle || d.title))}</p>
          <p className="row">
            <label>
              <input type="radio" name={`also-${step.id}`} checked={draft.alsoSkip} onChange={() => onChange({ ...draft, alsoSkip: true })} /> {SKIP.dependentsAlso}
            </label>
            <label>
              <input type="radio" name={`also-${step.id}`} checked={!draft.alsoSkip} onChange={() => onChange({ ...draft, alsoSkip: false })} /> {SKIP.dependentsKeep}
            </label>
          </p>
        </>
      )}

      <p className="row">
        <label>
          {SKIP.reasonLabel}{' '}
          <select value={draft.reasonId} aria-label={SKIP.reasonLabel} onChange={(e) => onChange({ ...draft, reasonId: e.currentTarget.value as SkipReasonId })}>
            {SKIP_REASONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </p>
      <p>
        <label>
          {SKIP.detailLabel}{' '}
          <input type="text" value={draft.detail} placeholder={SKIP.detailPlaceholder} aria-label={SKIP.detailLabel} style={{ minWidth: '20rem' }} onChange={(e) => onChange({ ...draft, detail: e.currentTarget.value })} />
        </label>
      </p>

      {highValue && (
        <>
          <p className="reason">{SKIP.highRiskWhy}</p>
          <p>
            <label>
              {SKIP.highRiskLabel(shortName)}{' '}
              <input type="text" value={draft.typed} aria-label={SKIP.highRiskLabel(shortName)} style={{ minWidth: '20rem' }} onChange={(e) => onChange({ ...draft, typed: e.currentTarget.value })} />
            </label>
          </p>
        </>
      )}

      {error && <p className="reason skip-error">{error}</p>}

      <p className="row">
        <Button
          size="sm"
          onClick={() => {
            if (needsDetail && draft.detail.trim() === '') return setError(SKIP.detailRequired)
            if (!typedOk) return setError(SKIP.highRiskMismatch)
            setError(onConfirm(reason, draft.alsoSkip ? dependents : []))
          }}
        >
          {SKIP.confirm}
        </Button>
        <Button size="sm" variant="tertiary" onClick={onCancel}>
          {SKIP.cancel}
        </Button>
      </p>
    </div>
  )
}

/**
 * Why this step sits where it does, in one line (prompt 45 item 11).
 *
 * Read in the order the scheduler itself applies: a hard dependency outranks a
 * window, which outranks the change-window cap. The first true fact is the
 * answer, because the others would not have moved it anyway.
 */
/**
 * First-party applications a step's policy targets, checked against the
 * activity this tenant actually shows (prompt 43 item 11).
 */
const FIRST_PARTY_APPS: { appId: string; displayName: string }[] = firstPartyApps.apps

function appsTargetedBy(step: Step): { appId: string; displayName: string }[] {
  if (!step.action.json) return []
  const ids = [...step.action.json.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)].map((m) => m[0].toLowerCase())
  const seen = new Set<string>()
  const out: { appId: string; displayName: string }[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    const name = FIRST_PARTY_APPS.find((a) => a.appId.toLowerCase() === id)
    if (name) out.push({ appId: id, displayName: name.displayName })
  }
  return out
}

function whyNow(step: Step, waitsOn: Step[], schedule: Schedule): string {
  if (step.status === 'done') return WHY_NOW.done
  if (step.status === 'skipped') return WHY_NOW.skipped
  if (step.safeToday) return WHY_NOW.safeToday
  const campaign = waitsOn.find((d) => d.kind === 'verify')
  if (campaign) return WHY_NOW.campaign
  if (waitsOn.length > 0) return WHY_NOW.waitsFor(waitsOn.map((d) => d.plainTitle || d.title))
  const start = step.rings[0]?.plannedStart
  if (start && start <= schedule.observation.end) return WHY_NOW.observation(schedule.observation.days)
  const soft = (schedule.graph[step.id] ?? []).some((d) => d.kind === 'soft')
  if (soft) return WHY_NOW.samePeople
  if (schedule.derivation.constraint === 'cap') return WHY_NOW.cap
  return WHY_NOW.phase
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
  onPrompt,
  watch,
  snapshotForApps,
  assertions,
  onAssert,
  audienceName,
  now,
  batchWith,
  dependents,
  waitsOn,
  schedule,
  verdict,
  preflight,
  tenantId,
}: {
  step: Step
  linked: boolean
  stepById: Map<string, Step>
  nameOf: (id: string) => string
  copied: string | null
  onCopy: (id: string, text: string) => Promise<void>
  /** C15: the name the announcement addresses people by, when it looks like a tenant id. */
  audienceName: string | null
  /** Clock for the notice line (prompt 41 §3). */
  now: number
  /** The other steps enforced in the same change window (prompt 41 §9). */
  batchWith: string[]
  /** Can this be enforced yet (prompt 42 Part 2); null off report-only. */
  verdict: Verdict | null
  /** Can the operator still sign in after this change window (prompt 42 Part 3). */
  preflight: Preflight | null
  tenantId: string
  skipDraft: SkipDraft | null
  setSkipDraft: (d: SkipDraft | null) => void
  /** Steps that wait on this one, so a skip can name them (item 5). */
  dependents: Step[]
  /** Steps this one waits on, for the dependency view (prompt 45 item 12). */
  waitsOn: Step[]
  schedule: Schedule
  onSkipped: (step: Step) => void
  onExportPopulation: (step: Step) => void
  cohortsOf: (step: Step) => NonNullable<Step['populationView']>['cohorts']
  boundedNames: (ids: string[]) => string
  dependencies: Dependency[]
  onPrompt: (id: string, kind: 'announcement' | 'reminder' | 'helpDesk' | 'manager', context: string, draft: string) => void
  watch: import('../../roadmap/watch.ts').WatchResult | null
  /** For the service-principal activity check (prompt 43 item 11). */
  snapshotForApps: TenantSnapshot
  /** Answers already given for this step's unknowns (prompt 42 item 4). */
  assertions: Record<string, { answer: 'yes' | 'no'; at: string; effect: 'carveOut' | 'laterWave' | 'accepted' }>
  onAssert: (stepId: string, unknownId: string, answer: 'yes' | 'no', effect: 'carveOut' | 'laterWave' | 'accepted') => void
}) {
  const [tab, setTab] = useState<'json' | 'portal' | 'ps'>('portal')
  // What this window cannot see, and which applications it targets (prompts 42
  // items 3-5 and 43 items 11-13).
  const [openAssert, setOpenAssert] = useState<string | null>(null)
  const stepUnknowns = unknownsFor(step)
  const spChecks = checkServicePrincipals(appsTargetedBy(step), snapshotForApps, () => step.plainTitle || step.title)
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
            {stepKindLabel(step)}
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
          {/* One blocked-reason list per step (prompt 37 §6). A blocked step's
              causes are printed below, as links; repeating them here as prose
              was the duplicate the review caught (T8). */}
          {step.status !== 'blocked' && <div className="sub state-reason">{step.stateReason}</div>}
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
      {watch && (
        <Callout kind={watch.breached ? 'danger' : watch.hasEvidence ? 'success' : 'info'}>
          <strong>{WATCH.title}.</strong> {watch.sentence} {watch.hasEvidence && watch.baseline} {watch.threshold} {watch.verdict}
          {watch.byUser.length > 0 && <div className="sub">{boundedNames(watch.byUser.map((u) => u.userId))}</div>}
        </Callout>
      )}
      {/* 1. What changes (roadmap-v2.md §4) */}
      <h4>{SECTION.whatChanges}</h4>
      <p>{step.whatChanges}</p>

      {/* 2. Why it matters — for this tenant first (C12) */}
      <h4>{SECTION.whyItMatters}</h4>
      <p className="advisor">{WHY.forTenant(step.plainTitle || step.title, step.population.total, step.population.active)}</p>
      {step.whyLink && (
        <p className="reason">
          <a href={step.whyLink} target="_blank" rel="noopener noreferrer">
            {C.whyLink}
          </a>
        </p>
      )}
      <p className="reason">
        {step.whyAttribution ? WHY.source : WHY.sourceCatalogue}{' '}
        {step.why}
        {step.whyAttribution && (
          <span className="reason">
            {' '}
            {C.authorIntent}{' '}
            <a href={step.whyAttribution.url} target="_blank" rel="noopener noreferrer">
              {step.whyAttribution.author}
            </a>
            {C.authorIntentEnd}
          </span>
        )}
      </p>
      {step.learn && (
        <p className="reason">
          <a href={step.learn.url} target="_blank" rel="noopener noreferrer">
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

      {step.includesOperator && (step.operatorNote || step.operatorSafe === false) && (
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
          {(() => {
            // R15, then prompt 41 §13. Every entry carries its own source in the
            // data (C13); the page prints each DISTINCT source once, at the
            // bottom of the list.
            //
            // The first attempt collapsed them only when every entry cited the
            // same page and every entry had one. Nine entries where eight share
            // a URL and one differs failed both halves of that test, so the
            // shared page printed eight times in full (review-09 finding 7).
            // Distinctness is the only thing that decides it now.
            const cites = step.failureModes.map((m) => m.citation).filter(Boolean)
            const distinct = [...new Map(cites.map((c) => [c === FIELD_PRACTICE ? 'field' : c!.url, c])).values()]
            const cite = (c: (typeof cites)[number], key: string) =>
              c === FIELD_PRACTICE ? (
                <div key={key} className="reason">{CITATION.fieldPractice}</div>
              ) : (
                <div key={key} className="reason">
                  {CITATION.source}:{' '}
                  <a href={c!.url} target="_blank" rel="noopener noreferrer">
                    {c!.label}
                  </a>
                </div>
              )
            return (
              <>
                <ul className="sections failure-modes">
                  {step.failureModes.map((m, i) => (
                    <li key={i} className={`applies-${m.applies}`}>
                      <strong>{m.title}</strong> <Chip status={m.applies === 'yes' ? 'warning' : m.applies === 'no' ? 'done' : 'neutral'}>{SECTION.applies[m.applies]}</Chip>
                      <div className="sub">{m.evidence}</div>
                    </li>
                  ))}
                </ul>
                {distinct.map((c, i) => cite(c, `src${i}`))}
              </>
            )
          })()}
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

      {/* R18: a heading over a single line saying there is nothing to report
          is worse than silence — it promises a section and delivers none. */}
      {step.evidence.lines.filter((l) => l !== EVIDENCE_COPY.notSeenYet && l !== EVIDENCE_COPY.unusable).length > 0 && (
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
              <th scope="col">{SECTION.changeField}</th>
              <th scope="col">{SECTION.changeFrom}</th>
              <th scope="col">{SECTION.changeTo}</th>
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
            <Button size="sm" icon="download" onClick={() => exportDownload(`${step.id}.json`, step.action.json!, 'application/json', REDACTED)}>
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

      {/* 7. Ring plan, or why there is not one (prompt 37 §11) */}
      {step.rings.length === 0 && (
        <>
          <h4>
            <Term id="ring">{SECTION.ringPlan}</Term>
          </h4>
          <p className="reason">
            {step.status === 'done' || step.status === 'skipped'
              ? SECTION.noRings.done
              : step.kind === 'prerequisite'
                ? SECTION.noRings.prerequisite
                : step.kind === 'verify'
                  ? SECTION.noRings.verify
                  : step.kind === 'recurring'
                    ? SECTION.noRings.recurring
                    : SECTION.noRings.other}
          </p>
        </>
      )}
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

      {/* The readiness verdict (prompt 42 Part 2). One per step, never per policy. */}
      {verdict && <VerdictCard v={verdict} step={step} nameOf={nameOf} tenantId={tenantId} answered={Object.entries(assertions).map(([id, a]) => ({ id: id as never, answer: a.answer, at: a.at, effect: a.effect }))} />}

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

      {/* What this step's window cannot see (prompt 42 items 3-5). Stated, never
          waited out, and never a blocker: an unanswered one renders as something
          the records cannot confirm, so nobody mistakes silence for safety. */}
      {stepUnknowns.length > 0 && (
        <>
          <h4>{VERDICT.unknownsTitle}</h4>
          <p className="reason">
            {VERDICT.unknownsNote} {VERDICT.unanswered}
          </p>
          <ul className="sections">
            {stepUnknowns.map((u) => {
              const answered = assertions[u.id]
              return (
                <li key={u.id}>
                  {u.cannotSee}
                  {u.question ? <div className="sub">{u.question}</div> : null}
                  {answered ? (
                    <div className="reason">
                      {VERDICT.answeredOn(absoluteDate(answered.at))}: {ASSERTION_EFFECT[answered.effect]}
                    </div>
                  ) : (
                    u.question && (
                      <p className="row no-print">
                        {/* One unknown at a time: three buttons beside every
                            question put the same three choices on screen four
                            times over, which reads as noise rather than as a
                            decision. */}
                        {openAssert === u.id ? (
                          ASSERTION_CHOICES.map((c) => (
                            <Button key={c.effect} size="sm" variant="tertiary" onClick={() => { onAssert(step.id, u.id, 'yes', c.effect); setOpenAssert(null) }}>
                              {c.label}
                            </Button>
                          ))
                        ) : (
                          <Button size="sm" variant="tertiary" onClick={() => setOpenAssert(u.id)}>
                            {VERDICT.answer}
                          </Button>
                        )}
                      </p>
                    )
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {/* 43 items 11-13: applications this policy targets, and whether this
          tenant has a service principal for them. */}
      {spChecks.length > 0 && (
        <>
          <h4>{SP_TEXT.title}</h4>
          <ul className="sections">
            {spChecks.map((c) => (
              <li key={c.app.appId}>
                {c.state === 'present' ? SP_TEXT.present(c.app.displayName) : SP_TEXT.unconfirmed(c.app.displayName)}
                {c.state === 'unconfirmed' && (
                  <>
                    <div className="sub">{SP_TEXT.portal}</div>
                    <pre className="code-block">{createCommands(c.app).connect}</pre>
                    <div className="reason">{SP_TEXT.connectExplains}</div>
                    <pre className="code-block">{createCommands(c.app).create}</pre>
                    <div className="reason">{SP_TEXT.createExplains}</div>
                    <div className="reason">{SP_TEXT.youRunIt}</div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Why it sits here, and what that order rests on (prompt 45 Part 3). */}
      <h4>{WHY_NOW.title}</h4>
      <p>{whyNow(step, waitsOn, schedule)}</p>
      <div className="dependency-view">
        <div>
          <strong>{WHY_NOW.waitsOnTitle}</strong>
          {waitsOn.length === 0 ? (
            <p className="reason">{WHY_NOW.waitsOnNothing}</p>
          ) : (
            <ul className="sections">
              {waitsOn.map((d) => (
                <li key={d.id}>
                  <a href={stepHref(d.id)}>{d.plainTitle || d.title}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <strong>{WHY_NOW.waitedOnByTitle}</strong>
          {dependents.length === 0 ? (
            <p className="reason">{WHY_NOW.nothingWaits}</p>
          ) : (
            <ul className="sections">
              {dependents.map((d) => (
                <li key={d.id}>
                  <a href={stepHref(d.id)}>{d.plainTitle || d.title}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

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
        {step.rollback}
        {/* The token-refresh note is about Conditional Access; a ladder rung and a validation blocker create no policy. */}
        {!step.ladder && !step.validationBlocker && <> {ROLLBACK_V2.timing}</>}
      </p>
      {step.rollbackBody && (
        <details>
          <summary>{SECTION.previousBody}</summary>
          <p className="reason">{ROLLBACK_V2.storedBody}</p>
          <pre className="code-block">{step.rollbackBody}</pre>
          <p className="no-print">
            <Button size="sm" icon="download" onClick={() => exportDownload(`${step.id}-previous.json`, step.rollbackBody!, 'application/json', REDACTED)}>
              {C.downloadJson}
            </Button>
          </p>
        </details>
      )}

      {/* Before the change window: can the operator still sign in (prompt 42 Part 3). */}
      {preflight && !preflight.go && (
        <div className="card preflight-nogo">
          <p className="row">
            <Chip status="warning">{VERDICT.preflightTitle}</Chip> <strong>{VERDICT.preflightNoGo}</strong>
          </p>
          <h5>{VERDICT.preflightBlocked}</h5>
          <ul className="sections">
            {preflight.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {preflight && preflight.go && preflight.unknown && <p className="reason">{VERDICT.preflightUnknown}</p>}

      {/* The change window this step shares (prompt 41 §9). */}
      {batchLine(step, batchWith) && <p className="reason batch-line">{batchLine(step, batchWith)}</p>}

      {/* 11. Comms: per ring, dated, and the help-desk version */}
      {step.comms && (
        <>
          <h4>{SECTION.comms}</h4>
          {/* C15: say plainly when the name in the message is the tenant
              identifier rather than something people would recognise. */}
          {audienceName && <p className="reason">{NAME_WARNING(audienceName)}</p>}
          {/* When to send it, above the thing being sent (prompt 41 §3). */}
          <p className="notice-line">{noticeLine(step, now)}</p>
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
                <Button size="sm" icon="copy" onClick={() => onPrompt(step.id, 'announcement', stepContext(step), step.comms!)}>
                  {copied === `${step.id}:prompt` ? C.copied : COMMS_PLAN.copyPrompt}
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
          <p className="no-print">
            <Button size="sm" icon="copy" onClick={() => onPrompt(`${step.id}:helpdesk`, 'helpDesk', stepContext(step), [...step.helpDesk!.callsAbout, ...step.helpDesk!.whatToSay].join('\n'))}>
              {copied === `${step.id}:helpdesk:prompt` ? C.copied : COMMS_PLAN.copyPrompt}
            </Button>
          </p>
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
            <Button size="sm" icon="copy" onClick={() => onPrompt(`${step.id}:manager`, 'manager', stepContext(step), step.forManager)}>
              {copied === `${step.id}:manager:prompt` ? C.copied : COMMS_PLAN.copyPrompt}
            </Button>
          </p>
        </>
      )}
      {/* 12. Owner and scheduled date */}
      {step.status !== 'done' && step.status !== 'skipped' && (
        <>
          <h4>{SECTION.ownerAndDate}</h4>
          <p className="reason">
            {SECTION.scheduledDate}: {step.rings[0] ? absoluteDate(step.rings[0].plannedStart) : '—'}
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

      {/* Skipped: the decision stays visible, and comes back in one click (items 4, 8). */}
      {step.status === 'skipped' && (
        <p className="no-print row">
          <Chip status="neutral">{SKIP.skippedChip}</Chip>
          <span className="reason">{step.skipReason}</span>
          <Button size="sm" variant="tertiary" onClick={() => { unskipStep(step); onSkipped(step) }}>
            {SKIP.unskip}
          </Button>
        </p>
      )}

      {/* Emergency access is absent from this control, with the reason said once
          rather than a disabled button nobody can explain (item 6). */}
      {step.status !== 'done' && step.status !== 'skipped' && isEmergencyAccess(step) && <p className="reason no-print">{SKIP.cannotSkip}</p>}

      {step.status !== 'done' && step.status !== 'skipped' && !isEmergencyAccess(step) && (
        <div className="no-print">
          {skipDraft?.id === step.id ? (
            <SkipPanel
              step={step}
              draft={skipDraft}
              dependents={dependents}
              onChange={setSkipDraft}
              onCancel={() => setSkipDraft(null)}
              onConfirm={(reason, alsoSkip) => {
                const r = skipStep(step, reason)
                if (!r.ok) return r.error ?? ''
                for (const d of alsoSkip) skipStep(d, reason)
                setSkipDraft(null)
                onSkipped(step)
                return null
              }}
            />
          ) : (
            <Button size="sm" variant="tertiary" onClick={() => setSkipDraft({ id: step.id, reason: '', reasonId: 'notApplicable', detail: '', typed: '', alsoSkip: true })}>
              {SKIP.action}
            </Button>
          )}
        </div>
      )}
    </ExpandCard>
  )
}
