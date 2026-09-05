// Whether a step has a policy operation to run, and which of its operations are
// valid (Foundation A). The one decision, in the one place, so the screen, the
// exports, the schedule and the calendar cannot disagree about whether a policy
// can be implemented.
//
// An operation is valid when its mode and its target agree: a create names no
// tenant policy, an update names exactly one and carries at least one field to
// change. A step whose operations do not all pass — a plan file written by an
// older version, an import, a body edited by hand — offers nothing rather than
// something half-understood.
//
// And what an operation *means* is read here or held here, never guessed
// downstream: `effectOf` decodes the whole policy an operation leaves behind and
// turns every part of it that the decoding does not consume into a named
// unknown (READ_LEAVES). A field recognised and then ignored would be read as
// though the policy did not carry it, which is the one way a wrong answer gets
// out of this module looking like a right one.
//
// Pure data: no DOM, no network.
import type { Action, PolicyOperation, Step } from './types.ts'
import { hasBaselineConflict } from './baselineConflict.ts'
import builtinStrengths from '../../data/builtin-strengths.json' with { type: 'json' }

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * True when an update's target really is the policy its body leaves behind: a
 * complete policy, and every field the body submits already agreeing with it.
 * A target that disagrees with the request would let one channel describe the
 * policy the tenant ends up with while another submits something else.
 */
function targetAgrees(op: PolicyOperation): boolean {
  const target = op.target
  if (!isObject(target) || Object.keys(target).length === 0) return false
  // Every field the body submits is already in the target. The target carries
  // more — the fields the update leaves alone — so a section the body narrows is
  // compared field by field rather than whole.
  const agrees = (whole: unknown, submitted: unknown): boolean => {
    if (isObject(whole) && isObject(submitted)) return Object.entries(submitted).every(([k, v]) => agrees(whole[k], v))
    return JSON.stringify(whole) === JSON.stringify(submitted)
  }
  return agrees(target, op.body)
}

/** Graph's own annotations travel back with a policy and mean nothing on the way in. */
const isAnnotation = (key: string): boolean => key.includes('@odata.')

const isObjectOnly = (v: unknown, keys: ReadonlySet<string>): v is Record<string, unknown> =>
  isObject(v) && Object.keys(v).every((k) => keys.has(k) || isAnnotation(k))
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const strings = (v: unknown): string[] => arr(v).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
const nonEmpty = (v: unknown): boolean => strings(v).length > 0
/** An absent list is fine; a present one must be a list of names. */
const listOk = (v: unknown, allowed: ReadonlySet<string> | null = null): boolean => {
  if (v === undefined || v === null) return true
  if (!Array.isArray(v)) return false
  return v.every((x) => typeof x === 'string' && x.trim().length > 0 && (allowed === null || allowed.has(x.toLowerCase())))
}
const word = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0

/**
 * The request envelope: the fields a Conditional Access create or update may
 * carry. Graph's own read-only bookkeeping is not among them, and a body
 * carrying it is a request Graph refuses.
 */
const POLICY_FIELDS = new Set(['displayName', 'description', 'state', 'conditions', 'grantControls', 'sessionControls'])
const GRANT_FIELDS = new Set(['operator', 'builtInControls', 'customAuthenticationFactors', 'termsOfUse', 'authenticationStrength'])

/**
 * The conditions IAMAI writes or must carry through from the pinned baseline,
 * each with the shape it has to have. This is not a Graph schema: it is the
 * bounded set the product actually puts on the wire, checked to its values so a
 * malformed payload is held rather than submitted.
 */
const CONDITION_SHAPES = {
  users: (v) => isUsersScope(v),
  applications: (v) =>
    isObjectOnly(v, new Set(['includeApplications', 'excludeApplications', 'includeUserActions', 'includeAuthenticationContextClassReferences'])) &&
    listOk(v.includeApplications) &&
    listOk(v.excludeApplications) &&
    listOk(v.includeUserActions, USER_ACTIONS) &&
    listOk(v.includeAuthenticationContextClassReferences),
  clientApplications: (v) => isWorkloadScope(v),
  clientAppTypes: (v) => Array.isArray(v) && v.length > 0 && listOk(v, CLIENT_APP_TYPES),
  locations: (v) =>
    isObjectOnly(v, new Set(['includeLocations', 'excludeLocations'])) && listOk(v.includeLocations) && listOk(v.excludeLocations) && (nonEmpty(v.includeLocations) || nonEmpty(v.excludeLocations)),
  platforms: (v) => isObjectOnly(v, new Set(['includePlatforms', 'excludePlatforms'])) && listOk(v.includePlatforms, PLATFORMS) && listOk(v.excludePlatforms, PLATFORMS) && nonEmpty(v.includePlatforms),
  devices: (v) => isObjectOnly(v, new Set(['deviceFilter'])) && isFilter(v.deviceFilter),
  signInRiskLevels: (v) => listOk(v, RISK_LEVELS),
  userRiskLevels: (v) => listOk(v, RISK_LEVELS),
  servicePrincipalRiskLevels: (v) => listOk(v, RISK_LEVELS),
  authenticationFlows: (v) => isObjectOnly(v, new Set(['transferMethods'])) && tokens(v.transferMethods, TRANSFER_METHODS),
} satisfies Record<string, (v: unknown) => boolean>

/**
 * Whether `effectOf` turns each condition it will submit into part of the scope
 * or into a narrowing of its own, or can only hold it unknown. Every field the
 * submission decoder accepts has an entry, so a condition cannot be added to the
 * wire without a decision about what it *means*: a key nothing reads would
 * otherwise be read as though the condition were not there.
 */
