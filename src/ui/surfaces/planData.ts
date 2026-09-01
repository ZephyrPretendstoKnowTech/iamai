// The plan, computed and persisted, for the Plan surface (prompt 48 Part 2).
// The same pipeline the Roadmap page used — coverage, generate, merge the
// saved progress, track from evidence, annotate — behind one hook so Plan.tsx
// and Step.tsx stay thin. Editing an assumption or a setting bumps a version
// and regenerates in place.
import { useEffect, useMemo, useRef, useState } from 'react'
import baselineIndex from '../../../baselines/jhope188-conditionalaccesspolicies.index.json' with { type: 'json' }
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { BaselineResult } from '../baseline.ts'
import type { MappingState } from '../../mapping/types.ts'
import type { Step } from '../../roadmap/types.ts'
import type { Schedule, ChangeFreeze } from '../../roadmap/schedule.ts'
import type { CoverageReport } from '../../coverage/types.ts'
import type { StaticViolation } from '../../roadmap/staticRules.ts'
import type { SizeBand } from '../../roadmap/constants.ts'
import { BANDS } from '../../roadmap/constants.ts'
import { computeCoverage } from '../../coverage/coverage.ts'
import { buildStrengthLookup } from '../../coverage/strength.ts'
import { buildQuestions } from '../../mapping/questions.ts'
import { activeWizardQuestions } from '../../mapping/wizard.ts'
import { loadMappingState, saveMappingState, toCoverageMapping } from '../../mapping/store.ts'
import { buildViabilityInputs } from '../../scoring/fromSnapshot.ts'
import { scoreMfaViability } from '../../scoring/mfaViability.ts'
import type { MfaViability } from '../../scoring/mfaViability.ts'
import { buildNameDirectory } from '../../names.ts'
import { generateRoadmap } from '../../roadmap/generate.ts'
import { annotateStateReasons } from '../../roadmap/stateReason.ts'
import { mergePersisted, savedStepOf, applyProgress } from '../../roadmap/progress.ts'
import type { SavedStep } from '../../roadmap/progress.ts'
import { refreshBlockerImpact } from '../../roadmap/blockerSteps.ts'
import { nextWorkingDay } from '../../roadmap/schedule.ts'
import { loadPlanRecord, savePlanRecord } from '../../graph/collect/cache.ts'
import { getGroupMembers } from '../../graph/collect/onDemand.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import type { NameDirectory } from '../../names.ts'

type PlanStore = {
  planId: string
  steps: Record<string, SavedStep>
  // The Roadmap page shares this per-tenant record and reads checkpoints.at(-1);
  // the Plan never writes checkpoints, but it must not drop the key (CI crash).
  checkpoints?: unknown[]
  startDate?: string
  band?: SizeBand
  freeze?: ChangeFreeze | null
  assertions?: Record<string, unknown>
  planCreatedAt?: string
}

export type PlanComputed = {
  steps: Step[]
  schedule: Schedule
  coverage: CoverageReport
  viability: MfaViability[]
  names: NameDirectory
  staticViolations: StaticViolation[]
}

export type PlanData = {
  ready: boolean
  computed: PlanComputed | null
  mapping: MappingState | null
  startDate: string | null
  band: SizeBand | null
  freeze: ChangeFreeze | null
  /** Save a new mapping (an assumptions edit) and regenerate. */
  saveMapping: (next: MappingState) => void
  /** Set the plan start; null clears the override and restores the default (prompt 49.1 item 11). */
  setStart: (iso: string | null) => void
  setBand: (b: SizeBand | null) => void
  setFreeze: (f: ChangeFreeze | null) => void
  /** Skip a step, persisted so a re-scan and reload keep it (prompt 49.1 item 10). */
  onSkip: (stepId: string, reason: string) => void
  /** Put a skipped step back. */
  onUnskip: (stepId: string) => void
  /** Tick a recorded-by-hand emergency-access fact (prompt 49 item 5); stored in the mapping and the plan file. */
  tickAnswer: (key: 'credentialStorage' | 'signInMonitoring', done: boolean) => void
  groups: GroupMembers
}

