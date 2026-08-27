// The coverage algorithm (intents.md §7) and statements (§8). Pure.
import goalsData from '../../data/goals.json' with { type: 'json' }
import { groupSignatures } from '../baseline/index.ts'
import type { CaPolicy } from '../baseline/types.ts'
import { adHocGoal, goalsMatching, matchesSignature, raiseFloor } from './classify.ts'
import { policyFacts } from './facts.ts'
import type { StrengthLookup } from './strength.ts'
import { satisfiesFloor } from './strength.ts'
import { resolveFactsWho, resolvePopulation } from './population.ts'
import type { GroupMembers } from './population.ts'
import { detectFacets } from './applicability.ts'
import type { FacetOverrides } from './applicability.ts'
import { organisationReport } from './organisation.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type {
  AssumedExclusions,
  CandidateContribution,
  CoverageReport,
  Goal,
  GoalResult,
  PolicyFacts,
  Reason,
} from './types.ts'

export const CATALOGUE: Goal[] = goalsData.goals as unknown as Goal[]

const TIER_CAPABILITY: Record<string, keyof TenantSnapshot['capabilities'] | null> = {
  free: null,
  p1: 'entraP1',
  p2: 'entraP2',
  intune: 'intune',
  workloadId: 'workloadIdPremium',
  gsa: 'globalSecureAccess',
  mcas: 'defenderForCloudApps',
}

// Item 9: run the adapter's group signatures over the tenant's own policies to
// infer break-glass / global-exclusion groups and directly-excluded break-glass
// users — provisional until Mapping confirms ("assumed — confirm in Mapping").
export function assumedExclusions(tenantPolicies: unknown[]): AssumedExclusions {
  const groups = new Map<string, string>()
  for (const sig of groupSignatures(tenantPolicies as CaPolicy[])) {
    // §11 labels the excluded-from-most group "break-glass/global exclusion" —
    // in small tenants they are the same group, so the assumed label carries
    // both roles until Mapping separates them (first run, §13).
    if (sig.inferredRole === 'globalExclusion') groups.set(sig.id, 'breakGlass/globalExclusion')
    if (sig.inferredRole === 'broadExclusion') groups.set(sig.id, 'breakGlass/globalExclusion')
    if (sig.inferredRole === 'serviceAccounts') groups.set(sig.id, 'serviceAccounts')
  }
  // §11 tenant note: users excluded directly from a policy are inferred
  // break-glass accounts — provisional, confirmed in Mapping.
  const users = new Set<string>()
  for (const raw of tenantPolicies) {
    const p = raw as { state?: string; conditions?: { users?: { excludeUsers?: string[] } } }
    if (p.state === 'disabled') continue
    for (const u of p.conditions?.users?.excludeUsers ?? []) {
      if (/^guestsorexternalusers$/i.test(u)) continue
      users.add(u)
    }
  }
  return { groups, users, confirmed: false }
}

export type CoverageInput = {
  snapshot: TenantSnapshot
  tenantPolicies: unknown[]
  baselinePolicies: unknown[]
  baselineUnusable: { policyName: string; warning: string }[]
  strengths: StrengthLookup
  groupMembers: GroupMembers
  facetOverrides?: FacetOverrides
  /** Confirmed mapping (prompt 06); until then assumed exclusions are used. */
  mapping?: { breakGlassUsers?: string[]; exclusionGroups?: Record<string, string>; confirmed?: boolean }
}

