// Framework-agnostic types for the baseline adapter.
// Policies are normalized to the Microsoft Graph v1.0 camelCase shape
// (conditionalAccessPolicy) regardless of how the source exported them.

export type PolicyState = "enabled" | "disabled" | "enabledForReportingButNotEnforced";

export interface CaUsers {
  includeUsers?: string[];
  excludeUsers?: string[];
  includeGroups?: string[];
  excludeGroups?: string[];
  includeRoles?: string[];
  excludeRoles?: string[];
  includeGuestsOrExternalUsers?: { guestOrExternalUserTypes?: string; externalTenants?: { membershipKind?: string } } | null;
  excludeGuestsOrExternalUsers?: { guestOrExternalUserTypes?: string; externalTenants?: { membershipKind?: string } } | null;
}

export interface CaApplications {
  includeApplications?: string[];
  excludeApplications?: string[];
  includeUserActions?: string[];
  includeAuthenticationContextClassReferences?: string[];
  applicationFilter?: { mode?: string; rule?: string } | null;
}

export interface CaConditions {
  users?: CaUsers;
  applications?: CaApplications;
  clientAppTypes?: string[];
  platforms?: { includePlatforms?: string[]; excludePlatforms?: string[] } | null;
  locations?: { includeLocations?: string[]; excludeLocations?: string[] } | null;
  signInRiskLevels?: string[];
  userRiskLevels?: string[];
  servicePrincipalRiskLevels?: string[];
  insiderRiskLevels?: string | null;
  devices?: { deviceFilter?: { mode?: string; rule?: string } | null } | null;
  clientApplications?: {
    includeServicePrincipals?: string[];
    excludeServicePrincipals?: string[];
    servicePrincipalFilter?: { mode?: string; rule?: string } | null;
  } | null;
  authenticationFlows?: { transferMethods?: string } | null;
}

export interface CaGrantControls {
  operator?: string;
  builtInControls?: string[];
  customAuthenticationFactors?: string[];
  termsOfUse?: string[];
  authenticationStrength?: { id?: string; displayName?: string; allowedCombinations?: string[] } | null;
}

export interface CaSessionControls {
  signInFrequency?: { isEnabled?: boolean; value?: number; type?: string; frequencyInterval?: string; authenticationType?: string } | null;
  persistentBrowser?: { isEnabled?: boolean; mode?: string } | null;
  applicationEnforcedRestrictions?: { isEnabled?: boolean } | null;
  cloudAppSecurity?: { isEnabled?: boolean; cloudAppSecurityType?: string } | null;
  disableResilienceDefaults?: boolean | null;
  secureSignInSession?: { isEnabled?: boolean } | null;
  [key: string]: unknown;
}

export interface CaPolicy {
  id?: string;
  displayName: string;
  state?: PolicyState;
  description?: string | null;
  createdDateTime?: string;
  modifiedDateTime?: string;
  templateId?: string | null;
  conditions: CaConditions;
  grantControls?: CaGrantControls | null;
  sessionControls?: CaSessionControls | null;
}

/** One file handed to the adapter (from a repo index, an upload, or a zip). */
export interface BaselineFile {
  path: string;
  text: string;
}

export type ReferenceKind =
  | "group"
  | "user"
  | "role"
  | "application"
  | "namedLocation"
  | "servicePrincipal"
  | "authenticationStrength"
  | "termsOfUse";

/** Whether an identifier is meaningful across tenants. */
export type Portability =
  | "stable"          // role template IDs, built-in auth strengths — same GUID everywhere
  | "verify"          // first-party app IDs — same GUID everywhere but the service principal may not exist in the target tenant
  | "tenantSpecific"; // groups, users, named locations, custom auth strengths, SPs, ToU — must be mapped

export interface ReferenceUse {
  policyName: string;
  side: "include" | "exclude" | "control";
}

export interface Reference {
  id: string;
  kind: ReferenceKind;
  portability: Portability;
  /** True when the source used a named token (e.g. "CA-GlobalExclusions-GroupId-ReplaceMe") instead of a GUID. */
  placeholder?: boolean;
  uses: ReferenceUse[];
}

export type InferredGroupRole =
  | "globalExclusion"
  | "broadExclusion"
  | "serviceAccounts"
  | "deviceExclusion"
  | "locationException"
  | "adminPersona"
  | "passkeyPilot"
  | "appPersona"
  | "includedPersona"
  | "unknown";

export interface GroupSignature {
  id: string;
  includedIn: string[];
  excludedFrom: string[];
  inferredRole: InferredGroupRole;
  confidence: "high" | "medium" | "low";
  evidence: string;
}

export interface VariantSet {
  /** Shared intent fingerprint. */
  intentKey: string;
  policyNames: string[];
  /** "duplicate" = identical policies; "variant" = same intent, different scoping (choose one). */
  relation: "duplicate" | "variant";
}

export interface PolicyDoc {
  policyName: string;
  intent?: string;
  sourcePath: string;
}

export interface LoadReport {
  considered: number;
  parsed: number;
  skipped: { path: string; reason: string }[];
  errors: { path: string; error: string }[];
  duplicates: { path: string; supersededBy: string; reason: string }[];
  /** Policies that parsed but cannot be used as written (e.g. exported with no targets). */
  warnings: { policyName: string; path: string; warning: string }[];
}

export interface BaselinePackage {
  /** Deduplicated, normalized policies. `state` is the *source's* state and is not a target. */
  policies: CaPolicy[];
  /** Where each policy came from (path). */
  origins: Record<string, string>;
  report: LoadReport;
  references: Reference[];
  groupSignatures: GroupSignature[];
  variantSets: VariantSet[];
  docs: PolicyDoc[];
}
