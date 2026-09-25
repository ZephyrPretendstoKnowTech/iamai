// The list variables a content step renders (prompt 51 §8.9, owner: derive
// collected data, never gate it). Each {list:...} the content file uses is a
// view over what the scan already collected — the mfaViability buckets over
// authMethods + registrationDetails + sign-ins, the lockout-scenario people from
// scenarioEvidence, and the emergency/service/admin id sets — resolved to names.
//
// Pure: no DOM, no network. Runs in Node tests and in the worker.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { READINESS_STATES, isReady } from '../scoring/phishingResistant.ts'
import type { ReadinessState } from '../scoring/phishingResistant.ts'
import { ADMIN_ROLE_IDS, adminUserIds, ROLE_TEMPLATES } from '../roles.ts'
import { CORE_ADMIN_ROLE_IDS } from '../coverage/classify.ts'
import { sharedDeviceIds } from './sharedDevices.ts'
import { notActiveUsers, notPeopleIds, lastSuccessOf } from './sets.ts'
import { ladder } from './ladder.ts'
import { riskIds } from '../roadmap/evidence.ts'
import { mailDevicesOf } from '../roadmap/answers.ts'
import { absoluteDate } from '../copy/dates.ts'
import { pages, stepById } from '../content/content.ts'

/** Disable or Confirm Dormant Accounts' keep words (steps[s-check-dormant-accounts].keep). */
const DORMANT_KEEP = (stepById['s-check-dormant-accounts'] as unknown as { keep: { kept: string } }).keep

export type ListContext = {
  snapshot: TenantSnapshot
  mapping: MappingState
  nameOf: (id: string) => string
  now: string
  /** Require MFA for Everyone in place (stepVars planDates): the unproven bucket is empty. */
  mfaInPlace?: boolean
}

const roleName = (id: string): string => ROLE_TEMPLATES.find((r) => r.templateId.toLowerCase() === id.toLowerCase())?.name ?? id
const people = (ev: { people: string[] } | undefined | null): string[] => ev?.people ?? []

/**
 * The people Require MFA for Everyone would prompt for the first time: they hold
 * a method it accepts and have no MFA sign-in in the records. With the policy in
 * place every sign-in completes MFA, so nobody is. One rule, read by the list
 * below and by the policy's pitfall card (ui/surfaces/pitfalls.ts).
 */
export function unprovenIdsOf(ctx: Pick<ListContext, 'snapshot' | 'mapping' | 'now' | 'mfaInPlace'>): string[] {
  if (ctx.mfaInPlace === true) return []
  const l = ladder(ctx.snapshot, ctx.mapping, ctx.now)
  return READINESS_STATES.flatMap((s) => l.states[s].map((p) => p.viability)).filter((v) => v.mfaCapable && v.mfa !== 'verified').map((v) => v.userId)
}

/**
 * Every list variable the content file can fill from this tenant, resolved to
 * names. A step reads only the keys it uses; extra keys are harmless. A list the
 * scan cannot produce is simply absent (the renderer's none-branch handles it).
 */