const CONDITION_READING: Record<keyof typeof CONDITION_SHAPES, boolean> = {
  users: true,
  applications: true,
  clientApplications: true,
  clientAppTypes: true,
  locations: true,
  platforms: true,
  devices: true,
  signInRiskLevels: true,
  userRiskLevels: true,
  servicePrincipalRiskLevels: true,
  authenticationFlows: true,
}
const RISK_LEVELS = new Set(['low', 'medium', 'high', 'none', 'hidden', 'unknownfuturevalue'])
const CLIENT_APP_TYPES = new Set(['all', 'browser', 'mobileappsanddesktopclients', 'exchangeactivesync', 'easunsupported', 'other'])
/** The client app kinds that are the old protocols: a policy naming only these is the legacy-authentication block. */
const LEGACY_CLIENT_APP_TYPES = new Set(['exchangeactivesync', 'easunsupported', 'other'])
const PLATFORMS = new Set(['all', 'android', 'ios', 'windows', 'windowsphone', 'macos', 'linux', 'unknownfuturevalue'])
const USER_ACTIONS = new Set(['urn:user:registersecurityinfo', 'urn:user:registerdevice'])
const TRANSFER_METHODS = new Set(['devicecodeflow', 'authenticationtransfer'])
const GUEST_TYPES = new Set([
  'internalguest',
  'b2bcollaborationguest',
  'b2bcollaborationmember',
  'b2bdirectconnectuser',
  'otherexternaluser',
  'serviceprovider',
  'unknownfuturevalue',
])
const SIGN_IN_FREQUENCY_TYPES = new Set(['days', 'hours'])
const FREQUENCY_INTERVALS = new Set(['timeBased', 'everyTime'])
const AUTHENTICATION_TYPES = new Set(['primaryAndSecondaryAuthentication', 'secondaryAuthentication'])
const PERSISTENT_BROWSER_MODES = new Set(['always', 'never'])
const CLOUD_APP_SECURITY_TYPES = new Set(['mcasConfigured', 'monitorOnly', 'blockDownloads', 'unknownFutureValue'])
const USER_SCOPE_FIELDS = new Set([
  'includeUsers',
  'excludeUsers',
  'includeGroups',
  'excludeGroups',
  'includeRoles',
  'excludeRoles',
  'includeGuestsOrExternalUsers',
  'excludeGuestsOrExternalUsers',
])
const MEMBERSHIP_KINDS = new Set(['all', 'enumerated', 'unknownfuturevalue'])

/** A comma-joined list of names, every one of them one Conditional Access has. */
const tokens = (v: unknown, allowed: ReadonlySet<string>): boolean => {
  if (typeof v !== 'string') return false
  const parts = v.split(',').map((x) => x.trim().toLowerCase()).filter((x) => x.length > 0)
  return parts.length > 0 && parts.every((x) => allowed.has(x))
}
/** Whether a session control is switched on: an absent flag is on, `false` is off. */
const enabled = (v: unknown): boolean => isObject(v) && v.isEnabled !== false

/** A filter has a mode and a rule, or it filters nothing. */
const isFilter = (v: unknown): boolean => isObjectOnly(v, new Set(['mode', 'rule'])) && ['include', 'exclude'].includes(String(v.mode).toLowerCase()) && word(v.rule)

/** A guest clause names the kinds of guest it means, and which tenants they come from. */
function isGuestClause(v: unknown): boolean {
  if (!isObjectOnly(v, new Set(['guestOrExternalUserTypes', 'externalTenants']))) return false
  if (!tokens(v.guestOrExternalUserTypes, GUEST_TYPES)) return false
  const tenants = v.externalTenants
  if (!isObjectOnly(tenants, new Set(['membershipKind', 'members']))) return false
  const kind = String(tenants.membershipKind).toLowerCase()
  if (!MEMBERSHIP_KINDS.has(kind)) return false
  // A clause that names its tenants one by one has to name them.
  return kind !== 'enumerated' || nonEmpty(tenants.members)
}

/** The people clause: lists of ids, and guest clauses that say what they mean. */
function isUsersScope(v: unknown): boolean {
  if (!isObjectOnly(v, USER_SCOPE_FIELDS)) return false
  for (const k of ['includeUsers', 'excludeUsers', 'includeGroups', 'excludeGroups', 'includeRoles', 'excludeRoles']) if (!listOk(v[k])) return false
  for (const k of ['includeGuestsOrExternalUsers', 'excludeGuestsOrExternalUsers']) if (v[k] !== undefined && v[k] !== null && !isGuestClause(v[k])) return false
  return true
}

/** The workload clause: the service principals it names, or a filter that names them. */
function isWorkloadScope(v: unknown): boolean {
  if (!isObjectOnly(v, new Set(['includeServicePrincipals', 'excludeServicePrincipals', 'servicePrincipalFilter']))) return false
  if (!listOk(v.includeServicePrincipals) || !listOk(v.excludeServicePrincipals)) return false
  const filter = v.servicePrincipalFilter
  if (filter !== undefined && filter !== null && !isFilter(filter)) return false
  return nonEmpty(v.includeServicePrincipals) || (filter !== undefined && filter !== null)
}

/**
 * The grant controls Conditional Access has. IAMAI submits any of them, because
 * the pinned baseline may hold any of them; it reads only the ones it has a
 * reading for, and says so about the rest.
 */
const SUBMITTABLE_CONTROLS = new Set([
  'block',
  'mfa',
  'compliantdevice',
  'domainjoineddevice',
  'approvedapplication',
  'compliantapplication',
  'passwordchange',
  'riskremediation',
])

/** The ones IAMAI can say something about. Anything else is carried and held unknown. */
const READABLE_CONTROLS = new Set(['block', 'mfa', 'compliantdevice', 'domainjoineddevice', 'approvedapplication', 'compliantapplication', 'passwordchange'])

/** What each of Microsoft's built-in authentication strengths allows; their ids describe them in every tenant. */
export const BUILT_IN_STRENGTHS = new Map<string, string[]>(builtinStrengths.strengths.map((s) => [s.id.toLowerCase(), s.allowedCombinations]))

/** The device requirements: a policy that asks for one asks for a machine the tenant manages, in the way it names. */
const DEVICE_CONTROLS = new Set(['compliantdevice', 'domainjoineddevice'])
/** The application requirements: a policy that asks for one asks for an app the tenant approves or protects. */
const APP_CONTROLS = new Set(['approvedapplication', 'compliantapplication'])

/** The states a Conditional Access policy may be in. */
const POLICY_STATES = new Set(['enabled', 'disabled', 'enabledForReportingButNotEnforced'])

