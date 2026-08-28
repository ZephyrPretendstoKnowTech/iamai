// Declarative registry of everything IAMAI reads from Microsoft Graph.
// Single source of truth: the collectors take their endpoints from here, the
// "What IAMAI reads" page renders it, and SPEC.md §4 is generated from it
// (scripts/spec-scopes.ts). Pure data — importable from Node, the worker,
// and the UI.
import type { ConfigSectionKey } from './types.ts'

export type Capability =
  | 'entraP1'
  | 'entraP2'
  | 'intune'
  | 'workloadIdPremium'
  | 'globalSecureAccess'
  | 'defenderForCloudApps'
  | 'purviewInsiderRisk'

export type CollectorSpec = {
  name: string
  lane: '0' | 'A' | 'B' | 'on-demand'
  configKey?: ConfigSectionKey
  endpoint: string
  version: 'v1.0' | 'beta'
  paged?: boolean
  scopes: string[]
  requiredCapability: Capability | null
  gate: string
  purpose: string
}

export const COLLECTOR_REGISTRY: CollectorSpec[] = [
  // ---- Lane 0: config reads ----
  { name: 'CA policies', lane: '0', configKey: 'caPolicies', endpoint: '/identity/conditionalAccess/policies', version: 'v1.0', paged: true, scopes: ['Policy.Read.All'], requiredCapability: null, gate: 'none', purpose: 'The tenant policy set the diff and roadmap work from; Microsoft-managed policies are flagged.' },
  { name: 'Named locations', lane: '0', configKey: 'namedLocations', endpoint: '/identity/conditionalAccess/namedLocations', version: 'v1.0', paged: true, scopes: ['Policy.Read.All'], requiredCapability: null, gate: 'none', purpose: 'Trusted-location validation and location-based intents.' },
  { name: 'Authentication strengths', lane: '0', configKey: 'authStrengths', endpoint: '/policies/authenticationStrengthPolicies', version: 'v1.0', paged: true, scopes: ['Policy.Read.All'], requiredCapability: null, gate: 'none', purpose: 'Resolve strength references in policies, incl. custom strengths.' },
  { name: 'Auth methods policy', lane: '0', configKey: 'authMethodsPolicy', endpoint: '/policies/authenticationMethodsPolicy', version: 'v1.0', scopes: ['Policy.Read.All'], requiredCapability: null, gate: 'none', purpose: 'Method availability, registrationEnforcement, policyMigrationState.' },
  { name: 'Security defaults', lane: '0', configKey: 'securityDefaults', endpoint: '/policies/identitySecurityDefaultsEnforcementPolicy', version: 'v1.0', scopes: ['Policy.Read.All'], requiredCapability: null, gate: 'none', purpose: 'Whether security defaults are on (mutually exclusive with CA).' },
  { name: 'Cross-tenant access', lane: '0', configKey: 'crossTenantAccess', endpoint: '/policies/crossTenantAccessPolicy', version: 'v1.0', scopes: ['Policy.Read.All'], requiredCapability: null, gate: 'none', purpose: 'Guest/B2B posture affecting external-user intents.' },
  { name: 'Role assignments', lane: '0', configKey: 'roleAssignments', endpoint: '/roleManagement/directory/roleAssignments?$expand=roleDefinition($select=id,displayName)', version: 'v1.0', paged: true, scopes: ['RoleManagement.Read.Directory'], requiredCapability: null, gate: 'none', purpose: 'Active admin roles per user for admin-targeting intents; role names for display.' },
  { name: 'PIM eligibility', lane: '0', configKey: 'pimEligibility', endpoint: '/roleManagement/directory/roleEligibilitySchedules', version: 'v1.0', paged: true, scopes: ['RoleManagement.Read.Directory'], requiredCapability: 'entraP2', gate: 'Entra ID P2', purpose: 'Eligible vs permanent roles; eligible is out of CA role scope until activated.' },
  { name: 'Subscribed SKUs', lane: '0', configKey: 'subscribedSkus', endpoint: '/subscribedSkus', version: 'v1.0', paged: true, scopes: ['Directory.Read.All'], requiredCapability: null, gate: 'none', purpose: 'Tenant licence capabilities and seat coverage.' },
  { name: 'Organization', lane: '0', configKey: 'organization', endpoint: '/organization', version: 'v1.0', paged: true, scopes: ['Directory.Read.All'], requiredCapability: null, gate: 'none', purpose: 'Tenant name and verified domains for the plan-file header.' },
  { name: 'Signed-in operator', lane: '0', configKey: 'me', endpoint: '/me', version: 'v1.0', scopes: ['Directory.Read.All'], requiredCapability: null, gate: 'none', purpose: 'Operator identity recorded in the plan file.' },
  { name: 'Operator groups', lane: '0', configKey: 'meMemberOf', endpoint: '/me/memberOf', version: 'v1.0', paged: true, scopes: ['Directory.Read.All'], requiredCapability: null, gate: 'none', purpose: 'Warn when the operator sits inside groups a plan step targets.' },
  // ---- Lane A: aggregates ----
  { name: 'Registration details', lane: 'A', endpoint: '/reports/authenticationMethods/userRegistrationDetails', version: 'v1.0', paged: true, scopes: ['AuditLog.Read.All'], requiredCapability: 'entraP1', gate: 'Entra ID P1/P2', purpose: 'Per-user registered method types (no phone numbers) for MFA viability.' },
  { name: 'Users', lane: 'A', endpoint: '/users', version: 'v1.0', paged: true, scopes: ['Directory.Read.All', 'AuditLog.Read.All'], requiredCapability: null, gate: 'signInActivity needs Entra ID P1/P2 (degrades to a plain user list)', purpose: 'User inventory with activity, licence plans, and org attributes.' },
  { name: 'Devices', lane: 'A', endpoint: '/devices', version: 'v1.0', paged: true, scopes: ['Directory.Read.All'], requiredCapability: null, gate: 'none', purpose: 'Compliance/trust state with registered owners for device intents.' },
  { name: 'SP sign-in activity', lane: 'A', endpoint: '/reports/servicePrincipalSignInActivities', version: 'beta', paged: true, scopes: ['Reports.Read.All'], requiredCapability: null, gate: 'attempt and map the 403 (documented scope: Reports.Read.All)', purpose: 'Workload identity usage for later phases.' },
  { name: 'Auth methods', lane: 'A', endpoint: '/users/{id}/authentication/methods ($batch of 20)', version: 'v1.0', scopes: ['UserAuthenticationMethod.Read.All'], requiredCapability: null, gate: 'inner 403 marks that user unknown', purpose: 'Registered method detail (values stripped; never phone numbers).' },
  { name: 'App sign-in summary', lane: 'A', endpoint: '/reports/applicationSignInDetailedSummary', version: 'beta', paged: true, scopes: ['Reports.Read.All'], requiredCapability: null, gate: 'attempt and map the 403', purpose: 'Aggregated per-app usage for app-scoping decisions.' },
  // ---- Lane B: sign-in evidence ----
  { name: 'Sign-in logs', lane: 'B', endpoint: '/auditLogs/signIns', version: 'beta', paged: true, scopes: ['AuditLog.Read.All'], requiredCapability: 'entraP1', gate: 'Entra ID P1/P2; only the preview endpoint returns the fields needed; read newest-first and cut off in the browser', purpose: 'Interactive sign-in evidence for the replay engine and MFA verification.' },
  // ---- On demand ----
  { name: 'Group transitive members', lane: 'on-demand', endpoint: '/groups/{id} ($select=id,displayName,membershipRule) + /groups/{id}/transitiveMembers (+ $count)', version: 'v1.0', paged: true, scopes: ['Directory.Read.All'], requiredCapability: null, gate: 'runs only for groups the chosen baseline references; count-and-sample above 20k', purpose: 'Group name, dynamic rule, affected-population counts and exclusion-group sanity checks.' },
  { name: 'Group search', lane: 'on-demand', endpoint: "/groups?$filter=startswith(displayName,…)", version: 'v1.0', scopes: ['Directory.Read.All'], requiredCapability: null, gate: 'runs only while the operator types in a Setup picker', purpose: 'Find the tenant group a baseline reference maps to.' },
  { name: 'Name resolution', lane: 'on-demand', endpoint: '/directoryObjects/getByIds', version: 'v1.0', scopes: ['Directory.Read.All'], requiredCapability: null, gate: 'runs only for ids the UI would otherwise show raw', purpose: 'Show display names instead of raw identifiers, everywhere.' },
]
