// The lockout-scenario derivations (prompt 48 item 3; docs/design/
// lockout-scenarios.md): pure functions over the stored sign-in rows, each
// returning who, how many, and a breakdown. They run in the collection worker
// over the rows (which never leave it) and the results travel in the snapshot;
// the fixtures run the same functions over synthetic rows. Rows from a cache
// written before schema 7 carry none of the device, app or location labels,
// and the derivations that need them return nothing for those rows.
import type { StoredSignIn } from '../graph/collect/types.ts'
import firstParty from '../../data/first-party-apps.json' with { type: 'json' }

export type Derived = { people: string[]; count: number; detail: Record<string, number> }
export type PerPerson = Derived & { byPerson: Record<string, string[]> }

export type ScenarioEvidence = {
  /** Nobody typed a password: every sign-in went by PRT, Windows Hello, a passkey or a certificate. */
  passwordNotTyped: Derived
  /** Legacy client names per person: Authenticated SMTP, IMAP4, POP3, Exchange ActiveSync, other. */
  legacyClients: PerPerson
  /** ROPC or password-only sign-ins to the admin command-line tools or a custom app. */
  ropcAutomation: PerPerson
  /** Aggregated high user risk on a recent sign-in. */
  highUserRisk: Derived
  /** Non-first-party apps per person (session and frequency steps). */
  nonMicrosoftApps: PerPerson
  /** Azure Windows VM Sign-In and Remote Desktop. */
  serverSignIns: Derived
  /** Technician tools from devices that are not compliant (the Autopilot case). */
  technicianToolsOffCompliance: Derived
  /** Outlook, Teams or SharePoint from Windows devices that are neither joined nor registered (token protection). */
  unregisteredWindows: Derived
  /** Browser sign-ins without device claims; the worker keeps the people who own a compliant device. */
  browserWithoutClaims: Derived
  /** Sign-ins with an empty platform, by app. */
  emptyPlatform: Derived
  /** Service-provider (GDAP) accounts, with how many partner tenants they came from. */
  serviceProviderSignIns: Derived & { homeTenants: number }
  /** Per named location: sign-ins that matched it in the window, and which of them are trusted. */
  trustedLocationMatches: { total: number; byLocation: Record<string, number>; trusted: string[] }
  /** Guests who signed in (B2B collaboration or direct connect). */
  guestsSeen: Derived
  /** Accounts whose only sign-ins are to Teams device apps. */
  sharedDeviceOnly: Derived
  /** Phone sign-ins (iOS, Android), by person and app: the device decision is asked when any exist (E2). Absent on snapshots from before it. */
  phoneSignIns?: Derived
  /** Computer sign-ins from devices neither joined, registered, compliant nor managed, by person and app (E2). Absent on snapshots from before it. */
  unjoinedComputers?: Derived
  /** Mail and Teams sign-ins (Exchange, Outlook, Teams), by person and app: a directory-role holder among them uses the admin account for everyday work (E6). Absent on snapshots from before it. */
  officeSignIns?: PerPerson
  /** Azure management sign-ins (the Azure portal, the management API), by person and app: the people a block of the admin portals reaches beyond the admins (E9). Absent on snapshots from before it. */
  azureSignIns?: Derived
}

type App = { appId: string; displayName: string; role?: string }
const APPS = (firstParty as { apps: App[] }).apps
const APP_BY_ID = new Map(APPS.map((a) => [a.appId.toLowerCase(), a]))
export const APP_ROLE = {
  dependency: 'dependency',
  technician: 'technician tool',
  device: 'device sign-in',
  server: 'server sign-in',
} as const
export function appsWithRole(role: string): App[] {
  return APPS.filter((a) => a.role === role)
}
const roleOf = (row: StoredSignIn): string | undefined => APP_BY_ID.get((row.appId ?? '').toLowerCase())?.role
const appName = (row: StoredSignIn): string => row.appDisplayName || APP_BY_ID.get((row.appId ?? '').toLowerCase())?.displayName || row.resourceDisplayName || 'an app'
const isFirstParty = (row: StoredSignIn): boolean => APP_BY_ID.has((row.appId ?? '').toLowerCase())
/** Rows written before schema 7 carry none of the device labels; nothing device-based fires on them. */
const hasDeviceLabels = (row: StoredSignIn): boolean => row.os !== undefined
import { isPhoneOs } from './platforms.ts'

