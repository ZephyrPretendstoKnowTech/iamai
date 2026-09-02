// Synthetic tenants for the roadmap property tests (roadmap-v2.md §7).
// Every fixture is a seeded generator, never committed JSON: deterministic,
// small in the repo, and free of real identifiers. docs/design/fixtures.md
// describes each shape and what it must prove.
import type { TenantSnapshot, UserRow, PolicyAppliedResult, PolicyResultClass } from '../../graph/collect/types.ts'
import { deriveScenarioEvidence } from '../../derive/evidence.ts'
import { scenarioRows, sharedId } from './scenarioRows.ts'
import type { BaselinePackage } from '../../baseline/types.ts'
import type { MappingState } from '../../mapping/types.ts'
import { emptyMappingState } from '../../mapping/types.ts'
import { emptyCapabilities } from '../../licensing/capabilities.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import { stepIdForGoal } from '../generate.ts'
import { pinnedPackage } from '../../baseline/pinned.ts'

export type FixtureName = 'micro' | 'small' | 'getiamai' | 'mid' | 'large' | 'huge' | 'messy' | 'midflight' | 'hostile' | 'demo' | 'demo-week2'

export type Fixture = {
  name: FixtureName
  snapshot: TenantSnapshot
  baseline: BaselinePackage
  mapping: MappingState
  /** Group memberships the scan would have cached (break-glass group, exclusion group). */
  groups: GroupMembers
  /** The plan id the fixture's tagged policies belong to (midflight). */
  planId: string
  /** When the plan was generated: evidence before this is "already in place", not execution. */
  planCreatedAt: string
  /** Who runs the plan: an admin id in the fixture. */
  operatorId: string
  expect: FixtureExpectations
}

export type FixtureExpectations = {
  rings: number
  weeksAtMost: number
  namesListed: boolean
  policyCapWarning: boolean
}

