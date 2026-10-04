// The "In the baseline, not in this plan" footer group (v2-research/missing-seven.md,
// decision C): every policy of the loaded baseline that nothing else on the Plan
// names, by the baseline's own display name, with one reason. Without it a
// finished plan read as the whole baseline while some of its policies appeared
// nowhere: the goal map claims none of them, and the coverage check's looser
// signature match keeps them off the review rows.
//
// One rule: a policy is shown when a drawn step's goal maps to it, a Not licensed
// row's goal maps to it, or a review row carries it. Every other policy is listed
// here. The rule never names a policy; only the words do, and a policy with no
// words of its own reads the generic reason.
//
// Which words (T2-FTR): a pinned policy by its stable id, a policy of another
// baseline (an upload) by its own name; then a policy whose goal the tenant's
// own facts switched off says which fact (no service account confirmed, no
// directory sync account), read off the goal's coverage, so it holds for any
// baseline that maps the goal. A goal a licence switched off is a Not licensed
// row (notLicensed.ts) and never reaches this list.
//
// Pure: no DOM, no network.
import { directionWords, pages, stepById } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import { goalInMap, policyKey } from '../roadmap/goalMap.ts'
import type { GoalMap } from '../roadmap/goalMap.ts'
import { WORKLOAD_REASON } from '../coverage/applicability.ts'
import type { CoverageReport } from '../coverage/types.ts'
import type { Step } from '../roadmap/types.ts'
import { EMERGENCY_ACCESS_GROUP, STEP_GROUPS } from '../roadmap/stepGroups.ts'
import { groupTitleOf } from '../ui/surfaces/planBoard.ts'
import { notLicensedRows } from './notLicensed.ts'
import { list } from '../copy/statements.ts'

export type NotInPlanRow = { policy: string; reason: string; text: string }

type Reason = 'agentBlock' | 'externalMfaRisk' | 'adminGroupPasskeys' | 'emergencyAccount' | 'blockedCountries' | 'noServiceAccounts' | 'syncNoAccount' | 'generic'
type FooterCopy = { notInPlan: string; notInPlanRow: string; notInPlanReason: Record<Reason, string> }
const footer = (): FooterCopy => (pages.plan as { footer: FooterCopy }).footer

/** The Direction step that confirms the service accounts: its title fills {step} on the service-accounts reason. */
const ACCOUNTS_DIRECTION = 'direction:accounts'

/**
 * Which words a policy reads: by the pinned baseline's stable policy ids, and
 * by the baseline's own name for a policy of any other baseline (as workflows.ts
 * picks a review row's words); and the step whose title fills {step}: a content
 * step id, a step group's key (stepGroups.ts) for a group's title, or a
 * Direction step. First match wins.
 */
const REASONS: { ids: readonly string[]; match: RegExp; reason: Reason; step?: string }[] = [
  { ids: ['0ab1380f-3863-40a5-ab97-24250e1cf44e', '1d8beea4-2ea1-4758-8e22-d6310a60220a'], match: /IAC\s*-\s*AGENT\s*-\s*BLOCK/i, reason: 'agentBlock' },
  { ids: ['bb6a814e-808a-467c-9475-06f89140ce99'], match: /\bEAM\b.*High-Risk/i, reason: 'externalMfaRisk', step: 'user-risk' },
  { ids: ['a53c4c2b-b577-4d88-b64d-36b92f8f3ca0'], match: /MFA-Passkeys\s*-\s*ADM-Users/i, reason: 'adminGroupPasskeys', step: 'admins-phishing-resistant' },
  { ids: ['1588fdc7-f34a-468e-8023-4d788ef5d226'], match: /BreakGlass/i, reason: 'emergencyAccount', step: EMERGENCY_ACCESS_GROUP },
  // Jon's countries block with no travel exception: optional, on the plan once countries are listed to block outright (coverage/companions.ts; v1.1 D4).
  { ids: ['1eaf943a-abad-4c77-b101-0c5342fc1044'], match: /Countries.*no[-_ ]?exclusions?/i, reason: 'blockedCountries', step: 'geo-restriction' },
]

function titleOf(step: string): string {
  if (step === ACCOUNTS_DIRECTION) return directionWords.steps.accounts.title
  const group = STEP_GROUPS.find((g) => g.key === step)
  if (group) return groupTitleOf(group, false)
  return stepById[step]?.title ?? step
}

/**
 * The reason a goal the tenant's own facts switched off gives every policy it
 * maps: the facet coverage recorded for it (coverage.ts evaluateGoal), or null.
 */
function factReason(p: { id?: string | null; displayName: string }, coverage: CoverageReport, goalMap: GoalMap): { reason: Reason; step?: string } | null {
  const key = policyKey(p)
  const goals = new Set(Object.entries(goalMap).filter(([, keys]) => keys.includes(key)).map(([g]) => g))
  for (const r of coverage.results) {
    if (!goals.has(r.goal.id) || r.status !== 'not-applicable' || !r.applicability) continue
    if (r.applicability.facet === 'serviceAccounts') return { reason: 'noServiceAccounts', step: ACCOUNTS_DIRECTION }
    // Without the licence it is a Not licensed row (notLicensed.ts), never listed here.
    if (r.applicability.facet === 'workload' && r.applicability.reason === WORKLOAD_REASON.noSyncAccount) return { reason: 'syncNoAccount' }
  }
  return null
}

function reasonFor(p: { id?: string | null; displayName: string }, coverage: CoverageReport, goalMap: GoalMap): string {
  const P = footer()
  const id = (p.id ?? '').toLowerCase()
  const hit = REASONS.find((r) => r.ids.includes(id)) ?? REASONS.find((r) => r.match.test(p.displayName)) ?? factReason(p, coverage, goalMap)
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
      const reason = reasonFor(p, coverage, goalMap)
      return { policy: p.displayName, reason, text: fillText(P.notInPlanRow, { policy: p.displayName, reason }) }
    })
}

/**
 * The Plan footer's lines (owner, 2026-10-04): policies that read the same
 * reason share one line, named together (Jon's two AGENT blocks), so a reason is
 * said once. The rows, and the group's count of policies, are unchanged.
 */
export function notInPlanLines(rows: readonly NotInPlanRow[]): { key: string; text: string; count: number }[] {
  const P = footer()
  const groups: { reason: string; policies: string[] }[] = []
  for (const r of rows) {
    const g = groups.find((x) => x.reason === r.reason)
    if (g) g.policies.push(r.policy)
    else groups.push({ reason: r.reason, policies: [r.policy] })
  }
  return groups.map((g) => ({ key: g.policies[0], text: fillText(P.notInPlanRow, { policy: list(g.policies), reason: g.reason }), count: g.policies.length }))
}

/** "In the baseline, not in this plan (n)": the collapsed group's one line, counted from its rows. */
export function notInPlanSummary(rows: readonly NotInPlanRow[]): string {
  return fillText(footer().notInPlan, { n: rows.length })
}
