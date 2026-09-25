// A person's answer, applied to the baseline's policy (E1, E2): the recorded
// deviations from the pinned baseline, each shown beside the baseline's version
// on the step. The partner answer excludes the Service provider type from the
// guests and countries policies; the device decision scopes the compliant-device
// policy to the platforms the business manages. One rule for every reader: the
// JSON the engine builds (generate.ts buildCreateAction) and the portal lines
// the step renders (stepPortal.ts) both pass the policy through here, so the
// download and the screen can never disagree.
//
// A deviation narrows a policy or defers it; it never weakens a grant for good
// (the tool helps with strictness and never requires it): the risk policy's
// first-enforcement rung (E8) defers the baseline's strength to plain MFA while
// people still have only Authenticator approval, and the baseline's version
// stays beside it on the step. Pure: no DOM, no network.
import type { MappingState } from '../mapping/types.ts'
import { COMPUTER_PLATFORMS, PHONE_PLATFORMS, answerOf, devicePlanOf, deviceScopeOf, serviceProvidersExcluded } from './answers.ts'
import { stepIdForGoal } from './stepIds.ts'
import { answeredReasonOf, phonesOf, savedAnswerOf } from './directionAnswers.ts'
import { serviceAccountIdsOf } from '../derive/sets.ts'
import { effectOf } from './operations.ts'

type RawPolicy = Record<string, unknown>

/** The goals whose policy the partner answer applies to: guests, and the countries block. */
export const SERVICE_PROVIDER_GOALS = new Set(['guests-mfa', 'geo-restriction'])
/** The goal whose policy the device decision scopes by platform. */
export const COMPLIANT_DEVICE_GOAL = 'require-managed-device'
/** The goal the app-protection half of the device decision applies to (phones protected by their apps). */
export const APP_PROTECTION_GOAL = 'mobile-app-protection'
/** The goal that follows the compliant-device policy's fate. */
export const INTUNE_ENROLMENT_GOAL = 'intune-enrollment-reauth'
/** Every goal the device decision touches. */
export const DEVICE_GOALS = new Set([COMPLIANT_DEVICE_GOAL, APP_PROTECTION_GOAL, INTUNE_ENROLMENT_GOAL])
/** The goal whose first enforcement may be plain MFA (E8): the high-risk sign-in policy. */
export const SIGN_IN_RISK_GOAL = 'sign-in-risk'

/** True when the risk policy's first enforcement is the plain-MFA rung (the decision's second option). */
export function plainMfaFirst(mapping: Pick<MappingState, 'questionAnswers'>): boolean {
  const a = answerOf(mapping, stepIdForGoal(SIGN_IN_RISK_GOAL), 'decision')
  return a !== null && a.index === 1
}

/** The policy's grant as plain multifactor authentication: the strength is deferred, not removed from the baseline. */
function plainMfaGrant(body: RawPolicy): RawPolicy {
  const grant = { ...((body.grantControls ?? {}) as RawPolicy) }
  grant.operator = 'OR'
  grant.builtInControls = ['mfa']
  delete grant.authenticationStrength
  return { ...body, grantControls: grant }
}

const SERVICE_PROVIDER = 'serviceProvider'

/** The policy with the Service provider type excluded (and out of the include list where the baseline includes it). */
function excludeServiceProviders(body: RawPolicy): RawPolicy {
  const conditions = { ...((body.conditions ?? {}) as RawPolicy) }
  const users = { ...((conditions.users ?? {}) as RawPolicy) }
  const include = users.includeGuestsOrExternalUsers as { guestOrExternalUserTypes?: string } | null | undefined
  if (include && typeof include.guestOrExternalUserTypes === 'string') {
    const kept = include.guestOrExternalUserTypes.split(',').map((t) => t.trim()).filter((t) => t.length > 0 && t.toLowerCase() !== SERVICE_PROVIDER.toLowerCase())
    users.includeGuestsOrExternalUsers = { ...include, guestOrExternalUserTypes: kept.join(',') }
  }
  users.excludeGuestsOrExternalUsers = { guestOrExternalUserTypes: SERVICE_PROVIDER, externalTenants: { membershipKind: 'all' } }
  conditions.users = users
  return { ...body, conditions }
}

/** The platforms the device decision leaves out of the compliant-device policy; empty when it leaves the baseline as it is. */
export function excludedPlatforms(mapping: Pick<MappingState, 'questionAnswers'>): string[] {
  const plan = devicePlanOf(mapping)
  if (!plan) return []
  const scope = deviceScopeOf(plan)
  return [...(scope.phones ? [] : PHONE_PLATFORMS), ...(scope.computers ? [] : COMPUTER_PLATFORMS)]
}

/** The policy scoped away from the platforms the business does not manage: an exclude on the device platforms condition. */
function excludePlatforms(body: RawPolicy, platforms: string[]): RawPolicy {
  const conditions = { ...((body.conditions ?? {}) as RawPolicy) }
  const prev = (conditions.platforms ?? null) as { includePlatforms?: string[]; excludePlatforms?: string[] } | null
  const include = prev?.includePlatforms && prev.includePlatforms.length > 0 ? prev.includePlatforms : ['all']
  const exclude = [...new Set([...(prev?.excludePlatforms ?? []), ...platforms])]
  conditions.platforms = { includePlatforms: include, excludePlatforms: exclude }
  return { ...body, conditions }
}

