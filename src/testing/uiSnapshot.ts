// Synthetic tenant for the dev-only component gallery — invented names,
// no real identifiers. Never used outside DEV builds.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { BaselineResult } from '../ui/baseline.ts'
import { emptyCapabilities } from '../licensing/capabilities.ts'

const now = new Date()
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString()

export function fixtureSnapshot(): TenantSnapshot {
  const users = [
    ['u-1', 'Alex Morgan', 'alex@example.com', 'member', 2],
    ['u-2', 'Sam Lee', 'sam@example.com', 'member', 5],
    ['u-3', 'Priya Nair', 'priya@example.com', 'member', 40],
    ['u-4', 'Break-glass 01', 'bg01@contoso.onmicrosoft.com', 'member', 120],
    ['u-5', 'Jordan Kim', 'jordan_partner.example.com#EXT#@example.com', 'guest', 9],
  ] as const
  const caps = emptyCapabilities()
  caps.entraP1 = { enabled: true, seats: 25, consumed: 5 }
  return {
    schemaVersion: 1,
    tenantId: '00000000-0000-0000-0000-000000000000',
    asOf: now.toISOString(),
    sources: {
      config: { status: 'ok', coveredWindow: null, reason: null, asOf: now.toISOString() },
      registrationDetails: { status: 'ok', coveredWindow: null, reason: null, asOf: now.toISOString() },
      users: { status: 'ok', coveredWindow: null, reason: null, asOf: now.toISOString() },
      devices: { status: 'ok', coveredWindow: null, reason: null, asOf: now.toISOString() },
      spActivity: { status: 'ok', coveredWindow: null, reason: null, asOf: now.toISOString() },
      authMethods: { status: 'ok', coveredWindow: null, reason: null, asOf: now.toISOString() },
      appSignInSummary: { status: 'ok', coveredWindow: null, reason: null, asOf: now.toISOString() },
      signInEvidence: { status: 'ok', coveredWindow: { from: daysAgo(30), to: now.toISOString() }, reason: null, asOf: now.toISOString() },
    },
    config: {
      caPolicies: {
        status: 'ok',
        reason: null,
        rows: [
          {
            id: 'p-1',
            displayName: 'CA001 - Require MFA for all users',
            state: 'enabled',
            conditions: { users: { includeUsers: ['All'], excludeUsers: ['u-4'] },applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] },
            grantControls: { operator: 'OR', builtInControls: ['mfa'] },
          },
          {
            id: 'p-2',
            displayName: 'CA002 - Block legacy authentication',
            state: 'enabledForReportingButNotEnforced',
            conditions: { users: { includeUsers: ['All'], excludeUsers: ['u-4'] },applications: { includeApplications: ['All'] }, clientAppTypes: ['exchangeActiveSync', 'other'] },
            grantControls: { operator: 'OR', builtInControls: ['block'] },
          },
          {
            id: 'p-3',
            displayName: 'CA003 - Admins phishing-resistant',
            state: 'disabled',
            conditions: { users: { includeRoles: ['62e90394-69f5-4237-9190-012177145e10'] }, applications: { includeApplications: ['All'] }, locations: { includeLocations: ['All'], excludeLocations: ['l-1'] } },
            grantControls: { operator: 'AND', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } },
            sessionControls: { signInFrequency: { isEnabled: true, value: 4, type: 'hours' }, persistentBrowser: { isEnabled: true, mode: 'never' } },
          },
        ],
      },
      namedLocations: {
        status: 'ok',
        reason: null,
        rows: [
          { '@odata.type': '#microsoft.graph.ipNamedLocation', id: 'l-1', displayName: 'Head office', isTrusted: true, ipRanges: [{ cidrAddress: '203.0.113.0/24' }] },
          { '@odata.type': '#microsoft.graph.countryNamedLocation', id: 'l-2', displayName: 'Allowed countries', isTrusted: false, countriesAndRegions: ['AU', 'NZ'] },
        ],
      },
      authStrengths: {
        status: 'ok',
        reason: null,
        rows: [
          { id: '00000000-0000-0000-0000-000000000004', displayName: 'Phishing-resistant MFA', policyType: 'builtIn', allowedCombinations: ['windowsHelloForBusiness', 'fido2', 'x509CertificateMultiFactor'] },
          { id: 's-2', displayName: 'Contoso passwordless', policyType: 'custom', allowedCombinations: ['fido2', 'microsoftAuthenticatorPush,federatedSingleFactor'] },
        ],
      },
      authMethodsPolicy: {
        status: 'ok',
        reason: null,
        rows: [
          {
            policyMigrationState: 'migrationComplete',
            registrationEnforcement: { authenticationMethodsRegistrationCampaign: { state: 'enabled' } },
            authenticationMethodConfigurations: [
              { id: 'MicrosoftAuthenticator', state: 'enabled', includeTargets: [{ id: 'all_users' }] },
              { id: 'Fido2', state: 'enabled', includeTargets: [{ id: 'all_users' }] },
              { id: 'Sms', state: 'disabled', includeTargets: [] },
              { id: 'TemporaryAccessPass', state: 'enabled', includeTargets: [{ id: 'all_users' }] },
            ],
          },
        ],
      },
      securityDefaults: { status: 'ok', reason: null, rows: [{ isEnabled: false }] },
      crossTenantAccess: { status: 'ok', reason: null, rows: [] },
      roleAssignments: { status: 'ok', reason: null, rows: [] },
      pimEligibility: { status: 'disabled', reason: 'needs Entra ID P2', rows: [] },
      subscribedSkus: {
        status: 'ok',
        reason: null,
        rows: [
          { skuId: 'sku-1', skuPartNumber: 'SPB', prepaidUnits: { enabled: 25 }, consumedUnits: 5, servicePlans: [{ servicePlanId: '41781fb2-bc02-4b7c-bd55-b576c07bb09d', servicePlanName: 'AAD_PREMIUM', provisioningStatus: 'Success' }] },
          { skuId: 'sku-2', skuPartNumber: 'O365_BUSINESS_ESSENTIALS', prepaidUnits: { enabled: 25 }, consumedUnits: 20, servicePlans: [] },
        ],
      },
      organization: {
        status: 'ok',
        reason: null,
        rows: [{ displayName: 'Contoso Pty Ltd', verifiedDomains: [{ name: 'example.com', isInitial: false }, { name: 'contoso.onmicrosoft.com', isInitial: true }] }],
      },
      me: { status: 'ok', reason: null, rows: [{ id: 'u-1', displayName: 'Alex Morgan', userPrincipalName: 'alex@example.com' }] },
      meMemberOf: { status: 'ok', reason: null, rows: [] },
    },
    registrationDetails: users.map(([id, , upn, type]) => ({
      id,
      userPrincipalName: upn,
      isMfaCapable: id !== 'u-3',
      isMfaRegistered: id !== 'u-3',
      isPasswordlessCapable: id === 'u-1',
      methodsRegistered: id === 'u-3' ? [] : id === 'u-1' ? ['microsoftAuthenticatorPush', 'passKeyDeviceBound'] : ['microsoftAuthenticatorPush'],
      defaultMfaMethod: null,
      userPreferredMethodForSecondaryAuthentication: null,
      isAdmin: id === 'u-1',
      userType: type,
    })),
    users: users.map(([id, displayName, userPrincipalName, userType, last]) => ({
      id,
      displayName,
      userPrincipalName,
      mail: null,
      userType,
      usageLocation: 'AU',
      createdDateTime: daysAgo(400),
      lastSuccessfulSignIn: daysAgo(last),
      accountEnabled: true,
      assignedPlans: [{ servicePlanId: '41781fb2-bc02-4b7c-bd55-b576c07bb09d', capabilityStatus: 'Enabled' }],
      onPremisesSyncEnabled: false,
      externalUserState: null,
      department: 'Operations',
      jobTitle: null,
      officeLocation: null,
    })),
    devices: [
      { id: 'd-1', displayName: 'LAPTOP-ALEX', isCompliant: true, isManaged: true, trustType: 'AzureAd', ownerIds: ['u-1'], operatingSystem: 'Windows', approximateLastSignIn: daysAgo(1) },
      { id: 'd-2', displayName: 'iPhone', isCompliant: false, isManaged: false, trustType: 'Workplace', ownerIds: ['u-2'], operatingSystem: 'iOS', approximateLastSignIn: daysAgo(12) },
    ],
    spActivity: [{ appId: 'app-1', lastSignInActivity: { lastSignInDateTime: daysAgo(3) } }],
    authMethods: {
      'u-1': [{ kind: 'microsoftAuthenticator', phoneAppVersion: '6.2508.0' }, { kind: 'passkey' }],
      'u-2': [{ kind: 'microsoftAuthenticator', phoneAppVersion: '6.2506.0' }],
      'u-3': [],
      'u-4': [{ kind: 'fido2' }],
      'u-5': [{ kind: 'phone', phoneType: 'mobile' }],
    },
    appSignInSummary: [
      { appId: 'app-1', appDisplayName: 'Contoso Intranet', signInCount: 412 },
      { appId: '00000003-0000-0ff1-ce00-000000000000', appDisplayName: 'Office 365 SharePoint Online', signInCount: 1207 },
    ],
    signInEvidence: {
      // The records' proof per method and platform (Step 7): an Authenticator approval proves no passkey.
      'u-1': { signInCount: 40, lastSignIn: daysAgo(2), lastMfaSuccess: { at: daysAgo(2), method: 'Mobile app notification' }, proofs: [{ cls: 'authenticator', os: 'Windows', at: daysAgo(2), method: 'Mobile app notification' }], platforms: [{ os: 'Windows', at: daysAgo(2) }] },
      'u-2': { signInCount: 12, lastSignIn: daysAgo(5), lastMfaSuccess: null, proofs: [], platforms: [{ os: 'iOS', at: daysAgo(5) }] },
    },
    evidencePolicyResults: [
      {
        policyId: 'p-2',
        displayName: 'CA002 - Block legacy authentication',
        counts: { reportOnlyFailure: 3, reportOnlyInterrupted: 0, reportOnlySuccess: 210, enforcedFailure: 0, enforcedSuccess: 0 },
        affectedUserIds: { reportOnlyFailure: ['u-3'], reportOnlyInterrupted: [], reportOnlySuccess: [], enforcedFailure: [], enforcedSuccess: [] },
      },
    ],
    blockedToday: [{ policyId: 'p-1', displayName: 'CA001 - Require MFA for all users', userIds: ['u-3'] }],
    evidenceUsage: {
      legacyAuth: { count: 3, userIds: ['u-3'], byDetail: { 'Exchange ActiveSync': 3 } },
      deviceCode: { count: 0, userIds: [], byDetail: {} },
      authTransfer: { count: 0, userIds: [], byDetail: {} }, riskHigh: { count: 0, userIds: [], byDetail: {} }, riskMedium: { count: 0, userIds: [], byDetail: {} },
    },
    evidenceAggregates: {
      total: 1619,
      distinctUsers: 4,
      byClientApp: { Browser: 1200, 'Mobile Apps and Desktop clients': 416, 'Exchange ActiveSync': 3 },
      byProtocol: { none: 1616, deviceCode: 0, ropc: 3 },
      byCountry: { AU: 4, NZ: 1 },
    },
    capabilities: caps,
    microsoftManagedPolicyIds: [],
    roles: { active: { 'u-1': ['62e90394-69f5-4237-9190-012177145e10'] }, eligible: {} },
  }
}

