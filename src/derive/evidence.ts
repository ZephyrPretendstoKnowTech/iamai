// The lockout-scenario derivations (prompt 48 item 3; docs/design/
// lockout-scenarios.md): pure functions over the stored sign-in rows, each
// returning who, how many, and a breakdown. They run in the collection worker
// over the rows (which never leave it) and the results travel in the snapshot;
// the fixtures run the same functions over synthetic rows. Rows from a cache
// written before schema 7 carry none of the device, app or location labels,
// and the derivations that need them return nothing for those rows.
import type { StoredSignIn } from '../graph/collect/types.ts'
import firstParty from '../../data/first-party-apps.json' with { type: 'json' }
import { FACET_APPS } from '../coverage/facetApps.ts'
import { foldAll } from './rowFold.ts'
import type { RowFold } from './rowFold.ts'

export type Derived = {
  people: string[]
  count: number
  detail: Record<string, number>
}
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
  /** Computer sign-ins from devices neither joined, registered, compliant nor managed, by person and app (E2). Absent on snapshots from before it. */
  unjoinedComputers?: Derived
  /**
   * Computer sign-ins from devices REGISTERED to the tenant, by person and app.
   *
   * Registered is not joined. Entra has three trust types and only two of them
   * are a join, so a registered computer is exactly what the device question is
   * asking about: making it Managed means joining and enrolling it, which is
   * work. `unjoinedComputers` counts devices with no trust at all, and stating
   * that number alone under the words "computers that aren't joined" made a
   * fleet of 2,339 read as 3 — which turns a quarter of work into a Tuesday
   * afternoon. Absent on snapshots from before it.
   */
  registeredComputers?: Derived
  /** Mail and Teams sign-ins (Exchange, Outlook, Teams), by person and app: a directory-role holder among them uses the admin account for everyday work (E6). Absent on snapshots from before it. */
  officeSignIns?: PerPerson
  /** Azure management sign-ins (the Azure portal, the management API), by person and app: the people a block of the admin portals reaches beyond the admins (E9). Absent on snapshots from before it. */
  azureSignIns?: Derived
  /** How many accounts signed in to each service's apps (coverage/facetApps.ts), by facet: Confirm What You Use's evidence. Absent on snapshots from before it. */
  serviceSignIns?: Record<string, number>
  /** The accounts behind serviceSignIns, by facet, so Confirm What You Use counts only the plan's people. Absent on snapshots from before it. */
  serviceSignInIds?: Record<string, string[]>
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

/** A fold that hits one accumulator per matching record, and reads it out at the end. */
function accFold<T>(hit: (row: StoredSignIn, acc: Acc) => void, out: (acc: Acc) => T): RowFold<T> {
  const acc = new Acc()
  return { add: (row) => hit(row, acc), finish: () => out(acc) }
}

export function passwordNotTypedFold(): RowFold<Derived> {
  const typed = new Set<string>()
  const free = new Map<string, number>()
  return {
    add(row) {
      if (!row.userId) return
      const methods = (row.authenticationDetails ?? []).map((d) => d.authenticationMethod ?? '')
      if (methods.some((m) => PASSWORD.test(m))) typed.add(row.userId)
      else if (methods.some((m) => PASSWORD_FREE.test(m))) free.set(row.userId, (free.get(row.userId) ?? 0) + 1)
    },
    finish() {
      const acc = new Acc()
      for (const [u, n] of free) {
        if (typed.has(u)) continue
        acc.people.add(u)
        acc.count += n
      }
      return acc.out()
    },
  }
}
export function passwordNotTyped(rows: Iterable<StoredSignIn>): Derived {
  return foldAll(passwordNotTypedFold(), rows)
}

export function legacyClientsFold(): RowFold<PerPerson> {
  return accFold((row, acc) => {
    const client = row.clientAppUsed ?? ''
    if (!LEGACY_ANY.test(client)) return
    const label = LEGACY_LABEL.find(([re]) => re.test(client))?.[1] ?? 'other legacy clients'
    acc.hit(row, label)
  }, (acc) => acc.outPerPerson())
}
export function legacyClients(rows: Iterable<StoredSignIn>): PerPerson {
  return foldAll(legacyClientsFold(), rows)
}

export function ropcAutomationFold(): RowFold<PerPerson> {
  return accFold((row, acc) => {
    const ropc = (row.authenticationProtocol ?? '').toLowerCase() === 'ropc'
    const tool = roleOf(row) === APP_ROLE.technician || (!isFirstParty(row) && !!row.appDisplayName)
    const passwordOnly = row.authenticationRequirement === 'singleFactorAuthentication' && (row.authenticationDetails ?? []).some((d) => PASSWORD.test(d.authenticationMethod ?? ''))
    if (!(ropc || (tool && passwordOnly))) return
    if (!tool) return
    acc.hit(row, appName(row))
  }, (acc) => acc.outPerPerson())
}
export function ropcAutomation(rows: Iterable<StoredSignIn>): PerPerson {
  return foldAll(ropcAutomationFold(), rows)
}

