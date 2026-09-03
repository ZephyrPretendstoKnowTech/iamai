// The list variables a content step renders (prompt 51 §8.9, owner: derive
// collected data, never gate it). Each {list:...} the content file uses is a
// view over what the scan already collected — the mfaViability buckets over
// authMethods + registrationDetails + sign-ins, the lockout-scenario people from
// scenarioEvidence, and the emergency/service/admin id sets — resolved to names.
//
// Pure: no DOM, no network. Runs in Node tests and in the worker.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { scoreMfaViability, rolloutBucket } from '../scoring/mfaViability.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { adminUserIds, ROLE_TEMPLATES } from '../roles.ts'
import { CORE_ADMIN_ROLE_IDS } from '../coverage/classify.ts'
import { sharedDeviceIds } from './sharedDevices.ts'
import { notActiveUsers } from './sets.ts'
import { campaignIds } from './population.ts'
import { stateOf } from './today.ts'
import type { TodayState } from './today.ts'
import { absoluteDate } from '../copy/dates.ts'

export type ListContext = {
  snapshot: TenantSnapshot
  mapping: MappingState
  nameOf: (id: string) => string
  now: string
  /** The operator's own account, so the special-care picker can include "you". */
  operatorId?: string | null
}

// The state word for the special-care picker, in the six-state model (Today §4).
const STATE_WORD: Record<TodayState, string> = {
  proven: 'Proven',
  likely: 'Likely works',
  neverPrompted: 'Never prompted',
  possiblyBroken: 'Possibly broken',
  noMethod: 'No method',
  notActive: 'Not active',
}

const roleName = (id: string): string => ROLE_TEMPLATES.find((r) => r.templateId.toLowerCase() === id.toLowerCase())?.name ?? id
const people = (ev: { people: string[] } | undefined | null): string[] => ev?.people ?? []

/**
 * Every list variable the content file can fill from this tenant, resolved to
 * names. A step reads only the keys it uses; extra keys are harmless. A list the
 * scan cannot produce is simply absent (the renderer's none-branch handles it).
 */
