// The Inventory's tables, once (prompt 49 Part 2; Phase 2 audit): one pure
// model per table, holding its rows and, for every column, the header and the
// words its cells say. The Inventory surface draws these models, adding only
// chips and links around the same words, and the Export CSV card writes them,
// so a file named iamai-devices.csv says the same thing from either place.
// There used to be two builders: this one wrote raw Graph keys ("Fido2",
// "enabledForReportingButNotEnforced", "ServerAd") and read a compliance Graph
// did not report as "no", while the surface wrote words under the same file
// names. Pure: no DOM, no network.
import type { DeviceRow, TenantSnapshot, UserRow } from '../../graph/collect/types.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import type { PolicyFacts } from '../../coverage/types.ts'
import type { ResolvedObject } from '../../graph/collect/onDemand.ts'
import { buildNameDirectory } from '../../names.ts'
import type { NameDirectory } from '../../names.ts'
import { policyFacts } from '../../coverage/facts.ts'
import { buildStrengthLookup } from '../../coverage/strength.ts'
import { detectFacets } from '../../coverage/applicability.ts'
import { buildViabilityInputs } from '../../scoring/fromSnapshot.ts'
import { scoreMfaViability } from '../../scoring/mfaViability.ts'
import type { MfaViability } from '../../scoring/mfaViability.ts'
import { CAPABILITIES, deriveTenantCapabilities, deriveUserCapabilities } from '../../licensing/capabilities.ts'
import { ROLE_TEMPLATES, coversAdminSet, heldOnlyByServices, roleLabel, roleName, roleTemplate } from '../../roles.ts'
import productNames from '../../../data/product-names.json' with { type: 'json' }
import { INVENTORY as C, combinationName, methodName, protocolName, trustTypeName } from '../../copy/inventory.ts'
import { ACTIVITY_STATE, METHOD_TIER, MFA_STATE } from '../../copy/definitions.ts'
import { app } from '../../content/content.ts'
import { absoluteDate } from '../format.ts'

/** A table as a file: what the Export CSV card downloads. */
export type InventoryTable = { id: string; label: string; csvName: string; header: string[]; rows: (string | number)[][] }

/** One column: its header and the words each cell says (the screen draws them; the CSV writes them). */
export type InventoryColumn<R> = {
  key: string
  header: string
  cell: (r: R) => string | number
  sort?: (r: R) => string | number
  /** Written to the CSV, never drawn: a fact the screen shows another way. */
  hidden?: boolean
  minWidth?: string
}

/** One table: its rows, its columns, and what it says when it has no rows. */
export type InventoryModel<R> = {
  id: string
  label: string
  csvName: string
  rows: R[]
  columns: InventoryColumn<R>[]
  rowKey: (r: R) => string
  empty?: string
}

/** The file a model writes: every column with a cell, hidden ones included, in the model's order. */
export function tableOf<R>(m: InventoryModel<R>): InventoryTable {
  return { id: m.id, label: m.label, csvName: m.csvName, header: m.columns.map((c) => c.header), rows: m.rows.map((r) => m.columns.map((c) => c.cell(r))) }
}

type Raw = Record<string, unknown>
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))

// ---------- Policies ----------

/** Every policy the scan read, as the coverage engine reads it. */
export function policyFactsOf(snapshot: TenantSnapshot, rows: unknown[] = snapshot.config.caPolicies?.rows ?? []): PolicyFacts[] {
  const strengths = buildStrengthLookup(snapshot.config.authStrengths?.rows ?? [])
  const managed = snapshot.microsoftManagedPolicyIds ?? []
  return rows.map((p) => policyFacts(p, strengths, managed.includes(str((p as Raw).id))))
}

function usersSummary(f: PolicyFacts): string {
  const P = C.policies
  const bits: string[] = []
  if (f.who.all) bits.push(P.allUsers)
  if (f.who.groups.size > 0) bits.push(P.groups(f.who.groups.size))
  if (f.who.roles.size > 0) bits.push(coversAdminSet(f.who.roles) ? P.allAdminRoles(f.who.roles.size) : P.roles(f.who.roles.size))
  if (f.who.users.size > 0) bits.push(P.users(f.who.users.size))
  if (f.who.guests !== null && !f.who.all) bits.push(P.guests)
  if (f.workload) bits.push(P.workload(f.workload.sps.size))
  return bits.join(', ') || P.none
}

/** The Exclusions column (E5): the groups and users the policy excludes, by name; guests when the whole type is. */
export function exclusionsSummary(f: PolicyFacts, label: (id: string) => string): string {
  const P = C.policies
  const bits = [...[...f.whoNot.groups].map(label), ...[...f.whoNot.users].map(label)]
  if (f.whoNot.guests) bits.push(P.guests)
  return bits.join(', ') || '—'
}

