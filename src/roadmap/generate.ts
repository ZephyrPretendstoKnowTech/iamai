// Step generation (roadmap.md §1–§6; 2026-08-27 redesign: collapsed phase 0,
// per-tenant impact, safe-today lane, handle-with-care gating, comms drafts,
// operator self-safety, Learn links, auto-scheduling). Pure.
import type { CaPolicy } from '../baseline/types.ts'
import { docFor } from '../baseline/index.ts'
import type { BaselinePackage } from '../baseline/types.ts'
import { CORE_ADMIN_ROLE_IDS, matchesSignature } from '../coverage/classify.ts'
import { placeholdersIn, resolveTemplate } from './template.ts'
import { PLACEHOLDER_STEP, implementable, resolveTenantPolicy, tenantObjectsOf } from './resolvePolicy.ts'
import { isValidOperation, unavailableReason } from './operations.ts'
import type { ResolvedPolicy } from './resolvePolicy.ts'
import type { PolicyOperation } from './types.ts'
import { BLOCKED_REASON, READINESS_MEASURE } from '../copy/reasons.ts'
import { hasBaselineConflict } from './baselineConflict.ts'
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
import { isNonPerson, notActiveUsers, notPeopleIds } from '../derive/sets.ts'
import { adminsWithWorkloadOf } from '../derive/contentLists.ts'
import { LOCKOUT_GOALS, lockoutIds } from './lockout.ts'
import { accountVerdict } from './strand.ts'
import { tenantRhythm } from './rhythm.ts'
import { eventsFor } from './timing.ts'
import { MANAGER, MANAGER_BY_GOAL } from '../copy/plain.ts'
import { contentTitle } from '../content/stepTitle.ts'
import { engine, stepById } from '../content/content.ts'
import { countryName as countryLabel } from '../mapping/countries.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { adminUserIds, learnRoleNames, roleListSummary } from '../roles.ts'
import { policyPairNames, proposedPolicyName } from '../coverage/naming.ts'
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
import type { CleanupRecord } from './cleanupDone.ts'
import { isFloorGoal } from './floor.ts'
import { answeredCarveOuts, devicePlanOf, deviceScopeOf } from './answers.ts'
import { DEVICE_GOALS, applyDeviations, deviceStepDoesntApply } from './deviations.ts'

/** The baseline's block of the service accounts outside the trusted network (E9): step 6 gains it as Restrict Service Accounts to the Trusted Network. */
export const SERVICE_ACCOUNTS_TRUSTED_GOAL = 'service-accounts-trusted-network'

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
import { proposedName, proposedObjectNames } from '../coverage/naming.ts'
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
  /**
   * What the plan's checkpoints record about Cleanup (E3, cleanupDone.ts): each
   * row's completion date, and every drill date, which exempts the matching
   * emergency sign-ins from the recent-sign-in check.
   */
  cleanupRecord?: CleanupRecord
}

export type RoadmapResult = {
  steps: Step[]
  schedule: Schedule
  /** Plan-footer housekeeping that comes from the engine (prompt 46 item 21). */
  housekeeping: { checksNotRun: string | null; staticViolations: import('./staticRules.ts').StaticViolation[] }
}

const EXTRAS = STEP_EXTRAS

// The step ids live in stepIds.ts (the answer readers name them without
// importing the engine); re-exported here for the modules that import them from the engine.
export { idFor, stepIdForGoal, EXCLUSION_GROUP_STEP_ID, BREAK_GLASS_STEP_ID, PREREQ_STEP_ID } from './stepIds.ts'
import { idFor, BREAK_GLASS_STEP_ID, PREREQ_STEP_ID, SEPARATE_ADMIN_ACCOUNTS_STEP_ID } from './stepIds.ts'

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

export { PLACEHOLDER_STEP }



/**
 * One policy a step implements: the canonical resolved body (resolvePolicy.ts),
 * the person's answers already applied to it, and the name this tenant gives it.
 * A goal the baseline implements with two policies carries two of these, in the
 * baseline's order.
 */
