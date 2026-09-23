import { emergencyPasskeyCompatibility } from '../roadmap/passkeyCompatibility.ts'
import { methodPreparation } from '../roadmap/methodReadiness.ts'
import { personLabels } from '../names.ts'
import { effectOf } from '../roadmap/operations.ts'
// The validation rule registry (docs/design/validation-rules.md).
//
// Every object the plan depends on is checked here and nowhere else. The
// break-glass set was incomplete twice and regressed silently once, which is
// what a registry prevents: a rule has a stable id, a severity, the data it
// needs, and one test each. `src/validation/rules.test.ts` asserts the full set
// of ids by subject, so dropping a rule fails the build.
//
// Three severities. A **blocker** holds every step that can deny access until
// it is cleared; a **warning** is a recommended fix that nothing waits on; a
// **note** is informational. `unknown` is a first-class outcome: a rule whose
// data was not collected (no licence, a 403, a group over the member cap) says
// so instead of passing silently, and **an unknown on a blocker blocks**.
//
// One deviation from the design's record shape: `evaluate` returns the finding
// and the fix along with the outcome, rather than `finding(result)` and
// `fix(result)` being separate members. Both always derive from the same facts,
// so splitting them would mean carrying a typed fact bag through three
// functions for no gain. Rule text lives in `src/copy/validation.ts`.
//
// Pure: no DOM, no network. Runs in Node tests, in the worker and in the UI.
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'
import type { AuthMethodSummary, MfaViability } from '../scoring/mfaViability.ts'
import { isPhishingResistantKind } from '../scoring/phishingResistant.ts'
import { FINDING as F, NEED_LABEL, RULE_CITATION, RULE_TEXT, UNKNOWN } from '../copy/validation.ts'
import type { Citation } from '../copy/validation.ts'
import { methodName } from '../copy/inventory.ts'
import { absoluteDate, relative } from '../copy/dates.ts'
import { BREAK_GLASS_DRILL_DAYS } from '../roadmap/constants.ts'
import { isRecordedDrill, latestRecoveryTest, recoveryCredentialBasis, recoveryEvidenceOf } from '../roadmap/cleanupDone.ts'
import type { MappingState } from '../mapping/types.ts'
import { exclusionsGroupPolicies } from './exclusionsGroupPolicies.ts'

// ---- the model -------------------------------------------------------------

/** What a group rule needs to know; a cache entry satisfies it structurally. */
export type GroupFacts = {
  groupId: string
  displayName?: string | null
  membershipRule?: string | null
  mailEnabled?: boolean | null
  securityEnabled?: boolean | null
  groupTypes?: string[] | null
  isAssignableToRole?: boolean | null
  membershipRuleProcessingState?: string | null
  assignedLicenseSkuIds?: string[] | null
  memberIds: string[]
  memberCount: number
  sampled: boolean
  directMembers?: 'complete' | 'sampled' | 'unknown'
  directMemberIds?: string[]
}

export type RuleSubject =
  | 'breakGlass'
  | 'exclusionGroup'
  | 'trustedLocation'
  | 'allowedCountries'
  | 'pilotGroup'
  | 'serviceAccount'
  | 'authStrength'

export type RuleSeverity = 'blocker' | 'warning' | 'note'
export type RuleOutcome = 'pass' | 'fail' | 'unknown'

/** The snapshot data a rule needs; a missing one makes the rule unknown. */
export type NeedKey =
  | 'users'
  | 'roles'
  | 'authMethods'
  | 'caPolicies'
  | 'organization'
  | 'authMethodsPolicy'
  | 'namedLocations'
  | 'authStrengths'
  | 'signInEvidence'
  | 'devices'
  | 'groupMembers'
  | 'answers'
  | 'recoveryTests'

export type RuleEval = {
  outcome: RuleOutcome
  /** Plain language naming the object and the fact; null when the rule passes with nothing to say. */
  finding?: string | null
  /**
   * The structured values the matching content checkFixes template names for
   * this rule (prompt 52, walk-51 item 14): e.g. `{ policies }` for
   * excluded-everywhere, `{ device, otherAccount }` for shared-authenticator.
   * The account name is resolved from the result's `target`, so a rule whose
   * template needs only `{name}` sets nothing here.
   */
  values?: Record<string, unknown>
  /**
   * The checkFixes key this result renders, when the rule's own template is not
   * the truthful line for the facts it found (validation/checkFixes.ts
   * RULE_TO_FIX holds the default). The outcome is untouched: an alternate
   * template changes the words, never whether the check failed.
   */
  fix?: string
  /**
   * The check did not run: a source it needs was not collected (missingNeeds),
   * so it looked at nothing. Set by the runner only. An `unknown` without it is
   * a check that ran on what the scan read and could not decide, which is a
   * different state to report: the allowed-countries step called sign-in
   * records the scan could not use at all "Not Fully Read" (R4-58).
   */
  notRead?: true
}

export type RuleResult = RuleEval & {
  id: string
  subject: RuleSubject
  severity: RuleSeverity
  /** The thing checked: a user id, a group id, a location id. */
  target: string | null
}

export type ValidationContext = {
  snapshot: TenantSnapshot
  /** An account by the one naming rule (names.ts personLabels), computed once per context. Absent on a hand-built context: nameOf computes it then. */
  personLabel?: (id: string) => string | null
  mapping: MappingState
  /** Conditional Access policies as collected; empty when the section was refused. */
  tenantPolicies: unknown[]
  groupMembers: GroupFacts[]
  breakGlassIds: string[]
  operatorUserId: string | null
  allowedCountries: string[]
  serviceAccountIds: string[]
  approvedExclusionIds: string[]
  /**
   * The accounts the emergency step itself puts forward and nobody has confirmed
   * (mapping/emergencyChoice.ts: recommended nominations and the prior ids of a
   * record with no proof a person chose them).
   *
   * Wording only. Nothing here is an emergency account: it is not in
   * `breakGlassIds`, so no rule may approve it, exclude it from the population or
   * let it reach a policy operation. It exists so the exclusions-group checks do
   * not tell an operator to remove the very accounts IAMAI is recommending they
   * confirm — the group stays blocked either way.
   */
  unconfirmedEmergencyIds: string[]
  viability: MfaViability[]
  /** The two facts no tenant exposes, answered once in Setup. */
  answers: { credentialStorage: boolean | null; signInMonitoring: boolean | null }
  custodyBasis: Record<string, string>
  /** Every emergency access drill the plan recorded (the Cleanup drill row's Done): a sign-in on one of these days is the drill. */
  drillDates: string[]
  drillRecords?: import('../roadmap/cleanupDone.ts').CleanupCheckpoint[]
}

export type ValidationRule<S = string> = {
  id: string
  subject: RuleSubject
  severity: RuleSeverity
  needs: NeedKey[]
  evaluate: (target: S, ctx: ValidationContext) => RuleEval
}

export function ruleText(id: string): { what: string; why: string; label?: string } {
  return RULE_TEXT[id] ?? { what: id, why: '' }
}

/**
 * Where the check comes from. A rule with no source is a rule nobody has
 * verified (audit-program §6); `FIELD_PRACTICE` is the honest answer for the
 * checks that are real and that Microsoft does not document.
 */
export function citationFor(id: string): Citation | undefined {
  return RULE_CITATION[id]
}

// ---- what counts as collected ---------------------------------------------

function configOk(ctx: ValidationContext, key: 'caPolicies' | 'organization' | 'authMethodsPolicy' | 'namedLocations' | 'authStrengths' | 'roleAssignments'): boolean {
  return ctx.snapshot.config[key]?.status === 'ok'
}

function sourceUsable(ctx: ValidationContext, key: 'users' | 'authMethods' | 'devices' | 'signInEvidence'): boolean {
  const st = ctx.snapshot.sources[key]?.status
  return st === 'ok' || st === 'partial'
}

/** Needs that were not collected; a rule with any of these cannot run. */
export function missingNeeds(rule: { needs: NeedKey[] }, ctx: ValidationContext): string[] {
  const out: string[] = []
  for (const need of rule.needs) {
    const ok =
      need === 'users' ? ctx.snapshot.users.length > 0 || sourceUsable(ctx, 'users')
      : need === 'roles' ? configOk(ctx, 'roleAssignments')
      : need === 'authMethods' ? sourceUsable(ctx, 'authMethods')
      : need === 'caPolicies' ? configOk(ctx, 'caPolicies')
      : need === 'organization' ? configOk(ctx, 'organization')
      : need === 'authMethodsPolicy' ? configOk(ctx, 'authMethodsPolicy')
      : need === 'namedLocations' ? configOk(ctx, 'namedLocations')
      : need === 'authStrengths' ? configOk(ctx, 'authStrengths')
      : need === 'signInEvidence' ? sourceUsable(ctx, 'signInEvidence')
      : need === 'devices' ? sourceUsable(ctx, 'devices')
      : true // groupMembers, answers and recoveryTests: the rule decides for itself
    if (!ok) out.push(NEED_LABEL[need] ?? need)
  }
  return out
}