/** The Users column's tooltip: the names behind the counts. */
export function usersDetail(f: PolicyFacts, label: (id: string) => string): string {
  const parts: string[] = []
  if (f.who.users.size > 0) parts.push([...f.who.users].map(label).join(', '))
  if (f.who.groups.size > 0) parts.push([...f.who.groups].map(label).join(', '))
  if (f.who.roles.size > 0 && !coversAdminSet(f.who.roles)) parts.push([...f.who.roles].map(roleLabel).join(', '))
  return parts.join('\n')
}

function appsSummary(f: PolicyFacts): string {
  const P = C.policies
  const bits: string[] = []
  if (f.apps.all) bits.push(P.allApps)
  if (f.apps.office365) bits.push(P.office365)
  if (f.apps.adminPortals) bits.push(P.adminPortals)
  if (f.apps.ids.size > 0) bits.push(P.apps(f.apps.ids.size))
  for (const a of f.apps.userActions) bits.push(P.userActions(a))
  if (f.apps.authContexts.size > 0) bits.push(P.authContexts(f.apps.authContexts.size))
  return bits.join(', ') || P.none
}

function conditionsSummary(f: PolicyFacts, label: (id: string) => string): string {
  const P = C.policies
  const bits: string[] = []
  if (f.clientApps.size > 0 && !f.clientApps.has('all')) bits.push(P.clientApps([...f.clientApps].join(', ')))
  if (f.platforms) bits.push(P.platforms([...f.platforms.include].join(', ') || 'any'))
  const loc = (id: string) => (id.toLowerCase() === 'all' ? 'all' : id.toLowerCase() === 'alltrusted' ? 'all trusted' : label(id))
  if (f.locations)
    bits.push(
      P.locations(
        `${[...f.locations.include].map(loc).join(', ') || 'any'}${f.locations.exclude.size > 0 ? ` except ${[...f.locations.exclude].map(loc).join(', ')}` : ''}`,
      ),
    )
  if (f.signInRisk.size > 0) bits.push(P.signInRisk([...f.signInRisk].join(', ')))
  if (f.userRisk.size > 0) bits.push(P.userRisk([...f.userRisk].join(', ')))
  if (f.flows.size > 0) bits.push(P.flows([...f.flows].join(', ')))
  if (f.deviceFilter) bits.push(P.deviceFilter)
  return bits.join(' · ') || '—'
}

const CONTROL_WORDS: Record<string, string> = {
  mfa: 'MFA',
  compliantDevice: 'compliant device',
  domainJoinedDevice: 'hybrid-joined device',
  approvedApplication: 'approved app',
  compliantApplication: 'app protection policy',
  passwordChange: 'password change',
}

function grantSummary(f: PolicyFacts, label: (id: string) => string): string {
  const P = C.policies
  if (!f.grant) return '—'
  if (f.grant.controls.has('block')) return P.block
  const controls = [...f.grant.controls].filter((c) => c !== 'mfa' || !f.grant?.strengthId)
  const bits = controls.map((c) => CONTROL_WORDS[c] ?? c)
  if (f.grant.strengthId) bits.push(P.strength(label(f.grant.strengthId)))
  return bits.length > 0 ? P.require(bits.join(f.grant.operator === 'AND' ? ' and ' : ' or ')) : '—'
}

function sessionSummary(f: PolicyFacts): string {
  const P = C.policies
  const bits: string[] = []
  if (f.session.signInFrequencyHours !== null) bits.push(P.signInFrequency(f.session.signInFrequencyHours))
  if (f.session.persistentBrowser) bits.push(P.persist(f.session.persistentBrowser))
  if (f.session.secureSignInSession) bits.push(P.tokenProtection)
  if (f.session.cloudAppSecurity) bits.push(P.cloudAppSecurity)
  if (f.session.appEnforced) bits.push(P.appEnforced)
  return bits.join(' · ') || '—'
}

const yesNo = (v: boolean): string => (v ? C.devices.yes : C.devices.no)

export function policiesModel(facts: PolicyFacts[], names: NameDirectory): InventoryModel<PolicyFacts> {
  const P = C.policies
  return {
    id: 'policies',
    label: C.tabs.policies,
    csvName: 'iamai-policies.csv',
    rows: facts,
    rowKey: (r) => r.id || r.name,
    empty: P.empty,
    columns: [
      { key: 'name', header: P.columns.name, sort: (r) => r.name.toLowerCase(), cell: (r) => r.name },
      { key: 'microsoftManaged', header: P.microsoftManaged, hidden: true, cell: (r) => yesNo(r.isMicrosoftManaged) },
      { key: 'state', header: P.columns.state, sort: (r) => r.state, cell: (r) => P.state[r.state] },
      { key: 'users', header: P.columns.users, cell: (r) => usersSummary(r) },
      { key: 'exclusions', header: P.columns.exclusions, cell: (r) => exclusionsSummary(r, names.label) },
      { key: 'apps', header: P.columns.apps, cell: (r) => appsSummary(r) },
      { key: 'conditions', header: P.columns.conditions, cell: (r) => conditionsSummary(r, names.label) },
      { key: 'grant', header: P.columns.grant, cell: (r) => grantSummary(r, names.label) },
      { key: 'session', header: P.columns.session, cell: (r) => sessionSummary(r) },
    ],
  }
}

