import { networkDraftOf } from '../mapping/networkDraft.ts'
import { emergencyAccountPreparationComplete, emergencyAccountPreparationOf } from './emergencyAccountPreparation.ts'
import { followUpIdsOf, settleFollowUp } from './followUp.ts'
import { addWorkflowSteps } from './workflows.ts'
import { directionSteps } from './direction.ts'
import { applyManualReviews, perUserMfaReading } from './manualWork.ts'
// Step generation (roadmap.md §1–§6; 2026-08-27 redesign: collapsed phase 0,
// per-tenant impact, safe-today lane, handle-with-care gating, comms drafts,
// operator self-safety, Learn links, auto-scheduling). Pure.
import type { CaPolicy } from '../baseline/types.ts'
import { docFor } from '../baseline/index.ts'
import { referenceUsage } from '../baseline/interpretation.ts'
import type { BaselinePackage } from '../baseline/types.ts'
import { CORE_ADMIN_ROLE_IDS, matchesSignature } from '../coverage/classify.ts'
import { placeholdersIn, resolveTemplate } from './template.ts'
import { PLACEHOLDER_STEP, implementable, resolveTenantPolicy, tenantObjectsOf, unmatchedStrengths } from './resolvePolicy.ts'
import { accountApplicability, effectOf, emergencyExposureOf, enforcementHeld, isOpenPolicy, isValidOperation, operationsOf, stepEffects, strengthLookupOf, submitsEnforcement, tenantStrengthsOf, validOperations, unavailableReason } from './operations.ts'
import type { PolicyEffect } from './operations.ts'
import type { GrantFloor } from '../coverage/types.ts'
import type { ResolvedPolicy } from './resolvePolicy.ts'
import type { PolicyOperation, SourceReference } from './types.ts'
import { BLOCKED_REASON, readinessFamilyOf, readinessMeasure } from '../copy/reasons.ts'
import { AUTH_CONTEXT_IN_USE, contextsTakenElsewhere } from './authContext.ts'
import { EMERGENCY_ACCOUNT_RULES, emergencyAccountStanding, emergencyAccountStandingForStep, emergencyStanding, hardeningBasis, hardeningDeferred } from '../validation/emergencyTiers.ts'
import type { EmergencyStanding } from '../validation/emergencyTiers.ts'
import { fillText, missingVars } from '../content/render.ts'
import { stepById as contentStepById } from '../content/content.ts'

/**
 * The deferred emergency-access hardening as the Cleanup row lists it: each
 * recommendation in the emergency step's own fix words, naming the account it is
 * about. A line with a value the plan cannot fill is left out rather than shown
 * with a hole.
 */
function deferredHardeningLines(step: Step, nameOf: (id: string) => string): string[] {
  const templates = ((contentStepById[step.id] as unknown as { whatToDo?: { checkFixes?: Record<string, string> } } | undefined)?.whatToDo?.checkFixes ?? {}) as Record<string, string>
  return (step.checks?.items ?? [])
    .filter((it) => it.tier === 'hardening' && typeof templates[it.fix] === 'string')
    .map((it) => ({ template: templates[it.fix], values: { ...it.values, ...(it.target ? { name: nameOf(it.target) } : {}) } }))
    .filter(({ template, values }) => missingVars(template, values).length === 0)
    .map(({ template, values }) => fillText(template, values))
}
import { BASELINE_CONFLICT, baselineConflicts } from './baselineConflict.ts'
import type { TemplateBody, TemplatePlaceholder, TemplateValues } from './template.ts'
import { policyFacts } from '../coverage/facts.ts'
import { PINNED_GOAL_MAP, goalInMap, pinnedSource, policiesForGoal, policyKey } from './goalMap.ts'
import { COVERAGE_JUDGED, memberKeyOf, sameDimension, unwrittenDifferences } from './observation.ts'
import type { GoalMap } from './goalMap.ts'
import type { StrengthLookup } from '../coverage/strength.ts'
import { satisfiesFloor } from '../coverage/strength.ts'
import type { CoverageReport, Goal, GoalResult } from '../coverage/types.ts'
import { ownCandidate } from '../coverage/coverage.ts'
import { resolvePopulation } from '../coverage/population.ts'
import type { GroupMembers } from '../coverage/population.ts'
import { proposeRings, ringContextIndexes } from './rings.ts'
import { createMethodPreparationCache, methodPreparation, methodReadiness } from './methodReadiness.ts'
import type { PolicyEffect as MethodTarget } from './operations.ts'
import { campaignIds, isActivePerson, namedAccounts, population, populationIndex } from '../derive/population.ts'
import { activityUnreadUsers, enabledUsers, notActiveUsers, notPeopleIds, personAccounts } from '../derive/sets.ts'
import { adminsWithWorkloadOf } from '../derive/contentLists.ts'
import { affectedIds } from '../derive/whoLine.ts'
import { lockoutCount } from './lockout.ts'
import { accountVerdict, effectsOf, familyReading, measuredReach, operationReach, scopeCohort, stepAccountVerdict } from './strand.ts'
import { tenantRhythm } from './rhythm.ts'
import { eventsFor, nobodyAffected as nobodyAffectedBy } from './timing.ts'
import { MANAGER, MANAGER_BY_CONTROL, MANAGER_BY_GOAL } from '../copy/plain.ts'
import { contentTitle } from '../content/stepTitle.ts'
import { settleEnforceWaits } from './enforceWaits.ts'
import { app, directionWords, engine, shared, stepById } from '../content/content.ts'
import { countryName as countryLabel } from '../mapping/countries.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { adminUserIds, learnRoleNames, roleListSummary } from '../roles.ts'
import { policyPairNames, proposedPolicyName } from '../coverage/naming.ts'
import { rolloutBucket } from '../scoring/mfaViability.ts'
import { isReady } from '../scoring/phishingResistant.ts'
import type { NameDirectory } from '../names.ts'
import { personLabels } from '../names.ts'
import { isAllowlistGeoPolicy, tenantCountryLocation } from '../mapping/countries.ts'
import { absoluteDate, displayZone } from '../copy/dates.ts'
import { detectHighCare } from '../derive/highCare.ts'
import { proposedStart } from '../derive/planStart.ts'
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
import { blindOf, goalFamily, mfaReady, readinessFor, routeShortfallOf, strengthMeasuredOf, blindSourceOf, sourceReadFix } from './readiness.ts'
import { cantSeeFor, scenarioContext, scenarioLinesFor } from './scenarioLines.ts'
import { SCENARIO } from '../copy/scenarios.ts'
import { sharedDeviceUsers } from '../derive/sharedDevices.ts'
import { staticViolations } from './staticRules.ts'
import { cleanupPhaseFor } from './cleanupPhase.ts'
import { namedEmergencyExclusions } from './cleanup.ts'
import { addsExclusionsOnly } from './changedFields.ts'
import type { CleanupRecord } from './cleanupDone.ts'
import { recoveryAccountBasis, recoveryCandidateReadings, recoveryPreparation, recoveryEvidenceSource } from './cleanupDone.ts'
import { passkeyTargetsReach, recoveryPasskeyCandidateSet } from './passkeyCompatibility.ts'
import { exclusionsReach } from '../validation/exclusionsGroupPolicies.ts'
import { journeyPasskeyFindings, journeyAccountFindings, journeyGroupFindings, journeyRecoveryFindings } from './emergencyJourney.ts'
import { isFloorGoal } from './floor.ts'
import { devicePlanOf, devicePlanComplete, deviceScopeOf, openInputsOf, travelCountriesOf } from './answers.ts'
import { DEVICE_GOALS, applyDeviations, deviceStepDoesntApply } from './deviations.ts'

/** The baseline's block of the service accounts outside the trusted network (E9): step 6 gains it as Restrict Service Accounts to the Trusted Network. */
export const SERVICE_ACCOUNTS_TRUSTED_GOAL = 'service-accounts-trusted-network'

/** The combinations that are a passkey or a security key and nothing weaker. */
const PASSKEY_ONLY = new Set(['fido2', 'windowshelloforbusiness', 'x509certificatemultifactor', 'x509certificatesinglefactor', 'temporaryaccesspassonetime', 'temporaryaccesspassmultiuse'])

/**
 * What a step's own policies ask for, in the words the announcement is chosen
 * by. Read from the operation and from what this tenant says its strengths
 * allow — never the goal's floor, and never the combinations the baseline's
 * author wrote beside a strength id. Null where they ask for nothing a person
 * has to do.
 */
function grantOf(effects: readonly PolicyEffect[], strengths: Map<string, string[]>): GrantFloor | null {
  if (effects.some((e) => e.blocks)) return 'block'
  for (const e of effects) {
    for (const r of e.requirements) {
      if (r.kind === 'strength') {
        const combos = strengths.get(r.id.toLowerCase()) ?? []
        return combos.length > 0 && combos.every((c) => PASSKEY_ONLY.has(c.toLowerCase())) ? 'phishingResistant' : 'mfa'
      }
      if (r.kind === 'device') return 'compliantDevice'
      if (r.kind === 'app') return r.control === 'approvedapplication' ? 'approvedApplication' : 'compliantApplication'
      if (r.kind === 'passwordChange') return 'passwordChange'
      if (r.kind === 'mfa') return 'mfa'
    }
  }
  return null
}

/** The registration user actions, as Graph writes them. */
const REGISTER_SECURITY_INFO = 'urn:user:registersecurityinfo'
const REGISTER_DEVICE = 'urn:user:registerdevice'
/**
 * The two resources IAMAI names by their own identifier: Graph's own
 * `MicrosoftAdminPortals` target (coverage/facts.ts reads the same string) and
 * the Windows Azure Service Management API's application id
 * (coverage/applicability.ts holds the same id). Deliberately just these two —
 * an arbitrary application id is a resource the plan has nothing to say about,
 * and it says nothing rather than describing one it cannot name.
 */
const NAMED_RESOURCES: { key: NonNullable<PolicySemantics['resource']>; ids: string[] }[] = [
  { key: 'adminPortals', ids: ['microsoftadminportals'] },
  { key: 'azureManagement', ids: ['797f4846-ba00-4fd7-ba43-dac1f8f63013'] },
]

/**
 * What a step's own policies *mean*, for the words the step says about them:
 * read from the operations and from nothing else (roadmap/operations.ts
 * PolicyEffect), exactly as `grantOf` reads what they ask for.
 *
 * Each is a condition the policy carries. A policy is about a place because it
 * narrows by one, about registering sign-in methods because it names that user
 * action, and about guests because its own scope names external users and
 * nobody else — never because of the goal it is filed under, whose family used
 * to decide two of these and gave GetIAMAI's all-users policy a message about
 * guest access (copy/announcements.ts PolicySemantics).
 */
export function policySemantics(effects: readonly PolicyEffect[]): PolicySemantics {
  const scopes = effects.map((e) => e.scope)
  const named = new Set(scopes.flatMap((sc) => sc.applications.include.map((a) => a.toLowerCase())))
  const action = (want: string): boolean => scopes.some((sc) => sc.applications.userActions.some((a) => a.toLowerCase() === want))
  return {
    locations: effects.some((e) => e.narrowings.some((n) => n.kind === 'locations')),
    registration: action(REGISTER_SECURITY_INFO),
    deviceRegistration: action(REGISTER_DEVICE),
    resource: NAMED_RESOURCES.find((r) => r.ids.some((id) => named.has(id)))?.key ?? null,
    // Every policy of the step names external users, and none of them names
    // anybody else: one all-users policy in the pair is a policy about everyone.
    guestsOnly:
      scopes.length > 0 &&
      scopes.every((sc) => sc.guests.include !== null && !sc.allUsers && sc.users.include.length === 0 && sc.groups.include.length === 0 && sc.roles.include.length === 0),
    blocks: effects.some((e) => e.blocks),
  }
}

/**
 * The manager note for the control a policy *names*, or null where the policy
 * names none of them.
 *
 * There is no goal id here, and that is the point: the four notes that describe
 * a specific control — registering sign-in methods, joining a device, the
 * Microsoft admin portals, the Azure management API — used to be keyed by the
 * goal a step was filed under, so a step whose baseline exports a Block was
 * telling a manager it "requires MFA to open the Microsoft admin portals".
 *
 * Each of them says the policy requires MFA, so each is returned only where the
 * operation says the same: it asks for a method or a strength, and it blocks
 * nobody. A resource IAMAI cannot name, or a policy asking for something else,
 * gets nothing from here and is described by what the operation does establish.
 */
export function controlNoteFor(semantics: PolicySemantics, grant: GrantFloor | null): string | null {
  if (semantics.blocks || (grant !== 'mfa' && grant !== 'phishingResistant')) return null
  const control = semantics.registration ? 'registration' : semantics.deviceRegistration ? 'deviceRegistration' : semantics.resource
  return control === null ? null : MANAGER_BY_CONTROL[control]()
}

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
import type { PolicySemantics } from '../copy/announcements.ts'
import { proposedName, proposedObjectNames } from '../coverage/naming.ts'
import { NAMED_BELOW } from './constants.ts'
import { registrationWindow } from './campaign.ts'
import { ladderSteps } from './ladder.ts'

/**
 * Whether a tenant without Entra ID P1 is offered the free-tier ladder instead
 * of a plan. Off since 2026-09-20 (owner): P1 is the real minimum, and such a
 * tenant is told so rather than walked through steps that are not the thing it
 * came for. The ladder itself is untouched and this is the only switch.
 */
const FREE_TIER_LADDER = false
import { EMERGENCY_ACCESS_STEP_IDS, attachConfigurationFindings, blockerStepId, canonicalBlockerStepId, blockerSteps, gateFor, gateReason } from './blockerSteps.ts'
import { stepChecks } from '../validation/checkFixes.ts'
import { buildContext, breakGlassReport, exclusionGroupPolicySafety, reportFor } from '../validation/report.ts'
import type { SubjectReport } from '../validation/report.ts'
import { STEP_EXTRAS } from './stepDefaults.ts'
import { awaitsOperator, exclusionsGroupChoice, operatorExclusionsDecision } from '../mapping/safetyChoice.ts'
import type { DirectoryEvidence } from '../mapping/safetyChoice.ts'
import { conditionFor, initialState, projectStatus, raiseCondition, setState, stateFields } from './lifecycle.ts'
import type { StepState } from './lifecycle.ts'

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
  /** The first day deployment-capable work may land (Plan settings); absent, the start (roadmap/schedule.ts ScheduleOptions). */
  firstDeployment?: string | null
  /** Size-band override; null or absent = detected from active users. */
  band?: SizeBand | null
  operatorUserId?: string | null
  names?: NameDirectory
  /** Cached group memberships: the confirmed exclusion groups leave every step's population. */
  groupMembers?: GroupMembers
  /**
   * What this scan's own directory reads established about the objects a safety
   * choice rests on (Foundation C, mapping/safetyChoice.ts). Absent means the
   * caller has only the memberships it loaded, which tell it nothing about the
   * objects it did not: those stay unknown, never absent.
   */
  directory?: DirectoryEvidence
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
  manualConfirmations?: Record<string, Record<string, import('./decisions.ts').OwnerConfirmation>>
  /** Wall clock for manual records; snapshot time remains the evidence clock. */
  reviewNow?: string
  cleanupRecord?: CleanupRecord
  /**
   * The operator's deferral of the emergency-access hardening (owner,
   * 2026-09-11), as the plan record holds it: PlanDecisions.confirmations[the
   * emergency step][hardening-deferred]. It lifts the hold only while it covers
   * every recommendation outstanding now (validation/emergencyTiers.ts).
   */
  hardeningDeferral?: { at: string; basis: string } | null
  /**
   * When a scan of this plan first read security defaults on
   * (PlanDecisions.securityDefaultsSeenOnAt, progress.ts
   * securityDefaultsSeenOnAtOf); null or absent where no scan has. Turn Off
   * Security Defaults reads Completed once they are off only where this plan saw
   * them on, and Doesn't apply where it never did (V1 decision 6).
   */
  securityDefaultsSeenOnAt?: string | null
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
import { OPERATOR_PASSKEY_STEP_ID, PASSKEY_SETTINGS_STEP_ID, PASSKEY_TARGET, operatorPasskeyOf, passkeyReadingOf, passkeyReadinessFindingsOf } from './passkeySettings.ts'
import { SYNC_WORKLOAD_GOAL_ID, WORKLOAD_IDENTITY_BLOCKER, syncIdentitySupportOf } from './workloadIdentity.ts'

/**
 * The audience a step announcement is written for (prompt 41 §4).
 *
 * NAMED_BELOW is the same
 * threshold, so the greeting on the step and the audience label on the comms
 * plan cannot disagree about whether these are named people or a crowd.
 */
function announcementAudience(ids: readonly string[], admins: boolean, nameOf: (id: string) => string): { kind: string; names?: string[] } {
  if (ids.length === 0) return { kind: 'none' }
  if (admins) return { kind: 'admins' }
  if (ids.length < NAMED_BELOW) return { kind: 'named', names: ids.map(nameOf) }
  return { kind: 'everyone' }
}

/**
 * The coverage gap, over the active denominator (prompt 48.1 item 3): "covers 1
 * of 4 active". Only over a population of people: one that names accounts that
 * are not active people (the service accounts, derive/population.ts
 * namedAccounts) keeps the goal's own count. Re-counted over the active people
 * among three service accounts, a policy covering one of them read "covers 3 of
 * 3 active" while the accounts were hand-built as active, and read "covers 0 of
 * 0 active" once they were not.
 */
export function activeGap(result: GoalResult, pop: StepPopulation, active: ReadonlySet<string>): string | null {
  return overActive(result.gapSentence, result, pop, active)
}

/** The row's short gap clause (prompt 50.1 item 9), over the active denominator like activeGap. */
function activeGapShort(result: GoalResult, pop: StepPopulation, active: ReadonlySet<string>): string | null {
  return overActive(result.gapClause, result, pop, active)
}

function overActive(base: string | null, result: GoalResult, pop: StepPopulation, active: ReadonlySet<string>): string | null {
  if (!base || !/^covers \d+ of \d+ people$/.test(base) || pop.active < affectedIds(pop).length) return base
  const popActive = pop.active
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
  /**
   * The baseline's own stable key for this policy (goalMap.ts `policyKey`), from
   * which the member identity is taken (observation.ts `memberKeyOf`). Absent
   * where the baseline holds no policy for the goal and the body is the goal's
   * own template; the member then falls back to its position.
   */
  sourceKey?: string
  /** The resolved policy, with its unresolved references. */
  resolved: ResolvedPolicy
  /** The name this tenant's policy takes (the plan's proposal, or the existing policy's). */
  displayName?: string
  /**
   * The tenant policy this member is already represented by, so the operation is
   * an update to it rather than a second copy: its id, its current state and the
   * policy itself, which the update's target is built from. Absent for a create.
   */
  target?: { policyId: string; state: string; policy: RawPolicy | null } | null
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
  'exclusion-missing': 'users',
  'guest-types-narrower': 'users',
  // 'conditions-narrower' has no section: an update does not carry conditions, so
  // a goal short only by a condition is partly in place with nothing to submit.
}

/**
 * The exclusions an update takes off the tenant's policy (PolicyOperation.removes):
 * the patch sends its users and applications sections whole, so an exclusion the
 * tenant has there and the patch does not carry is gone once it is saved. The
 * request is right to send the baseline's section; what was missing was saying so.
 */
function removedExclusions(current: RawPolicy, patch: RawPolicy): PolicyOperation['removes'] {
  const cur = (current.conditions ?? {}) as RawPolicy
  const next = (patch.conditions ?? {}) as RawPolicy
  const gone = (from: unknown, to: unknown): string[] => {
    const kept = new Set((Array.isArray(to) ? to : []).map((x) => String(x).toLowerCase()))
    return (Array.isArray(from) ? from : []).map(String).filter((x) => !kept.has(x.toLowerCase()))
  }
  const ids: string[] = []
  let guestsOrExternalUsers = false
  // Only a section the patch writes replaces the tenant's values; one it leaves out keeps them.
  const curUsers = cur.users as RawPolicy | undefined
  const nextUsers = next.users as RawPolicy | undefined
  if (curUsers && nextUsers) {
    for (const key of ['excludeGroups', 'excludeUsers', 'excludeRoles']) ids.push(...gone(curUsers[key], nextUsers[key]))
    guestsOrExternalUsers = curUsers.excludeGuestsOrExternalUsers != null && nextUsers.excludeGuestsOrExternalUsers == null
  }
  const curApps = cur.applications as RawPolicy | undefined
  const nextApps = next.applications as RawPolicy | undefined
  if (curApps && nextApps) ids.push(...gone(curApps.excludeApplications, nextApps.excludeApplications))
  return guestsOrExternalUsers || ids.length > 0 ? { guestsOrExternalUsers, ids } : undefined
}

/**
 * The policy an update leaves behind: the tenant's own policy with this exact
 * patch applied. Built from what the tenant has, not from the baseline's version
 * of it, so a field the update does not submit stays as the tenant set it —
 * including one the tenant deliberately set differently. A patch that turns a
 * report-only policy on makes the target enabled too; nothing downstream may
 * read a target the submitted body contradicts.
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
 * The body without Graph's own reply annotations. An `@odata.context` is a URL
 * into the metadata of the tenant the object was *read* from — the author's —
 * and it carries that tenant's policy id in it: `…/policies('aeb49474-…')/`.
 * It is never part of a request, so it is nothing this tenant submits, and while
 * it stood in the body the author's own policy id was in the JSON tab, the
 * PowerShell and the download.
 *
 * `@odata.type` is not this: it is a type discriminator the request needs, and
 * task 021 put it back on purpose.
 */
