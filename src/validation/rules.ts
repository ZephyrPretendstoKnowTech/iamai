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
import { FINDING as F, NEED_LABEL, RULE_CITATION, RULE_TEXT, UNKNOWN } from '../copy/validation.ts'
import type { Citation } from '../copy/validation.ts'
import { absoluteDate, relative } from '../copy/dates.ts'
import { BREAK_GLASS_DRILL_DAYS } from '../roadmap/constants.ts'
import { isRecordedDrill } from '../roadmap/cleanupDone.ts'

// ---- the model -------------------------------------------------------------

/** What a group rule needs to know; a cache entry satisfies it structurally. */
export type GroupFacts = {
  groupId: string
  displayName?: string | null
  membershipRule?: string | null
  mailEnabled?: boolean
  memberIds: string[]
  memberCount: number
  sampled: boolean
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
  /** Conditional Access policies as collected; empty when the section was refused. */
  tenantPolicies: unknown[]
  groupMembers: GroupFacts[]
  breakGlassIds: string[]
  operatorUserId: string | null
  allowedCountries: string[]
  serviceAccountIds: string[]
  approvedExclusionIds: string[]
  viability: MfaViability[]
  /** The two facts no tenant exposes, answered once in Setup. */
  answers: { credentialStorage: boolean | null; signInMonitoring: boolean | null }
  /** Every emergency access drill the plan recorded (the Cleanup drill row's Done): a sign-in on one of these days is the drill. */
  drillDates: string[]
}

export type ValidationRule<S = string> = {
  id: string
  subject: RuleSubject
  severity: RuleSeverity
  needs: NeedKey[]
  evaluate: (target: S, ctx: ValidationContext) => RuleEval
}

export function ruleText(id: string): { what: string; why: string } {
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
      : true // groupMembers and answers: the rule decides for itself
    if (!ok) out.push(NEED_LABEL[need] ?? need)
  }
  return out
}

const PASS: RuleEval = { outcome: 'pass', finding: null }
const fail = (finding: string, values?: Record<string, unknown>): RuleEval => ({ outcome: 'fail', finding, values })
const unknown = (finding: string): RuleEval => ({ outcome: 'unknown', finding })
const pass = (finding: string | null = null): RuleEval => ({ outcome: 'pass', finding })

// ---- shared facts ----------------------------------------------------------

export const GLOBAL_ADMIN_ROLE = '62e90394-69f5-4237-9190-012177145e10'
const PHISHING_RESISTANT = new Set(['fido2', 'passkey', 'windowsHelloForBusiness'])
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

function nameOf(ctx: ValidationContext, id: string): string {
  const u = userOf(ctx, id)
  return u?.displayName ?? u?.userPrincipalName ?? id
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
  const flagged = domains.find((d) => d.isInitial === true)?.name
  if (typeof flagged === 'string') return flagged
  const byShape = domains.find((d) => typeof d.name === 'string' && /\.onmicrosoft\.com$/i.test(d.name))?.name
  return typeof byShape === 'string' ? byShape : null
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
    const active = ctx.snapshot.roles.active[id] ?? []
    const eligible = ctx.snapshot.roles.eligible[id] ?? []
    if (active.some((r) => r.toLowerCase() === GLOBAL_ADMIN_ROLE)) return PASS
    if (eligible.some((r) => r.toLowerCase() === GLOBAL_ADMIN_ROLE)) return fail(F.bgEligibleOnly)
    return fail(F.bgNoGa)
  },
}

const bgCloudOnly: ValidationRule = {
  id: 'bg.cloudOnly',
  subject: 'breakGlass',
  severity: 'blocker',
  needs: ['users'],
  evaluate: (id, ctx) => (userOf(ctx, id)?.onPremisesSyncEnabled === true ? fail(F.bgSynced) : PASS),
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
  evaluate: (id, ctx) => (userOf(ctx, id)?.accountEnabled === false ? fail(F.bgDisabled) : PASS),
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

const bgSeparateDevices: ValidationRule = {
  id: 'bg.separateDevices',
  subject: 'breakGlass',
  severity: 'blocker',
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
        const who = ctx.snapshot.users.filter((u) => u.id === otherId).map((u) => u.displayName ?? u.userPrincipalName ?? otherId)
        return fail(F.bgSharedDevice(m.displayName, who.length > 0 ? who : [otherId]), { device: m.displayName, otherAccount: who[0] ?? otherId })
      }
    }
    return PASS
  },
}

