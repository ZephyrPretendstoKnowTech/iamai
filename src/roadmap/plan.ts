// The plan file (docs/design/plan-file.md) — JSON in v1; the self-contained
// HTML wrapper is a later prompt. Pure.
import type { CoverageReport } from '../coverage/types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import { emptyMappingState } from '../mapping/types.ts'
import type { TenantMfaSummary } from '../scoring/mfaViability.ts'
import type { Step } from './types.ts'
import type { PlanDecisions, StepDecision } from './decisions.ts'
import { engine } from '../content/content.ts'

export const PLAN_SCHEMA_VERSION = 2

export type Checkpoint = {
  at: string
  coverage: { goalId: string; state: string }[]
  tenantPolicies: {
    id: string
    state: string
    microsoftManaged: boolean
    laneB: { reportOnlyFailure: number; reportOnlyInterrupted: number; enforcedFailure: number; enforcedSuccess: number } | null
  }[]
  mfaStateCounts: TenantMfaSummary['counts']
  activityCounts: TenantMfaSummary['activityCounts']
  /** Member ids as well as the count, so a later scan can name who arrived (prompt 44 item 14). */
  exclusionGroups: { groupId: string; memberCount: number; memberIds?: string[] }[]
  breakGlass: { userId: string; lastSignIn: string | null }[]
  /** Active admins at the checkpoint, so "admins added" is knowable (v2). */
  adminIds?: string[]
  capabilities: TenantSnapshot['capabilities']
  laneBCoveredWindow: { from: string; to: string } | null
}

export type PlanFile = {
  /** A header a person can read in a text editor (ux-review-07 §33); ignored on load. */
  _readme?: string[]
  schemaVersion: number
  createdAt: string
  displayTimeZone: string
  planId: string
  tenant: {
    id: string
    name: string
    domains: string[]
    operator: { userId: string; userPrincipalName: string }
  }
  baseline: {
    source: { kind: 'github'; owner: string; repo: string; commit: string } | { kind: 'upload'; fileName: string }
    variantChoices: { familyKey: string; chosenPolicyName: string }[]
  }
  mappings: MappingState
  steps: Step[]
  /**
   * The decisions the plan was built from (prompt 50.1 item 1): skips, start
   * date, freeze, checkpoints. On load these are taken and the plan is
   * regenerated from the connected tenant; the steps above are the regenerated
   * plan at save time, kept so the file reads on its own, never trusted back.
   * Absent in a pre-50.1 file, in which case the decisions are recovered from the
   * steps and schedule.
   */
  decisions?: PlanDecisions
  checkpoints: Checkpoint[]
  /** Pacing choices travel with the plan (prompt 13 audit). */
  schedule?: { startDate: string; band?: string; pace?: string; owner?: string; freeze?: { from: string; to: string } | null }
  // ---- v2 (roadmap-v2.md §6) ----
  /** Counts up on every re-plan that changes the step set or the baseline pin. */
  revision: number
  revisions: { revision: number; at: string; note: string }[]
  /** The baseline commit the plan was generated from. */
  baselinePin: string | null
}

export function makeCheckpoint(args: {
  snapshot: TenantSnapshot
  coverage: CoverageReport
  summary: TenantMfaSummary
  exclusionGroups: { groupId: string; memberCount: number; memberIds?: string[] }[]
  breakGlassIds: string[]
}): Checkpoint {
  const { snapshot, coverage } = args
  const managed = new Set(snapshot.microsoftManagedPolicyIds)
  return {
    at: new Date().toISOString(),
    coverage: coverage.results.map((r) => ({ goalId: r.goal.id, state: r.status })),
    tenantPolicies: (snapshot.config.caPolicies?.rows ?? []).map((raw) => {
      const p = raw as { id?: string; state?: string }
      const id = String(p.id ?? '')
      const laneB = snapshot.evidencePolicyResults.find((x) => x.policyId === id)
      return {
        id,
        state: String(p.state ?? 'unknown'),
        microsoftManaged: managed.has(id),
        laneB: laneB
          ? {
              reportOnlyFailure: laneB.counts.reportOnlyFailure,
              reportOnlyInterrupted: laneB.counts.reportOnlyInterrupted,
              enforcedFailure: laneB.counts.enforcedFailure,
              enforcedSuccess: laneB.counts.enforcedSuccess,
            }
          : null,
      }
    }),
    mfaStateCounts: args.summary.counts,
    activityCounts: args.summary.activityCounts,
    exclusionGroups: args.exclusionGroups,
    breakGlass: args.breakGlassIds.map((userId) => ({
      userId,
      lastSignIn: snapshot.users.find((u) => u.id === userId)?.lastSuccessfulSignIn ?? null,
    })),
    adminIds: Object.keys(snapshot.roles.active),
    capabilities: snapshot.capabilities,
    laneBCoveredWindow: snapshot.sources.signInEvidence?.coveredWindow ?? null,
  }
}

