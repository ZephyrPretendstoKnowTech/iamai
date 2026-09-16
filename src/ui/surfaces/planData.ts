import type { CleanupCheckpoint } from '../../roadmap/cleanupDone.ts'
import { scopeManualBasis } from '../../roadmap/manualWork.ts'
import { customerPlanSteps } from './customerPlanSteps.ts'
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
import { notPeopleIds } from '../../derive/sets.ts'
import { activePeopleIds } from '../../derive/population.ts'
import { scoreMfaViability } from '../../scoring/mfaViability.ts'
import type { MfaViability } from '../../scoring/mfaViability.ts'
import { buildNameDirectory } from '../../names.ts'
import { generateRoadmap, planIdFor } from '../../roadmap/generate.ts'
import { annotateStateReasons } from '../../roadmap/stateReason.ts'
import { applySkips, decisionsOf, applyProgress } from '../../roadmap/progress.ts'
import { settleForecast } from '../../roadmap/forecast.ts'
import { observationsOf } from '../../roadmap/tracking.ts'
import type { PlanDecisions, StepDecision } from '../../roadmap/progress.ts'
import { appliedMapping } from './pickerRows.ts'
import { effectiveFirstDeployment, proposedStart } from '../../derive/planStart.ts'
import { HARDENING_DEFERRAL_ID } from '../../validation/emergencyTiers.ts'
import { BREAK_GLASS_STEP_ID } from '../../roadmap/stepIds.ts'
import { operatorUserId } from '../../derive/operator.ts'
import { setDisplayTimeZone } from '../../copy/dates.ts'
import { loadPlanRecord, savePlanRecord } from '../../graph/collect/cache.ts'
import { readGroup, readUserTransitiveGroupIds } from '../../graph/collect/onDemand.ts'
import type { GroupRead } from '../../graph/collect/presence.ts'
import { actionableExclusionsGroupId, directoryEvidenceOf, exclusionsGroupIdToVerify } from '../../mapping/safetyChoice.ts'
import type { DirectoryEvidence } from '../../mapping/safetyChoice.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import type { NameDirectory } from '../../names.ts'
import { PINNED_GOAL_MAP } from '../../roadmap/goalMap.ts'
import type { GoalMap } from '../../roadmap/goalMap.ts'
import type { StepDecisionInput } from '../../roadmap/decisions.ts'
import type { CleanupKind } from '../../roadmap/cleanup.ts'
import { cleanupRecord, withCleanupDone, cleanupBasis, recoveryAccountBasis, recoveryCandidateReadings, recoveryPreparation, recoveryCredentialBasis, RECOVERY_PREPARATION_WORKFLOW } from '../../roadmap/cleanupDone.ts'

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
  recordForExport: PlanDecisions | null
  persistence: 'idle' | 'saving' | 'saved' | 'failed'
  retrySave: () => void
  loadError: boolean
  retryLoad: () => void
  ready: boolean
  computed: PlanComputed | null
  mapping: MappingState | null
  startDate: string | null
  /** The first day deployment-capable work lands (derive/planStart.ts effectiveFirstDeployment); null before a start exists. */
  firstDeployment: string | null
  /** Set the first deployment day (Plan settings); null returns it to the eligible workday after the start. */
  setFirstDeployment: (iso: string | null) => void
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
  /** What this scan's directory reads established about those groups (Foundation C): present, gone, or could not tell. */
  directory: DirectoryEvidence
  /** Every picker's saved decision, by step id (prompt 52 Part 3): in the plan record and the plan file. */
  stepDecisions: Record<string, StepDecision>
  /** A picker's Save: record the decision and regenerate the plan around it. */
  onDecide: (stepId: string, decision: StepDecisionInput) => void
  /** Owner confirmations of the checks IAMAI cannot read, by step id then prerequisite id: in the plan record and the plan file. */
  confirmations: Record<string, Record<string, import('../../roadmap/decisions.ts').OwnerConfirmation>>
  /** Record confirmations for a step, each with the values it was given against. */
  onConfirm: (stepId: string, confirmed: Record<string, import('../../roadmap/decisions.ts').ManualReviewInput>) => void
  /** Withdraw a step's confirmations of these prerequisites. */
  onUnconfirm: (stepId: string, prerequisites: string[]) => void
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
  markCleanupDone: (kind: CleanupKind, date: string, accountIds?: string[], evidence?: Pick<CleanupCheckpoint, 'outcome' | 'recipient' | 'workflow' | 'purpose' | 'tenantId' | 'configurationObservedAt' | 'signInAtByAccount' | 'recoveryEvidence' | 'replacementPolicyId' | 'retiredPolicyIds' | 'coverageVerified' | 'replacementBasis' | 'reference' | 'policyNames' | 'consolidationDecision' | 'retainedPolicyIds' | 'retainedPolicyBases' | 'rationale' | 'namingChanges' | 'toolingVerified'>) => void
  /** The not-assessed Cleanup row's note for one baseline policy: does not apply, with the reason (null clears it). In the mapping, so in the plan file. */
  setNotAssessedNote: (policy: string, reason: string | null) => void
}