const bgNotPersonal: ValidationRule = {
  id: 'bg.notPersonal',
  subject: 'breakGlass',
  severity: 'blocker',
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
    if (kinds.some((k) => PHISHING_RESISTANT.has(k))) return PASS
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
    return lists.every((k) => k[0] === only) ? fail(F.bgSameMethodType(only), { method: only }) : PASS
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
  needs: ['users'],
  evaluate: (id, ctx) => {
    const u = userOf(ctx, id)
    if (!u) return unknown(UNKNOWN.needs([NEED_LABEL.users]))
    if (u.lastSuccessfulSignIn === null) return fail(F.bgNeverSignedIn)
    const days = Math.floor((Date.parse(ctx.snapshot.asOf) - Date.parse(u.lastSuccessfulSignIn)) / 86_400_000)
    return days > BREAK_GLASS_DRILL_DAYS
      ? fail(F.bgDrillDue(absoluteDate(u.lastSuccessfulSignIn), BREAK_GLASS_DRILL_DAYS))
      : pass(F.bgDrilled(absoluteDate(u.lastSuccessfulSignIn), BREAK_GLASS_DRILL_DAYS))
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
  evaluate: (_id, ctx) => (ctx.answers.credentialStorage === true ? PASS : fail(F.bgCredentialStorage)),
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
  needs: ['users'],
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
    if (isRecordedDrill(at, ctx.drillDates)) return pass(F.bgLastSignInDrill(absoluteDate(at)))
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

const xgMembersApproved: ValidationRule<GroupTarget> = {
  id: 'xg.membersApproved',
  subject: 'exclusionGroup',
  severity: 'blocker',
  needs: ['groupMembers'],
  evaluate: (entry, ctx) => {
    if (!entry) return groupUnknown()
    if (entry.sampled) return unknown(UNKNOWN.needs([NEED_LABEL.groupMembers]))
    const approved = new Set([...ctx.breakGlassIds, ...ctx.approvedExclusionIds])
    const extra = entry.memberIds.filter((id) => !approved.has(id))
    return extra.length === 0 ? PASS : fail(F.xgUnapproved(extra.map((id) => nameOf(ctx, id))), { extraMembers: extra.map((id) => nameOf(ctx, id)) })
  },
}

const xgNoExtraAdmins: ValidationRule<GroupTarget> = {
  id: 'xg.noExtraAdmins',
  subject: 'exclusionGroup',
  severity: 'blocker',
  needs: ['groupMembers', 'roles'],
  evaluate: (entry, ctx) => {
    if (!entry) return groupUnknown()
    const bg = new Set(ctx.breakGlassIds)
    const admins = entry.memberIds.filter((id) => !bg.has(id) && (ctx.snapshot.roles.active[id] ?? []).length > 0)
    return admins.length === 0 ? PASS : fail(F.xgAdmins(admins.map((id) => nameOf(ctx, id))), { name: admins.map((id) => nameOf(ctx, id)).join(', '), role: 'an administrator role' })
  },
}

const xgNotDynamic: ValidationRule<GroupTarget> = {
  id: 'xg.notDynamic',
  subject: 'exclusionGroup',
  severity: 'blocker',
  needs: ['groupMembers'],
  evaluate: (entry) => {
    if (!entry) return groupUnknown()
    return !entry.membershipRule ? PASS : fail(F.xgDynamic(entry.membershipRule))
  },
}

const xgUsedConsistently: ValidationRule<GroupTarget> = {
  id: 'xg.usedConsistently',
  subject: 'exclusionGroup',
  severity: 'blocker',
  needs: ['caPolicies'],
  evaluate: (entry, ctx) => {
    if (!entry) return groupUnknown()
    // Every enabled or report-only policy: a report-only one becomes enforcing
    // without a second look at its exclusions.
    const live = livePolicies(ctx)
    if (live.length === 0) return PASS
    const excludes = (p: (typeof live)[number]): boolean => (p.conditions?.users?.excludeGroups ?? []).some((g) => g.toLowerCase() === entry.groupId.toLowerCase())
    const missing = live.filter((p) => !excludes(p))
    if (missing.length === 0) return PASS
    return fail(F.xgInconsistent(live.length - missing.length, live.length), { policies: missing.map((p) => p.displayName ?? '(unnamed)') })
  },
}

const xgSizeReasonable: ValidationRule<GroupTarget> = {
  id: 'xg.sizeReasonable',
  subject: 'exclusionGroup',
  severity: 'warning',
  needs: ['groupMembers'],
  evaluate: (entry, ctx) => {
    if (!entry) return groupUnknown()
    const allowed = Math.max(ctx.breakGlassIds.length, 1)
    return entry.memberCount <= allowed
      ? pass(F.xgMembers(entry.memberCount, entry.sampled))
      : fail(F.xgSize(entry.memberCount, ctx.breakGlassIds.length), { memberCount: entry.memberCount, emergencyCount: ctx.breakGlassIds.length })
  },
}

const xgNotMailEnabled: ValidationRule<GroupTarget> = {
  id: 'xg.notMailEnabled',
  subject: 'exclusionGroup',
  severity: 'warning',
  needs: ['groupMembers'],
  evaluate: (entry) => {
    if (!entry) return groupUnknown()
    return entry.mailEnabled === true ? fail(F.xgMailEnabled) : PASS
  },
}

// ---- trusted named location ------------------------------------------------

type LocationTarget = { id?: string; displayName?: string; isTrusted?: boolean; ipRanges?: { cidrAddress?: string }[] } | null

function cidrs(loc: LocationTarget): string[] {
  return (loc?.ipRanges ?? []).map((r) => r.cidrAddress).filter((c): c is string => typeof c === 'string')
}

const locNotWholeInternet: ValidationRule<LocationTarget> = {
  id: 'loc.notWholeInternet',
  subject: 'trustedLocation',
  severity: 'blocker',
  needs: ['namedLocations'],
  evaluate: (loc) => {
    if (!loc) return unknown(UNKNOWN.needs([NEED_LABEL.namedLocations]))
    const bad = cidrs(loc).find((c) => c === '0.0.0.0/0' || c === '::/0')
    return bad ? fail(F.locWholeInternet(bad)) : PASS
  },
}

const locNotTooWide: ValidationRule<LocationTarget> = {
  id: 'loc.notTooWide',
  subject: 'trustedLocation',
  severity: 'blocker',
  needs: ['namedLocations'],
  evaluate: (loc) => {
    if (!loc) return unknown(UNKNOWN.needs([NEED_LABEL.namedLocations]))
    const wide = cidrs(loc).find((c) => {
      if (c === '0.0.0.0/0' || c === '::/0') return false
      const prefix = Number(c.split('/')[1])
      return Number.isFinite(prefix) && prefix < 16
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
    const prefix = Number(list[0].split('/')[1])
    return list[0].includes('/') && Number.isFinite(prefix) && prefix < 32 ? PASS : fail(F.locSingle(list[0]))
  },
}

const locSeenInSignIns: ValidationRule<LocationTarget> = {
  id: 'loc.seenInSignIns',
  subject: 'trustedLocation',
  severity: 'warning',
  needs: ['namedLocations', 'signInEvidence'],
  evaluate: (loc, ctx) => {
    if (!loc) return unknown(UNKNOWN.needs([NEED_LABEL.namedLocations]))
    // IAMAI keeps no addresses from sign-in records, by design: what it can say
    // is whether the window holds sign-ins at all to compare against.
    const total = ctx.snapshot.evidenceAggregates?.total ?? 0
    if (total === 0) return unknown(UNKNOWN.needs([NEED_LABEL.signInEvidence]))
    return pass()
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
  severity: 'blocker',
  needs: ['signInEvidence'],
  evaluate: (_t, ctx) => {
    if (ctx.operatorUserId === null) return unknown(UNKNOWN.needs([NEED_LABEL.users]))
    const seen = ctx.snapshot.signInEvidence[ctx.operatorUserId]?.countries ?? []
    if (seen.length === 0) return unknown(UNKNOWN.needs([NEED_LABEL.signInEvidence]))
    const missing = seen.filter((c) => !ctx.allowedCountries.includes(c))
    return missing.length === 0 ? PASS : fail(F.ctyMissingOperator(missing))
  },
}

const ctyUnknownCountries: ValidationRule<LocationTarget & { includeUnknownCountriesAndRegions?: boolean }> = {
  id: 'cty.unknownCountries',
  subject: 'allowedCountries',
  severity: 'warning',
  needs: ['namedLocations'],
  evaluate: (loc) => {
    if (!loc) return unknown(UNKNOWN.needs([NEED_LABEL.namedLocations]))
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
    if (byCountry === null) return unknown(UNKNOWN.needs([NEED_LABEL.signInEvidence]))
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
    if (depts.size !== 1) return PASS
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
function methodTargeted(ctx: ValidationContext, methodId: string, groupId: string): 'ok' | 'off' | 'untargeted' {
  const policy = (ctx.snapshot.config.authMethodsPolicy?.rows?.[0] ?? null) as
    | { authenticationMethodConfigurations?: { id?: string; state?: string; includeTargets?: { id?: string }[] }[] }
    | null
  const c = (policy?.authenticationMethodConfigurations ?? []).find((x) => x.id?.toLowerCase() === methodId.toLowerCase())
  if (!c || c.state !== 'enabled') return 'off'
  return (c.includeTargets ?? []).some((t) => t.id === groupId || t.id === 'all_users') ? 'ok' : 'untargeted'
}

const pilotPasskeyEnabled: ValidationRule<GroupTarget> = {
  id: 'pilot.passkeyEnabled',
  subject: 'pilotGroup',
  severity: 'warning',
  needs: ['authMethodsPolicy'],
  evaluate: (entry, ctx) => {
    if (!entry) return groupUnknown()
    const state = methodTargeted(ctx, 'Fido2', entry.groupId)
    if (state === 'ok') return PASS
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
    const state = methodTargeted(ctx, 'TemporaryAccessPass', entry.groupId)
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
  severity: 'blocker',
  needs: ['authStrengths', 'authMethods'],
  evaluate: (t, ctx) => {
    const combos = t.tenant?.allowedCombinations ?? []
    if (combos.length === 0) return unknown(UNKNOWN.needs([NEED_LABEL.authStrengths]))
    if (t.population.length === 0) return PASS
    const wantsPhishingResistant = combos.every((c) => /fido2|windowsHelloForBusiness|x509/i.test(c))
    if (!wantsPhishingResistant) return PASS
    const by = new Map(ctx.viability.map((v) => [v.userId, v]))
    if (by.size === 0) return unknown(UNKNOWN.needs([NEED_LABEL.authMethods]))
    const anyone = t.population.some((id) => (by.get(id)?.methodTiers ?? []).includes('phishingResistant'))
    return anyone ? PASS : fail(F.strUnachievable(combos))
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
  bgPerUserMfaOff,
  bgNoLicenceNeeded,
  bgDrilled,
  bgCredentialStorage,
  bgSignInMonitoring,
  bgNameIdentifiesPurpose,
  bgLastSignIn,
  bgSignInCountries,
  bgMfaSeen,
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
    const evaluated: RuleEval = missing.length > 0 ? unknown(UNKNOWN.needs(missing)) : rule.evaluate(target, ctx)
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
