// Large synthetic tenant for the performance guard (prompt 20 §7): 5,000
// users, 40,000 sign-in records, 60 policies, 200 groups. Invented names and
// ids only; dev builds only. Deterministic so timings are comparable.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { fixtureSnapshot } from './uiSnapshot.ts'

export type BigFixtureOptions = { users?: number; signIns?: number; policies?: number; groups?: number }

const FIRST = ['Alex', 'Sam', 'Priya', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Drew', 'Avery', 'Quinn', 'Kai', 'Rowan', 'Sasha', 'Noor']
const LAST = ['Morgan', 'Lee', 'Nair', 'Kim', 'Singh', 'Nguyen', 'Brown', 'Wilson', 'Chen', 'Taylor', 'Walker', 'Patel', 'Garcia', 'Okafor', 'Ivanova', 'Haddad']
const DEPARTMENTS = ['Sales', 'Operations', 'Finance', 'Engineering', 'Support', 'Marketing', 'Legal', 'People']

// Small deterministic PRNG (mulberry32) so every run renders the same tenant.
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

export function bigFixtureSnapshot(opts: BigFixtureOptions = {}): TenantSnapshot {
  const userCount = opts.users ?? 5000
  const signIns = opts.signIns ?? 40_000
  const policyCount = opts.policies ?? 60
  const groupCount = opts.groups ?? 200
  const base = fixtureSnapshot()
  const now = Date.parse(base.asOf)
  const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString()
  const rand = rng(20260828)
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]

  const groups = Array.from({ length: groupCount }, (_, i) => `g-${String(i + 1).padStart(3, '0')}`)
  const userIds: string[] = []
  const users: TenantSnapshot['users'] = []
  const registrationDetails: TenantSnapshot['registrationDetails'] = []
  const authMethods: TenantSnapshot['authMethods'] = {}
  const signInEvidence: TenantSnapshot['signInEvidence'] = {}
  let signInsLeft = signIns
  for (let i = 0; i < userCount; i++) {
    const id = `u-${String(i + 1).padStart(5, '0')}`
    userIds.push(id)
    const guest = rand() < 0.06
    const displayName = `${pick(FIRST)} ${pick(LAST)}${guest ? ' (guest)' : ''}`
    const upn = guest ? `${id}_partner.example.com#EXT#@example.com` : `${id}@example.com`
    const r = rand()
    const lastDays = r < 0.8 ? Math.floor(rand() * 60) : r < 0.95 ? 90 + Math.floor(rand() * 300) : null
    const tier = rand()
    const methods = tier < 0.05 ? [] : tier < 0.15 ? ['mobilePhone'] : tier < 0.8 ? ['microsoftAuthenticatorPush'] : ['microsoftAuthenticatorPush', 'passKeyDeviceBound']
    users.push({
      id,
      displayName,
      userPrincipalName: upn,
      userType: guest ? 'guest' : 'member',
      mail: null,
      usageLocation: rand() < 0.9 ? 'AU' : 'NZ',
      createdDateTime: daysAgo(200 + Math.floor(rand() * 800)),
      lastSuccessfulSignIn: lastDays === null ? null : daysAgo(lastDays),
      accountEnabled: rand() > 0.02,
      assignedPlans: [{ servicePlanId: '41781fb2-bc02-4b7c-bd55-b576c07bb09d', capabilityStatus: 'Enabled' }],
      onPremisesSyncEnabled: rand() < 0.3,
      externalUserState: guest ? 'Accepted' : null,
      department: pick(DEPARTMENTS),
      jobTitle: null,
      officeLocation: null,
    })
    registrationDetails.push({
      id,
      userPrincipalName: upn,
      isMfaCapable: methods.length > 0,
      isMfaRegistered: methods.length > 0,
      isPasswordlessCapable: methods.includes('passKeyDeviceBound'),
      methodsRegistered: methods,
      defaultMfaMethod: null,
      userPreferredMethodForSecondaryAuthentication: null,
      isAdmin: i < 12,
      userType: guest ? 'guest' : 'member',
    })
    authMethods[id] = methods.map((m) =>
      m === 'mobilePhone' ? { kind: 'phone', phoneType: 'mobile' } : m === 'passKeyDeviceBound' ? { kind: 'passkey' } : { kind: 'microsoftAuthenticator', phoneAppVersion: '6.2508.0' },
    ) as TenantSnapshot['authMethods'][string]
    if (lastDays !== null && lastDays < 30 && signInsLeft > 0) {
      const count = Math.min(signInsLeft, 1 + Math.floor(rand() * 18))
      signInsLeft -= count
      const mfa = methods.length > 0 && rand() < 0.6
      signInEvidence[id] = {
        signInCount: count,
        lastSignIn: daysAgo(lastDays),
        lastMfaSuccess: mfa ? { at: daysAgo(lastDays), method: 'Mobile app notification' } : null,
      }
    }
  }

  const basePolicies = base.config.caPolicies?.rows ?? []
  const policies = [
    ...basePolicies,
    ...Array.from({ length: Math.max(0, policyCount - basePolicies.length) }, (_, i) => {
      const n = i + 4
      const block = i % 5 === 0
      return {
        id: `p-${n}`,
        displayName: `CA${String(n).padStart(3, '0')} - ${block ? 'Block' : 'Require MFA for'} ${pick(DEPARTMENTS)} ${i % 3 === 0 ? 'on mobile' : 'apps'}`,
        state: i % 4 === 0 ? 'enabledForReportingButNotEnforced' : i % 9 === 0 ? 'disabled' : 'enabled',
        conditions: {
          users: { includeGroups: [groups[i % groupCount], groups[(i * 7) % groupCount]], excludeGroups: [groups[(i * 3 + 1) % groupCount]] },
          applications: { includeApplications: [i % 2 === 0 ? 'All' : 'Office365'] },
          clientAppTypes: ['all'],
          ...(i % 3 === 0 ? { platforms: { includePlatforms: ['iOS', 'android'] } } : {}),
        },
        grantControls: { operator: 'OR', builtInControls: [block ? 'block' : 'mfa'] },
      }
    }),
  ]

  const activeIds = users.filter((u) => u.lastSuccessfulSignIn !== null).map((u) => u.id)
  const evidence = base.evidenceAggregates
  return {
    ...base,
    tenantId: '00000000-0000-0000-0000-00000000b16f',
    config: {
      ...base.config,
      caPolicies: { status: 'ok', reason: null, rows: policies },
      organization: { status: 'ok', reason: null, rows: [{ displayName: 'Contoso Group (5,000 users)' }] },
      subscribedSkus: {
        status: 'ok',
        reason: null,
        rows: [{ skuId: 'sku-1', skuPartNumber: 'SPE_E3', prepaidUnits: { enabled: 5200 }, consumedUnits: userCount, servicePlans: [{ servicePlanId: '41781fb2-bc02-4b7c-bd55-b576c07bb09d', servicePlanName: 'AAD_PREMIUM', provisioningStatus: 'Success' }] }],
      },
    },
    users,
    registrationDetails,
    authMethods,
    signInEvidence,
    devices: users.slice(0, 1500).map((u, i) => ({
      id: `d-${i}`,
      displayName: `LAPTOP-${i}`,
      isCompliant: i % 3 !== 0,
      isManaged: i % 4 !== 0,
      trustType: i % 2 === 0 ? 'AzureAd' : 'Workplace',
      ownerIds: [u.id],
      operatingSystem: i % 5 === 0 ? 'iOS' : 'Windows',
      approximateLastSignIn: daysAgo(i % 40),
    })),
    evidencePolicyResults: policies
      .filter((p) => (p as { state?: string }).state === 'enabledForReportingButNotEnforced')
      .map((p) => ({
        policyId: String((p as { id: string }).id),
        displayName: String((p as { displayName: string }).displayName),
        counts: { reportOnlyFailure: 3, reportOnlyInterrupted: 1, reportOnlySuccess: 400, enforcedFailure: 0, enforcedSuccess: 0 },
        affectedUserIds: { reportOnlyFailure: activeIds.slice(0, 3), reportOnlyInterrupted: activeIds.slice(3, 4), reportOnlySuccess: [], enforcedFailure: [], enforcedSuccess: [] },
      })),
    blockedToday: [{ policyId: 'p-1', displayName: 'CA001 - Require MFA for all users', userIds: activeIds.slice(0, 25) }],
    evidenceUsage: {
      legacyAuth: { count: 120, userIds: activeIds.slice(0, 40), byDetail: { 'Exchange ActiveSync': 120 } },
      deviceCode: { count: 4, userIds: activeIds.slice(40, 44), byDetail: {} },
      authTransfer: { count: 0, userIds: [], byDetail: {} }, riskHigh: { count: 0, userIds: [], byDetail: {} }, riskMedium: { count: 0, userIds: [], byDetail: {} },
    },
    evidenceAggregates: evidence
      ? { ...evidence, total: signIns, distinctUsers: Object.keys(signInEvidence).length, byClientApp: { Browser: Math.round(signIns * 0.7), 'Mobile Apps and Desktop clients': Math.round(signIns * 0.29), 'Exchange ActiveSync': 120 } }
      : null,
    roles: { active: Object.fromEntries(userIds.slice(0, 12).map((id) => [id, ['62e90394-69f5-4237-9190-012177145e10']])), eligible: {} },
  }
}