export type StepPolicyInput = {
  /** The baseline's own name for the policy. */
  sourceName: string
  /** The resolved policy, with its unresolved references. */
  resolved: ResolvedPolicy
  /** The name this tenant's policy takes (the plan's proposal, or the existing policy's). */
  displayName?: string
  /**
   * The tenant policy this member is already represented by, so the operation is
   * an update to it rather than a second copy. Absent for a create.
   */
  target?: { policyId: string; state: string } | null
}

/** The sections of a policy an update may carry, in the order a person meets them in the portal. */
export type ChangedSection = 'users' | 'applications' | 'grantControls' | 'sessionControls' | 'state'

// A Change step carries only the fields that change (prompt 17 §4): the request
// body is a patch, and the portal steps open the existing policy and list those
// fields alone.
const CHANGED_SECTION: Partial<Record<GoalResult['reasons'][number]['kind'], ChangedSection>> = {
  'weaker-control': 'grantControls',
  'session-weaker': 'sessionControls',
  'not-targeted': 'users',
  excluded: 'users',
  'apps-narrower': 'applications',
  'apps-excluded': 'applications',
  'report-only': 'state',
}

/**
 * The policy an update leaves behind: the whole policy it is working towards
 * with its own patch applied. A patch that turns a report-only policy on makes
 * the target enabled too — nothing downstream may read a target the submitted
 * body contradicts.
 */
function withPatch(whole: RawPolicy, patch: RawPolicy): RawPolicy {
  const out: RawPolicy = { ...whole, ...patch }
  const wholeConditions = (whole.conditions ?? null) as RawPolicy | null
  const patchConditions = (patch.conditions ?? null) as RawPolicy | null
  if (wholeConditions && patchConditions) out.conditions = { ...wholeConditions, ...patchConditions }
  return out
}

/**
 * The fields an update submits: the whole policy narrowed to the sections that
 * change, and nothing else. Not the description — the instruction says every
 * setting it does not list is left as it is, and a description the person never
 * saw listed would be one of them.
 */
function patchOf(body: RawPolicy, sections: ReadonlySet<ChangedSection>): RawPolicy {
  const patch: RawPolicy = {}
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
  return patch
}

/**
 * The step's action, built once from the canonical resolved policies the caller
 * has already produced. This is the only place a policy becomes an operation:
 * the answers are applied here, the tenant's name and state and tag go on here,
 * the mode and the target policy are decided here, and the bodies this returns
 * are the ones the step carries — the portal instructions, the JSON, the
 * PowerShell and the download all describe these and nothing else.
 *
 * While any object a policy names is missing there is no operation to run at
 * all: `json` is null, so no channel offers an incomplete body and nothing
 * schedules a rollout for it. The list of what is missing stays.
 */
export function buildCreateAction(
  policies: StepPolicyInput[],
  mapping: MappingState,
  planId: string,
  stepId: string,
  goalId: string,
  opts: { sections?: ReadonlySet<ChangedSection> } = {},
): Action {
  const tag = `[IAMAI:${planId}:${stepId}]`
  /** One policy as the whole policy it is meant to be in this tenant. */
  const artifact = (source: RawPolicy, p: StepPolicyInput): RawPolicy => {
    const body = structuredClone(source)
    const sourceDescription = body.description
    delete body.id
    delete body.createdDateTime
    delete body.modifiedDateTime
    // The pinned baseline's own placeholder map names the author's objects; it is not a policy field.
    delete body.placeholders
    // A new policy starts in report-only; a policy already there keeps its state.
    body.state = p.target ? p.target.state : 'enabledForReportingButNotEnforced'
    if (p.displayName) body.displayName = p.displayName
    body.description = `${tag}${typeof sourceDescription === 'string' && sourceDescription ? ' ' + sourceDescription : ''}`
    return body
  }
  const sections = opts.sections ?? new Set<ChangedSection>()
  const missing: NonNullable<Action['missing']> = []
  const operations: PolicyOperation[] = []
  for (const p of policies) {
    // The person's answers, applied as recorded deviations (deviations.ts) —
    // once, here. Where an answer changed the policy, the baseline's own version
    // travels with it so the step can show the choice beside it.
    const clone = structuredClone(p.resolved.body)
    const answered = applyDeviations(clone, goalId, mapping)
    const deviated = answered !== clone
    // Nothing is dropped silently: an object the tenant does not have comes back
    // in `missing`, and while any does there is no operation to run.
    const whole = implementable(artifact(answered, p), p.resolved.unresolved)
    for (const m of whole.missing) if (!missing.some((x) => x.token === m.token)) missing.push(m)
    const wholeBaseline = deviated ? implementable(artifact(p.resolved.body, p), p.resolved.unresolved).policy : undefined
    const target = p.target ?? null
    if (target) {
      const patch = patchOf(whole.policy, sections)
      operations.push({
        sourceName: p.sourceName,
        mode: 'update',
        policyId: target.policyId,
        body: patch,
        baseline: wholeBaseline ? patchOf(wholeBaseline, sections) : undefined,
        // The policy the change leaves behind: the whole policy with this exact
        // patch applied. Read for explanation, impact and audit; never submitted.
        target: withPatch(whole.policy, patch),
      })
    } else {
      operations.push({ sourceName: p.sourceName, mode: 'create', policyId: null, body: whole.policy, baseline: wholeBaseline })
    }
  }
  // `json` is a projection of the operations, for the plan file and the exports;
  // the channels read the operations themselves (roadmap/operations.ts). It is
  // written only when there is something to run: every operation valid, and
  // nothing the policy names missing from the tenant.
  const runnable = missing.length === 0 && operations.length > 0 && operations.every(isValidOperation)
  const bodies = operations.map((o) => o.body)
  const json = runnable ? JSON.stringify(bodies.length === 1 ? bodies[0] : bodies, null, 2) : null
  const kind = operations.some((o) => o.mode === 'update') ? 'adjust' : 'create'
  return { kind, summary: [], json, portalSteps: [], missing, resolution: { policies: operations, tenant: { exclusionsGroupId: null, serviceAccountsGroupId: null } } }
}

