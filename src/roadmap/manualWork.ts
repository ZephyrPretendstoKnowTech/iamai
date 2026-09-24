import { adminUserIds } from '../roles.ts'
import { personLabels } from '../names.ts'
import { isLicenceGate } from '../graph/collect/roles.ts'
import { GLOBAL_ADMIN_ROLE_ID } from './ladder.ts'
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'
import type { OwnerConfirmation, ManualEvidenceField } from './decisions.ts'
import { setState } from './lifecycle.ts'
import type { Step } from './types.ts'
import type { MappingState } from '../mapping/types.ts'
import { QUESTION_STEP, answerOf, mailDevicesOf } from './answers.ts'
import { namedAccounts, population, populationIndex } from '../derive/population.ts'
import type { PopulationIndex } from '../derive/population.ts'

export const MANUAL_REVIEW_ID = 'manual-review'
const REVIEWS = new Set(['legacy-auth-inventory', 'app-passwords', 'guest-review', 'global-admin-count', 'authenticator-over-sms', 'per-user-mfa-cleanup', 'phone-access-restriction'])
const SCAN_REQUIRED = new Set(['global-admin-count', 'authenticator-over-sms'])
/**
 * Block Legacy Authentication, which now owns both halves of its own outcome:
 * the policy, and moving every device the mail-sending answer named onto a
 * supported route before its temporary exception is removed. That second half
 * was a step of its own (`s-question-mail-devices`) until
 * docs/plans/step-redundancy-analysis.md finding 6 folded it in.
 */
export const LEGACY_AUTH_STEP_ID = 's-goal-block-legacy-auth'

/**
 * True on Block Legacy Authentication when the answer named exception accounts,
 * so the step carries the mail follow-up's task and evidence. A tenant that
 * answered "None" has nothing to move and the step is the policy alone.
 */
export function mailDevicesFollowUp(stepId: string, mapping?: Pick<MappingState, 'questionAnswers'>): boolean {
  return stepId === LEGACY_AUTH_STEP_ID && !!mapping && mailDevicesOf(mapping).length > 0
}

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
    if (step.id === LEGACY_AUTH_STEP_ID) return potentiallyTargeted && (c.clientAppTypes ?? []).some((x: string) => ['exchangeActiveSync', 'other'].includes(x))
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
  's-goal-pim-activation-reauth': 'Role Activation Tested',
  's-goal-user-risk-medium': 'Medium-Risk Password Recovery Workflow',
  's-goal-service-accounts-trusted-network': 'Service Job Tested',
  's-goal-block-device-code': 'Device-Code Client and Workflow Tested',
}
// Use Separate Accounts for Admin Work is not among them: the scan decides it,
// and it records nothing (walk list item 1; generate.ts).
const SCOPED_MANUAL = new Set(['s-ladder-global-admin-count', 's-ladder-authenticator-over-sms', 's-ladder-legacy-auth-inventory', 's-shared-devices', 's-ladder-guest-review', 's-ladder-app-passwords', ...Object.keys(POLICY_WORKFLOWS)])
const outcomeField = (review = false): ManualEvidenceField => ({ key: 'outcome', label: 'Outcome', type: 'select', required: true, options: review ? [{ value: 'retained', label: 'Retain access' }, { value: 'revoked', label: 'Access revoked' }, { value: 'investigate', label: 'Investigate' }] : [{ value: 'passed', label: 'Successful' }, { value: 'failed', label: 'Unsuccessful' }, { value: 'investigate', label: 'Investigate' }] })

