// The policy procedure (walk list section 4 items 14–17, owner 2026-09-24): the
// one producer of the Entra procedures every Conditional Access policy step
// hands over, in every state — the create, the correction, the switch to
// Report-only and the turn-on.
//
// Each package used to write its own copy of these procedures, about forty of
// them, and they drifted: "Configure exactly this intended scope: Users: All
// users with the exclusions IAMAI resolved", "include exactly the built-in
// directory roles resolved from the baseline", "add the exclusions group you
// confirmed in Configure Emergency Exclusions", a turn-on of ten to thirteen
// lines. None of them named the group, the roles or the accounts, and a
// correction said "make sure" about settings the scan had already passed.
//
// These lines are read from the policy itself: a create from the whole policy
// the plan writes, a correction from the tenant's own policy and what the
// plan's change leaves it as, so every line names the tenant's own objects and
// a correction says only what differs, with the values it adds or removes.
// The words are content.json's (shared.procedure); the portal's own vocabulary
// for a platform, a client app or a grant control is portalLines.ts's one map.
//
// Pure: no DOM, no network, no snapshot.
import { policyFacts } from '../coverage/facts.ts'
import type { PolicyFacts } from '../coverage/types.ts'
import { shared } from '../content/content.ts'
import { list } from '../copy/statements.ts'
import { GRANT_LABEL, portalName } from './portalLines.ts'

type Words = Record<string, string> & {
  conditions: Record<string, string>
  appControl: Record<string, string>
}

/** shared.procedure: every line and fragment the procedures are written in. */
export const PROCEDURE = (shared as unknown as { procedure: Words }).procedure

/**
 * A template with its {placeholders} filled; a value the caller did not supply is
 * left empty. A tenant name holding a line break stays on its line: every value
 * is one line, so a name never ends the instruction it is in (R6-1).
 */
const LINE_BREAK = new RegExp(`\\s*[\\r\\n${String.fromCharCode(0x2028, 0x2029, 0x85)}]\\s*`, 'g')
const fill = (template: string, vars: Record<string, string>): string => template.replace(/\{(\w+)\}/g, (_m, key: string) => (vars[key] ?? '').replace(LINE_BREAK, ' '))
const bold = (s: string): string => `**${s}**`
const lc = (s: string): string => s.toLowerCase()
const sameId = (a: string, b: string | null | undefined): boolean => b != null && lc(a) === lc(b)

/** What the lines need beyond the policy: the tenant's names for its ids. */
export type ProcedureContext = {
  /** id → the name the tenant knows it by; the caller supplies the tenant's directory. */
  nameOf: (id: string) => string
  /** The name this tenant knows an authentication strength by, or null. */
  strengthNameOf?: (id: string) => string | null
  /** The exclusions group, so the emergency accounts it holds are never named beside it. */
  exclusionsGroupId?: string | null
  /** The emergency access accounts: excluded through the exclusions group, never by name. */
  emergencyIds?: readonly string[]
  /** The name the plan proposes for an authentication context it makes itself, or null: IAMAI reads no contexts. */
  contextNameOf?: (id: string) => string | null
}

const facts = (policy: Record<string, unknown>): PolicyFacts => policyFacts(policy, new Map())

/** The first line: open the policy list at New policy, or at the named policy. */
export function openLine(target: string | null): string {
  return fill(PROCEDURE.open, { target: target ?? PROCEDURE.newPolicy })
}

// ---- fragments ----

const names = (ids: Iterable<string>, ctx: ProcedureContext): string[] => [...ids].map((id) => ctx.nameOf(id))
const boldList = (items: readonly string[]): string => list(items.map(bold))

/** "the group **A**" / "the groups **A** and **B**". */
function groupsWords(ids: readonly string[], ctx: ProcedureContext): string | null {
  if (ids.length === 0) return null
  const n = names(ids, ctx)
  return n.length === 1 ? fill(PROCEDURE.group, { name: bold(n[0]) }) : fill(PROCEDURE.groups, { names: boldList(n) })
}

