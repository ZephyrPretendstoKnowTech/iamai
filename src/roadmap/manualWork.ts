import { adminUserIds } from '../roles.ts'
import { emergencyPasskeyCompatibility } from './passkeyCompatibility.ts'
import type { GroupMembers } from '../coverage/population.ts'
import { GLOBAL_ADMIN_ROLE_ID } from './ladder.ts'
import { latestRecoveryTest, recoveryAccountBasis } from './cleanupDone.ts'
import type { CleanupCheckpoint } from './cleanupDone.ts'
import { BREAK_GLASS_DRILL_DAYS } from './constants.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { OwnerConfirmation, ManualEvidenceField } from './decisions.ts'
import { setState } from './lifecycle.ts'
import type { Step } from './types.ts'
import type { MappingState } from '../mapping/types.ts'
import { CARVE_OUT_STEP_ID, QUESTION_STEP, answerOf, mailDevicesOf } from './answers.ts'

export const MANUAL_REVIEW_ID = 'manual-review'
const REVIEWS = new Set(['break-glass-accounts', 'legacy-auth-inventory', 'app-passwords', 'guest-review', 'stale-accounts', 'admin-accounts-separate', 'global-admin-count', 'authenticator-over-sms', 'per-user-mfa-cleanup', 'phone-access-restriction'])
const SCAN_REQUIRED = new Set(['break-glass-accounts', 'admin-accounts-separate', 'global-admin-count', 'authenticator-over-sms'])
const FOLLOW_UPS = new Set<string>(Object.values(CARVE_OUT_STEP_ID))

function relevantPolicies(step: Step, snapshot: TenantSnapshot): unknown[] {
  const matched = new Set([...(step.tracking?.members.map(m => m.policyId).filter((id): id is string => !!id) ?? []), ...(step.satisfiedBy?.policies ?? [])])
  return (snapshot.config.caPolicies?.rows ?? []).filter(raw => {
    const p = raw as Record<string, any>
    const c = p.conditions ?? {}
    if (POLICY_WORKFLOWS[step.id]) return matched.has(String(p.id))
    const selected = step.population.ids
    const targets = c.users ?? {}
    const available = selected.filter(id => !(targets.excludeUsers ?? []).includes(id))
    const potentiallyTargeted = selected.length === 0 || available.length > 0 && ((targets.includeUsers ?? []).includes('All') || (targets.includeUsers ?? []).some((id: string) => available.includes(id)) || (targets.includeGroups ?? []).length > 0 || !!targets.includeGuestsOrExternalUsers || (targets.includeRoles ?? []).some((role: string) => available.some(id => (snapshot.roles.active[id] ?? []).includes(role))))
    if (step.id === CARVE_OUT_STEP_ID.mailDevices) return potentiallyTargeted && (c.clientAppTypes ?? []).some((x: string) => ['exchangeActiveSync', 'other'].includes(x))
    if (step.id === CARVE_OUT_STEP_ID.partner) return potentiallyTargeted && (!!c.users?.includeGuestsOrExternalUsers || !!c.users?.excludeGuestsOrExternalUsers || !!c.locations || (c.users?.includeUsers ?? []).includes('All'))
    if (step.id === CARVE_OUT_STEP_ID.travel) return !!c.locations
    if (step.id === 's-shared-devices') {
      const users = c.users ?? {}
      const remaining = step.population.ids.filter(id => !(users.excludeUsers ?? []).includes(id))
      return remaining.length > 0 && ((users.includeUsers ?? []).includes('All') || (users.includeUsers ?? []).some((id: string) => remaining.includes(id)) || (users.includeGroups ?? []).length > 0 || (users.includeRoles ?? []).some((role: string) => remaining.some(id => (snapshot.roles.active[id] ?? []).includes(role))))
    }
    if (step.id === 's-ladder-phone-access-restriction') return (c.platforms?.includePlatforms ?? []).some((x: string) => ['android', 'iOS'].includes(x)) && (p.grantControls?.builtInControls ?? []).includes('block')
    return false
  }).map(raw => { const p = raw as Record<string, unknown>; return [p.id, p.state, p.conditions, p.grantControls, p.sessionControls] }).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
}

