// One verdict per goal, and the one clause that states its gap
// (target-state §8.2, prompt 46 Part 2 item 9).
//
// Findings said "6 in place" while the Plan counted 11, because the plan
// decided "done" on its own from a matched policy's state, and "Admin sessions
// expire quickly" was partly in place on one surface and done on the other.
// Two surfaces, two derivations, one number that could not be trusted. The
// verdict is decided here once; everything else reads it.
import type { GoalResult, GoalStatus, Verdict } from './types.ts'

export function verdictOf(status: GoalStatus): Verdict {
  switch (status) {
    case 'enforced':
      return 'inPlace'
    case 'partial':
      return 'partly'
    case 'below-baseline':
      return 'belowBaseline'
    case 'absent':
      return 'missing'
    case 'not-applicable':
      return 'notApplicable'
    case 'licence-limited':
      return 'licenceLimited'
    default:
      return 'unknown'
  }
}

// Durations in words, never "168h" (walk-51 item 17, §8.4): the contract forbids
// the hour abbreviation, so a session gap reads "sessions expire weekly, baseline
// wants 4 hours".
export function hoursInWords(hours: number): string {
  if (hours % 168 === 0) return hours === 168 ? 'weekly' : `${hours / 24} days`
  if (hours % 24 === 0) return hours === 24 ? 'daily' : `${hours / 24} days`
  return `${hours} hours`
}
const compactHours = (s: string): string =>
  s
    .replace(/sign-in every (\d+) hours at most/g, (_, h: string) => hoursInWords(Number(h)))
    .replace(/expire every (\d+) hours/g, (_, h: string) => {
      const w = hoursInWords(Number(h))
      return w.endsWith('hours') ? `expire every ${w}` : `expire ${w}`
    })
    .replace(/every (\d+) hours/g, (_, h: string) => {
      const w = hoursInWords(Number(h))
      return w.endsWith('hours') ? `every ${w}` : w
    })

/**
 * The gap, as the clause a plan row shows after the who-line. Four branches,
 * in the order the classifier's reasons rank them; null where the goal is in
 * place, missing, or the kept facts cannot state the gap honestly.
 */
export function gapSentenceOf(r: GoalResult): string | null {
  if (r.status !== 'partial' && r.status !== 'below-baseline') return null
  const session = r.reasons.find((x) => x.kind === 'session-weaker' && x.current && x.floor)
  if (session) return `sessions ${compactHours(session.current as string)}, baseline wants ${compactHours(session.floor as string)}`
  const control = r.reasons.find((x) => x.kind === 'weaker-control' && x.current && x.floor)
  if (control) return `requires ${control.current}, baseline wants ${compactHours(control.floor as string)}`
  const uncovered = r.reasons.filter((x) => !x.expected && (x.kind === 'not-targeted' || x.kind === 'excluded')).flatMap((x) => x.userIds)
  if (uncovered.length > 0 && r.expectedCount > 0) {
    const missing = new Set(uncovered).size
    return `covers ${Math.max(0, r.expectedCount - missing)} of ${r.expectedCount} people`
  }
  if (r.reasons.some((x) => x.kind === 'apps-narrower')) return 'covers fewer apps than the baseline'
  if (r.reportOnlyIds.length > 0 && r.enforcedIds.length === 0) return 'report-only, not enforced'
  return null
}

/**
 * The gap shortened for a row (prompt 50.1 item 9). A session or control gap can
 * name several dimensions ("expire every 168h and persist in the browser"); the
 * row shows only the first, so it fits without a mid-word ellipsis, and the full
 * sentence stays on the step. Everything after " and ", up to the comma, is
 * dropped.
 */
export function gapClauseOf(r: GoalResult): string | null {
  const full = gapSentenceOf(r)
  return full === null ? null : full.replace(/ and [^,]*/g, '')
}