export function contentLists(ctx: ListContext): Record<string, string[]> {
  const { snapshot, mapping, nameOf, now } = ctx
  // The emergency and service accounts are not people (sets.ts notPeopleIds): the one population.
  const svc = notPeopleIds(mapping)
  // The partition (derive/ladder.ts) scores the people once and counts the
  // campaign's population by readiness state, so the campaign step's numbers are
  // the facts MFA Readiness shows (derive/facts.ts).
  const l = ladder(snapshot, mapping, now)
  const viability = [...l.viability.values()]
  const bg = new Set(mapping.breakGlassUserIds)
  const active = READINESS_STATES.flatMap((s) => l.states[s].map((p) => p.viability))
  const names = (ids: readonly string[]): string[] => ids.map(nameOf)
  const scen = snapshot.scenarioEvidence ?? null
  /** The accounts this directory holds as guests: the population a guest policy is written against. */
  const guestIds = new Set(snapshot.users.filter((u) => u.userType === 'guest').map((u) => u.id))

  // The registration campaign's groups are MFA Readiness's states: each person
  // once. Needs setup splits in two, because somebody with no method at all
  // needs a way in before they can register anything.
  const inState = (s: ReadinessState): MfaViability[] => l.states[s].map((p) => p.viability)
  // Prompt 62: no usable phishing-resistant method (Needs a method, or blocked by a
  // tenant setting) is the old Needs setup; a method not confirmed everywhere they
  // sign in (Confirm it, Needs a device) is the old Needs proof.
  const noMethod = active.filter((v) => (v.readiness.state === 'method' || v.readiness.state === 'blocked') && !v.mfaCapable)
  const needsSetup = [...inState('method'), ...inState('blocked')].filter((v) => v.mfaCapable)
  const needsProof = [...inState('confirm'), ...inState('device')]
  const readinessUnknown = inState('unknown')
  // Ordinary MFA, for the policy that requires it: a method, and no MFA sign-in
  // in the records. With Require MFA for Everyone in place every sign-in
  // completes MFA, so nobody is in it.
  const unprovenIds = unprovenIdsOf(ctx)
  const bucketName = (rows: MfaViability[]): string[] => rows.map((v) => nameOf(v.userId))

  const byId = new Map(viability.map((v) => [v.userId, v]))
  const admins = new Set(adminUserIds(snapshot.roles))
  const dormant = notActiveUsers(snapshot, now, svc)

  // The readiness lists these steps name (E8): who among a set of people is not
  // yet Ready for phishing-resistant MFA (scoring/phishingResistant.ts), by name
  // when three or fewer and as a count otherwise. A question about people and
  // their readiness — never a reading of what a policy does. What a step's own
  // policies would stop rather than prompt is a different question with a
  // different answer, and only the operation answers it (roadmap/lockout.ts
  // lockoutCount, the row's own count).
  const notYetAtTopRung = (ids: readonly string[]): { names: string[]; count: number | undefined; total: number } => {
    const below = ids.filter((id) => {
      const v = byId.get(id)
      return v !== undefined && v.activity === 'active' && !bg.has(id) && !isReady(v.readiness.state)
    })
    return { names: below.length <= NAMES_UP_TO ? names(below) : [], count: below.length > NAMES_UP_TO ? below.length : undefined, total: below.length }
  }
  const adminsWithoutL = notYetAtTopRung([...admins])
  const eligibleWithoutL = notYetAtTopRung(Object.keys(snapshot.roles?.eligible ?? {}))
  // The risk policy stops, rather than prompts, whoever has only Authenticator
  // approval: no passkey, no key, nothing passwordless.
  const pushOnlyL = ((): { names: string[]; count: number | undefined; total: number } => {
    const only = viability
      .filter((v) => v.activity === 'active' && !bg.has(v.userId) && v.methodTiers.includes('push') && !v.methodTiers.includes('phishingResistant') && !v.methodTiers.includes('passwordless'))
      .map((v) => v.userId)
    return { names: only.length <= NAMES_UP_TO ? names(only) : [], count: only.length > NAMES_UP_TO ? only.length : undefined, total: only.length }
  })()

  // The usage a block would stop (E9), by person, with the sign-in counts the
  // lines name: device code, authentication transfer, sign-ins with no platform
  // (and the apps they came from), sign-ins from outside the allowed countries,
  // and Azure sign-ins by people with no directory role.
  const usage = snapshot.evidenceUsage
  const platform = scen?.emptyPlatform
  const allowed = new Set(mapping.allowedCountries.map((c) => c.toUpperCase()))
  const outside = Object.entries(snapshot.signInEvidence ?? {}).filter(([id, e]) => byId.has(id) && !bg.has(id) && (e.countries ?? []).some((c) => !allowed.has(c.toUpperCase()))).map(([id]) => id)
  const azureNonAdmins = (scen?.azureSignIns?.people ?? []).filter((id) => byId.has(id) && !admins.has(id) && !bg.has(id))

  return {
    // The campaign's groups, by readiness state (derive/ladder.ts), and the ordinary-MFA list.
    noMethod: bucketName(noMethod),
    needsSetup: bucketName(needsSetup),
    needsProof: bucketName(needsProof),
    readinessUnknown: bucketName(readinessUnknown),
    unproven: names(unprovenIds),
    // Lockout-scenario people (scenarioEvidence, from the sign-in rows).
    legacyUsers: names(people(scen?.legacyClients)),
    // The mail accounts named in Confirm What You Use's mail-sending answer:
    // Block Legacy Authentication completes once none of them signs in with
    // legacy authentication (walk list 4.x item 4, roadmap/blockSignIns.ts).
    mailAccounts: names(mailDevicesOf(mapping)),
    serverUsers: names(people(scen?.serverSignIns)),
    ropcAccounts: names(people(scen?.ropcAutomation)),
    unmanagedUsers: names(people(scen?.browserWithoutClaims)),
    browserUsers: names(people(scen?.browserWithoutClaims)),
    // Who a guest policy reaches: the accounts the directory holds as guests,
    // and no others. A cross-tenant sign-in is evidence of a route, not of an
    // account's type, and on a tenant with no guests at all it named a member of
    // staff as a guest the policy would reach (R4). Where the two disagree the
    // directory decides, because that is what the policy is written against.
    guestsWithState: names(people(scen?.guestsSeen).filter((id) => guestIds.has(id))),
    // Outlook, Teams or SharePoint from Windows devices that are neither joined
    // nor registered (derive/evidence.ts unregisteredWindows): the people the
    // token-protection step's claim is about. Until this was read from the
    // evidence the list was never produced at all, so the step's other branch —
    // "Everyone on Windows signs in from a joined or registered device" — stood
    // on every tenant, whatever its records said.
    unboundUsers: names(people(scen?.unregisteredWindows)),
    sharedDevices: names(sharedDeviceIds(snapshot)),
    // Emergency, service and admin id sets (mapping, roles).
    emergencyAccounts: names(mapping.breakGlassUserIds),
    emergencyAccountUpns: mapping.breakGlassUserIds.map((id) => upnOf(snapshot, id) ?? nameOf(id)),
    serviceAccounts: names(mapping.serviceAccountUserIds),
    // The admins the campaign's note names: the people among the role holders. A
    // service principal holds a role but is never a person; the emergency accounts
    // are not people (sets.ts notPeopleIds); byId holds the person accounts.
    adminNames: names([...adminUserIds(snapshot.roles)].filter((id) => byId.has(id))),
    // The admins the campaign still waits on (prompt 62): active, not an emergency account, and not Ready.
    adminsNotReady: names([...admins].filter((id) => { const v = byId.get(id); return v !== undefined && v.activity === 'active' && !bg.has(id) && !isReady(v.readiness.state) })),
    coreAdminRoles: [...CORE_ADMIN_ROLE_IDS].map(roleName),
    eligible: names(Object.keys(snapshot.roles.eligible).filter((id) => byId.has(id))),
    // The dormant accounts (no sign-in for 90 days, or none on record) with their
    // state, for the problematic-accounts check (walk of f3d140b): the state is
    // the last sign-in date, or the content example's own "no sign-in on record".
    // An account the person keeps says so (walk list item 33), so a briefing tells a kept account from one still to disable or keep.
    accountsWithState: dormant.map((u) => { const last = lastSuccessOf(snapshot, u); return [nameOf(u.id), last ? absoluteDate(last) : 'no sign-in on record', ...(mapping.dormantAccountChoices?.[u.id]?.outcome === 'keep' ? [DORMANT_KEEP.kept] : [])].join(' · ') }),
    accountsWithStateIds: dormant.map((u) => u.id),
    // Directory-role holders who read mail or join Teams on the same account (E6),
    // with the apps: the separate-accounts step lists them, and the admin policies
    // name them beside the step. The emergency accounts are not everyday accounts.
    adminsWithWorkload: adminsWithWorkloadOf(snapshot, bg).map(([id, apps]) => `${nameOf(id)} · ${apps.join(', ')}`),
    adminsWithWorkloadIds: adminsWithWorkloadOf(snapshot, bg).map(([id]) => id),
    // The readiness lists (E8), by name when three or fewer; the count line stands in otherwise.
    adminsWithout: adminsWithoutL.names,
    eligibleWithout: eligibleWithoutL.names,
    pushOnlyUsers: pushOnlyL.names,
    ...(counts({ adminsWithoutCount: adminsWithoutL.count, eligibleWithoutCount: eligibleWithoutL.count, pushOnlyCount: pushOnlyL.count, pushOnlyTotal: pushOnlyL.total > 0 ? pushOnlyL.total : undefined }) as Record<string, string[]>),
    // The usage a block would stop (E9).
    deviceCodeUsers: names(usage?.deviceCode.userIds ?? []),
    transferUsers: names(usage?.authTransfer.userIds ?? []),
    // The risk steps' people. This is the sign-in log's own verdict on a
    // sign-in (graph/collect/laneBCore.ts riskLevelOf, which reads `hidden` and
    // any unknown value as unknown rather than as none), never Identity
    // Protection's risky-users report: the scan holds no risk-report scope. The
    // union rule is roadmap/evidence.ts riskIds, the same one the reach counts.
    riskyUsers: names(riskIds([usage?.riskHigh])),
    mediumRiskUsers: names(riskIds([usage?.riskMedium, usage?.riskHigh])),
    noPlatformUsers: names(platform?.people ?? []),
    outsideUsers: names(outside),
    azureNonAdmins: names(azureNonAdmins),
    ...(counts({ deviceCodeCount: usage?.deviceCode.count || undefined, transferCount: usage?.authTransfer.count || undefined, noPlatformCount: platform?.count || undefined }) as Record<string, string[]>),
    ...(platform && platform.count > 0 ? { apps: Object.keys(platform.detail).join(', ') as unknown as string[] } : {}),
  }
}

