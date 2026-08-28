// Step generation (roadmap.md §1–§6; 2026-08-27 redesign: collapsed phase 0,
// per-tenant impact, safe-today lane, handle-with-care gating, comms drafts,
// operator self-safety, Learn links, auto-scheduling). Pure.
import { docFor } from '../baseline/index.ts'
import type { BaselinePackage } from '../baseline/types.ts'
import { matchesSignature } from '../coverage/classify.ts'
import { policyFacts } from '../coverage/facts.ts'
import type { StrengthLookup } from '../coverage/strength.ts'
import type { CoverageReport, GoalResult } from '../coverage/types.ts'
import { resolvePopulation } from '../coverage/population.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingQuestion, MappingState } from '../mapping/types.ts'
import { activeWizardQuestions } from '../mapping/wizard.ts'
import type { WizardQuestionId } from '../mapping/wizard.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { adminUserIds, learnRoleNames, roleListSummary } from '../roles.ts'
import { proposedPolicyName } from '../coverage/naming.ts'
import { summarizeTenant } from '../scoring/mfaViability.ts'
import type { NameDirectory } from '../names.ts'
import { coversAdminSet, roleLabel } from '../roles.ts'
import { countryName, isAllowlistGeoPolicy, isCountryLocationRef, tenantCountryLocation } from '../mapping/countries.ts'
import { absoluteDate } from '../copy/dates.ts'
import { ACTION, CARE, COMMS, EVIDENCE, EXIT, IMPACT, PORTAL_WORDS, PREREQ, ROLLBACK, UNBLOCK, stepTitle } from '../copy/steps.ts'
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
import { buildSchedule, nextMonday } from './schedule.ts'
import type { Schedule } from './schedule.ts'
import type { Action, Blocker, Step, StepPopulation, StepStatus } from './types.ts'
import type { SizeBand } from './constants.ts'
import { ADJUST, BLOCKED, BLOCKER, OPERATOR } from '../copy/steps.ts'
import { INVENTORY } from '../copy/inventory.ts'
import { annotateStateReasons } from './stateReason.ts'
import { scoreResult } from './score.ts'
import { NO_ANNOUNCEMENT, announcementFor } from '../copy/announcements.ts'
import { SETUP_QUESTIONS } from '../copy/setup.ts'

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
}

export type RoadmapResult = { steps: Step[]; schedule: Schedule }

const EXTRAS: Pick<
  Step,
  'impact' | 'safeToday' | 'highCare' | 'comms' | 'learn' | 'includesOperator' | 'operatorSafe'
> = {
  impact: '',
  safeToday: false,
  highCare: { userIds: [], ready: true, notes: [] },
  comms: null,
  learn: null,
  includesOperator: false,
  operatorSafe: null,
}

function idFor(prefix: string, key: string): string {
  return `s-${prefix}-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`
}

/** The stable step id for a goal (deep links from Findings and Setup). */
export function stepIdForGoal(goalId: string): string {
  return idFor('goal', goalId)
}
export const DRILL_STEP_ID = 's-recurring-break-glass-drill'
export const EXCLUSION_GROUP_STEP_ID = 's-prereq-exclusion-group'

function population(ids: string[], snapshot: TenantSnapshot, viability: MfaViability[]): StepPopulation {
  const set = new Set(ids)
  const active = viability.filter((v) => set.has(v.userId) && v.activity === 'active').length
  const adminSet = adminUserIds(snapshot.roles)
  const admins = ids.filter((id) => adminSet.has(id)).length
  const guests = snapshot.users.filter((u) => set.has(u.id) && u.userType === 'guest').length
  return { total: ids.length, active, admins, guests, ids }
}

// ---- action building (roadmap.md §3) ----