/** Only the existing manual steps receive scoped evidence inputs. */
export function manualEvidenceFields(stepId: string, mapping?: Pick<MappingState, 'questionAnswers'>): ManualEvidenceField[] {
  if (!SCOPED_MANUAL.has(stepId) && !mailDevicesFollowUp(stepId, mapping)) return []
  const fields: ManualEvidenceField[] = []
  // A field is here only if the product reads it. The form had grown to eight:
  // an account picker, free text for the workflow, the roles, an authentication
  // context, a named network, a partner path, a change record. Three of those
  // were transcription — nothing read `workflow`, `reference` or
  // `providerAccessPath` except to print them back on the step and in the export
  // — and the account picker did nothing at all on the steps whose completion is
  // counted per workflow rather than per person. They are gone (owner,
  // 2026-09-20: if a step looks like too much, it is).
  //
  // What is left earns its place, and the rule is the same for each: it decides
  // whether the step is complete, or it is a specific fact the scan cannot see.

  // Counted per person: the step is not complete until every scoped account has
  // a record (`pendingAccountIds` below). Steps keyed by workflow do not count
  // people, so the picker would gather an answer nothing reads.
  const perAccount = !POLICY_WORKFLOWS[stepId] && !mailDevicesFollowUp(stepId, mapping) && stepId !== 's-ladder-authenticator-over-sms'
  if (perAccount) fields.push({ key: 'accountIds', label: stepId === 's-ladder-guest-review' ? 'Reviewed Guests' : stepId === 's-ladder-global-admin-count' ? 'Reviewed Global Administrators' : stepId === 's-ladder-legacy-auth-inventory' ? 'Reviewed Legacy Accounts' : 'Tested Accounts', type: 'accounts', required: stepId !== 's-ladder-legacy-auth-inventory' })
  // Checked against the tenant: an authentication context the policies do not
  // reference, or a named network that is not the one tested, is a defect IAMAI
  // raises rather than a string it stores (`observedDefect` below).
  if (stepId === 's-goal-pim-activation-reauth') fields.push({ key: 'contextId', label: 'Authentication Context', type: 'text', required: true }, { key: 'configurationVerified', label: 'Role Settings Use This Authentication Context', type: 'checkbox', required: true })
  if (stepId === 's-goal-service-accounts-trusted-network') fields.push({ key: 'networkId', label: 'Named Network Tested', type: 'select', required: true })
  if (stepId === 's-goal-user-risk' || stepId === 's-goal-user-risk-medium') fields.push({ key: 'configurationVerified', label: 'Recovery Prerequisites Verified, Including Writeback for Hybrid Accounts', type: 'checkbox', required: true })
  // The one free-text field kept, because the owner put it here deliberately:
  // the mail-route evidence folded onto Block Legacy Authentication when the
  // separate mail-devices step was removed (step-redundancy-analysis finding 6).
  // It is the evidence the temporary exception can come out, and it is asked for
  // only where a tenant actually named a mail-sending device.
  if (mailDevicesFollowUp(stepId, mapping)) fields.push({ key: 'workflow', label: 'Mail Job and Delivery Route', type: 'text', required: true })
  // Folded in from the deleted partner follow-up (step-redundancy-analysis
  // finding 5): where a tenant excludes service providers, the path that access
  // takes is the evidence that step asked for. Optional, because a tenant with
  // no partner has no path to name.
  if (stepId === 's-goal-guests-mfa') fields.push({ key: 'providerAccessPath', label: 'Partner or Provider Access Path', type: 'text', required: false })
  if (stepId === LEGACY_AUTH_STEP_ID) fields.push({ key: 'exceptionRemoved', label: 'Temporary Exception Removed', type: 'checkbox', required: true })
  fields.push(outcomeField(stepId === 's-ladder-guest-review'), { key: 'testedAt', label: ['s-ladder-guest-review', 's-ladder-global-admin-count', 's-ladder-legacy-auth-inventory'].includes(stepId) ? 'Reviewed On' : 'Tested On', type: 'date', required: true })
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
  // The guests policy carries the partner answer's own evidence now that the
  // partner follow-up is folded into it (finding 5): a changed answer reopens it.
  const additional = POLICY_WORKFLOWS[step.id] ? [strengths, step.id === 's-goal-device-registration-mfa' ? (snapshot.config.deviceRegistrationPolicy?.rows ?? []) : null, step.id === 's-goal-guests-mfa' ? [(snapshot.config.crossTenantAccess?.rows ?? []), mapping ? answerOf(mapping, QUESTION_STEP.partner, 'question')?.index ?? null : null] : null]
    : step.id === 's-ladder-authenticator-over-sms' ? [snapshot.config.authMethodsPolicy?.rows ?? [], snapshot.config.securityDefaults?.rows ?? []]
    : step.id === 's-ladder-legacy-auth-inventory' ? [Object.keys(snapshot.evidenceUsage?.legacyAuth.byDetail ?? {}).sort()]
    : step.id === 's-ladder-app-passwords' ? [ids.map(id => [id, snapshot.perUserMfa?.[id]?.state ?? 'unknown'])]
    : []
  const accountEvidence = ['s-ladder-global-admin-count', 's-ladder-authenticator-over-sms'].includes(step.id)
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
      return [id, facts]
    }))
    return JSON.stringify(stable(value))
  } catch { return basis }
}