const PASS: RuleEval = { outcome: 'pass', finding: null }
const fail = (finding: string, values?: Record<string, unknown>, fix?: string): RuleEval => ({ outcome: 'fail', finding, values, fix })
const unknown = (finding: string): RuleEval => ({ outcome: 'unknown', finding })
const pass = (finding: string | null = null): RuleEval => ({ outcome: 'pass', finding })

// ---- shared facts ----------------------------------------------------------

export const GLOBAL_ADMIN_ROLE = '62e90394-69f5-4237-9190-012177145e10'
const NON_MFA_KINDS = new Set(['password', 'email', 'other'])
/** Exchange Online plans: a licence that puts a mailbox on the account. */
const MAILBOX_PLANS = new Set([
  '9aaf7827-d63c-4b61-89c3-182f06f82e5c',
  'efb87545-963c-4e0d-99df-69c6916d9eb0',
  '4a82b400-a79f-41a4-b4e2-e94f5787b113',
  '1126bef5-da20-4f07-b45e-ad25d2581aa8',
  '9f431833-0334-42de-a7dc-70aa40db46db',
])
/** A display name that says the account is for emergencies. */
const PURPOSE_NAME = /break[\s-]?glass|emergency|escape|glass[\s-]?break|recovery/i

function userOf(ctx: ValidationContext, id: string): UserRow | null {
  return ctx.snapshot.users.find((u) => u.id === id) ?? null
}

/** An account by the one naming rule (names.ts): a display name another account shares carries its address. */
function nameOf(ctx: ValidationContext, id: string): string {
  const label = ctx.personLabel ? ctx.personLabel(id) : personLabels(ctx.snapshot.users).get(id) ?? null
  return label ?? userOf(ctx, id)?.userPrincipalName ?? id
}

function methodsOf(ctx: ValidationContext, id: string): AuthMethodSummary[] | 'unknown' | undefined {
  return ctx.snapshot.authMethods[id]
}

function mfaKinds(methods: AuthMethodSummary[]): string[] {
  return [...new Set(methods.map((m) => m.kind))].filter((k) => !NON_MFA_KINDS.has(k))
}

/** The tenant's own onmicrosoft.com domain, from /organization. */
export function initialDomain(snapshot: TenantSnapshot): string | null {
  const org = (snapshot.config.organization?.rows?.[0] ?? null) as { verifiedDomains?: { name?: string; isInitial?: boolean }[] } | null
  const domains = org?.verifiedDomains ?? []
  const flagged = domains.filter((d) => d.isInitial === true && typeof d.name === 'string').map(d => d.name!)
  return flagged.length === 1 ? flagged[0] : null
}

type RoleSchedule = {
  principalId?: string
  roleDefinitionId?: string
  directoryScopeId?: string
  assignmentType?: string
  startDateTime?: string | null
  endDateTime?: string | null
}

const sameId = (a: string | null | undefined, b: string): boolean => typeof a === 'string' && a.toLowerCase() === b.toLowerCase()
const atOrBefore = (value: string | null | undefined, at: string): boolean => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.parse(at)

/** One production meaning of a current, permanent, tenant-root GA assignment. */
export function permanentGlobalAdministratorState(snapshot: TenantSnapshot, groupMembers: readonly GroupFacts[], accountId: string): boolean | null {
  if (snapshot.config.roleAssignments?.status !== 'ok' || snapshot.config.roleAssignmentSchedules?.status !== 'ok') return null
  const activeDirect = (snapshot.roles.active[accountId] ?? []).some(role => sameId(role, GLOBAL_ADMIN_ROLE))
  const schedules = snapshot.config.roleAssignmentSchedules.rows as RoleSchedule[]
  const relevant = schedules.filter(row => sameId(row.principalId, accountId) && sameId(row.roleDefinitionId, GLOBAL_ADMIN_ROLE) && row.directoryScopeId === '/')
  const permanent = relevant.some(row => {
    // This source contains unifiedRoleAssignmentScheduleInstance records.
    // Instances represent active assignments and have no status property.
    // memberType describes inheritance, not Assigned versus Activated.
    const type = String(row.assignmentType ?? '').toLowerCase()
    return type === 'assigned'
      // Direct permanent instances can explicitly return null start dates.
      // Their current activity is corroborated by roleAssignments above.
      // An omitted date remains unknown.
      && (row.startDateTime === null || atOrBefore(row.startDateTime, snapshot.asOf))
      && row.endDateTime === null
  })
  if (activeDirect && permanent) return true
  if (activeDirect) {
    // An explicit schedule can establish that the effective role is temporary,
    // future or expired. Missing schedule fields remain unknown; they never
    // become evidence of permanence.
    const completeNonPermanent = relevant.some(row => {
      const type = String(row.assignmentType ?? '').toLowerCase()
      const startKnown = row.startDateTime === null || (typeof row.startDateTime === 'string' && Number.isFinite(Date.parse(row.startDateTime)))
      const endKnown = row.endDateTime === null || (typeof row.endDateTime === 'string' && Number.isFinite(Date.parse(row.endDateTime)))
      return ['assigned', 'activated'].includes(type) && startKnown && endKnown
    })
    return completeNonPermanent ? false : null
  }

  // Current group membership proves effective access, not that the account's
  // membership is permanent. Until that schedule is readable, do not promote
  // group-derived GA to the emergency-account permanence claim.
  const roleGroups = groupMembers.filter(group => group.isAssignableToRole === true)
  const effectiveThroughGroup = roleGroups.some(group =>
    group.memberIds.some(member => sameId(member, accountId))
    && (snapshot.roles.active[group.groupId] ?? []).some(role => sameId(role, GLOBAL_ADMIN_ROLE)),
  )
  const sampledCouldContain = roleGroups.some(group =>
    group.sampled
    && !group.memberIds.some(member => sameId(member, accountId))
    && (snapshot.roles.active[group.groupId] ?? []).some(role => sameId(role, GLOBAL_ADMIN_ROLE)),
  )
  return effectiveThroughGroup || sampledCouldContain ? null : false
}

/** Every enabled or report-only policy; a disabled policy denies nothing. */
type PolicyShape = {
  displayName?: string
  state?: string
  conditions?: { users?: { excludeUsers?: string[]; excludeGroups?: string[] } }
}
function livePolicies(ctx: ValidationContext): PolicyShape[] {
  return (ctx.tenantPolicies as PolicyShape[]).filter((p) => p.state !== 'disabled')
}

/** Policies that actually deny: Microsoft says report-only ones need no exclusion. */
function enforcingPolicies(ctx: ValidationContext): PolicyShape[] {
  return (ctx.tenantPolicies as PolicyShape[]).filter((p) => p.state === 'enabled')
}

function reportOnlyPolicies(ctx: ValidationContext): PolicyShape[] {
  return (ctx.tenantPolicies as PolicyShape[]).filter((p) => p.state === 'enabledForReportingButNotEnforced')
}

/** Policies Microsoft created and will enable on its own after about 30 days. */
function microsoftManaged(ctx: ValidationContext): PolicyShape[] {
  const managed = new Set(ctx.snapshot.microsoftManagedPolicyIds ?? [])
  return (ctx.tenantPolicies as (PolicyShape & { id?: string })[]).filter(
    (p) => (p.id !== undefined && managed.has(p.id)) || /^Microsoft-managed/i.test(p.displayName ?? ''),
  )
}

/** Whether this account is excluded from a policy, directly or through a group. */
function excludedFrom(p: PolicyShape, id: string, memberOf: Set<string>): boolean {
  if ((p.conditions?.users?.excludeUsers ?? []).includes(id)) return true
  return (p.conditions?.users?.excludeGroups ?? []).some((g) => memberOf.has(g))
}

// ---- break-glass: blockers -------------------------------------------------

const bgCount: ValidationRule = {
  id: 'bg.count',
  subject: 'breakGlass',
  severity: 'blocker',
  needs: [],
  evaluate: (_id, ctx) =>
    ctx.breakGlassIds.length >= 2 ? pass(F.bgCountOk(ctx.breakGlassIds.length)) : fail(F.bgCount(ctx.breakGlassIds.length)),
}

