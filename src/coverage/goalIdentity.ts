// Stage 3 of baseline onboarding (prompt 51, owner resolution): goal → policy is
// a property of the baseline, decided once at pin time and stored, never matched
// at render time. `matchesSignature` stays a floor predicate over the tenant's
// policies; this is a *stricter identity* used only to pick the one baseline
// policy that implements each goal, so the step body reads a stored map:
//
//   - the control kind must be the same: a block policy never implements a grant
//     goal; a session goal needs a session control; a grant goal a grant.
//   - the user scope must be the same class: All users / directory roles /
//     guests / workload identities.
//   - the resource scope must be the same class: All resources / a named app set
//     (Office 365, Azure management, admin portals, a specific set) / a user action.
//   - every condition in the goal's template must be present in the policy.
//   - if more than one policy survives, take the closest superset of the
//     template (the fewest extra conditions); a remaining tie maps nothing and
//     is listed for the reviewer.
//
// Pure: no DOM, no network. Runs in the pin script and in Node tests.
import goalsData from '../../data/goals.json' with { type: 'json' }
import type { Goal, Implementation, PolicyFacts } from './types.ts'

const CATALOGUE = goalsData.goals as unknown as Goal[]
const ASM_APP_ID = '797f4846-ba00-4fd7-ba43-dac1f8f63013' // Windows Azure Service Management API

export type PolicyForMap = { id: string; name: string; facts: PolicyFacts }
export type GoalMap = Record<string, string[]>
export type GoalMapResult = {
  map: GoalMap
  unmappedGoals: string[]
  unmappedPolicies: string[]
  ties: { goalId: string; candidates: string[] }[]
  /** A policy that differs from a mapped one only in its exclusion set (owner resolution). */
  variants: { policy: string; variantOf: string }[]
}

// Content renders these goals with two policies (Policy A / Policy B), so the map
// value is an ordered pair, never a tie. A mergesGoals step's anchor goal maps to
// the pair [its own policy, the merged goal's policy]; the merged goal is not
// mapped separately. guests-mfa is a single goal the baseline implements with two
// policies — A the multifactor grant, B the stronger authentication-strength grant
// (matching content.json's Policy A/B). Derived from content.json's mergesGoals
// and Policy A/B leads; kept here because goalIdentity has no content import.
const MERGE_ANCHOR: Record<string, string> = { 'byod-session-controls': 'block-downloads-unmanaged' }
const DECLARED_PAIR = new Set(['guests-mfa'])

type UserClass = 'all' | 'coreAdmins' | 'guests' | 'workload' | 'members'
type CondTag = string // 'locations' | 'platforms' | 'clientAppsRestricted' | 'flows' | 'deviceFilter' | 'userActions' | 'authContext' | 'signInRisk:high' | 'userRisk:medium' | …

function userClass(f: PolicyFacts): UserClass {
  if (f.workload) return 'workload'
  if (f.who.roles.size > 0) return 'coreAdmins'
  if (f.who.all) return 'all'
  if (f.who.guests !== null) return 'guests'
  return 'members'
}

function appsClass(f: PolicyFacts): string {
  const a = f.apps
  if (a.adminPortals) return 'adminPortals'
  if (a.ids.has(ASM_APP_ID)) return 'azureManagement'
  if (a.userActions.size > 0) return 'userAction'
  if (a.authContexts.size > 0) return 'authContext' // its own class, distinct from an app set (owner resolution)
  if (a.all) return 'all'
  if (a.office365) return 'office365'
  if (a.ids.size > 0) return 'specific'
  return 'all'
}

/** The distinguishing conditions a policy carries. */
function condTags(f: PolicyFacts): Set<CondTag> {
  const t = new Set<CondTag>()
  if (f.locations && (f.locations.exclude.size > 0 || [...f.locations.include].some((l) => !/^all$/i.test(l)))) t.add('locations')
  if (f.platforms && (f.platforms.include.size > 0 || f.platforms.exclude.size > 0)) t.add('platforms')
  if ([...f.clientApps].some((c) => c !== 'all')) t.add('clientAppsRestricted')
  for (const fl of f.flows) t.add(`flow:${fl.toLowerCase()}`)
  for (const l of f.signInRisk) t.add(`signInRisk:${l}`)
  for (const l of f.userRisk) t.add(`userRisk:${l}`)
  if (f.deviceFilter) t.add('deviceFilter')
  if (f.apps.userActions.size > 0) t.add('userActions')
  if (f.apps.authContexts.size > 0) t.add('authContext')
  return t
}