export function highUserRiskFold(): RowFold<Derived> {
  return accFold((row, acc) => {
    if ((row.riskLevelAggregated ?? '').toLowerCase() === 'high') acc.hit(row, 'high')
  }, (acc) => acc.out())
}
export function highUserRisk(rows: Iterable<StoredSignIn>): Derived {
  return foldAll(highUserRiskFold(), rows)
}

export function nonMicrosoftAppsFold(): RowFold<PerPerson> {
  return accFold((row, acc) => {
    if (isFirstParty(row) || !row.appDisplayName) return
    acc.hit(row, row.appDisplayName)
  }, (acc) => {
    // detail counts people per app, not sign-ins: "FortiClient VPN (2 people)".
    const perApp: Record<string, Set<string>> = {}
    for (const [u, apps] of Object.entries(acc.byPerson)) for (const a of apps) (perApp[a] ??= new Set()).add(u)
    const out = acc.outPerPerson()
    out.detail = Object.fromEntries(Object.entries(perApp).map(([a, s]) => [a, s.size]))
    return out
  })
}
export function nonMicrosoftApps(rows: Iterable<StoredSignIn>): PerPerson {
  return foldAll(nonMicrosoftAppsFold(), rows)
}

export function serverSignInsFold(): RowFold<Derived> {
  return accFold((row, acc) => {
    if (roleOf(row) === APP_ROLE.server) acc.hit(row, appName(row))
  }, (acc) => acc.out())
}
export function serverSignIns(rows: Iterable<StoredSignIn>): Derived {
  return foldAll(serverSignInsFold(), rows)
}

export function technicianToolsOffComplianceFold(): RowFold<Derived> {
  return accFold((row, acc) => {
    if (!hasDeviceLabels(row) || roleOf(row) !== APP_ROLE.technician) return
    if (row.isCompliant === true) return
    acc.hit(row, appName(row))
  }, (acc) => acc.out())
}
export function technicianToolsOffCompliance(rows: Iterable<StoredSignIn>): Derived {
  return foldAll(technicianToolsOffComplianceFold(), rows)
}

export function unregisteredWindowsFold(): RowFold<Derived> {
  return accFold((row, acc) => {
    if (!hasDeviceLabels(row) || row.os !== 'Windows' || row.trustType !== 'none') return
    if (!OFFICE_APP.test(`${row.appDisplayName ?? ''} ${row.resourceDisplayName ?? ''}`)) return
    acc.hit(row, appName(row))
  }, (acc) => acc.out())
}
export function unregisteredWindows(rows: Iterable<StoredSignIn>): Derived {
  return foldAll(unregisteredWindowsFold(), rows)
}

/** Browser sign-ins carrying no device claims, by person; the worker keeps the people who own a compliant device. */
export function browserWithoutClaimsFold(compliantOwners: ReadonlySet<string> | null = null): RowFold<Derived> {
  return accFold((row, acc) => {
    if (!hasDeviceLabels(row) || !row.browser || !BROWSER_OS.has(row.os ?? '')) return
    if (row.isCompliant === true || row.isManaged === true || (row.trustType ?? 'none') !== 'none') return
    if (compliantOwners && !compliantOwners.has(row.userId)) return
    acc.hit(row, row.browser)
  }, (acc) => acc.out())
}
export function browserWithoutClaims(rows: Iterable<StoredSignIn>, compliantOwners: ReadonlySet<string> | null = null): Derived {
  return foldAll(browserWithoutClaimsFold(compliantOwners), rows)
}

export function emptyPlatformFold(): RowFold<Derived> {
  return accFold((row, acc) => {
    if (hasDeviceLabels(row) && row.os === '') acc.hit(row, appName(row))
  }, (acc) => acc.out())
}
export function emptyPlatform(rows: Iterable<StoredSignIn>): Derived {
  return foldAll(emptyPlatformFold(), rows)
}

const COMPUTER_OS = new Set(['Windows', 'macOS', 'Linux', 'ChromeOS'])

// Who signed in from a phone is not tallied here. It was, and a person read on
// their own after a partial bulk read reached their record and never this
// tally, so the device question said no phone was seen beside a phone MFA
// Readiness showed (NEW-Nadia-D4). derive/sets.ts phoneSignInIds reads the
// records MFA Readiness reads.

