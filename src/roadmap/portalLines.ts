// The portal-line translator (target-state §8.9, prompt 51 §3.1–3.2): the one
// place the product composes prose rather than reading it from the content file,
// because "What to do" on a policy step is generated from the baseline's policy
// object, not a catalogue template — the baseline wins. Given a parsed policy
// (src/coverage/facts.ts `policyFacts`) and a context that resolves ids to the
// tenant's names, it returns the numbered portal lines: the root, the name, the
// users and groups, the resources, the conditions, the grant or session control,
// and the report-only/state line. Ids never appear; every line is a name.
//
// content.json's `whatToDo.steps` for a goal are the *expected* output of this
// translator for the pinned baseline (the review page renders them); the runtime
// renders this. Where the two differ, the baseline wins and the difference is
// reported (portalLines.test.ts), never hand-patched.
//
// Pure: no DOM, no network, no snapshot. Runs in Node tests and in the worker.
import type { PolicyFacts } from '../coverage/types.ts'

/** What the translator needs to turn a policy's ids into the tenant's names. */
export type PortalContext = {
  /** The proposed policy name, for the `Name:` line (§8.4). */
  policyName: string
  /** id → display name; the caller supplies the tenant or baseline directory. */
  nameOf: (id: string) => string
  /** The custom strength's name, for `Require authentication strength: <name>`. */
  strengthName?: string | null
  /** shared.portalRoot, resolved — `Entra admin center → … → New policy`. */
  portalRoot: string
  /** shared.portalOpen, for a change to an existing policy (no `Name:` line). */
  portalOpen?: string
  /** shared.changeUntouched — an update changes the fields it lists and no others. */
  changeUntouched?: string
  /** shared.enableLine — an update that turns a report-only policy on. */
  enableLine?: string
  /** shared.reportOnlyLine, resolved — `Enable policy: Report-only → Create`. */
  reportOnlyLine: string
  /** shared.exclusionsLine, resolved with the exclusions group's name. */
  exclusionsLine: string
  /** Recognised groups, so an exclude of one is labelled, not left as an id. */
  serviceAccountsGroupId?: string | null
  exclusionsGroupId?: string | null
  /** Shared-device accounts, so an exclude of them is labelled. */
  sharedDeviceIds?: string[]
  /**
   * The emergency-access accounts. Exclusions go through the exclusions group,
   * never an account by name, so an exclude of one of these is covered by the
   * exclusions sentence and is never named on a line.
   */
  emergencyIds?: string[]
}

/** How the step opens: a new policy (root + Name) or a change to an existing one. */
export type PortalMode = 'new' | 'change'

/**
 * The sections an update's request body carries. An update lists these and only
 * these; every other setting on the policy is left as it is.
 */
export type PortalSection = 'users' | 'applications' | 'grant' | 'session' | 'state'

/** The registration step's fallback: require MFA instead of Block when the tenant has no trusted network. */
export type GrantOverride = 'mfa'

const lc = (s: string): string => s.toLowerCase()
const names = (ids: Iterable<string>, ctx: PortalContext): string => [...ids].map((id) => ctx.nameOf(id)).join(', ')

const PLATFORM_LABEL: Record<string, string> = { android: 'Android', ios: 'iOS', windows: 'Windows', macos: 'macOS', linux: 'Linux', windowsphone: 'Windows Phone' }
const CLIENT_APP_LABEL: Record<string, string> = {
  exchangeactivesync: 'Exchange ActiveSync clients',
  other: 'Other clients',
  browser: 'Browser',
  mobileappsanddesktopclients: 'Mobile apps and desktop clients',
}
const FLOW_LABEL: Record<string, string> = { devicecodeflow: 'Device code flow', authenticationtransfer: 'Authentication transfer' }
// Graph guestOrExternalUserTypes tokens are developer vocabulary; the portal
// (and the content file) show these names instead (UX rule: no developer words).
const GUEST_TYPE_LABEL: Record<string, string> = {
  b2bcollaborationguest: 'B2B collaboration guest users',
  b2bcollaborationmember: 'B2B collaboration member users',
  b2bdirectconnectuser: 'B2B direct connect users',
  internalguest: 'Local guest users',
  serviceprovider: 'Service provider users',
  otherexternaluser: 'Other external users',
}
const RISK_LABEL: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' }
const RISK_ORDER = ['high', 'medium', 'low']