// ---------- Named locations ----------

export type LocationRow = { id: string; name: string; type: string; trusted: boolean; ranges: string; usedBy: number }

export function locationsModel(snapshot: TenantSnapshot, facts: PolicyFacts[]): InventoryModel<LocationRow> {
  const L = C.locations
  const rows: LocationRow[] = ((snapshot.config.namedLocations?.rows ?? []) as Raw[]).map((l) => {
    const id = str(l.id)
    const isIp = str(l['@odata.type']).includes('ipNamedLocation')
    const ranges = isIp
      ? (Array.isArray(l.ipRanges) ? l.ipRanges : []).map((r) => str((r as Raw).cidrAddress)).filter(Boolean).join(', ')
      : (Array.isArray(l.countriesAndRegions) ? l.countriesAndRegions : []).map(String).join(', ')
    const usedBy = facts.filter((f) => f.locations && (f.locations.include.has(id) || f.locations.exclude.has(id))).length
    return { id, name: str(l.displayName ?? id), type: isIp ? L.ip : L.country, trusted: l.isTrusted === true, ranges, usedBy }
  })
  return {
    id: 'locations',
    label: C.tabs.locations,
    csvName: 'iamai-named-locations.csv',
    rows,
    rowKey: (r) => r.id,
    empty: L.empty,
    columns: [
      { key: 'name', header: L.columns.name, sort: (r) => r.name.toLowerCase(), cell: (r) => r.name },
      { key: 'type', header: L.columns.type, sort: (r) => r.type, cell: (r) => r.type },
      { key: 'trusted', header: L.columns.trusted, sort: (r) => (r.trusted ? 0 : 1), cell: (r) => (r.trusted ? L.trusted : L.notTrusted) },
      { key: 'ranges', header: L.columns.ranges, cell: (r) => r.ranges },
      { key: 'usedBy', header: L.columns.usedBy, sort: (r) => r.usedBy, cell: (r) => L.usedBy(r.usedBy) },
    ],
  }
}

// ---------- Authentication ----------

export type MethodRow = { id: string; enabled: boolean; targets: string }

/** The authentication methods policy's one row, or null where the scan holds none. */
export function authMethodsPolicyOf(snapshot: TenantSnapshot): Raw | null {
  return ((snapshot.config.authMethodsPolicy?.rows ?? [])[0] ?? null) as Raw | null
}

export function authMethodsModel(snapshot: TenantSnapshot, names: NameDirectory): InventoryModel<MethodRow> {
  const A = C.authentication
  const policy = authMethodsPolicyOf(snapshot)
  const configs = (Array.isArray(policy?.authenticationMethodConfigurations) ? policy!.authenticationMethodConfigurations : []) as Raw[]
  const rows: MethodRow[] = configs.map((m) => {
    const targets = (Array.isArray(m.includeTargets) ? m.includeTargets : []) as Raw[]
    const t = targets.map((x) => (String(x.id) === 'all_users' ? A.allUsers : names.label(str(x.id)))).join(', ')
    return { id: str(m.id), enabled: m.state === 'enabled', targets: t || A.targets(0) }
  })
  return {
    id: 'authentication',
    label: C.tabs.authentication,
    csvName: 'iamai-auth-methods.csv',
    rows,
    rowKey: (r) => r.id,
    empty: A.empty,
    columns: [
      { key: 'method', header: A.methodColumns.method, sort: (r) => methodName(r.id), cell: (r) => methodName(r.id) },
      { key: 'state', header: A.methodColumns.state, sort: (r) => (r.enabled ? 0 : 1), cell: (r) => (r.enabled ? A.enabled : A.disabled) },
      { key: 'targets', header: A.methodColumns.targets, cell: (r) => r.targets },
    ],
  }
}

export type StrengthRow = { id: string; name: string; builtIn: boolean; combos: string }

export function authStrengthsModel(snapshot: TenantSnapshot): InventoryModel<StrengthRow> {
  const A = C.authentication
  const rows: StrengthRow[] = ((snapshot.config.authStrengths?.rows ?? []) as Raw[]).map((s) => ({
    id: str(s.id),
    name: str(s.displayName ?? s.id),
    builtIn: s.policyType === 'builtIn',
    combos: (Array.isArray(s.allowedCombinations) ? s.allowedCombinations : []).map((c) => combinationName(String(c))).join(', '),
  }))
  return {
    id: 'authStrengths',
    label: A.strengths,
    csvName: 'iamai-auth-strengths.csv',
    rows,
    rowKey: (r) => r.id,
    columns: [
      { key: 'name', header: A.strengthColumns.name, sort: (r) => r.name.toLowerCase(), cell: (r) => r.name },
      { key: 'type', header: A.strengthColumns.type, sort: (r) => (r.builtIn ? 0 : 1), cell: (r) => (r.builtIn ? A.builtIn : A.custom) },
      { key: 'combos', header: A.strengthColumns.combinations, cell: (r) => r.combos },
    ],
  }
}