type RawPolicy = Record<string, unknown>

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
      `Conditions → Locations → Include: ${label(locations.includeLocations)}${label(locations.excludeLocations) ? `; Exclude: ${label(locations.excludeLocations)}` : ''}`,
    )
  if (label(c.signInRiskLevels)) lines.push(`Conditions → Sign-in risk: ${label(c.signInRiskLevels)}`)
  if (label(c.userRiskLevels)) lines.push(`Conditions → User risk: ${label(c.userRiskLevels)}`)
  const flows = (c.authenticationFlows ?? null) as RawPolicy | null
  if (flows?.transferMethods) lines.push(`Conditions → Authentication flows: ${String(flows.transferMethods)}`)
  if (g) {
    const controls = label(g.builtInControls)
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
  const comment = unresolved.length > 0 ? `# Replace the __IAMAI_SETUP_QUESTION_…__ tokens first: ${unresolved.map((p) => p.label).join('; ')}\n` : ''
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
  return { kind: 'adjust', summary: [...summary, ADJUST.onlyFields], json, portalSteps: portal, powershell, roleList: roleList && roleList.names.length > 5 ? roleList : excludeRoles && excludeRoles.names.length > 5 ? excludeRoles : null }
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
  const highCareIds = new Set(mapping.highCareUserIds)
  const operatorId = input.operatorUserId ?? null
  const viabilityById = new Map(viability.map((v) => [v.userId, v]))
  const nameOf = (id: string): string => {
    const u = snapshot.users.find((x) => x.id === id)
    return u?.displayName ?? u?.userPrincipalName ?? id
  }
  const tenantName =
    ((snapshot.config.organization?.rows?.[0] ?? {}) as { displayName?: string }).displayName ?? 'your organisation'
  const steps: Step[] = []

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

  const setupStepId = 's-setup-questions'
  if (missingSetup.length > 0) {
    const p = PREREQ.setupQuestions
    steps.push(prereq(setupStepId, p.title(missingSetup.length), p.why, p.how(missingSetup.map((q) => q.title)), p.exit))
  }

  // Setup's confirmed break-glass accounts feed generation (ux-review-04 §5):
  // with accounts picked, nothing is created, whatever an older record says.
  const bgMissing = mapping.records['__breakGlassMissing']?.doesNotExist === true && mapping.breakGlassUserIds.length === 0
  const bgStepId = 's-prereq-break-glass'
  if (bgMissing) {
    const p = PREREQ.breakGlass
    steps.push(prereq(bgStepId, p.title, p.why, p.how, p.exit))
  }
  const geMissing = mapping.records['__globalExclusion']?.doesNotExist === true
  const geStepId = 's-prereq-exclusion-group'
  if (geMissing) {
    const p = PREREQ.globalExclusion
    steps.push(prereq(geStepId, p.title, p.why, p.how, p.exit))
  }
  const locMissing =
    mapping.wizardAnswered.trustedLocations === true &&
    mapping.trustedLocationIds.length === 0 &&
    questions.some((q) => q.group === 'namedLocations')
  const locStepId = 's-prereq-trusted-location'
  if (locMissing) {
    const p = PREREQ.trustedLocation
    steps.push(prereq(locStepId, p.title, p.why, p.how, p.exit))
  }

  // Allowed countries (prompt 16 §4): the named location is created in phase
  // 0 unless the tenant already has one with exactly that list.
  const countriesStepId = 's-prereq-allowed-countries'
  const countriesMissing =
    mapping.wizardAnswered.countries === true &&
    mapping.allowedCountries.length > 0 &&
    tenantCountryLocation(snapshot, mapping.allowedCountries) === null &&
    input.coverage.results.some((r) => r.goal.id === 'geo-restriction' && r.status !== 'enforced' && r.status !== 'not-applicable')
  if (countriesMissing) {
    const p = PREREQ.allowedCountries
    steps.push(prereq(countriesStepId, p.title, p.why, p.how(mapping.allowedCountries.map(countryName)), p.exit))
  }
  // Confirmed service accounts with no group holding them (prompt 16 §3).
  const saStepId = 's-prereq-service-accounts-group'
  if (mapping.serviceAccountUserIds.length > 0 && mapping.serviceAccountsGroupId === null) {
    const p = PREREQ.serviceAccountsGroup
    steps.push(prereq(saStepId, p.title, p.why, p.how(mapping.serviceAccountUserIds.map(nameOf)), p.exit))
  }

  const secDefaults = (snapshot.config.securityDefaults?.rows?.[0] ?? null) as { isEnabled?: boolean } | null
  if (secDefaults?.isEnabled === true) {
    const p = PREREQ.securityDefaults
    steps.push(prereq('s-prereq-security-defaults', p.title, p.why, p.how, p.exit))
  }

  // ---- Goal steps ----
  const baselineFactsList = input.baseline.policies.map((p) => ({
    policy: p as unknown as RawPolicy,
    facts: policyFacts(p, input.strengths),
  }))

  for (const result of input.coverage.results) {
    if (result.status === 'not-applicable' || result.status === 'licence-limited' || result.status === 'unknown') continue
    const goal = result.goal
    const impl = goal.implementations[0]
    const stepId = idFor('goal', goal.id)

    // Style variants are decided by data, never by a question (prompt 16 §4):
    // the geo policy is always the allowlist style, and "NoExclusions"
    // variants are never considered.
    const matches = baselineFactsList
      .filter((b) => matchesSignature(b.facts, impl.signature))
      .filter((b) => !/no[-_ ]?exclusions?/i.test(b.facts.name))
    let source = matches.find((m) => goal.id === 'geo-restriction' && isAllowlistGeoPolicy(m.policy as never)) ?? matches[0] ?? null
    for (const [, chosen] of Object.entries(mapping.variantChoices)) {
      const hit = matches.find((m) => m.facts.name === chosen)
      if (hit) source = hit
    }

    const popIds = impl.expectedWho.kind === 'workload' ? [] : [...resolvePopulation(impl.expectedWho, snapshot).ids]
    const pop = population(popIds, snapshot, viability)
    const readiness = readinessFor(goal.id, popIds, viability, snapshot)
    const matchedPolicyId = findTaggedPolicy(snapshot, planId, stepId)
    const measuredEvidence = evidenceFor(goal.id, snapshot, pop.active, matchedPolicyId)
    // A goal an existing policy already enforces has nothing in report-only to
    // measure; say that rather than promising a measurement (prompt 19 §B).
    const evidence =
      result.status === 'enforced' && matchedPolicyId === null && measuredEvidence.reportOnly === null
        ? { ...measuredEvidence, lines: [EVIDENCE.alreadyEnforced] }
        : measuredEvidence

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
      const n = questionNumber(qid)
      if (n === 0 || blockers.some((b) => b.kind === 'setup' && b.questionNumber === n)) return
      if (steps.some((s) => s.id === setupStepId) && !blockedBy.includes(setupStepId)) blockedBy.push(setupStepId)
      blockers.push({ kind: 'setup', questionNumber: n, label: questionNote(qid) })
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
    let action: Action
    let kind: Step['kind']
    let status: StepStatus = 'ready'

    if (result.status === 'enforced') {
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
        action = buildCreateAction(source.policy, mapping, planId, stepId, input.names, {
          placeholders,
          displayName: proposedPolicyName(stepTitle(goal.name), naming),
        })
        const personas = createdWithinStepKeys(source.policy, mapping).filter((c) => c.group === 'personaGroups')
        for (const p of personas) {
          // The baseline names the group by id; the plan names it in the tenant's convention (ux-review-06 §4).
          action.summary.push(ACTION.createsGroup(proposedPolicyName(`Pilot${naming?.separator ?? ' - '}${stepTitle(goal.name)}`, naming)))
        }
      } else {
        action = {
          kind: 'create',
          summary: [ACTION.noBaselineMatch],
          json: null,
          portalSteps: [],
          powershell: null,
        }
      }
    } else {
      kind = 'adjust'
      // An adjust step edits the tenant's own policy: its name, its id, its
      // current state — never a second policy named after the baseline.
      const existing =
        result.candidates.find((c) => c.contribution === 'weak') ??
        result.candidates.find((c) => c.contribution === 'reportOnly') ??
        result.candidates.find((c) => c.contribution !== 'disabled') ??
        null
      if (source) blockUnmapped(source.policy)
      const existingRaw = existing ? ((snapshot.config.caPolicies?.rows ?? []).find((p) => (p as RawPolicy).id === existing.policyId) as RawPolicy | undefined) ?? null : null
      action = source
        ? adjustAction(
            buildCreateAction(source.policy, mapping, planId, stepId, input.names, {
              placeholders,
              displayName: existing?.policyName ?? proposedPolicyName(stepTitle(goal.name), naming),
              adjust: existing ? { policyId: existing.policyId, state: existing.state } : undefined,
            }),
            result,
            existingRaw,
            input.names,
          )
        : { kind: 'adjust', summary: adjustSummary(result), json: null, portalSteps: [], powershell: null }
    }

    if (kind === 'create' && status !== 'done') action.summary.push(ACTION.thenEnforce)

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
        blockers.push({ kind: 'readiness', label })
        unblockNotes.push(label)
      }
      if (blockedBy.length > 0) status = 'blocked'
    }
    // Precise blocked sentences (prompt 13 §9): one per cause group.
    if (status === 'blocked') {
      const sentences: string[] = []
      const qNumbers = [...new Set(blockers.filter((b) => b.kind === 'setup').map((b) => (b as { questionNumber: number }).questionNumber))].sort((a, b) => a - b)
      if (qNumbers.length > 0) sentences.push(BLOCKED.setup(qNumbers))
      for (const b of blockers) {
        if (b.kind === 'step') sentences.push(BLOCKED.step(steps.find((s) => s.id === b.stepId)?.title ?? b.stepId))
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
    const opV = operatorId !== null ? viabilityById.get(operatorId) : undefined
    const operatorSafe = includesOperator
      ? (opV !== undefined && (opV.mfa === 'verified' || opV.methodTiers.includes('phishingResistant'))) || false
      : null

    const zeroUsage =
      readiness.family === 'block' &&
      (evidence.status === 'ok' || evidence.status === 'partial') &&
      evidence.affectedUserIds.length === 0
    const notReadyActive =
      pop.active -
      popIds.filter((id) => {
        const v = viabilityById.get(id)
        return v !== undefined && v.activity === 'active' && (v.mfa === 'verified' || v.mfa === 'likelyViable')
      }).length

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
      (evidenceUsable && readiness.family === 'block' && evidence.affectedUserIds.length === 0) ||
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
            ]

    const score = scoreResult(result, snapshot, viability, {
      prerequisites: blockedBy.length,
      newObjects: source ? createdWithinStepKeys(source.policy, mapping).length : 0,
      evidenceClean: zeroUsage || evidence.reportOnly?.meetsExitCriterion === true,
      affectedByBlock: evidenceUsable && readiness.family === 'block' ? evidence.affectedUserIds.length : null,
    })

    steps.push({
      id: stepId,
      goalId: goal.id,
      phase: goal.phase,
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
      rollback: kind === 'adjust' ? ROLLBACK.adjust : ROLLBACK.create,
      history: [],
      skipReason: null,
      ...EXTRAS,
      impact,
      safeToday: zeroUsage && status === 'ready',
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
      naming:
        kind === 'create' && status !== 'done'
          ? { proposed: proposedPolicyName(stepTitle(goal.name), naming), fromBaseline: source?.facts.name ?? null }
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
      population: population(viability.map((v) => v.userId), snapshot, viability),
      readiness: verifyReadiness,
      comms: COMMS.verify(tenantName),
      impact: IMPACT.verifyCampaign(toSetUp),
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
    steps.push({
      ...prereq('s-recurring-break-glass-drill', p.title, p.why(BREAK_GLASS_DRILL_DAYS), p.how, p.exit(BREAK_GLASS_DRILL_DAYS)),
      kind: 'recurring',
      rollback: ROLLBACK.recurring,
      goalId: 'recurring:break-glass',
      status: stale.length > 0 ? 'ready' : 'done',
      population: population(bgIds, snapshot, viability),
      readiness: {
        family: 'other',
        percent: null,
        lines: stale.length > 0 ? [p.overdue(stale.map(nameOf))] : [p.allDrilled],
      },
    })
  }

  // Readiness-blocked MFA/guest steps wait for the verification campaign: the
  // dependency is named so the scheduler places them after it.
  const verifyStep = steps.find((s) => s.id === 's-verify-mfa')
  if (verifyStep) {
    for (const s of steps) {
      if (s.status !== 'blocked' || !s.blockers.some((b) => b.kind === 'readiness')) continue
      if (s.readiness.family !== 'mfa' && s.readiness.family !== 'guest') continue
      if (!s.blockedBy.includes(verifyStep.id)) s.blockedBy.push(verifyStep.id)
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
    if (s.safeToday) return -1000
    const sev = s.kind === 'prerequisite' || s.kind === 'recurring' ? 0 : stepSeverity(s)
    const care = s.highCare.userIds.length > 0 ? 100_000 : 0
    return care + s.population.active * sev - (s.readiness.percent ?? 0)
  }
  steps.sort((a, b) => a.phase - b.phase || score(a) - score(b) || a.id.localeCompare(b.id))

  // ---- Schedule (waves) + comms dates ----
  const startIso = input.startDate ?? nextMonday(snapshot.asOf)
  const activeTotal = viability.filter((v) => v.activity === 'active').length
  const schedule = buildSchedule(steps, startIso, activeTotal, input.band ?? null)
  const waveStart = new Map(schedule.waves.map((w) => [w.wave, w.start]))
  for (const s of steps) {
    if (s.comms?.includes('{DATE}')) {
      const date = waveStart.get(schedule.waveOf[s.id] ?? 0) ?? startIso
      s.comms = s.comms.replaceAll('{DATE}', absoluteDate(date))
    }
  }

  annotateStateReasons(steps)
  return { steps, schedule }
}

export function findTaggedPolicy(snapshot: TenantSnapshot, planId: string, stepId: string): string | null {
  const tag = `[IAMAI:${planId}:${stepId}]`
  for (const raw of snapshot.config.caPolicies?.rows ?? []) {
    const p = raw as { id?: string; description?: string }
    if (typeof p.description === 'string' && p.description.includes(tag)) return p.id ?? null
  }
  return null
}
