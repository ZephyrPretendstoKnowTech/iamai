// The coverage algorithm (intents.md §7) and statements (§8). Pure.
import goalsData from '../../data/goals.json' with { type: 'json' }
import { groupSignatures } from '../baseline/index.ts'
import type { CaPolicy } from '../baseline/types.ts'
import { matchesSignature, raiseFloor } from './classify.ts'
import { PINNED_GOAL_MAP, policyKey } from '../roadmap/goalMap.ts'
import type { GoalMap } from '../roadmap/goalMap.ts'
import { policyFacts } from './facts.ts'
import type { StrengthLookup } from './strength.ts'
import { satisfiesFloor } from './strength.ts'
import { resolveFactsWho, resolvePopulation } from './population.ts'
import type { GroupMembers } from './population.ts'
import { detectFacets } from './applicability.ts'
import type { FacetOverrides } from './applicability.ts'
import { NOT_ASSESSED, REASON } from '../copy/reasons.ts'
import { proposedPolicyName } from './naming.ts'
import { organisationReport } from './organisation.ts'
import { gapClauseOf, gapSentenceOf, verdictOf } from './verdict.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type {
  AssumedExclusions,
  CandidateContribution,
  CoverageReport,
  Goal,
  GoalResult,
  NotAssessed,
  PolicyFacts,
  Reason,
} from './types.ts'
import {
  inPlaceStatement,
  licenceLimitedStatement,
  missingStatement,
  notApplicableStatement,
  partialControlStatement,
  partialScopeStatement,
  partialSessionStatement,
  reportOnlyStatement,
  structuralPartialStatement,
  unknownStatement,
  belowBaselineStatement,
} from '../copy/statements.ts'

const TIER_NAME: Record<string, string> = { p1: 'Entra ID P1', p2: 'Entra ID P2', intune: 'Intune', workloadId: 'Workload Identities Premium', gsa: 'Global Secure Access', mcas: 'Defender for Cloud Apps', free: 'Entra ID Free' }
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
  // A break-glass set is two or three accounts. Many directly-excluded users
  // are ordinary carve-outs and must stay visible as gaps, not be assumed away.
  if (users.size > 3) users.clear()
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
  /**
   * The baseline's goal map (walk-51 item 9, goalMap.ts): for a goal it holds,
   * the map's policy is the one evaluated against — its floor, its name in a
   * statement — never the strongest signature match. A declared Policy A/B pair
   * evaluates against A, the decided default; B is offered by the step, not
   * demanded by the row (walk-51 item 16). Absent means the pinned map.
   */
  goalMap?: GoalMap
}