export type RegistrationMeasure = { measure: string; count: number }

export function registrationModel(snapshot: TenantSnapshot): InventoryModel<RegistrationMeasure> {
  const A = C.authentication
  const reg = snapshot.registrationDetails
  const byMethod = new Map<string, number>()
  for (const r of reg) for (const m of r.methodsRegistered) byMethod.set(m, (byMethod.get(m) ?? 0) + 1)
  const rows: RegistrationMeasure[] = [
    { measure: A.capable, count: reg.filter((r) => r.isMfaCapable).length },
    { measure: A.registered, count: reg.filter((r) => r.isMfaRegistered).length },
    { measure: A.passwordless, count: reg.filter((r) => r.isPasswordlessCapable).length },
    ...[...byMethod.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => ({ measure: A.byMethod(methodName(m)), count: n })),
  ]
  return {
    id: 'registration',
    label: A.registration,
    csvName: 'iamai-registration.csv',
    rows,
    rowKey: (r) => r.measure,
    columns: [
      { key: 'measure', header: A.regColumns.measure, cell: (r) => r.measure },
      { key: 'users', header: A.regColumns.users, sort: (r) => r.count, cell: (r) => r.count },
    ],
  }
}

// ---------- People ----------

export type PersonRow = { user: UserRow; v: MfaViability | undefined; roles: string; licence: string }

function licenceTier(u: UserRow): string {
  const caps = deriveUserCapabilities(u.assignedPlans)
  if (caps.has('entraP2')) return C.people.p2
  if (caps.has('entraP1')) return C.people.p1
  return C.people.free
}

/** Every account's MFA reading, keyed by id: what the People table reads. */
export function viabilityOf(snapshot: TenantSnapshot): Map<string, MfaViability> {
  return new Map(buildViabilityInputs(snapshot, snapshot.asOf).map(scoreMfaViability).map((v) => [v.userId, v]))
}

export function peopleModel(snapshot: TenantSnapshot, names: NameDirectory, viability: Map<string, MfaViability> = viabilityOf(snapshot)): InventoryModel<PersonRow> {
  const P = C.people
  const rows: PersonRow[] = snapshot.users.map((u) => ({ user: u, v: viability.get(u.id), roles: (snapshot.roles.active[u.id] ?? []).map(roleLabel).join(', '), licence: licenceTier(u) }))
  const type = (u: UserRow): string => (u.userType === 'guest' ? P.guest : P.member)
  return {
    id: 'people',
    label: C.tabs.people,
    csvName: 'iamai-people.csv',
    rows,
    rowKey: (r) => r.user.id,
    empty: P.empty,
    columns: [
      // A person by the one rule for naming a person (names.ts personLabels): a display name another account shares carries its sign-in address.
      { key: 'name', header: P.columns.name, sort: (r) => names.label(r.user.id).toLowerCase(), cell: (r) => names.label(r.user.id) },
      { key: 'upn', header: P.columns.upn, sort: (r) => (r.user.userPrincipalName ?? '').toLowerCase(), cell: (r) => r.user.userPrincipalName ?? '' },
      // A sign-in-disabled account (a shared mailbox, a resource) is listed here with its tag, and counted as a person nowhere.
      { key: 'type', header: P.columns.type, sort: (r) => `${r.user.userType}${r.user.accountEnabled === false ? ' disabled' : ''}`, cell: (r) => (r.user.accountEnabled === false ? `${type(r.user)} · ${P.signInDisabled}` : type(r.user)) },
      { key: 'lastSignIn', header: C.devices.columns.lastSignIn, hidden: true, cell: (r) => (r.user.lastSuccessfulSignIn ? absoluteDate(r.user.lastSuccessfulSignIn) : '') },
      { key: 'activity', header: P.columns.activity, sort: (r) => r.v?.activity ?? '', cell: (r) => (r.v ? ACTIVITY_STATE[r.v.activity].title : '—') },
      { key: 'mfa', header: P.columns.mfa, sort: (r) => r.v?.mfa ?? '', cell: (r) => (r.v ? MFA_STATE[r.v.mfa].title : '—') },
      { key: 'method', header: P.columns.method, sort: (r) => r.v?.strongestMethod ?? '', cell: (r) => (r.v && r.v.strongestMethod !== 'none' ? METHOD_TIER[r.v.strongestMethod].title : '—') },
      { key: 'licence', header: P.columns.licence, sort: (r) => r.licence, cell: (r) => r.licence },
      { key: 'roles', header: P.columns.roles, sort: (r) => r.roles, cell: (r) => r.roles || P.noRoles },
    ],
  }
}

// ---------- Groups ----------

/** A group as a read left it: its name and members, or `read: false` where the read did not come back. */
export type GroupEntry = { groupId: string; displayName: string | null; memberCount: number; sampled: boolean; membershipRule: string | null; read: boolean }
export type GroupRow = { id: string; name: string; members: string; membership: string; policies: string }