/** The operator's own account in the directory (derive/operator.ts: the scan's /me row; the signed-in name when the scan has none): display only, for the steps' "your own account" lines. */
export function operatorIdOf(snapshot: TenantSnapshot | null, account: { username: string } | null): string | null {
  if (!snapshot || !account) return null
  return operatorUserId(snapshot) ?? snapshot.users.find((u) => (u.userPrincipalName ?? '').toLowerCase() === account.username.toLowerCase())?.id ?? null
}

export function usePlanData(
  scan: { snapshot: TenantSnapshot; at: string } | null,
  baseline: BaselineResult | null,
  /** Compute only, never write: Connect's Plan tile counts the steps without creating or touching the plan record. */
  readOnly = false,
): PlanData {
  const snapshot = scan?.snapshot ?? null
  const planId = snapshot ? planIdFor(snapshot.tenantId) : ''
  const [mapping, setMapping] = useState<MappingState | null>(null)
  const [saved, setSaved] = useState<PlanDecisions | null>(null)
  const [persistence, setPersistence] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const persistQueue = useRef<Promise<void>>(Promise.resolve())
  const [saveAttempt, setSaveAttempt] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [mappingFailed, setMappingFailed] = useState(false)
  const pendingMapping = useRef<MappingState | null>(null)
  const persistMapping = (next: MappingState): void => {
    pendingMapping.current = next
    setMappingFailed(false)
    persistQueue.current = persistQueue.current.catch(() => {}).then(() => saveMappingState(next)).then(() => { if (pendingMapping.current === next) pendingMapping.current = null }).catch(() => { if (pendingMapping.current === next) setMappingFailed(true) })
  }
  const [groups, setGroups] = useState<GroupMembers>(new Map())
  // What this scan's own reads said about each of those groups: present, gone,
  // or could not tell (Foundation C). Recomputed with the groups on every scan
  // and never carried across one — a previous scan's reading is not evidence
  // about now.
  //
  // `partial` here is the product's honest answer and not a placeholder: the
  // reads below are the groups the tenant's policies name plus the two the
  // mapping names, so this is a record of what was asked for. Nothing may
  // conclude from it that the tenant has no exclusions group.
  const [directory, setDirectory] = useState<DirectoryEvidence>({ groups: new Map(), universe: 'partial' })
  const [groupsLoaded, setGroupsLoaded] = useState(false)
  // The snapshot each load was made for: the plan computes only when the
  // mapping and the groups belong to the snapshot on screen, so a scan (or the
  // demo's week two) never renders the new snapshot with the previous mapping —
  // not even for one render (the walk caught the old exclusions step flashing).
  const [mappingFor, setMappingFor] = useState<TenantSnapshot | null>(null)
  const [groupsFor, setGroupsFor] = useState<TenantSnapshot | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!snapshot) {
      // Forgotten or signed out (ui/actions.ts): nothing stays in memory of the tenant.
      setMapping(null)
      setSaved(null)
      setMappingFor(null)
      setGroups(new Map())
      setDirectory({ groups: new Map(), universe: 'partial' })
      setGroupsFor(null)
      setLoaded(false)
      return
    }
    // A new snapshot (a scan, the demo's week two) reloads the mapping and the
    // decisions before the plan computes again: a plan never renders from the
    // new snapshot and the previous mapping (the walk caught the old exclusions
    // step flashing on week two while the record was still loading).
    setLoaded(false)
    setLoadError(false)
    let cancelled = false
    void Promise.all([loadMappingState(snapshot.tenantId), loadPlanRecord<LegacyOrDecisions>(snapshot.tenantId)]).then(([m, p]) => {
      if (cancelled) return
      setMapping(m)
      // Read the record once for its decisions, in whatever shape it was written;
      // a pre-50.1 blob is reduced to its skips here and rewritten on the next save.
      const loadedRecord = decisionsOf(p as never, planId)
      setSaved({ ...loadedRecord, planCreatedAt: loadedRecord.planCreatedAt ?? new Date().toISOString() })
      setMappingFor(snapshot)
      setLoaded(true)
    }).catch(() => { if (!cancelled) setLoadError(true) })
    return () => {
      cancelled = true
    }
  }, [snapshot, planId, loadAttempt])

  useEffect(() => {
    if (!snapshot || !mapping || mappingFor !== snapshot) return
    // The defaults here read the policies' groups only (the loaded groups are what
    // this effect produces); every policy-referenced group is loaded regardless.
    const decided = appliedMapping({ snapshot, mapping, nameOf: (id) => id, now: snapshot.asOf }, saved?.stepDecisions)
    setGroupsLoaded(false)
    let cancelled = false
    const ids = new Set<string>()
    for (const raw of snapshot.config.caPolicies?.rows ?? []) {
      const users = (raw as { conditions?: { users?: { includeGroups?: string[]; excludeGroups?: string[] } } }).conditions?.users
      for (const g of users?.includeGroups ?? []) ids.add(g)
      for (const g of users?.excludeGroups ?? []) ids.add(g)
    }
    // Authentication-method targeting can differ from Conditional Access.
    // Load its target groups as first-class evidence rather than borrowing a
    // union of profile allow lists later.
    for (const row of snapshot.config.authMethodsPolicy?.rows ?? []) {
      const configurations = (row as { authenticationMethodConfigurations?: { id?: string; includeTargets?: { id?: string }[]; excludeTargets?: { id?: string }[] }[] }).authenticationMethodConfigurations ?? []
      for (const configuration of configurations) {
        if (configuration.id?.toLowerCase() !== 'fido2') continue
        for (const target of [...(configuration.includeTargets ?? []), ...(configuration.excludeTargets ?? [])]) {
          if (target.id && !['all_users', 'allusers'].includes(target.id.toLowerCase())) ids.add(target.id)
        }
      }
    }
    // Role assignments can target a group. User ids are already known, so the
    // remaining principals are bounded group candidates worth resolving.
    const userIds = new Set(snapshot.users.map(user => user.id.toLowerCase()))
    for (const principalId of [...Object.keys(snapshot.roles.active), ...Object.keys(snapshot.roles.eligible)]) {
      if (!userIds.has(principalId.toLowerCase())) ids.add(principalId)
    }
    // The plan's own groups too — the exclusions group and the service-accounts
    // group the mapping names — whether or not a policy references them yet:
    // the checks on the exclusions group read its members, and without them the
    // week-two demo kept a "correct the group" step for a group already right.
    // Storage only, and only to decide what to read: whatever the record holds
    // names a group this scan has to go and look at, whether an operator
    // confirmed it or an older version's detection wrote it. Reading an object
    // proves nothing about who chose it, so this is the one place the record is
    // read generously. What may go into a policy is decided afterwards, from the
    // reading and from the checks (mapping/safetyChoice.ts).
    const ge = exclusionsGroupIdToVerify(decided)
    if (ge) ids.add(ge)
    if (decided.serviceAccountsGroupId) ids.add(decided.serviceAccountsGroupId)
    void (async () => {
      const map: GroupMembers = new Map()
      const reads: GroupRead[] = []
      for (const id of ids) {
        // Existence and membership are read as two facts and kept as two
        // (readGroup): a group Graph says is gone is absent, a request that
        // failed leaves it unknown, and a group that exists whose members would
        // not enumerate is present with no member count invented for it.
        const r = await readGroup(snapshot.tenantId, id, { since: snapshot.asOf })
        reads.push(r)
        if (r.presence === 'present' && r.members !== 'unknown' && r.memberCount !== null) {
          map.set(id, { memberIds: r.memberIds, memberCount: r.memberCount, sampled: r.members === 'sampled', displayName: r.object?.displayName ?? null, membershipRule: r.object?.membershipRule ?? null, mailEnabled: r.object?.mailEnabled, securityEnabled: r.object?.securityEnabled ?? null, groupTypes: r.object?.groupTypes ?? null, isAssignableToRole: r.object?.isAssignableToRole ?? null })
        }
      }
      if (reads.some(read => read.members === 'sampled' || read.members === 'unknown')) {
        for (const accountId of decided.breakGlassUserIds) {
          const memberships = await readUserTransitiveGroupIds(accountId)
          if (!memberships) continue
          const effective = new Set(memberships.map(id => id.toLowerCase()))
          for (const [groupId, group] of map) {
            if (effective.has(groupId.toLowerCase()) && !group.memberIds.some(id => id.toLowerCase() === accountId.toLowerCase())) group.memberIds.push(accountId)
          }
        }
      }
      if (!cancelled) {
        setGroups(map)
        setDirectory(directoryEvidenceOf(reads))
        setGroupsFor(snapshot)
        setGroupsLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [snapshot, mapping, mappingFor, saved])

  // Every picker's detected default, then every saved step decision, applied to
  // the stored mapping (target-state §6.4): the plan, its checks and its
  // variables derive from this, never from the stored record alone. The default
  // is the plan's decision until the person changes it; a Save only overrides.
  const applied = useMemo<MappingState | null>(() => {
    if (!mapping || !snapshot) return null
    const nameOf = (id: string): string => groups.get(id)?.displayName ?? id
    return appliedMapping({ snapshot, mapping, nameOf, groups, now: snapshot.asOf }, saved?.stepDecisions)
  }, [mapping, saved, snapshot, groups])
  // The default start is today in the display zone (derive/planStart.ts),
  // proposed again on every visit until Start the plan anchors a date; the
  // schedule clamps a weekend to the working day after it.
  const startDate = saved?.startDate ?? (snapshot ? proposedStart(mapping?.displayTimeZone ?? null) : null)
  // The first deployment (owner, 2026-09-11): preparation begins on the start,
  // deployment-capable work on the eligible workday after it unless a day was
  // saved; a plan started before the setting existed keeps deploying from its
  // start, so its dates do not move.
  const firstDeployment = startDate ? effectiveFirstDeployment(startDate, saved) : null
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
      // Only a group the operator confirmed and this scan read carves anybody
      // out of a policy's reach (Foundation C).
      mapping: toCoverageMapping(mapping, actionableExclusionsGroupId({ snapshot, mapping, groups, directory })),
      facetOverrides: mapping.facetOverrides,
      goalMap: baseline.goalMap,
    })
    const viability = buildViabilityInputs(snapshot, snapshot.asOf, notPeopleIds(mapping)).map(scoreMfaViability)
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
      firstDeployment,
      band,
      operatorUserId: null,
      names,
      groupMembers: groups,
      directory,
      changeFreeze: freeze,
      goalMap: baseline.goalMap,
      // What the checkpoints record about Cleanup (E3): each row's Done, and the drill dates.
      manualConfirmations: saved?.confirmations ?? {},
      cleanupRecord: cleanupRecord(saved?.checkpoints ?? []),
      reviewNow: new Date().toISOString(),
      // The operator's deferral of the emergency-access hardening, where one is recorded (validation/emergencyTiers.ts).
      hardeningDeferral: saved?.confirmations?.[BREAK_GLASS_STEP_ID]?.[HARDENING_DEFERRAL_ID] ?? null,
    })
    const { schedule } = result
    // Temporarily withheld from all customer plan surfaces, including Export.
    // Keep the underlying baseline assessment and execution safeguards intact.
    const steps = customerPlanSteps(result.steps)
    // The one decision a regeneration cannot know, and the one observation (the
    // scan that first saw each policy in report-only); everything else is derived.
    applySkips(steps, saved?.skips ?? null)
    applyProgress(steps, snapshot, coverage, planId, undefined, saved?.planCreatedAt ?? null, saved?.observations ?? null, {
      // A deployed policy's scope is resolved against the group memberships the
      // scan actually read; a sampled list proves nobody out, so it answers
      // nothing (generate.ts knownGroupMembers).
      groupMembers: Object.fromEntries([...groups].filter(([, g]) => g.sampled !== true).map(([id, g]) => [id.toLowerCase(), g.memberIds])),
      activePeople: activePeopleIds(snapshot, snapshot.asOf, notPeopleIds(mapping)),
    })
    // Tracking has settled every lifecycle, so the schedule's own forecast can be
    // taken off the steps it was never earned for: an enforcement wave and an
    // enforce event were placed on every step before the scan found which
    // policies already exist (roadmap/forecast.ts settleForecast).
    settleForecast(steps, schedule)
    annotateStateReasons(steps)
    return { steps, schedule, coverage, viability, names, staticViolations: result.housekeeping.staticViolations, goalMap: baseline.goalMap ?? PINNED_GOAL_MAP }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, baseline, applied, groupsLoaded, loaded, groups, directory, saved, planId, version, startDate, firstDeployment, band, freeze, mappingFor, groupsFor])

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
      ...(saved.confirmations && Object.keys(saved.confirmations).length > 0 ? { confirmations: saved.confirmations } : {}),
      // What this scan saw of each step's policy, over what the record already
      // held: the one history the next scan cannot work out for itself
      // (roadmap/observation.ts). A scan updates it and never replaces it — the
      // steps this scan derived are not every step the plan has ever had, and a
      // goal this scan could not assess is not a rollout that never happened
      // (tracking.ts observationsOf).
      observations: observationsOf(computed.steps, saved.observations ?? null),
      ...(saved.signature ? { signature: saved.signature } : {}),
    }
    if (saved.startedAt) decisions.startedAt = saved.startedAt
    if (saved.firstDeployment) decisions.firstDeployment = saved.firstDeployment
    const key = JSON.stringify({ tenantId: snapshot.tenantId, skips: decisions.skips, startDate: decisions.startDate, startedAt: decisions.startedAt, firstDeployment: decisions.firstDeployment, band: decisions.band, freeze: decisions.freeze, stepDecisions: decisions.stepDecisions, confirmations: decisions.confirmations, observations: decisions.observations, signature: decisions.signature, cleanup: cleanupRecord(decisions.checkpoints) })
    if (key === lastPersist.current) return
    lastPersist.current = key
    setPersistence('saving')
    persistQueue.current = persistQueue.current.catch(() => {}).then(() => savePlanRecord(snapshot.tenantId, decisions)).then(() => {
      if (lastPersist.current === key) setPersistence('saved')
    }).catch(() => {
      if (lastPersist.current === key) { lastPersist.current = ''; setPersistence('failed') }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed, snapshot, saved, saveAttempt])

  const bump = (): void => setVersion((v) => v + 1)
  return {
    persistence: mappingFailed ? 'failed' : persistence,
    loadError,
    retryLoad: () => setLoadAttempt(value => value + 1),
    retrySave: () => { if (pendingMapping.current) persistMapping(pendingMapping.current); setSaveAttempt(value => value + 1) },
    recordForExport: saved ? { ...saved, observations: observationsOf(computed?.steps ?? [], saved.observations ?? null) } : null,
    ready: loaded && groupsLoaded,
    computed,
    // The mapping the plan derives from: the stored record with every step
    // decision applied, so a step's variables agree with the plan around it.
    mapping: applied,
    startDate,
    band,
    freeze,
    groups,
    directory,
    saveMapping: (next) => {
      setMapping(next)
      persistMapping(next)
      bump()
    },
    firstDeployment,
    setStart: (iso) => {
      // A date set here anchors the start (a deliberate re-plan, §5); clearing
      // it returns the plan to proposals from today, and it is no longer started.
      // A saved first deployment the new start would put before it goes back to
      // the default: deployment never lands before the plan starts.
      setSaved((p) => ({
        ...(p ?? { planId, skips: {}, checkpoints: [] }),
        startDate: iso ?? undefined,
        firstDeployment: iso !== null && p?.firstDeployment && p.firstDeployment >= iso ? p.firstDeployment : undefined,
        ...(iso === null ? { startedAt: undefined } : {}),
      }))
      bump()
    },
    setFirstDeployment: (iso) => {
      setSaved((p) => ({ ...(p ?? { planId, skips: {}, checkpoints: [] }), firstDeployment: iso ?? undefined }))
      bump()
    },
    // Started means Start the plan was pressed: a start date alone is an anchor
    // (Plan settings, or any saved plan file carries one) and is not a start.
    startedFrom: saved?.startedAt ? (saved.startDate ?? null) : null,
    startedAt: saved?.startedAt ?? null,
    startPlan: (effectiveStart) => {
      // Starting anchors the first deployment with the start, so a later visit
      // (or a change to the default) never moves the dates of a started plan.
      setSaved((p) => ({ ...(p ?? { planId, skips: {}, checkpoints: [] }), startDate: effectiveStart, firstDeployment: effectiveFirstDeployment(effectiveStart, p), startedAt: new Date().toISOString() }))
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
      persistMapping(next)
      bump()
    },
    setNotApplicable: (stepId, reason) => {
      if (!mapping) return
      const notApplicable = { ...(mapping.notApplicable ?? {}) }
      if (reason && reason.trim().length > 0) notApplicable[stepId] = reason.trim()
      else delete notApplicable[stepId]
      const next = { ...mapping, notApplicable }
      setMapping(next)
      persistMapping(next)
      bump()
    },
    checkpoints: saved?.checkpoints ?? [],
    markCleanupDone: (kind, date, accountIds = [], evidence = {}) => {
      const phase = computed?.schedule.cleanup
      const row = phase?.rows.find((r) => r.kind === kind)
      if (!phase || !row) return
      const currentBasis = snapshot ? recoveryAccountBasis(snapshot, accountIds, mapping ?? undefined, groups) : {}
      if (kind === 'drill' && evidence.workflow === RECOVERY_PREPARATION_WORKFLOW) {
        const configurationReady = phase.recoveryFindings?.find(finding => finding.key === 'recovery-configuration')?.outcome === 'pass'
        if (!snapshot || !evidence.purpose || (evidence.purpose === 'final' && !configurationReady) || accountIds.length === 0 || accountIds.some(id => !phase.accountIds.includes(id) || !currentBasis[id]) || evidence.tenantId !== snapshot.tenantId || evidence.configurationObservedAt !== snapshot.asOf) return
      }
      if (kind === 'drill' && evidence.outcome === 'passed') {
        if (!snapshot || !evidence.purpose || accountIds.length === 0 || accountIds.some(id => !phase.accountIds.includes(id))) return
        const valid = accountIds.every(id => {
          const recorded = evidence.recoveryEvidence?.[id]
          const preparation = recoveryPreparation(id, cleanupRecord(saved?.checkpoints ?? []).records ?? [], snapshot.asOf, currentBasis[id], snapshot.tenantId, evidence.purpose)
          const configurationObservedAt = preparation?.configurationObservedAt ?? null
          const observed = recoveryCandidateReadings(snapshot, id, snapshot.asOf, configurationObservedAt).find(reading => reading.qualifies && reading.candidate.eventId === recorded?.eventId)?.candidate
          return !!recorded && recorded.purpose === evidence.purpose && !!observed && !!configurationObservedAt && recorded.schema === 1 && recorded.tenantId === snapshot.tenantId && recorded.accountId.toLowerCase() === id.toLowerCase() && recorded.eventAt === observed.at && recorded.appId === observed.appId && recorded.resourceId === observed.resourceId && recorded.method === observed.method && recorded.provenance === 'observed-sign-in' && recorded.configurationObservedAt === configurationObservedAt && Date.parse(recorded.eventAt) >= Date.parse(configurationObservedAt) && Date.parse(snapshot.asOf) >= Date.parse(recorded.eventAt) && recorded.recoveryConfirmed === true && recorded.credentialConfirmed === true && !!currentBasis[id]
        })
        if (!valid) return
      }
      const basis = cleanupBasis(kind, row.lists, kind === 'drill' || kind === 'alerting' ? phase?.accountIds ?? [] : [])
      setSaved((p) => {
        const base = p ?? { planId, skips: {}, checkpoints: [] }
        return { ...base, checkpoints: withCleanupDone(base.checkpoints ?? [], kind, date, new Date().toISOString(), { ...evidence, basis, accountIds, ...(snapshot && (kind === 'drill' || kind === 'alerting') ? { accountBasis: recoveryAccountBasis(snapshot, accountIds, mapping ?? undefined, groups) } : {}), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) }
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
      persistMapping(next)
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
      const next = { ...mapping, breakGlassAnswers: { ...prev, [key]: done }, ...(key === 'credentialStorage' ? { breakGlassCustodyBasis: done && snapshot ? recoveryCredentialBasis(snapshot, mapping.breakGlassUserIds) : {} } : {}) }
      setMapping(next)
      persistMapping(next)
      bump()
    },
    stepDecisions: saved?.stepDecisions ?? {},
    onDecide: (stepId, decision) => {
      // A custody answer about the previous set cannot vouch for a new account.
      if (stepId === BREAK_GLASS_STEP_ID && decision.picked && mapping && applied) {
        const same = [...decision.picked].sort().join('|') === [...applied.breakGlassUserIds].sort().join('|')
        if (!same) {
          const next = { ...mapping, breakGlassAnswers: { ...(mapping.breakGlassAnswers ?? { credentialStorage: null, signInMonitoring: null }), credentialStorage: null }, breakGlassCustodyBasis: {} }
          setMapping(next)
          persistMapping(next)
        }
      }
      // The decision is the plan's (target-state §6.4): recorded, then the plan
      // regenerates around it; the next scan verifies it.
      setSaved((p) => {
        const base = p ?? { planId, skips: {}, checkpoints: [] }
        return { ...base, stepDecisions: { ...(base.stepDecisions ?? {}), [stepId]: { ...decision, at: new Date().toISOString() } } }
      })
      bump()
    },
    confirmations: saved?.confirmations ?? {},
    onConfirm: (stepId, confirmed) => {
      // A person's word about a check IAMAI cannot read from Microsoft, kept with
      // the values it was given against (content/implementation/project.ts
      // prerequisiteBasis): it holds across scans while they hold, and the next
      // scan that finds them changed no longer counts it.
      const at = new Date().toISOString()
      const stamped = Object.fromEntries(Object.entries(confirmed).map(([id, c]) => [id, { ...c, basis: scopeManualBasis(c.basis, c), at }]))
      setSaved((p) => {
        const base = p ?? { planId, skips: {}, checkpoints: [] }
        const all = base.confirmations ?? {}
        return { ...base, confirmations: { ...all, [stepId]: { ...(all[stepId] ?? {}), ...stamped } } }
      })
      bump()
    },
    onUnconfirm: (stepId, prerequisites) => {
      setSaved((p) => {
        if (!p?.confirmations?.[stepId]) return p
        const kept = Object.fromEntries(Object.entries(p.confirmations[stepId]).filter(([id]) => !prerequisites.includes(id)))
        const next = { ...p.confirmations }
        if (Object.keys(kept).length > 0) next[stepId] = kept
        else delete next[stepId]
        return { ...p, confirmations: next }
      })
      bump()
    },
  }
}

/**
 * The population's mapping for a surface that computes no plan (Today): the
 * stored record and the saved decisions, with the detected defaults applied
 * (pickerRows.ts appliedMapping), so its facts (derive/facts.ts) are the
 * Plan's and Connect's. Null until both records have loaded for this snapshot.
 */
export function useAppliedMapping(snapshot: TenantSnapshot | null): MappingState | null {
  const [state, setState] = useState<{ snapshot: TenantSnapshot; mapping: MappingState } | null>(null)
  useEffect(() => {
    if (!snapshot) {
      setState(null)
      return
    }
    let cancelled = false
    void Promise.all([loadMappingState(snapshot.tenantId), loadPlanRecord<LegacyOrDecisions>(snapshot.tenantId)]).then(([m, p]) => {
      if (cancelled) return
      const saved = decisionsOf(p as never, planIdFor(snapshot.tenantId))
      setState({ snapshot, mapping: appliedMapping({ snapshot, mapping: m, nameOf: (id) => id, now: snapshot.asOf }, saved?.stepDecisions) })
    })
    return () => {
      cancelled = true
    }
  }, [snapshot])
  return state && state.snapshot === snapshot ? state.mapping : null
}
