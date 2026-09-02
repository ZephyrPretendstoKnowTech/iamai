// Running the registry against a tenant, and shaping the results the two
// surfaces need: Setup's findings (Must fix / Recommended / Notes) and the
// plan's Phase 0 blocker steps.
//
// No check lives here. Everything this module does is build the context the
// rules declare they need, call `evaluateSubject`, and group what comes back.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import type { MappingState, ValidationResult } from '../mapping/types.ts'
import { evaluateSubject, isBlocking } from './rules.ts'
import type { GroupFacts, RuleResult, RuleSubject, ValidationContext } from './rules.ts'
import { HOUSEKEEPING } from '../copy/validation.ts'

export type ValidationInputs = {
  snapshot: TenantSnapshot
  state: MappingState
  groupMembers?: GroupFacts[]
  viability?: MfaViability[]
}

/** The signed-in operator, from the /me section the scan already reads. */
export function operatorIdOf(snapshot: TenantSnapshot): string | null {
  const me = (snapshot.config.me?.rows?.[0] ?? null) as { id?: string } | null
  return typeof me?.id === 'string' ? me.id : null
}

export function buildContext(i: ValidationInputs): ValidationContext {
  const answers = i.state.breakGlassAnswers ?? { credentialStorage: null, signInMonitoring: null }
  return {
    snapshot: i.snapshot,
    tenantPolicies: i.snapshot.config.caPolicies?.rows ?? [],
    groupMembers: i.groupMembers ?? [],
    breakGlassIds: i.state.breakGlassUserIds,
    operatorUserId: operatorIdOf(i.snapshot),
    allowedCountries: i.state.allowedCountries,
    serviceAccountIds: i.state.serviceAccountUserIds,
    approvedExclusionIds: [...i.state.breakGlassUserIds, ...i.state.serviceAccountUserIds],
    viability: i.viability ?? [],
    answers,
  }
}

const BLOCKER_FIRST = { blocker: 0, warning: 1, note: 2 } as const

/**
 * The registry's results as the Setup surfaces consume them: must-fix first,
 * then recommended, then notes, with the counts the chip shows.
 */
export function toValidationResult(results: RuleResult[], checkedAt = new Date().toISOString()): ValidationResult {
  const shown = results
    .filter((r) => r.finding !== null && r.finding !== undefined)
    .filter((r) => r.outcome !== 'pass' || r.severity === 'note' || Boolean(r.finding))
    .sort((a, b) => BLOCKER_FIRST[a.severity] - BLOCKER_FIRST[b.severity])
  // Four ranks, not three. A check that could not be run is its own outcome:
  // it is not a recommendation, and counting it as one made Q1 read "3 must fix
  // / 5 recommended" when three of those five were "could not be checked"
  // (review-08 E2, prompt 40 §15). An unknown says nothing about whether the
  // tenant is well configured — only that IAMAI could not tell.
  const rank = (r: RuleResult): number =>
    isBlocking(r) ? 0 : r.outcome === 'unknown' ? 1 : r.outcome === 'pass' ? 3 : r.severity === 'warning' ? 2 : 3
  shown.sort((a, b) => rank(a) - rank(b))
  const toFix = shown.filter((r) => rank(r) === 0).length
  const unknown = shown.filter((r) => rank(r) === 1).length
  const recommended = shown.filter((r) => rank(r) === 2).length
  return {
    checkedAt,
    passed: toFix === 0,
    findings: shown.map((r) => r.finding as string),
    toFix,
    unknown,
    recommended,
  }
}

/** Every subject the plan gates on, with the rule results behind it. */
export type SubjectReport = {
  subject: RuleSubject
  /** One entry per target: a break-glass account, the group, the location. */
  targets: { target: unknown; label: string; results: RuleResult[] }[]
  blocking: RuleResult[]
  warnings: RuleResult[]
  /** Checks a failed read kept from running: one housekeeping line, never a recommendation. */
  notRun: RuleResult[]
}

