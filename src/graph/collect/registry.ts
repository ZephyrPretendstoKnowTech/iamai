// Declarative registry of everything IAMAI reads from Microsoft Graph.
// Single source of truth: the collectors take their endpoints from here, the
// "What IAMAI reads" page renders it, and SPEC.md §4 is generated from it
// (scripts/spec-scopes.ts). Pure data — importable from Node, the worker,
// and the UI.
import type { ConfigSectionKey, SourceKey } from './types.ts'

export type Capability =
  | 'entraP1'
  | 'entraP2'
  /**
   * Privileged Identity Management. Microsoft licenses it with Entra ID P2 OR
   * Microsoft Entra ID Governance, which is sold to P1 tenants and carries no
   * P2 service plan (Microsoft Learn, ID Governance licensing fundamentals). It
   * was read as `entraP2`, so a P1 tenant holding Governance was told its
   * eligible role assignments needed Entra ID P2 and was never read (R4-37).
   * Not folded into `entraP2`: ID Protection's risk policies still need P2.
   */
  | 'pim'
  | 'intune'
  | 'workloadIdPremium'
  | 'globalSecureAccess'
  | 'defenderForCloudApps'
  | 'purviewInsiderRisk'

/**
 * The licence a capability stands for, in the words a section skipped for want
 * of it states. Only the capabilities a collector is gated on.
 */
const CAPABILITY_LICENCE: Partial<Record<Capability, string>> = {
  entraP1: 'Entra ID P1',
  entraP2: 'Entra ID P2',
  pim: 'Entra ID P2 or Microsoft Entra ID Governance',
}

/** The licence words for a capability: its product name, or the capability's own id where none is kept. */
export function capabilityLicence(capability: Capability): string {
  return CAPABILITY_LICENCE[capability] ?? capability
}

/**
 * The reason a section carries when the collector skipped it because the
 * tenant's licence does not include it (graph/collect/worker.ts). One sentence,
 * so what the collector writes, what a fixture pretends it wrote and what
 * roles.ts isLicenceGate reads cannot drift apart (R4-37: the fixtures said
 * "needs Entra ID P2" where the collector says "not available on this licence
 * (needs Entra ID P2)").
 */
export function licenceGateReason(capability: Capability): string {
  return `not available on this licence (needs ${capabilityLicence(capability)})`
}

export type CollectorSpec = {
  name: string
  lane: '0' | 'A' | 'B' | 'on-demand'
  configKey?: ConfigSectionKey
  /** The scan-progress source this collector reports under (lanes A and B). */
  sourceKey?: SourceKey
  endpoint: string
  /**
   * The same read without the part of it a tenant's Graph may refuse (a 400 on
   * an `$expand`), tried once when the first read fails that way. What comes
   * back is the narrower answer, and every reading of it treats the fields it
   * lacks as unread rather than absent.
   */
  fallbackEndpoint?: string
  version: 'v1.0' | 'beta'
  paged?: boolean
  scopes: string[]
  requiredCapability: Capability | null
  gate: string
  purpose: string
}