/** The answers the service-accounts exclusion reads (serviceAccountsExclusionDue). */
type AccountAnswers = Pick<MappingState, 'questionAnswers' | 'workflowAnswers' | 'facetOverrides' | 'serviceAccountUserIds' | 'sharedDeviceUserIds' | 'wizardAnswered' | 'assumed' | 'trustedLocationIds'>

/**
 * Whether Identify Service and Shared Accounts' answers take the
 * service-accounts group out of Jon's policies that ask a person for something
 * (owner, 2026-09-24, Phase 2a). The group holds the confirmed service accounts
 * and the shared-device accounts (derive/sets.ts serviceAccountIdsOf); Jon's
 * naming guide describes his CA-ServiceAccounts as "excluded from user-based
 * MFA or device-based CA policies", and his Block Service Accounts keeps them to
 * the trusted network. So only while there is a trusted network to keep them
 * to: with everyone working remotely, leaving them out would leave them
 * nothing at all.
 */
export function serviceAccountsExclusionDue(mapping: AccountAnswers): boolean {
  return serviceAccountIdsOf(mapping).length > 0 && savedAnswerOf('officeNetwork', mapping)?.value !== 'remote'
}

/**
 * A policy that asks a person for something at sign-in: a sign-in method, or a
 * fresh sign-in on a schedule, for all users, on the apps they sign in to. A
 * block is left as it is, and so is a policy that reaches only admins or
 * guests, or that acts on a user action or an authentication context
 * (registering security info or a device, activating a role), which a service
 * or room account never does.
 */
export function asksAPerson(body: RawPolicy | null | undefined): boolean {
  if (!body || typeof body !== 'object') return false
  const conditions = (body.conditions ?? {}) as { users?: { includeUsers?: unknown }; applications?: { includeUserActions?: unknown; includeAuthenticationContextClassReferences?: unknown } }
  const users = conditions.users
  const all = Array.isArray(users?.includeUsers) && users.includeUsers.some((u) => String(u).toLowerCase() === 'all')
  if (!all) return false
  const apps = conditions.applications
  const listed = (v: unknown): boolean => Array.isArray(v) && v.length > 0
  if (listed(apps?.includeUserActions) || listed(apps?.includeAuthenticationContextClassReferences)) return false
  const e = effectOf(body)
  return !e.blocks && (e.asksForMethod || e.sessionControls?.signInFrequency === true)
}

/** The policy with one more group left out. */
function excludeGroup(body: RawPolicy, groupId: string): RawPolicy {
  const conditions = { ...((body.conditions ?? {}) as RawPolicy) }
  const users = { ...((conditions.users ?? {}) as RawPolicy) }
  const excluded = Array.isArray(users.excludeGroups) ? (users.excludeGroups as string[]) : []
  if (excluded.some((g) => g.toLowerCase() === groupId.toLowerCase())) return body
  users.excludeGroups = [...excluded, groupId]
  conditions.users = users
  return { ...body, conditions }
}

/**
 * The goal's policy with every recorded deviation the mapping's answers call
 * for; the body untouched when none applies. The caller shows each changed
 * line beside the baseline's version. `serviceAccountsGroupId` is the tenant's
 * service-accounts group, where the plan has one: a policy that asks a person
 * for something leaves it out while the 2.2 answers call for it
 * (serviceAccountsExclusionDue); with no group yet, the caller holds the policy
 * on the step that makes it.
 */
export function applyDeviations(body: RawPolicy, goalId: string, mapping: Pick<MappingState, 'questionAnswers'> & Partial<AccountAnswers>, serviceAccountsGroupId: string | null = null): RawPolicy {
  let out = body
  if (SERVICE_PROVIDER_GOALS.has(goalId) && serviceProvidersExcluded(mapping)) out = excludeServiceProviders(out)
  if (goalId === COMPLIANT_DEVICE_GOAL) {
    const platforms = excludedPlatforms(mapping)
    if (platforms.length > 0) out = excludePlatforms(out, platforms)
  }
  if (goalId === SIGN_IN_RISK_GOAL && plainMfaFirst(mapping)) out = plainMfaGrant(out)
  if (serviceAccountsGroupId && mapping.serviceAccountUserIds && serviceAccountsExclusionDue(mapping as AccountAnswers) && asksAPerson(out)) out = excludeGroup(out, serviceAccountsGroupId)
  return out
}

/**
 * The device steps the answer sends to the footer, with the answer as the
 * reason (E2): the compliant-device policy when no platform is left in it (and
 * the Intune-enrolment step with it), the app-protection policy unless phones
 * are protected by their apps. Null while the step applies, or while the
 * decision is open (the steps wait on it instead). The reason is the answer as
 * Decide How and Where People Sign In shows it (directionAnswers.ts
 * answeredReasonOf): computers Unmanaged for the first two, since phones are
 * out of that policy unless enrolled; the phones answer for app protection.
 */
export function deviceStepDoesntApply(goalId: string, mapping: Pick<MappingState, 'questionAnswers'>): string | null {
  const plan = devicePlanOf(mapping)
  if (!plan) return null
  const scope = deviceScopeOf(plan)
  if (goalId === COMPLIANT_DEVICE_GOAL || goalId === INTUNE_ENROLMENT_GOAL) return !scope.phones && !scope.computers ? answeredReasonOf('computers', 'unmanaged') : null
  if (goalId === APP_PROTECTION_GOAL) return (plan.phoneAppProtection === 'required' || (!plan.phoneAppProtection && plan.phones === 'apps')) && !plan.noWorkPhones ? null : answeredReasonOf('phones', phonesOf(mapping) ?? '')
  return null
}