/** "the account **A**" / "the accounts **A** and **B**". */
function accountsWords(ids: readonly string[], ctx: ProcedureContext): string | null {
  if (ids.length === 0) return null
  const n = names(ids, ctx)
  return n.length === 1 ? fill(PROCEDURE.account, { name: bold(n[0]) }) : fill(PROCEDURE.accounts, { names: boldList(n) })
}

/** "the directory role **A**" / "the directory roles **A** and **B**". */
function rolesWords(ids: readonly string[], ctx: ProcedureContext): string | null {
  if (ids.length === 0) return null
  const n = names(ids, ctx)
  return n.length === 1 ? fill(PROCEDURE.role, { name: bold(n[0]) }) : fill(PROCEDURE.roles, { names: boldList(n) })
}

/**
 * Guest or external users, every type or the named ones, in the portal's words.
 * The types are the portal's checkboxes, so they are a comma list: joined with
 * "and" they ran into the "and exclude" after them.
 */
function guestWords(types: readonly string[] | null): string {
  if (types === null || types.length === 0 || types.length >= 6) return PROCEDURE.guests
  return fill(PROCEDURE.guestTypes, { types: types.map((t) => bold(portalName('guestType', t) ?? t)).join(', ') })
}

/**
 * Who a policy includes. All users reaches every guest type, and Entra cannot
 * select All users and Guest or external users together, so All users is said
 * alone (walk list item 19). Guest or external users leads: it carries no
 * article, and after "the group **A** and" it read as a second group.
 */
/** Above this many, a role list is counted in the step and listed in a fold under it. */
const ROLES_INLINE = 5

function includeWords(f: PolicyFacts, ctx: ProcedureContext, counted = false): string[] {
  if (f.who.all) return [PROCEDURE.allUsers]
  const out: string[] = []
  if (f.who.guests !== null) out.push(guestWords(f.who.guests))
  if (f.who.roles.size > 0) out.push(counted && f.who.roles.size > ROLES_INLINE ? fill(PROCEDURE.directoryRolesCounted, { n: String(f.who.roles.size) }) : fill(PROCEDURE.directoryRoles, { names: list(names(f.who.roles, ctx)) }))
  const groups = groupsWords([...f.who.groups], ctx)
  if (groups) out.push(groups)
  const users = accountsWords([...f.who.users], ctx)
  if (users) out.push(users)
  return out
}

/**
 * Who a policy excludes, each object by the tenant's name. The emergency
 * accounts are members of the exclusions group and are never named beside it.
 * Guest or external users leads, as it does on the include side, then the
 * exclusions group.
 */
function excludeWords(f: PolicyFacts, ctx: ProcedureContext): string[] {
  const included = (id: string): boolean => [...f.who.groups].some((g) => sameId(g, id))
  const groups = [...f.whoNot.groups].filter((g) => !included(g))
  const viaGroup = ctx.exclusionsGroupId != null && groups.some((g) => sameId(g, ctx.exclusionsGroupId))
  const emergency = new Set((ctx.emergencyIds ?? []).map(lc))
  // The exclusions group leads: it is the one every policy carries.
  const ordered = [...groups.filter((g) => sameId(g, ctx.exclusionsGroupId)), ...groups.filter((g) => !sameId(g, ctx.exclusionsGroupId))]
  const users = [...f.whoNot.users].filter((u) => !f.who.users.has(u) && !(viaGroup && emergency.has(lc(u))))
  const roles = [...f.whoNot.roles].filter((r) => ![...f.who.roles].some((x) => sameId(x, r)))
  const includedAll = f.who.guests !== null && f.who.guests.length === 0 && !f.who.all
  const guests = f.whoNot.guests && !includedAll ? guestWords(f.whoNot.guestTypes ?? []) : null
  return [guests, groupsWords(ordered, ctx), accountsWords(users, ctx), rolesWords(roles, ctx)].filter((w): w is string => w !== null)
}