export function contentLists(ctx: ListContext): Record<string, string[]> {
  const { snapshot, mapping, nameOf, now } = ctx
  const svc = new Set(mapping.serviceAccountUserIds)
  const viability = buildViabilityInputs(snapshot, now, svc).map(scoreMfaViability)
  // The campaign's population (derive/population.ts): the plan's active people
  // minus the emergency and shared-device accounts (prompt 48.1 item 2).
  const bg = new Set(mapping.breakGlassUserIds)
  const campaign = new Set(campaignIds(viability, snapshot, mapping))
  const active = viability.filter((v) => campaign.has(v.userId))
  const names = (ids: readonly string[]): string[] => ids.map(nameOf)
  const scen = snapshot.scenarioEvidence ?? null

  // The registration campaign buckets (§6, the campaign step). Each person once,
  // in the first bucket that applies — the order the content lists them in.
  const noMethod = active.filter((v) => rolloutBucket(v) === 'noMethod')
  const smsOnly = active.filter((v) => v.signals.smsVoiceOnly || (v.methodTiers.length > 0 && v.methodTiers.every((t) => t === 'smsVoice')))
  const pushOnly = active.filter((v) => v.methodTiers.includes('push') && !v.methodTiers.includes('phishingResistant') && !v.methodTiers.includes('passwordless') && v.mfa !== 'verified')
  const possiblyBroken = active.filter((v) => v.mfa === 'unverified' && v.signals.observableInWindow === false)
  const unproven = active.filter((v) => rolloutBucket(v) === 'unproven')
  const bucketName = (rows: MfaViability[]): string[] => rows.map((v) => nameOf(v.userId))

  // The special-care picker (the campaign's decision): admins, anyone with no
  // method, anyone with text or call only, and the operator — each with the Today
  // state that says why. One entry per person, in that order (walk-51 item 3).
  const byId = new Map(viability.map((v) => [v.userId, v]))
  const admins = new Set(adminUserIds(snapshot.roles))
  const careIds: string[] = []
  const seen = new Set<string>()
  const addCare = (id: string): void => {
    if (id && !seen.has(id) && byId.has(id) && !bg.has(id)) {
      seen.add(id)
      careIds.push(id)
    }
  }
  for (const v of active) if (admins.has(v.userId)) addCare(v.userId)
  for (const v of noMethod) addCare(v.userId)
  for (const v of smsOnly) addCare(v.userId)
  if (ctx.operatorId) addCare(ctx.operatorId)
  const specialCare = careIds.map((id) => `${nameOf(id)} · ${STATE_WORD[stateOf(byId.get(id) as MfaViability)]}`)
  const dormant = notActiveUsers(snapshot, now, svc)
  // The ids behind the rows, in the same order, so a tick is a decision about an
  // account (prompt 52 Part 3): the picker reads `<source>Ids` beside `<source>`.
  const specialCareIds = [...careIds]

  // The lockout lists (E8): who in a step's scope has no phishing-resistant
  // method today, by name when three or fewer, as a count otherwise. The admins
  // for the admin policy; the eligible role holders for the activation policy;
  // everyone with only Authenticator approval (no passkey, no key) for the
  // risk policy, which stops them rather than prompting.
  const noPr = (v: MfaViability): boolean => !v.methodTiers.includes('phishingResistant')
  const adminsWithoutRows = active.filter((v) => admins.has(v.userId) && noPr(v))
  const eligibleRows = Object.keys(snapshot.roles.eligible ?? {}).map((id) => byId.get(id)).filter((v): v is MfaViability => v !== undefined && !bg.has(v.userId) && noPr(v))
  const pushOnlyRows = active.filter((v) => v.methodTiers.includes('push') && noPr(v) && !v.methodTiers.includes('passwordless'))
  const lockout = (rows: MfaViability[]): { names: string[]; count: number | undefined } => ({ names: rows.length <= NAMES_UP_TO ? bucketName(rows) : [], count: rows.length > NAMES_UP_TO ? rows.length : undefined })
  const adminsWithoutL = lockout(adminsWithoutRows)
  const eligibleWithoutL = lockout(eligibleRows)
  const pushOnlyL = lockout(pushOnlyRows)

  return {
    // Campaign buckets (mfaViability over collected methods + sign-ins).
    noMethod: bucketName(noMethod),
    insufficient: bucketName(smsOnly),
    pushOnly: bucketName(pushOnly),
    possiblyBroken: bucketName(possiblyBroken),
    unproven: bucketName(unproven),
    // Lockout-scenario people (scenarioEvidence, from the sign-in rows).
    legacyUsers: names(people(scen?.legacyClients)),
    serverUsers: names(people(scen?.serverSignIns)),
    ropcAccounts: names(people(scen?.ropcAutomation)),
    unmanagedUsers: names(people(scen?.browserWithoutClaims)),
    browserUsers: names(people(scen?.browserWithoutClaims)),
    guestsWithState: names(people(scen?.guestsSeen)),
    sharedDevices: names(sharedDeviceIds(snapshot)),
    // Emergency, service and admin id sets (mapping, roles).
    emergencyAccounts: names(mapping.breakGlassUserIds),
    emergencyAccountUpns: mapping.breakGlassUserIds.map((id) => upnOf(snapshot, id) ?? nameOf(id)),
    serviceAccounts: names(mapping.serviceAccountUserIds),
    adminNames: names([...adminUserIds(snapshot.roles)]),
    coreAdminRoles: [...CORE_ADMIN_ROLE_IDS].map(roleName),
    eligible: names(Object.keys(snapshot.roles.eligible)),
    // The special-care picker rows ("name · state"), and their ids.
    specialCare,
    specialCareIds,
    // The dormant accounts (no sign-in for 90 days, or none on record) with their
    // state, for the problematic-accounts check (walk of f3d140b): the state is
    // the last sign-in date, or the content example's own "no sign-in on record".
    accountsWithState: dormant.map((u) => `${nameOf(u.id)} · ${u.lastSuccessfulSignIn ? absoluteDate(u.lastSuccessfulSignIn) : 'no sign-in on record'}`),
    accountsWithStateIds: dormant.map((u) => u.id),
    // Directory-role holders who read mail or join Teams on the same account (E6),
    // with the apps: the separate-accounts step lists them, and the admin policies
    // name them beside the step. The emergency accounts are not everyday accounts.
    adminsWithWorkload: adminsWithWorkloadOf(snapshot, bg).map(([id, apps]) => `${nameOf(id)} · ${apps.join(', ')}`),
    adminsWithWorkloadIds: adminsWithWorkloadOf(snapshot, bg).map(([id]) => id),
    // The lockout lists (E8), by name when three or fewer; the count line stands in otherwise.
    adminsWithout: adminsWithoutL.names,
    eligibleWithout: eligibleWithoutL.names,
    pushOnlyUsers: pushOnlyL.names,
    ...(counts({ adminsWithoutCount: adminsWithoutL.count, eligibleWithoutCount: eligibleWithoutL.count, pushOnlyCount: pushOnlyL.count, pushOnlyTotal: pushOnlyRows.length > 0 ? pushOnlyRows.length : undefined }) as Record<string, string[]>),
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
  return [...adminUserIds(snapshot.roles)].filter((id) => users.has(id) && !exclude.has(id) && (office.byPerson[id] ?? []).length > 0).map((id) => [id, office.byPerson[id]])
}

function upnOf(snapshot: TenantSnapshot, id: string): string | undefined {
  const u = snapshot.users.find((x) => (x as { id?: string }).id === id) as { userPrincipalName?: string } | undefined
  return u?.userPrincipalName
}
