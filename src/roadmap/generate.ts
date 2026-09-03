// Step generation (roadmap.md §1–§6; 2026-08-27 redesign: collapsed phase 0,
// per-tenant impact, safe-today lane, handle-with-care gating, comms drafts,
// operator self-safety, Learn links, auto-scheduling). Pure.
import type { ReferenceKind } from '../baseline/types.ts'
import { docFor } from '../baseline/index.ts'
import type { BaselinePackage } from '../baseline/types.ts'
import { CORE_ADMIN_ROLE_IDS, matchesSignature } from '../coverage/classify.ts'
import { placeholdersIn, resolveTemplate } from './template.ts'
import { BLOCKED_REASON, READINESS_MEASURE } from '../copy/reasons.ts'
import type { TemplateBody, TemplatePlaceholder, TemplateValues } from './template.ts'
import { policyFacts } from '../coverage/facts.ts'
import { PINNED_GOAL_MAP, goalInMap, policyKey } from './goalMap.ts'
import type { GoalMap } from './goalMap.ts'
import type { StrengthLookup } from '../coverage/strength.ts'
import type { CoverageReport, Goal, GoalResult } from '../coverage/types.ts'
import { resolvePopulation } from '../coverage/population.ts'
import type { GroupMembers } from '../coverage/population.ts'
import { proposeRings, ringContextIndexes } from './rings.ts'
import { campaignIds } from '../derive/population.ts'
import { isNonPerson, notActiveUsers } from '../derive/sets.ts'
import { accountVerdict } from './strand.ts'
import { tenantRhythm } from './rhythm.ts'
import { eventsFor } from './timing.ts'
import { MANAGER, MANAGER_BY_GOAL } from '../copy/plain.ts'
import { contentTitle } from '../content/stepTitle.ts'
import { engine, stepById } from '../content/content.ts'
import { unresolvedReferences } from '../baseline/index.ts'
import { countryName as countryLabel } from '../mapping/countries.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { adminUserIds, learnRoleNames, roleListSummary } from '../roles.ts'
import { proposedPolicyName } from '../coverage/naming.ts'
import { rolloutBucket, summarizeTenant } from '../scoring/mfaViability.ts'
import type { NameDirectory } from '../names.ts'
import { collidingGuestIds } from '../names.ts'
import { isAllowlistGeoPolicy, tenantCountryLocation } from '../mapping/countries.ts'
import { absoluteDate } from '../copy/dates.ts'
import { detectHighCare } from '../derive/highCare.ts'
import { checksNotRun } from '../validation/report.ts'
import {
  READINESS_THRESHOLD_ADMINS_PERCENT,
  READINESS_THRESHOLD_DEVICES_PERCENT,
  READINESS_THRESHOLD_MFA_PERCENT,
  SEVERITY_BLOCK,
  SEVERITY_DEFAULT,
  SEVERITY_STRENGTH_OR_DEVICE,
} from './constants.ts'
import { evidenceFor } from './evidence.ts'
import { goalFamily, readinessFor } from './readiness.ts'
import { cantSeeFor, scenarioContext, scenarioLinesFor } from './scenarioLines.ts'
import { SCENARIO } from '../copy/scenarios.ts'
import { sharedDeviceIds, sharedDeviceUsers } from '../derive/sharedDevices.ts'
import { staticViolations } from './staticRules.ts'
import { cleanupPhaseFor } from './cleanupPhase.ts'
import { isFloorGoal } from './floor.ts'
/** The three questions the operator can answer (prompt 48 item 10); a title lives in content.json, under shared.engine.carveOuts. */
const CARVE_OUT_IDS = ['mailDevices', 'travel', 'partner'] as const

/** Step titles are the goal name as an imperative: the kind is a chip, never a prefix. */
function stepTitle(goalName: string): string {
  return goalName.charAt(0).toUpperCase() + goalName.slice(1)
}

import { buildSchedule, nextWorkingDay } from './schedule.ts'
import type { ChangeFreeze, Schedule } from './schedule.ts'
import type { Action, Blocker, Readiness, Step, StepPopulation, StepStatus } from './types.ts'
import type { SizeBand } from './constants.ts'
import { INVENTORY } from '../copy/inventory.ts'
import { annotateStateReasons } from './stateReason.ts'
import { NO_ANNOUNCEMENT, announcementFor } from '../copy/announcements.ts'
import { proposedObjectNames } from '../coverage/naming.ts'
import { NAMED_BELOW } from './constants.ts'
import { registrationWindow } from './campaign.ts'
import { ladderSteps } from './ladder.ts'
import { EMERGENCY_ACCESS_STEP_IDS, blockerStepId, blockerSteps, gateFor, gateReason } from './blockerSteps.ts'
import { stepChecks } from '../validation/checkFixes.ts'
import { buildContext, breakGlassReport, reportFor } from '../validation/report.ts'
import type { SubjectReport } from '../validation/report.ts'
import { STEP_EXTRAS } from './stepDefaults.ts'

/** Evidence must cover at least this many days and hold this many sign-ins (or one per active person in scope) before a step is safe today (§2.4). */
export const SAFE_MIN_EVIDENCE_DAYS = 14
export const SAFE_MIN_SIGNINS = 500

export type RoadmapInput = {
  planId: string
  coverage: CoverageReport
  snapshot: TenantSnapshot
  baseline: BaselinePackage
  baselineAuthor: { author: string; url: string } | null
  mapping: MappingState
  viability: MfaViability[]
  strengths: StrengthLookup
  startDate?: string
  /** Size-band override; null or absent = detected from active users. */
  band?: SizeBand | null
  operatorUserId?: string | null
  names?: NameDirectory
  /** Cached group memberships: the confirmed exclusion groups leave every step's population. */
  groupMembers?: GroupMembers
  /**
   * A date range in which nothing is enforced (roadmap-v2.md §2). With the
   * start date, the only schedule input there is (target-state §9): no pace,
   * no notice periods, no holidays, no revert threshold, no per-step dates. A
   * plan file that still carries those is read and the values ignored.
   */
  changeFreeze?: ChangeFreeze | null
  /**
   * The goal map of the loaded baseline (walk-51 item 9): which goals it holds
   * and the policy that stands for each, decided at pin time (goalMap.ts). A
   * goal the map does not hold never renders. Absent means the pinned map — the
   * product's, the demo's and the fixtures' baseline alike.
   */
  goalMap?: GoalMap
}

export type RoadmapResult = {
  steps: Step[]
  schedule: Schedule
  /** Plan-footer housekeeping that comes from the engine (prompt 46 item 21). */
  housekeeping: { checksNotRun: string | null; staticViolations: import('./staticRules.ts').StaticViolation[] }
}

const EXTRAS = STEP_EXTRAS

function idFor(prefix: string, key: string): string {
  return `s-${prefix}-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`
}

/** The stable step id for a goal (deep links from Findings and Setup). */
export function stepIdForGoal(goalId: string): string {
  return idFor('goal', goalId)
}
export const EXCLUSION_GROUP_STEP_ID = 's-prereq-exclusion-group'
/** Nominating the emergency access accounts. Exported so the skip guard can name it. */
export const BREAK_GLASS_STEP_ID = 's-prereq-break-glass'

type PopulationIndex = { active: Set<string>; admins: Set<string>; guests: Set<string> }
function populationIndex(snapshot: TenantSnapshot, viability: MfaViability[]): PopulationIndex {
  return {
    active: new Set(viability.filter((v) => v.activity === 'active').map((v) => v.userId)),
    admins: adminUserIds(snapshot.roles),
    guests: new Set(snapshot.users.filter((u) => u.userType === 'guest').map((u) => u.id)),
  }
}
/** Counts for a step's population; the index is built once per plan so 25,000 users are not rescanned per step. */
/**
 * The audience a step announcement is written for (prompt 41 §4).
 *
 * NAMED_BELOW is the same
 * threshold, so the greeting on the step and the audience label on the comms
 * plan cannot disagree about whether these are named people or a crowd.
 */
function announcementAudience(pop: StepPopulation, admins: boolean, nameOf: (id: string) => string): { kind: string; names?: string[] } {
  if (pop.total === 0) return { kind: 'none' }
  if (admins) return { kind: 'admins' }
  if (pop.ids.length < NAMED_BELOW) return { kind: 'named', names: pop.ids.map(nameOf) }
  return { kind: 'everyone' }
}

function population(ids: string[], index: PopulationIndex): StepPopulation {
  // One denominator (target-state §8.1): the who-line and the population line
  // count active people. admins and guests are the active ones too, so the
  // line and the count cannot disagree. inScope keeps the enabled total for the
  // "covers N enabled" suffix.
  const activeIds = ids.filter((id) => index.active.has(id))
  let admins = 0
  let guests = 0
  for (const id of activeIds) {
    if (index.admins.has(id)) admins += 1
    if (index.guests.has(id)) guests += 1
  }
  return { total: ids.length, active: activeIds.length, admins, guests, ids, activeIds, inScope: ids.length }
}