function usersLine(f: PolicyFacts, ctx: ProcedureContext): string {
  if (f.workload) {
    const sps = f.workload.sps.size > 0 ? boldList(names(f.workload.sps, ctx)) : bold(f.workload.filterRule ?? '')
    return fill(PROCEDURE.workload, { include: sps })
  }
  const include = list(includeWords(f, ctx, true))
  const exclude = excludeWords(f, ctx)
  // A long role list folds under the step (AuthoredText reads a "+ " sub-line as a fold).
  const fold = !f.who.all && f.who.roles.size > ROLES_INLINE ? `
  + ${fill(PROCEDURE.rolesFold, { n: String(f.who.roles.size) })}: ${list(names(f.who.roles, ctx))}` : ''
  if (exclude.length === 0) return fill(PROCEDURE.usersIncludeOnly, { include }) + fold
  // A list of directory roles runs to dozens of names, and an exclusion said
  // after it is lost at the end of the line: the exclusion comes first there.
  return fill(!f.who.all && f.who.roles.size > 0 ? PROCEDURE.usersRoles : PROCEDURE.users, { include, exclude: list(exclude) }) + fold
}

/** The resources a policy includes, in the portal's words. */
function resourceInclude(f: PolicyFacts, ctx: ProcedureContext): string[] {
  if (f.apps.all) return [PROCEDURE.allResources]
  const out: string[] = []
  if (f.apps.office365) out.push(bold('Office 365'))
  if (f.apps.adminPortals) out.push(bold('Microsoft Admin Portals'))
  for (const id of f.apps.ids) out.push(bold(ctx.nameOf(id)))
  return out
}

const excludedApps = (f: PolicyFacts): string[] => [...f.apps.excludedIds].filter((id) => !/^none$/i.test(id))

function resourcesLine(f: PolicyFacts, ctx: ProcedureContext): string | null {
  const action = [...f.apps.userActions].map((a) => portalName('userAction', a)).find((a): a is string => a !== null)
  if (action) return fill(PROCEDURE.userAction, { action })
  if (f.apps.authContexts.size > 0) {
    // A context the plan makes is named as it proposes it, with its ID; any other by its ID.
    const context = (id: string): string => {
      const name = ctx.contextNameOf?.(id) ?? null
      return name ? fill(PROCEDURE.contextNamed, { name: bold(name), id: `\`${id}\`` }) : bold(id)
    }
    return fill(PROCEDURE.authContext, { contexts: list([...f.apps.authContexts].map(context)) })
  }
  const include = resourceInclude(f, ctx)
  if (include.length === 0) return null
  const exclude = excludedApps(f)
  return exclude.length > 0
    ? fill(PROCEDURE.resourcesExclude, { include: list(include), exclude: boldList(names(exclude, ctx)) })
    : fill(PROCEDURE.resources, { include: list(include) })
}

const RISK_ORDER = ['high', 'medium', 'low']