/** Computer sign-ins from devices neither joined, registered, compliant nor managed, by person and app (E2). */
export function unjoinedComputersFold(): RowFold<Derived> {
  return accFold((row, acc) => {
    if (!hasDeviceLabels(row) || !COMPUTER_OS.has(row.os ?? '')) return
    if (row.isCompliant === true || row.isManaged === true || (row.trustType ?? 'none') !== 'none') return
    acc.hit(row, appName(row))
  }, (acc) => acc.out())
}
export function unjoinedComputers(rows: Iterable<StoredSignIn>): Derived {
  return foldAll(unjoinedComputersFold(), rows)
}

/** Computer sign-ins from devices registered to the tenant but not joined, by person and app. */
export function registeredComputersFold(): RowFold<Derived> {
  return accFold((row, acc) => {
    if (!hasDeviceLabels(row) || !COMPUTER_OS.has(row.os ?? '')) return
    if (row.trustType !== 'registered') return
    acc.hit(row, appName(row))
  }, (acc) => acc.out())
}
export function registeredComputers(rows: Iterable<StoredSignIn>): Derived {
  return foldAll(registeredComputersFold(), rows)
}

const MAIL_OR_TEAMS = /exchange|outlook|teams/i
const AZURE_APP_IDS = new Set(['c44b4083-3bb0-49c1-b47d-974e53cbdf3c', '797f4846-ba00-4fd7-ba43-dac1f8f63013'])
const AZURE_APP = /azure portal|azure service management/i

/** Mail and Teams sign-ins by person and app (E6): a legacy client counts too (it is mail). */
export function officeSignInsFold(): RowFold<PerPerson> {
  return accFold((row, acc) => {
    if (!row.userId) return
    const label = `${row.appDisplayName ?? ''} ${row.resourceDisplayName ?? ''} ${row.clientAppUsed ?? ''}`
    if (!MAIL_OR_TEAMS.test(label) && !LEGACY_ANY.test(row.clientAppUsed ?? '')) return
    acc.hit(row, appName(row))
  }, (acc) => acc.outPerPerson())
}
export function officeSignIns(rows: Iterable<StoredSignIn>): PerPerson {
  return foldAll(officeSignInsFold(), rows)
}

/** Azure management sign-ins by person and app (E9): the Azure portal and the management API. */
export function azureSignInsFold(): RowFold<Derived> {
  return accFold((row, acc) => {
    const byId = AZURE_APP_IDS.has((row.appId ?? '').toLowerCase())
    if (!byId && !AZURE_APP.test(`${row.appDisplayName ?? ''} ${row.resourceDisplayName ?? ''}`)) return
    acc.hit(row, appName(row))
  }, (acc) => acc.out())
}
export function azureSignIns(rows: Iterable<StoredSignIn>): Derived {
  return foldAll(azureSignInsFold(), rows)
}

/**
 * The accounts that signed in to each service, matched the way the usage
 * detection matches its app summary (coverage/applicability.ts): the app's id,
 * or its name. Counts only; the ids stay in the worker.
 */
export function serviceSignInsFold(): RowFold<Record<string, number>> {
  const ids = serviceSignInIdsFold()
  return { add: (row) => ids.add(row), finish: () => Object.fromEntries(Object.entries(ids.finish()).map(([facet, list]) => [facet, list.length])) }
}

/** The accounts that signed in to each service, by facet (see serviceSignInsFold). */
export function serviceSignInIdsFold(): RowFold<Record<string, string[]>> {
  const specs = Object.entries(FACET_APPS).map(([facet, spec]) => ({ facet, ids: new Set(spec.ids.map((id) => id.toLowerCase())), name: spec.namePattern }))
  const people = new Map<string, Set<string>>()
  return {
    add(row) {
      if (!row.userId) return
      const id = (row.appId ?? '').toLowerCase()
      for (const s of specs) {
        if (!s.ids.has(id) && !(row.appDisplayName && s.name.test(row.appDisplayName))) continue
        let set = people.get(s.facet)
        if (!set) people.set(s.facet, (set = new Set()))
        set.add(row.userId)
      }
    },
    finish: () => Object.fromEntries(specs.map((s) => [s.facet, [...(people.get(s.facet) ?? [])]])),
  }
}

export function serviceProviderSignInsFold(): RowFold<Derived & { homeTenants: number }> {
  const tenants = new Set<string>()
  return accFold((row, acc) => {
    if (row.crossTenantAccessType !== 'serviceProvider') return
    acc.hit(row, 'service provider')
    if (row.homeTenantId) tenants.add(row.homeTenantId)
  }, (acc) => ({ ...acc.out(), homeTenants: tenants.size }))
}
export function serviceProviderSignIns(rows: Iterable<StoredSignIn>): Derived & { homeTenants: number } {
  return foldAll(serviceProviderSignInsFold(), rows)
}