/** The session controls IAMAI writes or carries, each with the shape it has to have. */
const SESSION_SHAPES = {
  // A sign-in frequency that is on says how often: every time, or a number of
  // hours or days. "On", with nothing else, is not a setting Graph can apply.
  signInFrequency: (v) => {
    if (!isObjectOnly(v, new Set(['isEnabled', 'type', 'value', 'authenticationType', 'frequencyInterval']))) return false
    if (v.authenticationType !== undefined && !AUTHENTICATION_TYPES.has(String(v.authenticationType))) return false
    if (!enabled(v)) return true
    if (v.frequencyInterval !== undefined && !FREQUENCY_INTERVALS.has(String(v.frequencyInterval))) return false
    // "Every time" carries no interval of its own; Graph writes the two fields as null.
    if (v.frequencyInterval === 'everyTime') return (v.type ?? null) === null && (v.value ?? null) === null
    return SIGN_IN_FREQUENCY_TYPES.has(String(v.type)) && typeof v.value === 'number' && Number.isFinite(v.value) && v.value > 0
  },
  persistentBrowser: (v) => isObjectOnly(v, new Set(['isEnabled', 'mode'])) && (!enabled(v) || PERSISTENT_BROWSER_MODES.has(String(v.mode))),
  secureSignInSession: (v) => isObjectOnly(v, new Set(['isEnabled'])) && typeof v.isEnabled === 'boolean',
  applicationEnforcedRestrictions: (v) => isObjectOnly(v, new Set(['isEnabled'])) && typeof v.isEnabled === 'boolean',
  cloudAppSecurity: (v) => isObjectOnly(v, new Set(['isEnabled', 'cloudAppSecurityType'])) && (!enabled(v) || CLOUD_APP_SECURITY_TYPES.has(String(v.cloudAppSecurityType))),
  disableResilienceDefaults: (v) => typeof v === 'boolean' || v === null,
} satisfies Record<string, (v: unknown) => boolean>

/**
 * Whether `effectOf` can say what each session control it will submit does to
 * the people the policy reaches. A sign-in frequency and a browser-persistence
 * setting shorten a session and deny nobody; token protection is a requirement
 * of its own. The rest — a restriction the application enforces, a session a
 * cloud-app proxy governs — narrow what a session may do by evidence about the
 * client and the device that the scan does not hold, so they are held unknown
 * rather than read as harmless.
 */
const SESSION_READING: Record<keyof typeof SESSION_SHAPES, boolean> = {
  signInFrequency: true,
  persistentBrowser: true,
  secureSignInSession: true,
  disableResilienceDefaults: true,
  applicationEnforcedRestrictions: false,
  cloudAppSecurity: false,
}

/**
 * Every leaf of a policy the decoding below actually consumes. A field the
 * decoder recognises but never reads is the one failure this table exists to
 * make impossible: `effectOf` walks the policy it is given and turns any leaf
 * that is not here — and whose whole field is not already held unknown — into an
 * explicit unknown. So a sub-field can be added to the wire, or arrive on a
 * tenant's own policy, without being read as though it were not there.
 *
 * The depth is where the ignoring happens: two levels inside `conditions` (an
 * excluded application is not an included one), one inside the grant and the
 * session (a control is read whole, on or off).
 */
const READ_LEAVES = new Set([
  // Who: every include and exclude list, and the guest clauses (scopeOf).
  'conditions.users.includeUsers',
  'conditions.users.excludeUsers',
  'conditions.users.includeGroups',
  'conditions.users.excludeGroups',
  'conditions.users.includeRoles',
  'conditions.users.excludeRoles',
  'conditions.users.includeGuestsOrExternalUsers',
  'conditions.users.excludeGuestsOrExternalUsers',
  // What: the resources it names, the ones it leaves out, the user actions and
  // the authentication contexts it applies at.
  'conditions.applications.includeApplications',
  'conditions.applications.excludeApplications',
  'conditions.applications.includeUserActions',
  'conditions.applications.includeAuthenticationContextClassReferences',
  // A workload policy reaches service principals and no person at all, whichever
  // ones it names.
  'conditions.clientApplications.includeServicePrincipals',
  'conditions.clientApplications.excludeServicePrincipals',
  'conditions.clientApplications.servicePrincipalFilter',
  // When: the client kinds, the places, the platforms, the device rule, the two
  // risk questions kept apart, and the sign-in flows.
  'conditions.clientAppTypes',
  'conditions.locations.includeLocations',
  'conditions.locations.excludeLocations',
  'conditions.platforms.includePlatforms',
  'conditions.platforms.excludePlatforms',
  'conditions.devices.deviceFilter',
  'conditions.signInRiskLevels',
  'conditions.userRiskLevels',
  'conditions.servicePrincipalRiskLevels',
  'conditions.authenticationFlows.transferMethods',
  // The grant: how it combines, what it requires, and the two references it may
  // carry beside them.
  'grantControls.operator',
  'grantControls.builtInControls',
  'grantControls.authenticationStrength',
  'grantControls.customAuthenticationFactors',
  'grantControls.termsOfUse',
  // The session: each control read whole, on or off (SESSION_READING says which
  // of them IAMAI can say anything about once it is on).
  'sessionControls.signInFrequency',
  'sessionControls.persistentBrowser',
  'sessionControls.secureSignInSession',
  'sessionControls.applicationEnforcedRestrictions',
  'sessionControls.cloudAppSecurity',
  'sessionControls.disableResilienceDefaults',
])

/**
 * The leaves a policy actually carries, at the depth the reading is decided:
 * `conditions.<field>.<part>` and `grantControls.<control>`. Graph's own
 * annotations are not fields.
 */
function semanticLeaves(body: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const [section, deep] of [['conditions', true], ['grantControls', false], ['sessionControls', false]] as const) {
    const value = body[section]
    if (!isObject(value)) continue
    for (const [k, v] of Object.entries(value)) {
      if (isAnnotation(k)) continue
      if (deep && isObject(v)) {
        for (const k2 of Object.keys(v)) if (!isAnnotation(k2)) out.push(`${section}.${k}.${k2}`)
        continue
      }
      out.push(`${section}.${k}`)
    }
  }
  return out
}