function platformList(s: Set<string>, ctx: PortalContext): string {
  return [...s].map((p) => PLATFORM_LABEL[lc(p)] ?? ctx.nameOf(p)).join(', ')
}
function riskList(s: Set<string>): string {
  return RISK_ORDER.filter((r) => s.has(r)).map((r) => RISK_LABEL[r]).join(', ')
}

/** The `Users → Include: … Exclude …` line for a policy. */
function usersLine(f: PolicyFacts, ctx: PortalContext): string {
  // Workload identities are their own include shape (the Entra Connect block).
  if (f.workload) {
    const sps = f.workload.sps.size > 0 ? names(f.workload.sps, ctx) : (f.workload.filterRule ?? '')
    return `Users or workload identities → Workload identities → Select service principals → ${sps}`
  }
  const include: string[] = []
  if (f.who.all) include.push('All users')
  if (f.who.roles.size > 0) include.push(`Directory roles → ${names(f.who.roles, ctx)}`)
  if (f.who.guests !== null) {
    const kinds = f.who.guests.length > 0 ? f.who.guests.map((t) => GUEST_TYPE_LABEL[lc(t)] ?? t).join(', ') : 'all types'
    include.push(`Guest or external users → ${kinds}`)
  }
  if (f.who.groups.size > 0) include.push(`Groups: ${names(f.who.groups, ctx)}`)
  if (f.who.users.size > 0) include.push(names(f.who.users, ctx))
  const includeClause = include.length > 0 ? include.join(', ') : 'All users'

  // Excludes: the exclusions group is always the shared line; other excludes are
  // named in the vocabulary the content file uses for them (§8.9). A set the
  // include names is never excluded on the same line: an exclude wins in Entra,
  // so "Include: G … Exclude: G" would name a policy that applies to nobody.
  const parts = [`Users → Include: ${includeClause}.`]
  const included = (id: string | null | undefined): boolean => id != null && [...f.who.groups].some((g) => lc(g) === lc(id))
  const is = (id: string, other: string | null | undefined): boolean => other != null && lc(id) === lc(other)
  const excludesGroup = (id: string | null | undefined): boolean => id != null && [...f.whoNot.groups].some((g) => lc(g) === lc(id))
  // The exclusions group is always the shared sentence. Where the ids are known
  // the sentence stands for that group alone; a body rendered without them keeps
  // the older reading, that any exclusion is the exclusions group.
  const knowsIds = ctx.exclusionsGroupId != null
  const excludesExclusionsGroup = knowsIds ? excludesGroup(ctx.exclusionsGroupId) : f.whoNot.groups.size > 0 || f.whoNot.users.size > 0
  if (excludesExclusionsGroup && !included(ctx.exclusionsGroupId)) parts.push(ctx.exclusionsLine)
  if (ctx.serviceAccountsGroupId != null && excludesGroup(ctx.serviceAccountsGroupId) && !included(ctx.serviceAccountsGroupId)) parts.push(`Also exclude the service accounts group ${ctx.nameOf(ctx.serviceAccountsGroupId)}.`)
  const sharedExcluded = (ctx.sharedDeviceIds ?? []).filter((id) => f.whoNot.users.has(id) && !f.who.users.has(id))
  if (sharedExcluded.length > 0) parts.push(`Also exclude the shared-device accounts ${names(sharedExcluded, ctx)}.`)
  // Every other object the policy excludes is named, so an exclusion a person
  // confirmed is not swallowed by the sentence about the exclusions group.
  if (knowsIds) {
    const otherGroups = [...f.whoNot.groups].filter((g) => !is(g, ctx.exclusionsGroupId) && !is(g, ctx.serviceAccountsGroupId) && !included(g))
    if (otherGroups.length > 0) parts.push(`Also exclude the groups ${names(otherGroups, ctx)}.`)
    const excludedRoles = [...f.whoNot.roles].filter((r) => ![...f.who.roles].some((x) => lc(x) === lc(r)))
    if (excludedRoles.length > 0) parts.push(`Also exclude the directory roles ${names(excludedRoles, ctx)}.`)
    // The emergency accounts are members of the exclusions group and are never
    // named on a line; the shared-device accounts have their own line above.
    const covered = new Set([...(ctx.sharedDeviceIds ?? []), ...(ctx.emergencyIds ?? [])].map(lc))
    const otherUsers = [...f.whoNot.users].filter((u) => !covered.has(lc(u)) && !f.who.users.has(u))
    if (otherUsers.length > 0) parts.push(`Also exclude ${names(otherUsers, ctx)}.`)
  }
  // An exclude of every guest type reads as all types; one that names the types
  // names them in the portal's words (the partner answer excludes Service provider users).
  if (f.whoNot.guests) {
    const types = f.whoNot.guestTypes ?? []
    const all = types.length === 0 || Object.keys(GUEST_TYPE_LABEL).every((t) => types.some((x) => lc(x) === t))
    const includedTypes = f.who.guests === null ? null : f.who.guests.length === 0 ? 'all' : new Set(f.who.guests.map(lc))
    const sameAsInclude = includedTypes === 'all' ? all : includedTypes !== null && !all && types.length === includedTypes.size && types.every((t) => includedTypes.has(lc(t)))
    if (!sameAsInclude) parts.push(all ? 'Also exclude Guest or external users (all types).' : `Also exclude Guest or external users → ${types.map((t) => GUEST_TYPE_LABEL[lc(t)] ?? t).join(', ')}.`)
  }
  return parts.join(' ')
}