function withoutResponseAnnotations(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(withoutResponseAnnotations)
  if (v === null || typeof v !== 'object') return v
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>)
      .filter(([k]) => !k.endsWith('@odata.context'))
      .map(([k, val]) => [k, withoutResponseAnnotations(val)]),
  )
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
  /**
   * Which member of the step each policy is (observation.ts `memberKeyOf`), from
   * the baseline's own key and never from position where a key exists. Deduped
   * within the step, because two members sharing one identity would be two
   * members sharing one history.
   */
  const memberKeys: string[] = []
  for (const [i, p] of policies.entries()) {
    let key = memberKeyOf(p.sourceKey ?? '', i)
    if (memberKeys.includes(key)) key = `${key}-${i}`
    memberKeys.push(key)
  }
  /**
   * The plan tag a created policy carries: the plan, the step, and *which member
   * of the step* this policy is. Without the last part both halves of a pair
   * carried one tag, and a search for it returned whichever came first — one
   * object standing for two required policies. `findTaggedPolicies` reads a tag
   * written before this too, which names no member.
   */
  const tagFor = (i: number): string => `[IAMAI:${planId}:${stepId}:${memberKeys[i]}]`
  /** One policy as the whole policy it is meant to be in this tenant. */
  const artifact = (source: RawPolicy, p: StepPolicyInput, tag: string): RawPolicy => {
    const body = withoutResponseAnnotations(structuredClone(source)) as RawPolicy
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
  /**
   * The author's own objects this tenant's copy of the policy does without: a
   * source reference this baseline's interpretation settles, with evidence, as
   * the author's own environment (resolvePolicy.ts `authorOnly`). Kept out of
   * `missing` because that settled reading has already said there is nothing to
   * go and do, and kept here rather than dropped because the policy this tenant
   * deploys is then not, in that one respect, the policy the author wrote.
   *
   * A source object nothing settles is not here. It is in `missing`, where it
   * holds the step, because a copy of a blocking policy without the author's
   * carve-out reaches people theirs did not and nobody can say who.
   */
  const authorOnly: string[] = []
  /** The references a person said this tenant needs no counterpart for (resolvePolicy.ts `omitted`). */
  const omitted: string[] = []
  /** The references only a person can answer that these policies name, and where each answer stands. */
  const sourceReferences = new Map<string, SourceReference>()
  const operations: PolicyOperation[] = []
  for (const [i, p] of policies.entries()) {
    const tag = tagFor(i)
    const memberKey = memberKeys[i]
    // The person's answers, applied as recorded deviations (deviations.ts) —
    // once, here. Where an answer changed the policy, the baseline's own version
    // travels with it so the step can show the choice beside it.
    const clone = structuredClone(p.resolved.body)
    const answered = applyDeviations(clone, goalId, mapping)
    const deviated = answered !== clone
    // Nothing is dropped silently: an object the tenant does not have comes back
    // in `missing`, and while any does there is no operation to run.
    const whole = implementable(artifact(answered, p, tag), p.resolved)
    // The approved absent-source assumption concerns the source export only.
    // It must not remove any exclusion already configured in this tenant.
    if (p.target?.policy && whole.omitted.length > 0) {
      const currentUsers = ((p.target.policy.conditions ?? {}) as RawPolicy).users as RawPolicy | undefined
      const nextUsers = ((whole.policy.conditions ?? {}) as RawPolicy).users as RawPolicy | undefined
      if (currentUsers && nextUsers) {
        for (const key of ['excludeGroups', 'excludeUsers', 'excludeRoles']) {
          nextUsers[key] = [...new Set([...(Array.isArray(nextUsers[key]) ? nextUsers[key] as string[] : []), ...(Array.isArray(currentUsers[key]) ? currentUsers[key] as string[] : [])])]
        }
        if (currentUsers.excludeGuestsOrExternalUsers && !nextUsers.excludeGuestsOrExternalUsers) nextUsers.excludeGuestsOrExternalUsers = structuredClone(currentUsers.excludeGuestsOrExternalUsers)
      }
    }
    for (const m of whole.missing) if (!missing.some((x) => x.token === m.token)) missing.push(m)
    for (const a of whole.authorOnly) if (!authorOnly.includes(a)) authorOnly.push(a)
    for (const o of whole.omitted) if (!omitted.includes(o)) omitted.push(o)
    // A reference one member still waits on is pending for the step, whatever another member made of the answer.
    for (const [id, d] of p.resolved.decisions ?? []) if (!sourceReferences.has(id) || (d.answer === 'pending' && sourceReferences.get(id)!.answer !== 'pending')) sourceReferences.set(id, { id, kind: d.kind, answer: d.answer })
    const wholeBaseline = deviated ? implementable(artifact(p.resolved.body, p, tag), p.resolved).policy : undefined
    const target = p.target ?? null
    if (target) {
      const patch = patchOf(whole.policy, sections)
      // The policy the change leaves behind: the tenant's own policy with this
      // patch applied. Read for explanation, impact and audit; never submitted.
      // Without the tenant's policy there is no complete target, and the whole
      // step is unavailable rather than described from a partial body.
      const current = target.policy
      const removes = current ? removedExclusions(current, patch) : undefined
      operations.push({
        ...(removes ? { removes } : {}),
        ...(!removes && addsExclusionsOnly(patch, current) ? { addsExclusionsOnly: true as const } : {}),
        sourceName: p.sourceName,
        memberKey,
        mode: 'update',
        policyId: target.policyId,
        body: patch,
        baseline: wholeBaseline ? patchOf(wholeBaseline, sections) : undefined,
        target: current ? withPatch(current, patch) : undefined,
        // The whole policy as the plan writes it, so a scan can read the deployed
        // object against every dimension the plan asked for and not only the
        // ones this patch writes (roadmap/tracking.ts, observation.ts).
        intent: whole.policy,
      })
    } else {
      operations.push({ sourceName: p.sourceName, memberKey, mode: 'create', policyId: null, body: whole.policy, baseline: wholeBaseline })
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
  return {
    kind,
    summary: [],
    json,
    portalSteps: [],
    missing,
    authorOnly,
    ...(omitted.length > 0 ? { omitted } : {}),
    ...(sourceReferences.size > 0 ? { sourceReferences: [...sourceReferences.values()] } : {}),
    resolution: { policies: operations, tenant: { exclusionsGroupId: null, serviceAccountsGroupId: null } },
  }
}

export { proposedPolicyName } from '../coverage/naming.ts'

/** The sections a partly-covered goal's policy has to change (roadmap-v2.md §4.6). */
function changedSections(result: GoalResult): Set<ChangedSection> {
  const sections = new Set(result.reasons.filter((r) => !r.expected).map((r) => CHANGED_SECTION[r.kind]).filter((x): x is ChangedSection => Boolean(x)))
  // A raised floor is raised where the goal asks: a stronger authentication for a
  // grant goal, a shorter sign-in frequency for a session goal (classify.ts
  // raiseFloor). A session raise listed as a grant change put "Grant controls" on
  // a step whose body carries no grant.
  if (result.floorRaised) sections.add(result.goal.implementations[0].floor.grant !== undefined ? 'grantControls' : 'sessionControls')
  return sections
}

/**
 * Whether an update turns the policy it updates on, and what else it changes
 * about it: facts about that policy, never about the goal's coverage.
 * `changedSections` reads the goal's reasons, and the goal's 'report-only'
 * reason counts people, not policies: the people an enforced policy reaches
 * drop out of it (coverage.ts), whatever that policy is. So once another
 * policy was switched on over the same people — a platform block with a
 * condition, a session-lifetime policy for the admins — the reason went,
 * 'state' went with it, and the update to the goal's own report-only policy
 * came out as `{}`. A patch with nothing in it is no operation: the step read
 * "no policy for IAMAI to write ... scan again to rebuild it", every scan
 * rebuilt the same `{}`, and the goal's MFA policy sat in report-only for good
 * (R4-11, Jordan D5).
 *
 * The update turns its policy on where that policy is in report-only and the
 * update changes nothing else about it. A report-only policy that still owes a
 * correction — its grant, its session, its users, its apps — takes the
 * correction first and stays in report-only, so what the window watches is what
 * would be enforced: the grant (gap 4, coverage.ts), and every dimension a
 * member must already hold before it can be ready to enforce (tracking.ts
 * `asPlanned`: "the next submission is the correction, not the switch"). The
 * switch is the update on the scan after, when the correction is in place. An
 * enforced policy has no state to change.
 *
 * And "changes nothing else" is read from that policy too. The goal's other
 * reasons come from the goal's other policies as well: an enforced all-users MFA
 * policy that excludes one application and lacks the exclusions group leads the
 * guests goal, its caveats are the goal's 'apps-excluded' and
 * 'exclusion-missing', and they became users and applications sections on the
 * update to the guests' own report-only pair — sections the pair already held
 * word for word. The update was a correction that changed nothing, it withheld
 * the switch for that correction, and every scan rebuilt the same one: the pair
 * sat in report-only for good behind a remedy that did nothing, R4-11 again. A
 * section the policy already holds (observation.ts `sameDimension`, the
 * comparison `unwrittenDifferences` makes of a deployed policy) is no
 * correction owed, and where nothing else is owed the update is the switch
 * alone.
 *
 * Also for a policy the goal reads below its floor (`belowFloor`, coverage's
 * `meetsFloor`) once it holds the grant the plan writes. It was held back: its
 * grant was the finding (gap 4), and the "correction" it kept was that same
 * grant, so the pinned baseline's admin policy, built exactly as written, was
 * handed its own grant on every scan and never the switch (R4-11 on the pin).
 * The pinned baseline wins (owner, 2026-09-22): it is turned on as written, and
 * the step states that its grant is weaker than the goal's floor
 * (Action.belowGoalFloor). A below-floor policy that does not yet hold the plan's
 * grant still takes the correction first.
 *
 * An enforced policy is read the same way, with no switch to offer: a section it
 * already holds is not submitted. It used to stay, and the update was a
 * correction that changed nothing. Token protection, enforced exactly as its
 * step asked (getiamai, small, large, the demo's second week), came back on
 * every scan as a Target resources patch identical to what the policy holds,
 * in lane Ready and handed over as work; large's device policy, once on, came
 * back as Office365 -> Office365, withheld behind a readiness tile about turning
 * on a policy that was already on. Where the policy holds everything the step
 * writes the update is empty, and the step says so (types.ts
 * `Action.nothingOwed`). Not where the step also creates a policy: an empty
 * update is no operation, and one invalid operation withholds the whole step's
 * (operations.ts `validOperations`), the create with it — so a pair with a half
 * still to create keeps the update it had.
 *
 * `built` is the action from these sections; `current` the tenant's own policy
 * under each update's id. True when the sections moved and the action has to be
 * built again from them.
 */
function settleSections(sections: Set<ChangedSection>, built: Action, current: ReadonlyMap<string, RawPolicy>, belowFloor: (policyId: string) => boolean): boolean {
  const before = [...sections].sort().join()
  const operations = built.resolution?.policies ?? []
  const updates = operations.flatMap((o) => {
    const held = o.mode === 'update' && typeof o.policyId === 'string' ? current.get(o.policyId) : undefined
    return held ? [{ id: o.policyId as string, body: o.body as RawPolicy, held }] : []
  })
  sections.delete('state')
  const owed = [...sections].filter((section) => {
    const at = SECTION_VALUE[section as Exclude<ChangedSection, 'state'>]
    return !(updates.length > 0 && updates.every((u) => sameDimension(at(u.body), at(u.held))))
  })
  const reportOnly = updates.some((u) => u.held.state === 'enabledForReportingButNotEnforced')
  const switchable = reportOnly
  if (owed.length === 0 && switchable) {
    sections.clear()
    sections.add('state')
  } else if (updates.length > 0 && !reportOnly && operations.every((o) => o.mode === 'update')) {
    for (const section of [...sections]) if (!owed.includes(section)) sections.delete(section)
  }
  return [...sections].sort().join() !== before
}

/** Where each section an update writes sits on a policy, for `settleSections`. */
const SECTION_VALUE: Record<Exclude<ChangedSection, 'state'>, (p: RawPolicy) => unknown> = {
  grantControls: (p) => p.grantControls,
  sessionControls: (p) => p.sessionControls,
  users: (p) => ((p.conditions ?? {}) as RawPolicy).users,
  applications: (p) => ((p.conditions ?? {}) as RawPolicy).applications,
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
  // The exclusions group as a safety-sensitive choice (Foundation C): what the
  // operator confirmed, whether this scan could read it, and therefore whether
  // any policy the plan writes may name it. Resolved once, here, so no branch
  // below reaches the stored record on its own.
  const exclusions = exclusionsGroupChoice({ snapshot, mapping, groups: input.groupMembers, directory: input.directory })
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
  // A display name two accounts share is told apart on every pre-baked string
  // too, by the same rule the name directory uses (names.ts personLabels).
  const personLabel = personLabels(snapshot.users)
  const nameOf = (id: string): string => {
    const u = userById.get(id)
    return personLabel.get(id) ?? u?.displayName ?? u?.userPrincipalName ?? id
  }
  const tenantName =
    ((snapshot.config.organization?.rows?.[0] ?? {}) as { displayName?: string }).displayName ?? 'your organisation'
  const steps: Step[] = []
  const popIndex = populationIndex(snapshot, viability)
  const contentIndexes = ringContextIndexes(snapshot)
  const rowsFor = (ids: string[]): MfaViability[] => ids.map((id) => viabilityById.get(id)).filter((v): v is MfaViability => v !== undefined)
  const expectedCache = new Map<string, string[]>()
  const goalAccountsCache = new Map<string, string[]>()
  const populationCache = new Map<string, StepPopulation>()
  const methodTargets = new Map<string, MethodTarget[]>()
  const readinessCache = new Map<string, Readiness>()
  // One readiness per family, over that family's canonical population (walk-51
  // item 8): the same number on every step of a kind, and on the campaign — all
  // people for MFA and devices, admins for admin, guests for guest. The goal
  // loop keys the cache by family, so these seeds are what every step of the
  // family reads; a family without a seed (block, risk, location) is usage, not
  // a readiness percentage, and its first goal fills the cache. `viability` is
  // the people already (scoring/fromSnapshot.ts over derive/sets.ts
  // personAccounts): a shared device or a confirmed emergency account is never
  // in a readiness denominator.
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
  // every account that is not a person (the confirmed emergency and service
  // accounts, a mailbox the licence shape gives away, sign-in blocked, and the
  // shared devices, which are out of every user policy and get their own step,
  // prompt 48 item 4), and the members of the confirmed exclusion groups
  // (roadmap-v2.md §7: a step never touches them). One boundary (derive/sets.ts
  // accountKinds over the plan's decisions): a shared mailbox has no MFA method
  // and never will (T12), and a nominated emergency account is a person until
  // the operator chooses it.
  const people = new Set(personAccounts(snapshot, notPeopleIds(mapping)).map((u) => u.id))
  const excluded = new Set<string>([...mapping.breakGlassUserIds, ...mapping.serviceAccountUserIds])
  for (const u of snapshot.users) if (!people.has(u.id)) excluded.add(u.id)
  // The people a zero has to be proved over: every active account in the tenant
  // that a proposed policy does not already exclude (roadmap/strand.ts
  // measuredReach). The tenant's own people, never a step's list of them.
  const activePeople = viability.filter((v) => v.activity === 'active' && !excluded.has(v.userId)).map((v) => v.userId)
  // The directory-sync account is out of the MFA and strength templates via excludeRoles in goals.json.
  const sharedDevices = mapping.sharedDeviceUserIds === undefined ? sharedDeviceUsers(snapshot) : snapshot.users.filter((u) => mapping.sharedDeviceUserIds!.includes(u.id) && u.accountEnabled !== false)
  const exclusionGroupIds = [exclusions.actionableId, mapping.serviceAccountsGroupId].filter((x): x is string => typeof x === 'string')
  for (const gid of exclusionGroupIds) for (const id of input.groupMembers?.get(gid)?.memberIds ?? []) excluded.add(id)

  const prereq = (id: string, title?: string): Step => ({
    id,
    goalId: id.replace(/^s-/, ''),
    phase: 0,
    kind: 'prerequisite',
    title: title ?? stepById[id]?.title ?? id,
    why: '',
    ...stateFields(),
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
  const selectedCountryLocationIds = Object.values(mapping.records).filter(r => r.group === 'namedLocations' && r.provenance !== 'auto' && r.resolvedId).map(r => r.resolvedId!)
  const countryLocation = tenantCountryLocation(snapshot, mapping.allowedCountries, selectedCountryLocationIds)
  const countriesLocationId = countryLocation?.id ?? null
  // The exclusions group's own checks, run here rather than with the rest of the
  // validation below, because the answer decides what the policies say and not
  // only what the plan asks somebody to fix. The report is the one built; the
  // blocker steps read this same object later.
  //
  // Two questions, kept apart (Foundation C, and validation/report.ts
  // exclusionGroupPolicySafety). `exclusions.actionableId` is an identity: the
  // group the operator confirmed and this scan read, which is what the checks
  // are *about* and what the step names. Whether it is safe to write into a
  // policy is the checks' answer, and a group missing an emergency account, one
  // holding somebody unapproved, one holding an administrator, one that is
  // dynamic, and one whose membership nothing read are all the same answer: no.
  // A policy that excluded such a group would carry the exclusions group's
  // promise while keeping none of it.
  const groupFacts = [...(input.groupMembers?.entries() ?? [])].map(([groupId, g]) => ({ groupId, ...g }))
  const validationCtx = buildContext({ snapshot, state: mapping, groupMembers: groupFacts, viability, drillDates: input.cleanupRecord?.drills ?? [], drillRecords: input.cleanupRecord?.records ?? [] })
  const exclusionGroupReport =
    exclusions.actionableId === null ? null : reportFor('exclusionGroup', [groupFacts.find((g) => g.groupId === exclusions.actionableId) ?? null], validationCtx)
  const policyUsableExclusionsGroupId = exclusionGroupPolicySafety(exclusionGroupReport).safe ? exclusions.actionableId : null
  // What this tenant's own authentication strengths allow, for every reading
  // that asks how strong a policy is.
  const tenantStrengths = strengthLookupOf(snapshot)
  // And what they demand *whole* — the combinations and the restrictions on
  // them — so the author's custom strength can find the tenant's own by what it
  // demands rather than by its id, which is the author's (resolvePolicy.ts
  // tenantStrengthFor).
  const tenantObjects = tenantObjectsOf(mapping, countriesLocationId, policyUsableExclusionsGroupId, tenantStrengthsOf(snapshot))
  /**
   * The resolved policy with its authentication strength as the request may
   * carry it: the tenant's id, and nothing that describes the object it points
   * at. A name and a list of allowed combinations are the tenant's own metadata
   * — read where the answer is needed (operations.ts strengthLookupOf, and the
   * portal's own name lookup) — and an author's description travelling beside a
   * remapped id would describe one object while the request names another.
   */
  const namedStrength = (resolved: ResolvedPolicy): ResolvedPolicy => {
    const grant = resolved.body.grantControls as { authenticationStrength?: { id?: unknown } } | null | undefined
    const strength = grant?.authenticationStrength
    if (!strength || typeof strength.id !== 'string') return resolved
    if (Object.keys(strength).length === 1) return resolved
    return { ...resolved, body: { ...resolved.body, grantControls: { ...grant, authenticationStrength: { id: strength.id } } } }
  }
  // What the tenant can prove beside the policy: who is in the exclusions group
  // (the plan's own rule — the emergency accounts are its members), which named
  // locations are country lists and which countries they hold, and what each
  // authentication strength allows. A policy is never judged by anything else
  // (roadmap/strand.ts StrandContext).
  // Who is in a group, where the scan read the whole group: a sampled list
  // proves somebody is a member and never that somebody is not, so it answers
  // nothing here.
  //
  // The exclusions group used to answer for itself — the emergency accounts
  // were taken as its members by the rule that puts them there. That is what the
  // plan intends the group to hold, not what a scan read of it, and it was
  // written in exactly the case where nothing had been read (Foundation C: a
  // group whose object exists and whose membership would not enumerate has
  // unknown members, and an unknown membership is not an empty one or an
  // assumed one). A policy's reach is measured from readings, so the group's
  // members are here when a scan read them and the reach is unknown when it
  // did not.
  const knownGroupMembers: Record<string, string[]> = {}
  for (const [gid, g] of input.groupMembers?.entries() ?? []) if (g.sampled !== true) knownGroupMembers[gid.toLowerCase()] = [...g.memberIds]
  const countryLocations: Record<string, string[]> = {}
  for (const raw of snapshot.config.namedLocations?.rows ?? []) {
    const l = raw as { id?: string; '@odata.type'?: string; countriesAndRegions?: unknown }
    if (typeof l.id === 'string' && String(l['@odata.type'] ?? '').includes('countryNamedLocation') && Array.isArray(l.countriesAndRegions))
      countryLocations[l.id.toLowerCase()] = l.countriesAndRegions.map((c) => String(c))
  }
  const strandContext = {
    allowedCountries: mapping.allowedCountries,
    countryLocations,
    strengths: tenantStrengths,
    groupMembers: knownGroupMembers,
  }
  const methodPreparationCache = createMethodPreparationCache(snapshot, strandContext)
  // ---- the rollout cohort (Foundation A) ----
  // Who a step's own policies *name*, read from their user scope and from
  // nothing else (roadmap/strand.ts scopeCohort): every account in the directory
  // the policy includes and does not exclude. The rings, the who-line, the names
  // and the announcement's audience are this; the population the goal handed the
  // step stays what it always was — a readiness fact about a goal — and answers
  // none of them for an open policy.
  //
  // The universe is the tenant's own directory, never a step's list of people: a
  // policy filed under a narrow goal that names everybody reaches everybody, and
  // a policy filed under a broad goal that names four admins reaches four admins.
  //
  // Null where the scope could not be settled. Nothing then falls back.
  //
  // The directory's accounts that can sign in, and no others (StepPopulation.ids:
  // "every enabled id in scope"). A policy reaches nobody through a disabled
  // account: it is no ring member, no name an announcement greets, and not in
  // "covers N enabled", which read every account the scope named, nine of them
  // disabled, as enabled.
  const directoryIds = snapshot.users.filter((u) => popIndex.enabled.has(u.id)).map((u) => u.id)
  // One answer per distinct scope, and one array behind it: steps whose policies
  // name the same people share the cohort, so the ring partition is computed once
  // for them (rings.ts partitionCache) instead of once per step.
  const cohortCache = new Map<string, StepPopulation | null>()
  const cohortFor = (effects: PolicyEffect[]): StepPopulation | null => {
    const key = JSON.stringify(effects.map((e) => [e.scope, e.unknown.length > 0]))
    if (!cohortCache.has(key)) {
      const ids = scopeCohort(effects, directoryIds, snapshot, strandContext)
      cohortCache.set(key, ids === null ? null : population(ids, popIndex))
    }
    return cohortCache.get(key) ?? null
  }
  const exclusionsGroupId = tenantObjects.exclusionsGroupId
  const existingNames = new Set((snapshot.config.caPolicies?.rows ?? []).map((p) => String((p as RawPolicy).displayName ?? '').trim().toLowerCase()).filter(Boolean))
  const proposedTaken = new Set<string>()
  /** The names of the policies this plan tagged for one step, lower-cased. */
  const taggedNamesFor = (stepId: string): Set<string> => {
    const rows = (snapshot.config.caPolicies?.rows ?? []) as RawPolicy[]
    const ids = new Set(findTaggedPolicies(snapshot, planId, stepId).map((tag) => tag.policyId))
    return new Set(rows.filter((p) => ids.has(String(p.id))).map((p) => String(p.displayName ?? '').trim().toLowerCase()).filter(Boolean))
  }
  /**
   * The tenant-convention name, suffixed when a policy of that name already
   * exists; the note explains.
   *
   * A policy this plan tagged for THIS step is not somebody else's name to
   * avoid: it is the step's own. A tenant IAMAI had planned before arrived with
   * that policy switched off, which is not a live policy the step can claim, so
   * the step proposed a create — and suffixed it around its own policy, telling
   * the operator to build "Core - Block - Device code flow (2)" beside "Core -
   * Block - Device code flow". Two policies then carried the tag for one step,
   * which is a state the step can never finish from.
   */
  const uniqueName = (goal: Goal, stepId: string): { name: string; note: string | null } => {
    const base = proposedPolicyName(goal, naming)
    const mine = taggedNamesFor(stepId)
    const taken = (name: string): boolean => (existingNames.has(name) && !mine.has(name)) || proposedTaken.has(name)
    if (!taken(base.toLowerCase())) {
      proposedTaken.add(base.toLowerCase())
      return { name: base, note: null }
    }
    let n = 2
    while (taken(`${base} (${n})`.toLowerCase())) n += 1
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
  // Each carries the package it came from, which its references, readings and
  // strengths are resolved against: the running package, or the pinned one for a
  // goal the running package carries no policy for (`sourcesFor`, q-pin).
  const baselineFactsList: { key: string; policy: RawPolicy; facts: ReturnType<typeof policyFacts>; authors: readonly CaPolicy[]; standIn?: true }[] = input.baseline.policies.map((p) => ({
    key: policyKey(p),
    policy: p as unknown as RawPolicy,
    facts: policyFacts(p, input.strengths),
    authors: input.baseline.policies,
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
  // baseline). The fallback below exists only for a package the map does not
  // describe — a synthetic fixture that carries the goal's policy under a key
  // the map does not name.
  const mapDescribesPackage = Object.values(goalMap).flat().some((k) => factsByKey.has(k))
  const standInsByGoal = new Map<string, (typeof baselineFactsList)[number][]>()
  const sourcesFor = (goal: Goal): typeof baselineFactsList => {
    // The active baseline not holding the goal is the whole answer: it has no
    // source, whatever a signature would match. Otherwise the floor's step —
    // the one kind of step that renders a goal the baseline lacks — could say
    // "Microsoft recommended, not in this baseline" over a body taken from that
    // very baseline: the signature match the pin-time rule rejected (the
    // risky-users block for registration), or, for a map with no key resolving
    // into the package at all, any broadly matching policy in it. An absent
    // goal renders Microsoft's own template or it does not render.
    if (!inBaseline(goal)) return []
    const mapped = (goalMap[goal.id] ?? []).map((k) => factsByKey.get(k)).filter((b): b is (typeof baselineFactsList)[number] => b !== undefined)
    if (mapped.length > 0) return mapped
    const matched = mapDescribesPackage ? [] : baselineMatchesFor(goal)
    if (matched.length > 0) return matched
    // A goal the map holds and the package carries no policy for is written from
    // the pinned policy the map names, through the same translator, and never
    // from the goal's own template (goalMap.ts pinnedSource, q-pin).
    const known = standInsByGoal.get(goal.id)
    if (known) return known
    const pinned = pinnedSource(input.baseline.policies)
    const found = policiesForGoal(goalMap, pinned, goal.id).map((p) => ({ key: policyKey(p), policy: p as unknown as RawPolicy, facts: policyFacts(p, input.strengths), authors: pinned, standIn: true as const }))
    standInsByGoal.set(goal.id, found)
    return found
  }
  // The policies this run plans from: the package's, and the pinned ones that
  // stand in for a goal it carries no policy for. What the plan requires of the
  // tenant (a strength), what it asks about (a source reference) and where a
  // source contradicts itself are read from these, so a stand-in is planned by
  // the same rules as the package's own.
  const standIns = [...new Map(input.coverage.results.flatMap((r) => sourcesFor(r.goal)).filter((s) => s.standIn).map((s) => [s.key, s.policy as unknown as CaPolicy])).values()]
  const planPolicies: readonly CaPolicy[] = standIns.length > 0 ? [...input.baseline.policies, ...standIns] : input.baseline.policies
  // Read once, from the map *and the package* this run is planning against
  // (baselineConflict.ts): the conflict belongs to the source policy the active
  // baseline hands the goal, and to what that policy still says about itself. An
  // uploaded baseline is judged by its own map and its own policies, never by
  // the pin — and a revised version of a reviewed policy that settles the
  // contradiction is planned like any other.
  const conflictGoals = baselineConflicts(goalMap, { policies: planPolicies, docs: input.baseline.docs })
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
  const recognisedGroupId = exclusions.actionableId
  if (canUseConditionalAccess) {
    const proposed = proposedObjectNames(naming).exclusionsGroup
    steps.push({ ...prereq(geStepId), naming: { proposed: proposed.name, fromBaseline: null } })
  }
  // The trusted network is a step on every plan, never removed: Ready with its
  // create instructions while the tenant has no IP named location, In place once
  // one exists (the picker says which of them are the team's own).
  //
  // It is the DOING of the office-network answer (Decide How and Where People
  // Sign In since Stage 3), and it says so: direction.ts ANSWERED_IN swaps its
  // decision control for the "Answered in" panel. So it does not ask the
  // question again. Until that answer is saved this step's tile used to read
  // "Trusted Network: Choose your office networks", with the detail "Select your
  // office networks or confirm that everyone is remote" — word for word the
  // question D4 asks, on a second row of the board
  // (docs/plans/step-redundancy-analysis.md finding 2, the owner's own example).
  // Now nothing is drawn there: the panel above it is the step's statement, and
  // the one thing the tile has to add — a network the scan drafted, waiting to be
  // created — is still drawn, because that is work and not a question.
  const locStepId = PREREQ_STEP_ID.trustedLocation
  if (canUseConditionalAccess) {
    const ipLocations = (snapshot.config.namedLocations?.rows ?? [])
      .map((l) => l as { id?: string; displayName?: string; isTrusted?: boolean; '@odata.type'?: string })
      .filter((l) => String(l['@odata.type'] ?? '').includes('ipNamedLocation') && l.isTrusted === true && mapping.trustedLocationIds.includes(l.id ?? ''))
    // Every trusted IP named location the scan read, selected or not. A tenant
    // whose answer is "everyone works remotely" still has whatever its
    // directory holds, and the tile said only "No office network is selected" —
    // so a tenant carrying a trusted "Head office" read Completed beside a
    // sentence that sounded like a reading of the tenant and was a reading of
    // the answer. The answer still decides (decisions capture intent); the
    // evidence stands beside it.
    const trustedInTenant = (snapshot.config.namedLocations?.rows ?? [])
      .map((l) => l as { id?: string; displayName?: string; isTrusted?: boolean; '@odata.type'?: string })
      .filter((l) => String(l['@odata.type'] ?? '').includes('ipNamedLocation') && l.isTrusted === true)
      .map((l) => (l.displayName ?? l.id ?? '').split(/\s+/).join(' ').trim())
      .filter((n) => n.length > 0)
    const proposed = proposedObjectNames(naming).trustedLocation
    const networkDraft = networkDraftOf(mapping)
    const networkConfirmed = mapping.wizardAnswered.trustedLocations === true && mapping.assumed?.trustedLocations !== 'detected'
    const networkRead = snapshot.config.namedLocations?.status === 'ok'
    // In place names the locations that make it so: the evidence a done step carries.
    steps.push({
      ...prereq(locStepId),
      naming: { proposed: networkDraft?.name ?? proposed.name, fromBaseline: null },
      configurationFindings: networkRead && !networkConfirmed && !networkDraft ? [] : [{ key: 'trusted-network-choice', label: 'Trusted Network', value: !networkRead ? 'Locations not read' : !networkConfirmed ? 'Create the saved network' : mapping.trustedLocationIds.length === 0 ? 'Everyone is remote' : ipLocations.length === mapping.trustedLocationIds.length ? 'Confirmed locations found' : 'Selected location needs correction', detail: networkDraft && !networkConfirmed ? `${networkDraft.name}: ${networkDraft.ranges.join(', ')}. Create this IP named location in Entra, mark it trusted, then scan again and select it.` : !networkRead ? 'The named-location scan must succeed before IAMAI can verify the selected networks.' : mapping.trustedLocationIds.length === 0 ? `No office network is selected; location-based exceptions are not applied.${trustedInTenant.length > 0 ? ` The scan read ${trustedInTenant.length === 1 ? 'a trusted named location' : `${trustedInTenant.length} trusted named locations`} this answer leaves out: ${trustedInTenant.join(', ')}.` : ''}` : 'Each selected location must exist as a trusted IP named location in the scan.', outcome: !networkRead ? 'unknown' : networkConfirmed && (mapping.trustedLocationIds.length === 0 || ipLocations.length === mapping.trustedLocationIds.length) ? 'pass' : 'fail' }],
      // A tenant that already has an IP named location is preserving one, not making one.
      ...stateFields(snapshot.config.namedLocations?.status === 'ok' && mapping.wizardAnswered.trustedLocations === true && mapping.assumed?.trustedLocations !== 'detected' && (mapping.trustedLocationIds.length === 0 || ipLocations.length === mapping.trustedLocationIds.length) ? { satisfied: true, inPlace: true } : {}),
      deliveredBy: ipLocations.map((l) => l.displayName ?? l.id ?? '').filter((n) => n.length > 0),
    })
    // Everyone works remotely: there is no network to define, so the step does
    // not apply (V1 decision 6), with the answer as its reason. It was Completed,
    // a row claiming work nobody did. The policies that read a trusted location
    // treat it as done (below: rule 1 and the named dependencies), so a remote
    // tenant keeps every hold it had and waits on nothing that does not apply.
    // Only the person's own saved answer says remote; nothing assumes it.
    if (networkConfirmed && mapping.trustedLocationIds.length === 0) {
      const network = steps[steps.length - 1]
      network.doesntApply = directionWords.questions.officeNetwork.options.remote
      setState(network, { setAside: true, satisfied: false, inPlace: false })
    }
  }

  // The baseline's own authentication strength (task 022 correction). Jon Hope's
  // policies require a custom strength of their tenant's — "Modern MFA + TAP" —
  // and its id is theirs: it does not exist in the tenant reading this, so a
  // policy naming it cannot be created here. The strength is answered by a
  // tenant strength allowing exactly the same combinations, which is the same
  // requirement under another name (resolvePolicy.ts); where none does, this is
  // the step that makes one, and the policies that require it wait on it.
  const strengthStepId = PREREQ_STEP_ID.authStrength
  const strengthsUnanswered = canUseConditionalAccess ? unmatchedStrengths(planPolicies, tenantObjects) : []
  const requiredStrengths = canUseConditionalAccess ? unmatchedStrengths(planPolicies, { ...tenantObjects, strengths: new Map(), confirmed: new Map() }) : []
  if (requiredStrengths.length > 0) {
    // The author's own name for it, which is what the step's words call it: the
    // strength this tenant is being asked to make is the baseline's, not one of
    // ours to rename.
    const name = requiredStrengths.map((x) => x.name).find((n): n is string => typeof n === 'string' && n.trim() !== '') ?? null
    const s = name ? { ...prereq(strengthStepId), naming: { proposed: name, fromBaseline: name } } : prereq(strengthStepId)
    s.authenticationStrengthTarget = { allowedCombinations: requiredStrengths[0].allowedCombinations }
    const strengthRead = snapshot.config.authStrengths?.status === 'ok'
    s.configurationFindings = [{ key: 'authentication-strength', label: 'Authentication Strength', value: !strengthRead ? 'Configuration not read' : strengthsUnanswered.length ? 'Matching strength missing' : 'Exact match found', detail: !strengthRead ? 'The scan did not read authentication strengths. Scan again to compare the allowed methods and model restrictions.' : strengthsUnanswered.length ? `No scanned strength matches all required method combinations and restrictions. Create ${name || 'the required strength'} using the instructions below, then scan again.` : 'A scanned strength matches the baseline’s allowed method combinations and restrictions. IAMAI uses that existing object automatically.', outcome: !strengthRead ? 'unknown' : strengthsUnanswered.length ? 'fail' : 'pass' }]
    if (strengthsUnanswered.length === 0 && strengthRead) {
      setState(s, { satisfied: true, inPlace: true })
      s.deliveredBy = ['Scanned authentication strengths match the resolved baseline method combinations and restrictions.']
    }
    steps.push(s)
  }

  // Allowed countries (prompt 16 §4): the named location is created unless the
  // tenant already has one with exactly that list.
  //
  // It is not a step of the plan (roadmap-flow Stage 3, V1 decision 5): Block
  // Sign-ins From Countries Not Allowed is its only reader, and makes it as its
  // own task — pick the work countries, create or correct the location, create
  // the policy in report-only, turn it on. The reading is built here exactly as
  // the location step's was, and handed to that step below (Step.objectTask),
  // which draws it with the location's own content, package and picker.
  const countriesStepId = PREREQ_STEP_ID.allowedCountries
  let countriesTask: Step | null = null
  if (canUseConditionalAccess && input.coverage.results.some((r) => r.goal.id === 'geo-restriction' && r.status !== 'licence-limited')) {
    const proposed = proposedObjectNames(naming).allowedCountries
    const needsWorkCountryReview = mapping.workCountriesConfirmed !== true && travelCountriesOf(mapping).some(country => mapping.allowedCountries.includes(country))
    const matched = !needsWorkCountryReview && mapping.wizardAnswered.countries === true && mapping.allowedCountries.length > 0 && snapshot.config.namedLocations?.status === 'ok' && countryLocation !== null
    const s = { ...prereq(countriesStepId), ...stateFields(matched ? { satisfied: true, inPlace: true } : {}), naming: { proposed: proposed.name, fromBaseline: null } }
    if (matched) s.deliveredBy = [`A scanned countries location matches the confirmed Work Countries: ${mapping.allowedCountries.join(', ')}.`]
    if (needsWorkCountryReview) {
      s.blockers = [{ kind: 'decision', label: 'work-countries-review', binding: 'Confirm Work Countries: this older plan combined work and travel countries.' }]
      setState(s, { condition: 'needs-decision' })
    }
    countriesTask = s
  }
  // Confirmed service accounts with no group holding them (prompt 16 §3).
  const saStepId = PREREQ_STEP_ID.serviceAccountsGroup
  if (canUseConditionalAccess && (mapping.serviceAccountUserIds.length > 0 || mapping.wizardAnswered.serviceAccounts === true)) {
    const proposed = proposedObjectNames(naming).serviceAccountsGroup
    const members = mapping.serviceAccountsGroupId ? input.groupMembers?.get(mapping.serviceAccountsGroupId) : null
    const matched = !!members && !members.sampled && new Set(members.memberIds).size === new Set(mapping.serviceAccountUserIds).size && mapping.serviceAccountUserIds.every((id) => members.memberIds.includes(id))
    const step = { ...prereq(saStepId), ...stateFields(matched ? { satisfied: true, inPlace: true } : {}), naming: { proposed: proposed.name, fromBaseline: null }, deliveredBy: matched ? ['The scanned group includes exactly the selected service accounts.'] : [] }
    if (mapping.serviceAccountUserIds.length === 0) {
      step.doesntApply = 'No service accounts are selected. No group or group protection is claimed.'
      setState(step, { setAside: true, satisfied: false, inPlace: false })
    }
    steps.push(step)
  }

  // Wave 0: the accounts nobody signs in to (target-state §8.1, prompt 46
  // item 8). Not a denominator anywhere, and not a reason to wait — nothing
  // can lock out an account nobody uses. The risk is the other way round:
  // whoever signs in first registers the MFA method. Present only while there
  // is somebody to decide on; done when the count reaches 0 on re-scan.
  //
  // On every plan, not only where Conditional Access can exist: an account
  // nobody signs in to is directory hygiene, and the free-tier ladder's
  // stale-accounts rung was this same step under a second id
  // (docs/plans/step-redundancy-analysis.md finding 9). The ladder covers it
  // from here now (ladder.ts COVERED_BY_STEP), keeping its own position.
  const dormant = notActiveUsers(snapshot, snapshot.asOf, notPeopleIds(mapping))
  {
    const s = prereq('s-check-dormant-accounts')
    s.kind = 'check'
    s.action = { ...s.action, kind: 'check' }
    // The dormant step is the one place never-signed-in accounts are a population (§8.1): it names them, though none are active.
    s.population = namedAccounts(dormant.map((u) => u.id), popIndex)
    if (dormant.length === 0 && snapshot.sources.users?.status === 'ok') setState(s, { satisfied: true, inPlace: true })
    steps.push(s)
  }

  // Separate admin accounts (E6): a directory-role holder who also reads mail or
  // joins Teams on the same account. A Preparation check step, skippable, only
  // while somebody does; the admin policies name the same people beside it.
  // On every plan, for the same reason as the dormant check above: the ladder's
  // admin-accounts-separate rung was this step under a second id, with the same
  // Completion Criteria word for word (finding 9).
  const adminsWithWorkload = adminsWithWorkloadOf(snapshot, new Set(mapping.breakGlassUserIds)).map(([id]) => id)
  {
    const s = prereq(SEPARATE_ADMIN_ACCOUNTS_STEP_ID)
    s.kind = 'check'
    s.action = { ...s.action, kind: 'check' }
    s.population = population(adminsWithWorkload, popIndex)
    if (adminsWithWorkload.length === 0 && snapshot.scenarioEvidence?.officeSignIns && snapshot.sources.signInEvidence?.status === 'ok' && snapshot.config.roleAssignments?.status === 'ok') {
      setState(s, { satisfied: true, inPlace: true })
      s.deliveredBy = ['The scanned directory-role holders have no Outlook or Teams activity in the collected sign-in window.']
    }
    steps.push(s)
  }

  // Shared devices, their own policy (prompt 48 item 4).
  if (canUseConditionalAccess && (sharedDevices.length > 0 || mapping.sharedDeviceUserIds !== undefined || input.manualConfirmations?.['s-shared-devices'])) {
    const step = prereq('s-shared-devices')
    // Its own policy, named in the tenant's convention (the baseline holds none; the step's instructions create it).
    step.naming = { proposed: proposedName({ prefix: 'CA', rest: ['Block', 'Shared devices outside trusted networks'], collapsed: 'Block shared devices outside trusted networks' }, naming).name, fromBaseline: null }
    step.population = namedAccounts(sharedDevices.map((u) => u.id), popIndex)
    if (sharedDevices.length === 0 && snapshot.sources.users?.status === 'ok') {
      step.doesntApply = (mapping.sharedDeviceUserIds?.length ?? 0) > 0 ? 'The selected shared accounts are no longer enabled in the directory. Previous test records remain history.' : 'No shared accounts are selected. No shared-device policy protection is claimed.'
      setState(step, { setAside: true, satisfied: false, inPlace: false })
      step.configurationFindings = [{ key: 'sharedAccounts', label: 'Shared Accounts', value: 'No active selected accounts', detail: step.doesntApply, outcome: 'pass' }]
    }
    steps.push(step)
  }

  // The device decision (E2) is Define Your Rollout Scope's D3
  // (roadmap/direction.ts): always asked with Conditional Access, never hidden
  // on evidence, and the device steps wait on its answers (gateOnDirection).

  // Passkey settings (A5, RUN-CONTEXT-A decision 9): the authentication-method
  // foundation the verification campaign and the phishing-resistant enforcements
  // wait on (actionability/dependency-data.json). A foundation like the exclusions
  // group: on every plan that can hold Conditional Access, In place when the
  // tenant's Fido2 configuration matches the target in every field, otherwise
  // Ready. A methods policy the scan could not read holds the step on that fact;
  // an unread configuration is never a match.
  if (canUseConditionalAccess) {
    const s = prereq(PASSKEY_SETTINGS_STEP_ID)
    const passkey = passkeyReadingOf(snapshot, mapping)
    s.configurationFindings = journeyPasskeyFindings(snapshot, mapping, input.groupMembers)
    s.readiness.lines = s.configurationFindings.map(f => `${f.label}: ${f.value}.`)
    // Impact (rowWho.ts): the plan's active people the passkey policy lets
    // register once this step is done, under the target it sets, or the
    // tenant's own targets where it resolves none. Guests register in their
    // home tenant. A target whose membership was not read counts nobody it names.
    const registering = passkey.resolution?.kind === 'target' ? passkey.resolution.target : passkey.current ?? PASSKEY_TARGET
    const registrant = (id: string): boolean => userById.get(id)?.userType !== 'guest' && passkeyTargetsReach(registering.includeTargets, id, input.groupMembers ?? new Map()) === true && passkeyTargetsReach(registering.excludeTargets ?? [], id, input.groupMembers ?? new Map()) === false
    s.impactCount = campaignIds(viability, snapshot, mapping).filter(registrant).length
    if (passkey.state === 'inPlace') setState(s, { satisfied: true, inPlace: true })
    else if (passkey.state === 'unread') {
      s.blockers = [{ kind: 'evidence', label: 'passkey-settings-unread', binding: BLOCKED_REASON.methodsPolicyUnread, unverified: true }]
      setState(s, { condition: conditionFor(s.blockers) })
    } else if (passkey.resolution?.kind === 'review') {
      // No change can be built without overwriting something (owner approval,
      // 2026-09-14): a profile-based policy, a block list that blocks Authenticator,
      // or a read short of a setting. The step holds on that fact, like an unread
      // policy, and is never completed by it.
      const review = passkey.resolution.review
      const binding = passkeyReadinessFindingsOf(snapshot, mapping).filter(f => f.outcome !== 'pass').slice(0, 1).map(f => `${f.label}: ${f.value}`).join('') || (review === 'profiles' ? BLOCKED_REASON.passkeyProfiles : review === 'blockListConflict' ? BLOCKED_REASON.passkeyBlockConflict : BLOCKED_REASON.passkeyPartialRead)
      s.blockers = [{ kind: 'evidence', label: `passkey-settings-${review}`, binding, unverified: true }]
      setState(s, { condition: conditionFor(s.blockers) })
    }
    steps.push(s)
  }
  // The operator's own passkey (A5): only where the scan read the signed-in
  // account's methods and found no passkey. Their account makes every change, so
  // the admin policies reach it first.
  const operatorPasskey = operatorPasskeyOf(snapshot)
  if (canUseConditionalAccess && operatorPasskey !== null) {
    const s = prereq(OPERATOR_PASSKEY_STEP_ID)
    s.kind = 'check'
    s.action = { ...s.action, kind: 'check' }
    s.population = population([operatorPasskey.operatorId], popIndex)
    if (operatorPasskey.holds && isReady(viability.find(v => v.userId === operatorPasskey.operatorId)?.readiness.state ?? 'unknown')) setState(s, { satisfied: true, inPlace: true })
    steps.push(s)
  }

  // The questions the operator can answer (prompt 48 item 10) are read from
  // their stored answers, questionAnswers[stepId:label] (answers.ts). None of
  // them adds a step of its own any more: an answer changes the step it is
  // asked on (docs/plans/step-redundancy-analysis.md findings 4, 5 and 6).
  // Unanswered, the plan proceeds on the evidence and the affected step carries
  // the can't-see line.

  const secDefaults = (snapshot.config.securityDefaults?.rows?.[0] ?? null) as { isEnabled?: boolean } | null
  // Nothing can take security defaults' place without Conditional Access, so
  // turning them off is never the advice: the ladder asks for them instead.
  if (canUseConditionalAccess) {
    const s = prereq('s-prereq-security-defaults')
    if (snapshot.config.securityDefaults?.status === 'ok' && secDefaults?.isEnabled === false) {
      // Off, and no scan of this plan ever read them on: there was nothing to
      // turn off, so the row does not claim the work as Completed (V1 decision
      // 6); it sits in the footer as every Doesn't apply step does. Nothing is
      // held behind it: rule 3 below reads the scan, not this step, and the
      // sd-enabled edges resolve not applicable (graphConditions.ts).
      if (!input.securityDefaultsSeenOnAt) {
        s.doesntApply = app.plan.securityDefaultsNeverOn
        s.doesntApplyByScan = true
        setState(s, { setAside: true })
      } else {
        setState(s, { satisfied: true, inPlace: true })
        s.deliveredBy = ['Security Defaults is disabled in the scanned tenant configuration.']
      }
    } else if (snapshot.config.securityDefaults?.status === 'ok' && secDefaults?.isEnabled === true) {
      // The invariant this step owns, checked against what the tenant actually
      // holds. The plan says it in its own voice — "nothing in this plan
      // enforces before this step" — and a reader enforced eight policies with
      // security defaults still on, swept all thirty-three steps, and found no
      // warning anywhere: the board read Completed and the tile said "IAMAI
      // watched it get there." The step that states the rule is the one place
      // that has to notice it has been broken.
      const enforced = ((snapshot.config.caPolicies?.rows ?? []) as { state?: string }[]).filter((p) => p.state === 'enabled').length
      if (enforced > 0) s.readiness.lines = [fillText(app.plan.securityDefaultsCoexist, { n: enforced }), ...s.readiness.lines]
    }
    steps.push(s)
  }
  // Per-user MFA still on (migration not complete): a conflict named up front (roadmap-v2.md §7, messy).
  // Built only when needed (v2-research/peruser.md): a clean read — every
  // account's per-user state read, none Enabled or Enforced — has nothing for
  // the step to do, the way the service-accounts group step is built only when
  // its condition holds. An absent reading, an unknown account or a partial
  // Users read keeps it: unknown is never hidden (manualWork.ts perUserMfaReading).
  const methodsPolicy = (snapshot.config.authMethodsPolicy?.rows?.[0] ?? null) as { policyMigrationState?: string } | null
  if (canUseConditionalAccess && !perUserMfaReading(snapshot).clean) {
    const s = prereq('s-prereq-per-user-mfa')
    s.readiness.lines = [`Authentication methods migration: ${methodsPolicy?.policyMigrationState ?? 'not read'}. Legacy per-user MFA states require a separate check in Entra.`]
    steps.push(s)
  }

  // ---- The free-tier ladder (SPEC §12): the plan spine when no policy can exist ----
  // Every catalogue goal is licence-limited without Entra ID P1, so the ladder
  // is what this tenant can actually do; a phase 0 step that already covers a
  // ladder item keeps the item's place rather than being duplicated.
  const ladderOrder = new Map<string, number>()
  // Entra ID P1 is the minimum this tool works at (owner, 2026-09-20). Without it
  // no Conditional Access policy can exist, so no plan is offered: a half-baked
  // opinion is worse than none, and ten hardening steps presented as "the plan"
  // read as the product's answer to a question it cannot answer here.
  //
  // The free-tier ladder is kept, dormant, behind this one constant — the owner
  // wants to compare it later, not delete it now. Re-enabling is this line.
  if (!canUseConditionalAccess && FREE_TIER_LADDER) {
    const ladder = ladderSteps(snapshot, mapping, steps.map((s) => s.id), { groupMembers: knownGroupMembers }, popIndex)
    steps.push(...ladder.steps)
    for (const [id, index] of ladder.order) ladderOrder.set(id, index)
  }

  // ---- Validation blockers (validation-rules.md §2): the escape hatch first ----
  // Every must-fix check that has not passed becomes a Phase 0 step, and the
  // two subjects a recovery depends on hold every step that can deny access.
  const validationReports: SubjectReport[] = [breakGlassReport(validationCtx)]
  if (exclusionGroupReport !== null) validationReports.push(exclusionGroupReport)
  const trustedLocations = (snapshot.config.namedLocations?.rows ?? []).filter((l) => mapping.trustedLocationIds.includes(String((l as { id?: string }).id ?? '')))
  if (trustedLocations.length > 0) validationReports.push(reportFor('trustedLocation', trustedLocations, validationCtx))
  // Only when a country restriction is actually planned: the list is checked
  // because a policy is about to use it, never as housekeeping.
  const geoPlanned = input.coverage.results.some((r) => r.goal.id === 'geo-restriction' && r.status !== 'not-applicable' && r.status !== 'licence-limited')
  if (geoPlanned && mapping.wizardAnswered.countries === true) {
    validationReports.push(reportFor('allowedCountries', [countryLocation], validationCtx))
  }
  if (mapping.serviceAccountUserIds.length > 0) validationReports.push(reportFor('serviceAccount', [''], validationCtx))
  // The exclusions group's checks sit on its own step. In place when the
  // recognised group is there and *every* blocking check on it has passed; while
  // no group is recognised the step that creates it holds everything that can
  // deny access.
  //
  // One check used to decide this — the group being excluded from every policy —
  // and the other four did not. So a group holding an unapproved member, a group
  // holding an administrator, a dynamic group, and a group whose membership
  // nothing could read all reached In place, which cleared the gate below and
  // released every policy the escape hatch was supposed to hold. The report is
  // the authority on whether the checks passed; the step's word is a projection
  // of it, and a projection may not answer back.
  const geReport = validationReports.find((r) => r.subject === 'exclusionGroup')
  const geStep = steps.find((s) => s.id === geStepId)
  if (geStep && geReport) {
    geStep.checks = stepChecks(geReport)
    if (recognisedGroupId !== null && geReport.blocking.length === 0) {
      setState(geStep, { satisfied: true, inPlace: true })
      geStep.deliveredBy = [recognisedGroupId]
    }
  }
  // The step that *holds* the decision says it is waiting on one (Foundation C,
  // mapping/safetyChoice.ts `awaitsOperator`).
  //
  // Every step that waits on this group already read Blocked. The step where the
  // question is actually answered read Healthy · Ready, with "Make the object
  // this step names." as its next action and "The policy exists in {tenant} in
  // report-only" as its Done-when — a step that deploys no policy, telling an
  // operator to build a second exclusions group while two of the tenant's own
  // qualify and IAMAI is waiting on which. There is no `satisfied` guard needed
  // above it: a choice that resolved is not one anybody is waiting on, and
  // `awaitsOperator` says so.
  //
  // The condition comes from Foundation B's own `conditionFor`, so the state,
  // the word (In place · Ready · Needs decision · Blocked), the next milestone
  // and the Step Contract's action and Done-when are all one reading. Nothing
  // here writes a status.
  if (geStep && awaitsOperator(exclusions)) {
    geStep.blockers = [...geStep.blockers, { kind: 'decision', label: 'exclusions-decision', binding: BLOCKED_REASON.exclusionsGroup }]
    setState(geStep, { condition: conditionFor(geStep.blockers) })
  }
  const bgReport = validationReports.find((r) => r.subject === 'breakGlass')
  const bgStep = steps.find((s) => s.id === bgStepId)
  const recoveryBasis = recoveryAccountBasis(snapshot, mapping.breakGlassUserIds, mapping, input.groupMembers)
  const recoveryCandidateSetBasis = Object.fromEntries(mapping.breakGlassUserIds.flatMap(id => {
    const candidateSet = recoveryPasskeyCandidateSet(snapshot, id, mapping, input.groupMembers)
    return candidateSet.state === 'complete' ? [[id, JSON.stringify([...candidateSet.ids].sort())]] : []
  }))
  let bgStanding: EmergencyStanding | null = null
  let bgAccountStanding: EmergencyStanding | null = null
  if (bgStep && bgReport) {
    const confirmed = mapping.breakGlassUserIds.length
    const accountReport = { ...bgReport, targets: bgReport.targets.map(target => ({ ...target, results: target.results.filter(result => EMERGENCY_ACCOUNT_RULES.has(result.id)) })) }
    bgStep.checks = stepChecks(accountReport, confirmed)
    // Two tiers (owner, 2026-09-11): the minimum safety checks hold the rollout
    // and nothing defers them; the hardening holds it until it is fixed or the
    // operator defers it, and a deferral moves it to Cleanup (below).
    bgStanding = emergencyStanding(bgReport, confirmed)
    const accountStanding = emergencyAccountStandingForStep(bgReport, confirmed)
    bgAccountStanding = accountStanding
    bgStep.emergency = {
      minimum: accountStanding.minimum.length,
      hardening: accountStanding.hardening.length,
      basis: hardeningBasis(accountStanding.hardening),
      deferredAt: hardeningDeferred(accountStanding.hardening, input.hardeningDeferral) ? (input.hardeningDeferral?.at ?? null) : null,
      // Each confirmed account's own evidence, never another's or the set's.
      accounts: emergencyAccountStanding(bgReport, mapping.breakGlassUserIds),
    }
    const preparation = emergencyAccountPreparationOf(snapshot, mapping, input.groupMembers)
    const preparedAccounts = emergencyAccountPreparationComplete(preparation)
    const results = bgReport.targets.flatMap((t) => t.results)
    if (preparedAccounts && results.length > 0 && accountStanding.minimum.length === 0 && accountStanding.hardening.length === 0) {
      setState(bgStep, { satisfied: true, inPlace: true })
      bgStep.deliveredBy = [...mapping.breakGlassUserIds]
    }
  }
  // The exclusions group is defined by the selected emergency accounts. With
  // no selected accounts there is no safe membership target to create or
  // approve, so Configure Emergency Exclusions waits on Prepare Emergency Access
  // Accounts instead of presenting an empty group as actionable or complete.
  if (geStep && bgStep && mapping.breakGlassUserIds.length === 0) {
    if (!geStep.blockers.some(blocker => blocker.kind === 'step' && blocker.stepId === bgStep.id)) geStep.blockers.push({ kind: 'step', stepId: bgStep.id, label: 'select-emergency-accounts', held: true })
    setState(geStep, { satisfied: false, inPlace: false, condition: conditionFor(geStep.blockers) })
  }
  // The gate is the validation reports' own verdict, and nothing downgrades it.
  // A line here used to clear a gate whenever the gating step's status read
  // done — the projection overruling the report that produced it — so a saved or
  // mistakenly-satisfied status was enough to release every deny-capable step in
  // the plan. A step is In place because its checks passed; its checks do not
  // pass because it is In place.
  // Emergency access gates on its minimum safety checks; its hardening holds the
  // plan through the step not being done until it is fixed or deferred.
  const gatingReports = bgStanding ? validationReports.map((r) => (r === bgReport ? { ...r, blocking: bgStanding!.minimum } : r)) : validationReports
  let gate = canUseConditionalAccess ? gateReason(gatingReports) : null
  if (gate === null && bgStanding && bgAccountStanding && (bgStanding.minimum.length > 0 || (bgAccountStanding.hardening.length > 0 && !hardeningDeferred(bgAccountStanding.hardening, input.hardeningDeferral)))) gate = gateFor('breakGlass')
  // Accounts not yet prepared are an unverified escape hatch too: since the
  // connected journey (c1cacf21) Step 1 is done only with an approved recovery
  // passkey on each account, which no validation check carries, so the reports
  // alone released every deny-capable step while Step 1 still read Ready.
  if (gate === null && bgStep && bgStep.status !== 'done') gate = gateFor('breakGlass')
  if (gate === null && geStep && geStep.status !== 'done') gate = gateFor('exclusionGroup')
  // The step has to exist before the goal loop so a held step can name it; the
  // count of what it holds is filled in once the goal steps are known.
  // The countries list's checks wait for the step that now carries them (the
  // countries policy, built in the goal loop below; Stage 3).
  attachConfigurationFindings(steps, validationReports.filter((r) => r.subject !== 'allowedCountries'))
  if (bgStep && bgReport) bgStep.configurationFindings = journeyAccountFindings(bgReport, snapshot, mapping, input.groupMembers)
  if (geStep) {
    const savedExclusions = operatorExclusionsDecision(mapping)
    // Impact (rowWho.ts): the policies the group must be excluded from, every
    // one On or in Report-only, chosen group or not: the picker's "of M
    // policies" (validation/exclusionsGroupPolicies.ts exclusionsReach).
    if (snapshot.config.caPolicies?.status === 'ok') geStep.impactCount = exclusionsReach(snapshot.config.caPolicies.rows, '').policyCount
    geStep.configurationFindings = journeyGroupFindings(geReport, savedExclusions?.name ?? exclusions.actionableName ?? exclusions.suggested?.name ?? null, savedExclusions !== null, snapshot, savedExclusions?.id ?? exclusions.actionableId, input.groupMembers, mapping.breakGlassUserIds)
  }
  const validationSteps = blockerSteps(validationReports)
  steps.push(...validationSteps)

  // What each template placeholder is worth in this tenant (prompt 46 item
  // 12). null: nothing yet, so the step waits on the Wave 0 step that creates
  // it; an empty array: nothing to put there and nothing to wait for.
  //
  // There is no entry for the emergency accounts. A template's `{breakGlass}`
  // used to be filled with `mapping.breakGlassUserIds` and written straight into
  // `conditions.users.excludeUsers`, which gave the emergency carve-out a second
  // authority: the validated exclusions group an operator can inspect, and a
  // list of user ids IAMAI put in the policy itself. The second one repaired
  // policies quietly — a goal whose group was missing, unverified or unsafe
  // still came out excluding the accounts by name, so the group's checks decided
  // nothing and the boundary the product documents was not the boundary the
  // policy used. Emergency safety is the group, and only the group
  // (resolvePolicy.ts adds it to every policy the plan writes); with no group to
  // name, the policy waits on the step that fixes the group. The emergency
  // accounts are still read — to validate the group, and to prove each account
  // structurally out of the finished policy — and never written.
  const templateValues: TemplateValues = {
    '{namePrefix}': naming.prefix ?? 'CA',
    '{exclusionsGroup}': policyUsableExclusionsGroupId,
    '{serviceAccountsGroup}': mapping.serviceAccountsGroupId ?? (mapping.serviceAccountUserIds.length === 0 ? [] : null),
    '{trustedLocations}': mapping.trustedLocationIds.length > 0 ? mapping.trustedLocationIds : mapping.wizardAnswered.trustedLocations === true ? [] : null,
    '{allowedCountriesLocation}': countryLocation?.id ?? null,
    '{coreAdminRoles}': [...CORE_ADMIN_ROLE_IDS],
  }

  // ---- Goal steps ----

  for (const result of input.coverage.results) {
    if (result.status === 'not-applicable' || result.status === 'licence-limited') {
      if (result.goal.id === 'inforcer-mfa' && result.status === 'not-applicable' && inBaseline(result.goal)) {
        const s = prereq('s-goal-inforcer-mfa', 'Require MFA for Inforcer Access')
        s.goalId = result.goal.id
        s.doesntApply = 'Inforcer is confirmed not in use. MFA protection for this service is not claimed.'
        setState(s, { setAside: true })
        steps.push(s)
      }
      continue
    }
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
    const stepSources = mappedSources.length > 0 ? mappedSources : source?.standIn ? matches : source ? [source] : []
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
      stepSources.map((m) => ({ sourceName: m.facts.name, sourceKey: m.key, resolved: resolveOne(m.policy as RawPolicy, m.authors) }))
    const templatePolicy = (): StepPolicyInput[] => [{ sourceName: goal.id, sourceKey: `template:${goal.id}`, resolved: resolveOne(resolveTemplate(impl.template as TemplateBody, templateValues).body as RawPolicy, []) }]
    const named = (policies: StepPolicyInput[], first: string): StepPolicyInput[] =>
      policies.map((p, i) => ({ ...p, displayName: i === 0 ? first : policyPairNames(first, p.sourceName, naming ?? null).b }))
    /**
     * The live tenant policy that is this goal's whatever its contents: one this
     * plan tagged for the step, else one carrying the exact name the plan gives
     * the goal's policy. Null where the tenant has neither, or only a disabled one.
     */
    const claimedPolicy = (): RawPolicy | null => {
      const live = (p: RawPolicy | undefined): p is RawPolicy => p !== undefined && (p.state === 'enabled' || p.state === 'enabledForReportingButNotEnforced')
      const all = (snapshot.config.caPolicies?.rows ?? []) as RawPolicy[]
      const tagged = findTaggedPolicies(snapshot, planId, stepId).map((t) => all.find((p) => p.id === t.policyId)).find(live)
      if (tagged) return tagged
      const want = proposedPolicyName(goal, naming).trim().toLowerCase()
      return all.find((p) => live(p) && String(p.displayName ?? '').trim().toLowerCase() === want) ?? null
    }

    const whoKey = impl.expectedWho.kind
    // The service accounts are the mapping's, and the one population every other
    // step excludes (E9): the step that restricts them names them all.
    if (!expectedCache.has(whoKey)) expectedCache.set(whoKey, whoKey === 'workload' ? [] : whoKey === 'serviceAccounts' ? [...mapping.serviceAccountUserIds] : [...resolvePopulation(impl.expectedWho, snapshot).ids].filter((id) => !excluded.has(id)))
    // THIS goal's own accounts that can sign in, before the plan's exclusions
    // take anybody out. The line above subtracts them from the goal's
    // population, so a policy that excludes a group holding 116 of 122 accounts
    // leaves a goal defined as six people and reports itself delivered for all
    // of them. Who it misses is counted against these (coverageShortfall below).
    if (!goalAccountsCache.has(whoKey)) {
      const all = whoKey === 'workload' || whoKey === 'serviceAccounts' ? [] : [...resolvePopulation(impl.expectedWho, snapshot).ids]
      goalAccountsCache.set(whoKey, all.filter((id) => popIndex.enabled.has(id)))
    }
    const popIds = expectedCache.get(whoKey) ?? []
    if (!populationCache.has(whoKey)) populationCache.set(whoKey, whoKey === 'serviceAccounts' ? namedAccounts(popIds, popIndex) : population(popIds, popIndex))
    const pop = { ...(populationCache.get(whoKey) as StepPopulation) }
    let policyPreparation: Step['methodPreparation']
    const readinessKey = goalFamily(goal.id)
    if (!readinessCache.has(readinessKey)) readinessCache.set(readinessKey, readinessFor(goal.id, popIds, rowsFor(popIds), snapshot))
    const readiness = { ...(readinessCache.get(readinessKey) as Readiness), lines: [...(readinessCache.get(readinessKey) as Readiness).lines] }
    // Every policy this plan tagged for the step, not the first: a pair's two
    // halves both belong to it (evidence.ts).
    const matchedPolicyIds = findTaggedPolicies(snapshot, planId, stepId).map((t) => t.policyId)
    const evidence = evidenceFor(goal.id, snapshot, matchedPolicyIds)

    const doc = source ? docFor(input.baseline.docs, source.facts.name) : undefined
    const rawWhy = doc?.intent ?? goal.tldr ?? goal.description
    const whyUrl = rawWhy.match(/https?:\/\/[^\s)]+/)?.[0] ?? null
    const why = whyUrl ? rawWhy.replace(whyUrl, '').replace(/[\s:;,.]+$/, '').replace(/\.\s*:?$/, '') + '.' : rawWhy

    const blockedBy: string[] = []
    const blockers: Blocker[] = []
    const unblockNotes: string[] = []
    const blockByStep = (id: string, label: string): void => {
      // An object this step makes itself is its own task, not a wait (Stage 3:
      // the countries policy makes the countries location).
      if (id === stepId) return
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
    // The step's state as the loop settles it; `status` below is only ever the
    // projection of it (lifecycle.ts), read where a helper still takes the word.
    let state: StepState = initialState()
    const statusNow = (): StepStatus => projectStatus(state)
    // The readiness hold, recorded here and put on the action last of all
    // (below). Every reading between here and there asks what this step's policy
    // *does* — who it reaches, whether it can deny access, whether it would
    // strand the operator, who the announcement is for — and those answers are
    // facts about the policy, not about whether the instructions may be handed
    // over yet. Attaching the gate early made `stepEffects` return nothing for a
    // held step, which turned every one of those readings into its unknown.
    let readinessGate: NonNullable<Action['readinessGate']> | null = null
    let enforcedBelowReadiness: NonNullable<Action['enforcedBelowReadiness']> | null = null
    let namingNote: { name: string; note: string | null } | null = null
    let existing: GoalResult['candidates'][number] | null = null
    let existingRaw: RawPolicy | null = null
    let ambiguousTarget = false

    // A step is done if and only if its goal's verdict is inPlace (target-state
    // §8.2, prompt 46 item 9). Not the status, and never the plan's own idea of
    // whether a policy exists: the verdict is decided once, in coverage.
    if (result.verdict === 'inPlace') {
      kind = 'create'
      // Delivered — and by whom decides which of the two done outcomes this is.
      //
      // `inPlace` is Foundation B's word for a goal delivered by a control the
      // tenant already had: a preservation result, not a stage of a rollout, and
      // the reason its step reads "In place" rather than "Enforced" and its next
      // milestone is to keep the policy rather than nothing at all
      // (roadmap/lifecycle.ts). It was set for every satisfied goal, so a policy
      // IAMAI created and drove to enforcement came back on the next scan
      // reading as something the tenant always had, and the two outcomes an
      // operator most needs to tell apart — the work is done, and there was no
      // work — were one word.
      //
      // The provenance is the plan's own tag on the tenant object (`tagFor` in
      // buildCreateAction, read back by `findTaggedPolicies`): it is written
      // into the policy IAMAI creates, it survives every later scan, and a
      // policy the tenant wrote never carries it. The tag has to be on a policy
      // the classifier actually counted towards the satisfaction — a tagged
      // policy sitting disabled beside a tenant policy that delivers the goal
      // earned nothing.
      const planDeployed = (result.satisfaction?.policyIds ?? []).some((id) => matchedPolicyIds.includes(id))
      state = { ...state, satisfied: true, inPlace: !planDeployed }
      // What the plan would write for the goal, kept for comparison only
      // (Action.intended): coverage judges who a policy reaches, which resources
      // and its controls, and nothing else. A token-protection policy without the
      // Cloud PC device filter delivers the goal to coverage while blocking the
      // Cloud PCs the plan's policy leaves out, and with no operation to compare
      // it against it read "Completed, keep the policy as it is" (review of
      // Nadia D7). One policy only, and only where every reference resolves: a
      // policy still waiting on an object is not a statement of the plan.
      //
      // And only where the policy delivering the goal is the plan's own: one it
      // tagged, or one carrying the name the plan gives the goal's policy
      // (`claimedPolicy`, the same boundary a drifted policy is corrected by). A
      // policy the tenant wrote under its own name is adopted as delivering the
      // goal; reading it against the plan's shape told the large fixture to take
      // Android and iOS out of its own enforced compliant-device policy, a
      // narrowing of a policy the plan never built (an owner question).
      const claimed = claimedPolicy()
      const own = planDeployed || (claimed !== null && (result.satisfaction?.policyIds ?? []).includes(String(claimed.id)))
      const policies = !own ? [] : stepSources.length > 0 ? stepPolicies() : templatePolicy()
      const would = policies.length === 1 ? buildCreateAction(named(policies, proposedPolicyName(goal, naming)), mapping, planId, stepId, goal.id) : null
      const intended = would && (would.missing ?? []).length === 0 ? would.resolution?.policies[0]?.body : undefined
      // A policy the tenant wrote delivers the goal: where it is not the policy
      // the plan would write, in the parts coverage does not judge, the step says
      // so and asks nothing (owner, 2026-09-22; Action.ownPolicyDiffers). One
      // delivering policy, and a plan policy that resolves, or nothing is said.
      const delivering = result.satisfaction?.policyIds ?? []
      let ownPolicyDiffers: Action['ownPolicyDiffers'] | undefined
      if (!own && delivering.length === 1) {
        const theirs = (snapshot.config.caPolicies.rows as RawPolicy[]).find((p) => String(p.id) === delivering[0])
        const mine = stepSources.length > 0 ? stepPolicies() : templatePolicy()
        const plan = theirs && mine.length === 1 ? buildCreateAction(named(mine, proposedPolicyName(goal, naming)), mapping, planId, stepId, goal.id) : null
        const body = plan && (plan.missing ?? []).length === 0 ? plan.resolution?.policies[0]?.body : undefined
        const dimensions = body && theirs ? unwrittenDifferences(body as Record<string, unknown>, null, theirs as Record<string, unknown>, COVERAGE_JUDGED) : []
        if (theirs && dimensions.length > 0) ownPolicyDiffers = { policyName: String(theirs.displayName ?? theirs.id), dimensions }
      }
      action = {
        kind: 'create',
        summary: [],
        json: null,
        portalSteps: [],
        ...(intended ? { intended } : {}),
        ...(ownPolicyDiffers ? { ownPolicyDiffers } : {}),
      }
    } else if (result.status === 'unknown') {
      // Coverage could not settle the goal: a live policy that stands for it
      // names a group this scan could not read, so who it reaches — and whether
      // the goal is delivered — is not known. The step stays on the plan and
      // holds until a scan can read the group (A2 of the drift audit): a goal
      // the plan cannot assess is not a goal the plan may drop, and nothing is
      // written against a policy whose reach is unread.
      kind = 'adjust'
      action = { kind: 'adjust', summary: [], json: null, portalSteps: [], missing: [] }
      const known = input.groupMembers ?? new Map()
      const unread = new Set<string>()
      for (const c of result.candidates) {
        if (c.state !== 'enabled' && c.state !== 'enabledForReportingButNotEnforced') continue
        const row = (snapshot.config.caPolicies?.rows ?? []).find((p) => (p as RawPolicy).id === c.policyId) as RawPolicy | undefined
        const who = ((row?.conditions as RawPolicy | undefined)?.users ?? {}) as { includeGroups?: unknown; excludeGroups?: unknown }
        for (const g of [...(Array.isArray(who.includeGroups) ? who.includeGroups : []), ...(Array.isArray(who.excludeGroups) ? who.excludeGroups : [])]) {
          if (typeof g === 'string' && !known.has(g)) unread.add(g)
        }
      }
      const groups = [...unread].map((g) => g.slice(0, 8))
      blockers.push({ kind: 'evidence', label: 'unverified-exclusion', binding: BLOCKED_REASON.unverifiedExclusion(groups.length > 0 ? groups.join(', ') : '?'), unverified: true })
      state = { ...state, condition: conditionFor(blockers) }
    } else if (claimedPolicy() !== null && source && stepPolicies().length === 1 && (result.status === 'absent' || !result.candidates.some((c) => c.policyId === String(claimedPolicy()?.id)))) {
      // A live tenant policy carrying this step's plan tag, or the very name the
      // plan gives this goal's policy, is this goal's policy however far it has
      // drifted from the goal's signature (A3 of the drift audit). The step
      // corrects it — or says a person has to (roadmap/tracking.ts) — and never
      // proposes "(2)" beside it. The same holds where other policies leave the
      // goal partly delivered: the drifted policy is no candidate there either,
      // and the step proposed its duplicate beside it (cycle 1, A1).
      kind = 'adjust'
      const claimed = claimedPolicy() as RawPolicy
      existingRaw = claimed
      const one = named(stepPolicies(), String(claimed.displayName ?? proposedPolicyName(goal, naming)))
      one[0] = { ...one[0], target: { policyId: String(claimed.id), state: String(claimed.state ?? 'enabled'), policy: claimed } }
      action = changesFor(buildCreateAction(one, mapping, planId, stepId, goal.id, { sections: new Set() }), new Set(), claimed)
    } else if (result.status === 'absent') {
      kind = 'create'
      if (source) {
        const proposed = uniqueName(goal, stepId)
        action = buildCreateAction(named(stepPolicies(), proposed.name), mapping, planId, stepId, goal.id)
        namingNote = proposed
      } else {
        // No baseline policy stands for this goal: the goal's own template is
        // the body, with the tenant's objects filled in where they exist and a
        // Wave 0 step named where they do not (prompt 46 item 12). Every step
        // is executable; nothing says "create a policy that meets the floor".
        for (const p of resolveTemplate(impl.template as TemplateBody, templateValues).unresolved) blockPlaceholder(p)
        const proposed = uniqueName(goal, stepId)
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
      // Where the only thing short is an enforced policy of the goal's own that
      // falls short of it (no exclusions group, a narrower condition, fewer apps),
      // that policy is the one to correct — not a report-only policy for a few of
      // the same people. Otherwise the weaker or report-only policy is.
      const onlyShort = !result.reasons.some((r) => r.kind === 'weaker-control' || r.kind === 'session-weaker' || r.kind === 'report-only')
      // Only the goal's own policy, whatever order the scan listed them in (C01).
      // Another goal's policy is never the one this step corrects: correcting an
      // admin-role policy for the all-users goal rewrites it to All users (and
      // the admins step writes its own grant onto the same object), and
      // correcting an all-users policy for an admin goal narrows it to the
      // admins. With no policy of its own the step writes the goal's own policy.
      // Within a tier, the pick does not depend on order either (review R1-F2): two
      // of the goal's own policies nothing tells apart hold the step rather than
      // hand it the first listed.
      type Candidate = GoalResult['candidates'][number]
      const tiers: ((c: Candidate) => boolean)[] = [
        ...(onlyShort ? [(c: Candidate) => c.contribution === 'strong' && c.ownScope && (c.caveats.includes('exclusion-missing') || c.caveats.includes('conditions-narrower'))] : []),
        (c) => c.ownScope && c.contribution === 'weak',
        (c) => c.ownScope && c.contribution === 'reportOnly',
        (c) => c.ownScope && c.contribution !== 'disabled',
      ]
      existing = null
      for (const fits of tiers) {
        const hit = ownCandidate(result.candidates, candidate => {
          if (goal.id === 'admin-session') {
            const row = snapshot.config.caPolicies.rows.find(raw => (raw as RawPolicy).id === candidate.policyId) as RawPolicy | undefined
            // A grant policy can contribute session coverage without belonging to
            // this session-only step. Never repurpose its MFA or block controls.
            if (row?.grantControls != null) return false
          }
          return fits(candidate)
        })
        if (hit === 'ambiguous') {
          ambiguousTarget = true
          break
        }
        if (hit) {
          existing = hit
          break
        }
      }
      const existingId = existing?.policyId ?? null
      existingRaw = existingId !== null ? ((snapshot.config.caPolicies?.rows ?? []).find((p) => (p as RawPolicy).id === existingId) as RawPolicy | undefined) ?? null : null
      // No baseline policy stands for this goal, so the policy the step changes
      // is the goal's own template — the same body the absent branch builds,
      // through the same boundary.
      const changing = source ? stepPolicies() : templatePolicy()
      const sections = changedSections(result)
      // The applications the baseline's policy excludes and the tenant's does not
      // (review R1-F3): the target resources are the baseline's, so the correction
      // submits them and lists the change. The update used to keep the tenant's
      // resources while the Entra steps and AI Info named the exclusion.
      if (existingRaw && changing.length === 1) {
        const excludedBy = (p: RawPolicy | undefined): unknown => ((p?.conditions as RawPolicy | undefined)?.applications as RawPolicy | undefined)?.excludeApplications
        const wanted = excludedBy(changing[0].resolved.body as RawPolicy)
        const had = excludedBy(existingRaw)
        const present = new Set((Array.isArray(had) ? had : []).map((a) => String(a).toLowerCase()))
        if (Array.isArray(wanted) && wanted.some((a) => !present.has(String(a).toLowerCase()))) sections.add('applications')
      }
      // A policy that already meets the goal's floor has no grant or session of its
      // own to correct: those reasons belong to another candidate (a session-only
      // policy's "requires nothing"). Writing them onto this one would swap a
      // tenant's stronger grant for the baseline's, under a correction that was
      // about its users or its state (C01/C02). Its state is its own, and is read
      // from it below (`settleSections`), not from the goal's reasons.
      if (existing?.contribution === 'strong' || existing?.meetsFloor === true) {
        sections.delete('grantControls')
        sections.delete('sessionControls')
      }
      // The converse: the goal's own policy that falls short of the floor is corrected
      // to the floor, even when none of its current people count (all of them excluded,
      // or it is widened from a group). Widening it with its own grant kept put that
      // grant — an admins group's "phishing-resistant OR compliant device" — on
      // everyone, and the step claimed a correction that does not reach the floor (R1).
      if (existing && existing.meetsFloor === false && existing.contribution !== 'disabled') {
        sections.add(goal.implementations[0].floor.grant !== undefined ? 'grantControls' : 'sessionControls')
      }
      // The goal's own reading of each tenant policy: one below the floor is never
      // turned on by `settleSections`.
      const belowFloor = (policyId: string): boolean => result.candidates.some((c) => c.policyId === policyId && c.meetsFloor === false)
      if (ambiguousTarget && changing.length < 2) {
        // Several of the goal's own policies nothing tells apart: the step will not
        // guess which one to rewrite, and it does not create a duplicate beside them.
        action = { kind: 'adjust', summary: [], json: null, portalSteps: [], missing: [], unmatchedPair: true, ambiguousTarget: true }
      } else if (changing.length < 2) {
        // One policy: the goal's coverage names the tenant policy it changes.
        const one = named(changing, existing?.policyName ?? proposedPolicyName(goal, naming))
        one[0] = { ...one[0], target: existing ? { policyId: existing.policyId, state: existing.state, policy: existingRaw } : null }
        let built = buildCreateAction(one, mapping, planId, stepId, goal.id, { sections })
        if (settleSections(sections, built, new Map(existing && existingRaw ? [[existing.policyId, existingRaw]] : []), belowFloor)) built = buildCreateAction(one, mapping, planId, stepId, goal.id, { sections })
        action = changesFor(built, sections, existingRaw)
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
          action = { kind: 'adjust', summary: [], json: null, portalSteps: members.map(m => fillText(app.plan.pairReviewExpected, { name: String(m.displayName) })), missing: [], unmatchedPair: true }
        } else {
          const withTargets = members.map((m, i) => {
            const p = matched[i]
            return p ? { ...m, target: { policyId: String(p.id), state: String(p.state ?? 'enabled'), policy: p } } : { ...m, target: null }
          })
          // One set of sections for the pair: a section stays where either half
          // does not hold it yet, and where the pair owes nothing else the state is
          // turned on if either half is in report-only — a half already on takes
          // `"state": "enabled"` as the no-change it is, and is not left with an
          // empty patch.
          let built = buildCreateAction(withTargets, mapping, planId, stepId, goal.id, { sections })
          if (settleSections(sections, built, new Map(matched.filter((p): p is RawPolicy => p !== null).map((p) => [String(p.id), p])), belowFloor)) built = buildCreateAction(withTargets, mapping, planId, stepId, goal.id, { sections })
          const firstUpdate = matched.find((p) => p !== null) ?? null
          action = changesFor(built, sections, firstUpdate)
        }
      }
      // Every update empty: the policies it targets already hold each section
      // this step writes. What still keeps the goal short is then something no
      // update writes — a narrower condition, which has no section (CHANGED_SECTION)
      // — and the step names it (types.ts `nothingOwed`) rather than asking for a
      // scan that rebuilds the same empty update.
      const ops = action.resolution?.policies ?? []
      if (ops.length > 0 && ops.every((o) => o.mode === 'update' && Object.keys(o.body).length === 0)) {
        action = { ...action, nothingOwed: { gaps: result.reasons.filter((r) => !r.expected && r.kind === 'conditions-narrower').map((r) => r.detail) } }
      }
      if (action.kind === 'create') namingNote = uniqueName(goal, stepId)
    }

    // No usable, owner-confirmed exclusions group, and the goal's own policy needs
    // one (owner decision, Step 3 correction). The policy the tenant has is partly
    // in place, and its correction waits on Create or Correct Exclusions Group.
    // Nothing is written until that group exists: no body or target names a group
    // nobody chose, a stored one this scan could not verify, or one proved gone, so
    // the step carries no operation at all — only what it is missing, and the step
    // that makes it.
    if (kind === 'adjust' && policyUsableExclusionsGroupId === null && result.candidates.some((c) => c.caveats.includes('exclusion-unresolved'))) {
      action = { kind: 'adjust', summary: [], json: null, portalSteps: [], missing: [{ token: '{exclusionsGroup}', stepId: PLACEHOLDER_STEP['{exclusionsGroup}'] }] }
      existingRaw = null
      blockPlaceholder('{exclusionsGroup}')
    }

    // The tenant objects the resolution used travel with the result, so an
    // instruction names the object the body actually holds rather than looking
    // one up in the mapping again.
    if (action.resolution) action.resolution = { ...action.resolution, tenant: { exclusionsGroupId: tenantObjects.exclusionsGroupId, serviceAccountsGroupId: tenantObjects.serviceAccountsGroupId, emergencyIds: [...mapping.breakGlassUserIds] } }

    // ---- The emergency-access boundary (Foundation A) ----
    // The last thing asked of a policy before anything is offered for it, and
    // the only one asked of the policy the tenant will actually be left with.
    // Every other guard here is upstream of this: the exclusions group's checks
    // are about an object, the gate is about a step, and neither reads what a
    // finished policy says. This does — through the same decoder every other
    // reading of a policy goes through — and asks one question of each confirmed
    // emergency access account: is it out of this policy's user scope?
    //
    // Out is the only answer that lets the policy through. In is a policy that
    // covers the way back in. Unknown is a scope resolved against a membership
    // this scan did not read completely, and an exclusion nobody has read is not
    // an exclusion.
    //
    // Structural only. Whether the account happens to be signing in from the
    // office, on a compliant device, at low risk, is a fact about *when* a policy
    // applies and never about whether the account is excluded — the day it
    // matters is the day none of those hold. And the repair is never a direct
    // user exclusion added here: the policy's scope is corrected upstream, or it
    // is not offered.
    {
      const probe = { goalId: goal.id, kind, status: statusNow(), action } as unknown as Step
      const finalEffects = isOpenPolicy(probe) ? stepEffects(probe) : []
      const exposure = emergencyExposureOf(finalEffects, mapping.breakGlassUserIds, snapshot, strandContext)
      if (exposure !== null) action = { ...action, emergencyExposure: exposure }
    }


    // Named dependencies (prompt 12 §B).
    if (!state.satisfied) {
      if (goal.id === 'register-info-protected' && steps.some((s) => s.id === locStepId && s.status !== 'done' && s.doesntApply == null) && !doesntApply(locStepId)) blockByStep(locStepId, 'trusted-location')
      // Every policy that requires the baseline's own custom strength waits on
      // the step that creates it — read off the step's own missing list, so the
      // dependency is the same fact the body already reports and never a second
      // reading of which goals happen to use a strength.
      if ((action.missing ?? []).some((m) => m.stepId === strengthStepId) && steps.some((x) => x.id === strengthStepId)) blockByStep(strengthStepId, 'create-object')      // The service-accounts block names the group and the trusted network (E9): it waits on both.
      if (goal.id === SERVICE_ACCOUNTS_TRUSTED_GOAL) {
        if (steps.some((s) => s.id === saStepId)) blockByStep(saStepId, 'create-object')
        if (steps.some((s) => s.id === locStepId && s.status !== 'done' && s.doesntApply == null) && !doesntApply(locStepId)) blockByStep(locStepId, 'trusted-location')
      }
    }

    // The baseline's own contradiction, read from this run's goal map
    // (baselineConflict.ts). Carried on every reading of the step below,
    // including the synthetic ones the gating pass builds: a source policy whose
    // two definitions cannot both hold is never read for what its policy would
    // do — no operation, no effects, no reach, no announcement — and step 0 of
    // the sequence pass records the same reading on the step itself.
    const conflictSource = typeof goal.id === 'string' ? (conflictGoals.get(goal.id) ?? null) : null
    const conflictState = conflictSource !== null ? { state: { condition: BASELINE_CONFLICT, conflictSource } } : {}

    // The tenant policies that deliver the goal, where it is delivered (the
    // classifier's satisfaction): what the step's method readiness and its reach
    // read once nothing is left to create (R4-30).
    const deliveringEffects: PolicyEffect[] | null = state.satisfied
      ? (snapshot.config.caPolicies.rows as RawPolicy[]).filter(p => (result.satisfaction?.policyIds ?? []).includes(String(p.id))).map(effectOf)
      : null

    // The resolved target determines method suitability and its denominator.
    // Eligible role holders are prepared for activation; Impact stays active-only.
    // The strength that target requires, where the family's words would name
    // another (roadmap/readiness.ts strengthMeasuredOf): the gate below is stated
    // against it.
    let measuredStrength: string | null = null
    if (['mfa', 'admin', 'guest'].includes(readinessKey)) {
      const effects = deliveringEffects ?? validOperations(action).map(operation => effectOf(operation.mode === 'update' ? operation.target as Record<string, unknown> : operation.body))
      methodTargets.set(goal.id, effects)
      measuredStrength = strengthMeasuredOf(effects, readinessKey, snapshot, mapping)
      policyPreparation = methodPreparation(effects, viability.map(v => v.userId), snapshot, strandContext, methodPreparationCache)
      const reading = methodReadiness(readinessKey, policyPreparation)
      Object.assign(readiness, reading)
      if (!reading.unmeasured) delete readiness.unmeasured
    }
    // What the scan could not read, where a refused source is why the number is
    // missing: the reading's own fact, worked out once (types.ts
    // `Readiness.blind`). The gate below reads it rather than asking again.
    const blindSource = blindOf(readiness, snapshot)
    if (blindSource !== null) readiness.blind = blindSource

    // Gating (roadmap.md §6).
    const threshold =
      readiness.family === 'mfa' || readiness.family === 'guest'
        ? READINESS_THRESHOLD_MFA_PERCENT
        : readiness.family === 'admin'
          ? READINESS_THRESHOLD_ADMINS_PERCENT
          : readiness.family === 'device'
            ? READINESS_THRESHOLD_DEVICES_PERCENT
            : null
    // A readiness threshold the plan itself says to wait for, unmet — or never
    // measured, which is not the same as met. The gate used to require a
    // number: a family with a threshold whose readiness the scan could not
    // work out produced no blocker at all, so a tenant IAMAI knew least about
    // was the one it held back least.
    // Below the line, or never read. Not "nobody in scope": a threshold there
    // is nothing to measure against is not one anybody can reach, and holding
    // a step whose policy reaches nobody would wait for a number that can
    // never arrive (roadmap/readiness.ts `unmeasured`).
    const unmet = threshold !== null && (readiness.percent === null ? readiness.unmeasured === 'unreadable' : readiness.percent < threshold)
    // The reading of that threshold, as the gate states it.
    const thresholdReading = (): NonNullable<Action['readinessGate']> => {
      // A floor where the scan proved one (roadmap/readiness.ts `atLeast`):
      // "at least 68%" is strictly more than "not measured" and never wrong,
      // and it is what stopped this step reading as a contradiction of the
      // sibling measuring the same people. It changes no gate: `unmet` above
      // is computed from the percentage and the unmeasured reason, both
      // untouched, so unknown still holds enforcement exactly as before.
      const floor = readiness.percent === null && readiness.atLeast !== undefined
      const family = readiness.family
      return {
        // Named for the requirement the number was measured against (R4-26):
        // the policies' own strength where the family's words would say another.
        // Every sentence that states the gate reads this one measure.
        measure: readinessMeasure(family, measuredStrength),
        ...(measuredStrength !== null ? { family, strength: measuredStrength } : {}),
        threshold: `${threshold}%`,
        value: readiness.percent !== null ? `${readiness.percent}%` : floor ? `${readiness.atLeast}%` : engine.readiness.notMeasured,
        ...(floor ? { floor: true as const } : {}),
        // And what the scan could not see, where a source is the reason the
        // number is missing. "It is not measured yet" is true and names
        // nothing to go and do; this names the source, its recorded reason,
        // the permission that reads it and the licence it needs. It is the
        // reading's (above), never worked out a second time here.
        ...(readiness.percent === null && readiness.blind !== undefined ? { blind: readiness.blind } : {}),
      }
    }
    // The same threshold, unmet, on a step that is already finished. The gate
    // below is computed only for an unfinished step, so a policy enforced in
    // the portal while IAMAI was holding it back lost every trace of the hold:
    // the admin policy went on with neither admin's method readable, the step
    // read Completed with its Done-when satisfied, and nothing said the
    // threshold had never been met (Priya D3). A gate that congratulates you
    // for walking around it is not a gate. It holds nothing — the work is done
    // — and it is a fact about the tenant.
    if (state.satisfied && unmet) enforcedBelowReadiness = thresholdReading()
    if (!state.satisfied) {
      // The blocker is the word; `action.readinessGate` is the fact, and it is
      // what holds the enforcement (roadmap/operations.ts policyResult,
      // enforcementHeld). The step read "Blocked · when device readiness reaches
      // 80% (now 29%)" with four dated rings, an enforcement event, a calendar
      // entry and every implementation channel beside it.
      if (unmet) {
        readinessGate = thresholdReading()
        blockers.push({ kind: 'readiness', label: 'readiness', binding: BLOCKED_REASON.reaches(readinessGate.measure, readinessGate.threshold, readinessGate.value) })
        state = { ...state, condition: conditionFor(blockers) }
      }
      // Nothing that can deny access is offered while the way back in is
      // unverified (validation-rules.md §2). What the step will actually leave
      // behind decides (roadmap/operations.ts stepEffects); the floor and the
      // goal's family answer only for a step with no policy of its own.
      const denyStep = { goalId: goal.id, kind, status: statusNow(), action, ...conflictState } as unknown as Step
      // What the step will actually leave behind decides. A policy the plan
      // cannot read at all is treated as one that can deny access: the way back
      // in is never withheld on a guess (roadmap/operations.ts stepEffects).
      const denyEffects = isOpenPolicy(denyStep) ? stepEffects(denyStep) : null
      const deniesAccess =
        denyEffects !== null
          ? denyEffects.length === 0 || denyEffects.some((e) => e.any)
          : impl.floor.grant !== undefined || impl.floor.session !== undefined || readiness.family === 'block' || readiness.family === 'location'
      // The gate, as a dependency edge and — where running the operation *is*
      // the enforcement — as an implementation fact.
      //
      // The design's words are exact: no enforcement is offered while the escape
      // hatch is unverified (roadmap/blockerSteps.ts). A create the plan proposes
      // lands in report-only, which denies nobody, and its enforce event is a
      // later step this gate already sequences ahead of; withholding that body
      // would be the tool requiring strictness rather than helping with it. An
      // operation that submits `state: enabled` is not that: it turns the policy
      // on the moment it is run, so submitting it is the enforcement and there is
      // nothing left for the schedule to hold back. That is what the gate did not
      // hold. The step read "Blocked · after: Create or Correct Exclusions Group"
      // with the portal lines, the JSON, the PowerShell and Download JSON beside
      // it, and running any of them enforced the policy that afternoon with the
      // way back in unverified.
      //
      // Deliberately not here: a change to a policy the tenant already enforces.
      // That policy is already on and already denying; the step still carries the
      // gate as a dependency and a status, and refusing to describe a change to
      // something already running would leave an operator with a policy they
      // cannot see how to correct.
      if (deniesAccess && gate !== null) {
        blockByStep(gate.stepId, gate.label)
        if (operationsOf(denyStep).some(submitsEnforcement)) action = { ...action, escapeHatch: { stepId: gate.stepId } }
      }
      if (blockedBy.length > 0) state = { ...state, condition: conditionFor(blockers) }
    }


    // Whether the signed-in account is in scope is the policy's own answer, from
    // its include and exclude lists (roadmap/operations.ts accountApplicability);
    // a step with no policy of its own is bounded by the people it lists.
    const asStep = { goalId: goal.id, kind, status: statusNow(), action, readiness, population: pop, ...conflictState } as unknown as Step
    const operatorEffects = isOpenPolicy(asStep) ? stepEffects(asStep) : []
    const includesOperator =
      operatorId !== null &&
      (isOpenPolicy(asStep)
        ? // An open policy answers for itself, conditions and all
          // (roadmap/strand.ts operationReach). One the plan cannot read is
          // treated as reaching the operator: its safety is then unknown, and
          // unknown is not safe.
          operatorEffects.length === 0 || operatorEffects.some((e) => operationReach(e, operatorId, snapshot, strandContext).answer !== 'out')
        : popIds.includes(operatorId))
    // The strand simulator decides (roadmap-v2.md §7): the same check the
    // property tests run, so a step that would lock the operator out is
    // never offered as ready.
    const opVerdict = includesOperator && operatorId !== null ? stepAccountVerdict(asStep, operatorId, snapshot, strandContext) : null
    const stepLockout = lockoutCount(stepEffects(asStep), viability, snapshot, strandContext.strengths, excluded, strandContext)
    // Who the records show this step's own policies touching, measured against
    // the evidence those policies' own conditions are about (roadmap/strand.ts
    // measuredReach). Absent where the answer is not known; zero impact, the
    // notice, the batch class and the soak all read it and nothing else.
    const measured = isOpenPolicy(asStep) ? measuredReach(stepEffects(asStep), activePeople, snapshot, strandContext) : null
    // The people this step's own policies name (cohortFor above). Null on an open
    // policy whose scope could not be settled, and absent from the step then: an
    // exact cohort is proved or it is not claimed, and never filled in from the
    // goal's population.
    const cohort = isOpenPolicy(asStep) ? cohortFor(stepEffects(asStep)) : null
    // A delivered step reaches whom the tenant policies delivering it name, read
    // from their own scope the same way (R4-30). It fell back to the goal's
    // population minus the plan's exclusions, so enforcing a policy the plan had
    // just watched in report-only moved its tile from "covers 283 enabled" to
    // "covers 279 enabled" with the policy unchanged. Null where their scope
    // cannot be settled, and carried as null: that reach is not established,
    // and nothing stands in for it (Foundation A). The step kept the goal's
    // population there, a count nothing measured for those policies, which
    // moved to their real reach the scan the group was read. Undefined where no
    // tenant policy delivers the goal: there is no scope to read.
    // Its own field, never `cohort`: a delivered step reopened later in this
    // run (an unestablished Inforcer application, a workload identity) is an
    // open policy again, and its cohort is its own operation's scope or nothing.
    const deliveredReach = cohort === null && deliveringEffects !== null && deliveringEffects.length > 0 ? cohortFor(deliveringEffects) : undefined
    const reach = cohort ?? deliveredReach ?? null
    // Whether the delivering policies reach the signed-in account, asked of
    // them for this one account where their reach as a whole is not established
    // (deliveredReach null), from the same user scope. An answer they cannot
    // give counts as reaching it, the convention an open policy follows above;
    // a group read in full that excludes the account still settles it. The
    // operator line reads it on a step still delivered when it is read
    // (ui/surfaces/stepVars.ts operatorInScope, through derive/population.ts
    // reached). It is its own field, never `includesOperator`: that one decides
    // the operator's safety verdict and reads the people the step lists, and a
    // step this run reopens later keeps its deliveredReach. Read there, the
    // guests step, reopened as a policy to create, took the reach of the
    // policies that had delivered it, said the signed-in member account was in
    // scope, and on small was given a stranding verdict it never had.
    const deliveredReachesOperator = deliveredReach === null && operatorId !== null
      ? (deliveringEffects ?? []).some((e) => accountApplicability(e.scope, operatorId, snapshot as never, strandContext) !== 'out')
      : undefined
    // The denominator. A goal can be delivered and still reach a fraction of the
    // tenant: a policy excluding a group that holds 116 of 122 accounts delivers
    // it for six people, and the step said "already delivered, so there is
    // nothing to create" beside "6 active people" with nothing to compare that
    // six against. The exclusion itself is EXPECTED — it is the emergency
    // exclusions group the plan asks for — so nothing in the reasons marks it
    // wrong; what is worth saying is the size, which needs no judgement at all.
    //
    // Who it misses is the goal's accounts that the step's policy does not
    // reach, read from that policy's own scope (R4-30). It was the goal's
    // accounts in the plan's exclusion set — the emergency accounts, the service
    // accounts, every account that is not a person and the exclusions group —
    // and said "6 of them are excluded from the policy that delivers it" of a
    // policy that excluded two. Nothing is said where the scope is not settled.
    const goalAccounts = goalAccountsCache.get(whoKey) ?? []
    const inReach = reach !== null ? new Set(reach.ids) : null
    const missed = inReach !== null ? goalAccounts.filter((id) => !inReach.has(id)) : []
    // Only where the policy misses MORE than the emergency accounts. Those
    // are excluded by design, on every policy, and saying so on every step would
    // put a line about two people under thirty rows. Anybody else it misses
    // is a person the goal was written for and does not reach.
    const emergency = new Set(mapping.breakGlassUserIds)
    const coverageShortfall = missed.some((id) => !emergency.has(id))
      ? { detail: '', people: missed.length, reached: goalAccounts.length - missed.length, active: goalAccounts.length }
      : null
    // Safe means known to be safe: a verdict the scan could not settle is not one.
    const operatorSafe = opVerdict === null ? null : !opVerdict.stranded && !opVerdict.unknown
    if (opVerdict?.stranded && !state.satisfied) {
      blockers.push({ kind: 'readiness', label: 'operator', binding: BLOCKED_REASON.exist(1, 'safe way in for the signed-in account', 0) })
      state = { ...state, condition: conditionFor(blockers) }
    }
    // A policy the plan would put on an authentication context another of the
    // tenant's policies already targets (roadmap/authContext.ts). The PIM create
    // read Ready · Create / Ready now over a procedure that could not be done:
    // its context ID was left out, and its first instruction was to create a
    // context that is already there. It is a tenant fact, and the step holds on
    // it until the scan no longer finds it (R4-18 review).
    if (!state.satisfied) {
      const taken = contextsTakenElsewhere(action.resolution?.policies ?? [], snapshot.config.caPolicies?.rows ?? [], findTaggedPolicies(snapshot, planId, stepId).map((t) => t.policyId))
      if (taken.length > 0) {
        blockers.push({ kind: 'evidence', label: AUTH_CONTEXT_IN_USE, binding: BLOCKED_REASON.authContextInUse(taken.join(', ')), unverified: true })
        state = { ...state, condition: conditionFor(blockers) }
      }
    }

    if (!readyActiveCache.has(whoKey))
      readyActiveCache.set(
        whoKey,
        popIds.filter((id) => {
          const v = viabilityById.get(id)
          // The family's own reading of ready (roadmap/readiness.ts mfaReady), not a second one here.
          return v !== undefined && mfaReady(v)
        }).length,
      )
    const notReadyActive = pop.active - (readyActiveCache.get(whoKey) ?? 0)


    // Announcements by goal family (prompt 13 §8); nobody affected → no template.
    const evidenceUsable = evidence.status === 'ok' || evidence.status === 'partial'
    // Whether anybody feels this change is the policy's own answer, from what it
    // will leave behind (roadmap/timing.ts nobodyAffected) — the one definition
    // the notice period, the zero batch and the soak already read. The goal's
    // family answers only for a step with no policy of its own.
    const nobodyAffected = isOpenPolicy(asStep)
      ? nobodyAffectedBy({ ...asStep, evidence, ...(measured !== null ? { measured: { ids: measured } } : {}) } as Step)
      : (evidenceUsable && (readiness.family === 'block' || readiness.family === 'risk') && evidence.affectedUserIds.length === 0) ||
        ((readiness.family === 'mfa' || readiness.family === 'guest' || readiness.family === 'admin') && notReadyActive === 0) ||
        (readiness.family === 'device' && readiness.percent === 100) ||
        // The accounts the step names, not the active people among them: the
        // service-account policy changes those accounts whether or not any of
        // them is a person (roadmap/timing.ts nobodyAffected reads the same).
        affectedIds(pop).length === 0
    // The change itself decides the wording (prompt 17 §4): an adjust that
    // only tightens sessions gets session wording; a strength raise gets
    // passkey wording; a block names the affected users or needs none.
    //
    // For an open policy the change is the operation, and what it asks for is
    // read from the policy the step will leave behind — never the goal's floor,
    // which is the author's version of a change this tenant may not be getting.
    // Where the analysis cannot settle what the policy does, the step offers no
    // announcement at all rather than one describing somebody else's policy.
    const ownEffects = isOpenPolicy(asStep) ? stepEffects(asStep) : null
    const held = ownEffects !== null && (ownEffects.length === 0 || ownEffects.some((e) => e.unknown.length > 0))
    const floorGrant = impl.floor.grant ?? null
    const adjustSections = new Set(result.reasons.filter((r) => !r.expected).map((r) => CHANGED_SECTION[r.kind]).filter(Boolean))
    const operationGrant = ownEffects === null ? floorGrant : grantOf(ownEffects, strandContext.strengths)
    const sessionOnly =
      ownEffects !== null
        ? operationGrant === null && ownEffects.some((e) => e.session)
        : kind === 'adjust'
          ? adjustSections.size > 0 && [...adjustSections].every((s) => s === 'sessionControls')
          : floorGrant === null && impl.floor.session !== undefined
    // Who the announcement is addressed to is who the policy names, and for an
    // open policy that is the cohort: the goal's own idea of who it is for
    // (expectedWho) and the readiness family both describe a goal, and a step
    // whose policy names everybody must not greet four admins. An unresolved
    // cohort writes no announcement at all rather than a named audience nobody
    // has established.
    const audienceIds = ownEffects !== null ? (cohort?.ids ?? null) : pop.ids
    const adminAudience =
      ownEffects !== null
        ? audienceIds !== null && audienceIds.length > 0 && audienceIds.every((id) => popIndex.admins.has(id))
        : impl.expectedWho.kind === 'coreAdmins' || readiness.family === 'admin'
    const comms =
      state.satisfied || held || audienceIds === null
        ? null
        : nobodyAffected
          ? NO_ANNOUNCEMENT
          : announcementFor(
              {
                // An open policy's meaning is its operation's, and the goal is
                // not passed at all; a step with no policy of its own is read by
                // its goal, as it always was (roadmap/strand.ts familyReading).
                ...(ownEffects !== null ? { policy: policySemantics(ownEffects) } : { goalId: goal.id, family: familyReading(asStep) }),
                grant: sessionOnly ? null : operationGrant,
                sessionOnly,
                // How many people a block reaches is the measured answer, not a
                // count collected under the goal.
                affected: ownEffects !== null ? (measured?.length ?? null) : evidenceUsable && readiness.family === 'block' ? evidence.affectedUserIds.length : null,
                admins: adminAudience,
                // Named below the threshold the audience model already uses, so
                // the greeting and the audience label cannot disagree
                // (prompt 41 §4).
                audience: announcementAudience(audienceIds, adminAudience, nameOf),
              },
              tenantName,
              '{DATE}',
            )

    /**
     * The three sentences a manager reads: the risk closed, the cost to people,
     * what happens if it is not done.
     *
     * For an open policy every one of them is the policy's own — what it asks
     * for (`operationGrant`), what it means (`policySemantics`), who it names
     * (the cohort) and who the records show it touching (`measured`). The goal's
     * readiness family used to choose the sentence and the goal's population
     * used to supply its numbers, which told a manager that GetIAMAI's all-users
     * policy was about guests, and that a step whose exported policy is a Block
     * "requires MFA to open the Microsoft admin portals".
     *
     * A goal's own note stands only where the operation corroborates the claim
     * it makes: each of them says the policy requires MFA, so each is used only
     * where the policy requires MFA and blocks nobody. Where the operation
     * settles none of it, the note is the one that claims nothing specific
     * (MANAGER.other) rather than a sentence the goal made up.
     *
     * A step with no policy of its own is read by its goal, as it always was.
     */
    const managerNote = (): string => {
      if (ownEffects === null) {
        const family = familyReading(asStep)
        return (
          MANAGER_BY_GOAL[goal.id]?.() ??
          (family === 'mfa' || family === 'guest'
            ? family === 'guest'
              ? MANAGER.guest(pop.active)
              : MANAGER.mfa(pop.active, notReadyActive)
            : family === 'admin'
              ? MANAGER.admin(pop.total)
              : family === 'block'
                ? MANAGER.block(evidenceUsable ? evidence.affectedUserIds.length : 0)
                : family === 'location'
                  ? MANAGER.location(mapping.allowedCountries.map(countryLabel).join(', '), evidence.affectedUserIds.length)
                  : family === 'device'
                    ? MANAGER.device(pop.active, pop.active - popIds.filter((id) => contentIndexes.deviceReady.has(id) && popIndex.active.has(id)).length)
                    : sessionOnly || /session/i.test(goal.name)
                      ? MANAGER.session(pop.active)
                      : MANAGER.other())
        )
      }
      const semantics = policySemantics(ownEffects)
      const control = controlNoteFor(semantics, operationGrant)
      if (control !== null) return control
      // The people the policy names, and the ones among them who cannot meet it
      // yet: the cohort, never the goal's population. Absent where the scope was
      // not settled, and the note then claims no number.
      const cohortActive = cohort?.activeIds ?? null
      // A zero has to be proved: the block and location notes both say "nobody
      // used it", which is `measuredReach` or nothing (roadmap/strand.ts).
      const touched = measured?.length ?? null
      if (semantics.blocks) {
        if (touched === null) return MANAGER.other()
        return semantics.locations ? MANAGER.location(mapping.allowedCountries.map(countryLabel).join(', '), touched) : MANAGER.block(touched)
      }
      if (cohortActive === null) return MANAGER.other()
      if (sessionOnly) return MANAGER.session(cohortActive.length)
      if (operationGrant === 'phishingResistant' || operationGrant === 'passwordless') return MANAGER.admin(cohort?.ids.length ?? 0)
      if (operationGrant === 'compliantDevice' || operationGrant === 'approvedApplication' || operationGrant === 'compliantApplication')
        return MANAGER.device(cohortActive.length, cohortActive.filter((id) => !contentIndexes.deviceReady.has(id)).length)
      if (operationGrant === 'mfa' || operationGrant === 'passwordChange') {
        if (semantics.guestsOnly) return MANAGER.guest(cohortActive.length)
        const notReady = cohortActive.filter((id) => {
          const v = viabilityById.get(id)
          return v === undefined || !mfaReady(v)
        }).length
        return MANAGER.mfa(cohortActive.length, notReady)
      }
      return MANAGER.other()
    }
    const forManager = managerNote()

    // Operator evidence sentence (prompt 13 §7) — never a promise. A count is
    // only claimed where the records actually measured this goal (block usage
    // or a tagged report-only policy); otherwise the note says so.

    // "Done when" bullets only for criteria that apply to the step kind
    // (prompt 17 §4): a create step observes in report-only, then enforces;
    // an adjust step to an enforced policy just has to land cleanly.


    // Last of all: the readiness hold becomes an implementation fact. From here
    // the step offers no operation that would enforce the moment it is run, and
    // nothing about it is dated (roadmap/operations.ts policyResult,
    // enforcementHeld).
    // What this step would CREATE, against the cohort its name promises. The
    // goal declares who it is for (`expectedWho`); the policy resolved for it
    // can reach everybody, because a signature reads the control and not the
    // scope, and nothing checked. Reading expectedWho to SAY this is allowed
    // where reading it to pick a policy is not: it moves no operation.
    //
    // Only a create — an update to a policy that is already there reaches whom
    // it already reaches, and the reader is not about to build anything. And
    // only for a cohort where "all users" is a real widening: `members` is
    // mapped to an all-users policy by the baseline author on purpose, so
    // saying it there would be noise over a deliberate decision.
    const WIDENING = new Set(['guests', 'coreAdmins', 'serviceAccounts', 'workload'])
    if (WIDENING.has(impl.expectedWho.kind) && validOperations(action).some((op) => op.mode === 'create' && effectOf(op.body).scope.allUsers)) {
      action = { ...action, widerThan: impl.expectedWho.kind }
    }
    if (readinessGate) action = { ...action, readinessGate }
    // What the plan writes, against the goal's own grant floor: the pinned
    // baseline can ask for less than the goal it is filed under, and the step
    // says so (Action.belowGoalFloor). One policy, and a grant floor, or nothing.
    {
      const floorGrant = goal.implementations[0]?.floor.grant
      const writes = (action.resolution?.policies ?? []).map((o) => (o.mode === 'create' ? o.body : o.intent ?? null)).filter((b): b is Record<string, unknown> => b !== null && typeof b === 'object')
      if (floorGrant !== undefined && writes.length === 1 && (kind === 'create' || kind === 'adjust')) {
        const facts = policyFacts(writes[0], input.strengths)
        if (!satisfiesFloor(facts.grant, facts.session, { grant: floorGrant })) {
          const grant = (writes[0].grantControls ?? {}) as { authenticationStrength?: { id?: string } | null; builtInControls?: string[] }
          action = { ...action, belowGoalFloor: { strengthId: grant.authenticationStrength?.id ?? null, builtIn: grant.builtInControls ?? [], floor: floorGrant } }
        }
      }
    }
    if (enforcedBelowReadiness) action = { ...action, enforcedBelowReadiness }

    steps.push({
      id: stepId,
      goalId: goal.id,
      phase: Math.max(1, goal.phase),
      kind,
      ...(floor ? { floor: true } : {}),
      title: stepTitle(goal.name),
      why,
      ...stateFields(state),
      blockedBy,
      blockers,
      unblockNotes,
      population: pop,
      ...(cohort !== null ? { cohort: { ...cohort } } : {}),
      ...(deliveredReach !== undefined ? { deliveredReach: deliveredReach === null ? null : { ...deliveredReach } } : {}),
      ...(deliveredReachesOperator !== undefined ? { deliveredReachesOperator } : {}),
      ...(coverageShortfall !== null ? { coverageShortfall } : {}),
      readiness,
      ...(policyPreparation ? { methodPreparation: policyPreparation } : {}),
      evidence,
      action,
      history: [],
      skipReason: null,
      ...EXTRAS,
      // After the defaults, or the default overwrites it: the gap a change step
      // closes, on the step so the plan row can show it (prompt 46 item 9).
      gap: activeGap(result, pop, popIndex.active),
      gapShort: activeGapShort(result, pop, popIndex.active),
      comms,
      learn: goal.learnUrl ? { url: goal.learnUrl, tldr: goal.tldr ?? '', cis: goal.cis ?? [] } : null,
      includesOperator,
      operatorSafe,
      // The goal's own coverage, not a broad all-users match that belongs to
      // another goal (walk-51 item 15): prefer the policies scoped to this goal.
      deliveredBy: (() => {
        // A step that corrects an enforced policy of the goal's own keeps that
        // policy as the goal's delivery: nothing beside it is superseded, and a
        // policy another goal owns is not this step's to retire. Naming them here
        // said the step creates the baseline's version beside its own policy and
        // put the policies being corrected on the consolidation row. A step that
        // brings a report-only or weaker policy up to the baseline still names the
        // enforced overlaps it makes redundant — never the policy it changes.
        if (existing?.contribution === 'strong') return []
        const strong = result.candidates.filter((c) => c.contribution === 'strong' && c.policyId !== existing?.policyId)
        const own = strong.filter((c) => c.ownScope)
        return (own.length > 0 ? own : strong).map((c) => `${c.policyName} (${INVENTORY.policies.state[c.state] ?? c.state})`)
      })(),
      // The classifier's own answer to "which policy satisfies this goal",
      // carried so a surface never has to work it out again from a match that
      // was made for another purpose (types.ts `satisfiedBy`).
      ...(state.satisfied && result.satisfaction
        ? { satisfiedBy: { policies: result.satisfaction.policyNames, sufficient: result.satisfaction.sufficientName } }
        : {}),
      plainTitle: stepTitle(goal.name),
      forManager,
      // The lockout count is the people this policy would stop rather than
      // prompt: the strength the step will leave behind, measured against the
      // people in its own scope (roadmap/lockout.ts lockoutCount). No goal has a
      // lockout count of its own — a policy that requires no strength stops
      // nobody, and neither does work the plan cannot write.
      ...(!state.satisfied && unavailableReason(asStep) === null && stepLockout !== null ? { lockout: stepLockout } : {}),
      ...(measured !== null ? { measured: { ids: measured } } : {}),
      // A step that changes the tenant's own policy names that policy, never the
      // step's title; a step that creates one names the proposed name.
      naming:
        kind === 'create' && !state.satisfied
          ? { proposed: namingNote?.name ?? proposedPolicyName(goal, naming), fromBaseline: source?.facts.name ?? null, note: namingNote?.note ?? null }
          : kind === 'adjust' && existing && !state.satisfied
            ? { proposed: existing.policyName, fromBaseline: source?.facts.name ?? null, note: null }
            : null,
    })

    if (goal.id === 'inforcer-mfa') {
      const s = steps[steps.length - 1]
      const appId = '708861da-226e-4d65-a57a-24128df64524'
      const observed = (['ok', 'partial'].includes(snapshot.sources.appSignInSummary?.status ?? '') && snapshot.appSignInSummary.some(raw => String((raw as { appId?: string }).appId ?? '').toLowerCase() === appId))
        || (['ok', 'partial'].includes(snapshot.sources.spActivity?.status ?? '') && snapshot.spActivity.some(raw => String((raw as { appId?: string }).appId ?? '').toLowerCase() === appId))
        || (snapshot.config.caPolicies?.status === 'ok' && snapshot.config.caPolicies.rows.some(raw => ((raw as { conditions?: { applications?: { includeApplications?: string[] } } }).conditions?.applications?.includeApplications ?? []).some(id => id.toLowerCase() === appId)))
      const tenantApplicationName = [
        ...(['ok', 'partial'].includes(snapshot.sources.appSignInSummary?.status ?? '') ? snapshot.appSignInSummary : []),
        ...(['ok', 'partial'].includes(snapshot.sources.spActivity?.status ?? '') ? snapshot.spActivity : []),
      ].map(raw => raw as { appId?: string; appDisplayName?: string }).find(row => row.appId?.toLowerCase() === appId && row.appDisplayName)?.appDisplayName
      s.configurationFindings = [{ key: 'inforcerApplication', label: 'Inforcer Application', value: observed ? 'Exact application ID found' : 'Application not established', detail: observed ? `The tenant contains application ${tenantApplicationName ? `${tenantApplicationName} (${appId})` : appId}, the exact target of the pinned policy IAC - APP - inforcer - RequireMFA.` : `The current scan has no exact application match for Inforcer (${appId}). Check the enterprise application's Application ID in Entra; collect its sign-in evidence or rescan its application-scoped policy. A matching display name is insufficient.`, outcome: observed ? 'pass' : 'unknown' }]
      if (!observed) {
        s.blockers.push({ kind: 'evidence', label: 'inforcer-application', binding: BLOCKED_REASON.after('Identify the Inforcer application'), unverified: true })
        setState(s, { satisfied: false, inPlace: false, condition: 'blocked' })
      }
    }

    // The workload step restricts the identity that performs synchronization, and
    // nothing the scan reads establishes that identity or that workload Conditional
    // Access supports it (roadmap/workloadIdentity.ts): a sync role holder, a licence
    // and a provisioning object do not. Unless support is established the step holds
    // on that fact and is never completed by a policy that looks like its target; an
    // existing policy is kept unchanged while the identity is confirmed.
    if (goal.id === SYNC_WORKLOAD_GOAL_ID) {
      const s = steps[steps.length - 1]
      const identity = syncIdentitySupportOf(snapshot)
      if (identity.support !== 'supported') {
        s.blockers = [...s.blockers, { kind: 'evidence', label: WORKLOAD_IDENTITY_BLOCKER, binding: identity.support === 'unsupported' ? BLOCKED_REASON.workloadIdentityUnsupported : BLOCKED_REASON.workloadIdentityUnknown, unverified: true }]
        setState(s, { ...(s.state.satisfied ? { satisfied: false, inPlace: false } : {}), condition: conditionFor(s.blockers) })
      }
    }
  }

  // The baseline's own references only a person can answer (resolvePolicy.ts
  // `decisions`) are answered in Plan settings → Baseline mappings, not on a
  // step of the plan (S4, playbook §18.1). Each open policy that names one
  // carries it in `action.sourceReferences`; here every one is told the part it
  // plays across the baseline, read off the source policies themselves, so the
  // mapping surface can say what leaving it out does. A pending one is in
  // `missing` and holds its policy (planLanes.ts observe: a `sourceMapping`
  // blocker); no step is waited on.
  {
    const usage = new Map(referenceUsage(planPolicies as CaPolicy[]).map((u) => [u.id, u]))
    const roleOf = (id: string): Pick<SourceReference, 'role' | 'baselinePolicies' | 'baselineTotal'> => {
      const u = usage.get(id.toLowerCase())
      if (!u) return {}
      const role = u.includedIn.length > 0 && u.excludedFrom.length > 0 ? 'both' : u.includedIn.length > 0 ? 'include' : 'exclude'
      return { role, baselinePolicies: new Set([...u.includedIn, ...u.excludedFrom]).size, baselineTotal: planPolicies.length }
    }
    for (const s of steps) {
      if (!s.action.sourceReferences?.length) continue
      s.action = { ...s.action, sourceReferences: s.action.sourceReferences.map((r) => ({ ...r, ...roleOf(r.id) })) }
    }
  }

  // ---- Phase 2 verification campaign ----
  const mfaGoal = input.coverage.results.find((r) => r.goal.id === 'mfa-all-users')
  if (mfaGoal) {
    // The campaign works the active people, named (prompt 48.1 item 2), and
    // every role holder, active or not (adminCandidates, 8f440021). Never
    // break-glass: it has its own drill. Verification complete on this scan →
    // the campaign is done and the scheduler skips its window (prompt 18 §1).
    const candidates = campaignIds(viability, snapshot, mapping)
    // A role holder that signs in only to scripting tools is a script, not a person to prepare (owner item 3, derive/population.ts isActivePerson).
    const adminCandidates = [...new Set([...Object.keys(snapshot.roles.active), ...Object.keys(snapshot.roles.eligible ?? {})])].filter(id => viabilityById.has(id) && !excluded.has(id) && !viabilityById.get(id)!.readiness.automated)
    const targetEffects = [...(methodTargets.get('mfa-all-users') ?? []), ...(methodTargets.get('admins-phishing-resistant') ?? [])]
    const preparation = methodPreparation(targetEffects, [...new Set([...candidates, ...adminCandidates])], snapshot, strandContext, methodPreparationCache)
    const preparationIds = preparation.completeScope ? preparation.ids : [...new Set([...candidates, ...adminCandidates])]
    const targetsKnown = (methodTargets.get('mfa-all-users')?.length ?? 0) > 0 && (!steps.some(s => s.id === 's-goal-admins-phishing-resistant') || (methodTargets.get('admins-phishing-resistant')?.length ?? 0) > 0)
    const preparedSet = new Set(targetsKnown ? preparation.readyIds : [])
    const registrationKnown = preparation.completeScope && preparation.unknownIds.length === 0 && targetsKnown
    const campaignReading = methodReadiness('mfa', { ...preparation, ids: preparationIds, readyIds: [...preparedSet], completeScope: preparation.completeScope && targetsKnown })
    // The campaign moves the number the policies wait on, and its reading
    // carries what the scan could not read the same way theirs does (R4-20).
    const campaignBlind = blindOf(campaignReading, snapshot)
    const verifyReadiness: Step['readiness'] = campaignBlind === null ? campaignReading : { ...campaignReading, blind: campaignBlind }
    // Required whenever anyone enabled still has to be set up (ux-review-04 §2):
    // the Overview sentence, the blocked-step reasons and the pace all read
    // from this one number.
    // The active people not Ready yet (scoring/phishingResistant.ts): the one
    // count MFA Readiness and the MFA gate read, not a second "to set up".
    const toSetUp = preparationIds.length - preparedSet.size
    // Or everyone ready but the people a person marked to turn on without, for
    // now (roadmap/followUp.ts, owner decision 9): one person on leave no longer
    // holds every policy that waits on the campaign. Still over a scope the scan
    // settled and targets it read — marking cannot finish a campaign nobody
    // could count.
    const followUpIds = preparation.completeScope && targetsKnown ? followUpIdsOf(preparationIds, preparedSet, mapping) : []
    const marked = new Set(followUpIds)
    const verifyDone = (registrationKnown && toSetUp === 0) || (followUpIds.length > 0 && preparationIds.every((id) => preparedSet.has(id) || marked.has(id)))
    // The role holders the campaign prepares outside its active people, by what
    // the scan read of them (R4-52): dormant by the dormant step's own rule
    // (derive/sets.ts notActiveUsers, which judges activity only where it was
    // read), or with sign-in activity the scan could not read at all
    // (scoring/mfaViability.ts activity 'unknown'). The step names the ones it
    // waits on in those words; it never calls an unread account dormant.
    const dormantSet = new Set(dormant.map((u) => u.id))
    steps.push({
      ...prereq('s-verify-mfa'),
      title: 'Prepare Your Team for MFA',
      preparation: {
        ids: preparationIds,
        readyIds: [...preparedSet],
        missingIds: preparationIds.filter(id => !preparedSet.has(id)),
        unknownIds: targetsKnown ? preparation.unknownIds : preparationIds,
        guestIds: preparationIds.filter(id => popIndex.guests.has(id)),
        dormantIds: preparationIds.filter(id => dormantSet.has(id)),
        activityUnreadIds: preparationIds.filter(id => viabilityById.get(id)?.activity === 'unknown'),
        ...(followUpIds.length > 0 ? { followUpIds } : {}),
      },
      phase: 2,
      kind: 'verify',
      goalId: 'mfa-all-users',
      ...stateFields(verifyDone ? { satisfied: true } : {}),
      deliveredBy: verifyDone ? [toSetUp === 0 ? 'Every person in the preparation cohort has a suitable registered authentication method.' : 'Every person in the preparation cohort is ready, or marked to turn on without for now.'] : [],
      // Every account the campaign prepares, as its lead and its row count them
      // (stepVars {cohort}, rowWho): one population. population() counted the
      // active ones only, so on the large tenant the tile read "4,169 active
      // people" beside a lead of "3,981 people and 197 guests", nine admins
      // apart and none of them named; where sign-in activity was not read it
      // read "No user impact" over a campaign waiting on 48 admins. The head
      // says "active people" only where every one of them is (namedAccounts).
      population: namedAccounts(preparationIds, popIndex),
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
      // What the step waits on is what its policies ask for: a policy that asks
      // for a sign-in method waits for people to have one. The goal's family
      // answers only for a step with no policy of its own.
      const effects = effectsOf(s)
      const family = familyReading(s)
      const asksForMethod = effects !== null ? effects.some((e) => e.asksForMethod) : family === 'mfa' || family === 'guest'
      if (!asksForMethod) continue
      // Only ever a backward edge. A phase 0 step (security-info registration)
      // that waits on the phase 2 campaign would order the plan against itself;
      // it keeps the readiness reason without the dependency.
      if (s.phase < verifyStep.phase) continue
      if (!s.blockedBy.includes(verifyStep.id)) s.blockedBy.push(verifyStep.id)
    }
    // And every gate the campaign moves says so. A gate stated what it waits
    // for and never what opens it: seven steps of one plan waited on MFA
    // readiness while the campaign that raises it sat Ready on the same board,
    // named by none of them, and sixteen of another waited on a number the scan
    // could not read with nothing saying who would change it.
    //
    // Keyed on the MEASURE, not on the step's own effects or its status. The
    // campaign's cohort is the MFA candidates and the admin candidates together
    // (its `preparation` above), and guests are counted inside it, so those
    // three families are moved there by construction. The edge above cannot
    // answer this: it is drawn only for a BLOCKED step, and a policy already
    // sitting in report-only under an unmet threshold — the state the whole
    // rollout waits in — keeps the gate and never gets the edge. Device is the
    // one family no step of this plan moves; it keeps the route to Intune
    // (CONTRACT.readinessRoute).
    const movedByCampaign = new Set(['mfa', 'guest', 'admin'])
    for (const s of steps) {
      const gate = s.action.readinessGate
      // Not where the scan could not read the source (`blind`): nothing moves
      // that number until the source can be read, and naming a campaign beside
      // it sends the reader to do work that will not change it.
      if (gate === undefined || gate.route !== undefined || gate.blind !== undefined) continue
      // The gate's own family: its measure may name a strength rather than the family (R4-26).
      const family = readinessFamilyOf(gate)
      if (family === undefined || !movedByCampaign.has(family)) continue
      // "Moved there by construction" is the claim this checks. The campaign
      // prepares the people the scan has seen sign in; this gate counts everyone
      // its target policy covers. Where the campaign's cohort cannot close the
      // gap, naming it sends the reader to finish a step that will not move the
      // number — which is what happened: "Nothing left to do" on the campaign,
      // and the gate still reading 18%.
      const cohort = verifyStep.preparation
      const mine = s.methodPreparation
      const threshold = Number.parseInt(gate.threshold, 10)
      const shortfall = cohort && mine && Number.isFinite(threshold)
        ? routeShortfallOf(mine, cohort, verifyStep.title, threshold)
        : null
      s.action = { ...s.action, readinessGate: { ...gate, ...(shortfall === null ? { route: verifyStep.title, routeId: verifyStep.id } : { routeShortfall: shortfall }) } }
    }
  }
  // The people turned on without, on every policy that waited for them.
  settleFollowUp(steps)

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
    if (s.state.satisfied || s.state.setAside) return
    if (dependsOn && !s.blockedBy.includes(dependsOn)) s.blockedBy.push(dependsOn)
    if (!s.blockers.some((b) => b.kind === 'readiness' && b.label === label)) {
      s.blockers.push({ kind: 'readiness', label, ...(binding ? { binding } : {}) })
    }
    raiseCondition(s, 'blocked')
  }

  // 0. A goal whose baseline policy contradicts its own documentation
  // (baselineConflict.ts): the step keeps its evidence and loses its
  // implementation. Not a readiness wait and not a step dependency — the cause
  // is the baseline, so it is neither counted with the tenant's readiness waits
  // nor drawn as an edge to a prerequisite. Forced after every other state,
  // including done: a policy the tenant already holds cannot make a
  // contradictory definition safe to act on.
  for (const s of steps) {
    const conflictSource = typeof s.goalId === 'string' ? (conflictGoals.get(s.goalId) ?? null) : null
    if (conflictSource === null || s.state.setAside) continue
    s.action = { kind: s.action.kind, summary: [], json: null, portalSteps: [] }
    s.deliveredBy = []
    // And the delivery claim goes with the implementation, for the same reason.
    // The coverage verdict above may well have found a tenant policy that looks
    // like this goal and marked the step satisfied — but "satisfied" means the
    // tenant holds what the baseline asks for, and the baseline asks for two
    // different things. A policy matching one of them proves the goal is met
    // only if IAMAI first picks which one was meant, which is the one thing it
    // will not do. So no delivery is claimed, no policy is named as delivering
    // it, and no rollout stage is reported for a rollout the plan refuses to
    // define (Foundation B: no lifecycle progress on a resolution step).
    // Withdrawing this is conservative in the one direction that matters: it
    // never turns an unknown into "already done".
    // The reviewed source that raised it travels with the condition, so every
    // surface can say *which* contradiction this step carries without reading
    // the goal id or the pinned map again (baselineConflict.ts).
    setState(s, { satisfied: false, inPlace: false, lifecycle: null, conflictSource })
    delete s.satisfiedBy
    // The safety edges stay (a deny-capable step still waits on the escape
    // hatch); the conflict is added beside them and binds the row's reason
    // ahead of any of them (stateReason.ts), so the cause a person reads is the
    // baseline's, never a prerequisite in their tenant.
    if (!s.blockers.some((b) => b.label === BASELINE_CONFLICT)) s.blockers.push({ kind: 'evidence', label: BASELINE_CONFLICT, binding: BLOCKED_REASON.baseline })
    raiseCondition(s, BASELINE_CONFLICT)
  }

  // 1. Security-info registration is the policy that asks for MFA in order to
  // register MFA. It waits for a way out to exist (Temporary Access Pass), for
  // a trusted location to mean something, and for the people with no method to
  // have one (steps/security-info-registration.md).
  const registrationStep = steps.find((s) => s.goalId === 'register-info-protected')
  if (registrationStep) {
    if (tapEnabled === false) blockLate(registrationStep, 'registration-no-tap', BLOCKED_REASON.exist(1, 'Temporary Access Pass policy', 0))
    const withoutMethod = viability.filter((v) => isActivePerson(v) && v.mfa === 'none').length
    // A reason, not a dependency edge: the campaign sits in a later phase, and
    // pointing a phase 0 step at it would order the plan against itself.
    if (withoutMethod > 0) blockLate(registrationStep, 'registration-coverage', BLOCKED_REASON.reaches('people without a method', '0', String(withoutMethod)))
    // The count is only the nearest cause where nobody is being sent to create
    // the location: with Define the Trusted Network on the plan the step already
    // shows that prerequisite, and "when 1 trusted location exist (now 0)" beside
    // it is the same sentence again (docs/plans/step-redundancy-analysis.md
    // finding 3).
    // A network step that does not apply (everyone remote) is not work to do:
    // it counts as done here, so the tenant with no trusted location keeps the
    // hold (V1 decision 6).
    const locationStepToDo = steps.some((s) => s.id === locStepId && s.status !== 'done' && s.doesntApply == null)
    if (trustedLocationCount === 0 && !doesntApply(locStepId) && !locationStepToDo) blockLate(registrationStep, 'registration-no-trusted-location', BLOCKED_REASON.exist(1, 'trusted location', 0))
  }

  // The countries location, as the countries policy's own first task (Stage 3,
  // V1 decision 5). The step carries the location's reading for the screen
  // (Step.objectTask) and asks the work countries itself: until at least one is
  // saved by a person it reads Needs decision, as the location step and the
  // Direction question it came from both did. The picker keeps saving under the
  // location's old id (decisions.ts DECISION_STEPS.countries). An older plan
  // that mixed work and travel countries asks for them again, as before.
  const geoStep = steps.find((s) => s.goalId === 'geo-restriction' && s.id === idFor('goal', 'geo-restriction')) ?? null
  if (geoStep && countriesTask) {
    geoStep.objectTask = countriesTask
    const workCountriesSaved = mapping.allowedCountries.length > 0 && (mapping.workCountriesConfirmed === true || (mapping.wizardAnswered.countries === true && mapping.assumed?.countries !== 'detected'))
    const open = geoStep.status !== 'done' && geoStep.status !== 'skipped' && !geoStep.state.satisfied && !geoStep.state.setAside && geoStep.state.lifecycle !== 'enforced'
    const review = countriesTask.blockers.find((b) => b.label === 'work-countries-review')
    if (open && (!workCountriesSaved || review)) {
      geoStep.blockers.push(review ?? { kind: 'decision', label: 'work-countries', binding: BLOCKED_REASON.workCountries })
      setState(geoStep, { condition: 'needs-decision' })
    }
  }
  // Its checks are 6.3's (blockerSteps.ts attachConfigurationFindings, through
  // the location's old repair id). Only the blocking one, a list with no
  // country in it (cty.atLeastOne), keeps it from reading Completed and holds
  // its turn-on (countries-unsafe, below). The three warnings — the countries
  // people sign in from, your own, unknown countries — draw as Needs
  // Correction and hold nothing in v1.0 (owner, 2026-09-23; gating the turn-on
  // on the first two is on docs/plans/roadmap-flow/v1.1-list.md).
  attachConfigurationFindings(steps, validationReports.filter((r) => r.subject === 'allowedCountries'))

  // 2. No country block before the operator's own recent countries are in the
  // allow list, and before the list itself passes its checks.
  //
  // Only a policy that names the countries location can be hurt by a bad list
  // (Stage 3): by its resolved id, or — while there is none yet — by the
  // reference the countries step makes (resolvePolicy.ts: its maker is 6.3). It held every policy that names any place — registration protection,
  // which names only the trusted network, waited on the countries step with an
  // empty list — and a list of countries changes nothing those policies do.
  // On the countries policy itself, which makes the list, it holds the turn-on
  // and never the report-only creation, and it is no wait on itself.
  const countriesReport = validationReports.find((r) => r.subject === 'allowedCountries')
  if (countriesReport && countriesReport.blocking.length > 0) {
    const locationId = countriesLocationId?.toLowerCase() ?? null
    const namesCountriesLocation = (s: Step): boolean =>
      (s.action.missing ?? []).some((m) => m.token === '{allowedCountriesLocation}' || (geoStep !== null && m.stepId === geoStep.id)) ||
      (locationId !== null && (s.action.resolution?.policies ?? []).some((o) => JSON.stringify((o.body as { conditions?: { locations?: unknown } } | undefined)?.conditions?.locations ?? null).toLowerCase().includes(locationId)))
    for (const s of steps) {
      if (s.id === geoStep?.id) {
        if (s.state.satisfied || s.state.setAside) continue
        // What the turn-on waits for is the step's own location task, named by
        // the title its task list shows: the location is no step of the plan
        // any more, and its old title named one (D3).
        const taskTitle = stepById[countriesStepId]?.taskTitle
        if (!s.blockers.some((b) => b.kind === 'readiness' && b.label === 'countries-unsafe')) {
          s.blockers.push({ kind: 'readiness', label: 'countries-unsafe', binding: taskTitle ? BLOCKED_REASON.after(taskTitle) : BLOCKED_REASON.workCountries })
        }
        // While no work country is saved the step's question comes first (it
        // reads Needs decision above), as it does with no list at all: an empty
        // list is that same unanswered question, not a second, blocked state.
        if (s.state.condition !== 'needs-decision') raiseCondition(s, 'blocked')
      } else if (namesCountriesLocation(s)) blockLate(s, 'countries-unsafe', null, geoStep?.id ?? canonicalBlockerStepId('allowedCountries'))
    }
  }

  // 3. Security defaults come off before any Conditional Access policy: with
  // them on, a policy can be created and cannot be turned on.
  // It reads the scan, never the step: on, or not read, holds; read off holds
  // nothing, whatever the step's row says — Completed on a plan that saw them
  // on, Doesn't apply on one that never did (V1 decision 6).
  const secDefaultsStep = steps.find((s) => s.id === 's-prereq-security-defaults')
  const secDefaultsReadOff = snapshot.config.securityDefaults?.status === 'ok' && secDefaults?.isEnabled === false
  if (secDefaultsStep && !secDefaultsReadOff) {
    for (const s of steps) {
      if (s.kind !== 'create' && s.kind !== 'adjust') continue
      blockLate(s, 'security-defaults-first', null, secDefaultsStep.id)
    }
  }

  // 4. No session control that can put the person applying it in a loop:
  // sign-in every time without MFA in the same policy is Microsoft's own
  // documented hazard (steps/session-controls.md).
  for (const s of steps) {
    // The policy the step will actually leave behind decides: a sign-in
    // frequency of "every time" with nothing granting a way through is the loop,
    // whatever the goal's floor was written as. The floor answers only for a
    // step with no policy of its own (roadmap/operations.ts stepEffects).
    const effects = effectsOf(s)
    const loops =
      effects !== null
        ? effects.some((e) => e.sessionControls?.signInFrequencyEveryTime === true && !e.asksForMethod)
        : (() => {
            const floor = input.coverage.results.find((r) => r.goal.id === s.goalId)?.goal.implementations[0]?.floor
            return floor?.session?.signInFrequencyEveryTime === true && floor.grant === undefined
          })()
    if (loops) blockLate(s, 'session-loop', BLOCKED_REASON.after(shared.sessionLoopHold as string))
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
  const activeTotal = viability.filter(isActivePerson).length
  const ringCtx = {
    snapshot,
    viability: viabilityById,
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
  // And a step whose enforcement waits on a readiness threshold has no rings
  // either: the rings are the rollout of that enforcement, and dating them is
  // the promise that it lands (roadmap/operations.ts enforcementHeld).
  for (const s of steps) {
    const unavailable = unavailableReason(s) !== null
    s.rings = unavailable || enforcementHeld(s) ? [] : proposeRings(s, ringCtx)
    if (unavailable) delete s.lockout
  }

  // ---- Schedule: the dependency graph places every ring (roadmap-v2.md §2) ----
  const rhythm = tenantRhythm(snapshot, mapping.displayTimeZone)
  // The registration window is sized by who still needs a proven method: five
  // a working day, at most twenty working days, alongside the first soak
  // (target-state §9). Never by the size of the tenant.
  const toSetUpIds = steps.find(s => s.id === 's-verify-mfa')?.preparation?.missingIds ?? viability.filter((v) => rolloutBucket(v) !== null && !isReady(v.readiness.state)).map((v) => v.userId)
  const registration = registrationWindow(toSetUpIds)
  // A step the person said does not apply here leaves its phase for the footer:
  // it takes no slot and nothing waits on it.
  for (const s of steps) {
    if (!doesntApply(s.id)) continue
    s.doesntApply = notApplicable[s.id].trim()
    s.skipReason = s.doesntApply
    setState(s, { setAside: true })
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
    setState(s, { setAside: true })
  }
  if (canUseConditionalAccess && devicePlan?.phones === 'none') steps.push(prereq('s-ladder-phone-access-restriction'))
  // Define Your Rollout Scope (roadmap/direction.ts): the four decision
  // steps, and the review rows whose services D1 asks about.
  if (canUseConditionalAccess) {
    steps.unshift(...directionSteps({ snapshot, mapping, notAssessed: input.coverage.organisation.notAssessed, availableGoalIds: input.coverage.results.filter((r) => r.status !== 'licence-limited').map((r) => r.goal.id), nameOf }))
    addWorkflowSteps(steps, input.coverage.organisation.notAssessed, mapping, input.manualConfirmations)
  }
  applyManualReviews(steps, snapshot, input.manualConfirmations, mapping, popIndex)
  for (const s of steps.filter(s => s.id === 's-check-dormant-accounts')) {
    const dormantIds = new Set(dormant.map(u => u.id))
    const reviewed = mapping.dormantAccountChoices ?? {}
    const accounts = snapshot.users.filter(u => dormantIds.has(u.id) || Object.hasOwn(reviewed, u.id))
    s.dormantChoices = accounts.map(u => ({ id: u.id, name: nameOf(u.id), outcome: reviewed[u.id]?.outcome ?? '', reason: reviewed[u.id]?.reason ?? '', disabled: u.accountEnabled === false }))
    const remaining = accounts.filter(u => dormantIds.has(u.id) && u.accountEnabled !== false && !(reviewed[u.id]?.outcome === 'keep' && reviewed[u.id].reason.trim()))
    // The dormant step names never-signed-in accounts (§8.1, and the dormant
    // step above sets the same builder): `population()` derives activeIds from
    // the active index, which is empty for dormant accounts by definition, and
    // the who-line then read "No user impact" over a step naming N accounts to
    // disable (V1 audit S4-21). The accounts it names are its impact, and its
    // admins and guests are counted over them (derive/population.ts namedAccounts).
    s.population = namedAccounts(accounts.map(u => u.id), popIndex)
    delete s.manualReview
    // The accounts the list could not judge. The directory read falls back to a
    // user list without signInActivity where Graph refuses that property
    // (graph/collect/collectors.ts collectUsers), and the Users source is then
    // `partial` with the refusal as its reason — the only way it is ever partial
    // (graph/collect/worker.ts). Nobody's activity was read, so nobody is listed
    // (derive/sets.ts notActiveUsers), and the step read "Ready · Review" over no
    // accounts, told the reader to review "each account IAMAI lists", and said
    // the refusal nowhere (R4-49). An empty list made that way is not a
    // directory with nothing dormant. The step now says how many accounts it
    // could not judge, why, and what reads them; and where nothing is left
    // listed to review, the read is the only thing it waits on, so it holds on
    // that fact the way the passkey settings step holds on an unread methods
    // policy. It finishes only on a whole read, as before.
    //
    // Only on that fallback. On a read that succeeded, Graph leaves
    // signInActivity out for an account that never signed in (Microsoft Learn,
    // user resource), so an account without it there was read, not unread.
    const users = snapshot.sources.users
    const unread = users?.status === 'partial' ? activityUnreadUsers(snapshot, notPeopleIds(mapping)) : []
    if (unread.length > 0) {
      s.configurationFindings = [{
        key: 'activity-unread',
        label: engine.readiness.activityUnreadLabel,
        value: engine.readiness.activityUnreadValue,
        detail: fillText(engine.readiness.activityUnread, { n: unread.length, total: enabledUsers(snapshot, notPeopleIds(mapping)).length, reason: users?.reason ?? users?.status, fix: sourceReadFix('users', snapshot, 'entraP1') }),
        outcome: 'unknown',
      }]
      if (remaining.length === 0) {
        s.blockers = [...s.blockers, { kind: 'evidence', label: 'activity-unread', binding: BLOCKED_REASON.activityUnread, unverified: true }]
        setState(s, { condition: conditionFor(s.blockers) })
      }
    }
    const complete = remaining.length === 0 && snapshot.sources.users?.status === 'ok'
    setState(s, { satisfied: complete, inPlace: complete })
    if (complete) s.deliveredBy = [accounts.length === 0 ? 'The scanned directory has no outstanding dormant accounts.' : 'Every listed dormant account is disabled, active again, or retained with a recorded reason.']
  }
  // No Entra ID P1, no plan (owner, 2026-09-20). Three non-policy steps survive
  // the gates above — dormant accounts, administrator separation, the MFA
  // campaign — and each is real advice. Presented as "the plan" to a tenant that
  // came for Conditional Access and cannot have it, they are the half-baked
  // opinion the owner would rather not give: the board, the lanes and the dates
  // all render around three steps that are not the thing being asked for. The
  // surfaces say what is needed instead (derive/notLicensed.ts).
  //
  // One rule in one place, and it is the whole switch.
  if (!canUseConditionalAccess) steps.length = 0
  // Per-answer gating (roadmap/direction.ts gateOnDirection) runs once tracking
  // has settled each policy's lifecycle (roadmap/progress.ts applyProgress): an
  // enforced policy is never held by it, and the schedule never reads it.
  const schedule = buildSchedule(steps, startIso, activeTotal, input.band ?? null, {
    freeze: input.changeFreeze ?? null,
    rhythm,
    registrationDays: registration.workingDays,
    firstDeployment: input.firstDeployment ?? null,
    // Today in the display zone, from the one review instant (the scan's own time
    // where none is given, as every other "now" here): nothing unfinished is
    // placed before it, however long ago the plan was started.
    today: proposedStart(mapping.displayTimeZone ?? null, new Date(input.reviewNow ?? snapshot.asOf)),
  })
  schedule.rhythm = rhythm
  // Cleanup (target-state §5, §9): dated after the last enforcement window, one
  // working day per row; the header's finish date includes it (derive/finish.ts).
  // The consolidation row exists whenever a step's existingCoverage line rendered
  // (E3): the policies a step found already covering its goal, which the
  // baseline's version supersedes once enforced. A done step cites its
  // policies as what makes it In place, not as overlap.
  const recoveryPreparedAt = Object.fromEntries(mapping.breakGlassUserIds.map(id => [id, recoveryPreparation(id, input.cleanupRecord?.records ?? [], input.reviewNow ?? snapshot.asOf, recoveryBasis[id], snapshot.tenantId, 'final')?.configurationObservedAt ?? null]))
  schedule.cleanup = cleanupPhaseFor({
    after: schedule.targetEnd,
    early: input.reviewNow ?? snapshot.asOf,
    hardeningTracked: !!input.hardeningDeferral,
    hardeningVerified: !!bgStep?.emergency && bgStep.emergency.hardening === 0 && bgStep.emergency.accounts.length > 0 && bgStep.emergency.accounts.every(account => account.assessed),
    rhythm,
    emergencyAccountIds: mapping.breakGlassUserIds,
    accountBasis: recoveryBasis,
    recoveryCandidateSetBasis,
    signInEvidenceSource: recoveryEvidenceSource(snapshot),
    recoveryFindings: bgReport ? journeyRecoveryFindings(bgReport, snapshot, mapping, input.groupMembers, input.cleanupRecord?.records ?? [], input.reviewNow ?? snapshot.asOf) : undefined,
    recoveryCandidates: Object.fromEntries(mapping.breakGlassUserIds.map(id => [id, recoveryCandidateReadings(snapshot, id, input.reviewNow ?? snapshot.asOf, recoveryPreparedAt[id])])),
    preChangeRecoveryCandidates: {},
    tenantId: snapshot.tenantId,
    configurationObservedAtByAccount: recoveryPreparedAt,
    preChangeConfigurationObservedAtByAccount: {},
    snapshotObservedAt: snapshot.asOf,
    policies: snapshot.config.caPolicies.status === 'ok' ? snapshot.config.caPolicies.rows : null,
    emergencyAccounts: mapping.breakGlassUserIds.map(nameOf),
    emergencyAccountUpns: mapping.breakGlassUserIds.map((id) => userById.get(id)?.userPrincipalName ?? nameOf(id)),
    organisation: input.coverage.organisation,
    superseded: supersededPolicies(steps),
    done: input.cleanupRecord?.done ?? {},
    records: input.cleanupRecord?.records ?? [],
    now: input.reviewNow ?? snapshot.asOf,
    // Deferred emergency-access hardening stays in view until it passes (owner, 2026-09-11).
    hardening: bgStep?.emergency?.deferredAt ? deferredHardeningLines(bgStep, nameOf) : [],
    // An emergency account the tenant excluded by name stays in every correction
    // (a correction never removes a tenant exclusion; owner, 2026-09-19): this row
    // asks for the name to come out once the exclusions group covers the account.
    namedExclusions: namedEmergencyExclusions(snapshot.config.caPolicies.status === 'ok' ? snapshot.config.caPolicies.rows : null, mapping.breakGlassUserIds, nameOf),
  })
  const waveStart = new Map(schedule.waves.map((w) => [w.wave, w.start]))
  for (const s of steps) {
    // Comms per ring, dated (§4.11); the step's own announcement is the first ring's.
    //
    // The day only. What that day is worth is not settled here: Foundation B's
    // lifecycle is still `not-deployed` on every step at this point in the
    // generator — tracking advances it afterwards (roadmap/progress.ts) — so a
    // draft classified here would call every step's date a projection and every
    // enforced policy's date a projection with it. The reader classifies, on the
    // finished plan (ui/surfaces/stepExport.ts `commsFor`).
    if (s.comms?.includes('{DATE}')) {
      const template = s.comms
      // A step the schedule did not place (skipped, or sent to the footer by an answer) has undated rings: the wave's start or the plan's stands in.
      const firstDate = [s.rings[0]?.plannedStart, waveStart.get(schedule.waveOf[s.id] ?? 0), startIso].find((d): d is string => typeof d === 'string' && !Number.isNaN(Date.parse(d))) ?? startIso
      s.comms = template.replaceAll('{DATE}', absoluteDate(firstDate))
    }
    // A change to an existing policy has no ring of its own: its dates come from where the schedule placed it.
    s.events = eventsFor(s, { rhythm, timeZone: displayZone(mapping.displayTimeZone) }, s.kind === 'adjust' ? (schedule.startAt[s.id] ?? null) : null)
    // The report-only deployment day, off the schedule and onto the step: the
    // Dates line, the calendar entry and the step's values all read this one.
    s.reportOnlyAt = schedule.reportOnlyAt[s.id] ?? null
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
      // A qualifying method not yet confirmed everywhere the person signs in (Confirm it, Needs a device; prompt 62).
      const unproven = viability.filter((v) => rolloutBucket(v) !== null && (v.readiness.state === 'confirm' || v.readiness.state === 'device') && !bgSet.has(v.userId)).map((v) => v.userId)
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
  // A conditional input nobody saved (U28): the step names it, and the lane
  // engine keeps the step short of Completed and Ready to enforce until a Save.
  for (const s of steps) {
    const open = openInputsOf(s.id, mapping)
    if (open.length === 0) continue
    s.unsavedInputs = open.map((input) => input.label)
    // Whether the row should say "confirm" or "answer": IAMAI filled the
    // campaign's support list from readiness and is waiting on a Save, and a
    // row reading "waiting on your answer" over ten names IAMAI worked out
    // itself names the wrong party.
    if (open.every((input) => input.prefilled)) s.unsavedInputsPrefilled = true
  }
  annotateStateReasons(steps)
  // The finished reading belongs to a finished step (types.ts
  // `enforcedBelowReadiness`). It is set where the gate is, while the goal
  // reads satisfied, and several later passes take satisfaction back (a guest
  // goal an all-users policy covers is held for its own questions): left on,
  // it is a guest percentage measured over everybody, waiting for a reader.
  for (const s of steps) if (!s.state.satisfied && s.action.enforcedBelowReadiness) { const { enforcedBelowReadiness: _, ...rest } = s.action; s.action = rest }
  // What turning each policy on still waits on, from the plan's own Cleanup
  // record and the scan (roadmap/enforceWaits.ts): here, where the drill row
  // and every title exist. It holds the turn-on in every channel
  // (operations.ts `policyResult`, hold `prerequisite-unmet`) and nothing else.
  settleEnforceWaits(steps, schedule, mapping)
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

/**
 * Every tenant policy carrying this plan's tag for this step, and which member
 * of the step each one says it is.
 *
 * The tag used to name the plan and the step alone, so both halves of a pair
 * carried the same one and nothing told them apart. It now names the member too
 * (`buildCreateAction`), and this reads either: `memberKey` is null for a policy
 * created before members were tagged, which says the tag proves the step and not
 * which required policy of it — the caller has to establish that some other
 * exact way, or leave the member unresolved.
 */
export function findTaggedPolicies(snapshot: TenantSnapshot, planId: string, stepId: string): { policyId: string; memberKey: string | null }[] {
  const escape = (v: string): string => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\[IAMAI:${escape(planId)}:${escape(stepId)}(?::([A-Za-z0-9_-]+))?\\]`)
  const out: { policyId: string; memberKey: string | null }[] = []
  for (const raw of snapshot.config.caPolicies?.rows ?? []) {
    const p = raw as { id?: string; description?: string }
    if (typeof p.description !== 'string' || typeof p.id !== 'string') continue
    const m = re.exec(p.description)
    if (m) out.push({ policyId: p.id, memberKey: m[1] ?? null })
  }
  return out
}

/**
 * The first tenant policy carrying this plan's tag for this step, whichever
 * member it is. Kept for the goal-level readings that predate members (the
 * step's own evidence lines); anything that has to know *which* required policy
 * an object is reads `findTaggedPolicies`.
 */
export function findTaggedPolicy(snapshot: TenantSnapshot, planId: string, stepId: string): string | null {
  return findTaggedPolicies(snapshot, planId, stepId)[0]?.policyId ?? null
}