/**
 * A condition that decides *when* a policy applies, rather than who it names.
 * Some of these the tenant scan can answer for one account exactly — the old
 * protocols, the device-code and authentication-transfer flows, a risk level, a
 * place. The rest it cannot answer at all, and a policy carrying one is held
 * unknown rather than read as though the condition were not there.
 */
export type Narrowing =
  | { kind: 'legacyClients' }
  | { kind: 'clientAppTypes'; types: string[] }
  | { kind: 'signInFlow'; methods: string[] }
  | { kind: 'signInRisk'; levels: string[] }
  | { kind: 'userRisk'; levels: string[] }
  | { kind: 'locations'; include: string[]; exclude: string[] }
  | { kind: 'platforms' }
  | { kind: 'applications'; ids: string[]; exclude: string[]; none: boolean }
  | { kind: 'userActions'; actions: string[] }
  | { kind: 'authContext'; ids: string[] }
  | { kind: 'workloadRisk'; levels: string[] }
  | { kind: 'deviceFilter' }

/** One thing a policy asks a person for. Kept apart: a device is not an app, and neither is a method. */
export type Requirement =
  | { kind: 'mfa' }
  | { kind: 'passwordChange' }
  | { kind: 'strength'; id: string }
  | { kind: 'device'; control: 'compliantdevice' | 'domainjoineddevice' }
  | { kind: 'app'; control: 'approvedapplication' | 'compliantapplication' }
  | { kind: 'tokenProtection' }
  | { kind: 'other'; control: string }

/**
 * Who and what a policy reaches, decoded from its own conditions. Every list is
 * the policy's own; nothing here comes from the goal a step is filed under or
 * from the people the step happens to list.
 */
export type PolicyScope = {
  /** It names every user in the tenant. */
  allUsers: boolean
  users: { include: string[]; exclude: string[] }
  groups: { include: string[]; exclude: string[] }
  roles: { include: string[]; exclude: string[] }
  guests: { include: boolean; exclude: boolean }
  /** It reaches service principals and no person at all. */
  workloadOnly: boolean
  applications: { include: string[]; exclude: string[]; userActions: string[]; authContexts: string[] }
}

/**
 * True when the people a policy names are all inside a list somebody else holds
 * — every one of them named outright, and none of them reached through a group,
 * a role, a guest clause or "all users" that the list cannot stand for. Nothing
 * may read a step's own population as the policy's reach without this.
 */
export function scopeBoundedBy(scope: PolicyScope, ids: readonly string[]): boolean {
  if (scope.workloadOnly || scope.allUsers || scope.guests.include) return false
  if (scope.groups.include.length > 0 || scope.roles.include.length > 0) return false
  if (scope.users.include.length === 0) return false
  const known = new Set(ids.map((i) => i.toLowerCase()))
  return scope.users.include.every((u) => known.has(u.toLowerCase()))
}

/**
 * What a policy asks of the people it reaches, read from the policy itself.
 * Everything that decides what a change means — what it can deny, who it would
 * strand, what it waits on, how it batches, how long it is watched — reads this
 * and never the goal it is filed under. Where the policy says something IAMAI
 * cannot decode, `unknown` says so; nothing guesses.
 */
export type PolicyEffect = {
  /** It stops the sign-in outright. */
  blocks: boolean
  /** Whether a person must satisfy every requirement or any one of them. */
  operator: 'AND' | 'OR'
  /** Each thing it asks for, kept distinct. */
  requirements: Requirement[]
  /** Who and what it reaches. */
  scope: PolicyScope
  /** The conditions that decide when it applies, each kept as it stands. */
  narrowings: Narrowing[]
  /** The built-in grant controls it requires, lowercased. */
  controls: ReadonlySet<string>
  /** The authentication strength it requires, as the reference the request carries. */
  strength: { id: string } | null
  /** It requires a device the tenant manages. */
  requiresDevice: boolean
  /** It asks for a sign-in method: multifactor authentication, or a strength. */
  asksForMethod: boolean
  /** The named locations it scopes by, or null where it names none. */
  locationIds: { include: string[]; exclude: string[] } | null
  /** It narrows where people may sign in from. */
  usesLocations: boolean
  /** The risk levels it applies above. */
  riskLevels: string[]
  /** It applies only above a risk level. */
  usesRisk: boolean
  /** What it does to a session, where it does anything. */
  sessionControls: { signInFrequency: boolean; signInFrequencyEveryTime: boolean; persistentBrowser: boolean; tokenProtection: boolean; other: boolean } | null
  /** It changes what a session may do or how long it lives. */
  session: boolean
  /** It does something: a grant, or a session control. */
  any: boolean
  /** Why this policy cannot be read in full; empty when it can. */
  unknown: string[]
}

/** Who a policy's conditions reach, decoded. */
function scopeOf(conditions: Record<string, unknown>): PolicyScope {
  const users = isObject(conditions.users) ? conditions.users : null
  const workload = isObject(conditions.clientApplications) ? conditions.clientApplications : null
  const apps = isObject(conditions.applications) ? conditions.applications : null
  const include = strings(users?.includeUsers)
  return {
    allUsers: include.some((u) => u.toLowerCase() === 'all'),
    users: { include: include.filter((u) => u.toLowerCase() !== 'all'), exclude: strings(users?.excludeUsers) },
    groups: { include: strings(users?.includeGroups), exclude: strings(users?.excludeGroups) },
    roles: { include: strings(users?.includeRoles), exclude: strings(users?.excludeRoles) },
    guests: { include: isObject(users?.includeGuestsOrExternalUsers), exclude: isObject(users?.excludeGuestsOrExternalUsers) },
    workloadOnly: users === null && workload !== null,
    applications: {
      include: strings(apps?.includeApplications),
      exclude: strings(apps?.excludeApplications),
      userActions: strings(apps?.includeUserActions),
      authContexts: strings(apps?.includeAuthenticationContextClassReferences),
    },
  }
}