export function computeCoverage(input: CoverageInput): CoverageReport {
  const { snapshot } = input

  const tenantFacts = input.tenantPolicies.map((p) =>
    policyFacts(p, input.strengths, snapshot.microsoftManagedPolicyIds.includes(String((p as { id?: string }).id ?? ''))),
  )
  const baselineFacts = input.baselinePolicies.map((p) => policyFacts(p, input.strengths))

  const assumed = input.mapping?.confirmed
    ? confirmedExclusions(input.mapping)
    : assumedExclusions(input.tenantPolicies)
  // Membership decides expected exclusions (ux-review-05 §1): a group whose
  // every member is a break-glass account is an expected exclusion whether or
  // not Setup named it, before and after the questions are answered.
  for (const [groupId, g] of input.groupMembers) {
    if (assumed.groups.has(groupId) || g.sampled || g.memberIds.length === 0) continue
    if (g.memberIds.every((id) => assumed.users.has(id))) assumed.groups.set(groupId, 'breakGlass')
  }

  const facets = detectFacets(snapshot, input.facetOverrides ?? {})

  // Catalogue goals present in the baseline (or always evaluated) + ad-hoc
  // goals for unmatched baseline policies. The signature match says which
  // baseline policies a goal assesses (so nothing it covers is "not assessed");
  // the goal map says which one policy a held goal is evaluated against.
  const matchedBaseline = new Set<string>()
  const goalMap = input.goalMap ?? PINNED_GOAL_MAP
  const factsByKey = new Map<string, PolicyFacts>()
  input.baselinePolicies.forEach((p, i) => factsByKey.set(policyKey(p as { id?: string | null; displayName: string }), baselineFacts[i]))
  const goals: { goal: Goal; baselineMatches: PolicyFacts[] }[] = CATALOGUE.map((goal) => {
    const signatureMatches = baselineFacts.filter((f) =>
      goal.implementations.some((impl) => matchesSignature(f, impl.signature)),
    )
    for (const b of signatureMatches) matchedBaseline.add(b.name)
    // The map's policies, in order (A first), when the package carries them;
    // else the signature matches (an upload with no map, a synthetic fixture).
    const mapped = (goalMap[goal.id] ?? []).map((k) => factsByKey.get(k)).filter((f): f is PolicyFacts => f !== undefined)
    return { goal, baselineMatches: mapped.length > 0 ? mapped.slice(0, 1) : signatureMatches }
  })
  // Baseline policies no catalogue goal matches are not goals, findings or
  // steps (prompt 46 item 14, target-state §5 footer). They are listed as not
  // assessed, under the baseline's own name, with their JSON and one reason;
  // so are the policies the adapter could not read.
  const rawByName = new Map(input.baselinePolicies.map((p) => [String((p as { displayName?: unknown }).displayName ?? ''), p]))
  const jsonOf = (name: string): string | null => (rawByName.has(name) ? JSON.stringify(rawByName.get(name), null, 2) : null)
  const notAssessed: NotAssessed[] = baselineFacts
    .filter((b) => !matchedBaseline.has(b.name))
    .map((b) => ({ name: b.name, json: jsonOf(b.name), reason: b.workload !== null ? NOT_ASSESSED.agentIdentity : NOT_ASSESSED.noGoal }))
  for (const w of input.baselineUnusable) notAssessed.push({ name: w.policyName, json: jsonOf(w.policyName), reason: w.warning })

  const results: GoalResult[] = goals.map(({ goal, baselineMatches }) =>
    evaluateGoal(goal, baselineMatches, tenantFacts, input, assumed, facets),
  )

  // A tenant policy "maps to a goal" when any catalogue signature matches it,
  // whatever that goal's status turned out to be.
  const matchedTenantIds = new Set(
    tenantFacts
      .filter((f) => goals.some(({ goal }) => goal.implementations.some((impl) => matchesSignature(f, impl.signature))))
      .map((f) => f.id),
  )

  // The organisation report knows the tenant's naming convention; missing
  // goals then name the policy the plan will propose, first (§46).
  // One verdict and one gap sentence per goal (target-state §8.2, prompt 46
  // item 9), derived from the final status so no later step re-decides it.
  for (const r of results) {
    r.verdict = verdictOf(r.status)
    r.gapSentence = gapSentenceOf(r)
    r.gapClause = gapClauseOf(r)
  }
  const organisation = organisationReport(tenantFacts, results, snapshot, matchedTenantIds, notAssessed)
  // Threaded through the names already proposed, so a numbered series advances.
  // Without this every missing goal proposed CA004, because each call saw only
  // the tenant's existing names and none of the plan's own (prompt 43 Part 2).
  const naming = { ...organisation.naming, names: [...organisation.naming.names] }
  for (const r of results) {
    if (r.status !== 'absent') continue
    const match = goals.find((g) => g.goal.id === r.goal.id)?.baselineMatches[0]?.name ?? null
    const proposed = proposedPolicyName(r.goal, naming)
    naming.names.push(proposed)
    r.statement = missingStatement(r.goal.name, proposed, match)
  }

  const couldNotEvaluate = input.baselineUnusable.map((w) => ({
    name: w.policyName,
    reason: w.warning,
  }))

  const scored = results.filter((r) => r.status !== 'not-applicable' && r.status !== 'licence-limited')
  const enforcedCount = scored.filter((r) => r.status === 'enforced').length
  const summary = {
    enforced: enforcedCount,
    partial: results.filter((r) => r.status === 'partial' || r.status === 'below-baseline').length,
    belowBaseline: results.filter((r) => r.status === 'below-baseline').length,
    absent: results.filter((r) => r.status === 'absent').length,
    notApplicable: results.filter((r) => r.status === 'not-applicable').length,
    licenceLimited: results.filter((r) => r.status === 'licence-limited').length,
    unknown: results.filter((r) => r.status === 'unknown').length,
    scoredPercent: scored.length > 0 ? Math.round((enforcedCount / scored.length) * 100) : 0,
  }

  return {
    results,
    couldNotEvaluate,
    organisation,
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
    // Set from the final status in computeCoverage; never read before then.
    verdict: 'unknown',
    gapSentence: null,
    gapClause: null,
  }

  // Applicability facet (§9).
  if (goal.applicability !== null) {
    const facet = facets[goal.applicability as keyof typeof facets]
    if (facet && !facet.on) {
      return { ...base, status: 'not-applicable', statement: notApplicableStatement(goal.name, facet.reason) }
    }
  }

  // Licence (§7.5): no implementation at the tenant's tier.
  const cap = TIER_CAPABILITY[impl.tier]
  if (cap !== null && cap !== undefined && !input.snapshot.capabilities[cap].enabled) {
    return {
      ...base,
      status: 'licence-limited',
      statement: licenceLimitedStatement(goal.name, TIER_NAME[impl.tier] ?? impl.tier),
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
    return evaluateStructural(goal, base, candidates, floor, baselineMatches)
  }

  const enforced = new Set<string>()
  const weak = new Set<string>()
  const reportOnly = new Set<string>()
  const contributions: CandidateContribution[] = []
  const reasons: Reason[] = []
  let anyEstimated = false
  let anyUnresolved = false
  // Users some live (enabled or report-only) candidate includes — they are
  // "targeted" even when the policy is too weak to count.
  const targeted = new Set<string>()
  const exclusionHits: { id: string; kind: string; userIds: Set<string> }[] = []

  for (const c of candidates) {
    const caveats: string[] = []
    if (impl.expectedApps === 'all' && !c.apps.all) caveats.push('apps-narrower')
    if (c.apps.excludedIds.size > 0) caveats.push('apps-excluded')
    const live = c.state === 'enabled' || c.state === 'enabledForReportingButNotEnforced'

    const who = resolveFactsWho(c, input.snapshot, input.groupMembers)
    anyEstimated ||= who.estimated
    // A disabled candidate's unreadable group cannot make the goal unknown.
    if (live) anyUnresolved ||= who.unresolvedGroups.length > 0
    const pop = new Set([...who.effective].filter((id) => E.has(id)))
    const meetsFloor = satisfiesFloor(c.grant, c.session, floor)
    // Met at the catalogue floor but not at the baseline's raised one (§10).
    const meetsCatalogueFloor = raised !== null && !meetsFloor ? satisfiesFloor(c.grant, c.session, impl.floor) : meetsFloor
    const strongPop = meetsFloor ? pop : new Set<string>()

    if (live) {
      for (const id of who.included) if (E.has(id)) targeted.add(id)
    }
    if (c.state === 'enabled') {
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
    } else if (meetsFloor) {
      contribution = 'strong'
      for (const id of strongPop) enforced.add(id)
      if (caveats.includes('apps-narrower')) {
        reasons.push({
          kind: 'apps-narrower',
          userIds: [...strongPop],
          detail: REASON.appsNarrower(c.name),
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
          detail: meetsCatalogueFloor ? REASON.belowBaseline(c.name, describeFloor(floor)) : REASON.weakerControl(c.name, describeFloor(floor)),
          ...(meetsCatalogueFloor ? { belowBaseline: true } : {}),
          current: sessionOnly ? describeSession(c.session) : describeGrant(c.grant),
          floor: describeFloor(floor),
        })
      }
    }
    // A policy that targets all users is a broad match for a narrower goal (its
    // own scope belongs to mfa-all-users), so it is not this goal's own coverage.
    const ownScope = impl.expectedWho.kind === 'all' || !c.who.all
    contributions.push({ policyId: c.id, policyName: c.name, state: c.state, contribution, caveats, ownScope })
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
    const groupLabel =
      ex.kind === 'group' ? (input.groupMembers.get(ex.id)?.displayName ?? ex.id) : ex.id
    const assumedNote = assumed.confirmed ? '' : ': assumed, confirm in Setup'
    const detail =
      ex.kind === 'group'
        ? `excluded by the group ${groupLabel}${label ? ` (${label}${assumedNote})` : ''}`
        : ex.kind === 'role'
          ? REASON.excludedByRole(ex.id.split(',').length)
          : ex.kind === 'guests'
            ? REASON.guestsExcluded
            : REASON.excludedDirectly(isBreakGlassUser, assumedNote, stillMissing)
    reasons.push({
      kind: 'excluded',
      userIds: stillMissing,
      detail,
      expected: isExpected,
      role: label ?? (isBreakGlassUser ? 'breakGlass' : null),
    })
    if (isExpected) expectedExcluded.push(...stillMissing)
  }
  const accounted = new Set([...covered, ...reasons.flatMap((r) => (r.kind === 'excluded' ? r.userIds : []))])
  const notTargeted = [...E].filter((id) => !accounted.has(id) && !targeted.has(id))
  if (notTargeted.length > 0) {
    reasons.push({ kind: 'not-targeted', userIds: notTargeted, detail: REASON.notTargeted(notTargeted.length, E.size) })
  }
  if (reportOnly.size > 0) {
    reasons.push({ kind: 'report-only', userIds: [...reportOnly], detail: REASON.reportOnly })
  }
  const disabledOnly = contributions.length > 0 && contributions.every((c) => c.contribution === 'disabled')
  if (contributions.some((c) => c.contribution === 'disabled')) {
    reasons.push({
      kind: 'disabled-candidate',
      userIds: [],
      detail: REASON.disabledCandidates(contributions.filter((c) => c.contribution === 'disabled').map((c) => c.policyName)),
    })
  }
  base.reasons = reasons

  // Status (§7.5) — expected exclusions count as covered for "enforced".
  const effectiveExpected = new Set([...E].filter((id) => !expectedExcluded.includes(id)))
  // Nobody to cover (no guests, no active admins…) + a strong enabled policy
  // is "in place", not "missing": the policy exists and would apply.
  const fullyEnforced =
    effectiveExpected.size === 0
      ? contributions.some((c) => c.contribution === 'strong')
      : [...effectiveExpected].every((id) => enforced.has(id))

  // A goal the policy delivers for fewer apps than the goal expects is not in
  // place; it is partly in place (prompt 37 §10). Saying "In place ... Covers
  // fewer apps than the goal expects" in one breath is the contradiction the
  // review caught (T13): the caveat is the finding, so it decides the status
  // rather than trailing after it.
  const appsNarrower = reasons.some((r) => r.kind === 'apps-narrower')

  let status: GoalResult['status']
  if (anyUnresolved) status = 'unknown'
  else if (contributions.length === 0 || disabledOnly) status = 'absent'
  else if (fullyEnforced) status = appsNarrower ? 'partial' : 'enforced'
  else if (enforced.size === 0 && reportOnly.size === 0 && weak.size > 0 && reasons.some((r) => r.belowBaseline) && reasons.every((r) => r.belowBaseline || (r.kind === 'excluded' && r.expected)))
    status = 'below-baseline'
  else if (enforced.size > 0 || reportOnly.size > 0 || weak.size > 0) status = 'partial'
  else status = 'absent'

  const statement = buildStatement(goal, status, base, E, enforced, impl.expectedWho.kind, anyEstimated, baselineMatches, input.snapshot, assumed.users)
  return { ...base, status, statement }
}

function evaluateStructural(
  goal: Goal,
  base: Omit<GoalResult, 'status' | 'statement'>,
  candidates: PolicyFacts[],
  floor: Parameters<typeof satisfiesFloor>[2],
  baselineMatches: PolicyFacts[],
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
    // Workload-identity goals have no broader all-users match to displace.
    ownScope: true,
  }))
  base.candidates = contributions
  const status = contributions.some((c) => c.contribution === 'strong')
    ? 'enforced'
    : contributions.some((c) => c.contribution === 'weak' || c.contribution === 'reportOnly')
      ? 'partial'
      : 'absent'
  const strong = contributions.filter((c) => c.contribution === 'strong').map((c) => c.policyName)
  const partialBy = contributions.filter((c) => c.contribution === 'weak' || c.contribution === 'reportOnly')
  return {
    ...base,
    status,
    statement:
      status === 'absent'
        ? missingStatement(goal.name, null, baselineMatches[0]?.name ?? null)
        : status === 'enforced'
          ? inPlaceStatement(goal.name, strong, 0)
          : structuralPartialStatement(
              goal.name,
              partialBy.map((c) => c.policyName),
              partialBy.every((c) => c.contribution === 'reportOnly'),
            ),
  }
}