export function usePlanData(
  scan: { snapshot: TenantSnapshot; at: string } | null,
  baseline: BaselineResult | null,
): PlanData {
  const snapshot = scan?.snapshot ?? null
  const planId = snapshot ? `plan-${snapshot.tenantId.slice(0, 8)}` : ''
  const [mapping, setMapping] = useState<MappingState | null>(null)
  const [saved, setSaved] = useState<PlanStore | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [groups, setGroups] = useState<GroupMembers>(new Map())
  const [groupsLoaded, setGroupsLoaded] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!snapshot) return
    void Promise.all([loadMappingState(snapshot.tenantId), loadPlanRecord<PlanStore>(snapshot.tenantId)]).then(([m, p]) => {
      setMapping(m)
      setSaved(p ?? { planId, steps: {}, checkpoints: [] })
      setLoaded(true)
    })
  }, [snapshot, planId])

  useEffect(() => {
    if (!snapshot) return
    let cancelled = false
    const ids = new Set<string>()
    for (const raw of snapshot.config.caPolicies?.rows ?? []) {
      const users = (raw as { conditions?: { users?: { includeGroups?: string[]; excludeGroups?: string[] } } }).conditions?.users
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

  const startDate = saved?.startDate ?? (snapshot ? nextWorkingDay(new Date().toISOString()) : null)
  const band: SizeBand | null = saved?.band && BANDS[saved.band] ? saved.band : null
  const freeze = saved?.freeze ?? null

  const computed = useMemo<PlanComputed | null>(() => {
    if (!snapshot || !baseline || !mapping || !groupsLoaded || !loaded || !startDate) return null
    const strengths = buildStrengthLookup(snapshot.config.authStrengths?.rows ?? [])
    const questions = buildQuestions(baseline.pkg)
    const coverage = computeCoverage({
      snapshot,
      tenantPolicies: snapshot.config.caPolicies?.rows ?? [],
      baselinePolicies: baseline.pkg.policies,
      baselineUnusable: baseline.pkg.report.warnings,
      strengths,
      groupMembers: groups,
      mapping: toCoverageMapping(mapping, questions, activeWizardQuestions(baseline.pkg, { snapshot, state: mapping })),
      facetOverrides: mapping.facetOverrides,
    })
    const viability = buildViabilityInputs(snapshot, snapshot.asOf, new Set(mapping.serviceAccountUserIds)).map(scoreMfaViability)
    const names = buildNameDirectory(snapshot, groups)
    const result = generateRoadmap({
      planId,
      coverage,
      snapshot,
      baseline: baseline.pkg,
      baselineAuthor: baselineIndex.author !== undefined ? { author: baselineIndex.author, url: baselineIndex.authorUrl ?? '#' } : null,
      mapping,
      questions,
      viability,
      strengths,
      startDate,
      band,
      operatorUserId: null,
      names,
      groupMembers: groups,
      changeFreeze: freeze,
    })
    const { steps, schedule } = result
    mergePersisted(steps, saved?.steps ?? null)
    applyProgress(steps, snapshot, coverage, planId, undefined, saved?.planCreatedAt ?? null)
    annotateStateReasons(steps)
    refreshBlockerImpact(steps)
    return { steps, schedule, coverage, viability, names, staticViolations: result.housekeeping.staticViolations }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, baseline, mapping, groupsLoaded, loaded, groups, saved, planId, version, startDate, band, freeze])

  // Persist the step progress so a re-scan and Skip survive a reload.
  const lastPersist = useRef('')
  useEffect(() => {
    if (!computed || !snapshot) return
    const stepsRecord: Record<string, SavedStep> = Object.fromEntries(computed.steps.map((s) => [s.id, { ...(saved?.steps[s.id] ?? {}), ...savedStepOf(s) }]))
    const key = computed.steps.map((s) => `${s.id}:${s.status}`).join('|')
    if (key === lastPersist.current) return
    lastPersist.current = key
    void savePlanRecord(snapshot.tenantId, { ...(saved ?? { planId }), planId, steps: stepsRecord, checkpoints: saved?.checkpoints ?? [], startDate, band, freeze, planCreatedAt: saved?.planCreatedAt ?? new Date().toISOString() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed, snapshot])

  const bump = (): void => setVersion((v) => v + 1)
  return {
    ready: loaded && groupsLoaded,
    computed,
    mapping,
    startDate,
    band,
    freeze,
    groups,
    saveMapping: (next) => {
      setMapping(next)
      void saveMappingState(next)
      bump()
    },
    setStart: (iso) => {
      setSaved((p) => ({ ...(p ?? { planId, steps: {}, checkpoints: [] }), startDate: iso ?? undefined }))
      bump()
    },
    setBand: (b) => {
      setSaved((p) => ({ ...(p ?? { planId, steps: {}, checkpoints: [] }), band: b ?? undefined }))
      bump()
    },
    setFreeze: (f) => {
      setSaved((p) => ({ ...(p ?? { planId, steps: {}, checkpoints: [] }), freeze: f }))
      bump()
    },
    onSkip: (stepId, reason) => {
      // Persist the skip to the saved record so mergePersisted re-applies it on
      // every regenerate; otherwise the fresh plan drops it (the skip race).
      setSaved((p) => {
        const base = p ?? { planId, steps: {}, checkpoints: [] }
        const prev = base.steps[stepId]
        const entry: SavedStep = {
          ...(prev ?? { status: 'blocked', history: [], skipReason: null }),
          status: 'skipped',
          skipReason: reason,
          history: [...(prev?.history ?? []), { at: new Date().toISOString(), from: prev?.status ?? 'blocked', to: 'skipped', note: reason }],
        }
        return { ...base, steps: { ...base.steps, [stepId]: entry } }
      })
      bump()
    },
    onUnskip: (stepId) => {
      // Drop the saved entry: the generator recomputes the step from the tenant
      // as it is now, rather than restoring a judgement made against an old scan.
      setSaved((p) => {
        if (!p || !p.steps[stepId]) return p
        const { [stepId]: _drop, ...rest } = p.steps
        return { ...p, steps: rest }
      })
      bump()
    },
    tickAnswer: (key, done) => {
      if (!mapping) return
      const prev = mapping.breakGlassAnswers ?? { credentialStorage: null, signInMonitoring: null }
      const next = { ...mapping, breakGlassAnswers: { ...prev, [key]: done } }
      setMapping(next)
      void saveMappingState(next)
      bump()
    },
  }
}
