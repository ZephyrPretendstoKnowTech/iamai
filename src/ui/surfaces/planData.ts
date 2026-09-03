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
import { loadMappingState, saveMappingState, toCoverageMapping } from '../../mapping/store.ts'
import { buildViabilityInputs } from '../../scoring/fromSnapshot.ts'
import { scoreMfaViability } from '../../scoring/mfaViability.ts'
import type { MfaViability } from '../../scoring/mfaViability.ts'
import { buildNameDirectory } from '../../names.ts'
import { generateRoadmap, planIdFor } from '../../roadmap/generate.ts'
import { annotateStateReasons } from '../../roadmap/stateReason.ts'
import { applySkips, decisionsOf, applyProgress } from '../../roadmap/progress.ts'
import { reportOnlySeenOf } from '../../roadmap/tracking.ts'
import type { PlanDecisions, StepDecision } from '../../roadmap/progress.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import { defaultDecisions } from './pickerRows.ts'
import { proposedStart } from '../../derive/planStart.ts'
import { setDisplayTimeZone } from '../../copy/dates.ts'
import { loadPlanRecord, savePlanRecord } from '../../graph/collect/cache.ts'
import { getGroupMembers } from '../../graph/collect/onDemand.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import type { NameDirectory } from '../../names.ts'
import { PINNED_GOAL_MAP } from '../../roadmap/goalMap.ts'
import type { GoalMap } from '../../roadmap/goalMap.ts'
import type { StepDecisionInput } from '../../roadmap/decisions.ts'
import type { CleanupKind } from '../../roadmap/cleanup.ts'
import { cleanupRecord, withCleanupDone } from '../../roadmap/cleanupDone.ts'

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
  /** The anchored start (ISO) once the plan is started or a date is set; null while every visit proposes dates from today. */
  startedFrom: string | null
  /** When Start the plan was pressed, if it was. */
  startedAt: string | null
  /** Start the plan (target-state §5): lock the proposed dates by anchoring the start; a scan never moves it. */
  startPlan: (effectiveStart: string) => void
  setBand: (b: SizeBand | null) => void
  setFreeze: (f: ChangeFreeze | null) => void
  /** Skip a step, persisted so a re-scan and reload keep it (prompt 49.1 item 10). */
  onSkip: (stepId: string, reason: string) => void
  /** Put a skipped step back. */
  onUnskip: (stepId: string) => void
  /** Tick a recorded-by-hand emergency-access fact (prompt 49 item 5); stored in the mapping and the plan file. */
  tickAnswer: (key: 'credentialStorage' | 'signInMonitoring', done: boolean) => void
  groups: GroupMembers
  /** Every picker's saved decision, by step id (prompt 52 Part 3): in the plan record and the plan file. */
  stepDecisions: Record<string, StepDecision>
  /** A picker's Save: record the decision and regenerate the plan around it. */
  onDecide: (stepId: string, decision: StepDecisionInput) => void
  /** The name every Tell your people box signs with (Plan settings); in the plan file. */
  signature: string
  setSignature: (signature: string) => void
  /** The display time zone the plan stores (null: the browser's). */
  timeZone: string | null
  setTimeZone: (tz: string | null) => void
  /** Doesn't apply here: record the person's reason for a step (null puts it back). In the mapping, so in the plan file. */
  setNotApplicable: (stepId: string, reason: string | null) => void
  /** The plan's checkpoints as saved (the scan checkpoints a save writes, and each Cleanup row's Done); they travel in the plan file. */
  checkpoints: unknown[]
  /** A Cleanup row's Done (E3): record the date (YYYY-MM-DD) in the checkpoints and regenerate around it (the drill's date exempts its sign-in). */
  markCleanupDone: (kind: CleanupKind, date: string) => void
  /** The not-assessed Cleanup row's note for one baseline policy: does not apply, with the reason (null clears it). In the mapping, so in the plan file. */
  setNotAssessedNote: (policy: string, reason: string | null) => void
}