/** The coverage gap, over the active denominator (prompt 48.1 item 3): "covers 1 of 4 active". */
function activeGap(result: GoalResult, popActive: number, active: Set<string>): string | null {
  const base = result.gapSentence
  if (!base || !/^covers \d+ of \d+ people$/.test(base)) return base
  const uncovered = new Set(result.reasons.filter((x) => !x.expected && (x.kind === 'not-targeted' || x.kind === 'excluded')).flatMap((x) => x.userIds))
  const uncoveredActive = [...uncovered].filter((id) => active.has(id)).length
  return `covers ${Math.max(0, popActive - uncoveredActive)} of ${popActive} active`
}

/** The row's short gap clause (prompt 50.1 item 9), over the active denominator like activeGap. */
function activeGapShort(result: GoalResult, popActive: number, active: Set<string>): string | null {
  const base = result.gapClause
  if (!base || !/^covers \d+ of \d+ people$/.test(base)) return base
  const uncovered = new Set(result.reasons.filter((x) => !x.expected && (x.kind === 'not-targeted' || x.kind === 'excluded')).flatMap((x) => x.userIds))
  const uncoveredActive = [...uncovered].filter((id) => active.has(id)).length
  return `covers ${Math.max(0, popActive - uncoveredActive)} of ${popActive} active`
}

// ---- action building (roadmap.md §3) ----

type RawPolicy = Record<string, unknown>

/** The Wave 0 steps that create the objects the plan's policies reference. */
export const PREREQ_STEP_ID = {
  breakGlass: BREAK_GLASS_STEP_ID,
  exclusionsGroup: 's-prereq-exclusion-group',
  trustedLocation: 's-prereq-trusted-location',
  allowedCountries: 's-prereq-allowed-countries',
  serviceAccountsGroup: 's-prereq-service-accounts-group',
} as const

/**
 * The Wave 0 step a template placeholder waits on while the tenant has no
 * object for it (prompt 46 item 12). {namePrefix} and {coreAdminRoles} always
 * resolve, so they are not here.
 */
export const PLACEHOLDER_STEP: Record<Exclude<TemplatePlaceholder, '{namePrefix}' | '{coreAdminRoles}'>, string> = {
  '{breakGlass}': PREREQ_STEP_ID.breakGlass,
  '{exclusionsGroup}': PREREQ_STEP_ID.exclusionsGroup,
  '{trustedLocations}': PREREQ_STEP_ID.trustedLocation,
  '{allowedCountriesLocation}': PREREQ_STEP_ID.allowedCountries,
  '{serviceAccountsGroup}': PREREQ_STEP_ID.serviceAccountsGroup,
}



/** The tenant's own ids for baseline reference ids a goal resolves itself (the countries location). */
function replaceIds(policy: RawPolicy, ids: ReadonlyMap<string, string>): RawPolicy {
  if (ids.size === 0) return policy
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (typeof v === 'string') return ids.get(v) ?? v
    if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v as RawPolicy).map(([k, val]) => [k, walk(val)]))
    return v
  }
  return walk(policy) as RawPolicy
}

function replaceReferences(policy: RawPolicy, mapping: MappingState): RawPolicy {
  const resolved = new Map<string, string>()
  for (const r of Object.values(mapping.records)) {
    if (r.resolvedId !== null && !r.placeholder.startsWith('__')) resolved.set(r.placeholder, r.resolvedId)
  }
  const g = mapping.records['__globalExclusion']
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (typeof v === 'string') return resolved.get(v) ?? v
    if (v !== null && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as RawPolicy).map(([k, val]) => [k, walk(val)]))
    }
    return v
  }
  const body = walk(structuredClone(policy)) as RawPolicy
  // Ensure the global exclusion group is excluded on every generated policy.
  if (g?.resolvedId) {
    const conditions = (body.conditions ?? {}) as RawPolicy
    const users = (conditions.users ?? {}) as RawPolicy
    const ex = new Set(Array.isArray(users.excludeGroups) ? (users.excludeGroups as string[]) : [])
    ex.add(g.resolvedId)
    users.excludeGroups = [...ex]
    conditions.users = users
    body.conditions = conditions
  }
  return body
}

/**
 * Strip references no object resolves yet from a policy body so a downloaded
 * artifact never carries a placeholder (prompt 49.1 item 1). An unresolved entry
 * is a placeholder token or a {template} slot; it is dropped from its array, and
 * an array that held only unresolved entries is dropped with its key. Nothing is
 * dropped silently: every entry left out comes back in `missing`, with the
 * Preparation step that creates it, and the JSON and PowerShell tabs wait on
 * those. The portal steps keep the reference (resolved to a label).
 */
function stripUnresolvedForJson(policy: RawPolicy, unresolvedSteps: ReadonlyMap<string, string | null> = new Map()): { policy: RawPolicy; missing: { token: string; stepId: string | null }[] } {
  const unresolved = (s: string): boolean => unresolvedSteps.has(s) || /^\{[A-Za-z]+\}$/.test(s) || /^__IAMAI_/.test(s)
  const missing: { token: string; stepId: string | null }[] = []
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      const kept: unknown[] = []
      for (const x of v) {
        if (typeof x === 'string' && unresolved(x)) {
          if (!missing.some((m) => m.token === x)) missing.push({ token: x, stepId: unresolvedSteps.get(x) ?? PLACEHOLDER_STEP[x as keyof typeof PLACEHOLDER_STEP] ?? null })
          continue
        }
        kept.push(walk(x))
      }
      return kept
    }
    if (v !== null && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(v as RawPolicy)) {
        const w = walk(val)
        // An array emptied by stripping loses its key; an originally-empty array stays.
        if (Array.isArray(w) && w.length === 0 && Array.isArray(val) && (val as unknown[]).length > 0) continue
        out[k] = w
      }
      return out
    }
    return v
  }
  return { policy: walk(structuredClone(policy)) as RawPolicy, missing }
}




export function buildCreateAction(
  baselinePolicy: RawPolicy,
  mapping: MappingState,
  planId: string,
  stepId: string,
  opts: { displayName?: string; adjust?: { policyId: string; state: string }; unresolved?: ReadonlyMap<string, string | null>; resolveIds?: ReadonlyMap<string, string> } = {},
): Action {
  const body = replaceIds(replaceReferences(baselinePolicy, mapping), opts.resolveIds ?? new Map())
  delete body.id
  delete body.createdDateTime
  delete body.modifiedDateTime
  // The pinned baseline's own placeholder map names the author's objects; it is not a policy field.
  delete body.placeholders
  // A new policy starts in report-only; an adjusted one keeps its current state.
  body.state = opts.adjust ? opts.adjust.state : 'enabledForReportingButNotEnforced'
  if (opts.displayName) body.displayName = opts.displayName
  const tag = `[IAMAI:${planId}:${stepId}]`
  body.description = `${tag}${typeof baselinePolicy.description === 'string' && baselinePolicy.description ? ' ' + baselinePolicy.description : ''}`
  // The JSON strips any object that does not exist yet, so a download never carries a placeholder.
  const stripped = stripUnresolvedForJson(body, opts.unresolved)
  const json = JSON.stringify(stripped.policy, null, 2)
  return { kind: opts.adjust ? 'adjust' : 'create', summary: [], json, portalSteps: [], missing: stripped.missing }
}

export { proposedPolicyName } from '../coverage/naming.ts'

// A Change step shows the tenant's current include/exclude and carries only
// the fields that change (prompt 17 §4): the JSON is a patch, the portal
// steps open the existing policy and list the changed fields.
const CHANGED_SECTION: Partial<Record<GoalResult['reasons'][number]['kind'], 'grantControls' | 'sessionControls' | 'users' | 'applications' | 'state'>> = {
  'weaker-control': 'grantControls',
  'session-weaker': 'sessionControls',
  'not-targeted': 'users',
  excluded: 'users',
  'apps-narrower': 'applications',
  'apps-excluded': 'applications',
  'report-only': 'state',
}