/** The `Target resources → …` line. */
function resourcesLine(f: PolicyFacts, ctx: PortalContext): string | null {
  const a = f.apps
  if (a.userActions.has('urn:user:registersecurityinfo')) return 'Target resources → User actions → Register security information'
  if (a.userActions.has('urn:user:registerdevice')) return 'Target resources → User actions → Register or join devices'
  if (a.authContexts.size > 0) return `Target resources → Authentication context → ${names(a.authContexts, ctx)}`
  if (a.all) return 'Target resources → Resources → All resources'
  const selected: string[] = []
  if (a.office365) selected.push('Office 365')
  if (a.adminPortals) selected.push('Microsoft Admin Portals')
  for (const id of a.ids) selected.push(ctx.nameOf(id))
  if (selected.length > 0) return `Target resources → Resources → Select resources → ${selected.join(', ')}`
  return null
}

/** Each condition present, one line each (§6.5 lists conditions before the control). */
function conditionLines(f: PolicyFacts, ctx: PortalContext): string[] {
  const out: string[] = []
  if (f.locations) {
    const inc = [...f.locations.include].map((l) => (/^all$/i.test(l) ? 'Any location' : ctx.nameOf(l))).join(', ')
    // A location the include names is not excluded beside it (the same set on both sides names nobody).
    const includedLoc = new Set([...f.locations.include].map(lc))
    const exc = [...f.locations.exclude].filter((l) => !includedLoc.has(lc(l))).map((l) => (/^alltrusted$/i.test(l) ? 'All trusted locations' : ctx.nameOf(l))).join(', ')
    out.push(`Conditions → Locations → Include: ${inc || 'Any location'}${exc ? `; Exclude: ${exc}` : ''}`)
  }
  const clientApps = [...f.clientApps].filter((c) => c !== 'all')
  if (clientApps.length > 0) out.push(`Conditions → Client apps → ${clientApps.map((c) => CLIENT_APP_LABEL[c] ?? c).join(', ')}`)
  if (f.flows.size > 0) out.push(`Conditions → Authentication flows → ${[...f.flows].map((t) => FLOW_LABEL[lc(t)] ?? t).join(', ')}`)
  if (f.platforms && (f.platforms.include.size > 0 || f.platforms.exclude.size > 0)) {
    // Graph's `all` is the portal's Any device, never a name.
    const named = new Set([...f.platforms.include].filter((p) => !/^all$/i.test(p)))
    const inc = named.size > 0 ? platformList(named, ctx) : 'Any device'
    // A platform the include names is not excluded beside it.
    const namedLc = new Set([...named].map(lc))
    const excluded = new Set([...f.platforms.exclude].filter((p) => !namedLc.has(lc(p))))
    const exc = excluded.size > 0 ? `; Exclude: ${platformList(excluded, ctx)}` : ''
    out.push(`Conditions → Device platforms → Include: ${inc}${exc}`)
  }
  if (f.deviceFilter) out.push(`Conditions → Filter for devices → ${f.deviceFilter.mode === 'exclude' ? 'Exclude' : 'Include'} devices matching: ${f.deviceFilter.rule}`)
  if (f.signInRisk.size > 0) out.push(`Conditions → Sign-in risk → ${riskList(f.signInRisk)}`)
  if (f.userRisk.size > 0) out.push(`Conditions → User risk → ${riskList(f.userRisk)}`)
  return out
}