const bgPermanentGa: ValidationRule = {
  id: 'bg.role.permanentGa',
  subject: 'breakGlass',
  severity: 'blocker',
  needs: ['roles'],
  evaluate: (id, ctx) => {
    const state = permanentGlobalAdministratorState(ctx.snapshot, ctx.groupMembers, id)
    if (state === true) return PASS
    if (state === null) return unknown('Global Administrator access is present or possible, but a current permanent tenant-root assignment was not established.')
    if ((ctx.snapshot.roles.eligible[id] ?? []).some(role => sameId(role, GLOBAL_ADMIN_ROLE))) return fail(F.bgEligibleOnly)
    return fail(F.bgNoGa)
  },
}

const bgCloudOnly: ValidationRule = {
  id: 'bg.cloudOnly',
  subject: 'breakGlass',
  severity: 'blocker',
  needs: ['users'],
  evaluate: (id, ctx) => {
    const user = userOf(ctx, id)
    if (!user || (user.onPremisesSyncEnabled === null && user.onPremisesSyncEnabledRead !== true)) return unknown('Cloud-only identity status was not reported.')
    return user.onPremisesSyncEnabled === true ? fail(F.bgSynced) : PASS
  },
}

const bgInitialDomain: ValidationRule = {
  id: 'bg.initialDomain',
  subject: 'breakGlass',
  severity: 'blocker',
  needs: ['users', 'organization'],
  evaluate: (id, ctx) => {
    const upn = userOf(ctx, id)?.userPrincipalName ?? null
    const initial = initialDomain(ctx.snapshot)
    if (initial === null) return unknown(F.bgNoInitialDomain)
    if (upn === null) return unknown(F.bgNoInitialDomain)
    return upn.toLowerCase().endsWith(`@${initial.toLowerCase()}`) ? PASS : fail(F.bgCustomDomain(upn, initial), { onmicrosoftDomain: initial })
  },
}

const bgEnabled: ValidationRule = {
  id: 'bg.enabled',
  subject: 'breakGlass',
  severity: 'blocker',
  needs: ['users'],
  evaluate: (id, ctx) => {
    const value = userOf(ctx, id)?.accountEnabled
    return value === false ? fail(F.bgDisabled) : value === true ? PASS : unknown('Account enabled status was not reported.')
  },
}

const bgExcluded: ValidationRule = {
  id: 'bg.excludedFromAllPolicies',
  subject: 'breakGlass',
  severity: 'blocker',
  needs: ['caPolicies'],
  evaluate: (id, ctx) => {
    const known = new Set(ctx.groupMembers.map((g) => g.groupId))
    const memberOf = new Set(ctx.groupMembers.filter((g) => g.memberIds.includes(id)).map((g) => g.groupId))
    const missing: string[] = []
    const unverifiable: string[] = []
    // Enforcing policies only. Microsoft's emergency-access page says
    // "Report-only policies don't require an exclusion", so holding the whole
    // plan on one would be a blocker the documentation does not support.
    for (const p of enforcingPolicies(ctx)) {
      const groups = p.conditions?.users?.excludeGroups ?? []
      if (excludedFrom(p, id, memberOf)) continue
      if (groups.some((g) => !known.has(g))) unverifiable.push(p.displayName ?? '(unnamed)')
      else missing.push(p.displayName ?? '(unnamed)')
    }
    if (missing.length > 0) return fail(F.bgNotExcluded(missing), { policies: missing })
    // A group nobody read cannot prove the exclusion either way; on a blocker
    // that holds the plan exactly as a failure does (design §1).
    if (unverifiable.length > 0) return unknown(F.bgExclusionUnverified(unverifiable))
    return PASS
  },
}

const bgExcludedFromReportOnly: ValidationRule = {
  id: 'bg.excludedFromReportOnly',
  subject: 'breakGlass',
  severity: 'warning',
  needs: ['caPolicies'],
  evaluate: (id, ctx) => {
    const memberOf = new Set(ctx.groupMembers.filter((g) => g.memberIds.includes(id)).map((g) => g.groupId))
    const missing = reportOnlyPolicies(ctx)
      .filter((p) => !excludedFrom(p, id, memberOf))
      .map((p) => p.displayName ?? '(unnamed)')
    return missing.length === 0 ? PASS : fail(F.bgNotExcludedReportOnly(missing), { policies: missing })
  },
}

const bgMicrosoftManaged: ValidationRule = {
  id: 'bg.microsoftManaged',
  subject: 'breakGlass',
  severity: 'warning',
  needs: ['caPolicies'],
  evaluate: (id, ctx) => {
    const managed = microsoftManaged(ctx)
    if (managed.length === 0) return PASS
    const memberOf = new Set(ctx.groupMembers.filter((g) => g.memberIds.includes(id)).map((g) => g.groupId))
    const missing = managed.filter((p) => !excludedFrom(p, id, memberOf)).map((p) => p.displayName ?? '(unnamed)')
    return missing.length === 0 ? pass(F.bgManagedExcluded(managed.length)) : fail(F.bgManagedMissing(missing), { policies: missing })
  },
}

const bgNotInDynamicScope: ValidationRule = {
  id: 'bg.notInDynamicScope',
  subject: 'breakGlass',
  severity: 'blocker',
  needs: ['groupMembers'],
  evaluate: (id, ctx) => {
    const hit = ctx.groupMembers.find((g) => Boolean(g.membershipRule) && g.memberIds.includes(id))
    return hit ? fail(F.bgDynamic(hit.displayName ?? hit.groupId, hit.membershipRule as string), { group: hit.displayName ?? hit.groupId }) : PASS
  },
}

const bgHasMfaMethod: ValidationRule = {
  id: 'bg.hasMfaMethod',
  subject: 'breakGlass',
  severity: 'blocker',
  needs: ['authMethods'],
  evaluate: (id, ctx) => {
    const methods = methodsOf(ctx, id)
    if (methods === undefined || methods === 'unknown') return unknown(UNKNOWN.needs([NEED_LABEL.authMethods]))
    return mfaKinds(methods).length > 0 ? PASS : fail(F.bgNoMfaMethod)
  },
}

// A warning, not a blocker: the plan's tier decides what holds the rollout
// (emergencyTiers.ts), and a shared device is hardening that holds nothing. As a
// blocker How called it Must fix, which says the plan holds on it (Phase 2 audit).
const bgSeparateDevices: ValidationRule = {
  id: 'bg.separateDevices',
  subject: 'breakGlass',
  severity: 'warning',
  needs: ['authMethods'],
  evaluate: (id, ctx) => {
    const methods = methodsOf(ctx, id)
    if (methods === undefined || methods === 'unknown') return unknown(UNKNOWN.needs([NEED_LABEL.authMethods]))
    const mine = new Set(methods.filter((m) => m.kind === 'microsoftAuthenticator' && m.displayName).map((m) => m.displayName as string))
    if (mine.size === 0) return PASS
    for (const [otherId, other] of Object.entries(ctx.snapshot.authMethods)) {
      if (otherId === id || other === 'unknown') continue
      for (const m of other) {
        if (m.kind !== 'microsoftAuthenticator' || !m.displayName || !mine.has(m.displayName)) continue
        // By sign-in name: the one card this clause is drawn on (Prepared
        // passkeys) names every account that way, and a display name there gave
        // the other account a second name in the same sentence.
        const who = ctx.snapshot.users.filter((u) => u.id === otherId).map((u) => u.userPrincipalName ?? u.displayName ?? otherId)
        return fail(F.bgSharedDevice(m.displayName, who.length > 0 ? who : [otherId]), { device: m.displayName, otherAccount: who[0] ?? otherId })
      }
    }
    return PASS
  },
}

// A warning for the same reason as bg.separateDevices: hardening, never a minimum.
const bgNotPersonal: ValidationRule = {
  id: 'bg.notPersonal',
  subject: 'breakGlass',
  severity: 'warning',
  needs: ['users'],
  evaluate: (id, ctx) => {
    if (ctx.operatorUserId !== null && ctx.operatorUserId === id) return fail(F.bgPersonalOperator, { attribute: 'your own account' })
    const u = userOf(ctx, id)
    if (!u) return unknown(UNKNOWN.needs([NEED_LABEL.users]))
    const facts: string[] = []
    if (u.department) facts.push(`department ${u.department}`)
    if (u.jobTitle) facts.push(`job title ${u.jobTitle}`)
    if (u.officeLocation) facts.push(`office ${u.officeLocation}`)
    return facts.length > 0 ? fail(F.bgPersonal(facts), { attribute: facts.join(', ') }) : PASS
  },
}

