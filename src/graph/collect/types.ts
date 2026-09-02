// Types for the collection service (docs/design/collection.md §4). Types
// only — no runtime imports beyond the pure scoring types.
import type { AuthMethodSummary } from '../../scoring/mfaViability.ts'
import type { Capability } from './registry.ts'

export type SourceKey =
  | 'config'
  | 'registrationDetails'
  | 'users'
  | 'devices'
  | 'spActivity'
  | 'authMethods'
  | 'appSignInSummary'
  | 'signInEvidence'

export type SourceStatus = 'ok' | 'partial' | 'insufficient' | 'disabled' | 'error' | 'pending'

export type SourceState = {
  status: SourceStatus
  coveredWindow: { from: string; to: string } | null
  reason: string | null
  asOf: string
}

export type ConfigSectionKey =
  | 'caPolicies'
  | 'namedLocations'
  | 'authStrengths'
  | 'authMethodsPolicy'
  | 'securityDefaults'
  | 'crossTenantAccess'
  | 'roleAssignments'
  | 'pimEligibility'
  | 'subscribedSkus'
  | 'organization'
  | 'me'
  | 'meMemberOf'

export type ConfigSection = {
  status: 'ok' | 'disabled' | 'error'
  reason: string | null
  rows: unknown[]
  /** How the read went (prompt 46 item 24): the last response's HTTP status and body length; null before a scan records them. */
  httpStatus?: number | null
  bodyBytes?: number | null
  /** A field the v1.0 read lacked and a second read supplied (prompt 47 item 8), e.g. "policyMigrationState from beta". */
  fallback?: string | null
}

export type UserRow = {
  id: string
  displayName: string | null
  userPrincipalName: string | null
  userType: 'member' | 'guest'
  usageLocation: string | null
  createdDateTime: string | null
  lastSuccessfulSignIn: string | null
  accountEnabled: boolean | null
  /** The primary SMTP address; a mailbox with no plans and no sign-in is a shared mailbox, not a person (prompt 46 §8.1). */
  mail: string | null
  assignedPlans: { servicePlanId: string; capabilityStatus: string }[]
  /** Licence SKUs assigned directly or by group (prompt 48 item 4): a Teams Shared Devices licence has no service plan of its own. */
  skuIds?: string[]
  onPremisesSyncEnabled: boolean | null
  externalUserState: string | null
  department: string | null
  jobTitle: string | null
  officeLocation: string | null
}

export type DeviceRow = {
  id: string
  displayName: string | null
  isCompliant: boolean | null
  isManaged: boolean | null
  trustType: string | null
  ownerIds: string[]
  operatingSystem?: string | null
  approximateLastSignIn?: string | null
}

export type RegistrationRow = {
  id: string
  userPrincipalName: string | null
  isMfaCapable: boolean
  isMfaRegistered: boolean
  isPasswordlessCapable: boolean
  methodsRegistered: string[]
  defaultMfaMethod: string | null
  userPreferredMethodForSecondaryAuthentication: string | null
  isAdmin: boolean
  userType: 'member' | 'guest'
}

export type MethodsByUser = Record<string, AuthMethodSummary[] | 'unknown'>

export type UserEvidence = {
  signInCount: number
  lastSignIn: string | null
  lastMfaSuccess: { at: string; method: string } | null
  /** Countries this account signed in from in the window; the allowed-countries
   * and emergency-access checks need them per account, not only per tenant. */
  countries?: string[]
}

// The raw sign-in subset Lane B keeps: lives only in the worker and the
// IndexedDB cache (§4 boundary rule), never in the snapshot.
export type StoredSignIn = {
  id: string
  createdDateTime: string
  userId: string
  authenticationRequirement?: string
  mfaDetail?: { authMethod?: string } | null
  authenticationDetails?: { succeeded?: boolean; authenticationMethod?: string }[] | null
  status?: { errorCode?: number } | null
  conditionalAccessStatus?: string
  appliedConditionalAccessPolicies?: { id?: string; displayName?: string; result?: string }[] | null
  clientAppUsed?: string
  appId?: string
  authenticationProtocol?: string
  originalTransferMethod?: string
  country?: string
  /** Identity Protection's verdicts on the sign-in (prompt 47 item 6): none · low · medium · high · hidden. */
  riskLevelDuringSignIn?: string
  riskLevelAggregated?: string
  // ---- prompt 48 item 1: derived labels only, never an address or a user-agent string ----
  /** From deviceDetail.operatingSystem, normalised; '' when Graph gave none. Absent on rows stored before schema 7. */
  os?: '' | 'Windows' | 'macOS' | 'iOS' | 'Android' | 'Linux' | 'ChromeOS'
  /** Browser family only (Chrome, Edge, Safari, Firefox, Rich Client); '' when none. */
  browser?: string
  isCompliant?: boolean
  isManaged?: boolean
  trustType?: 'joined' | 'hybrid' | 'registered' | 'none'
  crossTenantAccessType?: 'none' | 'b2bCollaboration' | 'b2bDirectConnect' | 'serviceProvider' | 'passthrough' | 'other'
  /** The signing-in account's home tenant, for counting partner tenants; stays in the worker and the cache. */
  homeTenantId?: string
  appDisplayName?: string
  resourceDisplayName?: string
  /** Named locations the sign-in matched, by name, and whether any of them was trusted. */
  namedLocations?: string[]
  trustedLocation?: boolean
}