export function computeCoverage(input: CoverageInput): CoverageReport {
  const { snapshot } = input
  const nameById = new Map(snapshot.users.map((u) => [u.id, u.displayName ?? u.userPrincipalName ?? u.id]))
  const activeIds = new Set(
    snapshot.users
      .filter(
        (u) =>
          u.lastSuccessfulSignIn !== null &&
          Date.parse(snapshot.asOf) - Date.parse(u.lastSuccessfulSignIn) <= 90 * 86_400_000,
      )
      .map((u) => u.id),
  )

  const tenantFacts = input.tenantPolicies.map((p) =>
    policyFacts(p, input.strengths, snapshot.microsoftManagedPolicyIds.includes(String((p as { id?: string }).id ?? ''))),
  )
  const baselineFacts = input.baselinePolicies.map((p) => policyFacts(p, input.strengths))

  const assumed = input.mapping?.confirmed
    ? confirmedExclusions(input.mapping)
    : assumedExclusions(input.tenantPolicies)

  const facets = detectFacets(snapshot, input.facetOverrides ?? {})

  // Catalogue goals present in the baseline (or always evaluated) + ad-hoc
  // goals for unmatched baseline policies.
  const matchedBaseline = new Set<string>()
  const goals: { goal: Goal; baselineMatches: PolicyFacts[] }[] = CATALOGUE.map((goal) => {
    const baselineMatches = baselineFacts.filter((f) =>
      goal.implementations.some((impl) => matchesSignature(f, impl.signature)),
    )
    for (const b of baselineMatches) matchedBaseline.add(b.name)
    return { goal, baselineMatches }
  })
  for (const b of baselineFacts) {
    if (!matchedBaseline.has(b.name)) {
      goals.push({ goal: adHocGoal(b), baselineMatches: [b] })
    }
  }

  const results: GoalResult[] = goals.map(({ goal, baselineMatches }) =>
    evaluateGoal(goal, baselineMatches, tenantFacts, input, assumed, facets, nameById, activeIds),
  )

  const couldNotEvaluate = input.baselineUnusable.map((w) => ({
    name: w.policyName,
    reason: w.warning,
  }))

  const scored = results.filter((r) => r.status !== 'not-applicable' && r.status !== 'licence-limited')
  const enforcedCount = scored.filter((r) => r.status === 'enforced').length
  const summary = {
    enforced: enforcedCount,
    partial: results.filter((r) => r.status === 'partial').length,
    absent: results.filter((r) => r.status === 'absent').length,
    notApplicable: results.filter((r) => r.status === 'not-applicable').length,
    licenceLimited: results.filter((r) => r.status === 'licence-limited').length,
    unknown: results.filter((r) => r.status === 'unknown').length,
    scoredPercent: scored.length > 0 ? Math.round((enforcedCount / scored.length) * 100) : 0,
  }

  return {
    results,
    couldNotEvaluate,
    organisation: organisationReport(tenantFacts, results, snapshot),
    assumed,
    summary,
  }
}

function confirmedExclusions(mapping: NonNullable<CoverageInput['mapping']>): AssumedExclusions {
  return {
    groups: new Map(Object.entries(mapping.exclusionGroups ?? {})),
    users: new Set(mapping.breakGlassUsers ?? []),
    confirmed: true,
  }
}