const GRANT_WORDS: Record<string, string> = {
  mfa: 'MFA',
  passwordless: 'passwordless sign-in',
  phishingResistant: 'phishing-resistant MFA',
  block: 'blocking access',
  compliantDevice: 'a compliant device',
  compliantApplication: 'an app protection policy',
  approvedApplication: 'an approved app',
  passwordChange: 'a password change',
}

function describeFloor(floor: Parameters<typeof satisfiesFloor>[2]): string {
  const parts: string[] = []
  if (floor.grant) parts.push(GRANT_WORDS[floor.grant] ?? floor.grant)
  if (floor.session?.maxSignInFrequencyHours !== undefined)
    parts.push(`sign-in every ${floor.session.maxSignInFrequencyHours} hours at most`)
  if (floor.session?.persistentBrowserNever) parts.push('no persistent browser sessions')
  if (floor.session?.secureSignInSession) parts.push('token protection')
  if (floor.session?.anyOf) parts.push('some session limit')
  return parts.join(' and ') || 'the baseline floor'
}

function describeGrant(grant: PolicyFacts['grant']): string {
  if (!grant) return 'nothing'
  const bits: string[] = []
  if (grant.controls.has('block')) bits.push('blocking access')
  if (grant.strength) bits.push(GRANT_WORDS[grant.strength] ?? grant.strength)
  else if (grant.controls.has('mfa')) bits.push('MFA')
  if (grant.controls.has('compliantDevice')) bits.push('a compliant device')
  if (grant.controls.has('domainJoinedDevice')) bits.push('a hybrid-joined device')
  if (grant.controls.has('compliantApplication')) bits.push('an app protection policy')
  if (grant.controls.has('approvedApplication')) bits.push('an approved app')
  if (grant.controls.has('compliantApplication')) bits.push('an app protection policy')
  if (grant.controls.has('passwordChange')) bits.push('a password change')
  if (bits.length === 0) return 'nothing'
  return bits.join(grant.operator === 'AND' && bits.length > 1 ? ' and ' : ' or ')
}