/** One line per condition the policy narrows, in the portal's order: Locations, Client apps, Authentication flows, Device platforms, Filter for devices, the two risks. */
function conditionLines(f: PolicyFacts, ctx: ProcedureContext): Record<string, string> {
  const out: Record<string, string> = {}
  const locationName = (l: string): string => (/^all$/i.test(l) ? PROCEDURE.anyLocation : /^alltrusted$/i.test(l) ? PROCEDURE.allTrusted : bold(ctx.nameOf(l)))
  if (f.locations) {
    const inc = [...f.locations.include]
    const incLc = new Set(inc.map(lc))
    const exc = [...f.locations.exclude].filter((l) => !incLc.has(lc(l)))
    const include = inc.length > 0 ? list(inc.map(locationName)) : PROCEDURE.anyLocation
    out.locations = exc.length > 0 ? fill(PROCEDURE.locationsExclude, { include, exclude: list(exc.map(locationName)) }) : fill(PROCEDURE.locations, { include })
  }
  const clientApps = [...f.clientApps].filter((c) => c !== 'all')
  if (clientApps.length > 0) out.clientApps = fill(PROCEDURE.clientApps, { values: boldList(clientApps.map((c) => portalName('clientApp', c) ?? c)) })
  if (f.flows.size > 0) out.flows = fill(PROCEDURE.flows, { values: boldList([...f.flows].map((t) => portalName('flow', t) ?? t)) })
  if (f.platforms && (f.platforms.include.size > 0 || f.platforms.exclude.size > 0)) {
    const named = [...f.platforms.include].filter((p) => !/^all$/i.test(p))
    const namedLc = new Set(named.map(lc))
    const platform = (p: string): string => bold(portalName('platform', p) ?? ctx.nameOf(p))
    const include = named.length > 0 ? list(named.map(platform)) : PROCEDURE.anyDevice
    const exc = [...f.platforms.exclude].filter((p) => !namedLc.has(lc(p)))
    out.platforms = exc.length > 0 ? fill(PROCEDURE.platformsExclude, { include, exclude: list(exc.map(platform)) }) : fill(PROCEDURE.platforms, { include })
  }
  if (f.deviceFilter) out.deviceFilter = fill(PROCEDURE.deviceFilter, { mode: f.deviceFilter.mode === 'exclude' ? PROCEDURE.deviceFilterExclude : PROCEDURE.deviceFilterInclude, rule: f.deviceFilter.rule })
  const risks = (s: Set<string>): string => boldList(RISK_ORDER.filter((r) => s.has(r)).map((r) => portalName('risk', r) ?? r))
  if (f.signInRisk.size > 0) out.signInRisk = fill(PROCEDURE.signInRisk, { values: risks(f.signInRisk) })
  if (f.userRisk.size > 0) out.userRisk = fill(PROCEDURE.userRisk, { values: risks(f.userRisk) })
  return out
}

const CONDITION_ORDER = ['locations', 'clientApps', 'flows', 'platforms', 'deviceFilter', 'signInRisk', 'userRisk'] as const

/** An authentication strength's object id, built-in or custom. */
const STRENGTH_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The grant controls a policy asks for, each in the portal's words; null where it blocks or asks for nothing. */
function grantControls(f: PolicyFacts, policy: Record<string, unknown>, ctx: ProcedureContext): string[] | null {
  if (!f.grant) return null
  const controls = new Set([...f.grant.controls].map(lc))
  if (controls.has('block')) return null
  const out: string[] = []
  if (controls.has('riskremediation')) out.push(bold('Require risk remediation'))
  if (f.grant.strengthId) {
    const own = (policy.grantControls as { authenticationStrength?: { displayName?: unknown } } | null | undefined)?.authenticationStrength?.displayName
    const strength = ctx.strengthNameOf?.(f.grant.strengthId) ?? (typeof own === 'string' && own !== '' ? own : STRENGTH_ID.test(f.grant.strengthId) ? f.grant.strengthId : null)
    out.push(strength !== null ? fill(PROCEDURE.strength, { strength }) : bold('Require authentication strength'))
  } else if (controls.has('mfa')) out.push(bold('Require multifactor authentication'))
  for (const c of ['compliantdevice', 'domainjoineddevice', 'compliantapplication', 'passwordchange', 'approvedapplication'])
    if (controls.has(c)) out.push(bold(GRANT_LABEL[c]))
  return out
}

const blocks = (f: PolicyFacts): boolean => f.grant !== null && [...f.grant.controls].some((c) => lc(c) === 'block')

function grantLine(f: PolicyFacts, policy: Record<string, unknown>, ctx: ProcedureContext, only = false): string | null {
  if (blocks(f)) return PROCEDURE.grantBlock
  const controls = grantControls(f, policy, ctx)
  if (controls === null || controls.length === 0) return null
  if (only) return fill(PROCEDURE.grantOnly, { controls: list(controls) })
  if (controls.length === 1) return fill(PROCEDURE.grant, { controls: controls[0] })
  return fill(f.grant?.operator === 'OR' ? PROCEDURE.grantOne : PROCEDURE.grantAll, { controls: list(controls) })
}

/** A sign-in frequency in the portal's value and unit. */
function interval(hours: number): string {
  if (hours % 24 === 0) return hours === 24 ? PROCEDURE.day : fill(PROCEDURE.days, { n: String(hours / 24) })
  return fill(PROCEDURE.hours, { n: String(hours) })
}