const GRANT_LABEL: Record<string, string> = {
  compliantdevice: 'Require device to be marked as compliant',
  domainjoineddevice: 'Require Microsoft Entra hybrid joined device',
  compliantapplication: 'Require app protection policy',
  passwordchange: 'Require password change',
  approvedapplication: 'Require approved client app',
}

/** The `Grant → …` line, or null when the policy is session-only. */
function grantLine(f: PolicyFacts, ctx: PortalContext, override?: GrantOverride): string | null {
  if (!f.grant) return null
  if (override === 'mfa') return 'Grant → Require multifactor authentication'
  const controls = new Set([...f.grant.controls].map(lc))
  if (controls.has('block')) return 'Grant → Block access'
  const reqs: string[] = []
  if (f.grant.strengthId) reqs.push(`Require authentication strength: ${ctx.strengthName ?? 'Multifactor authentication'}`)
  else if (controls.has('mfa')) reqs.push('Require multifactor authentication')
  for (const c of ['compliantdevice', 'domainjoineddevice', 'compliantapplication', 'passwordchange', 'approvedapplication'])
    if (controls.has(c)) reqs.push(GRANT_LABEL[c])
  if (reqs.length === 0) return null
  let line = `Grant → ${reqs.join(', ')}`
  if (reqs.length > 1) line += f.grant.operator === 'OR' ? '; Require one of the selected controls' : '; Require all the selected controls'
  return line
}

/** Durations in words (§8.4): never `168h`. */
function hoursInWords(hours: number): string {
  if (hours % 168 === 0) return hours === 168 ? 'weekly' : `${hours / 24} days`
  if (hours % 24 === 0) return hours === 24 ? 'daily' : `${hours / 24} days`
  return `${hours} hours`
}

/** The `Session → …` lines. */
function sessionLines(f: PolicyFacts): string[] {
  const s = f.session
  const out: string[] = []
  if (s.signInFrequencyEveryTime) out.push('Session → Sign-in frequency → Every time')
  else if (s.signInFrequencyHours !== null) out.push(`Session → Sign-in frequency → Periodic reauthentication → ${hoursInWords(s.signInFrequencyHours)}`)
  if (s.persistentBrowser === 'never') out.push('Session → Persistent browser session → Never persistent')
  if (s.persistentBrowser === 'always') out.push('Session → Persistent browser session → Always persistent')
  if (s.appEnforced) out.push('Session → Use app enforced restrictions')
  if (s.cloudAppSecurity) out.push('Session → Use Conditional Access App Control → Block downloads')
  if (s.secureSignInSession) out.push('Session → Require token protection for sign-in sessions')
  return out
}