/**
 * A source is read when it is `ok`, or when the only thing missing from it is
 * something a licence withholds. Without Entra ID P1 the directory read is
 * `partial` **forever** — Graph withholds `signInActivity`, not the users — so a
 * strict `=== 'ok'` meant every manual review on a free-tier tenant read as
 * unverified, kept `confirmedAt: null`, and could never be completed. The
 * day-one plan was unfinishable (V1 audit S4-21).
 *
 * This is the same exemption `coreSections.ts` already makes for the same
 * reason: a section a licence withholds is not a section nobody could read. It
 * is deliberately narrow — a partial read from a refusal or an error still
 * suspends the result, which is rule 4 of the V1 standard.
 */
const sectionRead = (s: { status: string; reason: string | null } | undefined): boolean =>
  s?.status === 'ok' || (s?.status === 'partial' && isLicenceGate(s.reason))

function evidenceRead(step: Step, snapshot: TenantSnapshot): boolean {
  if (!sectionRead(snapshot.sources.users)) return false
  if (step.id === 's-ladder-legacy-auth-inventory' && snapshot.sources.signInEvidence?.status !== 'ok') return false
  if (step.id === 's-ladder-global-admin-count' && snapshot.config.roleAssignments?.status !== 'ok') return false
  if (step.id === 's-ladder-global-admin-count' && snapshot.config.pimEligibility?.status !== 'ok') return false
  if (step.id === 's-ladder-authenticator-over-sms' && (snapshot.config.authMethodsPolicy?.status !== 'ok' || scopedPeople(step, snapshot).some(id => !Array.isArray(snapshot.authMethods[id])))) return false
  if ((POLICY_WORKFLOWS[step.id] || step.id === 's-shared-devices' || step.id === LEGACY_AUTH_STEP_ID) && snapshot.config.caPolicies?.status !== 'ok') return false
  if (step.id === 's-goal-guests-mfa' && snapshot.config.crossTenantAccess?.status !== 'ok') return false
  if (step.id === 's-goal-service-accounts-trusted-network' && snapshot.config.namedLocations?.status !== 'ok') return false
  if (step.id === 's-goal-device-registration-mfa' && snapshot.config.deviceRegistrationPolicy?.status !== 'ok') return false
  return true
}
export function completeManualEvidence(stepId: string, record: OwnerConfirmation | undefined, now = new Date().toISOString(), mapping?: Pick<MappingState, 'questionAnswers'>): boolean {
  if (!record || !Number.isFinite(Date.parse(record.at)) || Date.parse(record.at) > Date.parse(now)) return false
  for (const field of manualEvidenceFields(stepId, mapping).filter(f => f.required && (!f.whenOutcome || f.whenOutcome.includes(record.outcome!)))) {
    const value = record[field.key]
    if (field.type === 'checkbox' ? value !== true : Array.isArray(value) ? value.length === 0 : typeof value !== 'string' || value.trim().length === 0) return false
  }
  if (record.testedAt) {
    const day = record.testedAt.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day || day > now.slice(0, 10)) return false
  }
  return stepId === 's-ladder-guest-review' ? record.outcome === 'retained' || record.outcome === 'revoked' : record.outcome === 'passed'
}

