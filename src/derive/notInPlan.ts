// The "In the baseline, not in this plan" footer group (v2-research/missing-seven.md,
// decision C): every policy of the loaded baseline that nothing else on the Plan
// names, by the baseline's own display name, with one reason. Without it a
// finished plan read as the whole baseline while some of its policies appeared
// nowhere: the goal map claims none of them, and the coverage check's looser
// signature match keeps them off the review rows.
//
// One rule: a policy is shown when a drawn step's goal maps to it, a Not licensed
// row's goal maps to it, or a review row carries it. Every other policy is listed
// here. The rule never names a policy; only the words do, by the baseline's own
// name, and a policy with no words of its own reads the generic reason.
//
// Pure: no DOM, no network.
import { pages, stepById } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import { goalInMap, policyKey } from '../roadmap/goalMap.ts'
import type { GoalMap } from '../roadmap/goalMap.ts'
import type { CoverageReport } from '../coverage/types.ts'
import type { Step } from '../roadmap/types.ts'
import { EMERGENCY_ACCESS_GROUP, STEP_GROUPS } from '../roadmap/stepGroups.ts'
import { groupTitleOf } from '../ui/surfaces/planBoard.ts'
import { notLicensedRows } from './notLicensed.ts'

export type NotInPlanRow = { policy: string; reason: string; text: string }

type Reason = 'riskyRegistration' | 'externalMfaRisk' | 'lockdown' | 'passkeyRegistration' | 'adminGroupPasskeys' | 'emergencyAccount' | 'blockedCountries' | 'generic'
type FooterCopy = { notInPlan: string; notInPlanRow: string; notInPlanReason: Record<Reason, string> }
const footer = (): FooterCopy => (pages.plan as { footer: FooterCopy }).footer

/**
 * Which words a policy reads, by the baseline's own name (as workflows.ts picks a
 * review row's words), and the step whose title fills {step}: a content step id,
 * or a step group's key (stepGroups.ts) for a group's title. First match wins.
 */
const REASONS: { match: RegExp; reason: Reason; step?: string }[] = [
  { match: /RiskyUsers\s*-\s*RegisterSecurityInfo/i, reason: 'riskyRegistration' },
  { match: /\bEAM\b.*High-Risk/i, reason: 'externalMfaRisk', step: 'user-risk' },
  { match: /\bZTCA\b.*\bAllApps\b/i, reason: 'lockdown' },
  { match: /MFA-Passkey\s*-\s*UserRegistration/i, reason: 'passkeyRegistration', step: 'register-info-protected' },
  { match: /MFA-Passkeys\s*-\s*ADM-Users/i, reason: 'adminGroupPasskeys', step: 'admins-phishing-resistant' },
  { match: /BreakGlass/i, reason: 'emergencyAccount', step: EMERGENCY_ACCESS_GROUP },
  // The "NoExclusions" variant the plan never considers (generate.ts baselineMatchesFor).
  { match: /Countries.*no[-_ ]?exclusions?/i, reason: 'blockedCountries', step: 'geo-restriction' },
]

function titleOf(step: string): string {
  const group = STEP_GROUPS.find((g) => g.key === step)
  if (group) return groupTitleOf(group, false)
  return stepById[step]?.title ?? step
}

function reasonFor(displayName: string): string {
  const P = footer()
  const hit = REASONS.find((r) => r.match.test(displayName))
  if (!hit) return P.notInPlanReason.generic
  return fillText(P.notInPlanReason[hit.reason], hit.step ? { step: titleOf(hit.step) } : {})
}

/**
 * The rows: the baseline's policies no drawn step, Not licensed row or review
 * row names. `steps` are the steps the Plan draws (planData.ts, after the ones
 * withheld from customer plans); `policies` are the loaded baseline's, in its order.
 */
export function notInPlanRows(policies: readonly { id?: string | null; displayName: string }[], steps: readonly Step[], coverage: CoverageReport, goalMap: GoalMap): NotInPlanRow[] {
  const shown = new Set<string>()
  const reviewed = new Set<string>()
  const claim = (goalId: string): void => {
    for (const k of goalMap[goalId] ?? []) shown.add(k)
  }
  for (const s of steps) {
    claim(s.goalId)
    if (s.baselineReviewSource) reviewed.add(s.baselineReviewSource.name)
  }
  // A goal the Not licensed group lists, asked of that group one goal at a time
  // so the shared device line still names each of its goals.
  for (const goalId of Object.keys(goalMap)) {
    if (goalInMap(goalMap, goalId) && notLicensedRows(coverage, { [goalId]: goalMap[goalId] }).length > 0) claim(goalId)
  }
  const P = footer()
  return policies
    .filter((p) => !shown.has(policyKey(p)) && !reviewed.has(p.displayName))
    .map((p) => {
      const reason = reasonFor(p.displayName)
      return { policy: p.displayName, reason, text: fillText(P.notInPlanRow, { policy: p.displayName, reason }) }
    })
}

/** "In the baseline, not in this plan (n)": the collapsed group's one line, counted from its rows. */
export function notInPlanSummary(rows: readonly NotInPlanRow[]): string {
  return fillText(footer().notInPlan, { n: rows.length })
}