// First checkpoint plus the last 20 (plan-file.md).
export function trimCheckpoints(checkpoints: Checkpoint[]): Checkpoint[] {
  if (checkpoints.length <= 21) return checkpoints
  return [checkpoints[0], ...checkpoints.slice(-20)]
}

/**
 * A step as the plan file keeps it (prompt 53 queue item 7): every number, date,
 * status, id and the policy body, with the v2 engine's prose fields emptied —
 * what-changes, exit criteria, failure modes, the help desk, comms, the ring
 * criteria, the engine's portal steps — because no v3 surface renders them and
 * their vocabulary is the contract's forbidden list. The file still reads on its
 * own (title, status, dates, who) and loads back exactly as before: only the
 * decisions block is trusted on load.
 */
export function fileStep(s: Step): Step {
  return {
    ...s,
    comms: null,
    forManager: '',
    unblockNotes: [],
    cantSee: [],
    dateNotes: [],
    scenarioLines: [],
    operatorNote: null,
    readiness: { ...s.readiness, lines: [] },
    evidence: { ...s.evidence, lines: [] },
    action: { ...s.action, summary: [], portalSteps: [], powershell: null },
  }
}

export function buildPlanFile(args: {
  planId: string
  snapshot: TenantSnapshot
  operator: { userId: string; userPrincipalName: string }
  baselineSource: PlanFile['baseline']['source']
  mapping: MappingState
  steps: Step[]
  checkpoints: Checkpoint[]
  schedule?: { startDate: string; band?: string; pace?: string; owner?: string; freeze?: { from: string; to: string } | null }
  revision?: number
  revisions?: PlanFile['revisions']
  /** Every picker's saved decision (prompt 52 Part 3); round-trips through the decisions block. */
  stepDecisions?: Record<string, StepDecision>
  /** When Start the plan was pressed (prompt 52 Part 5); the start date above is then anchored. */
  startedAt?: string
}): PlanFile {
  const org = (args.snapshot.config.organization?.rows?.[0] ?? {}) as {
    displayName?: string
    verifiedDomains?: { name?: string }[]
  }
  const generated = new Date().toISOString()
  return {
    _readme: [
      `IAMAI plan file for ${org.displayName ?? args.snapshot.tenantId} (plan ${args.planId}), schema ${PLAN_SCHEMA_VERSION}, generated ${generated}.`,
      `Baseline: ${args.baselineSource.kind === 'github' ? `${args.baselineSource.owner}/${args.baselineSource.repo} at ${args.baselineSource.commit}` : args.baselineSource.fileName}.`,
      'Format: steps (with rings, evidence, history and dates), the mappings, the decisions, checkpoints from each save, and the revision record. Load it back in IAMAI on any machine; nothing here is needed by the tenant.',
      'IAMAI reads the tenant and never writes to it.',
    ],
    schemaVersion: PLAN_SCHEMA_VERSION,
    createdAt: generated,
    displayTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    planId: args.planId,
    tenant: {
      id: args.snapshot.tenantId,
      name: org.displayName ?? '',
      domains: (org.verifiedDomains ?? []).map((d) => d.name ?? '').filter(Boolean),
      operator: args.operator,
    },
    baseline: {
      source: args.baselineSource,
      variantChoices: Object.entries(args.mapping.variantChoices).map(([familyKey, chosenPolicyName]) => ({
        familyKey,
        chosenPolicyName,
      })),
    },
    mappings: args.mapping,
    steps: args.steps.map(fileStep),
    decisions: {
      planId: args.planId,
      skips: Object.fromEntries(
        args.steps.filter((s) => s.status === 'skipped').map((s) => [s.id, { reason: s.skipReason ?? '', at: s.history.find((h) => h.to === 'skipped')?.at ?? generated }]),
      ),
      ...(args.schedule?.startDate ? { startDate: args.schedule.startDate } : {}),
      ...(args.startedAt ? { startedAt: args.startedAt } : {}),
      ...(args.schedule?.band ? { band: args.schedule.band as PlanDecisions['band'] } : {}),
      freeze: args.schedule?.freeze ?? null,
      checkpoints: trimCheckpoints(args.checkpoints),
      stepDecisions: args.stepDecisions ?? {},
    },
    checkpoints: trimCheckpoints(args.checkpoints),
    ...(args.schedule ? { schedule: args.schedule } : {}),
    revision: args.revision ?? 1,
    revisions: args.revisions ?? [{ revision: 1, at: new Date().toISOString(), note: engine.planFile.revisionCreated }],
    baselinePin: args.baselineSource.kind === 'github' ? args.baselineSource.commit : null,
  }
}