export function trustedLocationMatchesFold(): RowFold<ScenarioEvidence['trustedLocationMatches']> {
  const byLocation: Record<string, number> = {}
  const trusted = new Set<string>()
  let total = 0
  return {
    add(row) {
      total += 1
      for (const name of row.namedLocations ?? []) {
        byLocation[name] = (byLocation[name] ?? 0) + 1
        if (row.trustedLocation) trusted.add(name)
      }
    },
    finish: () => ({ total, byLocation, trusted: [...trusted].sort() }),
  }
}
export function trustedLocationMatches(rows: Iterable<StoredSignIn>): ScenarioEvidence['trustedLocationMatches'] {
  return foldAll(trustedLocationMatchesFold(), rows)
}

export function guestsSeenFold(): RowFold<Derived> {
  return accFold((row, acc) => {
    if (row.crossTenantAccessType === 'b2bCollaboration' || row.crossTenantAccessType === 'b2bDirectConnect') acc.hit(row, row.crossTenantAccessType)
  }, (acc) => acc.out())
}
export function guestsSeen(rows: Iterable<StoredSignIn>): Derived {
  return foldAll(guestsSeenFold(), rows)
}

export function sharedDeviceOnlyFold(): RowFold<Derived> {
  const device = new Map<string, number>()
  const other = new Set<string>()
  return {
    add(row) {
      if (!row.userId) return
      if (roleOf(row) === APP_ROLE.device) device.set(row.userId, (device.get(row.userId) ?? 0) + 1)
      else other.add(row.userId)
    },
    finish() {
      const acc = new Acc()
      for (const [u, n] of device) {
        if (other.has(u)) continue
        acc.people.add(u)
        acc.count += n
      }
      return acc.out()
    },
  }
}
export function sharedDeviceOnly(rows: Iterable<StoredSignIn>): Derived {
  return foldAll(sharedDeviceOnlyFold(), rows)
}

type ScenarioFolds = { [K in keyof Required<ScenarioEvidence>]: RowFold<Required<ScenarioEvidence>[K]> }

/** Every derivation at once, one record at a time (the sign-in read folds each page into this). */
export function scenarioFold(compliantOwners: ReadonlySet<string> | null = null): RowFold<ScenarioEvidence> {
  // The key order is the snapshot's: it is what the scenario evidence serialises as.
  const folds: ScenarioFolds = {
    passwordNotTyped: passwordNotTypedFold(),
    legacyClients: legacyClientsFold(),
    ropcAutomation: ropcAutomationFold(),
    highUserRisk: highUserRiskFold(),
    nonMicrosoftApps: nonMicrosoftAppsFold(),
    serverSignIns: serverSignInsFold(),
    technicianToolsOffCompliance: technicianToolsOffComplianceFold(),
    unregisteredWindows: unregisteredWindowsFold(),
    browserWithoutClaims: browserWithoutClaimsFold(compliantOwners),
    emptyPlatform: emptyPlatformFold(),
    serviceProviderSignIns: serviceProviderSignInsFold(),
    trustedLocationMatches: trustedLocationMatchesFold(),
    guestsSeen: guestsSeenFold(),
    sharedDeviceOnly: sharedDeviceOnlyFold(),
    unjoinedComputers: unjoinedComputersFold(),
    registeredComputers: registeredComputersFold(),
    officeSignIns: officeSignInsFold(),
    azureSignIns: azureSignInsFold(),
    serviceSignIns: serviceSignInsFold(),
    serviceSignInIds: serviceSignInIdsFold(),
  }
  const all: RowFold<unknown>[] = Object.values(folds)
  return {
    add(row) {
      for (const fold of all) fold.add(row)
    },
    finish: () => Object.fromEntries(Object.entries(folds).map(([key, fold]) => [key, fold.finish()])) as ScenarioEvidence,
  }
}

/** Every derivation at once, over one pass of rows (the fixtures call this). */
export function deriveScenarioEvidence(rowsIn: Iterable<StoredSignIn>, compliantOwners: ReadonlySet<string> | null = null): ScenarioEvidence {
  return foldAll(scenarioFold(compliantOwners), rowsIn)
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
    unjoinedComputers: empty(),
    registeredComputers: empty(),
    officeSignIns: { ...empty(), byPerson: {} },
    azureSignIns: empty(),
    serviceSignIns: {},
    serviceSignInIds: {},
  }
}