function sessionLines(f: PolicyFacts): string[] {
  const s = f.session
  const out: string[] = []
  if (s.signInFrequencyEveryTime) out.push(PROCEDURE.sessionEveryTime)
  else if (s.signInFrequencyHours !== null) out.push(fill(PROCEDURE.sessionPeriodic, { interval: interval(s.signInFrequencyHours) }))
  if (s.persistentBrowser === 'never') out.push(PROCEDURE.sessionNeverPersistent)
  if (s.persistentBrowser === 'always') out.push(PROCEDURE.sessionAlwaysPersistent)
  if (s.appEnforced) out.push(PROCEDURE.sessionAppEnforced)
  if (s.cloudAppSecurity) out.push(fill(PROCEDURE.sessionAppControl, { mode: PROCEDURE.appControl[s.cloudAppSecurity] ?? s.cloudAppSecurity }))
  if (s.secureSignInSession) out.push(PROCEDURE.sessionTokenProtection)
  return out
}

/**
 * The settings lines of a whole policy, keyed by the section each sets, in the
 * portal's order: users, target resources, each condition, the grant, the
 * session controls. A policy's create is these between its name and its state.
 */
function settingsOf(policy: Record<string, unknown>, ctx: ProcedureContext): string[] {
  const f = facts(policy)
  const conditions = conditionLines(f, ctx)
  return [
    usersLine(f, ctx),
    resourcesLine(f, ctx),
    ...CONDITION_ORDER.map((key) => conditions[key]),
    grantLine(f, policy, ctx),
    ...sessionLines(f),
  ].filter((line): line is string => typeof line === 'string')
}

/**
 * The create: open New policy, name it, set who and what it reaches, its
 * conditions, its grant and session controls, create it in Report-only, and
 * scan (walk list items 14 and 16). Nothing follows the Report-only line but
 * the scan.
 *
 * No Description line: the Entra form for a Conditional Access policy has no
 * Description field (Graph documents the property as "Not used"), so the line
 * item 16 asked for could not be followed. The name is what the next scan
 * recognises a policy created by hand by (generate.ts claimedPolicy); the JSON
 * and the script still carry the plan tag.
 *
 * `baseline` is the same policy without the person's answers, where an answer
 * changed it: a line the answer moved carries the baseline's version beside it
 * (shared.deviation), so the person's choice is always shown beside what the
 * baseline said.
 */
export function createLines(policy: Record<string, unknown>, ctx: ProcedureContext, opts: { name: string; baseline?: Record<string, unknown> | null }): string[] {
  const settings = settingsOf(policy, ctx)
  const annotated = opts.baseline ? besideBaseline(settings, settingsOf(opts.baseline, ctx)) : settings
  return [
    openLine(null),
    fill(PROCEDURE.name, { name: opts.name }),
    ...annotated,
    // A User Action policy is created On (roadmap/evidenceStrategy.ts createdOn): the body says which.
    policy.state === 'enabled' ? PROCEDURE.createOn : PROCEDURE.create,
    PROCEDURE.scan,
  ]
}

/** The part of the portal a line sets: what its "Under **…**" opens, or its own label ("Name:"). */
const sectionOf = (line: string): string => /^Under \*\*([^*]+)\*\*/.exec(line)?.[1] ?? line.split(':')[0]

/**
 * Each line a person's answer moved, with the baseline's line for the same
 * part of the portal beside it (shared.deviation): the choice is always shown
 * beside what the baseline said. A line the baseline has too is left alone.
 */
export function besideBaseline(lines: readonly string[], baseline: readonly string[]): string[] {
  const words = (shared as unknown as { deviation: { line: string; none: string } }).deviation
  const said = new Set(baseline)
  return lines.map((line) => {
    if (said.has(line)) return line
    const was = baseline.find((b) => sectionOf(b) === sectionOf(line))
    return fill(words.line, { line, baseline: was ?? words.none })
  })
}

/** The turn-on: open the policy, set it On (walk list item 17). Two lines. */
export function turnOnLines(name: string): string[] {
  return [openLine(name), PROCEDURE.turnOn]
}