function describeSession(session: PolicyFacts['session']): string {
  const bits: string[] = []
  if (session.signInFrequencyEveryTime) bits.push('ask for a fresh sign-in every time')
  else if (session.signInFrequencyHours !== null) bits.push(`expire every ${session.signInFrequencyHours} hours`)
  if (session.persistentBrowser === 'always') bits.push('persist in the browser')
  if (session.persistentBrowser === 'never') bits.push('never persist')
  if (session.secureSignInSession) bits.push('use token protection')
  if (session.appEnforced) bits.push('apply app-enforced restrictions')
  return bits.length > 0 ? bits.join(' and ') : 'have no limits'
}

// Days observed and would-be failures for a report-only policy; null when
// the records do not cover it (never a fabricated zero).
function reportOnlyObservation(policyId: string, snapshot: TenantSnapshot): { days: number | null; failures: number | null } {
  const src = snapshot.sources.signInEvidence
  if (!src || (src.status !== 'ok' && src.status !== 'partial') || !src.coveredWindow) return { days: null, failures: null }
  const days = Math.floor((Date.parse(src.coveredWindow.to) - Date.parse(src.coveredWindow.from)) / 86_400_000)
  const pr = snapshot.evidencePolicyResults.find((p) => p.policyId === policyId)
  if (!pr) return { days, failures: null }
  return { days, failures: pr.counts.reportOnlyFailure + pr.counts.reportOnlyInterrupted }
}