const LEGACY_LABEL: [RegExp, string][] = [
  [/authenticated smtp|^smtp$/i, 'Authenticated SMTP'],
  [/imap/i, 'IMAP4'],
  [/pop/i, 'POP3'],
  [/activesync/i, 'Exchange ActiveSync'],
]
const LEGACY_ANY = /activesync|other clients|imap4|pop3|smtp|mapi over http|exchange web services|autodiscover|exchange online powershell|offline address book|outlook anywhere|reporting web services|universal outlook/i
const PASSWORD_FREE = /hello|passkey|fido|certificate|refresh token/i
const PASSWORD = /password/i
const OFFICE_APP = /exchange|outlook|teams|sharepoint|onedrive|office/i
const BROWSER_OS = new Set(['Windows', 'macOS'])

class Acc {
  people = new Set<string>()
  count = 0
  detail: Record<string, number> = {}
  byPerson: Record<string, Set<string>> = {}
  hit(row: StoredSignIn, key: string): void {
    if (row.userId) this.people.add(row.userId)
    this.count += 1
    this.detail[key] = (this.detail[key] ?? 0) + 1
    if (row.userId) (this.byPerson[row.userId] ??= new Set()).add(key)
  }
  out(): Derived {
    return { people: [...this.people].sort(), count: this.count, detail: this.detail }
  }
  outPerPerson(): PerPerson {
    return { ...this.out(), byPerson: Object.fromEntries(Object.entries(this.byPerson).map(([u, s]) => [u, [...s].sort()])) }
  }
}

const empty = (): Derived => ({ people: [], count: 0, detail: {} })

export function passwordNotTyped(rows: Iterable<StoredSignIn>): Derived {
  const typed = new Set<string>()
  const free = new Map<string, number>()
  for (const row of rows) {
    if (!row.userId) continue
    const methods = (row.authenticationDetails ?? []).map((d) => d.authenticationMethod ?? '')
    if (methods.some((m) => PASSWORD.test(m))) typed.add(row.userId)
    else if (methods.some((m) => PASSWORD_FREE.test(m))) free.set(row.userId, (free.get(row.userId) ?? 0) + 1)
  }
  const acc = new Acc()
  for (const [u, n] of free) {
    if (typed.has(u)) continue
    acc.people.add(u)
    acc.count += n
  }
  return acc.out()
}

export function legacyClients(rows: Iterable<StoredSignIn>): PerPerson {
  const acc = new Acc()
  for (const row of rows) {
    const client = row.clientAppUsed ?? ''
    if (!LEGACY_ANY.test(client)) continue
    const label = LEGACY_LABEL.find(([re]) => re.test(client))?.[1] ?? 'other legacy clients'
    acc.hit(row, label)
  }
  return acc.outPerPerson()
}

export function ropcAutomation(rows: Iterable<StoredSignIn>): PerPerson {
  const acc = new Acc()
  for (const row of rows) {
    const ropc = (row.authenticationProtocol ?? '').toLowerCase() === 'ropc'
    const tool = roleOf(row) === APP_ROLE.technician || (!isFirstParty(row) && !!row.appDisplayName)
    const passwordOnly = row.authenticationRequirement === 'singleFactorAuthentication' && (row.authenticationDetails ?? []).some((d) => PASSWORD.test(d.authenticationMethod ?? ''))
    if (!(ropc || (tool && passwordOnly))) continue
    if (!tool) continue
    acc.hit(row, appName(row))
  }
  return acc.outPerPerson()
}

export function highUserRisk(rows: Iterable<StoredSignIn>): Derived {
  const acc = new Acc()
  for (const row of rows) if ((row.riskLevelAggregated ?? '').toLowerCase() === 'high') acc.hit(row, 'high')
  return acc.out()
}

export function nonMicrosoftApps(rows: Iterable<StoredSignIn>): PerPerson {
  const acc = new Acc()
  for (const row of rows) {
    if (isFirstParty(row) || !row.appDisplayName) continue
    acc.hit(row, row.appDisplayName)
  }
  // detail counts people per app, not sign-ins: "FortiClient VPN (2 people)".
  const perApp: Record<string, Set<string>> = {}
  for (const [u, apps] of Object.entries(acc.byPerson)) for (const a of apps) (perApp[a] ??= new Set()).add(u)
  const out = acc.outPerPerson()
  out.detail = Object.fromEntries(Object.entries(perApp).map(([a, s]) => [a, s.size]))
  return out
}

