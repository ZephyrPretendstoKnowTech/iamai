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
import { applySkips, decisionsOf, applyProgress } from '../../roadmap/progress.ts'
import type { PlanDecisions } from '../../roadmap/progress.ts'
import { refreshBlockerImpact } from '../../roadmap/blockerSteps.ts'
import { nextWorkingDay } from '../../roadmap/schedule.ts'
import { loadPlanRecord, savePlanRecord } from '../../graph/collect/cache.ts'
import { getGroupMembers } from '../../graph/collect/onDemand.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import type { NameDirectory } from '../../names.ts'
import { PINNED_GOAL_MAP } from '../../roadmap/goalMap.ts'
import type { GoalMap } from '../../roadmap/goalMap.ts'

// The persisted record holds decisions only (prompt 50.1 item 1): skips, the
// start date, the freeze, the checkpoints. Steps, statuses, populations,
// evidence and dates are regenerated from the snapshot on every load and
// re-scan — never read back from here. A pre-50.1 record (a full step blob) is
// migrated on load by decisionsOf and rewritten in this shape.
type LegacyOrDecisions = Partial<PlanDecisions> & { steps?: Record<string, { status: string; skipReason?: string | null; history?: { at: string }[] }> }

export type PlanComputed = {
  steps: Step[]
  schedule: Schedule
  coverage: CoverageReport
  viability: MfaViability[]
  names: NameDirectory
  staticViolations: StaticViolation[]
  /** The loaded baseline's goal map: the footer and the print page list only goals it holds (walk-51 item 9). */
  goalMap: GoalMap
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
  const [saved, setSaved] = useState<PlanDecisions | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [groups, setGroups] = useState<GroupMembers>(new Map())
  const [groupsLoaded, setGroupsLoaded] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!snapshot) return
    void Promise.all([loadMappingState(snapshot.tenantId), loadPlanRecord<LegacyOrDecisions>(snapshot.tenantId)]).then(([m, p]) => {
      setMapping(m)
      // Read the record once for its decisions, in whatever shape it was written;
      // a pre-50.1 blob is reduced to its skips here and rewritten on the next save.
      setSaved(decisionsOf(p as never, planId))
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
      goalMap: baseline.goalMap,
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
      goalMap: baseline.goalMap,
    })
    const { steps, schedule } = result
    // The one decision a regeneration cannot know; everything else is derived.
    applySkips(steps, saved?.skips ?? null)
    applyProgress(steps, snapshot, coverage, planId, undefined, saved?.planCreatedAt ?? null)
    annotateStateReasons(steps)
    refreshBlockerImpact(steps)
    return { steps, schedule, coverage, viability, names, staticViolations: result.housekeeping.staticViolations, goalMap: baseline.goalMap ?? PINNED_GOAL_MAP }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, baseline, mapping, groupsLoaded, loaded, groups, saved, planId, version, startDate, band, freeze])

  // Persist the decisions only, so a Skip and the start/freeze survive a reload;
  // the plan itself is regenerated, never stored. Writing here also completes the
  // migration of a pre-50.1 record: its blob was dropped on load, and this
  // rewrites the record in the decisions-only shape (prompt 50.1 items 1-2).
  const lastPersist = useRef('')
  useEffect(() => {
    if (!computed || !snapshot || !saved) return
    const decisions: PlanDecisions = {
      planId,
      skips: saved.skips,
      startDate: saved.startDate,
      band: saved.band,
      freeze: saved.freeze ?? null,
      checkpoints: saved.checkpoints ?? [],
      planCreatedAt: saved.planCreatedAt ?? new Date().toISOString(),
    }
    const key = JSON.stringify({ skips: decisions.skips, startDate: decisions.startDate, band: decisions.band, freeze: decisions.freeze })
    if (key === lastPersist.current) return
    lastPersist.current = key
    void savePlanRecord(snapshot.tenantId, decisions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed, snapshot, saved])

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
      setSaved((p) => ({ ...(p ?? { planId, skips: {}, checkpoints: [] }), startDate: iso ?? undefined }))
      bump()
    },
    setBand: (b) => {
      setSaved((p) => ({ ...(p ?? { planId, skips: {}, checkpoints: [] }), band: b ?? undefined }))
      bump()
    },
    setFreeze: (f) => {
      setSaved((p) => ({ ...(p ?? { planId, skips: {}, checkpoints: [] }), freeze: f }))
      bump()
    },
    onSkip: (stepId, reason) => {
      // Record the skip decision; applySkips re-applies it on every regenerate,
      // otherwise the fresh plan drops it (the skip race).
      setSaved((p) => {
        const base = p ?? { planId, skips: {}, checkpoints: [] }
        return { ...base, skips: { ...base.skips, [stepId]: { reason, at: new Date().toISOString() } } }
      })
      bump()
    },
    onUnskip: (stepId) => {
      // Drop the decision: the generator recomputes the step from the tenant as it
      // is now, rather than restoring a judgement made against an old scan.
      setSaved((p) => {
        if (!p || !p.skips[stepId]) return p
        const { [stepId]: _drop, ...rest } = p.skips
        return { ...p, skips: rest }
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
