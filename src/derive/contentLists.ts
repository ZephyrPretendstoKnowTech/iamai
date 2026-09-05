// The list variables a content step renders (prompt 51 §8.9, owner: derive
// collected data, never gate it). Each {list:...} the content file uses is a
// view over what the scan already collected — the mfaViability buckets over
// authMethods + registrationDetails + sign-ins, the lockout-scenario people from
// scenarioEvidence, and the emergency/service/admin id sets — resolved to names.
//
// Pure: no DOM, no network. Runs in Node tests and in the worker.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import { rolloutBucket } from '../scoring/mfaViability.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { adminUserIds, ROLE_TEMPLATES } from '../roles.ts'
import { CORE_ADMIN_ROLE_IDS } from '../coverage/classify.ts'
import { sharedDeviceIds } from './sharedDevices.ts'
import { notActiveUsers, notPeopleIds } from './sets.ts'
import { RUNGS, ladder, rungOf } from './ladder.ts'
import type { Rung } from './ladder.ts'
import { absoluteDate } from '../copy/dates.ts'
import { pages } from '../content/content.ts'

export type ListContext = {
  snapshot: TenantSnapshot
  mapping: MappingState
  nameOf: (id: string) => string
  now: string
  /** Require MFA for Everyone in place (stepVars planDates): the unproven bucket is empty. */
  mfaInPlace?: boolean
}

// The readiness word for the special-care picker: the rung's title (pages.ladder), or Not active (pages.today.show).
type LadderWords = { rungs: Record<`r${Rung}`, { title: string }> }
const rungTitle = (rung: Rung): string => (pages.ladder as unknown as LadderWords).rungs[`r${rung}`].title
const stateWord = (v: MfaViability): string => (v.activity === 'active' ? rungTitle(rungOf(v)) : (pages.today as { show: { notActive: string } }).show.notActive)

const roleName = (id: string): string => ROLE_TEMPLATES.find((r) => r.templateId.toLowerCase() === id.toLowerCase())?.name ?? id
const people = (ev: { people: string[] } | undefined | null): string[] => ev?.people ?? []

/**
 * Every list variable the content file can fill from this tenant, resolved to
 * names. A step reads only the keys it uses; extra keys are harmless. A list the
 * scan cannot produce is simply absent (the renderer's none-branch handles it).
 */
export function contentLists(ctx: ListContext): Record<string, string[]> {
  const { snapshot, mapping, nameOf, now } = ctx
  // The emergency and service accounts are not people (sets.ts notPeopleIds): the one population.
  const svc = notPeopleIds(mapping)
  // The ladder (derive/ladder.ts) scores the people once and counts the
  // campaign's population on its rungs: the groups here are its rungs, so the
  // campaign step's numbers are the facts every surface shows (derive/facts.ts).
  const l = ladder(snapshot, mapping, now)
  const viability = [...l.viability.values()]
  const bg = new Set(mapping.breakGlassUserIds)
  const active = RUNGS.flatMap((r) => l.rungs[r].map((p) => p.viability))
  const names = (ids: readonly string[]): string[] => ids.map(nameOf)
  const scen = snapshot.scenarioEvidence ?? null

  // The registration campaign's groups are the ladder's rungs: each person
  // once, on their rung. With Require MFA for Everyone in place every sign-in
  // completes MFA, so nobody is asked for one MFA sign-in: the rung-2 group is
  // empty under the policy (Today keeps stating the records' fact).
  const onRung = (rung: Rung): MfaViability[] => l.rungs[rung].map((p) => p.viability)
  const noMethod = onRung(1)
  const unproven = ctx.mfaInPlace === true ? [] : onRung(2)
  const smsOnly = active.filter((v) => v.signals.smsVoiceOnly || (v.methodTiers.length > 0 && v.methodTiers.every((t) => t === 'smsVoice')))
  const bucketName = (rows: MfaViability[]): string[] => rows.map((v) => nameOf(v.userId))

  // The special-care picker (the campaign's decision): admins, anyone with no
  // method, anyone with text or call only, each with the Today state that says
  // why. One entry per person, in that order (walk-51 item 3). Never the
  // signed-in account for being signed in: the plan does not depend on who ran the scan.
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
  const specialCare = careIds.map((id) => `${nameOf(id)} · ${stateWord(byId.get(id) as MfaViability)}`)
  const dormant = notActiveUsers(snapshot, now, svc)
  // The ids behind the rows, in the same order, so a tick is a decision about an
  // account (prompt 52 Part 3): the picker reads `<source>Ids` beside `<source>`.
  const specialCareIds = [...careIds]

  // The readiness lists these steps name (E8): who among a set of people is not
  // yet at Passkey or security key, proven (derive/ladder.ts rung 5), by name
  // when three or fewer and as a count otherwise. A question about people and
  // the rung they are on — never a reading of what a policy does. What a step's
  // own policies would stop rather than prompt is a different question with a
  // different answer, and only the operation answers it (roadmap/lockout.ts
  // lockoutCount, the row's own count).
  const notYetAtTopRung = (ids: readonly string[]): { names: string[]; count: number | undefined; total: number } => {
    const below = ids.filter((id) => {
      const v = byId.get(id)
      return v !== undefined && v.activity === 'active' && !bg.has(id) && rungOf(v) !== 5
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
    // The campaign's groups, by rung (derive/ladder.ts).
    noMethod: bucketName(noMethod),
    unproven: bucketName(unproven),
    rung3: bucketName(onRung(3)),
    rung4: bucketName(onRung(4)),
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
    // The admins the campaign's note names: the people among the role holders. A
    // service principal holds a role but is never a person; the emergency accounts
    // are not people (sets.ts notPeopleIds); byId holds the person accounts.
    adminNames: names([...adminUserIds(snapshot.roles)].filter((id) => byId.has(id))),
    coreAdminRoles: [...CORE_ADMIN_ROLE_IDS].map(roleName),
    eligible: names(Object.keys(snapshot.roles.eligible).filter((id) => byId.has(id))),
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
    // The readiness lists (E8), by name when three or fewer; the count line stands in otherwise.
    adminsWithout: adminsWithoutL.names,
    eligibleWithout: eligibleWithoutL.names,
    pushOnlyUsers: pushOnlyL.names,
    ...(counts({ adminsWithoutCount: adminsWithoutL.count, eligibleWithoutCount: eligibleWithoutL.count, pushOnlyCount: pushOnlyL.count, pushOnlyTotal: pushOnlyL.total > 0 ? pushOnlyL.total : undefined }) as Record<string, string[]>),
    // The usage a block would stop (E9).
    deviceCodeUsers: names(usage?.deviceCode.userIds ?? []),
    transferUsers: names(usage?.authTransfer.userIds ?? []),
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
  return [...adminUserIds(snapshot.roles)].filter((id) => users.has(id) && !exclude.has(id) && (office.byPerson[id] ?? []).length > 0).map((id) => [id, office.byPerson[id]])
}

function upnOf(snapshot: TenantSnapshot, id: string): string | undefined {
  const u = snapshot.users.find((x) => (x as { id?: string }).id === id) as { userPrincipalName?: string } | undefined
  return u?.userPrincipalName
}