/** Review only facts material to this task, not every scan timestamp. */
export function manualBasis(step: Step, snapshot: TenantSnapshot, mapping?: MappingState, accountCache?: Map<string, string>): string {
  if (SCOPED_MANUAL.has(step.id)) return scopedBasis(step, snapshot, mapping, undefined, accountCache)
  if (step.id === LEGACY_AUTH_STEP_ID) {
    const answer = mapping ? answerOf(mapping, QUESTION_STEP.mailDevices, 'decision') : null
    // A new answer or changed policy reopens the folded follow-up. Scan timestamps alone do not.
    return JSON.stringify([step.id, answer, mapping ? mailDevicesOf(mapping).slice().sort() : [], relevantPolicies(step, snapshot)])
  }
  if (step.id === 's-shared-devices') {
    const byId = (a: Record<string, unknown>, b: Record<string, unknown>) => String(a.id).localeCompare(String(b.id))
    const policies = relevantPolicies(step, snapshot)
    const locations = (snapshot.config.namedLocations?.rows ?? []).filter(raw => mapping?.trustedLocationIds.includes(String((raw as Record<string, unknown>).id))).map(raw => { const l = raw as Record<string, unknown>; return { id:l.id, type:l['@odata.type'], isTrusted:l.isTrusted, ipRanges:l.ipRanges } }).sort(byId)
    return JSON.stringify([step.id, [...step.population.ids].sort(), policies, locations])
  }
  const item = step.id.replace('s-ladder-', '')
  const people = snapshot.users.filter((u) => item === 'guest-review' ? u.userType === 'guest' : item === 'global-admin-count' ? (snapshot.roles.active[u.id]?.length ?? 0) > 0 : item === 'legacy-auth-inventory' ? snapshot.evidenceUsage?.legacyAuth.userIds.includes(u.id) : true)
  const users = people.map((u) => [u.id, u.accountEnabled, u.userType, null, null, null]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  const roles = Object.fromEntries(Object.entries(snapshot.roles.active).filter(([id]) => people.some((u) => u.id === id)).map(([id, rs]) => [id, [...rs].sort()]).sort(([a], [b]) => String(a).localeCompare(String(b))))
  const basis: unknown[] = [step.id, users, SCAN_REQUIRED.has(item) ? [item === 'authenticator-over-sms' ? snapshot.config.authMethodsPolicy?.rows : null, roles] : null]
  if (item === 'guest-review') basis.push(people.map(u => [u.id, u.externalUserState]).sort())
  if (item === 'legacy-auth-inventory') basis.push(Object.keys(snapshot.evidenceUsage?.legacyAuth.byDetail ?? {}).sort())
  // Preserve the persisted basis of existing manual reviews. Only this new
  // review depends on the policies that can restrict phone access.
  if (item === 'phone-access-restriction') basis.push(relevantPolicies(step, snapshot))
  return JSON.stringify(basis)
}

/**
 * The plan's population index (derive/population.ts), or, for a caller running
 * one step on its own, the directory's with the step's own active people.
 */
function indexFor(step: Step, snapshot: TenantSnapshot, index: PopulationIndex | undefined): PopulationIndex {
  return index ?? { ...populationIndex(snapshot, []), active: new Set(step.population.activeIds ?? []) }
}

/**
 * What this scan read of legacy per-user MFA, the one reading of it: the
 * accounts read as Enabled or Enforced. Finish Moving Off Per-User MFA is on the
 * plan once a scan has read one (generate.ts; progress.ts perUserMfaSeenOnAtOf),
 * and complete once none is (walk list 4.x items 9 and 54). A scan reads every
 * account's state (graph/collect/registry.ts), so the step never asks anyone to
 * check a state IAMAI reads.
 */
export function perUserMfaReading(snapshot: Pick<TenantSnapshot, 'users' | 'perUserMfa'>): { enabled: UserRow[] } {
  const byId = snapshot.perUserMfa
  return { enabled: snapshot.users.filter(u => ['enabled', 'enforced'].includes(byId?.[u.id]?.state ?? '')) }
}

/**
 * When a scan of this plan first read an account with legacy per-user MFA on
 * (PlanDecisions.perUserMfaSeenOnAt; progress.ts securityDefaultsSeenOnAtOf is its twin): the date already recorded, else this
 * scan's own time where it read one Enabled or Enforced, else null. A recorded
 * date is never replaced (walk list 4.x item 9).
 */
export function perUserMfaSeenOnAtOf(recorded: string | null | undefined, snapshot: Pick<TenantSnapshot, 'asOf' | 'users' | 'perUserMfa'>): string | null {
  if (typeof recorded === 'string' && recorded !== '') return recorded
  return perUserMfaReading(snapshot).enabled.length > 0 ? snapshot.asOf : null
}

/**
 * Every population below comes from the one builder (derive/population.ts
 * `population`, or `namedAccounts` for a step that names accounts), so the
 * admins and guests on a line are always counted over the ids its head counts.
 * Each branch built its own by hand, and the per-user MFA step read two
 * emergency accounts and seven dormant ones as "24 active people" with no
 * admin among them (R4-57).
 */
export function applyManualReviews(steps: Step[], snapshot: TenantSnapshot, confirmations: Record<string, Record<string, OwnerConfirmation>> = {}, mapping?: MappingState, index?: PopulationIndex): void {
  const accountCache = new Map<string, string>()
  // A person this names — in a finding's detail, or as an option in the account
  // picker a review is recorded with — by the one rule for naming a person
  // (names.ts personLabels): a display name another account shares carries its
  // sign-in address, and a guest among them its marker. Both used to read
  // `displayName || userPrincipalName`, so on getiamai the separate-admin-accounts
  // picker offered a bare "Kai Brown" beside a directory holding two, and
  // ManualReviewForm shows an option with no second line. Built once, on first use.
  let labels: Map<string, string> | null = null
  const labelOf = (u: { id: string; userPrincipalName?: string | null }): string => (labels ??= personLabels(snapshot.users)).get(u.id) || u.userPrincipalName || u.id
  for (const step of steps) {
    const item = step.id.replace('s-ladder-', '')
    if (!SCOPED_MANUAL.has(step.id) && !mailDevicesFollowUp(step.id, mapping) && step.id !== 's-shared-devices' && step.id !== 's-prereq-per-user-mfa' && (!step.id.startsWith('s-ladder-') || !REVIEWS.has(item))) continue
    if (step.id === 's-shared-devices' && step.state.setAside && step.doesntApply) {
      const record = confirmations[step.id]?.[MANUAL_REVIEW_ID]
      step.manualReview = { basis: manualBasis(step, snapshot, mapping, accountCache), readyToConfirm: false, confirmedAt: null, fields: [], ...(record ? { record, verification: 'historical' as const } : {}) }
      continue
    }
    const perUser = step.id === 's-prereq-per-user-mfa' || item === 'per-user-mfa-cleanup'
    if (perUser) {
      const { enabled } = perUserMfaReading(snapshot)
      // The accounts the scan read as Enabled or Enforced, active or not, the
      // emergency accounts among them: the step names them on its one card, and
      // they are its impact (namedAccounts; walk list 4.x item 55). Nothing is
      // recorded by hand: the scan reads each state, and the step is complete
      // once none reads on (item 9).
      step.population = namedAccounts(enabled.map(u => u.id), indexFor(step, snapshot, index))
      delete step.manualReview
      if (enabled.length === 0) {
        step.deliveredBy = ['The scan read legacy per-user MFA as Disabled for every account.']
        setState(step, { satisfied: true, inPlace: true })
      } else setState(step, { satisfied: false, inPlace: false })
      continue
    }
    if (item === 'guest-review' && snapshot.sources.users?.status === 'ok' && !snapshot.users.some(u => u.userType === 'guest')) {
      setState(step, { satisfied: true, inPlace: true })
      continue
    }
    if (item === 'global-admin-count' || item === 'legacy-auth-inventory') {
      const ids = scopedPeople(step, snapshot)
      // Active is the people set's reading, not "the account is enabled" — the
      // administrator-separation branch above already reads it that way, and two
      // readings of active is two denominators (V1 audit S4-21). The admins and
      // guests were carried over from the population this replaced.
      step.population = population(ids, indexFor(step, snapshot, index))
      if (item === 'global-admin-count') {
        const active = ids.filter(id => (snapshot.roles.active[id] ?? []).includes(GLOBAL_ADMIN_ROLE_ID)).length
        step.configurationFindings = [{ key: 'global-admin-scope', label: 'Global Administrator Assignments', value: `${active} active · ${ids.length - active} eligible only`, detail: 'Review the purpose of each assignment and preserve dedicated emergency access. The recommended account count is guidance, not proof that these assignments are appropriate.', outcome: evidenceRead(step, snapshot) ? 'pass' : 'unknown' }]
      }
    }
    const basis = manualBasis(step, snapshot, mapping, accountCache)
    // A record saved under the ladder's own id before its rung was merged into
    // this step still counts (finding 9): the two were one step's evidence.
    const alias = step.id === 's-check-dormant-accounts' ? 's-ladder-stale-accounts' : null
    const confirmation = confirmations[step.id]?.[MANUAL_REVIEW_ID] ?? (alias ? confirmations[alias]?.[MANUAL_REVIEW_ID] : undefined)
    // The folded mail follow-up is confirmed once the policy itself is in place,
    // as every other policy-workflow step is (finding 6): an exception cannot be
    // removed from a policy that is not there.
    const readyToConfirm = item === 'global-admin-count' ? evidenceRead(step, snapshot) : POLICY_WORKFLOWS[step.id] || mailDevicesFollowUp(step.id, mapping) ? step.state.satisfied : !SCAN_REQUIRED.has(item) || step.state.satisfied
    const confirmedAt = readyToConfirm && confirmation?.basis === basis && Date.parse(confirmation.at) <= Date.now() ? confirmation.at : null
    if (SCOPED_MANUAL.has(step.id) || mailDevicesFollowUp(step.id, mapping)) {
      const populationIds = new Set(step.population.ids)
      const fields = manualEvidenceFields(step.id, mapping).map(field => field.key === 'accountIds' ? { ...field, options: snapshot.users.filter(u => step.id === 's-ladder-guest-review' ? u.userType === 'guest' : step.id === 's-goal-pim-activation-reauth' ? u.accountEnabled && ((snapshot.roles.active[u.id]?.length ?? 0) > 0 || (snapshot.roles.eligible[u.id]?.length ?? 0) > 0) : step.population.ids.length ? populationIds.has(u.id) : true).map(u => ({ value: u.id, label: labelOf(u) })) } : field.key === 'roleIds' ? { ...field, options: [...new Map([...(snapshot.config.roleAssignments?.rows ?? []), ...(snapshot.config.pimEligibility?.rows ?? [])].flatMap(raw => { const p = raw as Record<string, any>; return p.roleDefinitionId ? [[String(p.roleDefinitionId), { value: String(p.roleDefinitionId), label: String(p.roleDefinition?.displayName ?? p.roleDefinitionId) }] as const] : [] })).values()] } : field.key === 'networkId' ? { ...field, options: (snapshot.config.namedLocations?.rows ?? []).filter(raw => Array.isArray((raw as Record<string, unknown>).ipRanges)).map(raw => { const p = raw as Record<string, unknown>; return { value: String(p.id), label: String(p.displayName ?? p.id) } }) } : field)
      const read = evidenceRead(step, snapshot)
      const complete = completeManualEvidence(step.id, confirmation, undefined, mapping)
      const people = scopedPeople(step, snapshot)
      const pendingAccountIds = POLICY_WORKFLOWS[step.id] || mailDevicesFollowUp(step.id, mapping) || step.id === 's-ladder-authenticator-over-sms' ? [] : people.filter(id => !confirmation?.accountIds?.includes(id))
      const matching = confirmation?.basis === (confirmation ? scopeManualBasis(basis, confirmation) : basis)
      let observedDefect = !readyToConfirm
      if (step.id === 's-goal-service-accounts-trusted-network' && confirmation?.networkId) {
        const network = (snapshot.config.namedLocations?.rows ?? []).find(raw => (raw as Record<string, unknown>).id === confirmation.networkId) as Record<string, unknown> | undefined
        const locations = relevantPolicies(step, snapshot).flatMap(raw => { const locations = ((raw as unknown[])[2] as Record<string, any>)?.locations; return [...(locations?.includeLocations ?? []), ...(locations?.excludeLocations ?? [])] })
        observedDefect ||= !network || !Array.isArray(network.ipRanges) || !(locations.includes(confirmation.networkId) || locations.includes('AllTrusted') && network.isTrusted === true)
      }
      if (step.id === 's-goal-pim-activation-reauth' && confirmation?.contextId) observedDefect ||= !relevantPolicies(step, snapshot).some(raw => (((raw as unknown[])[2] as Record<string, any>)?.applications?.includeAuthenticationContextClassReferences ?? []).includes(confirmation.contextId))
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