function adjustAction(full: Action, result: GoalResult, existing: RawPolicy | null): Action {
  if (!full.json) return { ...full, kind: 'adjust' }
  const body = JSON.parse(full.json) as RawPolicy
  const sections = new Set(result.reasons.filter((r) => !r.expected).map((r) => CHANGED_SECTION[r.kind]).filter(Boolean))
  if (result.floorRaised) sections.add('grantControls')
  const patch: RawPolicy = { description: body.description }
  const conditions = (body.conditions ?? {}) as RawPolicy
  if (sections.has('grantControls')) patch.grantControls = body.grantControls
  if (sections.has('sessionControls')) patch.sessionControls = body.sessionControls
  if (sections.has('users') || sections.has('applications')) {
    const c: RawPolicy = {}
    if (sections.has('users')) c.users = conditions.users
    if (sections.has('applications')) c.applications = conditions.applications
    patch.conditions = c
  }
  if (sections.has('state')) patch.state = 'enabled'
  const json = JSON.stringify(patch, null, 2)
  // Current value → new value, field by field (roadmap-v2.md §4.6); nothing else is touched.
  const show = (v: unknown): string => (v === undefined || v === null ? '—' : JSON.stringify(v))
  const changes: NonNullable<Action['changes']> = []
  const ex = (existing ?? {}) as RawPolicy
  const exConditions = (ex.conditions ?? {}) as RawPolicy
  if (sections.has('grantControls')) changes.push({ field: 'Grant controls', from: show(ex.grantControls), to: show(body.grantControls) })
  if (sections.has('sessionControls')) changes.push({ field: 'Session controls', from: show(ex.sessionControls), to: show(body.sessionControls) })
  if (sections.has('users')) changes.push({ field: 'Users', from: show(exConditions.users), to: show(conditions.users) })
  if (sections.has('applications')) changes.push({ field: 'Target resources', from: show(exConditions.applications), to: show(conditions.applications) })
  if (sections.has('state')) changes.push({ field: 'State', from: show(ex.state), to: '"enabled"' })

  const cur = ((existing?.conditions ?? {}) as RawPolicy).users as RawPolicy | undefined
  const roleList = cur && Array.isArray(cur.includeRoles) && cur.includeRoles.length > 0 ? roleListSummary(cur.includeRoles.map(String)) : null
  const excludeRoles = cur && Array.isArray(cur.excludeRoles) && cur.excludeRoles.length > 0 ? roleListSummary(cur.excludeRoles.map(String)) : null
  return { kind: 'adjust', summary: [], json, portalSteps: [], missing: full.missing, roleList: roleList && roleList.names.length > 5 ? roleList : excludeRoles && excludeRoles.names.length > 5 ? excludeRoles : null, changes }
}

// ---- generation ----