/** The groups a policy includes or excludes, with the policies that do. */
export function referencedGroupsOf(facts: PolicyFacts[]): Map<string, { include: string[]; exclude: string[] }> {
  const map = new Map<string, { include: string[]; exclude: string[] }>()
  for (const f of facts) {
    for (const g of f.who.groups) (map.get(g) ?? map.set(g, { include: [], exclude: [] }).get(g)!).include.push(f.name)
    for (const g of f.whoNot.groups) (map.get(g) ?? map.set(g, { include: [], exclude: [] }).get(g)!).exclude.push(f.name)
  }
  return map
}

/** The plan's loaded groups (a read that returned is in the map) as group entries. */
export function groupEntriesOf(groups: GroupMembers): GroupEntry[] {
  return [...groups].map(([groupId, g]) => ({ groupId, displayName: g.displayName ?? null, memberCount: g.memberCount, sampled: g.sampled, membershipRule: g.membershipRule ?? null, read: true }))
}

export function groupsModel(referenced: Map<string, { include: string[]; exclude: string[] }>, groups: GroupEntry[] | null, names: NameDirectory): InventoryModel<GroupRow> {
  const G = C.groups
  const rows: GroupRow[] = [...referenced.entries()].map(([id, refs]) => {
    const g = groups?.find((x) => x.groupId === id)
    return {
      id,
      name: g?.displayName ?? names.label(id),
      members: g ? (g.sampled ? G.sampled(g.memberCount) : String(g.memberCount)) : groups === null ? '…' : G.unknown,
      membership: g && g.read ? (g.membershipRule ? G.dynamic : G.assigned) : G.unknown,
      policies: [...refs.include.map(G.include), ...refs.exclude.map(G.exclude)].join('; '),
    }
  })
  return {
    id: 'groups',
    label: C.tabs.groups,
    csvName: 'iamai-groups.csv',
    rows,
    rowKey: (r) => r.id,
    empty: G.empty,
    columns: [
      { key: 'name', header: G.columns.name, sort: (r) => r.name.toLowerCase(), cell: (r) => r.name },
      { key: 'id', header: 'Id', hidden: true, cell: (r) => r.id },
      { key: 'members', header: G.columns.members, cell: (r) => r.members },
      { key: 'dynamic', header: G.columns.dynamic, cell: (r) => r.membership },
      { key: 'policies', header: G.columns.policies, cell: (r) => r.policies },
    ],
  }
}

// ---------- Devices ----------

export function devicesModel(snapshot: TenantSnapshot, names: NameDirectory): InventoryModel<DeviceRow> & { registrations: (r: DeviceRow) => string } {
  const D = C.devices
  const yn = (v: boolean | null) => (v === null ? D.unknown : v ? D.yes : D.no)
  // A person by the one rule for naming a person (names.ts personLabels), a
  // display name another account shares carrying its sign-in address. The
  // registrant list, which drops a repeated entry, folded two people of one
  // name into one when it read the bare display name.
  const users = new Set(snapshot.users.map((u) => u.id))
  const person = (id: string): string | null => (users.has(id) ? names.label(id) : null)
  const owner = (ids: string[]) => ids.map(person).filter(Boolean).join(', ')
  // Authenticator registrations by device name (ux-review-03 §A6): the name
  // is a model code, so every account with the same name is listed.
  const byDeviceName = new Map<string, string[]>()
  for (const [userId, methods] of Object.entries(snapshot.authMethods)) {
    if (methods === 'unknown') continue
    for (const m of methods) {
      if (m.kind !== 'microsoftAuthenticator' || !m.displayName) continue
      const who = person(userId)
      if (!who) continue
      const list = byDeviceName.get(m.displayName) ?? []
      if (!list.includes(who)) list.push(who)
      byDeviceName.set(m.displayName, list)
    }
  }
  const registrations = (r: DeviceRow): string => (r.displayName ? (byDeviceName.get(r.displayName) ?? []).join(', ') : '')
  return {
    id: 'devices',
    label: C.tabs.devices,
    csvName: 'iamai-devices.csv',
    rows: snapshot.devices,
    rowKey: (r) => r.id,
    empty: D.empty,
    registrations,
    columns: [
      { key: 'name', header: D.columns.name, sort: (r) => (r.displayName ?? '').toLowerCase(), cell: (r) => r.displayName ?? '—' },
      { key: 'os', header: D.columns.os, sort: (r) => r.operatingSystem ?? '', cell: (r) => r.operatingSystem ?? D.unknown },
      { key: 'trust', header: D.columns.trust, sort: (r) => r.trustType ?? '', cell: (r) => (r.trustType ? trustTypeName(r.trustType) : D.unknown) },
      { key: 'compliant', header: D.columns.compliant, sort: (r) => (r.isCompliant ? 0 : 1), cell: (r) => yn(r.isCompliant) },
      { key: 'managed', header: D.columns.managed, sort: (r) => (r.isManaged ? 0 : 1), cell: (r) => yn(r.isManaged) },
      { key: 'last', header: D.columns.lastSignIn, sort: (r) => r.approximateLastSignIn ?? '', cell: (r) => (r.approximateLastSignIn ? absoluteDate(r.approximateLastSignIn) : D.unknown) },
      { key: 'owner', header: D.columns.owner, cell: (r) => owner(r.ownerIds) || D.unknown },
      { key: 'authenticator', header: D.columns.authenticator, minWidth: '18rem', cell: (r) => registrations(r) || D.unknown },
    ],
  }
}

