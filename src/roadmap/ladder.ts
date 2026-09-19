import { methodAvailability } from './methodAvailability.ts'
import type { ScopeEvidence } from './operations.ts'
// The free-tier ladder as plan steps (SPEC §12; pre-share-blockers §1).
//
// A tenant without Entra ID P1 cannot hold a Conditional Access policy, so
// every catalogue goal is licence-limited and the roadmap would be a header
// with nothing under it. This module turns data/free-tier-ladder.json into
// real steps: ordered, with a per-tenant impact from what a free licence can
// read, exact portal instructions, and a status IAMAI can prove.
//
// Nothing here asks the operator to record state. Where the tenant answers the
// question (security defaults, the methods policy, role assignments, guests),
// the step reads Done and names its evidence; where Graph does not expose the
// setting at all, the step says so and the instructions say where to look.
// Pure: no DOM, no network.
import ladderData from '../../data/free-tier-ladder.json' with { type: 'json' }
import { EXCHANGE_PLANS } from '../mapping/serviceAccounts.ts'
import type { MappingState } from '../mapping/types.ts'
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'
import { stateFields } from './lifecycle.ts'
import { STEP_EXTRAS } from './stepDefaults.ts'
import type { Step } from './types.ts'

/** Microsoft's Global Administrator role template id; stable across every tenant. */
export const GLOBAL_ADMIN_ROLE_ID = '62e90394-69f5-4237-9190-012177145e10'

/** Microsoft's guidance for permanent Global Administrators. */
export const GLOBAL_ADMIN_MIN = 2
export const GLOBAL_ADMIN_MAX = 4

export type LadderItem = { id: string; name: string; description: string; goalId?: string }

export const LADDER_ITEMS: LadderItem[] = ladderData.items as LadderItem[]

/** Ladder items an existing phase 0 step already covers; that step takes the ladder's place. */
const COVERED_BY_STEP: Record<string, string> = {
  'per-user-mfa-cleanup': 's-prereq-per-user-mfa',
}

export function ladderStepId(itemId: string): string {
  return `s-ladder-${itemId}`
}

type Facts = {
  enabledUsers: number
  adminIds: string[]
  adminNames: string[]
  globalAdminNames: string[]
  globalAdmins: number
  adminsWithMailbox: string[]
  securityDefaults: boolean | null
  migrationState: string | null
  guests: number
  pendingInvites: number
  guestNames: string[]
  unlicensedEnabled: number
  weakMethodsOn: string[]
  weakMethodsOff: boolean
  authenticatorOn: boolean
  passkeysOn: boolean
  methodsReadable: boolean
  rolesReadable: boolean
  replacement: { ids: string[]; readyIds: string[]; missingIds: string[]; unknownIds: string[]; complete: boolean }
}

function nameOf(u: UserRow): string {
  return u.displayName ?? u.userPrincipalName ?? u.id
}

const METHOD_LABEL: Record<string, string> = {
  Sms: 'Text message',
  Voice: 'Voice call',
  MicrosoftAuthenticator: 'Microsoft Authenticator',
}