/** The conditions a goal's template requires. */
function templateTags(impl: Implementation): Set<CondTag> {
  const c = ((impl.template?.conditions ?? {}) as Record<string, unknown>) || {}
  const apps = (c.applications ?? {}) as Record<string, unknown>
  const t = new Set<CondTag>()
  const loc = c.locations as { excludeLocations?: unknown[]; includeLocations?: string[] } | undefined
  if (loc && ((loc.excludeLocations?.length ?? 0) > 0 || (loc.includeLocations ?? []).some((l) => !/^all$/i.test(l)))) t.add('locations')
  if (c.platforms) t.add('platforms')
  const cat = c.clientAppTypes as string[] | undefined
  if (Array.isArray(cat) && !(cat.length === 1 && /^all$/i.test(cat[0]))) t.add('clientAppsRestricted')
  if (Array.isArray(apps.includeUserActions) && (apps.includeUserActions as unknown[]).length > 0) t.add('userActions')
  if (Array.isArray(apps.includeAuthenticationContextClassReferences) && (apps.includeAuthenticationContextClassReferences as unknown[]).length > 0) t.add('authContext')
  for (const l of (c.signInRiskLevels as string[] | undefined) ?? []) t.add(`signInRisk:${String(l).toLowerCase()}`)
  for (const l of (c.userRiskLevels as string[] | undefined) ?? []) t.add(`userRisk:${String(l).toLowerCase()}`)
  const flows = (c.authenticationFlows as { transferMethods?: string } | undefined)?.transferMethods
  if (flows) for (const fl of flows.split(',').map((x) => x.trim()).filter(Boolean)) t.add(`flow:${fl.toLowerCase()}`)
  if (c.devices) t.add('deviceFilter')
  return t
}

function controlKindOk(impl: Implementation, f: PolicyFacts): boolean {
  const grant = impl.floor.grant
  const session = impl.floor.session
  const hasGrant = f.grant !== null
  const isBlock = hasGrant && [...f.grant!.controls].some((c) => /^block$/i.test(c))
  const hasSession =
    f.session.signInFrequencyHours !== null ||
    f.session.signInFrequencyEveryTime ||
    f.session.persistentBrowser !== null ||
    f.session.appEnforced ||
    f.session.secureSignInSession ||
    f.session.cloudAppSecurity !== null
  if (grant === 'block') {
    if (!isBlock) return false
  } else if (grant) {
    if (!hasGrant || isBlock) return false // a block policy never implements a grant goal
  }
  if (session) {
    if (!hasSession) return false
    // The specific session controls the floor names must be the ones the policy
    // carries (a token-protection goal is not a persistence goal). `anyOf` means
    // at least one; otherwise every named control must be present.
    const s = f.session
    const checks: boolean[] = []
    if (session.secureSignInSession) checks.push(s.secureSignInSession)
    if (session.signInFrequencyEveryTime) checks.push(s.signInFrequencyEveryTime)
    if (session.persistentBrowserNever) checks.push(s.persistentBrowser === 'never')
    if (session.appEnforced) checks.push(s.appEnforced)
    if (session.maxSignInFrequencyHours !== undefined) checks.push(s.signInFrequencyHours !== null || s.signInFrequencyEveryTime)
    if (checks.length > 0) {
      const ok = session.anyOf ? checks.some(Boolean) : checks.every(Boolean)
      if (!ok) return false
    }
  }
  return true
}

const subset = <T>(a: Set<T>, b: Set<T>): boolean => [...a].every((x) => b.has(x))

/** Candidate policies for one implementation, under the strict identity rule. */
function candidates(impl: Implementation, policies: PolicyForMap[]): PolicyForMap[] {
  const want = templateTags(impl)
  return policies.filter((p) => {
    if (!controlKindOk(impl, p.facts)) return false
    if (userClass(p.facts) !== impl.expectedWho.kind) return false
    if (appsClass(p.facts) !== impl.expectedApps) return false
    return subset(want, condTags(p.facts))
  })
}

/**
 * Map every catalogue goal to the baseline policy that implements it. A goal with
 * no candidate is unmapped (not in this baseline); a goal whose closest-superset
 * pick is still a tie maps nothing and is listed. A policy no goal claims is an
 * unmapped policy (a not-assessed Cleanup row).
 */