// ---- break-glass: warnings -------------------------------------------------

const bgPhishingResistant: ValidationRule = {
  id: 'bg.phishingResistant',
  subject: 'breakGlass',
  severity: 'warning',
  needs: ['authMethods'],
  evaluate: (id, ctx) => {
    const methods = methodsOf(ctx, id)
    if (methods === undefined || methods === 'unknown') return unknown(UNKNOWN.needs([NEED_LABEL.authMethods]))
    const kinds = mfaKinds(methods)
    if (kinds.some(isPhishingResistantKind)) return PASS
    if (kinds.length > 0 && kinds.every((k) => k === 'phone')) return fail(F.bgSmsOnly)
    return fail(F.bgNoPhishingResistant)
  },
}

const bgMethodDiversity: ValidationRule = {
  id: 'bg.methodDiversity',
  subject: 'breakGlass',
  severity: 'warning',
  needs: ['authMethods'],
  evaluate: (_id, ctx) => {
    if (ctx.breakGlassIds.length < 2) return PASS
    const perAccount = ctx.breakGlassIds.map((bid) => {
      const m = ctx.snapshot.authMethods[bid]
      return m === undefined || m === 'unknown' ? null : mfaKinds(m)
    })
    if (perAccount.some((k) => k === null)) return unknown(UNKNOWN.needs([NEED_LABEL.authMethods]))
    const lists = perAccount as string[][]
    if (lists.some((k) => k.length !== 1)) return PASS
    const only = lists[0][0]
    return lists.every((k) => k[0] === only) ? fail(F.bgSameMethodType(only), { method: methodName(only) }) : PASS
  },
}

/**
 * Owner rule (R7, 2026-09-21): team and operator passkeys route to Microsoft
 * Authenticator first, and EMERGENCY ACCESS keeps the hardware key. A passkey in
 * Authenticator is a `multiDeviceCredential`: it lives on a phone and syncs with
 * a personal account, which is three dependencies a break-glass credential
 * exists to have none of.
 *
 * The scan already reads the storage type and printed it per account as a bare
 * word — `multiDeviceCredential` — and judged nothing. A reader who does not
 * know the term learns nothing from it, and the approved-model list offers the
 * two Authenticator models first, so the shortest path through the step puts the
 * organisation's only way back in on one person's phone.
 *
 * A warning, not a minimum: the owner's rule is that emergency access is the one
 * large gate and nothing else becomes one. This says so where the credential is
 * chosen; it does not refuse the plan. It passes as soon as ONE account holds a
 * device-bound credential, because one hardware key kept apart is the point.
 */
const bgHardwareCredential: ValidationRule = {
  id: 'bg.hardwareCredential',
  subject: 'breakGlass',
  severity: 'warning',
  needs: ['authMethods'],
  evaluate: (_id, ctx) => {
    if (ctx.breakGlassIds.length === 0) return PASS
    const perAccount = ctx.breakGlassIds.map((bid) => {
      const m = ctx.snapshot.authMethods[bid]
      if (m === undefined || m === 'unknown' || !Array.isArray(m)) return null
      return m.filter((x) => x.kind === 'passkey' || x.kind === 'fido2')
    })
    // A type the scan could not read is not a phone credential: unknown never fails.
    if (perAccount.some((keys) => keys === null)) return unknown(UNKNOWN.needs([NEED_LABEL.authMethods]))
    const keys = perAccount as { passkeyType?: string }[][]
    if (keys.every((list) => list.length === 0)) return PASS
    const deviceBound = (list: { passkeyType?: string }[]): boolean => list.some((k) => k.passkeyType === 'deviceBound')
    const readable = (list: { passkeyType?: string }[]): boolean => list.some((k) => typeof k.passkeyType === 'string' && k.passkeyType.length > 0)
    // The keys were read; their TYPE was not. Saying "registered sign-in
    // methods" here claims the scan is blind to something it is holding, on a
    // tenant whose registration source read `ok` — and the reader who checks,
    // as this one did, finds the methods sitting right there and stops
    // believing the tile. The verdict stays unknown, which is the conservative
    // reading and the right one; only the claim about what is missing changes.
    if (!keys.some(readable)) return unknown(UNKNOWN.needs([NEED_LABEL.passkeyType]))
    return keys.some(deviceBound) ? PASS : fail(F.bgSyncedOnly)
  },
}

const bgPerUserMfaOff: ValidationRule = {
  id: 'bg.perUserMfaOff',
  subject: 'breakGlass',
  severity: 'warning',
  needs: ['authMethodsPolicy'],
  evaluate: (_id, ctx) => {
    // Per-user MFA state is not exposed by Microsoft Graph at all; the closest
    // readable fact is whether the tenant has finished the methods migration.
    // "Could not be read" only when the read actually failed (prompt 46 item
    // 24). A read that succeeded and came back without the field is a
    // different fact, and says so.
    const section = ctx.snapshot.config.authMethodsPolicy ?? null
    if (!section || section.status !== 'ok') return unknown(UNKNOWN.needs([NEED_LABEL.authMethodsPolicy]))
    const row = (section.rows[0] ?? null) as { policyMigrationState?: string } | null
    if (!row?.policyMigrationState) return unknown(UNKNOWN.readWithout(NEED_LABEL.authMethodsPolicy, 'migration state'))
    return row.policyMigrationState === 'migrationComplete' ? PASS : fail(F.bgPerUserMfa)
  },
}

const bgNoLicenceNeeded: ValidationRule = {
  id: 'bg.noLicenceNeeded',
  subject: 'breakGlass',
  severity: 'warning',
  needs: ['users'],
  evaluate: (id, ctx) => {
    const u = userOf(ctx, id)
    if (!u) return unknown(UNKNOWN.needs([NEED_LABEL.users]))
    const enabled = u.assignedPlans.filter((p) => p.capabilityStatus === 'Enabled')
    const mailbox = enabled.some((p) => MAILBOX_PLANS.has(p.servicePlanId))
    return mailbox ? fail(F.bgLicensed(enabled.length), { licence: 'a licence with a mailbox' }) : PASS
  },
}

const bgDrilled: ValidationRule = {
  id: 'bg.drilled',
  subject: 'breakGlass',
  severity: 'warning',
  needs: ['users', 'recoveryTests'],
  evaluate: (id, ctx) => {
    const u = userOf(ctx, id)
    if (!u) return unknown(UNKNOWN.needs([NEED_LABEL.users]))
    const { basis, context } = recoveryEvidenceOf(ctx.snapshot, ctx.mapping, new Map(ctx.groupMembers.map(group => [group.groupId, group])), ctx.drillRecords ?? [], ctx.snapshot.asOf, id)
    const testedAt = latestRecoveryTest(id, ctx.drillRecords ?? [], ctx.snapshot.asOf, basis, context)
    if (!testedAt) return fail(F.bgNoRecordedDrill)
    const days = Math.floor((Date.parse(ctx.snapshot.asOf) - Date.parse(testedAt)) / 86_400_000)
    return days > BREAK_GLASS_DRILL_DAYS
      ? fail(F.bgDrillDue(absoluteDate(testedAt), BREAK_GLASS_DRILL_DAYS))
      : pass(F.bgDrilled(absoluteDate(testedAt), BREAK_GLASS_DRILL_DAYS))
  },
}

const bgCredentialStorage: ValidationRule = {
  id: 'bg.credentialStorage',
  subject: 'breakGlass',
  severity: 'warning',
  needs: [],
  // No tenant exposes this fact, so an absent answer is "not yet done", never
  // "could not be checked" (prompt 46 item 21): the line stays on the
  // emergency-access step until somebody says it is true.
  evaluate: (_id, ctx) => {
    if (ctx.answers.credentialStorage !== true) return fail(F.bgCredentialStorage)
    const current = recoveryCredentialBasis(ctx.snapshot, ctx.breakGlassIds)
    if (!ctx.breakGlassIds.length || ctx.breakGlassIds.some(id => !current[id] || ctx.custodyBasis[id] !== current[id])) return fail('Confirm custody again for the selected accounts and their current recovery credentials.')
    return PASS
  },
}

const bgSignInMonitoring: ValidationRule = {
  id: 'bg.signInMonitoring',
  subject: 'breakGlass',
  severity: 'warning',
  needs: [],
  evaluate: (_id, ctx) => (ctx.answers.signInMonitoring === true ? PASS : fail(F.bgSignInMonitoring)),
}