/** What one policy body does, decoded exactly or held unknown. */
export function effectOf(body: Record<string, unknown>): PolicyEffect {
  const unknown: string[] = []
  // The fields an unknown already covers: the gap pass below does not name them
  // a second time.
  const held = new Set<string>()
  const grant = isObject(body.grantControls) ? body.grantControls : null
  const named = arr(grant?.builtInControls).filter((c): c is string => typeof c === 'string').map((c) => c.toLowerCase())
  const controls = new Set(named.filter((c) => READABLE_CONTROLS.has(c)))
  const foreign = named.filter((c) => !READABLE_CONTROLS.has(c))
  for (const c of foreign) unknown.push(`a grant control IAMAI has no reading for: ${c}`)
  // The request carries a reference and nothing else. What the strength allows
  // is the tenant's own metadata, read where the answer is needed
  // (strengthLookupOf), never a description travelling beside the id.
  const rawStrength = grant && isObject(grant.authenticationStrength) ? grant.authenticationStrength : null
  const strength = rawStrength && typeof rawStrength.id === 'string' && rawStrength.id.trim().length > 0 ? { id: rawStrength.id } : null
  if (rawStrength && strength === null) unknown.push('an authentication strength with no id')
  if (grant && nonEmpty(grant.customAuthenticationFactors)) unknown.push('a custom authentication factor')
  if (grant && nonEmpty(grant.termsOfUse)) unknown.push('terms of use')
  const conditions = isObject(body.conditions) ? body.conditions : {}
  for (const k of Object.keys(conditions)) {
    if (isAnnotation(k)) continue
    const reading = CONDITION_READING[k as keyof typeof CONDITION_READING]
    if (reading === undefined) unknown.push(`a condition IAMAI has no reading for: ${k}`)
    else if (!reading) unknown.push(`a condition IAMAI carries but cannot read: ${k}`)
    if (reading !== true) held.add(`conditions.${k}`)
  }
  if (grant)
    for (const k of Object.keys(grant))
      if (!GRANT_FIELDS.has(k) && !isAnnotation(k)) {
        unknown.push(`a grant setting IAMAI has no reading for: ${k}`)
        held.add(`grantControls.${k}`)
      }
  const locations = isObject(conditions.locations) ? conditions.locations : null
  const locationIds = locations ? { include: strings(locations.includeLocations), exclude: strings(locations.excludeLocations) } : null
  const scope = scopeOf(conditions)
  const narrowings: Narrowing[] = []
  const appTypes = strings(conditions.clientAppTypes).map((t) => t.toLowerCase())
  if (appTypes.length > 0 && !appTypes.includes('all')) {
    if (appTypes.every((t) => LEGACY_CLIENT_APP_TYPES.has(t))) narrowings.push({ kind: 'legacyClients' })
    else narrowings.push({ kind: 'clientAppTypes', types: appTypes })
  }
  const flows = isObject(conditions.authenticationFlows) ? String(conditions.authenticationFlows.transferMethods ?? '') : ''
  if (flows.trim().length > 0) narrowings.push({ kind: 'signInFlow', methods: flows.split(',').map((x) => x.trim()).filter((x) => x.length > 0) })
  // Two different questions, kept apart: the risk of *this sign-in*, which the
  // records measure, and the risk carried by the *account*, which they do not.
  const signInRisk = strings(conditions.signInRiskLevels)
  const userRisk = strings(conditions.userRiskLevels)
  const riskLevels = [...signInRisk, ...userRisk]
  if (signInRisk.length > 0) narrowings.push({ kind: 'signInRisk', levels: signInRisk })
  if (userRisk.length > 0) narrowings.push({ kind: 'userRisk', levels: userRisk })
  if (locationIds !== null && (locationIds.include.length > 0 || locationIds.exclude.length > 0)) narrowings.push({ kind: 'locations', ...locationIds })
  if (isObject(conditions.platforms)) narrowings.push({ kind: 'platforms' })
  if (isObject(conditions.devices)) narrowings.push({ kind: 'deviceFilter' })
  // A policy for every resource narrows nothing; one naming resources or a user
  // action applies only there, and nothing in the scan says where a person goes.
  const namedApps = scope.applications.include.filter((a) => !['all', 'none'].includes(a.toLowerCase()))
  // A policy that names no resource at all applies to no sign-in; one that
  // leaves a resource out is not one that applies everywhere, and an exclusion
  // read as absent would describe a policy the tenant does not have.
  const noApps = scope.applications.include.length > 0 && scope.applications.include.every((a) => a.toLowerCase() === 'none')
  const excludedApps = scope.applications.exclude.filter((a) => a.toLowerCase() !== 'none')
  if (noApps || namedApps.length > 0 || excludedApps.length > 0) narrowings.push({ kind: 'applications', ids: namedApps, exclude: excludedApps, none: noApps })
  if (scope.applications.userActions.length > 0) narrowings.push({ kind: 'userActions', actions: scope.applications.userActions })
  // An authentication context applies where an application asks for it — role
  // activation, a labelled site — and nothing in the scan says when that is.
  if (scope.applications.authContexts.length > 0) narrowings.push({ kind: 'authContext', ids: scope.applications.authContexts })
  const workloadRisk = strings(conditions.servicePrincipalRiskLevels)
  if (workloadRisk.length > 0) narrowings.push({ kind: 'workloadRisk', levels: workloadRisk })
  const raw = isObject(body.sessionControls) ? body.sessionControls : null
  // A control is on when it is there and not switched off: an empty object says
  // nothing, and a flag written `false` is the setting turned off, not a setting.
  const on = (v: unknown): boolean => (isObject(v) ? v.isEnabled !== false && Object.keys(v).length > 0 : typeof v === 'boolean' ? v : v !== null && v !== undefined)
  const sessionControls = raw
    ? {
        signInFrequency: on(raw.signInFrequency),
        // A sign-in frequency of "every time" reauthenticates on every request:
        // the one session setting that can put the person applying it in a loop.
        signInFrequencyEveryTime: on(raw.signInFrequency) && isObject(raw.signInFrequency) && String(raw.signInFrequency.frequencyInterval ?? '') === 'everyTime',
        persistentBrowser: on(raw.persistentBrowser),
        tokenProtection: on(raw.secureSignInSession),
        other: Object.entries(raw).some(([k, v]) => !['signInFrequency', 'persistentBrowser', 'secureSignInSession'].includes(k) && !isAnnotation(k) && on(v)),
      }
    : null
  const session = Boolean(sessionControls && (sessionControls.signInFrequency || sessionControls.persistentBrowser || sessionControls.tokenProtection || sessionControls.other))
  if (raw)
    for (const [k, v] of Object.entries(raw)) {
      if (isAnnotation(k) || !on(v)) continue
      const reading = SESSION_READING[k as keyof typeof SESSION_READING]
      if (reading === undefined) unknown.push(`a session control IAMAI has no reading for: ${k}`)
      else if (!reading) unknown.push(`a session control IAMAI carries but cannot read: ${k}`)
      if (reading !== true) held.add(`sessionControls.${k}`)
    }
  const requirements: Requirement[] = []
  if (strength) requirements.push({ kind: 'strength', id: strength.id })
  for (const c of controls) {
    if (c === 'block') continue
    if (c === 'mfa') requirements.push({ kind: 'mfa' })
    else if (c === 'passwordchange') requirements.push({ kind: 'passwordChange' })
    else if (DEVICE_CONTROLS.has(c)) requirements.push({ kind: 'device', control: c as 'compliantdevice' | 'domainjoineddevice' })
    else if (APP_CONTROLS.has(c)) requirements.push({ kind: 'app', control: c as 'approvedapplication' | 'compliantapplication' })
  }
  // Token protection is the one session control that can stop a sign-in rather
  // than merely shorten it: the client has to be able to bind the token.
  if (sessionControls?.tokenProtection) requirements.push({ kind: 'tokenProtection' })
  // Carried, named and kept apart from the ones IAMAI can read.
  for (const c of foreign) requirements.push({ kind: 'other', control: c })
  // How the controls combine decides whether one failed requirement strands a
  // person or merely closes one way through. A grant that does not say is not
  // read as either: OR stands only so the aggregation has a shape, and the
  // unknown withdraws every verdict the choice could have decided
  // (roadmap/strand.ts policyVerdict).
  const namedOperator = String(grant?.operator ?? '').toUpperCase()
  if (grant !== null && namedOperator !== 'AND' && namedOperator !== 'OR') unknown.push('a grant that does not say how its controls combine')
  const operator = namedOperator === 'AND' ? 'AND' : 'OR'
  // Anything the policy carries that the reading above did not consume is held,
  // by name. A field recognised and ignored would be read as though the policy
  // did not have it (READ_LEAVES).
  for (const leaf of semanticLeaves(body)) {
    if (READ_LEAVES.has(leaf)) continue
    if ([...held].some((h) => leaf === h || leaf.startsWith(`${h}.`))) continue
    unknown.push(`a field IAMAI recognised but did not read: ${leaf}`)
  }
  return {
    blocks: controls.has('block'),
    operator,
    requirements,
    scope,
    narrowings,
    controls,
    strength,
    requiresDevice: requirements.some((r) => r.kind === 'device'),
    asksForMethod: requirements.some((r) => r.kind === 'mfa' || r.kind === 'strength'),
    locationIds,
    usesLocations: locationIds !== null && (locationIds.include.length > 0 || locationIds.exclude.length > 0),
    riskLevels,
    usesRisk: riskLevels.length > 0,
    sessionControls,
    session,
    any: controls.size > 0 || strength !== null || session || unknown.length > 0,
    unknown,
  }
}