export function ladderFacts(snapshot: TenantSnapshot, context: ScopeEvidence = {}): Facts {
  const byId = new Map(snapshot.users.map((u) => [u.id, u]))
  const enabled = snapshot.users.filter((u) => u.userType === 'member' && u.accountEnabled !== false)
  const active = snapshot.roles?.active ?? {}
  const adminIds = [...new Set([...Object.keys(active), ...Object.keys(snapshot.roles?.eligible ?? {})])].filter(id => byId.has(id) && ((active[id]?.length ?? 0) > 0 || (snapshot.roles?.eligible?.[id]?.length ?? 0) > 0))
  const licensed = (u: UserRow): boolean => u.assignedPlans.some((p) => p.capabilityStatus === 'Enabled')
  const hasMailbox = (u: UserRow): boolean => u.assignedPlans.some((p) => p.capabilityStatus === 'Enabled' && EXCHANGE_PLANS.has(p.servicePlanId))
  const guests = snapshot.users.filter((u) => u.userType === 'guest')

  const secRow = (snapshot.config.securityDefaults?.rows?.[0] ?? null) as { isEnabled?: boolean } | null
  const securityDefaults = snapshot.config.securityDefaults?.status === 'ok' && typeof secRow?.isEnabled === 'boolean' ? secRow.isEnabled : null

  const methodsRow = (snapshot.config.authMethodsPolicy?.rows?.[0] ?? null) as
    | { policyMigrationState?: string; authenticationMethodConfigurations?: { id?: string; state?: string }[] }
    | null
  const methodsReadable = snapshot.config.authMethodsPolicy?.status === 'ok' && methodsRow !== null
  const configs = methodsRow?.authenticationMethodConfigurations ?? []
  const stateOf = (id: string): string | null => configs.find((c) => c.id === id)?.state ?? null
  const weakMethodsOn = ['Sms', 'Voice'].filter((id) => stateOf(id) === 'enabled').map((id) => METHOD_LABEL[id] ?? id)
  const availability = methodAvailability(snapshot, context)
  const registrations = new Map(snapshot.registrationDetails.map(row => [row.id, row]))
  const replacement = { ids: enabled.map(u => u.id), readyIds: [] as string[], missingIds: [] as string[], unknownIds: [] as string[], complete: false }
  for (const id of replacement.ids) {
    const row = registrations.get(id)
    if (!row || !['ok', 'partial'].includes(snapshot.sources.registrationDetails?.status ?? '')) { replacement.unknownIds.push(id); continue }
    const methods = row.methodsRegistered.filter(m => /^(microsoftAuthenticatorPush|microsoftAuthenticatorPasswordless|fido2SecurityKey|passkey)/i.test(m))
    const readings = methods.map(method => availability.usable(id, method))
    if (row.isMfaCapable && readings.includes('yes')) replacement.readyIds.push(id)
    else if (readings.includes('unknown')) replacement.unknownIds.push(id)
    else replacement.missingIds.push(id)
  }
  replacement.complete = snapshot.sources.users?.status === 'ok' && replacement.missingIds.length === 0 && replacement.unknownIds.length === 0

  return {
    enabledUsers: enabled.length,
    rolesReadable: snapshot.sources.users?.status === 'ok' && snapshot.config.roleAssignments?.status === 'ok' && snapshot.config.pimEligibility?.status === 'ok',
    replacement,
    adminIds,
    adminNames: adminIds.map((id) => nameOf(byId.get(id) as UserRow)),
    globalAdminNames: adminIds.filter((id) => active[id]?.includes(GLOBAL_ADMIN_ROLE_ID)).map((id) => nameOf(byId.get(id) as UserRow)),
    globalAdmins: adminIds.filter((id) => active[id]?.includes(GLOBAL_ADMIN_ROLE_ID)).length,
    adminsWithMailbox: adminIds.filter((id) => hasMailbox(byId.get(id) as UserRow)).map((id) => nameOf(byId.get(id) as UserRow)),
    securityDefaults,
    migrationState: methodsReadable ? (methodsRow?.policyMigrationState ?? null) : null,
    guests: guests.length,
    pendingInvites: guests.filter((u) => u.externalUserState === 'PendingAcceptance').length,
    guestNames: guests.map(nameOf),
    unlicensedEnabled: enabled.filter((u) => !licensed(u)).length,
    weakMethodsOn,
    weakMethodsOff: ['Sms', 'Voice'].every((id) => stateOf(id) === 'disabled'),
    authenticatorOn: stateOf('MicrosoftAuthenticator') === 'enabled',
    passkeysOn: stateOf('Fido2') === 'enabled',
    methodsReadable,
  }
}

type Verdict = { done: boolean; evidence: string[] }

/**
 * Per item: whether the tenant already answers it. A Done verdict always
 * carries the evidence that satisfied it, so no step reads Done without
 * saying why.
 */
function verdictFor(itemId: string, f: Facts): Verdict {
  const not: Verdict = { done: false, evidence: [] }
  const done = (evidence: string): Verdict => ({ done: true, evidence: [evidence] })
  switch (itemId) {
    case 'security-defaults':
      return f.securityDefaults === true ? done('security defaults, which this tenant has on') : not
    case 'per-user-mfa-cleanup':
      return { done: false, evidence: [`Authentication methods migration: ${f.migrationState ?? 'not read'}. Check legacy per-user MFA separately in Entra.`] }
    case 'admin-accounts-separate':
      return { done: f.rolesReadable, evidence: f.rolesReadable ? ['Current active and eligible role assignments are readable; the separate scoped handover record determines completion.'] : [] } // Readable roles enable the scoped handover proof; mailbox licensing cannot prove account separation.
    case 'global-admin-count':
      return f.globalAdmins >= GLOBAL_ADMIN_MIN && f.globalAdmins <= GLOBAL_ADMIN_MAX ? done(`the ${f.globalAdmins} accounts holding Global Administrator, inside the two to four Microsoft recommends`) : not
    case 'guest-review':
      return f.guests === 0 ? done('a directory with no guest accounts and no unaccepted invitations') : not
    case 'authenticator-over-sms':
      return f.methodsReadable && f.weakMethodsOff && f.replacement.complete ? done('Text message and voice call are disabled, and every enabled member has a targeted, usable Authenticator or passkey registration.') : not
    default:
      return not
  }
}