const GA = '62e90394-69f5-4237-9190-012177145e10'
const AAD_P1 = '41781fb2-bc02-4b7c-bd55-b576c07bb09d'
const AAD_P2 = 'eec0eb4f-6444-4f95-aba0-50c24d67f998'
const FIRST = ['Alex', 'Sam', 'Priya', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Drew', 'Avery', 'Quinn', 'Kai', 'Rowan', 'Sasha', 'Noor']
const LAST = ['Morgan', 'Lee', 'Nair', 'Kim', 'Singh', 'Nguyen', 'Brown', 'Wilson', 'Chen', 'Taylor', 'Walker', 'Patel', 'Garcia', 'Okafor', 'Ivanova', 'Haddad']
const DEPARTMENTS = ['IT', 'Sales', 'Operations', 'Finance', 'Engineering', 'Support', 'Marketing', 'Legal', 'People']
const COUNTRIES = ['AU', 'NZ', 'GB', 'US', 'DE', 'SG', 'IN']

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A deterministic, valid-looking GUID from a seed and an index (never a real id). */
function guid(seed: string, i: number): string {
  const r = rng(hash(`${seed}:${i}`))
  const hex = () => Math.floor(r() * 16).toString(16)
  const part = (n: number) => Array.from({ length: n }, hex).join('')
  // The index lives in the first group so two ids from one seed never collide.
  return `${i.toString(16).padStart(8, '0').slice(-8)}-${part(4)}-4${part(3)}-8${part(3)}-${part(12)}`
}
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

type Spec = {
  name: FixtureName
  users: number
  admins: number
  licence: 'none' | 'p1' | 'p2' | 'mixed'
  policies: number
  serviceAccounts?: number
  hybrid?: boolean
  intuneShare?: number
  multiGeo?: boolean
  securityDefaults?: boolean
  perUserMfa?: boolean
  disabledPolicies?: number
  reportOnlyPolicies?: number
  breakGlassSmsOnly?: boolean
  exclusionGroupSize?: number
  midflight?: boolean
  hostile?: boolean
  /** The last N people have never signed in: no sign-in date, no method, no evidence (the GetIAMAI shape). */
  neverSignedIn?: number
  /** The demo tenant: a small business built to exercise the lockout scenarios (prompt 50 Part 2). */
  demo?: boolean
  /** The demo, one week on: three of the unproven now proven, the second break-glass and the exclusions group created, two Wave 1 policies in report-only and one enforced (prompt 50 Part 4). */
  week2?: boolean
  expect: FixtureExpectations
}

const NOW = '2026-08-28T09:00:00.000Z'
const daysAgo = (d: number) => new Date(Date.parse(NOW) - d * 86_400_000).toISOString()

/**
 * Sign-ins per UTC weekday and hour. An office tenant in Australia/Sydney
 * (UTC+10) signs in Monday to Friday 08:00 to 18:00 local, peaking Monday
 * 09:00; a flat tenant is spread evenly around the clock.
 */
export function weekdayHourBuckets(total: number, shape: 'office' | 'flat', rand: () => number): number[] {
  const out = Array.from({ length: 168 }, () => 0)
  const offset = 10 // Sydney standard time
  for (let i = 0; i < total; i++) {
    let localDay: number
    let localHour: number
    if (shape === 'flat') {
      localDay = Math.floor(rand() * 7)
      localHour = Math.floor(rand() * 24)
    } else {
      localDay = 1 + Math.floor(rand() * 5) // Monday..Friday as Sunday-first index 1..5
      const r = rand()
      localHour = r < 0.35 ? 8 + Math.floor(rand() * 2) : 8 + Math.floor(rand() * 10)
      if (localDay === 1 && rand() < 0.3) localHour = 9
    }
    let utcHour = localHour - offset
    let utcDay = localDay
    if (utcHour < 0) {
      utcHour += 24
      utcDay = (utcDay + 6) % 7
    }
    out[utcDay * 24 + utcHour] += 1
  }
  return out
}

export function buildFixture(spec: Spec): Fixture {
  // The demo family shares one seed, so week two is the SAME tenant a week later.
  const seed = spec.demo ? 'demo' : spec.name
  const rand = rng(hash(seed))
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]
  const tenantId = guid(seed, 0)
  const planId = `plan-${spec.name}`
  const caps = emptyCapabilities()
  const p1 = spec.licence !== 'none'
  const p2 = spec.licence === 'p2' || spec.licence === 'mixed'
  caps.entraP1 = { enabled: p1, seats: p1 ? spec.users + 20 : 0, consumed: p1 ? spec.users : 0 }
  caps.entraP2 = { enabled: p2, seats: p2 ? Math.round(spec.users * (spec.licence === 'mixed' ? 0.5 : 1)) : 0, consumed: p2 ? Math.round(spec.users * 0.4) : 0 }
  if (spec.intuneShare !== undefined) caps.intune = { enabled: true, seats: spec.users, consumed: Math.round(spec.users * spec.intuneShare) }

  // ---- people ----
  const users: UserRow[] = []
  const registrationDetails: TenantSnapshot['registrationDetails'] = []
  const authMethods: TenantSnapshot['authMethods'] = {}
  const signInEvidence: TenantSnapshot['signInEvidence'] = {}
  const rolesActive: Record<string, string[]> = {}
  const spPrincipals: Record<string, string> = {}
  const ids: string[] = []
  const bgIds = [guid(seed, 1_000_001), guid(seed, 1_000_002)]
  const svcIds = Array.from({ length: spec.serviceAccounts ?? 0 }, (_, i) => guid(seed, 1_000_100 + i))
  const total = spec.users
  for (let i = 0; i < total; i++) {
    const id = guid(seed, 1000 + i)
    ids.push(id)
    const isAdmin = i < spec.admins
    const guest = !isAdmin && rand() < 0.05
    const dept = isAdmin && i < 3 ? 'IT' : pick(DEPARTMENTS)
    const never = spec.neverSignedIn !== undefined && i >= total - spec.neverSignedIn
    const lastDays = never ? 100_000 : rand() < 0.85 ? Math.floor(rand() * 45) : 90 + Math.floor(rand() * 200)
    const tier = rand()
    const methods = never ? [] : tier < 0.12 ? [] : tier < 0.25 ? ['mobilePhone'] : tier < 0.85 ? ['microsoftAuthenticatorPush'] : ['microsoftAuthenticatorPush', 'passKeyDeviceBound']
    users.push({
      id,
      displayName: `${pick(FIRST)} ${pick(LAST)}`,
      userPrincipalName: `user${i}@${seed}.example.com`,
      userType: guest ? 'guest' : 'member',
      usageLocation: spec.multiGeo ? pick(COUNTRIES) : 'AU',
      createdDateTime: daysAgo(300 + Math.floor(rand() * 900)),
      lastSuccessfulSignIn: never ? null : daysAgo(lastDays),
      accountEnabled: true,
      mail: null,
      assignedPlans: p1 ? [{ servicePlanId: AAD_P1, capabilityStatus: 'Enabled' }] : [],
      onPremisesSyncEnabled: spec.hybrid ? rand() < 0.7 : false,
      externalUserState: guest ? 'Accepted' : null,
      department: dept,
      jobTitle: null,
      officeLocation: null,
    })
    registrationDetails.push({
      id,
      userPrincipalName: `user${i}@${seed}.example.com`,
      isMfaCapable: methods.length > 0,
      isMfaRegistered: methods.length > 0,
      isPasswordlessCapable: methods.includes('passKeyDeviceBound'),
      methodsRegistered: methods,
      defaultMfaMethod: null,
      userPreferredMethodForSecondaryAuthentication: null,
      isAdmin,
      userType: guest ? 'guest' : 'member',
    })
    authMethods[id] = methods.map((m) =>
      m === 'mobilePhone' ? { kind: 'phone', phoneType: 'mobile' } : m === 'passKeyDeviceBound' ? { kind: 'passkey' } : { kind: 'microsoftAuthenticator', phoneAppVersion: '6.2508.0' },
    ) as TenantSnapshot['authMethods'][string]
    if (isAdmin) rolesActive[id] = [GA]
    // Every active person (90 days) has sign-in evidence: the records cover the whole window.
    if (lastDays < 90 && !spec.hostile) {
      signInEvidence[id] = { signInCount: 1 + Math.floor(rand() * 20), lastSignIn: daysAgo(lastDays), lastMfaSuccess: methods.length > 0 && rand() < 0.65 ? { at: daysAgo(lastDays), method: 'Mobile app notification' } : null, countries: rand() < 0.04 ? ['AU', 'NZ'] : ['AU'] }
    }
  }
  // Break-glass accounts: cloud-only GAs, excluded everywhere; SMS-only when messy.
  for (const [k, id] of bgIds.entries()) {
    users.push({ id, displayName: `Break-glass ${k + 1}`, userPrincipalName: `bg${k + 1}@${seed}.onmicrosoft.com`, userType: 'member', usageLocation: 'AU', createdDateTime: daysAgo(400), lastSuccessfulSignIn: daysAgo(spec.breakGlassSmsOnly ? 120 : 10), accountEnabled: true, mail: null, assignedPlans: [], onPremisesSyncEnabled: false, externalUserState: null, department: null, jobTitle: null, officeLocation: null })
    registrationDetails.push({ id, userPrincipalName: `bg${k + 1}@${seed}.example.com`, isMfaCapable: true, isMfaRegistered: true, isPasswordlessCapable: !spec.breakGlassSmsOnly, methodsRegistered: spec.breakGlassSmsOnly ? ['mobilePhone'] : ['fido2SecurityKey'], defaultMfaMethod: null, userPreferredMethodForSecondaryAuthentication: null, isAdmin: true, userType: 'member' })
    authMethods[id] = spec.breakGlassSmsOnly ? [{ kind: 'phone', phoneType: 'mobile' }] : [{ kind: 'fido2' }]
    rolesActive[id] = [GA]
  }
  // Service accounts: legacy-auth users with no MFA.
  for (const [k, id] of svcIds.entries()) {
    users.push({ id, displayName: `svc-mailer-${k + 1}`, userPrincipalName: `svc-mailer-${k + 1}@${seed}.example.com`, userType: 'member', usageLocation: 'AU', createdDateTime: daysAgo(900), lastSuccessfulSignIn: daysAgo(1), accountEnabled: true, mail: null, assignedPlans: [], onPremisesSyncEnabled: false, externalUserState: null, department: null, jobTitle: null, officeLocation: null })
    registrationDetails.push({ id, userPrincipalName: `svc-mailer-${k + 1}@${seed}.example.com`, isMfaCapable: false, isMfaRegistered: false, isPasswordlessCapable: false, methodsRegistered: [], defaultMfaMethod: null, userPreferredMethodForSecondaryAuthentication: null, isAdmin: false, userType: 'member' })
    authMethods[id] = []
    signInEvidence[id] = { signInCount: 40, lastSignIn: daysAgo(1), lastMfaSuccess: null }
  }
  // GetIAMAI, as the live walk found it (prompt 48.1 items 5, 6, 9).
  if (spec.name === 'getiamai') {
    // A guest shares a display name with a member (prompt 49 item 1): the guest carries the (guest) marker.
    const guestUser = users.find((u) => u.userType === 'guest')
    const memberUser = users.find((u) => u.userType === 'member' && !bgIds.includes(u.id) && u.displayName)
    if (guestUser && memberUser) guestUser.displayName = memberUser.displayName
    // A service principal holds Global Administrator: named as one, never left as an id (item 5).
    const spId = guid(seed, 1_000_900)
    rolesActive[spId] = [GA]
    spPrincipals[spId] = 'Contoso Backup Runner'
    // Two active people are registered but have not completed MFA in the window (item 6).
    const activeNonBg = ids.filter((id) => signInEvidence[id] && !bgIds.includes(id)).slice(0, 2)
    for (const id of activeNonBg) {
      const i = ids.indexOf(id)
      registrationDetails[i] = { ...registrationDetails[i], isMfaCapable: true, isMfaRegistered: true, methodsRegistered: ['microsoftAuthenticatorPush'] }
      authMethods[id] = [{ kind: 'microsoftAuthenticator', phoneAppVersion: '6.2508.0' }]
      signInEvidence[id] = { ...signInEvidence[id], lastMfaSuccess: null }
    }
    // The two break-glass accounts share one Authenticator device: bg.separateDevices fails (item 9).
    for (const id of bgIds) authMethods[id] = [{ kind: 'microsoftAuthenticator', displayName: 'SM-S918U', phoneAppVersion: '6.2508.0' }]
  }
  // A directory-sync role holder on mid and a hybrid user on huge (prompt 48 items 13, 15).
  if (spec.name === 'mid' && ids[6]) rolesActive[ids[6]] = ['d29b2b05-8046-44ba-8758-1e26182fcf32']
  if (spec.name === 'huge' && users[3]) users[3].onPremisesSyncEnabled = true
  // A shared-device SKU on the reserved account (prompt 48 item 8) so the licence path fires too.
  if (spec.name === 'mid') {
    const shared = users.find((x) => x.id === sharedId(ids))
    if (shared) shared.skuIds = ['295a8eb0-f78d-45c7-8b5b-1eed5ed02dff']
  }
  // The demo tenant, built to show the finished product (prompt 50 Part 2).
  if (spec.demo) {
    const at = (i: number): string => ids[i]
    const setUser = (id: string, u: Partial<UserRow>): void => {
      const x = users.find((y) => y.id === id)
      if (x) Object.assign(x, u)
    }
    const setReg = (id: string, r: Partial<TenantSnapshot['registrationDetails'][number]>): void => {
      const i = ids.indexOf(id)
      if (i >= 0) registrationDetails[i] = { ...registrationDetails[i], ...r }
    }
    // Exactly two guests, and everyone else a member (the loop's random guests
    // are cleared). Their home-tenant MFA trust is off (empty crossTenantAccess).
    const guests = [at(spec.admins), at(spec.admins + 1)]
    for (const id of ids) {
      const isGuest = guests.includes(id)
      setUser(id, { userType: isGuest ? 'guest' : 'member', externalUserState: isGuest ? 'Accepted' : null })
      setReg(id, { userType: isGuest ? 'guest' : 'member' })
    }
    // A directory-sync service account holds the sync role (scenario 13).
    const syncId = at(spec.admins + 3)
    if (syncId) rolesActive[syncId] = ['d29b2b05-8046-44ba-8758-1e26182fcf32']
    // Three active people have no MFA method (the campaign; scenario 14).
    for (const id of ids.slice(spec.admins + 5, spec.admins + 8)) {
      setReg(id, { isMfaCapable: false, isMfaRegistered: false, isPasswordlessCapable: false, methodsRegistered: [] })
      authMethods[id] = []
      signInEvidence[id] = { ...(signInEvidence[id] ?? { signInCount: 5, lastSignIn: daysAgo(3), countries: ['AU'] }), lastMfaSuccess: null }
    }
    // Five registered-but-unproven active people (the campaign; scenario 12).
    // They are made active and registered here so exactly three can flip to
    // proven in week two (prompt 50 item 15).
    const unproven = ids.slice(spec.admins + 8, spec.admins + 13)
    for (const id of unproven) {
      setReg(id, { isMfaCapable: true, isMfaRegistered: true, methodsRegistered: ['microsoftAuthenticatorPush'] })
      authMethods[id] = [{ kind: 'microsoftAuthenticator', phoneAppVersion: '6.2508.0' }]
      signInEvidence[id] = { signInCount: 8, lastSignIn: daysAgo(3), lastMfaSuccess: null, countries: ['AU'] }
    }
    // One person has not typed a password in 30 days (passwordless).
    setUser(at(spec.admins + 11), { displayName: users.find((u) => u.id === at(spec.admins + 11))?.displayName ?? 'Kaladin Stormblood' })
    // A Teams Room shared-device account (scenario 8): the reserved last id.
    const shared = users.find((x) => x.id === sharedId(ids))
    if (shared) {
      shared.displayName = 'Boardroom'
      shared.skuIds = ['295a8eb0-f78d-45c7-8b5b-1eed5ed02dff']
      // A room has Authenticator approval and nothing stronger, and its evidence
      // says so (walk-51 item 11: the fixture had a passkey beside notification
      // evidence — a contradiction on the Today table, patched here, not in the product).
      setReg(shared.id, { methodsRegistered: ['microsoftAuthenticatorPush'], isPasswordlessCapable: false })
      authMethods[shared.id] = [{ kind: 'microsoftAuthenticator', phoneAppVersion: '6.2508.0' }]
    }
    // Week two: three of the unproven are now proven (prompt 50 Part 4 item 14).
    if (spec.week2) {
      for (const id of unproven.slice(0, 3)) if (signInEvidence[id]) signInEvidence[id] = { ...signInEvidence[id], lastMfaSuccess: { at: daysAgo(2), method: 'Mobile app notification' } }
    }
  }
  const bgGroup = guid(seed, 1_000_500)
  const exclusionGroup = guid(seed, 1_000_501)

  // ---- policies ----
  const policies: unknown[] = []
  const tag = (goalId: string) => (spec.midflight ? `[IAMAI:${planId}:${stepIdForGoal(goalId)}]` : '')
  const policy = (n: number, displayName: string, state: string, body: Record<string, unknown>, goalId?: string) => ({
    id: guid(seed, 2_000_000 + n),
    displayName,
    state,
    description: goalId ? tag(goalId) : '',
    createdDateTime: daysAgo(spec.midflight ? 30 - n : 200),
    modifiedDateTime: daysAgo(spec.midflight ? 10 : 100),
    ...body,
  })
  const exclude = { excludeGroups: [bgGroup] }
  const templates: [string, string, Record<string, unknown>, string][] = [
    ['Core - Grant - MFA for all users', 'enabled', { conditions: { users: { includeUsers: ['All'], ...exclude }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } }, 'mfa-all-users'],
    ['Core - Block - Legacy authentication', 'enabled', { conditions: { users: { includeUsers: ['All'], ...exclude }, applications: { includeApplications: ['All'] }, clientAppTypes: ['exchangeActiveSync', 'other'] }, grantControls: { operator: 'OR', builtInControls: ['block'] } }, 'block-legacy-auth'],
    ['Core - Block - Device code flow', spec.midflight ? 'disabled' : 'enabled', { conditions: { users: { includeUsers: ['All'], ...exclude }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'], authenticationFlows: { transferMethods: 'deviceCodeFlow' } }, grantControls: { operator: 'OR', builtInControls: ['block'] } }, 'block-device-code'],
    ['Core - Grant - Admins phishing-resistant', 'enabledForReportingButNotEnforced', { conditions: { users: { includeRoles: [GA], ...exclude }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'AND', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } } }, 'admins-phishing-resistant'],
    ['Core - Grant - Guests MFA', 'enabled', { conditions: { users: { includeUsers: ['GuestsOrExternalUsers'], ...exclude }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } }, 'guests-mfa'],
    ['Core - Grant - Compliant device for Office', 'enabledForReportingButNotEnforced', { conditions: { users: { includeUsers: ['All'], ...exclude }, applications: { includeApplications: ['Office365'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['compliantDevice', 'domainJoinedDevice'] } }, 'require-managed-device'],
  ]
  const wanted = Math.max(0, spec.policies)
  for (let n = 0; n < wanted; n++) {
    const t = templates[n % templates.length]
    const base = n < templates.length ? t[1] : n % 4 === 0 ? 'enabledForReportingButNotEnforced' : 'enabled'
    // The demo, one week on (prompt 50.1 item 5): the admins phishing-resistant
    // policy, report-only on day one, is now enforced, so its step moves into
    // place and the header's in-place count rises.
    const state = spec.week2 && t[3] === 'admins-phishing-resistant' ? 'enabled' : base
    policies.push(policy(n, n < templates.length ? t[0] : `Core - Extra ${n} - ${t[0].split(' - ').slice(1).join(' - ')}`, state, t[2], n < templates.length ? t[3] : undefined))
  }
  for (let n = 0; n < (spec.disabledPolicies ?? 0); n++) policies.push(policy(500 + n, `Old - Disabled ${n}`, 'disabled', templates[n % templates.length][2]))
  for (let n = 0; n < (spec.reportOnlyPolicies ?? 0); n++) policies.push(policy(600 + n, `Test - Report only ${n}`, 'enabledForReportingButNotEnforced', templates[n % templates.length][2]))
  // The demo, one week on (prompt 50 Part 4 item 14): the plan created two Wave 1
  // policies now sitting in report-only with sign-in evidence, and one enforced.
  const week2Results: PolicyAppliedResult[] = []
  if (spec.week2) {
    const body = { conditions: { users: { includeUsers: ['All'], excludeGroups: [bgGroup] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } }
    const advanced: [string, string, PolicyResultClass][] = [
      ['token-protection', 'enabledForReportingButNotEnforced', 'reportOnlySuccess'],
      ['block-auth-transfer', 'enabledForReportingButNotEnforced', 'reportOnlySuccess'],
    ]
    const zero = { reportOnlyFailure: 0, reportOnlyInterrupted: 0, reportOnlySuccess: 0, enforcedFailure: 0, enforcedSuccess: 0 } as const
    const noIds = { reportOnlyFailure: [], reportOnlyInterrupted: [], reportOnlySuccess: [], enforcedFailure: [], enforcedSuccess: [] } as Record<PolicyResultClass, string[]>
    for (const [goalId, state, cls] of advanced) {
      const pid = guid(seed, 2_200_000 + policies.length)
      const name = `Core - Require - ${goalId}`
      policies.push({ id: pid, displayName: name, state, description: `[IAMAI:${planId}:${stepIdForGoal(goalId)}]`, createdDateTime: daysAgo(7), modifiedDateTime: daysAgo(2), ...body })
      week2Results.push({ policyId: pid, displayName: name, counts: { ...zero, [cls]: 24 }, affectedUserIds: { ...noIds, [cls]: ids.slice(0, 24) } })
    }
  }

  const section = (rows: unknown[], status: 'ok' | 'disabled' | 'error' = 'ok', reason: string | null = null) => ({ status, reason, rows })
  const ok = (extra: Partial<TenantSnapshot['sources'][keyof TenantSnapshot['sources']]> = {}) => ({ status: 'ok' as const, coveredWindow: null, reason: null, asOf: NOW, ...extra })
  const hostile = spec.hostile === true
  const snapshot: TenantSnapshot = {
    schemaVersion: 1,
    tenantId,
    asOf: NOW,
    sources: {
      config: ok(),
      registrationDetails: hostile ? { status: 'disabled', coveredWindow: null, reason: 'access denied (403)', asOf: NOW } : ok(),
      users: ok(),
      devices: hostile ? { status: 'disabled', coveredWindow: null, reason: 'access denied (403)', asOf: NOW } : ok(),
      spActivity: ok(),
      authMethods: ok(),
      appSignInSummary: ok(),
      signInEvidence: hostile || !p1 ? { status: 'insufficient', coveredWindow: null, reason: hostile ? 'no sign-in records could be read' : 'not available on this licence', asOf: NOW } : ok({ coveredWindow: { from: daysAgo(30), to: NOW } }),
    },
    config: {
      caPolicies: section(policies),
      namedLocations: section([{ '@odata.type': '#microsoft.graph.ipNamedLocation', id: guid(seed, 4_000_001), displayName: 'Head office', isTrusted: true, ipRanges: [{ cidrAddress: '203.0.113.0/24' }] }]),
      authStrengths: section([{ id: '00000000-0000-0000-0000-000000000004', displayName: 'Phishing-resistant MFA', policyType: 'builtIn', allowedCombinations: ['windowsHelloForBusiness', 'fido2', 'x509CertificateMultiFactor'] }]),
      authMethodsPolicy: section([{ policyMigrationState: spec.perUserMfa ? 'preMigration' : 'migrationComplete', registrationEnforcement: { authenticationMethodsRegistrationCampaign: { state: 'enabled' } }, authenticationMethodConfigurations: [{ id: 'MicrosoftAuthenticator', state: 'enabled', includeTargets: [{ id: 'all_users' }] }, { id: 'Fido2', state: 'enabled', includeTargets: [{ id: 'all_users' }] }, { id: 'Sms', state: spec.breakGlassSmsOnly ? 'enabled' : 'disabled', includeTargets: [] }] }]),
      securityDefaults: section([{ isEnabled: spec.securityDefaults === true }]),
      crossTenantAccess: section([]),
      roleAssignments: section(Object.entries(rolesActive).map(([principalId, roles]) => ({ principalId, roleDefinitionId: roles[0], roleDefinition: { id: roles[0], displayName: 'Global Administrator' }, ...(spPrincipals[principalId] ? { principalType: 'ServicePrincipal', principal: { displayName: spPrincipals[principalId], '@odata.type': '#microsoft.graph.servicePrincipal' } } : {}) }))),
      pimEligibility: section([], p2 ? 'ok' : 'disabled', p2 ? null : 'needs Entra ID P2'),
      subscribedSkus: section([
        ...(p1 ? [{ skuId: 'sku-p1', skuPartNumber: 'AAD_PREMIUM', prepaidUnits: { enabled: spec.users + 20 }, consumedUnits: spec.users, servicePlans: [{ servicePlanId: AAD_P1, servicePlanName: 'AAD_PREMIUM', provisioningStatus: 'Success' }] }] : []),
        ...(p2 ? [{ skuId: 'sku-p2', skuPartNumber: 'AAD_PREMIUM_P2', prepaidUnits: { enabled: Math.round(spec.users / 2) }, consumedUnits: Math.round(spec.users * 0.4), servicePlans: [{ servicePlanId: AAD_P2, servicePlanName: 'AAD_PREMIUM_P2', provisioningStatus: 'Success' }] }] : []),
      ]),
      me: section([{ id: ids[0], displayName: 'Operator', userPrincipalName: `user0@${seed}.example.com` }]),
      organization: section([{ displayName: spec.demo ? 'Contoso Pty Ltd' : `Fixture ${spec.name}`, verifiedDomains: [{ name: `${seed}.example.com`, isInitial: false }, { name: `${seed}.onmicrosoft.com`, isInitial: true }] }]),
      meMemberOf: section([]),
    },
    registrationDetails: hostile ? [] : registrationDetails,
    users,
    devices: hostile
      ? []
      : ids.slice(0, Math.round(ids.length * (spec.intuneShare ?? 0.6))).map((owner, i) => ({ id: guid(seed, 3_000_000 + i), displayName: `DEVICE-${i}`, isCompliant: i % 3 !== 0, isManaged: i % 4 !== 0, trustType: spec.hybrid && i % 2 === 0 ? 'ServerAd' : 'AzureAd', ownerIds: [owner], operatingSystem: i % 5 === 0 ? 'iOS' : 'Windows', approximateLastSignIn: daysAgo(i % 40) })),
    spActivity: [],
    authMethods: hostile ? Object.fromEntries(Object.keys(authMethods).map((k) => [k, 'unknown' as const])) : authMethods,
    appSignInSummary: [{ appId: '00000003-0000-0ff1-ce00-000000000000', appDisplayName: 'Office 365 SharePoint Online', signInCount: spec.users * 12 }],
    signInEvidence: hostile ? {} : signInEvidence,
    evidencePolicyResults: week2Results,
    blockedToday: [],
    evidenceUsage: hostile ? null : { legacyAuth: { count: svcIds.length * 40, userIds: svcIds, byDetail: { 'IMAP4': svcIds.length * 40 } }, deviceCode: { count: 0, userIds: [], byDetail: {} }, authTransfer: { count: 0, userIds: [], byDetail: {} }, riskHigh: { count: 0, userIds: [], byDetail: {} }, riskMedium: { count: 0, userIds: [], byDetail: {} } },
    evidenceAggregates: hostile ? null : { total: spec.users * 8, distinctUsers: Object.keys(signInEvidence).length, byClientApp: { Browser: spec.users * 6, 'Mobile Apps and Desktop clients': spec.users * 2 }, byProtocol: { none: spec.users * 8 }, byCountry: { AU: spec.users }, byWeekdayHour: weekdayHourBuckets(spec.users * 8, spec.multiGeo ? 'flat' : 'office', rand) },
    capabilities: caps,
    microsoftManagedPolicyIds: [],
    roles: { active: rolesActive, eligible: {} },
  }
  if (!hostile) {
    const rows = scenarioRows(spec.name, ids, svcIds)
    const compliantOwners = new Set<string>()
    for (const d of snapshot.devices) if (d.isCompliant === true) for (const o of d.ownerIds) compliantOwners.add(o)
    snapshot.scenarioEvidence = deriveScenarioEvidence(rows, compliantOwners)
  }

  // The demo starts with no exclusions group and unconfirmed emergency-access
  // facts; its week-two twin has both done (prompt 50 Part 2 item 10, Part 4).
  const exclusionExists = !spec.demo || spec.week2 === true
  const demoConfirmed = !spec.demo || spec.week2 === true
  const mapping: MappingState = {
    ...emptyMappingState(tenantId),
    breakGlassUserIds: bgIds,
    breakGlassAnswers: spec.hostile ? { credentialStorage: false, signInMonitoring: false } : spec.demo ? { credentialStorage: demoConfirmed, signInMonitoring: demoConfirmed } : { credentialStorage: true, signInMonitoring: true },
    serviceAccountUserIds: svcIds,
    allowedCountries: spec.multiGeo ? ['AU', 'NZ', 'GB', 'US'] : ['AU'],
    displayTimeZone: 'Australia/Sydney',
    records: {
      __globalExclusion: { placeholder: '__globalExclusion', kind: 'group', group: 'globalExclusion', resolvedId: exclusionExists ? exclusionGroup : null, resolvedName: exclusionExists ? 'Core - Exclusions' : null, provenance: 'confirmed', doesNotExist: !exclusionExists, validation: null },
    },
    wizardAnswered: { breakGlass: true, globalExclusion: true, countries: true, trustedLocations: true, serviceAccounts: true, timeZone: true, applicability: true },
  }
  const groups: GroupMembers = new Map()
  groups.set(bgGroup, { memberIds: bgIds, memberCount: bgIds.length, sampled: false, displayName: 'Core - Break glass' })
  const exclusionMembers = [...bgIds, ...ids.slice(spec.admins, spec.admins + (spec.exclusionGroupSize ?? 0))]
  groups.set(exclusionGroup, { memberIds: exclusionMembers, memberCount: exclusionMembers.length, sampled: false, displayName: 'Core - Exclusions' })
  // midflight's tagged policies were applied by the plan, so the plan predates them; every other plan is generated now.
  const planCreatedAt = spec.midflight ? daysAgo(60) : NOW
  // The demo derives through the same baseline as the product (walk-51 item 9):
  // the pinned package, never a synthetic one of its own. Every other fixture
  // keeps the synthetic baseline as a stand-in, filtered by the pinned goal map.
  const baseline = spec.demo ? pinnedPackage() : syntheticBaseline(seed)
  return { name: spec.name, snapshot, baseline, mapping, groups, planId, planCreatedAt, operatorId: ids[0], expect: spec.expect }
}

/** A baseline with one policy per catalogue family, so every family produces steps. */
export function syntheticBaseline(seed: string): BaselinePackage {
  const g = (i: number) => guid(`${seed}-baseline`, i)
  const bg = g(1)
  const pol = (id: number, displayName: string, body: Record<string, unknown>) => ({ id: g(id), displayName, state: 'enabled', conditions: { users: { includeUsers: ['All'], excludeGroups: [bg] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] }, ...body })
  const policies = [
    pol(10, 'IAC - GLOBAL - GRANT - MFA - AllUsers', {}),
    pol(11, 'IAC - GLOBAL - BLOCK - LegacyAuth', { conditions: { users: { includeUsers: ['All'], excludeGroups: [bg] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['exchangeActiveSync', 'other'] }, grantControls: { operator: 'OR', builtInControls: ['block'] } }),
    pol(12, 'IAC - GLOBAL - BLOCK - DeviceCodeFlow', { conditions: { users: { includeUsers: ['All'], excludeGroups: [bg] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'], authenticationFlows: { transferMethods: 'deviceCodeFlow' } }, grantControls: { operator: 'OR', builtInControls: ['block'] } }),
    pol(13, 'IAC - ADMINS - GRANT - PhishingResistant', { conditions: { users: { includeRoles: [GA], excludeGroups: [bg] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'AND', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } } }),
    pol(14, 'IAC - GUESTS - GRANT - MFA', { conditions: { users: { includeUsers: ['GuestsOrExternalUsers'], excludeGroups: [bg] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] } }),
    pol(15, 'IAC - DEVICES - GRANT - CompliantOffice', { conditions: { users: { includeUsers: ['All'], excludeGroups: [bg] }, applications: { includeApplications: ['Office365'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['compliantDevice', 'domainJoinedDevice'] } }),
    pol(16, 'IAC - GLOBAL - BLOCK - Countries', { conditions: { users: { includeUsers: ['All'], excludeGroups: [bg] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'], locations: { includeLocations: ['All'], excludeLocations: [g(20)] } }, grantControls: { operator: 'OR', builtInControls: ['block'] } }),
    pol(17, 'IAC - SESSIONS - Browser persistence', { grantControls: undefined, sessionControls: { persistentBrowser: { isEnabled: true, mode: 'never' }, signInFrequency: { isEnabled: true, value: 12, type: 'hours' } } }),
  ]
  return {
    policies: policies as BaselinePackage['policies'],
    origins: {},
    report: { considered: policies.length, parsed: policies.length, skipped: [], errors: [], duplicates: [], warnings: [] },
    references: [
      { id: bg, kind: 'group', portability: 'tenantSpecific', uses: policies.map((p) => ({ policyName: p.displayName, side: 'exclude' })) },
      { id: g(20), kind: 'namedLocation', portability: 'tenantSpecific', uses: [{ policyName: 'IAC - GLOBAL - BLOCK - Countries', side: 'exclude' }] },
    ],
    groupSignatures: [{ id: bg, inferredRole: 'globalExclusion', confidence: 'high', evidence: 'excluded from every user-targeting policy, never included' }],
    variantSets: [],
    docs: [],
  } as unknown as BaselinePackage
}

export const FIXTURE_SPECS: Spec[] = [
  // Expected lengths are what the model computes (target-state §9), not targets:
  // small band ≤4 weeks, mid ≤8, large ≤12 where it lands there, and the real
  // number where it does not, with the constraint named in the test that reads it.
  { name: 'micro', users: 8, admins: 1, licence: 'none', policies: 0, securityDefaults: true, expect: { rings: 1, weeksAtMost: 4, namesListed: true, policyCapWarning: false } },
  // Recomputed with batching (prompt 41 §8). The weekly cap counts supervised
  // change windows rather than steps, so twelve enforceable steps on the small
  // fixture now occupy two change days instead of seven, and the plan is five
  // weeks instead of seven. What sets every one of these numbers is the
  // registration campaign and the ring soak after it, not the enforcement pace.
  { name: 'small', users: 28, admins: 2, licence: 'p1', policies: 3, expect: { rings: 1, weeksAtMost: 4, namesListed: true, policyCapWarning: false } },
  // The GetIAMAI shape (prompt 46 item 18): 4 people who sign in (two of them the
  // break-glass accounts) and 9 who never have. Four weeks at most, with no registration window on the
  // critical path.
  { name: 'getiamai', users: 11, admins: 1, licence: 'p1', policies: 0, neverSignedIn: 9, expect: { rings: 1, weeksAtMost: 4, namesListed: true, policyCapWarning: false } },
  { name: 'mid', users: 280, admins: 14, licence: 'mixed', policies: 11, serviceAccounts: 3, expect: { rings: 2, weeksAtMost: 8, namesListed: false, policyCapWarning: false } },
  { name: 'large', users: 4900, admins: 60, licence: 'p1', policies: 40, hybrid: true, intuneShare: 0.55, expect: { rings: 4, weeksAtMost: 12, namesListed: false, policyCapWarning: true } },
  // 21,000 active people: two change windows a week, four rings of seven days
  // (above 3,000 the ring shape is unchanged), two high-disruption steps that
  // cannot share a window. Fourteen weeks is what that computes to.
  { name: 'huge', users: 25000, admins: 300, licence: 'p2', policies: 120, multiGeo: true, expect: { rings: 4, weeksAtMost: 14, namesListed: false, policyCapWarning: true } },
  // 24 disabled extras (was 20): with the plan holding only the pinned map's goals
  // (walk-51 item 9) it adds 8 policies, and messy has to land above the
  // 40-policy line to keep proving the consolidation warning.
  { name: 'messy', users: 120, admins: 6, licence: 'p1', policies: 6, securityDefaults: true, perUserMfa: true, disabledPolicies: 24, reportOnlyPolicies: 6, breakGlassSmsOnly: true, exclusionGroupSize: 400, expect: { rings: 2, weeksAtMost: 8, namesListed: false, policyCapWarning: true } },
  { name: 'midflight', users: 60, admins: 3, licence: 'p1', policies: 6, midflight: true, expect: { rings: 2, weeksAtMost: 8, namesListed: false, policyCapWarning: false } },
  // 36 active people and no sign-in evidence at all: nothing is in the zero
  // class, so MFA, device and session changes chain a soak apart; 34 days.
  { name: 'hostile', users: 40, admins: 2, licence: 'p1', policies: 3, hostile: true, expect: { rings: 1, weeksAtMost: 4, namesListed: false, policyCapWarning: false } },
  // The demo tenant (prompt 50 Part 2): a plausible small business, ~40 accounts,
  // Entra ID P1 + Intune, a messy real-world start, built so at least twelve of
  // the lockout scenarios fire. Its week-two twin advances the tracking story.
  { name: 'demo', users: 34, admins: 3, licence: 'p1', policies: 5, serviceAccounts: 2, hybrid: true, intuneShare: 0.5, demo: true, expect: { rings: 1, weeksAtMost: 5, namesListed: false, policyCapWarning: false } },
  { name: 'demo-week2', users: 34, admins: 3, licence: 'p1', policies: 5, serviceAccounts: 2, hybrid: true, intuneShare: 0.5, demo: true, week2: true, expect: { rings: 1, weeksAtMost: 5, namesListed: false, policyCapWarning: false } },
]

/** The 25,000-user fixture costs a second per derivation, so it is built only with HUGE=1 (prune A). */
export const HUGE: boolean = typeof process !== 'undefined' && process.env?.HUGE === '1'

export function allFixtures(): Fixture[] {
  return FIXTURE_SPECS.filter((s) => s.name !== 'huge' || HUGE).map(buildFixture)
}

export function fixture(name: FixtureName): Fixture {
  const spec = FIXTURE_SPECS.find((s) => s.name === name)
  if (!spec) throw new Error(`no fixture ${name}`)
  return buildFixture(spec)
}