const bgNameIdentifiesPurpose: ValidationRule = {
  id: 'bg.nameIdentifiesPurpose',
  subject: 'breakGlass',
  severity: 'warning',
  needs: ['users'],
  evaluate: (id, ctx) => {
    const u = userOf(ctx, id)
    if (!u) return unknown(UNKNOWN.needs([NEED_LABEL.users]))
    const name = `${u.displayName ?? ''} ${u.userPrincipalName ?? ''}`
    return PURPOSE_NAME.test(name) ? PASS : fail(F.bgName(u.displayName ?? u.userPrincipalName ?? id))
  },
}

// ---- break-glass: notes ----------------------------------------------------

const bgLastSignIn: ValidationRule = {
  id: 'bg.lastSignIn',
  subject: 'breakGlass',
  severity: 'warning',
  needs: ['users', 'recoveryTests'],
  // R10: a break-glass account that has never signed in is the expected case,
  // and printing that as a note is bookkeeping. A break-glass account that HAS
  // signed in is worth a line, because somebody used the escape hatch: a sign-in
  // on a recorded drill's day is the drill (E3, the Cleanup drill row's Done
  // records the date); any other sign-in inside the drill window is a question
  // the step asks (confirm who signed in and why), until a drill moves the last
  // sign-in on to a recorded day.
  //
  // It also removes the contradiction the review caught: this rule reads the
  // directory's all-time last sign-in while the two below read the evidence
  // window, so "last signed in in June" sat beside "never seen".
  evaluate: (id, ctx) => {
    const at = userOf(ctx, id)?.lastSuccessfulSignIn ?? null
    if (at === null) return pass()
    const { context } = recoveryEvidenceOf(ctx.snapshot, ctx.mapping, new Map(ctx.groupMembers.map(group => [group.groupId, group])), ctx.drillRecords ?? [], ctx.snapshot.asOf, id)
    if (isRecordedDrill(at, ctx.drillDates, id, ctx.drillRecords ?? [], context)) return pass(F.bgLastSignInDrill(absoluteDate(at)))
    const days = Math.floor((Date.parse(ctx.snapshot.asOf) - Date.parse(at)) / 86_400_000)
    if (days <= BREAK_GLASS_DRILL_DAYS) return fail(F.bgLastSignInUnrecorded(absoluteDate(at)), { ago: relative(at, Date.parse(ctx.snapshot.asOf)) })
    return pass(F.bgLastSignIn(absoluteDate(at)))
  },
}

const bgSignInCountries: ValidationRule = {
  id: 'bg.signInCountries',
  subject: 'breakGlass',
  severity: 'note',
  needs: ['signInEvidence'],
  evaluate: (id, ctx) => {
    // Only where there is something to say: a country list is a finding, the
    // absence of one in a 30-day window is not (R10).
    const countries = ctx.snapshot.signInEvidence[id]?.countries ?? []
    return countries.length > 0 ? pass(F.bgCountries(countries)) : pass()
  },
}

const bgMfaSeen: ValidationRule = {
  id: 'bg.mfaSeen',
  subject: 'breakGlass',
  severity: 'note',
  needs: ['signInEvidence'],
  // Only worth saying when the account signed in and did not do MFA (R10).
  evaluate: (id, ctx) => {
    const ev = ctx.snapshot.signInEvidence[id]
    if (!ev || ev.signInCount === 0) return pass()
    return ev.lastMfaSuccess ? pass(F.bgMfaSeen) : pass(F.bgMfaNotSeen)
  },
}

// ---- exclusions group ------------------------------------------------------

type GroupTarget = GroupFacts | null

const groupUnknown = (): RuleEval => unknown(UNKNOWN.needs([NEED_LABEL.groupMembers]))

/**
 * The direction the approved-members rule does not check.
 *
 * `xg.membersApproved` asks whether anybody is in the group who should not be.
 * This asks the other half, and it is the half the product's whole promise rests
 * on: policies exclude the *group*, never an emergency account by name, so an
 * emergency account outside the group is inside every policy the group carves
 * out of — the account that exists to be the way back in is the one account the
 * way back in does not cover.
 *
 * Absence has to be proved, so a membership nothing enumerated is unknown and
 * not a pass: a sampled list proves somebody is a member and never that somebody
 * is not. With no emergency account confirmed there is nothing to contain, and
 * `bg.count` is the rule that says so.
 */
const xgContainsEmergency: ValidationRule<GroupTarget> = {
  id: 'xg.containsEmergency',
  subject: 'exclusionGroup',
  severity: 'blocker',
  needs: ['groupMembers'],
  evaluate: (entry, ctx) => {
    if (!entry) return groupUnknown()
    if (entry.directMembers !== 'complete') return unknown(F.xgMembershipUnread)
    if (ctx.breakGlassIds.length === 0) return PASS
    const members = new Set((entry.directMemberIds ?? []).map((id) => id.toLowerCase()))
    const missing = ctx.breakGlassIds.filter((id) => !members.has(id.toLowerCase()))
    if (missing.length === 0) return PASS
    const names = missing.map((id) => nameOf(ctx, id))
    return fail(F.xgMissingEmergency(names), { missingAccounts: names })
  },
}

/**
 * True where an unapproved member is one of the accounts the emergency step is
 * asking the operator to confirm.
 *
 * The check still fails and the group is still blocked — an unconfirmed account
 * is not an emergency account, here or anywhere. Only the fix line changes: a
 * tenant whose exclusions group already holds its Breakglass accounts was being
 * told to remove them while the emergency step recommended the same accounts,
 * and following that would have taken the way back in out of the group.
 */
function unconfirmedEmergency(ctx: ValidationContext, ids: string[]): boolean {
  const offered = new Set(ctx.unconfirmedEmergencyIds.map((id) => id.toLowerCase()))
  return ids.some((id) => offered.has(id.toLowerCase()))
}

const xgMembersApproved: ValidationRule<GroupTarget> = {
  id: 'xg.membersApproved',
  subject: 'exclusionGroup',
  severity: 'blocker',
  needs: ['groupMembers'],
  evaluate: (entry, ctx) => {
    if (!entry) return groupUnknown()
    if (entry.directMembers !== 'complete') return unknown(UNKNOWN.needs([NEED_LABEL.groupMembers]))
    const approved = new Set([...ctx.breakGlassIds, ...ctx.approvedExclusionIds])
    const extra = (entry.directMemberIds ?? []).filter((id) => !approved.has(id))
    if (extra.length === 0) return PASS
    const names = extra.map((id) => nameOf(ctx, id))
    return fail(F.xgUnapproved(names), { extraMembers: names }, unconfirmedEmergency(ctx, extra) ? 'members-only-emergency-unconfirmed' : undefined)
  },
}

const xgNoExtraAdmins: ValidationRule<GroupTarget> = {
  id: 'xg.noExtraAdmins',
  subject: 'exclusionGroup',
  severity: 'blocker',
  needs: ['groupMembers', 'roles'],
  evaluate: (entry, ctx) => {
    if (!entry) return groupUnknown()
    if (entry.directMembers !== 'complete') return unknown(UNKNOWN.needs([NEED_LABEL.groupMembers]))
    const bg = new Set(ctx.breakGlassIds)
    const admins = (entry.directMemberIds ?? []).filter((id) => !bg.has(id) && (ctx.snapshot.roles.active[id] ?? []).length > 0)
    if (admins.length === 0) return PASS
    const names = admins.map((id) => nameOf(ctx, id))
    return fail(F.xgAdmins(names), { name: names.join(', '), role: 'an administrator role' }, unconfirmedEmergency(ctx, admins) ? 'no-admin-members-unconfirmed' : undefined)
  },
}

/**
 * One check, three facts: an assigned security group with no licence. Each fact
 * carries its own fix line (checkFixes.ts ALTERNATE_FIXES); every failure used to
 * render "The group is dynamic; recreate it", so a licensed assigned group was
 * told it was dynamic (Phase 2 audit).
 */
