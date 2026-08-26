// Types for the collection service (docs/design/collection.md §4). Types
// only — no runtime imports beyond the pure scoring types.
import type { AuthMethodSummary } from '../../scoring/mfaViability.ts'

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

export type ConfigSection = {
  status: 'ok' | 'disabled' | 'error'
  reason: string | null
  rows: unknown[]
}

export type UserRow = {
  id: string
  displayName: string | null
  userPrincipalName: string | null
  userType: 'member' | 'guest'
  usageLocation: string | null
  lastSuccessfulSignIn: string | null
}

export type DeviceRow = {
  id: string
  displayName: string | null
  isCompliant: boolean | null
  isManaged: boolean | null
  trustType: string | null
  ownerIds: string[]
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
}

export type WorkerInMessage =
  | { type: 'start'; token: string; tenantId: string }
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
  | { type: 'snapshot'; snapshot: TenantSnapshot }
  | { type: 'fatal'; message: string }
