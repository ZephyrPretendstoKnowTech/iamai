// The plan file (docs/design/plan-file.md) — JSON in v1; the self-contained
// HTML wrapper is a later prompt. Pure.
import type { CoverageReport } from '../coverage/types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import type { TenantMfaSummary } from '../scoring/mfaViability.ts'
import type { Step } from './types.ts'

export const PLAN_SCHEMA_VERSION = 1

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
  exclusionGroups: { groupId: string; memberCount: number }[]
  breakGlass: { userId: string; lastSignIn: string | null }[]
  capabilities: TenantSnapshot['capabilities']
  laneBCoveredWindow: { from: string; to: string } | null
}

export type PlanFile = {
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
  checkpoints: Checkpoint[]
  /** Pacing choices travel with the plan (prompt 13 audit). */
  schedule?: { startDate: string; band?: string; pace?: string }
}

export function makeCheckpoint(args: {
  snapshot: TenantSnapshot
  coverage: CoverageReport
  summary: TenantMfaSummary
  exclusionGroups: { groupId: string; memberCount: number }[]
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
    capabilities: snapshot.capabilities,
    laneBCoveredWindow: snapshot.sources.signInEvidence?.coveredWindow ?? null,
  }
}

// First checkpoint plus the last 20 (plan-file.md).
export function trimCheckpoints(checkpoints: Checkpoint[]): Checkpoint[] {
  if (checkpoints.length <= 21) return checkpoints
  return [checkpoints[0], ...checkpoints.slice(-20)]
}

export function buildPlanFile(args: {
  planId: string
  snapshot: TenantSnapshot
  operator: { userId: string; userPrincipalName: string }
  baselineSource: PlanFile['baseline']['source']
  mapping: MappingState
  steps: Step[]
  checkpoints: Checkpoint[]
  schedule?: { startDate: string; band?: string; pace?: string }
}): PlanFile {
  const org = (args.snapshot.config.organization?.rows?.[0] ?? {}) as {
    displayName?: string
    verifiedDomains?: { name?: string }[]
  }
  return {
    schemaVersion: PLAN_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
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
    steps: args.steps,
    checkpoints: trimCheckpoints(args.checkpoints),
    ...(args.schedule ? { schedule: args.schedule } : {}),
  }
}

export function parsePlanFile(text: string): { plan: PlanFile | null; error: string | null } {
  try {
    const parsed = JSON.parse(text) as PlanFile
    if (typeof parsed.schemaVersion !== 'number' || !Array.isArray(parsed.steps)) {
      return { plan: null, error: 'not a plan file (missing schemaVersion or steps)' }
    }
    if (parsed.schemaVersion > PLAN_SCHEMA_VERSION) {
      return { plan: null, error: `plan file is newer (schema ${parsed.schemaVersion}) than this app understands — update the app` }
    }
    return { plan: parsed, error: null }
  } catch (e) {
    return { plan: null, error: e instanceof Error ? e.message : String(e) }
  }
}