const POLICY_WORKFLOWS: Record<string, string> = {
  's-goal-register-info-protected': 'Security Information Registration Workflow',
  's-goal-guests-mfa': 'Guest Sign-In and Collaboration Workflow',
  's-goal-device-registration-mfa': 'Registration or Join Workflow and Client',
  's-goal-intune-enrollment-reauth': 'Enrollment Workflow and Client',
  's-goal-token-protection': 'Supported Client and Resource Tested',
  's-goal-pim-activation-reauth': 'Role Activation Tested',
  's-goal-user-risk': 'High-Risk Recovery Workflow',
  's-goal-user-risk-medium': 'Medium-Risk Password Recovery Workflow',
  's-goal-service-accounts-trusted-network': 'Service Job Tested',
  's-goal-block-device-code': 'Device-Code Client and Workflow Tested',
  's-goal-block-auth-transfer': 'Authentication Transfer Workflow Tested',
}
const ADMIN_SEPARATION = new Set(['s-ladder-admin-accounts-separate', 's-check-separate-admin-accounts'])
const SCOPED_MANUAL = new Set(['s-check-separate-admin-accounts','s-ladder-break-glass-accounts', 's-ladder-global-admin-count', 's-ladder-authenticator-over-sms', 's-ladder-legacy-auth-inventory', 's-question-mail-devices', 's-question-partner', 's-shared-devices', 's-ladder-admin-accounts-separate', 's-ladder-guest-review', 's-ladder-app-passwords', ...Object.keys(POLICY_WORKFLOWS)])
const outcomeField = (review = false): ManualEvidenceField => ({ key: 'outcome', label: 'Outcome', type: 'select', required: true, options: review ? [{ value: 'retained', label: 'Retain access' }, { value: 'revoked', label: 'Access revoked' }, { value: 'investigate', label: 'Investigate' }] : [{ value: 'passed', label: 'Successful' }, { value: 'failed', label: 'Unsuccessful' }, { value: 'investigate', label: 'Investigate' }] })

