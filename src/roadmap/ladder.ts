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
import { STEP_EXTRAS } from './stepDefaults.ts'
import type { Step } from './types.ts'

/** Microsoft's Global Administrator role template id; stable across every tenant. */
export const GLOBAL_ADMIN_ROLE_ID = '62e90394-69f5-4237-9190-012177145e10'

/** Break-glass guidance is two accounts: one can be lost without losing the way back in. */
export const BREAK_GLASS_TARGET = 2
/** Microsoft's guidance for permanent Global Administrators. */
export const GLOBAL_ADMIN_MIN = 2
export const GLOBAL_ADMIN_MAX = 4
/** Above this many names a sentence counts instead of listing. */
const NAME_LIMIT = 5

export type LadderItem = { id: string; name: string; description: string; goalId?: string }

export const LADDER_ITEMS: LadderItem[] = ladderData.items as LadderItem[]

/** Ladder items an existing phase 0 step already covers; that step takes the ladder's place. */
const COVERED_BY_STEP: Record<string, string> = {
  'break-glass-accounts': 's-prereq-break-glass',
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
  breakGlassNames: string[]
  migrationState: string | null
  guests: number
  pendingInvites: number
  guestNames: string[]
  unlicensedEnabled: number
  weakMethodsOn: string[]
  authenticatorOn: boolean
  methodsReadable: boolean
}

function nameOf(u: UserRow): string {
  return u.displayName ?? u.userPrincipalName ?? u.id
}

/** Up to NAME_LIMIT names; never an id (CLAUDE.md: names, never ids). */
function names(all: string[]): string[] {
  return all.slice(0, NAME_LIMIT)
}

const METHOD_LABEL: Record<string, string> = {
  Sms: 'Text message',
  Voice: 'Voice call',
  MicrosoftAuthenticator: 'Microsoft Authenticator',
}

export function ladderFacts(snapshot: TenantSnapshot, mapping: MappingState): Facts {
  const byId = new Map(snapshot.users.map((u) => [u.id, u]))
  const enabled = snapshot.users.filter((u) => u.userType === 'member' && u.accountEnabled !== false)
  const active = snapshot.roles?.active ?? {}
  const adminIds = Object.keys(active).filter((id) => byId.has(id))
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

  return {
    enabledUsers: enabled.length,
    adminIds,
    adminNames: adminIds.map((id) => nameOf(byId.get(id) as UserRow)),
    globalAdminNames: adminIds.filter((id) => active[id]?.includes(GLOBAL_ADMIN_ROLE_ID)).map((id) => nameOf(byId.get(id) as UserRow)),
    globalAdmins: adminIds.filter((id) => active[id]?.includes(GLOBAL_ADMIN_ROLE_ID)).length,
    adminsWithMailbox: adminIds.filter((id) => hasMailbox(byId.get(id) as UserRow)).map((id) => nameOf(byId.get(id) as UserRow)),
    securityDefaults,
    breakGlassNames: mapping.breakGlassUserIds.map((id) => (byId.has(id) ? nameOf(byId.get(id) as UserRow) : id)).filter((n) => !/^[0-9a-f-]{36}$/i.test(n)),
    migrationState: methodsReadable ? (methodsRow?.policyMigrationState ?? null) : null,
    guests: guests.length,
    pendingInvites: guests.filter((u) => u.externalUserState === 'PendingAcceptance').length,
    guestNames: guests.map(nameOf),
    unlicensedEnabled: enabled.filter((u) => !licensed(u)).length,
    weakMethodsOn,
    authenticatorOn: stateOf('MicrosoftAuthenticator') === 'enabled',
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
    case 'break-glass-accounts':
      return f.breakGlassNames.length >= BREAK_GLASS_TARGET ? done(`the break-glass accounts confirmed in Setup: ${names(f.breakGlassNames).join(', ')}`) : not
    case 'per-user-mfa-cleanup':
      return f.migrationState === 'migrationComplete' ? done('an authentication methods migration this tenant reports as complete') : not
    case 'admin-accounts-separate':
      return f.adminIds.length > 0 && f.adminsWithMailbox.length === 0 ? done('directory roles held only by accounts with no mailbox licence') : not
    case 'global-admin-count':
      return f.globalAdmins >= GLOBAL_ADMIN_MIN && f.globalAdmins <= GLOBAL_ADMIN_MAX ? done(`the ${f.globalAdmins} accounts holding Global Administrator, inside the two to four Microsoft recommends`) : not
    case 'guest-review':
      return f.guests === 0 ? done('a directory with no guest accounts and no unaccepted invitations') : not
    case 'authenticator-over-sms':
      return f.methodsReadable && f.weakMethodsOn.length === 0 ? done('an authentication methods policy with text message and voice call off') : not
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
export function ladderSteps(snapshot: TenantSnapshot, mapping: MappingState, existingIds: Iterable<string>): LadderResult {
  const have = new Set(existingIds)
  const f = ladderFacts(snapshot, mapping)
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
    steps.push({
      ...STEP_EXTRAS,
      id,
      goalId: item.goalId ?? item.id,
      phase: 0,
      kind: 'prerequisite',
      title: item.name,
      why: item.description,
      status: v.done ? 'done' : 'ready',
      blockedBy: [],
      blockers: [],
      unblockNotes: [],
      population: { total: 0, active: 0, admins: 0, guests: 0, ids: [], activeIds: [], inScope: 0 },
      readiness: { family: 'other', percent: null, lines: [] },
      evidence: { status: 'none', lines: [], affectedUserIds: [], reportOnly: null },
      action: { kind: 'prerequisite', summary: [], json: null, portalSteps: [], powershell: null },
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
