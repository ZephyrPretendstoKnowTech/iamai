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
import { LADDER, LADDER_IMPACT, LADDER_STEPS } from '../copy/ladder.ts'
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

/** Up to NAME_LIMIT names, then a count; never an id (CLAUDE.md: names, never ids). */
function names(all: string[]): string[] {
  if (all.length <= NAME_LIMIT) return all
  return [...all.slice(0, NAME_LIMIT), LADDER_IMPACT.andMore(all.length - NAME_LIMIT)]
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

type Verdict = { done: boolean; impact: string; evidence: string[] }

/**
 * Per item: the impact sentence from this tenant's numbers, and whether the
 * tenant already answers it. A Done verdict always carries the evidence that
 * satisfied it, so no step reads Done without saying why.
 */
function verdictFor(itemId: string, f: Facts): Verdict {
  const not = (impact: string): Verdict => ({ done: false, impact, evidence: [] })
  switch (itemId) {
    case 'security-defaults':
      if (f.securityDefaults === null) return not(LADDER_IMPACT.securityDefaultsUnknown)
      return f.securityDefaults
        ? { done: true, impact: LADDER_IMPACT.securityDefaultsOn(f.enabledUsers), evidence: ['security defaults, which this tenant has on'] }
        : not(LADDER_IMPACT.securityDefaultsOff(f.enabledUsers, f.adminIds.length))
    case 'break-glass-accounts':
      return f.breakGlassNames.length >= BREAK_GLASS_TARGET
        ? { done: true, impact: LADDER_IMPACT.breakGlassDone(names(f.breakGlassNames)), evidence: [`the break-glass accounts confirmed in Setup: ${names(f.breakGlassNames).join(', ')}`] }
        : not(LADDER_IMPACT.breakGlassMissing(f.breakGlassNames.length))
    case 'legacy-auth-inventory':
      return not(LADDER_IMPACT.legacyAuth)
    case 'app-passwords':
      return not(LADDER_IMPACT.appPasswords)
    case 'per-user-mfa-cleanup':
      if (f.migrationState === null) return not(LADDER_IMPACT.perUserMfaUnknown)
      return f.migrationState === 'migrationComplete'
        ? { done: true, impact: LADDER_IMPACT.perUserMfaMigrated, evidence: ['an authentication methods migration this tenant reports as complete'] }
        : not(LADDER_IMPACT.perUserMfaOpen(f.migrationState === 'preMigration' ? 'not started' : 'in progress'))
    case 'admin-accounts-separate':
      if (f.adminIds.length === 0) return not(LADDER_IMPACT.adminsNone)
      return f.adminsWithMailbox.length === 0
        ? { done: true, impact: LADDER_IMPACT.adminsSeparate(f.adminIds.length), evidence: ['directory roles held only by accounts with no mailbox licence'] }
        : not(LADDER_IMPACT.adminsMixed(f.adminsWithMailbox.length, f.adminIds.length, names(f.adminsWithMailbox)))
    case 'global-admin-count':
      if (f.globalAdmins > GLOBAL_ADMIN_MAX) return not(LADDER_IMPACT.globalAdminsMany(f.globalAdmins, names(f.globalAdminNames)))
      if (f.globalAdmins < GLOBAL_ADMIN_MIN) return not(LADDER_IMPACT.globalAdminsFew(f.globalAdmins))
      return {
        done: true,
        impact: LADDER_IMPACT.globalAdminsOk(f.globalAdmins, names(f.globalAdminNames)),
        evidence: [`the ${f.globalAdmins} accounts holding Global Administrator, inside the two to four Microsoft recommends`],
      }
    case 'guest-review':
      return f.guests === 0
        ? { done: true, impact: LADDER_IMPACT.guestsClean, evidence: ['a directory with no guest accounts and no unaccepted invitations'] }
        : not(LADDER_IMPACT.guests(f.guests, f.pendingInvites, names(f.guestNames)))
    case 'stale-accounts':
      return not(f.unlicensedEnabled > 0 ? LADDER_IMPACT.staleUnlicensed(f.unlicensedEnabled, f.enabledUsers) : LADDER_IMPACT.staleNone)
    case 'authenticator-over-sms':
      if (!f.methodsReadable) return not(LADDER_IMPACT.methodsUnknown)
      return f.weakMethodsOn.length === 0
        ? { done: true, impact: LADDER_IMPACT.methodsWeakOff, evidence: ['an authentication methods policy with text message and voice call off'] }
        : not(LADDER_IMPACT.methodsWeakOn(f.weakMethodsOn, f.authenticatorOn))
    default:
      return not('')
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
    const copy = LADDER_STEPS[item.id]
    if (!copy) return
    const v = verdictFor(item.id, f)
    const id = ladderStepId(item.id)
    order.set(id, index)
    steps.push({
      ...STEP_EXTRAS,
      id,
      goalId: item.goalId ?? item.id,
      phase: 0,
      kind: 'prerequisite',
      title: copy.title,
      why: copy.why,
      whyAttribution: null,
      whyLink: null,
      status: v.done ? 'done' : 'ready',
      blockedBy: [],
      blockers: [],
      unblockNotes: [],
      population: { total: 0, active: 0, admins: 0, guests: 0, ids: [] },
      readiness: { family: 'other', percent: null, lines: [] },
      evidence: { status: 'none', lines: [], affectedUserIds: [], reportOnly: null },
      action: { kind: 'prerequisite', summary: copy.how, json: null, portalSteps: [], powershell: null },
      exitCriteria: copy.exit,
      rollback: LADDER.rollback,
      history: [],
      skipReason: null,
      gap: null,
      deliveredBy: v.evidence,
      stateReason: '',
      impact: v.impact,
      ladder: true,
      // The portal path from the instructions, and the tenant's own exit
      // criterion: a policy-shaped verification would name objects that do
      // not exist on this licence.
      verify: { where: [copy.how.find((h) => h.includes('→')) ?? copy.how[0]], filter: null, good: copy.exit[0] },
      whatChanges: copy.whatChanges,
      plainTitle: copy.plainTitle,
      forManager: copy.forManager,
      learn: { url: copy.learn, tldr: item.description, cis: [] },
    })
  })

  return { steps, order }
}
