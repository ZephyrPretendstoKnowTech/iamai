// Step generation (roadmap.md §1–§6; 2026-08-27 redesign: collapsed phase 0,
// per-tenant impact, safe-today lane, handle-with-care gating, comms drafts,
// operator self-safety, Learn links, auto-scheduling). Pure.
import { docFor } from '../baseline/index.ts'
import type { BaselinePackage } from '../baseline/types.ts'
import { CORE_ADMIN_ROLE_IDS, matchesSignature } from '../coverage/classify.ts'
import { placeholdersIn, resolveTemplate } from './template.ts'
import { BLOCKED_REASON, READINESS_MEASURE } from '../copy/reasons.ts'
import type { TemplateBody, TemplatePlaceholder, TemplateValues } from './template.ts'
import { policyFacts } from '../coverage/facts.ts'
import type { StrengthLookup } from '../coverage/strength.ts'
import type { CoverageReport, Goal, GoalResult } from '../coverage/types.ts'
import { resolvePopulation } from '../coverage/population.ts'
import type { GroupMembers } from '../coverage/population.ts'
import { proposeRings, ringContextIndexes } from './rings.ts'
import { heldBy, isNonPerson, notActiveUsers } from '../derive/sets.ts'
import { accountVerdict } from './strand.ts'
import { policyCountFor } from './policyCount.ts'
import { describePopulation, populationContext } from './population.ts'
import { failureModesFor, helpDeskFor, verifyFor } from './content.ts'
import { ROLLBACK_V2, WHAT_CHANGES } from '../copy/stepContent.ts'
import { NAMING } from '../copy/schedule.ts'
import { tenantRhythm } from './rhythm.ts'
import { eventsFor } from './timing.ts'
import { DEFAULT_REVERT_PERCENT } from './watch.ts'
import { SAFE } from '../copy/timing.ts'
import { MANAGER, plainTitleFor } from '../copy/plain.ts'
import { countryName as countryLabel } from '../mapping/countries.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingQuestion, MappingState } from '../mapping/types.ts'
import { activeWizardQuestions } from '../mapping/wizard.ts'
import type { WizardQuestionId } from '../mapping/wizard.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { adminUserIds, learnRoleNames, roleListSummary } from '../roles.ts'
import { proposedPolicyName } from '../coverage/naming.ts'
import { rolloutBucket, summarizeTenant } from '../scoring/mfaViability.ts'
import type { NameDirectory } from '../names.ts'
import { coversAdminSet, roleLabel } from '../roles.ts'
import { countryName, isAllowlistGeoPolicy, isCountryLocationRef, tenantCountryLocation } from '../mapping/countries.ts'
import { absoluteDate } from '../copy/dates.ts'
import { ACTION, CARE, COMMS, EMERGENCY_DONE_WHEN, EVIDENCE, EXIT, IMPACT, PORTAL_WORDS, PREREQ, ROLLBACK, TEMPLATE_LABEL, UNBLOCK, stepTitle } from '../copy/steps.ts'
import { detectHighCare } from '../derive/highCare.ts'
import { checksNotRun } from '../validation/report.ts'
import {
  BREAK_GLASS_DRILL_DAYS,
  EXIT_MIN_DAYS_OBSERVED,
  EXIT_MIN_SIGNINS_ABSOLUTE,
  EXIT_SIGNINS_PER_ACTIVE_USER,
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
import { sharedDeviceIds, sharedDeviceUsers } from '../derive/sharedDevices.ts'
import { staticViolations } from './staticRules.ts'
import { DATE_NOTE } from '../copy/steps.ts'
import { buildSchedule, nextMonday } from './schedule.ts'
import type { ChangeFreeze, Schedule } from './schedule.ts'
import type { Action, Blocker, Readiness, Step, StepPopulation, StepStatus } from './types.ts'
import type { SizeBand } from './constants.ts'
import { ADJUST, BLOCKED, BLOCKER, OPERATOR } from '../copy/steps.ts'
import { INVENTORY } from '../copy/inventory.ts'
import { annotateStateReasons } from './stateReason.ts'
import { scoreResult } from './score.ts'
import { NO_ANNOUNCEMENT, announcementFor } from '../copy/announcements.ts'
import { proposedGroupName, proposedLocationName, proposedStrengthName } from '../coverage/naming.ts'
import { NAMING as STEP_NAMING } from '../copy/steps.ts'
import { NAMED_BELOW } from './comms.ts'
import { registrationWindow } from './campaign.ts'
import { SETUP_QUESTIONS } from '../copy/setup.ts'
import { ladderSteps } from './ladder.ts'
import { GATING_SUBJECTS, attachWarnings, blockerStepId, blockerSteps, gateReason } from './blockerSteps.ts'
import { BLOCKER_STEP } from '../copy/validation.ts'
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
  questions: MappingQuestion[]
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
export const DRILL_STEP_ID = 's-recurring-break-glass-drill'
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
 * Mirrors audiencesFor in comms.ts deliberately: NAMED_BELOW is the same
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
  let active = 0
  let admins = 0
  let guests = 0
  for (const id of ids) {
    if (index.active.has(id)) active += 1
    if (index.admins.has(id)) admins += 1
    if (index.guests.has(id)) guests += 1
  }
  return { total: ids.length, active, admins, guests, ids }
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

/** Placeholder token for a baseline reference no Setup answer has resolved yet — never a GUID. */
export function setupToken(questionNumber: number, role: string): string {
  return `__IAMAI_SETUP_QUESTION_${questionNumber}_${role.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}__`
}

export type Placeholders = Map<string, { label: string; token: string }>

function replaceReferences(policy: RawPolicy, mapping: MappingState, placeholders: Placeholders = new Map()): RawPolicy {
  const resolved = new Map<string, string>()
  for (const r of Object.values(mapping.records)) {
    if (r.resolvedId !== null && !r.placeholder.startsWith('__')) resolved.set(r.placeholder, r.resolvedId)
  }
  for (const [id, p] of placeholders) if (!resolved.has(id)) resolved.set(id, p.token)
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

function unmappedKeysUsedBy(policy: RawPolicy, questions: MappingQuestion[], mapping: MappingState): string[] {
  const text = JSON.stringify(policy)
  return questions
    .filter((q) => {
      const r = mapping.records[q.key]
      const answered = r !== undefined && (r.resolvedId !== null || r.doesNotExist)
      return !answered && text.includes(q.key)
    })
    .map((q) => q.key)
}

function createdWithinStepKeys(policy: RawPolicy, mapping: MappingState): { key: string; group: string }[] {
  const text = JSON.stringify(policy)
  return Object.values(mapping.records)
    .filter((r) => r.doesNotExist && !r.placeholder.startsWith('__') && text.includes(r.placeholder))
    .map((r) => ({ key: r.placeholder, group: r.group }))
}

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN_RE = /^__IAMAI_SETUP_QUESTION_(\d+)_(.+)__$/

export function portalSteps(policy: RawPolicy, names?: NameDirectory, placeholders: Placeholders = new Map()): string[] {
  const one = (x: unknown, role = false): string => {
    if (typeof x !== 'string') return String(x)
    const p = placeholders.get(x)
    if (p) return p.label
    const t = TOKEN_RE.exec(x)
    if (t) return [...placeholders.values()].find((v) => v.token === x)?.label ?? `Setup question ${t[1]}`
    if (role) return roleLabel(x)
    const name = names?.nameOf(x) ?? null
    if (name) return name
    if (GUID_RE.test(x)) return 'an object not in this tenant'
    return names ? names.label(x) : x
  }
  const label = (v: unknown, role = false): string => {
    if (!Array.isArray(v) || v.length === 0) return ''
    return [...new Set(v.map((x) => one(x, role)))].join(', ')
  }
  const roles = (v: unknown): string => {
    if (!Array.isArray(v) || v.length === 0) return ''
    return coversAdminSet(v.map(String)) ? `All admin roles (${v.length})` : label(v, true)
  }
  const c = (policy.conditions ?? {}) as RawPolicy
  const users = (c.users ?? {}) as RawPolicy
  const apps = (c.applications ?? {}) as RawPolicy
  const g = (policy.grantControls ?? null) as RawPolicy | null
  const s = (policy.sessionControls ?? null) as RawPolicy | null

  const lines = [
    'Entra admin center → Protection → Conditional Access → Policies → New policy',
    `Name: ${String(policy.displayName ?? '')}`,
  ]
  const inc =
    label(users.includeUsers) ||
    (roles(users.includeRoles) && `Directory roles: ${roles(users.includeRoles)}`) ||
    (label(users.includeGroups) && `Groups: ${label(users.includeGroups)}`)
  lines.push(
    `Users → Include: ${inc || 'as exported'}${label(users.excludeGroups) ? `; Exclude groups: ${label(users.excludeGroups)}` : ''}${label(users.excludeUsers) ? `; Exclude users: ${label(users.excludeUsers)}` : ''}`,
  )
  const appInc = label(apps.includeApplications)
  const actions = label(apps.includeUserActions)
  lines.push(
    actions
      ? `Target resources → User actions: ${actions}`
      : `Target resources → Cloud apps → Include: ${appInc === 'All users' || appInc === 'All' ? 'All resources' : appInc || 'as exported'}`,
  )
  const clientApps = PORTAL_WORDS.clientApps(c.clientAppTypes)
  if (clientApps && clientApps !== PORTAL_WORDS.clientApps(['all'])) {
    lines.push(`Conditions → Client apps: ${clientApps}`)
  }
  const platforms = (c.platforms ?? null) as RawPolicy | null
  if (platforms)
    lines.push(
      `Conditions → Device platforms → Include: ${PORTAL_WORDS.platforms(platforms.includePlatforms)}${PORTAL_WORDS.platforms(platforms.excludePlatforms) ? `; Exclude: ${PORTAL_WORDS.platforms(platforms.excludePlatforms)}` : ''}`,
    )
  const locations = (c.locations ?? null) as RawPolicy | null
  if (locations)
    lines.push(
      `Conditions → Locations → Include: ${PORTAL_WORDS.locations(locations.includeLocations, label)}${PORTAL_WORDS.locations(locations.excludeLocations, label) ? `; Exclude: ${PORTAL_WORDS.locations(locations.excludeLocations, label)}` : ''}`,
    )
  if (label(c.signInRiskLevels)) lines.push(`Conditions → Sign-in risk: ${label(c.signInRiskLevels)}`)
  if (label(c.userRiskLevels)) lines.push(`Conditions → User risk: ${label(c.userRiskLevels)}`)
  const flows = (c.authenticationFlows ?? null) as RawPolicy | null
  if (flows?.transferMethods) lines.push(`Conditions → Authentication flows: ${String(flows.transferMethods)}`)
  if (g) {
    const controls = PORTAL_WORDS.grant(g.builtInControls)
    const strength = (g.authenticationStrength ?? null) as RawPolicy | null
    const grantBits = [
      controls.toLowerCase().includes('block') ? 'Block access' : null,
      controls && !controls.toLowerCase().includes('block') ? `Require: ${controls}` : null,
      strength ? `Require authentication strength: ${names?.label(String(strength.id ?? '')) ?? String(strength.displayName ?? strength.id ?? '')}` : null,
    ].filter(Boolean)
    lines.push(`Grant → ${grantBits.join('; ')}${g.operator === 'AND' ? ' (Require all)' : ''}`)
  }
  if (s) {
    const sif = (s.signInFrequency ?? null) as RawPolicy | null
    const pb = (s.persistentBrowser ?? null) as RawPolicy | null
    const bits = [
      sif?.isEnabled === true ? `Sign-in frequency: ${String(sif.value)} ${String(sif.type)}` : null,
      pb?.isEnabled === true ? `Persistent browser session: ${String(pb.mode)}` : null,
    ].filter(Boolean)
    if (bits.length > 0) lines.push(`Session → ${bits.join('; ')}`)
  }
  lines.push('Enable policy: Report-only → Create')
  return lines
}

export function buildCreateAction(
  baselinePolicy: RawPolicy,
  mapping: MappingState,
  planId: string,
  stepId: string,
  names?: NameDirectory,
  opts: { placeholders?: Placeholders; displayName?: string; adjust?: { policyId: string; state: string } } = {},
): Action {
  const body = replaceReferences(baselinePolicy, mapping, opts.placeholders)
  delete body.id
  delete body.createdDateTime
  delete body.modifiedDateTime
  // A new policy starts in report-only; an adjusted one keeps its current state.
  body.state = opts.adjust ? opts.adjust.state : 'enabledForReportingButNotEnforced'
  if (opts.displayName) body.displayName = opts.displayName
  const tag = `[IAMAI:${planId}:${stepId}]`
  body.description = `${tag}${typeof baselinePolicy.description === 'string' && baselinePolicy.description ? ' ' + baselinePolicy.description : ''}`
  const json = JSON.stringify(body, null, 2)
  const fileName = `${stepId}.json`
  const unresolved = [...(opts.placeholders?.values() ?? [])].filter((p) => json.includes(p.token))
  const comment = unresolved.length > 0 ? `# Replace the placeholders first: ${unresolved.map((p) => p.label).join('; ')}\n` : ''
  const steps = portalSteps(body, names, opts.placeholders)
  if (opts.adjust) {
    steps[0] = `Entra admin center → Protection → Conditional Access → Policies → open "${String(body.displayName ?? '')}"`
    steps[steps.length - 1] = 'Save (the policy keeps its current state)'
  }
  const powershell = opts.adjust
    ? `${comment}Invoke-MgGraphRequest -Method PATCH -Uri 'https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/${opts.adjust.policyId}' -ContentType 'application/json' -Body (Get-Content .\\${fileName} -Raw)`
    : `${comment}Invoke-MgGraphRequest -Method POST -Uri 'https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies' -ContentType 'application/json' -Body (Get-Content .\\${fileName} -Raw)`
  return { kind: opts.adjust ? 'adjust' : 'create', summary: [ACTION.createReportOnly], json, portalSteps: steps, powershell }
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

function adjustAction(full: Action, result: GoalResult, existing: RawPolicy | null, names?: NameDirectory): Action {
  const summary = adjustSummary(result)
  if (!full.json) return { ...full, kind: 'adjust', summary }
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

  const label = (v: unknown): string => (Array.isArray(v) && v.length > 0 ? [...new Set(v.map((x) => (names ? names.label(String(x)) : String(x))))].join(', ') : '')
  const cur = ((existing?.conditions ?? {}) as RawPolicy).users as RawPolicy | undefined
  const roleList = cur && Array.isArray(cur.includeRoles) && cur.includeRoles.length > 0 ? roleListSummary(cur.includeRoles.map(String)) : null
  const currentInclude = cur ? [label(cur.includeUsers), label(cur.includeGroups), roleList?.summary ?? ''].filter(Boolean).join('; ') : ''
  const excludeRoles = cur && Array.isArray(cur.excludeRoles) && cur.excludeRoles.length > 0 ? roleListSummary(cur.excludeRoles.map(String)) : null
  const currentExclude = cur ? [label(cur.excludeUsers), label(cur.excludeGroups), excludeRoles?.summary ?? ''].filter(Boolean).join('; ') : ''
  const portal = [
    full.portalSteps[0],
    ...(currentInclude ? [ADJUST.currentInclude(currentInclude)] : []),
    ...(currentExclude ? [ADJUST.currentExclude(currentExclude)] : []),
    ...full.portalSteps.slice(1, -1).filter((line) => {
      if (/^Users →/.test(line)) return sections.has('users')
      if (/^Target resources →/.test(line)) return sections.has('applications')
      if (/^Grant →|^Grant controls/.test(line)) return sections.has('grantControls')
      if (/^Session/.test(line)) return sections.has('sessionControls')
      if (/^Conditions →/.test(line)) return false
      return true
    }),
    full.portalSteps[full.portalSteps.length - 1],
  ].filter((s): s is string => typeof s === 'string')
  const powershell = full.powershell ? full.powershell.replace(/-Method POST/, '-Method PATCH') : null
  return { kind: 'adjust', summary: [...summary, ADJUST.onlyFields], json, portalSteps: portal, powershell, roleList: roleList && roleList.names.length > 5 ? roleList : excludeRoles && excludeRoles.names.length > 5 ? excludeRoles : null, changes }
}

function adjustSummary(result: GoalResult): string[] {
  const out: string[] = []
  for (const r of result.reasons) {
    if (r.kind === 'weaker-control') out.push(ACTION.raiseGrant(r.detail))
    if (r.kind === 'session-weaker') out.push(ACTION.tightenSession(r.detail))
    if (r.kind === 'excluded' && !r.expected) out.push(ACTION.reviewExclusion(r.detail))
    if (r.kind === 'not-targeted') out.push(ACTION.extendScope(r.userIds.length))
    if (r.kind === 'apps-narrower') out.push(ACTION.broadenApps)
    if (r.kind === 'report-only') out.push(ACTION.moveToEnforced)
  }
  if (result.floorRaised) out.push(ACTION.floorRaised(result.floorRaised.to, result.floorRaised.by))
  if (out.length === 0) out.push(ACTION.bringToFloor)
  return out
}

// ---- generation ----

export function generateRoadmap(input: RoadmapInput): RoadmapResult {
  // Role names travel with the scan ($expand=roleDefinition); learn them before any label is built.
  learnRoleNames(input.snapshot.config.roleAssignments?.rows ?? [])
  const { snapshot, mapping, questions, viability, planId } = input
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
  const nameOf = (id: string): string => {
    const u = userById.get(id)
    return u?.displayName ?? u?.userPrincipalName ?? id
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

  const prereq = (id: string, title: string, why: string, summary: string[], exit: string[]): Step => ({
    id,
    goalId: id.replace(/^s-/, ''),
    phase: 0,
    kind: 'prerequisite',
    title,
    why,
    whyAttribution: null,
    whyLink: null,
    status: 'ready',
    blockedBy: [],
    blockers: [],
    unblockNotes: [],
    population: { total: 0, active: 0, admins: 0, guests: 0, ids: [] },
    readiness: { family: 'other', percent: null, lines: [] },
    evidence: { status: 'none', lines: [], affectedUserIds: [], reportOnly: null },
    action: { kind: 'prerequisite', summary, json: null, portalSteps: [], powershell: null },
    exitCriteria: exit,
    rollback: ROLLBACK.prerequisite,
    history: [],
    skipReason: null,
    deliveredBy: [],
    stateReason: '',
    ...EXTRAS,
    impact: IMPACT.prerequisite,
    whatChanges: WHAT_CHANGES.prerequisite,
    plainTitle: title,
    forManager: MANAGER.prerequisite(),
  })

  // ---- Phase 0, collapsed: only what genuinely needs a human ----
  const activeQuestions = activeWizardQuestions(input.baseline, { snapshot, state: mapping })
  const missingSetup = activeQuestions.filter((q) => q.required && mapping.wizardAnswered[q.id] !== true)
  const questionNumber = (id: WizardQuestionId): number => activeQuestions.findIndex((q) => q.id === id) + 1
  const questionNote = (id: WizardQuestionId): string => {
    const q = activeQuestions.find((x) => x.id === id)
    return q ? UNBLOCK.question(questionNumber(id), q.title, q.question.replace(/\?$/, '').toLowerCase()) : UNBLOCK.setup
  }
  // Unresolved baseline references render as "<role> — Setup question N", never a GUID.
  const placeholders: Placeholders = new Map()
  const ROLE_QUESTION: Partial<Record<MappingQuestion['group'], WizardQuestionId>> = {
    breakGlass: 'breakGlass',
    globalExclusion: 'globalExclusion',
    exclusionGroups: 'globalExclusion',
    namedLocations: 'trustedLocations',
  }
  const ROLE_LABEL: Record<MappingQuestion['group'], string> = {
    breakGlass: 'your break-glass account',
    globalExclusion: 'your exclusions group',
    exclusionGroups: 'your exclusions group',
    personaGroups: 'the pilot group this step creates',
    namedLocations: 'your trusted location',
    customStrengths: 'your authentication strength',
    servicePrincipals: 'the app',
    placeholders: 'the referenced object',
  }
  for (const q of questions) {
    const r = mapping.records[q.key]
    if (r && r.resolvedId !== null) continue
    const country = q.group === 'namedLocations' && isCountryLocationRef(q.key, input.baseline.policies)
    const qid = country ? 'countries' : ROLE_QUESTION[q.group]
    const n = qid ? questionNumber(qid) : 0
    const role = country ? 'your allowed countries' : ROLE_LABEL[q.group]
    const label = n > 0 ? `${role} — Setup question ${n}` : role
    placeholders.set(q.key, { label, token: setupToken(n, q.group) })
  }
  const naming = input.coverage.organisation.naming
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
    return { name, note: NAMING.collision(name, base) }
  }

  // Without Entra ID P1 no Conditional Access policy can exist, so the objects
  // the policies would reference (exclusion groups, trusted locations) have
  // nothing to serve: the free-tier ladder is the plan instead (SPEC §12).
  const canUseConditionalAccess = snapshot.capabilities.entraP1.enabled

  // The baseline policy that stands for each goal is decided once, here, so
  // the prerequisites know which template placeholders the plan will need.
  const baselineFactsList = input.baseline.policies.map((p) => ({
    policy: p as unknown as RawPolicy,
    facts: policyFacts(p, input.strengths),
  }))
  // Style variants are decided by data, never by a question (prompt 16 §4):
  // "NoExclusions" variants are never considered.
  const baselineMatchesFor = (goal: Goal): typeof baselineFactsList => {
    const impl = goal.implementations[0]
    return baselineFactsList.filter((b) => matchesSignature(b.facts, impl.signature)).filter((b) => !/no[-_ ]?exclusions?/i.test(b.facts.name))
  }
  const templateNeeds = new Set<TemplatePlaceholder>()
  for (const r of input.coverage.results) {
    if (r.status !== 'absent' || baselineMatchesFor(r.goal).length > 0) continue
    for (const p of placeholdersIn(r.goal.implementations[0].template)) templateNeeds.add(p)
  }

  const setupStepId = 's-setup-questions'
  if (missingSetup.length > 0) {
    const p = PREREQ.setupQuestions
    steps.push(prereq(setupStepId, p.title(missingSetup.length), p.why, p.how(missingSetup.map((q) => q.title)), p.exit))
  }

  // Setup's confirmed break-glass accounts feed generation (ux-review-04 §5):
  // with accounts picked, nothing is created, whatever an older record says.
  const bgMissing = mapping.records['__breakGlassMissing']?.doesNotExist === true && mapping.breakGlassUserIds.length === 0
  const bgStepId = BREAK_GLASS_STEP_ID
  if (bgMissing) {
    const p = PREREQ.breakGlass
    // The two facts nobody can read are done-when lines here (prompt 46 item 21).
    steps.push(prereq(bgStepId, p.title, p.why, p.how, [...p.exit, ...EMERGENCY_DONE_WHEN]))
  }
  const geMissing = canUseConditionalAccess && mapping.records['__globalExclusion']?.doesNotExist === true
  const geStepId = PREREQ_STEP_ID.exclusionsGroup
  if (geMissing) {
    const p = PREREQ.globalExclusion
    // Every object the plan asks for carries a proposed name, in the tenant's own
    // convention (prompt 43 item 4). The copy's example name stays as the shape;
    // this adds the one IAMAI would actually use here.
    const proposed = proposedGroupName('Exclusion', 'Break-glass', naming)
    steps.push(prereq(geStepId, p.title, p.why, [...p.how, STEP_NAMING.proposed(proposed.name, proposed.matchesTenant)], p.exit))
  }
  const locMissing =
    canUseConditionalAccess &&
    mapping.wizardAnswered.trustedLocations === true &&
    mapping.trustedLocationIds.length === 0 &&
    (questions.some((q) => q.group === 'namedLocations') || templateNeeds.has('{trustedLocations}'))
  const locStepId = PREREQ_STEP_ID.trustedLocation
  if (locMissing) {
    const p = PREREQ.trustedLocation
    const proposed = proposedLocationName('Trusted', 'Head office', naming)
    steps.push(prereq(locStepId, p.title, p.why, [...p.how, STEP_NAMING.proposed(proposed.name, proposed.matchesTenant)], p.exit))
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
    const p = PREREQ.allowedCountries
    const proposed = proposedLocationName('Allowed', 'Countries', naming)
    steps.push(prereq(countriesStepId, p.title, p.why, [...p.how(mapping.allowedCountries.map(countryName)), STEP_NAMING.proposed(proposed.name, proposed.matchesTenant)], p.exit))
  }
  // Confirmed service accounts with no group holding them (prompt 16 §3).
  const saStepId = PREREQ_STEP_ID.serviceAccountsGroup
  if (canUseConditionalAccess && mapping.serviceAccountUserIds.length > 0 && mapping.serviceAccountsGroupId === null) {
    const p = PREREQ.serviceAccountsGroup
    const proposed = proposedGroupName('Exception', 'Service accounts', naming)
    steps.push(prereq(saStepId, p.title, p.why, [...p.how(mapping.serviceAccountUserIds.map(nameOf)), STEP_NAMING.proposed(proposed.name, proposed.matchesTenant)], p.exit))
  }

  // Wave 0: the accounts nobody signs in to (target-state §8.1, prompt 46
  // item 8). Not a denominator anywhere, and not a reason to wait — nothing
  // can lock out an account nobody uses. The risk is the other way round:
  // whoever signs in first registers the MFA method. Present only while there
  // is somebody to decide on; done when the count reaches 0 on re-scan.
  const dormant = notActiveUsers(snapshot, snapshot.asOf, new Set(mapping.serviceAccountUserIds))
  if (dormant.length > 0) {
    const p = PREREQ.dormantAccounts
    const names = dormant.map((u) => nameOf(u.id))
    const s = prereq('s-check-dormant-accounts', p.title(dormant.length), p.why, p.how(names), p.exit)
    s.kind = 'check'
    s.action = { ...s.action, kind: 'check' }
    s.population = { total: dormant.length, active: 0, admins: 0, guests: 0, ids: dormant.map((u) => u.id) }
    s.populationNames = names
    steps.push(s)
  }

  // Shared devices, their own policy (prompt 48 item 4).
  if (canUseConditionalAccess && sharedDevices.length > 0) {
    const p = PREREQ.sharedDevices
    const names_ = sharedDevices.map((u) => nameOf(u.id))
    const step = prereq('s-shared-devices', p.title, p.why, p.how(names_), p.exit)
    step.population = { total: sharedDevices.length, active: sharedDevices.length, admins: 0, guests: 0, ids: sharedDevices.map((u) => u.id) }
    step.populationNames = names_
    steps.push(step)
  }

  const secDefaults = (snapshot.config.securityDefaults?.rows?.[0] ?? null) as { isEnabled?: boolean } | null
  // Nothing can take security defaults' place without Conditional Access, so
  // turning them off is never the advice: the ladder asks for them instead.
  if (secDefaults?.isEnabled === true && canUseConditionalAccess) {
    const p = PREREQ.securityDefaults
    steps.push(prereq('s-prereq-security-defaults', p.title, p.why, p.how, p.exit))
  }
  // Per-user MFA still on (migration not complete): a conflict named up front (roadmap-v2.md §7, messy).
  const methodsPolicy = (snapshot.config.authMethodsPolicy?.rows?.[0] ?? null) as { policyMigrationState?: string } | null
  if (methodsPolicy?.policyMigrationState && methodsPolicy.policyMigrationState !== 'migrationComplete') {
    const p = PREREQ.perUserMfa
    const mfaPolicies = input.coverage.results.filter((r) => goalFamily(r.goal.id) === 'mfa' && r.status !== 'not-applicable' && r.status !== 'licence-limited').length
    steps.push(prereq('s-prereq-per-user-mfa', p.title, p.why, p.how(mfaPolicies), p.exit))
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
  const gate = canUseConditionalAccess ? gateReason(validationReports) : null
  // The step has to exist before the goal loop so a held step can name it; the
  // count of what it holds is filled in once the goal steps are known.
  const validationSteps = blockerSteps(validationReports, 0)
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
  // Named in the portal steps while the object does not exist yet.
  const templatePlaceholders: Placeholders = new Map(
    (Object.keys(PLACEHOLDER_STEP) as (keyof typeof PLACEHOLDER_STEP)[]).map((p) => [p, { label: TEMPLATE_LABEL[p], token: p }]),
  )

  // ---- Goal steps ----

  for (const result of input.coverage.results) {
    if (result.status === 'not-applicable' || result.status === 'licence-limited' || result.status === 'unknown') continue
    const goal = result.goal
    const impl = goal.implementations[0]
    const stepId = idFor('goal', goal.id)

    // Style variants are decided by data, never by a question (prompt 16 §4):
    // the geo policy is always the allowlist style, and "NoExclusions"
    // variants are never considered.
    const matches = baselineMatchesFor(goal)
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
    const readinessKey = `${goalFamily(goal.id)}|${whoKey}`
    if (!readinessCache.has(readinessKey)) readinessCache.set(readinessKey, readinessFor(goal.id, popIds, rowsFor(popIds), snapshot))
    const readiness = { ...(readinessCache.get(readinessKey) as Readiness), lines: [...(readinessCache.get(readinessKey) as Readiness).lines] }
    const matchedPolicyId = findTaggedPolicy(snapshot, planId, stepId)
    const measuredEvidence = evidenceFor(goal.id, snapshot, pop.active, matchedPolicyId)
    // A goal an existing policy already enforces has nothing in report-only to
    // measure; say that rather than promising a measurement (prompt 19 §B).
    const evidence =
      result.status === 'enforced' && matchedPolicyId === null && measuredEvidence.reportOnly === null
        ? { ...measuredEvidence, lines: [EVIDENCE.alreadyEnforced] }
        : measuredEvidence
    if (readiness.family === 'block' && evidence.affectedUserIds.length > 0) {
      const svc = mapping.serviceAccountUserIds.filter((id) => evidence.affectedUserIds.includes(id))
      if (svc.length > 0) evidence.lines.push(EVIDENCE.serviceAccounts(svc.map(nameOf)))
    }

    const doc = source ? docFor(input.baseline.docs, source.facts.name) : undefined
    const rawWhy = doc?.intent ?? goal.tldr ?? goal.description
    const whyUrl = rawWhy.match(/https?:\/\/[^\s)]+/)?.[0] ?? null
    const why = whyUrl ? rawWhy.replace(whyUrl, '').replace(/[\s:;,.]+$/, '').replace(/\.\s*:?$/, '') + '.' : rawWhy
    const whyAttribution = doc?.intent && input.baselineAuthor ? input.baselineAuthor : null

    const blockedBy: string[] = []
    const blockers: Blocker[] = []
    const unblockNotes: string[] = []
    const blockByStep = (id: string, label: string): void => {
      if (blockedBy.includes(id)) return
      blockedBy.push(id)
      blockers.push({ kind: 'step', stepId: id, label })
      unblockNotes.push(label)
    }
    // One blocker per Setup question (several can apply); the setup step is
    // referenced only when it exists.
    const blockBySetup = (qid: WizardQuestionId): void => {
      // A question answered by any means is answered, including "Doesn't exist
      // yet" (prompt 40 §10). That answer leaves the reference unresolved by
      // design, and the unresolved reference was being read back as an
      // unanswered question — so eleven step cards said "waiting on Setup
      // question 2" while Setup showed it answered (review-08 B5). Where the
      // answer creates something, createdWithinStepKeys below blocks on the
      // prerequisite step that creates it, named.
      if (mapping.wizardAnswered[qid] === true) return
      const n = questionNumber(qid)
      if (n === 0 || blockers.some((b) => b.kind === 'setup' && b.questionNumber === n)) return
      if (steps.some((s) => s.id === setupStepId) && !blockedBy.includes(setupStepId)) blockedBy.push(setupStepId)
      // The label is a clause in a comma-separated list of causes, so it has to
      // survive being read mid-sentence. questionNote() is a whole sentence with
      // its own colon ("Setup question 2 (Exclusion group): which group holds
      // the policy exclusions"), and joining it produced the run-on the review
      // caught (T7). The full form stays in unblockNotes, where it is printed
      // on its own and reads correctly.
      blockers.push({ kind: 'setup', questionNumber: n, label: BLOCKED.setup([n]) })
      unblockNotes.push(questionNote(qid))
    }
    // Baseline references no answer resolves: block by the question that owns
    // them (breakGlass/exclusions/locations); other groups auto-resolve.
    const blockUnmapped = (policy: RawPolicy): void => {
      for (const key of unmappedKeysUsedBy(policy, questions, mapping)) {
        const group = questions.find((q) => q.key === key)?.group
        const qid = group === 'namedLocations' && isCountryLocationRef(key, input.baseline.policies) ? 'countries' : group ? ROLE_QUESTION[group] : undefined
        if (qid && activeQuestions.some((q) => q.id === qid)) blockBySetup(qid)
      }
      for (const created of createdWithinStepKeys(policy, mapping)) {
        if (created.group === 'personaGroups') continue // created inside this step
        const pid =
          created.group === 'breakGlass'
            ? bgStepId
            : created.group === 'namedLocations'
              ? isCountryLocationRef(created.key, input.baseline.policies)
                ? countriesStepId
                : locStepId
              : created.group === 'exclusionGroups' && mapping.serviceAccountUserIds.length > 0 && mapping.serviceAccountsGroupId === null
                ? saStepId
                : geStepId
        if (steps.some((s) => s.id === pid)) blockByStep(pid, UNBLOCK.createObject)
      }
    }
    // A template placeholder the tenant has no object for yet: the step waits
    // on the Wave 0 step that creates it, or on the Setup question that says
    // whether it exists at all.
    const blockPlaceholder = (p: TemplatePlaceholder): void => {
      if (p === '{namePrefix}' || p === '{coreAdminRoles}') return
      const prereqId = PLACEHOLDER_STEP[p]
      if (steps.some((s) => s.id === prereqId)) {
        blockByStep(prereqId, UNBLOCK.createObject)
        return
      }
      const qid: WizardQuestionId | null =
        p === '{breakGlass}' ? 'breakGlass' : p === '{exclusionsGroup}' ? 'globalExclusion' : p === '{trustedLocations}' ? 'trustedLocations' : p === '{allowedCountriesLocation}' ? 'countries' : null
      if (qid !== null) blockBySetup(qid)
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
        summary: [ACTION.alreadyDelivered],
        json: null,
        portalSteps: [],
        powershell: null,
      }
    } else if (result.status === 'absent') {
      kind = 'create'
      if (source) {
        blockUnmapped(source.policy)
        const proposed = uniqueName(goal)
        action = buildCreateAction(source.policy, mapping, planId, stepId, input.names, {
          placeholders,
          displayName: proposed.name,
        })
        if (proposed.note) action.summary.push(proposed.note)
        namingNote = proposed
        const personas = createdWithinStepKeys(source.policy, mapping).filter((c) => c.group === 'personaGroups')
        for (const p of personas) {
          // The baseline names the group by id; the plan names it in the tenant's convention (ux-review-06 §4).
          action.summary.push(ACTION.createsGroup(proposedGroupName('Pilot', goal.shortName, naming).name))
        }
      } else {
        // No baseline policy stands for this goal: the goal's own template is
        // the body, with the tenant's objects filled in where they exist and a
        // Wave 0 step named where they do not (prompt 46 item 12). Every step
        // is executable; nothing says "create a policy that meets the floor".
        const resolved = resolveTemplate(impl.template as TemplateBody, templateValues)
        for (const p of resolved.unresolved) blockPlaceholder(p)
        const proposed = uniqueName(goal)
        action = buildCreateAction(resolved.body, mapping, planId, stepId, input.names, {
          placeholders: new Map([...placeholders, ...templatePlaceholders]),
          displayName: proposed.name,
        })
        action.summary.push(ACTION.fromTemplate)
        if (proposed.note) action.summary.push(proposed.note)
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
      if (source) blockUnmapped(source.policy)
      const existingId = existing?.policyId ?? null
      existingRaw = existingId !== null ? ((snapshot.config.caPolicies?.rows ?? []).find((p) => (p as RawPolicy).id === existingId) as RawPolicy | undefined) ?? null : null
      action = source
        ? adjustAction(
            buildCreateAction(source.policy, mapping, planId, stepId, input.names, {
              placeholders,
              displayName: existing?.policyName ?? proposedPolicyName(goal, naming),
              adjust: existing ? { policyId: existing.policyId, state: existing.state } : undefined,
            }),
            result,
            existingRaw,
            input.names,
          )
        : { kind: 'adjust', summary: adjustSummary(result), json: null, portalSteps: [], powershell: null }
    }


    // Named dependencies (prompt 12 §B).
    if (status !== 'done') {
      if (goal.id === 'register-info-protected' && steps.some((s) => s.id === locStepId)) blockByStep(locStepId, BLOCKER.trustedLocation)
      if (goal.id === 'geo-restriction') {
        if (mapping.wizardAnswered.countries !== true) blockBySetup('countries')
        else if (steps.some((s) => s.id === countriesStepId)) blockByStep(countriesStepId, UNBLOCK.createObject)
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
        const label =
          readiness.family === 'device' ? BLOCKER.deviceReadiness(readiness.percent, threshold) : UNBLOCK.readiness(readiness.percent, readiness.family, threshold)
        blockers.push({ kind: 'readiness', label, binding: BLOCKED_REASON.reaches(READINESS_MEASURE[readiness.family] ?? 'readiness', `${threshold}%`, `${readiness.percent}%`) })
        unblockNotes.push(label)
      }
      // Nothing that can deny access is offered while the way back in is
      // unverified (validation-rules.md §2).
      const deniesAccess = impl.floor.grant !== undefined || impl.floor.session !== undefined || readiness.family === 'block' || readiness.family === 'location'
      if (deniesAccess && gate !== null) blockByStep(gate.stepId, gate.label)
      if (blockedBy.length > 0) status = 'blocked'
    }
    // Precise blocked sentences (prompt 13 §9): one per cause group.
    if (status === 'blocked') {
      const sentences: string[] = []
      const qNumbers = [...new Set(blockers.filter((b) => b.kind === 'setup').map((b) => (b as { questionNumber: number }).questionNumber))].sort((a, b) => a - b)
      if (qNumbers.length > 0) sentences.push(BLOCKED.setup(qNumbers))
      for (const b of blockers) {
        if (b.kind === 'step') {
          const dep = steps.find((s) => s.id === b.stepId)
          sentences.push(dep?.validationBlocker ? BLOCKED.readiness(b.label) : BLOCKED.step(dep?.title ?? b.stepId))
        }
        if (b.kind === 'readiness') sentences.push(BLOCKED.readiness(b.label))
        if (b.kind === 'evidence') sentences.push(BLOCKED.evidence)
      }
      unblockNotes.splice(0, unblockNotes.length, ...sentences)
    }

    // ---- Redesign extras ----
    const care = popIds.filter((id) => highCareIds.has(id))
    const careNotes: string[] = []
    let careReady = true
    for (const id of care) {
      const v = viabilityById.get(id)
      const ok = v !== undefined && (v.mfa === 'verified' || v.mfa === 'likelyViable')
      if (!ok) {
        careReady = false
        careNotes.push(v?.mfa === 'none' ? CARE.noMethod(nameOf(id)) : CARE.unverified(nameOf(id)))
      }
    }
    if (care.length > 0) careNotes.unshift(CARE.order(care.length))

    const includesOperator = operatorId !== null && popIds.includes(operatorId)
    // The strand simulator decides (roadmap-v2.md §7): the same check the
    // property tests run, so a step that would lock the operator out is
    // never offered as ready.
    const opVerdict = includesOperator && operatorId !== null ? accountVerdict(readiness.family, operatorId, snapshot, mapping.allowedCountries) : null
    const operatorSafe = opVerdict === null ? null : !opVerdict.stranded
    if (opVerdict?.stranded && status !== 'done') {
      status = 'blocked'
      const label = BLOCKER.operator(opVerdict.reason)
      blockers.push({ kind: 'readiness', label, binding: BLOCKED_REASON.exist(1, 'safe way in for the signed-in account', 0) })
      unblockNotes.push(BLOCKED.readiness(label))
    }

    const zeroUsage =
      readiness.family === 'block' &&
      (evidence.status === 'ok' || evidence.status === 'partial') &&
      evidence.affectedUserIds.length === 0
    if (!readyActiveCache.has(whoKey))
      readyActiveCache.set(
        whoKey,
        popIds.filter((id) => {
          const v = viabilityById.get(id)
          return v !== undefined && v.activity === 'active' && (v.mfa === 'verified' || v.mfa === 'likelyViable')
        }).length,
      )
    const notReadyActive = pop.active - (readyActiveCache.get(whoKey) ?? 0)

    let impact: string
    if (status === 'done') impact = IMPACT.done
    else if (readiness.family === 'block')
      impact = zeroUsage ? IMPACT.blockZero : IMPACT.blockSome(evidence.affectedUserIds.length)
    else if (kind === 'adjust') {
      const affectedIds = new Set(result.reasons.flatMap((r) => r.userIds))
      const affectedAdmins = [...affectedIds].filter((id) => (snapshot.roles.active[id] ?? []).length > 0).length
      impact = IMPACT.adjust(affectedIds.size, affectedAdmins)
    } else if (readiness.family === 'mfa' || readiness.family === 'guest' || readiness.family === 'admin')
      impact = notReadyActive > 0 ? IMPACT.mfaNotReady(notReadyActive, pop.active) : IMPACT.mfaAllReady(pop.active)
    else impact = IMPACT.inScope(pop.active)

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
    const opEvidence = operatorId !== null ? snapshot.signInEvidence[operatorId] : undefined
    const measured = evidenceUsable && (readiness.family === 'block' || evidence.reportOnly !== null)
    const operatorNote = includesOperator && result.status !== 'enforced'
      ? OPERATOR.inScope(measured ? (evidence.affectedUserIds.includes(operatorId!) ? 'some' : 0) : null, opEvidence?.signInCount ?? null, evidenceUsable)
      : null

    // "Done when" bullets only for criteria that apply to the step kind
    // (prompt 17 §4): a create step observes in report-only, then enforces;
    // an adjust step to an enforced policy just has to land cleanly.
    const existingReportOnly = kind === 'adjust' && result.candidates.some((c) => c.contribution === 'reportOnly')
    const exitCriteria =
      status === 'done'
        ? [EXIT.staysEnforced]
        : kind === 'adjust' && !existingReportOnly
          ? [EXIT.adjustApplied, EXIT.adjustNoRegression, ...(care.length > 0 ? [EXIT.careVerified(care.length)] : []), ...(includesOperator ? [EXIT.operatorStrong] : [])]
          : [
              EXIT.reportOnlyDays(EXIT_MIN_DAYS_OBSERVED),
              EXIT.signIns(EXIT_SIGNINS_PER_ACTIVE_USER, EXIT_MIN_SIGNINS_ABSOLUTE),
              EXIT.zeroFailures,
              ...(care.length > 0 ? [EXIT.careVerified(care.length)] : []),
              ...(includesOperator ? [EXIT.operatorStrong] : []),
              EXIT.watch(DEFAULT_REVERT_PERCENT),
            ]

    const score = scoreResult(result, snapshot, viability, {
      prerequisites: blockedBy.length,
      newObjects: source ? createdWithinStepKeys(source.policy, mapping).length : 0,
      evidenceClean: zeroUsage || evidence.reportOnly?.meetsExitCriterion === true,
      affectedByBlock: evidenceUsable && readiness.family === 'block' ? evidence.affectedUserIds.length : null,
      precomputed: { popIds, activeIn: pop.active, tenantActive: popIndex.active.size, readiness },
    })

    steps.push({
      id: stepId,
      goalId: goal.id,
      phase: Math.max(1, goal.phase),
      kind,
      title: stepTitle(goal.name),
      why,
      whyAttribution,
      whyLink: whyUrl,
      status,
      blockedBy,
      blockers,
      unblockNotes,
      population: pop,
      readiness,
      evidence,
      action,
      exitCriteria,
      rollback: kind === 'adjust' ? ROLLBACK_V2.adjust : ROLLBACK_V2.create,
      history: [],
      skipReason: null,
      ...EXTRAS,
      // After the defaults, or the default overwrites it: the gap a change step
      // closes, on the step so the plan row can show it (prompt 46 item 9).
      gap: result.gapSentence ?? null,
      impact,
      safeToday: false, // decided once every step exists (prerequisites, break-glass, operator, evidence): see safeTodayFor
      highCare: { userIds: care, ready: careReady, notes: careNotes },
      comms,
      learn: goal.learnUrl ? { url: goal.learnUrl, tldr: goal.tldr ?? '', cis: goal.cis ?? [] } : null,
      includesOperator,
      operatorSafe,
      operatorNote,
      operatorWhatIf: null,
      deliveredBy: result.candidates
        .filter((c) => c.contribution === 'strong')
        .map((c) => `${c.policyName} (${INVENTORY.policies.state[c.state] ?? c.state})`),
      stateReason: '',
      denies: impl.floor.grant !== undefined || impl.floor.session !== undefined || readiness.family === 'block' || readiness.family === 'location',
      plainTitle: plainTitleFor(goal.id, stepTitle(goal.name)),
      forManager:
        readiness.family === 'mfa' || readiness.family === 'guest'
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
                    : MANAGER.other(),
      rollbackBody: kind === 'adjust' && existingRaw ? JSON.stringify(existingRaw, null, 2) : null,
      whatChanges:
        status === 'done' ? WHAT_CHANGES.done : kind === 'adjust' ? WHAT_CHANGES.adjust(existing?.policyName ?? stepTitle(goal.name), action.changes?.length ?? adjustSections.size) : WHAT_CHANGES.create(stepTitle(goal.name), pop.total),
      naming:
        kind === 'create' && status !== 'done'
          ? { proposed: namingNote?.name ?? proposedPolicyName(goal, naming), fromBaseline: source?.facts.name ?? null, note: namingNote?.note ?? null }
          : null,
      score,
    })
  }

  // ---- Phase 2 verification campaign ----
  const mfaGoal = input.coverage.results.find((r) => r.goal.id === 'mfa-all-users')
  if (mfaGoal) {
    const counts = new Map<string, number>()
    for (const v of viability) counts.set(v.mfa, (counts.get(v.mfa) ?? 0) + 1)
    const departments = new Set(snapshot.users.map((u) => u.department).filter(Boolean))
    const careList = [...highCareIds].map(nameOf)
    const p = PREREQ.verifyMfa
    // Verification complete on this scan → the campaign is done and the
    // scheduler skips its window (prompt 18 §1).
    const verifyReadiness = readinessFor('mfa-all-users', viability.map((v) => v.userId), viability, snapshot)
    // Required whenever anyone enabled still has to be set up (ux-review-04 §2):
    // the Overview sentence, the blocked-step reasons and the pace all read
    // from this one number.
    const toSetUp = summarizeTenant(viability).rollout.toSetUp
    const verifyDone = toSetUp === 0
    steps.push({
      ...prereq(
        's-verify-mfa',
        p.title,
        p.why,
        p.how(
          { none: counts.get('none') ?? 0, unverified: counts.get('unverified') ?? 0, notChallenged: counts.get('notChallenged') ?? 0 },
          careList,
          departments.size,
        ),
        p.exit(READINESS_THRESHOLD_MFA_PERCENT),
      ),
      phase: 2,
      kind: 'verify',
      rollback: ROLLBACK.verify,
      goalId: 'mfa-all-users',
      status: verifyDone ? 'done' : 'ready',
      population: population(viability.map((v) => v.userId).filter((id) => !excluded.has(id)), popIndex),
      readiness: verifyReadiness,
      comms: COMMS.verify(tenantName),
      impact: IMPACT.verifyCampaign(toSetUp),
      whatChanges: WHAT_CHANGES.verify(toSetUp),
      plainTitle: p.title,
      forManager: MANAGER.verify(toSetUp),
    })
  }

  // ---- Recurring: break-glass drill ----
  const bgIds = mapping.breakGlassUserIds
  if (bgIds.length > 0) {
    const stale = bgIds.filter((id) => {
      const u = snapshot.users.find((x) => x.id === id)
      return (
        !u?.lastSuccessfulSignIn ||
        Date.parse(snapshot.asOf) - Date.parse(u.lastSuccessfulSignIn) > BREAK_GLASS_DRILL_DAYS * 86_400_000
      )
    })
    const p = PREREQ.breakGlassDrill
    const phoneOnly = bgIds.filter((id) => {
      const m = snapshot.authMethods[id]
      return Array.isArray(m) && m.length > 0 && m.every((x) => x.kind === 'phone' || x.kind === 'email' || x.kind === 'password')
    })
    steps.push({
      ...prereq('s-recurring-break-glass-drill', p.title, p.why(BREAK_GLASS_DRILL_DAYS), p.how, p.exit(BREAK_GLASS_DRILL_DAYS)),
      impact: phoneOnly.length > 0 ? p.weakMethod(phoneOnly.map(nameOf)) : IMPACT.prerequisite,
      whatChanges: WHAT_CHANGES.recurring,
      plainTitle: p.title,
      forManager: MANAGER.prerequisite(),
      kind: 'recurring',
      rollback: ROLLBACK.recurring,
      goalId: 'recurring:break-glass',
      population: population(bgIds, popIndex),
      readiness: {
        family: 'other',
        percent: null,
        lines: [...(stale.length > 0 ? [p.overdue(stale.map(nameOf))] : [p.allDrilled]), ...(phoneOnly.length > 0 ? [p.weakMethod(phoneOnly.map(nameOf))] : [])],
      },
      status: stale.length > 0 || phoneOnly.length > 0 ? 'ready' : 'done',
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
      s.unblockNotes.push(BLOCKED.readiness(label))
    }
    s.status = 'blocked'
  }

  // 1. Security-info registration is the policy that asks for MFA in order to
  // register MFA. It waits for a way out to exist (Temporary Access Pass), for
  // a trusted location to mean something, and for the people with no method to
  // have one (steps/security-info-registration.md).
  const registrationStep = steps.find((s) => s.goalId === 'register-info-protected')
  if (registrationStep) {
    if (tapEnabled === false) blockLate(registrationStep, BLOCKER.registrationNoTap, BLOCKED_REASON.exist(1, 'Temporary Access Pass policy', 0))
    const withoutMethod = viability.filter((v) => v.activity === 'active' && v.mfa === 'none').length
    // A reason, not a dependency edge: the campaign sits in a later phase, and
    // pointing a phase 0 step at it would order the plan against itself.
    if (withoutMethod > 0) blockLate(registrationStep, BLOCKER.registrationCoverage(withoutMethod), BLOCKED_REASON.reaches('people without a method', '0', String(withoutMethod)))
    if (trustedLocationCount === 0) blockLate(registrationStep, BLOCKER.registrationNoTrustedLocation, BLOCKED_REASON.exist(1, 'trusted location', 0))
  }

  // 2. No country block before the operator's own recent countries are in the
  // allow list, and before the list itself passes its checks.
  const countriesReport = validationReports.find((r) => r.subject === 'allowedCountries')
  if (countriesReport && countriesReport.blocking.length > 0) {
    for (const s of steps) {
      if (s.readiness.family === 'location') blockLate(s, BLOCKER.countriesUnsafe, null, blockerStepId('allowedCountries'))
    }
  }

  // 3. Security defaults come off before any Conditional Access policy: with
  // them on, a policy can be created and cannot be turned on.
  const secDefaultsStep = steps.find((s) => s.id === 's-prereq-security-defaults')
  if (secDefaultsStep) {
    for (const s of steps) {
      if (s.kind !== 'create' && s.kind !== 'adjust') continue
      blockLate(s, BLOCKER.securityDefaultsFirst, null, secDefaultsStep.id)
    }
  }

  // 4. No session control that can put the person applying it in a loop:
  // sign-in every time without MFA in the same policy is Microsoft's own
  // documented hazard (steps/session-controls.md).
  for (const s of steps) {
    const impl = input.coverage.results.find((r) => r.goal.id === s.goalId)?.goal.implementations[0]
    const floor = impl?.floor
    if (floor?.session?.signInFrequencyEveryTime === true && floor.grant === undefined) {
      blockLate(s, BLOCKER.sessionLoop, BLOCKED_REASON.exist(1, 'MFA grant on this policy', 0))
    }
  }

  // ---- Ordering: phase, then safe-today first, then risk score; steps that
  // touch handle-with-care users go last within their phase ----
  const stepSeverity = (s: Step): number => {
    if (/^block/i.test(s.title)) return SEVERITY_BLOCK
    if (/phishing|device|protection/i.test(s.title)) return SEVERITY_STRENGTH_OR_DEVICE
    return SEVERITY_DEFAULT
  }
  const score = (s: Step): number => {
    // The escape hatch comes before everything: nothing else is safe to start
    // while a recovery is unverified (validation-rules.md §2).
    const blockerIndex = validationSteps.findIndex((v) => v.id === s.id)
    if (blockerIndex >= 0) return -5000 + blockerIndex
    // The ladder is the plan for a tenant that cannot hold a policy: its own
    // order is the rollout order, ahead of everything else in the phase.
    const rung = ladderOrder.get(s.id)
    if (rung !== undefined) return -3000 + rung
    // Conflicts the tenant already has (security defaults, per-user MFA) come before everything (roadmap-v2.md §7, messy).
    if (s.id === 's-prereq-security-defaults' || s.id === 's-prereq-per-user-mfa') return -2000
    if (s.safeToday) return -1000
    const sev = s.kind === 'prerequisite' || s.kind === 'recurring' || s.kind === 'check' ? 0 : stepSeverity(s)
    const care = s.highCare.userIds.length > 0 ? 100_000 : 0
    return care + s.population.active * sev - (s.readiness.percent ?? 0)
  }
  steps.sort((a, b) => a.phase - b.phase || score(a) - score(b) || a.id.localeCompare(b.id))

  // ---- Populations at scale (roadmap-v2.md §3): basis, names or cohorts, the riskiest ----
  const indexes = contentIndexes
  const popCtx = populationContext(snapshot, viabilityById, popIndex.admins, highCareIds, indexes.deviceReady, nameOf)
  for (const s of steps) {
    const view = describePopulation(s, popCtx, { cohorts: false })
    s.populationView = view
    s.populationBasis = view.basis
    s.populationNames = view.named.map((n) => n.name)
  }

  // ---- What could go wrong, help desk (roadmap-v2.md §4) ----
  const policyNameOf = (s: Step): string => s.naming?.proposed ?? s.deliveredBy[0]?.replace(/ \([^)]*\)$/, '') ?? s.title
  const contentCtx = {
    snapshot,
    viability: viabilityById,
    adminIds: popIndex.admins,
    breakGlassIds: new Set(mapping.breakGlassUserIds),
    serviceAccountIds: new Set(mapping.serviceAccountUserIds),
    deviceReady: indexes.deviceReady,
    allowedCountries: mapping.allowedCountries,
    policyName: policyNameOf,
    guestIds: popIndex.guests,
    tapEnabled,
    trustedLocations: trustedLocationCount,
  }
  for (const s of steps) {
    s.failureModes = failureModesFor(s, contentCtx)
    s.helpDesk = helpDeskFor(s)
  }

  // ---- Safe today (scheduling-and-onboarding.md §2.4): every condition, and the single reason when one fails ----
  const evidenceSrc = snapshot.sources.signInEvidence
  const evidenceOk = evidenceSrc?.status === 'ok' || evidenceSrc?.status === 'partial'
  const coveredDays = evidenceSrc?.coveredWindow ? Math.floor((Date.parse(evidenceSrc.coveredWindow.to) - Date.parse(evidenceSrc.coveredWindow.from)) / 86_400_000) : 0
  const totalSignIns = snapshot.evidenceAggregates?.total ?? 0
  const byId = new Map(steps.map((x) => [x.id, x]))
  const bgStepOpen = steps.some((x) => (x.id === bgStepId || x.id === DRILL_STEP_ID) && x.status !== 'done' && x.status !== 'skipped')
  const outsideCountries = Object.entries(snapshot.evidenceAggregates?.byCountry ?? {}).filter(([c]) => c && !mapping.allowedCountries.includes(c)).reduce((n, [, u]) => n + u, 0)
  const affectedCache = new WeakMap<string[], Map<string, number>>()
  const memoAffected = (ids: string[], key: string, compute: () => number): number => {
    let m = affectedCache.get(ids)
    if (!m) affectedCache.set(ids, (m = new Map()))
    if (!m.has(key)) m.set(key, compute())
    return m.get(key) as number
  }
  for (const s of steps) {
    const verdict = safeTodayFor(s)
    s.safeToday = verdict.safe
    s.safeVerdict = verdict
  }
  function safeTodayFor(s: Step): Step['safeVerdict'] {
    const notYet = (reason: string) => ({ safe: false, reason, sentence: SAFE.verdictNotYet(reason) })
    if (s.status === 'done') return notYet(SAFE.reasons.done)
    if (s.kind !== 'create' && s.kind !== 'adjust') return notYet(SAFE.reasons.kind)
    for (const b of s.blockedBy) {
      const dep = byId.get(b)
      if (dep && dep.status !== 'done' && dep.status !== 'skipped') return notYet(SAFE.reasons.prerequisites(dep.plainTitle || dep.title))
    }
    if (s.blockers.some((b) => b.kind === 'setup')) return notYet(SAFE.reasons.prerequisites(SETUP_QUESTIONS.stepTitle))
    if (bgStepOpen) return notYet(SAFE.reasons.breakGlass)
    if (s.includesOperator && s.operatorSafe === false) return notYet(SAFE.reasons.operator)
    if (!evidenceOk) return notYet(SAFE.reasons.evidenceNone)
    if (coveredDays < SAFE_MIN_EVIDENCE_DAYS) return notYet(SAFE.reasons.evidenceWindow(coveredDays, SAFE_MIN_EVIDENCE_DAYS))
    if (totalSignIns < SAFE_MIN_SIGNINS) {
      const scopeWithEvidence = s.population.ids.filter((id) => popIndex.active.has(id) && snapshot.signInEvidence[id] !== undefined).length
      if (scopeWithEvidence < s.population.active) return notYet(SAFE.reasons.evidenceCoverage(totalSignIns, SAFE_MIN_SIGNINS))
    }
    const family = s.readiness.family
    const threshold = family === 'mfa' || family === 'guest' ? READINESS_THRESHOLD_MFA_PERCENT : family === 'admin' ? READINESS_THRESHOLD_ADMINS_PERCENT : family === 'device' ? READINESS_THRESHOLD_DEVICES_PERCENT : null
    if (threshold !== null && s.readiness.percent !== null && s.readiness.percent < threshold) return notYet(SAFE.reasons.readiness(s.readiness.percent, threshold))
    let affected = 0
    if (family === 'block' || family === 'risk') affected = s.evidence.affectedUserIds.length
    else if (family === 'location') affected = outsideCountries
    else if (family === 'mfa' || family === 'guest' || family === 'admin') {
      affected = memoAffected(s.population.ids, family, () => s.population.ids.filter((id) => {
        const v = viabilityById.get(id)
        return v !== undefined && v.activity === 'active' && !(v.mfa === 'verified' || (family === 'admin' ? v.methodTiers.includes('phishingResistant') : v.mfa === 'likelyViable'))
      }).length)
      if (affected > 0) return notYet(SAFE.reasons.notReady(affected))
    } else if (family === 'device') affected = s.population.ids.filter((id) => popIndex.active.has(id) && !contentIndexes.deviceReady.has(id)).length
    else affected = s.population.active // a session control prompts everyone active
    if (affected > 0) return notYet(SAFE.reasons.affected(affected))
    return { safe: true, reason: '', sentence: SAFE.cardSentence }
  }

  // ---- Rings (roadmap-v2.md §1): proposed from readiness data, dated by the schedule ----
  const startIso = input.startDate ?? nextMonday(snapshot.asOf)
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
  const schedule = buildSchedule(steps, startIso, activeTotal, input.band ?? null, {
    freeze: input.changeFreeze ?? null,
    rhythm,
    registrationDays: registration.workingDays,
  })
  schedule.rhythm = rhythm
  schedule.policyCount = policyCountFor(snapshot, steps, input.coverage.organisation)
  const waveStart = new Map(schedule.waves.map((w) => [w.wave, w.start]))
  for (const s of steps) {
    // Comms per ring, dated (§4.11); the step's own announcement is the first ring's.
    if (s.comms?.includes('{DATE}')) {
      const template = s.comms
      const firstDate = s.rings[0]?.plannedStart ?? waveStart.get(schedule.waveOf[s.id] ?? 0) ?? startIso
      s.ringComms = s.rings.map((r) => ({ ring: r.name, date: absoluteDate(r.plannedStart), text: template.replaceAll('{DATE}', absoluteDate(r.plannedStart)) }))
      s.comms = template.replaceAll('{DATE}', absoluteDate(firstDate))
    }
    // A step that brought its own verification keeps it (the free-tier ladder).
    if (s.verify === null) s.verify = verifyFor(s, contentCtx, s.rings[0]?.name ?? null)
    s.events = eventsFor(s, { rhythm, timeZone: mapping.displayTimeZone ?? 'UTC' })
  }

  // The lockout-scenario lines, once every step has its enforce date (prompt 48
  // items 6, 7). Built only from derivations that fired.
  const noMethodActive = viability.filter((v) => v.activity === 'active' && !v.mfaCapable && !excluded.has(v.userId)).map((v) => v.userId)
  const scenarioBase = scenarioContext({ snapshot, nameOf, noMethodActive })
  for (const s2 of steps) {
    const enforceDate = s2.events?.enforce.date ?? (s2.rings[0]?.plannedStart ? absoluteDate(s2.rings[0].plannedStart) : null)
    const ctx = { ...scenarioBase, enforceDate }
    s2.scenarioLines = scenarioLinesFor(s2, ctx)
    s2.cantSee = cantSeeFor(s2, ctx)
    // Date side-lines (item 7), once each on Dates.
    const notes: string[] = []
    if (s2.readiness.family === 'device' && enforceDate) notes.push(DATE_NOTE.certificate(enforceDate))
    if (s2.readiness.family === 'block') notes.push(DATE_NOTE.sessionRefresh)
    s2.dateNotes = notes
  }

  // A subject with only recommendations attaches them to the step that already
  // covers the same object, rather than adding one nobody has to act on.
  const WARNING_HOST: Partial<Record<string, string>> = { breakGlass: DRILL_STEP_ID, exclusionGroup: EXCLUSION_GROUP_STEP_ID }
  for (const report of validationReports) {
    if (report.blocking.length > 0 || report.warnings.length === 0) continue
    const host = steps.find((s) => s.id === WARNING_HOST[report.subject])
    if (host) attachWarnings(report, host)
  }

  // What the escape hatch is actually holding, now that the goal steps exist.
  if (gate !== null) {
    // The blocked steps this gate is holding — a named subset of the one
    // blocked set, not a fourth count of its own (prompt 40 §9).
    const held = heldBy(steps, gate.stepId).length
    for (const report of validationReports) {
      const step = steps.find((s) => s.id === blockerStepId(report.subject))
      if (step) step.impact = BLOCKER_STEP.impact(report.blocking.length, GATING_SUBJECTS.includes(report.subject) ? held : 0)
    }
  }

  annotateStateReasons(steps)
  // Static rules on the tenant's own policy JSON (prompt 48 item 5): the ones a
  // plan cannot fix by itself surface as Housekeeping.
  const violations = staticViolations(snapshot.config.caPolicies?.rows ?? [], { technicianToolsOffCompliance: (snapshot.scenarioEvidence?.technicianToolsOffCompliance.count ?? 0) > 0 })
  return { steps, schedule, housekeeping: { checksNotRun: checksNotRun(validationReports), staticViolations: violations } }
}

export function findTaggedPolicy(snapshot: TenantSnapshot, planId: string, stepId: string): string | null {
  const tag = `[IAMAI:${planId}:${stepId}]`
  for (const raw of snapshot.config.caPolicies?.rows ?? []) {
    const p = raw as { id?: string; description?: string }
    if (typeof p.description === 'string' && p.description.includes(tag)) return p.id ?? null
  }
  return null
}