export function generateRoadmap(input: RoadmapInput): RoadmapResult {
  // Role names travel with the scan ($expand=roleDefinition); learn them before any label is built.
  learnRoleNames(input.snapshot.config.roleAssignments?.rows ?? [])
  const { snapshot, mapping, viability, planId } = input
  // Detection only (prompt 46 item 19): admins, the emergency-access accounts,
  // confirmed service accounts, and active people with no method. A list saved
  // by an older Setup is not read.
  const highCareIds = detectHighCare({ snapshot, breakGlassUserIds: mapping.breakGlassUserIds, serviceAccountUserIds: mapping.serviceAccountUserIds, viability })
  const operatorId = input.operatorUserId ?? null
  const viabilityById = new Map(viability.map((v) => [v.userId, v]))
  // One lookup, built once. This was a linear search of the directory per call,
  // which nobody noticed until the dormant-accounts step named 3,671 people on
  // the 25,000-user fixture and the engine took 500 ms instead of 180.
  const userById = new Map(snapshot.users.map((u) => [u.id, u]))
  // A guest sharing a display name carries a (guest) marker on every pre-baked string too (prompt 49 item 1).
  const markedGuests = collidingGuestIds(snapshot.users)
  const nameOf = (id: string): string => {
    const u = userById.get(id)
    const base = u?.displayName ?? u?.userPrincipalName ?? id
    return u && markedGuests.has(u.id) ? `${base} (guest)` : base
  }
  const tenantName =
    ((snapshot.config.organization?.rows?.[0] ?? {}) as { displayName?: string }).displayName ?? 'your organisation'
  const steps: Step[] = []
  const popIndex = populationIndex(snapshot, viability)
  const contentIndexes = ringContextIndexes(snapshot)
  const rowsFor = (ids: string[]): MfaViability[] => ids.map((id) => viabilityById.get(id)).filter((v): v is MfaViability => v !== undefined)
  const expectedCache = new Map<string, string[]>()
  const populationCache = new Map<string, StepPopulation>()
  const readinessCache = new Map<string, Readiness>()
  // One readiness per family, over that family's canonical population (walk-51
  // item 8): the same number on every step of a kind, and on the campaign — all
  // people for MFA and devices, admins for admin, guests for guest. The goal
  // loop keys the cache by family, so these seeds are what every step of the
  // family reads; a family without a seed (block, risk, location) is usage, not
  // a readiness percentage, and its first goal fills the cache.
  {
    const allActive = viability.map((v) => v.userId)
    const adminIds = [...adminUserIds(snapshot.roles)]
    const guestIds = snapshot.users.filter((u) => u.userType === 'guest').map((u) => u.id)
    readinessCache.set('mfa', readinessFor('mfa-all-users', allActive, viability, snapshot))
    readinessCache.set('device', readinessFor('require-managed-device', allActive, viability, snapshot))
    readinessCache.set('admin', readinessFor('admins-phishing-resistant', adminIds, viability, snapshot))
    readinessCache.set('guest', readinessFor('guests-mfa', guestIds, viability, snapshot))
  }
  const readyActiveCache = new Map<string, number>()
  // Everyone the proposed policies exclude is out of every step's population:
  // break-glass accounts, confirmed service accounts, and the members of the
  // confirmed exclusion groups (roadmap-v2.md §7: a step never touches them).
  const excluded = new Set<string>([...mapping.breakGlassUserIds, ...mapping.serviceAccountUserIds])
  // Accounts that are not people are out of every readiness population too
  // (prompt 37 §4): a shared mailbox has no MFA method and never will, so
  // leaving it in makes the tenant look less ready than it is (T12, a
  // "Feedback Mailbox" counted as a person with no method). The operator does
  // not have to have confirmed it first — the licence says what it is.
  for (const u of snapshot.users) if (isNonPerson(u, new Set(mapping.serviceAccountUserIds))) excluded.add(u.id)
  // Shared devices (Teams Rooms) are out of every user policy and get their own
  // step (prompt 48 item 4); the directory-sync account is out of the MFA and
  // strength templates via excludeRoles in goals.json.
  const sharedDevices = sharedDeviceUsers(snapshot)
  for (const id of sharedDeviceIds(snapshot)) excluded.add(id)
  const exclusionGroupIds = [mapping.records['__globalExclusion']?.resolvedId, mapping.serviceAccountsGroupId].filter((x): x is string => typeof x === 'string')
  for (const gid of exclusionGroupIds) for (const id of input.groupMembers?.get(gid)?.memberIds ?? []) excluded.add(id)

  const prereq = (id: string, title?: string): Step => ({
    id,
    goalId: id.replace(/^s-/, ''),
    phase: 0,
    kind: 'prerequisite',
    title: title ?? stepById[id]?.title ?? id,
    why: '',
    status: 'ready',
    blockedBy: [],
    blockers: [],
    unblockNotes: [],
    population: { total: 0, active: 0, admins: 0, guests: 0, ids: [], activeIds: [], inScope: 0 },
    readiness: { family: 'other', percent: null, lines: [] },
    evidence: { status: 'none', lines: [], affectedUserIds: [] },
    action: { kind: 'prerequisite', summary: [], json: null, portalSteps: [] },
    history: [],
    skipReason: null,
    deliveredBy: [],
    ...EXTRAS,
    plainTitle: title ?? stepById[id]?.title ?? id,
    forManager: MANAGER.prerequisite(),
  })

  // ---- Phase 0, collapsed: only what genuinely needs a human ----
  const naming = input.coverage.organisation.naming
  // Doesn't apply here: the person's answer, in the mapping and the plan file.
  // Never a foundation: emergency access and the exclusions group stay.
  const notApplicable = mapping.notApplicable ?? {}
  const doesntApply = (id: string): boolean => typeof notApplicable[id] === 'string' && notApplicable[id].trim().length > 0 && !EMERGENCY_ACCESS_STEP_IDS.has(id)
  // A baseline reference the tenant does not resolve is left out of the policy
  // body, and the body says so: the Preparation step that creates the object, by
  // the reference's kind (the countries policy's location is the allowed-countries
  // step's, any other location the trusted network's). The countries location the
  // tenant already has stands in for the baseline's on the countries policy.
  const unresolvedRefs = unresolvedReferences(input.baseline.references).filter((r) => mapping.records[r.id]?.resolvedId == null)
  const stepForReference = (kind: ReferenceKind, goalId: string): string | null =>
    kind === 'group' ? PREREQ_STEP_ID.exclusionsGroup : kind === 'namedLocation' ? (goalId === 'geo-restriction' ? PREREQ_STEP_ID.allowedCountries : PREREQ_STEP_ID.trustedLocation) : kind === 'authenticationStrength' ? 's-prereq-auth-strength' : null
  const unresolvedFor = (goalId: string): Map<string, string | null> => new Map(unresolvedRefs.map((r) => [r.id, stepForReference(r.kind, goalId)]))
  const countriesLocationId = tenantCountryLocation(snapshot, mapping.allowedCountries)?.id ?? null
  // A group the baseline only ever excludes is its exclusions group: the tenant's recognised one stands in for it.
  const exclusionsGroupId = mapping.records['__globalExclusion']?.resolvedId ?? null
  const resolveFor = (goalId: string): Map<string, string> => {
    const pairs: [string, string][] = []
    for (const r of unresolvedRefs) {
      if (r.kind === 'group' && exclusionsGroupId && r.uses.length > 0 && r.uses.every((u) => u.side === 'exclude')) pairs.push([r.id, exclusionsGroupId])
      if (r.kind === 'namedLocation' && goalId === 'geo-restriction' && countriesLocationId) pairs.push([r.id, countriesLocationId])
    }
    return new Map(pairs)
  }
  const existingNames = new Set((snapshot.config.caPolicies?.rows ?? []).map((p) => String((p as RawPolicy).displayName ?? '').trim().toLowerCase()).filter(Boolean))
  const proposedTaken = new Set<string>()
  /** The tenant-convention name, suffixed when a policy of that name already exists; the note explains. */
  const uniqueName = (goal: Goal): { name: string; note: string | null } => {
    const base = proposedPolicyName(goal, naming)
    if (!existingNames.has(base.toLowerCase()) && !proposedTaken.has(base.toLowerCase())) {
      proposedTaken.add(base.toLowerCase())
      return { name: base, note: null }
    }
    let n = 2
    while (existingNames.has(`${base} (${n})`.toLowerCase()) || proposedTaken.has(`${base} (${n})`.toLowerCase())) n += 1
    const name = `${base} (${n})`
    proposedTaken.add(name.toLowerCase())
    return { name, note: null }
  }

  // Without Entra ID P1 no Conditional Access policy can exist, so the objects
  // the policies would reference (exclusion groups, trusted locations) have
  // nothing to serve: the free-tier ladder is the plan instead (SPEC §12).
  const canUseConditionalAccess = snapshot.capabilities.entraP1.enabled

  // The baseline policy that stands for each goal is decided once, here, so
  // the prerequisites know which template placeholders the plan will need.
  const baselineFactsList = input.baseline.policies.map((p) => ({
    key: policyKey(p),
    policy: p as unknown as RawPolicy,
    facts: policyFacts(p, input.strengths),
  }))
  // Style variants are decided by data, never by a question (prompt 16 §4):
  // "NoExclusions" variants are never considered.
  const baselineMatchesFor = (goal: Goal): typeof baselineFactsList => {
    const impl = goal.implementations[0]
    return baselineFactsList.filter((b) => matchesSignature(b.facts, impl.signature)).filter((b) => !/no[-_ ]?exclusions?/i.test(b.facts.name))
  }
  // The goal map decides what renders (walk-51 item 9, goalMap.ts): a goal the
  // baseline does not hold never renders, in the demo and the product alike, and
  // the policy that stands for a held goal is the map's, decided at pin time,
  // never a render-time match. The signature match above remains only as the
  // fallback for a package that does not carry the mapped policy — the
  // synthetic test fixtures, which stand in for the pinned baseline.
  const goalMap = input.goalMap ?? PINNED_GOAL_MAP
  const inBaseline = (goal: Goal): boolean => goalInMap(goalMap, goal.id)
  const factsByKey = new Map(baselineFactsList.map((b) => [b.key, b]))
  // The map describes this package when its keys resolve in it (the pinned
  // baseline); then a goal the map does not hold has no source at all — the
  // floor's step renders Microsoft's template, never a signature match that the
  // pin-time rule rejected (the risky-users block for registration). Only a
  // package the map does not describe (a synthetic fixture) falls back to matching.
  const mapDescribesPackage = Object.values(goalMap).flat().some((k) => factsByKey.has(k))
  const sourcesFor = (goal: Goal): typeof baselineFactsList => {
    const mapped = (goalMap[goal.id] ?? []).map((k) => factsByKey.get(k)).filter((b): b is (typeof baselineFactsList)[number] => b !== undefined)
    if (mapped.length > 0) return mapped
    return mapDescribesPackage ? [] : baselineMatchesFor(goal)
  }
  const templateNeeds = new Set<TemplatePlaceholder>()
  for (const r of input.coverage.results) {
    if (r.status !== 'absent' || (!inBaseline(r.goal) && !isFloorGoal(r.goal.id)) || sourcesFor(r.goal).length > 0) continue
    for (const p of placeholdersIn(r.goal.implementations[0].template)) templateNeeds.add(p)
  }


  // Setup's confirmed break-glass accounts feed generation (ux-review-04 §5):
  // with accounts picked, nothing is created, whatever an older record says.
  // Emergency access is a foundation, like the exclusions group and the trusted
  // network: on every plan, In place when every bg.* check passes, Ready
  // otherwise, never removed by a pick or a detection. Its checks attach below.
  const bgStepId = BREAK_GLASS_STEP_ID
  if (canUseConditionalAccess) steps.push(prereq(bgStepId))
  // The exclusions group is a step on every plan, never removed: In place when
  // the recognised group is excluded from every enabled or report-only policy,
  // otherwise Ready, listing the policies
  // that do not exclude it (its checks, attached below) and carrying the create
  // instructions while no group is recognised. Every object the plan asks for
  // carries a proposed name in the tenant's own convention (prompt 43 item 4).
  const geStepId = PREREQ_STEP_ID.exclusionsGroup
  const recognisedGroupId = mapping.records['__globalExclusion']?.resolvedId ?? null
  if (canUseConditionalAccess) {
    const proposed = proposedObjectNames(naming).exclusionsGroup
    steps.push({ ...prereq(geStepId), naming: { proposed: proposed.name, fromBaseline: null } })
  }
  // The trusted network is a step on every plan, never removed: Ready with its
  // create instructions while the tenant has no IP named location, In place once
  // one exists (the picker says which of them are the team's own).
  const locStepId = PREREQ_STEP_ID.trustedLocation
  if (canUseConditionalAccess) {
    const ipLocations = (snapshot.config.namedLocations?.rows ?? [])
      .map((l) => l as { id?: string; displayName?: string; '@odata.type'?: string })
      .filter((l) => String(l['@odata.type'] ?? '').includes('ipNamedLocation'))
    const proposed = proposedObjectNames(naming).trustedLocation
    // In place names the locations that make it so: the evidence a done step carries.
    steps.push({
      ...prereq(locStepId),
      naming: { proposed: proposed.name, fromBaseline: null },
      status: ipLocations.length > 0 ? 'done' : 'ready',
      deliveredBy: ipLocations.map((l) => l.displayName ?? l.id ?? '').filter((n) => n.length > 0),
    })
  }

  // Allowed countries (prompt 16 §4): the named location is created in phase
  // 0 unless the tenant already has one with exactly that list.
  const countriesStepId = PREREQ_STEP_ID.allowedCountries
  const countriesMissing =
    canUseConditionalAccess &&
    mapping.wizardAnswered.countries === true &&
    mapping.allowedCountries.length > 0 &&
    tenantCountryLocation(snapshot, mapping.allowedCountries) === null &&
    input.coverage.results.some((r) => r.goal.id === 'geo-restriction' && r.status !== 'enforced' && r.status !== 'not-applicable')
  if (countriesMissing) {
    const proposed = proposedObjectNames(naming).allowedCountries
    steps.push({ ...prereq(countriesStepId), naming: { proposed: proposed.name, fromBaseline: null } })
  }
  // Confirmed service accounts with no group holding them (prompt 16 §3).
  const saStepId = PREREQ_STEP_ID.serviceAccountsGroup
  if (canUseConditionalAccess && mapping.serviceAccountUserIds.length > 0 && mapping.serviceAccountsGroupId === null) {
    const proposed = proposedObjectNames(naming).serviceAccountsGroup
    steps.push({ ...prereq(saStepId), naming: { proposed: proposed.name, fromBaseline: null } })
  }

  // Wave 0: the accounts nobody signs in to (target-state §8.1, prompt 46
  // item 8). Not a denominator anywhere, and not a reason to wait — nothing
  // can lock out an account nobody uses. The risk is the other way round:
  // whoever signs in first registers the MFA method. Present only while there
  // is somebody to decide on; done when the count reaches 0 on re-scan.
  const dormant = notActiveUsers(snapshot, snapshot.asOf, new Set(mapping.serviceAccountUserIds))
  if (dormant.length > 0) {
    const s = prereq('s-check-dormant-accounts')
    s.kind = 'check'
    s.action = { ...s.action, kind: 'check' }
    // The dormant step is the one place never-signed-in accounts are a population (§8.1): it names them, though none are active.
    s.population = { total: dormant.length, active: 0, admins: 0, guests: 0, ids: dormant.map((u) => u.id), activeIds: dormant.map((u) => u.id), inScope: dormant.length }
    steps.push(s)
  }

  // Shared devices, their own policy (prompt 48 item 4).
  if (canUseConditionalAccess && sharedDevices.length > 0) {
    const step = prereq('s-shared-devices')
    step.population = { total: sharedDevices.length, active: sharedDevices.length, admins: 0, guests: 0, ids: sharedDevices.map((u) => u.id), activeIds: sharedDevices.map((u) => u.id), inScope: sharedDevices.length }
    steps.push(step)
  }

  // The three questions the operator can answer (prompt 48 item 10): each
  // answer adds a carve-out step. Unanswered, the plan proceeds on the evidence
  // and the affected step carries the can't-see line.
  const qa = mapping.questionAnswers ?? {}
  for (const id of CARVE_OUT_IDS) {
    if ((qa[id] ?? '').trim().length === 0) continue
    steps.push(prereq(`s-question-${id}`, engine.carveOuts[id]?.title))
  }

  const secDefaults = (snapshot.config.securityDefaults?.rows?.[0] ?? null) as { isEnabled?: boolean } | null
  // Nothing can take security defaults' place without Conditional Access, so
  // turning them off is never the advice: the ladder asks for them instead.
  if (secDefaults?.isEnabled === true && canUseConditionalAccess) {
    steps.push(prereq('s-prereq-security-defaults'))
  }
  // Per-user MFA still on (migration not complete): a conflict named up front (roadmap-v2.md §7, messy).
  const methodsPolicy = (snapshot.config.authMethodsPolicy?.rows?.[0] ?? null) as { policyMigrationState?: string } | null
  if (methodsPolicy?.policyMigrationState && methodsPolicy.policyMigrationState !== 'migrationComplete') {
    steps.push(prereq('s-prereq-per-user-mfa'))
  }

  // ---- The free-tier ladder (SPEC §12): the plan spine when no policy can exist ----
  // Every catalogue goal is licence-limited without Entra ID P1, so the ladder
  // is what this tenant can actually do; a phase 0 step that already covers a
  // ladder item keeps the item's place rather than being duplicated.
  const ladderOrder = new Map<string, number>()
  if (!canUseConditionalAccess) {
    const ladder = ladderSteps(snapshot, mapping, steps.map((s) => s.id))
    steps.push(...ladder.steps)
    for (const [id, index] of ladder.order) ladderOrder.set(id, index)
  }

  // ---- Validation blockers (validation-rules.md §2): the escape hatch first ----
  // Every must-fix check that has not passed becomes a Phase 0 step, and the
  // two subjects a recovery depends on hold every step that can deny access.
  const groupFacts = [...(input.groupMembers?.entries() ?? [])].map(([groupId, g]) => ({ groupId, ...g }))
  const validationCtx = buildContext({ snapshot, state: mapping, groupMembers: groupFacts, viability })
  const validationReports: SubjectReport[] = [breakGlassReport(validationCtx)]
  const exclusionGroupId = mapping.records['__globalExclusion']?.resolvedId ?? null
  if (exclusionGroupId !== null) {
    validationReports.push(reportFor('exclusionGroup', [groupFacts.find((g) => g.groupId === exclusionGroupId) ?? null], validationCtx))
  }
  const trustedLocations = (snapshot.config.namedLocations?.rows ?? []).filter((l) => mapping.trustedLocationIds.includes(String((l as { id?: string }).id ?? '')))
  if (trustedLocations.length > 0) validationReports.push(reportFor('trustedLocation', trustedLocations, validationCtx))
  // Only when a country restriction is actually planned: the list is checked
  // because a policy is about to use it, never as housekeeping.
  const geoPlanned = input.coverage.results.some((r) => r.goal.id === 'geo-restriction' && r.status !== 'not-applicable' && r.status !== 'licence-limited')
  if (geoPlanned && mapping.wizardAnswered.countries === true) {
    validationReports.push(reportFor('allowedCountries', [tenantCountryLocation(snapshot, mapping.allowedCountries)], validationCtx))
  }
  if (mapping.serviceAccountUserIds.length > 0) validationReports.push(reportFor('serviceAccount', [''], validationCtx))
  // The exclusions group's checks sit on its own step. In place when the
  // recognised group is excluded from every enabled or report-only policy (the
  // rule's verdict); a step already In place holds nothing, and while no group is
  // recognised the step that creates it holds everything that can deny access.
  const geReport = validationReports.find((r) => r.subject === 'exclusionGroup')
  const geStep = steps.find((s) => s.id === geStepId)
  if (geStep && geReport) {
    geStep.checks = stepChecks(geReport)
    const everywhere = geReport.targets.flatMap((t) => t.results).find((r) => r.id === 'xg.usedConsistently')
    if (recognisedGroupId !== null && everywhere?.outcome === 'pass') {
      geStep.status = 'done'
      geStep.deliveredBy = [recognisedGroupId]
    }
  }
  const bgReport = validationReports.find((r) => r.subject === 'breakGlass')
  const bgStep = steps.find((s) => s.id === bgStepId)
  if (bgStep && bgReport) {
    bgStep.checks = stepChecks(bgReport)
    const results = bgReport.targets.flatMap((t) => t.results)
    if (mapping.breakGlassUserIds.length > 0 && results.length > 0 && results.every((r) => r.outcome === 'pass')) {
      bgStep.status = 'done'
      bgStep.deliveredBy = [...mapping.breakGlassUserIds]
    }
  }
  let gate = canUseConditionalAccess ? gateReason(validationReports) : null
  if (gate === null && bgStep && bgStep.status !== 'done') gate = gateFor('breakGlass')
  if (gate === null && geStep && geStep.status !== 'done') gate = gateFor('exclusionGroup')
  if (gate !== null && steps.find((s) => s.id === gate?.stepId)?.status === 'done') gate = null
  // The step has to exist before the goal loop so a held step can name it; the
  // count of what it holds is filled in once the goal steps are known.
  const validationSteps = blockerSteps(validationReports)
  steps.push(...validationSteps)

  // What each template placeholder is worth in this tenant (prompt 46 item
  // 12). null: nothing yet, so the step waits on the Wave 0 step that creates
  // it; an empty array: nothing to put there and nothing to wait for.
  const templateValues: TemplateValues = {
    '{namePrefix}': naming.prefix ?? 'CA',
    '{exclusionsGroup}': mapping.records['__globalExclusion']?.resolvedId ?? null,
    '{breakGlass}': mapping.breakGlassUserIds.length > 0 ? mapping.breakGlassUserIds : null,
    '{serviceAccountsGroup}': mapping.serviceAccountsGroupId ?? (mapping.serviceAccountUserIds.length === 0 ? [] : null),
    '{trustedLocations}': mapping.trustedLocationIds.length > 0 ? mapping.trustedLocationIds : mapping.wizardAnswered.trustedLocations === true ? [] : null,
    '{allowedCountriesLocation}': tenantCountryLocation(snapshot, mapping.allowedCountries)?.id ?? null,
    '{coreAdminRoles}': [...CORE_ADMIN_ROLE_IDS],
  }

  // ---- Goal steps ----

  for (const result of input.coverage.results) {
    if (result.status === 'not-applicable' || result.status === 'licence-limited' || result.status === 'unknown') continue
    const goal = result.goal
    // A goal this baseline does not hold has no step: the catalogue keeps intent
    // only, and the plan renders the baseline (walk-51 item 9) — except the floor
    // (target-state §13): registration protection and the legacy-authentication
    // block render from Microsoft's own template when the baseline lacks them,
    // flagged as not the author's.
    const floor = !inBaseline(goal)
    if (floor && !isFloorGoal(goal.id)) continue
    const impl = goal.implementations[0]
    const stepId = idFor('goal', goal.id)

    // The map's policy stands for the goal; among several (a Policy A/B pair),
    // the geo policy is always the allowlist style, and "NoExclusions" variants
    // are never considered (prompt 16 §4).
    const matches = sourcesFor(goal)
    let source = matches.find((m) => goal.id === 'geo-restriction' && isAllowlistGeoPolicy(m.policy as never)) ?? matches[0] ?? null
    for (const [, chosen] of Object.entries(mapping.variantChoices)) {
      const hit = matches.find((m) => m.facts.name === chosen)
      if (hit) source = hit
    }

    const whoKey = impl.expectedWho.kind
    if (!expectedCache.has(whoKey)) expectedCache.set(whoKey, whoKey === 'workload' ? [] : [...resolvePopulation(impl.expectedWho, snapshot).ids].filter((id) => !excluded.has(id)))
    const popIds = expectedCache.get(whoKey) ?? []
    if (!populationCache.has(whoKey)) populationCache.set(whoKey, population(popIds, popIndex))
    const pop = { ...(populationCache.get(whoKey) as StepPopulation) }
    const readinessKey = goalFamily(goal.id)
    if (!readinessCache.has(readinessKey)) readinessCache.set(readinessKey, readinessFor(goal.id, popIds, rowsFor(popIds), snapshot))
    const readiness = { ...(readinessCache.get(readinessKey) as Readiness), lines: [...(readinessCache.get(readinessKey) as Readiness).lines] }
    const matchedPolicyId = findTaggedPolicy(snapshot, planId, stepId)
    const evidence = evidenceFor(goal.id, snapshot, matchedPolicyId)

    const doc = source ? docFor(input.baseline.docs, source.facts.name) : undefined
    const rawWhy = doc?.intent ?? goal.tldr ?? goal.description
    const whyUrl = rawWhy.match(/https?:\/\/[^\s)]+/)?.[0] ?? null
    const why = whyUrl ? rawWhy.replace(whyUrl, '').replace(/[\s:;,.]+$/, '').replace(/\.\s*:?$/, '') + '.' : rawWhy

    const blockedBy: string[] = []
    const blockers: Blocker[] = []
    const unblockNotes: string[] = []
    const blockByStep = (id: string, label: string): void => {
      if (blockedBy.includes(id)) return
      blockedBy.push(id)
      blockers.push({ kind: 'step', stepId: id, label })
    }
    // A template placeholder the tenant has no object for yet: the step waits
    // on the Wave 0 step that creates it.
    const blockPlaceholder = (p: TemplatePlaceholder): void => {
      if (p === '{namePrefix}' || p === '{coreAdminRoles}') return
      const prereqId = PLACEHOLDER_STEP[p]
      if (steps.some((s) => s.id === prereqId)) blockByStep(prereqId, 'create-object')
    }
    let action: Action
    let kind: Step['kind']
    let status: StepStatus = 'ready'
    let namingNote: { name: string; note: string | null } | null = null
    let existing: GoalResult['candidates'][number] | null = null
    let existingRaw: RawPolicy | null = null

    // A step is done if and only if its goal's verdict is inPlace (target-state
    // §8.2, prompt 46 item 9). Not the status, and never the plan's own idea of
    // whether a policy exists: the verdict is decided once, in coverage.
    if (result.verdict === 'inPlace') {
      kind = 'create'
      status = 'done'
      action = {
        kind: 'create',
        summary: [],
        json: null,
        portalSteps: [],
      }
    } else if (result.status === 'absent') {
      kind = 'create'
      if (source) {
        const proposed = uniqueName(goal)
        action = buildCreateAction(source.policy, mapping, planId, stepId, { displayName: proposed.name, unresolved: unresolvedFor(goal.id), resolveIds: resolveFor(goal.id) })
        namingNote = proposed
      } else {
        // No baseline policy stands for this goal: the goal's own template is
        // the body, with the tenant's objects filled in where they exist and a
        // Wave 0 step named where they do not (prompt 46 item 12). Every step
        // is executable; nothing says "create a policy that meets the floor".
        const resolved = resolveTemplate(impl.template as TemplateBody, templateValues)
        for (const p of resolved.unresolved) blockPlaceholder(p)
        const proposed = uniqueName(goal)
        action = buildCreateAction(resolved.body, mapping, planId, stepId, { displayName: proposed.name, unresolved: unresolvedFor(goal.id), resolveIds: resolveFor(goal.id) })
        namingNote = proposed
      }
    } else {
      kind = 'adjust'
      // An adjust step edits the tenant's own policy: its name, its id, its
      // current state — never a second policy named after the baseline.
      existing =
        result.candidates.find((c) => c.contribution === 'weak') ??
        result.candidates.find((c) => c.contribution === 'reportOnly') ??
        result.candidates.find((c) => c.contribution !== 'disabled') ??
        null
      const existingId = existing?.policyId ?? null
      existingRaw = existingId !== null ? ((snapshot.config.caPolicies?.rows ?? []).find((p) => (p as RawPolicy).id === existingId) as RawPolicy | undefined) ?? null : null
      action = source
        ? adjustAction(
            buildCreateAction(source.policy, mapping, planId, stepId, {
              unresolved: unresolvedFor(goal.id),
              resolveIds: resolveFor(goal.id),
              displayName: existing?.policyName ?? proposedPolicyName(goal, naming),
              adjust: existing ? { policyId: existing.policyId, state: existing.state } : undefined,
            }),
            result,
            existingRaw,
          )
        : { kind: 'adjust', summary: [], json: null, portalSteps: [] }
    }


    // Named dependencies (prompt 12 §B).
    if (status !== 'done') {
      if (goal.id === 'register-info-protected' && steps.some((s) => s.id === locStepId && s.status !== 'done') && !doesntApply(locStepId)) blockByStep(locStepId, 'trusted-location')
      if (goal.id === 'geo-restriction') {
        if (steps.some((s) => s.id === countriesStepId)) blockByStep(countriesStepId, 'create-object')
      }
    }

    // Gating (roadmap.md §6).
    if (status !== 'done') {
      const threshold =
        readiness.family === 'mfa' || readiness.family === 'guest'
          ? READINESS_THRESHOLD_MFA_PERCENT
          : readiness.family === 'admin'
            ? READINESS_THRESHOLD_ADMINS_PERCENT
            : readiness.family === 'device'
              ? READINESS_THRESHOLD_DEVICES_PERCENT
              : null
      if (threshold !== null && readiness.percent !== null && readiness.percent < threshold) {
        status = 'blocked'
        blockers.push({ kind: 'readiness', label: 'readiness', binding: BLOCKED_REASON.reaches(READINESS_MEASURE[readiness.family] ?? 'readiness', `${threshold}%`, `${readiness.percent}%`) })
      }
      // Nothing that can deny access is offered while the way back in is
      // unverified (validation-rules.md §2).
      const deniesAccess = impl.floor.grant !== undefined || impl.floor.session !== undefined || readiness.family === 'block' || readiness.family === 'location'
      if (deniesAccess && gate !== null) blockByStep(gate.stepId, gate.label)
      if (blockedBy.length > 0) status = 'blocked'
    }


    const includesOperator = operatorId !== null && popIds.includes(operatorId)
    // The strand simulator decides (roadmap-v2.md §7): the same check the
    // property tests run, so a step that would lock the operator out is
    // never offered as ready.
    const opVerdict = includesOperator && operatorId !== null ? accountVerdict(readiness.family, operatorId, snapshot, mapping.allowedCountries) : null
    const operatorSafe = opVerdict === null ? null : !opVerdict.stranded
    if (opVerdict?.stranded && status !== 'done') {
      status = 'blocked'
      blockers.push({ kind: 'readiness', label: 'operator', binding: BLOCKED_REASON.exist(1, 'safe way in for the signed-in account', 0) })
    }

    if (!readyActiveCache.has(whoKey))
      readyActiveCache.set(
        whoKey,
        popIds.filter((id) => {
          const v = viabilityById.get(id)
          return v !== undefined && v.activity === 'active' && (v.mfa === 'verified' || v.mfa === 'likelyViable')
        }).length,
      )
    const notReadyActive = pop.active - (readyActiveCache.get(whoKey) ?? 0)


    // Announcements by goal family (prompt 13 §8); nobody affected → no template.
    const evidenceUsable = evidence.status === 'ok' || evidence.status === 'partial'
    const nobodyAffected =
      (evidenceUsable && (readiness.family === 'block' || readiness.family === 'risk') && evidence.affectedUserIds.length === 0) ||
      ((readiness.family === 'mfa' || readiness.family === 'guest' || readiness.family === 'admin') && notReadyActive === 0) ||
      (readiness.family === 'device' && readiness.percent === 100) ||
      pop.active === 0
    // The change itself decides the wording (prompt 17 §4): an adjust that
    // only tightens sessions gets session wording; a strength raise gets
    // passkey wording; a block names the affected users or needs none.
    const floorGrant = impl.floor.grant ?? null
    const adjustSections = new Set(result.reasons.filter((r) => !r.expected).map((r) => CHANGED_SECTION[r.kind]).filter(Boolean))
    const sessionOnly = kind === 'adjust' ? adjustSections.size > 0 && [...adjustSections].every((s) => s === 'sessionControls') : floorGrant === null && impl.floor.session !== undefined
    const comms =
      status === 'done'
        ? null
        : nobodyAffected
          ? NO_ANNOUNCEMENT
          : announcementFor(
              {
                goalId: goal.id,
                family: readiness.family,
                grant: sessionOnly ? null : floorGrant,
                sessionOnly,
                affected: evidenceUsable && readiness.family === 'block' ? evidence.affectedUserIds.length : null,
                admins: impl.expectedWho.kind === 'coreAdmins',
                // Named below the threshold the audience model already uses, so
                // the greeting and the audience label cannot disagree
                // (prompt 41 §4).
                audience: announcementAudience(pop, impl.expectedWho.kind === 'coreAdmins' || readiness.family === 'admin', nameOf),
              },
              tenantName,
              '{DATE}',
            )

    // Operator evidence sentence (prompt 13 §7) — never a promise. A count is
    // only claimed where the records actually measured this goal (block usage
    // or a tagged report-only policy); otherwise the note says so.

    // "Done when" bullets only for criteria that apply to the step kind
    // (prompt 17 §4): a create step observes in report-only, then enforces;
    // an adjust step to an enforced policy just has to land cleanly.


    steps.push({
      id: stepId,
      goalId: goal.id,
      phase: Math.max(1, goal.phase),
      kind,
      ...(floor ? { floor: true } : {}),
      title: stepTitle(goal.name),
      why,
      status,
      blockedBy,
      blockers,
      unblockNotes,
      population: pop,
      readiness,
      evidence,
      action,
      history: [],
      skipReason: null,
      ...EXTRAS,
      // After the defaults, or the default overwrites it: the gap a change step
      // closes, on the step so the plan row can show it (prompt 46 item 9).
      gap: activeGap(result, pop.active, popIndex.active),
      gapShort: activeGapShort(result, pop.active, popIndex.active),
      comms,
      learn: goal.learnUrl ? { url: goal.learnUrl, tldr: goal.tldr ?? '', cis: goal.cis ?? [] } : null,
      includesOperator,
      operatorSafe,
      // The goal's own coverage, not a broad all-users match that belongs to
      // another goal (walk-51 item 15): prefer the policies scoped to this goal.
      deliveredBy: (() => {
        const strong = result.candidates.filter((c) => c.contribution === 'strong')
        const own = strong.filter((c) => c.ownScope)
        return (own.length > 0 ? own : strong).map((c) => `${c.policyName} (${INVENTORY.policies.state[c.state] ?? c.state})`)
      })(),
      plainTitle: stepTitle(goal.name),
      forManager:
        MANAGER_BY_GOAL[goal.id]?.() ??
        (readiness.family === 'mfa' || readiness.family === 'guest'
          ? readiness.family === 'guest'
            ? MANAGER.guest(pop.active)
            : MANAGER.mfa(pop.active, notReadyActive)
          : readiness.family === 'admin'
            ? MANAGER.admin(pop.total)
            : readiness.family === 'block'
              ? MANAGER.block(evidenceUsable ? evidence.affectedUserIds.length : 0)
              : readiness.family === 'location'
                ? MANAGER.location(mapping.allowedCountries.map(countryLabel).join(', '), evidence.affectedUserIds.length)
                : readiness.family === 'device'
                  ? MANAGER.device(pop.active, pop.active - popIds.filter((id) => contentIndexes.deviceReady.has(id) && popIndex.active.has(id)).length)
                  : sessionOnly || /session/i.test(goal.name)
                    ? MANAGER.session(pop.active)
                    : MANAGER.other()),
      // A step that changes the tenant's own policy names that policy, never the
      // step's title; a step that creates one names the proposed name.
      naming:
        kind === 'create' && status !== 'done'
          ? { proposed: namingNote?.name ?? proposedPolicyName(goal, naming), fromBaseline: source?.facts.name ?? null, note: namingNote?.note ?? null }
          : kind === 'adjust' && existing && status !== 'done'
            ? { proposed: existing.policyName, fromBaseline: source?.facts.name ?? null, note: null }
            : null,
    })
  }

  // ---- Phase 2 verification campaign ----
  const mfaGoal = input.coverage.results.find((r) => r.goal.id === 'mfa-all-users')
  if (mfaGoal) {
    // The campaign works the active people only, named (prompt 48.1 item 2):
    // never the dormant accounts, never break-glass (it has its own drill).
    // Break-glass is never in the campaign (prompt 48.1 item 2): it has its own drill.
    // Verification complete on this scan → the campaign is done and the
    // scheduler skips its window (prompt 18 §1).
    const verifyReadiness = readinessCache.get('mfa') ?? readinessFor('mfa-all-users', viability.map((v) => v.userId), viability, snapshot)
    // Required whenever anyone enabled still has to be set up (ux-review-04 §2):
    // the Overview sentence, the blocked-step reasons and the pace all read
    // from this one number.
    const toSetUp = summarizeTenant(viability).rollout.toSetUp
    const verifyDone = toSetUp === 0
    steps.push({
      ...prereq('s-verify-mfa'),
      phase: 2,
      kind: 'verify',
      goalId: 'mfa-all-users',
      status: verifyDone ? 'done' : 'ready',
      population: population(campaignIds(viability, snapshot, mapping), popIndex),
      readiness: verifyReadiness,
      forManager: MANAGER.verify(toSetUp),
    })
  }

  // Readiness-blocked MFA/guest steps wait for the verification campaign: the
  // dependency is named so the scheduler places them after it.
  const verifyStep = steps.find((s) => s.id === 's-verify-mfa')
  if (verifyStep) {
    for (const s of steps) {
      if (s.status !== 'blocked' || !s.blockers.some((b) => b.kind === 'readiness')) continue
      if (s.readiness.family !== 'mfa' && s.readiness.family !== 'guest') continue
      // Only ever a backward edge. A phase 0 step (security-info registration)
      // that waits on the phase 2 campaign would order the plan against itself;
      // it keeps the readiness reason without the dependency.
      if (s.phase < verifyStep.phase) continue
      if (!s.blockedBy.includes(verifyStep.id)) s.blockedBy.push(verifyStep.id)
    }
  }

  // Temporary Access Pass is Microsoft's documented rescue for somebody who has
  // no method and has to register one; without it the registration step has no
  // way out (guidance-audit-01, steps/security-info-registration.md).
  const methodsPolicyRow = (snapshot.config.authMethodsPolicy?.rows?.[0] ?? null) as
    | { authenticationMethodConfigurations?: { id?: string; state?: string }[] }
    | null
  const tapEnabled =
    snapshot.config.authMethodsPolicy?.status !== 'ok' || methodsPolicyRow === null
      ? null
      : (methodsPolicyRow.authenticationMethodConfigurations ?? []).some(
          (c) => c.id?.toLowerCase() === 'temporaryaccesspass' && c.state === 'enabled',
        )
  const trustedLocationCount = mapping.trustedLocationIds.length

  // ---- Sequence safety (audit-program Layer C, guidance-audit-01) ----
  // Ordering rules that hold for any tenant, each one a way somebody gets
  // stranded if the plan runs in the wrong order.
  const blockLate = (s: Step, label: string, binding: string | null, dependsOn?: string): void => {
    if (s.status === 'done' || s.status === 'skipped') return
    if (dependsOn && !s.blockedBy.includes(dependsOn)) s.blockedBy.push(dependsOn)
    if (!s.blockers.some((b) => b.kind === 'readiness' && b.label === label)) {
      s.blockers.push({ kind: 'readiness', label, ...(binding ? { binding } : {}) })
    }
    s.status = 'blocked'
  }

  // 1. Security-info registration is the policy that asks for MFA in order to
  // register MFA. It waits for a way out to exist (Temporary Access Pass), for
  // a trusted location to mean something, and for the people with no method to
  // have one (steps/security-info-registration.md).
  const registrationStep = steps.find((s) => s.goalId === 'register-info-protected')
  if (registrationStep) {
    if (tapEnabled === false) blockLate(registrationStep, 'registration-no-tap', BLOCKED_REASON.exist(1, 'Temporary Access Pass policy', 0))
    const withoutMethod = viability.filter((v) => v.activity === 'active' && v.mfa === 'none').length
    // A reason, not a dependency edge: the campaign sits in a later phase, and
    // pointing a phase 0 step at it would order the plan against itself.
    if (withoutMethod > 0) blockLate(registrationStep, 'registration-coverage', BLOCKED_REASON.reaches('people without a method', '0', String(withoutMethod)))
    if (trustedLocationCount === 0 && !doesntApply(locStepId)) blockLate(registrationStep, 'registration-no-trusted-location', BLOCKED_REASON.exist(1, 'trusted location', 0))
  }

  // 2. No country block before the operator's own recent countries are in the
  // allow list, and before the list itself passes its checks.
  const countriesReport = validationReports.find((r) => r.subject === 'allowedCountries')
  if (countriesReport && countriesReport.blocking.length > 0) {
    for (const s of steps) {
      if (s.readiness.family === 'location') blockLate(s, 'countries-unsafe', null, blockerStepId('allowedCountries'))
    }
  }

  // 3. Security defaults come off before any Conditional Access policy: with
  // them on, a policy can be created and cannot be turned on.
  const secDefaultsStep = steps.find((s) => s.id === 's-prereq-security-defaults')
  if (secDefaultsStep) {
    for (const s of steps) {
      if (s.kind !== 'create' && s.kind !== 'adjust') continue
      blockLate(s, 'security-defaults-first', null, secDefaultsStep.id)
    }
  }

  // 4. No session control that can put the person applying it in a loop:
  // sign-in every time without MFA in the same policy is Microsoft's own
  // documented hazard (steps/session-controls.md).
  for (const s of steps) {
    const impl = input.coverage.results.find((r) => r.goal.id === s.goalId)?.goal.implementations[0]
    const floor = impl?.floor
    if (floor?.session?.signInFrequencyEveryTime === true && floor.grant === undefined) {
      blockLate(s, 'session-loop', BLOCKED_REASON.exist(1, 'MFA grant on this policy', 0))
    }
  }

  // ---- Ordering: phase, then risk score ----
  const stepSeverity = (s: Step): number => {
    if (/^block/i.test(s.title)) return SEVERITY_BLOCK
    if (/phishing|device|protection/i.test(s.title)) return SEVERITY_STRENGTH_OR_DEVICE
    return SEVERITY_DEFAULT
  }
  const score = (s: Step): number => {
    // The escape hatch comes before everything: nothing else is safe to start
    // while a recovery is unverified (validation-rules.md §2). The foundations
    // lead Preparation: emergency access, then the exclusions group, then the
    // other validation blockers.
    if (s.id === bgStepId) return -6000
    if (s.id === geStepId) return -5999
    const blockerIndex = validationSteps.findIndex((v) => v.id === s.id)
    if (blockerIndex >= 0) return -5000 + blockerIndex
    // The ladder is the plan for a tenant that cannot hold a policy: its own
    // order is the rollout order, ahead of everything else in the phase.
    const rung = ladderOrder.get(s.id)
    if (rung !== undefined) return -3000 + rung
    // Conflicts the tenant already has (security defaults, per-user MFA) come before everything (roadmap-v2.md §7, messy).
    if (s.id === 's-prereq-security-defaults' || s.id === 's-prereq-per-user-mfa') return -2000
    const sev = s.kind === 'prerequisite' || s.kind === 'check' ? 0 : stepSeverity(s)
    return s.population.active * sev - (s.readiness.percent ?? 0)
  }
  steps.sort((a, b) => a.phase - b.phase || score(a) - score(b) || a.id.localeCompare(b.id))
  // A step never sits ahead of a step it waits on, whatever the risk order says:
  // the first pending step whose dependencies are all placed goes next.
  const placed = new Set<string>()
  const pending = [...steps]
  steps.length = 0
  while (pending.length > 0) {
    const i = pending.findIndex((s) => s.blockedBy.every((id) => placed.has(id) || !pending.some((p) => p.id === id)))
    const [next] = pending.splice(i < 0 ? 0 : i, 1)
    steps.push(next)
    placed.add(next.id)
  }

  const indexes = contentIndexes



  // ---- Rings (roadmap-v2.md §1): proposed from readiness data, dated by the schedule ----
  const startIso = input.startDate ?? nextWorkingDay(snapshot.asOf)
  const activeTotal = viability.filter((v) => v.activity === 'active').length
  const ringCtx = {
    snapshot,
    viability: viabilityById,
    breakGlassIds: new Set(mapping.breakGlassUserIds),
    highCareIds,
    operatorId,
    naming,
    activeUsers: activeTotal,
    ...indexes,
  }
  for (const s of steps) s.rings = proposeRings(s, ringCtx)

  // ---- Schedule: the dependency graph places every ring (roadmap-v2.md §2) ----
  const rhythm = tenantRhythm(snapshot, mapping.displayTimeZone)
  // The registration window is sized by who still needs a proven method: five
  // a working day, at most twenty working days, alongside the first soak
  // (target-state §9). Never by the size of the tenant.
  const toSetUpIds = viability.filter((v) => rolloutBucket(v) === 'noMethod' || rolloutBucket(v) === 'unproven').map((v) => v.userId)
  const registration = registrationWindow(toSetUpIds)
  // A step the person said does not apply here leaves its phase for the footer:
  // it takes no slot and nothing waits on it.
  for (const s of steps) {
    if (!doesntApply(s.id)) continue
    s.doesntApply = notApplicable[s.id].trim()
    s.skipReason = s.doesntApply
    s.status = 'skipped'
  }
  const schedule = buildSchedule(steps, startIso, activeTotal, input.band ?? null, {
    freeze: input.changeFreeze ?? null,
    rhythm,
    registrationDays: registration.workingDays,
  })
  schedule.rhythm = rhythm
  // Cleanup (target-state §5, §9): dated after the last enforcement window, one
  // working day per row; the header's finish date includes it (derive/finish.ts).
  schedule.cleanup = cleanupPhaseFor({
    after: schedule.targetEnd,
    rhythm,
    emergencyAccountIds: mapping.breakGlassUserIds,
    emergencyAccounts: mapping.breakGlassUserIds.map(nameOf),
    emergencyAccountUpns: mapping.breakGlassUserIds.map((id) => userById.get(id)?.userPrincipalName ?? nameOf(id)),
    organisation: input.coverage.organisation,
  })
  const waveStart = new Map(schedule.waves.map((w) => [w.wave, w.start]))
  for (const s of steps) {
    // Comms per ring, dated (§4.11); the step's own announcement is the first ring's.
    if (s.comms?.includes('{DATE}')) {
      const template = s.comms
      const firstDate = s.rings[0]?.plannedStart ?? waveStart.get(schedule.waveOf[s.id] ?? 0) ?? startIso
      s.comms = template.replaceAll('{DATE}', absoluteDate(firstDate))
    }
    // A change to an existing policy has no ring of its own: its dates come from where the schedule placed it.
    s.events = eventsFor(s, { rhythm, timeZone: mapping.displayTimeZone ?? 'UTC' }, s.kind === 'adjust' ? (schedule.startAt[s.id] ?? null) : null)
  }

  // The lockout-scenario lines, once every step has its enforce date (prompt 48
  // items 6, 7). Built only from derivations that fired.
  const noMethodActive = viability.filter((v) => v.activity === 'active' && !v.mfaCapable && !excluded.has(v.userId)).map((v) => v.userId)
  const scenarioBase = scenarioContext({ snapshot, nameOf, noMethodActive })
  for (const s2 of steps) {
    const enforceDate = s2.events ? absoluteDate(s2.events.enforce.at) : s2.rings[0]?.plannedStart ? absoluteDate(s2.rings[0].plannedStart) : null
    const ctx = { ...scenarioBase, enforceDate }
    s2.scenarioLines = scenarioLinesFor(s2, ctx)
    // The campaign names its registered-but-unproven and no-method active people (prompt 48.1 item 6).
    if (s2.kind === 'verify') {
      const bgSet = new Set(mapping.breakGlassUserIds)
      const unproven = viability.filter((v) => rolloutBucket(v) === 'unproven' && !bgSet.has(v.userId)).map((v) => v.userId)
      const noMethod = viability.filter((v) => rolloutBucket(v) === 'noMethod' && !bgSet.has(v.userId)).map((v) => v.userId)
      const date = absoluteDate(s2.events?.enforce.at ?? schedule.targetEnd)
      s2.scenarioLines = [
        ...(unproven.length > 0 ? [{ kind: 'campaignUnproven', text: SCENARIO.campaignUnproven(unproven.map(nameOf), date), people: unproven, count: unproven.length }] : []),
        ...(noMethod.length > 0 ? [{ kind: 'campaignNoMethod', text: SCENARIO.campaignNoMethod(noMethod.map(nameOf), date), people: noMethod, count: noMethod.length }] : []),
        ...(s2.scenarioLines ?? []),
      ]
    }
    s2.cantSee = cantSeeFor(s2, ctx)
  }



  // The one title, from content.json, on the row, the body and the
  // communications alike (walk-51 item 1). Set before the state reasons so a
  // "waits on <step>" line names the same title the plan shows.
  for (const s of steps) s.plainTitle = contentTitle(s)
  annotateStateReasons(steps)
  // Static rules on the tenant's own policy JSON (prompt 48 item 5): the ones a
  // plan cannot fix by itself surface as Housekeeping.
  const violations = staticViolations(snapshot.config.caPolicies?.rows ?? [], { technicianToolsOffCompliance: (snapshot.scenarioEvidence?.technicianToolsOffCompliance.count ?? 0) > 0 })
  return { steps, schedule, housekeeping: { checksNotRun: checksNotRun(validationReports), staticViolations: violations } }
}

/** The plan's id for a tenant, the one rule (the page, the export and the demo agree): the policies the plan creates carry it in their tag. */
export function planIdFor(tenantId: string): string {
  return `plan-${tenantId.slice(0, 8)}`
}

export function findTaggedPolicy(snapshot: TenantSnapshot, planId: string, stepId: string): string | null {
  const tag = `[IAMAI:${planId}:${stepId}]`
  for (const raw of snapshot.config.caPolicies?.rows ?? []) {
    const p = raw as { id?: string; description?: string }
    if (typeof p.description === 'string' && p.description.includes(tag)) return p.id ?? null
  }
  return null
}