// ---------- Roles ----------

export type RoleRow = { id: string; name: string; privileged: boolean; active: string; eligible: string; activeN: number }

/**
 * The roles table. Holders that are not people are named from `resolved` (the
 * surface's on-demand lookup of their name and kind) where it has them. A
 * built-in role held only by service principals is left out unless `showAll`
 * (prompt 46 item 25); `hidden` counts the built-in roles left out.
 */
/** Every id that holds a role, active or eligible: the ids the surface looks up by name and kind. */
export function roleHoldersOf(snapshot: TenantSnapshot): Set<string> {
  const holders = new Set<string>()
  for (const scope of [snapshot.roles.active, snapshot.roles.eligible]) for (const [id, roles] of Object.entries(scope)) if (roles.length > 0) holders.add(id)
  return holders
}

export function rolesModel(snapshot: TenantSnapshot, names: NameDirectory, resolved: Map<string, ResolvedObject> | null = null, showAll = false): InventoryModel<RoleRow> & { hidden: number } {
  const R = C.roles
  const byRole = new Map<string, { active: Set<string>; eligible: Set<string> }>()
  const add = (src: Record<string, string[]>, key: 'active' | 'eligible') => {
    for (const [holderId, roles] of Object.entries(src)) {
      for (const role of roles) {
        const id = role.toLowerCase()
        const e = byRole.get(id) ?? { active: new Set<string>(), eligible: new Set<string>() }
        e[key].add(holderId)
        byRole.set(id, e)
      }
    }
  }
  add(snapshot.roles.active, 'active')
  add(snapshot.roles.eligible, 'eligible')
  const holder = (id: string): string => {
    const o = resolved?.get(id)
    if (o) return o.kind === 'servicePrincipal' ? R.service(o.displayName) : o.displayName
    return names.label(id)
  }
  const kindOf = (id: string): string | null => resolved?.get(id)?.kind ?? null
  const serviceOnly = (id: string): boolean => {
    const e = byRole.get(id)
    return e !== undefined && roleTemplate(id) !== undefined && heldOnlyByServices([...e.active, ...e.eligible], kindOf)
  }
  const ids = showAll ? new Set([...ROLE_TEMPLATES.map((r) => r.templateId), ...byRole.keys()]) : new Set([...byRole.keys()].filter((id) => !serviceOnly(id)))
  const rows: RoleRow[] = [...ids].map((id) => {
    const e = byRole.get(id) ?? { active: new Set<string>(), eligible: new Set<string>() }
    return {
      id,
      // A role the catalogue and the scan cannot name is labelled by who holds it, never by an id (ux-review-05 §7).
      name: roleName(id) ?? (e.active.size + e.eligible.size > 0 ? R.usedBy([...e.active, ...e.eligible].slice(0, 2).map(holder).join(', ')) : roleLabel(id)),
      privileged: roleTemplate(id)?.privileged ?? false,
      active: [...e.active].map(holder).join(', '),
      eligible: [...e.eligible].map(holder).join(', '),
      activeN: e.active.size,
    }
  })
  const hidden = ROLE_TEMPLATES.filter((r) => !byRole.has(r.templateId)).length + [...byRole.keys()].filter(serviceOnly).length
  return {
    id: 'roles',
    label: C.tabs.roles,
    csvName: 'iamai-roles.csv',
    rows,
    rowKey: (r) => r.id,
    empty: R.empty,
    hidden,
    columns: [
      { key: 'role', header: R.columns.role, sort: (r) => r.name.toLowerCase(), cell: (r) => r.name },
      { key: 'active', header: R.columns.active, sort: (r) => r.activeN, cell: (r) => r.active || '—' },
      { key: 'eligible', header: R.columns.eligible, cell: (r) => r.eligible || '—' },
    ],
  }
}

// ---------- Licensing ----------

export type LicenceRow = { id: string; sku: string; name: string; seats: number; consumed: number; caps: string }