export const COLLECTOR_REGISTRY: CollectorSpec[] = [
  { name: 'Per-user MFA requirements', lane: 'on-demand', endpoint: '/users/{id}/authentication/requirements', version: 'beta', scopes: ['Policy.Read.All'], requiredCapability: null, gate: 'Read for every account as directory pages arrive, in batches of 20; failures stay unknown', purpose: 'Actual legacy per-user MFA state, independent of authentication-method migration status.' },
  // ---- Lane 0: config reads ----
  { name: 'CA policies', lane: '0', configKey: 'caPolicies', endpoint: '/identity/conditionalAccess/policies', version: 'v1.0', paged: true, scopes: ['Policy.Read.All'], requiredCapability: null, gate: 'none', purpose: 'The tenant policy set the diff and roadmap work from; Microsoft-managed policies are flagged.' },
  { name: 'Named locations', lane: '0', configKey: 'namedLocations', endpoint: '/identity/conditionalAccess/namedLocations', version: 'v1.0', paged: true, scopes: ['Policy.Read.All'], requiredCapability: null, gate: 'none', purpose: 'Trusted-location validation and location-based intents.' },
  // The combination configurations come only when they are asked for, and they
  // are what a strength restricts its combinations to — which security keys,
  // which certificate issuers. Without them IAMAI cannot say that a tenant
  // strength is the same requirement as a baseline's (roadmap/resolvePolicy.ts),
  // so it asks, and falls back to the plain list where a tenant's Graph refuses
  // the expand rather than losing the section.
  { name: 'Authentication strengths', lane: '0', configKey: 'authStrengths', endpoint: '/policies/authenticationStrengthPolicies?$expand=combinationConfigurations', fallbackEndpoint: '/policies/authenticationStrengthPolicies', version: 'v1.0', paged: true, scopes: ['Policy.Read.All'], requiredCapability: null, gate: 'none', purpose: 'Resolve strength references in policies, incl. custom strengths and the configurations that restrict them.' },
  { name: 'Auth methods policy', lane: '0', configKey: 'authMethodsPolicy', endpoint: '/policies/authenticationMethodsPolicy', version: 'v1.0', scopes: ['Policy.Read.All'], requiredCapability: null, gate: 'Global Reader or Authentication Policy Administrator; a refused read holds the passkey settings step', purpose: 'Method availability and the Passkey (FIDO2) settings, registrationEnforcement, policyMigrationState (read from beta when v1.0 returns none).' },
  { name: 'Security defaults', lane: '0', configKey: 'securityDefaults', endpoint: '/policies/identitySecurityDefaultsEnforcementPolicy', version: 'v1.0', scopes: ['Policy.Read.All'], requiredCapability: null, gate: 'none', purpose: 'Whether security defaults are on (mutually exclusive with CA).' },
  // The tenant-wide "Require multifactor authentication to register or join
  // devices" setting (multiFactorAuthConfiguration). Microsoft documents that a
  // Conditional Access policy on the Register or join devices user action is not
  // properly enforced while it is on, so the plan reads it rather than asking a
  // person to look. Global Reader and the device administration roles can read
  // it under Policy.Read.All; a role that cannot reads as unknown, never as off.
  { name: 'Device registration policy', lane: '0', configKey: 'deviceRegistrationPolicy', endpoint: '/policies/deviceRegistrationPolicy', version: 'v1.0', scopes: ['Policy.Read.All'], requiredCapability: null, gate: 'Global Reader or a device administration role; otherwise unknown', purpose: 'Whether the tenant-wide device-registration MFA setting is on, which a Conditional Access user-action policy needs off.' },
  { name: 'Cross-tenant access', lane: '0', configKey: 'crossTenantAccess', endpoint: '/policies/crossTenantAccessPolicy', version: 'v1.0', scopes: ['Policy.Read.All'], requiredCapability: null, gate: 'none', purpose: 'Guest/B2B posture affecting external-user intents.' },
  { name: 'Role assignments', lane: '0', configKey: 'roleAssignments', endpoint: '/roleManagement/directory/roleAssignments?$expand=roleDefinition($select=id,displayName)', version: 'v1.0', paged: true, scopes: ['RoleManagement.Read.Directory'], requiredCapability: null, gate: 'none', purpose: 'Active admin roles per user for admin-targeting intents; role names for display.' },
  { name: 'Role assignment schedules', lane: '0', configKey: 'roleAssignmentSchedules', endpoint: '/roleManagement/directory/roleAssignmentScheduleInstances?$expand=roleDefinition($select=id,displayName)', version: 'v1.0', paged: true, scopes: ['RoleManagement.Read.Directory'], requiredCapability: null, gate: 'none', purpose: 'Whether an active emergency administrator role is assigned permanently rather than eligible, activated, or time-limited.' },
  { name: 'PIM eligibility', lane: '0', configKey: 'pimEligibility', endpoint: '/roleManagement/directory/roleEligibilitySchedules', version: 'v1.0', paged: true, scopes: ['RoleManagement.Read.Directory'], requiredCapability: 'pim', gate: 'Entra ID P2 or Microsoft Entra ID Governance', purpose: 'Eligible vs permanent roles; eligible is out of CA role scope until activated.' },
  { name: 'Subscribed SKUs', lane: '0', configKey: 'subscribedSkus', endpoint: '/subscribedSkus', version: 'v1.0', paged: true, scopes: ['Directory.Read.All'], requiredCapability: null, gate: 'none', purpose: 'Tenant licence capabilities and seat coverage.' },
  { name: 'Organization', lane: '0', configKey: 'organization', endpoint: '/organization', version: 'v1.0', paged: true, scopes: ['Directory.Read.All'], requiredCapability: null, gate: 'none', purpose: 'Tenant name and verified domains for the plan-file header.' },
  { name: 'Signed-in operator', lane: '0', configKey: 'me', endpoint: '/me', version: 'v1.0', scopes: ['Directory.Read.All'], requiredCapability: null, gate: 'none', purpose: 'Operator identity recorded in the plan file.' },
  { name: 'Operator groups', lane: '0', configKey: 'meMemberOf', endpoint: '/me/memberOf', version: 'v1.0', paged: true, scopes: ['Directory.Read.All'], requiredCapability: null, gate: 'none', purpose: 'Warn when the operator sits inside groups a plan step targets.' },
  // ---- Lane A: aggregates ----
  { name: 'Registration details', lane: 'A', sourceKey: 'registrationDetails', endpoint: '/reports/authenticationMethods/userRegistrationDetails', version: 'v1.0', paged: true, scopes: ['AuditLog.Read.All'], requiredCapability: 'entraP1', gate: 'Entra ID P1/P2; a person whose method read still failed, and whom the tenant-wide read has no row for, is read alone (/{id}, $batch of 20)', purpose: 'Per-user registered method types (no phone numbers) for MFA viability.' },
  { name: 'Users', lane: 'A', sourceKey: 'users', endpoint: '/users', version: 'v1.0', paged: true, scopes: ['Directory.Read.All', 'AuditLog.Read.All'], requiredCapability: null, gate: 'signInActivity needs Entra ID P1/P2 (degrades to a plain user list)', purpose: 'User inventory with activity, licence plans, and org attributes.' },
  { name: 'Devices', lane: 'A', sourceKey: 'devices', endpoint: '/devices', version: 'v1.0', paged: true, scopes: ['Directory.Read.All'], requiredCapability: null, gate: 'none', purpose: 'Compliance/trust state with registered owners for device intents.' },
  { name: 'SP sign-in activity', lane: 'A', sourceKey: 'spActivity', endpoint: '/reports/servicePrincipalSignInActivities', version: 'beta', paged: true, scopes: ['Reports.Read.All'], requiredCapability: null, gate: 'attempt and map the 403 (documented scope: Reports.Read.All)', purpose: 'Workload identity usage for later phases.' },
  { name: 'Auth methods', lane: 'A', sourceKey: 'authMethods', endpoint: '/users/{id}/authentication/methods and /users/{id}/authentication/fido2Methods ($batch of 20)', version: 'v1.0', scopes: ['UserAuthenticationMethod.Read.All'], requiredCapability: null, gate: 'a throttled or failed generic-method read is read again for that user alone, after the batch Retry-After; a user still unread is unknown and the registration report stands in; a failed FIDO2 detail read leaves credential fields unresolved', purpose: 'Registered method inventory plus exact passkey model, AAGUID, type and attestation detail (values stripped; never phone numbers).' },
  { name: 'App sign-in summary', lane: 'A', sourceKey: 'appSignInSummary', endpoint: '/reports/applicationSignInDetailedSummary', version: 'beta', paged: true, scopes: ['Reports.Read.All'], requiredCapability: null, gate: 'attempt and map the 403', purpose: 'Aggregated per-app usage for app-scoping decisions.' },
  // ---- Lane B: sign-in evidence ----
  { name: 'Sign-in logs', lane: 'B', sourceKey: 'signInEvidence', endpoint: '/auditLogs/signIns', version: 'beta', paged: true, scopes: ['AuditLog.Read.All'], requiredCapability: 'entraP1', gate: 'Entra ID P1/P2; only the preview endpoint returns the fields needed; read newest-first and cut off in the browser', purpose: 'Interactive sign-in evidence for the replay engine and MFA verification.' },
  // Read beside the sign-in logs (laneB.ts), under the same permission, and stored apart from them (snapshot.recoveryAuditSource).
  { name: 'Directory audit log', lane: 'B', endpoint: '/auditLogs/directoryAudits', version: 'beta', paged: true, scopes: ['AuditLog.Read.All'], requiredCapability: 'entraP1', gate: 'Entra ID P1/P2; read with the sign-in logs, the last 30 days', purpose: 'When an emergency access account, its exclusions group or a policy that applies to it last changed, for the automatic recovery checks.' },
  // ---- On demand ----
  { name: 'Passkey configuration', lane: 'on-demand', endpoint: '/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/Fido2', version: 'v1.0', scopes: ['Policy.Read.AuthenticationMethod'], requiredCapability: null, gate: 'Read during the authentication methods policy scan; Global Reader or Authentication Policy Administrator', purpose: 'Read the complete FIDO2 configuration and assigned passkey profiles; failed reads remain explicit rather than disabled settings.' },
  { name: 'Group evidence', lane: 'on-demand', endpoint: '/groups/{id} ($select=id,displayName,membershipRule,membershipRuleProcessingState,assignedLicenses,mailEnabled,securityEnabled,groupTypes,isAssignableToRole) + /groups/{id}/transitiveMembers (+ $count); saved exclusions group also reads beta /members and v1.0 /owners', version: 'beta', paged: true, scopes: ['Directory.Read.All'], requiredCapability: null, gate: 'mixed stable/beta read; exact direct members run only for the saved exclusions group; v1.0 owner results are diagnostic and coverage-limited because service principals may be omitted; transitive count-and-sample above 20k remains for other consumers', purpose: 'Group type, assigned/dynamic state, license assignments, exact direct membership, optional owner diagnostics, and transitive affected-population evidence.' },
  { name: 'Selected account transitive groups', lane: 'on-demand', endpoint: '/users/{id}/transitiveMemberOf/microsoft.graph.group', version: 'v1.0', paged: true, scopes: ['Directory.Read.All'], requiredCapability: null, gate: 'runs only for selected emergency accounts when relevant group membership is sampled or unread', purpose: 'Resolve effective membership for the selected recovery identities without enumerating every user.' },
  { name: 'Group search', lane: 'on-demand', endpoint: "/groups?$filter=startswith(displayName,…)", version: 'v1.0', scopes: ['Directory.Read.All'], requiredCapability: null, gate: 'runs only while the operator types in a group picker', purpose: 'Find the tenant group a baseline reference maps to.' },
  { name: 'Name resolution', lane: 'on-demand', endpoint: '/directoryObjects/getByIds', version: 'v1.0', scopes: ['Directory.Read.All'], requiredCapability: null, gate: 'runs only for ids the UI would otherwise show raw', purpose: 'Show display names instead of raw identifiers, everywhere.' },
]