function evaluateGoal(
  goal: Goal,
  baselineMatches: PolicyFacts[],
  tenantFacts: PolicyFacts[],
  input: CoverageInput,
  assumed: AssumedExclusions,
  facets: ReturnType<typeof detectFacets>,
  nameById: Map<string, string>,
  activeIds: Set<string>,
): GoalResult {
  const impl = goal.implementations[0]
  const base: Omit<GoalResult, 'status' | 'statement'> = {
    goal,
    enforcedIds: [],
    weakIds: [],
    reportOnlyIds: [],
    expectedCount: 0,
    reasons: [],
    candidates: [],
    floorRaised: null,
  }

  // Applicability facet (§9).
  if (goal.applicability !== null) {
    const facet = facets[goal.applicability as keyof typeof facets]
    if (facet && !facet.on) {
      return { ...base, status: 'not-applicable', statement: `${goal.name} — not applicable (${facet.reason}).` }
    }
  }

  // Licence (§7.5): no implementation at the tenant's tier.
  const cap = TIER_CAPABILITY[impl.tier]
  if (cap !== null && cap !== undefined && !input.snapshot.capabilities[cap].enabled) {
    return {
      ...base,
      status: 'licence-limited',
      statement: `${goal.name} — needs a licence tier this tenant doesn't have (${impl.tier}); shown on the Licensing guide, not scored.`,
    }
  }

  const { floor, raised } = raiseFloor(goal, baselineMatches)
  base.floorRaised = raised

  // Expected population E.
  const expected = resolvePopulation(impl.expectedWho, input.snapshot)
  const E = expected.ids
  base.expectedCount = E.size

  // Candidates (§7.1).
  const candidates = tenantFacts.filter((f) => matchesSignature(f, impl.signature))
  if (impl.expectedWho.kind === 'workload') {
    return evaluateStructural(goal, base, candidates, floor)
  }

  const enforced = new Set<string>()
  const weak = new Set<string>()
  const reportOnly = new Set<string>()
  const contributions: CandidateContribution[] = []
  const reasons: Reason[] = []
  let anyEstimated = false
  let anyUnresolved = false
  const includedByEnabled = new Set<string>()
  const exclusionHits: { id: string; kind: string; userIds: Set<string> }[] = []

  for (const c of candidates) {
    const caveats: string[] = []
    if (impl.expectedApps === 'all' && !c.apps.all) caveats.push('apps-narrower')
    if (c.apps.excludedIds.size > 0) caveats.push('apps-excluded')

    const who = resolveFactsWho(c, input.snapshot, input.groupMembers)
    anyEstimated ||= who.estimated
    anyUnresolved ||= who.unresolvedGroups.length > 0
    const pop = new Set([...who.effective].filter((id) => E.has(id)))
    const strongPop = satisfiesFloor(c.grant, c.session, floor) ? pop : new Set<string>()

    if (c.state === 'enabled') {
      for (const id of who.included) if (E.has(id)) includedByEnabled.add(id)
      for (const ex of who.excludedBy) {
        exclusionHits.push({ id: ex.id, kind: ex.kind, userIds: new Set([...ex.userIds].filter((u) => E.has(u))) })
      }
    }

    let contribution: CandidateContribution['contribution']
    if (c.state === 'disabled' || c.state === 'unknown') {
      contribution = 'disabled'
    } else if (c.state === 'enabledForReportingButNotEnforced') {
      contribution = 'reportOnly'
      for (const id of strongPop) reportOnly.add(id)
    } else if (strongPop.size > 0) {
      contribution = 'strong'
      for (const id of strongPop) enforced.add(id)
      if (caveats.includes('apps-narrower')) {
        reasons.push({
          kind: 'apps-narrower',
          userIds: [...strongPop],
          detail: `${c.name} covers a narrower app set than the goal expects`,
        })
      }
    } else {
      contribution = 'weak'
      for (const id of pop) weak.add(id)
      if (pop.size > 0) {
        const sessionOnly = floor.grant === undefined && floor.session !== undefined
        reasons.push({
          kind: sessionOnly ? 'session-weaker' : 'weaker-control',
          userIds: [...pop],
          detail: `${c.name} applies but does not meet the floor (${describeFloor(floor)})`,
        })
      }
    }
    contributions.push({ policyId: c.id, policyName: c.name, state: c.state, contribution, caveats })
  }

  for (const id of enforced) {
    weak.delete(id)
    reportOnly.delete(id)
  }
  for (const id of weak) reportOnly.delete(id)

  base.candidates = contributions
  base.enforcedIds = [...enforced]
  base.weakIds = [...weak]
  base.reportOnlyIds = [...reportOnly]

  // Reasons for the remainder (§7.6).
  const covered = new Set([...enforced, ...weak, ...reportOnly])
  const missing = [...E].filter((id) => !covered.has(id))
  const expectedExcluded: string[] = []
  // Dedupe exclusion hits by source (the same group excludes users from every
  // candidate; one reason, not one per candidate).
  const bySource = new Map<string, { kind: string; id: string; userIds: Set<string> }>()
  for (const ex of exclusionHits) {
    const key = `${ex.kind}:${ex.id}`
    const entry = bySource.get(key) ?? { kind: ex.kind, id: ex.id, userIds: new Set<string>() }
    for (const id of ex.userIds) entry.userIds.add(id)
    bySource.set(key, entry)
  }
  for (const ex of bySource.values()) {
    const stillMissing = [...ex.userIds].filter((id) => missing.includes(id))
    if (stillMissing.length === 0) continue
    const label = ex.kind === 'group' ? (assumed.groups.get(ex.id) ?? null) : null
    const isBreakGlassUser = ex.kind === 'user' && assumed.users.has(ex.id)
    // Combined assumed labels ("breakGlass/globalExclusion") match on any part.
    const labelParts = label !== null ? label.split('/') : []
    const isExpected =
      labelParts.some((l) => impl.allowedExclusions.includes(l)) ||
      (isBreakGlassUser && impl.allowedExclusions.includes('breakGlass'))
    reasons.push({
      kind: 'excluded',
      userIds: stillMissing,
      detail:
        ex.kind === 'group'
          ? `excluded by group ${ex.id}${label ? ` (${label}${assumed.confirmed ? '' : ' — assumed, confirm in Mapping'})` : ''}`
          : `excluded directly${isBreakGlassUser ? ` (break-glass${assumed.confirmed ? '' : ' — assumed, confirm in Mapping'})` : ''}`,
      expected: isExpected,
    })
    if (isExpected) expectedExcluded.push(...stillMissing)
  }
  const accounted = new Set([...covered, ...reasons.flatMap((r) => (r.kind === 'excluded' ? r.userIds : []))])
  const notTargeted = [...E].filter((id) => !accounted.has(id) && !includedByEnabled.has(id))
  if (notTargeted.length > 0) {
    reasons.push({ kind: 'not-targeted', userIds: notTargeted, detail: 'never included by any candidate policy' })
  }
  if (reportOnly.size > 0) {
    reasons.push({ kind: 'report-only', userIds: [...reportOnly], detail: 'covered only in report-only' })
  }
  const disabledOnly = contributions.length > 0 && contributions.every((c) => c.contribution === 'disabled')
  if (contributions.some((c) => c.contribution === 'disabled')) {
    reasons.push({
      kind: 'disabled-candidate',
      userIds: [],
      detail: `matching but disabled: ${contributions
        .filter((c) => c.contribution === 'disabled')
        .map((c) => c.policyName)
        .join(', ')}`,
    })
  }
  base.reasons = reasons

  // Status (§7.5) — expected exclusions count as covered for "enforced".
  const effectiveExpected = new Set([...E].filter((id) => !expectedExcluded.includes(id)))
  const fullyEnforced = effectiveExpected.size > 0 && [...effectiveExpected].every((id) => enforced.has(id))

  let status: GoalResult['status']
  if (anyUnresolved) status = 'unknown'
  else if (contributions.length === 0 || disabledOnly) status = 'absent'
  else if (fullyEnforced) status = 'enforced'
  else if (enforced.size > 0 || reportOnly.size > 0 || weak.size > 0) status = 'partial'
  else status = 'absent'

  const statement = buildStatement(goal, status, base, E, enforced, nameById, activeIds, anyEstimated, baselineMatches)
  return { ...base, status, statement }
}