/** The operator's own account in the directory: their evidence line, and the special-care default. */
export function operatorIdOf(snapshot: TenantSnapshot | null, account: { username: string } | null): string | null {
  if (!snapshot || !account) return null
  return snapshot.users.find((u) => (u.userPrincipalName ?? '').toLowerCase() === account.username.toLowerCase())?.id ?? null
}

export function usePlanData(
  scan: { snapshot: TenantSnapshot; at: string } | null,
  baseline: BaselineResult | null,
  operatorId: string | null,
  /** Compute only, never write: Connect's Plan tile counts the steps without creating or touching the plan record. */
  readOnly = false,
): PlanData {
  const snapshot = scan?.snapshot ?? null
  const planId = snapshot ? planIdFor(snapshot.tenantId) : ''
  const [mapping, setMapping] = useState<MappingState | null>(null)
  const [saved, setSaved] = useState<PlanDecisions | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [groups, setGroups] = useState<GroupMembers>(new Map())
  const [groupsLoaded, setGroupsLoaded] = useState(false)
  // The snapshot each load was made for: the plan computes only when the
  // mapping and the groups belong to the snapshot on screen, so a scan (or the
  // demo's week two) never renders the new snapshot with the previous mapping —
  // not even for one render (the walk caught the old exclusions step flashing).
  const [mappingFor, setMappingFor] = useState<TenantSnapshot | null>(null)
  const [groupsFor, setGroupsFor] = useState<TenantSnapshot | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!snapshot) return
    // A new snapshot (a scan, the demo's week two) reloads the mapping and the
    // decisions before the plan computes again: a plan never renders from the
    // new snapshot and the previous mapping (the walk caught the old exclusions
    // step flashing on week two while the record was still loading).
    setLoaded(false)
    let cancelled = false
    void Promise.all([loadMappingState(snapshot.tenantId), loadPlanRecord<LegacyOrDecisions>(snapshot.tenantId)]).then(([m, p]) => {
      if (cancelled) return
      setMapping(m)
      // Read the record once for its decisions, in whatever shape it was written;
      // a pre-50.1 blob is reduced to its skips here and rewritten on the next save.
      setSaved(decisionsOf(p as never, planId))
      setMappingFor(snapshot)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [snapshot, planId])

  useEffect(() => {
    if (!snapshot || !mapping || mappingFor !== snapshot) return
    // The defaults here read the policies' groups only (the loaded groups are what
    // this effect produces); every policy-referenced group is loaded regardless.
    const decided = applyStepDecisions(applyStepDecisions(mapping, defaultDecisions({ snapshot, mapping, nameOf: (id) => id, operatorId, now: snapshot.asOf }), 'detected'), saved?.stepDecisions ?? null)
    setGroupsLoaded(false)
    let cancelled = false
    const ids = new Set<string>()
    for (const raw of snapshot.config.caPolicies?.rows ?? []) {
      const users = (raw as { conditions?: { users?: { includeGroups?: string[]; excludeGroups?: string[] } } }).conditions?.users
      for (const g of users?.includeGroups ?? []) ids.add(g)
      for (const g of users?.excludeGroups ?? []) ids.add(g)
    }
    // The plan's own groups too — the exclusions group and the service-accounts
    // group the mapping names — whether or not a policy references them yet:
    // the checks on the exclusions group read its members, and without them the
    // week-two demo kept a "correct the group" step for a group already right.
    const ge = decided.records['__globalExclusion']?.resolvedId
    if (ge) ids.add(ge)
    if (decided.serviceAccountsGroupId) ids.add(decided.serviceAccountsGroupId)
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
        setGroupsFor(snapshot)
        setGroupsLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [snapshot, mapping, mappingFor, saved, operatorId])

  // Every picker's detected default, then every saved step decision, applied to
  // the stored mapping (target-state §6.4): the plan, its checks and its
  // variables derive from this, never from the stored record alone. The default
  // is the plan's decision until the person changes it; a Save only overrides.
  const applied = useMemo<MappingState | null>(() => {
    if (!mapping || !snapshot) return null
    const nameOf = (id: string): string => groups.get(id)?.displayName ?? id
    const defaults = defaultDecisions({ snapshot, mapping, nameOf, groups, operatorId, now: snapshot.asOf })
    return applyStepDecisions(applyStepDecisions(mapping, defaults, 'detected'), saved?.stepDecisions ?? null)
  }, [mapping, saved, snapshot, groups, operatorId])
  // The default start is today in the display zone (derive/planStart.ts),
  // proposed again on every visit until Start the plan anchors a date; the
  // schedule clamps a weekend to the working day after it.
  const startDate = saved?.startDate ?? (snapshot ? proposedStart(mapping?.displayTimeZone ?? null) : null)
  // Every date the pages format reads the stored zone.
  useEffect(() => {
    setDisplayTimeZone(mapping?.displayTimeZone ?? null)
  }, [mapping])
  const band: SizeBand | null = saved?.band && BANDS[saved.band] ? saved.band : null
  const freeze = saved?.freeze ?? null

  const computed = useMemo<PlanComputed | null>(() => {
    if (!snapshot || !baseline || !applied || !groupsLoaded || !loaded || !startDate) return null
    if (mappingFor !== snapshot || groupsFor !== snapshot) return null
    const mapping = applied
    const strengths = buildStrengthLookup(snapshot.config.authStrengths?.rows ?? [])
    const coverage = computeCoverage({
      snapshot,
      tenantPolicies: snapshot.config.caPolicies?.rows ?? [],
      baselinePolicies: baseline.pkg.policies,
      baselineUnusable: baseline.pkg.report.warnings,
      strengths,
      groupMembers: groups,
      mapping: toCoverageMapping(mapping, snapshot),
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
      viability,
      strengths,
      startDate,
      band,
      operatorUserId: null,
      names,
      groupMembers: groups,
      changeFreeze: freeze,
      goalMap: baseline.goalMap,
      // What the checkpoints record about Cleanup (E3): each row's Done, and the drill dates.
      cleanupRecord: cleanupRecord(saved?.checkpoints ?? []),
    })
    const { steps, schedule } = result
    // The one decision a regeneration cannot know, and the one observation (the
    // scan that first saw each policy in report-only); everything else is derived.
    applySkips(steps, saved?.skips ?? null)
    applyProgress(steps, snapshot, coverage, planId, undefined, saved?.planCreatedAt ?? null, saved?.reportOnlySeen ?? null)
    annotateStateReasons(steps)
    return { steps, schedule, coverage, viability, names, staticViolations: result.housekeeping.staticViolations, goalMap: baseline.goalMap ?? PINNED_GOAL_MAP }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, baseline, applied, groupsLoaded, loaded, groups, saved, planId, version, startDate, band, freeze, mappingFor, groupsFor])

  // Persist the decisions only, so a Skip and the start/freeze survive a reload;
  // the plan itself is regenerated, never stored. Writing here also completes the
  // migration of a pre-50.1 record: its blob was dropped on load, and this
  // rewrites the record in the decisions-only shape (prompt 50.1 items 1-2).
  const lastPersist = useRef('')
  useEffect(() => {
    if (readOnly || !computed || !snapshot || !saved) return
    const decisions: PlanDecisions = {
      planId,
      skips: saved.skips,
      startDate: saved.startDate,
      band: saved.band,
      freeze: saved.freeze ?? null,
      checkpoints: saved.checkpoints ?? [],
      planCreatedAt: saved.planCreatedAt ?? new Date().toISOString(),
      stepDecisions: saved.stepDecisions ?? {},
      // The scan that first saw each policy in report-only, from this plan's
      // tracking: the one observation the next scan cannot make again.
      reportOnlySeen: reportOnlySeenOf(computed.steps),
      ...(saved.signature ? { signature: saved.signature } : {}),
    }
    if (saved.startedAt) decisions.startedAt = saved.startedAt
    const key = JSON.stringify({ skips: decisions.skips, startDate: decisions.startDate, startedAt: decisions.startedAt, band: decisions.band, freeze: decisions.freeze, stepDecisions: decisions.stepDecisions, reportOnlySeen: decisions.reportOnlySeen, signature: decisions.signature, cleanup: cleanupRecord(decisions.checkpoints) })
    if (key === lastPersist.current) return
    lastPersist.current = key
    void savePlanRecord(snapshot.tenantId, decisions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed, snapshot, saved])

  const bump = (): void => setVersion((v) => v + 1)
  return {
    ready: loaded && groupsLoaded,
    computed,
    // The mapping the plan derives from: the stored record with every step
    // decision applied, so a step's variables agree with the plan around it.
    mapping: applied,
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
      // A date set here anchors the start (a deliberate re-plan, §5); clearing
      // it returns the plan to proposals from today, and it is no longer started.
      setSaved((p) => ({ ...(p ?? { planId, skips: {}, checkpoints: [] }), startDate: iso ?? undefined, ...(iso === null ? { startedAt: undefined } : {}) }))
      bump()
    },
    // Started means Start the plan was pressed: a start date alone is an anchor
    // (Plan settings, or any saved plan file carries one) and is not a start.
    startedFrom: saved?.startedAt ? (saved.startDate ?? null) : null,
    startedAt: saved?.startedAt ?? null,
    startPlan: (effectiveStart) => {
      setSaved((p) => ({ ...(p ?? { planId, skips: {}, checkpoints: [] }), startDate: effectiveStart, startedAt: new Date().toISOString() }))
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
    signature: saved?.signature ?? 'IT',
    setSignature: (signature) => {
      setSaved((p) => ({ ...(p ?? { planId, skips: {}, checkpoints: [] }), signature }))
      bump()
    },
    timeZone: mapping?.displayTimeZone ?? null,
    setTimeZone: (tz) => {
      if (!mapping) return
      const next = { ...mapping, displayTimeZone: tz }
      setMapping(next)
      void saveMappingState(next)
      bump()
    },
    setNotApplicable: (stepId, reason) => {
      if (!mapping) return
      const notApplicable = { ...(mapping.notApplicable ?? {}) }
      if (reason && reason.trim().length > 0) notApplicable[stepId] = reason.trim()
      else delete notApplicable[stepId]
      const next = { ...mapping, notApplicable }
      setMapping(next)
      void saveMappingState(next)
      bump()
    },
    checkpoints: saved?.checkpoints ?? [],
    markCleanupDone: (kind, date) => {
      setSaved((p) => {
        const base = p ?? { planId, skips: {}, checkpoints: [] }
        return { ...base, checkpoints: withCleanupDone(base.checkpoints ?? [], kind, date, new Date().toISOString()) }
      })
      bump()
    },
    setNotAssessedNote: (policy, reason) => {
      if (!mapping) return
      const notAssessedNotes = { ...(mapping.notAssessedNotes ?? {}) }
      if (reason && reason.trim().length > 0) notAssessedNotes[policy] = reason.trim()
      else delete notAssessedNotes[policy]
      const next = { ...mapping, notAssessedNotes }
      setMapping(next)
      void saveMappingState(next)
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
    stepDecisions: saved?.stepDecisions ?? {},
    onDecide: (stepId, decision) => {
      // The decision is the plan's (target-state §6.4): recorded, then the plan
      // regenerates around it; the next scan verifies it.
      setSaved((p) => {
        const base = p ?? { planId, skips: {}, checkpoints: [] }
        return { ...base, stepDecisions: { ...(base.stepDecisions ?? {}), [stepId]: { ...decision, at: new Date().toISOString() } } }
      })
      bump()
    },
  }
}