function labelOf(snapshot: TenantSnapshot, target: unknown): string {
  if (typeof target === 'string') {
    const u = snapshot.users.find((x) => x.id === target)
    return u?.displayName ?? u?.userPrincipalName ?? target
  }
  const g = target as { displayName?: string | null; groupId?: string; id?: string } | null
  return g?.displayName ?? g?.groupId ?? g?.id ?? ''
}

export function reportFor(subject: RuleSubject, targets: unknown[], ctx: ValidationContext): SubjectReport {
  const perTarget = targets.map((target) => ({ target, label: labelOf(ctx.snapshot, target), results: evaluateSubject(subject, target, ctx) }))
  const all = perTarget.flatMap((t) => t.results)
  return {
    subject,
    targets: perTarget,
    blocking: all.filter(isBlocking),
    // A check that could not run is not a recommendation (prompt 46 item 21):
    // it is counted once, in the housekeeping line below, never rendered as
    // something to fix.
    warnings: all.filter((r) => r.severity === 'warning' && r.outcome === 'fail' && Boolean(r.finding)),
    notRun: all.filter((r) => r.outcome === 'unknown'),
  }
}

/**
 * One line for the checks a failed read kept from running (prompt 46 item
 * 21): "N checks could not run: <what was not read>". Null when every check
 * ran. The reads are named from the rules' own unknown findings.
 */
export function checksNotRun(reports: SubjectReport[]): string | null {
  const unknowns = reports.flatMap((r) => r.notRun)
  if (unknowns.length === 0) return null
  const reads = [...new Set(unknowns.map((u) => (u.finding ?? '').replace(/^[^:]*:\s*/, '').trim()).filter(Boolean))]
  return HOUSEKEEPING.checksNotRun(unknowns.length, reads)
}

/**
 * Break-glass is evaluated per account, and once for the whole set: with no
 * account nominated at all, `bg.count` still has to fire. A set-level rule is
 * reported against the first account only, so the count on screen matches the
 * number of distinct things to fix.
 */
export function breakGlassReport(ctx: ValidationContext): SubjectReport {
  const targets: unknown[] = ctx.breakGlassIds.length > 0 ? ctx.breakGlassIds : ['']
  const report = reportFor('breakGlass', targets, ctx)
  if (ctx.breakGlassIds.length === 0) {
    // With nothing nominated, only the set-level rules have anything to say.
    for (const t of report.targets) t.results = t.results.filter((r) => SET_LEVEL.has(r.id))
  }
  const seen = new Set<string>()
  for (const t of report.targets) {
    t.results = t.results.filter((r) => {
      if (!SET_LEVEL.has(r.id)) return true
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })
  }
  const all = report.targets.flatMap((t) => t.results)
  report.blocking = all.filter(isBlocking)
  report.warnings = all.filter((r) => r.severity === 'warning' && (r.outcome === 'fail' || r.outcome === 'unknown') && Boolean(r.finding))
  return report
}

/** Rules about the set of accounts rather than one account. */
export const SET_LEVEL = new Set(['bg.count', 'bg.methodDiversity', 'bg.credentialStorage', 'bg.signInMonitoring'])

// ---- what Setup renders ----------------------------------------------------

/** One result per nominated account, in the order they were nominated. */
export function breakGlassFindings(i: ValidationInputs): Record<string, ValidationResult> {
  const report = breakGlassReport(buildContext(i))
  const out: Record<string, ValidationResult> = {}
  for (const t of report.targets) out[String(t.target)] = toValidationResult(t.results)
  return out
}

export function exclusionGroupFindings(entry: GroupFacts | null, i: ValidationInputs): ValidationResult {
  return toValidationResult(evaluateSubject('exclusionGroup', entry, buildContext(i)))
}

export function trustedLocationFindings(location: unknown, i: ValidationInputs): ValidationResult {
  return toValidationResult(evaluateSubject('trustedLocation', location, buildContext(i)))
}

export function pilotGroupFindings(entry: GroupFacts | null, i: ValidationInputs): ValidationResult {
  return toValidationResult(evaluateSubject('pilotGroup', entry, buildContext(i)))
}