/** What each authentication strength this tenant can name allows: Microsoft's own, and the tenant's. */
export function strengthLookupOf(snapshot: { config?: Record<string, { rows?: unknown[] } | undefined> }): Map<string, string[]> {
  const lookup = new Map(BUILT_IN_STRENGTHS)
  for (const row of (snapshot.config?.authStrengths?.rows ?? []) as Record<string, unknown>[]) {
    if (typeof row.id === 'string' && Array.isArray(row.allowedCombinations)) lookup.set(row.id.toLowerCase(), strings(row.allowedCombinations))
  }
  return lookup
}

/** Whether a policy reaches one account: decided from the policy's own scope, or not decided at all. */
export type Applicability = 'in' | 'out' | 'unknown'

/** What the scan can say about who is in a group. A group it holds nothing for cannot be answered. */
export type ScopeEvidence = { groupMembers?: Record<string, readonly string[]> }

/**
 * Whether one policy reaches one account, from the policy's own include and
 * exclude lists. Roles come from the directory; group membership comes from
 * whatever the scan or the plan's own decisions can prove, and a group nothing
 * answers for leaves the whole question unknown rather than guessed.
 */
export function accountApplicability(
  scope: PolicyScope,
  accountId: string,
  snapshot: { roles?: { active?: Record<string, string[]> }; users?: { id: string; userType?: string | null }[] },
  evidence: ScopeEvidence = {},
): Applicability {
  if (scope.workloadOnly) return 'out'
  const roles = new Set(snapshot.roles?.active?.[accountId] ?? [])
  const members = evidence.groupMembers ?? {}
  const inGroup = (id: string): boolean | null => {
    const known = members[id] ?? members[id.toLowerCase()]
    return known === undefined ? null : known.some((m) => m.toLowerCase() === accountId.toLowerCase())
  }
  const same = (a: string): boolean => a.toLowerCase() === accountId.toLowerCase()
  if (scope.users.exclude.some(same)) return 'out'
  if (scope.roles.exclude.some((r) => roles.has(r))) return 'out'
  let unsure = false
  for (const g of scope.groups.exclude) {
    const member = inGroup(g)
    if (member === true) return 'out'
    if (member === null) unsure = true
  }
  // A guest clause reaches guests. Whether this account is one is the
  // directory's answer; where the directory holds no row for it, nobody's.
  const guest = ((): boolean | null => {
    const row = (snapshot.users ?? []).find((u) => u.id === accountId)
    return row === undefined || row.userType === undefined || row.userType === null ? null : row.userType === 'guest'
  })()
  if (scope.guests.exclude) {
    if (guest === true) return 'out'
    if (guest === null) unsure = true
  }
  let included = scope.allUsers || scope.users.include.some(same) || scope.roles.include.some((r) => roles.has(r))
  for (const g of scope.groups.include) {
    const member = inGroup(g)
    if (member === true) included = true
    else if (member === null) unsure = true
  }
  if (scope.guests.include) {
    if (guest === true) included = true
    else if (guest === null) unsure = true
  }
  if (!included) return unsure ? 'unknown' : 'out'
  return unsure ? 'unknown' : 'in'
}