export type LadderResult = {
  steps: Step[]
  /** Step id → position in the ladder, including the phase 0 steps a ladder item defers to. */
  order: Map<string, number>
}

/**
 * The ladder as steps. `existingIds` are the phase 0 steps already generated:
 * where one covers a ladder item, that step takes the ladder's place and keeps
 * the ladder's position rather than being duplicated.
 */
export function ladderSteps(snapshot: TenantSnapshot, mapping: MappingState, existingIds: Iterable<string>, context: ScopeEvidence = {}): LadderResult {
  const have = new Set(existingIds)
  const f = ladderFacts(snapshot, context)
  const steps: Step[] = []
  const order = new Map<string, number>()

  LADDER_ITEMS.forEach((item, index) => {
    const covered = COVERED_BY_STEP[item.id]
    if (covered && have.has(covered)) {
      order.set(covered, index)
      return
    }
    const v = verdictFor(item.id, f)
    const id = ladderStepId(item.id)
    order.set(id, index)
    const reviewIds = item.id === 'admin-accounts-separate' ? f.adminIds.filter(id => !mapping.breakGlassUserIds.includes(id)) : item.id === 'authenticator-over-sms' ? f.replacement.ids : []
    steps.push({
      ...STEP_EXTRAS,
      ...(item.id === 'authenticator-over-sms' ? {
        preparation: { ids: f.replacement.ids, readyIds: f.replacement.readyIds, missingIds: [...f.replacement.missingIds, ...f.replacement.unknownIds], unknownIds: f.replacement.unknownIds, guestIds: [] },
        configurationFindings: [
          { key: 'weakMethods', label: 'SMS and Voice', value: f.weakMethodsOff ? 'Disabled' : f.weakMethodsOn.length ? 'Still enabled' : 'Not fully read', detail: 'Both methods must be disabled after replacement methods are available.', outcome: f.weakMethodsOff ? 'pass' as const : f.weakMethodsOn.length ? 'fail' as const : 'unknown' as const },
          { key: 'replacementMethods', label: 'Replacement Methods', value: `${f.replacement.readyIds.length} of ${f.replacement.ids.length} accounts ready`, detail: f.replacement.unknownIds.length ? `Method targeting or registration is unread for ${f.replacement.unknownIds.length} accounts.` : f.replacement.missingIds.length ? `A usable Authenticator or passkey registration is missing for ${f.replacement.missingIds.length} accounts.` : 'Registered replacements are allowed by their current method targeting and passkey profiles.', outcome: f.replacement.complete ? 'pass' as const : f.replacement.missingIds.length ? 'fail' as const : 'unknown' as const },
        ],
      } : {}),
      id,
      goalId: item.goalId ?? item.id,
      phase: 0,
      kind: 'prerequisite',
      title: item.name,
      why: item.description,
      // A ladder rung the tenant already meets is satisfied by what it already has.
      ...stateFields(v.done ? { satisfied: true, inPlace: true } : {}),
      blockedBy: [],
      blockers: [],
      unblockNotes: [],
      population: { total: reviewIds.length, active: 0, admins: 0, guests: 0, ids: reviewIds, activeIds: [], inScope: reviewIds.length },
      readiness: { family: 'other', percent: null, lines: [] },
      evidence: { status: 'none', lines: [], affectedUserIds: [] },
      action: { kind: 'prerequisite', summary: [], json: null, portalSteps: [] },
      history: [],
      skipReason: null,
      gap: null,
      blockedReason: null,
      deliveredBy: v.evidence,
      plainTitle: item.name,
      forManager: '',
      learn: null,
    })
  })

  return { steps, order }
}