export function mapGoalsToPolicies(policies: PolicyForMap[]): GoalMapResult {
  const goalById = new Map(CATALOGUE.map((g) => [g.id, g]))
  const variants: { policy: string; variantOf: string }[] = []

  // A policy without its exclusion set — two policies with the same core are one
  // goal plus a variant (owner resolution). The exclusion set is compared apart.
  const core = (f: PolicyFacts): string =>
    JSON.stringify([
      userClass(f), appsClass(f),
      [...condTags(f)].sort(),
      f.grant ? [[...f.grant.controls].sort(), f.grant.strengthId ? 'strength' : ''] : null,
      [f.session.signInFrequencyHours, f.session.signInFrequencyEveryTime, f.session.persistentBrowser, f.session.appEnforced, f.session.secureSignInSession, f.session.cloudAppSecurity],
      [...f.who.roles].sort(), [...f.who.groups].sort(), [...f.who.users].sort(), f.who.all, f.who.guests?.slice().sort() ?? null,
    ])

  /** Candidates for one goal, with variants collapsed to the placeholder-carrier. */
  const collapsedCandidates = (goalId: string): { cands: PolicyForMap[]; bestTemplate: Set<CondTag> } => {
    const goal = goalById.get(goalId)
    if (!goal) return { cands: [], bestTemplate: new Set() }
    const found = new Map<string, PolicyForMap>()
    let bestTemplate = new Set<CondTag>()
    for (const impl of goal.implementations) {
      for (const p of candidates(impl, policies)) {
        found.set(p.id, p)
        const tt = templateTags(impl)
        if (tt.size > bestTemplate.size) bestTemplate = tt
      }
    }
    // Collapse variants: group by core; the one with the most excluded groups (the
    // placeholder-carrying policy) wins, the rest are recorded as variants.
    const byCore = new Map<string, PolicyForMap[]>()
    for (const p of found.values()) {
      const k = core(p.facts)
      ;(byCore.get(k) ?? byCore.set(k, []).get(k)!).push(p)
    }
    const cands: PolicyForMap[] = []
    for (const group of byCore.values()) {
      if (group.length === 1) { cands.push(group[0]); continue }
      const ranked = [...group].sort((a, b) => b.facts.whoNot.groups.size - a.facts.whoNot.groups.size || a.name.localeCompare(b.name))
      cands.push(ranked[0])
      for (const loser of ranked.slice(1)) variants.push({ policy: loser.name, variantOf: ranked[0].name })
    }
    return { cands, bestTemplate }
  }

  /** The one policy for a goal after collapse and closest-superset; null on a tie. */
  const pick = (goalId: string): PolicyForMap | { tie: string[] } | null => {
    const { cands, bestTemplate } = collapsedCandidates(goalId)
    if (cands.length === 0) return null
    if (cands.length === 1) return cands[0]
    const extra = (p: PolicyForMap): number => [...condTags(p.facts)].filter((t) => !bestTemplate.has(t)).length
    const ranked = [...cands].sort((a, b) => extra(a) - extra(b))
    if (extra(ranked[0]) === extra(ranked[1])) return { tie: ranked.filter((p) => extra(p) === extra(ranked[0])).map((p) => p.name) }
    return ranked[0]
  }

  const map: GoalMap = {}
  const unmappedGoals: string[] = []
  const ties: { goalId: string; candidates: string[] }[] = []
  const claimed = new Set<string>()
  const merged = new Set(Object.values(MERGE_ANCHOR))
  const isPolicy = (v: PolicyForMap | { tie: string[] } | null): v is PolicyForMap => v !== null && !('tie' in v)

  for (const goal of CATALOGUE) {
    if (merged.has(goal.id)) continue // mapped as part of its anchor's pair

    // A mergesGoals anchor maps to the ordered pair [its policy, the merged goal's].
    const other = MERGE_ANCHOR[goal.id]
    if (other) {
      const a = pick(goal.id)
      const b = pick(other)
      if (isPolicy(a) && isPolicy(b)) {
        map[goal.id] = [a.id, b.id]
        claimed.add(a.id).add(b.id)
      } else {
        // The pair could not be formed; fall through to a singleton or a report.
        if (isPolicy(a)) { map[goal.id] = [a.id]; claimed.add(a.id) }
        else if (a && 'tie' in a) ties.push({ goalId: goal.id, candidates: a.tie })
        else unmappedGoals.push(goal.id)
      }
      continue
    }

    // A declared two-policy goal (guests-mfa): both candidates, A the multifactor
    // grant, B the stronger authentication-strength grant.
    if (DECLARED_PAIR.has(goal.id)) {
      const { cands } = collapsedCandidates(goal.id)
      if (cands.length >= 2) {
        const ordered = [...cands].sort((x, y) => Number(!!x.facts.grant?.strengthId) - Number(!!y.facts.grant?.strengthId) || x.name.localeCompare(y.name))
        map[goal.id] = ordered.map((p) => p.id)
        for (const p of ordered) claimed.add(p.id)
        continue
      }
      // Fewer than two — resolve as a normal goal below.
    }

    const one = pick(goal.id)
    if (one === null) unmappedGoals.push(goal.id)
    else if ('tie' in one) ties.push({ goalId: goal.id, candidates: one.tie })
    else { map[goal.id] = [one.id]; claimed.add(one.id) }
  }

  const variantPolicies = new Set(variants.map((v) => v.policy))
  const unmappedPolicies = policies.filter((p) => !claimed.has(p.id) && !variantPolicies.has(p.name)).map((p) => p.name)
  return { map, unmappedGoals, unmappedPolicies, ties, variants }
}