/** A policy the tenant switched off goes back to Report-only, never straight to On: open it, set it. */
export function reportOnlyLines(name: string): string[] {
  return [openLine(name), PROCEDURE.reportOnly]
}

// ---- the correction ----

const minus = (a: Iterable<string>, b: Iterable<string>): string[] => {
  const bb = new Set([...b].map(lc))
  return [...a].filter((x) => !bb.has(lc(x)))
}
const sameSet = (a: Iterable<string>, b: Iterable<string>): boolean => minus(a, b).length === 0 && minus(b, a).length === 0

/** "add X", "remove Y", "add X and remove Y", or null where nothing changes. */
function change(added: string | null, removed: string | null): string | null {
  if (added && removed) return fill(PROCEDURE.addRemove, { added, removed })
  if (added) return fill(PROCEDURE.add, { items: added })
  if (removed) return fill(PROCEDURE.remove, { items: removed })
  return null
}

const joined = (parts: (string | null)[]): string | null => {
  const kept = parts.filter((p): p is string => p !== null)
  return kept.length > 0 ? list(kept) : null
}

/** The part of a policy a correction may be asked to read, by the section the portal opens. */
export type CorrectionSection = 'name' | 'users' | 'resources' | 'conditions' | 'grant' | 'session'

/**
 * The correction's own lines, between the line that opens the policy and the
 * Save (walk list item 15): each section of the tenant's policy that is not
 * what the plan's change leaves it as, in the portal's words, naming the values
 * it adds or removes and nothing the scan found right.
 *
 * `sections` limits it to the parts the change writes, and the conditions to
 * those named (a condition's Graph key: `clientAppTypes`, `platforms` …), so a
 * difference nobody is asked to make is never instructed.
 */
export function correctionSettings(current: Record<string, unknown>, target: Record<string, unknown>, ctx: ProcedureContext, sections: ReadonlySet<CorrectionSection>, conditionKeys: ReadonlySet<string> | null = null): string[] {
  const was = facts(current)
  const now = facts(target)
  const out: string[] = []
  if (sections.has('name') && typeof target.displayName === 'string' && target.displayName !== '' && target.displayName !== current.displayName) out.push(fill(PROCEDURE.name, { name: target.displayName }))
  if (sections.has('users')) out.push(...usersCorrection(was, now, ctx))
  if (sections.has('resources')) out.push(...resourcesCorrection(was, now, ctx))
  if (sections.has('conditions')) out.push(...conditionsCorrection(was, now, ctx, conditionKeys))
  if (sections.has('grant') && !sameGrant(was, now)) {
    const line = grantLine(now, target, ctx, true)
    if (line) out.push(line)
  }
  if (sections.has('session')) {
    const before = sessionLines(was)
    const after = sessionLines(now)
    if (!sameSet(before, after)) out.push(...(after.length === 0 ? [PROCEDURE.sessionClear] : after))
  }
  return out
}

