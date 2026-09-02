// The tenant's values for a content step's variables (prompt 51 §8.9). Each
// content step's `example` block names exactly the variables that step renders;
// this produces those same keys from the tenant instead of the sample, so the
// content renderer fills content.json prose with real values. A key this cannot
// derive (a signal the read-only scan does not collect) is left undefined, and
// the renderer's fill/gating drops the line through content's own none-branch —
// never a fabricated value.
//
// Pure: no DOM, no network. The heavy per-scenario lists come from the roadmap
// Step the engine already computed (population, names, dates, naming); the
// content variables are a view over that, not a re-derivation.
import type { Step } from '../../roadmap/types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { MappingState } from '../../mapping/types.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { policiesForGoal, PINNED_GOAL_MAP } from '../../roadmap/goalMap.ts'
import { contentLists } from '../../derive/contentLists.ts'
import { initialDomain } from '../../validation/rules.ts'
import { EXIT_MIN_DAYS_OBSERVED } from '../../roadmap/constants.ts'

export type StepVarContext = {
  snapshot: TenantSnapshot
  mapping: MappingState
  nameOf: (id: string) => string
  /** The technician's sign-off name, from Plan settings (default "IT"). */
  signature: string
  /** The operator's own account id, when in scope, for the operator-evidence line. */
  operatorId: string | null
  /** As-of time for the campaign buckets (usually snapshot.asOf). */
  now: string
  /** The plan's first enforcement date (ISO): the campaign's enrol-by and firstEnforce. */
  firstEnforce?: string | null
}

/** A long, spelled-out date: "Tuesday, September 8". */
function longDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  try {
    return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(iso))
  } catch {
    return undefined
  }
}

function orgName(snapshot: TenantSnapshot): string {
  const org = snapshot.config.organization?.rows?.[0] as { displayName?: string } | undefined
  return org?.displayName ?? ''
}

/**
 * The values for a content step's variables. Only the keys the step uses are
 * produced (the renderer reads the content step's own example keys); a missing
 * key gates its line off. Lists come as name arrays already resolved.
 */
export function stepVars(step: Step, ctx: StepVarContext): Record<string, unknown> {
  const pop = step.population
  const ev = step.events
  const enforce = ev?.enforce
  const announce = ev?.announce
  const v: Record<string, unknown> = {
    tenant: orgName(ctx.snapshot),
    tenantName: orgName(ctx.snapshot),
    active: pop.active,
    admins: pop.admins,
    guests: pop.guests,
    total: pop.total,
    inScope: pop.inScope ?? pop.total,
    adminCount: pop.admins,
    memberCount: pop.total,
    signature: ctx.signature,
    // Dates: the engine's per-step events, as the day and the spelled-out form.
    enforce: enforce?.date,
    enforceLong: longDate(enforce?.at),
    firstEnforce: enforce?.date,
    firstEnforceLong: longDate(enforce?.at),
    announce: announce?.date,
    // The proposed policy name, in the tenant's convention.
    policyName: step.naming?.proposed,
    proposedName: step.naming?.proposed,
    existingName: step.naming?.fromBaseline ?? undefined,
    // The operator's own sign-in count, when the operator is in scope.
    operatorSignIns: ctx.operatorId ? operatorSignIns(ctx.snapshot, ctx.operatorId) : undefined,
    // Everyone under 25, else the riskiest — the engine's own populationNames.
    people: pop.active,
    n: pop.active,
    // The step's readiness, as the percentage the content line names.
    readiness: step.readiness?.percent != null ? `${step.readiness.percent}%` : undefined,
    // The report-only observation window a policy done-when line names.
    reportOnlyDays: EXIT_MIN_DAYS_OBSERVED,
  }

  // A campaign has no enforcement date of its own; its enrol-by and the first
  // policy's enforcement are the plan's first enforcement date (walk-51 item 2,
  // target-state §9).
  if (!enforce && ctx.firstEnforce) {
    v.firstEnforce = absoluteDate(ctx.firstEnforce)
    v.firstEnforceLong = longDate(ctx.firstEnforce)
    v.enrollBy = absoluteDate(ctx.firstEnforce)
  }

  // The two-policy (merged) goals carry A/B names.
  const mapped = policiesForGoal(PINNED_GOAL_MAP, snapshotPolicyKeys(), step.goalId)
  if (mapped.length >= 2) {
    v.policyNameA = step.naming?.proposed
    v.policyNameB = step.naming?.proposed
  }

  // Existing coverage: whether a policy already delivers the goal (drives the
  // {existingCoverage} line's presence).
  v.existingPolicies = step.deliveredBy.length > 0 ? step.deliveredBy : []

  // The list variables, derived from what the scan collected (never gated when
  // the data exists): the campaign buckets, the lockout-scenario people, and the
  // emergency/service/admin id sets. A step reads only the keys it uses.
  Object.assign(v, contentLists({ snapshot: ctx.snapshot, mapping: ctx.mapping, nameOf: ctx.nameOf, now: ctx.now, operatorId: ctx.operatorId }))

  // The emergency-access and exclusions-group steps (walk-51 item 14): the
  // failing checks routed through the content checkFixes, the counts for the
  // "{failing} of {total}" line, the operator's own account and the tenant id
  // from the session, and the values the create instructions name.
  if (step.checks) {
    v.failing = step.checks.failing
    v.total = step.checks.total
    v.failingChecks = step.checks.items.map((it) => {
      const vals: Record<string, unknown> = { ...it.values }
      if (it.subject === 'breakGlass' && it.target && vals.name === undefined) vals.name = ctx.nameOf(it.target)
      return [it.fix, vals]
    })
    // Fewer than two accounts pass the count check: the create instructions show.
    v.needsCreate = step.checks.items.some((it) => it.fix === 'second-account')
    // The policies that do not yet exclude the exclusions group (who line), from
    // the excluded-everywhere checks' own values.
    const notExcluding = [...new Set(step.checks.items.filter((it) => it.fix === 'excluded-everywhere').flatMap((it) => (Array.isArray(it.values.policies) ? (it.values.policies as string[]) : [])))]
    if (notExcluding.length > 0) v.policiesNotExcluding = notExcluding
    v.operator = ctx.operatorId ? ctx.nameOf(ctx.operatorId) : undefined
    v.tenantId = ctx.snapshot.tenantId
    v.onmicrosoftDomain = initialDomain(ctx.snapshot) ?? undefined
    // A suggested name for a new emergency account (display-name and create).
    v.exampleName = 'Emergency Access'
  }

  return v
}

function operatorSignIns(snapshot: TenantSnapshot, operatorId: string): number | undefined {
  const ev = (snapshot as { signInEvidence?: Record<string, { signInCount?: number }> }).signInEvidence
  return ev?.[operatorId]?.signInCount
}

// Placeholder for the mapped-policy lookup keys; the merged-goal A/B naming is
// finished when the per-sub-policy naming lands (see docs/reports/51.md).
function snapshotPolicyKeys(): { id?: string | null; displayName: string }[] {
  return []
}

export { absoluteDate }