export function licencesModel(snapshot: TenantSnapshot): InventoryModel<LicenceRow> {
  const L = C.licensing
  const friendly = productNames.products as Record<string, string>
  const rows: LicenceRow[] = ((snapshot.config.subscribedSkus?.rows ?? []) as Raw[]).map((s) => {
    const caps = deriveTenantCapabilities([s])
    const unlocked = CAPABILITIES.filter((c) => caps[c].enabled).map((c) => app.inventory.caps[c] ?? c)
    const sku = str(s.skuPartNumber ?? s.skuId)
    return {
      id: str(s.skuId ?? s.skuPartNumber),
      sku,
      name: friendly[sku.toUpperCase()] ?? sku,
      seats: Number((s.prepaidUnits as Raw | undefined)?.enabled ?? 0),
      consumed: Number(s.consumedUnits ?? 0),
      caps: unlocked.join(', ') || L.none,
    }
  })
  return {
    id: 'licensing',
    label: C.tabs.licensing,
    csvName: 'iamai-licences.csv',
    rows,
    rowKey: (r) => r.id,
    empty: L.empty,
    columns: [
      { key: 'sku', header: L.columns.sku, sort: (r) => r.name.toLowerCase(), cell: (r) => (r.name === r.sku ? r.sku : `${r.name} (${r.sku})`) },
      { key: 'seats', header: L.columns.seats, sort: (r) => r.seats, cell: (r) => r.seats },
      { key: 'consumed', header: L.columns.consumed, sort: (r) => r.consumed, cell: (r) => r.consumed },
      { key: 'caps', header: L.columns.capabilities, cell: (r) => r.caps },
    ],
  }
}

export type CapabilityRow = { id: string; name: string; enabled: boolean; seats: number; consumed: number }

export function capabilitiesModel(snapshot: TenantSnapshot): InventoryModel<CapabilityRow> {
  const L = C.licensing
  return {
    id: 'capabilities',
    label: L.summary,
    csvName: 'iamai-capabilities.csv',
    rows: CAPABILITIES.map((c) => ({ id: c, name: app.inventory.caps[c] ?? c, enabled: snapshot.capabilities[c].enabled, seats: snapshot.capabilities[c].seats, consumed: snapshot.capabilities[c].consumed })),
    rowKey: (r) => r.id,
    columns: [
      { key: 'capability', header: L.capColumns.capability, cell: (r) => r.name },
      { key: 'seats', header: L.capColumns.seats, cell: (r) => (r.enabled ? L.seats(r.seats, r.consumed) : L.notLicensed) },
    ],
  }
}

// ---------- Apps ----------

export type AppRow = { id: string; app: string; signIns: number; lastSp: string | null }

export function appsModel(snapshot: TenantSnapshot, names: NameDirectory): InventoryModel<AppRow> {
  const A = C.apps
  const lastSpByApp = new Map<string, string>()
  for (const s of snapshot.spActivity as Raw[]) {
    const appId = str(s.appId)
    const last = (s.lastSignInActivity as Raw | undefined)?.lastSignInDateTime
    if (appId && typeof last === 'string') lastSpByApp.set(appId, last)
  }
  const byApp = new Map<string, AppRow>()
  for (const r of snapshot.appSignInSummary as Raw[]) {
    const appId = str(r.appId)
    const name = typeof r.appDisplayName === 'string' ? r.appDisplayName : names.label(appId)
    const row = byApp.get(appId) ?? { id: appId || name, app: name, signIns: 0, lastSp: lastSpByApp.get(appId) ?? null }
    row.signIns += Number(r.signInCount ?? 0)
    byApp.set(appId, row)
  }
  for (const [appId, last] of lastSpByApp) {
    if (!byApp.has(appId)) byApp.set(appId, { id: appId, app: names.label(appId), signIns: 0, lastSp: last })
  }
  return {
    id: 'apps',
    label: C.tabs.apps,
    csvName: 'iamai-apps.csv',
    rows: [...byApp.values()],
    rowKey: (r) => r.id,
    empty: A.empty,
    columns: [
      { key: 'app', header: A.columns.app, sort: (r) => r.app.toLowerCase(), cell: (r) => r.app },
      { key: 'signIns', header: A.columns.signIns, sort: (r) => r.signIns, cell: (r) => r.signIns },
      { key: 'lastSp', header: A.columns.lastSp, sort: (r) => r.lastSp ?? '', cell: (r) => (r.lastSp ? absoluteDate(r.lastSp) : '—') },
    ],
  }
}

export type WorkloadRow = { facet: string; name: string; on: boolean; reason: string }

export function workloadsModel(snapshot: TenantSnapshot): InventoryModel<WorkloadRow> {
  const A = C.apps
  return {
    id: 'workloads',
    label: A.facets,
    csvName: 'iamai-workloads.csv',
    rows: Object.entries(detectFacets(snapshot)).map(([facet, f]) => ({ facet, name: app.inventory.workloadNames[facet] ?? facet, on: f.on, reason: f.reason })),
    rowKey: (r) => r.facet,
    columns: [
      { key: 'workload', header: A.facetColumns.workload, cell: (r) => r.name },
      { key: 'detected', header: A.facetColumns.detected, cell: (r) => (r.on ? A.on : A.off) },
    ],
  }
}

// ---------- Sign-in records ----------

export type CountRow = { key: string; count: number }

function countModel(id: string, label: string, csvName: string, data: Record<string, number>, header: string): InventoryModel<CountRow> {
  const S = C.signIns
  return {
    id,
    label,
    csvName,
    rows: Object.entries(data).map(([key, count]) => ({ key, count })),
    rowKey: (r) => r.key,
    columns: [
      { key: 'key', header: S.columns.key, sort: (r) => r.key, cell: (r) => r.key },
      { key: 'count', header, sort: (r) => r.count, cell: (r) => r.count },
    ],
  }
}

