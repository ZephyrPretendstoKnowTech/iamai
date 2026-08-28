// Validation of mapping picks (prompt 06 item 3; SPEC §3.3). Pure and
// Node-testable — every rule takes plain data and returns plain findings.
import type { AuthMethodSummary } from '../scoring/mfaViability.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { GroupMembersCacheEntry } from '../graph/collect/cache.ts'
import type { ValidationAction, ValidationResult } from './types.ts'
import { absoluteDate } from '../copy/dates.ts'
import { VALIDATION_ACTION as A } from '../copy/setup.ts'

const GLOBAL_ADMIN = '62e90394-69f5-4237-9190-012177145e10'
const PHISHING_RESISTANT_KINDS = new Set(['fido2', 'passkey', 'windowsHelloForBusiness'])

const result = (findings: string[], hardFails: number, actions: (ValidationAction | null)[] = []): ValidationResult => ({
  checkedAt: new Date().toISOString(),
  passed: hardFails === 0,
  findings,
  actions: findings.map((_, i) => actions[i] ?? null),
  toFix: hardFails,
})

export type BreakGlassContext = {
  snapshot: TenantSnapshot
  tenantPolicies: unknown[]
  groupMembers: GroupMembersCacheEntry[]
  /** All confirmed break-glass user ids including this one. */
  confirmedBreakGlassIds: string[]
}