const xgNotDynamic: ValidationRule<GroupTarget> = {
  id: 'xg.notDynamic',
  subject: 'exclusionGroup',
  severity: 'blocker',
  needs: ['groupMembers'],
  evaluate: (entry) => {
    if (!entry) return groupUnknown()
    if (entry.securityEnabled === undefined || entry.securityEnabled === null || !Array.isArray(entry.groupTypes) || !Array.isArray(entry.assignedLicenseSkuIds)) return unknown('The group type, security-enabled state, and license assignments were not fully read.')
    if (entry.securityEnabled !== true) return fail('The selected object is not a security-enabled group. Choose an assigned security group.', undefined, 'not-security-group')
    if (entry.membershipRule || entry.groupTypes.some(type => type.toLowerCase() === 'dynamicmembership')) return fail(F.xgDynamic(entry.membershipRule || 'DynamicMembership'))
    if (entry.assignedLicenseSkuIds.length) return fail(`The exclusions group has ${entry.assignedLicenseSkuIds.length} assigned license${entry.assignedLicenseSkuIds.length === 1 ? '' : 's'}. Review its license dependencies before using a different unlicensed assigned security group.`, undefined, 'group-licensed')
    return PASS
  },
}

const xgUsedConsistently: ValidationRule<GroupTarget> = {
  id: 'xg.usedConsistently',
  subject: 'exclusionGroup',
  severity: 'blocker',
  needs: ['caPolicies'],
  evaluate: (entry, ctx) => {
    if (!entry) return groupUnknown()
    // One rule for Step 2, its tile and Step 4 (validation/exclusionsGroupPolicies.ts):
    // every applicable policy, Report-only included, excludes the group.
    const needing = exclusionsGroupPolicies({ policies: ctx.tenantPolicies, groupId: entry.groupId, accountIds: ctx.breakGlassIds, activeRoles: ctx.snapshot.roles.active, membersOf: (id) => ctx.groupMembers.find((g) => g.groupId.toLowerCase() === id.toLowerCase()) })
    // Nothing to check is not the same as checked and correct. Over a tenant
    // with no Conditional Access policies this passed silently and the tile read
    // "Required references present", which is verification the scan never did.
    if (needing.length === 0) return pass(F.xgNoPoliciesYet)
    const missing = needing.filter((p) => p.outcome === 'fail').map((p) => p.name)
    if (missing.length > 0) return fail(F.xgInconsistent(needing.length - missing.length, needing.length), { policies: missing })
    const unverified = needing.filter((p) => p.outcome === 'unknown').map((p) => p.name)
    if (unverified.length > 0) return unknown(F.xgExclusionUnverified(unverified))
    return PASS
  },
}

const xgSizeReasonable: ValidationRule<GroupTarget> = {
  id: 'xg.sizeReasonable',
  subject: 'exclusionGroup',
  severity: 'warning',
  needs: ['groupMembers'],
  evaluate: (entry, ctx) => {
    if (!entry) return groupUnknown()
    if (entry.directMembers !== 'complete') return unknown(UNKNOWN.needs([NEED_LABEL.groupMembers]))
    const memberCount = entry.directMemberIds?.length ?? 0
    const allowed = Math.max(ctx.breakGlassIds.length, 1)
    return memberCount <= allowed
      ? pass(F.xgMembers(memberCount, false))
      : fail(F.xgSize(memberCount, ctx.breakGlassIds.length), { memberCount, emergencyCount: ctx.breakGlassIds.length })
  },
}

const xgNotMailEnabled: ValidationRule<GroupTarget> = {
  id: 'xg.notMailEnabled',
  subject: 'exclusionGroup',
  severity: 'warning',
  needs: ['groupMembers'],
  evaluate: (entry) => {
    if (!entry) return groupUnknown()
    if (typeof entry.mailEnabled !== 'boolean') return unknown('The group mail-enabled state was not fully read.')
    return entry.mailEnabled === true ? fail(F.xgMailEnabled) : PASS
  },
}

// ---- trusted named location ------------------------------------------------

type LocationTarget = { id?: string; displayName?: string; isTrusted?: boolean; ipRanges?: { cidrAddress?: string }[] } | null

function cidrs(loc: LocationTarget): string[] {
  return (loc?.ipRanges ?? []).map((r) => r.cidrAddress).filter((c): c is string => typeof c === 'string')
}

function cidrParts(cidr: string): { bits: 32 | 128; prefix: number } | null {
  const parts = cidr.split('/')
  if (parts.length !== 2 || !/^\d+$/.test(parts[1])) return null
  const address = parts[0], prefix = Number(parts[1])
  if (address.includes(':')) {
    try { new URL(`https://[${address}]/`) } catch { return null }
    return prefix <= 128 ? { bits: 128, prefix } : null
  }
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(address) || address.split('.').some(v => Number(v) > 255)) return null
  return prefix <= 32 ? { bits: 32, prefix } : null
}

const locNotWholeInternet: ValidationRule<LocationTarget> = {
  id: 'loc.notWholeInternet',
  subject: 'trustedLocation',
  severity: 'blocker',
  needs: ['namedLocations'],
  evaluate: (loc) => {
    if (!loc) return unknown(UNKNOWN.needs([NEED_LABEL.namedLocations]))
    const ranges = cidrs(loc)
    if (ranges.some(c => !cidrParts(c))) return unknown('A configured CIDR range is malformed; inspect the named location.')
    const bad = ranges.find(c => cidrParts(c)?.prefix === 0)
    return bad ? fail(F.locWholeInternet(bad)) : PASS
  },
}

const locNotTooWide: ValidationRule<LocationTarget> = {
  id: 'loc.notTooWide',
  subject: 'trustedLocation',
  severity: 'warning',
  needs: ['namedLocations'],
  evaluate: (loc) => {
    if (!loc) return unknown(UNKNOWN.needs([NEED_LABEL.namedLocations]))
    const wide = cidrs(loc).find((c) => {
      const range = cidrParts(c)
      return range !== null && range.prefix > 0 && range.prefix < (range.bits === 128 ? 48 : 16)
    })
    return wide ? fail(F.locTooWide(wide)) : PASS
  },
}

const locIsTrusted: ValidationRule<LocationTarget> = {
  id: 'loc.isTrusted',
  subject: 'trustedLocation',
  severity: 'blocker',
  needs: ['namedLocations'],
  evaluate: (loc) => {
    if (!loc) return unknown(UNKNOWN.needs([NEED_LABEL.namedLocations]))
    return loc.isTrusted === true ? PASS : fail(F.locNotTrusted)
  },
}

const locRedundancy: ValidationRule<LocationTarget> = {
  id: 'loc.redundancy',
  subject: 'trustedLocation',
  severity: 'warning',
  needs: ['namedLocations'],
  evaluate: (loc) => {
    if (!loc) return unknown(UNKNOWN.needs([NEED_LABEL.namedLocations]))
    const list = cidrs(loc)
    if (list.length !== 1) return PASS
    const range = cidrParts(list[0])
    if (!range) return unknown('The configured CIDR range could not be interpreted.')
    return range.prefix < range.bits ? PASS : fail(F.locSingle(list[0]))
  },
}

const locSeenInSignIns: ValidationRule<LocationTarget> = {
  id: 'loc.seenInSignIns',
  subject: 'trustedLocation',
  severity: 'warning',
  needs: ['namedLocations', 'signInEvidence'],
  evaluate: (loc, ctx) => {
    if (!loc) return unknown(UNKNOWN.needs([NEED_LABEL.namedLocations]))
    const matches = ctx.snapshot.scenarioEvidence?.trustedLocationMatches
    if (!matches || !loc.displayName) return unknown('Named-location match evidence was not collected for this location.')
    const sameName = (ctx.snapshot.config.namedLocations?.rows ?? []).filter(row => (row as { displayName?: string }).displayName === loc.displayName)
    if (sameName.length !== 1) return unknown('The location name is not unique, so sign-in matches cannot identify this location.')
    const count = matches.byLocation[loc.displayName] ?? 0
    return count > 0 ? pass(`${count} sign-ins matched ${loc.displayName} in the recorded window.`) : unknown('No sign-in in the recorded window names this location. Confirm its current office ranges with the network owner.')
  },
}

// ---- allowed countries -----------------------------------------------------

const ctyAtLeastOne: ValidationRule = {
  id: 'cty.atLeastOne',
  subject: 'allowedCountries',
  severity: 'blocker',
  needs: [],
  evaluate: (_t, ctx) => (ctx.allowedCountries.length > 0 ? PASS : fail(F.ctyNone)),
}