export function parsePlanFile(text: string): { plan: PlanFile | null; error: string | null } {
  try {
    const parsed = JSON.parse(text) as PlanFile
    if (typeof parsed.schemaVersion !== 'number' || !Array.isArray(parsed.steps)) {
      return { plan: null, error: 'not a plan file (missing schemaVersion or steps)' }
    }
    if (parsed.schemaVersion > PLAN_SCHEMA_VERSION) {
      return { plan: null, error: `plan file is newer (schema ${parsed.schemaVersion}) than this app understands: update the app` }
    }
    return { plan: upgradePlanFile(parsed), error: null }
  } catch (e) {
    return { plan: null, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Older plan files load with defaults for what they lack: pre-1 files had no
 * checkpoints and no travelling Setup answers; v1 files (prompt 20) had no
 * rings, owners, scheduled dates, tracking, history evidence or revisions
 * (roadmap-v2.md §6). A v1 file becomes an equivalent v2 plan: every step,
 * status, history entry, skip reason, Setup answer and checkpoint kept.
 */
export function upgradePlanFile(parsed: PlanFile): PlanFile {
  if (parsed.schemaVersion >= PLAN_SCHEMA_VERSION) return parsed
  const tenantId = parsed.tenant?.id ?? parsed.mappings?.tenantId ?? ''
  const base: PlanFile = {
    ...parsed,
    tenant: parsed.tenant ?? { id: tenantId, name: '', domains: [], operator: { userId: '', userPrincipalName: '' } },
    baseline: parsed.baseline ?? { source: { kind: 'upload', fileName: 'unknown' }, variantChoices: [] },
    mappings: parsed.mappings ?? emptyMappingState(tenantId),
    checkpoints: Array.isArray(parsed.checkpoints) ? parsed.checkpoints : [],
  }
  const at = new Date().toISOString()
  return {
    ...base,
    schemaVersion: PLAN_SCHEMA_VERSION,
    steps: base.steps.map((s) => upgradeStep(s)),
    revision: typeof parsed.revision === 'number' ? parsed.revision : 1,
    revisions: Array.isArray(parsed.revisions) ? parsed.revisions : [{ revision: 1, at, note: engine.planFile.revisionImported }],
    baselinePin: parsed.baselinePin ?? (base.baseline.source.kind === 'github' ? base.baseline.source.commit : null),
  }
}

/** A v1 step gains the v2 fields with honest defaults; nothing it had is lost. */
function upgradeStep(s: Step): Step {
  const p = s as Partial<Step> & Step
  return {
    ...s,
    rings: Array.isArray(p.rings) ? p.rings : [],
    currentRing: typeof p.currentRing === 'number' ? p.currentRing : 0,
    owner: p.owner ?? null,
    tracking: p.tracking ?? null,
    events: p.events ?? null,
    plainTitle: p.plainTitle ?? s.title,
    forManager: p.forManager ?? '',
    history: Array.isArray(s.history) ? s.history : [],
  }
}