export { proposedPolicyName } from '../coverage/naming.ts'

/** The sections a partly-covered goal's policy has to change (roadmap-v2.md §4.6). */
function changedSections(result: GoalResult): Set<ChangedSection> {
  const sections = new Set(result.reasons.filter((r) => !r.expected).map((r) => CHANGED_SECTION[r.kind]).filter((x): x is ChangedSection => Boolean(x)))
  if (result.floorRaised) sections.add('grantControls')
  return sections
}

/**
 * The field-by-field account of what an update changes on the tenant's policy —
 * current value → new value, read from the operation's own body so the account
 * and the request can never differ. Nothing outside the operation is listed.
 */
function changesFor(action: Action, sections: ReadonlySet<ChangedSection>, existing: RawPolicy | null): Action {
  const update = action.resolution?.policies.find((o) => o.mode === 'update')
  if (!update) return action
  const body = update.body
  const conditions = (body.conditions ?? {}) as RawPolicy
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
  return { ...action, roleList: roleList && roleList.names.length > 5 ? roleList : excludeRoles && excludeRoles.names.length > 5 ? excludeRoles : null, changes }
}

// ---- generation ----

export function generateRoadmap(input: RoadmapInput): RoadmapResult {
  // Role names travel with the scan ($expand=roleDefinition); learn them before any label is built.
  learnRoleNames(input.snapshot.config.roleAssignments?.rows ?? [])
  const { snapshot, mapping, viability, planId } = input
  // The device decision (E2), from its stored answers: which platforms the
  // device policies cover and what counts as a managed computer. Open: phones
  // out, compliant computers only, and the device steps wait on the decision.
  const devicePlan = devicePlanOf(mapping)
  const deviceScope = deviceScopeOf(devicePlan)
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
    readinessCache.set('device', readinessFor('require-managed-device', allActive, viability, snapshot, deviceScope))
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
  // Every author reference this tenant resolves, in one place for every channel
  // (resolvePolicy.ts): the tenant's objects, and the countries location the
  // mapping cannot name on its own. A reference nothing resolves is left out of
  // the policy body and the body says so, naming the Preparation step that
  // creates the object.
  const countriesLocationId = tenantCountryLocation(snapshot, mapping.allowedCountries)?.id ?? null
  const tenantObjects = tenantObjectsOf(mapping, countriesLocationId)
  // The tenant's own authentication strengths, by id. Where a confirmed mapping
  // resolves the author's strength to one of these, the body carries the
  // tenant's id — so it must carry the tenant's name too, or an instruction
  // would name one object while the request submits another.
  const strengthNames = new Map(
    ((snapshot.config.authStrengths?.rows ?? []) as Record<string, unknown>[])
      .filter((x) => typeof x.id === 'string' && typeof x.displayName === 'string')
      .map((x) => [String(x.id).toLowerCase(), String(x.displayName)]),
  )
  /** The resolved policy with its authentication strength named as this tenant knows it. */
  const namedStrength = (resolved: ResolvedPolicy): ResolvedPolicy => {
    const grant = resolved.body.grantControls as { authenticationStrength?: { id?: unknown; displayName?: unknown } } | null | undefined
    const strength = grant?.authenticationStrength
    const id = typeof strength?.id === 'string' ? strength.id.toLowerCase() : null
    const name = id ? strengthNames.get(id) : undefined
    if (!strength || !name || name === strength.displayName) return resolved
    return { ...resolved, body: { ...resolved.body, grantControls: { ...grant, authenticationStrength: { ...strength, displayName: name } } } }
  }
  const exclusionsGroupId = tenantObjects.exclusionsGroupId
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
  const dormant = notActiveUsers(snapshot, snapshot.asOf, notPeopleIds(mapping))
  if (dormant.length > 0) {
    const s = prereq('s-check-dormant-accounts')
    s.kind = 'check'
    s.action = { ...s.action, kind: 'check' }
    // The dormant step is the one place never-signed-in accounts are a population (§8.1): it names them, though none are active.
    s.population = { total: dormant.length, active: 0, admins: 0, guests: 0, ids: dormant.map((u) => u.id), activeIds: dormant.map((u) => u.id), inScope: dormant.length }
    steps.push(s)
  }

  // Separate admin accounts (E6): a directory-role holder who also reads mail or
  // joins Teams on the same account. A Preparation check step, skippable, only
  // while somebody does; the admin policies name the same people beside it.
  const adminsWithWorkload = adminsWithWorkloadOf(snapshot, new Set(mapping.breakGlassUserIds)).map(([id]) => id)
  if (canUseConditionalAccess && adminsWithWorkload.length > 0) {
    const s = prereq(SEPARATE_ADMIN_ACCOUNTS_STEP_ID)
    s.kind = 'check'
    s.action = { ...s.action, kind: 'check' }
    s.population = { total: adminsWithWorkload.length, active: adminsWithWorkload.length, admins: adminsWithWorkload.length, guests: 0, ids: adminsWithWorkload, activeIds: adminsWithWorkload, inScope: adminsWithWorkload.length }
    steps.push(s)
  }

  // Shared devices, their own policy (prompt 48 item 4).
  if (canUseConditionalAccess && sharedDevices.length > 0) {
    const step = prereq('s-shared-devices')
    // Its own policy, named in the tenant's convention (the baseline holds none; the step's instructions create it).
    step.naming = { proposed: proposedName({ prefix: 'CA', rest: ['Allow', 'Shared devices'], collapsed: 'Allow shared devices' }, naming).name, fromBaseline: null }
    step.population = { total: sharedDevices.length, active: sharedDevices.length, admins: 0, guests: 0, ids: sharedDevices.map((u) => u.id), activeIds: sharedDevices.map((u) => u.id), inScope: sharedDevices.length }
    steps.push(step)
  }

  // The device decision (E2): how phones and computers are managed, asked in
  // Preparation when phone sign-ins or unjoined computer sign-ins exist and the
  // tenant holds Intune (without Intune the device steps are Not licensed and
  // nothing asks). In place once answered; while open, the compliant-device,
  // app-protection and Intune-enrolment steps wait on it (the goal loop), and
  // nothing else does.
  const deviceStepId = PREREQ_STEP_ID.devicePlan
  const phoneIds = snapshot.scenarioEvidence?.phoneSignIns?.people ?? []
  const unjoinedIds = snapshot.scenarioEvidence?.unjoinedComputers?.people ?? []
  if (canUseConditionalAccess && snapshot.capabilities.intune.enabled && (phoneIds.length > 0 || unjoinedIds.length > 0)) {
    const s = prereq(deviceStepId)
    s.kind = 'check'
    s.action = { ...s.action, kind: 'check' }
    s.population = population([...new Set([...phoneIds, ...unjoinedIds])].filter((id) => !excluded.has(id)), popIndex)
    if (devicePlan) {
      s.status = 'done'
      s.deliveredBy = [devicePlan.phonesText, ...(devicePlan.computersText ? [devicePlan.computersText] : [])]
    }
    steps.push(s)
  }

  // The three questions the operator can answer (prompt 48 item 10), read from
  // their stored answers, questionAnswers[stepId:label] (answers.ts): an answer
  // that changes the plan adds its carve-out step, whose words are a content
  // step. Unanswered, the plan proceeds on the evidence and the affected step
  // carries the can't-see line.
  for (const id of answeredCarveOuts(mapping)) steps.push(prereq(id))

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
  const validationCtx = buildContext({ snapshot, state: mapping, groupMembers: groupFacts, viability, drillDates: input.cleanupRecord?.drills ?? [] })
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

    // The policies this step describes: the goal map's, which is what a merged
    // goal renders as Policy A and Policy B. Where the map does not describe the
    // package (a synthetic fixture) the step describes the one chosen variant —
    // never the variants it rejected.
    const mappedSources = (goalMap[goal.id] ?? []).map((k) => factsByKey.get(k)).filter((b): b is (typeof baselineFactsList)[number] => b !== undefined)
    const stepSources = mappedSources.length > 0 ? mappedSources : source ? [source] : []
    // The step's one resolution (resolvePolicy.ts): each of those policies,
    // resolved once against the applied mapping. The action below builds its
    // JSON from the same result, and the portal instructions read it off the
    // step — nothing resolves a baseline reference twice.
    const resolveOne = (body: RawPolicy, authorPolicies: readonly CaPolicy[]): ResolvedPolicy => namedStrength(resolveTenantPolicy(body, tenantObjects, goal.id, authorPolicies))
    /**
     * The step's policies, ready to become its artifact: the baseline's, in the
     * baseline's order, each resolved once; or the goal's own template where the
     * baseline holds no policy for the goal. `named` gives each the name this
     * tenant's copy takes — the plan's proposal for the first, the pair's second
     * name for the second (coverage/naming.ts policyPairNames), so the name on
     * the instruction and the name in the body are the one name.
     */
    const stepPolicies = (): StepPolicyInput[] =>
      stepSources.map((m) => ({ sourceName: m.facts.name, resolved: resolveOne(m.policy as RawPolicy, input.baseline.policies) }))
    const templatePolicy = (): StepPolicyInput[] => [{ sourceName: goal.id, resolved: resolveOne(resolveTemplate(impl.template as TemplateBody, templateValues).body as RawPolicy, []) }]
    const named = (policies: StepPolicyInput[], first: string): StepPolicyInput[] =>
      policies.map((p, i) => ({ ...p, displayName: i === 0 ? first : policyPairNames(first, p.sourceName, naming ?? null).b }))

    const whoKey = impl.expectedWho.kind
    // The service accounts are the mapping's, and the one population every other
    // step excludes (E9): the step that restricts them names them all.
    if (!expectedCache.has(whoKey)) expectedCache.set(whoKey, whoKey === 'workload' ? [] : whoKey === 'serviceAccounts' ? [...mapping.serviceAccountUserIds] : [...resolvePopulation(impl.expectedWho, snapshot).ids].filter((id) => !excluded.has(id)))
    const popIds = expectedCache.get(whoKey) ?? []
    if (!populationCache.has(whoKey)) populationCache.set(whoKey, whoKey === 'serviceAccounts' ? { total: popIds.length, active: popIds.length, admins: 0, guests: 0, ids: popIds, activeIds: popIds, inScope: popIds.length } : population(popIds, popIndex))
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
        action = buildCreateAction(named(stepPolicies(), proposed.name), mapping, planId, stepId, goal.id)
        namingNote = proposed
      } else {
        // No baseline policy stands for this goal: the goal's own template is
        // the body, with the tenant's objects filled in where they exist and a
        // Wave 0 step named where they do not (prompt 46 item 12). Every step
        // is executable; nothing says "create a policy that meets the floor".
        for (const p of resolveTemplate(impl.template as TemplateBody, templateValues).unresolved) blockPlaceholder(p)
        const proposed = uniqueName(goal)
        // The goal's own template is a body the engine wrote, so it carries no
        // author references; it goes through the same boundary all the same, for
        // the exclusions group and the de-duplication.
        action = buildCreateAction(named(templatePolicy(), proposed.name), mapping, planId, stepId, goal.id)
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
      // No baseline policy stands for this goal, so the policy the step changes
      // is the goal's own template — the same body the absent branch builds,
      // through the same boundary.
      const changing = source ? stepPolicies() : templatePolicy()
      const sections = changedSections(result)
      if (changing.length < 2) {
        // One policy: the goal's coverage names the tenant policy it changes.
        const one = named(changing, existing?.policyName ?? proposedPolicyName(goal, naming))
        one[0] = { ...one[0], target: existing ? { policyId: existing.policyId, state: existing.state } : null }
        action = changesFor(buildCreateAction(one, mapping, planId, stepId, goal.id, { sections }), sections, existingRaw)
      } else {
        // Two policies: each member needs its own tenant policy, or none. The
        // plan associates a member with a tenant policy only where the policy
        // carries the name the plan gives that member — an operator who followed
        // these instructions. Anything less is a guess, so the step withholds the
        // implementation and asks for the names to be sorted out instead.
        // The plan's canonical name for each member — not the suffixed proposal a
        // create would take, because the policy this matches is the one already
        // carrying that name.
        const members = named(changing, proposedPolicyName(goal, naming))
        const byName = new Map((snapshot.config.caPolicies?.rows ?? []).map((p) => [String((p as RawPolicy).displayName ?? '').trim().toLowerCase(), p as RawPolicy]))
        const matched = members.map((m) => byName.get(String(m.displayName ?? '').trim().toLowerCase()) ?? null)
        const ids = matched.filter((p): p is RawPolicy => p !== null).map((p) => String(p.id))
        const ambiguous = matched.every((p) => p === null) || new Set(ids).size !== ids.length
        if (ambiguous) {
          action = { kind: 'adjust', summary: [], json: null, portalSteps: [], missing: [], unmatchedPair: true }
        } else {
          const withTargets = members.map((m, i) => {
            const p = matched[i]
            return p ? { ...m, target: { policyId: String(p.id), state: String(p.state ?? 'enabled') } } : { ...m, target: null }
          })
          const firstUpdate = matched.find((p) => p !== null) ?? null
          action = changesFor(buildCreateAction(withTargets, mapping, planId, stepId, goal.id, { sections }), sections, firstUpdate)
        }
      }
      if (action.kind === 'create') namingNote = uniqueName(goal)
    }

    // The tenant objects the resolution used travel with the result, so an
    // instruction names the object the body actually holds rather than looking
    // one up in the mapping again.
    if (action.resolution) action.resolution = { ...action.resolution, tenant: { exclusionsGroupId: tenantObjects.exclusionsGroupId, serviceAccountsGroupId: tenantObjects.serviceAccountsGroupId, emergencyIds: [...mapping.breakGlassUserIds] } }


    // Named dependencies (prompt 12 §B).
    if (status !== 'done') {
      if (goal.id === 'register-info-protected' && steps.some((s) => s.id === locStepId && s.status !== 'done') && !doesntApply(locStepId)) blockByStep(locStepId, 'trusted-location')
      // The device steps wait on the device decision while it is open (E2); nothing else does.
      if (DEVICE_GOALS.has(goal.id) && steps.some((s) => s.id === deviceStepId && s.status !== 'done')) blockByStep(deviceStepId, 'device-decision')
      if (goal.id === 'geo-restriction') {
        if (steps.some((s) => s.id === countriesStepId)) blockByStep(countriesStepId, 'create-object')
      }
      // The service-accounts block names the group and the trusted network (E9): it waits on both.
      if (goal.id === SERVICE_ACCOUNTS_TRUSTED_GOAL) {
        if (steps.some((s) => s.id === saStepId)) blockByStep(saStepId, 'create-object')
        if (steps.some((s) => s.id === locStepId && s.status !== 'done') && !doesntApply(locStepId)) blockByStep(locStepId, 'trusted-location')
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
      // A strength policy's lockout count: the people in scope with no phishing-resistant method today (lockout.ts).
      ...(LOCKOUT_GOALS.has(goal.id) && status !== 'done' ? { lockout: lockoutIds(goal.id, viability, snapshot, excluded).length } : {}),
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

  // 0. A goal whose baseline policy contradicts its own documentation
  // (baselineConflict.ts): the step keeps its evidence and loses its
  // implementation. Not a readiness wait and not a step dependency — the cause
  // is the baseline, so it is neither counted with the tenant's readiness waits
  // nor drawn as an edge to a prerequisite. Forced after every other state,
  // including done: a policy the tenant already holds cannot make a
  // contradictory definition safe to act on.
  for (const s of steps) {
    if (!hasBaselineConflict(s.goalId) || s.status === 'skipped') continue
    s.action = { kind: s.action.kind, summary: [], json: null, portalSteps: [] }
    s.deliveredBy = []
    // The safety edges stay (a deny-capable step still waits on the escape
    // hatch); the conflict is added beside them and binds the row's reason
    // ahead of any of them (stateReason.ts), so the cause a person reads is the
    // baseline's, never a prerequisite in their tenant.
    if (!s.blockers.some((b) => b.label === 'baseline-conflict')) s.blockers.push({ kind: 'evidence', label: 'baseline-conflict', binding: BLOCKED_REASON.baseline })
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
  // A policy step with nothing to run gets no rings either: the plan does not
  // date a rollout for a policy it cannot write (roadmap/operations.ts).
  // A policy the plan cannot write yet gets no rings either: it does not date a
  // rollout for a policy it cannot write (roadmap/operations.ts).
  for (const s of steps) s.rings = unavailableReason(s) !== null ? [] : proposeRings(s, ringCtx)

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
  // The device decision sends a device step to the footer with the answer as
  // the reason (E2): the compliant-device policy (and the Intune-enrolment step
  // with it) when no platform is left in it, the app-protection policy unless
  // phones are protected by their apps.
  for (const s of steps) {
    if (s.status === 'done' || s.status === 'skipped' || !DEVICE_GOALS.has(s.goalId)) continue
    const reason = deviceStepDoesntApply(s.goalId, mapping)
    if (reason === null) continue
    s.doesntApply = reason
    s.skipReason = reason
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
  // The consolidation row exists whenever a step's existingCoverage line rendered
  // (E3): the policies a step found already covering its goal, which the
  // baseline's version supersedes once enforced. A done step cites its
  // policies as what makes it In place, not as overlap.
  schedule.cleanup = cleanupPhaseFor({
    after: schedule.targetEnd,
    rhythm,
    emergencyAccountIds: mapping.breakGlassUserIds,
    emergencyAccounts: mapping.breakGlassUserIds.map(nameOf),
    emergencyAccountUpns: mapping.breakGlassUserIds.map((id) => userById.get(id)?.userPrincipalName ?? nameOf(id)),
    organisation: input.coverage.organisation,
    superseded: supersededPolicies(steps),
    done: input.cleanupRecord?.done ?? {},
  })
  const waveStart = new Map(schedule.waves.map((w) => [w.wave, w.start]))
  for (const s of steps) {
    // Comms per ring, dated (§4.11); the step's own announcement is the first ring's.
    if (s.comms?.includes('{DATE}')) {
      const template = s.comms
      // A step the schedule did not place (skipped, or sent to the footer by an answer) has undated rings: the wave's start or the plan's stands in.
      const firstDate = [s.rings[0]?.plannedStart, waveStart.get(schedule.waveOf[s.id] ?? 0), startIso].find((d): d is string => typeof d === 'string' && !Number.isNaN(Date.parse(d))) ?? startIso
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

/**
 * The policies the plan's steps found already covering their goal (the step's
 * existingCoverage line names them), which the consolidation row retires once
 * the baseline's version is enforced: a policy step still to do, with something
 * delivering its goal today. A done step's policies are what makes it In place.
 */
export function supersededPolicies(steps: readonly Step[]): string[] {
  const out: string[] = []
  for (const s of steps) {
    if (s.status === 'done' || s.status === 'skipped' || (s.kind !== 'create' && s.kind !== 'adjust') || s.deliveredBy.length === 0) continue
    const names = s.deliveredBy.join(', ')
    if (!out.includes(names)) out.push(names)
  }
  return out
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