// Prompt 09 statement shapes — human sentences; the mechanics stay in reasons.
function buildStatement(
  goal: Goal,
  status: GoalResult['status'],
  base: Omit<GoalResult, 'status' | 'statement'>,
  E: Set<string>,
  enforced: Set<string>,
  who: string,
  estimated: boolean,
  baselineMatches: PolicyFacts[],
  snapshot: TenantSnapshot,
  allBreakGlass: ReadonlySet<string>,
): string {
  const noun = who === 'coreAdmins' ? 'admin' : who === 'guests' ? 'guest' : who === 'members' ? 'member' : 'user'
  const strongNames = base.candidates.filter((c) => c.contribution === 'strong').map((c) => c.policyName)
  const est = estimated ? ' Counts are estimated — a group is over the membership cap.' : ''
  // Only break-glass exclusions are called break-glass; service-account and
  // other allowed exclusions are expected but named differently in the detail.
  const breakGlassIds = new Set(
    base.reasons.filter((r) => r.kind === 'excluded' && r.expected && (r.role ?? '').includes('breakGlass')).flatMap((r) => r.userIds),
  )
  const breakGlass = breakGlassIds.size
  // Which accounts, not just how many, when this goal excludes fewer than the
  // tenant's full break-glass set (prompt 37 §5, T14).
  const breakGlassMissing = [...allBreakGlass].filter((id) => !breakGlassIds.has(id))
  const narrower = base.reasons.some((r) => r.kind === 'apps-narrower') ? ' Covers fewer apps than the goal expects.' : ''

  if (status === 'enforced') return inPlaceStatement(goal.name, strongNames, breakGlass, allBreakGlass.size, breakGlassMissing) + est
  if (status === 'absent') return missingStatement(goal.name, null, baselineMatches[0]?.name ?? null)
  if (status === 'unknown') return unknownStatement(goal.name) + est
  if (status === 'not-applicable' || status === 'licence-limited') return `**${goal.name}**.`
  if (status === 'below-baseline') {
    const below = base.reasons.find((r) => r.belowBaseline)
    const names = base.candidates.filter((c) => c.contribution === 'weak').map((c) => c.policyName)
    return belowBaselineStatement(goal.name, names, below?.current ?? 'the goal\'s control', below?.floor ?? 'more', base.floorRaised?.by ?? null) + est
  }

  // partial — pick the shape from what is actually wrong.
  const control = base.reasons.find((r) => r.kind === 'weaker-control')
  const session = base.reasons.find((r) => r.kind === 'session-weaker')
  const reportOnlyOnly = base.reportOnlyIds.length > 0 && enforced.size === 0 && base.weakIds.length === 0
  if (reportOnlyOnly) {
    const ro = base.candidates.find((c) => c.contribution === 'reportOnly')
    if (ro) {
      const obs = reportOnlyObservation(ro.policyId, snapshot)
      return reportOnlyStatement(goal.name, ro.policyName, obs.days, obs.failures) + est
    }
  }
  if (control) {
    return partialControlStatement(goal.name, control.current ?? 'a weaker control', control.floor ?? 'more', control.userIds.length, E.size, noun) + est
  }
  if (session) {
    return partialSessionStatement(goal.name, session.current ?? 'have weaker limits', session.floor ?? 'tighter limits', session.userIds.length, E.size, noun) + est
  }
  const notCovered: { reason: string; count: number }[] = []
  for (const r of base.reasons) {
    if (r.kind === 'excluded' && !r.expected) notCovered.push({ reason: r.detail, count: r.userIds.length })
    if (r.kind === 'not-targeted') notCovered.push({ reason: 'never targeted by a policy', count: r.userIds.length })
    if (r.kind === 'report-only') notCovered.push({ reason: 'covered only in report-only', count: r.userIds.length })
  }
  return partialScopeStatement(goal.name, enforced.size, E.size, noun, notCovered) + narrower + est
}
