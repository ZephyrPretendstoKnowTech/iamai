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
import { absoluteDate, longDate } from '../../copy/dates.ts'
import { policiesForGoal, PINNED_GOAL_MAP } from '../../roadmap/goalMap.ts'
import { sessionWantedForGoal, strengthForGoal } from './stepPortal.ts'
import { contentLists } from '../../derive/contentLists.ts'
import { pickerVars } from './pickerRows.ts'
import { DECISION_STEPS } from '../../roadmap/decisions.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import type { NamingConvention } from '../../coverage/naming.ts'
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
  /** This step's report-only creation date (ISO), for a policy step's dates line. */
  reportOnlyAt?: string | null
  /** The one active-people count (Today's denominator), so every step's summary line agrees (walk-51 item 8). */
  activePeople?: number
  /** The groups the plan loaded, for the exclusions-group picker's rows. */
  groups?: GroupMembers
  /** The tenant's naming convention (coverage.organisation.naming): the portal lines name the objects the plan proposes before they exist. */
  naming?: NamingConvention
}

/** The long form, in the display time zone, only when the instant is real. */
function long(iso: string | null | undefined): string | undefined {
  return iso ? longDate(iso) : undefined
}
/** The short form, one format everywhere (walk-51 item 5). */
function short(iso: string | null | undefined): string | undefined {
  return iso ? absoluteDate(iso) : undefined
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
    // The summary line's active count is the one denominator (Today's), the same
    // on every step; the step's own scope stays in `n`/`inScope` (§8.1, item 8).
    active: ctx.activePeople ?? pop.active,
    admins: pop.admins,
    guests: pop.guests,
    total: pop.total,
    inScope: pop.inScope ?? pop.total,
    adminCount: pop.admins,
    memberCount: pop.total,
    signature: ctx.signature,
    // Dates: one short format everywhere (absoluteDate), the long form only for
    // emails (longDate), both from the same instant in the display time zone.
    enforce: short(enforce?.at),
    enforceLong: long(enforce?.at),
    firstEnforce: short(enforce?.at),
    firstEnforceLong: long(enforce?.at),
    announce: short(announce?.at),
    // A policy already in report-only has its date from the scan (tracking), not
    // from the schedule, which only dates the policies the plan creates.
    reportOnly: short(ctx.reportOnlyAt ?? step.tracking?.reportOnlyAt),
    // The proposed policy name, in the tenant's convention.
    policyName: step.naming?.proposed,
    proposedName: step.naming?.proposed,
    existingName: step.naming?.fromBaseline ?? undefined,
    // The operator's own sign-in count, when the operator is in scope.
    operatorSignIns: ctx.operatorId ? operatorSignIns(ctx.snapshot, ctx.operatorId) : undefined,
    // Everyone under 25, else the riskiest — the engine's own populationNames.
    people: pop.active,
    // A check step's subject is the accounts it checks, active or not (the
    // dormant accounts are by definition not active); every other step counts
    // the active people it touches.
    n: step.kind === 'check' ? pop.total : pop.active,
    // The step's readiness, as the percentage the content line names.
    readiness: step.readiness?.percent != null ? `${step.readiness.percent}%` : undefined,
    // The report-only observation window a policy done-when line names.
    reportOnlyDays: EXIT_MIN_DAYS_OBSERVED,
    // The start of the sign-in window the scan read ("since {from}").
    from: short(ctx.snapshot.sources.signInEvidence?.coveredWindow?.from),
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

  // The authentication strength the goal's baseline policy requires, for the
  // who and decision lines that name it (walk-51 item 18).
  const strength = strengthForGoal(step.goalId)
  if (strength) v.strengthName = strength
  // The session frequency the baseline wants, for the lines that name {wanted}.
  const wanted = sessionWantedForGoal(step.goalId)
  if (wanted) v.wanted = wanted

  // Existing coverage: whether a policy already delivers the goal (drives the
  // {existingCoverage} line's presence).
  v.existingPolicies = step.deliveredBy.length > 0 ? step.deliveredBy : []

  // The list variables, derived from what the scan collected (never gated when
  // the data exists): the campaign buckets, the lockout-scenario people, and the
  // emergency/service/admin id sets. A step reads only the keys it uses.
  Object.assign(v, contentLists({ snapshot: ctx.snapshot, mapping: ctx.mapping, nameOf: ctx.nameOf, now: ctx.now, operatorId: ctx.operatorId }))

  // The step's own picker rows (prune B): the emergency, exclusions-group,
  // countries, trusted-network, service-accounts and shared-devices pickers,
  // from the detections the plan runs, in the content file's row shape.
  const pickerRow = (contentStepFor(step) as { decision?: { pickerRow?: string } } | undefined)?.decision?.pickerRow
  if (typeof pickerRow === 'string') Object.assign(v, pickerVars(step.id, pickerRow, { snapshot: ctx.snapshot, mapping: ctx.mapping, nameOf: ctx.nameOf, groups: ctx.groups }) ?? {})

  // The emergency-access and exclusions-group steps (walk-51 item 14): the
  // failing checks routed through the content checkFixes, the counts for the
  // "{failing} of {total}" line, the operator's own account and the tenant id
  // from the session, and the values the create instructions name.
  // The exclusions group: the recognised group's own line (name, members, how
  // many policies exclude it) and its members; the create instructions show
  // while no group is recognised (its checks need a group to check).
  if (DECISION_STEPS.exclusions.has(step.id)) {
    const record = ctx.mapping.records['__globalExclusion'] ?? null
    const id = record?.resolvedId ?? null
    v.needsCreate = id === null
    if (id !== null) {
      const g = ctx.groups?.get(id) ?? [...(ctx.groups ?? [])].find(([k]) => k.toLowerCase() === id.toLowerCase())?.[1] ?? null
      const policies = ctx.snapshot.config.caPolicies?.rows ?? []
      const excludes = (p: unknown): boolean => ((p as { conditions?: { users?: { excludeGroups?: string[] } } }).conditions?.users?.excludeGroups ?? []).some((x) => x.toLowerCase() === id.toLowerCase())
      v.exclusionsGroup = g?.displayName ?? record?.resolvedName ?? ctx.nameOf(id)
      v.memberCount = g?.memberCount ?? 0
      v.excludedFrom = policies.filter(excludes).length
      v.policyCount = policies.length
      v.members = (g?.memberIds ?? []).map(ctx.nameOf)
    }
  }
  // A check step with nothing checked (no target the scan could read) shows no count.
  if (step.checks && step.checks.total > 0) {
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