/**
 * Whether a submitted body is one IAMAI would put on the wire. Two different
 * questions live here, and only this one is about the request:
 *
 * - a *field* IAMAI does not write is never submitted, because a create carrying
 *   Graph's read-only bookkeeping is a request Graph refuses;
 * - every value inside a field it does write is checked to the shape it has to
 *   have, so a malformed payload is held rather than sent;
 * - a grant *control* Conditional Access has is always submittable, because the
 *   pinned baseline may hold any of them. Whether IAMAI can read one is the
 *   other question, and effectOf answers it with `unknown`.
 */
function fieldsAreSupported(body: Record<string, unknown>): boolean {
  if (Object.keys(body).some((k) => !POLICY_FIELDS.has(k) && !isAnnotation(k))) return false
  if (body.state !== undefined && (typeof body.state !== 'string' || !POLICY_STATES.has(body.state))) return false
  if (body.displayName !== undefined && !word(body.displayName)) return false
  if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') return false
  if (body.conditions !== undefined) {
    if (!isObject(body.conditions)) return false
    for (const [k, v] of Object.entries(body.conditions)) {
      if (isAnnotation(k)) continue
      const shape = CONDITION_SHAPES[k as keyof typeof CONDITION_SHAPES] as ((v: unknown) => boolean) | undefined
      if (shape === undefined || !shape(v)) return false
    }
  }
  if (body.grantControls !== undefined && body.grantControls !== null) {
    const grant = body.grantControls
    if (!isObjectOnly(grant, GRANT_FIELDS)) return false
    if (!listOk(grant.builtInControls, SUBMITTABLE_CONTROLS)) return false
    if (!listOk(grant.termsOfUse) || !listOk(grant.customAuthenticationFactors)) return false
    const strength = grant.authenticationStrength
    if (strength !== undefined && strength !== null) {
      // A reference, and nothing that describes the object it points at: a name
      // and a list of combinations are the tenant's metadata, not the request's.
      if (!isObjectOnly(strength, new Set(['id']))) return false
      if (!word(strength.id)) return false
    }
    // A grant that grants nothing is not a grant, and one that grants something
    // says how its controls combine.
    const grants = nonEmpty(grant.builtInControls) || (strength !== undefined && strength !== null) || nonEmpty(grant.termsOfUse) || nonEmpty(grant.customAuthenticationFactors)
    if (!grants) return false
    if (!['AND', 'OR'].includes(String(grant.operator))) return false
  }
  if (body.sessionControls !== undefined && body.sessionControls !== null) {
    if (!isObject(body.sessionControls)) return false
    for (const [k, v] of Object.entries(body.sessionControls)) {
      if (isAnnotation(k) || v === null || v === undefined) continue
      const shape = SESSION_SHAPES[k as keyof typeof SESSION_SHAPES] as ((v: unknown) => boolean) | undefined
      if (shape === undefined || !shape(v)) return false
    }
  }
  return true
}

/**
 * True when a body is a Conditional Access policy IAMAI would submit: a name, a
 * state it may be in, the people and the resources it reaches, a real control to
 * apply, and every value in it one Graph would take.
 */
export function isCompletePolicy(body: unknown): body is Record<string, unknown> {
  if (!isObject(body)) return false
  if (!word(body.displayName)) return false
  if (typeof body.state !== 'string' || !POLICY_STATES.has(body.state)) return false
  if (!fieldsAreSupported(body)) return false
  const conditions = isObject(body.conditions) ? body.conditions : null
  if (!conditions) return false
  const users = isObject(conditions.users) ? conditions.users : null
  const workload = isObject(conditions.clientApplications) ? conditions.clientApplications : null
  const scopesPeople =
    (users !== null && (nonEmpty(users.includeUsers) || nonEmpty(users.includeGroups) || nonEmpty(users.includeRoles) || isObject(users.includeGuestsOrExternalUsers))) ||
    workload !== null
  if (!scopesPeople) return false
  const apps = isObject(conditions.applications) ? conditions.applications : null
  const scopesResources =
    (apps !== null && (nonEmpty(apps.includeApplications) || nonEmpty(apps.includeUserActions) || nonEmpty(apps.includeAuthenticationContextClassReferences))) ||
    workload !== null
  if (!scopesResources) return false
  return effectOf(body).any
}

/** True when the fields an update submits are ones IAMAI writes, in the shapes it writes them. */
export function isSubmittablePatch(patch: Record<string, unknown>): boolean {
  if (Object.keys(patch).length === 0) return false
  return fieldsAreSupported(patch)
}

/**
 * True when the target is recognisably the policy the update names: the tenant's
 * own, whatever else it carries. The tenant's policy is not IAMAI's to validate
 * — only the fields the update submits are.
 */
function targetIsPolicy(target: unknown, policyId: string): target is Record<string, unknown> {
  if (!isObject(target)) return false
  if (target.id !== policyId) return false
  if (!word(target.displayName)) return false
  if (typeof target.state !== 'string' || !POLICY_STATES.has(target.state)) return false
  return isObject(target.conditions)
}

/** True when the operation says exactly one thing: create this policy, or change that one. */
export function isValidOperation(op: PolicyOperation | null | undefined): op is PolicyOperation {
  if (!op || typeof op !== 'object') return false
  if (typeof op.sourceName !== 'string') return false
  if (!isObject(op.body)) return false
  if (op.mode === 'create') return (op.policyId === null || op.policyId === undefined) && isCompletePolicy(op.body)
  if (op.mode === 'update') {
    if (typeof op.policyId !== 'string' || op.policyId.length === 0) return false
    // Only what the update submits is IAMAI's to validate; the tenant's own
    // policy may carry anything, and the change does not touch it.
    if (!isSubmittablePatch(op.body)) return false
    if (!targetIsPolicy(op.target, op.policyId)) return false
    return targetAgrees(op)
  }
  return false
}