export function validateBreakGlass(userId: string, ctx: BreakGlassContext): ValidationResult {
  const findings: string[] = []
  const actions: (ValidationAction | null)[] = []
  let hard = 0
  const fail = (msg: string, action: ValidationAction | null = null): void => {
    findings.push(msg)
    actions.push(action)
    hard += 1
  }
  const note = (msg: string, action: ValidationAction | null = null): void => {
    findings.push(msg)
    actions.push(action)
  }

  const user = ctx.snapshot.users.find((u) => u.id === userId)
  if (!user) return result(['account not found in the tenant'], 1)
  const userPortal = A.userMethods(userId)

  if (user.onPremisesSyncEnabled === true) fail('not cloud-only: the account syncs from on-premises', A.pickAnother)
  if (user.accountEnabled === false) fail('the account is disabled', A.userProfile(userId))

  const active = ctx.snapshot.roles.active[userId] ?? []
  const eligible = ctx.snapshot.roles.eligible[userId] ?? []
  const isActiveGA = active.some((r) => r.toLowerCase() === GLOBAL_ADMIN)
  const isEligibleGA = eligible.some((r) => r.toLowerCase() === GLOBAL_ADMIN)
  if (!isActiveGA) {
    if (isEligibleGA) fail('Global Administrator is eligible-only — break-glass must hold it permanently active', A.roles)
    else fail('not a Global Administrator', A.roles)
  }

  // Excluded from every policy, incl. report-only and Microsoft-managed.
  // Groups whose membership was never read cannot prove either way: they are
  // reported as unverified, never as a hard fail.
  const known = new Set(ctx.groupMembers.map((g) => g.groupId))
  const excludedGroups = new Set<string>()
  for (const g of ctx.groupMembers) if (g.memberIds.includes(userId)) excludedGroups.add(g.groupId)
  const notExcludedFrom: string[] = []
  const unverified: string[] = []
  for (const raw of ctx.tenantPolicies) {
    const p = raw as {
      displayName?: string
      state?: string
      conditions?: { users?: { excludeUsers?: string[]; excludeGroups?: string[] } }
    }
    if (p.state === 'disabled') continue
    const groups = p.conditions?.users?.excludeGroups ?? []
    const direct = (p.conditions?.users?.excludeUsers ?? []).includes(userId)
    const viaGroup = groups.some((g) => excludedGroups.has(g))
    if (direct || viaGroup) continue
    if (groups.some((g) => !known.has(g))) unverified.push(p.displayName ?? '(unnamed)')
    else notExcludedFrom.push(p.displayName ?? '(unnamed)')
  }
  if (notExcludedFrom.length > 0) {
    fail(`not excluded from every policy — missing from: ${notExcludedFrom.join(', ')}`, A.policies)
  }
  if (unverified.length > 0) {
    note(`exclusion could not be verified for: ${unverified.join(', ')} (excluded groups not read)`, A.policies)
  }

  // Methods: MFA-capable, phishing-resistant preferred, SMS-only flagged.
  const methods = ctx.snapshot.authMethods[userId]
  if (methods === undefined || methods === 'unknown') {
    note('registered methods could not be read for this account', userPortal)
  } else {
    const kinds = new Set(methods.map((m) => m.kind))
    const mfaKinds = [...kinds].filter((k) => k !== 'password' && k !== 'email' && k !== 'other')
    if (mfaKinds.length === 0) fail('no MFA-capable method registered', userPortal)
    else if ([...kinds].some((k) => PHISHING_RESISTANT_KINDS.has(k))) {
      note('phishing-resistant method registered')
    } else if (mfaKinds.every((k) => k === 'phone')) {
      fail('text or call is the only MFA method: register a FIDO2 key', userPortal)
    } else {
      note('no phishing-resistant method — a FIDO2 key is preferred for break-glass', userPortal)
    }
    // Shared-device check (SPEC §3.3): Authenticator displayName matching
    // another user's device.
    const myNames = new Set(
      methods.filter((m) => m.kind === 'microsoftAuthenticator' && m.displayName).map((m) => m.displayName),
    )
    // Every account with the same device name is listed (ux-review-03 §A6):
    // the name is a model code, so this is medium confidence.
    if (myNames.size > 0) {
      const matches = new Map<string, string[]>()
      for (const [otherId, otherMethods] of Object.entries(ctx.snapshot.authMethods)) {
        if (otherId === userId || otherMethods === 'unknown') continue
        for (const m of otherMethods as AuthMethodSummary[]) {
          if (m.kind !== 'microsoftAuthenticator' || !m.displayName || !myNames.has(m.displayName)) continue
          const other = ctx.snapshot.users.find((u) => u.id === otherId)
          const list = matches.get(m.displayName) ?? []
          const who = other?.displayName ?? other?.userPrincipalName ?? 'another account'
          if (!list.includes(who)) list.push(who)
          matches.set(m.displayName, list)
        }
      }
      for (const [device, who] of matches) {
        fail(
          `Authenticator device "${device}" is also registered by ${who.join(', ')}: same device name, likely the same phone (shared-device risk)`,
          userPortal,
        )
      }
    }
  }

  if (user.lastSuccessfulSignIn !== null) {
    note(`last successful sign-in ${absoluteDate(user.lastSuccessfulSignIn)}`, A.drill)
  } else {
    note('never signed in — schedule a break-glass drill', A.drill)
  }

  // Dynamic-group sweep: any known dynamic group whose members include it.
  const dynamicHit = ctx.groupMembers.find(
    (g) => g.membershipRule !== null && g.memberIds.includes(userId),
  )
  if (dynamicHit) {
    fail(
      `swept into dynamic group ${dynamicHit.displayName ?? dynamicHit.groupId} (rule: ${dynamicHit.membershipRule}) — dynamic membership can silently change policy scope`,
      A.group(dynamicHit.groupId),
    )
  }

  if (ctx.confirmedBreakGlassIds.length < 2) {
    fail('fewer than two break-glass accounts — at least two are required', A.pickAnother)
  }

  return result(findings, hard, actions)
}

export function validateExclusionGroup(
  entry: GroupMembersCacheEntry | null,
  ctx: { snapshot: TenantSnapshot; tenantPolicies: unknown[] },
): ValidationResult {
  if (!entry) return result(['group members could not be read'], 1)
  const findings: string[] = []
  const actions: (ValidationAction | null)[] = []
  let hard = 0
  const push = (msg: string, action: ValidationAction | null, isFail = false): void => {
    findings.push(msg)
    actions.push(action)
    if (isFail) hard += 1
  }
  push(`${entry.memberCount} member${entry.memberCount === 1 ? '' : 's'}${entry.sampled ? ' (estimated)' : ''}`, A.group(entry.groupId))
  const adminIds = entry.memberIds.filter((id) => (ctx.snapshot.roles.active[id] ?? []).length > 0)
  if (adminIds.length > 0) {
    push(`${adminIds.length} member(s) hold active admin roles — exclusion removes their protection`, A.group(entry.groupId))
  }
  if (entry.membershipRule !== null) {
    push(`dynamic membership rule: ${entry.membershipRule} — membership can change without review`, A.group(entry.groupId), true)
  }
  let excludedFrom = 0
  let enabledCount = 0
  for (const raw of ctx.tenantPolicies) {
    const p = raw as { state?: string; conditions?: { users?: { excludeGroups?: string[] } } }
    if (p.state === 'disabled') continue
    enabledCount += 1
    if ((p.conditions?.users?.excludeGroups ?? []).includes(entry.groupId)) excludedFrom += 1
  }
  if (enabledCount > 0 && excludedFrom > 0 && excludedFrom < enabledCount) {
    push(`excluded from ${excludedFrom} of ${enabledCount} enabled policies — inconsistent use`, A.roadmap)
  }
  return result(findings, hard, actions)
}

