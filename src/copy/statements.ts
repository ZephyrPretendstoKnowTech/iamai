// Generated sentences (Findings statements, the Findings summary, the Roadmap
// overview). Every function has explicit branches for 0, 1, all, and none.
// Markup: **goal** and *policy* — the page renders them as strong/em.

export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many
}

/** "3 users", "1 user", "no users". */
export function count(n: number, one: string, many = `${one}s`): string {
  return n === 0 ? `no ${many}` : `${n} ${plural(n, one, many)}`
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

export function inPlaceStatement(goal: string, policies: string[], breakGlassExcluded: number): string {
  const by = policies.length > 0 ? ` Delivered by ${list(policies.map(em))}.` : ' Delivered by existing policies.'
  const bg = breakGlassExcluded > 0 ? ` ${count(breakGlassExcluded, 'account')} excluded as break-glass.` : ''
  return `${strong(goal)}.${by}${bg}`
}

export function partialControlStatement(goal: string, requires: string, floor: string, affected: number, total: number, noun: string): string {
  return `${strong(goal)} — the current policy requires ${requires}; the baseline expects ${floor}. ${capital(share(affected, total, noun))} affected.`
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
  return `${strong(goal)} — sessions currently ${current}; the baseline expects ${floor}. ${capital(share(affected, total, noun))} affected.`
}

export function missingStatement(goal: string, baselinePolicy: string | null): string {
  const ref = baselinePolicy ? ` The baseline's policy for it: ${em(baselinePolicy)}.` : ''
  return `${strong(goal)}. No policy does this yet.${ref}`
}

export function reportOnlyStatement(goal: string, policy: string, days: number | null, failures: number | null): string {
  const obs =
    days === null
      ? 'no sign-in records collected yet'
      : `${count(days, 'day')}, ${failures === null ? 'failures not measured' : `${failures === 0 ? 'no' : failures} would-be ${plural(failures ?? 0, 'failure')}`}`
  return `${strong(goal)} is in report-only via ${em(policy)} (${obs}).`
}

export function unknownStatement(goal: string): string {
  return `${strong(goal)} — a group's members could not be read, so the people it covers could not be counted. Reported with what is known.`
}

export function notApplicableStatement(goal: string, reason: string): string {
  return `${strong(goal)} — does not apply (${reason}).`
}

export function licenceLimitedStatement(goal: string, tier: string): string {
  return `${strong(goal)} — needs a licence tier this tenant does not have (${tier}). Listed on the Licensing guide, not scored.`
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
  readyPercent: number
  noMethod: number
  notChallenged: number
  /** 0–1, or null when no sign-in records were collected. */
  challengedRate: number | null
  working: string[]
  fixFirst: string[]
  licenceLimited: number
}

/** Paragraphs for the Findings summary; no sentence can contradict a number. */
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
    `IAMAI compared ${i.tenant}'s ${count(i.enabledPolicies, 'enabled Conditional Access policy', 'enabled Conditional Access policies')} with ${baseline} by what each policy does, not what it is called. ${goals}`,
  )

  const ready =
    i.active === 0
      ? 'No user has signed in within the last 90 days, so MFA readiness cannot be measured yet.'
      : i.readyPercent === 100
        ? `All ${count(i.active, 'active user')} could complete MFA today.`
        : i.readyPercent === 0
          ? `None of the ${count(i.active, 'active user')} could complete MFA today.`
          : `${i.readyPercent}% of the ${count(i.active, 'active user')} could complete MFA today.`
  const extras: string[] = []
  if (i.noMethod > 0) extras.push(`${count(i.noMethod, 'user has', 'users have')} no MFA method at all`)
  if (i.notChallenged > 0) extras.push(`${count(i.notChallenged, 'user has', 'users have')} never been asked for MFA`)
  const challenged =
    i.challengedRate === null
      ? ''
      : i.challengedRate >= 1
        ? ' Every user active in the collected sign-in records completed MFA at least once — enforcement is well tested here.'
        : i.challengedRate === 0
          ? ' No user active in the collected sign-in records completed MFA — enforcement is untested here.'
          : ` ${Math.round(i.challengedRate * 100)}% of users active in the collected sign-in records completed MFA at least once${i.challengedRate < 0.5 ? ' — enforcement is largely untested here' : ''}.`
  out.push(`${count(i.users, 'user')} in the directory, ${i.active} active in the last 90 days. ${ready}${extras.length > 0 ? ` ${capital(list(extras))}.` : ''}${challenged}`)

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
  pace: string
  /** Already rendered with when(): "in 27 days · Sep 23, 2026". */
  finishes: string
  weeks: number
}

export function roadmapOverview(i: RoadmapOverviewInput): string {
  const remain = i.total - i.done
  if (i.total === 0) return `${i.tenant}: the plan has no steps yet — load a baseline and run a scan.`
  const head =
    i.done === i.total
      ? `${i.tenant}: all ${count(i.total, 'step')} ${i.total === 1 ? 'is' : 'are'} already in place. Nothing remains.`
      : i.done === 0
        ? `${i.tenant}: none of the ${count(i.total, 'step')} ${i.total === 1 ? 'is' : 'are'} in place yet. ${remain === 1 ? '1 remains' : `${remain} remain`}.`
        : `${i.tenant}: ${i.done} of ${i.total} steps already in place. ${remain === 1 ? '1 remains' : `${remain} remain`}.`
  if (i.done === i.total) return head
  return `${head} With a ${i.pace} pace, the plan finishes ${i.finishes} (${count(i.weeks, 'week')}).`
}