/** The gallery's synthetic baseline: one legacy-auth block with a tenant-specific exclusion group. */
/**
 * The mock tenant's own exclusions group, and its one member: the emergency
 * account the fixture's policies name.
 *
 * Every fixture in this repository carries one, deliberately — a tenant that has
 * not chosen an exclusions group has no policy IAMAI may write, so it exercises
 * none of the surfaces these mocks exist to check. This one had none, and got a
 * plan anyway because the goal templates used to carve the emergency accounts
 * out by name; with that second authority gone (data/goals.json), the mock needs
 * the object the product actually uses.
 */
export const FIXTURE_EXCLUSIONS_GROUP = { id: 'g-exclusions', displayName: 'Core - Exclusions', memberIds: ['u-4'] }

/**
 * The emergency accounts the mock tenant's operator chose, for the same reason
 * the exclusions group above is chosen: a detection recommends these accounts
 * and may not select them (mapping/emergencyChoice.ts), so a tenant that has
 * not answered has no emergency access, its exclusions group holds an account
 * nothing approves, and the plan the mocks exist to check cannot finish. Seeded
 * through the writer a Save uses, never by writing the field.
 */
export const FIXTURE_EMERGENCY_ACCOUNTS = ['u-4']

export function fixtureBaseline(): BaselineResult {
  return {
  source: 'synthetic baseline',
  fetchFailures: 0,
  origin: { kind: 'upload', files: [] },
  pkg: {
    policies: [
      {
        id: 'b-1',
        displayName: 'ACME - GLOBAL - BLOCK - LegacyAuth - ExludeSvcAccounts',
        state: 'enabled',
        conditions: {
          users: { includeUsers: ['All'], excludeGroups: ['11111111-1111-1111-1111-111111111111'] },
          applications: { includeApplications: ['All'] },
          clientAppTypes: ['exchangeActiveSync', 'other'],
        },
        grantControls: { operator: 'OR', builtInControls: ['block'] },
      },
    ],
    origins: {},
    report: { considered: 1, parsed: 1, skipped: [], errors: [], duplicates: [], warnings: [] },
    references: [
      {
        id: '11111111-1111-1111-1111-111111111111',
        kind: 'group',
        portability: 'tenantSpecific',
        uses: [{ policyName: 'ACME - GLOBAL - BLOCK - LegacyAuth - ExludeSvcAccounts', side: 'exclude' }],
      },
    ],
    groupSignatures: [
      { id: '11111111-1111-1111-1111-111111111111', inferredRole: 'globalExclusion', confidence: 'high', evidence: 'excluded from 1 of 1 user-targeting policies, never included' },
    ],
    variantSets: [{ intentKey: 'countries', relation: 'variant', policyNames: ['Countries - allow list', 'Countries - block list'] }],
    docs: [],
  } as unknown as BaselineResult['pkg'],
}
}