export function serverSignIns(rows: Iterable<StoredSignIn>): Derived {
  const acc = new Acc()
  for (const row of rows) if (roleOf(row) === APP_ROLE.server) acc.hit(row, appName(row))
  return acc.out()
}

export function technicianToolsOffCompliance(rows: Iterable<StoredSignIn>): Derived {
  const acc = new Acc()
  for (const row of rows) {
    if (!hasDeviceLabels(row) || roleOf(row) !== APP_ROLE.technician) continue
    if (row.isCompliant === true) continue
    acc.hit(row, appName(row))
  }
  return acc.out()
}

export function unregisteredWindows(rows: Iterable<StoredSignIn>): Derived {
  const acc = new Acc()
  for (const row of rows) {
    if (!hasDeviceLabels(row) || row.os !== 'Windows' || row.trustType !== 'none') continue
    if (!OFFICE_APP.test(`${row.appDisplayName ?? ''} ${row.resourceDisplayName ?? ''}`)) continue
    acc.hit(row, appName(row))
  }
  return acc.out()
}

/** Browser sign-ins carrying no device claims, by person; the worker keeps the people who own a compliant device. */
export function browserWithoutClaims(rows: Iterable<StoredSignIn>, compliantOwners: ReadonlySet<string> | null = null): Derived {
  const acc = new Acc()
  for (const row of rows) {
    if (!hasDeviceLabels(row) || !row.browser || !BROWSER_OS.has(row.os ?? '')) continue
    if (row.isCompliant === true || row.isManaged === true || (row.trustType ?? 'none') !== 'none') continue
    if (compliantOwners && !compliantOwners.has(row.userId)) continue
    acc.hit(row, row.browser)
  }
  return acc.out()
}

export function emptyPlatform(rows: Iterable<StoredSignIn>): Derived {
  const acc = new Acc()
  for (const row of rows) if (hasDeviceLabels(row) && row.os === '') acc.hit(row, appName(row))
  return acc.out()
}

const COMPUTER_OS = new Set(['Windows', 'macOS', 'Linux', 'ChromeOS'])

/** Phone sign-ins (iOS, Android), by person and app (E2: the device decision is asked when any exist). */
export function phoneSignIns(rows: Iterable<StoredSignIn>): Derived {
  const acc = new Acc()
  for (const row of rows) if (hasDeviceLabels(row) && isPhoneOs(row.os)) acc.hit(row, appName(row))
  return acc.out()
}

/** Computer sign-ins from devices neither joined, registered, compliant nor managed, by person and app (E2). */
export function unjoinedComputers(rows: Iterable<StoredSignIn>): Derived {
  const acc = new Acc()
  for (const row of rows) {
    if (!hasDeviceLabels(row) || !COMPUTER_OS.has(row.os ?? '')) continue
    if (row.isCompliant === true || row.isManaged === true || (row.trustType ?? 'none') !== 'none') continue
    acc.hit(row, appName(row))
  }
  return acc.out()
}

const MAIL_OR_TEAMS = /exchange|outlook|teams/i
const AZURE_APP_IDS = new Set(['c44b4083-3bb0-49c1-b47d-974e53cbdf3c', '797f4846-ba00-4fd7-ba43-dac1f8f63013'])
const AZURE_APP = /azure portal|azure service management/i

/** Mail and Teams sign-ins by person and app (E6): a legacy client counts too (it is mail). */
export function officeSignIns(rows: Iterable<StoredSignIn>): PerPerson {
  const acc = new Acc()
  for (const row of rows) {
    if (!row.userId) continue
    const label = `${row.appDisplayName ?? ''} ${row.resourceDisplayName ?? ''} ${row.clientAppUsed ?? ''}`
    if (!MAIL_OR_TEAMS.test(label) && !LEGACY_ANY.test(row.clientAppUsed ?? '')) continue
    acc.hit(row, appName(row))
  }
  return acc.outPerPerson()
}

/** Azure management sign-ins by person and app (E9): the Azure portal and the management API. */
export function azureSignIns(rows: Iterable<StoredSignIn>): Derived {
  const acc = new Acc()
  for (const row of rows) {
    const byId = AZURE_APP_IDS.has((row.appId ?? '').toLowerCase())
    if (!byId && !AZURE_APP.test(`${row.appDisplayName ?? ''} ${row.resourceDisplayName ?? ''}`)) continue
    acc.hit(row, appName(row))
  }
  return acc.out()
}