function usersCorrection(was: PolicyFacts, now: PolicyFacts, ctx: ProcedureContext): string[] {
  const out: string[] = []
  // Who the policy includes. A change of kind — All users for a group, or the
  // other way — is said whole; otherwise what is added and what is taken off.
  const kindChanged = was.who.all !== now.who.all
  if (kindChanged) out.push(fill(PROCEDURE.usersInclude, { change: fill(PROCEDURE.selectOnly, { items: list(includeWords(now, ctx)) }) }))
  else if (!now.who.all) {
    const added = joined([
      rolesWords(minus(now.who.roles, was.who.roles), ctx),
      groupsWords(minus(now.who.groups, was.who.groups), ctx),
      accountsWords(minus(now.who.users, was.who.users), ctx),
      now.who.guests !== null && was.who.guests === null ? guestWords(now.who.guests) : null,
    ])
    const removed = joined([
      rolesWords(minus(was.who.roles, now.who.roles), ctx),
      groupsWords(minus(was.who.groups, now.who.groups), ctx),
      accountsWords(minus(was.who.users, now.who.users), ctx),
      was.who.guests !== null && now.who.guests === null ? guestWords(was.who.guests) : null,
    ])
    const line = change(added, removed)
    if (line) out.push(fill(PROCEDURE.usersInclude, { change: line }))
  }
  // Who it excludes: each object added or taken off, by name.
  const guestsAdded = now.whoNot.guests && !was.whoNot.guests
  const guestsRemoved = was.whoNot.guests && !now.whoNot.guests
  const exAdded = joined([
    groupsWords(minus(now.whoNot.groups, was.whoNot.groups), ctx),
    accountsWords(minus(now.whoNot.users, was.whoNot.users), ctx),
    rolesWords(minus(now.whoNot.roles, was.whoNot.roles), ctx),
    guestsAdded ? guestWords(now.whoNot.guestTypes) : null,
  ])
  const exRemoved = joined([
    groupsWords(minus(was.whoNot.groups, now.whoNot.groups), ctx),
    accountsWords(minus(was.whoNot.users, now.whoNot.users), ctx),
    rolesWords(minus(was.whoNot.roles, now.whoNot.roles), ctx),
    guestsRemoved ? guestWords(was.whoNot.guestTypes) : null,
  ])
  const ex = change(exAdded, exRemoved)
  if (ex) out.push(fill(PROCEDURE.usersExclude, { change: ex }))
  return out
}

function resourcesCorrection(was: PolicyFacts, now: PolicyFacts, ctx: ProcedureContext): string[] {
  const out: string[] = []
  const include = (f: PolicyFacts): string => [f.apps.all, f.apps.office365, f.apps.adminPortals, ...[...f.apps.ids].map(lc).sort(), ...[...f.apps.userActions].sort(), ...[...f.apps.authContexts].sort()].join('|')
  if (include(was) !== include(now)) {
    const line = resourcesLine({ ...now, apps: { ...now.apps, excludedIds: new Set() } }, ctx)
    if (line) out.push(line)
  }
  const line = change(
    minus(excludedApps(now), excludedApps(was)).length > 0 ? boldList(names(minus(excludedApps(now), excludedApps(was)), ctx)) : null,
    minus(excludedApps(was), excludedApps(now)).length > 0 ? boldList(names(minus(excludedApps(was), excludedApps(now)), ctx)) : null,
  )
  if (line) out.push(fill(PROCEDURE.resourcesExcludeChange, { change: line }))
  return out
}

/** A condition's Graph key → the key its line is kept under here. */
const CONDITION_KEY: Record<string, (typeof CONDITION_ORDER)[number]> = {
  locations: 'locations', clientAppTypes: 'clientApps', authenticationFlows: 'flows', platforms: 'platforms', devices: 'deviceFilter', signInRiskLevels: 'signInRisk', userRiskLevels: 'userRisk',
}

function conditionsCorrection(was: PolicyFacts, now: PolicyFacts, ctx: ProcedureContext, only: ReadonlySet<string> | null): string[] {
  const before = conditionLines(was, ctx)
  const after = conditionLines(now, ctx)
  const allowed = only === null ? null : new Set([...only].map((k) => CONDITION_KEY[k]).filter(Boolean))
  const out: string[] = []
  for (const key of CONDITION_ORDER) {
    if (allowed !== null && !allowed.has(key)) continue
    if (before[key] === after[key]) continue
    out.push(after[key] ?? fill(PROCEDURE.conditionOff, { condition: PROCEDURE.conditions[key] }))
  }
  return out
}

function sameGrant(a: PolicyFacts, b: PolicyFacts): boolean {
  if (a.grant === null || b.grant === null) return a.grant === b.grant
  return a.grant.operator === b.grant.operator && sameSet(a.grant.controls, b.grant.controls) && lc(a.grant.strengthId ?? '') === lc(b.grant.strengthId ?? '')
}

/**
 * The whole correction of one policy: open it, the settings that differ, Save,
 * scan. Empty where nothing the correction writes differs.
 */
export function correctionLines(name: string, settings: readonly string[]): string[] {
  if (settings.length === 0) return []
  return [openLine(name), ...settings, PROCEDURE.save, PROCEDURE.scan]
}