const ctyIncludesOperator: ValidationRule = {
  id: 'cty.includesOperator',
  subject: 'allowedCountries',
  severity: 'warning',
  needs: ['signInEvidence'],
  evaluate: (_t, ctx) => {
    // The admins' sign-in countries, never the signed-in account's alone: the
    // people who could lock themselves out of the portal, whoever ran the scan.
    const admins = Object.keys(ctx.snapshot.roles?.active ?? {})
    const seen = [...new Set(admins.flatMap((id) => ctx.snapshot.signInEvidence[id]?.countries ?? []))]
    // Read, and holding no administrator's country: the check ran and cannot
    // decide, which is not a source the scan failed to collect (R4-58).
    if (seen.length === 0) return unknown(UNKNOWN.signInsShowNo('administrator sign-in with a country'))
    const missing = seen.filter((c) => !ctx.allowedCountries.includes(c))
    // How many admins, not "admins": on a 51-admin tenant exactly one had
    // signed in from the country this names, and the plural read as a pattern
    // rather than one person. The reader who counts is the reader this sentence
    // is for.
    const who = admins.filter((id) => (ctx.snapshot.signInEvidence[id]?.countries ?? []).some((c) => missing.includes(c))).length
    return missing.length === 0 ? PASS : fail(F.ctyMissingOperator(missing, who))
  },
}

const ctyUnknownCountries: ValidationRule<LocationTarget & { includeUnknownCountriesAndRegions?: boolean }> = {
  id: 'cty.unknownCountries',
  subject: 'allowedCountries',
  severity: 'warning',
  needs: ['namedLocations'],
  evaluate: (loc, ctx) => {
    if (!loc) return fail(ctx.snapshot.config.namedLocations.rows.length === 0 ? 'No named locations were found. Create the Work Countries location.' : 'No named location matches Work Countries. Create or correct it.')
    return loc.includeUnknownCountriesAndRegions === true ? fail(F.ctyUnknown) : PASS
  },
}

const ctySeenCountriesIncluded: ValidationRule = {
  id: 'cty.seenCountriesIncluded',
  subject: 'allowedCountries',
  severity: 'warning',
  needs: ['signInEvidence'],
  evaluate: (_t, ctx) => {
    const byCountry = ctx.snapshot.evidenceAggregates?.byCountry ?? null
    if (byCountry === null) return unknown(UNKNOWN.signInsShowNo('sign-in counts by country'))
    const missing = Object.keys(byCountry).filter((c) => c && !ctx.allowedCountries.includes(c))
    return missing.length === 0 ? PASS : fail(F.ctySeenMissing(missing))
  },
}

// ---- pilot group -----------------------------------------------------------

const pilotHasMembers: ValidationRule<GroupTarget> = {
  id: 'pilot.hasMembers',
  subject: 'pilotGroup',
  severity: 'blocker',
  needs: ['groupMembers'],
  evaluate: (entry) => {
    if (!entry) return groupUnknown()
    return entry.memberCount > 0 ? PASS : fail(F.pilotEmpty)
  },
}

const pilotNoBreakGlass: ValidationRule<GroupTarget> = {
  id: 'pilot.noBreakGlass',
  subject: 'pilotGroup',
  severity: 'blocker',
  needs: ['groupMembers'],
  evaluate: (entry, ctx) => {
    if (!entry) return groupUnknown()
    const inside = entry.memberIds.filter((id) => ctx.breakGlassIds.includes(id))
    return inside.length === 0 ? PASS : fail(F.pilotBreakGlass(inside.map((id) => nameOf(ctx, id))))
  },
}

const pilotSpread: ValidationRule<GroupTarget> = {
  id: 'pilot.spread',
  subject: 'pilotGroup',
  severity: 'warning',
  needs: ['groupMembers', 'users'],
  evaluate: (entry, ctx) => {
    if (!entry) return groupUnknown()
    const depts = new Set(entry.memberIds.map((id) => userOf(ctx, id)?.department ?? '').filter(Boolean))
    const tenantDepartments = new Set(ctx.snapshot.users.filter(u => u.accountEnabled && u.userType === 'member').map(u => u.department).filter(Boolean))
    if (tenantDepartments.size <= 1 || depts.size !== 1) return PASS
    return fail(F.pilotOneDepartment([...depts][0]))
  },
}

const pilotHasAdmin: ValidationRule<GroupTarget> = {
  id: 'pilot.hasAdmin',
  subject: 'pilotGroup',
  severity: 'warning',
  needs: ['groupMembers', 'roles'],
  evaluate: (entry, ctx) => {
    if (!entry) return groupUnknown()
    const admins = entry.memberIds.filter((id) => (ctx.snapshot.roles.active[id] ?? []).length > 0)
    return admins.length > 0 ? PASS : fail(F.pilotNoAdmin)
  },
}

const pilotMembersReady: ValidationRule<GroupTarget> = {
  id: 'pilot.membersReady',
  subject: 'pilotGroup',
  severity: 'warning',
  needs: ['groupMembers', 'signInEvidence'],
  evaluate: (entry, ctx) => {
    if (!entry) return groupUnknown()
    const by = new Map(ctx.viability.map((v) => [v.userId, v]))
    if (by.size === 0) return unknown(UNKNOWN.needs([NEED_LABEL.signInEvidence]))
    const notReady = entry.memberIds.filter((id) => by.get(id)?.mfa !== 'verified')
    return notReady.length === 0 ? PASS : fail(F.pilotNotReady(notReady.map((id) => nameOf(ctx, id))))
  },
}

/** The method a passkey pilot needs, enabled and pointed at this group. */
function methodTargeted(ctx: ValidationContext, methodId: string, entry: GroupFacts): 'ok' | 'off' | 'untargeted' | 'unknown' {
  const policy = ctx.snapshot.config.authMethodsPolicy?.rows?.[0] as { authenticationMethodConfigurations?: { id?: string; state?: string; includeTargets?: { id?: string }[]; excludeTargets?: { id?: string }[] }[] } | undefined
  const c = policy?.authenticationMethodConfigurations?.find(x => x.id?.toLowerCase() === methodId.toLowerCase())
  if (!c || !['enabled', 'disabled'].includes(c.state ?? '')) return 'unknown'
  if (c.state !== 'enabled') return 'off'
  if (entry.sampled || entry.memberIds.length < entry.memberCount) return 'unknown'
  const target = (targets: { id?: string }[] | undefined, member: string): boolean | null => {
    if (!targets) return null
    let unread = false
    for (const t of targets) {
      if (t.id === 'all_users' || t.id === 'allUsers' || t.id === entry.groupId) return true
      const group = ctx.groupMembers.find(g => g.groupId === t.id)
      if (group?.memberIds.includes(member)) return true
      if (!group || group.sampled || group.memberIds.length < group.memberCount) unread = true
    }
    return unread ? null : false
  }
  let unread = false
  for (const member of entry.memberIds) {
    const included = target(c.includeTargets, member), excluded = target(c.excludeTargets, member)
    if (excluded === true || included === false) return 'untargeted'
    if (included === null || excluded === null) unread = true
  }
  return unread ? 'unknown' : 'ok'
}

const pilotPasskeyEnabled: ValidationRule<GroupTarget> = {
  id: 'pilot.passkeyEnabled',
  subject: 'pilotGroup',
  severity: 'warning',
  needs: ['authMethodsPolicy'],
  evaluate: (entry, ctx) => {
    if (!entry) return groupUnknown()
    const state = methodTargeted(ctx, 'Fido2', entry)
    if (state === 'unknown') return unknown('The effective passkey target membership was not fully read.')
    if (state === 'ok') {
      const groups = new Map(ctx.groupMembers.map(g => [g.groupId, g]))
      groups.set(entry.groupId, entry)
      const compatibility = emergencyPasskeyCompatibility(ctx.snapshot, entry.memberIds, groups)
      if (compatibility.some(c => c.state === 'unknown')) return unknown('Passkey profile or key-model evidence is incomplete for some pilot members.')
      const blocked = compatibility.filter(c => c.state !== 'eligible')
      return blocked.length ? fail(`Passkey registration or model compatibility needs review for ${blocked.map(c => nameOf(ctx, c.accountId)).join(', ')}.`) : PASS
    }
    return fail(state === 'off' ? F.pilotMethodOff('Passkeys and security keys') : F.pilotMethodUntargeted('Passkeys and security keys'))
  },
}

const pilotTapEnabled: ValidationRule<GroupTarget> = {
  id: 'pilot.tapEnabled',
  subject: 'pilotGroup',
  severity: 'warning',
  needs: ['authMethodsPolicy'],
  evaluate: (entry, ctx) => {
    if (!entry) return groupUnknown()
    const state = methodTargeted(ctx, 'TemporaryAccessPass', entry)
    if (state === 'unknown') return unknown('The effective Temporary Access Pass target membership was not fully read.')
    if (state === 'ok') return PASS
    return fail(state === 'off' ? F.pilotMethodOff('Temporary Access Pass') : F.pilotMethodUntargeted('Temporary Access Pass'))
  },
}