/** Only the existing manual steps receive scoped evidence inputs. */
export function manualEvidenceFields(stepId: string): ManualEvidenceField[] {
  if (!SCOPED_MANUAL.has(stepId)) return []
  const fields: ManualEvidenceField[] = [
    { key: 'accountIds', label: ADMIN_SEPARATION.has(stepId) ? 'Reviewed Accounts' : stepId === 's-ladder-guest-review' ? 'Reviewed Guests' : stepId === 's-ladder-global-admin-count' ? 'Reviewed Global Administrators' : stepId === 's-ladder-legacy-auth-inventory' ? 'Reviewed Legacy Accounts' : 'Tested Accounts', type: 'accounts', required: stepId !== 's-ladder-legacy-auth-inventory' },
  ]
  if (stepId !== 's-ladder-guest-review') fields.push({ key: 'workflow', label: POLICY_WORKFLOWS[stepId] ?? ({ 's-ladder-break-glass-accounts': 'Recovery Method and Administrative Task Tested', 's-ladder-global-admin-count': 'Purpose of Retained Global Administrator Assignments', 's-ladder-authenticator-over-sms': 'Replacement Sign-in and Recovery Test', 's-ladder-legacy-auth-inventory': 'Dependency Owners and Replacement or Follow-up Plans' } as Record<string, string>)[stepId] ?? (stepId === 's-question-mail-devices' ? 'Mail Job and Delivery Route' : stepId === 's-question-partner' ? 'Provider Access Path' : stepId === 's-shared-devices' ? 'Work Task Tested' : stepId === 's-ladder-app-passwords' ? 'Credential Retirement and Creation Restriction' : 'Dedicated Use or Handover Test'), type: 'text', required: true })
  if (ADMIN_SEPARATION.has(stepId)) fields.push({ key: 'replacementAccountId', label: 'Dedicated Administrator Account', type: 'accounts', required: true, whenOutcome: ['passed'] }, { key: 'roleIds', label: 'Required Roles', type: 'accounts', required: true, whenOutcome: ['passed'] })
  if (stepId === 's-goal-pim-activation-reauth') fields.push({ key: 'roleIds', label: 'Roles Tested', type: 'accounts', required: true }, { key: 'contextId', label: 'Authentication Context', type: 'text', required: true }, { key: 'configurationVerified', label: 'Role Settings Use This Authentication Context', type: 'checkbox', required: true })
  if (stepId === 's-goal-service-accounts-trusted-network') fields.push({ key: 'networkId', label: 'Named Network Tested', type: 'select', required: true })
  if (stepId === 's-goal-user-risk' || stepId === 's-goal-user-risk-medium') fields.push({ key: 'configurationVerified', label: 'Recovery Prerequisites Verified, Including Writeback for Hybrid Accounts', type: 'checkbox', required: true })
  fields.push(ADMIN_SEPARATION.has(stepId) ? { key: 'outcome', label: 'Outcome', type: 'select', required: true, options: [{ value: 'retained', label: 'Already dedicated to admin work' }, { value: 'passed', label: 'Handover tested' }, { value: 'failed', label: 'Unsuccessful' }, { value: 'investigate', label: 'Investigate' }] } : outcomeField(stepId === 's-ladder-guest-review'), { key: 'testedAt', label: ['s-ladder-guest-review', 's-ladder-global-admin-count', 's-ladder-legacy-auth-inventory'].includes(stepId) ? 'Reviewed On' : 'Tested On', type: 'date', required: true })
  if (stepId === 's-question-mail-devices') fields.push({ key: 'exceptionRemoved', label: 'Temporary Exception Removed', type: 'checkbox', required: true })
  fields.push({ key: 'reference', label: 'Change Record', type: 'text', required: false })
  return fields
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) {
    // Serialize each item once; preserve Array.sort's undefined-last behavior.
    return value.map(stable).map(item => ({ item, key: JSON.stringify(item) }))
      .sort((a, b) => a.item === undefined ? (b.item === undefined ? 0 : 1) : b.item === undefined ? -1 : a.key!.localeCompare(b.key!))
      .map(({ item }) => item)
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !['displayName', 'description', 'modifiedDateTime', '@odata.context'].includes(key)).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, stable(v)]))
  return value
}
function scopedPeople(step: Step, snapshot: TenantSnapshot): string[] {
  if (step.id === 's-ladder-global-admin-count') return snapshot.users.filter(u => (snapshot.roles.active[u.id] ?? []).includes(GLOBAL_ADMIN_ROLE_ID) || (snapshot.roles.eligible?.[u.id] ?? []).includes(GLOBAL_ADMIN_ROLE_ID)).map(u => u.id)
  if (step.id === 's-ladder-legacy-auth-inventory') return snapshot.evidenceUsage?.legacyAuth.userIds ?? []
  if (step.id === 's-ladder-guest-review') return snapshot.users.filter(u => u.userType === 'guest').map(u => u.id)
  return step.population.ids
}
function scopedBasis(step: Step, snapshot: TenantSnapshot, mapping?: MappingState, selectedIds?: string[], accountCache?: Map<string, string>): string {
  const ids = selectedIds ?? scopedPeople(step, snapshot)
  const scope = { ...step, population: { ...step.population, ids } }
  const policies = relevantPolicies(scope, snapshot)
  const locationIds = new Set(policies.flatMap(raw => {
    const conditions = (raw as unknown[])[2] as Record<string, any> | undefined
    return [...(conditions?.locations?.includeLocations ?? []), ...(conditions?.locations?.excludeLocations ?? [])]
  }))
  const locations = (snapshot.config.namedLocations?.rows ?? []).filter(raw => locationIds.has(String((raw as Record<string, unknown>).id))).map(raw => { const l = raw as Record<string, unknown>; return [l.id, l['@odata.type'], l.isTrusted, l.ipRanges, l.countriesAndRegions, l.includeUnknownCountriesAndRegions] })
  const strengthIds = new Set(policies.flatMap(raw => { const grant = (raw as unknown[])[3] as Record<string, any>; return grant?.authenticationStrength?.id ? [grant.authenticationStrength.id] : [] }))
  const strengths = (snapshot.config.authStrengths?.rows ?? []).filter(raw => strengthIds.has(String((raw as Record<string, unknown>).id))).map(raw => { const p = raw as Record<string, unknown>; return [p.id, p.allowedCombinations, p.combinationConfigurations] })
  const additional = POLICY_WORKFLOWS[step.id] ? [strengths, step.id === 's-goal-device-registration-mfa' ? (snapshot.config.deviceRegistrationPolicy?.rows ?? []) : null, step.id === 's-goal-guests-mfa' ? (snapshot.config.crossTenantAccess?.rows ?? []) : null]
    : step.id === CARVE_OUT_STEP_ID.partner ? [mapping ? answerOf(mapping, QUESTION_STEP.partner, 'question')?.index : null, (snapshot.config.crossTenantAccess?.rows ?? [])]
    : step.id === CARVE_OUT_STEP_ID.mailDevices ? [mapping ? mailDevicesOf(mapping) : []]
    : ['s-ladder-break-glass-accounts', 's-ladder-authenticator-over-sms'].includes(step.id) ? [snapshot.config.authMethodsPolicy?.rows ?? [], snapshot.config.securityDefaults?.rows ?? []]
    : step.id === 's-ladder-legacy-auth-inventory' ? [Object.keys(snapshot.evidenceUsage?.legacyAuth.byDetail ?? {}).sort()]
    : step.id === 's-ladder-app-passwords' ? [ids.map(id => [id, snapshot.perUserMfa?.[id]?.state ?? 'unknown'])]
    : []
  const accountEvidence = ['s-check-separate-admin-accounts', 's-ladder-admin-accounts-separate', 's-ladder-break-glass-accounts', 's-ladder-global-admin-count', 's-ladder-authenticator-over-sms'].includes(step.id)
  const accountKey = `${accountEvidence}:${step.id === 's-ladder-guest-review'}`
  let accounts = accountCache?.get(accountKey)
  if (!accounts) {
    // These fixed account keys are already in stable()'s canonical order.
    // Sort the directory once; normalize only the nested evidence fields.
    const directory = new Map(snapshot.users.map(u => [u.id, u]))
    accounts = JSON.stringify(Object.fromEntries([...directory].sort(([a], [b]) => a.localeCompare(b)).map(([id, u]) => [id, {
      eligibleRoles: accountEvidence ? stable(snapshot.roles.eligible?.[id] ?? []) : null,
      enabled: u.accountEnabled,
      invitation: step.id === 's-ladder-guest-review' ? u.externalUserState : null,
      methods: accountEvidence ? stable(snapshot.authMethods[id] ?? 'unknown') : null,
      roles: accountEvidence ? stable(snapshot.roles.active[id] ?? []) : null,
      synced: u.onPremisesSyncEnabled,
      type: u.userType,
    }])))
    accountCache?.set(accountKey, accounts)
  }
  // Same canonical key order and values; reuse only this derivation's inventory.
  return `{"accounts":${accounts},"configuration":${JSON.stringify(stable([policies, locations, additional]))},"stepId":${JSON.stringify(step.id)},"version":"manual-evidence-v1"}`
}