function evaluateStructural(
  goal: Goal,
  base: Omit<GoalResult, 'status' | 'statement'>,
  candidates: PolicyFacts[],
  floor: Parameters<typeof satisfiesFloor>[2],
): GoalResult {
  const contributions: CandidateContribution[] = candidates.map((c) => ({
    policyId: c.id,
    policyName: c.name,
    state: c.state,
    contribution:
      c.state === 'enabled' && satisfiesFloor(c.grant, c.session, floor)
        ? 'strong'
        : c.state === 'enabledForReportingButNotEnforced'
          ? 'reportOnly'
          : c.state === 'enabled'
            ? 'weak'
            : 'disabled',
    caveats: [],
  }))
  base.candidates = contributions
  const status = contributions.some((c) => c.contribution === 'strong')
    ? 'enforced'
    : contributions.some((c) => c.contribution === 'weak' || c.contribution === 'reportOnly')
      ? 'partial'
      : 'absent'
  const by = contributions
    .filter((c) => c.contribution !== 'disabled')
    .map((c) => `*${c.policyName}*`)
    .join(' and ')
  return {
    ...base,
    status,
    statement:
      status === 'absent' ? `**${goal.name}** — no policy does this.` : `**${goal.name}** — delivered by ${by}.`,
  }
}

function describeFloor(floor: Parameters<typeof satisfiesFloor>[2]): string {
  const parts: string[] = []
  if (floor.grant) parts.push(`requires ${floor.grant}`)
  if (floor.session?.maxSignInFrequencyHours !== undefined)
    parts.push(`sign-in frequency ≤ ${floor.session.maxSignInFrequencyHours}h`)
  if (floor.session?.persistentBrowserNever) parts.push('never persist browser sessions')
  if (floor.session?.secureSignInSession) parts.push('token protection')
  if (floor.session?.anyOf) parts.push('any session limit')
  return parts.join(', ') || 'floor'
}

