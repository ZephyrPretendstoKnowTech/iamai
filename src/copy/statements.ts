// Generated sentences (Findings statements, the Findings summary, the Roadmap
// overview). Every function has explicit branches for 0, 1, all, and none.
// Markup: **goal** and *policy*: the page renders them as strong/em.

export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many
}

/** "3 users", "1 user", "no users". */
export function count(n: number, one: string, many = `${one}s`): string {
  return n === 0 ? `no ${many}` : `${n.toLocaleString('en')} ${plural(n, one, many)}`
}

/** Joins with commas and "and". */
export function list(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

const em = (s: string): string => `*${s}*`
const strong = (s: string): string => `**${s}**`

/** "<N> of <M> <people>" with branches for none, one, and all. */
export function share(n: number, total: number, one: string, many = `${one}s`): string {
  if (total === 0) return `no ${many}`
  if (n === 0) return `none of the ${count(total, one, many)}`
  if (n === total) return total === 1 ? `the only ${one}` : `all ${total} ${many}`
  return `${n} of ${total} ${many}`
}

// ---- Findings statements ----

// Statements stay within two sentences (prompt 17 §5): detail such as the
// break-glass exclusions lives in the expandable.
export function inPlaceStatement(goal: string, policies: string[], breakGlassExcluded: number): string {
  const by = policies.length > 0 ? `Delivered by ${list(policies.map(em))}` : 'Delivered by existing policies'
  const bg = breakGlassExcluded > 0 ? `, with ${count(breakGlassExcluded, 'break-glass account')} excluded` : ''
  return `${strong(goal)}. ${by}${bg}.`
}

export function partialControlStatement(goal: string, requires: string, floor: string, affected: number, total: number, noun: string): string {
  return `${strong(goal)}: the current policy requires ${requires}; the baseline expects ${floor}. ${capital(share(affected, total, noun))} affected.`
}

export function partialScopeStatement(
  goal: string,
  covered: number,
  total: number,
  noun: string,
  notCovered: { reason: string; count: number }[],
): string {
  const gaps = notCovered.filter((g) => g.count > 0)
  const tail =
    gaps.length === 0
      ? ''
      : ` Not covered: ${list(gaps.map((g) => `${g.reason} (${g.count})`))}.`
  return `${strong(goal)} applies to ${share(covered, total, noun)}.${tail}`
}

export function partialSessionStatement(goal: string, current: string, floor: string, affected: number, total: number, noun: string): string {
  return `${strong(goal)}: sessions currently ${current}; the baseline expects ${floor}. ${capital(share(affected, total, noun))} affected.`
}

export function missingStatement(goal: string, baselinePolicy: string | null): string {
  const ref = baselinePolicy ? `; the baseline's policy for it is ${em(baselinePolicy)}` : ''
  return `${strong(goal)}. No policy does this yet${ref}.`
}

export function reportOnlyStatement(goal: string, policy: string, days: number | null, failures: number | null): string {
  const obs =
    days === null
      ? 'no sign-in records collected yet'
      : `${count(days, 'day')}, ${failures === null ? 'failures not measured' : `${failures === 0 ? 'no' : failures} would-be ${plural(failures ?? 0, 'failure')}`}`
  return `${strong(goal)} is in report-only via ${em(policy)} (${obs}).`
}

/** Workload (structural) goals: a policy exists but is report-only or too weak. */
export function structuralPartialStatement(goal: string, policies: string[], reportOnly: boolean): string {
  const by = policies.length > 0 ? list(policies.map(em)) : 'a policy'
  return reportOnly ? `${strong(goal)} is in report-only via ${by}.` : `${strong(goal)}. ${by} ${policies.length === 1 ? 'applies' : 'apply'} but ${policies.length === 1 ? 'does' : 'do'} not meet the baseline.`
}

export function unknownStatement(goal: string): string {
  return `${strong(goal)}: a group's members could not be read, so the people it covers could not be counted. Reported with what is known.`
}

export function notApplicableStatement(goal: string, reason: string): string {
  return `${strong(goal)}: does not apply (${reason}).`
}

export function licenceLimitedStatement(goal: string, tier: string): string {
  return `${strong(goal)}: needs a licence tier this tenant does not have (${tier}). Listed on the Licensing guide, not scored.`
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ---- Findings summary (Summary tab) ----

export type FindingsSummaryInput = {
  tenant: string
  enabledPolicies: number
  baselineLabel: string
  baselinePolicies: number | null
  inPlace: number
  partly: number
  missing: number
  scored: number
  users: number
  active: number
  /** The four rollout numbers over enabled users (ux-review-04 §1). */
  rollout: { enabled: number; proven: number; noMethod: number; unproven: number; toSetUp: number }
  working: string[]
  fixFirst: string[]
  licenceLimited: number
}

/** Paragraphs for the Findings summary; no sentence can contradict a number. */
import { WINDOW } from './definitions.ts'

export function findingsSummary(i: FindingsSummaryInput): string[] {
  const out: string[] = []
  const baseline = i.baselinePolicies !== null ? `${i.baselineLabel} (${count(i.baselinePolicies, 'policy', 'policies')})` : i.baselineLabel
  const goals =
    i.scored === 0
      ? 'No goals apply to this tenant yet.'
      : i.inPlace === i.scored
        ? `All ${count(i.scored, 'security goal')} ${i.scored === 1 ? 'is' : 'are'} in place.`
        : i.inPlace === 0
          ? `None of the ${count(i.scored, 'security goal')} ${i.scored === 1 ? 'is' : 'are'} in place yet: ${count(i.partly, 'goal')} partly, ${i.missing} missing.`
          : `${i.inPlace} of ${i.scored} security goals are in place; ${i.partly} partly, ${i.missing} missing.`
  out.push(
    `IAMAI compared ${i.tenant}'s ${count(i.enabledPolicies, 'enabled Conditional Access policy', 'enabled Conditional Access policies')} with ${baseline}, matching each policy on what it does. ${goals}`,
  )

  // The rollout picture uses the same four numbers as the Scan tiles, over
  // enabled users; enforcement is never called tested from these numbers.
  const r = i.rollout
  const gaps: string[] = []
  if (r.noMethod > 0) gaps.push(`${count(r.noMethod, 'user has', 'users have')} no MFA method`)
  if (r.unproven > 0) gaps.push(`${count(r.unproven, 'user is', 'users are')} registered but unproven`)
  const rollout =
    r.enabled === 0
      ? 'No enabled users yet, so the rollout picture cannot be drawn.'
      : r.toSetUp === 0
        ? `Every one of the ${count(r.enabled, 'enabled user')} proved MFA in ${WINDOW}: nobody needs setting up before enforcement.`
        : r.proven === 0
          ? `None of the ${count(r.enabled, 'enabled user')} proved MFA in ${WINDOW}. ${capital(list(gaps))}: all ${r.toSetUp} need setting up before enforcement.`
          : `${r.proven} of ${r.enabled} enabled users (${Math.round((r.proven / r.enabled) * 100)}%) proved MFA in ${WINDOW}. ${capital(list(gaps))}: ${count(r.toSetUp, 'user')} to set up before enforcement.`
  out.push(`${count(i.users, 'user')} in the directory, ${i.active} active in the last 90 days. ${rollout}`)

  if (i.working.length > 0) {
    const more = i.working.length > 4 ? ` and ${i.working.length - 4} more` : ''
    out.push(`Already in place: ${i.working.slice(0, 4).join(', ')}${more}.`)
  }
  if (i.fixFirst.length > 0) {
    out.push(`Fix first: ${i.fixFirst.slice(0, 3).join('; ')}. The Roadmap dates each one, names who it touches, and gives the exact change.`)
  }
  if (i.licenceLimited > 0) {
    out.push(`${count(i.licenceLimited, 'goal needs', 'goals need')} a licence tier this tenant does not have; ${i.licenceLimited === 1 ? 'it is' : 'they are'} listed on the Licensing guide and left out of the score.`)
  }
  return out
}

// ---- Roadmap overview ----

export type RoadmapOverviewInput = {
  tenant: string
  done: number
  total: number
  /** Skipped steps are neither done nor remaining. */
  skipped?: number
  /** "small-tenant" / "mid-size" / "large-tenant" pace label. */
  pace: string
  /** Already rendered with when(): "in 27 days · Sep 23, 2026". */
  finishes: string
  weeks: number
}

export function roadmapOverview(i: RoadmapOverviewInput): string {
  const remain = i.total - i.done - (i.skipped ?? 0)
  if (i.total === 0) return `${i.tenant}: the plan has no steps yet: load a baseline and run a scan.`
  const head =
    remain === 0
      ? `${i.tenant}: all ${count(i.total, 'step')} ${i.total === 1 ? 'is' : 'are'} already in place. Nothing remains.`
      : i.done === 0
        ? `${i.tenant}: none of the ${count(i.total, 'step')} ${i.total === 1 ? 'is' : 'are'} in place yet. ${remain === 1 ? '1 remains' : `${remain} remain`}.`
        : `${i.tenant}: ${i.done} of ${i.total} steps already in place. ${remain === 1 ? '1 remains' : `${remain} remain`}.`
  if (remain === 0) return head
  return `${head} With a ${i.pace} pace, the plan finishes ${i.finishes} (${count(i.weeks, 'week')}).`
}

export type ScheduleRationaleInput = {
  weeks: number
  /** 0 or 1 today; the sentence branches on both. */
  campaigns: number
  verificationDays: number
  observationDays: number
  waves: number
  waitingOnSetup: number
}

/** "4 weeks: a 2-week verification campaign, 7-day observation window, 3 enforcement waves, 2 steps waiting on Setup." */
export function scheduleRationale(i: ScheduleRationaleInput): string {
  const parts: string[] = []
  if (i.campaigns === 0) parts.push('no verification campaign needed')
  else if (i.campaigns === 1) parts.push(`a ${Math.round(i.verificationDays / 7)}-week verification campaign`)
  else parts.push(`${i.campaigns} verification campaigns`)
  parts.push(i.observationDays === 0 ? 'no observation window' : `${i.observationDays}-day observation window`)
  parts.push(count(i.waves, 'enforcement wave'))
  if (i.waitingOnSetup > 0) parts.push(`${count(i.waitingOnSetup, 'step')} waiting on Setup`)
  return `${count(i.weeks, 'week')}: ${parts.join(', ')}.`
}

export function scheduleOverrun(band: string, expectedWeeks: number, weeks: number, extendedBy: string[]): string {
  const by = extendedBy.length > 0 ? ` ${list(extendedBy)} ${extendedBy.length === 1 ? 'extends' : 'extend'} it.` : ''
  return `Longer than the ${band} band's ${count(expectedWeeks, 'week')} (${count(weeks, 'week')}).${by}`
}

/** Lowercases a name for mid-sentence use without touching acronyms ("MFA", "CA"). */
export function lowerFirst(s: string): string {
  return s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s
}