/**
 * The numbered portal lines for one policy, in the content file's order: root,
 * name, users, resources, conditions, the grant or session control, the state.
 * Every line is resolved — no `{placeholder}` survives. A policy with neither a
 * grant nor a session control returns a block with no control line, which the
 * caller treats as a build failure (shape-01).
 */
export function portalLines(f: PolicyFacts, ctx: PortalContext, opts: { mode?: PortalMode; grantOverride?: GrantOverride; only?: ReadonlySet<PortalSection> } = {}): string[] {
  const mode = opts.mode ?? 'new'
  // An update: open the policy the operation names, list the fields its body
  // carries, and say that nothing else on the policy is touched. The lines are
  // the operation's, so a field the body leaves out is never instructed here.
  if (opts.only) {
    const only = opts.only
    const out: string[] = [ctx.portalOpen ?? ctx.portalRoot]
    if (only.has('users')) out.push(usersLine(f, ctx))
    if (only.has('applications')) {
      const res = resourcesLine(f, ctx)
      if (res) out.push(res)
    }
    if (only.has('grant')) {
      const grant = grantLine(f, ctx, opts.grantOverride)
      if (grant) out.push(grant)
    }
    if (only.has('session')) out.push(...sessionLines(f))
    if (only.has('state') && ctx.enableLine) out.push(ctx.enableLine)
    if (ctx.changeUntouched) out.push(ctx.changeUntouched)
    return out
  }
  const out: string[] = []
  out.push(mode === 'change' ? (ctx.portalOpen ?? ctx.portalRoot) : ctx.portalRoot)
  if (mode !== 'change') out.push(`Name: ${ctx.policyName}`)
  out.push(usersLine(f, ctx))
  const res = resourcesLine(f, ctx)
  if (res) out.push(res)
  out.push(...conditionLines(f, ctx))
  const grant = grantLine(f, ctx, opts.grantOverride)
  if (grant) out.push(grant)
  out.push(...sessionLines(f))
  out.push(ctx.reportOnlyLine)
  return out
}

/** True when the block carries a grant or session control (shape-01). */
export function endsInControl(lines: string[]): boolean {
  return lines.some((l) => l.startsWith('Grant →') || l.startsWith('Session →'))
}

/** True when a line still carries an unresolved `{placeholder}` token. */
export function hasUnresolvedPlaceholder(lines: string[]): boolean {
  return lines.some((l) => /\{[a-zA-Z][\w:]*\}/.test(l))
}

/**
 * A goal the baseline implements with two policies (mergesGoals): Policy A and
 * Policy B, each its own block, labelled. The step body supplies the two names.
 */
export function portalLinesAB(
  a: { facts: PolicyFacts; ctx: PortalContext },
  b: { facts: PolicyFacts; ctx: PortalContext },
  labels: { a: string; b: string },
): string[] {
  return labelledBlocks({ lines: portalLines(a.facts, a.ctx), name: a.ctx.policyName }, { lines: portalLines(b.facts, b.ctx), name: b.ctx.policyName }, labels)
}

/** Two policies' lines as Policy A and Policy B blocks, each labelled with its name on its root line (the one shape, whoever built the lines). */
export function labelledBlocks(a: { lines: string[]; name: string }, b: { lines: string[]; name: string }, labels: { a: string; b: string }): string[] {
  const block = (label: string, one: { lines: string[]; name: string }): string[] => {
    const [root, ...rest] = one.lines
    return [`Policy ${label} — ${one.name}: ${root}`, ...rest]
  }
  return [...block(labels.a, a), ...block(labels.b, b)]
}