export type PeopleListRow = { key: string; label: string; ids: string[] }

/** The sign-in tables: what the records the scan collected say, counted. */
export function signInModels(snapshot: TenantSnapshot, names: NameDirectory) {
  const S = C.signIns
  const agg = snapshot.evidenceAggregates ?? null
  const usage = snapshot.evidenceUsage
  const list = (ids: string[]) => ids.map(names.label).join('; ')
  const peopleColumn = (header: string): InventoryColumn<PeopleListRow> => ({ key: 'people', header, cell: (r) => list(r.ids) })
  return {
    byClientApp: countModel('signInsByClientApp', S.byClientApp, 'iamai-signins-by-client-app.csv', agg?.byClientApp ?? {}, S.columns.count),
    byProtocol: countModel('signInsByProtocol', S.byProtocol, 'iamai-signins-by-protocol.csv', Object.fromEntries(Object.entries(agg?.byProtocol ?? {}).map(([k, v]) => [protocolName(k), v])), S.columns.count),
    byCountry: countModel('signins', C.tabs.signIns, 'iamai-signins-by-country.csv', agg?.byCountry ?? {}, S.columns.users),
    olderMethods: usage
      ? ({
          id: 'olderMethods',
          label: S.olderMethods,
          csvName: 'iamai-older-sign-in-methods.csv',
          rows: [
            { key: 'legacy', label: S.legacy, ids: usage.legacyAuth.userIds },
            { key: 'deviceCode', label: S.deviceCode, ids: usage.deviceCode.userIds },
            { key: 'authTransfer', label: S.authTransfer, ids: usage.authTransfer.userIds },
          ],
          rowKey: (r) => r.key,
          columns: [{ key: 'method', header: S.usageColumns.method, cell: (r) => r.label }, peopleColumn(S.usageColumns.people)],
        } satisfies InventoryModel<PeopleListRow>)
      : null,
    blockedToday: {
      id: 'blockedToday',
      label: S.blockedToday,
      csvName: 'iamai-blocked-today.csv',
      rows: snapshot.blockedToday.map((b) => ({ key: b.policyId, label: b.displayName ?? (b.policyId === 'unknown' ? S.noPolicy : names.label(b.policyId)), ids: b.userIds })),
      rowKey: (r) => r.key,
      columns: [{ key: 'policy', header: S.blockedColumns.policy, cell: (r) => r.label }, peopleColumn(S.blockedColumns.users)],
    } satisfies InventoryModel<PeopleListRow>,
  }
}

// ---------- The Export CSV card ----------

/**
 * The ten tables the Export CSV card offers, one per Inventory tab, each the
 * model that tab draws. The groups the plan loaded name the groups (E5);
 * without them a group is named by the directory alone.
 */
export function inventoryTables(snapshot: TenantSnapshot, groups: GroupMembers = new Map()): InventoryTable[] {
  const names = buildNameDirectory(snapshot, groups)
  const facts = policyFactsOf(snapshot)
  return [
    tableOf(policiesModel(facts, names)),
    tableOf(locationsModel(snapshot, facts)),
    tableOf(authMethodsModel(snapshot, names)),
    tableOf(peopleModel(snapshot, names)),
    tableOf(groupsModel(referencedGroupsOf(facts), groupEntriesOf(groups), names)),
    tableOf(devicesModel(snapshot, names)),
    tableOf(rolesModel(snapshot, names)),
    tableOf(appsModel(snapshot, names)),
    tableOf(licencesModel(snapshot)),
    tableOf(signInModels(snapshot, names).byCountry),
  ]
}

// MFA Readiness, as CSV: the same columns the page's table shows, whole (the
// page's own Export CSV writes what is on screen, which is the filtered set).
import { readinessView } from '../../derive/mfaReadiness.ts'
import { pages } from '../../content/content.ts'
import { rowCells } from './readinessCells.ts'
export function readinessTable(snapshot: TenantSnapshot, mapping: { breakGlassUserIds: readonly string[]; serviceAccountUserIds: readonly string[] } = { breakGlassUserIds: [], serviceAccountUserIds: [] }): InventoryTable {
  // The same cells the MFA Readiness table renders (readinessCells.ts): a row's CSV equals its screen.
  const view = readinessView(snapshot, snapshot.asOf, mapping)
  return {
    id: 'readiness',
    label: 'MFA Readiness',
    csvName: READINESS_CSV,
    header: [...(pages.readiness as { csvColumns: string[] }).csvColumns],
    rows: view.rows.map((r) => [r.user.displayName ?? r.user.userPrincipalName ?? r.user.id, r.user.userPrincipalName ?? '', ...rowCells(r)]),
  }
}

/** The file name both this table and the page's own Export CSV write. */
export const READINESS_CSV = 'iamai-mfa-readiness.csv'