/** Names are listed up to this many; a longer list is a count (E8). */
export const NAMES_UP_TO = 3

/** The count variables that are filled, as the list record's shape allows (a number reads as a value; an absent one gates its line off). */
function counts(values: Record<string, number | undefined>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined))
}

/** Each directory-role holder with mail or Teams sign-ins on the same account, with the apps seen (E6). */
export function adminsWithWorkloadOf(snapshot: TenantSnapshot, exclude: ReadonlySet<string> = new Set()): [string, string[]][] {
  const office = snapshot.scenarioEvidence?.officeSignIns
  if (!office) return []
  const users = new Set(snapshot.users.map((u) => u.id))
  const active = adminUserIds(snapshot.roles)
  const eligible = adminUserIds({ active: snapshot.roles.eligible ?? {} })
  return [...new Set([...active, ...eligible])].filter((id) => users.has(id) && !exclude.has(id) && (office.byPerson[id] ?? []).length > 0).map((id) => [id, active.has(id) ? office.byPerson[id] : office.byPerson[id].map(app => `${app} (eligible administrator)`)] )
}

/**
 * The admin roles one account holds, as the scan read them: active, and
 * eligible through Privileged Identity Management, each the role's template id.
 * Only roles in the admin catalogue (roles.ts ADMIN_ROLE_IDS), the ones that make
 * the account an admin: these are what Use Separate Accounts for Admin Work
 * moves to a separate admin account, and once they are off the everyday account
 * it is no longer an admin (walk list item 2).
 */
export function adminRolesOf(snapshot: TenantSnapshot, id: string): { active: string[]; eligible: string[] } {
  const admin = (roles: readonly string[] | undefined): string[] => [...new Set((roles ?? []).filter((r) => ADMIN_ROLE_IDS.has(r.toLowerCase())))]
  const active = admin(snapshot.roles.active[id])
  return { active, eligible: admin(snapshot.roles.eligible?.[id]).filter((r) => !active.includes(r)) }
}

/** The mail and Teams apps one account signed in to in the scan's sign-in window, as the sign-in records name them (E6). */
export function officeAppsOf(snapshot: TenantSnapshot, id: string): string[] {
  return [...new Set(snapshot.scenarioEvidence?.officeSignIns?.byPerson[id] ?? [])]
}

function upnOf(snapshot: TenantSnapshot, id: string): string | undefined {
  const u = snapshot.users.find((x) => (x as { id?: string }).id === id) as { userPrincipalName?: string } | undefined
  return u?.userPrincipalName
}
