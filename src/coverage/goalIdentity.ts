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
}

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
  if (a.authContexts.size > 0) return 'specific'
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
  const map: GoalMap = {}
  const unmappedGoals: string[] = []
  const ties: { goalId: string; candidates: string[] }[] = []
  const claimed = new Set<string>()

  for (const goal of CATALOGUE) {
    // A policy is a candidate if it implements ANY of the goal's implementations.
    const found = new Map<string, PolicyForMap>()
    let bestTemplate = new Set<CondTag>()
    for (const impl of goal.implementations) {
      for (const p of candidates(impl, policies)) {
        found.set(p.id, p)
        const tt = templateTags(impl)
        if (tt.size > bestTemplate.size) bestTemplate = tt
      }
    }
    const cands = [...found.values()]
    if (cands.length === 0) {
      unmappedGoals.push(goal.id)
      continue
    }
    if (cands.length === 1) {
      map[goal.id] = [cands[0].id]
      claimed.add(cands[0].id)
      continue
    }
    // Closest superset of the template: the fewest conditions beyond it.
    const extra = (p: PolicyForMap): number => [...condTags(p.facts)].filter((t) => !bestTemplate.has(t)).length
    const ranked = [...cands].sort((a, b) => extra(a) - extra(b))
    if (extra(ranked[0]) === extra(ranked[1])) {
      ties.push({ goalId: goal.id, candidates: ranked.filter((p) => extra(p) === extra(ranked[0])).map((p) => p.name) })
      continue // a tie maps nothing (owner resolution)
    }
    map[goal.id] = [ranked[0].id]
    claimed.add(ranked[0].id)
  }

  const unmappedPolicies = policies.filter((p) => !claimed.has(p.id)).map((p) => p.name)
  return { map, unmappedGoals, unmappedPolicies, ties }
}