// §8 statements: names, never ids; "of whom N active" keeps numbers honest.
function buildStatement(
  goal: Goal,
  status: GoalResult['status'],
  base: Omit<GoalResult, 'status' | 'statement'>,
  E: Set<string>,
  enforced: Set<string>,
  nameById: Map<string, string>,
  activeIds: Set<string>,
  estimated: boolean,
  baselineMatches: PolicyFacts[],
): string {
  const strongNames = base.candidates
    .filter((c) => c.contribution === 'strong')
    .map((c) => `*${c.policyName}*`)
  const by =
    strongNames.length > 1
      ? `${strongNames.slice(0, -1).join(', ')} and ${strongNames.at(-1)} together`
      : (strongNames[0] ?? '')
  const est = estimated ? ' (estimated — a group is over the membership cap)' : ''

  const expectedNote = (() => {
    const expected = base.reasons.filter((r) => r.kind === 'excluded' && r.expected)
    const n = new Set(expected.flatMap((r) => r.userIds)).size
    return n > 0 ? `; ${n} account${n === 1 ? '' : 's'} excluded as break-glass (expected)` : ''
  })()

  if (status === 'enforced') {
    return `**${goal.name}** — delivered by ${by || 'existing policies'}${expectedNote}${est}.`
  }
  if (status === 'absent') {
    const disabled = base.reasons.find((r) => r.kind === 'disabled-candidate')
    const baselineName = baselineMatches[0]?.name
    return `**${goal.name}** — no policy does this${disabled ? ` (${disabled.detail})` : ''}${baselineName ? `. Baseline policy: *${baselineName}*` : ''}.`
  }
  if (status === 'unknown') {
    return `**${goal.name}** — a required population could not be resolved (a group's members are unavailable); reported with what is known${est}.`
  }
  if (status === 'not-applicable' || status === 'licence-limited') {
    return `**${goal.name}**.`
  }
  // partial
  const pct = E.size > 0 ? Math.round((enforced.size / E.size) * 100) : 0
  const parts: string[] = []
  for (const r of base.reasons) {
    if (r.kind === 'excluded' && !r.expected) {
      const names = r.userIds.slice(0, 3).map((id) => nameById.get(id) ?? id)
      const active = r.userIds.filter((id) => activeIds.has(id)).length
      parts.push(
        `${r.detail}: ${r.userIds.length} member${r.userIds.length === 1 ? '' : 's'} (${active} active${r.userIds.length > 3 ? `, e.g. ${names.join(', ')}` : `: ${names.join(', ')}`}). Not a recognised exclusion for this goal`,
      )
    }
    if (r.kind === 'weaker-control' || r.kind === 'session-weaker') {
      parts.push(`${r.userIds.length} get a weaker control than the floor (${r.detail})`)
    }
    if (r.kind === 'report-only') {
      parts.push(`${r.userIds.length} covered only in report-only`)
    }
    if (r.kind === 'not-targeted') {
      const active = r.userIds.filter((id) => activeIds.has(id)).length
      parts.push(`${r.userIds.length} never targeted (${active} active)`)
    }
    if (r.kind === 'apps-narrower') {
      parts.push(`coverage is app-scoped narrower than the goal expects`)
    }
  }
  const raisedNote = base.floorRaised
    ? ` The baseline raises the bar to ${base.floorRaised.to} (via *${base.floorRaised.by}*).`
    : ''
  return `**${goal.name}** for ${pct}% of ${E.size}${by ? ` — ${by}` : ''}${parts.length > 0 ? ` — ${parts.join('; ')}` : ''}${expectedNote}${est}.${raisedNote}`
}