export function serviceProviderSignIns(rows: Iterable<StoredSignIn>): Derived & { homeTenants: number } {
  const acc = new Acc()
  const tenants = new Set<string>()
  for (const row of rows) {
    if (row.crossTenantAccessType !== 'serviceProvider') continue
    acc.hit(row, 'service provider')
    if (row.homeTenantId) tenants.add(row.homeTenantId)
  }
  return { ...acc.out(), homeTenants: tenants.size }
}

export function trustedLocationMatches(rows: Iterable<StoredSignIn>): ScenarioEvidence['trustedLocationMatches'] {
  const byLocation: Record<string, number> = {}
  const trusted = new Set<string>()
  let total = 0
  for (const row of rows) {
    total += 1
    for (const name of row.namedLocations ?? []) {
      byLocation[name] = (byLocation[name] ?? 0) + 1
      if (row.trustedLocation) trusted.add(name)
    }
  }
  return { total, byLocation, trusted: [...trusted].sort() }
}

export function guestsSeen(rows: Iterable<StoredSignIn>): Derived {
  const acc = new Acc()
  for (const row of rows) if (row.crossTenantAccessType === 'b2bCollaboration' || row.crossTenantAccessType === 'b2bDirectConnect') acc.hit(row, row.crossTenantAccessType)
  return acc.out()
}

export function sharedDeviceOnly(rows: Iterable<StoredSignIn>): Derived {
  const device = new Map<string, number>()
  const other = new Set<string>()
  for (const row of rows) {
    if (!row.userId) continue
    if (roleOf(row) === APP_ROLE.device) device.set(row.userId, (device.get(row.userId) ?? 0) + 1)
    else other.add(row.userId)
  }
  const acc = new Acc()
  for (const [u, n] of device) {
    if (other.has(u)) continue
    acc.people.add(u)
    acc.count += n
  }
  return acc.out()
}

/** Every derivation at once, over one pass of rows (the worker and the fixtures call this). */
export function deriveScenarioEvidence(rowsIn: Iterable<StoredSignIn>, compliantOwners: ReadonlySet<string> | null = null): ScenarioEvidence {
  const rows = [...rowsIn]
  return {
    passwordNotTyped: passwordNotTyped(rows),
    legacyClients: legacyClients(rows),
    ropcAutomation: ropcAutomation(rows),
    highUserRisk: highUserRisk(rows),
    nonMicrosoftApps: nonMicrosoftApps(rows),
    serverSignIns: serverSignIns(rows),
    technicianToolsOffCompliance: technicianToolsOffCompliance(rows),
    unregisteredWindows: unregisteredWindows(rows),
    browserWithoutClaims: browserWithoutClaims(rows, compliantOwners),
    emptyPlatform: emptyPlatform(rows),
    serviceProviderSignIns: serviceProviderSignIns(rows),
    trustedLocationMatches: trustedLocationMatches(rows),
    guestsSeen: guestsSeen(rows),
    sharedDeviceOnly: sharedDeviceOnly(rows),
    phoneSignIns: phoneSignIns(rows),
    unjoinedComputers: unjoinedComputers(rows),
    officeSignIns: officeSignIns(rows),
    azureSignIns: azureSignIns(rows),
  }
}

export function emptyScenarioEvidence(): ScenarioEvidence {
  return {
    passwordNotTyped: empty(),
    legacyClients: { ...empty(), byPerson: {} },
    ropcAutomation: { ...empty(), byPerson: {} },
    highUserRisk: empty(),
    nonMicrosoftApps: { ...empty(), byPerson: {} },
    serverSignIns: empty(),
    technicianToolsOffCompliance: empty(),
    unregisteredWindows: empty(),
    browserWithoutClaims: empty(),
    emptyPlatform: empty(),
    serviceProviderSignIns: { ...empty(), homeTenants: 0 },
    trustedLocationMatches: { total: 0, byLocation: {}, trusted: [] },
    guestsSeen: empty(),
    sharedDeviceOnly: empty(),
    phoneSignIns: empty(),
    unjoinedComputers: empty(),
    officeSignIns: { ...empty(), byPerson: {} },
    azureSignIns: empty(),
  }
}