/** Freeze only the accounts actually named in the manual record. Call when
 * saving richer records and when checking them; old opaque bases stay intact. */
export function scopeManualBasis(basis: string, record: Pick<OwnerConfirmation, 'accountIds' | 'replacementAccountId' | 'outcome'>): string {
  try {
    const value = JSON.parse(basis)
    if (value?.version !== 'manual-evidence-v1' || !value.accounts || typeof value.accounts !== 'object') return basis
    const ids = [...new Set([...(record.accountIds ?? []), ...(record.replacementAccountId ? [record.replacementAccountId] : [])])]
    value.accounts = Object.fromEntries(ids.map(id => {
      const facts = value.accounts[id] ?? null
      // Removing the ordinary account's roles is the intended handover action,
      // not invalidation of the already tested replacement. Its current roles
      // are still checked by the scan requirement before completion.
      if (ADMIN_SEPARATION.has(value.stepId) && record.outcome === 'passed' && id !== record.replacementAccountId && facts && !Array.isArray(facts)) { facts.roles = []; facts.eligibleRoles = [] }
      return [id, facts]
    }))
    return JSON.stringify(stable(value))
  } catch { return basis }
}

function evidenceRead(step: Step, snapshot: TenantSnapshot): boolean {
  if (snapshot.sources.users?.status !== 'ok') return false
  if (step.id === 's-ladder-legacy-auth-inventory' && snapshot.sources.signInEvidence?.status !== 'ok') return false
  if (['s-ladder-break-glass-accounts', 's-ladder-global-admin-count'].includes(step.id) && snapshot.config.roleAssignments?.status !== 'ok') return false
  if (step.id === 's-ladder-global-admin-count' && snapshot.config.pimEligibility?.status !== 'ok') return false
  if (['s-ladder-break-glass-accounts', 's-ladder-authenticator-over-sms'].includes(step.id) && (snapshot.config.authMethodsPolicy?.status !== 'ok' || scopedPeople(step, snapshot).some(id => !Array.isArray(snapshot.authMethods[id])))) return false
  if ((POLICY_WORKFLOWS[step.id] && snapshot.config.caPolicies?.status !== 'ok') || ['s-shared-devices', CARVE_OUT_STEP_ID.mailDevices, CARVE_OUT_STEP_ID.partner].includes(step.id) && snapshot.config.caPolicies?.status !== 'ok') return false
  if ((step.id === CARVE_OUT_STEP_ID.partner || step.id === 's-goal-guests-mfa') && snapshot.config.crossTenantAccess?.status !== 'ok') return false
  if (step.id === 's-goal-service-accounts-trusted-network' && snapshot.config.namedLocations?.status !== 'ok') return false
  if (step.id === 's-goal-device-registration-mfa' && snapshot.config.deviceRegistrationPolicy?.status !== 'ok') return false
  if (ADMIN_SEPARATION.has(step.id) && (snapshot.config.roleAssignments?.status !== 'ok' || snapshot.config.pimEligibility?.status !== 'ok' || step.population.ids.some(id => snapshot.authMethods[id] === 'unknown' || !snapshot.authMethods[id]))) return false
  return true
}
export function completeManualEvidence(stepId: string, record: OwnerConfirmation | undefined, now = new Date().toISOString()): boolean {
  if (!record || !Number.isFinite(Date.parse(record.at)) || Date.parse(record.at) > Date.parse(now)) return false
  for (const field of manualEvidenceFields(stepId).filter(f => f.required && (!f.whenOutcome || f.whenOutcome.includes(record.outcome!)))) {
    const value = record[field.key]
    if (field.type === 'checkbox' ? value !== true : Array.isArray(value) ? value.length === 0 : typeof value !== 'string' || value.trim().length === 0) return false
  }
  if (record.testedAt) {
    const day = record.testedAt.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day || day > now.slice(0, 10)) return false
  }
  return ADMIN_SEPARATION.has(stepId) ? record.outcome === 'retained' || record.outcome === 'passed' : stepId === 's-ladder-guest-review' ? record.outcome === 'retained' || record.outcome === 'revoked' : record.outcome === 'passed'
}