/** The step's operations, when every one of them is valid; otherwise none. */
export function validOperations(action: Pick<Action, 'resolution'>): PolicyOperation[] {
  const ops = action.resolution?.policies ?? []
  if (ops.length === 0) return []
  return ops.every(isValidOperation) ? ops : []
}

/** Why an open policy cannot be written as it stands. */
export type UnavailableReason = 'missing-object' | 'unmatched-pair' | 'baseline-conflict' | 'no-operation'

/** What any of this applies to: a step that describes a policy. */
type PolicyStep = Pick<Step, 'goalId' | 'action'> & Partial<Pick<Step, 'kind' | 'status'>>

/**
 * True when the step is a policy the plan is still trying to write. A goal
 * already in place is not one: it has nothing to write, which is a result of its
 * own (`isPreserved`), not a failure to produce one.
 */
export function isOpenPolicy(step: PolicyStep): boolean {
  const kind = step.kind ?? step.action.kind
  return (kind === 'create' || kind === 'adjust') && step.status !== 'done' && step.status !== 'skipped'
}

/**
 * What a step's policy work is, in one answer:
 *
 * - `implementable`: operations to run, and nothing stopping them;
 * - `unavailable`: an open policy the plan cannot write, and why;
 * - `preserved`: a goal already in place — nothing to write, and nothing wrong;
 * - `not-policy`: a step that describes no policy, or one set aside.
 *
 * Everything else in this module is a reading of this one answer. Being in place
 * never covers up a reason: a goal whose baseline contradicts itself, whose
 * objects are missing, whose pair cannot be matched, or whose operations do not
 * hold together is unavailable whether or not the tenant already has something.
 */
export type PolicyResult =
  | { kind: 'implementable'; operations: PolicyOperation[] }
  | { kind: 'unavailable'; reason: UnavailableReason }
  | { kind: 'preserved' }
  | { kind: 'not-policy' }

export function policyResult(step: PolicyStep): PolicyResult {
  const kind = step.kind ?? step.action.kind
  if (kind !== 'create' && kind !== 'adjust') return { kind: 'not-policy' }
  if (step.status === 'skipped') return { kind: 'not-policy' }
  if (hasBaselineConflict(step.goalId)) return { kind: 'unavailable', reason: 'baseline-conflict' }
  if (step.action.unmatchedPair === true) return { kind: 'unavailable', reason: 'unmatched-pair' }
  if ((step.action.missing ?? []).length > 0) return { kind: 'unavailable', reason: 'missing-object' }
  const declared = step.action.resolution?.policies ?? []
  const valid = validOperations(step.action)
  if (declared.length > 0 && valid.length === 0) return { kind: 'unavailable', reason: 'no-operation' }
  if (valid.length === 0) return step.status === 'done' ? { kind: 'preserved' } : { kind: 'unavailable', reason: 'no-operation' }
  return step.status === 'done' ? { kind: 'preserved' } : { kind: 'implementable', operations: valid }
}

/**
 * Why an open policy cannot be written as it stands, or null when nothing stops
 * it. The plan treats every reason alike: nothing is scheduled for the step, it
 * takes no date from the wave it sits in, it has no rings, no events, no
 * completion criteria, no rollback and no announcement, and it says what to do
 * about it instead.
 */
export function unavailableReason(step: PolicyStep): UnavailableReason | null {
  const result = policyResult(step)
  return result.kind === 'unavailable' ? result.reason : null
}

/**
 * True when the step carries operations that do not hold together. Not the same
 * as having none: a goal already in place has none because there is nothing to
 * write, which is a result of its own.
 */
export function hasMalformedOperations(step: PolicyStep): boolean {
  return (step.action.resolution?.policies ?? []).length > 0 && validOperations(step.action).length === 0
}

/** True when the goal is already in place: nothing to write, and nothing wrong. */
export function isPreserved(step: PolicyStep): boolean {
  return policyResult(step).kind === 'preserved'
}

/**
 * The one implementation decision, for every channel and for the schedule. An
 * implementation is offered when all of these hold:
 *
 * - the step is a policy the plan is still trying to write;
 * - it has at least one valid operation to run — a goal already in place has
 *   none, and must not offer instructions for making a second copy of a policy
 *   the tenant already has;
 * - every object its policy names exists in the tenant (`action.missing` empty);
 * - the plan knows which tenant policy each half of a pair is;
 * - nothing suppresses it — the baseline's own definition of the goal does not
 *   contradict itself (baselineConflict.ts).
 *
 * The portal instructions, the JSON, the PowerShell and the download are offered
 * together or none of them is, and a step that offers none is not scheduled: no
 * wave, no start, no ring dates, no enforcement or announcement event. The step
 * still says what is missing and which step comes first; that is an explanation,
 * not an implementation.
 */
export function implementationOffered(step: PolicyStep): boolean {
  return policyResult(step).kind === 'implementable'
}

/** The operations a step actually runs: its own, when it offers an implementation at all. */
export function operationsOf(step: PolicyStep): PolicyOperation[] {
  const result = policyResult(step)
  return result.kind === 'implementable' ? result.operations : []
}

/** The bodies those operations submit: one body, or one per policy in the baseline's order. */
export function operationBodies(step: PolicyStep): Record<string, unknown>[] {
  return operationsOf(step).map((o) => o.body)
}

/**
 * The whole policy each operation is working towards: what the tenant's policy
 * will be once the operation has run. A create's is its body; an update's is the
 * policy it names with its own patch applied. Everything that decides what the
 * change *means* — what it can deny, who it would strand, what a person is told
 * — reads these and never a body serialised somewhere else.
 */
/** What each of the step's policies will ask of people once it has run; empty while it cannot run. */
export function stepEffects(step: PolicyStep): PolicyEffect[] {
  return finalTargets(step).map(effectOf)
}

export function finalTargets(step: PolicyStep): Record<string, unknown>[] {
  // An update's target is the tenant's own policy with this patch applied; a
  // create's is its body. There is no fallback to the patch itself: a partial
  // body read as a whole policy would understate what the change leaves behind,
  // and an operation without a complete target is not valid in the first place.
  return operationsOf(step).map((o) => (o.mode === 'update' ? (o.target as Record<string, unknown>) : o.body))
}