// ---- service accounts ------------------------------------------------------

const svcNoInteractive: ValidationRule = {
  id: 'svc.noInteractive',
  subject: 'serviceAccount',
  severity: 'warning',
  needs: ['signInEvidence'],
  evaluate: (_t, ctx) => {
    if (!sourceUsable(ctx, 'signInEvidence')) return unknown(UNKNOWN.needs([NEED_LABEL.signInEvidence]))
    const seen = ctx.serviceAccountIds.filter((id) => (ctx.snapshot.signInEvidence[id]?.signInCount ?? 0) > 0)
    return seen.length === 0 ? PASS : fail(F.svcInteractive(seen.map((id) => nameOf(ctx, id))))
  },
}

const svcNoAdminRole: ValidationRule = {
  id: 'svc.noAdminRole',
  subject: 'serviceAccount',
  severity: 'warning',
  needs: ['roles'],
  evaluate: (_t, ctx) => {
    const admins = ctx.serviceAccountIds.filter((id) => (ctx.snapshot.roles.active[id] ?? []).length > 0)
    return admins.length === 0 ? PASS : fail(F.svcAdmin(admins.map((id) => nameOf(ctx, id))))
  },
}

const svcExcludedFromBlocks: ValidationRule = {
  id: 'svc.excludedFromBlocks',
  subject: 'serviceAccount',
  severity: 'warning',
  needs: ['signInEvidence'],
  evaluate: (_t, ctx) => {
    const legacy = new Set(ctx.snapshot.evidenceUsage?.legacyAuth.userIds ?? [])
    if (legacy.size === 0) return PASS
    const caught = ctx.serviceAccountIds.filter((id) => legacy.has(id))
    return caught.length === 0 ? PASS : fail(F.svcUnexcluded(caught.map((id) => nameOf(ctx, id))))
  },
}

// ---- authentication strength ----------------------------------------------

type StrengthTarget = { tenant: { id?: string; allowedCombinations?: string[] } | null; baselineCombinations: string[] | null; population: string[] }

const strExists: ValidationRule<StrengthTarget> = {
  id: 'str.exists',
  subject: 'authStrength',
  severity: 'blocker',
  needs: ['authStrengths'],
  evaluate: (t) => (t.tenant && Array.isArray(t.tenant.allowedCombinations) ? PASS : fail(F.strMissing)),
}

const strAchievable: ValidationRule<StrengthTarget> = {
  id: 'str.achievable',
  subject: 'authStrength',
  severity: 'warning',
  needs: ['authStrengths', 'authMethods'],
  evaluate: (t, ctx) => {
    const combos = t.tenant?.allowedCombinations ?? []
    if (combos.length === 0) return unknown(UNKNOWN.needs([NEED_LABEL.authStrengths]))
    if (t.population.length === 0) return PASS
    if (!t.tenant?.id) return unknown('The authentication strength identity was not read.')
    const target = effectOf({ conditions: { users: { includeUsers: t.population }, applications: { includeApplications: ['All'] } }, grantControls: { operator: 'AND', authenticationStrength: { id: t.tenant.id } } })
    const readiness = methodPreparation([target], t.population, ctx.snapshot)
    if (!readiness.completeScope || readiness.unknownIds.length) return unknown('The scan could not establish a compatible registered method for every targeted person.')
    const missing = readiness.ids.filter(id => !readiness.readyIds.includes(id))
    return missing.length ? fail(`${missing.length} targeted people need a method accepted by this strength: ${missing.map(id => nameOf(ctx, id)).join(', ')}.`) : PASS
  },
}

const strMatchesBaseline: ValidationRule<StrengthTarget> = {
  id: 'str.matchesBaseline',
  subject: 'authStrength',
  severity: 'warning',
  needs: ['authStrengths'],
  evaluate: (t) => {
    const combos = t.tenant?.allowedCombinations
    if (!Array.isArray(combos)) return unknown(UNKNOWN.needs([NEED_LABEL.authStrengths]))
    if (t.baselineCombinations === null) return unknown(F.strNoBaselineCombos)
    const allowed = new Set(combos)
    const extra = combos.filter((c) => !t.baselineCombinations?.includes(c))
    const missing = t.baselineCombinations.filter((c) => !allowed.has(c))
    if (extra.length > 0) return fail(F.strExtra(extra))
    if (missing.length > 0) return fail(F.strMissingCombos(missing))
    return pass(F.strMatches)
  },
}

// ---- the registry ----------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
export const REGISTRY: ValidationRule<any>[] = [
  bgCount,
  bgPermanentGa,
  bgCloudOnly,
  bgInitialDomain,
  bgEnabled,
  bgExcluded,
  bgNotInDynamicScope,
  bgHasMfaMethod,
  bgSeparateDevices,
  bgNotPersonal,
  bgExcludedFromReportOnly,
  bgMicrosoftManaged,
  bgPhishingResistant,
  bgMethodDiversity,
  bgHardwareCredential,
  bgPerUserMfaOff,
  bgNoLicenceNeeded,
  bgDrilled,
  bgCredentialStorage,
  bgSignInMonitoring,
  bgNameIdentifiesPurpose,
  bgLastSignIn,
  bgSignInCountries,
  bgMfaSeen,
  xgContainsEmergency,
  xgMembersApproved,
  xgNoExtraAdmins,
  xgNotDynamic,
  xgUsedConsistently,
  xgSizeReasonable,
  xgNotMailEnabled,
  locNotWholeInternet,
  locNotTooWide,
  locIsTrusted,
  locRedundancy,
  locSeenInSignIns,
  ctyAtLeastOne,
  ctyIncludesOperator,
  ctyUnknownCountries,
  ctySeenCountriesIncluded,
  pilotHasMembers,
  pilotNoBreakGlass,
  pilotSpread,
  pilotHasAdmin,
  pilotMembersReady,
  pilotPasskeyEnabled,
  pilotTapEnabled,
  svcNoInteractive,
  svcNoAdminRole,
  svcExcludedFromBlocks,
  strExists,
  strAchievable,
  strMatchesBaseline,
]

export function rulesFor(subject: RuleSubject): ValidationRule<any>[] {
  return REGISTRY.filter((r) => r.subject === subject)
}

/**
 * Run every rule for a subject against one target. A rule whose data was not
 * collected reports `unknown` rather than passing; on a blocker that holds the
 * plan exactly as a failure does.
 */
export function evaluateSubject(subject: RuleSubject, target: unknown, ctx: ValidationContext): RuleResult[] {
  const out: RuleResult[] = []
  for (const rule of rulesFor(subject)) {
    const missing = missingNeeds(rule, ctx)
    const evaluated: RuleEval = missing.length > 0 ? { ...unknown(UNKNOWN.needs(missing)), notRead: true } : rule.evaluate(target, ctx)
    out.push({
      ...evaluated,
      id: rule.id,
      subject: rule.subject,
      severity: rule.severity,
      target: typeof target === 'string' ? target : ((target as { groupId?: string; id?: string } | null)?.groupId ?? (target as { id?: string } | null)?.id ?? null),
    })
  }
  return out
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** A result that holds the plan: a failed blocker, or a blocker that could not be run. */
export function isBlocking(r: RuleResult): boolean {
  return r.severity === 'blocker' && (r.outcome === 'fail' || r.outcome === 'unknown')
}

/** Everything worth showing: failures and unknowns, plus notes that carry a fact. */
export function shown(results: RuleResult[]): RuleResult[] {
  return results.filter((r) => (r.outcome !== 'pass' && r.finding) || (r.severity === 'note' && r.finding) || (r.outcome === 'pass' && r.finding))
}

export type SubjectVerdict = {
  subject: RuleSubject
  blocking: RuleResult[]
  warnings: RuleResult[]
  notes: RuleResult[]
}

/** Group one subject's results the way Setup and the plan both show them. */
export function verdict(subject: RuleSubject, results: RuleResult[]): SubjectVerdict {
  return {
    subject,
    blocking: results.filter(isBlocking),
    warnings: results.filter((r) => r.severity === 'warning' && (r.outcome === 'fail' || r.outcome === 'unknown') && r.finding),
    notes: results.filter((r) => r.severity === 'note' && r.finding).concat(results.filter((r) => r.severity !== 'note' && r.outcome === 'pass' && r.finding)),
  }
}