export function validateTrustedLocation(raw: unknown): ValidationResult {
  const l = raw as { id?: string; isTrusted?: boolean; ipRanges?: { cidrAddress?: string }[] }
  const findings: string[] = []
  const actions: (ValidationAction | null)[] = []
  let hard = 0
  const fail = (msg: string): void => {
    findings.push(msg)
    actions.push(A.namedLocations)
    hard += 1
  }
  if (l.isTrusted !== true) fail('not marked as trusted (isTrusted is unset)')
  for (const range of l.ipRanges ?? []) {
    const cidr = range.cidrAddress
    if (typeof cidr !== 'string') continue
    if (cidr === '0.0.0.0/0' || cidr === '::/0') {
      fail(`${cidr} trusts the entire internet`)
      continue
    }
    const prefix = Number(cidr.split('/')[1])
    if (Number.isFinite(prefix) && prefix < 16) fail(`${cidr} is wider than /16 — too broad for a trusted location`)
  }
  return result(findings, hard, actions)
}

export function validateStrength(
  tenantStrength: { allowedCombinations?: string[] } | null,
  baselineCombinations: string[] | null,
): ValidationResult {
  const findings: string[] = []
  let hard = 0
  if (!tenantStrength || !Array.isArray(tenantStrength.allowedCombinations)) {
    findings.push('strength not found in the tenant')
    return result(findings, 1)
  }
  findings.push(`allows: ${tenantStrength.allowedCombinations.join('; ')}`)
  if (baselineCombinations === null) {
    findings.push(
      "the baseline's strength ships without allowedCombinations — compare with the built-in strengths and pick the closest",
    )
  } else {
    const a = new Set(tenantStrength.allowedCombinations)
    const missing = baselineCombinations.filter((c) => !a.has(c))
    const extra = tenantStrength.allowedCombinations.filter((c) => !baselineCombinations.includes(c))
    if (missing.length === 0 && extra.length === 0) findings.push('identical to the baseline strength')
    else {
      if (extra.length > 0) {
        findings.push(`allows combinations the baseline does not: ${extra.join('; ')}`)
        hard += 1
      }
      if (missing.length > 0) findings.push(`missing combinations the baseline allows: ${missing.join('; ')}`)
    }
  }
  return result(findings, hard)
}

// Azure Credential Configuration Endpoint — needed for FIDO2 provisioning.
const ACCE_NAME = /credential configuration/i

export function validatePasskeyPilot(
  groupId: string,
  authMethodsPolicy: unknown,
  spSignals: { appDisplayName?: string }[],
): ValidationResult {
  const findings: string[] = []
  let hard = 0
  const policy = authMethodsPolicy as {
    authenticationMethodConfigurations?: {
      id?: string
      state?: string
      includeTargets?: { id?: string }[]
    }[]
  } | null
  const configs = policy?.authenticationMethodConfigurations ?? []
  const check = (id: string, label: string): void => {
    const c = configs.find((x) => x.id?.toLowerCase() === id.toLowerCase())
    if (!c || c.state !== 'enabled') {
      findings.push(`${label} is not enabled in the authentication methods policy`)
      hard += 1
      return
    }
    const targets = c.includeTargets ?? []
    const targeted = targets.some((t) => t.id === groupId || t.id === 'all_users')
    if (!targeted) {
      findings.push(`${label} is enabled but not targeted to this group`)
      hard += 1
    }
  }
  check('Fido2', 'FIDO2/passkey')
  check('TemporaryAccessPass', 'Temporary Access Pass')
  if (!spSignals.some((s) => typeof s.appDisplayName === 'string' && ACCE_NAME.test(s.appDisplayName))) {
    findings.push(
      'Azure Credential Configuration Endpoint service principal not observed — could not verify (no service principal inventory is collected)',
    )
  }
  return result(findings, hard)
}
