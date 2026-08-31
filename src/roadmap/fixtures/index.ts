// Synthetic tenants for the roadmap property tests (roadmap-v2.md §7).
// Every fixture is a seeded generator, never committed JSON: deterministic,
// small in the repo, and free of real identifiers. docs/design/fixtures.md
// describes each shape and what it must prove.
import type { TenantSnapshot, UserRow } from '../../graph/collect/types.ts'
import type { BaselinePackage } from '../../baseline/types.ts'
import type { MappingState } from '../../mapping/types.ts'
import { emptyMappingState } from '../../mapping/types.ts'
import { emptyCapabilities } from '../../licensing/capabilities.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import { stepIdForGoal } from '../generate.ts'

export type FixtureName = 'micro' | 'small' | 'mid' | 'large' | 'huge' | 'messy' | 'midflight' | 'hostile'

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
  const rand = rng(hash(spec.name))
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]
  const tenantId = guid(spec.name, 0)
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
  const ids: string[] = []
  const bgIds = [guid(spec.name, 1_000_001), guid(spec.name, 1_000_002)]
  const svcIds = Array.from({ length: spec.serviceAccounts ?? 0 }, (_, i) => guid(spec.name, 1_000_100 + i))
  const total = spec.users
  for (let i = 0; i < total; i++) {
    const id = guid(spec.name, 1000 + i)
    ids.push(id)
    const isAdmin = i < spec.admins
    const guest = !isAdmin && rand() < 0.05
    const dept = isAdmin && i < 3 ? 'IT' : pick(DEPARTMENTS)
    const lastDays = rand() < 0.85 ? Math.floor(rand() * 45) : 90 + Math.floor(rand() * 200)
    const tier = rand()
    const methods = tier < 0.12 ? [] : tier < 0.25 ? ['mobilePhone'] : tier < 0.85 ? ['microsoftAuthenticatorPush'] : ['microsoftAuthenticatorPush', 'passKeyDeviceBound']
    users.push({
      id,
      displayName: `${pick(FIRST)} ${pick(LAST)}`,
      userPrincipalName: `user${i}@${spec.name}.example.com`,
      userType: guest ? 'guest' : 'member',
      usageLocation: spec.multiGeo ? pick(COUNTRIES) : 'AU',
      createdDateTime: daysAgo(300 + Math.floor(rand() * 900)),
      lastSuccessfulSignIn: daysAgo(lastDays),
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
      userPrincipalName: `user${i}@${spec.name}.example.com`,
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
    users.push({ id, displayName: `Break-glass ${k + 1}`, userPrincipalName: `bg${k + 1}@${spec.name}.onmicrosoft.com`, userType: 'member', usageLocation: 'AU', createdDateTime: daysAgo(400), lastSuccessfulSignIn: daysAgo(spec.breakGlassSmsOnly ? 120 : 10), accountEnabled: true, mail: null, assignedPlans: [], onPremisesSyncEnabled: false, externalUserState: null, department: null, jobTitle: null, officeLocation: null })
    registrationDetails.push({ id, userPrincipalName: `bg${k + 1}@${spec.name}.example.com`, isMfaCapable: true, isMfaRegistered: true, isPasswordlessCapable: !spec.breakGlassSmsOnly, methodsRegistered: spec.breakGlassSmsOnly ? ['mobilePhone'] : ['fido2SecurityKey'], defaultMfaMethod: null, userPreferredMethodForSecondaryAuthentication: null, isAdmin: true, userType: 'member' })
    authMethods[id] = spec.breakGlassSmsOnly ? [{ kind: 'phone', phoneType: 'mobile' }] : [{ kind: 'fido2' }]
    rolesActive[id] = [GA]
  }
  // Service accounts: legacy-auth users with no MFA.
  for (const [k, id] of svcIds.entries()) {
    users.push({ id, displayName: `svc-mailer-${k + 1}`, userPrincipalName: `svc-mailer-${k + 1}@${spec.name}.example.com`, userType: 'member', usageLocation: 'AU', createdDateTime: daysAgo(900), lastSuccessfulSignIn: daysAgo(1), accountEnabled: true, mail: null, assignedPlans: [], onPremisesSyncEnabled: false, externalUserState: null, department: null, jobTitle: null, officeLocation: null })
    registrationDetails.push({ id, userPrincipalName: `svc-mailer-${k + 1}@${spec.name}.example.com`, isMfaCapable: false, isMfaRegistered: false, isPasswordlessCapable: false, methodsRegistered: [], defaultMfaMethod: null, userPreferredMethodForSecondaryAuthentication: null, isAdmin: false, userType: 'member' })
    authMethods[id] = []
    signInEvidence[id] = { signInCount: 40, lastSignIn: daysAgo(1), lastMfaSuccess: null }
  }
  const bgGroup = guid(spec.name, 1_000_500)
  const exclusionGroup = guid(spec.name, 1_000_501)

  // ---- policies ----
  const policies: unknown[] = []
  const tag = (goalId: string) => (spec.midflight ? `[IAMAI:${planId}:${stepIdForGoal(goalId)}]` : '')
  const policy = (n: number, displayName: string, state: string, body: Record<string, unknown>, goalId?: string) => ({
    id: guid(spec.name, 2_000_000 + n),
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
    const state = n < templates.length ? t[1] : n % 4 === 0 ? 'enabledForReportingButNotEnforced' : 'enabled'
    policies.push(policy(n, n < templates.length ? t[0] : `Core - Extra ${n} - ${t[0].split(' - ').slice(1).join(' - ')}`, state, t[2], n < templates.length ? t[3] : undefined))
  }
  for (let n = 0; n < (spec.disabledPolicies ?? 0); n++) policies.push(policy(500 + n, `Old - Disabled ${n}`, 'disabled', templates[n % templates.length][2]))
  for (let n = 0; n < (spec.reportOnlyPolicies ?? 0); n++) policies.push(policy(600 + n, `Test - Report only ${n}`, 'enabledForReportingButNotEnforced', templates[n % templates.length][2]))

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
      namedLocations: section([{ '@odata.type': '#microsoft.graph.ipNamedLocation', id: guid(spec.name, 4_000_001), displayName: 'Head office', isTrusted: true, ipRanges: [{ cidrAddress: '203.0.113.0/24' }] }]),
      authStrengths: section([{ id: '00000000-0000-0000-0000-000000000004', displayName: 'Phishing-resistant MFA', policyType: 'builtIn', allowedCombinations: ['windowsHelloForBusiness', 'fido2', 'x509CertificateMultiFactor'] }]),
      authMethodsPolicy: section([{ policyMigrationState: spec.perUserMfa ? 'preMigration' : 'migrationComplete', registrationEnforcement: { authenticationMethodsRegistrationCampaign: { state: 'enabled' } }, authenticationMethodConfigurations: [{ id: 'MicrosoftAuthenticator', state: 'enabled', includeTargets: [{ id: 'all_users' }] }, { id: 'Fido2', state: 'enabled', includeTargets: [{ id: 'all_users' }] }, { id: 'Sms', state: spec.breakGlassSmsOnly ? 'enabled' : 'disabled', includeTargets: [] }] }]),
      securityDefaults: section([{ isEnabled: spec.securityDefaults === true }]),
      crossTenantAccess: section([]),
      roleAssignments: section(Object.entries(rolesActive).map(([principalId, roles]) => ({ principalId, roleDefinitionId: roles[0], roleDefinition: { id: roles[0], displayName: 'Global Administrator' } }))),
      pimEligibility: section([], p2 ? 'ok' : 'disabled', p2 ? null : 'needs Entra ID P2'),
      subscribedSkus: section([
        ...(p1 ? [{ skuId: 'sku-p1', skuPartNumber: 'AAD_PREMIUM', prepaidUnits: { enabled: spec.users + 20 }, consumedUnits: spec.users, servicePlans: [{ servicePlanId: AAD_P1, servicePlanName: 'AAD_PREMIUM', provisioningStatus: 'Success' }] }] : []),
        ...(p2 ? [{ skuId: 'sku-p2', skuPartNumber: 'AAD_PREMIUM_P2', prepaidUnits: { enabled: Math.round(spec.users / 2) }, consumedUnits: Math.round(spec.users * 0.4), servicePlans: [{ servicePlanId: AAD_P2, servicePlanName: 'AAD_PREMIUM_P2', provisioningStatus: 'Success' }] }] : []),
      ]),
      me: section([{ id: ids[0], displayName: 'Operator', userPrincipalName: `user0@${spec.name}.example.com` }]),
      organization: section([{ displayName: `Fixture ${spec.name}`, verifiedDomains: [{ name: `${spec.name}.example.com`, isInitial: false }, { name: `${spec.name}.onmicrosoft.com`, isInitial: true }] }]),
      meMemberOf: section([]),
    },
    registrationDetails: hostile ? [] : registrationDetails,
    users,
    devices: hostile
      ? []
      : ids.slice(0, Math.round(ids.length * (spec.intuneShare ?? 0.6))).map((owner, i) => ({ id: guid(spec.name, 3_000_000 + i), displayName: `DEVICE-${i}`, isCompliant: i % 3 !== 0, isManaged: i % 4 !== 0, trustType: spec.hybrid && i % 2 === 0 ? 'ServerAd' : 'AzureAd', ownerIds: [owner], operatingSystem: i % 5 === 0 ? 'iOS' : 'Windows', approximateLastSignIn: daysAgo(i % 40) })),
    spActivity: [],
    authMethods: hostile ? Object.fromEntries(Object.keys(authMethods).map((k) => [k, 'unknown' as const])) : authMethods,
    appSignInSummary: [{ appId: '00000003-0000-0ff1-ce00-000000000000', appDisplayName: 'Office 365 SharePoint Online', signInCount: spec.users * 12 }],
    signInEvidence: hostile ? {} : signInEvidence,
    evidencePolicyResults: [],
    blockedToday: [],
    evidenceUsage: hostile ? null : { legacyAuth: { count: svcIds.length * 40, userIds: svcIds, byDetail: { 'IMAP4': svcIds.length * 40 } }, deviceCode: { count: 0, userIds: [], byDetail: {} }, authTransfer: { count: 0, userIds: [], byDetail: {} } },
    evidenceAggregates: hostile ? null : { total: spec.users * 8, distinctUsers: Object.keys(signInEvidence).length, byClientApp: { Browser: spec.users * 6, 'Mobile Apps and Desktop clients': spec.users * 2 }, byProtocol: { none: spec.users * 8 }, byCountry: { AU: spec.users }, byWeekdayHour: weekdayHourBuckets(spec.users * 8, spec.multiGeo ? 'flat' : 'office', rand) },
    capabilities: caps,
    microsoftManagedPolicyIds: [],
    roles: { active: rolesActive, eligible: {} },
  }

  const mapping: MappingState = {
    ...emptyMappingState(tenantId),
    breakGlassUserIds: bgIds,
    breakGlassAnswers: spec.hostile ? { credentialStorage: false, signInMonitoring: false } : { credentialStorage: true, signInMonitoring: true },
    serviceAccountUserIds: svcIds,
    allowedCountries: spec.multiGeo ? ['AU', 'NZ', 'GB', 'US'] : ['AU'],
    displayTimeZone: 'Australia/Sydney',
    records: {
      __globalExclusion: { placeholder: '__globalExclusion', kind: 'group', group: 'globalExclusion', resolvedId: exclusionGroup, resolvedName: 'Core - Exclusions', provenance: 'confirmed', doesNotExist: false, validation: null },
    },
    wizardAnswered: { breakGlass: true, globalExclusion: true, countries: true, highCare: true, trustedLocations: true, serviceAccounts: true, timeZone: true, frameworks: true, applicability: true },
  }
  const groups: GroupMembers = new Map()
  groups.set(bgGroup, { memberIds: bgIds, memberCount: bgIds.length, sampled: false, displayName: 'Core - Break glass' })
  const exclusionMembers = [...bgIds, ...ids.slice(spec.admins, spec.admins + (spec.exclusionGroupSize ?? 0))]
  groups.set(exclusionGroup, { memberIds: exclusionMembers, memberCount: exclusionMembers.length, sampled: false, displayName: 'Core - Exclusions' })
  // midflight's tagged policies were applied by the plan, so the plan predates them; every other plan is generated now.
  const planCreatedAt = spec.midflight ? daysAgo(60) : NOW
  return { name: spec.name, snapshot, baseline: syntheticBaseline(spec.name), mapping, groups, planId, planCreatedAt, operatorId: ids[0], expect: spec.expect }
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
  { name: 'micro', users: 8, admins: 1, licence: 'none', policies: 0, securityDefaults: true, expect: { rings: 1, weeksAtMost: 5, namesListed: true, policyCapWarning: false } },
  // Recomputed with batching (prompt 41 §8). The weekly cap counts supervised
  // change windows rather than steps, so twelve enforceable steps on the small
  // fixture now occupy two change days instead of seven, and the plan is five
  // weeks instead of seven. What sets every one of these numbers is the
  // registration campaign and the ring soak after it, not the enforcement pace.
  { name: 'small', users: 28, admins: 2, licence: 'p1', policies: 3, expect: { rings: 2, weeksAtMost: 7, namesListed: true, policyCapWarning: false } },
  { name: 'mid', users: 280, admins: 14, licence: 'mixed', policies: 11, serviceAccounts: 3, expect: { rings: 3, weeksAtMost: 9, namesListed: false, policyCapWarning: false } },
  { name: 'large', users: 4900, admins: 60, licence: 'p1', policies: 40, hybrid: true, intuneShare: 0.55, expect: { rings: 4, weeksAtMost: 9, namesListed: false, policyCapWarning: true } },
  { name: 'huge', users: 25000, admins: 300, licence: 'p2', policies: 120, multiGeo: true, expect: { rings: 4, weeksAtMost: 10, namesListed: false, policyCapWarning: true } },
  { name: 'messy', users: 120, admins: 6, licence: 'p1', policies: 6, securityDefaults: true, perUserMfa: true, disabledPolicies: 20, reportOnlyPolicies: 6, breakGlassSmsOnly: true, exclusionGroupSize: 400, expect: { rings: 3, weeksAtMost: 8, namesListed: false, policyCapWarning: false } },
  { name: 'midflight', users: 60, admins: 3, licence: 'p1', policies: 6, midflight: true, expect: { rings: 3, weeksAtMost: 8, namesListed: false, policyCapWarning: false } },
  { name: 'hostile', users: 40, admins: 2, licence: 'p1', policies: 3, hostile: true, expect: { rings: 3, weeksAtMost: 9, namesListed: false, policyCapWarning: false } },
]

export function allFixtures(): Fixture[] {
  return FIXTURE_SPECS.map(buildFixture)
}

export function fixture(name: FixtureName): Fixture {
  const spec = FIXTURE_SPECS.find((s) => s.name === name)
  if (!spec) throw new Error(`no fixture ${name}`)
  return buildFixture(spec)
}