// Lane B derived table for the Inventory page: counts only, never raw rows.
export type EvidenceAggregates = {
  total: number
  distinctUsers: number
  byClientApp: Record<string, number>
  byProtocol: Record<string, number>
  /** country → distinct users seen from it */
  byCountry: Record<string, number>
  /** country → sign-ins from it; absent on snapshots taken before it was counted */
  signInsByCountry?: Record<string, number>
  /** Interactive sign-ins per UTC weekday and hour (Sunday first, 168 buckets), for the tenant's rhythm. */
  byWeekdayHour?: number[]
}

// Lane B usage signals for block-goal evidence (roadmap.md §5): who was seen
// using the thing a block step would block — the exact blast radius.
export type UsageSignal = { count: number; userIds: string[]; byDetail: Record<string, number> }
export type EvidenceUsage = {
  legacyAuth: UsageSignal
  deviceCode: UsageSignal
  authTransfer: UsageSignal
  /** Sign-ins Identity Protection rated high (prompt 47 item 6); the people a high-risk policy affects. */
  riskHigh: UsageSignal
  /** Rated medium; a medium-or-above policy affects these people and the high ones. */
  riskMedium: UsageSignal
}

export type PolicyResultClass =
  | 'reportOnlyFailure'
  | 'reportOnlyInterrupted'
  | 'reportOnlySuccess'
  | 'enforcedFailure'
  | 'enforcedSuccess'

// Lane B derived table: per-policy applied results across the covered window
// (collection.md §4) — what moves a step planned → report-only → enforced.
export type PolicyAppliedResult = {
  policyId: string
  displayName: string | null
  counts: Record<PolicyResultClass, number>
  affectedUserIds: Record<PolicyResultClass, string[]>
  /** Failures (enforced or report-only) per UTC day with the users behind them, for the post-enforcement watch. */
  byDay?: Record<string, { failures: number; userIds: string[] }>
}

// Lane B derived table: users whose most recent sign-in in the window failed
// Conditional Access, grouped by the failing policy.
export type BlockedTodayEntry = {
  policyId: string
  displayName: string | null
  userIds: string[]
}

export type TenantSnapshot = {
  schemaVersion: 1
  tenantId: string
  asOf: string
  sources: Record<SourceKey, SourceState>
  config: Record<ConfigSectionKey, ConfigSection>
  registrationDetails: RegistrationRow[]
  users: UserRow[]
  devices: DeviceRow[]
  spActivity: unknown[]
  authMethods: MethodsByUser
  appSignInSummary: unknown[]
  signInEvidence: Record<string, UserEvidence>
  evidencePolicyResults: PolicyAppliedResult[]
  blockedToday: BlockedTodayEntry[]
  evidenceUsage: EvidenceUsage | null
  evidenceAggregates?: EvidenceAggregates | null
  /** The lockout-scenario derivations (prompt 48 item 3), from the rows; null until Lane B has run. */
  scenarioEvidence?: import('../../derive/evidence.ts').ScenarioEvidence | null
  // Tenant licence capabilities derived from subscribedSkus (SPEC §12).
  capabilities: Record<Capability, { enabled: boolean; seats: number; consumed: number }>
  // CA policies that Microsoft manages (display-name prefix or templateId).
  microsoftManagedPolicyIds: string[]
  // Per-user directory roles, keyed by user id → role template ids. Eligible
  // (PIM) is kept apart from active: eligible is out of CA role scope until
  // activated, and scoring/impact must treat it that way.
  roles: {
    active: Record<string, string[]>
    eligible: Record<string, string[]>
  }
}

export type WorkerInMessage =
  | { type: 'start'; token: string; tenantId: string; licenceOverride?: 'free' | 'p1' | 'p2'; devFail?: boolean }
  | { type: 'token'; token: string }
  | { type: 'cancel' }

export type SectionEvent = {
  type: 'section'
  source: SourceKey | `config:${ConfigSectionKey}`
  status: 'started' | SourceStatus
  rows?: number
  reason?: string
  ms?: number
}

export type WorkerOutMessage =
  | SectionEvent
  | { type: 'token-needed' }
  | { type: 'signin-page'; pages: number; rows: number; ms: number; oldest: string | null }
  | { type: 'state'; value: 'normal' | 'slow' | 'done' }
  | { type: 'snapshot'; snapshot: TenantSnapshot }
  | { type: 'fatal'; message: string }
  // Raised by the main-thread controller, not the worker (prompt 20 §3).
  | { type: 'auth-expired' }
  | { type: 'auth-resumed' }