/** Review only facts material to this task, not every scan timestamp. */
export function manualBasis(step: Step, snapshot: TenantSnapshot, mapping?: MappingState, accountCache?: Map<string, string>): string {
  if (SCOPED_MANUAL.has(step.id)) return scopedBasis(step, snapshot, mapping, undefined, accountCache)
  if (['s-prereq-per-user-mfa', 's-ladder-per-user-mfa-cleanup'].includes(step.id)) {
    const policies = (snapshot.config.caPolicies?.rows ?? []).filter(raw => {
      const p = raw as Record<string, any>
      return p.grantControls?.authenticationStrength || p.grantControls?.builtInControls?.includes('mfa')
    }).map(raw => { const p = raw as Record<string, unknown>; return [p.id, p.state, p.conditions, p.grantControls] }).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    return JSON.stringify(['per-user-mfa-review', snapshot.users.map(u => [u.id, u.accountEnabled]).sort(), snapshot.perUserMfa ?? null, snapshot.config.authMethodsPolicy?.rows, snapshot.config.securityDefaults?.rows, policies])
  }
  if (FOLLOW_UPS.has(step.id)) {
    const question = step.id === CARVE_OUT_STEP_ID.travel ? QUESTION_STEP.travel : step.id === CARVE_OUT_STEP_ID.partner ? QUESTION_STEP.partner : QUESTION_STEP.mailDevices
    const answer = mapping ? answerOf(mapping, question, step.id === CARVE_OUT_STEP_ID.mailDevices ? 'decision' : 'question') : null
    // A new answer or changed policy reopens the follow-up. Scan timestamps alone do not.
    return JSON.stringify([step.id, answer, step.id === CARVE_OUT_STEP_ID.mailDevices && mapping ? mailDevicesOf(mapping).slice().sort() : [], relevantPolicies(step, snapshot)])
  }
  if (step.id === 's-shared-devices') {
    const byId = (a: Record<string, unknown>, b: Record<string, unknown>) => String(a.id).localeCompare(String(b.id))
    const policies = relevantPolicies(step, snapshot)
    const locations = (snapshot.config.namedLocations?.rows ?? []).filter(raw => mapping?.trustedLocationIds.includes(String((raw as Record<string, unknown>).id))).map(raw => { const l = raw as Record<string, unknown>; return { id:l.id, type:l['@odata.type'], isTrusted:l.isTrusted, ipRanges:l.ipRanges } }).sort(byId)
    return JSON.stringify([step.id, [...step.population.ids].sort(), policies, locations])
  }
  const item = step.id.replace('s-ladder-', '')
  const people = snapshot.users.filter((u) => item === 'break-glass-accounts' ? step.population.ids.includes(u.id) : item === 'guest-review' ? u.userType === 'guest' : ['admin-accounts-separate', 'global-admin-count'].includes(item) ? (snapshot.roles.active[u.id]?.length ?? 0) > 0 : item === 'legacy-auth-inventory' ? snapshot.evidenceUsage?.legacyAuth.userIds.includes(u.id) : true)
  const users = people.map((u) => [u.id, u.accountEnabled, u.userType, item === 'break-glass-accounts' ? u.onPremisesSyncEnabled : null, item === 'admin-accounts-separate' ? u.assignedPlans.map((p) => [p.servicePlanId, p.capabilityStatus]).sort() : null, item === 'stale-accounts' ? (!u.lastSuccessfulSignIn || Date.parse(snapshot.asOf) - Date.parse(u.lastSuccessfulSignIn) >= 90 * 86_400_000) : null]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  const roles = Object.fromEntries(Object.entries(snapshot.roles.active).filter(([id]) => people.some((u) => u.id === id)).map(([id, rs]) => [id, [...rs].sort()]).sort(([a], [b]) => String(a).localeCompare(String(b))))
  const basis: unknown[] = [step.id, users, SCAN_REQUIRED.has(item) ? [item === 'authenticator-over-sms' ? snapshot.config.authMethodsPolicy?.rows : null, roles] : null]
  if (item === 'guest-review') basis.push(people.map(u => [u.id, u.externalUserState]).sort())
  if (item === 'legacy-auth-inventory') basis.push(Object.keys(snapshot.evidenceUsage?.legacyAuth.byDetail ?? {}).sort())
  // Preserve the persisted basis of existing manual reviews. Only this new
  // review depends on the policies that can restrict phone access.
  if (item === 'phone-access-restriction') basis.push(relevantPolicies(step, snapshot))
  return JSON.stringify(basis)
}

export function applyManualReviews(steps: Step[], snapshot: TenantSnapshot, confirmations: Record<string, Record<string, OwnerConfirmation>> = {}, mapping?: MappingState, recoveryRecords: CleanupCheckpoint[] = [], groups: GroupMembers = new Map(), reviewNow = snapshot.asOf, activeReviewPeople?: ReadonlySet<string>): void {
  const accountCache = new Map<string, string>()
  for (const step of steps) {
    const item = step.id.replace('s-ladder-', '')
    if (!SCOPED_MANUAL.has(step.id) && !FOLLOW_UPS.has(step.id) && step.id !== 's-shared-devices' && step.id !== 's-prereq-per-user-mfa' && (!step.id.startsWith('s-ladder-') || !REVIEWS.has(item))) continue
    if (step.id === 's-shared-devices' && step.state.setAside && step.doesntApply) {
      const record = confirmations[step.id]?.[MANUAL_REVIEW_ID]
      step.manualReview = { basis: manualBasis(step, snapshot, mapping, accountCache), readyToConfirm: false, confirmedAt: null, fields: [], ...(record ? { record, verification: 'historical' as const } : {}) }
      continue
    }
    const perUser = step.id === 's-prereq-per-user-mfa' || item === 'per-user-mfa-cleanup'
    if (perUser) {
      const enabled = snapshot.users.filter(u => ['enabled', 'enforced'].includes(snapshot.perUserMfa?.[u.id]?.state ?? 'unknown'))
      const unknown = snapshot.users.filter(u => !snapshot.perUserMfa?.[u.id] || snapshot.perUserMfa[u.id].state === 'unknown')
      step.configurationFindings = [{ key: 'per-user-mfa', label: 'Legacy Per-User MFA', value: enabled.length ? `${enabled.length} accounts enabled` : snapshot.sources.users?.status !== 'ok' || unknown.length ? 'Not fully read' : 'Disabled', detail: enabled.length ? enabled.map(u => u.displayName || u.userPrincipalName).join(', ') : snapshot.sources.users?.status !== 'ok' ? 'The account list was not fully read; the tenant-wide per-user MFA state is not established.' : unknown.length ? `${unknown.length} accounts need a per-user state check.` : 'No current account has legacy per-user MFA enabled or enforced.', outcome: enabled.length ? 'fail' : snapshot.sources.users?.status !== 'ok' || unknown.length ? 'unknown' : 'pass' }]
      step.population = { ...step.population, ids: enabled.map(u => u.id), total: enabled.length, activeIds: enabled.filter(u => u.accountEnabled).map(u => u.id), active: enabled.filter(u => u.accountEnabled).length, inScope: enabled.length }
      if (snapshot.sources.users?.status === 'ok' && unknown.length === 0 && enabled.length === 0) {
        delete step.manualReview
        step.deliveredBy = ['The scan read every account and found legacy per-user MFA disabled.']
        setState(step, { satisfied: true, inPlace: true })
        continue
      }
      if (enabled.length > 0) {
        delete step.manualReview
        setState(step, { satisfied: false, inPlace: false })
        continue
      }
    }
    if (item === 'guest-review' && snapshot.sources.users?.status === 'ok' && !snapshot.users.some(u => u.userType === 'guest')) {
      setState(step, { satisfied: true, inPlace: true })
      continue
    }
    if (ADMIN_SEPARATION.has(step.id)) {
      const ids = snapshot.users.filter(u => !mapping?.breakGlassUserIds.includes(u.id) && ((snapshot.roles.active[u.id]?.length ?? 0) > 0 || (snapshot.roles.eligible?.[u.id]?.length ?? 0) > 0)).map(u => u.id)
      const activePeople = activeReviewPeople ?? new Set(step.population.activeIds ?? [])
      const activeAdmins = adminUserIds(snapshot.roles)
      const activeIds = ids.filter(id => activePeople.has(id))
      step.population = { ...step.population, ids, total: ids.length, admins: ids.filter(id => activeAdmins.has(id)).length, inScope: ids.length, activeIds, active: activeIds.length }
      step.configurationFindings = [{ key: 'administrator-review-scope', label: 'Administrator Account Evidence', value: evidenceRead(step, snapshot) ? `${ids.length} accounts to review` : 'Account or role data not fully read', detail: evidenceRead(step, snapshot) ? 'Active and eligible roles identify the review scope. Mailbox licensing and business sign-ins are clues, not proof of dedicated use.' : 'Active roles, eligible roles and registered methods must be readable to compare the saved review with the current configuration.', outcome: evidenceRead(step, snapshot) ? 'pass' : 'unknown' }]
      step.population.active = step.population.activeIds?.length ?? 0
      if (!ids.length && evidenceRead(step, snapshot)) { delete step.manualReview; step.deliveredBy = ['No non-emergency account currently holds an active or eligible directory role.']; setState(step, { satisfied: true, inPlace: true }); continue }
    }
    if (item === 'global-admin-count' || item === 'legacy-auth-inventory') {
      const ids = scopedPeople(step, snapshot)
      const activeIds = ids.filter(id => snapshot.users.find(u => u.id === id)?.accountEnabled)
      step.population = { ...step.population, ids, total: ids.length, activeIds, active: activeIds.length, inScope: ids.length }
      if (item === 'global-admin-count') {
        const active = ids.filter(id => (snapshot.roles.active[id] ?? []).includes(GLOBAL_ADMIN_ROLE_ID)).length
        step.configurationFindings = [{ key: 'global-admin-scope', label: 'Global Administrator Assignments', value: `${active} active · ${ids.length - active} eligible only`, detail: 'Review the purpose of each assignment and preserve dedicated emergency access. The recommended account count is guidance, not proof that these assignments are appropriate.', outcome: evidenceRead(step, snapshot) ? 'pass' : 'unknown' }]
      }
    }
    if (item === 'break-glass-accounts') {
      const ids = step.population.ids
      const methodChecks = emergencyPasskeyCompatibility(snapshot, ids, groups)
      step.configurationFindings = methodChecks.map(c => ({ key: `recovery-method-${c.accountId}`, label: snapshot.users.find(u => u.id === c.accountId)?.displayName || c.accountId, value: c.state === 'eligible' ? 'Registered key allowed' : c.state === 'unknown' ? 'Method settings not fully read' : 'Recovery key needs attention', detail: c.state === 'eligible' ? 'The registered key is permitted by the effective authentication method settings. The recovery drill is recorded separately.' : ({ disabled: 'Passkey authentication is disabled.', excluded: 'This account is excluded from passkey authentication.', notTargeted: 'Passkey authentication does not include this account.', newKey: 'No registered passkey or security key was found for this account.', modelRestricted: 'The registered key model is not allowed by the effective passkey profile.', membershipUnread: 'Group membership could not establish this account’s effective passkey settings.', methodsUnread: 'Registered authentication methods could not be read.', modelsUnread: 'The registered key model or effective restrictions could not be fully read.', profileOrPartial: 'The assigned passkey profile could not be fully read.', policyUnread: 'Authentication method settings could not be read.' } as Record<string, string>)[c.reason] ?? 'Check the effective passkey profile and registered key for this account.', outcome: c.state === 'eligible' ? 'pass' as const : c.state === 'unknown' ? 'unknown' as const : 'fail' as const }))
      const factsReady = ids.length >= 2 && methodChecks.every(c => c.state === 'eligible') && ids.every(id => { const u = snapshot.users.find(u => u.id === id); return u?.accountEnabled && u.onPremisesSyncEnabled !== true && (snapshot.roles.active[id] ?? []).includes(GLOBAL_ADMIN_ROLE_ID) })
      const fingerprints = recoveryAccountBasis(snapshot, ids)
      const dates = ids.map(id => fingerprints[id] ? latestRecoveryTest(id, recoveryRecords, reviewNow, fingerprints[id]) : null)
      const tested = factsReady && dates.every(day => day && Date.parse(reviewNow) - Date.parse(day) <= BREAK_GLASS_DRILL_DAYS * 86400000)
      if (tested) {
        delete step.manualReview
        step.deliveredBy = ['Every selected emergency account has a recent successful recovery drill for its current account and authentication configuration.']
        setState(step, { satisfied: true, inPlace: true })
        continue
      }
      delete step.manualReview
      step.deliveredBy = ['Record one successful recovery test for each selected account in Test Emergency Access. The same record completes this check.']
      step.action.portalSteps = [...step.action.portalSteps, 'Open Test Emergency Access in this plan and record a successful recovery test for each selected account.']
      setState(step, { satisfied: false, inPlace: false })
      continue
    }
    const basis = manualBasis(step, snapshot, mapping, accountCache)
    const alias = step.id === 's-prereq-per-user-mfa' ? 's-ladder-per-user-mfa-cleanup' : step.id === 's-ladder-per-user-mfa-cleanup' ? 's-prereq-per-user-mfa' : null
    const confirmation = confirmations[step.id]?.[MANUAL_REVIEW_ID] ?? (alias ? confirmations[alias]?.[MANUAL_REVIEW_ID] : undefined)
    const readyToConfirm = ADMIN_SEPARATION.has(step.id) ? evidenceRead(step, snapshot) : item === 'global-admin-count' ? evidenceRead(step, snapshot) && (mapping?.breakGlassUserIds ?? []).length >= 2 && (mapping?.breakGlassUserIds ?? []).every(id => snapshot.users.some(u => u.id === id && u.accountEnabled) && (snapshot.roles.active[id] ?? []).includes(GLOBAL_ADMIN_ROLE_ID)) : POLICY_WORKFLOWS[step.id] ? step.state.satisfied : !SCAN_REQUIRED.has(item) || step.state.satisfied
    const confirmedAt = readyToConfirm && confirmation?.basis === basis && Date.parse(confirmation.at) <= Date.now() ? confirmation.at : null
    if (SCOPED_MANUAL.has(step.id)) {
      const populationIds = new Set(step.population.ids)
      const fields = manualEvidenceFields(step.id).map(field => field.key === 'accountIds' ? { ...field, options: snapshot.users.filter(u => step.id === 's-ladder-guest-review' ? u.userType === 'guest' : step.id === 's-goal-pim-activation-reauth' ? u.accountEnabled && ((snapshot.roles.active[u.id]?.length ?? 0) > 0 || (snapshot.roles.eligible[u.id]?.length ?? 0) > 0) : step.id === CARVE_OUT_STEP_ID.partner ? true : step.population.ids.length ? populationIds.has(u.id) : true).map(u => ({ value: u.id, label: u.displayName || u.userPrincipalName || u.id })) } : field.key === 'roleIds' ? { ...field, options: [...new Map([...(snapshot.config.roleAssignments?.rows ?? []), ...(snapshot.config.pimEligibility?.rows ?? [])].flatMap(raw => { const p = raw as Record<string, any>; return p.roleDefinitionId ? [[String(p.roleDefinitionId), { value: String(p.roleDefinitionId), label: String(p.roleDefinition?.displayName ?? p.roleDefinitionId) }] as const] : [] })).values()] } : field.key === 'networkId' ? { ...field, options: (snapshot.config.namedLocations?.rows ?? []).filter(raw => Array.isArray((raw as Record<string, unknown>).ipRanges)).map(raw => { const p = raw as Record<string, unknown>; return { value: String(p.id), label: String(p.displayName ?? p.id) } }) } : field)
      const read = evidenceRead(step, snapshot)
      const complete = completeManualEvidence(step.id, confirmation)
      const people = scopedPeople(step, snapshot)
      const pendingAccountIds = POLICY_WORKFLOWS[step.id] || step.id === CARVE_OUT_STEP_ID.partner || step.id === 's-ladder-authenticator-over-sms' ? [] : people.filter(id => !confirmation?.accountIds?.includes(id) && !(ADMIN_SEPARATION.has(step.id) && (confirmation?.outcome === 'passed' && id === confirmation.replacementAccountId || mapping?.breakGlassUserIds.includes(id))))
      const matching = confirmation?.basis === (confirmation ? scopeManualBasis(basis, confirmation) : basis)
      let observedDefect = !readyToConfirm
      if (step.id === 's-ladder-break-glass-accounts' && confirmation?.testedAt) observedDefect ||= Date.parse(snapshot.asOf) - Date.parse(confirmation.testedAt) > BREAK_GLASS_DRILL_DAYS * 86400000
      if (step.id === 's-goal-service-accounts-trusted-network' && confirmation?.networkId) {
        const network = (snapshot.config.namedLocations?.rows ?? []).find(raw => (raw as Record<string, unknown>).id === confirmation.networkId) as Record<string, unknown> | undefined
        const locations = relevantPolicies(step, snapshot).flatMap(raw => { const locations = ((raw as unknown[])[2] as Record<string, any>)?.locations; return [...(locations?.includeLocations ?? []), ...(locations?.excludeLocations ?? [])] })
        observedDefect ||= !network || !Array.isArray(network.ipRanges) || !(locations.includes(confirmation.networkId) || locations.includes('AllTrusted') && network.isTrusted === true)
      }
      if (step.id === 's-goal-pim-activation-reauth' && confirmation?.contextId) observedDefect ||= !relevantPolicies(step, snapshot).some(raw => (((raw as unknown[])[2] as Record<string, any>)?.applications?.includeAuthenticationContextClassReferences ?? []).includes(confirmation.contextId))
      if (ADMIN_SEPARATION.has(step.id) && confirmation?.outcome === 'passed' && confirmation.replacementAccountId) {
        observedDefect ||= (confirmation.accountIds ?? []).some(id => (snapshot.roles.active[id]?.length ?? 0) > 0 || (snapshot.roles.eligible?.[id]?.length ?? 0) > 0)
        const replacement = snapshot.users.find(u => u.id === confirmation.replacementAccountId)
        observedDefect ||= !replacement?.accountEnabled || !!confirmation.accountIds?.includes(confirmation.replacementAccountId) || !(confirmation.roleIds ?? []).every(role => [...(snapshot.roles.active[confirmation.replacementAccountId!] ?? []), ...(snapshot.roles.eligible?.[confirmation.replacementAccountId!] ?? [])].includes(role))
      }
      if (step.id === 's-ladder-guest-review' && confirmation?.outcome === 'revoked') observedDefect ||= snapshot.users.some(u => confirmation.accountIds?.includes(u.id) && u.accountEnabled)
      const verification = !read ? 'unread' : confirmation && !confirmation.outcome ? 'historical' : !complete ? 'incomplete' : !matching || observedDefect ? 'changed' : 'current'
      const accepted = verification === 'current' && pendingAccountIds.length === 0
      step.manualReview = { basis, confirmedAt: accepted ? confirmation!.testedAt ?? confirmation!.at : null, readyToConfirm, fields, ...(confirmation ? { record: confirmation } : {}), verification, pendingAccountIds, ...(verification === 'unread' ? { staleReason: 'The latest scan could not verify the relevant configuration. The recorded result is retained.' } : verification === 'changed' ? { staleReason: 'The account or configuration used for this check has changed. Test the affected workflow again.' } : verification === 'historical' ? { staleReason: 'The earlier completion record has no scoped test outcome.' } : pendingAccountIds.length && confirmation ? { staleReason: `${pendingAccountIds.length} accounts still need a recorded outcome.` } : {}) }
      setState(step, { satisfied: accepted, inPlace: accepted })
      continue
    }
    step.manualReview = { basis, confirmedAt, readyToConfirm }
    setState(step, { satisfied: confirmedAt !== null, inPlace: confirmedAt !== null })
  }
}
